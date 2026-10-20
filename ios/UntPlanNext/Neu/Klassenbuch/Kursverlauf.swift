import SwiftUI

/// Kursverlauf: Themen der letzten acht Wochen desselben Unterrichts als Zeitleiste je Kalenderwoche – Lehrstoff (bzw.
/// „Lehrstoff fehlt“), Hausaufgaben, Fehlzeiten und Kontrolle; oben der Stand (Stunden mit Lehrstoff, kontrolliert) und –
/// falls angelegt – der Themenplan mit Haken. Gleicher Endpunkt wie die Klassenbuch-Übersicht im Web
/// (GET /api/app/klassenbuch/uebersicht, je Abfrage höchstens 31 Tage).
struct KursverlaufSeite: View {
    let karte: Karte
    var themenplan: [String] = []

    @EnvironmentObject var zustand: AppZustand
    @State private var stunden: [Kursstunde] = []
    @State private var geladen = false
    @State private var fehler: String? = nil

    private struct Woche: Identifiable {
        let kw: Int
        let montag: String
        let stunden: [Kursstunde]
        var id: String { montag }
    }

    private var klasse: String? {
        karte.klassen.map { $0.k.isEmpty ? ($0.alt ?? "") : $0.k }.first { !$0.isEmpty }
    }

    /// Stunden des Unterrichts (ohne Entfall), neueste Woche oben.
    private var wochen: [Woche] {
        let liste = stunden.filter { !$0.istEntfall && ($0.unterricht == nil || $0.unterricht == karte.unterricht) }
        var gruppen: [String: [Kursstunde]] = [:]
        for s in liste {
            let m = Planmodell.montag(s.datum)
            gruppen[m, default: []].append(s)
        }
        return gruppen.keys.sorted(by: >).map { m in
            let s = (gruppen[m] ?? []).sorted { ($0.datum, $0.von) > ($1.datum, $1.von) }
            let kw = Datumsformat.datum(m).map { Datumsformat.kalenderwoche($0) } ?? 0
            return Woche(kw: kw, montag: m, stunden: s)
        }
    }

    private var bisHeute: [Kursstunde] {
        let heute = Datumsformat.iso(Date())
        return stunden.filter { !$0.istEntfall && $0.datum <= heute }
    }

    var body: some View {
        List {
            if let fehler {
                Section {
                    Fehlerhinweis(text: fehler)
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                }
            }
            standAbschnitt
            if !themenplan.isEmpty {
                planAbschnitt
            }
            if geladen && wochen.isEmpty && fehler == nil {
                Section {
                    Text("In den letzten Wochen sind keine Stunden dieses Unterrichts eingetragen.")
                        .foregroundStyle(Farben.text2)
                }
            }
            ForEach(wochen) { w in
                Section {
                    ForEach(w.stunden) { s in
                        stundenZeile(s)
                    }
                } header: {
                    Text("KW \(w.kw) · ab \(Datumsformat.anzeige(w.montag, "d.M."))")
                }
            }
        }
        .listStyle(.insetGrouped)
        .listSectionSpacing(.compact)
        .background(Farben.grund.ignoresSafeArea())
        .safeAreaInset(edge: .top, spacing: 0) {
            if !geladen { Ladebalken(aktiv: true) }
        }
        .navigationTitle("Kursverlauf \(karte.fach)")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await laden() }
        .task { await laden() }
    }

    @ViewBuilder
    private var standAbschnitt: some View {
        let alle = bisHeute
        if !alle.isEmpty {
            let mitStoff = alle.filter { !$0.lehrstoff.isEmpty }.count
            let geprueft = alle.filter(\.geprueft).count
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("\(mitStoff) von \(alle.count) Stunden mit Lehrstoff")
                            .font(.subheadline.weight(.semibold))
                        Spacer()
                        Text("\(geprueft) kontrolliert")
                            .font(.subheadline)
                            .foregroundStyle(Farben.text2)
                    }
                    ProgressView(value: Double(mitStoff), total: Double(max(1, alle.count)))
                        .tint(mitStoff == alle.count ? Farben.ok : Farben.akzent)
                }
                .padding(.vertical, 2)
                .accessibilityElement(children: .combine)
            } header: {
                Text("Stand der letzten Wochen")
            }
        }
    }

    private var planAbschnitt: some View {
        let behandelt = stunden.map(\.lehrstoff)
        return Section("Themenplan") {
            ForEach(Array(themenplan.enumerated()), id: \.offset) { i, t in
                let fertig = Themenplan.behandelt(t, in: behandelt)
                HStack(spacing: 10) {
                    Image(systemName: fertig ? "checkmark.circle.fill" : "circle")
                        .foregroundStyle(fertig ? Farben.ok : Farben.text3)
                        .accessibilityHidden(true)
                    Text("\(i + 1). \(t)")
                        .foregroundStyle(fertig ? Farben.text2 : Farben.text)
                }
                .accessibilityLabel("\(t), \(fertig ? "behandelt" : "offen")")
            }
        }
    }

    private func stundenZeile(_ s: Kursstunde) -> some View {
        let zukunft = s.datum > Datumsformat.iso(Date())
        return HStack(alignment: .top, spacing: 12) {
            // Zeitleiste: Punkt (gefüllt = Lehrstoff eingetragen)
            VStack(spacing: 0) {
                Circle()
                    .fill(s.lehrstoff.isEmpty ? Color.clear : Farben.akzent)
                    .overlay { Circle().strokeBorder(s.lehrstoff.isEmpty ? Farben.text3 : Farben.akzent, lineWidth: 1.5) }
                    .frame(width: 11, height: 11)
                    .padding(.top, 4)
                Rectangle()
                    .fill(Farben.rand)
                    .frame(width: 1.5)
                    .frame(maxHeight: .infinity)
            }
            .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(Datumsformat.anzeige(s.datum, "EE d.M."))
                        .font(.subheadline.weight(.semibold))
                    Text(s.stundenText)
                        .font(.caption)
                        .foregroundStyle(Farben.text3)
                    Spacer(minLength: 4)
                    if s.geprueft {
                        Image(systemName: "checkmark.seal.fill")
                            .font(.caption)
                            .foregroundStyle(Farben.ok)
                            .accessibilityLabel("kontrolliert")
                    }
                    if s.abwesend > 0 {
                        Text("\(s.abwesend) fehlen")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Farben.entfall)
                    }
                }
                if s.lehrstoff.isEmpty {
                    Text(zukunft ? "geplant" : "Lehrstoff fehlt")
                        .font(.subheadline)
                        .foregroundStyle(zukunft ? Farben.text3 : Farben.warnung)
                } else {
                    Text(s.lehrstoff)
                        .font(.subheadline)
                        .foregroundStyle(Farben.text)
                }
                if !s.hausaufgaben.isEmpty {
                    Label(s.hausaufgaben, systemImage: "checklist")
                        .font(.caption)
                        .foregroundStyle(Farben.text2)
                        .lineLimit(2)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }

    /// Acht Wochen in zwei Abfragen (der Server liefert höchstens 31 Tage je Abfrage), dazu die laufende Woche.
    private func laden() async {
        defer { geladen = true }
        guard karte.unterricht != nil else { return }
        let heute = Date()
        let ende = Datumsformat.tage(6, nach: Datumsformat.montag(heute))
        let mitte = Datumsformat.tage(-28, nach: ende)
        let anfang = Datumsformat.tage(-55, nach: ende)
        var ergebnis: [Kursstunde] = []
        var letzterFehler: Error? = nil
        for (von, bis) in [(Datumsformat.tage(1, nach: mitte), ende), (anfang, mitte)] {
            do {
                let u = try await zustand.api.klassenbuchUebersicht(von: Datumsformat.iso(von), bis: Datumsformat.iso(bis),
                                                                   klasse: klasse, unterricht: karte.unterricht)
                ergebnis += u.tage.flatMap(\.stunden)
            } catch {
                letzterFehler = error
            }
        }
        // Doppelte (Grenztag) nur einmal
        var gesehen = Set<String>()
        stunden = ergebnis.filter { gesehen.insert($0.id).inserted }
        if stunden.isEmpty, let letzterFehler {
            fehler = zustand.fehlertext(letzterFehler)
        } else {
            fehler = nil
        }
    }
}
