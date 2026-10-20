import SwiftUI

/// „Kennzeichnungen“ der Stundenkarten (Blatt „Auswahl und Filter“): EduOrgas eigene Übersicht, nach Bedeutung gruppiert –
/// Unterricht, Geändert, Offen, Entfällt, Hinweise. Je Zeile links eine kleine Musterkarte aus denselben Bausteinen wie
/// das Raster (`Klassikstil`, `klassikKarte`, `Chipfeld`, `Statuschip`, `Kartenmarke`), rechts Name und ein sachlicher Satz.
/// Grün für jede Änderung, Rot nur für den Entfall (alles durchgestrichen), Grau für eine offene Vertretung; Kennzeichen in
/// Worten, ohne Pfeile – neuer Wert, dahinter der bisherige in Klammern durchgestrichen („Gal (G̶o̶r̶)“, `Wertwechsel`),
/// „entfällt“, „zusätzlich“, „verlegt auf/von …“ –, Titel und Mitteilungen einzeilig mit „…“.
struct PlanLegende: View {
    @Environment(\.dismiss) private var schliessen

    /// Eine Zeile der Musterkarte: Text bzw. Kennzeichen.
    fileprivate enum Musterzeile {
        case text(String)
        case feld(String, Chipton)
        /// Geänderter Wert als grünes Kennzeichen: neu, dahinter bisher in Klammern durchgestrichen
        case wechsel(String, String)
    }

    fileprivate struct Eintrag: Identifiable {
        let id: String
        let titel: String
        let text: String
        let stil: Klassikstil
        var fach: Musterzeile
        var zeilen: [Musterzeile]
        var chip: Kartenchip? = nil
        var entfall: Bool = false
        /// Mitteilung: hellgelber Block mit Titel statt Karte
        var notiz: String? = nil
    }

    fileprivate struct Gruppe: Identifiable {
        let id: String
        let titel: String
        let eintraege: [Eintrag]
    }

    private static func neutral() -> Klassikstil {
        Klassikstil(balken: Farben.balkenGrau, flaeche: Farben.karte, rand: nil, strich: StrokeStyle(lineWidth: 1),
                    schraffur: false, gedaempft: false)
    }

    private static func fachfarbe(_ farbe: Color) -> Klassikstil {
        var s = neutral()
        s.balken = farbe
        s.ton = farbe.opacity(0.12)
        return s
    }

    private static var aenderung: Klassikstil {
        var s = neutral()
        s.balken = Farben.aenderung
        s.rand = Farben.aenderung.opacity(0.55)
        s.flaeche = Farben.aenderungFlaeche
        s.marke = Farben.aenderung
        return s
    }

    private static var entfall: Klassikstil {
        var s = neutral()
        s.flaeche = Farben.flaeche2
        s.balken = Farben.entfall
        s.rand = Farben.entfall.opacity(0.35)
        s.titel = Farben.text3
        s.marke = Farben.entfall
        return s
    }

    private static var offen: Klassikstil {
        var s = neutral()
        s.rand = Farben.text3
        s.strich = StrokeStyle(lineWidth: 1, dash: [3, 2])
        s.marke = Farben.text3
        return s
    }

    private static var pruefung: Klassikstil {
        var s = neutral()
        s.flaeche = Farben.pruefungFlaeche
        s.rand = Farben.pruefung
        s.balken = Farben.pruefung
        return s
    }

    private static var notiz: Klassikstil {
        var s = neutral()
        s.mitBalken = false
        s.flaeche = Farben.ereignisFlaeche
        s.rand = Farben.ereignisRand
        s.titel = Farben.ereignisText
        return s
    }

    fileprivate static let gruppen: [Gruppe] = [
        Gruppe(id: "unterricht", titel: "Unterricht", eintraege: [
            Eintrag(id: "regulaer", titel: "Wie geplant", text: "Weiße Karte mit grauem Balken: Fach, Klasse, Lehrkraft, Raum.",
                    stil: neutral(), fach: .text("D"), zeilen: [.text("5a"), .text("Mül"), .text("204")]),
            Eintrag(id: "fachfarbe", titel: "Mit Fachfarbe", text: "Nur wenn die Schule dem Fach eine Farbe gegeben hat: Balken und leichte Tönung.",
                    stil: fachfarbe(Color(hexWert: 0x3E7CC9)), fach: .text("M"), zeilen: [.text("5a"), .text("Rth"), .text("126")]),
        ]),
        Gruppe(id: "aenderungen", titel: "Geändert (grün)", eintraege: [
            Eintrag(id: "vertretung", titel: "Vertretung", text: "Grüner Balken und Marke; auf der Lehrerzeile die neue Lehrkraft, dahinter die bisherige in Klammern durchgestrichen.",
                    stil: aenderung, fach: .text("SP1"), zeilen: [.text("6b"), .wechsel("Gal", "Gor"), .text("UH")]),
            Eintrag(id: "raum", titel: "Anderer Raum", text: "Neuer Raum, dahinter der bisherige in Klammern durchgestrichen; ein zusätzlicher Raum als „neu B070“.",
                    stil: aenderung, fach: .text("BILI"), zeilen: [.text("6b"), .text("Abr"), .wechsel("105", "303")]),
            Eintrag(id: "fach", titel: "Anderes Fach", text: "Neues Fach, dahinter das bisherige in Klammern durchgestrichen.",
                    stil: aenderung, fach: .wechsel("BI", "MU"), zeilen: [.text("6b"), .text("Kre"), .text("023")]),
            Eintrag(id: "verlegt-von", titel: "Hierher verlegt", text: "Unten der ursprüngliche Termin.",
                    stil: aenderung, fach: .text("M"), zeilen: [.text("10e"), .text("Rth"), .text("126")],
                    chip: Kartenchip(text: "verlegt von Mo 20.10., 3. Std", ton: .aenderung)),
            Eintrag(id: "zusatz", titel: "Zusätzliche Stunde", text: "Unten „zusätzlich“.",
                    stil: aenderung, fach: .text("BI"), zeilen: [.text("5e, 11"), .text("Abr"), .text("03")],
                    chip: Kartenchip(text: "zusätzlich", ton: .aenderung)),
        ]),
        Gruppe(id: "offen", titel: "Offen (grau)", eintraege: [
            Eintrag(id: "lehrer-fehlt", titel: "Vertretung folgt", text: "Die Lehrkraft fehlt, die Vertretung ist noch nicht eingeteilt – die Stunde fällt nicht aus. Schüler*innen und Eltern sehen „Vertretung folgt“.",
                    stil: offen, fach: .text("E4"), zeilen: [.text("12"), .feld("Abr fehlt", .offen), .text("21")]),
        ]),
        Gruppe(id: "entfall", titel: "Entfällt (rot)", eintraege: [
            Eintrag(id: "entfall", titel: "Entfall", text: "Roter Balken und Marke, alles durchgestrichen, unten „entfällt“.",
                    stil: entfall, fach: .text("E"), zeilen: [.text("7c"), .text("Had"), .text("403")],
                    chip: Kartenchip(text: "entfällt", ton: .entfall), entfall: true),
            Eintrag(id: "verlegt-nach", titel: "Verlegt", text: "Findet hier nicht statt – unten der neue Termin.",
                    stil: entfall, fach: .text("M"), zeilen: [.text("10e"), .text("Rth"), .text("126")],
                    chip: Kartenchip(text: "verlegt auf Di 21.10., 6. Std", ton: .entfall), entfall: true),
            Eintrag(id: "klasse-fehlt", titel: "Klasse fehlt", text: "Die Klasse ist abwesend (z. B. Exkursion): „5b fehlt“ und „entfällt“.",
                    stil: entfall, fach: .text("NAWI"), zeilen: [.feld("5b fehlt", .entfall), .text("Maq"), .text("122")],
                    chip: Kartenchip(text: "entfällt", ton: .entfall), entfall: true),
        ]),
        Gruppe(id: "hinweise", titel: "Hinweise", eintraege: [
            Eintrag(id: "pruefung", titel: "Prüfung", text: "Bernsteinfarbene Kontur und helle Fläche.",
                    stil: pruefung, fach: .text("D"), zeilen: [.text("9a"), .text("Mül"), .text("204")]),
            Eintrag(id: "mitteilung", titel: "Mitteilung, Veranstaltung", text: "Hellgelber Block über die echte Uhrzeit; zu lange Titel enden mit „…“ (ganz in den Details).",
                    stil: notiz, fach: .text(""), zeilen: [], notiz: "Aufbau der Bühne für das Schulfest ab 16:00 Uhr"),
        ]),
    ]

    var body: some View {
        NavigationStack {
            List {
                ForEach(PlanLegende.gruppen) { g in
                    Section(g.titel) {
                        ForEach(g.eintraege) { zeile($0) }
                    }
                }
                Section {
                    HStack(alignment: .center, spacing: 14) {
                        Text("+2")
                            .font(.system(size: 12, weight: .semibold))
                            .monospacedDigit()
                            .foregroundStyle(Farben.akzent)
                            .padding(.horizontal, 6)
                            .frame(minHeight: 22)
                            .background(Farben.primaerFlaeche, in: RoundedRectangle(cornerRadius: 3, style: .continuous))
                            .frame(width: PlanLegende.musterBreite, alignment: .center)
                        beschreibung("Weitere Stunden", "Zur selben Zeit finden weitere Stunden statt – antippen zeigt alle.")
                    }
                    .padding(.vertical, 2)
                    .accessibilityElement(children: .combine)
                } header: {
                    Text("Im Raster")
                } footer: {
                    Text("Die Art steht immer auch in Worten – nicht nur als Farbe; ein bisheriger Wert steht in Klammern und ist durchgestrichen. Ein Punkt im Tageskopf zeigt Änderungen (grün) bzw. Entfall (rot) an diesem Tag; die Stundendetails nennen jede Änderung ausführlich.")
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Kennzeichnungen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fertig") { schliessen() }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func beschreibung(_ titel: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(titel)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Farben.text)
            Text(text)
                .font(.footnote)
                .foregroundStyle(Farben.text2)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func zeile(_ e: Eintrag) -> some View {
        HStack(alignment: .top, spacing: 14) {
            muster(e)
            beschreibung(e.titel, e.text)
        }
        .padding(.vertical, 3)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(e.titel). \(e.text)")
    }

    static let musterBreite: CGFloat = 112

    @ViewBuilder
    private func musterzeile(_ z: Musterzeile, entfall: Bool, titel: Bool) -> some View {
        let schrift: Font = titel ? .system(size: 13.5, weight: .bold) : .system(size: 12)
        switch z {
        case .text(let t):
            Text(t)
                .font(schrift)
                .foregroundStyle(entfall ? Farben.text3 : (titel ? Farben.text : Farben.text2))
                .strikethrough(entfall, color: Farben.entfall.opacity(0.8))
                .lineLimit(1)
        case .feld(let t, let ton):
            Chipfeld(ton: ton) {
                Text(t).font(titel ? .system(size: 13.5, weight: .bold) : .system(size: 12, weight: .semibold))
            }
        case .wechsel(let neu, let alt):
            Chipfeld(ton: .aenderung) {
                Wertwechsel.text(neu, statt: alt, gewicht: titel ? Font.Weight.bold : Font.Weight.semibold)
                    .font(titel ? .system(size: 13.5) : .system(size: 12))
            }
        }
    }

    private func muster(_ e: Eintrag) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            if let notiz = e.notiz {
                Text(notiz)
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(Farben.ereignisText)
                    .lineLimit(1)
                    .truncationMode(.tail)
                Text("16:00–18:00")
                    .font(.system(size: 11))
                    .monospacedDigit()
                    .foregroundStyle(Farben.text2)
                    .padding(.top, 2)
            } else {
                musterzeile(e.fach, entfall: e.entfall, titel: true)
                    .frame(height: 15.5, alignment: .leading)
                ForEach(Array(e.zeilen.enumerated()), id: \.offset) { _, z in
                    musterzeile(z, entfall: e.entfall, titel: false)
                        .frame(height: 13.5, alignment: .leading)
                }
                Spacer(minLength: 0)
                if let chip = e.chip {
                    Statuschip(chip: chip, schrift: .system(size: 12, weight: .semibold))
                        .frame(height: 13.5, alignment: .leading)
                }
            }
        }
        .padding(.leading, e.stil.mitBalken ? 8 : 6)
        .padding(.trailing, 4)
        .padding(.top, 4)
        .padding(.bottom, 3)
        .frame(width: PlanLegende.musterBreite, height: e.notiz == nil ? 82 : 44, alignment: .topLeading)
        .clipped()
        .klassikKarte(e.stil, radius: 6)
        .accessibilityHidden(true)
    }
}
