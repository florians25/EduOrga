import SwiftUI

/// Zuletzt geöffnete Pläne der Suche (lokal, höchstens acht).
enum Suchverlauf {
    private static let schluessel = "sucheZuletzt"
    static let hoechstens = 8

    static func laden() -> [PlanAuswahl] {
        guard let daten = UserDefaults.standard.data(forKey: schluessel),
              let liste = try? JSONDecoder().decode([PlanAuswahl].self, from: daten) else { return [] }
        return liste
    }

    static func speichern(_ liste: [PlanAuswahl]) {
        if let daten = try? JSONEncoder().encode(liste) {
            UserDefaults.standard.set(daten, forKey: schluessel)
        }
    }

    /// Plan vorne einreihen (ohne Doppelte).
    static func merken(_ plan: PlanAuswahl, in liste: [PlanAuswahl]) -> [PlanAuswahl] {
        var neu = liste.filter { $0.id != plan.id }
        neu.insert(plan, at: 0)
        return Array(neu.prefix(hoechstens))
    }
}

/// Reiter „Suche“ (Rolle „Suche“ der Tab-Leiste): Pläne von Klassen, Lehrkräften und Räumen schnell finden. Oben
/// Filterchips aus Glas (Alle · Klassen · Lehrkräfte · Räume), ohne Suchbegriff Favoriten (Stern, umsortieren, per
/// Wischen entfernen), zuletzt geöffnete Pläne und alle Pläne nach Art mit Buchstabenregister. Ein Treffer öffnet den
/// Plan direkt hier (mit Wochenleiste, Stundenansicht und Stern); „Plan“ bleibt beim eigenen Plan.
struct SucheView: View {
    @EnvironmentObject var zustand: AppZustand
    @EnvironmentObject var favoriten: Favoriten
    @State private var pfad = NavigationPath()
    @State private var suche = ""
    @State private var filter: Plankategorie? = nil
    @State private var elemente: Elemente? = nil
    @State private var fehler: String? = nil
    @State private var zuletzt: [PlanAuswahl] = []

    /// Schüler*innen und Eltern sehen keine Pläne von Lehrkräften; leere Listen blenden die Planart aus.
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
                        .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                        .listRowBackground(Color.clear)
                }
                if suche.isEmpty && filter == nil {
                    startbereich
                } else {
                    treffer
                }
            }
            .listStyle(.insetGrouped)
            .safeAreaInset(edge: .top, spacing: 0) { chips }
            .overlay(alignment: .top) {
                Ladebalken(aktiv: elemente == nil && fehler == nil)
            }
            .navigationTitle("Suche")
            .navigationBarTitleDisplayMode(.large)
            .searchable(text: $suche, prompt: "Klasse, Lehrkraft oder Raum")
            .autocorrectionDisabled()
            .textInputAutocapitalization(.never)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if suche.isEmpty && filter == nil && !favoriten.liste.isEmpty {
                        EditButton()
                    }
                }
            }
            .profilWerkzeug()
            .navigationDestination(for: PlanAuswahl.self) { plan in
                PlanSeite(fest: plan)
            }
            .navigationDestination(for: Plankategorie.self) { kategorie in
                ElementlisteView(kategorie: kategorie, elemente: elemente, auswahl: nil) { plan in
                    oeffnen(plan)
                }
            }
            .refreshable { await laden() }
            .task {
                zuletzt = Suchverlauf.laden()
                if elemente == nil { await laden() }
            }
        }
    }

    // MARK: - Filterchips

    private var chips: some View {
        ScrollView(.horizontal) {
            GlasGruppe(abstand: 8) {
                HStack(spacing: 8) {
                    GlasChip(titel: "Alle", gewaehlt: filter == nil) { filterWaehlen(nil) }
                    ForEach(kategorien) { k in
                        GlasChip(titel: k.titel, gewaehlt: filter == k) { filterWaehlen(k) }
                    }
                }
                .padding(.horizontal, Stilmass.rand)
                .padding(.vertical, Stilmass.raster)
            }
        }
        .scrollIndicators(.hidden)
    }

    private func filterWaehlen(_ k: Plankategorie?) {
        Haptik.auswahl()
        withAnimation(.snappy) { filter = k }
    }

    // MARK: - Ohne Suchbegriff

    @ViewBuilder
    private var startbereich: some View {
        if !favoriten.liste.isEmpty {
            Section("Favoriten") {
                ForEach(favoriten.liste) { fav in
                    planZeile(fav, stern: true)
                }
                .onDelete { favoriten.entfernen($0) }
                .onMove { favoriten.verschieben($0, nach: $1) }
            }
        }
        if !zuletzt.isEmpty {
            Section {
                ForEach(zuletzt) { plan in
                    planZeile(plan, stern: false)
                }
            } header: {
                HStack {
                    Text("Zuletzt geöffnet")
                    Spacer()
                    Button("Löschen") {
                        Haptik.auswahl()
                        zuletzt = []
                        Suchverlauf.speichern([])
                    }
                    .font(.footnote.weight(.semibold))
                    .textCase(nil)
                }
            }
        }
        Section("Alle Pläne") {
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
            }
        }
    }

    /// Zeile eines Plans (Favorit bzw. zuletzt geöffnet): Kürzel, Art, Stern.
    private func planZeile(_ plan: PlanAuswahl, stern: Bool) -> some View {
        HStack(spacing: 12) {
            Button {
                oeffnen(plan)
            } label: {
                HStack(spacing: 12) {
                    Text(plan.anzeige)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Farben.text)
                        .lineLimit(1)
                    if let art = Plankategorie(rawValue: plan.typ) {
                        Text(art.einzahl)
                            .font(.footnote)
                            .foregroundStyle(Farben.text3)
                    }
                    Spacer(minLength: 4)
                    Image(systemName: "chevron.right")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Farben.pfeil)
                        .accessibilityHidden(true)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            Sternknopf(aktiv: favoriten.enthaelt(plan)) { favoriten.umschalten(plan) }
        }
        .accessibilityElement(children: .contain)
    }

    // MARK: - Treffer

    @ViewBuilder
    private var treffer: some View {
        if let elemente {
            let arten = filter.map { [$0] } ?? kategorien
            let liste: [Suchtreffer] = arten.flatMap { k in
                k.liste(elemente).filter { passt($0) }.map { Suchtreffer(kategorie: k, element: $0) }
            }
            .sorted { $0.element.kurz.localizedStandardCompare($1.element.kurz) == .orderedAscending }
            if liste.isEmpty {
                ContentUnavailableView.search(text: suche)
                    .listRowBackground(Color.clear)
            } else {
                Section(suche.isEmpty ? (filter?.titel ?? "Pläne") : "\(liste.count) Treffer") {
                    ForEach(liste) { t in
                        Elementzeile(element: t.element, kategorie: t.kategorie, zeigeArt: filter == nil, gewaehlt: false) {
                            oeffnen(PlanAuswahl(typ: t.kategorie.rawValue, element: t.element.kurz, name: t.element.name))
                        }
                    }
                }
            }
        }
    }

    private func passt(_ e: Planelement) -> Bool {
        guard !suche.isEmpty else { return true }
        return e.kurz.localizedCaseInsensitiveContains(suche) || e.name.localizedCaseInsensitiveContains(suche)
    }

    // MARK: - Abläufe

    private func oeffnen(_ plan: PlanAuswahl) {
        Haptik.auswahl()
        zuletzt = Suchverlauf.merken(plan, in: zuletzt)
        Suchverlauf.speichern(zuletzt)
        pfad.append(plan)
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
