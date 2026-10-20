import Foundation

// Modelle der weiteren Bereiche von EduOrga Web (Klassenbuch, Melden, Buchen, Prüfungen, Vertretungsplan, Infocenter,
// Familie, Sitzplan). Alle Felder werden nachsichtig gelesen (siehe Dekodierung.swift); Feldnamen wie in der Web-API
// (camelCase).

// MARK: - Darstellung der Stundenkarten

/// Darstellung der Stundenkarten (Administration | Darstellung der Stundenkarten, Feld `darstellung` der Sitzung;
/// Server: web/src/UntPlanWeb/Dienste/Kartendarstellung.cs). Fehlende Angaben erhalten ihren Standard – den der Vorlage
/// „EduOrga Standard“ wie im Web: kompakte weiße Karten, Leiste links 5 px (grau bzw. Fachfarbe mit leichter Tönung),
/// Kontur 1,5 px („fein“), Radius 4, Änderungen und Prüfungen in der hellen Statusfläche.
struct Kartendarstellung: Decodable, Equatable, Sendable {
    /// balken-flaeche | balken-links | balken-oben | quadrat | flaeche | keine
    var fachfarbe = "balken-oben"
    /// 2–6 px
    var balkenbreite = 3
    /// 6–30 % (bei Fachfarbe „flaeche“ bzw. „balken-flaeche“)
    var deckkraft = 12
    /// neutral | weiss | getoent
    var flaeche = "weiss"
    /// fein | kraeftig | keiner
    var rahmen = "fein"
    /// 0–8 px
    var eckenradius = 2
    /// kompakt | normal | grosszuegig
    var dichte = "kompakt"
    /// kuerzel | name
    var fach = "kuerzel"
    var raum = true
    var zeile2 = true
    /// kuerzel | name
    var zeile2Text = "kuerzel"
    /// gefuellt | umrandet | text
    var kuerzel = "text"
    var statuswoerter = false
    /// Geänderte Stunden und Prüfungen zusätzlich in der hellen Statusfläche
    var statusflaeche = true
    /// element (Lehrkraft bzw. Klasse oben, Standard) | fach (Fach oben)
    var reihenfolge = "element"
    /// Nicht vom Server: Karten für Schüler*innen, Eltern bzw. Klassenkonten – eine offene Vertretung steht dann als
    /// „Vertretung folgt“ statt mit dem Kürzel der abwesenden Lehrkraft (gesetzt in `AppZustand.darstellung`).
    var fuerFamilie = false

    init() {}

    enum CodingKeys: String, CodingKey {
        case fachfarbe, balkenbreite, deckkraft, flaeche, rahmen, eckenradius, dichte, fach, raum, zeile2, zeile2Text, kuerzel, statuswoerter
        case statusflaeche, reihenfolge
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let standard = Kartendarstellung()
        fachfarbe = c.textOderNil(.fachfarbe) ?? standard.fachfarbe
        balkenbreite = min(6, max(2, c.zahl(.balkenbreite) ?? standard.balkenbreite))
        deckkraft = min(30, max(6, c.zahl(.deckkraft) ?? standard.deckkraft))
        flaeche = c.textOderNil(.flaeche) ?? standard.flaeche
        rahmen = c.textOderNil(.rahmen) ?? standard.rahmen
        eckenradius = min(8, max(0, c.zahl(.eckenradius) ?? standard.eckenradius))
        dichte = c.textOderNil(.dichte) ?? standard.dichte
        fach = c.textOderNil(.fach) ?? standard.fach
        raum = c.contains(.raum) ? c.wahr(.raum) : standard.raum
        zeile2 = c.contains(.zeile2) ? c.wahr(.zeile2) : standard.zeile2
        zeile2Text = c.textOderNil(.zeile2Text) ?? standard.zeile2Text
        kuerzel = c.textOderNil(.kuerzel) ?? standard.kuerzel
        statuswoerter = c.wahr(.statuswoerter)
        // wie im Web: fehlende Angaben (ältere Server) erhalten den Standard
        statusflaeche = c.contains(.statusflaeche) ? c.wahr(.statusflaeche) : standard.statusflaeche
        reihenfolge = c.textOderNil(.reihenfolge) ?? standard.reihenfolge
    }

    /// Fachfarbe als Balken links (auch „balken-flaeche“), oben, als Quadrat, als Tönung oder keine.
    var balkenLinks: Bool { fachfarbe == "balken-links" || fachfarbe == "balken-flaeche" }
    var balkenOben: Bool { fachfarbe == "balken-oben" }
    var quadrat: Bool { fachfarbe == "quadrat" }
    var mitToenung: Bool { fachfarbe == "flaeche" || fachfarbe == "balken-flaeche" }
    var ohneFachfarbe: Bool { fachfarbe == "keine" }
    var kompakt: Bool { dichte == "kompakt" }
    var grosszuegig: Bool { dichte == "grosszuegig" }
}

// MARK: - Klassenbuch: offene Stunden

/// Vordefinierter Zeitbereich der offenen Stunden (heute, woche, letzte, tage14, monat, schuljahr, individuell).
struct OffenZeitbereich: Decodable, Identifiable, Hashable, Sendable {
    var id: String
    var text: String

    enum CodingKeys: String, CodingKey { case id, text }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.text(.id)
        text = c.text(.text)
    }
}

/// Gehaltene Stunde mit Stand von Abwesenheitskontrolle und Lehrstoff (GET /api/app/klassenbuch/offene-stunden).
struct OffeneStunde: Decodable, Identifiable, Sendable {
    var lehrer: String
    var klassen: [String]
    var fach: String
    var fachName: String
    var farbe: String
    var datum: String
    var von: Int
    var bis: Int
    var beginn: String
    var ende: String
    var art: String
    var status: String
    var raeume: [String]
    var geprueft: Bool
    var lehrstoff: Bool
    var unterricht: Int

    var id: String { "\(datum)|\(von)|\(unterricht)|\(lehrer)" }

    enum CodingKeys: String, CodingKey {
        case lehrer, klassen, fach, fachName, farbe, datum, von, bis, beginn, ende, art, status, raeume, geprueft, lehrstoff, unterricht
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        lehrer = c.text(.lehrer)
        klassen = c.texte(.klassen)
        fach = c.text(.fach)
        fachName = c.text(.fachName)
        farbe = c.text(.farbe)
        datum = String(c.text(.datum).prefix(10))
        von = c.zahl(.von) ?? 0
        bis = max(c.zahl(.bis) ?? 0, von)
        beginn = c.text(.beginn)
        ende = c.text(.ende)
        art = c.text(.art)
        status = c.text(.status).lowercased()
        raeume = c.texte(.raeume)
        geprueft = c.wahr(.geprueft)
        lehrstoff = c.wahr(.lehrstoff)
        unterricht = c.zahl(.unterricht) ?? 0
    }

    /// Karte für die große Stundenansicht (Klassenbuch der Stunde).
    var karte: Karte {
        var k = Karte(datum: datum, von: von, bis: bis, beginn: beginn, ende: ende,
                      status: status == "klausur" || status.isEmpty ? "regulaer" : status,
                      fach: fach, fachName: fachName, farbe: farbe,
                      klassen: klassen.map { Wert(k: $0) }, lehrer: lehrer.isEmpty ? [] : [Wert(k: lehrer)],
                      raeume: raeume.map { Wert(k: $0) }, art: art)
        k.unterricht = unterricht
        return k
    }
}

/// GET /api/app/klassenbuch/offene-stunden
struct OffeneStundenAntwort: Decodable, Sendable {
    var bereich: String
    var von: String
    var bis: String
    var bereiche: [OffenZeitbereich]
    var alle: Bool
    var klassenleitung: [String]
    var abwesenheitskontrolle: Bool
    var gesamt: Int
    var offen: Int
    var ohneKontrolle: Int
    var ohneLehrstoff: Int
    var vollstaendig: Int
    var zeilen: [OffeneStunde]

    enum CodingKeys: String, CodingKey {
        case bereich, von, bis, bereiche, alle, klassenleitung, abwesenheitskontrolle, gesamt, offen, ohneKontrolle, ohneLehrstoff, vollstaendig, zeilen
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        bereich = c.text(.bereich)
        von = c.text(.von)
        bis = c.text(.bis)
        bereiche = c.liste(.bereiche)
        alle = c.wahr(.alle)
        klassenleitung = c.texte(.klassenleitung)
        abwesenheitskontrolle = c.contains(.abwesenheitskontrolle) ? c.wahr(.abwesenheitskontrolle) : true
        zeilen = c.liste(.zeilen)
        gesamt = c.zahl(.gesamt) ?? zeilen.count
        offen = c.zahl(.offen) ?? zeilen.count
        ohneKontrolle = c.zahl(.ohneKontrolle) ?? 0
        ohneLehrstoff = c.zahl(.ohneLehrstoff) ?? 0
        vollstaendig = c.zahl(.vollstaendig) ?? 0
    }
}

/// PUT /api/app/klassenbuch/offene-stunden/zeitbereich
struct OffenZeitbereichDaten: Encodable, Sendable {
    var bereich: String
    var von: String?
    var bis: String?
}

// MARK: - Klassenbucheinträge

/// Klassenbucheintrag (Vermerk) in Listen über mehrere Klassen (GET /api/app/klassenbucheintraege).
struct Vermerkzeile: Decodable, Identifiable, Sendable {
    var id: Int
    var datum: String
    var klasse: String
    var schuelerId: Int?
    var schueler: String
    var art: String
    var text: String
    var lehrer: String
    var zeit: String
    var stunde: Int
    var bearbeiten: Bool
    var loeschen: Bool

    enum CodingKeys: String, CodingKey { case id, datum, klasse, schuelerId, schueler, art, text, lehrer, zeit, stunde, bearbeiten, loeschen }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.zahl(.id) ?? 0
        datum = String(c.text(.datum).prefix(10))
        klasse = c.text(.klasse)
        schuelerId = c.zahl(.schuelerId)
        schueler = c.text(.schueler)
        art = c.text(.art)
        text = c.text(.text)
        lehrer = c.text(.lehrer)
        zeit = c.text(.zeit)
        stunde = c.zahl(.stunde) ?? 0
        bearbeiten = c.wahr(.bearbeiten)
        loeschen = c.wahr(.loeschen)
    }
}

struct Vermerkzeilen: Decodable, Sendable {
    var arten: [String]
    var eintraege: [Vermerkzeile]

    enum CodingKeys: String, CodingKey { case arten, eintraege }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        arten = c.texte(.arten)
        eintraege = c.liste(.eintraege)
    }
}

// MARK: - Hausaufgaben (Listen)

/// Hausaufgabe in Listen (Kollegium: GET /api/app/hausaufgaben/eintraege; Familie: GET /api/app/familie/hausaufgaben).
struct HausaufgabeZeile: Decodable, Identifiable, Sendable {
    var id: Int
    var datum: String
    var stunde: Int
    var klassen: [String]
    var fach: String
    var lehrer: String
    var text: String
    var faellig: String?
    var bemerkung: String
    var erledigt: Bool
    var darf: Bool

    enum CodingKeys: String, CodingKey { case id, datum, stunde, klassen, fach, lehrer, text, hausaufgabe, faellig, bemerkung, erledigt, darf, klasse }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.zahl(.id) ?? Int.random(in: 1_000_000...9_999_999)
        datum = String(c.text(.datum).prefix(10))
        stunde = c.zahl(.stunde) ?? 0
        let liste = c.texte(.klassen)
        klassen = liste.isEmpty ? [c.text(.klasse)].filter { !$0.isEmpty } : liste
        fach = c.text(.fach)
        lehrer = c.text(.lehrer)
        let t = c.text(.text)
        text = t.isEmpty ? c.text(.hausaufgabe) : t
        let f = (c.textOderNil(.faellig) ?? "").trimmingCharacters(in: .whitespaces)
        faellig = f.isEmpty ? nil : String(f.prefix(10))
        bemerkung = c.text(.bemerkung)
        erledigt = c.wahr(.erledigt)
        darf = c.wahr(.darf)
    }
}

/// GET /api/app/familie/hausaufgaben
struct FamilieHausaufgaben: Decodable, Sendable {
    var zeilen: [HausaufgabeZeile]

    enum CodingKeys: String, CodingKey { case zeilen }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        zeilen = c.liste(.zeilen)
    }
}

// MARK: - Klassendienste

struct Dienstart: Decodable, Identifiable, Hashable, Sendable {
    var id: Int
    var kurz: String
    var name: String

    enum CodingKeys: String, CodingKey { case id, kurz, name }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.zahl(.id) ?? 0
        kurz = c.text(.kurz)
        name = c.text(.name)
    }

    var anzeige: String { name.isEmpty ? kurz : name }
}

/// Klassendienst einer Schülerin bzw. eines Schülers in einem Zeitraum.
struct Dienstzuordnung: Decodable, Identifiable, Sendable {
    var id: Int
    var dienstId: Int
    var dienst: String
    var schuelerId: Int
    var schueler: String
    var klasse: String
    var von: String
    var bis: String
    var text: String

    enum CodingKeys: String, CodingKey { case id, dienstId, dienst, schuelerId, schueler, klasse, von, bis, text }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.zahl(.id) ?? 0
        dienstId = c.zahl(.dienstId) ?? 0
        dienst = c.text(.dienst)
        schuelerId = c.zahl(.schuelerId) ?? 0
        schueler = c.text(.schueler)
        klasse = c.text(.klasse)
        von = String(c.text(.von).prefix(10))
        bis = String(c.text(.bis).prefix(10))
        text = c.text(.text)
    }
}

/// GET /api/app/klassendienste?klasse=…&von=…&bis=…
struct KlassendienstUebersicht: Decodable, Sendable {
    var arten: [Dienstart]
    var zuordnungen: [Dienstzuordnung]
    var schueler: [Schueler]
    var verwalten: Bool

    enum CodingKeys: String, CodingKey { case arten, zuordnungen, schueler, verwalten }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        arten = c.liste(.arten)
        zuordnungen = c.liste(.zuordnungen)
        schueler = c.liste(.schueler)
        verwalten = c.wahr(.verwalten)
    }
}

/// POST /api/app/klassendienste
struct DienstDaten: Encodable, Sendable {
    var dienstId: Int
    var schuelerId: Int
    var von: String
    var bis: String
    var text: String?
}

// MARK: - Befreiungen

/// Befreiung vom Unterricht (Zeitraum, optional Wochentag 1–7, Fach und Uhrzeit).
struct Befreiung: Decodable, Identifiable, Sendable {
    var id: Int
    var schuelerId: Int
    var schueler: String
    var klasse: String
    var von: String
    var bis: String
    var wochentag: Int
    var fach: String
    var beginn: String
    var ende: String
    var grund: String
    var text: String

    enum CodingKeys: String, CodingKey { case id, schuelerId, schueler, klasse, von, bis, wochentag, fach, beginn, ende, grund, text }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.zahl(.id) ?? 0
        schuelerId = c.zahl(.schuelerId) ?? 0
        schueler = c.text(.schueler)
        klasse = c.text(.klasse)
        von = String(c.text(.von).prefix(10))
        bis = String(c.text(.bis).prefix(10))
        wochentag = c.zahl(.wochentag) ?? 0
        fach = c.text(.fach)
        beginn = c.text(.beginn)
        ende = c.text(.ende)
        grund = c.text(.grund)
        text = c.text(.text)
    }
}

/// GET /api/app/befreiungen
struct Befreiungsliste: Decodable, Sendable {
    var befreiungen: [Befreiung]
    var gruende: [Abwesenheitsgrund]
    var verwalten: Bool

    enum CodingKeys: String, CodingKey { case befreiungen, gruende, verwalten }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        befreiungen = c.liste(.befreiungen)
        gruende = c.liste(.gruende)
        verwalten = c.wahr(.verwalten)
    }
}

/// POST /api/app/befreiungen bzw. PUT /api/app/befreiungen/{id}
struct BefreiungDaten: Encodable, Sendable {
    var schuelerId: Int
    var von: String
    var bis: String
    /// 0 = jeden Tag, 1–7 = Montag–Sonntag
    var wochentag: Int?
    var fach: String?
    var beginn: String?
    var ende: String?
    var grund: String?
    var text: String?
}

// MARK: - Sitzplan

/// Sitzplan (Raster aus Reihen und Plätzen, Belegung „reihe-platz“ → Schüler-ID; Reihen und Plätze ab 1).
struct SitzplanPlan: Decodable, Sendable {
    var bereich: String
    var zeilen: Int
    var spalten: Int
    var pult: String
    var belegung: [String: Int]
    var ohneTisch: [String]
    var geaendert: String
    var vorhanden: Bool

    enum CodingKeys: String, CodingKey { case bereich, zeilen, spalten, pult, belegung, ohneTisch, geaendert, vorhanden }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        bereich = c.text(.bereich)
        zeilen = max(1, c.zahl(.zeilen) ?? 5)
        spalten = max(1, c.zahl(.spalten) ?? 6)
        pult = c.text(.pult)
        belegung = (try? c.decodeIfPresent([String: Int].self, forKey: .belegung)) ?? [:]
        ohneTisch = c.texte(.ohneTisch)
        geaendert = c.text(.geaendert)
        vorhanden = c.contains(.vorhanden) ? c.wahr(.vorhanden) : !belegung.isEmpty
    }

    var pultHinten: Bool { pult == "hinten" }

    var bereichText: String {
        switch bereich {
        case "unterricht": return "Sitzplan des Unterrichts"
        case "raum": return "Sitzplan des Raums"
        default: return "Sitzplan der Klasse"
        }
    }
}

/// GET /api/app/sitzplan/{klasse}
struct SitzplanKlasse: Decodable, Sendable {
    var plan: SitzplanPlan?
    var schueler: [Schueler]
    var verwalten: Bool

    enum CodingKeys: String, CodingKey { case plan, schueler, verwalten }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        plan = c.optional(.plan)
        schueler = c.liste(.schueler)
        verwalten = c.wahr(.verwalten)
    }
}

/// GET /api/app/sitzplaene/stunde?unterricht=…&raeume=…&klassen=…&lehrer=…
struct SitzplanStunde: Decodable, Sendable {
    var schueler: [Schueler]
    var gueltig: SitzplanPlan?

    enum CodingKeys: String, CodingKey { case schueler, gueltig }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        schueler = c.liste(.schueler)
        gueltig = c.optional(.gueltig)
    }
}

// MARK: - Prüfungen

/// Prüfung (Klausur aus dem Plan bzw. in EduOrga vorgemerkt) – GET /api/app/pruefungen.
struct Pruefung: Decodable, Identifiable, Sendable {
    var datum: String
    var stundeVon: Int
    var stundeBis: Int
    var beginn: String
    var ende: String
    var titel: String
    var klassen: [String]
    var lehrer: [String]
    var raeume: [String]
    var status: String
    var text: String
    var art: String
    var fach: String
    var darfLoeschen: Bool

    var id: String { "\(datum)|\(stundeVon)|\(stundeBis)|\(klassen.joined(separator: ","))|\(titel)" }

    enum CodingKeys: String, CodingKey {
        case datum, stundeVon, stundeBis, beginn, ende, titel, klassen, lehrer, raeume, status, text, art, fach, darfLoeschen
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        datum = String(c.text(.datum).prefix(10))
        stundeVon = c.zahl(.stundeVon) ?? 0
        stundeBis = max(c.zahl(.stundeBis) ?? 0, stundeVon)
        beginn = c.text(.beginn)
        ende = c.text(.ende)
        titel = c.text(.titel)
        klassen = c.texte(.klassen)
        lehrer = c.texte(.lehrer)
        raeume = c.texte(.raeume)
        status = c.text(.status).lowercased()
        text = c.text(.text)
        art = c.text(.art)
        fach = c.text(.fach)
        darfLoeschen = c.wahr(.darfLoeschen)
    }

    /// Vorgemerkt (in EduOrga eingetragen, von der Planung noch nicht übernommen)?
    var vorgemerkt: Bool { status == "vorgemerkt" || status == "offen" }

    var stundenText: String {
        guard stundeVon > 0 else { return "" }
        return stundeVon == stundeBis ? "\(stundeVon). Std." : "\(stundeVon).–\(stundeBis). Std."
    }
}

/// POST /api/app/meldungen/klausur
struct KlausurDaten: Encodable, Sendable {
    var datum: String
    var stundeVon: Int
    var stundeBis: Int
    var klassen: [String]
    var raeume: [String]
    var aufsicht: [String]
    var titel: String
    var text: String
}

/// POST /api/app/meldungen/klausur/loeschen
struct KlausurLoeschenDaten: Encodable, Sendable {
    var datum: String
    var stundeVon: Int
    var stundeBis: Int
    var klassen: [String]
    var titel: String?
}

/// POST /api/app/meldungen/klausur/verlegen – Prüfung ändern bzw. verlegen (löschen und neu eintragen als Einheit; die
/// bisherige Prüfung zählt für die Prüfungssperre nicht mit).
struct KlausurVerlegenDaten: Encodable, Sendable {
    var alt: KlausurLoeschenDaten
    var neu: KlausurDaten
}

/// Prüfungsart der Schule (GET /api/app/pruefungsarten → `{arten: [{name, kurz, notenschema}], darf}`).
struct Pruefungsart: Decodable, Hashable, Sendable {
    var name: String
    var kurz: String

    enum CodingKeys: String, CodingKey { case name, kurz }

    init(name: String, kurz: String = "") {
        self.name = name
        self.kurz = kurz
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = c.text(.name)
        kurz = c.text(.kurz)
    }

    var anzeige: String { name.isEmpty ? kurz : name }

    /// Vorgabe, wenn die Schule keine Arten gepflegt hat (wie im Web).
    static let vorgabe: [Pruefungsart] = ["Klausur", "Klassenarbeit", "Test", "Prüfung", "Abschlussprüfung", "Präsentation",
                                          "Referat", "Vergleichsarbeit"].map { Pruefungsart(name: $0) }
}

struct Pruefungsarten: Decodable, Sendable {
    var arten: [Pruefungsart]

    enum CodingKeys: String, CodingKey { case arten }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        arten = c.liste(.arten)
    }
}

/// POST /api/app/meldungen/abwesenheit (eigene Abwesenheit einer Lehrkraft; Stunden nil = ganztägig)
struct AbwesenheitMeldenDaten: Encodable, Sendable {
    var von: String
    var bis: String
    var stundeVon: Int?
    var stundeBis: Int?
    var grund: String
    var text: String
}

// MARK: - Vertretungsplan

struct Vertretungszeile: Decodable, Identifiable, Sendable {
    let id = UUID()
    var klassen: String
    var stunde: String
    var stundeVon: Int
    var fach: String
    var fachAlt: String
    var lehrer: String
    var lehrerAlt: String
    var raum: String
    var raumAlt: String
    var art: String
    var text: String
    var vertrVon: String
    var nach: String
    var status: String

    enum CodingKeys: String, CodingKey { case klassen, stunde, stundeVon, fach, fachAlt, lehrer, lehrerAlt, raum, raumAlt, art, text, vertrVon, nach, status }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        klassen = c.text(.klassen)
        stunde = c.text(.stunde)
        stundeVon = c.zahl(.stundeVon) ?? 0
        fach = c.text(.fach)
        fachAlt = c.text(.fachAlt)
        lehrer = c.text(.lehrer)
        lehrerAlt = c.text(.lehrerAlt)
        raum = c.text(.raum)
        raumAlt = c.text(.raumAlt)
        art = c.text(.art)
        text = c.text(.text)
        vertrVon = c.text(.vertrVon)
        nach = c.text(.nach)
        status = c.text(.status).lowercased()
    }

    var entfall: Bool { status == "entfall" || art.lowercased().contains("entfall") }
}

struct Vertretungstag: Decodable, Identifiable, Sendable {
    var datum: String
    var wochentag: String
    var woche: String
    var frei: Bool
    var freiGrund: String
    var nachrichten: [String]
    var abwesendeKlassen: [String]
    var abwesendeLehrer: [String]
    var blockierteRaeume: [String]
    var veranstaltungen: [String]
    var zeilen: [Vertretungszeile]

    var id: String { datum }

    enum CodingKeys: String, CodingKey {
        case datum, wochentag, woche, frei, freiGrund, nachrichten, abwesendeKlassen, abwesendeLehrer, blockierteRaeume, veranstaltungen, zeilen
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        datum = String(c.text(.datum).prefix(10))
        wochentag = c.text(.wochentag)
        woche = c.text(.woche)
        frei = c.wahr(.frei)
        freiGrund = c.text(.freiGrund)
        nachrichten = c.texte(.nachrichten)
        abwesendeKlassen = c.texte(.abwesendeKlassen)
        abwesendeLehrer = c.texte(.abwesendeLehrer)
        blockierteRaeume = c.texte(.blockierteRaeume)
        veranstaltungen = c.texte(.veranstaltungen)
        zeilen = c.liste(.zeilen)
    }
}

struct Vertretungsplan: Decodable, Sendable {
    var tage: [Vertretungstag]

    enum CodingKeys: String, CodingKey { case tage }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        tage = c.liste(.tage)
    }
}

// MARK: - Infocenter (Neuigkeiten)

/// Info der Schule bzw. Neuigkeit (GET /api/app/infocenter).
struct InfocenterEintrag: Decodable, Identifiable, Sendable {
    var schluessel: String
    /// info | neuigkeit
    var art: String
    var kategorie: String
    var titel: String
    var text: String
    var punkte: [String]
    var datum: String
    var wichtig: Bool
    var gelesen: Bool

    var id: String { schluessel }

    enum CodingKeys: String, CodingKey { case schluessel, art, kategorie, titel, text, punkte, datum, wichtig, gelesen }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        schluessel = c.text(.schluessel)
        art = c.text(.art)
        kategorie = c.text(.kategorie)
        titel = c.text(.titel)
        text = c.text(.text)
        punkte = c.texte(.punkte)
        datum = c.text(.datum)
        wichtig = c.wahr(.wichtig)
        gelesen = c.wahr(.gelesen)
    }
}

struct InfocenterAntwort: Decodable, Sendable {
    var eintraege: [InfocenterEintrag]
    var ungelesen: Int

    enum CodingKeys: String, CodingKey { case eintraege, ungelesen }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        eintraege = c.liste(.eintraege)
        ungelesen = c.zahl(.ungelesen) ?? eintraege.filter { !$0.gelesen }.count
    }
}

/// POST /api/app/infocenter/gelesen
struct InfocenterGelesenDaten: Encodable, Sendable {
    var schluessel: [String]
    var alle: Bool
}

/// PUT /api/app/profil
struct ProfilDaten: Encodable, Sendable {
    var email: String
    var sprache: String
    var benachrichtigung: Bool
}

// MARK: - Buchen (Räume und Ressourcen)

struct BuchZeitraster: Decodable, Identifiable, Hashable, Sendable {
    var nr: Int
    var beginn: String
    var ende: String

    var id: Int { nr }

    enum CodingKeys: String, CodingKey { case nr, beginn, ende }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        nr = c.zahl(.nr) ?? 0
        beginn = c.text(.beginn)
        ende = c.text(.ende)
    }
}

struct Ressourcenart: Decodable, Identifiable, Hashable, Sendable {
    var id: Int
    var name: String

    enum CodingKeys: String, CodingKey { case id, name }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.zahl(.id) ?? 0
        name = c.text(.name)
    }
}

/// GET /api/app/buchen/optionen
struct Buchungsoptionen: Decodable, Sendable {
    var raumBuchen: Bool
    var ressourcenBuchen: Bool
    var ich: String
    var ressourcenarten: [Ressourcenart]
    var zeitraster: [BuchZeitraster]
    var tageProWoche: Int
    var naechsterTag: String

    enum CodingKeys: String, CodingKey { case raumBuchen, ressourcenBuchen, ich, ressourcenarten, zeitraster, tageProWoche, naechsterTag }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        raumBuchen = c.contains(.raumBuchen) ? c.wahr(.raumBuchen) : true
        ressourcenBuchen = c.contains(.ressourcenBuchen) ? c.wahr(.ressourcenBuchen) : true
        ich = c.text(.ich)
        ressourcenarten = c.liste(.ressourcenarten)
        let raster: [BuchZeitraster] = c.liste(.zeitraster)
        zeitraster = raster.filter { $0.nr > 0 }
        tageProWoche = max(5, c.zahl(.tageProWoche) ?? 5)
        naechsterTag = String(c.text(.naechsterTag).prefix(10))
    }
}

/// Zeitangabe einer Buchung: einmalig (datum) oder als Serie (von, bis, wochentage 0 = Montag).
struct BuchZeitangabe: Encodable, Sendable {
    /// einmalig | taeglich | woechentlich | 2wochen | 3wochen | 4wochen
    var wiederholung: String
    var datum: String?
    var von: String?
    var bis: String?
    var wochentage: [Int]
    var stundeVon: Int
    var stundeBis: Int
}

struct BuchSuchKriterien: Encodable, Sendable {
    var maxBelegung: Int = 0
    var ressourcenarten: [Int]? = nil
}

/// POST /api/app/buchen/suche/raeume bzw. /suche/ressourcen
struct BuchSuchAnfrage: Encodable, Sendable {
    var zeit: BuchZeitangabe
    var kriterien: BuchSuchKriterien
}

/// Einzeltermin einer Buchung (Datum, Stunden, Wochentag).
struct BuchTermin: Decodable, Hashable, Sendable {
    var datum: String
    var stundeVon: Int
    var stundeBis: Int
    var wochentag: String
    var beginn: String
    var ende: String

    enum CodingKeys: String, CodingKey { case datum, stundeVon, stundeBis, wochentag, beginn, ende }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        datum = String(c.text(.datum).prefix(10))
        stundeVon = c.zahl(.stundeVon) ?? 0
        stundeBis = max(c.zahl(.stundeBis) ?? 0, stundeVon)
        wochentag = c.text(.wochentag)
        beginn = c.text(.beginn)
        ende = c.text(.ende)
    }
}

/// Termin der Raumsuche mit den freien Räumen.
struct BuchSuchTermin: Decodable, Sendable {
    var termin: BuchTermin?
    var freieRaeume: [String]

    enum CodingKeys: String, CodingKey { case termin, freieRaeume }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        termin = c.optional(.termin)
        freieRaeume = c.texte(.freieRaeume)
    }
}

struct BuchSuchRaum: Decodable, Identifiable, Hashable, Sendable {
    var kurz: String
    var name: String
    var raumart: String
    var kapazitaet: Int
    var gebaeude: String
    var ressourcen: [String]
    /// Indizes der Termine, an denen der Raum belegt ist
    var belegt: [Int]

    var id: String { kurz }

    enum CodingKeys: String, CodingKey { case kurz, name, raumart, kapazitaet, gebaeude, ressourcen, belegt }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        kurz = c.text(.kurz)
        name = c.text(.name)
        raumart = c.text(.raumart)
        kapazitaet = c.zahl(.kapazitaet) ?? 0
        gebaeude = c.text(.gebaeude)
        ressourcen = c.texte(.ressourcen)
        belegt = (try? c.decodeIfPresent([Int].self, forKey: .belegt)) ?? []
    }
}

/// Ergebnis der Raumsuche.
struct Raumsuche: Decodable, Sendable {
    var termine: [BuchSuchTermin]
    var raeume: [BuchSuchRaum]

    enum CodingKeys: String, CodingKey { case termine, raeume }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        termine = c.liste(.termine)
        raeume = c.liste(.raeume)
    }
}

struct BuchSuchRessource: Decodable, Identifiable, Hashable, Sendable {
    var id: Int
    var name: String
    var art: String
    var anzahl: Int
    var standort: String
    var bemerkung: String
    /// Verfügbare Menge je Termin
    var verfuegbar: [Int]
    var frei: Int
    var belegt: [Int]

    enum CodingKeys: String, CodingKey { case id, name, art, anzahl, standort, bemerkung, verfuegbar, frei, belegt }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.zahl(.id) ?? 0
        name = c.text(.name)
        art = c.text(.art)
        anzahl = c.zahl(.anzahl) ?? 1
        standort = c.text(.standort)
        bemerkung = c.text(.bemerkung)
        verfuegbar = (try? c.decodeIfPresent([Int].self, forKey: .verfuegbar)) ?? []
        frei = c.zahl(.frei) ?? 0
        belegt = (try? c.decodeIfPresent([Int].self, forKey: .belegt)) ?? []
    }
}

/// Ergebnis der Ressourcensuche (Termine ohne Hülle).
struct Ressourcensuche: Decodable, Sendable {
    var termine: [BuchTermin]
    var ressourcen: [BuchSuchRessource]

    enum CodingKeys: String, CodingKey { case termine, ressourcen }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        termine = c.liste(.termine)
        ressourcen = c.liste(.ressourcen)
    }
}

struct BuchTerminWahl: Encodable, Sendable {
    var datum: String
    var stundeVon: Int
    var stundeBis: Int
    var raum: String?
}

struct BuchRessourcenWahl: Encodable, Sendable {
    var id: Int
    var menge: Int
}

/// POST /api/app/buchen
struct BuchungNeuDaten: Encodable, Sendable {
    /// raum | ressource
    var art: String
    var termine: [BuchTerminWahl]
    var ressourcen: [BuchRessourcenWahl]
    var klassen: [String]
    var lehrer: String?
    var titel: String
    var text: String
}

struct BuchungsRessource: Decodable, Hashable, Sendable {
    var id: Int
    var name: String
    var menge: Int

    enum CodingKeys: String, CodingKey { case id, name, menge }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.zahl(.id) ?? 0
        name = c.text(.name)
        menge = c.zahl(.menge) ?? 1
    }
}

/// Buchung (Meine Buchungen, Ergebnis des Buchens).
struct Buchung: Decodable, Identifiable, Sendable {
    var id: Int
    var serie: String
    var art: String
    var artName: String
    var datum: String
    var wochentag: String
    var stundeVon: Int
    var stundeBis: Int
    var beginn: String
    var ende: String
    var raum: String
    var klassen: [String]
    var titel: String
    var text: String
    var status: String
    var storniert: String
    var ressourcen: [BuchungsRessource]

    enum CodingKeys: String, CodingKey {
        case id, serie, art, artName, datum, wochentag, stundeVon, stundeBis, beginn, ende, raum, klassen, titel, text, status, storniert, ressourcen
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = c.zahl(.id) ?? 0
        serie = c.text(.serie)
        art = c.text(.art)
        artName = c.text(.artName)
        datum = String(c.text(.datum).prefix(10))
        wochentag = c.text(.wochentag)
        stundeVon = c.zahl(.stundeVon) ?? 0
        stundeBis = max(c.zahl(.stundeBis) ?? 0, stundeVon)
        beginn = c.text(.beginn)
        ende = c.text(.ende)
        raum = c.text(.raum)
        klassen = c.texte(.klassen)
        titel = c.text(.titel)
        text = c.text(.text)
        status = c.text(.status)
        storniert = c.text(.storniert)
        ressourcen = c.liste(.ressourcen)
    }

    var istStorniert: Bool { !storniert.isEmpty && storniert != "false" }
    var stundenText: String { stundeVon == stundeBis ? "\(stundeVon). Std." : "\(stundeVon).–\(stundeBis). Std." }
}

struct BuchungAntwort: Decodable, Sendable {
    var buchungen: [Buchung]
    var hinweise: [String]

    enum CodingKeys: String, CodingKey { case buchungen, hinweise }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        buchungen = c.liste(.buchungen)
        hinweise = c.texte(.hinweise)
    }
}

/// DELETE /api/app/buchen/{id} – Zahl stornierter Termine.
struct StornoAntwort: Decodable, Sendable {
    var storniert: Int

    enum CodingKeys: String, CodingKey { case storniert }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        storniert = c.zahl(.storniert) ?? 1
    }
}
