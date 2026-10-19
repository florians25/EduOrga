using UntPlan.Web.Contracts;
using UntPlanWeb.Daten;

namespace UntPlanWeb.Dienste;

/// <summary>Abwesenheitsmeldung von Eltern bzw. Schüler*innen (z. B. Krankmeldung), bis die Klassenleitung sie bestätigt oder ablehnt.</summary>
/// <param name="Status">gemeldet | bestaetigt | abgelehnt | zurueckgezogen</param>
public sealed record Abwesenheitsmeldung(int Id, int SchuelerId, string Schueler, string Klasse, string Von, string Bis, string Grund, string Text, string Status,
    string GemeldetVon, string Gemeldet, string BearbeitetVon, string Bearbeitet, string Antwort);

/// <summary>
/// Ablauf „Eltern melden → Klassenleitung bestätigt“: Eltern- und Schülerkonten melden eine Abwesenheit ihres Kindes (ganze Tage von–bis,
/// Grund, Text). Die Klassenleitung (bzw. wer Abwesenheiten aller Klassen verwalten darf) bestätigt die Meldung – dabei entsteht die
/// Abwesenheit im Klassenbuch für alle Unterrichtsstunden der Tage, auf Wunsch gleich entschuldigt – oder lehnt sie mit einer Antwort ab.
/// Lehrkräfte sehen gemeldete und bestätigte Meldungen in der Anwesenheit ihrer Stunde (ohne Text), damit sie nicht doppelt erfassen.
/// </summary>
public sealed class Abwesenheitsmeldungen
{
    public const int MaxTage = 30;
    public const int TageZurueck = 14;
    public const int TageVoraus = 90;
    private static readonly StringComparer Ci = StringComparer.OrdinalIgnoreCase;
    private readonly Db _db;
    private readonly Uhr _uhr;
    private readonly Klassenbuchdienst _kb;

    public Abwesenheitsmeldungen(Db db, Uhr uhr, Klassenbuchdienst kb) { _db = db; _uhr = uhr; _kb = kb; }

    private string Jetzt => _uhr.Jetzt.ToString("yyyy-MM-dd HH:mm");

    private List<Abwesenheitsmeldung> Lesen(Stand? s, string where, params (string, object?)[] p)
    {
        var namen = s?.Schueler.ToDictionary(x => x.Id, x => $"{x.Name}, {x.Vorname}") ?? new();
        return _db.Liste($"SELECT * FROM abwesenheitsmeldungen WHERE {where} ORDER BY von, id", r => new Abwesenheitsmeldung(
            r.Zahl("id"), r.Zahl("schueler_id"), namen.GetValueOrDefault(r.Zahl("schueler_id"), ""), r.Text("klasse"), r.Text("von"), r.Text("bis"), r.Text("grund"), r.Text("text"),
            r.Text("status"), r.Text("gemeldet_von"), r.Text("gemeldet"), r.Text("bearbeitet_von"), r.Text("bearbeitet"), r.Text("antwort")), p);
    }

    private Abwesenheitsmeldung Holen(Stand? s, int id) => Lesen(s, "id = @id", Db.P("@id", id)).FirstOrDefault() ?? throw new ArgumentException("Unbekannte Meldung.");

    /// <summary>Darf die Meldungen der Klasse bearbeiten: Klassenleitung bzw. Recht „Abwesenheiten aller Klassen“.</summary>
    public static bool DarfBearbeiten(Benutzer b, Stand s, string klasse) =>
        b.Kollegium && (Klassenbuchdienst.IstKlassenleitung(b, s, klasse) || Rechtedienst.Darf(b, Recht.AbwesenheitAlle));

    // ------------------------------------------------------------------------------------------ Eltern / Schüler*innen

    public Abwesenheitsmeldung Melden(Benutzer b, Stand s, int schuelerId, DateOnly von, DateOnly bis, string? grund, string? text)
    {
        if (!b.Familie) throw new UnauthorizedAccessException("Abwesenheiten melden Schüler*innen und Erziehungsberechtigte.");
        if (!b.SchuelerIds.Contains(schuelerId)) throw new UnauthorizedAccessException("Diese Schülerin bzw. dieser Schüler ist Ihrem Konto nicht zugeordnet.");
        var sch = s.Schueler.FirstOrDefault(x => x.Id == schuelerId) ?? throw new ArgumentException("Die Schülerin bzw. der Schüler ist nicht (mehr) in der Schülerliste.");
        if (bis < von) throw new ArgumentException("Das Ende liegt vor dem Beginn.");
        if (bis.DayNumber - von.DayNumber + 1 > MaxTage) throw new ArgumentException($"Bitte höchstens {MaxTage} Tage auf einmal melden.");
        var heute = _uhr.Heute;
        if (von < heute.AddDays(-TageZurueck)) throw new ArgumentException($"Abwesenheiten können höchstens {TageZurueck} Tage rückwirkend gemeldet werden.");
        if (von > heute.AddDays(TageVoraus)) throw new ArgumentException($"Abwesenheiten können höchstens {TageVoraus} Tage im Voraus gemeldet werden.");
        var t = (text ?? "").Trim();
        if (t.Length > 500) throw new ArgumentException("Der Text darf höchstens 500 Zeichen lang sein.");
        var g = (grund ?? "").Trim();
        if (g.Length == 0) g = _kb.Einstellungen().Standardgrund("meldung");
        if (g.Length > 20) throw new ArgumentException("Unbekannter Grund.");
        if (Lesen(s, "schueler_id = @s AND status = 'gemeldet' AND von <= @b AND bis >= @v", Db.P("@s", schuelerId), Db.P("@v", von), Db.P("@b", bis)).Count > 0)
            throw new ArgumentException("Für diesen Zeitraum liegt bereits eine Meldung vor.");
        var name = string.IsNullOrWhiteSpace(b.Anzeigename) ? b.Login : b.Anzeigename;
        var id = (int)_db.Einfuegen("""
            INSERT INTO abwesenheitsmeldungen (schueler_id, klasse, von, bis, grund, text, status, gemeldet_von, gemeldet, benutzer_id)
            VALUES (@s, @k, @v, @b, @g, @t, 'gemeldet', @n, @e, @u)
            """, Db.P("@s", schuelerId), Db.P("@k", sch.Klasse), Db.P("@v", von), Db.P("@b", bis), Db.P("@g", g), Db.P("@t", t), Db.P("@n", name), Db.P("@e", Jetzt), Db.P("@u", b.Id));
        return Holen(s, id);
    }

    /// <summary>Meldungen der zugeordneten Kinder (neueste zuerst).</summary>
    public List<Abwesenheitsmeldung> Eigene(Benutzer b, Stand? s, int schuelerId)
    {
        if (!b.Familie || !b.SchuelerIds.Contains(schuelerId)) throw new UnauthorizedAccessException("Diese Daten sind für Ihr Konto nicht freigegeben.");
        return Lesen(s, "schueler_id = @s AND status <> 'zurueckgezogen'", Db.P("@s", schuelerId)).OrderByDescending(m => m.Von).ThenByDescending(m => m.Id).ToList();
    }

    /// <summary>Noch nicht bearbeitete Meldung zurückziehen (Konto mit Zuordnung zum Kind).</summary>
    public void Zurueckziehen(Benutzer b, Stand? s, int id)
    {
        var m = Holen(s, id);
        if (!b.Familie || !b.SchuelerIds.Contains(m.SchuelerId)) throw new UnauthorizedAccessException("Diese Meldung ist für Ihr Konto nicht freigegeben.");
        if (m.Status != "gemeldet") throw new ArgumentException("Die Meldung wurde bereits von der Schule bearbeitet.");
        _db.Ausfuehren("UPDATE abwesenheitsmeldungen SET status = 'zurueckgezogen', bearbeitet = @e WHERE id = @id", Db.P("@e", Jetzt), Db.P("@id", id));
    }

    // ------------------------------------------------------------------------------------------ Schule

    /// <summary>Meldungen der Klassen, die das Konto bearbeiten darf (ohne Status: alle außer zurückgezogenen).</summary>
    public List<Abwesenheitsmeldung> Liste(Benutzer b, Stand s, string? status, string? klasse, DateOnly? von = null, DateOnly? bis = null)
    {
        if (!b.Kollegium) throw new UnauthorizedAccessException("Nur für das Kollegium.");
        var w = "status <> 'zurueckgezogen'";
        var p = new List<(string, object?)>();
        if (!string.IsNullOrWhiteSpace(status)) { w = "status = @st"; p.Add(Db.P("@st", status)); }
        if (!string.IsNullOrWhiteSpace(klasse)) { w += " AND klasse = @k COLLATE NOCASE"; p.Add(Db.P("@k", klasse)); }
        if (von is DateOnly v) { w += " AND bis >= @v"; p.Add(Db.P("@v", v)); }
        if (bis is DateOnly bi) { w += " AND von <= @b"; p.Add(Db.P("@b", bi)); }
        return Lesen(s, w, p.ToArray()).Where(m => DarfBearbeiten(b, s, m.Klasse)).ToList();
    }

    /// <summary>Gemeldete und bestätigte Meldungen eines Tages für die Schüler*innen einer Stunde (Anwesenheit; Text nur für die Klassenleitung).</summary>
    public List<object> FuerTag(Benutzer b, Stand s, DateOnly datum, IReadOnlyCollection<int> schuelerIds)
    {
        if (schuelerIds.Count == 0) return new();
        var ids = schuelerIds.ToHashSet();
        return Lesen(s, "status IN ('gemeldet', 'bestaetigt') AND von <= @d AND bis >= @d", Db.P("@d", datum)).Where(m => ids.Contains(m.SchuelerId))
            .Select(m => (object)new { m.Id, m.SchuelerId, m.Von, m.Bis, m.Grund, m.Status, m.Gemeldet, text = DarfBearbeiten(b, s, m.Klasse) ? m.Text : "" }).ToList();
    }

    /// <summary>
    /// Bestätigen: trägt die Abwesenheit (ganztägig von–bis) im Klassenbuch ein – entschuldigt, wenn gewünscht und erlaubt
    /// (Recht „entschuldigen“), sonst offen – und vermerkt die Bestätigung. Liefert die Zahl der eingetragenen Fehlstunden.
    /// </summary>
    public (Abwesenheitsmeldung Meldung, int Stunden) Bestaetigen(Benutzer b, Stand s, int id, bool entschuldigt, string? antwort)
    {
        var m = Holen(s, id);
        if (!DarfBearbeiten(b, s, m.Klasse)) throw new UnauthorizedAccessException("Meldungen bestätigt die Klassenleitung.");
        if (m.Status != "gemeldet") throw new ArgumentException("Die Meldung wurde bereits bearbeitet.");
        var (von, bis) = Klassenbuchdienst.Ganztaegig(DateOnly.Parse(m.Von).ToDateTime(TimeOnly.MinValue), DateOnly.Parse(m.Bis).ToDateTime(TimeOnly.MinValue));
        var ent = entschuldigt && Klassenbuchdienst.DarfEntschuldigen(b, s, m.Klasse);
        var text = $"Gemeldet von {m.GemeldetVon} am {Deutsch(m.Gemeldet)}" + (m.Text.Length > 0 ? $": {m.Text}" : "");
        if (text.Length > 500) text = text[..500];
        var n = _kb.AbwesenheitErfassen(b, s, m.SchuelerId, von, bis, m.Grund, text, ent ? "entschuldigt" : "offen",
            entschuldigtAm: ent ? Plandienst.Iso(_uhr.Heute) : null);
        Bearbeitet(b, id, "bestaetigt", antwort);
        return (Holen(s, id), n);
    }

    public Abwesenheitsmeldung Ablehnen(Benutzer b, Stand s, int id, string? antwort)
    {
        var m = Holen(s, id);
        if (!DarfBearbeiten(b, s, m.Klasse)) throw new UnauthorizedAccessException("Meldungen bearbeitet die Klassenleitung.");
        if (m.Status != "gemeldet") throw new ArgumentException("Die Meldung wurde bereits bearbeitet.");
        Bearbeitet(b, id, "abgelehnt", antwort);
        return Holen(s, id);
    }

    private void Bearbeitet(Benutzer b, int id, string status, string? antwort)
    {
        var a = (antwort ?? "").Trim();
        if (a.Length > 500) throw new ArgumentException("Die Antwort darf höchstens 500 Zeichen lang sein.");
        var name = b.LehrerKuerzel ?? (string.IsNullOrWhiteSpace(b.Anzeigename) ? b.Login : b.Anzeigename);
        _db.Ausfuehren("UPDATE abwesenheitsmeldungen SET status = @st, bearbeitet_von = @n, bearbeitet = @e, antwort = @a WHERE id = @id",
            Db.P("@st", status), Db.P("@n", name), Db.P("@e", Jetzt), Db.P("@a", a), Db.P("@id", id));
    }

    private static string Deutsch(string zeitstempel) =>
        DateTime.TryParse(zeitstempel, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var d) ? d.ToString("dd.MM.yyyy HH:mm") : zeitstempel;
}
