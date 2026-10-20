import Foundation

// Daten und Endpunkte für die Klassenbuch-Schnellerfassung („Stunde jetzt“) und den Kursverlauf – dieselben Endpunkte wie
// EduOrga Web (keine neuen Server-Schnittstellen):
//   GET /api/app/klassenbuch/lehrstoff/vorstunden   Lehrstoff der letzten Stunden desselben Unterrichts (Vorschläge)
//   GET /api/app/klassenbuch/uebersicht             Stunden eines Zeitraums mit Lehrstoff, Kontrolle, Fehlzeiten, Hausaufgaben
// Der persönliche Themenplan eines Kurses (Stoffverteilung) liegt nur auf dem Gerät – der Server kennt keinen Lehrplan.

// MARK: - Modelle

/// Lehrstoff einer früheren Stunde desselben Unterrichts (Vorschlag für das Thema).
struct Vorstundenthema: Decodable, Identifiable, Hashable, Sendable {
    var datum: String
    var stunde: Int
    var thema: String
    var lehrer: String
    var lehrform: String

    var id: String { "\(datum)|\(stunde)" }

    enum CodingKeys: String, CodingKey { case datum, stunde, thema, lehrer, lehrform }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        datum = String(c.text(.datum).prefix(10))
        stunde = c.zahl(.stunde) ?? 0
        thema = c.text(.thema).trimmingCharacters(in: .whitespacesAndNewlines)
        lehrer = c.text(.lehrer)
        lehrform = c.text(.lehrform)
    }
}

/// Eine Stunde der Klassenbuch-Übersicht.
struct Kursstunde: Decodable, Identifiable, Sendable {
    var datum: String = ""
    var von: Int
    var bis: Int
    var fach: String
    var status: String
    var unterricht: Int?
    var lehrstoff: String
    var geprueft: Bool
    var abwesend: Int
    var verspaetet: Int
    var hausaufgaben: String
    var klassen: [String]
    var eintraege: Int

    var id: String { "\(datum)|\(von)|\(unterricht ?? 0)|\(fach)" }

    enum CodingKeys: String, CodingKey {
        case von, bis, fach, status, unterricht, lehrstoff, geprueft, abwesend, verspaetet, hausaufgaben, klassen, eintraege
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        von = c.zahl(.von) ?? 0
        bis = max(c.zahl(.bis) ?? 0, von)
        fach = c.text(.fach)
        status = c.text(.status)
        unterricht = c.zahl(.unterricht)
        lehrstoff = c.text(.lehrstoff).trimmingCharacters(in: .whitespacesAndNewlines)
        geprueft = c.wahr(.geprueft)
        abwesend = c.zahl(.abwesend) ?? 0
        verspaetet = c.zahl(.verspaetet) ?? 0
        hausaufgaben = c.text(.hausaufgaben)
        klassen = c.texte(.klassen)
        eintraege = c.zahl(.eintraege) ?? 0
    }

    var istEntfall: Bool { status == "entfall" }
    var stundenText: String { von == bis ? "\(von). Std." : "\(von).–\(bis). Std." }
}

/// Ein Tag der Klassenbuch-Übersicht.
struct Kurstag: Decodable, Identifiable, Sendable {
    var datum: String
    var kw: Int
    var stunden: [Kursstunde]

    var id: String { datum }

    enum CodingKeys: String, CodingKey { case datum, kw, stunden }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        datum = String(c.text(.datum).prefix(10))
        kw = c.zahl(.kw) ?? 0
        let liste: [Kursstunde] = c.liste(.stunden)
        let tag = datum
        stunden = liste.map { s in
            var x = s
            x.datum = tag
            return x
        }
    }
}

/// GET /api/app/klassenbuch/uebersicht
struct Kursuebersicht: Decodable, Sendable {
    var von: String
    var bis: String
    var tage: [Kurstag]

    enum CodingKeys: String, CodingKey { case von, bis, tage }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        von = c.text(.von)
        bis = c.text(.bis)
        tage = c.liste(.tage)
    }
}

// MARK: - Endpunkte

extension ApiClient {
    /// Lehrstoff der letzten (höchstens 8) Stunden desselben Unterrichts vor dieser Stunde.
    func lehrstoffVorstunden(datum: String, stunde: Int, unterricht: Int, lehrer: String?) async throws -> [Vorstundenthema] {
        var parameter = ["datum": datum, "stunde": String(stunde), "unterricht": String(unterricht)]
        if let lehrer, !lehrer.isEmpty { parameter["lehrer"] = lehrer }
        let liste: [Vielleicht<Vorstundenthema>] = try await anfrage("GET", "/klassenbuch/lehrstoff/vorstunden", parameter: parameter)
        return liste.compactMap(\.wert).filter { !$0.thema.isEmpty }
    }

    /// Klassenbuch-Übersicht eines Zeitraums (höchstens 31 Tage) für eine Klasse und einen Unterricht.
    func klassenbuchUebersicht(von: String, bis: String, klasse: String?, unterricht: Int?) async throws -> Kursuebersicht {
        var parameter = ["von": von, "bis": bis]
        if let klasse, !klasse.isEmpty { parameter["klasse"] = klasse }
        if let unterricht { parameter["unterricht"] = String(unterricht) }
        return try await anfrage("GET", "/klassenbuch/uebersicht", parameter: parameter)
    }
}

// MARK: - Themenplan (nur auf dem Gerät)

/// Persönlicher Themenplan eines Kurses (eine Zeile je Thema, in der geplanten Reihenfolge) – je Konto und Unterricht in
/// den UserDefaults. Erledigt ist ein Thema, sobald es (sinngemäß) als Lehrstoff einer Stunde eingetragen ist.
enum Themenplan {
    private static func schluessel(_ unterricht: Int) -> String {
        "themenplan|\(Kontenspeicher.aktivId ?? "")|\(unterricht)"
    }

    static func laden(_ unterricht: Int) -> [String] {
        UserDefaults.standard.stringArray(forKey: schluessel(unterricht)) ?? []
    }

    static func speichern(_ themen: [String], unterricht: Int) {
        let liste = themen.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        UserDefaults.standard.set(liste, forKey: schluessel(unterricht))
    }

    /// Gilt ein Thema als behandelt (Lehrstoff enthält das Thema bzw. umgekehrt, Groß-/Kleinschreibung egal)?
    static func behandelt(_ thema: String, in lehrstoffe: [String]) -> Bool {
        let t = thema.lowercased()
        guard !t.isEmpty else { return false }
        return lehrstoffe.contains { l in
            let x = l.lowercased()
            return !x.isEmpty && (x.contains(t) || t.contains(x))
        }
    }

    /// Nächste noch nicht behandelte Themen des Plans.
    static func naechste(_ plan: [String], behandelt lehrstoffe: [String], anzahl: Int = 2) -> [String] {
        Array(plan.filter { !behandelt($0, in: lehrstoffe) }.prefix(anzahl))
    }
}

// MARK: - Fälligkeit

/// Schnellwahl der Fälligkeit einer Hausaufgabe.
enum Faelligkeit: Hashable {
    case naechsteStunde
    case eineWoche
    case datum
    case keine
}
