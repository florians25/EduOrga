import SwiftUI

// Ferien und freie Tage auf „Heute“ (design/DESIGN.md, Abschnitt 10.1 „Heute“). Datenquelle: GET /api/app/heute, Feld
// `kalender` (EduOrga Web `Plandienst.Kalender`: Ferien und Feiertage aus dem Paket von EduOrga Studio plus die in EduOrga Web
// gepflegten freien Tage). Ruhig und sachlich: eine Fläche mit 3-pt-Streifen oben in Ferienblau (Sprache der Stundenkarte v7),
// Name groß, Zeitraum und Resttage als eine Zeile, darunter der nächste Schultag mit seiner ersten Stunde. In der Schulzeit
// nur eine stille Liste „Kalender“: nächste Ferien und die nächsten Feiertage bzw. beweglichen Ferientage.

enum Kalendertext {
    /// Ganze Tage von `von` bis `bis` (ISO), negativ = vorbei.
    static func tage(von: String, bis: String) -> Int? {
        guard let a = Datumsformat.datum(von), let b = Datumsformat.datum(bis) else { return nil }
        let k = Datumsformat.kalender
        return k.dateComponents([.day], from: k.startOfDay(for: a), to: k.startOfDay(for: b)).day
    }

    /// „in 23 Tagen“, „morgen“, „heute“.
    static func abstand(_ tage: Int) -> String {
        switch tage {
        case ..<1: return "heute"
        case 1: return "morgen"
        default: return "in \(tage) Tagen"
        }
    }

    /// „Mi 21.10.“
    static func kurz(_ iso: String) -> String {
        var tag = Datumsformat.anzeige(iso, "EEE")
        while tag.hasSuffix(".") { tag.removeLast() }
        return "\(tag) \(Datumsformat.anzeige(iso, "d.M."))"
    }

    /// „22.12.–6.1.“ bzw. ein Tag „Mi 21.10.“
    static func zeitraum(_ f: Freizeitraum) -> String {
        guard !f.bis.isEmpty, f.bis != f.von else { return kurz(f.von) }
        return "\(Datumsformat.anzeige(f.von, "d.M."))–\(Datumsformat.anzeige(f.bis, "d.M."))"
    }

    /// Wort über dem Namen: „Ferien“, „Feiertag“, „Unterrichtsfrei“.
    static func art(_ f: Freizeitraum) -> String {
        switch f.art {
        case "feiertag": return "Feiertag"
        case "ferien": return "Ferien"
        default: return "Unterrichtsfrei"
        }
    }
}

/// Heute unterrichtsfrei: ganze Breite, ruhige Fläche mit blauem 3-pt-Streifen oben. „Herbstferien“ groß, darunter „bis
/// Samstag, 31.10. · noch 11 Tage“ und ein feiner Verlauf der Ferien (vergangene Tage); unten der nächste Schultag mit der
/// ersten Stunde („Montag, 2. November · ab 7:55 · E, R101“) – Antippen öffnet ihn im Plan.
struct HeuteFerienKarte: View {
    let frei: Freizeitraum
    /// Heute (ISO)
    let heute: String
    /// Nächster Schultag (ISO); leer = unbekannt
    let naechsterSchultag: String
    /// Erste stattfindende Stunde des nächsten Schultags
    var ersteStunde: Kachel? = nil
    var oeffnen: (() -> Void)? = nil

    private var rest: Int? {
        guard !naechsterSchultag.isEmpty else { return Kalendertext.tage(von: heute, bis: frei.bis).map { $0 + 1 } }
        return Kalendertext.tage(von: heute, bis: naechsterSchultag)
    }

    private var anteil: Double? {
        guard frei.bis != frei.von, let gesamt = Kalendertext.tage(von: frei.von, bis: frei.bis),
              let vorbei = Kalendertext.tage(von: frei.von, bis: heute), gesamt > 0 else { return nil }
        return min(1, max(0, Double(vorbei) / Double(gesamt + 1)))
    }

    private var zeitzeile: String {
        var teile: [String] = []
        if frei.bis != frei.von, !frei.bis.isEmpty {
            teile.append("bis " + Datumsformat.anzeige(frei.bis, "EEEE, d.M."))
        }
        if let r = rest, r > 1 {
            teile.append("noch \(r) Tage")
        } else if rest == 1 {
            teile.append("morgen wieder Unterricht")
        }
        return teile.joined(separator: " · ")
    }

    private var schultagZeile: String {
        guard let k = ersteStunde else { return "" }
        var teile: [String] = ["ab \(Uhr.uhrzeit(k.beginn))"]
        var stunde = k.anzeigeTitel
        if let raum = k.zeile("raum")?.text, !raum.isEmpty { stunde += ", \(raum)" }
        teile.append(stunde)
        return teile.joined(separator: " · ")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 6) {
                Text(Kalendertext.art(frei))
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Farben.frei)
                Text(frei.name.isEmpty ? Kalendertext.art(frei) : frei.name)
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(Farben.text)
                    .fixedSize(horizontal: false, vertical: true)
                if !zeitzeile.isEmpty {
                    Text(zeitzeile)
                        .font(.subheadline)
                        .monospacedDigit()
                        .foregroundStyle(Farben.text2)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let anteil {
                    Fortschrittslinie(anteil: anteil, farbe: Farben.frei, hoehe: 4)
                        .padding(.top, 4)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 16 + Kartenmass.streifen)
            .padding(.bottom, 14)
            .accessibilityElement(children: .combine)

            if !naechsterSchultag.isEmpty {
                Rectangle().fill(Farben.rand).frame(height: 1)
                Button {
                    Haptik.tippen()
                    oeffnen?()
                } label: {
                    HStack(alignment: .center, spacing: 10) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Nächster Schultag")
                                .font(.footnote)
                                .foregroundStyle(Farben.text2)
                            Text(Datumsformat.anzeige(naechsterSchultag, "EEEE, d. MMMM"))
                                .font(.body.weight(.semibold))
                                .foregroundStyle(Farben.text)
                            if !schultagZeile.isEmpty {
                                Text(schultagZeile)
                                    .font(.subheadline)
                                    .monospacedDigit()
                                    .foregroundStyle(Farben.text2)
                                    .lineLimit(2)
                            }
                        }
                        Spacer(minLength: 6)
                        Image(systemName: "chevron.right")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Farben.pfeil)
                            .accessibilityHidden(true)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
                }
                .buttonStyle(ZeilenKnopfStil())
                .accessibilityElement(children: .combine)
                .accessibilityHint("Öffnet den Tag im Reiter „Plan“")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .kartenflaeche()
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Farben.frei)
                .frame(height: Kartenmass.streifen)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        }
        .clipShape(RoundedRectangle(cornerRadius: Stilmass.radius, style: .continuous))
    }
}

/// Stille Liste „Kalender“ in der Schulzeit (bzw. nach den laufenden Ferien): „Weihnachtsferien · 23.12.–6.1. · in 64 Tagen“,
/// darunter die nächsten Feiertage bzw. freien Tage („Christi Himmelfahrt · Do 6.5. · in 3 Tagen“). Eine Fläche, Trennlinien.
struct HeuteKalenderliste: View {
    let kalender: Schulkalender

    private struct Eintrag: Identifiable {
        let id: String
        let titel: String
        let zusatz: String
        let abstand: String
        let vorlesen: String
    }

    private var eintraege: [Eintrag] {
        var liste: [Eintrag] = []
        if let f = kalender.naechsteFerien, let t = Kalendertext.tage(von: kalender.heute, bis: f.von) {
            let titel = f.name.isEmpty ? "Ferien" : f.name
            liste.append(Eintrag(id: "ferien-\(f.von)", titel: titel, zusatz: Kalendertext.zeitraum(f), abstand: Kalendertext.abstand(t),
                                 vorlesen: "Nächste Ferien: \(titel), \(Datumsformat.anzeige(f.von, "d. MMMM")) bis \(Datumsformat.anzeige(f.bis, "d. MMMM")), \(Kalendertext.abstand(t))"))
        }
        for f in kalender.freieTage {
            guard let t = Kalendertext.tage(von: kalender.heute, bis: f.von) else { continue }
            let titel = f.name.isEmpty ? Kalendertext.art(f) : f.name
            liste.append(Eintrag(id: "frei-\(f.von)-\(f.name)", titel: titel, zusatz: Kalendertext.zeitraum(f), abstand: Kalendertext.abstand(t),
                                 vorlesen: "\(Kalendertext.art(f)): \(titel), \(Datumsformat.anzeige(f.von, "EEEE, d. MMMM")), \(Kalendertext.abstand(t))"))
        }
        return liste
    }

    var body: some View {
        let liste = eintraege
        if !liste.isEmpty {
            VStack(alignment: .leading, spacing: Stilmass.raster) {
                Text("Kalender")
                    .font(.headline)
                    .foregroundStyle(Farben.text)
                    .accessibilityAddTraits(.isHeader)
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(liste.enumerated()), id: \.element.id) { i, e in
                        if i > 0 { HeuteTrenner() }
                        ViewThatFits(in: .horizontal) {
                            HStack(alignment: .firstTextBaseline, spacing: 10) {
                                Text(e.titel)
                                    .font(.body)
                                    .foregroundStyle(Farben.text)
                                    .lineLimit(1)
                                Text(e.zusatz)
                                    .font(.subheadline)
                                    .monospacedDigit()
                                    .foregroundStyle(Farben.text2)
                                    .lineLimit(1)
                                Spacer(minLength: 8)
                                Text(e.abstand)
                                    .font(.subheadline.weight(.semibold))
                                    .monospacedDigit()
                                    .foregroundStyle(Farben.frei)
                                    .lineLimit(1)
                            }
                            VStack(alignment: .leading, spacing: 2) {
                                Text(e.titel)
                                    .font(.body)
                                    .foregroundStyle(Farben.text)
                                Text("\(e.zusatz) · \(e.abstand)")
                                    .font(.subheadline)
                                    .monospacedDigit()
                                    .foregroundStyle(Farben.text2)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 11)
                        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel(e.vorlesen)
                    }
                }
                .kartenflaeche()
                .clipShape(RoundedRectangle(cornerRadius: Stilmass.radius, style: .continuous))
            }
        }
    }
}
