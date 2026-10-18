import PhotosUI
import SwiftUI
import UIKit
import UniformTypeIdentifiers

// MARK: - Start einer neuen Mitteilung

/// Art der neuen Mitteilung („An wen soll die Mitteilung gesendet werden?“) bzw. Antwort.
enum Verfassenstyp: Hashable {
    case kollegium
    case individuell
    case antwort

    /// Parameter „typ“ von GET /mitteilungen/personen
    var apiTyp: String { self == .kollegium ? "kollegium" : "individuell" }

    /// Untertitel der Empfängerauswahl („Mitteilung an“ / „Kolleg*innen“).
    var auswahlTitel: String { self == .kollegium ? "Kolleg*innen" : "Individuell" }

    /// Titel des Editors.
    var editorTitel: String {
        switch self {
        case .kollegium: return "Mitteilung an Kolleg*innen"
        case .individuell: return "Individuelle Mitteilung"
        case .antwort: return "Antwort"
        }
    }
}

/// Startwerte des Blatts „Mitteilung verfassen“ (neu: erst die Empfängerauswahl; Antwort: gleich der Editor).
struct Verfassen: Identifiable {
    let id = UUID()
    var typ: Verfassenstyp
    var empfaenger: [Empfaenger] = []
    var betreff = ""
    var text = ""
    var antwortAuf: Int? = nil
}

/// Datei, die beim Senden an die Mitteilung gehängt wird (Kamera, Foto, Datei).
struct LokalerAnhang: Identifiable {
    let id = UUID()
    let name: String
    let typ: String
    let daten: Data

    var anzeige: Anhang { Anhang(id: id.hashValue, name: name, typ: typ, groesse: daten.count) }
}

// MARK: - Blatt: Empfängerauswahl und Editor

/// Neue Mitteilung im Blatt: zuerst die Empfängerauswahl, nach „Fertig“ der Editor; die Zeile „An“ im Editor öffnet
/// die Auswahl erneut. Mit Anhängen: Entwurf anlegen, Dateien hochladen, dann senden.
struct MitteilungVerfassenView: View {
    let start: Verfassen
    let gesendet: () -> Void
    @EnvironmentObject var zustand: AppZustand
    @Environment(\.dismiss) private var systemSchliessen
    @Environment(\.blattSchliessen) private var blattSchliessen

    private enum Schritt { case auswahl, editor }

    @State private var schritt: Schritt
    @State private var empfaenger: [Empfaenger]
    @State private var betreff: String
    @State private var text: String
    @State private var lesebestaetigung = false
    @State private var antwortGesperrt = false
    @State private var anhaenge: [LokalerAnhang] = []
    @State private var personen: Personenauswahl? = nil
    @State private var ladefehler: String? = nil
    @State private var sendet = false
    @State private var fehler: String? = nil
    @State private var verwerfenFragen = false
    @State private var fotoAuswahl: [PhotosPickerItem] = []
    @State private var fotosOffen = false
    @State private var dateienOffen = false
    @State private var kameraOffen = false
    @FocusState private var fokus: Feld?

    private enum Feld { case betreff, text }

    init(start: Verfassen, gesendet: @escaping () -> Void) {
        self.start = start
        self.gesendet = gesendet
        _schritt = State(initialValue: start.typ == .antwort || !start.empfaenger.isEmpty ? .editor : .auswahl)
        _empfaenger = State(initialValue: start.empfaenger)
        _betreff = State(initialValue: start.betreff)
        _text = State(initialValue: start.text)
    }

    /// Blatt schließen.
    private func schliessen() {
        if let blattSchliessen { blattSchliessen() } else { systemSchliessen() }
    }

    private var bereit: Bool {
        !empfaenger.isEmpty && !betreff.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && (!text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !anhaenge.isEmpty)
    }

    private var hatInhalt: Bool {
        betreff != start.betreff || text != start.text || !anhaenge.isEmpty
    }

    var body: some View {
        ZStack {
            switch schritt {
            case .auswahl:
                EmpfaengerauswahlView(typ: start.typ, daten: personen, fehler: ladefehler, vorher: empfaenger,
                                      abbrechen: {
                                          if empfaenger.isEmpty && start.typ != .antwort {
                                              schliessen()
                                          } else {
                                              withAnimation(.easeInOut(duration: 0.2)) { schritt = .editor }
                                          }
                                      },
                                      fertig: { neu in
                                          empfaenger = neu
                                          withAnimation(.easeInOut(duration: 0.2)) { schritt = .editor }
                                      })
                    .transition(.opacity)
            case .editor:
                editor
                    .transition(.opacity)
            }
        }
        .background(Farben.blatt.ignoresSafeArea())
        .task { await personenLaden() }
    }

    private func personenLaden() async {
        guard personen == nil else { return }
        do {
            personen = try await zustand.api.personen(typ: start.typ.apiTyp)
            ladefehler = nil
        } catch {
            ladefehler = zustand.fehlertext(error) ?? "Die Empfänger konnten nicht geladen werden."
        }
    }

    // MARK: Editor

    private var editor: some View {
        VStack(spacing: 0) {
            Blattkopf(symbol: "xmark", symbolText: "Schließen", aktion: {
                if hatInhalt { verwerfenFragen = true } else { schliessen() }
            }, laedt: sendet, mitte: {
                Mitteilungstitel(titel: start.typ.editorTitel)
            }, rechts: {
                sendenKnopf
            })
            anZeile
            Rectangle().fill(Farben.rand).frame(height: 0.5)
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    TextField("Betreff", text: $betreff)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Farben.text)
                        .tint(Farben.akzent)
                        .focused($fokus, equals: .betreff)
                        .submitLabel(.next)
                        .onSubmit { fokus = .text }
                    Divider()
                    TextField("Text", text: $text, axis: .vertical)
                        .font(.body)
                        .foregroundStyle(Farben.text)
                        .tint(Farben.akzent)
                        .lineLimit(6...)
                        .focused($fokus, equals: .text)
                    if !anhaenge.isEmpty {
                        VStack(spacing: 10) {
                            ForEach(anhaenge) { a in
                                Anhangpille(anhang: a.anzeige, entfernen: {
                                    anhaenge.removeAll { $0.id == a.id }
                                }) {}
                            }
                        }
                        .padding(.top, 10)
                    }
                    if let fehler {
                        Fehlerhinweis(text: fehler)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)
                .padding(.bottom, 24)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            werkzeuge
        }
        .onAppear {
            if fokus == nil { fokus = betreff.isEmpty ? .betreff : .text }
        }
        .confirmationDialog("Mitteilung verwerfen?", isPresented: $verwerfenFragen, titleVisibility: .visible) {
            Button("Als Entwurf sichern") { Task { await entwurfSichern() } }
            Button("Verwerfen", role: .destructive) { schliessen() }
            Button("Weiter bearbeiten", role: .cancel) {}
        }
        .photosPicker(isPresented: $fotosOffen, selection: $fotoAuswahl, maxSelectionCount: 5, matching: .images)
        .onChange(of: fotoAuswahl) { _, neu in
            guard !neu.isEmpty else { return }
            Task { await fotosUebernehmen(neu) }
        }
        .fileImporter(isPresented: $dateienOffen, allowedContentTypes: [.item], allowsMultipleSelection: true) { ergebnis in
            dateienUebernehmen(ergebnis)
        }
        .fullScreenCover(isPresented: $kameraOffen) {
            KameraAufnahme { bild in
                if let bild, let daten = bild.jpegData(compressionQuality: 0.85) {
                    anhaenge.append(LokalerAnhang(name: Self.dateiname("Foto", "jpg"), typ: "image/jpeg", daten: daten))
                }
                kameraOffen = false
            }
            .ignoresSafeArea()
        }
    }

    /// „Senden“ rechts im Kopf (aktiv, sobald Empfänger, Betreff und Text vorhanden sind).
    @ViewBuilder
    private var sendenKnopf: some View {
        if sendet {
            ProgressView()
                .frame(width: Detailmass.knopf, height: Detailmass.knopf)
                .padding(.horizontal, 8)
        } else {
            Button {
                Task { await senden() }
            } label: {
                Text("Senden")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(bereit ? Farben.akzent : Farben.pfeil)
                    .padding(.horizontal, 8)
                    .frame(minHeight: Detailmass.knopf)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(!bereit)
            .accessibilityLabel("Senden")
        }
    }

    /// Zeile „An“ mit den gewählten Empfängern als Felder; antippen öffnet die Auswahl.
    private var anZeile: some View {
        Button {
            fokus = nil
            withAnimation(.easeOut(duration: 0.12)) { schritt = .auswahl }
        } label: {
            HStack(spacing: 12) {
                Text("An:")
                    .font(.subheadline)
                    .foregroundStyle(Farben.text2)
                ScrollView(.horizontal) {
                    HStack(spacing: 6) {
                        if empfaenger.isEmpty {
                            Text("Empfänger wählen")
                                .font(.subheadline)
                                .foregroundStyle(Farben.text3)
                        }
                        ForEach(empfaenger) { e in
                            Text(e.kuerzel)
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(Farben.akzent)
                                .lineLimit(1)
                                .padding(.horizontal, 8)
                                .frame(height: 26)
                                .background(Farben.primaerFlaeche, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
                        }
                    }
                }
                .scrollIndicators(.hidden)
                .allowsHitTesting(empfaenger.count > 3)
                Image(systemName: "plus.circle")
                    .font(.system(size: 18, weight: .regular))
                    .foregroundStyle(Farben.akzent)
            }
            .padding(.horizontal, 16)
            .frame(height: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("An: " + (empfaenger.isEmpty ? "keine Empfänger" : empfaenger.map(\.kuerzel).joined(separator: ", ")))
        .accessibilityHint("Öffnet die Empfängerauswahl")
    }

    /// Werkzeugleiste über der Tastatur: links die Optionen (Lesebestätigung anfordern, Antworten nicht erlauben),
    /// rechts Kamera, Foto und Datei.
    private var werkzeuge: some View {
        HStack(spacing: 4) {
            Menu {
                Toggle("Lesebestätigung anfordern", isOn: $lesebestaetigung)
                if start.typ != .antwort || zustand.istKollegium {
                    Toggle("Antworten nicht erlauben", isOn: $antwortGesperrt)
                }
            } label: {
                Image(systemName: "slider.horizontal.3")
                    .font(.system(size: 17, weight: .regular))
                    .foregroundStyle(Farben.akzent)
                    .frame(width: 40, height: 36)
                    .background(lesebestaetigung || antwortGesperrt ? Farben.primaerFlaeche : Color.clear,
                                in: RoundedRectangle(cornerRadius: 6, style: .continuous))
            }
            .accessibilityLabel("Optionen")
            .accessibilityValue([lesebestaetigung ? "Lesebestätigung angefordert" : "",
                                 antwortGesperrt ? "Antworten nicht erlaubt" : ""].filter { !$0.isEmpty }.joined(separator: ", "))
            Spacer(minLength: 12)
            if UIImagePickerController.isSourceTypeAvailable(.camera) {
                Werkzeugknopf(symbol: "camera", text: "Foto aufnehmen") { kameraOffen = true }
            }
            Werkzeugknopf(symbol: "photo.on.rectangle", text: "Foto auswählen") { fotosOffen = true }
            Werkzeugknopf(symbol: "paperclip", text: "Datei anhängen") { dateienOffen = true }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Farben.flaeche2)
        .overlay(alignment: .top) {
            Rectangle().fill(Farben.rand).frame(height: 0.5)
        }
    }

    // MARK: Anhänge

    static func dateiname(_ anfang: String, _ endung: String) -> String {
        "\(anfang)_\(Datumsformat.anzeige(Date(), "yyyyMMdd_HHmmss")).\(endung)"
    }

    private func fotosUebernehmen(_ liste: [PhotosPickerItem]) async {
        for (i, eintrag) in liste.enumerated() {
            guard let daten = try? await eintrag.loadTransferable(type: Data.self) else { continue }
            // Als JPEG anhängen (HEIC u. a. öffnen nicht alle Empfänger)
            let jpeg = UIImage(data: daten)?.jpegData(compressionQuality: 0.85) ?? daten
            let name = Self.dateiname(liste.count > 1 ? "Foto\(i + 1)" : "Foto", "jpg")
            anhaenge.append(LokalerAnhang(name: name, typ: "image/jpeg", daten: jpeg))
        }
        fotoAuswahl = []
    }

    private func dateienUebernehmen(_ ergebnis: Result<[URL], Error>) {
        guard case .success(let urls) = ergebnis else {
            if case .failure(let f) = ergebnis { fehler = f.localizedDescription }
            return
        }
        for url in urls {
            let zugriff = url.startAccessingSecurityScopedResource()
            defer { if zugriff { url.stopAccessingSecurityScopedResource() } }
            guard let daten = try? Data(contentsOf: url) else {
                fehler = "„\(url.lastPathComponent)“ konnte nicht gelesen werden."
                continue
            }
            let typ = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
            anhaenge.append(LokalerAnhang(name: url.lastPathComponent, typ: typ, daten: daten))
        }
    }

    // MARK: Senden

    private func daten(id: Int? = nil) -> MitteilungNeuDaten {
        MitteilungNeuDaten(id: id, empfaenger: empfaenger.map(\.id),
                           betreff: betreff.trimmingCharacters(in: .whitespacesAndNewlines),
                           text: text.trimmingCharacters(in: .whitespacesAndNewlines),
                           wichtig: false, lesebestaetigung: lesebestaetigung, antwortAuf: start.antwortAuf,
                           antwortErlaubt: antwortGesperrt ? false : nil)
    }

    private func senden() async {
        guard bereit else { return }
        sendet = true
        defer { sendet = false }
        fokus = nil
        do {
            if anhaenge.isEmpty {
                try await zustand.api.mitteilungSenden(daten())
            } else {
                let id = try await zustand.api.entwurfSpeichern(daten())
                for a in anhaenge {
                    try await zustand.api.anhangHochladen(mitteilung: id, name: a.name, typ: a.typ, daten: a.daten)
                }
                try await zustand.api.entwurfSenden(id)
            }
            gesendet()
            schliessen()
        } catch {
            fehler = zustand.fehlertext(error) ?? "Die Mitteilung konnte nicht gesendet werden."
        }
    }

    private func entwurfSichern() async {
        sendet = true
        defer { sendet = false }
        do {
            let id = try await zustand.api.entwurfSpeichern(daten())
            for a in anhaenge {
                try await zustand.api.anhangHochladen(mitteilung: id, name: a.name, typ: a.typ, daten: a.daten)
            }
            gesendet()
            schliessen()
        } catch {
            fehler = zustand.fehlertext(error) ?? "Der Entwurf konnte nicht gesichert werden."
        }
    }
}

// MARK: - Empfängerauswahl

/// Empfängerauswahl als Blatt: „Abbrechen“ links, „Fertig“ rechts, Titel „Mitteilung an“ / „Kolleg*innen“; darunter das
/// Suchfeld, waagrecht scrollbare Filter (Ausgewählt, Liste, Klasse, Abteilung), „Alle auswählen“ und die Personen mit
/// Auswahlkreis, Kürzel und Rollen.
struct EmpfaengerauswahlView: View {
    let typ: Verfassenstyp
    let daten: Personenauswahl?
    let fehler: String?
    /// Bisher gewählte Empfänger (bleiben erhalten, auch wenn sie nicht in der Liste stehen, z. B. bei einer Antwort)
    let vorher: [Empfaenger]
    let abbrechen: () -> Void
    let fertig: ([Empfaenger]) -> Void

    @State private var auswahl: Set<String>
    @State private var nurAusgewaehlt = false
    @State private var liste: Mitteilungsliste? = nil
    @State private var klasse: String? = nil
    @State private var abteilung: String? = nil
    @State private var suche = ""
    @FocusState private var sucheFokus: Bool

    init(typ: Verfassenstyp, daten: Personenauswahl?, fehler: String?, vorher: [Empfaenger],
         abbrechen: @escaping () -> Void, fertig: @escaping ([Empfaenger]) -> Void) {
        self.typ = typ
        self.daten = daten
        self.fehler = fehler
        self.vorher = vorher
        self.abbrechen = abbrechen
        self.fertig = fertig
        _auswahl = State(initialValue: Set(vorher.map(\.id)))
    }

    private static func gleich(_ a: String, _ b: String) -> Bool { a.caseInsensitiveCompare(b) == .orderedSame }

    private var personen: [Empfaenger] {
        (daten?.personen ?? []).sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    }

    private func gefiltert(_ quelle: [Empfaenger]) -> [Empfaenger] {
        var l = quelle
        if nurAusgewaehlt { l = l.filter { auswahl.contains($0.id) } }
        if let liste {
            let mitglieder = Set(liste.mitglieder)
            l = l.filter { mitglieder.contains($0.id) }
        }
        if let klasse { l = l.filter { $0.alleKlassen.contains { Self.gleich($0, klasse) } } }
        if let abteilung { l = l.filter { $0.abteilungen.contains { Self.gleich($0, abteilung) } } }
        if !suche.isEmpty { l = l.filter { $0.passt(suche) } }
        return l
    }

    private var sichtbarePersonen: [Empfaenger] { gefiltert(personen) }

    /// Gruppen (nur „Individuell“): Listen wirken als Filter, deshalb hier nur Suche, Klasse und „Ausgewählt“.
    private var sichtbareGruppen: [Empfaenger] {
        var l = daten?.gruppen ?? []
        if nurAusgewaehlt { l = l.filter { auswahl.contains($0.id) } }
        if let klasse { l = l.filter { $0.alleKlassen.contains { Self.gleich($0, klasse) } } }
        if liste != nil || abteilung != nil { l = [] }
        if !suche.isEmpty { l = l.filter { $0.passt(suche) } }
        return l
    }

    private var sichtbar: [Empfaenger] { sichtbareGruppen + sichtbarePersonen }

    private var alleGewaehlt: Bool { !sichtbar.isEmpty && sichtbar.allSatisfy { auswahl.contains($0.id) } }

    var body: some View {
        VStack(spacing: 0) {
            Blattkopf(symbol: "xmark", symbolText: "Abbrechen", aktion: abbrechen, laedt: daten == nil && fehler == nil, mitte: {
                Mitteilungstitel(titel: "Mitteilung an", untertitel: typ.auswahlTitel)
            }, rechts: {
                Button {
                    fertig(ergebnis())
                } label: {
                    Text("Fertig")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Farben.akzent)
                        .padding(.horizontal, 8)
                        .frame(minHeight: Detailmass.knopf)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(auswahl.isEmpty ? "Fertig" : "Fertig, \(auswahl.count) ausgewählt")
            })
            suchfeld
            filterleiste
            personenliste(inhalt: sichtbar)
        }
        .background(Farben.blatt.ignoresSafeArea())
    }

    /// Ergebnis in der Reihenfolge der Liste; bisher gewählte, hier unbekannte Empfänger bleiben vorn erhalten.
    private func ergebnis() -> [Empfaenger] {
        let bekannt = (daten?.gruppen ?? []) + personen
        let ids = Set(bekannt.map(\.id))
        let alt = vorher.filter { auswahl.contains($0.id) && !ids.contains($0.id) }
        return alt + bekannt.filter { auswahl.contains($0.id) }
    }

    // MARK: Filter

    private var filterleiste: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                Button {
                    withAnimation(.easeOut(duration: 0.15)) { nurAusgewaehlt.toggle() }
                } label: {
                    Filterkapsel(titel: auswahl.isEmpty ? "Ausgewählt" : "Ausgewählt (\(auswahl.count))", aktiv: nurAusgewaehlt, pfeil: false)
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(nurAusgewaehlt ? .isSelected : [])

                Menu {
                    Button("Alle") { liste = nil }
                    let listen = daten?.filter.listen ?? []
                    if listen.isEmpty {
                        Text("Keine Listen angelegt")
                    }
                    ForEach(listen) { l in
                        Button {
                            liste = l
                        } label: {
                            if liste?.id == l.id { Label(l.name, systemImage: "checkmark") } else { Text(l.name) }
                        }
                    }
                } label: {
                    Filterkapsel(titel: liste?.name ?? "Liste", aktiv: liste != nil, pfeil: true)
                }

                Menu {
                    Button("Alle") { klasse = nil }
                    ForEach(daten?.filter.klassen ?? [], id: \.self) { k in
                        Button {
                            klasse = k
                        } label: {
                            if klasse == k { Label(k, systemImage: "checkmark") } else { Text(k) }
                        }
                    }
                } label: {
                    Filterkapsel(titel: klasse ?? "Klasse", aktiv: klasse != nil, pfeil: true)
                }

                // Abteilung nur, wenn die Schule Abteilungen pflegt
                if !(daten?.filter.abteilungen ?? []).isEmpty {
                    Menu {
                        Button("Alle") { abteilung = nil }
                        ForEach(daten?.filter.abteilungen ?? [], id: \.self) { a in
                            Button {
                                abteilung = a
                            } label: {
                                if abteilung == a { Label(a, systemImage: "checkmark") } else { Text(a) }
                            }
                        }
                    } label: {
                        Filterkapsel(titel: abteilung ?? "Abteilung", aktiv: abteilung != nil, pfeil: true)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 2)
        }
        .scrollIndicators(.hidden)
        .tint(Color.primary)
        .padding(.bottom, 8)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Farben.rand).frame(height: 0.5)
        }
    }

    // MARK: Liste

    private func personenliste(inhalt: [Empfaenger]) -> some View {
        List {
            if let fehler {
                Fehlerhinweis(text: fehler)
                    .auswahlzeile()
            }
            if !inhalt.isEmpty {
                Button {
                    if alleGewaehlt {
                        auswahl.subtract(inhalt.map(\.id))
                    } else {
                        auswahl.formUnion(inhalt.map(\.id))
                    }
                } label: {
                    HStack(spacing: 14) {
                        Auswahlkreis(gewaehlt: alleGewaehlt)
                        Text("Alle auswählen")
                            .font(.body)
                            .foregroundStyle(Farben.text)
                        Spacer(minLength: 0)
                    }
                    .padding(.vertical, 12)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .auswahlzeile()
            } else if daten != nil {
                Text(suche.isEmpty ? "Keine Empfänger." : "Keine Treffer für „\(suche)“.")
                    .font(.system(size: 16))
                    .foregroundStyle(Farben.text3)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 30)
                    .auswahlzeile()
            }
            ForEach(inhalt) { e in
                Personenzeile(empfaenger: e, gewaehlt: auswahl.contains(e.id)) {
                    if auswahl.contains(e.id) { auswahl.remove(e.id) } else { auswahl.insert(e.id) }
                }
                .auswahlzeile()
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .scrollDismissesKeyboard(.immediately)
        .environment(\.defaultMinListRowHeight, 0)
    }

    /// Suchfeld oben in der Auswahl (gleiches Aussehen wie das Suchfeld des Systems).
    private var suchfeld: some View {
        HStack(spacing: 6) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 15, weight: .regular))
                .foregroundStyle(Farben.text3)
            TextField("Suchen", text: $suche)
                .foregroundStyle(Farben.text)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.search)
                .focused($sucheFokus)
            if !suche.isEmpty {
                Button {
                    suche = ""
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
        .onTapGesture { sucheFokus = true }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 8)
    }
}

/// Filter mit feinem Rand („Liste ⌄“); aktiv in Petrol auf heller Petrol-Fläche.
private struct Filterkapsel: View {
    let titel: String
    let aktiv: Bool
    let pfeil: Bool

    var body: some View {
        HStack(spacing: 5) {
            Text(titel)
                .font(.subheadline)
                .lineLimit(1)
            if pfeil {
                Image(systemName: "chevron.down")
                    .font(.system(size: 10, weight: .semibold))
            }
        }
        .foregroundStyle(aktiv ? Farben.akzent : Farben.text)
        .padding(.horizontal, 10)
        .frame(height: 32)
        .background(aktiv ? Farben.primaerFlaeche : Farben.flaeche, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .strokeBorder(aktiv ? Farben.primaerRand : Farben.randStark, lineWidth: 1)
        }
        .contentShape(Rectangle())
    }
}

/// Runder Auswahlkreis (leer bzw. gefüllt mit Haken) wie in den Listen des Systems.
struct Auswahlkreis: View {
    let gewaehlt: Bool

    var body: some View {
        Image(systemName: gewaehlt ? "checkmark.circle.fill" : "circle")
            .font(.system(size: 22, weight: .regular))
            .foregroundStyle(gewaehlt ? Farben.akzent : Farben.pfeil)
            .frame(width: 24, height: 24)
            .accessibilityHidden(true)
    }
}

/// Zeile der Empfängerauswahl: Auswahlkreis, Kürzel bzw. Gruppenname und Rollen.
struct Personenzeile: View {
    let empfaenger: Empfaenger
    let gewaehlt: Bool
    let umschalten: () -> Void

    var body: some View {
        Button(action: umschalten) {
            HStack(spacing: 14) {
                Auswahlkreis(gewaehlt: gewaehlt)
                HStack(spacing: 10) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(empfaenger.istPerson ? empfaenger.kuerzel : empfaenger.name)
                            .font(.body)
                            .foregroundStyle(Farben.text)
                            .lineLimit(1)
                        let pills = empfaenger.pills
                        if !pills.isEmpty {
                            Umbruchlayout(abstand: 4, zeilenabstand: 4) {
                                ForEach(Array(pills.enumerated()), id: \.offset) { _, p in
                                    Rollenkapsel(text: p.text)
                                }
                            }
                        }
                    }
                    Spacer(minLength: 0)
                }
            }
            .padding(.vertical, 6)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(gewaehlt ? .isSelected : [])
    }
}

/// Rolle einer Person („Lehrkraft“, „Klassenlehrkraft | 5A“): kleine neutrale Fläche, Radius 3 pt.
struct Rollenkapsel: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.caption)
            .foregroundStyle(Farben.text2)
            .lineLimit(1)
            .minimumScaleFactor(0.75)
            .padding(.horizontal, 6)
            .frame(height: 18)
            .background(Farben.neutralFlaeche, in: RoundedRectangle(cornerRadius: 3, style: .continuous))
    }
}

/// Einfaches Umbruch-Layout: Kinder nebeneinander, bei Platzmangel in die nächste Zeile.
struct Umbruchlayout: Layout {
    var abstand: CGFloat = 8
    var zeilenabstand: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let breite = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var zeile: CGFloat = 0
        var maxX: CGFloat = 0
        for s in subviews {
            let g = s.sizeThatFits(ProposedViewSize(width: breite, height: nil))
            if x > 0 && x + g.width > breite {
                y += zeile + zeilenabstand
                x = 0
                zeile = 0
            }
            x += g.width + abstand
            zeile = max(zeile, g.height)
            maxX = max(maxX, min(x - abstand, breite))
        }
        return CGSize(width: maxX, height: y + zeile)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var zeile: CGFloat = 0
        for s in subviews {
            let g = s.sizeThatFits(ProposedViewSize(width: bounds.width, height: nil))
            if x > bounds.minX && x + g.width > bounds.maxX {
                y += zeile + zeilenabstand
                x = bounds.minX
                zeile = 0
            }
            s.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(width: min(g.width, bounds.width), height: g.height))
            x += g.width + abstand
            zeile = max(zeile, g.height)
        }
    }
}

private extension View {
    /// Listenzeile ohne Trennlinie und Hintergrund (Empfängerauswahl).
    func auswahlzeile() -> some View {
        self
            .listRowInsets(EdgeInsets(top: 0, leading: 18, bottom: 0, trailing: 16))
            .listRowSeparator(.hidden)
            .listRowBackground(Color.clear)
    }
}

/// Titel in der Mitte der Mitteilungsblätter: Titel halbfett, darunter klein der Untertitel.
struct Mitteilungstitel: View {
    let titel: String
    var untertitel: String? = nil

    var body: some View {
        Blatttitel(titel: titel, untertitel: untertitel)
    }
}

// MARK: - Kamera

/// Foto mit der Kamera aufnehmen (UIImagePickerController); `fertig(nil)` bei Abbruch (der Aufrufer schließt die Ansicht).
struct KameraAufnahme: UIViewControllerRepresentable {
    let fertig: (UIImage?) -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Koordinator { Koordinator(self) }

    final class Koordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let eltern: KameraAufnahme

        init(_ eltern: KameraAufnahme) {
            self.eltern = eltern
        }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            eltern.fertig(info[.originalImage] as? UIImage)
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            eltern.fertig(nil)
        }
    }
}
