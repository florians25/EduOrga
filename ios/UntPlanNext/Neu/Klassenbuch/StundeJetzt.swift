import SwiftUI

// „Stunde jetzt“: die Klassenbuch-Schnellerfassung für die laufende (bzw. nächste) eigene Stunde – ein Tippen von „Heute“.
// Alles auf einer Seite, mit einer Hand bedienbar:
// - Anwesenheit als Liste mit Wischgesten (rechts = anwesend, links = abwesend, langes Drücken = verspätet mit Minuten)
//   oder als Raster großer Namensfelder (Antippen schaltet anwesend/abwesend, langes Drücken = verspätet), Zähler und
//   „Anwesenheit bestätigen“.
// - Thema mit Vorschlägen aus den letzten Stunden („Fortsetzung: …“) und dem persönlichen Themenplan des Kurses.
// - Hausaufgabe mit Fälligkeit als Schnellwahl (nächste Stunde · in 1 Woche · Datum).
// - Klassenbucheinträge über Vorlagen (Material vergessen, Hausaufgabe fehlt, Lob …) für eine oder mehrere Personen.
// - Kursverlauf: Themen der letzten Wochen als Zeitleiste.
// Gleiche Endpunkte wie EduOrga Web (über `Stundendaten`); ohne Verbindung landet alles im Schreibpuffer und wird
// gesendet, sobald das Gerät wieder online ist. Haptische Rückmeldung bei jeder Erfassung.

// MARK: - Start von „Heute“

/// Auswahl der Stunde für „Stunde jetzt“: die laufende eigene Stunde mit Unterricht (ab 10 Minuten vor Beginn), sonst die
/// nächste heute, sonst die zuletzt beendete (bis 45 Minuten danach – zum Nachtragen).
enum StundeJetztWahl {
    static func ziel(_ kacheln: [Kachel], jetzt: Date = Date()) -> Kachel? {
        let m = Uhr.minuten(jetzt)
        let liste = kacheln.filter { k in
            guard let karte = k.karte, karte.unterricht != nil, !k.inPause, !karte.istVeranstaltung else { return false }
            return Statuslehre.findetStatt(k) && k.kartenart != .entfall
        }.sorted { $0.beginn < $1.beginn }
        if let laufend = liste.first(where: { $0.beginn - 10 <= m && m < $0.ende }) { return laufend }
        if let naechste = liste.first(where: { $0.beginn > m }) { return naechste }
        return liste.last { $0.ende <= m && m - $0.ende <= 45 }
    }
}

/// Knopf auf „Heute“: „Stunde jetzt · M 7a · R204“ öffnet die Schnellerfassung.
struct StundeJetztStarter: View {
    let kachel: Kachel
    let oeffnen: () -> Void

    private var untertitel: String {
        guard let k = kachel.karte else { return "" }
        let klassen = k.klassen.map { $0.k.isEmpty ? ($0.alt ?? "") : $0.k }.filter { !$0.isEmpty }.joined(separator: ", ")
        let raeume = k.raeume.map(\.k).filter { !$0.isEmpty }.joined(separator: ", ")
        return [k.fach, klassen, raeume].filter { !$0.isEmpty }.joined(separator: " · ")
    }

    private var zustandText: String {
        let m = Uhr.minuten()
        if kachel.beginn <= m && m < kachel.ende { return "läuft · noch \(Uhr.dauer(kachel.ende - m))" }
        if kachel.beginn > m { return "ab \(Uhr.uhrzeit(kachel.beginn))" }
        return "beendet \(Uhr.uhrzeit(kachel.ende)) · nachtragen"
    }

    var body: some View {
        Button {
            Haptik.fest()
            oeffnen()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "checklist.checked")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Farben.aufAkzent)
                    .frame(width: 40, height: 40)
                    .background(Farben.akzent, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Stunde jetzt erfassen")
                        .font(.headline)
                        .foregroundStyle(Farben.text)
                    Text(untertitel + " · " + zustandText)
                        .font(.subheadline)
                        .foregroundStyle(Farben.text2)
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
                }
                Spacer(minLength: 4)
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Farben.pfeil)
                    .accessibilityHidden(true)
            }
            .padding(12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .kartenflaeche()
        .accessibilityHint("Anwesenheit, Thema, Hausaufgabe und Einträge dieser Stunde")
    }
}

// MARK: - Seite

struct StundeJetztSeite: View {
    let karte: Karte

    @EnvironmentObject var zustand: AppZustand
    @Environment(\.dismiss) private var schliessen
    @StateObject private var daten: Stundendaten
    @ObservedObject private var puffer = Schreibpuffer.shared

    enum Ansicht: String, Hashable {
        case liste
        case raster
    }

    @AppStorage("stundeJetztAnsicht") private var ansichtRoh = Ansicht.liste.rawValue
    @State private var arbeitet: Set<Int> = []
    @State private var fehler: String? = nil
    @State private var meldung: String? = nil
    @State private var verspaetung: Schueler? = nil
    @State private var vorlage: Eintragsvorlage? = nil
    // Thema
    @State private var thema = ""
    @State private var themaUebernommen = false
    @State private var themaSpeichert = false
    @State private var vorstunden: [Vorstundenthema] = []
    @State private var plan: [String] = []
    @State private var planOffen = false
    // Hausaufgabe
    @State private var hausaufgabe = ""
    @State private var faelligWahl: Faelligkeit = .naechsteStunde
    @State private var faelligDatum = Date()
    @State private var naechsteStunde: Date? = nil
    @State private var hausaufgabeSpeichert = false
    @FocusState private var fokus: Feld?

    enum Feld: Hashable {
        case thema
        case hausaufgabe
    }

    /// Vorlage eines Klassenbucheintrags (Art und Text) für das Blatt.
    struct Eintragsvorlage: Identifiable {
        let id = UUID()
        let art: String
        let text: String
        var schueler: [Schueler] = []
    }

    /// Schnellvorlagen für Klassenbucheinträge (die Art wird auf die Kategorien der Schule abgebildet).
    struct Schnellvorlage: Hashable {
        let titel: String
        let art: String
        let text: String
    }

    static let vorlagen: [Schnellvorlage] = [
        Schnellvorlage(titel: "Material vergessen", art: "Material vergessen", text: "Material vergessen"),
        Schnellvorlage(titel: "Hausaufgabe fehlt", art: "Hausaufgabe fehlt", text: "Hausaufgabe nicht erledigt"),
        Schnellvorlage(titel: "Lob", art: "Lob", text: "Sehr gute Mitarbeit"),
        Schnellvorlage(titel: "Störung", art: "Vermerk", text: "Wiederholte Störung des Unterrichts"),
        Schnellvorlage(titel: "Handy", art: "Vermerk", text: "Handy im Unterricht benutzt"),
        Schnellvorlage(titel: "Elterngespräch", art: "Elterngespräch", text: "Elterngespräch vereinbart"),
    ]

    /// Mit vorhandenen Stundendaten (aus den Stundendetails) bzw. neu für die Karte.
    init(karte: Karte, daten: Stundendaten? = nil) {
        self.karte = karte
        _daten = StateObject(wrappedValue: daten ?? Stundendaten(karte: karte))
    }

    private var ansicht: Ansicht { Ansicht(rawValue: ansichtRoh) ?? .liste }
    private var liste: Anwesenheitsliste? { daten.anwesenheit }
    private var schueler: [Schueler] { liste?.schueler ?? [] }
    private var bedienbar: Bool { liste?.darf == true && karte.datum <= Datumsformat.iso(Date()) }

    private var klassenText: String {
        daten.klassen.joined(separator: ", ")
    }

    private var zaehler: (da: Int, fehlt: Int, spaet: Int) {
        var fehlt = 0
        var spaet = 0
        for s in schueler {
            switch daten.stand(s) {
            case .anwesend: break
            case .abwesend: fehlt += 1
            case .verspaetet, .vorzeitig: spaet += 1
            }
        }
        return (schueler.count - fehlt - spaet, fehlt, spaet)
    }

    private var behandelt: [String] {
        vorstunden.map(\.thema) + [thema]
    }

    // MARK: Ansicht

    var body: some View {
        NavigationStack {
            List {
                kopfAbschnitt
                if puffer.anzahl > 0 {
                    Section {
                        SchreibpufferLeiste()
                            .listRowInsets(EdgeInsets())
                            .listRowBackground(Color.clear)
                    }
                }
                if let fehler {
                    Section {
                        Fehlerhinweis(text: fehler)
                            .listRowInsets(EdgeInsets())
                            .listRowBackground(Color.clear)
                            .onTapGesture { self.fehler = nil }
                    }
                }
                anwesenheitAbschnitt
                themaAbschnitt
                hausaufgabeAbschnitt
                eintragAbschnitt
                verlaufAbschnitt
            }
            .listStyle(.insetGrouped)
            .listSectionSpacing(.compact)
            .scrollDismissesKeyboard(.interactively)
            .background(Farben.grund.ignoresSafeArea())
            .safeAreaInset(edge: .top, spacing: 0) {
                if !daten.geladen {
                    Ladebalken(aktiv: true)
                }
            }
            .overlay(alignment: .bottom) { meldungsToast }
            .navigationTitle("Stunde jetzt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fertig") {
                        Haptik.tippen()
                        schliessen()
                    }
                }
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Fertig") { fokus = nil }
                }
            }
            .refreshable {
                await daten.laden(kollegium: true)
                await vorschlaegeLaden()
            }
            .task {
                if !daten.geladen { await daten.laden(kollegium: true) }
                themaUebernehmen()
                if let u = karte.unterricht { plan = Themenplan.laden(u) }
                await vorschlaegeLaden()
                await naechsteStundeSuchen()
            }
            .onChange(of: daten.geladen) { _, _ in themaUebernehmen() }
            .sheet(item: $verspaetung) { s in
                VerspaetungBlatt(name: s.anzeige) { minuten in
                    verspaetung = nil
                    setzen(s, .verspaetet(minuten))
                }
                .presentationDetents([.height(300)])
            }
            .sheet(item: $vorlage) { v in
                EintragVorlageBlatt(vorlage: v, schueler: schueler, arten: daten.vermerkArten) { auswahl, art, text in
                    vorlage = nil
                    eintragSpeichern(auswahl, art: art, text: text)
                }
                .presentationDetents([.medium, .large])
            }
            .sheet(isPresented: $planOffen) {
                ThemenplanBlatt(themen: plan, behandelt: behandelt) { neu in
                    plan = neu
                    if let u = karte.unterricht { Themenplan.speichern(neu, unterricht: u) }
                }
                .presentationDetents([.medium, .large])
            }
        }
        .environmentObject(daten)
    }

    // MARK: Kopf

    private var kopfAbschnitt: some View {
        Section {
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(karte.fachName.isEmpty ? karte.fach : karte.fachName)
                        .font(.title3.weight(.bold))
                        .foregroundStyle(Farben.text)
                        .lineLimit(1)
                    if !klassenText.isEmpty {
                        Text(klassenText)
                            .font(.headline)
                            .foregroundStyle(Farben.text2)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 4)
                    let raeume = daten.aktuelleRaeume.map(\.k).filter { !$0.isEmpty }.joined(separator: ", ")
                    if !raeume.isEmpty {
                        Text(raeume)
                            .font(.subheadline.weight(.semibold))
                            .monospacedDigit()
                            .foregroundStyle(Farben.text)
                    }
                }
                Text("\(kurzdatum(karte.datum)) · \(daten.bereichText) · \(karte.beginn)–\(karte.ende)")
                    .font(.subheadline)
                    .monospacedDigit()
                    .foregroundStyle(Farben.text2)
                fortschritt
            }
            .padding(.vertical, 2)
            .accessibilityElement(children: .combine)
        }
    }

    /// Fortschritt der Stunde (nur heute während der Stunde).
    @ViewBuilder
    private var fortschritt: some View {
        if Datumsformat.istHeute(karte.datum), let b = Rasterzeit.minuten(karte.beginn), let e = Rasterzeit.minuten(karte.ende), e > b {
            TimelineView(.periodic(from: .now, by: 30)) { kontext in
                let m = Uhr.minuten(kontext.date)
                if m >= b && m < e {
                    VStack(alignment: .leading, spacing: 3) {
                        ProgressView(value: Double(m - b), total: Double(e - b))
                            .tint(Farben.akzent)
                        Text("noch \(Uhr.dauer(e - m))")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Farben.akzent)
                    }
                }
            }
        }
    }

    // MARK: Anwesenheit

    @ViewBuilder
    private var anwesenheitAbschnitt: some View {
        Section {
            if liste == nil {
                HStack {
                    Spacer()
                    if daten.geladen {
                        Text("Anwesenheit nicht verfügbar.")
                            .foregroundStyle(Farben.text2)
                    } else {
                        ProgressView()
                    }
                    Spacer()
                }
            } else if schueler.isEmpty {
                Text("Für diese Klasse wurde keine Schülerliste übertragen.")
                    .foregroundStyle(Farben.text2)
            } else {
                anwesenheitKopf
                if ansicht == .raster {
                    namensraster
                        .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))
                } else {
                    ForEach(schueler) { s in
                        schuelerZeile(s)
                    }
                }
                if bedienbar {
                    Button {
                        bestaetigen()
                    } label: {
                        Label(liste?.kontrolliert == true ? "Anwesenheit erneut bestätigen" : "Anwesenheit bestätigen",
                              systemImage: "checkmark.seal")
                            .font(.body.weight(.semibold))
                    }
                }
            }
        } header: {
            HStack {
                Text("Anwesenheit")
                Spacer()
                if !schueler.isEmpty {
                    Picker("Darstellung", selection: $ansichtRoh) {
                        Image(systemName: "list.bullet").tag(Ansicht.liste.rawValue)
                        Image(systemName: "square.grid.3x3").tag(Ansicht.raster.rawValue)
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 96)
                    .accessibilityLabel("Darstellung der Anwesenheit")
                }
            }
        } footer: {
            if bedienbar && !schueler.isEmpty {
                Text(ansicht == .liste
                     ? "Nach rechts wischen: anwesend · nach links: abwesend · lange drücken: verspätet. Jede Änderung wird sofort gespeichert."
                     : "Antippen: anwesend ↔ abwesend · lange drücken: verspätet. Jede Änderung wird sofort gespeichert.")
            } else if !bedienbar && liste != nil {
                Text("Anwesenheit nur in eigenen Stunden ab dem Tag der Stunde.")
            }
        }
    }

    private var anwesenheitKopf: some View {
        let z = zaehler
        return HStack(spacing: 8) {
            zahlFeld(z.da, "da", Farben.ok)
            zahlFeld(z.fehlt, "fehlen", Farben.entfall)
            zahlFeld(z.spaet, "verspätet", Farben.warnung)
            Spacer(minLength: 0)
            if liste?.kontrolliert == true {
                Label("kontrolliert", systemImage: "checkmark.seal.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Farben.ok)
                    .labelStyle(.titleAndIcon)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private func zahlFeld(_ zahl: Int, _ text: String, _ farbe: Color) -> some View {
        HStack(spacing: 3) {
            Text("\(zahl)")
                .font(.subheadline.weight(.bold))
                .monospacedDigit()
            Text(text)
                .font(.caption)
        }
        .foregroundStyle(zahl > 0 ? farbe : Farben.text3)
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background((zahl > 0 ? farbe : Farben.text3).opacity(0.1), in: Capsule())
    }

    private func schuelerZeile(_ s: Schueler) -> some View {
        let stand = daten.stand(s)
        return HStack(spacing: 12) {
            Image(systemName: stand.symbol)
                .font(.title3)
                .foregroundStyle(stand == .anwesend ? Farben.ok.opacity(0.55) : stand.farbe)
                .frame(width: 26)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 1) {
                Text(s.anzeige)
                    .font(.body)
                    .foregroundStyle(Farben.text)
                    .strikethrough(stand == .abwesend, color: Farben.entfall.opacity(0.6))
                if stand != .anwesend {
                    Text(stand.text)
                        .font(.caption)
                        .foregroundStyle(stand.farbe)
                } else if daten.inVorstundeAbwesend(s) {
                    Text("in der Vorstunde abwesend")
                        .font(.caption)
                        .foregroundStyle(Farben.warnung)
                }
            }
            Spacer(minLength: 4)
            if arbeitet.contains(s.id) {
                ProgressView()
                    .controlSize(.small)
            }
        }
        .padding(.vertical, 1)
        .contentShape(Rectangle())
        .onTapGesture { umschalten(s) }
        .onLongPressGesture(minimumDuration: 0.45) {
            guard bedienbar else { return }
            Haptik.fest()
            verspaetung = s
        }
        .swipeActions(edge: .leading, allowsFullSwipe: true) {
            if bedienbar {
                Button {
                    setzen(s, .anwesend)
                } label: {
                    Label("Anwesend", systemImage: "checkmark")
                }
                .tint(Farben.ok)
            }
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            if bedienbar {
                Button {
                    setzen(s, .abwesend)
                } label: {
                    Label("Abwesend", systemImage: "xmark")
                }
                .tint(Farben.entfall)
                Button {
                    verspaetung = s
                } label: {
                    Label("Verspätet", systemImage: "clock")
                }
                .tint(Farben.warnung)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(s.anzeige), \(stand.text)")
        .accessibilityAction(named: "Anwesend") { setzen(s, .anwesend) }
        .accessibilityAction(named: "Abwesend") { setzen(s, .abwesend) }
        .accessibilityAction(named: "Verspätet") { verspaetung = s }
    }

    /// Raster großer Namensfelder (schnell wie ein Sitzplan): Antippen schaltet um, langes Drücken = verspätet.
    private var namensraster: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 98), spacing: 8)], spacing: 8) {
            ForEach(schueler) { s in
                namensfeld(s)
            }
        }
    }

    private func namensfeld(_ s: Schueler) -> some View {
        let stand = daten.stand(s)
        let farbe: Color = stand == .anwesend ? Farben.ok : stand.farbe
        let form = RoundedRectangle(cornerRadius: 8, style: .continuous)
        return VStack(spacing: 2) {
            Text(s.vorname.isEmpty ? s.anzeige : s.vorname)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(stand == .abwesend ? Farben.entfall : Farben.text)
                .strikethrough(stand == .abwesend, color: Farben.entfall.opacity(0.7))
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            Text(stand == .anwesend ? (s.name.isEmpty ? " " : s.name) : stand.text)
                .font(.caption2)
                .foregroundStyle(stand == .anwesend ? Farben.text3 : farbe)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .padding(.horizontal, 6)
        .frame(maxWidth: .infinity, minHeight: 52)
        .background(stand == .anwesend ? Farben.flaeche : farbe.opacity(0.12), in: form)
        .overlay {
            form.strokeBorder(stand == .anwesend ? Farben.rand : farbe.opacity(0.7), lineWidth: stand == .anwesend ? 1 : 1.5)
        }
        .overlay(alignment: .topTrailing) {
            if arbeitet.contains(s.id) {
                ProgressView()
                    .controlSize(.mini)
                    .padding(4)
            } else if daten.inVorstundeAbwesend(s) {
                Circle()
                    .fill(Farben.warnung)
                    .frame(width: 7, height: 7)
                    .padding(5)
            }
        }
        .contentShape(form)
        .onTapGesture { umschalten(s) }
        .onLongPressGesture(minimumDuration: 0.45) {
            guard bedienbar else { return }
            Haptik.fest()
            verspaetung = s
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(s.anzeige), \(stand.text)")
        .accessibilityAddTraits(.isButton)
        .accessibilityHint("Antippen schaltet zwischen anwesend und abwesend")
        .accessibilityAction(named: "Verspätet") { verspaetung = s }
    }

    // MARK: Thema

    @ViewBuilder
    private var themaAbschnitt: some View {
        if daten.darf {
            Section {
                TextField("Thema der Stunde", text: $thema, axis: .vertical)
                    .lineLimit(1...4)
                    .focused($fokus, equals: .thema)
                    .submitLabel(.done)
                let vorschlaege = themenVorschlaege
                if !vorschlaege.isEmpty {
                    ScrollView(.horizontal) {
                        HStack(spacing: 6) {
                            ForEach(vorschlaege, id: \.self) { v in
                                Vorschlagsfeld(text: v.anzeige, symbol: v.symbol) {
                                    Haptik.auswahl()
                                    thema = v.uebernahme
                                }
                            }
                        }
                        .padding(.vertical, 2)
                    }
                    .scrollIndicators(.hidden)
                    .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                }
                Button {
                    Task { await themaSpeichern() }
                } label: {
                    HStack {
                        Label("Thema speichern", systemImage: "square.and.arrow.down")
                            .font(.body.weight(.semibold))
                        Spacer()
                        if themaSpeichert { ProgressView() }
                    }
                }
                .disabled(themaSpeichert || thema.trimmingCharacters(in: .whitespacesAndNewlines) == (daten.eintrag?.thema ?? "").trimmingCharacters(in: .whitespacesAndNewlines))
            } header: {
                HStack {
                    Text("Thema")
                    Spacer()
                    Button {
                        planOffen = true
                    } label: {
                        Text(plan.isEmpty ? "Themenplan anlegen" : "Themenplan")
                            .font(.footnote.weight(.semibold))
                            .textCase(nil)
                    }
                }
            } footer: {
                if let v = vorstunden.first {
                    Text("Zuletzt (\(kurzdatum(v.datum))): \(v.thema)")
                        .lineLimit(2)
                }
            }
        }
    }

    /// Vorschlag für das Thema.
    struct Themenvorschlag: Hashable {
        let anzeige: String
        let uebernahme: String
        let symbol: String
    }

    /// Vorschläge: Fortsetzung der letzten Stunde, die nächsten Themen des Themenplans, weitere frühere Themen.
    private var themenVorschlaege: [Themenvorschlag] {
        var liste: [Themenvorschlag] = []
        func hinzu(_ v: Themenvorschlag) {
            guard !v.uebernahme.isEmpty, !liste.contains(where: { $0.uebernahme.caseInsensitiveCompare(v.uebernahme) == .orderedSame }) else { return }
            liste.append(v)
        }
        for t in Themenplan.naechste(plan, behandelt: vorstunden.map(\.thema)) {
            hinzu(Themenvorschlag(anzeige: t, uebernahme: t, symbol: "list.number"))
        }
        if let letzte = vorstunden.first {
            hinzu(Themenvorschlag(anzeige: "Fortsetzung: \(letzte.thema)", uebernahme: "Fortsetzung: \(letzte.thema)", symbol: "arrow.turn.down.right"))
        }
        for v in vorstunden.prefix(4) {
            hinzu(Themenvorschlag(anzeige: v.thema, uebernahme: v.thema, symbol: "clock.arrow.circlepath"))
        }
        return liste
    }

    // MARK: Hausaufgabe

    @ViewBuilder
    private var hausaufgabeAbschnitt: some View {
        if daten.darf {
            Section {
                ForEach(daten.hausaufgaben?.liste ?? []) { h in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(h.text)
                            .foregroundStyle(Farben.text)
                        if let f = h.faellig, !f.isEmpty {
                            Text("fällig \(kurzdatum(String(f.prefix(10))))")
                                .font(.caption)
                                .foregroundStyle(Farben.text2)
                        }
                    }
                }
                TextField("Neue Hausaufgabe", text: $hausaufgabe, axis: .vertical)
                    .lineLimit(1...4)
                    .focused($fokus, equals: .hausaufgabe)
                ScrollView(.horizontal) {
                    HStack(spacing: 6) {
                        faelligFeld(.naechsteStunde, naechsteStunde.map { "Nächste Stunde (\(kurzdatum(Datumsformat.iso($0))))" } ?? "Nächste Stunde")
                        faelligFeld(.eineWoche, "In 1 Woche")
                        faelligFeld(.datum, "Datum …")
                        faelligFeld(.keine, "Ohne Termin")
                    }
                    .padding(.vertical, 2)
                }
                .scrollIndicators(.hidden)
                .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                if faelligWahl == .datum {
                    DatePicker("Fällig am", selection: $faelligDatum, in: Date()..., displayedComponents: .date)
                }
                Button {
                    Task { await hausaufgabeSpeichern() }
                } label: {
                    HStack {
                        Label("Hausaufgabe eintragen", systemImage: "plus.circle")
                            .font(.body.weight(.semibold))
                        Spacer()
                        if hausaufgabeSpeichert { ProgressView() }
                    }
                }
                .disabled(hausaufgabeSpeichert || hausaufgabe.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            } header: {
                Text("Hausaufgabe")
            }
        }
    }

    private func faelligFeld(_ wahl: Faelligkeit, _ text: String) -> some View {
        let gewaehlt = faelligWahl == wahl
        return Button {
            Haptik.auswahl()
            faelligWahl = wahl
        } label: {
            Text(text)
                .font(.footnote.weight(.semibold))
                .lineLimit(1)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .foregroundStyle(gewaehlt ? Farben.aufAkzent : Farben.text)
                .background(gewaehlt ? Farben.akzent : Farben.neutralFlaeche, in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(gewaehlt ? .isSelected : [])
    }

    private var faelligAm: Date? {
        let tag = Datumsformat.datum(karte.datum) ?? Date()
        switch faelligWahl {
        case .naechsteStunde: return naechsteStunde ?? Datumsformat.tage(7, nach: tag)
        case .eineWoche: return Datumsformat.tage(7, nach: tag)
        case .datum: return faelligDatum
        case .keine: return nil
        }
    }

    // MARK: Einträge

    @ViewBuilder
    private var eintragAbschnitt: some View {
        if !daten.klassen.isEmpty {
            Section {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 130), spacing: 8)], spacing: 8) {
                    ForEach(StundeJetztSeite.vorlagen, id: \.self) { v in
                        Button {
                            Haptik.tippen()
                            vorlage = Eintragsvorlage(art: kategorie(v.art), text: v.text)
                        } label: {
                            Text(v.titel)
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(Farben.text)
                                .lineLimit(1)
                                .frame(maxWidth: .infinity, minHeight: 34)
                                .background(Farben.neutralFlaeche, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 4)
                Button {
                    vorlage = Eintragsvorlage(art: daten.vermerkArten.first ?? "Vermerk", text: "")
                } label: {
                    Label("Eigener Eintrag …", systemImage: "square.and.pencil")
                }
            } header: {
                HStack {
                    Text("Klassenbucheinträge")
                    Spacer()
                    if daten.geladen {
                        Text("heute \(daten.vermerke.count)")
                            .font(.footnote)
                            .textCase(nil)
                    }
                }
            } footer: {
                Text("Vorlage antippen, Schüler*innen wählen, speichern – ohne Verbindung wird der Eintrag später gesendet.")
            }
        }
    }

    /// Art einer Vorlage auf die Kategorien der Schule abbilden (sonst „Vermerk“ bzw. die erste Kategorie).
    private func kategorie(_ art: String) -> String {
        let arten = daten.vermerkArten
        if let a = arten.first(where: { $0.caseInsensitiveCompare(art) == .orderedSame }) { return a }
        if let a = arten.first(where: { $0.caseInsensitiveCompare("Vermerk") == .orderedSame }) { return a }
        return arten.first ?? art
    }

    // MARK: Verlauf

    private var verlaufAbschnitt: some View {
        Section {
            NavigationLink {
                KursverlaufSeite(karte: karte, themenplan: plan)
                    .environmentObject(zustand)
            } label: {
                Label("Kursverlauf (Themen der letzten Wochen)", systemImage: "chart.bar.doc.horizontal")
            }
        }
    }

    // MARK: Meldung

    @ViewBuilder
    private var meldungsToast: some View {
        if let meldung {
            Text(meldung)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Farben.flaeche)
                .lineLimit(2)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Farben.text, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                .padding(.bottom, 24)
                .transition(.opacity)
                .task(id: meldung) {
                    try? await Task.sleep(nanoseconds: 2_000_000_000)
                    withAnimation { self.meldung = nil }
                }
        }
    }

    private func melden(_ text: String) {
        withAnimation { meldung = daten.hinweis ?? text }
        daten.hinweis = nil
    }

    // MARK: Aktionen

    private func umschalten(_ s: Schueler) {
        guard bedienbar else { return }
        setzen(s, daten.stand(s) == .anwesend ? .abwesend : .anwesend)
    }

    private func setzen(_ s: Schueler, _ neu: Anwesenheitsstand) {
        guard bedienbar, !arbeitet.contains(s.id) else { return }
        guard daten.stand(s) != neu else { return }
        switch neu {
        case .anwesend: Haptik.auswahl()
        case .abwesend: Haptik.warnung()
        case .verspaetet, .vorzeitig: Haptik.tippen()
        }
        arbeitet.insert(s.id)
        Task {
            do {
                switch neu {
                case .anwesend: try await daten.anwesendSetzen(s)
                case .abwesend: try await daten.abwesendSetzen(s)
                case .verspaetet(let m): try await daten.verspaetetSetzen(s, minuten: m)
                case .vorzeitig: break
                }
                if let h = daten.hinweis { melden(h) }
            } catch {
                Haptik.fehler()
                fehler = error.localizedDescription
            }
            arbeitet.remove(s.id)
        }
    }

    private func bestaetigen() {
        Task {
            do {
                try await daten.kontrolleBestaetigen()
                Haptik.erfolg()
                melden("Anwesenheit bestätigt")
            } catch ApiFehler.nichtErreichbar(_) {
                Haptik.fehler()
                fehler = "Ohne Verbindung kann die Kontrolle nicht bestätigt werden – die einzelnen Änderungen sind gespeichert."
            } catch {
                Haptik.fehler()
                fehler = error.localizedDescription
            }
        }
    }

    private func themaUebernehmen() {
        guard !themaUebernommen, daten.geladen else { return }
        themaUebernommen = true
        if thema.isEmpty { thema = daten.eintrag?.thema ?? "" }
    }

    private func themaSpeichern() async {
        let text = thema.trimmingCharacters(in: .whitespacesAndNewlines)
        themaSpeichert = true
        defer { themaSpeichert = false }
        do {
            try await daten.speichern(thema: text)
            fokus = nil
            Haptik.erfolg()
            melden("Thema gespeichert")
        } catch {
            Haptik.fehler()
            fehler = error.localizedDescription
        }
    }

    private func hausaufgabeSpeichern() async {
        let text = hausaufgabe.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        hausaufgabeSpeichert = true
        defer { hausaufgabeSpeichert = false }
        do {
            try await daten.hausaufgabeAnlegen(text: text, faellig: faelligAm, bemerkung: "")
            hausaufgabe = ""
            fokus = nil
            Haptik.erfolg()
            melden("Hausaufgabe eingetragen")
        } catch {
            Haptik.fehler()
            fehler = error.localizedDescription
        }
    }

    private func eintragSpeichern(_ auswahl: [Schueler], art: String, text: String) {
        Task {
            do {
                try await daten.vermerkAnlegen(schueler: auswahl, art: art, text: text)
                Haptik.erfolg()
                melden(auswahl.count > 1 ? "\(auswahl.count) Einträge gespeichert" : "Eintrag gespeichert")
            } catch {
                Haptik.fehler()
                fehler = error.localizedDescription
            }
        }
    }

    private func vorschlaegeLaden() async {
        guard let u = karte.unterricht else { return }
        if let liste = try? await zustand.api.lehrstoffVorstunden(datum: karte.datum, stunde: karte.von, unterricht: u,
                                                                 lehrer: daten.lehrerHinweis) {
            vorstunden = liste
        }
    }

    /// Datum der nächsten Stunde desselben Unterrichts im eigenen Plan (diese und die zwei folgenden Wochen).
    private func naechsteStundeSuchen() async {
        guard naechsteStunde == nil, let u = karte.unterricht, let tag = Datumsformat.datum(karte.datum) else { return }
        let typ = (zustand.benutzer?.typ ?? "").isEmpty ? "lehrer" : (zustand.benutzer?.typ ?? "lehrer")
        let element = zustand.benutzer?.element ?? ""
        guard !element.isEmpty else { return }
        for versatz in [0, 7, 14] {
            let d = Datumsformat.tage(versatz, nach: tag)
            guard let p = try? await zustand.api.plan(typ: typ, element: element, datum: d) else { continue }
            let treffer = p.karten
                .filter { $0.unterricht == u && !$0.istEntfall && $0.datum > karte.datum }
                .map(\.datum)
                .sorted()
                .first
            if let t = treffer, let datum = Datumsformat.datum(t) {
                naechsteStunde = datum
                return
            }
        }
    }
}

// MARK: - Bausteine

/// Vorschlag als Feld (Thema übernehmen).
struct Vorschlagsfeld: View {
    let text: String
    let symbol: String
    let waehlen: () -> Void

    var body: some View {
        Button(action: waehlen) {
            HStack(spacing: 4) {
                Image(systemName: symbol)
                    .font(.caption2.weight(.semibold))
                    .accessibilityHidden(true)
                Text(text)
                    .font(.footnote)
                    .lineLimit(1)
            }
            .foregroundStyle(Farben.akzent)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .frame(maxWidth: 260)
            .background(Farben.primaerFlaeche, in: Capsule())
            .overlay { Capsule().strokeBorder(Farben.primaerRand, lineWidth: 0.5) }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Thema übernehmen: \(text)")
    }
}

/// Verspätung mit Minuten (Schnellwahl und Feineinstellung).
struct VerspaetungBlatt: View {
    let name: String
    let setzen: (Int) -> Void

    @Environment(\.dismiss) private var schliessen
    @State private var minuten = 10

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 64), spacing: 8)], spacing: 8) {
                    ForEach([5, 10, 15, 20, 30, 45], id: \.self) { m in
                        Button {
                            Haptik.auswahl()
                            setzen(m)
                        } label: {
                            Text("\(m) Min.")
                                .font(.subheadline.weight(.semibold))
                                .monospacedDigit()
                                .frame(maxWidth: .infinity, minHeight: 40)
                                .foregroundStyle(Farben.warnung)
                                .background(Farben.warnungFlaeche, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                }
                Stepper(value: $minuten, in: 1...90) {
                    Text("\(minuten) Minuten")
                        .monospacedDigit()
                }
                Button {
                    Haptik.auswahl()
                    setzen(minuten)
                } label: {
                    Text("\(minuten) Minuten verspätet eintragen")
                        .font(.body.weight(.semibold))
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(Farben.akzent)
            }
            .padding(16)
            .navigationTitle(name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { schliessen() }
                }
            }
        }
    }
}

/// Klassenbucheintrag aus einer Vorlage: Art, Text und Schüler*innen (keine Auswahl = Eintrag für die Klasse).
struct EintragVorlageBlatt: View {
    let vorlage: StundeJetztSeite.Eintragsvorlage
    let schueler: [Schueler]
    let arten: [String]
    let speichern: ([Schueler], String, String) -> Void

    @Environment(\.dismiss) private var schliessen
    @State private var art = ""
    @State private var text = ""
    @State private var gewaehlt: Set<Int> = []
    @State private var bereit = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Picker("Art", selection: $art) {
                        ForEach(artenListe, id: \.self) { a in
                            Text(a).tag(a)
                        }
                    }
                    TextField("Text", text: $text, axis: .vertical)
                        .lineLimit(1...5)
                }
                Section {
                    ForEach(schueler) { s in
                        Button {
                            Haptik.auswahl()
                            if gewaehlt.contains(s.id) { gewaehlt.remove(s.id) } else { gewaehlt.insert(s.id) }
                        } label: {
                            HStack {
                                Text(s.anzeige)
                                    .foregroundStyle(Farben.text)
                                Spacer()
                                if gewaehlt.contains(s.id) {
                                    Image(systemName: "checkmark")
                                        .font(.body.weight(.semibold))
                                        .foregroundStyle(Farben.akzent)
                                }
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(gewaehlt.contains(s.id) ? .isSelected : [])
                    }
                } header: {
                    Text(gewaehlt.isEmpty ? "Für die Klasse (niemand gewählt)" : "\(gewaehlt.count) gewählt")
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Klassenbucheintrag")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { schliessen() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Speichern") {
                        let auswahl = schueler.filter { gewaehlt.contains($0.id) }
                        speichern(auswahl, art, text.trimmingCharacters(in: .whitespacesAndNewlines))
                    }
                    .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || art.isEmpty)
                }
            }
            .onAppear {
                guard !bereit else { return }
                bereit = true
                art = vorlage.art
                text = vorlage.text
                gewaehlt = Set(vorlage.schueler.map(\.id))
            }
        }
    }

    private var artenListe: [String] {
        var liste = arten
        if !vorlage.art.isEmpty && !liste.contains(vorlage.art) { liste.insert(vorlage.art, at: 0) }
        if liste.isEmpty { liste = ["Vermerk"] }
        return liste
    }
}

/// Persönlicher Themenplan des Kurses: eine Zeile je Thema; behandelte Themen sind abgehakt.
struct ThemenplanBlatt: View {
    let themen: [String]
    let behandelt: [String]
    let speichern: ([String]) -> Void

    @Environment(\.dismiss) private var schliessen
    @State private var text = ""
    @State private var bereit = false

    private var zeilen: [String] {
        text.split(separator: "\n").map { String($0).trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    TextEditor(text: $text)
                        .frame(minHeight: 160)
                        .font(.body)
                } header: {
                    Text("Themen (eine Zeile je Thema)")
                } footer: {
                    Text("Der Themenplan bleibt auf diesem Gerät. „Stunde jetzt“ schlägt das nächste noch nicht behandelte Thema vor.")
                }
                if !zeilen.isEmpty {
                    Section("Stand") {
                        ForEach(Array(zeilen.enumerated()), id: \.offset) { i, t in
                            let fertig = Themenplan.behandelt(t, in: behandelt)
                            HStack(spacing: 10) {
                                Image(systemName: fertig ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(fertig ? Farben.ok : Farben.text3)
                                    .accessibilityHidden(true)
                                Text("\(i + 1). \(t)")
                                    .foregroundStyle(fertig ? Farben.text2 : Farben.text)
                            }
                            .accessibilityLabel("\(t), \(fertig ? "behandelt" : "offen")")
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Themenplan")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { schliessen() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Sichern") {
                        speichern(zeilen)
                        Haptik.erfolg()
                        schliessen()
                    }
                }
            }
            .onAppear {
                guard !bereit else { return }
                bereit = true
                text = themen.joined(separator: "\n")
            }
        }
    }
}
