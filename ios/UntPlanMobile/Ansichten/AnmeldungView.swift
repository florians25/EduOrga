import SwiftUI

/// Einrichtung und Anmeldung in zwei Schritten – eine App für alle Schulen:
/// 1. **Schule:** Adresse der UntPlan-Installation der Schule (z. B. „plan.meine-schule.de“). Die App prüft, ob der
///    Server erreichbar ist und wirklich UntPlan läuft, und zeigt den Namen der Schule zur Bestätigung.
/// 2. **Anmeldung:** Benutzername, Passwort und „Passwort merken“ an diesem Server; oben steht die Schule mit „Ändern“.
///
/// Als „Konto oder Schule hinzufügen“ (eingebettet in die Kontenauswahl) bleibt das bisherige Konto angemeldet. Ist
/// bereits ein Server gespeichert (z. B. abgelaufene Sitzung), beginnt die Anmeldemaske direkt mit Schritt 2; in der
/// Anmeldemaske stehen die übrigen gespeicherten Konten zum Wechsel bereit.
@MainActor
struct AnmeldungView: View {
    /// Weiteres Konto bzw. weitere Schule hinzufügen (ohne eigenen NavigationStack, Felder leer)
    var hinzufuegen: Bool = false
    /// Nach erfolgreicher Anmeldung (z. B. Kontenauswahl schließen)
    var fertig: (() -> Void)? = nil
    @EnvironmentObject var zustand: AppZustand

    // Schritt 1: Schule
    @State private var eingabe = ""
    @State private var prueft = false
    @State private var serverFehler: String? = nil
    /// Geprüfte Schule (nil = Schritt 1)
    @State private var server: ServerInfo? = nil

    // Schritt 2: Anmeldung
    @State private var login = ""
    @State private var passwort = ""
    @State private var merken = true
    @State private var laedt = false
    @State private var fehler: String? = nil
    @State private var wechselt: String? = nil

    @State private var vorbereitet = false
    @FocusState private var fokus: Feld?

    enum Feld {
        case server
        case login
        case passwort
    }

    var body: some View {
        if hinzufuegen {
            inhalt
                .navigationTitle(server == nil ? "Konto hinzufügen" : "Anmelden")
                .navigationBarTitleDisplayMode(.inline)
        } else {
            NavigationStack {
                inhalt
                    .navigationBarTitleDisplayMode(.inline)
            }
        }
    }

    private var inhalt: some View {
        Group {
            if let server {
                anmeldeFormular(server)
            } else {
                serverFormular
            }
        }
        .animation(.easeInOut(duration: 0.12), value: server)
        .onAppear(perform: vorbereiten)
        .onChange(of: zustand.einrichtungsAdresse) { _, _ in
            _ = einrichtungslinkUebernehmen()
        }
    }

    // MARK: - Schritt 1: Schule

    private var bereitZurPruefung: Bool {
        !eingabe.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    /// Schulen der bereits angemeldeten Konten (je Server einmal) zur schnellen Auswahl.
    private var bekannteSchulen: [ServerInfo] {
        var liste: [ServerInfo] = []
        for k in zustand.konten.sorted(by: { ($0.zuletzt ?? .distantPast) > ($1.zuletzt ?? .distantPast) })
        where !liste.contains(where: { $0.adresse.caseInsensitiveCompare(k.server) == .orderedSame }) {
            liste.append(ServerInfo(adresse: k.server, schulname: k.schulname))
        }
        return liste
    }

    private var serverFormular: some View {
        Form {
            if !hinzufuegen {
                Section {
                    wortmarke(untertitel: "Einrichtung für Ihre Schule")
                }
            }

            Section {
                TextField("plan.meine-schule.de", text: $eingabe)
                    .keyboardType(.URL)
                    .textContentType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($fokus, equals: .server)
                    .submitLabel(.continue)
                    .onSubmit { Task { await pruefen() } }
                    .onChange(of: eingabe) { _, _ in serverFehler = nil }
            } header: {
                Text("Adresse der Schule")
            } footer: {
                Text("Die Adresse von UntPlan erhalten Sie von Ihrer Schule, z. B. im Elternbrief oder auf der Website. „https://“ wird ergänzt.")
            }

            if eingabe.lowercased().hasPrefix("http://") {
                Section {
                    Label("Unverschlüsselte Adressen (http://) werden in der Regel nicht unterstützt. Verwenden Sie die HTTPS-Adresse Ihrer Schule.",
                          systemImage: "exclamationmark.triangle")
                        .font(.footnote)
                        .foregroundStyle(Farben.warnung)
                }
            }

            Section {
                primaerKnopf(titel: "Weiter", arbeitet: prueft, aktiv: bereitZurPruefung) {
                    Task { await pruefen() }
                }
            } footer: {
                if let serverFehler {
                    Text(serverFehler)
                        .foregroundStyle(Farben.entfall)
                        .font(.footnote)
                }
            }

            if !bekannteSchulen.isEmpty {
                Section {
                    ForEach(bekannteSchulen, id: \.adresse) { info in
                        Button {
                            serverWaehlen(info)
                        } label: {
                            schulzeile(info, pfeil: true)
                        }
                        .buttonStyle(.plain)
                    }
                } header: {
                    Text(hinzufuegen ? "Weiteres Konto an derselben Schule" : "Bekannte Schulen")
                }
            }

            if !hinzufuegen {
                kontenAbschnitt(zustand.konten)
            }
        }
    }

    // MARK: - Schritt 2: Anmeldung

    private var bereitZurAnmeldung: Bool {
        !login.trimmingCharacters(in: .whitespaces).isEmpty && !passwort.isEmpty
    }

    /// Gespeicherte Konten außer dem vorbelegten (Wechsel ohne erneute Anmeldung, sofern die Sitzung noch gilt).
    private func andereKonten(_ s: ServerInfo) -> [Konto] {
        zustand.konten.filter { !$0.gleich(server: s.adresse, login: login.trimmingCharacters(in: .whitespaces)) }
    }

    private func anmeldeFormular(_ s: ServerInfo) -> some View {
        Form {
            if !hinzufuegen {
                Section {
                    wortmarke(untertitel: "Anmeldung mit dem Konto Ihrer Schule")
                }
            }

            Section {
                HStack(spacing: 12) {
                    schulzeile(s, pfeil: false)
                    Button("Ändern") {
                        eingabe = s.kurz
                        fehler = nil
                        passwort = ""
                        server = nil
                    }
                    .buttonStyle(.borderless)
                    .foregroundStyle(Farben.akzent)
                    .accessibilityHint("Andere Schule bzw. Adresse wählen")
                }
                if !s.verschluesselt {
                    Label("Unverschlüsselte Verbindung: Benutzername und Passwort werden ohne HTTPS übertragen.",
                          systemImage: "exclamationmark.triangle")
                        .font(.footnote)
                        .foregroundStyle(Farben.entfall)
                }
            } header: {
                Text("Schule")
            }

            Section("Anmeldung") {
                TextField("Benutzername", text: $login)
                    .textContentType(.username)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($fokus, equals: .login)
                    .submitLabel(.next)
                    .onSubmit { fokus = .passwort }
                SecureField("Passwort", text: $passwort)
                    .textContentType(.password)
                    .focused($fokus, equals: .passwort)
                    .submitLabel(.go)
                    .onSubmit { Task { await anmelden() } }
                Toggle("Passwort merken", isOn: $merken)
                    .tint(Farben.akzent)
            }

            Section {
                primaerKnopf(titel: "Anmelden", arbeitet: laedt, aktiv: bereitZurAnmeldung) {
                    Task { await anmelden() }
                }
            } footer: {
                if let fehler {
                    Text(fehler)
                        .foregroundStyle(Farben.entfall)
                        .font(.footnote)
                } else if hinzufuegen {
                    Text("Das bisherige Konto bleibt angemeldet; unter „Mehr“ → „Konten“ wechseln Sie jederzeit zurück.")
                        .font(.footnote)
                }
            }

            if !hinzufuegen {
                kontenAbschnitt(andereKonten(s))
            }
        }
    }

    // MARK: - Bausteine

    /// Wortmarke als Text, kein Bildzeichen.
    private func wortmarke(untertitel: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("UntPlan")
                .font(.largeTitle.weight(.semibold))
                .foregroundStyle(Farben.text)
            Text(untertitel)
                .font(.subheadline)
                .foregroundStyle(Farben.text2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 8)
        .listRowBackground(Color.clear)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }

    /// Schule: Name (bzw. Adresse) und darunter die Adresse.
    private func schulzeile(_ s: ServerInfo, pfeil: Bool) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(s.schulname.isEmpty ? s.kurz : s.schulname)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Farben.text)
                    .lineLimit(2)
                if !s.schulname.isEmpty {
                    Text(s.kurz)
                        .font(.footnote)
                        .foregroundStyle(Farben.text2)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
            }
            Spacer(minLength: 4)
            if pfeil {
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Farben.pfeil)
            }
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    /// Primärknopf über die ganze Zeile (Marine, weiße Schrift), während der Arbeit mit Ladekreis.
    private func primaerKnopf(titel: String, arbeitet: Bool, aktiv: Bool, aktion: @escaping () -> Void) -> some View {
        Button(action: aktion) {
            HStack {
                Spacer()
                if arbeitet {
                    ProgressView()
                        .tint(Farben.aufAkzent)
                } else {
                    Text(titel)
                        .fontWeight(.semibold)
                }
                Spacer()
            }
            .padding(.vertical, 4)
            .foregroundStyle(Farben.aufAkzent)
        }
        .listRowBackground(aktiv ? Farben.akzent : Farben.akzent.opacity(0.45))
        .disabled(!aktiv || arbeitet)
    }

    /// Gespeicherte Konten zum Wechsel (nur in der Anmeldemaske, nicht beim Hinzufügen).
    @ViewBuilder
    private func kontenAbschnitt(_ liste: [Konto]) -> some View {
        if !liste.isEmpty {
            Section {
                ForEach(liste) { konto in
                    Button {
                        Task {
                            wechselt = konto.id
                            await zustand.wechseln(zu: konto)
                            wechselt = nil
                        }
                    } label: {
                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(konto.rollenname.isEmpty ? konto.login : "\(konto.login) · \(konto.rollenname)")
                                    .foregroundStyle(Farben.text)
                                Text(konto.schulname.isEmpty ? konto.serverKurz : konto.schulname)
                                    .font(.footnote)
                                    .foregroundStyle(Farben.text2)
                            }
                            Spacer()
                            if wechselt == konto.id { ProgressView() }
                        }
                    }
                    .disabled(wechselt != nil)
                }
            } header: {
                Text("Gespeicherte Konten")
            }
        }
    }

    // MARK: - Abläufe

    /// Beim ersten Erscheinen: Einrichtungslink übernehmen bzw. (Anmeldemaske) mit dem gespeicherten Server beginnen.
    private func vorbereiten() {
        guard !vorbereitet else { return }
        vorbereitet = true
        if einrichtungslinkUebernehmen() { return }
        guard !hinzufuegen else {
            fokus = .server
            return
        }
        merken = UserDefaults.standard.object(forKey: ApiClient.merkenSchluessel) as? Bool ?? true
        let gespeichert = ApiClient.shared.serverAdresse
        guard !gespeichert.isEmpty else { return }
        // Bereits eingerichtet (abgemeldet bzw. Sitzung abgelaufen): direkt zur Anmeldung an dieser Schule
        let konto = zustand.aktivesKonto ?? zustand.konten.first { $0.server.caseInsensitiveCompare(gespeichert) == .orderedSame }
        login = UserDefaults.standard.string(forKey: ApiClient.loginSchluessel) ?? ""
        let info = ServerInfo(adresse: gespeichert, schulname: konto?.schulname ?? "")
        eingabe = info.kurz
        server = info
        Task { await schulnameAuffrischen(gespeichert) }
    }

    /// Link „untplan://einrichten?server=…“: Adresse eintragen und gleich prüfen.
    @discardableResult
    private func einrichtungslinkUebernehmen() -> Bool {
        guard let adresse = zustand.einrichtungsAdresse else { return false }
        zustand.einrichtungsAdresse = nil
        server = nil
        eingabe = adresse
        Task { await pruefen() }
        return true
    }

    /// Schulname des gespeicherten Servers still nachladen (ohne Fehlermeldung).
    private func schulnameAuffrischen(_ adresse: String) async {
        guard let info = try? await ApiClient.serverPruefen(adresse), !info.schulname.isEmpty,
              server?.adresse == adresse else { return }
        server?.schulname = info.schulname
    }

    /// Schritt 1 abschließen: Adresse prüfen und bei Erfolg zur Anmeldung.
    private func pruefen() async {
        guard !prueft else { return }
        let text = eingabe.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else {
            serverFehler = Serverpruefung.leer.errorDescription
            return
        }
        prueft = true
        serverFehler = nil
        defer { prueft = false }
        do {
            let info = try await ApiClient.serverPruefen(text)
            serverWaehlen(info)
        } catch is CancellationError {
            // abgebrochen
        } catch {
            serverFehler = error.localizedDescription
        }
    }

    /// Schule übernehmen und zur Anmeldung wechseln.
    private func serverWaehlen(_ info: ServerInfo) {
        fehler = nil
        passwort = ""
        let gleicherServer = info.adresse.caseInsensitiveCompare(ApiClient.shared.serverAdresse) == .orderedSame
        if hinzufuegen || !gleicherServer { login = "" }
        if hinzufuegen { merken = true }
        server = info
        fokus = login.isEmpty ? .login : .passwort
    }

    private func anmelden() async {
        guard let s = server, bereitZurAnmeldung, !laedt else { return }
        laedt = true
        fehler = nil
        defer { laedt = false }
        do {
            try await zustand.anmelden(server: s.adresse, login: login, passwort: passwort, merken: merken)
            passwort = ""
            fertig?()
        } catch {
            fehler = error.localizedDescription
        }
    }
}
