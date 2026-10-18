import SwiftUI

// MARK: - Wochenleiste (schwebend, Glas)

/// Schwebende Wochenleiste aus Liquid Glass unten im Plan – mit dem Daumen erreichbar: Pfeile für die vorige bzw.
/// nächste Woche, dazwischen die Schultage (Kürzel, Datum, Punkt bei Änderungen bzw. Entfall). Der gewählte Tag ist
/// Petrol hinterlegt (die Markierung gleitet beim Wechsel), heute steht in Petrol. Gesten auf der Leiste: waagrecht
/// wischen = andere Woche, nach oben ziehen = Wochenübersicht, nach unten ziehen = zurück zum Tag.
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

// MARK: - Wochenmatrix

/// Die Woche als kompakte Matrix: Spalten = Tage, Zeilen = Stunden des Zeitrasters. Jede Zelle in der Fachfarbe mit
/// Fach und Raum; Entfall schraffiert, Vertretung mit violettem Rahmen, Prüfung bernsteinfarben, Termine magenta. Oben
/// die Kennzahlen der Woche. Antippen öffnet die Stunde groß, langes Drücken zeigt die Aktionen der Stunde.
struct Wochenmatrix: View {
    @ObservedObject var modell: Planmodell
    let montag: String
    let raum: Namespace.ID?
    let antippen: (Kachel, Tagesansicht, String) -> Void

    @ScaledMetric(relativeTo: .caption) private var zeilenHoehe: CGFloat = 46
    private let abstand: CGFloat = 3

    private struct Block: Identifiable {
        let id: String
        let von: Int
        let bis: Int
        let kachel: Kachel?
        let weitere: Int
    }

    private var tage: [String] { modell.tage(montag: montag) }

    private var raster: [Rasterzeit] {
        for d in tage {
            if let t = modell.tag(d), !t.raster.isEmpty { return t.raster }
        }
        return []
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            kennzahlen
            if modell.plan(montag: montag) == nil {
                HStack {
                    Spacer()
                    ProgressView()
                    Spacer()
                }
                .frame(height: 200)
            } else if modell.plan(montag: montag)?.gesperrt == true {
                Hinweisfeld(titel: "Nicht freigegeben",
                            text: modell.plan(montag: montag)?.sperrhinweis ?? "Diese Woche ist für Ihr Konto noch nicht einsehbar.",
                            symbol: "lock", flaeche: Farben.flaeche)
            } else {
                matrix
            }
        }
        .padding(.horizontal, Stilmass.rand)
        .padding(.vertical, 12)
    }

    // MARK: Kennzahlen

    private var kennzahlen: some View {
        let ansichten = tage.compactMap { modell.tag($0) }
        let stunden = ansichten.reduce(0) { $0 + $1.anzahlStunden }
        let entfall = ansichten.reduce(0) { $0 + $1.anzahlEntfall }
        let aenderung = ansichten.reduce(0) { $0 + $1.anzahlAenderung }
        let pruefung = ansichten.reduce(0) { $0 + $1.anzahlPruefung }
        return HStack(spacing: 8) {
            kennzahl("\(stunden)", "Stunden", Farben.text)
            kennzahl("\(aenderung)", aenderung == 1 ? "Änderung" : "Änderungen", aenderung > 0 ? Farben.aenderung : Farben.text3)
            kennzahl("\(entfall)", "Entfall", entfall > 0 ? Farben.entfall : Farben.text3)
            kennzahl("\(pruefung)", pruefung == 1 ? "Prüfung" : "Prüfungen", pruefung > 0 ? Farben.pruefung : Farben.text3)
        }
        .accessibilityElement(children: .combine)
    }

    private func kennzahl(_ zahl: String, _ text: String, _ farbe: Color) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(zahl)
                .font(.title3.weight(.bold))
                .monospacedDigit()
                .foregroundStyle(farbe)
            Text(text)
                .font(.caption)
                .foregroundStyle(Farben.text2)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .kartenflaeche(radius: 10)
    }

    // MARK: Matrix

    private var matrix: some View {
        HStack(alignment: .top, spacing: abstand) {
            // Stundenspalte
            VStack(spacing: abstand) {
                Color.clear.frame(height: 34)
                ForEach(raster) { r in
                    VStack(spacing: 0) {
                        Text("\(r.nr)")
                            .font(.caption.weight(.bold))
                            .monospacedDigit()
                            .foregroundStyle(Farben.text2)
                        Text(Uhr.uhrzeit(r.beginn))
                            .font(.caption2)
                            .monospacedDigit()
                            .foregroundStyle(Farben.text3)
                    }
                    .dynamicTypeSize(...DynamicTypeSize.xLarge)
                    .frame(width: 34, height: zeilenHoehe)
                    .accessibilityElement(children: .combine)
                }
            }
            ForEach(tage, id: \.self) { d in
                spalte(d)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    private func spalte(_ d: String) -> some View {
        let heute = Datumsformat.istHeute(d)
        let t = modell.tag(d)
        return VStack(spacing: abstand) {
            VStack(spacing: 0) {
                Text(Datumsformat.anzeige(d, "EE").replacingOccurrences(of: ".", with: ""))
                    .font(.caption.weight(.semibold))
                Text(Datumsformat.anzeige(d, "d.M."))
                    .font(.caption2)
                    .monospacedDigit()
            }
            .foregroundStyle(heute ? Farben.akzent : Farben.text2)
            .dynamicTypeSize(...DynamicTypeSize.xLarge)
            .frame(maxWidth: .infinity)
            .frame(height: 31)
            .overlay(alignment: .bottom) {
                if heute {
                    Capsule().fill(Farben.akzent).frame(height: 2)
                }
            }
            .padding(.bottom, 3)
            .accessibilityAddTraits(.isHeader)

            if let t, let f = t.freiText {
                let zeilen = CGFloat(max(raster.count, 1))
                VStack(spacing: 4) {
                    Image(systemName: "sun.max")
                        .font(.footnote)
                    Text(f.titel)
                        .font(.caption2.weight(.semibold))
                        .multilineTextAlignment(.center)
                        .lineLimit(4)
                        .minimumScaleFactor(0.7)
                }
                .foregroundStyle(Farben.frei)
                .padding(4)
                .frame(maxWidth: .infinity)
                .frame(height: zeilen * zeilenHoehe + (zeilen - 1) * abstand)
                .background(Farben.freiFlaeche, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                .accessibilityElement(children: .combine)
            } else {
                ForEach(bloecke(t)) { b in
                    zelle(b, tag: t)
                }
            }
        }
        .padding(.horizontal, 1)
        .background {
            if heute {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(Farben.primaerFlaeche.opacity(0.6))
                    .padding(-2)
            }
        }
    }

    /// Blöcke einer Spalte: je Rasterstunde die wichtigste Kachel; dieselbe Kachel über mehrere Stunden wird ein Block.
    private func bloecke(_ t: Tagesansicht?) -> [Block] {
        guard let t else {
            return raster.map { Block(id: "l\($0.nr)", von: $0.nr, bis: $0.nr, kachel: nil, weitere: 0) }
        }
        let stunden = t.kacheln.filter { !$0.inPause && $0.karte != nil }
        var proZeile: [(nr: Int, kachel: Kachel?, weitere: Int)] = []
        for r in raster {
            let hier = stunden.filter { $0.beginn < r.ende && r.beginn < $0.ende }
                .sorted { ($0.rang, $0.beginn) < ($1.rang, $1.beginn) }
            proZeile.append((r.nr, hier.first, max(0, hier.count - 1)))
        }
        var ergebnis: [Block] = []
        for z in proZeile {
            if let letzter = ergebnis.last, let a = letzter.kachel, let b = z.kachel,
               (a.stamm ?? a.id) == (b.stamm ?? b.id) || a.id == b.id, letzter.bis + 1 == z.nr {
                ergebnis[ergebnis.count - 1] = Block(id: letzter.id, von: letzter.von, bis: z.nr, kachel: a,
                                                     weitere: max(letzter.weitere, z.weitere))
            } else {
                ergebnis.append(Block(id: "\(z.nr)-\(z.kachel?.id.uuidString ?? "leer")", von: z.nr, bis: z.nr,
                                      kachel: z.kachel, weitere: z.weitere))
            }
        }
        return ergebnis
    }

    @ViewBuilder
    private func zelle(_ b: Block, tag: Tagesansicht?) -> some View {
        let zeilen = CGFloat(b.bis - b.von + 1)
        let h = zeilen * zeilenHoehe + (zeilen - 1) * abstand
        if let k = b.kachel, let tag {
            let quelle = "matrix-\(b.id)"
            Button {
                antippen(k, tag, quelle)
            } label: {
                MatrixZelle(kachel: k, weitere: b.weitere, vergangen: Tagesansicht.vergangen(k, jetzt: Date()))
                    .frame(height: h)
                    .zoomQuelle(quelle, in: raum)
            }
            .buttonStyle(KachelDruckStil())
            .stundenMenue(k) { antippen(k, tag, quelle) }
        } else {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Farben.flaeche2)
                .overlay {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .strokeBorder(Farben.linie, lineWidth: 1)
                }
                .frame(height: h)
                .accessibilityHidden(true)
        }
    }
}

/// Zelle der Wochenmatrix: Fach (fett) und Raum, Status als Farbe bzw. Muster.
struct MatrixZelle: View {
    let kachel: Kachel
    let weitere: Int
    let vergangen: Bool

    private var entfall: Bool { kachel.art == .entfall }

    private var flaeche: Color {
        switch kachel.art {
        case .entfall: return Farben.entfallFlaeche
        case .klausur: return Farben.pruefungFlaeche
        case .termin, .veranstaltung, .ganztagTermin: return Farben.terminFlaeche
        case .abgegeben, .bereitschaftAbwesend: return Farben.flaeche
        case .bereitschaft, .aufsicht: return Farben.flaeche2
        default: return Fachfarbe.ton(kachel.balkenHex) ?? Farben.flaeche2
        }
    }

    private var rand: Color {
        switch kachel.art {
        case .aenderung: return Farben.aenderung
        case .klausur: return Farben.pruefung
        case .termin, .veranstaltung: return Farben.termin.opacity(0.7)
        case .entfall: return Farben.entfall.opacity(0.4)
        case .abgegeben, .bereitschaftAbwesend, .bereitschaft: return Farben.randStark
        default: return kachel.raumAenderung ? Farben.aenderung : Color.clear
        }
    }

    private var strich: StrokeStyle {
        let breite: CGFloat = kachel.art == .aenderung || kachel.raumAenderung ? 1.5 : 1
        switch kachel.art {
        case .termin, .veranstaltung, .abgegeben, .bereitschaft:
            return StrokeStyle(lineWidth: breite, dash: [3, 2])
        default:
            return StrokeStyle(lineWidth: breite)
        }
    }

    var body: some View {
        let form = RoundedRectangle(cornerRadius: 8, style: .continuous)
        VStack(spacing: 1) {
            Text(kachel.anzeigeTitel)
                .font(.caption.weight(.bold))
                .foregroundStyle(entfall ? Farben.text2 : Farben.text)
                .strikethrough(entfall, color: Farben.entfall)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            if let r = kachel.zeile("raum"), !r.text.isEmpty {
                kachelText(r, karte: kachel.karte)
                    .font(.caption2)
                    .monospacedDigit()
                    .foregroundStyle(Farben.text2)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            } else if kachel.online {
                Image(systemName: "video.fill")
                    .font(.caption2)
                    .foregroundStyle(Farben.akzent)
            }
        }
        .padding(.horizontal, 2)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background {
            ZStack {
                form.fill(flaeche)
                if entfall {
                    Streifenmuster(abstand: 6)
                        .stroke(Farben.entfall.opacity(0.18), lineWidth: 1)
                        .clipShape(form)
                }
            }
        }
        .overlay {
            form.strokeBorder(rand, style: strich)
        }
        .overlay(alignment: .topTrailing) {
            if let m = Statuslehre.merkmal(kachel), kachel.art != .normal {
                Circle()
                    .fill(m.farbe)
                    .frame(width: 6, height: 6)
                    .padding(3)
            } else if weitere > 0 {
                Text("+\(weitere)")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(Farben.text2)
                    .padding(2)
            }
        }
        .opacity(vergangen ? 0.6 : 1)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(kachel.vorlesetext)
        .accessibilityAddTraits(.isButton)
    }
}
