import SwiftUI

/// Große Stundenansicht (bildschirmfüllend, mit Zoom aus der Kachel; Knöpfe oben aus Liquid Glass): Kopf in der Fachfarbe mit Fach, Zeit
/// und Status, darunter Karten für Änderungen, Raum/Lehrkraft/Klasse, Online-Unterricht, Thema und Hausaufgaben, für
/// Lehrkräfte das Klassenbuch (Schüler*innen, Lehrstoff, Einträge, Raum) und die Notizen. Unterseiten (Bearbeiten)
/// öffnen sich im selben Stapel.
struct StundenBuehne: View {
    let wahl: Stundenwahl
    @EnvironmentObject var zustand: AppZustand
    @Environment(\.dismiss) private var schliessen
    @State private var auswahl: Int

    init(wahl: Stundenwahl) {
        self.wahl = wahl
        _auswahl = State(initialValue: min(max(wahl.start, 0), max(wahl.karten.count - 1, 0)))
    }

    var body: some View {
        NavigationStack {
            Group {
                if let a = wahl.aufsicht {
                    AufsichtBuehne(aufsicht: a) { schliessen() }
                } else if wahl.karten.indices.contains(auswahl) {
                    StundenBuehneInhalt(karte: wahl.karten[auswahl], karten: wahl.karten, auswahl: $auswahl,
                                        typ: wahl.typ, element: wahl.element) { schliessen() }
                        .id(wahl.karten[auswahl].id)
                } else {
                    ContentUnavailableView("Keine Stunde", systemImage: "calendar")
                        .toolbar(.hidden, for: .navigationBar)
                }
            }
        }
        .environmentObject(zustand)
        .onDisappear { Tastatur.schliessen() }
    }
}

// MARK: - Inhalt einer Stunde

struct StundenBuehneInhalt: View {
    let karte: Karte
    let karten: [Karte]
    @Binding var auswahl: Int
    let typ: String
    let element: String
    let schliessen: () -> Void

    @EnvironmentObject var zustand: AppZustand
    @Environment(\.openURL) private var oeffneURL
    @StateObject private var daten: Stundendaten
    @State private var raumZiel: RaumZiel? = nil
    @ScaledMetric(relativeTo: .largeTitle) private var titelGroesse: CGFloat = 46

    init(karte: Karte, karten: [Karte], auswahl: Binding<Int>, typ: String, element: String, schliessen: @escaping () -> Void) {
        self.karte = karte
        self.karten = karten
        _auswahl = auswahl
        self.typ = typ
        self.element = element
        self.schliessen = schliessen
        _daten = StateObject(wrappedValue: Stundendaten(karte: karte))
    }

    private var kollegium: Bool { zustand.istKollegium }
    private var mitUnterricht: Bool { karte.unterricht != nil }
    private var istVeranstaltung: Bool { karte.istVeranstaltung }

    /// Kachel derselben fachlichen Logik wie auf der Zeitachse (Status, Zeilen).
    private var kachel: Kachel? {
        Kachelbau.ausKarte(karte, typ: typ, ich: element.uppercased(), raster: [])
    }

    private var merkmal: Statusmerkmal? {
        if karte.istEntfall { return Statusmerkmal(text: "Entfall", farbe: Farben.entfall, flaeche: Farben.entfallFlaeche, symbol: "xmark") }
        return kachel.flatMap { Statuslehre.merkmal($0) }
    }

    private var hex: String { karte.istEntfall ? "" : karte.farbe }

    /// Farbe des Kopfs: Fachfarbe, bei Entfall ein kräftiges Rot.
    private var kopfFarbe: Color { karte.istEntfall ? Color(hexWert: 0xB42318) : Fachfarbe.kopf(hex) }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                kopf
                if karten.count > 1 { reiterleiste }
                VStack(spacing: 14) {
                    if mitUnterricht && !daten.geladen {
                        Ladebalken(aktiv: true)
                            .clipShape(Capsule())
                    }
                    aenderungsKarte
                    faktenRaster
                    pruefungsKarte
                    infoKarte
                    onlineKarte
                    unterrichtKarte
                    klassenbuchKarte
                    notizenKarte
                    planzieleKarte
                }
                .padding(.horizontal, Stilmass.rand)
                .padding(.top, 16)
                .padding(.bottom, 40)
                .frame(maxWidth: 720)
                .frame(maxWidth: .infinity)
                .background(Farben.grund)
            }
        }
        .scrollIndicators(.hidden)
        .background {
            VStack(spacing: 0) {
                kopfFarbe.frame(height: 420)
                Farben.grund
            }
            .ignoresSafeArea()
        }
        .overlay(alignment: .topTrailing) { kopfknoepfe }
        .overlay(alignment: .bottom) { hinweisToast }
        .toolbar(.hidden, for: .navigationBar)
        .navigationDestination(for: Detailseite.self) { seite in
            ziel(seite)
                .environmentObject(daten)
                .environmentObject(zustand)
        }
        .navigationDestination(item: $raumZiel) { z in
            RaumSeite(ziel: z)
                .environmentObject(daten)
                .environmentObject(zustand)
        }
        .task { await daten.laden(kollegium: kollegium) }
        .environmentObject(daten)
        .sensoryFeedback(.selection, trigger: auswahl)
    }

    // MARK: - Kopf

    private var schrift: Color { karte.istEntfall ? Color.white : Fachfarbe.schriftAufKopf(hex) }

    private var fachKurz: String {
        if istVeranstaltung { return karte.anzeigeText.isEmpty ? (karte.anzeigeArt.isEmpty ? "Veranstaltung" : karte.anzeigeArt) : karte.anzeigeText }
        if !karte.fach.isEmpty { return karte.fach }
        return karte.titel.isEmpty ? "Stunde" : karte.titel
    }

    private var fachLang: String {
        let n = karte.fachName.trimmingCharacters(in: .whitespacesAndNewlines)
        return n.caseInsensitiveCompare(fachKurz) == .orderedSame ? "" : n
    }

    private var stundentext: String {
        karte.von == karte.bis ? "\(karte.von). Stunde" : "\(karte.von).–\(karte.bis). Stunde"
    }

    private var beginnMin: Int? { Rasterzeit.minuten(karte.beginn) }
    private var endeMin: Int? { Rasterzeit.minuten(karte.ende) }

    private var zeitKurz: String {
        guard let b = beginnMin else { return stundentext }
        guard let e = endeMin else { return Uhr.uhrzeit(b) }
        return "\(Uhr.uhrzeit(b)) – \(Uhr.uhrzeit(e))"
    }

    private var zeitzeile: String {
        guard let b = beginnMin, let e = endeMin else { return stundentext }
        return "\(Uhr.uhrzeit(b)) – \(Uhr.uhrzeit(e))  ·  \(stundentext)  ·  \(Uhr.dauer(e - b))"
    }

    private var kopf: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(Datumsformat.anzeige(karte.datum, "EEEE, d. MMMM").uppercased())
                .font(.caption.weight(.bold))
                .tracking(0.8)
                .opacity(0.8)
            VStack(alignment: .leading, spacing: 2) {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    if let alt = karte.fachAlt, !alt.isEmpty, alt != karte.fach, !istVeranstaltung {
                        Text(alt)
                            .font(.title2.weight(.semibold))
                            .strikethrough(true)
                            .opacity(0.6)
                        Image(systemName: "arrow.right")
                            .font(.title3.weight(.bold))
                            .opacity(0.7)
                            .accessibilityHidden(true)
                    }
                    Text(fachKurz)
                        .font(.system(size: titelGroesse, weight: .bold))
                        .strikethrough(karte.istEntfall)
                        .lineLimit(2)
                        .minimumScaleFactor(0.5)
                }
                if !fachLang.isEmpty {
                    Text(fachLang)
                        .font(.title3.weight(.medium))
                        .opacity(0.9)
                        .lineLimit(2)
                }
            }
            if merkmal != nil || karte.online || karte.statusPille != nil {
                HStack(spacing: 6) {
                    if let merkmal { Statusabzeichen(merkmal: merkmal, aufKopf: true) }
                    if let p = karte.statusPille, p != merkmal?.text, p != "Prüfung" {
                        Statusabzeichen(merkmal: Statusmerkmal(text: p, farbe: Farben.text, flaeche: Farben.flaeche, symbol: "tag"), aufKopf: true)
                    }
                    if daten.istOnline { Statusabzeichen(merkmal: Statuslehre.online, aufKopf: true) }
                }
            }
            Text(zeitzeile)
                .font(.subheadline.weight(.semibold))
                .monospacedDigit()
                .opacity(0.92)
            fortschritt
        }
        .foregroundStyle(schrift)
        .padding(.horizontal, 20)
        .padding(.top, 58)
        .padding(.bottom, 24)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            ZStack {
                kopfFarbe
                if karte.istEntfall {
                    Streifenmuster(abstand: 10)
                        .stroke(Color.white.opacity(0.14), lineWidth: 1.5)
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }

    /// Fortschritt der laufenden Stunde (nur heute zwischen Beginn und Ende).
    @ViewBuilder
    private var fortschritt: some View {
        if Datumsformat.istHeute(karte.datum), let b = beginnMin, let e = endeMin, e > b {
            TimelineView(.periodic(from: .now, by: 30)) { kontext in
                let m = Uhr.minuten(kontext.date)
                if m >= b && m < e {
                    let anteil = CGFloat(m - b) / CGFloat(e - b)
                    HStack(spacing: 10) {
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule().fill(schrift.opacity(0.25))
                                Capsule().fill(schrift).frame(width: max(6, geo.size.width * anteil))
                            }
                        }
                        .frame(height: 6)
                        Text("noch \(Uhr.dauer(e - m))")
                            .font(.caption.weight(.bold))
                            .monospacedDigit()
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("Läuft gerade, noch \(Uhr.dauerGesprochen(e - m))")
                }
            }
            .frame(height: 18)
        }
    }

    /// Knöpfe oben rechts aus Glas: Menü (Im Plan anzeigen, Teilen) und Schließen.
    private var kopfknoepfe: some View {
        GlasGruppe(abstand: 8) {
            HStack(spacing: 8) {
                if !planziele.isEmpty || kachel != nil {
                    Menu {
                        if !planziele.isEmpty {
                            Section("Im Plan anzeigen") {
                                ForEach(planziele) { plan in
                                    Button {
                                        zustand.planZeigen(plan)
                                        schliessen()
                                    } label: {
                                        Label(Planziele.titel(plan), systemImage: Planziele.symbol(plan))
                                    }
                                }
                            }
                        }
                        if let k = kachel {
                            ShareLink(item: Stundentext.teilen(k)) {
                                Label("Teilen", systemImage: "square.and.arrow.up")
                            }
                        }
                    } label: {
                        rundSymbol("ellipsis")
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Weitere Aktionen")
                }
                Button {
                    Haptik.tippen()
                    schliessen()
                } label: {
                    rundSymbol("xmark")
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Schließen")
            }
        }
        .padding(.trailing, Stilmass.rand)
        .padding(.top, 4)
    }

    /// Runder Glasknopf über dem farbigen Kopf.
    private func rundSymbol(_ name: String) -> some View {
        GlasSymbol(name: name, farbe: schrift, groesse: 44)
    }

    @ViewBuilder
    private var hinweisToast: some View {
        if let hinweis = daten.hinweis {
            Text(hinweis)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Farben.flaeche)
                .lineLimit(2)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Farben.text, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                .padding(.bottom, 28)
                .transition(.opacity)
                .task(id: hinweis) {
                    try? await Task.sleep(nanoseconds: 2_400_000_000)
                    withAnimation { daten.hinweis = nil }
                }
        }
    }

    // MARK: - Reiter (gleichzeitige Stunden)

    private func reitertitel(_ k: Karte) -> String {
        if k.istVeranstaltung { return "Veranstaltung" }
        if !k.fach.isEmpty { return k.fach }
        if !k.anzeigeText.isEmpty { return k.anzeigeText }
        return k.anzeigeArt.isEmpty ? "Stunde" : k.anzeigeArt
    }

    private var reiterleiste: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(Array(karten.enumerated()), id: \.offset) { eintrag in
                    let gewaehlt = eintrag.offset == auswahl
                    let stil = Kartenstil(eintrag.element)
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) { auswahl = eintrag.offset }
                    } label: {
                        HStack(spacing: 6) {
                            Circle()
                                .fill(Fachfarbe.voll(eintrag.element.farbe) ?? Farben.randStark)
                                .frame(width: 8, height: 8)
                            Text(reitertitel(eintrag.element))
                                .font(.subheadline.weight(gewaehlt ? .bold : .medium))
                                .lineLimit(1)
                            if let p = stil.plakette {
                                Text(p)
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(stil.plaketteFarbe)
                            }
                        }
                        .foregroundStyle(gewaehlt ? Farben.aufAkzent : Farben.text)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(gewaehlt ? Farben.akzent : Farben.flaeche, in: Capsule())
                        .overlay { Capsule().strokeBorder(gewaehlt ? Color.clear : Farben.rand, lineWidth: 1) }
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(gewaehlt ? .isSelected : [])
                }
            }
            .padding(.horizontal, Stilmass.rand)
            .padding(.vertical, 10)
        }
        .scrollIndicators(.hidden)
        .background(Farben.flaeche2)
        .overlay(alignment: .bottom) { Rectangle().fill(Farben.rand).frame(height: 0.5) }
    }

    // MARK: - Karten

    /// Vertretungstext bzw. Information der Stunde (Zusatzstunde: nur manuell eingegebene Texte).
    private var detailText: String {
        karte.istZusatzstunde ? karte.zusatzText : karte.anzeigeText
    }

    private var textTitel: String {
        karte.keineVertretung || karte.status == "regulaer" ? "Information zur Stunde" : "Vertretungstext"
    }

    private var lehrerGeaendert: Bool { karte.lehrer.contains(where: \.geaendert) || karte.istOffeneVertretung }
    private var raumGeaendert: Bool { daten.aktuelleRaeume.contains(where: \.geaendert) }
    private var klasseGeaendert: Bool { karte.klassen.contains(where: \.geaendert) || !karte.mitklassen.filter(\.geaendert).isEmpty }
    private var fachGeaendert: Bool { (karte.fachAlt ?? "").isEmpty == false && karte.fachAlt != karte.fach }

    private var hatAenderung: Bool {
        karte.istEntfall || lehrerGeaendert || raumGeaendert || klasseGeaendert || fachGeaendert || karte.verlegung != nil
            || (!istVeranstaltung && !detailText.isEmpty && textTitel == "Vertretungstext")
    }

    @ViewBuilder
    private var aenderungsKarte: some View {
        if hatAenderung {
            let farbe = karte.istEntfall ? Farben.entfall : Farben.aenderung
            VStack(alignment: .leading, spacing: 12) {
                Label(karte.istEntfall ? "Diese Stunde entfällt" : "Änderungen", systemImage: karte.istEntfall ? "xmark.circle.fill" : "arrow.left.arrow.right.circle.fill")
                    .font(.headline)
                    .foregroundStyle(farbe)
                if fachGeaendert, let alt = karte.fachAlt {
                    wechselZeile("Fach", wechselText([Wert(k: karte.fach, alt: alt, neu: true)]))
                }
                if lehrerGeaendert && !karte.istEntfall {
                    if karte.istOffeneVertretung && karte.lehrer.allSatisfy({ $0.k.isEmpty }) {
                        wechselZeile("Lehrkraft", Text(karte.offeneLehrkraefte.joined(separator: ", ")).strikethrough(true, color: Farben.aenderung)
                            + Text("  ·  Vertretung offen").foregroundColor(Farben.aenderung))
                    } else {
                        wechselZeile("Lehrkraft", wechselText(karte.lehrer))
                    }
                }
                if raumGeaendert && !karte.istEntfall {
                    wechselZeile("Raum", wechselText(daten.aktuelleRaeume))
                }
                if klasseGeaendert && !karte.istEntfall {
                    wechselZeile("Klasse", wechselText(karte.klassen + karte.mitklassen))
                }
                if let richtung = karte.verlegung {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(richtung == "von" ? "Verlegt" : "Hierher verlegt")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Farben.text)
                        if let von = karte.verlegungVon?.text, !von.isEmpty {
                            Text("Von: \(von)").font(.subheadline).foregroundStyle(Farben.text2)
                        }
                        if let nach = karte.verlegungNach?.text, !nach.isEmpty {
                            Text("Nach: \(nach)").font(.subheadline).foregroundStyle(Farben.text2)
                        }
                    }
                }
                if !istVeranstaltung && !detailText.isEmpty {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(textTitel)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Farben.text3)
                        Text(detailText)
                            .font(.body)
                            .foregroundStyle(Farben.text)
                            .textSelection(.enabled)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background {
                ZStack {
                    RoundedRectangle(cornerRadius: Stilmass.radius, style: .continuous)
                        .fill(karte.istEntfall ? Farben.entfallFlaeche : Farben.aenderungFlaeche)
                    if karte.istEntfall {
                        Streifenmuster(abstand: 9)
                            .stroke(Farben.entfall.opacity(0.08), lineWidth: 1)
                            .clipShape(RoundedRectangle(cornerRadius: Stilmass.radius, style: .continuous))
                    }
                }
            }
            .overlay {
                RoundedRectangle(cornerRadius: Stilmass.radius, style: .continuous)
                    .strokeBorder(farbe.opacity(0.35), lineWidth: 1)
            }
            .accessibilityElement(children: .combine)
        }
    }

    private func wechselZeile(_ titel: String, _ wert: Text) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(titel)
                .font(.subheadline)
                .foregroundStyle(Farben.text3)
                .frame(minWidth: 76, alignment: .leading)
            wert
                .font(.title3.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(Farben.text)
            Spacer(minLength: 0)
        }
    }

    // MARK: Fakten

    private func ohneDoppelte(_ werte: [String]) -> [String] {
        var ergebnis: [String] = []
        for w in werte where !w.isEmpty && !ergebnis.contains(where: { $0.caseInsensitiveCompare(w) == .orderedSame }) {
            ergebnis.append(w)
        }
        return ergebnis
    }

    private var klassenText: String {
        var teile = ohneDoppelte(karte.klassen.map { $0.k.isEmpty ? ($0.alt ?? "") : $0.k } + karte.mitklassen.map(\.k))
        if !karte.gruppe.isEmpty { teile.append(karte.gruppe) }
        return teile.joined(separator: ", ")
    }

    private var faktenRaster: some View {
        let spalten = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]
        let raeume = daten.aktuelleRaeume.filter { !$0.k.isEmpty || !($0.alt ?? "").isEmpty }
        let lehrer = karte.lehrer.filter { !$0.k.isEmpty || !($0.alt ?? "").isEmpty }
        return LazyVGrid(columns: spalten, spacing: 10) {
            fakt("Raum", symbol: "door.left.hand.open",
                 wert: raeume.isEmpty ? Text(daten.istOnline ? "Online" : "–") : wechselText(raeume), gross: true)
            fakt(lehrer.count > 1 ? "Lehrkräfte" : "Lehrkraft", symbol: "person",
                 wert: lehrer.isEmpty ? Text("–") : wechselText(lehrer), gross: true)
            fakt(karte.klassen.count + karte.mitklassen.count > 1 ? "Klassen" : "Klasse", symbol: "person.3",
                 wert: Text(klassenText.isEmpty ? "–" : klassenText), gross: false)
            fakt("Zeit", symbol: "clock",
                 wert: Text(zeitKurz), gross: false)
            if !karte.abwesendeKlassen.isEmpty {
                fakt("Fehlt", symbol: "person.crop.circle.badge.xmark",
                     wert: Text("\(karte.abwesendeKlassen.joined(separator: ", ")) – \(karte.abwesendText.isEmpty ? "abwesend" : karte.abwesendText)"),
                     gross: false)
            }
            if karte.hausaufgabeFaellig {
                fakt("Hausaufgabe", symbol: "checklist", wert: Text("fällig zu dieser Stunde"), gross: false)
            }
        }
    }

    private func fakt(_ titel: String, symbol: String, wert: Text, gross: Bool) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Label(titel, systemImage: symbol)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Farben.text3)
                .labelStyle(.titleAndIcon)
            wert
                .font(gross ? Font.title2.weight(.bold) : Font.body.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(Farben.text)
                .lineLimit(3)
                .minimumScaleFactor(0.7)
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: gross ? 88 : 72, alignment: .topLeading)
        .kartenflaeche()
        .accessibilityElement(children: .combine)
    }

    // MARK: Prüfung, Information

    @ViewBuilder
    private var pruefungsKarte: some View {
        if karte.istPruefung && !karte.istEntfall {
            abschnitt(titel: karte.anzeigeArt.isEmpty ? "Prüfung" : karte.anzeigeArt, symbol: "doc.text", farbe: Farben.pruefung,
                      flaeche: Farben.pruefungFlaeche) {
                VStack(alignment: .leading, spacing: 4) {
                    let fach = karte.fachName.isEmpty ? karte.fach : karte.fachName
                    if !fach.isEmpty {
                        Text(fach).font(.body.weight(.semibold)).foregroundStyle(Farben.text)
                    }
                    if !karte.anzeigeText.isEmpty && karte.anzeigeText != karte.anzeigeArt {
                        Text(karte.anzeigeText).font(.body).foregroundStyle(Farben.text2).fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var infoKarte: some View {
        if istVeranstaltung {
            let info = Kachelbau.veranstaltungsInfo(karte)
            if !info.isEmpty {
                abschnitt(titel: "Information", symbol: "calendar", farbe: Farben.termin, flaeche: Farben.terminFlaeche) {
                    Text(info)
                        .font(.body)
                        .foregroundStyle(Farben.text)
                        .textSelection(.enabled)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        } else if !hatAenderung && !detailText.isEmpty {
            abschnitt(titel: textTitel, symbol: "info.circle", farbe: Farben.akzent, flaeche: Farben.flaeche) {
                Text(detailText)
                    .font(.body)
                    .foregroundStyle(Farben.text)
                    .textSelection(.enabled)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    // MARK: Online (nur lesend – festgelegt in UntPlan Studio)

    @ViewBuilder
    private var onlineKarte: some View {
        if !istVeranstaltung && daten.istOnline {
            let url = Karte.onlineURL(daten.onlineLink)
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 12) {
                    Image(systemName: "video.fill")
                        .font(.title3)
                        .foregroundStyle(Farben.aufAkzent)
                        .frame(width: 44, height: 44)
                        .background(Farben.akzent, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Online-Unterricht")
                            .font(.headline)
                            .foregroundStyle(Farben.text)
                        Text(url?.host ?? "Noch kein Link hinterlegt")
                            .font(.subheadline)
                            .foregroundStyle(Farben.text2)
                            .lineLimit(1)
                            .truncationMode(.middle)
                    }
                    Spacer(minLength: 0)
                }
                if let url {
                    Button {
                        Haptik.tippen()
                        oeffneURL(url)
                    } label: {
                        Label("Beitreten", systemImage: "arrow.up.forward.app")
                            .font(.body.weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                    }
                    .glasKnopf(hervorgehoben: true)
                    .tint(Farben.akzent)
                    .accessibilityHint("Öffnet den Link zum Online-Unterricht")
                }
                if kollegium {
                    Text("Ob eine Stunde online stattfindet, wird in EduOrga Studio festgelegt.")
                        .font(.footnote)
                        .foregroundStyle(Farben.text3)
                }
            }
            .padding(16)
            .kartenflaeche(Farben.primaerFlaeche)
        }
    }

    // MARK: Unterricht: Thema und Hausaufgaben

    private var thema: String { daten.eintrag?.thema ?? "" }
    private var geerbtesThema: String { daten.geerbterEintrag?.thema ?? "" }

    @ViewBuilder
    private var unterrichtKarte: some View {
        let hausaufgaben = daten.hausaufgaben?.liste ?? []
        let faellig = daten.hausaufgaben?.faellig ?? []
        let themaSichtbar = !thema.isEmpty || !geerbtesThema.isEmpty || (kollegium && daten.darf)
        if mitUnterricht && !istVeranstaltung && (themaSichtbar || !hausaufgaben.isEmpty || !faellig.isEmpty || daten.geladen) {
            abschnitt(titel: "Unterricht", symbol: "book.closed", farbe: Farben.akzent, flaeche: Farben.flaeche) {
                VStack(alignment: .leading, spacing: 14) {
                    if themaSichtbar {
                        verweis(.lehrstoff, aktiv: kollegium && daten.darf) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("Thema")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(Farben.text3)
                                if !thema.isEmpty {
                                    Text(thema).font(.body).foregroundStyle(Farben.text).fixedSize(horizontal: false, vertical: true)
                                } else if !geerbtesThema.isEmpty {
                                    Text("Block: \(geerbtesThema)").font(.body).foregroundStyle(Farben.text2)
                                } else {
                                    Text("Noch kein Thema eingetragen").font(.body).foregroundStyle(Farben.text3)
                                }
                            }
                        }
                    }
                    if !faellig.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Heute fällig")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(Farben.pruefung)
                            ForEach(faellig) { h in hausaufgabenZeile(h) }
                        }
                    }
                    verweis(.hausaufgaben, aktiv: true) {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text("Hausaufgaben")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(Farben.text3)
                                if !hausaufgaben.isEmpty { ZahlPlakette(zahl: hausaufgaben.count) }
                            }
                            if hausaufgaben.isEmpty {
                                Text(daten.geladen ? "Keine Hausaufgaben aufgegeben" : "Wird geladen …")
                                    .font(.body)
                                    .foregroundStyle(Farben.text3)
                            } else {
                                ForEach(hausaufgaben.prefix(4)) { h in hausaufgabenZeile(h) }
                            }
                        }
                    }
                }
            }
        }
    }

    private func hausaufgabenZeile(_ h: Hausaufgabeneintrag) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Image(systemName: h.erledigt ? "checkmark.circle.fill" : "circle")
                .font(.footnote)
                .foregroundStyle(h.erledigt ? Farben.ok : Farben.text3)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 1) {
                Text(h.text)
                    .font(.body)
                    .foregroundStyle(Farben.text)
                    .lineLimit(4)
                if let f = h.faellig, !f.isEmpty {
                    Text("fällig \(Datumsformat.anzeige(f, "EE d.M."))")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(Farben.akzent)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: Klassenbuch (Lehrkräfte)

    @ViewBuilder
    private var klassenbuchKarte: some View {
        if kollegium && mitUnterricht && !istVeranstaltung {
            abschnitt(titel: "Klassenbuch", symbol: "text.book.closed", farbe: Farben.akzent, flaeche: Farben.flaeche, innen: false) {
                VStack(spacing: 0) {
                    if daten.hatEinzelstunden {
                        bereichsMenue
                        Divider().padding(.leading, Detailmass.rand)
                    }
                    NavigationLink(value: Detailseite.schueler) {
                        Detailzeile(titel: "Schüler*innen", untertitel: daten.anwesenheit?.kontrolliert == true ? "Anwesenheit kontrolliert" : "Anwesenheit erfassen") {
                            if daten.anwesenheit != nil || daten.geladen {
                                SchuelerPlakette(zahl: daten.abwesendAnzahl, kontrolliert: daten.anwesenheit?.kontrolliert == true)
                            }
                        }
                    }
                    .buttonStyle(ZeilenKnopfStil())
                    Divider().padding(.leading, Detailmass.rand)
                    NavigationLink(value: Detailseite.sitzplan) {
                        Detailzeile(titel: "Sitzplan", untertitel: "Anwesenheit am Platz antippen")
                    }
                    .buttonStyle(ZeilenKnopfStil())
                    Divider().padding(.leading, Detailmass.rand)
                    NavigationLink(value: Detailseite.lehrstoff) {
                        Detailzeile(titel: "Lehrstoff", untertitel: thema.isEmpty ? "Noch nicht eingetragen" : thema) {
                            if !thema.isEmpty {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(Farben.ok)
                                    .accessibilityLabel("eingetragen")
                            }
                        }
                    }
                    .buttonStyle(ZeilenKnopfStil())
                    if !daten.klassen.isEmpty {
                        Divider().padding(.leading, Detailmass.rand)
                        NavigationLink(value: Detailseite.klassenbuch) {
                            Detailzeile(titel: "Klassenbucheinträge", zahl: daten.geladen ? daten.vermerke.count : nil)
                        }
                        .buttonStyle(ZeilenKnopfStil())
                    }
                    if daten.raumAenderbar {
                        Divider().padding(.leading, Detailmass.rand)
                        VStack(alignment: .leading, spacing: 0) {
                            Text("Raum")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(Farben.text3)
                                .padding(.leading, Detailmass.rand)
                                .padding(.top, 10)
                            RaumZeile(raeume: daten.aktuelleRaeume, ziel: $raumZiel)
                        }
                    }
                }
            }
        }
    }

    /// Doppel- bzw. Blockstunde: Einträge für den ganzen Block oder nur eine Stunde.
    private var bereichsMenue: some View {
        Menu {
            Button {
                Task { await daten.bereichWaehlen(nil, kollegium: kollegium) }
            } label: {
                Menuezeile(titel: "Ganzer Block (\(karte.von).–\(karte.bis). Stunde)", gewaehlt: daten.einzelstunde == nil)
            }
            ForEach(daten.blockStunden) { s in
                Button {
                    Task { await daten.bereichWaehlen(s.stunde, kollegium: kollegium) }
                } label: {
                    Menuezeile(titel: "\(s.stunde). Stunde" + (s.beginn.isEmpty ? "" : " \(Detailmass.uhrzeit(s.beginn))–\(Detailmass.uhrzeit(s.ende))")
                               + (s.eintrag ? " •" : ""), gewaehlt: daten.einzelstunde == s.stunde)
                }
            }
        } label: {
            Detailzeile(titel: "Einträge gelten für", untertitel: daten.bereichText, pfeil: false) {
                Image(systemName: "chevron.up.chevron.down")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Farben.akzent)
            }
        }
        .tint(Color.primary)
    }

    // MARK: Notizen

    @ViewBuilder
    private var notizenKarte: some View {
        let schueler = daten.notizSchueler
        let lehrer = daten.notizLehrer
        let zeigeSchueler = (kollegium && mitUnterricht) || !schueler.isEmpty
        let zeigeLehrer = kollegium && (mitUnterricht || !lehrer.isEmpty)
        if zeigeSchueler || zeigeLehrer {
            abschnitt(titel: "Notizen", symbol: "note.text", farbe: Farben.akzent, flaeche: Farben.flaeche) {
                VStack(alignment: .leading, spacing: 14) {
                    if zeigeSchueler {
                        verweis(.notizSchueler, aktiv: kollegium) {
                            notiz("Für Schüler*innen", schueler)
                        }
                    }
                    if zeigeLehrer {
                        verweis(.notizLehrer, aktiv: true) {
                            notiz("Für Lehrkräfte", lehrer)
                        }
                    }
                }
            }
        }
    }

    private func notiz(_ titel: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(titel)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Farben.text3)
            Text(text.isEmpty ? "Keine Notiz" : text)
                .font(.body)
                .foregroundStyle(text.isEmpty ? Farben.text3 : Farben.text)
                .lineLimit(6)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: Pläne

    /// Räume (auch der ursprüngliche), Klassen und Lehrkräfte, deren Plan das Konto sehen darf.
    private var planziele: [PlanAuswahl] {
        var ergebnis: [PlanAuswahl] = []
        func hinzu(_ typ: String, _ werte: [Wert]) {
            for w in werte {
                for k in [w.alt ?? "", w.k] where !k.isEmpty {
                    let plan = PlanAuswahl(typ: typ, element: k, name: k)
                    if !ergebnis.contains(where: { $0.id == plan.id }) { ergebnis.append(plan) }
                }
            }
        }
        hinzu("raum", daten.aktuelleRaeume)
        if kollegium {
            hinzu("klasse", karte.klassen)
            hinzu("lehrer", karte.lehrer)
        } else if let eigene = zustand.benutzer?.element, !eigene.isEmpty {
            hinzu("klasse", karte.klassen.filter { $0.k.caseInsensitiveCompare(eigene) == .orderedSame })
        }
        return ergebnis
    }

    @ViewBuilder
    private var planzieleKarte: some View {
        let ziele = planziele
        if !ziele.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("Im Plan anzeigen")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Farben.text3)
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        ForEach(ziele) { plan in
                            Button {
                                Haptik.tippen()
                                zustand.planZeigen(plan)
                                schliessen()
                            } label: {
                                Text(plan.anzeige)
                                    .font(.subheadline.weight(.semibold))
                                    .monospacedDigit()
                                    .foregroundStyle(Farben.akzent)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 7)
                                    .background(Farben.primaerFlaeche, in: Capsule())
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Plan \(plan.anzeige) anzeigen")
                        }
                    }
                }
                .scrollIndicators(.hidden)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // MARK: Bausteine

    /// Karte mit Überschrift (Symbol und Titel in der Akzent- bzw. Statusfarbe).
    private func abschnitt<Inhalt: View>(titel: String, symbol: String, farbe: Color, flaeche: Color, innen: Bool = true,
                                         @ViewBuilder inhalt: () -> Inhalt) -> some View {
        VStack(alignment: .leading, spacing: innen ? 12 : 4) {
            Label(titel, systemImage: symbol)
                .font(.headline)
                .foregroundStyle(farbe)
                .padding(.horizontal, innen ? 0 : 16)
                .padding(.top, innen ? 0 : 14)
                .accessibilityAddTraits(.isHeader)
            inhalt()
        }
        .padding(innen ? 16 : 0)
        .padding(.bottom, innen ? 0 : 6)
        .frame(maxWidth: .infinity, alignment: .leading)
        .kartenflaeche(flaeche)
    }

    /// Bereich, der (wenn aktiv) eine Unterseite öffnet – mit Pfeil rechts.
    @ViewBuilder
    private func verweis<Inhalt: View>(_ seite: Detailseite, aktiv: Bool, @ViewBuilder inhalt: () -> Inhalt) -> some View {
        if aktiv {
            NavigationLink(value: seite) {
                HStack(alignment: .center, spacing: 8) {
                    inhalt()
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Image(systemName: "chevron.right")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Farben.pfeil)
                        .accessibilityHidden(true)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        } else {
            inhalt()
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder
    private func ziel(_ seite: Detailseite) -> some View {
        switch seite {
        case .text:
            DetailTextSeite(titel: textTitel, text: detailText, karte: karte)
        case .pruefung:
            DetailTextSeite(titel: "Prüfung", text: karte.anzeigeText, karte: karte)
        case .info:
            DetailTextSeite(titel: "Information zur Stunde", text: Kachelbau.veranstaltungsInfo(karte), karte: karte)
        case .lehrstoff:
            NotizSeite(art: .lehrstoff)
        case .schueler:
            SchuelerSeite()
        case .hausaufgaben:
            HausaufgabenSeite()
        case .klassenbuch:
            KlassenbuchSeite()
        case .notizSchueler:
            NotizSeite(art: .schueler)
        case .notizLehrer:
            NotizSeite(art: .lehrer)
        case .sitzplan:
            SitzplanStundeSeite()
        }
    }
}

// MARK: - Pausenaufsicht

/// Große Ansicht einer Pausenaufsicht: Ort, Zeit, Status, Vertretung bzw. Grund.
struct AufsichtBuehne: View {
    let aufsicht: Aufsicht
    let schliessen: () -> Void

    private var stand: Aufsichtsstand { Kachelbau.aufsichtsstand(aufsicht.status) }
    private var ort: String { aufsicht.gangName.isEmpty ? (aufsicht.gang.isEmpty ? "Aufsicht" : aufsicht.gang) : aufsicht.gangName }

    private var statustext: (String, Color, Color)? {
        switch stand {
        case .regulaer: return nil
        case .vertretung: return ("Vertretung", Farben.aenderung, Farben.aenderungFlaeche)
        case .abgegeben: return ("Vertreten", Farben.text2, Farben.neutralFlaeche)
        case .entfall: return ("Entfällt", Farben.entfall, Farben.entfallFlaeche)
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("PAUSENAUFSICHT · \(Datumsformat.anzeige(aufsicht.datum, "EEEE, d. MMMM").uppercased())")
                        .font(.caption.weight(.bold))
                        .tracking(0.6)
                        .opacity(0.8)
                    Text(ort)
                        .font(.largeTitle.weight(.bold))
                        .strikethrough(stand == .entfall)
                    Text(aufsicht.nachStunde > 0 ? "nach der \(aufsicht.nachStunde). Stunde · \(aufsicht.beginn) – \(aufsicht.ende)"
                                                 : "vor der ersten Stunde · \(aufsicht.beginn) – \(aufsicht.ende)")
                        .font(.subheadline.weight(.semibold))
                        .monospacedDigit()
                }
                .foregroundStyle(Color.white)
                .padding(.horizontal, 20)
                .padding(.top, 58)
                .padding(.bottom, 24)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Farben.akzent)

                VStack(alignment: .leading, spacing: 12) {
                    if let s = statustext {
                        Plakette(text: s.0, farbe: s.1, flaeche: s.2)
                    }
                    if !aufsicht.lehrer.isEmpty || !(aufsicht.alt ?? "").isEmpty {
                        HStack(alignment: .firstTextBaseline, spacing: 12) {
                            Text("Aufsicht")
                                .font(.subheadline)
                                .foregroundStyle(Farben.text3)
                            wechselText([Wert(k: aufsicht.lehrer, alt: aufsicht.alt, neu: (aufsicht.alt ?? "").isEmpty == false)])
                                .font(.title3.weight(.semibold))
                                .foregroundStyle(Farben.text)
                        }
                    }
                    if let grund = aufsicht.grund, !grund.isEmpty {
                        Text("Grund: \(grund)")
                            .font(.body)
                            .foregroundStyle(Farben.text2)
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .kartenflaeche()
                .padding(.horizontal, Stilmass.rand)
            }
            .padding(.bottom, 40)
        }
        .background {
            VStack(spacing: 0) {
                Farben.akzent.frame(height: 300)
                Farben.grund
            }
            .ignoresSafeArea()
        }
        .overlay(alignment: .topTrailing) {
            Button {
                Haptik.tippen()
                schliessen()
            } label: {
                GlasSymbol(name: "xmark", farbe: Color.white, groesse: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Schließen")
            .padding(.trailing, Stilmass.rand)
            .padding(.top, 4)
        }
        .toolbar(.hidden, for: .navigationBar)
    }
}
