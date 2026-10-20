import SwiftUI

// Grafische Bausteine der Seite „Heute“ (design/DESIGN.md, Abschnitt 10.1 „Heute“): das Tagesband (der ganze Schultag als
// schmale waagrechte Leiste mit Jetzt-Markierung, Farben wie die Stundenkarten), die Tageszahlen (kleine Zahlenleiste, nur
// Werte über null) und die stillen Notizen der Schule. Ruhig und sachlich: keine Verläufe, kein Glas, keine Symbole als
// Schmuck – die Grafik ersetzt Text, sie kommt nicht dazu.

// MARK: - Tagesband

/// Art eines Abschnitts im Tagesband – dieselbe Farbsprache wie die Stundenkarte.
enum Bandart: Equatable {
    case regulaer
    case aenderung
    case entfall
    /// offene Vertretung: neutral, gestrichelt (nie rot)
    case offen
    case pruefung
    case termin
    /// Bereitschaft, abgegebene Stunde
    case still

    /// Vorrang bei gleichzeitigen Stunden: was für die Person stattfindet bzw. sich geändert hat, steht vorn.
    var rang: Int {
        switch self {
        case .aenderung: return 6
        case .offen: return 5
        case .pruefung: return 4
        case .regulaer: return 3
        case .termin: return 2
        case .still: return 1
        case .entfall: return 0
        }
    }

    static func von(_ k: Kachel) -> Bandart {
        let art: Kartenart = k.kartenart
        if art != .entfall && k.karte?.istOffeneVertretung == true { return .offen }
        switch art {
        case .entfall: return .entfall
        case .aenderung: return .aenderung
        case .pruefung: return .pruefung
        case .termin, .buchung: return .termin
        case .abwesend, .neutral: return .still
        case .normal: return .regulaer
        }
    }
}

/// Ein Abschnitt des Tagesbands (gleichzeitige Stunden sind zusammengefasst).
struct Bandabschnitt: Identifiable {
    let id: UUID
    let kachel: Kachel
    /// Beginn und Ende in Minuten seit Mitternacht
    let von: Int
    let bis: Int
    let art: Bandart
    /// „3“ bzw. „3–4“ (leer ohne Stundennummer)
    let nummer: String
}

/// Kurze Aufsicht im Tagesband (schmale Marke in der Pause).
struct Bandaufsicht: Identifiable {
    let id: UUID
    let von: Int
    let bis: Int
    let stand: Aufsichtsstand
}

enum Tagesbandbau {
    /// Abschnitte aus den Stunden des Tages (ohne Aufsichten und ganztägige Termine), gleichzeitige zusammengefasst.
    static func abschnitte(_ kacheln: [Kachel]) -> [Bandabschnitt] {
        let stunden: [Kachel] = kacheln
            .filter { $0.aufsicht == nil && $0.karte != nil && !$0.inPause && $0.art != .ganztagTermin && $0.ende > $0.beginn }
            .sorted { ($0.beginn, $0.ende) < ($1.beginn, $1.ende) }
        var gruppen: [[Kachel]] = []
        var gruppenEnde: Int = -1
        for k in stunden {
            if var letzte = gruppen.last, k.beginn < gruppenEnde {
                letzte.append(k)
                gruppen[gruppen.count - 1] = letzte
                gruppenEnde = max(gruppenEnde, k.ende)
            } else {
                gruppen.append([k])
                gruppenEnde = k.ende
            }
        }
        var ergebnis: [Bandabschnitt] = []
        for g in gruppen {
            guard let vorn = g.max(by: { Bandart.von($0).rang < Bandart.von($1).rang }) else { continue }
            let von: Int = g.map(\.beginn).min() ?? vorn.beginn
            let bis: Int = g.map(\.ende).max() ?? vorn.ende
            let ersteNr: Int = g.map(\.von).filter { $0 > 0 }.min() ?? 0
            let letzteNr: Int = g.map(\.bis).filter { $0 > 0 }.max() ?? 0
            let nummer: String
            if ersteNr == 0 {
                nummer = ""
            } else if letzteNr > ersteNr {
                nummer = "\(ersteNr)–\(letzteNr)"
            } else {
                nummer = "\(ersteNr)"
            }
            ergebnis.append(Bandabschnitt(id: vorn.id, kachel: vorn, von: von, bis: bis, art: Bandart.von(vorn), nummer: nummer))
        }
        return ergebnis
    }

    static func aufsichten(_ kacheln: [Kachel]) -> [Bandaufsicht] {
        kacheln.filter { $0.aufsicht != nil && $0.ende > $0.beginn }
            .map { Bandaufsicht(id: $0.id, von: $0.beginn, bis: $0.ende, stand: $0.aufsichtsstand) }
    }

    /// Satz für VoiceOver: „Schultag 7:45 bis 13:10, 6 Stunden, 1 geändert, 1 entfällt. Jetzt 3. Stunde.“
    static func vorlesetext(_ teile: [Bandabschnitt], jetzt: Int?, familie: Bool) -> String {
        guard let erster = teile.first, let ende = teile.map(\.bis).max() else { return "" }
        var satz = "Schultag \(Uhr.uhrzeit(erster.von)) bis \(Uhr.uhrzeit(ende)) Uhr, "
        satz += teile.count == 1 ? "1 Abschnitt" : "\(teile.count) Abschnitte"
        let geaendert = teile.filter { $0.art == .aenderung }.count
        let entfall = teile.filter { $0.art == .entfall }.count
        let offen = teile.filter { $0.art == .offen }.count
        let pruefung = teile.filter { $0.art == .pruefung }.count
        if geaendert > 0 { satz += ", \(geaendert) geändert" }
        if entfall > 0 { satz += entfall == 1 ? ", 1 entfällt" : ", \(entfall) entfallen" }
        if offen > 0 { satz += familie ? ", \(offen) Vertretung folgt" : ", \(offen) Vertretung offen" }
        if pruefung > 0 { satz += pruefung == 1 ? ", 1 Prüfung" : ", \(pruefung) Prüfungen" }
        satz += "."
        if let jetzt, let laufend = teile.first(where: { $0.von <= jetzt && jetzt < $0.bis }) {
            satz += laufend.nummer.isEmpty ? " Jetzt \(laufend.kachel.anzeigeTitel)." : " Jetzt \(laufend.nummer). Stunde."
        }
        return satz
    }
}

/// Der Schultag als schmale waagrechte Leiste: je Stunde ein Abschnitt nach seiner echten Dauer (Pausen als Lücken), Farbe
/// wie die Stundenkarte – regulär Grau, geändert Grün, entfällt Rot hell mit Linie und durchgestrichen, offen gestrichelt,
/// Prüfung Bernstein, Termin warm. Vergangenes blass, die laufende Stunde mit Petrol-Rahmen, dazu die Jetzt-Linie mit der
/// Uhrzeit darüber; Aufsichten als kleine Marke in ihrer Pause. Unter der Leiste die Stundennummern, oben Beginn und Ende des
/// Tages. Gezeichnet mit `Canvas` (ein Element für VoiceOver mit einem ganzen Satz).
struct Tagesband: View {
    let kacheln: [Kachel]
    let istHeute: Bool
    var familie: Bool = false

    @ScaledMetric(relativeTo: .caption2) private var zeilenHoehe: CGFloat = 14
    @ScaledMetric(relativeTo: .caption2) private var bandHoehe: CGFloat = 20

    var body: some View {
        let teile: [Bandabschnitt] = Tagesbandbau.abschnitte(kacheln)
        let aufsichten: [Bandaufsicht] = Tagesbandbau.aufsichten(kacheln)
        if !teile.isEmpty {
            TimelineView(.periodic(from: .now, by: 30)) { kontext in
                band(teile, aufsichten: aufsichten, jetzt: Uhr.minuten(kontext.date))
            }
        }
    }

    private func band(_ teile: [Bandabschnitt], aufsichten: [Bandaufsicht], jetzt: Int) -> some View {
        let hoehe: CGFloat = zeilenHoehe + 4 + bandHoehe + 4 + zeilenHoehe
        let jetztWert: Int? = istHeute ? jetzt : nil
        return Canvas { kontext, groesse in
            Tagesbandzeichnung(teile: teile, aufsichten: aufsichten, jetzt: jetztWert,
                               zeile: zeilenHoehe, band: bandHoehe).zeichnen(in: &kontext, groesse: groesse)
        }
        .frame(height: hoehe)
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Tagesbandbau.vorlesetext(teile, jetzt: jetztWert, familie: familie))
    }
}

/// Zeichnung des Tagesbands (getrennt von der Ansicht, damit der Typprüfer kurze Ausdrücke sieht).
struct Tagesbandzeichnung {
    let teile: [Bandabschnitt]
    let aufsichten: [Bandaufsicht]
    let jetzt: Int?
    let zeile: CGFloat
    let band: CGFloat

    private var start: Int { teile.map(\.von).min() ?? 0 }
    private var ende: Int { teile.map(\.bis).max() ?? 1 }

    private func x(_ minuten: Int, breite: CGFloat) -> CGFloat {
        let spanne: CGFloat = CGFloat(max(1, ende - start))
        return CGFloat(minuten - start) / spanne * breite
    }

    func zeichnen(in kontext: inout GraphicsContext, groesse: CGSize) {
        let breite: CGFloat = groesse.width
        let bandOben: CGFloat = zeile + 4
        let unten: CGFloat = bandOben + band + 4

        // Abschnitte
        for t in teile {
            let x0: CGFloat = x(t.von, breite: breite) + 1
            let x1: CGFloat = x(t.bis, breite: breite) - 1
            let rechteck = CGRect(x: x0, y: bandOben, width: max(3, x1 - x0), height: band)
            let vorbei: Bool = jetzt.map { t.bis <= $0 } ?? false
            var k = kontext
            if vorbei { k.opacity = 0.42 }
            abschnitt(t.art, in: rechteck, kontext: &k)
            if let j = jetzt, t.von <= j, j < t.bis {
                let rahmen = Path(roundedRect: rechteck.insetBy(dx: -2, dy: -2), cornerRadius: 4, style: .circular)
                kontext.stroke(rahmen, with: .color(Farben.akzent), lineWidth: 2)
            }
        }

        // Aufsichten: schmale Marke mittig in der Pause
        for a in aufsichten {
            let x0: CGFloat = x(a.von, breite: breite)
            let x1: CGFloat = x(a.bis, breite: breite)
            guard x1 > 0, x0 < breite else { continue }
            let marke = CGRect(x: max(0, x0), y: bandOben + band / 2 - 2, width: max(3, min(breite, x1) - max(0, x0)), height: 4)
            let farbe: Color
            switch a.stand {
            case .vertretung: farbe = Farben.aenderung
            case .entfall: farbe = Farben.entfall.opacity(0.45)
            case .abgegeben: farbe = Farben.randStark
            case .regulaer: farbe = Farben.text3
            }
            kontext.fill(Path(roundedRect: marke, cornerRadius: 1, style: .circular), with: .color(farbe))
        }

        // Stundennummern unter den Abschnitten (nur, wenn sie hineinpassen)
        for t in teile where !t.nummer.isEmpty {
            let x0: CGFloat = x(t.von, breite: breite)
            let x1: CGFloat = x(t.bis, breite: breite)
            let laeuft: Bool = jetzt.map { t.von <= $0 && $0 < t.bis } ?? false
            let text = Text(t.nummer)
                .font(.caption2.weight(laeuft ? .semibold : .regular))
                .monospacedDigit()
                .foregroundColor(laeuft ? Farben.akzent : (t.art == .entfall ? Farben.entfall : Farben.text2))
            let fertig = kontext.resolve(text)
            let mass: CGSize = fertig.measure(in: CGSize(width: 200, height: zeile))
            if mass.width + 2 <= x1 - x0 {
                kontext.draw(fertig, at: CGPoint(x: (x0 + x1) / 2, y: unten + zeile / 2), anchor: .center)
            }
        }

        // Beginn und Ende des Tages oben; die Jetzt-Uhrzeit verdrängt sie, wenn sie sich nahe kommen
        var jetztBereich: ClosedRange<CGFloat>? = nil
        if let j = jetzt, j >= start, j <= ende {
            let xj: CGFloat = min(breite - 1, max(1, x(j, breite: breite)))
            let linie = Path(CGRect(x: xj - 1, y: bandOben - 3, width: 2, height: band + 6))
            kontext.fill(linie, with: .color(Farben.akzent))
            let text = Text(Uhr.uhrzeit(j)).font(.caption2.weight(.semibold)).monospacedDigit().foregroundColor(Farben.akzent)
            let fertig = kontext.resolve(text)
            let mass: CGSize = fertig.measure(in: CGSize(width: 200, height: zeile))
            let mitte: CGFloat = min(breite - mass.width / 2, max(mass.width / 2, xj))
            kontext.draw(fertig, at: CGPoint(x: mitte, y: zeile / 2), anchor: .center)
            jetztBereich = (mitte - mass.width / 2 - 6)...(mitte + mass.width / 2 + 6)
        }
        randzeit(start, links: true, breite: breite, frei: jetztBereich, kontext: &kontext)
        randzeit(ende, links: false, breite: breite, frei: jetztBereich, kontext: &kontext)
    }

    private func randzeit(_ minuten: Int, links: Bool, breite: CGFloat, frei: ClosedRange<CGFloat>?, kontext: inout GraphicsContext) {
        let text = Text(Uhr.uhrzeit(minuten)).font(.caption2).monospacedDigit().foregroundColor(Farben.text2)
        let fertig = kontext.resolve(text)
        let mass: CGSize = fertig.measure(in: CGSize(width: 200, height: zeile))
        let bereich: ClosedRange<CGFloat> = links ? 0...mass.width : (breite - mass.width)...breite
        if let frei, frei.overlaps(bereich) { return }
        kontext.draw(fertig, at: CGPoint(x: links ? 0 : breite, y: zeile / 2), anchor: links ? .leading : .trailing)
    }

    private func abschnitt(_ art: Bandart, in r: CGRect, kontext: inout GraphicsContext) {
        let form = Path(roundedRect: r, cornerRadius: 3, style: .circular)
        let innen = Path(roundedRect: r.insetBy(dx: 0.75, dy: 0.75), cornerRadius: 2.5, style: .circular)
        switch art {
        case .regulaer:
            kontext.fill(form, with: .color(Farben.balkenGrau))
        case .aenderung:
            kontext.fill(form, with: .color(Farben.aenderung))
        case .pruefung:
            kontext.fill(form, with: .color(Farben.pruefung))
        case .entfall:
            kontext.fill(form, with: .color(Farben.entfallChip))
            kontext.stroke(innen, with: .color(Farben.entfall), lineWidth: 1.5)
            var strich = Path()
            strich.move(to: CGPoint(x: r.minX + 3, y: r.midY))
            strich.addLine(to: CGPoint(x: r.maxX - 3, y: r.midY))
            kontext.stroke(strich, with: .color(Farben.entfall), lineWidth: 1.5)
        case .offen:
            kontext.fill(form, with: .color(Farben.karte))
            kontext.stroke(innen, with: .color(Farben.text3), style: StrokeStyle(lineWidth: 1.5, dash: [3, 2]))
        case .termin:
            kontext.fill(form, with: .color(Farben.ereignisFlaeche))
            kontext.stroke(innen, with: .color(Farben.ereignisRand), lineWidth: 1.5)
        case .still:
            kontext.fill(form, with: .color(Farben.neutralFlaeche))
            kontext.stroke(innen, with: .color(Farben.randStark), style: StrokeStyle(lineWidth: 1.5, dash: [3, 2]))
        }
    }
}

// MARK: - Tageszahlen

/// Ziel einer Tageszahl.
enum Tageszahlziel {
    case start(Startziel)
    case schule(Schulziel)
    case postfach
}

/// Eine Zahl der Zahlenleiste („2 Änderungen“, „3 Klassenbuch offen“).
struct Tageszahl: Identifiable {
    let id: String
    let zahl: Int
    let titel: String
    var farbe: Color = Farben.text
    let ziel: Tageszahlziel
    /// Für VoiceOver („2 geänderte Stunden heute“)
    let vorlesen: String
}

/// Kleine Zahlenleiste unter der Fokuskarte: bis zu vier Werte nebeneinander in einer Fläche, getrennt durch feine Linien,
/// Zahl groß (tabellarisch, Statusfarbe nur bei Abweichungen), Beschriftung klein darunter – ohne Symbole, ohne Kästen in
/// Farbe. Erscheint nur mit Werten über null; jeder Wert führt zu seiner Seite. Große Schrift: untereinander.
struct Tageszahlen: View {
    let zahlen: [Tageszahl]
    let postfach: () -> Void

    @Environment(\.dynamicTypeSize) private var schriftgroesse

    var body: some View {
        let liste: [Tageszahl] = Array(zahlen.filter { $0.zahl > 0 }.prefix(4))
        if !liste.isEmpty {
            let gross: Bool = schriftgroesse.isAccessibilitySize
            let anordnung: AnyLayout = gross ? AnyLayout(VStackLayout(alignment: .leading, spacing: 0))
                                             : AnyLayout(HStackLayout(alignment: .top, spacing: 0))
            anordnung {
                ForEach(Array(liste.enumerated()), id: \.element.id) { i, z in
                    if i > 0 {
                        trenner(gross: gross)
                    }
                    zelle(z, gross: gross)
                }
            }
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .kartenflaeche()
        }
    }

    /// Feine Linie zwischen zwei Werten: senkrecht nebeneinander, waagrecht untereinander.
    @ViewBuilder
    private func trenner(gross: Bool) -> some View {
        if gross {
            Rectangle()
                .fill(Farben.rand)
                .frame(height: 1)
                .frame(maxWidth: .infinity)
                .accessibilityHidden(true)
        } else {
            Rectangle()
                .fill(Farben.rand)
                .frame(width: 1)
                .frame(maxHeight: .infinity)
                .padding(.vertical, 10)
                .accessibilityHidden(true)
        }
    }

    @ViewBuilder
    private func zelle(_ z: Tageszahl, gross: Bool) -> some View {
        switch z.ziel {
        case .start(let ziel):
            NavigationLink(value: ziel) { inhalt(z, gross: gross) }
                .buttonStyle(ZeilenKnopfStil())
                .accessibilityLabel(z.vorlesen)
        case .schule(let ziel):
            NavigationLink(value: ziel) { inhalt(z, gross: gross) }
                .buttonStyle(ZeilenKnopfStil())
                .accessibilityLabel(z.vorlesen)
        case .postfach:
            Button {
                Haptik.tippen()
                postfach()
            } label: {
                inhalt(z, gross: gross)
            }
            .buttonStyle(ZeilenKnopfStil())
            .accessibilityLabel(z.vorlesen)
            .accessibilityHint("Öffnet das Postfach")
        }
    }

    private func inhalt(_ z: Tageszahl, gross: Bool) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text("\(z.zahl)")
                .font(.title2.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(z.farbe)
                .lineLimit(1)
            Text(z.titel)
                .font(.caption)
                .foregroundStyle(Farben.text2)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, minHeight: 44, alignment: .topLeading)
        .contentShape(Rectangle())
    }
}

// MARK: - Notizen der Schule

/// Stille Notiz (Mitteilung, Veranstaltung, Hinweis der Schule) wie im Plan: helle gelbe Fläche mit feiner Linie, Radius 4,
/// Titel halbfett und höchstens zwei Zeilen Text – ohne Symbol. Antippen zeigt alle Hinweise.
struct HeuteNotiz: View {
    let info: Tagesinfo

    private var allgemein: Bool { ["Nachricht", "Hinweis"].contains(info.titel) }

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                if !allgemein {
                    Text(info.titel)
                        .font(.footnote.weight(.semibold))
                        .lineLimit(1)
                }
                Text(info.text)
                    .font(.subheadline)
                    .lineLimit(2)
                    .truncationMode(.tail)
            }
            .foregroundStyle(Farben.ereignisText)
            Spacer(minLength: 4)
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Farben.ereignisText.opacity(0.6))
                .accessibilityHidden(true)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
        .background(Farben.ereignisFlaeche, in: RoundedRectangle(cornerRadius: Kartenmass.radius, style: .circular))
        .overlay {
            RoundedRectangle(cornerRadius: Kartenmass.radius, style: .circular)
                .strokeBorder(Farben.ereignisRand, lineWidth: 1)
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(allgemein ? "Hinweis der Schule: \(info.text)" : "\(info.titel): \(info.text)")
    }
}
