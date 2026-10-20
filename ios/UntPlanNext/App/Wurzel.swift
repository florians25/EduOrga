import SwiftUI

/// Wurzelansicht: Einrichtung bzw. Anmeldung (Schuladresse, dann Konto) oder die App mit der Tab-Leiste.
@MainActor
struct HauptView: View {
    @EnvironmentObject var zustand: AppZustand
    @Environment(\.scenePhase) private var szene

    var body: some View {
        Group {
            switch zustand.phase {
            case .startet:
                Startbild()
            case .abgemeldet:
                AnmeldungView()
            case .angemeldet:
                // Neuer Aufbau je Konto: beim Kontowechsel starten alle Reiter frisch (keine Daten des vorigen Kontos)
                AppTabView()
                    .id(zustand.kontoStand)
            }
        }
        .task {
            Schreibpuffer.shared.beobachten()
            if zustand.phase == .startet { await zustand.starten() }
            if zustand.phase == .angemeldet { await Schreibpuffer.shared.senden() }
        }
        .onChange(of: szene) { _, neu in
            if neu == .active && zustand.phase == .angemeldet {
                // Plan- und Vertretungsdaten sofort frisch laden (Zwischenspeicher nur als Platzhalter mit „Stand“)
                zustand.frischLaden()
                Task {
                    await zustand.aktualisieren()
                    // Offline gespeicherte Klassenbuch-Änderungen nachsenden
                    await Schreibpuffer.shared.senden()
                    // Lehrkräfte: eigenen Plan auf Änderungen prüfen (Mitteilung bei Entfall, Vertretung, Raumänderung …)
                    await zustand.planPruefen()
                }
            }
            if neu == .background && zustand.darfPlanmitteilungen {
                Planmitteilungen.planen()
            }
        }
        // Kontowechsel: Plan des neuen Kontos prüfen (eigener Stand je Konto)
        .onChange(of: zustand.kontoStand) { _, _ in
            guard zustand.phase == .angemeldet else { return }
            Task { await zustand.planPruefen() }
        }
        // Eigene Änderung in der App (z. B. Raum in den Stundendetails ersetzt): Stand übernehmen, nicht melden
        .onChange(of: zustand.planGeaendert) { _, _ in
            guard zustand.darfPlanmitteilungen else { return }
            Task { _ = await Planpruefer.shared.pruefen(melden: false, erzwingen: true) }
        }
        // Angetippte Mitteilung über eine Planänderung: Tag im eigenen Plan öffnen
        .onReceive(NotificationCenter.default.publisher(for: Planmitteilungen.tippBenachrichtigung)) { _ in
            if zustand.phase == .angemeldet { zustand.frischLaden() }
            tagOeffnen()
        }
        // Push bzw. Mitteilung eingegangen: Plan und Heute sofort frisch laden
        .onReceive(NotificationCenter.default.publisher(for: Planmitteilungen.frischBenachrichtigung)) { _ in
            if zustand.phase == .angemeldet { zustand.frischLaden() }
        }
        // Kurzbefehle am App-Symbol: sofort bzw. nach der Anmeldung ausführen
        .onReceive(NotificationCenter.default.publisher(for: Schnellaktion.benachrichtigung)) { _ in
            schnellaktionAusfuehren()
        }
        .onChange(of: zustand.phase) { _, neu in
            schnellaktionAusfuehren()
            tagOeffnen()
            // Nach der Anmeldung bzw. beim Start einmal den eigenen Plan prüfen (Lehrkräfte) und das Gerät für
            // Push-Mitteilungen beim Server hinterlegen
            if neu == .angemeldet {
                // Einrichtungslink beim Start erhalten: Profil öffnet die Konten mit „Konto hinzufügen“
                if zustand.einrichtungsAdresse != nil { zustand.mehrOffen = true }
                zustand.pushTokenMelden()
                Task { await zustand.planPruefen() }
            }
        }
        .onAppear {
            schnellaktionAusfuehren()
            tagOeffnen()
        }
        // Einrichtungslink „untplannext://einrichten?server=…“ (z. B. aus einem Elternbrief bzw. QR-Code der Schule)
        .onOpenURL { url in
            _ = zustand.einrichtungslinkOeffnen(url)
        }
    }

    private func tagOeffnen() {
        guard zustand.phase == .angemeldet, let tag = Planmitteilungen.ausstehenderTag else { return }
        Planmitteilungen.ausstehenderTag = nil
        zustand.tagAnfrage = tag
        zustand.reiter = .plan
    }

    private func schnellaktionAusfuehren() {
        guard zustand.phase == .angemeldet, let aktion = Schnellaktion.ausstehend else { return }
        Schnellaktion.ausstehend = nil
        switch aktion {
        case .heute:
            zustand.reiter = .heute
        case .mitteilungen:
            zustand.reiter = .postfach
        case .stundenplan:
            zustand.schnellaktion = aktion
            zustand.reiter = .plan
        case .suche:
            zustand.sucheOffen = true
        }
    }
}

/// Reiter der Tab-Leiste: vier Arbeitsbereiche und „Profil“ (Konten, Einstellungen, Abmelden). Die Suche nach Plänen
/// öffnet sich als Blatt über die Lupe oben rechts.
enum AppReiter: Hashable, CaseIterable {
    case heute
    case plan
    case postfach
    case schule
    case profil

    var titel: String {
        switch self {
        case .heute: return "Heute"
        case .plan: return "Plan"
        case .postfach: return "Postfach"
        case .schule: return "Schule"
        case .profil: return "Profil"
        }
    }

    /// SF Symbol der Tab-Leiste.
    var symbol: String {
        switch self {
        case .heute: return "sun.max"
        case .plan: return "calendar"
        case .postfach: return "tray"
        case .schule: return "square.grid.2x2"
        case .profil: return "person.crop.circle"
        }
    }
}

/// Tab-Leiste des Systems mit wenigen, festen Reitern: Heute · Plan · Postfach · Schule · Profil (Schule: Klassenbuch,
/// Melden, Prüfungen, Vertretungsplan, Sprechtag, Hausaufgaben, Abwesenheiten je nach Rolle; Profil: Konten, Termine,
/// Einstellungen, Abmelden). Ab iOS 26 klappt die Leiste beim Rollen nach unten ein. Der Zähler ungelesener Mitteilungen
/// steht als Plakette am Postfach; erneutes Antippen von „Plan“ führt zu heute zurück. Die Suche nach Plänen öffnet sich
/// als Blatt (Lupe oben rechts in jedem Reiter, im Plan neben „Heute“).
@MainActor
struct AppTabView: View {
    @EnvironmentObject var zustand: AppZustand
    @EnvironmentObject var favoriten: Favoriten

    /// Auswahl des Reiters über AppZustand (erneutes Antippen von „Plan“ zählt `stundenplanHeute` hoch).
    private var reiterBindung: Binding<AppReiter> {
        Binding(get: { zustand.reiter }, set: { zustand.reiterWaehlen($0) })
    }

    var body: some View {
        TabView(selection: reiterBindung) {
            Tab("Heute", systemImage: "sun.max", value: AppReiter.heute) {
                HeuteView()
            }
            Tab("Plan", systemImage: "calendar", value: AppReiter.plan) {
                PlanView()
            }
            Tab("Postfach", systemImage: "tray", value: AppReiter.postfach) {
                MitteilungenView()
            }
            .badge(zustand.ungelesen)
            Tab("Schule", systemImage: "square.grid.2x2", value: AppReiter.schule) {
                SchuleView()
            }
            Tab("Profil", systemImage: "person.crop.circle", value: AppReiter.profil) {
                MehrView()
            }
        }
        .tabLeisteEinklappbar()
        .tint(Farben.akzent)
        .environment(\.kartendarstellung, zustand.darstellung)
        .sensoryFeedback(.selection, trigger: zustand.reiter)
        // Profil öffnen (Einrichtungslink, Kurzbefehle, ältere Aufrufe): zum Reiter „Profil“ wechseln
        .onChange(of: zustand.mehrOffen) { _, neu in
            if neu { profilZeigen() }
        }
        .onAppear {
            if zustand.mehrOffen { profilZeigen() }
        }
        .sheet(isPresented: $zustand.sucheOffen) {
            SucheView(alsBlatt: true)
                .environmentObject(zustand)
                .environmentObject(favoriten)
                .environment(\.kartendarstellung, zustand.darstellung)
                .presentationDetents([.large])
        }
    }

    private func profilZeigen() {
        zustand.mehrOffen = false
        zustand.sucheOffen = false
        zustand.reiter = .profil
    }
}

/// Startbild, solange die Sitzung geprüft wird: Monogramm, Wortmarke, Slogan und ein schmaler Ladebalken.
struct Startbild: View {
    var body: some View {
        VStack(spacing: 14) {
            Spacer()
            EdoMonogramm(groesse: 72)
            EdoWortmarke(schrift: .largeTitle)
            Text(Marke.slogan)
                .font(.subheadline)
                .foregroundStyle(Farben.text2)
            Ladebalken(aktiv: true, hoehe: 3)
                .frame(width: 120)
                .clipShape(Capsule())
                .padding(.top, 6)
            Text("Verbindung wird hergestellt …")
                .font(.footnote)
                .foregroundStyle(Farben.text3)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Farben.grund.ignoresSafeArea())
        .accessibilityElement(children: .combine)
    }
}
