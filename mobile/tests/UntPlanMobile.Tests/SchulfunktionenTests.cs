using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.Extensions.DependencyInjection;
using UntPlanMobile.Api;

namespace UntPlanMobile.Tests;

/// <summary>
/// EduOrga Mobile: Schulfunktionen wie in der iOS-App über die Durchreichung <c>/api/web/…</c> an EduOrga Web (Prüfungen,
/// Vertretungsplan, Melden, Buchen, Neuigkeiten, Profil, Familie, Klassenbuch, Elternsprechtag mit PDF) und die Kartendarstellung
/// der Schule in den Startdaten.
/// </summary>
public class SchulfunktionenTests
{
    private static StringContent Json(string json) => new(json, Encoding.UTF8, "application/json");

    [Theory]
    [InlineData("GET", "pruefungen", true)]
    [InlineData("GET", "vertretungen", true)]
    [InlineData("POST", "meldungen/abwesenheit", true)]
    [InlineData("DELETE", "meldungen/a1b2-c3", true)]
    [InlineData("GET", "buchen/liste", true)]
    [InlineData("DELETE", "buchen/12", true)]
    [InlineData("GET", "sprechtag/3/plan.pdf", true)]
    [InlineData("GET", "sprechtag/3/elternplan.pdf", true)]
    [InlineData("POST", "sprechtag/3/warteliste", true)]
    [InlineData("DELETE", "sprechtag/3/warteliste/7", true)]
    [InlineData("PUT", "profil", true)]
    [InlineData("GET", "familie/entschuldigung", true)]
    // nicht freigegeben: Administration, Anmeldung, falsche Methode, Sprünge
    [InlineData("GET", "admin/benutzer", false)]
    [InlineData("POST", "anmelden", false)]
    [InlineData("POST", "einrichten", false)]
    [InlineData("DELETE", "pruefungen", false)]
    [InlineData("GET", "buchen/ressourcen", false)]
    [InlineData("GET", "sprechtag/3/../../admin", false)]
    [InlineData("GET", "sprechtag/x/plan.pdf", false)]
    [InlineData("PUT", "darstellung", false)]
    public void Nur_freigegebene_Endpunkte(string methode, string pfad, bool erlaubt) =>
        Assert.Equal(erlaubt, WebApi.Erlaubt(methode, pfad));

    [Fact]
    public async Task Nicht_freigegebene_Pfade_antworten_mit_404_und_ohne_Anmeldung_401()
    {
        await using var u = await Umgebung.StartenAsync();
        using var anonym = u.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonym.GetAsync("/api/web/pruefungen")).StatusCode);
        using var c = await u.AngemeldetAsync("sne");
        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync("/api/web/admin/benutzer")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await c.PostAsync("/api/web/einrichten", Json("{}"))).StatusCode);
        // Fehler von EduOrga Web kommen als { ok:false, error } an
        var r = await c.PostAsync("/api/web/meldungen/abwesenheit", Json("{\"von\":\"2026-10-20\",\"bis\":\"2026-10-19\",\"grund\":\"Krankheit\"}"));
        Assert.False(r.IsSuccessStatusCode);
        var fehler = JsonNode.Parse(await r.Content.ReadAsStringAsync())!;
        Assert.False(fehler["ok"]!.GetValue<bool>());
        Assert.False(string.IsNullOrEmpty(fehler["error"]?.GetValue<string>()));
    }

    [Fact]
    public async Task Lehrkraft_Pruefungen_Vertretungen_Neuigkeiten_Profil_und_Klassenbuch()
    {
        await using var u = await Umgebung.StartenAsync();
        using var c = await u.AngemeldetAsync("sne");
        var pruefungen = (await Umgebung.HolenAsync(c, "/api/web/pruefungen?von=2026-10-12&bis=2026-11-30")).AsArray();
        Assert.All(pruefungen, p => Assert.NotNull(p!["datum"]));
        var vp = await Umgebung.HolenAsync(c, "/api/web/vertretungen?datum=2026-10-14&tage=2");
        Assert.Equal(2, vp["tage"]!.AsArray().Count);
        var info = await Umgebung.HolenAsync(c, "/api/web/infocenter");
        Assert.NotNull(info["eintraege"]);
        // Profil: E-Mail und Benachrichtigung speichern
        Assert.True((await c.PutAsync("/api/web/profil", Json("{\"email\":\"sne@schule.example\",\"sprache\":\"Deutsch\",\"benachrichtigung\":true}"))).IsSuccessStatusCode);
        var profil = await Umgebung.HolenAsync(c, "/api/web/profil");
        Assert.Equal("sne@schule.example", profil["email"]!.GetValue<string>());
        Assert.True(profil["benachrichtigung"]!.GetValue<bool>());
        // Klassenbuch: offene Stunden, Einträge, Befreiungen
        var offen = await Umgebung.HolenAsync(c, "/api/web/klassenbuch/offene-stunden?bereich=woche");
        Assert.NotNull(offen["zeilen"]);
        var eintraege = await Umgebung.HolenAsync(c, "/api/web/klassenbucheintraege?von=2026-09-01&bis=2026-10-31");
        Assert.NotNull(eintraege["arten"]);
        var befreiungen = await Umgebung.HolenAsync(c, "/api/web/befreiungen?von=2026-09-01&bis=2027-07-31");
        Assert.NotNull(befreiungen["gruende"]);
    }

    [Fact]
    public async Task Abwesenheit_melden_und_zurueckziehen()
    {
        await using var u = await Umgebung.StartenAsync();
        using var c = await u.AngemeldetAsync("sne");
        var r = await c.PostAsync("/api/web/meldungen/abwesenheit", Json("{\"von\":\"2026-10-21\",\"bis\":\"2026-10-21\",\"stundeVon\":1,\"stundeBis\":2,\"grund\":\"Arzttermin\",\"text\":\"Termin am Morgen\"}"));
        Assert.True(r.IsSuccessStatusCode, await r.Content.ReadAsStringAsync());
        var meldungen = (await Umgebung.HolenAsync(c, "/api/web/meldungen")).AsArray();
        var m = Assert.Single(meldungen);
        var id = m!["id"]!.ToString();
        Assert.True((await c.DeleteAsync("/api/web/meldungen/" + id)).IsSuccessStatusCode);
        Assert.DoesNotContain((await Umgebung.HolenAsync(c, "/api/web/meldungen")).AsArray(), x => x!["id"]!.ToString() == id);
    }

    [Fact]
    public async Task Raum_buchen_Meine_Buchungen_und_stornieren()
    {
        await using var u = await Umgebung.StartenAsync();
        using var c = await u.AngemeldetAsync("sne");
        var optionen = await Umgebung.HolenAsync(c, "/api/web/buchen/optionen");
        Assert.True(optionen["raumBuchen"]!.GetValue<bool>());
        var zeit = "{\"wiederholung\":\"einmalig\",\"datum\":\"2026-10-15\",\"stundeVon\":5,\"stundeBis\":6}";
        var suche = await Umgebung.JsonAsync(await c.PostAsync("/api/web/buchen/suche/raeume", Json("{\"zeit\":" + zeit + ",\"kriterien\":{}}")));
        var raum = suche["termine"]![0]!["freieRaeume"]![0]!.GetValue<string>();
        var gebucht = await Umgebung.JsonAsync(await c.PostAsync("/api/web/buchen",
            Json("{\"art\":\"raum\",\"termine\":[{\"datum\":\"2026-10-15\",\"stundeVon\":5,\"stundeBis\":6,\"raum\":\"" + raum + "\"}],\"titel\":\"Projekt\",\"text\":\"\"}")));
        var buchung = gebucht["buchungen"]![0]!;
        Assert.Equal(raum, buchung["raum"]!.GetValue<string>());
        var liste = (await Umgebung.HolenAsync(c, "/api/web/buchen/liste?von=2026-10-01&bis=2026-12-31")).AsArray();
        Assert.Contains(liste, b => b!["id"]!.GetValue<int>() == buchung["id"]!.GetValue<int>());
        Assert.True((await c.DeleteAsync("/api/web/buchen/" + buchung["id"])).IsSuccessStatusCode);
    }

    [Fact]
    public async Task Elternsprechtag_Warteliste_und_PDF_fuer_Lehrkraft_und_Eltern()
    {
        await using var u = await Umgebung.StartenAsync();
        var paket = u.WebDienste.GetRequiredService<UntPlanWeb.Dienste.Paketdienst>().Aktuell!;
        var kind = paket.Schueler.First(s => s.Klasse == "5a");
        var bd = u.WebDienste.GetRequiredService<UntPlanWeb.Dienste.Benutzerdienst>();
        var eltern = bd.Anlegen("eltern", Umgebung.Passwort, "eltern", "5a", "Familie");
        bd.SchuelerZuordnen(eltern.Id, new[] { kind.Id });

        // Sprechtag als Administration in EduOrga Web anlegen (Anmeldung läuft am 14.10.2026)
        using (var admin = new HttpClient(new HttpClientHandler { CookieContainer = new CookieContainer() }) { BaseAddress = u.WebAdresse })
        {
            admin.DefaultRequestHeaders.Add("X-UntPlanWeb", "1");
            Assert.True((await admin.PostAsync("/api/app/anmelden", Json("{\"login\":\"admin\",\"passwort\":\"admin-passwort\"}"))).IsSuccessStatusCode);
            var r = await admin.PostAsync("/api/app/sprechtag", Json("""
                {"name":"Elternsprechtag","datum":"2026-11-12","beginn":"15:00","ende":"16:00","dauer":10,"pausen":[],"einladungBis":"",
                 "anmeldungVon":"2026-10-01T08:00","anmeldungBis":"2026-11-10T20:00","sichtbar":true,"raumwahl":true,"hinweis":"",
                 "lehrkraefte":[{"lehrer":"SNE","raum":"R101"},{"lehrer":"FIS","raum":"R102"}],"optionen":{"warteliste":true}}
                """));
            Assert.True(r.IsSuccessStatusCode, await r.Content.ReadAsStringAsync());
        }

        using var e = await u.AngemeldetAsync("eltern");
        var liste = await Umgebung.HolenAsync(e, "/api/web/sprechtag");
        var id = liste["sprechtage"]![0]!["sprechtag"]!["id"]!.GetValue<int>();
        var sicht = await Umgebung.HolenAsync(e, $"/api/web/sprechtag/{id}/eltern");
        var lehrkraft = sicht["kinder"]![0]!["lehrkraefte"]!.AsArray().First(l => l!["kurz"]!.GetValue<string>() == "SNE")!;
        var beginn = lehrkraft["zeitfenster"]![0]!["beginn"]!.GetValue<string>();
        Assert.True((await e.PostAsync($"/api/web/sprechtag/{id}/buchen", Json($"{{\"lehrer\":\"SNE\",\"schuelerId\":{kind.Id},\"beginn\":\"{beginn}\"}}"))).IsSuccessStatusCode);

        // Termine als PDF (Eltern) und Terminplan (Lehrkraft) – unverändert als Datei durchgereicht
        var pdf = await e.GetAsync($"/api/web/sprechtag/{id}/elternplan.pdf");
        Assert.Equal(HttpStatusCode.OK, pdf.StatusCode);
        Assert.Equal("application/pdf", pdf.Content.Headers.ContentType?.MediaType);
        Assert.StartsWith("%PDF", Encoding.ASCII.GetString(await pdf.Content.ReadAsByteArrayAsync())[..4]);

        using var l = await u.AngemeldetAsync("sne");
        var plan = await l.GetAsync($"/api/web/sprechtag/{id}/plan.pdf");
        Assert.Equal("application/pdf", plan.Content.Headers.ContentType?.MediaType);
        var lsicht = await Umgebung.HolenAsync(l, $"/api/web/sprechtag/{id}/lehrkraft");
        Assert.Contains(lsicht["zeitfenster"]!.AsArray(), f => f!["status"]!.GetValue<string>() == "gebucht");
        // Einladung an eine Familie
        var r2 = await l.PostAsync($"/api/web/sprechtag/{id}/einladungen", Json($"{{\"schuelerIds\":[{kind.Id}],\"text\":\"Bitte kommen Sie vorbei.\"}}"));
        Assert.True(r2.IsSuccessStatusCode, await r2.Content.ReadAsStringAsync());
        Assert.Single((await Umgebung.HolenAsync(l, $"/api/web/sprechtag/{id}/lehrkraft"))["einladungen"]!.AsArray());
    }

    [Fact]
    public async Task Eltern_Hausaufgaben_Abwesenheiten_und_Startdaten_mit_Kartendarstellung()
    {
        await using var u = await Umgebung.StartenAsync();
        var paket = u.WebDienste.GetRequiredService<UntPlanWeb.Dienste.Paketdienst>().Aktuell!;
        var kind = paket.Schueler.First(s => s.Klasse == "5a");
        var bd = u.WebDienste.GetRequiredService<UntPlanWeb.Dienste.Benutzerdienst>();
        var eltern = bd.Anlegen("eltern", Umgebung.Passwort, "eltern", "5a", "Familie");
        bd.SchuelerZuordnen(eltern.Id, new[] { kind.Id });
        using var e = await u.AngemeldetAsync("eltern");
        Assert.Single((await Umgebung.HolenAsync(e, "/api/web/familie/kinder")).AsArray());
        Assert.NotNull((await Umgebung.HolenAsync(e, "/api/web/familie/hausaufgaben?von=2026-10-01&bis=2026-10-31"))["zeilen"]);
        Assert.NotNull((await Umgebung.HolenAsync(e, "/api/web/familie/abwesenheiten"))["summen"]);
        // Eltern haben kein Klassenbuch – EduOrga Web lehnt ab
        Assert.False((await e.GetAsync("/api/web/klassenbuch/offene-stunden")).IsSuccessStatusCode);

        // Startdaten: Rolle, Familie und Rechte für das Menü „Mehr“, Kartendarstellung der Schule (Standard „Klassisch“)
        var meta = await Umgebung.HolenAsync(e, "/api/mobile?action=meta");
        Assert.Equal("eltern", meta["user"]!["rolle"]!.GetValue<string>());
        Assert.True(meta["user"]!["familie"]!.GetValue<bool>());
        Assert.Equal(kind.Id, meta["user"]!["schuelerIds"]![0]!.GetValue<int>());
        Assert.Equal("balken-innen", meta["darstellung"]!["fachfarbe"]!.GetValue<string>());
        Assert.Equal("element", meta["darstellung"]!["reihenfolge"]!.GetValue<string>());

        using var l = await u.AngemeldetAsync("sne");
        var seite = await (await l.GetAsync("/")).Content.ReadAsStringAsync();
        Assert.Contains("<title>EduOrga Mobile</title>", seite);
        Assert.Contains("\"darstellung\":{", seite);
        Assert.Contains("\"rechte\":{", seite);
    }
}
