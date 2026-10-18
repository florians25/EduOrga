# UntPlan

**Stunden- und Vertretungsplanung für Schulen in Nordrhein-Westfalen.** UntPlan besteht aus vier Oberflächen auf einer
gemeinsamen Fachlogik:

| Produkt | Für wen | Ordner |
|---|---|---|
| **UntPlan Studio** | Stundenplanung, Vertretungsplanung und Verwaltung – Web-Anwendung für Schulleitung und Planungsteam | [`studio/`](studio/README.md) |
| **UntPlan Web** | Stundenplan, Vertretungen, Klassenbuch und Kommunikation für Lehrkräfte, Schülerinnen, Schüler und Eltern | [`web/`](web/README.md) |
| **UntPlan Mobile** | installierbare App (PWA) zu UntPlan Web | [`mobile/`](mobile/README.md) |
| **UntPlan Next** | native iPhone- und iPad-App zu UntPlan Web (SwiftUI, Liquid Glass, Xcode 26, iOS 18+) | [`ios/`](ios/README.md) |

![UntPlan Studio](studio/docs/bilder/uebersicht.png)

Alle Oberflächen folgen einem gemeinsamen Designsystem ([`design/DESIGN.md`](design/DESIGN.md)): Marine als
Markenfarbe, IBM Plex Sans, Linien-Symbole, einheitliche Statusfarben für Entfall, Vertretung, Prüfung, Termin und Ferien.

## Installation

Jedes Programm läuft als eigener Docker-Container; Studio und Web haben jeweils eine eigene Datenbank.

```sh
mkdir -p /opt/untplannext && cd /opt/untplannext
curl -fsSL -H "Accept: application/vnd.github.raw" -o install.sh "https://api.github.com/repos/florians25/UntPlanNext/contents/installation/install.sh?ref=master"
sh install.sh      # Einrichtung mit Rückfragen (Programme, Datenbank, HTTPS)
./update.sh        # Update mit vorheriger Sicherung beider Datenbanken
```

Einzelheiten: [`installation/README.md`](installation/README.md).

**Neue Version veröffentlichen:** Versionsnummer in `VERSION` setzen, committen und `git tag v1.2.0 && git push origin
v1.2.0`. Die Abläufe bauen die Images `ghcr.io/florians25/untplannext-*` mit den Tags `1.2.0`, `stable` und `latest`
und legen das GitHub-Release an; Administratoren von Studio und Web sehen daraufhin den Hinweis auf die neue Version.
Builds vom Branch `master` tragen `<VERSION>-dev.<Lauf>` und erzeugen keinen Hinweis.

## Funktionen

- **Schuldaten:** Schuljahr, NRW-Schulformen, Zeitraster mit Vormittag, Nachmittag, fixer oder flexibler Mittagspause und Pausen, NRW-Ferien und -Feiertage (inkl. beweglicher Feiertage), A/B-Wochen, Perioden.
- **Stammdaten:** Klassen, Lehrkräfte, Räume, Fächer, Raumgruppen, Aufsichtsbereiche, Abteilungen, Abwesenheitsgründe, Schülerinnen und Schüler – mit Tabellenbearbeitung, Mehrfachänderung, Kommentaren und Umbenennen mit Verweisanpassung.
- **Zeitwünsche:** bestimmte (−3 … +3, Kernzeit) und unbestimmte Zeitwünsche, z. B. „ein freier Vormittag“.
- **Unterricht:** einfacher und gekoppelter Unterricht, Doppelstunden, Blöcke, Kursbänder, A/B-Wochen, befristeter Unterricht.
- **Automatische Planung:** Gewichtung (26 Kriterien), mehrere Verfahren mit Ergebnisvergleich und Bewertungszahl, Tausch- und Raumoptimierung, Diagnose der Eingabedaten und des Plans.
- **Manuelles Planen:** Verplanen, Verschieben und Tauschen per Drag & Drop mit Zielanzeige, Fixieren, Entplanen, Tauschvorschläge, Raumzuordnung, Gesamtübersichten.
- **Stundenpläne:** Klassen-, Lehrkraft-, Raum- und Fachpläne, eigene Formate, Druck als PDF, HTML-Aushang, iCal.
- **Vertretungsplanung:** Abwesenheiten von Lehrkräften, Klassen und Räumen, automatisch erzeugte offene Vertretungen, Vertretungsvorschlag mit Gewichtung, Bereitschaften, Entfall-Vorschlag ab EF, Verlegung, Betreuung, Sondereinsätze, Klausuren, Tagestexte, automatische Vertretung ganzer Tage.
- **Pausenaufsichten:** Aufsichtsbereiche × Pausen × Tage, automatische Einteilung, Aufsichtsvertretungen.
- **Auswertung:** Soll/Ist, Unterrichtsmatrix, Stundentafel, Vertretungsstatistik mit der **NRW-Mehrarbeitsregel** (Vergütung ab mehr als 3 Stunden im Kalendermonat, abzüglich Minderstunden), Ausfallstatistik, CSV.
- **Oberstufe:** Kurswahlen, Kollisionsmatrix, automatische Bandbildung.
- **Mehrbenutzerbetrieb:** mehrere Planende gleichzeitig, Bereichssperren, Exklusivbetrieb, Gruppen und Rechte.
- **Import und Export:** SchILD-NRW-CSV (Lehrkräfte, Klassen, Schüler), BAL, GPU-Textdateien (Datenübernahme beim Umstieg), HTML, iCal, CSV.
- **UntPlan Web:** Pläne und Vertretungen veröffentlichen, Abwesenheitsmeldungen, Raumbuchungen und Klausuren zurückholen. Die Schnittstelle steht in [docs/SYNC_API.md](docs/SYNC_API.md).

Die Bedienung von Studio beschreibt das **[Benutzerhandbuch](docs/HANDBUCH.md)**.

## Aufbau

```text
src/UntPlan.Core            Fachlogik (Modell, Optimierung, Vertretungsplanung, Module, Import/Export) – net8.0
src/UntPlan.Web.Contracts   gemeinsame Datenverträge Studio ↔ Web
src/UntPlan.Portal          Referenzserver der Synchronisationsschnittstelle
studio/                     UntPlan Studio (ASP.NET Core + Oberfläche ohne Build-Schritt)
web/                        UntPlan Web
mobile/                     UntPlan Mobile (PWA)
ios/                        UntPlan Next für iOS (SwiftUI; frühere App archiviert in archiv/ios-alt/)
design/                     Designsystem: Grundwerte, Schrift, Signet
installation/               Gesamtinstallation mit Docker (install.sh, update.sh, docker-compose.yml)
tests/                      xUnit-Tests der Fachlogik
```

```bash
dotnet test tests/UntPlan.Core.Tests
cd studio/src/UntPlanStudio && STUDIO_ADMIN_PASSWORT=geheim123 ASPNETCORE_URLS=http://127.0.0.1:5501 dotnet run
```

Jede Oberfläche wird als Container-Image gebaut (GitHub Actions: `studio.yml`, `web.yml`, `mobile.yml`); Installation und
Betrieb stehen in der README des jeweiligen Ordners. Schuldateien (`*.up`) sind JSON-Dateien.

## Lizenzen von Drittbestandteilen

- IBM Plex Sans – SIL Open Font License 1.1 (`design/fonts/OFL.txt`)
- Lucide-Symbole – ISC-Lizenz (`design/LUCIDE-LICENSE.txt`)

## Hinweis

UntPlan ist ein eigenständiges Programm und steht in keiner Verbindung zu Herstellern anderer Stundenplanprogramme.
Import-Formate anderer Programme dienen ausschließlich der Datenübernahme beim Umstieg.
