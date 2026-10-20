using UntPlanWeb.Dienste;

namespace UntPlanWeb.Tests;

/// <summary>
/// Ferien und freie Tage auf „Heute“ (/api/app/heute, Feld kalender): während der Schulzeit die nächsten Ferien und die nächsten
/// Feiertage, in den Ferien der laufende Zeitraum und der nächste Schultag (Beispielpaket: Herbstferien 17.–31.10.2026).
/// </summary>
public class HeuteKalenderTests
{
    [Fact]
    public async Task Schulzeit_nennt_naechste_Ferien_und_keinen_freien_Tag_heute()
    {
        await using var s = await Testserver.StartenAsync();
        var c = await s.AlsAsync("mue", "lehrer", "MUE");
        var h = await Testserver.HolenAsync(c, "/api/app/heute");
        var k = h["kalender"]!;
        Assert.Equal("2026-10-14", k["heute"]!.GetValue<string>());
        Assert.Null(k["frei"]);
        Assert.Equal("Herbstferien", k["naechsteFerien"]!["name"]!.GetValue<string>());
        Assert.Equal("2026-10-17", k["naechsteFerien"]!["von"]!.GetValue<string>());
        Assert.Equal("ferien", k["naechsteFerien"]!["art"]!.GetValue<string>());
        Assert.Equal("2026-10-14", k["naechsterSchultag"]!.GetValue<string>());
        Assert.Null(h["ferien"]);
    }

    [Fact]
    public async Task In_den_Ferien_steht_der_Zeitraum_und_der_naechste_Schultag()
    {
        await using var s = await Testserver.StartenAsync();
        s.Dienst<Uhr>().Fest = new DateTime(2026, 10, 20, 9, 0, 0);
        var c = await s.AlsAsync("mue", "lehrer", "MUE");
        var h = await Testserver.HolenAsync(c, "/api/app/heute");
        var k = h["kalender"]!;
        Assert.Equal("2026-10-20", k["heute"]!.GetValue<string>());
        Assert.Equal("Herbstferien", k["frei"]!["name"]!.GetValue<string>());
        Assert.Equal("ferien", k["frei"]!["art"]!.GetValue<string>());
        Assert.Equal("2026-10-31", k["frei"]!["bis"]!.GetValue<string>());
        // Allerheiligen ist Sonntag, der nächste Schultag Montag 2.11.
        Assert.Equal("2026-11-02", k["naechsterSchultag"]!.GetValue<string>());
        Assert.Equal("2026-11-02", h["datum"]!.GetValue<string>());
        // nächste Ferien nach den laufenden
        Assert.Equal("Weihnachtsferien", k["naechsteFerien"]!["name"]!.GetValue<string>());
        // kompatibles Feld für ältere App-Versionen
        Assert.Equal("Herbstferien", h["ferien"]!["titel"]!.GetValue<string>());
    }

    [Fact]
    public async Task Feiertag_an_einem_Schultag_zaehlt_als_freier_Tag_und_ist_heute_frei()
    {
        await using var s = await Testserver.StartenAsync();
        // 6.5.2027 (Christi Himmelfahrt, Donnerstag); Pfingstferien 18.5. ist nur ein Tag und zählt als freier Tag
        s.Dienst<Uhr>().Fest = new DateTime(2027, 5, 3, 9, 0, 0);
        var c = await s.AlsAsync("mue", "lehrer", "MUE");
        var k = (await Testserver.HolenAsync(c, "/api/app/heute"))["kalender"]!;
        var freie = k["freieTage"]!.AsArray().Select(t => t!["name"]!.GetValue<string>()).ToList();
        Assert.Equal(new[] { "Christi Himmelfahrt", "Pfingstmontag", "Pfingstferien" }, freie);
        Assert.Equal("feiertag", k["freieTage"]![0]!["art"]!.GetValue<string>());
        Assert.Equal("Sommerferien", k["naechsteFerien"]!["name"]!.GetValue<string>());

        s.Dienst<Uhr>().Fest = new DateTime(2027, 5, 6, 9, 0, 0);
        var k2 = (await Testserver.HolenAsync(c, "/api/app/heute"))["kalender"]!;
        Assert.Equal("Christi Himmelfahrt", k2["frei"]!["name"]!.GetValue<string>());
        Assert.Equal("feiertag", k2["frei"]!["art"]!.GetValue<string>());
    }
}
