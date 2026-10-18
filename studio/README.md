# UntPlan Studio

**Stunden-, Kurs- und Vertretungsplanung für Schulen – als Web-Anwendung.** UntPlan Studio ist das Planungswerkzeug
von UntPlan: Stammdaten, Unterricht, Zeitwünsche, automatische und manuelle Stundenplanung, Vertretungsplanung,
Pausenaufsichten, Auswertungen, Druck und Datenaustausch – im Browser, mit mehreren Benutzern gleichzeitig. Alle
Berechnungen laufen auf dem Server mit der Fachlogik aus `src/UntPlan.Core`.

![Übersicht](docs/bilder/uebersicht.png)

| Manuell planen | Tagesplanung | Suche |
|---|---|---|
| ![Planen](docs/bilder/planen.png) | ![Vertretung](docs/bilder/vertretung.png) | ![Suche](docs/bilder/suche.png) |

## Oberfläche

Die Oberfläche ist eine React-Anwendung (TypeScript, Fluent UI v9) in `studio/client`; sie wird mit Vite nach
`src/UntPlanStudio/wwwroot` gebaut – automatisch beim Bauen des Projekts (siehe „Lokal starten“).

* **Seiten statt Fenster:** Jede Aufgabe ist eine Seite mit eigener Adresse (Lesezeichen, Zurück-Taste des Browsers).
  Aufgaben, die mehrere Inhalte gleichzeitig brauchen, sind feste **Arbeitsplätze** – *Manuell planen* (Unterricht und
  Klassenplan), *Tagesplanung* der Vertretung (Kalender, Abwesenheiten, Vertretungen, Vorschlag, Tagespläne),
  *Verlegen und Tauschen*. Inhalte, die aus einer Seite heraus geöffnet werden (z. B. der Unterricht zu einem Plan),
  erscheinen rechts daneben; „Öffnen“ macht daraus eine eigene Seite.
* **Navigation** links (in schmalen Fenstern über den Menüknopf): *Stammdaten, Unterricht, Planung, Stundenpläne, Oberstufe, Auswertung, Ausgabe,
  Datenaustausch, Schule* – im Vertretungsmodus *Vertretungsplanung, Ereignisse, Tagespläne, Auswertung und Ausgabe*.
  Strg+B blendet sie aus.
* **Kopfleiste:** Schuldatei (zuletzt verwendet, alle Dateien, neu, hochladen), Modus *Stundenplanung /
  Vertretungsplanung*, im Vertretungsmodus das Planungsdatum, Rückgängig/Wiederholen/Speichern mit Speicherstand,
  aktive Benutzer, Suche (Strg+K – findet jede Funktion) und Konto.
* **Übersicht:** Kennzahlen der Schuldatei, Planqualität und häufige Aufgaben.
* **Darstellung:** hell, dunkel oder wie das System (Kontomenü); Schrift IBM Plex Sans, Markenfarbe Marine.

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
# Oberflächentests (Server muss laufen, Playwright + Chromium nötig; STUDIO_URL Standard http://127.0.0.1:5501):
NODE_PATH=$(npm root -g) STUDIO_PASSWORT=geheim123 node studio/tests/smoke/smoke.cjs            # Rundgang über alle Seiten
NODE_PATH=$(npm root -g) STUDIO_PASSWORT=geheim123 node studio/tests/smoke/planung.cjs          # Planen, Ziehen, Optimierung
NODE_PATH=$(npm root -g) STUDIO_PASSWORT=geheim123 node studio/tests/smoke/vertretung.cjs       # Vertretungsplanung
NODE_PATH=$(npm root -g) STUDIO_PASSWORT=geheim123 node studio/tests/smoke/druck.cjs            # Einstellungen, Druck, Formate
NODE_PATH=$(npm root -g) STUDIO_PASSWORT=geheim123 node studio/tests/smoke/smoke-austausch.cjs  # UntPlan Web, Module, MultiUser
```

## Container

Das Image wird vom GitHub-Workflow `.github/workflows/studio.yml` als `ghcr.io/florians25/untplan-studio` gebaut
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

Das Studio hat eine **eigene Datenbank** (SQLite), unabhängig von UntPlan Web. Im Datenordner (`STUDIO_DATEN`,
im Container `/data`) liegen:

| Pfad | Inhalt |
|---|---|
| `studio.db` (+ `studio.db-wal`, `studio.db-shm`) | Schuldateien (Inhalt wie `.up`-Datei, je Dokument die letzten 10 Fassungen), Benutzer, Benutzereinstellungen, MultiUser-Gruppen, UntPlan-Web-Abgleich |
| `sicherungen/studio-<zeit>.db` | Sicherungen der Datenbank (vollständige SQLite-Datei) |
| `schluessel/` | Schlüssel für das Anmeldecookie |
| `alt-dateien-<datum>/` | nur nach einem Update von einer älteren Version: die übernommenen Dateien (siehe unten) |

Schuldateien lassen sich weiterhin jederzeit als `.up` herunterladen (Datei → Herunterladen) und wieder hochladen.

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

## Umgebungsvariablen

| Variable | Standard | Bedeutung |
|---|---|---|
| `STUDIO_DATEN` | `./daten` (Container: `/data`) | Datenordner (Datenbank `studio.db`, Sicherungen, Cookie-Schlüssel) |
| `STUDIO_ADMIN_BENUTZER` | `admin` | Name des Admin-Kontos beim ersten Start |
| `STUDIO_ADMIN_PASSWORT` | – (zufällig, im Protokoll) | Passwort des Admin-Kontos beim ersten Start |
| `STUDIO_AUTOSPEICHERN_SEKUNDEN` | `30` | Takt der Autospeicherung geänderter Dokumente |
| `STUDIO_LEERLAUF_MINUTEN` | `120` | unbenutzte Dokumente werden danach gespeichert und entladen |
| `STUDIO_MAX_UPLOAD_MB` | `64` | Höchstgröße beim Hochladen |
| `STUDIO_SICHERE_COOKIES` | automatisch | `1` = Anmeldecookie nur über HTTPS (hinter Caddy empfohlen) |
| `STUDIO_SICHERUNGEN_BEHALTEN` | `14` | so viele Datenbanksicherungen (`sicherungen/studio-*.db`) bleiben erhalten |
| `STUDIO_DOMAIN` | – | nur Compose/Caddy: Domain des Studios |
| `ASPNETCORE_HTTP_PORTS` / `ASPNETCORE_URLS` | `8080` im Container | Port bzw. Adresse |

## Bedienung (Kurzüberblick)

* **Tabellen**: Enter/F2 oder Tippen bearbeitet, Tab/Pfeile wechseln die Zelle, Entf leert, Leertaste setzt Haken,
  Strg+C/Strg+V kopiert/fügt ein (auch aus Tabellenkalkulationen), Umschalt/Strg+Klick markiert mehrere Zeilen,
  Rechtsklick auf die Kopfzeile blendet Spalten ein/aus, Kopfzeile ziehen verschiebt Spalten.
* **Stundenplan**: Stunden per Drag & Drop verschieben oder tauschen; nicht verplante Stunden in den Plan ziehen.
  Beim Ziehen zeigt jedes Feld seinen Status (frei, Tausch möglich, Vorgabe verletzt, belegt), der Grund steht am
  Mauszeiger. Rechtsklick: fixieren, entplanen, Raum zuordnen, Tauschvorschläge.
* **Tastatur**: Strg+K Befehlssuche, Strg+S Speichern, Strg+Z/Strg+Y Rückgängig/Wiederholen, Strg+Umschalt+V Modus
  wechseln, Strg+B Seitenleiste, Strg+Bild↑/↓ Planungsdatum (Vertretungsmodus).

Für Entwickler: Aufbau, API-Konventionen und „Neues Modul anlegen“ stehen in [`ARCHITEKTUR.md`](ARCHITEKTUR.md).
