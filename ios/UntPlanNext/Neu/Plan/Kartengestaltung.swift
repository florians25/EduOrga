import SwiftUI

// Gestaltung der Stundenkarten (Woche, Tag, Zeitachse) – „Stundenkarte mobil (v3)“, siehe design/DESIGN.md: die Karte
// füllt ihre Zelle (nie breiter als die Spalte), leichte Tönung der Fachfarbe, 4-pt-Balken bündig links, Fach fett oben
// links, darunter Klasse, Lehrkraft und Raum je eine Zeile. Änderungen fallen sofort auf: schraffierter violetter Balken
// und der geänderte Wert als violettes Feld „neu (alt)“; Entfall grau, durchgestrichen mit „Entfall“ in Rot; offen
// gestrichelt. Die schulweite Kartendarstellung (Feld `darstellung` der Sitzung) steuert Fach als Kürzel/Name, Raum,
// Zeile 2, Statuswörter, Fachfarbe an/aus, Tönung und Statusfläche.

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
            .layoutPriority(1)
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

// MARK: - Grundstil v3 (Wochenraster, Tagesliste, Zeitachse)

/// Stundenkarte mobil (v3, design/DESIGN.md „Stundenkarte mobil (v3)“): die Karte füllt ihre Zelle, Radius 6, leichte
/// Tönung der Fachfarbe als Fläche (Kartendarstellung „Balken und Tönung“, Deckkraft nach Schulwert), 4-pt-Balken in der
/// Fachfarbe bündig am linken Rand. Status: Änderung mit schraffiertem violettem Balken, feiner violetter Linie und dem
/// geänderten Wert als violettes Feld „neu (alt)“; Entfall grau, schraffiert, durchgestrichen mit dem Wort „Entfall“ in
/// Rot; offene Vertretung gestrichelt violett mit „?“; Prüfung Bernstein; Termin/Buchung gestrichelt; Veranstaltung als
/// warmes, ruhiges Feld. Kein Schatten – eine feine Kontur trennt die Karte vom Raster.
struct Klassikstil {
    var balken: Color
    var flaeche: Color
    /// Tönung der Fachfarbe über der Fläche (nil = keine)
    var ton: Color? = nil
    var rand: Color?
    var strich: StrokeStyle
    var schraffur: Bool
    var gedaempft: Bool
    /// Balken zeigen (Termine und Sonderfelder ohne Balken)
    var mitBalken: Bool = true
    /// Geänderte Stunde: Balken schraffiert
    var gestreift: Bool = false
    /// Offene Vertretung bzw. offener Raum: „?“ an der Karte
    var offen: Bool = false
    /// Farbe der ersten Zeile
    var titel: Color = Farben.text

    /// Tönung einer Fachfarbe mit der Deckkraft der Kartendarstellung (6–30 %, dunkel etwas kräftiger).
    static func toenung(_ hex: String, prozent: Int) -> Color? {
        guard let f = Fachfarbe.anteile(hex) else { return nil }
        let hell = Double(min(30, max(6, prozent))) / 100
        return Color(uiColor: UIColor { merkmale in
            let deckkraft = merkmale.userInterfaceStyle == .dark ? min(0.4, hell * 1.8) : hell
            return UIColor(red: CGFloat(f.r), green: CGFloat(f.g), blue: CGFloat(f.b), alpha: CGFloat(deckkraft))
        })
    }

    static func fuer(_ k: Kachel, _ d: Kartendarstellung) -> Klassikstil {
        let art = k.kartenart
        let offen = k.karte?.istOffeneVertretung == true
        let fach = d.ohneFachfarbe ? nil : Fachfarbe.voll(k.balkenHex)
        var s = Klassikstil(balken: fach ?? Farben.balkenGrau, flaeche: Farben.karte, rand: nil, strich: StrokeStyle(lineWidth: 1),
                            schraffur: false, gedaempft: false)
        if d.mitToenung && !d.ohneFachfarbe {
            s.ton = toenung(k.balkenHex, prozent: d.deckkraft)
        }
        switch art {
        case .normal:
            break
        case .entfall:
            s.ton = nil
            s.flaeche = Farben.flaeche2
            s.balken = Farben.balkenGrau.opacity(0.6)
            s.schraffur = true
            s.gedaempft = true
            s.rand = Farben.entfall.opacity(0.35)
            s.titel = Farben.text3
        case .aenderung:
            s.balken = Farben.aenderung
            s.gestreift = true
            s.rand = Farben.aenderung.opacity(0.55)
            if d.statusflaeche {
                s.ton = nil
                s.flaeche = Farben.aenderungFlaeche
            }
        case .pruefung:
            s.rand = Farben.pruefung
            if d.statusflaeche {
                s.ton = nil
                s.flaeche = Farben.pruefungFlaeche
            }
        case .termin:
            s.ton = nil
            s.mitBalken = false
            if k.art == .veranstaltung {
                s.flaeche = Farben.ereignisFlaeche
                s.rand = Farben.ereignisRand
                s.titel = Farben.ereignisText
            } else {
                s.rand = Farben.text2.opacity(0.6)
                s.strich = StrokeStyle(lineWidth: 1, dash: [3, 2])
                s.titel = Farben.termin
            }
        case .buchung:
            s.ton = nil
            s.mitBalken = false
            s.rand = Farben.frei.opacity(0.8)
            s.strich = StrokeStyle(lineWidth: 1, dash: [3, 2])
            s.titel = Farben.frei
        case .abwesend:
            s.ton = nil
            s.mitBalken = false
            s.rand = Farben.text3
            s.strich = StrokeStyle(lineWidth: 1, dash: [2, 2])
            s.gedaempft = true
        case .neutral:
            s.ton = nil
            s.flaeche = Farben.flaeche2
            s.mitBalken = false
            if k.art == .bereitschaft {
                s.rand = Farben.randStark
                s.strich = StrokeStyle(lineWidth: 1, dash: [3, 2])
            }
        }
        if offen {
            s.offen = true
            s.balken = Farben.aenderung
            s.gestreift = true
            s.rand = Farben.aenderung
            s.strich = StrokeStyle(lineWidth: 1.2, dash: [3, 2])
        }
        return s
    }
}

/// Balken links an der Karte: Fachfarbe deckend bzw. (geänderte Stunde) schräg schraffiert.
struct Kartenbalken: View {
    let farbe: Color
    var gestreift: Bool = false

    var body: some View {
        if gestreift {
            ZStack {
                Rectangle().fill(farbe.opacity(0.25))
                Streifenmuster(abstand: 5)
                    .stroke(farbe, lineWidth: 2)
            }
            .clipped()
        } else {
            Rectangle().fill(farbe)
        }
    }
}

extension View {
    /// Fläche, Tönung, Schraffur, Balken (bündig links, von der Kartenform beschnitten), Linie bzw. gestrichelter Rand.
    func klassikKarte(_ s: Klassikstil, radius: CGFloat = 6, balkenBreite: CGFloat = 4) -> some View {
        let form = RoundedRectangle(cornerRadius: radius, style: .continuous)
        return self
            .background {
                ZStack(alignment: .leading) {
                    form.fill(s.flaeche)
                    if let ton = s.ton {
                        form.fill(ton)
                    }
                    if s.schraffur {
                        Streifenmuster(abstand: 6)
                            .stroke(Farben.entfall.opacity(0.10), lineWidth: 1)
                    }
                    if s.mitBalken {
                        Kartenbalken(farbe: s.balken, gestreift: s.gestreift)
                            .frame(width: balkenBreite)
                            .frame(maxHeight: .infinity)
                    }
                }
                .clipShape(form)
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

// MARK: - Geänderter Wert als Feld

/// Eine Zeile der Stundenkarte (Lehrkraft, Klasse, Raum): unveränderte Werte als Text, geänderte als kleines violettes
/// Feld „neu (alt)“ – z. B. „Ara (Abr)“ für eine Vertretung, „+B070“ für einen hinzugekommenen Raum, durchgestrichen
/// für einen weggefallenen Wert, „?“ für eine offene Vertretung. Auf einer entfallenen Stunde grau durchgestrichen. Das
/// Feld wird nie breiter als die Karte (eine Zeile, verkleinert bzw. gekürzt).
struct Kartenwert: View {
    let zeile: Kachelzeile
    let karte: Karte?
    var entfall: Bool = false
    var schrift: Font = .system(size: 12)
    var farbe: Color = Farben.text2

    var body: some View {
        if !entfall && !zeile.nurText {
            Kartenwert.aenderungsText(zeile, karte: karte)
                .font(schrift)
                .foregroundStyle(Farben.aenderungText)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .padding(.horizontal, 3)
                .background(Farben.aenderungChip, in: RoundedRectangle(cornerRadius: 3, style: .continuous))
        } else {
            Text(zeile.text)
                .font(schrift)
                .foregroundStyle(entfall ? Farben.text3 : farbe)
                .strikethrough(entfall, color: Farben.entfall.opacity(0.7))
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
    }

    /// Text im Feld: „neu (alt)“ für ersetzte Werte, „+neu“ für hinzugekommene, durchgestrichen für weggefallene.
    static func aenderungsText(_ zeile: Kachelzeile, karte: Karte?) -> Text {
        let werte: [Wert]
        switch zeile.schluessel {
        case "lehrer": werte = karte?.lehrer ?? []
        case "raum": werte = karte?.raeume ?? []
        case "klasse": werte = (karte?.klassen ?? []) + (karte?.mitklassen ?? [])
        default: werte = []
        }
        func gleich(_ a: String, _ b: String) -> Bool { a.caseInsensitiveCompare(b) == .orderedSame }
        let teile = zeile.teile
        var ergebnis = Text("")
        var i = 0
        while i < teile.count {
            let teil = teile[i]
            switch teil.stil {
            case .text:
                ergebnis = ergebnis + Text(teil.text)
            case .plakette:
                let plus = werte.contains { $0.plus && gleich($0.k, teil.text) }
                ergebnis = ergebnis + Text((plus ? "+" : "") + teil.text).fontWeight(.semibold)
                if let alt = werte.first(where: { $0.ersetzt && gleich($0.k, teil.text) })?.alt, !alt.isEmpty {
                    ergebnis = ergebnis + Text(" (\(alt))")
                }
            case .weg:
                // „alt | neu“ (Kopplung) wird zu „neu (alt)“
                if i + 1 < teile.count && teile[i + 1].stil == .plakette {
                    let neu = teile[i + 1]
                    ergebnis = ergebnis + Text(neu.text).fontWeight(.semibold) + Text(" (\(teil.text))") + Text(neu.trenner)
                    i += 2
                    continue
                }
                ergebnis = ergebnis + Text(teil.text).strikethrough(true)
            case .offen:
                ergebnis = ergebnis + Text(teil.text).strikethrough(true) + Text(" ?").fontWeight(.semibold)
            }
            ergebnis = ergebnis + Text(teil.trenner)
            i += 1
        }
        return ergebnis
    }
}
