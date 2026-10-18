import SwiftUI

/// UntPlan Next – eigenständige App neben „UntPlan“ (eigene Bundle-ID, eigenes URL-Schema „untplannext“, eigene Konten
/// und Einstellungen). Spricht direkt die JSON-API von UntPlan Web an.
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
