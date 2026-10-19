using System.Reflection;
using System.Threading.Channels;
using UntPlan.Core;
using UntPlan.Core.Model;
using UntPlanStudio.Grundlagen;

namespace UntPlanStudio.Dienste;

/// <summary>Beschreibung eines Arbeitsdokuments auf dem Server (Spalten bzw. <c>info</c> der Tabelle <c>dokumente</c>).</summary>
public sealed class DokumentInfo
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Besitzer { get; set; } = "";
    public DateTime Erstellt { get; set; } = DateTime.Now;
    public DateTime Geaendert { get; set; } = DateTime.Now;
    /// <summary>Herkunft: „neu“, „beispiel“, „hochgeladen: datei.up“, „BAL: datei.txt“.</summary>
    public string Herkunft { get; set; } = "";
}

/// <summary>Benachrichtigung an alle Fenster/Benutzer eines Dokuments (Server-Sent Events, siehe /ereignisse).</summary>
public sealed record StudioEreignis(string Art, long Version, string Bereich, string Beschreibung, string Benutzer, DateTime Zeit);

/// <summary>
/// Ein geöffnetes Arbeitsdokument: das Core-<see cref="Dokument"/> im Speicher. Alle Zugriffe laufen über
/// <see cref="LesenAsync{T}"/> bzw. <see cref="AendernAsync{T}"/> und sind damit je Dokument serialisiert (UntPlan.Core ist nicht
/// threadsicher). Änderungen laufen über <see cref="Dokument.Aendern"/> und sind damit rückgängig zu machen; jede Änderung erhöht
/// <see cref="Version"/>, wird als <see cref="StudioEreignis"/> an alle Abonnenten gemeldet und dem <see cref="Dokumentdienst"/>
/// gemeldet, der sie kurz danach in die Datenbank schreibt (sofortiges Speichern, kein „Speichern“ nötig).
/// <para>Speichern: unter der Dokumentsperre nur den Inhalt erzeugen (JSON), das Schreiben in die Datenbank (Komprimieren,
/// Transaktion) läuft danach außerhalb der Dokumentsperre – Änderungen anderer Benutzer warten also nicht auf die Datenbank.
/// Speichervorgänge eines Dokuments laufen nacheinander (<c>_speicherSperre</c>), damit nie ein älterer Stand einen neueren überschreibt.</para>
/// </summary>
public sealed class Arbeitsdokument
{
    private readonly SemaphoreSlim _sperre = new(1, 1);
    private readonly SemaphoreSlim _speicherSperre = new(1, 1);
    private readonly object _aboSperre = new();
    private readonly List<Channel<StudioEreignis>> _abos = new();
    private readonly Action<Arbeitsdokument, byte[], bool, string> _speichern;
    private readonly Action<Arbeitsdokument, AenderungsArt, string>? _geaendert;

    public string Id => Info.Id;
    public DokumentInfo Info { get; }
    /// <summary>Das Core-Dokument. Nur innerhalb von <see cref="LesenAsync{T}"/>/<see cref="AendernAsync{T}"/> verwenden!</summary>
    internal Dokument Dokument { get; }
    /// <summary>Änderungszähler seit dem Öffnen (für Aktualisierungen in den Fenstern).</summary>
    public long Version { get; private set; }
    public DateTime LetzterZugriff { get; private set; } = DateTime.Now;
    public DateTime LetzteAenderung { get; private set; } = DateTime.MinValue;
    public DateTime? Gespeichert { get; private set; }
    /// <summary>Gerade wird in die Datenbank geschrieben.</summary>
    public bool Speichert { get; private set; }
    /// <summary>Meldung des letzten fehlgeschlagenen Speichervorgangs (null = zuletzt erfolgreich).</summary>
    public string? Speicherfehler { get; private set; }
    /// <summary>Fehlgeschlagene Speicherversuche in Folge (für die Wartezeit bis zum nächsten Versuch).</summary>
    public int Fehlversuche { get; private set; }
    /// <summary>Erfolgreiche Speichervorgänge seit dem Öffnen (Diagnose, Tests).</summary>
    public long Speichervorgaenge => Interlocked.Read(ref _speichervorgaenge);
    private long _speichervorgaenge;
    /// <summary>Bereich der letzten Änderung (<see cref="AenderungsArt"/>), z. B. „Stammdaten“ – für gezielte Aktualisierung der Fenster.</summary>
    public string LetzterBereich { get; private set; } = "";
    public bool IstGeaendert => Dokument.IstGeaendert;

    /// <param name="speichern">schreibt Beschreibung und Inhalt der Schuldatei (*.up) in die Datenbank (Dokument, Inhalt, Sicherungspunkt, Benutzer)</param>
    /// <param name="geaendert">nach jeder Änderung (außerhalb der Dokumentsperre aufgerufen): Speichern vormerken, direkte Übertragung …</param>
    internal Arbeitsdokument(DokumentInfo info, Dokument dokument, Action<Arbeitsdokument, byte[], bool, string> speichern, Action<Arbeitsdokument, AenderungsArt, string>? geaendert = null)
    {
        Info = info;
        Dokument = dokument;
        _speichern = speichern;
        _geaendert = geaendert;
        // Dokument.PlanaenderungenAbgleichen bleibt eingeschaltet, damit Dateien austauschbar bleiben.
    }

    /// <summary>
    /// Bindung als Handler-Parameter in Minimal-APIs: Routenwert <c>{dok}</c> → geöffnetes Dokument (lädt es bei Bedarf).
    /// </summary>
    public static ValueTask<Arbeitsdokument?> BindAsync(HttpContext ctx, ParameterInfo _)
    {
        var id = ctx.Request.RouteValues["dok"] as string ?? throw StudioFehler.NichtGefunden("Das Dokument");
        return ValueTask.FromResult<Arbeitsdokument?>(ctx.RequestServices.GetRequiredService<Dokumentdienst>().Holen(id));
    }

    internal void Beruehrt() => LetzterZugriff = DateTime.Now;

    /// <summary>Liest unter der Dokumentsperre (Core-Daten nicht nach außen geben, sondern in DTOs umwandeln).</summary>
    public async Task<T> LesenAsync<T>(Func<Dokument, T> lesen, CancellationToken ct = default)
    {
        await _sperre.WaitAsync(ct);
        try
        {
            Beruehrt();
            return lesen(Dokument);
        }
        finally { _sperre.Release(); }
    }

    /// <summary>
    /// Ändert die Daten mit Rückgängig-Stufe (<see cref="Dokument.Aendern"/>) und liefert danach – noch unter der Sperre – ein
    /// Ergebnis (z. B. die geänderte Tabellenzeile).
    /// </summary>
    public async Task<T> AendernAsync<T>(string benutzer, string beschreibung, AenderungsArt art, Action<Schuldatei> aktion, Func<Dokument, T> danach, CancellationToken ct = default)
    {
        T erg;
        await _sperre.WaitAsync(ct);
        try
        {
            Beruehrt();
            Dokument.Aendern(beschreibung, art, aktion);
            erg = danach(Dokument);
            Geaendert(benutzer, beschreibung, art);
        }
        finally { _sperre.Release(); }
        Gemeldet(art, benutzer);
        return erg;
    }

    public Task AendernAsync(string benutzer, string beschreibung, AenderungsArt art, Action<Schuldatei> aktion, CancellationToken ct = default) =>
        AendernAsync(benutzer, beschreibung, art, aktion, _ => true, ct);

    /// <summary>
    /// Freie Aktion am Dokument (z. B. Rückgängig, Import mit eigener Logik). Liefert die Aktion eine Änderungsart, wird die Änderung
    /// gemeldet (Version erhöht, Ereignis an alle Fenster).
    /// </summary>
    public async Task<T> AusfuehrenAsync<T>(string benutzer, Func<Dokument, (T Ergebnis, AenderungsArt? Art, string Beschreibung)> aktion, CancellationToken ct = default)
    {
        T erg;
        AenderungsArt? geaendert;
        await _sperre.WaitAsync(ct);
        try
        {
            Beruehrt();
            (erg, geaendert, var text) = aktion(Dokument);
            if (geaendert is { } a) Geaendert(benutzer, text, a);
        }
        finally { _sperre.Release(); }
        if (geaendert is { } g) Gemeldet(g, benutzer);
        return erg;
    }

    /// <summary>Änderung an den Dokumentdienst melden (Speichern vormerken); Fehler dort dürfen die Änderung nicht scheitern lassen.</summary>
    private void Gemeldet(AenderungsArt art, string benutzer)
    {
        try { _geaendert?.Invoke(this, art, benutzer); }
        catch (Exception) { /* Speichern holt die Sicherheits-Autospeicherung nach */ }
    }

    private void Geaendert(string benutzer, string beschreibung, AenderungsArt art)
    {
        Version++;
        LetzterBereich = art.ToString();
        LetzteAenderung = DateTime.Now;
        Info.Geaendert = LetzteAenderung;
        Senden(new StudioEreignis("aenderung", Version, art.ToString(), beschreibung, benutzer, LetzteAenderung));
    }

    /// <summary>
    /// Speichert das Dokument in die Datenbank (auch ohne Änderungen, wenn <paramref name="immer"/>; <paramref name="sicherungspunkt"/>
    /// legt zusätzlich den aktuellen Stand als Sicherungspunkt ab). Liefert false, wenn nichts zu speichern war. Wirft bei einem
    /// Datenbankfehler (das Dokument bleibt dann „geändert“, <see cref="Speicherfehler"/> nennt den Grund, alle Fenster erhalten
    /// das Ereignis <c>speicherfehler</c>).
    /// </summary>
    public async Task<bool> SpeichernAsync(string benutzer, bool immer = false, CancellationToken ct = default, bool sicherungspunkt = false)
    {
        await _speicherSperre.WaitAsync(ct);
        try
        {
            byte[]? inhalt = null;
            long version;
            await _sperre.WaitAsync(ct);
            try
            {
                if (!immer && !sicherungspunkt && !Dokument.IstGeaendert) return false;
                // gilt ab hier als gespeichert; Änderungen während des Schreibens setzen das Kennzeichen wieder
                Dokument.Speichern(b => inhalt = b);
                version = Version;
                Speichert = true;
            }
            finally { _sperre.Release(); }
            try
            {
                _speichern(this, inhalt!, sicherungspunkt, benutzer);
            }
            catch (Exception ex)
            {
                await _sperre.WaitAsync(CancellationToken.None);
                try { Dokument.AlsGeaendertMarkieren(); }
                finally { _sperre.Release(); }
                Speichert = false;
                Fehlversuche++;
                Speicherfehler = Datenbankanbieter.IstDatenbankfehler(ex) ? "Die Datenbank ist nicht erreichbar – Änderungen sind noch nicht gespeichert." : ex.Message;
                Senden(new StudioEreignis("speicherfehler", Version, "", Speicherfehler, benutzer, DateTime.Now));
                throw;
            }
            Speichert = false;
            Interlocked.Increment(ref _speichervorgaenge);
            Fehlversuche = 0;
            Speicherfehler = null;
            Gespeichert = DateTime.Now;
            Senden(new StudioEreignis("gespeichert", version, "", sicherungspunkt ? "Sicherungspunkt angelegt" : "Gespeichert", benutzer, Gespeichert.Value));
            return true;
        }
        finally { _speicherSperre.Release(); }
    }

    /// <summary>Wartet, bis ein laufender Speichervorgang fertig ist (z. B. vor dem Entladen).</summary>
    internal async Task SpeichervorgangAbwartenAsync()
    {
        await _speicherSperre.WaitAsync();
        _speicherSperre.Release();
    }

    /// <summary>Inhalt der Schuldatei (*.up) für den Download, mit dem aktuellen Stand (auch ungespeichert).</summary>
    public Task<byte[]> DateiinhaltAsync(CancellationToken ct = default) =>
        LesenAsync(d => System.Text.Json.JsonSerializer.SerializeToUtf8Bytes(d.Daten, Dokument.JsonOptionen), ct);

    // ---------------------------------------------------------------------------------------------
    // Ereignisse

    public ChannelReader<StudioEreignis> Abonnieren(out Action abmelden)
    {
        var ch = Channel.CreateBounded<StudioEreignis>(new BoundedChannelOptions(64) { FullMode = BoundedChannelFullMode.DropOldest });
        lock (_aboSperre) _abos.Add(ch);
        abmelden = () =>
        {
            lock (_aboSperre) _abos.Remove(ch);
            ch.Writer.TryComplete();
        };
        return ch.Reader;
    }

    public int Abonnenten
    {
        get { lock (_aboSperre) return _abos.Count; }
    }

    internal void Senden(StudioEreignis e)
    {
        lock (_aboSperre)
            foreach (var ch in _abos) ch.Writer.TryWrite(e);
    }
}
