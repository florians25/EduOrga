# Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO) – Vorlage für EduOrga

> Vorlage, die die Schule an ihre Situation anpasst (nicht genutzte Module streichen, Fristen eintragen, Empfänger
> ergänzen). Rechtsgrundlagen und Fristen sind Vorschläge und **von der Schule bzw. der/dem Datenschutzbeauftragten zu
> prüfen**. Teil 2 beschreibt den technischen Datenbestand je Programm als Grundlage.

## Teil 1: Angaben zum Verantwortlichen

| | |
|---|---|
| Verantwortlicher | [Name der Schule, Anschrift, Schulnummer] |
| Vertreten durch | [Schulleiterin/Schulleiter] |
| Datenschutzbeauftragte*r | [Name, Kontakt] |
| Auftragsverarbeiter (Betrieb) | [Schulträger/IT-Dienstleister, AV-Vertrag vom …] |
| Technische und organisatorische Maßnahmen | siehe [`TOM.md`](TOM.md) (Art. 32) |
| Datenschutzhinweise (Art. 13/14) | `https://[EduOrga Web]/datenschutz` |
| Stand | [Datum] |

Gemeinsame Angaben für alle Tätigkeiten, soweit nicht anders vermerkt:

- **Rechtsgrundlage**: Art. 6 Abs. 1 Buchst. e (bzw. c) DSGVO i. V. m. §§ 120 ff. SchulG NRW und VO-DV I (Schüler*innen,
  Eltern) bzw. VO-DV II (Lehrkräfte); bei Gesundheitsangaben zusätzlich Art. 9 DSGVO (**zu prüfen**).
- **Empfänger**: nur Berechtigte innerhalb der Schule nach Rolle (siehe [`TOM.md`](TOM.md) A.1); Auftragsverarbeiter
  (Betrieb); Übermittlungen an Dritte nur auf Grund einer Rechtsvorschrift. Keine Übermittlung in Drittländer –
  Ausnahme: Push-Dienste der Gerätehersteller, falls genutzt (Gerätekennung, allgemeine Nachricht; **zu prüfen**).
- **Speicherort**: Server der Schule bzw. des Betreibers [Standort]; Datenbanken von Studio und Web getrennt.

### VT 1 – Benutzerkonten und Anmeldung (EduOrga Web, Studio)

| | |
|---|---|
| Zweck | Zugang zum Schulportal bzw. zur Planung, Missbrauchserkennung, Konto wechseln |
| Betroffene | Lehrkräfte, Schulleitung, Personal, Schüler*innen, Erziehungsberechtigte |
| Daten | Benutzername, Anzeigename, Rolle, Kürzel/Klasse, E-Mail (freiwillig), Passwort-Hash, Zuordnung Eltern ↔ Kinder, Rechte, Sprache, Benachrichtigungseinstellung, letzte Anmeldung, Kenntnisnahme der Datenschutzhinweise; Anmeldeprotokoll (Zeit, Ergebnis, IP-Adresse, Gerät); gemerkte Geräte (Hash) |
| Löschung | Konto: beim Ausscheiden sperren, dann löschen bzw. anonymisieren [Frist der Schule, z. B. Ende des Schuljahres]; Anmeldeprotokoll 30 Tage; gemerkte Geräte 30 Tage |

### VT 2 – Stunden- und Vertretungsplanung (EduOrga Studio → Web, Mobile, iOS)

| | |
|---|---|
| Zweck | Unterrichtsorganisation, Vertretungen, Aufsichten, Auswertungen (u. a. Mehrarbeit) |
| Betroffene | Lehrkräfte; Klassen/Kurse; Schüler*innen (Kurswahlen in der Oberstufe) |
| Daten (Studio) | Lehrkräfte: Name, Vorname, Titel, Kürzel, Personalnummer, E-Mail, Telefon, Geburtsdatum, Geschlecht, Eintritt/Austritt, Wochensoll, Ermäßigungen (Gründe können sensibel sein – **zu prüfen**), Zeitwünsche, Fächer; Abwesenheiten mit Grund; Vertretungen, Mehrarbeit; Schüler*innen: Name, Klasse, Geschlecht, Kurswahlen |
| Daten (Web) | Pläne, Vertretungen, Abwesenheitszeiträume von Lehrkräften (Grund nur, wenn freigegeben und nicht vertraulich), E-Mail nur wenn freigegeben, Schülerliste (Name, Klasse) |
| Löschung | Planungsdokumente nach [Frist der Schule, z. B. Ende des Folgeschuljahres]; Stundenplan-Versionen in Web mit dem Paket; Daten der Lehrkräfte nach VO-DV II (**zu prüfen**) |

### VT 3 – Digitales Klassenbuch (EduOrga Web, Mobile, iOS)

| | |
|---|---|
| Zweck | Dokumentation von Unterricht und Klassenführung, Schulpflichtüberwachung, Entschuldigungsverfahren |
| Betroffene | Schüler*innen, Lehrkräfte |
| Daten | Lehrstoff, Hausaufgaben, Notizen je Stunde (Lehrkraft); Anwesenheit, Fehlzeiten, Verspätungen, Gründe, Entschuldigungsstatus und -datum, Nachweise, interne Notizen der Klassenleitung; Klassenbucheinträge/Vermerke; Befreiungen (z. B. Sport – Gesundheitsbezug); Klassendienste; Sitzpläne; Schülergruppen |
| Löschung | Vorschlag: 10 Jahre nach Ablauf des Kalenderjahres, in dem das Schuljahr endete (VO-DV I § 9 „Klassenbuch“, **zu prüfen**) – Kategorie *Klassenbuch* einschalten |

### VT 4 – Abwesenheitsmeldungen der Eltern

| | |
|---|---|
| Zweck | Krank- und Abwesenheitsmeldung, Bestätigung durch die Klassenleitung |
| Betroffene | Schüler*innen, Erziehungsberechtigte |
| Daten | Zeitraum, Grund, Freitext (kann Gesundheitsangaben enthalten), Status, Antwort, Melder*in, Bearbeiter*in |
| Löschung | Vorschlag: 5 Jahre nach Schuljahresende (VO-DV I „übrige Daten“, **zu prüfen**; ggf. kürzer, wenn die Abwesenheit im Klassenbuch steht) |

### VT 5 – Mitteilungen und Infocenter

| | |
|---|---|
| Zweck | Kommunikation zwischen Schule, Kollegium und Familien |
| Daten | Absender, Empfänger, Betreff, Text, Anhänge, Lesebestätigungen, Verteilerlisten, Gelesen-Vermerke |
| Löschung | [Frist der Schule, Vorschlag 365 Tage] – Kategorie *Mitteilungen*; Hinweis an das Kollegium: keine sensiblen Inhalte ohne Notwendigkeit |

### VT 6 – Elternsprechtag

| | |
|---|---|
| Daten | Einladungen, gebuchte Termine (Kind, Lehrkraft, Zeit, Raum/Online-Link, Notiz), Wartelisten, Absagen mit Grund |
| Löschung | Vorschlag 90 Tage nach dem Sprechtag – Kategorie *Elternsprechtag* |

### VT 7 – Raum- und Gerätebuchung

| | |
|---|---|
| Daten | Buchende Lehrkraft, Termin, Raum/Ressource, Titel, Text, Klassen |
| Löschung | Vorschlag 2 Jahre – Kategorie *Raum- und Gerätebuchungen* |

### VT 8 – Schülerverwaltung in EduOrga Web

| | |
|---|---|
| Daten | ergänzend zur Liste aus Studio: Geschlecht, Geburtsdatum, E-Mail, Bemerkung, externe Nummer, Eintritt/Austritt, Klassenwechsel; Personenliste (Erziehungsberechtigte, Personal: Name, Funktion, E-Mail, Telefon, Kinder) |
| Löschung | nach Abgang: *Datenschutz → Löschen …* (Sperre bis zum Ende der Klassenbuchfrist); führendes System bleibt die Schulverwaltung |

### VT 9 – Apps und Benachrichtigungen (EduOrga Mobile, iOS)

| | |
|---|---|
| Daten | Geräteprofile (Sitzung verschlüsselt), Web-Push-Abonnements (Endpunkt des Push-Dienstes), letzter Planstand je Konto (Vergleich), APNs-Gerätetokens; auf dem Gerät: zwischengespeicherte Pläne und API-Antworten, Einstellungen, iOS-Schlüsselbund |
| Empfänger | Push-Dienste von Apple/Google/Mozilla: Gerätekennung und allgemeine Nachricht (Standard ohne Einzelheiten) |
| Löschung | mit dem Abmelden auf dem Gerät; Push-Abos beim Abmelden bzw. wenn der Dienst sie als abgelaufen meldet; APNs-Tokens Kategorie *Geräte für Sofort-Benachrichtigungen* |

### VT 10 – Protokolle und Sicherungen (technisch)

| | |
|---|---|
| Zweck | Nachvollziehbarkeit, Datensicherheit (Art. 32), Wiederherstellung |
| Daten | Verwaltungsprotokoll (Zeit, Benutzername, Aktion, Details), Löschprotokoll (nur Anzahlen), Sitzungsübersicht im Arbeitsspeicher (IP, Gerät, höchstens 14 Tage), Datenbanksicherungen (vollständige Kopien) |
| Löschung | Verwaltungsprotokoll 365 Tage; Sicherungen: die letzten 14 (`SICHERUNGEN_BEHALTEN`) bzw. [Frist der externen Ablage] |

## Teil 2: Datenbestand je Programm (technisch)

### EduOrga Web – Datenbank (SQLite `/data/untplanweb.db` bzw. MariaDB `untplanweb`)

| Tabelle(n) | Personenbezug | Löschkategorie |
|---|---|---|
| `benutzer`, `benutzer_rechte`, `benutzer_schueler` | Konto, Rolle, E-Mail, Passwort-Hash, iCal-Token, Zuordnung zu Kindern, Kenntnisnahme Datenschutzhinweise | Anonymisieren/Löschen von Hand |
| `benutzer_anmeldungen` | Zeit, Ergebnis, IP-Adresse, Gerät (höchstens 50 je Konto) | *Anmeldeprotokoll* (30 Tage) |
| `geraete_konten` | Hash des Gerätecookies ↔ Konto | *Gemerkte Konten* (30 Tage) |
| `push_geraete` | APNs-Token je Konto | *Geräte für Sofort-Benachrichtigungen* |
| `protokoll` | Benutzername, Aktion, Details | *Verwaltungsprotokoll* (365 Tage) |
| `loeschprotokoll`, `datenschutz_sperren` | Nummern, Anzahlen, Sperrfrist | dauerhaft (Nachweis), Sperren bis Fristende |
| `paket`, `paket_verlauf` | Austauschpaket aus Studio (Lehrkräfte, Schülerliste, Pläne) | mit dem nächsten Paket ersetzt |
| `schueler_daten`, `klassenwechsel`, `personen` | Schülerangaben aus der Web-Verwaltung, Personenliste | Löschen je Person |
| `klassenbuch`, `hausaufgaben_eintraege` | Lehrstoff, Notizen, Lehrkraft | *Klassenbuch* |
| `fehlzeiten`, `fehlzeit_entschuldigungen`, `vermerke`, `befreiungen`, `klassendienst_zuordnungen` | Anwesenheit, Gründe, Vermerke, Befreiungen | *Klassenbuch* |
| `sitzplan_bereiche`, `schuelergruppen`, `schuelergruppe_mitglieder` | Sitzplatz, Gruppen | Löschen je Person |
| `abwesenheitsmeldungen` | Meldungen der Eltern | *Abwesenheitsmeldungen* |
| `mitteilungen`, `mitteilung_empfaenger`, `mitteilung_anhaenge`, `mitteilung_listen`, `infocenter_gelesen` | Kommunikation | *Mitteilungen* |
| `sprechtage`, `sprechtag_lehrer`, `sprechtag_einladungen`, `sprechtag_termine`, `sprechtag_warteliste` | Termine Eltern/Lehrkraft | *Elternsprechtag* |
| `buchungen`, `buchung_ressourcen`, `eigene_unterrichte`, `rueckmeldungen` | Buchende Lehrkraft, Meldungen an Studio (Abwesenheit einer Lehrkraft mit Grund) | *Buchungen*; Rückmeldungen nach Übernahme in Studio |
| `einstellungen` | Schulname, Hash des API-Schlüssels, APNs-Schlüssel, Fristen, Angaben der Datenschutzhinweise | – |

Weitere Dateien im Volume `/data`: `schluessel/` (Schlüssel der Anmeldecookies), `sicherungen/` (SQLite-Kopien),
`update/` (Update-Anforderung, ohne Personendaten).

**Im Browser:** Cookie `untplanweb` (Sitzung), Gerätecookie für „Konto wechseln“ (365 Tage, nur Zufallswert); im
`localStorage` nur Einstellungen der Oberfläche (`untplan:leiste`, `untplan:schuljahr`, Filter, gewähltes Kind
`untplan:kind`, Druckvorgaben …) – keine Inhalte. Keine Cookies oder Speicher von Dritten.

### EduOrga Studio – Datenbank (SQLite `/data/studio.db` bzw. MariaDB `eduorga_studio`)

| Tabelle | Inhalt |
|---|---|
| `dokumente` | Schuldateien (Inhalt einer `.up`-Datei: Stammdaten von Lehrkräften und Schüler*innen, Unterricht, Pläne, Abwesenheiten, Vertretungen) |
| `dokument_sicherungen` | ältere Fassungen (die letzten 10 automatischen und 20 Sicherungspunkte je Dokument); beim Löschen des Dokuments mitgelöscht |
| `ablage` | Benutzer (Name, Anzeigename, Rolle, Passwort-Hash), Benutzereinstellungen, Gruppen, Einstellungen für den Austausch mit Web |
| `meta` | Schemastand |

Volume `/data`: `sicherungen/studio-*.db` (täglich, die letzten `STUDIO_SICHERUNGEN_BEHALTEN` = 14), `schluessel/`.
Browser: Cookie `UntPlanStudio` (12 Stunden), Einstellungen der Oberfläche im `localStorage`.

### EduOrga Mobile – Datenordner `/data`

| Datei | Inhalt |
|---|---|
| `konten.json` | Profile je Gerät (Zufallskennung): Login, Name, Sitzung von EduOrga Web (verschlüsselt mit ASP.NET Data Protection), Push-Abonnements, letzter Planstand je Konto für den Vergleich |
| `vapid.json` | Schlüsselpaar für Web Push (kein Personenbezug) |
| `schluessel/` | Schlüssel für Data Protection |

Auf dem Gerät: Cookie der App, `localStorage` (`tt.*`: Einstellungen, gemerkte Wochen des Plans), Cache des Service
Workers (App-Hülle, Startseite mit Plan, API-Antworten, Planwache) – beim Abmelden bzw. Kontowechsel gelöscht.

### iOS-App EduOrga

Schlüsselbund: Sitzungen/Passwörter je Konto (`AfterFirstUnlockThisDeviceOnly`). UserDefaults: Serveradresse, Login,
Kontenliste, Einstellungen, letzter Planstand (Planmitteilungen), Schreibpuffer für Klassenbuch-Einträge ohne Netz –
beim Abmelden des Kontos gelöscht. Keine Analyse-, Werbe- oder Absturzberichtsdienste; Kommunikation nur mit dem Server
der Schule und (für Sofort-Benachrichtigungen) Apple. Kamera nur für QR-Code und Fotos als Anhang.

### Website (`website/`)

Statische Seiten ohne Cookies, Formulare und Fremdinhalte; eigene Seiten Impressum und Datenschutz mit Platzhaltern
(`WEBSITE_BETREIBER_*`), siehe `website/README.md`.
