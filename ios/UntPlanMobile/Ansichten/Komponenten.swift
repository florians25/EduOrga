import SwiftUI

// MARK: - Werte als Text

/// Werte (Lehrkräfte, Klassen, Räume) als Text: alter Wert durchgestrichen, geänderter Wert petrolfarben unterstrichen.
/// `offen`: Lehrkräfte einer offenen Vertretung – die abwesende Lehrkraft ohne neuen Wert steht durchgestrichen in Petrol.
func werteText(_ werte: [Wert], trenner: String = ", ", offen: Bool = false) -> Text {
    var ergebnis = Text("")
    for (i, w) in werte.enumerated() {
        if i > 0 { ergebnis = ergebnis + Text(trenner) }
        if offen, w.k.isEmpty, w.neu || !(w.alt ?? "").isEmpty {
            let alt = w.alt ?? ""
            ergebnis = ergebnis + offenText(alt.isEmpty ? "???" : alt)
            continue
        }
        if let alt = w.alt, !alt.isEmpty, alt.caseInsensitiveCompare(w.k) != .orderedSame {
            ergebnis = ergebnis + Text(alt).strikethrough(true, color: Farben.text3).foregroundColor(Farben.text3)
            if !w.k.isEmpty { ergebnis = ergebnis + Text(" ") }
        }
        if w.geaendert {
            ergebnis = ergebnis + geaendertText(w.k)
        } else {
            ergebnis = ergebnis + Text(w.k)
        }
    }
    return ergebnis
}

/// Geänderter Wert: petrolfarben und unterstrichen.
func geaendertText(_ text: String) -> Text {
    Text(text)
        .foregroundColor(Farben.aenderung)
        .underline(true, color: Farben.aenderung)
        .fontWeight(.medium)
}

/// Offene Vertretung: abwesende Lehrkraft durchgestrichen in Petrol – als Text, damit er sich mit anderen Texten verbinden lässt.
func offenText(_ text: String) -> Text {
    Text(text)
        .foregroundColor(Farben.aenderung)
        .strikethrough(true, color: Farben.aenderung)
        .fontWeight(.medium)
}

/// Offene Vertretung erkennen: Karte „offen“ bzw. Lehrkraft ohne neuen Wert mit gesetztem alten Wert (nicht bei Entfall).
func istOffeneVertretung(_ karte: Karte) -> Bool {
    karte.istOffeneVertretung
}

/// Werte als einfacher Text (ohne Hervorhebung).
func werteKurz(_ werte: [Wert]) -> String {
    werte.map(\.k).filter { !$0.isEmpty }.joined(separator: ", ")
}

/// Zeilen einer Karte je nach Planart: Klassenplan zeigt Lehrkraft und Raum, Lehrerplan Klasse und Raum, Raumplan Klasse und Lehrkraft.
func kartenzeilen(_ karte: Karte, typ: String) -> [[Wert]] {
    switch typ {
    case "lehrer": return [karte.klassen, karte.raeume]
    case "raum": return [karte.klassen, karte.lehrer]
    default: return [karte.lehrer, karte.raeume]
    }
}

// MARK: - Hinweise und Plaketten

/// Fehlerzeile: Symbol und Text in der Entfall-Farbe auf heller Fläche mit feinem Rand.
struct Fehlerhinweis: View {
    let text: String

    var body: some View {
        Label(text, systemImage: "exclamationmark.triangle")
            .font(.subheadline)
            .foregroundStyle(Farben.entfall)
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Farben.entfallFlaeche, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .strokeBorder(Farben.entfall.opacity(0.25), lineWidth: 1)
            }
    }
}

/// Plakette (Entfall, Änderung, Prüfung …): 11 pt Großbuchstaben mit etwas Laufweite, Fläche und Schrift in der
/// Statusfarbe, Radius 3 pt.
struct Plakette: View {
    let text: String
    let farbe: Color
    /// Fläche (nil = Statusfarbe mit 12 % Deckkraft)
    var flaeche: Color? = nil
    /// Kleinere Plakette für Stundenkacheln
    var klein: Bool = false

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: klein ? 9.5 : 11, weight: .semibold))
            .tracking(klein ? 0.3 : 0.44)
            .foregroundStyle(farbe)
            .lineLimit(1)
            .padding(.horizontal, klein ? 3.5 : 6)
            .padding(.vertical, klein ? 1 : 2)
            .background(flaeche ?? farbe.opacity(0.12), in: RoundedRectangle(cornerRadius: 3, style: .continuous))
            .fixedSize()
            .accessibilityLabel(text)
    }
}

/// Runder Kreis mit Initialen (Marine auf heller Marine-Fläche).
struct Initialen: View {
    let name: String
    var groesse: CGFloat = 40
    /// Fertige Initialen (z. B. vom Server); nil = aus dem Namen bilden
    var vorgabe: String? = nil

    var body: some View {
        Text(vorgabe.map { String($0.prefix(3)) } ?? Self.kuerzel(name))
            .font(.system(size: groesse * 0.38, weight: .semibold))
            .foregroundStyle(Farben.akzent)
            .frame(width: groesse, height: groesse)
            .background(Farben.primaerFlaeche, in: Circle())
            .accessibilityHidden(true)
    }

    /// "Muster Erika" wird zu "ME".
    static func kuerzel(_ name: String) -> String {
        let teile = name.split(whereSeparator: { $0 == " " || $0 == "-" }).filter { !$0.isEmpty }
        guard let erstes = teile.first?.first else { return "?" }
        var s = String(erstes)
        if teile.count > 1, let zweites = teile[1].first { s.append(zweites) }
        return s.uppercased()
    }
}

/// Zahl in einer neutralen Kapsel (Zahl der Termine, Hausaufgaben …).
struct ZahlPlakette: View {
    let zahl: Int

    var body: some View {
        Text("\(zahl)")
            .font(.system(size: 13, weight: .semibold))
            .monospacedDigit()
            .foregroundStyle(Farben.text2)
            .padding(.horizontal, 7)
            .frame(minWidth: 22, minHeight: 22)
            .background(Farben.neutralFlaeche, in: Capsule())
    }
}

// MARK: - Karten

/// Fläche mit feinem Rand statt Schatten (Radius 8 pt).
struct Kartenhintergrund: ViewModifier {
    var radius: CGFloat = 8

    func body(content: Content) -> some View {
        content
            .background(Farben.flaeche, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .strokeBorder(Farben.rand, lineWidth: 1)
            }
    }
}

extension View {
    func alsKarte(radius: CGFloat = 8) -> some View {
        modifier(Kartenhintergrund(radius: radius))
    }

    /// Inhalt mittig mit höchstens dieser Breite (iPad: nicht über die ganze Breite).
    func zentriert(maxBreite: CGFloat = 700) -> some View {
        frame(maxWidth: maxBreite)
            .frame(maxWidth: .infinity)
    }
}

// MARK: - Knöpfe in Leisten, Konto

/// Symbolknopf in einer Kopfleiste: Symbol in der Akzentfarbe, 44 pt Tippfläche, ohne Hintergrund.
struct Leistenknopf<Inhalt: View>: View {
    @ViewBuilder let inhalt: () -> Inhalt

    var body: some View {
        inhalt()
            .font(.system(size: 17, weight: .regular))
            .foregroundStyle(Farben.akzent)
            .frame(minWidth: 32, minHeight: 32)
            .contentShape(Rectangle())
    }
}

/// Initialen des angemeldeten Kontos als Knopfbeschriftung (Konto wechseln).
struct KontoSymbol: View {
    @EnvironmentObject var zustand: AppZustand
    var groesse: CGFloat = 30

    var body: some View {
        Initialen(name: zustand.benutzer?.name ?? zustand.benutzer?.login ?? "?", groesse: groesse)
    }
}

/// Öffnet die Kontenauswahl (mehrere Konten gleichzeitig angemeldet – wechseln ohne Abmelden, Konto hinzufügen bzw.
/// entfernen).
struct KontoMenue<Beschriftung: View>: View {
    @EnvironmentObject var zustand: AppZustand
    @State private var zeigen = false
    @Environment(\.horizontalSizeClass) private var groessenklasse
    @ViewBuilder let beschriftung: () -> Beschriftung

    var body: some View {
        Button {
            zeigen = true
        } label: {
            beschriftung()
        }
        .accessibilityLabel("Konto wechseln")
        .accessibilityHint("Öffnet die Kontenauswahl")
        .blattPraesentation(isPresented: $zeigen, breit: groessenklasse == .regular) {
            KontenauswahlView()
                .environmentObject(zustand)
        }
    }
}

/// Konto-Knopf in der Navigationsleiste: Initialen des Kontos, öffnet die Kontenauswahl.
struct KontoKnopf: View {
    var body: some View {
        KontoMenue {
            KontoSymbol()
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Zeilen

/// Zeile einer gruppierten Fläche: Symbol links, Titel (und Untertitel), Zahl, Pfeil.
struct Listenzeile: View {
    let symbol: String
    let titel: String
    var untertitel: String? = nil
    var zahl: Int? = nil
    var pfeil: Bool = true
    var titelFarbe: Color = Farben.text

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 17, weight: .regular))
                .foregroundStyle(Farben.akzent)
                .frame(width: 26)
            VStack(alignment: .leading, spacing: 2) {
                Text(titel)
                    .font(.body)
                    .foregroundStyle(titelFarbe)
                    .lineLimit(1)
                if let untertitel, !untertitel.isEmpty {
                    Text(untertitel)
                        .font(.footnote)
                        .foregroundStyle(Farben.text2)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
            }
            Spacer(minLength: 4)
            if let zahl {
                ZahlPlakette(zahl: zahl)
            }
            if pfeil {
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Farben.pfeil)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .frame(minHeight: 48)
        .contentShape(Rectangle())
    }
}

/// Trennlinie zwischen Listenzeilen (eingerückt bis hinter das Symbol).
struct Zeilentrenner: View {
    var body: some View {
        Rectangle()
            .fill(Farben.rand)
            .frame(height: 0.5)
            .padding(.leading, 54)
    }
}

/// Gruppierte Fläche mit feinem Rand.
struct Zeilengruppe<Inhalt: View>: View {
    @ViewBuilder let inhalt: () -> Inhalt

    var body: some View {
        VStack(spacing: 0) {
            inhalt()
        }
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        .alsKarte(radius: 8)
    }
}

/// Zeile einer Fläche: beim Drücken leicht grau hinterlegt.
struct ZeilenKnopfStil: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(configuration.isPressed ? Farben.neutralFlaeche : Color.clear)
    }
}

// MARK: - Segmentschalter

/// Segmentschalter für Ansichtswechsel und Filter – der native Schalter des Systems.
struct Segmentschalter<Wert: Hashable>: View {
    struct Eintrag {
        let wert: Wert
        let titel: String
    }

    @Binding var auswahl: Wert
    let eintraege: [Eintrag]

    /// Einträge als (Wert, Titel).
    init(auswahl: Binding<Wert>, _ eintraege: [(Wert, String)]) {
        _auswahl = auswahl
        self.eintraege = eintraege.map { Eintrag(wert: $0.0, titel: $0.1) }
    }

    var body: some View {
        Picker("Auswahl", selection: $auswahl) {
            ForEach(Array(eintraege.enumerated()), id: \.offset) { _, eintrag in
                Text(eintrag.titel).tag(eintrag.wert)
            }
        }
        .pickerStyle(.segmented)
        .labelsHidden()
    }
}

// MARK: - Ladebalken

/// Schmaler Fortschrittsbalken (2 pt, unbestimmt) direkt unter einer Kopfzeile: ein Segment in Marine läuft gleichmäßig
/// über eine blasse Spur. Nimmt keine Antippen an.
struct Ladebalken: View {
    let aktiv: Bool
    var hoehe: CGFloat = 2

    var body: some View {
        ZStack {
            if aktiv {
                LadebalkenLauf(hoehe: hoehe)
                    .transition(.opacity)
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: hoehe)
        .animation(.linear(duration: 0.12), value: aktiv)
        .allowsHitTesting(false)
        .accessibilityElement()
        .accessibilityLabel(aktiv ? "Wird geladen" : "")
        .accessibilityHidden(!aktiv)
    }
}

/// Laufendes Segment des Ladebalkens (Zeitachse statt Zustand – läuft ohne Neustart weiter, solange sichtbar).
private struct LadebalkenLauf: View {
    let hoehe: CGFloat
    private let dauer: Double = 1.2

    var body: some View {
        GeometryReader { geo in
            TimelineView(.animation) { kontext in
                let w = geo.size.width
                let t = kontext.date.timeIntervalSinceReferenceDate
                let p = t.truncatingRemainder(dividingBy: dauer) / dauer
                let segment = w * 0.3
                let x = -segment + (w + segment) * CGFloat(p)
                ZStack(alignment: .leading) {
                    Rectangle()
                        .fill(Farben.akzent.opacity(0.15))
                    Rectangle()
                        .fill(Farben.akzent)
                        .frame(width: max(segment, 1), height: hoehe)
                        .offset(x: x)
                }
                .frame(width: w, height: hoehe, alignment: .leading)
                .clipped()
            }
        }
        .frame(height: hoehe)
    }
}

// MARK: - Signet

/// Signet von UntPlan (wie `design/logo/mark.svg`): Marine-Fläche mit einem 3×3-Raster aus Stundenfeldern, ein
/// durchgehender Doppelblock in der Mitte und ein hervorgehobenes Feld unten rechts. Flach, ohne Verläufe.
struct Signet: View {
    var groesse: CGFloat = 64

    var body: some View {
        let s = groesse / 64
        ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: 14 * s, style: .continuous)
                .fill(Color(hexWert: 0x1C3F7A))
            feld(14, 14, 10, 1, s)
            feld(27, 14, 10, 0.32, s)
            feld(40, 14, 10, 0.32, s)
            feld(14, 27, 10, 0.32, s)
            feld(27, 27, 23, 1, s)
            feld(14, 40, 10, 0.32, s)
            feld(27, 40, 10, 0.32, s)
            RoundedRectangle(cornerRadius: 2 * s, style: .continuous)
                .fill(Color(hexWert: 0x8FB4EA))
                .frame(width: 10 * s, height: 10 * s)
                .offset(x: 40 * s, y: 40 * s)
        }
        .frame(width: groesse, height: groesse, alignment: .topLeading)
        .accessibilityLabel("UntPlan")
    }

    private func feld(_ x: CGFloat, _ y: CGFloat, _ breite: CGFloat, _ deckkraft: Double, _ s: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: 2 * s, style: .continuous)
            .fill(Color.white.opacity(deckkraft))
            .frame(width: breite * s, height: 10 * s)
            .offset(x: x * s, y: y * s)
    }
}

// MARK: - Leerer Zustand

/// Leerer Zustand bzw. Hinweisfläche (frei, Ferien, gesperrter Zeitraum): ein Linien-Symbol, ein Titel und ein Satz,
/// zentriert auf einer ruhigen Fläche mit feinem Rand.
struct Hinweisfeld: View {
    let titel: String
    let text: String
    var symbol: String = "calendar"
    /// Mindesthöhe der Fläche
    var minHoehe: CGFloat = 0
    /// Farbe der Fläche
    var flaeche: Color = Farben.flaeche2
    /// Symbol- und Titelfarbe (z. B. Ferien in der Ferienfarbe)
    var tonfarbe: Color? = nil

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: symbol)
                .font(.system(size: 22, weight: .regular))
                .foregroundStyle(tonfarbe ?? Farben.text3)
                .accessibilityHidden(true)
            Text(titel)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(tonfarbe ?? Farben.text)
                .multilineTextAlignment(.center)
            if !text.isEmpty {
                Text(text)
                    .font(.footnote)
                    .foregroundStyle(Farben.text2)
                    .multilineTextAlignment(.center)
                    .lineLimit(3)
            }
        }
        .fixedSize(horizontal: false, vertical: true)
        .padding(.horizontal, 16)
        .padding(.vertical, 18)
        .frame(maxWidth: .infinity, minHeight: minHoehe)
        .background(flaeche, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .strokeBorder(Farben.rand, lineWidth: 1)
        }
        .accessibilityElement(children: .combine)
    }
}
