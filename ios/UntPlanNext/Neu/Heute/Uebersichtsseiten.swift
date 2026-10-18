import SwiftUI

// Übernommen aus UntPlan für iOS: Ziele der Übersicht („Heute“ und „Mehr“) und ihre Unterseiten (Termine,
// Abwesenheiten, Hausaufgaben, Aufsichten, Änderungen).

/// Eintrag „Heute an der Schule“ (Nachricht, Veranstaltung, Hinweis).
struct Tagesinfo: Identifiable {
    enum Art {
        case nachricht
        case veranstaltung
        case hinweis
    }

    let id = UUID()
    let art: Art
    let titel: String
    let text: String
}

/// Ziele der Übersicht auf der Seite „Heute“ und im Reiter „Mehr“.
enum Startziel: Hashable {
    case termine
    case abwesenheiten
    /// Schüler*innen und Eltern: erfasste Abwesenheiten (Zeiträume mit Status)
    case familieAbwesenheiten
    case hausaufgaben
    case aufsichten
    case aenderungen
    /// Sprechtag (Lehrkräfte: eigene Termine; Erziehungsberechtigte: buchen und absagen)
    case sprechtag(Int)
    /// Entschuldigungen (Klassenleitung: Abwesenheiten der eigenen Klassen; Fachlehrkraft: eigene Fehlstunden)
    case entschuldigungen
}

/// Sprechtag, der als Blatt gezeigt wird.
struct SprechtagWahl: Identifiable {
    let id: Int
    let titel: String
}

// MARK: - Bausteine der Seite „Heute“

/// Zeile der Übersicht: Titel (und Untertitel), rechts die Zahl – ohne Symbol davor.
struct Uebersichtszeile: View {
    let titel: String
    var untertitel: String? = nil
    var zahl: Int = 0
    /// Eigener Pfeil (bei Knöpfen; NavigationLinks zeichnen ihn selbst)
    var pfeil: Bool = false

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(titel)
                    .foregroundStyle(Farben.text)
                    .lineLimit(1)
                if let untertitel, !untertitel.isEmpty {
                    Text(untertitel)
                        .font(.footnote)
                        .foregroundStyle(Farben.text2)
                        .lineLimit(2)
                }
            }
            Spacer(minLength: 4)
            if zahl > 0 {
                ZahlPlakette(zahl: zahl)
            }
            if pfeil {
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Farben.pfeil)
            }
        }
        .contentShape(Rectangle())
    }
}

/// Zeile „Heute an der Schule“: Art klein und grau, Titel und bis zu vier Zeilen Text.
struct Infozeile: View {
    let info: Tagesinfo

    private var art: String {
        switch info.art {
        case .nachricht: return "Nachricht"
        case .veranstaltung: return "Veranstaltung"
        case .hinweis: return "Hinweis"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            if info.titel != art {
                Text(art)
                    .font(.caption)
                    .foregroundStyle(Farben.text3)
            }
            Text(info.titel)
                .font(.body.weight(.semibold))
                .foregroundStyle(Farben.text)
                .lineLimit(2)
            Text(info.text)
                .font(.subheadline)
                .foregroundStyle(Farben.text2)
                .lineLimit(4)
        }
        .padding(.vertical, 3)
        .accessibilityElement(children: .combine)
    }
}

/// Listenzeile einer Stunde: Beginn und Ende, Fachkürzel auf getönter Fläche (wie die Kachel im Raster), Fach mit
/// Lehrkraft bzw. Klasse und Raum, rechts die Status-Plakette. Entfall durchgestrichen.
struct Stundenzeile: View {
    let karte: Karte
    let typ: String
    /// Stunde läuft gerade: Uhrzeit in Petrol
    var laeuft: Bool = false

    var body: some View {
        let stil = Kartenstil(karte)
        let zeilen = kartenzeilen(karte, typ: typ).filter { !$0.isEmpty }
        HStack(spacing: 12) {
            VStack(alignment: .trailing, spacing: 1) {
                Text(karte.beginn.isEmpty ? "\(karte.von). Std." : Detailmass.uhrzeit(karte.beginn))
                    .font(.subheadline.weight(.semibold).monospacedDigit())
                    .foregroundStyle(laeuft ? Farben.akzent : Farben.text)
                Text(laeuft ? "jetzt" : (karte.ende.isEmpty ? "" : Detailmass.uhrzeit(karte.ende)))
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(laeuft ? Farben.akzent : Farben.text3)
            }
            .frame(width: 44, alignment: .trailing)
            Text(karte.fach.isEmpty ? String(karte.titel.prefix(4)) : karte.fach)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(stil.durchgestrichen ? Farben.text2 : Farben.text)
                .strikethrough(stil.durchgestrichen, color: Farben.entfall)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .frame(width: 44, height: 36)
                .background(Farben.fachTon(karte.farbe) ?? Farben.flaeche2,
                            in: RoundedRectangle(cornerRadius: 4, style: .continuous))
                .overlay {
                    if Farben.fachTon(karte.farbe) == nil {
                        RoundedRectangle(cornerRadius: 4, style: .continuous)
                            .strokeBorder(Farben.randStark, lineWidth: 1)
                    }
                }
            VStack(alignment: .leading, spacing: 2) {
                Text(karte.fachName.isEmpty ? karte.titel : karte.fachName)
                    .font(.body)
                    .foregroundStyle(Farben.text)
                    .strikethrough(stil.durchgestrichen, color: Farben.entfall)
                    .lineLimit(1)
                if !zeilen.isEmpty {
                    zeilentext(zeilen, stil: stil)
                        .font(.footnote)
                        .foregroundStyle(Farben.text2)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 4)
            if let p = stil.plakette {
                Plakette(text: p, farbe: stil.plaketteFarbe, flaeche: stil.plaketteFlaeche)
            }
        }
        .padding(.vertical, 8)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    private func zeilentext(_ zeilen: [[Wert]], stil: Kartenstil) -> Text {
        if stil.durchgestrichen {
            return Text(zeilen.map(werteKurz).joined(separator: " · ")).strikethrough(true)
        }
        var ergebnis = werteText(zeilen[0], offen: offen(zeilen[0]))
        for z in zeilen.dropFirst() {
            ergebnis = ergebnis + Text(" · ") + werteText(z, offen: offen(z))
        }
        return ergebnis
    }

    private func offen(_ werte: [Wert]) -> Bool {
        werte == karte.lehrer && istOffeneVertretung(karte)
    }
}

// MARK: - Unterseiten der Übersicht

/// Ziel der Übersicht als eigene Seite (aus „Heute“ und aus „Mehr“).
struct Startzielseite: View {
    let ziel: Startziel
    let heute: Heute?
    var sprechtage: [SprechtagKarte] = []
    let antippen: (Karte) -> Void
    @EnvironmentObject var zustand: AppZustand

    var body: some View {
        switch ziel {
        case .familieAbwesenheiten:
            MeineAbwesenheitenView()
        case .entschuldigungen:
            EntschuldigungenView()
        case .sprechtag(let id):
            SprechtagView(id: id, titel: sprechtage.first { $0.id == id }?.titel ?? "Sprechtag",
                          karte: sprechtage.first { $0.id == id })
        default:
            StartlisteView(ziel: ziel, heute: heute, antippen: antippen)
        }
    }
}

/// Unterseite der Übersicht: Termine, Abwesenheiten, Hausaufgaben, Aufsichten oder Änderungen. Ohne mitgegebene
/// Tagesdaten (Aufruf aus „Mehr“) lädt sie sie selbst.
struct StartlisteView: View {
    let ziel: Startziel
    let heute: Heute?
    let antippen: (Karte) -> Void
    @EnvironmentObject var zustand: AppZustand
    @State private var meldungen: [Meldung]? = nil
    @State private var fehler: String? = nil
    @State private var geladen: Heute? = nil

    private var tag: Heute? { heute ?? geladen }

    private var titel: String {
        switch ziel {
        case .termine: return "Meine Termine"
        case .abwesenheiten, .familieAbwesenheiten: return "Meine Abwesenheiten"
        case .hausaufgaben: return "Hausaufgaben"
        case .aufsichten: return "Pausenaufsichten"
        case .aenderungen: return "Änderungen heute"
        case .sprechtag: return "Sprechtag"
        case .entschuldigungen: return "Entschuldigungen"
        }
    }

    var body: some View {
        List {
            if let fehler {
                Fehlerhinweis(text: fehler)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }
            if ziel == .abwesenheiten {
                abwesenheiten()
            } else if let h = tag {
                switch ziel {
                case .termine: termine(h)
                case .hausaufgaben: hausaufgaben(h)
                case .aufsichten: aufsichten(h)
                case .aenderungen: aenderungen(h)
                default: EmptyView()
                }
            } else if fehler == nil {
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .listRowBackground(Color.clear)
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(titel)
        .navigationBarTitleDisplayMode(.large)
        .toolbar(.visible, for: .navigationBar)
        .refreshable { await laden() }
        .task { await laden() }
    }

    private func laden() async {
        if ziel == .abwesenheiten {
            await meldungenLaden()
        } else if heute == nil {
            do {
                geladen = try await zustand.api.heute()
                fehler = nil
            } catch {
                if let text = zustand.fehlertext(error) { fehler = text }
            }
        }
    }

    // MARK: Meine Abwesenheiten (eigene Meldungen vom Typ Abwesenheit)

    @ViewBuilder
    private func abwesenheiten() -> some View {
        if let liste = meldungen?.filter(\.istAbwesenheit) {
            if liste.isEmpty {
                leer("Keine Abwesenheiten gemeldet.")
            }
            ForEach(liste) { m in
                VStack(alignment: .leading, spacing: 4) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(abwesenheitszeitraum(m))
                            .font(.body.weight(.semibold))
                            .foregroundStyle(Farben.text)
                        Spacer()
                        if m.status == "offen" {
                            Plakette(text: "Offen", farbe: Farben.pruefung, flaeche: Farben.pruefungFlaeche)
                        } else if m.status == "quittiert" {
                            Plakette(text: "Bestätigt", farbe: Farben.ok, flaeche: Farben.okFlaeche)
                        } else {
                            Plakette(text: m.status, farbe: Farben.text2, flaeche: Farben.neutralFlaeche)
                        }
                    }
                    let grund = (m.grund ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                    if !grund.isEmpty {
                        Text(grund)
                            .font(.subheadline)
                            .foregroundStyle(Farben.text2)
                    }
                    // Bemerkung bzw. Text als eigene Zeile – nur wenn vorhanden
                    let bemerkung = (m.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                    if !bemerkung.isEmpty {
                        Text(bemerkung)
                            .font(.subheadline)
                            .foregroundStyle(Farben.text3)
                            .lineLimit(4)
                    }
                }
                .padding(.vertical, 4)
            }
        } else if fehler == nil {
            ProgressView()
                .frame(maxWidth: .infinity)
                .listRowBackground(Color.clear)
        }
    }

    private func abwesenheitszeitraum(_ m: Meldung) -> String {
        let von = m.von ?? ""
        let bis = m.bis ?? von
        var text = Datumsformat.anzeige(von, "EE d.M.yyyy")
        if !bis.isEmpty && bis.prefix(10) != von.prefix(10) {
            text += " – " + Datumsformat.anzeige(bis, "EE d.M.yyyy")
        }
        if let v = m.stundeVon {
            let b = m.stundeBis ?? v
            text += v == b ? ", \(v). Std." : ", \(v).–\(b). Std."
        }
        return text
    }

    private func meldungenLaden() async {
        do {
            meldungen = try await zustand.api.meldungen()
            fehler = nil
        } catch {
            if let text = zustand.fehlertext(error) { fehler = text }
            if meldungen == nil { meldungen = [] }
        }
    }

    @ViewBuilder
    private func termine(_ h: Heute) -> some View {
        if h.termine.isEmpty {
            leer("Keine Termine in den nächsten zwei Wochen.")
        }
        ForEach(h.termine) { t in
            HStack(spacing: 12) {
                VStack(spacing: 0) {
                    Text(Datumsformat.anzeige(t.von, "d"))
                        .font(.title3.weight(.semibold).monospacedDigit())
                    Text(Datumsformat.anzeige(t.von, "MMM"))
                        .font(.caption.weight(.medium))
                }
                .foregroundStyle(Farben.akzent)
                .frame(width: 44)
                VStack(alignment: .leading, spacing: 2) {
                    Text(t.titel.isEmpty ? t.art : t.titel)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Farben.text)
                    Text(termintext(t))
                        .font(.footnote)
                        .foregroundStyle(Farben.text2)
                }
            }
            .padding(.vertical, 4)
        }
    }

    private func termintext(_ t: Termin) -> String {
        var teile: [String] = []
        if !t.art.isEmpty && !t.titel.isEmpty { teile.append(t.art) }
        if !t.bis.isEmpty && t.bis.prefix(10) != t.von.prefix(10) {
            teile.append("bis \(Datumsformat.anzeige(t.bis, "d.M."))")
        }
        if let v = t.stundeVon {
            let b = t.stundeBis ?? v
            teile.append(v == b ? "\(v). Stunde" : "\(v).–\(b). Stunde")
        }
        if !t.klassen.isEmpty { teile.append(t.klassen.joined(separator: ", ")) }
        return teile.joined(separator: " · ")
    }

    @ViewBuilder
    private func hausaufgaben(_ h: Heute) -> some View {
        if h.hausaufgaben.isEmpty {
            leer("Keine Hausaufgaben eingetragen.")
        }
        ForEach(h.hausaufgaben) { ha in
            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline) {
                    Text(ha.fach)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Farben.text)
                    Spacer()
                    if let f = ha.faellig, !f.isEmpty {
                        Text("fällig \(Datumsformat.anzeige(f, "EE d.M."))")
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(Farben.akzent)
                    }
                }
                Text(ha.hausaufgabe)
                    .font(.subheadline)
                    .foregroundStyle(Farben.text2)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.vertical, 4)
        }
    }

    @ViewBuilder
    private func aufsichten(_ h: Heute) -> some View {
        ForEach(h.aufsichten) { a in
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(a.gangName.isEmpty ? a.gang : a.gangName)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Farben.text)
                        .strikethrough(a.status == "vertreten" || a.status == "entfall", color: Farben.entfall)
                    Text("nach der \(a.nachStunde). Stunde · \(a.beginn) – \(a.ende)")
                        .font(.footnote)
                        .foregroundStyle(Farben.text2)
                }
                Spacer()
                if a.status == "vertretung" {
                    Plakette(text: "Vertretung", farbe: Farben.aenderung, flaeche: Farben.aenderungFlaeche)
                } else if a.status == "vertreten" {
                    Plakette(text: "Vertreten", farbe: Farben.text2, flaeche: Farben.neutralFlaeche)
                } else if a.status == "entfall" {
                    Plakette(text: "Entfällt", farbe: Farben.entfall, flaeche: Farben.entfallFlaeche)
                }
            }
            .padding(.vertical, 4)
        }
    }

    @ViewBuilder
    private func aenderungen(_ h: Heute) -> some View {
        let geaendert = h.karten
            .filter { $0.istEntfall || $0.istAenderung || $0.istPruefung || $0.zusaetzlich }
            .sorted { ($0.von, $0.bis) < ($1.von, $1.bis) }
        if geaendert.isEmpty {
            leer("Heute keine Änderungen.")
        }
        ForEach(geaendert) { karte in
            Button {
                antippen(karte)
            } label: {
                Stundenzeile(karte: karte, typ: h.typ)
            }
            .buttonStyle(.plain)
            .listRowInsets(EdgeInsets(top: 0, leading: 12, bottom: 0, trailing: 12))
        }
    }

    private func leer(_ text: String) -> some View {
        Text(text)
            .font(.subheadline)
            .foregroundStyle(Farben.text3)
    }
}
