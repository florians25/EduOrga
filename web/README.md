# UntPlanWeb

**Stundenplan, Vertretungsplan und Rückmeldungen im Browser – der Webbegleiter zu UntPlan.**
UntPlan (Desktop) überträgt Stammdaten, Stundenpläne und Vertretungen an UntPlanWeb. Lehrkräfte, Schulleitung und Klassen sehen dort
ihre Pläne auf PC, Tablet und Smartphone. Abwesenheiten, Raumbuchungen und Klausuren, die im Browser eingetragen werden, holt
UntPlan beim nächsten Datenaustausch ab.

![Stundenplan](docs/bilder/stundenplan.png)

## Oberfläche

Eigenständige Gestaltung nach dem UntPlan-Designsystem (`design/DESIGN.md`, Farben und Maße in `wwwroot/css/tokens.css`):
Marine als Akzentfarbe, Schiefergrau für Flächen und Linien, Statusfarben für Entfall, Änderung, Prüfung und Termin. Schrift ist
**IBM Plex Sans** (SIL Open Font License, lokal unter `wwwroot/fonts`); es werden keine Schriften oder Skripte aus dem Internet geladen.
Symbole sind Linien-Symbole aus **Lucide** (ISC-Lizenz, `wwwroot/lib/lucide/LICENSE`), als Maske in `wwwroot/css/symbole.css`;
`wwwroot/js/symbole.js` ordnet den fachlichen Namen ein Symbol zu. Marke: Zeichen „UP“ und Wortmarke „UntPlan“ als Text;
Favicon und App-Symbole (`img/logo.svg`, `img/icon-*.png`, `img/maskable-*.png`, `img/apple-touch-icon.png`) aus dem Monogramm.

- **Seitenleiste links** (`css/seitenleiste.css`): helle Leiste mit Zeichen, Wortmarke, Schulname und Schuljahr-Auswahl. Die
  Bereiche (*Heute*, *Übersicht*, *Mitteilungen*, *Stundenplan*, *Unterricht*, *Klassenbuch*, *Melden*, *Buchen*, *Sprechtag*,
  *Stammdaten*, *Administration*) stehen mit eigenen Linien-Symbolen in abgerundeten Zeilen; Bereiche klappen an Ort und Stelle auf,
  die Unterpunkte stehen eingerückt an einer feinen Linie. Es ist immer nur ein Bereich offen, der Bereich der aktuellen Seite
  klappt von selbst auf; der aktive Punkt ist hell marineblau hinterlegt. Unten Konto (Profil, Konto wechseln, weiteres Konto),
  *Neuigkeiten*, *Abmelden* und *Navigation einklappen* – eingeklappt bleibt eine schmale Leiste mit den Symbolen der Bereiche.
  Auf Telefon und Tablet öffnet der Knopf *Menü* in der Kopfleiste die Leiste als Schublade.
- **Stundenplan** (`js/plangitter.js`, `js/ansichten/plan.js`, `css/karten.css`): Werkzeugleiste über dem Raster mit Elementwahl,
  Woche (KW und Datumsbereich, Kalender), *Heute*, Umschalter *Woche/Tag*, Statusfiltern (Entfall, Prüfung, Änderung – anklickbar
  zum Ausblenden), Menü *Ansicht* (Symbole, Uhrzeiten, Abwesenheiten, Pausenaufsichten, Drucken, öffentlicher Link) und Hilfe.
  Zeitspalte mit Stundennummer, Beginn und Ende; heutiger Tag hell hinterlegt, Jetzt-Linie. Kacheln in der Fachfarbe getönt,
  Status als Schraffur (Entfall), Rahmen (Änderung) und Schild („Entfall“, „Prüfung“, „Zusatz“, „Termin“, „Verlegt“).
- **Stundendetails** (`js/stundendetails.js`): Bereich rechts (420 px, für Klassenbuch, Raum und Prüfung breiter) mit Kopf in der
  Fachfarbe, Reitern *Klassenbuch* und *Details*, Aktionen im Fuß.
- **Klassenbuch-Seiten** (`css/klassenbuch-seiten.css`): Übersicht, Offene Stunden, Einträge, Hausaufgaben, Klassendienste,
  Berichte, Wochenübersicht, Abwesenheiten, Fehlzeiten, Befreiungen, Sitzplan und Einstellungen als dichte Arbeitsansicht: weißer
  Seitenkopf, Filterzeile aus rechteckigen Feldern, Tabellen mit grauer Kopfzeile und feinen Linien, Status als kleine Schilder.
- **Übrige Seiten** (Heute, Übersicht, Mitteilungen, Unterricht, Melden, Buchen, Stammdaten, Administration, Profil, Sprechtag):
  gemeinsame Bausteine aus `css/app.css`, `css/seitenlayout.css` und den Bereichsdateien in den Farben des Designsystems.
- **Anmeldung:** zweigeteilt – links Marke, Schulname, Datum und öffentliche Hinweise der Schule, rechts das Formular.
- **Monitor** (`monitor.html`, `css/monitor.css`): Vertretungsplan für Bildschirme im Schulhaus auf dunkler Marine-Fläche.

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

- **Navigation bleibt frei (UW-03):** Stundendetails und Dialoge liegen rechts; die Seitenleiste bleibt bedienbar.
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
  und *Klassenbucheintrag* (mit „Noch mögliche Zeichen“) als Fenster über den Stundendetails.
- **Kopf der Stundendetails (UW-11, UW-12):** Klasse, Gruppe, Lehrkraft und Raum verlinken auf den Stundenplan; Änderungen als
  „B070 → C197“ (alter Wert durchgestrichen); Schilder für zusätzlichen Unterricht und Veranstaltungen.
- **Raumbuchung am Desktop (UW-13, UW-14):** Raum-Chip mit *Ersetzen*/*Löschen*, Plus für einen weiteren Raum, Auswahlliste mit
  Suche, Abteilung und Raumarten. Eine reine Raumbuchung ist nur eine Raumänderung der Stunde: kein Vertretungstext, keine Zeile im
  Vertretungsplan (Rückmeldung an UntPlan als `raumbuchung` mit `unterrichtNr` und der neuen Raumliste). Raumbuchungen ohne
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
- **Formatierte Tagestexte:** Liefert UntPlan zu einem Tagestext zusätzlich `textHtml`, zeigt *Heute* den formatierten Text. Erlaubt
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
| **Klassenbuch** | Übersicht, Offene Stunden, Klassenbucheinträge, Hausaufgaben, Klassendienste, Abwesenheiten, Fehlzeiten, Befreiungen, Sitzplan, Berichte |
| **Melden & Buchen** | Abwesenheit melden, Raum buchen, Prüfung eintragen, Meine Meldungen |
| **Unterricht** (Schülerverwaltung) | *Schüler\*in*: anzeigen, anlegen, bearbeiten, löschen je nach Rolle (siehe Rollen) |
| **Stammdaten** (Administration) | Klassen, Lehrkräfte, Fächer, Räume, Schüler*innen (aus UntPlan, lesend), Abwesenheitsgründe, Klassendienste, Versionen (Übertragungsverlauf) |
| **Administration** | Übersicht & Synchronisation, Nachrichten zum Tag, Freie Tage & Ferien, Import, Export, Aktive Benutzer, Rechte und Rollen, Benutzer, Zuordnungsgruppen, Rückmeldungen, Prüfungssperren, Ansichtseinstellungen, Monitore, Protokoll |

Im Einzelnen:

- **Stundenpläne** für Klassen, Lehrkräfte und Räume:
  - Zeitraster mit Beginn/Ende je Stunde und Jetzt-Linie; gleichzeitige Stunden stehen nebeneinander, Aufsichten als schmale Zeilen in den Pausen.
  - Stundenkarten in hellen Statusfarben mit Akzentbalken in der Fachfarbe aus UntPlan: Änderungen grün (geänderte Werte als grüne
    Kürzelbox), Entfall rot und durchgestrichen mit Dreieck, Prüfungen gelb mit Punkt, Veranstaltungen grün mit Plus.
  - **Vertretung ohne Lehrkraft** („+++“ in UntPlan): Änderung, bei der die bisherige Lehrkraft durchgestrichen in der grünen Plakette steht
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
  - Stundendetails: Kopf „Klassen | Unterricht | Fach“ und „Tag | Datum | Zeit | Raum | Lehrkraft“, Reiter
    *Klassenbuch* und *Details*.
    - *Klassenbuch*: Schülerkacheln mit Foto-Platzhalter und Statuspunkt (Alle auswählen, Auswahl löschen, abwesend, verspätet,
      Klassenbucheintrag), Lehrstoff mit Stift, *Abwesende Schüler*innen* als Liste (Auswahl, Stift, Von,
      Beginnzeit, Bis, Endzeit, Grund, Status, Text) mit *Verlängern* (Fehlen aus der Vorstunde in diese Stunde übernehmen) und
      Symbolen „auf Tagesbeginn“/„bis Stundenende“, Hausaufgaben (Liste mit *Neue Hausaufgabe*, Fälligkeit – vorbelegt eine Woche
      später –, Bemerkung, erledigt, löschen; fällige Hausaufgaben der Stunde), Klassenbucheinträge mit „+“, Klassendienste, *Ticket erstellen* (Mitteilung an Schulleitung/Administration); unten die Statusleiste „Lehrstoffeintragung vorhanden“ und
      „Abwesenheiten wurden kontrolliert“ (sonst Knöpfe *Lehrstoff eingeben*, *Abwesenheiten kontrollieren*).
    - *Details*: nur „Findet online statt“, Lehrstoff und Vertretungstext (wenn vorhanden), Hausaufgaben, *Notizen für Schüler*innen*
      und *Notizen für Lehrkräfte*; unten *Vorherige Stunde*, *Nächste Stunde*, *Prüfung erstellen* (Prüfungssperren werden beachtet)
      und *Raum buchen*. Gebuchter Raum und Prüfung stehen sofort als Änderung bzw. Prüfung (gelb) im Plan.
  - Bereitschaften, Raumbuchungen und Vormerkungen; Druck, Telefonansicht mit Tagesauswahl.
- **Tagesübersicht** (Kollegium): alle Klassen, Lehrkräfte oder Räume eines Tages auf einen Blick.
- **Vertretungsplan** als Schüler- oder Lehrerversion; die Schülerversion zeigt keine Abwesenheitsgründe, Bereitschaften oder Aufsichten.
  Aufeinanderfolgende Stunden werden zusammengefasst („3–4“).
- **Monitore:** Vertretungsplan für Info-Bildschirme über einen geheimen Link (ohne Anmeldung), mit Uhr, automatischem Bildlauf,
  einstellbarer Aktualisierung, Nachrichten in der Kopfzeile oder als Laufschrift, optional nur öffentliche Nachrichten.
- **Nachrichten zum Tag** mit Betreff, Zeitraum oder Wochentag, Reihenfolge, Zielgruppen, Anzeige auf Startseite, Monitor und Mobil-App,
  „öffentlich“ für den RSS-Feed (`/rss/nachrichten.xml`, in den Ansichtseinstellungen einschaltbar).
- **Melden & Buchen** (Lehrkräfte): Abwesenheit melden, freien Raum buchen (nur Räume „buchbar (Web)“), Prüfung eintragen. Die Meldungen gehen
  als Rückmeldungen an UntPlan; Buchungen erscheinen sofort als „vorgemerkt“.
- **Klassenbuch:**
  - Wochenübersicht je Klasse mit Lehrstoff, Hausaufgabe, Anwesenheitsprüfung und Fehlenden je Stunde, Vermerke je Tag.
  - **Offene Stunden:** eigene oder alle Stunden ohne Abwesenheitskontrolle bzw. Lehrstoff (Zeitraum wählbar), *Prüfen* und *Eingeben*
    öffnen die Stundendetails, Mitteilung an die ausgewählten Lehrkräfte, Bericht.
  - Anwesenheit in den Stundendetails (alle anwesend vorbelegt, abwesend/verspätet). Dafür überträgt UntPlan die Schülerliste.
  - **Abwesenheiten:** neu anlegen (mehrere Tage/Stunden, Grund), bearbeiten, löschen, zusammenfassen, entschuldigen, zuletzt verwendete
    Texte; Filter nach Zeitraum, Klasse, Grund und Status, CSV; Reiter *Meine Abwesenheiten*.
  - **Fehlzeiten:** Summen je Schüler (Stunden, Tage, entschuldigt, unentschuldigt, offen, Verspätungen), ganze Fehltage in einem Schritt.
  - **Klassendienste:** Dienste (z. B. Klassenordner, Tafeldienst) je Schüler und Zeitraum, Wochenansicht, automatische Verteilung.
  - **Befreiungen:** Schüler*innen von einem Fach befreien; Befreite sind in den Stundendetails markiert.
  - **Sitzplan** je Klasse (Raster, Schüler per Auswahl setzen).
  - **Klassenbucheinträge**, **Hausaufgaben** wie bisher; Klassenkonten zusätzlich mit Reiter *Lehrstoff*.
  - **Berichte:** 18 Berichte in Gruppen (Fehlzeiten, Abwesenheiten je Schüler/Klasse/Grund, Entschuldigungsschreiben, Lehrstoff,
    Hausaufgaben, Klassenbucheinträge, offene Stunden, Klassendienste, Befreiungen …) – Vorschau, Druck und CSV.
- **Prüfungen:** Klausuren aus UntPlan und in UntPlanWeb vorgemerkte Prüfungen, Filter nach Zeitraum, Klasse und Lehrkraft, CSV.
- **Mitteilungen** zwischen Kollegium, Schulleitung und Klassen (Gruppen, Klassen, einzelne Benutzer, eigene Empfängerlisten),
  Entwürfe und Anhänge (bis 5 Dateien à 10 MB).
- **Profil:** Name, E-Mail, Sprache, Benachrichtigungen, Passwort (Regeln aus *Rechte und Rollen*), Kalenderabo (iCal).
- **Konto wechseln:** mehrere Konten auf einem Gerät merken und ohne neue Anmeldung wechseln (Gerätecookie, 30 Tage).
- **Administration:** Verbindung mit UntPlan (Schul-ID, API-Schlüssel), Paket-Upload, Benutzer (auch automatisch aus den Stammdaten,
  CSV-Import mit Vorschau, Sammelaktionen Sperren/Entsperren/Löschen/E-Mail übernehmen/Inaktive sperren, Bericht), Freie Tage,
  Export (CSV), Aktive Benutzer, Passwortregeln, Zuordnung der Schulleitung, Prüfungssperren, Ansichtseinstellungen (Startseite, RSS),
  Rückmeldungen, Nachrichten zum Tag, Monitore, Protokoll.
- **Mobil-App:** [UntPlanMobile](../mobile/README.md) bringt Stundenplan, Klassenbuch und Mitteilungen als installierbare
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
| `GET /api/app/berichte/fehlzeiten?klasse=&von=&bis=&format=csv` | Fehlzeitenbericht (JSON oder CSV) |
| `GET /api/app/berichte/lehrstoff?klasse=&von=&bis=&format=csv` | Lehrstoffbericht (JSON oder CSV) |
| `GET /api/app/berichte/liste`, `GET /api/app/berichte/erstellen/{art}?…&format=csv` | alle Berichtsarten, Bericht erstellen |
| `GET /api/app/klassenbuch/offen?tage=` | eigene Stunden ohne Lehrstoff (Standard 14 Tage) |
| `GET/POST /api/app/klassenbuch/hausaufgabenliste`, `PUT/DELETE …/{id}` | Hausaufgaben einer Stunde (Text, Fälligkeit, Bemerkung, erledigt) und die in der Stunde fälligen |
| `POST /api/app/klassenbuch/abwesenheit/verlaengern` | Abwesenheiten aus der Vorstunde bis Stundenende bzw. bis zum Tagesbeginn verlängern |
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

### Buchungsmodul (Menü „Buchen“)

Räume, mobile Ressourcen und Aktivitäten buchen – einmalig oder periodisch (Zeitraum, Wiederholung jede/jede 2./… Woche bzw. täglich,
Wochentage, Stunden oder Uhrzeit; unterrichtsfreie Tage werden übersprungen). Mehrere Termine bilden eine Serie (`serie`), die einzeln oder
gesamt (kommende Termine) storniert werden kann. Die Konfliktprüfung auf dem Server berücksichtigt Unterricht laut Plan, Klausuren, Termine
mit Raum, Raumsperren, Vormerkungen und andere Buchungen; bei Ressourcen die Anzahl. „Maximale Belegung %“ zeigt auch Räume, die an höchstens
so vielen Terminen belegt sind – für diese Termine wird ein anderer Raum gewählt. Lehrkräfte, Schulleitung und Administration buchen; die
Administration sieht alle Buchungen, storniert jede und pflegt Ressourcenarten, Ressourcen (fest in einem Raum oder mobil mit Anzahl) und
Raumdaten (Kapazität, Gebäude, Abteilung, Raumgruppe; Raumart und „buchbar“ kommen aus UntPlan). Unter *Unterricht → Neuer Unterricht*
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
| `GET/POST /unterricht`, `DELETE /unterricht/{id}` | in UntPlanWeb angelegter Unterricht |
| `/ressourcenarten`, `/ressourcen` (GET, POST, PUT/DELETE `/{id}`), `PUT /raumdaten/{raum}` | Verwaltung (Administration) |

In den Plänen (Web, `GET /api/app/plan`, `/tag`, `/heute`, `/start` für PWA und iOS) erscheinen Buchungen als zusätzliche Karte ohne
Vertretung: Raumbuchung und zusätzliche Stunde mit `status: "buchung"`, `art: "Raumbuchung"` bzw. `"Raumbuchung (Zusätzlicher Unterricht)"`,
Aktivität mit `status: "veranstaltung"`, `art: "Veranstaltung (Aktivität)"`; `text` = Titel, dazu `fach`, `klassen`, `lehrer`, `raeume`,
`unterricht` und `vertretung` sind `null`. Reine Ressourcenbuchungen erscheinen nur in den Buchungslisten. Nie entsteht ein Vertretungstext
oder Vertretungsstatus. An UntPlan gehen Raumbuchungen, Aktivitäten und zusätzliche Stunden über die bestehende Rückmeldungs-Schnittstelle
als Typ `raumbuchung` (Id `buchung-{Nummer}`, mit `fach` bei Aktivitäten); nach dem Quittieren gelten sie als übertragen und werden nicht
doppelt angezeigt, sobald UntPlan sie im Paket zurückliefert.

## Installation mit Docker

Voraussetzung: ein Server oder NAS mit Docker (Linux, amd64 oder arm64). Standardmäßig liegt die Datenbank (SQLite) im Container-Volume, ein eigener Datenbankserver ist nicht nötig.
Für größere bzw. produktive Installationen kann stattdessen MariaDB oder MySQL verwendet werden (siehe [Installation mit MariaDB/MySQL](#installation-mit-mariadbmysql)).

```bash
mkdir untplanweb && cd untplanweb
curl -O https://raw.githubusercontent.com/florians25/UntPlan/main/web/docker-compose.yml
docker compose up -d
```

Dann im Browser `http://<server>:8080` öffnen. Der Einrichtungsassistent legt die Schule und das Administrationskonto an und zeigt
**Schul-ID** und **API-Schlüssel** für UntPlan an.

**Mit HTTPS** (empfohlen, automatisches Let's-Encrypt-Zertifikat über Caddy). Voraussetzung: ein DNS-Name, der auf den Server zeigt, und die Ports 80 und 443:

```bash
curl -O https://raw.githubusercontent.com/florians25/UntPlan/main/web/docker-compose.https.yml
curl -O https://raw.githubusercontent.com/florians25/UntPlan/main/web/Caddyfile
UNTPLANWEB_DOMAIN=plan.meine-schule.de docker compose -f docker-compose.https.yml up -d
```

**Ausprobieren mit Beispieldaten:**

```bash
docker run --rm -p 8080:8080 -e UNTPLANWEB_DEMO=1 -e UNTPLANWEB_ADMIN_PASSWORT=admin12345 ghcr.io/florians25/untplanweb
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
| `UNTPLANWEB_API_SCHLUESSEL` | fester API-Schlüssel für UntPlan | wird erzeugt |
| `UNTPLANWEB_DEMO` | `1` = Beispieldaten laden, solange noch keine Daten vorhanden sind | – |
| `UNTPLANWEB_MOBILE_URL` | erlaubte Adresse(n) von UntPlanMobile für die Einmalanmeldung (kommagetrennt) | gleicher Rechnername |
| `UNTPLANWEB_DB` | Datenbank: `sqlite` oder `mysql` (auch `mariadb`) | `sqlite` |
| `UNTPLANWEB_DB_CONNECTION` | Verbindung zu MySQL/MariaDB: `Server=…;Port=3306;Database=…;User ID=…;Password=…` oder `mysql://benutzer:passwort@host:3306/datenbank` | – |
| `UNTPLANWEB_DB_WARTEN` | Sekunden, die beim Start auf den Datenbankserver gewartet wird | `60` |
| `UNTPLANWEB_UPDATE_PRUEFEN` | `0` = nicht nach neuen Versionen suchen | an |
| `UNTPLANWEB_UPDATE_URL` | Quelle der neuesten Version (`ghcr://besitzer/image`, GitHub-API `…/releases/latest`, `…/releases`, `…/tags` oder eigene Adresse mit `{"version":"…"}` bzw. Text) | `ghcr://florians25/untplanweb` |
| `UNTPLANWEB_UPDATE_TAG_PRAEFIX` | nur Tags mit diesem Präfix berücksichtigen (z. B. `web-v`) | – |
| `UNTPLANWEB_UPDATE_MODUS` | „Update installieren“: `aus`, `watchtower` oder `datei` | `watchtower`, wenn eine Watchtower-Adresse gesetzt ist, sonst `aus` |
| `UNTPLANWEB_UPDATE_WATCHTOWER_URL`, `…_TOKEN` | HTTP-API von Watchtower, z. B. `http://watchtower:8080/v1/update`, und deren Token | – |
| `UNTPLANWEB_MOBILE_INTERN_URL` | Adresse von UntPlanMobile aus Sicht des Servers (Versionsanzeige in der Administration), z. B. `http://untplanmobile:8081` | – |

### Installation mit MariaDB/MySQL

SQLite bleibt der Standard (und wird für die Tests verwendet). Für produktive Installationen mit vielen Benutzer*innen oder
vorhandener Datenbank-Infrastruktur kann UntPlanWeb MariaDB (ab 10.5) oder MySQL (ab 8.0.13) verwenden. Die Datei
`docker-compose.mariadb.yml` startet UntPlanWeb zusammen mit einem MariaDB-Dienst (eigenes Volume, Healthcheck; UntPlanWeb
startet erst, wenn die Datenbank bereit ist):

```bash
mkdir untplanweb && cd untplanweb
curl -O https://raw.githubusercontent.com/florians25/UntPlan/main/web/docker-compose.mariadb.yml
curl -O https://raw.githubusercontent.com/florians25/UntPlan/main/web/update.sh && chmod +x update.sh
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
muss existieren (Zeichensatz `utf8mb4`), der Benutzer braucht alle Rechte darauf. Tabellen und Migrationen legt UntPlanWeb beim
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
Für UntPlanMobile gibt es dasselbe als `mobile/update.sh` (aktualisiert UntPlanWeb und UntPlanMobile gemeinsam).

**Updateanzeige:** Unter *Administration → Übersicht* zeigt die Karte *Version & Updates* die laufende Version, die Datenbank
mit Schemastand und die neueste veröffentlichte Version (Standard: Tags des öffentlichen Images `ghcr://florians25/untplanweb` –
gleiche Nummerierung wie die laufende Version –, alle 6 Stunden geprüft; abschaltbar mit `UNTPLANWEB_UPDATE_PRUEFEN=0`, andere
Quelle mit `UNTPLANWEB_UPDATE_URL`). Ist ein Update verfügbar, erscheint einmal je Benutzer und Version ein schließbarer Hinweis
unten rechts. Die GitHub-Releases gehören zum Desktop-Programm (eigene Zählung) und taugen daher nicht als Quelle für UntPlanWeb.

**Update aus der Oberfläche** (nur Administration; Aufruf `POST /api/app/admin/update/installieren` mit Kopf `X-UntPlanWeb: 1`).
Vorher wird SQLite automatisch nach `/data/sicherungen` gesichert (die letzten fünf bleiben). Zwei Wege:

- **Watchtower** (empfohlen): Die Compose-Dateien enthalten einen optionalen Dienst `watchtower` (Profil `updater`), der nur auf
  Anforderung und nur Container mit dem Label `com.centurylinklabs.watchtower.enable=true` aktualisiert (nicht MariaDB):
  `docker compose --profile updater up -d`, Token in `.env` (`WATCHTOWER_TOKEN`), bei UntPlanWeb
  `UNTPLANWEB_UPDATE_WATCHTOWER_URL=http://watchtower:8080/v1/update` und `UNTPLANWEB_UPDATE_WATCHTOWER_TOKEN` setzen
  (in `docker-compose.mariadb.yml` bereits vorbelegt). Watchtower erhält Zugriff auf den Docker-Socket – nur mit eigenem, langem Token betreiben.
- **Anforderungsdatei** (`UNTPLANWEB_UPDATE_MODUS=datei`, ohne Docker-Socket im Container): Der Knopf legt
  `/data/update/angefordert.json` an; ein cron-Eintrag auf dem Server führt dann das Update aus:
  `* * * * * cd /opt/untplanweb && ./update.sh --wenn-angefordert >> update.log 2>&1`.

Ohne Updater zeigt die Karte den Befehl `docker compose pull && docker compose up -d`.

### Datenmigration

Bestehende SQLite-Daten lassen sich nach MySQL/MariaDB übernehmen. Der Befehl migriert beide Datenbanken auf den aktuellen
Schemastand und kopiert alle Tabellen in einer Transaktion (IDs, Passwort-Hashes und Anhänge bleiben erhalten). Die Zieldatenbank
muss leer sein (sonst `--ueberschreiben`); die SQLite-Datei bleibt als Sicherung liegen.

Umstieg einer Docker-Installation (im selben Ordner, damit das Volume `untplanweb-daten` mit der SQLite-Datei weiterverwendet wird):

```bash
docker compose down                                                   # SQLite-Installation stoppen (Volume bleibt)
curl -O https://raw.githubusercontent.com/florians25/UntPlan/main/web/docker-compose.mariadb.yml
# .env mit MARIADB_PASSWORT, MARIADB_ROOT_PASSWORT, WATCHTOWER_TOKEN anlegen (siehe oben)
docker compose -f docker-compose.mariadb.yml run --rm untplanweb --migrieren-nach-mysql
docker compose -f docker-compose.mariadb.yml up -d
```

Ohne Docker: `UNTPLANWEB_DATEN=/pfad/zum/datenordner UNTPLANWEB_DB_CONNECTION="Server=…;Database=…;User ID=…;Password=…" dotnet UntPlanWeb.dll --migrieren-nach-mysql [--quelle datei.db] [--ueberschreiben]`,
danach UntPlanWeb mit `UNTPLANWEB_DB=mysql` starten. Der Ablauf ist durch Tests abgedeckt (`DatenbankTests`: SQLite → SQLite immer,
SQLite → MySQL/MariaDB über den Kommandozeilenbefehl, wenn `UNTPLANWEB_TEST_MYSQL` gesetzt ist).

**Sicherung des Volumes** (z. B. zusätzlich): `docker run --rm -v untplanweb_untplanweb-daten:/data -v $PWD:/b alpine tar czf /b/untplanweb.tgz /data`.

## UntPlan verbinden

1. In UntPlanWeb: *Administration → Übersicht & Synchronisation*. Dort stehen Adresse, Schul-ID und API-Schlüssel (der Schlüssel kann neu erzeugt werden).
2. In UntPlan: *UntPlanWeb → Einstellungen*. Adresse, Schul-ID und API-Schlüssel eintragen und *Verbindung prüfen*.
3. *Exportieren* überträgt Stammdaten, Unterricht und Vertretungen. Das geht auch über den UntPlanWeb-Knopf in der Schnellzugriffsleiste.
4. *Importieren* holt Abwesenheiten, Buchungen und Klausuren ab. Übernommene Meldungen werden in UntPlanWeb als „übernommen“ angezeigt.
5. *Administration → Benutzer → Konten aus Stammdaten* legt Konten für alle Lehrkräfte und Klassen an.

Die Schnittstelle (Schema `untplanweb/1`) ist in `src/UntPlan.Web.Contracts` definiert und wird von UntPlan und UntPlanWeb gemeinsam verwendet:

| Aufruf | Zweck |
|---|---|
| `GET /api/v1/status` | Version, Schema, aktuelle Revision |
| `PUT /api/v1/schulen/{schulId}/untplanweb` | Paket übertragen (ganz oder nur einzelne Teile); veraltete Revision → 409 |
| `GET /api/v1/schulen/{schulId}/rueckmeldungen` | offene Rückmeldungen abholen |
| `POST /api/v1/schulen/{schulId}/rueckmeldungen/quittieren` | übernommene Rückmeldungen quittieren (`["id", …]`) |
| `GET /api/v1/schulen/{schulId}/fehlzeiten?ab=…&bis=…` | im Klassenbuch erfasste Schüler-Fehlzeiten (UntPlan: Import „Studenten*“) |
| `GET /api/v1/schulen/{schulId}/klassenbuch?ab=…&bis=…` | Lehrstoff und Hausaufgaben je Stunde, ohne interne Notizen (UntPlan: Import „Kurse“) |

Die Authentifizierung erfolgt über `Authorization: Bearer <API-Schlüssel>`.

## Rollen

**Schülerverwaltung:** Administration und Schulleitung sehen und bearbeiten alle Schüler\*innen (auch Klassenwechsel und Löschen),
die Klassenleitung bearbeitet die Schüler\*innen ihrer Klassen (inkl. Geburtsdatum, E-Mail, Bemerkung; kein Klassenwechsel, kein Löschen),
andere Lehrkräfte sehen nur Name, Klasse und Geschlecht, Klassenkonten haben keinen Zugriff. Die Liste aus UntPlan bleibt Grundlage;
Änderungen und neu angelegte Schüler\*innen (Ids ab 10.000.000) werden in UntPlanWeb gespeichert und überstehen neue Übertragungen.

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
Klassenbucheinträge (Lehrstoff, Notizen, „Findet online statt“) sind zeitlich nicht begrenzt.

## Sicherheit

- Passwörter sind mit PBKDF2 gehasht (ASP.NET Core Identity). Nach 5 Fehlversuchen wird die Anmeldung für 5 Minuten gesperrt.
  Mindestlänge und Zeichenregeln für Passwörter sind unter *Administration → Rechte und Rollen* einstellbar.
- Gemerkte Konten („Konto wechseln“) sind an einen zufälligen Gerätecookie gebunden, der nur als Hash gespeichert wird.
- Sitzungscookie mit `HttpOnly` und `SameSite=Strict`. Ändernde Aufrufe brauchen einen eigenen Kopf (Schutz vor CSRF).
- Content-Security-Policy ohne Fremdquellen. Die Seite lädt keine externen Schriften, Skripte oder Tracker.
- Der API-Schlüssel wird nur als SHA-256-Hash gespeichert.
- Für den Betrieb im Internet HTTPS verwenden (siehe oben).

## Entwicklung

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
- `wwwroot`: Oberfläche ohne Build-Schritt (Bootstrap 5.3 mit den Grundwerten aus `css/tokens.css`, Linien-Symbole in `css/symbole.css` mit Zuordnung in `js/symbole.js`, IBM Plex Sans unter `fonts/`, keine CDN-Abhängigkeit), Vanilla-JS-Module je Seite unter `js/ansichten`.
- `demo/beispiel-paket.json`: Beispielpaket, mit UntPlan.Core aus der Beispielschule erzeugt.

UntPlanWeb gehört nicht zur Desktop-Solution `UntPlan.sln` und hat einen eigenen CI-Ablauf (`.github/workflows/web.yml`).
Dieser testet und veröffentlicht das Image `ghcr.io/florians25/untplanweb`. Der Desktop-Build bleibt davon unberührt.

> Hinweis: Ein neues GHCR-Paket ist zunächst privat. Damit `docker pull` ohne Anmeldung funktioniert, stellen Sie es einmalig auf öffentlich:
> GitHub → Packages → untplanweb → Package settings → Change visibility.
