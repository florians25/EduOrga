using System.Net;
using System.Net.Http.Json;

namespace UntPlanStudio.Tests;

public sealed class AnmeldungTests : IClassFixture<StudioFabrik>
{
    private readonly StudioFabrik _f;

    public AnmeldungTests(StudioFabrik f) => _f = f;

    [Fact]
    public async Task StartseiteUndGesundheitSindOhneAnmeldungErreichbar()
    {
        var c = _f.Client();
        Assert.Equal(HttpStatusCode.OK, (await c.GetAsync("/gesundheit")).StatusCode);
        var html = await c.GetStringAsync("/");
        Assert.Contains("<title>UntPlan Studio</title>", html);
        Assert.Matches(@"src=""/assets/index-[\w-]+\.js""", html);
        var system = await c.GetJsonAsync("/api/system");
        Assert.False(system["beta"]!.GetValue<bool>());
        var sitzung = await c.GetJsonAsync("/api/sitzung");
        Assert.Null(sitzung["benutzer"]);
    }

    [Fact]
    public async Task AdressenDerOberflaecheLiefernDieStartseiteUndHashDateienDuerfenGecachtWerden()
    {
        var c = _f.Client();
        // Seiten der Oberfläche (Routing im Browser) liefern index.html, ohne Zwischenspeicher
        var seite = await c.GetAsync("/stundenplan?typ=klasse");
        Assert.Equal(HttpStatusCode.OK, seite.StatusCode);
        Assert.Contains("<title>UntPlan Studio</title>", await seite.Content.ReadAsStringAsync());
        Assert.Equal("no-cache", seite.Headers.CacheControl?.ToString());
        var start = await c.GetAsync("/");
        Assert.Equal("no-cache", start.Headers.CacheControl?.ToString());
        // Dateien mit Inhalts-Hash unter /assets/ sind unveränderlich
        var html = await start.Content.ReadAsStringAsync();
        var skript = System.Text.RegularExpressions.Regex.Match(html, @"src=""(/assets/[^""]+\.js)""").Groups[1].Value;
        var datei = await c.GetAsync(skript);
        Assert.Equal(HttpStatusCode.OK, datei.StatusCode);
        Assert.Contains("immutable", datei.Headers.CacheControl?.ToString());
    }

    [Fact]
    public async Task ApiVerlangtAnmeldung()
    {
        var c = _f.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.GetAsync("/api/dokumente")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.PostAsJsonAsync("/api/anmeldung", new { benutzer = "admin", passwort = "falsch" })).StatusCode);
        var ok = await c.PostJsonAsync("/api/anmeldung", new { benutzer = "admin", passwort = StudioFabrik.AdminPasswort });
        Assert.Equal("Admin", ok["rolle"]!.GetValue<string>());
        Assert.Equal(HttpStatusCode.OK, (await c.GetAsync("/api/dokumente")).StatusCode);
        Assert.Equal("admin", (await c.GetJsonAsync("/api/sitzung"))["benutzer"]!["name"]!.GetValue<string>());
        await c.PostJsonAsync("/api/abmeldung");
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.GetAsync("/api/dokumente")).StatusCode);
    }

    [Fact]
    public async Task AenderndeAnfragenBrauchenDieSchutzkopfzeile()
    {
        var c = _f.Client(schutzkopf: false);
        var r = await c.PostAsJsonAsync("/api/anmeldung", new { benutzer = "admin", passwort = StudioFabrik.AdminPasswort });
        Assert.Equal(HttpStatusCode.BadRequest, r.StatusCode);
        Assert.Contains(UntPlanStudio.Program.Schutzkopf, await r.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task LeserDarfLesenAberNichtAendern()
    {
        var admin = await _f.AngemeldetAsync();
        var id = await admin.BeispielHochladenAsync();
        await admin.PostJsonAsync("/api/benutzer", new { name = "leser1", anzeigename = "Leserin", rolle = "Leser", passwort = "leser-passwort" });

        var leser = await _f.AngemeldetAsync("leser1", "leser-passwort");
        var lehrer = await leser.GetJsonAsync($"/api/dokumente/{id}/stammdaten/lehrer");
        var lid = lehrer["zeilen"]![0]!["id"]!.GetValue<int>();
        var r = await leser.PatchAsJsonAsync($"/api/dokumente/{id}/stammdaten/lehrer/{lid}", new { feld = "Langname", wert = "X" });
        Assert.Equal(HttpStatusCode.Forbidden, r.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await leser.GetAsync("/api/benutzer")).StatusCode);
        // eigene Einstellungen darf auch ein Leser speichern
        Assert.Equal(HttpStatusCode.OK, (await leser.PutAsJsonAsync("/api/einstellungen/test.wert", new { a = 1 })).StatusCode);
    }

    [Fact]
    public async Task BenutzereinstellungenWerdenJeBenutzerGespeichert()
    {
        var c = await _f.AngemeldetAsync();
        Assert.Equal(HttpStatusCode.OK, (await c.PutAsJsonAsync("/api/einstellungen/fenster.anordnungen", new { Planung = new[] { new { typ = "stundenplan", x = 1 } } })).StatusCode);
        var w = await c.GetJsonAsync("/api/einstellungen/fenster.anordnungen");
        Assert.Equal("stundenplan", w["wert"]!["planung"]![0]!["typ"]!.GetValue<string>());
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PutAsJsonAsync("/api/einstellungen/..%2Fboese", new { })).StatusCode);
    }
}
