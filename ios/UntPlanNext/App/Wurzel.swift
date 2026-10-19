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
            if zustand.phase == .startet { await zustand.starten() }
        }
        .onChange(of: szene) { _, neu in
            if neu == .active && zustand.phase == .angemeldet {
                Task {
                    await zustand.aktualisieren()
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
            tagOeffnen()
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
            zustand.reiter = .suche
        }
    }
}

/// Reiter der Tab-Leiste. Profil, Konten und Einstellungen („Mehr“) öffnen sich als Blatt über den Avatar oben rechts.
enum AppReiter: Hashable, CaseIterable {
    case heute
    case plan
    case postfach
    case suche

    var titel: String {
        switch self {
        case .heute: return "Heute"
        case .plan: return "Plan"
        case .postfach: return "Postfach"
        case .suche: return "Suche"
        }
    }

    /// SF Symbol der Tab-Leiste.
    var symbol: String {
        switch self {
        case .heute: return "sun.max"
        case .plan: return "calendar"
        case .postfach: return "tray"
        case .suche: return "magnifyingglass"
        }
    }
}

/// Tab-Leiste des Systems: Heute · Plan · Postfach · Suche (Reiter mit der Rolle „Suche“ – ab iOS 26 als eigene
/// Glasfläche rechts, das Suchfeld wandert in die Leiste). Ab iOS 26 klappt die Leiste beim Rollen nach unten ein.
/// Der Zähler ungelesener Mitteilungen steht als Plakette am Postfach; erneutes Antippen von „Plan“ führt zu heute
/// zurück. Profil und Einstellungen als Blatt (Avatar oben rechts in jedem Reiter).
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
            Tab("Suche", systemImage: "magnifyingglass", value: AppReiter.suche, role: .search) {
                SucheView()
            }
        }
        .tabLeisteEinklappbar()
        .tint(Farben.akzent)
        .sensoryFeedback(.selection, trigger: zustand.reiter)
        .sheet(isPresented: $zustand.mehrOffen) {
            MehrView()
                .environmentObject(zustand)
                .environmentObject(favoriten)
        }
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
