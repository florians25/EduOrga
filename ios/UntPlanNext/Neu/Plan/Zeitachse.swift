import SwiftUI

/// Der Tag als Zeitachse mit echter Uhrzeit: links die Zeitspalte (volle Stunden und die Stunden des Zeitrasters als
/// Spur), rechts die Kacheln in ihrer wirklichen Länge. Pausen als ruhige Bänder, Freistunden gestrichelt, die eigene
/// Abwesenheit als graue Fläche, heute die aktuelle Uhrzeit als Linie in Marine. Gleichzeitige Stunden stehen
/// nebeneinander (Anordnung wie in UntPlan Web, `Kachelbau.anordnen`).
struct Zeitachse: View {
    let tag: Tagesansicht
    let raum: Namespace.ID?
    /// Kennung des Ankers (aktuelle Uhrzeit bzw. erste Stunde), zu dem die Seite beim Öffnen rollt
    let ankerID: String
    let antippen: (Kachel, String) -> Void

    @ScaledMetric(relativeTo: .body) private var grundMass: CGFloat = 1.45
    @AppStorage("zeitachseDichte") private var dichte: Double = 1.0

    /// Luft oben, damit die erste Uhrzeit nicht abgeschnitten wird
    private let oben: CGFloat = 10

    private var ppm: CGFloat { max(0.9, grundMass * CGFloat(dichte)) }
    private var hoehe: CGFloat { CGFloat(max(tag.schluss - tag.start, 60)) * ppm + oben * 2 }
    private func y(_ minuten: Int) -> CGFloat { oben + CGFloat(minuten - tag.start) * ppm }

    var body: some View {
        TimelineView(.everyMinute) { kontext in
            let jetzt = kontext.date
            let minute = Uhr.minuten(jetzt)
            let zeigtJetzt = tag.istHeute && minute >= tag.start && minute <= tag.schluss
            HStack(alignment: .top, spacing: 0) {
                zeitspalte(jetzt: zeigtJetzt ? minute : nil)
                    .frame(width: Stilmass.zeitspalte, height: hoehe, alignment: .topLeading)
                GeometryReader { geo in
                    inhalt(breite: geo.size.width, jetzt: jetzt, minute: zeigtJetzt ? minute : nil)
                }
                .frame(height: hoehe)
            }
            .padding(.trailing, Stilmass.rand)
        }
    }

    // MARK: - Zeitspalte

    private var volleStunden: [Int] {
        let erste = (tag.start + 59) / 60
        let letzte = tag.schluss / 60
        guard erste <= letzte else { return [] }
        return Array(erste...letzte)
    }

    private func zeitspalte(jetzt: Int?) -> some View {
        ZStack(alignment: .topLeading) {
            ForEach(volleStunden, id: \.self) { h in
                Text("\(h):00")
                    .font(.caption2.weight(.medium))
                    .monospacedDigit()
                    .foregroundStyle(Farben.text3)
                    .dynamicTypeSize(...DynamicTypeSize.xLarge)
                    .frame(width: 34, alignment: .trailing)
                    .offset(x: 0, y: y(h * 60) - 7)
                    .opacity(jetzt.map { abs($0 - h * 60) < 9 ? 0.0 : 1.0 } ?? 1.0)
            }
            // Stunden des Zeitrasters: Spur mit Nummer
            ForEach(tag.raster.filter { $0.ende > tag.start && $0.beginn < tag.schluss }) { r in
                Capsule()
                    .fill(Farben.rand)
                    .frame(width: 3, height: max(4, CGFloat(r.ende - r.beginn) * ppm - 2))
                    .offset(x: Stilmass.zeitspalte - 9, y: y(r.beginn) + 1)
                Text("\(r.nr)")
                    .font(.caption2.weight(.bold))
                    .monospacedDigit()
                    .foregroundStyle(Farben.text2)
                    .dynamicTypeSize(...DynamicTypeSize.large)
                    .frame(width: 14, alignment: .trailing)
                    .offset(x: Stilmass.zeitspalte - 26, y: y(r.beginn) + 6)
            }
            if let jetzt {
                Text(Uhr.uhrzeit(jetzt))
                    .font(.caption2.weight(.bold))
                    .monospacedDigit()
                    .foregroundStyle(Farben.aufAkzent)
                    .dynamicTypeSize(...DynamicTypeSize.xLarge)
                    .padding(.horizontal, 4)
                    .padding(.vertical, 1)
                    .background(Farben.akzent, in: Capsule())
                    .frame(width: 40, alignment: .trailing)
                    .offset(x: 0, y: y(jetzt) - 8)
                    .accessibilityLabel("Jetzt \(Uhr.uhrzeit(jetzt))")
            }
        }
        .accessibilityElement(children: .contain)
    }

    // MARK: - Inhalt

    private func ankerMinute(_ minute: Int?) -> Int {
        if let minute { return max(tag.start, minute - 40) }
        if let erste = tag.stunden.map(\.beginn).min() { return max(tag.start, erste - 20) }
        return tag.start
    }

    private func inhalt(breite: CGFloat, jetzt: Date, minute: Int?) -> some View {
        let belegung = Kachelbau.anordnen(tag.kacheln, spaltenBreite: breite, tagesansicht: true)
        var dahinter: [UUID: Int] = [:]
        for s in belegung.streifen { dahinter[s.vorne.id, default: 0] += s.kacheln.count }
        let laufend = minute.map { m in tag.stunden.filter { $0.beginn <= m && m < $0.ende && Statuslehre.findetStatt($0) }.map(\.id) } ?? []

        return ZStack(alignment: .topLeading) {
            // Anker zum Scrollen (echter Rahmen an der Stelle)
            Color.clear
                .frame(width: 1, height: 1)
                .id(ankerID)
                .padding(.top, y(ankerMinute(minute)))
                .accessibilityHidden(true)

            // Linien der vollen Stunden
            ForEach(volleStunden, id: \.self) { h in
                Rectangle()
                    .fill(Farben.linie)
                    .frame(width: breite, height: 1)
                    .offset(y: y(h * 60))
                    .accessibilityHidden(true)
            }

            // Eigene Abwesenheit
            ForEach(tag.balken) { b in
                RoundedRectangle(cornerRadius: Stilmass.kachelRadius, style: .continuous)
                    .fill(Farben.abwesendFlaeche.opacity(0.55))
                    .overlay(alignment: .topTrailing) {
                        Text(b.text)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(Farben.text2)
                            .padding(6)
                    }
                    .frame(width: breite, height: max(8, CGFloat(b.ende - b.beginn) * ppm))
                    .offset(y: y(b.beginn))
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(b.text) von \(Uhr.uhrzeit(b.beginn)) bis \(Uhr.uhrzeit(b.ende))")
            }

            // Pausen und Freistunden
            ForEach(tag.luecken) { l in
                lueckenAnsicht(l, breite: breite)
                    .offset(y: y(l.beginn))
            }

            // Kacheln
            ForEach(belegung.lagen) { lage in
                kachelAnsicht(lage, breite: breite, jetzt: jetzt, weitere: dahinter[lage.kachel.id] ?? 0,
                              laeuft: laufend.contains(lage.kachel.id))
            }

            // Jetzt-Linie
            if let minute {
                ZStack(alignment: .leading) {
                    Rectangle()
                        .fill(Farben.akzent)
                        .frame(width: breite, height: 2)
                    Circle()
                        .fill(Farben.akzent)
                        .frame(width: 9, height: 9)
                        .offset(x: -4.5)
                }
                .frame(height: 9)
                .offset(y: y(minute) - 4.5)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
            }
        }
        .frame(width: breite, height: hoehe, alignment: .topLeading)
    }

    @ViewBuilder
    private func lueckenAnsicht(_ l: Tagesluecke, breite: CGFloat) -> some View {
        let h = max(4, CGFloat(l.dauer) * ppm)
        switch l.art {
        case .pause:
            Rectangle()
                .fill(Farben.pause)
                .overlay {
                    if h >= 14 {
                        Text("Pause · \(Uhr.dauer(l.dauer))")
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(Farben.text3)
                            .dynamicTypeSize(...DynamicTypeSize.xLarge)
                            .lineLimit(1)
                    }
                }
                .frame(width: breite, height: h)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Pause, \(Uhr.dauerGesprochen(l.dauer))")
        case .frei:
            RoundedRectangle(cornerRadius: Stilmass.kachelRadius, style: .continuous)
                .strokeBorder(Farben.randStark, style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
                .overlay(alignment: .topLeading) {
                    if h >= 26 {
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Frei")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Farben.text2)
                            if h >= 46 {
                                Text(l.vonNr == l.bisNr ? "\(l.vonNr). Stunde · \(Uhr.dauer(l.dauer))"
                                                        : "\(l.vonNr).–\(l.bisNr). Stunde · \(Uhr.dauer(l.dauer))")
                                    .font(.caption)
                                    .foregroundStyle(Farben.text3)
                            }
                        }
                        .lineLimit(1)
                        .padding(8)
                    }
                }
                .frame(width: breite, height: max(4, h - 3))
                .offset(y: 1.5)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(l.vonNr == l.bisNr ? "Freistunde, \(l.vonNr). Stunde" : "Frei, \(l.vonNr). bis \(l.bisNr). Stunde")
        }
    }

    @ViewBuilder
    private func kachelAnsicht(_ lage: Kachellage, breite: CGFloat, jetzt: Date, weitere: Int, laeuft: Bool) -> some View {
        let k = lage.kachel
        let vergangen = Tagesansicht.vergangen(k, jetzt: jetzt)
        let quelle = "zeit-\(k.id.uuidString)"
        if k.inPause {
            let mitte = (y(k.beginn) + y(max(k.ende, k.beginn))) / 2
            Button {
                antippen(k, quelle)
            } label: {
                AufsichtKapsel(kachel: k, vergangen: vergangen)
                    .zoomQuelle(quelle, in: raum)
            }
            .buttonStyle(KachelDruckStil())
            .position(x: breite / 2, y: mitte)
        } else {
            let spuren = CGFloat(max(1, lage.spuren))
            let bereich = lage.breite * breite
            let spurBreite = max(20, (bereich - lage.luecke * (spuren - 1)) / spuren)
            let x = lage.links * breite + CGFloat(lage.spur) * (spurBreite + lage.luecke)
            let h = max(24, y(k.ende) - y(k.beginn) - 3)
            Button {
                antippen(k, quelle)
            } label: {
                ZeitKachel(kachel: k, hoehe: h, vergangen: vergangen, weitere: weitere, laeuft: laeuft)
                    .frame(width: spurBreite, height: h)
                    .zoomQuelle(quelle, in: raum)
            }
            .buttonStyle(KachelDruckStil())
            .position(x: x + spurBreite / 2, y: y(k.beginn) + 1.5 + h / 2)
        }
    }
}

/// Druckzustand einer Kachel: leicht verkleinert.
struct KachelDruckStil: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}
