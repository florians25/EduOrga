import SwiftUI

/// Benachrichtigungen und Kontakt (wie „Profil“ im Web): E-Mail-Adresse und „Bei neuen Mitteilungen per E-Mail
/// benachrichtigen“ (PUT /api/app/profil), dazu für Lehrkräfte die Mitteilungen bei Planänderungen auf diesem Gerät.
struct BenachrichtigungenView: View {
    @EnvironmentObject var zustand: AppZustand
    @State private var email = ""
    @State private var benachrichtigung = false
    @State private var sprache = "Deutsch"
    @State private var geladen = false
    @State private var speichert = false
    @State private var fehler: String? = nil
    @State private var gespeichert = false
    @State private var ausgangsstand = ""

    private var geaendert: Bool { "\(email)|\(benachrichtigung)" != ausgangsstand }

    var body: some View {
        Form {
            if let fehler {
                Section {
                    Fehlerhinweis(text: fehler)
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                }
            }
            Section {
                TextField("E-Mail-Adresse", text: $email)
                    .keyboardType(.emailAddress)
                    .textContentType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                Toggle("Bei neuen Mitteilungen per E-Mail benachrichtigen", isOn: $benachrichtigung)
                    .tint(Farben.akzent)
                    .disabled(email.trimmingCharacters(in: .whitespaces).isEmpty)
            } header: {
                Text("E-Mail")
            } footer: {
                Text("Die Schule schickt Ihnen eine kurze E-Mail, wenn im Postfach eine neue Mitteilung eingeht. Die Mitteilung selbst lesen Sie in EduOrga.")
            }
            if zustand.darfPlanmitteilungen {
                Section {
                    PlanmitteilungenSchalter()
                } header: {
                    Text("Auf diesem Gerät")
                }
            }
            Section {
                Button {
                    Task { await speichern() }
                } label: {
                    HStack {
                        Spacer()
                        if speichert {
                            ProgressView()
                        } else {
                            Text(gespeichert && !geaendert ? "Gespeichert" : "Speichern")
                                .fontWeight(.semibold)
                        }
                        Spacer()
                    }
                }
                .disabled(!geladen || !geaendert || speichert)
            }
        }
        .navigationTitle("Benachrichtigungen")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .task { await laden() }
    }

    private func laden() async {
        do {
            let p = try await zustand.api.profil()
            email = p.email
            benachrichtigung = p.benachrichtigung
            sprache = p.sprache.isEmpty ? "Deutsch" : p.sprache
            ausgangsstand = "\(email)|\(benachrichtigung)"
            geladen = true
            fehler = nil
        } catch {
            fehler = zustand.fehlertext(error)
        }
    }

    private func speichern() async {
        speichert = true
        defer { speichert = false }
        let adresse = email.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            try await zustand.api.profilSpeichern(ProfilDaten(email: adresse, sprache: sprache,
                                                              benachrichtigung: benachrichtigung && !adresse.isEmpty))
            email = adresse
            ausgangsstand = "\(email)|\(benachrichtigung)"
            gespeichert = true
            fehler = nil
            Haptik.erfolg()
        } catch {
            fehler = zustand.fehlertext(error)
        }
    }
}
