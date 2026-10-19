using System.Data.Common;
using Microsoft.Data.Sqlite;
using MySqlConnector;
using UntPlanStudio.Grundlagen;

namespace UntPlanStudio.Dienste;

/// <summary>Datenbank des Studios: SQLite (Standard, Datei <c>studio.db</c>) oder MySQL/MariaDB (<c>STUDIO_DB=mysql</c>).</summary>
public enum StudioDatenbankart { Sqlite, MySql }

/// <summary>
/// Kleine Provider-Abstraktion der Studio-Datenbank: Verbindung, Schema (Migrationen je Datenbank, gleiches Schema), Schema-Version
/// und die wenigen SQL-Stellen, die sich zwischen SQLite und MySQL/MariaDB unterscheiden (Upsert, Reihenfolge des Anlegens).
/// Alles andere in <see cref="StudioDatenbank"/> ist Standard-SQL über <see cref="DbConnection"/>.
/// </summary>
public abstract class Datenbankanbieter
{
    public abstract StudioDatenbankart Art { get; }

    /// <summary>Für Protokoll und Fehlermeldungen: Pfad der Datei bzw. <c>mysql://server/datenbank</c> (ohne Passwort).</summary>
    public abstract string Beschreibung { get; }

    /// <summary>Migrationen: Eintrag i hebt das Schema von Version i auf i + 1 (je Anbieter dieselben Tabellen und Spalten).</summary>
    public abstract IReadOnlyList<string> Migrationen { get; }

    public abstract DbConnection Oeffnen();

    /// <summary>Schreibtransaktion (SQLite: <c>BEGIN IMMEDIATE</c>, MySQL: InnoDB, READ COMMITTED).</summary>
    public abstract DbTransaction Beginnen(DbConnection c);

    /// <summary>Wird einmal beim Start vor den Migrationen aufgerufen (SQLite: WAL; MySQL: Datenbank anlegen, auf den Server warten).</summary>
    public abstract void Vorbereiten();

    public abstract int SchemaVersionLesen(DbConnection c);
    public abstract void SchemaVersionSetzen(DbConnection c, DbTransaction t, int version);

    /// <summary><c>INSERT … ON CONFLICT … DO UPDATE</c> bzw. <c>ON DUPLICATE KEY UPDATE</c> für die Tabelle <c>ablage</c> und <c>meta</c>.</summary>
    public abstract string Upsert(string tabelle, string[] schluessel, string[] spalten);

    /// <summary>Spalte für „Reihenfolge des Anlegens“ in <c>ablage</c> (SQLite: rowid, MySQL: Spalte nr).</summary>
    public abstract string AblageReihenfolge { get; }

    /// <summary>Ist die Ausnahme ein Datenbankfehler (Verbindung, SQL)?</summary>
    public static bool IstDatenbankfehler(Exception ex) => ex is DbException or InvalidOperationException or IOException or TimeoutException;

    public static Datenbankanbieter Erstellen(StudioKonfiguration k) => k.Datenbank == StudioDatenbankart.MySql
        ? new MySqlAnbieter(k.DatenbankVerbindung ?? throw new InvalidOperationException("Für STUDIO_DB=mysql bitte STUDIO_DB_CONNECTION setzen (z. B. Server=untplannext-mariadb;Database=eduorga_studio;User ID=…;Password=…)."),
            k.DatenbankWarten)
        : new SqliteAnbieter(k.Datenbankpfad);

    protected static void Ausfuehren(DbConnection c, DbTransaction? t, string sql)
    {
        using var cmd = c.CreateCommand();
        cmd.Transaction = t;
        cmd.CommandText = sql;
        cmd.ExecuteNonQuery();
    }

    protected static object? Skalar(DbConnection c, DbTransaction? t, string sql)
    {
        using var cmd = c.CreateCommand();
        cmd.Transaction = t;
        cmd.CommandText = sql;
        var v = cmd.ExecuteScalar();
        return v is DBNull ? null : v;
    }
}

/// <summary>SQLite: <c>&lt;Datenordner&gt;/studio.db</c>, WAL-Modus, Verbindungspool, Schema-Version in <c>PRAGMA user_version</c>.</summary>
public sealed class SqliteAnbieter : Datenbankanbieter
{
    private readonly string _verbindung;

    public SqliteAnbieter(string pfad)
    {
        Pfad = pfad;
        Directory.CreateDirectory(Path.GetDirectoryName(pfad)!);
        _verbindung = Verbindungstext(pfad, SqliteOpenMode.ReadWriteCreate);
    }

    public string Pfad { get; }
    public override StudioDatenbankart Art => StudioDatenbankart.Sqlite;
    public override string Beschreibung => Pfad;
    public override string AblageReihenfolge => "rowid";

    public static string Verbindungstext(string pfad, SqliteOpenMode modus) =>
        new SqliteConnectionStringBuilder { DataSource = pfad, Mode = modus, Pooling = true, DefaultTimeout = 30 }.ToString();

    public override DbConnection Oeffnen() => Oeffnen(_verbindung);

    public static SqliteConnection Oeffnen(string verbindung)
    {
        var c = new SqliteConnection(verbindung);
        c.Open();
        using var cmd = c.CreateCommand();
        cmd.CommandText = "PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;";
        cmd.ExecuteNonQuery();
        return c;
    }

    // Microsoft.Data.Sqlite: BeginTransaction() = BEGIN IMMEDIATE (Schreibsperre sofort, kein späteres SQLITE_BUSY beim Hochstufen)
    public override DbTransaction Beginnen(DbConnection c) => ((SqliteConnection)c).BeginTransaction(deferred: false);

    public override void Vorbereiten()
    {
        using var c = Oeffnen();
        Ausfuehren(c, null, "PRAGMA journal_mode=WAL;");
    }

    public override int SchemaVersionLesen(DbConnection c) => Convert.ToInt32(Skalar(c, null, "PRAGMA user_version;"));

    public override void SchemaVersionSetzen(DbConnection c, DbTransaction t, int version) => Ausfuehren(c, t, $"PRAGMA user_version = {version};");

    public override string Upsert(string tabelle, string[] schluessel, string[] spalten) =>
        $"INSERT INTO {tabelle} ({string.Join(", ", schluessel.Concat(spalten))}) VALUES ({string.Join(", ", schluessel.Concat(spalten).Select(s => "@" + s))}) " +
        $"ON CONFLICT({string.Join(", ", schluessel)}) DO UPDATE SET {string.Join(", ", spalten.Select(s => $"{s} = excluded.{s}"))}";

    private static readonly string[] Schema =
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
        // 2: Inhalt optional komprimiert (format 0 = JSON wie *.up, 1 = gzip), Art der Fassung (automatisch/Sicherungspunkt) und wer sie angelegt hat
        """
        ALTER TABLE dokumente ADD COLUMN format INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE dokument_sicherungen ADD COLUMN format INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE dokument_sicherungen ADD COLUMN art TEXT NOT NULL DEFAULT 'automatisch';
        ALTER TABLE dokument_sicherungen ADD COLUMN benutzer TEXT NOT NULL DEFAULT '';
        """,
    };

    public override IReadOnlyList<string> Migrationen => Schema;
}

/// <summary>
/// MySQL/MariaDB (InnoDB, utf8mb4): Verbindung aus <c>STUDIO_DB_CONNECTION</c> (<c>Server=…;Database=…;User ID=…;Password=…</c> oder
/// <c>mysql://benutzer:passwort@host:3306/datenbank</c>). Fehlt die Datenbank, wird sie angelegt (sofern der Benutzer das darf).
/// Schema-Version in <c>meta</c> (<c>schemaversion</c>). Große Schuldateien brauchen <c>max_allowed_packet</c> ≥ 64 MB (die Inhalte
/// werden komprimiert gespeichert, typischerweise 5–10 % der JSON-Größe).
/// </summary>
public sealed class MySqlAnbieter : Datenbankanbieter
{
    private const string Tabellenoptionen = "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin";
    private readonly TimeSpan _warten;

    public MySqlAnbieter(string verbindung, TimeSpan? warten = null)
    {
        Verbindung = Verbindungstext(verbindung);
        var b = new MySqlConnectionStringBuilder(Verbindung);
        Datenbankname = b.Database;
        if (string.IsNullOrWhiteSpace(Datenbankname)) throw new InvalidOperationException("STUDIO_DB_CONNECTION nennt keine Datenbank (Database=…).");
        Beschreibung = $"mysql://{b.Server}:{b.Port}/{b.Database}";
        _warten = warten ?? TimeSpan.FromSeconds(60);
    }

    public string Verbindung { get; }
    public string Datenbankname { get; }
    public override StudioDatenbankart Art => StudioDatenbankart.MySql;
    public override string Beschreibung { get; }
    public override string AblageReihenfolge => "nr";

    /// <summary>Verbindungszeichenfolge vervollständigen (utf8mb4, Befehle ohne ausdrückliche Transaktion zulassen); auch als URL.</summary>
    public static string Verbindungstext(string eingabe)
    {
        var b = new MySqlConnectionStringBuilder();
        if (Uri.TryCreate(eingabe.Trim(), UriKind.Absolute, out var u) && u.Scheme is "mysql" or "mariadb")
        {
            b.Server = u.Host;
            b.Port = u.Port > 0 ? (uint)u.Port : 3306;
            b.Database = Uri.UnescapeDataString(u.AbsolutePath.Trim('/'));
            var teile = u.UserInfo.Split(':', 2);
            b.UserID = Uri.UnescapeDataString(teile[0]);
            if (teile.Length > 1) b.Password = Uri.UnescapeDataString(teile[1]);
        }
        else b.ConnectionString = eingabe;
        b.CharacterSet = "utf8mb4";
        b.IgnoreCommandTransaction = true;
        b.AllowUserVariables = false;
        return b.ConnectionString;
    }

    public override DbConnection Oeffnen()
    {
        var c = new MySqlConnection(Verbindung);
        c.Open();
        using var cmd = c.CreateCommand();
        cmd.CommandText = "SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'; SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED";
        cmd.ExecuteNonQuery();
        return c;
    }

    public override DbTransaction Beginnen(DbConnection c) => c.BeginTransaction(System.Data.IsolationLevel.ReadCommitted);

    public override void Vorbereiten()
    {
        var ende = DateTime.UtcNow + _warten;
        while (true)
        {
            try
            {
                using var c = Oeffnen();
                return;
            }
            catch (MySqlException ex) when (ex.ErrorCode == MySqlErrorCode.UnknownDatabase)
            {
                // Datenbank fehlt (z. B. vorhandenes MariaDB-Volume ohne eduorga_studio): selbst anlegen, sofern erlaubt
                var ohne = new MySqlConnectionStringBuilder(Verbindung) { Database = "" };
                using var c = new MySqlConnection(ohne.ConnectionString);
                c.Open();
                using var cmd = c.CreateCommand();
                cmd.CommandText = $"CREATE DATABASE IF NOT EXISTS `{Datenbankname.Replace("`", "``")}` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin";
                try { cmd.ExecuteNonQuery(); }
                catch (MySqlException e) when (e.ErrorCode is MySqlErrorCode.DatabaseAccessDenied or MySqlErrorCode.AccessDenied)
                {
                    throw new InvalidOperationException($"Die Datenbank {Datenbankname} gibt es nicht und der Benutzer {ohne.UserID} darf sie nicht anlegen. " +
                        $"Bitte als root anlegen: CREATE DATABASE {Datenbankname} CHARACTER SET utf8mb4; GRANT ALL ON {Datenbankname}.* TO '{ohne.UserID}'@'%';", e);
                }
            }
            catch (MySqlException ex) when (DateTime.UtcNow < ende && NichtErreichbar(ex))
            {
                Thread.Sleep(2000); // Datenbankserver startet noch (Container)
            }
        }
    }

    /// <summary>Server (noch) nicht erreichbar – z. B. Container startet; andere Fehler (Anmeldung, SQL) sofort melden.</summary>
    private static bool NichtErreichbar(MySqlException ex) => ex.ErrorCode is MySqlErrorCode.UnableToConnectToHost or MySqlErrorCode.ServerShutdown
        or MySqlErrorCode.ConnectionCountError || (int)ex.ErrorCode is 2002 or 2003 or 2006 or 2013 || ex.InnerException is System.Net.Sockets.SocketException;

    public override int SchemaVersionLesen(DbConnection c)
    {
        if (Convert.ToInt64(Skalar(c, null, "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'meta'")) == 0) return 0;
        return Skalar(c, null, "SELECT wert FROM meta WHERE schluessel = 'schemaversion'") is string s && int.TryParse(s, out var v) ? v : 0;
    }

    public override void SchemaVersionSetzen(DbConnection c, DbTransaction t, int version) =>
        Ausfuehren(c, t, $"INSERT INTO meta (schluessel, wert) VALUES ('schemaversion', '{version}') ON DUPLICATE KEY UPDATE wert = VALUES(wert)");

    public override string Upsert(string tabelle, string[] schluessel, string[] spalten) =>
        $"INSERT INTO {tabelle} ({string.Join(", ", schluessel.Concat(spalten))}) VALUES ({string.Join(", ", schluessel.Concat(spalten).Select(s => "@" + s))}) " +
        $"ON DUPLICATE KEY UPDATE {string.Join(", ", spalten.Select(s => $"{s} = VALUES({s})"))}";

    // Gleiche Tabellen und Spalten wie bei SQLite (Stand Schema 2). Hinweis: DDL ist in MySQL nicht transaktional – jede Migration
    // besteht deshalb aus Befehlen, die sich nach einem Abbruch gefahrlos erneut ausführen lassen (CREATE TABLE IF NOT EXISTS).
    // Künftige Spaltenänderungen: je Anbieter eine eigene Migration (MySQL 8 kennt kein ADD COLUMN IF NOT EXISTS – vorher prüfen).
    private static readonly string[] Schema =
    {
        $"""
        CREATE TABLE IF NOT EXISTS meta (
            schluessel VARCHAR(191) NOT NULL PRIMARY KEY,
            wert       LONGTEXT NOT NULL
        ) {Tabellenoptionen};
        CREATE TABLE IF NOT EXISTS dokumente (
            id          VARCHAR(32) NOT NULL PRIMARY KEY,
            name        VARCHAR(1000) NOT NULL,
            besitzer    VARCHAR(255) NOT NULL DEFAULT '',
            erstellt    VARCHAR(40) NOT NULL,
            geaendert   VARCHAR(40) NOT NULL,
            gespeichert VARCHAR(40) NULL,
            herkunft    VARCHAR(1000) NOT NULL DEFAULT '',
            info        LONGTEXT NOT NULL,
            inhalt      LONGBLOB NOT NULL,
            groesse     BIGINT NOT NULL,
            format      INT NOT NULL DEFAULT 0
        ) {Tabellenoptionen};
        CREATE TABLE IF NOT EXISTS dokument_sicherungen (
            nr      BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            id      VARCHAR(32) NOT NULL,
            zeit    VARCHAR(40) NOT NULL,
            inhalt  LONGBLOB NOT NULL,
            groesse BIGINT NOT NULL,
            format  INT NOT NULL DEFAULT 0,
            art     VARCHAR(20) NOT NULL DEFAULT 'automatisch',
            benutzer VARCHAR(255) NOT NULL DEFAULT '',
            KEY ix_dokument_sicherungen_id (id, nr),
            CONSTRAINT fk_dokument_sicherungen_id FOREIGN KEY (id) REFERENCES dokumente(id) ON DELETE CASCADE
        ) {Tabellenoptionen};
        CREATE TABLE IF NOT EXISTS ablage (
            bereich    VARCHAR(64) NOT NULL,
            schluessel VARCHAR(191) NOT NULL,
            inhalt     LONGTEXT NOT NULL,
            geaendert  VARCHAR(40) NOT NULL,
            nr         BIGINT NOT NULL AUTO_INCREMENT,
            PRIMARY KEY (bereich, schluessel),
            UNIQUE KEY ux_ablage_nr (nr)
        ) {Tabellenoptionen};
        """,
        // 2: bei MySQL/MariaDB schon in Version 1 enthalten (format, art, benutzer) – MySQL gibt es für das Studio erst ab Schema 2
        "",
    };

    public override IReadOnlyList<string> Migrationen => Schema;
}
