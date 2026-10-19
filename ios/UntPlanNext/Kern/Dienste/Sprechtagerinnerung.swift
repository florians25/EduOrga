import Foundation
import UserNotifications

/// Erinnerungen an Sprechtagstermine als lokale Mitteilungen (für Eltern und Lehrkräfte): je gebuchtem Termin eine
/// Mitteilung „in X Minuten“ vor Beginn, bei Lehrkräften zusätzlich eine vor dem ersten Termin des Tages. Die Vorlaufzeit
/// stellt man im Menü des Sprechtags ein (Aus, 10, 15, 30, 60 Minuten). Bei jedem Laden des Sprechtags werden die
/// Erinnerungen dieses Sprechtags neu geplant – abgesagte Termine verschwinden so automatisch.
enum Sprechtagerinnerung {
    static let schluessel = "sprechtagErinnerung"
    static let stufen = [0, 10, 15, 30, 60]

    /// Vorlauf in Minuten (0 = aus); Standard 15.
    static var vorlauf: Int {
        get { UserDefaults.standard.object(forKey: schluessel) as? Int ?? 15 }
        set { UserDefaults.standard.set(newValue, forKey: schluessel) }
    }

    /// Ein zu erinnernder Termin.
    struct Termin: Sendable {
        let id: Int
        let beginn: String
        let ende: String
        let titel: String
        let ort: String
    }

    private static func praefix(_ sprechtag: Int) -> String { "sprechtag-\(sprechtag)-" }

    /// Zeitpunkt aus Datum (yyyy-MM-dd) und Uhrzeit (HH:mm).
    static func zeitpunkt(datum: String, uhrzeit: String) -> Date? {
        guard let tag = Datumsformat.datum(datum) else { return nil }
        let teile = uhrzeit.split(separator: ":").compactMap { Int($0) }
        guard teile.count >= 2 else { return nil }
        return Datumsformat.kalender.date(bySettingHour: teile[0], minute: teile[1], second: 0, of: tag)
    }

    /// Erinnerungen eines Sprechtags neu planen (vorhandene dieses Sprechtags werden ersetzt).
    static func planen(sprechtag: Int, name: String, datum: String, termine: [Termin], lehrkraft: Bool) async {
        let zentrale = UNUserNotificationCenter.current()
        let p = praefix(sprechtag)
        let wartend = await zentrale.pendingNotificationRequests().map(\.identifier).filter { $0.hasPrefix(p) }
        zentrale.removePendingNotificationRequests(withIdentifiers: wartend)
        let minuten = vorlauf
        guard minuten > 0, !termine.isEmpty else { return }
        let erlaubt = await zentrale.notificationSettings().authorizationStatus
        guard erlaubt == .authorized || erlaubt == .provisional || erlaubt == .ephemeral else { return }
        let jetzt = Date()
        let sortiert = termine.sorted { $0.beginn < $1.beginn }
        for t in sortiert {
            guard let beginn = zeitpunkt(datum: datum, uhrzeit: t.beginn) else { continue }
            let wann = beginn.addingTimeInterval(TimeInterval(-minuten * 60))
            guard wann > jetzt else { continue }
            let inhalt = UNMutableNotificationContent()
            inhalt.title = "Sprechtag um \(t.beginn) Uhr"
            // datensparsam (Standard): keine Namen von Kindern bzw. Lehrkräften auf dem Sperrbildschirm
            inhalt.body = Datenschutz.mitDetails ? [t.titel, t.ort].filter { !$0.isEmpty }.joined(separator: " · ") : Datenschutz.allgemeinerText
            inhalt.sound = .default
            inhalt.threadIdentifier = "sprechtag-\(sprechtag)"
            await hinzufuegen(zentrale, id: p + "\(t.id)", inhalt: inhalt, wann: wann)
        }
        // Lehrkräfte: Überblick vor dem ersten Termin
        if lehrkraft, let erster = sortiert.first, let beginn = zeitpunkt(datum: datum, uhrzeit: erster.beginn) {
            let wann = beginn.addingTimeInterval(TimeInterval(-(minuten + 30) * 60))
            if wann > jetzt {
                let inhalt = UNMutableNotificationContent()
                inhalt.title = name.isEmpty ? "Sprechtag heute" : name
                inhalt.body = sortiert.count == 1 ? "1 Termin, ab \(erster.beginn) Uhr" : "\(sortiert.count) Termine, ab \(erster.beginn) Uhr"
                inhalt.sound = .default
                inhalt.threadIdentifier = "sprechtag-\(sprechtag)"
                await hinzufuegen(zentrale, id: p + "ueberblick", inhalt: inhalt, wann: wann)
            }
        }
    }

    private static func hinzufuegen(_ zentrale: UNUserNotificationCenter, id: String, inhalt: UNMutableNotificationContent, wann: Date) async {
        let teile = Datumsformat.kalender.dateComponents([.year, .month, .day, .hour, .minute], from: wann)
        let ausloeser = UNCalendarNotificationTrigger(dateMatching: teile, repeats: false)
        try? await zentrale.add(UNNotificationRequest(identifier: id, content: inhalt, trigger: ausloeser))
    }
}
