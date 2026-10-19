import SwiftUI

// Gestaltung der Stundenkarten nach der schulweiten Kartendarstellung (Feld `darstellung` der Sitzung, siehe
// Kartendarstellung in SchulModelle.swift) – dieselbe Logik wie `kachelStil` in web/client/src/components/plan/Kachel.tsx.
// Standard „Klassisch“: kompakte weiße Karte, Fachfarbe als 4-pt-Balken links mit leichter Tönung, Fach fett oben links,
// Raum oben rechts, Lehrkraft bzw. Klasse darunter. Status: Entfall rot durchgestrichen und schraffiert, Änderung mit
// violetter Linie (und heller violetter Fläche), Prüfung Bernstein, Termin/Buchung und abgegebene Stunden gestrichelt.

// MARK: - Umgebung

private struct KartendarstellungSchluessel: EnvironmentKey {
    static let defaultValue = Kartendarstellung()
}

extension EnvironmentValues {
    /// Darstellung der Stundenkarten (aus der Sitzung; ohne Sitzung der Standard „Klassisch“).
    var kartendarstellung: Kartendarstellung {
        get { self[KartendarstellungSchluessel.self] }
        set { self[KartendarstellungSchluessel.self] = newValue }
    }
}

// MARK: - Art und Stil

/// Stilart einer Karte (wie `artVon` im Web).
enum Kartenart: Equatable {
    case normal
    case aenderung
    case entfall
    case pruefung
    case termin
    case buchung
    case abwesend
    case neutral
}

extension Kachel {
    var kartenart: Kartenart {
        switch art {
        case .entfall: return .entfall
        case .aenderung: return .aenderung
        case .normal: return raumAenderung ? .aenderung : .normal
        case .klausur: return .pruefung
        case .termin, .ganztagTermin: return karte?.istRaumbuchung == true ? .buchung : .termin
        case .veranstaltung: return .termin
        case .abgegeben, .bereitschaftAbwesend: return .abwesend
        case .bereitschaft: return .neutral
        case .aufsicht:
            switch aufsichtsstand {
            case .entfall: return .entfall
            case .vertretung: return .aenderung
            case .abgegeben: return .abwesend
            case .regulaer: return .neutral
            }
        }
    }

    /// Fachtext der Karte: Kürzel bzw. ausgeschriebener Fachname (Kartendarstellung „Fach als Name“).
    func fachText(_ d: Kartendarstellung) -> String {
        if d.fach == "name", let n = karte?.fachName.trimmingCharacters(in: .whitespacesAndNewlines), !n.isEmpty, art == .normal || art == .aenderung {
            return n
        }
        return anzeigeTitel
    }
}

/// Berechnete Flächen, Linien und Fachfarbe einer Karte.
struct Kartenstilwerte {
    var grund: Color
    /// Tönung in der Fachfarbe über der Grundfläche (nil = keine)
    var ton: Color?
    var rand: Color
    var strich: StrokeStyle
    /// Fachfarbbalken links bzw. oben (nil = keiner)
    var balken: Color?
    var balkenOben: Bool
    var balkenBreite: CGFloat
    /// Fachfarbe als Quadrat vor dem Fach
    var quadrat: Color?
    var schraffur: Bool
    /// Inhalt gedämpft (Entfall, abgegeben)
    var gedaempft: Bool
    var radius: CGFloat

    static func berechnen(_ k: Kachel, _ d: Kartendarstellung) -> Kartenstilwerte {
        let art = k.kartenart
        let kraeftig = d.rahmen == "kraeftig"
        let breite: CGFloat = kraeftig ? 2 : 1
        let linie: Color = d.rahmen == "keiner" ? .clear : (kraeftig ? Farben.text.opacity(0.42) : Farben.kachelRand)
        let papier = Farben.flaeche
        let grund: Color = d.flaeche == "neutral" ? Farben.kachelFlaeche : papier
        let fach = Fachfarbe.voll(k.balkenHex)
        let statusFlaeche = d.statusflaeche && (art == .aenderung || art == .pruefung)
        var ton: Color? = nil
        if d.mitToenung, art != .entfall, art != .abwesend, art != .termin, art != .buchung, !statusFlaeche,
           let f = Fachfarbe.anteile(k.balkenHex) {
            ton = Color(.sRGB, red: f.r, green: f.g, blue: f.b, opacity: Double(d.deckkraft) / 100)
        }
        if d.flaeche == "getoent" && ton == nil {
            ton = Farben.primaer.opacity(0.05)
        }
        let mitFach = art == .normal || art == .aenderung || art == .pruefung || art == .entfall
        let balken: Color? = (d.balkenLinks || d.balkenOben) && mitFach ? fach : nil
        let quadrat: Color? = d.quadrat && mitFach ? (fach ?? Farben.randStark) : nil
        let statusGrund = d.flaeche == "neutral" ? papier : grund
        var w = Kartenstilwerte(grund: grund, ton: ton, rand: linie, strich: StrokeStyle(lineWidth: breite), balken: balken,
                                balkenOben: d.balkenOben, balkenBreite: CGFloat(d.balkenbreite), quadrat: quadrat,
                                schraffur: false, gedaempft: false, radius: CGFloat(d.eckenradius) + 2)
        switch art {
        case .entfall:
            w.grund = papier
            w.ton = nil
            w.schraffur = true
            w.rand = Farben.entfall.opacity(0.45)
            w.strich = StrokeStyle(lineWidth: breite)
            w.gedaempft = true
            w.balken = balken.map { $0.opacity(0.35) }
        case .aenderung:
            w.grund = statusFlaeche ? Farben.aenderungFlaeche : statusGrund
            w.rand = Farben.aenderung
            w.strich = StrokeStyle(lineWidth: max(breite, 1.5))
        case .pruefung:
            w.grund = statusFlaeche ? Farben.pruefungFlaeche : statusGrund
            w.rand = Farben.pruefung
            w.strich = StrokeStyle(lineWidth: max(breite, 1.5))
        case .termin:
            w.grund = papier
            w.rand = Farben.termin.opacity(0.75)
            w.strich = StrokeStyle(lineWidth: breite, dash: [4, 3])
        case .buchung:
            w.grund = papier
            w.rand = Farben.frei
            w.strich = StrokeStyle(lineWidth: breite, dash: [4, 3])
        case .abwesend:
            w.grund = papier
            w.ton = nil
            w.rand = Farben.text2.opacity(0.7)
            w.strich = StrokeStyle(lineWidth: breite, dash: [2, 3])
            w.gedaempft = true
        case .neutral:
            w.grund = Farben.flaeche2
            w.rand = Farben.randStark
            w.strich = StrokeStyle(lineWidth: breite, dash: k.art == .bereitschaft ? [4, 3] : [])
        case .normal:
            if d.rahmen == "keiner" && fach == nil { w.rand = Farben.rand }
        }
        return w
    }
}

extension View {
    /// Fläche, Tönung, Schraffur, Fachfarbbalken und Linie einer Stundenkarte (deckend, kein Glas).
    func kartenStil(_ w: Kartenstilwerte) -> some View {
        let form = RoundedRectangle(cornerRadius: w.radius, style: .continuous)
        return self
            .background {
                ZStack(alignment: w.balkenOben ? .top : .leading) {
                    form.fill(w.grund)
                    if let ton = w.ton { form.fill(ton) }
                    if w.schraffur {
                        Streifenmuster(abstand: 6)
                            .stroke(Farben.entfall.opacity(0.16), lineWidth: 1)
                    }
                    if let b = w.balken {
                        if w.balkenOben {
                            b.frame(height: w.balkenBreite).frame(maxWidth: .infinity)
                        } else {
                            b.frame(width: w.balkenBreite).frame(maxHeight: .infinity)
                        }
                    }
                }
                .clipShape(form)
            }
            .overlay {
                form.strokeBorder(w.rand, style: w.strich)
            }
    }
}

/// Kleines Quadrat in der Fachfarbe vor dem Fach (Kartendarstellung „Quadrat“).
struct FachQuadrat: View {
    let farbe: Color
    var groesse: CGFloat = 8

    var body: some View {
        RoundedRectangle(cornerRadius: 1.5, style: .continuous)
            .fill(farbe)
            .frame(width: groesse, height: groesse)
            .accessibilityHidden(true)
    }
}

/// Statuswort klein in Großbuchstaben in der Statusfarbe, ohne Fläche (wie die Plaketten der Web-Kacheln).
struct Statuswort: View {
    let merkmal: Statusmerkmal
    var klein: Bool = true

    var body: some View {
        Text(merkmal.text.uppercased())
            .font(.system(size: klein ? 9.5 : 11, weight: .semibold))
            .tracking(0.3)
            .foregroundStyle(merkmal.farbe)
            .lineLimit(1)
            .fixedSize()
            .accessibilityHidden(true)
    }
}

extension Statuslehre {
    /// Statuswort auf einer kleinen Karte: nur, was sich sonst nicht ablesen lässt (Prüfung, Termin, Buchung, offene
    /// Vertretung, Zusatzstunde) – mit „Statuswörter“ der Administration alle.
    static func kartenwort(_ k: Kachel, _ d: Kartendarstellung) -> Statusmerkmal? {
        guard let m = merkmal(k) else { return nil }
        if d.statuswoerter { return m }
        switch m.text {
        case "Prüfung", "Termin", "Raumbuchung", "Veranstaltung", "Offen", "Zusatzstunde": return m
        default: return nil
        }
    }
}

// MARK: - Klassischer Grundstil (Wochenraster und Tagesliste)

/// Grundstil der Karten in Woche und Tag: weiße Karte ohne Rahmen, Radius 2, schmaler 3-pt-Balken innen am linken
/// Rand (grau bzw. Fachfarbe), darüber der eigene Status (Entfall rot und schraffiert, Änderung violett, Prüfung
/// Bernstein, offene Vertretung, Termin, Buchung und abgegebene Stunden gestrichelt).
struct Klassikstil {
    var balken: Color
    var flaeche: Color
    var rand: Color?
    var strich: StrokeStyle
    var schraffur: Bool
    var gedaempft: Bool

    static func fuer(_ k: Kachel, _ d: Kartendarstellung) -> Klassikstil {
        let art = k.kartenart
        let offen = k.karte?.istOffeneVertretung == true
        var s = Klassikstil(balken: Farben.randStark, flaeche: Farben.flaeche, rand: nil, strich: StrokeStyle(lineWidth: 1),
                            schraffur: false, gedaempft: false)
        switch art {
        case .normal:
            if !d.ohneFachfarbe, let f = Fachfarbe.voll(k.balkenHex) { s.balken = f }
        case .entfall:
            s.balken = Farben.entfall.opacity(0.7)
            s.schraffur = true
            s.gedaempft = true
            s.rand = Farben.entfall.opacity(0.35)
        case .aenderung:
            s.balken = Farben.aenderung
            if d.statusflaeche { s.flaeche = Farben.aenderungFlaeche }
        case .pruefung:
            s.balken = Farben.pruefung
            if d.statusflaeche { s.flaeche = Farben.pruefungFlaeche }
        case .termin:
            s.balken = Farben.termin
            s.rand = Farben.termin.opacity(0.75)
            s.strich = StrokeStyle(lineWidth: 1, dash: [3, 2])
        case .buchung:
            s.balken = Farben.frei
            s.rand = Farben.frei
            s.strich = StrokeStyle(lineWidth: 1, dash: [3, 2])
        case .abwesend:
            s.rand = Farben.text3
            s.strich = StrokeStyle(lineWidth: 1, dash: [2, 2])
            s.gedaempft = true
        case .neutral:
            s.flaeche = Farben.flaeche2
            if k.art == .bereitschaft {
                s.rand = Farben.randStark
                s.strich = StrokeStyle(lineWidth: 1, dash: [3, 2])
            }
        }
        if offen {
            s.rand = Farben.aenderung
            s.strich = StrokeStyle(lineWidth: 1.2, dash: [3, 2])
        }
        return s
    }
}

extension View {
    /// Fläche, Schraffur, Balken und (nur bei Bedarf) gestrichelter Rand im klassischen Grundstil.
    func klassikKarte(_ s: Klassikstil, radius: CGFloat = 2, balkenBreite: CGFloat = 3) -> some View {
        let form = RoundedRectangle(cornerRadius: radius, style: .continuous)
        return self
            .background {
                ZStack(alignment: .leading) {
                    form.fill(s.flaeche)
                    if s.schraffur {
                        Streifenmuster(abstand: 6)
                            .stroke(Farben.entfall.opacity(0.14), lineWidth: 1)
                            .clipShape(form)
                    }
                    RoundedRectangle(cornerRadius: balkenBreite / 2, style: .continuous)
                        .fill(s.balken)
                        .frame(width: balkenBreite)
                        .padding(.vertical, 2)
                        .padding(.leading, 2)
                }
            }
            .overlay {
                if let rand = s.rand {
                    form.strokeBorder(rand, style: s.strich)
                }
            }
    }
}
