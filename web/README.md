# EduOrga Web

**Einfach mehr Schulalltag.** EduOrga Web ist das Portal der Schule für Lehrkräfte, Schulleitung, Schüler*innen und Eltern:
Stundenpläne, Vertretungen, Klassenbuch, Kommunikation, Termine und Buchungen im Browser. EduOrga Studio (Planung) überträgt
Stammdaten, Stundenpläne und Vertretungen an EduOrga Web; Abwesenheiten, Raumbuchungen und Prüfungen, die im Browser eingetragen
werden, holt EduOrga Studio beim nächsten Datenaustausch ab. (Bis Oktober 2026 hieß das Produkt „UntPlan Web“. Technische
Kennungen – Docker-Image `untplannext-web`, Umgebungsvariablen `UNTPLANWEB_*`, Programmdatei `UntPlanWeb.dll`, Kopf
`X-UntPlanWeb` – bleiben unverändert, damit laufende Installationen ohne Umzug weiterarbeiten.)

![Stundenplan](docs/bilder/stundenplan.png)

> EduOrga ist ein privates Hobbyprojekt eines Auszubildenden zum Fachinformatiker für Systemintegration, entwickelt mit
> Unterstützung von Claude (Anthropic). Jede Schule bzw. jeder Betreiber ist für Einsatz, Betrieb und Datenschutz selbst verantwortlich.

## Oberfläche

Gestaltung nach der Marke EduOrga (`design/MARKE.md`) und dem Designsystem (`design/DESIGN.md`, Farben aus `design/tokens.css`):
Primärfarbe Petrol **#164C55** (Logo, Navigation, Knöpfe), Akzent **#28747A** (aktive Bereiche, Links, Fokus), Hintergrund
**#F5F7F8**, Text **#24363B**; Statusfarben Entfall Rot, Änderung/Vertretung **Violett #6d4fc2**, Prüfung Bernstein,
Termin **#a3347c**, Frei Blau. Sachlich wie ein Schulsystem: klare Linien, Abschnitte mit getöntem Kopfband, Tabellenköpfe
getönt, kein „alles weiß“. Hell und dunkel (Kontomenü: *Hell*, *Dunkel*, *Wie das System*). Aufgebaut als
**React-18-Anwendung mit TypeScript (strict) und MUI v7** in `web/client`; der Build landet in `src/UntPlanWeb/wwwroot` und wird
von ASP.NET Core als statische Dateien ausgeliefert (Hash-Routing, z. B. `#/plan/klasse/5a`). Schrift ist **IBM Plex Sans**
(SIL Open Font License, lokal unter `wwwroot/fonts`); Symbole sind die mitgebündelten Material-Symbole von MUI. Es werden keine
Schriften oder Skripte aus dem Internet geladen. Marke: Monogramm „E“ (`design/logo/edo-*.svg`) und Wortmarke „**Edu**Orga“;
Favicon, Manifest und PWA-Symbole (`wwwroot/img/…`, erzeugt mit `design/logo/icons_rendern.cjs`), Themenfarbe #164C55.

- **Seitenleiste links in Petrol** (`client/src/app`): Marke, Schulname und Schuljahr-Auswahl; Bereiche je nach Rolle und Rechten
  (Kollegium: *Start · Mein Tag · Stundenpläne · Vertretungen · Unterricht & Prüfungen · Klassenbuch · Kommunikation ·
  Termine & Buchungen · Stammdaten · Verwaltung*; Familien: *Start · Mein Tag · Mein Stundenplan · Stundenpläne ·
  Abwesenheit melden · Hausaufgaben · Kommunikation*). Klassische Zeilen über die volle Breite, aktive Zeile leicht getönt mit
  3-px-Kante links; unten Konto (Profil, Neuigkeiten, Erscheinungsbild, Konto wechseln, Über EduOrga, Abmelden) und
  *Navigation einklappen*. Auf Telefon und Tablet als Schublade über die Petrol-Kopfleiste.
- **Adressen:** alle bisherigen Adressen (`#/heute`, `#/uebersicht`, `#/melden/…`, `#/buchen/…`, `#/sprechtag`, …) bleiben gültig;
  zusätzlich sprechende Aliase wie `#/start`, `#/mein-tag`, `#/elternsprechtag`, `#/abwesenheit-melden`, `#/raum-buchen`.
- **Stundenplan** (`client/src/components/plan`, `client/src/pages/plan`): eigenes Wochen-/Tagesraster mit Zeitachse, Jetzt-Linie,
  Status-Legende und Stundendetails. Standard-Darstellung der Karten **„Klassisch“**: weiße, kompakte Karten mit leichtem Schatten
  auf hellgrauem Raster, Fachfarbe als schmaler Streifen innen links (grau ohne Fachfarbe), drei kurze Zeilen *Lehrkraft bzw.
  Klasse* (fett) · *Fach* · *Raum*, Doppelstunden als eine Karte; Entfall rot durchgestrichen und schraffiert, Vertretung/Änderung
  violett hinterlegt mit violetten Kürzel-Plaketten, offene Vertretung „?“, Prüfung bernstein. Weitere Vorlagen und alle
  Einzelwerte unter *Verwaltung | Darstellung der Stundenkarten* (mit Live-Vorschau). Online-Unterricht wird nur angezeigt;
  umgeschaltet wird in EduOrga Studio bzw. der App.
- **Datums- und Zeitfelder:** einheitlich MUI-Picker (`components/Auswahl.tsx`), Beschriftung steht immer oben im Rahmen, deutsche
  Platzhalter („TT.MM.JJJJ“), Mindestbreite je Art – das Kalendersymbol überdeckt keinen Text.
- **Klassenbuch-Seiten**, **Übrige Seiten** (Mein Tag, Start, Kommunikation, Unterricht, Vertretungen, Termine & Buchungen,
  Stammdaten, Verwaltung, Profil, Elternsprechtag): gemeinsame Bausteine (`client/src/components`: Seite, Tabelle, Auswahl,
  Formulardialoge).
- **Anmeldung** und **Einrichtungsassistent:** zweigeteilt – links Marke, Schulname, Datum, Slogan „Einfach mehr Schulalltag.“ und
  Hinweise der Schule auf Petrol, rechts das Formular; darunter *Über EduOrga* mit dem rechtlichen Hinweis.
- **Monitor** (`monitor.html`, `client/src/monitor`): Vertretungsplan für Bildschirme im Schulhaus auf dunkler Petrol-Fläche.

Ist die Oberfläche nicht gebaut (`wwwroot/index.html` fehlt), zeigt der Server eine kurze Hinweisseite. Docker-Image und CI bauen
die Oberfläche selbst; `index.html`, `monitor.html` und `assets/` werden nicht eingecheckt.

| Stundenplan | Stundendetails | Klassenbuch |
|---|---|---|
| ![Stundenplan](docs/bilder/stundenplan.png) | ![Stundendetails](docs/bilder/stundendetails.png) | ![Klassenbuch](docs/bilder/klassenbuch.png) |

| Offene Stunden | Heute | Vertretungsplan |
|---|---|---|
| ![Offene Stunden](docs/bilder/offene-stunden.png) | ![Heute](docs/bilder/heute.png) | ![Vertretungsplan](docs/bilder/vertretungsplan.png) |

| Anmeldung | Administration | Monitor |
|---|---|---|
| ![Anmeldung](docs/bilder/anmeldung.png) | ![Administration](docs/bilder/administration.png) | ![Monitor](docs/bilder/monitor.png) |

| Telefon: Stundenplan | Telefon: Menü | Telefon: Klassenbuch |
|---|---|---|
| ![Stundenplan auf dem Telefon](docs/bilder/stundenplan-telefon.png) | ![Menü auf dem Telefon](docs/bilder/menue-telefon.png) | ![Klassenbuch auf dem Telefon](docs/bilder/klassenbuch-telefon.png) |

### Anforderungskatalog (UW-03 … UW-17)

- **Unterrichtsstunde (UW-03):** Stundendetails als großes, zentriertes Fenster mit Reitern (vorher Seitenleiste rechts); Dialoge darüber.
- **Startseite (UW-05):** Datum, letzte Anmeldung und Planaktualisierung, *Nachrichten zum Tag* (RSS-Feed, Bearbeiten für
  Schulleitung/Administration, formatierte Tagestexte), Hinweis auf offene Stunden und *Mein nächster Unterricht* als Liste
  (Art, Stunde, Zeit, Klasse, Lehrkraft, Fach, Raum, Hinweise, Klassenbuch, Lehrstoff, Hausaufgaben). Ohne Unterricht heute zeigt
  die Liste den nächsten Unterrichtstag.
- **Schülerverwaltung (UW-06):** *Unterricht → Schüler\*in* (siehe Rollen).
- **Fehlzeiten (UW-07):** *Unterricht → Mein Unterricht* mit Aktivitätsart, Zeitraum und Zugängen zu Terminen, Schüler\*innen,
  Schülergruppen und Berichten; *Klassenbuch → Fehlzeiten* mit Zeitraum, Suche und Details.
- **Prüfungen, Prüfungskalender, Hausaufgaben (UW-08):** Prüfungsliste mit Suche, *Alle/Meine* und Zeitraum; Prüfungskalender als
  Jahresraster August–Juli mit Prüfungsart, Planung, *Mein Unterricht* und Legende; Hausaufgabenliste (Aufgabendatum, Fälligkeit,
  Fach, Erstellt von, Hausaufgabe, Anhänge).
- **Klassenbuch (UW-09):** Übersicht je Woche mit Lehrstoff, Abwesenheitskontrolle und Einträgen; Klassendienste mit Zeitansicht;
  Berichte in Abschnitten mit Anzeige, PDF und CSV. Die Schuljahr-Auswahl in der Seitenleiste bestimmt den Zeitraum der Listen.
- **Dialoge (UW-10):** *Lehrstoff* (mit Vorstunden zum Übernehmen, Lehrform, Anmerkung, „Geändert am … von …“), *Abwesenheit*
  und *Klassenbucheintrag* (mit „Noch mögliche Zeichen“) als Fenster über der Unterrichtsstunde; Lehrstoff steht direkt im Reiter *Stunde*.
- **Kopf der Stundendetails (UW-11, UW-12):** Klasse, Gruppe, Lehrkraft und Raum verlinken auf den Stundenplan; Änderungen als
  „B070 → C197“ (alter Wert durchgestrichen); Schilder für zusätzlichen Unterricht und Veranstaltungen.
- **Raumbuchung am Desktop (UW-13, UW-14):** Raum-Chip mit *Ersetzen*/*Löschen*, Plus für einen weiteren Raum, Auswahlliste mit
  Suche, Abteilung und Raumarten. Eine reine Raumbuchung ist nur eine Raumänderung der Stunde: kein Vertretungstext, keine Zeile im
  Vertretungsplan (Rückmeldung an EduOrga Studio als `raumbuchung` mit `unterrichtNr` und der neuen Raumliste). Raumbuchungen ohne
  Unterricht (*Buchen*) erscheinen nur im Raumplan.
- **Eigene Abwesenheit (UW-15):** Kacheln zeigen die vertretende Lehrkraft als Label (Hover „HOF → BEC“); eine wegfallende
  Bereitschaft ist Abwesenheit der eingeteilten Lehrkraft (Kachel gestrichelt, Kürzel durchgestrichen; im Vertretungsplan Art
  „Abwesenheit“).
- **Kacheln (UW-16, UW-17):** Ferien und freie Tage als Fläche je Tag, Aufsichten als schmale Leiste in der Pause, Hover nur auf
  Labels und Schildern (Label „B070 → C197“ über dem geänderten Wert).
- **Werkzeugleiste fixiert:** Elementwahl, Zeitraum, *Heute* und der Tageskopf bleiben beim Scrollen oben stehen.
- **Abwesende Klasse:** Klasse auf der Kachel durchgestrichen, Label „abwesend …“ (Grund nur fürs Kollegium); im Lehrerplan
  gestrichelt wie bei abwesender Lehrkraft. Nur ein echter Entfall bleibt Entfall.
- **Offene Raumvertretung** (Raum „???“): wie eine offene Lehrervertretung – bisheriger Raum durchgestrichen im Label.
- **Pausenaufsichten** im Menü *Ansicht*: *Normal*, *Halbiert* oder *Ausgeblendet*; neben einer durchgängigen Veranstaltung wird
  die Aufsicht automatisch schmal.
- **Zusatzstunden ohne Lehrkraft:** „---“ in Kachel, Details, Startseite und Vertretungsplan – nur bei Zusatzstunden.
- **Formatierte Tagestexte:** Liefert EduOrga Studio zu einem Tagestext zusätzlich `textHtml`, zeigt *Heute* den formatierten Text. Erlaubt
  sind nur `b`, `i`, `u`, `br`, `p` und `span style="color:…"`; alles andere wird als Text angezeigt (Bereinigung auf dem Server,
  zusätzlich im Browser). Monitor und Vertretungsplan zeigen den Klartext.

## Funktionen

Seiten (je nach Rolle):

| Bereich | Seiten |
|---|---|
| **Heute** | Startseite wie oben; die Startseite kann in der Administration auf *Übersicht* oder *Mein Stundenplan* umgestellt werden |
| **Übersicht** | Kennzahlen, Änderungen dieser und der nächsten Woche im eigenen Plan, anstehende Prüfungen und Hausaufgaben |
| **Mitteilungen** | Posteingang, Gesendet, Entwürfe, Empfängerlisten; neue Mitteilung mit Anhängen, Antworten, Weiterleiten, Drucken |
| **Stundenplan** | Mein Stundenplan, Klasse, Lehrkraft, Raum, Tag - Klassen, Tag - Lehrkräfte, Tag - Räume, Vertretungsplan (Klassenkonten: Mein Stundenplan, Weitere Stundenpläne) |
| **Unterricht** | Meine Unterrichte (Periode, Termine, Räume, CSV), Offene Stunden, Prüfungen |
| **Klassenbuch** | eigener Bereich mit Unternavigation: Wochenübersicht, Meine Stunden, Offene Stunden, Inhalte & Hausaufgaben, Hausaufgaben · Abwesenheiten (mit Meldungen der Eltern), Fehlzeiten, Befreiungen, Klassenbucheinträge · Klassendienste, Sitzplan, Auswertungen, Einstellungen |
| **Melden & Buchen** | Abwesenheit melden, Raum buchen, Prüfung eintragen, Meine Meldungen |
| **Unterricht** (Schülerverwaltung) | *Schüler\*in*: anzeigen, anlegen, bearbeiten, löschen je nach Rolle (siehe Rollen) |
| **Stammdaten** (Administration) | Klassen, Lehrkräfte, Fächer, Räume, Schüler*innen (aus EduOrga Studio, lesend), Abwesenheitsgründe, Klassendienste, Versionen (Übertragungsverlauf) |
| **Administration** | Übersicht & Synchronisation, Nachrichten zum Tag, Freie Tage & Ferien, Import, Export, Aktive Benutzer, Rechte und Rollen, Benutzer, Zuordnungsgruppen, Rückmeldungen, Prüfungssperren, Ansichtseinstellungen, Darstellung der Stundenkarten, Monitore, Protokoll |

Im Einzelnen:

- **Stundenpläne** für Klassen, Lehrkräfte und Räume:
  - Zeitraster mit Beginn/Ende je Stunde und Jetzt-Linie; gleichzeitige Stunden stehen nebeneinander, Aufsichten als schmale Zeilen in den Pausen.
  - Stundenkarten in hellen Statusfarben mit Akzentbalken in der Fachfarbe aus EduOrga Studio: Änderungen grün (geänderte Werte als grüne
    Kürzelbox), Entfall rot und durchgestrichen mit Dreieck, Prüfungen gelb mit Punkt, Veranstaltungen grün mit Plus.
  - **Vertretung ohne Lehrkraft** („+++“ in EduOrga Studio): Änderung, bei der die bisherige Lehrkraft durchgestrichen in der grünen Plakette steht
    (kein „???“ oder „+++“); ohne eigenen Vertretungstext steht „Vertr. o. Lehrkr.“ als Text.
  - **Kopplungen**: gekoppelte Stunden mit unterschiedlichen Fächern (z. B. KR und ER) oder in unterschiedlichen Räumen sind einzelne
    Karten. Nur bei gleichem Fach **und** gleichem Raum stehen mehrere Lehrkräfte bzw. Klassen auf einer Karte – dann mit allen
    beteiligten Klassen und Lehrkräften auf der Karte und in den Details (auch im Lehrerplan der beteiligten Lehrkräfte).
  - **Lehrkraft abwesend**: Im Plan der abwesenden Lehrkraft sind Stunden, die andere übernehmen, grau gestrichelt mit dem eigenen
    Kürzel durchgestrichen in der Plakette (Hinweis „abwesend …“ über dem Tag) – nur ein echter Entfall bleibt rot.
  - **Symbole unten rechts**: Info-Symbol bei Notizen für Schüler*innen/Lehrkräfte oder Vertretungstext (Text als Hinweis), Hausaufgaben-
    Symbol in der Stunde, zu der eine Hausaufgabe fällig ist.
  - **Fachwechsel**: die ursprüngliche Stunde erscheint als Entfall, die neue Stunde als geänderte Kachel daneben.
  - **Veranstaltungen** als Zusatzkarten mit Klassen, teilnehmenden Lehrkräften (gekürzt „BEC, BRA, FIS +12“, vollständig in den Details)
    und Raum; Veranstaltungen mit Raum stehen auch im Raumplan und in *Tag - Räume*.
  - Ferien, Feiertage und freie Tage (auch die in der Administration angelegten) als Fläche mit Schloss; Elementwahl mit Vor/Zurück (auch Alt+←/→).
  - **Gleichzeitige Stunden** in einer Stunde: in der Woche (und ab fünf Stunden in der Tagesansicht) steht die erste Stunde über die
    volle Breite, rechts oben ein kleines **„+X“**; ein Klick darauf listet alle gleichzeitigen Stunden (Fach, Lehrkraft bzw. Klasse,
    Stunde, Raum, Status), jede öffnet ihre Stunde. Stunden ohne Fachfarbe zeigen immer den **grauen Balken** links (hell und dunkel
    gut sichtbar, Themenfarbe `kachel.balken`).
  - **Unterrichtsstunde:** Ein Klick auf eine Stunde öffnet ein großes, zentriertes Fenster (ca. 94 % × 90 % des Bildschirms, auf dem
    Telefon Vollbild) – siehe *Klassenbuch* unten. Termine, Buchungen und Vormerkungen zeigen nur ihre Angaben (kleines Fenster).
  - Bereitschaften, Raumbuchungen und Vormerkungen; Druck, Telefonansicht mit Tagesauswahl.
- **Tagesübersicht** (Kollegium): alle Klassen, Lehrkräfte oder Räume eines Tages auf einen Blick.
- **Vertretungsplan** als Schüler- oder Lehrerversion; die Schülerversion zeigt keine Abwesenheitsgründe, Bereitschaften oder Aufsichten.
  Aufeinanderfolgende Stunden werden zusammengefasst („3–4“).
- **Monitore:** Vertretungsplan für Info-Bildschirme über einen geheimen Link (ohne Anmeldung), mit Uhr, automatischem Bildlauf,
  einstellbarer Aktualisierung, Nachrichten in der Kopfzeile oder als Laufschrift, optional nur öffentliche Nachrichten.
- **Nachrichten zum Tag** mit Betreff, Zeitraum oder Wochentag, Reihenfolge, Zielgruppen, Anzeige auf Startseite, Monitor und Mobil-App,
  „öffentlich“ für den RSS-Feed (`/rss/nachrichten.xml`, in den Ansichtseinstellungen einschaltbar).
- **Melden & Buchen** (Lehrkräfte): Abwesenheit melden, freien Raum buchen (nur Räume „buchbar (Web)“), Prüfung eintragen. Die Meldungen gehen
  als Rückmeldungen an EduOrga Studio; Buchungen erscheinen sofort als „vorgemerkt“.
- **Klassenbuch** – eigener Bereich mit **Unternavigation** (am Desktop links neben dem Inhalt, auf Tablet/Telefon als Reiterleiste),
  im Hauptmenü nur die Einstiege *Wochenübersicht · Meine Stunden · Offene Stunden · Abwesenheiten*; alle bisherigen Adressen
  (`#/offen`, `#/eintraege`, `#/hausaufgaben`, `#/abwesenheiten`, `#/entschuldigen`, `#/befreiungen`, `#/dienste`, `#/berichte`,
  `#/sitzplan`, `#/kbeinstellungen`, `#/klassenbuch/<Klasse>/(woche|fehlzeiten|verlauf|vermerke)`) bleiben gültig, dazu Aliase wie
  `#/offene-stunden`, `#/wochenuebersicht`, `#/klassendienste`, `#/auswertungen`. Angezeigt wird nur, was das Konto darf (gleiche
  Rechte wie der Server: Kollegium, Klassenleitung, Schulleitung/Administration; Eltern und Schüler*innen haben eigene Seiten).
  - **Unterricht:** *Wochenübersicht* einer Klasse (Raster Mo–Fr, auf dem Telefon Tagesliste) mit dem **Stand jeder Stunde** –
    *Dokumentiert* (Thema und Anwesenheitskontrolle), *Offen* (mit „Thema fehlt“/„Anwesenheit offen“), *Entfallen*, *Geplant* –,
    Kennzahlen, Filter *Nur offene*, *Gehe zu* (Datum), Legende und Klassenbucheinträge der Woche; *Meine Stunden* (alle eigenen
    Unterrichte des Schuljahres, Schulleitung/Administration: Suche nach Klasse, Lehrkraft, Fach); **Offene Stunden** als Arbeitsliste;
    *Inhalte & Hausaufgaben*; *Hausaufgaben*.
  - **Schüler\*innen:** *Abwesenheiten* mit Reiter **Meldungen der Eltern** (siehe unten), *Fehlzeiten der Klasse*, *Fehlzeiten eigener
    Unterricht*, *Befreiungen*, *Klassenbucheinträge*.
  - **Klasse:** *Klassendienste* (Liste und Zeitansicht, automatische Verteilung), *Sitzplan*, *Auswertungen* (Berichte mit Vorschau,
    Druck, CSV), *Einstellungen*.
  - **Fenster „Unterrichtsstunde“** (aus Stundenplan, Wochenübersicht, Meine Stunden, Offene Stunden, Startseite): fester Kopf mit Fach,
    Datum, Stunde und Zeit, Klasse, Lehrkraft, Raum (Links auf die Pläne, Änderungen „alt → neu“), Stand der Dokumentation, Blättern
    (*2 von 9*, Alt+←/→), Wahl *Ganzer Block / Einzelstunde* und Menü *…* (Klassenbuch der Klasse, Mitteilung, Ticket an
    Schulleitung/Administration, Anzeige der Schülerliste, Drucken, Tastenkürzel). Reiter (Alt+1…5):
    - *Stunde*: **Thema und Inhalt** (Lehrstoff, Lehrform, Anmerkung, Lehrstoff aus Vorwochen übernehmen/anhängen), **Hausaufgaben**
      direkt anlegen mit Fälligkeit (Vorschlag *nächste Stunde* bzw. *in einer Woche*, Strg+Enter), **Bemerkungen** für Schüler*innen
      und für Lehrkräfte, „Findet online statt“ (nur Anzeige, festgelegt in EduOrga Studio), Hinweise (Vertretungstext, Prüfung,
      Verlegung), Räume ersetzen/hinzufügen, Klassendienste des Tages.
    - *Anwesenheit*: schnelle **Liste** (je Schüler*in *Anwesend · Abwesend · Verspätet · Früher weg* mit Minuten, Entschuldigungsstatus,
      Bearbeiten mit Zeitraum/Grund/Status) oder **Sitzplan** (Klick = anwesend/abwesend), Mehrfachauswahl (*Abwesend*, *Abwesenheit mit
      Zeitraum …*, *Klassenbucheintrag …*), Hinweise auf **gemeldete Abwesenheiten** der Eltern (*Als abwesend eintragen*),
      Abwesenheiten aus einer früheren Stunde (*Für diese Stunde übernehmen*) und **Befreiungen**; *Anwesenheit bestätigen* bzw.
      *Alle anwesend – bestätigen* schließt die Kontrolle ab.
    - *Einträge*: Klassenbucheinträge der Klasse (dieser Tag, 7 Tage, Schuljahr; nach Schüler*in und Kategorie), *Neuer Eintrag*.
    - *Prüfungen*: Prüfungen der Klasse vier Wochen zurück bis drei Monate voraus, *Prüfung in dieser Stunde erstellen* bzw. bearbeiten/löschen.
    - *Verlauf*: alle Stunden dieses Unterrichts (8 Wochen bzw. Halbjahr) mit Thema, Hausaufgabe und Abwesenden; jede Zeile öffnet die Stunde.
    - Alle Eingaben werden **automatisch gespeichert** (kurz nach der Eingabe, beim Verlassen eines Felds, beim Blättern und Schließen;
      Strg+S sofort); der Fuß zeigt *Alle Änderungen gespeichert · 10:42* bzw. einen Fehler mit *Erneut versuchen*.
  - **Abwesenheitsmeldungen (Eltern melden → Klassenleitung bestätigt):** Eltern- und Schülerkonten melden unter *Abwesenheit melden*
    ganze Tage (höchstens 30, bis 14 Tage rückwirkend, bis 90 Tage voraus) mit Grund und Nachricht und sehen den Status (*gemeldet*,
    *bestätigt*, *abgelehnt* mit Antwort); solange nicht bearbeitet, lässt sich die Meldung zurückziehen. Die Klassenleitung (bzw. wer
    Abwesenheiten aller Klassen verwaltet) sieht die Meldungen unter *Klassenbuch → Abwesenheiten → Meldungen der Eltern* (Zahl auch in
    der Unternavigation) und **bestätigt** sie – dabei entsteht die Abwesenheit für alle Unterrichtsstunden der Tage, auf Wunsch gleich
    entschuldigt (Recht *Entschuldigen*) – oder **lehnt** sie mit Begründung **ab**. Lehrkräfte sehen gemeldete Abwesenheiten in der
    Anwesenheit ihrer Stunde (ohne Nachrichtentext).
  - **Abwesenheiten:** neu anlegen (mehrere Tage/Stunden, Grund), bearbeiten, löschen, zusammenfassen, entschuldigen, zuletzt verwendete
    Texte; Filter nach Zeitraum, Klasse, Grund und Status, CSV; Reiter *Meine Abwesenheiten*. Dafür überträgt EduOrga Studio die Schülerliste.
  - **Fehlzeiten:** Summen je Schüler (Stunden, Tage, entschuldigt, unentschuldigt, offen, Verspätungen), ganze Fehltage in einem Schritt.
  - **Klassenbucheinträge**, **Hausaufgaben** wie bisher; Klassenkonten zusätzlich mit Reiter *Lehrstoff*.

| Wochenübersicht | Unterrichtsstunde | Anwesenheit |
|---|---|---|
| ![Klassenbuch: Wochenübersicht](docs/bilder/klassenbuch.png) | ![Unterrichtsstunde](docs/bilder/stundendetails.png) | ![Anwesenheit](docs/bilder/klassenbuch-anwesenheit.png) |

| Offene Stunden | Abwesenheiten: Meldungen der Eltern | Eltern: Abwesenheit melden |
|---|---|---|
| ![Offene Stunden](docs/bilder/offene-stunden.png) | ![Meldungen der Eltern](docs/bilder/abwesenheiten.png) | ![Abwesenheit melden](docs/bilder/abwesenheit-melden.png) |

- **Prüfungen:** Klausuren aus EduOrga Studio und in EduOrga Web vorgemerkte Prüfungen, Filter nach Zeitraum, Klasse und Lehrkraft, CSV.
- **Mitteilungen** zwischen Kollegium, Schulleitung und Klassen (Gruppen, Klassen, einzelne Benutzer, eigene Empfängerlisten),
  Entwürfe und Anhänge (bis 5 Dateien à 10 MB).
- **Profil:** Name, E-Mail, Sprache, Benachrichtigungen, Passwort (Regeln aus *Rechte und Rollen*), Kalenderabo (iCal).
- **Konto wechseln:** mehrere Konten auf einem Gerät merken und ohne neue Anmeldung wechseln (Gerätecookie, 30 Tage).
- **Administration:** Verbindung mit EduOrga Studio (Schul-ID, API-Schlüssel), Paket-Upload, Benutzer (auch automatisch aus den Stammdaten,
  CSV-Import mit Vorschau, Sammelaktionen Sperren/Entsperren/Löschen/E-Mail übernehmen/Inaktive sperren, Bericht), Freie Tage,
  Export (CSV), Aktive Benutzer, Passwortregeln, Zuordnung der Schulleitung, Prüfungssperren, Ansichtseinstellungen (Startseite, RSS),
  Rückmeldungen, Nachrichten zum Tag, Monitore, Protokoll.
- **Darstellung der Stundenkarten** (Administration, `#/admin/stundenkarten`): schulweit festlegen, wie Stunden in Wochen- und
  Tagesansicht (auch mobil), auf den Tagesseiten, der Startseite, der Übersicht und im Kopf der Stundendetails erscheinen –
  Fachfarbe als Quadrat (Standard), Akzentbalken links bzw. oben (2–6 px), leichte Tönung der Fläche (6–30 %) oder keine;
  Kartenfläche neutral/weiß/getönt, Rahmen fein/kräftig/keiner, Eckenradius 0–8 px, Dichte kompakt/normal/großzügig; Inhalt:
  Fach als Kürzel oder ausgeschrieben, Raum an/aus, Zeile 2 (Lehrkraft bzw. Klasse) an/aus als Kürzel oder Name, unveränderte
  Kürzel gefüllt/umrandet/als Text, optional Statuswörter auf den Kacheln. Vorlagen „Sachlich (Standard)“, „Akzentbalken“,
  „Farbfläche“ und „Minimal“; rechts eine Live-Vorschau mit der echten Kachel (Woche/Tag, Vertretung, Raumänderung, Entfall,
  offene Vertretung, Prüfung, Termin, Online, Doppelstunde). *Speichern* gilt für alle Konten (mit der nächsten Sitzung),
  *Zurücksetzen auf Standard* stellt die Grunddarstellung wieder her. Die Statusdarstellung (Linie, Schraffur, Durchstreichung,
  Kürzel-Plaketten) bleibt in jeder Variante erhalten; ausgeblendete Räume bzw. Lehrkräfte erscheinen bei Änderungen trotzdem.
- **Mobil-App:** [EduOrga Mobile](../mobile/README.md) bringt Stundenplan, Klassenbuch und Mitteilungen als installierbare
  App aufs Telefon. Sie läuft als eigener Container (Port 8081) und holt ihre Daten über die JSON-API von UntPlanWeb.

| Mein Stundenplan | Übersicht | Lehrerplan |
|---|---|---|
| ![Stundenplan](docs/bilder/stundenplan.png) | ![Übersicht](docs/bilder/uebersicht.png) | ![Lehrerplan](docs/bilder/lehrerplan.png) |

| Vertretungsplan | Tag - Räume | Abwesenheiten |
|---|---|---|
| ![Vertretungsplan](docs/bilder/vertretungsplan.png) | ![Tag - Räume](docs/bilder/tagesuebersicht.png) | ![Abwesenheiten](docs/bilder/abwesenheiten.png) |

| Administration: Benutzer |
|---|
| ![Administration](docs/bilder/administration.png) |

### Weitere Endpunkte der App-Schnittstelle

Zusätzlich zu Plan, Vertretungen, Klassenbuch und Mitteilungen (alle unter `/api/app`, Anmeldung per Sitzungscookie):

| Aufruf | Zweck |
|---|---|
| `GET /api/app/unterricht?lehrer=&klasse=` | Unterrichte der gültigen Periode (Kollegium) |
| `GET /api/app/pruefungen?von=&bis=&klasse=&lehrer=` | Prüfungen (Klassenkonten: nur eigene Klasse) |
| `GET /api/app/hausaufgaben?von=&bis=&klasse=&lehrer=` | Hausaufgaben nach Fälligkeit |
| `GET /api/app/klassenbucheintraege?von=&bis=&klasse=&art=` | Vermerke über alle oder eine Klasse |
| `GET /api/app/abwesenheiten?von=&bis=&klasse=&status=` | Schülerabwesenheiten, Stunden eines Tages zusammengefasst |
| `POST/PUT /api/app/abwesenheiten`, `POST …/loeschen`, `POST …/zusammenfassen`, `GET …/texte` | Abwesenheiten anlegen, ändern, löschen, zusammenfassen, letzte Texte |
| `GET/POST /api/app/familie/meldungen`, `DELETE …/{id}` | Abwesenheitsmeldungen der Eltern bzw. Schüler*innen (nur zugeordnete Kinder; zurückziehen, solange nicht bearbeitet) |
| `GET /api/app/abwesenheiten/meldungen?status=&klasse=`, `POST …/{id}/bestaetigen` { entschuldigt, antwort }, `POST …/{id}/ablehnen` { antwort } | Meldungen der eigenen Klassen (Klassenleitung, Recht „Abwesenheiten aller Klassen“) bestätigen (trägt die Abwesenheit ganztägig ein) bzw. ablehnen; `GET /api/app/klassenbuch/anwesenheit` liefert zusätzlich `meldungen` des Tages |
| `GET /api/app/berichte/fehlzeiten?klasse=&von=&bis=&format=csv` | Fehlzeitenbericht (JSON oder CSV) |
| `GET /api/app/berichte/lehrstoff?klasse=&von=&bis=&format=csv` | Lehrstoffbericht (JSON oder CSV) |
| `GET /api/app/berichte/liste`, `GET /api/app/berichte/erstellen/{art}?…&format=csv` | alle Berichtsarten, Bericht erstellen |
| `GET /api/app/klassenbuch/offen?tage=` | eigene Stunden ohne Lehrstoff (Standard 14 Tage) |
| `GET/POST /api/app/klassenbuch/hausaufgabenliste`, `PUT/DELETE …/{id}` | Hausaufgaben einer Stunde (Text, Fälligkeit, Bemerkung, erledigt) und die in der Stunde fälligen |
| `POST /api/app/klassenbuch/abwesenheit/verlaengern` | Abwesenheiten aus der Vorstunde bis Stundenende bzw. bis zum Tagesbeginn verlängern |
| `GET /api/app/darstellung`, `PUT …` (Administration), `DELETE …` (Administration: Standard) | Darstellung der Stundenkarten (auch in `GET /api/app/sitzung` als `darstellung`); gespeichert in `einstellungen` (`einstellung:kartendarstellung`), ungültige Werte → 400 |
| `GET /api/app/start` | Daten der Startseite *Heute* (Nachrichten mit `textHtml`, nächster Unterricht) |
| `GET/POST /api/app/schueler`, `PUT/DELETE …/{id}` | Schülerverwaltung (Rechte siehe Rollen) |
| `POST /api/app/meldungen/raumaenderung` | Raum einer Stunde ersetzen, löschen oder zusätzlichen Raum buchen (`raeume` = neue Raumliste) |
| `GET /api/app/klassenbuch/uebersicht?bis=&tage=&klasse=&lehrer=` | Klassenbuch-Übersicht je Tag |
| `GET /api/app/klassenbuch/lehrstoff/vorstunden?datum=&stunde=&unterricht=` | Lehrstoff der letzten Stunden (Dialog *Lehrstoff*) |
| `GET /api/app/klassenbuch/stunden?von=&bis=&lehrer=&klasse=` | offene Stunden (Abwesenheitskontrolle/Lehrstoff) |
| `PUT /api/app/klassenbuch/online` | Stunde „findet online statt“ |
| `GET /api/app/abwesenheitsgruende` | Abwesenheitsgründe |
| `GET/POST /api/app/klassendienste`, `POST …/woche`, `POST …/automatisch`, `PUT/DELETE …/{id}` | Klassendienste |
| `GET/POST /api/app/befreiungen`, `PUT/DELETE …/{id}`, `GET /api/app/klassenbuch/befreit` | Befreiungen |
| `GET/PUT /api/app/sitzplan/{klasse}` | Sitzplan |
| `POST /api/app/mitteilungen/entwurf`, `POST …/{id}/senden`, `…/listen`, `…/{id}/anhaenge`, `GET /api/app/mitteilungen/anhang/{id}` | Entwürfe, Empfängerlisten, Anhänge |
| `GET /api/app/konten`, `POST …/{id}/wechseln`, `DELETE …/{id}` | gemerkte Konten auf diesem Gerät |
| `GET /api/app/stammdaten/{art}` | Stammdaten lesend (Administration) |
| `/api/app/admin/gruende`, `…/dienstarten`, `…/freietage`, `…/einstellungen/{bereich}`, `…/benutzer/aktion`, `…/import/pruefen`, `…/import/uebernehmen` | Verwaltung (Administration) |
| `GET /rss/nachrichten.xml` | öffentliche Nachrichten zum Tag als RSS (wenn eingeschaltet) |

### Buchungsmodul (Menü „Termine & Buchungen“)

Räume, mobile Ressourcen und Aktivitäten buchen – einmalig oder periodisch (Zeitraum, Wiederholung jede/jede 2./… Woche bzw. täglich,
Wochentage, Stunden oder Uhrzeit; unterrichtsfreie Tage werden übersprungen). Mehrere Termine bilden eine Serie (`serie`), die einzeln oder
gesamt (kommende Termine) storniert werden kann. Die Konfliktprüfung auf dem Server berücksichtigt Unterricht laut Plan, Klausuren, Termine
mit Raum, Raumsperren, Vormerkungen und andere Buchungen; bei Ressourcen die Anzahl. „Maximale Belegung %“ zeigt auch Räume, die an höchstens
so vielen Terminen belegt sind – für diese Termine wird ein anderer Raum gewählt. Lehrkräfte, Schulleitung und Administration buchen; die
Administration sieht alle Buchungen, storniert jede und pflegt Ressourcenarten, Ressourcen (fest in einem Raum oder mobil mit Anzahl) und
Raumdaten (Kapazität, Gebäude, Abteilung, Raumgruppe; Raumart und „buchbar“ kommen aus EduOrga Studio). Unter *Unterricht → Neuer Unterricht*
wird Unterricht angelegt, dessen Stunden als *Zusätzliche Stunden* gebucht werden.

| Aufruf (`/api/app/buchen…`) | Zweck |
|---|---|
| `GET /optionen` | Räume mit Stammdaten und festen Ressourcen, Ressourcenarten, Ressourcen, Auswahllisten, Zeitraster |
| `POST /termine` `{ wiederholung, datum \| von, bis, wochentage, stundeVon, stundeBis \| beginn, ende }` | Einzeltermine eines Zeitbereichs |
| `POST /suche/raeume`, `POST /suche/ressourcen` `{ zeit, kriterien }` | freie Räume bzw. Ressourcen; je Termin die freien Räume (`freieRaeume`), je Raum `belegt` (Terminindizes) und `prozent` |
| `POST /hinweise` | Lehrkraft bzw. Klasse hat zur gleichen Zeit schon Unterricht/Aktivität (kein Hindernis) |
| `POST /` `{ art, termine: [{ datum, stundeVon, stundeBis, raum }], ressourcen: [{ id, menge }], klassen, lehrer, fach, titel, text, benachrichtigen, unterrichtId, beginn, ende }` | speichern (`art`: raum, ressource, aktivitaet, unterricht); belegt → HTTP 400 mit allen Konflikten |
| `GET /liste?von=&bis=&alle=`, `GET /{id}`, `DELETE /{id}?serie=true` | Meine Buchungen (alle: nur Administration), Storno |
| `GET /raumuebersicht?datum=&tage=&raumart=&gebaeude=&abteilung=&raumgruppe=&kapazitaet=&ressourcenarten=` | Belegung der buchbaren Räume je Stunde (`art`: unterricht, klausur, termin, buchung, vorgemerkt, gesperrt) |
| `GET /ressourcenuebersicht?datum=&arten=1,2` | Woche – Ressourcen |
| `GET/POST /unterricht`, `DELETE /unterricht/{id}` | in EduOrga Web angelegter Unterricht |
| `/ressourcenarten`, `/ressourcen` (GET, POST, PUT/DELETE `/{id}`), `PUT /raumdaten/{raum}` | Verwaltung (Administration) |

In den Plänen (Web, `GET /api/app/plan`, `/tag`, `/heute`, `/start` für PWA und iOS) erscheinen Buchungen als zusätzliche Karte ohne
Vertretung: Raumbuchung und zusätzliche Stunde mit `status: "buchung"`, `art: "Raumbuchung"` bzw. `"Raumbuchung (Zusätzlicher Unterricht)"`,
Aktivität mit `status: "veranstaltung"`, `art: "Veranstaltung (Aktivität)"`; `text` = Titel, dazu `fach`, `klassen`, `lehrer`, `raeume`,
`unterricht` und `vertretung` sind `null`. Reine Ressourcenbuchungen erscheinen nur in den Buchungslisten. Nie entsteht ein Vertretungstext
oder Vertretungsstatus. An EduOrga Studio gehen Raumbuchungen, Aktivitäten und zusätzliche Stunden über die bestehende Rückmeldungs-Schnittstelle
als Typ `raumbuchung` (Id `buchung-{Nummer}`, mit `fach` bei Aktivitäten); nach dem Quittieren gelten sie als übertragen und werden nicht
doppelt angezeigt, sobald EduOrga Studio sie im Paket zurückliefert.

## Installation mit Docker

Voraussetzung: ein Server oder NAS mit Docker (Linux, amd64 oder arm64). Standardmäßig liegt die Datenbank (SQLite) im Container-Volume, ein eigener Datenbankserver ist nicht nötig.
Für größere bzw. produktive Installationen kann stattdessen MariaDB oder MySQL verwendet werden (siehe [Installation mit MariaDB/MySQL](#installation-mit-mariadbmysql)).

```bash
mkdir untplanweb && cd untplanweb
curl -O https://raw.githubusercontent.com/florians25/UntPlanNext/master/web/docker-compose.yml
docker compose up -d
```

Dann im Browser `http://<server>:8080` öffnen. Der Einrichtungsassistent legt die Schule und das Administrationskonto an und zeigt
**Schul-ID** und **API-Schlüssel** für EduOrga Studio an.

**Mit HTTPS** (empfohlen, automatisches Let's-Encrypt-Zertifikat über Caddy). Voraussetzung: ein DNS-Name, der auf den Server zeigt, und die Ports 80 und 443:

```bash
curl -O https://raw.githubusercontent.com/florians25/UntPlanNext/master/web/docker-compose.https.yml
curl -O https://raw.githubusercontent.com/florians25/UntPlanNext/master/web/Caddyfile
UNTPLANWEB_DOMAIN=plan.meine-schule.de docker compose -f docker-compose.https.yml up -d
```

**Ausprobieren mit Beispieldaten:**

```bash
docker run --rm -p 8080:8080 -e UNTPLANWEB_DEMO=1 -e UNTPLANWEB_ADMIN_PASSWORT=admin12345 ghcr.io/florians25/untplannext-web
```

Anmeldung als `admin` / `admin12345`. Die Beispielwoche wird automatisch auf die aktuelle Woche verschoben.

**Selbst bauen** (Wurzel des UntPlan-Repositorys): `docker build -f web/Dockerfile -t untplanweb .`

### Einstellungen (Umgebungsvariablen)

| Variable | Bedeutung | Standard |
|---|---|---|
| `UNTPLANWEB_DATEN` | Datenordner (Datenbank, Schlüssel) | `/data` |
| `UNTPLANWEB_ZEITZONE` | Zeitzone der Schule | `Europe/Berlin` |
| `UNTPLANWEB_ADMIN_PASSWORT` | legt beim ersten Start den Benutzer `admin` an (statt Assistent) | – |
| `UNTPLANWEB_SCHUL_ID` | feste Schul-ID | aus dem Schulnamen |
| `UNTPLANWEB_API_SCHLUESSEL` | fester API-Schlüssel für EduOrga Studio | wird erzeugt |
| `UNTPLANWEB_DEMO` | `1` = Beispieldaten laden, solange noch keine Daten vorhanden sind | – |
| `UNTPLANWEB_MOBILE_URL` | erlaubte Adresse(n) von EduOrga Mobile für die Einmalanmeldung (kommagetrennt) | gleicher Rechnername |
| `UNTPLANWEB_DB` | Datenbank: `sqlite` oder `mysql` (auch `mariadb`) | `sqlite` |
| `UNTPLANWEB_DB_CONNECTION` | Verbindung zu MySQL/MariaDB: `Server=…;Port=3306;Database=…;User ID=…;Password=…` oder `mysql://benutzer:passwort@host:3306/datenbank` | – |
| `UNTPLANWEB_DB_WARTEN` | Sekunden, die beim Start auf den Datenbankserver gewartet wird | `60` |
| `UNTPLANWEB_UPDATE_PRUEFEN` | `0` = nicht nach neuen Versionen suchen | an |
| `UNTPLANWEB_UPDATE_URL` | Quelle der neuesten Version (GitHub-API `…/releases/latest`, `…/releases`, `…/tags`, `ghcr://besitzer/image` oder eigene Adresse mit `{"version":"…"}` bzw. Text) | GitHub-Releases von florians25/UntPlanNext (`https://api.github.com/repos/florians25/UntPlanNext/releases/latest`) |
| `UNTPLANWEB_UPDATE_TAG_PRAEFIX` | nur Tags mit diesem Präfix berücksichtigen (z. B. `web-v`) | – |
| `UNTPLANWEB_UPDATE_MODUS` | „Update installieren“: `aus`, `watchtower` oder `datei` | `watchtower`, wenn eine Watchtower-Adresse gesetzt ist, sonst `aus` |
| `UNTPLANWEB_UPDATE_WATCHTOWER_URL`, `…_TOKEN` | HTTP-API von Watchtower, z. B. `http://watchtower:8080/v1/update`, und deren Token | – |
| `UNTPLANWEB_MOBILE_INTERN_URL` | Adresse von EduOrga Mobile aus Sicht des Servers (Versionsanzeige in der Administration), z. B. `http://untplanmobile:8081` | – |
| `UNTPLANWEB_SITZUNG_TAGE` | Gültigkeit der Anmeldung in Tagen (gleitend, 1–90) | `14` |
| `UNTPLANWEB_SICHERE_COOKIES` | `1` = Anmelde- und Gerätecookie nur über HTTPS (hinter Caddy/Reverse-Proxy empfohlen) | wie die Anfrage |
| `UNTPLANWEB_AUFBEWAHRUNG` | `0` = täglichen Löschlauf nach den Aufbewahrungsfristen abschalten (z. B. Testsysteme) | an |

### Installation mit MariaDB/MySQL

SQLite bleibt der Standard (und wird für die Tests verwendet). Für produktive Installationen mit vielen Benutzer*innen oder
vorhandener Datenbank-Infrastruktur kann EduOrga Web MariaDB (ab 10.5) oder MySQL (ab 8.0.13) verwenden. Die Datei
`docker-compose.mariadb.yml` startet EduOrga Web zusammen mit einem MariaDB-Dienst (eigenes Volume, Healthcheck; EduOrga Web
startet erst, wenn die Datenbank bereit ist):

```bash
mkdir untplanweb && cd untplanweb
curl -O https://raw.githubusercontent.com/florians25/UntPlanNext/master/web/docker-compose.mariadb.yml
curl -O https://raw.githubusercontent.com/florians25/UntPlanNext/master/web/update.sh && chmod +x update.sh
cat > .env <<'EOF'
MARIADB_PASSWORT=ein-langes-passwort
MARIADB_ROOT_PASSWORT=ein-anderes-langes-passwort
WATCHTOWER_TOKEN=ein-zufaelliger-token
EOF
docker compose -f docker-compose.mariadb.yml up -d
```

Tipp: `export COMPOSE_FILE=docker-compose.mariadb.yml` (oder `COMPOSE_FILE=…` in `.env`) erspart das `-f` bei allen weiteren Befehlen.

Eigener Datenbankserver statt Container: `UNTPLANWEB_DB=mysql` und
`UNTPLANWEB_DB_CONNECTION=Server=db.schule.local;Database=untplanweb;User ID=untplanweb;Password=…` setzen. Die Datenbank
muss existieren (Zeichensatz `utf8mb4`), der Benutzer braucht alle Rechte darauf. Tabellen und Migrationen legt EduOrga Web beim
Start selbst an. Ein Passwort mit `;` in Anführungszeichen setzen (`Password="a;b"`) oder die Form `mysql://…` mit URL-Kodierung
verwenden. Das Volume `/data` bleibt auch mit MySQL nötig (Schlüssel der Anmelde-Cookies, Sicherungen, Update-Anforderungen).

Technik: Die Befehle und Migrationen sind im SQLite-Dialekt geschrieben; eine schlanke Provider-Abstraktion
(`Daten/Dialekt.cs`, Paket MySqlConnector) übersetzt die Unterschiede zentral – `AUTOINCREMENT`/`AUTO_INCREMENT`,
`ON CONFLICT … DO UPDATE`/`ON DUPLICATE KEY UPDATE`, `INSERT OR REPLACE/IGNORE`, `datetime('now')`, `last_insert_rowid()`,
`COLLATE NOCASE`, Texttypen mit Index (`VARCHAR(255)`) bzw. ohne (`LONGTEXT`), Fremdschlüssel. Booleans werden als 0/1
gespeichert, `LIMIT` ist gleich. Alle Tests laufen mit SQLite; mit `UNTPLANWEB_TEST_MYSQL` zusätzlich gegen MySQL/MariaDB
(siehe [Entwicklung](#entwicklung)).

### Update

Ein Update ist immer ein neues Container-Image. Die Datenbank-Migrationen laufen beim Start automatisch (SQLite und MySQL);
eine Sicherung vorher wird dringend empfohlen – bei MySQL/MariaDB schließen Schemaänderungen Transaktionen implizit ab.

```bash
./update.sh                       # Sicherung, docker compose pull, docker compose up -d
# oder von Hand:
docker compose exec untplanweb dotnet UntPlanWeb.dll --sichern      # SQLite → /data/sicherungen
docker compose pull && docker compose up -d
```

`update.sh` (im Ordner mit der Compose-Datei aufrufen; liegt dort nur `docker-compose.mariadb.yml`, wird sie automatisch verwendet) sichert
SQLite per `--sichern`, MariaDB bzw. MySQL im Container (Dienst `mariadb`, `mysql` oder `db`, sonst `DB_DIENST=…`) per `mariadb-dump`/`mysqldump`
als `./sicherungen/untplanweb-…sql.gz` und einen externen Datenbankserver mit `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_BENUTZER`, `DB_PASSWORT`.
Danach lädt es die neuen Images und startet neu; die letzten 14 Sicherungen bleiben (`SICHERUNGEN_BEHALTEN`).
Für EduOrga Mobile gibt es dasselbe als `mobile/update.sh` (aktualisiert EduOrga Web und EduOrga Mobile gemeinsam).

**Updateanzeige:** Unter *Administration → Übersicht* zeigt die Karte *Version & Updates* die laufende Version, die Datenbank
mit Schemastand und die neueste veröffentlichte Version (Standard: GitHub-Releases von florians25/UntPlanNext – Entwürfe und
Vorabversionen zählen nicht, aus dem Tag zählt die Versionsnummer, z. B. `v1.5.0` oder `web-v1.5.0` –, alle 6 Stunden geprüft;
abschaltbar mit `UNTPLANWEB_UPDATE_PRUEFEN=0`, andere Quelle mit `UNTPLANWEB_UPDATE_URL`, z. B. die Image-Tags
`ghcr://florians25/untplannext-web`). Netzwerk- oder Proxyfehler führen nur dazu, dass kein Hinweis erscheint. Ist ein Update
verfügbar, sehen Administratoren auf *Heute* und *Übersicht* den Hinweis „Neue Version … verfügbar“ (je Version schließbar, im
Gerätespeicher gemerkt) mit Versionshinweisen, Link zum Release und – wenn ein Updater eingerichtet ist – „Update installieren“;
in der Navigation trägt *Administration* einen Punkt. `GET /api/app/admin/update[?neu=1]` liefert dazu `releaseUrl`,
`releaseName`, `veroeffentlicht` und `hinweise` (Markdown, gekürzt). Die Prüflogik teilen sich Web, Mobile und Studio
(`web/src/UntPlanWeb/Dienste/Updatepruefung.cs`).

**Update aus der Oberfläche** (nur Administration; Aufruf `POST /api/app/admin/update/installieren` mit Kopf `X-UntPlanWeb: 1`).
Vorher wird SQLite automatisch nach `/data/sicherungen` gesichert (die letzten fünf bleiben). Zwei Wege:

- **Watchtower** (empfohlen): Die Compose-Dateien enthalten einen optionalen Dienst `watchtower` (Profil `updater`), der nur auf
  Anforderung und nur Container mit dem Label `com.centurylinklabs.watchtower.enable=true` aktualisiert (nicht MariaDB):
  `docker compose --profile updater up -d`, Token in `.env` (`WATCHTOWER_TOKEN`), bei EduOrga Web
  `UNTPLANWEB_UPDATE_WATCHTOWER_URL=http://watchtower:8080/v1/update` und `UNTPLANWEB_UPDATE_WATCHTOWER_TOKEN` setzen
  (in `docker-compose.mariadb.yml` bereits vorbelegt). Watchtower erhält Zugriff auf den Docker-Socket – nur mit eigenem, langem Token betreiben.
- **Anforderungsdatei** (`UNTPLANWEB_UPDATE_MODUS=datei`, ohne Docker-Socket im Container): Der Knopf legt
  `/data/update/angefordert.json` an; ein cron-Eintrag auf dem Server führt dann das Update aus:
  `* * * * * cd /opt/untplanweb && ./update.sh --wenn-angefordert >> update.log 2>&1`.

Ohne Updater zeigt die Karte den Befehl `docker compose pull && docker compose up -d`.

### Passwort vergessen / neu setzen

`UNTPLANWEB_ADMIN_PASSWORT` legt das Konto `admin` nur beim ersten Start an (solange es keinen Administrator gibt). Danach setzt die
Kommandozeile das Passwort eines Kontos direkt in der Datenbank (SQLite oder MySQL/MariaDB, dieselbe Konfiguration wie der Server) –
ohne den Webserver zu starten und auch während er läuft:

```bash
# Passwort als eine Zeile über die Standardeingabe; am Terminal (ohne -T) zweimal verdeckt abgefragt
printf '%s\n' "$NEUES_PASSWORT" | docker compose exec -T untplanweb dotnet UntPlanWeb.dll --passwort-setzen admin
# Optionen: --anlegen (fehlendes Konto als Administrator anlegen), --aenderungspflicht (bei der nächsten Anmeldung ändern)
```

Das Passwort muss der Passwortrichtlinie genügen (*Administration → Rechte und Rollen*, mindestens 8 Zeichen). Die Sperre nach
Fehlversuchen wird aufgehoben und ein gesperrtes Konto entsperrt; ohne `--aenderungspflicht` muss das Passwort danach nicht geändert
werden. Ergebnis 0 = gesetzt, 1 = Fehler (Meldung auf stderr, bei unbekanntem Konto mit der Liste der Administratoren). In der
Gesamtinstallation: `./passwort.sh web [login]` (siehe `installation/README.md`).

### Datenmigration

Bestehende SQLite-Daten lassen sich nach MySQL/MariaDB übernehmen. Der Befehl migriert beide Datenbanken auf den aktuellen
Schemastand und kopiert alle Tabellen in einer Transaktion (IDs, Passwort-Hashes und Anhänge bleiben erhalten). Die Zieldatenbank
muss leer sein (sonst `--ueberschreiben`); die SQLite-Datei bleibt als Sicherung liegen.

Umstieg einer Docker-Installation (im selben Ordner, damit das Volume `untplanweb-daten` mit der SQLite-Datei weiterverwendet wird):

```bash
docker compose down                                                   # SQLite-Installation stoppen (Volume bleibt)
curl -O https://raw.githubusercontent.com/florians25/UntPlanNext/master/web/docker-compose.mariadb.yml
# .env mit MARIADB_PASSWORT, MARIADB_ROOT_PASSWORT, WATCHTOWER_TOKEN anlegen (siehe oben)
docker compose -f docker-compose.mariadb.yml run --rm untplanweb --migrieren-nach-mysql
docker compose -f docker-compose.mariadb.yml up -d
```

Ohne Docker: `UNTPLANWEB_DATEN=/pfad/zum/datenordner UNTPLANWEB_DB_CONNECTION="Server=…;Database=…;User ID=…;Password=…" dotnet UntPlanWeb.dll --migrieren-nach-mysql [--quelle datei.db] [--ueberschreiben]`,
danach EduOrga Web mit `UNTPLANWEB_DB=mysql` starten. Der Ablauf ist durch Tests abgedeckt (`DatenbankTests`: SQLite → SQLite immer,
SQLite → MySQL/MariaDB über den Kommandozeilenbefehl, wenn `UNTPLANWEB_TEST_MYSQL` gesetzt ist).

**Sicherung des Volumes** (z. B. zusätzlich): `docker run --rm -v untplanweb_untplanweb-daten:/data -v $PWD:/b alpine tar czf /b/untplanweb.tgz /data`.

## EduOrga Studio verbinden

1. In EduOrga Web: *Verwaltung → System & Datenabgleich*. Dort stehen Adresse, Schul-ID und API-Schlüssel (der Schlüssel kann neu erzeugt werden).
2. In EduOrga Studio: *EduOrga Web → Einstellungen*. Adresse, Schul-ID und API-Schlüssel eintragen und *Verbindung prüfen*.
3. *Exportieren* überträgt Stammdaten, Unterricht und Vertretungen. Das geht auch über den EduOrga-Web-Knopf in der Schnellzugriffsleiste.
4. *Importieren* holt Abwesenheiten, Buchungen und Klausuren ab. Übernommene Meldungen werden in EduOrga Web als „übernommen“ angezeigt.
5. *Administration → Benutzer → Konten aus Stammdaten* legt Konten für alle Lehrkräfte und Klassen an.

Die Schnittstelle (Schema `untplanweb/1`) ist in `src/UntPlan.Web.Contracts` definiert und wird von EduOrga Studio und EduOrga Web gemeinsam verwendet:

| Aufruf | Zweck |
|---|---|
| `GET /api/v1/status` | Version, Schema, aktuelle Revision |
| `PUT /api/v1/schulen/{schulId}/untplanweb` | Paket übertragen (ganz oder nur einzelne Teile); veraltete Revision → 409 |
| `GET /api/v1/schulen/{schulId}/rueckmeldungen` | offene Rückmeldungen abholen |
| `POST /api/v1/schulen/{schulId}/rueckmeldungen/quittieren` | übernommene Rückmeldungen quittieren (`["id", …]`) |
| `GET /api/v1/schulen/{schulId}/fehlzeiten?ab=…&bis=…` | im Klassenbuch erfasste Schüler-Fehlzeiten (EduOrga Studio: Import „Studenten*“) |
| `GET /api/v1/schulen/{schulId}/klassenbuch?ab=…&bis=…` | Lehrstoff und Hausaufgaben je Stunde, ohne interne Notizen (EduOrga Studio: Import „Kurse“) |

Die Authentifizierung erfolgt über `Authorization: Bearer <API-Schlüssel>`.

## Rollen

**Schülerverwaltung:** Administration und Schulleitung sehen und bearbeiten alle Schüler\*innen (auch Klassenwechsel und Löschen),
die Klassenleitung bearbeitet die Schüler\*innen ihrer Klassen (inkl. Geburtsdatum, E-Mail, Bemerkung; kein Klassenwechsel, kein Löschen),
andere Lehrkräfte sehen nur Name, Klasse und Geschlecht, Klassenkonten haben keinen Zugriff. Die Liste aus EduOrga Studio bleibt Grundlage;
Änderungen und neu angelegte Schüler\*innen (Ids ab 10.000.000) werden in EduOrga Web gespeichert und überstehen neue Übertragungen.

| Rolle | sieht | darf |
|---|---|---|
| Administration | alles | Benutzer, Synchronisation, Stammdaten, Einstellungen, Monitore, Nachrichten |
| Schulleitung | alles (Lehrerversion) | Nachrichten zum Tag, Mitteilungen an alle |
| Lehrkraft | alle Pläne, Lehrerversion | melden, buchen, Klassenbuch für eigene Stunden |
| Klasse / Schüler | eigene Klasse, Räume, Schülerversion | Mitteilungen an Klassenleitung und Schulleitung |

**Stundenplan-Zeitraum (Planfenster):** Unter *Administration → Rechte und Rollen* lässt sich je Rolle festlegen, wie viele Wochen
vor bzw. nach der aktuellen Woche der Stundenplan angezeigt wird (*Wochen zurück*, *Wochen voraus*). Leer = unbegrenzt (Standard),
0 = nur die aktuelle Woche, n = n Kalenderwochen (Wochenbeginn Montag). Die Administration ist nie beschränkt. Der Server setzt das
Fenster für Web und Apps durch: `GET /api/app/plan` liefert außerhalb `gesperrt: true`, `sperrhinweis` und leere `karten`
(ebenso `GET /api/app/tag`); `GET /api/app/sitzung` enthält `benutzer.planWochenZurueck` und `benutzer.planWochenVor` (Zahl oder `null`).
Klassenbucheinträge (Lehrstoff, Notizen) sind zeitlich nicht begrenzt. „Findet online statt“ kommt mit dem Paket aus EduOrga Studio
(je Unterricht bzw. Stunde) und lässt sich in EduOrga Web nicht mehr einstellen; `PUT /api/app/klassenbuch/online` und die
Felder `online`/`onlineLink` von `PUT /api/app/klassenbuch/stunde` werden für ältere Apps angenommen, aber ignoriert.

## Datenschutz

Leitfaden und Vorlagen (Verzeichnis nach Art. 30, TOM nach Art. 32, AV-Vertrag, DSFA-Checkliste):
[`docs/datenschutz/`](../docs/datenschutz/README.md). In der Oberfläche unter *Verwaltung → Datenschutz* (`#/admin/datenschutz`, nur Administration):

- **Aufbewahrung & Löschung:** Fristen je Kategorie (Anmeldeprotokoll, gemerkte Geräte, Verwaltungsprotokoll, Push-Geräte, Mitteilungen,
  Abwesenheitsmeldungen, Klassenbuch, Elternsprechtag, Buchungen) mit Vorgaben – Klassenbuch 10 Jahre und übrige Schülerdaten 5 Jahre nach
  VO-DV I § 9, Fristbeginn mit Ablauf des Kalenderjahres, in dem das Schuljahr endete (von der Schule zu prüfen). Technische Protokolle sind ab Werk
  begrenzt (Anmeldeprotokoll mit IP-Adressen 30 Tage), inhaltliche Kategorien löschen erst nach dem Einschalten. Probelauf, „jetzt löschen“,
  täglicher Löschlauf (`Aufbewahrungsdienst`, erster Lauf 10 Minuten nach dem Start), Löschprotokoll nur mit Anzahlen.
- **Auskunft & Löschung von Personen:** Auskunft (Art. 15) als PDF/JSON je Schüler*in bzw. Konto; Löschen einer Schülerin bzw. eines Schülers –
  innerhalb der Aufbewahrungsfrist Sperre (Art. 18: ausgeblendet, Klassenbuch-/Abwesenheitsdaten bleiben bis Fristende, dann automatisch gelöscht),
  sonst vollständige Löschung; Konten anonymisieren (Mitteilungen bleiben als „Gelöschtes Konto“).
- **Datenschutzhinweise:** Vorlage nach Art. 13/14 mit den Angaben der Schule, öffentlich unter `/datenschutz` (Anmeldeseite, Kontomenü, Apps);
  Schüler- und Elternkonten bestätigen nach der Anmeldung die Kenntnisnahme (keine Einwilligung), erneut nach jeder neuen Fassung.
- **Sofort-Benachrichtigungen (iOS)** standardmäßig ohne Einzelheiten („Änderung im Stundenplan“); Einzelheiten nur mit Schalter.

| Aufruf (`/api/app/admin/datenschutz…`) | Zweck |
|---|---|
| `GET/PUT /aufbewahrung` `{ regeln: [{ id, aktiv, wert }] }` | Fristen mit Probelauf (`anzahl`, `grenze` je Kategorie) |
| `POST /aufbewahrung/ausfuehren` `{ kategorien? }` | Löschlauf (eingeschaltete bzw. genannte Kategorien) |
| `GET /loeschprotokoll`, `GET /sperren` | Löschprotokoll, gesperrte Personen |
| `GET /personen?suche=` | Konten und Schüler*innen (auch gesperrte) |
| `GET /auskunft?benutzer=\|schueler=&format=json\|pdf` | Auskunft nach Art. 15 |
| `GET/POST /schueler/{id}/loeschen` `{ bestaetigt, grund }` | Löschplan bzw. Löschen/Sperren |
| `POST /benutzer/{id}/anonymisieren` | Konto anonymisieren |
| `GET/PUT /hinweise` | Angaben der Datenschutzhinweise |
| `GET /datenschutz`, `GET /api/app/datenschutz`, `POST /api/app/datenschutz/kenntnis` | Seite (ohne Anmeldung), Angaben für Apps, Kenntnisnahme |

## Sicherheit

- Passwörter sind mit PBKDF2 gehasht (ASP.NET Core Identity). Nach 5 Fehlversuchen wird die Anmeldung für 5 Minuten gesperrt.
  Mindestlänge und Zeichenregeln für Passwörter sind unter *Administration → Rechte und Rollen* einstellbar.
- Gemerkte Konten („Konto wechseln“) sind an einen zufälligen Gerätecookie gebunden, der nur als Hash gespeichert wird.
- Sitzungscookie mit `HttpOnly` und `SameSite=Strict`, über HTTPS `Secure` (`UNTPLANWEB_SICHERE_COOKIES=1` erzwingt es), Gültigkeit
  `UNTPLANWEB_SITZUNG_TAGE`. Ändernde Aufrufe brauchen einen eigenen Kopf (Schutz vor CSRF).
- SQLite mit `secure_delete`: gelöschte Inhalte werden in der Datenbankdatei überschrieben.
- Content-Security-Policy ohne Fremdquellen. Die Seite lädt keine externen Schriften, Skripte oder Tracker.
- Der API-Schlüssel wird nur als SHA-256-Hash gespeichert.
- Für den Betrieb im Internet HTTPS verwenden (siehe oben).

## Entwicklung

Oberfläche:

```bash
cd web/client
npm ci
npm run build                                # Typprüfung + Build nach src/UntPlanWeb/wwwroot
UNTPLANWEB_BACKEND=http://127.0.0.1:5000 npm run dev   # Entwicklung auf http://localhost:5173, API an das Backend
```

Server und Tests:

```bash
cd web
dotnet run --project src/UntPlanWeb          # http://localhost:5000, Daten in ./daten
UNTPLANWEB_DEMO=1 UNTPLANWEB_ADMIN_PASSWORT=admin12345 dotnet run --project src/UntPlanWeb
dotnet test tests/UntPlanWeb.Tests           # inkl. Ende-zu-Ende-Test mit dem Exportcode von UntPlan
# zusätzlich gegen MySQL/MariaDB (Benutzer mit CREATE/DROP DATABASE); ohne Variable werden diese Tests übersprungen:
UNTPLANWEB_TEST_MYSQL="Server=127.0.0.1;User ID=root;Password=…" dotnet test tests/UntPlanWeb.Tests
# alle Tests gegen MySQL/MariaDB:
UNTPLANWEB_TEST_MYSQL="…" UNTPLANWEB_TEST_ALLE_MIT_MYSQL=1 dotnet test tests/UntPlanWeb.Tests
```

Aufbau:

- `src/UntPlanWeb`: ASP.NET Core 8 (Minimal-APIs) mit SQLite (oder MySQL/MariaDB über `Daten/Dialekt.cs`) und eigenen Migrationen (`Daten/Db.cs`, nur anhängen).
- `client`: Oberfläche (Vite, React 18, TypeScript strict, MUI v7); Seiten unter `src/pages` (Verzeichnis `src/pages/register.ts`), Portierungsstand in `client/PORTIERUNG.md`.
- `src/UntPlanWeb/wwwroot`: feste Dateien (Schriften, Bilder, Manifest, `neuigkeiten.json`) plus Build-Ausgabe der Oberfläche.
- `demo/beispiel-paket.json`: Beispielpaket, mit UntPlan.Core aus der Beispielschule erzeugt.

EduOrga Web gehört nicht zur Desktop-Solution `UntPlan.sln` und hat einen eigenen CI-Ablauf (`.github/workflows/web.yml`).
Dieser testet und veröffentlicht das Image `ghcr.io/florians25/untplannext-web`. Der Desktop-Build bleibt davon unberührt.

> Hinweis: Ein neues GHCR-Paket ist zunächst privat. Damit `docker pull` ohne Anmeldung funktioniert, stellen Sie es einmalig auf öffentlich:
> GitHub → Packages → untplanweb → Package settings → Change visibility.
