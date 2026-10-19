import QuickLook
import SwiftUI

// Klassenbuch im Reiter „Schule“ (Lehrkräfte): offene Stunden, Klassenbucheinträge, Hausaufgaben, Klassendienste und
// Befreiungen – mit denselben Endpunkten wie EduOrga Web (web/client/src/pages/klassenbuch/…).

// MARK: - Offene Stunden

/// Offene Stunden: gehaltene Stunden ohne Abwesenheitskontrolle bzw. Lehrstoff im gewählten Zeitbereich (gespeichert
/// wie im Web). Antippen öffnet die Stunde mit dem Klassenbuch; Wischen „Lehrstoff“ trägt ihn direkt ein (offline
/// gepuffert). Klassenleitungen können die Stunden ihrer Klasse ansehen.
struct OffeneStundenView: View {
    let antippen: (Karte) -> Void
    @EnvironmentObject var zustand: AppZustand
    @Namespace private var zoom
    @State private var antwort: OffeneStundenAntwort? = nil
    @State private var filter = "offen"
    @State private var fehler: String? = nil
    @State private var laedt = false
    @State private var klasse = ""
    @State private var wahl: Stundenwahl? = nil
    @State private var lehrstoff: OffeneStunde? = nil

    init(antippen: @escaping (Karte) -> Void) {
        self.antippen = antippen
    }

    private var zeilen: [OffeneStunde] {
        let alle = antwort?.zeilen ?? []
        switch filter {
        case "kontrolle": return alle.filter { !$0.geprueft }
        case "lehrstoff": return alle.filter { !$0.lehrstoff }
        case "alle": return alle
        default: return alle.filter { !$0.geprueft || !$0.lehrstoff }
        }
    }

    private var tage: [(String, [OffeneStunde])] {
        let gruppen = Dictionary(grouping: zeilen, by: \.datum)
        return gruppen.keys.sorted(by: >).map { ($0, (gruppen[$0] ?? []).sorted { $0.von < $1.von }) }
    }

    var body: some View {
        List {
            SchreibpufferLeiste()
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            if let a = antwort {
                Section {
                    uebersicht(a)
                    Picker("Zeitbereich", selection: Binding(get: { a.bereich }, set: { neu in Task { await bereichSetzen(neu) } })) {
                        ForEach(a.bereiche.filter { $0.id != "individuell" }) { b in
                            Text(b.text).tag(b.id)
                        }
                        if a.bereich == "individuell" { Text("Individuell").tag("individuell") }
                    }
                    if !a.klassenleitung.isEmpty || a.alle {
                        KlassenFeld(klasse: $klasse, titel: "Alle Stunden der Klasse", alleErlaubt: true)
                    }
                    Segmentschalter(auswahl: $filter, [("offen", "Offen"), ("kontrolle", "Kontrolle"), ("lehrstoff", "Lehrstoff"), ("alle", "Alle")])
                }
            }
            if let fehler {
                Section { Fehlerhinweis(text: fehler) }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }
            if antwort != nil && zeilen.isEmpty {
                LeereListe(titel: (antwort?.gesamt ?? 0) > 0 ? "Alles erledigt" : "Keine gehaltenen Stunden", symbol: "checkmark.seal",
                           text: (antwort?.gesamt ?? 0) > 0 ? "Im gewählten Zeitraum sind Abwesenheiten und Lehrstoff vollständig eingetragen."
                               : "Im gewählten Zeitraum gibt es keine gehaltenen Stunden.")
            }
            ForEach(tage, id: \.0) { tag in
                Section(Datumsformat.anzeige(tag.0, "EEEE, d. MMMM")) {
                    ForEach(tag.1) { z in
                        Button {
                            Haptik.tippen()
                            wahl = Stundenwahl(quelle: "offen-\(z.id)", karten: [z.karte], typ: "lehrer", element: z.lehrer)
                        } label: {
                            zeile(z)
                        }
                        .buttonStyle(.plain)
                        .swipeActions(edge: .trailing) {
                            if !z.lehrstoff {
                                Button {
                                    lehrstoff = z
                                } label: {
                                    Label("Lehrstoff", systemImage: "text.book.closed")
                                }
                                .tint(Farben.akzent)
                            }
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .overlay {
            if antwort == nil && laedt { ProgressView() }
        }
        .navigationTitle("Offene Stunden")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .refreshable { await laden() }
        .task(id: klasse) { await laden() }
        .onChange(of: wahl == nil) { _, geschlossen in
            if geschlossen { Task { await laden() } }
        }
        .stundenBuehne($wahl, raum: zoom, zustand: zustand)
        .sheet(item: $lehrstoff) { z in
            LehrstoffBlatt(stunde: z) {
                Task { await laden() }
            }
            .environmentObject(zustand)
            .presentationDetents([.medium, .large])
        }
    }

    private func uebersicht(_ a: OffeneStundenAntwort) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text("\(a.offen)")
                    .font(.largeTitle.weight(.bold))
                    .monospacedDigit()
                    .foregroundStyle(a.offen > 0 ? Farben.warnung : Farben.ok)
                Text(a.offen == 1 ? "offene Stunde" : "offene Stunden")
                    .font(.subheadline)
                    .foregroundStyle(Farben.text2)
                Spacer()
                Text("\(a.vollstaendig) % vollständig")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Farben.text2)
            }
            ProgressView(value: Double(a.vollstaendig), total: 100)
                .tint(Farben.ok)
            Text("\(Datumsformat.anzeige(a.von, "d.M.")) – \(Datumsformat.anzeige(a.bis, "d.M.yyyy")) · ohne Kontrolle \(a.ohneKontrolle) · ohne Lehrstoff \(a.ohneLehrstoff)")
                .font(.footnote)
                .foregroundStyle(Farben.text3)
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }

    private func zeile(_ z: OffeneStunde) -> some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 1.5)
                .fill(Fachfarbe.voll(z.farbe) ?? Farben.randStark)
                .frame(width: 3, height: 38)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(z.fach)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Farben.text)
                    Text(z.klassen.joined(separator: ", "))
                        .font(.subheadline)
                        .foregroundStyle(Farben.text2)
                    if antwort?.alle == true || !klasse.isEmpty {
                        Text(z.lehrer)
                            .font(.subheadline)
                            .foregroundStyle(Farben.text3)
                    }
                }
                Text("\(z.von == z.bis ? "\(z.von)." : "\(z.von).–\(z.bis).") Std. · \(z.beginn)–\(z.ende)" + (z.raeume.isEmpty ? "" : " · \(z.raeume.joined(separator: ", "))"))
                    .font(.footnote)
                    .monospacedDigit()
                    .foregroundStyle(Farben.text3)
            }
            Spacer(minLength: 4)
            VStack(alignment: .trailing, spacing: 3) {
                if antwort?.abwesenheitskontrolle != false {
                    merkmal(z.geprueft, "Kontrolle")
                }
                merkmal(z.lehrstoff, "Lehrstoff")
            }
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    private func merkmal(_ ok: Bool, _ text: String) -> some View {
        HStack(spacing: 3) {
            Image(systemName: ok ? "checkmark" : "exclamationmark.circle.fill")
            Text(text)
        }
        .font(.caption.weight(.semibold))
        .foregroundStyle(ok ? Farben.ok : Farben.warnung)
        .accessibilityLabel(ok ? "\(text) erledigt" : "\(text) fehlt")
    }

    private func laden() async {
        laedt = true
        defer { laedt = false }
        do {
            antwort = try await zustand.api.offeneStunden(bereich: nil, klasse: klasse.isEmpty ? nil : klasse)
            fehler = nil
        } catch {
            if let t = zustand.fehlertext(error) { fehler = t }
        }
    }

    private func bereichSetzen(_ bereich: String) async {
        try? await zustand.api.offenZeitbereichSetzen(bereich)
        do {
            antwort = try await zustand.api.offeneStunden(bereich: bereich, klasse: klasse.isEmpty ? nil : klasse)
            fehler = nil
        } catch {
            if let t = zustand.fehlertext(error) { fehler = t }
        }
    }
}

/// Lehrstoff einer offenen Stunde direkt eintragen (PUT /klassenbuch/stunde nur mit dem Lehrstoff; offline gepuffert).
struct LehrstoffBlatt: View {
    let stunde: OffeneStunde
    let gespeichert: () -> Void
    @EnvironmentObject var zustand: AppZustand
    @Environment(\.dismiss) private var schliessen
    @State private var thema = ""
    @State private var speichert = false
    @State private var fehler: String? = nil
    @FocusState private var fokus: Bool

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("\(stunde.fach) · \(stunde.klassen.joined(separator: ", ")) · \(Datumsformat.anzeige(stunde.datum, "EE d.M.")) \(stunde.beginn)–\(stunde.ende)")
                        .font(.subheadline)
                        .foregroundStyle(Farben.text2)
                    TextField("Lehrstoff der Stunde", text: $thema, axis: .vertical)
                        .lineLimit(3...8)
                        .focused($fokus)
                }
                if let fehler {
                    Section { Text(fehler).foregroundStyle(Farben.entfall) }
                }
            }
            .navigationTitle("Lehrstoff")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { schliessen() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if speichert {
                        ProgressView()
                    } else {
                        Button("Sichern") { Task { await sichern() } }
                            .fontWeight(.semibold)
                            .disabled(thema.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
            }
            .onAppear { fokus = true }
        }
    }

    private func sichern() async {
        speichert = true
        defer { speichert = false }
        let daten = LehrstoffDaten(datum: stunde.datum, stunde: stunde.von, unterricht: stunde.unterricht,
                                   thema: thema.trimmingCharacters(in: .whitespacesAndNewlines), lehrform: nil,
                                   lehrer: stunde.lehrer.isEmpty ? nil : stunde.lehrer)
        do {
            _ = try await zustand.api.schreibenOderPuffern("PUT", "/klassenbuch/stunde", daten: daten,
                                                           titel: "Lehrstoff \(stunde.fach) \(kurzdatum(stunde.datum))")
            Haptik.erfolg()
            gespeichert()
            schliessen()
        } catch {
            fehler = zustand.fehlertext(error)
        }
    }
}

// MARK: - Klassenbucheinträge

/// Klassenbucheinträge (Vermerke) einer Klasse bzw. aller eigenen Klassen im Zeitraum; Löschen per Wischen, wenn erlaubt.
struct KlassenbucheintraegeView: View {
    @EnvironmentObject var zustand: AppZustand
    @State private var klasse = ""
    @State private var art = ""
    @State private var von = Datumsformat.tage(-30, nach: Date())
    @State private var bis = Date()
    @State private var liste: Vermerkzeilen? = nil
    @State private var fehler: String? = nil
    @State private var neu = false

    var body: some View {
        List {
            Section {
                KlassenFeld(klasse: $klasse, alleErlaubt: true)
                Picker("Art", selection: $art) {
                    Text("Alle Arten").tag("")
                    ForEach(liste?.arten ?? [], id: \.self) { a in
                        Text(a).tag(a)
                    }
                }
                ZeitraumFelder(von: $von, bis: $bis)
            }
            if let fehler {
                Section { Fehlerhinweis(text: fehler) }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }
            if let l = liste {
                if l.eintraege.isEmpty {
                    LeereListe(titel: "Keine Einträge", symbol: "text.book.closed", text: "Im gewählten Zeitraum gibt es keine Klassenbucheinträge.")
                }
                Section {
                    ForEach(l.eintraege.sorted { ($0.datum, $0.zeit) > ($1.datum, $1.zeit) }) { e in
                        eintragZeile(e)
                            .swipeActions(edge: .trailing) {
                                if e.loeschen {
                                    Button(role: .destructive) {
                                        Task { await loeschen(e) }
                                    } label: {
                                        Label("Löschen", systemImage: "trash")
                                    }
                                }
                            }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Klassenbucheinträge")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    neu = true
                } label: {
                    Image(systemName: "plus")
                }
                .disabled(klasse.isEmpty)
                .accessibilityLabel("Neuer Klassenbucheintrag")
            }
        }
        .sheet(isPresented: $neu) {
            VermerkFormular(klasse: klasse, arten: liste?.arten ?? []) {
                Task { await laden() }
            }
            .environmentObject(zustand)
        }
        .task { if klasse.isEmpty { klasse = await eigeneKlasse(zustand) } }
        .task(id: "\(klasse)|\(art)|\(Datumsformat.iso(von))|\(Datumsformat.iso(bis))") { await laden() }
        .refreshable { await laden() }
    }

    private func eintragZeile(_ e: Vermerkzeile) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Plakette(text: e.art, farbe: farbe(e.art))
                Text(e.schueler.isEmpty ? "Klasse \(e.klasse)" : "\(e.schueler) · \(e.klasse)")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Farben.text)
                    .lineLimit(1)
                Spacer()
                Text(kurzdatum(e.datum) + (e.zeit.isEmpty ? "" : " \(e.zeit)"))
                    .font(.caption)
                    .foregroundStyle(Farben.text3)
            }
            if !e.text.isEmpty {
                Text(e.text)
                    .font(.subheadline)
                    .foregroundStyle(Farben.text2)
            }
            if !e.lehrer.isEmpty {
                Text(e.lehrer)
                    .font(.caption)
                    .foregroundStyle(Farben.text3)
            }
        }
        .padding(.vertical, 2)
    }

    private func farbe(_ art: String) -> Color {
        let a = art.lowercased()
        if a.contains("lob") { return Farben.ok }
        if a.contains("ordnung") || a.contains("fehlt") || a.contains("vergessen") { return Farben.entfall }
        if a.contains("eltern") { return Farben.termin }
        return Farben.akzent
    }

    private func laden() async {
        do {
            liste = try await zustand.api.klassenbucheintraege(von: Datumsformat.iso(von), bis: Datumsformat.iso(bis),
                                                              klasse: klasse.isEmpty ? nil : klasse, art: art.isEmpty ? nil : art)
            fehler = nil
        } catch {
            if let t = zustand.fehlertext(error) { fehler = t }
        }
    }

    private func loeschen(_ e: Vermerkzeile) async {
        do {
            try await zustand.api.vermerkLoeschen(e.id)
            await laden()
        } catch {
            fehler = zustand.fehlertext(error)
        }
    }
}

/// Neuer Klassenbucheintrag zur Klasse bzw. zu einer Schülerin oder einem Schüler (offline gepuffert).
struct VermerkFormular: View {
    let klasse: String
    let arten: [String]
    let fertig: () -> Void
    @EnvironmentObject var zustand: AppZustand
    @Environment(\.dismiss) private var schliessen
    @State private var schueler: [Schueler] = []
    @State private var schuelerId = 0
    @State private var art = ""
    @State private var text = ""
    @State private var datum = Date()
    @State private var speichert = false
    @State private var fehler: String? = nil

    private var artenListe: [String] {
        arten.isEmpty ? ["Vermerk", "Ordnungsmaßnahme", "Elterngespräch", "Lob", "Material vergessen", "Hausaufgabe fehlt"] : arten
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Betrifft", selection: $schuelerId) {
                        Text("Ganze Klasse \(klasse)").tag(0)
                        ForEach(schueler) { s in
                            Text(s.anzeige).tag(s.id)
                        }
                    }
                    Picker("Art", selection: $art) {
                        ForEach(artenListe, id: \.self) { a in Text(a).tag(a) }
                    }
                    DatePicker("Datum", selection: $datum, displayedComponents: .date)
                }
                Section("Eintrag") {
                    TextField("Text", text: $text, axis: .vertical)
                        .lineLimit(3...10)
                }
                if let fehler {
                    Section { Text(fehler).foregroundStyle(Farben.entfall) }
                }
            }
            .navigationTitle("Klassenbucheintrag")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { schliessen() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if speichert {
                        ProgressView()
                    } else {
                        Button("Sichern") { Task { await sichern() } }
                            .fontWeight(.semibold)
                            .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
            }
            .task {
                if art.isEmpty { art = artenListe.first ?? "Vermerk" }
                schueler = (try? await zustand.api.klassenSchueler(klasse)) ?? []
            }
        }
    }

    private func sichern() async {
        speichert = true
        defer { speichert = false }
        let d = VermerkNeuDaten(datum: Datumsformat.iso(datum), klasse: klasse, schuelerId: schuelerId == 0 ? nil : schuelerId,
                                art: art, text: text.trimmingCharacters(in: .whitespacesAndNewlines), zeit: nil)
        do {
            _ = try await zustand.api.schreibenOderPuffern("POST", "/klassenbuch/vermerke", daten: d, titel: "\(art) \(klasse)")
            Haptik.erfolg()
            fertig()
            schliessen()
        } catch {
            fehler = zustand.fehlertext(error)
        }
    }
}

// MARK: - Hausaufgaben

/// Hausaufgaben: Kollegium (eigene bzw. einer Klasse, /hausaufgaben/eintraege), Familie (/familie/hausaufgaben) bzw.
/// Klassenkonto (eigene Klasse). Nach Fälligkeit gruppiert.
struct HausaufgabenListeView: View {
    enum Art {
        case kollegium
        case familie
        case klasse
    }

    let art: Art
    @EnvironmentObject var zustand: AppZustand
    @State private var liste: [HausaufgabeZeile]? = nil
    @State private var fehler: String? = nil
    @State private var meine = true
    @State private var klasse = ""
    @State private var kinder: [Kind] = []
    @State private var kind: Int? = nil

    private var gruppen: [(String, [HausaufgabeZeile])] {
        let alle = liste ?? []
        let g = Dictionary(grouping: alle) { $0.faellig ?? $0.datum }
        return g.keys.sorted().map { ($0, (g[$0] ?? []).sorted { $0.fach < $1.fach }) }
    }

    var body: some View {
        List {
            if art == .kollegium {
                Section {
                    Picker("Anzeigen", selection: $meine) {
                        Text("Meine").tag(true)
                        Text("Klasse").tag(false)
                    }
                    .pickerStyle(.segmented)
                    if !meine {
                        KlassenFeld(klasse: $klasse)
                    }
                }
            } else if art == .familie && kinder.count > 1 {
                Section {
                    Picker("Kind", selection: $kind) {
                        ForEach(kinder) { k in
                            Text(k.anzeige).tag(Optional(k.id))
                        }
                    }
                }
            }
            if let fehler {
                Section { Fehlerhinweis(text: fehler) }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }
            if let liste, liste.isEmpty {
                LeereListe(titel: "Keine Hausaufgaben", symbol: "checklist", text: "In den nächsten Wochen sind keine Hausaufgaben eingetragen.")
            }
            ForEach(gruppen, id: \.0) { g in
                Section("Fällig " + kurzdatum(g.0)) {
                    ForEach(g.1) { h in
                        VStack(alignment: .leading, spacing: 3) {
                            HStack {
                                Text(h.fach)
                                    .font(.body.weight(.semibold))
                                    .foregroundStyle(Farben.text)
                                if !h.klassen.isEmpty && art == .kollegium {
                                    Text(h.klassen.joined(separator: ", "))
                                        .font(.subheadline)
                                        .foregroundStyle(Farben.text2)
                                }
                                Spacer()
                                if h.erledigt {
                                    Plakette(text: "Erledigt", farbe: Farben.ok)
                                }
                            }
                            Text(h.text)
                                .font(.subheadline)
                                .foregroundStyle(Farben.text)
                            if !h.bemerkung.isEmpty {
                                Text(h.bemerkung)
                                    .font(.footnote)
                                    .foregroundStyle(Farben.text2)
                            }
                            Text("Aufgegeben \(kurzdatum(h.datum))" + (h.lehrer.isEmpty ? "" : " · \(h.lehrer)"))
                                .font(.caption)
                                .foregroundStyle(Farben.text3)
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .overlay {
            if liste == nil && fehler == nil { ProgressView() }
        }
        .navigationTitle("Hausaufgaben")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .task(id: "\(meine)|\(klasse)|\(kind ?? 0)") { await laden() }
        .refreshable { await laden() }
    }

    private func laden() async {
        let von = Datumsformat.iso(Datumsformat.tage(-7, nach: Date()))
        let bis = Datumsformat.iso(Datumsformat.tage(42, nach: Date()))
        do {
            switch art {
            case .kollegium:
                if !meine && klasse.isEmpty {
                    liste = []
                } else {
                    liste = try await zustand.api.hausaufgabenEintraege(von: von, bis: bis, klasse: meine ? nil : klasse,
                                                                        lehrer: meine ? zustand.benutzer?.element : nil)
                }
            case .familie:
                if kinder.isEmpty {
                    kinder = (try? await zustand.api.familieKinder()) ?? []
                    if kind == nil { kind = kinder.first?.id }
                }
                liste = try await zustand.api.familieHausaufgaben(schueler: kind, von: Datumsformat.iso(Date()), bis: bis).zeilen
            case .klasse:
                liste = try await zustand.api.hausaufgabenEintraege(von: von, bis: bis)
            }
            fehler = nil
        } catch {
            if let t = zustand.fehlertext(error) { fehler = t }
            if liste == nil { liste = [] }
        }
    }
}

// MARK: - Klassendienste

/// Klassendienste einer Klasse in der laufenden Woche bzw. im gewählten Zeitraum; die Klassenleitung teilt ein und
/// löscht (POST/DELETE /klassendienste).
struct KlassendiensteView: View {
    @EnvironmentObject var zustand: AppZustand
    @State private var klasse = ""
    @State private var von = Datumsformat.montag(Date())
    @State private var bis = Datumsformat.tage(4, nach: Datumsformat.montag(Date()))
    @State private var daten: KlassendienstUebersicht? = nil
    @State private var fehler: String? = nil
    @State private var neu = false

    var body: some View {
        List {
            Section {
                KlassenFeld(klasse: $klasse)
                ZeitraumFelder(von: $von, bis: $bis)
            }
            if let fehler {
                Section { Fehlerhinweis(text: fehler) }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }
            if let d = daten {
                if d.zuordnungen.isEmpty {
                    LeereListe(titel: "Keine Dienste eingeteilt", symbol: "person.2.badge.gearshape",
                               text: d.verwalten ? "Tippen Sie auf „+“, um einen Dienst einzuteilen." : "Die Klassenleitung teilt die Dienste ein.")
                }
                ForEach(d.arten) { a in
                    let zu = d.zuordnungen.filter { $0.dienstId == a.id }
                    if !zu.isEmpty {
                        Section(a.anzeige) {
                            ForEach(zu) { z in
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(z.schueler)
                                        .foregroundStyle(Farben.text)
                                    Text("\(Datumsformat.anzeige(z.von, "d.M.")) – \(Datumsformat.anzeige(z.bis, "d.M.yyyy"))" + (z.text.isEmpty ? "" : " · \(z.text)"))
                                        .font(.footnote)
                                        .foregroundStyle(Farben.text3)
                                }
                                .swipeActions(edge: .trailing) {
                                    if d.verwalten {
                                        Button(role: .destructive) {
                                            Task { await loeschen(z) }
                                        } label: {
                                            Label("Löschen", systemImage: "trash")
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } else if klasse.isEmpty {
                LeereListe(titel: "Klasse wählen", symbol: "person.3")
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Klassendienste")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if daten?.verwalten == true {
                    Button {
                        neu = true
                    } label: {
                        Image(systemName: "plus")
                    }
                    .accessibilityLabel("Dienst einteilen")
                }
            }
        }
        .sheet(isPresented: $neu) {
            DienstFormular(daten: daten, von: von, bis: bis) {
                Task { await laden() }
            }
            .environmentObject(zustand)
        }
        .task { if klasse.isEmpty { klasse = await eigeneKlasse(zustand) } }
        .task(id: "\(klasse)|\(Datumsformat.iso(von))|\(Datumsformat.iso(bis))") { await laden() }
        .refreshable { await laden() }
    }

    private func laden() async {
        guard !klasse.isEmpty else { return }
        do {
            daten = try await zustand.api.klassendienstUebersicht(klasse: klasse, von: Datumsformat.iso(von), bis: Datumsformat.iso(bis))
            fehler = nil
        } catch {
            if let t = zustand.fehlertext(error) { fehler = t }
        }
    }

    private func loeschen(_ z: Dienstzuordnung) async {
        do {
            try await zustand.api.dienstLoeschen(z.id)
            await laden()
        } catch {
            fehler = zustand.fehlertext(error)
        }
    }
}

/// Dienst einteilen (Klassenleitung).
struct DienstFormular: View {
    let daten: KlassendienstUebersicht?
    @State var von: Date
    @State var bis: Date
    let fertig: () -> Void
    @EnvironmentObject var zustand: AppZustand
    @Environment(\.dismiss) private var schliessen
    @State private var dienstId = 0
    @State private var schuelerId = 0
    @State private var text = ""
    @State private var fehler: String? = nil

    init(daten: KlassendienstUebersicht?, von: Date, bis: Date, fertig: @escaping () -> Void) {
        self.daten = daten
        _von = State(initialValue: von)
        _bis = State(initialValue: bis)
        self.fertig = fertig
    }

    var body: some View {
        NavigationStack {
            Form {
                Picker("Dienst", selection: $dienstId) {
                    Text("Wählen").tag(0)
                    ForEach(daten?.arten ?? []) { a in Text(a.anzeige).tag(a.id) }
                }
                Picker("Schüler*in", selection: $schuelerId) {
                    Text("Wählen").tag(0)
                    ForEach(daten?.schueler ?? []) { s in Text(s.anzeige).tag(s.id) }
                }
                ZeitraumFelder(von: $von, bis: $bis)
                TextField("Bemerkung (optional)", text: $text)
                if let fehler {
                    Text(fehler).foregroundStyle(Farben.entfall)
                }
            }
            .navigationTitle("Dienst einteilen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { schliessen() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Sichern") { Task { await sichern() } }
                        .fontWeight(.semibold)
                        .disabled(dienstId == 0 || schuelerId == 0)
                }
            }
        }
    }

    private func sichern() async {
        do {
            try await zustand.api.dienstAnlegen(DienstDaten(dienstId: dienstId, schuelerId: schuelerId, von: Datumsformat.iso(von),
                                                            bis: Datumsformat.iso(bis), text: text.isEmpty ? nil : text))
            Haptik.erfolg()
            fertig()
            schliessen()
        } catch {
            fehler = zustand.fehlertext(error)
        }
    }
}

// MARK: - Befreiungen

/// Befreiungen vom Unterricht (z. B. Sport) einer Klasse; die Klassenleitung legt an und löscht.
struct BefreiungenView: View {
    @EnvironmentObject var zustand: AppZustand
    @State private var klasse = ""
    @State private var liste: Befreiungsliste? = nil
    @State private var fehler: String? = nil
    @State private var neu = false

    private static let wochentage = ["Jeden Tag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]

    var body: some View {
        List {
            Section {
                KlassenFeld(klasse: $klasse, alleErlaubt: true)
            }
            if let fehler {
                Section { Fehlerhinweis(text: fehler) }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }
            if let l = liste {
                if l.befreiungen.isEmpty {
                    LeereListe(titel: "Keine Befreiungen", symbol: "figure.run", text: "Im Zeitraum gibt es keine Befreiungen.")
                }
                Section {
                    ForEach(l.befreiungen) { b in
                        VStack(alignment: .leading, spacing: 3) {
                            HStack {
                                Text(b.schueler)
                                    .font(.body.weight(.semibold))
                                    .foregroundStyle(Farben.text)
                                Text(b.klasse)
                                    .font(.subheadline)
                                    .foregroundStyle(Farben.text2)
                                Spacer()
                                if !b.fach.isEmpty { Plakette(text: b.fach, farbe: Farben.akzent) }
                            }
                            Text(beschreibung(b, gruende: l.gruende))
                                .font(.footnote)
                                .foregroundStyle(Farben.text2)
                            if !b.text.isEmpty {
                                Text(b.text)
                                    .font(.footnote)
                                    .foregroundStyle(Farben.text3)
                            }
                        }
                        .swipeActions(edge: .trailing) {
                            if l.verwalten {
                                Button(role: .destructive) {
                                    Task { await loeschen(b) }
                                } label: {
                                    Label("Löschen", systemImage: "trash")
                                }
                            }
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Befreiungen")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if liste?.verwalten == true && !klasse.isEmpty {
                    Button {
                        neu = true
                    } label: {
                        Image(systemName: "plus")
                    }
                    .accessibilityLabel("Neue Befreiung")
                }
            }
        }
        .sheet(isPresented: $neu) {
            BefreiungFormular(klasse: klasse, gruende: liste?.gruende ?? []) {
                Task { await laden() }
            }
            .environmentObject(zustand)
        }
        .task(id: klasse) { await laden() }
        .refreshable { await laden() }
    }

    private func beschreibung(_ b: Befreiung, gruende: [Abwesenheitsgrund]) -> String {
        var teile = ["\(Datumsformat.anzeige(b.von, "d.M.yyyy")) – \(Datumsformat.anzeige(b.bis, "d.M.yyyy"))"]
        if b.wochentag > 0 && b.wochentag < Self.wochentage.count { teile.append("nur \(Self.wochentage[b.wochentag])") }
        if !b.beginn.isEmpty { teile.append(b.ende.isEmpty ? "ab \(b.beginn)" : "\(b.beginn)–\(b.ende)") }
        if !b.grund.isEmpty {
            teile.append(gruende.first { $0.kurz.caseInsensitiveCompare(b.grund) == .orderedSame }?.anzeige ?? b.grund)
        }
        return teile.joined(separator: " · ")
    }

    private func laden() async {
        do {
            liste = try await zustand.api.befreiungen(klasse: klasse.isEmpty ? nil : klasse,
                                                     von: Datumsformat.iso(Datumsformat.tage(-30, nach: Date())),
                                                     bis: Datumsformat.iso(Datumsformat.tage(180, nach: Date())))
            fehler = nil
        } catch {
            if let t = zustand.fehlertext(error) { fehler = t }
        }
    }

    private func loeschen(_ b: Befreiung) async {
        do {
            try await zustand.api.befreiungLoeschen(b.id)
            await laden()
        } catch {
            fehler = zustand.fehlertext(error)
        }
    }
}

struct BefreiungFormular: View {
    let klasse: String
    let gruende: [Abwesenheitsgrund]
    let fertig: () -> Void
    @EnvironmentObject var zustand: AppZustand
    @Environment(\.dismiss) private var schliessen
    @State private var schueler: [Schueler] = []
    @State private var schuelerId = 0
    @State private var von = Date()
    @State private var bis = Datumsformat.tage(30, nach: Date())
    @State private var wochentag = 0
    @State private var fach = ""
    @State private var grund = ""
    @State private var text = ""
    @State private var fehler: String? = nil

    var body: some View {
        NavigationStack {
            Form {
                Picker("Schüler*in", selection: $schuelerId) {
                    Text("Wählen").tag(0)
                    ForEach(schueler) { s in Text(s.anzeige).tag(s.id) }
                }
                ZeitraumFelder(von: $von, bis: $bis)
                Picker("Wochentag", selection: $wochentag) {
                    Text("Jeden Tag").tag(0)
                    ForEach(1...5, id: \.self) { t in
                        Text(["", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"][t]).tag(t)
                    }
                }
                TextField("Fach (optional, z. B. SP)", text: $fach)
                    .textInputAutocapitalization(.characters)
                if !gruende.isEmpty {
                    Picker("Grund", selection: $grund) {
                        Text("Kein Grund").tag("")
                        ForEach(gruende) { g in Text(g.anzeige).tag(g.kurz) }
                    }
                }
                TextField("Bemerkung (optional)", text: $text, axis: .vertical)
                if let fehler {
                    Text(fehler).foregroundStyle(Farben.entfall)
                }
            }
            .navigationTitle("Neue Befreiung")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { schliessen() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Sichern") { Task { await sichern() } }
                        .fontWeight(.semibold)
                        .disabled(schuelerId == 0)
                }
            }
            .task { schueler = (try? await zustand.api.klassenSchueler(klasse)) ?? [] }
        }
    }

    private func sichern() async {
        let d = BefreiungDaten(schuelerId: schuelerId, von: Datumsformat.iso(von), bis: Datumsformat.iso(bis), wochentag: wochentag,
                               fach: fach.isEmpty ? nil : fach, beginn: nil, ende: nil, grund: grund.isEmpty ? nil : grund,
                               text: text.isEmpty ? nil : text)
        do {
            try await zustand.api.befreiungSpeichern(nil, d)
            Haptik.erfolg()
            fertig()
            schliessen()
        } catch {
            fehler = zustand.fehlertext(error)
        }
    }
}

// MARK: - Familie: Abwesenheiten mit Entschuldigungsschreiben

/// „Meine Abwesenheiten“ der Familie, dazu für Erziehungsberechtigte das Entschuldigungsschreiben (PDF zum
/// Unterschreiben, GET /familie/entschuldigung) für alle noch nicht entschuldigten Abwesenheiten.
struct FamilieAbwesenheitenSeite: View {
    @EnvironmentObject var zustand: AppZustand
    @State private var vorschau: URL? = nil
    @State private var laedt = false
    @State private var fehler: String? = nil

    var body: some View {
        MeineAbwesenheitenView()
            .toolbar {
                if zustand.istEltern {
                    ToolbarItem(placement: .topBarTrailing) {
                        if laedt {
                            ProgressView()
                        } else {
                            Button {
                                Task { await schreiben() }
                            } label: {
                                Label("Entschuldigungsschreiben", systemImage: "doc.text")
                            }
                        }
                    }
                }
            }
            .quickLookPreview($vorschau)
            .alert("Entschuldigungsschreiben", isPresented: Binding(get: { fehler != nil }, set: { if !$0 { fehler = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(fehler ?? "")
            }
    }

    private func schreiben() async {
        laedt = true
        defer { laedt = false }
        do {
            let kinder = (try? await zustand.api.familieKinder()) ?? []
            let daten = try await zustand.api.entschuldigungsschreiben(schueler: kinder.first?.id, von: nil, bis: nil)
            vorschau = try Dateiablage.ablegen(daten, name: "Entschuldigung-\(Datumsformat.iso(Date())).pdf")
        } catch {
            fehler = zustand.fehlertext(error) ?? "Das Schreiben konnte nicht erstellt werden."
        }
    }
}
