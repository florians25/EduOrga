import SwiftUI

/// Ziele im Reiter „Schule“.
enum Schulziel: Hashable {
    // Klassenbuch (Kollegium)
    case offeneStunden
    case eintraege
    case hausaufgabenKollegium
    case dienste
    case befreiungen
    case sitzplan
    case entschuldigungen
    // Unterricht
    case pruefungen
    case vertretungsplan
    // Melden
    case abwesenheitMelden
    case pruefungEintragen
    case meineMeldungen
    // Buchen
    case raumBuchen
    case ressourceBuchen
    case meineBuchungen
    // Sprechtag, Infos
    case sprechtage
    case neuigkeiten
    case termine
    case eigeneAbwesenheiten
    // Familie und Klassenkonten
    case familieHausaufgaben
    case familieAbwesenheiten
    case klassenHausaufgaben
}

/// Stammdaten (Klassen, Lehrkräfte, Räume, Zeitraster) für Auswahllisten – einmal je Konto geladen.
@MainActor
enum Stammdaten {
    static var elemente: Elemente? = nil

    static func laden(_ api: ApiClient) async -> Elemente? {
        if let e = elemente { return e }
        let e = try? await api.elemente()
        elemente = e
        return e
    }

    static func leeren() {
        elemente = nil
    }
}

/// Reiter „Schule“: alle Bereiche von EduOrga Web, die unterwegs gebraucht werden – je nach Rolle:
/// - Lehrkräfte: Klassenbuch (offene Stunden, Einträge, Hausaufgaben, Klassendienste, Abwesenheiten und
///   Entschuldigungen, Befreiungen, Sitzplan), Prüfungen und Vertretungsplan, Melden (Abwesenheit, Prüfung, Meine
///   Meldungen), Buchen (Raum, Ressource, Meine Buchungen), Sprechtag, Neuigkeiten.
/// - Schüler*innen und Eltern: Hausaufgaben, Abwesenheiten (mit Entschuldigungsschreiben), Prüfungen,
///   Vertretungsplan, Sprechtag, Neuigkeiten.
/// Navigation ohne Symbole vor den Einträgen (wie in Profil und Einstellungen), Zahlen rechts.
struct SchuleView: View {
    @EnvironmentObject var zustand: AppZustand
    @ObservedObject private var puffer = Schreibpuffer.shared
    @State private var offen: Int? = nil
    @State private var ungelesen = 0
    @State private var meldungenOffen = 0

    private var b: SitzungsBenutzer? { zustand.benutzer }

    var body: some View {
        NavigationStack {
            List {
                if puffer.anzahl > 0 {
                    Section {
                        SchreibpufferLeiste()
                            .listRowInsets(EdgeInsets())
                            .listRowBackground(Color.clear)
                    }
                }
                if zustand.istKollegium {
                    kollegium
                } else if zustand.istFamilie {
                    familie
                } else {
                    klassenkonto
                }
                Section("Infos") {
                    NavigationLink(value: Schulziel.neuigkeiten) {
                        Mehrzeile(titel: "Neuigkeiten", wert: ungelesen > 0 ? "\(ungelesen) neu" : nil)
                    }
                    NavigationLink(value: Schulziel.termine) {
                        Mehrzeile(titel: "Termine")
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Schule")
            .navigationBarTitleDisplayMode(.large)
            .profilWerkzeug()
            .navigationDestination(for: Schulziel.self) { ziel in
                Schulzielseite(ziel: ziel)
                    .environmentObject(zustand)
            }
            .refreshable { await zahlenLaden() }
            .task { await zahlenLaden() }
        }
    }

    // MARK: Kollegium

    @ViewBuilder
    private var kollegium: some View {
        Section {
            NavigationLink(value: Schulziel.offeneStunden) {
                Mehrzeile(titel: "Offene Stunden", wert: offen.map { $0 > 0 ? "\($0)" : "keine" })
            }
            NavigationLink(value: Schulziel.eintraege) {
                Mehrzeile(titel: "Klassenbucheinträge")
            }
            NavigationLink(value: Schulziel.hausaufgabenKollegium) {
                Mehrzeile(titel: "Hausaufgaben")
            }
            NavigationLink(value: Schulziel.dienste) {
                Mehrzeile(titel: "Klassendienste")
            }
            if (zustand.entschuldigungsrechte?.irgendwas ?? false) || b?.fehlzeiten == true {
                NavigationLink(value: Schulziel.entschuldigungen) {
                    Mehrzeile(titel: b?.fehlzeiten == true ? "Abwesenheiten und Entschuldigungen" : "Fehlzeiten eigener Unterricht")
                }
            }
            NavigationLink(value: Schulziel.befreiungen) {
                Mehrzeile(titel: "Befreiungen")
            }
            NavigationLink(value: Schulziel.sitzplan) {
                Mehrzeile(titel: "Sitzplan")
            }
        } header: {
            Text("Klassenbuch")
        } footer: {
            Text("Lehrstoff, Hausaufgaben und Anwesenheit einer Stunde tragen Sie direkt in der Stunde ein (Stunde im Plan antippen).")
        }
        Section("Unterricht") {
            NavigationLink(value: Schulziel.pruefungen) {
                Mehrzeile(titel: "Prüfungen")
            }
            if zustand.darf("vertretung.lehrer") || zustand.darf("vertretung.schueler") {
                NavigationLink(value: Schulziel.vertretungsplan) {
                    Mehrzeile(titel: "Vertretungsplan")
                }
            }
        }
        Section("Melden") {
            NavigationLink(value: Schulziel.abwesenheitMelden) {
                Mehrzeile(titel: "Abwesenheit melden")
            }
            if zustand.darf("pruefung.anlegen") {
                NavigationLink(value: Schulziel.pruefungEintragen) {
                    Mehrzeile(titel: "Prüfung eintragen")
                }
            }
            NavigationLink(value: Schulziel.meineMeldungen) {
                Mehrzeile(titel: "Meine Meldungen", wert: meldungenOffen > 0 ? "\(meldungenOffen) offen" : nil)
            }
            NavigationLink(value: Schulziel.eigeneAbwesenheiten) {
                Mehrzeile(titel: "Meine Abwesenheiten")
            }
        }
        if zustand.darf("buchung.raum") || zustand.darf("buchung.ressourcen") {
            Section("Buchen") {
                if zustand.darf("buchung.raum") {
                    NavigationLink(value: Schulziel.raumBuchen) {
                        Mehrzeile(titel: "Raum buchen")
                    }
                }
                if zustand.darf("buchung.ressourcen") {
                    NavigationLink(value: Schulziel.ressourceBuchen) {
                        Mehrzeile(titel: "Ressource buchen")
                    }
                }
                NavigationLink(value: Schulziel.meineBuchungen) {
                    Mehrzeile(titel: "Meine Buchungen")
                }
            }
        }
        Section("Sprechtag") {
            NavigationLink(value: Schulziel.sprechtage) {
                Mehrzeile(titel: "Sprechtage")
            }
        }
    }

    // MARK: Familie

    @ViewBuilder
    private var familie: some View {
        Section {
            NavigationLink(value: Schulziel.familieHausaufgaben) {
                Mehrzeile(titel: "Hausaufgaben")
            }
            NavigationLink(value: Schulziel.familieAbwesenheiten) {
                Mehrzeile(titel: "Abwesenheiten und Entschuldigungen")
            }
            NavigationLink(value: Schulziel.pruefungen) {
                Mehrzeile(titel: "Prüfungen")
            }
            if zustand.darf("vertretung.schueler") || zustand.darf("vertretung.lehrer") {
                NavigationLink(value: Schulziel.vertretungsplan) {
                    Mehrzeile(titel: "Vertretungsplan")
                }
            }
        } header: {
            Text(zustand.istEltern ? "Meine Kinder" : "Mein Unterricht")
        }
        if zustand.istEltern || zustand.darf("sprechtag.verwalten", vorgabe: false) || (b?.rolle.lowercased() == "schueler") {
            Section("Sprechtag") {
                NavigationLink(value: Schulziel.sprechtage) {
                    Mehrzeile(titel: zustand.istEltern ? "Sprechtage und Termine buchen" : "Sprechtage")
                }
            }
        }
    }

    // MARK: Klassenkonto

    @ViewBuilder
    private var klassenkonto: some View {
        Section("Unterricht") {
            NavigationLink(value: Schulziel.klassenHausaufgaben) {
                Mehrzeile(titel: "Hausaufgaben")
            }
            NavigationLink(value: Schulziel.pruefungen) {
                Mehrzeile(titel: "Prüfungen")
            }
            if zustand.darf("vertretung.schueler") || zustand.darf("vertretung.lehrer") {
                NavigationLink(value: Schulziel.vertretungsplan) {
                    Mehrzeile(titel: "Vertretungsplan")
                }
            }
        }
    }

    // MARK: Zahlen

    private func zahlenLaden() async {
        let api = zustand.api
        async let info = try? api.infocenter()
        async let meldungen = try? api.meldungen()
        if zustand.istKollegium {
            await zustand.entschuldigungsrechteLaden()
            if let h = Heutespeicher.heute {
                offen = h.offeneStunden
            } else if let h = try? await api.heute() {
                offen = h.offeneStunden
            }
        }
        ungelesen = await info?.ungelesen ?? 0
        meldungenOffen = (await meldungen ?? []).filter { $0.status == "offen" }.count
    }
}

/// Seite eines Ziels im Reiter „Schule“.
struct Schulzielseite: View {
    let ziel: Schulziel
    @EnvironmentObject var zustand: AppZustand
    @Namespace private var zoom
    @State private var wahl: Stundenwahl? = nil

    var body: some View {
        inhalt
            .stundenBuehne($wahl, raum: zoom, zustand: zustand)
    }

    @ViewBuilder
    private var inhalt: some View {
        switch ziel {
        case .offeneStunden:
            OffeneStundenView { karte in oeffnen(karte) }
        case .eintraege:
            KlassenbucheintraegeView()
        case .hausaufgabenKollegium:
            HausaufgabenListeView(art: .kollegium)
        case .dienste:
            KlassendiensteView()
        case .befreiungen:
            BefreiungenView()
        case .sitzplan:
            SitzplanKlasseView()
        case .entschuldigungen:
            EntschuldigungenView()
        case .pruefungen:
            PruefungenView()
        case .vertretungsplan:
            VertretungsplanView()
        case .abwesenheitMelden:
            AbwesenheitMeldenView()
        case .pruefungEintragen:
            PruefungEintragenView()
        case .meineMeldungen:
            MeineMeldungenView()
        case .raumBuchen:
            BuchenView(art: .raum)
        case .ressourceBuchen:
            BuchenView(art: .ressource)
        case .meineBuchungen:
            MeineBuchungenView()
        case .sprechtage:
            SprechtagListeView()
        case .neuigkeiten:
            NeuigkeitenListeView()
        case .termine:
            StartlisteView(ziel: .termine, heute: nil) { karte in oeffnen(karte) }
        case .eigeneAbwesenheiten:
            StartlisteView(ziel: .abwesenheiten, heute: nil) { karte in oeffnen(karte) }
        case .familieHausaufgaben:
            HausaufgabenListeView(art: .familie)
        case .familieAbwesenheiten:
            FamilieAbwesenheitenSeite()
        case .klassenHausaufgaben:
            HausaufgabenListeView(art: .klasse)
        }
    }

    private func oeffnen(_ karte: Karte) {
        wahl = Stundenwahl(quelle: "schule-\(karte.id.uuidString)", karten: [karte],
                           typ: zustand.benutzer?.typ ?? "lehrer", element: zustand.benutzer?.element ?? "")
    }
}
