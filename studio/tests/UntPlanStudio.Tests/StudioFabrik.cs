using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using UntPlan.Core;
using UntPlan.Core.Model;

namespace UntPlanStudio.Tests;

/// <summary>Studio-Server im Testprozess (WebApplicationFactory) mit eigenem Datenordner und festem Admin-Passwort.</summary>
public sealed class StudioFabrik : WebApplicationFactory<Program>
{
    public const string AdminPasswort = "admin-passwort";
    /// <summary>Datenordner (Standard: neuer leerer Ordner, der beim Beenden gelöscht wird).</summary>
    public string Datenordner { get; init; } = Path.Combine(Path.GetTempPath(), "untplanstudio-test-" + Guid.NewGuid().ToString("N"));
    /// <summary>Datenordner beim Beenden löschen (aus für Tests mit Neustart im selben Ordner).</summary>
    public bool OrdnerLoeschen { get; init; } = true;
    /// <summary>Zusätzliche Einstellungen (z. B. STUDIO_UPDATE_URL).</summary>
    public Dictionary<string, string?> Einstellungen { get; init; } = new();
    /// <summary>Ersatz für das Netz bei der Updateprüfung (benannter HttpClient „update“); ohne Angabe ist die Prüfung abgeschaltet.</summary>
    public HttpMessageHandler? Updatequelle { get; init; }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("STUDIO_DATEN", Datenordner);
        builder.UseSetting("STUDIO_ADMIN_PASSWORT", AdminPasswort);
        builder.UseSetting("STUDIO_AUTOSPEICHERN_SEKUNDEN", "3600");
        builder.UseSetting("Logging:LogLevel:Default", "Warning");
        // Tests greifen nie auf GitHub zu: ohne Ersatzquelle bleibt die Updateprüfung aus
        if (Updatequelle is null) builder.UseSetting("STUDIO_UPDATE_PRUEFEN", "0");
        foreach (var (k, v) in Einstellungen) builder.UseSetting(k, v);
        if (Updatequelle is { } quelle)
            builder.ConfigureServices(s => s.AddHttpClient("update").ConfigurePrimaryHttpMessageHandler(() => new Durchreichen(quelle)));
    }

    /// <summary>Gibt den Ersatz-Handler weiter, ohne ihn beim Freigeben durch die HttpClientFactory mit freizugeben.</summary>
    private sealed class Durchreichen(HttpMessageHandler innen) : DelegatingHandler(innen)
    {
        protected override void Dispose(bool disposing) { }
    }

    /// <summary>Client mit Cookies und Schutzkopfzeile (wie die Oberfläche).</summary>
    public HttpClient Client(bool schutzkopf = true)
    {
        var c = CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true, AllowAutoRedirect = false });
        if (schutzkopf) c.DefaultRequestHeaders.Add(UntPlanStudio.Program.Schutzkopf, "1");
        return c;
    }

    public async Task<HttpClient> AngemeldetAsync(string benutzer = "admin", string passwort = AdminPasswort)
    {
        var c = Client();
        var r = await c.PostAsJsonAsync("/api/anmeldung", new { benutzer, passwort });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        return c;
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        if (OrdnerLoeschen)
            try { Directory.Delete(Datenordner, true); } catch (IOException) { } catch (UnauthorizedAccessException) { }
    }
}

public static class Hilfen
{
    public static async Task<JsonNode> JsonAsync(this HttpResponseMessage r, HttpStatusCode erwartet = HttpStatusCode.OK)
    {
        var text = await r.Content.ReadAsStringAsync();
        Assert.True(r.StatusCode == erwartet, $"Status {(int)r.StatusCode} statt {(int)erwartet}: {text}");
        return JsonNode.Parse(text)!;
    }

    public static async Task<JsonNode> GetJsonAsync(this HttpClient c, string pfad) => await (await c.GetAsync(pfad)).JsonAsync();

    public static async Task<JsonNode> PostJsonAsync(this HttpClient c, string pfad, object? daten = null, HttpStatusCode erwartet = HttpStatusCode.OK) =>
        await (await c.PostAsJsonAsync(pfad, daten ?? new { })).JsonAsync(erwartet);

    public static async Task<JsonNode> PatchJsonAsync(this HttpClient c, string pfad, object daten, HttpStatusCode erwartet = HttpStatusCode.OK) =>
        await (await c.PatchAsJsonAsync(pfad, daten)).JsonAsync(erwartet);

    /// <summary>Datei hochladen (multipart, Feld „datei“).</summary>
    public static async Task<HttpResponseMessage> HochladenAsync(this HttpClient c, string pfad, byte[] inhalt, string dateiname, Dictionary<string, string>? felder = null)
    {
        using var form = new MultipartFormDataContent();
        var datei = new ByteArrayContent(inhalt);
        datei.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        form.Add(datei, "datei", dateiname);
        foreach (var (k, v) in felder ?? new()) form.Add(new StringContent(v), k);
        return await c.PostAsync(pfad, form);
    }

    /// <summary>Schuldatei als .up-Inhalt (JSON wie von der Desktop-Anwendung gespeichert).</summary>
    public static byte[] AlsUp(Schuldatei d) => JsonSerializer.SerializeToUtf8Bytes(d, Dokument.JsonOptionen);

    public static string Testdatei(string name) => Path.Combine(AppContext.BaseDirectory, "Testdaten", name);

    /// <summary>Lädt die Beispielschule (ohne Stundenplan) als .up hoch und liefert die Dokument-Id.</summary>
    public static async Task<string> BeispielHochladenAsync(this HttpClient c, Schuldatei? d = null)
    {
        var r = await c.HochladenAsync("/api/dokumente/hochladen", AlsUp(d ?? Demo.Beispielschule()), "Beispiel.up");
        return (await r.JsonAsync())["dokument"]!["id"]!.GetValue<string>();
    }
}
