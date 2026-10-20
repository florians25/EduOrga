import SwiftUI

// Wochenansicht des Plans („Stundenkarte mobil (v3)“, design/DESIGN.md): Spalten Montag bis Freitag (bzw. die Schultage
// der Woche), Zeilen = Stunden des Zeitrasters. Jede Stunde hat dieselbe Höhe, Pausen stehen als schmales Band dazwischen
// (ab 15 Minuten breiter), Doppelstunden reichen genau über zwei Zeilen samt Band. Die Zeilen werden so hoch, dass der
// Schultag bis zur letzten belegten (mindestens der 6.) Stunde auf den Bildschirm passt.
// Zeitspalte: Beginn oben, Stundennummer in der Mitte, Ende unten. Tageskopf: Datum groß („17.11“), darunter der
// Wochentag. Karten füllen ihre Zelle mit kleinen, gleichmäßigen Abständen und sind nie breiter als die Spalte.
// Gleichzeitige Stunden: die vordere Stunde (Änderungen zuerst) füllt die Zelle, am rechten Rand innen sitzt ein weicher
// Reiter „+N“; Antippen öffnet ein Blatt mit allen Stunden dieser Zeit. Veranstaltungen (AG, Schulfest …) stehen als
// eigener, warmer Block über ihre Zeit. Antippen einer Karte öffnet die Stunde, langes Drücken zeigt die Aktionen,
// Antippen des Tageskopfs öffnet den Tag. Mehrere Pläne nebeneinander (iPad): Mehrfachplan.swift.

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

/// Stunden derselben Zeit (vordere Stunde zuerst) – Inhalt des Blatts hinter „+N“.
struct Parallelgruppe: Identifiable {
    let id = UUID()
    let kacheln: [Kachel]
    let tag: Tagesansicht
    /// Plan, aus dem die Stunden stammen (Mehrfachansicht); nil = der Plan der Seite
    var plan: PlanAuswahl? = nil

    var datum: String { tag.datum }
}

/// Antippen einer Karte: Kachel, Tag, Kennung der Zoom-Quelle und (Mehrfachansicht) der Plan der Spalte.
typealias Rasterantippen = (Kachel, Tagesansicht, String, PlanAuswahl?) -> Void

// MARK: - Seiten (Wochen waagrecht)

/// Wochen als waagrechte Seiten: wischen = vorige bzw. nächste Woche. Die gewählte Woche folgt `montag`.
struct WochenSeiten: View {
    @ObservedObject var modell: Planmodell
    @ObservedObject var mehrfach: Mehrfachplaene
    /// Mehrere Pläne nebeneinander zeigen (iPad, mindestens ein Plan gewählt)
    let mehrfachAktiv: Bool
    let montage: [String]
    @Binding var montag: String
    let raum: Namespace.ID?
    let antippen: Rasterantippen
    let tagOeffnen: (String) -> Void
    let parallele: (Parallelgruppe) -> Void

    @State private var position: String? = nil

    var body: some View {
        ScrollView(.horizontal) {
            LazyHStack(spacing: 0) {
                ForEach(montage, id: \.self) { m in
                    WochenSeite(modell: modell, mehrfach: mehrfach, mehrfachAktiv: mehrfachAktiv, montag: m, raum: raum,
                                antippen: antippen, tagOeffnen: tagOeffnen, parallele: parallele)
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
    @ObservedObject var mehrfach: Mehrfachplaene
    let mehrfachAktiv: Bool
    let montag: String
    let raum: Namespace.ID?
    let antippen: Rasterantippen
    let tagOeffnen: (String) -> Void
    let parallele: (Parallelgruppe) -> Void

    private var ladeKennung: String {
        mehrfachAktiv ? "m|\(mehrfach.kennung)|\(montag)" : "\(modell.typ)|\(modell.element)|\(montag)"
    }

    var body: some View {
        GeometryReader { geo in
            ScrollView(.vertical) {
                Group {
                    if mehrfachAktiv {
                        Mehrfachraster(mehrfach: mehrfach, montag: montag, raum: raum, antippen: antippen,
                                       tagOeffnen: tagOeffnen, parallele: parallele, verfuegbar: geo.size)
                    } else {
                        Wochenraster(modell: modell, montag: montag, raum: raum, antippen: antippen, tagOeffnen: tagOeffnen,
                                     parallele: parallele, verfuegbar: geo.size)
                    }
                }
                .padding(.bottom, 6)
            }
            .scrollIndicators(.hidden)
            .refreshable {
                if mehrfachAktiv {
                    await mehrfach.laden(montag: montag, erzwingen: true)
                } else {
                    await modell.laden(montag: montag, erzwingen: true)
                }
                Haptik.erfolg()
            }
        }
        .task(id: ladeKennung) {
            if mehrfachAktiv {
                await mehrfach.laden(montag: montag)
            } else {
                await modell.laden(montag: montag)
            }
        }
    }
}

// MARK: - Maße und Lage der Zeilen

/// Feste Maße des Wochenrasters (Einzel- und Mehrfachansicht).
enum Rastermass {
    /// Höhe des Tageskopfs (Datum und Wochentag)
    static let datumHoehe: CGFloat = 42
    /// Höhe eines Banners (ganztägige bzw. mehrstündige Termine) im Tageskopf
    static let bannerHoehe: CGFloat = 20
    /// Abstand zwischen den Tagesspalten
    static let spaltenLuecke: CGFloat = 3
    /// Band für kurze Pausen bzw. große Pausen (ab 15 Minuten)
    static let bandKlein: CGFloat = 3
    static let bandGross: CGFloat = 12
    static let zeileMin: CGFloat = 52
    static let zeileMax: CGFloat = 112
    /// Abstand der Karte zum Zeilenrand (oben und unten) – zusammen mit der Spaltenlücke gleichmäßige Abstände
    static let einzug: CGFloat = 1.5

    /// Linke Kante der Tagesspalte `i`.
    static func spaltenX(_ i: Int, breite: CGFloat, zeit: CGFloat) -> CGFloat {
        zeit + spaltenLuecke + CGFloat(i) * (breite + spaltenLuecke)
    }
}

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

/// Zeitraster mit fester Zeilenhöhe: Lage der Zeilen, Uhrzeiten und Kacheln im Raster.
struct Rastergeometrie {
    let raster: [Rasterzeit]
    let lage: Rasterlage

    init(raster: [Rasterzeit], zeile: CGFloat) {
        self.raster = raster
        var oben: [CGFloat] = []
        var baender: [Pausenband] = []
        var y: CGFloat = 0
        for i in raster.indices {
            oben.append(y)
            y += zeile
            let b = Rastergeometrie.band(raster, nach: i)
            if b > 0 {
                baender.append(Pausenband(id: i, y: y, hoehe: b, gross: b >= Rastermass.bandGross))
                y += b
            }
        }
        lage = Rasterlage(oben: oben, zeile: zeile, hoehe: y, baender: baender)
    }

    /// Band nach der Rasterzeile `i` (0 = Stunden schließen direkt aneinander an).
    static func band(_ raster: [Rasterzeit], nach i: Int) -> CGFloat {
        guard i >= 0, i + 1 < raster.count else { return 0 }
        let pause = raster[i + 1].beginn - raster[i].ende
        return pause >= 15 ? Rastermass.bandGross : (pause > 0 ? Rastermass.bandKlein : 0)
    }

    func band(nach i: Int) -> CGFloat { Rastergeometrie.band(raster, nach: i) }

    /// Senkrechte Lage einer Uhrzeit (Minuten): in einer Stunde anteilig, in einer Pause anteilig im Band.
    func y(_ minute: Int) -> CGFloat? {
        let l = lage
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
    static func zeilen(_ k: Kachel, raster: [Rasterzeit]) -> (von: Int, bis: Int)? {
        if let a = raster.firstIndex(where: { $0.nr == k.von }), let b = raster.firstIndex(where: { $0.nr == k.bis }), b >= a {
            return (a, b)
        }
        guard let a = raster.firstIndex(where: { $0.ende > k.beginn }),
              let b = raster.lastIndex(where: { $0.beginn < k.ende }), b >= a else { return nil }
        return (a, b)
    }

    func zeilen(_ k: Kachel) -> (von: Int, bis: Int)? { Rastergeometrie.zeilen(k, raster: raster) }

    /// Ganztägige und mehrstündige Termine bzw. Veranstaltungen (Elternsprechtag, Pädagogischer Tag …): nicht als hohe
    /// Säule, sondern als schmales Banner im Tageskopf – die Stunden bleiben lesbar.
    static func istBanner(_ k: Kachel) -> Bool {
        guard !k.inPause, let karte = k.karte, !karte.istRaumbuchung else { return false }
        guard k.art == .termin || k.art == .veranstaltung || k.art == .ganztagTermin else { return false }
        return k.bis - k.von >= 2 || k.ende - k.beginn >= 180
    }

    static func banner(_ t: Tagesansicht) -> [Kachel] {
        t.ganztags + t.kacheln.filter { istBanner($0) }
    }

    /// Veranstaltung bzw. Termin im Raster (eigener Block statt Stundenkarte).
    static func istEreignis(_ k: Kachel) -> Bool {
        guard !k.inPause, k.karte != nil else { return false }
        if k.art == .veranstaltung { return true }
        return k.art == .termin && k.karte?.istRaumbuchung != true
    }

    /// Gleiche Veranstaltung in mehreren Plänen (Mehrfachansicht): Titel, Datum und Stunden.
    static func ereignisSchluessel(_ k: Kachel) -> String {
        "\(k.datum)|\(k.von)|\(k.bis)|\(k.anzeigeTitel.lowercased())"
    }

    /// Letzte belegte Rasterzeile der Tage, mindestens die 6. Stunde.
    static func letzteZeile(_ tage: [Tagesansicht], raster: [Rasterzeit]) -> Int {
        guard !raster.isEmpty else { return 0 }
        var letzte = min(5, raster.count - 1)
        for t in tage {
            for k in t.kacheln where !k.inPause && k.karte != nil && !istBanner(k) {
                if let z = zeilen(k, raster: raster) { letzte = max(letzte, z.bis) }
            }
        }
        return min(letzte, raster.count - 1)
    }

    /// Zeilenhöhe: alle Stunden bis zur letzten belegten passen in die Höhe (52–112 pt, im Querformat mindestens 56).
    static func zeilenHoehe(raster: [Rasterzeit], bis: Int, verfuegbar: CGSize, kopf: CGFloat, dichte: Double) -> CGFloat {
        guard !raster.isEmpty else { return 64 }
        var baender: CGFloat = 0
        for i in 0..<max(0, bis) { baender += band(raster, nach: i) }
        let anzahl = CGFloat(bis + 1)
        let quer = verfuegbar.width > verfuegbar.height && verfuegbar.height > 0
        let passend = verfuegbar.height > 0 ? ((verfuegbar.height - kopf - 10 - baender) / anzahl).rounded(.down) : 64
        let basis = min(Rastermass.zeileMax, max(quer ? 56 : Rastermass.zeileMin, passend))
        let faktor = CGFloat(min(Wochendichte.bereich.upperBound, max(Wochendichte.bereich.lowerBound, dichte)))
        return max(40, (basis * faktor).rounded())
    }
}

// MARK: - Raster (ein Plan)

struct Wochenraster: View {
    @ObservedObject var modell: Planmodell
    let montag: String
    let raum: Namespace.ID?
    let antippen: Rasterantippen
    let tagOeffnen: (String) -> Void
    let parallele: (Parallelgruppe) -> Void
    /// Verfügbare Fläche der Seite: die Zeilen werden so hoch, dass der Schultag auf den Bildschirm passt
    var verfuegbar: CGSize = .zero

    @AppStorage(Wochendichte.schluessel) private var dichte: Double = Wochendichte.normal
    @ScaledMetric(relativeTo: .caption) private var zeitBreite: CGFloat = 38

    private var tage: [String] { modell.tage(montag: montag) }

    /// Kopf über dem Raster: Datum und (falls in der Woche vorhanden) bis zu zwei Bannerzeilen.
    private var kopfHoehe: CGFloat {
        Rastermass.datumHoehe + CGFloat(bannerZeilen) * Rastermass.bannerHoehe + (bannerZeilen > 0 ? 2 : 0)
    }

    private var bannerZeilen: Int {
        var n = 0
        for d in tage {
            if let t = modell.tag(d), t.freiText == nil { n = max(n, Rastergeometrie.banner(t).count) }
        }
        return min(n, 2)
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

    private var rasterflaeche: some View {
        let ansichten = tage.compactMap { modell.tag($0) }
        let letzte = Rastergeometrie.letzteZeile(ansichten, raster: raster)
        let zeile = Rastergeometrie.zeilenHoehe(raster: raster, bis: letzte, verfuegbar: verfuegbar, kopf: kopfHoehe, dichte: dichte)
        let geo = Rastergeometrie(raster: raster, zeile: zeile)
        let l = geo.lage
        let kopf = kopfHoehe
        return GeometryReader { g in
            let spalten = max(tage.count, 1)
            let breite = max(0, (g.size.width - zeitBreite - CGFloat(spalten) * Rastermass.spaltenLuecke) / CGFloat(spalten))
            ZStack(alignment: .topLeading) {
                Rastergrund(geo: geo)
                    .frame(width: g.size.width, height: l.hoehe)
                    .offset(y: kopf)
                ForEach(Array(raster.enumerated()), id: \.offset) { i, r in
                    RasterZeitZelle(zeit: r, hoehe: l.zeile)
                        .frame(width: zeitBreite, height: l.zeile)
                        .offset(x: 0, y: kopf + l.oben[i])
                }
                // Jetzt-Linie hinter den Karten (sie soll nicht wie eine Durchstreichung wirken)
                WochenJetztLinie(geo: geo, tage: tage, zeitBreite: zeitBreite, breite: breite, gesamt: g.size.width, kopf: kopf,
                                 nurPunkt: false)
                ForEach(Array(tage.enumerated()), id: \.element) { i, d in
                    tagesSpalte(d, breite: breite, geo: geo)
                        .frame(width: breite, height: kopf + l.hoehe, alignment: .topLeading)
                        .offset(x: Rastermass.spaltenX(i, breite: breite, zeit: zeitBreite), y: 0)
                }
                WochenJetztLinie(geo: geo, tage: tage, zeitBreite: zeitBreite, breite: breite, gesamt: g.size.width, kopf: kopf,
                                 nurPunkt: true)
            }
            .frame(width: g.size.width, height: kopf + l.hoehe, alignment: .topLeading)
        }
        .frame(height: kopf + l.hoehe)
        .animation(.snappy(duration: 0.2), value: dichte)
    }

    private func tagesSpalte(_ d: String, breite: CGFloat, geo: Rastergeometrie) -> some View {
        let heute = Datumsformat.istHeute(d)
        let t = modell.tag(d)
        let zeilen = bannerZeilen
        let kopf = kopfHoehe
        return ZStack(alignment: .topLeading) {
            if heute {
                Rectangle()
                    .fill(Farben.akzent.opacity(0.06))
                    .frame(width: breite, height: geo.lage.hoehe)
                    .offset(y: kopf)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
            RasterTageskopf(datum: d, tag: t, breite: breite, hoehe: Rastermass.datumHoehe) { tagOeffnen(d) }
            if let t, t.freiText == nil {
                let liste = Rastergeometrie.banner(t)
                ForEach(Array(liste.prefix(zeilen).enumerated()), id: \.element.id) { i, k in
                    Tagesbanner(kachel: k, breite: breite, mehr: i == zeilen - 1 ? liste.count - zeilen : 0, raum: raum) { quelle in
                        antippen(k, t, quelle, nil)
                    }
                    .offset(y: Rastermass.datumHoehe + CGFloat(i) * Rastermass.bannerHoehe)
                }
            }
            if let t {
                Tagesspalte(tag: t, geo: geo, breite: breite, raum: raum, antippen: antippen, parallele: parallele)
                    .offset(y: kopf)
            }
        }
    }
}

// MARK: - Bausteine des Rasters

/// Hellgrauer Rastergrund, Pausen als etwas dunkleres Band über die ganze Breite, feine Linie zwischen Stunden ohne Pause.
struct Rastergrund: View {
    let geo: Rastergeometrie

    var body: some View {
        let l = geo.lage
        ZStack(alignment: .topLeading) {
            Rectangle().fill(Farben.rasterGrund)
            ForEach(l.baender) { b in
                Rectangle()
                    .fill(Farben.rasterPause)
                    .frame(height: b.hoehe)
                    .offset(y: b.y)
            }
            ForEach(Array(l.oben.enumerated()), id: \.offset) { i, y in
                if i > 0 && geo.band(nach: i - 1) == 0 {
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
}

/// Zelle der Zeitspalte: Beginn oben, Stundennummer in der Mitte, Ende unten (bei niedrigen Zeilen ohne Ende).
struct RasterZeitZelle: View {
    let zeit: Rasterzeit
    let hoehe: CGFloat

    var body: some View {
        VStack(spacing: 0) {
            Text(Uhr.uhrzeit(zeit.beginn))
                .font(.system(size: 10.5))
                .foregroundStyle(Farben.text3)
            Spacer(minLength: 0)
            Text("\(zeit.nr)")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Farben.text)
            Spacer(minLength: 0)
            if hoehe >= 46 {
                Text(Uhr.uhrzeit(zeit.ende))
                    .font(.system(size: 10.5))
                    .foregroundStyle(Farben.text3)
            }
        }
        .monospacedDigit()
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        .padding(.vertical, 2)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(zeit.nr). Stunde, \(Uhr.uhrzeit(zeit.beginn)) bis \(Uhr.uhrzeit(zeit.ende))")
    }
}

/// Tageskopf: Datum groß („17.11“), darunter der Wochentag; heute in Petrol mit feiner Linie, ein Punkt in der
/// Statusfarbe zeigt Änderungen bzw. Entfall des Tages. Antippen öffnet den Tag.
struct RasterTageskopf: View {
    let datum: String
    let tag: Tagesansicht?
    let breite: CGFloat
    let hoehe: CGFloat
    let oeffnen: () -> Void

    private var wochentag: String {
        Datumsformat.anzeige(datum, "EE").replacingOccurrences(of: ".", with: "")
    }

    var body: some View {
        let heute = Datumsformat.istHeute(datum)
        let entfall = (tag?.anzahlEntfall ?? 0) > 0
        let aenderung = (tag?.anzahlAenderung ?? 0) > 0
        Button {
            Haptik.auswahl()
            oeffnen()
        } label: {
            VStack(spacing: 1) {
                Text(Datumsformat.anzeige(datum, "dd.MM"))
                    .font(.system(size: breite < 50 ? 13 : 15.5, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(heute ? Farben.akzent : Farben.text)
                HStack(spacing: 3) {
                    Text(wochentag)
                        .font(.system(size: 12, weight: heute ? .semibold : .regular))
                        .foregroundStyle(heute ? Farben.akzent : Farben.text2)
                    if entfall || aenderung {
                        Circle()
                            .fill(entfall ? Farben.entfall : Farben.aenderung)
                            .frame(width: 5, height: 5)
                    }
                }
            }
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .frame(width: max(0, breite), height: max(0, hoehe - 4))
            .overlay(alignment: .bottom) {
                if heute {
                    Capsule().fill(Farben.akzent).frame(width: min(28, breite * 0.6), height: 2)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel((heute ? "Heute, " : "") + Datumsformat.anzeige(datum, "EEEE, d. MMMM")
                            + (entfall ? ", mit Entfall" : (aenderung ? ", mit Änderungen" : "")) + ". Tag öffnen")
        .accessibilityAddTraits(.isHeader)
    }
}

/// Schmales Banner im Tageskopf: Titel und Zeit (bzw. „ganztägig“), warmes Feld wie die Veranstaltungen im Raster.
struct Tagesbanner: View {
    let kachel: Kachel
    let breite: CGFloat
    let mehr: Int
    let raum: Namespace.ID?
    let antippen: (String) -> Void

    var body: some View {
        let quelle = "woche-b-\(kachel.id.uuidString)"
        let ganztags = kachel.art == .ganztagTermin
        let zeit = ganztags ? "" : " \(Uhr.uhrzeit(kachel.beginn))–\(Uhr.uhrzeit(kachel.ende))"
        let form = RoundedRectangle(cornerRadius: 4, style: .continuous)
        Button {
            antippen(quelle)
        } label: {
            HStack(spacing: 2) {
                Text(kachel.anzeigeTitel)
                    .font(.system(size: 10.5, weight: .semibold))
                    .foregroundStyle(Farben.ereignisText)
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
            .frame(width: max(0, breite), height: Rastermass.bannerHoehe - 3, alignment: .leading)
            .background(Farben.ereignisFlaeche, in: form)
            .overlay { form.strokeBorder(Farben.ereignisRand, lineWidth: 1) }
            .zoomQuelle(quelle, in: raum)
        }
        .buttonStyle(KachelDruckStil())
        .stundenMenue(kachel) { antippen(quelle) }
        .accessibilityLabel("\(kachel.anzeigeTitel), " + (ganztags ? "ganztägig" : "\(Uhr.uhrzeit(kachel.beginn)) bis \(Uhr.uhrzeit(kachel.ende))"))
    }
}

/// Jetzt-Linie: dünn über die ganze Woche, am heutigen Tag kräftiger; der Punkt am Rand der Stundenspalte liegt über den
/// Karten.
struct WochenJetztLinie: View {
    let geo: Rastergeometrie
    let tage: [String]
    let zeitBreite: CGFloat
    let breite: CGFloat
    let gesamt: CGFloat
    let kopf: CGFloat
    let nurPunkt: Bool

    var body: some View {
        if let i = tage.firstIndex(where: { Datumsformat.istHeute($0) }) {
            TimelineView(.periodic(from: .now, by: 30)) { kontext in
                if let y = geo.y(Uhr.minuten(kontext.date)) {
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
                                .frame(width: max(0, breite), height: 2)
                                .offset(x: Rastermass.spaltenX(i, breite: breite, zeit: zeitBreite), y: y - 1)
                        }
                    }
                    .offset(y: kopf)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
                }
            }
        }
    }
}

// MARK: - Tagesspalte

/// Vordere Stunde einer Zeit (füllt die Zelle) mit den dahinterliegenden gleichzeitigen Stunden.
struct Rasterblock: Identifiable {
    let kachel: Kachel
    let von: Int
    let bis: Int
    var verdeckt: [Kachel]
    /// Veranstaltung bzw. Termin (eigener Block)
    let ereignis: Bool

    var id: UUID { kachel.id }
}

/// Inhalt einer Tagesspalte unter dem Kopf (Einzelansicht: der Tag; Mehrfachansicht: ein Plan des Tages): Karten,
/// Reiter „+N“, Veranstaltungen und Pausenaufsichten. Alle Lagen sind relativ zur Oberkante des Rasters.
struct Tagesspalte: View {
    let tag: Tagesansicht
    let geo: Rastergeometrie
    let breite: CGFloat
    let raum: Namespace.ID?
    /// Plan der Spalte (Mehrfachansicht); nil = der Plan der Seite
    var plan: PlanAuswahl? = nil
    /// Veranstaltungen, die die Mehrfachansicht selbst über den ganzen Tag zeichnet
    var ausgelassen: Set<String> = []
    let antippen: Rasterantippen
    let parallele: (Parallelgruppe) -> Void

    var body: some View {
        let bloecke = Tagesspalte.bloecke(tag, geo: geo, ausgelassen: ausgelassen)
        ZStack(alignment: .topLeading) {
            if let f = tag.freiText {
                freiFeld(f.titel)
            } else {
                ForEach(bloecke) { b in
                    block(b)
                }
                ForEach(bloecke.filter { !$0.verdeckt.isEmpty }) { b in
                    plusReiter(b)
                }
                ForEach(aufsichten) { a in
                    aufsichtZeichen(a)
                }
            }
        }
        .frame(width: max(0, breite), height: geo.lage.hoehe, alignment: .topLeading)
    }

    /// Je Zeit eine vordere Stunde: Änderungen zuerst, dann die längere, dann der Rang. Jede weitere Stunde, die sich mit
    /// einer vorderen überschneidet, liegt dahinter („+N“). Veranstaltungen kommen nach den Stunden: überschneiden sie
    /// eine Stunde, liegen sie dahinter, sonst bekommen sie ihren eigenen Block.
    static func bloecke(_ t: Tagesansicht, geo: Rastergeometrie, ausgelassen: Set<String> = []) -> [Rasterblock] {
        let kandidaten = t.kacheln
            .filter { !$0.inPause && $0.karte != nil && !Rastergeometrie.istBanner($0) }
            .filter { !Rastergeometrie.istEreignis($0) || !ausgelassen.contains(Rastergeometrie.ereignisSchluessel($0)) }
            .compactMap { k -> (Kachel, Int, Int)? in
                guard let z = geo.zeilen(k) else { return nil }
                return (k, z.von, z.bis)
            }
        let stunden = kandidaten
            .filter { !Rastergeometrie.istEreignis($0.0) }
            .sorted { a, b in
                if a.1 != b.1 { return a.1 < b.1 }
                if a.0.vorrang != b.0.vorrang { return a.0.vorrang }
                if a.2 != b.2 { return a.2 > b.2 }
                return a.0.rang < b.0.rang
            }
        let ereignisse = kandidaten
            .filter { Rastergeometrie.istEreignis($0.0) }
            .sorted { $0.1 < $1.1 }
        var ergebnis: [Rasterblock] = []
        for e in stunden + ereignisse {
            if let i = ergebnis.firstIndex(where: { $0.von <= e.2 && e.1 <= $0.bis }) {
                ergebnis[i].verdeckt.append(e.0)
            } else {
                ergebnis.append(Rasterblock(kachel: e.0, von: e.1, bis: e.2, verdeckt: [], ereignis: Rastergeometrie.istEreignis(e.0)))
            }
        }
        return ergebnis
    }

    private func block(_ b: Rasterblock) -> some View {
        let quelle = "woche-\(b.kachel.id.uuidString)"
        let s = geo.lage.spanne(von: b.von, bis: b.bis)
        let h = max(0, s.h - 2 * Rastermass.einzug)
        let w = max(0, breite)
        return Button {
            antippen(b.kachel, tag, quelle, plan)
        } label: {
            Group {
                if b.ereignis {
                    Ereigniskarte(kachel: b.kachel, hoehe: h, breite: w,
                                  vergangen: Tagesansicht.vergangen(b.kachel, jetzt: Date()))
                } else {
                    RasterKarte(kachel: b.kachel, weitere: b.verdeckt.count, hoehe: h, breite: w,
                                vergangen: Tagesansicht.vergangen(b.kachel, jetzt: Date()))
                }
            }
            .zoomQuelle(quelle, in: raum)
        }
        .buttonStyle(KachelDruckStil())
        .stundenMenue(b.kachel) { antippen(b.kachel, tag, quelle, plan) }
        .frame(width: w, height: h)
        .offset(x: 0, y: s.y + Rastermass.einzug)
    }

    /// Weicher Reiter „+N“ innen am rechten Rand der Zelle, senkrecht in der Mitte – bleibt immer innerhalb der Spalte.
    private func plusReiter(_ b: Rasterblock) -> some View {
        let alle = [b.kachel] + b.verdeckt
        let anzahl = b.verdeckt.count
        let vorbei = alle.allSatisfy { Tagesansicht.vergangen($0, jetzt: Date()) }
        let s = geo.lage.spanne(von: b.von, bis: b.bis)
        let h = max(0, s.h - 2 * Rastermass.einzug)
        let schmal = breite < 48
        let form = UnevenRoundedRectangle(topLeadingRadius: 4, bottomLeadingRadius: 4, bottomTrailingRadius: 0,
                                          topTrailingRadius: 0, style: .continuous)
        return Button {
            Haptik.tippen()
            parallele(Parallelgruppe(kacheln: alle, tag: tag, plan: plan))
        } label: {
            Text("+\(anzahl)")
                .font(.system(size: schmal ? 10 : 11.5, weight: .semibold))
                .monospacedDigit()
                .lineLimit(1)
                .foregroundStyle(Farben.akzent)
                .padding(.horizontal, schmal ? 3 : 5)
                .frame(minHeight: 20)
                .background(Farben.primaerFlaeche, in: form)
                .overlay { form.stroke(Farben.primaerRand, lineWidth: 0.75) }
                .opacity(vorbei ? 0.7 : 1)
                // größere Tippfläche nach links und oben/unten – nie über den rechten Rand der Spalte hinaus
                .padding(.leading, 8)
                .padding(.vertical, 6)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .frame(width: max(0, breite), height: h, alignment: .trailing)
        .offset(x: 0, y: s.y + Rastermass.einzug)
        .accessibilityLabel(anzahl == 1 ? "1 weitere Stunde zur selben Zeit" : "\(anzahl) weitere Stunden zur selben Zeit")
        .accessibilityHint("Zeigt alle Stunden dieser Zeit")
    }

    private func freiFeld(_ titel: String) -> some View {
        VStack(spacing: 6) {
            Image(systemName: "sun.max")
                .font(.footnote)
                .accessibilityHidden(true)
            Text(titel)
                .font(.caption2.weight(.semibold))
                .multilineTextAlignment(.center)
                .lineLimit(6)
                .minimumScaleFactor(0.7)
        }
        .foregroundStyle(Farben.frei)
        .padding(4)
        .frame(width: max(0, breite), height: geo.lage.hoehe)
        .background(Farben.freiFlaeche, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    // MARK: Pausenaufsichten

    private struct AufsichtLage: Identifiable {
        let kachel: Kachel
        let y: CGFloat
        var id: UUID { kachel.id }
    }

    private var aufsichten: [AufsichtLage] {
        tag.kacheln.filter { $0.inPause && $0.aufsicht != nil }.compactMap { k in
            guard let y = geo.y((k.beginn + k.ende) / 2) else { return nil }
            return AufsichtLage(kachel: k, y: y)
        }
    }

    private func aufsichtZeichen(_ a: AufsichtLage) -> some View {
        let m = Statuslehre.merkmal(a.kachel)
        let quelle = "woche-a-\(a.kachel.id.uuidString)"
        return Button {
            antippen(a.kachel, tag, quelle, plan)
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
            .background(Farben.karte, in: RoundedRectangle(cornerRadius: 3, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 3, style: .continuous)
                    .strokeBorder(m?.betont == true ? (m?.farbe ?? Farben.randStark) : Farben.randStark, lineWidth: 1)
            }
            .zoomQuelle(quelle, in: raum)
        }
        .buttonStyle(.plain)
        .offset(x: 4, y: a.y - 6)
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

/// Stundenkarte des Wochenrasters (v3): füllt die Zelle genau (feste Breite und Höhe, Inhalt beschnitten – nie breiter
/// als die Spalte), leichte Tönung der Fachfarbe, 4-pt-Balken bündig links. Oben links das Fach fett und groß, darunter je
/// eine Zeile Klasse, Lehrkraft und Raum (nach der Kartendarstellung; Änderungen stehen immer da). Geänderte Werte als
/// violettes Feld „neu (alt)“, Balken schraffiert; Entfall grau und durchgestrichen mit „Entfall“ in Rot.
struct RasterKarte: View {
    let kachel: Kachel
    /// Dahinterliegende gleichzeitige Stunden (rechts innen steht dann „+N“)
    let weitere: Int
    let hoehe: CGFloat
    let breite: CGFloat
    let vergangen: Bool

    @Environment(\.kartendarstellung) private var darstellung

    private var entfall: Bool { kachel.kartenart == .entfall }
    /// Radius 6 (Schulwert 5 und mehr), kleiner nur, wenn die Schule es so eingestellt hat
    private var radius: CGFloat { CGFloat(min(6, max(3, darstellung.eckenradius + 1))) }
    private var balken: CGFloat { CGFloat(min(6, max(3, darstellung.balkenbreite))) }

    /// Zeilen unter dem Fach: Klasse, Lehrkraft, Anlass, Raum – ausgeblendete Angaben erscheinen, sobald sie sich ändern.
    private var nebenzeilen: [Kachelzeile] {
        var liste: [Kachelzeile] = []
        for schluessel in ["klasse", "lehrer", "anlass", "raum"] {
            for z in kachel.zeilen where z.schluessel == schluessel && !z.text.trimmingCharacters(in: .whitespaces).isEmpty {
                let zeigen: Bool
                switch schluessel {
                case "raum": zeigen = darstellung.raum || !z.nurText
                case "anlass": zeigen = true
                default: zeigen = darstellung.zeile2 || !z.nurText
                }
                if zeigen { liste.append(z) }
            }
        }
        return liste
    }

    var body: some View {
        let stil = Klassikstil.fuer(kachel, darstellung)
        let schmal = breite < 56
        let titelHoehe: CGFloat = schmal ? 15 : 18
        let zeileHoehe: CGFloat = schmal ? 13 : 15
        let platz = max(0, Int((hoehe - 7 - titelHoehe) / zeileHoehe))
        let mitEntfallWort = entfall && platz >= 1
        let rest = max(0, platz - (mitEntfallWort ? 1 : 0))
        let liste = nebenzeilen
        let sichtbar = Array(liste.prefix(rest))
        let wort = entfall ? nil : Statuslehre.kartenwort(kachel, darstellung)
        let wortPlatz = rest > sichtbar.count
        VStack(alignment: .leading, spacing: 0) {
            Text(kachel.fachText(darstellung))
                .font(.system(size: schmal ? 12.5 : 14.5, weight: .bold))
                .foregroundStyle(entfall ? Farben.text3 : stil.titel)
                .strikethrough(entfall, color: Farben.entfall)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .frame(height: titelHoehe, alignment: .leading)
            if mitEntfallWort {
                Text("Entfall")
                    .font(.system(size: schmal ? 10.5 : 11.5, weight: .semibold))
                    .foregroundStyle(Farben.entfall)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .frame(height: zeileHoehe, alignment: .leading)
            }
            ForEach(Array(sichtbar.enumerated()), id: \.offset) { _, z in
                Kartenwert(zeile: z, karte: kachel.karte, entfall: entfall, schrift: .system(size: schmal ? 11 : 12.5),
                           farbe: Farben.text2)
                    .frame(height: zeileHoehe, alignment: .leading)
            }
            Spacer(minLength: 0)
            if wortPlatz, let wort {
                Statuswort(merkmal: wort)
            }
        }
        .monospacedDigit()
        .padding(.leading, (stil.mitBalken ? balken : 0) + (schmal ? 4 : 6))
        .padding(.trailing, 3)
        .padding(.top, 4)
        .padding(.bottom, 3)
        .frame(width: max(0, breite), height: max(0, hoehe), alignment: .topLeading)
        .clipped()
        .klassikKarte(stil, radius: radius, balkenBreite: balken)
        .opacity(vergangen ? 0.62 : (stil.gedaempft && !entfall ? 0.8 : 1))
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(kachel.vorlesetext + (weitere > 0 ? ", \(weitere) weitere Stunden zur selben Zeit" : ""))
        .accessibilityAddTraits(.isButton)
    }
}

/// Veranstaltung bzw. Termin im Raster: eigener, warmer Block über die ganze Spalte (bzw. in der Mehrfachansicht über
/// den ganzen Tag) – Titel, Beteiligte, unten die Uhrzeit.
struct Ereigniskarte: View {
    let kachel: Kachel
    let hoehe: CGFloat
    let breite: CGFloat
    var vergangen: Bool = false

    @Environment(\.kartendarstellung) private var darstellung

    private var nebenzeilen: [Kachelzeile] {
        kachel.zeilen.filter { $0.schluessel != "fach" && $0.schluessel != "anlass" && !$0.text.isEmpty }
    }

    var body: some View {
        var stil = Klassikstil.fuer(kachel, darstellung)
        stil.flaeche = Farben.ereignisFlaeche
        stil.ton = nil
        stil.mitBalken = false
        stil.titel = Farben.ereignisText
        if kachel.art == .veranstaltung { stil.rand = Farben.ereignisRand }
        let entfall = kachel.kartenart == .entfall
        return VStack(alignment: .leading, spacing: 1) {
            Text(kachel.anzeigeTitel)
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(stil.titel)
                .strikethrough(entfall, color: Farben.entfall)
                .lineLimit(hoehe > 80 ? 3 : 1)
                .minimumScaleFactor(0.8)
            ForEach(Array(nebenzeilen.prefix(hoehe > 70 ? 2 : 0).enumerated()), id: \.offset) { _, z in
                Text(z.text)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Farben.text2)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            Spacer(minLength: 0)
            if hoehe >= 44 {
                Text(kachel.zeitText)
                    .font(.system(size: 10.5))
                    .monospacedDigit()
                    .foregroundStyle(Farben.text3)
                    .lineLimit(1)
            }
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 5)
        .frame(width: max(0, breite), height: max(0, hoehe), alignment: .topLeading)
        .clipped()
        .klassikKarte(stil, radius: 6)
        .opacity(vergangen ? 0.62 : 1)
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(kachel.vorlesetext)
        .accessibilityAddTraits(.isButton)
    }
}

// MARK: - Blatt „Stunden zur selben Zeit“

/// Blatt hinter „+N“: alle Stunden dieser Zeit als Liste (Balken in der Fachfarbe, Fach, Lehrkraft bzw. Klasse, Raum,
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
        let personen = k.personenzeilen.filter { !$0.text.isEmpty }
        return HStack(alignment: .center, spacing: 12) {
            Kartenbalken(farbe: stil.mitBalken ? stil.balken : Farben.balkenGrau, gestreift: stil.gestreift)
                .frame(width: 4)
                .clipShape(RoundedRectangle(cornerRadius: 2, style: .continuous))
                .padding(.vertical, 2)
            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(k.fachText(darstellung))
                        .font(.body.weight(.semibold))
                        .foregroundStyle(entfall ? Farben.text3 : Farben.text)
                        .strikethrough(entfall, color: Farben.entfall)
                    if !k.fachname.isEmpty {
                        Text(k.fachname)
                            .font(.subheadline)
                            .foregroundStyle(Farben.text3)
                            .lineLimit(1)
                    }
                }
                if !personen.isEmpty {
                    HStack(spacing: 8) {
                        ForEach(Array(personen.enumerated()), id: \.offset) { _, z in
                            Kartenwert(zeile: z, karte: k.karte, entfall: entfall, schrift: .subheadline, farbe: Farben.text2)
                        }
                    }
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
                    Kartenwert(zeile: raum, karte: k.karte, entfall: entfall, schrift: .subheadline.weight(.semibold), farbe: Farben.text)
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
