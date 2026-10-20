import SwiftUI

/// Legende der Stundenkarten (Menü „…“ des Plans): jede Darstellung als kleine Musterkarte mit einem sachlichen Satz.
/// Die Muster benutzen dieselben Stile wie das Raster (`Klassikstil`, `klassikKarte`), stimmen also hell und dunkel.
struct PlanLegende: View {
    @Environment(\.dismiss) private var schliessen

    private struct Eintrag: Identifiable {
        let id: String
        let titel: String
        let text: String
        let stil: Klassikstil
        var fach: String = "D"
        var zeile2: String = "5a"
        var zeile2Geaendert: Bool = false
        var entfall: Bool = false
    }

    private static func basis(_ farbe: Color = Color(hexWert: 0x3E7CC9)) -> Klassikstil {
        var s = Klassikstil(balken: farbe, flaeche: Farben.karte, rand: nil, strich: StrokeStyle(lineWidth: 1),
                            schraffur: false, gedaempft: false)
        s.ton = farbe.opacity(0.12)
        return s
    }

    private var eintraege: [Eintrag] {
        var aenderung = PlanLegende.basis()
        aenderung.balken = Farben.aenderung
        aenderung.gestreift = true
        aenderung.rand = Farben.aenderung.opacity(0.55)
        aenderung.ton = nil
        aenderung.flaeche = Farben.aenderungFlaeche

        var entfall = PlanLegende.basis()
        entfall.ton = nil
        entfall.flaeche = Farben.flaeche2
        entfall.balken = Farben.balkenGrau.opacity(0.6)
        entfall.schraffur = true
        entfall.rand = Farben.entfall.opacity(0.35)

        var offen = aenderung
        offen.offen = true
        offen.rand = Farben.aenderung
        offen.strich = StrokeStyle(lineWidth: 1.2, dash: [3, 2])

        var pruefung = PlanLegende.basis()
        pruefung.ton = nil
        pruefung.flaeche = Farben.pruefungFlaeche
        pruefung.rand = Farben.pruefung

        var ereignis = PlanLegende.basis()
        ereignis.ton = nil
        ereignis.mitBalken = false
        ereignis.flaeche = Farben.ereignisFlaeche
        ereignis.rand = Farben.ereignisRand

        return [
            Eintrag(id: "regulaer", titel: "Unterricht", text: "Balken und leichte Fläche in der Fachfarbe.",
                    stil: PlanLegende.basis()),
            Eintrag(id: "aenderung", titel: "Änderung", text: "Schraffierter violetter Balken. Geänderte Lehrkraft bzw. geänderter Raum im violetten Feld: neu (bisher).",
                    stil: aenderung, zeile2: "Ara (Abr)", zeile2Geaendert: true),
            Eintrag(id: "offen", titel: "Vertretung offen", text: "Gestrichelter violetter Rand mit „?“ – die Stunde ist noch keiner Lehrkraft zugeteilt.",
                    stil: offen),
            Eintrag(id: "entfall", titel: "Entfall", text: "Grau, schraffiert und durchgestrichen, darunter „Entfall“ in Rot.",
                    stil: entfall, zeile2: "Entfall", entfall: true),
            Eintrag(id: "pruefung", titel: "Prüfung", text: "Bernsteinfarbener Rand und helle Fläche.",
                    stil: pruefung),
            Eintrag(id: "ereignis", titel: "Veranstaltung", text: "Warmer Block im Raster über die echte Uhrzeit (AG, Schulfest, Termin) – neben Unterricht schmal am rechten Rand.",
                    stil: ereignis, fach: "AG", zeile2: "14:15"),
        ]
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(eintraege) { e in
                        HStack(alignment: .top, spacing: 14) {
                            muster(e)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(e.titel)
                                    .font(.body.weight(.semibold))
                                    .foregroundStyle(Farben.text)
                                Text(e.text)
                                    .font(.subheadline)
                                    .foregroundStyle(Farben.text2)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                        .padding(.vertical, 4)
                        .accessibilityElement(children: .combine)
                    }
                    HStack(alignment: .top, spacing: 14) {
                        Text("+2")
                            .font(.system(size: 11.5, weight: .semibold))
                            .monospacedDigit()
                            .foregroundStyle(Farben.akzent)
                            .padding(.horizontal, 5)
                            .frame(minHeight: 20)
                            .background(Farben.primaerFlaeche, in: RoundedRectangle(cornerRadius: 4, style: .continuous))
                            .frame(width: 64, alignment: .trailing)
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Weitere Stunden")
                                .font(.body.weight(.semibold))
                                .foregroundStyle(Farben.text)
                            Text("Zur selben Zeit finden weitere Stunden statt. Antippen zeigt alle.")
                                .font(.subheadline)
                                .foregroundStyle(Farben.text2)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .padding(.vertical, 4)
                    .accessibilityElement(children: .combine)
                } footer: {
                    Text("Ein Punkt im Tageskopf zeigt Änderungen (violett) bzw. Entfall (rot) an diesem Tag. Die Stundendetails nennen jede Änderung ausführlich.")
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

    private func muster(_ e: Eintrag) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(e.fach)
                .font(.system(size: 13.5, weight: .bold))
                .foregroundStyle(e.entfall ? Farben.text3 : Farben.text)
                .strikethrough(e.entfall, color: Farben.entfall)
            Group {
                if e.zeile2Geaendert {
                    Text(e.zeile2)
                        .foregroundStyle(Farben.aenderungText)
                        .padding(.horizontal, 3)
                        .background(Farben.aenderungChip, in: RoundedRectangle(cornerRadius: 3, style: .continuous))
                } else {
                    Text(e.zeile2)
                        .foregroundStyle(e.entfall ? Farben.entfall : Farben.text2)
                }
            }
            .font(.system(size: 11, weight: e.entfall ? .semibold : .regular))
            .lineLimit(1)
            .minimumScaleFactor(0.7)
        }
        .padding(.leading, e.stil.mitBalken ? 9 : 6)
        .padding(.trailing, 3)
        .padding(.vertical, 4)
        .frame(width: 64, height: 44, alignment: .topLeading)
        .klassikKarte(e.stil, radius: 6)
        .accessibilityHidden(true)
    }
}
