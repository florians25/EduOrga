import SwiftUI
import UIKit

// Gestaltung von EduOrga: Petrol als Primär- und Akzentfarbe, Statusfarben über `Farben` (Änderung Violett, Termin Magenta,
// Prüfung Bernstein, Entfall Rot), Systemschrift SF Pro mit Dynamic Type, Abstände im 8-pt-Raster. Liquid Glass nur
// über die Helfer in `Glas.swift` und nur auf der Bedienebene; Inhalte sind deckend.

// MARK: - Maße

enum Stilmass {
    /// Grundraster (alle Abstände sind Vielfache davon bzw. die halbe Stufe 4)
    static let raster: CGFloat = 8
    /// Radius von Karten und Flächen
    static let radius: CGFloat = 16
    /// Radius der Stundenkacheln
    static let kachelRadius: CGFloat = 12
    /// Seitenrand
    static let rand: CGFloat = 16
    /// Breite der Zeitspalte links neben der Zeitachse
    static let zeitspalte: CGFloat = 56
}

// MARK: - Fachfarben

/// Fachfarben aus dem Plan (#RRGGBB): deckend, als Tönung und als Kopf der großen Stundenansicht – jeweils mit einer
/// gut lesbaren Schriftfarbe.
enum Fachfarbe {
    /// Rot-, Grün- und Blauanteil (0…1); nil bei leerem bzw. ungültigem Wert.
    static func anteile(_ hex: String) -> (r: Double, g: Double, b: Double)? {
        var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.hasPrefix("#") { s.removeFirst() }
        guard s.count == 6, let wert = UInt32(s, radix: 16) else { return nil }
        return (Double((wert >> 16) & 0xFF) / 255, Double((wert >> 8) & 0xFF) / 255, Double(wert & 0xFF) / 255)
    }

    /// Relative Leuchtdichte nach WCAG.
    static func leuchtdichte(_ r: Double, _ g: Double, _ b: Double) -> Double {
        func linear(_ v: Double) -> Double { v <= 0.03928 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4) }
        return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
    }

    private static func uiFarbe(_ r: Double, _ g: Double, _ b: Double, _ a: Double = 1) -> UIColor {
        UIColor(red: CGFloat(r), green: CGFloat(g), blue: CGFloat(b), alpha: CGFloat(a))
    }

    /// Fachfarbe deckend (Punkt, Belegungsleiste); im Dunkelmodus etwas heller.
    static func voll(_ hex: String) -> Color? {
        guard let f = anteile(hex) else { return nil }
        return Color(uiColor: UIColor { merkmale in
            if merkmale.userInterfaceStyle == .dark {
                return uiFarbe(min(1, f.r * 0.85 + 0.15), min(1, f.g * 0.85 + 0.15), min(1, f.b * 0.85 + 0.15))
            }
            return uiFarbe(f.r, f.g, f.b)
        })
    }

    /// Tönung der Kachel: Fachfarbe mit 16 % Deckkraft (im Dunkelmodus 26 %).
    static func ton(_ hex: String) -> Color? {
        guard let f = anteile(hex) else { return nil }
        return Color(uiColor: UIColor { merkmale in
            uiFarbe(f.r, f.g, f.b, merkmale.userInterfaceStyle == .dark ? 0.26 : 0.16)
        })
    }

    /// Ersatz ohne Fachfarbe: Primärfarbe Petrol #164C55.
    private static let petrol = (0x16 / 255.0, 0x4C / 255.0, 0x55 / 255.0)

    /// Kopf der großen Stundenansicht: Fachfarbe deckend (dunkel: abgedunkelt), ohne Fachfarbe Petrol.
    static func kopf(_ hex: String) -> Color {
        let f = anteile(hex) ?? petrol
        return Color(uiColor: UIColor { merkmale in
            if merkmale.userInterfaceStyle == .dark {
                return uiFarbe(f.r * 0.62, f.g * 0.62, f.b * 0.62)
            }
            return uiFarbe(f.r, f.g, f.b)
        })
    }

    /// Schrift auf dem Kopf: weiß auf dunklen, fast schwarz auf hellen Fachfarben.
    static func schriftAufKopf(_ hex: String) -> Color {
        let f = anteile(hex) ?? petrol
        return Color(uiColor: UIColor { merkmale in
            let faktor = merkmale.userInterfaceStyle == .dark ? 0.62 : 1
            let l = leuchtdichte(f.r * faktor, f.g * faktor, f.b * faktor)
            return l > 0.42 ? uiFarbe(0x15 / 255.0, 0x1A / 255.0, 0x21 / 255.0) : .white
        })
    }
}

// MARK: - Status einer Kachel

/// Fachlicher Status als Plakette (Text, Farbe, Fläche, Symbol).
struct Statusmerkmal: Hashable {
    let text: String
    let farbe: Color
    let flaeche: Color
    let symbol: String
    /// Muss auffallen (Entfall, Vertretung, Raumänderung, Zusatzstunde, offen, Prüfung): gefüllte Plakette, Rahmen und
    /// getönte Kachel
    var betont: Bool = false
}

enum Statuslehre {
    /// Status der Kachel (höchstens einer – der wichtigste), ohne „online“.
    static func merkmal(_ k: Kachel) -> Statusmerkmal? {
        switch k.art {
        case .entfall:
            return Statusmerkmal(text: "Entfall", farbe: Farben.entfall, flaeche: Farben.entfallFlaeche, symbol: "xmark", betont: true)
        case .aenderung:
            if k.raumAenderung {
                return Statusmerkmal(text: "Raumänderung", farbe: Farben.aenderung, flaeche: Farben.aenderungFlaeche, symbol: "arrow.right", betont: true)
            }
            if k.zusatz {
                return Statusmerkmal(text: "Zusatzstunde", farbe: Farben.aenderung, flaeche: Farben.aenderungFlaeche, symbol: "plus", betont: true)
            }
            if k.karte?.istOffeneVertretung == true {
                return Statusmerkmal(text: "Offen", farbe: Farben.aenderung, flaeche: Farben.aenderungFlaeche, symbol: "questionmark", betont: true)
            }
            return Statusmerkmal(text: "Vertretung", farbe: Farben.aenderung, flaeche: Farben.aenderungFlaeche,
                                 symbol: "arrow.left.arrow.right", betont: true)
        case .normal:
            if k.raumAenderung {
                return Statusmerkmal(text: "Raumänderung", farbe: Farben.aenderung, flaeche: Farben.aenderungFlaeche, symbol: "arrow.right", betont: true)
            }
            return nil
        case .klausur:
            return Statusmerkmal(text: "Prüfung", farbe: Farben.pruefung, flaeche: Farben.pruefungFlaeche, symbol: "doc.text", betont: true)
        case .termin, .ganztagTermin:
            let buchung = k.karte?.istRaumbuchung == true
            return Statusmerkmal(text: buchung ? "Raumbuchung" : "Termin", farbe: Farben.termin, flaeche: Farben.terminFlaeche,
                                 symbol: "calendar")
        case .veranstaltung:
            return Statusmerkmal(text: "Veranstaltung", farbe: Farben.termin, flaeche: Farben.terminFlaeche, symbol: "calendar")
        case .abgegeben:
            return Statusmerkmal(text: "Abgegeben", farbe: Farben.text2, flaeche: Farben.neutralFlaeche, symbol: "arrow.uturn.right")
        case .bereitschaft:
            return Statusmerkmal(text: "Bereitschaft", farbe: Farben.text2, flaeche: Farben.neutralFlaeche, symbol: "clock")
        case .bereitschaftAbwesend:
            return Statusmerkmal(text: "Lehrkraft abwesend", farbe: Farben.text2, flaeche: Farben.neutralFlaeche, symbol: "person.slash")
        case .aufsicht:
            switch k.aufsichtsstand {
            case .regulaer: return Statusmerkmal(text: "Aufsicht", farbe: Farben.text2, flaeche: Farben.neutralFlaeche, symbol: "figure.walk")
            case .vertretung: return Statusmerkmal(text: "Vertretung", farbe: Farben.aenderung, flaeche: Farben.aenderungFlaeche, symbol: "arrow.left.arrow.right", betont: true)
            case .abgegeben: return Statusmerkmal(text: "Vertreten", farbe: Farben.text2, flaeche: Farben.neutralFlaeche, symbol: "arrow.uturn.right")
            case .entfall: return Statusmerkmal(text: "Entfällt", farbe: Farben.entfall, flaeche: Farben.entfallFlaeche, symbol: "xmark", betont: true)
            }
        }
    }

    /// Plakette „Online“.
    static let online = Statusmerkmal(text: "Online", farbe: Farben.akzent, flaeche: Farben.primaerFlaeche, symbol: "video.fill")

    /// Farbe eines Abschnitts in der Belegungsleiste: Status vor Fachfarbe.
    static func leistenfarbe(_ k: Kachel) -> Color {
        switch k.art {
        case .entfall: return Farben.entfall
        case .aenderung: return Farben.aenderung
        case .klausur: return Farben.pruefung
        case .termin, .veranstaltung, .ganztagTermin: return Farben.termin
        case .abgegeben, .bereitschaft, .bereitschaftAbwesend, .aufsicht: return Farben.randStark
        case .normal: return k.raumAenderung ? Farben.aenderung : (Fachfarbe.voll(k.balkenHex) ?? Farben.akzent)
        }
    }

    /// Findet die Stunde für die betrachtete Person statt (für „jetzt“ und „als Nächstes“)?
    static func findetStatt(_ k: Kachel) -> Bool {
        guard k.karte != nil, !k.inPause else { return false }
        switch k.art {
        case .entfall, .abgegeben, .bereitschaftAbwesend, .ganztagTermin: return false
        default: return true
        }
    }
}

// MARK: - Uhrzeit

enum Uhr {
    /// Minuten seit Mitternacht.
    static func minuten(_ datum: Date = Date()) -> Int {
        let k = Datumsformat.kalender
        return k.component(.hour, from: datum) * 60 + k.component(.minute, from: datum)
    }

    /// „7:45“ aus Minuten seit Mitternacht.
    static func uhrzeit(_ minuten: Int) -> String {
        let m = max(0, minuten)
        return "\(m / 60):" + String(format: "%02d", m % 60)
    }

    /// „1 Std. 05 Min.“ bzw. „23 Min.“
    static func dauer(_ minuten: Int) -> String {
        let m = max(0, minuten)
        if m >= 60 {
            let rest = m % 60
            return rest == 0 ? "\(m / 60) Std." : "\(m / 60) Std. \(rest) Min."
        }
        return "\(m) Min."
    }

    /// Ausgeschriebene Dauer für VoiceOver.
    static func dauerGesprochen(_ minuten: Int) -> String {
        let m = max(0, minuten)
        let h = m / 60
        let r = m % 60
        var teile: [String] = []
        if h > 0 { teile.append(h == 1 ? "eine Stunde" : "\(h) Stunden") }
        if r > 0 || h == 0 { teile.append(r == 1 ? "eine Minute" : "\(r) Minuten") }
        return teile.joined(separator: " und ")
    }
}

// MARK: - Haptik

enum Haptik {
    @MainActor static func tippen() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    @MainActor static func auswahl() {
        UISelectionFeedbackGenerator().selectionChanged()
    }

    @MainActor static func erfolg() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }
}

// MARK: - Muster

/// Schräge Schraffur (45°) für entfallene Stunden.
struct Streifenmuster: Shape {
    var abstand: CGFloat = 7

    func path(in rect: CGRect) -> Path {
        var p = Path()
        let schritt = max(abstand, 2)
        var x = -rect.height
        while x < rect.width {
            p.move(to: CGPoint(x: rect.minX + x, y: rect.maxY))
            p.addLine(to: CGPoint(x: rect.minX + x + rect.height, y: rect.minY))
            x += schritt
        }
        return p
    }
}

// MARK: - Flächen

extension View {
    /// Karte: Fläche, Radius 14, feiner Rand.
    func kartenflaeche(_ flaeche: Color = Farben.flaeche, radius: CGFloat = Stilmass.radius) -> some View {
        background(flaeche, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .strokeBorder(Farben.rand, lineWidth: 1)
            }
    }
}

/// Status-Plakette mit Symbol (Kachel, Kopf der Stundenansicht). Gefüllt (Statusfarbe als Fläche, helle Schrift) für
/// alles, was auffallen muss.
struct Statusabzeichen: View {
    let merkmal: Statusmerkmal
    var klein: Bool = false
    /// Auf farbigem Grund (Kopf der Stundenansicht): weiße Fläche
    var aufKopf: Bool = false
    /// Statusfarbe als Fläche (Entfall, Vertretung …)
    var gefuellt: Bool = false

    private var schrift: Color { gefuellt && !aufKopf ? Farben.aufStatus : merkmal.farbe }
    private var flaeche: Color { aufKopf ? Color.white : (gefuellt ? merkmal.farbe : merkmal.flaeche) }

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: merkmal.symbol)
                .font(klein ? Font.caption2.weight(.bold) : Font.caption.weight(.bold))
                .imageScale(.small)
                .accessibilityHidden(true)
            Text(merkmal.text.uppercased())
                .font(klein ? Font.caption2.weight(.bold) : Font.caption.weight(.bold))
                .tracking(0.4)
                .lineLimit(1)
        }
        .foregroundStyle(schrift)
        .padding(.horizontal, klein ? 6 : 8)
        .padding(.vertical, klein ? 2 : 4)
        .background(flaeche, in: Capsule())
        .fixedSize()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(merkmal.text)
    }
}

// MARK: - Zoom-Übergang

/// Quelle des Zoom-Übergangs (Kachel, Karte).
struct ZoomQuelle: ViewModifier {
    let id: String
    let raum: Namespace.ID?

    @ViewBuilder
    func body(content: Content) -> some View {
        if let raum {
            content.matchedTransitionSource(id: id, in: raum)
        } else {
            content
        }
    }
}

/// Ziel des Zoom-Übergangs (große Stundenansicht).
struct ZoomZiel: ViewModifier {
    let id: String
    let raum: Namespace.ID?

    @ViewBuilder
    func body(content: Content) -> some View {
        if let raum {
            content.navigationTransition(.zoom(sourceID: id, in: raum))
        } else {
            content
        }
    }
}

extension View {
    func zoomQuelle(_ id: String, in raum: Namespace.ID?) -> some View {
        modifier(ZoomQuelle(id: id, raum: raum))
    }

    func zoomZiel(_ id: String, in raum: Namespace.ID?) -> some View {
        modifier(ZoomZiel(id: id, raum: raum))
    }
}

// MARK: - Auswahl einer Stunde (öffnet die große Stundenansicht)

struct Stundenwahl: Identifiable {
    let id = UUID()
    /// Kennung der Quelle für den Zoom-Übergang
    let quelle: String
    /// Stunden zur selben Zeit (die gewählte zuerst bzw. an `start`)
    let karten: [Karte]
    var start: Int = 0
    var aufsicht: Aufsicht? = nil
    let typ: String
    let element: String
}

extension View {
    /// Große Stundenansicht bildschirmfüllend zeigen – mit Zoom aus der angetippten Kachel (Wischen nach unten bzw.
    /// Zusammenziehen schließt).
    func stundenBuehne(_ wahl: Binding<Stundenwahl?>, raum: Namespace.ID?, zustand: AppZustand) -> some View {
        fullScreenCover(item: wahl) { w in
            StundenBuehne(wahl: w)
                .environmentObject(zustand)
                .zoomZiel(w.quelle, in: raum)
        }
    }
}
