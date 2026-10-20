using System.Diagnostics;
using System.Text.Json.Nodes;
using Xunit.Abstractions;

namespace UntPlanStudio.Tests;

/// <summary>
/// Tagesplanung „Fall für Fall“: Fälle (Stunde bzw. Block einer fehlenden Lehrkraft) bleiben beim Lösen stehen, Kandidaten für den
/// ganzen Block, Vorziehen einer anderen Stunde in die Lücke (Ziel und Herkunft in der Tagesübersicht), Vorschläge für alle offenen
/// Fälle ohne Änderung – und die Last einer großen Schule (300 Lehrkräfte, 60 Klassen, 15 Abwesenheiten).
/// </summary>
public sealed class FallTests : IClassFixture<StudioFabrik>
{
    private readonly StudioFabrik _f;
    private readonly ITestOutputHelper _aus;

    public FallTests(StudioFabrik f, ITestOutputHelper aus)
    {
        _f = f;
        _aus = aus;
    }

    private static string S(JsonNode? n) => n?.GetValue<string>() ?? "";
    private static List<JsonNode> Liste(JsonNode? n) => n!.AsArray().Select(x => x!).ToList();
    private static List<int> Ids(JsonNode? n) => n!.AsArray().Select(x => x!.GetValue<int>()).ToList();
    private static List<JsonNode> Faelle(JsonNode f) => Liste(f["faelle"]);

    private static async Task<(HttpClient C, string Dok, string Basis, string Datum)> SchuleAsync(HttpClient c, string id)
    {
        var basis = $"/api/dokumente/{id}/vertretung";
        return (c, $"/api/dokumente/{id}", basis, S((await c.GetJsonAsync($"{basis}/start"))["datum"]));
    }

    [Fact]
    public async Task BlockWirdAlsEinFallGeloestUndBleibtStehen()
    {
        var c = await _f.AngemeldetAsync();
        var (_, dok, basis, datum) = await SchuleAsync(c, (await c.PostJsonAsync("/api/dokumente/beispiel"))["id"]!.GetValue<string>());

        // eine Lehrkraft mit Doppelstunde am Planungstag abwesend melden
        JsonNode? block = null;
        foreach (var l in Liste((await c.GetJsonAsync($"{dok}/elemente?typen=lehrer"))["lehrer"]))
        {
            var erg = await c.PostJsonAsync($"{basis}/absenzen/speichern", new { art = "lehrer", neu = new[] { new { id = 0, element = S(l["k"]), von = datum } } });
            var f0 = await c.GetJsonAsync($"{basis}/tagesablauf/faelle?datum={datum}");
            block = Faelle(f0).FirstOrDefault(x => x["stunden"]!.AsArray().Count > 1 && x["offeneIds"]!.AsArray().Count > 1 && !x["pause"]!.GetValue<bool>());
            if (block is not null) break;
            await c.PostJsonAsync($"{basis}/absenzen/loeschen", new { ids = Ids(erg["gespeichert"]) });
        }
        Assert.NotNull(block);
        var schluessel = S(block!["schluessel"]);
        var ids = Ids(block["offeneIds"]);
        var stunden = Ids(block["stunden"]);
        _aus.WriteLine($"Block {S(block["klassen"])} {S(block["fach"])} {string.Join(",", stunden)} – {S(block["lehrer"])} fehlt");
        Assert.Equal("offen", S(block["zustand"]));
        var f = await c.GetJsonAsync($"{basis}/tagesablauf/faelle?datum={datum}");
        Assert.NotEmpty(Liste(f["abwesend"]));
        Assert.Contains(Liste(f["klassen"]), k => Ids(block["klassenIds"]).Contains(k["id"]!.GetValue<int>()));

        // Kandidaten für den ganzen Block: in allen Stunden frei, mit Begründung in Worten
        var k = await c.GetJsonAsync($"{basis}/tagesablauf/fallkandidaten?ids={string.Join(",", ids)}&anzahl=5");
        var kandidaten = Liste(k["kandidaten"]);
        Assert.NotEmpty(kandidaten);
        Assert.True(kandidaten.Count <= 5);
        Assert.All(kandidaten, x => Assert.Contains($"frei {stunden[0]}.–{stunden[^1]}.", Liste(x["gruende"]).Select(S)));
        var frei = await c.GetJsonAsync($"{basis}/tagesablauf/frei?datum={datum}");
        var spalten = Liste(frei["stunden"]).Select(s => s["nr"]!.GetValue<int>()).ToList();
        foreach (var x in kandidaten)
        {
            var zeile = Liste(frei["lehrer"]).Single(l => l["id"]!.GetValue<int>() == x["lehrer"]!.GetValue<int>());
            foreach (var s in stunden)
                Assert.Contains(S(zeile["zellen"]![spalten.IndexOf(s)]![0]), new[] { "", "B", "X", "H" });
        }

        // übernehmen (wie der Knopf: alle offenen Stunden des Falls) – der Fall bleibt mit demselben Schlüssel stehen, jetzt erledigt
        var wer = kandidaten[0];
        await c.PostJsonAsync($"{basis}/vorschlag/{ids[0]}/uebernehmen", new { lehrer = wer["lehrer"]!.GetValue<int>(), ids });
        var nach = await c.GetJsonAsync($"{basis}/tagesablauf/faelle?datum={datum}");
        var gleich = Faelle(nach).Single(x => S(x["schluessel"]) == schluessel);
        Assert.Equal("erledigt", S(gleich["zustand"]));
        Assert.Equal(S(wer["k"]), S(gleich["ergebnis"]));
        Assert.Equal(Faelle(f).Select(x => S(x["schluessel"])), Faelle(nach).Select(x => S(x["schluessel"])));
        Assert.Equal(Liste(f["klassen"]).Select(x => S(x["k"])), Liste(nach["klassen"]).Select(x => S(x["k"])));

        // zurücksetzen: wieder offen, wieder derselbe Fall
        await c.PostJsonAsync($"{basis}/zuruecksetzen", new { ids = Ids(gleich["ids"]) });
        Assert.Equal("offen", S(Faelle(await c.GetJsonAsync($"{basis}/tagesablauf/faelle?datum={datum}")).Single(x => S(x["schluessel"]) == schluessel)["zustand"]));
    }

    [Fact]
    public async Task VorziehenZeigtZielUndHerkunftUndVorschlaegeAendernNichts()
    {
        var c = await _f.AngemeldetAsync();
        var (_, dok, basis, datum) = await SchuleAsync(c, (await c.PostJsonAsync("/api/dokumente/beispiel"))["id"]!.GetValue<string>());
        // zwei Lehrkräfte mit Unterricht abwesend
        var lehrer = Liste((await c.GetJsonAsync($"{dok}/elemente?typen=lehrer"))["lehrer"]);
        var mit = new List<string>();
        foreach (var l in lehrer)
        {
            var plan = await c.GetJsonAsync($"{basis}/plan/lehrer/{l["id"]}?datum={datum}");
            if (plan["zellen"]!.AsArray().Count(z => S(z!["datum"]) == datum) >= 3) mit.Add(S(l["k"]));
            if (mit.Count == 2) break;
        }
        await c.PostJsonAsync($"{basis}/absenzen/speichern", new { art = "lehrer", neu = mit.Select(k => new { id = 0, element = k, von = datum }).ToArray() });
        var f = await c.GetJsonAsync($"{basis}/tagesablauf/faelle?datum={datum}");
        var offen = Faelle(f).Where(x => S(x["zustand"]) == "offen" && !x["pause"]!.GetValue<bool>()).ToList();
        Assert.NotEmpty(offen);

        // Vorschläge für alle: blockweise, nichts geändert
        var vorher = Faelle(f).Count(x => S(x["zustand"]) != "erledigt");
        var v = await c.PostJsonAsync($"{basis}/tagesablauf/fallvorschlaege", new { datum });
        var vorschlaege = Liste(v["vorschlaege"]);
        Assert.NotEmpty(vorschlaege);
        Assert.All(vorschlaege, x => Assert.Contains(S(x["art"]), new[] { "lehrer", "entfall" }));
        Assert.Equal(vorher, Faelle(await c.GetJsonAsync($"{basis}/tagesablauf/faelle?datum={datum}")).Count(x => S(x["zustand"]) != "erledigt"));
        // übernehmen (eine Rückgängig-Stufe) löst die Fälle der Vorschläge
        await c.PostJsonAsync($"{basis}/tagesablauf/anwenden", new
        {
            eintraege = vorschlaege.SelectMany(x => Ids(x["ids"]).Select(id => new { id, lehrer = x["lehrerId"]?.GetValue<int?>(), entfall = S(x["art"]) == "entfall" })).ToArray(),
        });
        var geloest = Faelle(await c.GetJsonAsync($"{basis}/tagesablauf/faelle?datum={datum}"));
        Assert.All(vorschlaege, x => Assert.Equal("erledigt", S(geloest.Single(y => S(y["schluessel"]) == S(x["schluessel"]))["zustand"])));
        Assert.StartsWith("Vorschläge übernommen", S((await c.GetJsonAsync(dok))["rueckgaengigText"]));
        await c.PostJsonAsync($"{dok}/rueckgaengig");

        // Verlegen: eine andere Stunde der Klasse in die Lücke vorziehen
        JsonNode? fall = null, vz = null;
        foreach (var x in offen)
        {
            var l = Liste(await c.GetJsonAsync($"{basis}/tagesablauf/fallverlegungen?id={Ids(x["offeneIds"])[0]}"));
            vz = l.FirstOrDefault(y => S(y["datum"]) == datum);
            if (vz is not null) { fall = x; break; }
        }
        Assert.NotNull(fall);
        var id = Ids(fall!["offeneIds"])[0];
        var luecke = Liste(fall["teile"]).Single(t => t["id"]!.GetValue<int>() == id)["stunde"]!.GetValue<int>();
        var von = vz!["stunde"]!.GetValue<int>();
        await c.PostJsonAsync($"{basis}/vorschlag/{id}/vorziehen", new { datum, stunde = von, unterricht = vz["u"]?.GetValue<int?>(), alle = true });
        var danach = Faelle(await c.GetJsonAsync($"{basis}/tagesablauf/faelle?datum={datum}")).Single(x => S(x["schluessel"]) == S(fall["schluessel"]));
        Assert.Contains("vorgezogen", S(danach["ergebnis"]));
        // Tagesübersicht der Klasse: Ziel „von 5.“, Herkunft „verlegt auf 2.“ – an ihren Stunden, nichts sonst verschoben
        var m = await c.GetJsonAsync($"{basis}/tagesablauf/matrix?datum={datum}");
        var zeile = Liste(m["zeilen"]).Single(z => z["id"]!.GetValue<int>() == Ids(fall["klassenIds"])[0]);
        JsonNode? Zelle(int s) => Liste(zeile["zellen"]).SingleOrDefault(z => z["s"]!.GetValue<int>() == s);
        Assert.Contains(Liste(Zelle(luecke)!["e"]), e => S(e["vv"]) == $"{von}.");
        Assert.Contains(Liste(Zelle(von)!["e"]), e => S(e["vn"]) == $"{luecke}." && S(e["s"]) == "e");
    }

    private async Task<(HttpClient C, string Dok, string Basis, string Datum)> GrossschuleAsync()
    {
        var c = await _f.AngemeldetAsync();
        var r = await c.HochladenAsync("/api/dokumente/hochladen", Grossschule.AlsUp(), "Gesamtschule Großstadt.up");
        var id = (await r.JsonAsync())["dokument"]!["id"]!.GetValue<string>();
        return await SchuleAsync(c, id);
    }

    /// <summary>Lehrkräfte einer Kopplung, die am Tag gleichzeitig unterrichten (Teilungsgruppen in einer Klasse bzw. Religion über zwei Klassen).</summary>
    private static async Task<(List<string> Lehrer, int Klasse)> KopplungAsync(HttpClient c, string basis, string datum, bool ueberKlassen)
    {
        var m = await c.GetJsonAsync($"{basis}/tagesablauf/matrix?datum={datum}&art=klasse");
        foreach (var z in Liste(m["zeilen"]))
            foreach (var zelle in Liste(z["zellen"]))
            {
                var e = Liste(zelle["e"]).Where(x => S(x["s"]) == "n" && x["u"] is not null).ToList();
                foreach (var gr in e.GroupBy(x => x["u"]!.GetValue<int>()))
                {
                    var lehrer = gr.Select(x => S(x["l"])).Where(x => x.Length > 0).Distinct().ToList();
                    var klassen = S(gr.First()["k"]).Split(',').Length;
                    if (lehrer.Count >= 2 && (klassen > 1) == ueberKlassen) return (lehrer.Take(2).ToList(), z["id"]!.GetValue<int>());
                }
            }
        throw new Xunit.Sdk.XunitException("Keine Kopplung am Planungstag");
    }

    [Fact]
    public async Task ParalleleGruppenSindEinFallUndWerdenGemeinsamGeloest()
    {
        var (c, dok, basis, datum) = await GrossschuleAsync();
        var (lehrer, klasse) = await KopplungAsync(c, basis, datum, false);
        await c.PostJsonAsync($"{basis}/absenzen/speichern", new { art = "lehrer", neu = lehrer.Select(k => new { id = 0, element = k, von = datum }).ToArray() });
        var f = await c.GetJsonAsync($"{basis}/tagesablauf/faelle?datum={datum}");
        var fall = Faelle(f).First(x => x["parallel"] is JsonArray && Ids(x["klassenIds"]).Contains(klasse));
        var teile = Liste(fall["parallel"]);
        _aus.WriteLine($"{S(fall["klassen"])} {string.Join(",", Ids(fall["stunden"]))}. {S(fall["fach"])} – {S(fall["lehrer"])} fehlen");
        Assert.Equal(2, teile.Count);
        Assert.Contains(" + ", S(fall["fach"]));
        Assert.Contains("(Gr. 1)", S(fall["fach"]));
        Assert.Equal("offen", S(fall["zustand"]));
        Assert.Equal(Ids(fall["offeneIds"]).OrderBy(x => x), teile.SelectMany(t => Ids(t["offeneIds"])).OrderBy(x => x));
        // kein Teil steht zusätzlich als eigener Fall da
        Assert.DoesNotContain(Faelle(f), x => teile.Any(t => S(t["schluessel"]) == S(x["schluessel"])));

        // eine Lehrkraft für beide Gruppen: in allen Stunden frei, nicht eine der fehlenden
        var k = await c.GetJsonAsync($"{basis}/tagesablauf/fallkandidaten?ids={string.Join(",", Ids(fall["offeneIds"]))}&anzahl=5");
        Assert.True(k["gleicheZeit"]!.GetValue<bool>());
        Assert.Equal(2, k["gruppen"]!.GetValue<int>());
        var kandidaten = Liste(k["kandidaten"]);
        Assert.NotEmpty(kandidaten);
        var frei = await c.GetJsonAsync($"{basis}/tagesablauf/frei?datum={datum}");
        var spalten = Liste(frei["stunden"]).Select(s => s["nr"]!.GetValue<int>()).ToList();
        foreach (var x in kandidaten)
        {
            Assert.DoesNotContain(S(x["k"]), lehrer);
            var zeile = Liste(frei["lehrer"]).Single(l => l["id"]!.GetValue<int>() == x["lehrer"]!.GetValue<int>());
            foreach (var s in Ids(fall["stunden"])) Assert.Contains(S(zeile["zellen"]![spalten.IndexOf(s)]![0]), new[] { "", "B", "X", "H" });
        }
        var wer = kandidaten[0]["lehrer"]!.GetValue<int>();
        await c.PostJsonAsync($"{basis}/tagesablauf/fallloesen", new
        {
            teile = new object[] { new { ids = Ids(teile[0]["offeneIds"]), art = "lehrer", lehrer = wer }, new { ids = Ids(teile[1]["offeneIds"]), art = "mit", lehrer = wer } },
            text = "Gruppen zusammengelegt",
        });
        var nach = Faelle(await c.GetJsonAsync($"{basis}/tagesablauf/faelle?datum={datum}")).Single(x => S(x["schluessel"]) == S(fall["schluessel"]));
        Assert.Equal("erledigt", S(nach["zustand"]));
        Assert.Contains("zusammengelegt", S(Liste(nach["parallel"])[1]["ergebnis"]));
        Assert.Equal("Gruppen zusammengelegt", S((await c.GetJsonAsync(dok))["rueckgaengigText"]));
        // die Bilanz kennt keine Kollision der Lehrkraft (die zweite Gruppe betreut sie mit)
        Assert.DoesNotContain(S(kandidaten[0]["k"]), Liste((await c.GetJsonAsync($"{basis}/tagesablauf/bilanz?datum={datum}"))["kollisionen"]!["lehrer"]).Select(S));
        await c.PostJsonAsync($"{dok}/rueckgaengig");

        // je Gruppe anders: Gr. 1 eine Lehrkraft, Gr. 2 Entfall – eine Rückgängig-Stufe
        var k1 = await c.GetJsonAsync($"{basis}/tagesablauf/fallkandidaten?ids={string.Join(",", Ids(teile[0]["offeneIds"]))}&anzahl=5");
        Assert.False(k1["gleicheZeit"]!.GetValue<bool>());
        var w1 = Liste(k1["kandidaten"])[0]["lehrer"]!.GetValue<int>();
        await c.PostJsonAsync($"{basis}/tagesablauf/fallloesen", new
        {
            teile = new object[] { new { ids = Ids(teile[0]["offeneIds"]), art = "lehrer", lehrer = w1 }, new { ids = Ids(teile[1]["offeneIds"]), art = "entfall", lehrer = (int?)null } },
        });
        nach = Faelle(await c.GetJsonAsync($"{basis}/tagesablauf/faelle?datum={datum}")).Single(x => S(x["schluessel"]) == S(fall["schluessel"]));
        Assert.Equal("erledigt", S(nach["zustand"]));
        Assert.Equal("Entfall", S(Liste(nach["parallel"])[1]["ergebnis"]));
        Assert.Contains("Entfall", S(nach["ergebnis"]));
        var st = (await c.GetJsonAsync($"{basis}/tagesablauf/faelle?datum={datum}"))["statistik"]!;
        Assert.True(st["ausfall"]!.GetValue<int>() >= Ids(teile[1]["offeneIds"]).Count);
        // eine fehlende Lehrkraft darf nicht vertreten
        await c.PostJsonAsync($"{dok}/rueckgaengig");
        var fehlt = Liste((await c.GetJsonAsync($"{dok}/elemente?typen=lehrer"))["lehrer"]).First(l => S(l["k"]) == lehrer[0])["id"]!.GetValue<int>();
        await c.PostJsonAsync($"{basis}/tagesablauf/fallloesen", new { teile = new[] { new { ids = Ids(teile[1]["offeneIds"]), art = "lehrer", lehrer = fehlt } } }, System.Net.HttpStatusCode.BadRequest);

        // Vorschläge für alle: der parallele Fall bekommt eine Lehrkraft für beide Gruppen (erste vertritt, zweite betreut mit)
        var v = Liste((await c.PostJsonAsync($"{basis}/tagesablauf/fallvorschlaege", new { datum }))["vorschlaege"]).SingleOrDefault(x => S(x["schluessel"]) == S(fall["schluessel"]));
        if (v is not null && S(v["art"]) == "lehrer")
            Assert.Equal(new[] { "lehrer", "mit" }, Liste(v["teile"]).Select(t => S(t["art"])));
    }

    [Fact]
    public async Task GekoppelterUnterrichtMehrererKlassenStehtInJederKlasse()
    {
        var (c, _, basis, datum) = await GrossschuleAsync();
        var (lehrer, klasse) = await KopplungAsync(c, basis, datum, true);
        await c.PostJsonAsync($"{basis}/absenzen/speichern", new { art = "lehrer", neu = lehrer.Select(k => new { id = 0, element = k, von = datum }).ToArray() });
        var f = await c.GetJsonAsync($"{basis}/tagesablauf/faelle?datum={datum}");
        var fall = Faelle(f).First(x => x["parallel"] is JsonArray && Ids(x["klassenIds"]).Contains(klasse));
        Assert.Equal(2, Ids(fall["klassenIds"]).Count);
        Assert.All(Ids(fall["klassenIds"]), k => Assert.Contains(Liste(f["klassen"]), x => x["id"]!.GetValue<int>() == k));
        var k = await c.GetJsonAsync($"{basis}/tagesablauf/fallkandidaten?ids={string.Join(",", Ids(fall["offeneIds"]))}");
        var wer = Liste(k["kandidaten"])[0]["lehrer"]!.GetValue<int>();
        var teile = Liste(fall["parallel"]);
        await c.PostJsonAsync($"{basis}/tagesablauf/fallloesen", new
        {
            teile = teile.Select((t, i) => (object)new { ids = Ids(t["offeneIds"]), art = i == 0 ? "lehrer" : "mit", lehrer = wer }).ToArray(),
        });
        var nach = Faelle(await c.GetJsonAsync($"{basis}/tagesablauf/faelle?datum={datum}")).Single(x => S(x["schluessel"]) == S(fall["schluessel"]));
        Assert.Equal("erledigt", S(nach["zustand"]));
    }

    [Fact]
    public async Task ZiehenZeigtZieleMitGrundUndFuelltDieLuecke()
    {
        var c = await _f.AngemeldetAsync();
        var (_, dok, basis, datum) = await SchuleAsync(c, (await c.PostJsonAsync("/api/dokumente/beispiel"))["id"]!.GetValue<string>());
        var lehrer = Liste((await c.GetJsonAsync($"{dok}/elemente?typen=lehrer"))["lehrer"]);
        // eine Lehrkraft fehlt; gesucht: eine offene Stunde, in die sich eine andere Stunde der Klasse vorziehen lässt
        JsonNode? fall = null, vz = null;
        foreach (var l in lehrer)
        {
            var erg = await c.PostJsonAsync($"{basis}/absenzen/speichern", new { art = "lehrer", neu = new[] { new { id = 0, element = S(l["k"]), von = datum } } });
            foreach (var x in Faelle(await c.GetJsonAsync($"{basis}/tagesablauf/faelle?datum={datum}")).Where(x => S(x["zustand"]) == "offen" && x["parallel"] is null && !x["pause"]!.GetValue<bool>()))
            {
                vz = Liste(await c.GetJsonAsync($"{basis}/tagesablauf/fallverlegungen?id={Ids(x["offeneIds"])[0]}")).FirstOrDefault(y => S(y["datum"]) == datum);
                if (vz is not null) { fall = x; break; }
            }
            if (fall is not null) break;
            await c.PostJsonAsync($"{basis}/absenzen/loeschen", new { ids = Ids(erg["gespeichert"]) });
        }
        Assert.NotNull(fall);
        var gap = Ids(fall!["offeneIds"])[0];
        var luecke = Liste(fall["teile"]).Single(t => t["id"]!.GetValue<int>() == gap)["stunde"]!.GetValue<int>();
        var von = vz!["stunde"]!.GetValue<int>();
        var u = vz["u"]!.GetValue<int>();

        // Ziele beim Ziehen: jede Stunde des Tages mit Stand und Grund, die Lücke „füllt die Lücke“ als Vorziehung
        var z = await c.GetJsonAsync($"{basis}/tagesablauf/fallziele?datum={datum}&stunde={von}&unterricht={u}&laenge=1");
        var ziele = Liste(z["ziele"]);
        Assert.Equal(Liste((await c.GetJsonAsync($"{basis}/tagesablauf/faelle?datum={datum}"))["stunden"]).Count, ziele.Count);
        Assert.Equal("quelle", S(ziele.Single(x => x["s"]!.GetValue<int>() == von)["status"]));
        var ziel = ziele.Single(x => x["s"]!.GetValue<int>() == luecke);
        Assert.Equal("luecke", S(ziel["status"]));
        Assert.Equal(gap, ziel["luecke"]!.GetValue<int>());
        Assert.Contains("fehlt", S(ziel["grund"]));
        Assert.NotEmpty(Liste(z["lehrer"]));
        Assert.All(ziele.Where(x => S(x["status"]) == "kollision" && S(x["grund"]).Length > 0), x => Assert.Matches("unterrichtet|hat|vertritt|passt", S(x["grund"])));

        // Ablegen in der Lücke = Vorziehen (wie der Knopf), rückgängig in einer Stufe
        await c.PostJsonAsync($"{basis}/vorschlag/{gap}/vorziehen", new { datum, stunde = von, unterricht = u, alle = true });
        Assert.Contains("vorgezogen", S(Faelle(await c.GetJsonAsync($"{basis}/tagesablauf/faelle?datum={datum}")).Single(x => S(x["schluessel"]) == S(fall["schluessel"]))["ergebnis"]));
        await c.PostJsonAsync($"{dok}/rueckgaengig");

        // Ablegen auf einer freien Stunde (Verlegen wie im Plan): die Stunde steht dort mit „von …“
        var frei = ziele.FirstOrDefault(x => S(x["status"]) == "frei");
        if (frei is not null)
        {
            var s = frei["s"]!.GetValue<int>();
            await c.PostJsonAsync($"{basis}/plan/verlegen", new { von = datum, vonStunde = von, unterricht = u, laenge = 1, ziel = datum, zielStunde = s });
            var m = await c.GetJsonAsync($"{basis}/tagesablauf/matrix?datum={datum}");
            var zeile = Liste(m["zeilen"]).Single(r => r["id"]!.GetValue<int>() == Ids(fall["klassenIds"])[0]);
            Assert.Contains(Liste(zeile["zellen"]).Single(x => x["s"]!.GetValue<int>() == s)["e"]!.AsArray(), e => S(e!["vv"]) == $"{von}.");
        }
    }

    /// <summary>
    /// Last: 300 Lehrkräfte, 60 Klassen, 15 Lehrkräfte abwesend (die mit den meisten Stunden am Tag, drei erst ab der 3. Stunde).
    /// Mit STUDIO_GROSSSCHULE=Pfad wird die Schuldatei (ohne Abwesenheiten) für Oberflächentests und Bildschirmfotos dort abgelegt.
    /// </summary>
    [Fact]
    public async Task GrosseSchuleMitFuenfzehnAbwesenheiten()
    {
        var up = Grossschule.AlsUp();
        if (Environment.GetEnvironmentVariable("STUDIO_GROSSSCHULE") is { Length: > 0 } pfad) await File.WriteAllBytesAsync(pfad, up);
        var c = await _f.AngemeldetAsync();
        var r = await c.HochladenAsync("/api/dokumente/hochladen", up, "Gesamtschule Großstadt.up");
        var id = (await r.JsonAsync())["dokument"]!["id"]!.GetValue<string>();
        var (_, dok, basis, datum) = await SchuleAsync(c, id);
        var lehrer = Liste((await c.GetJsonAsync($"{dok}/elemente?typen=lehrer"))["lehrer"]);
        Assert.Equal(300, lehrer.Count);
        var m0 = await c.GetJsonAsync($"{basis}/tagesablauf/matrix?datum={datum}&art=lehrer");
        var meiste = Liste(m0["zeilen"]).OrderByDescending(z => z["zellen"]!.AsArray().Count).ThenBy(z => S(z["k"])).Take(15).Select(z => S(z["k"])).ToList();
        await c.PostJsonAsync($"{basis}/absenzen/speichern", new
        {
            art = "lehrer", neu = meiste.Select((k, i) => new { id = 0, element = k, von = datum, sv = i >= 12 ? 3 : 1, sb = 99, grund = "K" }).ToArray(),
        });

        var sw = Stopwatch.StartNew();
        var f = await c.GetJsonAsync($"{basis}/tagesablauf/faelle?datum={datum}");
        var tFaelle = sw.ElapsedMilliseconds;
        var faelle = Faelle(f);
        var stunden = faelle.Sum(x => x["offeneIds"]!.AsArray().Count);
        _aus.WriteLine($"{faelle.Count} Fälle ({stunden} Stunden) in {Liste(f["klassen"]).Count} Klassen, {Liste(f["abwesend"]).Count} abwesend – {tFaelle} ms");
        Assert.Equal(15, Liste(f["abwesend"]).Count);
        Assert.True(stunden >= 50, $"nur {stunden} offene Stunden");
        Assert.True(faelle.Count < stunden, "Doppelstunden sind keine Blöcke");

        sw.Restart();
        var blockFall = faelle.First(x => x["offeneIds"]!.AsArray().Count > 1);
        var k = await c.GetJsonAsync($"{basis}/tagesablauf/fallkandidaten?ids={string.Join(",", Ids(blockFall["offeneIds"]))}&anzahl=5");
        var tKand = sw.ElapsedMilliseconds;
        Assert.Equal(5, Liste(k["kandidaten"]).Count);

        sw.Restart();
        await c.GetJsonAsync($"{basis}/tagesablauf/matrix?datum={datum}&art=klasse");
        var tMatrix = sw.ElapsedMilliseconds;

        sw.Restart();
        var v = await c.PostJsonAsync($"{basis}/tagesablauf/fallvorschlaege", new { datum });
        var tVorschlaege = sw.ElapsedMilliseconds;
        _aus.WriteLine($"Kandidaten Block {tKand} ms, Tagesübersicht {tMatrix} ms, Vorschläge für alle {tVorschlaege} ms ({Liste(v["vorschlaege"]).Count} Vorschläge)");
        Assert.True(Liste(v["vorschlaege"]).Count >= faelle.Count * 3 / 4);
        Assert.True(tFaelle < 3000 && tKand < 4000 && tMatrix < 4000, "Tagesplanung zu langsam");
        Assert.True(tVorschlaege < 60000, "Vorschläge für alle zu langsam");
    }
}
