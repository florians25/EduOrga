# UntPlan Studio – Architektur

UntPlan Studio ist die Planungsanwendung von UntPlan im Browser. Die **gesamte Fachlogik liegt in `src/UntPlan.Core`** –
das Studio ist eine dünne Server-Schicht (ASP.NET Core 8, REST/JSON) plus eine Oberfläche aus Vanilla-JS-ES-Modulen ohne
Build-Schritt. Schuldateien (`.up`) sind JSON-Dateien und lassen sich jederzeit herunterladen und wieder hochladen.

```
Browser (wwwroot)                                  Server (UntPlanStudio)                         UntPlan.Core
┌───────────────────────────────┐   REST/JSON    ┌───────────────────────────────────────┐      ┌──────────────────┐
│ Shell: Navigation, Kopfleiste,│ ─────────────▶ │ Api/<Modul>Api.cs  (IStudioModul)      │ ───▶ │ Dokument, Model, │
│ Seiten und Arbeitsplätze      │                │   └─ Arbeitsdokument (Sperre, Undo)    │      │ Stammdaten,      │
│ Module: js/module/<modul>.js  │ ◀───────────── │ Dokumentdienst (Ablage, Autosave)      │      │ Planung, …       │
│ Komponenten: Tabelle, Raster  │  SSE-Ereignisse│ Benutzerdienst, Benutzereinstellungen  │      └──────────────────┘
└───────────────────────────────┘                │ StudioDatenbank (SQLite, studio.db)    │
                                                 └───────────────────────────────────────┘
```

## Ordnerstruktur

```
studio/
  ARCHITEKTUR.md, README.md
  Dockerfile, Dockerfile.dockerignore        Container (Build-Kontext = Repository-Wurzel)
  docker-compose.yml                         HTTP auf Port 8090
  docker-compose.https.yml + Caddyfile       eigene Domain (STUDIO_DOMAIN), HTTPS über Caddy
  docker-compose.gemeinsam.yml + Caddyfile.gemeinsam   UntPlanWeb + Studio hinter einem Caddy
  UntPlanStudio.sln
  src/UntPlanStudio/
    Program.cs                 Aufbau: Dienste, Anmeldung (Cookie), Middleware, Routengruppen, Module
    Grundlagen/                StudioKonfiguration (Umgebungsvariablen), IStudioModul/StudioRouten, StudioFehler,
                               Fehlerbehandlung, Typnamen (Elementtyp ↔ Route)
    Dienste/                   StudioDatenbank (SQLite studio.db, Sicherungsdienst), AltdatenUebernahme,
                               Arbeitsdokument, Dokumentdienst, Autospeicherung, Benutzerdienst, Benutzereinstellungen,
                               Felder (Stammdaten-Spalten), Unterrichtsspalten (dto.)
    Api/
      Modulregister.cs         ◀ EINZIGE Registrierungsstelle der Server-Module
      AnmeldungApi.cs, BenutzerApi.cs, EinstellungenApi.cs, DokumenteApi.cs     Fundament
      StammdatenApi.cs, UnterrichtApi.cs, StundenplanApi.cs                     erste Fachmodule
    wwwroot/
      index.html, favicon.svg
      css/basis.css shell.css fenster.css tabelle.css raster.css dialog.css     Kern-Stile
      css/module/<modul>.css                                                    Stile je Modul (optional)
      js/app.js                Start: Anmeldung → Shell → Module → letztes Dokument
      js/kern/                 api, zustand, ereignisse, dokument, dom, symbole, dialog, auswahl,
                               tabelle, raster, fenster, ribbon, modulsystem, shell
      js/module/register.js    ◀ EINZIGE Registrierungsstelle der Oberflächen-Module
      js/module/<modul>.js     datei, start, stammdaten, unterricht, stundenplan
  tests/UntPlanStudio.Tests/   xUnit + WebApplicationFactory (API, JS-Syntax per Node, Verweise)
  tests/smoke/smoke.cjs        Playwright-Smoke (Anmelden, Datei öffnen, Fenster, Bildschirmfotos)
```

## Server

### Ablage: eigene Datenbank `studio.db`

Das Studio hat eine eigene SQLite-Datenbank `<STUDIO_DATEN>/studio.db` (`Dienste/StudioDatenbank.cs`,
`Microsoft.Data.Sqlite`), unabhängig von der Datenbank von UntPlan Web. WAL-Modus, `busy_timeout=5000`, eine Verbindung je
Vorgang (Verbindungspool), Schreibvorgänge in Transaktionen (`BEGIN IMMEDIATE`) und zusätzlich prozessweit nacheinander.

| Tabelle | Inhalt |
|---|---|
| `dokumente` | `id` (16 Hex-Zeichen), `name`, `besitzer`, `erstellt`, `geaendert`, `gespeichert`, `herkunft`, `info` (`DokumentInfo` als JSON), `inhalt` (BLOB = Schuldatei-JSON, Byte für Byte wie eine `.up`-Datei), `groesse` |
| `dokument_sicherungen` | ältere Fassungen je Dokument (`nr`, `id`, `zeit`, `inhalt`, `groesse`) – ersetzt die frühere `.bak`-Datei; bei jedem Speichern mit geändertem Inhalt wandert der bisherige Inhalt hierher, die letzten 10 je Dokument bleiben |
| `ablage` | JSON-Werte unter `bereich` + `schluessel` (`Ablagebereiche`): `benutzer` (je Benutzer ein `StudioBenutzer`), `einstellungen` (je Benutzer ein JSON-Objekt), `multiuser` (`konfiguration` = `MuKonfiguration`), `untplanweb` (je Dokument-Id ein `UpwAbgleich`) |
| `meta` | `anwendungsversion` (erkennt Updates) |

* **Schema-Version** in `PRAGMA user_version`; Migrationen stehen in `StudioDatenbank.Migrationen` (Eintrag *i* hebt
  Version *i* auf *i + 1*) und laufen beim Start. Neue Migration = neuen Eintrag anhängen, bestehende nie ändern.
* **Sicherung** (`VACUUM INTO`, konsistent auch im laufenden Betrieb) nach `<STUDIO_DATEN>/sicherungen/studio-<zeit>.db`:
  beim Start vor jedem Update (andere Programmversion oder Schema-Migration), täglich (`Sicherungsdienst`), über
  `POST /api/sicherungen` (Admin) und `dotnet UntPlanStudio.dll --sichern` (legt nichts an, migriert nichts). Die letzten
  `STUDIO_SICHERUNGEN_BEHALTEN` (14) bleiben.
* **Übernahme älterer Installationen** (`AltdatenUebernahme`): beim ersten Start mit leerer Datenbank werden
  `benutzer.json`, `benutzer/*.json`, `multiuser.json`, `untplanweb/*.json` und `dokumente/*.up` (+ `*.json`, `*.up.bak`)
  in einer Transaktion importiert und danach nach `<STUDIO_DATEN>/alt-dateien-<datum>/` verschoben (nicht gelöscht).
* Dateien im Datenordner sind nur noch `studio.db` (+ `-wal`/`-shm`), `sicherungen/` und `schluessel/` (Schlüssel für das
  Anmeldecookie, ASP.NET Core DataProtection).
* Die Schuldatei wird mit der Serialisierung des Core gelesen/geschrieben: `Dokument.Laden(byte[])`,
  `Dokument.Speichern(Action<byte[]>)`, `Dokument.Inhalt()` – derselbe Inhalt wie `Dokument.Speichern(pfad)`.
* `GET /gesundheit` prüft zusätzlich, dass die Datenbank erreichbar ist (sonst 503).

### Arbeitsdokumente

* Ablage in der Datenbank (Tabelle `dokumente`, siehe oben). Die Id besteht aus 16 Hex-Zeichen (wird geprüft).
  `GET …/herunterladen` liefert die Schuldatei (`.up`) mit dem aktuellen Stand.
* Geöffnete Dokumente hält `Dokumentdienst` im Speicher (`Arbeitsdokument` mit dem Core-`Dokument`). Ein Dokument ist für
  alle angemeldeten Benutzer dasselbe Objekt → Änderungen sehen alle sofort (Grundlage für MultiUser).
* **Alle Zugriffe auf Core-Daten nur über `Arbeitsdokument`** – UntPlan.Core ist nicht threadsicher:
  * `LesenAsync(doc => …)` – unter der Dokumentsperre lesen und **in DTOs umwandeln** (keine Core-Objekte herausgeben).
  * `AendernAsync(benutzer, beschreibung, AenderungsArt, d => …, doc => ergebnis)` – führt die Änderung über
    `Dokument.Aendern` aus (Rückgängig-Stufe, Abgleich der Vertretungen), erhöht `Version`, meldet ein
    Ereignis und liefert unter derselben Sperre das Ergebnis (z. B. die geänderte Tabellenzeile).
  * `AusfuehrenAsync(benutzer, doc => (ergebnis, art?, text))` – für Sonderfälle (Rückgängig, Optimierungsergebnis übernehmen …).
* Rückgängig/Wiederholen kommen aus dem Core (50 Stufen, `POST …/rueckgaengig`, `…/wiederholen`).
* `Autospeicherung` speichert geänderte Dokumente alle `STUDIO_AUTOSPEICHERN_SEKUNDEN` (Standard 30) und beim Beenden;
  lange unbenutzte Dokumente ohne Ereignis-Abonnenten werden entladen (`STUDIO_LEERLAUF_MINUTEN`).
* Fehlermeldungen des Core (`InvalidOperationException`, `FormatException`) werden als HTTP 400 `{ "fehler": "…" }`
  gemeldet als Hinweis. Eigene Fehler: `throw StudioFehler.Ungueltig(...)`, `.NichtGefunden(...)`, `.Verboten()`.
* Lange Berechnungen (z. B. Optimierung) nicht unter der Sperre laufen lassen: Daten unter `LesenAsync` kopieren
  (`Dokument.Klonen`), rechnen, Ergebnis per `AendernAsync` übernehmen.

### Ereignisse (Aktualisierung zwischen Fenstern und Benutzern)

`GET /api/dokumente/{dok}/ereignisse` (Server-Sent Events): `hallo`, `aenderung` (`{ version, bereich, beschreibung, benutzer, zeit }`),
`gespeichert`, `geschlossen`. Zusätzlich trägt jede Antwort eines Dokument-Endpunkts die Kopfzeilen `X-Dokument-Version`
und `X-Dokument-Bereich`. `bereich` = `AenderungsArt` des Core: `Stammdaten`, `Unterricht`, `Stundenplan`, `Vertretung`,
`Einstellungen`, `Alles`.

### Anmeldung und Rechte

Cookie-Anmeldung (`POST /api/anmeldung`), Benutzer in der Datenbank (`ablage`, Bereich `benutzer`; Passwort-Hash PBKDF2 / ASP.NET Core Identity).
Admin-Konto beim ersten Start aus `STUDIO_ADMIN_BENUTZER`/`STUDIO_ADMIN_PASSWORT`. Rollen: `Admin`, `Planer`, `Leser`
(Leser: keine ändernden Anfragen, serverseitig erzwungen). Jede ändernde Anfrage braucht die Kopfzeile
`X-UntPlan-Studio: 1` (Schutz gegen Cross-Site-Anfragen; die Oberfläche setzt sie automatisch).

## API-Konventionen

* Präfix `/api`; alles außer `/api/system`, `/api/sitzung`, `/api/anmeldung`, `/api/abmeldung` verlangt Anmeldung.
* Dokumentbezogen immer unter `/api/dokumente/{dok}/<modul>/…` – im Modul über `routen.Dokument.MapGroup("/<modul>")`;
  Handler bekommen das Dokument einfach als Parameter `Arbeitsdokument a` (Bindung über `{dok}`, 404 bei unbekannter Id).
* JSON in camelCase, Enums als Text. Datumswerte ISO (`2026-10-14`), Zeiten `HH:mm`.
* **Eingaben als Text**: Tabellenwerte werden als Text geschickt und mit der Logik des Core geparst
  (Bereich `1-2`, Liste `5a,5b`, Bool `X`, Dezimal `25,5`, Elemente per Kurzname). Antworten liefern die Anzeige-Texte.
* Elementtypen in Routen klein: `klasse`, `lehrer`, `raum`, `fach`, `raumgruppe`, `gang`, `abteilung`, `abwesenheitsgrund`, `schueler`.
* Tabellen-Antworten: `{ titel, felder|spalten: [...], zeilen|unterrichte: [...] }` mit Werten als Text-Arrays in Spaltenreihenfolge.
* Ändernde Endpunkte liefern das geänderte Objekt in derselben Form wie die Liste (damit die Oberfläche nur diese Zeile ersetzt).
* Mehrere Änderungen in EINER Rückgängig-Stufe: eigener Sammel-Endpunkt (Beispiel `POST …/stammdaten/{typ}/aendern`).
* Positionsangaben im Stundenplan: `tag` (0 = erster Schultag), `stunde` (ab 1) wie im Core.

### Vorhandene Endpunkte

| Modul | Endpunkte |
|---|---|
| anmeldung | `GET /api/system`, `GET /api/sitzung`, `POST /api/anmeldung`, `POST /api/abmeldung`, `GET /api/ich`, `POST /api/ich/passwort` |
| benutzer (Admin) | `GET/POST /api/benutzer`, `DELETE /api/benutzer/{name}`, `POST /api/benutzer/{name}/passwort`, `GET /api/benutzer/rollen`; Datenbanksicherungen: `GET /api/sicherungen` (Liste), `POST /api/sicherungen` (jetzt sichern) |
| einstellungen | `GET/PUT/DELETE /api/einstellungen/{schluessel}` (JSON je Benutzer; Schlüssel mit Modulpräfix, z. B. `vertretung.ansicht`) |
| dokumente | `GET /api/dokumente` (Liste + zuletzt), `POST /api/dokumente/neu`, `POST /api/dokumente/beispiel`, `POST /api/dokumente/hochladen` (multipart `datei`: .up oder BAL); je Dokument: `GET ""` (Stand), `GET /grunddaten` (Zeitraster, Perioden), `POST /speichern`, `GET /herunterladen`, `POST /schliessen`, `DELETE ""`, `PUT /name`, `POST /rueckgaengig`, `POST /wiederholen`, `POST /bal-import` (multipart + Optionen), `GET /ereignisse` |
| stammdaten | `GET /stammdaten/{typ}`, `GET /stammdaten/{typ}/felder`, `POST /stammdaten/{typ}` (`{kurzname, werte}`), `PATCH /stammdaten/{typ}/{id}` (`{feld, wert}`), `POST /stammdaten/{typ}/aendern` (`{aenderungen:[{id,feld,wert}]}`), `POST /stammdaten/{typ}/loeschen` (`{ids}`), `DELETE /stammdaten/{typ}/{id}`, `GET /stammdaten/{typ}/verwendung?ids=`, `GET /elemente?typen=` (Auswahllisten `{k,l}`) |
| unterricht | `GET /unterricht?sicht=klasse|lehrer|fach|alle&element=`, `GET /unterricht/spalten`, `POST /unterricht` (`{sicht, element, werte}`), `PATCH /unterricht/{uid}` (`{feld, wert, zeile}`), `POST /unterricht/{uid}/zeilen`, `DELETE /unterricht/{uid}/zeilen/{nr}`, `POST /unterricht/{uid}/kopieren`, `POST /unterricht/loeschen`, `GET /unterricht/online`, `GET/PUT /unterricht/{uid}/online` (siehe „Findet online statt“) |
| stundenplan | `GET /stundenplan/{typ}/{id}` (Zellen mit Einträgen je Kopplungszeile, nicht verplante Stunden), `GET /stundenplan/zielstatus?unterricht=&tag=&stunde=`, `POST /stundenplan/verplanen`, `POST /stundenplan/verschieben`, `POST /stundenplan/entplanen`, `POST /stundenplan/fixieren` |
| vertretung | Datum: `GET /vertretung/start`, `GET …/blaettern?datum=&richtung=&woche=`, `POST …/aktualisieren` (Tageswechsel, nur bei Bedarf); `GET …/kalender?datum=`, `POST …/kalendertag`, `PUT …/tagestexte`; Absenzen: `GET …/absenzen?art=&von=&bis=`, `POST …/absenzen/speichern` (liefert `nachfragen`), `…/nachfrage`, `…/loeschen`, `…/teilen`, `…/kopieren`, `…/zusammenfassen`; Liste: `GET …/liste` (Spalten + Zeilen, Filter), `GET …/optionen?id=&spalte=`, `POST …/aendern` (`{ids, spalte, wert}`), `…/entfall`, `…/ohnelehrer`, `…/teilen`, `…/vormerken`, `…/zuruecksetzen`, `…/loeschen`, `…/kennzeichen`, `…/neuberechnen`, `…/veranstaltungslehrer`, `GET/POST …/automatik`; Vorschlag: `GET …/vorschlag/{id}`, `POST …/vorschlag/{id}/uebernehmen|betreuung|raum|vorziehen`; `POST …/sondereinsaetze`, `GET …/klassenkonferenz`, `GET …/bereitschaften`, `…/bereitschaftsplanung[/vorschlag|/{aktion}]`, `GET/POST …/vormerkungen[/{id}/verplanen|/loeschen]`; tagesaktuell: `GET …/plan/{typ}/{id}?datum=`, `GET …/plan/zielstatus`, `POST …/plan/verlegen|entfall|entfallrueckgaengig|vormerken|aenderungenrueckgaengig|text`; Online-Stunden: `GET/PUT …/online`, `GET …/online/stunde` (siehe „Findet online statt“); `GET/PUT …/einstellungen`. Rückfragen: Antwort `{ frage: { schluessel, text, optionen } }`, Wiederholung mit `antworten: { schluessel: index }` |
| veranstaltungen | `GET /veranstaltungen?von=&bis=`, `POST /veranstaltungen[/{id}]` (`{feld, wert, datum}`), `GET …/gruppen?feld=&va=`, `POST …/schnell[/{id}]`, `…/{id}/ausstunden`, `…/ausstunde`, `…/{id}/kopieren`, `…/loeschen`, `GET …/schuelergruppen` |
| optimierung | `GET /optimierung/diagnose?rubrik=`, `GET /optimierung/kennzahlen`, `GET/PUT /optimierung/gewichtung` (`{werte}`), `GET /optimierung/gewichtung/analyse`, `GET /optimierung/strategien`, `POST /optimierung/start` (`{optionen, zuordnen}` → Hintergrundauftrag auf `Dokument.Klonen`), `GET /optimierung/auftrag` (Status/Fortschritt/Ergebnisse, Abfrage ~0,6 s), `POST /optimierung/auftrag/abbrechen`, `POST /optimierung/auftrag/uebernehmen` (`{nummer, trotzAenderung}`; 409 wenn das Dokument inzwischen geändert wurde), `DELETE /optimierung/auftrag`, `GET /optimierung/auftrag/plan/{nummer}/{typ}/{id}` (Ergebnisvergleich) |
| planung | `GET /planung/zielstatus?unterricht=&tag=&stunde=&einzeln=&laenge=` (`{status, gruende}` je Feld), `POST /planung/verschieben` (Block bzw. `einzeln`; `aktion` auto/entplanen/kollision – ohne Aktion bei Behinderung `{ok:false, frage}`), `POST /planung/verplanen` (`{unterricht, tag, stunde, laenge, aktion}`), `POST /planung/entplanen` / `POST /planung/fixieren` (`{stunden:[{unterricht,tag,stunde}]}`, Mehrfachauswahl), `POST /planung/alle-entplanen`, `POST /planung/alle-fixieren`, `GET/POST /planung/raum` (Raumliste bzw. zuordnen/löschen mit `umfang`, `loesung`), `GET /planung/tausch` (Tauschvorschläge), `POST /planung/tauschen` |
| zeitwuensche | `GET /zeitwuensche/{typ}` (Elemente mit Anzahl), `GET/PUT /zeitwuensche/{typ}/{id}` (`{aenderungen:[{tag,stunde,wert}]}` bzw. `{alleLoeschen}`), `PUT /zeitwuensche/{typ}/{id}/unbestimmte` – typ: klasse, lehrer, raum, fach, unterricht |
| austausch | `GET /austausch` (Übersicht), `POST /austausch/csv/{lehrer|klassen|schueler}` (multipart), `POST /austausch/gpu` (mehrere Dateien oder ZIP), `GET /austausch/gpu` (ZIP), `GET /austausch/unterricht.csv`, `GET /austausch/infostundenplan.zip`, `GET /austausch/ical/{lehrer}?von=&bis=`, `GET /austausch/untplanweb.json`, `GET/POST /austausch/abteilung/{id}` (Abteilungsdatei exportieren/zusammenführen) |
| untplanweb | `GET /untplanweb` (Zeilen, Status, Anfangsdatum), `GET/PUT /untplanweb/einstellungen` (leerer API-Schlüssel = unverändert), `POST /untplanweb/pruefen`, `GET /untplanweb/schulname`, `PUT /untplanweb/anfangsdatum`, `POST /untplanweb/export/{stammdaten|unterricht|vertretungen|alles}` bzw. `POST /untplanweb/import/{absenzen|studenten|kurse}` (Hintergrundauftrag) + `GET /untplanweb/auftrag/{id}` (Fortschritt), `GET /untplanweb/stpl?von=&bis=&erledigte=&neu=`, `POST /untplanweb/stpl/uebernehmen|ignorieren` (`{ids}`), `PUT /untplanweb/stpl/einstellungen`, `GET/POST /untplanweb/klausuren`, `PUT/DELETE /untplanweb/klausuren/{id}`, `GET /untplanweb/schuelerabwesenheiten`, `GET /untplanweb/klassenbuch`, `GET/PUT /untplanweb/abgleich`, `POST /untplanweb/abgleich/jetzt` (automatischer Abgleich: Hintergrunddienst `UpwAbgleichDienst`, Einstellungen in der Datenbank, `ablage` Bereich `untplanweb`) |
| abrechnung | `GET /abrechnung/werte`, `PATCH /abrechnung/werte/{lehrer}` (`{feld: Wochensoll|Wertkorrektur, wert}`), `GET /abrechnung/matrix?art=0|1|2`, `GET/PUT /abrechnung/stundentafel`, `POST /abrechnung/stundentafel/jahrgang|nrw`, `GET /abrechnung/berichte`, `GET /abrechnung/statistik?bericht=0..6&von=&bis=&lehrer=` (+ `.html` mit `alle=true`, `.csv`), `GET /abrechnung/zaehler/{lehrer}?datum=` |
| pausenaufsicht | `GET /pausenaufsicht`, `GET /pausenaufsicht/gang/{id}`, `GET /pausenaufsicht/lehrer/{id}`, `PUT /pausenaufsicht/zelle` (`{gang,tag,nach,lehrer:"AB, CD"}`), `GET /pausenaufsicht/vorschlag?gang=&tag=&nach=`, `POST /pausenaufsicht/zuordnen|teile|loeschen|optimieren`, `GET/PUT /pausenaufsicht/gewichtung`, `GET/POST /pausenaufsicht/vertretung/{datum}` (Aufsichtsvertretungen mit Kandidaten) |
| kursplanung | `GET /kursplanung` (Klassen), `GET /kursplanung/{klasse}`, `PATCH /kursplanung/{klasse}/kurs/{uid}` (`{feld: band|kursname}`), `PUT /kursplanung/{klasse}/wahl`, `POST /kursplanung/{klasse}/zufall|bandbildung|baender` |
| kommentare | `GET /kommentare?typ=&element=`, `GET /kommentare/kategorien`, `POST /kommentare`, `PUT /kommentare/{id}`, `POST /kommentare/loeschen` |
| multiuser | je Dokument: `GET /multiuser?nach=&taetigkeit=` (Lebenszeichen, aktive Benutzer, Sperren, Exklusiv, Nachrichten), `POST /multiuser/lebenszeichen|abmelden|nachricht`, `POST /multiuser/sperren` (`{bereich}`), `DELETE /multiuser/sperren/{bereich}`, `POST /multiuser/exklusiv` (`{ein}`); global: `GET /api/multiuser/ich`, Admin: `GET /api/multiuser/verwaltung`, `POST/PUT/DELETE /api/multiuser/gruppen[/{id}]`, `PUT /api/multiuser/benutzer/{name}`. Ein Endpunktfilter auf `/api/dokumente/{dok}` prüft jede ändernde Anfrage (423 Sperre/Exklusivbetrieb eines anderen Benutzers, 403 fehlende Rechtestufe der Gruppe; Bereich = erstes Pfadsegment, siehe `MultiUserDienst.BereichVon`) |
| einstellungen-schule | `GET/PUT /schule/schuldaten`, `GET/PUT /schule/zeitraster`, `GET/POST /schule/ferien`, `PATCH /schule/ferien/{id}` (`{feld, wert}`), `POST /schule/ferien/loeschen`, `POST /schule/ferien/nrw`, `POST /schule/ferien/tag` (`{datum, unterrichtsfrei, feiertag}`), `GET/POST /schule/perioden`, `PUT/DELETE /schule/perioden/{id}`, `POST /schule/perioden/{id}/aktiv`, `PUT /schule/perioden/folgeperioden`, `GET/POST /schule/ugruppen`, `PUT /schule/ugruppen/{id}`, `POST /schule/ugruppen/loeschen`, `PUT /schule/wochenperiodizitaet` |
| druck | `GET /druck/auswahl`, `GET /druck/stundenplaene?typ=&ids=&format=&kompakt=&farbig=&ausgabe=pdf/html`, `GET /druck/info/{datei}` (Info-Stundenplan), `GET /druck/infostundenplan.zip`, `GET /druck/ical?lehrer=&von=&bis=` (ohne lehrer: ZIP), `GET/PUT /druck/aushang` (Seitenlayout des Vertretungsplans, in der Schuldatei), `GET /druck/vertretungsplan?von=&bis=&version=klassen/lehrer&ausgabe=pdf/html/monitor`, `GET /druck/uebersicht?typ=&inhalt=`, `GET /druck/berichte`, `GET /druck/bericht/{id}?von=&bis=&ausgabe=pdf/html/csv/json`; PDF ohne Fremdbibliothek (`Dienste/PdfDokument.cs`), `herunterladen=true` = Anhang |
| uebersicht | `GET /uebersicht/{typ}?inhalt=Standard/Fach/Lehrer/Klasse/Raum` (je Element `[tag, stunde, u, text, titel, farbe, fix]`), `POST /uebersicht/raum` (Raumverlegung/-tausch) |
| formate | `GET /formate` (Formate, Vorlagen, Grundformen, Feldarten), `PUT /formate/{name}` (speichern/umbenennen), `POST /formate/kopieren` (`{name, neu}`), `DELETE /formate/{name}` |

### Findet online statt (Online-Unterricht)

„Findet online statt“ wird **nur in UntPlan Studio** festgelegt (UntPlan Web, Mobile und iOS zeigen es nur an) und mit dem
Paket an UntPlan Web übertragen. Zwei Ebenen (Core: `Unterricht.Online/OnlineLink`, `Schuldatei.OnlineStunden`,
Logik in `UntPlan.Core.Vertretungsplanung.OnlineUnterricht`):

* **Unterricht** (regelmäßig online, Bereich `unterricht`, Rückgängig-Stufe `Unterricht`, gilt für die aktive Periode und wird wie
  andere Unterrichtsänderungen an Folgeperioden weitergegeben):
  * `GET /unterricht/online` → alle Unterrichte der aktiven Periode mit `online = true`: `[{ unterricht, online, onlineLink, fach, lehrer, klassen }]`
  * `GET /unterricht/{uid}/online` → `{ unterricht, online, onlineLink, fach, lehrer, klassen }` (`onlineLink` bleibt auch bei `online = false` gespeichert)
  * `PUT /unterricht/{uid}/online` mit `{ online: bool, onlineLink?: string|null }` (`null`/fehlend = Link unverändert, `""` = entfernen) → wie GET
  * zusätzlich Spalten der Unterrichtstabelle (Karte „Online“, nicht standardmäßig eingeblendet): `Online` (Bool `X`/leer) und
    `OnlineLink` (Text) über `PATCH /unterricht/{uid}` (`{ feld: "Online", wert: "X" }`).
* **Einzelne Stunde an einem Datum** (Abweichung vom Unterricht, Bereich `vertretung`, Rückgängig-Stufe `Vertretung`):
  * `GET /vertretung/online?von=yyyy-MM-dd&bis=yyyy-MM-dd` (ohne `bis`: nur der Tag) → Abweichungen im Zeitraum:
    `[{ datum, stunde, unterricht, online, onlineLink, abweichend: true, regel: { online, onlineLink }, fach, lehrer, klassen, geaendert, benutzer }]`
  * `GET /vertretung/online/stunde?datum=&stunde=&unterricht=` → Stand einer Stunde im selben Format (`abweichend` = Eintrag vorhanden)
  * `PUT /vertretung/online` mit `{ datum, stunde, unterricht, online: true|false|null, onlineLink?: string, block?: bool }` →
    `{ stunden: [ …Stand je Stunde wie oben… ] }`. `online = true`: Stunde findet online statt (`onlineLink` leer = Link des Unterrichts);
    `false`: findet trotz Online-Unterricht in Präsenz statt; `null`: Abweichung entfernen. Entspricht die Angabe genau dem Unterricht,
    wird kein Eintrag gespeichert. `block = true` setzt alle angrenzenden Stunden desselben Unterrichts (Doppel-/Blockstunde).
    404, wenn der Unterricht zu dieser Stunde nicht stattfindet.
* Tagesaktueller Plan `GET /vertretung/plan/{typ}/{id}?datum=`: jeder Eintrag zusätzlich `online`, `onlineLink`, `onlineAbweichend`.
* Links: leer oder absolute `http://`/`https://`-Adresse mit Host, ohne Leerzeichen, höchstens 1000 Zeichen – sonst 400 `{ fehler }`.
* Export an UntPlan Web: `WebUnterricht.online/onlineLink` (regelmäßig) und `WebStunde.online/onlineLink` (aufgelöst je Datum);
  der Link wird nur bei `online = true` übertragen. Siehe `docs/UNTPLANWEB.md`.

## Oberfläche

* **Kein Build-Schritt**, keine CDN-Abhängigkeit: ES-Module direkt aus `wwwroot`. Gestaltung nach dem Designsystem
  (`design/DESIGN.md`): Grundwerte in `css/tokens.css` (Kopie von `design/tokens.css`), auf die Namen der Oberfläche
  abgebildet in `css/basis.css`. Schrift IBM Plex Sans (lokal in `fonts/`). `html[data-modus="vertretung"]` schaltet den
  Akzent von Marine auf Petrol.
* **Aufbau:** Navigation (`kern/navigation.js`, nur Text), Kopfleiste (`kern/shell.js`), darunter die **Seite**
  (`kern/fenster.js`): Seitenkopf (Bereich + Titel) und eine Ansicht bzw. bei Arbeitsplätzen mehrere fest angeordnete
  Bereiche. Aufrufe aus Navigation, Suche und Übersicht beginnen eine neue Seite (`fensterverwaltung.naechsterAufrufNeueSeite()`),
  Aufrufe aus einer Ansicht öffnen einen Nebenbereich rechts, Aufrufe mit `lage` bauen Arbeitsplätze
  (`fensterverwaltung.arbeitsplatz(titel, aufbauen)`). Die Adresse (`#/<ansicht>?<parameter>`) und die Zurück-Taste
  des Browsers werden unterstützt. Es gibt keine schwebenden Fenster, Reiter oder frei teilbaren Bereiche.
* `js/kern/` – wiederverwendbare Bausteine (bitte nutzen statt eigene zu bauen):
  * `api.js` – `api.get/post/put/patch/loeschen/hochladen`, `api.dok('/pfad')`, `einstellungLesen/einstellungSchreiben`.
    Option `{ quelle: fenster.id }` bei Änderungen, damit die auslösende Ansicht ihr eigenes `daten`-Ereignis überspringen kann.
  * `ereignisse.js` – `an(name, f)`, `melden(name, daten)`, `betrifft(ereignis, 'Stammdaten', …)`. Wichtige Ereignisse:
    `dokument`, `stand`, `daten`, `modus`, `element` (Verknüpfung von Ansichten), `meldung`, `grunddaten`, `fenster-aktiv`, `arbeitsbereich`.
  * `zustand.js` – `zustand` (Benutzer, Dokument, Grunddaten, Modus), `elemente(typ)` (gecachte Auswahllisten), `darfSchreiben()`.
  * `dokument.js` – Öffnen/Schließen, Speichern, Rückgängig/Wiederholen, Ereignisverbindung.
  * `fenster.js` – Seitenverwaltung. Ansichtstyp (historisch „Fenster“): `{ titel, symbol, symbolFuer(p), einzig(p), erstellen(f, p) }`.
    In der Ansicht: `f.titel()`, `f.werkzeug({text, aktion})` (Textknopf; `nurSymbol` + `symbol` für Pfeile u. ä.),
    `f.trenner()`, `f.werkzeuge`, `f.inhalt`, `f.fuss`, `f.an(ereignis, f)` (wird beim Schließen abgemeldet),
    `f.parameterSetzen({...})` (fließt in Adresse und gespeicherte Arbeitsplätze), `f.beimSchliessen()`.
    Öffnen mit `fensterverwaltung.oeffnen(typ, parameter, lage)`; `lage.andock` (`links`, `rechts`, `lo`, `lu`, `ro`, `ru`)
    bzw. `x/y/b/h` bestimmen Spalte und Zeile im Arbeitsplatz. Die zuletzt gezeigte Seite wird je Dokument gespeichert.
  * `navigation.js` – `NAVIGATION`: fachliche Gliederung der Seitenleiste. Einträge verweisen per `ref` auf die id eines
    Modul-Eintrags (Befehl, Untermenü, Rechte werden übernommen). Die Befehlssuche findet zusätzlich jeden Eintrag und
    Untermenüpunkt aller Module.
  * `tabelle.js` – virtualisierte Tabelle (tausende Zeilen): Spalten sortieren/ein-/ausblenden/verschieben/Breite
    (gespeichert über `zustandSchluessel`), Inline-Bearbeitung mit Auswahllisten (Kurz-/Langname), Mehrfachauswahl,
    Tastaturbedienung, Kopieren/Einfügen als Tabulator-Text, Neuanlage-Zeile, gruppierte Zeilen (Kopplungen).
  * `raster.js` – Stundenplan-Raster (Blöcke, Kopplungen nebeneinander, gesperrte Zeiten, Drag & Drop mit Zielstatus).
    Kacheln mit Fachfarbe als Tönung (`--fachfarbe`).
  * `dialog.js` – `dialog`, `meldung`, `frage`, `formular`, `dateiWaehlen`, `menue` (Kontextmenü), `hinweis`, `fehlerMelden`, `laden`.
  * `auswahl.js` – Vorschlagsliste für Eingabefelder (auch Listen „5a,5b“).
  * `symbole.js` – Linien-Symbole (Lucide, ISC) unter fachlichen Namen; nur für Funktionen (Pfeile, Schließen, Suchen,
    Mehr) verwenden – Navigation, Menüs, Überschriften und Textknöpfe haben keine Symbole.
* Ein Oberflächen-Modul exportiert `{ id, css, fenster, befehle, ribbon, start }` (siehe Kopf von `js/kern/modulsystem.js`).
  Die Liste `ribbon` heißt aus historischen Gründen so; sie enthält die **Befehlseinträge** des Moduls:
  `{ id, reiter, gruppe, text, symbol, befehl, args, menue, hinweis, taste, braucht: 'dokument'|'schreiben'|'admin', gedrueckt }`.
  Eigenes Steuerelement in der Kopfleiste: `element: () => HTMLElement` (z. B. Datumsauswahl der Vertretungsplanung; mit
  `reiter: 'Vertretungsplanung'` nur im Vertretungsmodus). **Gleiche `id` ersetzt einen früheren Eintrag.**
  Damit ein neuer Eintrag in der Seitenleiste erscheint, in `NAVIGATION` einen Verweis `{ ref: '<id>', text, symbol }` ergänzen.

## Neues Modul anlegen (konfliktarm)

1. Server: `studio/src/UntPlanStudio/Api/<Modul>Api.cs`
   ```csharp
   public sealed class VertretungApi : IStudioModul
   {
       public string Name => "vertretung";
       public void DiensteRegistrieren(IServiceCollection d) { /* optional */ }
       public void EndpunkteRegistrieren(StudioRouten r)
       {
           var g = r.Dokument.MapGroup("/vertretung");
           g.MapGet("/tag/{datum}", (Arbeitsdokument a, DateOnly datum) => a.LesenAsync(doc => /* DTO */));
           g.MapPost("/absenzen", (Arbeitsdokument a, NeueAbsenz n, ClaimsPrincipal p) =>
               a.AendernAsync(p.Benutzername(), "Absenz angelegt", AenderungsArt.Vertretung, d => { /* Core */ }, doc => /* DTO */));
       }
   }
   ```
   Eigene Dienste/Hilfsklassen in `Dienste/<Modul>*.cs`. Eine Zeile in `Api/Modulregister.cs` (Erweiterungsstelle).
2. Oberfläche: `wwwroot/js/module/<modul>.js` (Fenstertypen `'<modul>.<fenster>'`, Befehle `'<modul>.<befehl>'`,
   Befehlseinträge; Verweis in `kern/navigation.js`), optional `wwwroot/css/module/<modul>.css` (Klassen mit Modulpräfix).
   Zwei Zeilen in `wwwroot/js/module/register.js` (Import + Liste).
3. Tests: `studio/tests/UntPlanStudio.Tests/<Modul>Tests.cs` (`IClassFixture<StudioFabrik>`, Hilfen in `StudioFabrik.cs`).
   Die Syntax aller JS-Module und das Modulregister werden automatisch geprüft.
4. Benutzereinstellungen mit Präfix `<modul>.`; CSS-Klassen mit Präfix; keine Änderungen an Kern-Dateien nötig –
   fehlt im Kern etwas Allgemeines, klein und rückwärtskompatibel ergänzen.
