using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace EduOrgaWebsite.Tests;

/// <summary>Testserver mit eigenem wwwroot (kleine index.html und eine Bilddatei), unabhängig vom Build der Oberfläche.</summary>
public sealed class Testserver : WebApplicationFactory<Program>
{
    public string Webordner { get; } = Path.Combine(Path.GetTempPath(), "edo-website-test-" + Guid.NewGuid().ToString("N"));
    private readonly Dictionary<string, string?> _werte;

    public Testserver(Dictionary<string, string?>? werte = null)
    {
        Directory.CreateDirectory(Path.Combine(Webordner, "assets"));
        File.WriteAllText(Path.Combine(Webordner, "index.html"), "<!doctype html><html lang=\"de\"><title>EduOrga</title><div id=\"root\"></div></html>");
        File.WriteAllText(Path.Combine(Webordner, "assets", "index-abc123.js"), "console.log('EduOrga');");
        _werte = werte ?? [];
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Production");
        builder.UseWebRoot(Webordner);
        foreach (var (k, v) in _werte) builder.UseSetting(k, v);
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        try { Directory.Delete(Webordner, true); } catch (IOException) { }
    }
}

public class SeitenTests
{
    [Theory]
    [InlineData("/")]
    [InlineData("/studio")]
    [InlineData("/web")]
    [InlineData("/mobile")]
    [InlineData("/installation")]
    [InlineData("/dokumentation")]
    [InlineData("/handbuch")]
    [InlineData("/rueckmeldung")]
    [InlineData("/ios")]
    [InlineData("/android")]
    [InlineData("/hinweis")]
    [InlineData("/impressum")]
    [InlineData("/datenschutz")]
    [InlineData("/gibt-es-nicht")]
    public async Task Seiten_liefern_die_Oberflaeche(string adresse)
    {
        using var s = new Testserver();
        var r = await s.CreateClient().GetAsync(adresse);
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Equal("text/html", r.Content.Headers.ContentType?.MediaType);
        Assert.Contains("<div id=\"root\">", await r.Content.ReadAsStringAsync());
        Assert.False(r.Headers.Contains("Set-Cookie"));
    }

    /// <summary>Die Oberfläche kennt jede Seitenadresse, die der Server ausliefern soll (website/client/src/main.tsx).</summary>
    [Theory]
    [InlineData("studio")]
    [InlineData("web")]
    [InlineData("mobile")]
    [InlineData("installation")]
    [InlineData("dokumentation")]
    [InlineData("handbuch")]
    [InlineData("rueckmeldung")]
    [InlineData("ios")]
    [InlineData("android")]
    [InlineData("hinweis")]
    [InlineData("impressum")]
    [InlineData("datenschutz")]
    public void Oberflaeche_kennt_die_Seitenadresse(string pfad)
    {
        var verzeichnis = new DirectoryInfo(AppContext.BaseDirectory);
        while (verzeichnis is not null && !File.Exists(Path.Combine(verzeichnis.FullName, "website", "client", "src", "main.tsx")))
            verzeichnis = verzeichnis.Parent;
        Assert.NotNull(verzeichnis);
        var routen = File.ReadAllText(Path.Combine(verzeichnis!.FullName, "website", "client", "src", "main.tsx"));
        Assert.Contains($"path=\"{pfad}\"", routen);
    }

    [Fact]
    public async Task Schutzkoepfe_und_Content_Security_Policy()
    {
        using var s = new Testserver();
        var r = await s.CreateClient().GetAsync("/");
        Assert.Equal("nosniff", r.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("DENY", r.Headers.GetValues("X-Frame-Options").Single());
        Assert.StartsWith("default-src 'self'", r.Headers.GetValues("Content-Security-Policy").Single());
        Assert.Equal("no-cache", r.Headers.CacheControl?.ToString());
    }

    [Fact]
    public async Task Assets_werden_lange_zwischengespeichert()
    {
        using var s = new Testserver();
        var r = await s.CreateClient().GetAsync("/assets/index-abc123.js");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.Contains("immutable", r.Headers.CacheControl?.ToString());
    }

    [Fact]
    public async Task Gesundheit_meldet_ok()
    {
        using var s = new Testserver();
        var r = await s.CreateClient().GetAsync("/api/gesundheit");
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        Assert.True((await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("ok").GetBoolean());
        Assert.Equal("no-store", r.Headers.CacheControl?.ToString());
    }

    [Fact]
    public async Task Info_enthaelt_Betreiberangaben_aus_der_Umgebung()
    {
        using var s = new Testserver(new()
        {
            ["WEBSITE_BETREIBER_NAME"] = " Erika Mustermann ",
            ["WEBSITE_BETREIBER_ANSCHRIFT"] = "Musterweg 1, 12345 Musterstadt",
            ["WEBSITE_BETREIBER_EMAIL"] = "kontakt@example.org",
        });
        var j = await s.CreateClient().GetFromJsonAsync<JsonElement>("/api/info");
        var b = j.GetProperty("betreiber");
        Assert.Equal("Erika Mustermann", b.GetProperty("name").GetString());
        Assert.Equal("Musterweg 1, 12345 Musterstadt", b.GetProperty("anschrift").GetString());
        Assert.Equal("kontakt@example.org", b.GetProperty("email").GetString());
        Assert.False(string.IsNullOrEmpty(j.GetProperty("version").GetString()));
    }

    [Fact]
    public async Task Info_ohne_Angaben_liefert_leere_Felder()
    {
        using var s = new Testserver();
        var b = (await s.CreateClient().GetFromJsonAsync<JsonElement>("/api/info")).GetProperty("betreiber");
        Assert.Equal("", b.GetProperty("name").GetString());
    }

    [Theory]
    [InlineData("/api/eintraege")]
    [InlineData("/api/admin/anmelden")]
    [InlineData("/api/unbekannt")]
    public async Task Fruehere_Portaladressen_gibt_es_nicht_mehr(string adresse)
    {
        using var s = new Testserver();
        var r = await s.CreateClient().GetAsync(adresse);
        Assert.Equal(HttpStatusCode.NotFound, r.StatusCode);
    }
}
