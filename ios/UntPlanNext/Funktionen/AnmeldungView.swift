import SwiftUI

/// Zuletzt verwendete Schulen (Adresse und Name) für die Einrichtung – auch nach dem Abmelden noch zur Hand.
enum Schulverlauf {
    struct Eintrag: Codable, Hashable, Sendable {
        var adresse: String
        var schulname: String
        var zuletzt: Date
    }

    private static let schluessel = "zuletztSchulen"

    static func laden() -> [Eintrag] {
        guard let daten = UserDefaults.standard.data(forKey: schluessel),
              let liste = try? JSONDecoder().decode([Eintrag].self, from: daten) else { return [] }
        return liste.sorted { $0.zuletzt > $1.zuletzt }
    }

    static func merken(_ info: ServerInfo) {
        var liste = laden().filter { $0.adresse.caseInsensitiveCompare(info.adresse) != .orderedSame }
        let alt = laden().first { $0.adresse.caseInsensitiveCompare(info.adresse) == .orderedSame }
        liste.insert(Eintrag(adresse: info.adresse, schulname: info.schulname.isEmpty ? (alt?.schulname ?? "") : info.schulname,
                             zuletzt: Date()), at: 0)
        speichern(Array(liste.prefix(6)))
    }

    static func entfernen(_ adresse: String) {
        speichern(laden().filter { $0.adresse.caseInsensitiveCompare(adresse) != .orderedSame })
    }

    private static func speichern(_ liste: [Eintrag]) {
        if let daten = try? JSONEncoder().encode(liste) { UserDefaults.standard.set(daten, forKey: schluessel) }
    }
}

/// Einrichtung und Anmeldung – eine App für alle Schulen (EduOrga gibt es zentral im App Store; jede Schule betreibt
/// ihr EduOrga selbst). Ruhige, sachliche Einstiegsseite mit Monogramm, Wortmarke und Slogan, darunter zwei Schritte:
/// 1. **Schule:** EduOrga-Adresse der Schule eingeben (Prüfung schon beim Tippen: Format, dann Server und Schulname),
///    per QR-Code scannen oder aus „Zuletzt verwendet“ wählen.
/// 2. **Anmeldung:** Benutzername, Passwort und „Passwort merken“ an dieser Schule; oben die Schule mit „Ändern“.
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

    /// Zustand der Adressprüfung beim Tippen.
    enum Pruefstand: Equatable {
        case leer
        case format
        case prueft
        case gefunden(ServerInfo)
        case fehler(String)
    }

    // Schritt 1: Schule
    @State private var eingabe = ""
    @State private var stand: Pruefstand = .leer
    @State private var prueft = false
    /// Geprüfte Schule (nil = Schritt 1)
    @State private var server: ServerInfo? = nil
    @State private var scanner = false
    @State private var verlauf: [Schulverlauf.Eintrag] = []

    // Schritt 2: Anmeldung
    @State private var login = ""
    @State private var passwort = ""
    @State private var zeigen = false
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
                    .toolbar(.hidden, for: .navigationBar)
            }
        }
    }

    private var inhalt: some View {
        ScrollView {
            VStack(spacing: 22) {
                if !hinzufuegen {
                    kopf
                        .padding(.top, server == nil ? 36 : 20)
                }
                if let server {
                    anmeldeKarte(server)
                        .transition(.move(edge: .trailing).combined(with: .opacity))
                    if !hinzufuegen {
                        kontenAbschnitt(andereKonten(server))
                    }
                } else {
                    schulKarte
                        .transition(.move(edge: .leading).combined(with: .opacity))
                    verlaufAbschnitt
                    if !hinzufuegen {
                        kontenAbschnitt(zustand.konten)
                    }
                }
                fuss
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 32)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Farben.grund.ignoresSafeArea())
        .animation(.snappy(duration: 0.25), value: server)
        .onAppear(perform: vorbereiten)
        .onChange(of: zustand.einrichtungsAdresse) { _, _ in
            _ = einrichtungslinkUebernehmen()
        }
        .task(id: eingabe) { await livePruefen() }
        .sheet(isPresented: $scanner) {
            QRCodeScannerBlatt { adresse in
                eingabe = adresse
                Task { await pruefen() }
            }
        }
    }

    // MARK: - Kopf

    private var kopf: some View {
        VStack(spacing: 10) {
            EdoMonogramm(groesse: server == nil ? 68 : 52)
            EdoWortmarke(schrift: server == nil ? .largeTitle : .title)
            Text(Marke.slogan)
                .font(.subheadline)
                .foregroundStyle(Farben.text2)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(Marke.name). \(Marke.slogan)")
        .accessibilityAddTraits(.isHeader)
    }

    // MARK: - Schritt 1: Schule

    /// Schulen der angemeldeten Konten und zuletzt verwendete Schulen (je Adresse einmal).
    private var bekannteSchulen: [ServerInfo] {
        var liste: [ServerInfo] = []
        func hinzu(_ adresse: String, _ name: String) {
            guard !liste.contains(where: { $0.adresse.caseInsensitiveCompare(adresse) == .orderedSame }) else { return }
            liste.append(ServerInfo(adresse: adresse, schulname: name))
        }
        for k in zustand.konten.sorted(by: { ($0.zuletzt ?? .distantPast) > ($1.zuletzt ?? .distantPast) }) {
            hinzu(k.server, k.schulname)
        }
        for e in verlauf { hinzu(e.adresse, e.schulname) }
        return liste
    }

    private var schulKarte: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text(hinzufuegen ? "Weitere Schule oder weiteres Konto" : "Mit Ihrer Schule verbinden")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Farben.text)
                Text("EduOrga ist eine App für alle Schulen – jede Schule betreibt ihr eigenes EduOrga. Geben Sie die EduOrga-Adresse Ihrer Schule ein oder scannen Sie den QR-Code der Schule.")
                    .font(.subheadline)
                    .foregroundStyle(Farben.text2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            adressfeld
            standZeile
            Button {
                Task { await pruefen() }
            } label: {
                knopfText("Weiter", arbeitet: prueft)
            }
            .buttonStyle(PrimaerKnopfStil(aktiv: bereitZurPruefung))
            .disabled(!bereitZurPruefung || prueft)
            Button {
                Haptik.tippen()
                scanner = true
            } label: {
                Label("QR-Code scannen", systemImage: "qrcode.viewfinder")
                    .font(.body.weight(.semibold))
                    .frame(maxWidth: .infinity, minHeight: 46)
            }
            .buttonStyle(ZweitKnopfStil())
        }
        .padding(18)
        .kartenflaeche(radius: 16)
    }

    private var bereitZurPruefung: Bool {
        !eingabe.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var randfarbe: Color {
        switch stand {
        case .gefunden: return Farben.ok
        case .fehler: return Farben.entfall
        case .format: return Farben.warnung
        default: return fokus == .server ? Farben.akzent : Farben.randStark
        }
    }

    private var adressfeld: some View {
        HStack(spacing: 10) {
            Image(systemName: "building.columns")
                .foregroundStyle(Farben.text3)
                .accessibilityHidden(true)
            TextField("plan.meine-schule.de", text: $eingabe)
                .keyboardType(.URL)
                .textContentType(.URL)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .focused($fokus, equals: .server)
                .submitLabel(.continue)
                .onSubmit { Task { await pruefen() } }
                .accessibilityLabel("EduOrga-Adresse der Schule")
            Group {
                switch stand {
                case .prueft:
                    ProgressView()
                case .gefunden:
                    Image(systemName: "checkmark.circle.fill").foregroundStyle(Farben.ok)
                case .fehler:
                    Image(systemName: "exclamationmark.circle.fill").foregroundStyle(Farben.entfall)
                case .format:
                    Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(Farben.warnung)
                case .leer:
                    EmptyView()
                }
            }
            .accessibilityHidden(true)
        }
        .padding(.horizontal, 14)
        .frame(minHeight: 50)
        .background(Farben.flaeche, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(randfarbe, lineWidth: fokus == .server || stand != .leer ? 1.5 : 1)
        }
        .animation(.easeInOut(duration: 0.15), value: stand)
    }

    @ViewBuilder
    private var standZeile: some View {
        switch stand {
        case .leer:
            Text("Die Adresse steht z. B. im Elternbrief oder auf der Website Ihrer Schule. „https://“ wird ergänzt.")
                .font(.footnote)
                .foregroundStyle(Farben.text3)
                .fixedSize(horizontal: false, vertical: true)
        case .format:
            Label("Bitte eine vollständige Adresse eingeben, z. B. plan.meine-schule.de", systemImage: "info.circle")
                .font(.footnote)
                .foregroundStyle(Farben.warnung)
        case .prueft:
            Text("Schule wird gesucht …")
                .font(.footnote)
                .foregroundStyle(Farben.text2)
        case .gefunden(let info):
            HStack(spacing: 8) {
                Image(systemName: info.verschluesselt ? "lock.fill" : "lock.open")
                    .font(.caption)
                    .foregroundStyle(info.verschluesselt ? Farben.ok : Farben.warnung)
                Text(info.schulname.isEmpty ? "EduOrga gefunden: \(info.kurz)" : info.schulname)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Farben.ok)
                    .lineLimit(2)
            }
            .accessibilityElement(children: .combine)
        case .fehler(let text):
            Text(text)
                .font(.footnote)
                .foregroundStyle(Farben.entfall)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    @ViewBuilder
    private var verlaufAbschnitt: some View {
        let liste = bekannteSchulen
        if !liste.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text(hinzufuegen ? "Weiteres Konto an einer bekannten Schule" : "Zuletzt verwendet")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Farben.text2)
                    .textCase(.uppercase)
                    .padding(.leading, 4)
                VStack(spacing: 0) {
                    ForEach(Array(liste.enumerated()), id: \.element.adresse) { i, info in
                        if i > 0 { Divider().padding(.leading, 56) }
                        Button {
                            serverWaehlen(info)
                        } label: {
                            schulzeile(info, pfeil: true)
                                .padding(.horizontal, 14)
                                .padding(.vertical, 10)
                        }
                        .buttonStyle(ZeilenKnopfStil())
                        .contextMenu {
                            if !zustand.konten.contains(where: { $0.server.caseInsensitiveCompare(info.adresse) == .orderedSame }) {
                                Button(role: .destructive) {
                                    Schulverlauf.entfernen(info.adresse)
                                    verlauf = Schulverlauf.laden()
                                } label: {
                                    Label("Aus der Liste entfernen", systemImage: "trash")
                                }
                            }
                        }
                    }
                }
                .kartenflaeche(radius: 14)
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

    private func anmeldeKarte(_ s: ServerInfo) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                schulzeile(s, pfeil: false)
                Button("Ändern") {
                    eingabe = s.kurz
                    fehler = nil
                    passwort = ""
                    server = nil
                }
                .font(.subheadline.weight(.semibold))
                .buttonStyle(.borderless)
                .foregroundStyle(Farben.akzent)
                .accessibilityHint("Andere Schule bzw. Adresse wählen")
            }
            .padding(12)
            .background(Farben.primaerFlaeche, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            if !s.verschluesselt {
                Label("Unverschlüsselte Verbindung: Benutzername und Passwort werden ohne HTTPS übertragen.",
                      systemImage: "exclamationmark.triangle")
                    .font(.footnote)
                    .foregroundStyle(Farben.entfall)
            }
            Text("Anmelden")
                .font(.title3.weight(.semibold))
                .foregroundStyle(Farben.text)
            VStack(spacing: 10) {
                eingabefeld(symbol: "person") {
                    TextField("Benutzername", text: $login)
                        .textContentType(.username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($fokus, equals: .login)
                        .submitLabel(.next)
                        .onSubmit { fokus = .passwort }
                }
                eingabefeld(symbol: "key") {
                    HStack {
                        Group {
                            if zeigen {
                                TextField("Passwort", text: $passwort)
                                    .textInputAutocapitalization(.never)
                                    .autocorrectionDisabled()
                            } else {
                                SecureField("Passwort", text: $passwort)
                            }
                        }
                        .textContentType(.password)
                        .focused($fokus, equals: .passwort)
                        .submitLabel(.go)
                        .onSubmit { Task { await anmelden() } }
                        Button {
                            zeigen.toggle()
                        } label: {
                            Image(systemName: zeigen ? "eye.slash" : "eye")
                                .foregroundStyle(Farben.text3)
                        }
                        .buttonStyle(.borderless)
                        .accessibilityLabel(zeigen ? "Passwort verbergen" : "Passwort zeigen")
                    }
                }
            }
            Toggle("Passwort merken", isOn: $merken)
                .tint(Farben.akzent)
                .font(.subheadline)
            if let fehler {
                Label(fehler, systemImage: "exclamationmark.circle")
                    .font(.footnote)
                    .foregroundStyle(Farben.entfall)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Button {
                Task { await anmelden() }
            } label: {
                knopfText("Anmelden", arbeitet: laedt)
            }
            .buttonStyle(PrimaerKnopfStil(aktiv: bereitZurAnmeldung))
            .disabled(!bereitZurAnmeldung || laedt)
            if let s = server, let url = Datenschutz.hinweise(server: s.adresse) {
                Link("Datenschutzhinweise der Schule", destination: url)
                    .font(.footnote)
                    .tint(Farben.akzent)
            }
            if hinzufuegen {
                Text("Das bisherige Konto bleibt angemeldet; unter „Profil“ (Avatar oben rechts) → „Konten und Schulen“ wechseln Sie jederzeit zurück.")
                    .font(.footnote)
                    .foregroundStyle(Farben.text3)
            }
        }
        .padding(18)
        .kartenflaeche(radius: 16)
    }

    private func eingabefeld<Inhalt: View>(symbol: String, @ViewBuilder inhalt: () -> Inhalt) -> some View {
        HStack(spacing: 10) {
            Image(systemName: symbol)
                .foregroundStyle(Farben.text3)
                .frame(width: 20)
                .accessibilityHidden(true)
            inhalt()
        }
        .padding(.horizontal, 14)
        .frame(minHeight: 48)
        .background(Farben.flaeche, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(Farben.randStark, lineWidth: 1)
        }
    }

    // MARK: - Bausteine

    private var fuss: some View {
        VStack(spacing: 6) {
            Text("Ihre Daten liegen bei Ihrer Schule: Die App verbindet sich nur mit der EduOrga-Installation Ihrer Schule.")
            Text(Marke.hinweis)
                .font(.caption2)
                .foregroundStyle(Farben.text3)
        }
        .font(.caption)
        .foregroundStyle(Farben.text3)
        .multilineTextAlignment(.center)
        .padding(.horizontal, 8)
        .padding(.top, 4)
    }

    private func knopfText(_ titel: String, arbeitet: Bool) -> some View {
        HStack {
            Spacer()
            if arbeitet {
                ProgressView()
                    .tint(.white)
            } else {
                Text(titel)
                    .fontWeight(.semibold)
            }
            Spacer()
        }
        .frame(minHeight: 48)
    }

    /// Schule: Name (bzw. Adresse) und darunter die Adresse.
    private func schulzeile(_ s: ServerInfo, pfeil: Bool) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "building.columns.fill")
                .font(.body)
                .foregroundStyle(Farben.primaer)
                .frame(width: 30, height: 30)
                .background(Farben.primaerFlaeche, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(s.schulname.isEmpty ? s.kurz : s.schulname)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Farben.text)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
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

    /// Gespeicherte Konten zum Wechsel (nur in der Anmeldemaske, nicht beim Hinzufügen).
    @ViewBuilder
    private func kontenAbschnitt(_ liste: [Konto]) -> some View {
        if !liste.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("Gespeicherte Konten")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Farben.text2)
                    .textCase(.uppercase)
                    .padding(.leading, 4)
                VStack(spacing: 0) {
                    ForEach(Array(liste.enumerated()), id: \.element.id) { i, konto in
                        if i > 0 { Divider().padding(.leading, 14) }
                        Button {
                            Task {
                                wechselt = konto.id
                                await zustand.wechseln(zu: konto)
                                wechselt = nil
                            }
                        } label: {
                            HStack(spacing: 12) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(konto.rollenname.isEmpty ? konto.name : "\(konto.name) · \(konto.rollenname)")
                                        .foregroundStyle(Farben.text)
                                    Text(konto.schulname.isEmpty ? konto.serverKurz : konto.schulname)
                                        .font(.footnote)
                                        .foregroundStyle(Farben.text2)
                                }
                                Spacer()
                                if wechselt == konto.id { ProgressView() }
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(ZeilenKnopfStil())
                        .disabled(wechselt != nil)
                    }
                }
                .kartenflaeche(radius: 14)
            }
        }
    }

    // MARK: - Abläufe

    /// Beim ersten Erscheinen: Einrichtungslink übernehmen bzw. (Anmeldemaske) mit dem gespeicherten Server beginnen.
    private func vorbereiten() {
        verlauf = Schulverlauf.laden()
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
        let name = konto?.schulname ?? verlauf.first { $0.adresse.caseInsensitiveCompare(gespeichert) == .orderedSame }?.schulname ?? ""
        let info = ServerInfo(adresse: gespeichert, schulname: name)
        eingabe = info.kurz
        server = info
        Task { await schulnameAuffrischen(gespeichert) }
    }

    /// Link „untplannext://einrichten?server=…“: Adresse eintragen und gleich prüfen.
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

    /// Format der Eingabe grob prüfen (Domain mit Punkt, keine Leerzeichen).
    private func formatGueltig(_ text: String) -> Bool {
        let adresse = ApiClient.adresseNormalisieren(text)
        guard let teile = URLComponents(string: adresse), let host = teile.host, !host.contains(" ") else { return false }
        return host.contains(".") || host == "localhost"
    }

    /// Beim Tippen (verzögert): Format prüfen, dann den Server suchen und den Schulnamen zeigen.
    private func livePruefen() async {
        let text = eingabe.trimmingCharacters(in: .whitespacesAndNewlines)
        guard server == nil else { return }
        if text.isEmpty {
            stand = .leer
            return
        }
        // QR-Inhalt bzw. Einrichtungslink eingefügt: die Adresse daraus übernehmen
        if text.lowercased().hasPrefix("untplannext:"), let adresse = Einrichtungscode.adresse(aus: text) {
            eingabe = adresse
            return
        }
        try? await Task.sleep(nanoseconds: 700_000_000)
        guard !Task.isCancelled else { return }
        guard formatGueltig(text) else {
            stand = text.count >= 4 ? .format : .leer
            return
        }
        stand = .prueft
        do {
            let info = try await ApiClient.serverPruefen(text)
            guard !Task.isCancelled, eingabe.trimmingCharacters(in: .whitespacesAndNewlines) == text else { return }
            stand = .gefunden(info)
        } catch is CancellationError {
            // neue Eingabe
        } catch {
            guard !Task.isCancelled else { return }
            stand = .fehler(error.localizedDescription)
        }
    }

    /// Schritt 1 abschließen: Adresse prüfen (bzw. das Ergebnis der Prüfung beim Tippen nehmen) und zur Anmeldung.
    private func pruefen() async {
        guard !prueft else { return }
        let text = eingabe.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else {
            stand = .fehler(Serverpruefung.leer.errorDescription ?? "")
            return
        }
        if case .gefunden(let info) = stand {
            serverWaehlen(info)
            return
        }
        prueft = true
        stand = .prueft
        defer { prueft = false }
        do {
            let info = try await ApiClient.serverPruefen(text)
            stand = .gefunden(info)
            serverWaehlen(info)
        } catch is CancellationError {
            // abgebrochen
        } catch {
            stand = .fehler(error.localizedDescription)
            Haptik.tippen()
        }
    }

    /// Schule übernehmen und zur Anmeldung wechseln.
    private func serverWaehlen(_ info: ServerInfo) {
        fehler = nil
        passwort = ""
        let gleicherServer = info.adresse.caseInsensitiveCompare(ApiClient.shared.serverAdresse) == .orderedSame
        if hinzufuegen || !gleicherServer { login = "" }
        if hinzufuegen { merken = true }
        Schulverlauf.merken(info)
        verlauf = Schulverlauf.laden()
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
            Schulverlauf.merken(ServerInfo(adresse: ApiClient.adresseNormalisieren(s.adresse),
                                           schulname: zustand.sitzung?.schule?.name ?? s.schulname))
            passwort = ""
            Haptik.erfolg()
            fertig?()
        } catch {
            fehler = error.localizedDescription
        }
    }
}

// MARK: - Knöpfe der Einrichtung

/// Primärknopf: volle Breite, Petrol, weiße Schrift; inaktiv blasser.
struct PrimaerKnopfStil: ButtonStyle {
    var aktiv: Bool = true

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(Color.white)
            .background(Farben.primaer.opacity(aktiv ? (configuration.isPressed ? 0.85 : 1) : 0.45),
                        in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.99 : 1)
    }
}

/// Zweitknopf: volle Breite, helle Fläche mit Rand, Schrift in der Akzentfarbe.
struct ZweitKnopfStil: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(Farben.akzent)
            .background(configuration.isPressed ? Farben.primaerFlaeche : Farben.flaeche,
                        in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(Farben.primaerRand, lineWidth: 1)
            }
    }
}
