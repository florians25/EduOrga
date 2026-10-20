import SwiftUI
import Combine

// Mehrere Pläne nebeneinander (Mehrfachauswahl im Blatt „Auswahl“ per Kontrollkästchen; iPad und iPhone): oben eine
// Leiste mit den gewählten Klassen, Lehrkräften bzw. Räumen als Felder mit „×“ („Hinzufügen …“ öffnet die Auswahl),
// darunter das Raster (Woche bzw. ein Tag) mit je einer Unterspalte pro Plan in jedem Tag – im Querformat besonders
// übersichtlich. Gleiche Karten, Reiter „+N“, Jetzt-Linie und Gesten wie in der Einzelansicht. Veranstaltungen, zu deren
// Zeit in keinem gewählten Plan Unterricht liegt (AG Schulfest 14:15–15:30), stehen genau nach ihrer Uhrzeit als ein
// Block über den ganzen Tag. Die Auswahl bleibt auf dem Gerät gespeichert.

// MARK: - Modell

/// Gewählte Pläne der Mehrfachansicht mit je einem eigenen Planmodell; Änderungen der Modelle werden weitergereicht.
@MainActor
final class Mehrfachplaene: ObservableObject {
    nonisolated static let schluessel = "planMehrfach"
    nonisolated static let hoechstens = 6

    @Published private(set) var auswahl: [PlanAuswahl] = []
    /// Filter der Anzeige (wie im Plan der Seite) für alle gewählten Pläne
    var filter = Planfilter() {
        didSet {
            guard filter != oldValue else { return }
            for m in modelle.values { m.filter = filter }
        }
    }

    private var modelle: [String: Planmodell] = [:]
    private var abos: [String: AnyCancellable] = [:]
    private weak var zustand: AppZustand?
    private var eingerichtet = false

    nonisolated init() {}

    var aktiv: Bool { !auswahl.isEmpty }
    /// Kennung der Auswahl (Laden je Woche)
    var kennung: String { auswahl.map(\.id).joined(separator: ",") }

    func einrichten(zustand: AppZustand) {
        self.zustand = zustand
        guard !eingerichtet else { return }
        eingerichtet = true
        setzen(Mehrfachplaene.gespeichert())
    }

    func modell(_ plan: PlanAuswahl) -> Planmodell? { modelle[plan.id] }

    func enthaelt(_ plan: PlanAuswahl) -> Bool { auswahl.contains { $0.id == plan.id } }

    func hinzufuegen(_ plan: PlanAuswahl) {
        guard !enthaelt(plan), auswahl.count < Mehrfachplaene.hoechstens else { return }
        setzen(auswahl + [plan])
    }

    func entfernen(_ plan: PlanAuswahl) {
        setzen(auswahl.filter { $0.id != plan.id })
    }

    func leeren() {
        setzen([])
    }

    /// Ganze Auswahl ersetzen (Mehrfachauswahl im Blatt „Auswahl“).
    func ersetzen(_ liste: [PlanAuswahl]) {
        setzen(Array(liste.prefix(Mehrfachplaene.hoechstens)))
    }

    /// Alle gewählten Pläne einer Woche laden.
    func laden(montag: String, erzwingen: Bool = false) async {
        for p in auswahl {
            await modelle[p.id]?.laden(montag: montag, erzwingen: erzwingen)
        }
    }

    /// Ziehen zum Aktualisieren: Zwischenspeicher veralten, alle gewählten Pläne dieser Woche sofort neu laden.
    func aktualisieren(montag: String) async {
        Kachelspeicher.veralten()
        await laden(montag: montag, erzwingen: true)
    }

    /// Ältester Stand der gezeigten (noch nicht bestätigten) Pläne dieser Woche; nil = alle frisch.
    func standHinweis(montag: String) -> Date? {
        auswahl.compactMap { modelle[$0.id]?.standHinweis(montag: montag) }.min()
    }

    private func setzen(_ liste: [PlanAuswahl]) {
        var neu: [String: Planmodell] = [:]
        for p in liste {
            if let m = modelle[p.id] {
                neu[p.id] = m
                continue
            }
            let m = Planmodell()
            if let zustand { m.einrichten(zustand: zustand) }
            m.filter = filter
            m.waehlen(p)
            neu[p.id] = m
            abos[p.id] = m.objectWillChange.sink { [weak self] _ in
                self?.objectWillChange.send()
            }
        }
        for id in Array(modelle.keys) where neu[id] == nil {
            abos[id] = nil
        }
        modelle = neu
        auswahl = liste
        Mehrfachplaene.speichern(liste)
    }

    private static func gespeichert() -> [PlanAuswahl] {
        guard let daten = UserDefaults.standard.data(forKey: schluessel),
              let liste = try? JSONDecoder().decode([PlanAuswahl].self, from: daten) else { return [] }
        return Array(liste.prefix(hoechstens))
    }

    private static func speichern(_ liste: [PlanAuswahl]) {
        if let daten = try? JSONEncoder().encode(liste) {
            UserDefaults.standard.set(daten, forKey: schluessel)
        }
    }
}

// MARK: - Leiste mit den gewählten Plänen

/// Leiste über dem Raster: gewählte Pläne als ruhige Felder mit „×“, dahinter „Hinzufügen …“ und „Alle entfernen“.
struct Mehrfachleiste: View {
    @ObservedObject var mehrfach: Mehrfachplaene
    let hinzufuegen: () -> Void

    private let form = RoundedRectangle(cornerRadius: 6, style: .continuous)

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(mehrfach.auswahl) { p in
                    HStack(spacing: 2) {
                        Text(p.anzeige)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Farben.text)
                            .lineLimit(1)
                        Button {
                            Haptik.auswahl()
                            withAnimation(.snappy(duration: 0.2)) { mehrfach.entfernen(p) }
                        } label: {
                            Image(systemName: "xmark")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(Farben.text2)
                                .frame(width: 28, height: 32)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(p.anzeige) entfernen")
                    }
                    .padding(.leading, 10)
                    .frame(height: 32)
                    .background(Farben.primaerFlaeche, in: form)
                    .overlay { form.strokeBorder(Farben.primaerRand, lineWidth: 1) }
                }
                Button(action: hinzufuegen) {
                    Text(mehrfach.auswahl.isEmpty ? "Pläne nebeneinander …" : "Hinzufügen …")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Farben.akzent)
                        .padding(.horizontal, 12)
                        .frame(height: 32)
                        .background(Farben.flaeche, in: form)
                        .overlay { form.strokeBorder(Farben.randStark, lineWidth: 1) }
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(mehrfach.auswahl.count >= Mehrfachplaene.hoechstens)
                .accessibilityHint("Klasse, Lehrkraft oder Raum neben den anderen Plänen zeigen")
                if mehrfach.auswahl.count > 1 {
                    Button {
                        Haptik.auswahl()
                        withAnimation(.snappy(duration: 0.2)) { mehrfach.leeren() }
                    } label: {
                        Text("Alle entfernen")
                            .font(.subheadline)
                            .foregroundStyle(Farben.text2)
                            .padding(.horizontal, 8)
                            .frame(height: 32)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, Stilmass.rand)
            .padding(.vertical, Stilmass.raster)
        }
        .scrollIndicators(.hidden)
        .background(Farben.grund)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Farben.rand).frame(height: 0.5)
        }
    }
}

// MARK: - Raster mehrerer Pläne

/// Gewählter Plan mit seinem Modell und seiner Lage in der Tagesspalte.
private struct Mehrfacheintrag: Identifiable {
    let index: Int
    let plan: PlanAuswahl
    let modell: Planmodell

    var id: String { plan.id }
}

/// Veranstaltung, die über den ganzen Tag gezeichnet wird.
private struct Tagesereignis: Identifiable {
    let kachel: Kachel
    let tag: Tagesansicht
    let plan: PlanAuswahl
    let y: CGFloat
    let h: CGFloat

    var id: String { Rastergeometrie.ereignisSchluessel(kachel) }
}

struct Mehrfachraster: View {
    @ObservedObject var mehrfach: Mehrfachplaene
    let montag: String
    let raum: Namespace.ID?
    let antippen: Rasterantippen
    let tagOeffnen: (String) -> Void
    let parallele: (Parallelgruppe) -> Void
    var verfuegbar: CGSize = .zero
    /// Nur dieser Tag (Tagesansicht als Raster); nil = die ganze Woche
    var nurTag: String? = nil

    @AppStorage(Wochendichte.schluessel) private var dichte: Double = Wochendichte.normal
    @AppStorage(Rastermass.parallelSchluessel) private var parallelSichtbar: Int = 1
    @ScaledMetric(relativeTo: .caption) private var zeitBreite: CGFloat = 38

    /// Zeile mit den Namen der Pläne unter dem Tageskopf
    private let unterkopf: CGFloat = 18
    /// Abstand zwischen den Unterspalten eines Tages
    private let innenLuecke: CGFloat = 2

    private var kopfHoehe: CGFloat { Rastermass.datumHoehe + unterkopf }

    private var eintraege: [Mehrfacheintrag] {
        var liste: [Mehrfacheintrag] = []
        for p in mehrfach.auswahl {
            if let m = mehrfach.modell(p) { liste.append(Mehrfacheintrag(index: liste.count, plan: p, modell: m)) }
        }
        return liste
    }

    private var tage: [String] {
        if let nurTag { return [nurTag] }
        guard let erster = eintraege.first else { return [] }
        return erster.modell.tage(montag: montag)
    }

    private var raster: [Rasterzeit] {
        for e in eintraege {
            for d in e.modell.tage(montag: montag) {
                if let t = e.modell.tag(d), !t.raster.isEmpty { return t.raster }
            }
        }
        return []
    }

    private var laedt: Bool {
        eintraege.contains { $0.modell.plan(montag: montag) == nil }
    }

    var body: some View {
        Group {
            if !raster.isEmpty {
                flaeche
                    .padding(.horizontal, 4)
            } else if laedt {
                Platzhaltertag()
            } else {
                Hinweisfeld(titel: "Kein Unterricht", text: "In dieser Woche ist in den gewählten Plänen kein Unterricht geplant.",
                            symbol: "sun.max", minHoehe: 160, flaeche: Farben.flaeche)
                    .padding(.horizontal, Stilmass.rand)
            }
        }
        .padding(.top, 2)
    }

    private var flaeche: some View {
        let liste = eintraege
        let ansichten = liste.flatMap { e in tage.compactMap { e.modell.tag($0) } }
        let letzte = Rastergeometrie.letzteZeile(ansichten, raster: raster)
        let zeile = Rastergeometrie.zeilenHoehe(raster: raster, bis: letzte, verfuegbar: verfuegbar, kopf: kopfHoehe, dichte: dichte)
        let geo = Rastergeometrie(raster: raster, zeile: zeile)
        let l = geo.lage
        let kopf = kopfHoehe
        return GeometryReader { g in
            let spalten = max(tage.count, 1)
            let breite = max(0, (g.size.width - zeitBreite - CGFloat(spalten) * Rastermass.spaltenLuecke) / CGFloat(spalten))
            ZStack(alignment: .topLeading) {
                Rastergrund(geo: geo)
                    .frame(width: g.size.width, height: l.hoehe)
                    .offset(y: kopf)
                ForEach(Array(raster.enumerated()), id: \.offset) { i, r in
                    RasterZeitZelle(zeit: r, hoehe: l.zeile)
                        .frame(width: zeitBreite, height: l.zeile)
                        .offset(x: 0, y: kopf + l.oben[i])
                }
                WochenJetztLinie(geo: geo, tage: tage, zeitBreite: zeitBreite, breite: breite, gesamt: g.size.width, kopf: kopf,
                                 nurPunkt: false)
                ForEach(Array(tage.enumerated()), id: \.element) { i, d in
                    tagesblock(d, eintraege: liste, breite: breite, geo: geo)
                        .frame(width: breite, height: kopf + l.hoehe, alignment: .topLeading)
                        .offset(x: Rastermass.spaltenX(i, breite: breite, zeit: zeitBreite), y: 0)
                }
                WochenJetztLinie(geo: geo, tage: tage, zeitBreite: zeitBreite, breite: breite, gesamt: g.size.width, kopf: kopf,
                                 nurPunkt: true)
            }
            .frame(width: g.size.width, height: kopf + l.hoehe, alignment: .topLeading)
        }
        .frame(height: kopf + l.hoehe)
        .animation(.snappy(duration: 0.2), value: dichte)
    }

    private func tagesblock(_ d: String, eintraege liste: [Mehrfacheintrag], breite: CGFloat, geo: Rastergeometrie) -> some View {
        let n = max(liste.count, 1)
        let unterbreite = max(0, (breite - CGFloat(n - 1) * innenLuecke) / CGFloat(n))
        let heute = Datumsformat.istHeute(d)
        let gemeinsam = gemeinsameEreignisse(d, eintraege: liste, geo: geo)
        let ausgelassen = Set(gemeinsam.map(\.id))
        let kopf = kopfHoehe
        return ZStack(alignment: .topLeading) {
            if heute {
                Rectangle()
                    .fill(Farben.akzent.opacity(0.06))
                    .frame(width: breite, height: geo.lage.hoehe)
                    .offset(y: kopf)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
            RasterTageskopf(datum: d, tag: liste.first?.modell.tag(d), breite: breite, hoehe: Rastermass.datumHoehe) {
                tagOeffnen(d)
            }
            ForEach(liste) { e in
                Text(e.plan.anzeige)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Farben.text2)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .frame(width: unterbreite, height: unterkopf)
                    .offset(x: CGFloat(e.index) * (unterbreite + innenLuecke), y: Rastermass.datumHoehe - 2)
                    .accessibilityHidden(true)
                if let t = e.modell.tag(d) {
                    Tagesspalte(tag: t, geo: geo, breite: unterbreite, raum: raum, plan: e.plan, ausgelassen: ausgelassen,
                                sichtbar: Rastermass.sichtbar(parallelSichtbar, breite: unterbreite, tag: nurTag != nil),
                                antippen: antippen, parallele: parallele)
                        .offset(x: CGFloat(e.index) * (unterbreite + innenLuecke), y: kopf)
                }
            }
            ForEach(gemeinsam) { g in
                ereignisBlock(g, breite: breite, geo: geo)
            }
        }
    }

    private func ereignisBlock(_ g: Tagesereignis, breite: CGFloat, geo: Rastergeometrie) -> some View {
        let h = max(0, g.h - 2 * Rastermass.einzug)
        let quelle = "woche-\(g.kachel.id.uuidString)"
        return Button {
            antippen(g.kachel, g.tag, quelle, g.plan)
        } label: {
            Ereigniskarte(kachel: g.kachel, hoehe: h, breite: breite, vergangen: Tagesansicht.vergangen(g.kachel, jetzt: Date()))
                .zoomQuelle(quelle, in: raum)
        }
        .buttonStyle(KachelDruckStil())
        .stundenMenue(g.kachel) { antippen(g.kachel, g.tag, quelle, g.plan) }
        .frame(width: breite, height: h)
        .offset(x: 0, y: kopfHoehe + g.y + Rastermass.einzug)
    }

    /// Veranstaltungen und Termine des Tages (aus allen Plänen, je einmal), zu deren Zeit in keinem gewählten Plan
    /// Unterricht liegt – genau nach ihrer Uhrzeit (auch ab bzw. bis mitten in einer Stunde).
    private func gemeinsameEreignisse(_ d: String, eintraege liste: [Mehrfacheintrag], geo: Rastergeometrie) -> [Tagesereignis] {
        var stunden: [(y: CGFloat, h: CGFloat)] = []
        var kandidaten: [Tagesereignis] = []
        for e in liste {
            guard let t = e.modell.tag(d), t.freiText == nil else { continue }
            for k in t.kacheln + t.ganztags {
                if Rastergeometrie.istEreignis(k) {
                    guard let l = geo.lageGenau(k) else { continue }
                    let schluessel = Rastergeometrie.ereignisSchluessel(k)
                    if !kandidaten.contains(where: { $0.id == schluessel }) {
                        kandidaten.append(Tagesereignis(kachel: k, tag: t, plan: e.plan, y: l.y, h: l.h))
                    }
                } else if !k.inPause && k.karte != nil, let l = geo.lageGenau(k) {
                    stunden.append((l.y, l.h))
                }
            }
        }
        let frei = kandidaten.filter { g in !stunden.contains { $0.y < g.y + g.h - 1 && g.y < $0.y + $0.h - 1 } }
        // Gleichzeitige gemeinsame Termine würden sich überdecken: dann zeichnet jede Unterspalte sie selbst
        return frei.filter { g in !frei.contains { o in o.id != g.id && o.y < g.y + g.h - 1 && g.y < o.y + o.h - 1 } }
    }
}
