using System.Data.Common;
using System.Globalization;
using System.IO.Compression;
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
    /// <summary>Direkte Übertragung der Vertretungen an EduOrga Web je Dokument (Schlüssel = Dokument-Id, Inhalt = <see cref="UpwDirekt"/>).</summary>
    public const string UntPlanWebDirekt = "untplanweb-direkt";
}

/// <summary>Dokument in der Datenbank (ohne Inhalt).</summary>
public sealed record DokumentZeile(DokumentInfo Info, long Groesse, DateTime? Gespeichert);

/// <summary>Ältere Fassung eines Dokuments (ersetzt die frühere <c>.bak</c>-Datei). <see cref="Art"/>: <c>automatisch</c> oder <c>sicherungspunkt</c>.</summary>
public sealed record DokumentSicherung(long Nr, string DokumentId, DateTime Zeit, long Groesse, string Art = Fassungsarten.Automatisch, string Benutzer = "");

/// <summary>Sicherung der gesamten Datenbank (<c>sicherungen/studio-&lt;zeit&gt;.db</c>).</summary>
public sealed record DatenbankSicherung(string Datei, string Pfad, long Groesse, DateTime Zeit);

public static class Fassungsarten
{
    /// <summary>Beim automatischen Speichern höchstens alle <see cref="StudioKonfiguration.FassungMinuten"/> Minuten: der bisherige Inhalt.</summary>
    public const string Automatisch = "automatisch";
    /// <summary>Ausdrücklich angelegt („Sicherungspunkt anlegen“, Strg+S): der aktuelle Inhalt.</summary>
    public const string Sicherungspunkt = "sicherungspunkt";
}

/// <summary>Wie beim Speichern eines Dokuments ältere Fassungen entstehen.</summary>
/// <param name="Mindestabstand">null = der bisherige Inhalt wird bei jeder Änderung zur Fassung (wie bis Schema 1); sonst nur, wenn die letzte automatische Fassung älter ist</param>
/// <param name="Sicherungspunkt">zusätzlich den neuen Inhalt als Sicherungspunkt ablegen</param>
public sealed record Fassungsregel(TimeSpan? Mindestabstand, bool Sicherungspunkt = false, string Benutzer = "")
{
    public static readonly Fassungsregel Jedesmal = new((TimeSpan?)null);
}

/// <summary>
/// Die eigene Datenbank von EduOrga Studio (unabhängig von EduOrga Web): SQLite (<c>&lt;Datenordner&gt;/studio.db</c>, Standard) oder
/// MySQL/MariaDB (<c>STUDIO_DB=mysql</c>, <see cref="Datenbankanbieter"/>). Arbeitsdokumente samt älterer Fassungen und die <c>ablage</c>
/// für Benutzer, Benutzereinstellungen, MultiUser-Konfiguration und UntPlan-Web-Abgleich. Eine Verbindung je Vorgang (Verbindungspool),
/// Schreibvorgänge in Transaktionen und zusätzlich prozessweit nacheinander. Schema-Version (SQLite <c>PRAGMA user_version</c>, MySQL
/// <c>meta.schemaversion</c>), Migrationen beim Start (SQLite: vorher automatische Sicherung). Beim ersten Start werden Dateien älterer
/// Versionen übernommen (<see cref="AltdatenUebernahme"/>), bei MySQL zusätzlich eine vorhandene <c>studio.db</c>.
/// Inhalte der Schuldateien liegen gzip-komprimiert in der Datenbank (Spalte <c>format</c> = 1; 0 = JSON wie eine *.up-Datei).
/// </summary>
public sealed class StudioDatenbank
{
    public const string Dateiname = "studio.db";
    /// <summary>So viele automatische ältere Fassungen je Dokument bleiben in <c>dokument_sicherungen</c>.</summary>
    public const int DokumentSicherungenBehalten = 10;
    /// <summary>So viele ausdrücklich angelegte Sicherungspunkte je Dokument bleiben.</summary>
    public const int SicherungspunkteBehalten = 20;

    private const int FormatJson = 0;
    private const int FormatGzip = 1;

    public static int SchemaVersion => 2;

    private static readonly JsonSerializerOptions InfoOptionen = new();
    private readonly Datenbankanbieter _anbieter;
    private readonly object _schreibsperre = new();
    private readonly ILogger _log;
    private readonly bool _komprimieren;

    /// <summary>SQLite: Pfad der Datenbankdatei; MySQL: <c>mysql://server:port/datenbank</c>.</summary>
    public string Pfad => _anbieter.Beschreibung;
    public StudioDatenbankart Art => _anbieter.Art;
    public string Sicherungsordner { get; }
    public int SicherungenBehalten { get; }
    /// <summary>Ordner, in den beim ersten Start die Dateien einer älteren Version verschoben wurden (sonst null).</summary>
    public string? Altdatenordner { get; }

    public StudioDatenbank(StudioKonfiguration k, ILogger<StudioDatenbank> log) : this(Datenbankanbieter.Erstellen(k), k, log, true) { }

    internal StudioDatenbank(Datenbankanbieter anbieter, StudioKonfiguration k, ILogger log, bool uebernehmen)
    {
        _log = log;
        _anbieter = anbieter;
        _komprimieren = k.Komprimieren;
        Sicherungsordner = k.Sicherungsordner;
        SicherungenBehalten = Math.Max(1, k.SicherungenBehalten);
        Einrichten();
        if (!uebernehmen) return;
        if (anbieter.Art == StudioDatenbankart.MySql) SqliteUebernehmen(k);
        Altdatenordner = AltdatenUebernahme.Ausfuehren(this, k, log);
    }

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

    internal DbConnection Oeffnen() => _anbieter.Oeffnen();

    internal static DbCommand Befehl(DbConnection c, DbTransaction? t, string sql, params (string Name, object? Wert)[] parameter)
    {
        var cmd = c.CreateCommand();
        cmd.CommandText = sql;
        cmd.Transaction = t;
        foreach (var (name, wert) in parameter)
        {
            var p = cmd.CreateParameter();
            p.ParameterName = name;
            p.Value = wert ?? DBNull.Value;
            cmd.Parameters.Add(p);
        }
        return cmd;
    }

    private static void Ausfuehren(DbConnection c, DbTransaction? t, string sql, params (string, object?)[] p)
    {
        using var cmd = Befehl(c, t, sql, p);
        cmd.ExecuteNonQuery();
    }

    private static int Zeilen(DbConnection c, DbTransaction? t, string sql, params (string, object?)[] p)
    {
        using var cmd = Befehl(c, t, sql, p);
        return cmd.ExecuteNonQuery();
    }

    private static object? Skalar(DbConnection c, DbTransaction? t, string sql, params (string, object?)[] p)
    {
        using var cmd = Befehl(c, t, sql, p);
        var v = cmd.ExecuteScalar();
        return v is DBNull ? null : v;
    }

    internal static string Zeit(DateTime d) => d.ToString("o", CultureInfo.InvariantCulture);

    internal static DateTime Zeit(string s) => DateTime.Parse(s, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind);

    /// <summary>Lesevorgang mit eigener Verbindung.</summary>
    public T Lesen<T>(Func<DbConnection, T> lesen)
    {
        using var c = Oeffnen();
        return lesen(c);
    }

    /// <summary>Schreibvorgang in einer Transaktion (SQLite: BEGIN IMMEDIATE); prozessweit nacheinander.</summary>
    public T Schreiben<T>(Func<DbConnection, DbTransaction, T> schreiben)
    {
        lock (_schreibsperre)
        {
            using var c = Oeffnen();
            using var t = _anbieter.Beginnen(c);
            var erg = schreiben(c, t);
            t.Commit();
            return erg;
        }
    }

    public void Schreiben(Action<DbConnection, DbTransaction> schreiben) => Schreiben((c, t) => { schreiben(c, t); return true; });

    /// <summary>Befehle eines Migrationsskripts (Semikolon am Zeilenende trennt; Zeichenketten enthalten keine Semikolons).</summary>
    private static IEnumerable<string> Befehle(string skript) =>
        skript.Split(";\n").Select(b => b.Trim().TrimEnd(';').Trim()).Where(b => b.Length > 0);

    private void Einrichten()
    {
        _anbieter.Vorbereiten();
        using var c = Oeffnen();
        var version = _anbieter.SchemaVersionLesen(c);
        if (version > SchemaVersion)
            throw new InvalidOperationException($"Die Datenbank {Pfad} stammt von einer neueren Version von EduOrga Studio (Schema {version}, unterstützt bis {SchemaVersion}).");
        if (version > 0)
        {
            // vor jedem Update (neue Programmversion oder Schema-Migration) automatisch sichern
            var alt = Skalar(c, null, "SELECT wert FROM meta WHERE schluessel = 'anwendungsversion'") as string;
            if (version < SchemaVersion || alt != Anwendungsversion)
            {
                if (Art != StudioDatenbankart.Sqlite)
                    _log.LogInformation("Programmversion {Alt} → {Neu} ({Datenbank}): die Sicherung der MySQL/MariaDB-Datenbank übernimmt update.sh (mariadb-dump)", alt ?? "?", Anwendungsversion, Pfad);
                else
                    try
                    {
                        var s = Sichern();
                        _log.LogInformation("Programmversion {Alt} → {Neu}: Datenbank vorher gesichert ({Datei})", alt ?? "?", Anwendungsversion, s.Datei);
                    }
                    catch (Exception ex) when (ex is DbException or IOException or UnauthorizedAccessException)
                    {
                        _log.LogWarning(ex, "Sicherung vor dem Update fehlgeschlagen");
                    }
            }
        }
        for (var v = version; v < SchemaVersion; v++)
        {
            lock (_schreibsperre)
            {
                using var t = _anbieter.Beginnen(c);
                foreach (var befehl in Befehle(_anbieter.Migrationen[v])) Ausfuehren(c, t, befehl);
                _anbieter.SchemaVersionSetzen(c, t, v + 1);
                t.Commit();
            }
            if (version > 0) _log.LogInformation("Datenbank auf Schema-Version {Version} migriert", v + 1);
        }
        Ausfuehren(c, null, _anbieter.Upsert("meta", new[] { "schluessel" }, new[] { "wert" }), ("@schluessel", "anwendungsversion"), ("@wert", Anwendungsversion));
    }

    /// <summary>Datenbank erreichbar und lesbar (für <c>GET /gesundheit</c>).</summary>
    public bool Erreichbar()
    {
        try
        {
            using var c = Oeffnen();
            return _anbieter.SchemaVersionLesen(c) == SchemaVersion && Skalar(c, null, "SELECT count(*) FROM ablage") is not null;
        }
        catch (Exception ex) when (Datenbankanbieter.IstDatenbankfehler(ex))
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
        using var cmd = Befehl(c, null, $"SELECT schluessel, inhalt FROM ablage WHERE bereich = @b ORDER BY {_anbieter.AblageReihenfolge}", ("@b", bereich));
        using var r = cmd.ExecuteReader();
        var l = new List<(string, string)>();
        while (r.Read()) l.Add((r.GetString(0), r.GetString(1)));
        return l;
    });

    public List<string> AblageSchluessel(string bereich) => AblageListe(bereich).Select(e => e.Schluessel).ToList();

    public void AblageSchreiben(string bereich, string schluessel, string inhalt) => Schreiben((c, t) => AblageSchreiben(c, t, bereich, schluessel, inhalt));

    internal void AblageSchreiben(DbConnection c, DbTransaction t, string bereich, string schluessel, string inhalt, DateTime? geaendert = null) =>
        Ausfuehren(c, t, _anbieter.Upsert("ablage", new[] { "bereich", "schluessel" }, new[] { "inhalt", "geaendert" }),
            ("@bereich", bereich), ("@schluessel", schluessel), ("@inhalt", inhalt), ("@geaendert", Zeit(geaendert ?? DateTime.Now)));

    public void AblageLoeschen(string bereich, string schluessel) =>
        Schreiben((c, t) => Ausfuehren(c, t, "DELETE FROM ablage WHERE bereich = @b AND schluessel = @s", ("@b", bereich), ("@s", schluessel)));

    // ---------------------------------------------------------------------------------------------- Inhalt (komprimiert)

    /// <summary>Inhalt für die Datenbank: gzip (schnellste Stufe; JSON schrumpft auf etwa 5–10 %) oder unverändert.</summary>
    private (byte[] Daten, int Format) Verpacken(byte[] inhalt)
    {
        if (!_komprimieren) return (inhalt, FormatJson);
        using var ms = new MemoryStream(inhalt.Length / 8 + 64);
        using (var gz = new GZipStream(ms, CompressionLevel.Fastest, leaveOpen: true)) gz.Write(inhalt);
        return (ms.ToArray(), FormatGzip);
    }

    private static byte[] Auspacken(byte[] daten, int format)
    {
        if (format == FormatJson) return daten;
        if (format != FormatGzip) throw new InvalidDataException($"Unbekanntes Format {format} des Dokumentinhalts.");
        using var gz = new GZipStream(new MemoryStream(daten), CompressionMode.Decompress);
        using var aus = new MemoryStream(daten.Length * 8);
        gz.CopyTo(aus);
        return aus.ToArray();
    }

    private static byte[]? InhaltLesen(DbConnection c, string sql, params (string, object?)[] p)
    {
        using var cmd = Befehl(c, null, sql, p);
        using var r = cmd.ExecuteReader();
        if (!r.Read()) return null;
        return Auspacken((byte[])r.GetValue(0), Convert.ToInt32(r.GetValue(1)));
    }

    // ---------------------------------------------------------------------------------------------- Dokumente

    private const string DokumentSpalten = "id, name, besitzer, erstellt, geaendert, herkunft, groesse, gespeichert";

    private static DokumentZeile DokumentLesen(DbDataReader r) => new(new DokumentInfo
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

    /// <summary>Inhalt der Schuldatei (genau der Inhalt der *.up-Datei, ausgepackt).</summary>
    public byte[]? DokumentInhalt(string id) => Lesen(c => InhaltLesen(c, "SELECT inhalt, format FROM dokumente WHERE id = @id", ("@id", id)));

    public void DokumentAnlegen(DokumentInfo info, byte[] inhalt) => Schreiben((c, t) => DokumentAnlegen(c, t, info, inhalt, DateTime.Now));

    internal void DokumentAnlegen(DbConnection c, DbTransaction t, DokumentInfo info, byte[] inhalt, DateTime? gespeichert)
    {
        var (daten, format) = Verpacken(inhalt);
        Ausfuehren(c, t, """
            INSERT INTO dokumente (id, name, besitzer, erstellt, geaendert, gespeichert, herkunft, info, inhalt, groesse, format)
            VALUES (@id, @name, @besitzer, @erstellt, @geaendert, @gespeichert, @herkunft, @info, @inhalt, @groesse, @format)
            """, ("@id", info.Id), ("@name", info.Name), ("@besitzer", info.Besitzer), ("@erstellt", Zeit(info.Erstellt)), ("@geaendert", Zeit(info.Geaendert)),
            ("@gespeichert", gespeichert is { } g ? Zeit(g) : null), ("@herkunft", info.Herkunft), ("@info", JsonSerializer.Serialize(info, InfoOptionen)),
            ("@inhalt", daten), ("@groesse", inhalt.LongLength), ("@format", format));
    }

    /// <summary>
    /// Speichert Beschreibung und (falls angegeben) Inhalt eines vorhandenen Dokuments in einer Transaktion. Ältere Fassungen nach
    /// <paramref name="regel"/> (Standard: der bisherige Inhalt bei jeder Änderung): automatische Fassungen = der bisherige Inhalt
    /// (die letzten <see cref="DokumentSicherungenBehalten"/> bleiben), Sicherungspunkte = der neue Inhalt (die letzten
    /// <see cref="SicherungspunkteBehalten"/> bleiben). Liefert false, wenn es das Dokument nicht (mehr) gibt.
    /// </summary>
    public bool DokumentSpeichern(DokumentInfo info, byte[]? inhalt, Fassungsregel? regel = null)
    {
        regel ??= Fassungsregel.Jedesmal;
        var verpackt = inhalt is null ? default : Verpacken(inhalt); // außerhalb der Schreibsperre
        return Schreiben((c, t) =>
        {
            var p = new List<(string, object?)>
            {
                ("@id", info.Id), ("@name", info.Name), ("@besitzer", info.Besitzer), ("@erstellt", Zeit(info.Erstellt)), ("@geaendert", Zeit(info.Geaendert)),
                ("@herkunft", info.Herkunft), ("@info", JsonSerializer.Serialize(info, InfoOptionen)),
            };
            if (inhalt is null)
                return Zeilen(c, t, "UPDATE dokumente SET name = @name, besitzer = @besitzer, erstellt = @erstellt, geaendert = @geaendert, herkunft = @herkunft, info = @info WHERE id = @id",
                    p.ToArray()) > 0;
            var jetzt = DateTime.Now;
            var aufraeumen = false;
            if (regel.Mindestabstand is null)
            {
                // bisheriger Inhalt wird Fassung, sofern er sich unterscheidet
                aufraeumen = Zeilen(c, t, """
                    INSERT INTO dokument_sicherungen (id, zeit, inhalt, groesse, format, art, benutzer)
                    SELECT id, COALESCE(gespeichert, geaendert), inhalt, groesse, format, 'automatisch', '' FROM dokumente WHERE id = @id AND (inhalt <> @inhalt OR format <> @format)
                    """, ("@id", info.Id), ("@inhalt", verpackt.Daten), ("@format", verpackt.Format)) > 0;
            }
            else
            {
                // höchstens alle Mindestabstand: der bisherige Inhalt (Kopie innerhalb der Datenbank, ohne Übertragung)
                var letzte = Skalar(c, t, "SELECT zeit FROM dokument_sicherungen WHERE id = @id AND art = 'automatisch' ORDER BY nr DESC LIMIT 1", ("@id", info.Id)) as string;
                if (letzte is null || jetzt - Zeit(letzte) >= regel.Mindestabstand.Value)
                    aufraeumen = Zeilen(c, t, """
                        INSERT INTO dokument_sicherungen (id, zeit, inhalt, groesse, format, art, benutzer)
                        SELECT id, COALESCE(gespeichert, geaendert), inhalt, groesse, format, 'automatisch', '' FROM dokumente WHERE id = @id
                        """, ("@id", info.Id)) > 0;
            }
            p.Add(("@inhalt", verpackt.Daten));
            p.Add(("@groesse", inhalt.LongLength));
            p.Add(("@format", verpackt.Format));
            p.Add(("@gespeichert", Zeit(jetzt)));
            var n = Zeilen(c, t, """
                UPDATE dokumente SET name = @name, besitzer = @besitzer, erstellt = @erstellt, geaendert = @geaendert, herkunft = @herkunft, info = @info,
                    inhalt = @inhalt, groesse = @groesse, format = @format, gespeichert = @gespeichert WHERE id = @id
                """, p.ToArray());
            if (n > 0 && regel.Sicherungspunkt)
            {
                Ausfuehren(c, t, "INSERT INTO dokument_sicherungen (id, zeit, inhalt, groesse, format, art, benutzer) VALUES (@id, @zeit, @inhalt, @groesse, @format, @art, @benutzer)",
                    ("@id", info.Id), ("@zeit", Zeit(jetzt)), ("@inhalt", verpackt.Daten), ("@groesse", inhalt.LongLength), ("@format", verpackt.Format),
                    ("@art", Fassungsarten.Sicherungspunkt), ("@benutzer", regel.Benutzer));
                FassungenAufraeumen(c, t, info.Id, Fassungsarten.Sicherungspunkt, SicherungspunkteBehalten);
            }
            if (aufraeumen) FassungenAufraeumen(c, t, info.Id, Fassungsarten.Automatisch, DokumentSicherungenBehalten);
            return n > 0;
        });
    }

    private static void FassungenAufraeumen(DbConnection c, DbTransaction t, string id, string art, int behalten)
    {
        var nummern = new List<long>();
        using (var cmd = Befehl(c, t, "SELECT nr FROM dokument_sicherungen WHERE id = @id AND art = @art ORDER BY nr DESC", ("@id", id), ("@art", art)))
        using (var r = cmd.ExecuteReader())
            while (r.Read()) nummern.Add(Convert.ToInt64(r.GetValue(0)));
        foreach (var nr in nummern.Skip(behalten)) Ausfuehren(c, t, "DELETE FROM dokument_sicherungen WHERE nr = @nr", ("@nr", nr));
    }

    internal void DokumentSicherungEinfuegen(DbConnection c, DbTransaction t, string id, DateTime zeit, byte[] inhalt)
    {
        var (daten, format) = Verpacken(inhalt);
        Ausfuehren(c, t, "INSERT INTO dokument_sicherungen (id, zeit, inhalt, groesse, format) VALUES (@id, @zeit, @inhalt, @groesse, @format)",
            ("@id", id), ("@zeit", Zeit(zeit)), ("@inhalt", daten), ("@groesse", inhalt.LongLength), ("@format", format));
    }

    /// <summary>Löscht das Dokument samt älteren Fassungen und Abgleich-Einstellungen.</summary>
    public void DokumentLoeschen(string id) => Schreiben((c, t) =>
    {
        Ausfuehren(c, t, "DELETE FROM dokument_sicherungen WHERE id = @id", ("@id", id));
        Ausfuehren(c, t, "DELETE FROM dokumente WHERE id = @id", ("@id", id));
        Ausfuehren(c, t, "DELETE FROM ablage WHERE bereich IN (@b1, @b2) AND schluessel = @id", ("@b1", Ablagebereiche.UntPlanWeb), ("@b2", Ablagebereiche.UntPlanWebDirekt), ("@id", id));
    });

    /// <summary>Ältere Fassungen eines Dokuments, neueste zuerst.</summary>
    public List<DokumentSicherung> DokumentSicherungen(string id) => Lesen(c =>
    {
        using var cmd = Befehl(c, null, "SELECT nr, id, zeit, groesse, art, benutzer FROM dokument_sicherungen WHERE id = @id ORDER BY nr DESC", ("@id", id));
        using var r = cmd.ExecuteReader();
        var l = new List<DokumentSicherung>();
        while (r.Read()) l.Add(new DokumentSicherung(Convert.ToInt64(r.GetValue(0)), r.GetString(1), Zeit(r.GetString(2)), r.GetInt64(3), r.GetString(4), r.GetString(5)));
        return l;
    });

    public byte[]? DokumentSicherungInhalt(long nr) => Lesen(c => InhaltLesen(c, "SELECT inhalt, format FROM dokument_sicherungen WHERE nr = @nr", ("@nr", nr)));

    // ---------------------------------------------------------------------------------------------- Übernahme SQLite → MySQL

    /// <summary>
    /// MySQL/MariaDB ist leer, im Datenordner liegt aber eine <c>studio.db</c> (Umstellung einer bestehenden Installation mit
    /// <c>STUDIO_DB=mysql</c>): alle Dokumente, Fassungen und Einträge der Ablage in einer Transaktion übernehmen. Die Datei bleibt liegen.
    /// </summary>
    private void SqliteUebernehmen(StudioKonfiguration k)
    {
        if (!File.Exists(k.Datenbankpfad) || !IstLeer) return;
        // Quelle zuerst auf den aktuellen Schemastand bringen (sichert vorher, wie beim normalen Start)
        var quelle = new StudioDatenbank(new SqliteAnbieter(k.Datenbankpfad), k, _log, uebernehmen: false);
        int dokumente = 0, fassungen = 0, eintraege = 0;
        using (var q = quelle.Oeffnen())
            Schreiben((c, t) =>
            {
                using (var cmd = Befehl(q, null, "SELECT id, name, besitzer, erstellt, geaendert, gespeichert, herkunft, info, inhalt, groesse, format FROM dokumente"))
                using (var r = cmd.ExecuteReader())
                    while (r.Read())
                    {
                        Ausfuehren(c, t, """
                            INSERT INTO dokumente (id, name, besitzer, erstellt, geaendert, gespeichert, herkunft, info, inhalt, groesse, format)
                            VALUES (@id, @name, @besitzer, @erstellt, @geaendert, @gespeichert, @herkunft, @info, @inhalt, @groesse, @format)
                            """, ("@id", r.GetString(0)), ("@name", r.GetString(1)), ("@besitzer", r.GetString(2)), ("@erstellt", r.GetString(3)), ("@geaendert", r.GetString(4)),
                            ("@gespeichert", r.IsDBNull(5) ? null : r.GetString(5)), ("@herkunft", r.GetString(6)), ("@info", r.GetString(7)), ("@inhalt", (byte[])r.GetValue(8)),
                            ("@groesse", r.GetInt64(9)), ("@format", r.GetInt64(10)));
                        dokumente++;
                    }
                using (var cmd = Befehl(q, null, "SELECT id, zeit, inhalt, groesse, format, art, benutzer FROM dokument_sicherungen ORDER BY nr"))
                using (var r = cmd.ExecuteReader())
                    while (r.Read())
                    {
                        Ausfuehren(c, t, "INSERT INTO dokument_sicherungen (id, zeit, inhalt, groesse, format, art, benutzer) VALUES (@id, @zeit, @inhalt, @groesse, @format, @art, @benutzer)",
                            ("@id", r.GetString(0)), ("@zeit", r.GetString(1)), ("@inhalt", (byte[])r.GetValue(2)), ("@groesse", r.GetInt64(3)), ("@format", r.GetInt64(4)),
                            ("@art", r.GetString(5)), ("@benutzer", r.GetString(6)));
                        fassungen++;
                    }
                using (var cmd = Befehl(q, null, "SELECT bereich, schluessel, inhalt, geaendert FROM ablage ORDER BY rowid"))
                using (var r = cmd.ExecuteReader())
                    while (r.Read())
                    {
                        AblageSchreiben(c, t, r.GetString(0), r.GetString(1), r.GetString(2), Zeit(r.GetString(3)));
                        eintraege++;
                    }
            });
        SqliteConnection.ClearAllPools();
        _log.LogInformation("Daten aus {Quelle} nach {Ziel} übernommen: {Dokumente} Dokumente, {Fassungen} ältere Fassungen, {Eintraege} Einträge (Benutzer, Einstellungen …). "
            + "Die Datei bleibt unverändert liegen und wird nicht mehr verwendet.", k.Datenbankpfad, Pfad, dokumente, fassungen, eintraege);
    }

    // ---------------------------------------------------------------------------------------------- Sicherung der Datenbank

    /// <summary>Hinweis, wenn die Datenbank nicht selbst gesichert werden kann (MySQL/MariaDB).</summary>
    public const string MySqlSicherungHinweis =
        "EduOrga Studio verwendet MySQL/MariaDB – die Sicherung übernimmt der Datenbankserver (z. B. ./update.sh mit mariadb-dump oder mysqldump --single-transaction).";

    /// <summary>Kann das Studio die Datenbank selbst sichern (nur SQLite)?</summary>
    public bool KannSichern => Art == StudioDatenbankart.Sqlite;

    /// <summary>Konsistente Sicherung (<c>VACUUM INTO</c>) nach <c>sicherungen/studio-&lt;zeit&gt;.db</c>; ältere über die Anzahl hinaus werden gelöscht.</summary>
    public DatenbankSicherung Sichern() => _anbieter is SqliteAnbieter s
        ? Sichern(s.Pfad, Sicherungsordner, SicherungenBehalten)
        : throw StudioFehler.Ungueltig(MySqlSicherungHinweis);

    /// <summary>Sicherung einer vorhandenen Datenbankdatei, ohne sie anzulegen oder zu migrieren (Kommandozeile <c>--sichern</c>).</summary>
    public static DatenbankSicherung Sichern(string datenbank, string ordner, int behalten)
    {
        if (!File.Exists(datenbank)) throw new FileNotFoundException("Die Datenbank gibt es nicht.", datenbank);
        Directory.CreateDirectory(ordner);
        var stempel = $"{DateTime.Now:yyyyMMdd-HHmmss}";
        // mehrere Sicherungen in derselben Sekunde: fortlaufend nummeriert (auch wenn ältere schon aufgeräumt sind)
        var nr = Sicherungen(ordner).Select(x => Sortierschluessel(x.Datei)).Where(x => x.Zeit == stempel).Select(x => x.Nr).DefaultIfEmpty(0).Max() + 1;
        var name = nr == 1 ? $"studio-{stempel}.db" : $"studio-{stempel}-{nr}.db";
        var ziel = Path.Combine(ordner, name);
        var tmp = ziel + ".tmp";
        if (File.Exists(tmp)) File.Delete(tmp);
        using (var c = SqliteAnbieter.Oeffnen(SqliteAnbieter.Verbindungstext(datenbank, SqliteOpenMode.ReadWrite)))
            Ausfuehren(c, null, "VACUUM INTO @ziel", ("@ziel", tmp));
        File.Move(tmp, ziel);
        var fi = new FileInfo(ziel);
        var erg = new DatenbankSicherung(name, ziel, fi.Length, fi.LastWriteTime);
        Aufraeumen(ordner, behalten);
        return erg;
    }

    /// <summary>Vorhandene Sicherungen, neueste zuerst.</summary>
    public List<DatenbankSicherung> Sicherungen() => Sicherungen(Sicherungsordner);

    private static List<DatenbankSicherung> Sicherungen(string ordner) =>
        !Directory.Exists(ordner) ? new() : new DirectoryInfo(ordner).EnumerateFiles("studio-*.db")
            .Select(f => (Datei: f, Schluessel: Sortierschluessel(f.Name))).OrderByDescending(x => x.Schluessel.Zeit, StringComparer.Ordinal)
            .ThenByDescending(x => x.Schluessel.Nr).ThenByDescending(x => x.Datei.LastWriteTimeUtc).Select(x => x.Datei)
            .Select(f => new DatenbankSicherung(f.Name, f.FullName, f.Length, f.LastWriteTime)).ToList();

    /// <summary>Reihenfolge aus dem Namen <c>studio-&lt;yyyyMMdd-HHmmss&gt;[-n].db</c> (genauer als die Änderungszeit der Datei).</summary>
    private static (string Zeit, int Nr) Sortierschluessel(string name)
    {
        var kern = Path.GetFileNameWithoutExtension(name)["studio-".Length..];
        var teile = kern.Split('-');
        return teile.Length == 3 && int.TryParse(teile[2], out var nr) ? (teile[0] + "-" + teile[1], nr) : (kern, 1);
    }

    private static void Aufraeumen(string ordner, int behalten)
    {
        foreach (var alt in Sicherungen(ordner).Skip(Math.Max(1, behalten)))
            try { File.Delete(alt.Pfad); } catch (IOException) { } catch (UnauthorizedAccessException) { }
    }
}

/// <summary>Hintergrunddienst: sichert die Datenbank einmal täglich (zusätzlich zur Sicherung vor jedem Update beim Start). Nur SQLite.</summary>
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
        if (!_db.KannSichern) return null;
        var letzte = _db.Sicherungen().FirstOrDefault();
        if (letzte != null && DateTime.Now - letzte.Zeit < Abstand) return null;
        var s = _db.Sichern();
        _log.LogInformation("Tägliche Datenbanksicherung: {Datei}", s.Datei);
        return s;
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        if (!_db.KannSichern)
        {
            _log.LogInformation(StudioDatenbank.MySqlSicherungHinweis);
            return;
        }
        try
        {
            await Task.Delay(TimeSpan.FromMinutes(1), ct);
            while (!ct.IsCancellationRequested)
            {
                try { FaelligeSicherung(); }
                catch (Exception ex) when (ex is DbException or IOException or UnauthorizedAccessException) { _log.LogError(ex, "Tägliche Datenbanksicherung fehlgeschlagen"); }
                await Task.Delay(TimeSpan.FromHours(1), ct);
            }
        }
        catch (OperationCanceledException) { }
    }
}
