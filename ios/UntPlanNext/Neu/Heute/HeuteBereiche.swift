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
    /// Was genau in Worten (Liste und VoiceOver): „Gal statt Gor“, „Raum 105 statt 303“, „verlegt auf Di 21.10., 6. Std“ …
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
        HeuteZeilenInhalt(titel: titel, untertitel: untertitel, wert: wert, wertFarbe: wertFarbe, pfeil: pfeil)
    }
}

/// Inhalt einer `HeuteZeile` – auch als Beschriftung eines `NavigationLink` (mit eigenem Pfeil).
struct HeuteZeilenInhalt: View {
    let titel: String
    var untertitel: String? = nil
    var wert: String? = nil
    var wertFarbe: Color = Farben.text2
    var pfeil: Bool = true
    /// Höchstzahl der Zeilen des Titels
    var titelZeilen: Int = 2

    var body: some View {
        HStack(alignment: .center, spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                Text(titel)
                    .font(.body)
                    .foregroundStyle(Farben.text)
                    .lineLimit(titelZeilen)
                    .truncationMode(.tail)
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

// MARK: - Abschnitt mit Aktion rechts

/// Abschnitt der Seite „Heute“ mit eigener Aktion rechts neben der Überschrift („Alle“, „Im Plan“) und einer Fläche mit
/// Zeilen – eine Ebene, keine Karte in der Karte.
struct HeuteAbschnitt<Rechts: View, Inhalt: View>: View {
    let titel: String
    @ViewBuilder let rechts: () -> Rechts
    @ViewBuilder let inhalt: () -> Inhalt

    var body: some View {
        VStack(alignment: .leading, spacing: Stilmass.raster) {
            HStack(alignment: .firstTextBaseline) {
                Text(titel)
                    .font(.headline)
                    .foregroundStyle(Farben.text)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: Stilmass.raster)
                rechts()
                    .font(.subheadline.weight(.semibold))
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

// MARK: - Fokus: jetzt bzw. als Nächstes

/// Was die Fokuskarte zeigt: die laufende Stunde („Jetzt“) bzw. die nächste („Als Nächstes“, auch am nächsten Schultag).
struct HeuteFokuslage {
    let kachel: Kachel
    let laeuft: Bool
    /// Beginn und Ende der Stunde (Minuten seit Mitternacht)
    let von: Int
    let bis: Int
    /// Datum, wenn die Stunde nicht heute ist (nächster Schultag)
    var anderesDatum: String? = nil

    /// Laufende bzw. nächste Stunde des Tages; ist heute nichts mehr, die erste Stunde des nächsten Schultags.
    /// Aufsichten (Pausen) bleiben außen vor – sie stehen im Block der Lehrkräfte.
    static func berechnen(_ kacheln: [Kachel], istHeute: Bool, naechsterTag: (datum: String, kacheln: [Kachel])?,
                          jetzt: Date) -> HeuteFokuslage? {
        let stunden = kacheln.filter { $0.aufsicht == nil && Statuslehre.findetStatt($0) }
            .sorted { ($0.beginn, $0.rang) < ($1.beginn, $1.rang) }
        if istHeute {
            if let lage = Jetztlage.berechnen(stunden, minuten: Uhr.minuten(jetzt)) {
                switch lage.phase {
                case .laeuft:
                    if let a = lage.aktuell { return HeuteFokuslage(kachel: a, laeuft: true, von: a.beginn, bis: a.ende) }
                case .pause, .vorher:
                    if let n = lage.naechste { return HeuteFokuslage(kachel: n, laeuft: false, von: n.beginn, bis: n.ende) }
                case .danach:
                    break
                }
            }
        } else if let erste = stunden.first {
            return HeuteFokuslage(kachel: erste, laeuft: false, von: erste.beginn, bis: erste.ende, anderesDatum: erste.datum)
        }
        guard let m = naechsterTag else { return nil }
        let morgen = m.kacheln.filter { $0.aufsicht == nil && Statuslehre.findetStatt($0) }
            .sorted { ($0.beginn, $0.rang) < ($1.beginn, $1.rang) }
        guard let erste = morgen.first else { return nil }
        return HeuteFokuslage(kachel: erste, laeuft: false, von: erste.beginn, bis: erste.ende, anderesDatum: m.datum)
    }
}

/// Fokuskarte oben auf „Heute“: „Jetzt“ bzw. „Als Nächstes“ mit Fach groß, Raum, Lehrkraft bzw. Klasse, Uhrzeit und
/// Stunde; Änderungen als Kennzeichen („Gal (G̶o̶r̶)“, „verlegt von …“); bei der laufenden Stunde eine dünne Linie für die
/// verstrichene Zeit und „noch 23 Min.“. Eine Fläche, ein Akzent (Petrol), keine Symbol-Kacheln. Lehrkräfte: unten
/// „Klassenbuch erfassen“, wenn „Stunde jetzt“ genau diese Stunde ist.
struct HeuteFokus: View {
    let kacheln: [Kachel]
    let istHeute: Bool
    var naechsterTag: (datum: String, kacheln: [Kachel])? = nil
    let raum: Namespace.ID?
    /// Stunde für „Stunde jetzt“ (nur Lehrkräfte; nil = keine)
    var klassenbuchZiel: Kachel? = nil
    var klassenbuch: (() -> Void)? = nil
    let oeffnen: (Kachel, String) -> Void

    var body: some View {
        TimelineView(.periodic(from: .now, by: 15)) { kontext in
            if let f = HeuteFokuslage.berechnen(kacheln, istHeute: istHeute, naechsterTag: naechsterTag, jetzt: kontext.date) {
                karte(f, jetzt: kontext.date)
            }
        }
    }

    private func genau(_ d: Date) -> Double {
        let k = Datumsformat.kalender
        return Double(k.component(.hour, from: d) * 60 + k.component(.minute, from: d)) + Double(k.component(.second, from: d)) / 60
    }

    /// „noch 23 Min.“, „in 12 Min.“, „ab 7:45“ bzw. „Mittwoch, 7:45“.
    private func zusatz(_ f: HeuteFokuslage, jetzt: Date) -> String {
        if let d = f.anderesDatum {
            return "\(Datumsformat.anzeige(d, "EEEE")), \(Uhr.uhrzeit(f.von))"
        }
        let m = genau(jetzt)
        if f.laeuft {
            return "noch \(Uhr.dauer(Int((Double(f.bis) - m).rounded(.up))))"
        }
        let bis = Int((Double(f.von) - m).rounded(.up))
        return bis <= 90 ? "in \(Uhr.dauer(bis))" : "ab \(Uhr.uhrzeit(f.von))"
    }

    private func gesprochenerZusatz(_ f: HeuteFokuslage, jetzt: Date) -> String {
        if let d = f.anderesDatum {
            return "\(Datumsformat.anzeige(d, "EEEE, d. MMMM")), \(Uhr.uhrzeit(f.von)) Uhr"
        }
        let m = genau(jetzt)
        if f.laeuft {
            return "noch \(Uhr.dauerGesprochen(Int((Double(f.bis) - m).rounded(.up))))"
        }
        let bis = Int((Double(f.von) - m).rounded(.up))
        return bis <= 90 ? "in \(Uhr.dauerGesprochen(bis))" : "ab \(Uhr.uhrzeit(f.von)) Uhr"
    }

    private func anteil(_ f: HeuteFokuslage, jetzt: Date) -> Double {
        guard f.bis > f.von else { return 1 }
        return min(1, max(0, (genau(jetzt) - Double(f.von)) / Double(f.bis - f.von)))
    }

    private func titel(_ k: Kachel) -> String {
        k.fachname.isEmpty ? k.anzeigeTitel : k.fachname
    }

    private func karte(_ f: HeuteFokuslage, jetzt: Date) -> some View {
        let k = f.kachel
        let quelle = "fokus-\(k.id.uuidString)"
        let kopf = f.laeuft ? "Jetzt" : "Als Nächstes"
        let mitKlassenbuch = klassenbuch != nil && klassenbuchZiel?.id == k.id
        return VStack(alignment: .leading, spacing: 0) {
            Button {
                oeffnen(k, quelle)
            } label: {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text(kopf)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(f.laeuft ? Farben.akzent : Farben.text)
                        Text("· " + zusatz(f, jetzt: jetzt))
                            .font(.subheadline)
                            .monospacedDigit()
                            .foregroundStyle(Farben.text2)
                            .lineLimit(1)
                        Spacer(minLength: 4)
                        Image(systemName: "chevron.right")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Farben.pfeil)
                            .accessibilityHidden(true)
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        Text(titel(k))
                            .font(.title.weight(.semibold))
                            .foregroundStyle(Farben.text)
                            .lineLimit(2)
                            .minimumScaleFactor(0.75)
                        if let r = k.zeile("raum"), !r.text.isEmpty {
                            HStack(alignment: .firstTextBaseline, spacing: 6) {
                                Text("Raum")
                                    .font(.title3)
                                    .foregroundStyle(Farben.text2)
                                Kartenwert(zeile: r, karte: k.karte, schrift: .title3.weight(.semibold), farbe: Farben.text)
                            }
                        }
                        let personen = k.personenzeilen.filter { !$0.text.trimmingCharacters(in: .whitespaces).isEmpty }
                        if !personen.isEmpty {
                            HStack(alignment: .firstTextBaseline, spacing: 8) {
                                ForEach(Array(personen.enumerated()), id: \.offset) { i, z in
                                    if i > 0 {
                                        Text("·").foregroundStyle(Farben.text3)
                                    }
                                    Kartenwert(zeile: z, karte: k.karte, schrift: .body, farbe: Farben.text2)
                                }
                            }
                            .font(.body)
                        }
                    }
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(k.von > 0 ? "\(k.zeitText) · \(k.stundenText)" : k.zeitText)
                            .font(.subheadline)
                            .monospacedDigit()
                            .foregroundStyle(Farben.text2)
                            .lineLimit(1)
                        if let alt = k.fachVorher {
                            Chipfeld(ton: .aenderung) {
                                (Text("Fach ") + Wertwechsel.text(k.anzeigeTitel, statt: alt))
                                    .font(.footnote)
                            }
                        }
                        if let chip = k.statusChip {
                            Statuschip(chip: chip, schrift: .footnote.weight(.semibold))
                        }
                        Spacer(minLength: 0)
                    }
                    if f.laeuft {
                        Fortschrittslinie(anteil: anteil(f, jetzt: jetzt))
                            .padding(.top, 2)
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
                .zoomQuelle(quelle, in: raum)
            }
            .buttonStyle(KachelDruckStil())
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(kopf), \(gesprochenerZusatz(f, jetzt: jetzt)). \(Kachel.ereignisArt(k))\(k.vorlesetext)")
            .accessibilityHint("Öffnet die Stunde")
            .accessibilityAddTraits(.isButton)

            if mitKlassenbuch, let klassenbuch {
                Divider().padding(.leading, 16)
                Button {
                    Haptik.fest()
                    klassenbuch()
                } label: {
                    HStack {
                        Text("Klassenbuch erfassen")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Farben.akzent)
                        Spacer(minLength: 4)
                        Image(systemName: "chevron.right")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Farben.pfeil)
                            .accessibilityHidden(true)
                    }
                    .padding(.horizontal, 16)
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
                }
                .buttonStyle(ZeilenKnopfStil())
                .accessibilityHint("Thema, Anwesenheit und Hausaufgabe dieser Stunde")
            }
        }
        .kartenflaeche()
        .clipShape(RoundedRectangle(cornerRadius: Stilmass.radius, style: .continuous))
    }
}

/// Dünne Linie für die verstrichene Zeit der laufenden Stunde (3 pt, Petrol auf neutralem Grau).
struct Fortschrittslinie: View {
    let anteil: Double

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 1.5, style: .continuous)
                    .fill(Farben.neutralFlaeche)
                RoundedRectangle(cornerRadius: 1.5, style: .continuous)
                    .fill(Farben.akzent)
                    .frame(width: max(0, min(1, anteil)) * geo.size.width)
            }
        }
        .frame(height: 3)
        .animation(.easeOut(duration: 0.4), value: anteil)
        .accessibilityHidden(true)
    }
}

// MARK: - Der Tag als kompakte Liste

/// Eine Zeile der Liste „Heute“: Beginn · Fach · Raum, geänderte Werte und Statuskennzeichen direkt in der Zeile
/// („105 (3̶0̶3̶)“, „Gal (G̶o̶r̶)“, „entfällt“). Vergangene Stunden blass, die laufende mit Uhrzeit in Petrol und „jetzt“.
/// Bei sehr großer Schrift (Bedienungshilfen) untereinander statt nebeneinander.
struct HeuteStundenzeile: View {
    let kachel: Kachel
    var vergangen: Bool = false
    var laeuft: Bool = false
    let oeffnen: () -> Void

    @Environment(\.kartendarstellung) private var darstellung
    @Environment(\.dynamicTypeSize) private var schriftgroesse
    @ScaledMetric(relativeTo: .subheadline) private var zeitBreite: CGFloat = 44

    private var entfall: Bool { kachel.kartenart == .entfall }
    private var ereignis: Bool { Rastergeometrie.istEreignis(kachel) }

    /// Lehrkraft- bzw. Klassenzeilen nur, wenn sich dort etwas geändert hat (sonst bleibt die Zeile kurz).
    private var geaenderteZeilen: [Kachelzeile] {
        guard !entfall else { return [] }
        return kachel.personenzeilen.filter { ($0.schluessel == "lehrer" || $0.schluessel == "klasse") && !$0.nurText }
    }

    var body: some View {
        Button {
            Haptik.tippen()
            oeffnen()
        } label: {
            Group {
                if schriftgroesse.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: 4) {
                        zeit
                        hauptteil
                        rechts
                    }
                } else {
                    HStack(alignment: .firstTextBaseline, spacing: 12) {
                        zeit
                        hauptteil
                        Spacer(minLength: 4)
                        rechts
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            .opacity(vergangen ? 0.6 : 1)
            .contentShape(Rectangle())
        }
        .buttonStyle(ZeilenKnopfStil())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel((laeuft ? "Läuft gerade. " : (vergangen ? "Vorbei. " : "")) + Kachel.ereignisArt(kachel) + kachel.vorlesetext)
        .accessibilityHint("Öffnet die Stunde")
        .accessibilityAddTraits(.isButton)
    }

    private var zeit: some View {
        Text(kachel.art == .ganztagTermin ? "ganztags" : Uhr.uhrzeit(kachel.beginn))
            .font(.subheadline.weight(laeuft ? .semibold : .regular))
            .monospacedDigit()
            .foregroundStyle(laeuft ? Farben.akzent : Farben.text2)
            .lineLimit(1)
            .frame(minWidth: zeitBreite, alignment: .leading)
    }

    @ViewBuilder
    private var hauptteil: some View {
        if ereignis {
            Text(kachel.anzeigeTitel)
                .font(.body)
                .foregroundStyle(Farben.text)
                .lineLimit(1)
                .truncationMode(.tail)
        } else {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Kartenfach(kachel: kachel, text: kachel.fachText(darstellung), schrift: .body.weight(.semibold), farbe: Farben.text)
                    .layoutPriority(1)
                if let r = kachel.zeile("raum"), !r.text.trimmingCharacters(in: .whitespaces).isEmpty {
                    Kartenwert(zeile: r, karte: kachel.karte, entfall: entfall, schrift: .subheadline, farbe: Farben.text2)
                }
                ForEach(Array(geaenderteZeilen.enumerated()), id: \.offset) { _, z in
                    Kartenwert(zeile: z, karte: kachel.karte, schrift: .subheadline, farbe: Farben.text2)
                }
            }
        }
    }

    @ViewBuilder
    private var rechts: some View {
        if let chip = kachel.statusChip {
            Statuschip(chip: chip, schrift: .footnote.weight(.semibold))
                .layoutPriority(1)
        } else if laeuft {
            Text("jetzt")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Farben.akzent)
        } else if let m = Statuslehre.kartenwort(kachel, darstellung) {
            Text(m.text)
                .font(.footnote)
                .foregroundStyle(m.farbe)
                .lineLimit(1)
        }
    }
}

// MARK: - Hinweise der Schule

/// Einzeilige Zeile „Hinweise der Schule“: Titel halbfett, dahinter der Text (gekürzt mit „…“).
struct HinweisKurzzeile: View {
    let info: Tagesinfo

    private var allgemein: Bool { ["Nachricht", "Hinweis"].contains(info.titel) }

    var body: some View {
        HStack(spacing: 10) {
            (allgemein ? Text(info.text).foregroundColor(Farben.text)
                : Text(info.titel).fontWeight(.semibold).foregroundColor(Farben.text) + Text(" – \(info.text)").foregroundColor(Farben.text2))
                .font(.subheadline)
                .lineLimit(1)
                .truncationMode(.tail)
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
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(allgemein ? info.text : "\(info.titel): \(info.text)")
    }
}

/// Alle Hinweise des Tages (Nachrichten, Veranstaltungen, Hinweise der Schule) vollständig.
struct HeuteHinweiseSeite: View {
    let infos: [Tagesinfo]

    var body: some View {
        List {
            ForEach(infos) { info in
                Infozeile(info: info)
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Hinweise der Schule")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// Ruhige Fläche ohne Symbol für Tage ohne Stunden (Ferien, kein Unterricht, nicht freigegeben).
struct HeuteHinweiskarte: View {
    let titel: String
    var text: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(titel)
                .font(.title2.weight(.semibold))
                .foregroundStyle(Farben.text)
            if !text.isEmpty {
                Text(text)
                    .font(.subheadline)
                    .foregroundStyle(Farben.text2)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .kartenflaeche()
        .accessibilityElement(children: .combine)
    }
}
