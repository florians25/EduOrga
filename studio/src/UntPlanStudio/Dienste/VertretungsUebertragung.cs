using System.Collections.Concurrent;
using UntPlan.Core;

namespace UntPlanStudio.Dienste;

/// <summary>
/// Automatische Übertragung der Vertretungen an EduOrga Web („Vertretungen automatisch übertragen“ in den Einstellungen für
/// UntPlan Web, je Dokument): Nach einer Änderung der Vertretungsplanung (Änderungsart <c>Vertretung</c>, auch Rückgängig/Wiederholen
/// = <c>Alles</c>) wird spätestens nach <see cref="UpwDirekt.Sekunden"/> das Vertretungspaket gesendet
/// (<see cref="UntPlanWebDienst.VertretungenSendenAsync"/>). Weitere Änderungen in dieser Zeit gehen in dasselbe Paket; Änderungen
/// während einer Übertragung lösen danach eine weitere aus. Fehlgeschlagene Übertragungen werden mit wachsendem Abstand
/// (1, 2, 4 … höchstens 15 Minuten) wiederholt, solange die Einstellung eingeschaltet ist.
/// </summary>
public sealed class VertretungsUebertragung : IHostedService
{
    private sealed class Plan
    {
        public bool Wartet;
        public bool Laeuft;
        public bool Erneut;
        public DateTime? Faellig;
        public int Fehler;
        /// <summary>Zählt Vormerkungen; eine wartende Übertragung läuft nur, wenn sie noch die aktuelle ist (früher vorziehen).</summary>
        public long Nummer;
    }

    private readonly Dokumentdienst _dok;
    private readonly UntPlanWebDienst _upw;
    private readonly ILogger<VertretungsUebertragung> _log;
    private readonly ConcurrentDictionary<string, Plan> _plaene = new();
    private readonly CancellationTokenSource _ende = new();

    public VertretungsUebertragung(Dokumentdienst dok, UntPlanWebDienst upw, ILogger<VertretungsUebertragung> log)
    {
        _dok = dok;
        _upw = upw;
        _log = log;
    }

    public Task StartAsync(CancellationToken ct)
    {
        _dok.Geaendert += BeiAenderung;
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken ct)
    {
        _dok.Geaendert -= BeiAenderung;
        _ende.Cancel();
        return Task.CompletedTask;
    }

    /// <summary>Zeitpunkt der vorgemerkten automatischen Übertragung (null = keine vorgemerkt).</summary>
    public DateTime? Faellig(string dokId) => _plaene.TryGetValue(dokId, out var p) ? p.Faellig : null;

    /// <summary>Läuft gerade eine automatische Übertragung?</summary>
    public bool Laeuft(string dokId) => _plaene.TryGetValue(dokId, out var p) && p.Laeuft;

    private static bool Betrifft(AenderungsArt art) => art is AenderungsArt.Vertretung or AenderungsArt.Alles;

    private void BeiAenderung(Arbeitsdokument a, AenderungsArt art, string benutzer)
    {
        if (!Betrifft(art) || _ende.IsCancellationRequested) return;
        var e = _upw.Direkt(a.Id);
        if (!e.Automatisch) return;
        var plan = _plaene.GetOrAdd(a.Id, _ => new Plan());
        var warten = TimeSpan.FromSeconds(Math.Clamp(e.Sekunden, 5, 600));
        lock (plan)
        {
            plan.Fehler = 0;
            if (plan.Laeuft) { plan.Erneut = true; return; }
            // schon vorgemerkt – höchstens „warten“ nach dieser Änderung (eine längere Wartezeit nach einem Fehler wird vorgezogen)
            if (plan.Wartet && plan.Faellig <= DateTime.Now + warten) return;
            plan.Wartet = false;
        }
        Vormerken(a, plan, warten);
    }

    private void Vormerken(Arbeitsdokument a, Plan plan, TimeSpan warten)
    {
        long nummer;
        lock (plan)
        {
            if (plan.Wartet) return;
            plan.Wartet = true;
            plan.Faellig = DateTime.Now + warten;
            nummer = ++plan.Nummer;
        }
        var ct = _ende.Token;
        _ = Task.Run(async () =>
        {
            try { await Task.Delay(warten, ct); }
            catch (OperationCanceledException) { return; }
            lock (plan)
                if (plan.Nummer != nummer || !plan.Wartet) return; // inzwischen neu vorgemerkt
            await AusfuehrenAsync(a, plan, ct);
        });
    }

    private async Task AusfuehrenAsync(Arbeitsdokument a, Plan plan, CancellationToken ct)
    {
        lock (plan)
        {
            plan.Wartet = false;
            plan.Faellig = null;
            plan.Laeuft = true;
            plan.Erneut = false;
        }
        var nochmal = TimeSpan.Zero;
        try
        {
            var e = _upw.Direkt(a.Id);
            if (!e.Automatisch || !_dok.Offene.Contains(a)) return;
            if (_upw.Laufend(a.Id) is not null)
            {
                nochmal = TimeSpan.FromSeconds(5); // eine andere Übertragung läuft: kurz danach
                return;
            }
            UpwUebertragung erg;
            try { erg = await _upw.VertretungenSendenAsync(a, UntPlanWebDienst.AutomatischBenutzer, automatisch: true, ct); }
            catch (Grundlagen.StudioFehler) { nochmal = TimeSpan.FromSeconds(5); return; } // gerade gestartet (Wettlauf mit „Jetzt senden“)
            if (erg.Ok) lock (plan) plan.Fehler = 0;
            else
            {
                int fehler;
                lock (plan) fehler = ++plan.Fehler;
                // ohne eingerichtete Verbindung nicht wiederholen (erst nach der nächsten Änderung)
                var eingerichtet = await a.LesenAsync(d => !string.IsNullOrWhiteSpace(d.Daten.Einstellungen.Portal.Adresse), ct);
                if (eingerichtet) nochmal = TimeSpan.FromMinutes(Math.Min(15, Math.Pow(2, Math.Min(fehler - 1, 4))));
            }
        }
        catch (OperationCanceledException) { return; }
        catch (Exception ex) { _log.LogWarning(ex, "Automatische Übertragung der Vertretungen von {Id} fehlgeschlagen", a.Id); }
        finally
        {
            bool erneut;
            lock (plan)
            {
                plan.Laeuft = false;
                erneut = plan.Erneut;
                plan.Erneut = false;
            }
            if (!ct.IsCancellationRequested)
            {
                if (erneut && nochmal == TimeSpan.Zero) nochmal = TimeSpan.FromSeconds(Math.Clamp(_upw.Direkt(a.Id).Sekunden, 5, 600));
                if (nochmal > TimeSpan.Zero) Vormerken(a, plan, nochmal);
            }
        }
    }
}
