using UntPlanStudio.Dienste;
using UntPlanStudio.Grundlagen;

namespace UntPlanStudio.Api;

/// <summary>
/// Versionsanzeige und Updatehinweis für Administratoren: <c>GET /api/version[?neu=1]</c> liefert die laufende Version und – falls
/// aktiviert – die neueste veröffentlichte Version (GitHub-Releases von florians25/EduOrga) mit Versionshinweisen.
/// Gleiche Prüflogik wie UntPlan Web und Mobile (eingebundene Datei <c>web/src/UntPlanWeb/Dienste/Updatepruefung.cs</c>),
/// Ergebnis 6 Stunden zwischengespeichert; Netzwerkfehler führen nur zu „kein Hinweis“.
/// Umgebungsvariablen: <c>STUDIO_UPDATE_PRUEFEN</c> (0 = aus), <c>STUDIO_UPDATE_URL</c>, <c>STUDIO_UPDATE_TAG_PRAEFIX</c>.
/// </summary>
public sealed class VersionApi : IStudioModul
{
    /// <summary>Update-Befehl auf dem Server (siehe installation/README.md).</summary>
    public const string Befehl = "./update.sh studio";

    public string Name => "version";

    public void DiensteRegistrieren(IServiceCollection dienste)
    {
        dienste.AddHttpClient("update", c => c.Timeout = TimeSpan.FromSeconds(15));
        dienste.AddSingleton(sp =>
        {
            var c = sp.GetRequiredService<IConfiguration>();
            return new Updatepruefung(sp.GetRequiredService<IHttpClientFactory>().CreateClient("update"), typeof(VersionApi).Assembly,
                c["STUDIO_UPDATE_URL"], Updatepruefung.Schalter(c["STUDIO_UPDATE_PRUEFEN"], true), c["STUDIO_UPDATE_TAG_PRAEFIX"]);
        });
    }

    public void EndpunkteRegistrieren(StudioRouten r)
    {
        r.Api.MapGet("/version", async (Updatepruefung p, string? neu, CancellationToken ct) =>
        {
            var s = await p.StandAsync(neu is "1" or "true", ct);
            return Results.Json(new
            {
                anwendung = Program.Anwendungsname,
                version = s.Version,
                pruefungAktiv = s.PruefungAktiv,
                neueste = s.Neueste,
                updateVerfuegbar = s.UpdateVerfuegbar,
                releaseUrl = s.Hinweisurl,
                releaseName = s.ReleaseName,
                veroeffentlicht = s.Veroeffentlicht,
                hinweise = s.Hinweise,
                geprueft = s.Geprueft,
                fehler = s.Fehler,
                befehl = Befehl,
            });
        }).RequireAuthorization(a => a.RequireRole(Rollen.Admin));
    }
}
