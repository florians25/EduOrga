import SwiftUI

/// Ansicht des Stundenplans (Menü „Ansicht“): ein Tag, zwei bzw. drei Tage oder die ganze Woche.
enum Planansicht: String, CaseIterable, Identifiable {
    case tag
    case zweiTage
    case dreiTage
    case woche

    var id: String { rawValue }

    var titel: String {
        switch self {
        case .tag: return "Tag"
        case .zweiTage: return "2 Tage"
        case .dreiTage: return "3 Tage"
        case .woche: return "Woche"
        }
    }

    /// SF Symbol der Ansicht.
    var symbol: String {
        switch self {
        case .tag: return "rectangle"
        case .zweiTage: return "rectangle.split.2x1"
        case .dreiTage: return "rectangle.split.3x1"
        case .woche: return "calendar"
        }
    }

    /// Zahl der Tage je Seite (Woche: alle Tage der Woche)
    var tage: Int {
        switch self {
        case .tag: return 1
        case .zweiTage: return 2
        case .dreiTage: return 3
        case .woche: return 7
        }
    }
}

/// Stundenplan als Raster nach Uhrzeit: in der Navigationsleiste links „Heute“, mittig der Planname (öffnet die
/// Planauswahl), rechts das Menü; darunter die Spaltenköpfe der Tage, links die Zeitspalte. Waagrechtes Wischen blättert
/// zur nächsten bzw. vorherigen Woche (bzw. Tagen); die Ansicht folgt dem Finger und gleitet weiter oder zurück.
/// Menü: „Gehe zu Datum“ (Kalender), Ansicht Tag / 2 Tage / 3 Tage / Woche, Abwesenheiten, Favorit, Legende, Hilfe.
struct StundenplanView: View {
    @EnvironmentObject var zustand: AppZustand
    @EnvironmentObject var favoriten: Favoriten
    @Environment(\.horizontalSizeClass) private var groessenklasse
    @State private var datum = Date()
    @State private var auswahl: PlanAuswahl? = nil
    /// Geladene Wochen (Schlüssel: Planart|Element|Montag)
    @State private var plaene: [String: Wochenplan] = [:]
    /// Stand je geladener Woche (zählt bei jedem Neuladen hoch) – das Raster rechnet nur bei neuem Stand neu
    @State private var staende: [String: Int] = [:]
    @State private var laedt = false
    @State private var fehler: String? = nil
    /// Geöffnete Stundendetails (mit allen Stunden derselben Zeit als Reiter)
    @State private var detail: Detailauswahl? = nil
    @State private var gewaehlteAufsicht: Aufsicht? = nil
    @State private var zeigeAuswahl = false
    @State private var zeigeInfo = false
    @State private var zeigeHilfe = false
    @State private var zeigeDatum = false

    // Blättern
    @State private var verschiebung: CGFloat = 0
    @State private var seitenBreite: CGFloat = 0
    @State private var richtung: Wischrichtung? = nil
    /// Waagrechtes Wischen erkannt: senkrechtes Scrollen des Rasters bis zum Ende der Geste gesperrt (Richtungssperre)
    @State private var senkrechtGesperrt = false
    @State private var blaettert = false
    /// Ziel eines Sprungs über mehrere Seiten („Heute“, „Gehe zu Datum“): ersetzt während der Animation die Nachbarseite
    @State private var sprungZiel: Date? = nil
    @GestureState private var zieht = false
    /// Sperrt das Öffnen von Stunden während und kurz nach einer Wisch- bzw. Scrollbewegung (nicht beobachtet)
    @State private var tippsperre = Tippsperre()
    /// Gewählte Ansicht (bleibt gespeichert)
    @AppStorage("planansicht") private var ansicht: Planansicht = .woche
    /// Eigene Abwesenheiten im eigenen Plan als grauer Balken hinter den Stunden (⋮-Menü, bleibt gespeichert)
    @AppStorage("planAbwesenheiten") private var zeigeAbwesenheiten = true
    /// Eigene Abwesenheiten (Schüler*innen bzw. Kind der Eltern) aus „Meine Abwesenheiten“, je Kennung
    @State private var eigeneAbwesenheiten: [String: Abwesenheitszeitraum] = [:]

    private enum Wischrichtung {
        case waagrecht
        case senkrecht
    }

    private let feder = Animation.spring(response: 0.36, dampingFraction: 0.88)

    private var istBreit: Bool { groessenklasse == .regular }

    /// Tagesweise Ansicht (Tag, 2 Tage, 3 Tage) statt der Woche.
    private var tageModus: Bool { ansicht != .woche }

    private var montag: Date { Datumsformat.montag(datum) }

    private var typ: String {
        if let auswahl { return auswahl.typ }
        let t = zustand.benutzer?.typ ?? ""
        return t.isEmpty ? "klasse" : t
    }

    private var element: String {
        auswahl?.element ?? zustand.benutzer?.element ?? ""
    }

    private func schluessel(_ montag: Date) -> String {
        "\(typ)|\(element)|\(Datumsformat.iso(montag))"
    }

    private var ladeSchluessel: String { schluessel(montag) }

    private var aktuellerPlan: Wochenplan? { plaene[schluessel(montag)] }

    /// Erster angezeigter Tag in der tageweisen Ansicht (Wochenende nur, wenn der Plan es enthält).
    private var tag: Date { ersterSchultag(Datumsformat.kalender.startOfDay(for: datum), richtung: 1) }

    /// Mitte der aktuellen Seite: Montag (Wochenansicht) bzw. erster Tag (tageweise Ansicht).
    private var mitte: Date { tageModus ? tag : montag }

    /// Seitenanfang für ein Datum (Montag bzw. Schultag).
    private func seitenanfang(_ d: Date) -> Date {
        tageModus ? ersterSchultag(Datumsformat.kalender.startOfDay(for: d), richtung: 1) : Datumsformat.montag(d)
    }

    /// Seiten: vorherige, aktuelle, nächste Woche bzw. Tage (oder Sprungziel).
    private var seiten: [Date] {
        var links = nachbar(-1)
        var rechts = nachbar(1)
        if let sprungZiel {
            let ziel = seitenanfang(sprungZiel)
            if ziel < mitte { links = ziel } else if ziel > mitte { rechts = ziel }
        }
        return [links, mitte, rechts]
    }

    /// Ist der Tag ein Schultag der Anzeige? Wochenende nur, wenn der geladene Plan den Tag enthält.
    private func istAnzeigetag(_ d: Date) -> Bool {
        let wochentag = Datumsformat.kalender.component(.weekday, from: d) // 1 = Sonntag, 7 = Samstag
        guard wochentag == 1 || wochentag == 7 else { return true }
        let iso = Datumsformat.iso(d)
        return plaene[schluessel(Datumsformat.montag(d))]?.tage.contains(where: { $0.datum == iso }) == true
    }

    /// Der Tag selbst oder der nächste Schultag in der Richtung.
    private func ersterSchultag(_ d: Date, richtung: Int) -> Date {
        var t = d
        for _ in 0..<3 where !istAnzeigetag(t) {
            t = Datumsformat.tage(richtung, nach: t)
        }
        return t
    }

    /// Angezeigte Tage einer Seite ab ihrem ersten Tag (tageweise Ansicht).
    private func tageDerSeite(_ start: Date) -> [Date] {
        var liste: [Date] = []
        var t = ersterSchultag(start, richtung: 1)
        while liste.count < ansicht.tage {
            liste.append(t)
            t = ersterSchultag(Datumsformat.tage(1, nach: t), richtung: 1)
        }
        return liste
    }

    /// Nächste bzw. vorherige Woche oder Tage (Wochenende nur, wenn der Plan es enthält).
    private func nachbar(_ schritt: Int) -> Date {
        guard tageModus else { return Datumsformat.tage(7 * schritt, nach: montag) }
        if schritt > 0 {
            let letzter = tageDerSeite(tag).last ?? tag
            return ersterSchultag(Datumsformat.tage(1, nach: letzter), richtung: 1)
        }
        var t = tag
        for _ in 0..<ansicht.tage {
            t = ersterSchultag(Datumsformat.tage(-1, nach: t), richtung: -1)
        }
        return t
    }

    /// Ansicht wechseln (⋮-Menü bzw. Antippen eines Tages): Woche → Tage beginnt mit heute (in der Woche) bzw. Montag.
    private func ansichtWechseln(_ neu: Planansicht, tag neuerTag: Date? = nil) {
        guard !blaettert else { return }
        withAnimation(.easeInOut(duration: 0.25)) {
            if let neuerTag {
                datum = neuerTag
            } else if ansicht == .woche && neu != .woche {
                let heuteInWoche = Datumsformat.montag(Date()) == montag
                datum = heuteInWoche ? Date() : montag
            }
            ansicht = neu
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                inhalt
                    // Schmaler Ladebalken direkt unter der Navigationsleiste, solange der Plan lädt
                    .overlay(alignment: .top) {
                        Ladebalken(aktiv: laedt)
                    }
            }
            .background(Farben.flaeche.ignoresSafeArea())
            .navigationTitle(titel)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Farben.flaeche, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbar { leiste }
            // Stunden- und Aufsichtsdetails: iPhone als Blatt mit Ziehgriff (halb bzw. ganz hoch), iPad festes Blatt
            .detailPraesentation(item: $detail, breit: istBreit) { d in
                StundendetailView(karten: d.karten, start: d.start, typ: typ, element: element)
                    .environmentObject(zustand)
            }
            .detailPraesentation(item: $gewaehlteAufsicht, breit: istBreit) { a in
                AufsichtDetailView(aufsicht: a)
                    .environmentObject(zustand)
            }
            // Planauswahl, Legende und Hilfe als Formblatt.
            // Ein Planwechsel ändert nur `auswahl` – `datum` bleibt, man bleibt also in der angezeigten Woche (bzw. an den
            // angezeigten Tagen) und springt nicht zur heutigen Woche.
            .blattPraesentation(isPresented: $zeigeAuswahl, breit: istBreit) {
                PlanAuswahlView(auswahl: $auswahl)
                    .environmentObject(zustand)
                    .environmentObject(favoriten)
            }
            .blattPraesentation(isPresented: $zeigeInfo, breit: istBreit) {
                PlanInfoView(titel: titel, plan: aktuellerPlan)
            }
            .blattPraesentation(isPresented: $zeigeHilfe, breit: istBreit) {
                PlanInfoView(titel: "Hilfe", plan: aktuellerPlan, hilfe: true)
            }
            .task(id: ladeSchluessel) { await laden() }
            .onAppear {
                planAnfrageUebernehmen()
                schnellaktionUebernehmen()
                tagAnfrageUebernehmen()
            }
            .onChange(of: zustand.tagAnfrage) { _, _ in tagAnfrageUebernehmen() }
            .onChange(of: zustand.planAnfrage) { _, _ in planAnfrageUebernehmen() }
            // Abwesenheiten eingeschaltet: eigene Abwesenheiten (Familienkonto) nachladen
            .onChange(of: zeigeAbwesenheiten) { _, an in
                if an { Task { await eigeneAbwesenheitenLaden(montag: montag) } }
            }
            .onChange(of: zustand.schnellaktion) { _, _ in schnellaktionUebernehmen() }
            // Reiter „Plan“ erneut angetippt: zurück zur heutigen Woche
            .onChange(of: zustand.stundenplanHeute) { _, _ in zurHeutigenWoche() }
            // Plan geändert (z. B. Raumbuchung in den Stundendetails): neu laden
            .onChange(of: zustand.planGeaendert) { _, _ in Task { await laden(neu: true) } }
            // Notiz in den Stundendetails gespeichert: Info-Zeichen sofort zeigen, dann den Plan neu laden
            .onChange(of: zustand.notizAenderung) { _, neu in
                guard let neu else { return }
                notizUebernehmen(neu)
                Task { await laden() }
            }
        }
    }

    /// Gespeicherte Notiz in alle geladenen Wochen übernehmen (Karten derselben Stunde); der neue Stand zeichnet das
    /// Raster mit Info-Zeichen sofort neu.
    private func notizUebernehmen(_ n: NotizAenderung) {
        for (schluessel, plan) in plaene {
            var neu = plan
            var geaendert = false
            for i in neu.karten.indices {
                let k = neu.karten[i]
                guard k.datum == n.datum, k.unterricht == n.unterricht, k.von <= n.bis, k.bis >= n.von else { continue }
                if let s = n.schueler { neu.karten[i].notizSchueler = s }
                if let l = n.lehrer { neu.karten[i].notizLehrer = l }
                geaendert = true
            }
            if geaendert {
                plaene[schluessel] = neu
                staende[schluessel, default: 0] += 1
            }
        }
    }

    /// Kurzbefehl vom App-Symbol: „Mein Stundenplan“ (aktuelle Woche) bzw. „Plan suchen“ (Planauswahl).
    private func schnellaktionUebernehmen() {
        guard let aktion = zustand.schnellaktion else { return }
        zustand.schnellaktion = nil
        detail = nil
        gewaehlteAufsicht = nil
        switch aktion {
        case .stundenplan:
            auswahl = nil
            ansicht = .woche
            datum = Date()
        case .suche:
            zeigeAuswahl = true
        default:
            break
        }
    }

    /// Angetippte Mitteilung über eine Planänderung: eigener Plan, Tagesansicht des betroffenen Tages.
    private func tagAnfrageUebernehmen() {
        guard let iso = zustand.tagAnfrage else { return }
        zustand.tagAnfrage = nil
        guard let ziel = Datumsformat.datum(iso) else { return }
        detail = nil
        gewaehlteAufsicht = nil
        zeigeAuswahl = false
        auswahl = nil
        ansicht = .tag
        datum = ziel
    }

    /// „Im Stundenplan anzeigen“ aus den Stundendetails.
    private func planAnfrageUebernehmen() {
        guard let neu = zustand.planAnfrage else { return }
        zustand.planAnfrage = nil
        detail = nil
        gewaehlteAufsicht = nil
        if neu.typ == "lehrer" && !zustand.darfLehrerplaene { return }
        auswahl = neu
    }

    private var titel: String {
        if let auswahl { return auswahl.anzeige }
        if !element.isEmpty { return element }
        if let name = aktuellerPlan?.name, !name.isEmpty { return name }
        return "Mein Stundenplan"
    }

    // MARK: - Leiste: „Heute“ links, Planname in der Mitte, Menü rechts

    @ToolbarContentBuilder
    private var leiste: some ToolbarContent {
        ToolbarItem(placement: .topBarLeading) {
            Button("Heute") {
                springen(zu: Date())
            }
            .accessibilityHint("Springt zum heutigen Tag")
        }
        ToolbarItem(placement: .principal) {
            plantitel
        }
        ToolbarItem(placement: .topBarTrailing) {
            menue
        }
    }

    /// Planname mit Pfeil: ein Tipp öffnet direkt die Planauswahl (Mein Stundenplan, Favoriten, Suche, Listen).
    private var plantitel: some View {
        Button {
            zeigeAuswahl = true
        } label: {
            // Nur so breit wie der Name (höchstens 190 bzw. 360 pt): so bleibt die Planauswahl immer oben mittig
            Hoechstbreite(breite: istBreit ? 360 : 190).callAsFunction {
                HStack(spacing: 4) {
                    Text(titel)
                        .font(.headline)
                        .foregroundStyle(Farben.text)
                        .lineLimit(1)
                        .truncationMode(.tail)
                    Image(systemName: "chevron.down")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Farben.text3)
                }
            }
            .padding(.vertical, 4)
            .padding(.horizontal, 6)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Stundenplan auswählen, aktuell \(titel)")
    }

    /// Menü: „Gehe zu Datum“, Abschnitt „Ansicht“ (Tag, 2 Tage, 3 Tage, Woche mit Häkchen), Abwesenheiten, Favorit,
    /// Aktualisieren, Legende und Hilfe.
    private var menue: some View {
        Menu {
            Button {
                zeigeDatum = true
            } label: {
                Label("Gehe zu Datum", systemImage: Symbole.datum)
            }
            Section("Ansicht") {
                Picker("Ansicht", selection: Binding(get: { ansicht }, set: { ansichtWechseln($0) })) {
                    ForEach(Planansicht.allCases) { a in
                        Label(a.titel, systemImage: a.symbol)
                            .tag(a)
                    }
                }
                .pickerStyle(.inline)
                .labelsHidden()
            }
            if auswahl == nil {
                Section {
                    // Eigene Abwesenheit als Fläche hinter den Stunden ein- bzw. ausblenden
                    Toggle(isOn: $zeigeAbwesenheiten) {
                        Label("Abwesenheiten anzeigen", systemImage: "person.badge.clock")
                    }
                }
            }
            Section {
                if let auswahl {
                    Button {
                        favoriten.umschalten(auswahl)
                    } label: {
                        Label(favoriten.enthaelt(auswahl) ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen",
                              systemImage: favoriten.enthaelt(auswahl) ? "star.slash" : "star")
                    }
                }
                Button {
                    Task { await laden(neu: true) }
                } label: {
                    Label("Aktualisieren", systemImage: "arrow.clockwise")
                }
                Button {
                    zeigeInfo = true
                } label: {
                    Label("Legende und Planangaben", systemImage: "info.circle")
                }
                Button {
                    zeigeHilfe = true
                } label: {
                    Label("Hilfe", systemImage: "questionmark.circle")
                }
            }
        } label: {
            Image(systemName: "ellipsis.circle")
                .font(.system(size: 17, weight: .regular))
                .foregroundStyle(Farben.akzent)
        }
        .accessibilityLabel("Menü")
        .popover(isPresented: $zeigeDatum, arrowEdge: .top) {
            GeheZuDatumView(start: tageModus ? tag : datum) { gewaehlt in
                zeigeDatum = false
                springen(zu: gewaehlt)
            }
            .presentationCompactAdaptation(.popover)
        }
    }

    // MARK: - Inhalt

    @ViewBuilder
    private var inhalt: some View {
        if let fehler, aktuellerPlan == nil {
            VStack {
                Fehlerhinweis(text: fehler)
                Button("Erneut versuchen") { Task { await laden() } }
                    .padding(.top, 8)
                Spacer()
            }
            .padding(16)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Farben.grund)
        } else if element.isEmpty && auswahl == nil {
            ContentUnavailableView {
                Label("Kein eigener Plan", systemImage: "calendar.badge.exclamationmark")
            } description: {
                Text("Ihrem Konto ist kein Plan zugeordnet. Wählen Sie oben eine Klasse oder einen Raum.")
            } actions: {
                Button("Stundenplan auswählen") { zeigeAuswahl = true }
                    .buttonStyle(.borderedProminent)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Farben.grund)
        } else {
            // Das Raster läuft bis zum unteren Rand hinter der Tab-Leiste weiter; damit auch die letzte Stunde über die
            // Leiste gescrollt werden kann, bekommt das Raster unten den verdeckten Bereich als Abstand.
            GeometryReader { aussen in
                blaetterflaeche(untenFrei: aussen.safeAreaInsets.bottom)
                    .ignoresSafeArea(.container, edges: .bottom)
            }
        }
    }

    /// Drei Wochen nebeneinander; sichtbar ist die mittlere. Die Ansicht folgt dem Finger.
    private func blaetterflaeche(untenFrei: CGFloat) -> some View {
        GeometryReader { geo in
            let w = geo.size.width
            HStack(spacing: 0) {
                ForEach(seiten, id: \.self) { m in
                    seite(m, untenFrei: untenFrei)
                        .frame(width: w)
                }
            }
            .frame(width: w * 3, height: geo.size.height, alignment: .leading)
            .offset(x: -w + verschiebung)
            .onAppear { seitenBreite = w }
            .onChange(of: w) { _, neu in seitenBreite = neu }
        }
        .clipped()
        .contentShape(Rectangle())
        .simultaneousGesture(wischen)
        .onChange(of: zieht) { _, neu in
            // Geste abgebrochen (z. B. vom senkrechten Scrollen übernommen): zurückfedern
            guard !neu else { return }
            richtung = nil
            senkrechtGesperrt = false
            if tippsperre.wischt { tippsperre.bewegungEnde(nachlauf: 0.15) }
            if !blaettert && verschiebung != 0 {
                withAnimation(feder) { verschiebung = 0 }
            }
        }
    }

    @ViewBuilder
    private func seite(_ m: Date, untenFrei: CGFloat) -> some View {
        if tageModus {
            let tage = tageDerSeite(m)
            let wochen = ohneDoppelte(tage.map { Datumsformat.montag($0) })
            let geladen = wochen.compactMap { plaene[schluessel($0)] }
            if geladen.count == wochen.count, let p = zusammengefuehrt(geladen) {
                raster(p, nurTage: tage.map { Datumsformat.iso($0) },
                       stand: wochen.reduce(0) { $0 + (staende[schluessel($1)] ?? 0) }, untenFrei: untenFrei)
            } else {
                Platzhalterwoche(montag: Datumsformat.montag(m))
            }
        } else if let p = plaene[schluessel(m)] {
            raster(p, nurTage: nil, stand: staende[schluessel(m)] ?? 0, untenFrei: untenFrei)
        } else {
            Platzhalterwoche(montag: m)
        }
    }

    /// Wochen zu einem Plan zusammenführen (Ansicht über das Wochenende hinweg, z. B. Fr. und Mo.).
    private func zusammengefuehrt(_ wochen: [Wochenplan]) -> Wochenplan? {
        guard var p = wochen.first else { return nil }
        for w in wochen.dropFirst() {
            p.tage += w.tage
            p.karten += w.karten
            p.aufsichten += w.aufsichten
            if p.abwesenheiten != nil || w.abwesenheiten != nil {
                p.abwesenheiten = (p.abwesenheiten ?? []) + (w.abwesenheiten ?? [])
            }
            if p.zeitraster.isEmpty { p.zeitraster = w.zeitraster }
        }
        // Gesperrt nur, wenn keine der Wochen einsehbar ist (sonst zeigt die freigegebene Woche ihre Stunden)
        p.gesperrt = wochen.allSatisfy(\.gesperrt)
        p.sperrhinweis = wochen.first(where: \.gesperrt)?.sperrhinweis
        return p
    }

    private func ohneDoppelte(_ liste: [Date]) -> [Date] {
        var ergebnis: [Date] = []
        for d in liste where !ergebnis.contains(d) { ergebnis.append(d) }
        return ergebnis
    }

    /// Abwesenheitsbalken je Tag – nur im eigenen Plan und nur, wenn im ⋮-Menü eingeschaltet.
    private func abwesenheitsbalken(_ p: Wochenplan) -> [String: [Abwesenheitsbalken]] {
        guard auswahl == nil, zeigeAbwesenheiten else { return [:] }
        let zeiten = Rasterzeit.aus(p)
        let zeitraeume = Array(eigeneAbwesenheiten.values)
        var ergebnis: [String: [Abwesenheitsbalken]] = [:]
        for tag in p.tage {
            let balken = Kachelbau.abwesenheitsbalken(tag, raster: zeiten, zeitraeume: zeitraeume, eigene: p.abwesenheiten)
            if !balken.isEmpty { ergebnis[tag.datum] = balken }
        }
        return ergebnis
    }

    private func raster(_ p: Wochenplan, nurTage: [String]?, stand: Int, untenFrei: CGFloat) -> some View {
        WochenrasterView(plan: p, typ: p.typ.isEmpty ? typ : p.typ, element: element,
                         tippsperre: tippsperre,
                         senkrechtGesperrt: senkrechtGesperrt,
                         nurTage: nurTage,
                         stand: stand,
                         abwesenheiten: abwesenheitsbalken(p),
                         untenFrei: untenFrei,
                         heuteAntippen: {
                             if tageModus { ansichtWechseln(.woche) } else { heute() }
                         },
                         tagAntippen: { iso in
                             if ansicht == .tag {
                                 ansichtWechseln(.woche)
                             } else if let d = Datumsformat.datum(iso) {
                                 ansichtWechseln(.tag, tag: d)
                             }
                         },
                         aufsichtAntippen: { gewaehlteAufsicht = $0 },
                         antippen: { karten, start in
                             guard !karten.isEmpty else { return }
                             detail = Detailauswahl(karten: karten, start: min(max(start, 0), karten.count - 1))
                         })
        // Beim Wischen ändert sich nur die Verschiebung: das Raster wird dann nicht neu berechnet
        .equatable()
    }

    /// Wischen mit Richtungssperre: Die Richtung wird zu Beginn der Geste festgelegt und gilt bis zum Loslassen.
    /// Waagrecht → Wochen- bzw. Tageswechsel, das senkrechte Scrollen des Rasters ist so lange gesperrt (kein gleichzeitiges
    /// Rauf/Runter); senkrecht → nur Scrollen, kein Blättern.
    private var wischen: some Gesture {
        DragGesture(minimumDistance: 8)
            .updating($zieht) { _, status, _ in status = true }
            .onChanged { wert in
                guard !blaettert else { return }
                if richtung == nil {
                    let dx = abs(wert.translation.width)
                    let dy = abs(wert.translation.height)
                    guard dx > 6 || dy > 6 else { return }
                    richtung = dx > dy * 1.2 ? .waagrecht : .senkrecht
                    if richtung == .waagrecht { senkrechtGesperrt = true }
                    // Ab jetzt ist es eine Wisch- bzw. Scrollbewegung: kein Antippen einer Stunde auslösen
                    tippsperre.wischt = true
                }
                if richtung == .waagrecht {
                    verschiebung = wert.translation.width
                }
            }
            .onEnded { wert in
                let war = richtung
                richtung = nil
                senkrechtGesperrt = false
                // Kurzes Nachlaufen (Senkrecht: Schwung des Scrollens, solange keine Scrollphase gemeldet wird)
                tippsperre.bewegungEnde(nachlauf: war == .senkrecht ? 0.35 : 0.15)
                guard war == .waagrecht, !blaettert else { return }
                let w = max(seitenBreite, 1)
                let dx = wert.translation.width
                let voraus = wert.predictedEndTranslation.width
                if dx < -w * 0.25 || voraus < -w * 0.55 {
                    blaettern(1)
                } else if dx > w * 0.25 || voraus > w * 0.55 {
                    blaettern(-1)
                } else {
                    withAnimation(feder) { verschiebung = 0 }
                }
            }
    }

    /// Eine Woche vor (1) bzw. zurück (-1) oder zu einem Ziel; gleitet mit Feder-Animation zur neuen Seite.
    private func blaettern(_ schritt: Int, ziel: Date? = nil) {
        guard !blaettert, schritt != 0 else { return }
        let neuesDatum = ziel ?? nachbar(schritt)
        let w = seitenBreite
        guard w > 0 else {
            datum = neuesDatum
            return
        }
        blaettert = true
        sprungZiel = ziel
        withAnimation(feder) {
            verschiebung = schritt > 0 ? -w : w
        } completion: {
            var t = Transaction()
            t.disablesAnimations = true
            withTransaction(t) {
                datum = neuesDatum
                sprungZiel = nil
                verschiebung = 0
            }
            blaettert = false
        }
    }

    private func heute() {
        springen(zu: Date())
    }

    /// Zu einem Datum springen (Heute, „Gehe zu Datum“): gleitet zur Seite mit diesem Tag.
    private func springen(zu ziel: Date) {
        let anfang = seitenanfang(ziel)
        guard Datumsformat.iso(anfang) != Datumsformat.iso(mitte) else { return }
        blaettern(anfang > mitte ? 1 : -1, ziel: tageModus ? anfang : ziel)
    }

    /// Erneutes Antippen des Reiters „Stundenplan“: Details schließen, Wochenansicht der aktuellen Woche.
    private func zurHeutigenWoche() {
        detail = nil
        gewaehlteAufsicht = nil
        if tageModus {
            withAnimation(.easeInOut(duration: 0.25)) {
                ansicht = .woche
                datum = Date()
            }
        } else {
            heute()
        }
    }

    private func laden(neu: Bool = false) async {
        let t = typ
        let e = element
        guard !e.isEmpty else { return }
        let m = montag
        func k(_ d: Date) -> String { "\(t)|\(e)|\(Datumsformat.iso(d))" }
        laedt = true
        do {
            let neuerPlan = try await zustand.api.plan(typ: t, element: e, datum: m)
            plaene[k(m)] = neuerPlan
            staende[k(m), default: 0] += 1
            fehler = nil
        } catch {
            if let text = zustand.fehlertext(error) { fehler = text }
        }
        laedt = false
        await eigeneAbwesenheitenLaden(montag: m)
        // Nachbarwochen vorab und gleichzeitig laden, damit beim Wischen (und in der Ansicht über zwei Wochen) sofort
        // etwas zu sehen ist
        if Task.isCancelled { return }
        let api = zustand.api
        let naechste = Datumsformat.tage(7, nach: m)
        let vorige = Datumsformat.tage(-7, nach: m)
        let holeNaechste = neu || plaene[k(naechste)] == nil
        let holeVorige = neu || plaene[k(vorige)] == nil
        @Sendable func hole(_ datum: Date, _ noetig: Bool) async -> Wochenplan? {
            guard noetig else { return nil }
            return try? await api.plan(typ: t, element: e, datum: datum)
        }
        async let planNaechste = hole(naechste, holeNaechste)
        async let planVorige = hole(vorige, holeVorige)
        let (pn, pv) = await (planNaechste, planVorige)
        if Task.isCancelled { return }
        for (datum, plan) in [(naechste, pn), (vorige, pv)] {
            guard let plan else { continue }
            plaene[k(datum)] = plan
            staende[k(datum), default: 0] += 1
        }
    }
}

extension StundenplanView {
    /// Eigene Abwesenheiten der Schülerin bzw. des Schülers (Eltern: des Kindes) für die Woche samt Nachbarwochen laden –
    /// nur im eigenen Plan eines Familienkontos und nur bei eingeschalteter Anzeige. Fehler bleiben still (ohne Balken).
    fileprivate func eigeneAbwesenheitenLaden(montag m: Date) async {
        guard auswahl == nil, zeigeAbwesenheiten, zustand.benutzer?.familie == true else { return }
        // Neuere Server liefern die eigenen Abwesenheiten mit dem Plan – dann nichts nachladen
        guard plaene[schluessel(m)]?.abwesenheiten == nil else { return }
        let von = Datumsformat.iso(Datumsformat.tage(-7, nach: m))
        let bis = Datumsformat.iso(Datumsformat.tage(13, nach: m))
        guard let daten = try? await zustand.api.familieAbwesenheiten(schueler: nil, von: von, bis: bis, status: nil) else { return }
        for z in daten.zeilen { eigeneAbwesenheiten[z.id] = z }
    }
}

/// Gesperrte Woche (außerhalb des freigegebenen Zeitraums der Rolle): leerer Zustand mit Schloss, Titel und dem Hinweis
/// des Servers (`sperrhinweis`); fehlt er, steht dort der Standardsatz.
struct Sperrhinweis: View {
    let hinweis: String?

    static let titel = "Plan nicht freigegeben"
    static let standardHinweis = "Für diesen Zeitraum hat die Schule den Plan noch nicht freigegeben."

    private var erklaerung: String {
        let text = (hinweis ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return text.isEmpty ? Self.standardHinweis : text
    }

    var body: some View {
        Hinweisfeld(titel: Self.titel, text: erklaerung, symbol: "lock")
            .frame(maxWidth: 320)
            .padding(.horizontal, 24)
    }
}

/// Seite einer noch nicht geladenen Woche: Spaltenkopf mit Kalenderwoche, darunter ein Ladekreis.
struct Platzhalterwoche: View {
    let montag: Date

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                Text("KW \(Datumsformat.kalenderwoche(montag))")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Farben.text3)
                    .padding(.leading, 8)
                Spacer()
            }
            .lineLimit(1)
            .frame(height: Wochenkopf.hoehe)
            .background(Farben.flaeche)
            .overlay(alignment: .bottom) {
                Rectangle().fill(Farben.rand).frame(height: 1)
            }
            ZStack {
                Farben.flaeche
                ProgressView()
            }
        }
    }
}

/// Hilfen für den Kopf der Tagesspalten.
enum Wochenkopf {
    /// Höhe des Spaltenkopfs
    static let hoehe: CGFloat = 40

    /// Kurzer Monatsname ohne Punkt, z. B. „Okt“.
    static func monat(_ datum: Date) -> String {
        var s = Datumsformat.anzeige(datum, "LLL")
        if s.hasSuffix(".") { s.removeLast() }
        return s
    }
}

/// Legende und Angaben zum Plan bzw. Hilfe (Menü): Bedienung (nur Hilfe), Legende mit echten Beispielkacheln und
/// Angaben zur Woche.
struct PlanInfoView: View {
    let titel: String
    let plan: Wochenplan?
    var hilfe: Bool = false
    @Environment(\.dismiss) private var systemSchliessen
    @Environment(\.blattSchliessen) private var blattSchliessen

    private func schliessen() {
        if let blattSchliessen { blattSchliessen() } else { systemSchliessen() }
    }

    var body: some View {
        NavigationStack {
            List {
                if hilfe {
                    Section("Bedienung") {
                        hilfezeile("hand.draw", "Waagrecht wischen: nächste bzw. vorherige Woche (in der Tagesansicht die nächsten Tage).")
                        hilfezeile("hand.tap", "Stunde antippen: Details mit Lehrstoff, Schüler*innen, Hausaufgaben und Notizen.")
                        hilfezeile("calendar.day.timeline.left", "Tag im Spaltenkopf antippen: Tagesansicht; erneut antippen: zurück zur Woche.")
                        hilfezeile("arrow.uturn.backward", "„Heute“ bzw. den Reiter „Plan“ erneut antippen: zurück zum heutigen Tag.")
                        hilfezeile("rectangle.split.3x1", "Menü → Ansicht: Tag, 2 Tage, 3 Tage oder Woche.")
                        hilfezeile("calendar", "Menü → Gehe zu Datum: Tag im Kalender wählen und „Auswählen“ tippen.")
                        hilfezeile("chevron.down", "Planname oben antippen: anderen Stundenplan (Klasse, Lehrkraft, Raum) wählen.")
                    }
                    Section("Schüler*innen (Lehrkräfte)") {
                        hilfezeile("checkmark.circle", "Von links nach rechts wischen: anwesend.")
                        hilfezeile("clock", "Von rechts nach links wischen: abwesend; ein Hinweis zeigt Fehlzeiten in der Vorstunde.")
                        hilfezeile("book.closed", "Buch: neuer Klassenbucheintrag; Uhr: Abwesenheiten der Person bearbeiten.")
                    }
                }
                if let plan {
                    Section("Plan") {
                        LabeledContent("Plan", value: plan.name.isEmpty ? titel : plan.name)
                        LabeledContent("Kalenderwoche", value: "\(Datumsformat.kalenderwoche(Datumsformat.datum(plan.montag) ?? Date()))")
                        if !plan.woche.isEmpty {
                            LabeledContent("Woche", value: plan.woche.count == 1 ? "\(plan.woche)-Woche" : plan.woche)
                        }
                    }
                }
                Section("Legende") {
                    legende(.normal, "Unterricht wie geplant (Fläche in der Fachfarbe)")
                    legende(.aenderung, "Vertretung, Änderung bzw. Raumänderung – geänderter Wert unterstrichen")
                    legende(.entfall, "Entfall – schraffiert und durchgestrichen")
                    legende(.klausur, "Klausur bzw. Prüfung")
                    legende(.veranstaltung, "Veranstaltung, Termin bzw. Raumbuchung")
                    legende(.abgegeben, "Stunde läuft ohne die Lehrkraft (abgegeben bzw. abwesend)")
                    legende(.bereitschaft, "Bereitschaft")
                    legende(.aufsicht, "Pausenaufsicht")
                    HStack(spacing: 12) {
                        RoundedRectangle(cornerRadius: 4, style: .continuous)
                            .fill(Farben.freiFlaeche)
                            .frame(width: 64, height: 34)
                        Text("Ferien, Feiertag oder unterrichtsfrei")
                    }
                    HStack(spacing: 12) {
                        HStack(spacing: 6) {
                            Image(systemName: Symbole.info)
                            Image(systemName: Symbole.hausaufgaben)
                            Image(systemName: Symbole.online)
                        }
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Farben.text3)
                        .frame(width: 64)
                        Text("Information bzw. Notiz, Hausaufgabe fällig, online")
                    }
                    HStack(spacing: 12) {
                        ZStack(alignment: .leading) {
                            Rectangle()
                                .fill(Farben.akzent)
                                .frame(width: 64, height: 1)
                            Circle()
                                .fill(Farben.akzent)
                                .frame(width: 7, height: 7)
                        }
                        .frame(width: 64)
                        Text("Aktuelle Uhrzeit")
                    }
                }
                .font(.subheadline)
            }
            .listStyle(.insetGrouped)
            .navigationTitle(titel)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fertig") { schliessen() }
                }
            }
        }
    }

    private func hilfezeile(_ symbol: String, _ text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 15, weight: .regular))
                .foregroundStyle(Farben.akzent)
                .frame(width: 26)
            Text(text)
                .font(.subheadline)
        }
    }

    /// Beispielkachel einer Art mit Erklärung.
    private func legende(_ art: Kachelart, _ text: String) -> some View {
        HStack(spacing: 12) {
            KachelView(kachel: Self.beispiel(art), breite: 64, hoehe: 34)
                .frame(width: 64, height: art == .aufsicht ? 18 : 34)
                .frame(height: 34)
                .accessibilityHidden(true)
            Text(text)
        }
    }

    /// Beispielkachel für die Legende.
    static func beispiel(_ art: Kachelart) -> Kachel {
        var k = Kachel(art: art, datum: "", von: 1, bis: 1, beginn: 480, ende: 525)
        k.balkenHex = art == .normal || art == .aenderung || art == .entfall ? "#3364B0" : ""
        switch art {
        case .aenderung:
            k.zeilen = [Kachelzeile(schluessel: "fach", teile: [Kachelteil(text: "MA")], fett: true),
                        Kachelzeile(schluessel: "lehrer", teile: [Kachelteil(text: "KLE", stil: .plakette)])]
        case .veranstaltung:
            k.zeilen = [Kachelzeile(schluessel: "anlass", teile: [Kachelteil(text: "Ausflug")], fett: true)]
        case .bereitschaft:
            k.titel = "BER"
            k.zeilen = [Kachelzeile(schluessel: "fach", teile: [Kachelteil(text: "BER")])]
        case .aufsicht:
            k.titel = "Hof"
            k.zeilen = [Kachelzeile(schluessel: "fach", teile: [Kachelteil(text: "Hof")], fett: true)]
        default:
            k.zeilen = [Kachelzeile(schluessel: "fach", teile: [Kachelteil(text: art == .klausur ? "DE" : "MA")], fett: true),
                        Kachelzeile(schluessel: "lehrer", teile: [Kachelteil(text: "SCH")])]
        }
        return k
    }
}

// MARK: - Wochenraster

/// Auswahl für die Stundendetails: alle Stunden derselben Zeit (Reiter), geöffnet bei `start`.
struct Detailauswahl: Identifiable {
    let id = UUID()
    let karten: [Karte]
    let start: Int
}

/// Höhen im Raster: Abstand oben, Beginn des Rasters, Punkte je Minute.
/// Pausen mit Aufsicht werden bei Bedarf gedehnt, damit die Aufsicht vollständig in die Lücke passt.
struct Rastermass {
    /// Zusätzliche Höhe in einer Pause (beginn…ende in Minuten; bei beginn == ende ein Sprung an dieser Stelle).
    struct Dehnung {
        let beginn: Int
        let ende: Int
        let extra: CGFloat
    }

    let oben: CGFloat
    let start: Int
    let proMinute: CGFloat
    var dehnungen: [Dehnung] = []

    /// Oberkante bei dieser Minute (was hier beginnt).
    func y(_ minute: Int) -> CGFloat {
        position(minute, ende: false)
    }

    /// Unterkante bei dieser Minute (was hier endet) – unterscheidet sich nur an Sprüngen ohne Pausenlänge.
    func yEnde(_ minute: Int) -> CGFloat {
        position(minute, ende: true)
    }

    private func position(_ minute: Int, ende: Bool) -> CGFloat {
        var wert = oben + CGFloat(minute - start) * proMinute
        for d in dehnungen {
            if d.ende > d.beginn {
                if minute >= d.ende {
                    wert += d.extra
                } else if minute > d.beginn {
                    wert += d.extra * CGFloat(minute - d.beginn) / CGFloat(d.ende - d.beginn)
                }
            } else if minute > d.beginn || (minute == d.beginn && !ende) {
                wert += d.extra
            }
        }
        return wert
    }

    /// Dehnungen für die Pausen der Aufsichten: jede Lücke mindestens `mindestens` Punkte hoch.
    static func dehnungen(_ aufsichten: [Kachel], proMinute: CGFloat, mindestens: CGFloat) -> [Dehnung] {
        var extra: [Int: (ende: Int, extra: CGFloat)] = [:]
        for a in aufsichten {
            let luecke = CGFloat(max(0, a.ende - a.beginn)) * proMinute
            let noetig = mindestens - luecke
            guard noetig > 0.5 else { continue }
            if let alt = extra[a.beginn], alt.extra >= noetig { continue }
            extra[a.beginn] = (max(a.beginn, a.ende), noetig)
        }
        return extra.keys.sorted().map { Dehnung(beginn: $0, ende: extra[$0]?.ende ?? $0, extra: extra[$0]?.extra ?? 0) }
    }
}

/// Raster mit Tagesspalten; Höhe nach Uhrzeit (1,3 pt je Minute), Pausen als schmale graue Bänder.
/// Kacheln, Spuren und Zählstreifen kommen aus `Kachelbau` (dieselbe Logik wie UntPlan Web).
struct WochenrasterView: View {
    let plan: Wochenplan
    let typ: String
    var element: String = ""
    /// Sperre für das Antippen während bzw. kurz nach Wischen und Scrollen
    var tippsperre: Tippsperre = Tippsperre()
    /// Während eines waagrechten Wischens: senkrechtes Scrollen aus (Richtungssperre)
    var senkrechtGesperrt: Bool = false
    var laedt: Bool = false
    /// Tageweise Ansicht: nur diese Tage (yyyy-MM-dd), Spalten über die volle Breite (nil = ganze Woche).
    var nurTage: [String]? = nil
    /// Stand der geladenen Woche (für den Vergleich, ob neu gezeichnet werden muss)
    var stand: Int = 0
    /// Eigene Abwesenheiten je Tag (yyyy-MM-dd): Fläche hinter den Stunden (nur „Mein Plan“, abschaltbar)
    var abwesenheiten: [String: [Abwesenheitsbalken]] = [:]
    /// Vom unteren Rand verdeckter Bereich (Tab-Leiste, Home-Balken): das Raster läuft darunter weiter
    var untenFrei: CGFloat = 0
    /// Antippen der Kalenderwoche (Woche: zur aktuellen Woche, Tag: zurück zur Woche).
    var heuteAntippen: (() -> Void)? = nil
    /// Antippen eines Tageskopfs (Tagesansicht öffnen bzw. schließen).
    var tagAntippen: ((String) -> Void)? = nil
    /// Antippen einer Pausenaufsicht.
    var aufsichtAntippen: ((Aufsicht) -> Void)? = nil
    /// Antippen einer Stunde: alle Stunden derselben Zeit und die angetippte.
    let antippen: ([Karte], Int) -> Void

    @Environment(\.horizontalSizeClass) private var groessenklasse

    /// iPhone (schmale Breite): schmale Zeitspalte und kleinere Schrift, damit fünf Tage lesbar nebeneinander passen.
    private var kompakt: Bool { groessenklasse == .compact }

    /// Breite der Zeitspalte (Stundennummer, Beginn und Ende)
    private var rinnenBreite: CGFloat { kompakt ? 40 : 52 }
    private var tagesLuecke: CGFloat { kompakt ? 3 : 4 }
    /// Höhe je Minute – Woche und Tag gleich.
    private let proMinute: CGFloat = 1.3
    private let abstandUnten: CGFloat = 28

    private var tage: [Tageskopf] {
        guard let nurTage else { return plan.tage }
        return nurTage.compactMap { iso in plan.tage.first { $0.datum == iso } }
    }

    /// Aufsichten dicht am Plan: Tagesansicht und iPhone (alle Ansichten).
    private var dichteAufsicht: Bool { nurTage?.count == 1 || kompakt }

    private var montagDatum: Date {
        Datumsformat.datum(plan.montag) ?? Datumsformat.datum(tage.first?.datum ?? "") ?? Date()
    }

    var body: some View {
        let zeiten = Rasterzeit.aus(plan)
        let start = zeiten.first?.beginn ?? 480
        let ende = zeiten.last?.ende ?? 960
        let jetzt = Date()
        // Kacheln je Tag aus dem Zwischenspeicher: gleiche Daten (Stand) liefern dieselben Kacheln mit denselben
        // Kennungen – SwiftUI behält die Kachelansichten, statt sie bei jedem Zeichnen neu aufzubauen
        let minute = Int(jetzt.timeIntervalSinceReferenceDate / 60)
        let basis = "\(typ)|\(element)|\(plan.montag)|\(stand)|\(nurTage?.joined(separator: ",") ?? "w")|\(minute)"
        let kacheln: [String: [Kachel]] = Dictionary(
            tage.map { tag in
                (tag.datum, Kachelspeicher.kacheln(basis + "|" + tag.datum) {
                    Kachelbau.tag(tag, plan: plan, raster: zeiten, typ: typ, element: element, jetzt: jetzt)
                })
            },
            uniquingKeysWith: { erste, _ in erste })
        let vorErster = kacheln.values.contains { liste in liste.contains { $0.vorErsterStunde } }
        let pausenAufsichten = kacheln.values.flatMap { $0 }.filter { $0.art == .aufsicht && $0.inPause && !$0.vorErsterStunde }
        // Tagesansicht und iPhone: Aufsicht vor der 1. Stunde sitzt dichter am Plan
        let mass = Rastermass(oben: vorErster ? (dichteAufsicht ? 30 : 33) : 10, start: start, proMinute: proMinute,
                              dehnungen: Rastermass.dehnungen(pausenAufsichten, proMinute: proMinute,
                                                              mindestens: nurTage == nil ? 22 : 28))
        GeometryReader { geo in
            let spalten = max(tage.count, 1)
            let spaltenBreite = max(kompakt ? 34 : 40, (geo.size.width - rinnenBreite) / CGFloat(spalten))
            let hoehe = mass.y(ende) + abstandUnten + untenFrei
            VStack(spacing: 0) {
                // Kopf (Kalenderwoche und Tage) steht fest über dem scrollenden Raster und wird nie gestaucht
                wochenkopf(spaltenBreite: spaltenBreite)
                    .fixedSize(horizontal: false, vertical: true)
                    .layoutPriority(1)
                    .zIndex(1)
                if plan.gesperrt {
                    // Woche außerhalb des freigegebenen Zeitraums: statt der Kacheln der Sperrhinweis (Blättern bleibt möglich)
                    Sperrhinweis(hinweis: plan.sperrhinweis)
                        .padding(.bottom, untenFrei)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Farben.flaeche.ignoresSafeArea(edges: .bottom))
                } else {
                    ScrollViewReader { leser in
                        ScrollView(.vertical) {
                            ZStack(alignment: .topLeading) {
                                // Anker knapp über der 1. Stunde (bzw. über den Kacheln vor der 1. Stunde)
                                VStack(spacing: 0) {
                                    Color.clear.frame(height: vorErster ? 0 : max(0, mass.y(start) - 8))
                                    Color.clear.frame(width: 1, height: 1).id(Self.ersteStundeAnker)
                                    Spacer(minLength: 0)
                                }
                                .accessibilityHidden(true)
                                heuteSpalte(spaltenBreite: spaltenBreite, hoehe: hoehe)
                                zeitspalte(zeiten, mass: mass, breite: geo.size.width)
                                ForEach(Array(tage.enumerated()), id: \.element.id) { eintrag in
                                    tagesspalte(eintrag.element, kacheln: kacheln[eintrag.element.datum] ?? [], zeiten: zeiten,
                                                mass: mass, ende: ende, breite: spaltenBreite - tagesLuecke, hoehe: hoehe)
                                        .offset(x: rinnenBreite + CGFloat(eintrag.offset) * spaltenBreite + tagesLuecke / 2)
                                }
                                jetztLinie(mass: mass, start: start, ende: ende, breite: geo.size.width)
                            }
                            .frame(width: geo.size.width, height: hoehe, alignment: .topLeading)
                            .opacity(laedt ? 0.55 : 1)
                            .animation(.linear(duration: 0.12), value: laedt)
                        }
                        .scrollIndicators(.hidden)
                        // Richtungssperre: beim waagrechten Wischen scrollt das Raster nicht mit
                        .scrollDisabled(senkrechtGesperrt)
                        .modifier(Scrollsperre(sperre: tippsperre))
                        .background(Farben.flaeche.ignoresSafeArea(edges: .bottom))
                        .onAppear {
                            // Beim Öffnen so scrollen, dass die 1. Stunde vollständig sichtbar ist
                            DispatchQueue.main.async {
                                leser.scrollTo(Self.ersteStundeAnker, anchor: .top)
                            }
                        }
                    }
                }
            }
        }
    }

    private static let ersteStundeAnker = "ersteStunde"

    // MARK: Kopf mit Kalenderwoche und Tagen

    /// Spaltenköpfe „Mo 19.10.“ (Wochentag halbfett, Datum normal); heute in Marine mit 2-pt-Linie unter dem Kopf.
    /// Links über der Zeitspalte die Kalenderwoche.
    private func wochenkopf(spaltenBreite: CGFloat) -> some View {
        HStack(alignment: .center, spacing: 0) {
            kwFeld
            ForEach(tage) { tag in
                tageskopf(tag, spaltenBreite: spaltenBreite)
            }
        }
        .frame(height: Wochenkopf.hoehe)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Farben.flaeche)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Farben.rand)
                .frame(height: 1)
        }
    }

    private var kwFeld: some View {
        Text("KW \(Datumsformat.kalenderwoche(montagDatum))")
            .font(.system(size: kompakt ? 10 : 11, weight: .semibold))
            .monospacedDigit()
            .foregroundStyle(Farben.text3)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .frame(width: rinnenBreite)
            .frame(maxHeight: .infinity)
            .contentShape(Rectangle())
            .onTapGesture { heuteAntippen?() }
            .accessibilityLabel("Kalenderwoche \(Datumsformat.kalenderwoche(montagDatum))")
            .accessibilityAddTraits(.isButton)
            .accessibilityHint(nurTage == nil ? "Zur aktuellen Woche" : "Zurück zur Wochenansicht")
    }

    /// Kopf einer Tagesspalte. Tagesansicht: ausgeschrieben („Montag, 19. Oktober“); ein Tipp öffnet bzw. schließt die
    /// Tagesansicht.
    private func tageskopf(_ tag: Tageskopf, spaltenBreite: CGFloat) -> some View {
        let heute = Datumsformat.istHeute(tag.datum)
        let einzeln = nurTage?.count == 1
        return Group {
            if einzeln {
                Text(Datumsformat.anzeige(tag.datum, "EEEE, d. MMMM"))
                    .font(.subheadline.weight(.semibold))
            } else if kompakt && spaltenBreite < 64 {
                VStack(spacing: 0) {
                    Text(Datumsformat.anzeige(tag.datum, "EE"))
                        .font(.system(size: 11, weight: .semibold))
                    Text(Datumsformat.anzeige(tag.datum, "d.M."))
                        .font(.system(size: 11))
                        .monospacedDigit()
                }
            } else {
                (Text(Datumsformat.anzeige(tag.datum, "EE")).fontWeight(.semibold)
                    + Text(" " + Datumsformat.anzeige(tag.datum, "d.M.")).monospacedDigit())
                    .font(.system(size: kompakt ? 12 : 13))
            }
        }
        .foregroundStyle(heute ? Farben.akzent : Farben.text)
        .lineLimit(1)
        .minimumScaleFactor(0.75)
        .frame(width: spaltenBreite)
        .frame(maxHeight: .infinity)
        .overlay(alignment: .bottom) {
            if heute {
                Rectangle()
                    .fill(Farben.akzent)
                    .frame(height: 2)
                    .padding(.horizontal, tagesLuecke / 2)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { tagAntippen?(tag.datum) }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(Datumsformat.anzeige(tag.datum, "EEEE, d. MMMM") + (heute ? ", heute" : ""))
        .accessibilityAddTraits(.isButton)
        .accessibilityHint(einzeln ? "Zurück zur Wochenansicht" : "Tagesansicht öffnen")
    }

    // MARK: Zeitspalte, Linien und Pausen

    /// Links je Stunde die Nummer (13 pt halbfett) und darunter Beginn und Ende (11 pt); rechts daneben über alle Spalten
    /// eine feine Linie am Stundenbeginn und in den Pausen ein schmales graues Band ohne Text.
    private func zeitspalte(_ zeiten: [Rasterzeit], mass: Rastermass, breite: CGFloat) -> some View {
        ZStack(alignment: .topLeading) {
            ForEach(Array(zeiten.enumerated()), id: \.element.id) { eintrag in
                let z = eintrag.element
                let oben = mass.y(z.beginn)
                let unten = mass.yEnde(z.ende)
                let naechste: Rasterzeit? = eintrag.offset + 1 < zeiten.count ? zeiten[eintrag.offset + 1] : nil

                linie(breite: breite)
                    .offset(x: rinnenBreite, y: oben)
                // Pause bis zur nächsten Stunde als Band
                if let naechste, mass.y(naechste.beginn) - unten > 2 {
                    Rectangle()
                        .fill(Farben.pause)
                        .frame(width: max(breite - rinnenBreite, 0), height: mass.y(naechste.beginn) - unten)
                        .offset(x: rinnenBreite, y: unten)
                }
                VStack(spacing: 1) {
                    Text("\(z.nr)")
                        .font(.system(size: kompakt ? 12 : 13, weight: .semibold))
                        .foregroundStyle(Farben.text)
                    if unten - oben > 34 {
                        Text(Rasterzeit.uhrzeit(z.beginn))
                            .font(.system(size: kompakt ? 9.5 : 11).monospacedDigit())
                            .foregroundStyle(Farben.text3)
                        Text(Rasterzeit.uhrzeit(z.ende))
                            .font(.system(size: kompakt ? 9.5 : 11).monospacedDigit())
                            .foregroundStyle(Farben.text3)
                    }
                }
                .lineLimit(1)
                .fixedSize()
                .frame(width: rinnenBreite)
                .offset(y: oben + 4)
                if naechste == nil {
                    linie(breite: breite)
                        .offset(x: rinnenBreite, y: unten)
                }
            }
            // Rand zwischen Zeitspalte und Tagen
            Rectangle()
                .fill(Farben.rand)
                .frame(width: 1, height: max(mass.yEnde(zeiten.last?.ende ?? mass.start) + abstandUnten, 0))
                .offset(x: rinnenBreite - 1)
        }
        .accessibilityHidden(true)
    }

    private func linie(breite: CGFloat) -> some View {
        Rectangle()
            .fill(Farben.linie)
            .frame(width: max(breite - rinnenBreite, 0), height: 1)
    }

    /// Heutige Spalte ganz leicht in Marine hinterlegt (nur in der Mehrtagesansicht).
    @ViewBuilder
    private func heuteSpalte(spaltenBreite: CGFloat, hoehe: CGFloat) -> some View {
        if nurTage?.count != 1, let i = tage.firstIndex(where: { Datumsformat.istHeute($0.datum) }) {
            Rectangle()
                .fill(Farben.primaerFlaeche.opacity(0.55))
                .frame(width: spaltenBreite, height: hoehe)
                .offset(x: rinnenBreite + CGFloat(i) * spaltenBreite)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        }
    }

    // MARK: Tagesspalte

    private func tagesspalte(_ tag: Tageskopf, kacheln: [Kachel], zeiten: [Rasterzeit], mass: Rastermass,
                             ende: Int, breite: CGFloat, hoehe: CGFloat) -> some View {
        // Gleichzeitige Stunden (Kopplungen, Vertretung neben Entfall …) nebeneinander in gleich breiten Spuren
        let belegung = Kachelbau.anordnen(kacheln, spaltenBreite: breite, tagesansicht: nurTage?.count == 1)
        let vorErste = belegung.lagen.filter { $0.kachel.vorErsterStunde }.map(\.kachel.id)
        return ZStack(alignment: .topLeading) {
            if tag.frei {
                ferienfeld(tag)
                    // Bis zum unteren Rand (auch hinter der Tab-Leiste)
                    .frame(width: breite, height: max(hoehe - mass.y(mass.start) - 1, 20))
                    .offset(y: mass.y(mass.start) + 1)
            } else {
                // Eigene Abwesenheit: Fläche hinter den Stunden – die Kacheln liegen voll lesbar darüber
                ForEach(abwesenheiten[tag.datum] ?? []) { b in
                    abwesenheitsfeld(b, belegung: belegung, mass: mass, breite: breite, vorErste: vorErste)
                        .zIndex(0)
                }
                ForEach(belegung.lagen) { lage in
                    let r = rechteck(lage, mass: mass, breite: breite, vorErste: vorErste)
                    kachelKnopf(lage.kachel, alle: kacheln, breite: r.width, hoehe: r.height)
                        .frame(width: r.width, height: r.height)
                        .offset(x: r.minX, y: r.minY)
                        .zIndex(lage.kachel.feld ? 5 : (lage.kachel.inPause ? 6 : 2))
                }
                ForEach(belegung.streifen) { st in
                    let r = streifenRechteck(st, zeiten: zeiten, mass: mass, breite: breite)
                    Button {
                        guard !tippsperre.gesperrt else { return }
                        oeffnen(st.kacheln.first ?? st.vorne, alle: kacheln, vorne: st.vorne)
                    } label: {
                        ZaehlstreifenView(streifen: st)
                    }
                    .buttonStyle(KartenKnopfStil())
                    .frame(width: r.width, height: r.height)
                    .offset(x: r.minX, y: r.minY)
                    .zIndex(3)
                }
            }
        }
        .frame(width: breite, height: hoehe, alignment: .topLeading)
    }

    /// Fläche der eigenen Abwesenheit über die ganze Spaltenbreite. „Abwesend“ steht dezent nur in der größten Lücke ohne
    /// Kachel (mindestens 18 pt hoch) – liegt überall eine Kachel darüber, bleibt die Fläche ohne Text.
    private func abwesenheitsfeld(_ b: Abwesenheitsbalken, belegung: Tagesbelegung, mass: Rastermass, breite: CGFloat,
                                  vorErste: [UUID]) -> some View {
        let oben = mass.y(b.beginn) + 1
        let unten = max(oben + 8, mass.yEnde(b.ende) - 1)
        let belegt = belegung.lagen.filter { !$0.kachel.inPause && !$0.kachel.vorErsterStunde }
            .map { rechteck($0, mass: mass, breite: breite, vorErste: vorErste) }
            .filter { $0.maxY > oben && $0.minY < unten }
            .sorted { $0.minY < $1.minY }
        // größte freie Lücke in der Fläche
        var luecke: (von: CGFloat, bis: CGFloat) = (oben, oben)
        var y = oben
        for r in belegt {
            if r.minY - y > luecke.bis - luecke.von { luecke = (y, r.minY) }
            y = max(y, r.maxY)
        }
        if unten - y > luecke.bis - luecke.von { luecke = (y, unten) }
        let textHoehe = luecke.bis - luecke.von
        return ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: 4, style: .continuous)
                .fill(Farben.abwesendFlaeche.opacity(0.6))
                .frame(width: breite, height: unten - oben)
                .offset(y: oben)
            if textHoehe >= 18 {
                Text(b.text)
                    .font(.system(size: kompakt ? 11 : 12, weight: .medium))
                    .foregroundStyle(Farben.text2)
                    .lineLimit(2)
                    .minimumScaleFactor(0.7)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 2)
                    .frame(width: breite, height: textHoehe)
                    .offset(y: luecke.von)
            }
        }
        .allowsHitTesting(false)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(b.text) \(Rasterzeit.uhrzeit(b.beginn))–\(Rasterzeit.uhrzeit(b.ende))")
    }

    @ViewBuilder
    private func kachelKnopf(_ k: Kachel, alle: [Kachel], breite: CGFloat, hoehe: CGFloat) -> some View {
        let ansicht = KachelView(kachel: k, gross: nurTage != nil, breite: breite, hoehe: hoehe)
        if k.antippbar {
            Button {
                // Nur ein echtes Antippen öffnet die Stunde – nicht das Ende einer Wisch- oder Scrollbewegung
                guard !tippsperre.gesperrt else { return }
                if let a = k.aufsicht {
                    aufsichtAntippen?(a)
                } else {
                    oeffnen(k, alle: alle, vorne: nil)
                }
            } label: {
                ansicht
            }
            .buttonStyle(KartenKnopfStil())
        } else {
            ansicht
        }
    }

    /// Stundendetails öffnen: alle Stunden derselben Zeit als Reiter, die angetippte ausgewählt.
    private func oeffnen(_ k: Kachel, alle: [Kachel], vorne: Kachel?) {
        let karten = Kachelbau.parallele(vorne ?? k, in: alle)
        let index = karten.firstIndex { $0.id == k.karte?.id } ?? 0
        antippen(karten, index)
    }

    /// Lage einer Kachel in Punkten.
    private func rechteck(_ lage: Kachellage, mass: Rastermass, breite: CGFloat, vorErste: [UUID]) -> CGRect {
        let k = lage.kachel
        var x = breite * lage.links
        let bereich = breite * lage.breite
        let n = CGFloat(max(1, lage.spuren))
        let spurBreite = (bereich - (n - 1) * lage.luecke) / n
        x += CGFloat(lage.spur) * (spurBreite + lage.luecke)
        // Jede Kachel genau eine Spur breit
        var w = spurBreite
        var y: CGFloat
        var h: CGFloat
        if k.vorErsterStunde {
            // Kachel über dem Raster (Aufsicht vor der ersten Stunde, ganztägiger Termin); mehrere nebeneinander
            let anzahl = CGFloat(max(1, vorErste.count))
            let i = CGFloat(vorErste.firstIndex(of: k.id) ?? 0)
            w = (breite - (anzahl - 1) * 2) / anzahl
            x = i * (w + 2)
            // Direkt über der Linie der 1. Stunde (im freien Streifen vor ihr); in der Tagesansicht und auf dem iPhone
            // noch dichter an der 1. Stunde
            h = 20
            y = max(3, mass.y(mass.start) - h - (dichteAufsicht ? 2 : 4))
        } else if k.inPause {
            // Aufsicht: mittig in der (bei Bedarf gedehnten) Pause, vollständig sichtbar
            let oben = mass.yEnde(k.beginn)
            let unten = k.ende > k.beginn ? mass.yEnde(k.ende) : mass.y(k.ende)
            let luecke = max(0, unten - oben)
            h = max(16, min(nurTage == nil ? 20 : 24, luecke - 2))
            y = oben + max(1, (luecke - h) / 2)
        } else {
            y = mass.y(k.beginn) + 1.5
            h = max(16, mass.yEnde(k.ende) - mass.y(k.beginn) - 3)
        }
        return CGRect(x: x, y: y, width: max(w, 8), height: h)
    }

    private func streifenRechteck(_ st: Zaehlstreifen, zeiten: [Rasterzeit], mass: Rastermass, breite: CGFloat) -> CGRect {
        let beginn = zeiten.first(where: { $0.nr == st.von })?.beginn ?? st.kacheln.map(\.beginn).min() ?? mass.start
        let ende = zeiten.first(where: { $0.nr == st.bis })?.ende ?? st.kacheln.map(\.ende).max() ?? (beginn + 45)
        let y = mass.y(beginn) + 1.5
        return CGRect(x: breite - Kachelbau.zaehlerBreite, y: y, width: Kachelbau.zaehlerBreite,
                      height: max(16, mass.yEnde(ende) - mass.y(beginn) - 3))
    }

    /// Art des freien Tages als Überschrift („Ferien“, „Feiertag“ …).
    private func freiTitel(_ tag: Tageskopf) -> String {
        switch tag.freiArt {
        case "ferien": return "Ferien"
        case "feiertag": return "Feiertag"
        case "wochenende": return "Wochenende"
        default: return "Unterrichtsfrei"
        }
    }

    /// Ferien und Feiertage: die ganze Spalte hellblau mit Name und Zeitraum.
    private func ferienfeld(_ tag: Tageskopf) -> some View {
        RoundedRectangle(cornerRadius: 4, style: .continuous)
            .fill(Farben.freiFlaeche)
            .overlay(alignment: .top) {
                // Bezeichnung mehrzeilig und zentriert – bricht um statt abgeschnitten zu werden
                VStack(spacing: 3) {
                    Text(freiTitel(tag))
                        .font(.system(size: 12, weight: .semibold))
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                    if let grund = tag.freiGrund, !grund.isEmpty, grund.lowercased() != freiTitel(tag).lowercased() {
                        Text(grund)
                            .font(.system(size: 12))
                            .multilineTextAlignment(.center)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    if let von = tag.freiVon, let bis = tag.freiBis, !von.isEmpty, !bis.isEmpty {
                        Text(von == bis ? Datumsformat.anzeige(von, "dd.MM.") : "\(Datumsformat.anzeige(von, "dd.MM.")) – \(Datumsformat.anzeige(bis, "dd.MM."))")
                            .font(.system(size: 11).monospacedDigit())
                            .foregroundStyle(Farben.text2)
                            .multilineTextAlignment(.center)
                            .lineLimit(2)
                            .minimumScaleFactor(0.8)
                    }
                }
                .foregroundStyle(Farben.frei)
                .padding(.horizontal, 4)
                .padding(.top, 16)
            }
            .accessibilityElement(children: .combine)
    }

    // MARK: Jetzt-Linie

    /// Aktuelle Uhrzeit: 1-pt-Linie in Marine über die Tage mit kleinem Kreis am Rand der Zeitspalte (nur in Wochen bzw.
    /// Tagen, die heute enthalten).
    private func jetztLinie(mass: Rastermass, start: Int, ende: Int, breite: CGFloat) -> some View {
        TimelineView(.periodic(from: .now, by: 60)) { kontext in
            let minute = Datumsformat.kalender.component(.hour, from: kontext.date) * 60
                + Datumsformat.kalender.component(.minute, from: kontext.date)
            let heuteDabei = tage.contains(where: { $0.datum == Datumsformat.iso(kontext.date) })
            if heuteDabei, minute >= start, minute <= ende {
                let y = mass.y(minute)
                ZStack(alignment: .topLeading) {
                    Rectangle()
                        .fill(Farben.akzent)
                        .frame(width: max(breite - rinnenBreite, 0), height: 1)
                        .offset(x: rinnenBreite, y: y - 0.5)
                    Circle()
                        .fill(Farben.akzent)
                        .frame(width: 7, height: 7)
                        .offset(x: rinnenBreite - 3.5, y: y - 3.5)
                }
                .allowsHitTesting(false)
                .accessibilityHidden(true)
            }
        }
    }
}

/// Sperre für das Antippen von Stunden: während einer Wisch- bzw. Scrollbewegung und kurz danach (Nachlauf) öffnet ein
/// Antippen keine Details. Referenztyp ohne Beobachtung – Änderungen zeichnen nichts neu.
final class Tippsperre {
    var wischt = false
    var scrollt = false
    private var bis = Date.distantPast

    var gesperrt: Bool { wischt || scrollt || Date() < bis }

    /// Bewegung beendet: noch `nachlauf` Sekunden gesperrt.
    func bewegungEnde(nachlauf: TimeInterval) {
        wischt = false
        bis = max(bis, Date().addingTimeInterval(nachlauf))
    }

    /// Scrollen beendet (Scrollphase wieder ruhend).
    func scrollEnde() {
        scrollt = false
        bis = max(bis, Date().addingTimeInterval(0.15))
    }
}

/// Meldet ab iOS 18 die Scrollphase des Rasters an die Tippsperre (auch der Schwung nach dem Loslassen zählt).
struct Scrollsperre: ViewModifier {
    let sperre: Tippsperre

    #if compiler(>=6.0)
    func body(content: Content) -> some View {
        if #available(iOS 18.0, *) {
            content.onScrollPhaseChange { _, neu in
                if neu == .idle {
                    sperre.scrollEnde()
                } else {
                    sperre.scrollt = true
                }
            }
        } else {
            content
        }
    }
    #else
    func body(content: Content) -> some View {
        content
    }
    #endif
}

/// Zwischenspeicher der gebauten Kacheln je Tag (Schlüssel: Plan, Stand, angezeigte Tage, Minute). Das Bauen der Kacheln
/// ist teuer und erzeugt neue Kennungen; beim Blättern und erneuten Zeichnen werden die vorhandenen wiederverwendet.
enum Kachelspeicher {
    private static var speicher: [String: [Kachel]] = [:]

    static func kacheln(_ schluessel: String, bauen: () -> [Kachel]) -> [Kachel] {
        if let fertig = speicher[schluessel] { return fertig }
        let neu = bauen()
        if speicher.count > 160 { speicher.removeAll(keepingCapacity: true) }
        speicher[schluessel] = neu
        return neu
    }

    /// Alles verwerfen (z. B. beim Wechsel in ein anderes Konto).
    static func leeren() {
        speicher.removeAll()
    }
}

/// Raster nur neu berechnen, wenn sich Woche, Planart, Element, angezeigte Tage oder Stand ändern
/// (nicht bei jeder Verschiebung während des Wischens).
extension WochenrasterView: Equatable {
    static func == (l: WochenrasterView, r: WochenrasterView) -> Bool {
        l.plan.montag == r.plan.montag && l.typ == r.typ && l.element == r.element && l.nurTage == r.nurTage
            && l.stand == r.stand && l.laedt == r.laedt && l.untenFrei == r.untenFrei
            && l.senkrechtGesperrt == r.senkrechtGesperrt && l.abwesenheiten == r.abwesenheiten
    }
}

/// Karten reagieren beim Antippen ohne Animation und ohne Hervorhebung.
struct KartenKnopfStil: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
    }
}

/// Details einer Pausenaufsicht im gleichen Aufbau wie die Stundendetails: Kopf mit „Schließen“, Datum und Zeit und
/// Menü; Kopfblock mit Ort, „Pausenaufsicht“, Zeitraum und Lehrkraft (Vertretung: alt durchgestrichen → neu);
/// darunter „Im Stundenplan anzeigen“ für die beteiligten Lehrkräfte.
struct AufsichtDetailView: View {
    let aufsicht: Aufsicht
    @EnvironmentObject var zustand: AppZustand
    @Environment(\.dismiss) private var systemSchliessen
    @Environment(\.blattSchliessen) private var blattSchliessen

    private func schliessen() {
        if let blattSchliessen { blattSchliessen() } else { systemSchliessen() }
    }

    private var ort: String {
        !aufsicht.gangName.isEmpty ? aufsicht.gangName : (!aufsicht.gang.isEmpty ? aufsicht.gang : "Aufsicht")
    }

    private var zeit: String {
        if aufsicht.beginn.isEmpty { return aufsicht.nachStunde <= 0 ? "vor der 1. Stunde" : "nach der \(aufsicht.nachStunde). Stunde" }
        return aufsicht.ende.isEmpty ? aufsicht.beginn : "\(aufsicht.beginn) - \(aufsicht.ende)"
    }

    private var pause: String {
        aufsicht.nachStunde <= 0 ? "vor der 1. Stunde" : "nach der \(aufsicht.nachStunde). Stunde"
    }

    private var neueLehrkraft: String {
        aufsicht.lehrer == "???" ? "" : aufsicht.lehrer
    }

    /// Lehrkraft-Zeile (nur Text): regulär das Kürzel; Vertretung „alt | neu“ (alt durchgestrichen); offen alt durchgestrichen.
    private var lehrkraft: [Wertbaustein] {
        let alt = aufsicht.alt ?? ""
        switch aufsicht.status {
        case "vertreten", "vertretung":
            // Wie bei Stundenkarten: abwesende Lehrkraft durchgestrichen, daneben die Vertretung (offen: nur durchgestrichen)
            var teile: [Wertbaustein] = []
            if neueLehrkraft.isEmpty {
                if !alt.isEmpty { teile.append(.offen(alt)) }
            } else {
                if !alt.isEmpty && alt != neueLehrkraft {
                    teile.append(.weg(alt))
                    teile.append(.trenner)
                }
                teile.append(.neu(neueLehrkraft))
            }
            return teile
        case "entfall":
            // Entfallene Aufsicht: die eingeteilte Lehrkraft durchgestrichen (wie bei einer entfallenen Stunde)
            return neueLehrkraft.isEmpty || neueLehrkraft == "---" ? [] : [.weg(neueLehrkraft)]
        default:
            return neueLehrkraft.isEmpty ? [] : [.text(neueLehrkraft)]
        }
    }

    /// Entfallene Aufsicht (Plakette „Entfällt“ neben „Pausenaufsicht“).
    private var entfaellt: Bool { Kachelbau.aufsichtsstand(aufsicht.status) == .entfall }

    /// Anlass einer entfallenen Aufsicht (z. B. „Abwesenheit“ bzw. Titel der Veranstaltung); sonst leer.
    private var entfallGrund: String {
        entfaellt ? (aufsicht.grund ?? "").trimmingCharacters(in: .whitespacesAndNewlines) : ""
    }

    private var planziele: [PlanAuswahl] {
        guard zustand.istKollegium && zustand.darfLehrerplaene else { return [] }
        var liste: [PlanAuswahl] = []
        for k in [aufsicht.alt ?? "", neueLehrkraft] where !k.isEmpty {
            let plan = PlanAuswahl(typ: "lehrer", element: k, name: k)
            if !liste.contains(where: { $0.id == plan.id }) { liste.append(plan) }
        }
        return liste
    }

    var body: some View {
        VStack(spacing: 0) {
            Blattkopf(symbol: "xmark", symbolText: "Schließen", aktion: { schliessen() }, mitte: {
                Blatttitel(titel: Datumsformat.anzeige(aufsicht.datum, "EE, dd.MM.yy"), untertitel: zeit)
            }, rechts: {
                if !planziele.isEmpty {
                    Menu {
                        Section("Im Stundenplan anzeigen") {
                            ForEach(planziele) { plan in
                                Button {
                                    zustand.planZeigen(plan)
                                    schliessen()
                                } label: {
                                    Label(plan.anzeige, systemImage: Symbole.lehrkraft)
                                }
                            }
                        }
                    } label: {
                        Rundknopf(symbol: "ellipsis")
                    }
                    .accessibilityLabel("Weitere Aktionen")
                }
            })
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(ort)
                            .font(.title2.weight(.semibold))
                            .foregroundStyle(entfaellt ? Farben.text2 : Farben.text)
                            .strikethrough(entfaellt, color: Farben.entfall)
                        HStack(spacing: 8) {
                            Text("Pausenaufsicht")
                                .font(.subheadline)
                                .foregroundStyle(Farben.text2)
                            if entfaellt {
                                Plakette(text: "Entfällt", farbe: Farben.entfall, flaeche: Farben.entfallFlaeche)
                            } else if Kachelbau.aufsichtsstand(aufsicht.status) != .regulaer {
                                Plakette(text: "Vertretung", farbe: Farben.aenderung, flaeche: Farben.aenderungFlaeche)
                            }
                        }
                        if !entfallGrund.isEmpty {
                            Text(entfallGrund)
                                .font(.subheadline)
                                .foregroundStyle(Farben.text2)
                        }
                        VStack(alignment: .leading, spacing: 6) {
                            Label {
                                Text(aufsicht.beginn.isEmpty ? pause : "\(zeit) · \(pause)")
                                    .monospacedDigit()
                            } icon: {
                                Image(systemName: "clock")
                                    .foregroundStyle(Farben.text3)
                            }
                            if !lehrkraft.isEmpty {
                                Label {
                                    Wertzeile(bausteine: lehrkraft, schrift: Detailmass.klein, farbe: Farben.text)
                                } icon: {
                                    Image(systemName: Symbole.lehrkraft)
                                        .foregroundStyle(Farben.text3)
                                }
                            }
                        }
                        .font(.subheadline)
                        .foregroundStyle(Farben.text)
                        .padding(.top, 6)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, Detailmass.rand)
                    .padding(.top, 14)
                    .padding(.bottom, 14)
                    .accessibilityElement(children: .combine)
                    Rectangle()
                        .fill(Farben.rand)
                        .frame(height: 1)
                    VStack(spacing: 0) {
                        if !aufsicht.gang.isEmpty && aufsicht.gang != ort {
                            Detailzeile(symbol: "mappin.and.ellipse", titel: "Ort", untertitel: aufsicht.gang, pfeil: false)
                        }
                        ForEach(planziele) { plan in
                            Button {
                                zustand.planZeigen(plan)
                                schliessen()
                            } label: {
                                Detailzeile(symbol: Symbole.lehrkraft, titel: "Im Stundenplan anzeigen", untertitel: plan.anzeige)
                            }
                            .buttonStyle(ZeilenKnopfStil())
                        }
                    }
                    .padding(.top, 4)
                    .padding(.bottom, 24)
                }
            }
            .scrollIndicators(.hidden)
        }
        .background(Farben.blatt.ignoresSafeArea())
    }
}

/// Begrenzt die angebotene Breite, ohne das Kind zu dehnen: es bleibt so schmal wie sein Inhalt (anders als
/// `.frame(maxWidth:)`, das sich bei viel Platz auf die volle Höchstbreite ausdehnt).
struct Hoechstbreite: Layout {
    var breite: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        guard let kind = subviews.first else { return .zero }
        let w = min(proposal.width ?? breite, breite)
        return kind.sizeThatFits(ProposedViewSize(width: w, height: proposal.height))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        guard let kind = subviews.first else { return }
        kind.place(at: CGPoint(x: bounds.midX, y: bounds.midY), anchor: .center,
                   proposal: ProposedViewSize(width: bounds.width, height: bounds.height))
    }
}
