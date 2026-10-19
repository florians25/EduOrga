using System.Reflection;
using EduOrgaWebsite.Dienste;

namespace EduOrgaWebsite;

/// <summary>
/// EduOrga Website: liefert die statische Produkt-Website (React-Build in wwwroot) aus. Dazu nur zwei kleine Adressen:
/// <c>/api/gesundheit</c> für den Docker-Healthcheck und <c>/api/info</c> mit den Betreiberangaben für Impressum und Datenschutz.
/// Keine Datenbank, keine Cookies, keine Anmeldung – Ideen und Fehler laufen über GitHub (Issues, Discussions).
/// </summary>
public partial class Program
{
    public static string Version { get; } =
        typeof(Program).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion.Split('+')[0] ?? "1.0.0";

    public static int Main(string[] args)
    {
        if (args.Contains("--gesundheitspruefung")) return Gesundheitspruefung();
        Erstellen(args).Run();
        return 0;
    }

    public static WebApplication Erstellen(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);
        builder.Services.AddSingleton(sp => WebsiteKonfiguration.Laden(sp.GetRequiredService<IConfiguration>()));
        builder.Services.AddResponseCompression(o => o.EnableForHttps = true);

        var app = builder.Build();

        app.Use(async (ctx, next) =>
        {
            var h = ctx.Response.Headers;
            h["X-Content-Type-Options"] = "nosniff";
            h["Referrer-Policy"] = "same-origin";
            h["X-Frame-Options"] = "DENY";
            h["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), interest-cohort=()";
            // nur eigene Quellen: keine externen Schriften, Skripte, Bilder oder Analysedienste
            h["Content-Security-Policy"] = "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
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

        var api = app.MapGroup("/api");
        api.MapGet("/gesundheit", () => Results.Ok(new { ok = true }));
        api.MapGet("/info", (WebsiteKonfiguration k) => Results.Ok(new
        {
            version = Version,
            betreiber = new { name = k.BetreiberName, anschrift = k.BetreiberAnschrift, email = k.BetreiberEmail },
        }));
        app.MapFallback("/api/{**rest}", () => Results.NotFound(new { meldung = "Unbekannte Adresse." }));

        // Seitenadressen der Oberfläche (z. B. /studio, /installation) liefern die index.html
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
}
