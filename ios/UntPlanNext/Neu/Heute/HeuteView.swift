import SwiftUI

/// Reiter „Heute“: großer Kopf mit Datum und Schule, die Jetzt-Karte (laufende Stunde mit Restzeit und nächster Stunde),
/// der Tag als Verlauf (vergangene Stunden eingeklappt, Pausen und Freistunden dazwischen), „Heute an der Schule“
/// (Nachrichten, Veranstaltungen, Hinweise) und die Übersicht (Termine, Abwesenheiten, Entschuldigungen, Hausaufgaben,
/// Sprechtage, Änderungen).
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
    @Environment(\.horizontalSizeClass) private var groessenklasse

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    kopf
                    if let fehler {
                        Fehlerhinweis(text: fehler)
                    }
                    if let h = heute {
                        if h.paket {
                            tagesbereich(h)
                            schulbereich(h)
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
                .padding(.top, 4)
                .padding(.bottom, 32)
                .frame(maxWidth: 760)
                .frame(maxWidth: .infinity)
            }
            .background(Farben.grund.ignoresSafeArea())
            .refreshable {
                await laden()
                Haptik.erfolg()
            }
            .task { await laden() }
            .navigationTitle("Heute")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(.hidden, for: .navigationBar)
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
    }

    // MARK: - Kopf

    private var kopf: some View {
        let datum = heute?.datum ?? Datumsformat.iso(Date())
        return VStack(alignment: .leading, spacing: 2) {
            Text(Datumsformat.anzeige(datum, "EEEE"))
                .font(.largeTitle.weight(.bold))
                .foregroundStyle(Farben.text)
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(Datumsformat.anzeige(datum, "d. MMMM yyyy"))
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Farben.akzent)
                if let w = heute?.woche, !w.isEmpty {
                    Text(w.count == 1 ? "\(w)-Woche" : w)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Farben.text3)
                }
                Spacer()
            }
            Text(zustand.schulname)
                .font(.subheadline)
                .foregroundStyle(Farben.text2)
                .lineLimit(2)
        }
        .padding(.top, 12)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
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
                HStack(spacing: 10) {
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
                .kartenflaeche(Farben.neutralFlaeche)
            }
            if istHeute && Jetztlage.berechnen(alle, minuten: Uhr.minuten()) != nil {
                JetztKarte(kacheln: alle, raum: zoom) { k, quelle in oeffnen(k, alle: alle, h: h, quelle: quelle) }
            }
            TagesVerlauf(kacheln: alle, istHeute: istHeute, raum: zoom, vergangeneZeigen: $vergangeneZeigen) { k, quelle in
                oeffnen(k, alle: alle, h: h, quelle: quelle)
            }
            Button {
                Haptik.tippen()
                zustand.tagAnfrage = h.datum
                zustand.reiter = .plan
            } label: {
                HStack {
                    Image(systemName: "calendar.day.timeline.left")
                        .accessibilityHidden(true)
                    Text("Tag als Zeitachse im Plan öffnen")
                        .font(.subheadline.weight(.semibold))
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Farben.pfeil)
                }
                .foregroundStyle(Farben.akzent)
                .padding(14)
                .kartenflaeche()
            }
            .buttonStyle(KachelDruckStil())
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
            VStack(alignment: .leading, spacing: 10) {
                Abschnittstitel(text: "Heute an der Schule")
                ForEach(liste) { info in
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: info.art == .nachricht ? "megaphone" : (info.art == .veranstaltung ? "calendar" : "info.circle"))
                            .font(.body.weight(.semibold))
                            .foregroundStyle(info.art == .veranstaltung ? Farben.termin : Farben.akzent)
                            .frame(width: 24)
                            .accessibilityHidden(true)
                        Infozeile(info: info)
                        Spacer(minLength: 0)
                    }
                    .padding(14)
                    .kartenflaeche()
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
        if h.aenderungen > 0 {
            liste.append(Listeneintrag(ziel: .aenderungen, titel: "Änderungen heute", zahl: h.aenderungen))
        }
        return liste
    }

    private func uebersicht(_ h: Heute) -> some View {
        let liste = eintraege(h)
        return VStack(alignment: .leading, spacing: 10) {
            Abschnittstitel(text: "Übersicht")
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

    private func laden() async {
        laedt = true
        defer { laedt = false }
        let api = zustand.api
        async let sprechtagListe = try? api.sprechtagStart()
        await zustand.entschuldigungsrechteLaden(neu: true)
        do {
            let neu = try await api.heute()
            heute = neu
            if zustand.ungelesen != neu.ungelesen { zustand.ungelesen = neu.ungelesen }
            fehler = nil
            if neu.ferien == nil {
                ferien = await ferienSuchen(neu)
            } else {
                ferien = nil
            }
        } catch {
            if let text = zustand.fehlertext(error) { fehler = text }
        }
        let geladen = await sprechtagListe
        if let ausHeute = heute?.sprechtage, !ausHeute.isEmpty || geladen == nil {
            sprechtage = ausHeute
        } else if let geladen {
            sprechtage = geladen
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

// MARK: - Verlauf des Tages

/// Der Tag als senkrechter Verlauf: links Beginn und Ende, eine Linie mit Punkten (vorbei gefüllt, laufend als Ring in
/// Marine), rechts die Stunde. Zwischen den Stunden Pausen und Freistunden mit ihrer Länge. Vergangene Stunden lassen
/// sich einklappen.
struct TagesVerlauf: View {
    let kacheln: [Kachel]
    let istHeute: Bool
    let raum: Namespace.ID?
    @Binding var vergangeneZeigen: Bool
    let antippen: (Kachel, String) -> Void

    private struct Eintrag: Identifiable {
        let id: String
        let kachel: Kachel?
        let luecke: Int
        let lueckeBeginn: Int
    }

    private func eintraege(_ liste: [Kachel]) -> [Eintrag] {
        var ergebnis: [Eintrag] = []
        var letztesEnde: Int? = nil
        for k in liste {
            if let e = letztesEnde, k.beginn - e >= 5 {
                ergebnis.append(Eintrag(id: "l\(e)-\(k.beginn)", kachel: nil, luecke: k.beginn - e, lueckeBeginn: e))
            }
            ergebnis.append(Eintrag(id: k.id.uuidString, kachel: k, luecke: 0, lueckeBeginn: 0))
            letztesEnde = max(letztesEnde ?? 0, k.ende)
        }
        return ergebnis
    }

    var body: some View {
        TimelineView(.everyMinute) { kontext in
            let m = Uhr.minuten(kontext.date)
            let vorbei = istHeute ? kacheln.filter { $0.ende <= m } : []
            let sichtbar = vergangeneZeigen || vorbei.count < 2 ? kacheln : kacheln.filter { !($0.ende <= m) }
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Abschnittstitel(text: istHeute ? "Dein Tag" : "Stunden")
                    Spacer()
                    if vorbei.count >= 2 {
                        Button(vergangeneZeigen ? "Vorbei ausblenden" : "\(vorbei.count) vorbei anzeigen") {
                            Haptik.auswahl()
                            withAnimation(.easeInOut(duration: 0.2)) { vergangeneZeigen.toggle() }
                        }
                        .font(.subheadline.weight(.semibold))
                    }
                }
                .padding(.bottom, 10)
                ForEach(eintraege(sichtbar)) { e in
                    if let k = e.kachel {
                        zeile(k, minute: istHeute ? m : nil)
                    } else {
                        lueckenZeile(dauer: e.luecke, beginn: e.lueckeBeginn, minute: istHeute ? m : nil)
                    }
                }
            }
        }
    }

    private func zeile(_ k: Kachel, minute: Int?) -> some View {
        let vorbei = minute.map { k.ende <= $0 } ?? false
        let laeuft = minute.map { k.beginn <= $0 && $0 < k.ende } ?? false
        let quelle = "verlauf-\(k.id.uuidString)"
        return Button {
            antippen(k, quelle)
        } label: {
            HStack(alignment: .top, spacing: 10) {
                VStack(alignment: .trailing, spacing: 1) {
                    Text(Uhr.uhrzeit(k.beginn))
                        .font(.subheadline.weight(.semibold))
                        .monospacedDigit()
                        .foregroundStyle(laeuft ? Farben.akzent : Farben.text)
                    Text(Uhr.uhrzeit(k.ende))
                        .font(.caption)
                        .monospacedDigit()
                        .foregroundStyle(Farben.text3)
                }
                .frame(width: 46, alignment: .trailing)
                .padding(.top, 10)
                // Punkt auf der Linie (die Linie selbst liegt als Hintergrund über die ganze Zeile)
                ZStack {
                    Circle()
                        .fill(vorbei ? Farben.randStark : (laeuft ? Farben.flaeche : Fachfarbe.voll(k.balkenHex) ?? Farben.akzent))
                        .frame(width: 12, height: 12)
                    if laeuft {
                        Circle().strokeBorder(Farben.akzent, lineWidth: 3).frame(width: 14, height: 14)
                    }
                }
                .frame(width: 14)
                .padding(.top, 14)
                .accessibilityHidden(true)
                VerlaufsKarte(kachel: k, laeuft: laeuft)
                    .zoomQuelle(quelle, in: raum)
                    .padding(.vertical, 4)
            }
            .background(alignment: .topLeading) { VerlaufsLinie() }
            .opacity(vorbei ? 0.55 : 1)
            .contentShape(Rectangle())
        }
        .buttonStyle(KachelDruckStil())
        .accessibilityLabel(k.vorlesetext + (laeuft ? ", läuft gerade" : (vorbei ? ", vorbei" : "")))
    }

    private func lueckenZeile(dauer: Int, beginn: Int, minute: Int?) -> some View {
        let frei = dauer >= 30
        return HStack(spacing: 10) {
            Color.clear.frame(width: 46, height: 1)
            Color.clear.frame(width: 14, height: 1)
            HStack(spacing: 6) {
                Image(systemName: frei ? "cup.and.saucer" : "pause.circle")
                    .font(.caption.weight(.semibold))
                    .accessibilityHidden(true)
                Text(frei ? "Frei · \(Uhr.dauer(dauer))" : "Pause · \(Uhr.dauer(dauer))")
                    .font(.caption.weight(.semibold))
                if let m = minute, m >= beginn && m < beginn + dauer {
                    Text("noch \(Uhr.dauer(beginn + dauer - m))")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Farben.akzent)
                }
            }
            .foregroundStyle(Farben.text3)
            .padding(.vertical, frei ? 10 : 4)
            .padding(.horizontal, frei ? 10 : 0)
            .background {
                if frei {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .strokeBorder(Farben.randStark, style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                }
            }
            Spacer(minLength: 0)
        }
        .background(alignment: .topLeading) { VerlaufsLinie() }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel((frei ? "Frei, " : "Pause, ") + Uhr.dauerGesprochen(dauer))
    }
}

/// Senkrechte Linie des Verlaufs (Hintergrund einer Zeile, daher immer so hoch wie die Zeile).
private struct VerlaufsLinie: View {
    var body: some View {
        Rectangle()
            .fill(Farben.rand)
            .frame(width: 2)
            .padding(.leading, 46 + 10 + 6)
            .accessibilityHidden(true)
    }
}

/// Karte einer Stunde im Verlauf: Fachfarbe als Tönung, Fach, Raum, Personen und Status.
struct VerlaufsKarte: View {
    let kachel: Kachel
    let laeuft: Bool

    var body: some View {
        if kachel.inPause {
            AufsichtKapsel(kachel: kachel, vergangen: false)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 6)
        } else {
            ZeitKachel(kachel: kachel, hoehe: 90, vergangen: false, laeuft: laeuft)
                .fixedSize(horizontal: false, vertical: true)
                .overlay {
                    if laeuft {
                        RoundedRectangle(cornerRadius: Stilmass.kachelRadius, style: .continuous)
                            .strokeBorder(Farben.akzent, lineWidth: 2)
                    }
                }
        }
    }
}
