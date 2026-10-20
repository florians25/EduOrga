import QuickLook
import SwiftUI

/// Postfach: großer Titel, Suchfeld des Systems, rechts „Neue Mitteilung“ (Menü „Kolleg*innen“ bzw. „Individuell“);
/// darunter der Segmentschalter Posteingang | Gesendet | Entwürfe und die Liste (Absender, Betreff,
/// Vorschau, Büroklammer bei Anhängen, Punkt bei ungelesenen Mitteilungen). Löschen per Wischen.
struct MitteilungenView: View {
    enum Ordner: String, CaseIterable, Identifiable {
        case eingang
        case gesendet
        case entwuerfe

        var id: String { rawValue }

        var titel: String {
            switch self {
            case .eingang: return "Posteingang"
            case .gesendet: return "Gesendet"
            case .entwuerfe: return "Entwürfe"
            }
        }

        var symbol: String {
            switch self {
            case .eingang: return "tray"
            case .gesendet: return "paperplane"
            case .entwuerfe: return "doc"
            }
        }

        /// Parameter "ordner" der API (nil = Posteingang)
        var apiWert: String? {
            switch self {
            case .eingang: return nil
            case .gesendet: return "gesendet"
            case .entwuerfe: return "entwuerfe"
            }
        }
    }

    @EnvironmentObject var zustand: AppZustand
    @Environment(\.horizontalSizeClass) private var groessenklasse
    @State private var ordner: Ordner = .eingang
    @State private var liste: [Mitteilung] = []
    @State private var geladen = false
    @State private var fehler: String? = nil
    @State private var suche = ""
    /// Neue Mitteilung bzw. Antwort (Blatt mit Empfängerauswahl und Editor)
    @State private var verfassen: Verfassen? = nil
    /// Geöffnete Mitteilung (Detail)
    @State private var pfad: [Int] = []
    /// Liste wird (neu) geladen – Ladebalken unter der Navigationsleiste
    @State private var laedt = false

    private var gefiltert: [Mitteilung] {
        guard !suche.isEmpty else { return liste }
        return liste.filter {
            $0.betreff.localizedCaseInsensitiveContains(suche) || $0.text.localizedCaseInsensitiveContains(suche) ||
                $0.absender.localizedCaseInsensitiveContains(suche) || $0.empfaenger.contains { $0.localizedCaseInsensitiveContains(suche) }
        }
    }

    var body: some View {
        NavigationStack(path: $pfad) {
            List {
                Section {
                    Segmentschalter(auswahl: $ordner, Ordner.allCases.map { ($0, $0.titel) })
                        .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 8, trailing: 16))
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.clear)
                }
                if let fehler {
                    Fehlerhinweis(text: fehler)
                        .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.clear)
                }
                ForEach(gefiltert) { m in
                    NavigationLink(value: m.id) {
                        Mitteilungszeile(mitteilung: m, gesendet: ordner != .eingang)
                    }
                    .alignmentGuide(.listRowSeparatorLeading) { _ in Mitteilungszeile.textLinks }
                    .swipeActions(edge: .trailing) {
                        Button(role: .destructive) {
                            Task { await loeschen(m) }
                        } label: {
                            Label("Löschen", systemImage: "trash")
                        }
                    }
                }
            }
            .listStyle(.plain)
            .overlay {
                if geladen && gefiltert.isEmpty && fehler == nil {
                    ContentUnavailableView(suche.isEmpty ? "Keine Mitteilungen" : "Keine Treffer", systemImage: ordner.symbol,
                                           description: Text(leertext))
                }
            }
            .overlay(alignment: .top) {
                Ladebalken(aktiv: laedt || !geladen)
            }
            .refreshable { await laden() }
            .searchable(text: $suche, prompt: "Mitteilungen durchsuchen")
            .navigationTitle("Postfach")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) { neuKnopf }
            }
            .suchWerkzeug()
            .task(id: ordner) { await laden() }
            .navigationDestination(for: Int.self) { id in
                if let m = liste.first(where: { $0.id == id }) {
                    MitteilungDetailView(mitteilung: m, gesendet: ordner != .eingang, gelesen: { gelesenMarkiert($0) },
                                         antworten: { vorlage in verfassen = vorlage },
                                         geloescht: { entfernt($0) })
                        .environmentObject(zustand)
                } else {
                    ContentUnavailableView("Mitteilung nicht gefunden", systemImage: "envelope")
                }
            }
            .detailPraesentation(item: $verfassen, breit: groessenklasse == .regular, art: .formular) { v in
                MitteilungVerfassenView(start: v) {
                    if ordner != .eingang { Task { await laden() } }
                }
                .environmentObject(zustand)
            }
        }
    }

    /// „Neue Mitteilung“: Kollegium wählt zwischen Kolleg*innen und Individuell; Schüler*innen und Eltern schreiben nur
    /// individuell (an die erlaubten Lehrkräfte).
    @ViewBuilder
    private var neuKnopf: some View {
        if zustand.istKollegium {
            Menu {
                Section("An wen soll die Mitteilung gehen?") {
                    Button("Kolleg*innen") { verfassen = Verfassen(typ: .kollegium) }
                    Button("Individuell") { verfassen = Verfassen(typ: .individuell) }
                }
            } label: {
                Image(systemName: "square.and.pencil")
            }
            .accessibilityLabel("Neue Mitteilung")
        } else {
            Button {
                verfassen = Verfassen(typ: .individuell)
            } label: {
                Image(systemName: "square.and.pencil")
            }
            .accessibilityLabel("Neue Mitteilung")
        }
    }

    private var leertext: String {
        if !suche.isEmpty { return "Keine Mitteilung passt zu „\(suche)“." }
        switch ordner {
        case .eingang: return "Ihr Posteingang ist leer."
        case .gesendet: return "Noch nichts gesendet."
        case .entwuerfe: return "Keine Entwürfe."
        }
    }

    private func laden() async {
        laedt = true
        defer { laedt = false }
        do {
            let neu = try await zustand.api.mitteilungen(ordner: ordner.apiWert)
            liste = neu
            fehler = nil
            if ordner == .eingang {
                zustand.ungelesen = neu.filter(\.ungelesen).count
            }
        } catch {
            if let text = zustand.fehlertext(error) { fehler = text }
        }
        geladen = true
    }

    private func gelesenMarkiert(_ id: Int) {
        if let i = liste.firstIndex(where: { $0.id == id }), liste[i].gelesen == nil {
            liste[i].gelesen = Datumsformat.iso(Date())
            zustand.ungelesen = max(0, zustand.ungelesen - 1)
        }
    }

    /// Im Detail gelöscht: aus der Liste entfernen und zurück.
    private func entfernt(_ id: Int) {
        if let m = liste.first(where: { $0.id == id }), ordner == .eingang && m.ungelesen {
            zustand.ungelesen = max(0, zustand.ungelesen - 1)
        }
        pfad.removeAll()
        liste.removeAll { $0.id == id }
    }

    private func loeschen(_ m: Mitteilung) async {
        do {
            try await zustand.api.mitteilungLoeschen(m.id)
            liste.removeAll { $0.id == m.id }
            if ordner == .eingang && m.ungelesen {
                zustand.ungelesen = max(0, zustand.ungelesen - 1)
            }
        } catch {
            if let text = zustand.fehlertext(error) { fehler = text }
        }
    }
}

/// Anzeige des Datums in der Liste: heute mit Uhrzeit, sonst Tag und Monat (z. B. „27. Nov.“).
func mitteilungsdatum(_ erstellt: String) -> String {
    guard let d = Datumsformat.datum(erstellt) else { return erstellt }
    if Datumsformat.kalender.isDateInToday(d) && erstellt.count >= 16 {
        return Datumsformat.anzeige(d, "HH:mm")
    }
    return Datumsformat.anzeige(d, "d. MMM")
}

/// „19.01.26, 07:24“ im Detail.
func mitteilungsdatumLang(_ erstellt: String) -> String {
    guard let d = Datumsformat.datum(erstellt) else { return erstellt }
    let tag = Datumsformat.anzeige(d, "dd.MM.yy")
    guard erstellt.count >= 16 else { return tag }
    let zeit = String(erstellt.dropFirst(11).prefix(5))
    return "\(tag), \(zeit)"
}

/// Zeile im Postfach: Punkt bei ungelesenen Mitteilungen, Absender (bzw. Empfänger) und Datum, Betreff, Vorschau in
/// zwei Zeilen, Büroklammer bei Anhängen.
struct Mitteilungszeile: View {
    let mitteilung: Mitteilung
    let gesendet: Bool

    /// Breite der Spalte für den Ungelesen-Punkt
    static let punktBreite: CGFloat = 12
    /// Beginn des Texts (Trennlinie der Liste beginnt hier)
    static let textLinks: CGFloat = 20 + punktBreite + 6

    private var name: String {
        if gesendet {
            if !mitteilung.empfaengerText.isEmpty { return "An: " + mitteilung.empfaengerText }
            return mitteilung.empfaenger.isEmpty ? "Ohne Empfänger" : "An: " + mitteilung.empfaenger.joined(separator: ", ")
        }
        return mitteilung.absender.isEmpty ? "Unbekannt" : mitteilung.absenderKuerzel
    }

    private var ungelesen: Bool { !gesendet && mitteilung.ungelesen }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Circle()
                .fill(ungelesen ? Farben.akzent : Color.clear)
                .frame(width: 8, height: 8)
                .frame(width: Self.punktBreite)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                HStack(alignment: .firstTextBaseline) {
                    Text(name)
                        .font(.body.weight(ungelesen ? .semibold : .regular))
                        .foregroundStyle(Farben.text)
                        .lineLimit(1)
                    Spacer(minLength: 6)
                    Text(mitteilungsdatum(mitteilung.erstellt))
                        .font(.footnote)
                        .monospacedDigit()
                        .foregroundStyle(ungelesen ? Farben.akzent : Farben.text3)
                        .lineLimit(1)
                        .fixedSize()
                }
                HStack(spacing: 4) {
                    if mitteilung.wichtig {
                        Image(systemName: "exclamationmark")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Farben.entfall)
                            .accessibilityLabel("Wichtig")
                    }
                    Text(mitteilung.betreff.isEmpty ? "(ohne Betreff)" : mitteilung.betreff)
                        .font(.subheadline.weight(ungelesen ? .semibold : .regular))
                        .foregroundStyle(Farben.text)
                        .lineLimit(1)
                    Spacer(minLength: 4)
                    if !mitteilung.anhaenge.isEmpty {
                        Image(systemName: "paperclip")
                            .font(.system(size: 13, weight: .regular))
                            .foregroundStyle(Farben.text3)
                            .accessibilityLabel("Mit Anhang")
                    }
                }
                Text(mitteilung.text.replacingOccurrences(of: "\n", with: " "))
                    .font(.subheadline)
                    .foregroundStyle(Farben.text2)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, 6)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(ungelesen ? "Ungelesen, \(name)" : name)
    }
}

// MARK: - Detail

/// Eine Mitteilung lesen: Navigationsleiste des Systems, darunter Absender bzw. Empfänger und Datum, der Betreff groß,
/// der Text und die Anhänge (antippen öffnet die Vorschau); unten in der Werkzeugleiste Antworten und Löschen. Wird beim
/// Öffnen als gelesen markiert.
struct MitteilungDetailView: View {
    let mitteilung: Mitteilung
    let gesendet: Bool
    let gelesen: (Int) -> Void
    let antworten: (Verfassen) -> Void
    let geloescht: (Int) -> Void
    @EnvironmentObject var zustand: AppZustand
    /// Vollständige Mitteilung aus GET /mitteilungen/{id} (nil = Eintrag der Liste)
    @State private var detail: Mitteilung? = nil
    @State private var laedtAnhang: Int? = nil
    @State private var vorschau: URL? = nil
    @State private var fehler: String? = nil
    @State private var loeschenFragen = false
    @State private var bestaetigt: String? = nil
    @State private var arbeitet = false

    private var m: Mitteilung { detail ?? mitteilung }

    private var darfAntworten: Bool { !gesendet && m.darfAntworten && m.absenderId != 0 }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                kopfzeile
                Text(m.betreff.isEmpty ? "(ohne Betreff)" : m.betreff)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Farben.text)
                    .padding(.top, 14)
                    .textSelection(.enabled)
                if m.wichtig {
                    Plakette(text: "Wichtig", farbe: Farben.entfall, flaeche: Farben.entfallFlaeche)
                        .padding(.top, 8)
                }
                Rectangle()
                    .fill(Farben.rand)
                    .frame(height: 1)
                    .padding(.vertical, 14)
                Text(m.text)
                    .font(.body)
                    .foregroundStyle(Farben.text)
                    .lineSpacing(2)
                    .textSelection(.enabled)
                if !m.anhaenge.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Anhänge")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Farben.text2)
                        ForEach(m.anhaenge) { a in
                            Anhangpille(anhang: a, laedt: laedtAnhang == a.id) {
                                Task { await oeffnen(a) }
                            }
                        }
                    }
                    .padding(.top, 24)
                }
                if !gesendet && m.lesebestaetigung {
                    lesebestaetigung
                        .padding(.top, 24)
                }
                if let fehler {
                    Fehlerhinweis(text: fehler)
                        .padding(.top, 20)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 32)
            .frame(maxWidth: 720, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .background(Farben.flaeche.ignoresSafeArea())
        .overlay(alignment: .top) {
            Ladebalken(aktiv: arbeitet)
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .bottomBar) {
                Button(role: .destructive) {
                    loeschenFragen = true
                } label: {
                    Label("Löschen", systemImage: "trash")
                }
                Spacer()
                if darfAntworten {
                    Button {
                        Task { await antworte() }
                    } label: {
                        Label("Antworten", systemImage: "arrowshape.turn.up.left")
                    }
                }
            }
        }
        .quickLookPreview($vorschau)
        .confirmationDialog("Mitteilung löschen?", isPresented: $loeschenFragen, titleVisibility: .visible) {
            Button("Löschen", role: .destructive) { Task { await loeschen() } }
            Button("Abbrechen", role: .cancel) {}
        }
        .task {
            if let neu = try? await zustand.api.mitteilung(mitteilung.id) { detail = neu }
            guard !gesendet, mitteilung.ungelesen else { return }
            do {
                try await zustand.api.alsGelesenMarkieren(mitteilung.id)
                gelesen(mitteilung.id)
            } catch {
                _ = zustand.fehlertext(error)
            }
        }
    }

    /// „Von …“ bzw. „An …“ und rechts das Datum.
    private var kopfzeile: some View {
        let person = gesendet ? (m.empfaengerText.isEmpty ? m.empfaenger.joined(separator: ", ") : m.empfaengerText)
                              : m.absenderKuerzel
        return HStack(alignment: .firstTextBaseline, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(person)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Farben.text)
                    .lineLimit(2)
                Text(gesendet ? "Empfänger" : (m.absenderRolle.isEmpty ? "Absender" : m.absenderRolle))
                    .font(.footnote)
                    .foregroundStyle(Farben.text2)
            }
            Spacer(minLength: 8)
            Text(mitteilungsdatumLang(m.erstellt))
                .font(.footnote)
                .monospacedDigit()
                .foregroundStyle(Farben.text3)
                .lineLimit(1)
                .fixedSize()
        }
        .accessibilityElement(children: .combine)
    }

    /// Lesebestätigung angefordert: bestätigen bzw. Zeitpunkt der eigenen Bestätigung.
    @ViewBuilder
    private var lesebestaetigung: some View {
        let zeitpunkt = bestaetigt ?? m.bestaetigt
        if let zeitpunkt, !zeitpunkt.isEmpty {
            Label("Lesen bestätigt am \(mitteilungsdatumLang(zeitpunkt))", systemImage: "checkmark.circle")
                .font(.subheadline)
                .foregroundStyle(Farben.ok)
        } else {
            Button {
                Task { await bestaetigen() }
            } label: {
                Text("Lesebestätigung senden")
            }
            .buttonStyle(.bordered)
            .tint(Farben.akzent)
            .accessibilityHint("Der Absender hat eine Lesebestätigung angefordert")
        }
    }

    private func antworte() async {
        arbeitet = true
        defer { arbeitet = false }
        var start = Verfassen(typ: .antwort)
        start.antwortAuf = m.id
        if let v = try? await zustand.api.antwortvorlage(m.id) {
            start.empfaenger = v.empfaenger
            start.betreff = v.betreff
            start.text = v.text
            if let id = v.antwortAuf { start.antwortAuf = id }
        }
        if start.empfaenger.isEmpty {
            start.empfaenger = [Empfaenger(id: "benutzer:\(m.absenderId)", name: m.absenderKuerzel)]
        }
        if start.betreff.isEmpty {
            start.betreff = m.betreff.hasPrefix("AW:") ? m.betreff : "AW: " + m.betreff
        }
        antworten(start)
    }

    private func bestaetigen() async {
        do {
            try await zustand.api.lesebestaetigungSenden(m.id)
            bestaetigt = Datumsformat.anzeige(Date(), "yyyy-MM-dd HH:mm")
        } catch {
            fehler = zustand.fehlertext(error)
        }
    }

    private func loeschen() async {
        arbeitet = true
        defer { arbeitet = false }
        do {
            try await zustand.api.mitteilungLoeschen(m.id)
            geloescht(m.id)
        } catch {
            fehler = zustand.fehlertext(error)
        }
    }

    /// Anhang laden, als Datei ablegen und in der Vorschau öffnen (Teilen und Sichern über die Vorschau).
    private func oeffnen(_ a: Anhang) async {
        guard laedtAnhang == nil else { return }
        laedtAnhang = a.id
        defer { laedtAnhang = nil }
        do {
            let daten = try await zustand.api.anhangLaden(a.id)
            let ordner = FileManager.default.temporaryDirectory.appendingPathComponent("Anhaenge/\(a.id)", isDirectory: true)
            try FileManager.default.createDirectory(at: ordner, withIntermediateDirectories: true)
            let name = a.name.isEmpty ? "Anhang" : a.name.replacingOccurrences(of: "/", with: "_")
            let datei = ordner.appendingPathComponent(name)
            try daten.write(to: datei, options: .atomic)
            fehler = nil
            vorschau = datei
        } catch {
            fehler = zustand.fehlertext(error) ?? "Der Anhang konnte nicht geladen werden."
        }
    }
}

/// Anhang als Zeile mit feinem Rand: Dateisymbol, Dateiname, rechts optional „entfernen“.
struct Anhangpille: View {
    let anhang: Anhang
    var laedt: Bool = false
    var entfernen: (() -> Void)? = nil
    let antippen: () -> Void

    private var symbol: String {
        if anhang.istPdf { return "doc.richtext" }
        if anhang.istBild { return "photo" }
        return "doc"
    }

    var body: some View {
        HStack(spacing: 10) {
            Button(action: antippen) {
                HStack(spacing: 10) {
                    Group {
                        if laedt {
                            ProgressView()
                        } else {
                            Image(systemName: symbol)
                                .font(.system(size: 17, weight: .regular))
                                .foregroundStyle(Farben.akzent)
                        }
                    }
                    .frame(width: 22, height: 22)
                    Text(anhang.name.isEmpty ? "Anhang" : anhang.name)
                        .font(.subheadline)
                        .foregroundStyle(Farben.text)
                        .lineLimit(1)
                        .truncationMode(.middle)
                    Spacer(minLength: 4)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            if let entfernen {
                Button(action: entfernen) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 17))
                        .foregroundStyle(Farben.pfeil)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Anhang entfernen")
            }
        }
        .padding(.horizontal, 12)
        .frame(height: 44)
        .background(Farben.flaeche2, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .strokeBorder(Farben.rand, lineWidth: 1)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Anhang \(anhang.name)")
    }
}

// MARK: - Werkzeuge

/// Symbolknopf in einer Werkzeugleiste (Lesebestätigung, Antwort nicht erlaubt, Kamera, Foto, Datei); `aktiv` hebt ihn
/// als eingeschalteten Schalter hervor (Symbol in Petrol auf heller Petrol-Fläche).
struct Werkzeugknopf: View {
    let symbol: String
    let text: String
    var aktiv: Bool = false
    let aktion: () -> Void

    var body: some View {
        Button(action: aktion) {
            Image(systemName: symbol)
                .font(.system(size: 17, weight: .regular))
                .foregroundStyle(Farben.akzent)
                .frame(width: 40, height: 36)
                .background(aktiv ? Farben.primaerFlaeche : Color.clear,
                            in: RoundedRectangle(cornerRadius: 6, style: .continuous))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(text)
        .accessibilityAddTraits(aktiv ? .isSelected : [])
    }
}
