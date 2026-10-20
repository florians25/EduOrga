import SwiftUI

// Gestaltung der Stundenkarten (Woche, Tag, Zeitachse) – „Stundenkarte mobil (v4)“: kompakte Karte, die ihre Zelle füllt
// (nie breiter als die Spalte), standardmäßig neutral (weiß bzw. hellgrau mit grauem Balken links; Fachfarbe nur, wenn die
// Schule eine gesetzt hat), Fach fett oben links, darunter Klasse, Lehrkraft und Raum je eine kurze Zeile.
//
// Änderungen wie in der Änderungslegende von Enbrea („Änderungstyp | Darstellung“): schraffierter linker Rand in der
// Statusfarbe und ein kleines Feld auf der betroffenen Zeile – mit den EduOrga-Anpassungen: jede Änderung einheitlich Grün
// (#2f855a, Feld #e6f4ea mit Schrift #1d5c3a), Entfall und Fehlendes Rot (#b42318, Feld #fdecea); bei Entfall ist zusätzlich
// alles auf der Karte durchgestrichen.
//
//   Klasse fehlt                 „(5b)“ auf der Klassenzeile und „× entfällt“
//   Lehrer fehlt, keine Vertr.   „(Abr)“ auf der Lehrerzeile (rot)
//   Vertretungsentfall           „× entfällt“
//   Lehrervertretung             „+Gal (Gor)“ auf der Lehrerzeile
//   Raumänderung                 „+105 (303)“ auf der Raumzeile
//   Fachänderung                 „+BI (MU)“ auf der Fachzeile
//   Verschoben (weg)             „× auf Di 21.10. 6 | 12:20“
//   Verschoben (hierher)         „⊕ von Mo 20.10. 3 | 09:45“
//   Zusatzunterricht             „⊕ Zusatz“
//   Mitteilung                   eigener hellgelber Block mit Text
//
// Die schulweite Kartendarstellung (Feld `darstellung` der Sitzung) steuert Fach als Kürzel/Name, Raum, Zeile 2,
// Statuswörter, Fachfarbe an/aus, Tönung und Statusfläche.

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
        // Klasse fehlt (alle Klassen der Stunde abwesend): wie ein Entfall mit „(5b)“ und „× entfällt“
        if klasseFehlt && [.normal, .aenderung, .abgegeben, .entfall].contains(art) { return .entfall }
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

    /// Alle Klassen der Stunde fehlen (Klassenabwesenheit, Exkursion …) – die Stunde findet für sie nicht statt.
    var klasseFehlt: Bool {
        guard let k = karte, !k.abwesendeKlassen.isEmpty else { return false }
        let namen = k.klassen.map(\.k).filter { !$0.isEmpty }
        guard !namen.isEmpty else { return false }
        return namen.allSatisfy { n in k.abwesendeKlassen.contains { $0.caseInsensitiveCompare(n) == .orderedSame } }
    }

    /// Bisheriges Fach einer Fachänderung (nil = keine) – auf der Karte als „+BI (MU)“.
    var fachVorher: String? {
        guard let k = karte, kartenart != .entfall, art == .aenderung || art == .normal,
              let alt = k.fachAlt?.trimmingCharacters(in: .whitespaces), !alt.isEmpty,
              alt.caseInsensitiveCompare(k.fach) != .orderedSame else { return nil }
        return alt
    }

    /// Feld unten auf der Karte (Enbrea-Legende): „× entfällt“, „× auf Di 21.10. 6 | 12:20“, „⊕ von Mo 20.10. 3 | 09:45“,
    /// „⊕ Zusatz“ – nil bei Unterricht ohne solche Änderung, Terminen, Aufsichten und Bereitschaften.
    var statusChip: Kartenchip? {
        guard let k = karte, !inPause else { return nil }
        switch art {
        case .normal, .aenderung, .entfall, .abgegeben: break
        default: return nil
        }
        let weg = kartenart == .entfall
        if k.verlegung == "von", art == .entfall || art == .abgegeben || weg {
            if let ziel = k.verlegungNach, let t = Kartenchip.termin(ziel) {
                return Kartenchip(text: "× auf \(t)", ton: .entfall)
            }
            return Kartenchip(text: "× verlegt", ton: .entfall)
        }
        if weg { return Kartenchip(text: "× entfällt", ton: .entfall) }
        if k.verlegung == "nach", art == .aenderung || art == .normal {
            if let quelle = k.verlegungVon, let t = Kartenchip.termin(quelle) {
                return Kartenchip(text: "⊕ von \(t)", ton: .aenderung)
            }
            return Kartenchip(text: "⊕ verlegt", ton: .aenderung)
        }
        if zusatz || (art == .aenderung && k.istZusatzstunde) {
            return Kartenchip(text: "⊕ Zusatz", ton: .aenderung)
        }
        return nil
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
        // „Offen“ und „Zusatzstunde“ zeigt die Karte schon als Feld („(Abr)“ bzw. „⊕ Zusatz“)
        case "Prüfung", "Termin", "Raumbuchung", "Veranstaltung": return m
        default: return nil
        }
    }
}

// MARK: - Grundstil v3 (Wochenraster, Tagesliste, Zeitachse)

/// Stundenkarte mobil (v4): die Karte füllt ihre Zelle, Radius 6, neutral (weiß, grauer Balken), Fachfarbe nur, wenn die
/// Schule eine gesetzt hat (Balken und leichte Tönung). Status wie in der Enbrea-Legende mit EduOrga-Farben: Änderung mit
/// grün schraffiertem Balken, feiner grüner Linie und dem geänderten Wert als grünes Feld „+neu (alt)“; Entfall rot
/// schraffiert, alles grau durchgestrichen, „× entfällt“ als rotes Feld; fehlende Lehrkraft ohne Vertretung rot
/// schraffiert und gestrichelt mit „(Abr)“; Prüfung Bernstein; Termin/Buchung gestrichelt; Mitteilung bzw. Veranstaltung
/// als hellgelber Block. Kein Schatten – eine feine Kontur trennt die Karte vom Raster.
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
            // Entfall (auch „Klasse fehlt“, „verschoben auf …“): roter schraffierter Rand, alles durchgestrichen
            s.ton = nil
            s.flaeche = Farben.flaeche2
            s.balken = Farben.entfall
            s.gestreift = true
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
        if offen && art != .entfall {
            // Lehrkraft fehlt, keine Vertretung erstellt: roter schraffierter Rand, gestrichelte Linie, „(Abr)“ als rotes Feld
            s.balken = Farben.entfall
            s.gestreift = true
            s.rand = Farben.entfall.opacity(0.7)
            s.strich = StrokeStyle(lineWidth: 1, dash: [3, 2])
            if d.statusflaeche {
                s.ton = nil
                s.flaeche = Farben.karte
            }
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

// MARK: - Felder (Chips)

/// Farbe eines Feldes auf der Karte: Änderung (grün) bzw. Entfall und Fehlendes (rot).
enum Chipton: Hashable {
    case aenderung
    case entfall

    var flaeche: Color { self == .entfall ? Farben.entfallChip : Farben.aenderungChip }
    var schrift: Color { self == .entfall ? Farben.entfallChipText : Farben.aenderungText }
    var rand: Color { self == .entfall ? Farben.entfall.opacity(0.35) : Farben.aenderung.opacity(0.4) }
}

/// Feld unten auf der Karte („× entfällt“, „⊕ Zusatz“ …).
struct Kartenchip: Hashable {
    let text: String
    let ton: Chipton

    /// Kurzform einer Verlegungsseite wie in der Enbrea-Legende: „Di 21.10. 6 | 12:20“ (ohne Stunde bzw. Uhrzeit kürzer).
    static func termin(_ s: Verlegungsseite) -> String? {
        guard !s.datum.isEmpty else { return nil }
        var tag = Datumsformat.anzeige(s.datum, "EEE")
        while tag.hasSuffix(".") { tag.removeLast() }
        var teile = ["\(tag) \(Datumsformat.anzeige(s.datum, "dd.MM."))"]
        if let st = s.stunde { teile.append("\(st)") }
        var text = teile.joined(separator: " ")
        if !s.beginn.isEmpty { text += " | " + s.beginn }
        return text
    }
}

/// Kleines Feld auf der Karte: helle Fläche, feine Linie, Schrift in der Statusfarbe – eine Zeile, verkleinert bzw.
/// gekürzt, nie breiter als die Karte.
struct Chipfeld<Inhalt: View>: View {
    let ton: Chipton
    @ViewBuilder let inhalt: () -> Inhalt

    var body: some View {
        inhalt()
            .foregroundStyle(ton.schrift)
            .lineLimit(1)
            .minimumScaleFactor(0.65)
            .padding(.horizontal, 3)
            .background(ton.flaeche, in: RoundedRectangle(cornerRadius: 3, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 3, style: .continuous)
                    .strokeBorder(ton.rand, lineWidth: 0.5)
            }
    }
}

/// Feld unten auf der Karte (Entfall, Verlegung, Zusatz).
struct Statuschip: View {
    let chip: Kartenchip
    var schrift: Font = .system(size: 10, weight: .semibold)

    var body: some View {
        Chipfeld(ton: chip.ton) {
            Text(chip.text)
                .font(schrift)
                .monospacedDigit()
        }
        .accessibilityHidden(true)
    }
}

/// Fach der Karte: unverändert als Text, bei einer Fachänderung als grünes Feld „+BI (MU)“, bei Entfall grau und
/// durchgestrichen.
struct Kartenfach: View {
    let kachel: Kachel
    let text: String
    var schrift: Font = .system(size: 13, weight: .bold)
    var farbe: Color = Farben.text

    private var entfall: Bool { kachel.kartenart == .entfall }

    var body: some View {
        if let alt = kachel.fachVorher {
            Chipfeld(ton: .aenderung) {
                (Text("+" + text).font(schrift) + Text(" (\(alt))").font(schrift.weight(.regular)))
            }
        } else {
            Text(text)
                .font(schrift)
                .foregroundStyle(entfall ? Farben.text3 : farbe)
                .strikethrough(entfall, color: Farben.entfall)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
    }
}

// MARK: - Geänderter Wert als Feld

/// Eine Zeile der Stundenkarte (Lehrkraft, Klasse, Raum): unveränderte Werte als Text, geänderte als kleines Feld wie in
/// der Enbrea-Legende – „+Gal (Gor)“ für eine Vertretung, „+105 (303)“ für eine Raumänderung, „+B070“ für einen
/// hinzugekommenen Raum (grün); „(Abr)“ für eine fehlende Lehrkraft ohne Vertretung bzw. „(5b)“ für eine fehlende Klasse
/// (rot). Auf einer entfallenen Stunde ist alles grau durchgestrichen – nur die fehlende Klasse bleibt als rotes Feld.
/// Das Feld wird nie breiter als die Karte (eine Zeile, verkleinert bzw. gekürzt).
struct Kartenwert: View {
    let zeile: Kachelzeile
    let karte: Karte?
    var entfall: Bool = false
    var schrift: Font = .system(size: 11)
    var farbe: Color = Farben.text2

    /// Rot, wenn nur Fehlendes (durchgestrichen bzw. offen) und nichts Neues in der Zeile steht.
    private var ton: Chipton {
        zeile.teile.contains { $0.stil == .plakette } ? .aenderung : .entfall
    }

    /// Entfallene Stunde mit fehlender Klasse: die Klassenzeile bleibt als rotes Feld „(5b)“.
    private var fehlendeKlasse: Bool {
        entfall && zeile.schluessel == "klasse" && zeile.teile.contains { $0.stil == .weg || $0.stil == .offen }
    }

    var body: some View {
        if fehlendeKlasse {
            Chipfeld(ton: .entfall) {
                Kartenwert.aenderungsText(zeile, karte: karte).font(schrift)
            }
        } else if !entfall && !zeile.nurText {
            Chipfeld(ton: ton) {
                Kartenwert.aenderungsText(zeile, karte: karte).font(schrift)
            }
        } else {
            Text(zeile.text)
                .font(schrift)
                .foregroundStyle(entfall ? Farben.text3 : farbe)
                .strikethrough(entfall, color: Farben.entfall.opacity(0.8))
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
    }

    /// Text im Feld: „+neu (alt)“ für ersetzte Werte, „+neu“ für hinzugekommene, „(alt)“ für fehlende bzw. weggefallene.
    static func aenderungsText(_ zeile: Kachelzeile, karte: Karte?) -> Text {
        let werte: [Wert]
        switch zeile.schluessel {
        case "lehrer": werte = karte?.lehrer ?? []
        case "raum": werte = karte?.raeume ?? []
        case "klasse": werte = (karte?.klassen ?? []) + (karte?.mitklassen ?? [])
        default: werte = []
        }
        func gleich(_ a: String, _ b: String) -> Bool { a.caseInsensitiveCompare(b) == .orderedSame }
        func plus(_ t: String) -> String { t.hasPrefix("+") ? t : "+" + t }
        let teile = zeile.teile
        var ergebnis = Text("")
        var i = 0
        while i < teile.count {
            let teil = teile[i]
            switch teil.stil {
            case .text:
                ergebnis = ergebnis + Text(teil.text)
            case .plakette:
                ergebnis = ergebnis + Text(plus(teil.text)).fontWeight(.semibold)
                let kern = teil.text.hasPrefix("+") ? String(teil.text.dropFirst()) : teil.text
                if let alt = werte.first(where: { $0.ersetzt && gleich($0.k, kern) })?.alt, !alt.isEmpty {
                    ergebnis = ergebnis + Text(" (\(alt))")
                }
            case .weg:
                // „alt | neu“ (Kopplung) wird zu „+neu (alt)“
                if i + 1 < teile.count && teile[i + 1].stil == .plakette {
                    let neu = teile[i + 1]
                    ergebnis = ergebnis + Text(plus(neu.text)).fontWeight(.semibold) + Text(" (\(teil.text))") + Text(neu.trenner)
                    i += 2
                    continue
                }
                ergebnis = ergebnis + Text("(\(teil.text))")
            case .offen:
                ergebnis = ergebnis + Text("(\(teil.text))").fontWeight(.semibold)
            }
            ergebnis = ergebnis + Text(teil.trenner)
            i += 1
        }
        return ergebnis
    }
}
