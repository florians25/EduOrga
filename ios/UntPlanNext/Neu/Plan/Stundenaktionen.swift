import SwiftUI
import UIKit

// Gemeinsame Aktionen einer Stunde (Kontextmenü beim langen Drücken auf eine Kachel), der Profilknopf oben rechts
// und der Zwischenspeicher des Reiters „Heute“ (öffnet sofort mit dem letzten Stand, lädt im Hintergrund nach).

// MARK: - Zwischenspeicher „Heute“

/// Letzter Stand des Reiters „Heute“ (nur im Speicher; `AppZustand` leert ihn beim Kontowechsel bzw. Abmelden).
@MainActor
enum Heutespeicher {
    static var heute: Heute? = nil
    static var ferien: Ferienzeit? = nil
    static var sprechtage: [SprechtagKarte] = []

    static func leeren() {
        heute = nil
        ferien = nil
        sprechtage = []
    }
}

// MARK: - Pläne einer Stunde

enum Planziele {
    /// Räume (auch der ursprüngliche), Klassen und Lehrkräfte einer Stunde, deren Plan das Konto sehen darf.
    @MainActor
    static func fuer(_ karte: Karte, zustand: AppZustand) -> [PlanAuswahl] {
        var ergebnis: [PlanAuswahl] = []
        func hinzu(_ typ: String, _ werte: [Wert]) {
            for w in werte {
                for k in [w.k, w.alt ?? ""] where !k.isEmpty {
                    let plan = PlanAuswahl(typ: typ, element: k, name: k)
                    if !ergebnis.contains(where: { $0.id == plan.id }) { ergebnis.append(plan) }
                }
            }
        }
        hinzu("raum", karte.raeume)
        if zustand.istKollegium {
            hinzu("lehrer", karte.lehrer)
            hinzu("klasse", karte.klassen)
        } else if let eigene = zustand.benutzer?.element, !eigene.isEmpty {
            hinzu("klasse", karte.klassen.filter { $0.k.caseInsensitiveCompare(eigene) == .orderedSame })
        }
        return ergebnis
    }

    /// Menütitel („Raumplan R204“, „Plan von MEI“, „Plan der 7a“).
    static func titel(_ plan: PlanAuswahl) -> String {
        switch plan.typ {
        case "raum": return "Raumplan \(plan.anzeige)"
        case "lehrer": return "Plan von \(plan.anzeige)"
        default: return "Plan der \(plan.anzeige)"
        }
    }

    static func symbol(_ plan: PlanAuswahl) -> String {
        switch plan.typ {
        case "raum": return "mappin.and.ellipse"
        case "lehrer": return "person"
        default: return "person.3"
        }
    }
}

// MARK: - Text zum Teilen

enum Stundentext {
    /// „Mathematik (M) · Montag, 19. Oktober · 7:45–8:30 (1. Std.) · Raum R204 · MEI · Vertretung“
    static func teilen(_ k: Kachel) -> String {
        var zeilen: [String] = []
        let titel = k.fachname.isEmpty ? k.anzeigeTitel : "\(k.fachname) (\(k.anzeigeTitel))"
        zeilen.append(titel)
        zeilen.append("\(Datumsformat.anzeige(k.datum, "EEEE, d. MMMM")) · \(k.zeitText) (\(k.stundenText))")
        var orte: [String] = []
        if let r = k.zeile("raum"), !r.text.isEmpty { orte.append("Raum \(r.text)") }
        for z in k.personenzeilen where !z.text.isEmpty { orte.append(z.text) }
        if !orte.isEmpty { zeilen.append(orte.joined(separator: " · ")) }
        if let m = Statuslehre.merkmal(k) { zeilen.append(m.text) }
        if k.online { zeilen.append("Online-Unterricht") }
        return zeilen.joined(separator: "\n")
    }
}

// MARK: - Kontextmenü einer Stunde

/// Langes Drücken auf eine Kachel: Details öffnen, Raumplan, Plan der Lehrkraft bzw. Klasse, Teilen, Online-Link kopieren.
struct StundenMenue: ViewModifier {
    let kachel: Kachel
    let oeffnen: () -> Void
    @EnvironmentObject var zustand: AppZustand

    func body(content: Content) -> some View {
        content.contextMenu {
            Button {
                oeffnen()
            } label: {
                Label("Details öffnen", systemImage: "arrow.up.left.and.arrow.down.right")
            }
            if let karte = kachel.karte {
                let ziele = Planziele.fuer(karte, zustand: zustand)
                if !ziele.isEmpty {
                    Section {
                        ForEach(ziele) { plan in
                            Button {
                                Haptik.auswahl()
                                zustand.planZeigen(plan)
                            } label: {
                                Label(Planziele.titel(plan), systemImage: Planziele.symbol(plan))
                            }
                        }
                    }
                }
                Section {
                    ShareLink(item: Stundentext.teilen(kachel)) {
                        Label("Teilen", systemImage: "square.and.arrow.up")
                    }
                    if karte.online, let url = Karte.onlineURL(karte.onlineLink) {
                        Button {
                            UIPasteboard.general.string = url.absoluteString
                            Haptik.erfolg()
                        } label: {
                            Label("Online-Link kopieren", systemImage: "link")
                        }
                    }
                }
            }
        }
    }
}

extension View {
    /// Kontextmenü einer Stunde (langes Drücken).
    func stundenMenue(_ kachel: Kachel, oeffnen: @escaping () -> Void) -> some View {
        modifier(StundenMenue(kachel: kachel, oeffnen: oeffnen))
    }
}

// MARK: - Profilknopf

extension AppZustand {
    /// Initialen des Benutzers für den Profilknopf.
    var initialen: String {
        let name = benutzer?.name ?? ""
        let t = name.split(separator: " ").prefix(2).compactMap { $0.first.map { String($0).uppercased() } }.joined()
        return t.isEmpty ? "?" : t
    }
}

/// Lupe oben rechts in den Reitern: öffnet die Suche nach Plänen (Klasse, Lehrkraft, Raum) als Blatt.
struct SuchKnopf: View {
    @EnvironmentObject var zustand: AppZustand

    var body: some View {
        Button {
            Haptik.tippen()
            zustand.sucheOffen = true
        } label: {
            Image(systemName: "magnifyingglass")
        }
        .accessibilityLabel("Plan suchen")
    }
}

/// Avatar mit Initialen (früher oben rechts in jedem Reiter): öffnet Profil und Einstellungen.
struct ProfilKnopf: View {
    @EnvironmentObject var zustand: AppZustand

    var body: some View {
        Button {
            Haptik.tippen()
            zustand.mehrOffen = true
        } label: {
            Text(zustand.initialen)
                .font(.footnote.weight(.bold))
                .foregroundStyle(Farben.aufAkzent)
                .dynamicTypeSize(...DynamicTypeSize.xxLarge)
                .frame(width: 32, height: 32)
                .background(Farben.akzent, in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Profil und Einstellungen")
    }
}
