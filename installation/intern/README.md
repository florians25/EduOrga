# EduOrga Website – interne Installation

> **Nur für den Betreiber des Projekts.** Die Produkt-Website gehört nicht zur Installation an Schulen:
> `install.sh`, `update.sh`, `passwort.sh` und `docker-compose.yml` kennen sie nicht. Schulen installieren EduOrga wie in
> [`../README.md`](../README.md) beschrieben.

Die Website ([`website/`](../../website/README.md)) besteht aus statischen Seiten und einem kleinen Server, der sie
ausliefert. Sie hat keine Datenbank, kein Volume, keine Anmeldung und setzt keine Cookies. Fehler und Ideen laufen über
GitHub ([Issues](https://github.com/florians25/UntPlanNext/issues),
[Discussions](https://github.com/florians25/UntPlanNext/discussions)).

| Datei | Aufgabe |
|---|---|
| [`docker-compose.website.yml`](docker-compose.website.yml) | eigenes Compose-Projekt `untplannext-website`: Container `untplannext-website`, optional `untplannext-website-caddy` (Profil `https`) |
| [`../install-intern.sh`](../install-intern.sh) | Einrichtung und Update (POSIX-sh, wie `install.sh`) |

## Einrichten

```sh
mkdir -p /opt/eduorga-website && cd /opt/eduorga-website
curl -fsSL -H "Accept: application/vnd.github.raw" -o install-intern.sh "https://api.github.com/repos/florians25/UntPlanNext/contents/installation/install-intern.sh?ref=master"
sh install-intern.sh
```

Das Skript prüft Docker und Compose, lädt `docker-compose.website.yml` über die GitHub-API (sonst über
raw.githubusercontent.com) und fragt ab:

1. **Port** – Vorschlag 8290 (bzw. der nächste freie Port); belegte Ports werden erkannt und neu abgefragt.
2. **Domain** – leer lassen für den Betrieb nur über die IP-Adresse.
3. Mit Domain: **eigener Caddy-Container für HTTPS** (Ports 80/443, Zertifikat automatisch) – oder ein vorhandener
   Reverse-Proxy; dann gibt das Skript am Ende einen Caddy- und einen nginx-Block zum Eintragen aus und bindet die
   Website auf Wunsch nur an `127.0.0.1`.
4. **Angaben für Impressum und Datenschutz** (Name, Anschrift, E-Mail; leer = deutlich markierte Platzhalter).

Es schreibt `.env` (nur für root lesbar) und gegebenenfalls `Caddyfile`, lädt das Image
`ghcr.io/florians25/untplannext-website` und startet den Container. Ein erneuter Aufruf startet mit den vorhandenen
Einstellungen, `./install-intern.sh --neu` fragt alles neu ab.

## Update

```sh
cd /opt/eduorga-website
./install-intern.sh --update     # aktuelle docker-compose.website.yml und neues Image laden, neu starten
```

Es gibt keine Daten, die vorher gesichert werden müssten. Eine bestimmte Version: `WEBSITE_VERSION=1.2.3` in `.env`
statt `latest`, dann `./install-intern.sh --update`.

## Einstellungen (`.env`)

| Variable | Standard | Bedeutung |
|---|---|---|
| `WEBSITE_PORT` | `8290` | Port auf dem Server |
| `WEBSITE_BIND` | `0.0.0.0` | `127.0.0.1` = nur lokal (hinter Caddy oder einem Reverse-Proxy) |
| `WEBSITE_VERSION` | `latest` | Tag des Images |
| `WEBSITE_DOMAIN` | – | Domain (nur zur Information; maßgeblich ist das `Caddyfile`) |
| `COMPOSE_PROFILES` | – | `https` = eigenen Caddy-Container starten |
| `HTTP_PORT`, `HTTPS_PORT` | `80`, `443` | Ports des Caddy-Containers |
| `WEBSITE_BETREIBER_NAME`, `…_ANSCHRIFT`, `…_EMAIL` | – | Angaben für Impressum und Datenschutz |
| `ZEITZONE` | `Europe/Berlin` | Zeitzone des Containers |

Nach Änderungen: `docker compose -f docker-compose.website.yml up -d`.

## Umstieg von der früheren Website mit Ideenportal

War die Website bisher Teil der Gesamtinstallation (Profil `website` in `/opt/untplannext`), entfernt
`docker compose up -d --remove-orphans` dort den alten Container beim nächsten Update; `install-intern.sh` bietet
außerdem an, einen noch vorhandenen Container `untplannext-website` aus dem alten Projekt zu entfernen. Das alte Volume
`untplannext-website-daten` (Datenbank des Ideenportals) wird nicht mehr gebraucht und bleibt liegen, bis es von Hand
gelöscht wird: `docker volume rm untplannext-website-daten`.

## Entfernen

```sh
cd /opt/eduorga-website
docker compose -f docker-compose.website.yml down      # mit -v zusätzlich die Zertifikate von Caddy löschen
```
