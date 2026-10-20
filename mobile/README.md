# EduOrga Mobile

**EduOrga Mobile** – *Einfach mehr Schulalltag.* Stundenplan, Vertretungen, Klassenbuch, Mitteilungen und alle
Schulfunktionen von EduOrga Web auf dem Telefon – als installierbare App (PWA) für Lehrkräfte, Schüler*innen und Eltern.
EduOrga Mobile hat keine eigene Datenbank: Die App holt alles von einer laufenden EduOrga-Web-Instanz der Schule; angemeldet
wird mit dem Konto von EduOrga Web. Marke, Farben und Logo: [`design/MARKE.md`](../design/MARKE.md). Technische Kennungen
(Projekt `UntPlanMobile`, Image `untplannext-mobile`, Variablen `UNTPLANWEB_*`/`UNTPLANMOBILE_*`) bleiben unverändert.

> EduOrga ist ein privates Hobbyprojekt eines Auszubildenden zum Fachinformatiker für Systemintegration, entwickelt mit
> Unterstützung von Claude (Anthropic). Jede Schule bzw. jeder Betreiber ist für Einsatz, Betrieb und Datenschutz
> selbst verantwortlich.

| Woche (Standard) | Tag | Stundendetails | Parallele Stunden („+X“) |
|---|---|---|---|
| ![Woche](docs/bilder/plan-woche.png) | ![Tag](docs/bilder/plan-tag.png) | ![Stundendetails](docs/bilder/stundendetails.png) | ![Parallele Stunden](docs/bilder/parallel.png) |

| Heute | Schule (Lehrkraft) | Klassenbuch | Offene Stunden |
|---|---|---|---|
| ![Heute](docs/bilder/heute.png) | ![Schule](docs/bilder/schule.png) | ![Klassenbuch](docs/bilder/klassenbuch.png) | ![Offene Stunden](docs/bilder/offene-stunden.png) |

| Klassenbucheinträge | Schüler*innen | Prüfungen | Vertretungsplan |
|---|---|---|---|
| ![Einträge](docs/bilder/klassenbucheintraege.png) | ![Anwesenheit](docs/bilder/schueler.png) | ![Prüfungen](docs/bilder/pruefungen.png) | ![Vertretungsplan](docs/bilder/vertretungsplan.png) |

| Abwesenheit melden | Raum/Gerät buchen | Sprechtag (Lehrkraft) | Sprechtag (Eltern) |
|---|---|---|---|
| ![Melden](docs/bilder/melden.png) | ![Buchen](docs/bilder/buchen.png) | ![Sprechtag Lehrkraft](docs/bilder/sprechtag-lehrkraft.png) | ![Sprechtag Eltern](docs/bilder/sprechtag-eltern.png) |

| Mehr (Eltern) | Abwesenheiten (Eltern) | Hausaufgaben (Eltern) | Neuigkeiten |
|---|---|---|---|
| ![Mehr Eltern](docs/bilder/mehr-eltern.png) | ![Abwesenheiten](docs/bilder/abwesenheiten-eltern.png) | ![Hausaufgaben](docs/bilder/hausaufgaben-eltern.png) | ![Neuigkeiten](docs/bilder/neuigkeiten.png) |

| Profil | Über EduOrga Mobile | Anmeldung | Postfach |
|---|---|---|---|
| ![Profil](docs/bilder/profil.png) | ![Über](docs/bilder/ueber.png) | ![Anmeldung](docs/bilder/anmeldung.png) | ![Postfach](docs/bilder/postfach.png) |

| Plan auswählen | Menü des Plans | Kennzeichnungen | Termine |
|---|---|---|---|
| ![Planauswahl](docs/bilder/planauswahl.png) | ![Menü](docs/bilder/menue.png) | ![Kennzeichnungen](docs/bilder/zeichenerklaerung.png) | ![Termine](docs/bilder/termine.png) |

| Dunkel: Woche | Dunkel: Details | Dunkel: Heute | Dunkel: Schule | Woche 430 × 932 |
|---|---|---|---|---|
| ![Plan dunkel](docs/bilder/dunkel-plan-woche.png) | ![Details dunkel](docs/bilder/dunkel-stundendetails.png) | ![Heute dunkel](docs/bilder/dunkel-heute.png) | ![Schule dunkel](docs/bilder/dunkel-mehr.png) | ![Woche groß](docs/bilder/plan-woche-430.png) |

## Aufbau der App

Untere Leiste **Heute · Plan · Postfach · Schule** (Lehrkräfte) bzw. **Heute · Plan · Postfach · Mehr** (Schüler*innen,
Eltern); Linien-Symbol und Beschriftung, keine Pillen. Jede Seite hat einen großen Titel, der beim Rollen in eine kompakte
Kopfzeile übergeht. Hell und dunkel (Automatisch/Hell/Dunkel unter „Mehr“ bzw. „Schule“ → Darstellung).

| Bereich | Inhalt |
|---|---|
| **Heute** | Datum, Hinweise des Tages, die nächsten Stunden, Termine und Prüfungen, eigene Abwesenheiten, Klassenleitung, Sprechtag |
| **Plan** | Woche (Standard) über die ganze Breite oder Tag, Umschalter **Tag · Woche** oben rechts, Wischen = andere Woche bzw. anderer Tag, Aufziehen mit zwei Fingern = Tag, Zusammenziehen = Woche; Menü „⋮“: Gehe zu Datum, 2 bzw. 3 Tage, Abwesenheiten, Kennzeichnungen; Planauswahl (Klasse, Lehrkraft, Raum) über den Titel |
| **Postfach** | Posteingang, Gesendet, Entwürfe; Lesen, Antworten, Schreiben, Löschen, Suche |
| **Schule / Mehr** | Schulfunktionen nach Rolle (Tabelle unten), danach Konto und Profilwechsel, Darstellung, Benachrichtigungen, App installieren, Daten aktualisieren, Über EduOrga Mobile, Abmelden |

## Funktionen nach Rolle

| Funktion | Lehrkraft | Schüler*in | Eltern | EduOrga Web (`/api/app/…`) |
|---|---|---|---|---|
| Stundenplan Woche/Tag, Stundendetails, Klassen-/Lehrer-/Raumpläne | ja | ja (ohne Lehrerpläne) | ja (ohne Lehrerpläne) | `plan`, `elemente` |
| Klassenbuch der Stunde: Thema (Lehrstoff), Hausaufgaben, Anwesenheit, Einträge, Notizen | ja | Hausaufgaben lesen | Hausaufgaben lesen | `klassenbuch/stunde`, `…/hausaufgabenliste`, `…/anwesenheit`, `…/vermerke` |
| Offene Stunden (Thema bzw. Anwesenheit fehlt, Tippen öffnet die Stunde) | ja | – | – | `klassenbuch/offene-stunden` |
| Klassenbucheinträge (Liste, neu, löschen) | ja | – | – | `klassenbucheintraege`, `klassenbuch/vermerke` |
| Hausaufgaben (Liste) | ja | ja | ja (je Kind) | `hausaufgaben/eintraege`, `familie/hausaufgaben` |
| Befreiungen (Liste; anlegen/löschen mit Recht) | ja | – | – | `befreiungen` |
| Entschuldigungen (Klassenleitung, Fachlehrkräfte) | ja (mit Recht) | – | Entschuldigungsschreiben als PDF | `entschuldigungen/…`, `familie/entschuldigung` |
| Abwesenheiten | Meine Abwesenheiten | Meine Abwesenheiten | je Kind mit Summen | `meldungen`, `familie/abwesenheiten` |
| Prüfungen (nach Kalenderwochen; eintragen, löschen) | ja (eintragen mit Recht) | ja | ja | `pruefungen`, `meldungen/klausur` |
| Vertretungsplan (5 Tage, Hinweise, abwesende Lehrkräfte/Klassen) | ja | ja | ja | `vertretungen` |
| Abwesenheit melden, Meine Meldungen mit Zurückziehen | ja | – | – | `meldungen/abwesenheit`, `meldungen/{id}` |
| Raum oder Gerät buchen (einmalig oder wöchentlich), Meine Buchungen, Storno (Termin/Serie) | ja (mit Recht) | – | – | `buchen/optionen`, `buchen/suche/…`, `buchen`, `buchen/liste` |
| Elternsprechtag | Zeiten sperren/freigeben, Termin eintragen, absagen, Familien einladen, Einladungen, Warteliste, Teilnahme absagen, Terminplan als PDF | Ankündigung, eigene Termine | Termine buchen, absagen, Warteliste, Termine als PDF | `sprechtag/…` |
| Mitteilungen / Postfach | ja | ja | ja | `mitteilungen` |
| Neuigkeiten (Infos der Schule, Neues in EduOrga, gelesen) | ja | ja | ja | `infocenter` |
| Profil und Benachrichtigungen (E-Mail, Mitteilungen per E-Mail, iCal) | ja | ja | ja | `profil` |
| Push bei Planänderungen | ja | ja | ja | (Pushwache von EduOrga Mobile) |

Rechte aus der Sitzung (`benutzer.rechte`, z. B. `buchung.raum`, `pruefung.anlegen`, `klassenbuch.eigene`) blenden Einträge
aus; EduOrga Web prüft zusätzlich.

## Planraster

Das Planraster der PWA ist die Referenz für alle Oberflächen (iOS spiegelt diese Werte). Umsetzung: `app.js`
(`buildLayout`, `rasterMasse`, `renderGrid`, Abschnitt `DARSTELLUNG`), `app.css` (Abschnitt „Stundenkachel“).

**Raster**

| Element | Wert |
|---|---|
| Rasterfläche | hell `#edf1f2`, dunkel `#0b0f13` (`--raster`); Schule kann „weiß“ wählen |
| Zeitspalte | 32 px (Telefon; ≤ 360 px: 30 px, Tablet 44 px), Fläche `--up-flaeche`, 1-px-Linie `--up-rand`; Stundennummer 13 px/600, darunter Beginn und Ende 10 px `--up-text-3`, tabellarische Ziffern; Ende entfällt bei Zeilen < 50 px |
| Zeilen | **eine Zeile je Stunde, alle gleich hoch** (nicht minutengenau). Höhe = (verfügbare Höhe − Pausenspalte) ÷ Anzahl Stunden bis zur letzten belegten Stunde der Woche (mindestens bis zur 6.), begrenzt auf 44–104 px; erst darunter wird gerollt |
| Pausen | Spalt zwischen den Zeilen: ab 15 Minuten 16 px (Fläche `--raster-pause` hell `#e2e8ea`, dunkel `#080b0e`), kürzere 3 px; Pausenaufsichten sitzen im Spalt (Höhe Spalt − 2 px, ab < 18 px Schrift 9,5 px) |
| Tagesspalten | Mo–Fr über die ganze Breite, 2 px Luft zwischen den Spalten; heute im Kopf in `--up-primaer` mit 2-px-Linie |
| Jetzt-Linie | 2 px `--up-primaer` am heutigen Tag, 1 px (35 %) über die Woche, Punkt 9 px am Rand der Zeitspalte |
| Uhrzeit → Lage | stückweise linear: innerhalb einer Stunde anteilig, in der Pause anteilig im Spalt |

**Stundenkarte (Standard „EduOrga Standard“, gleich in Web und iOS – design/DESIGN.md, Abschnitt 10)**

| Element | Wert |
|---|---|
| Lage | Oberkante = Zeilenoberkante + 1 px, Höhe = Höhe der Stunden − 2 px; Doppel- und Blockstunden laufen genau über ihre Zeilen samt Spalt dazwischen |
| Fläche | weiß (`--karte`, dunkel `#1a2128`), flacher Schatten; Radius 4 px (Schulwert `eckenradius`) |
| Leiste | links bündig 4 px grau (`--balken-grau` hell `#b4bec4`, dunkel `#56626c`); hat das Fach eine Farbe: Leiste in der Fachfarbe und Fläche leicht getönt |
| Zeilen | **Fach 13/600**, darunter je eine Zeile 12 px `--up-text-2`: Klasse, Lehrkraft, Raum; die Zeile des gezeigten Elements entfällt, solange sie unverändert ist; einzeilig mit „…“; passt nicht alles, entfallen unveränderte Zeilen von unten (Fach, geänderte Zeilen und Status-Tag bleiben) |
| Zeitspalte | Beginn oben, Stundennummer mittig (14/600), Ende unten |
| Tageskopf | „17.11“ (600) über „Mo“ |
| Zeichen | unten rechts 13 px: Info, Online, Hausaufgabe |

**Kennzeichnung**

| Fall | Darstellung |
|---|---|
| Geändert (Vertretung, Raum, Fach, Verlegung, Zusatz) | grüne 3-px-Leiste, helle grüne Fläche (`--up-aenderung-flaeche`), Kennzeichen (5 × 5 px) oben rechts; Tag auf der Zeile: „Gal ← Gor“, „105 ← 303“, „BI ← MU“, „neu B070“; geänderte Zeilen 600; unten „verlegt ← Mo 20.10., 3. Std“ bzw. „zusätzlich“ |
| Entfällt | rote 3-px-Leiste, helle rote Fläche, **alles durchgestrichen**; unten „entfällt“ bzw. „verlegt → Di 21.10., 6. Std“; „5b fehlt“ bei abwesender Klasse |
| Offen (Vertretung folgt) | grau: weiße Karte, graue Leiste, gestrichelter Rand, gestrichelter Tag „Abr fehlt“ (Kollegium) bzw. „Vertretung folgt“ (Schüler*innen, Eltern) – nie rot |
| Tag | getönt mit feiner Linie (offen gestrichelt), Radius 3 px, ≥ 12 px/600, grüne Schrift #267349 (≥ 5:1), nie durchgestrichen |
| Prüfung | 1-px-Linie `--up-pruefung`, Fläche `--up-pruefung-flaeche`, Wort „Prüfung“ |
| Termin/Veranstaltung | ruhiger beiger Block (`--up-ereignis-*`) ohne Leiste |
| Mitteilung | helle gelbe Notiz über der ersten Stunde (`--up-mitteilung-*`), Tippen zeigt den Text |
| Ferien | ganzer Tag `--up-frei-flaeche` mit Name und Zeitraum |

Legende: Blatt **„Kennzeichnungen“** (Menü „⋮“) mit den Gruppen Unterricht · Geändert · Offen · Entfällt · Hinweise.
Jede Karte trägt einen ausgeschriebenen zugänglichen Namen; `prefers-reduced-motion` schaltet Übergänge ab.

**Aktualität:** Plandaten immer zuerst vom Netz (`cache: no-store`, Service Worker „Netz zuerst“), Kopie nur als Rückfall ohne Netz
mit Hinweis „Offline — Stand hh:mm“; neu geladen bei Rückkehr in die App, Fokus, wiederkehrendem Netz und alle zwei Minuten. Unter
dem Plannamen und in „Mehr › Daten aktualisieren“ steht **„Stand EduOrga Studio: …“** (letzte Übertragung, Feld `studioStand`),
nach mehr als 24 Stunden an Schultagen mit „Daten evtl. nicht aktuell“.

**Stundendetails:** für die eigene Stunde der Lehrkraft Reiter **Details | Klassenbuch** – im Klassenbuch zuerst das Thema
(Eingabefeld), darunter „Anwesenheitskontrolle“ (mit Ergebnis) und „Alle anwesend“, dann Hausaufgaben, Einträge, Notizen und
„Prüfung eintragen“ (vorbelegt aus der Stunde). In „Schule › Prüfungen“ lassen sich Prüfungen eintragen, ändern und löschen
(über EduOrga Web, mit Rechteprüfung und Konfliktmeldung).

**Parallele Stunden („+X“)** – keine Zählkarte: Liegen in einer Rasterzelle mehr Stunden, als nebeneinander passen (jede
mindestens 40 px breit), steht die erste Stunde in voller Breite, und **oben rechts in der Zelle** (3 px vom oberen und
rechten Rand) sitzt der Reiter **„+X“** innen am rechten Rand, senkrecht mittig: 20 px hoch, mindestens 22 px breit, links Radius
4 px, rechts bündig, 11,5 px/600 tabellarisch, Fläche `--up-primaer-flaeche` (grün getönt bei einer Änderung dahinter, rot bei einem
Entfall); die erste Zeile der Karte macht 22 px Platz. Tippen öffnet das Blatt **„X Stunden zur selben Zeit“**
(Wochentag, Datum, Stunden) mit allen Stunden: Stunde und Uhrzeit, Fachstreifen, Zeilen der Karte, Statusplakette; Tippen
auf eine Zeile öffnet ihre Stundendetails. In der Tagesansicht stehen parallele Stunden nebeneinander.

**Umschalten** – Segmentschalter **Tag · Woche** in der Kopfzeile (28 px hoch, 13 px), waagrecht wischen = vorige/nächste
Woche bzw. Tag, Aufziehen mit zwei Fingern (> 1,3) = Tag, Zusammenziehen (< 0,75) = Woche. Antippen einer Karte öffnet die
großen Stundendetails als Blatt von unten (Kopf mit Fachstreifen, Fach und Langname, Plakette „Vertretung“, „Vertretung
offen“, „Raumänderung“, „Prüfung“ bzw. „Zusatzstunde“, darunter Klassenbuch-Zeilen).

## Installation mit Docker

EduOrga Mobile läuft neben EduOrga Web, als eigener Container auf **Port 8081**. Die Datei `docker-compose.yml` startet beide:

```bash
mkdir untplan && cd untplan
curl -O https://raw.githubusercontent.com/florians25/UntPlanNext/master/mobile/docker-compose.yml
docker compose up -d
```

- EduOrga Web: `http://<server>:8080` – Schule einrichten, UntPlan verbinden, Konten anlegen (siehe [EduOrga Web](../web/README.md)).
- EduOrga Mobile: `http://<server>:8081` – mit einem Konto von EduOrga Web anmelden.

**Ausprobieren mit Beispieldaten:** In `docker-compose.yml` bei EduOrga Web `UNTPLANWEB_DEMO: "1"` und
`UNTPLANWEB_ADMIN_PASSWORT: "admin12345"` setzen. Konten für Lehrkräfte und Klassen legt EduOrga Web unter
*Administration → Benutzer → Konten aus Stammdaten* an.

**Läuft EduOrga Web schon** (z. B. mit der Compose-Datei aus `web/`), genügt EduOrga Mobile allein:

```bash
docker run -d --name untplanmobile -p 8081:8081 -e UNTPLANWEB_URL=http://<server>:8080 ghcr.io/florians25/untplannext-mobile
```

**Selbst bauen** (Wurzel des UntPlan-Repositorys): `docker build -f mobile/Dockerfile -t untplanmobile .`

### Als App installieren (HTTPS)

Service Worker und „Zum Home-Bildschirm“ funktionieren nur über HTTPS (oder `localhost`). Im Betrieb gehört
EduOrga Mobile deshalb hinter einen Reverse-Proxy mit Zertifikat, zum Beispiel Caddy:

```
plan.meine-schule.de {
    reverse_proxy untplanweb:8080
}
app.meine-schule.de {
    reverse_proxy untplanmobile:8081
}
```

EduOrga Mobile wertet `X-Forwarded-Proto` und `X-Forwarded-Host` aus und setzt das Sitzungscookie dann als `Secure`.

### Einstellungen (Umgebungsvariablen)

| Variable | Bedeutung | Standard |
|---|---|---|
| `UNTPLANWEB_URL` | Adresse von EduOrga Web aus Sicht des Containers | `http://untplanweb:8080` (Image), `http://localhost:8080` (Entwicklung) |
| `UNTPLANWEB_PUBLIC_URL` | Adresse von EduOrga Web aus Sicht des Browsers (für die Einmalanmeldung) | gleicher Rechnername, Port 8080 |
| `UNTPLANMOBILE_ZEITZONE` | Zeitzone der Schule (heutiger Tag, aktuelle Woche) | `Europe/Berlin` |
| `ASPNETCORE_HTTP_PORTS` | Port im Container | `8081` |
| `UNTPLANMOBILE_UPDATE_PRUEFEN` | `0` = nicht nach neuen Versionen suchen | an |
| `UNTPLANMOBILE_UPDATE_URL` | Quelle der neuesten Version (wie `UNTPLANWEB_UPDATE_URL`, z. B. `ghcr://florians25/untplannext-mobile`) | GitHub-Releases von florians25/UntPlanNext |
| `UNTPLANMOBILE_UPDATE_TAG_PRAEFIX` | nur Tags mit diesem Präfix berücksichtigen | – |
| `UNTPLANMOBILE_PUSH_DETAILS` | `1` = Einzelheiten (Tag, Stunde, Fach, Klasse, Raum, Profilname) in Push-Nachrichten | aus (datensparsam) |

### Installation mit MariaDB/MySQL

EduOrga Mobile selbst speichert keine Daten – es ist ein Proxy vor EduOrga Web. Die Datenbank betrifft nur EduOrga Web;
`docker-compose.mariadb.yml` startet MariaDB (Volume, Healthcheck), EduOrga Web mit `UNTPLANWEB_DB=mysql` und EduOrga Mobile:

```bash
mkdir untplan && cd untplan
curl -O https://raw.githubusercontent.com/florians25/UntPlanNext/master/mobile/docker-compose.mariadb.yml
curl -O https://raw.githubusercontent.com/florians25/UntPlanNext/master/mobile/update.sh && chmod +x update.sh
printf 'MARIADB_PASSWORT=…\nMARIADB_ROOT_PASSWORT=…\nWATCHTOWER_TOKEN=…\nCOMPOSE_FILE=docker-compose.mariadb.yml\n' > .env
docker compose up -d
```

Einzelheiten (eigener Datenbankserver, Verbindungszeichenfolge, Technik): [EduOrga Web – Installation mit MariaDB/MySQL](../web/README.md#installation-mit-mariadbmysql).

### Update

Wie bei EduOrga Web ist ein Update ein neues Image; EduOrga Mobile hat keine Migrationen und keinen Zustand außer den Sitzungen,
die an EduOrga Web hängen. Beide Dienste zusammen aktualisieren:

```bash
./update.sh                       # Sicherung von UntPlanWeb (SQLite bzw. MariaDB), docker compose pull, docker compose up -d
# oder von Hand:
docker compose pull && docker compose up -d
```

- **Versionsanzeige:** `GET /api/version` liefert Version, neueste veröffentlichte Version und ob ein Update verfügbar ist
  (gleiche Prüflogik wie EduOrga Web, Datei `web/src/UntPlanWeb/Dienste/Updatepruefung.cs` wird eingebunden). Mit
  `UNTPLANWEB_MOBILE_INTERN_URL=http://untplanmobile:8081` bei EduOrga Web (in den Compose-Dateien gesetzt) erscheint die Version von
  EduOrga Mobile auch in EduOrga Web unter *Administration → Übersicht → Version & Updates*.
- **Update aus der Oberfläche:** EduOrga Mobile hat keine eigene Administration. Der Knopf *Update installieren* in EduOrga Web
  stößt Watchtower an (`docker compose --profile updater up -d`), das alle Container mit dem Label
  `com.centurylinklabs.watchtower.enable=true` aktualisiert – also EduOrga Web und EduOrga Mobile, nicht MariaDB. Alternativ
  Anforderungsdatei plus cron (`./update.sh --wenn-angefordert`), siehe [EduOrga Web – Update](../web/README.md#update).
- Nach dem Update lädt die App auf den Telefonen die neue Oberfläche automatisch: Der Service Worker trägt eine Fassung
  (Prüfwert über alle Dateien) im Cachenamen.

### Datenmigration

EduOrga Mobile hat keine eigenen Daten. Für den Umstieg von EduOrga Web von SQLite auf MariaDB im selben Ordner:

```bash
docker compose down
curl -O https://raw.githubusercontent.com/florians25/UntPlanNext/master/mobile/docker-compose.mariadb.yml   # .env wie oben
docker compose -f docker-compose.mariadb.yml run --rm untplanweb --migrieren-nach-mysql
docker compose -f docker-compose.mariadb.yml up -d
```

Siehe [EduOrga Web – Datenmigration](../web/README.md#datenmigration).

## Verbindung zu EduOrga Web

EduOrga Mobile spricht ausschließlich die JSON-API von EduOrga Web (`/api/app/*`) an:

- **Anmeldung:** `POST /api/login` gibt Benutzername und Passwort an `POST /api/app/anmelden` weiter. Das Sitzungscookie
  von EduOrga Web bekommt der Browser als eigenes Cookie `untplanmobile` (HttpOnly, SameSite=Lax); EduOrga Mobile reicht
  es bei jedem Aufruf als `untplanweb` weiter und führt Erneuerungen und Abmeldungen nach. Ändernde Aufrufe tragen den
  Kopf `X-UntPlanWeb: 1`, den EduOrga Web verlangt. Ohne gültige Sitzung antworten alle Endpunkte mit HTTP 401, die
  App zeigt dann die Anmeldung.
- **Rechte** prüft allein EduOrga Web (z. B. Lehrerpläne nicht für Klassenkonten, Klassenbuch nur für die eigene Stunde);
  dessen Fehlermeldungen kommen unverändert in der App an.

| EduOrga Mobile | Aufgabe | EduOrga Web |
|---|---|---|
| `GET /` | App-Hülle mit Startdaten (`window.TT_BOOT`: eigener Plan, Stammdaten, aktuelle Woche, Rolle und Rechte, Kartendarstellung `darstellung`) | `sitzung`, `elemente`, `plan` |
| `GET /api/mobile?action=meta` | eigener Plan, Klassen/Lehrkräfte/Räume, Stundenzeiten, Langnamen | `sitzung`, `elemente` |
| `GET /api/mobile?action=week&date=…&type=mine\|class\|teacher\|room&id=…` | eine Woche als Kacheln | `plan`, `klassenbuch/klasse` |
| `POST /api/login` (`action=login\|logout`) | An- und Abmelden | `anmelden`, `abmelden` |
| `GET/POST /api/classbook` | Lehrstoff, Hausaufgaben, Notizen für Schüler*innen und Lehrkräfte, Klassenbucheinträge, Bemerkungen, Anwesenheit, Klassendienste, „Findet online statt“ nur lesend (`online`, `onlineLink`, `onlineEditable = false`; `action=online` → 409), gemeinsamer Klassenbucheintrag (`action=remarkMany`); `canEdit` sagt, ob es die eigene Stunde ist | `klassenbuch/stunde`, `klassenbuch/hausaufgabenliste`, `klassenbuch/anwesenheit`, `klassenbuch/vermerke`, `klassenbuch/klasse`, `klassendienste` |
| `GET/POST /api/rooms` (`action=free\|book\|change`) | freie buchbare Räume einer Stunde, Raum buchen; `change` mit `op=replace\|add\|remove` (Raum-Chip) | `meldungen/freieraeume`, `meldungen/raumbuchung`, `mobil/raum` |
| `GET/POST /api/home` | Startseite, Termine, Abwesenheiten, Fehlzeiten der Klasse, Entschuldigen | `heute`, `meldungen`, `klassenbuch/fehlzeiten` |
| `GET/POST /api/messages` | Posteingang, Gesendet, Lesen, Schreiben, Löschen | `mitteilungen` |
| `GET/POST/PUT/DELETE /api/web/{pfad}` | Schulfunktionen (Prüfungen, Vertretungsplan, Hausaufgaben, Melden, Buchen, Neuigkeiten, Profil, Familie, Klassenbuch-Listen, Befreiungen, Elternsprechtag mit PDF): Durchreichung an denselben Pfad; nur die Endpunkte der Freigabeliste `Api/WebApi.cs` mit ihren Methoden, sonst 404; JSON und PDF unverändert | `/api/app/{pfad}` |
| `GET /api/accounts` | Profilwechsel (nicht unterstützt, leere Liste) | – |
| `GET /sw.js`, `/manifest.webmanifest`, `/assets/…` | Service Worker (mit Fassung), Manifest, Oberfläche | – |
| `GET /gesundheit` | Gesundheitsprüfung (Docker) | – |

**Übersetzung der Karten:** Die Stundenkarten von EduOrga Web werden in die Kacheln der Oberfläche übersetzt
(`Dienste/Kachelbau.cs`):

| EduOrga Web | Kachel |
|---|---|
| `regulaer` | `normal` |
| `geaendert`, `vorgemerkt` | `change` (geänderte Werte mit `…Orig` und `changed`) |
| `geaendert` als Zusatzstunde (Sondereinsatz, Zusatz…, Verlegung, ohne Unterricht) | `change` mit `extra` (Plakette in den Details), ohne Lehrkraft `teacher: "---"` |
| `offen` | `change` mit `openSub` (alter Wert durchgestrichen) |
| `abwesend` (Lehrer-/Raumplan) | `change` mit dem eigenen Kürzel als `teacherOrig` (läuft „ohne mich“) |
| `entfall` | `cancelled` |
| `entfall` mit Art Freisetzung/Klassenabwesenheit | `change` mit `classAbsent` (Klasse als `classOrig`) |
| Raumänderung ohne neuen Raum, Raum „???“ | `openRoom` (bisheriger Raum als `roomOrig`) |
| `klausur` | `klausur` |
| `bereitschaft` | `standby` (Stunden mit gehaltener Vertretung entfallen) |
| `veranstaltung`, Teilnahme ohne Fach | `absence` mit `overlay` (Veranstaltungsfeld) |
| `buchung` | `event` |
| freier Tag (`ferien`, `feiertag`, `frei`) | `holiday` mit `holidayName` und `holidayRange` |
| Pausenaufsicht | `supervision` (`_supAbsent` vertreten, `_supSub` übernommen) |

Für die Zeiträume der Ferienfelder liefert EduOrga Web unter `/api/app/elemente` zusätzlich die Liste `ferien`.

**Raumänderung aus der App** (`POST /api/app/mobil/raum` in EduOrga Web, `Api/MobilApi.cs`): ersetzen, hinzufügen oder
löschen. Gespeichert wird wie jede Raumbuchung als Rückmeldung „raumbuchung“ mit der vollständigen Raumliste (neuer Raum
vorn – UntPlan übernimmt ihn als Vertretungsraum, die übrigen als Zusatzräume). Je Lehrkraft und Stunde gibt es höchstens
eine offene Raumänderung; ergibt sich wieder die ursprüngliche Raumliste, wird sie nur zurückgezogen. Neue Räume müssen
buchbar und frei sein.

## Datenschutz

- **Datenschutzhinweise der Schule:** `GET /datenschutz` zeigt die Seite von EduOrga Web (ohne Anmeldung); verlinkt auf der Anmeldeseite und unter „Mehr“.
- **Gerätespeicher:** Abmelden und Profilwechsel löschen `localStorage` (bis auf das Erscheinungsbild) sowie im Cache des Service Workers die
  zwischengespeicherten API-Antworten, die Startseite mit dem Plan und den Stand der Planwache; die App-Hülle (Skripte, Schriften, Symbole) bleibt.
- **Push** datensparsam (siehe unten), Protokolle ohne Benutzernamen. Leitfaden: [`docs/datenschutz/`](../docs/datenschutz/README.md).

## Mehrere Profile und Benachrichtigungen (Web-Push)

- **Mehrere Profile je Gerät:** Unter „Mehr → Weiteres Profil anmelden“ meldet sich ein weiteres Konto an, ohne das bisherige abzumelden. Gewechselt wird über die Kontozeile unter „Mehr“. Die Sitzungen liegen verschlüsselt (ASP.NET Data Protection) im Datenordner von EduOrga Mobile; das Gerät trägt nur eine Zufallskennung als Cookie. „Abmelden“ meldet nur das aktuelle Profil ab.
- **Benachrichtigung sofort nach dem Import:** EduOrga Mobile prüft jede Minute (`UNTPLANMOBILE_PUSH_INTERVALL`, Sekunden, `0` = aus) den Planstand von EduOrga Web. Ändert sich der eigene Plan eines Profils mit eingeschalteten Benachrichtigungen, geht ein Web-Push (RFC 8291/8292, eigene Implementierung ohne Fremdbibliothek) an das Gerät. Der Inhalt ist standardmäßig datensparsam – „Änderung im Stundenplan · Bitte den Stundenplan in der App ansehen.“, ohne Fach, Klasse, Raum oder Namen (Sperrbildschirm); Einzelheiten nur mit `UNTPLANMOBILE_PUSH_DETAILS=1`. Am iPhone/iPad funktioniert das in der App vom Homescreen ab iOS 16.4; HTTPS ist Voraussetzung.
- **Datenordner:** `UNTPLANMOBILE_DATEN` (im Container `/data`, Volume `untplanmobile-daten`) enthält `konten.json`, `vapid.json` (VAPID-Schlüssel, beim ersten Start erzeugt) und die Data-Protection-Schlüssel. Kontakt für die Push-Dienste: `UNTPLANMOBILE_VAPID_KONTAKT` (`mailto:` oder `https:`).

## Entwicklung

```bash
# EduOrga Web mit Beispieldaten (Port 5190)
cd web && UNTPLANWEB_DEMO=1 UNTPLANWEB_ADMIN_PASSWORT=admin12345 dotnet run --project src/UntPlanWeb --urls http://localhost:5190
# EduOrga Mobile dagegen (Port 5191)
cd mobile && UNTPLANWEB_URL=http://localhost:5190 dotnet run --project src/UntPlanMobile --urls http://localhost:5191
# Tests (starten EduOrga Web im Testprozess)
dotnet test mobile/tests/UntPlanMobile.Tests
```

Aufbau:

- `src/UntPlanMobile`: ASP.NET Core 8 (Minimal-APIs) ohne eigene Datenbank.
  - `Dienste/UntPlanWebVerbindung.cs`: Aufrufe an EduOrga Web mit durchgereichtem Sitzungscookie.
  - `Dienste/Kachelbau.cs`: Wochenplan → Kacheln; `Dienste/Wochendienst.cs`: Wochen, Stammdaten, Startdaten.
  - `Api/`: die Endpunkte der Oberfläche (Stundenplan, Anmeldung, Klassenbuch, Startseite, Mitteilungen, Sprechtag,
    Entschuldigungen), `WebApi.cs` (Durchreichung `/api/web/…` der Schulfunktionen mit Freigabeliste) und `VersionApi.cs` (`/api/version`).
  - `Vorlagen/index.html`, `Vorlagen/sw.js`: App-Hülle und Service Worker; der Server setzt Symbolsammlung,
    Startdaten (mit CSP-Nonce) und Fassung ein.
  - `wwwroot/`: die Oberfläche ohne Build-Schritt – `app.js` (Plan, Heute, Postfach, Sprechtag), `schule.js`
    (Schulfunktionen unter „Schule“/„Mehr“), `tokens.css`, `app.css`, Schriften, Symbole und Manifest.
- `tests/UntPlanMobile.Tests`: Übersetzung der Karten und Ende-zu-Ende-Tests gegen EduOrga Web mit dem Beispielpaket.

Die Oberfläche folgt dem gemeinsamen Designsystem von EduOrga (`design/MARKE.md`, `design/DESIGN.md`): Grundwerte in
`wwwroot/assets/css/tokens.css` (Kopie von `design/tokens.css`), Schrift IBM Plex Sans (SIL OFL, `wwwroot/assets/fonts`),
Linien-Symbole aus Lucide (ISC, `wwwroot/assets/icons/LUCIDE-LICENSE.txt`) in der eingebetteten Symbolsammlung
`symbole-sprite.svg`. App-Symbole (`NODE_PATH=$(npm root -g) node design/logo/icons_rendern.cjs mobile/src/UntPlanMobile/wwwroot/assets/icons`) und Favicon (`design/logo/edo-monogramm.svg`) zeigen das EduOrga-Monogramm; Manifest `theme_color` `#164c55`. Es gibt keinen
Build-Schritt und keine Abhängigkeiten aus dem Netz.

EduOrga Mobile gehört weder zur Desktop-Solution `UntPlan.sln` noch zu `web/UntPlanWeb.sln`, sondern hat die eigene
Solution `UntPlanMobile.sln` und einen eigenen CI-Ablauf (`.github/workflows/mobile.yml`). Dieser testet und
veröffentlicht das Image `ghcr.io/florians25/untplannext-mobile`.

> Hinweis: Ein neues GHCR-Paket ist zunächst privat. Damit `docker pull` ohne Anmeldung funktioniert, stellen Sie es einmalig auf öffentlich:
> GitHub → Packages → untplanmobile → Package settings → Change visibility.

## Einmalanmeldung (SSO) über EduOrga Web

Beim ersten Aufruf leitet EduOrga Mobile automatisch zu EduOrga Web weiter. Wer dort schon angemeldet ist, landet ohne
Passworteingabe direkt im eigenen Plan. Sonst erscheint die Anmeldeseite von EduOrga Web, danach geht es zurück in die App.
Die Anmeldung mit Benutzername und Passwort in der App bleibt als Alternative erhalten.

- EduOrga Web gibt nur einen Einmal-Code heraus (2 Minuten gültig), den EduOrga Mobile serverseitig einlöst; Passwörter
  laufen nie über die Mobil-App.
- Erlaubte Rücksprungadressen: `UNTPLANWEB_MOBILE_URL` bei EduOrga Web (kommagetrennt, z. B. `https://m.meine-schule.de`).
  Ohne Angabe ist nur derselbe Rechnername (anderer Port) erlaubt.
- Liegen beide hinter verschiedenen Adressen (Reverse-Proxy), bei EduOrga Mobile `UNTPLANWEB_PUBLIC_URL` und bei EduOrga Web
  `UNTPLANWEB_MOBILE_URL` setzen.
