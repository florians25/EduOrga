using UntPlanWeb.Dienste;

namespace UntPlanWeb.Api;

/// <summary>
/// Abwesenheitsmeldungen („Eltern melden → Klassenleitung bestätigt“):
/// <list type="bullet">
/// <item><c>GET /api/app/familie/meldungen?schueler=</c>, <c>POST /api/app/familie/meldungen</c> { schueler, von, bis, grund, text },
/// <c>DELETE /api/app/familie/meldungen/{id}</c> (zurückziehen, solange nicht bearbeitet) – Eltern- und Schülerkonten, nur zugeordnete Kinder.</item>
/// <item><c>GET /api/app/abwesenheiten/meldungen?status=&amp;klasse=</c> – Klassenleitung (eigene Klassen), Recht „Abwesenheiten aller Klassen“.</item>
/// <item><c>POST /api/app/abwesenheiten/meldungen/{id}/bestaetigen</c> { entschuldigt, antwort } – trägt die Abwesenheit ganztägig ein;
/// <c>POST …/{id}/ablehnen</c> { antwort }.</item>
/// </list>
/// </summary>
public static class AbwesenheitsmeldungApi
{
    public sealed record MeldungDaten(int? Schueler, DateOnly Von, DateOnly? Bis, string? Grund, string? Text);
    public sealed record BearbeitungDaten(bool Entschuldigt = false, string? Antwort = null);

    private static Benutzer Ich(HttpContext c) => c.Ich() ?? throw new NichtAngemeldetException();
    private static Stand Paket(Paketdienst p) => p.Aktuell ?? throw new ArgumentException("Es wurden noch keine Daten aus EduOrga Studio übertragen.");

    public static void Abbilden(WebApplication app)
    {
        var api = app.MapGroup("/api/app");

        api.MapGet("/familie/meldungen", (int? schueler, HttpContext c, Paketdienst p, Abwesenheitsmeldungen m) =>
        {
            var (b, s, kind) = FamilieApi.Kind(c, p, schueler);
            return Results.Json(new { schueler = kind, meldungen = m.Eigene(b, s, kind.Id) });
        });
        api.MapPost("/familie/meldungen", (MeldungDaten d, HttpContext c, Paketdienst p, Abwesenheitsmeldungen m) =>
        {
            var (b, s, kind) = FamilieApi.Kind(c, p, d.Schueler);
            return Results.Json(m.Melden(b, s, kind.Id, d.Von, d.Bis ?? d.Von, d.Grund, d.Text));
        });
        api.MapDelete("/familie/meldungen/{id:int}", (int id, HttpContext c, Paketdienst p, Abwesenheitsmeldungen m) =>
        {
            m.Zurueckziehen(Ich(c), p.Aktuell, id);
            return Results.Json(new { ok = true });
        });

        api.MapGet("/abwesenheiten/meldungen", (string? status, string? klasse, HttpContext c, Paketdienst p, Abwesenheitsmeldungen m) =>
            Results.Json(m.Liste(Ich(c), Paket(p), status, klasse)));
        api.MapPost("/abwesenheiten/meldungen/{id:int}/bestaetigen", (int id, BearbeitungDaten d, HttpContext c, Paketdienst p, Abwesenheitsmeldungen m) =>
        {
            var (meldung, stunden) = m.Bestaetigen(Ich(c), Paket(p), id, d.Entschuldigt, d.Antwort);
            return Results.Json(new { meldung, stunden });
        });
        api.MapPost("/abwesenheiten/meldungen/{id:int}/ablehnen", (int id, BearbeitungDaten d, HttpContext c, Paketdienst p, Abwesenheitsmeldungen m) =>
            Results.Json(m.Ablehnen(Ich(c), Paket(p), id, d.Antwort)));
    }
}
