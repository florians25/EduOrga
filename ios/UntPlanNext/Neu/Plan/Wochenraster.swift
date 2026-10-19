import SwiftUI

// Wochenansicht des Plans – dieselbe Rasterregel wie die PWA (mobile/README.md, „Planraster“): Spalten Montag bis
// Freitag (bzw. die Schultage der Woche), Zeilen = Stunden des Zeitrasters. Jede Stunde hat dieselbe Höhe, Pausen stehen
// als schmales Band dazwischen (ab 15 Minuten breiter), Doppelstunden reichen genau über zwei Zeilen samt Band. Die
// Zeilen werden so hoch, dass der Schultag bis zur letzten belegten (mindestens der 6.) Stunde auf den Bildschirm passt.
// Weiße Karten mit 4-pt-Balken (grau bzw. Fachfarbe), drei Zeilen Lehrkraft bzw. Klasse (fett) · Fach · Raum.
// Gleichzeitige Stunden: keine Zählkarte – die vordere Stunde bleibt voll breit, oben rechts in ihrer Zelle steht „+X“;
// Antippen öffnet ein Blatt mit allen Stunden dieser Zeit. Antippen einer Karte öffnet die Stunde, langes Drücken zeigt
// die Aktionen, Antippen des Tageskopfs öffnet den Tag.

// MARK: - Dichte

/// Dichte des Wochenrasters (Faktor der Zeilenhöhe, im Menü des Plans bzw. unter Darstellung).
enum Wochendichte {
    static let schluessel = "wocheDichte"
    static let kompakt: Double = 0.85
    static let normal: Double = 1.0
    static let komfortabel: Double = 1.25
    static let bereich: ClosedRange<Double> = 0.7...1.6
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

    /// Nächste Stufe (ältere Installationen haben stufenlose Werte gespeichert).
    private func naechste(_ wert: Double) -> Double {
        [Wochendichte.kompakt, Wochendichte.normal, Wochendichte.komfortabel].min { abs($0 - wert) < abs($1 - wert) } ?? Wochendichte.normal
    }
}

// MARK: - Gleichzeitige Stunden

/// Stunden derselben Zeit (vordere Stunde zuerst) – Inhalt des Blatts hinter „+X“.
struct Parallelgruppe: Identifiable {
    let id = UUID()
    let kacheln: [Kachel]
    let tag: Tagesansicht

    var datum: String { tag.datum }
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
    let parallele: (Parallelgruppe) -> Void

    @State private var position: String? = nil

    var body: some View {
        ScrollView(.horizontal) {
            LazyHStack(spacing: 0) {
                ForEach(montage, id: \.self) { m in
                    WochenSeite(modell: modell, montag: m, raum: raum, antippen: antippen, tagOeffnen: tagOeffnen,
                                parallele: parallele)
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

/// Eine Woche: Raster, senkrecht rollbar (nur bei sehr vielen Stunden nötig), zum Aktualisieren nach unten ziehen.
struct WochenSeite: View {
    @ObservedObject var modell: Planmodell
    let montag: String
    let raum: Namespace.ID?
    let antippen: (Kachel, Tagesansicht, String) -> Void
    let tagOeffnen: (String) -> Void
    let parallele: (Parallelgruppe) -> Void

    var body: some View {
        GeometryReader { geo in
            ScrollView(.vertical) {
                Wochenraster(modell: modell, montag: montag, raum: raum, antippen: antippen, tagOeffnen: tagOeffnen,
                             parallele: parallele, verfuegbar: geo.size)
                    .padding(.bottom, 6)
            }
            .scrollIndicators(.hidden)
            .refreshable {
                await modell.laden(montag: montag, erzwingen: true)
                Haptik.erfolg()
            }
        }
        .task(id: "\(modell.typ)|\(modell.element)|\(montag)") {
            await modell.laden(montag: montag)
        }
    }
}

// MARK: - Lage der Zeilen

/// Pausenband zwischen zwei Rasterzeilen.
struct Pausenband: Identifiable {
    let id: Int
    let y: CGFloat
    let hoehe: CGFloat
    let gross: Bool
}

/// Senkrechte Lage des Rasters: Oberkante jeder Zeile, Zeilenhöhe, Gesamthöhe und Pausenbänder.
struct Rasterlage {
    let oben: [CGFloat]
    let zeile: CGFloat
    let hoehe: CGFloat
    let baender: [Pausenband]

    /// Oberkante der Zeile `von` bis Unterkante der Zeile `bis` (inklusive der Bänder dazwischen).
    func spanne(von: Int, bis: Int) -> (y: CGFloat, h: CGFloat) {
        guard oben.indices.contains(von), oben.indices.contains(bis), bis >= von else { return (0, 0) }
        return (oben[von], oben[bis] + zeile - oben[von])
    }
}

// MARK: - Raster

struct Wochenraster: View {
    @ObservedObject var modell: Planmodell
    let montag: String
    let raum: Namespace.ID?
    let antippen: (Kachel, Tagesansicht, String) -> Void
    let tagOeffnen: (String) -> Void
    let parallele: (Parallelgruppe) -> Void
    /// Verfügbare Fläche der Seite: die Zeilen werden so hoch, dass der Schultag auf den Bildschirm passt
    var verfuegbar: CGSize = .zero

    @AppStorage(Wochendichte.schluessel) private var dichte: Double = Wochendichte.normal
    @ScaledMetric(relativeTo: .caption) private var zeitBreite: CGFloat = 32

    /// Höhe von Wochentag und Datum im Tageskopf
    private let datumHoehe: CGFloat = 36
    /// Höhe eines Banners (ganztägige bzw. mehrstündige Termine) im Tageskopf
    private let bannerHoehe: CGFloat = 20
    /// Abstand zwischen den Tagesspalten
    private let spaltenLuecke: CGFloat = 2
    /// Band für kurze Pausen bzw. große Pausen (ab 15 Minuten)
    private let bandKlein: CGFloat = 3
    private let bandGross: CGFloat = 16
    private let zeileMin: CGFloat = 44
    private let zeileMax: CGFloat = 104
    /// Abstand der Karte zum Zeilenrand (oben und unten)
    private let einzug: CGFloat = 1

    private var tage: [String] { modell.tage(montag: montag) }

    /// Kopf über dem Raster: Datum und (falls in der Woche vorhanden) bis zu zwei Bannerzeilen.
    private var kopfHoehe: CGFloat { datumHoehe + CGFloat(bannerZeilen) * bannerHoehe + (bannerZeilen > 0 ? 2 : 0) }

    private var bannerZeilen: Int {
        var n = 0
        for d in tage {
            if let t = modell.tag(d), t.freiText == nil { n = max(n, banner(t).count) }
        }
        return min(n, 2)
    }

    /// Ganztägige und mehrstündige Termine bzw. Veranstaltungen (Elternsprechtag, Pädagogischer Tag …): nicht als hohe
    /// gestrichelte Säule, sondern als schmales Banner im Tageskopf – die Stunden bleiben lesbar.
    private func banner(_ t: Tagesansicht) -> [Kachel] {
        t.ganztags + t.kacheln.filter { istBanner($0) }
    }

    private func istBanner(_ k: Kachel) -> Bool {
        guard !k.inPause, let karte = k.karte, !karte.istRaumbuchung else { return false }
        guard k.art == .termin || k.art == .veranstaltung || k.art == .ganztagTermin else { return false }
        return k.bis - k.von >= 2 || k.ende - k.beginn >= 180
    }

    private var raster: [Rasterzeit] {
        for d in tage {
            if let t = modell.tag(d), !t.raster.isEmpty { return t.raster }
        }
        return []
    }

    var body: some View {
        Group {
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
                        .padding(.horizontal, 4)
                }
            } else if modell.fehler != nil && !modell.laedt(montag: montag) {
                Hinweisfeld(titel: "Plan nicht geladen", text: "Zum Aktualisieren nach unten ziehen.", symbol: "wifi.exclamationmark",
                            flaeche: Farben.flaeche)
                    .padding(.horizontal, Stilmass.rand)
            } else {
                Platzhaltertag()
            }
        }
        .padding(.top, 2)
    }

    // MARK: Maße

    /// Band nach der Rasterzeile `i` (0 = Stunden schließen direkt aneinander an).
    private func band(nach i: Int) -> CGFloat {
        guard i + 1 < raster.count else { return 0 }
        let pause = raster[i + 1].beginn - raster[i].ende
        return pause >= 15 ? bandGross : (pause > 0 ? bandKlein : 0)
    }

    /// Letzte belegte Rasterzeile der Woche, mindestens die 6. Stunde.
    private var letzteZeile: Int {
        guard !raster.isEmpty else { return 0 }
        var letzte = min(5, raster.count - 1)
        for d in tage {
            guard let t = modell.tag(d) else { continue }
            for k in t.kacheln where !k.inPause && k.karte != nil && !istBanner(k) {
                if let z = zeilen(k) { letzte = max(letzte, z.bis) }
            }
        }
        return min(letzte, raster.count - 1)
    }

    /// Zeilenhöhe: alle Stunden bis zur letzten belegten passen in die Höhe (44–104 pt, im Querformat mindestens 52).
    private var zeilenHoehe: CGFloat {
        guard !raster.isEmpty else { return 57 }
        let bis = letzteZeile
        var baender: CGFloat = 0
        for i in 0..<bis { baender += band(nach: i) }
        let anzahl = CGFloat(bis + 1)
        let quer = verfuegbar.width > verfuegbar.height && verfuegbar.height > 0
        let passend = verfuegbar.height > 0 ? ((verfuegbar.height - kopfHoehe - 10 - baender) / anzahl).rounded(.down) : 57
        let basis = min(zeileMax, max(quer ? 52 : zeileMin, passend))
        let faktor = CGFloat(min(Wochendichte.bereich.upperBound, max(Wochendichte.bereich.lowerBound, dichte)))
        return max(36, (basis * faktor).rounded())
    }

    private func lage() -> Rasterlage {
        let z = zeilenHoehe
        var oben: [CGFloat] = []
        var baender: [Pausenband] = []
        var y: CGFloat = 0
        for i in raster.indices {
            oben.append(y)
            y += z
            let b = band(nach: i)
            if b > 0 {
                baender.append(Pausenband(id: i, y: y, hoehe: b, gross: b >= bandGross))
                y += b
            }
        }
        return Rasterlage(oben: oben, zeile: z, hoehe: y, baender: baender)
    }

    /// Senkrechte Lage einer Uhrzeit (Minuten): in einer Stunde anteilig, in einer Pause anteilig im Band.
    private func lageVon(_ minute: Int, _ l: Rasterlage) -> CGFloat? {
        guard let erste = raster.first, let letzte = raster.last, minute >= erste.beginn, minute <= letzte.ende,
              l.oben.count == raster.count else { return nil }
        for (i, r) in raster.enumerated() where minute <= r.ende {
            if minute >= r.beginn {
                return l.oben[i] + CGFloat(minute - r.beginn) / CGFloat(max(1, r.ende - r.beginn)) * l.zeile
            }
            guard i > 0 else { return l.oben[0] }
            let vorEnde = raster[i - 1].ende
            let a = l.oben[i - 1] + l.zeile
            let b = l.oben[i]
            return a + (b - a) * CGFloat(minute - vorEnde) / CGFloat(max(1, r.beginn - vorEnde))
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

    private func spaltenX(_ i: Int, _ breite: CGFloat) -> CGFloat {
        zeitBreite + spaltenLuecke + CGFloat(i) * (breite + spaltenLuecke)
    }

    // MARK: Fläche

    private var rasterflaeche: some View {
        let l = lage()
        return GeometryReader { geo in
            let spalten = max(tage.count, 1)
            let breite = max(0, (geo.size.width - zeitBreite - CGFloat(spalten) * spaltenLuecke) / CGFloat(spalten))
            ZStack(alignment: .topLeading) {
                rastergrund(l)
                    .frame(width: geo.size.width, height: l.hoehe)
                    .offset(y: kopfHoehe)
                // Stundenspalte: Nummer, Beginn (bei hohen Zeilen auch das Ende) – bündig mit der Oberkante der Zeile
                ForEach(Array(raster.enumerated()), id: \.offset) { i, r in
                    zeitZelle(r, hoehe: l.zeile)
                        .frame(width: zeitBreite, height: l.zeile, alignment: .top)
                        .offset(x: 0, y: kopfHoehe + l.oben[i])
                }
                // Jetzt-Linie hinter den Karten (sie soll nicht wie eine Durchstreichung wirken)
                jetztLinie(l, breite: breite, gesamt: geo.size.width, nurPunkt: false)
                ForEach(Array(tage.enumerated()), id: \.element) { i, d in
                    tagesSpalte(d, breite: breite, lage: l)
                        .frame(width: breite, height: kopfHoehe + l.hoehe, alignment: .topLeading)
                        .offset(x: spaltenX(i, breite), y: 0)
                }
                jetztLinie(l, breite: breite, gesamt: geo.size.width, nurPunkt: true)
            }
            .frame(width: geo.size.width, height: kopfHoehe + l.hoehe, alignment: .topLeading)
        }
        .frame(height: kopfHoehe + l.hoehe)
        .animation(.snappy(duration: 0.2), value: dichte)
    }

    /// Hellgrauer Rastergrund, Pausen als etwas dunkleres Band über die ganze Breite, feine Linie zwischen Stunden ohne
    /// Pause.
    private func rastergrund(_ l: Rasterlage) -> some View {
        ZStack(alignment: .topLeading) {
            Rectangle().fill(Farben.rasterGrund)
            ForEach(l.baender) { b in
                Rectangle()
                    .fill(Farben.rasterPause)
                    .frame(height: b.hoehe)
                    .offset(y: b.y)
            }
            ForEach(Array(l.oben.enumerated()), id: \.offset) { i, y in
                if i > 0 && band(nach: i - 1) == 0 {
                    Rectangle()
                        .fill(Farben.rasterLinie)
                        .frame(height: 0.5)
                        .offset(y: y)
                }
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
        .accessibilityHidden(true)
    }

    private func zeitZelle(_ r: Rasterzeit, hoehe: CGFloat) -> some View {
        VStack(spacing: 1) {
            Text("\(r.nr)")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Farben.text)
            Text(Uhr.uhrzeit(r.beginn))
                .font(.system(size: 10))
                .foregroundStyle(Farben.text3)
            if hoehe >= 52 {
                Text(Uhr.uhrzeit(r.ende))
                    .font(.system(size: 10))
                    .foregroundStyle(Farben.text3.opacity(0.75))
            }
        }
        .monospacedDigit()
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        .padding(.top, 4)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(r.nr). Stunde, \(Uhr.uhrzeit(r.beginn)) bis \(Uhr.uhrzeit(r.ende))")
    }

    /// Jetzt-Linie: dünn über die ganze Woche, am heutigen Tag kräftiger; der Punkt am Rand der Stundenspalte liegt
    /// über den Karten.
    @ViewBuilder
    private func jetztLinie(_ l: Rasterlage, breite: CGFloat, gesamt: CGFloat, nurPunkt: Bool) -> some View {
        if let i = tage.firstIndex(where: { Datumsformat.istHeute($0) }) {
            TimelineView(.periodic(from: .now, by: 30)) { kontext in
                if let y = lageVon(Uhr.minuten(kontext.date), l) {
                    ZStack(alignment: .topLeading) {
                        if nurPunkt {
                            Circle()
                                .fill(Farben.akzent)
                                .frame(width: 9, height: 9)
                                .overlay { Circle().stroke(Farben.grund, lineWidth: 2) }
                                .offset(x: zeitBreite - 5, y: y - 4.5)
                        } else {
                            Rectangle()
                                .fill(Farben.akzent.opacity(0.35))
                                .frame(width: max(0, gesamt - zeitBreite), height: 1)
                                .offset(x: zeitBreite, y: y - 0.5)
                            Rectangle()
                                .fill(Farben.akzent)
                                .frame(width: breite, height: 2)
                                .offset(x: spaltenX(i, breite), y: y - 1)
                        }
                    }
                    .offset(y: kopfHoehe)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
                }
            }
        }
    }

    // MARK: Tagesspalte

    private func tagesSpalte(_ d: String, breite: CGFloat, lage l: Rasterlage) -> some View {
        let heute = Datumsformat.istHeute(d)
        let t = modell.tag(d)
        let bloecke = t.map { erstelleBloecke($0) } ?? []
        return ZStack(alignment: .topLeading) {
            if heute {
                Rectangle()
                    .fill(Farben.akzent.opacity(0.06))
                    .frame(width: breite, height: l.hoehe)
                    .offset(y: kopfHoehe)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
            kopf(d, heute: heute, breite: breite)
            if let t, t.freiText == nil {
                let liste = banner(t)
                ForEach(Array(liste.prefix(bannerZeilen).enumerated()), id: \.element.id) { i, k in
                    bannerZeichen(k, tag: t, breite: breite, mehr: i == bannerZeilen - 1 ? liste.count - bannerZeilen : 0)
                        .offset(y: datumHoehe + CGFloat(i) * bannerHoehe)
                }
            }
            if let t, let f = t.freiText {
                freiFeld(f.titel, breite: breite, hoehe: l.hoehe)
                    .offset(y: kopfHoehe)
            } else if let t {
                ForEach(bloecke) { b in
                    karte(b, tag: t, lage: l, breite: breite)
                }
                ForEach(bloecke.filter { !$0.verdeckt.isEmpty }) { b in
                    plusZeichen(b, tag: t, lage: l, breite: breite)
                }
                ForEach(aufsichten(t, lage: l)) { a in
                    aufsichtZeichen(a, tag: t, breite: breite)
                }
            }
        }
    }

    /// Tageskopf: Wochentag und Datum, heute in Petrol mit feiner Linie; Antippen öffnet den Tag.
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
                    .font(.system(size: 13, weight: heute ? .bold : .semibold))
                HStack(spacing: 3) {
                    Text(Datumsformat.anzeige(d, "d.M."))
                        .font(.system(size: 11))
                        .monospacedDigit()
                    if entfall || aenderung {
                        Circle()
                            .fill(entfall ? Farben.entfall : Farben.aenderung)
                            .frame(width: 5, height: 5)
                    }
                }
            }
            .foregroundStyle(heute ? Farben.akzent : Farben.text2)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
            .frame(width: breite, height: datumHoehe - 4)
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

    /// Schmales Banner im Tageskopf: Titel und Zeit (bzw. „ganztägig“), gestrichelt in der Terminfarbe.
    private func bannerZeichen(_ k: Kachel, tag: Tagesansicht, breite: CGFloat, mehr: Int) -> some View {
        let quelle = "woche-b-\(k.id.uuidString)"
        let ganztags = k.art == .ganztagTermin
        let zeit = ganztags ? "" : " \(Uhr.uhrzeit(k.beginn))–\(Uhr.uhrzeit(k.ende))"
        let form = RoundedRectangle(cornerRadius: 4, style: .continuous)
        return Button {
            antippen(k, tag, quelle)
        } label: {
            HStack(spacing: 2) {
                Text(k.anzeigeTitel)
                    .font(.system(size: 10.5, weight: .semibold))
                    .foregroundStyle(Farben.termin)
                if breite >= 90 && !zeit.isEmpty {
                    Text(zeit)
                        .font(.system(size: 10))
                        .monospacedDigit()
                        .foregroundStyle(Farben.text2)
                }
                Spacer(minLength: 0)
                if mehr > 0 {
                    Text("+\(mehr)")
                        .font(.system(size: 9.5, weight: .semibold))
                        .foregroundStyle(Farben.text2)
                }
            }
            .lineLimit(1)
            .padding(.horizontal, 4)
            .frame(width: breite, height: bannerHoehe - 3, alignment: .leading)
            .background(Farben.terminFlaeche, in: form)
            .overlay { form.strokeBorder(Farben.termin.opacity(0.45), style: StrokeStyle(lineWidth: 1, dash: [3, 2])) }
            .zoomQuelle(quelle, in: raum)
        }
        .buttonStyle(KachelDruckStil())
        .stundenMenue(k) { antippen(k, tag, quelle) }
        .accessibilityLabel("\(k.anzeigeTitel), " + (ganztags ? "ganztägig" : "\(Uhr.uhrzeit(k.beginn)) bis \(Uhr.uhrzeit(k.ende))"))
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
        .background(Farben.freiFlaeche, in: RoundedRectangle(cornerRadius: 5, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    // MARK: Blöcke

    /// Vordere Stunde einer Zeit (voll breit) mit den dahinterliegenden gleichzeitigen Stunden.
    private struct Block: Identifiable {
        let kachel: Kachel
        let von: Int
        let bis: Int
        var verdeckt: [Kachel]
        var id: UUID { kachel.id }
    }

    /// Je Zeit eine vordere Stunde: Änderungen zuerst, dann die längere, dann der Rang. Jede weitere Stunde, die sich mit
    /// einer vorderen überschneidet, liegt dahinter (Zahl „+X“ an der vorderen).
    private func erstelleBloecke(_ t: Tagesansicht) -> [Block] {
        let liste = t.kacheln
            .filter { !$0.inPause && $0.karte != nil && !istBanner($0) }
            .compactMap { k -> (Kachel, Int, Int)? in
                guard let z = zeilen(k) else { return nil }
                return (k, z.von, z.bis)
            }
            .sorted { a, b in
                if a.1 != b.1 { return a.1 < b.1 }
                if a.0.vorrang != b.0.vorrang { return a.0.vorrang }
                if a.2 != b.2 { return a.2 > b.2 }
                return a.0.rang < b.0.rang
            }
        var ergebnis: [Block] = []
        for e in liste {
            if let i = ergebnis.firstIndex(where: { $0.von <= e.2 && e.1 <= $0.bis }) {
                ergebnis[i].verdeckt.append(e.0)
            } else {
                ergebnis.append(Block(kachel: e.0, von: e.1, bis: e.2, verdeckt: []))
            }
        }
        return ergebnis
    }

    private func karte(_ b: Block, tag: Tagesansicht, lage l: Rasterlage, breite: CGFloat) -> some View {
        let quelle = "woche-\(b.kachel.id.uuidString)"
        let s = l.spanne(von: b.von, bis: b.bis)
        let h = max(0, s.h - 2 * einzug)
        return Button {
            antippen(b.kachel, tag, quelle)
        } label: {
            RasterKarte(kachel: b.kachel, weitere: b.verdeckt.count, hoehe: h,
                        vergangen: Tagesansicht.vergangen(b.kachel, jetzt: Date()))
                .zoomQuelle(quelle, in: raum)
        }
        .buttonStyle(KachelDruckStil())
        .stundenMenue(b.kachel) { antippen(b.kachel, tag, quelle) }
        .frame(width: breite, height: h)
        .offset(x: 0, y: kopfHoehe + s.y + einzug)
    }

    /// „+X“ oben rechts in der Zelle der vorderen Stunde: kleines, neutrales Rechteck mit feiner Linie (den Status
    /// zeigt die Karte selbst).
    private func plusZeichen(_ b: Block, tag: Tagesansicht, lage l: Rasterlage, breite: CGFloat) -> some View {
        let alle = [b.kachel] + b.verdeckt
        let form = RoundedRectangle(cornerRadius: 4, style: .continuous)
        let anzahl = b.verdeckt.count
        let vorbei = alle.allSatisfy { Tagesansicht.vergangen($0, jetzt: Date()) }
        let s = l.spanne(von: b.von, bis: b.bis)
        return Button {
            Haptik.tippen()
            parallele(Parallelgruppe(kacheln: alle, tag: tag))
        } label: {
            Text("+\(anzahl)")
                .font(.system(size: 10.5, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(Farben.text2)
                .padding(.horizontal, 4)
                .frame(minWidth: 20, minHeight: 16)
                .background(Farben.neutralFlaeche, in: form)
                .overlay { form.strokeBorder(Farben.randStark, lineWidth: 1) }
                .opacity(vorbei ? 0.7 : 1)
                .padding(6)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        // 3 pt vom oberen und rechten Rand der Zelle (die Tippfläche ist 6 pt größer)
        .frame(width: breite + 3, alignment: .topTrailing)
        .offset(x: 0, y: kopfHoehe + s.y + 3 - 6)
        .accessibilityLabel(anzahl == 1 ? "1 weitere Stunde zur selben Zeit" : "\(anzahl) weitere Stunden zur selben Zeit")
        .accessibilityHint("Zeigt alle Stunden dieser Zeit")
    }

    // MARK: Pausenaufsichten

    private struct AufsichtLage: Identifiable {
        let kachel: Kachel
        let y: CGFloat
        var id: UUID { kachel.id }
    }

    private func aufsichten(_ t: Tagesansicht, lage l: Rasterlage) -> [AufsichtLage] {
        t.kacheln.filter { $0.inPause && $0.aufsicht != nil }.compactMap { k in
            guard let y = lageVon((k.beginn + k.ende) / 2, l) else { return nil }
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
            .background(Farben.karte, in: Capsule())
            .overlay { Capsule().strokeBorder(m?.betont == true ? (m?.farbe ?? Farben.randStark) : Farben.randStark, lineWidth: 1) }
            .zoomQuelle(quelle, in: raum)
        }
        .buttonStyle(.plain)
        .offset(x: 4, y: kopfHoehe + a.y - 6)
        .accessibilityLabel("Pausenaufsicht \(a.kachel.anzeigeTitel), \(a.kachel.zeitText)")
    }
}

/// Jetzt-Linie: Punkt links und eine Linie in der Akzentfarbe (Zeitachse, Tagesliste).
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

/// Karte des Wochenrasters (wie die PWA): weiße Karte, Radius 5, 4-pt-Balken innen links (grau bzw. Fachfarbe), drei
/// Zeilen – Lehrkraft bzw. Klasse fett, Fach, Raum (Reihenfolge nach der Kartendarstellung der Schule); geänderte Werte
/// violett unterstrichen bzw. „alt → neu“. Status über Linie, Fläche, Schraffur und Durchstreichung; das Statuswort steht
/// unten links, wo unter den Zeilen Platz ist.
struct RasterKarte: View {
    let kachel: Kachel
    /// Dahinterliegende gleichzeitige Stunden (rechts oben steht dann „+X“)
    let weitere: Int
    let hoehe: CGFloat
    let vergangen: Bool

    @Environment(\.kartendarstellung) private var darstellung

    private var entfall: Bool { kachel.kartenart == .entfall }
    /// Radius 4–6 (Schulwert, Standard 5) und Balkenbreite 2–6 (Schulwert, Standard 4) wie die PWA
    private var radius: CGFloat { CGFloat(min(6, max(4, darstellung.eckenradius))) }
    private var balken: CGFloat { CGFloat(min(6, max(2, darstellung.balkenbreite))) }

    private struct Zeile: Identifiable {
        let id: Int
        let text: Text
    }

    /// Zeilen nach der Kartendarstellung: Lehrkraft bzw. Klasse · Fach · Raum (bzw. Fach zuerst); geänderte Werte
    /// stehen immer da.
    private var zeilen: [Zeile] {
        let person = kachel.personenzeilen.first { !$0.text.isEmpty }
        let raum = kachel.zeile("raum").flatMap { $0.text.isEmpty ? nil : $0 }
        let mitPerson = person.map { darstellung.zeile2 || !$0.nurText } ?? false
        let mitRaum = raum.map { darstellung.raum || !$0.nurText } ?? false
        let fach = Text(kachel.fachText(darstellung))
        var liste: [Text] = []
        if darstellung.reihenfolge == "fach" {
            liste.append(fach)
            if mitPerson, let person { liste.append(kachelText(person, karte: kachel.karte)) }
        } else {
            if mitPerson, let person { liste.append(kachelText(person, karte: kachel.karte)) }
            liste.append(fach)
        }
        if mitRaum, let raum { liste.append(kachelText(raum, karte: kachel.karte)) }
        return liste.enumerated().map { Zeile(id: $0.offset, text: $0.element) }
    }

    var body: some View {
        let stil = Klassikstil.fuer(kachel, darstellung)
        let alle = zeilen
        let platz = max(1, Int((hoehe - 6) / 14))
        let sichtbar = Array(alle.prefix(platz))
        let wortPlatz = hoehe - 6 - CGFloat(sichtbar.count) * 14 >= 13
        VStack(alignment: .leading, spacing: 0) {
            ForEach(sichtbar) { z in
                z.text
                    .font(.system(size: z.id == 0 ? 12.5 : 12, weight: z.id == 0 ? .semibold : .regular))
                    .foregroundStyle(z.id == 0 ? (entfall ? Farben.entfall : stil.titel) : (z.id == 1 ? Farben.text : Farben.text2))
                    .strikethrough(entfall, color: Farben.entfall.opacity(0.75))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                    .frame(height: 14, alignment: .leading)
                    .padding(.trailing, z.id == 0 && weitere > 0 ? 22 : 0)
            }
            Spacer(minLength: 0)
            if wortPlatz, let m = Statuslehre.kartenwort(kachel, darstellung) {
                Statuswort(merkmal: m)
            }
        }
        .monospacedDigit()
        .dynamicTypeSize(...DynamicTypeSize.xLarge)
        .padding(.leading, (stil.mitBalken ? balken : 0) + 9)
        .padding(.trailing, 3)
        .padding(.vertical, 3)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .klassikKarte(stil, radius: radius, balkenBreite: balken)
        .opacity(vergangen ? 0.62 : (stil.gedaempft && !entfall ? 0.8 : 1))
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(kachel.vorlesetext + (weitere > 0 ? ", \(weitere) weitere Stunden zur selben Zeit" : ""))
        .accessibilityAddTraits(.isButton)
    }
}

// MARK: - Blatt „Stunden zur selben Zeit“

/// Blatt hinter „+X“: alle Stunden dieser Zeit als Liste (Balken in der Fachfarbe, Fach, Lehrkraft bzw. Klasse, Raum,
/// Status); Antippen öffnet die Stunde.
struct ParalleleStundenBlatt: View {
    let gruppe: Parallelgruppe
    let oeffnen: (Kachel) -> Void

    @Environment(\.dismiss) private var schliessen
    @Environment(\.kartendarstellung) private var darstellung

    private var zeitraum: String {
        let beginn = gruppe.kacheln.map(\.beginn).min() ?? 0
        let ende = gruppe.kacheln.map(\.ende).max() ?? 0
        let von = gruppe.kacheln.map(\.von).min() ?? 0
        let bis = gruppe.kacheln.map(\.bis).max() ?? 0
        let stunden = von > 0 ? (von == bis ? " · \(von). Std." : " · \(von).–\(bis). Std.") : ""
        return "\(Datumsformat.anzeige(gruppe.datum, "EEEE, d. MMMM")) · \(Uhr.uhrzeit(beginn))–\(Uhr.uhrzeit(ende))" + stunden
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(gruppe.kacheln) { k in
                        Button {
                            Haptik.tippen()
                            oeffnen(k)
                        } label: {
                            zeile(k)
                        }
                        .buttonStyle(.plain)
                    }
                } footer: {
                    Text(zeitraum)
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle(gruppe.kacheln.count == 1 ? "1 Stunde" : "\(gruppe.kacheln.count) Stunden zur selben Zeit")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fertig") { schliessen() }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func zeile(_ k: Kachel) -> some View {
        let stil = Klassikstil.fuer(k, darstellung)
        let entfall = k.kartenart == .entfall
        let raum = k.zeile("raum").flatMap { $0.text.isEmpty ? nil : $0 }
        return HStack(alignment: .center, spacing: 12) {
            RoundedRectangle(cornerRadius: 2, style: .continuous)
                .fill(stil.mitBalken ? stil.balken : Farben.balkenGrau)
                .frame(width: 4)
                .padding(.vertical, 2)
            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(k.fachText(darstellung))
                        .font(.body.weight(.semibold))
                        .foregroundStyle(entfall ? Farben.entfall : Farben.text)
                        .strikethrough(entfall, color: Farben.entfall)
                    if !k.fachname.isEmpty {
                        Text(k.fachname)
                            .font(.subheadline)
                            .foregroundStyle(Farben.text3)
                            .lineLimit(1)
                    }
                }
                let personen = k.personenzeilen.filter { !$0.text.isEmpty }
                if !personen.isEmpty {
                    personen.dropFirst().reduce(kachelText(personen[0], karte: k.karte)) { t, z in
                        t + Text(" · ") + kachelText(z, karte: k.karte)
                    }
                    .font(.subheadline)
                    .foregroundStyle(Farben.text2)
                    .lineLimit(2)
                }
                if let m = Statuslehre.merkmal(k) {
                    Text(m.text)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(m.farbe)
                }
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 3) {
                if let raum {
                    kachelText(raum, karte: k.karte)
                        .font(.subheadline.weight(.semibold))
                        .monospacedDigit()
                        .foregroundStyle(Farben.text)
                }
                Text(k.zeitText)
                    .font(.caption)
                    .monospacedDigit()
                    .foregroundStyle(Farben.text3)
            }
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Farben.pfeil)
                .accessibilityHidden(true)
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityHint("Öffnet die Stunde")
    }
}
