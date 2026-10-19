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
- **Stundenkarten (Woche, Tag, Zeitachse):** klassisches Grunddesign – in diese Richtung bekannter Stundenplanportale,
  aber eigenständig (eigene Proportionen, Schrift, Statusformen, Wörter und Symbole): hellgrauer Rastergrund mit feinen
  Stundenlinien, schlichte Tagesköpfe, **weiße Karten ohne Rahmen**, Radius 2, schmaler **3-pt-Balken innen links**
  (grau bzw. Fachfarbe), oben links Fach (halbfett), darunter Lehrkraft bzw. Klasse und Raum; Doppelstunden als eine
  hohe Karte. Status: Entfall rot durchgestrichen und schraffiert, Änderung violett (Balken, helle Fläche, „alt →
  neu“), Prüfung Bernstein, offene Vertretung/Termin/Buchung/abgegeben gestrichelt. Die schulweite
  **Kartendarstellung** aus `/api/app/sitzung` (`darstellung`, `web/src/UntPlanWeb/Dienste/Kartendarstellung.cs`)
  steuert Inhalte (Fach als Kürzel bzw. Name, Raum, Zeile 2, Statuswörter), Fachfarbe an/aus und die Statusfläche.
- **Liquid Glass** nur auf der Bedienebene (Tab-Leiste, Wochenleiste der Tagesansicht, Werkzeugknöpfe, Filterchips,
  Knöpfe über dem Kopf der Stundenansicht); Inhalte deckend.
- SF Pro mit Dynamic Type, Abstände im 8-pt-Raster, Tippflächen mindestens 44 pt.

## Oberfläche

Tab-Leiste: **Heute · Plan · Postfach · Schule · Suche**. Profil, Konten und Einstellungen öffnen sich als Blatt über
den **Avatar oben rechts**.

- **Einrichtung** – ruhige Einstiegsseite mit Monogramm, Wortmarke und Slogan. Schritt 1: EduOrga-Adresse der Schule
  (Prüfung schon beim Tippen: Format, dann Server und Schulname mit Häkchen bzw. verständlichem Fehler), **QR-Code
  scannen** (AVFoundation; erkennt `untplannext://einrichten?server=…`, Adressen mit `?server=` und reine Adressen),
  **Zuletzt verwendet** (Schulen bleiben auch nach dem Abmelden zur Hand). Schritt 2: Anmeldung mit Benutzername,
  Passwort (zeigen/verbergen) und „Passwort merken“; gespeicherte Konten zum Wechsel.
- **Plan** – öffnet mit der **Woche als Raster** (Standard; auch bestehende Installationen einmalig umgestellt): Spalten
  Montag–Freitag über die ganze Breite, schmale Stundenspalte mit Nummer und Uhrzeit, die Zeilen so hoch, dass der ganze
  Schultag auf den Bildschirm passt (gerollt wird erst bei sehr vielen Stunden; im Querformat höhere Zeilen und mehr
  Inhalt). Heute hervorgehoben mit **Jetzt-Linie**, große Pausen als Spalt, gleichzeitige Stunden nebeneinander bzw.
  „+n“, Pausenaufsichten als kleine Marke. **Waagrecht wischen = andere Woche**, Aufziehen mit zwei Fingern bzw. Menü
  „Dichte der Woche“ (kompakt, normal, komfortabel), **Antippen = große Stundenansicht**, **langes Drücken =
  Kontextmenü** (Raumplan, Plan der Lehrkraft/Klasse, Teilen, Online-Link), Tageskopf antippen = Tag. Die Tagesansicht
  (Liste bzw. Zeitachse, waagrecht wischen = Tag, schwebende Wochenleiste) bleibt über das Menü erreichbar.
- **Große Stundenansicht** – wie bisher; für Lehrkräfte das Klassenbuch der Stunde: Lehrstoff, Hausaufgaben,
  **Schüler*innen mit Schnellwahl** (Symbol antippen: anwesend, abwesend, verspätet 5–30 Minuten, weitere Angaben;
  Wischen wie bisher, Entschuldigen), **Sitzplan der Stunde** (Anwesenheit am Platz antippen), Klassenbucheinträge,
  Klassendienste, Raum ersetzen bzw. hinzufügen.
- **Schule** – je nach Rolle:
  - Lehrkräfte: **Klassenbuch** (offene Stunden mit Zeitbereich und Lehrstoff per Wischen, Klassenbucheinträge,
    Hausaufgaben, Klassendienste, Abwesenheiten und Entschuldigungen, Befreiungen, Sitzplan), **Prüfungen** (nach
    Kalenderwochen, eintragen, löschen), **Vertretungsplan**, **Melden** (Abwesenheit melden, Prüfung eintragen, Meine
    Meldungen mit Zurückziehen, Meine Abwesenheiten), **Buchen** (Raum bzw. Ressource einmalig oder wöchentlich, Meine
    Buchungen mit Storno einzeln oder als Serie), **Sprechtage** (eigene Zeiten, Familien einladen, Termin eintragen,
    absagen, sperren, Teilnahme absagen, Warteliste, Terminplan als PDF).
  - Schüler*innen und Eltern: Hausaufgaben, Abwesenheiten (Eltern: **Entschuldigungsschreiben als PDF**), Prüfungen,
    Vertretungsplan, Sprechtage (Eltern: Termine buchen, absagen, **Warteliste**, Termine als PDF).
  - Alle: **Neuigkeiten** (Infos der Schule und Neues in EduOrga, mit Gelesen-Vermerk), Termine.
  Rechte aus der Sitzung (`benutzer.rechte`, z. B. `buchung.raum`, `pruefung.anlegen`, `vertretung.*`) blenden
  Einträge aus; der Server prüft zusätzlich.
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
