using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;

namespace UntPlanStudio.Tests;

/// <summary>Plantafel der Stundenplanung (Steckbrett, Vorrat, Zielstufen beim Ziehen) und Dialog „Neuer Unterricht“.</summary>
public sealed class PlantafelTests : IClassFixture<StudioFabrik>
{
    private readonly StudioFabrik _f;

    public PlantafelTests(StudioFabrik f) => _f = f;

    private async Task<(HttpClient C, string Basis)> BeispielAsync()
    {
        var c = await _f.AngemeldetAsync();
        var id = (await c.PostJsonAsync("/api/dokumente/beispiel"))["id"]!.GetValue<string>();
        return (c, $"/api/dokumente/{id}");
    }

    private static int I(JsonNode? n) => n!.GetValue<int>();
    private static string S(JsonNode? n) => n!.GetValue<string>();

    [Fact]
    public async Task SteckbrettLiefertZeilenStundenUndVorrat()
    {
        var (c, basis) = await BeispielAsync();
        var t = await c.GetJsonAsync($"{basis}/planung/plantafel?typ=klasse");
        var elemente = await c.GetJsonAsync($"{basis}/elemente");
        Assert.Equal(elemente["klasse"]!.AsArray().Count, t["zeilen"]!.AsArray().Count);
        Assert.Equal("klasse", S(t["typ"]));
        Assert.Equal(5, t["zeitraster"]!["tage"]!.AsArray().Count);
        var planstunden = I((await c.GetJsonAsync(basis))["zaehler"]!["planstunden"]);
        Assert.Equal(planstunden, t["stunden"]!.AsArray().Count);
        // offene Blöcke = Wochenstunden minus verplante Stunden
        var stunden = t["stunden"]!.AsArray().GroupBy(x => I(x!["u"])).ToDictionary(x => x.Key, x => x.Count());
        foreach (var u in t["unterrichte"]!.AsArray())
        {
            var offen = u!["offen"]!.AsArray().Sum(x => I(x));
            Assert.Equal(Math.Max(0, I(u["wst"]) - stunden.GetValueOrDefault(I(u["u"]))), offen);
        }
        // gekoppelter Unterricht: mehrere Zeilen, alle Klassen und Lehrkräfte
        Assert.Contains(t["unterrichte"]!.AsArray(), u => u!["zeilen"]!.AsArray().Count > 1 && u["lehrer"]!.AsArray().Count > 1);
        foreach (var typ in new[] { "lehrer", "raum" })
            Assert.Equal(elemente[typ]!.AsArray().Count, (await c.GetJsonAsync($"{basis}/planung/plantafel?typ={typ}"))["zeilen"]!.AsArray().Count);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.GetAsync($"{basis}/planung/plantafel?typ=fach")).StatusCode);
    }

    [Fact]
    public async Task ZielstufenUnterscheidenFreiWeichUndHart()
    {
        var (c, basis) = await BeispielAsync();
        var t = await c.GetJsonAsync($"{basis}/planung/plantafel?typ=klasse");
        var p = t["stunden"]!.AsArray().First(x => !x!["fix"]!.GetValue<bool>())!;
        int u = I(p["u"]), tag = I(p["tag"]), stunde = I(p["stunde"]);
        var z = await c.GetJsonAsync($"{basis}/planung/plantafel/ziele?unterricht={u}&tag={tag}&stunde={stunde}");
        var stufen = z["stufen"]!.AsArray();
        Assert.Equal(5, stufen.Count);
        Assert.Equal("eigen", S(stufen[tag]![stunde - 1]));
        var alle = stufen.SelectMany(x => x!.AsArray().Select(S)).ToList();
        Assert.All(alle, s => Assert.Contains(s, new[] { "frei", "tausch", "weich", "hart", "eigen" }));
        Assert.Contains("hart", alle);
        // harte Felder haben einen Grund
        var gruende = z["gruende"]!.AsArray();
        for (var tt = 0; tt < 5; tt++)
            for (var s = 0; s < stufen[tt]!.AsArray().Count; s++)
                if (S(stufen[tt]![s]) == "hart") Assert.False(string.IsNullOrEmpty(S(gruende[tt]![s])), $"Grund fehlt bei {tt}/{s + 1}");

        // Sperrzeit (−3) der Lehrkraft ist hart, ein negativer Zeitwunsch (−1) weich
        var lehrer = I(t["unterrichte"]!.AsArray().First(x => I(x!["u"]) == u)!["lehrer"]![0]);
        var frei = Enumerable.Range(0, 5).SelectMany(x => Enumerable.Range(0, stufen[x]!.AsArray().Count).Select(s => (x, s)))
            .Where(q => S(stufen[q.x]![q.s]) == "frei").Take(2).ToList();
        Assert.Equal(2, frei.Count);
        var aen = await c.PutAsJsonAsync($"{basis}/zeitwuensche/lehrer/{lehrer}", new
        {
            aenderungen = new[] { new { tag = frei[0].x, stunde = frei[0].s + 1, wert = -3 }, new { tag = frei[1].x, stunde = frei[1].s + 1, wert = -1 } },
        });
        Assert.Equal(HttpStatusCode.OK, aen.StatusCode);
        z = await c.GetJsonAsync($"{basis}/planung/plantafel/ziele?unterricht={u}&tag={tag}&stunde={stunde}&einzeln=true");
        Assert.Equal("hart", S(z["stufen"]![frei[0].x]![frei[0].s]));
        Assert.Equal("weich", S(z["stufen"]![frei[1].x]![frei[1].s]));
        Assert.Contains("Zeitwunsch", S(z["gruende"]![frei[1].x]![frei[1].s]));
    }

    [Fact]
    public async Task NeuerUnterrichtImDialogMitKopplungUndDoppelstunde()
    {
        var (c, basis) = await BeispielAsync();
        var el = await c.GetJsonAsync($"{basis}/elemente");
        int K(int i) => I(el["klasse"]![i]!["id"]);
        int L(int i) => I(el["lehrer"]![i]!["id"]);
        var fach = I(el["fach"]![0]!["id"]);
        var raum = I(el["raum"]![0]!["id"]);

        var neu = await c.PostJsonAsync($"{basis}/planung/neuer-unterricht", new
        {
            wochenstunden = 3, doppelstunden = "1-1", woche = "A", text = "Förderband",
            zeilen = new object[] { new { fach, lehrer = L(0), klassen = new[] { K(0), K(1) }, raum }, new { fach, lehrer = L(1), klassen = new[] { K(0), K(1) } } },
        });
        var id = I(neu["id"]);
        Assert.Equal(new[] { 2, 1 }, neu["offen"]!.AsArray().Select(I).ToArray());
        Assert.Contains("Neuer Unterricht", S((await c.GetJsonAsync(basis))["rueckgaengigText"]));

        // erscheint sofort im Vorrat der Plantafel (beide Klassen, beide Lehrkräfte) und in der Unterrichtstabelle
        var t = await c.GetJsonAsync($"{basis}/planung/plantafel?typ=klasse");
        var u = t["unterrichte"]!.AsArray().First(x => I(x!["u"]) == id)!;
        Assert.Equal(2, u["zeilen"]!.AsArray().Count);
        Assert.Equal(new[] { K(0), K(1) }, u["klassen"]!.AsArray().Select(I).ToArray());
        Assert.Equal("A", S(u["woche"]));
        var tabelle = await c.GetJsonAsync($"{basis}/unterricht?sicht=klasse&element={K(0)}");
        Assert.Contains(tabelle["unterrichte"]!.AsArray(), x => I(x!["id"]) == id);

        // Doppelstunde aus dem Vorrat setzen: danach bleibt eine Einzelstunde offen
        var z = await c.GetJsonAsync($"{basis}/planung/plantafel/ziele?unterricht={id}&laenge=2");
        var stufen = z["stufen"]!.AsArray();
        var ziel = Enumerable.Range(0, 5).SelectMany(x => Enumerable.Range(0, stufen[x]!.AsArray().Count).Select(s => (x, s)))
            .First(q => S(stufen[q.x]![q.s]) is "frei" or "weich");
        await c.PostJsonAsync($"{basis}/planung/verplanen", new { unterricht = id, tag = ziel.x, stunde = ziel.s + 1, laenge = 2 });
        t = await c.GetJsonAsync($"{basis}/planung/plantafel?typ=klasse");
        Assert.Equal(new[] { 1 }, t["unterrichte"]!.AsArray().First(x => I(x!["u"]) == id)!["offen"]!.AsArray().Select(I).ToArray());
        Assert.Equal(2, t["stunden"]!.AsArray().Count(x => I(x!["u"]) == id));

        // Rückgängig (zweimal: Setzen, Anlegen) entfernt den Unterricht wieder
        await c.PostJsonAsync($"{basis}/rueckgaengig");
        await c.PostJsonAsync($"{basis}/rueckgaengig");
        t = await c.GetJsonAsync($"{basis}/planung/plantafel?typ=klasse");
        Assert.DoesNotContain(t["unterrichte"]!.AsArray(), x => I(x!["u"]) == id);
    }

    [Fact]
    public async Task NeuerUnterrichtPrueftDieAngaben()
    {
        var (c, basis) = await BeispielAsync();
        var el = await c.GetJsonAsync($"{basis}/elemente");
        var klasse = I(el["klasse"]![0]!["id"]);
        var fach = I(el["fach"]![0]!["id"]);
        async Task<string> Fehler(object daten)
        {
            var r = await c.PostAsJsonAsync($"{basis}/planung/neuer-unterricht", daten);
            Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
            return S((await r.JsonAsync(HttpStatusCode.BadRequest))["fehler"]);
        }
        Assert.Contains("Wochenstunden", await Fehler(new { wochenstunden = 0, zeilen = new[] { new { fach, klassen = new[] { klasse } } } }));
        Assert.Contains("Fach", await Fehler(new { wochenstunden = 2, zeilen = new[] { new { klassen = new[] { klasse } } } }));
        Assert.Contains("Klasse", await Fehler(new { wochenstunden = 2, zeilen = new[] { new { fach } } }));
        Assert.Contains("Doppelstunden", await Fehler(new { wochenstunden = 2, doppelstunden = "x", zeilen = new[] { new { fach, klassen = new[] { klasse } } } }));
        Assert.Contains("Blöcke", await Fehler(new { wochenstunden = 2, block = "3", zeilen = new[] { new { fach, klassen = new[] { klasse } } } }));
        Assert.Contains("passen nicht", await Fehler(new { wochenstunden = 3, doppelstunden = "2-2", zeilen = new[] { new { fach, klassen = new[] { klasse } } } }));
        Assert.Contains("gibt es nicht", await Fehler(new { wochenstunden = 2, zeilen = new[] { new { fach = 999999, klassen = new[] { klasse } } } }));
        // nichts angelegt
        Assert.DoesNotContain("Neuer Unterricht", (await c.GetJsonAsync(basis))["rueckgaengigText"]?.GetValue<string>() ?? "");
    }

    /// <summary>Band (parallele Kurse einer Schiene): Zielstufen für alle Kurse, Verschieben, Entplanen und Setzen als Ganzes.</summary>
    [Fact]
    public async Task BandWandertAlsGanzes()
    {
        var (c, basis) = await BeispielAsync();
        var t = await c.GetJsonAsync($"{basis}/planung/plantafel?typ=klasse");
        var bandU = t["unterrichte"]!.AsArray().Where(u => S(u!["band"]).Length > 0).GroupBy(u => S(u!["band"])).First(gr => gr.Count() >= 2);
        var ids = bandU.Select(u => I(u!["u"])).OrderBy(x => x).ToList();
        int leit = ids[0], partner = ids[1];
        List<(int Tag, int Stunde)> Lage(JsonNode tafel, int u) => tafel["stunden"]!.AsArray().Where(x => I(x!["u"]) == u).Select(x => (I(x!["tag"]), I(x!["stunde"]))).OrderBy(x => x).ToList();
        var vorher = Lage(t, leit);
        Assert.Equal(vorher, Lage(t, partner)); // die Kurse des Bandes liegen parallel
        var (tag, stunde) = vorher[0];

        // Zielstufen nennen alle Kurse des Bandes
        var z = await c.GetJsonAsync($"{basis}/planung/plantafel/ziele?unterricht={leit}&tag={tag}&stunde={stunde}");
        Assert.Equal(ids.Count, z["band"]!.AsArray().Count);
        Assert.Equal("eigen", S(z["stufen"]![tag]![stunde - 1]));
        var stufen = z["stufen"]!.AsArray();
        var freie = Enumerable.Range(0, 5).SelectMany(x => Enumerable.Range(0, stufen[x]!.AsArray().Count).Select(s => (x, s))).Where(q => S(stufen[q.x]![q.s]) == "frei").ToList();
        Assert.True(freie.Count >= 2);

        // Sperrzeit der Lehrkraft des PARTNERS macht das Feld hart, der Grund nennt den Partner
        var lehrerPartner = I(bandU.First(u => I(u!["u"]) == partner)!["lehrer"]![0]);
        var sperre = freie[0];
        var n = z["laenge"]!.GetValue<int>();
        await c.PutAsJsonAsync($"{basis}/zeitwuensche/lehrer/{lehrerPartner}", new { aenderungen = Enumerable.Range(0, n).Select(i => new { tag = sperre.x, stunde = sperre.s + 1 + i - z["versatz"]!.GetValue<int>(), wert = -3 }).ToArray() });
        z = await c.GetJsonAsync($"{basis}/planung/plantafel/ziele?unterricht={leit}&tag={tag}&stunde={stunde}");
        Assert.Equal("hart", S(z["stufen"]![sperre.x]![sperre.s]));
        Assert.Contains($"U-Nr. {partner}", S(z["gruende"]![sperre.x]![sperre.s]));

        // Verschieben: beide Kurse wandern um denselben Versatz
        var ziel = Enumerable.Range(0, 5).SelectMany(x => Enumerable.Range(0, z["stufen"]![x]!.AsArray().Count).Select(s => (x, s))).First(q => S(z["stufen"]![q.x]![q.s]) == "frei");
        var erg = await c.PostJsonAsync($"{basis}/planung/band/verschieben", new { unterricht = leit, tag, stunde, zielTag = ziel.x, zielStunde = ziel.s + 1 });
        Assert.True(erg["ok"]!.GetValue<bool>());
        t = await c.GetJsonAsync($"{basis}/planung/plantafel?typ=klasse");
        var nachher = Lage(t, leit);
        Assert.NotEqual(vorher, nachher);
        Assert.Equal(nachher, Lage(t, partner));
        Assert.Contains("Band", S((await c.GetJsonAsync(basis))["rueckgaengigText"]));

        // Entplanen des Blocks beider Kurse, dann aus dem Vorrat gemeinsam setzen
        var block = nachher.Where(x => x.Tag == ziel.x).ToList();
        await c.PostJsonAsync($"{basis}/planung/entplanen", new { stunden = ids.Take(2).SelectMany(u => block.Select(b => new { unterricht = u, tag = b.Tag, stunde = b.Stunde })).ToArray() });
        var zv = await c.GetJsonAsync($"{basis}/planung/plantafel/ziele?unterricht={leit}&laenge={block.Count}");
        Assert.True(zv["band"]!.AsArray().Count >= 2);
        var st = zv["stufen"]!.AsArray();
        var frei = Enumerable.Range(0, 5).SelectMany(x => Enumerable.Range(0, st[x]!.AsArray().Count).Select(s => (x, s))).First(q => S(st[q.x]![q.s]) == "frei");
        await c.PostJsonAsync($"{basis}/planung/band/verplanen", new { unterricht = leit, tag = frei.x, stunde = frei.s + 1, laenge = block.Count });
        t = await c.GetJsonAsync($"{basis}/planung/plantafel?typ=klasse");
        Assert.Equal(Lage(t, leit), Lage(t, partner));
        Assert.Contains((frei.x, frei.s + 1), Lage(t, partner));
    }

    [Fact]
    public async Task PlantafelNenntBevorzugteRaeume()
    {
        var (c, basis) = await BeispielAsync();
        var t = await c.GetJsonAsync($"{basis}/planung/plantafel?typ=klasse");
        var mitWunsch = t["unterrichte"]!.AsArray().Where(u => u!["wunsch"]!.AsArray().Count > 0).ToList();
        Assert.NotEmpty(mitWunsch);
        Assert.All(mitWunsch.SelectMany(u => u!["wunsch"]!.AsArray()), w => Assert.Contains(S(w!["art"]), new[] { "Fachraum", "Stammraum" }));
        Assert.NotNull(t["raumgruppen"]);
        Assert.NotNull(t["namen"]!["raumgruppen"]);
    }
}
