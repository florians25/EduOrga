import SwiftUI

/// Stundendetails (bildschirmfüllend, mit Zoom aus der Kachel): ruhige, gut überblickbare Seite im Stil der gruppierten
/// Listen des Systems – kein farbiger Kopf, keine Schmuck-Plaketten, Farbe nur für den Status. Reihenfolge:
/// 1. Kopf: Fach ausgeschrieben und Kürzel, Stunde und Uhrzeit (Datum in der Leiste), Status als Wort, Fortschritt.
/// 2. „Änderung“ bzw. „Entfall“ (nur wenn etwas anders ist): jede geänderte Angabe „bisher → neu“, Verlegung,
///    Vertretungstext bzw. Grund.
/// 3. Angaben, wie sie jetzt gelten: Zeit, Raum, Lehrkraft, Klasse(n), fehlende Klassen.
/// 4. Hinweis bzw. Information/Prüfung, Online-Unterricht, Thema, Hausaufgaben, Notizen, für Lehrkräfte das Klassenbuch
///    (Anwesenheit, Lehrstoff, Einträge) und „Im Plan anzeigen“. Unterseiten öffnen sich im selben Stapel.
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
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) {
                                Button("Schließen") { schliessen() }
                            }
                        }
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

    /// Kachel derselben fachlichen Logik wie im Plan (Status, Zeilen).
    private var kachel: Kachel? {
        Kachelbau.ausKarte(karte, typ: typ, ich: element.uppercased(), raster: [])
    }

    private var merkmal: Statusmerkmal? {
        if karte.istEntfall { return Statusmerkmal(text: "Entfall", farbe: Farben.entfall, flaeche: Farben.entfallFlaeche, symbol: "xmark") }
        return kachel.flatMap { Statuslehre.merkmal($0) }
    }

    var body: some View {
        List {
            if karten.count > 1 {
                Section {
                    parallelAuswahl
                } footer: {
                    Text("\(karten.count) Stunden zur selben Zeit")
                }
            }
            Section {
                titelZeile
            }
            aenderungAbschnitt
            Section {
                faktenZeilen
            }
            textAbschnitt
            onlineAbschnitt
            themaAbschnitt
            hausaufgabenAbschnitt
            notizenAbschnitt
            klassenbuchAbschnitt
            planzieleAbschnitt
        }
        .listStyle(.insetGrouped)
        .listSectionSpacing(.compact)
        .scrollContentBackground(.hidden)
        .background(Farben.grund.ignoresSafeArea())
        .safeAreaInset(edge: .top, spacing: 0) {
            if mitUnterricht && !daten.geladen {
                Ladebalken(aktiv: true)
            }
        }
        .overlay(alignment: .bottom) { hinweisToast }
        .navigationTitle(Datumsformat.anzeige(karte.datum, "EEEE, d. MMMM"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { werkzeuge }
        .navigationDestination(for: Detailseite.self) { seite in
            ziel(seite)
                .environmentObject(daten)
                .environmentObject(zustand)
        }
        .task { await daten.laden(kollegium: kollegium) }
        .environmentObject(daten)
        .sensoryFeedback(.selection, trigger: auswahl)
    }

    // MARK: - Werkzeuge

    @ToolbarContentBuilder
    private var werkzeuge: some ToolbarContent {
        ToolbarItem(placement: .cancellationAction) {
            Button {
                Haptik.tippen()
                schliessen()
            } label: {
                Image(systemName: "xmark")
            }
            .accessibilityLabel("Schließen")
        }
        ToolbarItem(placement: .primaryAction) {
            if let k = kachel {
                ShareLink(item: Stundentext.teilen(k)) {
                    Image(systemName: "square.and.arrow.up")
                }
                .accessibilityLabel("Teilen")
            }
        }
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

    // MARK: - Gleichzeitige Stunden

    private func reitertitel(_ k: Karte) -> String {
        if k.istVeranstaltung { return "Veranstaltung" }
        if !k.fach.isEmpty { return k.fach }
        if !k.anzeigeText.isEmpty { return k.anzeigeText }
        return k.anzeigeArt.isEmpty ? "Stunde" : k.anzeigeArt
    }

    @ViewBuilder
    private var parallelAuswahl: some View {
        let bindung = Binding(get: { auswahl }, set: { neu in
            withAnimation(.easeInOut(duration: 0.15)) { auswahl = neu }
        })
        if karten.count <= 4 {
            Picker("Stunde", selection: bindung) {
                ForEach(Array(karten.indices), id: \.self) { i in
                    Text(reitertitel(karten[i])).tag(i)
                }
            }
            .pickerStyle(.segmented)
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets())
        } else {
            Picker("Stunde", selection: bindung) {
                ForEach(Array(karten.indices), id: \.self) { i in
                    Text(reitertitel(karten[i])).tag(i)
                }
            }
            .pickerStyle(.menu)
        }
    }

    // MARK: - Kopf

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
        return "\(Uhr.uhrzeit(b))–\(Uhr.uhrzeit(e))"
    }

    /// Balken des Kopfs: Fachfarbe bzw. grau (wie die Karte im Plan).
    private var balkenFarbe: Color {
        if karte.istEntfall { return Farben.balkenGrau }
        return Fachfarbe.voll(karte.farbe) ?? Farben.balkenGrau
    }

    /// Kopf: Fach ausgeschrieben groß, daneben das Kürzel; darunter Stunde und Uhrzeit (das Datum steht in der Leiste),
    /// der Status als Wort in seiner Farbe und – heute – der Fortschritt der laufenden Stunde.
    private var titelZeile: some View {
        HStack(alignment: .top, spacing: 12) {
            RoundedRectangle(cornerRadius: 2, style: .continuous)
                .fill(balkenFarbe)
                .frame(width: 4)
                .frame(minHeight: 44)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 5) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(fachLang.isEmpty ? fachKurz : fachLang)
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(karte.istEntfall ? Farben.text2 : Farben.text)
                        .strikethrough(karte.istEntfall, color: Farben.entfall)
                        .lineLimit(3)
                        .fixedSize(horizontal: false, vertical: true)
                    if !fachLang.isEmpty {
                        Text(fachKurz)
                            .font(.title3)
                            .foregroundStyle(Farben.text3)
                            .lineLimit(1)
                    }
                }
                Text("\(stundentext) · \(zeitKurz)")
                    .font(.subheadline)
                    .monospacedDigit()
                    .foregroundStyle(Farben.text2)
                if let merkmal {
                    Text(merkmal.text)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(merkmal.farbe)
                }
                fortschritt
            }
        }
        .padding(.vertical, 6)
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
                    HStack(spacing: 10) {
                        ProgressView(value: Double(m - b), total: Double(e - b))
                            .tint(Farben.akzent)
                        Text("noch \(Uhr.dauer(e - m))")
                            .font(.caption.weight(.semibold))
                            .monospacedDigit()
                            .foregroundStyle(Farben.akzent)
                    }
                    .padding(.top, 2)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("Läuft gerade, noch \(Uhr.dauerGesprochen(e - m))")
                }
            }
        }
    }

    // MARK: - Änderung (oben, nur wenn sich etwas geändert hat)

    /// Entfall, Vertretung, Raum- bzw. Lehrerwechsel, Zusatzstunde, abgegebene Stunde.
    private var hatAenderung: Bool {
        guard !istVeranstaltung else { return false }
        if karte.istEntfall { return true }
        guard let k = kachel else { return false }
        return k.art == .aenderung || k.art == .abgegeben || k.raumAenderung
    }

    private var geaenderteLehrer: [Wert] { karte.lehrer.filter { $0.geaendert } }
    private var geaenderteRaeume: [Wert] { daten.aktuelleRaeume.filter { $0.geaendert } }
    private var geaenderteKlassen: [Wert] { (karte.klassen + karte.mitklassen).filter { $0.geaendert } }

    private var fachVorher: String? {
        guard let a = karte.fachAlt, !a.isEmpty, a != karte.fach, !istVeranstaltung else { return nil }
        return a
    }

    private var lehrkraftOffen: Bool { karte.istOffeneVertretung && karte.lehrer.allSatisfy { $0.k.isEmpty } }

    /// Gibt es außer dem Status konkrete Angaben „bisher → neu“?
    private var aenderungMitAngaben: Bool {
        if karte.istEntfall { return true }
        return lehrkraftOffen || !geaenderteLehrer.isEmpty || !geaenderteRaeume.isEmpty || !geaenderteKlassen.isEmpty
            || fachVorher != nil || karte.verlegung != nil || !detailText.isEmpty
    }

    /// Abschnitt „Änderung“ bzw. „Entfall“ ganz oben: jede geänderte Angabe als „bisher → neu“ (bisher grau
    /// durchgestrichen, neu grün), Verlegung, dazu der Vertretungstext bzw. der Grund des Entfalls.
    @ViewBuilder
    private var aenderungAbschnitt: some View {
        if hatAenderung {
            Section {
                if karte.istEntfall {
                    wertZeile("Status", Text("Entfällt").foregroundColor(Farben.entfall).fontWeight(.semibold))
                } else {
                    if !aenderungMitAngaben, let merkmal {
                        wertZeile("Art", Text(merkmal.text).foregroundColor(merkmal.farbe).fontWeight(.semibold))
                    }
                    if lehrkraftOffen {
                        wertZeile("Lehrkraft", Text(karte.offeneLehrkraefte.joined(separator: ", "))
                                    .strikethrough(true, color: Farben.text3).foregroundColor(Farben.text3)
                                    + Text(" → noch offen").foregroundColor(Farben.aenderung))
                    } else if !geaenderteLehrer.isEmpty {
                        wertZeile(geaenderteLehrer.count > 1 ? "Lehrkräfte" : "Lehrkraft", wechselText(geaenderteLehrer))
                    }
                    if !geaenderteRaeume.isEmpty {
                        wertZeile(geaenderteRaeume.count > 1 ? "Räume" : "Raum", wechselText(geaenderteRaeume))
                    }
                    if !geaenderteKlassen.isEmpty {
                        wertZeile(geaenderteKlassen.count > 1 ? "Klassen" : "Klasse", wechselText(geaenderteKlassen))
                    }
                    if let alt = fachVorher {
                        wertZeile("Fach", wechselText([Wert(k: karte.fach, alt: alt, neu: true)]))
                    }
                }
                verlegungZeilen
                if !detailText.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(karte.istEntfall ? "Grund" : "Hinweis")
                            .font(.footnote)
                            .foregroundStyle(Farben.text2)
                        langText(detailText)
                    }
                    .padding(.vertical, 2)
                }
            } header: {
                Text(karte.istEntfall ? "Entfall" : "Änderung")
            } footer: {
                if !karte.istEntfall && (!geaenderteLehrer.isEmpty || !geaenderteRaeume.isEmpty || !geaenderteKlassen.isEmpty) {
                    Text("Grau durchgestrichen: bisher. Grün: neu.")
                }
            }
        }
    }

    @ViewBuilder
    private var verlegungZeilen: some View {
        if let richtung = karte.verlegung {
            if let von = karte.verlegungVon?.text, !von.isEmpty {
                wertZeile(richtung == "von" ? "Verlegt von" : "Hierher von", Text(von))
            }
            if let nach = karte.verlegungNach?.text, !nach.isEmpty {
                wertZeile("Verlegt nach", Text(nach))
            }
        }
    }

    // MARK: - Angaben (Schlüssel/Wert)

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

    /// Aktueller Wert (bei Entfall der geplante): neuer Wert, sonst der bisherige.
    private func aktuell(_ werte: [Wert]) -> [String] {
        ohneDoppelte(werte.map { w in
            if !w.k.isEmpty { return w.k }
            return karte.istEntfall ? (w.alt ?? "") : ""
        })
    }

    private var raumText: String {
        let r = aktuell(daten.aktuelleRaeume)
        if !r.isEmpty { return r.joined(separator: ", ") }
        if daten.istOnline { return "Online" }
        return daten.aktuelleRaeume.contains { !($0.alt ?? "").isEmpty } ? "noch offen" : "–"
    }

    private var lehrerListe: [String] { aktuell(karte.lehrer) }

    private var lehrerText: String {
        if !lehrerListe.isEmpty { return lehrerListe.joined(separator: ", ") }
        return lehrkraftOffen || karte.istOffeneVertretung ? "noch offen" : "–"
    }

    /// Angaben der Stunde, so wie sie jetzt gelten – ohne Farbe (die Änderung steht im Abschnitt darüber).
    @ViewBuilder
    private var faktenZeilen: some View {
        wertZeile("Zeit", Text("\(zeitKurz) · \(stundentext)"))
        wertZeile("Raum", Text(raumText))
        wertZeile(lehrerListe.count > 1 ? "Lehrkräfte" : "Lehrkraft", Text(lehrerText))
        wertZeile(karte.klassen.count + karte.mitklassen.count > 1 ? "Klassen" : "Klasse",
                  Text(klassenText.isEmpty ? "–" : klassenText))
        if !hatAenderung {
            verlegungZeilen
        }
        if !karte.abwesendeKlassen.isEmpty {
            wertZeile("Fehlt", Text("\(karte.abwesendeKlassen.joined(separator: ", ")) – \(karte.abwesendText.isEmpty ? "abwesend" : karte.abwesendText)"))
        }
        if karte.hausaufgabeFaellig {
            wertZeile("Hausaufgabe", Text("fällig zu dieser Stunde"))
        }
    }

    private func wertZeile(_ titel: String, _ wert: Text) -> some View {
        LabeledContent {
            wert
                .font(.body)
                .monospacedDigit()
                .foregroundStyle(Farben.text)
                .multilineTextAlignment(.trailing)
                .textSelection(.enabled)
        } label: {
            Text(titel)
                .foregroundStyle(Farben.text2)
        }
    }

    // MARK: - Texte

    /// Vertretungstext bzw. Information der Stunde (Zusatzstunde: nur manuell eingegebene Texte).
    private var detailText: String {
        karte.istZusatzstunde ? karte.zusatzText : karte.anzeigeText
    }

    private var textTitel: String {
        karte.keineVertretung || karte.status == "regulaer" ? "Information zur Stunde" : "Vertretungstext"
    }

    @ViewBuilder
    private var textAbschnitt: some View {
        if istVeranstaltung {
            let info = Kachelbau.veranstaltungsInfo(karte)
            if !info.isEmpty {
                Section("Information") {
                    langText(info)
                }
            }
        } else if karte.istPruefung && !karte.istEntfall {
            Section(karte.anzeigeArt.isEmpty ? "Prüfung" : karte.anzeigeArt) {
                let fach = karte.fachName.isEmpty ? karte.fach : karte.fachName
                if !fach.isEmpty {
                    Text(fach).font(.body.weight(.semibold))
                }
                if !karte.anzeigeText.isEmpty && karte.anzeigeText != karte.anzeigeArt {
                    langText(karte.anzeigeText)
                }
            }
        } else if !detailText.isEmpty && !hatAenderung {
            // Bei einer Änderung steht der Text schon im Abschnitt „Änderung“
            Section("Hinweis") {
                langText(detailText)
            }
        }
    }

    private func langText(_ text: String) -> some View {
        Text(text)
            .font(.body)
            .foregroundStyle(Farben.text)
            .textSelection(.enabled)
            .fixedSize(horizontal: false, vertical: true)
    }

    // MARK: - Online (festgelegt in EduOrga Studio)

    @ViewBuilder
    private var onlineAbschnitt: some View {
        if !istVeranstaltung && daten.istOnline {
            let url = Karte.onlineURL(daten.onlineLink)
            Section {
                if let url {
                    Button {
                        Haptik.tippen()
                        oeffneURL(url)
                    } label: {
                        HStack {
                            Label("Online-Unterricht beitreten", systemImage: "video")
                            Spacer()
                            Text(url.host ?? "")
                                .font(.subheadline)
                                .foregroundStyle(Farben.text3)
                                .lineLimit(1)
                                .truncationMode(.middle)
                        }
                    }
                    .accessibilityHint("Öffnet den Link zum Online-Unterricht")
                } else {
                    Label("Online – noch kein Link hinterlegt", systemImage: "video")
                        .foregroundStyle(Farben.text2)
                }
            } header: {
                Text("Online")
            } footer: {
                if kollegium {
                    Text("Ob eine Stunde online stattfindet, wird in EduOrga Studio festgelegt.")
                }
            }
        }
    }

    // MARK: - Thema, Hausaufgaben

    private var thema: String { daten.eintrag?.thema ?? "" }
    private var geerbtesThema: String { daten.geerbterEintrag?.thema ?? "" }
    private var lehrstoffBearbeitbar: Bool { kollegium && daten.darf }

    @ViewBuilder
    private var themaAbschnitt: some View {
        let sichtbar = !thema.isEmpty || !geerbtesThema.isEmpty || lehrstoffBearbeitbar
        if mitUnterricht && !istVeranstaltung && sichtbar {
            Section(kollegium ? "Thema (Lehrstoff)" : "Thema") {
                verweis(.lehrstoff, aktiv: lehrstoffBearbeitbar) {
                    if !thema.isEmpty {
                        langText(thema)
                    } else if !geerbtesThema.isEmpty {
                        Text("Block: \(geerbtesThema)").foregroundStyle(Farben.text2)
                    } else {
                        Text(lehrstoffBearbeitbar ? "Thema eintragen" : "Noch kein Thema eingetragen")
                            .foregroundStyle(lehrstoffBearbeitbar ? Farben.akzent : Farben.text3)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var hausaufgabenAbschnitt: some View {
        let hausaufgaben = daten.hausaufgaben?.liste ?? []
        let faellig = daten.hausaufgaben?.faellig ?? []
        if mitUnterricht && !istVeranstaltung && (!hausaufgaben.isEmpty || !faellig.isEmpty || daten.geladen) {
            if !faellig.isEmpty {
                Section("Heute fällig") {
                    ForEach(faellig) { h in hausaufgabenZeile(h) }
                }
            }
            Section("Hausaufgaben") {
                if hausaufgaben.isEmpty {
                    Text(daten.geladen ? "Keine Hausaufgaben aufgegeben" : "Wird geladen …")
                        .foregroundStyle(Farben.text3)
                } else {
                    ForEach(hausaufgaben.prefix(5)) { h in hausaufgabenZeile(h) }
                }
                NavigationLink(value: Detailseite.hausaufgaben) {
                    Text(kollegium && daten.darf ? "Hausaufgaben bearbeiten" : (hausaufgaben.count > 5 ? "Alle \(hausaufgaben.count) Hausaufgaben" : "Details"))
                        .foregroundStyle(Farben.akzent)
                }
            }
        }
    }

    private func hausaufgabenZeile(_ h: Hausaufgabeneintrag) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Image(systemName: h.erledigt ? "checkmark.circle.fill" : "circle")
                .font(.footnote)
                .foregroundStyle(h.erledigt ? Farben.ok : Farben.text3)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(h.text)
                    .foregroundStyle(Farben.text)
                    .lineLimit(5)
                if let f = h.faellig, !f.isEmpty {
                    Text("fällig \(Datumsformat.anzeige(f, "EE d.M."))")
                        .font(.caption)
                        .foregroundStyle(Farben.text2)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: - Notizen

    @ViewBuilder
    private var notizenAbschnitt: some View {
        let schueler = daten.notizSchueler
        let lehrer = daten.notizLehrer
        let zeigeSchueler = (kollegium && mitUnterricht) || !schueler.isEmpty
        let zeigeLehrer = kollegium && (mitUnterricht || !lehrer.isEmpty)
        if zeigeSchueler || zeigeLehrer {
            Section("Notizen") {
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

    private func notiz(_ titel: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(titel)
                .font(.footnote)
                .foregroundStyle(Farben.text2)
            Text(text.isEmpty ? "Keine Notiz" : text)
                .foregroundStyle(text.isEmpty ? Farben.text3 : Farben.text)
                .lineLimit(6)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - Klassenbuch (Lehrkräfte)

    @ViewBuilder
    private var klassenbuchAbschnitt: some View {
        if kollegium && mitUnterricht && !istVeranstaltung {
            Section {
                if daten.hatEinzelstunden {
                    bereichsMenue
                }
                NavigationLink(value: Detailseite.schueler) {
                    LabeledContent {
                        if daten.anwesenheit != nil || daten.geladen {
                            SchuelerPlakette(zahl: daten.abwesendAnzahl, kontrolliert: daten.anwesenheit?.kontrolliert == true)
                        }
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Anwesenheit")
                            Text(daten.anwesenheit?.kontrolliert == true ? "kontrolliert" : "noch nicht kontrolliert")
                                .font(.footnote)
                                .foregroundStyle(daten.anwesenheit?.kontrolliert == true ? Farben.ok : Farben.text2)
                        }
                    }
                }
                NavigationLink(value: Detailseite.lehrstoff) {
                    LabeledContent("Lehrstoff", value: thema.isEmpty ? "offen" : "eingetragen")
                }
                if !daten.klassen.isEmpty {
                    NavigationLink(value: Detailseite.klassenbuch) {
                        LabeledContent("Klassenbucheinträge", value: daten.geladen ? "\(daten.vermerke.count)" : "")
                    }
                }
            } header: {
                Text("Klassenbuch")
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

    // MARK: - Pläne

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
    private var planzieleAbschnitt: some View {
        let ziele = planziele
        if !ziele.isEmpty {
            Section("Im Plan anzeigen") {
                ForEach(ziele) { plan in
                    Button {
                        Haptik.tippen()
                        zustand.planZeigen(plan)
                        schliessen()
                    } label: {
                        Label(Planziele.titel(plan), systemImage: Planziele.symbol(plan))
                    }
                }
            }
        }
    }

    // MARK: - Bausteine

    /// Zeile, die (wenn aktiv) eine Unterseite öffnet.
    @ViewBuilder
    private func verweis<Inhalt: View>(_ seite: Detailseite, aktiv: Bool, @ViewBuilder inhalt: () -> Inhalt) -> some View {
        if aktiv {
            NavigationLink(value: seite) {
                inhalt()
            }
        } else {
            inhalt()
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
            AnwesenheitSeite()
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

/// Pausenaufsicht im selben ruhigen Stil: Ort, Zeit, Status, Aufsicht (alt → neu) und Grund.
struct AufsichtBuehne: View {
    let aufsicht: Aufsicht
    let schliessen: () -> Void

    private var stand: Aufsichtsstand { Kachelbau.aufsichtsstand(aufsicht.status) }
    private var ort: String { aufsicht.gangName.isEmpty ? (aufsicht.gang.isEmpty ? "Aufsicht" : aufsicht.gang) : aufsicht.gangName }

    private var statustext: (String, Color)? {
        switch stand {
        case .regulaer: return nil
        case .vertretung: return ("Vertretung", Farben.aenderung)
        case .abgegeben: return ("Vertreten", Farben.text2)
        case .entfall: return ("Entfällt", Farben.entfall)
        }
    }

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 4) {
                    Text(ort)
                        .font(.title2.weight(.semibold))
                        .strikethrough(stand == .entfall, color: Farben.entfall)
                    Text("Pausenaufsicht")
                        .font(.subheadline)
                        .foregroundStyle(Farben.text2)
                    if let s = statustext {
                        Text(s.0)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(s.1)
                    }
                }
                .padding(.vertical, 4)
            }
            Section {
                LabeledContent("Zeit", value: "\(aufsicht.beginn)–\(aufsicht.ende)")
                LabeledContent("Lage", value: aufsicht.nachStunde > 0 ? "nach der \(aufsicht.nachStunde). Stunde" : "vor der ersten Stunde")
                if !aufsicht.lehrer.isEmpty || !(aufsicht.alt ?? "").isEmpty {
                    LabeledContent {
                        wechselText([Wert(k: aufsicht.lehrer, alt: aufsicht.alt, neu: (aufsicht.alt ?? "").isEmpty == false)])
                            .foregroundStyle(Farben.text)
                    } label: {
                        Text("Aufsicht")
                    }
                }
                if let grund = aufsicht.grund, !grund.isEmpty {
                    LabeledContent("Grund", value: grund)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(Datumsformat.anzeige(aufsicht.datum, "EEEE, d. MMMM"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button {
                    Haptik.tippen()
                    schliessen()
                } label: {
                    Image(systemName: "xmark")
                }
                .accessibilityLabel("Schließen")
            }
        }
    }
}
