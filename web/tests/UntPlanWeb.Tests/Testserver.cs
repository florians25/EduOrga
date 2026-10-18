using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using UntPlanWeb.Dienste;

namespace UntPlanWeb.Tests;

/// <summary>
/// UntPlanWeb im Testprozess (Kestrel auf freiem Port, eigener Datenordner, feste Uhr: Mittwoch der Beispielwoche).
/// </summary>
public sealed class Testserver : IAsyncDisposable
{
    public const string SchulId = "testschule";
    public const string ApiSchluessel = "test-schluessel-1234567890";
    public const string AdminPasswort = "admin-passwort";
    public static readonly DateTime Jetzt = new(2026, 10, 14, 10, 0, 0);

    private readonly WebApplication _app;
    private readonly string _ordner;
    public Uri Adresse { get; }
    /// <summary>Datenordner des Servers (z. B. für Kommandozeilenbefehle gegen dieselbe Datenbank).</summary>
    public string Datenordner => _ordner;

    private Testserver(WebApplication app, string ordner)
    {
        _app = app;
        _ordner = ordner;
        var adresse = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.First();
        Adresse = new Uri(adresse);
    }

    public static async Task<Testserver> StartenAsync(bool mitPaket = true)
    {
        var ordner = Path.Combine(Path.GetTempPath(), "untplanweb-test-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(ordner);
        // Inhaltsverzeichnis = Projektordner, damit wwwroot (Startseite, Monitor) gefunden wird
        var app = Program.Erstellen(new[] { "--contentRoot", Path.Combine(Wurzel(), "src", "UntPlanWeb") }, b =>
        {
            b.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["UNTPLANWEB_DATEN"] = ordner,
                ["UNTPLANWEB_ADMIN_PASSWORT"] = AdminPasswort,
                ["UNTPLANWEB_SCHUL_ID"] = SchulId,
                ["UNTPLANWEB_API_SCHLUESSEL"] = ApiSchluessel,
                ["Logging:LogLevel:Default"] = "Warning",
            });
            b.Configuration.AddInMemoryCollection(Testzusatz.Konfiguration(ordner)); // optional MySQL/MariaDB bzw. Update-Einstellungen
            b.WebHost.UseUrls("http://127.0.0.1:0");
        });
        app.Services.GetRequiredService<Uhr>().Fest = Jetzt;
        await app.StartAsync();
        var s = new Testserver(app, ordner);
        if (mitPaket)
        {
            var antwort = await s.PaketSendenAsync(Beispielpaket());
            Assert.Equal(HttpStatusCode.OK, antwort.StatusCode);
        }
        return s;
    }

    public T Dienst<T>() where T : notnull => _app.Services.GetRequiredService<T>();

    /// <summary>Das Beispielpaket aus demo/ (Woche ab 12.10.2026).</summary>
    public static JsonObject Beispielpaket() =>
        JsonNode.Parse(File.ReadAllText(Path.Combine(Wurzel(), "demo", "beispiel-paket.json")))!.AsObject();

    /// <summary>Ordner web/ (enthält demo/ und src/UntPlanWeb).</summary>
    private static string Wurzel()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null && !File.Exists(Path.Combine(dir.FullName, "src", "UntPlanWeb", "UntPlanWeb.csproj"))) dir = dir.Parent;
        Assert.NotNull(dir);
        return dir!.FullName;
    }

    public HttpClient Client(bool cookies = true)
    {
        var handler = new HttpClientHandler { UseCookies = cookies, CookieContainer = new CookieContainer(), AllowAutoRedirect = false };
        var c = new HttpClient(handler) { BaseAddress = Adresse };
        c.DefaultRequestHeaders.Add("X-UntPlanWeb", "1");
        return c;
    }

    public Task<HttpResponseMessage> PaketSendenAsync(JsonObject paket, string? schluessel = ApiSchluessel)
    {
        var c = Client(false);
        if (schluessel != null) c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", schluessel);
        return c.PutAsync($"/api/v1/schulen/{SchulId}/untplanweb", new StringContent(paket.ToJsonString(), System.Text.Encoding.UTF8, "application/json"));
    }

    /// <summary>
    /// „Findet online statt“ wie aus UntPlan Studio im Paket setzen: tagesaktuelle Stunden (WebStunde) eines Unterrichts am Datum,
    /// Stunden von–bis (null = alle Stunden des Tages).
    /// </summary>
    public static JsonObject OnlineStunden(JsonObject paket, string datum, int unterricht, bool online, string link = "", int? von = null, int? bis = null)
    {
        var tag = paket["tage"]!.AsArray().First(t => t!["datum"]!.GetValue<string>() == datum)!;
        foreach (var st in tag["stunden"]!.AsArray().Select(x => x!.AsObject()))
        {
            if (st["unterricht"]?.GetValue<int>() != unterricht) continue;
            var h = st["stunde"]!.GetValue<int>();
            if ((von is int v && h < v) || (bis is int b && h > b)) continue;
            st["online"] = online;
            st["onlineLink"] = link;
        }
        return paket;
    }

    /// <summary>„Findet online statt“ eines Unterrichts (regelmäßig, WebUnterricht) in allen Perioden des Pakets setzen.</summary>
    public static JsonObject OnlineUnterricht(JsonObject paket, int unterricht, bool online, string link = "")
    {
        foreach (var u in paket["perioden"]!.AsArray().SelectMany(p => p!["unterricht"]!.AsArray()).Select(x => x!.AsObject()).Where(x => x["id"]!.GetValue<int>() == unterricht))
        {
            u["online"] = online;
            u["onlineLink"] = link;
        }
        return paket;
    }

    private int _revision = 1;

    /// <summary>Paket mit der nächsten Revision senden (z. B. nach <see cref="OnlineStunden"/>) und auf Erfolg prüfen.</summary>
    public async Task NeuesPaketAsync(JsonObject paket)
    {
        paket["revision"] = ++_revision;
        var r = await PaketSendenAsync(paket);
        Assert.True(r.IsSuccessStatusCode, $"Paket: HTTP {(int)r.StatusCode} {await r.Content.ReadAsStringAsync()}");
    }

    public HttpClient SyncClient()
    {
        var c = Client(false);
        c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", ApiSchluessel);
        return c;
    }

    /// <summary>Angemeldeter Client; legt den Benutzer bei Bedarf an (ohne Pflicht zur Passwortänderung).</summary>
    public async Task<HttpClient> AlsAsync(string login, string rolle = "admin", string element = "")
    {
        var bd = Dienst<Benutzerdienst>();
        const string pw = "test-passwort";
        if (login != "admin" && bd.NachLogin(login) is null) bd.Anlegen(login, pw, rolle, element, login.ToUpperInvariant());
        var c = Client();
        var r = await c.PostAsJsonAsync("/api/app/anmelden", new { login, passwort = login == "admin" ? AdminPasswort : pw });
        Assert.Equal(HttpStatusCode.OK, r.StatusCode);
        return c;
    }

    public static async Task<JsonNode> JsonAsync(HttpResponseMessage r)
    {
        var text = await r.Content.ReadAsStringAsync();
        Assert.True(r.IsSuccessStatusCode, $"HTTP {(int)r.StatusCode}: {text}");
        return JsonNode.Parse(text)!;
    }

    public static async Task<JsonNode> HolenAsync(HttpClient c, string pfad) => await JsonAsync(await c.GetAsync(pfad));

    public async ValueTask DisposeAsync()
    {
        await _app.StopAsync();
        await _app.DisposeAsync();
        Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
        Testzusatz.Aufraeumen(_ordner);
        try { Directory.Delete(_ordner, true); } catch (IOException) { }
    }
}
