# UntPlan Next für iOS

iOS-App **UntPlan Next** (SwiftUI) zu **UntPlan Web**: Heute, Plan, Postfach und Suche mit **Liquid Glass** (iOS 26)
und der Akzentfarbe **Petrol**. Name auf dem Home-Bildschirm, Ziel, Produkt, Schema und Swift-Modul heißen
durchgehend „UntPlan Next“ bzw. `UntPlanNext`.

Die frühere App „UntPlan für iOS“ (`UntPlanMobile.xcodeproj`) liegt nur noch als Archiv in `archiv/ios-alt/` (nicht
mehr bearbeiten, nur zum Nachschlagen). **Zum Bauen immer `ios/UntPlanNext.xcodeproj` öffnen.** Beide Apps lassen sich
nebeneinander installieren, weil alle Kennungen getrennt sind:

| | UntPlan (archiviert) | UntPlan Next |
|---|---|---|
| Xcode-Projekt | `archiv/ios-alt/UntPlanMobile.xcodeproj` | `ios/UntPlanNext.xcodeproj` |
| Bundle-ID | `de.untplan.mobile` | `de.untplan.next` |
| Name auf dem Home-Bildschirm | UntPlan | UntPlan Next |
| URL-Schema (Einrichtungslink) | `untplan://einrichten?server=…` | `untplannext://einrichten?server=…` |
| Hintergrund-Aufgabe | `de.untplan.mobile.planpruefung` | `de.untplan.next.planpruefung` |
| Schlüsselbund-Dienst | `de.untplan.mobile` | `de.untplan.next` |
| App-Symbol | „UP“ auf Marine-900 | „UP“ auf Petrol mit Jetzt-Linie |

## Voraussetzungen

- **Xcode 26** (iOS-26-SDK, Swift 6.2) – zwingend: Liquid Glass (`glassEffect`, `GlassEffectContainer`,
  `.buttonStyle(.glass)`, `tabBarMinimizeBehavior`, `ToolbarSpacer` …) gibt es nur im iOS-26-SDK. Mit älterem Xcode
  bricht die Übersetzung mit einer klaren Meldung ab (`#error` in `Neu/Gestaltung/Glas.swift`).
- **Zielsystem iOS 18** oder neuer. Auf iOS 18 erscheinen die Glasflächen als Material (`.ultraThinMaterial`) bzw. als
  klassische Knöpfe; alle Glas-APIs stehen hinter `if #available(iOS 26.0, *)` in einer einzigen Datei.
- Swift-Sprachmodus 5 (wie die bisherige App).

## Bauen

1. `ios/UntPlanNext.xcodeproj` in Xcode 26 öffnen (Projektformat 77 mit synchronisiertem Ordner: jede Datei unter
   `ios/UntPlanNext/` gehört automatisch zum Ziel). Alternativ mit [XcodeGen](https://github.com/yonaskolb/XcodeGen) im
   Ordner `ios/` `xcodegen generate` (`ios/project.yml`; überschreibt das mitgelieferte Projekt).
2. Ziel **UntPlanNext**, unter *Signing & Capabilities* ein **Team** wählen (Bundle-ID `de.untplan.next`, bei Bedarf
   anpassen – sie muss sich nur von der der archivierten App unterscheiden).
3. Simulator bzw. Gerät mit iOS 18 oder neuer (Liquid Glass ab iOS 26), starten (⌘R). Kommandozeile im Ordner `ios/`:
   `xcodebuild -project UntPlanNext.xcodeproj -scheme UntPlanNext -destination 'generic/platform=iOS Simulator' build`
4. Mitteilungen bei Planänderungen (Lehrkräfte): *Background Modes* → *Background fetch* (in `Info.plist` bereits
   eingetragen: `UIBackgroundModes`, `BGTaskSchedulerPermittedIdentifiers`). Für echte Push-Mitteilungen zusätzlich
   *Push Notifications*.

`ios/Info.plist` liegt neben dem Quellordner (nicht darin), damit sie nicht als Ressource kopiert wird; sie wird über
`INFOPLIST_FILE = Info.plist` mit der generierten Info.plist zusammengeführt (Anzeigename über
`INFOPLIST_KEY_CFBundleDisplayName = UntPlan Next`).

## Aufbau

```
ios/
├── UntPlanNext.xcodeproj         Xcode-Projekt (PBXFileSystemSynchronizedRootGroup → UntPlanNext/) + geteiltes Schema
├── project.yml                   XcodeGen-Alternative
├── Info.plist                    URL-Schema, Hintergrundmodi, BGTask-Kennung, Kamera
├── Gestaltung/appicon_rendern.py App-Symbol (Pillow)
└── UntPlanNext/
    ├── App/                      Einstieg (UntPlanNextApp), Wurzel (Einrichtung/Anmeldung, Tab-Leiste, Startbild)
    ├── Kern/Modelle, Kern/Dienste    API-Client, Modelle, Sitzung/Konten, Kachelbau (fachliche Logik der Kacheln wie
    │                             Web/Mobile), Planmitteilungen, Kurzbefehle
    ├── Funktionen/               Postfach, Mitteilung verfassen, Abwesenheiten, Entschuldigungen, Sprechtag, Konten,
    │                             Profil/Passwort, Planauswahl, Raumbuchung, Klassenbuch-Unterseiten, Farben
    ├── Neu/Gestaltung            Glas.swift (alle Liquid-Glass-Helfer), Fachfarben, Status, Muster, Haptik, Zoom
    ├── Neu/Plan                  Planmodell, Tagesliste (große Kacheln), Zeitachse, Jetzt-Karte, Wochenleiste aus Glas,
    │                             Wochenmatrix, Kontextmenü der Stunde, Plan-Reiter
    ├── Neu/Stunde                große Stundenansicht
    ├── Neu/Heute                 Heute-Reiter, Übersichtsseiten
    ├── Neu/Suche                 Suche-Reiter (Klassen, Lehrkräfte, Räume)
    ├── Neu/Mehr                  Profil und Einstellungen, Darstellung
    └── Assets.xcassets           App-Symbol (hell, dunkel, getönt), Akzentfarbe Petrol
```

## Gestaltung

- **Farben:** Akzent Petrol `#0b5d57` (heller `#138a80`, Dunkelmodus `#3fb3a6`) – Knöpfe, Auswahl, Jetzt-Linie,
  Fortschritt, App-Symbol, `AccentColor`. Statusfarben bewusst weit vom Petrol entfernt: **Änderung/Vertretung
  Violett** `#6d4fc2`, **Termin/Veranstaltung Magenta** `#a3347c`, Prüfung Bernstein `#a15c07`, Entfall Rot `#b42318`,
  Ferien Blau `#2f6f9f`, Erledigt Grün. Seiten- und Kartenflächen aus dem System (`systemGroupedBackground`,
  `secondarySystemGroupedBackground`), daher passend zu Listen, Blättern und Glas in hell und dunkel.
- **Liquid Glass nach den Human Interface Guidelines:** Glas nur auf der Bedien- und Navigationsebene, die über dem
  Inhalt schwebt – Tab-Leiste (klappt beim Rollen nach unten ein), schwebende Wochenleiste im Plan
  (`GlassEffectContainer`, interaktives Glas), Werkzeugknöpfe (Profil-Avatar mit eigenem Glas über `ToolbarSpacer`),
  Filterchips der Suche, Bedienknöpfe der Jetzt-Karte (`.glass`, „Beitreten“ als `.glassProminent` in Petrol), runde
  Knöpfe über dem Kopf der Stundenansicht. Blätter mit Höhenstufen bekommen das Glas des Systems (kein eigener
  Hintergrund ab iOS 26). Inhalte – Kacheln, Karten, Listen – sind deckend und gut lesbar; keine eigenen Hintergründe
  unter den Leisten, keine Tönungen außer dem Petrol der hervorgehobenen Knöpfe.
- **Typografie und Maße:** SF Pro (Systemschrift) mit Dynamic Type, Abstände im 8-pt-Raster, Radius 12 (Kacheln) bzw.
  16 (Karten), Tippflächen mindestens 44 pt.

## Oberfläche

Tab-Leiste: **Heute · Plan · Postfach · Suche**. Profil, Konten und Einstellungen öffnen sich als Blatt über den
**Avatar oben rechts** in jedem Reiter.

- **Heute** – öffnet sofort (letzter Stand aus dem Speicher, neu geladen im Hintergrund): Datum, Woche, Schule;
  **Jetzt-Karte** (laufende Stunde mit Fortschrittsring und Restzeit bzw. Countdown in der Pause; Glasknöpfe Details,
  Raumplan, Online beitreten; darunter „Danach“), der **Tag als Liste großer Kacheln** (vergangene Stunden eingeklappt,
  Pausen und Freistunden kompakt, „Im Plan“), „Heute an der Schule“ und die Übersicht (Termine, Abwesenheiten,
  Entschuldigungen, Aufsichten, Hausaufgaben, Sprechtage, Änderungen).
- **Plan** – für eine Hand gebaut: öffnet bei heute und rollt zur laufenden bzw. nächsten Stunde. **Waagrecht wischen**
  = nächster bzw. voriger Schultag (Seiten). Unten die **schwebende Wochenleiste aus Glas**: Tag antippen (die
  Markierung gleitet), Pfeile bzw. waagrecht über die Leiste wischen = andere Woche, **nach oben ziehen =
  Wochenübersicht** (Matrix mit Kennzahlen), nach unten = zurück zum Tag. Oben der Planname als Menü (Mein Plan,
  Favoriten, weitere Pläne, Suchen), „Heute“ und das Menü (Tag/Woche, Tag als Liste/Zeitachse, Gehe zu Datum, Höhe der
  Zeitachse). Erneutes Antippen von „Plan“ springt zu heute.
  - **Kacheln:** Fach groß und fett, Raum groß rechts (bei Raumänderung „alt → neu“), darunter Fachname und Lehrkraft
    bzw. Klasse; links ein Balken in der Fachfarbe. **Änderungen sind nicht zu übersehen:** gefüllte Plakette
    (VERTRETUNG, RAUMÄNDERUNG, ENTFALL, PRÜFUNG …), Balken, Rahmen und Tönung in der Statusfarbe; Entfall
    durchgestrichen und schraffiert. Laufende Stunde mit „Jetzt · noch … Min.“ und Fortschritt, nächste Stunde mit
    „in … Min.“. Gleichzeitige Stunden untereinander unter einer Uhrzeit.
  - **Langes Drücken** auf eine Kachel: Details öffnen, Raumplan, Plan der Lehrkraft bzw. Klasse, Teilen,
    Online-Link kopieren.
  - Wahlweise **Zeitachse** mit echter Uhrzeit (Stunden in ihrer Länge, Jetzt-Linie, Jetzt-Karte), ganztägige Termine,
    Tageshinweise, eigene Abwesenheit, Ferien als große Fläche, gesperrte Wochen als Hinweis.
- **Große Stundenansicht** – öffnet mit **Zoom aus der angetippten Kachel** (`.navigationTransition(.zoom)`): Kopf in
  der Fachfarbe (Entfall rot schraffiert) mit Fach, Status, Zeit und Fortschritt; Reiter bei gleichzeitigen Stunden;
  Änderungen „alt → neu“, Raum/Lehrkraft/Klasse/Zeit, Prüfung, Information, Online-Unterricht (nur lesend, „Beitreten“),
  Thema und Hausaufgaben, für Lehrkräfte das Klassenbuch (Einträge, Schüler*innen/Anwesenheit, Lehrstoff,
  Klassenbucheinträge, Raum ersetzen bzw. hinzufügen) und Notizen; Glasknöpfe oben für Im-Plan-anzeigen, Teilen und
  Schließen.
- **Postfach** – Posteingang, Gesendet, Entwürfe, Suche, Verfassen mit Empfängerauswahl und Anhängen, Löschen per
  Wischen.
- **Suche** – eigener Reiter (Rolle „Suche“; ab iOS 26 eigene Glasfläche in der Tab-Leiste mit dem Suchfeld):
  Filterchips aus Glas (Alle · Klassen · Lehrkräfte · Räume), Favoriten (Stern, umsortieren, entfernen), zuletzt
  geöffnete Pläne, alle Pläne nach Art mit Buchstabenregister. Ein Treffer öffnet den Plan direkt in der Suche (mit
  Wochenleiste, Stundenansicht und Stern).
- **Profil** (Avatar) – Profil, Konten und Schulen, alle Listen (Termine, Abwesenheiten, Entschuldigungen, Aufsichten,
  Hausaufgaben, Änderungen), Sprechtage, Mitteilungen bei Planänderungen, **Darstellung** (Tag als Liste/Zeitachse,
  Höhe der Zeitachse, Startansicht des Plans), Kontaktdaten und Kalender, Passwort, Neuigkeiten, Über, Abmelden.

Kurzbefehle am App-Symbol: Heute, Mein Plan, Postfach, Plan suchen (öffnet die Suche). Haptik bei Auswahl, Tippen und
Aktualisieren; Dynamic Type, Dunkelmodus (alle Farben dynamisch), VoiceOver-Beschriftungen für Kacheln, Lücken,
Jetzt-Karte und Wochenleiste (mit Aktion „Wochenübersicht zeigen“).

## Einrichtung

Eine App für alle Schulen: Adresse der UntPlan-Installation eingeben (Prüfung über `GET /api/app/sitzung` →
`{eingerichtet, schule: {name}}`), dann anmelden; mehrere Konten verschiedener Schulen. Einrichtungslink für diese App:
`untplannext://einrichten?server=plan.meine-schule.de` (angemeldet: öffnet Profil → Konten → „Konto hinzufügen“).

## App-Symbol

```
cd ios
python3 Gestaltung/appicon_rendern.py UntPlanNext/Assets.xcassets/AppIcon.appiconset /tmp/vorschau.png
```
