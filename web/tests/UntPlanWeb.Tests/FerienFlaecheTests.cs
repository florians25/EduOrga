using UntPlanWeb.Dienste;

namespace UntPlanWeb.Tests;

/// <summary>
/// Ferien je Tag: jeder freie Tag (Ferien, Feiertag, unterrichtsfrei) erscheint im Wochenraster als eigene Fläche mit eigenem Text
/// (Art, Name, Zeitraum) – aufeinanderfolgende freie Tage werden nicht mehr zu einer Fläche über mehrere Spalten zusammengefasst.
/// </summary>
public class FerienFlaecheTests
{

    [Fact]
    public async Task Ganze_Ferienwoche_hat_fuer_jeden_Tag_dieselben_Ferienangaben()
    {
        await using var s = await Testserver.StartenAsync();
        var c = await s.AlsAsync("admin");
        var plan = await Testserver.HolenAsync(c, "/api/app/plan?typ=klasse&element=5a&datum=2026-10-19");
        var tage = plan["tage"]!.AsArray().Select(t => t!).ToList();
        Assert.Equal(5, tage.Count);
        Assert.All(tage, t =>
        {
            Assert.True(t["frei"]!.GetValue<bool>());
            Assert.Equal("ferien", t["freiArt"]!.GetValue<string>());
            Assert.Equal("Herbstferien", t["freiGrund"]!.GetValue<string>());
            Assert.Equal("2026-10-17", t["freiVon"]!.GetValue<string>());
        });
    }

}
