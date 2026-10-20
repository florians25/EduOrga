# EduOrga installieren – Schritt für Schritt

Vom leeren Linux-Server bis zum ersten veröffentlichten Plan. Grundlage sind
[`installation/README.md`](../installation/README.md) und die Skripte `install.sh`, `update.sh` und `passwort.sh` im Ordner
[`installation/`](../installation/). Update, Sicherung und Fehlerbehebung: [`BETRIEB.md`](BETRIEB.md).

> EduOrga ist ein privates Hobbyprojekt eines Auszubildenden zum Fachinformatiker für Systemintegration, entwickelt mit
> Unterstützung von Claude (Anthropic). Jede Schule bzw. jeder Betreiber ist für Einsatz, Betrieb und Datenschutz
> selbst verantwortlich.

## 1. Was installiert wird

`install.sh` legt im Ordner `/opt/untplannext` die Dateien `docker-compose.yml`, `update.sh`, `passwort.sh`, `.env`
(Einstellungen und Passwörter, nur für root lesbar) und `Caddyfile` an. Welche Container laufen, steht in `.env` unter
`COMPOSE_PROFILES`.

| Container | Aufgabe | Port | Daten |
|---|---|---|---|
| `untplannext-studio` | EduOrga Studio – Stunden- und Vertretungsplanung im Browser | 8190 | SQLite im Volume `untplannext-studio-daten` oder MariaDB (`eduorga_studio`) |
| `untplannext-web` | EduOrga Web – Portal für Lehrkräfte, Schüler und Eltern | 8180 | SQLite im Volume `untplannext-web-daten` oder MariaDB (`untplanweb`) |
| `untplannext-mobile` | EduOrga Mobile – App fürs Telefon (PWA), nutzt EduOrga Web | 8181 | Geräteprofile im Volume `untplannext-mobile-daten` |
| `untplannext-mariadb` | optional, Datenbanken für Web und/oder Studio | – | Volume `untplannext-mariadb-daten` |
| `untplannext-caddy` | optional, HTTPS mit automatischem Zertifikat | 80 / 443 | Volumes `untplannext-caddy-daten`, `untplannext-caddy-config` |
| `untplannext-watchtower` | optional, Update aus der Administration von EduOrga Web | – | – |

Vor dem Start mit echten Daten den [Leitfaden Datenschutz](datenschutz/README.md) durchgehen (AV-Vertrag, Verzeichnis,
TOM, Fristen, Datenschutzhinweise) und die Sicherungen verschlüsseln ([`BETRIEB.md`](BETRIEB.md#sicherungen-verschlüsseln)).

## 2. Voraussetzungen

* Linux-Server mit **Docker Engine und dem Compose-Plugin**; Zugang als root oder als Mitglied der Gruppe `docker`.
* `curl` und Zugang zum Internet (GitHub für die Skripte, `ghcr.io` für die Images).
* Freie Ports: Studio 8190, Web 8180, Mobile 8181; mit HTTPS über Caddy zusätzlich **80 und 443 aus dem Internet
  erreichbar**.
* Für HTTPS je Programm eine Domain, die auf den Server zeigt, z. B. `studio.meine-schule.de`, `plan.meine-schule.de`,
  `app.meine-schule.de`. Ohne HTTPS lässt sich EduOrga Mobile nicht als App installieren.

Docker prüfen – alle drei Befehle müssen ohne Fehler antworten (`install.sh` prüft dasselbe):

```sh
docker --version
docker compose version
docker info
```

## 3. Installieren

```sh
mkdir -p /opt/untplannext && cd /opt/untplannext
curl -fsSL -H "Accept: application/vnd.github.raw" -o install.sh "https://api.github.com/repos/florians25/EduOrga/contents/installation/install.sh?ref=master"
sh install.sh
```

Das Skript fragt der Reihe nach (Eingabetaste übernimmt den Vorschlag in Klammern):

| Frage | Antwort bzw. Vorschlag |
|---|---|
| Studio installieren? | `j` |
| Web installieren? | `j` |
| Mobile installieren? | `j` – nur, wenn Web gewählt ist |
| Datenbank für Web | `sqlite` oder `mariadb` |
| Datenbank für Studio | `sqlite` oder `mariadb` (derselbe MariaDB-Container, Datenbank `eduorga_studio`) |
| HTTPS mit automatischem Zertifikat? | `j`: je Programm eine Domain und eine E-Mail für Hinweise zum Zertifikat |
| Updates aus der Administration von Web erlauben (Watchtower)? | `n` |
| Zeitzone | `Europe/Berlin` |
| Ports selbst festlegen? | `n`: Studio 8190, Web 8180, Mobile 8181, bei HTTPS 80 und 443 |
| Benutzername des Administrators von Studio | `admin` |
| Passwörter der Administratoren | verdeckt, mindestens 8 Zeichen, ohne Leerzeichen und ohne `" ' $ \ ``; leer = zufällig |

Belegte Ports erkennt das Skript und fragt neu (Vorschlag: Port + 1000). Danach schreibt es `.env` und `Caddyfile`, lädt
die Images, startet die Container und setzt die gewählten Administrator-Passwörter (`--passwort-setzen … --anlegen`).
Am Ende stehen Adressen und Zugangsdaten auf dem Bildschirm.

Ein erneuter Aufruf von `sh install.sh` startet mit den vorhandenen Einstellungen; `./install.sh --neu` fragt alles neu
ab – vorhandene Daten bleiben erhalten.

## 4. Domain und HTTPS

**Variante A – Caddy (empfohlen):** Bei der Frage nach HTTPS `j` wählen und die Domains eintragen. `install.sh` startet
`untplannext-caddy`, der die Zertifikate selbst holt und erneuert, und bindet die Programme nur an `127.0.0.1`
(`BIND_ADRESSE=127.0.0.1`). Die erzeugte `Caddyfile` (Auszug):

```
studio.meine-schule.de {
	encode zstd gzip
	reverse_proxy untplannext-studio:8080 {
		flush_interval -1
	}
	request_body {
		max_size 64MB
	}
	header Strict-Transport-Security "max-age=31536000"
}

plan.meine-schule.de {
	encode zstd gzip
	reverse_proxy untplannext-web:8080
	header Strict-Transport-Security "max-age=31536000"
}
```

**Variante B – vorhandener Reverse-Proxy:** HTTPS bei der Einrichtung ablehnen. Die Programme lauschen dann auf
`http://<server>:8190`, `:8180` und `:8181`. In `.env` `BIND_ADRESSE=127.0.0.1` setzen (nur noch lokal erreichbar),
hinter HTTPS außerdem `UNTPLANWEB_SICHERE_COOKIES=1` und `STUDIO_SICHERE_COOKIES=1`, dann `docker compose up -d`.
Beispiel für nginx (Zertifikate wie bei den übrigen Seiten des Servers):

```nginx
server {
    listen 443 ssl;
    server_name studio.meine-schule.de;
    client_max_body_size 64m;          # Hochladen von Schuldateien (wie max_size in der Caddyfile)
    location / {
        proxy_pass http://127.0.0.1:8190;
        proxy_buffering off;           # entspricht flush_interval -1 in der Caddyfile
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
server {
    listen 443 ssl;
    server_name plan.meine-schule.de;
    location / {
        proxy_pass http://127.0.0.1:8180;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
# app.meine-schule.de entsprechend auf http://127.0.0.1:8181
```

## 5. Erster Login

1. EduOrga Studio öffnen und mit dem Administrator anmelden (Benutzername wie bei der Einrichtung, Vorschlag `admin`).
2. EduOrga Web öffnen und mit dem Konto `admin` anmelden.
3. Die Zugangsdaten stehen auch in `/opt/untplannext/.env` (`STUDIO_ADMIN_PASSWORT`, `UNTPLANWEB_ADMIN_PASSWORT`). Sie
   gelten nur beim allerersten Start – nach der ersten Anmeldung das Passwort ändern.

Passwort vergessen oder Konto gesperrt:

```sh
cd /opt/untplannext
./passwort.sh studio              # Administrator von Studio (STUDIO_ADMIN_BENUTZER aus .env, sonst admin)
./passwort.sh studio planer1      # beliebiger Studio-Benutzer
./passwort.sh web                 # Konto admin von EduOrga Web
./passwort.sh web mueller --aenderungspflicht   # bei der nächsten Anmeldung neues Passwort wählen
./passwort.sh web chefin --anlegen              # fehlendes Konto als Administrator anlegen
```

Das Passwort wird verdeckt zweimal abgefragt (ohne Terminal: eine Zeile über die Standardeingabe). Die Container
laufen weiter, die Änderung gilt sofort; bei EduOrga Web wird außerdem eine Sperre nach Fehlversuchen aufgehoben.

## 6. Studio mit Web verbinden

1. In EduOrga Web unter *Verwaltung → System & Datenabgleich* Schul-ID und API-Schlüssel ablesen.
2. In EduOrga Studio unter *EduOrga Web → Einstellungen* eintragen: Server `untplannext-web`, Port `8080`, ohne HTTPS
   (internes Netz der Container). Laufen Studio und Web auf verschiedenen Servern, die öffentliche Adresse von EduOrga
   Web mit HTTPS eintragen.
3. *Verbindung prüfen*, dann *Exportieren*. In EduOrga Web unter *Administration → Benutzer* „Konten aus Stammdaten“
   anlegen.

Planen in Studio: [Benutzerhandbuch](HANDBUCH.md).

## 7. SQLite oder MariaDB

| | SQLite (Vorschlag) | MariaDB |
|---|---|---|
| geeignet für | die meisten Schulen | große Schulen, vorhandene Sicherungskonzepte |
| Ablage | Datei im Volume des Programms | Container `untplannext-mariadb`, Datenbanken `untplanweb` und `eduorga_studio` |
| Sicherung vor dem Update | `--sichern` des Programms nach `/data/sicherungen` | `mariadb-dump` nach `./sicherungen` |
| `.env` | `UNTPLANWEB_DB=sqlite`, `STUDIO_DB=sqlite` | `UNTPLANWEB_DB=mysql`, `STUDIO_DB=mysql` mit Verbindungszeichenfolge |

Die Wahl gilt je Programm. Umstellen: `./install.sh --neu` und `mariadb` wählen. Beim ersten Start mit der leeren
MariaDB-Datenbank übernimmt Studio die vorhandene `studio.db` vollständig. Einzelheiten:
[`installation/README.md`](../installation/README.md#datenbank-für-eduorga-studio-sqlite-oder-mariadb).

## Weiter

* Update, Sicherung, Wiederherstellung, Einstellungen, Fehlerbehebung: [`BETRIEB.md`](BETRIEB.md)
* Fehler bei der Installation melden: [Formular „Fehler melden“](https://github.com/florians25/EduOrga/issues/new?template=fehler.yml)
  (Anwendung „Installation, Update oder Betrieb“; ohne Passwörter und ohne den Inhalt der `.env`)
