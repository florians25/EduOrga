using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EduOrgaWebsite.Daten;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;

namespace EduOrgaWebsite.Tests;

/// <summary>Testserver mit eigenem, leerem Datenordner.</summary>
public sealed class Testserver : WebApplicationFactory<Program>
{
    public const string AdminPasswort = "Geheim-12345";
    public string Datenordner { get; } = Path.Combine(Path.GetTempPath(), "edo-website-test-" + Guid.NewGuid().ToString("N"));
    private readonly Dictionary<string, string?> _werte;

    public Testserver(Dictionary<string, string?>? zusatz = null)
    {
        _werte = new()
        {
            ["WEBSITE_DATEN"] = Datenordner,
            ["WEBSITE_ADMIN_PASSWORT"] = AdminPasswort,
            ["WEBSITE_MINDESTZEIT_SEKUNDEN"] = "0",
            ["WEBSITE_EINREICHUNGEN_JE_STUNDE"] = "100",
        };
        foreach (var (k, v) in zusatz ?? []) _werte[k] = v;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        foreach (var (k, v) in _werte) builder.UseSetting(k, v);
        builder.UseEnvironment("Production");
    }

    public HttpClient Admin()
    {
        var c = CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true });
        c.DefaultRequestHeaders.Add("X-EduOrga-Website", "1");
        var r = c.PostAsJsonAsync("/api/admin/anmelden", new { benutzer = "admin", passwort = AdminPasswort }).Result;
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        return c;
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        SqliteConnection.ClearAllPools();
        try { Directory.Delete(Datenordner, true); } catch (IOException) { }
    }
}

public class ApiTests
{
    private static object Einreichung(string titel = "Export der Vertretungen als PDF", string? email = "lehrkraft@schule.example", bool einwilligung = true, string? website = null) => new
    {
        typ = "wunsch",
        titel,
        beschreibung = "Es wäre hilfreich, den Vertretungsplan eines Tages direkt als PDF zu exportieren.",
        modul = "studio",
        email,
        einwilligung,
        website,
        bearbeitungsdauer = 8000,
    };

    private static async Task<long> Einreichen(HttpClient c, object? daten = null)
    {
        var r = await c.PostAsJsonAsync("/api/einreichungen", daten ?? Einreichung());
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        var j = await r.Content.ReadFromJsonAsync<JsonElement>();
        return j.GetProperty("nummer").GetInt64();
    }

    private static Task<HttpResponseMessage> Verschieben(HttpClient admin, long id, string status, string? begruendung = null, int? index = null) =>
        admin.PostAsJsonAsync($"/api/admin/eintraege/{id}/verschieben", new { status, begruendung, index });

    [Fact]
    public async Task Einreichung_wird_gespeichert_und_erscheint_in_der_Verwaltung()
    {
        using var s = new Testserver();
        var nr = await Einreichen(s.CreateClient());
        Assert.True(nr > 0);
        var admin = s.Admin();
        var liste = await admin.GetFromJsonAsync<JsonElement>("/api/admin/eintraege");
        var e = Assert.Single(liste.EnumerateArray());
        Assert.Equal("eingereicht", e.GetProperty("status").GetString());
        Assert.Equal("lehrkraft@schule.example", e.GetProperty("email").GetString());
        var detail = await admin.GetFromJsonAsync<JsonElement>($"/api/admin/eintraege/{nr}");
        Assert.Equal("eingereicht", detail.GetProperty("verlauf")[0].GetProperty("aktion").GetString());
    }

    [Fact]
    public async Task Einreichung_ohne_Einwilligung_oder_mit_ungueltigen_Angaben_wird_abgelehnt()
    {
        using var s = new Testserver();
        var c = s.CreateClient();
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/einreichungen", Einreichung(einwilligung: false))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/einreichungen", Einreichung(titel: "kurz"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/einreichungen", Einreichung(email: "keine-adresse"))).StatusCode);
        var r = await c.PostAsJsonAsync("/api/einreichungen", new { typ = "spam", titel = "Ein gültiger Titel", beschreibung = new string('x', 30), modul = "studio", einwilligung = true, bearbeitungsdauer = 9000 });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Contains("Typ", (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("meldung").GetString());
        Assert.Empty((await s.Admin().GetFromJsonAsync<JsonElement>("/api/admin/eintraege")).EnumerateArray());
    }

    [Fact]
    public async Task Honigtopf_und_zu_schnelles_Absenden_speichern_nichts()
    {
        using var s = new Testserver(new() { ["WEBSITE_MINDESTZEIT_SEKUNDEN"] = "3" });
        var c = s.CreateClient();
        var r = await c.PostAsJsonAsync("/api/einreichungen", Einreichung(website: "https://spam.example"));
        Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        Assert.Equal(JsonValueKind.Null, (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("nummer").ValueKind);
        var schnell = await c.PostAsJsonAsync("/api/einreichungen", new { typ = "idee", titel = "Ein gültiger Titel", beschreibung = new string('x', 30), modul = "web", einwilligung = true, bearbeitungsdauer = 200 });
        Assert.Equal(HttpStatusCode.Created, schnell.StatusCode);
        Assert.Empty((await s.Admin().GetFromJsonAsync<JsonElement>("/api/admin/eintraege")).EnumerateArray());
    }

    [Fact]
    public async Task Ratenbegrenzung_greift_nach_der_Hoechstzahl()
    {
        using var s = new Testserver(new() { ["WEBSITE_EINREICHUNGEN_JE_STUNDE"] = "3" });
        var c = s.CreateClient();
        for (var i = 0; i < 3; i++) await Einreichen(c);
        var r = await c.PostAsJsonAsync("/api/einreichungen", Einreichung());
        Assert.Equal(HttpStatusCode.TooManyRequests, r.StatusCode);
        Assert.Equal(3, (await s.Admin().GetFromJsonAsync<JsonElement>("/api/admin/eintraege")).GetArrayLength());
    }

    [Fact]
    public async Task Verwaltung_verlangt_Anmeldung_und_Schutzkopf()
    {
        using var s = new Testserver();
        var c = s.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.GetAsync("/api/admin/eintraege")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.GetAsync("/api/admin/ich")).StatusCode);

        // ohne Schutzkopf wird schon die Anmeldung abgewiesen
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PostAsJsonAsync("/api/admin/anmelden", new { benutzer = "admin", passwort = Testserver.AdminPasswort })).StatusCode);

        c.DefaultRequestHeaders.Add("X-EduOrga-Website", "1");
        var falsch = await c.PostAsJsonAsync("/api/admin/anmelden", new { benutzer = "admin", passwort = "falsch-falsch" });
        Assert.Equal(HttpStatusCode.Unauthorized, falsch.StatusCode);
        Assert.False(falsch.Headers.Contains("Set-Cookie"));

        var admin = s.Admin();
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/admin/eintraege")).StatusCode);
        Assert.Equal("admin", (await admin.GetFromJsonAsync<JsonElement>("/api/admin/ich")).GetProperty("benutzer").GetString());
        await admin.PostAsync("/api/admin/abmelden", null);
        Assert.Equal(HttpStatusCode.Unauthorized, (await admin.GetAsync("/api/admin/eintraege")).StatusCode);
    }

    [Fact]
    public async Task Anmeldung_wird_nach_vielen_Fehlversuchen_gesperrt()
    {
        using var s = new Testserver();
        var c = s.CreateClient();
        c.DefaultRequestHeaders.Add("X-EduOrga-Website", "1");
        for (var i = 0; i < 10; i++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await c.PostAsJsonAsync("/api/admin/anmelden", new { benutzer = "admin", passwort = "falsch" + i })).StatusCode);
        var r = await c.PostAsJsonAsync("/api/admin/anmelden", new { benutzer = "admin", passwort = Testserver.AdminPasswort });
        Assert.Equal(HttpStatusCode.TooManyRequests, r.StatusCode);
    }

    [Fact]
    public async Task Oeffentliche_Seiten_setzen_keine_Cookies()
    {
        using var s = new Testserver();
        var c = s.CreateClient();
        var r = await c.GetAsync("/api/eintraege");
        Assert.False(r.Headers.Contains("Set-Cookie"));
        var p = await c.PostAsJsonAsync("/api/einreichungen", Einreichung());
        Assert.False(p.Headers.Contains("Set-Cookie"));
        Assert.Contains("default-src 'self'", r.Headers.GetValues("Content-Security-Policy").Single());
    }

    [Fact]
    public async Task Statusablauf_folgt_den_Regeln()
    {
        using var s = new Testserver();
        var nr = await Einreichen(s.CreateClient());
        var admin = s.Admin();

        // Abkürzung nicht erlaubt
        var abkuerzung = await Verschieben(admin, nr, "erledigt");
        Assert.Equal(HttpStatusCode.Conflict, abkuerzung.StatusCode);
        Assert.Contains("In Prüfung", (await abkuerzung.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("meldung").GetString());

        Assert.Equal(HttpStatusCode.OK, (await Verschieben(admin, nr, "in_pruefung")).StatusCode);
        // Ablehnung ohne Begründung nicht möglich
        Assert.Equal(HttpStatusCode.BadRequest, (await Verschieben(admin, nr, "abgelehnt")).StatusCode);
        var abgelehnt = await (await Verschieben(admin, nr, "abgelehnt", "Gehört nicht zum Funktionsumfang.")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("abgelehnt", abgelehnt.GetProperty("status").GetString());
        Assert.Equal("Gehört nicht zum Funktionsumfang.", abgelehnt.GetProperty("ablehnungsgrund").GetString());

        // wieder prüfen → Backlog → In Arbeit → Erledigt
        foreach (var st in new[] { "in_pruefung", "backlog", "in_arbeit", "erledigt" })
            Assert.Equal(HttpStatusCode.OK, (await Verschieben(admin, nr, st)).StatusCode);

        var detail = await admin.GetFromJsonAsync<JsonElement>($"/api/admin/eintraege/{nr}");
        var statuswechsel = detail.GetProperty("verlauf").EnumerateArray().Count(v => v.GetProperty("aktion").GetString() == "Status");
        Assert.Equal(6, statuswechsel);
        Assert.Equal("In Arbeit → Erledigt", detail.GetProperty("verlauf")[0].GetProperty("details").GetString());
    }

    [Fact]
    public void Uebergaenge_sind_vollstaendig_definiert()
    {
        foreach (var s in Status.Alle) Assert.NotEmpty(Status.Nachfolger(s));
        Assert.True(Status.Erlaubt(Status.InPruefung, Status.Backlog));
        Assert.False(Status.Erlaubt(Status.Eingereicht, Status.Backlog));
        Assert.False(Status.Erlaubt(Status.Abgelehnt, Status.InArbeit));
    }

    [Fact]
    public async Task Oeffentliche_Liste_zeigt_nur_angenommene_Eintraege_ohne_EMail_und_Notizen()
    {
        using var s = new Testserver();
        var c = s.CreateClient();
        var angenommen = await Einreichen(c);
        var offen = await Einreichen(c, Einreichung(titel: "Noch ungeprüfter Vorschlag"));
        var ausgeblendet = await Einreichen(c, Einreichung(titel: "Angenommen, aber ausgeblendet"));
        var admin = s.Admin();
        foreach (var id in new[] { angenommen, ausgeblendet })
        {
            await Verschieben(admin, id, "in_pruefung");
            await Verschieben(admin, id, "backlog");
        }
        await admin.PatchAsJsonAsync($"/api/admin/eintraege/{angenommen}", new { interneNotiz = "GEHEIME NOTIZ", oeffentlicheAntwort = "Ist für Version 1.2 geplant.", prioritaet = "hoch", tags = new[] { "pdf", "Export" } });
        await admin.PatchAsJsonAsync($"/api/admin/eintraege/{ausgeblendet}", new { oeffentlich = false });

        var antwort = await c.GetAsync("/api/eintraege");
        var text = await antwort.Content.ReadAsStringAsync();
        Assert.DoesNotContain("lehrkraft@schule.example", text);
        Assert.DoesNotContain("GEHEIME NOTIZ", text);
        Assert.DoesNotContain("\"email\"", text);
        Assert.DoesNotContain("prioritaet", text);
        var liste = JsonDocument.Parse(text).RootElement;
        var e = Assert.Single(liste.EnumerateArray());
        Assert.Equal(angenommen, e.GetProperty("nummer").GetInt64());
        Assert.Equal("Im Backlog", e.GetProperty("statusText").GetString());
        Assert.Equal("Ist für Version 1.2 geplant.", e.GetProperty("oeffentlicheAntwort").GetString());
        Assert.NotEqual(offen, e.GetProperty("nummer").GetInt64());

        // Schlagwörter werden bereinigt, Suche und Filter in der Verwaltung
        var gefunden = await admin.GetFromJsonAsync<JsonElement>("/api/admin/eintraege?tag=export&prioritaet=hoch");
        Assert.Equal(new[] { "pdf", "export" }, Assert.Single(gefunden.EnumerateArray()).GetProperty("tags").EnumerateArray().Select(t => t.GetString()));
        Assert.Single((await admin.GetFromJsonAsync<JsonElement>("/api/admin/eintraege?suche=ungeprüft")).EnumerateArray());
        Assert.Single((await admin.GetFromJsonAsync<JsonElement>($"/api/admin/eintraege?suche=%23{offen}")).EnumerateArray());
    }

    [Fact]
    public async Task Reihenfolge_in_einer_Spalte_laesst_sich_aendern()
    {
        using var s = new Testserver();
        var c = s.CreateClient();
        var a = await Einreichen(c);
        var b = await Einreichen(c);
        var d = await Einreichen(c);
        var admin = s.Admin();
        await Verschieben(admin, d, "eingereicht", index: 0);
        var ids = (await admin.GetFromJsonAsync<JsonElement>("/api/admin/eintraege?status=eingereicht")).EnumerateArray().Select(e => e.GetProperty("id").GetInt64()).ToList();
        Assert.Equal(new[] { d, a, b }, ids);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync($"/api/admin/eintraege/{b}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync($"/api/admin/eintraege/{b}")).StatusCode);
    }

    [Fact]
    public async Task Passwort_setzen_ueber_die_Kommandozeile()
    {
        using var s = new Testserver();
        s.CreateClient(); // Server einmal starten (legt Datenbank und Administrator an)
        var konfiguration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["WEBSITE_DATEN"] = s.Datenordner }).Build();
        var aus = new StringWriter();
        var fehler = new StringWriter();

        Assert.Equal(1, Program.PasswortSetzen(["--passwort-setzen", "chefin"], konfiguration, ".", new StringReader("Neues-Passwort-1\n"), aus, fehler));
        Assert.Contains("admin", fehler.ToString());
        Assert.Equal(1, Program.PasswortSetzen(["--passwort-setzen", "admin"], konfiguration, ".", new StringReader("kurz\n"), aus, fehler));
        Assert.Equal(0, Program.PasswortSetzen(["--passwort-setzen", "admin"], konfiguration, ".", new StringReader("Neues-Passwort-1\n"), aus, fehler));
        Assert.Equal(0, Program.PasswortSetzen(["--passwort-setzen", "chefin", "--anlegen"], konfiguration, ".", new StringReader("Chefin-Passwort-1\n"), aus, fehler));

        var c = s.CreateClient();
        c.DefaultRequestHeaders.Add("X-EduOrga-Website", "1");
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.PostAsJsonAsync("/api/admin/anmelden", new { benutzer = "admin", passwort = Testserver.AdminPasswort })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await c.PostAsJsonAsync("/api/admin/anmelden", new { benutzer = "admin", passwort = "Neues-Passwort-1" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await c.PostAsJsonAsync("/api/admin/anmelden", new { benutzer = "chefin", passwort = "Chefin-Passwort-1" })).StatusCode);
    }

    [Fact]
    public void Passwoerter_werden_gehasht_gespeichert()
    {
        var h = EduOrgaWebsite.Dienste.Passwoerter.Hashen("Geheim-12345");
        Assert.StartsWith("pbkdf2-sha256$", h);
        Assert.DoesNotContain("Geheim", h);
        Assert.True(EduOrgaWebsite.Dienste.Passwoerter.Pruefen("Geheim-12345", h));
        Assert.False(EduOrgaWebsite.Dienste.Passwoerter.Pruefen("Geheim-12346", h));
    }
}
