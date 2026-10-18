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
* **Stundenkarten konfigurierbar (Web):** Die Administration kann die Kachel schulweit anpassen (Administration | Darstellung
  der Stundenkarten, mit Live-Vorschau). Der Standard „Sachlich“ ist die oben beschriebene Kachel. Wählbar: Fachfarbe als
  Quadrat, Akzentbalken links oder oben (2–6 px, ohne Lücke am Rand, im Entfall abgeschwächt), leichte Tönung der Fläche
  (6–30 % Deckkraft; Entfall und vertretene Stunden nie getönt) oder keine; Fläche neutral (#f6f8fa), weiß oder leicht
  Marine-getönt; Rahmen fein, kräftig (2 px) oder keiner; Radius 0–8 px; Dichte kompakt/normal/großzügig (Innenabstand 6/8/10 px,
  Fach 12/13/14 px); Fach als Kürzel oder Name, Raum und Zeile 2 ein-/ausblendbar (Änderungen bleiben sichtbar), Zeile 2 als
  Kürzel oder Name, unveränderte Kürzel gefüllt, umrandet oder als Text; optional Statuswörter auf den Kacheln. Vorlagen:
  „Sachlich (Standard)“, „Akzentbalken“, „Farbfläche“, „Minimal“. Statuslinien, Schraffur, Durchstreichung und Kürzel-Plaketten
  sind fest; Listenzeilen und der Kopf der Stundendetails zeigen die Fachfarbe passend (Quadrat bzw. schmaler Balken).
  Farben kommen aus den Thema-Variablen, damit hell und dunkel ohne Neuladen stimmen.
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
| **Studio** | React 18 + TypeScript + Fluent UI v9 (`studio/client`), Fluent-Thema aus der Marken-Rampe Marine `#234f96` (hell, dunkel, automatisch), IBM Plex Sans, Status- und Fachfarben aus diesen Tokens. Seitenbasierte Web-Anwendung (eine Seite je Aufgabe, Adresse in der URL, Zurück-Taste funktioniert). Helle Seitenleiste (Fluent Nav) mit Linien-Symbolen vor den Bereichen, Seiten als Text; in schmalen Fenstern überlagernd. Kopfleiste mit Wortmarke, Schuldatei, Modus, Rückgängig/Speichern, Suche (Strg+K), Konto. Jede Seite: Seitenkopf (Bereich, Titel 20 px, Aktionen rechts), Werkzeugleiste mit Textknöpfen, Filterleiste, Inhalt, Fußzeile; Details in einem Nebenbereich rechts; Bearbeiten in Dialogen. Arbeitsplätze, die mehrere Inhalte gleichzeitig brauchen (Tagesplanung, manuelles Planen, Verlegen und Tauschen), sind fest gestaltete Seiten mit verschiebbaren Trennern – keine frei schwebenden Fenster. Keine Verläufe, keine Symbolkacheln. |
| **Web** | React 18 + TypeScript + MUI v7 (`web/client`), Thema aus diesen Tokens (Marine als Primärfarbe, Statusfarben, kein Orange). Sachliches Portal: Knöpfe und Felder Radius 6 px (Höhe 32 px), Karten 8 px, Segmentschalter mit 1-px-Rahmen, Tabellen mit feinen Linien, Bearbeiten in Dialogen. Seitenleiste mit Linien-Symbolen vor den Bereichen (Unterpunkte als Text), leicht abgerundete aktive Zeile, einklappbar zur Symbolleiste; mobil als Schublade. Eigener Stundenplan (Abschnitt 5: Zeitachse, Jetzt-Linie, Status-Legende; Stundenkarten durch die Administration konfigurierbar) und eigene Klassenbuch-Seiten; Online-Unterricht nur als Schild mit Link (Umschalten in Studio/App). Keine Namen, Symbole oder Grafiken anderer Produkte. |
| **Mobile (PWA)** | Untere Leiste *Heute · Plan · Postfach · Mehr* (Linien-Symbol + Beschriftung, das ist auf Telefonen Standard), große Seitentitel, Listen statt Karten-Kacheln, keine Logo-Kachel. |
| **iOS** (UntPlan Next, `ios/`) | Tab-Leiste des Systems *Heute · Plan · Postfach · Suche* (Suche mit der Rolle „Suche“), Profil und Einstellungen als Blatt hinter dem Avatar oben rechts. Akzentfarbe **Petrol** `#0b5d57` (heller `#138a80`, dunkel `#3fb3a6`); Statusfarben bewusst weit davon entfernt: Änderung/Vertretung Violett `#6d4fc2`, Termin Magenta `#a3347c`, Prüfung Bernstein, Entfall Rot, Ferien Blau. **Liquid Glass** (iOS 26, Xcode 26) nur auf der Bedienebene über dem Inhalt – Tab-Leiste (klappt beim Rollen ein), schwebende Wochenleiste, Werkzeug- und Filterknöpfe, Bedienknöpfe der Jetzt-Karte, Knöpfe über dem Kopf der Stundenansicht; hervorgehobene Knöpfe Petrol-Glas. Inhalte (Kacheln, Karten, Listen) deckend; iOS 18 erhält dieselbe Form mit Material. Plan: Tag als Liste großer Kacheln (Fach und Raum groß, Änderungen mit gefüllter Plakette, Rahmen und Tönung, Pausen/Freistunden kompakt), waagrecht wischen = Tag, Wochenübersicht als Matrix, wahlweise Zeitachse. Systemschrift SF Pro mit Dynamic Type, Abstände im 8-pt-Raster. Die frühere App „UntPlan für iOS“ liegt nur noch als Archiv in `archiv/ios-alt/`. |

## 8. Sprache und Abgrenzung

* Produktname „UntPlan“, Bereiche „Studio“, „Web“, „Mobile“. Keine Namen, Logos, Symbole, Schriften oder
  wörtlich übernommenen Bezeichnungen anderer Hersteller.
* Dateiformate anderer Programme (z. B. GPU-Textdateien) werden nur als **Import/Export-Format** neutral benannt.
* Keine Formulierungen wie „wie im Original“, „Vorbild“ (für fremde Produkte), „vertraute Optik“ in Oberfläche, Code-Kommentaren oder Doku.
