# EduOrga betreiben – Update, Sicherung, Fehlerbehebung

Für Installationen mit [`installation/install.sh`](../installation/install.sh) im Ordner `/opt/untplannext`
(Installation: [`INSTALLATION.md`](INSTALLATION.md)). Alle Befehle im Installationsordner als root ausführen.

## Auf einen Blick

| Aufgabe | Befehl |
|---|---|
| Zustand der Container | `docker compose ps` |
| Protokoll eines Programms | `docker compose logs --tail 100 untplannext-web` (bzw. `-studio`, `-mobile`, `-caddy`) |
| Aktualisieren mit Sicherung | `./update.sh` |
| Nur sichern | `./update.sh --nur-sichern` |
| Passwort neu setzen | `./passwort.sh studio\|web [benutzer]` |
| Einstellungen übernehmen | `docker compose up -d --remove-orphans` |
| Neu einrichten (Daten bleiben) | `./install.sh --neu` |

## Update

```sh
cd /opt/untplannext
./update.sh              # alles: Studio und Web sichern, neue Images laden, neu starten
./update.sh studio       # nur EduOrga Studio (ebenso web, mobile – auch mehrere)
./update.sh web mobile   # nur EduOrga Web und Mobile
./update.sh --nur-sichern
./update.sh --ohne-sicherung   # ohne vorherige Sicherung (nicht empfohlen)
```

Ablauf: Datenbanken sichern (schlägt eine Sicherung fehl, bricht das Update ab) → aktuelle `docker-compose.yml` laden
(die bisherige wird als `docker-compose.yml.alt-<Datum>` beiseitegelegt, `.env` bleibt unverändert) → neue Images laden →
Container neu starten → alte Images aufräumen. Datenbank-Migrationen laufen beim Start der Programme automatisch.

* **Automatisch**, z. B. jede Nacht: `30 3 * * * cd /opt/untplannext && ./update.sh >> update.log 2>&1` (crontab).
* **Aus der Oberfläche:** Mit Watchtower startet *Administration → Übersicht → Update installieren* in EduOrga Web das
  Update von Web und Mobile. Ohne Watchtower: `* * * * * cd /opt/untplannext && ./update.sh --wenn-angefordert >> update.log 2>&1`.
* **Bestimmte Version:** `UNTPLAN_VERSION=1.4.0` in `.env` statt `latest`, dann `./update.sh`.
* **Hinweis auf neue Versionen:** Studio und Web prüfen alle 6 Stunden die
  [GitHub-Releases](https://github.com/florians25/EduOrga/releases). Abschalten mit `STUDIO_UPDATE_PRUEFEN=0` bzw.
  `UNTPLANWEB_UPDATE_PRUEFEN=0` (z. B. ohne Internetzugang).

## Sicherung

| Programm | Sicherung durch `update.sh` |
|---|---|
| Studio (SQLite) | `dotnet UntPlanStudio.dll --sichern` → `/data/sicherungen` im Volume `untplannext-studio-daten` |
| Studio (MariaDB, `STUDIO_DB=mysql`) | `mariadb-dump` der Datenbank `eduorga_studio` → `./sicherungen/untplannext-studio-<zeit>.sql.gz` |
| Web (SQLite) | `dotnet UntPlanWeb.dll --sichern` → `/data/sicherungen` im Volume `untplannext-web-daten` |
| Web (MariaDB) | `mariadb-dump` → `./sicherungen/untplannext-web-<zeit>.sql.gz` |

Es bleiben jeweils die neuesten 14 Sicherungen (`SICHERUNGEN_BEHALTEN` in `.env`). Sicherungen ansehen:

```sh
docker compose exec untplannext-studio ls /data/sicherungen
docker compose exec untplannext-web ls /data/sicherungen
ls -l sicherungen/
```

Die Sicherungen in den Volumes liegen auf demselben Server. Für den Ernstfall `./sicherungen` (mit verschlüsselten
Kopien, siehe unten) regelmäßig auf ein anderes System kopieren.

### Sicherungen verschlüsseln

Empfohlen, sobald `./sicherungen` den Server verlässt. In `.env` einen **öffentlichen** Schlüssel eintragen:

* `SICHERUNG_AGE_EMPFAENGER=age1…` ([age](https://age-encryption.org), `apt install age`; auch eine Datei mit
  Empfängern oder mehrere durch Komma) oder
* `SICHERUNG_GPG_EMPFAENGER=<Schlüssel-ID>` (gpg).

Dann schreibt `update.sh` MariaDB-Abzüge nur verschlüsselt (`…sql.gz.age` bzw. `.gpg`) und legt von den
SQLite-Sicherungen eine verschlüsselte Kopie in `./sicherungen` ab (`…db.gz.age`). Fehlt das Programm, bricht das Update
ab. Das Schlüsselpaar **nicht auf dem Server** erzeugen oder aufbewahren:

```sh
# auf einem anderen Rechner
age-keygen -o schluessel.txt
# wiederherstellen
age -d -i schluessel.txt datei.sql.gz.age | gunzip | …
```

## Wiederherstellen

```sh
# Studio (SQLite): Sicherung auswählen und zurückspielen (Container wird dafür kurz angehalten)
docker compose exec untplannext-studio ls /data/sicherungen
docker compose stop untplannext-studio
# alte WAL-/SHM-Dateien mit entfernen, sonst würden sie auf die zurückgespielte Datenbank angewendet
docker compose run --rm --entrypoint sh untplannext-studio -c 'rm -f /data/studio.db-wal /data/studio.db-shm && cp /data/sicherungen/<datei> /data/studio.db'
docker compose start untplannext-studio

# Web mit MariaDB
gunzip -c sicherungen/untplannext-web-<zeit>.sql.gz | docker compose exec -T untplannext-mariadb \
  sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE"'

# Studio mit MariaDB (Studio dafür kurz anhalten)
docker compose stop untplannext-studio
gunzip -c sicherungen/untplannext-studio-<zeit>.sql.gz | docker compose exec -T untplannext-mariadb \
  sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" eduorga_studio'
docker compose start untplannext-studio
```

EduOrga Web mit SQLite: siehe [`web/README.md`](../web/README.md), Abschnitt Sicherung.

## Einstellungen ändern

`.env` bearbeiten, dann `docker compose up -d --remove-orphans`. Häufige Werte:

| Variable | Bedeutung |
|---|---|
| `COMPOSE_PROFILES` | laufende Programme, z. B. `studio,web,mobile,https` |
| `STUDIO_PORT`, `WEB_PORT`, `MOBILE_PORT`, `HTTP_PORT`, `HTTPS_PORT` | Ports der Programme bzw. von Caddy |
| `BIND_ADRESSE` | `127.0.0.1` (nur lokal, hinter Proxy) oder `0.0.0.0` |
| `UNTPLAN_VERSION` | `latest` oder eine bestimmte Version |
| `ZEITZONE` | Standard `Europe/Berlin` |
| `SICHERUNGEN_BEHALTEN` | Anzahl der Sicherungen je Programm (Standard 14) |
| `UNTPLANWEB_SICHERE_COOKIES`, `STUDIO_SICHERE_COOKIES` | `1` hinter HTTPS |
| `UNTPLANWEB_SITZUNG_TAGE` | Gültigkeit der Anmeldung in Tagen (Standard 14) |
| `UNTPLANMOBILE_PUSH_DETAILS` | `1` = Einzelheiten in Benachrichtigungen (Standard aus) |
| `STUDIO_UPDATE_PRUEFEN`, `UNTPLANWEB_UPDATE_PRUEFEN` | `0` = keine Anfragen an GitHub |

Die Passwörter in `.env` (`STUDIO_ADMIN_PASSWORT`, `UNTPLANWEB_ADMIN_PASSWORT`) gelten nur beim allerersten Start –
später `./passwort.sh` verwenden.

## Fehlerbehebung

Zuerst `docker compose ps` und das Protokoll des betroffenen Containers ansehen
(`docker compose logs --tail 100 <container>`).

| Meldung bzw. Problem | Ursache und Lösung |
|---|---|
| „Docker ist nicht installiert“, „Docker Compose (Plugin „docker compose“) fehlt“ | Docker Engine mit Compose-Plugin installieren, `install.sh` erneut aufrufen. |
| „Kein Zugriff auf Docker“ | Als root oder Mitglied der Gruppe `docker` ausführen. |
| „pull access denied“, „Images konnten nicht geladen werden“ | Die Pakete auf `ghcr.io` sind nicht öffentlich: auf GitHub *Profil → Packages → Paket → Package settings → Change visibility → Public* oder auf dem Server `docker login ghcr.io -u <GitHub-Benutzer>` (Token mit `read:packages`), dann `./install.sh`. |
| „docker-compose.yml ist nicht die aktuelle Fassung“ | GitHub lieferte eine zwischengespeicherte Datei: `rm docker-compose.yml` und `sh install.sh` nach ein paar Minuten erneut. |
| Port bereits belegt | `install.sh` fragt neu. Später Ports in `.env` ändern, `docker compose up -d`. |
| Kein Zertifikat | Domains müssen auf den Server zeigen, 80 und 443 aus dem Internet erreichbar sein (andere Ports nur mit Weiterleitung im Router). `docker compose logs untplannext-caddy`. |
| „WARNUNG: Das Passwort … konnte nicht gesetzt werden“, Anmeldung schlägt fehl | `./passwort.sh studio` bzw. `./passwort.sh web` (hebt in Web auch eine Sperre auf). |
| Mobile lässt sich nicht als App installieren, keine Benachrichtigungen | HTTPS ist Voraussetzung. |
| Studio überträgt nicht an Web | In Studio *EduOrga Web → Einstellungen*: Server `untplannext-web`, Port `8080`, ohne HTTPS, Schul-ID und API-Schlüssel aus Web (*Verwaltung → System & Datenabgleich*); *Verbindung prüfen*. |
| Update bricht mit „Sicherung … fehlgeschlagen“ ab | Absicht – ohne Sicherung kein Update. Läuft der Container? Ist bei verschlüsselten Sicherungen `age` bzw. `gpg` installiert? |
| Namen ohne `ghcr.io/…` (z. B. `untplanmobile`) | `docker-compose.yml` aus einer älteren Installation: `./install.sh` bzw. `./update.sh` laden die aktuelle Fassung. |

Nicht dabei? [Fehler melden](https://github.com/florians25/EduOrga/issues/new?template=fehler.yml) – mit Distribution,
Docker-Version und den letzten Zeilen des Protokolls, ohne Passwörter und ohne den Inhalt der `.env`.

## Deinstallieren

`docker compose down` hält die Container an und entfernt sie; die Daten bleiben in den Volumes.
`docker compose down -v` löscht zusätzlich **alle Daten**.
