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
* **Klare Kanten:** Radius höchstens 6 px – 6 px (Steuerelemente, Karten, Dialoge, Menüs), 4 px (Rasterrahmen), 2 px (Stundenkarten
  nach Abschnitt 10, v7), 3 px (Schilder). iOS: Inhaltsflächen 6 pt (Systemlisten behalten den Radius des Systems). Keine Pillenform für Knöpfe, Felder oder Plaketten. Prüfliste: Abschnitt 9.
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
| Entfall | `--up-entfall` #b42318, Fläche #fdecea, Schrift #8f1d14 | **alles durchgestrichen**, rote Fläche, roter 3-px-Streifen oben, „entfällt“ (Abschnitt 10) |
| Jede Änderung (Vertretung, Raum-, Fach-, Lehrerwechsel, Verlegung, Zusatz) | `--up-aenderung` **Grün #2f855a**, Fläche #e6f4ea, Schrift #1d5c3a (dunkel #5cbf86, #15281d / #b5e6c8) | grüne Fläche, grüner 3-px-Streifen oben, grüner Text „neu (b̶i̶s̶h̶e̶r̶)“ (Abschnitt 10); offene Vertretung neutral |
| Prüfung / Klausur | `--up-pruefung` #a15c07 (Schrift), Streifen `--up-pruefung-streifen` #b7791f, Fläche #fdf6d8 | gelber 3-px-Streifen oben, hellgelbe Fläche, Wort „Prüfung“ |
| Veranstaltung / Termin | `--up-termin` #a3347c; Block `--up-ereignis-*` (#f7f1e3 / #e2d6bb / #5c4a22) | warmer Block im Raster über seine Stunden, ohne Kante |
| Mitteilung | `--up-mitteilung-*` (#fdf5c9 / #eddc8c / #5c4a0f) | helle gelbe Notiz im Tageskopf bzw. über der ersten Stunde |
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
  der Stundenkarten, mit Live-Vorschau). **Standard ist „EduOrga Standard“ (Abschnitt 10, Stundenkarte v7, alle Plattformen); „Klassisch“ = bisherige Karte v6 mit Leiste links.** Die frühere Vorlage „Klassisch“: weiße, kompakte Karte (Radius 2 px) ohne Linie mit
  sehr flachem Schatten auf hellgrauem Raster (#edf1f2), Fachfarbe als 4-px-Streifen innen links mit 4 px Abstand zum Rand und
  runden Enden (grau ohne Fachfarbe), drei kurze Zeilen untereinander: Lehrkraft bzw. Klasse 13 px/600 · Fach 12 px · Raum
  12 px `--up-text-2`; Karten füllen die Rasterzelle (1 px Abstand), Doppelstunden als eine Karte. Änderungen und Prüfungen
  zusätzlich in der hellen Statusfläche (Änderung grün). Eigene Proportionen, Schrift und Statusformen – nur im Grundsatz an
  klassische Stundenplanraster angelehnt, keine übernommenen Maße, Farben, Symbole oder Legenden. Wählbar: Fachfarbe als Streifen
  innen, Balken links (auch mit Tönung), Balken oben (2–6 px), Quadrat, Tönung (6–30 %) oder keine; Fläche neutral, weiß oder
  getönt; Rahmen Schatten, fein, kräftig oder keiner; Radius 0–8 px; Raster hellgrau oder weiß; Dichte kompakt/normal/großzügig;
  Reihenfolge „Lehrkraft/Klasse · Fach · Raum“ oder „Fach und Raum oben“; Fach als Kürzel oder Name, Raum und Lehrkraft/Klasse
  ein-/ausblendbar (Änderungen bleiben sichtbar), Kürzel gefüllt, umrandet oder als Text; Statusfläche und Statuswörter. Vorlagen:
  „Klassisch (Standard)“, „Kompakt“, „Sachlich“ (die oben beschriebene Kachel), „Akzentbalken“, „Farbfläche“, „Minimal“.
  Vorlagen jetzt: „EduOrga Standard“, „Klassisch“, „Kompakt“, „Sachlich“, „Akzentbalken“, „Farbfläche“, „Minimal“; Reihenfolge zusätzlich
  „Fach · Klasse · Lehrkraft · Raum“. Die Statusdarstellung nach Abschnitt 10 (Kante, Felder, Durchstreichung, Statusfeld) ist fest; Listenzeilen und der Kopf der Stundendetails zeigen die
  Fachfarbe passend. Farben kommen aus den Thema-Variablen, damit hell und dunkel ohne Neuladen stimmen.
* **Status** wie in Abschnitt 2 – abzulesen an Leiste, Durchstreichung und kurzen Tags (Abschnitt 10).
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
| **Web** (EduOrga Web) | React 18 + TypeScript + MUI v7 (`web/client`), Thema nach `MARKE.md`: Primär Petrol #164C55 (Logo, Navigation, Knöpfe), Akzent #28747A (aktive Bereiche, Links, Fokus), Hintergrund #F5F7F8, Text #24363B, Statusfarben aus diesen Tokens (Änderung Grün #2f855a, Entfall Rot #b42318, Termin #a3347c), hell und dunkel (Petrol-Palette, wählbar im Kontomenü). Sachlich wie ein Schulsystem: Knöpfe und Felder Radius 6 px (Höhe 32 px), Karten 6 px mit schlichter Kopfzeile (Titel als Text, 1-px-Linie darunter, keine Tönung), Tabellenköpfe neutral grau, Seitenkopf mit Linie, Segmentschalter mit 1-px-Rahmen, Bearbeiten in Dialogen. **Seitenleiste in Petrol** mit Monogramm und Wortmarke „EduOrga Web“, Linien-Symbolen vor den Bereichen und Unterpunkten als eingerücktem Text; Zeilen über die volle Breite, eckig, aktive Zeile leicht getönt mit 3-px-Kante links und Schrift 600 (keine Pillen, kein Einzug); einklappbar zur Symbolleiste; mobil als Schublade unter einer Petrol-Kopfleiste. Eigene Gliederung: Start · Mein Tag · Stundenpläne · Vertretungen · Unterricht & Prüfungen · Klassenbuch · Kommunikation · Termine & Buchungen · Stammdaten · Verwaltung (alte Adressen bleiben, sprechende Aliase). Datums-/Zeitfelder nur als MUI-Picker mit Beschriftung oben und Mindestbreite. Anmeldung zweigeteilt mit Slogan „Einfach mehr Schulalltag.“ und „Über EduOrga“ (rechtlicher Hinweis). Eigener Stundenplan (Abschnitt 10, Standard „EduOrga Standard“; ohne Fachfarbe immer graue Kante – Themenfarbe `kachel.balken`, hell #b4bec4, dunkel #56626c; gleichzeitige Stunden: erste Stunde über die volle Breite mit Reiter „+N“ innen am rechten Rand, Klick listet alle – keine Zählerkarten). Klassenbuch als eigener Bereich mit Unternavigation (Unterricht · Schüler*innen · Klasse; am Desktop Spalte links, sonst Reiterleiste) und Fenster „Unterrichtsstunde“: großes zentriertes Fenster (≈ 94 % × 90 %, Telefon Vollbild), weißer Kopf mit Angaben als Schlüssel/Wert nebeneinander, Stand der Dokumentation als Text („Thema eingetragen · Anwesenheit offen“, Fehlendes in Bernstein, keine Häkchen-Symbole), Reiter Stunde · Anwesenheit · Einträge · Prüfungen · Verlauf (Anzahl als Zweittext-Ziffer, keine Plakette), Inhalt auf grauer Fläche in Bereichen mit schlichter Kopfzeile, Fuß mit Speicherstand (automatisches Speichern, als Text). Anwesenheit als Liste ohne Initialen-Avatare, je Schüler*in ein Segmentschalter mit Text (Anwesend/Abwesend/Verspätet/Früher weg; „Anwesend“ gewählt = neutral grau, nur Abweichungen in Statusfarbe; Symbole nur auf schmalen Bildschirmen statt der nicht gewählten Wörter). Online-Unterricht nur als Schild mit Link. Keine Namen, Symbole oder Grafiken anderer Produkte. |
| **Mobile (PWA)** | Untere Leiste *Heute · Plan · Postfach · Mehr* (Linien-Symbol + Beschriftung, das ist auf Telefonen Standard), große Seitentitel, Listen statt Karten-Kacheln, keine Logo-Kachel. |
| **iOS** (EduOrga, `ios/`; technisch UntPlanNext) | Tab-Leiste des Systems mit wenigen, festen Reitern *Heute · Plan · Postfach · Schule · Profil* (Profil = Konten, Einstellungen, Abmelden), Suche nach Plänen als Blatt über die Lupe oben rechts. Marke EduOrga: Monogramm und Wortmarke, Primär **Petrol** `#164C55`, Akzent/`AccentColor` `#28747A` (dunkel `#5FB0B5`), Hintergrund `#F5F7F8`, Text `#24363B`; Statusfarben wie `tokens.css` (jede Änderung Grün `#2f855a`, Termin Magenta `#a3347c`, Prüfung Bernstein, Entfall Rot, Ferien Blau). Einrichtung als ruhige Einstiegsseite (Logo, Slogan, Adresse mit Prüfung beim Tippen, QR-Code, zuletzt verwendete Schulen). **Plan öffnet mit der Woche als Raster** über die ganze Breite (Mo–Fr, schmale Stundenspalte, Zeilen passen den Schultag in die Bildschirmhöhe, Jetzt-Linie, wischen = Woche, Aufziehen = Dichte); Karten nach „Stundenkarte (alle Plattformen)“ (Abschnitt 10); Termine im Raster nach ihrer echten Uhrzeit; Ansichten **Agenda | Woche | Tag** in der schwebenden Planleiste unten (dazu „Nur Änderungen“ und „Auswahl und Filter“), oben nur Planname mit Zeitraum und ein Kalenderknopf; Mehrfachauswahl (mehrere Pläne nebeneinander) auf iPhone und iPad; Inhalte nach der schulweiten Kartendarstellung. Tag als Raster (Standard), Liste bzw. Zeitachse mit denselben Karten. **Liquid Glass** (iOS 26) nur auf der Bedienebene; iOS 18 mit Material. Systemschrift SF Pro mit Dynamic Type, 8-pt-Raster. Die frühere App „UntPlan für iOS“ liegt nur noch als Archiv in `archiv/ios-alt/`. |

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
      (`Kennzahl`/`Kennzahlen`), klickbar als Filter mit 2-px-Unterstrich für die Auswahl. Einzige Ausnahme: die **Tageszahlen**
      auf iOS „Heute“ (Abschnitt 10.1) – eine Fläche mit höchstens vier Werten über null, ohne Symbole und ohne Farbflächen.
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

## 10. Stundenkarte (alle Plattformen)

Verbindlich für **EduOrga Web** (`web/client/src/components/plan/aenderung.ts`, `Kachel.tsx`, `Wochenraster.tsx`, `Legende.tsx`),
**EduOrga Mobile** (PWA, `mobile/.../assets/js/app.js` Abschnitt `AENDERUNG`, `app.css` Abschnitte „Stundenkarte (alle Plattformen)“
und „EduOrga-Kennzeichnung“) und **EduOrga iOS** (`ios/UntPlanNext/Neu/Plan/*`). Dieselben Regeln, Farben und Texte; Maße in px
(Web/PWA) bzw. pt (iOS). **Eigene Gestaltung:** Welche Änderungsarten ein Plan zeigen muss, ist fachlich vorgegeben (Vertretung,
Raum, Fach, Entfall, Verlegung, Zusatz, Mitteilung) – Formen, Wortwahl, Reihenfolge und Legende sind EduOrga und lehnen sich bewusst
nicht an andere Stundenplanprogramme an (keine Schraffur, keine runden Plus-/Kreuz-Pillen, keine übernommenen Legendentabellen).
Sachlich und ruhig: eine Leiste, ein Kennzeichen, kurze Tags. Barrierefreiheit im Einzelnen auch in `ios/README.md`.

**Maße „Stundenkarte v7“ (einzige Quelle; Web `Kachel.tsx`, PWA `app.css` Abschnitt „Stundenkarte v7“, iOS `Kartenmass`)**

Leitbild: die Klarheit eines klassischen Stundenplanrasters – ruhig, fast rechteckig, Farbe nur für Abweichungen. Eigene Gestaltung
(keine übernommenen Maße, Farben, Symbole oder Legenden anderer Programme).

| Maß | Wert (px bzw. pt) |
|---|---|
| Eckenradius | **2** (nie mehr als 3; Vorlage „Klassisch“ 4) |
| Abstand zwischen Karten | **2** (Zelle 1 je Seite), Karten am Stundenraster ausgerichtet |
| Statusstreifen | **oben**, **3** hoch (Schule 3–4), über die ganze Breite, bündig innen am Rand, eckig – **regulär kein Streifen** |
| Kontur | **1** innen, neutral `--up-karte-linie` **#c9d2d7** (dunkel #34464c); geändert Grün 45 %, Entfall Rot 35 %, Prüfung Gelb 50 %, offen Grau gestrichelt |
| Inhalt | links 6 (iOS Raster 5), oben Streifen + 3 – **bei allen Karten gleich**, damit die Grundlinien im Raster fluchten |
| Kennzeichen oben rechts | entfällt (der Streifen trägt den Status); nur „Klassisch“ 5 × 5 |

**Grundkarte („EduOrga Standard“ = Fachfarbe `balken-oben`, Standard der Kartendarstellung)**
* Weiße Karte, feine neutrale 1-px-Linie, **kein farbiger Streifen** bei regulärem Unterricht – das macht das Raster ruhig. Hat die Schule
  Fachfarben festgelegt, steht die Fachfarbe als Streifen oben (keine Tönung der Fläche).
* Zeilen, alle an derselben linken Kante: **1. Fach 13,5–14,5/600** (größer), **2. Klasse bzw. Lehrkraft**, **3. Raum** – 12–12,5/400
  `--up-text-2`; **unveränderte Werte als reiner Text**, ohne Rahmen. Die Zeile des gezeigten Elements entfällt, solange sie unverändert
  ist. Passt nicht alles, entfallen **unveränderte** Zeilen von unten – Fach, geänderte Zeilen und Status bleiben.
* **Kürzen statt Umbrechen:** jede Textzeile (Karte, Termin-Block, Mitteilung) einzeilig mit „…“; der ganze Text in Kurzinfo bzw. Details.
* **Zeitspalte:** je Stunde Beginn oben (10,5), **Stundennummer mittig** (14–15/600), Ende unten; tabellarische Ziffern.
* **Tageskopf:** zentriert **„17.11“** (600) über dem Wochentag **„Mo“**; heute Petrol mit 2-px-Linie unten.
* **Gleichzeitige Stunden:** in der Woche die erste Karte (Änderung vor regulär), die übrigen hinter dem **Reiter „+N“** innen am
  rechten Rand der Zelle, senkrecht mittig (Fläche `--up-primaer-flaeche`, Linie `--up-primaer-rand`, links Radius 4, rechts bündig).
* **Termine/Veranstaltungen** als ruhiger heller Block über ihre Stunden (`--up-ereignis-*`, eckig wie die Karte, ohne Streifen; Titel 600,
  Beteiligte, unten die Uhrzeit); ganztägige im Tageskopf. **Mitteilungen** (Feld `mitteilungen` des Tageskopfs) als **helle gelbe Notiz**
  (`--up-mitteilung-*`) im Tageskopf (Web) bzw. über der ersten Stunde (PWA, iOS).
* **Vorlage „Klassisch“** (für Schulen, die die bisherige Leiste wollen): Karte v6 mit 5-px-Leiste links (grau bzw. Fachfarbe mit leichter
  Tönung), Kontur 1,5, Radius 4, Kennzeichen 5 × 5 oben rechts. Die Statusfarben und -wörter sind dieselben; Prüfungen haben auch hier eine
  **gelbe** Leiste (nie grau).

**Kennzeichnung (fest, in jeder Vorlage)**
* **Geändert – Grün:** Streifen oben `--up-aenderung` **#2f855a**, sehr helle grüne Fläche (iOS #f4fbf6, Web/PWA #e6f4ea), Kontur Grün 45 %.
  Geänderte Werte in der gewohnten Schreibweise **„neu (a̶l̶t̶)“ als reiner grüner Text 600** (#267349, ≥ 5:1; dunkel #b5e6c8 bzw. #5fc48c),
  der bisherige Wert 400 in Klammern durchgestrichen – **ohne Kästchen, ohne Rahmen**.
* **Entfällt – Rot:** Streifen `--up-entfall` #b42318, helle rote Fläche (#fdecea bzw. #fdf0ef), **alles durchgestrichen**, Fach rot,
  unten „entfällt“ (rot 600, nicht durchgestrichen); dunkel #f07167 / #2e1916 / #ffc9c3.
* **Prüfung/Klausur – Gelb:** Streifen **#b7791f** (`--up-pruefung-streifen`, dunkel #e0a93a; ≥ 3:1 zur Fläche), hellgelbe Fläche **#fdf6d8**
  (dunkel #2b2412), Wort **„PRÜFUNG“** (10–11/600, #a15c07 bzw. #7a4f05, ≥ 4,5:1). **Der Streifen ist immer gelb, nie grau** – auch in „Klassisch“.
* **Offen – Grau:** offene Vertretung ist **kein Entfall und nie rot** – weiße Karte, **kein Streifen, grau gestrichelter Rand**, Text grau 600:
  Kollegium „Abr fehlt“, Schüler*innen und Eltern „Vertretung folgt“.
* **Veranstaltung:** heller gelblicher Block, eckig, ohne Streifen. **Buchung** blau gestrichelt.

**Tags und Datenquelle** (Daten: `Plandienst.cs` → `/api/app/plan`; PWA über `Kachelbau.cs`)

| Fall | Tag (Zeile) | Plandaten |
|---|---|---|
| Vertretung | „Gal (G̶o̶r̶)“ – neu, bisher durchgestrichen in Klammern (Lehrkraft) | Wert `{ k: "Gal", alt: "Gor" }` |
| Raumänderung | „105 (3̶0̶3̶)“ (Raum) | Raum `{ k: "105", alt: "303" }` |
| Fachänderung | „BI (M̶U̶)“ (Fach) | `fachAlt` (PWA `subjectOrig`) |
| hinzugekommen | „neu B070“ | Wert `{ k: "B070", neu: true }` ohne `alt` |
| Lehrkraft fehlt, noch keine Vertretung | „Abr fehlt“ bzw. „Vertretung folgt“ – grau, gestrichelt | `{ k: "", alt: "Abr" }`, `vertretungOffen` (PWA `teacherOpen`) |
| Klasse fehlt | „5b fehlt“ (rot, mit „entfällt“) | `abwesendeKlassen` (PWA `classAbsent`) |
| Entfall | unten „entfällt“ | Status `entfall` bzw. `abwesend` ohne `lehrerAbwesend` |
| verlegt (hier entfallen) | unten „verlegt auf Di 21.10., 6. Std“ (rot) | `verlegung = "von"`, `verlegungNach { datum, stunde, beginn }` (PWA `movedTo.lesson`) |
| verlegt (hierher) | unten „verlegt von Mo 20.10., 3. Std“ (grün) | `verlegung = "nach"`, `verlegungVon` (PWA `movedFrom`) |
| Zusatzstunde | unten „zusätzlich“ (grün) | `zusaetzlich` bzw. Art Zusatz/Sondereinsatz (PWA `extra`) |
| Mitteilung | gelbe Notiz | `tage[].mitteilungen` (PWA `notes`) – neu, abwärtskompatibel |

**Legende „Kennzeichnungen“** (Web: Knopf „Legende“ und Hilfe zum Stundenplan; PWA: Blatt „Kennzeichnungen“; iOS: im Blatt „Auswahl
und Filter“): fünf Gruppen in dieser Reihenfolge – **Unterricht, Geändert, Offen, Entfällt, Hinweise** – links je eine kleine
Musterkarte, rechts Titel, ein Satz und die Tags mit je einem Satz (Liste, keine Tabelle).

**Barrierefreiheit (WCAG 2.1 AA)**
* Kontraste geprüft: grüne Schrift #267349 auf #e6f4ea 5,1:1 (auf Weiß 5,8:1), #8f1d14 auf #fdecea 7,8:1, Grau #4d5866 auf #ebeef2
  6,2:1; Zeilen #4b5d62 auf
  #e6f4ea 6,1:1 bzw. auf #fdecea 6,0:1; Mitteilung #5c4a0f auf #fdf5c9 7,8:1; Termin #5c4a22 auf #f7f1e3 7,6:1. **#2f855a nur für
  Leisten, Linien und Kennzeichen** (Nicht-Text ≥ 3:1), nie als Schrift auf #e6f4ea (4,0:1).
* **Nie nur Farbe:** Status steht immer auch als Wort bzw. Form (bisheriger Wert durchgestrichen in Klammern, zugänglicher Name „Lehrkraft Gal statt Gor“, „neu“, „fehlt“, „zusätzlich“, „entfällt“, „verlegt auf/von“), Entfall zusätzlich
  durchgestrichen, offene Vertretung gestrichelt.
* Jede Karte hat einen **ausgeschriebenen zugänglichen Namen** (Fach, Stunde und Uhrzeit, Klasse, Lehrkraft, Raum, jede Änderung, z. B.
  „Raum 105 statt 303“, „Lehrkraft Gal statt Gor“), ist per Tastatur erreichbar (Enter/Leertaste öffnet die Details) und hat einen sichtbaren Fokusring
  (2 px `--up-fokus`).
* `prefers-reduced-motion`: keine Übergänge/Animationen an Karten und Streifen. Zoom 200 %: Zeilen kürzen mit „…“, Fach, Tags und
  Status bleiben stehen; der volle Text steht in Kurzinfo bzw. Details.

**Aktualität und Datenstand**
* Plandaten kommen immer frisch vom Server (`Cache-Control: no-store`, Abruf mit `cache: "no-store"`); Web und PWA laden beim
  Zurückkehren zum Fenster (Fokus/Sichtbarkeit), beim Wiederverbinden und alle zwei Minuten nach. Der Service Worker der PWA fragt
  Plandaten immer zuerst beim Netz an; die Kopie im Cache dient nur als Rückfall ohne Netz und wird als **„Offline — Stand hh:mm“**
  gekennzeichnet.
* **„Stand EduOrga Studio: Di 20.10.2026, 14:32 · vor 5 Min.“** (Feld `stand` in `/api/app/plan`, `/api/app/vertretungen`,
  `/api/monitor/…`; `planAktualisiert` auf der Startseite; PWA `studioStand`) = Zeitpunkt der letzten Übertragung aus EduOrga Studio
  (auch reine Vertretungspakete). Vollständiger Zeitpunkt in der Kurzinfo; älter als 24 Stunden an einem Schultag: Zusatz **„Daten evtl.
  nicht aktuell“** (Bernstein, als Text). Orte: Planseite unter der Kalenderwoche, Vertretungsplan, Mein Tag, Monitor (oben rechts),
  PWA unter dem Plannamen und in „Mehr › Daten aktualisieren“.

**Gesuchter Plan wie „Mein Plan“:** Wer einen Plan sucht (Klasse, Lehrkraft, Raum), sieht genau dieselbe Ansicht wie beim eigenen
Plan (Raster, Woche/Tag, Legende, Bedienung), Titel „Klasse 5a“, „Lehrkraft SNE“ bzw. „Raum R101“, daneben der Knopf **„Mein Plan“**
zurück zum eigenen Plan (Web: Werkzeugleiste; PWA: Kopfzeile).

**Stundendetails mobil (PWA, iOS):** für die eigene Stunde der Lehrkraft zwei Reiter **Details | Klassenbuch**. Klassenbuch: oben die
Statuszeile („Thema eingetragen · Anwesenheit offen“), **zuerst das Eingabefeld Thema (Lehrstoff)**, direkt darunter groß
**„Anwesenheitskontrolle“** (danach mit Ergebnis, z. B. „2 abwesend – ändern“) und „Alle anwesend“, dann Hausaufgaben,
Klassenbucheinträge, Notizen und **„Prüfung eintragen“** (vorbelegt mit Datum, Stunden und Klasse; Rechte und Überschneidungen
prüft EduOrga Web). Prüfungen lassen sich in „Schule › Prüfungen“ auch ändern und löschen.

### 10.1 iOS im Einzelnen (v3)

Die folgenden Maße gelten für iOS; Abweichungen von den Regeln oben (Farben, Felder, Änderungstypen) gehen den Regeln oben nach.

**Raster**
* Zeitspalte 38 pt: Beginn oben (10,5/400, `--up-text-3`), **Stundennummer mittig** (15/600, `--up-text`), Ende unten;
  tabellarische Ziffern. Zeilen gleich hoch (52–112 pt, Schultag passt in die Höhe), Pausen als Band (≥ 15 min 12 pt,
  sonst 3 pt) in `--up-schiefer`-Grau, Rastergrund #edf1f2 (dunkel #0b0f13).
* Tageskopf 42 pt, zentriert: **Datum „17.11“ 15,5/700**, darunter Wochentag „Mo“ 12/400 `--up-text-2`. Heute: Petrol
  (Akzent) mit 2-pt-Linie unten und ≈ 6 % Petrol-Tönung der Spalte. Punkt 5 pt neben dem Wochentag: grün =
  Änderungen, rot = Entfall am Tag.

**Karte**
* Füllt die Zelle: 1,5 pt Abstand oben/unten, 3 pt zwischen den Spalten. **Feste Breite = Spaltenbreite**, Inhalt wird
  beschnitten – eine Karte ist nie breiter als ihre Spalte.
* Maße nach „Stundenkarte v7“ oben (`Kartenmass`): Radius 2, keine Schatten, Kontur 1 pt `Farben.karteLinie` (#c9d2d7), 2 pt
  Abstand zwischen den Karten. Fläche weiß; **Streifen oben 3 pt** nur für Status (geändert, Entfall, Prüfung) bzw. die Fachfarbe der
  Schule (`Klassikstil.streifen`); Inhalt oben immer um den Streifen eingerückt (`obenEinzug`). Vorlage „Klassisch“: Balken 5 pt links.
* Inhalt oben links, Einzug 6 pt nach dem Balken: **Fach 14,5/700**, darunter je eine Zeile 12,5/400 `--up-text-2`:
  Klasse, Lehrkraft, Raum (bzw. Anlass). Unter 56 pt Breite: 12,5 bzw. 11. Zeilen, die nicht passen, entfallen von
  unten; Änderungen stehen immer da, auch wenn die Schule Raum bzw. Zeile 2 ausblendet.

**Status (iOS-Maße; Farben und Felder nach den Regeln oben – Änderung grün, Entfall rot)**
* **Änderung, Entfall, offene Vertretung, Tags:** wie in der „Kennzeichnung“ oben (5-pt-Leiste, Kennzeichen, umrandete Tags in
  eigener Wortwahl; offene Vertretung neutral, grau gestrichelt).
* **Prüfung**: Bernstein-Linie und helle Bernstein-Fläche, Wort „Prüfung“ unten links (wenn Platz).
* **Termin / Raumbuchung**: ohne Balken, gestrichelt (Termin Magenta-Titel, Buchung Blau).
* Vergangene Stunden 62 % Deckkraft.

* **Abweichende Uhrzeit**: beginnt bzw. endet eine Stunde nicht mit ihrer Rasterzeile (z. B. 14:05 statt 14:00), steht
  die Karte genau nach der Uhrzeit versetzt (mindestens 22 pt hoch) und trägt unter dem Raum eine zusätzliche Zeile
  „14:05–14:45“ (11,5/400 `--up-text-2`).

**Gleichzeitige Stunden**
* Reihenfolge: Änderung vor regulär, dann die längere, dann der Rang. Bis zur Einstellung **„Parallele Stunden
  nebeneinander“** (Filter-Blatt, 1–4, Standard 1; höchstens so viele, wie mit ≥ 44 pt nebeneinander passen; im Tag als
  Raster mindestens eine je 96 pt) stehen sie **nebeneinander** in der Zelle, 2 pt Abstand. Die übrigen liegen hinter
  einem **Reiter „+N“** innen am rechten Rand der letzten sichtbaren Karte, senkrecht mittig: Fläche
  `--up-primaer-flaeche`, Linie `--up-primaer-rand` 0,75 pt, links Radius 4, rechts bündig, Schrift 11,5/600 Akzent.
  Er ragt nie über die Zelle hinaus. Antippen listet alle Stunden dieser Zeit.

**Veranstaltungen und Termine im Raster**
* AG, Schulfest, Chor, Termin, ganztägiger Termin: **im Raster** über ihre **echte Zeit** – Beginn und Ende werden auf
  die Zeilen abgebildet (anteilig in Stunde bzw. Pausenband), dürfen also mitten in einer Stunde beginnen oder enden;
  ohne genaue Uhrzeit über ihre Stunden. Block in **warmem Neutral** (Fläche #f7f1e3, Linie 1 pt #e2d6bb, Titel
  #5c4a22; dunkel #2a2519 / #4a4130 / #e6d7b0), ohne Balken, Radius 6: oben **Titel 12,5/600** (bis 3 Zeilen), darunter
  die Beteiligten 11,5 (z. B. „1. Treffen Klassen 5“, „5a, 5b, 5c“), **unten die Uhrzeit** „14:15–15:30“ 10,5
  (ganztägig: „ganztägig“).
* **Ohne Unterricht** zur selben Zeit füllt der Termin die Spalte; mehrere gleichzeitige Termine teilen sich die
  Breite (2 pt Abstand).
* **Mit Unterricht** zur selben Zeit rückt der Termin als **schmaler Block an den rechten Rand** (≈ 36 % der Spalte,
  mindestens 22 pt, höchstens 45 %); nur die Stunden, die er überschneidet, werden um diese Breite schmaler.
  **Ganztägige Termine** an Tagen mit Unterricht sind ein **schmaler warmer Streifen über den ganzen Tag** (10 pt unter
  90 pt Spaltenbreite, sonst ≈ 22 %, höchstens 36 pt; unter 30 pt nur mit Kalenderzeichen). An Tagen ohne Unterricht
  ist der ganztägige Termin ein Block über alle Zeilen. Kein Banner im Tageskopf mehr – der Kopf bleibt 42 pt.

**Mehrere Pläne (Mehrfachauswahl)**
* Kontrollkästchen im Blatt „Auswahl“ (iPhone und iPad, bis zu sechs). Leiste unter der Navigationsleiste mit den
  gewählten Klassen/Lehrkräften/Räumen (Felder Radius 6, `--up-primaer-flaeche`, „×“ zum Entfernen, „Hinzufügen …“
  umrandet; auf dem iPad immer sichtbar, auf dem iPhone nur bei Auswahl). Jeder Tag teilt sich in Unterspalten je Plan
  (2 pt Abstand), darüber das Kürzel 11/600. Termine, zu deren Zeit in keinem gewählten Plan Unterricht liegt, laufen
  genau nach ihrer Uhrzeit über den ganzen Tag. Gilt für Woche, Tag als Raster und Agenda (dort jede Stunde einmal).

**Ansichten und Bedienung (iPhone ab 375 pt)**
* **Navigationsleiste: nur zwei Dinge.** In der Mitte der Planname (bzw. „3 Pläne“) 15/600 mit Pfeil, darunter der
  Zeitraum 11 `--up-text-2` („KW 43 · Okt. 2026 · A-Woche“, im Tag „Di 20.10.2026“; bei „Nur Änderungen“ dahinter
  „· Änderungen“ in Petrol) – Menü: Mein Plan, Favoriten, Auswahl …, Suchen; höchstens 200 pt breit. Rechts genau
  **ein Kalenderknopf** (Heute, Gehe zu Datum …, voriger/nächster Zeitraum; bei einem Plan aus der Suche auch der
  Favorit). Auf dem iPad zusätzlich die Lupe. Kein Segmentschalter in der Leiste – nichts kollidiert auf 375/393/430 pt.
* **Planleiste unten** (schwebend, Glas, über der Tab-Leiste, höchstens 520 pt breit): links die Ansichten **Agenda |
  Woche | Tag** als Kapsel (je 60 × 40 pt, Symbol 14/600 über Beschriftung 10,5/600; gewählt Petrol mit weißer Schrift,
  die Markierung gleitet), rechts zwei runde Knöpfe 44 pt: **Dreieck „Nur Änderungen“** (aktiv gefülltes Dreieck auf
  Petrol-Glas) und **„Auswahl und Filter“** (Regler; Petrol-Punkt 8 pt, wenn ein weiterer Filter wirkt). Breite auf
  dem iPhone SE: 3 × 60 + 2 × 44 + Abstände = 304 pt.
* Abkürzungen bleiben: **Tageskopf antippen** = Tag, **aufziehen** (> 1,3) = Tag, **zusammenziehen** (< 0,75) = Woche,
  waagrecht wischen = andere Woche (Agenda, Woche) bzw. anderer Schultag (Tag). Im Tag steht die Wochenleiste der
  Schultage oben unter der Navigationsleiste (Pfeile = andere Woche, nach oben ziehen = Woche).
* **Agenda**: die Woche als Liste, je Tag links „17“ 22/700 mit „Mo“ 12 (heute Petrol; antippen = Tag), rechts je
  Stunde, Termin bzw. Aufsicht eine flache Zeile (mindestens 44 pt) in der Kartensprache: Stundennummer 20/400, Beginn
  und Ende 11 untereinander, Fach 15/700, dann Klasse, Lehrkraft, Raum 13 (Änderungen als Feld „neu (bisher)“),
  rechts das Statuswort. Ganztägige Termine zuerst, sonst nach Uhrzeit; Ferien als Ferienzeile, Mitteilungen darunter.
* **Tag**: Standard **Raster** (wie die Woche mit einer breiten Spalte, gleichzeitige Stunden nebeneinander);
  wahlweise Liste bzw. Zeitachse (Filter-Blatt bzw. Profil › Darstellung).

**Blatt „Auswahl und Filter“** (Regler unten bzw. „Auswahl …“ im Planmenü; oben umschaltbar Auswahl | Filter)
* **Auswahl:** „Mein Plan“ immer ganz oben; Bereiche **Klassen | Lehrkräfte | Räume** als Segmente (mit Zahl der
  markierten, z. B. „Klassen · 2“; Lehrkräfte nur fürs Kollegium), Suchfeld, Einträge mit Kürzel, Name, bei Klassen
  die Klassenleitung, Stern für Favoriten. **Zeile antippen = genau dieser Plan** (Blatt schließt), **Kästchen =
  Mehrfachauswahl** (Pläne nebeneinander; der bisher gezeigte Plan ist der erste, bleibt nur einer übrig, zeigt der
  Plan ihn allein).
* **Filter:** *Einblenden* – Aufsichten, Mitteilungen, Ferien und Feiertage; *Reduzieren* – **Nur Änderungen**
  (regulärer Unterricht, reguläre Aufsichten und Bereitschaften ausgeblendet; auch über das Dreieck) und **Nur
  Ist-Zustand** (Entfall, abgegebene Stunden, Bereitschaft der abwesenden Lehrkraft ausgeblendet); *Layout* – parallele
  Stunden nebeneinander (1–4), Dichte der Woche, Tag als Raster/Liste/Zeitachse; dazu die **Legende** und „Filter
  zurücksetzen“. Alles bleibt auf dem Gerät gespeichert.

**Legende** (Blatt „Auswahl und Filter“): je Zustand eine kleine Musterkarte mit einem Satz; Status nie nur über Farbe
– Schraffur, Durchstreichung, Strichelung und Wörter tragen ihn mit, der zugängliche Name der Karte nennt ihn
ausgeschrieben.

**Stundendetails (mobil)**: gruppierte Liste, Farbe nur für den Status. Kopf (Fach ausgeschrieben + Kürzel, Stunde und
Zeit, Status als Wort), dann – nur bei Änderungen – Abschnitt „Änderung“ bzw. „Entfall“ mit „neu (bisher durchgestrichen)“ je Angabe,
Verlegung und Vertretungstext/Grund, danach die geltenden Angaben (Zeit, Raum, Lehrkraft, Klasse), Hinweis, Online,
Thema, Hausaufgaben, Notizen, Klassenbuch.

**Heute (iOS, `Neu/Heute/HeuteView.swift`, `HeuteBereiche.swift`, `HeuteGrafik.swift`, `HeuteKalender.swift`)** – ruhiges Tagesbriefing,
Grafik ersetzt Text, Typografie statt Kästen:
* **Kopf** (keine Begrüßung): Wochentag und Datum **title3/600** („Mittwoch, 14. Oktober“), darunter 15 `--up-text-2` „A-Woche · KW 42“
  (in den Ferien „KW 43 · Herbstferien“). Immer das **tatsächliche Datum** (`kalender.heute`), auch wenn der Server in Ferien bzw. am
  Wochenende schon den nächsten Schultag liefert.
* Reihenfolge Schultag: Kopf · **Tagesband** · **Fokuskarte** · **Tageszahlen** (nur Werte > 0) · Notizen der Schule · **Stunden**
  (Karten v7) · **Kalender** (nächste Ferien, Feiertage) · „Mehr anzeigen“ · „Stand EduOrga Studio“ und Schule. Wochenende: Zeile
  „Nächster Schultag: Montag, 2. November“, dann der Tag.
* Reihenfolge **Ferien bzw. freier Tag** (`kalender.frei`): Kopf · **Ferienfläche** · Tageszahlen · Notizen · Kalender · Stunden des
  nächsten Schultags („Montag, 2.11.“) · Fuß – kein Tagesband und keine Fokuskarte.
* Inhaltsflächen **Radius 6 pt**, 1-pt-Rand `Farben.rand`, keine Karten in Karten, 24 pt Abstand zwischen Abschnitten.
* **Ferienfläche:** 3-pt-Streifen oben in Ferienblau `--up-frei` #2f6f9f (dunkel #79b0dc), darüber nichts Dekoratives: „Ferien“ bzw.
  „Feiertag“/„Unterrichtsfrei“ 13/600 blau, Name **title2/600** („Herbstferien“), Zeile „bis Samstag, 31.10. · noch 13 Tage“ (15,
  `--up-text-2`), feiner Verlauf 4 pt (vergangene Ferientage) in Blau auf Neutralgrau; darunter durch eine Linie getrennt „Nächster
  Schultag“ (13) · „Montag, 2. November“ (17/600) · „ab 7:55 · D, R204“ (15) – Antippen öffnet den Tag im Plan.
* **Kalender** (Liste, eine Fläche): „Weihnachtsferien · 23.12.–6.1. · **in 64 Tagen**“ (Abstand 15/600 blau), darunter bis zu drei
  Feiertage bzw. bewegliche Ferientage der nächsten 60 Tage an Schultagen. Daten: `GET /api/app/heute` → `kalender { heute, frei,
  naechsteFerien, freieTage[], naechsterSchultag }` (EduOrga Web `Plandienst.Kalender`: Ferien und Feiertage aus dem Paket von
  EduOrga Studio und die in EduOrga Web gepflegten freien Tage; Ferien = Zeitraum ab drei Tagen ohne Feiertag-Kennzeichen, kürzere
  Zeiträume und Feiertage = freie Tage). Ältere Server: Rückfall auf das Feld `ferien` bzw. den Wochenplan.
* **Tagesband:** der Schultag als Leiste über die ganze Breite (Höhe 20 pt, mit Dynamic Type), je Stunde ein Abschnitt nach seiner
  echten Dauer (Radius 1, 2 pt Luft, Pausen als Lücken), gleichzeitige Stunden zusammengefasst (Änderung vor regulär). Farben der
  Stundenkarte: regulär Grau #b4bec4, geändert Grün #2f855a, entfällt helles Rot mit roter Linie und **durchgestrichen**, offene
  Vertretung weiß und grau gestrichelt, **Prüfung Gelb #b7791f**, Termin warm, Bereitschaft neutral gestrichelt. Vergangenes 42 %
  Deckkraft, die laufende Stunde mit 2-pt-Petrol-Rahmen, **Jetzt-Linie** 2 pt Petrol mit der Uhrzeit darüber (11/600); oben links
  Beginn, rechts Ende des Tages, unter den Abschnitten die Stundennummern; Aufsichten als 4 pt hohe Marke in ihrer Pause. Ein Element
  für VoiceOver („Schultag 7:45 bis 13:10 Uhr, 6 Abschnitte, 1 geändert, 1 entfällt. Jetzt 3. Stunde.“); Antippen öffnet den Tag im Plan.
* **Fokuskarte** „Jetzt“ / „Als Nächstes“ in der Sprache der Karte v7: **3-pt-Streifen oben** (laufende reguläre Stunde Petrol, sonst
  Status- bzw. Fachfarbe; regulär ohne Fachfarbe kein Streifen), oben „Jetzt · 3. Std.“, Fach title2/600, darunter Klasse, Lehrkraft
  und Raum (Änderungen grün „Gal (G̶o̶r̶)“, für Schüler*innen und Eltern „Vertretung folgt“); rechts groß die Restzeit (**title/600**:
  „noch / 23 Min.“, „in / 12 Min.“, „ab / 7:45“, „Mittwoch / 7:45“). Laufende Stunde: Fortschrittsbalken 6 pt Petrol auf Neutralgrau,
  eckig, mit Beginn und Ende darunter. Lehrkräfte unten „Klassenbuch erfassen“ bzw. „Klassenbuch nachtragen · M · 8:00“.
* **Tageszahlen:** höchstens vier Werte über null in einer Fläche, getrennt durch 1-pt-Linien: Zahl title2/600 tabellarisch, darunter
  die Beschriftung 12 pt `--up-text-2`. Kollegium: Änderungen (Grün-Schrift #267349), Klassenbuch offen (Bernstein), Aufsichten,
  neue Nachrichten (Petrol), Termine; Schüler*innen und Eltern: Änderungen, Hausaufgaben morgen, Prüfungen diese Woche (Bernstein),
  neue Nachrichten, Termine. Jede Zahl führt zu ihrer Seite; bei Bedienungshilfen-Schriftgrößen untereinander.
* **Notizen der Schule** (Mitteilungen, Veranstaltungen, Hinweise): höchstens zwei helle gelbe Notizen (Radius 2, 1-pt-Linie, Titel
  600, Text höchstens zwei Zeilen), darunter „Alle n Hinweise der Schule“.
* **Stunden:** je Stunde links Beginn (15) über Ende (11), rechts eine Stundenkarte v7 mit zwei Zeilen – **Fach 17/600**, darunter
  Klasse bzw. Lehrkraft und Raum (15, geänderte Werte grün 600 „105 (3̶0̶3̶)“) –, rechts „entfällt“/„verlegt …“, „PRÜFUNG“ bzw.
  „jetzt“; 6 pt Abstand; laufende Stunde mit 2-pt-Petrol-Rahmen, vergangene 55 %. Große Schrift (Bedienungshilfen): untereinander.
* **Entwurf zum Ansehen ohne Xcode:** HTML-Nachbau 390 × 844 (hell/dunkel) der Seiten Heute (Schultag, Ferien) und Woche –
  Bildschirmfotos in `ios/docs/bilder/entwurf-v7-*.png`.

