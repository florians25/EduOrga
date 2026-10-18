# UntPlan Designsystem

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
* **Klare Kanten:** Radius 6 px (Steuerelemente, Karten), 4 px (Plaketten, Stundenkacheln), 8 px (Dialoge).
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
| Hintergrund | `--up-schiefer-50` #f4f6f8 | Seitenhintergrund |
| Fläche | #ffffff | Karten, Tabellen, Raster |
| Rand | `--up-schiefer-200` #dce1e7 | alle 1-px-Linien |
| Text | #232a33 / #4d5866 / #6b7684 | Haupt-, Zweit-, Hinweistext |

**Fachliche Statusfarben** (überall gleich, je mit heller Fläche `…-flaeche`):

| Status | Farbe | Darstellung |
|---|---|---|
| Entfall | `--up-entfall` #b42318 | Kachel schraffiert (45°, 1 px, 8 % Deckkraft), Inhalt durchgestrichen, Plakette „Entfall“ |
| Vertretung / Änderung / Raumwechsel | `--up-aenderung` #0b7a75 | 1,5-px-Rahmen in Petrol, geänderter Wert petrolfarben unterstrichen, alter Wert durchgestrichen in der Plakette |
| Prüfung / Klausur | `--up-pruefung` #a15c07 | Plakette „Prüfung“, Fläche hell-bernstein |
| Veranstaltung / Termin | `--up-termin` #5a4fb3 | Fläche hell-violett, gestrichelter Rahmen |
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

* **Raster:** weiße Fläche, Spaltenköpfe „Mo 19.10.“ (Wochentag 500, Datum 400, heute: Marine-Text und 2-px-Linie
  unter dem Kopf). Zeitspalte links schmal: Stundennummer 13 px/600, darunter Beginn–Ende 11 px in `--up-text-3`.
  Zeilentrenner 1 px `--up-linie`; Pausen als 6–8 px hohe, leicht graue Bänder ohne Text.
* **Stundenkachel:** Radius 4 px, Innenabstand 4–6 px, Hintergrund = Fachfarbe auf 14 % Deckkraft über Weiß,
  **kein farbiger Seitenbalken**. Kopfzeile: Fachkürzel 13 px/600 links, Raum rechts (tabellarische Ziffern).
  Zweite Zeile: Lehrkraft bzw. Klasse 12 px `--up-text-2`. Ohne Fachfarbe: `--up-schiefer-50` mit 1-px-Rand.
* **Status** wie in Abschnitt 2; Plaketten oben rechts in der Kachel, 10–11 px Großbuchstaben, Radius 3 px.
* **Jetzt-Linie:** 1 px Marine-600 mit kleinem Kreis am Zeitspaltenrand.
* **Auswahl/Fokus:** 2-px-Ring Marine-500 außen.

## 6. Bausteine

* **Knöpfe:** Höhe 32 px (dicht 28 px), Radius 6 px, 500. *Primär* Marine-600 weiß; *Sekundär* weiß mit Rand;
  *Still* ohne Rand, Hover `--up-flaeche-hover`; *Gefahr* Text/Rand rot.
* **Eingaben:** Höhe 32 px, Rand `--up-rand-stark`, Fokus Rand Marine-500 + 3-px-Ring Marine-100.
* **Tabellen:** Kopf 12 px/500 `--up-text-2` auf `--up-flaeche-2`, Zeilen 32 px (dicht 28 px), Zeilenwechsel ohne
  Zebrastreifen, Hover `--up-flaeche-hover`, Auswahl `--up-primaer-flaeche`.
* **Segmentschalter** für Ansichtswechsel (Tag/Woche, Klasse/Lehrkraft/Raum).
* **Plaketten:** 11 px/500, Radius 3 px, Fläche der Statusfarbe, Text der Statusfarbe.
* **Leere Zustände:** ein Linien-Symbol 24 px in `--up-text-3`, ein Satz, optional ein Knopf. Keine Illustrationen.

## 7. Aufbau je Produkt

| Produkt | Navigation |
|---|---|
| **Studio** | React 18 + TypeScript + Fluent UI v9 (`studio/client`), Fluent-Thema aus der Marken-Rampe Marine `#234f96` (hell, dunkel, automatisch), IBM Plex Sans, Status- und Fachfarben aus diesen Tokens. Seitenbasierte Web-Anwendung (eine Seite je Aufgabe, Adresse in der URL, Zurück-Taste funktioniert). Helle Seitenleiste (Fluent Nav) mit Linien-Symbolen vor den Bereichen, Seiten als Text; in schmalen Fenstern überlagernd. Kopfleiste mit Wortmarke, Schuldatei, Modus, Rückgängig/Speichern, Suche (Strg+K), Konto. Jede Seite: Seitenkopf (Bereich, Titel 20 px, Aktionen rechts), Werkzeugleiste mit Textknöpfen, Filterleiste, Inhalt, Fußzeile; Details in einem Nebenbereich rechts; Bearbeiten in Dialogen. Arbeitsplätze, die mehrere Inhalte gleichzeitig brauchen (Tagesplanung, manuelles Planen, Verlegen und Tauschen), sind fest gestaltete Seiten mit verschiebbaren Trennern – keine frei schwebenden Fenster. Keine Verläufe, keine Symbolkacheln. |
| **Web** | React 18 + TypeScript + MUI v7 (`web/client`), Thema aus diesen Tokens (Marine als Primärfarbe, Statusfarben, kein Orange). Klares Portal: Pillen-Knöpfe, runde Felder, weiche Karten mit Radius 12–14 px, Tabellen mit feinen Linien, Bearbeiten in Dialogen. Seitenleiste mit Linien-Symbolen vor den Bereichen (Unterpunkte als Text), abgerundete aktive Zeile, einklappbar zur Symbolleiste; mobil als Schublade. Eigener Stundenplan (Abschnitt 5: Zeitachse, Jetzt-Linie, Status-Legende) und eigene Klassenbuch-Seiten; Online-Unterricht nur als Schild mit Link (Umschalten in Studio/App). Keine Namen, Symbole oder Grafiken anderer Produkte. |
| **Mobile (PWA)** | Untere Leiste *Heute · Plan · Postfach · Mehr* (Linien-Symbol + Beschriftung, das ist auf Telefonen Standard), große Seitentitel, Listen statt Karten-Kacheln, keine Logo-Kachel. |
| **iOS** (UntPlan Next, `ios/`) | Tab-Leiste des Systems *Heute · Plan · Postfach · Suche* (Suche mit der Rolle „Suche“), Profil und Einstellungen als Blatt hinter dem Avatar oben rechts. Akzentfarbe **Petrol** `#0b5d57` (heller `#138a80`, dunkel `#3fb3a6`); Statusfarben bewusst weit davon entfernt: Änderung/Vertretung Violett `#6d4fc2`, Termin Magenta `#a3347c`, Prüfung Bernstein, Entfall Rot, Ferien Blau. **Liquid Glass** (iOS 26, Xcode 26) nur auf der Bedienebene über dem Inhalt – Tab-Leiste (klappt beim Rollen ein), schwebende Wochenleiste, Werkzeug- und Filterknöpfe, Bedienknöpfe der Jetzt-Karte, Knöpfe über dem Kopf der Stundenansicht; hervorgehobene Knöpfe Petrol-Glas. Inhalte (Kacheln, Karten, Listen) deckend; iOS 18 erhält dieselbe Form mit Material. Plan: Tag als Liste großer Kacheln (Fach und Raum groß, Änderungen mit gefüllter Plakette, Rahmen und Tönung, Pausen/Freistunden kompakt), waagrecht wischen = Tag, Wochenübersicht als Matrix, wahlweise Zeitachse. Systemschrift SF Pro mit Dynamic Type, Abstände im 8-pt-Raster. Die frühere App „UntPlan für iOS“ liegt nur noch als Archiv in `archiv/ios-alt/`. |

## 8. Sprache und Abgrenzung

* Produktname „UntPlan“, Bereiche „Studio“, „Web“, „Mobile“. Keine Namen, Logos, Symbole, Schriften oder
  wörtlich übernommenen Bezeichnungen anderer Hersteller.
* Dateiformate anderer Programme (z. B. GPU-Textdateien) werden nur als **Import/Export-Format** neutral benannt.
* Keine Formulierungen wie „wie im Original“, „Vorbild“ (für fremde Produkte), „vertraute Optik“ in Oberfläche, Code-Kommentaren oder Doku.
