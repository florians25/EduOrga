using System.Data.Common;
using System.Text.Json;
using UntPlanWeb.Daten;

namespace UntPlanWeb.Dienste;

/// <summary>Eine Löschkategorie mit Vorgabe (Frist in Tagen bzw. Jahren nach dem Ende des Schuljahres).</summary>
/// <param name="Einheit"><c>tage</c> (ab dem Datum des Eintrags) oder <c>jahre</c> (nach VO-DV I: ab Ablauf des Kalenderjahres, in dem das Schuljahr des Eintrags endete).</param>
/// <param name="Pruefen">Vorgabe stützt sich auf eine Rechtsvorschrift, die die Schule bzw. ihr Datenschutzbeauftragter prüfen muss.</param>
public sealed record Aufbewahrungskategorie(string Id, string Name, string Beschreibung, string Einheit, int Vorgabe, bool VorgabeAktiv, string Grundlage, bool Pruefen, int Minimum, int Maximum);

/// <summary>Einstellung der Schule je Kategorie.</summary>
public sealed record Aufbewahrungsregel(string Id, bool Aktiv, int Wert);

/// <summary>Ergebnis einer Kategorie (Vorschau bzw. Löschlauf).</summary>
public sealed record Loeschergebnis(string Kategorie, string Name, bool Aktiv, int Wert, string Einheit, string Grenze, int Anzahl, Dictionary<string, int> Tabellen);

/// <summary>Eintrag im Löschprotokoll (nur Anzahlen, keine Inhalte).</summary>
public sealed record Loescheintrag(int Id, string Zeit, string Ausgeloest, string Kategorie, int Anzahl, string Grenze, string Details);

/// <summary>Angaben der Schule für die Datenschutzhinweise (Art. 13/14 DSGVO).</summary>
public sealed record Datenschutzangaben(string Verantwortlicher = "", string Anschrift = "", string Vertretung = "", string Kontakt = "",
    string DsbName = "", string DsbKontakt = "", string Betreiber = "", string Aufsichtsbehoerde = "", string Zusatz = "", bool Geprueft = false, string Stand = "");

/// <summary>
/// Datenschutz in EduOrga Web: Aufbewahrung und automatische Löschung (Art. 5 Abs. 1 lit. e, Art. 17 DSGVO), Auskunft (Art. 15),
/// Löschung bzw. Einschränkung der Verarbeitung einzelner Personen (Art. 17/18) und die Angaben für die Datenschutzhinweise (Art. 13).
/// <para>Die Fristen sind Vorschläge. Verbindlich legt sie die Schule als Verantwortliche fest (VO-DV I § 9 für Schülerdaten,
/// VO-DV II für Lehrkräfte – Fassung in der BASS prüfen). Inhaltliche Kategorien (Klassenbuch, Mitteilungen …) löschen erst,
/// wenn die Administration sie einschaltet; rein technische Protokolle (Anmeldungen mit IP-Adresse) sind von Anfang an begrenzt.</para>
/// </summary>
public sealed class Datenschutzdienst
{
    private const string RegelnSchluessel = "einstellung:aufbewahrung";
    private const string AngabenSchluessel = "einstellung:datenschutzhinweise";
    /// <summary>Version der Datenschutzhinweise, deren Kenntnisnahme Schüler- und Elternkonten bestätigen (ändert sich mit „Stand“).</summary>
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly Db _db;
    private readonly Uhr _uhr;
    private readonly Einstellungen _e;
    private readonly Paketdienst _pakete;
    private readonly Protokoll _prot;

    public Datenschutzdienst(Db db, Uhr uhr, Einstellungen e, Paketdienst pakete, Protokoll prot) { _db = db; _uhr = uhr; _e = e; _pakete = pakete; _prot = prot; }

    // ------------------------------------------------------------------------------------------ Kategorien und Regeln

    public const string Anmeldungen = "anmeldungen";
    public const string Geraetekonten = "geraetekonten";
    public const string Protokolle = "protokoll";
    public const string Pushgeraete = "pushgeraete";
    public const string Mitteilungen = "mitteilungen";
    public const string Meldungen = "abwesenheitsmeldungen";
    public const string Klassenbuch = "klassenbuch";
    public const string Sprechtag = "sprechtag";
    public const string Buchungen = "buchungen";

    private const string VoDv = "VO-DV I § 9 (BASS 10-44 Nr. 2.1) – Frist und Fassung von der Schule bzw. dem/der Datenschutzbeauftragten zu prüfen.";

    public static readonly IReadOnlyList<Aufbewahrungskategorie> Kategorien = new[]
    {
        new Aufbewahrungskategorie(Anmeldungen, "Anmeldeprotokoll", "Zeitpunkt, Ergebnis, IP-Adresse und Gerät jeder Anmeldung (Administration → Benutzer → Anmeldungen).",
            "tage", 30, true, "Art. 5 Abs. 1 lit. c, e und Art. 32 DSGVO: nur so lange, wie zur Aufklärung von Missbrauch nötig (Vorschlag EduOrga).", false, 1, 365),
        new Aufbewahrungskategorie(Geraetekonten, "Gemerkte Konten auf Geräten", "Zuordnung Gerätecookie ↔ Konto für „Konto wechseln“ (nach 30 Tagen ohnehin ungültig).",
            "tage", 30, true, "Technisch nicht mehr nötig (Vorschlag EduOrga).", false, 30, 365),
        new Aufbewahrungskategorie(Protokolle, "Verwaltungsprotokoll", "Anmeldungen und Änderungen der Verwaltung mit Benutzername (Administration → Protokoll).",
            "tage", 365, true, "Nachweis- und Kontrollzweck (Art. 5 Abs. 2, Art. 32 DSGVO); Dauer legt die Schule fest (Vorschlag EduOrga: 1 Jahr).", false, 30, 3650),
        new Aufbewahrungskategorie(Pushgeraete, "Geräte für Sofort-Benachrichtigungen", "Gerätekennungen (APNs) der iOS-App, die sich so lange nicht mehr gemeldet haben.",
            "tage", 180, false, "Technisch nicht mehr nötig (Vorschlag EduOrga).", false, 30, 3650),
        new Aufbewahrungskategorie(Mitteilungen, "Mitteilungen", "Mitteilungen samt Anhängen, Lesebestätigungen und Entwürfen (ab dem Erstellen).",
            "tage", 365, false, "Keine allgemeine gesetzliche Frist bekannt – Festlegung der Schule (Art. 5 Abs. 1 lit. e DSGVO).", true, 30, 3650),
        new Aufbewahrungskategorie(Meldungen, "Abwesenheitsmeldungen der Eltern", "Bearbeitete Meldungen (bestätigt bzw. abgelehnt) mit Grund und Nachricht; offene Meldungen bleiben.",
            "jahre", 5, false, "Übrige Schülerdaten nach " + VoDv, true, 1, 20),
        new Aufbewahrungskategorie(Klassenbuch, "Klassenbuch", "Lehrstoff, Hausaufgaben, Anwesenheit, Fehlzeiten, Entschuldigungen, Vermerke, Befreiungen und Klassendienste.",
            "jahre", 10, false, "Unterlagen über die Klassenführung (Klassenbuch, Kursbuch) nach " + VoDv, true, 1, 20),
        new Aufbewahrungskategorie(Sprechtag, "Elternsprechtag", "Gebuchte Termine, Einladungen und Wartelisten vergangener Sprechtage (der Sprechtag selbst bleibt).",
            "tage", 90, false, "Nach dem Termin nicht mehr nötig – Festlegung der Schule (Vorschlag EduOrga: 90 Tage).", false, 1, 3650),
        new Aufbewahrungskategorie(Buchungen, "Raum- und Gerätebuchungen", "Buchungen und Termine mit Lehrkraft, Titel und Text (ab dem Termin).",
            "tage", 730, false, "Festlegung der Schule (Vorschlag EduOrga: 2 Jahre).", false, 30, 3650),
    };

    public static Aufbewahrungskategorie Kategorie(string id) => Kategorien.FirstOrDefault(k => k.Id == id) ?? throw new ArgumentException($"Unbekannte Kategorie „{id}“.");

    public sealed record Regelwerk(Dictionary<string, Aufbewahrungsregel> Regeln, string FestgelegtVon, string FestgelegtAm);

    private sealed record Gespeichert(List<Aufbewahrungsregel>? Regeln, string? FestgelegtVon, string? FestgelegtAm);

    public Regelwerk Regeln()
    {
        Gespeichert? g = null;
        try { g = _e.Lesen(RegelnSchluessel) is { Length: > 0 } j ? JsonSerializer.Deserialize<Gespeichert>(j, Json) : null; }
        catch (JsonException) { g = null; }
        var regeln = Kategorien.ToDictionary(k => k.Id, k => g?.Regeln?.FirstOrDefault(r => r.Id == k.Id) is { } r
            ? r with { Wert = Math.Clamp(r.Wert, k.Minimum, k.Maximum) } : new Aufbewahrungsregel(k.Id, k.VorgabeAktiv, k.Vorgabe));
        return new Regelwerk(regeln, g?.FestgelegtVon ?? "", g?.FestgelegtAm ?? "");
    }

    public Regelwerk RegelnSpeichern(IEnumerable<Aufbewahrungsregel> neu, string von)
    {
        var alt = Regeln().Regeln;
        foreach (var r in neu)
        {
            var k = Kategorie(r.Id);
            if (r.Wert < k.Minimum || r.Wert > k.Maximum)
                throw new ArgumentException($"{k.Name}: die Frist muss zwischen {k.Minimum} und {k.Maximum} {(k.Einheit == "jahre" ? "Jahren" : "Tagen")} liegen.");
            alt[r.Id] = r;
        }
        var g = new Gespeichert(alt.Values.ToList(), von, _uhr.Jetzt.ToString("yyyy-MM-dd HH:mm"));
        _e.Schreiben(RegelnSchluessel, JsonSerializer.Serialize(g, Json));
        _prot.Schreiben(von, "Aufbewahrungsfristen geändert", string.Join(", ", alt.Values.Where(r => r.Aktiv).Select(r => $"{r.Id} {r.Wert}")));
        return Regeln();
    }

    /// <summary>
    /// Erster Tag, der erhalten bleibt (Einträge davor werden gelöscht).
    /// <list type="bullet">
    /// <item><c>tage</c>: heute − N Tage.</item>
    /// <item><c>jahre</c>: VO-DV I § 9 – die Frist beginnt mit Ablauf des Kalenderjahres, in dem die Unterlagen abgeschlossen wurden (hier: das
    ///   Schuljahr des Eintrags endete, 31. Juli). Ein Eintrag aus dem Schuljahr, das im Jahr J endet, darf ab dem 1.1. des Jahres J + N + 1
    ///   gelöscht werden. Erhalten bleibt daher alles ab dem 1.8. des Jahres heute.Jahr − N − 1.</item>
    /// </list>
    /// </summary>
    public static DateOnly Grenze(string einheit, int wert, DateOnly heute) =>
        einheit == "jahre" ? new DateOnly(heute.Year - wert - 1, 8, 1) : heute.AddDays(-wert);

    /// <summary>Letzter Tag der Aufbewahrung (VO-DV I) für einen Eintrag vom <paramref name="datum"/>: 31.12. des Jahres (Schuljahresende + N).</summary>
    public static DateOnly FristEnde(DateOnly datum, int jahre)
    {
        var schuljahrEnde = datum.Month >= 8 ? datum.Year + 1 : datum.Year;
        return new DateOnly(schuljahrEnde + jahre, 12, 31);
    }

    // ------------------------------------------------------------------------------------------ Löschen nach Fristen

    /// <summary>(Tabelle, Bedingung) je Kategorie; @g = erster erhaltener Tag (yyyy-MM-dd). Reihenfolge: abhängige Tabellen zuerst.</summary>
    private static (string Tabelle, string Bedingung)[] Ziele(string kategorie) => kategorie switch
    {
        Anmeldungen => new[] { ("benutzer_anmeldungen", "zeit < @g") },
        Geraetekonten => new[] { ("geraete_konten", "zuletzt < @g") },
        Protokolle => new[] { ("protokoll", "zeit < @g") },
        Pushgeraete => new[] { ("push_geraete", "aktualisiert < @g") },
        Mitteilungen => new[]
        {
            ("mitteilung_anhaenge", "mitteilung_id IN (SELECT id FROM mitteilungen WHERE erstellt < @g)"),
            ("mitteilung_empfaenger", "mitteilung_id IN (SELECT id FROM mitteilungen WHERE erstellt < @g)"),
            ("mitteilungen", "erstellt < @g"),
        },
        Meldungen => new[] { ("abwesenheitsmeldungen", "bis < @g AND status <> 'gemeldet'") },
        Klassenbuch => new[]
        {
            ("klassenbuch", "datum < @g"), ("fehlzeiten", "datum < @g"), ("fehlzeit_entschuldigungen", "datum < @g"), ("vermerke", "datum < @g"),
            ("hausaufgaben_eintraege", "datum < @g"), ("befreiungen", "bis < @g"), ("klassendienst_zuordnungen", "bis < @g"),
        },
        Sprechtag => new[]
        {
            ("sprechtag_termine", "sprechtag_id IN (SELECT id FROM sprechtage WHERE datum < @g)"),
            ("sprechtag_einladungen", "sprechtag_id IN (SELECT id FROM sprechtage WHERE datum < @g)"),
            ("sprechtag_warteliste", "sprechtag_id IN (SELECT id FROM sprechtage WHERE datum < @g)"),
        },
        Buchungen => new[]
        {
            ("buchung_ressourcen", "buchung_id IN (SELECT id FROM buchungen WHERE datum < @g)"),
            ("buchungen", "datum < @g"),
        },
        _ => throw new ArgumentException($"Unbekannte Kategorie „{kategorie}“."),
    };

    /// <summary>Vorschau (Probelauf): was würde je Kategorie gelöscht? Auch für ausgeschaltete Kategorien (mit deren Frist).</summary>
    public List<Loeschergebnis> Vorschau()
    {
        var regeln = Regeln().Regeln;
        var heute = _uhr.Heute;
        using var c = _db.Oeffnen();
        return Kategorien.Select(k =>
        {
            var r = regeln[k.Id];
            var g = Grenze(k.Einheit, r.Wert, heute);
            var tabellen = Ziele(k.Id).ToDictionary(z => z.Tabelle, z => Convert.ToInt32(Db.Wert(c, $"SELECT COUNT(*) FROM {z.Tabelle} WHERE {z.Bedingung}", Db.P("@g", Plandienst.Iso(g)))));
            return new Loeschergebnis(k.Id, k.Name, r.Aktiv, r.Wert, k.Einheit, Plandienst.Iso(g), tabellen.Values.Sum(), tabellen);
        }).ToList();
    }

    /// <summary>
    /// Löschlauf: eingeschaltete Kategorien (bzw. die angegebenen, auch wenn ausgeschaltet – „jetzt löschen“ durch die Administration).
    /// Jede Kategorie in einer Transaktion; das Löschprotokoll vermerkt Anzahl und Grenze (keine Inhalte).
    /// </summary>
    public List<Loeschergebnis> Ausfuehren(string ausgeloest, IEnumerable<string>? nur = null)
    {
        var regeln = Regeln().Regeln;
        var auswahl = nur?.ToHashSet();
        var heute = _uhr.Heute;
        var res = new List<Loeschergebnis>();
        foreach (var k in Kategorien)
        {
            var r = regeln[k.Id];
            if (auswahl is null ? !r.Aktiv : !auswahl.Contains(k.Id)) continue;
            var g = Plandienst.Iso(Grenze(k.Einheit, r.Wert, heute));
            var tabellen = new Dictionary<string, int>();
            _db.Transaktion(c =>
            {
                foreach (var (t, b) in Ziele(k.Id)) tabellen[t] = Db.Ausfuehren(c, $"DELETE FROM {t} WHERE {b}", Db.P("@g", g));
            });
            var e = new Loeschergebnis(k.Id, k.Name, r.Aktiv, r.Wert, k.Einheit, g, tabellen.Values.Sum(), tabellen);
            res.Add(e);
            if (e.Anzahl > 0 || auswahl is not null)
                Vermerken(ausgeloest, k.Id, e.Anzahl, g, string.Join(", ", tabellen.Where(x => x.Value > 0).Select(x => $"{x.Key}: {x.Value}")));
        }
        res.AddRange(SperrenAbgelaufen(ausgeloest));
        if (res.Any(x => x.Anzahl > 0)) _pakete.SchuelerLaden();
        return res;
    }

    private void Vermerken(string ausgeloest, string kategorie, int anzahl, string grenze, string details) =>
        _db.Ausfuehren("INSERT INTO loeschprotokoll (zeit, ausgeloest, kategorie, anzahl, grenze, details) VALUES (@z, @a, @k, @n, @g, @d)",
            Db.P("@z", _uhr.Jetzt.ToString("yyyy-MM-dd HH:mm:ss")), Db.P("@a", ausgeloest), Db.P("@k", kategorie), Db.P("@n", anzahl), Db.P("@g", grenze),
            Db.P("@d", details.Length > 1000 ? details[..1000] : details));

    public List<Loescheintrag> Loeschprotokoll(int anzahl = 200) =>
        _db.Liste("SELECT * FROM loeschprotokoll ORDER BY id DESC LIMIT " + Math.Clamp(anzahl, 1, 1000),
            r => new Loescheintrag(r.Zahl("id"), r.Text("zeit"), r.Text("ausgeloest"), r.Text("kategorie"), r.Zahl("anzahl"), r.Text("grenze"), r.Text("details")));

    // ------------------------------------------------------------------------------------------ Auskunft (Art. 15 DSGVO)

    private static Dictionary<string, object?> Zeile(DbDataReader r)
    {
        var d = new Dictionary<string, object?>();
        for (var i = 0; i < r.FieldCount; i++) d[r.GetName(i)] = r.IsDBNull(i) ? null : r.GetValue(i) is byte[] b ? $"({b.Length} Byte)" : r.GetValue(i);
        return d;
    }

    private List<Dictionary<string, object?>> Alle(string sql, params (string, object?)[] p) => _db.Liste(sql, Zeile, p);

    /// <summary>Tabellen mit Bezug zu einer Schülerin bzw. einem Schüler (Spalte schueler_id).</summary>
    private static readonly string[] SchuelerTabellen =
    {
        "fehlzeiten", "fehlzeit_entschuldigungen", "vermerke", "befreiungen", "klassendienst_zuordnungen", "abwesenheitsmeldungen",
        "sprechtag_termine", "sprechtag_einladungen", "sprechtag_warteliste", "schuelergruppe_mitglieder", "klassenwechsel", "benutzer_schueler",
    };

    /// <summary>Tabellen, deren Einträge der Aufbewahrung nach VO-DV I unterliegen (Klassenführung, Entschuldigungen).</summary>
    private static readonly string[] Aufbewahrungspflichtig =
        { "fehlzeiten", "fehlzeit_entschuldigungen", "vermerke", "befreiungen", "klassendienst_zuordnungen", "abwesenheitsmeldungen" };

    private static string DatumSpalte(string tabelle) => tabelle switch
    {
        "befreiungen" or "klassendienst_zuordnungen" or "abwesenheitsmeldungen" => "bis",
        _ => "datum",
    };

    /// <summary>Alle in EduOrga Web gespeicherten Daten über eine Schülerin bzw. einen Schüler.</summary>
    public Dictionary<string, object?> AuskunftSchueler(int id)
    {
        var s = _pakete.Aktuell;
        var aktuell = s?.Schueler.FirstOrDefault(x => x.Id == id);
        var studio = s?.Paket.Elemente.Schueler.FirstOrDefault(x => x.Id == id);
        var eigen = Alle("SELECT * FROM schueler_daten WHERE id = @id", Db.P("@id", id)).FirstOrDefault();
        if (aktuell is null && studio is null && eigen is null && !SchuelerTabellen.Any(t => Anzahl(t, id) > 0))
            throw new ArgumentException("Zu dieser Schülerin / diesem Schüler sind keine Daten gespeichert.");
        var d = Kopf("Schüler*in", id);
        d["stammdaten"] = new Dictionary<string, object?>
        {
            ["ausEduOrgaStudio"] = studio, ["aktuell"] = aktuell, ["inEduOrgaWebGespeichert"] = eigen,
        };
        foreach (var t in SchuelerTabellen) d[t] = Alle($"SELECT * FROM {t} WHERE schueler_id = @id", Db.P("@id", id));
        d["konten"] = Alle("SELECT b.id, b.login, b.anzeigename, b.rolle, b.email, b.erstellt, b.letzte_anmeldung FROM benutzer b JOIN benutzer_schueler z ON z.benutzer_id = b.id WHERE z.schueler_id = @id",
            Db.P("@id", id));
        d["sitzplaene"] = Sitzplaetze(id).Select(x => new { x.Bereich, x.Schluessel, platz = x.Platz }).ToList();
        d["sperre"] = Alle("SELECT * FROM datenschutz_sperren WHERE art = 'schueler' AND ref_id = @id", Db.P("@id", id)).FirstOrDefault();
        d["hinweis"] = "Nicht enthalten sind Daten in EduOrga Studio und in der Schulverwaltung (z. B. SchILD-NRW) sowie Unterrichtsinhalte ohne Personenbezug. " +
            "Die Klassenbuch-Einträge zur Anwesenheit stehen unter „fehlzeiten“.";
        return d;
    }

    /// <summary>Alle in EduOrga Web gespeicherten Daten über ein Benutzerkonto (ohne Passwort-Hash und geheime Kennungen).</summary>
    public Dictionary<string, object?> AuskunftBenutzer(int id)
    {
        var konto = Alle("""
            SELECT id, login, anzeigename, rolle, element, email, gesperrt, passwort_aendern, erstellt, letzte_anmeldung, vorherige_anmeldung, sprache,
                benachrichtigung, zusatzrechte, person_id, rechteprofil, datenschutz_kenntnis FROM benutzer WHERE id = @id
            """, Db.P("@id", id)).FirstOrDefault() ?? throw new ArgumentException("Unbekannter Benutzer.");
        var login = Convert.ToString(konto["login"]) ?? "";
        var kuerzel = Convert.ToString(konto["element"]) ?? "";
        var d = Kopf("Benutzerkonto", id);
        d["konto"] = konto;
        d["person"] = konto["person_id"] is { } pid ? Alle("SELECT * FROM personen WHERE id = @p", Db.P("@p", pid)).FirstOrDefault() : null;
        d["zugeordneteSchueler"] = Alle("SELECT schueler_id FROM benutzer_schueler WHERE benutzer_id = @id", Db.P("@id", id));
        d["rechte"] = Alle("SELECT recht, stufe FROM benutzer_rechte WHERE benutzer_id = @id", Db.P("@id", id));
        d["anmeldungen"] = Alle("SELECT zeit, ergebnis, adresse, geraet FROM benutzer_anmeldungen WHERE benutzer_id = @id ORDER BY id DESC", Db.P("@id", id));
        d["pushGeraete"] = _db.Liste("SELECT token, plattform, umgebung, erstellt, aktualisiert FROM push_geraete WHERE benutzer_id = @id",
            r => new { token = Maske(r.Text("token")), plattform = r.Text("plattform"), umgebung = r.Text("umgebung"), erstellt = r.Text("erstellt"), aktualisiert = r.Text("aktualisiert") },
            Db.P("@id", id));
        d["gemerkteGeraete"] = Alle("SELECT zuletzt FROM geraete_konten WHERE benutzer_id = @id", Db.P("@id", id));
        d["mitteilungenGesendet"] = Alle("SELECT id, betreff, text, erstellt, empfaenger_text, entwurf FROM mitteilungen WHERE absender_id = @id ORDER BY id", Db.P("@id", id));
        d["mitteilungenEmpfangen"] = Alle("""
            SELECT m.id, m.betreff, m.text, m.erstellt, a.anzeigename AS absender, e.gelesen, e.bestaetigt, e.geloescht FROM mitteilung_empfaenger e
            JOIN mitteilungen m ON m.id = e.mitteilung_id LEFT JOIN benutzer a ON a.id = m.absender_id WHERE e.benutzer_id = @id ORDER BY m.id
            """, Db.P("@id", id));
        d["anhaenge"] = Alle("SELECT h.mitteilung_id, h.name, h.typ, h.groesse FROM mitteilung_anhaenge h JOIN mitteilungen m ON m.id = h.mitteilung_id WHERE m.absender_id = @id", Db.P("@id", id));
        d["verteilerlisten"] = Alle("SELECT id, name, mitglieder, erstellt FROM mitteilung_listen WHERE besitzer_id = @id", Db.P("@id", id));
        d["gelesenVermerke"] = Alle("SELECT schluessel, zeit FROM infocenter_gelesen WHERE benutzer_id = @id", Db.P("@id", id));
        d["abwesenheitsmeldungen"] = Alle("SELECT * FROM abwesenheitsmeldungen WHERE benutzer_id = @id", Db.P("@id", id));
        d["sprechtagTermine"] = Alle("SELECT * FROM sprechtag_termine WHERE benutzer_id = @id", Db.P("@id", id));
        d["buchungen"] = Alle("SELECT id, art, datum, stunde_von, stunde_bis, raum, titel, text, status, erstellt FROM buchungen WHERE benutzer_id = @id", Db.P("@id", id));
        d["rueckmeldungen"] = Alle("SELECT id, typ, erstellt, von, bis, grund, text, status FROM rueckmeldungen WHERE benutzer_id = @id", Db.P("@id", id));
        d["protokoll"] = Alle("SELECT zeit, aktion, details FROM protokoll WHERE benutzer = @l ORDER BY id DESC", Db.P("@l", login));
        if (kuerzel.Length > 0 && Convert.ToString(konto["rolle"]) is Rollen.Admin or Rollen.Leitung or Rollen.Lehrer)
            d["lehrkraft"] = new Dictionary<string, object?>
            {
                ["kuerzel"] = kuerzel,
                ["stammdatenAusStudio"] = _pakete.Aktuell?.Lehrer.GetValueOrDefault(kuerzel),
                // Einträge der Lehrkraft im Klassenbuch (Inhalt betrifft den Unterricht; Anzahl je Art)
                ["klassenbuchStunden"] = Anzahl("klassenbuch", "lehrer = @k", kuerzel),
                ["hausaufgaben"] = Anzahl("hausaufgaben_eintraege", "lehrer = @k", kuerzel),
                ["vermerke"] = Anzahl("vermerke", "lehrer = @k", kuerzel),
                ["sprechtagTeilnahmen"] = Alle("SELECT sprechtag_id, raum, abgesagt FROM sprechtag_lehrer WHERE lehrer = @k", Db.P("@k", kuerzel)),
            };
        d["hinweis"] = "Der Stundenplan und die Vertretungen kommen aus EduOrga Studio; Angaben dort und in der Schulverwaltung sind nicht enthalten. " +
            "Gerätekennungen sind gekürzt; Passwörter werden nur als Hash gespeichert und nicht ausgegeben.";
        return d;
    }

    private Dictionary<string, object?> Kopf(string art, int id) => new()
    {
        ["art"] = art, ["id"] = id, ["erstellt"] = _uhr.Jetzt.ToString("yyyy-MM-dd HH:mm"),
        ["verantwortlicher"] = Angaben() is { Verantwortlicher.Length: > 0 } a ? a.Verantwortlicher : _e.Schulname,
        ["system"] = "EduOrga Web",
    };

    private static string Maske(string token) => token.Length <= 8 ? "…" : token[..4] + "…" + token[^4..];

    private int Anzahl(string tabelle, int schuelerId) => Convert.ToInt32(_db.Wert($"SELECT COUNT(*) FROM {tabelle} WHERE schueler_id = @id", Db.P("@id", schuelerId)));
    private int Anzahl(string tabelle, string bedingung, string kuerzel) => Convert.ToInt32(_db.Wert($"SELECT COUNT(*) FROM {tabelle} WHERE {bedingung}", Db.P("@k", kuerzel)));

    private List<(int Id, string Bereich, string Schluessel, string Platz, Dictionary<string, int> Belegung)> Sitzplaetze(int schuelerId) =>
        _db.Liste("SELECT id, bereich, schluessel, belegung FROM sitzplan_bereiche", r =>
        {
            Dictionary<string, int> b;
            try { b = JsonSerializer.Deserialize<Dictionary<string, int>>(r.Text("belegung")) ?? new(); } catch (JsonException) { b = new(); }
            return (r.Zahl("id"), r.Text("bereich"), r.Text("schluessel"), b.FirstOrDefault(x => x.Value == schuelerId).Key ?? "", b);
        }).Where(x => x.Item4.Length > 0).ToList();

    /// <summary>Auskunft als PDF (gleicher Inhalt wie JSON, je Abschnitt eine Gruppe).</summary>
    public byte[] AuskunftPdf(Dictionary<string, object?> auskunft, string? ersteller)
    {
        var zeilen = new List<IReadOnlyList<string>>();
        var arten = new List<string>();
        void Gruppe(string t) { zeilen.Add(new[] { t, "" }); arten.Add("gruppe"); }
        void Zeile(string a, string b) { zeilen.Add(new[] { a, b }); arten.Add(""); }
        foreach (var (abschnitt, wert) in auskunft)
        {
            switch (wert)
            {
                case null: continue;
                case string or int or long or bool: Zeile(abschnitt, Convert.ToString(wert) ?? ""); break;
                default:
                    var el = JsonSerializer.SerializeToElement(wert, Json);
                    Gruppe(abschnitt);
                    Ausgeben(el, "", Zeile);
                    break;
            }
        }
        return PdfBericht.Erzeugen(_e.Schulname, "Auskunft nach Art. 15 DSGVO", $"{auskunft["art"]} Nr. {auskunft["id"]} · Stand {auskunft["erstellt"]}",
            new[] { "Angabe", "Inhalt" }, zeilen, "Vertraulich. Auskunft über die in EduOrga Web gespeicherten personenbezogenen Daten.", ersteller, false, true, arten,
            "Vertraulich");
    }

    private static void Ausgeben(JsonElement el, string praefix, Action<string, string> zeile)
    {
        switch (el.ValueKind)
        {
            case JsonValueKind.Object:
                var felder = el.EnumerateObject().ToList();
                if (felder.All(f => f.Value.ValueKind is not (JsonValueKind.Object or JsonValueKind.Array)))
                {
                    zeile(praefix.Length > 0 ? praefix : "–", string.Join("; ", felder.Where(f => f.Value.ValueKind != JsonValueKind.Null).Select(f => $"{f.Name}: {Text(f.Value)}")));
                    return;
                }
                foreach (var f in felder) Ausgeben(f.Value, praefix.Length > 0 ? $"{praefix} › {f.Name}" : f.Name, zeile);
                return;
            case JsonValueKind.Array:
                var i = 0;
                var leer = true;
                foreach (var x in el.EnumerateArray()) { leer = false; Ausgeben(x, $"{(praefix.Length > 0 ? praefix : "Eintrag")} {++i}", zeile); }
                if (leer) zeile(praefix.Length > 0 ? praefix : "–", "keine Einträge");
                return;
            case JsonValueKind.Null: return;
            default: zeile(praefix.Length > 0 ? praefix : "–", Text(el)); return;
        }
    }

    private static string Text(JsonElement e) => e.ValueKind == JsonValueKind.String ? e.GetString() ?? "" : e.ToString();

    // ------------------------------------------------------------------------------------------ Löschung / Einschränkung (Art. 17/18 DSGVO)

    public sealed record Loeschplan(int Id, string Art, bool Einschraenken, string? FristBis, string? LetzterEintrag, Dictionary<string, int> Loeschen,
        Dictionary<string, int> Aufbewahren, List<string> Hinweise);

    /// <summary>Was geschieht beim Löschen einer Schülerin bzw. eines Schülers? (Vorschau)</summary>
    public Loeschplan SchuelerLoeschplan(int id)
    {
        var jahre = Regeln().Regeln[Klassenbuch].Wert;
        DateOnly? letzter = null;
        foreach (var t in Aufbewahrungspflichtig)
            if (_db.Wert($"SELECT MAX({DatumSpalte(t)}) FROM {t} WHERE schueler_id = @id", Db.P("@id", id)) is string s && DateOnly.TryParse(s, out var d) && (letzter is null || d > letzter))
                letzter = d;
        var frist = letzter is DateOnly l ? FristEnde(l, jahre) : (DateOnly?)null;
        var einschraenken = frist is DateOnly f && f >= _uhr.Heute;
        var loeschen = new Dictionary<string, int>();
        var aufbewahren = new Dictionary<string, int>();
        foreach (var t in SchuelerTabellen)
        {
            var n = Anzahl(t, id);
            if (n == 0) continue;
            if (einschraenken && Aufbewahrungspflichtig.Contains(t)) aufbewahren[t] = n; else loeschen[t] = n;
        }
        var plaetze = Sitzplaetze(id).Count;
        if (plaetze > 0) loeschen["sitzplaetze"] = plaetze;
        var hinweise = new List<string>();
        if (einschraenken)
            hinweise.Add($"Für Klassenbuch- und Abwesenheitsdaten läuft die Aufbewahrungsfrist bis {frist:dd.MM.yyyy} ({jahre} Jahre, VO-DV I § 9 – zu prüfen). " +
                "Diese Daten werden nicht gelöscht, sondern gesperrt (Einschränkung der Verarbeitung, Art. 18 DSGVO): Die Person erscheint in keiner Liste mehr; " +
                "die Daten werden nach Fristablauf automatisch gelöscht.");
        if (_pakete.Aktuell?.Paket.Elemente.Schueler.Any(x => x.Id == id) == true)
            hinweise.Add("Die Person kommt aus EduOrga Studio. Bitte dort bzw. in der Schulverwaltung (SchILD-NRW) ebenfalls löschen; EduOrga Web blendet sie bis dahin aus.");
        return new Loeschplan(id, "schueler", einschraenken, frist is null ? null : Plandienst.Iso(frist.Value), letzter is null ? null : Plandienst.Iso(letzter.Value), loeschen, aufbewahren, hinweise);
    }

    /// <summary>Schüler*in löschen bzw. – solange Aufbewahrungsfristen laufen – sperren (Einschränkung der Verarbeitung).</summary>
    public Loeschplan SchuelerLoeschen(int id, string von, string? grund)
    {
        var plan = SchuelerLoeschplan(id);
        var jetzt = _uhr.Jetzt.ToString("yyyy-MM-dd HH:mm");
        var w = _pakete.Aktuell?.Schueler.FirstOrDefault(x => x.Id == id) ?? _pakete.Aktuell?.Paket.Elemente.Schueler.FirstOrDefault(x => x.Id == id);
        var plaetze = Sitzplaetze(id);
        // gesperrte Konten: Schülerkonten, die nur dieser Person zugeordnet sind
        var konten = _db.Liste("SELECT b.id FROM benutzer b JOIN benutzer_schueler z ON z.benutzer_id = b.id WHERE z.schueler_id = @id AND b.rolle = 'schueler'", r => r.Zahl("id"), Db.P("@id", id));
        _db.Transaktion(c =>
        {
            foreach (var t in plan.Loeschen.Keys.Where(t => t != "sitzplaetze")) Db.Ausfuehren(c, $"DELETE FROM {t} WHERE schueler_id = @id", Db.P("@id", id));
            foreach (var p in plaetze)
            {
                p.Belegung.Remove(p.Platz);
                Db.Ausfuehren(c, "UPDATE sitzplan_bereiche SET belegung = @b WHERE id = @id", Db.P("@b", JsonSerializer.Serialize(p.Belegung)), Db.P("@id", p.Id));
            }
            foreach (var k in konten) Db.Ausfuehren(c, "UPDATE benutzer SET gesperrt = 1 WHERE id = @id", Db.P("@id", k));
            // Ausblenden (bleibt bei neuen Übertragungen aus EduOrga Studio bestehen); persönliche Angaben leeren
            if (Db.Ausfuehren(c, """
                    UPDATE schueler_daten SET geloescht = 1, geburtsdatum = '', email = '', bemerkung = '', extern_id = '', geaendert = @z WHERE id = @id
                    """, Db.P("@id", id), Db.P("@z", jetzt)) == 0)
                Db.Ausfuehren(c, "INSERT INTO schueler_daten (id, vorname, name, klasse, eigen, geloescht, geaendert) VALUES (@id, @v, @n, @k, @e, 1, @z)",
                    Db.P("@id", id), Db.P("@v", plan.Einschraenken ? w?.Vorname ?? "" : ""), Db.P("@n", plan.Einschraenken ? w?.Name ?? "" : ""), Db.P("@k", w?.Klasse ?? ""),
                    Db.P("@e", id >= Schuelerverwaltung.ErsteEigeneId), Db.P("@z", jetzt));
            if (!plan.Einschraenken) Db.Ausfuehren(c, "UPDATE schueler_daten SET vorname = '', name = '' WHERE id = @id", Db.P("@id", id));
            Db.Ausfuehren(c, "DELETE FROM datenschutz_sperren WHERE art = 'schueler' AND ref_id = @id", Db.P("@id", id));
            if (plan.Einschraenken)
                Db.Ausfuehren(c, "INSERT INTO datenschutz_sperren (art, ref_id, grund, bis, erstellt, von) VALUES ('schueler', @id, @g, @b, @z, @v)",
                    Db.P("@id", id), Db.P("@g", (grund ?? "").Trim() is { Length: > 0 } gr ? (gr.Length > 500 ? gr[..500] : gr) : "Löschung verlangt"),
                    Db.P("@b", plan.FristBis), Db.P("@z", jetzt), Db.P("@v", von));
        });
        Vermerken(von, plan.Einschraenken ? "person-gesperrt" : "person-geloescht", plan.Loeschen.Values.Sum(), plan.FristBis ?? "",
            $"Schüler*in Nr. {id}; gelöscht: {string.Join(", ", plan.Loeschen.Select(x => $"{x.Key} {x.Value}"))}" +
            (plan.Einschraenken ? $"; gesperrt bis {plan.FristBis}: {string.Join(", ", plan.Aufbewahren.Select(x => $"{x.Key} {x.Value}"))}" : ""));
        _pakete.SchuelerLaden();
        return plan;
    }

    /// <summary>Gesperrte Personen nach Fristablauf endgültig löschen (Teil jedes Löschlaufs).</summary>
    private List<Loeschergebnis> SperrenAbgelaufen(string ausgeloest)
    {
        var heute = Plandienst.Iso(_uhr.Heute);
        var faellig = _db.Liste("SELECT id, ref_id FROM datenschutz_sperren WHERE art = 'schueler' AND bis <> '' AND bis < @h", r => (Id: r.Zahl("id"), Ref: r.Zahl("ref_id")), Db.P("@h", heute));
        var summe = 0;
        foreach (var (sid, schueler) in faellig)
        {
            var n = 0;
            _db.Transaktion(c =>
            {
                foreach (var t in SchuelerTabellen) n += Db.Ausfuehren(c, $"DELETE FROM {t} WHERE schueler_id = @id", Db.P("@id", schueler));
                Db.Ausfuehren(c, "UPDATE schueler_daten SET vorname = '', name = '' WHERE id = @id", Db.P("@id", schueler));
                Db.Ausfuehren(c, "DELETE FROM datenschutz_sperren WHERE id = @id", Db.P("@id", sid));
            });
            summe += n;
            Vermerken(ausgeloest, "person-geloescht", n, heute, $"Schüler*in Nr. {schueler}: Sperre abgelaufen, Daten gelöscht");
        }
        return faellig.Count == 0 ? new() : new() { new Loeschergebnis("sperren", "Gesperrte Personen nach Fristablauf", true, 0, "tage", heute, summe, new() { ["personen"] = faellig.Count }) };
    }

    public List<Dictionary<string, object?>> Sperren() => Alle("SELECT * FROM datenschutz_sperren ORDER BY id DESC");

    /// <summary>
    /// Benutzerkonto anonymisieren (Art. 17): Konto bleibt als „Gelöschtes Konto“ stehen, damit Mitteilungen anderer Empfänger*innen und
    /// Klassenbucheinträge erhalten bleiben; persönliche Angaben, Anmeldeprotokoll, Geräte, Zuordnungen und Listen werden entfernt.
    /// </summary>
    public void BenutzerAnonymisieren(int id, string von)
    {
        _db.Transaktion(c =>
        {
            if (Db.Ausfuehren(c, """
                    UPDATE benutzer SET login = @l, anzeigename = 'Gelöschtes Konto', element = '', email = '', passwort = @p, gesperrt = 1, passwort_aendern = 0,
                        ical_token = @t, letzte_anmeldung = NULL, vorherige_anmeldung = NULL, benachrichtigung = 0, zusatzrechte = '', person_id = NULL, datenschutz_kenntnis = ''
                    WHERE id = @id
                    """, Db.P("@l", $"geloescht-{id}"), Db.P("@p", "!" + Sicherheit.Zufall(40)), Db.P("@t", Sicherheit.Zufall(32)), Db.P("@id", id)) == 0)
                throw new ArgumentException("Unbekannter Benutzer.");
            foreach (var t in new[] { "benutzer_anmeldungen", "push_geraete", "geraete_konten", "benutzer_schueler", "benutzer_rechte", "infocenter_gelesen" })
                Db.Ausfuehren(c, $"DELETE FROM {t} WHERE benutzer_id = @id", Db.P("@id", id));
            Db.Ausfuehren(c, "DELETE FROM mitteilung_listen WHERE besitzer_id = @id", Db.P("@id", id));
            Db.Ausfuehren(c, "UPDATE abwesenheitsmeldungen SET gemeldet_von = 'Gelöschtes Konto' WHERE benutzer_id = @id", Db.P("@id", id));
        });
        Vermerken(von, "konto-anonymisiert", 1, "", $"Benutzerkonto Nr. {id}");
    }

    // ------------------------------------------------------------------------------------------ Datenschutzhinweise (Art. 13/14)

    public Datenschutzangaben Angaben()
    {
        try { return _e.Lesen(AngabenSchluessel) is { Length: > 0 } j ? JsonSerializer.Deserialize<Datenschutzangaben>(j, Json) ?? new() : new(); }
        catch (JsonException) { return new(); }
    }

    public Datenschutzangaben AngabenSpeichern(Datenschutzangaben a, string von)
    {
        static string K(string? s, int n) => (s ?? "").Trim() is var t && t.Length > n ? throw new ArgumentException($"Eine Angabe ist zu lang (höchstens {n} Zeichen).") : t;
        var neu = new Datenschutzangaben(K(a.Verantwortlicher, 200), K(a.Anschrift, 500), K(a.Vertretung, 200), K(a.Kontakt, 300), K(a.DsbName, 200), K(a.DsbKontakt, 300),
            K(a.Betreiber, 500), K(a.Aufsichtsbehoerde, 500), K(a.Zusatz, 5000), a.Geprueft, _uhr.Jetzt.ToString("yyyy-MM-dd HH:mm"));
        _e.Schreiben(AngabenSchluessel, JsonSerializer.Serialize(neu, Json));
        _prot.Schreiben(von, "Datenschutzhinweise geändert", neu.Geprueft ? "geprüft" : "Entwurf");
        return neu;
    }

    /// <summary>Muss das Konto die Datenschutzhinweise noch zur Kenntnis nehmen? (Schüler- und Elternkonten, bei jeder neuen Fassung)</summary>
    public bool KenntnisOffen(Benutzer b)
    {
        if (!b.Familie) return false;
        var stand = Angaben().Stand;
        var k = _db.Wert("SELECT datenschutz_kenntnis FROM benutzer WHERE id = @id", Db.P("@id", b.Id)) as string ?? "";
        return k.Length == 0 || string.CompareOrdinal(k, stand) < 0;
    }

    public void KenntnisVermerken(Benutzer b) =>
        _db.Ausfuehren("UPDATE benutzer SET datenschutz_kenntnis = @z WHERE id = @id", Db.P("@z", _uhr.Jetzt.ToString("yyyy-MM-dd HH:mm")), Db.P("@id", b.Id));
}

/// <summary>Löscht täglich nach den eingeschalteten Fristen (erster Lauf einige Minuten nach dem Start; <c>UNTPLANWEB_AUFBEWAHRUNG=0</c> schaltet ab).</summary>
public sealed class Aufbewahrungsdienst : BackgroundService
{
    private readonly Datenschutzdienst _ds;
    private readonly ILogger<Aufbewahrungsdienst> _log;
    private readonly bool _aktiv;

    public Aufbewahrungsdienst(Datenschutzdienst ds, ILogger<Aufbewahrungsdienst> log, IConfiguration konfig)
    {
        _ds = ds;
        _log = log;
        _aktiv = (konfig["UNTPLANWEB_AUFBEWAHRUNG"] ?? "1") is not ("0" or "aus" or "false");
    }

    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        if (!_aktiv) return;
        try { await Task.Delay(TimeSpan.FromMinutes(10), stop); } catch (TaskCanceledException) { return; }
        using var takt = new PeriodicTimer(TimeSpan.FromHours(24));
        do
        {
            try
            {
                var res = _ds.Ausfuehren("automatisch");
                if (res.Sum(r => r.Anzahl) > 0) _log.LogInformation("Aufbewahrung: {Anzahl} Einträge nach Fristablauf gelöscht.", res.Sum(r => r.Anzahl));
            }
            catch (Exception ex) { _log.LogWarning(ex, "Aufbewahrung: Löschlauf fehlgeschlagen."); }
        }
        while (await takt.WaitForNextTickAsync(stop).ConfigureAwait(false));
    }
}
