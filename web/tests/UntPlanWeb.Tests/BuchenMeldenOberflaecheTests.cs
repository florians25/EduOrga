using System.Net.Http.Json;
using System.Text.Json.Nodes;
using UntPlanWeb.Dienste;

namespace UntPlanWeb.Tests;

/// <summary>
/// Sprint 27: Raumwahl als eine Komponente (Portal-Liste am Feld mit Kollisionserkennung, eingebettete Liste mit Filtern Gebäude,
/// Abteilung, Kapazität, nur freie), Prüfung editieren mit Löschen, Melden (Kacheln, einheitliche Formulare,
/// Meine Meldungen mit Status-Pills und Filtern) und das überarbeitete Buchungsmodul (drei Schritte, Schnellbuchung, Storno-Dialog).
/// </summary>
public class BuchenMeldenOberflaecheTests
{

    // ------------------------------------------------------------------ API

    [Fact]
    public async Task Raumstatus_liefert_Gebaeude_und_Abteilung_fuer_die_Filter()
    {
        await using var s = await Testserver.StartenAsync();
        var lan = await s.AlsAsync("lan", "lehrer", "LAN");
        var liste = (await Testserver.HolenAsync(lan, "/api/app/buchen/raumstatus?datum=2026-10-15&von=3&bis=4")).AsArray();
        Assert.NotEmpty(liste);
        Assert.All(liste, r =>
        {
            Assert.NotNull(r!["gebaeude"]);
            Assert.NotNull(r["abteilung"]);
            Assert.NotNull(r["kapazitaet"]);
        });
    }

    [Fact]
    public async Task Buchungsoptionen_nennen_den_naechsten_Unterrichtstag()
    {
        await using var s = await Testserver.StartenAsync();
        var lan = await s.AlsAsync("lan", "lehrer", "LAN");
        // Mittwoch der Beispielwoche: heute
        Assert.Equal("2026-10-14", (await Testserver.HolenAsync(lan, "/api/app/buchen/optionen"))["naechsterTag"]!.GetValue<string>());
        // Samstag: der nächste Tag mit Unterricht (nicht Wochenende, nicht unterrichtsfrei)
        s.Dienst<Uhr>().Fest = new DateTime(2026, 10, 17, 9, 0, 0);
        var tag = DateOnly.Parse((await Testserver.HolenAsync(lan, "/api/app/buchen/optionen"))["naechsterTag"]!.GetValue<string>());
        Assert.True(tag > new DateOnly(2026, 10, 17));
        Assert.NotEqual(DayOfWeek.Saturday, tag.DayOfWeek);
        Assert.NotEqual(DayOfWeek.Sunday, tag.DayOfWeek);
    }

    [Fact]
    public async Task Pruefung_editieren_aendert_Titel_und_Loeschen_zieht_zurueck()
    {
        await using var s = await Testserver.StartenAsync();
        var c = await s.AlsAsync("mue", "lehrer", "MUE");
        var frei = (await Testserver.HolenAsync(c, "/api/app/meldungen/freieraeume?datum=2026-10-16&von=3&bis=4")).AsArray()[0]!["kurz"]!.GetValue<string>();
        var alt = new { datum = "2026-10-16", stundeVon = 3, stundeBis = 4, klassen = new[] { "EF" }, titel = "Deutsch GK" };
        await Testserver.JsonAsync(await c.PostAsJsonAsync("/api/app/meldungen/klausur", new { alt.datum, alt.stundeVon, alt.stundeBis, alt.klassen, raeume = new[] { frei }, aufsicht = new[] { "MUE" }, alt.titel }));
        // Editieren (gleiche Zeit, neuer Name, andere Stunde): alte Prüfung weg, neue mit neuem Titel
        await Testserver.JsonAsync(await c.PostAsJsonAsync("/api/app/meldungen/klausur/verlegen", new
        {
            alt, neu = new { datum = "2026-10-16", stundeVon = 3, stundeBis = 3, klassen = new[] { "EF" }, raeume = new[] { frei }, aufsicht = new[] { "MUE" }, titel = "Deutsch GK Klausur 1", text = "" },
        }));
        var offen = (await Testserver.HolenAsync(s.SyncClient(), $"/api/v1/schulen/{Testserver.SchulId}/rueckmeldungen")).AsArray();
        var k = Assert.Single(offen, x => x!["typ"]!.GetValue<string>() == "klausur")!;
        Assert.Equal("Deutsch GK Klausur 1", k["titel"]!.GetValue<string>());
        // Löschen aus dem Editier-Dialog nutzt dieselbe Löschlogik
        await Testserver.JsonAsync(await c.PostAsJsonAsync("/api/app/meldungen/klausur/loeschen", new { datum = "2026-10-16", stundeVon = 3, stundeBis = 3, klassen = new[] { "EF" }, titel = "Deutsch GK Klausur 1" }));
        offen = (await Testserver.HolenAsync(s.SyncClient(), $"/api/v1/schulen/{Testserver.SchulId}/rueckmeldungen")).AsArray();
        Assert.DoesNotContain(offen, x => x!["typ"]!.GetValue<string>().StartsWith("klausur"));
    }

    // ------------------------------------------------------------------ Raumwahl-Komponente

    // ------------------------------------------------------------------ Melden

    // ------------------------------------------------------------------ Buchen

}
