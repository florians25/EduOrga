import SwiftUI

/// Ansicht des Plans: Tag oder Woche (Matrix).
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

/// Ein Plan zum Bedienen mit einer Hand: waagrecht wischen = nächster bzw. voriger Schultag (Seiten), unten die
/// schwebende Wochenleiste aus Glas (Tag antippen; waagrecht wischen bzw. Pfeile = andere Woche; nach oben ziehen =
/// Wochenübersicht, nach unten = zurück zum Tag). Oben der Planname (Menü: eigener Plan, Favoriten, weitere Pläne),
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
    @AppStorage("planModus") private var modusRoh = Planmodus.tag.rawValue
    @AppStorage("tagesDarstellung") private var darstellungRoh = Tagesdarstellung.liste.rawValue
    @State private var tag: String? = nil
    @State private var wahl: Stundenwahl? = nil
    @State private var auswahlOffen = false
    @State private var datumOffen = false
    @State private var bereit = false

    init(fest: PlanAuswahl?) {
        self.fest = fest
    }

    private var istReiter: Bool { fest == nil }
    private var modus: Planmodus { Planmodus(rawValue: modusRoh) ?? .tag }
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

    var body: some View {
        if istReiter {
            inhalt.profilWerkzeug()
        } else {
            inhalt
        }
    }

    private var inhalt: some View {
        ZStack {
            if modus == .tag {
                tagesBlaetter
                    .transition(.opacity)
            } else {
                ScrollView {
                    Wochenmatrix(modell: modell, montag: aktuelleWoche, raum: zoom) { k, t, quelle in
                        oeffnen(k, in: t, quelle: quelle)
                    }
                }
                .refreshable { await modell.laden(montag: aktuelleWoche, erzwingen: true) }
                .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: modusRoh)
        .background(Farben.grund.ignoresSafeArea())
        .weicheRollkante(.bottom)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            Wochenschalter(modell: modell, montag: aktuelleWoche, gewaehlt: modus == .tag ? aktuellerTag : "",
                           wocheAktiv: modus == .woche,
                           waehlen: { tagWaehlen($0) }, blaettern: { blaettern($0) }, ansicht: { ansichtWechseln($0) })
                .padding(.horizontal, Stilmass.rand)
                .padding(.top, Stilmass.raster)
                .padding(.bottom, Stilmass.raster)
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
        .sheet(isPresented: $auswahlOffen) {
            PlanAuswahlView(auswahl: Binding(get: { modell.auswahl }, set: { neu in
                modell.waehlen(neu)
                Haptik.auswahl()
            }))
            .environmentObject(zustand)
            .environmentObject(favoriten)
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
        .onChange(of: zustand.benutzer?.element) { _, _ in modell.einrichten(zustand: zustand) }
        .onChange(of: zustand.planAnfrage) { _, _ in anfragenAusfuehren() }
        .onChange(of: zustand.tagAnfrage) { _, _ in anfragenAusfuehren() }
        .onChange(of: zustand.schnellaktion) { _, _ in anfragenAusfuehren() }
        .onChange(of: zustand.stundenplanHeute) { _, _ in
            guard istReiter else { return }
            if modus == .woche { modusRoh = Planmodus.tag.rawValue }
            withAnimation(.snappy) { tag = PlanSeite.startTag }
        }
        .onChange(of: zustand.planGeaendert) { _, _ in
            Task { await modell.laden(montag: aktuelleWoche, erzwingen: true) }
        }
        .onChange(of: zustand.notizAenderung) { _, neu in
            guard let neu else { return }
            Task { await modell.laden(montag: Planmodell.montag(neu.datum), erzwingen: true) }
        }
    }

    // MARK: Werkzeuge

    @ToolbarContentBuilder
    private var werkzeuge: some ToolbarContent {
        ToolbarItem(placement: .principal) {
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
                if modus == .woche { modusRoh = Planmodus.tag.rawValue }
                springen(zu: Date())
            }
            .fontWeight(.semibold)
            Menu {
                Picker("Ansicht", selection: $modusRoh) {
                    ForEach(Planmodus.allCases) { m in
                        Label(m.titel, systemImage: m == .tag ? "rectangle.portrait" : "square.grid.3x3").tag(m.rawValue)
                    }
                }
                Picker("Tag als", selection: $darstellungRoh) {
                    ForEach(Tagesdarstellung.allCases) { d in
                        Label(d.titel, systemImage: d == .liste ? "list.bullet.rectangle" : "calendar.day.timeline.left").tag(d.rawValue)
                    }
                }
                Button {
                    datumOffen = true
                } label: {
                    Label("Gehe zu Datum", systemImage: "calendar")
                }
                if darstellung == .zeitachse {
                    Section("Höhe der Zeitachse") {
                        ZeitachsenDichteAuswahl()
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
        VStack(spacing: 0) {
            HStack(spacing: 4) {
                Text(modell.planname)
                    .font(.headline)
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
                .font(.caption)
                .foregroundStyle(Farben.text2)
                .lineLimit(1)
        }
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
                zustand.reiter = .suche
            } label: {
                Label("Suchen", systemImage: "magnifyingglass")
            }
        }
    }

    /// „Okt. 2026 · KW 43 · A-Woche“
    private var wochentitel: String {
        let m = Datumsformat.datum(aktuelleWoche) ?? Date()
        var t = Datumsformat.anzeige(m, "MMM yyyy") + " · KW \(Datumsformat.kalenderwoche(m))"
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
        modell.einrichten(zustand: zustand)
        if let fest { modell.waehlen(fest) }
        if !bereit {
            bereit = true
            tag = PlanSeite.startTag
        }
        anfragenAusfuehren()
    }

    private func tagWaehlen(_ d: String) {
        if modus == .woche { modusRoh = Planmodus.tag.rawValue }
        withAnimation(.snappy) { tag = d }
    }

    /// Andere Woche: gleicher Wochentag (bzw. erster Schultag) der Nachbarwoche.
    private func blaettern(_ richtung: Int) {
        guard let m = Datumsformat.datum(aktuelleWoche) else { return }
        let neu = Datumsformat.iso(Datumsformat.tage(7 * richtung, nach: m))
        let index = modell.tage(montag: aktuelleWoche).firstIndex(of: aktuellerTag) ?? 0
        let tage = modell.tage(montag: neu)
        guard let ziel = tage.indices.contains(index) ? tage[index] : tage.first else { return }
        withAnimation(.snappy) { tag = ziel }
    }

    private func ansichtWechseln(_ woche: Bool) {
        let neu = woche ? Planmodus.woche.rawValue : Planmodus.tag.rawValue
        guard neu != modusRoh else { return }
        withAnimation(.easeInOut(duration: 0.2)) { modusRoh = neu }
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
                modusRoh = Planmodus.tag.rawValue
                springen(zu: Date())
            default:
                break
            }
        }
    }

    /// Stunde groß öffnen – mit allen Stunden zur selben Zeit.
    private func oeffnen(_ k: Kachel, in t: Tagesansicht, quelle: String) {
        Haptik.tippen()
        if let a = k.aufsicht {
            wahl = Stundenwahl(quelle: quelle, karten: [], aufsicht: a, typ: modell.typ, element: modell.element)
            return
        }
        let karten = Kachelbau.parallele(k, in: t.kacheln + t.ganztags)
        let start = karten.firstIndex { $0.id == k.karte?.id } ?? 0
        guard !karten.isEmpty else { return }
        wahl = Stundenwahl(quelle: quelle, karten: karten, start: start, typ: modell.typ, element: modell.element)
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
