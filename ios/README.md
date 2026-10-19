# EduOrga für iOS

iPhone- und iPad-App **EduOrga** (SwiftUI) – *Einfach mehr Schulalltag.* Marke siehe `design/MARKE.md`.

**Eine App für alle Schulen:** EduOrga gibt es zentral im App Store; jede Schule betreibt ihr EduOrga (Web) selbst.
Nach dem Start gibt man die **EduOrga-Adresse der eigenen Schule** ein (oder scannt den QR-Code der Schule) und meldet
sich mit dem Konto der Schule an. Mehrere Konten an verschiedenen Schulen sind möglich.

Technische Kennungen bleiben vorerst unverändert, damit bestehende Installationen weiterlaufen: Ziel, Produkt, Schema
und Swift-Modul `UntPlanNext`, Bundle-ID `de.untplan.next`, URL-Schema `untplannext`, Schlüsselbund-Dienst
`de.untplan.next`, Hintergrund-Aufgabe `de.untplan.next.planpruefung`. Name auf dem Home-Bildschirm:
**EduOrga** (`INFOPLIST_KEY_CFBundleDisplayName`).

Die frühere App „UntPlan für iOS“ (`UntPlanMobile.xcodeproj`) liegt nur noch als Archiv in `archiv/ios-alt/`. **Zum
Bauen immer `ios/UntPlanNext.xcodeproj` öffnen.**

## Voraussetzungen

- **Xcode 26** (iOS-26-SDK, Swift 6.2) – zwingend: Liquid Glass (`glassEffect`, `GlassEffectContainer`,
  `.buttonStyle(.glass)`, `tabBarMinimizeBehavior`, `ToolbarSpacer` …) gibt es nur im iOS-26-SDK. Mit älterem Xcode
  bricht die Übersetzung mit einer klaren Meldung ab (`#error` in `Neu/Gestaltung/Glas.swift`).
- **Zielsystem iOS 18** oder neuer. Auf iOS 18 erscheinen die Glasflächen als Material; alle Glas-APIs stehen hinter
  `if #available(iOS 26.0, *)` in einer einzigen Datei.
- Swift-Sprachmodus 5.

## Bauen

1. `ios/UntPlanNext.xcodeproj` in Xcode 26 öffnen (Projektformat 77 mit synchronisiertem Ordner: jede Datei unter
   `ios/UntPlanNext/` gehört automatisch zum Ziel). Alternativ `xcodegen generate` im Ordner `ios/` (`project.yml`).
2. Ziel **UntPlanNext**, unter *Signing & Capabilities* ein **Team** wählen.
3. Simulator bzw. Gerät mit iOS 18 oder neuer, starten (⌘R). Kommandozeile im Ordner `ios/`:
   `xcodebuild -project UntPlanNext.xcodeproj -scheme UntPlanNext -destination 'generic/platform=iOS Simulator' build`
4. Hintergrund-Prüfung des Plans: *Background Modes* → *Background fetch* (in `Info.plist` eingetragen). Kamera
   (QR-Code der Schule, Fotos als Anhang): `NSCameraUsageDescription` in `Info.plist`.

## Aufbau

```
ios/
├── UntPlanNext.xcodeproj         Xcode-Projekt (synchronisierter Ordner) + geteiltes Schema
├── project.yml                   XcodeGen-Alternative
├── Info.plist                    URL-Schema, Hintergrundmodi, BGTask-Kennung, Kamera
├── Gestaltung/appicon_rendern.py App-Symbol aus design/logo/edo-monogramm-eckig.svg (Pillow)
└── UntPlanNext/
    ├── App/                      Einstieg, Wurzel (Einrichtung/Anmeldung, Tab-Leiste, Startbild)
    ├── Kern/Modelle              Modelle der API (Modelle, SchulModelle, Sprechtag, Entschuldigungen)
    ├── Kern/Dienste              ApiClient (+ ApiErweiterungen), Schreibpuffer (offline), Sitzung/Konten, Kachelbau …
    ├── Funktionen/               Einrichtung (AnmeldungView, QR-Code-Scanner), Postfach, Abwesenheiten,
    │                             Entschuldigungen, Sprechtag, Konten, Profil, Stundendetail-Unterseiten
    ├── Neu/Gestaltung            Glas.swift, Marke (Monogramm, Wortmarke), Fachfarben, Status, Haptik
    ├── Neu/Plan                  Planmodell, Wochenraster (Standard), Tagesliste, Zeitachse, Kartengestaltung,
    │                             Wochenleiste, Kontextmenü, Plan-Reiter
    ├── Neu/Stunde                große Stundenansicht mit Klassenbuch
    ├── Neu/Klassenbuch           offene Stunden, Einträge, Hausaufgaben, Dienste, Befreiungen, Sitzplan
    ├── Neu/Schule                Reiter „Schule“, Prüfungen, Vertretungsplan, Neuigkeiten, Melden, Buchen, Sprechtage
    ├── Neu/Heute, Neu/Suche, Neu/Mehr
    └── Assets.xcassets           App-Symbol (hell, dunkel, getönt), AccentColor
```

## Gestaltung

- **Farben der Marke:** Primärfarbe Petrol `#164C55` (Monogramm, Primärknöpfe der Einrichtung), Akzent `#28747A`
  (`AccentColor`, Knöpfe, Auswahl, Links, Jetzt-Linie – 5,4 : 1 auf Weiß; Dunkelmodus `#5FB0B5`, 6,8 : 1),
  Hintergrund `#F5F7F8`, Text `#24363B`. Statusfarben wie `design/tokens.css`: **Änderung/Vertretung Violett**
  `#6d4fc2`, **Termin Magenta** `#a3347c`, Prüfung Bernstein `#a15c07`, Entfall Rot `#b42318`, Ferien Blau `#2f6f9f`.
- **Planraster und Stundenkarten (Woche, Tag, Zeitachse)** – gleiche Werte wie die PWA (`mobile/README.md`, Abschnitt
  „Planraster“): hellgraue Rasterfläche (`#edf1f2`, dunkel `#0b0f13`), **eine Zeile je Stunde, alle gleich hoch**
  (verfügbare Höhe ÷ Stunden bis zur letzten belegten, mindestens der 6., begrenzt auf 44–104 pt), Pausen als Band
  zwischen den Zeilen (ab 15 Minuten 16 pt in `#e2e8ea`/`#080b0e`, kürzere 3 pt), Doppel- und Blockstunden reichen genau
  über ihre Zeilen samt Band (Karte = Zeilenoberkante + 1 pt, Höhe − 2 pt). Zeitspalte 32 pt mit Nummer, Beginn und
  (ab 52 pt Zeilenhöhe) Ende, bündig zur Zeile. Jetzt-Linie 2 pt am heutigen Tag, 1 pt (35 %) über die Woche, Punkt am
  Rand der Zeitspalte; sie liegt hinter den Karten. **Karte:** weiß (`#1a2128` dunkel), flacher Schatten bzw. dunkle
  Kontur, Radius 4–6 (Schulwert, Standard 5), **4-pt-Balken** innen links (4 pt Abstand, grau `#b4bec4`/`#56626c` ohne
  Fachfarbe, sonst Fachfarbe), drei Zeilen à 14 pt: **Lehrkraft bzw. Klasse fett** · Fach · Raum (Reihenfolge „Fach
  oben“ per Kartendarstellung). Status: Entfall rot durchgestrichen, fein schraffiert, rötliche Linie; Änderung violette
  Linie und Fläche, geänderter Wert violett unterstrichen bzw. „alt → neu“; Prüfung Bernstein-Linie und -Fläche; offene
  Vertretung gestrichelt violett mit „?“; Termin/Veranstaltung gestrichelt. Statuswort unten links nur, wo Platz ist.
  - **Gleichzeitige Stunden** – keine Zählkarte: die vordere Stunde (Änderungen zuerst) bleibt voll breit, oben rechts in
    ihrer Zelle (3 pt Abstand) steht ein kleines, **neutrales „+X“** (hellgraues Rechteck mit feiner Linie, Radius 4 –
    den Status zeigt die Karte selbst). Antippen öffnet das Blatt „X Stunden zur selben Zeit“; eine Zeile antippen
    öffnet ihre Details. In der Tagesliste stehen gleichzeitige Stunden untereinander.
  - **Ganztägige und mehrstündige Termine** (Elternsprechtag, Pädagogischer Tag …, ab drei Stunden bzw. drei Zeitstunden)
    stehen nicht als hohe gestrichelte Säule im Raster, sondern als schmales **Banner im Tageskopf** (Titel und Zeit, bis
    zwei Zeilen, dahinter „+n“) – die Stunden bleiben lesbar.
  - Die schulweite **Kartendarstellung** aus `/api/app/sitzung` (`darstellung`) steuert Inhalte (Fach als Kürzel bzw.
    Name, Raum, Zeile 2, Reihenfolge, Statuswörter), Fachfarbe an/aus, Radius, Balkenbreite und die Statusfläche.
- **Liquid Glass** nur auf der Bedienebene (Tab-Leiste, Wochenleiste der Tagesansicht, Werkzeugknöpfe, Filterchips,
  Knöpfe über dem Kopf der Stundenansicht); Inhalte deckend.
- SF Pro mit Dynamic Type, Abstände im 8-pt-Raster, Tippflächen mindestens 44 pt.

## Oberfläche

Tab-Leiste: **Heute · Plan · Postfach · Schule · Suche**. Profil, Konten und Einstellungen öffnen sich als Blatt über
den **Avatar oben rechts** (im Reiter „Plan“ über das Menü „…“, damit Tag | Woche Platz in der Leiste hat).

- **Einrichtung** – ruhige Einstiegsseite mit Monogramm, Wortmarke und Slogan. Schritt 1: EduOrga-Adresse der Schule
  (Prüfung schon beim Tippen: Format, dann Server und Schulname mit Häkchen bzw. verständlichem Fehler), **QR-Code
  scannen** (AVFoundation; erkennt `untplannext://einrichten?server=…`, Adressen mit `?server=` und reine Adressen),
  **Zuletzt verwendet** (Schulen bleiben auch nach dem Abmelden zur Hand). Schritt 2: Anmeldung mit Benutzername,
  Passwort (zeigen/verbergen) und „Passwort merken“; gespeicherte Konten zum Wechsel.
- **Plan** – Woche (Standard) oder Tag. **Umschalten ohne Untermenü:** Segmentschalter **Tag | Woche** mitten in der
  Navigationsleiste, **zwei Finger** (aufziehen > 1,3 = Tag, zusammenziehen < 0,75 = Woche) und **Tageskopf antippen** =
  dieser Tag; der Wechsel ist animiert (die Woche „zoomt“ in den Tag und zurück). Links oben der Planname mit KW (Menü:
  eigener Plan, Favoriten, weitere Pläne, Suche), rechts „Heute“ und das Menü (Dichte der Woche bzw. Liste/Zeitachse,
  Gehe zu Datum, Profil und Einstellungen). Woche: waagrecht wischen = andere Woche, Antippen = Stundendetails, langes
  Drücken = Kontextmenü (Raumplan, Plan der Lehrkraft/Klasse, Teilen, Online-Link). **Tag:** Liste mit Uhrzeiten links
  und großen, gut lesbaren Karten in derselben Kartensprache, laufende Stunde mit Rahmen, Restzeit und Fortschritt,
  dazwischen die **Jetzt-Linie** mit Uhrzeit, Pausen und Freistunden als kompakte Zeile; waagrecht wischen = Tag,
  schwebende Wochenleiste. Alternativ Zeitachse (Menü).
- **Stundendetails** – ruhige, gegliederte Seite im Stil der gruppierten Listen des Systems (kein farbiger Kopf, keine
  Schmuck-Plaketten): Navigationsleiste mit Datum, Schließen und Teilen; **Titelzeile** (Fachbalken, Fach ausgeschrieben
  und Kürzel, Zeit, Status als Text, Fortschritt der laufenden Stunde); **Angaben** als Schlüssel/Wert (Zeit, Raum,
  Lehrkraft, Klasse, Status, Fach/Verlegung „alt → neu“, fehlende Klassen); Abschnitte Vertretungstext bzw.
  Information/Prüfung, **Online-Unterricht beitreten**, **Thema**, **Hausaufgaben**, **Notizen**, für Lehrkräfte
  **Klassenbuch** (Einträge gelten für Block/Einzelstunde, Anwesenheit, Lehrstoff, Klassenbucheinträge) und „Im Plan
  anzeigen“. Gleichzeitige Stunden: Segmentschalter oben.
- **Anwesenheit** (Lehrkräfte, wie in EduOrga Web): Kopf „24 / 27 anwesend · 2 abwesend · 1 verspätet“, gemeldete
  Abwesenheiten der Eltern (mit „Als abwesend eintragen“), Abwesenheiten aus der Vorstunde („Für diese Stunde
  übernehmen“), je Schüler*in ein Segmentschalter **Anwesend · Abwesend · Verspätet · Entsch.** (Verspätung mit
  Minuten-Stepper; „Entsch.“ nur mit Recht – öffnet den Entschuldigungsdialog), langes Drücken: Abwesenheit mit Zeitraum,
  früher gegangen, Klassenbucheintrag. Unten **„Alle anwesend“** und **„Anwesenheit bestätigen“**. Gleiche API wie das
  Web: `GET`/`PUT /api/app/klassenbuch/anwesenheit` (jede Änderung sendet den ganzen Stand der Stunde, der Reihe nach;
  ohne Netz in den Schreibpuffer), `POST /klassenbuch/abwesenheit/verlaengern`.
- **Schule** – nur das Wichtigste (Plan, Heute und Postfach sind eigene Reiter):
  - Lehrkräfte: **Klassenbuch** (offene Stunden, Klassenbucheinträge, Hausaufgaben, Abwesenheiten und
    Entschuldigungen), **Unterricht** (Vertretungen, Prüfungen, Prüfung eintragen), **Melden** (Abwesenheit melden, Meine
    Meldungen, Meine Abwesenheiten), **Elternsprechtag**.
  - Schüler*innen und Eltern: Hausaufgaben, Abwesenheiten und Entschuldigungen (Eltern: Entschuldigungsschreiben als
    PDF), Prüfungen, Vertretungen, Elternsprechtag.
  - **Ausgeblendet** (in EduOrga Web weiter verfügbar; Code bleibt, ist aber nicht mehr verlinkt): Raum-/Ressourcen-
    buchung, Befreiungen, Klassendienste, Sitzplan-Editor (auch in den Stundendetails), Raumtausch in den Details,
    Infocenter-Extras (Neuigkeiten, Termine).
  Rechte aus der Sitzung (`benutzer.rechte`, z. B. `pruefung.anlegen`, `vertretung.*`) blenden Einträge aus; der Server
  prüft zusätzlich.
- **Elternsprechtag** (`/api/app/sprechtag`, wie `web/src/UntPlanWeb/Api/SprechtagApi.cs`):
  - Eltern: Einladungen und Lehrkräfte je Kind mit freien Zeiten (Überschneidungen markiert), **buchen**
    (`POST /{id}/buchen`), **absagen** mit Grund (`POST /{id}/termine/{tid}/absagen`), **Warteliste** bei ausgebuchten
    Lehrkräften (`POST/DELETE /{id}/warteliste`), **eigener Ablauf** („Meine Termine“ nach Uhrzeit, Raum bzw.
    Online-Link), Termine als PDF (`/{id}/elternplan.pdf`).
  - Lehrkräfte: Zeitfenster (Alle | Gebucht | Frei) mit Buchungen, **sperren/freigeben** einzeln und gesammelt
    (`PUT /{id}/sperren`), **Familien einladen** (`POST/DELETE /{id}/einladungen`), **Termin eintragen**
    (`POST /{id}/termine`), **verschieben** und **Notiz** (`PUT /{id}/termine/{tid}`, Familie wird bei Verschiebung
    benachrichtigt), absagen, **Raum bzw. Online-Gespräch mit Link** (`PUT /{id}/raum`, nur mit `darfRaum`), Teilnahme
    absagen/wieder aufnehmen, Warteliste, Terminplan als PDF.
  - **Erinnerungen** als lokale Mitteilungen (beide Seiten): je Termin 10/15/30/60 Minuten vorher (Menü „Erinnerung an
    Termine“, Standard 15), Lehrkräfte zusätzlich ein Überblick vor dem ersten Termin; bei jedem Laden neu geplant
    (`Kern/Dienste/Sprechtagerinnerung.swift`).
- **Offline:** Lehrstoff, Hausaufgaben, Klassenbucheinträge und Anwesenheit, die ohne Verbindung gespeichert werden,
  landen im **Schreibpuffer** (je Konto) und werden gesendet, sobald das Netz zurück ist (Netzbeobachtung), die App in
  den Vordergrund kommt oder „Senden“ gewählt wird; bis dahin zeigt die App den lokalen Stand („wartet auf
  Verbindung“). Andere Schreibzugriffe melden einen klaren Fehler.
- **Heute, Postfach, Suche, Profil** – wie bisher; im Profil zusätzlich **Benachrichtigungen** (E-Mail-Adresse und
  „Bei neuen Mitteilungen per E-Mail benachrichtigen“) und unter **Darstellung** die Dichte der Woche.

## Einrichtung

Eine App für alle Schulen: EduOrga-Adresse der Schule eingeben bzw. QR-Code scannen (Prüfung über `GET
/api/app/sitzung` → `{eingerichtet, schule: {name}}`), dann anmelden. Einrichtungslink bzw. Inhalt des QR-Codes:
`untplannext://einrichten?server=plan.meine-schule.de` (angemeldet: öffnet Profil → Konten → „Konto hinzufügen“).

> EduOrga ist ein privates Hobbyprojekt eines Auszubildenden zum Fachinformatiker für Systemintegration, entwickelt mit
> Unterstützung von Claude (Anthropic). Jede Schule bzw. jeder Betreiber ist für Einsatz, Betrieb und Datenschutz
> selbst verantwortlich.

## App-Symbol

```
cd ios
python3 Gestaltung/appicon_rendern.py UntPlanNext/Assets.xcassets/AppIcon.appiconset /tmp/vorschau.png
```

Monogramm aus `design/logo/edo-monogramm-eckig.svg`: hell (Petrol-Kachel, weißes „E“, helles Quadrat), dunkel
(durchsichtig, helles „E“) und getönt (Graustufen).
