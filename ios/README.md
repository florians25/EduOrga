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
    ├── Neu/Klassenbuch           „Stunde jetzt“ (Schnellerfassung), Kursverlauf, offene Stunden, Einträge,
    │                             Hausaufgaben, Dienste, Befreiungen, Sitzplan
    ├── Neu/Schule                Reiter „Schule“, Prüfungen, Vertretungsplan, Neuigkeiten, Melden, Buchen, Sprechtage
    ├── Neu/Heute, Neu/Suche, Neu/Mehr
    └── Assets.xcassets           App-Symbol (hell, dunkel, getönt), AccentColor
```

## Gestaltung

- **Farben der Marke:** Primärfarbe Petrol `#164C55` (Monogramm, Primärknöpfe der Einrichtung), Akzent `#28747A`
  (`AccentColor`, Knöpfe, Auswahl, Links, Jetzt-Linie – 5,4 : 1 auf Weiß; Dunkelmodus `#5FB0B5`, 6,8 : 1),
  Hintergrund `#F5F7F8`, Text `#24363B`. Statusfarben (EduOrga-Anpassung der Enbrea-Legende): **jede Änderung
  Grün** `#2f855a` (Feld `#e6f4ea`, Schrift `#1d5c3a`; dunkel `#5fc48c`/`#1e3a29`/`#a8e6c1`), **Entfall und Fehlendes Rot**
  `#b42318` (Feld `#fdecea`), Mitteilung Hellgelb, **Termin Magenta** `#a3347c`, Prüfung Bernstein `#a15c07`, Ferien Blau
  `#2f6f9f`.
- **Planraster und Stundenkarten (Woche, Tag, Zeitachse)** – „Stundenkarte mobil (v4)“ (gleiche Karte wie Web/PWA,
  `design/DESIGN.md`): hellgraue Rasterfläche (`#edf1f2`, dunkel `#0b0f13`), **eine kompakte Zeile je Stunde, alle
  gleich hoch** (verfügbare Höhe ÷ Stunden bis zur letzten belegten, mindestens der 6. – aber nie höher als nötig:
  iPhone hochkant 52–62 pt, breite Flächen bis 88 pt; die Dichte Kompakt/Normal/Komfortabel skaliert), Pausen als Band (ab 15 Minuten 12 pt, kürzere 3 pt), Doppel- und Blockstunden über ihre
  Zeilen samt Band.
  - **Zeitspalte** (38 pt, mit Dynamic Type): Beginn oben, **Stundennummer groß in der Mitte**, Ende unten.
  - **Tageskopf:** Datum groß „17.11“, darunter der Wochentag „Mo“, zentriert; heute in Petrol mit 2-pt-Linie; ein
    Punkt zeigt Änderungen (grün) bzw. Entfall (rot). Antippen öffnet den Tag.
  - **Karte:** füllt die Zelle mit gleichmäßigen Abständen (1,5 pt oben/unten, 3 pt zwischen den Spalten), **feste
    Breite und Höhe, Inhalt beschnitten – nie breiter als die Spalte**. Radius 6, **standardmäßig neutral** (weiß, grauer
    4-pt-Balken links) – Fachfarbe (Balken, leichte Tönung) nur, wenn die Schule dem Fach eine Farbe gegeben hat; kein
    Schatten. Oben links das **Fach fett** (13 pt), darunter je eine Zeile **Klasse, Lehrkraft, Raum** (11 pt, Zeilenhöhe
    12,5 pt) – vier kurze Zeilen in rund 60 pt.
  - **Änderungen wie in der Enbrea-Legende** („Änderungstyp | Darstellung“): schraffierter linker Rand in der
    Statusfarbe und ein kleines Feld auf der betroffenen Zeile (`Kartengestaltung.swift`: `Kartenwert`, `Kartenfach`,
    `Statuschip`, `Kachel.statusChip`):
    Klasse fehlt „(5b)“ + „× entfällt“ · Lehrer fehlt ohne Vertretung „(Abr)“ (rot, gestrichelt) · Vertretungsentfall
    „× entfällt“ · Lehrervertretung „+Gal (Gor)“ · Raumänderung „+105 (303)“ · Fachänderung „+BI (MU)“ · verschoben auf
    „× auf Di 21.10. 6 | 12:20“ · verschoben von „⊕ von Mo 20.10. 3 | 09:45“ · Zusatzunterricht „⊕ Zusatz“ · Mitteilung
    bzw. Veranstaltung als hellgelber Block. EduOrga-Anpassungen: alle Änderungen grün, Entfall/Fehlendes rot, bei
    Entfall ist **alles auf der Karte durchgestrichen**. Quelle der Typen: `klassen`/`abwesendeKlassen`, `lehrer` und
    `raeume` (`k`/`alt`/`neu`/`plus`), `fachAlt`, `verlegung` mit `verlegungVon`/`verlegungNach`, `zusaetzlich`,
    `vertretungOffen`, `status` (wie `Plandienst.cs`). Prüfung Bernstein. Die **Legende** (Blatt „Auswahl und Filter“)
    zeigt jeden Änderungstyp mit Musterkarte. Weicht die Uhrzeit vom Raster ab (14:05 statt
    14:00), steht die Karte genau nach der Uhrzeit versetzt mit einer Zeile „14:05–14:45“.
  - **Gleichzeitige Stunden:** bis zur eingestellten Zahl („Parallele Stunden nebeneinander“, 1–4, Standard 1)
    nebeneinander (Änderungen zuerst); die übrigen hinter einem weichen Reiter **„+N“** (Petrol hell) innen am rechten
    Rand der letzten sichtbaren Karte – immer innerhalb der Zelle. Antippen öffnet das Blatt „N Stunden zur selben Zeit“.
  - **Veranstaltungen und Termine im Raster** (AG Schulfest 14:15–15:30, Chor, ganztägige Termine) über ihre **echte
    Zeit** (auch ab bzw. bis mitten in einer Stunde) als warmer Block: Titel, Beteiligte, unten die Uhrzeit. Ohne
    Unterricht zur selben Zeit füllt der Termin die Spalte; mit Unterricht rückt er als schmaler Block an den rechten
    Rand, die überschnittenen Stunden werden schmaler. Ganztägige Termine an Tagen mit Unterricht: schmaler warmer
    Streifen über den ganzen Tag. Kein Banner im Tageskopf. (Der Server liefert Termine derzeit nach Stunden; liefert er
    in `karten[].beginn/ende` genaue Uhrzeiten, nutzt die App sie.)
  - **Mehrere Pläne nebeneinander** (iPhone und iPad, Woche, Tag als Raster, Agenda): Kontrollkästchen im Blatt
    „Auswahl“; oben eine Leiste mit den gewählten Klassen, Lehrkräften bzw. Räumen („×“ entfernt, „Hinzufügen …“
    öffnet die Auswahl, bis zu sechs, auf dem Gerät gespeichert; auf dem iPad immer sichtbar); jeder Tag teilt sich in
    Unterspalten je Plan, darüber das Kürzel. Termine ohne Unterricht in allen gewählten Plänen laufen genau nach ihrer
    Uhrzeit über den ganzen Tag.
  - Die schulweite **Kartendarstellung** aus `/api/app/sitzung` (`darstellung`) steuert Fach als Kürzel bzw. Name,
    Raum und Zeile 2 (Änderungen bleiben sichtbar), Statuswörter, Fachfarbe an/aus, Tönung und Deckkraft, Radius,
    Balkenbreite und die Statusfläche.
- **Liquid Glass** nur auf der Bedienebene (Tab-Leiste, Planleiste, Wochenleiste der Tagesansicht, Werkzeugknöpfe, Filterchips,
  Knöpfe über dem Kopf der Stundenansicht); Inhalte deckend.
- SF Pro mit Dynamic Type, Abstände im 8-pt-Raster, Tippflächen mindestens 44 pt.

## Oberfläche

Tab-Leiste mit wenigen, festen Reitern: **Heute · Plan · Postfach · Schule · Profil**. „Profil“ enthält Konten und
Schulen, Termine, Einstellungen (Mitteilungen, Darstellung, Kontaktdaten, Passwort), Info und Abmelden. Die **Suche**
nach Plänen (Klasse, Lehrkraft, Raum) öffnet sich als Blatt über die **Lupe oben rechts** (Heute, Postfach, Schule; im
Plan auf dem iPad oben rechts, auf dem iPhone im Menü des Plannamens) und über den Kurzbefehl „Plan suchen“.

- **Einrichtung** – ruhige Einstiegsseite mit Monogramm, Wortmarke und Slogan. Schritt 1: EduOrga-Adresse der Schule
  (Prüfung schon beim Tippen: Format, dann Server und Schulname mit Häkchen bzw. verständlichem Fehler), **QR-Code
  scannen** (AVFoundation; erkennt `untplannext://einrichten?server=…`, Adressen mit `?server=` und reine Adressen),
  **Zuletzt verwendet** (Schulen bleiben auch nach dem Abmelden zur Hand). Schritt 2: Anmeldung mit Benutzername,
  Passwort (zeigen/verbergen) und „Passwort merken“; gespeicherte Konten zum Wechsel.
- **Plan** – Agenda, Woche (Standard) oder Tag. **Oben nur zwei Dinge** (keine Kollision auf 375/393/430 pt): in der
  Mitte der Planname mit Zeitraum („KW 43 · Okt. 2026“, im Tag „Di 20.10.2026“, bei „Nur Änderungen“ mit Kennzeichnung;
  Menü: Mein Plan, Favoriten, Auswahl …, Suchen) und rechts der **Kalenderknopf** (Heute, Gehe zu Datum, voriger bzw.
  nächster Zeitraum; Plan aus der Suche: Favorit). **Unten die schwebende Planleiste** aus Glas: **Agenda | Woche |
  Tag**, das Dreieck **„Nur Änderungen“** und **„Auswahl und Filter“** (Blatt: Auswahl mit Mein Plan, Klassen /
  Lehrkräfte / Räume, Suche, Zeile = ein Plan, Kästchen = Mehrfachauswahl; Filter: Aufsichten, Mitteilungen, Ferien
  einblenden, nur Änderungen, nur Ist-Zustand, parallele Stunden nebeneinander, Dichte, Tag als Raster/Liste/Zeitachse,
  Legende). Abkürzungen: **zwei Finger** (aufziehen > 1,3 = Tag, zusammenziehen < 0,75 = Woche) und **Tageskopf
  antippen** = dieser Tag; der Wechsel ist animiert. Woche und Agenda: waagrecht wischen = andere Woche, Antippen =
  Stundendetails, langes Drücken = Kontextmenü (Raumplan, Plan der Lehrkraft/Klasse, Teilen, Online-Link).
  **Agenda:** die Woche als Liste nach Tagen (Stundennummer, Beginn/Ende, Fach, Klasse, Lehrkraft, Raum, Status).
  **Tag:** Standard als Raster (eine breite Spalte, gleichzeitige Stunden nebeneinander), oben die Wochenleiste der
  Schultage; wahlweise Liste mit großen Karten, laufender Stunde mit Restzeit und **Jetzt-Linie**, bzw. Zeitachse;
  waagrecht wischen = Tag.
- **Stundendetails** – ruhige, gut überblickbare Seite im Stil der gruppierten Listen des Systems (kein farbiger Kopf,
  keine Schmuck-Plaketten, Farbe nur für den Status): Navigationsleiste mit Datum, Schließen und Teilen. **Kopf:** Fach
  ausgeschrieben groß mit Kürzel, „3. Stunde · 9:45–10:30“, Status als Wort, Fortschritt der laufenden Stunde.
  **Änderung** bzw. **Entfall** (nur wenn etwas anders ist) direkt darunter: jede geänderte Angabe als „bisher → neu“
  (Lehrkraft, Raum, Klasse, Fach), Verlegung, Vertretungstext bzw. Grund des Entfalls. Danach die **Angaben**, wie sie
  jetzt gelten (Zeit, Raum, Lehrkraft, Klasse(n), fehlende Klassen), Hinweis bzw. Information/Prüfung,
  **Online-Unterricht beitreten**, **Thema**, **Hausaufgaben**, **Notizen**, für Lehrkräfte **Klassenbuch** (Einträge
  gelten für Block/Einzelstunde, Anwesenheit, Lehrstoff, Klassenbucheinträge) und „Im Plan anzeigen“. Gleichzeitige
  Stunden: Segmentschalter oben.
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
- **Klassenbuch „Stunde jetzt“** (`Neu/Klassenbuch/StundeJetzt.swift`): auf „Heute“ ein Tippen für Lehrkräfte
  (laufende eigene Stunde ab 10 Minuten vorher, sonst die nächste, sonst bis 45 Minuten danach zum Nachtragen), auch als
  „Schnellerfassung“ in den Stundendetails. Eine Seite: **Anwesenheit** als Liste (nach rechts wischen = anwesend,
  nach links = abwesend, lange drücken = verspätet mit Minuten 5–45 bzw. Stepper) oder als **Raster großer
  Namensfelder** (Antippen schaltet um), Zähler da/fehlen/verspätet, „Anwesenheit bestätigen“; **Thema** mit
  Vorschlägen (nächstes Thema des persönlichen Themenplans, „Fortsetzung: …“, frühere Themen aus
  `GET /klassenbuch/lehrstoff/vorstunden`); **Hausaufgabe** mit Fälligkeit „Nächste Stunde“ (aus dem eigenen Plan),
  „In 1 Woche“, Datum, ohne; **Klassenbucheinträge** über Vorlagen (Material vergessen, Hausaufgabe fehlt, Lob, Störung,
  Handy, Elterngespräch; für mehrere Personen bzw. die Klasse); **Kursverlauf** (`Kursverlauf.swift`, Themen der
  letzten acht Wochen je KW mit Kontrolle, Fehlzeiten, Hausaufgaben und Themenplan-Haken, über
  `GET /klassenbuch/uebersicht`). Haptik bei jeder Erfassung, alles offline-fähig über den Schreibpuffer. Der
  Themenplan liegt nur auf dem Gerät (der Server kennt keinen Lehrplan). Offene Stunden stehen als Plakette am Reiter
  „Schule“.
- **Aktualität der Plandaten:** Plan und Heute laden beim Erscheinen, beim Ziehen zum Aktualisieren, wenn die App in
  den Vordergrund kommt, bei einer (stillen) Push- bzw. lokalen Mitteilung und beim Antippen einer Mitteilung sofort
  neu (`AppZustand.frischLaden`, `Kachelspeicher.veralten`). Zwischengespeicherte Wochen sind nur Platzhalter: bis die
  frische Antwort da ist, steht oben „Stand hh:mm“. Kein HTTP-Cache (`urlCache = nil`, `reloadIgnoringLocalCacheData`,
  `Cache-Control: no-cache` je Anfrage).
- **Offline:** Lehrstoff, Hausaufgaben, Klassenbucheinträge und Anwesenheit, die ohne Verbindung gespeichert werden,
  landen im **Schreibpuffer** (je Konto) und werden gesendet, sobald das Netz zurück ist (Netzbeobachtung), die App in
  den Vordergrund kommt oder „Senden“ gewählt wird; bis dahin zeigt die App den lokalen Stand („wartet auf
  Verbindung“). Andere Schreibzugriffe melden einen klaren Fehler.
- **Heute, Postfach, Suche, Profil** – wie bisher (Profil jetzt als eigener Reiter, Suche als Blatt); im Profil zusätzlich **Benachrichtigungen** (E-Mail-Adresse und
  „Bei neuen Mitteilungen per E-Mail benachrichtigen“) und unter **Darstellung** die Dichte der Woche.

## Einrichtung

Eine App für alle Schulen: EduOrga-Adresse der Schule eingeben bzw. QR-Code scannen (Prüfung über `GET
/api/app/sitzung` → `{eingerichtet, schule: {name}}`), dann anmelden. Einrichtungslink bzw. Inhalt des QR-Codes:
`untplannext://einrichten?server=plan.meine-schule.de` (angemeldet: öffnet Profil → Konten → „Konto hinzufügen“).

> EduOrga ist ein privates Hobbyprojekt eines Auszubildenden zum Fachinformatiker für Systemintegration, entwickelt mit
> Unterstützung von Claude (Anthropic). Jede Schule bzw. jeder Betreiber ist für Einsatz, Betrieb und Datenschutz
> selbst verantwortlich.

## Datenschutz

- **Keine Analyse-, Werbe- oder Absturzberichtsdienste**, keine Fremdbibliotheken mit Netzzugriff. Die App spricht nur mit
  dem EduOrga-Server der gewählten Schule (HTTPS) und – für Sofort-Benachrichtigungen – mit Apple (APNs).
- **Zugangsdaten** im Schlüsselbund (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`, kein iCloud-Abgleich);
  Serveradresse, Kontenliste, Einstellungen, Planstand und Schreibpuffer in den UserDefaults. **Abmelden** entfernt
  Zugangsdaten, Sitzung, Planstand und nicht gesendete Klassenbuch-Einträge des Kontos (`AppZustand.abmelden`).
- **Mitteilungen datensparsam** (`Kern/Dienste/Datenschutz.swift`): Planänderungen und Sprechtag-Erinnerungen zeigen
  standardmäßig keine Namen, Fächer, Klassen oder Räume („Einzelheiten in der App.“); Profil → Einstellungen →
  *Einzelheiten in Mitteilungen* schaltet die ausführlichen Texte ein. Push-Nachrichten vom Server sind ebenfalls
  standardmäßig allgemein (Schalter in EduOrga Web, *Verwaltung → Datenschutz*).
- **Datenschutzhinweise der Schule**: Link in der Anmeldung (Schritt 2) und unter Profil → Einstellungen
  (`https://<Schule>/datenschutz`).
- **Datenschutz-Manifest** `UntPlanNext/PrivacyInfo.xcprivacy`: kein Tracking, keine Tracking-Domains, UserDefaults mit
  Grund `CA92.1`. Wer weitere Required-Reason-APIs einführt (z. B. Dateizeitstempel, Systemstartzeit), ergänzt das Manifest.
- **App-Store-Datenschutzangaben („Privacy Nutrition Label“), Hinweise für den Herausgeber** – Entscheidung und
  Verantwortung beim Herausgeber der App, **zu prüfen**:
  - Der Herausgeber erhält keine Daten: Alle Inhalte (Konten, Pläne, Klassenbuch, Mitteilungen, Gerätetoken) gehen an
    den Server der jeweiligen Schule, die sie als Verantwortliche verarbeitet. Nach Apples Definition („collect“ = an
    den Entwickler bzw. dessen Partner übermittelt) kommt daher „Keine Daten erfasst“ in Betracht; alternativ die
    Kategorien *Kontaktinformationen* (Name, E-Mail), *Benutzerinhalte* (Nachrichten, Fotos als Anhang), *Kennungen*
    (Benutzer-ID, Gerätetoken) jeweils „mit der Identität verknüpft“, Zweck *App-Funktionalität*, **kein Tracking**.
  - Kein App Tracking Transparency nötig (kein Tracking). Kamera (`NSCameraUsageDescription`) nur für QR-Code und
    Fotos als Anhang.
  - Datenschutzrichtlinie des Herausgebers (Pflichtfeld im App Store) verweist zusätzlich auf die Hinweise der Schule.

## App-Symbol

```
cd ios
python3 Gestaltung/appicon_rendern.py UntPlanNext/Assets.xcassets/AppIcon.appiconset /tmp/vorschau.png
```

Monogramm aus `design/logo/edo-monogramm-eckig.svg`: hell (Petrol-Kachel, weißes „E“, helles Quadrat), dunkel
(durchsichtig, helles „E“) und getönt (Graustufen).
