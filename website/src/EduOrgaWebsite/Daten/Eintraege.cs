using System.Globalization;
using Microsoft.Data.Sqlite;

namespace EduOrgaWebsite.Daten;

/// <summary>Fehler, die als Meldung an die Oberfläche gehen (HTTP 400 bzw. 404/409).</summary>
public sealed class Fachfehler(string meldung, int code = 400) : Exception(meldung)
{
    public int Code { get; } = code;
}

public sealed record Filter(string? Suche = null, string? Status = null, string? Modul = null, string? Typ = null, string? Prioritaet = null, string? Tag = null);

/// <summary>Änderbare Felder eines Eintrags (null = unverändert).</summary>
public sealed record Aenderung(
    string? Titel = null, string? Beschreibung = null, string? Typ = null, string? Modul = null, string? Prioritaet = null,
    List<string>? Tags = null, string? InterneNotiz = null, string? OeffentlicheAntwort = null, bool? Oeffentlich = null,
    bool? EmailEntfernen = null);

/// <summary>Zugriff auf Einträge und Verlauf.</summary>
public sealed class Eintraege(Datenbank db)
{
    private const string Spalten = "id, typ, titel, beschreibung, modul, email, status, prioritaet, tags, position, interne_notiz, oeffentliche_antwort, ablehnungsgrund, oeffentlich, erstellt_am, geaendert_am";

    public Eintrag Anlegen(string typ, string titel, string beschreibung, string modul, string? email)
    {
        using var c = db.Oeffnen();
        using var t = c.BeginTransaction();
        var jetzt = db.Jetzt();
        var position = Convert.ToDouble(Datenbank.Skalar(c, "SELECT COALESCE(MAX(position), 0) + 1 FROM eintraege WHERE status = $s", t, ("$s", Status.Eingereicht)), CultureInfo.InvariantCulture);
        var id = (long)Datenbank.Skalar(c, $"""
            INSERT INTO eintraege (typ, titel, beschreibung, modul, email, status, position, erstellt_am, geaendert_am)
            VALUES ($typ, $titel, $beschreibung, $modul, $email, $status, $pos, $jetzt, $jetzt);
            SELECT last_insert_rowid();
            """, t, ("$typ", typ), ("$titel", titel), ("$beschreibung", beschreibung), ("$modul", modul), ("$email", email),
            ("$status", Status.Eingereicht), ("$pos", position), ("$jetzt", jetzt))!;
        Protokollieren(c, t, id, "Öffentlich", "eingereicht", $"{typ} · {modul}");
        t.Commit();
        return Holen(id)!;
    }

    public Eintrag? Holen(long id)
    {
        using var c = db.Oeffnen();
        return Holen(c, null, id);
    }

    private static Eintrag? Holen(SqliteConnection c, SqliteTransaction? t, long id)
    {
        using var cmd = Datenbank.Befehl(c, $"SELECT {Spalten} FROM eintraege WHERE id = $id", t, [("$id", id)]);
        using var r = cmd.ExecuteReader();
        return r.Read() ? Lesen(r) : null;
    }

    public List<Eintrag> Liste(Filter f)
    {
        using var c = db.Oeffnen();
        var bedingungen = new List<string>();
        var p = new List<(string, object?)>();
        if (!string.IsNullOrWhiteSpace(f.Status)) { bedingungen.Add("status = $status"); p.Add(("$status", f.Status)); }
        if (!string.IsNullOrWhiteSpace(f.Modul)) { bedingungen.Add("modul = $modul"); p.Add(("$modul", f.Modul)); }
        if (!string.IsNullOrWhiteSpace(f.Typ)) { bedingungen.Add("typ = $typ"); p.Add(("$typ", f.Typ)); }
        if (!string.IsNullOrWhiteSpace(f.Prioritaet)) { bedingungen.Add("prioritaet = $prio"); p.Add(("$prio", f.Prioritaet)); }
        if (!string.IsNullOrWhiteSpace(f.Suche))
        {
            var suche = f.Suche.Trim();
            if (suche.StartsWith('#') && long.TryParse(suche[1..], out var nr)) { bedingungen.Add("id = $nr"); p.Add(("$nr", nr)); }
            else
            {
                bedingungen.Add("(titel LIKE $q ESCAPE '\\' OR beschreibung LIKE $q ESCAPE '\\' OR interne_notiz LIKE $q ESCAPE '\\' OR tags LIKE $q ESCAPE '\\')");
                p.Add(("$q", "%" + suche.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_") + "%"));
            }
        }
        var wo = bedingungen.Count == 0 ? "" : "WHERE " + string.Join(" AND ", bedingungen);
        using var cmd = Datenbank.Befehl(c, $"SELECT {Spalten} FROM eintraege {wo} ORDER BY position, id", null, p.ToArray());
        using var r = cmd.ExecuteReader();
        var liste = new List<Eintrag>();
        while (r.Read()) liste.Add(Lesen(r));
        if (!string.IsNullOrWhiteSpace(f.Tag)) liste = liste.Where(e => e.Tags.Contains(f.Tag, StringComparer.OrdinalIgnoreCase)).ToList();
        return liste;
    }

    /// <summary>Angenommene bzw. geplante Einträge für die öffentliche Liste (neueste Änderung zuerst).</summary>
    public List<Eintrag> Oeffentliche()
    {
        using var c = db.Oeffnen();
        using var cmd = Datenbank.Befehl(c, $"SELECT {Spalten} FROM eintraege WHERE oeffentlich = 1 AND status IN ($a, $b, $c) ORDER BY geaendert_am DESC, id DESC", null,
            [("$a", Status.Oeffentlich[0]), ("$b", Status.Oeffentlich[1]), ("$c", Status.Oeffentlich[2])]);
        using var r = cmd.ExecuteReader();
        var liste = new List<Eintrag>();
        while (r.Read()) liste.Add(Lesen(r));
        return liste;
    }

    public Eintrag Aendern(long id, Aenderung a, string benutzer)
    {
        using var c = db.Oeffnen();
        using var t = c.BeginTransaction();
        var e = Holen(c, t, id) ?? throw new Fachfehler("Eintrag nicht gefunden.", 404);
        var protokoll = new List<string>();
        void Feld(string? neu, string alt, Action<string> setzen, string name, bool wertZeigen = true)
        {
            if (neu is null || neu == alt) return;
            setzen(neu);
            protokoll.Add(wertZeigen ? $"{name}: {alt} → {neu}" : $"{name} geändert");
        }
        Feld(a.Titel?.Trim(), e.Titel, v => e.Titel = Pruefen.Titel(v), "Titel", false);
        Feld(a.Beschreibung?.Trim(), e.Beschreibung, v => e.Beschreibung = Pruefen.Beschreibung(v), "Beschreibung", false);
        Feld(a.Typ, e.Typ, v => e.Typ = Pruefen.Wert(v, Typen.Alle, "Typ"), "Typ");
        Feld(a.Modul, e.Modul, v => e.Modul = Pruefen.Wert(v, Module.Alle, "Modul"), "Modul");
        Feld(a.Prioritaet, e.Prioritaet, v => e.Prioritaet = Pruefen.Wert(v, Prioritaeten.Alle, "Priorität"), "Priorität");
        if (a.Tags is not null)
        {
            var neu = Pruefen.Tags(a.Tags);
            if (!neu.SequenceEqual(e.Tags)) { protokoll.Add($"Schlagwörter: {string.Join(", ", neu)}"); e.Tags = neu; }
        }
        Feld(a.InterneNotiz, e.InterneNotiz, v => e.InterneNotiz = Pruefen.Laenge(v, 10000, "Interne Notiz"), "Interne Notiz", false);
        Feld(a.OeffentlicheAntwort, e.OeffentlicheAntwort, v => e.OeffentlicheAntwort = Pruefen.Laenge(v, 4000, "Öffentliche Antwort"), "Öffentliche Antwort", false);
        if (a.Oeffentlich is bool sichtbar && sichtbar != e.Oeffentlich)
        {
            e.Oeffentlich = sichtbar;
            protokoll.Add(sichtbar ? "In der öffentlichen Liste sichtbar" : "Aus der öffentlichen Liste ausgeblendet");
        }
        if (a.EmailEntfernen == true && e.Email is not null) { e.Email = null; protokoll.Add("E-Mail-Adresse gelöscht"); }
        if (protokoll.Count > 0)
        {
            Datenbank.Ausfuehren(c, """
                UPDATE eintraege SET titel=$titel, beschreibung=$beschreibung, typ=$typ, modul=$modul, prioritaet=$prio, tags=$tags,
                  interne_notiz=$notiz, oeffentliche_antwort=$antwort, oeffentlich=$oeff, email=$email, geaendert_am=$jetzt WHERE id=$id
                """, t, ("$titel", e.Titel), ("$beschreibung", e.Beschreibung), ("$typ", e.Typ), ("$modul", e.Modul), ("$prio", e.Prioritaet),
                ("$tags", Datenbank.TagsJson(e.Tags)), ("$notiz", e.InterneNotiz), ("$antwort", e.OeffentlicheAntwort),
                ("$oeff", e.Oeffentlich ? 1 : 0), ("$email", e.Email), ("$jetzt", db.Jetzt()), ("$id", id));
            Protokollieren(c, t, id, benutzer, "geändert", string.Join("; ", protokoll));
        }
        t.Commit();
        return Holen(id)!;
    }

    /// <summary>
    /// Eintrag in eine Spalte (Stand) an die Stelle <paramref name="index"/> verschieben. Wechselt der Stand, gelten die
    /// Übergangsregeln aus <see cref="Status"/>; „Abgelehnt“ braucht eine Begründung.
    /// </summary>
    public Eintrag Verschieben(long id, string status, int? index, string? begruendung, string benutzer)
    {
        Pruefen.Wert(status, Status.Alle, "Status");
        using var c = db.Oeffnen();
        using var t = c.BeginTransaction();
        var e = Holen(c, t, id) ?? throw new Fachfehler("Eintrag nicht gefunden.", 404);
        var wechsel = e.Status != status;
        if (wechsel && !Status.Erlaubt(e.Status, status))
            throw new Fachfehler($"Von „{Status.Bezeichnung(e.Status)}“ nach „{Status.Bezeichnung(status)}“ ist nicht vorgesehen. Möglich: {string.Join(", ", Status.Nachfolger(e.Status).Select(Status.Bezeichnung))}.", 409);
        var grund = (begruendung ?? "").Trim();
        if (wechsel && status == Status.Abgelehnt && grund.Length == 0)
            throw new Fachfehler("Für die Ablehnung ist eine Begründung nötig.");
        Pruefen.Laenge(grund, 4000, "Begründung");

        // Reihenfolge der Zielspalte neu durchnummerieren
        var ids = new List<long>();
        using (var cmd = Datenbank.Befehl(c, "SELECT id FROM eintraege WHERE status = $s AND id <> $id ORDER BY position, id", t, [("$s", status), ("$id", id)]))
        using (var r = cmd.ExecuteReader()) while (r.Read()) ids.Add(r.GetInt64(0));
        var stelle = Math.Clamp(index ?? ids.Count, 0, ids.Count);
        ids.Insert(stelle, id);
        for (var i = 0; i < ids.Count; i++)
            Datenbank.Ausfuehren(c, "UPDATE eintraege SET position = $p WHERE id = $id", t, ("$p", (double)(i + 1)), ("$id", ids[i]));

        if (wechsel)
        {
            var jetzt = db.Jetzt();
            var abgeschlossen = status is Status.Erledigt or Status.Abgelehnt ? jetzt : null;
            Datenbank.Ausfuehren(c, "UPDATE eintraege SET status=$s, geaendert_am=$jetzt, abgeschlossen_am=$ab, ablehnungsgrund = CASE WHEN $s = 'abgelehnt' THEN $grund ELSE ablehnungsgrund END WHERE id=$id", t,
                ("$s", status), ("$jetzt", jetzt), ("$ab", abgeschlossen), ("$grund", grund), ("$id", id));
            Protokollieren(c, t, id, benutzer, "Status", $"{Status.Bezeichnung(e.Status)} → {Status.Bezeichnung(status)}" + (grund.Length > 0 ? $" · Begründung: {grund}" : ""));
        }
        t.Commit();
        return Holen(id)!;
    }

    public void Loeschen(long id)
    {
        using var c = db.Oeffnen();
        if (Datenbank.Ausfuehren(c, "DELETE FROM eintraege WHERE id = $id", null, ("$id", id)) == 0)
            throw new Fachfehler("Eintrag nicht gefunden.", 404);
    }

    public List<Verlaufseintrag> Verlauf(long id)
    {
        using var c = db.Oeffnen();
        using var cmd = Datenbank.Befehl(c, "SELECT id, eintrag_id, zeit, benutzer, aktion, details FROM verlauf WHERE eintrag_id = $id ORDER BY id DESC", null, [("$id", id)]);
        using var r = cmd.ExecuteReader();
        var liste = new List<Verlaufseintrag>();
        while (r.Read())
            liste.Add(new Verlaufseintrag(r.GetInt64(0), r.GetInt64(1), DateTimeOffset.Parse(r.GetString(2), CultureInfo.InvariantCulture), r.GetString(3), r.GetString(4), r.GetString(5)));
        return liste;
    }

    public List<string> AlleTags() => Liste(new Filter()).SelectMany(e => e.Tags).Distinct(StringComparer.OrdinalIgnoreCase).Order(StringComparer.OrdinalIgnoreCase).ToList();

    /// <summary>E-Mail-Adressen abgeschlossener Einträge nach Ablauf der Aufbewahrungsfrist löschen (Datensparsamkeit).</summary>
    public int AlteEmailsLoeschen(int tage)
    {
        using var c = db.Oeffnen();
        var grenze = db.JetztZeit().AddDays(-tage).ToString("O", CultureInfo.InvariantCulture);
        return Datenbank.Ausfuehren(c, "UPDATE eintraege SET email = NULL WHERE email IS NOT NULL AND abgeschlossen_am IS NOT NULL AND abgeschlossen_am < $g", null, ("$g", grenze));
    }

    private void Protokollieren(SqliteConnection c, SqliteTransaction t, long id, string benutzer, string aktion, string details) =>
        Datenbank.Ausfuehren(c, "INSERT INTO verlauf (eintrag_id, zeit, benutzer, aktion, details) VALUES ($id, $zeit, $b, $a, $d)", t,
            ("$id", id), ("$zeit", db.Jetzt()), ("$b", benutzer), ("$a", aktion), ("$d", details));

    private static Eintrag Lesen(SqliteDataReader r) => new()
    {
        Id = r.GetInt64(0),
        Typ = r.GetString(1),
        Titel = r.GetString(2),
        Beschreibung = r.GetString(3),
        Modul = r.GetString(4),
        Email = r.IsDBNull(5) ? null : r.GetString(5),
        Status = r.GetString(6),
        Prioritaet = r.GetString(7),
        Tags = Datenbank.TagsLesen(r.GetString(8)),
        Position = r.GetDouble(9),
        InterneNotiz = r.GetString(10),
        OeffentlicheAntwort = r.GetString(11),
        Ablehnungsgrund = r.GetString(12),
        Oeffentlich = r.GetInt64(13) != 0,
        ErstelltAm = DateTimeOffset.Parse(r.GetString(14), CultureInfo.InvariantCulture),
        GeaendertAm = DateTimeOffset.Parse(r.GetString(15), CultureInfo.InvariantCulture),
    };
}

/// <summary>Eingaben prüfen und bereinigen.</summary>
public static class Pruefen
{
    public static string Titel(string v)
    {
        v = v.Trim();
        if (v.Length < 5) throw new Fachfehler("Der Titel braucht mindestens 5 Zeichen.");
        return Laenge(v, 140, "Titel");
    }

    public static string Beschreibung(string v)
    {
        v = v.Trim();
        if (v.Length < 20) throw new Fachfehler("Bitte beschreiben Sie Ihr Anliegen mit mindestens 20 Zeichen.");
        return Laenge(v, 5000, "Beschreibung");
    }

    public static string Laenge(string v, int max, string feld) =>
        v.Length <= max ? v : throw new Fachfehler($"{feld}: höchstens {max} Zeichen.");

    public static string Wert(string v, string[] erlaubt, string feld) =>
        erlaubt.Contains(v) ? v : throw new Fachfehler($"{feld}: ungültiger Wert „{v}“.");

    public static string? Email(string? v)
    {
        v = v?.Trim();
        if (string.IsNullOrEmpty(v)) return null;
        Laenge(v, 200, "E-Mail");
        var at = v.IndexOf('@');
        if (at < 1 || at != v.LastIndexOf('@') || at == v.Length - 1 || !v[(at + 1)..].Contains('.') || v.Any(char.IsWhiteSpace))
            throw new Fachfehler("Die E-Mail-Adresse ist ungültig.");
        return v;
    }

    public static List<string> Tags(IEnumerable<string> tags)
    {
        var liste = tags.Select(t => t.Trim().ToLowerInvariant()).Where(t => t.Length > 0).Distinct().ToList();
        if (liste.Count > 12) throw new Fachfehler("Höchstens 12 Schlagwörter.");
        foreach (var t in liste) Laenge(t, 30, "Schlagwort");
        return liste;
    }
}
