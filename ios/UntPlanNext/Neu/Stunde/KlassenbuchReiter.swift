import SwiftUI

// Reiter „Klassenbuch“ der Stundendetails (nur Lehrkräfte) – dieselbe Seite dient als „Stunde jetzt“ (Schnellerfassung von
// „Heute“). Klare Abschnitte in der Reihenfolge der Arbeit in der Stunde:
//   Stand oben: „Thema ✓ · Anwesenheit offen · Hausaufgabe –“ und der Speicherstand („Automatisch gespeichert · 10:42“).
//   1. Thema / Lehrstoff – Eingabefeld mit Vorschlägen (Themenplan, „Fortsetzung: …“, frühere Themen); speichert von selbst
//      (kurz nach der letzten Eingabe und beim Verlassen).
//   2. Anwesenheitskontrolle – großer Knopf mit Zusammenfassung („24 anwesend · 1 abwesend · 1 verspätet“), öffnet die
//      Anwesenheit; „Alle anwesend“ als Schnellaktion; Schnellerfassung als Liste mit Wischgesten bzw. Namensraster.
//   3. Hausaufgaben – Liste und neue Hausaufgabe mit Fälligkeit als Schnellwahl (nächste Stunde · in 1 Woche · Datum · ohne).
//   4. Klausur/Prüfung eintragen (Recht „Prüfungen eintragen“) – vorbelegt mit Datum, Stunden, Klassen und Raum.
//   5. Einträge – heutige Klassenbucheinträge und Vorlagen (Material vergessen, Hausaufgabe fehlt, Lob …).
//   6. Notizen (für Schüler*innen bzw. Lehrkräfte).
//   7. Verlauf – die letzten Themen dieses Kurses und der Kursverlauf.
// Gleiche Endpunkte wie EduOrga Web (über `Stundendaten`); ohne Verbindung landet alles im Schreibpuffer.

/// Speicherstand des Themas (Statuszeile).
enum Themenspeicherstand: Equatable {
    case unveraendert
    case ungesichert
    case speichert
    case gespeichert(Date)
    case offline
    case fehler(String)
}

struct KlassenbuchReiter: View {
    let karte: Karte
    @ObservedObject var daten: Stundendaten
    /// Kopf mit Fach, Klasse, Raum und Fortschritt („Stunde jetzt“); in den Stundendetails steht der Kopf im Reiter „Details“.
    var mitKopf: Bool = false

    @EnvironmentObject var zustand: AppZustand
    @ObservedObject private var puffer = Schreibpuffer.shared

    // Thema
    @State private var thema = ""
    @State private var themaUebernommen = false
    @State private var themaSpeichert = false
    @State private var speicherstand: Themenspeicherstand = .unveraendert
    @State private var vorstunden: [Vorstundenthema] = []
    @State private var plan: [String] = []
    @State private var planOffen = false
    // Hausaufgabe
    @State private var hausaufgabe = ""
    @State private var faelligWahl: Faelligkeit = .naechsteStunde
    @State private var faelligDatum = Date()
    @State private var naechsteStunde: Date? = nil
    @State private var hausaufgabeSpeichert = false
    // Übriges
    @State private var vorlage: StundeJetztSeite.Eintragsvorlage? = nil
    @State private var fehler: String? = nil
    @State private var meldung: String? = nil
    @State private var alleFragen = false
    @State private var alleArbeitet = false
    @State private var pruefungOffen = false
    @FocusState private var fokus: Feld?

    enum Feld: Hashable {
        case thema
        case hausaufgabe
    }

    private var liste: Anwesenheitsliste? { daten.anwesenheit }
    private var schueler: [Schueler] { liste?.schueler ?? [] }
    private var anwesenheitBedienbar: Bool { liste?.darf == true && karte.datum <= Datumsformat.iso(Date()) }
    private var kontrolliert: Bool { liste?.kontrolliert == true }

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

    private var gespeichertesThema: String {
        (daten.eintrag?.thema ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var geerbtesThema: String {
        (daten.geerbterEintrag?.thema ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var themaGeaendert: Bool {
        themaUebernommen && thema.trimmingCharacters(in: .whitespacesAndNewlines) != gespeichertesThema
    }

    private var hausaufgabenListe: [Hausaufgabeneintrag] { daten.hausaufgaben?.liste ?? [] }

    private var behandelt: [String] { vorstunden.map(\.thema) + [thema] }

    // MARK: Ansicht

    var body: some View {
        List {
            if mitKopf {
                kopfAbschnitt
            }
            standAbschnitt
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
            themaAbschnitt
            anwesenheitAbschnitt
            hausaufgabeAbschnitt
            pruefungAbschnitt
            eintragAbschnitt
            notizAbschnitt
            verlaufAbschnitt
        }
        .listStyle(.insetGrouped)
        .listSectionSpacing(.compact)
        .scrollDismissesKeyboard(.interactively)
        .scrollContentBackground(.hidden)
        .background(Farben.grund.ignoresSafeArea())
        .overlay(alignment: .bottom) { meldungsToast }
        .toolbar {
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
        // Bereich (Block bzw. Einzelstunde) gewechselt: Thema des neuen Bereichs übernehmen
        .onChange(of: daten.einzelstunde) { _, _ in
            themaUebernommen = false
            thema = ""
            speicherstand = .unveraendert
        }
        // Automatisch speichern: kurz nach der letzten Eingabe
        .task(id: thema) {
            guard themaGeaendert else { return }
            speicherstand = .ungesichert
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            guard !Task.isCancelled else { return }
            await themaSichern()
        }
        .onChange(of: fokus) { alt, _ in
            if alt == .thema && themaGeaendert { Task { await themaSichern() } }
        }
        .onDisappear {
            // Beim Verlassen (anderer Reiter, Schließen) den letzten Stand sichern
            guard themaGeaendert, daten.darf else { return }
            let text = thema.trimmingCharacters(in: .whitespacesAndNewlines)
            let d = daten
            Task { try? await d.speichern(thema: text) }
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
        .sheet(isPresented: $pruefungOffen) {
            NavigationStack {
                PruefungFormular(modus: .neu(Pruefungsvorlage.aus(karte, raeume: daten.raeume)), alsBlatt: true) { text in
                    pruefungOffen = false
                    melden(text)
                }
            }
            .environmentObject(zustand)
        }
        .confirmationDialog("Alle anwesend?", isPresented: $alleFragen, titleVisibility: .visible) {
            Button("Alle anwesend") { alleAnwesend() }
            Button("Abbrechen", role: .cancel) {}
        } message: {
            let z = zaehler
            Text("\(z.fehlt + z.spaet) eingetragene Abwesenheiten bzw. Verspätungen dieser Stunde werden entfernt; die Anwesenheit gilt als kontrolliert.")
        }
    }

    // MARK: Kopf („Stunde jetzt“)

    private var kopfAbschnitt: some View {
        Section {
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(karte.fachName.isEmpty ? karte.fach : karte.fachName)
                        .font(.title3.weight(.bold))
                        .foregroundStyle(Farben.text)
                        .lineLimit(1)
                    if !daten.klassen.isEmpty {
                        Text(daten.klassen.joined(separator: ", "))
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

    // MARK: Stand

    /// „Thema ✓ · Anwesenheit offen · Hausaufgabe –“ und – bei Doppelstunden – der Bereich der Einträge.
    private var standAbschnitt: some View {
        Section {
            HStack(spacing: 14) {
                standpunkt("Thema", erledigt: !gespeichertesThema.isEmpty || !geerbtesThema.isEmpty)
                standpunkt("Anwesenheit", erledigt: kontrolliert)
                standpunkt(hausaufgabenListe.isEmpty ? "Hausaufgabe" : "Hausaufgabe (\(hausaufgabenListe.count))",
                           erledigt: !hausaufgabenListe.isEmpty, optional: true)
                Spacer(minLength: 0)
            }
            .padding(.vertical, 2)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(standVorlesetext)
            if daten.hatEinzelstunden {
                bereichsMenue
            }
        }
    }

    private var standVorlesetext: String {
        let t = !gespeichertesThema.isEmpty || !geerbtesThema.isEmpty ? "Thema eingetragen" : "Thema offen"
        let a = kontrolliert ? "Anwesenheit kontrolliert" : "Anwesenheit offen"
        let h = hausaufgabenListe.isEmpty ? "keine Hausaufgabe" : "\(hausaufgabenListe.count) Hausaufgaben"
        return "\(t), \(a), \(h)"
    }

    /// Ein Punkt der Standzeile: Haken (erledigt), Kreis (offen) bzw. Strich (freiwillig, z. B. Hausaufgabe).
    private func standpunkt(_ titel: String, erledigt: Bool, optional: Bool = false) -> some View {
        HStack(spacing: 4) {
            Image(systemName: erledigt ? "checkmark.circle.fill" : (optional ? "minus.circle" : "circle"))
                .font(.footnote.weight(.semibold))
                .foregroundStyle(erledigt ? Farben.ok : Farben.text3)
            Text(titel)
                .font(.footnote.weight(.medium))
                .foregroundStyle(erledigt ? Farben.text : Farben.text2)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
    }

    /// Doppel- bzw. Blockstunde: Einträge für den ganzen Block oder nur eine Stunde.
    private var bereichsMenue: some View {
        Menu {
            Button {
                Task { await daten.bereichWaehlen(nil, kollegium: true) }
            } label: {
                Menuezeile(titel: "Ganzer Block (\(karte.von).–\(karte.bis). Stunde)", gewaehlt: daten.einzelstunde == nil)
            }
            ForEach(daten.blockStunden) { s in
                Button {
                    Task { await daten.bereichWaehlen(s.stunde, kollegium: true) }
                } label: {
                    Menuezeile(titel: "\(s.stunde). Stunde" + (s.beginn.isEmpty ? "" : " \(Detailmass.uhrzeit(s.beginn))–\(Detailmass.uhrzeit(s.ende))")
                               + (s.eintrag ? " •" : ""), gewaehlt: daten.einzelstunde == s.stunde)
                }
            }
        } label: {
            LabeledContent {
                HStack(spacing: 4) {
                    Text(daten.bereichText)
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.footnote.weight(.semibold))
                }
                .foregroundStyle(Farben.akzent)
            } label: {
                Text("Einträge gelten für")
                    .foregroundStyle(Farben.text)
            }
        }
    }

    // MARK: 1. Thema

    @ViewBuilder
    private var themaAbschnitt: some View {
        Section {
            if daten.darf {
                TextField("Thema der Stunde", text: $thema, axis: .vertical)
                    .lineLimit(1...4)
                    .focused($fokus, equals: .thema)
                    .submitLabel(.done)
                    .accessibilityLabel("Thema der Stunde")
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
            } else if daten.geladen {
                Text(gespeichertesThema.isEmpty ? (geerbtesThema.isEmpty ? "Noch kein Thema eingetragen" : "Block: \(geerbtesThema)") : gespeichertesThema)
                    .foregroundStyle(gespeichertesThema.isEmpty ? Farben.text3 : Farben.text)
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity)
            }
        } header: {
            HStack {
                Text("Thema / Lehrstoff")
                Spacer()
                if daten.darf {
                    Button {
                        planOffen = true
                    } label: {
                        Text(plan.isEmpty ? "Themenplan anlegen" : "Themenplan")
                            .font(.footnote.weight(.semibold))
                            .textCase(nil)
                    }
                }
            }
        } footer: {
            if daten.darf {
                speicherZeile
            }
        }
    }

    /// Statuszeile des automatischen Speicherns.
    @ViewBuilder
    private var speicherZeile: some View {
        switch speicherstand {
        case .unveraendert:
            if !geerbtesThema.isEmpty && gespeichertesThema.isEmpty {
                Text("Block: \(geerbtesThema) · eigenes Thema wird automatisch gespeichert")
            } else {
                Text(gespeichertesThema.isEmpty ? "Wird beim Tippen automatisch gespeichert." : "Gespeichert.")
            }
        case .ungesichert:
            Text("Wird gleich gespeichert …")
        case .speichert:
            Text("Speichert …")
        case .gespeichert(let zeit):
            Label("Automatisch gespeichert · \(Datumsformat.anzeige(zeit, "HH:mm"))", systemImage: "checkmark")
                .foregroundStyle(Farben.ok)
        case .offline:
            Label("Ohne Verbindung gesichert – wird gesendet, sobald das Gerät online ist.", systemImage: "icloud.slash")
                .foregroundStyle(Farben.warnung)
        case .fehler(let text):
            VStack(alignment: .leading, spacing: 4) {
                Label("Nicht gespeichert: \(text)", systemImage: "exclamationmark.triangle")
                    .foregroundStyle(Farben.entfall)
                Button("Erneut speichern") {
                    Task { await themaSichern() }
                }
                .font(.footnote.weight(.semibold))
            }
        }
    }

    /// Vorschlag für das Thema.
    struct Themenvorschlag: Hashable {
        let anzeige: String
        let uebernahme: String
        let symbol: String
    }

    /// Vorschläge: die nächsten Themen des Themenplans, Fortsetzung der letzten Stunde, weitere frühere Themen.
    private var themenVorschlaege: [Themenvorschlag] {
        var ergebnis: [Themenvorschlag] = []
        func hinzu(_ v: Themenvorschlag) {
            guard !v.uebernahme.isEmpty,
                  !ergebnis.contains(where: { $0.uebernahme.caseInsensitiveCompare(v.uebernahme) == .orderedSame }) else { return }
            ergebnis.append(v)
        }
        for t in Themenplan.naechste(plan, behandelt: vorstunden.map(\.thema)) {
            hinzu(Themenvorschlag(anzeige: t, uebernahme: t, symbol: "list.number"))
        }
        if let letzte = vorstunden.first {
            hinzu(Themenvorschlag(anzeige: "Fortsetzung: \(letzte.thema)", uebernahme: "Fortsetzung: \(letzte.thema)",
                                  symbol: "arrow.turn.down.right"))
        }
        for v in vorstunden.prefix(4) {
            hinzu(Themenvorschlag(anzeige: v.thema, uebernahme: v.thema, symbol: "clock.arrow.circlepath"))
        }
        return ergebnis
    }

    // MARK: 2. Anwesenheit

    private var anwesenheitText: String {
        guard liste != nil else { return daten.geladen ? "nicht verfügbar" : "wird geladen …" }
        if schueler.isEmpty { return "keine Schülerliste übertragen" }
        let z = zaehler
        var teile = ["\(z.da) anwesend"]
        if z.fehlt > 0 { teile.append("\(z.fehlt) abwesend") }
        if z.spaet > 0 { teile.append("\(z.spaet) verspätet") }
        return teile.joined(separator: " · ")
    }

    @ViewBuilder
    private var anwesenheitAbschnitt: some View {
        Section {
            NavigationLink {
                AnwesenheitSeite()
                    .environmentObject(daten)
                    .environmentObject(zustand)
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: kontrolliert ? "checkmark.seal.fill" : "person.crop.circle.badge.checkmark")
                        .font(.title2)
                        .foregroundStyle(kontrolliert ? Farben.ok : Farben.akzent)
                        .frame(width: 32)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Anwesenheitskontrolle")
                            .font(.headline)
                            .foregroundStyle(Farben.text)
                        Text(anwesenheitText)
                            .font(.subheadline)
                            .monospacedDigit()
                            .foregroundStyle(Farben.text2)
                        Text(kontrolliert ? "kontrolliert" : "noch nicht kontrolliert")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(kontrolliert ? Farben.ok : Farben.warnung)
                    }
                    Spacer(minLength: 4)
                    if !daten.geladen {
                        ProgressView()
                    }
                }
                .padding(.vertical, 6)
                .frame(minHeight: 56)
            }
            .accessibilityHint("Öffnet die Anwesenheit dieser Stunde")
            if anwesenheitBedienbar && !schueler.isEmpty {
                Button {
                    let z = zaehler
                    if z.fehlt + z.spaet > 0 {
                        alleFragen = true
                    } else {
                        alleAnwesend()
                    }
                } label: {
                    HStack {
                        Label(kontrolliert && zaehler.fehlt + zaehler.spaet == 0 ? "Alle anwesend – erneut bestätigen" : "Alle anwesend",
                              systemImage: "checkmark.circle")
                            .font(.body.weight(.semibold))
                        Spacer()
                        if alleArbeitet { ProgressView() }
                    }
                }
                .disabled(alleArbeitet)
                NavigationLink {
                    SchnellanwesenheitSeite(karte: karte)
                        .environmentObject(daten)
                        .environmentObject(zustand)
                } label: {
                    Label("Schnellerfassung (Wischen bzw. Namensraster)", systemImage: "hand.draw")
                }
            }
        } header: {
            Text("Anwesenheit")
        } footer: {
            if liste != nil && !anwesenheitBedienbar {
                Text("Anwesenheit nur in eigenen Stunden ab dem Tag der Stunde.")
            }
        }
    }

    // MARK: 3. Hausaufgaben

    @ViewBuilder
    private var hausaufgabeAbschnitt: some View {
        Section {
            ForEach(hausaufgabenListe) { h in
                VStack(alignment: .leading, spacing: 2) {
                    Text(h.text)
                        .foregroundStyle(Farben.text)
                    if let f = h.faellig, !f.isEmpty {
                        Text("fällig \(kurzdatum(String(f.prefix(10))))")
                            .font(.caption)
                            .foregroundStyle(Farben.text2)
                    }
                }
                .accessibilityElement(children: .combine)
            }
            if daten.darf {
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
                if !hausaufgabenListe.isEmpty {
                    NavigationLink {
                        HausaufgabenSeite()
                            .environmentObject(daten)
                            .environmentObject(zustand)
                    } label: {
                        Text("Hausaufgaben bearbeiten")
                    }
                }
            } else if hausaufgabenListe.isEmpty {
                Text(daten.geladen ? "Keine Hausaufgaben aufgegeben" : "Wird geladen …")
                    .foregroundStyle(Farben.text3)
            }
        } header: {
            Text("Hausaufgaben")
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
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .frame(minHeight: 36)
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

    // MARK: 4. Prüfung

    @ViewBuilder
    private var pruefungAbschnitt: some View {
        if zustand.darf("pruefung.anlegen") && !karte.istEntfall {
            Section {
                Button {
                    Haptik.tippen()
                    pruefungOffen = true
                } label: {
                    Label("Klausur/Prüfung eintragen", systemImage: "doc.badge.plus")
                }
            } header: {
                Text("Prüfung")
            } footer: {
                Text("Vorbelegt mit Datum, Stunden, Klassen und Raum dieser Stunde. Art, Thema, Dauer und Hinweis sind änderbar.")
            }
        }
    }

    // MARK: 5. Einträge

    private func name(_ id: Int?) -> String? {
        guard let id else { return nil }
        return schueler.first { $0.id == id }?.anzeige
    }

    @ViewBuilder
    private var eintragAbschnitt: some View {
        if !daten.klassen.isEmpty {
            Section {
                ForEach(daten.vermerke) { v in
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 6) {
                            Text(v.art)
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(Farben.text2)
                            Text(name(v.schuelerId) ?? "Klasse \(v.klasse)")
                                .font(.footnote)
                                .foregroundStyle(Farben.text3)
                                .lineLimit(1)
                        }
                        Text(v.text)
                            .foregroundStyle(Farben.text)
                            .lineLimit(3)
                    }
                    .accessibilityElement(children: .combine)
                }
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 130), spacing: 8)], spacing: 8) {
                    ForEach(StundeJetztSeite.vorlagen, id: \.self) { v in
                        Button {
                            Haptik.tippen()
                            vorlage = StundeJetztSeite.Eintragsvorlage(art: kategorie(v.art), text: v.text)
                        } label: {
                            Text(v.titel)
                                .font(.footnote.weight(.semibold))
                                .foregroundStyle(Farben.text)
                                .lineLimit(1)
                                .frame(maxWidth: .infinity, minHeight: 44)
                                .background(Farben.neutralFlaeche, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.vertical, 4)
                Button {
                    vorlage = StundeJetztSeite.Eintragsvorlage(art: daten.vermerkArten.first ?? "Vermerk", text: "")
                } label: {
                    Label("Eigener Eintrag …", systemImage: "square.and.pencil")
                }
                NavigationLink {
                    KlassenbuchSeite()
                        .environmentObject(daten)
                        .environmentObject(zustand)
                } label: {
                    Text("Alle Klassenbucheinträge")
                }
            } header: {
                HStack {
                    Text("Einträge")
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

    // MARK: 6. Notizen

    private var notizAbschnitt: some View {
        Section {
            NavigationLink {
                NotizSeite(art: .schueler)
                    .environmentObject(daten)
                    .environmentObject(zustand)
            } label: {
                notizZeile("Für Schüler*innen", daten.notizSchueler)
            }
            NavigationLink {
                NotizSeite(art: .lehrer)
                    .environmentObject(daten)
                    .environmentObject(zustand)
            } label: {
                notizZeile("Für Lehrkräfte", daten.notizLehrer)
            }
        } header: {
            Text("Notizen")
        }
    }

    private func notizZeile(_ titel: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(titel)
                .font(.footnote)
                .foregroundStyle(Farben.text2)
            Text(text.isEmpty ? "Keine Notiz" : text)
                .foregroundStyle(text.isEmpty ? Farben.text3 : Farben.text)
                .lineLimit(2)
                .truncationMode(.tail)
        }
    }

    // MARK: 7. Verlauf

    private var verlaufAbschnitt: some View {
        Section {
            ForEach(vorstunden.prefix(4)) { v in
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text(kurzdatum(v.datum))
                        .font(.footnote.weight(.semibold))
                        .monospacedDigit()
                        .foregroundStyle(Farben.text2)
                        .frame(minWidth: 64, alignment: .leading)
                    Text(v.thema)
                        .foregroundStyle(Farben.text)
                        .lineLimit(2)
                        .truncationMode(.tail)
                }
                .accessibilityElement(children: .combine)
            }
            NavigationLink {
                KursverlaufSeite(karte: karte, themenplan: plan)
                    .environmentObject(zustand)
            } label: {
                Label("Kursverlauf (Themen der letzten Wochen)", systemImage: "chart.bar.doc.horizontal")
            }
        } header: {
            Text("Verlauf")
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
                .accessibilityAddTraits(.updatesFrequently)
        }
    }

    private func melden(_ text: String) {
        withAnimation { meldung = daten.hinweis ?? text }
        daten.hinweis = nil
    }

    // MARK: Aktionen

    private func themaUebernehmen() {
        guard !themaUebernommen, daten.geladen else { return }
        themaUebernommen = true
        if thema.isEmpty { thema = daten.eintrag?.thema ?? "" }
    }

    /// Thema speichern (automatisch bzw. „Erneut speichern“) – ohne Verbindung in den Schreibpuffer.
    private func themaSichern() async {
        guard daten.darf else { return }
        while themaSpeichert {
            try? await Task.sleep(nanoseconds: 200_000_000)
        }
        guard themaGeaendert else {
            if speicherstand == .ungesichert { speicherstand = .unveraendert }
            return
        }
        let text = thema.trimmingCharacters(in: .whitespacesAndNewlines)
        themaSpeichert = true
        speicherstand = .speichert
        let vorher = puffer.anzahl
        defer { themaSpeichert = false }
        do {
            try await daten.speichern(thema: text)
            if puffer.anzahl > vorher {
                speicherstand = .offline
                daten.hinweis = nil
            } else {
                speicherstand = .gespeichert(Date())
            }
        } catch {
            Haptik.fehler()
            speicherstand = .fehler(zustand.fehlertext(error) ?? "unbekannter Fehler")
        }
    }

    private func alleAnwesend() {
        guard !alleArbeitet else { return }
        alleArbeitet = true
        Haptik.auswahl()
        Task {
            do {
                let gesendet = try await daten.alleAnwesendSetzen()
                Haptik.erfolg()
                melden(gesendet ? "Alle anwesend – Anwesenheit kontrolliert" : "Alle anwesend (wird gesendet)")
            } catch {
                Haptik.fehler()
                fehler = zustand.fehlertext(error)
            }
            alleArbeitet = false
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
            fehler = zustand.fehlertext(error)
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
                fehler = zustand.fehlertext(error)
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
