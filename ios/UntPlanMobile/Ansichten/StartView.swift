import SwiftUI

/// Eintrag „Heute an der Schule“ (Nachricht, Veranstaltung, Hinweis).
struct Tagesinfo: Identifiable {
    enum Art {
        case nachricht
        case veranstaltung
        case hinweis
    }

    let id = UUID()
    let art: Art
    let titel: String
    let text: String
}

/// Ziele der Übersicht auf der Seite „Heute“ und im Reiter „Mehr“.
enum Startziel: Hashable {
    case termine
    case abwesenheiten
    /// Schüler*innen und Eltern: erfasste Abwesenheiten (Zeiträume mit Status)
    case familieAbwesenheiten
    case hausaufgaben
    case aufsichten
    case aenderungen
    /// Sprechtag (Lehrkräfte: eigene Termine; Erziehungsberechtigte: buchen und absagen)
    case sprechtag(Int)
    /// Entschuldigungen (Klassenleitung: Abwesenheiten der eigenen Klassen; Fachlehrkraft: eigene Fehlstunden)
    case entschuldigungen
}

/// Seite „Heute“: großer Titel, darunter Datum und Schule, die (noch kommenden) Stunden des Tages, die Mitteilungen des
/// Tages unter „Heute an der Schule“ (Nachrichten, Veranstaltungen, Hinweise) und eine Übersicht (Termine, Abwesenheiten, Entschuldigungen,
/// Hausaufgaben, Sprechtage, Änderungen). Gruppierte Liste des Systems; auf dem iPad mittig.
struct StartView: View {
    @EnvironmentObject var zustand: AppZustand
    @State private var heute: Heute? = nil
    @State private var laedt = false
    @State private var fehler: String? = nil
    @State private var gewaehlteKarte: Karte? = nil
    @State private var alleStunden = false
    /// Ferien am angezeigten Tag bzw. ab dem nächsten Schultag (aus der Tagesantwort oder dem Wochenplan)
    @State private var ferien: Ferienzeit? = nil
    /// Sprechtage (Lehrkräfte bzw. Erziehungsberechtigte)
    @State private var sprechtage: [SprechtagKarte] = []
    /// Geöffneter Sprechtag (als Blatt wie die Stundendetails)
    @State private var sprechtagWahl: SprechtagWahl? = nil
    @Environment(\.horizontalSizeClass) private var groessenklasse

    /// Sprechtag, der als Blatt gezeigt wird.
    struct SprechtagWahl: Identifiable {
        let id: Int
        let titel: String
    }

    /// Zahl der Stunden, die ohne „Alle anzeigen“ zu sehen sind.
    private let sichtbareStunden = 3

    var body: some View {
        NavigationStack {
            List {
                kopf
                if let fehler {
                    Section {
                        Fehlerhinweis(text: fehler)
                            .listRowInsets(EdgeInsets())
                            .listRowBackground(Color.clear)
                    }
                }
                if let heute {
                    if heute.paket {
                        stundenAbschnitt(heute)
                        infoAbschnitt(heute)
                        uebersicht(heute)
                    } else {
                        Section {
                            Hinweisfeld(titel: "Noch keine Plandaten", text: "Die Schule hat noch keinen Plan veröffentlicht.",
                                        symbol: "tray")
                                .listRowInsets(EdgeInsets())
                                .listRowBackground(Color.clear)
                        }
                    }
                } else if laedt {
                    Section {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .listRowBackground(Color.clear)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Farben.grund.ignoresSafeArea())
            .zentriert(maxBreite: 760)
            .background(Farben.grund.ignoresSafeArea())
            .refreshable { await laden() }
            .task { await laden() }
            .navigationTitle("Heute")
            .navigationBarTitleDisplayMode(.large)
            .navigationDestination(for: Startziel.self) { ziel in
                Startzielseite(ziel: ziel, heute: heute, sprechtage: sprechtage) { gewaehlteKarte = $0 }
                    .environmentObject(zustand)
            }
            .detailPraesentation(item: $gewaehlteKarte, breit: groessenklasse == .regular) { karte in
                StundendetailView(karte: karte, typ: heute?.typ ?? "klasse", element: heute?.element ?? "")
                    .environmentObject(zustand)
            }
            // Sprechtag als Blatt (eigener Navigationsstapel im Blatt)
            .detailPraesentation(item: $sprechtagWahl, breit: groessenklasse == .regular) { wahl in
                NavigationStack {
                    SprechtagView(id: wahl.id, titel: wahl.titel, karte: sprechtage.first { $0.id == wahl.id })
                }
                .environmentObject(zustand)
            }
            .onChange(of: sprechtagWahl?.id) { _, neu in
                // Nach dem Schließen die Zahl der Termine auffrischen
                if neu == nil { Task { await laden() } }
            }
        }
    }

    // MARK: - Kopf: Datum und Schule

    private var kopf: some View {
        Section {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(Datumsformat.anzeige(heute?.datum ?? Datumsformat.iso(Date()), "EEEE, d. MMMM"))
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Farben.text)
                    Text(zustand.schulname)
                        .font(.subheadline)
                        .foregroundStyle(Farben.text2)
                        .lineLimit(2)
                }
                Spacer(minLength: 8)
                if let woche = heute?.woche, !woche.isEmpty {
                    Text(woche.count == 1 ? "\(woche)-Woche" : woche)
                        .font(.footnote)
                        .foregroundStyle(Farben.text3)
                }
            }
            .listRowInsets(EdgeInsets(top: 0, leading: 4, bottom: 4, trailing: 4))
            .listRowBackground(Color.clear)
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
        }
    }

    // MARK: - Stunden des Tages

    /// Hinweis „abwesend …“ bzw. „Klasse abwesend …“ des Tages.
    private func abwesenheitsHinweis(_ h: Heute) -> String? {
        h.hinweise.first { hinweis in
            let klein = hinweis.lowercased()
            return klein.hasPrefix("abwesend") || klein.hasPrefix("klasse abwesend")
        }
    }

    /// Statt der Stunden steht „Abwesend“.
    private func zeigtAbwesenheit(_ h: Heute) -> Bool {
        guard abwesenheitsHinweis(h) != nil else { return false }
        return naechsteStunden(h).allSatisfy { $0.status == "abwesend" || $0.istEntfall }
    }

    /// Stunden des Tages; heute nur die noch kommenden.
    private func naechsteStunden(_ h: Heute) -> [Karte] {
        let sortiert = h.karten.sorted { ($0.von, $0.bis) < ($1.von, $1.bis) }
        guard Datumsformat.istHeute(h.datum), !h.jetzt.isEmpty else { return sortiert }
        return sortiert.filter { $0.ende.isEmpty || $0.ende >= h.jetzt }
    }

    private func stundenTitel(_ h: Heute) -> String {
        if !Datumsformat.istHeute(h.datum) { return "Stunden am \(Datumsformat.anzeige(h.datum, "EEEE"))" }
        return h.karten.count == naechsteStunden(h).count ? "Stunden heute" : "Nächste Stunden"
    }

    @ViewBuilder
    private func stundenAbschnitt(_ h: Heute) -> some View {
        let stunden = naechsteStunden(h)
        Section {
            if zeigtAbwesenheit(h) {
                abwesenheitszeile(h)
            } else if stunden.isEmpty {
                freiFeld(h)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            } else {
                let sichtbar = alleStunden ? stunden : Array(stunden.prefix(sichtbareStunden))
                ForEach(sichtbar) { karte in
                    Button {
                        gewaehlteKarte = karte
                    } label: {
                        Stundenzeile(karte: karte, typ: h.typ, laeuft: laeuftGerade(karte, h))
                    }
                    .buttonStyle(.plain)
                    .listRowInsets(EdgeInsets(top: 0, leading: 12, bottom: 0, trailing: 12))
                }
                if stunden.count > sichtbareStunden {
                    Button {
                        withAnimation(.easeOut(duration: 0.12)) { alleStunden.toggle() }
                    } label: {
                        Text(alleStunden ? "Weniger anzeigen" : "Alle \(stunden.count) Stunden anzeigen")
                            .font(.subheadline)
                            .foregroundStyle(Farben.akzent)
                    }
                }
            }
            if !h.karten.isEmpty {
                // Ganzen Tag im Reiter „Plan“ (Tagesansicht des eigenen Plans) öffnen
                Button {
                    zustand.tagAnfrage = h.datum
                    zustand.reiter = .plan
                } label: {
                    Mehrzeile(titel: "Tag im Plan öffnen", pfeil: true)
                }
                .buttonStyle(.plain)
            }
        } header: {
            Text(stundenTitel(h))
        }
    }

    /// Läuft die Stunde gerade (heute, Beginn erreicht, Ende noch nicht)?
    private func laeuftGerade(_ karte: Karte, _ h: Heute) -> Bool {
        guard Datumsformat.istHeute(h.datum), !h.jetzt.isEmpty, !karte.beginn.isEmpty, !karte.ende.isEmpty else { return false }
        return karte.beginn <= h.jetzt && h.jetzt < karte.ende
    }

    /// Zeile „Abwesend“ mit Zeitraum und ggf. Grund.
    private func abwesenheitszeile(_ h: Heute) -> some View {
        let hinweis = abwesenheitsHinweis(h) ?? ""
        var zusatz = hinweis
        for vorsilbe in ["Klasse abwesend", "abwesend"] where zusatz.lowercased().hasPrefix(vorsilbe.lowercased()) {
            zusatz = String(zusatz.dropFirst(vorsilbe.count)).trimmingCharacters(in: .whitespaces)
            break
        }
        return HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(hinweis.lowercased().hasPrefix("klasse") ? "Klasse abwesend" : "Abwesend")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Farben.text)
                if !zusatz.isEmpty {
                    Text(zusatz)
                        .font(.subheadline)
                        .foregroundStyle(Farben.text2)
                        .lineLimit(2)
                }
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }

    /// Keine (weiteren) Stunden: frei, Ferien (Name und Zeitraum) bzw. außerhalb des freigegebenen Zeitraums.
    private func freiFeld(_ h: Heute) -> some View {
        if h.gesperrt {
            let hinweis = (h.sperrhinweis ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            return Hinweisfeld(titel: Sperrhinweis.titel, text: hinweis.isEmpty ? Sperrhinweis.standardHinweis : hinweis,
                               symbol: "lock", flaeche: Farben.flaeche)
        }
        if let f = h.ferien ?? ferien {
            return Hinweisfeld(titel: f.titel.isEmpty ? "Ferien" : f.titel, text: f.zeitraum,
                               flaeche: Farben.freiFlaeche, tonfarbe: Farben.frei)
        }
        let text = h.karten.isEmpty
            ? (Datumsformat.istHeute(h.datum) ? "Heute ist kein Unterricht geplant." : "An diesem Tag ist kein Unterricht geplant.")
            : "Heute stehen keine weiteren Stunden an."
        return Hinweisfeld(titel: "Keine Stunden", text: text, flaeche: Farben.flaeche)
    }

    // MARK: - Mitteilungen des Tages

    private func infos(_ h: Heute) -> [Tagesinfo] {
        var liste: [Tagesinfo] = []
        for n in h.nachrichten {
            // "Betreff: Text" in Titel und Text teilen
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
        // Die eigene Abwesenheit steht bereits bei den Stunden
        let abwesend = zeigtAbwesenheit(h) ? abwesenheitsHinweis(h) : nil
        for hinweis in h.hinweise where hinweis != abwesend {
            liste.append(Tagesinfo(art: .hinweis, titel: "Hinweis", text: hinweis))
        }
        return liste
    }

    @ViewBuilder
    private func infoAbschnitt(_ h: Heute) -> some View {
        let liste = infos(h)
        if !liste.isEmpty {
            Section("Heute an der Schule") {
                ForEach(liste) { info in
                    Infozeile(info: info)
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
        var liste: [Listeneintrag] = [
            Listeneintrag(ziel: .termine, titel: "Meine Termine", zahl: h.termine.count)
        ]
        if zustand.istKollegium {
            liste.append(Listeneintrag(ziel: .abwesenheiten, titel: "Meine Abwesenheiten", zahl: 0))
            if zustand.entschuldigungsrechte?.irgendwas == true {
                liste.append(Listeneintrag(ziel: .entschuldigungen, titel: "Entschuldigungen", zahl: 0))
            }
        } else if zustand.istFamilie {
            liste.append(Listeneintrag(ziel: .familieAbwesenheiten, titel: "Meine Abwesenheiten", zahl: 0))
        }
        if !h.hausaufgaben.isEmpty || h.typ == "klasse" {
            liste.append(Listeneintrag(ziel: .hausaufgaben, titel: "Hausaufgaben", zahl: h.hausaufgaben.count))
        }
        // Auch angekündigte Sprechtage (noch keine Buchung möglich) erscheinen mit Datum, Ort und Anmeldebeginn
        for t in sprechtage {
            liste.append(Listeneintrag(ziel: .sprechtag(t.id), titel: t.titel,
                                       zahl: t.termine, untertitel: t.untertitel))
        }
        if h.aenderungen > 0 {
            liste.append(Listeneintrag(ziel: .aenderungen, titel: "Änderungen heute", zahl: h.aenderungen))
        }
        return liste
    }

    private func uebersicht(_ h: Heute) -> some View {
        Section("Übersicht") {
            ForEach(eintraege(h)) { e in
                if case .sprechtag(let sid) = e.ziel {
                    Button {
                        sprechtagWahl = SprechtagWahl(id: sid, titel: e.titel)
                    } label: {
                        Uebersichtszeile(titel: e.titel, untertitel: e.untertitel, zahl: e.zahl, pfeil: true)
                    }
                    .buttonStyle(.plain)
                } else {
                    NavigationLink(value: e.ziel) {
                        Uebersichtszeile(titel: e.titel, untertitel: e.untertitel, zahl: e.zahl, pfeil: false)
                    }
                }
            }
        }
    }

    // MARK: - Laden

    private func laden() async {
        laedt = true
        defer { laedt = false }
        let api = zustand.api
        // Sprechtage für alle Rollen laden – der Server entscheidet, was sichtbar ist
        let sprechtagLaden = zustand.benutzer != nil
        @Sendable func holeSprechtage() async -> [SprechtagKarte]? {
            guard sprechtagLaden else { return [] }
            return try? await api.sprechtagStart()
        }
        async let sprechtagListe = holeSprechtage()
        await zustand.entschuldigungsrechteLaden(neu: true)
        do {
            let neu = try await api.heute()
            heute = neu
            zustand.ungelesen = neu.ungelesen
            fehler = nil
            if neu.ferien == nil {
                ferien = await ferienSuchen(neu)
            } else {
                ferien = nil
            }
        } catch {
            if let text = zustand.fehlertext(error) { fehler = text }
        }
        let geladeneSprechtage = await sprechtagListe
        // Neuere Server liefern die Sprechtage auch in /heute (gleiche Karten); sonst /sprechtag/start
        if let ausHeute = heute?.sprechtage, !ausHeute.isEmpty || geladeneSprechtage == nil {
            sprechtage = ausHeute
        } else if let geladeneSprechtage {
            sprechtage = geladeneSprechtage
        }
    }

    /// Ferien aus dem Wochenplan: Liegt der angezeigte Tag bzw. der nächste Wochentag (Mo–Fr) ab diesem Tag in den
    /// Ferien, gelten deren Name und Zeitraum. Nur ohne Stunden und ohne Sperre (sonst nil).
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
        // Erster Tag (ab dem angezeigten) im Plan: frei wegen Ferien → Ferien; sonst keine
        guard let erster = tage.filter({ $0.datum >= h.datum }).sorted(by: { $0.datum < $1.datum }).first,
              erster.frei, (erster.freiArt ?? "").lowercased() == "ferien" else { return nil }
        let grund = (erster.freiGrund ?? "").trimmingCharacters(in: .whitespaces)
        let titel = grund.isEmpty ? "Ferien" : grund
        return Ferienzeit(titel: titel, von: erster.freiVon ?? erster.datum, bis: erster.freiBis ?? "")
    }
}

// MARK: - Bausteine der Seite „Heute“

/// Zeile der Übersicht: Titel (und Untertitel), rechts die Zahl – ohne Symbol davor.
struct Uebersichtszeile: View {
    let titel: String
    var untertitel: String? = nil
    var zahl: Int = 0
    /// Eigener Pfeil (bei Knöpfen; NavigationLinks zeichnen ihn selbst)
    var pfeil: Bool = false

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(titel)
                    .foregroundStyle(Farben.text)
                    .lineLimit(1)
                if let untertitel, !untertitel.isEmpty {
                    Text(untertitel)
                        .font(.footnote)
                        .foregroundStyle(Farben.text2)
                        .lineLimit(2)
                }
            }
            Spacer(minLength: 4)
            if zahl > 0 {
                ZahlPlakette(zahl: zahl)
            }
            if pfeil {
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Farben.pfeil)
            }
        }
        .contentShape(Rectangle())
    }
}

/// Zeile „Heute an der Schule“: Art klein und grau, Titel und bis zu vier Zeilen Text.
struct Infozeile: View {
    let info: Tagesinfo

    private var art: String {
        switch info.art {
        case .nachricht: return "Nachricht"
        case .veranstaltung: return "Veranstaltung"
        case .hinweis: return "Hinweis"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            if info.titel != art {
                Text(art)
                    .font(.caption)
                    .foregroundStyle(Farben.text3)
            }
            Text(info.titel)
                .font(.body.weight(.semibold))
                .foregroundStyle(Farben.text)
                .lineLimit(2)
            Text(info.text)
                .font(.subheadline)
                .foregroundStyle(Farben.text2)
                .lineLimit(4)
        }
        .padding(.vertical, 3)
        .accessibilityElement(children: .combine)
    }
}

/// Listenzeile einer Stunde: Beginn und Ende, Fachkürzel auf getönter Fläche (wie die Kachel im Raster), Fach mit
/// Lehrkraft bzw. Klasse und Raum, rechts die Status-Plakette. Entfall durchgestrichen.
struct Stundenzeile: View {
    let karte: Karte
    let typ: String
    /// Stunde läuft gerade: Uhrzeit in Marine
    var laeuft: Bool = false

    var body: some View {
        let stil = Kartenstil(karte)
        let zeilen = kartenzeilen(karte, typ: typ).filter { !$0.isEmpty }
        HStack(spacing: 12) {
            VStack(alignment: .trailing, spacing: 1) {
                Text(karte.beginn.isEmpty ? "\(karte.von). Std." : Detailmass.uhrzeit(karte.beginn))
                    .font(.subheadline.weight(.semibold).monospacedDigit())
                    .foregroundStyle(laeuft ? Farben.akzent : Farben.text)
                Text(laeuft ? "jetzt" : (karte.ende.isEmpty ? "" : Detailmass.uhrzeit(karte.ende)))
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(laeuft ? Farben.akzent : Farben.text3)
            }
            .frame(width: 44, alignment: .trailing)
            Text(karte.fach.isEmpty ? String(karte.titel.prefix(4)) : karte.fach)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(stil.durchgestrichen ? Farben.text2 : Farben.text)
                .strikethrough(stil.durchgestrichen, color: Farben.entfall)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .frame(width: 44, height: 36)
                .background(Farben.fachTon(karte.farbe) ?? Farben.flaeche2,
                            in: RoundedRectangle(cornerRadius: 4, style: .continuous))
                .overlay {
                    if Farben.fachTon(karte.farbe) == nil {
                        RoundedRectangle(cornerRadius: 4, style: .continuous)
                            .strokeBorder(Farben.randStark, lineWidth: 1)
                    }
                }
            VStack(alignment: .leading, spacing: 2) {
                Text(karte.fachName.isEmpty ? karte.titel : karte.fachName)
                    .font(.body)
                    .foregroundStyle(Farben.text)
                    .strikethrough(stil.durchgestrichen, color: Farben.entfall)
                    .lineLimit(1)
                if !zeilen.isEmpty {
                    zeilentext(zeilen, stil: stil)
                        .font(.footnote)
                        .foregroundStyle(Farben.text2)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 4)
            if let p = stil.plakette {
                Plakette(text: p, farbe: stil.plaketteFarbe, flaeche: stil.plaketteFlaeche)
            }
        }
        .padding(.vertical, 8)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    private func zeilentext(_ zeilen: [[Wert]], stil: Kartenstil) -> Text {
        if stil.durchgestrichen {
            return Text(zeilen.map(werteKurz).joined(separator: " · ")).strikethrough(true)
        }
        var ergebnis = werteText(zeilen[0], offen: offen(zeilen[0]))
        for z in zeilen.dropFirst() {
            ergebnis = ergebnis + Text(" · ") + werteText(z, offen: offen(z))
        }
        return ergebnis
    }

    private func offen(_ werte: [Wert]) -> Bool {
        werte == karte.lehrer && istOffeneVertretung(karte)
    }
}

// MARK: - Unterseiten der Übersicht

/// Ziel der Übersicht als eigene Seite (aus „Heute“ und aus „Mehr“).
struct Startzielseite: View {
    let ziel: Startziel
    let heute: Heute?
    var sprechtage: [SprechtagKarte] = []
    let antippen: (Karte) -> Void
    @EnvironmentObject var zustand: AppZustand

    var body: some View {
        switch ziel {
        case .familieAbwesenheiten:
            MeineAbwesenheitenView()
        case .entschuldigungen:
            EntschuldigungenView()
        case .sprechtag(let id):
            SprechtagView(id: id, titel: sprechtage.first { $0.id == id }?.titel ?? "Sprechtag",
                          karte: sprechtage.first { $0.id == id })
        default:
            StartlisteView(ziel: ziel, heute: heute, antippen: antippen)
        }
    }
}

/// Unterseite der Übersicht: Termine, Abwesenheiten, Hausaufgaben, Aufsichten oder Änderungen. Ohne mitgegebene
/// Tagesdaten (Aufruf aus „Mehr“) lädt sie sie selbst.
struct StartlisteView: View {
    let ziel: Startziel
    let heute: Heute?
    let antippen: (Karte) -> Void
    @EnvironmentObject var zustand: AppZustand
    @State private var meldungen: [Meldung]? = nil
    @State private var fehler: String? = nil
    @State private var geladen: Heute? = nil

    private var tag: Heute? { heute ?? geladen }

    private var titel: String {
        switch ziel {
        case .termine: return "Meine Termine"
        case .abwesenheiten, .familieAbwesenheiten: return "Meine Abwesenheiten"
        case .hausaufgaben: return "Hausaufgaben"
        case .aufsichten: return "Pausenaufsichten"
        case .aenderungen: return "Änderungen heute"
        case .sprechtag: return "Sprechtag"
        case .entschuldigungen: return "Entschuldigungen"
        }
    }

    var body: some View {
        List {
            if let fehler {
                Fehlerhinweis(text: fehler)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }
            if ziel == .abwesenheiten {
                abwesenheiten()
            } else if let h = tag {
                switch ziel {
                case .termine: termine(h)
                case .hausaufgaben: hausaufgaben(h)
                case .aufsichten: aufsichten(h)
                case .aenderungen: aenderungen(h)
                default: EmptyView()
                }
            } else if fehler == nil {
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .listRowBackground(Color.clear)
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(titel)
        .navigationBarTitleDisplayMode(.large)
        .toolbar(.visible, for: .navigationBar)
        .refreshable { await laden() }
        .task { await laden() }
    }

    private func laden() async {
        if ziel == .abwesenheiten {
            await meldungenLaden()
        } else if heute == nil {
            do {
                geladen = try await zustand.api.heute()
                fehler = nil
            } catch {
                if let text = zustand.fehlertext(error) { fehler = text }
            }
        }
    }

    // MARK: Meine Abwesenheiten (eigene Meldungen vom Typ Abwesenheit)

    @ViewBuilder
    private func abwesenheiten() -> some View {
        if let liste = meldungen?.filter(\.istAbwesenheit) {
            if liste.isEmpty {
                leer("Keine Abwesenheiten gemeldet.")
            }
            ForEach(liste) { m in
                VStack(alignment: .leading, spacing: 4) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(abwesenheitszeitraum(m))
                            .font(.body.weight(.semibold))
                            .foregroundStyle(Farben.text)
                        Spacer()
                        if m.status == "offen" {
                            Plakette(text: "Offen", farbe: Farben.pruefung, flaeche: Farben.pruefungFlaeche)
                        } else if m.status == "quittiert" {
                            Plakette(text: "Bestätigt", farbe: Farben.ok, flaeche: Farben.okFlaeche)
                        } else {
                            Plakette(text: m.status, farbe: Farben.text2, flaeche: Farben.neutralFlaeche)
                        }
                    }
                    let grund = (m.grund ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                    if !grund.isEmpty {
                        Text(grund)
                            .font(.subheadline)
                            .foregroundStyle(Farben.text2)
                    }
                    // Bemerkung bzw. Text als eigene Zeile – nur wenn vorhanden
                    let bemerkung = (m.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                    if !bemerkung.isEmpty {
                        Text(bemerkung)
                            .font(.subheadline)
                            .foregroundStyle(Farben.text3)
                            .lineLimit(4)
                    }
                }
                .padding(.vertical, 4)
            }
        } else if fehler == nil {
            ProgressView()
                .frame(maxWidth: .infinity)
                .listRowBackground(Color.clear)
        }
    }

    private func abwesenheitszeitraum(_ m: Meldung) -> String {
        let von = m.von ?? ""
        let bis = m.bis ?? von
        var text = Datumsformat.anzeige(von, "EE d.M.yyyy")
        if !bis.isEmpty && bis.prefix(10) != von.prefix(10) {
            text += " – " + Datumsformat.anzeige(bis, "EE d.M.yyyy")
        }
        if let v = m.stundeVon {
            let b = m.stundeBis ?? v
            text += v == b ? ", \(v). Std." : ", \(v).–\(b). Std."
        }
        return text
    }

    private func meldungenLaden() async {
        do {
            meldungen = try await zustand.api.meldungen()
            fehler = nil
        } catch {
            if let text = zustand.fehlertext(error) { fehler = text }
            if meldungen == nil { meldungen = [] }
        }
    }

    @ViewBuilder
    private func termine(_ h: Heute) -> some View {
        if h.termine.isEmpty {
            leer("Keine Termine in den nächsten zwei Wochen.")
        }
        ForEach(h.termine) { t in
            HStack(spacing: 12) {
                VStack(spacing: 0) {
                    Text(Datumsformat.anzeige(t.von, "d"))
                        .font(.title3.weight(.semibold).monospacedDigit())
                    Text(Datumsformat.anzeige(t.von, "MMM"))
                        .font(.caption.weight(.medium))
                }
                .foregroundStyle(Farben.akzent)
                .frame(width: 44)
                VStack(alignment: .leading, spacing: 2) {
                    Text(t.titel.isEmpty ? t.art : t.titel)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Farben.text)
                    Text(termintext(t))
                        .font(.footnote)
                        .foregroundStyle(Farben.text2)
                }
            }
            .padding(.vertical, 4)
        }
    }

    private func termintext(_ t: Termin) -> String {
        var teile: [String] = []
        if !t.art.isEmpty && !t.titel.isEmpty { teile.append(t.art) }
        if !t.bis.isEmpty && t.bis.prefix(10) != t.von.prefix(10) {
            teile.append("bis \(Datumsformat.anzeige(t.bis, "d.M."))")
        }
        if let v = t.stundeVon {
            let b = t.stundeBis ?? v
            teile.append(v == b ? "\(v). Stunde" : "\(v).–\(b). Stunde")
        }
        if !t.klassen.isEmpty { teile.append(t.klassen.joined(separator: ", ")) }
        return teile.joined(separator: " · ")
    }

    @ViewBuilder
    private func hausaufgaben(_ h: Heute) -> some View {
        if h.hausaufgaben.isEmpty {
            leer("Keine Hausaufgaben eingetragen.")
        }
        ForEach(h.hausaufgaben) { ha in
            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline) {
                    Text(ha.fach)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Farben.text)
                    Spacer()
                    if let f = ha.faellig, !f.isEmpty {
                        Text("fällig \(Datumsformat.anzeige(f, "EE d.M."))")
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(Farben.akzent)
                    }
                }
                Text(ha.hausaufgabe)
                    .font(.subheadline)
                    .foregroundStyle(Farben.text2)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.vertical, 4)
        }
    }

    @ViewBuilder
    private func aufsichten(_ h: Heute) -> some View {
        ForEach(h.aufsichten) { a in
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(a.gangName.isEmpty ? a.gang : a.gangName)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Farben.text)
                        .strikethrough(a.status == "vertreten" || a.status == "entfall", color: Farben.entfall)
                    Text("nach der \(a.nachStunde). Stunde · \(a.beginn) – \(a.ende)")
                        .font(.footnote)
                        .foregroundStyle(Farben.text2)
                }
                Spacer()
                if a.status == "vertretung" {
                    Plakette(text: "Vertretung", farbe: Farben.aenderung, flaeche: Farben.aenderungFlaeche)
                } else if a.status == "vertreten" {
                    Plakette(text: "Vertreten", farbe: Farben.text2, flaeche: Farben.neutralFlaeche)
                } else if a.status == "entfall" {
                    Plakette(text: "Entfällt", farbe: Farben.entfall, flaeche: Farben.entfallFlaeche)
                }
            }
            .padding(.vertical, 4)
        }
    }

    @ViewBuilder
    private func aenderungen(_ h: Heute) -> some View {
        let geaendert = h.karten
            .filter { $0.istEntfall || $0.istAenderung || $0.istPruefung || $0.zusaetzlich }
            .sorted { ($0.von, $0.bis) < ($1.von, $1.bis) }
        if geaendert.isEmpty {
            leer("Heute keine Änderungen.")
        }
        ForEach(geaendert) { karte in
            Button {
                antippen(karte)
            } label: {
                Stundenzeile(karte: karte, typ: h.typ)
            }
            .buttonStyle(.plain)
            .listRowInsets(EdgeInsets(top: 0, leading: 12, bottom: 0, trailing: 12))
        }
    }

    private func leer(_ text: String) -> some View {
        Text(text)
            .font(.subheadline)
            .foregroundStyle(Farben.text3)
    }
}
