import SwiftUI

/// Reiter „Heute“ – ruhig, sachlich und grafisch statt wortreich (design/DESIGN.md, Abschnitte 9 und 10.1 „Heute“):
/// 1. Unter dem großen Titel eine Tageszeile („Dienstag, 20. Oktober · A-Woche“).
/// 2. **Tagesband**: der ganze Schultag als schmale Leiste (Stunden nach ihrer Dauer, Pausen als Lücken, Farben wie die
///    Stundenkarten, Jetzt-Linie mit Uhrzeit, Aufsichten als kleine Marke). Antippen öffnet den Tag im Plan.
/// 3. **Fokuskarte** „Jetzt“ bzw. „Als Nächstes“: Fach groß, Raum, Lehrkraft bzw. Klasse, rechts groß die Restzeit, bei
///    der laufenden Stunde ein Fortschrittsbalken; Lehrkräfte unten „Klassenbuch erfassen“ bzw. „nachtragen“. Nach
///    Schulschluss die erste Stunde des nächsten Schultags.
/// 4. **Tageszahlen** (nur Werte über null, höchstens vier): Änderungen, Klassenbuch offen bzw. Hausaufgaben und
///    Prüfungen, Aufsichten, neue Nachrichten, Termine – jede Zahl führt zu ihrer Seite. Ersetzt die früheren Textblöcke
///    „Zu erledigen“ und „Demnächst“.
/// 5. **Notizen der Schule** (Mitteilungen, Veranstaltungen, Hinweise) als stille gelbe Notizen, höchstens zwei.
/// 6. **Stunden** – alle Stunden des Tages als kompakte Stundenkarten (v6) mit Beginn und Ende links.
/// 7. Nächster Schultag und Übersicht hinter **„Mehr anzeigen“**; ganz unten klein „Stand EduOrga Studio“ und die Schule.
/// Eine Ebene (keine Karten in Karten), keine Symbol-Kacheln, keine Verläufe, ein Akzent (Petrol für „Jetzt“).
/// Der letzte Stand bleibt im Speicher (`Heutespeicher`); neu geladen wird im Hintergrund.
struct HeuteView: View {
    @EnvironmentObject var zustand: AppZustand
    @Namespace private var zoom
    @State private var heute: Heute? = nil
    @State private var laedt = false
    @State private var fehler: String? = nil
    @State private var ferien: Ferienzeit? = nil
    @State private var sprechtage: [SprechtagKarte] = []
    @State private var sprechtagWahl: SprechtagWahl? = nil
    @State private var wahl: Stundenwahl? = nil
    /// Zeitpunkt des gezeigten Stands und ob er seit dem letzten Anstoß (Vordergrund, Push) bestätigt ist
    @State private var stand: Date? = nil
    @State private var bestaetigt = false
    /// „Stunde jetzt“ (Klassenbuch-Schnellerfassung) für diese Karte
    @State private var jetztKarte: Karte? = nil
    /// Nächster Schultag (Datum und Stunden) für die Fokuskarte nach Schulschluss und „Mehr anzeigen“
    @State private var morgen: (datum: String, kacheln: [Kachel])? = nil
    /// Prüfungen dieser Woche (Schüler*innen, Eltern)
    @State private var pruefungen: [Pruefung] = []
    /// „Mehr anzeigen“ aufgeklappt (auf dem Gerät gemerkt)
    @AppStorage("heuteMehrOffen") private var mehrOffen = false
    @Environment(\.horizontalSizeClass) private var groessenklasse

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 3 * Stilmass.raster) {
                    kopf
                    // Gezeigt wird der letzte Stand aus dem Speicher, bis die frische Antwort da ist
                    if heute != nil, !bestaetigt, let stand {
                        Standhinweis(stand: stand, laedt: laedt)
                    }
                    if let fehler {
                        Fehlerhinweis(text: fehler)
                    }
                    if let h = heute {
                        if h.paket {
                            tagesbereich(h)
                            mehrbereich(h)
                        } else {
                            HeuteHinweiskarte(titel: "Noch keine Plandaten", text: "Die Schule hat noch keinen Plan veröffentlicht.")
                        }
                    } else if laedt {
                        Platzhaltertag()
                            .padding(.leading, -Stilmass.zeitspalte)
                    }
                    fussnote
                }
                .padding(.horizontal, Stilmass.rand)
                .padding(.top, 4)
                .padding(.bottom, 4 * Stilmass.raster)
                .frame(maxWidth: 680)
                .frame(maxWidth: .infinity)
            }
            .background(Farben.grund.ignoresSafeArea())
            .refreshable {
                // Ziehen zum Aktualisieren: auch die zwischengespeicherten Wochen des Plans veralten
                Kachelspeicher.veralten()
                bestaetigt = false
                await laden()
                Haptik.erfolg()
            }
            .onAppear(perform: ausSpeicher)
            .task { await laden() }
            // App im Vordergrund, Push bzw. angetippte Mitteilung: sofort frisch laden
            .onChange(of: zustand.frischeAnfrage) { _, _ in
                bestaetigt = false
                Task { await laden() }
            }
            .navigationTitle("Heute")
            .navigationBarTitleDisplayMode(.large)
            .suchWerkzeug()
            .navigationDestination(for: Startziel.self) { ziel in
                Startzielseite(ziel: ziel, heute: heute, sprechtage: sprechtage) { karte in
                    wahl = Stundenwahl(quelle: "liste-\(karte.id.uuidString)", karten: [karte], typ: heute?.typ ?? "klasse",
                                       element: heute?.element ?? "")
                }
                .environmentObject(zustand)
            }
            .navigationDestination(for: Schulziel.self) { ziel in
                Schulzielseite(ziel: ziel)
                    .environmentObject(zustand)
            }
            .detailPraesentation(item: $sprechtagWahl, breit: groessenklasse == .regular) { w in
                NavigationStack {
                    SprechtagView(id: w.id, titel: w.titel, karte: sprechtage.first { $0.id == w.id })
                }
                .environmentObject(zustand)
            }
            .onChange(of: sprechtagWahl?.id) { _, neu in
                if neu == nil { Task { await laden() } }
            }
        }
        .stundenBuehne($wahl, raum: zoom, zustand: zustand)
        .fullScreenCover(item: $jetztKarte, onDismiss: {
            Task { await laden() }
        }) { karte in
            StundeJetztSeite(karte: karte)
                .environmentObject(zustand)
                .environment(\.kartendarstellung, zustand.darstellung)
        }
    }

    // MARK: - Kopf und Fußnote

    /// Heute unterrichtsfrei (Ferien, Feiertag, freier Tag) – aus `kalender` bzw. bei älteren Servern aus dem Wochenplan.
    private func freiHeute(_ h: Heute) -> Freizeitraum? {
        if let k = h.kalender { return k.frei }
        guard let f = h.ferien ?? ferien, h.karten.isEmpty else { return nil }
        return Freizeitraum(name: f.titel, von: f.von, bis: f.bis, art: "ferien")
    }

    /// Das tatsächliche Datum (in den Ferien und am Wochenende liefert der Server schon den nächsten Schultag).
    private var heuteIso: String {
        heute?.kalender?.heute ?? Datumsformat.iso(Date())
    }

    /// Kopf unter dem großen Titel: Wochentag und Datum groß (ohne Begrüßung), darunter Woche bzw. „Ferien“ – zwei
    /// ruhige Zeilen statt eines Satzes.
    private var kopf: some View {
        let frei = heute.flatMap { freiHeute($0) }
        let datum = heuteIso
        var zusatz: [String] = []
        if frei == nil, let h = heute, h.datum.prefix(10) == datum.prefix(10), !h.woche.isEmpty {
            zusatz.append(h.woche.count == 1 ? "\(h.woche)-Woche" : h.woche)
        }
        if let d = Datumsformat.datum(datum) {
            zusatz.append("KW \(Datumsformat.kalenderwoche(d))")
        }
        if let f = frei { zusatz.append(f.name.isEmpty ? Kalendertext.art(f) : f.name) }
        return VStack(alignment: .leading, spacing: 2) {
            Text(Datumsformat.anzeige(datum, "EEEE, d. MMMM"))
                .font(.title3.weight(.semibold))
                .foregroundStyle(Farben.text)
            if !zusatz.isEmpty {
                Text(zusatz.joined(separator: " · "))
                    .font(.subheadline)
                    .monospacedDigit()
                    .foregroundStyle(Farben.text2)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }

    /// Ganz unten klein: Stand aus EduOrga Studio (getrennt von der Ladezeit der App) und die Schule.
    private var fussnote: some View {
        VStack(alignment: .leading, spacing: 2) {
            StudiostandZeile(stand: Studiostand.stand(zustand), abgerufen: bestaetigt ? stand : nil)
            if !zustand.schulname.isEmpty {
                Text(zustand.schulname)
                    .font(.caption)
                    .foregroundStyle(Farben.text3)
                    .lineLimit(2)
            }
        }
        .padding(.top, Stilmass.raster)
    }

    // MARK: - Der Tag

    private func kacheln(_ h: Heute) -> [Kachel] {
        let ich = (h.element ?? "").uppercased()
        var liste = h.karten.compactMap { Kachelbau.ausKarte($0, typ: h.typ.isEmpty ? "klasse" : h.typ, ich: ich, raster: []) }
        liste += h.aufsichten.map { Kachelbau.aufsichtKachel($0, raster: [], ich: ich) }
        return liste.sorted { ($0.beginn, $0.rang) < ($1.beginn, $1.rang) }
    }

    /// Hinweis „abwesend …“ bzw. „Klasse abwesend …“ des Tages.
    private func abwesenheitsHinweis(_ h: Heute) -> String? {
        h.hinweise.first { hinweis in
            let klein = hinweis.lowercased()
            return klein.hasPrefix("abwesend") || klein.hasPrefix("klasse abwesend")
        }
    }

    /// „Klassenbuch erfassen“ in der Fokuskarte: öffnet „Stunde jetzt“ für diese Stunde (nil = keine Stunde mit Unterricht).
    private func klassenbuchAktion(_ ziel: Kachel?) -> (() -> Void)? {
        guard let karte = ziel?.karte else { return nil }
        return { jetztKarte = karte }
    }

    /// Stunde öffnen – Stunden des nächsten Schultags (Fokuskarte nach Schulschluss) mit ihren Nachbarn.
    private func oeffnenAusFokus(_ k: Kachel, alle: [Kachel], h: Heute, quelle: String) {
        if let m = morgen, k.datum.prefix(10) == m.datum.prefix(10), k.datum.prefix(10) != h.datum.prefix(10) {
            oeffnen(k, alle: m.kacheln, h: h, quelle: quelle)
        } else {
            oeffnen(k, alle: alle, h: h, quelle: quelle)
        }
    }

    @ViewBuilder
    private func tagesbereich(_ h: Heute) -> some View {
        let alle = kacheln(h)
        let istHeute = Datumsformat.istHeute(h.datum)
        let stunden = alle.filter { $0.aufsicht == nil }
        let ziel = zustand.istKollegium && istHeute ? StundeJetztWahl.ziel(alle) : nil
        if h.gesperrt {
            let hinweis = (h.sperrhinweis ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            HeuteHinweiskarte(titel: "Nicht freigegeben",
                              text: hinweis.isEmpty ? "Dieser Zeitraum ist für Ihr Konto noch nicht einsehbar." : hinweis)
        } else if let frei = freiHeute(h) {
            // Ferien bzw. freier Tag: ruhige Ferienfläche statt leerer Stunden; darunter der nächste Schultag
            let schultag = h.kalender?.naechsterSchultag ?? ""
            let tagIso = schultag.isEmpty ? (stunden.isEmpty ? "" : h.datum) : schultag
            HeuteFerienKarte(frei: frei, heute: heuteIso, naechsterSchultag: tagIso,
                             ersteStunde: stunden.first { Statuslehre.findetStatt($0) }) {
                zustand.tagAnfrage = tagIso.isEmpty ? h.datum : tagIso
                zustand.reiter = .plan
            }
            Tageszahlen(zahlen: tageszahlen(h, alle: alle)) {
                zustand.reiter = .postfach
            }
            hinweisbereich(h)
            if let k = h.kalender { HeuteKalenderliste(kalender: k) }
            if !stunden.isEmpty {
                stundenliste(stunden, alle: alle, h: h, istHeute: false)
            }
        } else {
            if !istHeute, h.kalender != nil, !stunden.isEmpty {
                // Wochenende: der Server zeigt schon den nächsten Schultag
                Text("Nächster Schultag: " + Datumsformat.anzeige(h.datum, "EEEE, d. MMMM"))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Farben.text2)
            }
            if stunden.isEmpty && morgen == nil {
                HeuteHinweiskarte(titel: "Kein Unterricht",
                                  text: istHeute ? "Heute ist kein Unterricht geplant." : "An diesem Tag ist kein Unterricht geplant.")
            }
            if !stunden.isEmpty {
                tagesbandKnopf(alle, h: h, istHeute: istHeute)
            }
            HeuteFokus(kacheln: alle, istHeute: istHeute, naechsterTag: morgen, raum: zoom,
                       klassenbuchZiel: ziel,
                       klassenbuch: klassenbuchAktion(ziel)) { k, quelle in
                oeffnenAusFokus(k, alle: alle, h: h, quelle: quelle)
            }
            Tageszahlen(zahlen: tageszahlen(h, alle: alle)) {
                zustand.reiter = .postfach
            }
            hinweisbereich(h)
            if !stunden.isEmpty {
                stundenliste(stunden, alle: alle, h: h, istHeute: istHeute)
            }
            if let k = h.kalender { HeuteKalenderliste(kalender: k) }
        }
    }

    /// Tagesband; Antippen öffnet den Tag im Reiter „Plan“.
    private func tagesbandKnopf(_ alle: [Kachel], h: Heute, istHeute: Bool) -> some View {
        Button {
            Haptik.tippen()
            zustand.tagAnfrage = h.datum
            zustand.reiter = .plan
        } label: {
            Tagesband(kacheln: alle, istHeute: istHeute, familie: !zustand.istKollegium)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityHint("Öffnet den Tag im Reiter „Plan“")
    }

    /// Überschrift „Stunden“ (bzw. der Wochentag) mit „Im Plan“, darunter die Stunden als kompakte Karten – ohne Fläche
    /// dahinter (keine Karten in Karten).
    private func stundenliste(_ stunden: [Kachel], alle: [Kachel], h: Heute, istHeute: Bool) -> some View {
        VStack(alignment: .leading, spacing: Stilmass.raster) {
            HStack(alignment: .firstTextBaseline) {
                Text(istHeute ? "Stunden" : Datumsformat.anzeige(h.datum, "EEEE, d.M."))
                    .font(.headline)
                    .foregroundStyle(Farben.text)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: Stilmass.raster)
                Button {
                    Haptik.tippen()
                    zustand.tagAnfrage = h.datum
                    zustand.reiter = .plan
                } label: {
                    Text("Im Plan")
                        .font(.subheadline.weight(.semibold))
                }
                .accessibilityHint("Öffnet den Tag im Reiter „Plan“")
            }
            TimelineView(.periodic(from: .now, by: 60)) { kontext in
                let m = Uhr.minuten(kontext.date)
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(stunden, id: \.id) { k in
                        HeuteStundenzeile(kachel: k,
                                          vergangen: istHeute && k.ende <= m,
                                          laeuft: istHeute && Statuslehre.findetStatt(k) && k.beginn <= m && m < k.ende) {
                            oeffnen(k, alle: alle, h: h, quelle: "heute-\(k.id.uuidString)")
                        }
                        .zoomQuelle("heute-\(k.id.uuidString)", in: zoom)
                    }
                }
            }
        }
    }

    private func oeffnen(_ k: Kachel, alle: [Kachel], h: Heute, quelle: String) {
        Haptik.tippen()
        let typ = h.typ.isEmpty ? "klasse" : h.typ
        if let a = k.aufsicht {
            wahl = Stundenwahl(quelle: quelle, karten: [], aufsicht: a, typ: typ, element: h.element ?? "")
            return
        }
        let karten = Kachelbau.parallele(k, in: alle)
        guard !karten.isEmpty else { return }
        let start = karten.firstIndex { $0.id == k.karte?.id } ?? 0
        wahl = Stundenwahl(quelle: quelle, karten: karten, start: start, typ: typ, element: h.element ?? "")
    }

    // MARK: - Tageszahlen

    private var morgenIso: String {
        Datumsformat.iso(Datumsformat.tage(1, nach: Date()))
    }

    /// Zahlen für die Zahlenleiste (nur Werte über null werden gezeigt, höchstens vier – in dieser Reihenfolge).
    private func tageszahlen(_ h: Heute, alle: [Kachel]) -> [Tageszahl] {
        let familie = !zustand.istKollegium
        let geaendert: Int = alle.filter { $0.aenderung(familie: familie) != nil }.count
        var liste: [Tageszahl] = []
        liste.append(Tageszahl(id: "aenderungen", zahl: geaendert, titel: geaendert == 1 ? "Änderung" : "Änderungen",
                               farbe: Farben.aenderungSchrift, ziel: .start(.aenderungen),
                               vorlesen: geaendert == 1 ? "1 geänderte Stunde" : "\(geaendert) geänderte Stunden"))
        if zustand.istKollegium {
            let offen = zustand.offeneStunden
            liste.append(Tageszahl(id: "klassenbuch", zahl: offen, titel: "Klassenbuch offen", farbe: Farben.warnung,
                                   ziel: .schule(.offeneStunden),
                                   vorlesen: offen == 1 ? "1 Klassenbuch-Eintrag offen" : "\(offen) Klassenbuch-Einträge offen"))
            let aufsichten = h.aufsichten.count
            liste.append(Tageszahl(id: "aufsichten", zahl: aufsichten, titel: aufsichten == 1 ? "Aufsicht" : "Aufsichten",
                                   ziel: .start(.aufsichten),
                                   vorlesen: aufsichten == 1 ? "1 Pausenaufsicht heute" : "\(aufsichten) Pausenaufsichten heute"))
        } else {
            let faellig = h.hausaufgaben.filter { ($0.faellig ?? "").prefix(10) == morgenIso.prefix(10) }.count
            liste.append(Tageszahl(id: "hausaufgaben", zahl: faellig, titel: "Hausaufgaben morgen", ziel: .start(.hausaufgaben),
                                   vorlesen: faellig == 1 ? "1 Hausaufgabe für morgen" : "\(faellig) Hausaufgaben für morgen"))
            let heuteIso = Datumsformat.iso(Date())
            let woche = pruefungen.filter { $0.datum >= heuteIso }.count
            liste.append(Tageszahl(id: "pruefungen", zahl: woche, titel: woche == 1 ? "Prüfung diese Woche" : "Prüfungen diese Woche",
                                   farbe: Farben.pruefung, ziel: .schule(.pruefungen),
                                   vorlesen: woche == 1 ? "1 Prüfung diese Woche" : "\(woche) Prüfungen diese Woche"))
        }
        let neu = zustand.ungelesen
        liste.append(Tageszahl(id: "postfach", zahl: neu, titel: neu == 1 ? "Neue Nachricht" : "Neue Nachrichten",
                               farbe: Farben.akzent, ziel: .postfach,
                               vorlesen: neu == 1 ? "1 neue Nachricht" : "\(neu) neue Nachrichten"))
        let termine = h.termine.count
        liste.append(Tageszahl(id: "termine", zahl: termine, titel: termine == 1 ? "Termin" : "Termine", ziel: .start(.termine),
                               vorlesen: termine == 1 ? "1 Termin" : "\(termine) Termine"))
        return liste
    }

    // MARK: - Mehr anzeigen

    /// Alles Weitere hinter „Mehr anzeigen“: nächster Schultag, Übersicht.
    @ViewBuilder
    private func mehrbereich(_ h: Heute) -> some View {
        VStack(alignment: .leading, spacing: 3 * Stilmass.raster) {
            Button {
                Haptik.auswahl()
                withAnimation(.easeInOut(duration: 0.2)) { mehrOffen.toggle() }
            } label: {
                HStack(spacing: 6) {
                    Text(mehrOffen ? "Weniger anzeigen" : "Mehr anzeigen")
                        .font(.subheadline.weight(.semibold))
                    Image(systemName: mehrOffen ? "chevron.up" : "chevron.down")
                        .font(.caption.weight(.semibold))
                        .accessibilityHidden(true)
                    Spacer(minLength: 0)
                }
                .foregroundStyle(Farben.akzent)
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint(mehrOffen ? "Blendet nächsten Schultag und Übersicht aus"
                                         : "Zeigt nächsten Schultag und Übersicht")
            if mehrOffen {
                morgenbereich(h)
                uebersicht(h)
            }
        }
    }

    // MARK: - Nächster Schultag

    @ViewBuilder
    private func morgenbereich(_ h: Heute) -> some View {
        if let m = morgen, !m.kacheln.isEmpty {
            let stunden = m.kacheln.filter { $0.karte != nil && !$0.inPause }
            let erste = stunden.first { Statuslehre.findetStatt($0) }
            let familie = !zustand.istKollegium
            let geaendert = stunden.compactMap { k in k.aenderung(familie: familie).map { (k, $0) } }
            HeuteGruppe(titel: "Nächster Schultag", zusatz: Datumsformat.anzeige(m.datum, "EEEE, d.M.")) {
                if let erste {
                    HeuteZeile(titel: "Beginn \(Uhr.uhrzeit(erste.beginn)) · \(erste.anzeigeTitel)",
                               untertitel: [erste.von > 0 ? erste.stundenText : "", erste.zeile("raum")?.text ?? ""]
                                .filter { !$0.isEmpty }.joined(separator: " · ")) {
                        zustand.tagAnfrage = m.datum
                        zustand.reiter = .plan
                    }
                } else {
                    HeuteZeile(titel: "Kein Unterricht")
                }
                ForEach(Array(geaendert.prefix(4).enumerated()), id: \.offset) { _, e in
                    HeuteTrenner()
                    AenderungZeile(kachel: e.0, aenderung: e.1) {
                        zustand.tagAnfrage = m.datum
                        zustand.reiter = .plan
                    }
                }
            }
        }
    }

    // MARK: - Hinweise der Schule

    private func infos(_ h: Heute) -> [Tagesinfo] {
        var liste: [Tagesinfo] = []
        let abwesend = abwesenheitsHinweis(h)
        if let abwesend {
            liste.append(Tagesinfo(art: .hinweis, titel: "Abwesenheit", text: abwesend))
        }
        for n in h.nachrichten {
            if let bereich = n.range(of: ": "), n.distance(from: n.startIndex, to: bereich.lowerBound) <= 60 {
                liste.append(Tagesinfo(art: .nachricht, titel: String(n[..<bereich.lowerBound]), text: String(n[bereich.upperBound...])))
            } else {
                liste.append(Tagesinfo(art: .nachricht, titel: "Nachricht", text: n))
            }
        }
        for e in h.ereignisse {
            var text = e.ganztaegig ? "Ganztägig" : (e.von == e.bis ? "\(e.von). Stunde" : "\(e.von).–\(e.bis). Stunde")
            if !e.klassen.isEmpty { text += " · " + e.klassen.joined(separator: ", ") }
            liste.append(Tagesinfo(art: .veranstaltung, titel: e.titel.isEmpty ? e.art : e.titel, text: text))
        }
        for hinweis in h.hinweise where hinweis != abwesend {
            liste.append(Tagesinfo(art: .hinweis, titel: "Hinweis", text: hinweis))
        }
        return liste
    }

    /// Höchstens zwei stille Notizen; „Alle … Hinweise“ zeigt alles vollständig.
    @ViewBuilder
    private func hinweisbereich(_ h: Heute) -> some View {
        let liste = infos(h)
        if !liste.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                ForEach(Array(liste.prefix(2))) { info in
                    NavigationLink {
                        HeuteHinweiseSeite(infos: liste)
                    } label: {
                        HeuteNotiz(info: info)
                    }
                    .buttonStyle(KachelDruckStil())
                }
                if liste.count > 2 {
                    NavigationLink {
                        HeuteHinweiseSeite(infos: liste)
                    } label: {
                        Text("Alle \(liste.count) Hinweise der Schule")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Farben.akzent)
                            .frame(minHeight: 44, alignment: .leading)
                    }
                }
            }
        }
    }

    // MARK: - Übersicht

    private struct Listeneintrag: Identifiable {
        let ziel: Startziel
        let titel: String
        let zahl: Int
        var untertitel: String? = nil
        var id: Startziel { ziel }
    }

    private func eintraege(_ h: Heute) -> [Listeneintrag] {
        var liste: [Listeneintrag] = [Listeneintrag(ziel: .termine, titel: "Meine Termine", zahl: h.termine.count)]
        if zustand.istKollegium {
            liste.append(Listeneintrag(ziel: .abwesenheiten, titel: "Meine Abwesenheiten", zahl: 0))
            if zustand.entschuldigungsrechte?.irgendwas == true {
                liste.append(Listeneintrag(ziel: .entschuldigungen, titel: "Entschuldigungen", zahl: 0))
            }
            if !h.aufsichten.isEmpty {
                liste.append(Listeneintrag(ziel: .aufsichten, titel: "Pausenaufsichten heute", zahl: h.aufsichten.count))
            }
        } else if zustand.istFamilie {
            liste.append(Listeneintrag(ziel: .familieAbwesenheiten, titel: "Meine Abwesenheiten", zahl: 0))
        }
        if !h.hausaufgaben.isEmpty || h.typ == "klasse" {
            liste.append(Listeneintrag(ziel: .hausaufgaben, titel: "Hausaufgaben", zahl: h.hausaufgaben.count))
        }
        for t in sprechtage {
            liste.append(Listeneintrag(ziel: .sprechtag(t.id), titel: t.titel, zahl: t.termine, untertitel: t.untertitel))
        }
        return liste
    }

    private func uebersicht(_ h: Heute) -> some View {
        let liste = eintraege(h)
        return VStack(alignment: .leading, spacing: 8) {
            Text("Übersicht")
                .font(.headline)
                .foregroundStyle(Farben.text)
                .accessibilityAddTraits(.isHeader)
            VStack(spacing: 0) {
                ForEach(Array(liste.enumerated()), id: \.offset) { i, e in
                    if i > 0 { Divider().padding(.leading, 16) }
                    if case .sprechtag(let sid) = e.ziel {
                        Button {
                            sprechtagWahl = SprechtagWahl(id: sid, titel: e.titel)
                        } label: {
                            Uebersichtszeile(titel: e.titel, untertitel: e.untertitel, zahl: e.zahl, pfeil: true)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 12)
                        }
                        .buttonStyle(ZeilenKnopfStil())
                    } else {
                        NavigationLink(value: e.ziel) {
                            Uebersichtszeile(titel: e.titel, untertitel: e.untertitel, zahl: e.zahl, pfeil: true)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 12)
                        }
                        .buttonStyle(ZeilenKnopfStil())
                    }
                }
            }
            .kartenflaeche()
            .clipShape(RoundedRectangle(cornerRadius: Stilmass.radius, style: .continuous))
        }
    }

    // MARK: - Laden

    /// Letzten Stand sofort zeigen (ohne Warten auf das Netz).
    private func ausSpeicher() {
        guard heute == nil, let h = Heutespeicher.heute else { return }
        heute = h
        stand = Heutespeicher.stand
        bestaetigt = false
        ferien = Heutespeicher.ferien
        sprechtage = Heutespeicher.sprechtage
    }

    /// Erst den Tag laden (erscheint sofort), danach Rechte und Sprechtage.
    private func laden() async {
        laedt = true
        defer { laedt = false }
        let api = zustand.api
        async let sprechtagListe = try? api.sprechtagStart()
        do {
            let neu = try await api.heute()
            heute = neu
            stand = Date()
            bestaetigt = true
            Heutespeicher.stand = stand
            Heutespeicher.veraltet = false
            if zustand.ungelesen != neu.ungelesen { zustand.ungelesen = neu.ungelesen }
            if zustand.offeneStunden != neu.offeneStunden { zustand.offeneStunden = neu.offeneStunden }
            fehler = nil
            if neu.ferien == nil && neu.kalender == nil {
                ferien = await ferienSuchen(neu)
            } else {
                ferien = nil
            }
        } catch {
            if let text = zustand.fehlertext(error) { fehler = text }
        }
        await zustand.entschuldigungsrechteLaden(neu: true)
        let geladen = await sprechtagListe
        if let ausHeute = heute?.sprechtage, !ausHeute.isEmpty || geladen == nil {
            sprechtage = ausHeute
        } else if let geladen {
            sprechtage = geladen
        }
        Heutespeicher.heute = heute
        Heutespeicher.ferien = ferien
        Heutespeicher.sprechtage = sprechtage
        if let h = heute {
            await morgenLaden(h)
            if !zustand.istKollegium { await pruefungenLaden() }
        }
    }

    /// Nächster Schultag (Montag bis Freitag) aus dem eigenen Wochenplan.
    private func morgenLaden(_ h: Heute) async {
        guard h.paket, !h.gesperrt, let element = h.element, !element.isEmpty, let tag = Datumsformat.datum(h.datum) else { return }
        var ziel = Datumsformat.tage(1, nach: tag)
        while [1, 7].contains(Datumsformat.kalender.component(.weekday, from: ziel)) {
            ziel = Datumsformat.tage(1, nach: ziel)
        }
        let iso = Datumsformat.iso(ziel)
        let typ = h.typ.isEmpty ? "klasse" : h.typ
        guard let plan = try? await zustand.api.plan(typ: typ, element: element, datum: ziel) else { return }
        let ich = element.uppercased()
        let liste = plan.karten.filter { $0.datum.prefix(10) == iso.prefix(10) }
            .compactMap { Kachelbau.ausKarte($0, typ: typ, ich: ich, raster: []) }
            .sorted { ($0.beginn, $0.rang) < ($1.beginn, $1.rang) }
        morgen = (iso, liste)
    }

    /// Prüfungen ab heute bis Sonntag (Klassenkonten: die eigene Klasse).
    private func pruefungenLaden() async {
        let heute = Date()
        let sonntag = Datumsformat.tage(6, nach: Datumsformat.montag(heute))
        if let liste = try? await zustand.api.pruefungen(von: Datumsformat.iso(heute), bis: Datumsformat.iso(sonntag)) {
            pruefungen = liste
        }
    }

    /// Ferien aus dem Wochenplan, wenn der Tag ohne Stunden ist (ältere Server liefern sie nicht in /heute).
    private func ferienSuchen(_ h: Heute) async -> Ferienzeit? {
        guard h.paket, !h.gesperrt, h.karten.isEmpty, let element = h.element, !element.isEmpty,
              let tag = Datumsformat.datum(h.datum) else { return nil }
        let typ = h.typ.isEmpty ? "klasse" : h.typ
        var tage: [Tageskopf] = []
        for versatz in [0, 7] {
            guard let d = Datumsformat.kalender.date(byAdding: .day, value: versatz, to: tag),
                  let plan = try? await zustand.api.plan(typ: typ, element: element, datum: d) else { continue }
            tage += plan.tage
        }
        guard let erster = tage.filter({ $0.datum >= h.datum }).sorted(by: { $0.datum < $1.datum }).first,
              erster.frei, (erster.freiArt ?? "").lowercased() == "ferien" else { return nil }
        let grund = (erster.freiGrund ?? "").trimmingCharacters(in: .whitespaces)
        return Ferienzeit(titel: grund.isEmpty ? "Ferien" : grund, von: erster.freiVon ?? erster.datum, bis: erster.freiBis ?? "")
    }
}

/// Überschrift eines Bereichs (halbfett, ohne Symbol).
struct Abschnittstitel: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.title3.weight(.bold))
            .foregroundStyle(Farben.text)
            .accessibilityAddTraits(.isHeader)
    }
}
