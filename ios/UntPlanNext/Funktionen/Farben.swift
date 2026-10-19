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

/// Farben von EduOrga, jeweils als dynamische Farbe für hell und dunkel (Marke siehe design/MARKE.md). Primärfarbe
/// **Petrol** #164C55 (Logo, hervorgehobene Flächen), Akzentfarbe #28747A (Knöpfe, Auswahl, Links, Fokus, Jetzt-Linie –
/// 5,4 : 1 auf Weiß; im Dunkelmodus #5FB0B5, 6,8 : 1 auf dunklem Grund), Seitenhintergrund #F5F7F8, Text #24363B.
/// Fachliche Statusfarben wie in design/tokens.css mit heller Fläche und bewusst weit weg vom Petrol der Marke:
/// Änderung/Vertretung Violett #6d4fc2, Termin Magenta #a3347c, Prüfung Bernstein, Entfall Rot, Ferien Blau. Im
/// Dunkelmodus haben sie eine aufgehellte Variante, damit Text und Linien auf dunklen Flächen lesbar bleiben.
enum Farben {
    // MARK: Marke

    /// Akzentfarbe (Knöpfe, aktive Navigation, Links, Auswahl, Jetzt-Linie) – zugleich `AccentColor`
    static let akzent = Color(hell: 0x28747A, dunkel: 0x5FB0B5)
    /// Helleres Petrol (Fortschritt, Ring, zweite Ebene)
    static let akzentHell = Color(hell: 0x4F9298, dunkel: 0x7FC9C9)
    /// Primärfarbe der Marke (Logo, Kopf der Einrichtung, hervorgehobene Flächen mit weißer Schrift)
    static let primaer = Color(hell: 0x164C55, dunkel: 0x1D5F66)
    /// Helle Fläche der Primärfarbe (Auswahl, Avatare, Hinweise)
    static let primaerFlaeche = Color(hell: 0xEEF5F6, dunkel: 0x0F2A2E)
    /// Schrift auf Flächen in der Akzentfarbe (Primärknopf)
    static let aufAkzent = Color(hell: 0xFFFFFF, dunkel: 0x0C2C31)
    /// Rand der Primärfarbe (Auswahlrahmen)
    static let primaerRand = Color(hell: 0xAED1D4, dunkel: 0x1E5258)
    /// Schrift auf gefüllten Status-Plaketten (Entfall, Vertretung …)
    static let aufStatus = Color(hell: 0xFFFFFF, dunkel: 0x0F1318)

    // MARK: Text

    /// Haupttext
    static let text = Color(hell: 0x24363B, dunkel: 0xE6E9EE)
    /// Zweittext (Lehrkraft, Klasse, Untertitel)
    static let text2 = Color(hell: 0x4D5866, dunkel: 0xB3BBC6)
    /// Hinweistext, Symbole in Listen, Zeitspalte
    static let text3 = Color(hell: 0x6B7684, dunkel: 0x8C96A3)
    /// Pfeile und Platzhalter (schwächer als Hinweistext)
    static let pfeil = Color(hell: 0x98A2AF, dunkel: 0x5B6573)

    // MARK: Flächen

    /// Seitenhintergrund #F5F7F8 der Marke (dunkel: wie gruppierte Listen des Systems)
    static let grund = Color(uiColor: UIColor { merkmale in
        if merkmale.userInterfaceStyle == .dark {
            return UIColor.systemGroupedBackground.resolvedColor(with: merkmale)
        }
        return UIColor(red: 0xF5 / 255.0, green: 0xF7 / 255.0, blue: 0xF8 / 255.0, alpha: 1)
    })
    /// Karten, Kacheln, Raster (deckend – Inhalte liegen nie auf Glas)
    static let flaeche = Color(uiColor: .secondarySystemGroupedBackground)
    /// Leicht abgesetzte Fläche (Spaltenköpfe, Zeitspalte)
    static let flaeche2 = Color(hell: 0xFAFBFC, dunkel: 0x1B2129)
    /// Hintergrund der Blätter (Stundendetails, Formulare)
    static let blatt = Color(uiColor: .systemBackground)
    /// Neutrale Fläche für Zahl-Plaketten, Eingabefelder und stille Knöpfe
    static let neutralFlaeche = Color(hell: 0xEBEEF2, dunkel: 0x222A34)
    /// Neutrale Fläche der Stundenkarten („neutral“ der Kartendarstellung, wie im Web #f7f9fa)
    static let kachelFlaeche = Color(hell: 0xF7F9FA, dunkel: 0x172A2E)
    /// Feine Linie der Stundenkarten (wie im Web #c3ced2)
    static let kachelRand = Color(hell: 0xC3CED2, dunkel: 0x33494E)
    /// Hellgrauer Grund des Wochenrasters (Karten liegen weiß darauf)
    static let rasterGrund = Color(hell: 0xEDF0F2, dunkel: 0x11171C)
    /// Feine Stundenlinien im Wochenraster
    static let rasterLinie = Color(hell: 0xD7DDE1, dunkel: 0x26313A)
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
    static let terminFlaeche = Color(hell: 0xFAEEF5, dunkel: 0x341A2C)
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
