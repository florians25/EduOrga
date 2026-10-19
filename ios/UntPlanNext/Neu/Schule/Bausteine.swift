import SwiftUI

// Gemeinsame Bausteine der Seiten im Reiter „Schule“: Auswahl der Klasse, Zeitraum, leere Zustände, Dateien.

// MARK: - Klasse wählen

/// Zeile „Klasse“ mit der gewählten Klasse; Antippen öffnet die Auswahl (eigene Klassen zuerst, Suche).
struct KlassenFeld: View {
    @Binding var klasse: String
    var titel: String = "Klasse"
    /// „Alle Klassen“ erlauben (leere Auswahl)
    var alleErlaubt: Bool = false
    @EnvironmentObject var zustand: AppZustand
    @State private var offen = false

    var body: some View {
        Button {
            offen = true
        } label: {
            HStack {
                Text(titel)
                    .foregroundStyle(Farben.text)
                Spacer()
                Text(klasse.isEmpty ? (alleErlaubt ? "Alle Klassen" : "Wählen") : klasse)
                    .foregroundStyle(klasse.isEmpty ? Farben.text3 : Farben.akzent)
                Image(systemName: "chevron.up.chevron.down")
                    .font(.caption)
                    .foregroundStyle(Farben.pfeil)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .sheet(isPresented: $offen) {
            KlassenAuswahlBlatt(auswahl: $klasse, alleErlaubt: alleErlaubt)
                .environmentObject(zustand)
                .presentationDetents([.medium, .large])
        }
    }
}

struct KlassenAuswahlBlatt: View {
    @Binding var auswahl: String
    var alleErlaubt: Bool = false
    @EnvironmentObject var zustand: AppZustand
    @Environment(\.dismiss) private var schliessen
    @State private var klassen: [Planelement] = []
    @State private var suche = ""

    private var ich: String { zustand.benutzer?.element ?? "" }

    private var eigene: [Planelement] {
        guard !ich.isEmpty else { return [] }
        return klassen.filter { k in k.leitung.contains { $0.caseInsensitiveCompare(ich) == .orderedSame } }
    }

    private var gefiltert: [Planelement] {
        let s = suche.trimmingCharacters(in: .whitespaces).lowercased()
        guard !s.isEmpty else { return klassen }
        return klassen.filter { $0.kurz.lowercased().contains(s) || $0.name.lowercased().contains(s) }
    }

    var body: some View {
        NavigationStack {
            List {
                if alleErlaubt {
                    Button {
                        waehlen("")
                    } label: {
                        zeile("Alle Klassen", "", gewaehlt: auswahl.isEmpty)
                    }
                }
                if suche.isEmpty && !eigene.isEmpty {
                    Section("Meine Klassen") {
                        ForEach(eigene) { k in
                            Button { waehlen(k.kurz) } label: { zeile(k.kurz, k.name, gewaehlt: auswahl == k.kurz) }
                        }
                    }
                }
                Section(suche.isEmpty ? "Alle Klassen" : "Treffer") {
                    ForEach(gefiltert) { k in
                        Button { waehlen(k.kurz) } label: { zeile(k.kurz, k.name, gewaehlt: auswahl == k.kurz) }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .overlay {
                if klassen.isEmpty {
                    ProgressView()
                }
            }
            .searchable(text: $suche, placement: .navigationBarDrawer(displayMode: .always), prompt: "Klasse suchen")
            .navigationTitle("Klasse wählen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { schliessen() }
                }
            }
            .task {
                klassen = await Stammdaten.laden(zustand.api)?.klassen ?? []
            }
        }
    }

    private func zeile(_ kurz: String, _ name: String, gewaehlt: Bool) -> some View {
        HStack {
            Text(kurz)
                .font(.body.weight(.semibold))
                .foregroundStyle(Farben.text)
            if !name.isEmpty && name != kurz {
                Text(name)
                    .foregroundStyle(Farben.text2)
                    .lineLimit(1)
            }
            Spacer()
            if gewaehlt {
                Image(systemName: "checkmark")
                    .foregroundStyle(Farben.akzent)
            }
        }
        .contentShape(Rectangle())
    }

    private func waehlen(_ k: String) {
        Haptik.auswahl()
        auswahl = k
        schliessen()
    }
}

/// Erste eigene Klasse (Klassenleitung) des Kontos – Vorbelegung der Auswahl.
@MainActor
func eigeneKlasse(_ zustand: AppZustand) async -> String {
    let ich = zustand.benutzer?.element ?? ""
    guard !ich.isEmpty, let e = await Stammdaten.laden(zustand.api) else { return "" }
    return e.klassen.first { k in k.leitung.contains { $0.caseInsensitiveCompare(ich) == .orderedSame } }?.kurz ?? ""
}

// MARK: - Zeitraum

/// Zeitraum „Von – Bis“ als zwei Datumsfelder.
struct ZeitraumFelder: View {
    @Binding var von: Date
    @Binding var bis: Date

    var body: some View {
        DatePicker("Von", selection: $von, displayedComponents: .date)
            .onChange(of: von) { _, neu in if bis < neu { bis = neu } }
        DatePicker("Bis", selection: $bis, in: von..., displayedComponents: .date)
    }
}

// MARK: - Leer und Fehler

/// Leerer Zustand einer Liste.
struct LeereListe: View {
    let titel: String
    var symbol: String = "tray"
    var text: String = ""

    var body: some View {
        ContentUnavailableView {
            Label(titel, systemImage: symbol)
        } description: {
            if !text.isEmpty { Text(text) }
        }
        .frame(maxWidth: .infinity)
        .listRowBackground(Color.clear)
    }
}

/// Datum „Mo 12.11.“ bzw. „heute“, „morgen“.
func kurzdatum(_ iso: String) -> String {
    guard let d = Datumsformat.datum(iso) else { return iso }
    let k = Datumsformat.kalender
    if k.isDateInToday(d) { return "heute" }
    if k.isDateInTomorrow(d) { return "morgen" }
    if k.isDateInYesterday(d) { return "gestern" }
    return Datumsformat.anzeige(d, "EE d.M.")
}

// MARK: - Dateien

enum Dateiablage {
    /// Daten als Datei im temporären Ordner ablegen (für Vorschau und Teilen).
    static func ablegen(_ daten: Data, name: String) throws -> URL {
        let ordner = FileManager.default.temporaryDirectory.appendingPathComponent("Dokumente", isDirectory: true)
        try FileManager.default.createDirectory(at: ordner, withIntermediateDirectories: true)
        let datei = ordner.appendingPathComponent(name.replacingOccurrences(of: "/", with: "_"))
        try daten.write(to: datei, options: .atomic)
        return datei
    }
}
