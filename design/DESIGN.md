# UntPlan Designsystem

Verbindliche Gestaltungsgrundlage für **UntPlan Studio** (Planung im Browser), **UntPlan Web** (Portal für Lehrkräfte,
Schüler und Eltern), **UntPlan Mobile** (PWA) und **UntPlan für iOS**. Ziel: ein eigenständiges, sachliches und
hochwertiges Erscheinungsbild für den Einsatz an Schulen – erkennbar als *ein* Produkt, ohne Anlehnung an die
Gestaltung anderer Stundenplanprogramme.

## 1. Haltung

* **Werkzeug, nicht Werbung.** Dichte, gut lesbare Informationen; ruhige Flächen; eine Akzentfarbe.
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

## 4. Symbole

Linien-Symbole im Stil **Lucide** (ISC-Lizenz, `design/LUCIDE-LICENSE.txt`): 24×24, Strich 1,75 px, runde Enden,
`currentColor`. Größe 16 px (dicht) bzw. 20 px (Navigation). Keine farbigen oder zweifarbigen Symbole, keine
Symbolbilder aus anderen Produkten. iOS: SF Symbols.

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
| **Studio** | Dunkle Seitenleiste (Marine-900) mit Arbeitsbereichen und einklappbaren Gruppen, oben Dokumentleiste mit Dokumentwahl, Befehlssuche (Strg+K), Rückgängig/Wiederholen, Speichern, Modusschalter *Stundenplan / Vertretung*. Inhalte als Ansichten mit Reitern, optional geteilt (zwei Ansichten nebeneinander). Kein Menüband, keine schwebenden Fenster. |
| **Web** | Kopfleiste (Marine-900) mit Signet, Schulname, Hauptbereichen als horizontale Navigation, Suche, Mitteilungen, Konto. Darunter je Bereich eine Unternavigation als Reiterleiste. Telefon: untere Leiste mit vier Hauptpunkten + „Mehr“. |
| **Mobile (PWA)** | Untere Leiste *Heute · Plan · Postfach · Mehr*, große Seitentitel, Karten auf `--up-hintergrund`. |
| **iOS** | `TabView` *Heute · Plan · Postfach · Mehr* mit SF Symbols, `NavigationStack` mit großen Titeln, Akzentfarbe Marine. |

## 8. Sprache und Abgrenzung

* Produktname „UntPlan“, Bereiche „Studio“, „Web“, „Mobile“. Keine Namen, Logos, Symbole, Schriften oder
  wörtlich übernommenen Bezeichnungen anderer Hersteller.
* Dateiformate anderer Programme (z. B. GPU-Textdateien) werden nur als **Import/Export-Format** neutral benannt.
* Keine Formulierungen wie „wie im Original“, „Vorbild“, „vertraute Optik“ in Oberfläche, Code-Kommentaren oder Doku.
