import SwiftUI

// Der Tag als Liste klassischer Stundenkarten (in „Heute“ und in der Tagesansicht des Plans): links Beginn, Ende und
// Stunde, rechts die Karte nach der schulweiten Kartendarstellung – Fach fett oben links, Raum oben rechts, darunter
// Lehrkraft bzw. Klasse. Änderungen fallen sofort auf (violette Linie und Fläche, „alt → neu“), Entfall durchgestrichen
// und schraffiert. Pausen und Freistunden nur als kompakte Zeile. Heute: laufende Stunde mit Fortschritt und Restzeit,
// vergangene Stunden blass.

// MARK: - Einträge

/// Eintrag der Tagesliste: gleichzeitige Stunden, eine Pausenaufsicht oder eine Lücke (Pause, Freistunde).
struct Tageseintrag: Identifiable {
    enum Art {
        case stunden([Kachel])
        case aufsicht(Kachel)
        case luecke(frei: Bool, text: String)
    }

    let id: String
    let art: Art
    let beginn: Int
    let ende: Int

    var istStunde: Bool {
        if case .stunden = art { return true }
        return false
    }
}

enum Tageslistenbau {
    /// Einträge eines Tages: Stunden nach Beginn (gleichzeitige zusammen), dazwischen Lücken ab 5 Minuten (ab 30 Minuten
    /// „Frei“ mit den Stunden des Zeitrasters), Pausenaufsichten an ihrer Stelle. Ganztägige Termine gehören nicht dazu.
    static func eintraege(_ kacheln: [Kachel], raster: [Rasterzeit]) -> [Tageseintrag] {
        let sortiert = kacheln.filter { $0.art != .ganztagTermin }.sorted { ($0.beginn, $0.rang) < ($1.beginn, $1.rang) }
        var ergebnis: [Tageseintrag] = []
        var gruppe: [Kachel] = []
        var gruppenEnde = 0
        var letztesEnde: Int? = nil

        func abschliessen() {
            guard let erste = gruppe.first else { return }
            ergebnis.append(Tageseintrag(id: "s-\(erste.id.uuidString)", art: .stunden(gruppe), beginn: erste.beginn, ende: gruppenEnde))
            letztesEnde = max(letztesEnde ?? 0, gruppenEnde)
            gruppe = []
        }

        for k in sortiert where !k.inPause {
            if !gruppe.isEmpty && k.beginn < gruppenEnde {
                gruppe.append(k)
                gruppenEnde = max(gruppenEnde, k.ende)
                continue
            }
            abschliessen()
            if let e = letztesEnde, k.beginn - e >= 5 {
                ergebnis.append(luecke(von: e, bis: k.beginn, raster: raster))
            }
            gruppe = [k]
            gruppenEnde = k.ende
        }
        abschliessen()

        // Pausenaufsichten nach Uhrzeit einsortieren (hinter die Pause, in der sie liegen)
        for a in sortiert where a.inPause {
            let eintrag = Tageseintrag(id: "a-\(a.id.uuidString)", art: .aufsicht(a), beginn: a.beginn, ende: a.ende)
            let index = ergebnis.firstIndex { $0.beginn > a.beginn } ?? ergebnis.count
            ergebnis.insert(eintrag, at: index)
        }
        return ergebnis
    }

    private static func luecke(von: Int, bis: Int, raster: [Rasterzeit]) -> Tageseintrag {
        let dauer = bis - von
        let frei = dauer >= 30
        var text = frei ? "Frei" : "Pause"
        if frei {
            let stunden = raster.filter { $0.beginn >= von && $0.ende <= bis }
            if let a = stunden.first, let b = stunden.last {
                text += a.nr == b.nr ? " · \(a.nr). Std." : " · \(a.nr).–\(b.nr). Std."
            }
        }
        text += " · \(Uhr.dauer(dauer))"
        return Tageseintrag(id: "l-\(von)-\(bis)", art: .luecke(frei: frei, text: text), beginn: von, ende: bis)
    }
}

// MARK: - Liste

struct Tagesliste: View {
    /// Kacheln des Tages (ganztägige Termine stehen oben als schmale Zeilen)
    let kacheln: [Kachel]
    var raster: [Rasterzeit] = []
    let istHeute: Bool
    let raum: Namespace.ID?
    /// Kennung, zu der die Seite beim Öffnen rollt (heute: laufende bzw. nächste Stunde, sonst die erste)
    var ankerID: String? = nil
    /// Vergangene Stunden einklappen (Reiter „Heute“); nil = immer alle zeigen
    var vergangeneZeigen: Binding<Bool>? = nil
    let antippen: (Kachel, String) -> Void

    @ScaledMetric(relativeTo: .subheadline) private var zeitBreite: CGFloat = 48

    var body: some View {
        TimelineView(.periodic(from: .now, by: 30)) { kontext in
            let jetzt: Int? = istHeute ? Uhr.minuten(kontext.date) : nil
            let alle = Tageslistenbau.eintraege(kacheln, raster: raster)
            let vorbei = jetzt.map { m in alle.filter { $0.ende <= m } } ?? []
            let vorbeiStunden = vorbei.filter(\.istStunde).count
            let einklappen = vergangeneZeigen.map { !$0.wrappedValue && vorbeiStunden >= 2 } ?? false
            let sichtbar = einklappen ? alle.filter { e in !vorbei.contains { $0.id == e.id } } : alle
            let ziel = ankerZiel(sichtbar, jetzt: jetzt)
            let bald = baldBeginn(jetzt)

            VStack(alignment: .leading, spacing: Stilmass.raster) {
                ForEach(kacheln.filter { $0.art == .ganztagTermin }) { g in
                    ganztagZeile(g)
                }
                if let binding = vergangeneZeigen, vorbeiStunden >= 2 {
                    Button {
                        Haptik.auswahl()
                        withAnimation(.snappy) { binding.wrappedValue.toggle() }
                    } label: {
                        Label(binding.wrappedValue ? "Vergangene ausblenden" : "\(vorbeiStunden) Stunden vorbei – anzeigen",
                              systemImage: binding.wrappedValue ? "chevron.up" : "chevron.down")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Farben.akzent)
                            .padding(.leading, zeitBreite + 12)
                            .frame(minHeight: 32)
                    }
                    .buttonStyle(.plain)
                }
                ForEach(sichtbar) { e in
                    zeile(e, jetzt: jetzt, bald: bald)
                        .id(e.id == ziel ? (ankerID ?? e.id) : e.id)
                }
            }
        }
    }

    /// Anker: heute der erste Eintrag, der noch nicht vorbei ist; sonst die erste Stunde.
    private func ankerZiel(_ liste: [Tageseintrag], jetzt: Int?) -> String? {
        if let m = jetzt, let e = liste.first(where: { $0.istStunde && $0.ende > m }) { return e.id }
        return liste.first(where: \.istStunde)?.id
    }

    /// Nächste stattfindende Stunde (wenn gerade keine läuft) und die Minuten bis zu ihrem Beginn.
    private func baldBeginn(_ jetzt: Int?) -> (id: UUID, minuten: Int)? {
        guard let m = jetzt else { return nil }
        let stattfindend = kacheln.filter { Statuslehre.findetStatt($0) }
        if stattfindend.contains(where: { $0.beginn <= m && m < $0.ende }) { return nil }
        guard let n = stattfindend.filter({ $0.beginn > m }).min(by: { $0.beginn < $1.beginn }) else { return nil }
        return (n.id, n.beginn - m)
    }

    // MARK: Zeilen

    @ViewBuilder
    private func zeile(_ e: Tageseintrag, jetzt: Int?, bald: (id: UUID, minuten: Int)?) -> some View {
        switch e.art {
        case .stunden(let liste):
            let laeuft = jetzt.map { m in liste.contains { Statuslehre.findetStatt($0) && $0.beginn <= m && m < $0.ende } } ?? false
            HStack(alignment: .top, spacing: 12) {
                zeitspalte(e, liste: liste, laeuft: laeuft)
                VStack(spacing: Stilmass.raster) {
                    ForEach(liste) { k in
                        kachelKnopf(k, jetzt: jetzt, bald: bald?.id == k.id ? bald?.minuten : nil)
                    }
                }
            }
        case .aufsicht(let k):
            let quelle = "liste-\(k.id.uuidString)"
            HStack(spacing: 12) {
                Color.clear.frame(width: zeitBreite, height: 1)
                Button {
                    antippen(k, quelle)
                } label: {
                    AufsichtKapsel(kachel: k, vergangen: jetzt.map { k.ende <= $0 } ?? false)
                        .zoomQuelle(quelle, in: raum)
                }
                .buttonStyle(KachelDruckStil())
                Spacer(minLength: 0)
            }
        case .luecke(let frei, let text):
            lueckenZeile(e, frei: frei, text: text, jetzt: jetzt)
        }
    }

    private func zeitspalte(_ e: Tageseintrag, liste: [Kachel], laeuft: Bool) -> some View {
        let erste = liste.first
        return VStack(alignment: .trailing, spacing: 2) {
            Text(Uhr.uhrzeit(e.beginn))
                .font(.subheadline.weight(.bold))
                .foregroundStyle(laeuft ? Farben.akzent : Farben.text)
            Text(Uhr.uhrzeit(e.ende))
                .font(.caption)
                .foregroundStyle(Farben.text3)
            if let k = erste, k.von > 0 {
                Text(k.stundenText)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(Farben.text3)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        }
        .monospacedDigit()
        .frame(width: zeitBreite, alignment: .trailing)
        .padding(.top, 14)
        .accessibilityHidden(true)
    }

    private func kachelKnopf(_ k: Kachel, jetzt: Int?, bald: Int?) -> some View {
        let quelle = "liste-\(k.id.uuidString)"
        return Button {
            antippen(k, quelle)
        } label: {
            ListenKachel(kachel: k, jetzt: jetzt, bald: bald)
                .zoomQuelle(quelle, in: raum)
        }
        .buttonStyle(KachelDruckStil())
        .stundenMenue(k) { antippen(k, quelle) }
    }

    private func lueckenZeile(_ e: Tageseintrag, frei: Bool, text: String, jetzt: Int?) -> some View {
        let aktiv = jetzt.map { e.beginn <= $0 && $0 < e.ende } ?? false
        return HStack(spacing: 12) {
            Color.clear.frame(width: zeitBreite, height: 1)
            HStack(spacing: 6) {
                Image(systemName: frei ? "cup.and.saucer" : "pause.circle")
                    .imageScale(.small)
                    .accessibilityHidden(true)
                Text(text)
                if aktiv, let m = jetzt {
                    Text("· noch \(Uhr.dauer(e.ende - m))")
                        .fontWeight(.bold)
                        .foregroundStyle(Farben.akzent)
                }
            }
            .font(.footnote.weight(.medium))
            .foregroundStyle(aktiv ? Farben.text : Farben.text3)
            .lineLimit(1)
            .padding(.horizontal, frei ? 12 : 0)
            .padding(.vertical, frei ? 6 : 0)
            .background {
                if frei {
                    Capsule().strokeBorder(Farben.randStark, style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                }
            }
            Spacer(minLength: 0)
        }
        .frame(minHeight: 24)
        .opacity(jetzt.map { e.ende <= $0 ? 0.5 : 1 } ?? 1)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel((frei ? "Frei, " : "Pause, ") + Uhr.dauerGesprochen(e.ende - e.beginn))
    }

    private func ganztagZeile(_ g: Kachel) -> some View {
        let quelle = "ganz-\(g.id.uuidString)"
        return Button {
            antippen(g, quelle)
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "calendar")
                    .font(.footnote.weight(.semibold))
                    .accessibilityHidden(true)
                Text(g.anzeigeTitel)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(2)
                Spacer(minLength: 0)
                Text("Ganztägig")
                    .font(.caption.weight(.medium))
            }
            .foregroundStyle(Farben.termin)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Farben.terminFlaeche, in: RoundedRectangle(cornerRadius: Stilmass.kachelRadius, style: .continuous))
            .zoomQuelle(quelle, in: raum)
        }
        .buttonStyle(KachelDruckStil())
        .padding(.leading, zeitBreite + 12)
    }
}

// MARK: - Kachel der Liste

/// Stundenkarte der Tagesliste im klassischen Grundstil wie das Wochenraster (eigenständig, nicht nachgebaut): weiße
/// Karte ohne Rahmen, schmaler 3-pt-Balken innen links (grau bzw. Fachfarbe), Fach halbfett oben links, Raum oben
/// rechts, darunter Lehrkraft bzw. Klasse; Inhalte nach der schulweiten Kartendarstellung. Status sachlich, aber nicht zu übersehen: Entfall rot
/// durchgestrichen und schraffiert, Vertretung/Raumänderung violett (Linie, helle Fläche, „alt → neu“), Prüfung
/// Bernstein, Termin und Buchung gestrichelt; dazu das Statuswort oben rechts. Läuft die Stunde, steht „Jetzt · noch …“
/// und unten der Fortschritt.
struct ListenKachel: View {
    let kachel: Kachel
    /// Aktuelle Minute (nur heute)
    var jetzt: Int? = nil
    /// Minuten bis zum Beginn (nächste Stunde heute)
    var bald: Int? = nil

    @Environment(\.kartendarstellung) private var darstellung

    private var merkmal: Statusmerkmal? { Statuslehre.merkmal(kachel) }
    private var entfall: Bool { kachel.kartenart == .entfall }
    private var laeuft: Bool {
        guard let m = jetzt else { return false }
        return Statuslehre.findetStatt(kachel) && kachel.beginn <= m && m < kachel.ende
    }
    private var vorbei: Bool {
        guard let m = jetzt else { return false }
        return kachel.ende <= m
    }

    /// Raum- bzw. Personenzeile anzeigen (Änderungen stehen immer da).
    private var raumZeile: Kachelzeile? {
        guard let r = kachel.zeile("raum"), !r.text.isEmpty else { return nil }
        return darstellung.raum || !r.nurText ? r : nil
    }

    private var personen: [Kachelzeile] {
        kachel.personenzeilen.filter { darstellung.zeile2 || !$0.nurText }
    }

    private var abstand: CGFloat { darstellung.grosszuegig ? 12 : (darstellung.kompakt ? 8 : 10) }

    var body: some View {
        let w = Klassikstil.fuer(kachel, darstellung)
        VStack(alignment: .leading, spacing: 3) {
            if laeuft || bald != nil {
                jetztZeile
            }
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(kachel.fachText(darstellung))
                    .font(.headline)
                    .foregroundStyle(entfall ? Farben.entfall : Farben.text)
                    .strikethrough(entfall, color: Farben.entfall)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                if !kachel.fachname.isEmpty && darstellung.fach != "name" {
                    Text(kachel.fachname)
                        .font(.subheadline)
                        .foregroundStyle(Farben.text3)
                        .lineLimit(1)
                }
                Spacer(minLength: 6)
                if let r = raumZeile {
                    kachelText(r, karte: kachel.karte)
                        .font(.subheadline.weight(.semibold))
                        .monospacedDigit()
                        .foregroundStyle(w.gedaempft ? Farben.text2 : Farben.text)
                        .strikethrough(entfall, color: Farben.entfall)
                        .lineLimit(1)
                        .layoutPriority(1)
                } else if kachel.online {
                    Image(systemName: "video.fill")
                        .font(.subheadline)
                        .foregroundStyle(Farben.akzent)
                        .accessibilityHidden(true)
                }
            }
            if !personen.isEmpty || merkmal != nil || kachel.online || kachel.hausaufgabe || kachel.info {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    if !personen.isEmpty {
                        personenText
                    }
                    Spacer(minLength: 4)
                    zeichen
                }
            }
            if laeuft {
                ProgressView(value: anteil)
                    .tint(Farben.akzentHell)
                    .padding(.top, 3)
                    .accessibilityHidden(true)
            }
        }
        .padding(.leading, 14)
        .padding(.trailing, 12)
        .padding(.top, abstand)
        .padding(.bottom, abstand)
        .frame(maxWidth: .infinity, alignment: .leading)
        .klassikKarte(w, radius: 4)
        .overlay {
            if laeuft {
                RoundedRectangle(cornerRadius: 4, style: .continuous)
                    .strokeBorder(Farben.akzent, lineWidth: 2)
            }
        }
        .shadow(color: Color.black.opacity(0.05), radius: 1, x: 0, y: 1)
        .opacity(vorbei ? 0.55 : 1)
        .contentShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(kachel.vorlesetext + (laeuft ? ", läuft gerade" : (vorbei ? ", vorbei" : "")))
        .accessibilityAddTraits(.isButton)
        .accessibilityHint("Öffnet die Stunde. Langes Drücken zeigt weitere Aktionen.")
    }

    private var anteil: Double {
        guard let m = jetzt, kachel.ende > kachel.beginn else { return 0 }
        return min(1, max(0, Double(m - kachel.beginn) / Double(kachel.ende - kachel.beginn)))
    }

    @ViewBuilder
    private var jetztZeile: some View {
        if laeuft, let m = jetzt {
            Text("JETZT · noch \(Uhr.dauer(kachel.ende - m))")
                .font(.caption2.weight(.bold))
                .foregroundStyle(Farben.akzent)
                .lineLimit(1)
        } else if let bald {
            Text("IN \(Uhr.dauer(bald).uppercased())")
                .font(.caption2.weight(.bold))
                .foregroundStyle(Farben.akzent)
                .lineLimit(1)
        }
    }

    private var personenText: some View {
        var t = Text("")
        for (i, z) in personen.enumerated() {
            if i > 0 { t = t + Text("  ·  ") }
            t = t + kachelText(z, karte: kachel.karte)
        }
        return t
            .font(.subheadline)
            .foregroundStyle(Farben.text2)
            .strikethrough(entfall, color: Farben.entfall)
            .lineLimit(2)
    }

    /// Statuswort und kleine Zeichen rechts unten (Online, Hausaufgabe, Info).
    private var zeichen: some View {
        HStack(spacing: 6) {
            if let merkmal {
                Statuswort(merkmal: merkmal, klein: false)
            }
            if kachel.online {
                Image(systemName: "video")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Farben.akzent)
            }
            if kachel.hausaufgabe {
                Image(systemName: "checklist")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Farben.text2)
            }
            if kachel.info {
                Image(systemName: "info.circle")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Farben.text2)
            }
        }
        .accessibilityHidden(true)
    }
}
