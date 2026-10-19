import Foundation
import Network
import SwiftUI

/// Gemerkter Schreibzugriff (z. B. Lehrstoff, Hausaufgabe, Klassenbucheintrag, Anwesenheit), der offline nicht
/// gesendet werden konnte. Gilt nur für das Konto, unter dem er entstanden ist.
struct GepufferterAuftrag: Codable, Identifiable, Sendable {
    var id = UUID()
    var konto: String
    var methode: String
    var pfad: String
    var koerper: Data?
    /// Beschreibung für die Anzeige, z. B. „Lehrstoff 7a M, 12.11.“
    var titel: String
    var erstellt = Date()
    /// Letzter Fehler beim Senden (Server lehnt ab) – dann bleibt der Auftrag zur Entscheidung stehen
    var fehler: String? = nil
}

/// Schreibpuffer für das Klassenbuch: Ohne Verbindung gespeicherte Änderungen werden gemerkt (UserDefaults) und
/// gesendet, sobald das Netz wieder da ist (Netzbeobachtung), die App in den Vordergrund kommt oder die Lehrkraft
/// „Jetzt senden“ wählt. Lehnt der Server einen Auftrag ab, bleibt er mit dem Fehler stehen und kann verworfen werden.
@MainActor
final class Schreibpuffer: ObservableObject {
    static let shared = Schreibpuffer()
    private static let schluessel = "schreibpuffer"

    @Published private(set) var auftraege: [GepufferterAuftrag] = []
    @Published private(set) var sendet = false

    private let beobachter = NWPathMonitor()
    private var beobachtet = false

    private init() {
        if let daten = UserDefaults.standard.data(forKey: Self.schluessel),
           let liste = try? JSONDecoder().decode([GepufferterAuftrag].self, from: daten) {
            auftraege = liste
        }
    }

    /// Aufträge des aktiven Kontos.
    var offen: [GepufferterAuftrag] {
        let konto = Kontenspeicher.aktivId ?? ""
        return auftraege.filter { $0.konto == konto }
    }

    var anzahl: Int { offen.count }

    func hinzufuegen(methode: String, pfad: String, koerper: Data?, titel: String) {
        let konto = Kontenspeicher.aktivId ?? ""
        auftraege.append(GepufferterAuftrag(konto: konto, methode: methode, pfad: pfad, koerper: koerper, titel: titel))
        speichern()
        beobachten()
    }

    func verwerfen(_ a: GepufferterAuftrag) {
        auftraege.removeAll { $0.id == a.id }
        speichern()
    }

    /// Konto vom Gerät entfernt (Abmelden): nicht gesendete Klassenbuch-Daten dieses Kontos löschen (Datenschutz,
    /// ohne Sitzung könnten sie ohnehin nicht mehr gesendet werden).
    func kontoEntfernen(_ konto: String) {
        auftraege.removeAll { $0.konto == konto }
        speichern()
    }

    /// Alle Aufträge des aktiven Kontos der Reihe nach senden; bei fehlender Verbindung aufhören.
    func senden() async {
        guard !sendet, !offen.isEmpty else { return }
        sendet = true
        defer { sendet = false }
        for a in offen {
            do {
                try await ApiClient.shared.auftragSenden(a)
                auftraege.removeAll { $0.id == a.id }
                speichern()
            } catch ApiFehler.nichtErreichbar(_) {
                return
            } catch ApiFehler.nichtAngemeldet {
                return
            } catch {
                if let i = auftraege.firstIndex(where: { $0.id == a.id }) {
                    auftraege[i].fehler = error.localizedDescription
                    speichern()
                }
            }
        }
    }

    /// Netz beobachten: Kommt die Verbindung zurück, wird gesendet.
    func beobachten() {
        guard !beobachtet else { return }
        beobachtet = true
        beobachter.pathUpdateHandler = { pfad in
            guard pfad.status == .satisfied else { return }
            Task { @MainActor in
                await Schreibpuffer.shared.senden()
            }
        }
        beobachter.start(queue: DispatchQueue(label: "de.untplan.next.netz"))
    }

    private func speichern() {
        if let daten = try? JSONEncoder().encode(auftraege) {
            UserDefaults.standard.set(daten, forKey: Self.schluessel)
        }
    }
}

/// Hinweis „n Änderungen warten auf Verbindung“ mit „Jetzt senden“ (Klassenbuch, Stundenansicht).
struct SchreibpufferLeiste: View {
    @ObservedObject var puffer = Schreibpuffer.shared

    var body: some View {
        if puffer.anzahl > 0 {
            HStack(spacing: 10) {
                Image(systemName: "icloud.and.arrow.up")
                    .foregroundStyle(Farben.warnung)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 1) {
                    Text(puffer.anzahl == 1 ? "1 Änderung wartet auf Verbindung" : "\(puffer.anzahl) Änderungen warten auf Verbindung")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Farben.text)
                    Text("Wird automatisch gesendet, sobald das Gerät wieder online ist.")
                        .font(.caption)
                        .foregroundStyle(Farben.text2)
                }
                Spacer(minLength: 4)
                if puffer.sendet {
                    ProgressView()
                } else {
                    Button("Senden") {
                        Task { await puffer.senden() }
                    }
                    .font(.subheadline.weight(.semibold))
                    .buttonStyle(.borderless)
                }
            }
            .padding(12)
            .background(Farben.warnungFlaeche, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            .accessibilityElement(children: .combine)
        }
    }
}
