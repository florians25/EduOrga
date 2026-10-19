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
* **Klare Kanten:** Radius 6 px (Steuerelemente), 8 px (Karten, Dialoge), 4 px (Rasterrahmen), 3 px (Plaketten,
  Stundenkacheln). Keine Pillenform für Knöpfe, Felder oder Plaketten.
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
* **Plaketten:** 11 px/600, Radius 3 px, helle Fläche der Statusfarbe, Text der Statusfarbe; in Stundenkacheln nur Text
  (Abschnitt 5).
* **Leere Zustände:** ein Linien-Symbol 24 px in `--up-text-3`, ein Satz, optional ein Knopf. Keine Illustrationen.

## 7. Aufbau je Produkt

| Produkt | Navigation |
|---|---|
| **Studio** | **EduOrga Studio**: React 18 + TypeScript + Fluent UI v9 (`studio/client`). Fluent-Thema aus der Petrol-Rampe (`studio/client/src/theme.ts`, Stufe 80 = Primär #164C55, 100 = Akzent #28747A), Neutraltöne Schiefer mit kräftigen Linien (#c9d1db, Stroke1 #b4bec8), Seitenhintergrund #F5F7F8, Text #24363B; eigenes dunkles Thema (Schiefer mit Petrolstich, Flächen #10161a/#141b1f/#182126, Linien #37434b, Text #e7ecee), Thema wird vor dem ersten Zeichnen gesetzt (`public/thema.js`, kein weißes Aufblitzen). Studio-Ergänzungen zu den Tokens in `studio/client/src/stile/thema.css`. Seitenbasierte Web-Anwendung (eine Seite je Aufgabe, Adresse in der URL). **Seitenleiste in Primärfarbe** (dunkel: #0e2a2f) mit weißer Schrift, Linien-Symbolen nur vor den Bereichen; Zeilen über die ganze Breite, eckig, gewählt = leicht hellere Zeile + 3-px-Kante links in der Modusfarbe + Schrift 600, keine Pillen. **Kopfleiste** weiß: Monogramm + Wortmarke „**Edu**Orga Studio“, Schuldatei, Modus als zwei schlichte Textreiter mit 3-px-Unterstrich in der Modusfarbe (keine Symbole, kein Rahmen), Rückgängig/Speicherstand, Suche (Strg+K), Konto. **Modusfarbe:** Stundenplanung Petrol #28747a, Vertretungsplanung Indigo #3b4a8f (dunkel #4f9298 / #7f8fe0) – Unterstrich des Modusreiters, 2-px-Linie über dem Seitenkopf, Kante des gewählten Navigationspunkts; sonst keine Flächen in Modusfarbe. **Seitenkopf** grau (#eef1f4) mit Bereich als schlichter Text (12 px, `--up-text-3`, ohne Quadrat/Großbuchstaben) und Titel 20 px, darunter die Werkzeugleiste auf derselben Fläche; Inhalt weiß; Kopfzeilen der Bereiche (#e6eaee) und Tabellenköpfe (#e9edf0) deutlich grau; Karten weiß mit 1-px-Linie auf grauem Grund. Umschalter (Tag/Woche) flach: 1-px-Rahmen, gewählt grau mit 2-px-Linie in Modusfarbe; Wochenstreifen als Text, Planungstag unterstrichen. Datumsfelder als Fluent DatePicker (deutsch, Woche ab Montag, Kalenderwochen, Eingabe „19.10.2026“), lange Auswahllisten als durchsuchbare Combobox. Rechteverwaltung als Matrix Gruppe × Bereich mit farbigen Stufen-Kennzeichen (Text, ohne Symbole). Arbeitsplätze (Tagesplanung, manuelles Planen, Verlegen und Tauschen) sind fest gestaltete Seiten mit verschiebbaren Trennern. Keine Verläufe, keine Symbolkacheln, keine Großbuchstaben-Plaketten als Dekoration. |
| **Web** (EduOrga Web) | React 18 + TypeScript + MUI v7 (`web/client`), Thema nach `MARKE.md`: Primär Petrol #164C55 (Logo, Navigation, Knöpfe), Akzent #28747A (aktive Bereiche, Links, Fokus), Hintergrund #F5F7F8, Text #24363B, Statusfarben aus diesen Tokens (Änderung Violett #6d4fc2, Termin #a3347c), hell und dunkel (Petrol-Palette, wählbar im Kontomenü). Sachlich wie ein Schulsystem: Knöpfe und Felder Radius 6 px (Höhe 32 px), Karten 8 px mit getöntem Kopfband und Trennlinie, Tabellenköpfe getönt, Seitenkopf mit Linie, Segmentschalter mit 1-px-Rahmen, Bearbeiten in Dialogen. **Seitenleiste in Petrol** mit Monogramm und Wortmarke „EduOrga Web“, Linien-Symbolen vor den Bereichen und Unterpunkten als eingerücktem Text; Zeilen über die volle Breite, eckig, aktive Zeile leicht getönt mit 3-px-Kante links und Schrift 600 (keine Pillen, kein Einzug); einklappbar zur Symbolleiste; mobil als Schublade unter einer Petrol-Kopfleiste. Eigene Gliederung: Start · Mein Tag · Stundenpläne · Vertretungen · Unterricht & Prüfungen · Klassenbuch · Kommunikation · Termine & Buchungen · Stammdaten · Verwaltung (alte Adressen bleiben, sprechende Aliase). Datums-/Zeitfelder nur als MUI-Picker mit Beschriftung oben und Mindestbreite. Anmeldung zweigeteilt mit Slogan „Einfach mehr Schulalltag.“ und „Über EduOrga“ (rechtlicher Hinweis). Eigener Stundenplan (Abschnitt 5, Standard „Klassisch“) und eigene Klassenbuch-Seiten; Online-Unterricht nur als Schild mit Link. Keine Namen, Symbole oder Grafiken anderer Produkte. |
| **Mobile (PWA)** | Untere Leiste *Heute · Plan · Postfach · Mehr* (Linien-Symbol + Beschriftung, das ist auf Telefonen Standard), große Seitentitel, Listen statt Karten-Kacheln, keine Logo-Kachel. |
| **iOS** (EduOrga, `ios/`; technisch UntPlanNext) | Tab-Leiste des Systems *Heute · Plan · Postfach · Schule · Suche* (Suche mit der Rolle „Suche“), Profil und Einstellungen als Blatt hinter dem Avatar oben rechts. Marke EduOrga: Monogramm und Wortmarke, Primär **Petrol** `#164C55`, Akzent/`AccentColor` `#28747A` (dunkel `#5FB0B5`), Hintergrund `#F5F7F8`, Text `#24363B`; Statusfarben wie `tokens.css` (Änderung/Vertretung Violett `#6d4fc2`, Termin Magenta `#a3347c`, Prüfung Bernstein, Entfall Rot, Ferien Blau). Einrichtung als ruhige Einstiegsseite (Logo, Slogan, Adresse mit Prüfung beim Tippen, QR-Code, zuletzt verwendete Schulen). **Plan öffnet mit der Woche als Raster** über die ganze Breite (Mo–Fr, schmale Stundenspalte, Zeilen passen den Schultag in die Bildschirmhöhe, Jetzt-Linie, wischen = Woche, Aufziehen = Dichte); Karten im klassischen Grundstil – in diese Richtung bekannter Portale, aber eigenständig: hellgrauer Rastergrund mit feinen Stundenlinien, weiße Karten ohne Rahmen, Radius 2, 3-pt-Balken innen links (grau bzw. Fachfarbe), Fach halbfett, darunter Lehrkraft/Klasse und Raum; eigener Status (Entfall rot durchgestrichen und schraffiert, Änderung violett, Prüfung Bernstein, offen/Termin/Buchung gestrichelt); Inhalte nach der schulweiten Kartendarstellung. Tag als Liste bzw. Zeitachse mit denselben Karten. **Liquid Glass** (iOS 26) nur auf der Bedienebene; iOS 18 mit Material. Systemschrift SF Pro mit Dynamic Type, 8-pt-Raster. Die frühere App „UntPlan für iOS“ liegt nur noch als Archiv in `archiv/ios-alt/`. |

## 8. Sprache und Abgrenzung

* Produktname „UntPlan“, Bereiche „Studio“, „Web“, „Mobile“. Keine Namen, Logos, Symbole, Schriften oder
  wörtlich übernommenen Bezeichnungen anderer Hersteller.
* Dateiformate anderer Programme (z. B. GPU-Textdateien) werden nur als **Import/Export-Format** neutral benannt.
* Keine Formulierungen wie „wie im Original“, „Vorbild“ (für fremde Produkte), „vertraute Optik“ in Oberfläche, Code-Kommentaren oder Doku.
