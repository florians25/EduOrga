import SwiftUI

// MARK: - Zwischenspeicher

/// Geladene Wochenpläne je Plan und Woche. `AppZustand` leert ihn beim Kontowechsel bzw. Abmelden. Der Speicher ist nur
/// ein Platzhalter für den sofortigen Aufbau: jede Woche trägt ihren Ladezeitpunkt und die „Epoche“, in der sie geladen
/// wurde. `veralten()` (Ziehen zum Aktualisieren, App im Vordergrund, Push, angetippte Mitteilung) zählt die Epoche hoch –
/// danach gilt jede gespeicherte Woche als veraltet, wird beim nächsten Anzeigen sofort neu geladen und trägt bis dahin
/// den Hinweis „Stand hh:mm“.
@MainActor
enum Kachelspeicher {
    static var wochen: [String: Wochenplan] = [:]
    /// Zeitpunkt der letzten erfolgreichen Antwort je Woche
    static var geladen: [String: Date] = [:]
    /// Epoche, in der die Woche geladen wurde
    static var epocheJe: [String: Int] = [:]
    /// Zählt bei jeder Invalidierung hoch
    static var epoche = 0
    /// So lange gilt eine in der aktuellen Epoche geladene Woche ohne erneute Anfrage als frisch (Sekunden)
    static let frischDauer: TimeInterval = 30

    static func leeren() {
        wochen.removeAll()
        geladen.removeAll()
        epocheJe.removeAll()
        epoche += 1
    }

    /// Alle gespeicherten Wochen als veraltet markieren (die Daten bleiben als Platzhalter stehen).
    static func veralten() {
        epoche += 1
    }

    static func ablegen(_ plan: Wochenplan, unter schluessel: String) {
        wochen[schluessel] = plan
        geladen[schluessel] = Date()
        epocheJe[schluessel] = epoche
    }

    /// In der aktuellen Epoche und vor weniger als `frischDauer` Sekunden geladen?
    static func frisch(_ schluessel: String, jetzt: Date = Date()) -> Bool {
        guard wochen[schluessel] != nil, epocheJe[schluessel] == epoche, let t = geladen[schluessel] else { return false }
        return jetzt.timeIntervalSince(t) < frischDauer
    }

    /// Bestätigt aktuell (in dieser Epoche geladen) – sonst zeigt der Plan „Stand hh:mm“.
    static func bestaetigt(_ schluessel: String) -> Bool {
        wochen[schluessel] != nil && epocheJe[schluessel] == epoche
    }
}

// MARK: - Planmodell

/// Lädt Wochenpläne (eigener Plan oder gewählte Klasse, Lehrkraft bzw. Raum) und bereitet Tage für die Zeitachse,
/// die Wochenleiste und das Wochenraster auf.
@MainActor
final class Planmodell: ObservableObject {
    /// Zählt bei jeder Änderung hoch (geladene Woche, anderer Plan) – Ansichten zeichnen neu.
    @Published private(set) var stand = 0
    /// Wochen, die gerade geladen werden (Schlüssel)
    @Published private(set) var laufend: Set<String> = []
    @Published var fehler: String? = nil
    /// Gewählter Plan (nil = eigener Plan)
    @Published private(set) var auswahl: PlanAuswahl? = nil
    /// Filter der Anzeige (Einblenden, Reduzieren) – gilt für Woche, Tag und Agenda
    @Published var filter = Planfilter() {
        didSet {
            guard filter != oldValue else { return }
            tagesSpeicher.removeAll()
            stand += 1
        }
    }

    /// Eigener Plan aus der Sitzung
    var eigenerTyp = "klasse"
    var eigenesElement = ""
    weak var zustand: AppZustand?

    private var tagesSpeicher: [String: Tagesansicht] = [:]
    private let api = ApiClient.shared

    nonisolated init() {}

    var typ: String { auswahl?.typ ?? (eigenerTyp.isEmpty ? "klasse" : eigenerTyp) }
    var element: String { auswahl?.element ?? eigenesElement }
    var istEigenerPlan: Bool { auswahl == nil }

    /// Name für den Kopf: „Mein Plan“ bzw. Kürzel des gewählten Plans.
    var planname: String { auswahl?.anzeige ?? "Mein Plan" }

    /// Untertitel: Art des Plans bzw. eigenes Kürzel.
    var planart: String {
        guard let a = auswahl else { return eigenesElement }
        switch a.typ {
        case "lehrer": return "Lehrkraft"
        case "raum": return "Raum"
        default: return "Klasse"
        }
    }

    /// Eigenen Plan aus der Sitzung übernehmen.
    func einrichten(zustand: AppZustand) {
        self.zustand = zustand
        let typNeu = (zustand.benutzer?.typ ?? "").isEmpty ? "klasse" : (zustand.benutzer?.typ ?? "klasse")
        let elementNeu = zustand.benutzer?.element ?? ""
        if typNeu != eigenerTyp || elementNeu != eigenesElement {
            eigenerTyp = typNeu
            eigenesElement = elementNeu
            tagesSpeicher.removeAll()
            stand += 1
        }
    }

    /// Anderen Plan zeigen (nil = eigener Plan).
    func waehlen(_ plan: PlanAuswahl?) {
        guard plan != auswahl else { return }
        auswahl = plan
        tagesSpeicher.removeAll()
        fehler = nil
        stand += 1
    }

    private func schluessel(_ montag: String) -> String { "\(typ)|\(element)|\(montag)" }

    /// Montag (ISO) der Woche eines Datums.
    static func montag(_ datum: String) -> String {
        Datumsformat.iso(Datumsformat.montag(Datumsformat.datum(datum) ?? Date()))
    }

    func plan(montag: String) -> Wochenplan? {
        Kachelspeicher.wochen[schluessel(montag)]
    }

    func laedt(montag: String) -> Bool {
        laufend.contains(schluessel(montag))
    }

    /// Woche laden. Der Zwischenspeicher ist nur Platzhalter: er wird sofort gezeigt, die Woche aber neu geladen, sobald
    /// sie veraltet ist (andere Epoche bzw. älter als `Kachelspeicher.frischDauer`) – mit `erzwingen` immer.
    func laden(montag: String, erzwingen: Bool = false) async {
        let s = schluessel(montag)
        if !erzwingen && Kachelspeicher.frisch(s) { return }
        guard !laufend.contains(s), let datum = Datumsformat.datum(montag) else { return }
        laufend.insert(s)
        defer { laufend.remove(s) }
        do {
            let p = try await api.plan(typ: typ, element: element, datum: datum)
            // Plan inzwischen gewechselt: Antwort verwerfen
            guard s == schluessel(montag) else { return }
            Kachelspeicher.ablegen(p, unter: s)
            tagesSpeicher.removeAll()
            fehler = nil
            stand += 1
        } catch {
            if let z = zustand {
                if let text = z.fehlertext(error) { fehler = text }
            } else if !(error is CancellationError) {
                fehler = error.localizedDescription
            }
        }
    }

    /// Alle geladenen Wochen dieses Plans neu laden (Ziehen zum Aktualisieren, Planänderung).
    func neuLaden(montage: [String]) async {
        for m in montage { await laden(montag: m, erzwingen: true) }
    }

    /// Ziehen zum Aktualisieren: alle zwischengespeicherten Wochen veralten (auch die anderer Pläne) und diese Woche
    /// sofort neu laden.
    func aktualisieren(montag: String) async {
        Kachelspeicher.veralten()
        await laden(montag: montag, erzwingen: true)
    }

    /// Zeitpunkt der gezeigten Daten, solange sie nicht als aktuell bestätigt sind (Platzhalter aus dem Speicher, Laden
    /// läuft bzw. gescheitert) – nil, wenn die Woche frisch ist bzw. noch gar nicht vorliegt.
    /// Wann die App die Woche zuletzt vom Server geladen hat (nil = noch nie).
    func abgerufen(montag: String) -> Date? {
        Kachelspeicher.geladen[schluessel(montag)]
    }

    func standHinweis(montag: String) -> Date? {
        let s = schluessel(montag)
        guard Kachelspeicher.wochen[s] != nil else { return nil }
        if Kachelspeicher.bestaetigt(s) && !laufend.contains(s) { return nil }
        return Kachelspeicher.geladen[s]
    }

    /// Aufbereiteter Tag (nil = Woche noch nicht geladen).
    func tag(_ datum: String) -> Tagesansicht? {
        let s = schluessel(datum)
        if let t = tagesSpeicher[s] { return t }
        guard let p = plan(montag: Planmodell.montag(datum)) else { return nil }
        let t = Tagesansicht.bauen(datum: datum, plan: p, typ: typ, element: element, eigenerPlan: istEigenerPlan)
            .gefiltert(filter)
        tagesSpeicher[s] = t
        return t
    }

    /// Schultage einer Woche (aus dem Plan; sonst Montag bis Freitag).
    func tage(montag: String) -> [String] {
        if let p = plan(montag: montag), !p.tage.isEmpty {
            return p.tage.map(\.datum).sorted()
        }
        guard let m = Datumsformat.datum(montag) else { return [] }
        return (0..<5).map { Datumsformat.iso(Datumsformat.tage($0, nach: m)) }
    }
}

// MARK: - Filter

/// Filter der Plananzeige (Blatt „Auswahl und Filter“, gespeichert auf dem Gerät): Aufsichten, Mitteilungen sowie
/// Ferien und Feiertage einblenden; auf Änderungen bzw. den Ist-Zustand reduzieren.
struct Planfilter: Equatable {
    var aufsichten = true
    var mitteilungen = true
    var ferien = true
    /// Nur Änderungen: regulärer Unterricht (und reguläre Aufsichten, Bereitschaften) ausgeblendet
    var nurAenderungen = false
    /// Nur Ist-Zustand: was nicht stattfindet (Entfall, abgegebene Stunden), ist ausgeblendet
    var nurIstZustand = false

    static let schluesselAufsichten = "planFilterAufsichten"
    static let schluesselMitteilungen = "planFilterMitteilungen"
    static let schluesselFerien = "planFilterFerien"
    static let schluesselAenderungen = "planFilterNurAenderungen"
    static let schluesselIst = "planFilterIstZustand"

    var aktiv: Bool { !aufsichten || !mitteilungen || !ferien || nurAenderungen || nurIstZustand }

    /// Bleibt die Kachel bei diesem Filter sichtbar?
    func zeigt(_ k: Kachel) -> Bool {
        if k.art == .aufsicht || (k.inPause && k.aufsicht != nil) {
            guard aufsichten else { return false }
            if nurIstZustand && k.aufsichtsstand == .entfall { return false }
            if nurAenderungen && k.aufsichtsstand == .regulaer { return false }
            return true
        }
        if nurIstZustand {
            switch k.art {
            case .entfall, .abgegeben, .bereitschaftAbwesend: return false
            default: break
            }
        }
        if nurAenderungen {
            switch k.art {
            case .normal: return k.raumAenderung || k.zusatz
            case .bereitschaft: return false
            default: return true
            }
        }
        return true
    }
}

extension Tagesansicht {
    /// Tag mit angewandtem Filter (ohne Filter unverändert).
    func gefiltert(_ f: Planfilter) -> Tagesansicht {
        guard f.aktiv else { return self }
        var kopfNeu = kopf
        if !f.mitteilungen { kopfNeu?.hinweise = [] }
        if !f.ferien, kopfNeu?.frei == true { kopfNeu?.frei = false }
        return Tagesansicht(datum: datum, kopf: kopfNeu, raster: raster, kacheln: kacheln.filter { f.zeigt($0) },
                            ganztags: ganztags, balken: balken, gesperrt: gesperrt, sperrhinweis: sperrhinweis,
                            luecken: luecken, start: start, schluss: schluss)
    }
}

// MARK: - Ein Tag

/// Lücke im Tag: Pause zwischen zwei Rasterstunden bzw. Freistunde(n) zwischen Stunden.
struct Tagesluecke: Identifiable, Hashable {
    enum Art: Hashable {
        case pause
        case frei
    }

    let art: Art
    let beginn: Int
    let ende: Int
    /// Rasterstunden der Freistunde (bei Pausen: die Stunde davor)
    let vonNr: Int
    let bisNr: Int

    var id: String { "\(art == .pause ? "p" : "f")\(beginn)-\(ende)" }
    var dauer: Int { max(0, ende - beginn) }
}

/// Abschnitt der Belegungsleiste (Anteile 0…1 des Schultags).
struct Belegungsstueck: Identifiable {
    let id: UUID
    let von: CGFloat
    let bis: CGFloat
    let farbe: Color
    let entfall: Bool
}

/// Tag für Zeitachse, Leiste und Matrix: Kacheln (Kachelbau), Zeitraster, Lücken und Kennzahlen.
struct Tagesansicht {
    let datum: String
    let kopf: Tageskopf?
    let raster: [Rasterzeit]
    /// Kacheln auf der Zeitachse (ohne ganztägige Termine)
    let kacheln: [Kachel]
    /// Ganztägige Termine (über der Zeitachse)
    let ganztags: [Kachel]
    /// Eigene Abwesenheit als Fläche
    let balken: [Abwesenheitsbalken]
    let gesperrt: Bool
    let sperrhinweis: String?
    let luecken: [Tagesluecke]
    /// Sichtbarer Zeitraum der Zeitachse (Minuten)
    let start: Int
    let schluss: Int

    var frei: Bool { kopf?.frei ?? false }
    var istHeute: Bool { Datumsformat.istHeute(datum) }

    /// Stunden (ohne Aufsichten)
    var stunden: [Kachel] { kacheln.filter { !$0.inPause && $0.karte != nil } }
    var anzahlStunden: Int { stunden.filter(Statuslehre.findetStatt).count }
    var anzahlEntfall: Int { stunden.filter { $0.art == .entfall }.count }
    var anzahlAenderung: Int { stunden.filter { $0.art == .aenderung || $0.raumAenderung }.count }
    var anzahlPruefung: Int { stunden.filter { $0.art == .klausur }.count }

    /// Belegung über den ganzen Schultag (Zeitraster) für die Wochenleiste.
    var belegung: [Belegungsstueck] {
        guard let erste = raster.first?.beginn, let letzte = raster.last?.ende, letzte > erste else { return [] }
        let spanne = CGFloat(letzte - erste)
        return stunden.sorted { $0.beginn < $1.beginn }.map { k in
            Belegungsstueck(id: k.id,
                            von: max(0, CGFloat(k.beginn - erste) / spanne),
                            bis: min(1, CGFloat(k.ende - erste) / spanne),
                            farbe: Statuslehre.leistenfarbe(k),
                            entfall: k.art == .entfall)
        }
    }

    /// Ferien bzw. unterrichtsfreier Tag: Titel und Zeitraum.
    var freiText: (titel: String, zeitraum: String)? {
        guard let k = kopf, k.frei else { return nil }
        let grund = (k.freiGrund ?? "").trimmingCharacters(in: .whitespaces)
        let art = (k.freiArt ?? "").lowercased()
        let titel = grund.isEmpty ? (art == "ferien" ? "Ferien" : "Unterrichtsfrei") : grund
        var zeitraum = ""
        if let von = k.freiVon, !von.isEmpty {
            zeitraum = Ferienzeit(titel: titel, von: String(von.prefix(10)), bis: String((k.freiBis ?? "").prefix(10))).zeitraum
        }
        return (titel, zeitraum)
    }

    static func bauen(datum: String, plan p: Wochenplan, typ: String, element: String, eigenerPlan: Bool) -> Tagesansicht {
        let raster = Rasterzeit.aus(p)
        let kopf = p.tage.first { $0.datum == datum }
        var alle: [Kachel] = []
        if let kopf, !p.gesperrt {
            alle = Kachelbau.tag(kopf, plan: p, raster: raster, typ: typ, element: element, jetzt: Date())
        }
        let ganztags = alle.filter { $0.art == .ganztagTermin }
        let kacheln = alle.filter { $0.art != .ganztagTermin }
        var balken: [Abwesenheitsbalken] = []
        if eigenerPlan, let kopf {
            balken = Kachelbau.abwesenheitsbalken(kopf, raster: raster, eigene: p.abwesenheiten)
        }

        // Sichtbarer Zeitraum: vom Beginn des Tages bis zur letzten Stunde, mindestens bis zur 6. Rasterstunde
        let stunden = kacheln.filter { !$0.inPause && $0.karte != nil }
        let rasterStart = raster.first?.beginn ?? 480
        var start = min(rasterStart, kacheln.map(\.beginn).min() ?? rasterStart)
        var schluss = kacheln.map(\.ende).max() ?? rasterStart
        if raster.count >= 6 { schluss = max(schluss, raster[5].ende) } else if let l = raster.last { schluss = max(schluss, l.ende) }
        schluss = max(schluss, start + 180)
        start = (start / 15) * 15
        schluss = ((schluss + 14) / 15) * 15

        // Lücken: Pausen zwischen Rasterstunden, Freistunden zwischen der ersten und letzten stattfindenden Stunde
        var luecken: [Tagesluecke] = []
        for i in raster.indices.dropLast() {
            let a = raster[i], b = raster[i + 1]
            if b.beginn - a.ende >= 5 && a.ende >= start && b.beginn <= schluss {
                luecken.append(Tagesluecke(art: .pause, beginn: a.ende, ende: b.beginn, vonNr: a.nr, bisNr: a.nr))
            }
        }
        let belegt = stunden.filter { $0.art != .ganztagTermin }
        if let erste = belegt.map(\.beginn).min(), let letzte = belegt.map(\.ende).max() {
            var lauf: [Rasterzeit] = []
            func abschliessen() {
                if let a = lauf.first, let b = lauf.last {
                    luecken.append(Tagesluecke(art: .frei, beginn: a.beginn, ende: b.ende, vonNr: a.nr, bisNr: b.nr))
                }
                lauf = []
            }
            for r in raster where r.beginn >= erste && r.ende <= letzte {
                let besetzt = belegt.contains { $0.beginn < r.ende && r.beginn < $0.ende }
                if besetzt { abschliessen() } else { lauf.append(r) }
            }
            abschliessen()
        }

        return Tagesansicht(datum: datum, kopf: kopf, raster: raster, kacheln: kacheln, ganztags: ganztags, balken: balken,
                            gesperrt: p.gesperrt, sperrhinweis: p.sperrhinweis, luecken: luecken, start: start, schluss: schluss)
    }

    /// Vergangen (heute vor der aktuellen Uhrzeit bzw. ein früherer Tag)?
    static func vergangen(_ k: Kachel, jetzt: Date) -> Bool {
        let heute = Datumsformat.iso(jetzt)
        if k.datum < heute { return true }
        if k.datum > heute { return false }
        return k.ende <= Uhr.minuten(jetzt)
    }
}

// MARK: - Jetzt

/// Lage des Tages zur aktuellen Uhrzeit: laufende Stunde, Pause, vor bzw. nach dem Unterricht.
struct Jetztlage {
    enum Phase {
        case vorher
        case laeuft
        case pause
        case danach
    }

    let phase: Phase
    let aktuell: Kachel?
    let naechste: Kachel?
    /// Beginn und Ende des laufenden Abschnitts (Stunde, Pause bzw. Wartezeit), Minuten
    let von: Int
    let bis: Int

    /// Anteil des laufenden Abschnitts (0…1).
    func fortschritt(_ minutenGenau: Double) -> Double {
        guard bis > von else { return 1 }
        return min(1, max(0, (minutenGenau - Double(von)) / Double(bis - von)))
    }

    static func berechnen(_ kacheln: [Kachel], minuten m: Int) -> Jetztlage? {
        let liste = kacheln.filter(Statuslehre.findetStatt).sorted { ($0.beginn, $0.rang) < ($1.beginn, $1.rang) }
        guard let erste = liste.first, let letztesEnde = liste.map(\.ende).max() else { return nil }
        let laufende = liste.filter { $0.beginn <= m && m < $0.ende }
        if let a = laufende.min(by: { $0.rang < $1.rang }) {
            let n = liste.first { $0.beginn >= a.ende }
            return Jetztlage(phase: .laeuft, aktuell: a, naechste: n, von: a.beginn, bis: a.ende)
        }
        if m < erste.beginn {
            return Jetztlage(phase: .vorher, aktuell: nil, naechste: erste, von: max(0, erste.beginn - 60), bis: erste.beginn)
        }
        if m >= letztesEnde {
            return Jetztlage(phase: .danach, aktuell: nil, naechste: nil, von: letztesEnde, bis: letztesEnde)
        }
        let n = liste.first { $0.beginn > m }
        let vorher = liste.filter { $0.ende <= m }.map(\.ende).max() ?? m
        return Jetztlage(phase: .pause, aktuell: nil, naechste: n, von: vorher, bis: n?.beginn ?? m)
    }
}

// MARK: - Texte zu Kacheln

extension Kachel {
    /// Titel der Kachel (Fach, Anlass bzw. Ort).
    var anzeigeTitel: String {
        if !titel.isEmpty { return titel }
        return karte?.titel ?? "Stunde"
    }

    /// Ausgeschriebener Fachname (leer, wenn er dem Titel gleicht).
    var fachname: String {
        let n = (karte?.fachName ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return n.caseInsensitiveCompare(anzeigeTitel) == .orderedSame ? "" : n
    }

    /// Zeile nach Schlüssel (fach, klasse, lehrer, raum, anlass).
    func zeile(_ schluessel: String) -> Kachelzeile? {
        zeilen.first { $0.schluessel == schluessel }
    }

    /// Zeilen außer Fach und Raum (Lehrkraft bzw. Klasse, Anlass) – je nach Planart.
    var personenzeilen: [Kachelzeile] {
        zeilen.filter { $0.schluessel != "fach" && $0.schluessel != "raum" }
    }

    /// Uhrzeit „7:45–9:15“.
    var zeitText: String { "\(Uhr.uhrzeit(beginn))–\(Uhr.uhrzeit(ende))" }

    /// „1.–2. Std.“
    var stundenText: String { von == bis ? "\(von). Std." : "\(von).–\(bis). Std." }

    /// Für VoiceOver ein vollständiger Satz je Karte, z. B. „3. Stunde, M, Mathematik, 9:45 bis 10:30, Raum geändert von
    /// 303 nach 105, Lehrkraft Gal statt Gor, Klasse 7a, Vertretung“ – jede Änderung in Worten (nicht nur als Farbe).
    var vorlesetext: String {
        var teile: [String] = []
        if von > 0 && !inPause && karte?.unterricht != nil {
            teile.append(von == bis ? "\(von). Stunde" : "\(von). bis \(bis). Stunde")
        }
        teile.append(anzeigeTitel)
        if !fachname.isEmpty { teile.append(fachname) }
        if let alt = fachVorher { teile.append("Fach geändert, statt \(alt)") }
        teile.append("\(Uhr.uhrzeit(beginn)) bis \(Uhr.uhrzeit(ende))")
        if let k = karte, [.normal, .aenderung, .entfall, .abgegeben, .klausur].contains(art) {
            if zeile("raum") != nil || k.raeume.contains(where: { $0.geaendert }) {
                teile += Kachel.vorlesen(k.raeume, einzahl: "Raum", mehrzahl: "Räume", fehlt: { "Raum \($0) entfällt" })
            }
            teile += Kachel.vorlesen(k.lehrer, einzahl: "Lehrkraft", mehrzahl: "Lehrkräfte",
                                     fehlt: { "Lehrkraft \($0) abwesend, Vertretung folgt" })
            if k.lehrer.isEmpty && k.istOffeneVertretung { teile.append("Vertretung folgt") }
            teile += Kachel.vorlesen(k.klassen + k.mitklassen, einzahl: "Klasse", mehrzahl: "Klassen", fehlt: { "Klasse \($0) fehlt" })
        } else {
            if let r = zeile("raum"), !r.text.isEmpty { teile.append("Raum \(r.text)") }
            for z in personenzeilen where !z.text.isEmpty { teile.append(z.text) }
        }
        if let m = Statuslehre.merkmal(self) { teile.append(m.text) }
        if let c = statusChip {
            teile.append(c.gesprochen)
        }
        if online { teile.append("online") }
        return teile.joined(separator: ", ")
    }

    /// Werte einer Zeile in Worten: unverändert „Raum 105“, ersetzt „Raum geändert von 303 nach 105“, hinzugekommen
    /// „Raum B070 neu“, weggefallen bzw. offen über `fehlt`.
    static func vorlesen(_ werte: [Wert], einzahl: String, mehrzahl: String, fehlt: (String) -> String) -> [String] {
        var gleich: [String] = []
        var saetze: [String] = []
        for w in werte {
            let alt = (w.alt ?? "").trimmingCharacters(in: .whitespaces)
            if w.ersetzt {
                saetze.append(einzahl == "Lehrkraft" ? "Lehrkraft \(w.k) statt \(alt)" : "\(einzahl) geändert von \(alt) nach \(w.k)")
            } else if w.k.isEmpty {
                if !alt.isEmpty { saetze.append(fehlt(alt)) }
            } else if w.geaendert {
                saetze.append("\(einzahl) \(w.k) neu")
            } else if !gleich.contains(w.k) {
                gleich.append(w.k)
            }
        }
        var ergebnis: [String] = []
        if !gleich.isEmpty { ergebnis.append("\(gleich.count > 1 ? mehrzahl : einzahl) \(gleich.joined(separator: ", "))") }
        return ergebnis + saetze
    }

    /// Art eines Ereignisses für VoiceOver („Veranstaltung, “, „Termin, “).
    static func ereignisArt(_ k: Kachel) -> String {
        switch k.art {
        case .veranstaltung: return "Veranstaltung, "
        case .ganztagTermin: return "Ganztägiger Termin, "
        case .termin: return k.karte?.istRaumbuchung == true ? "Raumbuchung, " : "Termin, "
        default: return ""
        }
    }
}

// MARK: - Stand der Daten

/// Kleiner Hinweis „Stand 10:42“, solange Plan- bzw. Vertretungsdaten nur aus dem Zwischenspeicher stammen (Laden läuft
/// bzw. ist gescheitert). Verschwindet, sobald die frische Antwort da ist.
struct Standhinweis: View {
    let stand: Date
    var laedt: Bool = false

    private var text: String {
        let uhr = Datumsformat.anzeige(stand, "HH:mm")
        let tag = Datumsformat.kalender.isDateInToday(stand) ? "" : Datumsformat.anzeige(stand, "d.M. ")
        return "Stand \(tag)\(uhr)"
    }

    var body: some View {
        HStack(spacing: 5) {
            if laedt {
                ProgressView()
                    .controlSize(.mini)
            } else {
                Image(systemName: "clock.arrow.circlepath")
                    .font(.caption2.weight(.semibold))
            }
            Text(laedt ? "\(text) · aktualisiert …" : text)
                .font(.caption.weight(.medium))
                .monospacedDigit()
        }
        .foregroundStyle(Farben.text2)
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(.regularMaterial, in: Capsule())
        .overlay { Capsule().strokeBorder(Farben.rand, lineWidth: 0.5) }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(laedt ? "\(text), wird aktualisiert" : "\(text), nicht aktuell")
    }
}
