import SwiftUI
import UIKit

/// Unterseiten des Reiters „Mehr“.
enum Mehrseite: Hashable {
    case kontaktdaten
    case passwort
    case neues
    case ueber
    /// Pläne einer Art (Klassen, Lehrkräfte, Räume) – Antippen öffnet den Plan im Reiter „Plan“
    case plaene(Plankategorie)
}

/// Reiter „Mehr“: gruppierte Liste mit Profil und Konten, Schule und Unterricht (Termine, Abwesenheiten,
/// Entschuldigungen, Hausaufgaben, Sprechtage), Plänen (Klassen, Lehrkräfte, Räume), Einstellungen und Info sowie
/// Abmelden. Jede Funktion der App ist hier erreichbar.
struct MehrView: View {
    @EnvironmentObject var zustand: AppZustand
    @State private var profil: Profil? = nil
    @State private var fehler: String? = nil
    @State private var bestaetigen = false
    @State private var konten = false
    @State private var sprechtage: [SprechtagKarte] = []
    @State private var sprechtagWahl: StartView.SprechtagWahl? = nil
    @State private var gewaehlteKarte: Karte? = nil
    @Environment(\.horizontalSizeClass) private var groessenklasse

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
                planAbschnitt
                einstellungenAbschnitt
                Section {
                    Button(role: .destructive) {
                        bestaetigen = true
                    } label: {
                        Text("Abmelden")
                            .foregroundStyle(Farben.entfall)
                    }
                } footer: {
                    Text("UntPlan für iOS \(MehrView.version)")
                        .frame(maxWidth: .infinity)
                        .padding(.top, 8)
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Mehr")
            .navigationBarTitleDisplayMode(.large)
            .navigationDestination(for: Mehrseite.self) { seite in
                switch seite {
                case .kontaktdaten: KontaktdatenView(profil: profil, name: name)
                case .passwort: PasswortView()
                case .neues: NeuigkeitenView()
                case .ueber: UeberView()
                case .plaene(let kategorie): PlanlisteSeite(kategorie: kategorie)
                }
            }
            .navigationDestination(for: Startziel.self) { ziel in
                Startzielseite(ziel: ziel, heute: nil, sprechtage: sprechtage) { gewaehlteKarte = $0 }
            }
            .detailPraesentation(item: $gewaehlteKarte, breit: groessenklasse == .regular) { karte in
                StundendetailView(karte: karte, typ: zustand.benutzer?.typ ?? "klasse", element: element)
                    .environmentObject(zustand)
            }
            .detailPraesentation(item: $sprechtagWahl, breit: groessenklasse == .regular) { wahl in
                NavigationStack {
                    SprechtagView(id: wahl.id, titel: wahl.titel, karte: sprechtage.first { $0.id == wahl.id })
                }
                .environmentObject(zustand)
            }
            .blattPraesentation(isPresented: $konten, breit: groessenklasse == .regular) {
                KontenauswahlView()
                    .environmentObject(zustand)
            }
            .refreshable { await laden() }
            .task { await laden() }
            // Einrichtungslink „untplan://einrichten?server=…“ im angemeldeten Zustand: Konten mit „Konto hinzufügen“
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
    }

    // MARK: - Abschnitte

    /// Profil: Name, Rolle und Schule; darunter Konten wechseln bzw. hinzufügen.
    private var profilAbschnitt: some View {
        Section {
            NavigationLink(value: Mehrseite.kontaktdaten) {
                HStack(spacing: 12) {
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
                .padding(.vertical, 4)
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
                    sprechtagWahl = StartView.SprechtagWahl(id: t.id, titel: t.titel)
                } label: {
                    Uebersichtszeile(titel: t.titel,
                                     untertitel: t.untertitel, zahl: t.termine, pfeil: true)
                }
                .buttonStyle(.plain)
            }
        }
    }

    /// Pläne anderer Klassen, Lehrkräfte und Räume (soweit das Konto sie sehen darf).
    private var planAbschnitt: some View {
        Section {
            NavigationLink(value: Mehrseite.plaene(.klasse)) {
                Mehrzeile(titel: "Klassen")
            }
            if zustand.darfLehrerplaene {
                NavigationLink(value: Mehrseite.plaene(.lehrer)) {
                    Mehrzeile(titel: "Lehrkräfte")
                }
            }
            NavigationLink(value: Mehrseite.plaene(.raum)) {
                Mehrzeile(titel: "Räume")
            }
        } header: {
            Text("Pläne")
        } footer: {
            Text("Ein gewählter Plan öffnet sich im Reiter „Plan“.")
        }
    }

    /// Einstellungen und Info: Mitteilungen bei Planänderungen (Lehrkräfte), Kontaktdaten und Kalender, Passwort,
    /// Neuigkeiten, Über.
    private var einstellungenAbschnitt: some View {
        Section("Einstellungen") {
            if zustand.darfPlanmitteilungen {
                PlanmitteilungenSchalter()
            }
            NavigationLink(value: Mehrseite.kontaktdaten) {
                Mehrzeile(titel: "Kontaktdaten und Kalender")
            }
            NavigationLink(value: Mehrseite.passwort) {
                Mehrzeile(titel: "Passwort ändern")
            }
            NavigationLink(value: Mehrseite.neues) {
                Mehrzeile(titel: "Neu in dieser Version")
            }
            NavigationLink(value: Mehrseite.ueber) {
                Mehrzeile(titel: "Über")
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

/// Zeile im Reiter „Mehr“: Titel, optional ein Wert rechts – ohne Symbol davor.
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

/// Pläne einer Art aus „Mehr“: die Liste der Klassen, Lehrkräfte bzw. Räume; ein Tipp öffnet den Plan im Reiter „Plan“.
struct PlanlisteSeite: View {
    let kategorie: Plankategorie
    @EnvironmentObject var zustand: AppZustand
    @State private var elemente: Elemente? = nil
    @State private var fehler: String? = nil

    var body: some View {
        ElementlisteView(kategorie: kategorie, elemente: elemente, auswahl: nil) { plan in
            zustand.planZeigen(plan)
        }
        .overlay {
            if let fehler {
                Fehlerhinweis(text: fehler)
                    .padding(16)
                    .frame(maxHeight: .infinity, alignment: .top)
            }
        }
        .task {
            guard elemente == nil else { return }
            do {
                elemente = try await zustand.api.elemente()
                fehler = nil
            } catch {
                if let text = zustand.fehlertext(error) { fehler = text }
            }
        }
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
