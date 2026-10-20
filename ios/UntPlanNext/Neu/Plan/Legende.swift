import SwiftUI

/// Legende der Stundenkarten (Menü „…“ des Plans) wie die Änderungslegende von Enbrea („Änderungstyp | Darstellung“):
/// links der Änderungstyp mit einem sachlichen Satz, rechts eine kleine Musterkarte. Die Muster benutzen dieselben
/// Bausteine wie das Raster (`Klassikstil`, `klassikKarte`, `Chipfeld`, `Statuschip`), stimmen also hell und dunkel.
/// EduOrga-Anpassungen: jede Änderung einheitlich Grün, Entfall und Fehlendes Rot, bei Entfall alles durchgestrichen;
/// ohne Fachfarbe bleibt die Karte neutral.
struct PlanLegende: View {
    @Environment(\.dismiss) private var schliessen

    /// Eine Zeile der Musterkarte: Text, grünes bzw. rotes Feld.
    fileprivate enum Musterzeile {
        case text(String)
        case feld(String, Chipton)
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
        /// Mitteilung: hellgelber Block mit Text statt Karte
        var notiz: String? = nil
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
        s.gestreift = true
        s.rand = Farben.aenderung.opacity(0.55)
        s.flaeche = Farben.aenderungFlaeche
        return s
    }

    private static var entfall: Klassikstil {
        var s = neutral()
        s.flaeche = Farben.flaeche2
        s.balken = Farben.entfall
        s.gestreift = true
        s.schraffur = true
        s.rand = Farben.entfall.opacity(0.35)
        s.titel = Farben.text3
        return s
    }

    private static var offen: Klassikstil {
        var s = neutral()
        s.balken = Farben.entfall
        s.gestreift = true
        s.rand = Farben.entfall.opacity(0.7)
        s.strich = StrokeStyle(lineWidth: 1, dash: [3, 2])
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

    fileprivate static let unterricht: [Eintrag] = [
        Eintrag(id: "regulaer", titel: "Unterricht", text: "Neutrale Karte mit grauem Balken – Fach, Klasse, Lehrkraft, Raum.",
                stil: neutral(), fach: .text("D"), zeilen: [.text("5a"), .text("Mül"), .text("204")]),
        Eintrag(id: "fachfarbe", titel: "Unterricht mit Fachfarbe", text: "Nur wenn die Schule dem Fach eine Farbe gegeben hat: Balken und leichte Fläche in dieser Farbe.",
                stil: fachfarbe(Color(hexWert: 0x3E7CC9)), fach: .text("M"), zeilen: [.text("5a"), .text("Rth"), .text("126")]),
    ]

    fileprivate static let aenderungen: [Eintrag] = [
        Eintrag(id: "klasse-fehlt", titel: "Klasse fehlt", text: "Die Klasse ist abwesend: alles durchgestrichen, „(5b)“ und „× entfällt“ rot.",
                stil: entfall, fach: .text("NAWI"), zeilen: [.feld("(5b)", .entfall), .text("Maq"), .text("122")],
                chip: Kartenchip(text: "× entfällt", ton: .entfall), entfall: true),
        Eintrag(id: "lehrer-fehlt", titel: "Lehrer fehlt, keine Vertretung erstellt", text: "Rot schraffierter Rand, die fehlende Lehrkraft als rotes Feld „(Abr)“.",
                stil: offen, fach: .text("E4"), zeilen: [.text("12"), .feld("(Abr)", .entfall), .text("21")]),
        Eintrag(id: "entfall", titel: "Vertretungsentfall", text: "Die Stunde entfällt: alles grau durchgestrichen, darunter „× entfällt“.",
                stil: entfall, fach: .text("E"), zeilen: [.text("7c"), .text("Had"), .text("403")],
                chip: Kartenchip(text: "× entfällt", ton: .entfall), entfall: true),
        Eintrag(id: "vertretung", titel: "Lehrervertretung", text: "Grün schraffierter Rand, die neue Lehrkraft mit der bisherigen in Klammern.",
                stil: aenderung, fach: .text("SP1"), zeilen: [.text("6b"), .feld("+Gal (Gor)", .aenderung), .text("UH")]),
        Eintrag(id: "raum", titel: "Raumänderung", text: "Neuer Raum mit dem bisherigen in Klammern.",
                stil: aenderung, fach: .text("BILI"), zeilen: [.text("6b"), .text("Abr"), .feld("+105 (303)", .aenderung)]),
        Eintrag(id: "fach", titel: "Fachänderung", text: "Neues Fach mit dem bisherigen in Klammern.",
                stil: aenderung, fach: .feld("+BI (MU)", .aenderung), zeilen: [.text("6b"), .text("Kre"), .text("023")]),
        Eintrag(id: "verlegt-nach", titel: "Verschoben auf einen anderen Termin", text: "Die Stunde findet hier nicht statt (durchgestrichen) – unten der neue Termin: Tag, Datum, Stunde und Uhrzeit.",
                stil: entfall, fach: .text("M"), zeilen: [.text("10e"), .text("Rth"), .text("126")],
                chip: Kartenchip(text: "× auf Di 21.10. 6 | 12:20", ton: .entfall), entfall: true),
        Eintrag(id: "verlegt-von", titel: "Verschoben von einem anderen Termin", text: "Hierher verlegte Stunde – unten der ursprüngliche Termin.",
                stil: aenderung, fach: .text("M"), zeilen: [.text("10e"), .text("Rth"), .text("126")],
                chip: Kartenchip(text: "⊕ von Mo 20.10. 3 | 09:45", ton: .aenderung)),
        Eintrag(id: "zusatz", titel: "Zusatzunterricht", text: "Zusätzliche Stunde mit „⊕ Zusatz“.",
                stil: aenderung, fach: .text("BI"), zeilen: [.text("5e, 11"), .text("Abr"), .text("03")],
                chip: Kartenchip(text: "⊕ Zusatz", ton: .aenderung)),
        Eintrag(id: "mitteilung", titel: "Mitteilung", text: "Hinweis bzw. Veranstaltung als hellgelber Block mit Text über die echte Uhrzeit.",
                stil: notiz, fach: .text(""), zeilen: [], notiz: "Aufbau der Bühne ab 16:00 Uhr"),
        Eintrag(id: "pruefung", titel: "Prüfung", text: "Bernsteinfarbener Rand und helle Fläche.",
                stil: pruefung, fach: .text("D"), zeilen: [.text("9a"), .text("Mül"), .text("204")]),
    ]

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(PlanLegende.unterricht) { zeile($0) }
                } header: {
                    kopf
                }
                Section {
                    ForEach(PlanLegende.aenderungen) { zeile($0) }
                    HStack(alignment: .top, spacing: 14) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Weitere Stunden")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Farben.text)
                            Text("Zur selben Zeit finden weitere Stunden statt. Antippen zeigt alle.")
                                .font(.footnote)
                                .foregroundStyle(Farben.text2)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        Spacer(minLength: 8)
                        Text("+2")
                            .font(.system(size: 11.5, weight: .semibold))
                            .monospacedDigit()
                            .foregroundStyle(Farben.akzent)
                            .padding(.horizontal, 5)
                            .frame(minHeight: 20)
                            .background(Farben.primaerFlaeche, in: RoundedRectangle(cornerRadius: 4, style: .continuous))
                            .frame(width: PlanLegende.musterBreite, alignment: .center)
                    }
                    .padding(.vertical, 2)
                    .accessibilityElement(children: .combine)
                } header: {
                    Text("Änderungen")
                } footer: {
                    Text("Jede Änderung ist grün, Entfall und Fehlendes rot. Ein Punkt im Tageskopf zeigt Änderungen (grün) bzw. Entfall (rot) an diesem Tag. Die Stundendetails nennen jede Änderung ausführlich.")
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Legende")
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

    private var kopf: some View {
        HStack {
            Text("Änderungstyp")
            Spacer()
            Text("Darstellung")
                .frame(width: PlanLegende.musterBreite, alignment: .center)
        }
    }

    private func zeile(_ e: Eintrag) -> some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 3) {
                Text(e.titel)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Farben.text)
                Text(e.text)
                    .font(.footnote)
                    .foregroundStyle(Farben.text2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 8)
            muster(e)
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(e.titel). \(e.text)")
    }

    static let musterBreite: CGFloat = 96

    @ViewBuilder
    private func musterzeile(_ z: Musterzeile, entfall: Bool, titel: Bool) -> some View {
        let schrift: Font = titel ? .system(size: 13, weight: .bold) : .system(size: 11)
        switch z {
        case .text(let t):
            Text(t)
                .font(schrift)
                .foregroundStyle(entfall ? Farben.text3 : (titel ? Farben.text : Farben.text2))
                .strikethrough(entfall, color: Farben.entfall.opacity(0.8))
                .lineLimit(1)
        case .feld(let t, let ton):
            Chipfeld(ton: ton) {
                Text(t).font(titel ? .system(size: 13, weight: .bold) : .system(size: 11, weight: .semibold))
            }
        }
    }

    private func muster(_ e: Eintrag) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            if let notiz = e.notiz {
                Text(notiz)
                    .font(.system(size: 11))
                    .foregroundStyle(Farben.ereignisText)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                musterzeile(e.fach, entfall: e.entfall, titel: true)
                    .frame(height: 15, alignment: .leading)
                ForEach(Array(e.zeilen.enumerated()), id: \.offset) { _, z in
                    musterzeile(z, entfall: e.entfall, titel: false)
                        .frame(height: 12.5, alignment: .leading)
                }
                Spacer(minLength: 0)
                if let chip = e.chip {
                    Statuschip(chip: chip, schrift: .system(size: 9.5, weight: .semibold))
                        .frame(height: 12.5, alignment: .leading)
                }
            }
        }
        .padding(.leading, e.stil.mitBalken ? 9 : 6)
        .padding(.trailing, 3)
        .padding(.top, 3)
        .padding(.bottom, 2)
        .frame(width: PlanLegende.musterBreite, height: 72, alignment: .topLeading)
        .klassikKarte(e.stil, radius: 6)
        .accessibilityHidden(true)
    }
}
