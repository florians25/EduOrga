using System.Net;
using System.Net.Http.Json;
using UntPlan.Web.Contracts;
using UntPlanWeb.Dienste;

namespace UntPlanWeb.Tests;

/// <summary>
/// Abwesenheitsmeldungen: Eltern melden (nur eigene Kinder, Zeitraum begrenzt, keine doppelte Meldung, zurückziehen), die Klassenleitung
/// bestätigt (Abwesenheit im Klassenbuch, entschuldigt) oder lehnt ab, andere Lehrkräfte sehen die Meldung in der Anwesenheit ohne Text.
/// </summary>
public class AbwesenheitsmeldungTests
{
    private static readonly DateOnly Donnerstag = new(2026, 10, 15);

    [Fact]
    public async Task Eltern_melden_Klassenleitung_bestaetigt_Lehrkraft_sieht_es_in_der_Stunde()
    {
        await using var s = await Testserver.StartenAsync();
        var stand = s.Dienst<Paketdienst>().Aktuell!;
        var kind = stand.Schueler.First(x => x.Klasse == "7a");
        var fremd = stand.Schueler.First(x => x.Klasse == "5a");
        var admin = await s.AlsAsync("admin");
        await Testserver.JsonAsync(await admin.PostAsJsonAsync("/api/app/admin/benutzer", new { login = "eltern-m", passwort = "familie-passwort", rolle = "eltern", anzeigename = "Familie M", gesperrt = false, schuelerIds = new[] { kind.Id } }));
        var eltern = s.Client();
        Assert.Equal(HttpStatusCode.OK, (await eltern.PostAsJsonAsync("/api/app/anmelden", new { login = "eltern-m", passwort = "familie-passwort" })).StatusCode);

        // nur eigene Kinder, sinnvoller Zeitraum
        Assert.Equal(HttpStatusCode.Forbidden, (await eltern.PostAsJsonAsync("/api/app/familie/meldungen", new { schueler = fremd.Id, von = "2026-10-15", bis = "2026-10-16" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await eltern.PostAsJsonAsync("/api/app/familie/meldungen", new { schueler = kind.Id, von = "2026-10-16", bis = "2026-10-15" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await eltern.PostAsJsonAsync("/api/app/familie/meldungen", new { schueler = kind.Id, von = "2026-08-01", bis = "2026-08-02" })).StatusCode);
        var m = await Testserver.JsonAsync(await eltern.PostAsJsonAsync("/api/app/familie/meldungen", new { schueler = kind.Id, von = "2026-10-15", bis = "2026-10-16", text = "Fieber" }));
        var id = m["id"]!.GetValue<int>();
        Assert.Equal("gemeldet", m["status"]!.GetValue<string>());
        Assert.Equal("7a", m["klasse"]!.GetValue<string>());
        Assert.Equal(HttpStatusCode.BadRequest, (await eltern.PostAsJsonAsync("/api/app/familie/meldungen", new { schueler = kind.Id, von = "2026-10-16" })).StatusCode);
        Assert.Single((await Testserver.HolenAsync(eltern, "/api/app/familie/meldungen"))["meldungen"]!.AsArray());

        // Schule: nur Klassenleitung (LAN für 7a) bzw. Leitung/Administration sieht und bearbeitet
        var lan = await s.AlsAsync("lan", "lehrer", "LAN");
        var fis = await s.AlsAsync("fis", "lehrer", "FIS");
        Assert.Single((await Testserver.HolenAsync(lan, "/api/app/abwesenheiten/meldungen?status=gemeldet")).AsArray());
        Assert.Empty((await Testserver.HolenAsync(fis, "/api/app/abwesenheiten/meldungen")).AsArray());
        Assert.Equal(HttpStatusCode.Forbidden, (await fis.PostAsJsonAsync($"/api/app/abwesenheiten/meldungen/{id}/bestaetigen", new { entschuldigt = true })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await eltern.GetAsync("/api/app/abwesenheiten/meldungen")).StatusCode);

        // Lehrkraft einer Stunde am Donnerstag sieht die Meldung in der Anwesenheit (ohne Text, der bleibt bei der Klassenleitung)
        var karte = s.Dienst<Plandienst>().Karten(stand, Donnerstag, Elementtyp.Klasse, "7a").First(k => k.Unterricht.HasValue && k.Status == "regulaer");
        var anw = await Testserver.HolenAsync(admin, $"/api/app/klassenbuch/anwesenheit?datum=2026-10-15&stunde={karte.Von}&unterricht={karte.Unterricht}");
        var gemeldet = anw["meldungen"]!.AsArray().Single(x => x!["schuelerId"]!.GetValue<int>() == kind.Id)!;
        Assert.Equal("gemeldet", gemeldet["status"]!.GetValue<string>());
        Assert.NotNull(anw["schueler"]);

        // bestätigen: Abwesenheit für beide Tage im Klassenbuch, entschuldigt; danach nicht mehr zurückziehbar
        var r = await Testserver.JsonAsync(await lan.PostAsJsonAsync($"/api/app/abwesenheiten/meldungen/{id}/bestaetigen", new { entschuldigt = true }));
        Assert.Equal("bestaetigt", r["meldung"]!["status"]!.GetValue<string>());
        Assert.True(r["stunden"]!.GetValue<int>() > 0);
        var fz = s.Dienst<Klassenbuchdienst>().FehlzeitenVon(kind.Id, Donnerstag, Donnerstag.AddDays(1));
        Assert.NotEmpty(fz);
        Assert.All(fz, f => Assert.Equal("entschuldigt", f.Status));
        Assert.Contains("Fieber", fz[0].Bemerkung);
        Assert.Equal(HttpStatusCode.BadRequest, (await eltern.DeleteAsync($"/api/app/familie/meldungen/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await lan.PostAsJsonAsync($"/api/app/abwesenheiten/meldungen/{id}/ablehnen", new { antwort = "x" })).StatusCode);
        Assert.Equal("bestaetigt", (await Testserver.HolenAsync(eltern, "/api/app/familie/meldungen"))["meldungen"]![0]!["status"]!.GetValue<string>());

        // zweite Meldung: ablehnen mit Antwort; dritte: zurückziehen
        var m2 = await Testserver.JsonAsync(await eltern.PostAsJsonAsync("/api/app/familie/meldungen", new { schueler = kind.Id, von = "2026-10-19", text = "Arzttermin" }));
        var abgelehnt = await Testserver.JsonAsync(await lan.PostAsJsonAsync($"/api/app/abwesenheiten/meldungen/{m2["id"]}/ablehnen", new { antwort = "Bitte Termin außerhalb des Unterrichts." }));
        Assert.Equal("abgelehnt", abgelehnt["status"]!.GetValue<string>());
        Assert.Equal("LAN", abgelehnt["bearbeitetVon"]!.GetValue<string>());
        var m3 = await Testserver.JsonAsync(await eltern.PostAsJsonAsync("/api/app/familie/meldungen", new { schueler = kind.Id, von = "2026-10-20" }));
        Assert.Equal(HttpStatusCode.OK, (await eltern.DeleteAsync($"/api/app/familie/meldungen/{m3["id"]}")).StatusCode);
        Assert.Equal(2, (await Testserver.HolenAsync(eltern, "/api/app/familie/meldungen"))["meldungen"]!.AsArray().Count);
        Assert.Empty((await Testserver.HolenAsync(lan, "/api/app/abwesenheiten/meldungen?status=gemeldet")).AsArray());
    }
}
