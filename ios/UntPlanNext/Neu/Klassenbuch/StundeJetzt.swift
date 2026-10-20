import SwiftUI

// „Stunde jetzt“: die Klassenbuch-Schnellerfassung für die laufende (bzw. nächste) eigene Stunde – ein Tippen von „Heute“.
// Die Seite ist der Reiter „Klassenbuch“ der Stundendetails (`KlassenbuchReiter`) mit Kopf; die Anwesenheit öffnet sich als
// Kontrolle bzw. als Schnellerfassung (`SchnellanwesenheitSeite`). Mit einer Hand bedienbar:
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

/// „Stunde jetzt“ (von „Heute“): dieselbe Seite wie der Reiter „Klassenbuch“ der Stundendetails (`KlassenbuchReiter`) mit
/// Kopf (Fach, Klasse, Raum, Fortschritt) – Thema, Anwesenheitskontrolle, Hausaufgaben, Prüfung, Einträge, Notizen, Verlauf.
struct StundeJetztSeite: View {
    let karte: Karte

    @EnvironmentObject var zustand: AppZustand
    @Environment(\.dismiss) private var schliessen
    @StateObject private var daten: Stundendaten

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

    var body: some View {
        NavigationStack {
            KlassenbuchReiter(karte: karte, daten: daten, mitKopf: true)
                .safeAreaInset(edge: .top, spacing: 0) {
                    if !daten.geladen {
                        Ladebalken(aktiv: true)
                    }
                }
                .navigationTitle("Stunde jetzt")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Fertig") {
                            Haptik.tippen()
                            Tastatur.schliessen()
                            schliessen()
                        }
                    }
                }
        }
        .environmentObject(daten)
    }
}

// MARK: - Schnellerfassung der Anwesenheit

/// Anwesenheit mit einer Hand: Liste mit Wischgesten (rechts = anwesend, links = abwesend, langes Drücken = verspätet mit
/// Minuten) oder Raster großer Namensfelder (Antippen schaltet um), Zähler und „Anwesenheit bestätigen“. Jede Änderung wird
/// sofort gespeichert (ohne Verbindung im Schreibpuffer).
struct SchnellanwesenheitSeite: View {
    let karte: Karte

    @EnvironmentObject var daten: Stundendaten
    @EnvironmentObject var zustand: AppZustand

    enum Ansicht: String, Hashable {
        case liste
        case raster
    }

    @AppStorage("stundeJetztAnsicht") private var ansichtRoh = Ansicht.liste.rawValue
    @State private var arbeitet: Set<Int> = []
    @State private var fehler: String? = nil
    @State private var meldung: String? = nil
    @State private var verspaetung: Schueler? = nil

    private var ansicht: Ansicht { Ansicht(rawValue: ansichtRoh) ?? .liste }
    private var liste: Anwesenheitsliste? { daten.anwesenheit }
    private var schueler: [Schueler] { liste?.schueler ?? [] }
    private var bedienbar: Bool { liste?.darf == true && karte.datum <= Datumsformat.iso(Date()) }

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

    var body: some View {
        List {
            if let fehler {
                Section {
                    Fehlerhinweis(text: fehler)
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                        .onTapGesture { self.fehler = nil }
                }
            }
            anwesenheitAbschnitt
        }
        .listStyle(.insetGrouped)
        .listSectionSpacing(.compact)
        .scrollContentBackground(.hidden)
        .background(Farben.grund.ignoresSafeArea())
        .overlay(alignment: .bottom) { meldungsToast }
        .navigationTitle("Anwesenheit")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
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
        }
        .refreshable { await daten.anwesenheitLaden() }
        .sheet(item: $verspaetung) { s in
            VerspaetungBlatt(name: s.anzeige) { minuten in
                verspaetung = nil
                setzen(s, .verspaetet(minuten))
            }
            .presentationDetents([.height(300)])
        }
    }

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
