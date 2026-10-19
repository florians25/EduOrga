import SwiftUI

// Gestaltung der Stundenkarten (Woche, Tag, Zeitachse): klassischer Grundstil – in diese Richtung bekannter
// Stundenplanportale, aber eigenständig (eigene Proportionen, Schrift, Statusformen, Wörter und Symbole): weiße Karte
// ohne Rahmen, Radius 2–4, schmaler 3-pt-Balken innen links (grau bzw. Fachfarbe). Die schulweite Kartendarstellung
// (Feld `darstellung` der Sitzung) steuert Inhalte (Fach als Kürzel/Name, Raum, Zeile 2, Statuswörter), Fachfarbe an/aus
// und die Statusfläche. Status: Entfall rot durchgestrichen und schraffiert, Änderung violett (Balken, Fläche, „alt →
// neu“), Prüfung Bernstein, offene Vertretung, Termin, Buchung und abgegebene Stunden gestrichelt.

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

// MARK: - Grundstil (Wochenraster, Tagesliste, Zeitachse)

/// Grundstil der Karten in Woche und Tag (wie die PWA, „Planraster“): weiße Karte auf hellgrauem Raster mit sehr
/// flachem Schatten (dunkel: feine Kontur), weicher Radius 5, 4-pt-Balken innen links mit runden Enden (grau ohne
/// Fachfarbe, sonst die Fachfarbe). Darüber der eigene Status: Entfall rot durchgestrichen und fein schraffiert mit
/// rötlicher Linie, Änderung violette Linie und helle violette Fläche, Prüfung Bernstein-Linie und -Fläche, offene
/// Vertretung gestrichelt violett mit „?“, Termin/Veranstaltung/Buchung gestrichelt.
struct Klassikstil {
    var balken: Color
    var flaeche: Color
    var rand: Color?
    var strich: StrokeStyle
    var schraffur: Bool
    var gedaempft: Bool
    /// Balken zeigen (Termine und Sonderfelder ohne Balken)
    var mitBalken: Bool = true
    /// Offene Vertretung bzw. offener Raum: „?“ an der Karte
    var offen: Bool = false
    /// Farbe der ersten Zeile
    var titel: Color = Farben.text

    static func fuer(_ k: Kachel, _ d: Kartendarstellung) -> Klassikstil {
        let art = k.kartenart
        let offen = k.karte?.istOffeneVertretung == true
        let fach = d.ohneFachfarbe ? nil : Fachfarbe.voll(k.balkenHex)
        var s = Klassikstil(balken: fach ?? Farben.balkenGrau, flaeche: Farben.karte, rand: nil, strich: StrokeStyle(lineWidth: 1),
                            schraffur: false, gedaempft: false)
        switch art {
        case .normal:
            break
        case .entfall:
            s.balken = (fach ?? Farben.balkenGrau).opacity(0.35)
            s.schraffur = true
            s.gedaempft = true
            s.rand = Farben.entfall.opacity(0.45)
            s.titel = Farben.entfall
        case .aenderung:
            s.rand = Farben.aenderung
            if d.statusflaeche { s.flaeche = Farben.aenderungFlaeche }
        case .pruefung:
            s.rand = Farben.pruefung
            if d.statusflaeche { s.flaeche = Farben.pruefungFlaeche }
        case .termin:
            s.mitBalken = false
            s.rand = Farben.text2.opacity(0.6)
            s.strich = StrokeStyle(lineWidth: 1, dash: [3, 2])
            s.titel = Farben.termin
        case .buchung:
            s.mitBalken = false
            s.rand = Farben.frei.opacity(0.8)
            s.strich = StrokeStyle(lineWidth: 1, dash: [3, 2])
            s.titel = Farben.frei
        case .abwesend:
            s.mitBalken = false
            s.rand = Farben.text3
            s.strich = StrokeStyle(lineWidth: 1, dash: [2, 2])
            s.gedaempft = true
        case .neutral:
            s.flaeche = Farben.flaeche2
            s.mitBalken = false
            if k.art == .bereitschaft {
                s.rand = Farben.randStark
                s.strich = StrokeStyle(lineWidth: 1, dash: [3, 2])
            }
        }
        if offen {
            s.offen = true
            s.rand = Farben.aenderung
            s.strich = StrokeStyle(lineWidth: 1.2, dash: [3, 2])
        }
        return s
    }
}

extension View {
    /// Fläche, Schraffur, Balken, Linie bzw. gestrichelter Rand und der flache Schatten im Grundstil.
    func klassikKarte(_ s: Klassikstil, radius: CGFloat = 5, balkenBreite: CGFloat = 4) -> some View {
        let form = RoundedRectangle(cornerRadius: radius, style: .continuous)
        return self
            .background {
                ZStack(alignment: .leading) {
                    form.fill(s.flaeche)
                    if s.schraffur {
                        Streifenmuster(abstand: 6)
                            .stroke(Farben.entfall.opacity(0.13), lineWidth: 1)
                            .clipShape(form)
                    }
                    if s.mitBalken {
                        RoundedRectangle(cornerRadius: balkenBreite / 2, style: .continuous)
                            .fill(s.balken)
                            .frame(width: balkenBreite)
                            .padding(.vertical, 4)
                            .padding(.leading, 4)
                    }
                }
                .shadow(color: s.rand == nil ? Farben.karteSchatten : .clear, radius: 0.75, x: 0, y: 0.75)
            }
            .overlay {
                if let rand = s.rand {
                    form.strokeBorder(rand, style: s.strich)
                } else {
                    form.strokeBorder(Farben.karteKontur, lineWidth: 0.5)
                }
            }
            .overlay(alignment: .bottomTrailing) {
                if s.offen {
                    Text("?")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Farben.aenderung)
                        .frame(width: 13, height: 13)
                        .overlay {
                            RoundedRectangle(cornerRadius: 2, style: .continuous)
                                .strokeBorder(Farben.aenderung.opacity(0.8), style: StrokeStyle(lineWidth: 1, dash: [2, 1.5]))
                        }
                        .padding(3)
                        .accessibilityHidden(true)
                }
            }
    }
}
