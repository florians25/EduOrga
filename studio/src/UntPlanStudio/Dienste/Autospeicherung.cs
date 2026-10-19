using UntPlanStudio.Grundlagen;

namespace UntPlanStudio.Dienste;

/// <summary>
/// Hintergrunddienst (Sicherheitsnetz zum sofortigen Speichern im <see cref="Dokumentdienst"/>): speichert regelmäßig alle noch
/// geänderten Arbeitsdokumente (z. B. nach einem Datenbankausfall oder bei Änderungen ohne Meldung) und entfernt lange nicht
/// benutzte Dokumente aus dem Speicher. Beim Herunterfahren wird alles gespeichert (laufende Speichervorgänge werden abgewartet).
/// </summary>
public sealed class Autospeicherung : BackgroundService
{
    private readonly Dokumentdienst _dokumente;
    private readonly StudioKonfiguration _k;

    public Autospeicherung(Dokumentdienst dokumente, StudioKonfiguration k)
    {
        _dokumente = dokumente;
        _k = k;
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        using var takt = new PeriodicTimer(TimeSpan.FromSeconds(Math.Max(1, _k.AutospeichernSekunden)));
        try
        {
            while (await takt.WaitForNextTickAsync(ct))
            {
                await _dokumente.AlleSpeichernAsync(TimeSpan.FromSeconds(2), ct);
                await _dokumente.AufraeumenAsync(TimeSpan.FromMinutes(_k.LeerlaufMinuten));
            }
        }
        catch (OperationCanceledException) { }
    }

    public override async Task StopAsync(CancellationToken ct)
    {
        await base.StopAsync(ct);
        await _dokumente.BeendenAsync();
    }
}
