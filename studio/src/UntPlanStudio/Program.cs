using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.Extensions.Options;
using UntPlanStudio.Api;
using UntPlanStudio.Dienste;
using UntPlanStudio.Grundlagen;

namespace UntPlanStudio;

/// <summary>
/// UntPlan Studio: Server der Planungsanwendung im Browser. Aufbau siehe ARCHITEKTUR.md.
/// </summary>
public partial class Program
{
    public const string Anwendungsname = "UntPlan Studio";
    /// <summary>Kopfzeile, die jede ändernde API-Anfrage tragen muss (Schutz gegen Cross-Site-Anfragen).</summary>
    public const string Schutzkopf = "X-UntPlan-Studio";

    public static int Main(string[] args)
    {
        // Gesundheitsprüfung für Docker (das Laufzeit-Image enthält weder curl noch wget)
        if (args.Contains("--gesundheitspruefung")) return Gesundheitspruefung();
        // Sicherung der Datenbank über die Kommandozeile (z. B. vor einem Update), siehe README „Sicherung“
        if (args.Contains(SichernBefehl)) return Sichern();
        Erstellen(args).Run();
        return 0;
    }

    public const string SichernBefehl = "--sichern";

    /// <summary>
    /// <c>dotnet UntPlanStudio.dll --sichern</c>: schreibt eine konsistente Kopie von <c>studio.db</c> nach
    /// <c>&lt;Datenordner&gt;/sicherungen/</c> und beendet sich (Datenordner aus STUDIO_DATEN wie beim Serverstart). Legt keine
    /// Datenbank an und migriert nichts; läuft auch, während der Server läuft.
    /// </summary>
    private static int Sichern()
    {
        var konfiguration = new ConfigurationBuilder().SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: true).AddEnvironmentVariables().Build();
        var k = StudioKonfiguration.Laden(konfiguration, Directory.GetCurrentDirectory());
        if (!File.Exists(k.Datenbankpfad))
        {
            Console.Error.WriteLine($"Keine Datenbank unter {k.Datenbankpfad} – nichts zu sichern (Studio noch nie gestartet oder STUDIO_DATEN falsch?).");
            return 0;
        }
        try
        {
            var s = StudioDatenbank.Sichern(k.Datenbankpfad, k.Sicherungsordner, k.SicherungenBehalten);
            Console.WriteLine($"Datenbank gesichert: {s.Pfad} ({s.Groesse:N0} Bytes)");
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("Sicherung fehlgeschlagen: " + ex.Message);
            return 1;
        }
    }

    private static int Gesundheitspruefung()
    {
        var port = Environment.GetEnvironmentVariable("ASPNETCORE_HTTP_PORTS")?.Split(';', ',')[0] ?? "8080";
        try
        {
            using var c = new HttpClient { Timeout = TimeSpan.FromSeconds(4) };
            return c.GetAsync($"http://127.0.0.1:{port}/gesundheit").Result.IsSuccessStatusCode ? 0 : 1;
        }
        catch (Exception) { return 1; }
    }

    /// <summary>Anwendung aufbauen. Die Konfiguration wird erst beim Start gelesen (damit Tests sie überschreiben können).</summary>
    public static WebApplication Erstellen(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);
        var dienste = builder.Services;

        dienste.AddSingleton(sp => StudioKonfiguration.Laden(sp.GetRequiredService<IConfiguration>(), sp.GetRequiredService<IWebHostEnvironment>().ContentRootPath));
        dienste.AddSingleton<StudioDatenbank>();
        dienste.AddHostedService<Sicherungsdienst>();
        dienste.AddSingleton<Benutzerdienst>();
        dienste.AddSingleton<Benutzereinstellungen>();
        dienste.AddSingleton<Dokumentdienst>();
        dienste.AddHostedService<Autospeicherung>();
        dienste.ConfigureHttpJsonOptions(o =>
        {
            o.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
            o.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.Never;
        });
        dienste.AddResponseCompression(o =>
        {
            o.EnableForHttps = true;
            o.Providers.Add<BrotliCompressionProvider>();
            o.Providers.Add<GzipCompressionProvider>();
            // ausdrücklich ohne text/event-stream (Ereignisse dürfen nicht gepuffert werden)
            o.MimeTypes = new[] { "application/json", "text/html", "text/css", "text/javascript", "application/javascript", "image/svg+xml" };
        });
        dienste.AddOptions<FormOptions>().Configure<StudioKonfiguration>((o, k) => o.MultipartBodyLengthLimit = k.MaxUploadMb * 1024L * 1024L);
        dienste.Configure<ForwardedHeadersOptions>(o =>
        {
            o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost;
            o.KnownNetworks.Clear();
            o.KnownProxies.Clear();
        });

        // Schlüssel für das Anmeldecookie im Datenordner (überstehen Neustarts und Container-Updates)
        dienste.AddDataProtection().SetApplicationName("UntPlanStudio");
        dienste.AddOptions<KeyManagementOptions>().Configure<StudioKonfiguration>((o, k) =>
            o.XmlRepository = new Microsoft.AspNetCore.DataProtection.Repositories.FileSystemXmlRepository(
                new DirectoryInfo(Path.Combine(k.Datenordner, "schluessel")), Microsoft.Extensions.Logging.Abstractions.NullLoggerFactory.Instance));

        dienste.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(o =>
        {
            o.Cookie.Name = "UntPlanStudio";
            o.Cookie.HttpOnly = true;
            o.Cookie.SameSite = SameSiteMode.Strict;
            o.ExpireTimeSpan = TimeSpan.FromHours(12);
            o.SlidingExpiration = true;
            // API: 401/403 statt Weiterleitung auf eine Anmeldeseite
            o.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = 401; return Task.CompletedTask; };
            o.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = 403; return Task.CompletedTask; };
        });
        dienste.AddOptions<CookieAuthenticationOptions>(CookieAuthenticationDefaults.AuthenticationScheme).Configure<StudioKonfiguration>((o, k) =>
            o.Cookie.SecurePolicy = k.SichereCookies switch { true => CookieSecurePolicy.Always, false => CookieSecurePolicy.None, _ => CookieSecurePolicy.SameAsRequest });
        dienste.AddAuthorization();

        foreach (var modul in Modulregister.Alle) modul.DiensteRegistrieren(dienste);

        var app = builder.Build();
        Konfigurieren(app);
        return app;
    }

    private static void Konfigurieren(WebApplication app)
    {
        // früh laden: Datenordner, Datenbank (Migrationen, Übernahme alter Dateien), Admin-Konto beim ersten Start
        app.Services.GetRequiredService<StudioDatenbank>();
        app.Services.GetRequiredService<Benutzerdienst>();

        app.UseForwardedHeaders();
        app.UseMiddleware<Fehlerbehandlung>();
        app.Use(async (ctx, weiter) =>
        {
            var h = ctx.Response.Headers;
            h["X-Content-Type-Options"] = "nosniff";
            h["Referrer-Policy"] = "same-origin";
            h["X-Frame-Options"] = "DENY";
            h["Content-Security-Policy"] = "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
            await weiter();
        });
        app.UseResponseCompression();
        app.UseDefaultFiles();
        app.UseStaticFiles(new StaticFileOptions
        {
            // Oberfläche aus studio/client (Vite): Dateien unter /assets/ tragen einen Inhalts-Hash im Namen und ändern sich nie;
            // alles andere (index.html, Schriften, Symbol) immer neu prüfen (ETag), damit Updates sofort ankommen
            OnPrepareResponse = c => c.Context.Response.Headers.CacheControl =
                c.Context.Request.Path.StartsWithSegments("/assets") ? "public, max-age=31536000, immutable" : "no-cache",
        });
        app.UseAuthentication();
        app.UseAuthorization();

        // Schutz für ändernde API-Anfragen: eigene Kopfzeile (Cross-Site-Formulare können sie nicht setzen) und Schreibrecht
        app.Use(async (ctx, weiter) =>
        {
            var r = ctx.Request;
            if (r.Path.StartsWithSegments("/api") && !HttpMethods.IsGet(r.Method) && !HttpMethods.IsHead(r.Method) && !HttpMethods.IsOptions(r.Method))
            {
                if (!r.Headers.ContainsKey(Schutzkopf))
                    throw new StudioFehler(400, $"Die Kopfzeile {Schutzkopf} fehlt.");
                if (ctx.User.Identity?.IsAuthenticated == true && !Rollen.DarfSchreiben(ctx.User) && !Leserpfad(r.Path))
                    throw StudioFehler.Verboten("Ihr Konto darf nur lesen.");
            }
            await weiter();
        });

        app.MapGet("/gesundheit", (StudioDatenbank db) => db.Erreichbar()
            ? Results.Ok(new { status = "ok", anwendung = Anwendungsname, datenbank = "ok" })
            : Results.Json(new { status = "fehler", anwendung = Anwendungsname, datenbank = "nicht erreichbar" }, statusCode: StatusCodes.Status503ServiceUnavailable));

        var offen = app.MapGroup("/api");
        var api = app.MapGroup("/api").RequireAuthorization();
        var dokument = api.MapGroup("/dokumente/{dok}");
        // jede Antwort eines Dokument-Endpunkts trägt den aktuellen Änderungsstand
        dokument.AddEndpointFilter(async (ctx, weiter) =>
        {
            var erg = await weiter(ctx);
            var id = ctx.HttpContext.Request.RouteValues["dok"] as string;
            if (!ctx.HttpContext.Response.HasStarted && Dokumentdienst.IdGueltig(id) && ctx.HttpContext.RequestServices.GetRequiredService<Dokumentdienst>().Offene.FirstOrDefault(d => d.Id == id) is { } a)
            {
                ctx.HttpContext.Response.Headers["X-Dokument-Version"] = a.Version.ToString();
                ctx.HttpContext.Response.Headers["X-Dokument-Bereich"] = a.LetzterBereich;
            }
            return erg;
        });
        var routen = new StudioRouten(offen, api, dokument);
        foreach (var modul in Modulregister.Alle) modul.EndpunkteRegistrieren(routen);
        app.MapGet("/api/module", () => Modulregister.Alle.Select(m => m.Name)).RequireAuthorization();
        // Datenbanksicherungen (nur Administratoren): Liste und sofort sichern
        var sicherungen = api.MapGroup("/sicherungen").RequireAuthorization(p => p.RequireRole(Rollen.Admin));
        sicherungen.MapGet("", (StudioDatenbank db) => db.Sicherungen().Select(s => new { s.Datei, s.Groesse, s.Zeit }));
        sicherungen.MapPost("", (StudioDatenbank db) => { var s = db.Sichern(); return new { s.Datei, s.Groesse, s.Zeit }; });
        // Adressen der Oberfläche (z. B. /stundenplan?typ=klasse) liefern die Startseite; das Routing übernimmt der Browser
        app.MapFallbackToFile("index.html", new StaticFileOptions { OnPrepareResponse = c => c.Context.Response.Headers.CacheControl = "no-cache" });
    }

    /// <summary>Ändernde Anfragen, die auch Nur-Lesen-Konten stellen dürfen (Abmelden, eigenes Passwort, eigene Einstellungen).</summary>
    private static bool Leserpfad(PathString p) =>
        p.StartsWithSegments("/api/abmeldung") || p.StartsWithSegments("/api/anmeldung") || p.StartsWithSegments("/api/ich") || p.StartsWithSegments("/api/einstellungen");
}
