import SwiftUI

/// Ansicht des Plans: Agenda (Liste der Woche), Woche (Raster, Standard) oder Tag.
enum Planmodus: String, CaseIterable, Identifiable {
    case agenda
    case woche
    case tag

    var id: String { rawValue }

    var titel: String {
        switch self {
        case .agenda: return "Agenda"
        case .woche: return "Woche"
        case .tag: return "Tag"
        }
    }

    /// Symbol in der Planleiste unten
    var symbol: String {
        switch self {
        case .agenda: return "list.bullet"
        case .woche: return "square.grid.3x3"
        case .tag: return "calendar.day.timeline.left"
        }
    }
}

/// Darstellung eines Tages: Raster wie die Woche (Standard, gleichzeitige Stunden nebeneinander), Liste großer Kacheln
/// oder Zeitachse mit echter Länge der Stunden.
enum Tagesdarstellung: String, CaseIterable, Identifiable {
    case raster
    case liste
    case zeitachse

    var id: String { rawValue }

    var titel: String {
        switch self {
        case .raster: return "Raster"
        case .liste: return "Liste"
        case .zeitachse: return "Zeitachse"
        }
    }
}

/// Reiter „Plan“: der eigene Plan bzw. ein gewählter Plan (Klasse, Lehrkraft, Raum).
struct PlanView: View {
    var body: some View {
        NavigationStack {
            PlanSeite(fest: nil)
        }
    }
}

/// Ein Plan zum Bedienen mit einer Hand (design/DESIGN.md Abschnitt 10). Oben nur der Planname mit der Woche in der Mitte
/// („KW 43 · Okt. 2026“, Menü: eigener Plan, Favoriten, Auswahl, Suche) und rechts ein Kalenderknopf (Heute, Gehe zu Datum,
/// voriger/nächster Zeitraum) – auf schmalen iPhones kollidiert nichts. Unten schwebt die Planleiste aus Glas mit den
/// Ansichten Agenda | Woche | Tag, dem Dreieck „Nur Änderungen“ und „Auswahl und Filter“. Woche: Raster bis zum Rand
/// (waagrecht wischen = andere Woche, Tageskopf antippen bzw. aufziehen = Tag). Tag: oben die Wochenleiste der Schultage,
/// waagrecht wischen = nächster bzw. voriger Schultag; zusammenziehen = Woche. Eine Stunde öffnet sich groß mit Zoom aus
/// der Kachel; langes Drücken zeigt Raumplan, Plan der Lehrkraft bzw. Klasse, Teilen und den Online-Link. Mehrfachauswahl
/// (Kontrollkästchen in der Auswahl): mehrere Pläne nebeneinander, oben als Felder mit „×“.
///
/// `fest` = Plan aus der Suche (eigene Seite im Stapel der Suche, Favorit im Kalendermenü); nil = Reiter „Plan“
/// (eigener Plan, Planwechsel, Mehrfachauswahl, Anfragen der anderen Reiter und Kurzbefehle).
struct PlanSeite: View {
    let fest: PlanAuswahl?

    @EnvironmentObject var zustand: AppZustand
    @EnvironmentObject var favoriten: Favoriten
    @StateObject private var modell = Planmodell()
    @Namespace private var zoom
    @AppStorage("planModus") private var modusRoh = Planmodus.woche.rawValue
    @AppStorage("tagesDarstellung") private var darstellungRoh = Tagesdarstellung.raster.rawValue
    @AppStorage(Planfilter.schluesselAufsichten) private var filterAufsichten = true
    @AppStorage(Planfilter.schluesselMitteilungen) private var filterMitteilungen = true
    @AppStorage(Planfilter.schluesselFerien) private var filterFerien = true
    @AppStorage(Planfilter.schluesselAenderungen) private var filterNurAenderungen = false
    @AppStorage(Planfilter.schluesselIst) private var filterIstZustand = false
    @State private var tag: String? = nil
    @State private var wahl: Stundenwahl? = nil
    @State private var datumOffen = false
    @State private var bereit = false
    /// „Stand EduOrga Studio“ kurz einblenden (nach dem Öffnen bzw. Wochenwechsel)
    @State private var studioZeigen = true
    /// Blatt „Auswahl und Filter“ (Bereich beim Öffnen)
    @State private var blatt: Auswahlbereich? = nil
    /// Blatt „Stunden zur selben Zeit“ (hinter „+N“ im Raster)
    @State private var parallelGruppe: Parallelgruppe? = nil
    /// Mehrere Pläne nebeneinander (Mehrfachauswahl)
    @StateObject private var mehrfach = Mehrfachplaene()
    @Environment(\.horizontalSizeClass) private var groessenklasse

    init(fest: PlanAuswahl?) {
        self.fest = fest
    }

    private var istReiter: Bool { fest == nil }
    private var modus: Planmodus { Planmodus(rawValue: modusRoh) ?? .woche }
    private var darstellung: Tagesdarstellung { Tagesdarstellung(rawValue: darstellungRoh) ?? .raster }

    /// Mehrfachauswahl möglich: Reiter „Plan“ in Woche, Agenda bzw. Tag als Raster.
    private var mehrfachMoeglich: Bool { istReiter && (modus != .tag || darstellung == .raster) }
    private var mehrfachAktiv: Bool { mehrfachMoeglich && mehrfach.aktiv }
    /// Leiste mit den gewählten Plänen: auf dem iPad immer (mit „Pläne nebeneinander …“), auf dem iPhone bei Auswahl.
    private var mehrfachLeisteZeigen: Bool { mehrfachMoeglich && (groessenklasse == .regular || mehrfach.aktiv) }

    private var filter: Planfilter {
        Planfilter(aufsichten: filterAufsichten, mitteilungen: filterMitteilungen, ferien: filterFerien,
                   nurAenderungen: filterNurAenderungen, nurIstZustand: filterIstZustand)
    }

    /// Woche der Seiten (Woche, Agenda): Wechsel der Woche führt den Tag mit (gleicher Wochentag).
    private var wocheBindung: Binding<String> {
        Binding(get: { aktuelleWoche }, set: { neu in
            guard neu != aktuelleWoche, let alt = Datumsformat.datum(aktuelleWoche), let ziel = Datumsformat.datum(neu) else { return }
            let wochen = Int((ziel.timeIntervalSince(alt) / (7 * 86_400)).rounded())
            guard wochen != 0 else { return }
            blaettern(wochen, animiert: false)
        })
    }

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

    /// Übergang zwischen den Ansichten: die Woche „zoomt“ in den Tag hinein (und umgekehrt).
    private static let wechsel = Animation.snappy(duration: 0.34)
    /// „Bewegung reduzieren“: Ansichtswechsel nur überblenden (kein Zoom)
    @Environment(\.accessibilityReduceMotion) private var wenigerBewegung

    var body: some View {
        inhalt
    }

    private var inhalt: some View {
        ZStack {
            switch modus {
            case .tag:
                tagesBlaetter
                    .transition(wenigerBewegung ? AnyTransition.opacity : AnyTransition.asymmetric(insertion: .scale(scale: 0.94).combined(with: .opacity),
                                                                        removal: .scale(scale: 0.94).combined(with: .opacity)))
            case .woche:
                WochenSeiten(modell: modell, mehrfach: mehrfach, mehrfachAktiv: mehrfachAktiv, montage: montage,
                             montag: wocheBindung, raum: zoom,
                             antippen: { k, t, quelle, plan in oeffnen(k, in: t, quelle: quelle, plan: plan) },
                             tagOeffnen: { tagWaehlen($0) },
                             parallele: { parallelGruppe = $0 })
                    .transition(wenigerBewegung ? AnyTransition.opacity : AnyTransition.asymmetric(insertion: .scale(scale: 1.06).combined(with: .opacity),
                                                                        removal: .scale(scale: 1.06).combined(with: .opacity)))
            case .agenda:
                AgendaSeiten(modell: modell, mehrfach: mehrfach, mehrfachAktiv: mehrfachAktiv, montage: montage,
                             montag: wocheBindung, raum: zoom,
                             antippen: { k, t, quelle, plan in oeffnen(k, in: t, quelle: quelle, plan: plan) },
                             tagOeffnen: { tagWaehlen($0) })
                    .transition(.opacity)
            }
        }
        .animation(PlanSeite.wechsel, value: modusRoh)
        .simultaneousGesture(zoomGeste)
        .background(Farben.grund.ignoresSafeArea())
        .weicheRollkante(.bottom)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            Planleiste(modus: modus, nurAenderungen: filterNurAenderungen,
                       filterAktiv: !filterAufsichten || !filterMitteilungen || !filterFerien || filterIstZustand,
                       waehlen: { modusWaehlen($0) },
                       aenderungenUmschalten: {
                           Haptik.auswahl()
                           withAnimation(.snappy(duration: 0.25)) { filterNurAenderungen.toggle() }
                       },
                       filterOeffnen: { blatt = .filter })
                .padding(.horizontal, Stilmass.rand)
                .padding(.top, Stilmass.raster)
                .padding(.bottom, Stilmass.raster)
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            VStack(spacing: 0) {
                if mehrfachLeisteZeigen {
                    Mehrfachleiste(mehrfach: mehrfach) { blatt = .auswahl }
                }
                if modus == .tag {
                    // Tag: die Schultage der Woche oben (antippen; waagrecht wischen bzw. Pfeile = andere Woche;
                    // nach oben ziehen = Woche)
                    Wochenschalter(modell: modell, montag: aktuelleWoche, gewaehlt: aktuellerTag, wocheAktiv: false,
                                   waehlen: { tagWaehlen($0) }, blaettern: { blaettern($0) }, ansicht: { ansichtWechseln($0) })
                        .padding(.horizontal, Stilmass.rand)
                        .padding(.top, 4)
                        .padding(.bottom, 6)
                }
            }
        }
        .overlay(alignment: .top) {
            VStack(spacing: 6) {
                if let fehler = modell.fehler {
                    Fehlerhinweis(text: fehler)
                        .padding(.horizontal, Stilmass.rand)
                        .onTapGesture { modell.fehler = nil }
                        .transition(.move(edge: .top).combined(with: .opacity))
                }
                // Daten aus dem Zwischenspeicher (Laden läuft bzw. gescheitert): „Stand hh:mm“, bis die frische Antwort da ist
                if let stand = standAnzeige {
                    Standhinweis(stand: stand, laedt: standLaedt)
                        .transition(.opacity)
                }
                // Stand aus EduOrga Studio: einige Sekunden nach dem Öffnen bzw. Wochenwechsel, dauerhaft wenn veraltet
                if studioZeigen || studioVeraltet {
                    StudiostandZeile(stand: Studiostand.stand(zustand),
                                     abgerufen: mehrfachAktiv ? nil : modell.abgerufen(montag: aktuelleWoche), kapsel: true)
                        .transition(.opacity)
                }
            }
            .padding(.top, Stilmass.raster)
            .animation(.snappy(duration: 0.2), value: standAnzeige)
            .animation(.easeInOut(duration: 0.25), value: studioZeigen)
        }
        .task(id: aktuelleWoche) {
            studioZeigen = true
            try? await Task.sleep(nanoseconds: 5_000_000_000)
            studioZeigen = false
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
        .sheet(item: $blatt) { b in
            PlanAuswahlBlatt(modell: modell, mehrfach: mehrfach, mehrfachErlaubt: istReiter, start: b,
                             einzeln: { einzelnWaehlen($0) }, umschalten: { mehrfachUmschalten($0) })
                .environmentObject(zustand)
                .environmentObject(favoriten)
                .environment(\.kartendarstellung, zustand.darstellung)
                .presentationDetents([.large])
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
        .onChange(of: filter) { _, neu in
            modell.filter = neu
            mehrfach.filter = neu
        }
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
        // App im Vordergrund, Push, angetippte Mitteilung: gezeigte Woche sofort frisch laden (Speicher nur Platzhalter)
        .onChange(of: zustand.frischeAnfrage) { _, _ in
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

    /// Studio-Stand an einem Schultag älter als 24 Stunden: der Hinweis bleibt stehen.
    private var studioVeraltet: Bool {
        Studiostand.stand(zustand).map { Studiostand.veraltet($0) } ?? false
    }

    /// Stand der gezeigten Woche, solange er nicht als aktuell bestätigt ist (nil = frisch).
    private var standAnzeige: Date? {
        mehrfachAktiv ? mehrfach.standHinweis(montag: aktuelleWoche) : modell.standHinweis(montag: aktuelleWoche)
    }

    private var standLaedt: Bool {
        if mehrfachAktiv {
            return mehrfach.auswahl.contains { mehrfach.modell($0)?.laedt(montag: aktuelleWoche) == true }
        }
        return modell.laedt(montag: aktuelleWoche)
    }

    // MARK: Werkzeuge

    /// Zwei Finger: aufziehen = genauer (Agenda → Woche → Tag), zusammenziehen = Überblick (Tag → Woche).
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

    /// Oben in der Mitte der Planname mit Zeitraum (Menü; ersetzt den Titel der Leiste), rechts genau ein Knopf: der
    /// Kalender (auf dem iPad zusätzlich die Suche). Links bleibt Platz für „Zurück“ (Plan aus der Suche).
    @ToolbarContentBuilder
    private var werkzeuge: some ToolbarContent {
        ToolbarItem(placement: .principal) {
            if istReiter {
                Menu {
                    planMenue
                } label: {
                    titelBlock(mitPfeil: true)
                }
                .accessibilityLabel("Plan: " + planTitel + ". Anderen Plan wählen")
            } else {
                titelBlock(mitPfeil: false)
            }
        }
        ToolbarItemGroup(placement: .topBarTrailing) {
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
                Button {
                    Haptik.tippen()
                    springen(zu: Date())
                } label: {
                    Label("Heute", systemImage: "calendar.badge.clock")
                }
                Button {
                    datumOffen = true
                } label: {
                    Label("Gehe zu Datum …", systemImage: "calendar")
                }
                Section {
                    Button {
                        Haptik.auswahl()
                        zeitraumBlaettern(-1)
                    } label: {
                        Label(modus == .tag ? "Voriger Tag" : "Vorige Woche", systemImage: "chevron.left")
                    }
                    Button {
                        Haptik.auswahl()
                        zeitraumBlaettern(1)
                    } label: {
                        Label(modus == .tag ? "Nächster Tag" : "Nächste Woche", systemImage: "chevron.right")
                    }
                }
                if let fest {
                    Section {
                        Button {
                            Haptik.auswahl()
                            favoriten.umschalten(fest)
                        } label: {
                            Label(favoriten.enthaelt(fest) ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen",
                                  systemImage: favoriten.enthaelt(fest) ? "star.slash" : "star")
                        }
                    }
                }
            } label: {
                Image(systemName: "calendar")
            }
            .accessibilityLabel("Datum: Heute, Gehe zu Datum, blättern")
        }
    }

    /// Planname (bzw. „3 Pläne“) mit dem Zeitraum („KW 43 · Okt. 2026“, im Tag das Datum) als Titel.
    private func titelBlock(mitPfeil: Bool) -> some View {
        VStack(alignment: .center, spacing: 0) {
            HStack(spacing: 3) {
                Text(planTitel)
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
            untertitel
                .font(.caption2)
                .lineLimit(1)
        }
        .frame(maxWidth: groessenklasse == .regular ? 320 : 200)
        .dynamicTypeSize(...DynamicTypeSize.xLarge)
    }

    /// Planname bzw. „3 Pläne“ (Mehrfachauswahl).
    private var planTitel: String {
        mehrfachAktiv ? "\(mehrfach.auswahl.count) Pläne" : modell.planname
    }

    /// Zeitraum, bei „Nur Änderungen“ mit Kennzeichnung in Petrol.
    private var untertitel: Text {
        let zeitraum = Text(zeitraumTitel).foregroundColor(Farben.text2)
        guard filterNurAenderungen else { return zeitraum }
        return zeitraum + Text("  ·  ").foregroundColor(Farben.text3) + Text("Änderungen").foregroundColor(Farben.akzent).fontWeight(.semibold)
    }

    @ViewBuilder
    private var planMenue: some View {
        Button {
            Haptik.auswahl()
            einzelnWaehlen(nil)
        } label: {
            if modell.istEigenerPlan && !mehrfachAktiv {
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
                        einzelnWaehlen(fav)
                    } label: {
                        if modell.auswahl?.id == fav.id && !mehrfachAktiv {
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
                blatt = .auswahl
            } label: {
                Label("Auswahl …", systemImage: "line.3.horizontal.decrease")
            }
            Button {
                zustand.sucheOffen = true
            } label: {
                Label("Suchen", systemImage: "magnifyingglass")
            }
        }
        // Datenstand: letzte Änderung aus EduOrga Studio und – getrennt davon – wann die App zuletzt geladen hat
        Section("Datenstand") {
            if let stand = Studiostand.stand(zustand) {
                Button {
                    studioZeigen = true
                    Task {
                        try? await Task.sleep(nanoseconds: 6_000_000_000)
                        studioZeigen = false
                    }
                } label: {
                    Label("EduOrga Studio: \(Studiostand.voll(stand))",
                          systemImage: Studiostand.veraltet(stand) ? "exclamationmark.triangle" : "arrow.triangle.2.circlepath")
                }
            } else {
                Text("EduOrga Studio: Stand unbekannt")
            }
            if !mehrfachAktiv, let geladen = modell.abgerufen(montag: aktuelleWoche) {
                Text("In der App aktualisiert \(Datumsformat.anzeige(geladen, "HH:mm"))")
            }
        }
    }

    /// „KW 43 · Okt. 2026 · A-Woche“ (Woche, Agenda) bzw. „Di 20.10.2026“ (Tag).
    private var zeitraumTitel: String {
        if modus == .tag {
            return Datumsformat.anzeige(aktuellerTag, "EE").replacingOccurrences(of: ".", with: "") + " "
                + Datumsformat.anzeige(aktuellerTag, "dd.MM.yyyy")
        }
        let m = Datumsformat.datum(aktuelleWoche) ?? Date()
        var t = "KW \(Datumsformat.kalenderwoche(m)) · " + Datumsformat.anzeige(aktuelleWoche, "MMM yyyy")
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
                        Group {
                            if darstellung == .raster {
                                TagRasterSeite(modell: modell, mehrfach: mehrfach, mehrfachAktiv: mehrfachAktiv, datum: d, raum: zoom,
                                               antippen: { k, t, quelle, plan in oeffnen(k, in: t, quelle: quelle, plan: plan) },
                                               parallele: { parallelGruppe = $0 })
                            } else {
                                TagSeite(modell: modell, datum: d, raum: zoom, darstellung: darstellung) { k, t, quelle in
                                    oeffnen(k, in: t, quelle: quelle)
                                }
                            }
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
        modell.filter = filter
        mehrfach.filter = filter
        modell.einrichten(zustand: zustand)
        if istReiter { mehrfach.einrichten(zustand: zustand) }
        if let fest { modell.waehlen(fest) }
        if !bereit {
            bereit = true
            tag = PlanSeite.startTag
        }
        anfragenAusfuehren()
    }

    /// Ansicht aus der Planleiste (Agenda, Woche, Tag).
    private func modusWaehlen(_ m: Planmodus) {
        guard m != modus else { return }
        Haptik.auswahl()
        if m == .tag {
            tagWaehlen(aktuellerTag)
        } else {
            withAnimation(PlanSeite.wechsel) { modusRoh = m.rawValue }
        }
    }

    /// Tag öffnen (aus Woche bzw. Agenda mit Übergang: Tageskopf, Aufziehen, Planleiste).
    private func tagWaehlen(_ d: String) {
        if modus != .tag {
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

    /// Voriger bzw. nächster Zeitraum (Kalendermenü): im Tag der Schultag, sonst die Woche.
    private func zeitraumBlaettern(_ richtung: Int) {
        guard modus == .tag else {
            blaettern(richtung)
            return
        }
        let liste = alleTage
        guard let i = liste.firstIndex(of: aktuellerTag), liste.indices.contains(i + richtung) else {
            blaettern(richtung)
            return
        }
        withAnimation(.snappy) { tag = liste[i + richtung] }
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

    // MARK: Auswahl

    /// Plan der Seite als Auswahl (eigener Plan mit seinem Kürzel).
    private var aktuellerPlan: PlanAuswahl {
        modell.auswahl ?? PlanAuswahl(typ: modell.eigenerTyp, element: modell.eigenesElement, name: modell.eigenesElement)
    }

    private func istEigenerPlan(_ p: PlanAuswahl) -> Bool {
        p.typ == modell.eigenerTyp && p.element.caseInsensitiveCompare(modell.eigenesElement) == .orderedSame
    }

    /// Genau einen Plan zeigen (Zeile der Auswahl, Planmenü): Mehrfachauswahl endet.
    private func einzelnWaehlen(_ p: PlanAuswahl?) {
        if mehrfach.aktiv { withAnimation(.snappy(duration: 0.2)) { mehrfach.leeren() } }
        if let p, !istEigenerPlan(p) {
            modell.waehlen(p)
        } else {
            modell.waehlen(nil)
        }
    }

    /// Kontrollkästchen der Auswahl: Plan zur Mehrfachauswahl hinzufügen bzw. entfernen (der bisher gezeigte Plan ist
    /// der erste). Bleibt nur ein Plan übrig, zeigt die Seite ihn wieder allein.
    private func mehrfachUmschalten(_ p: PlanAuswahl) {
        var liste = mehrfach.aktiv ? mehrfach.auswahl : [aktuellerPlan]
        if let i = liste.firstIndex(where: { $0.typ == p.typ && $0.element.caseInsensitiveCompare(p.element) == .orderedSame }) {
            liste.remove(at: i)
        } else if liste.count < Mehrfachplaene.hoechstens {
            liste.append(p)
        }
        withAnimation(.snappy(duration: 0.2)) {
            if liste.count <= 1 {
                mehrfach.leeren()
                if let erster = liste.first, !istEigenerPlan(erster) { modell.waehlen(erster) } else { modell.waehlen(nil) }
            } else {
                mehrfach.ersetzen(liste)
            }
        }
    }

    /// Anfragen anderer Reiter: Plan zeigen, Tag im eigenen Plan, Kurzbefehle (nur im Reiter „Plan“).
    private func anfragenAusfuehren() {
        guard istReiter else { return }
        if let p = zustand.planAnfrage {
            zustand.planAnfrage = nil
            einzelnWaehlen(p.typ == modell.eigenerTyp && p.element.caseInsensitiveCompare(modell.eigenesElement) == .orderedSame ? nil : p)
        }
        if let d = zustand.tagAnfrage {
            zustand.tagAnfrage = nil
            einzelnWaehlen(nil)
            modusRoh = Planmodus.tag.rawValue
            if let datum = Datumsformat.datum(d) { springen(zu: datum) }
        }
        if let a = zustand.schnellaktion {
            zustand.schnellaktion = nil
            switch a {
            case .stundenplan:
                einzelnWaehlen(nil)
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

// MARK: - Tag als Raster

/// Seite eines Tages als Raster (wie die Woche, eine breite Spalte): Zeitspalte, Tageskopf, gleichzeitige Stunden
/// nebeneinander, Termine im Raster. Mehrfachauswahl: je Plan eine Unterspalte.
struct TagRasterSeite: View {
    @ObservedObject var modell: Planmodell
    @ObservedObject var mehrfach: Mehrfachplaene
    let mehrfachAktiv: Bool
    let datum: String
    let raum: Namespace.ID?
    let antippen: Rasterantippen
    let parallele: (Parallelgruppe) -> Void

    private var montag: String { Planmodell.montag(datum) }

    private var ladeKennung: String {
        mehrfachAktiv ? "m|\(mehrfach.kennung)|\(montag)" : "\(modell.typ)|\(modell.element)|\(montag)"
    }

    var body: some View {
        GeometryReader { geo in
            ScrollView(.vertical) {
                Group {
                    if mehrfachAktiv {
                        Mehrfachraster(mehrfach: mehrfach, montag: montag, raum: raum, antippen: antippen,
                                       tagOeffnen: { _ in }, parallele: parallele, verfuegbar: geo.size, nurTag: datum)
                    } else {
                        Wochenraster(modell: modell, montag: montag, raum: raum, antippen: antippen, tagOeffnen: { _ in },
                                     parallele: parallele, verfuegbar: geo.size, nurTag: datum)
                    }
                }
                .padding(.bottom, 6)
            }
            .scrollIndicators(.hidden)
            .refreshable {
                if mehrfachAktiv {
                    await mehrfach.aktualisieren(montag: montag)
                } else {
                    await modell.aktualisieren(montag: montag)
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
                await modell.aktualisieren(montag: Planmodell.montag(datum))
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
