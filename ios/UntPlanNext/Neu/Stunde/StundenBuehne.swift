import SwiftUI

/// Stundendetails (bildschirmfüllend, mit Zoom aus der Kachel) mit zwei Reitern als Segmentschalter oben im Blatt (kein
/// TabView; der zuletzt gewählte Reiter wird je Rolle gemerkt):
/// - „Details“ – ruhig und sachlich im Stil der gruppierten Listen: Kopf (Fach ausgeschrieben und Kürzel, Datum, Stunde und
///   Uhrzeit, Status, Fortschritt), „Änderung“ bzw. „Entfall“ (nur wenn etwas anders ist; je Art ein Kennzeichen – Grün, Rot
///   nur für Entfall, Grau für eine offene Vertretung – und „bisher → neu“), die Angaben (Raum, Lehrkraft, Klasse(n)),
///   Hinweis bzw. Information/Prüfung, Online-Unterricht, Thema, Hausaufgaben (lesen), Notiz und „Im Plan anzeigen“.
/// - „Klassenbuch“ – nur Lehrkräfte (für Schüler*innen und Eltern ausgeblendet): `KlassenbuchReiter` (Thema mit
///   Vorschlägen und automatischem Speichern, Anwesenheitskontrolle, Hausaufgaben, Prüfung eintragen, Einträge, Notizen,
///   Verlauf) – dieselbe Seite wie „Stunde jetzt“.
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

/// Reiter der Stundendetails (nur Lehrkräfte sehen „Klassenbuch“).
enum Stundenreiter: String, Hashable {
    case details
    case klassenbuch
}

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
    /// Zuletzt gewählter Reiter je Rolle („lehrer=klassenbuch;admin=details“) – auf dem Gerät gemerkt
    @AppStorage("stundenReiterJeRolle") private var gemerkteReiter = ""

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
    /// Reiter „Klassenbuch“: nur Lehrkräfte, nur Stunden mit Unterricht (für Schüler*innen und Eltern ausgeblendet).
    private var klassenbuchVerfuegbar: Bool { kollegium && mitUnterricht && !istVeranstaltung }

    /// Kachel derselben fachlichen Logik wie im Plan (Status, Zeilen).
    private var kachel: Kachel? {
        Kachelbau.ausKarte(karte, typ: typ, ich: element.uppercased(), raster: [])
    }

    private var merkmal: Statusmerkmal? {
        if karte.istEntfall { return Statusmerkmal(text: "Entfall", farbe: Farben.entfall, flaeche: Farben.entfallFlaeche, symbol: "xmark") }
        return kachel.flatMap { Statuslehre.merkmal($0) }
    }

    // MARK: Reiter

    private var rolle: String {
        let r = (zustand.benutzer?.rolle ?? "").lowercased()
        return r.isEmpty ? "standard" : r
    }

    private var reiter: Stundenreiter {
        guard klassenbuchVerfuegbar else { return .details }
        for teil in gemerkteReiter.split(separator: ";") {
            let paar = teil.split(separator: "=", maxSplits: 1).map(String.init)
            if paar.count == 2, paar[0] == rolle, let r = Stundenreiter(rawValue: paar[1]) { return r }
        }
        return .details
    }

    private var reiterBindung: Binding<Stundenreiter> {
        Binding(get: { reiter }, set: { neu in
            Haptik.auswahl()
            Tastatur.schliessen()
            var paare = gemerkteReiter.split(separator: ";").map(String.init).filter { !$0.hasPrefix(rolle + "=") }
            paare.append("\(rolle)=\(neu.rawValue)")
            gemerkteReiter = paare.joined(separator: ";")
        })
    }

    var body: some View {
        Group {
            if reiter == .klassenbuch {
                KlassenbuchReiter(karte: karte, daten: daten)
            } else {
                detailsListe
            }
        }
        .safeAreaInset(edge: .top, spacing: 0) { kopfleiste }
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

    /// Oben im Blatt: gleichzeitige Stunden (falls mehrere) und der Segmentschalter „Details | Klassenbuch“, darunter der
    /// Ladebalken.
    private var kopfleiste: some View {
        VStack(spacing: 0) {
            if karten.count > 1 || klassenbuchVerfuegbar {
                VStack(spacing: 8) {
                    if karten.count > 1 {
                        parallelAuswahl
                    }
                    if klassenbuchVerfuegbar {
                        Picker("Ansicht", selection: reiterBindung) {
                            Text("Details").tag(Stundenreiter.details)
                            Text("Klassenbuch").tag(Stundenreiter.klassenbuch)
                        }
                        .pickerStyle(.segmented)
                        .accessibilityLabel("Ansicht der Stunde")
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
            }
            if mitUnterricht && !daten.geladen {
                Ladebalken(aktiv: true)
            }
        }
        .frame(maxWidth: .infinity)
        .background(Farben.grund)
    }

    // MARK: Reiter „Details“

    private var detailsListe: some View {
        List {
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
            klassenbuchHinweis
            planzieleAbschnitt
        }
        .listStyle(.insetGrouped)
        .listSectionSpacing(.compact)
        .scrollContentBackground(.hidden)
        .background(Farben.grund.ignoresSafeArea())
        .overlay(alignment: .bottom) { hinweisToast }
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
            .accessibilityLabel("\(karten.count) Stunden zur selben Zeit")
        } else {
            HStack {
                Text("\(karten.count) Stunden zur selben Zeit")
                    .font(.footnote)
                    .foregroundStyle(Farben.text2)
                Spacer()
                Picker("Stunde", selection: bindung) {
                    ForEach(Array(karten.indices), id: \.self) { i in
                        Text(reitertitel(karten[i])).tag(i)
                    }
                }
                .pickerStyle(.menu)
            }
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
        if karte.istEntfall { return Farben.entfall }
        return Fachfarbe.voll(karte.farbe) ?? Farben.balkenGrau
    }

    /// Kopf: Fach ausgeschrieben groß, daneben das Kürzel; darunter Datum, Stunde und Uhrzeit, der Status als Wort in seiner
    /// Farbe und – heute – der Fortschritt der laufenden Stunde.
    private var titelZeile: some View {
        HStack(alignment: .top, spacing: 12) {
            RoundedRectangle(cornerRadius: 1.5, style: .continuous)
                .fill(balkenFarbe)
                .frame(width: 3)
                .frame(minHeight: 44)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
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
                Text(Datumsformat.anzeige(karte.datum, "EEEE, d. MMMM yyyy"))
                    .font(.subheadline)
                    .foregroundStyle(Farben.text2)
                Text("\(stundentext) · \(zeitKurz)")
                    .font(.subheadline.weight(.medium))
                    .monospacedDigit()
                    .foregroundStyle(Farben.text)
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

    private var geaenderteLehrer: [Wert] { karte.lehrer.filter { $0.geaendert && !$0.k.isEmpty } }
    private var geaenderteRaeume: [Wert] { daten.aktuelleRaeume.filter { $0.geaendert } }
    private var geaenderteKlassen: [Wert] { (karte.klassen + karte.mitklassen).filter { $0.geaendert } }

    private var fachVorher: String? {
        guard let a = karte.fachAlt, !a.isEmpty, a != karte.fach, !istVeranstaltung else { return nil }
        return a
    }

    private var lehrkraftOffen: Bool { karte.istOffeneVertretung }

    /// Abschnitt „Änderung“ bzw. „Entfall“ ganz oben: je Änderungsart ein Kennzeichen (Grün; Rot nur für den Entfall, Grau
    /// für eine offene Vertretung) und rechts „bisher → neu“, dazu Verlegung, Vertretungstext bzw. Grund des Entfalls.
    @ViewBuilder
    private var aenderungAbschnitt: some View {
        if hatAenderung {
            Section {
                if karte.istEntfall {
                    aenderungZeile("Entfall", .entfall, Text("Die Stunde entfällt").foregroundColor(Farben.entfall).fontWeight(.semibold))
                } else {
                    if lehrkraftOffen {
                        if kollegium {
                            aenderungZeile("Vertretung folgt", .offen, offenText)
                        } else {
                            aenderungZeile("Vertretung folgt", .offen, Text("Die Vertretung wird noch eingeteilt").foregroundColor(Farben.text2))
                        }
                    }
                    if !geaenderteLehrer.isEmpty {
                        aenderungZeile("Vertretung", .aenderung, wechselText(geaenderteLehrer))
                    }
                    if !geaenderteRaeume.isEmpty {
                        aenderungZeile("Raumänderung", .aenderung, wechselText(geaenderteRaeume))
                    }
                    if !geaenderteKlassen.isEmpty {
                        let nurFehlend = geaenderteKlassen.allSatisfy { $0.k.isEmpty }
                        aenderungZeile(nurFehlend ? "Klasse fehlt" : "Klasse", nurFehlend ? .offen : .aenderung, wechselText(geaenderteKlassen))
                    }
                    if let alt = fachVorher {
                        aenderungZeile("Fachänderung", .aenderung, wechselText([Wert(k: karte.fach, alt: alt, neu: true)]))
                    }
                    if karte.istZusatzstunde || kachel?.zusatz == true {
                        aenderungZeile("Zusätzlich", .aenderung, Text("Zusätzliche Stunde"))
                    }
                    if kachel?.art == .abgegeben {
                        aenderungZeile("Vertreten", .offen, Text("Eine andere Lehrkraft übernimmt"))
                    }
                    if !aenderungMitAngaben, let merkmal, !lehrkraftOffen {
                        aenderungZeile(merkmal.text, .aenderung, Text(""))
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
                if !karte.istEntfall && (!geaenderteLehrer.isEmpty || !geaenderteRaeume.isEmpty || !geaenderteKlassen.isEmpty || fachVorher != nil) {
                    Text("Grau durchgestrichen: bisher. Grün unterstrichen: neu.")
                }
            }
        }
    }

    /// „Abr → noch offen“ (bisher grau durchgestrichen).
    private var offenText: Text {
        let wer = karte.offeneLehrkraefte.filter { $0 != "???" }.joined(separator: ", ")
        let offen = Text("noch offen").foregroundColor(Farben.text2)
        guard !wer.isEmpty else { return offen }
        return Text(wer).strikethrough(true, color: Farben.text3).foregroundColor(Farben.text3) + Text(" → ") + offen
    }

    /// Gibt es außer dem Status konkrete Angaben?
    private var aenderungMitAngaben: Bool {
        !geaenderteLehrer.isEmpty || !geaenderteRaeume.isEmpty || !geaenderteKlassen.isEmpty || fachVorher != nil
            || karte.verlegung != nil || karte.istZusatzstunde || kachel?.zusatz == true || kachel?.art == .abgegeben
    }

    /// Zeile der Änderung: links das Kennzeichen der Art, rechts der Wert („bisher → neu“).
    private func aenderungZeile(_ art: String, _ ton: Chipton, _ wert: Text) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Chipfeld(ton: ton) {
                Text(art)
                    .font(.footnote.weight(.semibold))
                    .padding(.vertical, 1)
            }
            .fixedSize()
            Spacer(minLength: 8)
            wert
                .font(.body)
                .monospacedDigit()
                .foregroundStyle(Farben.text)
                .multilineTextAlignment(.trailing)
                .textSelection(.enabled)
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var verlegungZeilen: some View {
        if let richtung = karte.verlegung {
            if let von = karte.verlegungVon?.text, !von.isEmpty {
                aenderungZeile(richtung == "von" ? "Verlegt" : "Hierher verlegt", karte.istEntfall ? .entfall : .aenderung,
                               Text("von \(von)"))
            }
            if let nach = karte.verlegungNach?.text, !nach.isEmpty {
                aenderungZeile("Verlegt", karte.istEntfall ? .entfall : .aenderung, Text("auf \(nach)"))
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
        if lehrkraftOffen { return kollegium ? "noch offen" : "Vertretung folgt" }
        return "–"
    }

    /// Angaben der Stunde, so wie sie jetzt gelten – ohne Farbe (die Änderung steht im Abschnitt darüber).
    @ViewBuilder
    private var faktenZeilen: some View {
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

    // MARK: - Thema, Hausaufgaben (lesen)

    private var thema: String { daten.eintrag?.thema ?? "" }
    private var geerbtesThema: String { daten.geerbterEintrag?.thema ?? "" }

    /// Thema der Stunde zum Lesen (nur wenn eingetragen; Lehrkräfte bearbeiten es im Reiter „Klassenbuch“).
    @ViewBuilder
    private var themaAbschnitt: some View {
        if mitUnterricht && !istVeranstaltung && (!thema.isEmpty || !geerbtesThema.isEmpty) {
            Section("Thema") {
                if !thema.isEmpty {
                    langText(thema)
                } else {
                    Text("Block: \(geerbtesThema)").foregroundStyle(Farben.text2)
                }
            }
        }
    }

    @ViewBuilder
    private var hausaufgabenAbschnitt: some View {
        let hausaufgaben = daten.hausaufgaben?.liste ?? []
        let faellig = daten.hausaufgaben?.faellig ?? []
        if mitUnterricht && !istVeranstaltung && (!hausaufgaben.isEmpty || !faellig.isEmpty || (daten.geladen && !kollegium)) {
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
                if hausaufgaben.count > 5 || (!hausaufgaben.isEmpty && !kollegium) {
                    NavigationLink(value: Detailseite.hausaufgaben) {
                        Text(hausaufgaben.count > 5 ? "Alle \(hausaufgaben.count) Hausaufgaben" : "Details")
                            .foregroundStyle(Farben.akzent)
                    }
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

    // MARK: - Notizen (Schüler*innen, Eltern: lesen; Lehrkräfte im Reiter „Klassenbuch“)

    @ViewBuilder
    private var notizenAbschnitt: some View {
        let schueler = daten.notizSchueler
        if !klassenbuchVerfuegbar && !schueler.isEmpty {
            Section("Notiz") {
                langText(schueler)
            }
        }
    }

    // MARK: - Hinweis auf den Reiter „Klassenbuch“ (Lehrkräfte)

    @ViewBuilder
    private var klassenbuchHinweis: some View {
        if klassenbuchVerfuegbar {
            let kontrolliert = daten.anwesenheit?.kontrolliert == true
            Section {
                Button {
                    reiterBindung.wrappedValue = .klassenbuch
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Klassenbuch")
                                .foregroundStyle(Farben.text)
                            Text("Thema \(thema.isEmpty && geerbtesThema.isEmpty ? "offen" : "✓") · Anwesenheit \(kontrolliert ? "✓" : "offen") · Hausaufgabe \((daten.hausaufgaben?.liste ?? []).isEmpty ? "–" : "✓")")
                                .font(.footnote)
                                .foregroundStyle(Farben.text2)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Farben.pfeil)
                            .accessibilityHidden(true)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityHint("Wechselt zum Reiter Klassenbuch")
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

    // MARK: - Unterseiten

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
