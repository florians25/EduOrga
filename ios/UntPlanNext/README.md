# UntPlan Next für iOS

Neue, eigenständige iOS-App (SwiftUI, iOS 17+) zu **UntPlan Web** mit neu gestaltetem Stundenplan. Sie wird
**zusätzlich** zur bisherigen App „UntPlan“ (`ios/UntPlanMobile`) installiert, nicht an ihrer Stelle:

| | UntPlan (bisher) | UntPlan Next (neu) |
|---|---|---|
| Xcode-Projekt | `ios/UntPlanMobile.xcodeproj` | `ios/UntPlanNext/UntPlanNext.xcodeproj` |
| Bundle-ID | `de.untplan.mobile` | `de.untplan.next` |
| Name auf dem Home-Bildschirm | UntPlan | UntPlan Next |
| URL-Schema (Einrichtungslink) | `untplan://einrichten?server=…` | `untplannext://einrichten?server=…` |
| Hintergrund-Aufgabe | `de.untplan.mobile.planpruefung` | `de.untplan.next.planpruefung` |
| Schlüsselbund-Dienst | `de.untplan.mobile` | `de.untplan.next` |
| App-Symbol | „UP“ auf Marine-900 | „UP“ auf Marine-600 mit Jetzt-Linie |

Da Bundle-ID, URL-Schema, Schlüsselbund und Einstellungen getrennt sind, laufen beide Apps unabhängig nebeneinander
(eigene Konten, eigene Favoriten, eigene Mitteilungen). Der Code ist eine unabhängige Kopie – Änderungen an
`ios/UntPlanMobile` wirken sich hier nicht aus.

## Bauen

1. `ios/UntPlanNext/UntPlanNext.xcodeproj` in **Xcode 16 oder neuer** öffnen (Projektformat 77 mit synchronisierten
   Ordnern: jede Datei unter `UntPlanNext/` gehört automatisch zum Ziel, nichts muss einzeln eingetragen werden).
   Alternativ mit [XcodeGen](https://github.com/yonaskolb/XcodeGen) im Ordner `ios/UntPlanNext/` `xcodegen generate`
   (`project.yml`; überschreibt das mitgelieferte Projekt).
2. Ziel **UntPlanNext**, unter *Signing & Capabilities* ein **Team** wählen (Bundle-ID `de.untplan.next`, bei Bedarf
   anpassen – sie muss sich nur von der der bisherigen App unterscheiden).
3. Simulator bzw. Gerät mit iOS 17 oder neuer, starten (⌘R). Kommandozeile:
   `xcodebuild -project UntPlanNext.xcodeproj -scheme UntPlanNext -destination 'generic/platform=iOS Simulator' build`
4. Mitteilungen bei Planänderungen (Lehrkräfte): *Background Modes* → *Background fetch* (in `Info.plist` bereits
   eingetragen: `UIBackgroundModes`, `BGTaskSchedulerPermittedIdentifiers`). Für echte Push-Mitteilungen zusätzlich
   *Push Notifications*.

`Info.plist` liegt neben dem Quellordner (nicht darin), damit sie nicht als Ressource kopiert wird; sie wird über
`INFOPLIST_FILE` mit der generierten Info.plist zusammengeführt.

## Aufbau

```
ios/UntPlanNext/
├── UntPlanNext.xcodeproj        Xcode-16-Projekt (PBXFileSystemSynchronizedRootGroup) + geteiltes Schema
├── project.yml                  XcodeGen-Alternative
├── Info.plist                   URL-Schema, Hintergrundmodi, BGTask-Kennung, Kamera
├── Gestaltung/appicon_rendern.py App-Symbol (Pillow)
└── UntPlanNext/
    ├── App/                     Einstieg (UntPlanNextApp), Wurzel (Einrichtung/Anmeldung, Tab-Leiste, Startbild)
    ├── Kern/Modelle, Kern/Dienste   Kopie aus UntPlan für iOS: API-Client, Modelle, Sitzung/Konten, Kachelbau
    │                            (fachliche Logik der Kacheln wie Web/Mobile), Planmitteilungen, Kurzbefehle
    ├── Funktionen/              Kopie: Postfach, Mitteilung verfassen, Abwesenheiten, Entschuldigungen, Sprechtag,
    │                            Konten, Profil/Passwort, Planauswahl, Raumbuchung, Klassenbuch-Unterseiten
    ├── Neu/Gestaltung           Fachfarben, Status, Muster, Haptik, Zoom-Übergang
    ├── Neu/Plan                 Planmodell, Zeitachse, Kacheln, Jetzt-Karte, Wochenleiste, Wochenmatrix, Plan-Reiter
    ├── Neu/Stunde               große Stundenansicht
    ├── Neu/Heute                Heute-Reiter (Jetzt-Karte, Tagesverlauf), Übersichtsseiten
    ├── Neu/Mehr                 Mehr-Reiter, Darstellung
    └── Assets.xcassets          App-Symbol (hell, dunkel, getönt), Akzentfarbe Marine
```

## Oberfläche

- **Heute** – großer Kopf (Wochentag, Datum, Schule), **Jetzt-Karte** (laufende Stunde mit Fortschrittsring und
  Restzeit, Raum, Lehrkraft, Status; in der Pause bzw. vor Unterrichtsbeginn Countdown zur nächsten Stunde; darunter
  „Danach“), der **Tag als Verlauf** (Linie mit Punkten, vergangene Stunden einklappbar, Pausen und Freistunden mit
  Länge), „Heute an der Schule“ und die Übersicht (Termine, Abwesenheiten, Entschuldigungen, Aufsichten, Hausaufgaben,
  Sprechtage, Änderungen).
- **Plan** – Planname oben (Planauswahl: eigener Plan, Favoriten, Klassen, Lehrkräfte, Räume), „Heute“, Menü
  (Tag/Woche, Gehe zu Datum, Dichte der Zeitachse). Darunter die **Wochenleiste**: waagrecht blättern zwischen den Wochen,
  je Tag Datum und eine kleine Belegungsleiste (Stunden in der Fachfarbe, Änderungen petrol, Entfall rot) sowie ein
  Punkt bei Änderungen.
  - **Tag:** die **Zeitachse** mit echter Uhrzeit – volle Stunden und die Stunden des Zeitrasters als Spur links,
    Kacheln in ihrer wirklichen Länge, Pausen als Band („Pause · 15 Min.“), Freistunden gestrichelt („Frei · 3. Stunde“),
    eigene Abwesenheit als graue Fläche, heute die Jetzt-Linie in Marine und oben die Jetzt-Karte. Waagrecht wischen =
    nächster bzw. voriger Schultag; ganztägige Termine und Tageshinweise über der Achse; Ferien als große Fläche.
  - **Woche:** kompakte **Wochenmatrix** (Tage × Stunden) mit Kennzahlen der Woche (Stunden, Änderungen, Entfall,
    Prüfungen); heute hervorgehoben.
  - **Kacheln:** Fachfarbe als Tönung mit Farbpunkt, Fach groß, Raum als Feld rechts, darunter Lehrkraft bzw. Klasse
    (Vertretung „alt → neu“), Status als Plakette mit Symbol. Entfall schraffiert und durchgestrichen, Änderung mit
    Petrol-Rahmen, Prüfung bernsteinfarben, Termin/Veranstaltung violett gestrichelt, „Online“-Plakette, Zeichen für
    Hausaufgabe und Information. Gleichzeitige Stunden nebeneinander (Anordnung wie in UntPlan Web).
- **Große Stundenansicht** – öffnet bildschirmfüllend, ab iOS 18 mit **Zoom aus der angetippten Kachel**
  (`.navigationTransition(.zoom)` mit Verfügbarkeitsprüfung; iOS 17: Vollbild von unten). Kopf in der Fachfarbe
  (bei Entfall rot schraffiert) mit Fach, Fachname, Status, Zeit und Fortschritt der laufenden Stunde; Reiter bei
  gleichzeitigen Stunden; Karten für Änderungen (Fach/Lehrkraft/Raum/Klasse „alt → neu“, Verlegung, Vertretungstext),
  Raum/Lehrkraft/Klasse/Zeit, Prüfung, Information, **Online-Unterricht** (nur lesend – festgelegt in UntPlan Studio –
  mit „Beitreten“), Unterricht (Thema, heute fällige und aufgegebene Hausaufgaben), für Lehrkräfte das **Klassenbuch**
  (Einträge für Block bzw. Einzelstunde, Schüler*innen/Anwesenheit, Lehrstoff, Klassenbucheinträge, Raum ersetzen bzw.
  hinzufügen) und Notizen; „Im Plan anzeigen“ für Raum, Klasse, Lehrkraft.
- **Postfach** – wie bisher (Posteingang, Gesendet, Entwürfe, Verfassen mit Empfängerauswahl und Anhängen).
- **Mehr** – Profil, Konten und Schulen, alle Listen (Termine, Abwesenheiten, Entschuldigungen, Aufsichten,
  Hausaufgaben, Änderungen), Sprechtage, Pläne, Mitteilungen bei Planänderungen, **Darstellung** (Höhe der Zeitachse,
  Startansicht des Plans), Kontaktdaten und Kalender, Passwort, Neuigkeiten, Über, Abmelden.

Haptik bei Auswahl, Tippen und Aktualisieren; Dynamic Type (die Zeitachse wächst mit), Dunkelmodus (alle Farben
dynamisch), VoiceOver-Beschriftungen für Kacheln, Lücken, Jetzt-Karte und Wochenleiste.

## Einrichtung

Wie bisher eine App für alle Schulen: Adresse der UntPlan-Installation eingeben (Prüfung über
`GET /api/app/sitzung` → `{eingerichtet, schule: {name}}`), dann anmelden; mehrere Konten verschiedener Schulen.
Einrichtungslink für diese App: `untplannext://einrichten?server=plan.meine-schule.de`.

## App-Symbol

```
cd ios/UntPlanNext
python3 Gestaltung/appicon_rendern.py UntPlanNext/Assets.xcassets/AppIcon.appiconset /tmp/vorschau.png
```

## Hinweise zur Übersetzung

- Erfordert das iOS-18-SDK (Xcode 16) wegen des Projektformats und der Zoom-Übergänge; Zielsystem bleibt iOS 17
  (`#available(iOS 18.0, *)`).
- Swift-Sprachmodus 5 (wie die bisherige App).
