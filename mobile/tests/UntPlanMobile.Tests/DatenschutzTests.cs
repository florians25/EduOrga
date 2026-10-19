using System.Net;

namespace UntPlanMobile.Tests;

/// <summary>Datenschutz in EduOrga Mobile: Datenschutzhinweise der Schule unter der Adresse der App, Verlinkung in der Oberfläche.</summary>
public class DatenschutzTests
{
    [Fact]
    public async Task Datenschutzhinweise_der_Schule_ohne_Anmeldung_erreichbar_und_verlinkt()
    {
        await using var u = await Umgebung.StartenAsync();
        var c = u.Client();
        var r = await c.GetAsync("/datenschutz");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        var html = await r.Content.ReadAsStringAsync();
        Assert.Contains("Datenschutzhinweise", html);
        Assert.Contains("Verantwortlicher", html);
        Assert.Contains("default-src 'none'", r.Headers.GetValues("Content-Security-Policy").Single());
        // Hülle: Link auf der Anmeldeseite und unter „Mehr“
        var huelle = await (await c.GetAsync("/")).Content.ReadAsStringAsync();
        Assert.Contains("href=\"datenschutz\"", huelle);
        Assert.Contains("lnkDatenschutz", huelle);
    }
}
