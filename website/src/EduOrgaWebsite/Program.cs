using System.Reflection;
using System.Text.Json;
using EduOrgaWebsite.Api;
using EduOrgaWebsite.Daten;
using EduOrgaWebsite.Dienste;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Logging.Abstractions;

namespace EduOrgaWebsite;

/// <summary>
/// EduOrga Website: Produktseiten (statische React-Oberfläche aus wwwroot) und Ideen-, Wunsch- und Fehlerportal mit Verwaltung.
/// </summary>
public partial class Program
{
    public const string PasswortBefehl = "--passwort-setzen";
    public const string AnlegenSchalter = "--anlegen";
    public const string SichernBefehl = "--sichern";

    public static string Version { get; } =
        typeof(Program).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion.Split('+')[0] ?? "1.0.0";

    public static int Main(string[] args)
    {
        if (args.Contains("--gesundheitspruefung")) return Gesundheitspruefung();
        if (args.Contains(PasswortBefehl)) return PasswortSetzen(args, KonfigurationLesen(), Directory.GetCurrentDirectory(), Console.In, Console.Out, Console.Error, !Console.IsInputRedirected);
        if (args.Contains(SichernBefehl)) return Sichern();
        Erstellen(args).Run();
        return 0;
    }

    public static WebApplication Erstellen(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);
        var s = builder.Services;
        s.AddSingleton(TimeProvider.System);
        s.AddSingleton(sp => WebsiteKonfiguration.Laden(sp.GetRequiredService<IConfiguration>(), sp.GetRequiredService<IWebHostEnvironment>().ContentRootPath));
        s.AddSingleton<Datenbank>();
        s.AddSingleton<Eintraege>();
        s.AddSingleton<Benutzerdienst>();
        s.AddKeyedSingleton("einreichung", (sp, _) =>
        {
            var k = sp.GetRequiredService<WebsiteKonfiguration>();
            return new Ratenbegrenzung(k.EinreichungenJeFenster, k.EinreichungsFenster, sp.GetRequiredService<TimeProvider>());
        });
        s.AddKeyedSingleton("anmeldung", (sp, _) => new Ratenbegrenzung(10, TimeSpan.FromMinutes(15), sp.GetRequiredService<TimeProvider>()));
        s.AddHostedService<Aufraeumdienst>();

        s.ConfigureHttpJsonOptions(o =>
        {
            o.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
            o.SerializerOptions.PropertyNameCaseInsensitive = true;
        });

        // Schlüssel für das Anmelde-Cookie im Datenordner (bleiben über Neustarts und Updates erhalten)
        s.AddDataProtection().SetApplicationName("EduOrgaWebsite");
        s.AddOptions<Microsoft.AspNetCore.DataProtection.KeyManagement.KeyManagementOptions>()
            .Configure<WebsiteKonfiguration>((o, k) =>
            {
                Directory.CreateDirectory(k.Schluesselordner);
                o.XmlRepository = new Microsoft.AspNetCore.DataProtection.Repositories.FileSystemXmlRepository(new DirectoryInfo(k.Schluesselordner), NullLoggerFactory.Instance);
            });

        // Cookie nur für die Verwaltung – öffentliche Seiten setzen keine Cookies
        s.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie();
        s.AddOptions<CookieAuthenticationOptions>(CookieAuthenticationDefaults.AuthenticationScheme)
            .Configure<WebsiteKonfiguration>((o, k) =>
            {
                o.Cookie.Name = "edo_verwaltung";
                o.Cookie.HttpOnly = true;
                o.Cookie.SameSite = SameSiteMode.Strict;
                o.Cookie.SecurePolicy = k.SichereCookies ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;
                o.Cookie.Path = "/";
                o.ExpireTimeSpan = TimeSpan.FromHours(8);
                o.SlidingExpiration = true;
                o.Events.OnRedirectToLogin = c => { c.Response.StatusCode = 401; return Task.CompletedTask; };
                o.Events.OnRedirectToAccessDenied = c => { c.Response.StatusCode = 403; return Task.CompletedTask; };
            });
        s.AddAuthorization();
        s.AddResponseCompression(o => o.EnableForHttps = true);

        var app = builder.Build();
        var konfiguration = app.Services.GetRequiredService<WebsiteKonfiguration>();
        app.Services.GetRequiredService<Datenbank>().Vorbereiten();
        app.Services.GetRequiredService<Benutzerdienst>().ErstenAdminSicherstellen(konfiguration);

        if (konfiguration.HinterProxy)
        {
            var fh = new ForwardedHeadersOptions { ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto, ForwardLimit = 1 };
            fh.KnownNetworks.Clear();
            fh.KnownProxies.Clear();
            app.UseForwardedHeaders(fh);
        }

        app.UseExceptionHandler(e => e.Run(async ctx =>
        {
            var fehler = ctx.Features.Get<IExceptionHandlerFeature>()?.Error;
            var (code, meldung) = fehler switch
            {
                Fachfehler f => (f.Code, f.Message),
                BadHttpRequestException b => (400, "Die Anfrage ist ungültig." + (b.InnerException is JsonException ? " (JSON)" : "")),
                _ => (500, "Interner Fehler."),
            };
            ctx.Response.StatusCode = code;
            await ctx.Response.WriteAsJsonAsync(new { meldung });
        }));

        // erwartete Fachfehler (Eingaben, Statusregeln) als Meldung zurückgeben, ohne Stacktrace im Protokoll
        app.Use(async (ctx, next) =>
        {
            try { await next(); }
            catch (Fachfehler f) when (!ctx.Response.HasStarted)
            {
                ctx.Response.StatusCode = f.Code;
                await ctx.Response.WriteAsJsonAsync(new { meldung = f.Message });
            }
        });

        app.Use(async (ctx, next) =>
        {
            var h = ctx.Response.Headers;
            h["X-Content-Type-Options"] = "nosniff";
            h["Referrer-Policy"] = "same-origin";
            h["X-Frame-Options"] = "DENY";
            h["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), interest-cohort=()";
            // nur eigene Quellen: keine externen Schriften, Skripte, Bilder oder Analysedienste
            h["Content-Security-Policy"] = "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
            // ändernde Anfragen der Verwaltung brauchen den eigenen Kopf (Schutz gegen Cross-Site-Anfragen)
            if (ctx.Request.Path.StartsWithSegments("/api/admin") && !HttpMethods.IsGet(ctx.Request.Method) && !ctx.Request.Headers.ContainsKey(Endpunkte.Schutzkopf))
            {
                ctx.Response.StatusCode = 403;
                await ctx.Response.WriteAsJsonAsync(new { meldung = "Anfrage ohne Schutzkopf abgelehnt." });
                return;
            }
            if (ctx.Request.Path.StartsWithSegments("/api")) h.CacheControl = "no-store";
            await next();
        });

        app.UseResponseCompression();
        app.UseDefaultFiles();
        app.UseStaticFiles(new StaticFileOptions
        {
            OnPrepareResponse = c =>
            {
                if (c.Context.Request.Path.StartsWithSegments("/assets"))
                    c.Context.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
            },
        });
        app.UseAuthentication();
        app.UseAuthorization();

        Endpunkte.Abbilden(app);
        app.MapFallback("/api/{**rest}", () => Results.NotFound(new { meldung = "Unbekannte Adresse." }));
        // Seitenadressen der Oberfläche (z. B. /module, /portal) liefern die index.html
        app.MapFallback(async ctx =>
        {
            var index = Path.Combine(app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot"), "index.html");
            if (!File.Exists(index))
            {
                ctx.Response.ContentType = "text/plain; charset=utf-8";
                await ctx.Response.WriteAsync("Die Oberfläche ist nicht gebaut: website/client mit „npm ci && npm run build“ bauen.");
                return;
            }
            ctx.Response.ContentType = "text/html; charset=utf-8";
            ctx.Response.Headers.CacheControl = "no-cache";
            await ctx.Response.SendFileAsync(index);
        });
        return app;
    }

    private static IConfiguration KonfigurationLesen() => new ConfigurationBuilder().SetBasePath(Directory.GetCurrentDirectory())
        .AddJsonFile("appsettings.json", optional: true).AddEnvironmentVariables().Build();

    private static int Gesundheitspruefung()
    {
        var port = Environment.GetEnvironmentVariable("ASPNETCORE_HTTP_PORTS")?.Split(';', ',')[0] ?? "8080";
        try
        {
            using var c = new HttpClient { Timeout = TimeSpan.FromSeconds(4) };
            return c.GetAsync($"http://127.0.0.1:{port}/api/gesundheit").Result.IsSuccessStatusCode ? 0 : 1;
        }
        catch (Exception) { return 1; }
    }

    private static int Sichern()
    {
        var k = WebsiteKonfiguration.Laden(KonfigurationLesen(), Directory.GetCurrentDirectory());
        if (!File.Exists(k.Datenbankpfad))
        {
            Console.Error.WriteLine($"Keine Datenbank unter {k.Datenbankpfad} – nichts zu sichern.");
            return 0;
        }
        try
        {
            Console.WriteLine("Datenbank gesichert: " + Datenbank.Sichern(k));
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("Sicherung fehlgeschlagen: " + ex.Message);
            return 1;
        }
        finally { SqliteConnection.ClearAllPools(); }
    }

    /// <summary>
    /// <c>dotnet EduOrgaWebsite.dll --passwort-setzen &lt;benutzer&gt; [--anlegen]</c>: Passwort eines Administrators setzen, ohne den
    /// Server zu starten (läuft auch neben dem laufenden Server). Passwort als eine Zeile über die Standardeingabe; an einem Terminal
    /// wird es zweimal verdeckt abgefragt. Ergebnis 0 = gesetzt, 1 = Fehler.
    /// </summary>
    public static int PasswortSetzen(string[] args, IConfiguration konfiguration, string inhaltsordner, TextReader ein, TextWriter aus, TextWriter fehler, bool terminal = false)
    {
        var i = Array.IndexOf(args, PasswortBefehl);
        var name = i >= 0 && i + 1 < args.Length && !args[i + 1].StartsWith("--") ? args[i + 1].Trim() : "";
        if (name.Length == 0)
        {
            fehler.WriteLine($"Aufruf: dotnet EduOrgaWebsite.dll {PasswortBefehl} <benutzer> [{AnlegenSchalter}]  (Passwort über die Standardeingabe)");
            return 1;
        }
        try
        {
            var k = WebsiteKonfiguration.Laden(konfiguration, inhaltsordner);
            var db = new Datenbank(k, TimeProvider.System);
            db.Vorbereiten();
            var benutzer = new Benutzerdienst(db, NullLogger<Benutzerdienst>.Instance);
            var vorhanden = benutzer.Vorhanden(name);
            if (!vorhanden && !args.Contains(AnlegenSchalter))
            {
                var alle = benutzer.Alle();
                fehler.WriteLine($"Den Benutzer „{name}“ gibt es nicht. Vorhanden: {(alle.Count == 0 ? "(keine)" : string.Join(", ", alle))}.");
                fehler.WriteLine($"Mit {AnlegenSchalter} wird „{name}“ als Administrator angelegt.");
                return 1;
            }
            var passwort = PasswortLesen(ein, fehler, terminal);
            if (passwort is null) return 1;
            benutzer.Setzen(name, passwort, anlegen: true);
            aus.WriteLine(vorhanden ? $"Passwort für „{name}“ gesetzt." : $"Administrator „{name}“ angelegt.");
            return 0;
        }
        catch (Fachfehler ex) { fehler.WriteLine("Fehler: " + ex.Message); return 1; }
        catch (Exception ex) when (ex is SqliteException or IOException or UnauthorizedAccessException)
        {
            fehler.WriteLine("Passwort konnte nicht gesetzt werden: " + ex.Message);
            return 1;
        }
        finally { SqliteConnection.ClearAllPools(); }
    }

    private static string? PasswortLesen(TextReader ein, TextWriter meldungen, bool terminal)
    {
        if (!terminal)
        {
            var zeile = ein.ReadLine();
            if (string.IsNullOrEmpty(zeile)) { meldungen.WriteLine("Kein Passwort erhalten (erwartet: eine Zeile über die Standardeingabe)."); return null; }
            return zeile;
        }
        var a = Verdeckt(meldungen, "Neues Passwort: ");
        var b = Verdeckt(meldungen, "Passwort wiederholen: ");
        if (a != b) { meldungen.WriteLine("Die Passwörter stimmen nicht überein."); return null; }
        return a.Length == 0 ? null : a;
    }

    private static string Verdeckt(TextWriter meldungen, string aufforderung)
    {
        meldungen.Write(aufforderung);
        var sb = new System.Text.StringBuilder();
        while (true)
        {
            var t = Console.ReadKey(intercept: true);
            if (t.Key == ConsoleKey.Enter) break;
            if (t.Key == ConsoleKey.Backspace) { if (sb.Length > 0) sb.Length--; }
            else if (!char.IsControl(t.KeyChar)) sb.Append(t.KeyChar);
        }
        meldungen.WriteLine();
        return sb.ToString();
    }
}

/// <summary>Löscht täglich E-Mail-Adressen abgeschlossener Einträge nach Ablauf der Aufbewahrungsfrist.</summary>
internal sealed class Aufraeumdienst(Eintraege eintraege, WebsiteKonfiguration k, ILogger<Aufraeumdienst> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        using var takt = new PeriodicTimer(TimeSpan.FromHours(24));
        do
        {
            try
            {
                var n = eintraege.AlteEmailsLoeschen(k.EmailAufbewahrungTage);
                if (n > 0) log.LogInformation("{N} E-Mail-Adressen abgeschlossener Einträge gelöscht.", n);
            }
            catch (Exception ex) when (ex is SqliteException or IOException) { log.LogWarning(ex, "Aufräumen fehlgeschlagen."); }
        } while (await takt.WaitForNextTickAsync(stop).ConfigureAwait(false));
    }
}
