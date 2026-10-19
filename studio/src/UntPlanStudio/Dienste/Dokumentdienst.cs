using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using UntPlan.Core;
using UntPlan.Core.Austausch;
using UntPlan.Core.Model;
using UntPlan.Core.Optimierung;
using UntPlanStudio.Grundlagen;

namespace UntPlanStudio.Dienste;

/// <summary>Eintrag der Dokumentliste (Datei → Öffnen).</summary>
public sealed record DokumentEintrag(string Id, string Name, string Besitzer, DateTime Erstellt, DateTime Geaendert, string Herkunft, long Groesse, bool Offen, bool Ungespeichert);

/// <summary>
/// Verwaltet die Arbeitsdokumente des Servers: Ablage in der Datenbank (Tabelle <c>dokumente</c>: Inhalt der Schuldatei wie eine
/// *.up-Datei + Name/Besitzer, ältere Fassungen in <c>dokument_sicherungen</c>),
/// geöffnete Dokumente im Speicher, Neu/Hochladen/BAL-Import/Löschen.
/// <para><b>Sofortiges Speichern:</b> Jede Änderung (auch Rückgängig/Wiederholen) meldet das <see cref="Arbeitsdokument"/> hierher;
/// nach <see cref="StudioKonfiguration.SpeichernVerzoegerungMs"/> (Standard 0,8 s) wird der Stand in einer Transaktion in die
/// Datenbank geschrieben – Änderungen in dieser Zeit werden zu einem Schreibvorgang zusammengefasst. Schlägt das Schreiben fehl, wird
/// mit wachsendem Abstand (2, 4, 8 … höchstens 60 s) erneut versucht; zusätzlich prüft die <see cref="Autospeicherung"/> regelmäßig
/// und speichert beim Herunterfahren alles. Ältere Fassungen entstehen höchstens alle <see cref="StudioKonfiguration.FassungMinuten"/>
/// Minuten bzw. als ausdrücklicher Sicherungspunkt (<see cref="SicherungspunktAsync"/>).</para>
/// </summary>
public sealed partial class Dokumentdienst
{
    private readonly StudioDatenbank _db;
    private readonly StudioKonfiguration _k;
    private readonly ILogger<Dokumentdienst> _log;
    private readonly ConcurrentDictionary<string, Lazy<Arbeitsdokument>> _offen = new();
    private readonly ConcurrentDictionary<string, byte> _vorgemerkt = new();
    private volatile bool _beendet;

    public Dokumentdienst(StudioDatenbank db, StudioKonfiguration k, ILogger<Dokumentdienst> log)
    {
        _db = db;
        _k = k;
        _log = log;
    }

    /// <summary>Nach jeder Änderung eines geöffneten Dokuments (Dokument, Änderungsart, Benutzer) – z. B. für die direkte Übertragung an EduOrga Web.</summary>
    public event Action<Arbeitsdokument, AenderungsArt, string>? Geaendert;

    private void BeiAenderung(Arbeitsdokument a, AenderungsArt art, string benutzer)
    {
        Vormerken(a);
        var h = Geaendert;
        if (h is null) return;
        foreach (var f in h.GetInvocationList().Cast<Action<Arbeitsdokument, AenderungsArt, string>>())
            try { f(a, art, benutzer); }
            catch (Exception ex) { _log.LogWarning(ex, "Fehler bei der Änderungsmeldung für {Id}", a.Id); }
    }

    /// <summary>Wartezeit vor dem nächsten Versuch nach <paramref name="fehlversuche"/> Fehlschlägen: 2, 4, 8 … höchstens 60 Sekunden.</summary>
    public static TimeSpan Wiederholabstand(int fehlversuche) => TimeSpan.FromSeconds(Math.Min(60, Math.Pow(2, Math.Clamp(fehlversuche, 1, 6))));

    /// <summary>
    /// Speichern vormerken: nach der Verzögerung wird gespeichert. Ist schon ein Speichern vorgemerkt, gehört die Änderung dazu
    /// (zusammengefasst). Die Vormerkung endet, bevor gespeichert wird – Änderungen während des Schreibens werden neu vorgemerkt.
    /// </summary>
    internal void Vormerken(Arbeitsdokument a, TimeSpan? verzoegerung = null)
    {
        if (_beendet || !_vorgemerkt.TryAdd(a.Id, 0)) return;
        var warten = verzoegerung ?? TimeSpan.FromMilliseconds(Math.Max(0, _k.SpeichernVerzoegerungMs));
        _ = Task.Run(async () =>
        {
            try { await Task.Delay(warten); }
            finally { _vorgemerkt.TryRemove(a.Id, out _); }
            if (_beendet || !_offen.TryGetValue(a.Id, out var l) || !l.IsValueCreated || !ReferenceEquals(l.Value, a)) return;
            try { await a.SpeichernAsync("Autospeicherung"); }
            catch (Exception ex)
            {
                _log.LogError(ex, "Speichern von {Id} ({Name}) fehlgeschlagen – neuer Versuch in {Sekunden} s", a.Id, a.Info.Name, Wiederholabstand(a.Fehlversuche).TotalSeconds);
                Vormerken(a, Wiederholabstand(a.Fehlversuche));
            }
        });
    }

    /// <summary>Gibt es ein vorgemerktes (noch nicht begonnenes) Speichern?</summary>
    public bool IstVorgemerkt(string id) => _vorgemerkt.ContainsKey(id);

    [GeneratedRegex("^[a-f0-9]{16}$")]
    private static partial Regex IdMuster();

    public static bool IdGueltig(string? id) => id is not null && IdMuster().IsMatch(id);

    public IEnumerable<Arbeitsdokument> Offene => _offen.Values.Where(l => l.IsValueCreated).Select(l => l.Value);

    /// <summary>Alle Dokumente der Datenbank (neueste zuerst).</summary>
    public List<DokumentEintrag> Liste()
    {
        var res = new List<DokumentEintrag>();
        foreach (var (info, groesse, _) in _db.Dokumente())
        {
            var offen = _offen.TryGetValue(info.Id, out var l) && l.IsValueCreated ? l.Value : null;
            res.Add(new DokumentEintrag(info.Id, offen?.Info.Name ?? info.Name, info.Besitzer, info.Erstellt, offen?.Info.Geaendert ?? info.Geaendert, info.Herkunft,
                groesse, offen != null, offen?.IstGeaendert ?? false));
        }
        return res.OrderByDescending(e => e.Geaendert).ToList();
    }

    public bool Existiert(string id) => IdGueltig(id) && _db.DokumentExistiert(id);

    /// <summary>Geöffnetes Dokument holen bzw. aus der Datenbank laden.</summary>
    public Arbeitsdokument Holen(string? id)
    {
        if (!IdGueltig(id) || !_offen.ContainsKey(id!) && !_db.DokumentExistiert(id!)) throw StudioFehler.NichtGefunden("Das Dokument");
        var lazy = _offen.GetOrAdd(id!, i => new Lazy<Arbeitsdokument>(() => Laden(i), LazyThreadSafetyMode.ExecutionAndPublication));
        try
        {
            var dok = lazy.Value;
            dok.Beruehrt();
            return dok;
        }
        catch
        {
            _offen.TryRemove(id!, out _);
            throw;
        }
    }

    private Arbeitsdokument Laden(string id)
    {
        var info = _db.Dokument(id)?.Info ?? throw StudioFehler.NichtGefunden("Das Dokument");
        var inhalt = _db.DokumentInhalt(id) ?? throw StudioFehler.NichtGefunden("Das Dokument");
        var dok = Dokument.Laden(inhalt);
        _log.LogInformation("Dokument {Id} ({Name}) geöffnet", id, info.Name);
        return new Arbeitsdokument(info, dok, Speichern, BeiAenderung);
    }

    /// <summary>Beschreibung und Inhalt eines geöffneten Dokuments in die Datenbank schreiben (eine Transaktion).</summary>
    private void Speichern(Arbeitsdokument a, byte[] inhalt, bool sicherungspunkt, string benutzer)
    {
        var regel = new Fassungsregel(TimeSpan.FromMinutes(Math.Max(1, _k.FassungMinuten)), sicherungspunkt, benutzer);
        if (!_db.DokumentSpeichern(a.Info, inhalt, regel))
            _log.LogWarning("Dokument {Id} ({Name}) gibt es nicht mehr (gelöscht) – nicht gespeichert", a.Id, a.Info.Name);
    }

    /// <summary>Speichert sofort und legt den aktuellen Stand als Sicherungspunkt ab (ältere Fassung, die nicht automatisch verdrängt wird).</summary>
    public Task SicherungspunktAsync(Arbeitsdokument a, string benutzer) => a.SpeichernAsync(benutzer, immer: true, sicherungspunkt: true);

    private static string NeueId() => Convert.ToHexString(RandomNumberGenerator.GetBytes(8)).ToLowerInvariant();

    /// <summary>Legt ein neues Arbeitsdokument aus einer Schuldatei an (sofort gespeichert und geöffnet).</summary>
    public Arbeitsdokument Anlegen(Schuldatei daten, string name, string besitzer, string herkunft)
    {
        var id = NeueId();
        var info = new DokumentInfo { Id = id, Name = string.IsNullOrWhiteSpace(name) ? "Neue Schuldatei" : name.Trim(), Besitzer = besitzer, Herkunft = herkunft };
        var dok = new Dokument(daten);
        dok.Speichern(inhalt => _db.DokumentAnlegen(info, inhalt));
        var a = new Arbeitsdokument(info, dok, Speichern, BeiAenderung);
        _offen[id] = new Lazy<Arbeitsdokument>(a);
        _log.LogInformation("Dokument {Id} ({Name}) angelegt: {Herkunft}", id, info.Name, herkunft);
        return a;
    }

    /// <summary>Neue leere Schuldatei (wie Desktop „Neu…“).</summary>
    public Arbeitsdokument Neu(string schulname, string schulform, string besitzer) =>
        Anlegen(Demo.NeueDatei(string.IsNullOrWhiteSpace(schulname) ? "Neue Schule" : schulname.Trim(), string.IsNullOrWhiteSpace(schulform) ? "GY" : schulform.Trim()),
            string.IsNullOrWhiteSpace(schulname) ? "Neue Schuldatei" : schulname, besitzer, "neu");

    /// <summary>Beispielschule mit verplantem Stundenplan (Optimierung mit festem Startwert).</summary>
    public Arbeitsdokument Beispiel(string besitzer)
    {
        var d = Demo.Beispielschule();
        var erg = Optimierer.Optimieren(d, new OptimierungsOptionen { AnzahlPlaene = 1, Schritte = 1, Seed = 1 });
        if (erg.Count > 0) d.AktivePeriode.Plan = erg[0].Plan;
        return Anlegen(d, d.Einstellungen.Schulname, besitzer, "beispiel");
    }

    /// <summary>Hochgeladene Datei übernehmen: Schuldatei (*.up, *.untplan) oder BAL-Datei (wird in eine neue Schuldatei importiert).</summary>
    public (Arbeitsdokument Dokument, ImportBericht? Bericht) Hochladen(byte[] inhalt, string dateiname, string besitzer)
    {
        if (inhalt.Length == 0) throw StudioFehler.Ungueltig("Die Datei ist leer.");
        var name = Path.GetFileNameWithoutExtension(Path.GetFileName(dateiname ?? "Datei"));
        var text = Text(inhalt);
        if (text.TrimStart().StartsWith('{'))
        {
            Schuldatei daten;
            try { daten = JsonSerializer.Deserialize<Schuldatei>(text, Dokument.JsonOptionen) ?? throw new InvalidDataException("Leere Datei"); }
            catch (JsonException ex) { throw StudioFehler.Ungueltig("Die Datei ist keine gültige UntPlan-Schuldatei: " + ex.Message); }
            if (daten.Version > Schuldatei.AktuelleVersion) throw StudioFehler.Ungueltig("Die Datei wurde mit einer neueren UntPlan-Version erstellt.");
            return (Anlegen(daten, name, besitzer, "hochgeladen: " + Path.GetFileName(dateiname)), null);
        }
        if (BalImport.IstBal(text))
        {
            var d = Demo.NeueDatei(name, "GY");
            // „Neu“ + „BAL-Import“ (das Normalisieren übernimmt das neue Dokument)
            var bericht = BalImport.Importieren(d, text);
            var schulname = string.IsNullOrWhiteSpace(d.Einstellungen.Schulname) ? name : d.Einstellungen.Schulname;
            return (Anlegen(d, schulname, besitzer, "BAL: " + Path.GetFileName(dateiname)), bericht);
        }
        throw StudioFehler.Ungueltig("Unbekanntes Dateiformat. Erwartet wird eine UntPlan-Schuldatei (*.up) oder eine BAL-Datei.");
    }

    /// <summary>Text einer hochgeladenen Datei: UTF-8, sonst Latin-1 (wie <see cref="BalImport.DateiLesen"/>).</summary>
    public static string Text(byte[] inhalt)
    {
        try { return new UTF8Encoding(false, true).GetString(inhalt).TrimStart('﻿'); }
        catch (DecoderFallbackException) { return Encoding.Latin1.GetString(inhalt); }
    }

    public void Umbenennen(string id, string name)
    {
        if (string.IsNullOrWhiteSpace(name)) throw StudioFehler.Ungueltig("Bitte einen Namen eingeben.");
        var dok = Holen(id);
        dok.Info.Name = name.Trim();
        _db.DokumentSpeichern(dok.Info, null);
    }

    /// <summary>Speichert (falls geändert) und entfernt das Dokument aus dem Speicher.</summary>
    public async Task SchliessenAsync(string id, string benutzer)
    {
        if (!_offen.TryGetValue(id, out var l) || !l.IsValueCreated) return;
        await l.Value.SpeichervorgangAbwartenAsync();
        await l.Value.SpeichernAsync(benutzer);
        l.Value.Senden(new StudioEreignis("geschlossen", l.Value.Version, "", "Dokument geschlossen", benutzer, DateTime.Now));
        _offen.TryRemove(id, out _);
    }

    public void Loeschen(string id)
    {
        if (!Existiert(id)) throw StudioFehler.NichtGefunden("Das Dokument");
        if (_offen.TryRemove(id, out var l) && l.IsValueCreated)
            l.Value.Senden(new StudioEreignis("geschlossen", l.Value.Version, "", "Dokument gelöscht", "", DateTime.Now));
        _db.DokumentLoeschen(id);
    }

    /// <summary>
    /// Speichert alle geänderten Dokumente (Sicherheits-Autospeicherung, Herunterfahren). Mit <paramref name="ruhezeit"/> werden
    /// Dokumente übersprungen, die gerade erst geändert wurden (dafür ist schon ein Speichern vorgemerkt).
    /// </summary>
    public async Task AlleSpeichernAsync(TimeSpan ruhezeit, CancellationToken ct = default)
    {
        foreach (var dok in Offene.ToList())
        {
            if (ruhezeit == TimeSpan.Zero) await dok.SpeichervorgangAbwartenAsync();
            if (!dok.IstGeaendert || DateTime.Now - dok.LetzteAenderung < ruhezeit) continue;
            try { await dok.SpeichernAsync("Autospeicherung", false, ct); }
            catch (Exception ex) when (ex is not OperationCanceledException) { _log.LogError(ex, "Autospeicherung von {Id} fehlgeschlagen", dok.Id); }
        }
    }

    /// <summary>Herunterfahren: keine neuen Speichervorgänge mehr vormerken, alles Geänderte jetzt speichern (wartet auf laufende).</summary>
    public async Task BeendenAsync()
    {
        _beendet = true;
        await AlleSpeichernAsync(TimeSpan.Zero, CancellationToken.None);
    }

    /// <summary>Lange nicht benutzte Dokumente ohne Abonnenten speichern und aus dem Speicher entfernen.</summary>
    public async Task AufraeumenAsync(TimeSpan leerlauf)
    {
        foreach (var dok in Offene.ToList())
            if (DateTime.Now - dok.LetzterZugriff > leerlauf && dok.Abonnenten == 0)
                await SchliessenAsync(dok.Id, "Autospeicherung");
    }
}
