using System.Net;
using UntPlanStudio.Api;
using UntPlanStudio.Dienste;

namespace UntPlanStudio.Tests;

/// <summary>Updatehinweis: Versionsvergleich, Auswertung der GitHub-Releases und <c>GET /api/version</c> (nur Administratoren, ohne Netz).</summary>
public class VersionTests
{
    /// <summary>Ersatz für die GitHub-API: liefert eine feste Antwort oder wirft einen Netzwerkfehler und zählt die Aufrufe.</summary>
    private sealed class GitHubErsatz(Func<HttpRequestMessage, HttpResponseMessage> antwort) : HttpMessageHandler
    {
        public int Aufrufe;
        public HttpRequestMessage? Letzte;

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Interlocked.Increment(ref Aufrufe);
            Letzte = request;
            return Task.FromResult(antwort(request));
        }

        public static GitHubErsatz Json(string json) => new(_ => new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json) });
    }

    private const string Release = """
        {"tag_name":"v99.5.0","name":"UntPlan 99.5","html_url":"https://github.com/florians25/EduOrga/releases/tag/v99.5.0",
         "draft":false,"prerelease":false,"published_at":"2026-10-01T08:00:00Z","body":"## Neu\r\n- Updatehinweis im Studio"}
        """;

    [Theory]
    [InlineData("1.5.0", "1.4.9", 1)]
    [InlineData("v1.5.0", "1.5.0", 0)]
    [InlineData("studio-v1.10.0", "1.9.0", 1)]
    [InlineData("1.0.57", "1.0.100", -1)]
    [InlineData("1.5", "1.5.0+abc", 0)]
    public void Versionen_werden_verglichen(string a, string b, int erwartet) =>
        Assert.Equal(erwartet, Math.Sign(Updatepruefung.Vergleichen(a, b)));

    [Fact]
    public void Releases_werden_ausgewertet()
    {
        var r = Updatepruefung.ReleaseAuswerten(Release)!;
        Assert.Equal("99.5.0", r.Version);
        Assert.Equal("UntPlan 99.5", r.Name);
        Assert.Equal("## Neu\n- Updatehinweis im Studio", r.Hinweise);
        Assert.Equal(new DateTime(2026, 10, 1, 8, 0, 0, DateTimeKind.Utc), r.Veroeffentlicht);
        // Entwürfe und Vorabversionen zählen nicht, Produktpräfix wird beachtet
        Assert.Equal("2.0.0", Updatepruefung.ReleaseAuswerten("""[{"tag_name":"v2.0.0"},{"tag_name":"v3.0.0","prerelease":true},{"tag_name":"v4.0.0","draft":true}]""")!.Version);
        Assert.Equal("1.2.0", Updatepruefung.ReleaseAuswerten("""[{"tag_name":"web-v9.0.0"},{"tag_name":"studio-v1.2.0"}]""", "studio-v")!.Version);
        Assert.Null(Updatepruefung.ReleaseAuswerten("""{"tag_name":"v1.0.0","draft":true}"""));
        var lang = Updatepruefung.Kuerzen(string.Join("\n", Enumerable.Repeat("- Zeile mit Inhalt", 1000)))!;
        Assert.True(lang.Length <= Updatepruefung.HinweiseMaxLaenge + 3);
        Assert.EndsWith("…", lang);
    }

    [Fact]
    public async Task Neue_Version_wird_Administratoren_gemeldet()
    {
        var github = GitHubErsatz.Json(Release);
        using var f = new StudioFabrik { Updatequelle = github };
        var admin = await f.AngemeldetAsync();
        var v = await admin.GetJsonAsync("/api/version");
        Assert.True(v["pruefungAktiv"]!.GetValue<bool>());
        Assert.True(v["updateVerfuegbar"]!.GetValue<bool>());
        Assert.Equal("99.5.0", v["neueste"]!.GetValue<string>());
        Assert.Equal("UntPlan 99.5", v["releaseName"]!.GetValue<string>());
        Assert.Equal("https://github.com/florians25/EduOrga/releases/tag/v99.5.0", v["releaseUrl"]!.GetValue<string>());
        Assert.Contains("Updatehinweis im Studio", v["hinweise"]!.GetValue<string>());
        Assert.NotNull(v["veroeffentlicht"]);
        Assert.Equal(VersionApi.Befehl, v["befehl"]!.GetValue<string>());
        Assert.False(string.IsNullOrEmpty(v["version"]!.GetValue<string>()));
        // Standardquelle, User-Agent; Ergebnis wird zwischengespeichert (keine zweite Abfrage), ?neu=1 fragt erneut
        Assert.Equal(Updatepruefung.StandardUrl, github.Letzte!.RequestUri!.ToString());
        Assert.NotEmpty(github.Letzte.Headers.UserAgent);
        await admin.GetJsonAsync("/api/version");
        Assert.Equal(1, github.Aufrufe);
        await admin.GetJsonAsync("/api/version?neu=1");
        Assert.Equal(2, github.Aufrufe);
    }

    [Fact]
    public async Task Nur_Administratoren_und_angemeldet()
    {
        using var f = new StudioFabrik { Updatequelle = GitHubErsatz.Json(Release) };
        Assert.Equal(HttpStatusCode.Unauthorized, (await f.Client().GetAsync("/api/version")).StatusCode);
        var admin = await f.AngemeldetAsync();
        await admin.PostJsonAsync("/api/benutzer", new { name = "planer1", anzeigename = "Planer", rolle = "Planer", passwort = "planer-passwort" });
        var planer = await f.AngemeldetAsync("planer1", "planer-passwort");
        Assert.Equal(HttpStatusCode.Forbidden, (await planer.GetAsync("/api/version")).StatusCode);
    }

    [Fact]
    public async Task Gleiche_oder_aeltere_Version_ergibt_keinen_Hinweis()
    {
        using var f = new StudioFabrik { Updatequelle = GitHubErsatz.Json("""{"tag_name":"v0.0.1","html_url":"https://x"}""") };
        var v = await (await f.AngemeldetAsync()).GetJsonAsync("/api/version");
        Assert.False(v["updateVerfuegbar"]!.GetValue<bool>());
        Assert.Equal("0.0.1", v["neueste"]!.GetValue<string>());
    }

    [Fact]
    public async Task Netzwerkfehler_ergeben_keinen_Hinweis()
    {
        var github = new GitHubErsatz(_ => throw new HttpRequestException("keine Verbindung"));
        using var f = new StudioFabrik { Updatequelle = github, Einstellungen = { ["STUDIO_UPDATE_URL"] = "https://example.org/releases/latest" } };
        var v = await (await f.AngemeldetAsync()).GetJsonAsync("/api/version");
        Assert.False(v["updateVerfuegbar"]!.GetValue<bool>());
        Assert.Null(v["neueste"]);
        Assert.Contains("fehlgeschlagen", v["fehler"]!.GetValue<string>());
        Assert.Equal("https://example.org/releases/latest", github.Letzte!.RequestUri!.ToString());

        using var f2 = new StudioFabrik { Updatequelle = GitHubErsatz.Json("<html>Proxy-Fehler</html>") };
        var v2 = await (await f2.AngemeldetAsync()).GetJsonAsync("/api/version");
        Assert.False(v2["updateVerfuegbar"]!.GetValue<bool>());
    }

    [Fact]
    public async Task Pruefung_abschaltbar()
    {
        var github = GitHubErsatz.Json(Release);
        using var f = new StudioFabrik { Updatequelle = github, Einstellungen = { ["STUDIO_UPDATE_PRUEFEN"] = "0" } };
        var v = await (await f.AngemeldetAsync()).GetJsonAsync("/api/version");
        Assert.False(v["pruefungAktiv"]!.GetValue<bool>());
        Assert.False(v["updateVerfuegbar"]!.GetValue<bool>());
        Assert.Equal(0, github.Aufrufe);
    }
}
