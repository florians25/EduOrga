import SwiftUI

// Gestaltung der Stundenkarten (Woche, Tag, Zeitachse) – „Stundenkarte mobil (v4)“: kompakte Karte, die ihre Zelle füllt
// (nie breiter als die Spalte), standardmäßig neutral (weiß bzw. hellgrau mit grauem Balken links; Fachfarbe nur, wenn die
// Schule eine gesetzt hat), Fach fett oben links, darunter Klasse, Lehrkraft und Raum je eine kurze Zeile.
//
// Maße (v6, gleich in Web und PWA, siehe `Kartenmass`): Radius 4, Leiste links 5 pt bündig am Rand (innen eckig), Kontur
// 1,5 pt in kräftigerem Neutralgrau bzw. in der Statusfarbe.
//
// Kennzeichnung von Änderungen (EduOrga-eigene Formensprache, sachlich): ein durchgehender 5-pt-Balken links in der
// Statusfarbe, eine kleine Statusmarke oben rechts und ein kompaktes Kennzeichen (Radius 3, getönt mit feiner Kontur) auf
// der betroffenen Zeile – in Worten, ohne Pfeile: der neue Wert, dahinter der bisherige in Klammern und durchgestrichen
// („Gal (G̶o̶r̶)“, `Wertwechsel`). Grün (#2f855a für Balken/Linien, Kennzeichen #e6f4ea
// mit Schrift #1d5c3a – 7,0 : 1) für jede Änderung, Rot (#b42318, Kennzeichen #fdecea) NUR für den Entfall – dann ist
// zusätzlich alles auf der Karte durchgestrichen. Offene Vertretungen und fehlende Werte ohne Entfall sind neutral grau
// (Kennzeichen #ebeef2, Schrift #4d5866 – 6,2 : 1, gestrichelte Kontur), für Schüler*innen und Eltern „Vertretung folgt“.
//
// Barrierefreiheit: Kennzeichen mindestens so groß wie die übrigen Zeilen (12 pt, halbfett), alle Texte WCAG AA, nie nur
// Farbe (Wörter „statt“, „fehlt“, „entfällt“, „zusätzlich“, „verlegt auf/von“, Durchstreichen des bisherigen Werts), Schrift und Zeilen wachsen mit Dynamic Type
// (`kartenfaktor`) – bei großen Größen weniger Zeilen, Änderungen zuerst; VoiceOver liest je Karte einen ganzen Satz
// (`vorlesetext`).
//
//   Vertretung                   „Gal (G̶o̶r̶)“ auf der Lehrerzeile (neu, bisher in Klammern durchgestrichen)
//   Raumänderung                 „105 (3̶0̶3̶)“ auf der Raumzeile, hinzugekommen „neu B070“
//   Fachänderung                 „BI (M̶U̶)“ auf der Fachzeile
//   Lehrkraft fehlt, offen       „Abr fehlt“ (grau, gestrichelt; Familie: „Vertretung folgt“)
//   Entfall                      „entfällt“ (rot), alles durchgestrichen
//   Klasse fehlt                 „5b fehlt“ und „entfällt“
//   Verlegt (weg)                „verlegt auf Di 21.10., 6. Std“ (rot, Karte durchgestrichen)
//   Verlegt (hierher)            „verlegt von Mo 20.10., 3. Std“
//   Zusatzunterricht             „zusätzlich“
//   Mitteilung, Veranstaltung    hellgelber Block, Titel einzeilig mit „…“
//
// Die schulweite Kartendarstellung (Feld `darstellung` der Sitzung) steuert Fach als Kürzel/Name, Raum, Zeile 2,
// Statuswörter, Fachfarbe an/aus, Tönung und Statusfläche.

// MARK: - Maße

/// Maße der Stundenkarte (design/DESIGN.md, Abschnitt 10 „Stundenkarte v7“) – dieselben Werte in px für EduOrga Web
/// (`web/client/src/components/plan/Kachel.tsx`) und die PWA (`app.css`, Abschnitt „Stundenkarte v7“).
///
/// v7 („EduOrga Standard“, Fachfarbe „balken-oben“): fast rechteckige Karte (Radius 2), feine neutrale 1-pt-Linie, **kein
/// Streifen bei regulärem Unterricht**; der Status steht als **Streifen oben** (3 pt, volle Breite, bündig, eckig): geändert
/// Grün, Entfall Rot, Prüfung Bernstein; Fachfarbe (falls die Schule eine gesetzt hat) als Streifen der neutralen Karte.
/// Die Vorlage „Klassisch“ (Fachfarbe „balken-links“ usw.) behält die Leiste links (`leiste`).
enum Kartenmass {
    /// Eckenradius (fast rechteckig, nie mehr als 3)
    static let radius: CGFloat = 2
    /// Statusstreifen oben (v7): volle Breite, bündig im Rand, eckig
    static let streifen: CGFloat = 3
    /// Leiste links der Vorlage „Klassisch“: bündig am Kartenrand, volle Höhe, innen eckig (Fach-, Status- bzw. Grau)
    static let leiste: CGFloat = 5
    /// Kontur der Karte (neutral `Farben.karteLinie`; Status in der leicht getönten Statusfarbe)
    static let linie: CGFloat = 1
    /// Kennzeichen oben rechts (Quadrat, nur „Klassisch“)
    static let kennzeichen: CGFloat = 5
    /// Abstand zwischen Karten im Raster
    static let abstand: CGFloat = 2
}

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

    /// Kennzeichen unten auf der Karte: „entfällt“, „verlegt auf Di 21.10., 6. Std“, „verlegt von Mo 20.10., 3. Std“,
    /// „zusätzlich“ – nil bei Unterricht ohne solche Änderung, Terminen, Aufsichten und Bereitschaften.
    var statusChip: Kartenchip? {
        guard let k = karte, !inPause else { return nil }
        switch art {
        case .normal, .aenderung, .entfall, .abgegeben: break
        default: return nil
        }
        let weg = kartenart == .entfall
        if k.verlegung == "von", art == .entfall || art == .abgegeben || weg {
            if let ziel = k.verlegungNach, let t = Kartenchip.termin(ziel) {
                return Kartenchip(text: "verlegt auf \(t)", ton: .entfall)
            }
            return Kartenchip(text: "verlegt", ton: .entfall)
        }
        if weg { return Kartenchip(text: "entfällt", ton: .entfall) }
        if k.verlegung == "nach", art == .aenderung || art == .normal {
            if let quelle = k.verlegungVon, let t = Kartenchip.termin(quelle) {
                return Kartenchip(text: "verlegt von \(t)", ton: .aenderung)
            }
            return Kartenchip(text: "hierher verlegt", ton: .aenderung)
        }
        if zusatz || (art == .aenderung && k.istZusatzstunde) {
            return Kartenchip(text: "zusätzlich", ton: .aenderung, vorlesen: "zusätzliche Stunde")
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

/// Stundenkarte mobil (v6, EduOrga-Kennzeichnung): die Karte füllt ihre Zelle, Radius 4, neutral (weiß, grauer Balken
/// 5 pt, Kontur 1,5 pt), Fachfarbe nur, wenn die Schule eine gesetzt hat (Balken und leichte Tönung). Änderung: durchgehender
/// grüner 5-pt-Balken, grüne Kontur 1,5 pt, grüne Statusmarke und das Kennzeichen „neu (b̶i̶s̶h̶e̶r̶)“ auf der Zeile; Entfall: roter Balken und rote
/// Marke, alles grau durchgestrichen, „entfällt“ rot; offene Vertretung neutral (grauer Balken, gestrichelte graue Kontur,
/// „Abr fehlt“ bzw. „Vertretung folgt“); Prüfung Bernstein; Termin/Buchung gestrichelt; Mitteilung bzw. Veranstaltung als
/// hellgelber Block. Kein Schatten – die Kontur trennt die Karte vom Raster.
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
    /// Früher: schraffierter Balken. Bleibt als Merkmal „geändert“, gezeichnet wird immer ein durchgehender Balken.
    var gestreift: Bool = false
    /// Kleine Statusmarke oben rechts (Änderung grün, Entfall rot, offen grau); nil = keine
    var marke: Color? = nil
    /// Offene Vertretung bzw. offener Raum: „?“ an der Karte
    var offen: Bool = false
    /// Farbe der ersten Zeile
    var titel: Color = Farben.text
    /// Stundenkarte v7: Status- bzw. Fachfarbe als Streifen oben statt der Leiste links
    var oben: Bool = false
    /// Farbe des Streifens oben (nil = kein Streifen – reguläre Stunde ohne Fachfarbe, offene Vertretung, Termin)
    var streifen: Color? = nil

    /// Abstand des Inhalts vom oberen Rand, damit alle v7-Karten dieselbe Grundlinie haben (mit oder ohne Streifen).
    var obenEinzug: CGFloat { oben ? Kartenmass.streifen : 0 }

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
        var s = Klassikstil(balken: fach ?? Farben.balkenGrau, flaeche: Farben.karte, rand: nil, strich: StrokeStyle(lineWidth: Kartenmass.linie),
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
            s.schraffur = false
            s.gedaempft = true
            s.rand = Farben.entfall.opacity(0.55)
            s.titel = Farben.text3
            s.marke = Farben.entfall
        case .aenderung:
            s.balken = Farben.aenderung
            s.gestreift = true
            s.rand = Farben.aenderung.opacity(0.8)
            s.marke = Farben.aenderung
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
                s.strich = StrokeStyle(lineWidth: Kartenmass.linie, dash: [3, 2])
                s.titel = Farben.termin
            }
        case .buchung:
            s.ton = nil
            s.mitBalken = false
            s.rand = Farben.frei.opacity(0.8)
            s.strich = StrokeStyle(lineWidth: Kartenmass.linie, dash: [3, 2])
            s.titel = Farben.frei
        case .abwesend:
            s.ton = nil
            s.mitBalken = false
            s.rand = Farben.text3
            s.strich = StrokeStyle(lineWidth: Kartenmass.linie, dash: [2, 2])
            s.gedaempft = true
        case .neutral:
            s.ton = nil
            s.flaeche = Farben.flaeche2
            s.mitBalken = false
            if k.art == .bereitschaft {
                s.rand = Farben.randStark
                s.strich = StrokeStyle(lineWidth: Kartenmass.linie, dash: [3, 2])
            }
        }
        if art == .pruefung {
            // Prüfung: Leiste bzw. Streifen immer Bernstein (nie grau)
            s.balken = Farben.pruefungStreifen
        }
        if offen && art != .entfall {
            // Lehrkraft fehlt, Vertretung noch nicht erstellt: bewusst neutral (nicht rot – das hieße „Entfall“) – normale
            // Karte, grauer Balken, gestrichelter grauer Rand, „(Abr)“ bzw. „Vertretung folgt“ als graues Feld
            s.balken = Farben.balkenGrau
            s.gestreift = false
            s.rand = Farben.text3
            s.strich = StrokeStyle(lineWidth: Kartenmass.linie, dash: [3, 2])
            s.marke = Farben.text3
            if d.statusflaeche {
                s.ton = nil
                s.flaeche = Farben.karte
            }
        }
        if d.balkenOben {
            v7(&s, art: art, offen: offen, fach: fach)
        }
        return s
    }

    /// Stundenkarte v7: Streifen oben statt Leiste links, keine Marke; neutral ohne Streifen (außer mit Fachfarbe).
    private static func v7(_ s: inout Klassikstil, art: Kartenart, offen: Bool, fach: Color?) {
        s.oben = true
        s.mitBalken = false
        s.marke = nil
        s.streifen = nil
        switch art {
        case .normal:
            s.streifen = fach
            if offen { s.streifen = nil }
        case .aenderung:
            s.streifen = offen ? nil : Farben.aenderung
            if !offen { s.rand = Farben.aenderung.opacity(0.45) }
        case .entfall:
            s.streifen = Farben.entfall
            s.flaeche = Farben.entfallFlaeche
            s.rand = Farben.entfall.opacity(0.35)
            s.titel = Farben.entfallChipText
            s.gedaempft = false
        case .pruefung:
            s.streifen = Farben.pruefungStreifen
            s.ton = nil
            s.flaeche = Farben.pruefungFlaeche
            s.rand = Farben.pruefungStreifen.opacity(0.5)
        case .termin, .buchung, .abwesend, .neutral:
            break
        }
        if s.rand != nil, s.strich.dash.isEmpty {
            s.strich = StrokeStyle(lineWidth: Kartenmass.linie)
        }
    }
}

/// Balken links an der Karte: immer durchgehend in der Fach- bzw. Statusfarbe (keine Schraffur).
struct Kartenbalken: View {
    let farbe: Color
    /// Ohne Wirkung (früher schraffiert) – der Status steht in Farbe, Marke und Kennzeichen
    var gestreift: Bool = false

    var body: some View {
        Rectangle().fill(farbe)
    }
}

/// Kleine Statusmarke oben rechts auf der Karte: ein eckiges Quadrat 5 × 5 pt in der Statusfarbe.
struct Kartenmarke: View {
    let farbe: Color

    var body: some View {
        Rectangle()
            .fill(farbe)
            .frame(width: Kartenmass.kennzeichen, height: Kartenmass.kennzeichen)
            .accessibilityHidden(true)
    }
}

extension View {
    /// Fläche, Tönung, Kontur (1,5 pt bzw. gestrichelt) und darüber die Leiste – bündig am linken Rand, volle Höhe, von der
    /// Kartenform beschnitten (außen der Radius, innen eckig). Geänderte, entfallene und offene Karten (mit Kennzeichen)
    /// haben immer mindestens die Standardleiste von 5 pt.
    func klassikKarte(_ s: Klassikstil, radius: CGFloat = Kartenmass.radius, balkenBreite: CGFloat = Kartenmass.leiste) -> some View {
        let form = RoundedRectangle(cornerRadius: s.oben ? min(radius, 3) : radius, style: .circular)
        let leiste: CGFloat = s.marke != nil ? max(balkenBreite, Kartenmass.leiste) : balkenBreite
        return self
            .background {
                ZStack {
                    form.fill(s.flaeche)
                    if let ton = s.ton {
                        form.fill(ton)
                    }
                }
            }
            .overlay {
                if let rand = s.rand {
                    form.strokeBorder(rand, style: s.strich)
                } else {
                    form.strokeBorder(Farben.karteLinie, lineWidth: Kartenmass.linie)
                }
            }
            .overlay(alignment: .top) {
                if s.oben, let streifen = s.streifen {
                    Rectangle()
                        .fill(streifen)
                        .frame(height: Kartenmass.streifen)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                        .clipShape(form)
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)
                }
            }
            .overlay(alignment: .leading) {
                if s.mitBalken {
                    Kartenbalken(farbe: s.balken, gestreift: s.gestreift)
                        .frame(width: leiste)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
                        .clipShape(form)
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)
                }
            }
            .overlay(alignment: .topTrailing) {
                if let marke = s.marke {
                    Kartenmarke(farbe: marke)
                        .padding(.top, 4)
                        .padding(.trailing, 4)
                }
            }
            .overlay(alignment: .bottomTrailing) {
                if s.offen {
                    Text("?")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(Farben.text2)
                        .frame(width: 13, height: 13)
                        .overlay {
                            RoundedRectangle(cornerRadius: 2, style: .circular)
                                .strokeBorder(Farben.text3, style: StrokeStyle(lineWidth: 1, dash: [2, 1.5]))
                        }
                        .padding(3)
                        .accessibilityHidden(true)
                }
            }
    }
}

// MARK: - Felder (Chips)

/// Farbe eines Feldes auf der Karte: Änderung (grün), Entfall (rot) bzw. offen/fehlend ohne Entfall (neutral grau,
/// gestrichelt). Alle Kombinationen erfüllen WCAG AA (≥ 4,5 : 1).
enum Chipton: Hashable {
    case aenderung
    case entfall
    case offen

    var flaeche: Color {
        switch self {
        case .aenderung: return Farben.aenderungChip
        case .entfall: return Farben.entfallChip
        case .offen: return Farben.offenChip
        }
    }

    var schrift: Color {
        switch self {
        case .aenderung: return Farben.aenderungSchrift
        case .entfall: return Farben.entfallChipText
        case .offen: return Farben.offenChipText
        }
    }

    var rand: Color {
        switch self {
        case .aenderung: return Farben.aenderung.opacity(0.55)
        case .entfall: return Farben.entfall.opacity(0.45)
        case .offen: return Farben.text3
        }
    }

    /// Gestrichelter Rand (offen) statt durchgezogen.
    var gestrichelt: Bool { self == .offen }
}

extension DynamicTypeSize {
    /// Schriftfaktor der Stundenkarten im Raster (Dynamic Type): wächst mit der Systemschrift, gedeckelt, damit die Karte
    /// lesbar bleibt (bei großen Größen zeigt sie dafür weniger Zeilen – Änderungen zuerst).
    var kartenfaktor: CGFloat {
        switch self {
        case .xSmall: return 0.92
        case .small: return 0.96
        case .medium, .large: return 1
        case .xLarge: return 1.08
        case .xxLarge: return 1.16
        case .xxxLarge: return 1.24
        case .accessibility1: return 1.36
        case .accessibility2: return 1.48
        default: return 1.6
        }
    }

    /// Faktor der Zeilenhöhe des Rasters: wächst langsamer als die Schrift (große Schrift = weniger Zeilen je Karte,
    /// statt eines endlos hohen Rasters).
    var rasterfaktor: CGFloat { 1 + (kartenfaktor - 1) * 0.6 }
}

/// Feld unten auf der Karte („× entfällt“, „⊕ Zusatz“ …).
struct Kartenchip: Hashable {
    let text: String
    let ton: Chipton
    /// Text für VoiceOver (nil = wie `text`)
    var vorlesen: String? = nil

    var gesprochen: String { vorlesen ?? text }

    /// Kurzform einer Verlegungsseite: „Di 21.10., 6. Std“ (ohne Stunde mit Uhrzeit „Di 21.10., 12:20“).
    static func termin(_ s: Verlegungsseite) -> String? {
        guard !s.datum.isEmpty else { return nil }
        var tag = Datumsformat.anzeige(s.datum, "EEE")
        while tag.hasSuffix(".") { tag.removeLast() }
        var text = "\(tag) \(Datumsformat.anzeige(s.datum, "d.M."))"
        if let st = s.stunde {
            text += ", \(st). Std"
        } else if !s.beginn.isEmpty {
            text += ", " + s.beginn
        }
        return text
    }
}

/// Kennzeichen auf der Karte (Stundenkarte v7): **reiner Text in der Statusschrift**, halbfett – ohne Fläche und ohne
/// Rahmen (die Karte trägt den Status im Streifen oben). Eine Zeile, notfalls leicht verkleinert bzw. mit „…“ gekürzt, nie
/// breiter als die Karte.
struct Chipfeld<Inhalt: View>: View {
    let ton: Chipton
    @ViewBuilder let inhalt: () -> Inhalt

    var body: some View {
        inhalt()
            .fontWeight(.semibold)
            .foregroundStyle(ton.schrift)
            .lineLimit(1)
            .truncationMode(.tail)
            .minimumScaleFactor(0.85)
    }
}

/// Feld unten auf der Karte (Entfall, Verlegung, Zusatz).
struct Statuschip: View {
    let chip: Kartenchip
    var schrift: Font = .system(size: 12, weight: .semibold)

    var body: some View {
        Chipfeld(ton: chip.ton) {
            Text(chip.text)
                .font(schrift)
                .monospacedDigit()
        }
        .accessibilityHidden(true)
    }
}

/// Fach der Karte: unverändert als Text, bei einer Fachänderung als grünes Kennzeichen „BI (M̶U̶)“, bei Entfall grau und
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
                Wertwechsel.text(text, statt: alt, gewicht: nil, altSchrift: schrift.weight(.regular))
                    .font(schrift)
            }
        } else {
            Text(text)
                .font(schrift)
                .foregroundStyle(entfall ? Farben.entfallChipText : farbe)
                .strikethrough(entfall, color: Farben.entfall)
                .lineLimit(1)
                .truncationMode(.tail)
                .minimumScaleFactor(0.85)
        }
    }
}

// MARK: - Neuer und bisheriger Wert

/// Geänderter Wert in EduOrga-Schreibweise (Karten, Details, Heute, Agenda, Legende): zuerst der neue Wert (halbfett),
/// dahinter der bisherige in Klammern und durchgestrichen – „Gal (G̶o̶r̶)“, „105 (3̶0̶3̶)“, „BI (M̶U̶)“. Keine Pfeile. Nur die
/// Klammern bleiben ungestrichen, damit das Durchstreichen eindeutig dem bisherigen Wert gilt. VoiceOver liest „Gal statt
/// Gor“ (`gesprochen`) – die Aufrufer setzen das als zugänglichen Namen.
enum Wertwechsel {
    /// `gewicht`: Schriftstärke des neuen Werts (nil = wie die Umgebung); `altFarbe`: Farbe des bisherigen Werts (nil = wie
    /// die Umgebung); `altSchrift`: eigene Schrift des bisherigen Werts samt Klammern (nil = wie die Umgebung);
    /// `altGewicht`: Schriftstärke des bisherigen Werts samt Klammern (Standard normal, nil = wie die Umgebung).
    static func text(_ neu: String, statt alt: String, gewicht: Font.Weight? = .semibold, altFarbe: Color? = nil,
                     altSchrift: Font? = nil, altGewicht: Font.Weight? = .regular) -> Text {
        var neuText = Text(neu)
        if let gewicht { neuText = neuText.fontWeight(gewicht) }
        var altText = Text(alt).strikethrough(true, color: altFarbe)
        var auf = Text(" (")
        var zu = Text(")")
        if let altGewicht {
            altText = altText.fontWeight(altGewicht)
            auf = auf.fontWeight(altGewicht)
            zu = zu.fontWeight(altGewicht)
        }
        if let altFarbe {
            altText = altText.foregroundColor(altFarbe)
            auf = auf.foregroundColor(altFarbe)
            zu = zu.foregroundColor(altFarbe)
        }
        if let altSchrift {
            altText = altText.font(altSchrift)
            auf = auf.font(altSchrift)
            zu = zu.font(altSchrift)
        }
        return neuText + auf + altText + zu
    }

    /// Für VoiceOver und reine Texte: „Gal statt Gor“.
    static func gesprochen(_ neu: String, statt alt: String) -> String {
        "\(neu) statt \(alt)"
    }
}

// MARK: - Geänderter Wert als Feld

/// Eine Zeile der Stundenkarte (Lehrkraft, Klasse, Raum): unveränderte Werte als Text, geänderte als Kennzeichen –
/// „Gal (G̶o̶r̶)“ für eine Vertretung, „105 (3̶0̶3̶)“ für eine Raumänderung, „neu B070“ für einen hinzugekommenen Raum (grün);
/// „Abr fehlt“ für eine fehlende Lehrkraft ohne Vertretung (grau), „5b fehlt“ bzw. „ohne 303“ für Weggefallenes. Auf einer
/// entfallenen Stunde ist alles grau durchgestrichen – nur die fehlende Klasse bleibt als rotes Kennzeichen. Nie breiter
/// als die Karte (eine Zeile, notfalls mit „…“).
struct Kartenwert: View {
    let zeile: Kachelzeile
    let karte: Karte?
    var entfall: Bool = false
    var schrift: Font = .system(size: 12)
    var farbe: Color = Farben.text2

    @Environment(\.kartendarstellung) private var darstellung

    /// Grün, sobald etwas Neues in der Zeile steht; nur Fehlendes bzw. Offenes (ohne Entfall) neutral grau – Rot gibt es
    /// nur für den Entfall.
    private var ton: Chipton {
        zeile.teile.contains { $0.stil == .plakette } ? .aenderung : .offen
    }

    /// Offene Vertretung in der Lehrerzeile (nur fehlende Lehrkräfte, nichts Neues).
    private var vertretungOffen: Bool {
        zeile.schluessel == "lehrer" && zeile.teile.contains { $0.stil == .offen }
            && !zeile.teile.contains { $0.stil == .plakette }
    }

    /// Entfallene Stunde mit fehlender Klasse: die Klassenzeile bleibt als rotes Feld „(5b)“.
    private var fehlendeKlasse: Bool {
        entfall && zeile.schluessel == "klasse" && zeile.teile.contains { $0.stil == .weg || $0.stil == .offen }
    }

    var body: some View {
        if fehlendeKlasse {
            // „5b fehlt“ (die abwesende Klasse; übrige Klassen als Text)
            Chipfeld(ton: .entfall) {
                Text(zeile.teile.map { t in t.stil == .text ? t.text + t.trenner : t.text + " fehlt" + t.trenner }.joined())
                    .font(schrift)
            }
        } else if !entfall && vertretungOffen && darstellung.fuerFamilie {
            // Schüler*innen und Eltern: kein Kürzel der abwesenden Lehrkraft, sondern ein ruhiger Hinweis
            Chipfeld(ton: .offen) {
                Text("Vertretung folgt").font(schrift)
            }
        } else if !entfall && !zeile.nurText {
            Chipfeld(ton: ton) {
                Kartenwert.aenderungsText(zeile, karte: karte).font(schrift)
            }
        } else {
            Text(zeile.text)
                .font(schrift)
                .foregroundStyle(entfall ? Farben.text2 : farbe)
                .strikethrough(entfall, color: Farben.entfall.opacity(0.8))
                .lineLimit(1)
                .truncationMode(.tail)
                .minimumScaleFactor(0.85)
        }
    }

    /// Text im Kennzeichen: „neu (a̶l̶t̶)“ für ersetzte Werte, „neu X“ für hinzugekommene, „X fehlt“ für offene bzw. fehlende,
    /// „ohne X“ für weggefallene.
    static func aenderungsText(_ zeile: Kachelzeile, karte: Karte?) -> Text {
        let werte: [Wert]
        switch zeile.schluessel {
        case "lehrer": werte = karte?.lehrer ?? []
        case "raum": werte = karte?.raeume ?? []
        case "klasse": werte = (karte?.klassen ?? []) + (karte?.mitklassen ?? [])
        default: werte = []
        }
        func gleich(_ a: String, _ b: String) -> Bool { a.caseInsensitiveCompare(b) == .orderedSame }
        func kern(_ t: String) -> String { t.hasPrefix("+") ? String(t.dropFirst()) : t }
        let teile = zeile.teile
        var ergebnis = Text("")
        var i = 0
        while i < teile.count {
            let teil = teile[i]
            switch teil.stil {
            case .text:
                ergebnis = ergebnis + Text(teil.text)
            case .plakette:
                let neu = kern(teil.text)
                if let alt = werte.first(where: { $0.ersetzt && gleich($0.k, neu) })?.alt, !alt.isEmpty {
                    ergebnis = ergebnis + Wertwechsel.text(neu, statt: alt)
                } else {
                    ergebnis = ergebnis + Text("neu ") + Text(neu).fontWeight(.semibold)
                }
            case .weg:
                // „alt | neu“ (Kopplung) wird zu „neu (a̶l̶t̶)“
                if i + 1 < teile.count && teile[i + 1].stil == .plakette {
                    let neu = teile[i + 1]
                    ergebnis = ergebnis + Wertwechsel.text(kern(neu.text), statt: teil.text) + Text(neu.trenner)
                    i += 2
                    continue
                }
                ergebnis = ergebnis + Text("ohne \(teil.text)")
            case .offen:
                ergebnis = ergebnis + Text(teil.text == "???" ? "offen" : teil.text).fontWeight(.semibold) + Text(teil.text == "???" ? "" : " fehlt")
            }
            ergebnis = ergebnis + Text(teil.trenner)
            i += 1
        }
        return ergebnis
    }
}
