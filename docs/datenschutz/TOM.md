# Technische und organisatorische Maßnahmen (Art. 32 DSGVO) – Vorlage

> Vorlage für das Sicherheitskonzept der Schule bzw. des Betreibers. Abschnitt **A** beschreibt, was EduOrga als Software
> umsetzt (Stand dieses Repositorys); Abschnitt **B** listet, was der Betrieb festlegen und umsetzen muss. Felder
> `[…]` sind auszufüllen. Kein Rechtsrat – mit der bzw. dem Datenschutzbeauftragten abstimmen.

| | |
|---|---|
| Verantwortlicher | [Schule, Anschrift] |
| Betreiber / Auftragsverarbeiter | [Schulträger bzw. IT-Dienstleister, AV-Vertrag vom …] |
| Serverstandort | [Raum/Rechenzentrum, Land – EU] |
| Programme | EduOrga Studio, EduOrga Web, EduOrga Mobile, iOS-App EduOrga, ggf. Website |
| Stand / geprüft von | [Datum, Name] |

## A. Maßnahmen in der Software

### 1. Vertraulichkeit

**Zutrittskontrolle** – Sache des Betriebs (B.1).

**Zugangskontrolle (Anmeldung)**

| Maßnahme | EduOrga Web | EduOrga Studio | Mobile / iOS |
|---|---|---|---|
| Passwörter | PBKDF2 (ASP.NET Core Identity), nie im Klartext; Mindestlänge 8, einstellbar Großbuchstaben/Ziffern/Sonderzeichen (*Rechte und Rollen*) | PBKDF2, mindestens 8 Zeichen | Anmeldung über EduOrga Web |
| Startpasswörter | zufällig (10 Zeichen), Änderung bei der ersten Anmeldung erzwungen | Admin-Passwort aus `.env` bzw. zufällig (16 Hex-Zeichen, einmalig im Containerprotokoll – nach dem Start ändern) | – |
| Schutz gegen Ausprobieren | 5 Fehlversuche → 5 min Sperre je Konto, gleich lange Prüfung bei unbekanntem Konto | 5 Fehlversuche → 1 min Sperre | wie Web |
| Sitzung | Cookie `untplanweb`: `HttpOnly`, `SameSite=Strict`, `Secure` über HTTPS (`UNTPLANWEB_SICHERE_COOKIES=1` erzwingt es), 14 Tage gleitend (`UNTPLANWEB_SITZUNG_TAGE`, 1–90); gesperrte/gelöschte Konten verlieren die Sitzung sofort | Cookie `UntPlanStudio`, `HttpOnly`, `SameSite=Strict`, 12 Stunden, `STUDIO_SICHERE_COOKIES=1` | Mobile: eigenes Cookie (HttpOnly, SameSite=Lax, Secure hinter HTTPS), Sitzungen der Profile mit ASP.NET Data Protection verschlüsselt; iOS: Zugangsdaten im Schlüsselbund (`AfterFirstUnlockThisDeviceOnly`) |
| CSRF | ändernde Aufrufe nur mit eigenem Kopf `X-UntPlanWeb: 1` | SameSite=Strict | – |
| API zu Studio | Bearer-Schlüssel, gespeichert nur als SHA-256-Hash | – | – |
| Wartungsmodus | Anmeldung nur für die Administration | – | – |

**Zugriffskontrolle (Berechtigungen)** – Rollen Administration, Schulleitung, Lehrkraft, Schüler*in/Klasse,
Erziehungsberechtigte; Rechte-Profile und Einzelrechte (*Rechte und Rollen*), serverseitig bei jedem Aufruf geprüft:

- Eltern sehen nur zugeordnete Kinder, Schüler*innen nur sich selbst; keine Lehrerpläne, keine Klassenbuch- oder
  Abwesenheitslisten anderer, keine Schülerverwaltung (Tests: `FamilieTests`, `DatenschutzTests`).
- Lehrkräfte: Klassenbuch des eigenen Unterrichts; Fehlzeitenverwaltung nur Klassenleitung, Schulleitung,
  Administration bzw. mit Recht; ohne Klassenleitung von Schüler*innen nur Name, Klasse, Geschlecht.
- Vertretungsplan Schülerversion ohne Abwesenheitsgründe, Bereitschaften, Aufsichten; Monitore über geheimen Link,
  optional nur öffentliche Nachrichten; Planfenster je Rolle (Wochen zurück/voraus).
- Abwesenheitsgründe von Lehrkräften überträgt Studio nur, wenn eingeschaltet; als *vertraulich* markierte nie.
- Datenschutzfunktionen (Fristen, Auskunft, Löschung) nur für die Administration.
- Studio: Gruppen × Bereiche mit Stufen (Bearbeiten, Ansichten, Nur lesen, Kein Zugriff), Benutzerverwaltung nur Administration.

**Trennungskontrolle** – Studio und Web mit getrennten Datenbanken; Web erhält von Studio nur das Austauschpaket
(Teile wählbar); Mobile hält keine eigene Datenbank, sondern ruft Web mit der Sitzung der Person auf.

**Pseudonymisierung/Datensparsamkeit** – Löschprotokoll nur mit Anzahlen und Nummern; Gerätecookie für „Konto
wechseln“ nur als Hash gespeichert; IP-Adressen nur im Anmeldeprotokoll (Frist 30 Tage) und in der Sitzungsübersicht im
Arbeitsspeicher (höchstens 14 Tage, Neustart löscht); keine Personendaten in Adressen außer Nummern (z. B.
`?schueler=123`), Zugangsdaten nur im Anfragekörper.

### 2. Integrität

- **Transportverschlüsselung**: HTTPS über Caddy mit automatischem Zertifikat (Let's Encrypt) und
  `Strict-Transport-Security: max-age=31536000` (`installation/install.sh`, `web/Caddyfile`, `studio/Caddyfile`).
  Web Push Ende-zu-Ende verschlüsselt (RFC 8291, aes128gcm, VAPID).
- **Sicherheitsköpfe** (Web): Content-Security-Policy ohne Fremdquellen (`default-src 'self'`, `frame-ancestors 'none'`),
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `Cache-Control: no-store` für die API.
- **Eingabekontrolle**: Protokoll der Administration (Anmeldungen, Benutzer, Auskünfte, Löschungen, Einstellungen),
  „Geändert am … von …“ im Klassenbuch, Löschprotokoll; formatierte Texte serverseitig auf eine Whitelist bereinigt.
- **Keine Dritten**: keine externen Schriften, Skripte, CDNs, Karten, Videos, Tracker oder Analysewerkzeuge in Web,
  Studio, Mobile, iOS und Website; IBM Plex Sans und Symbole lokal; keine Telemetrie. Ausgehende Verbindungen nur:
  Versionsprüfung bei GitHub (abschaltbar), Push-Dienste, Zertifikat.

### 3. Verfügbarkeit und Belastbarkeit

- Sicherung vor jedem Update (`installation/update.sh`), Studio zusätzlich täglich; SQLite per `VACUUM INTO`
  (konsistent), MariaDB per `mariadb-dump --single-transaction`; es bleiben `SICHERUNGEN_BEHALTEN` (Standard 14).
- **Verschlüsselte Sicherungen**: mit `SICHERUNG_AGE_EMPFAENGER` (age) bzw. `SICHERUNG_GPG_EMPFAENGER` (GPG) in `.env`
  schreibt `update.sh` MariaDB-Abzüge nur verschlüsselt und legt von SQLite-Sicherungen eine verschlüsselte Kopie in
  `./sicherungen` ab. Der private Schlüssel gehört nicht auf den Server. Die SQLite-Sicherungen im Volume
  (`/data/sicherungen`) sind wie die Datenbank selbst unverschlüsselt – Schutz über die Festplattenverschlüsselung (B.2).
- Gesundheitsprüfungen der Container, automatischer Neustart, Migrationen beim Start.

### 4. Löschung und Speicherbegrenzung (Art. 5 Abs. 1 Buchst. e, Art. 17)

- *Verwaltung → Datenschutz → Aufbewahrung & Löschung*: Fristen je Kategorie, Probelauf, täglicher Löschlauf,
  Löschprotokoll (siehe [README](README.md#was-eduorga-dafür-bietet)).
- Sperre statt Löschung, solange eine Aufbewahrungsfrist läuft (Art. 18), automatische Löschung nach Fristende.
- SQLite mit `PRAGMA secure_delete=ON` (Web und Studio): gelöschte Inhalte werden in der Datei überschrieben.
- Studio: Löschen eines Dokuments entfernt alle älteren Fassungen und Sicherungspunkte; Datenbanksicherungen
  enthalten Gelöschtes noch bis zum Ablauf der Sicherungsfrist (14 Sicherungen).
- Mobile/PWA: Abmelden und Kontowechsel löschen den Gerätespeicher (localStorage bis auf das Erscheinungsbild) und die
  zwischengespeicherten Plan- und API-Daten im Cache des Service Workers. iOS: Abmelden löscht Zugangsdaten,
  Planstand und nicht gesendete Klassenbuch-Einträge des Kontos.

### 5. Push-Benachrichtigungen

- **iOS (APNs, über EduOrga Web)**: Standard „Änderung im Stundenplan – Bitte den Stundenplan in der App ansehen.“
  ohne Fach, Klasse, Stunde; Einzelheiten nur mit Schalter der Administration (*Datenschutz → Aufbewahrung & Löschung*).
  Inhalt läuft unverschlüsselt über Apple (TLS-Transport).
- **PWA (Web Push, EduOrga Mobile)**: Standard ebenso datensparsam, kein Name; Einzelheiten nur mit
  `UNTPLANMOBILE_PUSH_DETAILS=1`. Inhalt Ende-zu-Ende verschlüsselt.
- **Lokale Mitteilungen der iOS-App** (Planänderungen, Sprechtag-Erinnerungen): Standard ohne Namen, Fächer, Klassen und
  Räume; „Einzelheiten in Mitteilungen“ im Profil. Lokale Mitteilungen der PWA (Planwache auf dem Gerät) zeigen Fach,
  Klasse und Raum – die Anzeige auf dem Sperrbildschirm steuert das Betriebssystem.

## B. Maßnahmen des Betriebs (auszufüllen)

1. **Zutritt**: Serverraum/Rechenzentrum [Schließsystem, Zugangsliste]; keine Server in frei zugänglichen Räumen.
2. **Server**: Festplattenverschlüsselung [LUKS/…]; aktuelle Updates von Betriebssystem und Docker [Verfahren];
   Firewall – nur 80/443 nach außen, Programme an `127.0.0.1` (`BIND_ADRESSE`); SSH nur mit Schlüssel, [Personen].
3. **Administration**: wenige Administrationskonten, persönliche Konten statt Sammelkonten; starke Passwörter
   (Passwortregeln in *Rechte und Rollen* verschärfen), [Zwei-Faktor für SSH/VPN].
4. **Sicherungen**: verschlüsselt (A.3), [Ablageort außerhalb des Servers], [Aufbewahrung], Wiederherstellung
   [jährlich] getestet; Aufbewahrung der Sicherungen mit den Löschfristen abgestimmt.
5. **Protokolle des Servers**: Caddy schreibt ohne `log`-Anweisung keine Zugriffsprotokolle; Docker-Protokolle
   begrenzen (`json-file` mit `max-size`/`max-file`) [Frist].
6. **Updates von EduOrga**: [wer, wie oft] (`./update.sh`, Hinweis in der Administration).
7. **Endgeräte**: Abmelden an geteilten Geräten; private Endgeräte von Lehrkräften nur nach den Vorgaben der
   VO-DV I/II und Genehmigung der Schulleitung (**zu prüfen**); Bildschirmsperre.
8. **Organisation**: Verpflichtung auf Vertraulichkeit, Einweisung des Kollegiums, Verfahren für Betroffenenanfragen
   und Datenpannen (Meldung binnen 72 Stunden, Art. 33), jährliche Überprüfung dieser TOM.
