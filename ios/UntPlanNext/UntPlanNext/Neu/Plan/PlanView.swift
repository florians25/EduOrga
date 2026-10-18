import SwiftUI

/// Ansicht des Plans: Tag (Zeitachse) oder Woche (Matrix).
enum Planmodus: String, CaseIterable, Identifiable {
    case tag
    case woche

    var id: String { rawValue }
    var titel: String { self == .tag ? "Tag" : "Woche" }
}

/// Reiter „Plan“: oben der Planname (Planauswahl), „Heute“ und das Menü; darunter Tag/Woche, die Wochenleiste zum
/// Blättern und der Tag als Zeitachse (waagrecht wischen = nächster bzw. voriger Schultag) bzw. die Woche als Matrix.
/// Eine Stunde öffnet sich groß (ab iOS 18 mit Zoom aus der Kachel).
struct PlanView: View {
    @EnvironmentObject var zustand: AppZustand
    @EnvironmentObject var favoriten: Favoriten
    @StateObject private var modell = Planmodell()
    @Namespace private var zoom
    @AppStorage("planModus") private var modusRoh = Planmodus.tag.rawValue
    @State private var tag: String? = nil
    @State private var woche: String? = nil
    @State private var wahl: Stundenwahl? = nil
    @State private var auswahlOffen = false
    @State private var datumOffen = false
    @State private var bereit = false
    @ScaledMetric(relativeTo: .title3) private var leistenHoehe: CGFloat = 78

    private var modus: Planmodus { Planmodus(rawValue: modusRoh) ?? .tag }

    // MARK: Zeitraum

    /// Erster Schultag ab heute (am Wochenende der nächste Montag).
    private static var startTag: String {
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
        let basis = Datumsformat.montag(Datumsformat.datum(PlanView.startTag) ?? Date())
        return (-zurueck...vor).map { Datumsformat.iso(Datumsformat.tage($0 * 7, nach: basis)) }
    }

    private var alleTage: [String] {
        montage.flatMap { modell.tage(montag: $0) }
    }

    private var aktuellerTag: String { tag ?? PlanView.startTag }
    private var aktuelleWoche: String { woche ?? Planmodell.montag(aktuellerTag) }

    // MARK: Ansicht

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                kopf
                Divider()
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
                .animation(.easeInOut(duration: 0.15), value: modusRoh)
            }
            .background(Farben.grund.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { werkzeuge }
            .overlay(alignment: .bottom) {
                if let fehler = modell.fehler {
                    Fehlerhinweis(text: fehler)
                        .padding(.horizontal, Stilmass.rand)
                        .padding(.bottom, 12)
                        .onTapGesture { modell.fehler = nil }
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
        }
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
        .onAppear(perform: vorbereiten)
        .onChange(of: zustand.benutzer?.element) { _, _ in modell.einrichten(zustand: zustand) }
        .onChange(of: tag) { _, neu in
            guard let neu else { return }
            let m = Planmodell.montag(neu)
            if woche != m { woche = m }
        }
        .onChange(of: woche) { _, neu in
            // Woche in der Leiste geblättert: gleichen Wochentag in der neuen Woche wählen
            guard let neu, Planmodell.montag(aktuellerTag) != neu else { return }
            let tage = modell.tage(montag: neu)
            let index = modell.tage(montag: Planmodell.montag(aktuellerTag)).firstIndex(of: aktuellerTag) ?? 0
            let ziel: String? = tage.indices.contains(index) ? tage[index] : tage.first
            if let ziel { tag = ziel }
        }
        .onChange(of: zustand.planAnfrage) { _, _ in anfragenAusfuehren() }
        .onChange(of: zustand.tagAnfrage) { _, _ in anfragenAusfuehren() }
        .onChange(of: zustand.schnellaktion) { _, _ in anfragenAusfuehren() }
        .onChange(of: zustand.stundenplanHeute) { _, _ in
            withAnimation(.easeInOut(duration: 0.25)) { tag = PlanView.startTag }
        }
        .onChange(of: zustand.planGeaendert) { _, _ in
            Task { await modell.laden(montag: Planmodell.montag(aktuellerTag), erzwingen: true) }
        }
        .onChange(of: zustand.notizAenderung) { _, neu in
            guard let neu else { return }
            Task { await modell.laden(montag: Planmodell.montag(neu.datum), erzwingen: true) }
        }
    }

    // MARK: Kopf

    @ToolbarContentBuilder
    private var werkzeuge: some ToolbarContent {
        ToolbarItem(placement: .principal) {
            Button {
                auswahlOffen = true
            } label: {
                VStack(spacing: 0) {
                    HStack(spacing: 4) {
                        Text(modell.planname)
                            .font(.headline)
                            .foregroundStyle(Farben.text)
                        Image(systemName: "chevron.down")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(Farben.text3)
                    }
                    if !modell.planart.isEmpty {
                        Text(modell.planart)
                            .font(.caption2)
                            .foregroundStyle(Farben.text2)
                    }
                }
            }
            .accessibilityLabel("Plan: \(modell.planname). Anderen Plan wählen")
        }
        ToolbarItem(placement: .topBarLeading) {
            if !modell.istEigenerPlan {
                Button("Mein Plan") {
                    modell.waehlen(nil)
                    Haptik.auswahl()
                }
            }
        }
        ToolbarItemGroup(placement: .topBarTrailing) {
            Button("Heute") {
                Haptik.tippen()
                springen(zu: Date())
            }
            .fontWeight(.semibold)
            Menu {
                Picker("Ansicht", selection: $modusRoh) {
                    ForEach(Planmodus.allCases) { m in
                        Text(m.titel).tag(m.rawValue)
                    }
                }
                Button {
                    datumOffen = true
                } label: {
                    Label("Gehe zu Datum", systemImage: "calendar")
                }
                Button {
                    auswahlOffen = true
                } label: {
                    Label("Anderer Plan", systemImage: "magnifyingglass")
                }
                Section("Zeitachse") {
                    ZeitachsenDichteAuswahl()
                }
            } label: {
                Image(systemName: "ellipsis.circle")
            }
            .accessibilityLabel("Weitere Aktionen")
        }
    }

    private var kopf: some View {
        VStack(spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(wochentitel)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Farben.text)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                Picker("Ansicht", selection: $modusRoh) {
                    ForEach(Planmodus.allCases) { m in
                        Text(m.titel).tag(m.rawValue)
                    }
                }
                .pickerStyle(.segmented)
                .fixedSize()
            }
            .padding(.horizontal, Stilmass.rand)
            Wochenleiste(modell: modell, montage: montage, woche: $woche, gewaehlt: modus == .tag ? aktuellerTag : "") { d in
                if modus == .woche { modusRoh = Planmodus.tag.rawValue }
                withAnimation(.easeInOut(duration: 0.25)) { tag = d }
            }
            .frame(height: leistenHoehe)
        }
        .padding(.top, 6)
        .padding(.bottom, 6)
        .background(Farben.flaeche.ignoresSafeArea(edges: .top))
    }

    /// „Oktober 2026 · KW 43“
    private var wochentitel: String {
        let m = Datumsformat.datum(aktuelleWoche) ?? Date()
        var t = Datumsformat.anzeige(m, "MMMM yyyy") + " · KW \(Datumsformat.kalenderwoche(m))"
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
                        TagSeite(modell: modell, datum: d, raum: zoom) { k, t, quelle in
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
        if !bereit {
            bereit = true
            tag = PlanView.startTag
            woche = Planmodell.montag(PlanView.startTag)
        }
        anfragenAusfuehren()
    }

    /// Zu einem Datum springen (Wochenende: der folgende Montag bzw. der nächste Tag im Plan).
    private func springen(zu datum: Date) {
        var iso = Datumsformat.iso(datum)
        let tage = modell.tage(montag: Planmodell.montag(iso))
        if !tage.contains(iso) {
            iso = tage.first(where: { $0 > iso }) ?? Datumsformat.iso(Datumsformat.tage(7, nach: Datumsformat.montag(datum)))
        }
        if modus == .woche {
            woche = Planmodell.montag(iso)
        }
        withAnimation(.easeInOut(duration: 0.25)) { tag = iso }
    }

    /// Anfragen anderer Reiter: Plan zeigen, Tag im eigenen Plan, Kurzbefehle.
    private func anfragenAusfuehren() {
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
            case .suche:
                auswahlOffen = true
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
        let karten = Kachelbau.parallele(k, in: t.kacheln)
        let start = karten.firstIndex { $0.id == k.karte?.id } ?? 0
        guard !karten.isEmpty else { return }
        wahl = Stundenwahl(quelle: quelle, karten: karten, start: start, typ: modell.typ, element: modell.element)
    }
}

// MARK: - Ein Tag

/// Seite eines Tages: Kopf mit Datum und Kennzahlen, ganztägige Termine und Hinweise, heute die Jetzt-Karte, darunter
/// die Zeitachse. Ferien, freie Tage und gesperrte Wochen als Hinweis.
struct TagSeite: View {
    @ObservedObject var modell: Planmodell
    let datum: String
    let raum: Namespace.ID?
    let antippen: (Kachel, Tagesansicht, String) -> Void
    @State private var gerollt = false

    private var anker: String { "anker-\(datum)" }

    var body: some View {
        ScrollViewReader { leser in
            ScrollView(.vertical) {
                VStack(alignment: .leading, spacing: 12) {
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
                .padding(.top, 12)
                .padding(.bottom, 32)
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

    private func rollen(_ leser: ScrollViewProxy) {
        guard !gerollt, let t = modell.tag(datum), !t.stunden.isEmpty else { return }
        gerollt = true
        let ziel = anker
        DispatchQueue.main.async {
            leser.scrollTo(ziel, anchor: .top)
        }
    }

    private var tageskopf: some View {
        let t = modell.tag(datum)
        return HStack(alignment: .lastTextBaseline, spacing: 8) {
            VStack(alignment: .leading, spacing: 1) {
                Text(Datumsformat.istHeute(datum) ? "Heute" : Datumsformat.anzeige(datum, "EEEE"))
                    .font(.title2.weight(.bold))
                    .foregroundStyle(Datumsformat.istHeute(datum) ? Farben.akzent : Farben.text)
                Text(Datumsformat.anzeige(datum, Datumsformat.istHeute(datum) ? "EEEE, d. MMMM" : "d. MMMM yyyy"))
                    .font(.subheadline)
                    .foregroundStyle(Farben.text2)
            }
            Spacer()
            if let t, !t.frei, !t.gesperrt, !t.stunden.isEmpty {
                HStack(spacing: 6) {
                    zahl("\(t.anzahlStunden)", "Std.", Farben.text2)
                    if t.anzahlAenderung > 0 { zahl("\(t.anzahlAenderung)", "Änd.", Farben.aenderung) }
                    if t.anzahlEntfall > 0 { zahl("\(t.anzahlEntfall)", "Entf.", Farben.entfall) }
                }
            }
        }
        .padding(.horizontal, Stilmass.rand)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }

    private func zahl(_ z: String, _ text: String, _ farbe: Color) -> some View {
        HStack(spacing: 3) {
            Text(z).font(.subheadline.weight(.bold)).monospacedDigit()
            Text(text).font(.caption)
        }
        .foregroundStyle(farbe)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Farben.flaeche, in: Capsule())
        .overlay { Capsule().strokeBorder(Farben.rand, lineWidth: 1) }
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
            ForEach(t.ganztags) { g in
                Button {
                    antippen(g, t, "ganz-\(g.id.uuidString)")
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
                            .font(.caption)
                    }
                    .foregroundStyle(Farben.termin)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 9)
                    .background(Farben.terminFlaeche, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .strokeBorder(Farben.termin.opacity(0.5), style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                    }
                    .zoomQuelle("ganz-\(g.id.uuidString)", in: raum)
                }
                .buttonStyle(KachelDruckStil())
                .padding(.horizontal, Stilmass.rand)
            }
            ForEach(Array((t.kopf?.hinweise ?? []).enumerated()), id: \.offset) { _, h in
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "info.circle")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Farben.frei)
                        .accessibilityHidden(true)
                    Text(h)
                        .font(.footnote)
                        .foregroundStyle(Farben.text)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(10)
                .background(Farben.freiFlaeche, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                .padding(.horizontal, Stilmass.rand)
                .accessibilityElement(children: .combine)
            }
            if t.istHeute && modell.istEigenerPlan && Jetztlage.berechnen(t.kacheln, minuten: Uhr.minuten()) != nil {
                JetztKarte(kacheln: t.kacheln, raum: raum) { k, quelle in antippen(k, t, quelle) }
                    .padding(.horizontal, Stilmass.rand)
            }
            if t.stunden.isEmpty && t.kacheln.isEmpty {
                Hinweisfeld(titel: "Kein Unterricht", text: t.istHeute ? "Heute ist kein Unterricht geplant." : "An diesem Tag ist kein Unterricht geplant.",
                            symbol: "sun.max", minHoehe: 140, flaeche: Farben.flaeche)
                    .padding(.horizontal, Stilmass.rand)
            } else {
                Zeitachse(tag: t, raum: raum, ankerID: anker) { k, quelle in antippen(k, t, quelle) }
                    .padding(.top, 4)
            }
        }
    }
}

/// Ferien bzw. unterrichtsfreier Tag: große Fläche in der Ferienfarbe.
struct FreiFlaeche: View {
    let titel: String
    let zeitraum: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: "sun.max")
                .font(.system(size: 30, weight: .regular))
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
        .padding(20)
        .frame(maxWidth: .infinity, minHeight: 200, alignment: .bottomLeading)
        .background(Farben.freiFlaeche, in: RoundedRectangle(cornerRadius: Stilmass.radius, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

/// Platzhalter, solange der Tag lädt: ruhige Blöcke statt Ladekreis.
struct Platzhaltertag: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(0..<5, id: \.self) { i in
                RoundedRectangle(cornerRadius: Stilmass.kachelRadius, style: .continuous)
                    .fill(Farben.neutralFlaeche)
                    .frame(height: i == 2 ? 36 : 64)
                    .opacity(i == 2 ? 0.5 : 1)
            }
        }
        .padding(.leading, Stilmass.zeitspalte)
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
