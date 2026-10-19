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
        Punkt(titel: "EduOrga", text: "UntPlan Next heißt jetzt EduOrga – einfach mehr Schulalltag. Neues Symbol, Farben der Marke (Petrol) und eine ruhige, sachliche Gestaltung."),
        Punkt(titel: "Einrichtung", text: "Eine App für alle Schulen: EduOrga-Adresse der Schule eingeben (die App prüft sie schon beim Tippen), den QR-Code der Schule scannen oder eine zuletzt verwendete Schule wählen."),
        Punkt(titel: "Woche als Standard", text: "Der Plan öffnet mit der Woche als Raster: Montag bis Freitag, Stunden mit Uhrzeit, heute hervorgehoben mit Jetzt-Linie. Waagrecht wischen wechselt die Woche, Aufziehen mit zwei Fingern ändert die Dichte, im Querformat wird es breiter."),
        Punkt(titel: "Klassische Stundenkarten", text: "Fach fett oben links, Raum oben rechts, Lehrkraft bzw. Klasse darunter, Fachfarbe als Balken – genau wie die Schule die Karten im Web eingestellt hat. Entfall durchgestrichen, Vertretung violett."),
        Punkt(titel: "Klassenbuch", text: "Für Lehrkräfte im Reiter „Schule“: offene Stunden, Lehrstoff, Hausaufgaben, Anwesenheit mit Schnellwahl (anwesend, abwesend, verspätet), Einträge, Klassendienste, Befreiungen, Sitzplan und Prüfungen. Ohne Netz gespeicherte Änderungen werden später gesendet."),
        Punkt(titel: "Melden und Buchen", text: "Abwesenheit melden, Prüfung eintragen, Meine Meldungen; Räume und Geräte buchen und eigene Buchungen stornieren."),
        Punkt(titel: "Sprechtag", text: "Eltern buchen Termine und tragen sich auf die Warteliste ein; Lehrkräfte sehen ihre Termine, laden Familien ein, tragen Termine ein und sagen ab."),
        Punkt(titel: "Für Familien", text: "Hausaufgaben, Abwesenheiten, Entschuldigungsschreiben als PDF, Prüfungen und Vertretungsplan."),
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
            Section {
                LabeledContent("App", value: Marke.name)
                LabeledContent("Version", value: MehrView.version)
            } header: {
                Text("App")
            } footer: {
                Text("EduOrga gibt es für alle Schulen zentral im App Store; jede Schule betreibt ihr EduOrga selbst.\n\n" + Marke.hinweis)
            }
        }
        .navigationTitle("Über")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
    }
}
