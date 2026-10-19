using UntPlanStudio.Dienste;

namespace UntPlanStudio.Grundlagen;

/// <summary>
/// Einstellungen des Studio-Servers aus Umgebungsvariablen bzw. Konfiguration (siehe README, „Umgebungsvariablen“).
/// </summary>
public sealed class StudioKonfiguration
{
    /// <summary>Datenordner: Datenbank <c>studio.db</c> (Dokumente, Benutzer, Einstellungen), Sicherungen, Cookie-Schlüssel.</summary>
    public string Datenordner { get; init; } = "";
    public string AdminBenutzer { get; init; } = "admin";
    /// <summary>Passwort des Admin-Kontos beim ersten Start (leer = zufällig erzeugt und im Protokoll ausgegeben).</summary>
    public string? AdminPasswort { get; init; }
    /// <summary>
    /// Takt der Sicherheits-Autospeicherung in Sekunden (fängt Änderungen auf, die nicht über <see cref="Arbeitsdokument"/> gemeldet
    /// wurden, und wiederholt fehlgeschlagene Speichervorgänge). Normal wird jede Änderung sofort gespeichert (<see cref="SpeichernVerzoegerungMs"/>).
    /// </summary>
    public int AutospeichernSekunden { get; init; } = 30;
    /// <summary>Jede Änderung wird nach so vielen Millisekunden in die Datenbank geschrieben (mehrere Änderungen in dieser Zeit: ein Schreibvorgang).</summary>
    public int SpeichernVerzoegerungMs { get; init; } = 800;
    /// <summary>Höchstens alle so viele Minuten entsteht beim automatischen Speichern eine ältere Fassung in <c>dokument_sicherungen</c>.</summary>
    public int FassungMinuten { get; init; } = 10;
    /// <summary>Inhalte der Schuldateien komprimiert (gzip) in der Datenbank ablegen.</summary>
    public bool Komprimieren { get; init; } = true;
    /// <summary>SQLite (Standard) oder MySQL/MariaDB.</summary>
    public StudioDatenbankart Datenbank { get; init; } = StudioDatenbankart.Sqlite;
    /// <summary>MySQL/MariaDB: Verbindungszeichenfolge (<c>STUDIO_DB_CONNECTION</c>).</summary>
    public string? DatenbankVerbindung { get; init; }
    /// <summary>MySQL/MariaDB: so lange beim Start auf den Datenbankserver warten.</summary>
    public TimeSpan DatenbankWarten { get; init; } = TimeSpan.FromSeconds(60);
    /// <summary>Nicht benutzte Dokumente werden nach so vielen Minuten gespeichert und aus dem Speicher entfernt.</summary>
    public int LeerlaufMinuten { get; init; } = 120;
    public int MaxUploadMb { get; init; } = 64;
    /// <summary>Anmeldecookie nur über HTTPS senden (null = automatisch nach Anfrage).</summary>
    public bool? SichereCookies { get; init; }
    /// <summary>So viele Datenbanksicherungen (<c>sicherungen/studio-*.db</c>) bleiben erhalten.</summary>
    public int SicherungenBehalten { get; init; } = 14;

    /// <summary>Die Datenbank des Studios (SQLite).</summary>
    public string Datenbankpfad => Path.Combine(Datenordner, "studio.db");
    public string Sicherungsordner => Path.Combine(Datenordner, "sicherungen");

    /// <summary>Ablage älterer Versionen (nur noch für die Übernahme in die Datenbank, siehe <c>AltdatenUebernahme</c>).</summary>
    public string Dokumentordner => Path.Combine(Datenordner, "dokumente");
    public string Benutzerordner => Path.Combine(Datenordner, "benutzer");

    public static StudioKonfiguration Laden(IConfiguration c, string inhaltsordner)
    {
        static int Zahl(string? s, int standard) => int.TryParse(s, out var v) && v > 0 ? v : standard;
        static bool? Schalter(string? s) => s?.Trim().ToLowerInvariant() switch { "1" or "true" or "ja" or "an" => true, "0" or "false" or "nein" or "aus" => false, _ => null };
        var daten = c["STUDIO_DATEN"];
        if (string.IsNullOrWhiteSpace(daten)) daten = Path.Combine(inhaltsordner, "daten");
        var sicher = c["STUDIO_SICHERE_COOKIES"]?.Trim().ToLowerInvariant();
        var k = new StudioKonfiguration
        {
            Datenordner = Path.GetFullPath(daten),
            AdminBenutzer = string.IsNullOrWhiteSpace(c["STUDIO_ADMIN_BENUTZER"]) ? "admin" : c["STUDIO_ADMIN_BENUTZER"]!.Trim(),
            AdminPasswort = string.IsNullOrWhiteSpace(c["STUDIO_ADMIN_PASSWORT"]) ? null : c["STUDIO_ADMIN_PASSWORT"],
            AutospeichernSekunden = Zahl(c["STUDIO_AUTOSPEICHERN_SEKUNDEN"], 30),
            LeerlaufMinuten = Zahl(c["STUDIO_LEERLAUF_MINUTEN"], 120),
            MaxUploadMb = Zahl(c["STUDIO_MAX_UPLOAD_MB"], 64),
            SicherungenBehalten = Zahl(c["STUDIO_SICHERUNGEN_BEHALTEN"], 14),
            SpeichernVerzoegerungMs = Zahl(c["STUDIO_SPEICHERN_VERZOEGERUNG_MS"], 800),
            FassungMinuten = Zahl(c["STUDIO_FASSUNG_MINUTEN"], 10),
            Komprimieren = Schalter(c["STUDIO_DB_KOMPRIMIEREN"]) ?? true,
            Datenbank = Datenbankart(c["STUDIO_DB"]),
            DatenbankVerbindung = string.IsNullOrWhiteSpace(c["STUDIO_DB_CONNECTION"]) ? null : c["STUDIO_DB_CONNECTION"]!.Trim(),
            DatenbankWarten = TimeSpan.FromSeconds(Zahl(c["STUDIO_DB_WARTEN_SEKUNDEN"], 60)),
            SichereCookies = sicher is "1" or "true" or "ja" ? true : sicher is "0" or "false" or "nein" ? false : null,
        };
        Directory.CreateDirectory(k.Datenordner);
        return k;
    }

    /// <summary><c>STUDIO_DB</c>: <c>sqlite</c> (Standard), <c>mysql</c> oder <c>mariadb</c>.</summary>
    public static StudioDatenbankart Datenbankart(string? wert) => wert?.Trim().ToLowerInvariant() switch
    {
        null or "" or "sqlite" => StudioDatenbankart.Sqlite,
        "mysql" or "mariadb" => StudioDatenbankart.MySql,
        _ => throw new InvalidOperationException($"STUDIO_DB={wert} wird nicht unterstützt (sqlite, mysql oder mariadb)."),
    };
}
