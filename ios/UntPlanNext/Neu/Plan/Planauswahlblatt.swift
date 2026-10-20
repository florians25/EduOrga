import SwiftUI

// Blatt „Auswahl und Filter“ des Plans (design/DESIGN.md Abschnitt 10), oben umschaltbar:
// - Auswahl: „Mein Plan“ immer ganz oben, darunter die Bereiche Klassen, Lehrkräfte und Räume (Segmente mit der Zahl der
//   gewählten Einträge), ein Suchfeld und die Einträge. Zeile antippen = genau diesen Plan zeigen (Blatt schließt);
//   Kontrollkästchen = Mehrfachauswahl: die markierten Pläne erscheinen nebeneinander (Woche, Tag, Agenda), oben als
//   Felder mit „×“. Klassen zeigen ihre Klassenleitung, Favoriten haben den Stern.
// - Filter: Einblenden (Aufsichten, Mitteilungen, Ferien und Feiertage), Reduzieren (nur Änderungen, nur Ist-Zustand)
//   und Layout (sichtbare parallele Stunden, Dichte, Tag als Raster/Liste/Zeitachse), dazu die Legende.
// Alle Filter bleiben auf dem Gerät gespeichert.

/// Bereich des Blatts.
enum Auswahlbereich: String, CaseIterable, Identifiable {
    case auswahl
    case filter

    var id: String { rawValue }
    var titel: String { self == .auswahl ? "Auswahl" : "Filter" }
}

struct PlanAuswahlBlatt: View {
    @EnvironmentObject var zustand: AppZustand
    @EnvironmentObject var favoriten: Favoriten
    @Environment(\.dismiss) private var schliessen
    @Environment(\.kartendarstellung) private var kartendarstellung

    @ObservedObject var modell: Planmodell
    @ObservedObject var mehrfach: Mehrfachplaene
    /// Mehrfachauswahl (Kontrollkästchen) erlaubt
    let mehrfachErlaubt: Bool
    /// Genau diesen Plan zeigen (nil = eigener Plan)
    let einzeln: (PlanAuswahl?) -> Void
    /// Plan zur Mehrfachauswahl hinzufügen bzw. daraus entfernen
    let umschalten: (PlanAuswahl) -> Void

    @State private var bereich: Auswahlbereich
    @State private var kategorie: Plankategorie = .klasse
    @State private var elemente: Elemente? = nil
    @State private var suche = ""
    @State private var fehler: String? = nil
    @State private var legendeOffen = false

    @AppStorage(Planfilter.schluesselAufsichten) private var aufsichten = true
    @AppStorage(Planfilter.schluesselMitteilungen) private var mitteilungen = true
    @AppStorage(Planfilter.schluesselFerien) private var ferien = true
    @AppStorage(Planfilter.schluesselAenderungen) private var nurAenderungen = false
    @AppStorage(Planfilter.schluesselIst) private var nurIstZustand = false
    @AppStorage(Rastermass.parallelSchluessel) private var parallelSichtbar: Int = 1
    @AppStorage("tagesDarstellung") private var darstellungRoh = Tagesdarstellung.raster.rawValue

    init(modell: Planmodell, mehrfach: Mehrfachplaene, mehrfachErlaubt: Bool, start: Auswahlbereich = .auswahl,
         einzeln: @escaping (PlanAuswahl?) -> Void, umschalten: @escaping (PlanAuswahl) -> Void) {
        _modell = ObservedObject(wrappedValue: modell)
        _mehrfach = ObservedObject(wrappedValue: mehrfach)
        self.mehrfachErlaubt = mehrfachErlaubt
        self.einzeln = einzeln
        self.umschalten = umschalten
        _bereich = State(initialValue: start)
    }

    /// Aktuell gezeigte Pläne (Mehrfachauswahl bzw. der eine Plan der Seite).
    private var gewaehlt: [PlanAuswahl] {
        if mehrfach.aktiv && mehrfachErlaubt { return mehrfach.auswahl }
        return [PlanAuswahl(typ: modell.typ, element: modell.element, name: modell.planname)]
    }

    private func istGewaehlt(_ typ: String, _ element: String) -> Bool {
        gewaehlt.contains { $0.typ == typ && $0.element.caseInsensitiveCompare(element) == .orderedSame }
    }

    private var eigenerPlanGewaehlt: Bool {
        !(mehrfach.aktiv && mehrfachErlaubt) && modell.istEigenerPlan
    }

    /// Bereiche wie in der Planauswahl: Lehrkräfte nur für das Kollegium, leere Bereiche ausgeblendet.
    private var kategorien: [Plankategorie] {
        Plankategorie.allCases.filter { k in
            guard k != .lehrer || zustand.darfLehrerplaene else { return false }
            guard !zustand.istKollegium, let elemente else { return true }
            return !k.liste(elemente).isEmpty
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if bereich == .auswahl {
                    auswahlInhalt
                } else {
                    filterInhalt
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Picker("Bereich", selection: $bereich) {
                        ForEach(Auswahlbereich.allCases) { b in
                            Text(b.titel).tag(b)
                        }
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 200)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fertig") { schliessen() }
                        .fontWeight(.semibold)
                }
            }
        }
        .tint(Farben.akzent)
        .task { await laden() }
        .sheet(isPresented: $legendeOffen) {
            PlanLegende()
                .environment(\.kartendarstellung, kartendarstellung)
        }
    }

    // MARK: - Auswahl

    private var auswahlInhalt: some View {
        VStack(spacing: 0) {
            VStack(spacing: 8) {
                Picker("Bereich", selection: $kategorie) {
                    ForEach(kategorien) { k in
                        Text(segmentTitel(k)).tag(k)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .padding(.top, 8)
            }
            Suchleiste(text: $suche, platzhalter: "\(kategorie.titel) suchen")
            List {
                if let fehler {
                    Fehlerhinweis(text: fehler)
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                }
                if suche.isEmpty {
                    Section {
                        Button {
                            Haptik.auswahl()
                            einzeln(nil)
                            schliessen()
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: "person.text.rectangle")
                                    .font(.system(size: 17))
                                    .foregroundStyle(Farben.akzent)
                                    .frame(width: 36)
                                Text("Mein Plan")
                                    .foregroundStyle(Farben.text)
                                Spacer(minLength: 4)
                                if eigenerPlanGewaehlt {
                                    Image(systemName: "checkmark")
                                        .font(.system(size: 15, weight: .semibold))
                                        .foregroundStyle(Farben.akzent)
                                }
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    } footer: {
                        if mehrfachErlaubt {
                            Text("Zeile antippen zeigt genau diesen Plan. Kästchen markieren zeigt mehrere Pläne nebeneinander (bis zu \(Mehrfachplaene.hoechstens)).")
                        }
                    }
                    let favs = favoriten.liste.filter { $0.typ == kategorie.rawValue }
                    if !favs.isEmpty {
                        Section("Favoriten") {
                            ForEach(favs) { f in
                                zeile(kurz: f.element, name: f.name == f.element ? "" : f.name, zusatz: "")
                            }
                        }
                    }
                }
                if let elemente {
                    let liste = kategorie.liste(elemente)
                        .filter { suche.isEmpty || $0.kurz.localizedCaseInsensitiveContains(suche) || $0.name.localizedCaseInsensitiveContains(suche) }
                        .sorted { $0.kurz.localizedStandardCompare($1.kurz) == .orderedAscending }
                    Section(kategorie.titel) {
                        if liste.isEmpty {
                            Text(suche.isEmpty ? "Keine Einträge." : "Keine Treffer für „\(suche)“.")
                                .foregroundStyle(Farben.text3)
                        }
                        ForEach(liste) { e in
                            zeile(kurz: e.kurz, name: e.name == e.kurz ? "" : e.name, zusatz: e.leitung.joined(separator: ", "))
                        }
                    }
                } else if fehler == nil {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .listRowBackground(Color.clear)
                }
            }
            .listStyle(.insetGrouped)
        }
        .background(Farben.blatt)
        .onAppear {
            if !kategorien.contains(kategorie), let erste = kategorien.first { kategorie = erste }
            if let t = Plankategorie(rawValue: modell.typ), kategorien.contains(t), !modell.istEigenerPlan { kategorie = t }
        }
    }

    /// Segment „Klassen · 2“ (Zahl der markierten Einträge dieses Bereichs).
    private func segmentTitel(_ k: Plankategorie) -> String {
        let n = (mehrfach.aktiv && mehrfachErlaubt) ? mehrfach.auswahl.filter { $0.typ == k.rawValue }.count : 0
        return n > 0 ? "\(k.titel) · \(n)" : k.titel
    }

    private func zeile(kurz: String, name: String, zusatz: String) -> some View {
        let plan = PlanAuswahl(typ: kategorie.rawValue, element: kurz, name: name.isEmpty ? kurz : name)
        let an = istGewaehlt(kategorie.rawValue, kurz)
        let mehrere = mehrfach.aktiv && mehrfachErlaubt
        return HStack(spacing: 4) {
            if mehrfachErlaubt {
                Button {
                    Haptik.auswahl()
                    umschalten(plan)
                } label: {
                    Image(systemName: an && mehrere ? "checkmark.square.fill" : "square")
                        .font(.system(size: 20))
                        .foregroundStyle(an && mehrere ? Farben.akzent : Farben.text3)
                        .frame(width: 36, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.borderless)
                .accessibilityLabel(an && mehrere ? "\(kurz) aus der Mehrfachauswahl entfernen" : "\(kurz) zur Mehrfachauswahl hinzufügen")
            }
            Button {
                Haptik.auswahl()
                einzeln(plan)
                schliessen()
            } label: {
                HStack(spacing: 10) {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(kurz)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(Farben.text)
                            .lineLimit(1)
                        if !name.isEmpty {
                            Text(name)
                                .font(.footnote)
                                .foregroundStyle(Farben.text2)
                                .lineLimit(1)
                        }
                    }
                    Spacer(minLength: 4)
                    if !zusatz.isEmpty {
                        Label(zusatz, systemImage: "person")
                            .labelStyle(.titleAndIcon)
                            .font(.footnote)
                            .foregroundStyle(Farben.text2)
                            .lineLimit(1)
                    }
                    if an && !mehrere {
                        Image(systemName: "checkmark")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Farben.akzent)
                    }
                }
                .padding(.vertical, 4)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint("Zeigt genau diesen Plan")
            Sternknopf(aktiv: favoriten.enthaelt(plan)) { favoriten.umschalten(plan) }
        }
    }

    // MARK: - Filter

    private var filterInhalt: some View {
        Form {
            Section("Einblenden") {
                Toggle("Aufsichten anzeigen", isOn: $aufsichten)
                Toggle("Mitteilungen anzeigen", isOn: $mitteilungen)
                Toggle("Ferien und Feiertage anzeigen", isOn: $ferien)
            }
            Section {
                Toggle("Nur Änderungen anzeigen", isOn: $nurAenderungen)
                Toggle("Nur Ist-Zustand anzeigen", isOn: $nurIstZustand)
            } header: {
                Text("Reduzieren")
            } footer: {
                Text("Nur Änderungen blendet den regulären Unterricht aus (auch über das Dreieck unten im Plan). Nur Ist-Zustand blendet aus, was nicht stattfindet – etwa entfallene Stunden.")
            }
            Section {
                Stepper(value: $parallelSichtbar, in: 1...4) {
                    HStack {
                        Text("Parallele Stunden nebeneinander")
                        Spacer(minLength: 8)
                        Text("\(parallelSichtbar)")
                            .monospacedDigit()
                            .foregroundStyle(Farben.text2)
                    }
                }
                WochendichteAuswahl()
                Picker("Tag als", selection: $darstellungRoh) {
                    ForEach(Tagesdarstellung.allCases) { d in
                        Text(d.titel).tag(d.rawValue)
                    }
                }
            } header: {
                Text("Layout")
            } footer: {
                Text("Weitere gleichzeitige Stunden stehen hinter „+N“. Auf schmalen Spalten zeigt der Plan weniger nebeneinander.")
            }
            Section {
                Button {
                    legendeOffen = true
                } label: {
                    Label("Legende", systemImage: "info.circle")
                }
                if nurAenderungen || nurIstZustand || !aufsichten || !mitteilungen || !ferien {
                    Button("Filter zurücksetzen", role: .destructive) {
                        aufsichten = true
                        mitteilungen = true
                        ferien = true
                        nurAenderungen = false
                        nurIstZustand = false
                    }
                }
            }
        }
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
