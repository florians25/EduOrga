import SwiftUI

// Bausteine der Seite „Heute“: gruppierte Bereiche mit klarer Überschrift (ohne Schmuck-Symbole), die Zusammenfassung
// „Änderungen heute“ (je geänderter Stunde ein Feld mit der Art – Grün für Änderungen, Rot nur für Entfall, Grau für eine
// offene Vertretung – und dem, was sich geändert hat, in Worten) und die Vorschau auf den nächsten Schultag.

// MARK: - Änderung einer Stunde in Worten

/// Was sich an einer Stunde geändert hat – für Listen („Änderungen heute“, „Morgen“).
struct Stundenaenderung {
    /// Art als kurzes Wort im Feld: „Vertretung“, „Raumänderung“, „Entfall“, „Vertretung folgt“ …
    let art: String
    let ton: Chipton
    /// Was genau: „Gal statt Gor“, „Raum 105 statt 303“, „auf Di 21.10. 6“ …
    let text: String
}

extension Kachel {
    /// Änderung der Stunde (nil = unverändert bzw. keine Unterrichtsstunde). `familie`: ohne Kürzel abwesender Lehrkräfte.
    func aenderung(familie: Bool) -> Stundenaenderung? {
        guard let k = karte, !inPause else { return nil }
        switch art {
        case .normal, .aenderung, .entfall, .abgegeben: break
        default: return nil
        }
        if kartenart == .entfall {
            var text = statusChip?.gesprochen ?? "entfällt"
            if text == "entfällt" && klasseFehlt {
                text = "Klasse \(k.abwesendeKlassen.joined(separator: ", ")) abwesend"
            }
            let grund = k.anzeigeText.trimmingCharacters(in: .whitespacesAndNewlines)
            if !grund.isEmpty && grund.count <= 60 { text += " · \(grund)" }
            return Stundenaenderung(art: "Entfall", ton: .entfall, text: text)
        }
        if art == .abgegeben {
            return Stundenaenderung(art: "Vertreten", ton: .offen, text: "Die Stunde übernimmt eine andere Lehrkraft")
        }
        if k.istOffeneVertretung {
            let wer = k.offeneLehrkraefte.filter { $0 != "???" }.joined(separator: ", ")
            return Stundenaenderung(art: "Vertretung folgt", ton: .offen,
                                    text: familie || wer.isEmpty ? "Die Vertretung wird noch eingeteilt" : "\(wer) abwesend, Vertretung wird noch eingeteilt")
        }
        var teile: [String] = []
        var wort: String? = nil
        for w in k.lehrer where w.ersetzt {
            teile.append("\(w.k) statt \(w.alt ?? "")")
            wort = wort ?? "Vertretung"
        }
        for w in k.raeume where w.geaendert {
            let alt = (w.alt ?? "").trimmingCharacters(in: .whitespaces)
            if w.ersetzt {
                teile.append("Raum \(w.k) statt \(alt)")
            } else if w.k.isEmpty {
                if !alt.isEmpty { teile.append("Raum \(alt) entfällt") }
            } else {
                teile.append("Raum \(w.k) neu")
            }
            wort = wort ?? "Raumänderung"
        }
        if let alt = fachVorher {
            teile.append("\(k.fach) statt \(alt)")
            wort = wort ?? "Fachänderung"
        }
        if k.verlegung == "nach" {
            if let c = statusChip { teile.append(c.gesprochen) }
            wort = wort ?? "Verlegt"
        }
        if zusatz || k.istZusatzstunde {
            wort = wort ?? "Zusatz"
            if teile.isEmpty { teile.append("Zusätzliche Stunde") }
        }
        guard art == .aenderung || raumAenderung || !teile.isEmpty else { return nil }
        let text = teile.isEmpty ? (k.anzeigeText.isEmpty ? "Geändert" : k.anzeigeText) : teile.joined(separator: " · ")
        return Stundenaenderung(art: wort ?? "Änderung", ton: .aenderung, text: text)
    }

    /// „3. Std. · 9:45 · M · 7a“ für Listen.
    var kurzbeschreibung: String {
        var teile: [String] = []
        if von > 0 { teile.append(stundenText) }
        teile.append(Uhr.uhrzeit(beginn))
        teile.append(anzeigeTitel)
        let klassen = (karte?.klassen ?? []).map { $0.k.isEmpty ? ($0.alt ?? "") : $0.k }.filter { !$0.isEmpty }
        if !klassen.isEmpty { teile.append(klassen.joined(separator: ", ")) }
        return teile.joined(separator: " · ")
    }
}

// MARK: - Bereich

/// Bereich der Seite „Heute“: Überschrift (mit optionaler Zahl bzw. Zusatz rechts) und eine Fläche mit Zeilen.
struct HeuteGruppe<Inhalt: View>: View {
    let titel: String
    var zusatz: String? = nil
    @ViewBuilder let inhalt: () -> Inhalt

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(titel)
                    .font(.headline)
                    .foregroundStyle(Farben.text)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: 8)
                if let zusatz, !zusatz.isEmpty {
                    Text(zusatz)
                        .font(.subheadline)
                        .monospacedDigit()
                        .foregroundStyle(Farben.text2)
                }
            }
            VStack(alignment: .leading, spacing: 0) {
                inhalt()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .kartenflaeche()
            .clipShape(RoundedRectangle(cornerRadius: Stilmass.radius, style: .continuous))
        }
    }
}

/// Trennlinie zwischen Zeilen einer `HeuteGruppe`.
struct HeuteTrenner: View {
    var body: some View {
        Divider().padding(.leading, 16)
    }
}

/// Schlichte Zeile einer `HeuteGruppe`: Titel, Untertitel, Wert rechts; mit Aktion als Knopf (mindestens 44 pt hoch).
struct HeuteZeile: View {
    let titel: String
    var untertitel: String? = nil
    var wert: String? = nil
    var wertFarbe: Color = Farben.text2
    var aktion: (() -> Void)? = nil

    var body: some View {
        if let aktion {
            Button {
                Haptik.tippen()
                aktion()
            } label: {
                inhalt(pfeil: true)
            }
            .buttonStyle(ZeilenKnopfStil())
        } else {
            inhalt(pfeil: false)
        }
    }

    private func inhalt(pfeil: Bool) -> some View {
        HStack(alignment: .center, spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(titel)
                    .font(.body)
                    .foregroundStyle(Farben.text)
                    .lineLimit(2)
                if let untertitel, !untertitel.isEmpty {
                    Text(untertitel)
                        .font(.footnote)
                        .foregroundStyle(Farben.text2)
                        .lineLimit(2)
                        .truncationMode(.tail)
                }
            }
            Spacer(minLength: 6)
            if let wert, !wert.isEmpty {
                Text(wert)
                    .font(.subheadline.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(wertFarbe)
                    .lineLimit(1)
            }
            if pfeil {
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Farben.pfeil)
                    .accessibilityHidden(true)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .frame(minHeight: 44)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

/// Zeile „Änderungen heute“: links das Feld mit der Art, daneben Stunde/Fach und was sich geändert hat.
struct AenderungZeile: View {
    let kachel: Kachel
    let aenderung: Stundenaenderung
    let oeffnen: () -> Void

    var body: some View {
        Button {
            Haptik.tippen()
            oeffnen()
        } label: {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                VStack(alignment: .leading, spacing: 3) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Chipfeld(ton: aenderung.ton) {
                            Text(aenderung.art)
                                .font(.footnote.weight(.semibold))
                                .padding(.vertical, 1)
                        }
                        .fixedSize()
                        Text(kachel.kurzbeschreibung)
                            .font(.subheadline.weight(.semibold))
                            .monospacedDigit()
                            .foregroundStyle(Farben.text)
                            .lineLimit(1)
                            .truncationMode(.tail)
                    }
                    Text(aenderung.text)
                        .font(.subheadline)
                        .foregroundStyle(Farben.text2)
                        .lineLimit(2)
                        .truncationMode(.tail)
                }
                Spacer(minLength: 4)
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Farben.pfeil)
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(ZeilenKnopfStil())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(aenderung.art): \(kachel.kurzbeschreibung). \(aenderung.text)")
        .accessibilityHint("Öffnet die Stunde")
    }
}
