using System.Text.RegularExpressions;
using UntPlanMobile.Dienste;

namespace UntPlanMobile.Api;

/// <summary>
/// Durchreichung der Schulfunktionen an EduOrga Web: <c>/api/web/{pfad}</c> → <c>/api/app/{pfad}</c> (gleiche Pfade, Abfrage und
/// JSON-Inhalt unverändert, Antwort unverändert – auch PDF-Dateien). Erlaubt sind nur die Endpunkte der Liste <see cref="Regeln"/>,
/// je mit den zulässigen Methoden; alles andere (Administration, Anmeldung, Einrichtung …) antwortet mit 404. Die Rechte prüft
/// EduOrga Web, dessen Fehlermeldungen kommen als <c>{ ok: false, error }</c> an.
/// </summary>
public static class WebApi
{
    /// <summary>Erlaubter Endpunkt: Pfad (regulärer Ausdruck, ganzer Pfad) und Methoden.</summary>
    public sealed record Regel(string Muster, params string[] Methoden)
    {
        public Regex Ausdruck { get; } = new("^" + Muster + "$", RegexOptions.CultureInvariant);
    }

    private const string Id = @"\d{1,9}";

    /// <summary>Freigegebene Endpunkte von EduOrga Web (Vertrag der PWA, gleich den Funktionen der iOS-App).</summary>
    public static readonly Regel[] Regeln =
    {
        // Prüfungen, Vertretungsplan, Hausaufgaben
        new("pruefungen", "GET"),
        new("vertretungen", "GET"),
        new("hausaufgaben", "GET"),
        new("hausaufgaben/eintraege", "GET"),
        new("unterricht", "GET"),
        // Melden: Abwesenheit, Prüfung; Meine Meldungen mit Zurückziehen
        new("meldungen", "GET"),
        new("meldungen/abwesenheit", "POST"),
        new("meldungen/klausur", "POST"),
        new("meldungen/klausur/loeschen", "POST"),
        new(@"meldungen/[A-Za-z0-9_-]{1,64}", "DELETE"),
        new("abwesenheitsgruende", "GET"),
        // Raum- und Gerätebuchung
        new("buchen/optionen", "GET"),
        new("buchen/suche/raeume", "POST"),
        new("buchen/suche/ressourcen", "POST"),
        new("buchen", "POST"),
        new("buchen/liste", "GET"),
        new($"buchen/{Id}", "GET", "DELETE"),
        // Neuigkeiten und Infos der Schule
        new("infocenter", "GET"),
        new("infocenter/gelesen", "POST"),
        // Profil und Benachrichtigungen
        new("profil", "GET", "PUT"),
        new("mitteilungen/einstellungen", "GET", "PUT"),
        // Schüler*innen und Eltern
        new("familie/kinder", "GET"),
        new("familie/gruende", "GET"),
        new("familie/uebersicht", "GET"),
        new("familie/hausaufgaben", "GET"),
        new("familie/abwesenheiten", "GET"),
        new("familie/fehlzeiten", "GET"),
        new("familie/entschuldigung", "GET"),
        // Klassenbuch der Lehrkräfte
        new("klassenbuch/offene-stunden", "GET"),
        new("klassenbuch/offene-stunden/zeitbereich", "PUT"),
        new("klassenbucheintraege", "GET"),
        new("klassenbuch/vermerke", "GET", "POST"),
        new($"klassenbuch/vermerke/{Id}", "PUT", "DELETE"),
        new("klassenbuch/schueler", "GET"),
        new("klassendienste", "GET", "POST"),
        new($"klassendienste/{Id}", "DELETE"),
        new("befreiungen", "GET", "POST"),
        new($"befreiungen/{Id}", "PUT", "DELETE"),
        new("abwesenheiten/zeitraeume", "GET"),
        // Elternsprechtag (auch die PDF-Formulare)
        new("sprechtag", "GET"),
        new("sprechtag/start", "GET"),
        new($"sprechtag/{Id}/(lehrkraft|eltern|schueler)", "GET"),
        new($"sprechtag/{Id}/(plan|elternplan)\\.pdf", "GET"),
        new($"sprechtag/{Id}/(sperren|raum)", "PUT"),
        new($"sprechtag/{Id}/(einladungen|termine|buchen|warteliste|teilnahme/absagen|teilnahme/wiederaufnehmen)", "POST"),
        new($"sprechtag/{Id}/einladungen/{Id}", "DELETE"),
        new($"sprechtag/{Id}/termine/{Id}/absagen", "POST"),
        new($"sprechtag/{Id}/warteliste/{Id}", "DELETE"),
    };

    /// <summary>Ist der Aufruf freigegeben?</summary>
    public static bool Erlaubt(string methode, string pfad) =>
        !pfad.Contains("..") && Regeln.Any(r => r.Methoden.Contains(methode, StringComparer.OrdinalIgnoreCase) && r.Ausdruck.IsMatch(pfad));

    public static void Abbilden(WebApplication app)
    {
        app.MapMethods("/api/web/{**pfad}", new[] { "GET", "POST", "PUT", "DELETE" }, async (string? pfad, HttpContext c, UntPlanWebVerbindung web) =>
        {
            pfad = (pfad ?? "").Trim('/');
            if (!Erlaubt(c.Request.Method, pfad)) return Results.Json(new { ok = false, error = "Unbekannter Pfad." }, statusCode: 404);
            string? json = null;
            if (HttpMethods.IsPost(c.Request.Method) || HttpMethods.IsPut(c.Request.Method))
            {
                using var leser = new StreamReader(c.Request.Body);
                json = await leser.ReadToEndAsync(c.RequestAborted);
                if (json.Length == 0) json = "{}";
                // nur gültiges JSON weiterreichen
                System.Text.Json.Nodes.JsonNode.Parse(json);
            }
            var ziel = "api/app/" + pfad + c.Request.QueryString.Value;
            var (status, typ, name, inhalt) = await web.RohAsync(c, new HttpMethod(c.Request.Method), ziel, json);
            if (name != null)
            {
                var cd = new Microsoft.Net.Http.Headers.ContentDispositionHeaderValue("inline");
                cd.SetHttpFileName(name);
                c.Response.Headers.ContentDisposition = cd.ToString();
            }
            if (inhalt.Length == 0 && typ.StartsWith("application/octet-stream")) return Results.Json(new { ok = true }, statusCode: status);
            return Results.Bytes(inhalt, typ, enableRangeProcessing: false);
        });
    }
}
