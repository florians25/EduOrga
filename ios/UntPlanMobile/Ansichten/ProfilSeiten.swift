import SwiftUI

// MARK: - Kontaktdaten

/// Kontaktdaten und Konto (Benutzer, E-Mail, Plan, Anmeldungen) sowie das Kalender-Abo.
struct KontaktdatenView: View {
    let profil: Profil?
    let name: String
    @EnvironmentObject var zustand: AppZustand

    var body: some View {
        List {
            Section("Konto") {
                if !name.isEmpty {
                    LabeledContent("Name", value: name)
                }
                LabeledContent("Benutzer", value: profil?.login ?? zustand.benutzer?.login ?? "")
                let rolle = zustand.benutzer?.rollenname ?? profil?.rolle ?? ""
                if !rolle.isEmpty {
                    LabeledContent("Rolle", value: rolle)
                }
                let element = profil?.element ?? zustand.benutzer?.element ?? ""
                if !element.isEmpty {
                    LabeledContent("Plan", value: element)
                }
                if let email = profil?.email, !email.isEmpty {
                    LabeledContent("E-Mail", value: email)
                }
            }

            if profil?.letzteAnmeldung != nil || profil?.vorherigeAnmeldung != nil {
                Section("Anmeldungen") {
                    if let letzte = profil?.letzteAnmeldung, !letzte.isEmpty {
                        LabeledContent("Letzte Anmeldung", value: Datumsformat.anzeige(letzte, "d.M.yyyy, HH:mm"))
                    }
                    if let vorherige = profil?.vorherigeAnmeldung, !vorherige.isEmpty {
                        LabeledContent("Davor", value: Datumsformat.anzeige(vorherige, "d.M.yyyy, HH:mm"))
                    }
                }
            }

            if let ical = profil?.ical, let url = URL(string: ical) {
                Section {
                    if let abo = URL(string: ical.replacingOccurrences(of: "https://", with: "webcal://").replacingOccurrences(of: "http://", with: "webcal://")) {
                        Link(destination: abo) {
                            Text("Kalender abonnieren")
                        }
                    }
                    ShareLink(item: url) {
                        Text("Kalenderadresse teilen")
                    }
                } header: {
                    Text("Kalender")
                } footer: {
                    Text("Die Stunden der nächsten vier Wochen als Kalender-Abo (iCal).")
                }
            }
        }
        .navigationTitle("Kontaktdaten und Kalender")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
    }
}

// MARK: - Passwort ändern

/// Passwort ändern über POST /api/app/passwort.
struct PasswortView: View {
    @EnvironmentObject var zustand: AppZustand
    @Environment(\.dismiss) private var zurueck
    @State private var alt = ""
    @State private var neu = ""
    @State private var wiederholung = ""
    @State private var speichert = false
    @State private var fehler: String? = nil
    @State private var erfolg = false

    private var bereit: Bool {
        !alt.isEmpty && !neu.isEmpty && neu == wiederholung && !speichert
    }

    var body: some View {
        Form {
            Section {
                SecureField("Bisheriges Passwort", text: $alt)
                    .textContentType(.password)
            }
            Section {
                SecureField("Neues Passwort", text: $neu)
                    .textContentType(.newPassword)
                SecureField("Neues Passwort wiederholen", text: $wiederholung)
                    .textContentType(.newPassword)
            } footer: {
                if !wiederholung.isEmpty && neu != wiederholung {
                    Text("Die neuen Passwörter stimmen nicht überein.")
                        .foregroundStyle(Farben.entfall)
                }
            }
            if let fehler {
                Section {
                    Text(fehler)
                        .foregroundStyle(Farben.entfall)
                }
            }
            Section {
                Button {
                    Task { await aendern() }
                } label: {
                    HStack {
                        Spacer()
                        if speichert {
                            ProgressView()
                        } else {
                            Text("Passwort ändern")
                                .fontWeight(.medium)
                        }
                        Spacer()
                    }
                }
                .disabled(!bereit)
            }
        }
        .navigationTitle("Passwort ändern")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .alert("Passwort geändert", isPresented: $erfolg) {
            Button("OK") { zurueck() }
        } message: {
            Text("Ihr neues Passwort gilt ab sofort.")
        }
    }

    private func aendern() async {
        speichert = true
        defer { speichert = false }
        do {
            try await zustand.api.passwortAendern(alt: alt, neu: neu)
            // Gemerktes Passwort im Schlüsselbund nachziehen
            let login = UserDefaults.standard.string(forKey: ApiClient.loginSchluessel) ?? ""
            let konto = Schluesselbund.konto(login: login, server: zustand.api.serverAdresse)
            if !login.isEmpty, Schluesselbund.lesen(konto: konto) != nil {
                Schluesselbund.speichern(neu, konto: konto)
            }
            fehler = nil
            alt = ""
            neu = ""
            wiederholung = ""
            erfolg = true
        } catch {
            fehler = zustand.fehlertext(error)
        }
    }
}

// MARK: - Was gibt es Neues

struct NeuigkeitenView: View {
    private struct Punkt: Identifiable {
        let titel: String
        let text: String
        var id: String { titel }
    }

    private let punkte: [Punkt] = [
        Punkt(titel: "Eine App für alle Schulen", text: "Beim ersten Start geben Sie die Adresse von UntPlan Ihrer Schule ein; die App prüft sie und zeigt den Namen der Schule. Weitere Schulen und Konten unter „Mehr“ → „Konten und Schulen“."),
        Punkt(titel: "Tag als Liste", text: "Der Plan startet mit dem Tag als ruhiger Liste mit Uhrzeiten; Wochentage oben antippen oder wischen. Woche, 3 Tage und 2 Tage als Raster im Menü."),
        Punkt(titel: "Neue Gestaltung", text: "Ruhigeres Erscheinungsbild mit Systemschrift, klaren Kanten und einer Akzentfarbe; Status wie Entfall oder Prüfung auf einen Blick."),
        Punkt(titel: "Plan", text: "Kacheln in der Fachfarbe, Entfall schraffiert, Änderungen mit Rahmen; Tag, Tage und Woche per Menü."),
        Punkt(titel: "Stundendetails", text: "Lehrstoff, Hausaufgaben, Schüler*innen, Klassenbucheinträge und Notizen direkt aus der Stunde – als Blatt mit Ziehgriff."),
        Punkt(titel: "Reiter „Mehr“", text: "Profil, Konten, Abwesenheiten, Entschuldigungen, Sprechtage, Pläne und Einstellungen an einer Stelle."),
        Punkt(titel: "Für das iPad", text: "Inhalte mittig statt über die ganze Breite, Details als festes Blatt über dem Plan."),
    ]

    var body: some View {
        List {
            ForEach(punkte) { punkt in
                HStack(alignment: .top, spacing: 14) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(punkt.titel)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(Farben.text)
                        Text(punkt.text)
                            .font(.subheadline)
                            .foregroundStyle(Farben.text2)
                    }
                }
                .padding(.vertical, 4)
            }
        }
        .navigationTitle("Neu in dieser Version")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
    }
}

// MARK: - Über

/// Schule, Server, Schuljahr, Datenstand und App-Version.
struct UeberView: View {
    @EnvironmentObject var zustand: AppZustand

    var body: some View {
        List {
            Section("Schule") {
                LabeledContent("Name", value: zustand.schulname)
                LabeledContent("Server", value: zustand.api.serverAdresse)
                if let sj = zustand.sitzung?.schuljahr {
                    LabeledContent("Schuljahr", value: "\(Datumsformat.anzeige(sj.von, "d.M.yyyy")) – \(Datumsformat.anzeige(sj.bis, "d.M.yyyy"))")
                }
                if let empfangen = zustand.sitzung?.paket?.empfangen, !empfangen.isEmpty {
                    LabeledContent("Datenstand", value: Datumsformat.anzeige(empfangen, "d.M.yyyy, HH:mm"))
                }
            }
            Section("App") {
                LabeledContent("Version", value: MehrView.version)
            }
        }
        .navigationTitle("Über")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
    }
}
