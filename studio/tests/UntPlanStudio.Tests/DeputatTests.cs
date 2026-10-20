using System.Net;
using System.Net.Http.Json;
using UntPlan.Core;
using Xunit;

namespace UntPlanStudio.Tests;

/// <summary>API „Deputat und Unterrichtsverteilung“: Übersicht, Felder, Posten, Einstellungen, Verteilung, Zuweisen, Ausgabe.</summary>
public sealed class DeputatApiTests : IClassFixture<StudioFabrik>
{
    private readonly StudioFabrik _f;
    public DeputatApiTests(StudioFabrik f) => _f = f;

    [Fact]
    public async Task DeputatRechnenVerteilenUndAusgeben()
    {
        var c = await _f.AngemeldetAsync();
        var schule = Demo.Beispielschule();
        var id = await c.BeispielHochladenAsync(schule);
        var basis = $"/api/dokumente/{id}/deputat";

        var u = await c.GetJsonAsync(basis);
        Assert.Equal("NW", u["profil"]!["kuerzel"]!.GetValue<string>());
        Assert.Equal(25.5m, u["pflichtstunden"]!.GetValue<decimal>());
        Assert.Equal(schule.Lehrer.Count, u["lehrer"]!.AsArray().Count);
        var lid = u["lehrer"]!.AsArray().First(x => x!["eintraege"]!.AsArray().Count == 0)!["id"]!.GetValue<int>();

        // Umfang in Prozent, Geburtsdatum (60+), GdB
        var n = await c.PatchJsonAsync($"{basis}/lehrer/{lid}", new { feld = "umfang", wert = "Vollzeit" });
        n = await c.PatchJsonAsync($"{basis}/lehrer/{lid}", new { feld = "geburtsdatum", wert = "01.02.1960" });
        n = await c.PatchJsonAsync($"{basis}/lehrer/{lid}", new { feld = "gdb", wert = "70" });
        var l = n["lehrer"]!.AsArray().First(x => x!["id"]!.GetValue<int>() == lid)!;
        Assert.Equal(3m, l["altersermaessigung"]!.GetValue<decimal>());
        Assert.Equal(3m, l["schwerbehinderung"]!.GetValue<decimal>());
        n = await c.PatchJsonAsync($"{basis}/lehrer/{lid}", new { feld = "umfang", wert = "50 %" });
        l = n["lehrer"]!.AsArray().First(x => x!["id"]!.GetValue<int>() == lid)!;
        Assert.Equal(12.75m, l["umfang"]!.GetValue<decimal>());
        Assert.Equal(1.5m, l["altersermaessigung"]!.GetValue<decimal>());
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PatchAsJsonAsync($"{basis}/lehrer/{lid}", new { feld = "gdb", wert = "120" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PatchAsJsonAsync($"{basis}/lehrer/{lid}", new { feld = "geburtsdatum", wert = "gestern" })).StatusCode);

        // Posten und Einstellungen
        n = await (await c.PutAsJsonAsync($"{basis}/lehrer/{lid}/posten", new[] { new { art = "Anrechnung", grund = "Koordination", wert = 2m, text = "" } })).JsonAsync();
        Assert.Equal(2m, n["summen"]!["anrechnungVerwendet"]!.GetValue<decimal>());
        n = await (await c.PutAsJsonAsync($"{basis}/einstellungen", new { grundstellen = 28.5m })).JsonAsync();
        Assert.Equal(14m, n["summen"]!["anrechnungVerfuegbar"]!.GetValue<decimal>());
        Assert.False(n["summen"]!["grundstellenGeschaetzt"]!.GetValue<bool>());

        // Verteilung: Zelle entfernen → offen → zuweisen
        var v = await c.GetJsonAsync($"{basis}/verteilung");
        Assert.Empty(v["offen"]!.AsArray());
        var z = v["zeilen"]!.AsArray().First(x => x!["werte"]!.AsArray().Any(w => w!.GetValue<decimal>() > 0))!;
        var sp = v["spalten"]!.AsArray()[z["werte"]!.AsArray().Select((w, i) => (w, i)).First(x => x.w!.GetValue<decimal>() > 0).i]!["id"]!.GetValue<int>();
        var zellen = await c.GetJsonAsync($"{basis}/zelle?lehrer={z["id"]}&spalte={sp}");
        var eins = zellen.AsArray()[0]!;
        await c.PostJsonAsync($"{basis}/zuweisen", new { unterricht = eins["unterricht"]!.GetValue<int>(), zeile = eins["zeile"]!.GetValue<int>(), lehrer = (int?)null });
        v = await c.GetJsonAsync($"{basis}/verteilung");
        Assert.Single(v["offen"]!.AsArray());
        var vorschlag = await c.GetJsonAsync($"{basis}/vorschlag?unterricht={eins["unterricht"]}&zeile={eins["zeile"]}");
        Assert.True(vorschlag.AsArray()[0]!["fakultas"]!.GetValue<bool>());
        await c.PostJsonAsync($"{basis}/zuweisen", new { unterricht = eins["unterricht"]!.GetValue<int>(), zeile = eins["zeile"]!.GetValue<int>(), lehrer = vorschlag.AsArray()[0]!["id"]!.GetValue<int>() });
        Assert.Empty((await c.GetJsonAsync($"{basis}/verteilung?nach=fach"))["offen"]!.AsArray());

        // Stundentafel, Ausgabe
        var t = await c.GetJsonAsync($"{basis}/tafel");
        Assert.Contains("Anlage 3a", t["kontingentGrundlage"]!.GetValue<string>());
        Assert.StartsWith("\"Klasse\";\"Jahrgang\"", await c.GetStringAsync($"{basis}/export.csv?art=uvd"));
        Assert.Contains("Pflichtstunden", await c.GetStringAsync($"{basis}/export.csv"));
        var pdf = await c.GetByteArrayAsync($"{basis}/bericht.pdf");
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(pdf, 0, 4));
    }
}
