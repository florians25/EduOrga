using System.Text.Json.Nodes;

namespace UntPlanStudio.Tests;

/// <summary>
/// Jahreskalender (Zeitraum wieder zu Schultagen machen), Periodenwechsel in einem Schritt (anlegen + aktiv setzen, Ende in den
/// Grunddaten) und Blockansicht der Stundenpläne (mehrere Pläne in einer Antwort).
/// </summary>
public sealed class KalenderPeriodenBlockTests : IClassFixture<StudioFabrik>
{
    private readonly StudioFabrik _f;
    public KalenderPeriodenBlockTests(StudioFabrik f) => _f = f;

    private static JsonNode[] Ferien(JsonNode n) => n["ferien"]!.AsArray().Select(x => x!).ToArray();

    [Fact]
    public async Task ZeitraumFreigebenKuerztTeiltUndLoescht()
    {
        var c = await _f.AngemeldetAsync();
        var id = await c.BeispielHochladenAsync();
        var basis = $"/api/dokumente/{id}/schule";
        var sj = DateOnly.Parse((await c.GetJsonAsync($"{basis}/ferien"))["schuljahrVon"]!.GetValue<string>());
        var von = sj.AddDays(40);
        await c.PostJsonAsync($"{basis}/ferien", new { kurzname = "Lang", von, bis = von.AddDays(9) });
        await c.PostJsonAsync($"{basis}/ferien", new { kurzname = "Kurz", von = von.AddDays(20), bis = von.AddDays(20), feiertag = true });

        // Mitte herausnehmen → zwei Teile
        var n = await c.PostJsonAsync($"{basis}/ferien/freigeben", new { von = von.AddDays(3), bis = von.AddDays(5) });
        var lang = Ferien(n).Where(f => f["kurzname"]!.GetValue<string>() == "Lang").OrderBy(f => f["von"]!.GetValue<string>()).ToArray();
        Assert.Equal(2, lang.Length);
        Assert.Equal(von.AddDays(2), DateOnly.Parse(lang[0]["bis"]!.GetValue<string>()));
        Assert.Equal(von.AddDays(6), DateOnly.Parse(lang[1]["von"]!.GetValue<string>()));
        Assert.Equal(von.AddDays(9), DateOnly.Parse(lang[1]["bis"]!.GetValue<string>()));
        Assert.Contains(Ferien(n), f => f["kurzname"]!.GetValue<string>() == "Kurz");

        // ein Eintrag ganz im Zeitraum wird entfernt, ein überlappender am Ende gekürzt
        var m = await c.PostJsonAsync($"{basis}/ferien/freigeben", new { von = von.AddDays(8), bis = von.AddDays(25) });
        Assert.DoesNotContain(Ferien(m), f => f["kurzname"]!.GetValue<string>() == "Kurz");
        Assert.Equal(von.AddDays(7), DateOnly.Parse(Ferien(m).Where(f => f["kurzname"]!.GetValue<string>() == "Lang").Max(f => f["bis"]!.GetValue<string>())!));

        // Rand kürzen (Zeitraum rückwärts angegeben), eine Rückgängig-Stufe stellt den Stand davor wieder her
        var k = await c.PostJsonAsync($"{basis}/ferien/freigeben", new { von = von.AddDays(1), bis = von });
        Assert.Equal(von.AddDays(2), DateOnly.Parse(Ferien(k).Where(f => f["kurzname"]!.GetValue<string>() == "Lang").Min(f => f["von"]!.GetValue<string>())!));
        await c.PostJsonAsync($"/api/dokumente/{id}/rueckgaengig");
        var z = await c.GetJsonAsync($"{basis}/ferien");
        Assert.Equal(von, DateOnly.Parse(Ferien(z).Where(f => f["kurzname"]!.GetValue<string>() == "Lang").Min(f => f["von"]!.GetValue<string>())!));
    }

    [Fact]
    public async Task NeuePeriodeGleichAktivUndRueckgaengig()
    {
        var c = await _f.AngemeldetAsync();
        var id = await c.BeispielHochladenAsync();
        var basis = $"/api/dokumente/{id}/schule";
        var g = await c.GetJsonAsync($"/api/dokumente/{id}/grunddaten");
        var erste = g["perioden"]![0]!;
        var alt = erste["id"]!.GetValue<int>();
        Assert.NotNull(erste["ende"]);
        var von = DateOnly.Parse(erste["von"]!.GetValue<string>()).AddDays(100);

        var n = await c.PostJsonAsync($"{basis}/perioden", new { mutterId = alt, name = "Zweites Halbjahr", von, aktivieren = true });
        var neu = n["perioden"]!.AsArray().First(p => p!["name"]!.GetValue<string>() == "Zweites Halbjahr")!;
        Assert.Equal(neu["id"]!.GetValue<int>(), n["aktiv"]!.GetValue<int>());
        Assert.True(neu["unterrichte"]!.GetValue<int>() > 0);

        // Grunddaten: sortiert nach Beginn, Ende der ersten Periode = Vortag der neuen
        var g2 = await c.GetJsonAsync($"/api/dokumente/{id}/grunddaten");
        var liste = g2["perioden"]!.AsArray();
        Assert.Equal(alt, liste[0]!["id"]!.GetValue<int>());
        Assert.Equal(von.AddDays(-1), DateOnly.Parse(liste[0]!["ende"]!.GetValue<string>()));
        Assert.True(liste[1]!["aktiv"]!.GetValue<bool>());

        // eine Stufe: Rückgängig entfernt die Periode und die alte ist wieder aktiv
        await c.PostJsonAsync($"/api/dokumente/{id}/rueckgaengig");
        var nach = await c.GetJsonAsync($"{basis}/perioden");
        Assert.Equal(alt, nach["aktiv"]!.GetValue<int>());
        Assert.DoesNotContain(nach["perioden"]!.AsArray(), p => p!["name"]!.GetValue<string>() == "Zweites Halbjahr");
    }

    [Fact]
    public async Task BlockansichtLiefertMehrerePlaeneMitGruppen()
    {
        var c = await _f.AngemeldetAsync();
        var id = await c.BeispielHochladenAsync();
        var alle = await c.GetJsonAsync($"/api/dokumente/{id}/stundenplan/klasse/block");
        var klassen = alle["alle"]!.AsArray();
        Assert.True(klassen.Count > 2);
        Assert.Equal(klassen.Count, alle["plaene"]!.AsArray().Count);
        Assert.NotNull(alle["zeitraster"]!["tage"]);
        Assert.Contains(klassen, k => k!["gruppe"]!.GetValue<string>().Length > 0);

        var zwei = string.Join(",", klassen.Take(2).Select(k => k!["id"]!.GetValue<int>()));
        var teil = await c.GetJsonAsync($"/api/dokumente/{id}/stundenplan/klasse/block?ids={zwei}");
        var plaene = teil["plaene"]!.AsArray();
        Assert.Equal(2, plaene.Count);
        Assert.All(plaene, p => Assert.NotNull(p!["zellen"]));
        Assert.Equal(klassen.Count, teil["alle"]!.AsArray().Count);

        var keine = await c.GetJsonAsync($"/api/dokumente/{id}/stundenplan/lehrer/block?ids=-1");
        Assert.Empty(keine["plaene"]!.AsArray());
        Assert.NotEmpty(keine["alle"]!.AsArray());
    }
}
