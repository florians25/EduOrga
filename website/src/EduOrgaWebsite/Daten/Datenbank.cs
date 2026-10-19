using System.Globalization;
using System.Text.Json;
using EduOrgaWebsite.Dienste;
using Microsoft.Data.Sqlite;

namespace EduOrgaWebsite.Daten;

/// <summary>
/// Eigene SQLite-Datenbank der Website (website.db im Datenordner). Einträge des Portals, Verlauf und Administratoren.
/// Das Schema wird beim Start angelegt bzw. über PRAGMA user_version fortgeschrieben.
/// </summary>
public sealed class Datenbank
{
    private const int Schemaversion = 1;
    private readonly string _verbindung;
    private readonly TimeProvider _zeit;

    public Datenbank(WebsiteKonfiguration k, TimeProvider zeit)
    {
        Directory.CreateDirectory(k.Datenordner);
        _verbindung = new SqliteConnectionStringBuilder { DataSource = k.Datenbankpfad, Pooling = true }.ToString();
        _zeit = zeit;
    }

    public SqliteConnection Oeffnen()
    {
        var c = new SqliteConnection(_verbindung);
        c.Open();
        using var p = c.CreateCommand();
        p.CommandText = "PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;";
        p.ExecuteNonQuery();
        return c;
    }

    public void Vorbereiten()
    {
        using var c = Oeffnen();
        using (var wal = c.CreateCommand()) { wal.CommandText = "PRAGMA journal_mode = WAL;"; wal.ExecuteNonQuery(); }
        var version = Convert.ToInt32(Skalar(c, "PRAGMA user_version;"));
        if (version >= Schemaversion) return;
        using var t = c.BeginTransaction();
        Ausfuehren(c, """
            CREATE TABLE IF NOT EXISTS eintraege (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              typ TEXT NOT NULL,
              titel TEXT NOT NULL,
              beschreibung TEXT NOT NULL,
              modul TEXT NOT NULL,
              email TEXT NULL,
              status TEXT NOT NULL,
              prioritaet TEXT NOT NULL DEFAULT 'keine',
              tags TEXT NOT NULL DEFAULT '[]',
              position REAL NOT NULL DEFAULT 0,
              interne_notiz TEXT NOT NULL DEFAULT '',
              oeffentliche_antwort TEXT NOT NULL DEFAULT '',
              ablehnungsgrund TEXT NOT NULL DEFAULT '',
              oeffentlich INTEGER NOT NULL DEFAULT 1,
              erstellt_am TEXT NOT NULL,
              geaendert_am TEXT NOT NULL,
              abgeschlossen_am TEXT NULL
            );
            CREATE INDEX IF NOT EXISTS ix_eintraege_status ON eintraege(status, position);
            CREATE TABLE IF NOT EXISTS verlauf (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              eintrag_id INTEGER NOT NULL REFERENCES eintraege(id) ON DELETE CASCADE,
              zeit TEXT NOT NULL,
              benutzer TEXT NOT NULL,
              aktion TEXT NOT NULL,
              details TEXT NOT NULL DEFAULT ''
            );
            CREATE INDEX IF NOT EXISTS ix_verlauf_eintrag ON verlauf(eintrag_id, id);
            CREATE TABLE IF NOT EXISTS benutzer (
              name TEXT PRIMARY KEY COLLATE NOCASE,
              passwort TEXT NOT NULL,
              erstellt_am TEXT NOT NULL
            );
            """, t);
        Ausfuehren(c, $"PRAGMA user_version = {Schemaversion};", t);
        t.Commit();
    }

    internal string Jetzt() => _zeit.GetUtcNow().ToString("O", CultureInfo.InvariantCulture);
    internal DateTimeOffset JetztZeit() => _zeit.GetUtcNow();

    internal static object? Skalar(SqliteConnection c, string sql, SqliteTransaction? t = null, params (string, object?)[] p)
    {
        using var cmd = Befehl(c, sql, t, p);
        return cmd.ExecuteScalar();
    }

    internal static int Ausfuehren(SqliteConnection c, string sql, SqliteTransaction? t = null, params (string, object?)[] p)
    {
        using var cmd = Befehl(c, sql, t, p);
        return cmd.ExecuteNonQuery();
    }

    internal static SqliteCommand Befehl(SqliteConnection c, string sql, SqliteTransaction? t, (string, object?)[] p)
    {
        var cmd = c.CreateCommand();
        cmd.CommandText = sql;
        cmd.Transaction = t;
        foreach (var (n, w) in p) cmd.Parameters.AddWithValue(n, w ?? DBNull.Value);
        return cmd;
    }

    internal static string TagsJson(IEnumerable<string> tags) => JsonSerializer.Serialize(tags);
    internal static List<string> TagsLesen(string json)
    {
        try { return JsonSerializer.Deserialize<List<string>>(json) ?? []; }
        catch (JsonException) { return []; }
    }

    /// <summary>Konsistente Kopie der Datenbank nach sicherungen/ schreiben (VACUUM INTO), alte Sicherungen aufräumen.</summary>
    public static string Sichern(WebsiteKonfiguration k)
    {
        Directory.CreateDirectory(k.Sicherungsordner);
        var ziel = Path.Combine(k.Sicherungsordner, $"website-{DateTime.Now:yyyyMMdd-HHmmss}.db");
        using (var c = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = k.Datenbankpfad, Mode = SqliteOpenMode.ReadOnly }.ToString()))
        {
            c.Open();
            Ausfuehren(c, "VACUUM INTO $ziel;", null, ("$ziel", ziel));
        }
        foreach (var alt in new DirectoryInfo(k.Sicherungsordner).GetFiles("website-*.db").OrderByDescending(f => f.Name).Skip(k.SicherungenBehalten))
            alt.Delete();
        return ziel;
    }
}
