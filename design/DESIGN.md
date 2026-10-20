# EduOrga Designsystem

> **Marke, Farben, Logo und Namen: siehe [`MARKE.md`](MARKE.md)** – sie gehen bei Widersprüchen diesem Dokument vor
> (u. a. Primärfarbe jetzt Petrol #164C55 statt Marine, klassisches Schulportal-Grunddesign als Vorbild, nicht 1:1).

Verbindliche Gestaltungsgrundlage für **UntPlan Studio** (Planung im Browser), **UntPlan Web** (Portal für Lehrkräfte,
Schüler und Eltern), **UntPlan Mobile** (PWA) und **UntPlan Next** (iOS). Ziel: ein eigenständiges, sachliches und
hochwertiges Erscheinungsbild für den Einsatz an Schulen – erkennbar als *ein* Produkt, ohne Anlehnung an die
Gestaltung anderer Stundenplanprogramme.

## 1. Haltung

* **Werkzeug, nicht Werbung.** Dichte, gut lesbare Informationen; ruhige Flächen; eine Akzentfarbe.
* **Kein „KI-Look“:** keine Logo-Kachel/Würfel, keine farbigen Symbol-Kacheln, keine Symbole vor Menüpunkten, keine
  Begrüßungs- oder Marketingtexte, keine großen Kennzahl-Kacheln mit Symbolen, keine Pillen-Plaketten als Dekoration,
  keine dunkle Seitenleiste mit Symbolspalte. Vorbild sind nüchterne Fachanwendungen (Verwaltung, Finanzen, ERP).
* **Keine Effekte um der Effekte willen:** keine Farbverläufe, kein Glas/Blur, keine Emojis, keine Illustrationen,
  keine „Hero“-Flächen, keine verspielten Animationen. Übergänge höchstens 120 ms (Farbe/Deckkraft).
* **Klare Kanten:** Radius höchstens 6 px – 6 px (Steuerelemente, Karten, Dialoge, Menüs), 4 px (Rasterrahmen), 3 px
  (Schilder, Stundenkacheln). Keine Pillenform für Knöpfe, Felder oder Plaketten. Prüfliste: Abschnitt 9.
  1-px-Linien statt Schatten; Schatten nur für schwebende Ebenen (Menüs, Dialoge).
* **Typografie trägt die Hierarchie**, nicht Farbe: IBM Plex Sans 400/500/600, Ziffern tabellarisch
  (`font-variant-numeric: tabular-nums`) in Tabellen, Zeiten und Rastern.
* **Deutsche Fachsprache, Satzanfang groß, sonst normal** („Neue Abwesenheit“, nicht „NEUE ABWESENHEIT“).
  Großbuchstaben nur in Plaketten (11 px, Laufweite +0,04 em).

## 2. Farben

Grundwerte in `design/tokens.css` (Präfix `--up-`). Marke **Marine** `#234f96` (Hover `#1c3f7a`), Neutraltöne
**Schiefer**. Orange kommt im Produkt nicht vor.

| Rolle | Wert | Verwendung |
|---|---|---|
| Primär | `--up-marine-600` #234f96 | Primärknopf, aktiver Navigationspunkt, Links, Fokus, Auswahl |
| Navigation dunkel | `--up-marine-900` #11264a | Seitenleiste Studio, Kopfleiste Web |
| Hintergrund | #eef1f4 (Web) bzw. `--up-schiefer-50` #f4f6f8 | Seitenhintergrund |
| Fläche | #ffffff | Karten, Tabellen, Raster |
| Rand | `--up-schiefer-200` #dce1e7 | alle 1-px-Linien |
| Text | #232a33 / #4d5866 / #6b7684 | Haupt-, Zweit-, Hinweistext |

**Fachliche Statusfarben** (überall gleich, je mit heller Fläche `…-flaeche`):

| Status | Farbe | Darstellung |
|---|---|---|
| Entfall | `--up-entfall` #b42318 | Kachel weiß, fein schraffiert (45°, 1 px, 9 % Deckkraft), rötliche Linie, Fach rot und durchgestrichen (ohne Wort auf der Kachel) |
| Vertretung / Änderung / Raumwechsel | `--up-aenderung` #0b7a75 | Kachel weiß mit 1-px-Linie in Petrol; neues Kürzel als gefüllte Petrol-Plakette, bisheriges als graue durchgestrichene Plakette davor, hinzugefügtes umrandet, offene Vertretung als gestrichelte „?“-Plakette – keine Wörter wie „Vertretung“ oder „offen“ auf der Kachel |
| Prüfung / Klausur | `--up-pruefung` #a15c07 | Kachel weiß, 1-px-Linie in Bernstein, Plakette „Prüfung“ |
| Veranstaltung / Termin | `--up-termin` #5a4fb3 | weiße Kachel mit gestrichelter neutraler Linie, Plakette „Termin“ |
| Ferien / unterrichtsfrei | `--up-frei` #2f6f9f | ganzflächig hellblau mit Name und Zeitraum |

Dunkelmodus über `:root[data-thema="dunkel"]` bzw. `data-thema="auto"`; nur die Rollen-Variablen wechseln.

## 3. Schrift

IBM Plex Sans (SIL OFL 1.1, Dateien in `design/fonts`, lokal ausgeliefert – nichts aus dem Internet).
Größen: 11 / 12 / 13 / 14 / 16 / 20 / 24 px. Grundgröße Studio 13 px, Web 14 px, Mobile 15 px.
iOS verwendet die Systemschrift (SF Pro) – das ist dort der Standard und wirkt am hochwertigsten.

## 4. Marke und Symbole

* **Markenzeichen „UP“:** U und P teilen sich den mittleren Strich (Strich 6 auf 64er-Raster, eckige Enden), weiß auf
  Marine-900. Dateien: `design/logo/monogramm.svg` (Kachel mit Radius 12 – Favicon, Kopf der Navigation, Anmeldung),
  `monogramm-eckig.svg` (vollflächig, für App-Symbole – iOS/Android runden selbst), `zeichen.svg` (nur das Zeichen in
  `currentColor`). PNG-Symbole für PWA: `node design/logo/icons_rendern.cjs <ordner>`; iOS: `ios/Gestaltung/appicon_rendern.py`.
* **Wortmarke** „UntPlan“ in IBM Plex Sans 600 (`design/logo/wortmarke.svg`), Produktzusatz („Studio“, „Web“, „Mobile“) in
  400 und `--up-text-3`, rechts neben dem Zeichen (Abstand 10 px, Zeichen 26–32 px). Keine weiteren Bildzeichen.
* **Symbole nur funktional:** Schließen, Pfeile/Chevrons, Suchen, Mehr (…), Kalender in Datumsfeldern, Status-Hinweise.
  Linien im Stil Lucide (ISC-Lizenz, `design/LUCIDE-LICENSE.txt`), 16 px, Strich 1,75 px, `currentColor`.
  **Navigation, Menüs, Seitentitel, Karten und Knöpfe mit Text haben keine Symbole.** iOS: SF Symbols nur in der
  Tab-Leiste und für Funktionen.

## 5. Stundenplan-Darstellung (gemeinsam für alle Oberflächen)

Leitbild: nüchterner Fachkalender – gerade Linien, weiße Flächen, Farbe nur als Information, nie als Fläche.

* **Kontrast:** Seite #eef1f4, Rasterfläche weiß, Spaltenköpfe und Zeitspalte #f6f8fa, Kacheln #f6f8fa mit kräftigerer Linie
  #c9d1db – die Kacheln heben sich klar vom Raster ab, ohne Pastellflächen.
* **Raster:** weiße Fläche in einem Rahmen mit Radius 4 px, gerade 1-px-Linien (`--up-linie`). Spaltenköpfe linksbündig
  „Mo 19.10.“ (Wochentag 600, Datum 400 `--up-text-2`); heute: Marine-Text, 2-px-Marine-Linie oben am Kopf und sehr
  leichte Marine-Tönung (≈ 3 %) der Spalte. Zeitspalte links schmal mit Trennlinie: Stundennummer 13 px/600, darunter
  Beginn und Ende 11 px in `--up-text-2`, tabellarische Ziffern. Pausen als schmale graue Bänder (`--up-schiefer-50`)
  ohne Text. Ganztägige Termine im Tageskopf als gestrichelt umrandete Zeile mit Plakette „Termin“.
* **Stundenkachel:** Fläche #f6f8fa, 1-px-Linie #c9d1db, Radius 3 px, Innenabstand 5–6 px oben/unten, 8 px seitlich;
  Überfahren: Fläche #edf0f4. **Standard: keine Fachfarbe als Fläche, kein farbiger Seitenbalken** (andere Varianten nur als ausdrückliche Wahl der Administration, siehe unten): die Fachfarbe steht
  nur als 8-px-Quadrat vor dem Fachkürzel. Kopfzeile: Quadrat, Fachkürzel 13 px/600 `--up-text`, Raum rechtsbündig als
  Kürzel-Plakette (11 px/600, Radius 3 px, Linie #c9d1db, tabellarische Ziffern; in sehr schmalen Kacheln ausgeblendet). Zweite Zeile (unter dem Kürzel eingerückt): Lehrkraft bzw. Klasse
  12 px `--up-text-2`.
* **Stundenkarten konfigurierbar (Web):** Die Administration kann die Kachel schulweit anpassen (Verwaltung | Darstellung
  der Stundenkarten, mit Live-Vorschau). **Standard in Web ist „Klassisch“:** weiße, kompakte Karte (Radius 2 px) ohne Linie mit
  sehr flachem Schatten auf hellgrauem Raster (#edf1f2), Fachfarbe als 4-px-Streifen innen links mit 4 px Abstand zum Rand und
  runden Enden (grau ohne Fachfarbe), drei kurze Zeilen untereinander: Lehrkraft bzw. Klasse 13 px/600 · Fach 12 px · Raum
  12 px `--up-text-2`; Karten füllen die Rasterzelle (1 px Abstand), Doppelstunden als eine Karte. Änderungen und Prüfungen
  zusätzlich in der hellen Statusfläche (Vertretung violett). Eigene Proportionen, Schrift und Statusformen – nur im Grundsatz an
  klassische Stundenplanraster angelehnt, keine übernommenen Maße, Farben, Symbole oder Legenden. Wählbar: Fachfarbe als Streifen
  innen, Balken links (auch mit Tönung), Balken oben (2–6 px), Quadrat, Tönung (6–30 %) oder keine; Fläche neutral, weiß oder
  getönt; Rahmen Schatten, fein, kräftig oder keiner; Radius 0–8 px; Raster hellgrau oder weiß; Dichte kompakt/normal/großzügig;
  Reihenfolge „Lehrkraft/Klasse · Fach · Raum“ oder „Fach und Raum oben“; Fach als Kürzel oder Name, Raum und Lehrkraft/Klasse
  ein-/ausblendbar (Änderungen bleiben sichtbar), Kürzel gefüllt, umrandet oder als Text; Statusfläche und Statuswörter. Vorlagen:
  „Klassisch (Standard)“, „Kompakt“, „Sachlich“ (die oben beschriebene Kachel), „Akzentbalken“, „Farbfläche“, „Minimal“.
  Statuslinien, Schraffur, Durchstreichung und Kürzel-Plaketten sind fest; Listenzeilen und der Kopf der Stundendetails zeigen die
  Fachfarbe passend. Farben kommen aus den Thema-Variablen, damit hell und dunkel ohne Neuladen stimmen.
* **Status** wie in Abschnitt 2 – abzulesen an Linie, Schraffur, Durchstreichung und Kürzel-Plaketten, **nicht an Wörtern**.
  Als Wort (unten links, 10–11 px/600 Großbuchstaben, Laufweite +0,04 em, Statusfarbe, ohne Fläche) erscheint nur, was sich
  sonst nicht ablesen lässt: „Prüfung“, „Termin“, „Buchung“, „Vorgemerkt“, „Verlegt“/„Verlegung“, „Online“ (mit Link-Symbol).
  Die ausführliche Bedeutung steht im zugänglichen Namen der Kachel, in der Kurzinfo und in der Legende; die
  Stundendetails verwenden ganze Wörter.
* **Legende** über dem Raster als Text mit kleinen Mustern (10 px) und Anzahl – keine Pillen.
* **Werkzeugleiste** flach (Trennlinie unten, keine schwebende Karte); Woche/Tag und die Tagauswahl der Tagesansicht als
  Segmentschalter.
* **Stundendetails:** weißer Kopf mit Trennlinie (keine Farbfläche): Fachquadrat und Fach 20 px/600, Plaketten, darunter
  die Angaben als Schlüssel/Wert-Liste (Datum, Zeit, Klasse, Lehrkraft, Raum).
* **Jetzt-Linie:** 1 px Marine-600 mit kleinem Kreis am Zeitspaltenrand, Uhrzeit als kleines Marine-Schild (Radius 2 px).
* **Auswahl/Fokus:** 2-px-Ring Marine-500 außen.

## 6. Bausteine

* **Knöpfe:** Höhe 32 px (dicht 28 px), Radius 6 px, 500. *Primär* Marine-600 weiß; *Sekundär* weiß mit Rand;
  *Still* ohne Rand, Hover `--up-flaeche-hover`; *Gefahr* Text/Rand rot.
* **Eingaben:** Höhe 32 px, Rand `--up-rand-stark`, Fokus Rand Marine-500 + 3-px-Ring Marine-100.
* **Tabellen:** Kopf 12 px/500 `--up-text-2` auf `--up-flaeche-2`, Zeilen 32 px (dicht 28 px), Zeilenwechsel ohne
  Zebrastreifen, Hover `--up-flaeche-hover`, Auswahl `--up-primaer-flaeche`.
* **Segmentschalter** für Ansichtswechsel (Tag/Woche, Klasse/Lehrkraft/Raum).
* **Statuswörter (Plaketten):** Web: nur Text 12 px/500 in der Statusfarbe, ohne Fläche und Rahmen; der Normalzustand
  („aktiv“, „anwesend“, „dokumentiert“) bleibt neutral grau. Ein gefülltes Schild (Radius 3 px) nur für „Heute“/„Jetzt“.
  In Stundenkacheln nur Text (Abschnitt 5).
* **Leere Zustände:** ein sachlicher Satz links in `--up-text-2` (13 px), optional ein kleiner Knopf. Kein Symbol, keine
  Illustration, nicht zentriert, keine großen Leerflächen.

## 7. Aufbau je Produkt

| Produkt | Navigation |
|---|---|
| **Studio** | **EduOrga Studio**: React 18 + TypeScript + Fluent UI v9 (`studio/client`). Fluent-Thema aus der Petrol-Rampe (`studio/client/src/theme.ts`, Stufe 80 = Primär #164C55, 100 = Akzent #28747A), Neutraltöne Schiefer mit kräftigen Linien (#c9d1db, Stroke1 #b4bec8), Seitenhintergrund #F5F7F8, Text #24363B; eigenes dunkles Thema (Schiefer mit Petrolstich, Flächen #10161a/#141b1f/#182126, Linien #37434b, Text #e7ecee), Thema wird vor dem ersten Zeichnen gesetzt (`public/thema.js`, kein weißes Aufblitzen). Studio-Ergänzungen zu den Tokens in `studio/client/src/stile/thema.css`. Seitenbasierte Web-Anwendung (eine Seite je Aufgabe, Adresse in der URL). **Seitenleiste in Primärfarbe** (dunkel: #0e2a2f) mit weißer Schrift, Linien-Symbolen nur vor den Bereichen; Zeilen über die ganze Breite, eckig, gewählt = leicht hellere Zeile + 3-px-Kante links in der Modusfarbe + Schrift 600, keine Pillen. **Kopfleiste** weiß: Monogramm + Wortmarke „**Edu**Orga Studio“, Schuldatei, Modus als zwei schlichte Textreiter mit 3-px-Unterstrich in der Modusfarbe (keine Symbole, kein Rahmen), Rückgängig/Speicherstand, Suche (Strg+K), Konto. **Modusfarbe:** Stundenplanung Petrol #28747a, Vertretungsplanung Indigo #3b4a8f (dunkel #4f9298 / #7f8fe0) – Unterstrich des Modusreiters, 2-px-Linie über dem Seitenkopf, Kante des gewählten Navigationspunkts; sonst keine Flächen in Modusfarbe. **Seitenkopf** grau (#eef1f4) mit Bereich als schlichter Text (12 px, `--up-text-3`, ohne Quadrat/Großbuchstaben) und Titel 20 px, darunter die Werkzeugleiste auf derselben Fläche; Inhalt weiß; Kopfzeilen der Bereiche (#e6eaee) und Tabellenköpfe (#e9edf0) deutlich grau; Karten weiß mit 1-px-Linie auf grauem Grund. Umschalter (Tag/Woche) flach: 1-px-Rahmen, gewählt grau mit 2-px-Linie in Modusfarbe; Wochenstreifen als Text, Planungstag unterstrichen. Datumsfelder als Fluent DatePicker (deutsch, Woche ab Montag, Kalenderwochen, Eingabe „19.10.2026“), lange Auswahllisten als durchsuchbare Combobox. Rechteverwaltung als Matrix Gruppe × Bereich mit farbigen Stufen-Kennzeichen (Text, ohne Symbole). Arbeitsplätze (Tagesplanung, manuelles Planen, Verlegen und Tauschen) sind fest gestaltete Seiten mit verschiebbaren Trennern. Keine Verläufe, keine Symbolkacheln, keine Großbuchstaben-Plaketten als Dekoration. |
| **Web** (EduOrga Web) | React 18 + TypeScript + MUI v7 (`web/client`), Thema nach `MARKE.md`: Primär Petrol #164C55 (Logo, Navigation, Knöpfe), Akzent #28747A (aktive Bereiche, Links, Fokus), Hintergrund #F5F7F8, Text #24363B, Statusfarben aus diesen Tokens (Änderung Violett #6d4fc2, Termin #a3347c), hell und dunkel (Petrol-Palette, wählbar im Kontomenü). Sachlich wie ein Schulsystem: Knöpfe und Felder Radius 6 px (Höhe 32 px), Karten 6 px mit schlichter Kopfzeile (Titel als Text, 1-px-Linie darunter, keine Tönung), Tabellenköpfe neutral grau, Seitenkopf mit Linie, Segmentschalter mit 1-px-Rahmen, Bearbeiten in Dialogen. **Seitenleiste in Petrol** mit Monogramm und Wortmarke „EduOrga Web“, Linien-Symbolen vor den Bereichen und Unterpunkten als eingerücktem Text; Zeilen über die volle Breite, eckig, aktive Zeile leicht getönt mit 3-px-Kante links und Schrift 600 (keine Pillen, kein Einzug); einklappbar zur Symbolleiste; mobil als Schublade unter einer Petrol-Kopfleiste. Eigene Gliederung: Start · Mein Tag · Stundenpläne · Vertretungen · Unterricht & Prüfungen · Klassenbuch · Kommunikation · Termine & Buchungen · Stammdaten · Verwaltung (alte Adressen bleiben, sprechende Aliase). Datums-/Zeitfelder nur als MUI-Picker mit Beschriftung oben und Mindestbreite. Anmeldung zweigeteilt mit Slogan „Einfach mehr Schulalltag.“ und „Über EduOrga“ (rechtlicher Hinweis). Eigener Stundenplan (Abschnitt 5, Standard „Klassisch“; ohne Fachfarbe immer grauer Balken – Themenfarbe `kachel.balken`, hell #a9b6bb, dunkel #6b8287; gleichzeitige Stunden: erste Stunde über die volle Breite mit kleinem „+X“ rechts oben, Klick listet alle – keine Zählerkarten). Klassenbuch als eigener Bereich mit Unternavigation (Unterricht · Schüler*innen · Klasse; am Desktop Spalte links, sonst Reiterleiste) und Fenster „Unterrichtsstunde“: großes zentriertes Fenster (≈ 94 % × 90 %, Telefon Vollbild), weißer Kopf mit Angaben als Schlüssel/Wert nebeneinander, Stand der Dokumentation als Text („Thema eingetragen · Anwesenheit offen“, Fehlendes in Bernstein, keine Häkchen-Symbole), Reiter Stunde · Anwesenheit · Einträge · Prüfungen · Verlauf (Anzahl als Zweittext-Ziffer, keine Plakette), Inhalt auf grauer Fläche in Bereichen mit schlichter Kopfzeile, Fuß mit Speicherstand (automatisches Speichern, als Text). Anwesenheit als Liste ohne Initialen-Avatare, je Schüler*in ein Segmentschalter mit Text (Anwesend/Abwesend/Verspätet/Früher weg; „Anwesend“ gewählt = neutral grau, nur Abweichungen in Statusfarbe; Symbole nur auf schmalen Bildschirmen statt der nicht gewählten Wörter). Online-Unterricht nur als Schild mit Link. Keine Namen, Symbole oder Grafiken anderer Produkte. |
| **Mobile (PWA)** | Untere Leiste *Heute · Plan · Postfach · Mehr* (Linien-Symbol + Beschriftung, das ist auf Telefonen Standard), große Seitentitel, Listen statt Karten-Kacheln, keine Logo-Kachel. |
| **iOS** (EduOrga, `ios/`; technisch UntPlanNext) | Tab-Leiste des Systems mit wenigen, festen Reitern *Heute · Plan · Postfach · Schule · Profil* (Profil = Konten, Einstellungen, Abmelden), Suche nach Plänen als Blatt über die Lupe oben rechts. Marke EduOrga: Monogramm und Wortmarke, Primär **Petrol** `#164C55`, Akzent/`AccentColor` `#28747A` (dunkel `#5FB0B5`), Hintergrund `#F5F7F8`, Text `#24363B`; Statusfarben wie `tokens.css` (Änderung/Vertretung Violett `#6d4fc2`, Termin Magenta `#a3347c`, Prüfung Bernstein, Entfall Rot, Ferien Blau). Einrichtung als ruhige Einstiegsseite (Logo, Slogan, Adresse mit Prüfung beim Tippen, QR-Code, zuletzt verwendete Schulen). **Plan öffnet mit der Woche als Raster** über die ganze Breite (Mo–Fr, schmale Stundenspalte, Zeilen passen den Schultag in die Bildschirmhöhe, Jetzt-Linie, wischen = Woche, Aufziehen = Dichte); Karten nach „Stundenkarte mobil (v3)“ (Abschnitt 10); auf dem iPad mehrere Pläne nebeneinander; Inhalte nach der schulweiten Kartendarstellung. Tag als Liste bzw. Zeitachse mit denselben Karten. **Liquid Glass** (iOS 26) nur auf der Bedienebene; iOS 18 mit Material. Systemschrift SF Pro mit Dynamic Type, 8-pt-Raster. Die frühere App „UntPlan für iOS“ liegt nur noch als Archiv in `archiv/ios-alt/`. |

## 8. Sprache und Abgrenzung

* Produktname „UntPlan“, Bereiche „Studio“, „Web“, „Mobile“. Keine Namen, Logos, Symbole, Schriften oder
  wörtlich übernommenen Bezeichnungen anderer Hersteller.
* Dateiformate anderer Programme (z. B. GPU-Textdateien) werden nur als **Import/Export-Format** neutral benannt.
* Keine Formulierungen wie „wie im Original“, „Vorbild“ (für fremde Produkte), „vertraute Optik“ in Oberfläche, Code-Kommentaren oder Doku.

## 9. Keine KI-Anmutung – Prüfliste

Verbindlich für Web, Studio, Mobile und iOS. Ziel: wirkt wie eine etablierte, sachliche Fachanwendung (Verwaltung,
Schulsoftware), nicht wie ein generiertes Dashboard. Jede neue Seite und jede Überarbeitung wird mit dieser Liste geprüft
(hell und dunkel, 1440 px und 390 px). In Klammern: wie es in EduOrga Web umgesetzt ist.

**Symbole**
- [ ] Symbole nur, wo sie eine Funktion tragen: Navigation (Seitenleiste, untere Leiste), Symbolknöpfe ohne Text in
      Werkzeugleisten und Tabellenzeilen, Pfeile/Chevrons, Schließen, Suchen, Kalender im Datumsfeld, Dateianhang.
- [ ] **Keine** Symbole vor Überschriften, in Kartenköpfen, vor Beschriftungen („📍 Raum“, „🕑 Zeit“), in Menüeinträgen,
      in Reitern, in Statuswörtern oder in Knöpfen mit Text (kein „+ Neu“, kein „⬇ Bericht“). Ausnahme: „Zurück“-Pfeil.
- [ ] Keine Symbol-Kacheln (Symbol auf farbigem Quadrat/Kreis), keine „Sparkle“-/Konfetti-/Kaffeetassen-Symbole.
- [ ] Symbole einfarbig (`currentColor`, Zweittext); Rot nur beim Überfahren eines Löschknopfs (Thema: `MuiIconButton.colorError`).
- [ ] Keine Häkchen-Kreise als Status („✓ Thema eingetragen“) – Status ist Text; Wahr/Falsch-Spalten dürfen ein neutrales Häkchen zeigen.

**Personen**
- [ ] Keine Initialen-Avatare in Listen, Tabellen, Anwesenheit, Sitzplan, Postfach oder Empfängerauswahl. Einziger Ort:
      Kontomenü der Kopf-/Seitenleiste (und iOS-Profil). Namen als Text, Zusatz (Login, Klasse) als Zweittext.

**Flächen, Karten, Abstände**
- [ ] Radius ≤ 6 px überall (Karten, Dialoge, Menüs, Knöpfe, Felder); nie Pillenform.
- [ ] Eine Schattenstufe – nur für schwebende Ebenen (Menü, Popover, Dialog, Hinweis-Toast). Karten, Tabellen und
      Kacheln haben 1-px-Linien, keinen Schatten, keinen Hover-Schatten, kein „Anheben“.
- [ ] Abschnitte: Titel als Text (14–15 px/600) mit 1-px-Linie darunter, **ohne** getöntes Kopfband und ohne Symbol
      (`Abschnitt`, `Bereichskarte`, `Karte`). Tabellenköpfe neutral grau (`flaechen.kopf`), keine Petrol-/Pastelltönung.
- [ ] Keine Karten in Karten; Filterleisten sind eine Zeile über der Tabelle, keine eigene Karte (`Seite filter`).
- [ ] Keine Kennzahl-Kacheln (große Zahl in Kasten). Zahlen als Textzeile über der Tabelle: „**5** alle · **2** Lehrkraft“
      (`Kennzahl`/`Kennzahlen`), klickbar als Filter mit 2-px-Unterstrich für die Auswahl.
- [ ] Keine Startkacheln mit Symbol, Titel und Pfeil („Was möchten Sie tun?“) – stattdessen eine Linkliste mit Beschreibung.
- [ ] Keine Kalenderblatt-Datumskacheln („19 / Okt“) in Listen; Datum als Text in fester Spalte („Mo 19.10.“, `DatumKachel`).
- [ ] 8-px-Raster: Abstände 4 / 8 / 12 / 16 / 24 px (MUI-Einheiten 0,5 / 1 / 1,5 / 2 / 3); keine 5-, 10-, 20-px-Werte.
      Innenabstand von Abschnitten 16 px, Zeilenhöhe Tabellen 32–36 px.
- [ ] Leere Zustände: ein Satz links, kein großes Symbol, keine zentrierte Leerfläche (`Leer`).
- [ ] Erfolgsseiten (z. B. nach dem Buchen): Überschrift, Angaben, Knöpfe – kein großer Haken, nichts zentriert.

**Farbe**
- [ ] Neutrale Grautöne für Flächen und Linien; Petrol nur für Bedienung (Primärknopf, Link, Fokus) und Auswahl
      (gewählte Zeile, gewählter Reiter/Segment).
- [ ] Statusfarben sparsam und nur als **Text** (Statuswort, Zahl): keine bunten Pillen, keine Pastellflächen
      für Hinweise; der Normalzustand ist grau („aktiv“, „Anwesend“, „Vollzugriff“), nur Abweichungen sind farbig.
- [ ] Höchstens eine Statusfarbe pro Zeile; nie mehrere farbige Plaketten nebeneinander.
- [ ] Hinweise (`Alert`): weiße Fläche, 1-px-Linie, 3-px-Kante links in der Statusfarbe; keine vollflächig getönten Kästen.
- [ ] Mehrere gefüllte Primärknöpfe auf einer Seite vermeiden – in Listen/Karten „Buchen“ usw. als umrandeter Knopf.

**Zahlen, Plaketten, Reiter**
- [ ] Keine Zähler-Plaketten in Überschriften und Reitern; Anzahl als Zweittext-Ziffer („Einträge 2“), Warnzahl rot als Text.
- [ ] Kein „offen“-Schild an jeder Zeile; offener Zustand als kurzes Wort in Bernstein, nur wo es eine Entscheidung auslöst.
- [ ] Glocke/Posteingang dürfen eine kleine Zahl als Badge zeigen (Funktion: ungelesen).

**Schrift und Ton**
- [ ] Seitentitel 20 px/600, Abschnitte 14–15 px/600, Text 13–14 px/400–500; kein 700, keine Großbuchstaben-Überschriften
      (auch nicht als „Overline“), keine Laufweite für Überschriften.
- [ ] Namen in Tabellen 500, nicht 600; Hervorhebung über Position und Spalte, nicht über Fettdruck.
- [ ] Keine Begrüßung („Guten Morgen, …“), kein Marketington, keine Ausrufezeichen, kein „Alles erledigt“, kein Emoji.
      Seitentitel ist der Name der Seite („Start“), darunter eine sachliche Tageszeile.
- [ ] Meldungen sachlich im Perfekt/Passiv: „Gespeichert.“, „Keine offenen Stunden.“, „3 Termine gespeichert.“

**Aufbau**
- [ ] Linksbündig, kein zentrierter Inhalt, keine Hero-Köpfe, keine schwebenden Aktionsknöpfe (FAB).
- [ ] Segmentschalter (1-px-Rahmen, Radius 6 px, Auswahl leicht getönt) nur für Ansichtswechsel – nie als Pille.
- [ ] Keine Verläufe, kein Glas/Weichzeichner, keine Animation über 120 ms (Farbe/Deckkraft).
- [ ] Dunkelmodus: Farben ausschließlich über Thema-Variablen (`theme.vars`/Palettenpfade in `sx`), nie feste Hellwerte.

## 10. Stundenkarte mobil (v3)

Verbindlich für iOS (umgesetzt in `ios/UntPlanNext/Neu/Plan/Kartengestaltung.swift` und `Wochenraster.swift`); die PWA
und die mobile Ansicht von EduOrga Web übernehmen sie später mit denselben Werten (px statt pt). Ziel: ein ruhiges,
sofort lesbares Wochenraster, in dem Änderungen ohne Suchen auffallen. Eigene Gestaltung – Grundsätze, keine
übernommenen Maße, Farben, Symbole oder Texte anderer Produkte.

**Raster**
* Zeitspalte 38 pt: Beginn oben (10,5/400, `--up-text-3`), **Stundennummer mittig** (15/600, `--up-text`), Ende unten;
  tabellarische Ziffern. Zeilen gleich hoch (52–112 pt, Schultag passt in die Höhe), Pausen als Band (≥ 15 min 12 pt,
  sonst 3 pt) in `--up-schiefer`-Grau, Rastergrund #edf1f2 (dunkel #0b0f13).
* Tageskopf 42 pt, zentriert: **Datum „17.11“ 15,5/700**, darunter Wochentag „Mo“ 12/400 `--up-text-2`. Heute: Petrol
  (Akzent) mit 2-pt-Linie unten und ≈ 6 % Petrol-Tönung der Spalte. Punkt 5 pt neben dem Wochentag: violett =
  Änderungen, rot = Entfall am Tag.

**Karte**
* Füllt die Zelle: 1,5 pt Abstand oben/unten, 3 pt zwischen den Spalten. **Feste Breite = Spaltenbreite**, Inhalt wird
  beschnitten – eine Karte ist nie breiter als ihre Spalte.
* Radius 6, keine Schatten, feine Kontur (0,5 pt, 6 % Petrol-Schwarz). Fläche weiß mit **Tönung der Fachfarbe**
  (Deckkraft nach Kartendarstellung, Standard 12 %; dunkel × 1,8, höchstens 40 %). **Balken 4 pt** in der Fachfarbe,
  bündig am linken Rand, von der Kartenform beschnitten (ohne Fachfarbe grau #b4bec4).
* Inhalt oben links, Einzug 6 pt nach dem Balken: **Fach 14,5/700**, darunter je eine Zeile 12,5/400 `--up-text-2`:
  Klasse, Lehrkraft, Raum (bzw. Anlass). Unter 56 pt Breite: 12,5 bzw. 11. Zeilen, die nicht passen, entfallen von
  unten; Änderungen stehen immer da, auch wenn die Schule Raum bzw. Zeile 2 ausblendet.

**Status – sofort erkennbar**
* **Änderung** (Vertretung, Raum-/Lehrerwechsel, Zusatzstunde): Balken **schräg schraffiert in Violett** #6d4fc2,
  1-pt-Linie Violett 55 %, mit Statusfläche helles Violett #f1edfb statt der Fachtönung. Der geänderte Wert steht als
  **Feld „neu (bisher)“**: Fläche #e3dbfa (dunkel #3a2e66), Schrift #46309a (dunkel #d9cfff), neuer Wert 600, Radius 3,
  Innenabstand 3 pt seitlich – z. B. „Ara (Abr)“; hinzugekommen „+B070“; weggefallen durchgestrichen; offen „ABR ?“.
* **Entfall**: Fläche grau (`--up-flaeche-2`), feine rote Schraffur (10 %), Linie Rot 35 %, Fach `--up-text-3` rot
  durchgestrichen, darunter **„Entfall“ 11,5/600 in Rot**; übrige Zeilen grau durchgestrichen.
* **Offene Vertretung**: gestrichelte violette Linie (3/2), schraffierter Balken, „?“ unten rechts.
* **Prüfung**: Bernstein-Linie und helle Bernstein-Fläche, Wort „Prüfung“ unten links (wenn Platz).
* **Termin / Raumbuchung**: ohne Balken, gestrichelt (Termin Magenta-Titel, Buchung Blau).
* Vergangene Stunden 62 % Deckkraft.

**Gleichzeitige Stunden**
* Die vordere Stunde (Änderung vor regulär, dann die längere, dann der Rang) füllt die Zelle. Ein **Reiter „+N“** sitzt
  innen am rechten Rand, senkrecht mittig: Fläche `--up-primaer-flaeche`, Linie `--up-primaer-rand` 0,75 pt, links
  Radius 4, rechts bündig, Schrift 11,5/600 Akzent. Er ragt nie über die Zelle hinaus. Antippen listet alle Stunden
  dieser Zeit.

**Veranstaltungen**
* AG, Schulfest, Termin: eigener Block über ihre Stunden in **warmem Neutral** (Fläche #f7f1e3, Linie #e2d6bb, Titel
  #5c4a22; dunkel #2a2519 / #4a4130 / #e6d7b0), ohne Balken: Titel 12,5/600, Beteiligte 11,5, Uhrzeit unten 10,5.
  Liegt eine Veranstaltung über Unterricht, steht sie hinter „+N“. Ganztägige bzw. ≥ 3 Stunden lange Termine als
  Banner (20 pt) im Tageskopf.

**Mehrere Pläne (Tablet, Querformat)**
* Leiste über dem Raster mit den gewählten Klassen/Lehrkräften/Räumen (Felder Radius 6, `--up-primaer-flaeche`, „×“
  zum Entfernen, „Hinzufügen …“ umrandet). Jeder Tag teilt sich in Unterspalten je Plan (2 pt Abstand), darüber das
  Kürzel 11/600. Veranstaltungen, zu deren Zeit in keinem gewählten Plan Unterricht liegt, laufen über den ganzen Tag.

**Legende** (Menü „…“): je Zustand eine kleine Musterkarte mit einem Satz; Status nie nur über Farbe – Schraffur,
Durchstreichung, Strichelung und Wörter tragen ihn mit, der zugängliche Name der Karte nennt ihn ausgeschrieben.

**Stundendetails (mobil)**: gruppierte Liste, Farbe nur für den Status. Kopf (Fach ausgeschrieben + Kürzel, Stunde und
Zeit, Status als Wort), dann – nur bei Änderungen – Abschnitt „Änderung“ bzw. „Entfall“ mit „bisher → neu“ je Angabe,
Verlegung und Vertretungstext/Grund, danach die geltenden Angaben (Zeit, Raum, Lehrkraft, Klasse), Hinweis, Online,
Thema, Hausaufgaben, Notizen, Klassenbuch.
