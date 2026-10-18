using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;

namespace UntPlanWeb.Tests;

/// <summary>
/// Buchen: Ressourcen mit Standort und Symbol je Art, Beispiel-Ressourcen, Ressourcenübersicht für einen Tag mit gebuchter Menge je Stunde
/// (Verfügbarkeit, Zeitstrahl), Rechte in den Optionen sowie die überarbeiteten Übersichten (Belegungsraster mit Filtern, Zoom, Hover,
/// Liste je Raum auf dem Telefon; Ressourcen als Karten bzw. Liste mit Buchen direkt aus der Liste). Feste Uhr: Mittwoch, 14.10.2026.
/// </summary>
public class BuchenUebersichtTests
{

    [Fact]
    public async Task Ressource_mit_Standort_und_Art_mit_Symbol()
    {
        await using var s = await Testserver.StartenAsync();
        var admin = await s.AlsAsync("admin");
        var art = await Testserver.JsonAsync(await admin.PostAsJsonAsync("/api/app/buchen/ressourcenarten", new { name = "Beamer", reihenfolge = 10, symbol = "projector" }));
        Assert.Equal("projector", art["symbol"]!.GetValue<string>());
        var artId = art["id"]!.GetValue<int>();
        // unbekanntes Symbol wird abgelehnt
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/app/buchen/ressourcenarten", new { name = "X", symbol = "gibtsnicht" })).StatusCode);
        // Umbenennen ohne Symbol behält das Symbol
        var umbenannt = await Testserver.JsonAsync(await admin.PutAsJsonAsync($"/api/app/buchen/ressourcenarten/{artId}", new { name = "Projektor", reihenfolge = 10 }));
        Assert.Equal("projector", umbenannt["symbol"]!.GetValue<string>());

        var r = await Testserver.JsonAsync(await admin.PostAsJsonAsync("/api/app/buchen/ressourcen", new { name = "Beamer mobil 1", artId, anzahl = 2, standort = "Medienraum" }));
        Assert.Equal("Medienraum", r["standort"]!.GetValue<string>());
        Assert.Equal("projector", r["symbol"]!.GetValue<string>());
        // Ändern ohne Standort behält ihn; feste Ressourcen haben keinen Standort
        var id = r["id"]!.GetValue<int>();
        r = await Testserver.JsonAsync(await admin.PutAsJsonAsync($"/api/app/buchen/ressourcen/{id}", new { name = "Beamer mobil 1", artId, anzahl = 3 }));
        Assert.Equal("Medienraum", r["standort"]!.GetValue<string>());
        var fest = await Testserver.JsonAsync(await admin.PostAsJsonAsync("/api/app/buchen/ressourcen", new { name = "Tafel", artId, raum = "PH1", standort = "egal" }));
        Assert.Equal("", fest["standort"]!.GetValue<string>());

        // Suche liefert Standort und Symbol
        var lan = await s.AlsAsync("lan", "lehrer", "LAN");
        var suche = await Testserver.JsonAsync(await lan.PostAsJsonAsync("/api/app/buchen/suche/ressourcen",
            new { zeit = new { wiederholung = "einmalig", datum = "2026-10-15", stundeVon = 3, stundeBis = 3 } }));
        var treffer = suche["ressourcen"]!.AsArray().Single()!;
        Assert.Equal("Medienraum", treffer["standort"]!.GetValue<string>());
        Assert.Equal("projector", treffer["symbol"]!.GetValue<string>());
        // Optionen nennen die Buchungsrechte
        var opt = await Testserver.HolenAsync(lan, "/api/app/buchen/optionen");
        Assert.True(opt["raumBuchen"]!.GetValue<bool>());
        Assert.True(opt["ressourcenBuchen"]!.GetValue<bool>());
    }

    [Fact]
    public async Task Beispiel_Ressourcen_nur_fuer_die_Administration_und_nur_einmal()
    {
        await using var s = await Testserver.StartenAsync();
        var lan = await s.AlsAsync("lan", "lehrer", "LAN");
        Assert.NotEqual(HttpStatusCode.OK, (await lan.PostAsJsonAsync("/api/app/buchen/ressourcen/beispiele", new { })).StatusCode);
        var admin = await s.AlsAsync("admin");
        var r = await Testserver.JsonAsync(await admin.PostAsJsonAsync("/api/app/buchen/ressourcen/beispiele", new { }));
        Assert.True(r["angelegt"]!.GetValue<int>() >= 9);
        var liste = (await Testserver.HolenAsync(admin, "/api/app/buchen/ressourcen")).AsArray();
        Assert.Contains(liste, x => x!["name"]!.GetValue<string>() == "iPad-Koffer" && x["anzahl"]!.GetValue<int>() == 4 && x["standort"]!.GetValue<string>() == "Sekretariat");
        Assert.Contains(liste, x => x!["name"]!.GetValue<string>() == "Interaktive Tafel PH1" && x["raum"]!.GetValue<string>() == "PH1");
        Assert.All(liste, x => Assert.NotEqual("", x!["symbol"]!.GetValue<string>()));
        // zweites Mal: schon Ressourcen vorhanden
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/app/buchen/ressourcen/beispiele", new { })).StatusCode);
        Assert.NotEmpty((await Testserver.HolenAsync(admin, "/api/app/buchen/symbole")).AsArray());
    }

    [Fact]
    public async Task Ressourcenuebersicht_fuer_einen_Tag_mit_gebuchter_Menge_je_Stunde()
    {
        await using var s = await Testserver.StartenAsync();
        var admin = await s.AlsAsync("admin");
        var id = (await Testserver.JsonAsync(await admin.PostAsJsonAsync("/api/app/buchen/ressourcen", new { name = "iPad-Koffer", anzahl = 4, standort = "Sekretariat" })))["id"]!.GetValue<int>();
        await Testserver.JsonAsync(await admin.PostAsJsonAsync("/api/app/buchen/ressourcen", new { name = "Tafel PH1", raum = "PH1" }));
        var lan = await s.AlsAsync("lan", "lehrer", "LAN");
        await Testserver.JsonAsync(await lan.PostAsJsonAsync("/api/app/buchen", new
        {
            art = "ressource", termine = new[] { new { datum = "2026-10-15", stundeVon = 2, stundeBis = 3, raum = (string?)null } }, ressourcen = new[] { new { id, menge = 3 } }, titel = "Recherche",
        }));
        var u = await Testserver.HolenAsync(lan, "/api/app/buchen/ressourcenuebersicht?datum=2026-10-15&tage=1");
        Assert.Equal("2026-10-15", u["tage"]!.AsArray().Single()!["datum"]!.GetValue<string>());
        var koffer = u["ressourcen"]!.AsArray().Single(r => r!["id"]!.GetValue<int>() == id)!;
        Assert.Equal("Sekretariat", koffer["standort"]!.GetValue<string>());
        var g = koffer["gebucht"]!["2026-10-15"]!;
        Assert.Equal(3, g["2"]!.GetValue<int>());
        Assert.Equal(3, g["3"]!.GetValue<int>());
        Assert.Null(g["4"]);
        Assert.Equal("Recherche", koffer["belegung"]!["2026-10-15"]!.AsArray().Single()!["text"]!.GetValue<string>());
        // feste Ressource: Stunden, in denen ihr Raum belegt ist, mit voller Anzahl
        var tafel = u["ressourcen"]!.AsArray().Single(r => r!["raum"]!.GetValue<string>() == "PH1")!;
        Assert.All(tafel["gebucht"]!["2026-10-15"]!.AsObject(), x => Assert.Equal(1, x.Value!.GetValue<int>()));
        // ohne tage: ganze Woche (wie bisher)
        var w = await Testserver.HolenAsync(lan, "/api/app/buchen/ressourcenuebersicht?datum=2026-10-15");
        Assert.True(w["tage"]!.AsArray().Count >= 5);
    }

}
