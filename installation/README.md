# UntPlan Next installieren und aktualisieren (Docker)

> **Neben einer bisherigen UntPlan-Installation:** Projekt (`untplannext`), Container, Dienste, Volumes, Images
> (`ghcr.io/florians25/untplannext-…`) und der Installationsordner (`/opt/untplannext`) tragen alle „next“. Die
> Standard-Ports (8190/8180/8181) unterscheiden sich von denen des bisherigen Systems, Watchtower arbeitet in einem
> eigenen Bereich (`scope: untplannext`). Belegt das bisherige System bereits 80/443 (HTTPS), bei der Einrichtung
> andere Ports wählen oder UntPlan Next ohne HTTPS hinter dem vorhandenen Reverse-Proxy betreiben.

Alle Programme laufen als eigene Container. **UntPlan Studio und UntPlan Web haben jeweils ihre eigene Datenbank**
in einem eigenen Volume – Studio kann ohne Web betrieben, gesichert und aktualisiert werden und umgekehrt.

| Container | Aufgabe | Daten |
|---|---|---|
| `untplannext-studio` | Stundenplanung im Browser | SQLite-Datenbank `studio.db` im Volume `untplannext-studio-daten` |
| `untplannext-web` | Portal für Lehrkräfte, Schüler und Eltern | SQLite im Volume `untplannext-web-daten` **oder** MariaDB |
| `untplannext-mobile` | App fürs Telefon (PWA), nutzt UntPlan Web | Geräteprofile im Volume `untplannext-mobile-daten` |
| `untplannext-mariadb` | optional, Datenbank für UntPlan Web | Volume `untplannext-mariadb-daten` |
| `untplannext-caddy` | optional, HTTPS mit automatischem Zertifikat | Volumes `untplannext-caddy-daten`, `untplannext-caddy-config` |
| `untplannext-watchtower` | optional, Update aus der Administration von UntPlan Web (nur Web und Mobile) | – |

## Voraussetzungen

* Linux-Server mit Docker Engine und dem Compose-Plugin (`docker compose version`)
* für HTTPS: je Programm eine Domain (z. B. `studio.meine-schule.de`, `plan.meine-schule.de`, `app.meine-schule.de`),
  die auf den Server zeigt, Ports 80 und 443 erreichbar

## Installation

```sh
mkdir -p /opt/untplannext && cd /opt/untplannext
curl -fsSLO https://raw.githubusercontent.com/florians25/UntPlanNext/master/installation/install.sh
sh install.sh
```

Das Skript lädt `docker-compose.yml` und `update.sh`, fragt ab, welche Programme installiert werden, welche Datenbank
UntPlan Web nutzt (SQLite oder MariaDB) und ob HTTPS eingerichtet werden soll. Es erzeugt zufällige Passwörter,
schreibt `.env` (nur für root lesbar) und `Caddyfile` und startet die Container. Am Ende stehen Adressen und
Zugangsdaten auf dem Bildschirm.

**Ports:** Auf Wunsch fragt das Skript eigene Ports ab (Studio, Web, Mobile und bei HTTPS die Ports von Caddy). Sie
stehen danach in `.env` (`STUDIO_PORT`, `WEB_PORT`, `MOBILE_PORT`, `HTTP_PORT`, `HTTPS_PORT`) und lassen sich dort
jederzeit ändern (`docker compose up -d`). Für das automatische Zertifikat müssen 80 und 443 aus dem Internet erreichbar
sein – andere Ports nur mit Weiterleitung im Router.

Ohne HTTPS sind die Programme unter `http://<server>:8190` (Studio), `:8180` (Web) und `:8181` (Mobile) erreichbar –
gedacht für einen vorhandenen Reverse-Proxy. Für die Installation von UntPlan Mobile als App ist HTTPS nötig.

### „pull access denied“ beim Laden der Images

Die Images liegen auf `ghcr.io/florians25/untplannext-studio`, `…/untplan-web` und `…/untplan-mobile`. Neue Pakete sind
auf GitHub zunächst **privat**. Entweder einmalig auf GitHub *Profil → Packages → Paket → Package settings → Change
visibility → Public* stellen (für alle drei Pakete), oder auf dem Server mit einem Token (Recht `read:packages`)
anmelden: `docker login ghcr.io -u <GitHub-Benutzer>`. Erscheinen Namen ohne `ghcr.io/…` (z. B. `untplanmobile`), stammt
die `docker-compose.yml` aus einer älteren Installation – `install.sh` und `update.sh` laden die aktuelle Fassung
inzwischen automatisch und legen die alte als `docker-compose.yml.alt-<Datum>` beiseite.

### Studio mit Web verbinden

In Studio **UntPlan Web → Einstellungen**: Server `untplannext-web`, Port `8080`, ohne HTTPS (internes Netz der Container),
dazu Schul-ID und API-Schlüssel aus UntPlan Web (*Administration → Verbindung mit UntPlan*). Laufen Studio und Web auf
verschiedenen Servern, die öffentliche Adresse von UntPlan Web mit HTTPS eintragen.

## Update

```sh
cd /opt/untplannext
./update.sh              # alles: Studio und Web sichern, neue Images laden, neu starten
./update.sh studio       # nur UntPlan Studio
./update.sh web mobile   # nur UntPlan Web und Mobile
./update.sh --nur-sichern
```

Vor jedem Update werden die Datenbanken gesichert; schlägt eine Sicherung fehl, bricht das Update ab.
Datenbank-Migrationen laufen beim Start der Programme automatisch.

| Programm | Sicherung |
|---|---|
| Studio | `dotnet UntPlanStudio.dll --sichern` → `/data/sicherungen` im Volume `untplannext-studio-daten` |
| Web (SQLite) | `dotnet UntPlanWeb.dll --sichern` → `/data/sicherungen` im Volume `untplannext-web-daten` |
| Web (MariaDB) | `mariadb-dump` → `./sicherungen/untplannext-web-<zeit>.sql.gz` |

Es bleiben jeweils die neuesten 14 Sicherungen (`SICHERUNGEN_BEHALTEN` in `.env`).

**Automatisch:** z. B. jede Nacht per cron `30 3 * * * cd /opt/untplannext && ./update.sh >> update.log 2>&1`.
**Aus der Oberfläche:** mit Watchtower (bei der Einrichtung auswählen) startet *Administration → Übersicht →
Update installieren* in UntPlan Web das Update von Web und Mobile; alternativ ohne Watchtower per cron
`* * * * * cd /opt/untplannext && ./update.sh --wenn-angefordert >> update.log 2>&1`.

**Bestimmte Version:** `UNTPLAN_VERSION=1.4.0` in `.env` statt `latest`, dann `./update.sh`.

**Hinweis auf neue Versionen:** UntPlan Studio und UntPlan Web prüfen alle 6 Stunden die
[GitHub-Releases](https://github.com/florians25/UntPlanNext/releases) und zeigen Administratoren „Neue Version … verfügbar“ mit
den Versionshinweisen (Studio unter der Kopfleiste, Web auf *Heute*/*Übersicht*). Aktualisiert wird wie oben, z. B.
`./update.sh studio`. Abschalten mit `STUDIO_UPDATE_PRUEFEN=0` bzw. `UNTPLANWEB_UPDATE_PRUEFEN=0` (z. B. ohne Internetzugang).

## Einstellungen ändern

`.env` bearbeiten (z. B. ein Programm in `COMPOSE_PROFILES` ergänzen oder entfernen), dann `docker compose up -d
--remove-orphans`. Komplett neu fragen lassen: `./install.sh --neu` – vorhandene Daten bleiben erhalten.

## Sicherungen wiederherstellen

```sh
# Studio: Sicherung auswählen und zurückspielen (Container wird dafür kurz angehalten)
docker compose exec untplannext-studio ls /data/sicherungen
docker compose stop untplannext-studio
# (alte WAL-/SHM-Dateien mit entfernen, sonst würden sie auf die zurückgespielte Datenbank angewendet)
docker compose run --rm --entrypoint sh untplannext-studio -c 'rm -f /data/studio.db-wal /data/studio.db-shm && cp /data/sicherungen/<datei> /data/studio.db'
docker compose start untplannext-studio

# Web mit MariaDB
gunzip -c sicherungen/untplannext-web-<zeit>.sql.gz | docker compose exec -T untplannext-mariadb \
  sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE"'
```

Für UntPlan Web mit SQLite: siehe `web/README.md`, Abschnitt Sicherung.

## Deinstallieren

`docker compose down` hält die Container an und entfernt sie; die Daten bleiben in den Volumes.
`docker compose down -v` löscht zusätzlich **alle Daten**.
