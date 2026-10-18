using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using UntPlan.Core;
using UntPlan.Core.Austausch;
using UntPlan.Core.Model;

namespace UntPlanStudio.Tests;

/// <summary>
/// „Findet online statt“ in UntPlan Studio: regelmäßig je Unterricht (/unterricht/{uid}/online, Spalten Online/OnlineLink) und
/// abweichend je Stunde am Datum (/vertretung/online), mit Rückgängig, Speichern in der Schuldatei und Export an UntPlanWeb.
/// </summary>
public sealed class OnlineUnterrichtTests : IClassFixture<StudioFabrik>
{
    private readonly StudioFabrik _f;

    public OnlineUnterrichtTests(StudioFabrik f) => _f = f;

    private static string S(JsonNode? n) => n?.GetValue<string>() ?? "";

    private static async Task<JsonNode> PutJsonAsync(HttpClient c, string pfad, object daten, HttpStatusCode erwartet = HttpStatusCode.OK) =>
        await (await c.PutAsJsonAsync(pfad, daten)).JsonAsync(erwartet);

    /// <summary>Beispielschule, Starttag der Vertretungsplanung und ein Eintrag im tagesaktuellen Plan (Unterricht, Stunde).</summary>
    private async Task<(HttpClient C, string Dok, string Datum, int Unterricht, int Stunde, int Block)> VorbereitenAsync()
    {
        var c = await _f.AngemeldetAsync();
        var id = (await c.PostJsonAsync("/api/dokumente/beispiel"))["id"]!.GetValue<string>();
        var dok = $"/api/dokumente/{id}";
        var datum = S((await c.GetJsonAsync($"{dok}/vertretung/start"))["datum"]);
        var klassen = (await c.GetJsonAsync($"{dok}/elemente?typen=klasse"))["klasse"]!.AsArray();
        foreach (var k in klassen)
        {
            var plan = await c.GetJsonAsync($"{dok}/vertretung/plan/klasse/{k!["id"]!.GetValue<int>()}?datum={datum}");
            foreach (var z in plan["zellen"]!.AsArray().Where(z => S(z!["datum"]) == datum))
                foreach (var e in z!["eintraege"]!.AsArray())
                    if (e!["u"] is JsonValue && S(e["status"]) == "Regulaer")
                        return (c, dok, datum, e["u"]!.GetValue<int>(), z["stunde"]!.GetValue<int>(), e["block"]!.GetValue<int>());
        }
        throw new InvalidOperationException("Kein Unterricht am Starttag gefunden.");
    }

    [Fact]
    public async Task Unterricht_regelmaessig_online_mit_Link_und_Rueckgaengig()
    {
        var (c, dok, datum, uid, stunde, _) = await VorbereitenAsync();

        Assert.False((await c.GetJsonAsync($"{dok}/unterricht/{uid}/online"))["online"]!.GetValue<bool>());
        // ungültiger Link: 400, nichts geändert
        await PutJsonAsync(c, $"{dok}/unterricht/{uid}/online", new { online = true, onlineLink = "javascript:alert(1)" }, HttpStatusCode.BadRequest);
        Assert.False((await c.GetJsonAsync($"{dok}/unterricht/{uid}/online"))["online"]!.GetValue<bool>());

        var r = await PutJsonAsync(c, $"{dok}/unterricht/{uid}/online", new { online = true, onlineLink = "https://meet.example.org/regel" });
        Assert.True(r["online"]!.GetValue<bool>());
        Assert.Equal("https://meet.example.org/regel", S(r["onlineLink"]));
        Assert.Contains((await c.GetJsonAsync($"{dok}/unterricht/online")).AsArray(), x => x!["unterricht"]!.GetValue<int>() == uid);

        // Stundenplan des Tages zeigt online
        var st = await c.GetJsonAsync($"{dok}/vertretung/online/stunde?datum={datum}&stunde={stunde}&unterricht={uid}");
        Assert.True(st["online"]!.GetValue<bool>());
        Assert.False(st["abweichend"]!.GetValue<bool>());
        Assert.True(st["regel"]!["online"]!.GetValue<bool>());

        // Spalten der Unterrichtstabelle (Online, OnlineLink) – Link ohne online bleibt erhalten
        var spalten = (await c.GetJsonAsync($"{dok}/unterricht/spalten")).AsArray().Select(s => S(s!["schluessel"])).ToList();
        Assert.Contains("Online", spalten);
        Assert.Contains("OnlineLink", spalten);
        await c.PatchJsonAsync($"{dok}/unterricht/{uid}", new { feld = "Online", wert = "" });
        var o = await c.GetJsonAsync($"{dok}/unterricht/{uid}/online");
        Assert.False(o["online"]!.GetValue<bool>());
        Assert.Equal("https://meet.example.org/regel", S(o["onlineLink"]));
        await c.PatchJsonAsync($"{dok}/unterricht/{uid}", new { feld = "OnlineLink", wert = "ftp://x" }, HttpStatusCode.BadRequest);

        // Rückgängig: wieder online
        await c.PostJsonAsync($"{dok}/rueckgaengig");
        Assert.True((await c.GetJsonAsync($"{dok}/unterricht/{uid}/online"))["online"]!.GetValue<bool>());
        await c.PostJsonAsync($"{dok}/wiederholen");
        Assert.False((await c.GetJsonAsync($"{dok}/unterricht/{uid}/online"))["online"]!.GetValue<bool>());
    }

    [Fact]
    public async Task Einzelne_Stunde_online_im_Plan_und_im_Paket_fuer_UntPlanWeb()
    {
        var (c, dok, datum, uid, stunde, block) = await VorbereitenAsync();
        var vt = $"{dok}/vertretung";

        // Stunde (mit Block) findet an diesem Datum online statt
        var r = await PutJsonAsync(c, $"{vt}/online", new { datum, stunde, unterricht = uid, online = true, onlineLink = "https://meet.example.org/heute", block = true });
        var stunden = r["stunden"]!.AsArray();
        Assert.Equal(block, stunden.Count);
        Assert.All(stunden, s => { Assert.True(s!["online"]!.GetValue<bool>()); Assert.True(s["abweichend"]!.GetValue<bool>()); });
        var liste = (await c.GetJsonAsync($"{vt}/online?von={datum}")).AsArray();
        Assert.Equal(block, liste.Count);
        Assert.Equal("https://meet.example.org/heute", S(liste[0]!["onlineLink"]));

        // ungültiger Link bzw. Stunde ohne Unterricht
        await PutJsonAsync(c, $"{vt}/online", new { datum, stunde, unterricht = uid, online = true, onlineLink = "ftp://x" }, HttpStatusCode.BadRequest);
        await PutJsonAsync(c, $"{vt}/online", new { datum, stunde = 99, unterricht = uid, online = true }, HttpStatusCode.NotFound);

        // Schuldatei und Paket für UntPlanWeb
        var inhalt = await (await c.GetAsync($"{dok}/herunterladen")).Content.ReadAsByteArrayAsync();
        var d = JsonSerializer.Deserialize<Schuldatei>(inhalt, Dokument.JsonOptionen)!;
        Assert.Equal(block, d.OnlineStunden.Count);
        var tag = DateOnly.Parse(datum);
        var paket = UntPlanWebExport.PaketErstellen(d, tag, new WebExportOptionen { TageVoraus = 1 });
        var ws = paket.Tage.Single(t => t.Datum == datum).Stunden.Where(s => s.Unterricht == uid && s.Stunde == stunde).ToList();
        Assert.NotEmpty(ws);
        Assert.All(ws, s => { Assert.True(s.Online); Assert.Equal("https://meet.example.org/heute", s.OnlineLink); });

        // Abweichung entfernen (online = null) – auch per Rückgängig wiederherstellbar
        r = await PutJsonAsync(c, $"{vt}/online", new { datum, stunde, unterricht = uid, online = (bool?)null, block = true });
        Assert.All(r["stunden"]!.AsArray(), s => Assert.False(s!["online"]!.GetValue<bool>()));
        Assert.Empty((await c.GetJsonAsync($"{vt}/online?von={datum}")).AsArray());
        await c.PostJsonAsync($"{dok}/rueckgaengig");
        Assert.Equal(block, (await c.GetJsonAsync($"{vt}/online?von={datum}")).AsArray().Count);
    }

    [Fact]
    public async Task Planeintrag_zeigt_online()
    {
        var (c, dok, datum, uid, stunde, _) = await VorbereitenAsync();
        await PutJsonAsync(c, $"{dok}/vertretung/online", new { datum, stunde, unterricht = uid, online = true });
        var klassen = (await c.GetJsonAsync($"{dok}/elemente?typen=klasse"))["klasse"]!.AsArray();
        var gefunden = false;
        foreach (var k in klassen)
        {
            var plan = await c.GetJsonAsync($"{dok}/vertretung/plan/klasse/{k!["id"]!.GetValue<int>()}?datum={datum}");
            foreach (var z in plan["zellen"]!.AsArray().Where(z => S(z!["datum"]) == datum && z["stunde"]!.GetValue<int>() == stunde))
                foreach (var e in z!["eintraege"]!.AsArray().Where(e => e!["u"]?.GetValue<int>() == uid))
                {
                    Assert.True(e!["online"]!.GetValue<bool>());
                    Assert.True(e["onlineAbweichend"]!.GetValue<bool>());
                    gefunden = true;
                }
            if (gefunden) break;
        }
        Assert.True(gefunden);
    }
}
