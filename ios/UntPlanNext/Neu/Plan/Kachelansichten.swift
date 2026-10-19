import SwiftUI

// MARK: - Text einer Kachelzeile

/// Zeile einer Kachel als Text: geänderte Werte violett unterstrichen, wegfallende durchgestrichen. Wurde genau ein
/// Wert ersetzt (Vertretung, Raumänderung), steht „alt → neu“.
func kachelText(_ zeile: Kachelzeile, karte: Karte?) -> Text {
    var ergebnis = Text("")
    let werte: [Wert]
    switch zeile.schluessel {
    case "lehrer": werte = karte?.lehrer ?? []
    case "raum": werte = karte?.raeume ?? []
    case "klasse": werte = karte?.klassen ?? []
    default: werte = []
    }
    for teil in zeile.teile {
        let stueck: Text
        switch teil.stil {
        case .text:
            stueck = Text(teil.text)
        case .plakette:
            let ersetzt = werte.filter { $0.ersetzt && $0.k.caseInsensitiveCompare(teil.text) == .orderedSame }
            if zeile.teile.count == 1, ersetzt.count == 1, let alt = ersetzt[0].alt {
                stueck = Text(alt).strikethrough(true, color: Farben.text3).foregroundColor(Farben.text3)
                    + Text(" → ").foregroundColor(Farben.text3)
                    + Text(teil.text).foregroundColor(Farben.aenderung).underline(true, color: Farben.aenderung).fontWeight(.semibold)
            } else {
                stueck = Text(teil.text).foregroundColor(Farben.aenderung).underline(true, color: Farben.aenderung).fontWeight(.semibold)
            }
        case .weg:
            stueck = Text(teil.text).strikethrough(true, color: Farben.text3).foregroundColor(Farben.text3)
        case .offen:
            stueck = Text(teil.text).strikethrough(true, color: Farben.aenderung).foregroundColor(Farben.aenderung)
        }
        ergebnis = ergebnis + stueck + Text(teil.trenner)
    }
    return ergebnis
}

/// Werte als „alt → neu“ für die große Stundenansicht (alt durchgestrichen, neu violett unterstrichen; ohne
/// neuen Wert der alte Wert violett durchgestrichen).
func wechselText(_ werte: [Wert], trenner: String = ", ") -> Text {
    var ergebnis = Text("")
    var erster = true
    for w in werte {
        let alt = (w.alt ?? "").trimmingCharacters(in: .whitespaces)
        if w.k.isEmpty && alt.isEmpty { continue }
        if !erster { ergebnis = ergebnis + Text(trenner) }
        erster = false
        if w.ersetzt {
            ergebnis = ergebnis
                + Text(alt).strikethrough(true, color: Farben.text3).foregroundColor(Farben.text3)
                + Text(" → ").foregroundColor(Farben.text3)
                + Text(w.k).foregroundColor(Farben.aenderung).underline(true, color: Farben.aenderung)
        } else if w.k.isEmpty {
            ergebnis = ergebnis + Text(alt).strikethrough(true, color: Farben.aenderung).foregroundColor(Farben.aenderung)
        } else if w.geaendert {
            ergebnis = ergebnis + Text(w.plus ? "+" + w.k : w.k).foregroundColor(Farben.aenderung).underline(true, color: Farben.aenderung)
        } else {
            ergebnis = ergebnis + Text(w.k)
        }
    }
    return ergebnis
}

// MARK: - Kachel auf der Zeitachse

/// Stundenkachel der Zeitachse: Fachfarbe als Tönung, Fach groß, Raum als Feld rechts, darunter Lehrkraft bzw. Klasse;
/// Status als Plakette mit Symbol. Entfall schraffiert und durchgestrichen, Termine gestrichelt, Prüfung bernsteinfarben,
/// Änderungen mit violettem Rahmen. Je nach Höhe drei Fassungen (groß, mittel, eine Zeile).
struct ZeitKachel: View {
    let kachel: Kachel
    let hoehe: CGFloat
    let vergangen: Bool
    /// Weitere gleichzeitige Stunden, die hinter dieser liegen (Zählstreifen)
    var weitere: Int = 0
    /// Läuft gerade
    var laeuft: Bool = false

    @Environment(\.kartendarstellung) private var darstellung

    private var merkmal: Statusmerkmal? { Statuslehre.merkmal(kachel) }
    private var entfall: Bool { kachel.art == .entfall || (kachel.art == .aufsicht && kachel.aufsichtsstand == .entfall) }
    var body: some View {
        let w = Klassikstil.fuer(kachel, darstellung)
        let form = RoundedRectangle(cornerRadius: 4, style: .continuous)
        ViewThatFits(in: .vertical) {
            gross
            mittel
            klein
        }
        .padding(.leading, 11)
        .padding(.trailing, 8)
        .padding(.vertical, hoehe < 30 ? 2 : 6)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .klassikKarte(w, radius: 4)
        .overlay(alignment: .topTrailing) {
            if laeuft {
                Circle()
                    .fill(Farben.akzent)
                    .frame(width: 8, height: 8)
                    .overlay { Circle().strokeBorder(Farben.flaeche, lineWidth: 1.5) }
                    .padding(4)
                    .accessibilityHidden(true)
            }
        }
        .overlay(alignment: .bottomTrailing) {
            if weitere > 0 {
                Text("+\(weitere)")
                    .font(.caption2.weight(.bold))
                    .monospacedDigit()
                    .foregroundStyle(Farben.aufAkzent)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 1)
                    .background(Farben.akzent, in: Capsule())
                    .padding(4)
                    .accessibilityLabel("\(weitere) weitere Stunden zur selben Zeit")
            }
        }
        .opacity(vergangen ? 0.55 : 1)
        .contentShape(form)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(kachel.vorlesetext + (laeuft ? ", läuft gerade" : ""))
        .accessibilityAddTraits(.isButton)
    }

    // MARK: Fassungen

    private var titelText: some View {
        HStack(spacing: 5) {
            Text(kachel.fachText(darstellung))
                .font(.headline)
                .foregroundStyle(entfall ? Farben.text2 : Farben.text)
                .strikethrough(entfall, color: Farben.entfall)
                .lineLimit(1)
        }
    }

    @ViewBuilder
    private var raumFeld: some View {
        if let raum = kachel.zeile("raum"), !raum.text.isEmpty {
            kachelText(raum, karte: kachel.karte)
                .font(.subheadline.weight(.medium))
                .monospacedDigit()
                .foregroundStyle(Farben.text)
                .strikethrough(entfall, color: Farben.entfall)
                .lineLimit(1)
                .padding(.horizontal, 6)
                .padding(.vertical, 1)
                .background(Farben.flaeche.opacity(0.75), in: RoundedRectangle(cornerRadius: 5, style: .continuous))
        } else if kachel.online {
            Image(systemName: "video.fill")
                .font(.caption)
                .foregroundStyle(Farben.akzent)
                .accessibilityHidden(true)
        }
    }

    private var personenText: some View {
        let zeilen = kachel.personenzeilen
        var t = Text("")
        for (i, z) in zeilen.enumerated() {
            if i > 0 { t = t + Text("  ·  ") }
            t = t + kachelText(z, karte: kachel.karte)
        }
        return t
            .font(.subheadline)
            .foregroundStyle(Farben.text2)
            .strikethrough(entfall, color: Farben.entfall)
            .lineLimit(1)
    }

    private var marken: some View {
        HStack(spacing: 4) {
            if let merkmal { Statusabzeichen(merkmal: merkmal, klein: true, gefuellt: merkmal.betont) }
            if kachel.online { Statusabzeichen(merkmal: Statuslehre.online, klein: true) }
            if kachel.hausaufgabe {
                Image(systemName: "checklist")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(Farben.text2)
                    .accessibilityHidden(true)
            }
            if kachel.info {
                Image(systemName: "info.circle")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(Farben.text2)
                    .accessibilityHidden(true)
            }
        }
    }

    private var hatMarken: Bool { merkmal != nil || kachel.online || kachel.hausaufgabe || kachel.info }

    private var gross: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                titelText
                Spacer(minLength: 4)
                raumFeld
            }
            if !kachel.fachname.isEmpty {
                Text(kachel.fachname)
                    .font(.caption)
                    .foregroundStyle(Farben.text3)
                    .lineLimit(1)
            }
            if !kachel.personenzeilen.isEmpty { personenText }
            if hatMarken { marken.padding(.top, 1) }
        }
    }

    private var mittel: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                titelText
                Spacer(minLength: 4)
                raumFeld
            }
            HStack(spacing: 6) {
                if !kachel.personenzeilen.isEmpty { personenText }
                Spacer(minLength: 0)
                if let merkmal { Statusabzeichen(merkmal: merkmal, klein: true, gefuellt: merkmal.betont) }
            }
        }
    }

    private var klein: some View {
        HStack(spacing: 6) {
            Text(kachel.anzeigeTitel)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(entfall ? Farben.text2 : Farben.text)
                .strikethrough(entfall, color: Farben.entfall)
                .lineLimit(1)
            if let raum = kachel.zeile("raum"), !raum.text.isEmpty {
                kachelText(raum, karte: kachel.karte)
                    .font(.footnote)
                    .foregroundStyle(Farben.text2)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
            if let merkmal {
                Image(systemName: merkmal.symbol)
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(merkmal.farbe)
                    .accessibilityHidden(true)
            }
        }
        .minimumScaleFactor(0.8)
    }
}

// MARK: - Aufsicht in der Pause

/// Pausenaufsicht als schmale Kapsel im Pausenband.
struct AufsichtKapsel: View {
    let kachel: Kachel
    let vergangen: Bool

    var body: some View {
        let m = Statuslehre.merkmal(kachel)
        HStack(spacing: 6) {
            Image(systemName: "figure.walk")
                .font(.caption2.weight(.semibold))
                .accessibilityHidden(true)
            Text("Aufsicht · \(kachel.anzeigeTitel)")
                .font(.caption.weight(.semibold))
                .strikethrough(kachel.aufsichtsstand == .entfall || kachel.aufsichtsstand == .abgegeben, color: Farben.text3)
                .lineLimit(1)
            if let m, kachel.aufsichtsstand != .regulaer {
                Statusabzeichen(merkmal: m, klein: true)
            }
        }
        .foregroundStyle(Farben.text)
        .padding(.horizontal, 10)
        .padding(.vertical, 3)
        .background(Farben.flaeche, in: Capsule())
        .overlay {
            Capsule().strokeBorder(kachel.aufsichtsstand == .vertretung ? Farben.aenderung : Farben.randStark,
                                   style: StrokeStyle(lineWidth: 1, dash: kachel.aufsichtsstand == .abgegeben ? [2, 2] : []))
        }
        .opacity(vergangen ? 0.55 : 1)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Pausenaufsicht \(kachel.anzeigeTitel), \(kachel.zeitText)" + (m.map { ", \($0.text)" } ?? ""))
        .accessibilityAddTraits(.isButton)
    }
}
