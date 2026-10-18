import SwiftUI

extension Color {
    /// Farbe aus "#RRGGBB" (leer oder ungültig = nil).
    init?(hex: String) {
        var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasPrefix("#") { s.removeFirst() }
        guard s.count == 6, let wert = UInt32(s, radix: 16) else { return nil }
        self.init(hexWert: wert)
    }

    init(hexWert: UInt32, deckkraft: Double = 1) {
        self.init(.sRGB,
                  red: Double((hexWert >> 16) & 0xFF) / 255,
                  green: Double((hexWert >> 8) & 0xFF) / 255,
                  blue: Double(hexWert & 0xFF) / 255,
                  opacity: deckkraft)
    }

    /// Farbe, die sich nach hellem oder dunklem Erscheinungsbild richtet.
    init(hell: UInt32, dunkel: UInt32, deckkraftHell: Double = 1, deckkraftDunkel: Double = 1) {
        self.init(uiColor: UIColor { merkmale in
            let dunkelModus = merkmale.userInterfaceStyle == .dark
            let wert = dunkelModus ? dunkel : hell
            return UIColor(red: CGFloat((wert >> 16) & 0xFF) / 255,
                           green: CGFloat((wert >> 8) & 0xFF) / 255,
                           blue: CGFloat(wert & 0xFF) / 255,
                           alpha: CGFloat(dunkelModus ? deckkraftDunkel : deckkraftHell))
        })
    }
}

/// Farben von UntPlan Next, jeweils als dynamische Farbe für hell und dunkel. Marke **Petrol** (#0b5d57, heller
/// #138a80, im Dunkelmodus #3fb3a6), Neutraltöne Schiefer, Seiten- und Kartenflächen aus dem System (passen zu Listen,
/// Blättern und Liquid Glass), fachliche Statusfarben mit heller Fläche. Die Statusfarben sind bewusst weit vom Petrol
/// entfernt: Änderung/Vertretung Violett, Termin Magenta, Prüfung Bernstein, Entfall Rot, Ferien Blau. Im Dunkelmodus
/// haben sie eine aufgehellte Variante, damit Text und Linien auf dunklen Flächen lesbar bleiben.
enum Farben {
    // MARK: Marke

    /// Primärfarbe Petrol (Knöpfe, aktive Navigation, Links, Auswahl, Jetzt-Linie)
    static let akzent = Color(hell: 0x0B5D57, dunkel: 0x3FB3A6)
    /// Helleres Petrol (Fortschritt, Ring, zweite Ebene)
    static let akzentHell = Color(hell: 0x138A80, dunkel: 0x5CC9BC)
    /// Helle Fläche der Primärfarbe (Auswahl, Avatare, Hinweise)
    static let primaerFlaeche = Color(hell: 0xE5F2F0, dunkel: 0x0F2A27)
    /// Schrift auf Flächen in der Primärfarbe (Primärknopf)
    static let aufAkzent = Color(hell: 0xFFFFFF, dunkel: 0x061A18)
    /// Rand der Primärfarbe (Auswahlrahmen)
    static let primaerRand = Color(hell: 0xA6D3CD, dunkel: 0x1E544E)
    /// Schrift auf gefüllten Status-Plaketten (Entfall, Vertretung …)
    static let aufStatus = Color(hell: 0xFFFFFF, dunkel: 0x0F1318)

    // MARK: Text

    /// Haupttext
    static let text = Color(hell: 0x232A33, dunkel: 0xE6E9EE)
    /// Zweittext (Lehrkraft, Klasse, Untertitel)
    static let text2 = Color(hell: 0x4D5866, dunkel: 0xB3BBC6)
    /// Hinweistext, Symbole in Listen, Zeitspalte
    static let text3 = Color(hell: 0x6B7684, dunkel: 0x8C96A3)
    /// Pfeile und Platzhalter (schwächer als Hinweistext)
    static let pfeil = Color(hell: 0x98A2AF, dunkel: 0x5B6573)

    // MARK: Flächen

    /// Seitenhintergrund (wie gruppierte Listen des Systems)
    static let grund = Color(uiColor: .systemGroupedBackground)
    /// Karten, Kacheln, Raster (deckend – Inhalte liegen nie auf Glas)
    static let flaeche = Color(uiColor: .secondarySystemGroupedBackground)
    /// Leicht abgesetzte Fläche (Spaltenköpfe, Zeitspalte)
    static let flaeche2 = Color(hell: 0xFAFBFC, dunkel: 0x1B2129)
    /// Hintergrund der Blätter (Stundendetails, Formulare)
    static let blatt = Color(uiColor: .systemBackground)
    /// Neutrale Fläche für Zahl-Plaketten, Eingabefelder und stille Knöpfe
    static let neutralFlaeche = Color(hell: 0xEBEEF2, dunkel: 0x222A34)
    /// Eigene Abwesenheit hinter den Stunden
    static let abwesendFlaeche = Color(hell: 0xDCE1E7, dunkel: 0x2A323D)

    // MARK: Linien

    /// Alle 1-pt-Ränder und Trennlinien
    static let rand = Color(hell: 0xDCE1E7, dunkel: 0x2A323D)
    /// Kräftiger Rand (Eingaben, Kacheln ohne Fachfarbe)
    static let randStark = Color(hell: 0xC3CAD3, dunkel: 0x3A4452)
    /// Zeilentrenner im Stundenraster
    static let linie = Color(hell: 0xEBEEF2, dunkel: 0x222A34)
    /// Pausenband im Stundenraster
    static let pause = Color(hell: 0xF4F6F8, dunkel: 0x12171D)

    // MARK: Fachliche Statusfarben

    /// Entfall, Fehler
    static let entfall = Color(hell: 0xB42318, dunkel: 0xEE7B70)
    static let entfallFlaeche = Color(hell: 0xFDF0EF, dunkel: 0x2C1715)
    /// Vertretung, Raum- und Lehrerwechsel, Verlegung (Violett – deutlich anders als das Petrol der Marke)
    static let aenderung = Color(hell: 0x6D4FC2, dunkel: 0xB3A1F5)
    static let aenderungFlaeche = Color(hell: 0xF1EDFB, dunkel: 0x241D3D)
    /// Klausur, Prüfung
    static let pruefung = Color(hell: 0xA15C07, dunkel: 0xE3A54B)
    static let pruefungFlaeche = Color(hell: 0xFDF4E3, dunkel: 0x2A2010)
    /// Veranstaltung, Termin, Raumbuchung (Magenta – unterscheidbar von Änderung und Entfall)
    static let termin = Color(hell: 0xA3347C, dunkel: 0xEE8CC9)
    static let terminFlaeche = Color(hell: 0xFBEEF6, dunkel: 0x341A2C)
    /// Ferien, unterrichtsfrei
    static let frei = Color(hell: 0x2F6F9F, dunkel: 0x79B0DC)
    static let freiFlaeche = Color(hell: 0xEDF4FA, dunkel: 0x132231)
    /// Warnung, offen, Konflikt (Bernstein wie Prüfung)
    static let warnung = Color(hell: 0xA15C07, dunkel: 0xE3A54B)
    static let warnungFlaeche = Color(hell: 0xFDF4E3, dunkel: 0x2A2010)
    /// Erledigt, bestätigt
    static let ok = Color(hell: 0x1D7A46, dunkel: 0x5CC48A)
    static let okFlaeche = Color(hell: 0xE9F6EE, dunkel: 0x11261A)

    // MARK: Fachfarben

    /// Tönung einer Stundenkachel: Fachfarbe mit 14 % Deckkraft über der Fläche (im Dunkelmodus 22 %, damit die Tönung
    /// auf dem dunklen Raster sichtbar bleibt).
    static func fachTon(_ hex: String) -> Color? {
        var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasPrefix("#") { s.removeFirst() }
        guard s.count == 6, let wert = UInt32(s, radix: 16) else { return nil }
        return Color(hell: wert, dunkel: wert, deckkraftHell: 0.14, deckkraftDunkel: 0.22)
    }
}

/// Fachlicher Status einer Stunde für Listen und Plaketten (Startseite, Änderungen, Benachrichtigungen):
/// Plakettentext, Farbe und ob der Inhalt durchgestrichen wird.
struct Kartenstil {
    var durchgestrichen: Bool
    var plakette: String?
    var plaketteFarbe: Color
    var plaketteFlaeche: Color

    init(_ karte: Karte) {
        // Klausuren und Raumbuchungen nie als Vertretung darstellen
        if karte.istPruefung && karte.status != "entfall" && karte.status != "abwesend" {
            self.init(durchgestrichen: false, plakette: "Prüfung", farbe: Farben.pruefung, flaeche: Farben.pruefungFlaeche)
            return
        }
        if karte.istRaumbuchung && ["buchung", "geaendert", "offen", "regulaer"].contains(karte.status) {
            self.init(durchgestrichen: false, plakette: "Raumbuchung", farbe: Farben.termin, flaeche: Farben.terminFlaeche)
            return
        }
        if Kachelbau.istBereitschaftAbwesend(karte) {
            self.init(durchgestrichen: false, plakette: "Lehrkraft abwesend", farbe: Farben.text2, flaeche: Farben.neutralFlaeche)
            return
        }
        switch karte.status {
        case "veranstaltung":
            self.init(durchgestrichen: false, plakette: "Veranstaltung", farbe: Farben.termin, flaeche: Farben.terminFlaeche)
        case "entfall":
            self.init(durchgestrichen: true, plakette: "Entfall", farbe: Farben.entfall, flaeche: Farben.entfallFlaeche)
        case "geaendert" where Kartenstil.nurRaumGeaendert(karte):
            self.init(durchgestrichen: false, plakette: "Raumänderung", farbe: Farben.aenderung, flaeche: Farben.aenderungFlaeche)
        case "geaendert":
            self.init(durchgestrichen: false, plakette: "Änderung", farbe: Farben.aenderung, flaeche: Farben.aenderungFlaeche)
        case "offen":
            self.init(durchgestrichen: false, plakette: "Offen", farbe: Farben.aenderung, flaeche: Farben.aenderungFlaeche)
        case "klausur":
            self.init(durchgestrichen: false, plakette: "Prüfung", farbe: Farben.pruefung, flaeche: Farben.pruefungFlaeche)
        case "abwesend":
            self.init(durchgestrichen: false, plakette: "Abgegeben", farbe: Farben.text2, flaeche: Farben.neutralFlaeche)
        case "vorgemerkt":
            self.init(durchgestrichen: false, plakette: "Vorgemerkt", farbe: Farben.akzent, flaeche: Farben.primaerFlaeche)
        case "buchung":
            self.init(durchgestrichen: false, plakette: "Raumbuchung", farbe: Farben.termin, flaeche: Farben.terminFlaeche)
        case "bereitschaft":
            self.init(durchgestrichen: false, plakette: "Bereitschaft", farbe: Farben.text2, flaeche: Farben.neutralFlaeche)
        default:
            self.init(durchgestrichen: false, plakette: nil, farbe: Farben.aenderung, flaeche: Farben.aenderungFlaeche)
        }
    }

    /// Nur der Raum wurde geändert (Lehrkraft, Klasse und Fach wie geplant).
    static func nurRaumGeaendert(_ karte: Karte) -> Bool {
        guard karte.raeume.contains(where: { $0.geaendert }) else { return false }
        if karte.lehrer.contains(where: { $0.geaendert }) || karte.klassen.contains(where: { $0.geaendert }) { return false }
        if let alt = karte.fachAlt, !alt.isEmpty, alt != karte.fach { return false }
        return true
    }

    private init(durchgestrichen: Bool, plakette: String?, farbe: Color, flaeche: Color) {
        self.durchgestrichen = durchgestrichen
        self.plakette = plakette
        self.plaketteFarbe = farbe
        self.plaketteFlaeche = flaeche
    }
}
