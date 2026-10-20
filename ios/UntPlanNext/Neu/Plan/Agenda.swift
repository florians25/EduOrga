import SwiftUI

// Agenda des Plans (Ansicht „Agenda“ neben Woche und Tag, design/DESIGN.md Abschnitt 10): die Woche als Liste, nach
// Tagen gegliedert. Links groß der Tag („17“) mit Wochentag, rechts je Stunde, Termin bzw. Aufsicht eine flache Zeile in
// der Tönung der Fachfarbe mit Balken links: Stundennummer groß, Beginn und Ende untereinander, Fach fett, Klasse,
// Lehrkraft, Raum (geänderte Werte als grünes Feld „+neu (alt)“, Entfall durchgestrichen), rechts das Statuswort.
// Termine stehen warm getönt an ihrer Uhrzeit, ganztägige zuerst. Waagrecht wischen = andere Woche, Antippen öffnet die
// Stunde, langes Drücken zeigt die Aktionen, Antippen des Tages öffnet den Tag. Mehrfachauswahl: alle gewählten Pläne
// gemeinsam (jede Stunde einmal).

/// Eintrag der Agenda: Kachel mit ihrem Tag und (Mehrfachauswahl) dem Plan, aus dem sie stammt.
private struct Agendaeintrag: Identifiable {
    let kachel: Kachel
    let tag: Tagesansicht
    let plan: PlanAuswahl?

    var id: UUID { kachel.id }
}

/// Wochen der Agenda als waagrechte Seiten (wie das Wochenraster).
struct AgendaSeiten: View {
    @ObservedObject var modell: Planmodell
    @ObservedObject var mehrfach: Mehrfachplaene
    let mehrfachAktiv: Bool
    let montage: [String]
    @Binding var montag: String
    let raum: Namespace.ID?
    let antippen: Rasterantippen
    let tagOeffnen: (String) -> Void

    @State private var position: String? = nil

    var body: some View {
        ScrollView(.horizontal) {
            LazyHStack(spacing: 0) {
                ForEach(montage, id: \.self) { m in
                    AgendaWoche(modell: modell, mehrfach: mehrfach, mehrfachAktiv: mehrfachAktiv, montag: m, raum: raum,
                                antippen: antippen, tagOeffnen: tagOeffnen)
                        .containerRelativeFrame(.horizontal)
                        .id(m)
                }
            }
            .scrollTargetLayout()
        }
        .scrollTargetBehavior(.paging)
        .scrollIndicators(.hidden)
        .scrollPosition(id: $position)
        .onAppear { position = montag }
        .onChange(of: montag) { _, neu in
            if position != neu { position = neu }
        }
        .onChange(of: position) { _, neu in
            if let neu, neu != montag { montag = neu }
        }
    }
}

/// Eine Woche der Agenda: Tage untereinander, senkrecht rollbar, zum Aktualisieren nach unten ziehen.
struct AgendaWoche: View {
    @ObservedObject var modell: Planmodell
    @ObservedObject var mehrfach: Mehrfachplaene
    let mehrfachAktiv: Bool
    let montag: String
    let raum: Namespace.ID?
    let antippen: Rasterantippen
    let tagOeffnen: (String) -> Void

    @State private var gerollt = false

    private var ladeKennung: String {
        mehrfachAktiv ? "m|\(mehrfach.kennung)|\(montag)" : "\(modell.typ)|\(modell.element)|\(montag)"
    }

    /// Modelle der Woche: Mehrfachauswahl alle gewählten Pläne, sonst der Plan der Seite.
    private var modelle: [(modell: Planmodell, plan: PlanAuswahl?)] {
        var liste: [(modell: Planmodell, plan: PlanAuswahl?)] = []
        guard mehrfachAktiv else {
            liste.append((modell: modell, plan: nil))
            return liste
        }
        for p in mehrfach.auswahl {
            if let m = mehrfach.modell(p) { liste.append((modell: m, plan: p)) }
        }
        return liste
    }

    private var tage: [String] {
        modelle.first?.modell.tage(montag: montag) ?? modell.tage(montag: montag)
    }

    private var geladen: Bool {
        modelle.allSatisfy { $0.modell.plan(montag: montag) != nil }
    }

    var body: some View {
        ScrollViewReader { leser in
            ScrollView(.vertical) {
                LazyVStack(alignment: .leading, spacing: 14) {
                    if !geladen && modelle.contains(where: { $0.modell.fehler != nil && !$0.modell.laedt(montag: montag) }) {
                        Hinweisfeld(titel: "Plan nicht geladen", text: "Zum Aktualisieren nach unten ziehen.", symbol: "wifi.exclamationmark",
                                    flaeche: Farben.flaeche)
                    } else if !geladen {
                        Platzhaltertag()
                    } else if let p = modelle.first?.modell.plan(montag: montag), p.gesperrt {
                        let hinweis = (p.sperrhinweis ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                        Hinweisfeld(titel: "Nicht freigegeben",
                                    text: hinweis.isEmpty ? "Diese Woche ist für Ihr Konto noch nicht einsehbar." : hinweis,
                                    symbol: "lock", minHoehe: 160, flaeche: Farben.flaeche)
                    } else {
                        ForEach(tage, id: \.self) { d in
                            tagBlock(d)
                                .id(d)
                        }
                    }
                }
                .padding(.horizontal, Stilmass.rand)
                .padding(.top, Stilmass.raster)
                .padding(.bottom, 3 * Stilmass.raster)
                .frame(maxWidth: 760)
                .frame(maxWidth: .infinity)
            }
            .scrollIndicators(.hidden)
            .refreshable {
                for (i, m) in modelle.enumerated() {
                    if i == 0 {
                        await m.modell.aktualisieren(montag: montag)
                    } else {
                        await m.modell.laden(montag: montag, erzwingen: true)
                    }
                }
                Haptik.erfolg()
            }
            .onAppear { rollen(leser) }
            .onChange(of: geladen) { _, _ in rollen(leser) }
        }
        .task(id: ladeKennung) {
            for m in modelle { await m.modell.laden(montag: montag) }
        }
    }

    /// Einmal zum heutigen Tag rollen (wenn er in dieser Woche liegt).
    private func rollen(_ leser: ScrollViewProxy) {
        guard !gerollt, geladen, let heute = tage.first(where: { Datumsformat.istHeute($0) }) else { return }
        gerollt = true
        DispatchQueue.main.async {
            withAnimation(.snappy) { leser.scrollTo(heute, anchor: .top) }
        }
    }

    /// Einträge eines Tages aus allen Modellen (Mehrfachauswahl: jede Stunde einmal), nach Uhrzeit.
    private func eintraege(_ d: String) -> [Agendaeintrag] {
        var liste: [Agendaeintrag] = []
        var gesehen = Set<String>()
        for m in modelle {
            guard let t = m.modell.tag(d), t.freiText == nil else { continue }
            for k in t.ganztags + t.kacheln {
                let istAufsicht = k.inPause && k.aufsicht != nil
                guard k.art == .ganztagTermin || istAufsicht || (!k.inPause && k.karte != nil) else { continue }
                let zeit = Rastergeometrie.minuten(k)
                let schluessel = "\(zeit.beginn)|\(zeit.ende)|\(k.anzeigeTitel)|\(k.zeilen.map(\.text).joined(separator: "/"))"
                if modelle.count > 1 {
                    guard !gesehen.contains(schluessel) else { continue }
                    gesehen.insert(schluessel)
                }
                liste.append(Agendaeintrag(kachel: k, tag: t, plan: m.plan))
            }
        }
        return liste.sorted { a, b in
            let ga = a.kachel.art == .ganztagTermin
            let gb = b.kachel.art == .ganztagTermin
            if ga != gb { return ga }
            let za = Rastergeometrie.minuten(a.kachel)
            let zb = Rastergeometrie.minuten(b.kachel)
            if za.beginn != zb.beginn { return za.beginn < zb.beginn }
            return a.kachel.rang < b.kachel.rang
        }
    }

    private func tagBlock(_ d: String) -> some View {
        let heute = Datumsformat.istHeute(d)
        let t = modelle.first?.modell.tag(d)
        let liste = eintraege(d)
        return HStack(alignment: .top, spacing: 10) {
            Button {
                Haptik.auswahl()
                tagOeffnen(d)
            } label: {
                VStack(spacing: 0) {
                    Text(Datumsformat.anzeige(d, "dd"))
                        .font(.system(size: 22, weight: .bold))
                        .monospacedDigit()
                    Text(Datumsformat.anzeige(d, "EE").replacingOccurrences(of: ".", with: ""))
                        .font(.system(size: 12, weight: heute ? .semibold : .regular))
                }
                .foregroundStyle(heute ? Farben.akzent : Farben.text)
                .frame(width: 40)
                .padding(.vertical, 4)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel((heute ? "Heute, " : "") + Datumsformat.anzeige(d, "EEEE, d. MMMM") + ". Tag öffnen")
            .accessibilityAddTraits(.isHeader)

            VStack(alignment: .leading, spacing: 4) {
                if let f = t?.freiText {
                    HStack(spacing: 6) {
                        Image(systemName: "sun.max")
                            .accessibilityHidden(true)
                        Text(f.titel)
                            .fontWeight(.semibold)
                    }
                    .font(.subheadline)
                    .foregroundStyle(Farben.frei)
                    .padding(.horizontal, 12)
                    .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                    .background(Farben.freiFlaeche, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
                } else if liste.isEmpty {
                    Text("Kein Unterricht")
                        .font(.subheadline)
                        .foregroundStyle(Farben.text3)
                        .padding(.horizontal, 12)
                        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                        .background(Farben.neutralFlaeche, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
                } else {
                    ForEach(liste) { e in
                        zeile(e)
                    }
                }
                ForEach(Array((t?.kopf?.hinweise ?? []).enumerated()), id: \.offset) { _, h in
                    Label(h, systemImage: "info.circle")
                        .font(.footnote)
                        .foregroundStyle(Farben.text)
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Farben.freiFlaeche, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func zeile(_ e: Agendaeintrag) -> some View {
        let quelle = "agenda-\(e.kachel.id.uuidString)"
        return Button {
            antippen(e.kachel, e.tag, quelle, e.plan)
        } label: {
            Agendazeile(kachel: e.kachel, vergangen: Tagesansicht.vergangen(e.kachel, jetzt: Date()))
                .zoomQuelle(quelle, in: raum)
        }
        .buttonStyle(KachelDruckStil())
        .stundenMenue(e.kachel) { antippen(e.kachel, e.tag, quelle, e.plan) }
    }
}

/// Zeile der Agenda: Stundennummer, Beginn und Ende, Fach, Klasse, Lehrkraft, Raum – getönt wie die Stundenkarte.
struct Agendazeile: View {
    let kachel: Kachel
    let vergangen: Bool

    @Environment(\.kartendarstellung) private var darstellung
    @ScaledMetric(relativeTo: .body) private var fachBreite: CGFloat = 46

    private var entfall: Bool { kachel.kartenart == .entfall }
    private var ereignis: Bool { Rastergeometrie.istEreignis(kachel) }
    private var aufsicht: Bool { kachel.inPause && kachel.aufsicht != nil }

    private var nummer: String {
        if kachel.art == .ganztagTermin || aufsicht || kachel.von <= 0 { return "" }
        return kachel.von == kachel.bis ? "\(kachel.von)" : "\(kachel.von)–\(kachel.bis)"
    }

    private func wert(_ schluessel: String) -> Kachelzeile? {
        kachel.zeilen.first { $0.schluessel == schluessel && !$0.text.trimmingCharacters(in: .whitespaces).isEmpty }
    }

    var body: some View {
        var stil = Klassikstil.fuer(kachel, darstellung)
        if ereignis {
            stil.flaeche = Farben.ereignisFlaeche
            stil.ton = nil
            stil.mitBalken = false
            stil.titel = Farben.ereignisText
            stil.rand = Farben.ereignisRand
            stil.strich = StrokeStyle(lineWidth: 1)
        }
        let zeit = Rastergeometrie.minuten(kachel)
        let ganztags = kachel.art == .ganztagTermin
        return HStack(alignment: .center, spacing: 10) {
            Text(nummer)
                .font(.system(size: nummer.count > 2 ? 14 : 20, weight: .regular))
                .monospacedDigit()
                .foregroundStyle(Farben.text)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 0) {
                if ganztags {
                    Text("ganz-")
                    Text("tägig")
                } else {
                    Text(Uhr.uhrzeit(zeit.beginn))
                    Text(Uhr.uhrzeit(zeit.ende))
                }
            }
            .font(.system(size: 11))
            .monospacedDigit()
            .foregroundStyle(Farben.text2)
            .frame(width: 36, alignment: .leading)
            if ereignis {
                VStack(alignment: .leading, spacing: 1) {
                    Text(kachel.anzeigeTitel)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(stil.titel)
                        .strikethrough(entfall, color: Farben.entfall)
                        .lineLimit(2)
                    let wer = kachel.zeilen.filter { $0.schluessel != "fach" && $0.schluessel != "anlass" && !$0.text.isEmpty }
                        .map(\.text).joined(separator: " · ")
                    if !wer.isEmpty {
                        Text(wer)
                            .font(.caption)
                            .foregroundStyle(Farben.text2)
                            .lineLimit(1)
                    }
                }
            } else {
                Kartenfach(kachel: kachel, text: kachel.fachText(darstellung), schrift: .subheadline.weight(.bold), farbe: stil.titel)
                    .frame(minWidth: fachBreite, alignment: .leading)
                ForEach(["klasse", "lehrer", "anlass", "raum"], id: \.self) { s in
                    if let z = wert(s) {
                        Kartenwert(zeile: z, karte: kachel.karte, entfall: entfall, schrift: .footnote, farbe: Farben.text2)
                    }
                }
            }
            Spacer(minLength: 4)
            if let chip = kachel.statusChip {
                Statuschip(chip: chip, schrift: .caption2.weight(.semibold))
                    .layoutPriority(1)
            } else if let m = Statuslehre.kartenwort(kachel, darstellung) {
                Statuswort(merkmal: m)
            }
        }
        .padding(.leading, stil.mitBalken ? 8 : 6)
        .padding(.trailing, 10)
        .padding(.vertical, 4)
        .frame(maxWidth: .infinity, minHeight: 40, alignment: .leading)
        .klassikKarte(stil, radius: 6, balkenBreite: 4)
        .opacity(vergangen ? 0.62 : (stil.gedaempft && !entfall ? 0.8 : 1))
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(kachel.vorlesetext)
        .accessibilityAddTraits(.isButton)
    }
}
