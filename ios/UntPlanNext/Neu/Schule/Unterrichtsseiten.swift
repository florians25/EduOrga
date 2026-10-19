import SwiftUI

// Prüfungen (Liste und Kalender nach Wochen), Prüfung eintragen, Vertretungsplan und Neuigkeiten (Infocenter).

// MARK: - Prüfungen

/// Prüfungen der nächsten Wochen (Kollegium: alle bzw. eigene oder einer Klasse; Familie/Klassenkonto: eigene Klasse),
/// nach Kalenderwochen gruppiert wie der Prüfungskalender im Web. Vorgemerkte Prüfungen sind markiert; Lehrkräfte
/// löschen eigene künftige Prüfungen per Wischen.
struct PruefungenView: View {
    @EnvironmentObject var zustand: AppZustand
    @State private var liste: [Pruefung]? = nil
    @State private var fehler: String? = nil
    @State private var meine = true
    @State private var klasse = ""
    @State private var zuLoeschen: Pruefung? = nil
    @State private var neu = false

    private var wochen: [Listengruppe<Pruefung>] {
        let alle = (liste ?? []).sorted { ($0.datum, $0.stundeVon) < ($1.datum, $1.stundeVon) }
        var ergebnis: [Listengruppe<Pruefung>] = []
        for p in alle {
            let m = Datumsformat.iso(Datumsformat.montag(Datumsformat.datum(p.datum) ?? Date()))
            if let i = ergebnis.firstIndex(where: { $0.id == m }) {
                ergebnis[i] = Listengruppe(id: m, liste: ergebnis[i].liste + [p])
            } else {
                ergebnis.append(Listengruppe(id: m, liste: [p]))
            }
        }
        return ergebnis
    }

    var body: some View {
        List {
            if zustand.istKollegium {
                Section {
                    Picker("Anzeigen", selection: $meine) {
                        Text("Meine").tag(true)
                        Text("Klasse").tag(false)
                    }
                    .pickerStyle(.segmented)
                    if !meine {
                        KlassenFeld(klasse: $klasse, alleErlaubt: true)
                    }
                }
            }
            if let fehler {
                Section { Fehlerhinweis(text: fehler) }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }
            if let liste, liste.isEmpty {
                LeereListe(titel: "Keine Prüfungen", symbol: "doc.text", text: "In den nächsten Wochen sind keine Prüfungen eingetragen.")
            }
            ForEach(wochen) { w in
                Section(wochentitel(w.id)) {
                    ForEach(w.liste) { p in
                        zeile(p)
                            .swipeActions(edge: .trailing) {
                                if p.darfLoeschen {
                                    Button(role: .destructive) {
                                        zuLoeschen = p
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
        .overlay {
            if liste == nil && fehler == nil { ProgressView() }
        }
        .navigationTitle("Prüfungen")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if zustand.istKollegium && zustand.darf("pruefung.anlegen") {
                    Button {
                        neu = true
                    } label: {
                        Image(systemName: "plus")
                    }
                    .accessibilityLabel("Prüfung eintragen")
                }
            }
        }
        .sheet(isPresented: $neu, onDismiss: { Task { await laden() } }) {
            NavigationStack {
                PruefungEintragenView(alsBlatt: true)
            }
            .environmentObject(zustand)
        }
        .confirmationDialog("Prüfung löschen?", isPresented: Binding(get: { zuLoeschen != nil }, set: { if !$0 { zuLoeschen = nil } }),
                            titleVisibility: .visible, presenting: zuLoeschen) { p in
            Button("Löschen", role: .destructive) { Task { await loeschen(p) } }
            Button("Abbrechen", role: .cancel) {}
        } message: { p in
            Text("\(p.titel) · \(p.klassen.joined(separator: ", ")) · \(Datumsformat.anzeige(p.datum, "EE d.M.yyyy"))")
        }
        .task(id: "\(meine)|\(klasse)") { await laden() }
        .refreshable { await laden() }
    }

    private func wochentitel(_ montag: String) -> String {
        guard let m = Datumsformat.datum(montag) else { return montag }
        let f = Datumsformat.tage(4, nach: m)
        return "KW \(Datumsformat.kalenderwoche(m)) · \(Datumsformat.anzeige(m, "d.M.")) – \(Datumsformat.anzeige(f, "d.M."))"
    }

    private func zeile(_ p: Pruefung) -> some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(spacing: 0) {
                Text(Datumsformat.anzeige(p.datum, "EE").replacingOccurrences(of: ".", with: ""))
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Farben.pruefung)
                Text(Datumsformat.anzeige(p.datum, "d"))
                    .font(.title3.weight(.bold))
                    .foregroundStyle(Farben.text)
            }
            .frame(width: 40)
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(p.titel.isEmpty ? "Prüfung" : p.titel)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Farben.text)
                    if p.vorgemerkt {
                        Plakette(text: "Vorgemerkt", farbe: Farben.pruefung)
                    }
                }
                Text([p.klassen.joined(separator: ", "), p.stundenText, p.beginn.isEmpty ? "" : "\(p.beginn)–\(p.ende)"]
                        .filter { !$0.isEmpty }.joined(separator: " · "))
                    .font(.subheadline)
                    .foregroundStyle(Farben.text2)
                let details = [p.raeume.isEmpty ? "" : "Raum \(p.raeume.joined(separator: ", "))",
                               p.lehrer.isEmpty ? "" : p.lehrer.joined(separator: ", ")].filter { !$0.isEmpty }
                if !details.isEmpty {
                    Text(details.joined(separator: " · "))
                        .font(.footnote)
                        .foregroundStyle(Farben.text3)
                }
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }

    private func laden() async {
        let von = Datumsformat.iso(Datumsformat.tage(-7, nach: Date()))
        let bis = Datumsformat.iso(Datumsformat.tage(120, nach: Date()))
        do {
            if zustand.istKollegium {
                liste = try await zustand.api.pruefungen(von: von, bis: bis, klasse: !meine && !klasse.isEmpty ? klasse : nil,
                                                         lehrer: meine ? zustand.benutzer?.element : nil)
            } else {
                liste = try await zustand.api.pruefungen(von: von, bis: bis)
            }
            fehler = nil
        } catch {
            if let t = zustand.fehlertext(error) { fehler = t }
            if liste == nil { liste = [] }
        }
    }

    private func loeschen(_ p: Pruefung) async {
        do {
            try await zustand.api.klausurLoeschen(KlausurLoeschenDaten(datum: p.datum, stundeVon: p.stundeVon, stundeBis: p.stundeBis,
                                                                       klassen: p.klassen, titel: p.titel))
            Haptik.erfolg()
            await laden()
        } catch {
            fehler = zustand.fehlertext(error)
        }
    }
}

/// Prüfung eintragen (POST /meldungen/klausur): Titel, Datum, Stunden, Klassen, Aufsicht, Räume, Bemerkung.
struct PruefungEintragenView: View {
    var alsBlatt: Bool = false
    @EnvironmentObject var zustand: AppZustand
    @Environment(\.dismiss) private var schliessen
    @State private var titel = ""
    @State private var datum = Datumsformat.tage(7, nach: Date())
    @State private var von = 3
    @State private var bis = 4
    @State private var klassen: Set<String> = []
    @State private var aufsicht: Set<String> = []
    @State private var raeume: Set<String> = []
    @State private var text = ""
    @State private var elemente: Elemente? = nil
    @State private var speichert = false
    @State private var fehler: String? = nil
    @State private var fertig = false

    private var stunden: [Zeit] { elemente?.stunden.filter { $0.nr > 0 } ?? [] }

    var body: some View {
        Form {
            Section {
                TextField("Titel, z. B. Deutsch Klassenarbeit", text: $titel)
                DatePicker("Datum", selection: $datum, in: Date()..., displayedComponents: .date)
                stundenPicker("Von", $von)
                stundenPicker("Bis", $bis)
            }
            Section("Beteiligte") {
                NavigationLink {
                    Mehrfachauswahl(titel: "Klassen", liste: elemente?.klassen ?? [], auswahl: $klassen)
                } label: {
                    LabeledContent("Klassen", value: klassen.isEmpty ? "Wählen" : klassen.sorted().joined(separator: ", "))
                }
                NavigationLink {
                    Mehrfachauswahl(titel: "Aufsicht", liste: elemente?.lehrer ?? [], auswahl: $aufsicht)
                } label: {
                    LabeledContent("Aufsicht (optional)", value: aufsicht.sorted().joined(separator: ", "))
                }
                NavigationLink {
                    Mehrfachauswahl(titel: "Räume", liste: elemente?.raeume ?? [], auswahl: $raeume)
                } label: {
                    LabeledContent("Räume (optional)", value: raeume.sorted().joined(separator: ", "))
                }
            }
            Section {
                TextField("Bemerkung (optional)", text: $text, axis: .vertical)
            } footer: {
                Text("Die Prüfung steht sofort als vorgemerkt im Plan und wird von der Planung übernommen.")
            }
            if let fehler {
                Section { Text(fehler).foregroundStyle(Farben.entfall) }
            }
            Section {
                Button {
                    Task { await eintragen() }
                } label: {
                    HStack {
                        Spacer()
                        if speichert { ProgressView() } else { Text("Prüfung eintragen").fontWeight(.semibold) }
                        Spacer()
                    }
                }
                .disabled(titel.trimmingCharacters(in: .whitespaces).isEmpty || klassen.isEmpty || speichert)
            }
        }
        .navigationTitle("Prüfung eintragen")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .toolbar {
            if alsBlatt {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { schliessen() }
                }
            }
        }
        .alert("Prüfung eingetragen", isPresented: $fertig) {
            Button("OK") { schliessen() }
        } message: {
            Text("Die Prüfung ist vorgemerkt. Den Stand sehen Sie unter „Meine Meldungen“.")
        }
        .task {
            elemente = await Stammdaten.laden(zustand.api)
            if let l = stunden.last?.nr {
                von = min(3, l)
                bis = min(4, l)
            }
        }
    }

    private func stundenPicker(_ titel: String, _ wert: Binding<Int>) -> some View {
        Picker(titel, selection: wert) {
            if stunden.isEmpty {
                ForEach(1...10, id: \.self) { n in Text("\(n). Stunde").tag(n) }
            } else {
                ForEach(stunden) { z in
                    Text("\(z.nr). Stunde" + (z.beginn.isEmpty ? "" : " (\(z.beginn))")).tag(z.nr)
                }
            }
        }
        .onChange(of: von) { _, neu in if bis < neu { bis = neu } }
    }

    private func eintragen() async {
        speichert = true
        defer { speichert = false }
        do {
            try await zustand.api.klausurEintragen(KlausurDaten(datum: Datumsformat.iso(datum), stundeVon: von, stundeBis: max(von, bis),
                                                                klassen: klassen.sorted(), raeume: raeume.sorted(), aufsicht: aufsicht.sorted(),
                                                                titel: titel.trimmingCharacters(in: .whitespaces), text: text))
            Haptik.erfolg()
            zustand.planGeaendert += 1
            fehler = nil
            fertig = true
        } catch {
            fehler = zustand.fehlertext(error)
        }
    }
}

/// Mehrfachauswahl aus Klassen, Lehrkräften oder Räumen mit Suche.
struct Mehrfachauswahl: View {
    let titel: String
    let liste: [Planelement]
    @Binding var auswahl: Set<String>
    @State private var suche = ""

    private var gefiltert: [Planelement] {
        let s = suche.trimmingCharacters(in: .whitespaces).lowercased()
        guard !s.isEmpty else { return liste }
        return liste.filter { $0.kurz.lowercased().contains(s) || $0.name.lowercased().contains(s) }
    }

    var body: some View {
        List(gefiltert) { e in
            Button {
                Haptik.auswahl()
                if auswahl.contains(e.kurz) { auswahl.remove(e.kurz) } else { auswahl.insert(e.kurz) }
            } label: {
                HStack {
                    Text(e.kurz)
                        .fontWeight(.semibold)
                        .foregroundStyle(Farben.text)
                    if !e.name.isEmpty && e.name != e.kurz {
                        Text(e.name).foregroundStyle(Farben.text2).lineLimit(1)
                    }
                    Spacer()
                    if auswahl.contains(e.kurz) {
                        Image(systemName: "checkmark").foregroundStyle(Farben.akzent)
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .searchable(text: $suche, prompt: "\(titel) suchen")
        .navigationTitle(titel)
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Vertretungsplan

/// Vertretungsplan der nächsten Schultage (Kollegium: Lehrerversion, sonst Schülerversion der eigenen Klasse):
/// je Tag Nachrichten, Abwesenheiten und die Änderungen nach Stunden.
struct VertretungsplanView: View {
    @EnvironmentObject var zustand: AppZustand
    @State private var plan: Vertretungsplan? = nil
    @State private var fehler: String? = nil
    @State private var tag = 0
    @State private var suche = ""

    private var tage: [Vertretungstag] { plan?.tage ?? [] }

    var body: some View {
        List {
            if tage.count > 1 {
                Section {
                    Picker("Tag", selection: $tag) {
                        ForEach(Array(tage.enumerated()), id: \.offset) { i, t in
                            Text(kurzdatum(t.datum)).tag(i)
                        }
                    }
                    .pickerStyle(.segmented)
                }
            }
            if let fehler {
                Section { Fehlerhinweis(text: fehler) }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }
            if tage.indices.contains(tag) {
                tagInhalt(tage[tag])
            } else if plan != nil {
                LeereListe(titel: "Kein Vertretungsplan", symbol: "arrow.left.arrow.right")
            }
        }
        .listStyle(.insetGrouped)
        .overlay {
            if plan == nil && fehler == nil { ProgressView() }
        }
        .searchable(text: $suche, prompt: "Klasse, Lehrkraft, Fach")
        .navigationTitle("Vertretungsplan")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .task { await laden() }
        .refreshable { await laden() }
    }

    @ViewBuilder
    private func tagInhalt(_ t: Vertretungstag) -> some View {
        Section {
            VStack(alignment: .leading, spacing: 4) {
                Text(Datumsformat.anzeige(t.datum, "EEEE, d. MMMM yyyy") + (t.woche.isEmpty ? "" : " · \(t.woche.count == 1 ? "\(t.woche)-Woche" : t.woche)"))
                    .font(.headline)
                    .foregroundStyle(Farben.text)
                if t.frei {
                    Text(t.freiGrund.isEmpty ? "Unterrichtsfrei" : t.freiGrund)
                        .foregroundStyle(Farben.frei)
                }
                ForEach(Array(t.nachrichten.enumerated()), id: \.offset) { _, n in
                    Text(n)
                        .font(.subheadline)
                        .foregroundStyle(Farben.text2)
                }
                let abwesend = [t.abwesendeLehrer.isEmpty ? "" : "Abwesend: \(t.abwesendeLehrer.joined(separator: ", "))",
                                t.abwesendeKlassen.isEmpty ? "" : "Klassen: \(t.abwesendeKlassen.joined(separator: ", "))",
                                t.blockierteRaeume.isEmpty ? "" : "Räume gesperrt: \(t.blockierteRaeume.joined(separator: ", "))"]
                    .filter { !$0.isEmpty }
                ForEach(abwesend, id: \.self) { a in
                    Text(a)
                        .font(.footnote)
                        .foregroundStyle(Farben.text3)
                }
            }
            .padding(.vertical, 2)
        }
        let s = suche.trimmingCharacters(in: .whitespaces).lowercased()
        let zeilen = t.zeilen.filter { z in
            s.isEmpty || "\(z.klassen) \(z.lehrer) \(z.lehrerAlt) \(z.fach) \(z.raum)".lowercased().contains(s)
        }
        Section(zeilen.isEmpty ? "Keine Änderungen" : "Änderungen") {
            ForEach(zeilen) { z in
                HStack(alignment: .top, spacing: 12) {
                    Text(z.stunde)
                        .font(.subheadline.weight(.bold))
                        .monospacedDigit()
                        .foregroundStyle(Farben.text)
                        .frame(width: 34, alignment: .leading)
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 6) {
                            Text(z.klassen)
                                .font(.body.weight(.semibold))
                                .foregroundStyle(Farben.text)
                            Plakette(text: z.art.isEmpty ? (z.entfall ? "Entfall" : "Änderung") : z.art,
                                     farbe: z.entfall ? Farben.entfall : Farben.aenderung)
                        }
                        wechsel(z)
                            .font(.subheadline)
                            .foregroundStyle(Farben.text2)
                        if !z.text.isEmpty {
                            Text(z.text)
                                .font(.footnote)
                                .foregroundStyle(Farben.text3)
                        }
                    }
                }
                .padding(.vertical, 2)
                .accessibilityElement(children: .combine)
            }
        }
    }

    /// „M · MEI → SCH · R204“ (alt durchgestrichen → neu violett).
    private func wechsel(_ z: Vertretungszeile) -> Text {
        func teil(_ neu: String, _ alt: String) -> Text {
            if !alt.isEmpty && alt != neu {
                return Text(alt).strikethrough(true, color: Farben.text3).foregroundColor(Farben.text3)
                    + Text(" → ").foregroundColor(Farben.text3)
                    + Text(neu.isEmpty ? "—" : neu).foregroundColor(Farben.aenderung)
            }
            return Text(neu)
        }
        var e = teil(z.fach, z.fachAlt)
        for (neu, alt) in [(z.lehrer, z.lehrerAlt), (z.raum, z.raumAlt)] where !(neu.isEmpty && alt.isEmpty) {
            e = e + Text(" · ") + teil(neu, alt)
        }
        return e
    }

    private func laden() async {
        do {
            plan = try await zustand.api.vertretungen(datum: Datumsformat.iso(Date()), tage: 3)
            fehler = nil
        } catch {
            if let t = zustand.fehlertext(error) { fehler = t }
        }
    }
}

// MARK: - Neuigkeiten (Infocenter)

/// Infos der Schule und Neuerungen in EduOrga (GET /infocenter); beim Ansehen gelten sie als gelesen.
struct NeuigkeitenListeView: View {
    @EnvironmentObject var zustand: AppZustand
    @State private var antwort: InfocenterAntwort? = nil
    @State private var neu: Set<String> = []
    @State private var fehler: String? = nil
    @State private var art = ""

    private var liste: [InfocenterEintrag] {
        (antwort?.eintraege ?? []).filter { art.isEmpty || $0.art == art }
    }

    var body: some View {
        List {
            Section {
                Picker("Art", selection: $art) {
                    Text("Alle").tag("")
                    Text("Infos der Schule").tag("info")
                    Text("Neu in EduOrga").tag("neuigkeit")
                }
                .pickerStyle(.segmented)
            }
            if let fehler {
                Section { Fehlerhinweis(text: fehler) }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }
            if antwort != nil && liste.isEmpty {
                LeereListe(titel: art == "info" ? "Keine Infos der Schule" : "Keine Neuigkeiten", symbol: "megaphone")
            }
            ForEach(liste) { e in
                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 6) {
                            if neu.contains(e.schluessel) {
                                Circle().fill(Farben.akzent).frame(width: 8, height: 8)
                                    .accessibilityLabel("neu")
                            }
                            Plakette(text: e.kategorie.isEmpty ? (e.art == "info" ? "Info" : "Neu") : e.kategorie,
                                     farbe: e.wichtig ? Farben.entfall : Farben.akzent)
                            Spacer()
                            Text(Datumsformat.anzeige(e.datum, "d.M.yyyy"))
                                .font(.caption)
                                .foregroundStyle(Farben.text3)
                        }
                        Text(e.titel)
                            .font(.headline)
                            .foregroundStyle(Farben.text)
                        if !e.text.isEmpty {
                            Text(e.text)
                                .font(.subheadline)
                                .foregroundStyle(Farben.text2)
                        }
                        ForEach(Array(e.punkte.enumerated()), id: \.offset) { _, p in
                            HStack(alignment: .firstTextBaseline, spacing: 6) {
                                Text("–")
                                Text(p)
                            }
                            .font(.subheadline)
                            .foregroundStyle(Farben.text2)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
        }
        .listStyle(.insetGrouped)
        .overlay {
            if antwort == nil && fehler == nil { ProgressView() }
        }
        .navigationTitle("Neuigkeiten")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .task { await laden() }
        .refreshable { await laden() }
    }

    private func laden() async {
        do {
            let a = try await zustand.api.infocenter()
            if antwort == nil { neu = Set(a.eintraege.filter { !$0.gelesen }.map(\.schluessel)) }
            antwort = a
            fehler = nil
            let offen = a.eintraege.filter { !$0.gelesen }.map(\.schluessel)
            if !offen.isEmpty { try? await zustand.api.infocenterGelesen(offen) }
        } catch {
            if let t = zustand.fehlertext(error) { fehler = t }
        }
    }
}
