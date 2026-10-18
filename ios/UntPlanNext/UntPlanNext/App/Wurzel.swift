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
                // Einrichtungslink beim Start erhalten: „Mehr“ öffnet die Konten mit „Konto hinzufügen“
                if zustand.einrichtungsAdresse != nil { zustand.reiter = .mehr }
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
        case .stundenplan, .suche:
            zustand.schnellaktion = aktion
            zustand.reiter = .plan
        }
    }
}

/// Reiter der Tab-Leiste.
enum AppReiter: Hashable, CaseIterable {
    case heute
    case plan
    case postfach
    case mehr

    var titel: String {
        switch self {
        case .heute: return "Heute"
        case .plan: return "Plan"
        case .postfach: return "Postfach"
        case .mehr: return "Mehr"
        }
    }

    /// SF Symbol der Tab-Leiste.
    var symbol: String {
        switch self {
        case .heute: return "sun.max"
        case .plan: return "calendar.day.timeline.left"
        case .postfach: return "tray"
        case .mehr: return "ellipsis.circle"
        }
    }
}

/// Tab-Leiste des Systems: Heute · Plan · Postfach · Mehr. Der Zähler ungelesener Mitteilungen steht als Plakette am
/// Postfach; erneutes Antippen von „Plan“ führt zur heutigen Woche zurück.
@MainActor
struct AppTabView: View {
    @EnvironmentObject var zustand: AppZustand

    /// Auswahl des Reiters über AppZustand (erneutes Antippen von „Plan“ zählt `stundenplanHeute` hoch).
    private var reiterBindung: Binding<AppReiter> {
        Binding(get: { zustand.reiter }, set: { zustand.reiterWaehlen($0) })
    }

    var body: some View {
        TabView(selection: reiterBindung) {
            HeuteView()
                .tabItem { Label(AppReiter.heute.titel, systemImage: AppReiter.heute.symbol) }
                .tag(AppReiter.heute)
            PlanView()
                .tabItem { Label(AppReiter.plan.titel, systemImage: AppReiter.plan.symbol) }
                .tag(AppReiter.plan)
            MitteilungenView()
                .tabItem { Label(AppReiter.postfach.titel, systemImage: AppReiter.postfach.symbol) }
                .badge(zustand.ungelesen)
                .tag(AppReiter.postfach)
            MehrView()
                .tabItem { Label(AppReiter.mehr.titel, systemImage: AppReiter.mehr.symbol) }
                .tag(AppReiter.mehr)
        }
        .tint(Farben.akzent)
        .sensoryFeedback(.selection, trigger: zustand.reiter)
    }
}

/// Startbild, solange die Sitzung geprüft wird: Wortmarke und ein schmaler Ladebalken.
struct Startbild: View {
    var body: some View {
        VStack(spacing: 14) {
            Spacer()
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text("UntPlan")
                    .font(.largeTitle.weight(.bold))
                    .foregroundStyle(Farben.text)
                Text("Next")
                    .font(.largeTitle.weight(.regular))
                    .foregroundStyle(Farben.akzent)
            }
            Ladebalken(aktiv: true, hoehe: 3)
                .frame(width: 120)
                .clipShape(Capsule())
            Text("Verbindung wird hergestellt …")
                .font(.subheadline)
                .foregroundStyle(Farben.text2)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Farben.grund.ignoresSafeArea())
        .accessibilityElement(children: .combine)
    }
}
