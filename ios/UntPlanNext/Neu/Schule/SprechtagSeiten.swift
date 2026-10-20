import SwiftUI

// Sprechtag: Liste aller sichtbaren Sprechtage (GET /sprechtag) und die Blätter der Lehrkraft zum Einladen von
// Familien (POST /sprechtag/{id}/einladungen) bzw. Eintragen eines Termins in eine freie Zeit (POST /termine).

/// Alle Sprechtage, die das Konto sehen darf; Antippen öffnet den Sprechtag (Lehrkraft: eigene Zeiten, Einladungen;
/// Eltern: Termine buchen, Warteliste; Schüler*innen: nur lesen).
struct SprechtagListeView: View {
    @EnvironmentObject var zustand: AppZustand
    @Environment(\.horizontalSizeClass) private var groessenklasse
    @State private var liste: [SprechtagListeneintrag]? = nil
    @State private var fehler: String? = nil
    @State private var wahl: SprechtagWahl? = nil

    private var kommend: [SprechtagListeneintrag] {
        (liste ?? []).filter { e in
            guard let s = e.sprechtag else { return false }
            return s.status != "vorbei" && s.phase != "vorbei"
        }
    }

    private var vergangen: [SprechtagListeneintrag] {
        (liste ?? []).filter { e in
            guard let s = e.sprechtag else { return false }
            return s.status == "vorbei" || s.phase == "vorbei"
        }
    }

    var body: some View {
        List {
            if let fehler {
                Section { Fehlerhinweis(text: fehler) }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }
            if liste != nil && (liste ?? []).isEmpty {
                LeereListe(titel: "Keine Sprechtage", symbol: "person.2", text: "Sobald die Schule einen Sprechtag ankündigt, erscheint er hier.")
            }
            if !kommend.isEmpty {
                Section("Anstehend") {
                    ForEach(kommend) { e in zeile(e) }
                }
            }
            if !vergangen.isEmpty {
                Section("Vergangen") {
                    ForEach(vergangen) { e in zeile(e) }
                }
            }
        }
        .listStyle(.insetGrouped)
        .overlay {
            if liste == nil && fehler == nil { ProgressView() }
        }
        .navigationTitle("Sprechtage")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .detailPraesentation(item: $wahl, breit: groessenklasse == .regular) { w in
            NavigationStack {
                SprechtagView(id: w.id, titel: w.titel)
            }
            .environmentObject(zustand)
        }
        .onChange(of: wahl?.id) { _, neu in
            if neu == nil { Task { await laden() } }
        }
        .task { await laden() }
        .refreshable { await laden() }
    }

    private func zeile(_ e: SprechtagListeneintrag) -> some View {
        let s = e.sprechtag
        return Button {
            if let s { wahl = SprechtagWahl(id: s.id, titel: s.titel) }
        } label: {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(s?.titel ?? "Sprechtag")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Farben.text)
                    Text([s.map { $0.datumText.isEmpty ? Datumsformat.anzeige($0.datum, "EEEE, d. MMMM yyyy") : $0.datumText } ?? "",
                          s?.zeitenText ?? ""].filter { !$0.isEmpty }.joined(separator: " · "))
                        .font(.subheadline)
                        .foregroundStyle(Farben.text2)
                    if let s, let anmeldung = anmeldungText(s) {
                        Text(anmeldung)
                            .font(.footnote)
                            .foregroundStyle(Farben.text2)
                    }
                    HStack(spacing: 6) {
                        if let s {
                            Plakette(text: s.phaseText, farbe: s.abgesagt ? Farben.entfall : (s.buchbar ? Farben.ok : Farben.text2))
                        }
                        if e.termine > 0 {
                            Text(e.termine == 1 ? "1 Termin" : "\(e.termine) Termine")
                                .font(.caption)
                                .foregroundStyle(Farben.text3)
                        }
                        if zustand.istKollegium && !e.beteiligt {
                            Text("nicht beteiligt")
                                .font(.caption)
                                .foregroundStyle(Farben.text3)
                        }
                    }
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Farben.pfeil)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(zustand.istKollegium && !e.beteiligt)
    }

    /// „Anmeldung bis 5.11.2026“ bzw. „Anmeldung ab …“ (nicht bei abgesagten bzw. vergangenen Sprechtagen).
    private func anmeldungText(_ s: SprechtagInfo) -> String? {
        guard !s.abgesagt, s.phase != "vorbei", s.status != "vorbei" else { return nil }
        if s.angekuendigt && !s.anmeldungVonText.isEmpty { return "Anmeldung ab \(s.anmeldungVonText)" }
        if !s.anmeldungBisText.isEmpty { return "Anmeldung bis \(s.anmeldungBisText)" }
        if !s.anmeldungBis.isEmpty { return "Anmeldung bis \(Datumsformat.anzeige(s.anmeldungBis, "d.M.yyyy"))" }
        return nil
    }

    private func laden() async {
        do {
            liste = try await zustand.api.sprechtage().sprechtage.filter { $0.sprechtag != nil }
            fehler = nil
        } catch {
            if let t = zustand.fehlertext(error) { fehler = t }
            if liste == nil { liste = [] }
        }
    }
}

/// Familien zum Gespräch einladen: Schüler*innen der eigenen Klassen zuerst, Suche, optional ein Text.
struct SprechtagEinladenBlatt: View {
    let id: Int
    let fertig: (String) -> Void
    @EnvironmentObject var zustand: AppZustand
    @Environment(\.dismiss) private var schliessen
    @State private var auswahl: SprechtagSchuelerauswahl? = nil
    @State private var gewaehlt: Set<Int> = []
    @State private var klasse = ""
    @State private var suche = ""
    @State private var text = ""
    @State private var sendet = false
    @State private var fehler: String? = nil

    private var klassen: [String] {
        guard let a = auswahl else { return [] }
        return a.eigeneKlassen + a.klassen.filter { !a.eigeneKlassen.contains($0) }
    }

    private var schueler: [SprechtagWahlSchueler] {
        let alle = auswahl?.schueler ?? []
        let s = suche.trimmingCharacters(in: .whitespaces).lowercased()
        if !s.isEmpty { return alle.filter { $0.anzeige.lowercased().contains(s) || $0.klasse.lowercased().contains(s) } }
        return alle.filter { $0.klasse == klasse }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Picker("Klasse", selection: $klasse) {
                        ForEach(klassen, id: \.self) { k in Text(k).tag(k) }
                    }
                    TextField("Text der Einladung (optional)", text: $text, axis: .vertical)
                        .lineLimit(2...5)
                }
                if let fehler {
                    Section { Text(fehler).foregroundStyle(Farben.entfall) }
                }
                Section {
                    ForEach(schueler) { s in
                        Button {
                            if gewaehlt.contains(s.id) { gewaehlt.remove(s.id) } else { gewaehlt.insert(s.id) }
                        } label: {
                            HStack {
                                Image(systemName: gewaehlt.contains(s.id) ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(gewaehlt.contains(s.id) ? Farben.akzent : Farben.pfeil)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(s.anzeige).foregroundStyle(Farben.text)
                                    Text(s.elternkonto ? s.klasse : "\(s.klasse) · ohne Elternkonto")
                                        .font(.footnote)
                                        .foregroundStyle(Farben.text3)
                                }
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                } header: {
                    Text(suche.isEmpty ? "Klasse \(klasse)" : "Treffer")
                } footer: {
                    Text("Familien mit Elternkonto werden benachrichtigt und sehen die Einladung beim Buchen.")
                }
            }
            .overlay {
                if auswahl == nil { ProgressView() }
            }
            .searchable(text: $suche, prompt: "Schüler*in suchen")
            .navigationTitle(gewaehlt.isEmpty ? "Familien einladen" : "\(gewaehlt.count) ausgewählt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { schliessen() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if sendet {
                        ProgressView()
                    } else {
                        Button("Einladen") { Task { await senden() } }
                            .fontWeight(.semibold)
                            .disabled(gewaehlt.isEmpty)
                    }
                }
            }
            .task { await laden() }
        }
    }

    private func laden() async {
        do {
            let a = try await zustand.api.sprechtagSchueler(id)
            auswahl = a
            if klasse.isEmpty { klasse = a.eigeneKlassen.first ?? a.klassen.first ?? "" }
        } catch {
            fehler = zustand.fehlertext(error)
        }
    }

    private func senden() async {
        sendet = true
        defer { sendet = false }
        do {
            let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
            let a = try await zustand.api.sprechtagEinladen(id, SprechtagEinladungDaten(schuelerIds: Array(gewaehlt), text: t.isEmpty ? nil : t))
            Haptik.erfolg()
            fertig("\(a.neu) \(a.neu == 1 ? "Einladung" : "Einladungen") verschickt" + (a.ohneKonto > 0 ? " (\(a.ohneKonto) ohne Elternkonto)." : "."))
            schliessen()
        } catch {
            fehler = zustand.fehlertext(error)
        }
    }
}

/// Termin in eine freie Zeit eintragen (z. B. nach telefonischer Absprache).
struct SprechtagEintragenBlatt: View {
    let id: Int
    let fenster: SprechtagZeitfenster
    let fertig: () -> Void
    @EnvironmentObject var zustand: AppZustand
    @Environment(\.dismiss) private var schliessen
    @State private var auswahl: SprechtagSchuelerauswahl? = nil
    @State private var schuelerId = 0
    @State private var suche = ""
    @State private var bemerkung = ""
    @State private var fehler: String? = nil

    private var treffer: [SprechtagWahlSchueler] {
        let alle = auswahl?.schueler ?? []
        let s = suche.trimmingCharacters(in: .whitespaces).lowercased()
        let eigene = Set(auswahl?.eigeneKlassen ?? [])
        if s.isEmpty { return alle.filter { eigene.contains($0.klasse) } }
        return alle.filter { $0.anzeige.lowercased().contains(s) || $0.klasse.lowercased().contains(s) }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    LabeledContent("Zeit", value: "\(fenster.beginn)–\(fenster.ende) Uhr")
                    TextField("Bemerkung (optional)", text: $bemerkung)
                }
                if let fehler {
                    Section { Text(fehler).foregroundStyle(Farben.entfall) }
                }
                Section(suche.isEmpty ? "Eigene Klassen" : "Treffer") {
                    ForEach(treffer) { s in
                        Button {
                            schuelerId = s.id
                        } label: {
                            HStack {
                                Text(s.anzeige).foregroundStyle(Farben.text)
                                Text(s.klasse).foregroundStyle(Farben.text3)
                                Spacer()
                                if schuelerId == s.id {
                                    Image(systemName: "checkmark").foregroundStyle(Farben.akzent)
                                }
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .searchable(text: $suche, prompt: "Schüler*in suchen")
            .navigationTitle("Termin eintragen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { schliessen() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Eintragen") { Task { await eintragen() } }
                        .fontWeight(.semibold)
                        .disabled(schuelerId == 0)
                }
            }
            .task {
                do {
                    auswahl = try await zustand.api.sprechtagSchueler(id)
                } catch {
                    fehler = zustand.fehlertext(error)
                }
            }
        }
    }

    private func eintragen() async {
        do {
            let b = bemerkung.trimmingCharacters(in: .whitespaces)
            try await zustand.api.sprechtagTerminEintragen(id, SprechtagTerminDaten(schuelerId: schuelerId, beginn: fenster.beginn,
                                                                                 bemerkung: b.isEmpty ? nil : b))
            Haptik.erfolg()
            fertig()
            schliessen()
        } catch {
            fehler = zustand.fehlertext(error)
        }
    }
}
