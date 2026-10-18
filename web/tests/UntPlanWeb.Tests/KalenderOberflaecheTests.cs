using System.Net;
using System.Net.Http.Json;

namespace UntPlanWeb.Tests;

/// <summary>
/// Eigener Kalender (Datumswähler) für alle Datumsfelder, Unterstützung kleinerer Notebook-Bildschirme, überarbeitete Anmeldeseite,
/// Abstand in der Navigation und rahmenlose Auswahl im Kopf des Stundenplans.
/// </summary>
public class KalenderOberflaecheTests
{

    // ------------------------------------------------------------------ Schnittstelle für den Kalender

    [Fact]
    public async Task Kalender_liefert_Ferien_Feiertage_und_eigene_freie_Tage()
    {
        await using var s = await Testserver.StartenAsync();
        var admin = await s.AlsAsync("admin");
        await Testserver.JsonAsync(await admin.PostAsJsonAsync("/api/app/admin/freietage", new { von = "2026-11-20", bis = "2026-11-20", art = "frei", name = "Pädagogischer Tag" }));

        var c = await s.AlsAsync("mue", "lehrer", "MUE");
        var k = await Testserver.HolenAsync(c, "/api/app/kalender");
        var tage = k["freieTage"]!.AsArray().Select(t => t!).ToList();
        Assert.Contains(tage, t => t["name"]!.GetValue<string>() == "Herbstferien" && t["art"]!.GetValue<string>() == "ferien" && t["von"]!.GetValue<string>() == "2026-10-17");
        Assert.Contains(tage, t => t["art"]!.GetValue<string>() == "feiertag" && t["von"]!.GetValue<string>() == "2026-10-03");
        Assert.Contains(tage, t => t["name"]!.GetValue<string>() == "Pädagogischer Tag" && t["art"]!.GetValue<string>() == "frei");
        // nach Beginn sortiert, jeweils ISO-Daten
        var von = tage.Select(t => t["von"]!.GetValue<string>()).ToList();
        Assert.Equal(von.OrderBy(x => x, StringComparer.Ordinal), von);
        Assert.All(tage, t => Assert.Matches(@"^\d{4}-\d{2}-\d{2}$", t["bis"]!.GetValue<string>()));
        Assert.NotNull(k["schuljahr"]?["von"]);
    }

    [Fact]
    public async Task Kalender_nur_fuer_angemeldete_Benutzer()
    {
        await using var s = await Testserver.StartenAsync();
        var r = await s.Client().GetAsync("/api/app/kalender");
        Assert.False(r.IsSuccessStatusCode);
        Assert.Contains(r.StatusCode, new[] { HttpStatusCode.Unauthorized, HttpStatusCode.Forbidden });
    }

    // ------------------------------------------------------------------ Kalender-Komponente

    // ------------------------------------------------------------------ Kleinere Notebooks

    // ------------------------------------------------------------------ Anmeldung, Navigation, Kopf des Stundenplans

}
