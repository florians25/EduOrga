import SwiftUI

// Sitzplan (nur lesen; angelegt und bearbeitet wird er im Web): Raster aus Reihen und Plätzen mit Lehrerpult vorn
// bzw. hinten. In der Stunde zeigt jeder Platz den Anwesenheitsstand; Antippen setzt anwesend, abwesend oder
// verspätet (wie die Schnellwahl der Schülerliste, offline gepuffert).

/// Raster eines Sitzplans: `inhalt` zeichnet den Platz einer Schülerin bzw. eines Schülers.
struct SitzplanRaster<Platz: View>: View {
    let plan: SitzplanPlan
    let schueler: [Schueler]
    @ViewBuilder let platz: (Schueler) -> Platz

    private var nachId: [Int: Schueler] {
        Dictionary(schueler.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
    }

    var body: some View {
        let ohne = Set(plan.ohneTisch)
        let breite: CGFloat = 92
        VStack(spacing: 10) {
            if !plan.pultHinten { pult }
            ScrollView(.horizontal) {
                Grid(horizontalSpacing: 6, verticalSpacing: 6) {
                    ForEach(0..<plan.zeilen, id: \.self) { dz in
                        GridRow {
                            ForEach(0..<plan.spalten, id: \.self) { ds in
                                let z = plan.pultHinten ? plan.zeilen - dz : dz + 1
                                let sp = plan.pultHinten ? plan.spalten - ds : ds + 1
                                let schluessel = "\(z)-\(sp)"
                                Group {
                                    if let id = plan.belegung[schluessel], let s = nachId[id] {
                                        platz(s)
                                    } else if ohne.contains(schluessel) {
                                        Color.clear
                                    } else {
                                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                                            .strokeBorder(Farben.randStark, style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                                            .accessibilityLabel("Reihe \(z), Platz \(sp), frei")
                                    }
                                }
                                .frame(width: breite, height: 58)
                            }
                        }
                    }
                }
                .padding(.horizontal, 2)
            }
            .scrollIndicators(.hidden)
            if plan.pultHinten { pult }
        }
    }

    private var pult: some View {
        Label("Lehrerpult", systemImage: "person.crop.rectangle")
            .font(.caption.weight(.semibold))
            .foregroundStyle(Farben.text2)
            .padding(.horizontal, 16)
            .padding(.vertical, 5)
            .background(Farben.neutralFlaeche, in: Capsule())
    }
}

/// Platz mit Name (Vorname groß, Nachname klein) und optionalem Stand.
struct SitzplanPlatz: View {
    let schueler: Schueler
    var stand: Anwesenheitsstand? = nil

    var body: some View {
        VStack(spacing: 2) {
            if let stand {
                Image(systemName: stand.symbol)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(stand.farbe)
            }
            Text(schueler.vorname.isEmpty ? schueler.name : schueler.vorname)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Farben.text)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            if !schueler.vorname.isEmpty {
                Text(schueler.name)
                    .font(.caption2)
                    .foregroundStyle(Farben.text2)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        }
        .padding(4)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(flaeche, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .strokeBorder(stand.map { $0.istAnwesend ? Farben.rand : $0.farbe } ?? Farben.rand, lineWidth: stand?.istAnwesend == false ? 1.5 : 1)
        }
        .accessibilityElement(children: .combine)
    }

    private var flaeche: Color {
        switch stand {
        case .some(.abwesend): return Farben.entfallFlaeche
        case .some(.verspaetet), .some(.vorzeitig): return Farben.warnungFlaeche
        default: return Farben.flaeche
        }
    }
}

// MARK: - Sitzplan einer Stunde

/// Sitzplan in der Stunde (Unterricht vor Raum vor Klasse, wie im Web): Anwesenheit am Platz antippen.
struct SitzplanStundeSeite: View {
    @EnvironmentObject var daten: Stundendaten
    @EnvironmentObject var zustand: AppZustand
    @State private var sitzplan: SitzplanStunde? = nil
    @State private var fehler: String? = nil
    @State private var geladen = false
    @State private var gewaehlt: Schueler? = nil

    private var bearbeitbar: Bool {
        guard daten.anwesenheit?.darf == true, let tag = Datumsformat.datum(daten.karte.datum) else { return false }
        return tag <= Datumsformat.kalender.startOfDay(for: Date())
    }

    var body: some View {
        DetailSeitenRahmen(titel: "Sitzplan", untertitel: stundenUntertitel(daten.karte), laedt: !geladen) {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if let fehler {
                        Fehlerhinweis(text: fehler)
                    }
                    if let p = sitzplan?.gueltig, let liste = sitzplan?.schueler, !liste.isEmpty {
                        SitzplanRaster(plan: p, schueler: liste) { s in
                            Button {
                                if bearbeitbar { gewaehlt = s }
                            } label: {
                                SitzplanPlatz(schueler: s, stand: daten.anwesenheit == nil ? nil : daten.stand(s))
                            }
                            .buttonStyle(.plain)
                        }
                        Text(p.bereichText + (p.geaendert.isEmpty ? "" : " · geändert \(Datumsformat.anzeige(p.geaendert, "d.M.yyyy"))"))
                            .font(.caption)
                            .foregroundStyle(Farben.text3)
                        ohnePlatz(p, liste)
                        if !bearbeitbar {
                            Text("Anwesenheit nur in eigenen Stunden ab dem Tag der Stunde.")
                                .font(.footnote)
                                .foregroundStyle(Farben.text3)
                        }
                    } else if geladen && fehler == nil {
                        Hinweisfeld(titel: "Kein Sitzplan", text: "Für diese Stunde ist noch kein Sitzplan hinterlegt. Sitzpläne legen Sie im Web an (Klassenbuch → Sitzplan).",
                                    symbol: "square.grid.3x3", flaeche: Farben.flaeche)
                    }
                }
                .padding(16)
            }
        }
        .confirmationDialog(gewaehlt?.anzeige ?? "", isPresented: Binding(get: { gewaehlt != nil }, set: { if !$0 { gewaehlt = nil } }),
                            titleVisibility: .visible, presenting: gewaehlt) { s in
            Button("Anwesend") { setzen(s) { try await daten.anwesendSetzen(s) } }
            Button("Abwesend (ganze Stunde)", role: .destructive) { setzen(s) { try await daten.abwesendSetzen(s) } }
            Button("5 Minuten verspätet") { setzen(s) { try await daten.verspaetetSetzen(s, minuten: 5) } }
            Button("10 Minuten verspätet") { setzen(s) { try await daten.verspaetetSetzen(s, minuten: 10) } }
            Button("15 Minuten verspätet") { setzen(s) { try await daten.verspaetetSetzen(s, minuten: 15) } }
            Button("Abbrechen", role: .cancel) {}
        } message: { s in
            Text(daten.stand(s).text)
        }
        .task { await laden() }
    }

    @ViewBuilder
    private func ohnePlatz(_ p: SitzplanPlan, _ liste: [Schueler]) -> some View {
        let gesetzt = Set(p.belegung.values)
        let rest = liste.filter { !gesetzt.contains($0.id) }
        if !rest.isEmpty {
            Text("Ohne Sitzplatz (\(rest.count))")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Farben.text)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 92), spacing: 6)], spacing: 6) {
                ForEach(rest) { s in
                    Button {
                        if bearbeitbar { gewaehlt = s }
                    } label: {
                        SitzplanPlatz(schueler: s, stand: daten.anwesenheit == nil ? nil : daten.stand(s))
                            .frame(height: 58)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func setzen(_ s: Schueler, _ aktion: @escaping () async throws -> Void) {
        Task {
            do {
                try await aktion()
                Haptik.auswahl()
            } catch {
                fehler = zustand.fehlertext(error)
            }
        }
    }

    private func laden() async {
        defer { geladen = true }
        if daten.anwesenheit == nil { await daten.anwesenheitLaden() }
        do {
            sitzplan = try await zustand.api.sitzplanStunde(unterricht: daten.karte.unterricht,
                                                            raeume: daten.aktuelleRaeume.map(\.k).filter { !$0.isEmpty },
                                                            klassen: daten.klassen, lehrer: daten.lehrerHinweis)
            fehler = nil
        } catch {
            fehler = zustand.fehlertext(error)
        }
    }
}

// MARK: - Sitzplan einer Klasse

/// Sitzplan einer Klasse (Reiter „Schule“ → Klassenbuch → Sitzplan): eigene Klasse vorgewählt.
struct SitzplanKlasseView: View {
    @EnvironmentObject var zustand: AppZustand
    @State private var klasse = ""
    @State private var daten: SitzplanKlasse? = nil
    @State private var fehler: String? = nil
    @State private var laedt = false

    var body: some View {
        List {
            Section {
                KlassenFeld(klasse: $klasse)
            }
            if let fehler {
                Section { Fehlerhinweis(text: fehler) }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }
            if let d = daten {
                if let p = d.plan, p.vorhanden, !d.schueler.isEmpty {
                    Section {
                        SitzplanRaster(plan: p, schueler: d.schueler) { s in
                            SitzplanPlatz(schueler: s)
                        }
                        .padding(.vertical, 8)
                    } footer: {
                        Text("Der Klassen-Sitzplan gilt in jedem Unterricht der Klasse. Bearbeiten im Web (Klassenbuch → Sitzplan)" + (d.verwalten ? "." : " durch die Klassenleitung."))
                    }
                } else if d.schueler.isEmpty {
                    LeereListe(titel: "Keine Schülerliste", symbol: "person.3", text: "Für diese Klasse wurde keine Schülerliste übertragen.")
                } else {
                    LeereListe(titel: "Kein Sitzplan", symbol: "square.grid.3x3", text: "Für die Klasse \(klasse) ist noch kein Sitzplan hinterlegt.")
                }
            } else if laedt {
                ProgressView().frame(maxWidth: .infinity).listRowBackground(Color.clear)
            } else if klasse.isEmpty {
                LeereListe(titel: "Klasse wählen", symbol: "person.3", text: "Wählen Sie oben eine Klasse.")
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(klasse.isEmpty ? "Sitzplan" : "Sitzplan \(klasse)")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .task {
            if klasse.isEmpty { klasse = await eigeneKlasse(zustand) }
        }
        .task(id: klasse) { await laden() }
        .refreshable { await laden() }
    }

    private func laden() async {
        guard !klasse.isEmpty else { return }
        laedt = true
        defer { laedt = false }
        do {
            daten = try await zustand.api.sitzplanKlasse(klasse)
            fehler = nil
        } catch {
            daten = nil
            fehler = zustand.fehlertext(error)
        }
    }
}
