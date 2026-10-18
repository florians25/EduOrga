using UntPlanWeb.Daten;
using UntPlanWeb.Dienste;

namespace UntPlanWeb.Api;

/// <summary>
/// Darstellung der Stundenkarten (schulweit):
/// <list type="bullet">
/// <item><c>GET /api/app/darstellung</c> – für alle angemeldeten Konten (die Oberfläche erhält sie außerdem mit der Sitzung).</item>
/// <item><c>PUT /api/app/darstellung</c> – nur Administration; ungültige Werte ergeben 400.</item>
/// <item><c>DELETE /api/app/darstellung</c> – nur Administration: zurück zum Standard.</item>
/// </list>
/// Der Monitor zeigt keine Stundenkacheln (Tabelle) und braucht die Darstellung daher nicht.
/// </summary>
public static class DarstellungApi
{
    private static Benutzer Ich(HttpContext c) => c.Ich() ?? throw new NichtAngemeldetException();
    private static Benutzer Admin(HttpContext c) { var b = Ich(c); return b.IstAdmin ? b : throw new UnauthorizedAccessException("Nur für die Administration."); }

    public static void Abbilden(WebApplication app)
    {
        var g = app.MapGroup("/api/app/darstellung");
        g.MapGet("", (HttpContext c, Db db) => { Ich(c); return Results.Json(Kartendarstellungen.Laden(db)); });
        g.MapPut("", (Kartendarstellung d, HttpContext c, Db db, Protokoll prot) =>
        {
            var b = Admin(c);
            var neu = Kartendarstellungen.Speichern(db, d);
            prot.Schreiben(b.Login, "Darstellung der Stundenkarten geändert", $"Fachfarbe {neu.Fachfarbe}, Fläche {neu.Flaeche}, Rahmen {neu.Rahmen}, Dichte {neu.Dichte}");
            return Results.Json(neu);
        });
        g.MapDelete("", (HttpContext c, Db db, Protokoll prot) =>
        {
            var b = Admin(c);
            prot.Schreiben(b.Login, "Darstellung der Stundenkarten zurückgesetzt");
            return Results.Json(Kartendarstellungen.Zuruecksetzen(db));
        });
    }
}
