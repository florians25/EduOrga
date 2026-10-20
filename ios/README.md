# EduOrga für iOS

iPhone- und iPad-App **EduOrga** (SwiftUI) – *Einfach mehr Schulalltag.* Marke siehe `design/MARKE.md`.

> **Stand:** Die App ist **noch nicht im App Store veröffentlicht**. Bis dahin wird sie mit Xcode aus diesem Ordner gebaut
> (siehe „Bauen“); für den Schulalltag steht [EduOrga Mobile](../mobile/README.md) (PWA) bereit. Eine Android-App ist in
> Arbeit. Bildschirmfotos für die Website: [`docs/bilder/`](docs/bilder/README.md).

**Eine App für alle Schulen:** EduOrga soll es zentral im App Store geben; jede Schule betreibt ihr EduOrga (Web) selbst.
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
  Hintergrund `#F5F7F8`, Text `#24363B`. Statusfarben: **jede Änderung Grün** `#2f855a` für
  Balken/Linien (Kennzeichen `#e6f4ea` mit Schrift `#1d5c3a`, 7,0 : 1; kleine grüne Schrift `#267349`, ≥ 5 : 1 – `#2f855a`
  erreicht auf `#e6f4ea` nur 4,0 : 1; dunkel `#5fc48c`/`#1e3a29`/`#a8e6c1`), **Rot `#b42318` nur für den Entfall**
  (Kennzeichen `#fdecea`, 5,8 : 1), **offene Vertretung neutral grau** (Kennzeichen `#ebeef2`, Schrift `#4d5866`, 6,2 : 1),
  Mitteilung Hellgelb, **Termin Magenta** `#a3347c`, Prüfung Bernstein `#a15c07`, Ferien Blau `#2f6f9f`.
- **Planraster und Stundenkarten (Woche, Tag, Zeitachse)** – „Stundenkarte mobil (v5)“ (gleiche Karte wie Web/PWA,
  `design/DESIGN.md`): hellgraue Rasterfläche (`#edf1f2`, dunkel `#0b0f13`), **eine kompakte Zeile je Stunde, alle
  gleich hoch** (verfügbare Höhe ÷ Stunden bis zur letzten belegten, mindestens der 6. – aber nie höher als nötig:
  iPhone hochkant 52–62 pt, breite Flächen bis 88 pt; die Dichte Kompakt/Normal/Komfortabel skaliert), Pausen als Band (ab 15 Minuten 12 pt, kürzere 3 pt), Doppel- und Blockstunden über ihre
  Zeilen samt Band.
  - **Zeitspalte** (38 pt, mit Dynamic Type): Beginn oben, **Stundennummer groß in der Mitte**, Ende unten.
  - **Tageskopf:** Datum groß „17.11“, darunter der Wochentag „Mo“, zentriert; heute in Petrol mit 2-pt-Linie; ein
    Punkt zeigt Änderungen (grün) bzw. Entfall (rot). Antippen öffnet den Tag.
  - **Karte:** füllt die Zelle mit gleichmäßigen Abständen (1,5 pt oben/unten, 3 pt zwischen den Spalten), **feste
    Breite und Höhe, Inhalt beschnitten – nie breiter als die Spalte**. Radius 6, **standardmäßig neutral** (weiß, grauer
    3-pt-Balken links) – Fachfarbe (Balken, leichte Tönung) nur, wenn die Schule dem Fach eine Farbe gegeben hat; kein
    Schatten. Oben links das **Fach fett** (13,5 pt), darunter je eine Zeile **Klasse, Lehrkraft, Raum** (12 pt, Zeilenhöhe
    13,5 pt) – vier kurze Zeilen in rund 60 pt. Alle Zeilen einzeilig, zu lange Texte enden mit „…“.
  - **Kennzeichnung von Änderungen (EduOrga-eigene Formensprache):** durchgehender 3-pt-Balken links in der
    Statusfarbe (keine Schraffur), eine kleine quadratische Statusmarke oben rechts und ein kompaktes **Kennzeichen**
    (Radius 3, getönt mit feiner Kontur, offen gestrichelt) auf der betroffenen Zeile – in Worten, **ohne Pfeile: der
    neue Wert (halbfett), dahinter der bisherige in Klammern und durchgestrichen** (`Wertwechsel` in
    `Kartengestaltung.swift`, dazu `Kartenwert`, `Kartenfach`, `Statuschip`, `Kartenmarke`, `Kachel.statusChip`):
    Vertretung „Gal (G̶o̶r̶)“ · anderer Raum „105 (3̶0̶3̶)“, zusätzlicher Raum „neu B070“ · anderes Fach „BI (M̶U̶)“ · Lehrkraft
    fehlt, Vertretung offen „Abr fehlt“ (grau; **Schüler*innen und Eltern: „Vertretung folgt“** –
    `Kartendarstellung.fuerFamilie`) · Entfall „entfällt“ (rot, **alles durchgestrichen**) · Klasse fehlt „5b fehlt“ +
    „entfällt“ · verlegt „verlegt auf Di 21.10., 6. Std“ bzw. „verlegt von Mo 20.10., 3. Std“ · Zusatzunterricht
    „zusätzlich“ · Mitteilung bzw. Veranstaltung als hellgelber Block. Quelle der Typen: `klassen`/`abwesendeKlassen`,
    `lehrer` und `raeume` (`k`/`alt`/`neu`/`plus`), `fachAlt`, `verlegung` mit `verlegungVon`/`verlegungNach`,
    `zusaetzlich`, `vertretungOffen`, `status` (wie `Plandienst.cs`). Prüfung Bernstein. Das Blatt **„Kennzeichnungen“**
    (in „Auswahl und Filter“, `Legende.swift`) zeigt die Arten nach Bedeutung gruppiert (Unterricht · Geändert · Offen ·
    Entfällt · Hinweise) mit Musterkarte. Weicht die Uhrzeit vom Raster ab (14:05 statt
    14:00), steht die Karte genau nach der Uhrzeit versetzt mit einer Zeile „14:05–14:45“.
  - **Gleichzeitige Stunden:** bis zur eingestellten Zahl („Parallele Stunden nebeneinander“, 1–4, Standard 1)
    nebeneinander (Änderungen zuerst); die übrigen hinter einem weichen Reiter **„+N“** (Petrol hell) innen am rechten
    Rand der letzten sichtbaren Karte – immer innerhalb der Zelle. Antippen öffnet das Blatt „N Stunden zur selben Zeit“.
  - **Veranstaltungen und Termine im Raster** (AG Schulfest 14:15–15:30, Chor, ganztägige Termine) über ihre **echte
    Zeit** (auch ab bzw. bis mitten in einer Stunde) als warmer Block: Titel, Beteiligte, unten die Uhrzeit – **jede Zeile
    einzeilig, zu lange Texte enden mit „…“** (kein Umbruch; voller Text in den Details und für VoiceOver; ebenso in
    Mehrfachplan, Tag, Agenda und den Mustern der Kennzeichnungen). Ohne
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
- **Barrierefreiheit (Regeln für alle Karten und Kennzeichen):**
  - Kontrast WCAG AA (≥ 4,5 : 1) für jede Schrift auf ihrer Fläche (Werte oben); grüne Schrift auf hellem Grund
    `Farben.aenderungSchrift`.
  - Nie nur Farbe: jede Art steht auch in Worten („entfällt“, „fehlt“, „zusätzlich“, „verlegt auf/von“), der bisherige
    Wert in Klammern und durchgestrichen, Entfall zusätzlich ganz durchgestrichen, offen gestrichelt.
  - Kennzeichen mindestens so groß wie die übrigen Zeilen (12 pt, halbfett; Listen `.footnote`).
  - Dynamic Type: Schrift der Rasterkarten wächst mit (`DynamicTypeSize.kartenfaktor`, gedeckelt bei 1,6), die
    Rasterzeilen langsamer (`rasterfaktor`) – bei großen Größen zeigt die Karte weniger Zeilen, **geänderte Zeilen und
    das Kennzeichen zuerst**; Listen und Blätter nutzen Textstile.
  - VoiceOver: je Karte ein ganzer Satz (`Kachel.vorlesetext`, z. B. „3. Stunde, M, Mathematik, 9:45 bis 10:30, Raum
    105 statt 303, Lehrkraft Gal statt Gor, Klasse 7a, Vertretung“; Fach „Fach BI statt MU“; `Wertwechsel.gesprochen`),
    Termine mit Art („Veranstaltung, …“). Die Änderungszeilen der Stundendetails lesen ebenso „Vertretung: Lehrkraft Gal
    statt Gor“. Lokale Mitteilungen schreiben „Raum R201 statt R105“ (dort ist kein Durchstreichen möglich).
  - Tippflächen ≥ 44 pt (Reiter „+N“, Zeiten beim Sprechtag, Vorlagen und Fälligkeit im Klassenbuch).
  - „Bewegung reduzieren“: kein Zoom aus der Kachel (`ZoomZiel`), Ansichtswechsel nur überblendet, Karten beim Drücken
    nur abgedunkelt statt verkleinert.

## Oberfläche

Tab-Leiste mit wenigen, festen Reitern: **Heute · Plan · Postfach · Schule · Profil**. „Profil“ enthält Konten und
Schulen, Termine, Einstellungen (Mitteilungen, Darstellung, Kontaktdaten, Passwort), Info und Abmelden. Die **Suche**
nach Plänen (Klasse, Lehrkraft, Raum) öffnet sich als Blatt über die **Lupe oben rechts** (Heute, Postfach, Schule; im
Plan auf dem iPad oben rechts, auf dem iPhone im Menü des Plannamens) und über den Kurzbefehl „Plan suchen“. **Ein
Treffer (auch Favorit bzw. „Zuletzt geöffnet“) schließt die Suche und zeigt den Plan im Reiter „Plan“ – genau dieselbe
Seite wie „Mein Plan“** (`AppZustand.planZeigen` → `PlanSeite`, keine eigene Ansicht): Woche/Tag/Agenda, Planleiste,
Kennzeichnungen, Filter, Mehrfachauswahl, Stundendetails. Titel „Klasse 5a“ bzw. „Lehrkraft Gal“ / „Raum 105“
(`Planmodell.plantitel`, Stern davor bei Favoriten); zurück links oben (Knopf „Mein Plan“, auf dem iPhone als
Zurück-Pfeil) bzw. „Mein Plan“ im Menü des Titels; Favorit an/aus im Menü des Titels und im Kalendermenü.

- **Einrichtung** – ruhige Einstiegsseite mit Monogramm, Wortmarke und Slogan. Schritt 1: EduOrga-Adresse der Schule
  (Prüfung schon beim Tippen: Format, dann Server und Schulname mit Häkchen bzw. verständlichem Fehler), **QR-Code
  scannen** (AVFoundation; erkennt `untplannext://einrichten?server=…`, Adressen mit `?server=` und reine Adressen),
  **Zuletzt verwendet** (Schulen bleiben auch nach dem Abmelden zur Hand). Schritt 2: Anmeldung mit Benutzername,
  Passwort (zeigen/verbergen) und „Passwort merken“; gespeicherte Konten zum Wechsel.
- **Plan** – Agenda, Woche (Standard) oder Tag. **Oben nur zwei Dinge** (keine Kollision auf 375/393/430 pt): in der
  Mitte der Planname mit Zeitraum („KW 43 · Okt. 2026“, im Tag „Di 20.10.2026“, bei „Nur Änderungen“ mit Kennzeichnung;
  Menü: Mein Plan, bei fremdem Plan Favorit an/aus, Favoriten, Auswahl …, Suchen, Datenstand) und rechts der
  **Kalenderknopf** (Heute, Gehe zu Datum, voriger bzw. nächster Zeitraum; fremder Plan: Favorit). Bei einem fremden
  Plan links oben der Weg zurück zu „Mein Plan“. **Unten die schwebende Planleiste** aus Glas: **Agenda | Woche |
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
- **Stundendetails** (`Neu/Stunde/StundenBuehne.swift`) – zwei Reiter als **Segmentschalter oben im Blatt**
  („Details | Klassenbuch“, kein TabView; der zuletzt gewählte Reiter wird je Rolle auf dem Gerät gemerkt), darüber bei
  gleichzeitigen Stunden deren Auswahl.
  - **Details** – ruhig, im Stil der gruppierten Listen (kein farbiger Kopf, Farbe nur für den Status): **Kopf** Fach
    ausgeschrieben mit Kürzel, Datum, „3. Stunde · 9:45–10:30“, Status, Fortschritt der laufenden Stunde. **Änderung**
    bzw. **Entfall** (nur wenn etwas anders ist) direkt darunter: je Art ein Kennzeichen (Vertretung, Raumänderung,
    Klasse, Fachänderung, Zusätzlich, Verlegt – grün; Entfall rot; Vertretung folgt grau) und rechts „neu (b̶i̶s̶h̶e̶r̶)“
    (neu grün halbfett, bisher in Klammern grau durchgestrichen; VoiceOver „Lehrkraft Gal statt Gor“), Verlegung „von …“
    bzw. „auf …“, dazu
    Vertretungstext bzw. Grund. Danach die **Angaben** (Raum, Lehrkraft, Klasse(n), fehlende Klassen), Hinweis bzw.
    Information/Prüfung, **Online-Unterricht beitreten**, Thema (lesen), **Hausaufgaben** (lesen), Notiz, für
    Lehrkräfte eine Zeile „Klassenbuch: Thema ✓ · Anwesenheit offen · Hausaufgabe –“ (wechselt den Reiter) und „Im Plan
    anzeigen“.
  - **Klassenbuch** – nur Lehrkräfte, nur Stunden mit Unterricht (für Schüler*innen und Eltern ausgeblendet;
    `Neu/Stunde/KlassenbuchReiter.swift`, dieselbe Seite wie „Stunde jetzt“): oben der Stand „Thema ✓/offen ·
    Anwesenheit ✓/offen · Hausaufgabe“ und bei Doppelstunden „Einträge gelten für“; dann
    1. **Thema / Lehrstoff** – Eingabefeld mit Vorschlägen (Themenplan, „Fortsetzung: …“, frühere Themen), **speichert
       automatisch** (1,5 s nach der letzten Eingabe, beim Verlassen des Felds bzw. Reiters) mit Statuszeile
       („Automatisch gespeichert · 10:42“, „Ohne Verbindung gesichert …“, Fehler mit „Erneut speichern“);
    2. **Anwesenheitskontrolle** – großer Knopf mit Zusammenfassung („24 anwesend · 1 abwesend · 1 verspätet“,
       kontrolliert/offen), öffnet die Anwesenheit; Schnellaktion **„Alle anwesend“** (PUT mit leerer Liste wie im Web,
       mit Rückfrage, wenn schon Abwesenheiten eingetragen sind) und die Schnellerfassung (Wischen bzw. Namensraster,
       `SchnellanwesenheitSeite`);
    3. **Hausaufgaben** – Liste, neue Hausaufgabe mit Fälligkeit als Schnellwahl (nächste Stunde · in 1 Woche · Datum ·
       ohne), „Hausaufgaben bearbeiten“;
    4. **Klausur/Prüfung eintragen** (Recht `pruefung.anlegen`) – vorbelegt aus der Stunde;
    5. **Einträge** – heutige Klassenbucheinträge, Vorlagen, eigener Eintrag, alle Einträge;
    6. **Notizen** (für Schüler*innen bzw. Lehrkräfte);
    7. **Verlauf** – die letzten Themen dieses Kurses und der Kursverlauf.
- **Anwesenheit** (Lehrkräfte, wie in EduOrga Web): Kopf „24 / 27 anwesend · 2 abwesend · 1 verspätet“, gemeldete
  Abwesenheiten der Eltern (mit „Als abwesend eintragen“), Abwesenheiten aus der Vorstunde („Für diese Stunde
  übernehmen“), je Schüler*in ein Segmentschalter **Anwesend · Abwesend · Verspätet · Entsch.** (Verspätung mit
  Minuten-Stepper; „Entsch.“ nur mit Recht – öffnet den Entschuldigungsdialog), langes Drücken: Abwesenheit mit Zeitraum,
  früher gegangen, Klassenbucheintrag. Unten **„Alle anwesend“** und **„Anwesenheit bestätigen“**. Gleiche API wie das
  Web: `GET`/`PUT /api/app/klassenbuch/anwesenheit` (jede Änderung sendet den ganzen Stand der Stunde, der Reihe nach;
  ohne Netz in den Schreibpuffer), `POST /klassenbuch/abwesenheit/verlaengern`.
- **Schule** – nur das Wichtigste (Plan, Heute und Postfach sind eigene Reiter):
  - Lehrkräfte: **Klassenbuch** (offene Stunden, Klassenbucheinträge, Hausaufgaben, Abwesenheiten und
    Entschuldigungen), **Unterricht** (Vertretungen, Prüfungen – eintragen, ändern/verlegen, löschen –, Prüfung eintragen), **Melden** (Abwesenheit melden, Meine
    Meldungen, Meine Abwesenheiten), **Elternsprechtag**.
  - Schüler*innen und Eltern: Hausaufgaben, Abwesenheiten und Entschuldigungen (Eltern: Entschuldigungsschreiben als
    PDF), Prüfungen, Vertretungen, Elternsprechtag.
  - **Ausgeblendet** (in EduOrga Web weiter verfügbar; Code bleibt, ist aber nicht mehr verlinkt): Raum-/Ressourcen-
    buchung, Befreiungen, Klassendienste, Sitzplan-Editor (auch in den Stundendetails), Raumtausch in den Details,
    Infocenter-Extras (Neuigkeiten, Termine).
  Rechte aus der Sitzung (`benutzer.rechte`, z. B. `pruefung.anlegen`, `vertretung.*`) blenden Einträge aus; der Server
  prüft zusätzlich.
- **Prüfungen eintragen und ändern** (Lehrkräfte mit Recht „Prüfungen eintragen“, `pruefung.anlegen`;
  `Neu/Schule/Unterrichtsseiten.swift` → `PruefungFormular`, gleiche Endpunkte wie Unterricht → Prüfungen bzw. der
  Prüfungsdialog der Stunde im Web): aus dem Reiter „Klassenbuch“ der Stunde (vorbelegt: Datum, Stunden, Klassen, Raum,
  Lehrkraft als Aufsicht, Fach als Titel) und im Reiter „Schule“ (Liste nach KW: „+“ = neu, Antippen einer eigenen
  künftigen Prüfung = ändern bzw. verlegen, Wischen bzw. Knopf = löschen). Felder: **Art** (`GET /pruefungsarten`, sonst
  Klausur, Klassenarbeit, Test, Prüfung …), **Titel/Thema**, **Datum**, **von/bis Stunde** (Dauer mit Uhrzeit), Klassen,
  Räume, Aufsicht, **Hinweis** (gesendet als „Art: Hinweis“ wie im Web). Neu `POST /meldungen/klausur`, ändern
  `POST /meldungen/klausur/verlegen` (`{alt, neu}`), löschen `POST /meldungen/klausur/loeschen`. **Konflikte** meldet der
  Server (Prüfungssperre „Die Klasse 7a hat in dieser Woche bereits 2 Prüfung(en).“, kein Unterricht, rückwirkend, Raum
  …) – sie stehen rot über dem Knopf; vorab zeigt das Formular, wie viele Prüfungen die gewählten Klassen in dieser
  Woche schon haben.
- **Elternsprechtag** (`/api/app/sprechtag`, wie `web/src/UntPlanWeb/Api/SprechtagApi.cs`): Liste mit Datum, Zeiten,
  Phase und **„Anmeldung bis …“** bzw. „Anmeldung ab …“; Schrift in Textstilen (Dynamic Type), Zeiten als 44-pt-Felder
  mit VoiceOver-Text („Freie Zeit 15:20 Uhr“).
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
  (laufende eigene Stunde ab 10 Minuten vorher, sonst die nächste, sonst bis 45 Minuten danach zum Nachtragen). Die
  Seite ist der Reiter „Klassenbuch“ der Stundendetails (`KlassenbuchReiter`) mit Kopf (Fach, Klasse, Raum,
  Fortschritt). Schnellerfassung der Anwesenheit (`SchnellanwesenheitSeite`) als Liste (nach rechts wischen = anwesend,
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
  frische Antwort da ist, steht oben „Stand hh:mm“. **Stand EduOrga Studio** (`Neu/Gestaltung/Studiostand.swift`): wann
  die Planung die Daten zuletzt übertragen hat – aus der Sitzung `paket.empfangen` bzw. (neuere Server)
  `paket.letzteVertretungen`, der neuere Zeitpunkt gilt –, klar getrennt von der Ladezeit der App („aktualisiert 14:35“):
  auf „Heute“ klein als Fußnote ganz unten („Stand EduOrga Studio: vor 5 Min. · aktualisiert 14:35“, Antippen zeigt
  „Di 20.10., 14:32“), im Plan als Kapsel einige Sekunden nach dem Öffnen bzw. Wochenwechsel und im Menü des Plannamens
  („Datenstand“). Ist der Stand an einem Schultag älter als 24 Stunden, bleibt die Kapsel mit einem ruhigen Hinweis in
  der Warnfarbe stehen. Kein HTTP-Cache (`urlCache = nil`, `reloadIgnoringLocalCacheData`,
  `Cache-Control: no-cache` je Anfrage).
- **Offline:** Lehrstoff, Hausaufgaben, Klassenbucheinträge und Anwesenheit, die ohne Verbindung gespeichert werden,
  landen im **Schreibpuffer** (je Konto) und werden gesendet, sobald das Netz zurück ist (Netzbeobachtung), die App in
  den Vordergrund kommt oder „Senden“ gewählt wird; bis dahin zeigt die App den lokalen Stand („wartet auf
  Verbindung“). Andere Schreibzugriffe melden einen klaren Fehler.
- **Heute** (`Neu/Heute/HeuteView.swift`, `HeuteBereiche.swift`, `HeuteGrafik.swift`, `HeuteKalender.swift`) – ruhiges
  Tagesbriefing nach design/DESIGN.md, Abschnitt 10.1 „Heute“: Kopf „Mittwoch, 14. Oktober“ / „A-Woche · KW 42“ (immer das
  tatsächliche Datum), **Tagesband**, **Fokuskarte** (Streifen oben wie die Karte v7, Restzeit groß), **Tageszahlen** (nur Werte
  über null), Notizen der Schule, **Stunden** als Karten v7 (Fach, darunter Klasse/Lehrkraft und Raum, Änderungen grün),
  **Kalender** (nächste Ferien „Weihnachtsferien · 23.12.–6.1. · in 64 Tagen“, Feiertage), „Mehr anzeigen“, Stand EduOrga Studio.
  **In den Ferien bzw. an freien Tagen** statt leerer Stunden die **Ferienfläche** („Herbstferien · bis Samstag, 31.10. · noch
  13 Tage“, nächster Schultag mit erster Stunde) und darunter die Stunden des nächsten Schultags. Daten: `kalender` aus
  `GET /api/app/heute` (`Schulkalender`, `Freizeitraum`); ältere Server: Feld `ferien` bzw. Wochenplan.
  Entwurf ohne Xcode (HTML-Nachbau 390 × 844): `docs/bilder/entwurf-v7-heute.png`, `entwurf-v7-ferien.png`,
  `entwurf-v7-woche.png` (je auch `-dunkel`).
- **Stundenkarte v7** (`Neu/Plan/Kartengestaltung.swift`, `Kartenmass`, `Klassikstil.streifen`): Radius 2, Linie 1 pt #c9d2d7,
  regulär ohne Farbstreifen, Status als 3-pt-Streifen oben (geändert grün, Entfall rot, Prüfung gelb #b7791f), Tags als reiner
  farbiger Text; Vorlage „Klassisch“ (Fachfarbe `balken-links`/`balken-flaeche`) behält die Leiste links.
- **Postfach, Suche, Profil** – wie bisher (Profil jetzt als eigener Reiter, Suche als Blatt); im Profil zusätzlich **Benachrichtigungen** (E-Mail-Adresse und
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
