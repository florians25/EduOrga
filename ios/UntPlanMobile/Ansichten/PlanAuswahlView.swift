import SwiftUI

/// Planart in der Auswahl (Klassen, Lehrkräfte, Räume aus /api/app/elemente).
enum Plankategorie: String, Hashable, CaseIterable, Identifiable {
    case klasse
    case lehrer
    case raum

    var id: String { rawValue }

    var titel: String {
        switch self {
        case .klasse: return "Klassen"
        case .lehrer: return "Lehrkräfte"
        case .raum: return "Räume"
        }
    }

    var einzahl: String {
        switch self {
        case .klasse: return "Klasse"
        case .lehrer: return "Lehrkraft"
        case .raum: return "Raum"
        }
    }

    func liste(_ e: Elemente) -> [Planelement] {
        switch self {
        case .klasse: return e.klassen
        case .lehrer: return e.lehrer
        case .raum: return e.raeume
        }
    }
}

/// Planauswahl als Blatt: Navigationsleiste mit „Schließen“ und „Bearbeiten“, Suchfeld des Systems (filtert über alle
/// Planarten), darunter „Mein Stundenplan“, Favoriten und die Stundenpläne nach Art. Favoriten lassen sich im
/// Bearbeiten-Modus entfernen und umsortieren.
struct PlanAuswahlView: View {
    @EnvironmentObject var zustand: AppZustand
    @EnvironmentObject var favoriten: Favoriten
    @Environment(\.dismiss) private var systemSchliessen
    @Environment(\.blattSchliessen) private var blattSchliessen

    private func schliessen() {
        if let blattSchliessen { blattSchliessen() } else { systemSchliessen() }
    }

    @Binding var auswahl: PlanAuswahl?
    @State private var elemente: Elemente? = nil
    @State private var suche = ""
    @State private var fehler: String? = nil
    @State private var bearbeiten: EditMode = .inactive
    @State private var pfad: [Plankategorie] = []

    private var imBearbeiten: Bool { bearbeiten == .active }

    /// Schüler*innen und Eltern sehen keine Pläne von Lehrkräften. Klassen (und Räume) zeigt die Auswahl ihnen genau
    /// dann, wenn der Server sie in /api/app/elemente liefert (die Schule kann andere Klassenpläne für Schüler*innen
    /// freigeben); leere Listen blenden die Planart für sie aus.
    private var kategorien: [Plankategorie] {
        Plankategorie.allCases.filter { k in
            guard k != .lehrer || zustand.darfLehrerplaene else { return false }
            guard !zustand.istKollegium, let elemente else { return true }
            return !k.liste(elemente).isEmpty
        }
    }

    var body: some View {
        NavigationStack(path: $pfad) {
            List {
                if let fehler {
                    Fehlerhinweis(text: fehler)
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                }
                if suche.isEmpty {
                    hauptebene
                } else {
                    suchergebnisse
                }
            }
            .listStyle(.insetGrouped)
            .environment(\.editMode, $bearbeiten)
            .searchable(text: $suche, placement: .navigationBarDrawer(displayMode: .always), prompt: "Stundenplan suchen")
            .overlay(alignment: .top) {
                Ladebalken(aktiv: elemente == nil && fehler == nil)
            }
            .navigationTitle("Plan wählen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Schließen") { schliessen() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button(imBearbeiten ? "Fertig" : "Bearbeiten") {
                        withAnimation { bearbeiten = imBearbeiten ? .inactive : .active }
                    }
                    .fontWeight(imBearbeiten ? .semibold : .regular)
                    .disabled(favoriten.liste.isEmpty && !imBearbeiten)
                }
            }
            .navigationDestination(for: Plankategorie.self) { kategorie in
                ElementlisteView(kategorie: kategorie, elemente: elemente, auswahl: auswahl) { plan in
                    waehlen(plan)
                }
                .environmentObject(favoriten)
            }
        }
        .tint(Farben.akzent)
        .task { await laden() }
    }

    // MARK: - Hauptebene

    @ViewBuilder
    private var hauptebene: some View {
        Section {
            Button {
                waehlen(nil)
            } label: {
                HStack(spacing: 12) {
                    Text("Mein Stundenplan")
                        .foregroundStyle(Farben.text)
                    Spacer(minLength: 4)
                    if auswahl == nil {
                        Image(systemName: "checkmark")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Farben.akzent)
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }

        if !favoriten.liste.isEmpty {
            Section("Favoriten") {
                ForEach(favoriten.liste) { fav in
                    HStack(spacing: 12) {
                        Button {
                            waehlen(fav)
                        } label: {
                            HStack(spacing: 12) {
                                Text(fav.anzeige)
                                    .foregroundStyle(Farben.text)
                                    .lineLimit(1)
                                Spacer(minLength: 4)
                                if auswahl?.id == fav.id {
                                    Image(systemName: "checkmark")
                                        .font(.system(size: 15, weight: .semibold))
                                        .foregroundStyle(Farben.akzent)
                                }
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .disabled(imBearbeiten)
                        if !imBearbeiten {
                            Sternknopf(aktiv: true) { favoriten.umschalten(fav) }
                        }
                    }
                    .accessibilityElement(children: .contain)
                }
                .onDelete { favoriten.entfernen($0) }
                .onMove { favoriten.verschieben($0, nach: $1) }
            }
        }

        Section("Stundenpläne") {
            ForEach(kategorien) { kategorie in
                NavigationLink(value: kategorie) {
                    HStack(spacing: 12) {
                        Text(kategorie.titel)
                            .foregroundStyle(Farben.text)
                        Spacer(minLength: 4)
                        if let elemente {
                            Text("\(kategorie.liste(elemente).count)")
                                .foregroundStyle(Farben.text3)
                                .monospacedDigit()
                        }
                    }
                }
                .disabled(imBearbeiten)
            }
        }
    }

    // MARK: - Suche über alle Arten

    @ViewBuilder
    private var suchergebnisse: some View {
        if let elemente {
            let treffer: [Suchtreffer] = kategorien.flatMap { k in
                k.liste(elemente).filter { passt($0) }.map { Suchtreffer(kategorie: k, element: $0) }
            }
            if treffer.isEmpty {
                Text("Keine Treffer für „\(suche)“.")
                    .foregroundStyle(Farben.text3)
                    .frame(maxWidth: .infinity)
                    .listRowBackground(Color.clear)
            } else {
                Section("Treffer") {
                    ForEach(treffer) { t in
                        Elementzeile(element: t.element, kategorie: t.kategorie, zeigeArt: true,
                                     gewaehlt: auswahl?.typ == t.kategorie.rawValue && auswahl?.element == t.element.kurz) {
                            waehlen(PlanAuswahl(typ: t.kategorie.rawValue, element: t.element.kurz, name: t.element.name))
                        }
                        .environmentObject(favoriten)
                    }
                }
            }
        }
    }

    private func passt(_ e: Planelement) -> Bool {
        e.kurz.localizedCaseInsensitiveContains(suche) || e.name.localizedCaseInsensitiveContains(suche)
    }

    private func waehlen(_ plan: PlanAuswahl?) {
        auswahl = plan
        schliessen()
    }

    private func laden() async {
        do {
            elemente = try await zustand.api.elemente()
            fehler = nil
        } catch {
            if let text = zustand.fehlertext(error) { fehler = text }
        }
    }
}

// MARK: - Liste einer Planart

/// Alle Klassen, Lehrkräfte oder Räume, nach Anfangsbuchstaben gruppiert, mit Stern für Favoriten und
/// Buchstabenregister am rechten Rand.
struct ElementlisteView: View {
    let kategorie: Plankategorie
    let elemente: Elemente?
    let auswahl: PlanAuswahl?
    let waehlen: (PlanAuswahl) -> Void
    @EnvironmentObject var favoriten: Favoriten
    @State private var suche = ""

    private var gefiltert: [Planelement] {
        guard let elemente else { return [] }
        let liste = kategorie.liste(elemente)
        if suche.isEmpty { return liste }
        return liste.filter { $0.kurz.localizedCaseInsensitiveContains(suche) || $0.name.localizedCaseInsensitiveContains(suche) }
    }

    /// Gruppe nach Anfangsbuchstaben.
    private struct Gruppe: Identifiable {
        let buchstabe: String
        var liste: [Planelement]
        var id: String { buchstabe }
    }

    private var gruppen: [Gruppe] {
        let sortiert = gefiltert.sorted { $0.kurz.localizedStandardCompare($1.kurz) == .orderedAscending }
        var ergebnis: [Gruppe] = []
        for e in sortiert {
            let b = e.kurz.first.map { String($0).uppercased() } ?? "#"
            if let letzte = ergebnis.last, letzte.buchstabe == b {
                ergebnis[ergebnis.count - 1].liste.append(e)
            } else {
                ergebnis.append(Gruppe(buchstabe: b, liste: [e]))
            }
        }
        return ergebnis
    }

    /// Register am rechten Rand nur ohne Suche und bei mehreren Gruppen.
    private var mitRegister: Bool { suche.isEmpty && gruppen.count > 1 }

    var body: some View {
        ScrollViewReader { leser in
            List {
                if elemente == nil {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .listRowSeparator(.hidden)
                } else if gruppen.isEmpty {
                    Text(suche.isEmpty ? "Keine Einträge." : "Keine Treffer für „\(suche)“.")
                        .foregroundStyle(Farben.text3)
                        .frame(maxWidth: .infinity)
                        .listRowSeparator(.hidden)
                }
                ForEach(gruppen) { gruppe in
                    Section {
                        ForEach(gruppe.liste) { e in
                            Elementzeile(element: e, kategorie: kategorie, zeigeArt: false,
                                         gewaehlt: auswahl?.typ == kategorie.rawValue && auswahl?.element == e.kurz) {
                                waehlen(PlanAuswahl(typ: kategorie.rawValue, element: e.kurz, name: e.name))
                            }
                            .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 0,
                                                      trailing: mitRegister ? Alphabetregister.breite + 8 : 16))
                        }
                    } header: {
                        Text(gruppe.buchstabe)
                    }
                    .id(Alphabetregister.kennung(gruppe.buchstabe))
                }
            }
            .listStyle(.plain)
            // Buchstabenregister am rechten Rand: Antippen oder Ziehen springt zum Buchstaben
            .overlay(alignment: .trailing) {
                if mitRegister {
                    Alphabetregister(vorhanden: gruppen.map(\.buchstabe)) { buchstabe in
                        leser.scrollTo(Alphabetregister.kennung(buchstabe), anchor: .top)
                    }
                    .padding(.vertical, 8)
                    .transition(.opacity)
                }
            }
        }
        .searchable(text: $suche, placement: .navigationBarDrawer(displayMode: .always), prompt: "\(kategorie.titel) suchen")
        .navigationTitle(kategorie.titel)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
    }
}

// MARK: - Bausteine

/// Treffer der Suche über alle Planarten.
struct Suchtreffer: Identifiable {
    let kategorie: Plankategorie
    let element: Planelement
    var id: String { "\(kategorie.rawValue)|\(element.kurz)" }
}

/// Zeile eines Elements: Kürzel auf neutraler Fläche (wie eine Kachel), Name, Haken, Stern.
struct Elementzeile: View {
    let element: Planelement
    let kategorie: Plankategorie
    let zeigeArt: Bool
    let gewaehlt: Bool
    let antippen: () -> Void
    @EnvironmentObject var favoriten: Favoriten

    var body: some View {
        let plan = PlanAuswahl(typ: kategorie.rawValue, element: element.kurz, name: element.name)
        HStack(spacing: 12) {
            Button(action: antippen) {
                HStack(spacing: 12) {
                    Text(String(element.kurz.prefix(5)))
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Farben.text)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                        .padding(.horizontal, 3)
                        .frame(width: 48, height: 32)
                        .background(Farben.flaeche2, in: RoundedRectangle(cornerRadius: 4, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 4, style: .continuous)
                                .strokeBorder(Farben.randStark, lineWidth: 1)
                        }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(element.kurz)
                            .foregroundStyle(Farben.text)
                            .lineLimit(1)
                        let zusatz = [zeigeArt ? kategorie.einzahl : "", element.name != element.kurz ? element.name : ""]
                            .filter { !$0.isEmpty }
                            .joined(separator: " · ")
                        if !zusatz.isEmpty {
                            Text(zusatz)
                                .font(.footnote)
                                .foregroundStyle(Farben.text2)
                                .lineLimit(1)
                        }
                    }
                    Spacer(minLength: 4)
                    if gewaehlt {
                        Image(systemName: "checkmark")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Farben.akzent)
                    }
                }
                .padding(.vertical, 6)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            Sternknopf(aktiv: favoriten.enthaelt(plan)) { favoriten.umschalten(plan) }
        }
    }
}

/// Stern zum An- und Abwählen eines Favoriten.
struct Sternknopf: View {
    let aktiv: Bool
    let umschalten: () -> Void

    var body: some View {
        Button(action: umschalten) {
            Image(systemName: aktiv ? "star.fill" : "star")
                .font(.system(size: 17, weight: .regular))
                .foregroundStyle(aktiv ? Farben.akzent : Farben.pfeil)
                .frame(width: 36, height: 36)
                .contentShape(Rectangle())
        }
        .buttonStyle(.borderless)
        .accessibilityLabel(aktiv ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen")
    }
}

/// Suchfeld in Unterseiten ohne Navigationsleiste des Systems (gleiches Aussehen wie das Suchfeld des Systems);
/// filtert bei jeder Eingabe.
struct Suchleiste: View {
    @Binding var text: String
    let platzhalter: String
    @FocusState private var fokus: Bool

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 15, weight: .regular))
                .foregroundStyle(Farben.text3)
            TextField(platzhalter, text: $text)
                .foregroundStyle(Farben.text)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.search)
                .focused($fokus)
            if !text.isEmpty {
                Button {
                    text = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 15))
                        .foregroundStyle(Farben.pfeil)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Suche leeren")
            }
        }
        .padding(.horizontal, 10)
        .frame(height: 36)
        .background(Farben.neutralFlaeche, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .contentShape(Rectangle())
        .onTapGesture { fokus = true }
        .padding(.horizontal, 16)
        .padding(.top, 6)
        .padding(.bottom, 8)
        .background(Farben.blatt)
    }
}

// MARK: - Buchstabenregister

/// Register A–Z am rechten Rand einer Liste: Antippen oder Ziehen über die Buchstaben springt zur Gruppe des Buchstabens
/// (fehlt er, zur nächsten folgenden, sonst zur letzten davor). „#“ steht oben, wenn es Gruppen mit Ziffern oder
/// Zeichen gibt (z. B. Klassen „10a“). Beim Wechsel des Buchstabens gibt es eine leichte Rückmeldung.
struct Alphabetregister: View {
    /// Vorhandene Gruppen in Listenreihenfolge (Anfangsbuchstaben in Großschreibung).
    let vorhanden: [String]
    let springen: (String) -> Void
    @State private var aktiv: String? = nil
    @State private var rueckmeldung = 0

    static let breite: CGFloat = 22
    static let buchstaben: [String] = (65...90).map { String(UnicodeScalar(UInt8($0))) }

    /// Kennung der Gruppe in der Liste (für `ScrollViewReader.scrollTo`).
    static func kennung(_ buchstabe: String) -> String { "register-" + buchstabe }

    private static func istBuchstabe(_ b: String) -> Bool { buchstaben.contains(b) }

    /// Einträge des Registers: „#“ (nur bei Gruppen ohne Buchstaben A–Z) und A–Z.
    private var eintraege: [String] {
        (vorhanden.contains { !Self.istBuchstabe($0) } ? ["#"] : []) + Self.buchstaben
    }

    /// Gruppe, zu der ein Eintrag springt.
    private func ziel(_ eintrag: String) -> String? {
        if eintrag == "#" { return vorhanden.first { !Self.istBuchstabe($0) } ?? vorhanden.first }
        if vorhanden.contains(eintrag) { return eintrag }
        let buchstabenGruppen = vorhanden.filter(Self.istBuchstabe)
        if let folgend = buchstabenGruppen.first(where: { $0 > eintrag }) { return folgend }
        return buchstabenGruppen.last ?? vorhanden.last
    }

    var body: some View {
        GeometryReader { geo in
            let liste = eintraege
            let zelle = min(16, max(geo.size.height / CGFloat(max(liste.count, 1)), 9))
            let hoehe = zelle * CGFloat(liste.count)
            let oben = (geo.size.height - hoehe) / 2
            VStack(spacing: 0) {
                ForEach(liste, id: \.self) { eintrag in
                    Text(eintrag)
                        .font(.system(size: min(11, zelle * 0.75), weight: .semibold))
                        .foregroundStyle(Farben.akzent)
                        .frame(width: Self.breite, height: zelle)
                        .background(aktiv == eintrag ? Farben.primaerFlaeche : Color.clear,
                                    in: RoundedRectangle(cornerRadius: 3, style: .continuous))
                }
            }
            .frame(width: Self.breite, height: hoehe)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 0, coordinateSpace: .local)
                    .onChanged { wert in
                        let index = Int((wert.location.y / zelle).rounded(.down))
                        let eintrag = liste[min(max(index, 0), liste.count - 1)]
                        guard eintrag != aktiv else { return }
                        aktiv = eintrag
                        rueckmeldung += 1
                        if let ziel = ziel(eintrag) { springen(ziel) }
                    }
                    .onEnded { _ in
                        withAnimation(.easeOut(duration: 0.12)) { aktiv = nil }
                    }
            )
            .position(x: geo.size.width - Self.breite / 2 - 2, y: oben + hoehe / 2)
        }
        .frame(width: Self.breite + 4)
        .sensoryFeedback(.selection, trigger: rueckmeldung)
        .accessibilityElement()
        .accessibilityLabel("Register")
        .accessibilityValue(aktiv ?? "")
        .accessibilityHint("Nach oben oder unten wischen, um zu einem Buchstaben zu springen")
        .accessibilityAdjustableAction { richtung in
            let liste = eintraege
            let jetzt = aktiv.flatMap { liste.firstIndex(of: $0) } ?? -1
            let neu = richtung == .increment ? min(jetzt + 1, liste.count - 1) : max(jetzt - 1, 0)
            aktiv = liste[neu]
            if let ziel = ziel(liste[neu]) { springen(ziel) }
        }
    }
}
