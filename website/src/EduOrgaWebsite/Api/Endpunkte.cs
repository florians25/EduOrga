using System.Security.Claims;
using EduOrgaWebsite.Daten;
using EduOrgaWebsite.Dienste;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;

namespace EduOrgaWebsite.Api;

public sealed record EinreichungAnfrage(
    string? Typ, string? Titel, string? Beschreibung, string? Modul, string? Email, bool Einwilligung,
    // Honigtopf: bleibt bei Menschen leer (unsichtbares Feld „Website“)
    string? Website,
    // Millisekunden zwischen Laden des Formulars und Absenden
    long? Bearbeitungsdauer);

public sealed record EinreichungAntwort(long? Nummer, string Meldung);

/// <summary>Öffentliche Sicht auf einen Eintrag – ohne E-Mail, interne Notizen, Priorität oder Schlagwörter.</summary>
public sealed record OeffentlicherEintrag(long Nummer, string Typ, string Titel, string Beschreibung, string Modul, string Status,
    string StatusText, string OeffentlicheAntwort, DateTimeOffset ErstelltAm, DateTimeOffset GeaendertAm);

public sealed record AdminEintrag(long Id, string Typ, string Titel, string Beschreibung, string Modul, string? Email, string Status,
    string Prioritaet, List<string> Tags, double Position, string InterneNotiz, string OeffentlicheAntwort, string Ablehnungsgrund,
    bool Oeffentlich, DateTimeOffset ErstelltAm, DateTimeOffset GeaendertAm, IReadOnlyList<string> Nachfolger)
{
    public static AdminEintrag Aus(Eintrag e) => new(e.Id, e.Typ, e.Titel, e.Beschreibung, e.Modul, e.Email, e.Status, e.Prioritaet,
        e.Tags, e.Position, e.InterneNotiz, e.OeffentlicheAntwort, e.Ablehnungsgrund, e.Oeffentlich, e.ErstelltAm, e.GeaendertAm,
        Daten.Status.Nachfolger(e.Status));
}

public sealed record AnmeldeAnfrage(string? Benutzer, string? Passwort);
public sealed record VerschiebeAnfrage(string? Status, int? Index, string? Begruendung);
public sealed record PasswortAnfrage(string? Bisher, string? Neu);

public static class Endpunkte
{
    public const string Schutzkopf = "X-EduOrga-Website";

    public static void Abbilden(WebApplication app)
    {
        var api = app.MapGroup("/api");
        api.MapGet("/gesundheit", () => Results.Ok(new { ok = true }));
        api.MapGet("/info", (WebsiteKonfiguration k) => Results.Ok(new
        {
            version = Program.Version,
            betreiber = new { name = k.BetreiberName, anschrift = k.BetreiberAnschrift, email = k.BetreiberEmail },
            emailAufbewahrungTage = k.EmailAufbewahrungTage,
        }));

        api.MapGet("/eintraege", (Eintraege e) => Results.Ok(e.Oeffentliche().Select(x => new OeffentlicherEintrag(
            x.Id, x.Typ, x.Titel, x.Beschreibung, x.Modul, x.Status, Status.Bezeichnung(x.Status), x.OeffentlicheAntwort, x.ErstelltAm, x.GeaendertAm))));

        api.MapPost("/einreichungen", Einreichen);

        var admin = api.MapGroup("/admin");
        admin.MapPost("/anmelden", Anmelden);
        admin.MapPost("/abmelden", async (HttpContext ctx) =>
        {
            await ctx.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Results.NoContent();
        });
        admin.MapGet("/ich", (HttpContext ctx) => ctx.User.Identity?.IsAuthenticated == true
            ? Results.Ok(new { benutzer = ctx.User.Identity.Name })
            : Results.Unauthorized());

        var geschuetzt = admin.MapGroup("").RequireAuthorization();
        geschuetzt.MapGet("/eintraege", (Eintraege e, string? suche, string? status, string? modul, string? typ, string? prioritaet, string? tag) =>
            Results.Ok(e.Liste(new Filter(suche, status, modul, typ, prioritaet, tag)).Select(AdminEintrag.Aus)));
        geschuetzt.MapGet("/eintraege/{id:long}", (Eintraege e, long id) =>
            e.Holen(id) is { } x ? Results.Ok(new { eintrag = AdminEintrag.Aus(x), verlauf = e.Verlauf(id) }) : Results.NotFound());
        geschuetzt.MapPatch("/eintraege/{id:long}", (Eintraege e, long id, Aenderung a, ClaimsPrincipal u) =>
            Results.Ok(AdminEintrag.Aus(e.Aendern(id, a, u.Identity!.Name!))));
        geschuetzt.MapPost("/eintraege/{id:long}/verschieben", (Eintraege e, long id, VerschiebeAnfrage a, ClaimsPrincipal u) =>
            Results.Ok(AdminEintrag.Aus(e.Verschieben(id, a.Status ?? "", a.Index, a.Begruendung, u.Identity!.Name!))));
        geschuetzt.MapDelete("/eintraege/{id:long}", (Eintraege e, long id) => { e.Loeschen(id); return Results.NoContent(); });
        geschuetzt.MapGet("/tags", (Eintraege e) => Results.Ok(e.AlleTags()));
        geschuetzt.MapPost("/passwort", (Benutzerdienst b, PasswortAnfrage a, ClaimsPrincipal u) =>
        {
            var name = u.Identity!.Name!;
            if (b.Anmelden(name, a.Bisher ?? "") is null) throw new Fachfehler("Das bisherige Passwort stimmt nicht.");
            b.Setzen(name, a.Neu ?? "", anlegen: false);
            return Results.NoContent();
        });
    }

    private static IResult Einreichen(EinreichungAnfrage a, HttpContext ctx, Eintraege eintraege, WebsiteKonfiguration k,
        [Microsoft.Extensions.DependencyInjection.FromKeyedServices("einreichung")] Ratenbegrenzung grenze, ILoggerFactory lf)
    {
        // Automaten: Honigtopf ausgefüllt oder Formular in Sekundenbruchteilen abgeschickt → freundlich antworten, nichts speichern
        if (!string.IsNullOrWhiteSpace(a.Website) || (k.Mindestbearbeitungszeit > TimeSpan.Zero && (a.Bearbeitungsdauer ?? 0) < k.Mindestbearbeitungszeit.TotalMilliseconds))
        {
            lf.CreateLogger("Einreichung").LogInformation("Einreichung als Spam verworfen.");
            return Results.Json(new EinreichungAntwort(null, "Vielen Dank für Ihre Einreichung."), statusCode: 201);
        }
        if (!a.Einwilligung) throw new Fachfehler("Bitte bestätigen Sie die Datenschutzhinweise.");
        var typ = Pruefen.Wert(a.Typ ?? "", Typen.Alle, "Typ");
        var modul = Pruefen.Wert(a.Modul ?? "", Module.Alle, "Modul");
        var titel = Pruefen.Titel(a.Titel ?? "");
        var beschreibung = Pruefen.Beschreibung(a.Beschreibung ?? "");
        var email = Pruefen.Email(a.Email);
        if (!grenze.Versuch(Absender(ctx)))
            return Results.Json(new { meldung = "Zu viele Einreichungen in kurzer Zeit. Bitte versuchen Sie es später erneut." }, statusCode: 429);
        var e = eintraege.Anlegen(typ, titel, beschreibung, modul, email);
        return Results.Json(new EinreichungAntwort(e.Id, $"Vielen Dank. Ihre Einreichung hat die Nummer #{e.Id}."), statusCode: 201);
    }

    private static async Task<IResult> Anmelden(AnmeldeAnfrage a, HttpContext ctx, Benutzerdienst b,
        [Microsoft.Extensions.DependencyInjection.FromKeyedServices("anmeldung")] Ratenbegrenzung grenze)
    {
        var schluessel = Absender(ctx);
        if (grenze.Gesperrt(schluessel))
            return Results.Json(new { meldung = "Zu viele Fehlversuche. Bitte warten Sie 15 Minuten." }, statusCode: 429);
        var name = b.Anmelden((a.Benutzer ?? "").Trim(), a.Passwort ?? "");
        if (name is null)
        {
            grenze.Versuch(schluessel);
            return Results.Json(new { meldung = "Benutzername oder Passwort ist falsch." }, statusCode: 401);
        }
        grenze.Zuruecksetzen(schluessel);
        var identitaet = new ClaimsIdentity([new Claim(ClaimTypes.Name, name)], CookieAuthenticationDefaults.AuthenticationScheme);
        await ctx.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identitaet),
            new AuthenticationProperties { IsPersistent = false });
        return Results.Ok(new { benutzer = name });
    }

    /// <summary>Absenderkennung für die Begrenzung (IP-Adresse; hinter dem Proxy aus X-Forwarded-For). Wird nur gehasht im Speicher gehalten.</summary>
    private static string Absender(HttpContext ctx) => ctx.Connection.RemoteIpAddress?.ToString() ?? "unbekannt";
}
