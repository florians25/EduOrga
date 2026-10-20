import SwiftUI

/// Reiter „Heute“ – ruhig, dicht, sachlich: oben Datum, Schule und „Stand EduOrga Studio“ (getrennt von der Ladezeit der
/// App); die Jetzt-Karte (laufende Stunde mit Restzeit, nächste Stunde); „Änderungen heute“ (Zahl und je Stunde, was sich
/// geändert hat – Grün Änderung, Rot nur Entfall, Grau offene Vertretung); der Tag als kompakte Liste (vergangene Stunden
/// eingeklappt, Termine einzeilig); für Lehrkräfte „Klassenbuch“ (offene Stunden, Stunde jetzt) und die Aufsichten, für
/// Schüler*innen und Eltern „Für morgen“ (fällige Hausaufgaben, Prüfungen dieser Woche, neue Mitteilungen); „Heute an
/// der Schule“ (Nachrichten, Veranstaltungen, Hinweise); „Nächster Schultag“ (erste Stunde und Änderungen) und die
/// Übersicht. Der letzte Stand bleibt im Speicher (`Heutespeicher`); neu geladen wird im Hintergrund.
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
    @State private var vergangeneZeigen = false
    /// Zeitpunkt des gezeigten Stands und ob er seit dem letzten Anstoß (Vordergrund, Push) bestätigt ist
    @State private var stand: Date? = nil
    @State private var bestaetigt = false
    /// „Stunde jetzt“ (Klassenbuch-Schnellerfassung) für diese Karte
    @State private var jetztKarte: Karte? = nil
    /// Nächster Schultag (Datum und Stunden) für die Vorschau
    @State private var morgen: (datum: String, kacheln: [Kachel])? = nil
    /// Prüfungen dieser Woche (Schüler*innen, Eltern)
    @State private var pruefungen: [Pruefung] = []
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
                            if zustand.istKollegium {
                                kollegiumsbereich(h)
                            } else {
                                familienbereich(h)
                            }
                            schulbereich(h)
                            morgenbereich(h)
                            uebersicht(h)
                        } else {
                            Hinweisfeld(titel: "Noch keine Plandaten", text: "Die Schule hat noch keinen Plan veröffentlicht.",
                                        symbol: "tray", flaeche: Farben.flaeche)
                        }
                    } else if laedt {
                        Platzhaltertag()
                            .padding(.leading, -Stilmass.zeitspalte)
                    }
                }
                .padding(.horizontal, Stilmass.rand)
                .padding(.bottom, 4 * Stilmass.raster)
                .frame(maxWidth: 760)
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

    // MARK: - Kopf

    /// Unter dem großen Titel: Datum, Woche und Schule.
    private var kopf: some View {
        let datum = heute?.datum ?? Datumsformat.iso(Date())
        return VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline, spacing: Stilmass.raster) {
                Text(Datumsformat.anzeige(datum, "EEEE, d. MMMM"))
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Farben.akzent)
                if let w = heute?.woche, !w.isEmpty {
                    Text(w.count == 1 ? "\(w)-Woche" : w)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Farben.text3)
                }
                Spacer(minLength: 0)
            }
            Text(zustand.schulname)
                .font(.subheadline)
                .foregroundStyle(Farben.text2)
                .lineLimit(2)
            // Datenstand: letzte Änderung aus EduOrga Studio, daneben wann die App zuletzt geladen hat
            StudiostandZeile(stand: Studiostand.stand(zustand), abgerufen: bestaetigt ? stand : nil)
                .padding(.top, 2)
        }
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

    @ViewBuilder
    private func tagesbereich(_ h: Heute) -> some View {
        let alle = kacheln(h)
        let istHeute = Datumsformat.istHeute(h.datum)
        if h.gesperrt {
            let hinweis = (h.sperrhinweis ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            Hinweisfeld(titel: "Nicht freigegeben", text: hinweis.isEmpty ? "Dieser Zeitraum ist für Ihr Konto noch nicht einsehbar." : hinweis,
                        symbol: "lock", flaeche: Farben.flaeche)
        } else if alle.isEmpty {
            if let f = h.ferien ?? ferien {
                FreiFlaeche(titel: f.titel.isEmpty ? "Ferien" : f.titel, zeitraum: f.zeitraum)
            } else {
                Hinweisfeld(titel: "Kein Unterricht", text: istHeute ? "Heute ist kein Unterricht geplant." : "An diesem Tag ist kein Unterricht geplant.",
                            symbol: "sun.max", minHoehe: 120, flaeche: Farben.flaeche)
            }
        } else {
            if let abwesend = abwesenheitsHinweis(h) {
                HStack(spacing: 12) {
                    Image(systemName: "person.crop.circle.badge.xmark")
                        .font(.title3)
                        .foregroundStyle(Farben.text2)
                        .accessibilityHidden(true)
                    Text(abwesend)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Farben.text)
                    Spacer(minLength: 0)
                }
                .padding(12)
                .background(Farben.abwesendFlaeche, in: RoundedRectangle(cornerRadius: Stilmass.radius, style: .continuous))
            }
            if istHeute && Jetztlage.berechnen(alle, minuten: Uhr.minuten()) != nil {
                JetztKarte(kacheln: alle, raum: zoom) { k, quelle in oeffnen(k, alle: alle, h: h, quelle: quelle) }
            }
            // Lehrkräfte: ein Tippen zur Klassenbuch-Schnellerfassung der laufenden bzw. nächsten eigenen Stunde
            if istHeute && zustand.istKollegium, let ziel = StundeJetztWahl.ziel(alle), let karte = ziel.karte {
                StundeJetztStarter(kachel: ziel) { jetztKarte = karte }
            }
            aenderungsbereich(alle, h: h, istHeute: istHeute)
            VStack(alignment: .leading, spacing: Stilmass.raster) {
                HStack(alignment: .firstTextBaseline) {
                    Abschnittstitel(text: istHeute ? "Dein Tag" : "Stunden")
                    Spacer()
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
                Tagesliste(kacheln: alle, istHeute: istHeute, raum: zoom, vergangeneZeigen: $vergangeneZeigen) { k, quelle in
                    oeffnen(k, alle: alle, h: h, quelle: quelle)
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

    // MARK: - Änderungen heute

    @ViewBuilder
    private func aenderungsbereich(_ alle: [Kachel], h: Heute, istHeute: Bool) -> some View {
        let familie = !zustand.istKollegium
        let liste = alle.compactMap { k in k.aenderung(familie: familie).map { (k, $0) } }
        if !liste.isEmpty {
            HeuteGruppe(titel: istHeute ? "Änderungen heute" : "Änderungen",
                        zusatz: liste.count == 1 ? "1 Stunde" : "\(liste.count) Stunden") {
                ForEach(Array(liste.enumerated()), id: \.offset) { i, e in
                    if i > 0 { HeuteTrenner() }
                    AenderungZeile(kachel: e.0, aenderung: e.1) {
                        oeffnen(e.0, alle: alle, h: h, quelle: "aenderung-\(e.0.id.uuidString)")
                    }
                }
            }
        }
    }

    // MARK: - Lehrkräfte: Klassenbuch und Aufsichten

    @ViewBuilder
    private func kollegiumsbereich(_ h: Heute) -> some View {
        let offen = zustand.offeneStunden
        let aufsichten = h.aufsichten.sorted { $0.beginn < $1.beginn }
        if offen > 0 || !aufsichten.isEmpty {
            HeuteGruppe(titel: "Klassenbuch und Aufsichten") {
                if offen > 0 {
                    HeuteZeile(titel: offen == 1 ? "1 offene Stunde" : "\(offen) offene Stunden",
                               untertitel: "Thema bzw. Anwesenheit fehlen noch – im Reiter „Schule“ nachtragen",
                               wert: nil) {
                        zustand.reiter = .schule
                    }
                }
                ForEach(Array(aufsichten.enumerated()), id: \.offset) { i, a in
                    if i > 0 || offen > 0 { HeuteTrenner() }
                    let ort = a.gangName.isEmpty ? (a.gang.isEmpty ? "Aufsicht" : a.gang) : a.gangName
                    let astand = Kachelbau.aufsichtsstand(a.status)
                    HeuteZeile(titel: "Aufsicht \(ort)",
                               untertitel: a.nachStunde > 0 ? "nach der \(a.nachStunde). Stunde" : "vor der ersten Stunde",
                               wert: astand == .entfall ? "entfällt" : "\(a.beginn)–\(a.ende)",
                               wertFarbe: astand == .entfall ? Farben.entfall : (astand == .vertretung ? Farben.aenderungSchrift : Farben.text2)) {
                        wahl = Stundenwahl(quelle: "aufsicht-\(a.id.uuidString)", karten: [], aufsicht: a,
                                           typ: h.typ.isEmpty ? "lehrer" : h.typ, element: h.element ?? "")
                    }
                }
            }
        }
    }

    // MARK: - Schüler*innen und Eltern: für morgen

    private var morgenIso: String {
        Datumsformat.iso(Datumsformat.tage(1, nach: Date()))
    }

    @ViewBuilder
    private func familienbereich(_ h: Heute) -> some View {
        let faellig = h.hausaufgaben.filter { ($0.faellig ?? "").prefix(10) == morgenIso.prefix(10) }
        let heuteIso = Datumsformat.iso(Date())
        let woche = pruefungen.filter { $0.datum >= heuteIso }.sorted { ($0.datum, $0.stundeVon) < ($1.datum, $1.stundeVon) }
        let ungelesen = zustand.ungelesen
        if !faellig.isEmpty || !woche.isEmpty || ungelesen > 0 {
            HeuteGruppe(titel: "Für morgen und diese Woche") {
                ForEach(Array(faellig.enumerated()), id: \.offset) { i, ha in
                    if i > 0 { HeuteTrenner() }
                    HeuteZeile(titel: ha.hausaufgabe.isEmpty ? "Hausaufgabe" : ha.hausaufgabe,
                               untertitel: "Hausaufgabe \(ha.fach) · fällig morgen") {
                        zustand.reiter = .schule
                    }
                }
                ForEach(Array(woche.prefix(5).enumerated()), id: \.offset) { i, p in
                    if i > 0 || !faellig.isEmpty { HeuteTrenner() }
                    HeuteZeile(titel: p.titel.isEmpty ? "Prüfung" : p.titel,
                               untertitel: [p.art, p.stundenText].filter { !$0.isEmpty }.joined(separator: " · "),
                               wert: Datumsformat.anzeige(p.datum, "EE d.M."), wertFarbe: Farben.pruefung)
                }
                if ungelesen > 0 {
                    if !faellig.isEmpty || !woche.isEmpty { HeuteTrenner() }
                    HeuteZeile(titel: ungelesen == 1 ? "1 neue Mitteilung" : "\(ungelesen) neue Mitteilungen",
                               untertitel: "Im Postfach") {
                        zustand.reiter = .postfach
                    }
                }
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

    // MARK: - Heute an der Schule

    private func infos(_ h: Heute) -> [Tagesinfo] {
        var liste: [Tagesinfo] = []
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
        let abwesend = abwesenheitsHinweis(h)
        for hinweis in h.hinweise where hinweis != abwesend {
            liste.append(Tagesinfo(art: .hinweis, titel: "Hinweis", text: hinweis))
        }
        return liste
    }

    @ViewBuilder
    private func schulbereich(_ h: Heute) -> some View {
        let liste = infos(h)
        if !liste.isEmpty {
            HeuteGruppe(titel: "Heute an der Schule") {
                ForEach(Array(liste.enumerated()), id: \.offset) { i, info in
                    if i > 0 { HeuteTrenner() }
                    Infozeile(info: info)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
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
            if neu.ferien == nil {
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
