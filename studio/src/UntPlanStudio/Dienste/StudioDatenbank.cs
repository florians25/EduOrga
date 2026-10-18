using System.Globalization;
using System.Reflection;
using System.Text.Json;
using Microsoft.Data.Sqlite;
using UntPlanStudio.Grundlagen;

namespace UntPlanStudio.Dienste;

/// <summary>Bereiche der Tabelle <c>ablage</c> (JSON-Werte unter Bereich + Schlüssel).</summary>
public static class Ablagebereiche
{
    /// <summary>Ein Eintrag je Benutzer (Schlüssel = Name in Kleinbuchstaben, Inhalt = <see cref="StudioBenutzer"/>).</summary>
    public const string Benutzer = "benutzer";
    /// <summary>Einstellungen je Benutzer (Schlüssel = Name in Kleinbuchstaben, Inhalt = JSON-Objekt mit allen Werten).</summary>
    public const string Einstellungen = "einstellungen";
    /// <summary>MultiUser-Konfiguration (Schlüssel <c>konfiguration</c>, Inhalt = <see cref="MuKonfiguration"/>).</summary>
    public const string MultiUser = "multiuser";
    /// <summary>Automatischer UntPlan-Web-Abgleich je Dokument (Schlüssel = Dokument-Id, Inhalt = <see cref="UpwAbgleich"/>).</summary>
    public const string UntPlanWeb = "untplanweb";
}

/// <summary>Dokument in der Datenbank (ohne Inhalt).</summary>
public sealed record DokumentZeile(DokumentInfo Info, long Groesse, DateTime? Gespeichert);

/// <summary>Ältere Fassung eines Dokuments (ersetzt die frühere <c>.bak</c>-Datei).</summary>
public sealed record DokumentSicherung(long Nr, string DokumentId, DateTime Zeit, long Groesse);

/// <summary>Sicherung der gesamten Datenbank (<c>sicherungen/studio-&lt;zeit&gt;.db</c>).</summary>
public sealed record DatenbankSicherung(string Datei, string Pfad, long Groesse, DateTime Zeit);

/// <summary>
/// Die eigene Datenbank von UntPlan Studio (SQLite, <c>&lt;Datenordner&gt;/studio.db</c>, unabhängig von UntPlan Web): Arbeitsdokumente
/// samt Sicherungsständen und die <c>ablage</c> für Benutzer, Benutzereinstellungen, MultiUser-Konfiguration und UntPlan-Web-Abgleich.
/// WAL-Modus, <c>busy_timeout</c>, eine Verbindung je Vorgang (Verbindungspool), Schreibvorgänge in Transaktionen und zusätzlich
/// prozessweit nacheinander. Schema-Version in <c>PRAGMA user_version</c>, Migrationen beim Start (vorher automatische Sicherung).
/// Beim ersten Start werden Dateien älterer Versionen übernommen (<see cref="AltdatenUebernahme"/>).
/// </summary>
public sealed class StudioDatenbank
{
    public const string Dateiname = "studio.db";
    /// <summary>So viele ältere Fassungen je Dokument bleiben in <c>dokument_sicherungen</c>.</summary>
    public const int DokumentSicherungenBehalten = 10;

    /// <summary>Migrationen: Eintrag i hebt das Schema von Version i auf i + 1.</summary>
    private static readonly string[] Migrationen =
    {
        """
        CREATE TABLE meta (
            schluessel TEXT PRIMARY KEY,
            wert       TEXT NOT NULL
        );
        CREATE TABLE dokumente (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            besitzer    TEXT NOT NULL DEFAULT '',
            erstellt    TEXT NOT NULL,
            geaendert   TEXT NOT NULL,
            gespeichert TEXT,
            herkunft    TEXT NOT NULL DEFAULT '',
            info        TEXT NOT NULL DEFAULT '{}',
            inhalt      BLOB NOT NULL,
            groesse     INTEGER NOT NULL
        );
        CREATE TABLE dokument_sicherungen (
            nr      INTEGER PRIMARY KEY AUTOINCREMENT,
            id      TEXT NOT NULL REFERENCES dokumente(id) ON DELETE CASCADE,
            zeit    TEXT NOT NULL,
            inhalt  BLOB NOT NULL,
            groesse INTEGER NOT NULL
        );
        CREATE INDEX ix_dokument_sicherungen_id ON dokument_sicherungen(id, nr);
        CREATE TABLE ablage (
            bereich    TEXT NOT NULL,
            schluessel TEXT NOT NULL,
            inhalt     TEXT NOT NULL,
            geaendert  TEXT NOT NULL,
            PRIMARY KEY (bereich, schluessel)
        );
        """,
    };

    public static int SchemaVersion => Migrationen.Length;

    private static readonly JsonSerializerOptions InfoOptionen = new();
    private readonly string _verbindung;
    private readonly object _schreibsperre = new();
    private readonly ILogger _log;

    public string Pfad { get; }
    public string Sicherungsordner { get; }
    public int SicherungenBehalten { get; }
    /// <summary>Ordner, in den beim ersten Start die Dateien einer älteren Version verschoben wurden (sonst null).</summary>
    public string? Altdatenordner { get; }

    public StudioDatenbank(StudioKonfiguration k, ILogger<StudioDatenbank> log)
    {
        _log = log;
        Pfad = k.Datenbankpfad;
        Sicherungsordner = k.Sicherungsordner;
        SicherungenBehalten = Math.Max(1, k.SicherungenBehalten);
        Directory.CreateDirectory(Path.GetDirectoryName(Pfad)!);
        _verbindung = Verbindungstext(Pfad, SqliteOpenMode.ReadWriteCreate);
        Einrichten();
        Altdatenordner = AltdatenUebernahme.Ausfuehren(this, k, log);
    }

    private static string Verbindungstext(string pfad, SqliteOpenMode modus) =>
        new SqliteConnectionStringBuilder { DataSource = pfad, Mode = modus, Pooling = true, DefaultTimeout = 30 }.ToString();

    /// <summary>Version der Anwendung (ohne Commit-Kennung), um Updates zu erkennen.</summary>
    public static string Anwendungsversion
    {
        get
        {
            var v = typeof(StudioDatenbank).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
                ?? typeof(StudioDatenbank).Assembly.GetName().Version?.ToString() ?? "";
            var plus = v.IndexOf('+');
            return plus >= 0 ? v[..plus] : v;
        }
    }

    // ---------------------------------------------------------------------------------------------- Verbindung, Schema

    internal SqliteConnection Oeffnen() => Oeffnen(_verbindung);

    private static SqliteConnection Oeffnen(string verbindung)
    {
        var c = new SqliteConnection(verbindung);
        c.Open();
        using var cmd = c.CreateCommand();
        cmd.CommandText = "PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;";
        cmd.ExecuteNonQuery();
        return c;
    }

    internal static SqliteCommand Befehl(SqliteConnection c, SqliteTransaction? t, string sql, params (string Name, object? Wert)[] parameter)
    {
        var cmd = c.CreateCommand();
        cmd.CommandText = sql;
        cmd.Transaction = t;
        foreach (var (name, wert) in parameter) cmd.Parameters.AddWithValue(name, wert ?? DBNull.Value);
        return cmd;
    }

    private static void Ausfuehren(SqliteConnection c, SqliteTransaction? t, string sql, params (string, object?)[] p)
    {
        using var cmd = Befehl(c, t, sql, p);
        cmd.ExecuteNonQuery();
    }

    private static int Zeilen(SqliteConnection c, SqliteTransaction? t, string sql, params (string, object?)[] p)
    {
        using var cmd = Befehl(c, t, sql, p);
        return cmd.ExecuteNonQuery();
    }

    private static object? Skalar(SqliteConnection c, SqliteTransaction? t, string sql, params (string, object?)[] p)
    {
        using var cmd = Befehl(c, t, sql, p);
        var v = cmd.ExecuteScalar();
        return v is DBNull ? null : v;
    }

    internal static string Zeit(DateTime d) => d.ToString("o", CultureInfo.InvariantCulture);

    internal static DateTime Zeit(string s) => DateTime.Parse(s, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind);

    /// <summary>Lesevorgang mit eigener Verbindung.</summary>
    public T Lesen<T>(Func<SqliteConnection, T> lesen)
    {
        using var c = Oeffnen();
        return lesen(c);
    }

    /// <summary>Schreibvorgang in einer Transaktion (BEGIN IMMEDIATE); prozessweit nacheinander.</summary>
    public T Schreiben<T>(Func<SqliteConnection, SqliteTransaction, T> schreiben)
    {
        lock (_schreibsperre)
        {
            using var c = Oeffnen();
            using var t = c.BeginTransaction();
            var erg = schreiben(c, t);
            t.Commit();
            return erg;
        }
    }

    public void Schreiben(Action<SqliteConnection, SqliteTransaction> schreiben) => Schreiben((c, t) => { schreiben(c, t); return true; });

    private void Einrichten()
    {
        using var c = Oeffnen();
        Ausfuehren(c, null, "PRAGMA journal_mode=WAL;");
        var version = Convert.ToInt32(Skalar(c, null, "PRAGMA user_version;"));
        if (version > SchemaVersion)
            throw new InvalidOperationException($"Die Datenbank {Pfad} stammt von einer neueren Version von UntPlan Studio (Schema {version}, unterstützt bis {SchemaVersion}).");
        if (version > 0)
        {
            // vor jedem Update (neue Programmversion oder Schema-Migration) automatisch sichern
            var alt = Skalar(c, null, "SELECT wert FROM meta WHERE schluessel = 'anwendungsversion'") as string;
            if (version < SchemaVersion || alt != Anwendungsversion)
            {
                try
                {
                    var s = Sichern();
                    _log.LogInformation("Programmversion {Alt} → {Neu}: Datenbank vorher gesichert ({Datei})", alt ?? "?", Anwendungsversion, s.Datei);
                }
                catch (Exception ex) when (ex is SqliteException or IOException or UnauthorizedAccessException)
                {
                    _log.LogWarning(ex, "Sicherung vor dem Update fehlgeschlagen");
                }
            }
        }
        for (var v = version; v < SchemaVersion; v++)
        {
            lock (_schreibsperre)
            {
                using var t = c.BeginTransaction();
                Ausfuehren(c, t, Migrationen[v]);
                Ausfuehren(c, t, $"PRAGMA user_version = {v + 1};");
                t.Commit();
            }
            if (version > 0) _log.LogInformation("Datenbank auf Schema-Version {Version} migriert", v + 1);
        }
        Ausfuehren(c, null, "INSERT INTO meta (schluessel, wert) VALUES ('anwendungsversion', @v) ON CONFLICT(schluessel) DO UPDATE SET wert = excluded.wert",
            ("@v", Anwendungsversion));
    }

    /// <summary>Datenbank erreichbar und lesbar (für <c>GET /gesundheit</c>).</summary>
    public bool Erreichbar()
    {
        try
        {
            using var c = Oeffnen();
            return Convert.ToInt32(Skalar(c, null, "PRAGMA user_version;")) == SchemaVersion && Skalar(c, null, "SELECT count(*) FROM ablage") is not null;
        }
        catch (Exception ex) when (ex is SqliteException or InvalidOperationException or IOException)
        {
            _log.LogError(ex, "Datenbank nicht erreichbar");
            return false;
        }
    }

    /// <summary>Weder Dokumente noch Einträge in der Ablage (z. B. erster Start).</summary>
    public bool IstLeer => Lesen(c => Convert.ToInt64(Skalar(c, null, "SELECT (SELECT count(*) FROM dokumente) + (SELECT count(*) FROM ablage)")) == 0);

    // ---------------------------------------------------------------------------------------------- Ablage

    public string? AblageLesen(string bereich, string schluessel) =>
        Lesen(c => Skalar(c, null, "SELECT inhalt FROM ablage WHERE bereich = @b AND schluessel = @s", ("@b", bereich), ("@s", schluessel)) as string);

    /// <summary>Alle Einträge eines Bereichs in der Reihenfolge des Anlegens.</summary>
    public List<(string Schluessel, string Inhalt)> AblageListe(string bereich) => Lesen(c =>
    {
        using var cmd = Befehl(c, null, "SELECT schluessel, inhalt FROM ablage WHERE bereich = @b ORDER BY rowid", ("@b", bereich));
        using var r = cmd.ExecuteReader();
        var l = new List<(string, string)>();
        while (r.Read()) l.Add((r.GetString(0), r.GetString(1)));
        return l;
    });

    public List<string> AblageSchluessel(string bereich) => AblageListe(bereich).Select(e => e.Schluessel).ToList();

    public void AblageSchreiben(string bereich, string schluessel, string inhalt) => Schreiben((c, t) => AblageSchreiben(c, t, bereich, schluessel, inhalt));

    internal static void AblageSchreiben(SqliteConnection c, SqliteTransaction t, string bereich, string schluessel, string inhalt) =>
        Ausfuehren(c, t, """
            INSERT INTO ablage (bereich, schluessel, inhalt, geaendert) VALUES (@b, @s, @i, @g)
            ON CONFLICT(bereich, schluessel) DO UPDATE SET inhalt = excluded.inhalt, geaendert = excluded.geaendert
            """, ("@b", bereich), ("@s", schluessel), ("@i", inhalt), ("@g", Zeit(DateTime.Now)));

    public void AblageLoeschen(string bereich, string schluessel) =>
        Schreiben((c, t) => Ausfuehren(c, t, "DELETE FROM ablage WHERE bereich = @b AND schluessel = @s", ("@b", bereich), ("@s", schluessel)));

    // ---------------------------------------------------------------------------------------------- Dokumente

    private const string DokumentSpalten = "id, name, besitzer, erstellt, geaendert, herkunft, groesse, gespeichert";

    private static DokumentZeile DokumentLesen(SqliteDataReader r) => new(new DokumentInfo
    {
        Id = r.GetString(0),
        Name = r.GetString(1),
        Besitzer = r.GetString(2),
        Erstellt = Zeit(r.GetString(3)),
        Geaendert = Zeit(r.GetString(4)),
        Herkunft = r.GetString(5),
    }, r.GetInt64(6), r.IsDBNull(7) ? null : Zeit(r.GetString(7)));

    /// <summary>Alle Dokumente (ohne Inhalt), zuletzt geänderte zuerst.</summary>
    public List<DokumentZeile> Dokumente() => Lesen(c =>
    {
        using var cmd = Befehl(c, null, $"SELECT {DokumentSpalten} FROM dokumente ORDER BY geaendert DESC");
        using var r = cmd.ExecuteReader();
        var l = new List<DokumentZeile>();
        while (r.Read()) l.Add(DokumentLesen(r));
        return l;
    });

    public DokumentZeile? Dokument(string id) => Lesen(c =>
    {
        using var cmd = Befehl(c, null, $"SELECT {DokumentSpalten} FROM dokumente WHERE id = @id", ("@id", id));
        using var r = cmd.ExecuteReader();
        return r.Read() ? DokumentLesen(r) : null;
    });

    public bool DokumentExistiert(string id) => Lesen(c => Skalar(c, null, "SELECT 1 FROM dokumente WHERE id = @id", ("@id", id)) is not null);

    /// <summary>Inhalt der Schuldatei (genau der Inhalt der früheren *.up-Datei).</summary>
    public byte[]? DokumentInhalt(string id) => Lesen(c => Skalar(c, null, "SELECT inhalt FROM dokumente WHERE id = @id", ("@id", id)) as byte[]);

    public void DokumentAnlegen(DokumentInfo info, byte[] inhalt) => Schreiben((c, t) => DokumentAnlegen(c, t, info, inhalt, DateTime.Now));

    internal static void DokumentAnlegen(SqliteConnection c, SqliteTransaction t, DokumentInfo info, byte[] inhalt, DateTime? gespeichert) =>
        Ausfuehren(c, t, """
            INSERT INTO dokumente (id, name, besitzer, erstellt, geaendert, gespeichert, herkunft, info, inhalt, groesse)
            VALUES (@id, @name, @besitzer, @erstellt, @geaendert, @gespeichert, @herkunft, @info, @inhalt, @groesse)
            """, ("@id", info.Id), ("@name", info.Name), ("@besitzer", info.Besitzer), ("@erstellt", Zeit(info.Erstellt)), ("@geaendert", Zeit(info.Geaendert)),
            ("@gespeichert", gespeichert is { } g ? Zeit(g) : null), ("@herkunft", info.Herkunft), ("@info", JsonSerializer.Serialize(info, InfoOptionen)),
            ("@inhalt", inhalt), ("@groesse", inhalt.LongLength));

    /// <summary>
    /// Speichert Beschreibung und (falls angegeben) Inhalt eines vorhandenen Dokuments. Der bisherige Inhalt wandert – wenn er sich
    /// unterscheidet – nach <c>dokument_sicherungen</c> (die letzten <see cref="DokumentSicherungenBehalten"/> bleiben).
    /// Liefert false, wenn es das Dokument nicht (mehr) gibt.
    /// </summary>
    public bool DokumentSpeichern(DokumentInfo info, byte[]? inhalt) => Schreiben((c, t) =>
    {
        var p = new List<(string, object?)>
        {
            ("@id", info.Id), ("@name", info.Name), ("@besitzer", info.Besitzer), ("@erstellt", Zeit(info.Erstellt)), ("@geaendert", Zeit(info.Geaendert)),
            ("@herkunft", info.Herkunft), ("@info", JsonSerializer.Serialize(info, InfoOptionen)),
        };
        if (inhalt is null)
            return Zeilen(c, t, "UPDATE dokumente SET name = @name, besitzer = @besitzer, erstellt = @erstellt, geaendert = @geaendert, herkunft = @herkunft, info = @info WHERE id = @id",
                p.ToArray()) > 0;
        Ausfuehren(c, t, """
            INSERT INTO dokument_sicherungen (id, zeit, inhalt, groesse)
            SELECT id, COALESCE(gespeichert, geaendert), inhalt, groesse FROM dokumente WHERE id = @id AND inhalt <> @inhalt
            """, ("@id", info.Id), ("@inhalt", inhalt));
        p.Add(("@inhalt", inhalt));
        p.Add(("@groesse", inhalt.LongLength));
        p.Add(("@gespeichert", Zeit(DateTime.Now)));
        var n = Zeilen(c, t, """
            UPDATE dokumente SET name = @name, besitzer = @besitzer, erstellt = @erstellt, geaendert = @geaendert, herkunft = @herkunft, info = @info,
                inhalt = @inhalt, groesse = @groesse, gespeichert = @gespeichert WHERE id = @id
            """, p.ToArray());
        Ausfuehren(c, t, """
            DELETE FROM dokument_sicherungen WHERE id = @id AND nr NOT IN
                (SELECT nr FROM dokument_sicherungen WHERE id = @id ORDER BY nr DESC LIMIT @n)
            """, ("@id", info.Id), ("@n", DokumentSicherungenBehalten));
        return n > 0;
    });

    internal static void DokumentSicherungEinfuegen(SqliteConnection c, SqliteTransaction t, string id, DateTime zeit, byte[] inhalt) =>
        Ausfuehren(c, t, "INSERT INTO dokument_sicherungen (id, zeit, inhalt, groesse) VALUES (@id, @zeit, @inhalt, @groesse)",
            ("@id", id), ("@zeit", Zeit(zeit)), ("@inhalt", inhalt), ("@groesse", inhalt.LongLength));

    /// <summary>Löscht das Dokument samt Sicherungsständen und Abgleich-Einstellungen.</summary>
    public void DokumentLoeschen(string id) => Schreiben((c, t) =>
    {
        Ausfuehren(c, t, "DELETE FROM dokumente WHERE id = @id", ("@id", id));
        Ausfuehren(c, t, "DELETE FROM ablage WHERE bereich = @b AND schluessel = @id", ("@b", Ablagebereiche.UntPlanWeb), ("@id", id));
    });

    /// <summary>Ältere Fassungen eines Dokuments, neueste zuerst.</summary>
    public List<DokumentSicherung> DokumentSicherungen(string id) => Lesen(c =>
    {
        using var cmd = Befehl(c, null, "SELECT nr, id, zeit, groesse FROM dokument_sicherungen WHERE id = @id ORDER BY nr DESC", ("@id", id));
        using var r = cmd.ExecuteReader();
        var l = new List<DokumentSicherung>();
        while (r.Read()) l.Add(new DokumentSicherung(r.GetInt64(0), r.GetString(1), Zeit(r.GetString(2)), r.GetInt64(3)));
        return l;
    });

    public byte[]? DokumentSicherungInhalt(long nr) => Lesen(c => Skalar(c, null, "SELECT inhalt FROM dokument_sicherungen WHERE nr = @nr", ("@nr", nr)) as byte[]);

    // ---------------------------------------------------------------------------------------------- Sicherung der Datenbank

    /// <summary>Konsistente Sicherung (<c>VACUUM INTO</c>) nach <c>sicherungen/studio-&lt;zeit&gt;.db</c>; ältere über die Anzahl hinaus werden gelöscht.</summary>
    public DatenbankSicherung Sichern() => Sichern(Pfad, Sicherungsordner, SicherungenBehalten);

    /// <summary>Sicherung einer vorhandenen Datenbankdatei, ohne sie anzulegen oder zu migrieren (Kommandozeile <c>--sichern</c>).</summary>
    public static DatenbankSicherung Sichern(string datenbank, string ordner, int behalten)
    {
        if (!File.Exists(datenbank)) throw new FileNotFoundException("Die Datenbank gibt es nicht.", datenbank);
        Directory.CreateDirectory(ordner);
        var zeit = DateTime.Now;
        var name = $"studio-{zeit:yyyyMMdd-HHmmss}.db";
        for (var i = 2; File.Exists(Path.Combine(ordner, name)); i++) name = $"studio-{zeit:yyyyMMdd-HHmmss}-{i}.db";
        var ziel = Path.Combine(ordner, name);
        var tmp = ziel + ".tmp";
        if (File.Exists(tmp)) File.Delete(tmp);
        using (var c = Oeffnen(Verbindungstext(datenbank, SqliteOpenMode.ReadWrite)))
            Ausfuehren(c, null, "VACUUM INTO @ziel", ("@ziel", tmp));
        File.Move(tmp, ziel);
        Aufraeumen(ordner, behalten);
        var fi = new FileInfo(ziel);
        return new DatenbankSicherung(name, ziel, fi.Length, fi.LastWriteTime);
    }

    /// <summary>Vorhandene Sicherungen, neueste zuerst.</summary>
    public List<DatenbankSicherung> Sicherungen() => Sicherungen(Sicherungsordner);

    private static List<DatenbankSicherung> Sicherungen(string ordner) =>
        !Directory.Exists(ordner) ? new() : new DirectoryInfo(ordner).EnumerateFiles("studio-*.db")
            .OrderByDescending(f => f.LastWriteTimeUtc).ThenByDescending(f => f.Name, StringComparer.Ordinal)
            .Select(f => new DatenbankSicherung(f.Name, f.FullName, f.Length, f.LastWriteTime)).ToList();

    private static void Aufraeumen(string ordner, int behalten)
    {
        foreach (var alt in Sicherungen(ordner).Skip(Math.Max(1, behalten)))
            try { File.Delete(alt.Pfad); } catch (IOException) { } catch (UnauthorizedAccessException) { }
    }
}

/// <summary>Hintergrunddienst: sichert die Datenbank einmal täglich (zusätzlich zur Sicherung vor jedem Update beim Start).</summary>
public sealed class Sicherungsdienst : BackgroundService
{
    public static readonly TimeSpan Abstand = TimeSpan.FromHours(24);
    private readonly StudioDatenbank _db;
    private readonly ILogger<Sicherungsdienst> _log;

    public Sicherungsdienst(StudioDatenbank db, ILogger<Sicherungsdienst> log)
    {
        _db = db;
        _log = log;
    }

    /// <summary>Sichert, wenn die letzte Sicherung länger als <see cref="Abstand"/> zurückliegt. Liefert die neue Sicherung oder null.</summary>
    public DatenbankSicherung? FaelligeSicherung()
    {
        var letzte = _db.Sicherungen().FirstOrDefault();
        if (letzte != null && DateTime.Now - letzte.Zeit < Abstand) return null;
        var s = _db.Sichern();
        _log.LogInformation("Tägliche Datenbanksicherung: {Datei}", s.Datei);
        return s;
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        try
        {
            await Task.Delay(TimeSpan.FromMinutes(1), ct);
            while (!ct.IsCancellationRequested)
            {
                try { FaelligeSicherung(); }
                catch (Exception ex) when (ex is SqliteException or IOException or UnauthorizedAccessException) { _log.LogError(ex, "Tägliche Datenbanksicherung fehlgeschlagen"); }
                await Task.Delay(TimeSpan.FromHours(1), ct);
            }
        }
        catch (OperationCanceledException) { }
    }
}
