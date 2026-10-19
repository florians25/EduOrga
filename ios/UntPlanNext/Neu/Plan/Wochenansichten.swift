import SwiftUI

// MARK: - Wochenleiste (schwebend, Glas)

/// Schwebende Wochenleiste aus Liquid Glass unten im Plan – mit dem Daumen erreichbar: Pfeile für die vorige bzw.
/// nächste Woche, dazwischen die Schultage (Kürzel, Datum, Punkt bei Änderungen bzw. Entfall). Der gewählte Tag ist
/// Petrol hinterlegt (die Markierung gleitet beim Wechsel), heute steht in Petrol. Gesten auf der Leiste: waagrecht
/// wischen = andere Woche, nach oben ziehen = Woche (Raster), nach unten ziehen = Tag.
struct Wochenschalter: View {
    @ObservedObject var modell: Planmodell
    let montag: String
    /// Gewählter Tag (leer in der Wochenübersicht)
    let gewaehlt: String
    let wocheAktiv: Bool
    let waehlen: (String) -> Void
    let blaettern: (Int) -> Void
    /// true = Wochenübersicht, false = Tag
    let ansicht: (Bool) -> Void

    @Namespace private var markierung

    init(modell: Planmodell, montag: String, gewaehlt: String, wocheAktiv: Bool, waehlen: @escaping (String) -> Void,
         blaettern: @escaping (Int) -> Void, ansicht: @escaping (Bool) -> Void) {
        _modell = ObservedObject(wrappedValue: modell)
        self.montag = montag
        self.gewaehlt = gewaehlt
        self.wocheAktiv = wocheAktiv
        self.waehlen = waehlen
        self.blaettern = blaettern
        self.ansicht = ansicht
    }

    var body: some View {
        GlasGruppe(abstand: 8) {
            HStack(spacing: 8) {
                Button {
                    Haptik.auswahl()
                    blaettern(-1)
                } label: {
                    GlasSymbol(name: "chevron.left", groesse: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Vorige Woche")

                HStack(spacing: 2) {
                    ForEach(modell.tage(montag: montag), id: \.self) { d in
                        tagKnopf(d)
                    }
                }
                .padding(4)
                .frame(maxWidth: .infinity)
                .glasFlaeche(Capsule(), interaktiv: true)
                .overlay(alignment: .top) {
                    // Griff: deutet an, dass sich die Leiste nach oben zur Wochenübersicht ziehen lässt
                    Capsule()
                        .fill(Farben.text3.opacity(0.5))
                        .frame(width: 28, height: 3)
                        .offset(y: -7)
                        .opacity(wocheAktiv ? 0 : 1)
                        .accessibilityHidden(true)
                }

                Button {
                    Haptik.auswahl()
                    blaettern(1)
                } label: {
                    GlasSymbol(name: "chevron.right", groesse: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Nächste Woche")
            }
        }
        .animation(.snappy(duration: 0.28), value: gewaehlt)
        .simultaneousGesture(
            DragGesture(minimumDistance: 24)
                .onEnded { wert in
                    let dx = wert.translation.width
                    let dy = wert.translation.height
                    if abs(dy) > abs(dx) {
                        if dy < -24 { Haptik.auswahl(); ansicht(true) }
                        if dy > 24 { Haptik.auswahl(); ansicht(false) }
                    } else if abs(dx) > 40 {
                        Haptik.auswahl()
                        blaettern(dx < 0 ? 1 : -1)
                    }
                }
        )
        .task(id: "\(modell.typ)|\(modell.element)|\(montag)") { await modell.laden(montag: montag) }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Woche")
        .accessibilityAction(named: wocheAktiv ? "Tag zeigen" : "Wochenübersicht zeigen") { ansicht(!wocheAktiv) }
    }

    private func tagKnopf(_ d: String) -> some View {
        let istGewaehlt = d == gewaehlt
        let heute = Datumsformat.istHeute(d)
        let t = modell.tag(d)
        let entfall = (t?.anzahlEntfall ?? 0) > 0
        let aenderung = (t?.anzahlAenderung ?? 0) > 0
        return Button {
            Haptik.auswahl()
            waehlen(d)
        } label: {
            VStack(spacing: 1) {
                Text(Datumsformat.anzeige(d, "EE").replacingOccurrences(of: ".", with: ""))
                    .font(.caption2.weight(.semibold))
                    .opacity(istGewaehlt ? 0.9 : 1)
                Text(Datumsformat.anzeige(d, "d"))
                    .font(.headline)
                    .monospacedDigit()
                Circle()
                    .fill(istGewaehlt ? Farben.aufAkzent : (entfall ? Farben.entfall : Farben.aenderung))
                    .frame(width: 5, height: 5)
                    .opacity(entfall || aenderung ? 1 : 0)
            }
            .foregroundStyle(istGewaehlt ? Farben.aufAkzent : (heute ? Farben.akzent : (t?.frei == true ? Farben.text3 : Farben.text)))
            .dynamicTypeSize(...DynamicTypeSize.xxLarge)
            .frame(maxWidth: .infinity, minHeight: 48)
            .background {
                if istGewaehlt {
                    Capsule()
                        .fill(Farben.akzent)
                        .matchedGeometryEffect(id: "auswahl", in: markierung)
                }
            }
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(tagVorlesen(d, t))
        .accessibilityAddTraits(istGewaehlt ? AccessibilityTraits([.isButton, .isSelected]) : AccessibilityTraits.isButton)
    }

    private func tagVorlesen(_ d: String, _ t: Tagesansicht?) -> String {
        var s = Datumsformat.anzeige(d, "EEEE, d. MMMM")
        if Datumsformat.istHeute(d) { s = "Heute, " + s }
        guard let t else { return s }
        if let f = t.freiText { return s + ", " + f.titel }
        s += ", \(t.anzahlStunden) Stunden"
        if t.anzahlEntfall > 0 { s += ", \(t.anzahlEntfall) Entfall" }
        if t.anzahlAenderung > 0 { s += ", \(t.anzahlAenderung) Änderungen" }
        return s
    }
}
