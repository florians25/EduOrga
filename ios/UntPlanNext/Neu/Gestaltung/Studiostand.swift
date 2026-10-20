import SwiftUI

// „Stand EduOrga Studio“: wann die Planung (EduOrga Studio) die Plandaten zuletzt übertragen hat – aus der Sitzung
// (`paket.empfangen`, neuere Server zusätzlich `paket.letzteVertretungen`; der neuere Zeitpunkt gilt). Davon klar getrennt
// steht, wann die App selbst zuletzt geladen hat („aktualisiert 14:35“). Ist der Studio-Stand an einem Schultag älter als
// 24 Stunden, erscheint ein ruhiger Hinweis in der Warnfarbe.

enum Studiostand {
    /// Letzte Änderung aus EduOrga Studio laut Sitzung.
    @MainActor
    static func stand(_ zustand: AppZustand) -> Date? {
        zustand.sitzung?.paket?.studioStand
    }

    /// Älter als 24 Stunden an einem Schultag (Montag bis Freitag)?
    static func veraltet(_ stand: Date, jetzt: Date = Date()) -> Bool {
        let wochentag = Datumsformat.kalender.component(.weekday, from: jetzt) // 1 = Sonntag
        guard (2...6).contains(wochentag) else { return false }
        return jetzt.timeIntervalSince(stand) > 24 * 3600
    }

    /// „gerade eben“, „vor 5 Min.“, „vor 3 Std.“, „vor 2 Tagen“.
    static func relativ(_ stand: Date, jetzt: Date = Date()) -> String {
        let minuten = Int(max(0, jetzt.timeIntervalSince(stand)) / 60)
        if minuten < 1 { return "gerade eben" }
        if minuten < 60 { return "vor \(minuten) Min." }
        let stunden = minuten / 60
        if stunden < 24 { return "vor \(stunden) Std." }
        let tage = stunden / 24
        return tage == 1 ? "vor 1 Tag" : "vor \(tage) Tagen"
    }

    /// „Di 20.10., 14:32“.
    static func voll(_ stand: Date) -> String {
        var tag = Datumsformat.anzeige(stand, "EE")
        while tag.hasSuffix(".") { tag.removeLast() }
        return "\(tag) \(Datumsformat.anzeige(stand, "dd.MM.")), \(Datumsformat.anzeige(stand, "HH:mm"))"
    }

    /// Für VoiceOver: „Dienstag, 20. Oktober, 14:32 Uhr“.
    static func gesprochen(_ stand: Date) -> String {
        Datumsformat.anzeige(stand, "EEEE, d. MMMM, HH:mm") + " Uhr"
    }
}

/// Zeile „Stand EduOrga Studio: vor 5 Min. · aktualisiert 14:35“; Antippen zeigt den genauen Zeitpunkt („Di 20.10., 14:32“).
/// `kapsel`: als schwebende Kapsel (Plan), sonst als schlichte Textzeile (Heute).
struct StudiostandZeile: View {
    let stand: Date?
    /// Wann die App die gezeigten Daten zuletzt geladen hat (nil = nicht anzeigen)
    var abgerufen: Date? = nil
    var kapsel: Bool = false

    @State private var genau = false

    var body: some View {
        TimelineView(.periodic(from: .now, by: 60)) { kontext in
            inhalt(jetzt: kontext.date)
        }
    }

    @ViewBuilder
    private func inhalt(jetzt: Date) -> some View {
        let alt = stand.map { Studiostand.veraltet($0, jetzt: jetzt) } ?? false
        Button {
            Haptik.auswahl()
            withAnimation(.easeInOut(duration: 0.15)) { genau.toggle() }
        } label: {
            HStack(alignment: .firstTextBaseline, spacing: 5) {
                Image(systemName: alt ? "exclamationmark.triangle" : "arrow.triangle.2.circlepath")
                    .font(.caption2.weight(.semibold))
                    .accessibilityHidden(true)
                Text(text(jetzt: jetzt, alt: alt))
                    .font(.caption.weight(.medium))
                    .monospacedDigit()
                    .lineLimit(kapsel ? 1 : 2)
                    .truncationMode(.tail)
                    .multilineTextAlignment(.leading)
            }
            .foregroundStyle(alt ? Farben.warnung : Farben.text2)
            .padding(.horizontal, kapsel ? 10 : 0)
            .padding(.vertical, kapsel ? 4 : 2)
            .frame(minHeight: kapsel ? 28 : 24)
            .background {
                if kapsel {
                    Capsule().fill(.regularMaterial)
                }
            }
            .overlay {
                if kapsel {
                    Capsule().strokeBorder(alt ? Farben.warnung.opacity(0.5) : Farben.rand, lineWidth: 0.5)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(vorlesetext(jetzt: jetzt, alt: alt))
        .accessibilityHint("Zeigt den genauen Zeitpunkt")
    }

    private func text(jetzt: Date, alt: Bool) -> String {
        var teile: [String] = []
        if let stand {
            teile.append("Stand EduOrga Studio: " + (genau ? Studiostand.voll(stand) : Studiostand.relativ(stand, jetzt: jetzt)))
            if alt { teile.append("älter als 24 Std.") }
        } else {
            teile.append("Stand EduOrga Studio unbekannt")
        }
        if let abgerufen {
            teile.append("aktualisiert \(Datumsformat.anzeige(abgerufen, "HH:mm"))")
        }
        return teile.joined(separator: " · ")
    }

    private func vorlesetext(jetzt: Date, alt: Bool) -> String {
        var teile: [String] = []
        if let stand {
            teile.append("Stand EduOrga Studio: \(Studiostand.gesprochen(stand)), \(Studiostand.relativ(stand, jetzt: jetzt))")
            if alt { teile.append("Achtung, älter als 24 Stunden") }
        } else {
            teile.append("Stand EduOrga Studio unbekannt")
        }
        if let abgerufen {
            teile.append("In der App aktualisiert um \(Datumsformat.anzeige(abgerufen, "HH:mm")) Uhr")
        }
        return teile.joined(separator: ". ")
    }
}
