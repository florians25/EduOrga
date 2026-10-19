import SwiftUI

// Anwesenheitskontrolle einer Stunde wie in EduOrga Web (Reiter „Anwesenheit“ der Unterrichtsstunde): Schülerliste mit
// Schnellwahl je Person – anwesend · abwesend · verspätet (Minuten) · entschuldigt –, „Alle anwesend“, gemeldete
// Abwesenheiten der Eltern bzw. Schüler*innen und Abwesenheiten aus der Vorstunde. Gleiche API wie das Web:
// GET/PUT /api/app/klassenbuch/anwesenheit (PUT ersetzt die Fehlzeiten der Stunde und vermerkt die Kontrolle; jede
// Änderung wird sofort und der Reihe nach gespeichert), POST /klassenbuch/abwesenheit/verlaengern (Vorstunde übernehmen).
// Ohne Verbindung landet die Anwesenheit im Schreibpuffer.

/// Fehlzeit einer Person in der Stunde (wie `Fz` im Web).
struct Anwesenheitswert: Equatable {
    var art: String
    var minuten: Int
    var bemerkung: String? = nil
    var grund: String? = nil
    var von: String? = nil
    var bis: String? = nil
}

/// Schnellwahl einer Zeile.
enum Anwesenheitswahl: Hashable {
    case da
    case fehlt
    case verspaetet
    case entschuldigt
    /// früher gegangen (nur über das Menü der Zeile)
    case vorzeitig
}

struct AnwesenheitSeite: View {
    @EnvironmentObject var daten: Stundendaten
    @EnvironmentObject var zustand: AppZustand

    /// Noch nicht vom Server bestätigter Stand (nil = Stand des Servers)
    @State private var entwurf: [Int: Anwesenheitswert]? = nil
    @State private var kette: Task<Void, Never>? = nil
    @State private var offen = 0
    @State private var fehler: String? = nil
    @State private var gepuffert = false
    @State private var rechte = Entschuldigungsrechte()
    @State private var entschuldigung: Entschuldigungsauftrag? = nil
    /// Nach dem Speichern die Entschuldigung dieser Person öffnen
    @State private var danachEntschuldigen: Int? = nil
    @State private var abwesenheitenVon: Schueler? = nil
    @State private var eintrag: EintragsVorlage? = nil
    @State private var alleFragen = false
    @State private var suche = ""

    struct EintragsVorlage: Identifiable {
        let id = UUID()
        let schueler: [Schueler]
    }

    private var liste: Anwesenheitsliste? { daten.anwesenheit }
    private var karte: Karte { daten.karte }

    private var zukunft: Bool { karte.datum > Datumsformat.iso(Date()) }
    private var darf: Bool { liste?.darf == true }
    private var bedienbar: Bool { darf && !zukunft }

    /// Stand des Servers je Schüler-ID.
    private var server: [Int: Anwesenheitswert] {
        var m: [Int: Anwesenheitswert] = [:]
        for f in liste?.fehlzeiten ?? [] {
            m[f.schuelerId] = Anwesenheitswert(art: f.art, minuten: f.minuten,
                                               bemerkung: f.text.isEmpty ? (f.bemerkung.isEmpty ? nil : f.bemerkung) : f.text,
                                               grund: f.grund.isEmpty ? nil : f.grund,
                                               von: f.beginn.isEmpty ? nil : f.beginn, bis: f.ende.isEmpty ? nil : f.ende)
        }
        return m
    }

    private var aktuell: [Int: Anwesenheitswert] { entwurf ?? server }

    private var schueler: [Schueler] {
        let alle = liste?.schueler ?? []
        let s = suche.trimmingCharacters(in: .whitespaces)
        guard !s.isEmpty else { return alle }
        return alle.filter { $0.anzeige.localizedCaseInsensitiveContains(s) }
    }

    private func wahl(_ s: Schueler) -> Anwesenheitswahl {
        guard let w = aktuell[s.id] else { return .da }
        if entwurf == nil, daten.fehlzeit(s)?.status == "entschuldigt" { return .entschuldigt }
        switch w.art {
        case "verspaetet": return .verspaetet
        case "vorzeitig": return .vorzeitig
        default: return .fehlt
        }
    }

    private func darfEntschuldigen(_ s: Schueler) -> Bool {
        rechte.leitet(s.klasse) || (rechte.fachlehrer && darf)
    }

    private var mehrereKlassen: Bool {
        let klassen = Set((liste?.schueler ?? []).map(\.klasse))
        return klassen.count > 1
    }

    // MARK: Ansicht

    var body: some View {
        List {
            if liste == nil {
                Section {
                    HStack {
                        Spacer()
                        ProgressView()
                        Spacer()
                    }
                }
            } else if (liste?.schueler ?? []).isEmpty {
                Section {
                    Text("Für diese Klasse wurde keine Schülerliste übertragen (EduOrga Studio → EduOrga Web → „Schülerliste übertragen“).")
                        .foregroundStyle(Farben.text2)
                }
            } else {
                kopfAbschnitt
                meldungsAbschnitt
                vorstundenAbschnitt
                Section {
                    ForEach(schueler) { s in
                        zeile(s)
                    }
                } header: {
                    Text("Schüler*innen (\(liste?.schueler.count ?? 0))")
                } footer: {
                    if bedienbar {
                        Text("Jede Änderung wird sofort gespeichert. Lange drücken: Abwesenheit mit Zeitraum, früher gegangen, Klassenbucheintrag.")
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .searchable(text: $suche, placement: .navigationBarDrawer(displayMode: .automatic), prompt: "Name suchen")
        .navigationTitle("Anwesenheit")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                VStack(spacing: 0) {
                    Text("Anwesenheit").font(.headline)
                    Text(daten.einzelstunde == nil ? stundenUntertitel(karte) : "Nur \(daten.bereichText)")
                        .font(.caption)
                        .foregroundStyle(Farben.text2)
                        .lineLimit(1)
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                if offen > 0 {
                    ProgressView()
                } else if liste?.kontrolliert == true && entwurf == nil {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Farben.ok)
                        .accessibilityLabel("Kontrolliert")
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            if bedienbar && liste != nil && !(liste?.schueler ?? []).isEmpty {
                fussleiste
            }
        }
        .refreshable { await daten.anwesenheitLaden() }
        .task {
            rechte = await zustand.entschuldigungsrechteLaden()
            if daten.anwesenheit == nil { await daten.anwesenheitLaden() }
        }
        .confirmationDialog("Alle als anwesend eintragen?", isPresented: $alleFragen, titleVisibility: .visible) {
            Button("Alle anwesend") { alleAnwesend() }
            Button("Abbrechen", role: .cancel) {}
        } message: {
            Text("Die erfassten Abwesenheiten dieser Stunde werden entfernt.")
        }
        .alert("Speichern fehlgeschlagen", isPresented: Binding(get: { fehler != nil }, set: { if !$0 { fehler = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(fehler ?? "")
        }
        .navigationDestination(item: $abwesenheitenVon) { s in
            SchuelerAbwesenheitenView(schueler: s)
                .environmentObject(daten)
                .environmentObject(zustand)
        }
        .detailPraesentation(item: $eintrag, breit: Geraet.istPad, art: .formular) { v in
            NeuerKlassenbucheintragView(vorauswahl: v.schueler)
                .environmentObject(daten)
                .environmentObject(zustand)
        }
        .detailPraesentation(item: $entschuldigung, breit: Geraet.istPad, art: .formular) { a in
            EntschuldigenView(auftrag: a) {
                Task { await daten.anwesenheitLaden() }
            }
            .environmentObject(zustand)
        }
    }

    // MARK: Kopf

    @ViewBuilder
    private var kopfAbschnitt: some View {
        let alle = liste?.schueler ?? []
        let werte = alle.map { wahl($0) }
        let fehlt = werte.filter { $0 == .fehlt || $0 == .entschuldigt }.count
        let spaet = werte.filter { $0 == .verspaetet }.count
        let frueher = werte.filter { $0 == .vorzeitig }.count
        Section {
            HStack(alignment: .firstTextBaseline, spacing: 14) {
                (Text("\(alle.count - fehlt)").fontWeight(.semibold) + Text(" / \(alle.count) anwesend"))
                    .foregroundStyle(Farben.text)
                if fehlt > 0 {
                    Text("\(fehlt) abwesend").foregroundStyle(Farben.entfall)
                }
                if spaet > 0 {
                    Text("\(spaet) verspätet").foregroundStyle(Farben.pruefung)
                }
                if frueher > 0 {
                    Text("\(frueher) früher weg").foregroundStyle(Farben.pruefung)
                }
                Spacer(minLength: 0)
            }
            .font(.subheadline)
            .monospacedDigit()
            .accessibilityElement(children: .combine)
            if zukunft {
                Text("Die Anwesenheit wird ab dem Tag der Stunde erfasst.")
                    .font(.footnote)
                    .foregroundStyle(Farben.text2)
            } else if !darf {
                Text("Nur Anzeige – die Anwesenheit erfasst die Lehrkraft der Stunde bzw. die Klassenleitung.")
                    .font(.footnote)
                    .foregroundStyle(Farben.text2)
            } else if let g = liste?.geprueft, !g.isEmpty, entwurf == nil {
                Label(g.count > 10 ? "Kontrolliert \(Datumsformat.anzeige(String(g.prefix(10)), "d.M.")) \(String(g.dropFirst(11).prefix(5)))" : "Kontrolliert",
                      systemImage: "checkmark.circle.fill")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(Farben.ok)
            }
            if gepuffert {
                Label("Ohne Verbindung gespeichert – wird gesendet, sobald das Gerät online ist.", systemImage: "icloud.slash")
                    .font(.footnote)
                    .foregroundStyle(Farben.warnung)
            }
        }
    }

    // MARK: Meldungen und Vorstunde

    private func name(_ id: Int) -> String {
        liste?.schueler.first { $0.id == id }?.anzeige ?? "Nr. \(id)"
    }

    @ViewBuilder
    private var meldungsAbschnitt: some View {
        let ids = Set((liste?.schueler ?? []).map(\.id))
        let meldungen = (liste?.meldungen ?? []).filter { ids.contains($0.schuelerId) }
        if !meldungen.isEmpty {
            Section("Gemeldete Abwesenheiten") {
                ForEach(meldungen) { m in
                    let da = aktuell[m.schuelerId] == nil
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(name(m.schuelerId)).font(.body.weight(.semibold))
                            Spacer()
                            Text(m.status == "bestaetigt" ? "bestätigt" : "gemeldet")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(Farben.frei)
                        }
                        Text(meldungsText(m))
                            .font(.footnote)
                            .foregroundStyle(Farben.text2)
                        if bedienbar && da {
                            Button("Als abwesend eintragen") {
                                setzen([(m.schuelerId, Anwesenheitswert(art: "fehlt", minuten: 0, bemerkung: "laut Abwesenheitsmeldung",
                                                                         grund: m.grund.isEmpty ? nil : m.grund))])
                            }
                            .font(.subheadline.weight(.semibold))
                            .buttonStyle(.borderless)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
    }

    private func meldungsText(_ m: GemeldeteAbwesenheit) -> String {
        var teile: [String] = []
        if m.von == m.bis || m.bis.isEmpty {
            teile.append(Datumsformat.anzeige(m.von, "d.M.yyyy"))
        } else {
            teile.append("\(Datumsformat.anzeige(m.von, "d.M.")) bis \(Datumsformat.anzeige(m.bis, "d.M.yyyy"))")
        }
        if !m.grund.isEmpty { teile.append("Grund \(m.grund)") }
        if !m.text.isEmpty { teile.append(m.text) }
        return teile.joined(separator: " · ")
    }

    @ViewBuilder
    private var vorstundenAbschnitt: some View {
        let ids = Array(Set((liste?.vorstunden ?? []).map(\.schuelerId))).filter { aktuell[$0] == nil }.sorted { name($0) < name($1) }
        if !ids.isEmpty {
            Section {
                Text(ids.map { name($0) }.joined(separator: ", "))
                    .foregroundStyle(Farben.text)
                if bedienbar {
                    Button("Für diese Stunde übernehmen") {
                        Task { await verlaengern(ids) }
                    }
                    .disabled(offen > 0)
                }
            } header: {
                Text("In einer früheren Stunde heute abwesend")
            }
        }
    }

    // MARK: Zeile

    private func untertitel(_ s: Schueler) -> String? {
        var teile: [String] = []
        if mehrereKlassen && !s.klasse.isEmpty { teile.append(s.klasse) }
        if let w = aktuell[s.id] {
            switch w.art {
            case "verspaetet": teile.append("verspätet \(w.minuten) Min.")
            case "vorzeitig": teile.append("früher gegangen \(w.minuten) Min.")
            default: break
            }
        }
        if entwurf == nil, let f = daten.fehlzeit(s) {
            switch f.status {
            case "entschuldigt": teile.append("entschuldigt")
            case "unentschuldigt": teile.append("nicht entschuldigt")
            case "offen": teile.append("Entschuldigung offen")
            default: break
            }
            if !f.grund.isEmpty { teile.append(daten.grundName(f.grund)) }
        }
        if (liste?.meldungen ?? []).contains(where: { $0.schuelerId == s.id }) { teile.append("Abwesenheit gemeldet") }
        return teile.isEmpty ? nil : teile.joined(separator: " · ")
    }

    private func zeile(_ s: Schueler) -> some View {
        let w = wahl(s)
        return VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(s.anzeige)
                    .font(.body.weight(.medium))
                    .foregroundStyle(Farben.text)
                    .lineLimit(1)
                Spacer(minLength: 6)
                if let u = untertitel(s) {
                    Text(u)
                        .font(.footnote)
                        .foregroundStyle(w == .da ? Farben.text3 : farbe(w))
                        .lineLimit(1)
                }
            }
            Picker("Anwesenheit von \(s.anzeige)", selection: Binding(get: { w }, set: { neu in waehlen(s, neu) })) {
                Text("Anwesend").tag(Anwesenheitswahl.da)
                Text("Abwesend").tag(Anwesenheitswahl.fehlt)
                Text("Verspätet").tag(Anwesenheitswahl.verspaetet)
                if darfEntschuldigen(s) {
                    Text("Entsch.").tag(Anwesenheitswahl.entschuldigt)
                }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .disabled(!bedienbar)
            if w == .verspaetet || w == .vorzeitig, let wert = aktuell[s.id] {
                Stepper(value: Binding(get: { wert.minuten }, set: { minutenSetzen(s, $0) }), in: 1...240, step: 5) {
                    Text(w == .verspaetet ? "\(wert.minuten) Min. verspätet" : "\(wert.minuten) Min. früher gegangen")
                        .font(.subheadline)
                        .monospacedDigit()
                        .foregroundStyle(Farben.pruefung)
                }
                .disabled(!bedienbar)
            }
        }
        .padding(.vertical, 4)
        .listRowBackground(w == .fehlt ? Farben.entfallFlaeche : (w == .verspaetet || w == .vorzeitig ? Farben.pruefungFlaeche : Farben.flaeche))
        .contextMenu {
            if darf {
                Button {
                    abwesenheitenVon = s
                } label: {
                    Label("Abwesenheit mit Zeitraum …", systemImage: "clock")
                }
                if bedienbar {
                    Button {
                        let alt = aktuell[s.id]
                        setzen([(s.id, Anwesenheitswert(art: "vorzeitig", minuten: alt?.art == "vorzeitig" ? alt?.minuten ?? 5 : 5,
                                                         bemerkung: alt?.bemerkung, grund: alt?.grund))])
                    } label: {
                        Label("Früher gegangen", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                }
                Button {
                    eintrag = EintragsVorlage(schueler: [s])
                } label: {
                    Label("Klassenbucheintrag …", systemImage: "text.book.closed")
                }
            }
        }
    }

    private func farbe(_ w: Anwesenheitswahl) -> Color {
        switch w {
        case .da: return Farben.ok
        case .fehlt: return Farben.entfall
        case .verspaetet, .vorzeitig: return Farben.pruefung
        case .entschuldigt: return Farben.ok
        }
    }

    // MARK: Fußleiste

    private var fussleiste: some View {
        let leer = aktuell.isEmpty
        return HStack(spacing: 12) {
            if !leer {
                Button {
                    alleFragen = true
                } label: {
                    Text("Alle anwesend")
                        .frame(maxWidth: .infinity)
                }
                .glasKnopf()
            }
            Button {
                bestaetigen()
            } label: {
                Text(leer ? "Alle anwesend – bestätigen" : "Anwesenheit bestätigen")
                    .fontWeight(.semibold)
                    .frame(maxWidth: .infinity)
            }
            .glasKnopf(hervorgehoben: true)
            .tint(Farben.akzent)
        }
        .controlSize(.large)
        .disabled(offen > 0)
        .padding(.horizontal, Stilmass.rand)
        .padding(.vertical, 8)
    }

    // MARK: Aktionen

    private func waehlen(_ s: Schueler, _ neu: Anwesenheitswahl) {
        let alt = aktuell[s.id]
        Haptik.auswahl()
        switch neu {
        case .da:
            setzen([(s.id, nil)])
        case .fehlt:
            setzen([(s.id, Anwesenheitswert(art: "fehlt", minuten: 0, bemerkung: alt?.bemerkung, grund: alt?.grund))])
        case .verspaetet:
            setzen([(s.id, Anwesenheitswert(art: "verspaetet", minuten: alt?.art == "verspaetet" ? (alt?.minuten ?? 5) : 5,
                                            bemerkung: alt?.bemerkung, grund: alt?.grund))])
        case .vorzeitig:
            setzen([(s.id, Anwesenheitswert(art: "vorzeitig", minuten: alt?.art == "vorzeitig" ? (alt?.minuten ?? 5) : 5,
                                            bemerkung: alt?.bemerkung, grund: alt?.grund))])
        case .entschuldigt:
            // Entschuldigen über den Dialog von EduOrga Web (Status, Datum, Nachweis); fehlt die Fehlzeit, zuerst als
            // abwesend eintragen und danach den Dialog öffnen.
            if entwurf == nil, let f = daten.fehlzeit(s) {
                entschuldigung = Entschuldigungsauftrag(ziel: .fehlzeit(id: f.id, klasse: s.klasse, datum: karte.datum),
                                                        name: s.anzeige, klasse: s.klasse)
            } else {
                danachEntschuldigen = s.id
                if alt == nil {
                    setzen([(s.id, Anwesenheitswert(art: "fehlt", minuten: 0))])
                }
            }
        }
    }

    private func minutenSetzen(_ s: Schueler, _ minuten: Int) {
        guard var w = aktuell[s.id] else { return }
        w.minuten = min(240, max(1, minuten))
        w.von = nil
        w.bis = nil
        setzen([(s.id, w)])
    }

    private func alleAnwesend() {
        let ids = Array(aktuell.keys)
        setzen(ids.map { id -> (Int, Anwesenheitswert?) in (id, nil) })
    }

    /// Kontrolle bestätigen: den aktuellen Stand unverändert speichern.
    private func bestaetigen() {
        setzen([])
    }

    /// Änderungen sofort sichtbar machen und der Reihe nach speichern (wie im Web: der ganze Stand der Stunde je PUT).
    private func setzen(_ aenderungen: [(Int, Anwesenheitswert?)]) {
        var neu = aktuell
        for (id, w) in aenderungen {
            if let w { neu[id] = w } else { neu.removeValue(forKey: id) }
        }
        entwurf = neu
        offen += 1
        let stand = neu
        let vorher = kette
        kette = Task {
            await vorher?.value
            await senden(stand)
        }
    }

    private func senden(_ stand: [Int: Anwesenheitswert]) async {
        guard let u = karte.unterricht else {
            offen -= 1
            return
        }
        let eintraege = stand.map { id, w in
            AnwesenheitEintragDaten(schuelerId: id, art: w.art, minuten: w.minuten > 0 ? w.minuten : 5,
                                    bemerkung: w.bemerkung ?? "", grund: w.grund ?? "", von: w.von, bis: w.bis)
        }
        let d = AnwesenheitDaten(datum: karte.datum, stunde: karte.von, unterricht: u, eintraege: eintraege,
                                 einzelstunde: daten.einzelstunde)
        var gesendet = true
        do {
            gesendet = try await daten.api.schreibenOderPuffern("PUT", "/klassenbuch/anwesenheit", daten: d,
                                                                titel: "Anwesenheit \(karte.fach) \(Datumsformat.anzeige(karte.datum, "d.M."))")
        } catch {
            if let text = zustand.fehlertext(error) { fehler = text }
            danachEntschuldigen = nil
        }
        offen -= 1
        guard offen == 0 else { return }
        if gesendet {
            gepuffert = false
            await daten.anwesenheitLaden()
            entwurf = nil
            Haptik.erfolg()
            if let id = danachEntschuldigen, let s = liste?.schueler.first(where: { $0.id == id }), let f = daten.fehlzeit(s) {
                entschuldigung = Entschuldigungsauftrag(ziel: .fehlzeit(id: f.id, klasse: s.klasse, datum: karte.datum),
                                                        name: s.anzeige, klasse: s.klasse)
            }
            danachEntschuldigen = nil
        } else {
            // gepuffert: lokalen Stand behalten, bis der Server ihn bestätigt
            gepuffert = true
            danachEntschuldigen = nil
        }
    }

    private func verlaengern(_ ids: [Int]) async {
        guard let u = karte.unterricht else { return }
        offen += 1
        defer { offen -= 1 }
        do {
            let d = AbwesenheitVerlaengernDaten(datum: karte.datum, stunde: karte.von, unterricht: u, schuelerIds: ids,
                                                einzelstunde: daten.einzelstunde)
            _ = try await daten.api.schreibenOderPuffern("POST", "/klassenbuch/abwesenheit/verlaengern", daten: d,
                                                         titel: "Abwesenheit übernehmen")
            await daten.anwesenheitLaden()
            entwurf = nil
        } catch {
            if let text = zustand.fehlertext(error) { fehler = text }
        }
    }
}
