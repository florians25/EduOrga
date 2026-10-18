import SwiftUI

/// Stundenkachel im Raster (Designsystem, Abschnitt 5): Fläche in der Fachfarbe mit 14 % Deckkraft, Radius 4 pt,
/// kein Seitenbalken. Kopfzeile mit Fachkürzel (halbfett) links und Raum rechts, darunter Lehrkraft bzw. Klasse.
/// Status:
/// - Entfall: schräge Schraffur, Inhalt durchgestrichen, Plakette „Entfall“.
/// - Änderung, Vertretung, Raumänderung: 1,5-pt-Rahmen in Petrol, der geänderte Wert petrolfarben unterstrichen.
/// - Prüfung: helle Bernstein-Fläche mit Plakette „Prüfung“.
/// - Veranstaltung, Termin, Raumbuchung: helle Violett-Fläche mit gestricheltem Rahmen.
/// - Stunde läuft ohne die betrachtete Lehrkraft (abgegeben) bzw. Bereitschaft einer abwesenden Lehrkraft: ohne Fläche,
///   gepunkteter Rahmen und kleine Plakette.
/// - Bereitschaft: gestrichelter neutraler Rahmen, Titel mittig.
/// - Pausenaufsicht: schmale Kachel in der Pause mit dem Ort; Vertretung mit Petrol-Rahmen, abgegeben gepunktet,
///   entfallen schraffiert und durchgestrichen.
/// - Vergangene Stunden treten zurück (geringere Deckkraft).
/// Zeichen unten rechts: Information, Hausaufgabe fällig, online. Passt nicht alles, zeigt „…“ unten rechts, dass die
/// Details mehr enthalten.
struct KachelView: View {
    let kachel: Kachel
    var gross: Bool = false
    var breite: CGFloat = 100
    var hoehe: CGFloat = 60

    @Environment(\.horizontalSizeClass) private var groessenklasse

    private var kompakt: Bool { groessenklasse == .compact && !gross }
    private var kopfSchrift: CGFloat { kompakt ? 12 : 13 }
    private var zeilenSchrift: CGFloat { kompakt ? 11 : 12 }
    private var zeilenHoehe: CGFloat { kompakt ? 13.5 : 15 }
    private var kopfHoehe: CGFloat { kompakt ? 15 : 17 }
    private var innen: CGFloat { breite < 56 ? 3 : (gross ? 6 : 4) }

    var body: some View {
        let a = Kachelaussehen(kachel)
        Group {
            if kachel.art == .aufsicht || kachel.art == .ganztagTermin {
                pille(a)
            } else {
                karte(a)
            }
        }
        .opacity(kachel.vergangen ? 0.6 : 1)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(barrierefreiText)
        .accessibilityAddTraits(kachel.antippbar ? .isButton : [])
    }

    // MARK: - Karte

    private func karte(_ a: Kachelaussehen) -> some View {
        let form = RoundedRectangle(cornerRadius: 4, style: .continuous)
        return ZStack(alignment: .topLeading) {
            if a.schraffur {
                Schraffur(abstand: 6)
                    .stroke(Farben.entfall.opacity(0.22), lineWidth: 1)
                    .clipShape(form)
            }
            inhalt(a)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(a.flaeche, in: form)
        .clipShape(form)
        // Die ganze Fläche ist antippbar – auch ohne Hintergrund (abgegeben, Bereitschaft)
        .contentShape(Rectangle())
        .overlay { rahmen(a, form: form) }
        .overlay(alignment: .topTrailing) {
            if let p = a.plakette, plaketteSichtbar {
                Plakette(text: p.text, farbe: p.farbe, flaeche: p.flaeche, klein: true)
                    .padding(.top, 3)
                    .padding(.trailing, 3)
                    .allowsHitTesting(false)
            }
        }
        .overlay(alignment: .bottomTrailing) {
            if !eckzeichen.isEmpty && zeichenPlatz {
                HStack(spacing: 3) {
                    ForEach(eckzeichen, id: \.self) { z in
                        Image(systemName: z)
                            .font(.system(size: 9, weight: .semibold))
                    }
                }
                .foregroundStyle(Farben.text3)
                .padding(.trailing, 4)
                .padding(.bottom, 3)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
            }
        }
    }

    @ViewBuilder
    private func rahmen(_ a: Kachelaussehen, form: RoundedRectangle) -> some View {
        switch a.rahmen {
        case .keiner:
            EmptyView()
        case .fein(let farbe):
            form.strokeBorder(farbe, lineWidth: 1)
        case .kraeftig(let farbe):
            form.strokeBorder(farbe, lineWidth: 1.5)
        case .gestrichelt(let farbe):
            form.strokeBorder(farbe, style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
        case .gepunktet(let farbe):
            form.strokeBorder(farbe, style: StrokeStyle(lineWidth: 1.2, lineCap: .round, dash: [0.1, 3]))
        }
    }

    /// Plakette nur, wenn die Kachel breit und hoch genug ist (sonst zeigen Fläche, Schraffur bzw. Rahmen den Status).
    private var plaketteSichtbar: Bool {
        breite >= 74 && hoehe >= 34
    }

    // MARK: - Zeilen

    /// Titelzeile (Fach bzw. bei Veranstaltungen die erste Zeile).
    private var titelzeile: Kachelzeile? {
        kachel.zeilen.first { $0.schluessel == "fach" } ?? kachel.zeilen.first
    }

    /// Raumzeile (steht rechts in der Kopfzeile, wenn Platz ist).
    private var raumzeile: Kachelzeile? {
        guard kachel.art != .veranstaltung else { return nil }
        return kachel.zeilen.first { $0.schluessel == "raum" }
    }

    /// Passt der Raum rechts neben das Fach (geschätzt über die Zeichenzahl, Schrift ≈ 0,6 × Größe je Zeichen)?
    private var raumImKopf: Bool {
        guard let raum = raumzeile, let titel = titelzeile else { return false }
        if plaketteImKopf { return false }
        let zeichen = CGFloat(titel.text.count + raum.text.count)
        return breite - 2 * innen >= zeichen * kopfSchrift * 0.62 + 6
    }

    /// Die Plakette belegt den rechten Teil der Kopfzeile.
    private var plaketteImKopf: Bool {
        Kachelaussehen(kachel).plakette != nil && plaketteSichtbar
    }

    /// Weitere Zeilen unter der Kopfzeile in der Reihenfolge der Daten (Raum nur, wenn er nicht im Kopf steht).
    private var weitereZeilen: [Kachelzeile] {
        guard let titel = titelzeile else { return [] }
        let imKopf = raumImKopf
        return kachel.zeilen.filter { z in
            if z == titel { return false }
            if imKopf, let raum = raumzeile, z == raum { return false }
            return true
        }
    }

    /// Wie viele weitere Zeilen passen in die Kachel?
    private var platzZeilen: Int {
        max(0, Int((hoehe - innen - kopfHoehe - 3) / zeilenHoehe))
    }

    private var gekuerzt: Bool {
        kachel.art != .bereitschaft && weitereZeilen.count > platzZeilen
    }

    /// Sichtbare weitere Zeilen: passen nicht alle, gehen Zeilen mit wichtigen Änderungen vor (Raumänderung, Kopplung
    /// mit abwesender bzw. vertretener Lehrkraft, fehlende Koppelklasse); die Reihenfolge bleibt erhalten.
    private var sichtbareZeilen: [Kachelzeile] {
        let alle = weitereZeilen
        guard alle.count > platzZeilen else { return alle }
        var gewaehlt: Set<Int> = []
        for i in alle.indices where gewaehlt.count < platzZeilen && Self.wichtig(alle[i]) {
            gewaehlt.insert(i)
        }
        for i in alle.indices where gewaehlt.count < platzZeilen {
            gewaehlt.insert(i)
        }
        return alle.indices.filter { gewaehlt.contains($0) }.map { alle[$0] }
    }

    private static func wichtig(_ z: Kachelzeile) -> Bool {
        switch z.schluessel {
        case "raum":
            return z.teile.contains { $0.stil == .plakette }
        case "lehrer", "klasse":
            return z.teile.count > 1 && z.teile.contains { $0.stil != .text }
        default:
            return false
        }
    }

    @ViewBuilder
    private func inhalt(_ a: Kachelaussehen) -> some View {
        if kachel.art == .bereitschaft {
            Text(kachel.titel)
                .font(.system(size: zeilenSchrift, weight: .medium))
                .foregroundStyle(Farben.text3)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .minimumScaleFactor(0.8)
                .padding(innen)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            VStack(alignment: .leading, spacing: 0) {
                kopfzeile(a)
                    .frame(height: kopfHoehe, alignment: .leading)
                ForEach(Array(sichtbareZeilen.enumerated()), id: \.offset) { eintrag in
                    KachelzeileView(zeile: eintrag.element, aussehen: a, schrift: zeilenSchrift,
                                    farbe: Farben.text2)
                        .frame(height: zeilenHoehe, alignment: .leading)
                }
            }
            .padding(.leading, innen + 1)
            .padding(.trailing, innen)
            .padding(.top, innen - 1)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }

    /// Kopfzeile: Fach halbfett links, Raum rechts (tabellarische Ziffern) – sofern Platz ist und keine Plakette dort steht.
    @ViewBuilder
    private func kopfzeile(_ a: Kachelaussehen) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            if let titel = titelzeile {
                KachelzeileView(zeile: titel, aussehen: a, schrift: kopfSchrift, gewicht: .semibold,
                                farbe: a.titelFarbe)
                    .layoutPriority(1)
            }
            if raumImKopf, let raum = raumzeile {
                Spacer(minLength: 2)
                KachelzeileView(zeile: raum, aussehen: a, schrift: zeilenSchrift, farbe: Farben.text2, rechtsbuendig: true)
                    .monospacedDigit()
            } else if plaketteImKopf {
                // Platz für die Plakette oben rechts freihalten
                Spacer(minLength: 64)
            }
        }
    }

    /// Zeichen unten rechts (SF Symbols): Information bzw. Notiz, Hausaufgabe fällig, online; bei gekürztem Inhalt „…“.
    private var eckzeichen: [String] {
        if gekuerzt { return ["ellipsis"] }
        var liste: [String] = []
        if kachel.online { liste.append(Symbole.online) }
        if kachel.hausaufgabe && kachel.art != .bereitschaft { liste.append(Symbole.hausaufgaben) }
        if kachel.info && kachel.art != .termin { liste.append(Symbole.info) }
        let platz = max(1, Int((breite - 2 * innen) / 13))
        return Array(liste.prefix(platz))
    }

    /// Die Zeichen unten rechts überdecken keine Zeile: unter der letzten sichtbaren Zeile ist Platz.
    private var zeichenPlatz: Bool {
        let belegt = innen + kopfHoehe + CGFloat(sichtbareZeilen.count) * zeilenHoehe
        return hoehe - belegt >= 11 || breite >= 90
    }

    // MARK: - Pille (Aufsicht, ganztägiger Termin)

    private func pille(_ a: Kachelaussehen) -> some View {
        let form = RoundedRectangle(cornerRadius: 4, style: .continuous)
        return HStack(spacing: 4) {
            // Immer nur der Ort bzw. Titel; entfallene Aufsicht durchgestrichen
            Text(kachel.titel)
                .font(.system(size: gross ? 12 : 11, weight: .medium))
                .strikethrough(a.durchgestrichen, color: Farben.entfall)
                .foregroundStyle(a.titelFarbe)
                .lineLimit(1)
                .truncationMode(.tail)
            if gross && kachel.art != .aufsicht {
                Text("\(Rasterzeit.uhrzeit(kachel.beginn))–\(Rasterzeit.uhrzeit(kachel.ende))")
                    .font(.system(size: 11).monospacedDigit())
                    .foregroundStyle(Farben.text2)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
            // Vertretung (übernommen oder abgegeben): Wechselzeichen rechts – wer vertritt, zeigen die Details
            if kachel.art == .aufsicht && (kachel.aufsichtsstand == .vertretung || kachel.aufsichtsstand == .abgegeben) {
                Image(systemName: "arrow.left.arrow.right")
                    .font(.system(size: 8.5, weight: .bold))
                    .foregroundStyle(kachel.aufsichtsstand == .vertretung ? Farben.aenderung : Farben.text3)
                    .layoutPriority(1)
                    .accessibilityHidden(true)
            }
        }
        .padding(.horizontal, 5)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(a.flaeche, in: form)
        .overlay {
            if a.schraffur {
                Schraffur(abstand: 5)
                    .stroke(Farben.entfall.opacity(0.22), lineWidth: 1)
                    .clipShape(form)
                    .allowsHitTesting(false)
            }
        }
        .clipShape(form)
        .contentShape(Rectangle())
        .overlay { rahmen(a, form: form) }
    }

    private var aufsichtHinweis: String? {
        guard let a = kachel.aufsicht else { return nil }
        switch kachel.aufsichtsstand {
        case .abgegeben: return a.lehrer.isEmpty || a.lehrer == "???" ? "Vertretung offen" : "Vertretung: \(a.lehrer)"
        case .vertretung: return (a.alt ?? "").isEmpty ? "Vertretung" : "Vertretung für \(a.alt ?? "")"
        case .entfall: return (a.grund ?? "").isEmpty ? "Aufsicht entfällt" : "Aufsicht entfällt, \(a.grund ?? "")"
        case .regulaer: return nil
        }
    }

    private var barrierefreiText: String {
        var teile: [String] = []
        switch kachel.art {
        case .entfall: teile.append("Entfall")
        case .aenderung: teile.append("Änderung")
        case .abgegeben: teile.append("Abgegeben")
        case .bereitschaftAbwesend: teile.append("Bereitschaft, Lehrkraft abwesend")
        case .veranstaltung: teile.append("Veranstaltung")
        case .aufsicht: teile.append("Pausenaufsicht")
        case .klausur: teile.append("Prüfung")
        default: break
        }
        teile.append(contentsOf: kachel.zeilen.map(\.text))
        if kachel.online { teile.append("findet online statt") }
        if kachel.hausaufgabe { teile.append("Hausaufgabe fällig") }
        if let v = kachel.karte?.verlegungText { teile.append("verlegt: \(v)") }
        teile.append("\(Rasterzeit.uhrzeit(kachel.beginn)) bis \(Rasterzeit.uhrzeit(kachel.ende))")
        if let h = aufsichtHinweis { teile.append(h) }
        return teile.joined(separator: ", ")
    }
}

/// Eine Zeile der Kachel: Text, geänderte Werte (petrolfarben unterstrichen), wegfallende Werte (durchgestrichen).
/// Immer genau eine Zeile – was nicht passt, endet mit „…“ (vollständig in den Details).
struct KachelzeileView: View {
    let zeile: Kachelzeile
    let aussehen: Kachelaussehen
    let schrift: CGFloat
    var gewicht: Font.Weight = .regular
    var farbe: Color = Farben.text
    var rechtsbuendig: Bool = false

    var body: some View {
        text
            .font(.system(size: schrift, weight: gewicht))
            .foregroundStyle(farbe)
            .lineLimit(1)
            .truncationMode(.tail)
            .frame(maxWidth: rechtsbuendig ? nil : .infinity, alignment: rechtsbuendig ? .trailing : .leading)
    }

    /// Alle Teile als ein Text (so kürzt das System am Zeilenende mit „…“).
    private var text: Text {
        var ergebnis = Text("")
        for t in zeile.teile {
            ergebnis = ergebnis + teil(t) + trenner(t.trenner)
        }
        return ergebnis
    }

    private func trenner(_ s: String) -> Text {
        guard !s.isEmpty else { return Text("") }
        // „|“ zwischen abwesender und vertretender Lehrkraft wird zum Pfeil
        let anzeige = s.contains("|") ? " → " : s
        return Text(anzeige).foregroundColor(Farben.text3)
    }

    private func teil(_ t: Kachelteil) -> Text {
        if aussehen.durchgestrichen {
            // Entfall: alles durchgestrichen
            return Text(t.text).strikethrough(true, color: Farben.entfall)
        }
        switch t.stil {
        case .text:
            return Text(t.text)
        case .plakette:
            // Geänderter bzw. hinzugekommener Wert
            return Text(t.text)
                .foregroundColor(Farben.aenderung)
                .underline(true, color: Farben.aenderung)
                .fontWeight(.semibold)
        case .weg:
            // Wegfallender Wert (z. B. vertretene Lehrkraft)
            return Text(t.text)
                .strikethrough(true, color: Farben.text3)
                .foregroundColor(Farben.text3)
        case .offen:
            // Offene Vertretung bzw. abwesende Lehrkraft ohne Ersatz
            return Text(t.text)
                .strikethrough(true, color: Farben.aenderung)
                .foregroundColor(Farben.aenderung)
                .fontWeight(.semibold)
        }
    }
}

// MARK: - Aussehen

/// Fläche, Rahmen, Plakette und Schrift einer Kachel nach Art und Status.
struct Kachelaussehen {
    enum Rahmen {
        case keiner
        case fein(Color)
        case kraeftig(Color)
        case gestrichelt(Color)
        case gepunktet(Color)
    }

    struct Statusplakette {
        let text: String
        let farbe: Color
        let flaeche: Color
    }

    var flaeche: Color = Farben.flaeche2
    var rahmen: Rahmen = .keiner
    var schraffur = false
    var durchgestrichen = false
    var titelFarbe: Color = Farben.text
    var plakette: Statusplakette? = nil

    init(_ k: Kachel) {
        // Grundfläche: Fachfarbe mit 14 % Deckkraft, ohne Fachfarbe neutral mit feinem Rand
        if let ton = Farben.fachTon(k.balkenHex) {
            flaeche = ton
        } else {
            flaeche = Farben.flaeche2
            rahmen = .fein(Farben.randStark)
        }
        switch k.art {
        case .normal:
            break
        case .aenderung:
            rahmen = .kraeftig(Farben.aenderung)
            if k.zusatz {
                plakette = Statusplakette(text: "Zusatz", farbe: Farben.aenderung, flaeche: Farben.aenderungFlaeche)
            }
        case .entfall:
            flaeche = Farben.entfallFlaeche
            rahmen = .keiner
            schraffur = true
            durchgestrichen = true
            titelFarbe = Farben.text2
            plakette = Statusplakette(text: "Entfall", farbe: Farben.entfall, flaeche: Farben.flaeche)
        case .klausur:
            flaeche = Farben.pruefungFlaeche
            rahmen = .fein(Farben.pruefung.opacity(0.45))
            plakette = Statusplakette(text: "Prüfung", farbe: Farben.pruefung, flaeche: Farben.flaeche)
        case .termin:
            flaeche = Farben.terminFlaeche
            rahmen = .gestrichelt(Farben.termin)
            titelFarbe = Farben.termin
        case .abgegeben:
            flaeche = .clear
            rahmen = .gepunktet(Farben.text3)
            titelFarbe = Farben.text2
            plakette = Statusplakette(text: "Abgegeben", farbe: Farben.text2, flaeche: Farben.neutralFlaeche)
        case .bereitschaft:
            flaeche = .clear
            rahmen = .gestrichelt(Farben.randStark)
            titelFarbe = Farben.text3
        case .bereitschaftAbwesend:
            flaeche = .clear
            rahmen = .gepunktet(Farben.text3)
            titelFarbe = Farben.text2
            plakette = Statusplakette(text: "Abwesend", farbe: Farben.text2, flaeche: Farben.neutralFlaeche)
        case .veranstaltung:
            flaeche = Farben.terminFlaeche
            rahmen = .gestrichelt(Farben.termin)
            titelFarbe = Farben.termin
        case .ganztagTermin:
            flaeche = Farben.terminFlaeche
            rahmen = .gestrichelt(Farben.termin)
            titelFarbe = Farben.termin
        case .aufsicht:
            flaeche = Farben.flaeche
            rahmen = .fein(Farben.randStark)
            titelFarbe = Farben.text2
            switch k.aufsichtsstand {
            case .regulaer:
                break
            case .vertretung:
                // Eingesprungen: Petrol-Rahmen wie eine Vertretung
                flaeche = Farben.aenderungFlaeche
                rahmen = .kraeftig(Farben.aenderung)
                titelFarbe = Farben.text
            case .abgegeben:
                // Eigene Aufsicht übernimmt jemand anderes: gepunktet wie eine abgegebene Stunde
                flaeche = .clear
                rahmen = .gepunktet(Farben.text3)
            case .entfall:
                // Entfallene Aufsicht wie eine entfallene Stunde
                flaeche = Farben.entfallFlaeche
                rahmen = .keiner
                schraffur = true
                durchgestrichen = true
            }
        }
        // Reine Raumänderung: wie eine Änderung (Petrol-Rahmen), der neue Raum petrolfarben unterstrichen
        if k.raumAenderung && (k.art == .aenderung || k.art == .normal) {
            rahmen = .kraeftig(Farben.aenderung)
        }
    }
}

// MARK: - Bausteine

/// Schräge Schraffur (45°) über die ganze Fläche – Kennzeichen einer entfallenen Stunde.
struct Schraffur: Shape {
    var abstand: CGFloat = 6

    func path(in r: CGRect) -> Path {
        var p = Path()
        let schritt = max(abstand, 2)
        var x = r.minX - r.height
        while x < r.maxX {
            p.move(to: CGPoint(x: x, y: r.maxY))
            p.addLine(to: CGPoint(x: x + r.height, y: r.minY))
            x += schritt
        }
        return p
    }
}

/// Zählstreifen am rechten Rand der Tagesspalte: Zahl der Stunden hinter der vorderen Kachel – Entfall in der
/// Entfall-Farbe, Änderung mit Petrol-Rahmen, sonst neutral.
struct ZaehlstreifenView: View {
    let streifen: Zaehlstreifen

    var body: some View {
        let form = RoundedRectangle(cornerRadius: 3, style: .continuous)
        Text("\(streifen.kacheln.count)")
            .font(.system(size: 10, weight: .semibold))
            .monospacedDigit()
            .foregroundStyle(textfarbe)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(flaeche, in: form)
            .overlay {
                form.strokeBorder(randfarbe, lineWidth: streifen.aenderung && !streifen.entfall ? 1.5 : 1)
            }
            .accessibilityLabel("\(streifen.kacheln.count) weitere Stunden")
            .accessibilityAddTraits(.isButton)
    }

    private var textfarbe: Color {
        if streifen.entfall { return Farben.entfall }
        if streifen.aenderung { return Farben.aenderung }
        return Farben.text2
    }

    private var flaeche: Color {
        streifen.entfall ? Farben.entfallFlaeche : Farben.flaeche2
    }

    private var randfarbe: Color {
        if streifen.entfall { return Farben.entfall.opacity(0.4) }
        if streifen.aenderung { return Farben.aenderung }
        return Farben.randStark
    }
}
