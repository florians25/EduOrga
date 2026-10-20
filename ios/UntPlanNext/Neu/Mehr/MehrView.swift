import SwiftUI
import UIKit

/// Unterseiten von Profil und Einstellungen („Mehr“).
enum Mehrseite: Hashable {
    case kontaktdaten
    case passwort
    case neues
    case ueber
    case darstellung
    case benachrichtigungen
}

/// Reiter „Profil“ (Profil und Einstellungen): oben das Profil (Name, Rolle, Schule) mit
/// Konten und Schulen, darunter Schule und Unterricht (Termine, Abwesenheiten, Entschuldigungen, Aufsichten,
/// Hausaufgaben, Änderungen), Sprechtage, Einstellungen (Mitteilungen, Darstellung, Kontaktdaten und Kalender,
/// Passwort) und Info sowie Abmelden. Pläne anderer Klassen, Lehrkräfte und Räume findet die Suche (Lupe oben rechts).
struct MehrView: View {
    @EnvironmentObject var zustand: AppZustand
    @Namespace private var zoom
    @State private var profil: Profil? = nil
    @State private var fehler: String? = nil
    @State private var bestaetigen = false
    @State private var konten = false
    @State private var sprechtage: [SprechtagKarte] = []
    @State private var sprechtagWahl: SprechtagWahl? = nil
    @State private var wahl: Stundenwahl? = nil
    /// „Einzelheiten in Mitteilungen“ (Standard: aus – datensparsam auf dem Sperrbildschirm)
    @AppStorage(Datenschutz.detailsSchluessel) private var mitteilungenDetails = false
    @Environment(\.horizontalSizeClass) private var groessenklasse
    @Environment(\.dismiss) private var schliessen

    private var login: String { profil?.login ?? zustand.benutzer?.login ?? "" }

    private var name: String {
        if let p = profil, !p.anzeigename.isEmpty { return p.anzeigename }
        let n = zustand.benutzer?.name ?? ""
        return n.isEmpty ? login : n
    }

    /// Eigener Plan (Kürzel bzw. Klasse), sonst leer.
    private var element: String { profil?.element ?? zustand.benutzer?.element ?? "" }

    private var rolle: String {
        let r = zustand.benutzer?.rollenname ?? ""
        return r.isEmpty ? (profil?.rolle ?? "") : r
    }

    /// Initialen für das Profilfeld.
    private var initialen: String {
        let teile = name.split(separator: " ").prefix(2)
        let t = teile.compactMap { $0.first.map { String($0).uppercased() } }.joined()
        return t.isEmpty ? "?" : t
    }

    var body: some View {
        NavigationStack {
            List {
                if let fehler {
                    Section {
                        Fehlerhinweis(text: fehler)
                            .listRowInsets(EdgeInsets())
                            .listRowBackground(Color.clear)
                    }
                }
                profilAbschnitt
                unterrichtAbschnitt
                if !sprechtage.isEmpty {
                    sprechtagAbschnitt
                }
                einstellungenAbschnitt
                Section {
                    Button(role: .destructive) {
                        bestaetigen = true
                    } label: {
                        Text("Abmelden")
                            .foregroundStyle(Farben.entfall)
                    }
                } footer: {
                    Text("EduOrga \(MehrView.version) · Einfach mehr Schulalltag.")
                        .frame(maxWidth: .infinity)
                        .padding(.top, 8)
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Profil")
            .navigationBarTitleDisplayMode(.large)
            .scrollContentBackground(.hidden)
            .background(Farben.grund.ignoresSafeArea())
            .navigationDestination(for: Mehrseite.self) { seite in
                switch seite {
                case .kontaktdaten: KontaktdatenView(profil: profil, name: name)
                case .passwort: PasswortView()
                case .neues: NeuigkeitenView()
                case .ueber: UeberView()
                case .darstellung: DarstellungView()
                case .benachrichtigungen: BenachrichtigungenView()
                }
            }
            .navigationDestination(for: Startziel.self) { ziel in
                Startzielseite(ziel: ziel, heute: nil, sprechtage: sprechtage) { karte in
                    wahl = Stundenwahl(quelle: "mehr-\(karte.id.uuidString)", karten: [karte],
                                       typ: zustand.benutzer?.typ ?? "klasse", element: element)
                }
            }
            .detailPraesentation(item: $sprechtagWahl, breit: groessenklasse == .regular) { w in
                NavigationStack {
                    SprechtagView(id: w.id, titel: w.titel, karte: sprechtage.first { $0.id == w.id })
                }
                .environmentObject(zustand)
            }
            .blattPraesentation(isPresented: $konten, breit: groessenklasse == .regular) {
                KontenauswahlView()
                    .environmentObject(zustand)
            }
            .refreshable { await laden() }
            .task { await laden() }
            // Einrichtungslink „untplannext://einrichten?server=…“ im angemeldeten Zustand: Konten mit „Konto hinzufügen“
            .onAppear { if zustand.einrichtungsAdresse != nil { konten = true } }
            .onChange(of: zustand.einrichtungsAdresse) { _, neu in
                if neu != nil { konten = true }
            }
            .confirmationDialog("Wirklich abmelden?", isPresented: $bestaetigen, titleVisibility: .visible) {
                Button("Abmelden", role: .destructive) {
                    Task { await zustand.abmelden() }
                }
                Button("Abbrechen", role: .cancel) {}
            } message: {
                Text(zustand.konten.count > 1
                     ? "Dieses Konto wird vom Gerät entfernt (ein gemerktes Passwort wird gelöscht); die App wechselt in Ihr nächstes Konto."
                     : "Ein gemerktes Passwort wird vom Gerät entfernt.")
            }
        }
        .stundenBuehne($wahl, raum: zoom, zustand: zustand)
    }

    // MARK: - Abschnitte

    /// Profil: Initialen, Name, Rolle und Schule; darunter Konten wechseln bzw. hinzufügen.
    private var profilAbschnitt: some View {
        Section {
            NavigationLink(value: Mehrseite.kontaktdaten) {
                HStack(spacing: 14) {
                    Text(initialen)
                        .font(.title3.weight(.bold))
                        .foregroundStyle(Farben.aufAkzent)
                        .frame(width: 52, height: 52)
                        .background(Farben.akzent, in: Circle())
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(name)
                            .font(.headline)
                            .foregroundStyle(Farben.text)
                            .lineLimit(1)
                        Text([element.isEmpty ? login : element, rolle].filter { !$0.isEmpty }.joined(separator: " · "))
                            .font(.subheadline)
                            .foregroundStyle(Farben.text2)
                            .lineLimit(1)
                        Text([zustand.schulname, zustand.aktivesKonto?.serverKurz ?? ""].filter { !$0.isEmpty }.joined(separator: " · "))
                            .font(.footnote)
                            .foregroundStyle(Farben.text3)
                            .lineLimit(1)
                            .truncationMode(.middle)
                    }
                }
                .padding(.vertical, 6)
            }
            Button {
                konten = true
            } label: {
                Mehrzeile(titel: "Konten und Schulen",
                          wert: zustand.konten.count > 1 ? "\(zustand.konten.count)" : nil, pfeil: true)
            }
            .buttonStyle(.plain)
        } header: {
            Text("Profil")
        }
    }

    /// Schule und Unterricht: Termine, Abwesenheiten, Entschuldigungen, Hausaufgaben, Pausenaufsichten.
    private var unterrichtAbschnitt: some View {
        Section("Schule und Unterricht") {
            NavigationLink(value: Startziel.termine) {
                Mehrzeile(titel: "Meine Termine")
            }
            if zustand.istKollegium {
                NavigationLink(value: Startziel.abwesenheiten) {
                    Mehrzeile(titel: "Meine Abwesenheiten")
                }
                if zustand.entschuldigungsrechte?.irgendwas == true {
                    NavigationLink(value: Startziel.entschuldigungen) {
                        Mehrzeile(titel: "Entschuldigungen")
                    }
                }
                NavigationLink(value: Startziel.aufsichten) {
                    Mehrzeile(titel: "Pausenaufsichten heute")
                }
            } else if zustand.istFamilie {
                NavigationLink(value: Startziel.familieAbwesenheiten) {
                    Mehrzeile(titel: "Meine Abwesenheiten")
                }
            }
            NavigationLink(value: Startziel.hausaufgaben) {
                Mehrzeile(titel: "Hausaufgaben")
            }
            NavigationLink(value: Startziel.aenderungen) {
                Mehrzeile(titel: "Änderungen heute")
            }
        }
    }

    /// Sprechtage (Lehrkräfte: eigene Termine; Erziehungsberechtigte: buchen und absagen).
    private var sprechtagAbschnitt: some View {
        Section("Sprechtage") {
            ForEach(sprechtage) { t in
                Button {
                    sprechtagWahl = SprechtagWahl(id: t.id, titel: t.titel)
                } label: {
                    Uebersichtszeile(titel: t.titel, untertitel: t.untertitel, zahl: t.termine, pfeil: true)
                }
                .buttonStyle(.plain)
            }
        }
    }

    /// Einstellungen und Info.
    private var einstellungenAbschnitt: some View {
        Section("Einstellungen") {
            if zustand.darfPlanmitteilungen {
                PlanmitteilungenSchalter()
            }
            Toggle(isOn: $mitteilungenDetails) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Einzelheiten in Mitteilungen")
                        .foregroundStyle(Farben.text)
                    Text("Aus: Mitteilungen auf dem Sperrbildschirm nennen keine Namen, Fächer, Klassen oder Räume.")
                        .font(.footnote)
                        .foregroundStyle(Farben.text2)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .tint(Farben.akzent)
            NavigationLink(value: Mehrseite.benachrichtigungen) {
                Mehrzeile(titel: "Benachrichtigungen")
            }
            NavigationLink(value: Mehrseite.darstellung) {
                Mehrzeile(titel: "Darstellung")
            }
            NavigationLink(value: Mehrseite.kontaktdaten) {
                Mehrzeile(titel: "Kontaktdaten und Kalender")
            }
            NavigationLink(value: Mehrseite.passwort) {
                Mehrzeile(titel: "Passwort ändern")
            }
            NavigationLink(value: Mehrseite.neues) {
                Mehrzeile(titel: "Neu in EduOrga")
            }
            NavigationLink(value: Mehrseite.ueber) {
                Mehrzeile(titel: "Über")
            }
            if let url = Datenschutz.hinweiseAktuell {
                Link(destination: url) {
                    Mehrzeile(titel: "Datenschutzhinweise der Schule", pfeil: true)
                }
            }
        }
    }

    static var version: String {
        let info = Bundle.main.infoDictionary
        let v = info?["CFBundleShortVersionString"] as? String ?? "1.0"
        let b = info?["CFBundleVersion"] as? String ?? "1"
        return "\(v) (\(b))"
    }

    private func laden() async {
        let api = zustand.api
        async let sprechtagListe = try? api.sprechtagStart()
        await zustand.entschuldigungsrechteLaden()
        do {
            profil = try await api.profil()
            fehler = nil
        } catch {
            if let text = zustand.fehlertext(error) { fehler = text }
        }
        sprechtage = await sprechtagListe ?? []
    }
}

/// Darstellung: Tag als Liste oder Zeitachse, Dichte der Zeitachse und Startansicht des Plans.
struct DarstellungView: View {
    @AppStorage("zeitachseDichte") private var dichte: Double = 1.0
    @AppStorage("planModus") private var modusRoh = Planmodus.woche.rawValue
    @AppStorage("tagesDarstellung") private var darstellungRoh = Tagesdarstellung.liste.rawValue

    var body: some View {
        List {
            Section {
                Picker("Tag als", selection: $darstellungRoh) {
                    ForEach(Tagesdarstellung.allCases) { d in
                        Text(d.titel).tag(d.rawValue)
                    }
                }
                .pickerStyle(.inline)
                .labelsHidden()
            } header: {
                Text("Tag im Plan")
            } footer: {
                Text("Liste: große Kacheln, Pausen und Freistunden kompakt. Zeitachse: Stunden in ihrer echten Länge.")
            }
            Section {
                Picker("Zeitachse", selection: $dichte) {
                    Text("Kompakt").tag(0.75)
                    Text("Normal").tag(1.0)
                    Text("Groß").tag(1.35)
                }
                .pickerStyle(.inline)
                .labelsHidden()
            } header: {
                Text("Höhe der Zeitachse")
            } footer: {
                Text("Wie viel Platz eine Unterrichtsminute auf der Zeitachse bekommt. Größere Schrift (Dynamic Type) vergrößert die Zeitachse zusätzlich.")
            }
            Section {
                WochendichteAuswahl()
                    .pickerStyle(.inline)
                    .labelsHidden()
            } header: {
                Text("Dichte der Woche")
            } footer: {
                Text("Höhe der Stunden im Wochenraster. Im Plan auch mit zwei Fingern aufziehen bzw. zusammenschieben.")
            }
            Section("Plan öffnet mit") {
                Picker("Ansicht", selection: $modusRoh) {
                    ForEach(Planmodus.allCases) { m in
                        Text(m.titel).tag(m.rawValue)
                    }
                }
                .pickerStyle(.inline)
                .labelsHidden()
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Darstellung")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
    }
}

/// Zeile in Profil und Einstellungen: Titel, optional ein Wert rechts – ohne Symbol davor.
struct Mehrzeile: View {
    let titel: String
    var wert: String? = nil
    /// Eigener Pfeil (bei Knöpfen; NavigationLinks zeichnen ihn selbst)
    var pfeil: Bool = false

    var body: some View {
        HStack(spacing: 12) {
            Text(titel)
                .foregroundStyle(Farben.text)
            Spacer(minLength: 4)
            if let wert {
                Text(wert)
                    .foregroundStyle(Farben.text3)
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

/// Schalter „Mitteilungen bei Planänderungen“ (nur Lehrkräfte): an = beim Öffnen und im Hintergrund den eigenen
/// Plan prüfen und bei Entfall, Vertretung, Raumänderung, neuer Stunde oder Prüfung eine Mitteilung senden.
struct PlanmitteilungenSchalter: View {
    @EnvironmentObject var zustand: AppZustand
    @AppStorage(Planmitteilungen.schalterSchluessel) private var aktiv = true
    /// Mitteilungen in den iOS-Einstellungen ausgeschaltet
    @State private var verweigert = false
    @Environment(\.scenePhase) private var szene

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Toggle(isOn: $aktiv) {
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Mitteilungen bei Planänderungen")
                            .foregroundStyle(Farben.text)
                        Text("Entfall, Vertretung, Raumänderung, neue Stunde oder Prüfung im eigenen Plan")
                            .font(.footnote)
                            .foregroundStyle(Farben.text2)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .tint(Farben.akzent)
            if aktiv && verweigert {
                Button {
                    if let url = URL(string: UIApplication.openNotificationSettingsURLString) {
                        UIApplication.shared.open(url)
                    }
                } label: {
                    Text("Mitteilungen sind in den iOS-Einstellungen ausgeschaltet. Einstellungen öffnen")
                        .font(.footnote)
                        .foregroundStyle(Farben.akzent)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.vertical, 2)
        .task { verweigert = await Planmitteilungen.verweigert() }
        .onChange(of: szene) { _, neu in
            if neu == .active { Task { verweigert = await Planmitteilungen.verweigert() } }
        }
        .onChange(of: aktiv) { _, neu in
            if neu {
                Task {
                    await zustand.planPruefen()
                    verweigert = await Planmitteilungen.verweigert()
                }
            } else {
                Planmitteilungen.abbestellen()
            }
        }
    }
}
