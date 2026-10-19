import Foundation

/// Datenschutz in der App: Datenschutzhinweise der Schule (Seite `/datenschutz` von EduOrga Web, ohne Anmeldung) und
/// datensparsame lokale Mitteilungen. Standard: Mitteilungen auf dem Sperrbildschirm nennen keine Namen, Fächer, Klassen
/// oder Räume („Plan geändert – Einzelheiten in der App“); „Einzelheiten in Mitteilungen“ (Profil → Einstellungen)
/// schaltet die ausführlichen Texte ein. Die App enthält keine Analyse- oder Werbebibliotheken und sendet nichts an
/// Dritte; Zugangsdaten liegen im Schlüsselbund (nur dieses Gerät, nach dem ersten Entsperren).
enum Datenschutz {
    /// Schalter „Einzelheiten in Mitteilungen“ (UserDefaults, Standard: aus).
    static let detailsSchluessel = "mitteilungenMitDetails"

    static var mitDetails: Bool {
        UserDefaults.standard.object(forKey: detailsSchluessel) as? Bool ?? false
    }

    /// Allgemeiner Text statt der Einzelheiten.
    static let allgemeinerText = "Einzelheiten in der App."

    /// Datenschutzhinweise einer Schule (normalisierte Adresse ohne abschließenden Schrägstrich).
    static func hinweise(server: String) -> URL? {
        let a = server.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !a.isEmpty else { return nil }
        return URL(string: (a.hasSuffix("/") ? String(a.dropLast()) : a) + "/datenschutz")
    }

    /// Datenschutzhinweise der aktuellen Schule.
    static var hinweiseAktuell: URL? { hinweise(server: ApiClient.shared.serverAdresse) }
}
