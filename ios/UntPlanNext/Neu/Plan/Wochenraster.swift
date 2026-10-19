import SwiftUI

// Wochenansicht (Standard des Plans) im klassischen Grunddesign bekannter Stundenplanportale, aber eigenständig:
// Spalten Montag bis Freitag (bzw. die Schultage der Woche), Zeilen = Stunden des Zeitrasters mit Nummer und Uhrzeit,
// kompakte Karten nach der schulweiten Kartendarstellung (Fach fett oben links, Raum oben rechts, Lehrkraft bzw.
// Klasse darunter, Fachfarbe als Balken bzw. Tönung). Heute ist hervorgehoben, darüber läuft die Jetzt-Linie. Große
// Pausen stehen als schmaler Spalt im Raster. Waagrecht wischen = andere Woche (Seiten), Aufziehen mit zwei Fingern
// bzw. Dichte im Menü = kompakter oder großzügiger, im Querformat breite Spalten. Antippen öffnet die Stunde groß,
// langes Drücken zeigt die Aktionen der Stunde, Antippen des Tageskopfs öffnet den Tag.

// MARK: - Dichte

/// Dichte des Wochenrasters (Faktor der Zeilenhöhe; Aufziehen mit zwei Fingern stellt stufenlos ein).
enum Wochendichte {
    static let schluessel = "wocheDichte"
    static let kompakt: Double = 0.82
    static let normal: Double = 1.0
    static let komfortabel: Double = 1.3
    static let bereich: ClosedRange<Double> = 0.7...1.9
}

/// Auswahl der Dichte (Menü des Plans und Darstellung).
struct WochendichteAuswahl: View {
    @AppStorage(Wochendichte.schluessel) private var dichte: Double = Wochendichte.normal

    var body: some View {
        Picker("Dichte der Woche", selection: Binding(get: { naechste(dichte) }, set: { dichte = $0 })) {
            Text("Kompakt").tag(Wochendichte.kompakt)
            Text("Normal").tag(Wochendichte.normal)
            Text("Komfortabel").tag(Wochendichte.komfortabel)
        }
    }

    /// Nächste Stufe (nach dem Aufziehen liegt der Wert dazwischen).
    private func naechste(_ wert: Double) -> Double {
        [Wochendichte.kompakt, Wochendichte.normal, Wochendichte.komfortabel].min { abs($0 - wert) < abs($1 - wert) } ?? Wochendichte.normal
    }
}

// MARK: - Seiten (Wochen waagrecht)

/// Wochen als waagrechte Seiten: wischen = vorige bzw. nächste Woche. Die gewählte Woche folgt `montag`.
struct WochenSeiten: View {
    @ObservedObject var modell: Planmodell
    let montage: [String]
    @Binding var montag: String
    let raum: Namespace.ID?
    let antippen: (Kachel, Tagesansicht, String) -> Void
    let tagOeffnen: (String) -> Void

    @State private var position: String? = nil

    var body: some View {
        ScrollView(.horizontal) {
            LazyHStack(spacing: 0) {
                ForEach(montage, id: \.self) { m in
                    WochenSeite(modell: modell, montag: m, raum: raum, antippen: antippen, tagOeffnen: tagOeffnen)
                        .containerRelativeFrame(.horizontal)
                        .id(m)
                }
            }
            .scrollTargetLayout()
        }
        .scrollTargetBehavior(.paging)
        .scrollIndicators(.hidden)
        .scrollPosition(id: $position)
        .onAppear { position = montag }
        .onChange(of: montag) { _, neu in
            if position != neu { position = neu }
        }
        .onChange(of: position) { _, neu in
            if let neu, neu != montag { montag = neu }
        }
    }
}

/// Eine Woche: Kennzahlen und Raster, senkrecht rollbar, zum Aktualisieren nach unten ziehen.
struct WochenSeite: View {
    @ObservedObject var modell: Planmodell
    let montag: String
    let raum: Namespace.ID?
    let antippen: (Kachel, Tagesansicht, String) -> Void
    let tagOeffnen: (String) -> Void

    var body: some View {
        ScrollView(.vertical) {
            Wochenraster(modell: modell, montag: montag, raum: raum, antippen: antippen, tagOeffnen: tagOeffnen)
                .padding(.bottom, 3 * Stilmass.raster)
        }
        .scrollIndicators(.hidden)
        .refreshable {
            await modell.laden(montag: montag, erzwingen: true)
            Haptik.erfolg()
        }
        .task(id: "\(modell.typ)|\(modell.element)|\(montag)") {
            await modell.laden(montag: montag)
        }
    }
}

// MARK: - Raster

struct Wochenraster: View {
    @ObservedObject var modell: Planmodell
    let montag: String
    let raum: Namespace.ID?
    let antippen: (Kachel, Tagesansicht, String) -> Void
    let tagOeffnen: (String) -> Void

    @AppStorage(Wochendichte.schluessel) private var dichte: Double = Wochendichte.normal
    @Environment(\.kartendarstellung) private var darstellung
    @ScaledMetric(relativeTo: .caption) private var grundHoehe: CGFloat = 50
    @ScaledMetric(relativeTo: .caption) private var zeitBreite: CGFloat = 40
    /// Vorläufiger Faktor während des Aufziehens
    @State private var zoom: Double = 1

    private let kopfHoehe: CGFloat = 40
    private let spalt: CGFloat = 2

    private var tage: [String] { modell.tage(montag: montag) }

    private var raster: [Rasterzeit] {
        for d in tage {
            if let t = modell.tag(d), !t.raster.isEmpty { return t.raster }
        }
        return []
    }

    private var zeilenHoehe: CGFloat {
        CGFloat(min(Wochendichte.bereich.upperBound, max(Wochendichte.bereich.lowerBound, dichte * zoom))) * grundHoehe
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            kennzahlen
                .padding(.horizontal, Stilmass.rand)
            if let p = modell.plan(montag: montag) {
                if p.gesperrt {
                    let hinweis = (p.sperrhinweis ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                    Hinweisfeld(titel: "Nicht freigegeben",
                                text: hinweis.isEmpty ? "Diese Woche ist für Ihr Konto noch nicht einsehbar." : hinweis,
                                symbol: "lock", minHoehe: 160, flaeche: Farben.flaeche)
                        .padding(.horizontal, Stilmass.rand)
                } else if raster.isEmpty {
                    Hinweisfeld(titel: "Kein Unterricht", text: "In dieser Woche ist kein Unterricht geplant.", symbol: "sun.max",
                                minHoehe: 160, flaeche: Farben.flaeche)
                        .padding(.horizontal, Stilmass.rand)
                } else {
                    rasterflaeche
                        .padding(.horizontal, 8)
                }
            } else if modell.fehler != nil && !modell.laedt(montag: montag) {
                Hinweisfeld(titel: "Plan nicht geladen", text: "Zum Aktualisieren nach unten ziehen.", symbol: "wifi.exclamationmark",
                            flaeche: Farben.flaeche)
                    .padding(.horizontal, Stilmass.rand)
            } else {
                Platzhaltertag()
            }
        }
        .padding(.top, Stilmass.raster)
    }

    // MARK: Kennzahlen

    private var kennzahlen: some View {
        let ansichten = tage.compactMap { modell.tag($0) }
        let stunden = ansichten.reduce(0) { $0 + $1.anzahlStunden }
        let entfall = ansichten.reduce(0) { $0 + $1.anzahlEntfall }
        let aenderung = ansichten.reduce(0) { $0 + $1.anzahlAenderung }
        let pruefung = ansichten.reduce(0) { $0 + $1.anzahlPruefung }
        var text = Text("\(stunden) Std.").foregroundColor(Farben.text2)
        if aenderung > 0 {
            text = text + Text("  ·  ").foregroundColor(Farben.text3)
                + Text("\(aenderung) Änd.").foregroundColor(Farben.aenderung).fontWeight(.bold)
        }
        if entfall > 0 {
            text = text + Text("  ·  ").foregroundColor(Farben.text3)
                + Text("\(entfall) Entf.").foregroundColor(Farben.entfall).fontWeight(.bold)
        }
        if pruefung > 0 {
            text = text + Text("  ·  ").foregroundColor(Farben.text3)
                + Text(pruefung == 1 ? "1 Prüfung" : "\(pruefung) Prüfungen").foregroundColor(Farben.pruefung).fontWeight(.bold)
        }
        return HStack {
            text
                .font(.subheadline)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: Lage der Zeilen

    /// Oberkante jeder Rasterzeile (unter dem Kopf); große Pausen (ab 15 Minuten) als Spalt.
    private func zeilenLage() -> (oben: [CGFloat], hoehe: CGFloat) {
        var oben: [CGFloat] = []
        var y: CGFloat = 0
        for (i, r) in raster.enumerated() {
            if i > 0 {
                let pause = r.beginn - raster[i - 1].ende
                y += pause >= 15 ? 10 : spalt
            }
            oben.append(y)
            y += zeilenHoehe
        }
        return (oben, y)
    }

    /// Senkrechte Lage einer Uhrzeit (Minuten) im Raster; nil außerhalb des Schultags.
    private func lage(_ minute: Int, oben: [CGFloat]) -> CGFloat? {
        guard let erste = raster.first, let letzte = raster.last, minute >= erste.beginn, minute <= letzte.ende else { return nil }
        for (i, r) in raster.enumerated() {
            if minute >= r.beginn && minute <= r.ende {
                let anteil = CGFloat(minute - r.beginn) / CGFloat(max(1, r.ende - r.beginn))
                return oben[i] + anteil * zeilenHoehe
            }
            if i + 1 < raster.count, minute > r.ende, minute < raster[i + 1].beginn {
                return (oben[i] + zeilenHoehe + oben[i + 1]) / 2
            }
        }
        return nil
    }

    /// Erste und letzte Rasterzeile einer Kachel (über die Stundennummern, sonst über die Uhrzeit).
    private func zeilen(_ k: Kachel) -> (von: Int, bis: Int)? {
        if let a = raster.firstIndex(where: { $0.nr == k.von }), let b = raster.firstIndex(where: { $0.nr == k.bis }), b >= a {
            return (a, b)
        }
        guard let a = raster.firstIndex(where: { $0.ende > k.beginn }),
              let b = raster.lastIndex(where: { $0.beginn < k.ende }), b >= a else { return nil }
        return (a, b)
    }

    // MARK: Fläche

    private var rasterflaeche: some View {
        GeometryReader { geo in
            let zl = zeilenLage()
            let spalten = max(tage.count, 1)
            let breite = max(0, (geo.size.width - zeitBreite - CGFloat(spalten) * 3) / CGFloat(spalten))
            ZStack(alignment: .topLeading) {
                // Hellgrauer Grund mit feinen Stundenlinien
                rastergrund(oben: zl.oben, hoehe: zl.hoehe)
                    .frame(width: max(0, geo.size.width - zeitBreite), height: zl.hoehe)
                    .offset(x: zeitBreite, y: kopfHoehe)
                // Stundenspalte
                ForEach(Array(raster.enumerated()), id: \.offset) { i, r in
                    zeitZelle(r)
                        .frame(width: zeitBreite, height: zeilenHoehe)
                        .offset(x: 0, y: kopfHoehe + zl.oben[i])
                }
                // Tage
                ForEach(Array(tage.enumerated()), id: \.element) { i, d in
                    let x = zeitBreite + 3 + CGFloat(i) * (breite + 3)
                    tagesSpalte(d, breite: breite, oben: zl.oben, hoehe: zl.hoehe)
                        .frame(width: breite, height: kopfHoehe + zl.hoehe, alignment: .topLeading)
                        .offset(x: x, y: 0)
                }
                // Jetzt-Linie über dem heutigen Tag
                if let i = tage.firstIndex(where: { Datumsformat.istHeute($0) }) {
                    let x = zeitBreite + 3 + CGFloat(i) * (breite + 3)
                    TimelineView(.periodic(from: .now, by: 30)) { kontext in
                        if let y = lage(Uhr.minuten(kontext.date), oben: zl.oben) {
                            JetztLinie()
                                .frame(width: breite + 6, height: 8)
                                .offset(x: x - 4, y: kopfHoehe + y - 4)
                                .allowsHitTesting(false)
                        }
                    }
                }
            }
            .frame(width: geo.size.width, height: kopfHoehe + zl.hoehe, alignment: .topLeading)
        }
        .frame(height: kopfHoehe + zeilenLage().hoehe)
        .simultaneousGesture(
            MagnifyGesture()
                .onChanged { wert in zoom = Double(wert.magnification) }
                .onEnded { wert in
                    dichte = min(Wochendichte.bereich.upperBound, max(Wochendichte.bereich.lowerBound, dichte * Double(wert.magnification)))
                    zoom = 1
                }
        )
        .animation(.snappy(duration: 0.2), value: dichte)
    }

    private func zeitZelle(_ r: Rasterzeit) -> some View {
        VStack(spacing: 1) {
            Text("\(r.nr)")
                .font(.caption.weight(.bold))
                .foregroundStyle(Farben.text2)
            Text(Uhr.uhrzeit(r.beginn))
                .font(.caption2)
                .foregroundStyle(Farben.text3)
            if zeilenHoehe >= 58 {
                Text(Uhr.uhrzeit(r.ende))
                    .font(.caption2)
                    .foregroundStyle(Farben.text3.opacity(0.8))
            }
        }
        .monospacedDigit()
        .dynamicTypeSize(...DynamicTypeSize.xLarge)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(r.nr). Stunde, \(Uhr.uhrzeit(r.beginn)) bis \(Uhr.uhrzeit(r.ende))")
    }

    // MARK: Tagesspalte

    private func tagesSpalte(_ d: String, breite: CGFloat, oben: [CGFloat], hoehe: CGFloat) -> some View {
        let heute = Datumsformat.istHeute(d)
        let t = modell.tag(d)
        return ZStack(alignment: .topLeading) {
            // Heute: Spalte leicht in Petrol getönt
            Rectangle()
                .fill(heute ? Farben.akzent.opacity(0.08) : Color.clear)
                .frame(width: breite, height: hoehe)
                .offset(y: kopfHoehe)
                .accessibilityHidden(true)
            kopf(d, heute: heute, breite: breite)
            if let t, let f = t.freiText {
                freiFeld(f.titel, breite: breite, hoehe: hoehe)
                    .offset(y: kopfHoehe)
            } else if let t {
                ForEach(bloecke(t, breite: breite)) { b in
                    karte(b, tag: t, oben: oben, breite: breite)
                }
                ForEach(aufsichten(t, oben: oben)) { a in
                    aufsichtZeichen(a, tag: t, breite: breite)
                }
            }
        }
    }

    /// Tageskopf: schlicht grau und mittig („Mo 19.10.“), heute in Petrol mit feiner Linie; Antippen öffnet den Tag.
    private func kopf(_ d: String, heute: Bool, breite: CGFloat) -> some View {
        let t = modell.tag(d)
        let entfall = (t?.anzahlEntfall ?? 0) > 0
        let aenderung = (t?.anzahlAenderung ?? 0) > 0
        return Button {
            Haptik.auswahl()
            tagOeffnen(d)
        } label: {
            VStack(spacing: 1) {
                Text(Datumsformat.anzeige(d, "EE").replacingOccurrences(of: ".", with: ""))
                    .font(.caption.weight(heute ? .bold : .semibold))
                HStack(spacing: 3) {
                    Text(Datumsformat.anzeige(d, "d.M."))
                        .font(.caption2)
                        .monospacedDigit()
                    if entfall || aenderung {
                        Circle()
                            .fill(entfall ? Farben.entfall : Farben.aenderung)
                            .frame(width: 5, height: 5)
                    }
                }
            }
            .foregroundStyle(heute ? Farben.akzent : Farben.text2)
            .dynamicTypeSize(...DynamicTypeSize.xLarge)
            .frame(width: breite, height: kopfHoehe - 4)
            .overlay(alignment: .bottom) {
                if heute {
                    Capsule().fill(Farben.akzent).frame(width: min(28, breite * 0.6), height: 2)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel((heute ? "Heute, " : "") + Datumsformat.anzeige(d, "EEEE, d. MMMM") + ". Tag öffnen")
        .accessibilityAddTraits(.isHeader)
    }

    /// Hellgrauer Grund des Rasters mit feinen Linien an den Stundengrenzen.
    private func rastergrund(oben: [CGFloat], hoehe: CGFloat) -> some View {
        ZStack(alignment: .topLeading) {
            Rectangle().fill(Farben.rasterGrund)
            ForEach(Array(oben.enumerated()), id: \.offset) { _, y in
                Rectangle()
                    .fill(Farben.rasterLinie)
                    .frame(height: 0.5)
                    .offset(y: y)
                Rectangle()
                    .fill(Farben.rasterLinie)
                    .frame(height: 0.5)
                    .offset(y: y + zeilenHoehe - 0.5)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
        .accessibilityHidden(true)
    }

    private func freiFeld(_ titel: String, breite: CGFloat, hoehe: CGFloat) -> some View {
        VStack(spacing: 6) {
            Image(systemName: "sun.max")
                .font(.footnote)
            Text(titel)
                .font(.caption2.weight(.semibold))
                .multilineTextAlignment(.center)
                .lineLimit(6)
                .minimumScaleFactor(0.7)
        }
        .foregroundStyle(Farben.frei)
        .padding(4)
        .frame(width: breite, height: hoehe)
        .background(Farben.freiFlaeche, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    // MARK: Blöcke

    /// Karte im Raster: Zeilen, Spur (gleichzeitige Stunden nebeneinander) und weitere verdeckte Stunden.
    private struct Block: Identifiable {
        let kachel: Kachel
        let von: Int
        let bis: Int
        let spur: Int
        let spuren: Int
        let weitere: Int
        var id: UUID { kachel.id }
    }

    /// Gleichzeitige Stunden nebeneinander (je nach Spaltenbreite bis zu 3 Spuren); passen nicht alle, steht die
    /// wichtigste (Änderungen zuerst) vorn mit „+n“.
    private func bloecke(_ t: Tagesansicht, breite: CGFloat) -> [Block] {
        let maxSpuren = breite >= 150 ? 3 : (breite >= 84 ? 2 : 1)
        let liste = t.kacheln
            .filter { !$0.inPause && $0.karte != nil }
            .compactMap { k -> (Kachel, Int, Int)? in
                guard let z = zeilen(k) else { return nil }
                return (k, z.von, z.bis)
            }
            .sorted { a, b in
                if a.1 != b.1 { return a.1 < b.1 }
                if a.0.vorrang != b.0.vorrang { return a.0.vorrang }
                return a.0.rang < b.0.rang
            }
        // Gruppen sich überschneidender Stunden
        var gruppen: [[(Kachel, Int, Int)]] = []
        var ende = -1
        for e in liste {
            if var letzte = gruppen.last, e.1 <= ende {
                letzte.append(e)
                gruppen[gruppen.count - 1] = letzte
                ende = max(ende, e.2)
            } else {
                gruppen.append([e])
                ende = e.2
            }
        }
        var ergebnis: [Block] = []
        for g in gruppen {
            // Spuren verteilen (erste freie Spur)
            var spurEnde: [Int] = []
            var zuordnung: [(Kachel, Int, Int, Int)] = []
            for e in g {
                if let s = spurEnde.firstIndex(where: { $0 < e.1 }) {
                    spurEnde[s] = e.2
                    zuordnung.append((e.0, e.1, e.2, s))
                } else {
                    spurEnde.append(e.2)
                    zuordnung.append((e.0, e.1, e.2, spurEnde.count - 1))
                }
            }
            let spuren = spurEnde.count
            if spuren <= maxSpuren {
                for z in zuordnung {
                    ergebnis.append(Block(kachel: z.0, von: z.1, bis: z.2, spur: z.3, spuren: spuren, weitere: 0))
                }
            } else {
                // Nur die ersten Spuren zeigen; die letzte sichtbare Spur zählt die übrigen Stunden mit
                let sichtbar = max(1, maxSpuren)
                for z in zuordnung where z.3 < sichtbar {
                    let verdeckt = zuordnung.filter { $0.3 >= sichtbar && $0.1 <= z.2 && z.1 <= $0.2 }.count
                    ergebnis.append(Block(kachel: z.0, von: z.1, bis: z.2, spur: z.3, spuren: sichtbar,
                                          weitere: z.3 == sichtbar - 1 ? verdeckt : 0))
                }
            }
        }
        return ergebnis
    }

    @ViewBuilder
    private func karte(_ b: Block, tag: Tagesansicht, oben: [CGFloat], breite: CGFloat) -> some View {
        let quelle = "woche-\(b.kachel.id.uuidString)"
        let y = kopfHoehe + oben[b.von]
        let h = oben[b.bis] + zeilenHoehe - oben[b.von]
        let luecke: CGFloat = 2
        let spuren = CGFloat(max(b.spuren, 1))
        let kw = max(0, (breite - (spuren - 1) * luecke) / spuren)
        let x = CGFloat(b.spur) * (kw + luecke)
        Button {
            antippen(b.kachel, tag, quelle)
        } label: {
            RasterKarte(kachel: b.kachel, weitere: b.weitere, hoehe: h,
                        vergangen: Tagesansicht.vergangen(b.kachel, jetzt: Date()))
                .zoomQuelle(quelle, in: raum)
        }
        .buttonStyle(KachelDruckStil())
        .stundenMenue(b.kachel) { antippen(b.kachel, tag, quelle) }
        .frame(width: kw, height: max(0, h))
        .offset(x: x, y: y)
    }

    // MARK: Pausenaufsichten

    private struct AufsichtLage: Identifiable {
        let kachel: Kachel
        let y: CGFloat
        var id: UUID { kachel.id }
    }

    private func aufsichten(_ t: Tagesansicht, oben: [CGFloat]) -> [AufsichtLage] {
        t.kacheln.filter { $0.inPause && $0.aufsicht != nil }.compactMap { k in
            guard let y = lage((k.beginn + k.ende) / 2, oben: oben) else { return nil }
            return AufsichtLage(kachel: k, y: y)
        }
    }

    private func aufsichtZeichen(_ a: AufsichtLage, tag: Tagesansicht, breite: CGFloat) -> some View {
        let m = Statuslehre.merkmal(a.kachel)
        let quelle = "woche-a-\(a.kachel.id.uuidString)"
        return Button {
            antippen(a.kachel, tag, quelle)
        } label: {
            HStack(spacing: 2) {
                Image(systemName: "figure.walk")
                    .font(.system(size: 8, weight: .bold))
                if breite >= 70 {
                    Text(a.kachel.anzeigeTitel)
                        .font(.system(size: 9, weight: .semibold))
                        .lineLimit(1)
                }
            }
            .foregroundStyle(a.kachel.aufsichtsstand == .vertretung ? Farben.aenderung : Farben.text2)
            .padding(.horizontal, 4)
            .frame(height: 12)
            .background(Farben.flaeche, in: Capsule())
            .overlay { Capsule().strokeBorder(m?.betont == true ? (m?.farbe ?? Farben.randStark) : Farben.randStark, lineWidth: 1) }
            .zoomQuelle(quelle, in: raum)
        }
        .buttonStyle(.plain)
        .offset(x: 4, y: kopfHoehe + a.y - 6)
        .accessibilityLabel("Pausenaufsicht \(a.kachel.anzeigeTitel), \(a.kachel.zeitText)")
    }
}

/// Jetzt-Linie: Punkt links und eine Linie in der Akzentfarbe.
struct JetztLinie: View {
    var body: some View {
        HStack(spacing: 0) {
            Circle()
                .fill(Farben.akzent)
                .frame(width: 8, height: 8)
            Rectangle()
                .fill(Farben.akzent)
                .frame(height: 2)
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Karte im Raster

/// Karte des Wochenrasters im klassischen Grunddesign (angelehnt an bekannte Stundenplanportale, aber eigenständig):
/// weiße Karte ohne Rahmen, Radius 2, schmaler 3-pt-Balken innen am linken Rand (grau, mit Fachfarbe, falls
/// vorhanden), oben links drei kurze Zeilen untereinander – Lehrkraft bzw. Klasse fett, Fach, Raum klein. Doppelstunden
/// als eine hohe Karte. Darüber der eigene Status: Entfall rot durchgestrichen und schraffiert, Änderung violett
/// (Balken, Fläche, „alt → neu“), Prüfung Bernstein, offene Vertretung, Termin und Buchung gestrichelt.
struct RasterKarte: View {
    let kachel: Kachel
    let weitere: Int
    let hoehe: CGFloat
    let vergangen: Bool

    @Environment(\.kartendarstellung) private var darstellung

    private var art: Kartenart { kachel.kartenart }
    private var entfall: Bool { art == .entfall }

    /// Erste Personenzeile (im Klassenplan die Lehrkraft, im Lehrerplan die Klasse).
    private var person: Kachelzeile? {
        kachel.personenzeilen.first { !$0.text.isEmpty }
    }

    var body: some View {
        let stil = Klassikstil.fuer(kachel, darstellung)
        let raum = kachel.zeile("raum").flatMap { $0.text.isEmpty ? nil : $0 }
        let zeilen = hoehe >= 44 ? 3 : (hoehe >= 30 ? 2 : 1)
        VStack(alignment: .leading, spacing: 0) {
            if let person, zeilen >= 1 {
                kachelText(person, karte: kachel.karte)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(entfall ? Farben.entfall : Farben.text)
                    .strikethrough(entfall, color: Farben.entfall)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            if person == nil || zeilen >= 2 {
                Text(kachel.fachText(darstellung))
                    .font(.system(size: person == nil ? 12 : 11, weight: person == nil ? .bold : .regular))
                    .foregroundStyle(entfall ? Farben.entfall : (person == nil ? Farben.text : Farben.text2))
                    .strikethrough(entfall, color: Farben.entfall)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            if zeilen >= 3 || (person == nil && zeilen >= 2) {
                if let raum {
                    kachelText(raum, karte: kachel.karte)
                        .font(.system(size: 11))
                        .monospacedDigit()
                        .foregroundStyle(Farben.text2)
                        .strikethrough(entfall, color: Farben.entfall)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                } else if kachel.online {
                    Image(systemName: "video.fill")
                        .font(.system(size: 9))
                        .foregroundStyle(Farben.akzent)
                }
            }
            Spacer(minLength: 0)
            if hoehe >= 64, let m = Statuslehre.kartenwort(kachel, darstellung) {
                Statuswort(merkmal: m)
            }
        }
        .dynamicTypeSize(...DynamicTypeSize.xLarge)
        .padding(.leading, 9)
        .padding(.trailing, 3)
        .padding(.top, 3)
        .padding(.bottom, 2)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .klassikKarte(stil)
        .overlay(alignment: .bottomTrailing) {
            if weitere > 0 {
                Text("+\(weitere)")
                    .font(.system(size: 9, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(Farben.aufAkzent)
                    .padding(.horizontal, 4)
                    .padding(.vertical, 1)
                    .background(Farben.akzent, in: Capsule())
                    .padding(2)
            }
        }
        .overlay(alignment: .topTrailing) {
            if let m = Statuslehre.merkmal(kachel), m.betont, hoehe < 64 || Statuslehre.kartenwort(kachel, darstellung) == nil {
                Circle()
                    .fill(m.farbe)
                    .frame(width: 5, height: 5)
                    .padding(3)
            }
        }
        .opacity(vergangen ? 0.6 : (stil.gedaempft && !entfall ? 0.75 : 1))
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(kachel.vorlesetext + (weitere > 0 ? ", \(weitere) weitere Stunden zur selben Zeit" : ""))
        .accessibilityAddTraits(.isButton)
    }
}
