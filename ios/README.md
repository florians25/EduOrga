# UntPlan für iOS

Native iOS-App (SwiftUI) zu **UntPlan Web**. Sie zeigt den Tag, den Stundenplan, das Postfach und alle weiteren
Funktionen für Lehrkräfte, Schüler*innen und Erziehungsberechtigte und spricht direkt die JSON-API von UntPlan Web
unter `/api/app` an. Eine eigene Datenbank hat die App nicht; angemeldet wird mit dem Konto von UntPlan Web.

Gestaltung nach dem UntPlan-Designsystem (`design/DESIGN.md`, Farben aus `design/tokens.css`): Systemschrift,
Akzentfarbe Marine, Neutraltöne Schiefer, feste Statusfarben. SF Symbols nur in der Tab-Leiste und für Funktionen
(Aktionen, Pfeile, Status). Keine eigenen Bild-Assets außer App-Symbol und Akzentfarbe.

## Aufbau der Oberfläche

Tab-Leiste des Systems mit vier Reitern:

- **Heute** – Datum und Schule, die (noch kommenden) Stunden des Tages bzw. ein Hinweis bei Abwesenheit, freiem Tag,
  Ferien oder gesperrtem Zeitraum, die Mitteilungen des Tages (Nachrichten, Veranstaltungen, Hinweise) und eine
  Übersicht (Termine, Abwesenheiten, Entschuldigungen, Hausaufgaben, Sprechtage, Änderungen).
- **Plan** – Stundenplan als Raster nach Uhrzeit (Woche, 3 Tage, 2 Tage, Tag), waagrecht wischen blättert. Planname
  oben öffnet die Planauswahl (eigener Plan, Favoriten, Klassen, Lehrkräfte, Räume). Antippen einer Stunde öffnet die
  Stundendetails als Blatt mit Ziehgriff.
- **Postfach** – Posteingang, Gesendet und Entwürfe; lesen, antworten, löschen, neue Mitteilung mit Empfängerauswahl
  und Anhängen. Die Zahl ungelesener Mitteilungen steht als Plakette am Reiter.
- **Mehr** – Profil und Konten (mehrere Konten, Wechsel ohne Abmelden), Termine, Abwesenheiten, Entschuldigungen,
  Pausenaufsichten, Hausaufgaben, Änderungen, Sprechtage, Pläne von Klassen, Lehrkräften und Räumen, Einstellungen
  (Mitteilungen bei Planänderungen, Kontaktdaten und Kalender-Abo, Passwort), Neuigkeiten, Über und Abmelden.

## Stundenplan-Darstellung

Umsetzung von `design/DESIGN.md`, Abschnitt 5 (`Ansichten/StundenKarteView.swift`, `Ansichten/StundenplanView.swift`,
Logik in `Dienste/Kachelbau.swift`):

- Kacheln mit der Fachfarbe als Tönung (14 %, im Dunkelmodus 22 %), Radius 4 pt, Fachkürzel halbfett, Raum rechts,
  darunter Lehrkraft bzw. Klasse. Ohne Fachfarbe neutrale Fläche mit feinem Rand.
- **Entfall:** schräge Schraffur, Inhalt durchgestrichen, Plakette „Entfall“.
- **Änderung, Vertretung, Raumänderung:** 1,5-pt-Rahmen in Petrol, der geänderte Wert petrolfarben unterstrichen,
  der alte Wert durchgestrichen.
- **Prüfung:** helle Bernstein-Fläche mit Plakette „Prüfung“.
- **Veranstaltung, Termin, Raumbuchung:** helle Violett-Fläche mit gestricheltem Rahmen.
- **Ferien, Feiertage:** die ganze Tagesspalte hellblau mit Name und Zeitraum.
- **Stunde ohne die betrachtete Lehrkraft** (abgegeben) und Bereitschaft einer abwesenden Lehrkraft: ohne Fläche,
  gepunkteter Rahmen, kleine Plakette. **Bereitschaft:** gestrichelter neutraler Rahmen.
- **Pausenaufsichten** als schmale Kacheln in der Pause (Vertretung mit Petrol-Rahmen, abgegeben gepunktet, entfallen
  schraffiert). **Parallele Stunden** nebeneinander in Spuren; passt es nicht, ein Zählstreifen am rechten Rand.
- Zeitspalte mit Stundennummer, Beginn und Ende; Pausen als schmale graue Bänder; Jetzt-Linie in Marine mit Kreis am
  Rand der Zeitspalte; der heutige Tag mit Marine-Schrift, Linie unter dem Spaltenkopf und leichter Tönung.
- Zeichen unten rechts in der Kachel: Information bzw. Notiz, Hausaufgabe fällig, online.

## Öffnen in Xcode

1. `ios/UntPlanMobile.xcodeproj` in Xcode 15 oder neuer öffnen.
   Alternativ mit [XcodeGen](https://github.com/yonaskolb/XcodeGen) im Ordner `ios/` `xcodegen generate` ausführen.
2. Ziel **UntPlanMobile** wählen, unter *Signing & Capabilities* ein **Team** eintragen
   (bei Bedarf die Bundle-ID `de.untplan.mobile` anpassen).
3. Simulator oder Gerät mit iOS 17 oder neuer wählen und starten (⌘R).
4. Für die Mitteilungen bei Planänderungen: unter *Signing & Capabilities* die Fähigkeit **Background Modes** mit
   **Background fetch** prüfen bzw. hinzufügen. `UntPlanMobile/Info.plist` (per `INFOPLIST_FILE` mit der generierten
   Info.plist zusammengeführt) enthält bereits `UIBackgroundModes` (`fetch`) und `BGTaskSchedulerPermittedIdentifiers`
   (`de.untplan.mobile.planpruefung`). Testen im Debugger: App in den Hintergrund, pausieren und
   `e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"de.untplan.mobile.planpruefung"]`
   ausführen.

## Anmelden

Beim ersten Start fragt die App nach

- **Server-Adresse** – die Adresse von UntPlan Web, z. B. `plan.meine-schule.de` (ohne `https://` wird es ergänzt;
  läuft UntPlan Web unter einem Unterpfad, diesen mit angeben),
- **Benutzername** und **Passwort** des Kontos.

Die Server-Adresse wird in den Einstellungen der App gespeichert, das Passwort nur bei „Passwort merken“ im
Schlüsselbund des Geräts. Die Sitzung läuft über das Anmelde-Cookie von UntPlan Web; ist es abgelaufen, meldet sich
die App mit dem gemerkten Passwort selbst wieder an.

## Mitteilungen bei Planänderungen

Nur Lehrkräfte (`Dienste/Planmitteilungen.swift`): Beim Öffnen und im Hintergrund (BGAppRefreshTask, frühestens alle
30 Minuten) vergleicht die App den eigenen Plan der aktuellen und nächsten Woche mit dem zuletzt gesehenen Stand und
meldet Entfall, Vertretung, Raumänderung, neue Stunden und Prüfungen als lokale Mitteilung (ab vier Änderungen
gebündelt). Antippen öffnet den Tag im Plan. Schalter unter „Mehr“ → „Einstellungen“.

## App-Symbol

Das App-Symbol ist das Monogramm aus `design/logo/monogramm.svg` (weißes „U“ auf Marine-900, flächig; iOS rundet die
Ecken selbst). Neu erzeugen (hell, dunkel, getönt, je 1024 px) mit

```
cd ios
python3 Gestaltung/appicon_rendern.py UntPlanMobile/Assets.xcassets/AppIcon.appiconset /tmp/vorschau.png
```

(benötigt nur Pillow).

## Hinweise

- UntPlan Web muss per **HTTPS** erreichbar sein. iOS blockiert unverschlüsselte Verbindungen (App Transport
  Security); für Tests im eigenen Netz lässt sich in Xcode eine Ausnahme (`NSAppTransportSecurity`) ergänzen.
- Alle ändernden Aufrufe senden den Kopf `X-UntPlanWeb: 1`, den UntPlan Web als Schutz verlangt.

## Genutzte Endpunkte (Auswahl)

| Methode | Pfad | Zweck |
|---|---|---|
| POST | `/api/app/anmelden` | Anmeldung `{login, passwort}`, setzt das Cookie |
| POST | `/api/app/abmelden` | Abmelden |
| GET | `/api/app/sitzung` | Schule, Benutzer, ungelesene Mitteilungen |
| GET | `/api/app/heute` | Seite „Heute“ (Stunden, Nachrichten, Termine …) |
| GET | `/api/app/plan?typ=&element=&datum=` | Wochenplan (Zeitraster, Tage, Karten) |
| GET | `/api/app/elemente` | Klassen, Lehrkräfte, Räume für die Planauswahl |
| GET | `/api/app/mitteilungen?ordner=` | Posteingang, `gesendet` bzw. `entwuerfe` |
| POST | `/api/app/mitteilungen/{id}/gelesen` | Als gelesen markieren |
| DELETE | `/api/app/mitteilungen/{id}` | Mitteilung löschen |
| GET | `/api/app/profil` | Profil und iCal-Adresse |

## Ordner

```
ios/
├── UntPlanMobile.xcodeproj
├── project.yml                  XcodeGen-Alternative
├── Gestaltung/appicon_rendern.py App-Symbol aus dem Monogramm
└── UntPlanMobile/
    ├── UntPlanMobileApp.swift   Einstieg
    ├── Modelle/                 Codable-Modelle der API, nachsichtige Dekodierung
    ├── Dienste/                 API-Client, Sitzungszustand, Kachelbau, Schlüsselbund, Datumsformate, Mitteilungen
    ├── Ansichten/               Heute, Plan, Stundendetails, Postfach, Mehr, Anmeldung, Konten, Abwesenheiten,
    │                            Entschuldigungen, Sprechtag; Farben und gemeinsame Bausteine
    └── Assets.xcassets          App-Symbol, Akzentfarbe Marine (hell und dunkel)
```
