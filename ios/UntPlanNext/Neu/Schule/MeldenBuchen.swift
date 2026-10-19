import SwiftUI

// Melden (Abwesenheit melden, Meine Meldungen) und Buchen (Raum bzw. Ressource buchen, Meine Buchungen) – wie im
// Web (web/client/src/pages/melden, …/buchen), für unterwegs auf das Wesentliche verkürzt: ein Termin oder eine
// wöchentliche Serie, Stunden von–bis, freie Räume bzw. Ressourcen wählen, Titel und Bemerkung.

// MARK: - Abwesenheit melden

/// Eigene Abwesenheit an die Vertretungsplanung melden (POST /meldungen/abwesenheit).
struct AbwesenheitMeldenView: View {
    @EnvironmentObject var zustand: AppZustand
    @Environment(\.dismiss) private var schliessen
    @State private var von = Date()
    @State private var bis = Date()
    @State private var ganztaegig = true
    @State private var stundeVon = 1
    @State private var stundeBis = 6
    @State private var grund = "Krankheit"
    @State private var text = ""
    @State private var stunden: [Zeit] = []
    @State private var sendet = false
    @State private var fehler: String? = nil
    @State private var fertig = false

    private static let gruende = ["Krankheit", "Fortbildung", "Dienstlicher Termin", "Klassenfahrt / Exkursion", "Sonderurlaub", "Sonstiges"]

    var body: some View {
        Form {
            Section {
                ZeitraumFelder(von: $von, bis: $bis)
                Toggle("Ganztägig", isOn: $ganztaegig)
                    .tint(Farben.akzent)
                if !ganztaegig {
                    Picker("Ab", selection: $stundeVon) {
                        ForEach(stundenliste, id: \.self) { n in Text("\(n). Stunde").tag(n) }
                    }
                    Picker("Bis", selection: $stundeBis) {
                        ForEach(stundenliste.filter { $0 >= stundeVon }, id: \.self) { n in Text("\(n). Stunde").tag(n) }
                    }
                }
            }
            Section("Grund") {
                Picker("Grund", selection: $grund) {
                    ForEach(Self.gruende, id: \.self) { g in Text(g).tag(g) }
                }
                .pickerStyle(.inline)
                .labelsHidden()
            }
            Section {
                TextField("Hinweise für die Vertretung (optional)", text: $text, axis: .vertical)
                    .lineLimit(2...6)
            } footer: {
                Text("Die Meldung geht an die Vertretungsplanung und wird dort als Abwesenheit übernommen.")
            }
            if let fehler {
                Section { Text(fehler).foregroundStyle(Farben.entfall) }
            }
            Section {
                Button {
                    Task { await senden() }
                } label: {
                    HStack {
                        Spacer()
                        if sendet { ProgressView() } else { Text("Abwesenheit melden").fontWeight(.semibold) }
                        Spacer()
                    }
                }
                .disabled(sendet)
            }
        }
        .navigationTitle("Abwesenheit melden")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .onChange(of: stundeVon) { _, neu in if stundeBis < neu { stundeBis = neu } }
        .alert("Abwesenheit gemeldet", isPresented: $fertig) {
            Button("OK") { schliessen() }
        } message: {
            Text("Den Stand sehen Sie unter „Meine Meldungen“.")
        }
        .task {
            stunden = (await Stammdaten.laden(zustand.api))?.stunden.filter { $0.nr > 0 } ?? []
            if let l = stunden.last?.nr { stundeBis = l }
        }
    }

    private var stundenliste: [Int] {
        stunden.isEmpty ? Array(1...10) : stunden.map(\.nr)
    }

    private func senden() async {
        sendet = true
        defer { sendet = false }
        do {
            try await zustand.api.abwesenheitMelden(AbwesenheitMeldenDaten(
                von: Datumsformat.iso(von), bis: Datumsformat.iso(max(von, bis)),
                stundeVon: ganztaegig ? nil : stundeVon, stundeBis: ganztaegig ? nil : stundeBis,
                grund: grund, text: text.trimmingCharacters(in: .whitespacesAndNewlines)))
            Haptik.erfolg()
            fehler = nil
            fertig = true
        } catch {
            fehler = zustand.fehlertext(error)
        }
    }
}

// MARK: - Meine Meldungen

/// Eigene Meldungen mit Status (offen, übernommen, abgelehnt); offene lassen sich zurückziehen.
struct MeineMeldungenView: View {
    @EnvironmentObject var zustand: AppZustand
    @State private var liste: [Meldung]? = nil
    @State private var fehler: String? = nil
    @State private var status = ""

    private var gefiltert: [Meldung] {
        (liste ?? []).filter { status.isEmpty || $0.status == status }
    }

    var body: some View {
        List {
            Section {
                Picker("Status", selection: $status) {
                    Text("Alle").tag("")
                    Text("Offen").tag("offen")
                    Text("Übernommen").tag("quittiert")
                    Text("Abgelehnt").tag("abgelehnt")
                }
                .pickerStyle(.segmented)
            }
            if let fehler {
                Section { Fehlerhinweis(text: fehler) }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }
            if liste != nil && gefiltert.isEmpty {
                LeereListe(titel: "Keine Meldungen", symbol: "tray",
                           text: "Melden Sie eine Abwesenheit oder tragen Sie eine Prüfung ein – hier sehen Sie dann den Status.")
            }
            Section {
                ForEach(gefiltert) { m in
                    zeile(m)
                        .swipeActions(edge: .trailing) {
                            if m.status == "offen" {
                                Button(role: .destructive) {
                                    Task { await zurueckziehen(m) }
                                } label: {
                                    Label("Zurückziehen", systemImage: "arrow.uturn.backward")
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
        .navigationTitle("Meine Meldungen")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .task { await laden() }
        .refreshable { await laden() }
    }

    private func titel(_ m: Meldung) -> String {
        let std: String = {
            guard let v = m.stundeVon else { return "" }
            if let b = m.stundeBis, b != v { return " (\(v).–\(b). Std.)" }
            return " (\(v). Std.)"
        }()
        let von = m.von.map { Datumsformat.anzeige($0, "d.M.yyyy") } ?? ""
        let bis = m.bis.map { Datumsformat.anzeige($0, "d.M.yyyy") } ?? ""
        let zeitraum = bis.isEmpty || bis == von ? von : "\(von) – \(bis)"
        switch m.typ {
        case "absenz": return "Abwesenheit \(zeitraum)\(std)" + ((m.grund ?? "").isEmpty ? "" : " · \(m.grund ?? "")")
        case "raumbuchung": return "Raumbuchung \(m.raum ?? "") am \(von)\(std)"
        case "klausur": return "Prüfung \(m.klassen.joined(separator: ", ")) am \(von)\(std)" + ((m.titel ?? "").isEmpty ? "" : " · \(m.titel ?? "")")
        case "klausurloeschen": return "Prüfung löschen: \(m.klassen.joined(separator: ", ")) am \(von)\(std)"
        case "buchungstorno": return "Storno \(m.raum ?? "") am \(von)\(std)"
        default: return "Nachricht \(von): \(m.text ?? "")"
        }
    }

    private func zeile(_ m: Meldung) -> some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                Text(titel(m))
                    .font(.body.weight(.medium))
                    .foregroundStyle(Farben.text)
                if let t = m.text, !t.isEmpty, m.typ != "nachricht" {
                    Text(t)
                        .font(.footnote)
                        .foregroundStyle(Farben.text2)
                }
                if !m.erstellt.isEmpty {
                    Text("gemeldet \(Datumsformat.anzeige(m.erstellt, "d.M.yyyy, HH:mm"))")
                        .font(.caption)
                        .foregroundStyle(Farben.text3)
                }
            }
            Spacer(minLength: 4)
            switch m.status {
            case "offen": Plakette(text: "Offen", farbe: Farben.pruefung)
            case "quittiert": Plakette(text: "Übernommen", farbe: Farben.ok)
            case "abgelehnt": Plakette(text: "Abgelehnt", farbe: Farben.entfall)
            default: Plakette(text: m.status, farbe: Farben.text2)
            }
        }
        .padding(.vertical, 2)
    }

    private func laden() async {
        do {
            liste = try await zustand.api.meldungen()
            fehler = nil
        } catch {
            if let t = zustand.fehlertext(error) { fehler = t }
            if liste == nil { liste = [] }
        }
    }

    private func zurueckziehen(_ m: Meldung) async {
        do {
            try await zustand.api.meldungZurueckziehen(m.id)
            Haptik.erfolg()
            await laden()
        } catch {
            fehler = zustand.fehlertext(error)
        }
    }
}

// MARK: - Buchen

enum Buchungsart {
    case raum
    case ressource

    var schluessel: String { self == .raum ? "raum" : "ressource" }
    var titel: String { self == .raum ? "Raum buchen" : "Ressource buchen" }
}

/// Raum bzw. Ressource buchen: Termin (einmalig oder jede Woche bis zu einem Datum) mit Stunden, dann aus den freien
/// Räumen bzw. Ressourcen wählen, Titel und Bemerkung, buchen. Konflikte meldet der Server.
struct BuchenView: View {
    let art: Buchungsart
    @EnvironmentObject var zustand: AppZustand
    @Environment(\.dismiss) private var schliessen
    @State private var optionen: Buchungsoptionen? = nil
    @State private var datum = Date()
    @State private var serie = false
    @State private var bisDatum = Datumsformat.tage(56, nach: Date())
    @State private var stundeVon = 1
    @State private var stundeBis = 1
    @State private var raumsuche: Raumsuche? = nil
    @State private var ressourcensuche: Ressourcensuche? = nil
    @State private var raum: String? = nil
    @State private var ressourcen: [Int: Int] = [:]
    @State private var titel = ""
    @State private var text = ""
    @State private var sucht = false
    @State private var bucht = false
    @State private var fehler: String? = nil
    @State private var ergebnis: BuchungAntwort? = nil

    private var stunden: [BuchZeitraster] { optionen?.zeitraster ?? [] }

    private var zeit: BuchZeitangabe {
        let tag = (Datumsformat.kalender.component(.weekday, from: datum) + 5) % 7
        return BuchZeitangabe(wiederholung: serie ? "woechentlich" : "einmalig",
                              datum: serie ? nil : Datumsformat.iso(datum),
                              von: serie ? Datumsformat.iso(datum) : nil,
                              bis: serie ? Datumsformat.iso(max(datum, bisDatum)) : nil,
                              wochentage: [tag], stundeVon: stundeVon, stundeBis: max(stundeVon, stundeBis))
    }

    /// Termine der Suche (bei Räumen in der Hülle mit freien Räumen).
    private var termine: [BuchTermin] {
        if art == .raum { return raumsuche?.termine.compactMap(\.termin) ?? [] }
        return ressourcensuche?.termine ?? []
    }

    var body: some View {
        Form {
            if let e = ergebnis {
                erfolg(e)
            } else {
                terminAbschnitt
                if art == .raum, let s = raumsuche { raumAbschnitt(s) }
                if art == .ressource, let s = ressourcensuche { ressourcenAbschnitt(s) }
                if bereitZumBuchen {
                    Section("Angaben") {
                        TextField("Titel (z. B. Projekt 7a)", text: $titel)
                        TextField("Bemerkung (optional)", text: $text, axis: .vertical)
                    }
                    Section {
                        Button {
                            Task { await buchen() }
                        } label: {
                            HStack {
                                Spacer()
                                if bucht {
                                    ProgressView()
                                } else {
                                    Text(termine.count > 1 ? "\(termine.count) Termine buchen" : "Buchen").fontWeight(.semibold)
                                }
                                Spacer()
                            }
                        }
                        .disabled(bucht)
                    }
                }
            }
            if let fehler {
                Section { Text(fehler).foregroundStyle(Farben.entfall) }
            }
        }
        .navigationTitle(art.titel)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .onChange(of: stundeVon) { _, neu in if stundeBis < neu { stundeBis = neu } }
        .onChange(of: "\(Datumsformat.iso(datum))|\(serie)|\(Datumsformat.iso(bisDatum))|\(stundeVon)|\(stundeBis)") { _, _ in
            raumsuche = nil
            ressourcensuche = nil
            raum = nil
            ressourcen = [:]
        }
        .task { await optionenLaden() }
    }

    private var bereitZumBuchen: Bool {
        art == .raum ? raum != nil : !ressourcen.isEmpty
    }

    private var terminAbschnitt: some View {
        Section {
            DatePicker(serie ? "Ab" : "Datum", selection: $datum, in: Date()..., displayedComponents: .date)
            Toggle("Jede Woche", isOn: $serie)
                .tint(Farben.akzent)
            if serie {
                DatePicker("Bis", selection: $bisDatum, in: datum..., displayedComponents: .date)
            }
            Picker("Von", selection: $stundeVon) {
                ForEach(stunden) { z in Text("\(z.nr). Stunde (\(z.beginn))").tag(z.nr) }
            }
            Picker("Bis", selection: $stundeBis) {
                ForEach(stunden.filter { $0.nr >= stundeVon }) { z in Text("\(z.nr). Stunde (bis \(z.ende))").tag(z.nr) }
            }
            Button {
                Task { await suchen() }
            } label: {
                HStack {
                    Text(art == .raum ? "Freie Räume suchen" : "Freie Ressourcen suchen")
                        .fontWeight(.semibold)
                    Spacer()
                    if sucht { ProgressView() }
                }
            }
            .disabled(sucht || stunden.isEmpty)
        } header: {
            Text("Wann?")
        }
    }

    @ViewBuilder
    private func raumAbschnitt(_ s: Raumsuche) -> some View {
        let n = s.termine.count
        let frei = s.raeume.filter { $0.belegt.isEmpty }
        Section {
            if frei.isEmpty {
                Text("Zu dieser Zeit ist kein buchbarer Raum an allen Terminen frei.")
                    .foregroundStyle(Farben.text2)
            }
            ForEach(frei) { r in
                Button {
                    Haptik.auswahl()
                    raum = r.kurz
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(r.kurz)
                                .font(.body.weight(.semibold))
                                .foregroundStyle(Farben.text)
                            let info = [r.name == r.kurz ? "" : r.name, r.raumart, r.kapazitaet > 0 ? "\(r.kapazitaet) Plätze" : "", r.gebaeude]
                                .filter { !$0.isEmpty }
                            if !info.isEmpty {
                                Text(info.joined(separator: " · "))
                                    .font(.footnote)
                                    .foregroundStyle(Farben.text2)
                            }
                        }
                        Spacer()
                        if raum == r.kurz {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(Farben.akzent)
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        } header: {
            Text(n == 1 ? "Freie Räume" : "Freie Räume an allen \(n) Terminen")
        }
    }

    @ViewBuilder
    private func ressourcenAbschnitt(_ s: Ressourcensuche) -> some View {
        let frei = s.ressourcen.filter { $0.belegt.isEmpty && $0.frei > 0 }
        Section {
            if frei.isEmpty {
                Text("Zu dieser Zeit ist keine Ressource frei.")
                    .foregroundStyle(Farben.text2)
            }
            ForEach(frei) { r in
                let menge = ressourcen[r.id] ?? 0
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(r.name)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(Farben.text)
                        Text([r.art, r.standort, "\(r.frei) frei"].filter { !$0.isEmpty }.joined(separator: " · "))
                            .font(.footnote)
                            .foregroundStyle(Farben.text2)
                    }
                    Spacer()
                    Stepper("\(menge)", value: Binding(get: { ressourcen[r.id] ?? 0 },
                                                       set: { ressourcen[r.id] = $0 > 0 ? $0 : nil }),
                            in: 0...max(1, r.frei))
                        .fixedSize()
                }
            }
        } header: {
            Text("Freie Ressourcen")
        }
    }

    private func erfolg(_ e: BuchungAntwort) -> some View {
        Section {
            VStack(alignment: .leading, spacing: 8) {
                Label(e.buchungen.count == 1 ? "Die Buchung ist gespeichert." : "\(e.buchungen.count) Termine gebucht.",
                      systemImage: "checkmark.circle.fill")
                    .font(.headline)
                    .foregroundStyle(Farben.ok)
                if let b = e.buchungen.first {
                    Text("\(b.titel.isEmpty ? b.artName : b.titel) · \(Datumsformat.anzeige(b.datum, "EE d.M.yyyy")) · \(b.stundenText)" + (b.raum.isEmpty ? "" : " · \(b.raum)"))
                        .font(.subheadline)
                        .foregroundStyle(Farben.text2)
                }
                ForEach(e.hinweise, id: \.self) { h in
                    Label(h, systemImage: "exclamationmark.triangle")
                        .font(.footnote)
                        .foregroundStyle(Farben.warnung)
                }
            }
            .padding(.vertical, 4)
            Button("Weitere Buchung") {
                ergebnis = nil
                raumsuche = nil
                ressourcensuche = nil
                raum = nil
                ressourcen = [:]
                titel = ""
                text = ""
            }
        }
    }

    private func optionenLaden() async {
        do {
            let o = try await zustand.api.buchungsoptionen()
            optionen = o
            if let d = Datumsformat.datum(o.naechsterTag), d > datum { datum = d }
            if let erste = o.zeitraster.first?.nr {
                stundeVon = erste
                stundeBis = erste
            }
            fehler = nil
        } catch {
            fehler = zustand.fehlertext(error)
        }
    }

    private func suchen() async {
        sucht = true
        defer { sucht = false }
        let anfrage = BuchSuchAnfrage(zeit: zeit, kriterien: BuchSuchKriterien())
        do {
            if art == .raum {
                raumsuche = try await zustand.api.raumsuche(anfrage)
            } else {
                ressourcensuche = try await zustand.api.ressourcensuche(anfrage)
            }
            fehler = nil
        } catch {
            fehler = zustand.fehlertext(error)
        }
    }

    private func buchen() async {
        bucht = true
        defer { bucht = false }
        let wahl = termine.map { BuchTerminWahl(datum: $0.datum, stundeVon: $0.stundeVon, stundeBis: $0.stundeBis, raum: art == .raum ? raum : nil) }
        let daten = BuchungNeuDaten(art: art.schluessel, termine: wahl,
                                    ressourcen: ressourcen.map { BuchRessourcenWahl(id: $0.key, menge: $0.value) },
                                    klassen: [], lehrer: optionen?.ich.isEmpty == false ? optionen?.ich : nil,
                                    titel: titel.trimmingCharacters(in: .whitespaces), text: text)
        do {
            ergebnis = try await zustand.api.buchen(daten)
            zustand.planGeaendert += 1
            Haptik.erfolg()
            fehler = nil
        } catch {
            fehler = zustand.fehlertext(error)
        }
    }
}

// MARK: - Meine Buchungen

/// Eigene Buchungen ab heute; Stornieren per Wischen (bei Serien: nur dieser Termin oder alle kommenden).
struct MeineBuchungenView: View {
    @EnvironmentObject var zustand: AppZustand
    @State private var liste: [Buchung]? = nil
    @State private var fehler: String? = nil
    @State private var storno: Buchung? = nil
    @State private var meldung: String? = nil

    var body: some View {
        List {
            if let meldung {
                Section {
                    Label(meldung, systemImage: "checkmark.circle.fill")
                        .foregroundStyle(Farben.ok)
                }
            }
            if let fehler {
                Section { Fehlerhinweis(text: fehler) }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }
            if let liste, liste.isEmpty {
                LeereListe(titel: "Keine Buchungen", symbol: "calendar.badge.plus", text: "Gebuchte Räume und Ressourcen erscheinen hier.")
            }
            Section {
                ForEach(liste ?? []) { b in
                    VStack(alignment: .leading, spacing: 3) {
                        HStack {
                            Text(b.titel.isEmpty ? b.artName : b.titel)
                                .font(.body.weight(.semibold))
                                .foregroundStyle(b.istStorniert ? Farben.text3 : Farben.text)
                                .strikethrough(b.istStorniert)
                            Spacer()
                            if b.istStorniert {
                                Plakette(text: "Storniert", farbe: Farben.entfall)
                            } else if !b.serie.isEmpty && (liste ?? []).filter({ $0.serie == b.serie }).count > 1 {
                                Plakette(text: "Serie", farbe: Farben.akzent)
                            }
                        }
                        Text("\(b.wochentag.isEmpty ? "" : "\(b.wochentag), ")\(Datumsformat.anzeige(b.datum, "d.M.yyyy")) · \(b.stundenText)" + (b.beginn.isEmpty ? "" : " · \(b.beginn)–\(b.ende)"))
                            .font(.subheadline)
                            .foregroundStyle(Farben.text2)
                        let wo = [b.raum, b.ressourcen.map { $0.menge > 1 ? "\($0.menge)× \($0.name)" : $0.name }.joined(separator: ", ")]
                            .filter { !$0.isEmpty }
                        if !wo.isEmpty {
                            Text(wo.joined(separator: " · "))
                                .font(.footnote)
                                .foregroundStyle(Farben.text3)
                        }
                    }
                    .swipeActions(edge: .trailing) {
                        if !b.istStorniert {
                            Button(role: .destructive) {
                                storno = b
                            } label: {
                                Label("Stornieren", systemImage: "xmark.circle")
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
        .navigationTitle("Meine Buchungen")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .confirmationDialog("Buchung stornieren?", isPresented: Binding(get: { storno != nil }, set: { if !$0 { storno = nil } }),
                            titleVisibility: .visible, presenting: storno) { b in
            Button("Nur diesen Termin", role: .destructive) { Task { await stornieren(b, serie: false) } }
            if !b.serie.isEmpty && (liste ?? []).filter({ $0.serie == b.serie }).count > 1 {
                Button("Alle kommenden Termine der Serie", role: .destructive) { Task { await stornieren(b, serie: true) } }
            }
            Button("Abbrechen", role: .cancel) {}
        } message: { b in
            Text("\(b.titel.isEmpty ? b.artName : b.titel) · \(Datumsformat.anzeige(b.datum, "d.M.yyyy")) · \(b.stundenText)")
        }
        .task { await laden() }
        .refreshable { await laden() }
    }

    private func laden() async {
        do {
            liste = try await zustand.api.buchungen(von: Datumsformat.iso(Date()), bis: Datumsformat.iso(Datumsformat.tage(400, nach: Date())))
            fehler = nil
        } catch {
            if let t = zustand.fehlertext(error) { fehler = t }
            if liste == nil { liste = [] }
        }
    }

    private func stornieren(_ b: Buchung, serie: Bool) async {
        do {
            let n = try await zustand.api.buchungStornieren(b.id, serie: serie)
            meldung = n == 1 ? "Termin storniert." : "\(n) Termine storniert."
            zustand.planGeaendert += 1
            Haptik.erfolg()
            await laden()
        } catch {
            fehler = zustand.fehlertext(error)
        }
    }
}
