import SwiftUI

/// Ansicht des Plans: Woche (Raster, Standard) oder Tag.
enum Planmodus: String, CaseIterable, Identifiable {
    case tag
    case woche

    var id: String { rawValue }
    var titel: String { self == .tag ? "Tag" : "Woche" }
}

/// Darstellung eines Tages: Liste großer Kacheln (Standard) oder Zeitachse mit echter Länge der Stunden.
enum Tagesdarstellung: String, CaseIterable, Identifiable {
    case liste
    case zeitachse

    var id: String { rawValue }
    var titel: String { self == .liste ? "Liste" : "Zeitachse" }
}

/// Reiter „Plan“: der eigene Plan bzw. ein gewählter Plan (Klasse, Lehrkraft, Raum).
struct PlanView: View {
    var body: some View {
        NavigationStack {
            PlanSeite(fest: nil)
        }
    }
}

/// Ein Plan zum Bedienen mit einer Hand. Startansicht ist die Woche als Raster (waagrecht wischen = andere Woche,
/// Tageskopf antippen = Tag); in der Tagesansicht waagrecht wischen = nächster bzw. voriger Schultag (Seiten). Unten die
/// schwebende Wochenleiste aus Glas (Tag antippen; waagrecht wischen bzw. Pfeile = andere Woche; nach oben ziehen =
/// Woche, nach unten = Tag). Oben der Planname (Menü: eigener Plan, Favoriten, weitere Pläne),
/// „Heute“ und das Menü (Tag/Woche, Liste/Zeitachse, Gehe zu Datum). Eine Stunde öffnet sich groß mit Zoom aus der
/// Kachel; langes Drücken zeigt Raumplan, Plan der Lehrkraft bzw. Klasse, Teilen und den Online-Link.
///
/// `fest` = Plan aus der Suche (eigene Seite im Stapel der Suche, mit Stern für Favoriten); nil = Reiter „Plan“
/// (eigener Plan, Planwechsel, Anfragen der anderen Reiter und Kurzbefehle).
struct PlanSeite: View {
    let fest: PlanAuswahl?

    @EnvironmentObject var zustand: AppZustand
    @EnvironmentObject var favoriten: Favoriten
    @StateObject private var modell = Planmodell()
    @Namespace private var zoom
    @AppStorage("planModus") private var modusRoh = Planmodus.woche.rawValue
    @AppStorage("tagesDarstellung") private var darstellungRoh = Tagesdarstellung.liste.rawValue
    @State private var tag: String? = nil
    @State private var wahl: Stundenwahl? = nil
    @State private var auswahlOffen = false
    @State private var datumOffen = false
    @State private var bereit = false
    /// Blatt „Stunden zur selben Zeit“ (hinter „+N“ im Wochenraster)
    @State private var parallelGruppe: Parallelgruppe? = nil
    /// Mehrere Pläne nebeneinander (iPad, Woche)
    @StateObject private var mehrfach = Mehrfachplaene()
    @State private var mehrfachWahlOffen = false
    @State private var legendeOffen = false
    @Environment(\.horizontalSizeClass) private var groessenklasse

    init(fest: PlanAuswahl?) {
        self.fest = fest
    }

    private var istReiter: Bool { fest == nil }
    private var modus: Planmodus { Planmodus(rawValue: modusRoh) ?? .woche }

    /// Mehrfachansicht möglich: Reiter „Plan“ auf breitem Bildschirm (iPad) in der Woche.
    private var mehrfachMoeglich: Bool { istReiter && groessenklasse == .regular && modus == .woche }
    private var mehrfachAktiv: Bool { mehrfachMoeglich && mehrfach.aktiv }

    /// Woche der Seiten im Wochenraster: Wechsel der Woche führt den Tag mit (gleicher Wochentag).
    private var wocheBindung: Binding<String> {
        Binding(get: { aktuelleWoche }, set: { neu in
            guard neu != aktuelleWoche, let alt = Datumsformat.datum(aktuelleWoche), let ziel = Datumsformat.datum(neu) else { return }
            let wochen = Int((ziel.timeIntervalSince(alt) / (7 * 86_400)).rounded())
            guard wochen != 0 else { return }
            blaettern(wochen, animiert: false)
        })
    }
    private var darstellung: Tagesdarstellung { Tagesdarstellung(rawValue: darstellungRoh) ?? .liste }

    // MARK: Zeitraum

    /// Erster Schultag ab heute (am Wochenende der nächste Montag).
    static var startTag: String {
        let heute = Datumsformat.kalender.startOfDay(for: Date())
        let wochentag = Datumsformat.kalender.component(.weekday, from: heute) // 1 = Sonntag
        if wochentag == 7 { return Datumsformat.iso(Datumsformat.tage(2, nach: heute)) }
        if wochentag == 1 { return Datumsformat.iso(Datumsformat.tage(1, nach: heute)) }
        return Datumsformat.iso(heute)
    }

    /// Wochen im Plan-Fenster der Rolle (sonst ein halbes Jahr zurück und voraus).
    private var montage: [String] {
        let zurueck = min(max(zustand.sitzung?.planWochenZurueck ?? 26, 0), 60)
        let vor = min(max(zustand.sitzung?.planWochenVor ?? 26, 0), 60)
        let basis = Datumsformat.montag(Datumsformat.datum(PlanSeite.startTag) ?? Date())
        return (-zurueck...vor).map { Datumsformat.iso(Datumsformat.tage($0 * 7, nach: basis)) }
    }

    private var alleTage: [String] {
        montage.flatMap { modell.tage(montag: $0) }
    }

    private var aktuellerTag: String { tag ?? PlanSeite.startTag }
    private var aktuelleWoche: String { Planmodell.montag(aktuellerTag) }

    // MARK: Ansicht

    /// Übergang zwischen Tag und Woche: die Woche „zoomt“ in den Tag hinein (und umgekehrt).
    private static let wechsel = Animation.snappy(duration: 0.34)

    var body: some View {
        inhalt
    }

    private var inhalt: some View {
        ZStack {
            if modus == .tag {
                tagesBlaetter
                    .transition(.asymmetric(insertion: .scale(scale: 0.94).combined(with: .opacity),
                                            removal: .scale(scale: 0.94).combined(with: .opacity)))
            } else {
                WochenSeiten(modell: modell, mehrfach: mehrfach, mehrfachAktiv: mehrfachAktiv, montage: montage,
                             montag: wocheBindung, raum: zoom,
                             antippen: { k, t, quelle, plan in oeffnen(k, in: t, quelle: quelle, plan: plan) },
                             tagOeffnen: { tagWaehlen($0) },
                             parallele: { parallelGruppe = $0 })
                    .transition(.asymmetric(insertion: .scale(scale: 1.06).combined(with: .opacity),
                                            removal: .scale(scale: 1.06).combined(with: .opacity)))
            }
        }
        .animation(PlanSeite.wechsel, value: modusRoh)
        .simultaneousGesture(zoomGeste)
        .background(Farben.grund.ignoresSafeArea())
        .weicheRollkante(.bottom)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            // Woche: Raster bis zum Rand (wischen = Woche, Tageskopf = Tag); Tag: schwebende Wochenleiste
            if modus == .tag {
            Wochenschalter(modell: modell, montag: aktuelleWoche, gewaehlt: modus == .tag ? aktuellerTag : "",
                           wocheAktiv: modus == .woche,
                           waehlen: { tagWaehlen($0) }, blaettern: { blaettern($0) }, ansicht: { ansichtWechseln($0) })
                .padding(.horizontal, Stilmass.rand)
                .padding(.top, Stilmass.raster)
                .padding(.bottom, Stilmass.raster)
            }
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            if mehrfachMoeglich {
                Mehrfachleiste(mehrfach: mehrfach) { mehrfachWahlOffen = true }
            }
        }
        .overlay(alignment: .top) {
            if let fehler = modell.fehler {
                Fehlerhinweis(text: fehler)
                    .padding(.horizontal, Stilmass.rand)
                    .padding(.top, Stilmass.raster)
                    .onTapGesture { modell.fehler = nil }
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .navigationTitle(modell.planname)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { werkzeuge }
        .stundenBuehne($wahl, raum: zoom, zustand: zustand)
        .sheet(item: $parallelGruppe) { g in
            ParalleleStundenBlatt(gruppe: g) { k in
                parallelGruppe = nil
                // erst das Blatt schließen, dann die Stunde groß öffnen
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                    oeffnen(k, in: g.tag, quelle: "woche-\(k.id.uuidString)", plan: g.plan)
                }
            }
            .environment(\.kartendarstellung, zustand.darstellung)
        }
        .sheet(isPresented: $auswahlOffen) {
            PlanAuswahlView(auswahl: Binding(get: { modell.auswahl }, set: { neu in
                modell.waehlen(neu)
                Haptik.auswahl()
            }))
            .environmentObject(zustand)
            .environmentObject(favoriten)
            .presentationDetents([.large])
        }
        .sheet(isPresented: $mehrfachWahlOffen) {
            PlanAuswahlView(auswahl: Binding<PlanAuswahl?>(get: { nil }, set: { neu in
                guard let neu else { return }
                withAnimation(.snappy(duration: 0.2)) { mehrfach.hinzufuegen(neu) }
                Haptik.auswahl()
            }))
            .environmentObject(zustand)
            .environmentObject(favoriten)
            .presentationDetents([.large])
        }
        .sheet(isPresented: $legendeOffen) {
            PlanLegende()
                .environment(\.kartendarstellung, zustand.darstellung)
        }
        .sheet(isPresented: $datumOffen) {
            GeheZuDatumView(start: Datumsformat.datum(aktuellerTag) ?? Date()) { d in
                datumOffen = false
                springen(zu: d)
            }
            .presentationDetents([.medium, .large])
        }
        .sensoryFeedback(.selection, trigger: modusRoh)
        .sensoryFeedback(.selection, trigger: tag)
        .onAppear(perform: vorbereiten)
        .onChange(of: zustand.benutzer?.element) { _, _ in modell.einrichten(zustand: zustand) }
        .onChange(of: zustand.planAnfrage) { _, _ in anfragenAusfuehren() }
        .onChange(of: zustand.tagAnfrage) { _, _ in anfragenAusfuehren() }
        .onChange(of: zustand.schnellaktion) { _, _ in anfragenAusfuehren() }
        .onChange(of: zustand.stundenplanHeute) { _, _ in
            guard istReiter else { return }
            withAnimation(.snappy) { tag = PlanSeite.startTag }
        }
        .onChange(of: zustand.planGeaendert) { _, _ in
            Task {
                await modell.laden(montag: aktuelleWoche, erzwingen: true)
                if mehrfach.aktiv { await mehrfach.laden(montag: aktuelleWoche, erzwingen: true) }
            }
        }
        .onChange(of: zustand.notizAenderung) { _, neu in
            guard let neu else { return }
            Task { await modell.laden(montag: Planmodell.montag(neu.datum), erzwingen: true) }
        }
    }

    // MARK: Werkzeuge

    /// Zwei Finger: zusammenziehen = Woche, aufziehen = Tag.
    private var zoomGeste: some Gesture {
        MagnifyGesture(minimumScaleDelta: 0.04)
            .onEnded { wert in
                if modus == .woche && wert.magnification > 1.3 {
                    tagWaehlen(aktuellerTag)
                } else if modus == .tag && wert.magnification < 0.75 {
                    ansichtWechseln(true)
                }
            }
    }

    /// Tag | Woche als Segmentschalter in der Navigationsleiste (ohne Untermenü).
    private var modusBindung: Binding<Planmodus> {
        Binding(get: { modus }, set: { neu in
            if neu == .tag { tagWaehlen(aktuellerTag) } else { ansichtWechseln(true) }
        })
    }

    @ToolbarContentBuilder
    private var werkzeuge: some ToolbarContent {
        ToolbarItem(placement: .principal) {
            Picker("Ansicht", selection: modusBindung) {
                Text("Tag").tag(Planmodus.tag)
                Text("Woche").tag(Planmodus.woche)
            }
            .pickerStyle(.segmented)
            .frame(width: 132)
            .accessibilityLabel("Ansicht: Tag oder Woche")
        }
        ToolbarItem(placement: .topBarLeading) {
            if istReiter {
                Menu {
                    planMenue
                } label: {
                    titelBlock(mitPfeil: true)
                }
                .accessibilityLabel("Plan: \(modell.planname). Anderen Plan wählen")
            } else {
                titelBlock(mitPfeil: false)
            }
        }
        ToolbarItemGroup(placement: .topBarTrailing) {
            if let fest {
                Button {
                    Haptik.auswahl()
                    favoriten.umschalten(fest)
                } label: {
                    Image(systemName: favoriten.enthaelt(fest) ? "star.fill" : "star")
                }
                .accessibilityLabel(favoriten.enthaelt(fest) ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen")
            }
            Button("Heute") {
                Haptik.tippen()
                springen(zu: Date())
            }
            .fontWeight(.semibold)
            // Auf schmalen Bildschirmen steht die Suche im Menü des Plannamens (Platz für Tag | Woche)
            if istReiter && groessenklasse == .regular {
                Button {
                    Haptik.tippen()
                    zustand.sucheOffen = true
                } label: {
                    Image(systemName: "magnifyingglass")
                }
                .accessibilityLabel("Plan suchen")
            }
            Menu {
                if modus == .woche {
                    Section("Dichte der Woche") {
                        WochendichteAuswahl()
                    }
                } else {
                    Picker("Tag als", selection: $darstellungRoh) {
                        ForEach(Tagesdarstellung.allCases) { d in
                            Label(d.titel, systemImage: d == .liste ? "list.bullet.rectangle" : "calendar.day.timeline.left").tag(d.rawValue)
                        }
                    }
                    if darstellung == .zeitachse {
                        Section("Höhe der Zeitachse") {
                            ZeitachsenDichteAuswahl()
                        }
                    }
                }
                Button {
                    datumOffen = true
                } label: {
                    Label("Gehe zu Datum", systemImage: "calendar")
                }
                Section {
                    Button {
                        legendeOffen = true
                    } label: {
                        Label("Legende", systemImage: "info.circle")
                    }
                }
            } label: {
                Image(systemName: "ellipsis")
            }
            .accessibilityLabel("Ansicht und weitere Aktionen")
        }
    }

    /// Planname mit Woche („KW 43 · A-Woche“) als Titel.
    private func titelBlock(mitPfeil: Bool) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 3) {
                Text(mehrfachAktiv ? "\(mehrfach.auswahl.count) Pläne" : modell.planname)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Farben.text)
                    .lineLimit(1)
                if mitPfeil {
                    Image(systemName: "chevron.down")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Farben.text3)
                        .accessibilityHidden(true)
                }
            }
            Text(wochentitel)
                .font(.caption2)
                .foregroundStyle(Farben.text2)
                .lineLimit(1)
        }
        .frame(maxWidth: fest == nil ? 118 : 92, alignment: .leading)
        .dynamicTypeSize(...DynamicTypeSize.xLarge)
    }

    @ViewBuilder
    private var planMenue: some View {
        Button {
            Haptik.auswahl()
            modell.waehlen(nil)
        } label: {
            if modell.istEigenerPlan {
                Label("Mein Plan", systemImage: "checkmark")
            } else {
                Text("Mein Plan")
            }
        }
        if !favoriten.liste.isEmpty {
            Section("Favoriten") {
                ForEach(favoriten.liste) { fav in
                    Button {
                        Haptik.auswahl()
                        modell.waehlen(fav)
                    } label: {
                        if modell.auswahl?.id == fav.id {
                            Label(fav.anzeige, systemImage: "checkmark")
                        } else {
                            Text(fav.anzeige)
                        }
                    }
                }
            }
        }
        Section {
            Button {
                auswahlOffen = true
            } label: {
                Label("Weitere Pläne …", systemImage: "list.bullet")
            }
            Button {
                zustand.sucheOffen = true
            } label: {
                Label("Suchen", systemImage: "magnifyingglass")
            }
        }
    }

    /// „KW 43 · A-Woche“
    private var wochentitel: String {
        let m = Datumsformat.datum(aktuelleWoche) ?? Date()
        var t = "KW \(Datumsformat.kalenderwoche(m))"
        if let w = modell.plan(montag: aktuelleWoche)?.woche, !w.isEmpty {
            t += w.count == 1 ? " · \(w)-Woche" : " · \(w)"
        }
        return t
    }

    // MARK: Tage

    private var tagesBlaetter: some View {
        ScrollViewReader { leser in
            ScrollView(.horizontal) {
                LazyHStack(spacing: 0) {
                    ForEach(alleTage, id: \.self) { d in
                        TagSeite(modell: modell, datum: d, raum: zoom, darstellung: darstellung) { k, t, quelle in
                            oeffnen(k, in: t, quelle: quelle)
                        }
                        .containerRelativeFrame(.horizontal)
                        .id(d)
                    }
                }
                .scrollTargetLayout()
            }
            .scrollTargetBehavior(.paging)
            .scrollIndicators(.hidden)
            .scrollPosition(id: $tag)
            .onAppear {
                let ziel = aktuellerTag
                DispatchQueue.main.async { leser.scrollTo(ziel, anchor: .leading) }
            }
        }
    }

    // MARK: Abläufe

    private func vorbereiten() {
        // Die Woche ist jetzt die Startansicht (einmalig auch für bisherige Installationen)
        if !UserDefaults.standard.bool(forKey: "planWocheStandard") {
            UserDefaults.standard.set(true, forKey: "planWocheStandard")
            modusRoh = Planmodus.woche.rawValue
        }
        modell.einrichten(zustand: zustand)
        if istReiter { mehrfach.einrichten(zustand: zustand) }
        if let fest { modell.waehlen(fest) }
        if !bereit {
            bereit = true
            tag = PlanSeite.startTag
        }
        anfragenAusfuehren()
    }

    /// Tag öffnen (aus der Woche mit Übergang: Tageskopf, Aufziehen, Segmentschalter).
    private func tagWaehlen(_ d: String) {
        if modus == .woche {
            tag = d
            withAnimation(PlanSeite.wechsel) { modusRoh = Planmodus.tag.rawValue }
        } else {
            withAnimation(.snappy) { tag = d }
        }
    }

    /// Andere Woche: gleicher Wochentag (bzw. erster Schultag) der Nachbarwoche.
    private func blaettern(_ richtung: Int, animiert: Bool = true) {
        guard let m = Datumsformat.datum(aktuelleWoche) else { return }
        let neu = Datumsformat.iso(Datumsformat.tage(7 * richtung, nach: m))
        let index = modell.tage(montag: aktuelleWoche).firstIndex(of: aktuellerTag) ?? 0
        let tage = modell.tage(montag: neu)
        guard let ziel = tage.indices.contains(index) ? tage[index] : tage.first else { return }
        if animiert {
            withAnimation(.snappy) { tag = ziel }
        } else {
            tag = ziel
        }
    }

    private func ansichtWechseln(_ woche: Bool) {
        let neu = woche ? Planmodus.woche.rawValue : Planmodus.tag.rawValue
        guard neu != modusRoh else { return }
        withAnimation(PlanSeite.wechsel) { modusRoh = neu }
    }

    /// Zu einem Datum springen (Wochenende: der folgende Montag bzw. der nächste Tag im Plan).
    private func springen(zu datum: Date) {
        var iso = Datumsformat.iso(datum)
        let tage = modell.tage(montag: Planmodell.montag(iso))
        if !tage.contains(iso) {
            iso = tage.first(where: { $0 > iso }) ?? Datumsformat.iso(Datumsformat.tage(7, nach: Datumsformat.montag(datum)))
        }
        withAnimation(.snappy) { tag = iso }
    }

    /// Anfragen anderer Reiter: Plan zeigen, Tag im eigenen Plan, Kurzbefehle (nur im Reiter „Plan“).
    private func anfragenAusfuehren() {
        guard istReiter else { return }
        if let p = zustand.planAnfrage {
            zustand.planAnfrage = nil
            modell.waehlen(p.typ == modell.eigenerTyp && p.element.caseInsensitiveCompare(modell.eigenesElement) == .orderedSame ? nil : p)
        }
        if let d = zustand.tagAnfrage {
            zustand.tagAnfrage = nil
            modell.waehlen(nil)
            modusRoh = Planmodus.tag.rawValue
            if let datum = Datumsformat.datum(d) { springen(zu: datum) }
        }
        if let a = zustand.schnellaktion {
            zustand.schnellaktion = nil
            switch a {
            case .stundenplan:
                modell.waehlen(nil)
                springen(zu: Date())
            default:
                break
            }
        }
    }

    /// Stunde groß öffnen – mit allen Stunden zur selben Zeit (Mehrfachansicht: im Plan der Spalte).
    private func oeffnen(_ k: Kachel, in t: Tagesansicht, quelle: String, plan: PlanAuswahl? = nil) {
        Haptik.tippen()
        let typ = plan?.typ ?? modell.typ
        let element = plan?.element ?? modell.element
        if let a = k.aufsicht {
            wahl = Stundenwahl(quelle: quelle, karten: [], aufsicht: a, typ: typ, element: element)
            return
        }
        let karten = Kachelbau.parallele(k, in: t.kacheln + t.ganztags)
        let start = karten.firstIndex { $0.id == k.karte?.id } ?? 0
        guard !karten.isEmpty else { return }
        wahl = Stundenwahl(quelle: quelle, karten: karten, start: start, typ: typ, element: element)
    }
}

// MARK: - Ein Tag

/// Seite eines Tages: Kopf mit Wochentag, Datum und Kennzahlen, ganztägige Termine, Hinweise und eigene Abwesenheit,
/// darunter die Stunden als Liste (bzw. als Zeitachse). Heute rollt die Seite zur laufenden bzw. nächsten Stunde.
/// Ferien, freie Tage und gesperrte Wochen als Hinweis.
struct TagSeite: View {
    @ObservedObject var modell: Planmodell
    let datum: String
    let raum: Namespace.ID?
    let darstellung: Tagesdarstellung
    let antippen: (Kachel, Tagesansicht, String) -> Void
    @State private var gerollt = false

    private var anker: String { "anker-\(datum)" }

    var body: some View {
        ScrollViewReader { leser in
            ScrollView(.vertical) {
                VStack(alignment: .leading, spacing: 2 * Stilmass.raster) {
                    tageskopf
                    if let t = modell.tag(datum) {
                        inhalt(t)
                    } else if modell.fehler != nil && !modell.laedt(montag: Planmodell.montag(datum)) {
                        Hinweisfeld(titel: "Plan nicht geladen", text: "Zum Aktualisieren nach unten ziehen.", symbol: "wifi.exclamationmark",
                                    flaeche: Farben.flaeche)
                            .padding(.horizontal, Stilmass.rand)
                    } else {
                        Platzhaltertag()
                    }
                }
                .padding(.top, Stilmass.raster)
                .padding(.bottom, 3 * Stilmass.raster)
                .frame(maxWidth: 760)
                .frame(maxWidth: .infinity)
            }
            .scrollIndicators(.hidden)
            .refreshable {
                await modell.laden(montag: Planmodell.montag(datum), erzwingen: true)
                Haptik.erfolg()
            }
            .onAppear { rollen(leser) }
            .onChange(of: modell.stand) { _, _ in rollen(leser) }
        }
        .task(id: "\(modell.typ)|\(modell.element)|\(Planmodell.montag(datum))") {
            await modell.laden(montag: Planmodell.montag(datum))
        }
    }

    /// Heute einmal zur laufenden bzw. nächsten Stunde rollen (Zeitachse: zur aktuellen Uhrzeit bzw. ersten Stunde).
    private func rollen(_ leser: ScrollViewProxy) {
        guard !gerollt, let t = modell.tag(datum), !t.stunden.isEmpty else { return }
        guard t.istHeute || darstellung == .zeitachse else { return }
        gerollt = true
        let ziel = anker
        DispatchQueue.main.async {
            withAnimation(.snappy) { leser.scrollTo(ziel, anchor: .top) }
        }
    }

    private var tageskopf: some View {
        let t = modell.tag(datum)
        let heute = Datumsformat.istHeute(datum)
        return VStack(alignment: .leading, spacing: 2) {
            Text(heute ? "Heute" : Datumsformat.anzeige(datum, "EEEE"))
                .font(.largeTitle.weight(.bold))
                .foregroundStyle(heute ? Farben.akzent : Farben.text)
            HStack(alignment: .firstTextBaseline, spacing: Stilmass.raster) {
                Text(Datumsformat.anzeige(datum, heute ? "EEEE, d. MMMM" : "d. MMMM yyyy"))
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Farben.text2)
                if let t, !t.frei, !t.gesperrt, !t.stunden.isEmpty {
                    kennzahlen(t)
                }
            }
        }
        .padding(.horizontal, Stilmass.rand)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }

    /// „6 Std. · 2 Änd. · 1 Entf.“ – Änderungen und Entfall in ihrer Farbe.
    private func kennzahlen(_ t: Tagesansicht) -> some View {
        var text = Text("\(t.anzahlStunden) Std.").foregroundColor(Farben.text2)
        if t.anzahlAenderung > 0 {
            text = text + Text("  ·  ").foregroundColor(Farben.text3)
                + Text("\(t.anzahlAenderung) Änd.").foregroundColor(Farben.aenderung).fontWeight(.bold)
        }
        if t.anzahlEntfall > 0 {
            text = text + Text("  ·  ").foregroundColor(Farben.text3)
                + Text("\(t.anzahlEntfall) Entf.").foregroundColor(Farben.entfall).fontWeight(.bold)
        }
        return text
            .font(.subheadline)
            .monospacedDigit()
            .lineLimit(1)
    }

    @ViewBuilder
    private func inhalt(_ t: Tagesansicht) -> some View {
        if t.gesperrt {
            let hinweis = (t.sperrhinweis ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            Hinweisfeld(titel: "Nicht freigegeben", text: hinweis.isEmpty ? "Dieser Zeitraum ist für Ihr Konto noch nicht einsehbar." : hinweis,
                        symbol: "lock", minHoehe: 160, flaeche: Farben.flaeche)
                .padding(.horizontal, Stilmass.rand)
        } else if let f = t.freiText {
            FreiFlaeche(titel: f.titel, zeitraum: f.zeitraum)
                .padding(.horizontal, Stilmass.rand)
        } else {
            if darstellung == .zeitachse {
                ForEach(t.ganztags) { g in
                    ganztagKnopf(g, t)
                }
            }
            ForEach(Array((t.kopf?.hinweise ?? []).enumerated()), id: \.offset) { _, h in
                HStack(alignment: .top, spacing: Stilmass.raster) {
                    Image(systemName: "info.circle")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Farben.frei)
                        .accessibilityHidden(true)
                    Text(h)
                        .font(.footnote)
                        .foregroundStyle(Farben.text)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(12)
                .background(Farben.freiFlaeche, in: RoundedRectangle(cornerRadius: Stilmass.kachelRadius, style: .continuous))
                .padding(.horizontal, Stilmass.rand)
                .accessibilityElement(children: .combine)
            }
            if darstellung == .liste {
                ForEach(t.balken) { b in
                    Label("\(b.text) · \(Uhr.uhrzeit(b.beginn))–\(Uhr.uhrzeit(b.ende))", systemImage: "person.crop.circle.badge.xmark")
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(Farben.text2)
                        .padding(.horizontal, 12)
                        .padding(.vertical, Stilmass.raster)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Farben.abwesendFlaeche, in: RoundedRectangle(cornerRadius: Stilmass.kachelRadius, style: .continuous))
                        .padding(.horizontal, Stilmass.rand)
                }
            }
            if t.stunden.isEmpty && t.kacheln.isEmpty && t.ganztags.isEmpty {
                Hinweisfeld(titel: "Kein Unterricht", text: t.istHeute ? "Heute ist kein Unterricht geplant." : "An diesem Tag ist kein Unterricht geplant.",
                            symbol: "sun.max", minHoehe: 140, flaeche: Farben.flaeche)
                    .padding(.horizontal, Stilmass.rand)
            } else if darstellung == .liste {
                Tagesliste(kacheln: t.ganztags + t.kacheln, raster: t.raster, istHeute: t.istHeute, raum: raum, ankerID: anker) { k, quelle in
                    antippen(k, t, quelle)
                }
                .padding(.horizontal, Stilmass.rand)
            } else {
                if t.istHeute && modell.istEigenerPlan && Jetztlage.berechnen(t.kacheln, minuten: Uhr.minuten()) != nil {
                    JetztKarte(kacheln: t.kacheln, raum: raum) { k, quelle in antippen(k, t, quelle) }
                        .padding(.horizontal, Stilmass.rand)
                }
                Zeitachse(tag: t, raum: raum, ankerID: anker) { k, quelle in antippen(k, t, quelle) }
                    .padding(.top, 4)
            }
        }
    }

    private func ganztagKnopf(_ g: Kachel, _ t: Tagesansicht) -> some View {
        Button {
            antippen(g, t, "ganz-\(g.id.uuidString)")
        } label: {
            HStack(spacing: Stilmass.raster) {
                Image(systemName: "calendar")
                    .font(.footnote.weight(.semibold))
                    .accessibilityHidden(true)
                Text(g.anzeigeTitel)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(2)
                Spacer(minLength: 0)
                Text("Ganztägig")
                    .font(.caption)
            }
            .foregroundStyle(Farben.termin)
            .padding(.horizontal, 12)
            .padding(.vertical, Stilmass.raster)
            .background(Farben.terminFlaeche, in: RoundedRectangle(cornerRadius: Stilmass.kachelRadius, style: .continuous))
            .zoomQuelle("ganz-\(g.id.uuidString)", in: raum)
        }
        .buttonStyle(KachelDruckStil())
        .padding(.horizontal, Stilmass.rand)
    }
}

/// Ferien bzw. unterrichtsfreier Tag: große Fläche in der Ferienfarbe.
struct FreiFlaeche: View {
    let titel: String
    let zeitraum: String

    var body: some View {
        VStack(alignment: .leading, spacing: Stilmass.raster) {
            Image(systemName: "sun.max")
                .font(.largeTitle)
                .foregroundStyle(Farben.frei)
                .accessibilityHidden(true)
            Text(titel)
                .font(.title2.weight(.bold))
                .foregroundStyle(Farben.frei)
            if !zeitraum.isEmpty {
                Text(zeitraum)
                    .font(.subheadline)
                    .foregroundStyle(Farben.text2)
            }
            Text("Kein Unterricht")
                .font(.footnote)
                .foregroundStyle(Farben.text3)
        }
        .padding(24)
        .frame(maxWidth: .infinity, minHeight: 200, alignment: .bottomLeading)
        .background(Farben.freiFlaeche, in: RoundedRectangle(cornerRadius: Stilmass.radius, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

/// Platzhalter, solange der Tag lädt: ruhige Blöcke statt Ladekreis.
struct Platzhaltertag: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Stilmass.raster) {
            ForEach(0..<5, id: \.self) { i in
                RoundedRectangle(cornerRadius: Stilmass.kachelRadius, style: .continuous)
                    .fill(Farben.neutralFlaeche)
                    .frame(height: i == 2 ? 24 : 80)
                    .opacity(i == 2 ? 0.5 : 1)
            }
        }
        .padding(.leading, Stilmass.zeitspalte + 4)
        .padding(.trailing, Stilmass.rand)
        .redacted(reason: .placeholder)
        .accessibilityLabel("Wird geladen")
    }
}

/// Auswahl der Dichte der Zeitachse (im Menü und in den Einstellungen).
struct ZeitachsenDichteAuswahl: View {
    @AppStorage("zeitachseDichte") private var dichte: Double = 1.0

    var body: some View {
        Picker("Dichte", selection: $dichte) {
            Text("Kompakt").tag(0.75)
            Text("Normal").tag(1.0)
            Text("Groß").tag(1.35)
        }
    }
}
