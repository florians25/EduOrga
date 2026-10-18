# UntPlan installieren und aktualisieren (Docker)

Alle Programme laufen als eigene Container. **UntPlan Studio und UntPlan Web haben jeweils ihre eigene Datenbank**
in einem eigenen Volume – Studio kann ohne Web betrieben, gesichert und aktualisiert werden und umgekehrt.

| Container | Aufgabe | Daten |
|---|---|---|
| `untplanstudio` | Stundenplanung im Browser | SQLite-Datenbank `studio.db` im Volume `untplanstudio-daten` |
| `untplanweb` | Portal für Lehrkräfte, Schüler und Eltern | SQLite im Volume `untplanweb-daten` **oder** MariaDB |
| `untplanmobile` | App fürs Telefon (PWA), nutzt UntPlan Web | Geräteprofile im Volume `untplanmobile-daten` |
| `mariadb` | optional, Datenbank für UntPlan Web | Volume `mariadb-daten` |
| `caddy` | optional, HTTPS mit automatischem Zertifikat | Volumes `caddy-daten`, `caddy-config` |
| `watchtower` | optional, Update aus der Administration von UntPlan Web (nur Web und Mobile) | – |

## Voraussetzungen

* Linux-Server mit Docker Engine und dem Compose-Plugin (`docker compose version`)
* für HTTPS: je Programm eine Domain (z. B. `studio.meine-schule.de`, `plan.meine-schule.de`, `app.meine-schule.de`),
  die auf den Server zeigt, Ports 80 und 443 erreichbar

## Installation

```sh
mkdir -p /opt/untplan && cd /opt/untplan
curl -fsSLO https://raw.githubusercontent.com/florians25/UntPlanNext/master/installation/install.sh
sh install.sh
```

Das Skript lädt `docker-compose.yml` und `update.sh`, fragt ab, welche Programme installiert werden, welche Datenbank
UntPlan Web nutzt (SQLite oder MariaDB) und ob HTTPS eingerichtet werden soll. Es erzeugt zufällige Passwörter,
schreibt `.env` (nur für root lesbar) und `Caddyfile` und startet die Container. Am Ende stehen Adressen und
Zugangsdaten auf dem Bildschirm.

Ohne HTTPS sind die Programme unter `http://<server>:8090` (Studio), `:8080` (Web) und `:8081` (Mobile) erreichbar –
gedacht für einen vorhandenen Reverse-Proxy. Für die Installation von UntPlan Mobile als App ist HTTPS nötig.

### Studio mit Web verbinden

In Studio **UntPlan Web → Einstellungen**: Server `untplanweb`, Port `8080`, ohne HTTPS (internes Netz der Container),
dazu Schul-ID und API-Schlüssel aus UntPlan Web (*Administration → Verbindung mit UntPlan*). Laufen Studio und Web auf
verschiedenen Servern, die öffentliche Adresse von UntPlan Web mit HTTPS eintragen.

## Update

```sh
cd /opt/untplan
./update.sh              # alles: Studio und Web sichern, neue Images laden, neu starten
./update.sh studio       # nur UntPlan Studio
./update.sh web mobile   # nur UntPlan Web und Mobile
./update.sh --nur-sichern
```

Vor jedem Update werden die Datenbanken gesichert; schlägt eine Sicherung fehl, bricht das Update ab.
Datenbank-Migrationen laufen beim Start der Programme automatisch.

| Programm | Sicherung |
|---|---|
| Studio | `dotnet UntPlanStudio.dll --sichern` → `/data/sicherungen` im Volume `untplanstudio-daten` |
| Web (SQLite) | `dotnet UntPlanWeb.dll --sichern` → `/data/sicherungen` im Volume `untplanweb-daten` |
| Web (MariaDB) | `mariadb-dump` → `./sicherungen/untplanweb-<zeit>.sql.gz` |

Es bleiben jeweils die neuesten 14 Sicherungen (`SICHERUNGEN_BEHALTEN` in `.env`).

**Automatisch:** z. B. jede Nacht per cron `30 3 * * * cd /opt/untplan && ./update.sh >> update.log 2>&1`.
**Aus der Oberfläche:** mit Watchtower (bei der Einrichtung auswählen) startet *Administration → Übersicht →
Update installieren* in UntPlan Web das Update von Web und Mobile; alternativ ohne Watchtower per cron
`* * * * * cd /opt/untplan && ./update.sh --wenn-angefordert >> update.log 2>&1`.

**Bestimmte Version:** `UNTPLAN_VERSION=1.4.0` in `.env` statt `latest`, dann `./update.sh`.

## Einstellungen ändern

`.env` bearbeiten (z. B. ein Programm in `COMPOSE_PROFILES` ergänzen oder entfernen), dann `docker compose up -d
--remove-orphans`. Komplett neu fragen lassen: `./install.sh --neu` – vorhandene Daten bleiben erhalten.

## Sicherungen wiederherstellen

```sh
# Studio: Sicherung auswählen und zurückspielen (Container wird dafür kurz angehalten)
docker compose exec untplanstudio ls /data/sicherungen
docker compose stop untplanstudio
docker compose run --rm --entrypoint sh untplanstudio -c 'cp /data/sicherungen/<datei> /data/studio.db'
docker compose start untplanstudio

# Web mit MariaDB
gunzip -c sicherungen/untplanweb-<zeit>.sql.gz | docker compose exec -T mariadb \
  sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE"'
```

Für UntPlan Web mit SQLite: siehe `web/README.md`, Abschnitt Sicherung.

## Deinstallieren

`docker compose down` hält die Container an und entfernt sie; die Daten bleiben in den Volumes.
`docker compose down -v` löscht zusätzlich **alle Daten**.
