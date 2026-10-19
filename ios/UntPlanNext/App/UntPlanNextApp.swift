import SwiftUI

/// EduOrga für iPhone und iPad – eine App für alle Schulen (zentral im App Store); jede Schule betreibt ihr EduOrga
/// selbst, die App verbindet sich mit der Adresse der Schule. Technisch: Ziel UntPlanNext, Bundle-ID de.untplan.next,
/// URL-Schema „untplannext“. Spricht direkt die JSON-API von EduOrga Web (/api/app) an.
@main
struct UntPlanNextApp: App {
    /// Kurzbefehle am App-Symbol, Hintergrund-Prüfung des Plans, Mitteilungen
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var zustand = AppZustand()
    @StateObject private var favoriten = Favoriten()

    var body: some Scene {
        WindowGroup {
            HauptView()
                .environmentObject(zustand)
                .environmentObject(favoriten)
                .tint(Farben.akzent)
        }
    }
}
