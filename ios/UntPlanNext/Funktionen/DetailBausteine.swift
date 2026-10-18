import SwiftUI
import UIKit

// MARK: - Wisch-Geste zum Zurückgehen

/// Bei verborgener Navigationsleiste (Detail-Unterseiten) schaltet UIKit die Rand-Wischgeste zum Zurückgehen ab.
/// Mit eigenem Delegate bleibt sie aktiv – aber nur, wenn es eine Seite zum Zurückgehen gibt.
extension UINavigationController: UIGestureRecognizerDelegate {
    override open func viewDidLoad() {
        super.viewDidLoad()
        interactivePopGestureRecognizer?.delegate = self
    }

    public func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        guard gestureRecognizer === interactivePopGestureRecognizer else { return true }
        return viewControllers.count > 1
    }
}

// MARK: - Blätter

/// Maße der Blätter auf dem iPad (Stundendetails mittig über dem Plan).
enum Detailblatt {
    static let breite: CGFloat = 620
    static let hoehe: CGFloat = 740
}

/// Tastatur schließen (Fokus abgeben) – z. B. beim Schließen eines Blatts, damit keine Einrückung hängen bleibt.
enum Tastatur {
    @MainActor
    static func schliessen() {
        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }
}

private struct BlattSchliessenSchluessel: EnvironmentKey {
    static let defaultValue: (@MainActor () -> Void)? = nil
}

extension EnvironmentValues {
    /// Eigene Schließen-Aktion eines Blatts (nil = Systemblatt, dann `dismiss`).
    var blattSchliessen: (@MainActor () -> Void)? {
        get { self[BlattSchliessenSchluessel.self] }
        set { self[BlattSchliessenSchluessel.self] = newValue }
    }
}

/// Größe eines Blatts.
enum Blattart {
    /// Stunden-, Aufsichtsdetails, Sprechtag: iPhone halb bzw. ganz hoch (Ziehgriff), iPad fest 620 × 740 pt
    case detail
    /// Planauswahl, Info, Formulare, Kontenauswahl: iPhone groß, iPad Formblatt des Systems
    case formular
}

/// Platzhalter-Element für Blätter, die über einen Schalter (Bool) gezeigt werden.
struct Blattschalter: Identifiable {
    var id: Int { 0 }
}

/// Gerät: iPad (auch innerhalb eines Formblatts, wo die Größenklasse kompakt meldet).
enum Geraet {
    @MainActor
    static var istPad: Bool { UIDevice.current.userInterfaceIdiom == .pad }
}

extension View {
    /// Blatt des Systems mit den Höhenstufen je Art: Stundendetails auf dem iPhone mittel und groß mit Ziehgriff,
    /// Formulare groß; auf dem iPad ein festes Detailblatt bzw. das Formblatt.
    func detailPraesentation<Item: Identifiable, Blatt: View>(item: Binding<Item?>, breit: Bool, art: Blattart = .detail,
                                                              @ViewBuilder blatt: @escaping (Item) -> Blatt) -> some View {
        sheet(item: item) { element in
            blatt(element)
                .environment(\.blattSchliessen, nil)
                .blattGroesse(art, breit: breit)
        }
    }

    /// Wie `detailPraesentation`, aber mit einem Schalter (Planauswahl, Info, Hilfe, Formulare, Kontenauswahl …).
    func blattPraesentation<Blatt: View>(isPresented: Binding<Bool>, breit: Bool, art: Blattart = .formular,
                                         @ViewBuilder blatt: @escaping () -> Blatt) -> some View {
        sheet(isPresented: isPresented) {
            blatt()
                .environment(\.blattSchliessen, nil)
                .blattGroesse(art, breit: breit)
        }
    }

    /// Höhenstufen und Größe eines Blatts. Ab iOS 26 kein eigener Hintergrund: Blätter mit Höhenstufen bekommen das
    /// Liquid Glass des Systems (bei voller Höhe wird es deckend).
    @ViewBuilder
    func blattGroesse(_ art: Blattart, breit: Bool) -> some View {
        if breit {
            switch art {
            case .detail:
                self
                    .frame(width: Detailblatt.breite, height: Detailblatt.hoehe)
                    .presentationSizing(.fitted)
                    .blattHintergrund()
            case .formular:
                self
                    .presentationSizing(.form)
                    .blattHintergrund()
            }
        } else {
            switch art {
            case .detail:
                self
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
                    .blattHintergrund()
            case .formular:
                self
                    .presentationDetents([.large])
                    .blattHintergrund()
            }
        }
    }
}

// MARK: - Maße der Stundendetails

enum Detailmass {
    /// Linker Rand von Kopfblock und Liste
    static let rand: CGFloat = 16
    /// Zeilenhöhe im Kopfblock
    static let zeile: CGFloat = 26
    /// Fach bzw. Titel im Kopfblock
    static let gross: CGFloat = 22
    /// Raum und Lehrkraft
    static let klein: CGFloat = 15
    /// Tippfläche der Knöpfe im Kopf
    static let knopf: CGFloat = 44

    /// „07:45“ → „7:45“ (ohne führende Null).
    static func uhrzeit(_ text: String) -> String {
        text.count == 5 && text.hasPrefix("0") ? String(text.dropFirst()) : text
    }
}

// MARK: - Kopf des Blatts

/// Symbolknopf im Kopf eines Blatts: Symbol in der Akzentfarbe, 44 pt Tippfläche, ohne Hintergrund. „⋮“-Menüs zeigen
/// das System-Symbol „ellipsis.circle“.
struct Rundknopf: View {
    let symbol: String
    var gewicht: Font.Weight = .regular
    var groesse: CGFloat = 17
    var drehung: Double = 0

    private var name: String { symbol == "ellipsis" ? "ellipsis.circle" : symbol }

    var body: some View {
        Image(systemName: name)
            .font(.system(size: min(max(groesse, 16), 19), weight: .regular))
            .foregroundStyle(Farben.akzent)
            .frame(width: Detailmass.knopf, height: Detailmass.knopf)
            .contentShape(Rectangle())
    }
}

/// Kopfzeile eines Blatts wie eine Navigationsleiste: links Schließen bzw. Zurück, mittig der (zweizeilige) Titel,
/// rechts optional Aktionen; unten eine feine Linie. Der Titel steht immer genau mittig.
struct Blattkopf<Mitte: View, Rechts: View>: View {
    let symbol: String
    let symbolText: String
    let aktion: () -> Void
    let mitte: Mitte
    let rechts: Rechts
    /// Lädt der Inhalt? Dann läuft unten am Kopf der Ladebalken.
    var laedt: Bool = false

    init(symbol: String, symbolText: String, aktion: @escaping () -> Void, laedt: Bool = false,
         @ViewBuilder mitte: () -> Mitte, @ViewBuilder rechts: () -> Rechts) {
        self.symbol = symbol
        self.symbolText = symbolText
        self.aktion = aktion
        self.laedt = laedt
        self.mitte = mitte()
        self.rechts = rechts()
    }

    var body: some View {
        ZStack {
            mitte
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 96)
            HStack(spacing: 0) {
                Button(action: aktion) {
                    linkerKnopf
                }
                .buttonStyle(.plain)
                .accessibilityLabel(symbolText)
                Spacer(minLength: 0)
                rechts
            }
        }
        .padding(.horizontal, 8)
        .padding(.top, 6)
        .frame(minHeight: 52)
        .background(Farben.blatt)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Farben.rand)
                .frame(height: 0.5)
        }
        .overlay(alignment: .bottom) {
            Ladebalken(aktiv: laedt)
        }
    }

    /// „Schließen“ als Text, „Zurück“ mit Pfeil – wie in den Navigationsleisten des Systems.
    @ViewBuilder
    private var linkerKnopf: some View {
        if symbol == "chevron.left" {
            HStack(spacing: 3) {
                Image(systemName: "chevron.left")
                    .font(.system(size: 17, weight: .semibold))
                Text("Zurück")
                    .font(.body)
            }
            .foregroundStyle(Farben.akzent)
            .padding(.horizontal, 6)
            .frame(minHeight: Detailmass.knopf)
            .contentShape(Rectangle())
        } else {
            Text(symbolText)
                .font(.body)
                .foregroundStyle(Farben.akzent)
                .padding(.horizontal, 8)
                .frame(minHeight: Detailmass.knopf)
                .contentShape(Rectangle())
        }
    }
}

extension Blattkopf where Rechts == EmptyView {
    init(symbol: String, symbolText: String, aktion: @escaping () -> Void, laedt: Bool = false, @ViewBuilder mitte: () -> Mitte) {
        self.init(symbol: symbol, symbolText: symbolText, aktion: aktion, laedt: laedt, mitte: mitte, rechts: { EmptyView() })
    }
}

/// Titel in der Mitte des Kopfs: Titel 17 pt halbfett, darunter klein der Untertitel (z. B. Uhrzeit).
struct Blatttitel: View {
    let titel: String
    var untertitel: String? = nil
    var pfeil: Bool = false

    var body: some View {
        VStack(spacing: 1) {
            HStack(spacing: 4) {
                Text(titel)
                    .font(.headline)
                    .foregroundStyle(Farben.text)
                if pfeil {
                    Image(systemName: "chevron.down")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Farben.text3)
                }
            }
            if let untertitel, !untertitel.isEmpty {
                Text(untertitel)
                    .font(.caption)
                    .monospacedDigit()
                    .foregroundStyle(Farben.text2)
            }
        }
        .lineLimit(1)
        .minimumScaleFactor(0.8)
        .accessibilityElement(children: .combine)
    }
}

/// Rahmen einer Unterseite im selben Blatt: Kopf mit Zurück (bzw. Schließen), Titel mittig, darunter der Inhalt.
/// Die Navigationsleiste des Systems bleibt verborgen; der Kopf ist ihr nachgebildet.
struct DetailSeitenRahmen<Inhalt: View, Rechts: View>: View {
    let titel: String
    let untertitel: String?
    let symbol: String
    let zurueck: (() -> Void)?
    let inhalt: Inhalt
    let rechts: Rechts
    /// Lädt die Seite? Dann läuft unter dem Kopf der Ladebalken.
    let laedt: Bool
    @Environment(\.dismiss) private var schliessen

    init(titel: String, untertitel: String? = nil, symbol: String = "chevron.left", zurueck: (() -> Void)? = nil,
         laedt: Bool = false, @ViewBuilder inhalt: () -> Inhalt, @ViewBuilder rechts: () -> Rechts) {
        self.titel = titel
        self.untertitel = untertitel
        self.symbol = symbol
        self.zurueck = zurueck
        self.laedt = laedt
        self.inhalt = inhalt()
        self.rechts = rechts()
    }

    var body: some View {
        VStack(spacing: 0) {
            Blattkopf(symbol: symbol, symbolText: symbol == "xmark" ? "Schließen" : "Zurück", aktion: {
                if let zurueck { zurueck() } else { schliessen() }
            }, laedt: laedt, mitte: {
                Blatttitel(titel: titel, untertitel: untertitel)
            }, rechts: {
                rechts
            })
            inhalt
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .background(Farben.blatt.ignoresSafeArea())
        // Beim Verlassen der Seite den Fokus abgeben, damit keine Tastatur-Einrückung hängen bleibt
        .onDisappear { Tastatur.schliessen() }
        .toolbar(.hidden, for: .navigationBar)
    }
}

extension DetailSeitenRahmen where Rechts == EmptyView {
    init(titel: String, untertitel: String? = nil, symbol: String = "chevron.left", zurueck: (() -> Void)? = nil,
         laedt: Bool = false, @ViewBuilder inhalt: () -> Inhalt) {
        self.init(titel: titel, untertitel: untertitel, symbol: symbol, zurueck: zurueck, laedt: laedt, inhalt: inhalt, rechts: { EmptyView() })
    }
}

/// Textknopf „Sichern“ rechts im Kopf einer Unterseite (halbfett in der Akzentfarbe, inaktiv grau).
struct SichernKnopf: View {
    let speichert: Bool
    let aktiv: Bool
    var symbol: String = "checkmark"
    var beschriftung: String = "Sichern"
    let aktion: () -> Void

    var body: some View {
        if speichert {
            ProgressView()
                .frame(width: Detailmass.knopf, height: Detailmass.knopf)
                .padding(.horizontal, 8)
        } else {
            Button(action: aktion) {
                Text(beschriftung)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(aktiv ? Farben.akzent : Farben.pfeil)
                    .padding(.horizontal, 8)
                    .frame(minHeight: Detailmass.knopf)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(!aktiv)
            .accessibilityLabel(beschriftung)
        }
    }
}

// MARK: - Zeilen der Liste

/// Zeile der Detailliste: Titel, optional grauer Untertitel (einzeilig), rechts Zahl und Pfeil – ohne Symbol davor.
/// Mindesthöhe 48 pt.
struct Detailzeile<Rechts: View>: View {
    let titel: String
    var untertitel: String? = nil
    var zahl: Int? = nil
    var pfeil: Bool = true
    let rechts: Rechts

    init(titel: String, untertitel: String? = nil, zahl: Int? = nil, pfeil: Bool = true,
         @ViewBuilder rechts: () -> Rechts) {
        self.titel = titel
        self.untertitel = untertitel
        self.zahl = zahl
        self.pfeil = pfeil
        self.rechts = rechts()
    }

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(titel)
                    .font(.body)
                    .foregroundStyle(Farben.text)
                    .lineLimit(1)
                if let untertitel, !untertitel.isEmpty {
                    Text(untertitel.replacingOccurrences(of: "\n", with: " "))
                        .font(.subheadline)
                        .foregroundStyle(Farben.text2)
                        .lineLimit(1)
                        .truncationMode(.tail)
                }
            }
            Spacer(minLength: 6)
            rechts
            if let zahl {
                ZahlPlakette(zahl: zahl)
            }
            if pfeil {
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Farben.pfeil)
            }
        }
        .padding(.leading, Detailmass.rand)
        .padding(.trailing, 16)
        .padding(.vertical, 8)
        .frame(minHeight: 48)
        .contentShape(Rectangle())
    }
}

extension Detailzeile where Rechts == EmptyView {
    init(titel: String, untertitel: String? = nil, zahl: Int? = nil, pfeil: Bool = true) {
        self.init(titel: titel, untertitel: untertitel, zahl: zahl, pfeil: pfeil, rechts: { EmptyView() })
    }
}

// MARK: - Werte im Kopf (Raum, Lehrkraft)

/// Baustein einer Wertzeile im Kopf der Details.
enum Wertbaustein: Hashable {
    case text(String)
    case weg(String)
    case pfeil
    case trenner
    case offen(String)
    /// Neuer bzw. geänderter Wert (z. B. Vertretung): violett unterstrichen
    case neu(String)
    /// Status-Plakette rechts neben dem Fach („Prüfung“, „Veranstaltung“)
    case pille(String)
}

/// Wertzeile im Kopf der Details: Änderungen als „alt → neu“ (alt durchgestrichen, neu violett unterstrichen),
/// fehlende Werte (abwesende Lehrkraft bzw. Klasse) durchgestrichen. Genau eine Zeile; bei vielen Werten lässt sie sich
/// waagrecht scrollen. Mit `kuerzenAb`: Sind es mehr Werte (z. B. alle Lehrkräfte oder alle Klassen einer
/// Veranstaltung), stehen nur die ersten und dahinter „… +N“; Antippen klappt die ganze Liste umbrechend auf (und
/// wieder zu).
struct Wertzeile: View {
    let bausteine: [Wertbaustein]
    var schrift: CGFloat = 13
    var farbe: Color = Farben.text2
    /// Schriftstärke (Fach im Kopf halbfett)
    var gewicht: Font.Weight = .regular
    /// Ab mehr als so vielen Werten kürzen (nil = nie)
    var kuerzenAb: Int? = nil
    @State private var aufgeklappt = false

    /// Übliche Grenze im Kopf der Stundendetails: mehr als 6 Werte werden gekürzt.
    static let kuerzungsgrenze = 6

    /// Werte der Zeile: Bausteine zwischen den Trennstrichen (ohne Plakette).
    private var gruppen: [[Wertbaustein]] {
        var ergebnis: [[Wertbaustein]] = [[]]
        for b in bausteine {
            switch b {
            case .trenner:
                ergebnis.append([])
            case .pille:
                continue
            default:
                ergebnis[ergebnis.count - 1].append(b)
            }
        }
        return ergebnis.filter { !$0.isEmpty }
    }

    private var pille: String? {
        for b in bausteine { if case .pille(let t) = b { return t } }
        return nil
    }

    private var gekuerzt: Bool {
        guard let grenze = kuerzenAb else { return false }
        return gruppen.count > grenze
    }

    var body: some View {
        if gekuerzt, let grenze = kuerzenAb {
            let alle = gruppen
            let sichtbar = max(grenze - 1, 1)
            if aufgeklappt {
                VStack(alignment: .leading, spacing: 4) {
                    Text(Self.fliesstext(alle))
                        .font(.system(size: schrift, weight: gewicht))
                        .foregroundStyle(farbe)
                        .lineLimit(nil)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    if let pille { Statuspille(text: pille) }
                }
                .padding(.vertical, 3)
                .contentShape(Rectangle())
                .onTapGesture { withAnimation(.easeOut(duration: 0.12)) { aufgeklappt = false } }
                .accessibilityAddTraits(.isButton)
                .accessibilityHint("Liste einklappen")
            } else {
                EinzeilenScroller {
                    HStack(spacing: 4) {
                        ForEach(Array(Self.verbunden(Array(alle.prefix(sichtbar))).enumerated()), id: \.offset) { eintrag in
                            baustein(eintrag.element)
                        }
                        Button {
                            withAnimation(.easeOut(duration: 0.12)) { aufgeklappt = true }
                        } label: {
                            Text("… +\(alle.count - sichtbar)")
                                .foregroundStyle(Farben.akzent)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(alle.count - sichtbar) weitere anzeigen")
                        if let pille { baustein(.pille(pille)) }
                    }
                    .font(.system(size: schrift, weight: gewicht))
                    .foregroundStyle(farbe)
                }
            }
        } else {
            EinzeilenScroller {
                HStack(spacing: 4) {
                    ForEach(Array(bausteine.enumerated()), id: \.offset) { eintrag in
                        baustein(eintrag.element)
                    }
                }
                .font(.system(size: schrift, weight: gewicht))
                .foregroundStyle(farbe)
            }
        }
    }

    /// Gruppen wieder mit Trennstrichen verbinden.
    private static func verbunden(_ gruppen: [[Wertbaustein]]) -> [Wertbaustein] {
        var ergebnis: [Wertbaustein] = []
        for g in gruppen {
            if !ergebnis.isEmpty { ergebnis.append(.trenner) }
            ergebnis.append(contentsOf: g)
        }
        return ergebnis
    }

    /// Aufgeklappte Liste als ein umbrechender Text (durchgestrichene Werte bleiben durchgestrichen).
    private static func fliesstext(_ gruppen: [[Wertbaustein]]) -> AttributedString {
        var text = AttributedString()
        for (i, g) in gruppen.enumerated() {
            if i > 0 {
                var t = AttributedString(" · ")
                t.foregroundColor = Farben.text3
                text.append(t)
            }
            for (j, b) in g.enumerated() {
                if j > 0 { text.append(AttributedString(" ")) }
                switch b {
                case .text(let w):
                    text.append(AttributedString(w))
                case .neu(let w):
                    var t = AttributedString(w)
                    t.foregroundColor = Farben.aenderung
                    t.underlineStyle = .single
                    text.append(t)
                case .weg(let w):
                    var t = AttributedString(w)
                    t.strikethroughStyle = .single
                    t.foregroundColor = Farben.text3
                    text.append(t)
                case .offen(let w):
                    var t = AttributedString(w)
                    t.strikethroughStyle = .single
                    t.foregroundColor = Farben.aenderung
                    text.append(t)
                case .pfeil:
                    text.append(AttributedString("→"))
                case .trenner, .pille:
                    break
                }
            }
        }
        return text
    }

    @ViewBuilder
    private func baustein(_ b: Wertbaustein) -> some View {
        switch b {
        case .text(let t):
            Text(t)
        case .neu(let t):
            Text(t)
                .underline(true, color: Farben.aenderung)
                .foregroundStyle(Farben.aenderung)
        case .weg(let t):
            Text(t)
                .strikethrough(true, color: Farben.text3)
                .foregroundStyle(Farben.text3)
        case .offen(let t):
            Text(t)
                .strikethrough(true, color: Farben.aenderung)
                .foregroundStyle(Farben.aenderung)
        case .pfeil:
            Image(systemName: "arrow.right")
                .font(.system(size: max(schrift - 4, 10), weight: .semibold))
                .foregroundStyle(Farben.text3)
        case .trenner:
            Text("·")
                .foregroundStyle(Farben.text3)
        case .pille(let t):
            Statuspille(text: t)
                .padding(.leading, 8)
        }
    }

    /// Bausteine aus Werten: geänderte Werte als „alt → neu“ (nur Räume, `pfeil`) bzw. „alt · neu“ (Lehrkräfte, Klassen),
    /// offene Lehrkraft (kein neuer Wert) durchgestrichen.
    static func bausteine(_ werte: [Wert], durchgestrichen: Bool, offenAlsPlakette: Bool, pfeil: Bool = false) -> [Wertbaustein] {
        var ergebnis: [Wertbaustein] = []
        for w in werte {
            var teil: [Wertbaustein] = []
            let alt = w.alt ?? ""
            if durchgestrichen {
                let t = w.k.isEmpty ? alt : w.k
                if !t.isEmpty { teil.append(.weg(t)) }
            } else if w.k.isEmpty && !alt.isEmpty {
                teil.append(offenAlsPlakette ? .offen(alt) : .weg(alt))
            } else if w.k.isEmpty && w.neu && offenAlsPlakette {
                // Offene Vertretung ohne bekannte Lehrkraft
                teil.append(.offen("???"))
            } else {
                var ersetzt = false
                if !alt.isEmpty && alt != w.k {
                    teil.append(.weg(alt))
                    teil.append(.pfeil)
                    ersetzt = true
                }
                // Hinzugekommener Wert (plus) mit „+“ davor, z. B. „+B070“
                if !w.k.isEmpty {
                    let wert = w.plus ? "+" + w.k : w.k
                    teil.append(ersetzt || w.plus ? .neu(wert) : .text(wert))
                }
            }
            guard !teil.isEmpty else { continue }
            if !ergebnis.isEmpty { ergebnis.append(.trenner) }
            ergebnis.append(contentsOf: teil)
        }
        return ergebnis
    }
}

/// Status-Plakette im Kopf der Details („Prüfung“, „Veranstaltung“, „Zusatzstunde“, „Entfällt“) in der passenden
/// Statusfarbe.
struct Statuspille: View {
    let text: String

    private var farben: (farbe: Color, flaeche: Color) {
        let t = text.lowercased()
        if t.contains("prüf") || t.contains("klausur") { return (Farben.pruefung, Farben.pruefungFlaeche) }
        if t.contains("veranstalt") || t.contains("termin") || t.contains("buchung") { return (Farben.termin, Farben.terminFlaeche) }
        if t.contains("entf") { return (Farben.entfall, Farben.entfallFlaeche) }
        if t.contains("zusatz") || t.contains("vertret") || t.contains("änder") { return (Farben.aenderung, Farben.aenderungFlaeche) }
        return (Farben.text2, Farben.neutralFlaeche)
    }

    var body: some View {
        Plakette(text: text, farbe: farben.farbe, flaeche: farben.flaeche)
    }
}

/// Genau eine Zeile: passt der Inhalt nicht in die Breite, lässt er sich waagrecht scrollen (statt umzubrechen).
struct EinzeilenScroller<Inhalt: View>: View {
    let inhalt: Inhalt

    init(@ViewBuilder inhalt: () -> Inhalt) {
        self.inhalt = inhalt()
    }

    var body: some View {
        ScrollView(.horizontal) {
            inhalt
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
        }
        .scrollIndicators(.hidden)
        .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Symbole

/// SF-Symbol-Namen für funktionale Zeichen (Kacheln, Status) an einer Stelle.
enum Symbole {
    static let hausaufgaben = "checklist"
    static let info = "info.circle"
    static let online = "video"
}

// MARK: - Schüler*innen-Plakette

/// Zahl der Abwesenden: in der Entfall-Farbe (neutral bei 0), daneben ein Haken, wenn die Abwesenheiten der Stunde
/// kontrolliert wurden.
struct SchuelerPlakette: View {
    let zahl: Int
    let kontrolliert: Bool

    var body: some View {
        HStack(spacing: 4) {
            if kontrolliert {
                Image(systemName: "checkmark")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Farben.ok)
            }
            Text("\(zahl)")
                .font(.system(size: 13, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(zahl > 0 ? Farben.entfall : Farben.text2)
                .padding(.horizontal, 7)
                .frame(minWidth: 22, minHeight: 22)
                .background(zahl > 0 ? Farben.entfallFlaeche : Farben.neutralFlaeche, in: Capsule())
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(kontrolliert ? "\(zahl) abwesend, kontrolliert" : "\(zahl) abwesend")
    }
}

// MARK: - Raumbuchung in den Stundendetails

/// Ziel der Raumliste: Raum ersetzen (alt) bzw. zusätzlichen Raum hinzufügen.
struct RaumZiel: Hashable, Identifiable {
    /// ersetzen oder hinzufuegen
    let aktion: String
    let alt: String

    var id: String { "\(aktion)|\(alt)" }
}

/// Raumzeile: jeder Raum als Feld mit feinem Rand (Tippen: „Ersetzen“ / „Löschen“), rechts „+“ für einen weiteren Raum.
struct RaumZeile: View {
    let raeume: [Wert]
    @Binding var ziel: RaumZiel?
    @EnvironmentObject var daten: Stundendaten
    @EnvironmentObject var zustand: AppZustand
    @State private var fehler: String? = nil
    @State private var arbeitet = false

    /// Aktuelle Räume (ohne weggefallene).
    private var aktuelle: [String] {
        var liste: [String] = []
        for w in raeume where !w.k.isEmpty && !liste.contains(where: { $0.caseInsensitiveCompare(w.k) == .orderedSame }) {
            liste.append(w.k)
        }
        return liste
    }

    var body: some View {
        HStack(spacing: 12) {
            EinzeilenScroller {
                HStack(spacing: 8) {
                    if aktuelle.isEmpty {
                        Text("Kein Raum")
                            .font(.body)
                            .foregroundStyle(Farben.text3)
                    }
                    ForEach(aktuelle, id: \.self) { raum in
                        Menu {
                            Button {
                                ziel = RaumZiel(aktion: "ersetzen", alt: raum)
                            } label: {
                                Text("Ersetzen")
                            }
                            Button(role: .destructive) {
                                Task { await loeschen(raum) }
                            } label: {
                                Text("Löschen")
                            }
                            .disabled(aktuelle.count < 2)
                        } label: {
                            Text(raum)
                                .font(.body.weight(.medium))
                                .monospacedDigit()
                                .foregroundStyle(Farben.text)
                                .lineLimit(1)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 4)
                                .background(Farben.flaeche2, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
                                .overlay {
                                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                                        .strokeBorder(Farben.randStark, lineWidth: 1)
                                }
                        }
                        .tint(Color.primary)
                        .accessibilityLabel("Raum \(raum)")
                        .accessibilityHint("Ersetzen oder löschen")
                    }
                }
            }
            if arbeitet {
                ProgressView()
                    .frame(width: 32, height: 32)
            } else {
                Button {
                    ziel = RaumZiel(aktion: "hinzufuegen", alt: "")
                } label: {
                    Image(systemName: "plus.circle")
                        .font(.system(size: 20, weight: .regular))
                        .foregroundStyle(Farben.akzent)
                        .frame(width: 32, height: 32)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Raum hinzufügen")
            }
        }
        .padding(.leading, Detailmass.rand)
        .padding(.trailing, 16)
        .padding(.vertical, 8)
        .frame(minHeight: 52)
        .alert("Nicht gespeichert", isPresented: Binding(get: { fehler != nil }, set: { if !$0 { fehler = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(fehler ?? "")
        }
    }

    private func loeschen(_ raum: String) async {
        arbeitet = true
        defer { arbeitet = false }
        do {
            let meldung = try await daten.raumAendern(aktion: "loeschen", raum: raum, alt: nil)
            withAnimation { daten.hinweis = meldung }
            zustand.planGeaendert += 1
        } catch {
            fehler = zustand.fehlertext(error)
        }
    }
}
