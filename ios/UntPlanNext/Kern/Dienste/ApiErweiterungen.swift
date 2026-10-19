import Foundation

// Weitere Endpunkte von EduOrga Web (/api/app …), genau wie sie der Web-Client benutzt (web/client/src/pages/…):
// Klassenbuch (offene Stunden, Einträge, Hausaufgaben, Klassendienste, Befreiungen, Sitzplan), Prüfungen,
// Vertretungsplan, Melden, Buchen, Sprechtag (Liste, Einladungen, Termine, Warteliste), Infocenter, Profil und Familie.

extension ApiClient {
    /// Teil eines Pfads sicher kodieren (Klassen wie „5/1“ oder mit Leerzeichen).
    static func pfadteil(_ text: String) -> String {
        var erlaubt = CharacterSet.urlPathAllowed
        erlaubt.remove(charactersIn: "/?#")
        return text.addingPercentEncoding(withAllowedCharacters: erlaubt) ?? text
    }

    /// Parameter ohne leere Werte.
    private func werte(_ paare: [String: String?]) -> [String: String] {
        var p: [String: String] = [:]
        for (k, v) in paare {
            if let v, !v.isEmpty { p[k] = v }
        }
        return p
    }

    /// Datei (PDF) herunterladen.
    func datei(_ pfad: String, parameter: [String: String] = [:]) async throws -> Data {
        var req = URLRequest(url: try url(pfad, parameter))
        req.httpMethod = "GET"
        req.timeoutInterval = 120
        return try await rohAnfrage(req, pfad: pfad)
    }

    // MARK: Klassenbuch: offene Stunden

    /// GET /klassenbuch/offene-stunden?art=alle – gehaltene Stunden mit Stand von Abwesenheitskontrolle und Lehrstoff.
    func offeneStunden(bereich: String? = nil, von: String? = nil, bis: String? = nil, klasse: String? = nil) async throws -> OffeneStundenAntwort {
        var p = werte(["bereich": bereich, "klasse": klasse])
        p["art"] = "alle"
        if bereich == "individuell" {
            if let von { p["von"] = von }
            if let bis { p["bis"] = bis }
        }
        return try await anfrage("GET", "/klassenbuch/offene-stunden", parameter: p)
    }

    /// PUT /klassenbuch/offene-stunden/zeitbereich – gewählten Zeitbereich für das Konto speichern.
    func offenZeitbereichSetzen(_ bereich: String, von: String? = nil, bis: String? = nil) async throws {
        let _: BeliebigeAntwort = try await anfrage("PUT", "/klassenbuch/offene-stunden/zeitbereich",
                                                    koerper: try encoder.encode(OffenZeitbereichDaten(bereich: bereich, von: von, bis: bis)))
    }

    // MARK: Klassenbuch: Einträge, Hausaufgaben, Schüler*innen

    /// GET /klassenbucheintraege?von&bis&klasse&art
    func klassenbucheintraege(von: String, bis: String, klasse: String?, art: String?) async throws -> Vermerkzeilen {
        try await anfrage("GET", "/klassenbucheintraege", parameter: werte(["von": von, "bis": bis, "klasse": klasse, "art": art]))
    }

    /// DELETE /klassenbuch/vermerke/{id}
    func vermerkLoeschen(_ id: Int) async throws {
        let _: BeliebigeAntwort = try await anfrage("DELETE", "/klassenbuch/vermerke/\(id)", koerper: nil)
    }

    /// PUT /klassenbuch/vermerke/{id}
    func vermerkAendern(_ id: Int, _ daten: VermerkNeuDaten) async throws {
        let _: BeliebigeAntwort = try await anfrage("PUT", "/klassenbuch/vermerke/\(id)", koerper: try encoder.encode(daten))
    }

    /// GET /hausaufgaben/eintraege?von&bis&klasse&lehrer
    func hausaufgabenEintraege(von: String, bis: String, klasse: String? = nil, lehrer: String? = nil) async throws -> [HausaufgabeZeile] {
        let liste: [Vielleicht<HausaufgabeZeile>] = try await anfrage("GET", "/hausaufgaben/eintraege",
                                                                      parameter: werte(["von": von, "bis": bis, "klasse": klasse, "lehrer": lehrer]))
        return liste.compactMap(\.wert)
    }

    /// GET /klassenbuch/schueler?klasse=…
    func klassenSchueler(_ klasse: String) async throws -> [Schueler] {
        let liste: [Vielleicht<Schueler>] = try await anfrage("GET", "/klassenbuch/schueler", parameter: ["klasse": klasse])
        return liste.compactMap(\.wert)
    }

    // MARK: Klassendienste

    func klassendienstUebersicht(klasse: String, von: String, bis: String) async throws -> KlassendienstUebersicht {
        try await anfrage("GET", "/klassendienste", parameter: ["klasse": klasse, "von": von, "bis": bis])
    }

    func dienstAnlegen(_ daten: DienstDaten) async throws {
        let _: BeliebigeAntwort = try await anfrage("POST", "/klassendienste", koerper: try encoder.encode(daten))
    }

    func dienstLoeschen(_ id: Int) async throws {
        let _: BeliebigeAntwort = try await anfrage("DELETE", "/klassendienste/\(id)", koerper: nil)
    }

    // MARK: Befreiungen

    func befreiungen(klasse: String?, von: String, bis: String) async throws -> Befreiungsliste {
        try await anfrage("GET", "/befreiungen", parameter: werte(["klasse": klasse, "von": von, "bis": bis]))
    }

    func befreiungSpeichern(_ id: Int?, _ daten: BefreiungDaten) async throws {
        if let id {
            let _: BeliebigeAntwort = try await anfrage("PUT", "/befreiungen/\(id)", koerper: try encoder.encode(daten))
        } else {
            let _: BeliebigeAntwort = try await anfrage("POST", "/befreiungen", koerper: try encoder.encode(daten))
        }
    }

    func befreiungLoeschen(_ id: Int) async throws {
        let _: BeliebigeAntwort = try await anfrage("DELETE", "/befreiungen/\(id)", koerper: nil)
    }

    // MARK: Sitzplan

    /// GET /sitzplan/{klasse}
    func sitzplanKlasse(_ klasse: String) async throws -> SitzplanKlasse {
        try await anfrage("GET", "/sitzplan/\(Self.pfadteil(klasse))")
    }

    /// GET /sitzplaene/stunde?unterricht&raeume&klassen&lehrer – gültiger Sitzplan einer Stunde.
    func sitzplanStunde(unterricht: Int?, raeume: [String], klassen: [String], lehrer: String?) async throws -> SitzplanStunde {
        var p = werte(["lehrer": lehrer])
        if let unterricht { p["unterricht"] = String(unterricht) }
        if !raeume.isEmpty { p["raeume"] = raeume.joined(separator: ",") }
        if !klassen.isEmpty { p["klassen"] = klassen.joined(separator: ",") }
        return try await anfrage("GET", "/sitzplaene/stunde", parameter: p)
    }

    // MARK: Prüfungen und Vertretungsplan

    /// GET /pruefungen?von&bis&klasse&lehrer (Klassenkonten: eigene Klasse)
    func pruefungen(von: String, bis: String, klasse: String? = nil, lehrer: String? = nil) async throws -> [Pruefung] {
        let liste: [Vielleicht<Pruefung>] = try await anfrage("GET", "/pruefungen",
                                                              parameter: werte(["von": von, "bis": bis, "klasse": klasse, "lehrer": lehrer]))
        return liste.compactMap(\.wert)
    }

    /// GET /vertretungen?datum&tage (1–7)
    func vertretungen(datum: String, tage: Int) async throws -> Vertretungsplan {
        try await anfrage("GET", "/vertretungen", parameter: ["datum": datum, "tage": String(min(7, max(1, tage)))])
    }

    // MARK: Melden

    /// POST /meldungen/abwesenheit – eigene Abwesenheit an die Vertretungsplanung melden.
    func abwesenheitMelden(_ daten: AbwesenheitMeldenDaten) async throws {
        let _: BeliebigeAntwort = try await anfrage("POST", "/meldungen/abwesenheit", koerper: try encoder.encode(daten))
    }

    /// POST /meldungen/klausur – Prüfung eintragen (steht sofort als vorgemerkt im Plan).
    func klausurEintragen(_ daten: KlausurDaten) async throws {
        let _: BeliebigeAntwort = try await anfrage("POST", "/meldungen/klausur", koerper: try encoder.encode(daten))
    }

    /// POST /meldungen/klausur/loeschen
    func klausurLoeschen(_ daten: KlausurLoeschenDaten) async throws {
        let _: BeliebigeAntwort = try await anfrage("POST", "/meldungen/klausur/loeschen", koerper: try encoder.encode(daten))
    }

    /// DELETE /meldungen/{id} – offene Meldung zurückziehen.
    func meldungZurueckziehen(_ id: String) async throws {
        let _: BeliebigeAntwort = try await anfrage("DELETE", "/meldungen/\(Self.pfadteil(id))", koerper: nil)
    }

    // MARK: Buchen

    func buchungsoptionen() async throws -> Buchungsoptionen {
        try await anfrage("GET", "/buchen/optionen")
    }

    func raumsuche(_ anfrage: BuchSuchAnfrage) async throws -> Raumsuche {
        try await self.anfrage("POST", "/buchen/suche/raeume", koerper: try encoder.encode(anfrage))
    }

    func ressourcensuche(_ anfrage: BuchSuchAnfrage) async throws -> Ressourcensuche {
        try await self.anfrage("POST", "/buchen/suche/ressourcen", koerper: try encoder.encode(anfrage))
    }

    func buchen(_ daten: BuchungNeuDaten) async throws -> BuchungAntwort {
        try await anfrage("POST", "/buchen", koerper: try encoder.encode(daten))
    }

    /// GET /buchen/liste?von&bis – eigene Buchungen.
    func buchungen(von: String, bis: String) async throws -> [Buchung] {
        let liste: [Vielleicht<Buchung>] = try await anfrage("GET", "/buchen/liste", parameter: ["von": von, "bis": bis])
        return liste.compactMap(\.wert)
    }

    /// DELETE /buchen/{id}[?serie=true]
    func buchungStornieren(_ id: Int, serie: Bool) async throws -> Int {
        let a: StornoAntwort = try await anfrage("DELETE", "/buchen/\(id)", parameter: serie ? ["serie": "true"] : [:], koerper: nil)
        return a.storniert
    }

    // MARK: Sprechtag

    /// GET /sprechtag – sichtbare Sprechtage.
    func sprechtage() async throws -> SprechtagListe {
        try await anfrage("GET", "/sprechtag")
    }

    /// GET /sprechtag/{id}/schueler – Schüler*innen zum Einladen bzw. Eintragen.
    func sprechtagSchueler(_ id: Int) async throws -> SprechtagSchuelerauswahl {
        try await anfrage("GET", "/sprechtag/\(id)/schueler")
    }

    func sprechtagEinladen(_ id: Int, _ daten: SprechtagEinladungDaten) async throws -> SprechtagEinladungAntwort {
        try await anfrage("POST", "/sprechtag/\(id)/einladungen", koerper: try encoder.encode(daten))
    }

    func sprechtagEinladungLoeschen(_ id: Int, einladung: Int) async throws {
        let _: BeliebigeAntwort = try await anfrage("DELETE", "/sprechtag/\(id)/einladungen/\(einladung)", koerper: nil)
    }

    func sprechtagTerminEintragen(_ id: Int, _ daten: SprechtagTerminDaten) async throws {
        let _: BeliebigeAntwort = try await anfrage("POST", "/sprechtag/\(id)/termine", koerper: try encoder.encode(daten))
    }

    func sprechtagTeilnahmeAbsagen(_ id: Int, grund: String?) async throws {
        let _: BeliebigeAntwort = try await anfrage("POST", "/sprechtag/\(id)/teilnahme/absagen",
                                                    koerper: try encoder.encode(SprechtagAbsageDaten(grund: grund)))
    }

    func sprechtagTeilnahmeWiederaufnehmen(_ id: Int) async throws {
        let _: BeliebigeAntwort = try await anfrage("POST", "/sprechtag/\(id)/teilnahme/wiederaufnehmen",
                                                    koerper: try encoder.encode(SprechtagAbsageDaten(grund: nil)))
    }

    func sprechtagWartelisteEintragen(_ id: Int, _ daten: SprechtagWarteDaten) async throws {
        let _: BeliebigeAntwort = try await anfrage("POST", "/sprechtag/\(id)/warteliste", koerper: try encoder.encode(daten))
    }

    func sprechtagWartelisteVerlassen(_ id: Int, platz: Int) async throws {
        let _: BeliebigeAntwort = try await anfrage("DELETE", "/sprechtag/\(id)/warteliste/\(platz)", koerper: nil)
    }

    /// Terminplan als PDF (Lehrkraft: plan.pdf, Eltern: elternplan.pdf).
    func sprechtagPdf(_ id: Int, eltern: Bool) async throws -> Data {
        try await datei("/sprechtag/\(id)/" + (eltern ? "elternplan.pdf" : "plan.pdf"))
    }

    // MARK: Infocenter und Profil

    func infocenter() async throws -> InfocenterAntwort {
        try await anfrage("GET", "/infocenter")
    }

    func infocenterGelesen(_ schluessel: [String], alle: Bool = false) async throws {
        let _: BeliebigeAntwort = try await anfrage("POST", "/infocenter/gelesen",
                                                    koerper: try encoder.encode(InfocenterGelesenDaten(schluessel: schluessel, alle: alle)))
    }

    /// PUT /profil – E-Mail und Benachrichtigung per E-Mail.
    func profilSpeichern(_ daten: ProfilDaten) async throws {
        let _: BeliebigeAntwort = try await anfrage("PUT", "/profil", koerper: try encoder.encode(daten))
    }

    // MARK: Familie

    func familieHausaufgaben(schueler: Int?, von: String, bis: String) async throws -> FamilieHausaufgaben {
        var p = ["von": von, "bis": bis]
        if let schueler { p["schueler"] = String(schueler) }
        return try await anfrage("GET", "/familie/hausaufgaben", parameter: p)
    }

    /// GET /familie/entschuldigung – Entschuldigungsschreiben (PDF zum Unterschreiben) für nicht entschuldigte Abwesenheiten.
    func entschuldigungsschreiben(schueler: Int?, von: String?, bis: String?) async throws -> Data {
        var p = werte(["von": von, "bis": bis])
        if let schueler { p["schueler"] = String(schueler) }
        return try await datei("/familie/entschuldigung", parameter: p)
    }

    // MARK: Gepufferte Schreibzugriffe (offline)

    /// Schreibzugriff senden; ist der Server nicht erreichbar (offline, Zeitüberschreitung), wird er im Schreibpuffer
    /// gemerkt und später gesendet. true = gesendet, false = gepuffert. Andere Fehler (Rechte, Prüfung) werden geworfen.
    @MainActor
    func schreibenOderPuffern<D: Encodable>(_ methode: String, _ pfad: String, daten: D, titel: String) async throws -> Bool {
        let koerper = try encoder.encode(daten)
        do {
            let _: BeliebigeAntwort = try await anfrage(methode, pfad, koerper: koerper)
            return true
        } catch ApiFehler.nichtErreichbar(_) {
            Schreibpuffer.shared.hinzufuegen(methode: methode, pfad: pfad, koerper: koerper, titel: titel)
            return false
        }
    }

    /// Gepufferten Auftrag unverändert senden.
    func auftragSenden(_ a: GepufferterAuftrag) async throws {
        let _: BeliebigeAntwort = try await anfrage(a.methode, a.pfad, koerper: a.koerper)
    }
}
