import SwiftUI

/// Die laufende Stunde als Karte: Fortschrittsring mit Restzeit, Fach, Raum und Lehrkraft bzw. Klasse, Status, darunter
/// die Bedienknöpfe aus Glas (Details, Raumplan, Online beitreten) und die nächste Stunde. In der Pause bzw. vor dem
/// Unterricht zählt der Ring bis zur nächsten Stunde herunter. Die Karte selbst ist deckend (Inhalt), nur die Knöpfe
/// sind Glas.
struct JetztKarte: View {
    /// Kacheln des heutigen Tages
    let kacheln: [Kachel]
    let raum: Namespace.ID?
    let antippen: (Kachel, String) -> Void

    @EnvironmentObject var zustand: AppZustand
    @Environment(\.openURL) private var oeffneURL
    @ScaledMetric(relativeTo: .title) private var ringMass: CGFloat = 72

    var body: some View {
        TimelineView(.periodic(from: .now, by: 15)) { kontext in
            let d = kontext.date
            let k = Datumsformat.kalender
            let genau = Double(k.component(.hour, from: d) * 60 + k.component(.minute, from: d)) + Double(k.component(.second, from: d)) / 60
            if let lage = Jetztlage.berechnen(kacheln, minuten: Uhr.minuten(d)) {
                inhalt(lage, genau: genau)
            }
        }
    }

    private func restMinuten(_ lage: Jetztlage, _ genau: Double) -> Int {
        max(0, Int((Double(lage.bis) - genau).rounded(.up)))
    }

    @ViewBuilder
    private func inhalt(_ lage: Jetztlage, genau: Double) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                Circle()
                    .fill(lage.phase == .danach ? Farben.text3 : Farben.akzent)
                    .frame(width: 7, height: 7)
                    .accessibilityHidden(true)
                Text(kopfzeile(lage))
                    .font(.caption.weight(.bold))
                    .tracking(0.5)
                    .foregroundStyle(lage.phase == .danach ? Farben.text3 : Farben.akzent)
                Spacer()
                Text(Uhr.uhrzeit(Int(genau)))
                    .font(.caption.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(Farben.text3)
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 10)
            .accessibilityElement(children: .combine)

            switch lage.phase {
            case .laeuft:
                if let a = lage.aktuell {
                    hauptzeile(kachel: a, lage: lage, genau: genau, titel: nil)
                    steuerung(a)
                }
            case .pause, .vorher:
                if let n = lage.naechste {
                    hauptzeile(kachel: n, lage: lage, genau: genau,
                               titel: lage.phase == .pause ? "Pause bis \(Uhr.uhrzeit(n.beginn))" : "Beginn um \(Uhr.uhrzeit(n.beginn))")
                    steuerung(n)
                }
            case .danach:
                HStack(spacing: 12) {
                    Image(systemName: "checkmark.circle")
                        .font(.title2)
                        .foregroundStyle(Farben.ok)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Unterricht für heute beendet")
                            .font(.headline)
                            .foregroundStyle(Farben.text)
                        Text("Letzte Stunde bis \(Uhr.uhrzeit(lage.von))")
                            .font(.subheadline)
                            .foregroundStyle(Farben.text2)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
                .accessibilityElement(children: .combine)
            }

            if lage.phase == .laeuft {
                Divider().padding(.leading, 16)
                naechsteZeile(lage.naechste)
            }
        }
        .kartenflaeche()
    }

    /// Bedienknöpfe aus Glas: Details, Raumplan, Online beitreten (Petrol hervorgehoben).
    private func steuerung(_ k: Kachel) -> some View {
        let quelle = "jetzt-\(k.id.uuidString)"
        let raumPlan = k.karte.flatMap { karte in Planziele.fuer(karte, zustand: zustand).first { $0.typ == "raum" } }
        let online = k.karte.flatMap { karte in karte.online ? Karte.onlineURL(karte.onlineLink) : nil }
        return GlasGruppe(abstand: 8) {
            HStack(spacing: 8) {
                Button {
                    antippen(k, quelle)
                } label: {
                    Text("Details")
                }
                .glasKnopf()
                if let raumPlan {
                    Button {
                        Haptik.auswahl()
                        zustand.planZeigen(raumPlan)
                    } label: {
                        Text("Raum \(raumPlan.anzeige)")
                            .lineLimit(1)
                    }
                    .glasKnopf()
                    .accessibilityLabel("Raumplan \(raumPlan.anzeige)")
                }
                if let online {
                    Button {
                        Haptik.tippen()
                        oeffneURL(online)
                    } label: {
                        Text("Beitreten")
                    }
                    .glasKnopf(hervorgehoben: true)
                }
                Spacer(minLength: 0)
            }
        }
        .font(.subheadline.weight(.semibold))
        .padding(.horizontal, 16)
        .padding(.bottom, 16)
    }

    private func kopfzeile(_ lage: Jetztlage) -> String {
        switch lage.phase {
        case .laeuft: return "JETZT"
        case .pause: return "PAUSE"
        case .vorher: return "GLEICH"
        case .danach: return "HEUTE"
        }
    }

    private func hauptzeile(kachel: Kachel, lage: Jetztlage, genau: Double, titel: String?) -> some View {
        let quelle = "jetzt-\(kachel.id.uuidString)"
        let farbe = Fachfarbe.voll(kachel.balkenHex) ?? Farben.akzent
        let rest = restMinuten(lage, genau)
        return Button {
            antippen(kachel, quelle)
        } label: {
            HStack(alignment: .center, spacing: 16) {
                ZStack {
                    Circle()
                        .stroke(Farben.neutralFlaeche, lineWidth: 8)
                    Circle()
                        .trim(from: 0, to: CGFloat(lage.fortschritt(genau)))
                        .stroke(farbe, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    VStack(spacing: -2) {
                        Text("\(rest)")
                            .font(.title2.weight(.bold))
                            .monospacedDigit()
                            .foregroundStyle(Farben.text)
                            .minimumScaleFactor(0.6)
                        Text("Min.")
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(Farben.text3)
                    }
                }
                .frame(width: ringMass, height: ringMass)
                .animation(.easeOut(duration: 0.4), value: lage.fortschritt(genau))
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(lage.phase == .laeuft ? "Noch \(Uhr.dauerGesprochen(rest))" : "In \(Uhr.dauerGesprochen(rest))")

                VStack(alignment: .leading, spacing: 4) {
                    if let titel {
                        Text(titel)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(Farben.text2)
                    }
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(kachel.anzeigeTitel)
                            .font(.title2.weight(.bold))
                            .foregroundStyle(Farben.text)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                        if let r = kachel.zeile("raum"), !r.text.isEmpty {
                            kachelText(r, karte: kachel.karte)
                                .font(.title3.weight(.semibold))
                                .monospacedDigit()
                                .foregroundStyle(Farben.text)
                                .lineLimit(1)
                        }
                    }
                    if !kachel.fachname.isEmpty {
                        Text(kachel.fachname)
                            .font(.subheadline)
                            .foregroundStyle(Farben.text2)
                            .lineLimit(1)
                    }
                    let personen = kachel.personenzeilen
                    if !personen.isEmpty {
                        personen.dropFirst().reduce(kachelText(personen[0], karte: kachel.karte)) { t, z in
                            t + Text("  ·  ") + kachelText(z, karte: kachel.karte)
                        }
                        .font(.subheadline)
                        .foregroundStyle(Farben.text2)
                        .lineLimit(1)
                    }
                    HStack(spacing: 6) {
                        Text(kachel.zeitText)
                            .font(.caption.weight(.medium))
                            .monospacedDigit()
                            .foregroundStyle(Farben.text3)
                        if let m = Statuslehre.merkmal(kachel) { Statusabzeichen(merkmal: m, klein: true) }
                        if kachel.online { Statusabzeichen(merkmal: Statuslehre.online, klein: true) }
                    }
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Farben.pfeil)
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 12)
            .contentShape(Rectangle())
            .zoomQuelle(quelle, in: raum)
        }
        .buttonStyle(KachelDruckStil())
        .accessibilityLabel(kachel.vorlesetext)
        .accessibilityHint("Öffnet die Stunde")
    }

    @ViewBuilder
    private func naechsteZeile(_ n: Kachel?) -> some View {
        if let n {
            let quelle = "danach-\(n.id.uuidString)"
            Button {
                antippen(n, quelle)
            } label: {
                HStack(spacing: 10) {
                    Text("Danach")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Farben.text3)
                        .frame(minWidth: 52, alignment: .leading)
                    Text(Uhr.uhrzeit(n.beginn))
                        .font(.subheadline.weight(.semibold))
                        .monospacedDigit()
                        .foregroundStyle(Farben.text)
                    if let farbe = Fachfarbe.voll(n.balkenHex) {
                        Circle().fill(farbe).frame(width: 7, height: 7).accessibilityHidden(true)
                    }
                    Text(n.anzeigeTitel)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Farben.text)
                        .lineLimit(1)
                    if let r = n.zeile("raum"), !r.text.isEmpty {
                        kachelText(r, karte: n.karte)
                            .font(.subheadline)
                            .foregroundStyle(Farben.text2)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 4)
                    if let m = Statuslehre.merkmal(n) { Statusabzeichen(merkmal: m, klein: true) }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .contentShape(Rectangle())
                .zoomQuelle(quelle, in: raum)
            }
            .buttonStyle(KachelDruckStil())
            .accessibilityLabel("Danach: " + n.vorlesetext)
        } else {
            HStack {
                Text("Danach")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Farben.text3)
                    .frame(minWidth: 52, alignment: .leading)
                Text("Keine weitere Stunde")
                    .font(.subheadline)
                    .foregroundStyle(Farben.text2)
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .accessibilityElement(children: .combine)
        }
    }
}
