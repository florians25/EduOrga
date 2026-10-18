import SwiftUI

/// Details einer Stunde (Blatt beim Antippen einer Kachel): Kopf mit „Schließen“, mittig Datum und Uhrzeit (Menü),
/// rechts das Aktionsmenü („Im Stundenplan anzeigen“); darunter der Kopfblock mit Fach, Status-Plakette, Zeit, Klassen,
/// Räumen und Lehrkräften und die Liste (Vertretungstext, online, Lehrstoff, Schüler*innen, Hausaufgaben,
/// Klassenbucheinträge, Notizen). Unterseiten öffnen sich im selben Blatt.
struct StundendetailView: View {
    let karten: [Karte]
    let typ: String
    var element: String = ""
    @EnvironmentObject var zustand: AppZustand
    /// Gewählter Reiter (bei mehreren Stunden zur selben Zeit)
    @State private var auswahl: Int

    init(karte: Karte, typ: String, element: String = "") {
        self.init(karten: [karte], start: 0, typ: typ, element: element)
    }

    init(karten: [Karte], start: Int, typ: String, element: String = "") {
        self.karten = karten
        self.typ = typ
        self.element = element
        _auswahl = State(initialValue: min(max(start, 0), max(karten.count - 1, 0)))
    }

    var body: some View {
        NavigationStack {
            if karten.indices.contains(auswahl) {
                StundendetailInhalt(karte: karten[auswahl], typ: typ, karten: karten, auswahl: $auswahl)
                    .id(karten[auswahl].id)
            } else {
                ContentUnavailableView("Keine Stunde", systemImage: "calendar")
                    .toolbar(.hidden, for: .navigationBar)
            }
        }
        .environmentObject(zustand)
        .background(Farben.blatt.ignoresSafeArea())
        // Tastatur: Unterseiten mit Textfeldern weichen ihr selbst aus (Systemverhalten, nichts Manuelles); beim
        // Schließen des Blatts wird der Fokus abgegeben, damit keine Tastatur-Einrückung hängen bleibt
        .onDisappear { Tastatur.schliessen() }
    }
}

/// Inhalt der Stundendetails für eine Stunde; bei mehreren Stunden derselben Zeit stehen die Reiter
/// in einer eigenen Zeile zwischen Kopf und Kopfblock (sie überlappen nichts).
struct StundendetailInhalt: View {
    let karte: Karte
    let typ: String
    let karten: [Karte]
    @Binding var auswahl: Int
    @EnvironmentObject var zustand: AppZustand
    @Environment(\.dismiss) private var systemSchliessen
    @Environment(\.blattSchliessen) private var blattSchliessen
    @Environment(\.openURL) private var oeffneURL
    @StateObject private var daten: Stundendaten
    @State private var onlineFehler: String? = nil
    /// Raumliste („Ersetzen“ bzw. „Raum hinzufügen“) aus der Raumzeile
    @State private var raumZiel: RaumZiel? = nil

    init(karte: Karte, typ: String, karten: [Karte], auswahl: Binding<Int>) {
        self.karte = karte
        self.typ = typ
        self.karten = karten
        _auswahl = auswahl
        _daten = StateObject(wrappedValue: Stundendaten(karte: karte))
    }

    /// Blatt schließen (eigene Schließen-Aktion des Blatts, sonst das Systemblatt).
    private func schliessen() {
        if let blattSchliessen { blattSchliessen() } else { systemSchliessen() }
    }

    private var kollegium: Bool { zustand.istKollegium }
    private var mitUnterricht: Bool { karte.unterricht != nil }
    private var istVeranstaltung: Bool { karte.istVeranstaltung }
    /// Klassenbuch, Hausaufgaben usw. werden noch geladen (Ladebalken unter dem Kopf).
    private var laedt: Bool { mitUnterricht && !daten.geladen }

    var body: some View {
        VStack(spacing: 0) {
            Blattkopf(symbol: "xmark", symbolText: "Schließen", aktion: { schliessen() },
                      laedt: karten.count <= 1 && laedt, mitte: {
                datumsMenue
            }, rechts: {
                weitereAktionen
            })
            if karten.count > 1 {
                reiterleiste
                    .overlay(alignment: .bottom) { Ladebalken(aktiv: laedt) }
            }
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    kopfblock
                        .padding(.horizontal, Detailmass.rand)
                        .padding(.top, 14)
                        .padding(.bottom, 14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background {
                            // Entfall: Kopfblock schraffiert wie die Kachel im Raster
                            if karte.istEntfall {
                                ZStack {
                                    Farben.entfallFlaeche
                                    Schraffur(abstand: 8)
                                        .stroke(Farben.entfall.opacity(0.12), lineWidth: 1)
                                }
                                .accessibilityHidden(true)
                            }
                        }
                    Rectangle()
                        .fill(Farben.rand)
                        .frame(height: 1)
                    zeilen
                        .padding(.top, 4)
                        .padding(.bottom, 24)
                }
            }
            .scrollIndicators(.hidden)
        }
        .background(Farben.blatt.ignoresSafeArea())
        // Hauptseite ohne Textfelder: bleibt beim Ein- und Ausblenden der Tastatur (z. B. beim Zurückkehren aus einer
        // Notiz) unverändert stehen
        .ignoresSafeArea(.keyboard, edges: .bottom)
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
        .overlay(alignment: .bottom) {
            if let hinweis = daten.hinweis {
                Text(hinweis)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Farben.flaeche)
                    .lineLimit(2)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Farben.text, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                    .padding(.bottom, 28)
                    .transition(.opacity)
                    .task(id: hinweis) {
                        try? await Task.sleep(nanoseconds: 2_400_000_000)
                        withAnimation { daten.hinweis = nil }
                    }
            }
        }
        .task { await daten.laden(kollegium: kollegium) }
        .environmentObject(daten)
        .alert("Speichern fehlgeschlagen", isPresented: Binding(get: { onlineFehler != nil }, set: { if !$0 { onlineFehler = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(onlineFehler ?? "")
        }
    }

    // MARK: - Kopf (Datum, Uhrzeit, ⋮)

    private var datumstitel: String {
        Datumsformat.anzeige(karte.datum, "EE, dd.MM.yy")
    }

    /// „7:45 - 11:05“ (Stunden ohne führende Null); bei gewählter Einzelstunde deren Zeit mit „3. Std.“.
    private var zeittitel: String {
        if mitBereichswahl, let nr = daten.einzelstunde, let s = daten.blockStunden.first(where: { $0.stunde == nr }) {
            return s.beginn.isEmpty ? "\(nr). Std." : "\(nr). Std. · \(Detailmass.uhrzeit(s.beginn)) - \(Detailmass.uhrzeit(s.ende))"
        }
        return karte.beginn.isEmpty ? stundentext : "\(Detailmass.uhrzeit(karte.beginn)) - \(Detailmass.uhrzeit(karte.ende))"
    }

    /// „Do., 05.11.26 ⌄“ mit Uhrzeit darunter; das Menü nennt Tag und Stunde, wechselt zwischen gleichzeitigen Stunden
    /// und wählt bei Doppel- bzw. Blockstunden, ob Einträge für den ganzen Block oder nur eine Einzelstunde gelten.
    private var datumsMenue: some View {
        Menu {
            Section(Datumsformat.anzeige(karte.datum, "EEEE, d. MMMM yyyy")) {
                Button {} label: {
                    Label(karte.beginn.isEmpty ? stundentext : "\(stundentext) · \(karte.beginn) - \(karte.ende)", systemImage: "clock")
                }
                .disabled(true)
            }
            if mitBereichswahl {
                Section("Einträge gelten für") {
                    Button {
                        bereichBinding.wrappedValue = 0
                    } label: {
                        Label("Ganzer Block (\(karte.von).–\(karte.bis). Stunde)",
                              systemImage: daten.einzelstunde == nil ? "checkmark" : "square.stack")
                    }
                    ForEach(daten.blockStunden) { s in
                        Button {
                            bereichBinding.wrappedValue = s.stunde
                        } label: {
                            Label(stundentitel(s, mitZeit: true) + (s.eintrag ? " •" : ""),
                                  systemImage: daten.einzelstunde == s.stunde ? "checkmark" : "clock")
                        }
                    }
                }
            }
            if karten.count > 1 {
                Section("Stunden zur selben Zeit") {
                    ForEach(Array(karten.enumerated()), id: \.offset) { eintrag in
                        Button {
                            auswahl = eintrag.offset
                        } label: {
                            Label(reitertitel(eintrag.element), systemImage: eintrag.offset == auswahl ? "checkmark" : "book.closed")
                        }
                    }
                }
            }
        } label: {
            Blatttitel(titel: datumstitel, untertitel: zeittitel, pfeil: kollegium || karten.count > 1 || mitBereichswahl)
                .contentShape(Rectangle())
        }
        .tint(Color.primary)
        .accessibilityLabel("\(Datumsformat.anzeige(karte.datum, "EEEE, d. MMMM yyyy")), \(zeittitel)")
    }

    @ViewBuilder
    private var weitereAktionen: some View {
        if !planziele.isEmpty {
            Menu {
                Section("Im Stundenplan anzeigen") {
                    ForEach(planziele) { plan in
                        Button {
                            zustand.planZeigen(plan)
                            schliessen()
                        } label: {
                            Label(plan.anzeige, systemImage: plan.bild)
                        }
                    }
                }
            } label: {
                Rundknopf(symbol: "ellipsis")
            }
            .accessibilityLabel("Weitere Aktionen")
        }
    }

    // MARK: - Ganzer Block / Einzelstunde

    /// Doppel- bzw. Blockstunde: Lehrkräfte wählen im mittigen Menü (Titel mit ⌄), ob Einträge für den ganzen Block
    /// oder nur eine Stunde gelten.
    private var mitBereichswahl: Bool { kollegium && mitUnterricht && !istVeranstaltung && daten.hatEinzelstunden }

    /// „3. Std.“ bzw. mit Uhrzeit im Menü.
    private func stundentitel(_ s: Einzelstundeninfo, mitZeit: Bool) -> String {
        guard mitZeit, !s.beginn.isEmpty else { return "\(s.stunde). Std." }
        return "\(s.stunde). Stunde \(Detailmass.uhrzeit(s.beginn))–\(Detailmass.uhrzeit(s.ende))"
    }

    private var bereichBinding: Binding<Int> {
        Binding(get: { daten.einzelstunde ?? 0 }, set: { neu in
            Task { await daten.bereichWaehlen(neu == 0 ? nil : neu, kollegium: kollegium) }
        })
    }

    // MARK: - Reiter

    private func reitertitel(_ k: Karte) -> String {
        // Veranstaltung: die Bezeichnung steht nur unten in „Information zur Stunde“, nicht im Reiter
        if k.istVeranstaltung { return "Veranstaltung" }
        if !k.fach.isEmpty { return k.fach }
        if !k.anzeigeText.isEmpty { return k.anzeigeText }
        return k.anzeigeArt.isEmpty ? "Stunde" : k.anzeigeArt
    }

    /// Reiterleiste unter dem Kopf (mehrere Stunden zur selben Zeit): waagrecht scrollbare Felder, das gewählte in Marine
    /// auf heller Marine-Fläche; der Reitertext wird nie durchgestrichen. Der gewählte Reiter wird beim Wechsel in den
    /// sichtbaren Bereich gerollt.
    private var reiterleiste: some View {
        ScrollViewReader { leser in
            ScrollView(.horizontal) {
                HStack(spacing: 6) {
                    ForEach(Array(karten.enumerated()), id: \.offset) { eintrag in
                        let gewaehlt = eintrag.offset == auswahl
                        let stil = Kartenstil(eintrag.element)
                        Button {
                            auswahl = eintrag.offset
                        } label: {
                            HStack(spacing: 5) {
                                if stil.plakette != nil {
                                    Circle()
                                        .fill(stil.plaketteFarbe)
                                        .frame(width: 6, height: 6)
                                        .accessibilityHidden(true)
                                }
                                Text(reitertitel(eintrag.element))
                                    .font(.subheadline.weight(gewaehlt ? .semibold : .regular))
                                    .foregroundStyle(gewaehlt ? Farben.akzent : Farben.text)
                                    .lineLimit(1)
                            }
                            .padding(.horizontal, 12)
                            .frame(minWidth: 52, minHeight: 32)
                            .background(gewaehlt ? Farben.primaerFlaeche : Farben.flaeche,
                                        in: RoundedRectangle(cornerRadius: 6, style: .continuous))
                            .overlay {
                                RoundedRectangle(cornerRadius: 6, style: .continuous)
                                    .strokeBorder(gewaehlt ? Farben.primaerRand : Farben.rand, lineWidth: 1)
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .id(eintrag.offset)
                        .accessibilityAddTraits(gewaehlt ? .isSelected : [])
                    }
                }
                .padding(.horizontal, Detailmass.rand)
                .padding(.vertical, 8)
            }
            .scrollIndicators(.hidden)
            .onAppear { leser.scrollTo(auswahl, anchor: .center) }
            .onChange(of: auswahl) { _, neu in
                withAnimation(.easeOut(duration: 0.12)) { leser.scrollTo(neu, anchor: .center) }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Farben.flaeche2)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Farben.rand)
                .frame(height: 0.5)
        }
    }

    /// Vertretungstext bzw. Information der Stunde (Zusatzstunde: nur manuell eingegebene Texte).
    private var detailText: String {
        karte.istZusatzstunde ? karte.zusatzText : karte.anzeigeText
    }

    /// Zeile „Verlegt“ bzw. „Hierher verlegt“: Ursprung und Ziel untereinander (fehlt die Gegenseite, nur der Titel).
    private func verlegungZeile(_ richtung: String) -> some View {
        HStack(spacing: 12) {
            Listensymbol(name: Symbole.verlegung)
            VStack(alignment: .leading, spacing: 2) {
                Text(richtung == "von" ? "Verlegt" : "Hierher verlegt")
                    .font(.body)
                    .foregroundStyle(Farben.text)
                    .lineLimit(1)
                if let von = karte.verlegungVon?.text, !von.isEmpty, let nach = karte.verlegungNach?.text, !nach.isEmpty {
                    Text("Von: \(von)")
                        .font(.subheadline)
                        .foregroundStyle(Farben.text2)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                    Text("Nach: \(nach)")
                        .font(.subheadline)
                        .foregroundStyle(Farben.text2)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
            }
            Spacer(minLength: 6)
        }
        .padding(.leading, Detailmass.rand)
        .padding(.trailing, 16)
        .padding(.vertical, 8)
        .frame(minHeight: 52)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(karte.verlegungText.map { "Verlegung: \($0)" } ?? (richtung == "von" ? "Verlegt" : "Hierher verlegt"))
    }

    private var textTitel: String {
        karte.keineVertretung || karte.status == "regulaer" ? "Information zur Stunde" : "Vertretungstext"
    }

    /// Infotext einer Veranstaltung (Zeile „Information zur Stunde“) – nur hier steht die Bezeichnung der Veranstaltung.
    private var veranstaltungsInfo: String { Kachelbau.veranstaltungsInfo(karte) }

    /// Untertitel der Zeile „Prüfung“ (das Fach, sonst Text bzw. Art).
    private var pruefungsUntertitel: String {
        if !karte.fach.isEmpty { return karte.fach }
        if !karte.anzeigeText.isEmpty { return karte.anzeigeText }
        return karte.anzeigeArt
    }

    /// Angaben zur Prüfung für die Unterseite „Prüfung“.
    private var pruefungsText: String {
        var zeilen: [String] = []
        let art = karte.anzeigeArt.isEmpty ? "Prüfung" : karte.anzeigeArt
        zeilen.append(art)
        let fach = karte.fachName.isEmpty ? karte.fach : (karte.fach.isEmpty ? karte.fachName : "\(karte.fachName) (\(karte.fach))")
        if !fach.isEmpty { zeilen.append("Fach: \(fach)") }
        let klassen = ohneDoppelte(karte.klassen.map { $0.k.isEmpty ? ($0.alt ?? "") : $0.k })
        if !klassen.isEmpty { zeilen.append((klassen.count == 1 ? "Klasse: " : "Klassen: ") + klassen.joined(separator: ", ")) }
        let raeume = ohneDoppelte(daten.aktuelleRaeume.map(\.k))
        if !raeume.isEmpty { zeilen.append((raeume.count == 1 ? "Raum: " : "Räume: ") + raeume.joined(separator: ", ")) }
        let lehrer = ohneDoppelte(karte.lehrer.map(\.k))
        if !lehrer.isEmpty { zeilen.append("Lehrkraft: " + lehrer.joined(separator: ", ")) }
        zeilen.append("Zeit: \(stundentext)" + (karte.beginn.isEmpty ? "" : ", \(karte.beginn) - \(karte.ende)"))
        if !karte.anzeigeText.isEmpty && karte.anzeigeText != art { zeilen.append("\n" + karte.anzeigeText) }
        return zeilen.joined(separator: "\n")
    }

    private var stundentext: String {
        karte.von == karte.bis ? "\(karte.von). Stunde" : "\(karte.von).–\(karte.bis). Stunde"
    }

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

    // MARK: - Kopfblock

    /// „Klasse | Klasse | Gruppe“. Veranstaltung: nur die Klassen – die Lehrkräfte stehen einmal unten in ihrer Zeile.
    private var titelzeile: String {
        var teile = ohneDoppelte(karte.klassen.map { $0.k.isEmpty ? ($0.alt ?? "") : $0.k })
        if !karte.gruppe.isEmpty { teile.append(karte.gruppe) }
        if teile.isEmpty {
            return istVeranstaltung ? "" : karte.titel
        }
        return teile.joined(separator: " | ")
    }

    /// Werte ohne Leere und ohne Doppelte (Groß-/Kleinschreibung egal), Reihenfolge bleibt.
    private func ohneDoppelte(_ werte: [String]) -> [String] {
        var ergebnis: [String] = []
        for w in werte where !w.isEmpty && !ergebnis.contains(where: { $0.caseInsensitiveCompare(w) == .orderedSame }) {
            ergebnis.append(w)
        }
        return ergebnis
    }

    /// Veranstaltung: jede Lehrkraft bzw. jeder Raum nur einmal.
    private func einmal(_ werte: [Wert]) -> [Wert] {
        guard istVeranstaltung else { return werte }
        var ergebnis: [Wert] = []
        for w in werte {
            let t = w.k.isEmpty ? (w.alt ?? "") : w.k
            if t.isEmpty || ergebnis.contains(where: { ($0.k.isEmpty ? ($0.alt ?? "") : $0.k).caseInsensitiveCompare(t) == .orderedSame }) { continue }
            ergebnis.append(w)
        }
        return ergebnis
    }

    /// Fach einer Veranstaltung für die Fachzeile: nur ein eingetragenes Fach, nie die Bezeichnung der Veranstaltung.
    private var veranstaltungsFach: String {
        let f = karte.fach.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !f.isEmpty else { return "" }
        let bezeichnung = karte.anzeigeText.isEmpty ? karte.anzeigeArt : karte.anzeigeText
        return f.caseInsensitiveCompare(bezeichnung) == .orderedSame ? "" : f
    }

    /// Offene Vertretung: Lehrkraft ohne neuen Wert (Karte „offen“ bzw. Kürzel leer und alter Wert gesetzt).
    private var lehrerOffen: Bool { karte.istOffeneVertretung }

    /// Kopfzeile „Klasse | Gruppe“: eigene Klasse(n), anwesende Mitklassen als Text, fehlende durchgestrichen;
    /// Trennstrich grau. Veranstaltung ohne Klassen: keine Kopfzeile.
    private var titelBausteine: [Wertbaustein] {
        var teile: [Wertbaustein] = []
        guard !karte.mitklassen.isEmpty else {
            if titelzeile.isEmpty { return [] }
            for teil in titelzeile.components(separatedBy: " | ") {
                if !teile.isEmpty { teile.append(.trenner) }
                teile.append(.text(teil))
            }
            return teile
        }
        func hinzu(_ b: Wertbaustein) {
            if !teile.isEmpty { teile.append(.trenner) }
            teile.append(b)
        }
        for w in karte.klassen {
            let t = w.k.isEmpty ? (w.alt ?? "") : w.k
            if !t.isEmpty { hinzu(.text(t)) }
        }
        for w in karte.mitklassen {
            if !w.k.isEmpty {
                hinzu(.text(w.k))
            } else if let alt = w.alt, !alt.isEmpty {
                hinzu(.weg(alt))
            }
        }
        if !karte.gruppe.isEmpty { hinzu(.text(karte.gruppe)) }
        return teile
    }

    /// Kopfblock: Fach groß und halbfett mit Status-Plakette (Entfall, Prüfung, Veranstaltung, Zusatzstunde), darunter
    /// der Fachname und je eine Zeile mit Symbol für Zeit, Klassen, Räume und Lehrkräfte. Änderungen als „alt → neu“
    /// (alt durchgestrichen, neu petrolfarben unterstrichen), fehlende Werte durchgestrichen. Jede Angabe steht in genau
    /// einer Zeile, die sich bei vielen Werten waagrecht scrollen lässt; sehr viele Werte (z. B. alle Lehrkräfte oder
    /// Klassen) werden auf „… +N“ gekürzt und lassen sich aufklappen. Veranstaltung: oben keine Bezeichnung (die steht
    /// unten in „Information zur Stunde“) – Fachzeile nur, wenn ein Fach eingetragen ist.
    private var kopfblock: some View {
        let fach = istVeranstaltung ? veranstaltungsFach
                                    : (karte.fach.isEmpty ? karte.anzeigeArt : karte.fach)
        // Pfeil „alt → neu“ bei Räumen, Lehrkräften und Fach
        let raeume = Wertzeile.bausteine(einmal(daten.aktuelleRaeume), durchgestrichen: false, offenAlsPlakette: false, pfeil: true)
        let lehrer = Wertzeile.bausteine(einmal(karte.lehrer), durchgestrichen: Kachelbau.istBereitschaftAbwesend(karte),
                                         offenAlsPlakette: lehrerOffen)
        var fachteile: [Wertbaustein] = []
        if let alt = karte.fachAlt, !alt.isEmpty, alt != karte.fach, !istVeranstaltung {
            fachteile.append(.weg(alt))
            fachteile.append(.pfeil)
            fachteile.append(.neu(fach))
        } else {
            fachteile.append(karte.istEntfall ? .weg(fach) : .text(fach))
        }
        let fachSichtbar = !fach.isEmpty && !(istVeranstaltung && fach.caseInsensitiveCompare(titelzeile) == .orderedSame)
        let plakette: String? = karte.istEntfall ? "Entfall" : karte.statusPille
        let fachname = karte.fachName.trimmingCharacters(in: .whitespacesAndNewlines)
        return VStack(alignment: .leading, spacing: 8) {
            if fachSichtbar || plakette != nil {
                HStack(alignment: .center, spacing: 10) {
                    if fachSichtbar {
                        Wertzeile(bausteine: fachteile, schrift: Detailmass.gross, farbe: Farben.text, gewicht: .semibold)
                            .layoutPriority(1)
                    }
                    if let plakette {
                        Statuspille(text: plakette)
                    }
                    if !fachSichtbar { Spacer(minLength: 0) }
                }
                .frame(minHeight: 30)
            }
            if fachSichtbar && !fachname.isEmpty && fachname.caseInsensitiveCompare(fach) != .orderedSame {
                Text(fachname)
                    .font(.subheadline)
                    .foregroundStyle(Farben.text2)
                    .lineLimit(1)
            }
            VStack(alignment: .leading, spacing: 6) {
                kopfzeile(symbol: "clock") {
                    Wertzeile(bausteine: [.text(zeitzeile)], schrift: Detailmass.klein, farbe: Farben.text)
                }
                let kopfteile = titelBausteine
                if !kopfteile.isEmpty {
                    kopfzeile(symbol: Symbole.klasse) {
                        Wertzeile(bausteine: kopfteile, schrift: Detailmass.klein, farbe: Farben.text,
                                  kuerzenAb: Wertzeile.kuerzungsgrenze)
                    }
                }
                if !raeume.isEmpty {
                    kopfzeile(symbol: Symbole.raum) {
                        Wertzeile(bausteine: raeume, schrift: Detailmass.klein, farbe: Farben.text,
                                  kuerzenAb: Wertzeile.kuerzungsgrenze)
                    }
                }
                if !lehrer.isEmpty {
                    kopfzeile(symbol: Symbole.lehrkraft) {
                        Wertzeile(bausteine: lehrer, schrift: Detailmass.klein, farbe: Farben.text,
                                  kuerzenAb: Wertzeile.kuerzungsgrenze)
                    }
                }
                if !karte.abwesendeKlassen.isEmpty {
                    kopfzeile(symbol: "person.crop.circle.badge.xmark") {
                        Wertzeile(bausteine: [.text("\(karte.abwesendeKlassen.joined(separator: ", ")) – \(karte.abwesendText.isEmpty ? "abwesend" : karte.abwesendText)")],
                                  schrift: Detailmass.klein, farbe: Farben.text2)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    /// „1.–2. Stunde · 7:45 – 9:15“ für den Kopfblock.
    private var zeitzeile: String {
        guard !karte.beginn.isEmpty else { return stundentext }
        return "\(stundentext) · \(Detailmass.uhrzeit(karte.beginn)) – \(Detailmass.uhrzeit(karte.ende))"
    }

    /// Zeile im Kopfblock: graues Symbol in fester Breite, daneben der Inhalt.
    private func kopfzeile<Inhalt: View>(symbol: String, @ViewBuilder inhalt: () -> Inhalt) -> some View {
        HStack(alignment: .center, spacing: 10) {
            Image(systemName: symbol)
                .font(.system(size: 14, weight: .regular))
                .foregroundStyle(Farben.text3)
                .frame(width: 20)
                .accessibilityHidden(true)
            inhalt()
        }
        .frame(minHeight: Detailmass.zeile)
    }

    // MARK: - Liste

    /// Reihenfolge: „Findet online statt“ ganz oben, Raum, Vertretungstext bzw. Information, Lehrstoff,
    /// Schüler*innen, Hausaufgaben, Klassenbucheinträge, Notizen.
    private var zeilen: some View {
        VStack(spacing: 0) {
            if kollegium && mitUnterricht && !istVeranstaltung {
                onlineZeile
                // „Findet online statt“: Link zum Online-Unterricht (Lehrkräfte mit Schreibrecht bearbeiten ihn)
                if daten.istOnline && daten.darf {
                    OnlineLinkZeile()
                }
            }
            if !istVeranstaltung && daten.istOnline && !(kollegium && daten.darf) {
                beitretenZeile
            }
            // Prüfung: eigene Zeile mit dem Fach als Untertitel
            if karte.istPruefung && !karte.istEntfall {
                link(.pruefung, Detailzeile(symbol: Symbole.pruefung, titel: "Prüfung", untertitel: pruefungsUntertitel))
            }
            // Verlegung: Ursprung → Ziel mit Datum und Uhrzeit (ohne Verlegungszeichen)
            if let richtung = karte.verlegung, !istVeranstaltung {
                verlegungZeile(richtung)
            }
            if kollegium && daten.raumAenderbar && !istVeranstaltung {
                RaumZeile(raeume: daten.aktuelleRaeume, ziel: $raumZiel)
            }
            if istVeranstaltung {
                if !veranstaltungsInfo.isEmpty {
                    link(.info, Detailzeile(symbol: Symbole.info, titel: "Information zur Stunde", untertitel: veranstaltungsInfo))
                }
            } else if !detailText.isEmpty {
                // Information zur Stunde mit dem Info-Symbol, Vertretungstext mit dem Notizsymbol; bloße
                // Art-Bezeichnungen wie „Sondereinsatz“ erscheinen nicht; Zusatzstunde: Plakette „Zusatzstunde“ im
                // Kopf, dazu nur ein manuell eingegebener Vertretungstext
                link(.text, Detailzeile(symbol: textTitel == "Information zur Stunde" ? Symbole.info : Symbole.notiz,
                                        titel: textTitel, untertitel: detailText))
            }
            if mitUnterricht && (kollegium || !(daten.eintrag?.thema ?? "").isEmpty) {
                let thema = daten.eintrag?.thema ?? ""
                // Einzelstunde ohne eigenen Lehrstoff: der Lehrstoff des ganzen Blocks gilt (grau, nur lesend)
                let geerbt = daten.geerbterEintrag?.thema ?? ""
                link(.lehrstoff, Detailzeile(symbol: Symbole.lehrstoff, titel: "Lehrstoff",
                                             untertitel: thema.isEmpty && !geerbt.isEmpty ? "Block: \(geerbt)" : thema) {
                    if !thema.isEmpty {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 17, weight: .regular))
                            .foregroundStyle(Farben.ok)
                            .accessibilityLabel("Lehrstoff eingetragen")
                    }
                })
            }
            if kollegium && mitUnterricht {
                link(.schueler, Detailzeile(symbol: Symbole.schueler, titel: "Schüler*innen") {
                    if daten.anwesenheit != nil || daten.geladen {
                        SchuelerPlakette(zahl: daten.abwesendAnzahl, kontrolliert: daten.anwesenheit?.kontrolliert == true)
                            .padding(.trailing, 4)
                    }
                })
            }
            if mitUnterricht {
                link(.hausaufgaben, Detailzeile(symbol: Symbole.hausaufgaben, titel: "Hausaufgaben",
                                                zahl: daten.hausaufgaben.map { $0.liste.count } ?? (daten.geladen ? 0 : nil)))
            }
            if kollegium && !daten.klassen.isEmpty && !istVeranstaltung {
                link(.klassenbuch, Detailzeile(symbol: Symbole.klassenbuch, titel: "Klassenbucheinträge",
                                               zahl: daten.geladen ? daten.vermerke.count : nil))
            }
            if (kollegium && mitUnterricht) || !daten.notizSchueler.isEmpty {
                link(.notizSchueler, Detailzeile(symbol: Symbole.notiz, titel: "Notizen für Schüler*innen", untertitel: daten.notizSchueler))
            }
            // Notizen für Lehrkräfte sehen (und bearbeiten) nur Lehrkräfte
            if kollegium && (mitUnterricht || !daten.notizLehrer.isEmpty) {
                link(.notizLehrer, Detailzeile(symbol: Symbole.notiz, titel: "Notizen für Lehrkräfte", untertitel: daten.notizLehrer))
            }
            if karte.hausaufgabeFaellig {
                Detailzeile(symbol: Symbole.hausaufgaben, titel: "Zu dieser Stunde ist eine Hausaufgabe fällig", pfeil: false)
            }
        }
    }

    /// Menüpunkt der Liste.
    private func link<R: View>(_ seite: Detailseite, _ inhalt: Detailzeile<R>) -> some View {
        NavigationLink(value: seite) {
            inhalt
        }
        .buttonStyle(ZeilenKnopfStil())
    }

    /// „Findet online statt“ – speicherbar für Lehrkräfte mit Schreibrecht (optimistisch, bei Fehler zurück).
    private var onlineZeile: some View {
        Detailzeile(symbol: Symbole.online, titel: "Findet online statt", pfeil: false) {
            Toggle("Findet online statt", isOn: Binding(
                get: { daten.istOnline },
                set: { neu in
                    Task {
                        do {
                            try await daten.onlineSetzen(neu)
                        } catch {
                            onlineFehler = zustand.fehlertext(error)
                        }
                    }
                }))
                .labelsHidden()
                .tint(Farben.akzent)
                .disabled(!daten.darf || !daten.geladen)
        }
    }

    /// Schüler*innen (und Lehrkräfte ohne Schreibrecht): „Online-Unterricht beitreten“ öffnet den Link; ohne Link nur der Hinweis.
    @ViewBuilder
    private var beitretenZeile: some View {
        if let url = Karte.onlineURL(daten.onlineLink) {
            Button {
                oeffneURL(url)
            } label: {
                Detailzeile(symbol: Symbole.online, titel: "Online-Unterricht beitreten", untertitel: url.host ?? daten.onlineLink) {
                    Image(systemName: "arrow.up.forward.app")
                        .font(.system(size: 17, weight: .regular))
                        .foregroundStyle(Farben.akzent)
                }
            }
            .buttonStyle(ZeilenKnopfStil())
            .accessibilityHint("Öffnet den Link zum Online-Unterricht")
        } else {
            Detailzeile(symbol: Symbole.online, titel: "Findet online statt", untertitel: "Noch kein Link hinterlegt", pfeil: false)
        }
    }

    @ViewBuilder
    private func ziel(_ seite: Detailseite) -> some View {
        switch seite {
        case .text:
            DetailTextSeite(titel: textTitel, text: detailText, karte: karte)
        case .pruefung:
            DetailTextSeite(titel: "Prüfung", text: pruefungsText, karte: karte)
        case .info:
            DetailTextSeite(titel: "Information zur Stunde", text: veranstaltungsInfo, karte: karte)
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
        }
    }
}
