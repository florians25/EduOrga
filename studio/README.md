# EduOrga Studio

*Einfach mehr Schulalltag.*

**Stunden-, Kurs- und Vertretungsplanung für Schulen – als Web-Anwendung.** EduOrga Studio (bisher UntPlan Studio) ist das
Planungswerkzeug von EduOrga: Stammdaten, Unterricht, Zeitwünsche, automatische und manuelle Stundenplanung, Vertretungsplanung,
Pausenaufsichten, Auswertungen, Druck und Datenaustausch – im Browser, mit mehreren Benutzern gleichzeitig. Alle
Berechnungen laufen auf dem Server mit der Fachlogik aus `src/UntPlan.Core`.

![Übersicht](docs/bilder/uebersicht.png)

| Manuell planen | Tagesplanung | Suche |
|---|---|---|
| ![Planen](docs/bilder/planen.png) | ![Vertretung](docs/bilder/vertretung.png) | ![Suche](docs/bilder/suche.png) |

| Anmeldung | Gruppen und Rechte | Dunkles Thema |
|---|---|---|
| ![Anmeldung](docs/bilder/anmeldung.png) | ![Gruppen und Rechte](docs/bilder/rechte.png) | ![Dunkel](docs/bilder/dunkel.png) |

## Oberfläche

Die Oberfläche ist eine React-Anwendung (TypeScript, Fluent UI v9) in `studio/client`; sie wird mit Vite nach
`src/UntPlanStudio/wwwroot` gebaut – automatisch beim Bauen des Projekts (siehe „Lokal starten“).

* **Seiten statt Fenster:** Jede Aufgabe ist eine Seite mit eigener Adresse (Lesezeichen, Zurück-Taste des Browsers).
  Aufgaben, die mehrere Inhalte gleichzeitig brauchen, sind feste **Arbeitsplätze** – *Manuell planen* (Unterricht und
  Klassenplan), *Tagesplanung* der Vertretung (Tageskopf, Vertretungen, Vorschlag, Tagespläne von Klasse und Lehrkraft; Kalender und
  Abwesenheiten auf eigenen Seiten),
  *Verlegen und Tauschen*. Inhalte, die aus einer Seite heraus geöffnet werden (z. B. der Unterricht zu einem Plan),
  erscheinen rechts daneben; „Öffnen“ macht daraus eine eigene Seite.
* **Navigation** links (in schmalen Fenstern über den Menüknopf): *Stammdaten, Unterricht, Planung, Stundenpläne, Oberstufe, Auswertung, Ausgabe,
  Datenaustausch, Schule* – im Vertretungsmodus *Vertretungsplanung, Ereignisse, Tagespläne, Auswertung und Ausgabe*.
  Strg+B blendet sie aus.
* **Kopfleiste:** Schuldatei (zuletzt verwendet, alle Dateien, neu, hochladen), Modus *Stundenplanung /
  Vertretungsplanung*, in der Stundenplanung die **aktive Periode** mit Zeitraum (‹ › vorherige/nächste, Liste mit Suche,
  „Neue Periode ab …“ als Kopie in einem Dialog), im Vertretungsmodus das Planungsdatum und „An Web senden“ (Symbol mit
  Statuspunkt, Stand in der Kurzinfo), Rückgängig/Wiederholen mit Speicherstand („Gespeichert · 14:32“, unter 1500 px nur
  das Symbol), aktive Benutzer, Suche (Strg+K – findet jede Funktion) und Konto. Bis 1366 px Breite passt alles ohne
  Abschneiden.
* **Speichern gibt es nicht mehr als Schritt:** Jede Änderung (auch Rückgängig/Wiederholen) landet nach weniger als einer
  Sekunde in der Datenbank. Die Kopfleiste zeigt ruhig den Stand: *Gespeichert · 14:32*, kurz *Speichert …* oder bei einem
  Problem *Nicht gespeichert* mit *Erneut versuchen* (der Server versucht es ohnehin selbst wieder). **Strg+S** legt einen
  *Sicherungspunkt* an – eine ältere Fassung, die nicht automatisch verdrängt wird.
* **Vertretungen direkt an EduOrga Web:** „An Web senden“ in der Kopfleiste der Vertretungsplanung (oder Befehlssuche
  „Vertretungen jetzt an EduOrga Web senden“) überträgt die geänderten Vertretungen mit einem Klick; daneben steht der Stand der
  letzten Übertragung. In *EduOrga Web → Einstellungen* lässt sich „Vertretungen automatisch übertragen“ einschalten: dann geht jede
  Änderung der Vertretungsplanung spätestens nach der eingestellten Zeit (Standard 30 s, Änderungen dazwischen in einem Paket) ohne
  Klick hinaus. Fehlgeschlagene automatische Übertragungen werden mit wachsendem Abstand wiederholt.
* **Übersicht:** Kennzahlen der Schuldatei, Planqualität und häufige Aufgaben.
* **Darstellung:** Marke EduOrga (`design/MARKE.md`): Primärfarbe Petrol #164C55 (Logo, Seitenleiste, Knöpfe), Akzent #28747A
  (aktive Bereiche, Links, Fokus), Seitenhintergrund #F5F7F8, Text #24363B; Fluent-Thema aus der Petrol-Reihe (`client/src/theme.ts`).
  Kräftige Linien (#c9d1db), graue Seiten- und Tabellenköpfe, weiße Karten auf grauem Grund, sichtbarer Fokusring. Hell, dunkel
  (eigene Schiefer-Petrol-Palette, kein weißes Aufblitzen beim Laden) oder wie das System (Kontomenü); Schrift IBM Plex Sans.
* **Modusfarbe:** Stundenplanung Petrol, Vertretungsplanung Indigo #3b4a8f – als Unterstrich des gewählten Modus in der
  Kopfleiste, schmale Linie über dem Seitenkopf und Kante des gewählten Navigationspunkts.
* **Gruppen und Rechte** (MultiUser, Administratoren): Matrix *Gruppe × Bereich* mit farbigen Stufen (Bearbeiten, Ansichten,
  Nur lesen, Kein Zugriff), Klick ändert die Stufe sofort; Einzelrechte und „Alle Bereiche: …“ je Gruppe; Benutzerliste mit
  Suche, durchsuchbarer Gruppenwahl, „Nur lesen“, Abteilung und lesbaren wirksamen Rechten.
* **Datumsfelder** überall mit Kalender (Fluent DatePicker, deutsch, Woche ab Montag mit Kalenderwochen); Eingabe auch als
  „19.10.2026“, „19.10.“ oder „191026“. Auswahllisten sind durchsuchbar (Tippen filtert).
* **Farben** der Stammdaten: Spalte *Farbe* mit Farbfeld (Klick öffnet eine ruhige Palette mit 24 Farben und eigenem
  Hex-Wert), markierte Zeilen → *Farben → Farbe zuweisen …*, **Zufallsfarben** für alle ohne Farbe bzw. alle (gut
  unterscheidbar, eine Rückgängig-Stufe, „Rückgängig“ im Hinweis). Stunden ohne Fachfarbe sind in allen Plänen neutrale
  hellgraue Karten mit Linie.
* **Blockansicht** der Stundenpläne: Umschalter *Einzelplan / Blockansicht* – mehrere Pläne (z. B. ein Jahrgang, alle
  Lehrkräfte einer Abteilung) als dichte Kacheln neben- und untereinander, Schnellauswahl nach Gruppe, Drucken im
  Querformat.
* **Kalender und Ferien:** Jahreskalender mit Aufziehen der Tage per Maus → *Als frei markieren …* (Ferien, Feiertag,
  beweglicher Ferientag, unterrichtsfrei) bzw. *Wieder Schultage*; Liste daneben, Ferien und Feiertage NRW per Knopf.

## Lokal starten

Voraussetzung: .NET 8 SDK und Node.js 22 (für die Oberfläche).

```bash
cd studio/src/UntPlanStudio
STUDIO_ADMIN_PASSWORT=geheim123 ASPNETCORE_URLS=http://127.0.0.1:5501 dotnet run
```

`dotnet build`/`run`/`publish`/`test` bauen die Oberfläche mit (`npm ci` beim ersten Mal, danach `npm run build`, nur wenn
sich `studio/client` geändert hat; abschalten mit `-p:StudioOberflaecheBauen=false`). Beim Entwickeln der Oberfläche mit
sofortiger Aktualisierung:

```bash
cd studio/client
npm ci
npm run dev          # Vite auf http://127.0.0.1:5173, leitet /api an STUDIO_URL (Standard http://127.0.0.1:5501) weiter
npm run typecheck    # tsc --noEmit (strikt)
npm run build        # Typprüfung + Build nach ../src/UntPlanStudio/wwwroot
```

Dann <http://127.0.0.1:5501> öffnen und mit `admin` / `geheim123` anmelden. Die Daten liegen in der Datenbank
`daten/studio.db` neben dem Projekt (oder unter `STUDIO_DATEN`, siehe „Daten und Sicherung“). Ohne `STUDIO_ADMIN_PASSWORT` wird beim ersten Start ein zufälliges Passwort
erzeugt und im Protokoll ausgegeben.

Tests:

```bash
dotnet test studio/tests/UntPlanStudio.Tests -c Release      # API-Tests, Modulregister, Startseite, Typprüfung (Node)
# zusätzlich mit MySQL/MariaDB (Benutzer mit Recht zum Anlegen von Datenbanken; ohne die Variable werden diese Tests übersprungen):
STUDIO_TEST_MYSQL="Server=127.0.0.1;Port=3306;User ID=root;Password=…" dotnet test studio/tests/UntPlanStudio.Tests -c Release
# Oberflächentests (Server muss laufen, Playwright + Chromium nötig; STUDIO_URL Standard http://127.0.0.1:5501):
NODE_PATH=$(npm root -g) STUDIO_PASSWORT=geheim123 node studio/tests/smoke/smoke.cjs            # Rundgang über alle Seiten
NODE_PATH=$(npm root -g) STUDIO_PASSWORT=geheim123 node studio/tests/smoke/planung.cjs          # Planen, Ziehen, Optimierung
NODE_PATH=$(npm root -g) STUDIO_PASSWORT=geheim123 node studio/tests/smoke/vertretung.cjs       # Vertretungsplanung
NODE_PATH=$(npm root -g) STUDIO_PASSWORT=geheim123 node studio/tests/smoke/druck.cjs            # Einstellungen, Druck, Formate
NODE_PATH=$(npm root -g) STUDIO_PASSWORT=geheim123 node studio/tests/smoke/smoke-austausch.cjs  # UntPlan Web, Module, MultiUser
NODE_PATH=$(npm root -g) STUDIO_PASSWORT=geheim123 node studio/tests/smoke/speichern.cjs         # Speicherstand, Sicherungspunkt, „An Web senden“
```

## Container

Das Image wird vom GitHub-Workflow `.github/workflows/studio.yml` als `ghcr.io/florians25/untplannext-studio` gebaut
(amd64 und arm64). Selbst bauen (Build-Kontext = Repository-Wurzel):

```bash
docker build -f studio/Dockerfile -t untplanstudio .
```

| Datei | Zweck |
|---|---|
| `docker-compose.yml` | HTTP auf Port 8090 (z. B. hinter einem vorhandenen Reverse-Proxy) |
| `docker-compose.https.yml` + `Caddyfile` | eigene Domain mit HTTPS (Let's Encrypt über Caddy) |
| `docker-compose.gemeinsam.yml` + `Caddyfile.gemeinsam` | UntPlan Web **und** Studio auf einem Server, je eigene Domain, ein Caddy |

```bash
cd studio
# einfach
STUDIO_ADMIN_PASSWORT=bitte-aendern docker compose up -d
# eigene Domain
STUDIO_DOMAIN=studio.meine-schule.de STUDIO_ADMIN_PASSWORT=bitte-aendern docker compose -f docker-compose.https.yml up -d
# zusammen mit UntPlan Web (statt web/docker-compose.https.yml)
UNTPLANWEB_DOMAIN=plan.meine-schule.de STUDIO_DOMAIN=studio.meine-schule.de STUDIO_ADMIN_PASSWORT=bitte-aendern \
  docker compose -f docker-compose.gemeinsam.yml up -d
```

Der Container läuft ohne Root-Rechte (Benutzer `app`), alle Daten liegen im Volume `/data`
(Datenbank `studio.db`, Sicherungen, Schlüssel für das Anmeldecookie) – siehe „Daten und Sicherung“.

## Daten und Sicherung

Das Studio hat eine **eigene Datenbank**, unabhängig von EduOrga Web: SQLite (Standard, keine Einrichtung nötig) oder
MySQL/MariaDB (`STUDIO_DB=mysql`, siehe unten). Im Datenordner (`STUDIO_DATEN`, im Container `/data`) liegen:

| Pfad | Inhalt |
|---|---|
| `studio.db` (+ `studio.db-wal`, `studio.db-shm`) | Schuldateien (Inhalt wie `.up`-Datei, gzip-komprimiert), ältere Fassungen (automatisch höchstens alle 10 Minuten, die letzten 10, dazu die letzten 20 Sicherungspunkte), Benutzer, Benutzereinstellungen, MultiUser-Gruppen, EduOrga-Web-Abgleich und direkte Übertragung |
| `sicherungen/studio-<zeit>.db` | Sicherungen der Datenbank (vollständige SQLite-Datei) |
| `schluessel/` | Schlüssel für das Anmeldecookie |
| `alt-dateien-<datum>/` | nur nach einem Update von einer älteren Version: die übernommenen Dateien (siehe unten) |

Schuldateien lassen sich weiterhin jederzeit als `.up` herunterladen (Datei → Herunterladen) und wieder hochladen.

**Sofort gespeichert.** Jede Änderung wird nach `STUDIO_SPEICHERN_VERZOEGERUNG_MS` (800 ms) in einer Transaktion geschrieben;
Änderungen in dieser Zeit werden zusammengefasst, beim Beenden wird alles geschrieben. Gemessen mit einer großen Schule
(200 Lehrkräfte, 3000 Schülerinnen und Schüler, 4000 Unterrichte, 3000 Vertretungen; 11 MB JSON, komprimiert 0,4 MB):
Datenbankteil typisch 30–60 ms (SQLite) bzw. 60–100 ms (MariaDB), insgesamt mit Erzeugen des Inhalts etwa 130–220 ms – ohne
dass andere Benutzer warten (geschrieben wird außerhalb der Dokumentsperre). Ältere Fassungen: `GET /api/dokumente/{id}/fassungen`.

**MySQL/MariaDB.** `STUDIO_DB=mysql` (oder `mariadb`) und `STUDIO_DB_CONNECTION` (`Server=…;Port=3306;Database=eduorga_studio;User
ID=…;Password=…` oder `mysql://benutzer:passwort@host:3306/eduorga_studio`). Gleiches Schema wie SQLite (Migrationen beim Start);
fehlt die Datenbank, legt das Studio sie an, sofern der Benutzer das darf (sonst als root: `CREATE DATABASE eduorga_studio CHARACTER
SET utf8mb4; GRANT ALL ON eduorga_studio.* TO '<benutzer>'@'%';`). Liegt beim ersten Start mit leerer MySQL-Datenbank eine
`studio.db` im Datenordner, wird sie vollständig übernommen (die Datei bleibt liegen). Der Server braucht `max_allowed_packet`
≥ 64 MB (Gesamtinstallation: 256 MB). Gesichert wird mit `mariadb-dump`/`mysqldump --single-transaction` (die Gesamtinstallation
erledigt das in `./update.sh`); `--sichern`, die tägliche Sicherung und `POST /api/sicherungen` gelten nur für SQLite
(`--sichern` gibt bei MySQL nur einen Hinweis aus und endet mit 0).

**Sicherung.** Das Studio sichert die Datenbank automatisch einmal täglich und beim Start nach jedem Update (vor
Datenbank-Migrationen) als konsistente Kopie (`VACUUM INTO`) nach `sicherungen/studio-<zeit>.db`; die letzten 14 bleiben
(`STUDIO_SICHERUNGEN_BEHALTEN`). Administratoren können über `POST /api/sicherungen` sofort sichern (`GET /api/sicherungen`
listet die vorhandenen). Eine Sicherung über die Kommandozeile – z. B. in einem Update-Skript vor `docker compose pull` –
schreibt nur die Sicherung und beendet sich (auch während der Server läuft):

```bash
# Container (im Ordner mit der docker-compose.yml; Dienstname untplanstudio)
docker compose exec -T untplanstudio dotnet UntPlanStudio.dll --sichern
# ohne Container
STUDIO_DATEN=/pfad/zum/datenordner dotnet UntPlanStudio.dll --sichern
```

**Passwort vergessen / neu setzen:** Das Admin-Passwort aus `STUDIO_ADMIN_PASSWORT` gilt nur beim ersten Start (solange es keine
Benutzer gibt). Danach setzt die Kommandozeile das Passwort eines Benutzers – ohne den Webserver zu starten und auch während er läuft
(der Server liest die Benutzer bei jeder Anmeldung neu):

```bash
# Passwort als eine Zeile über die Standardeingabe; am Terminal (ohne -T bzw. ohne Container) zweimal verdeckt abgefragt
printf '%s\n' "$NEUES_PASSWORT" | docker compose exec -T untplanstudio dotnet UntPlanStudio.dll --passwort-setzen admin
STUDIO_DATEN=/pfad/zum/datenordner dotnet UntPlanStudio.dll --passwort-setzen admin
# fehlenden Benutzer als Administrator anlegen
STUDIO_DATEN=/pfad/zum/datenordner dotnet UntPlanStudio.dll --passwort-setzen chefin --anlegen
```

Mindestens 6 Zeichen (wie in der Oberfläche); Ergebnis 0 = gesetzt, 1 = Fehler (Meldung auf stderr, bei unbekanntem Benutzer mit
der Liste der Administratoren). In der Gesamtinstallation erledigt das `./passwort.sh studio [benutzer]` (siehe
`installation/README.md`).

Update mit Sicherung: `docker compose exec -T untplanstudio dotnet UntPlanStudio.dll --sichern && docker compose pull && docker compose up -d`.
Die Sicherungen liegen im Volume; außerhalb sichern z. B. mit
`docker compose cp untplanstudio:/data/sicherungen ./studio-sicherungen`.

**Wiederherstellen:** Server bzw. Container stoppen, `studio.db-wal` und `studio.db-shm` im Datenordner löschen (sonst
würden sie auf die zurückgespielte Datenbank angewendet), die gewünschte Sicherung als `studio.db` kopieren, starten:

```bash
docker compose exec untplanstudio ls /data/sicherungen
docker compose stop untplanstudio
docker compose run --rm --entrypoint sh untplanstudio -c 'rm -f /data/studio.db-wal /data/studio.db-shm && cp /data/sicherungen/<datei> /data/studio.db'
docker compose start untplanstudio
```

**Übernahme älterer Installationen.** Bis zu dieser Version lagen die Daten als einzelne Dateien im Datenordner
(`benutzer.json`, `benutzer/*.json`, `multiuser.json`, `untplanweb/*.json`, `dokumente/*.up` + `*.json` + `*.bak`). Beim
ersten Start mit der neuen Version (leere Datenbank) werden diese automatisch in die Datenbank übernommen und danach nach
`alt-dateien-<datum>/` verschoben (nicht gelöscht; das Protokoll nennt die Anzahl der übernommenen Dokumente und Benutzer).
Anmeldungen bleiben gültig. Den Ordner `alt-dateien-…` kann man löschen, sobald alles geprüft ist.

**Hinweis auf neue Versionen.** Das Studio prüft für Administratoren die GitHub-Releases von florians25/UntPlanNext
(`https://api.github.com/repos/florians25/UntPlanNext/releases/latest`; Entwürfe und Vorabversionen zählen nicht, aus dem Tag
zählt die Versionsnummer, z. B. `v1.5.0` oder `studio-v1.5.0`) und vergleicht sie mit der laufenden Version. Das Ergebnis wird
6 Stunden zwischengespeichert; ohne Internet, hinter einem blockierenden Proxy (`HTTPS_PROXY` wird beachtet) oder bei
Fehlern erscheint einfach kein Hinweis. Ist eine neuere Version veröffentlicht, zeigt das Studio unter der Kopfleiste
„Neue Version 1.5.0 verfügbar – Versionshinweise ansehen“ (je Version schließbar; danach bleibt ein Punkt am Konto-Symbol und
ein Eintrag im Kontomenü). Der Dialog zeigt die Versionshinweise und den Update-Befehl `./update.sh studio` (siehe
[installation/README.md](../installation/README.md)); *Konto → Über EduOrga Studio* zeigt den Stand mit „Erneut prüfen“.
Schnittstelle: `GET /api/version[?neu=1]` (nur Administratoren) →
`{version, neueste, updateVerfuegbar, releaseUrl, releaseName, veroeffentlicht, hinweise, geprueft, fehler, befehl}`.
Die Prüflogik teilt sich das Studio mit UntPlan Web und Mobile (`web/src/UntPlanWeb/Dienste/Updatepruefung.cs`).

## Umgebungsvariablen

| Variable | Standard | Bedeutung |
|---|---|---|
| `STUDIO_DATEN` | `./daten` (Container: `/data`) | Datenordner (Datenbank `studio.db`, Sicherungen, Cookie-Schlüssel) |
| `STUDIO_ADMIN_BENUTZER` | `admin` | Name des Admin-Kontos beim ersten Start |
| `STUDIO_ADMIN_PASSWORT` | – (zufällig, im Protokoll) | Passwort des Admin-Kontos beim ersten Start |
| `STUDIO_SPEICHERN_VERZOEGERUNG_MS` | `800` | jede Änderung wird nach dieser Zeit gespeichert (Änderungen dazwischen: ein Schreibvorgang) |
| `STUDIO_FASSUNG_MINUTEN` | `10` | höchstens so oft entsteht beim Speichern eine ältere Fassung (zusätzlich Sicherungspunkte mit Strg+S) |
| `STUDIO_DB_KOMPRIMIEREN` | `1` | Inhalte der Schuldateien gzip-komprimiert speichern (`0` = JSON wie `.up`) |
| `STUDIO_DB` | `sqlite` | `sqlite` oder `mysql`/`mariadb` |
| `STUDIO_DB_CONNECTION` | – | nur MySQL/MariaDB: Verbindung (siehe „Daten und Sicherung“) |
| `STUDIO_DB_WARTEN_SEKUNDEN` | `60` | nur MySQL/MariaDB: so lange beim Start auf den Datenbankserver warten |
| `STUDIO_AUTOSPEICHERN_SEKUNDEN` | `30` | Sicherheitsnetz: so oft wird zusätzlich alles noch Ungespeicherte geschrieben |
| `STUDIO_LEERLAUF_MINUTEN` | `120` | unbenutzte Dokumente werden danach gespeichert und entladen |
| `STUDIO_MAX_UPLOAD_MB` | `64` | Höchstgröße beim Hochladen |
| `STUDIO_SICHERE_COOKIES` | automatisch | `1` = Anmeldecookie nur über HTTPS (hinter Caddy empfohlen) |
| `STUDIO_SICHERUNGEN_BEHALTEN` | `14` | so viele Datenbanksicherungen (`sicherungen/studio-*.db`) bleiben erhalten |
| `STUDIO_DOMAIN` | – | nur Compose/Caddy: Domain des Studios |
| `STUDIO_UPDATE_PRUEFEN` | an | `0` = nicht nach neuen Versionen suchen (kein Updatehinweis) |
| `STUDIO_UPDATE_URL` | GitHub-Releases von florians25/UntPlanNext (`…/releases/latest`) | Quelle der neuesten Version: GitHub-API `…/releases/latest`, `…/releases`, `…/tags`, `ghcr://besitzer/image` oder eigene Adresse mit `{"version":"…"}` bzw. Text |
| `STUDIO_UPDATE_TAG_PRAEFIX` | – | nur Tags mit diesem Präfix berücksichtigen (z. B. `studio-v`, sinnvoll mit `…/releases`) |
| `ASPNETCORE_HTTP_PORTS` / `ASPNETCORE_URLS` | `8080` im Container | Port bzw. Adresse |

## Bedienung (Kurzüberblick)

* **Tabellen**: Enter/F2 oder Tippen bearbeitet, Tab/Pfeile wechseln die Zelle, Entf leert, Leertaste setzt Haken,
  Strg+C/Strg+V kopiert/fügt ein (auch aus Tabellenkalkulationen), Umschalt/Strg+Klick markiert mehrere Zeilen,
  Rechtsklick auf die Kopfzeile blendet Spalten ein/aus, Kopfzeile ziehen verschiebt Spalten.
* **Stundenplan**: Stunden per Drag & Drop verschieben oder tauschen; nicht verplante Stunden in den Plan ziehen.
  Beim Ziehen zeigt jedes Feld seinen Status (frei, Tausch möglich, Vorgabe verletzt, belegt), der Grund steht am
  Mauszeiger. Rechtsklick: fixieren, entplanen, Raum zuordnen, Tauschvorschläge.
* **Tastatur**: Strg+K Befehlssuche, Strg+S Sicherungspunkt anlegen (gespeichert wird ohnehin sofort), Strg+Z/Strg+Y Rückgängig/Wiederholen, Strg+Umschalt+V Modus
  wechseln, Strg+B Seitenleiste, Strg+Bild↑/↓ Planungsdatum (Vertretungsmodus).

Für Entwickler: Aufbau, API-Konventionen und „Neues Modul anlegen“ stehen in [`ARCHITEKTUR.md`](ARCHITEKTUR.md).

---

EduOrga ist ein privates Hobbyprojekt eines Auszubildenden zum Fachinformatiker für Systemintegration, entwickelt mit
Unterstützung von Claude (Anthropic). Jede Schule bzw. jeder Betreiber ist für Einsatz, Betrieb und Datenschutz selbst
verantwortlich.
