# UntPlan Studio – Architektur

UntPlan Studio ist die Planungsanwendung von UntPlan im Browser. Die **gesamte Fachlogik liegt in `src/UntPlan.Core`** –
das Studio ist eine dünne Server-Schicht (ASP.NET Core 8, REST/JSON) plus eine Oberfläche in React 18 + TypeScript (strikt)
mit Fluent UI v9 (Quelle `studio/client`, mit Vite nach `wwwroot` gebaut). Schuldateien (`.up`) sind JSON-Dateien und lassen sich jederzeit herunterladen und wieder hochladen.

```
Browser (studio/client → wwwroot)                  Server (UntPlanStudio)                         UntPlan.Core
┌───────────────────────────────┐   REST/JSON    ┌───────────────────────────────────────┐      ┌──────────────────┐
│ Shell: Navigation, Kopfleiste,│ ─────────────▶ │ Api/<Modul>Api.cs  (IStudioModul)      │ ───▶ │ Dokument, Model, │
│ Seiten und Arbeitsplätze      │                │   └─ Arbeitsdokument (Sperre, Undo)    │      │ Stammdaten,      │
│ Module: src/module/<modul>/   │ ◀───────────── │ Dokumentdienst (Ablage, Autosave)      │      │ Planung, …       │
│ Komponenten: Tabelle, Raster  │  SSE-Ereignisse│ Benutzerdienst, Benutzereinstellungen  │      └──────────────────┘
└───────────────────────────────┘                │ StudioDatenbank (SQLite oder MariaDB)  │
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
    Dienste/                   StudioDatenbank (Sicherungsdienst), Datenbankanbieter (SQLite/MySQL), AltdatenUebernahme,
                               Arbeitsdokument, Dokumentdienst, Autospeicherung, Benutzerdienst, Benutzereinstellungen,
                               Felder (Stammdaten-Spalten), Unterrichtsspalten (dto.)
    Api/
      Modulregister.cs         ◀ EINZIGE Registrierungsstelle der Server-Module
      AnmeldungApi.cs, BenutzerApi.cs, EinstellungenApi.cs, DokumenteApi.cs     Fundament
      StammdatenApi.cs, UnterrichtApi.cs, StundenplanApi.cs                     erste Fachmodule
    wwwroot/                   Build-Ausgabe von studio/client (nicht eingecheckt; entsteht beim Bauen des Projekts)
  client/                      Oberfläche: Vite + React 18 + TypeScript (strict) + Fluent UI v9
    package.json, vite.config.ts, tsconfig.json, index.html, public/ (Symbol, Schriften)
    PORTIERUNG.md              Stand der Portierung je Modul der früheren Oberfläche
    src/main.tsx, App.tsx      Start: Thema, Anmeldung → Shell → Module → letztes Dokument; Router
    src/theme.ts               Marken-Rampe Petrol (EduOrga, #164C55/#28747A) → hell/dunkel, IBM Plex Sans
    src/stile/thema.css        Studio-Ergänzungen zu design/tokens.css: dunkle Rollen, Modusfarbe (data-modus), Seitenleiste
    src/api/                   client.ts (typisierte REST-Aufrufe), typen.ts
    src/kern/                  befehle, ansichten, modulsystem, ereignisse, zustand, dokument, laden, hilfen
    src/komponenten/           ansicht (Seitenrahmen, Werkzeuge), tabelle/ (TanStack), raster/ (Stundenpläne, dnd-kit),
                               dialoge, menue, hinweise, ziehen (Drag & Drop), symbole, marke (Monogramm, Slogan,
                               rechtlicher Hinweis), eingaben (DatumFeld: Fluent DatePicker deutsch)
    src/shell/                 Kopfleiste, Seitenleiste (Fluent Nav), Befehlssuche, Seite, Arbeitsplatz, Anmeldung, Startseite
    src/module/register.ts     ◀ EINZIGE Registrierungsstelle der Oberflächen-Module
    src/module/<modul>/        index.ts (Ansichten, Befehle, Einträge) + Ansichten (*.tsx), optional <modul>.css
  tests/UntPlanStudio.Tests/   xUnit + WebApplicationFactory (API, Modulregister, Startseite, Typprüfung per Node)
  tests/smoke/*.cjs            Playwright-Tests der Oberfläche (hilfe.cjs: gemeinsame Hilfen; Bildschirmfotos)
```

## Server

### Ablage: eigene Datenbank (SQLite `studio.db` oder MySQL/MariaDB)

Das Studio hat eine eigene Datenbank (`Dienste/StudioDatenbank.cs`), unabhängig von der Datenbank von EduOrga Web:
standardmäßig SQLite `<STUDIO_DATEN>/studio.db` (`Microsoft.Data.Sqlite`, WAL-Modus, `busy_timeout=5000`), mit
`STUDIO_DB=mysql` + `STUDIO_DB_CONNECTION` MySQL/MariaDB (`MySqlConnector`, InnoDB, utf8mb4, READ COMMITTED). Die kleine
Provider-Abstraktion `Dienste/Datenbankanbieter.cs` (`SqliteAnbieter`, `MySqlAnbieter`) kapselt Verbindung, Transaktion,
Migrationen je Datenbank (gleiche Tabellen und Spalten), Schema-Version und die beiden Stellen mit eigenem SQL (Upsert,
Reihenfolge der `ablage`); alles andere ist Standard-SQL über `DbConnection`. Eine Verbindung je Vorgang (Verbindungspool),
Schreibvorgänge in Transaktionen (SQLite `BEGIN IMMEDIATE`) und zusätzlich prozessweit nacheinander.

| Tabelle | Inhalt |
|---|---|
| `dokumente` | `id` (16 Hex-Zeichen), `name`, `besitzer`, `erstellt`, `geaendert`, `gespeichert`, `herkunft`, `info` (`DokumentInfo` als JSON), `inhalt` (BLOB), `format` (0 = Schuldatei-JSON Byte für Byte wie eine `.up`-Datei, 1 = dasselbe gzip-komprimiert; Standard, `STUDIO_DB_KOMPRIMIEREN`), `groesse` (Größe der `.up`-Datei) |
| `dokument_sicherungen` | ältere Fassungen je Dokument (`nr`, `id`, `zeit`, `inhalt`, `format`, `groesse`, `art`, `benutzer`) – ersetzt die frühere `.bak`-Datei. `art = automatisch`: beim Speichern wandert der bisherige Inhalt hierher, aber höchstens alle `STUDIO_FASSUNG_MINUTEN` (10), die letzten 10 bleiben; `art = sicherungspunkt`: der aktuelle Stand (Strg+S, `POST …/sicherungspunkt`), die letzten 20 bleiben |
| `ablage` | JSON-Werte unter `bereich` + `schluessel` (`Ablagebereiche`): `benutzer` (je Benutzer ein `StudioBenutzer`), `einstellungen` (je Benutzer ein JSON-Objekt), `multiuser` (`konfiguration` = `MuKonfiguration`), `untplanweb` (je Dokument-Id ein `UpwAbgleich`), `untplanweb-direkt` (je Dokument-Id ein `UpwDirekt`: Vertretungen automatisch übertragen) |
| `meta` | `anwendungsversion` (erkennt Updates), bei MySQL zusätzlich `schemaversion` |

* **Schema-Version** (SQLite `PRAGMA user_version`, MySQL `meta.schemaversion`, derzeit 2); Migrationen stehen je Anbieter in
  `Datenbankanbieter.Migrationen` (Eintrag *i* hebt Version *i* auf *i + 1*, beide Listen gleich lang) und laufen beim Start.
  Neue Migration = bei beiden Anbietern einen Eintrag anhängen, bestehende nie ändern (MySQL: DDL ist nicht transaktional –
  wiederholbar schreiben). Schema 2: Spalten `format`, `art`, `benutzer` (bei MySQL schon in Version 1 enthalten).
* **MySQL/MariaDB:** fehlt die Datenbank, wird sie angelegt (wenn erlaubt); beim Start wird bis `STUDIO_DB_WARTEN_SEKUNDEN`
  auf den Server gewartet. Ist sie leer und liegt im Datenordner eine `studio.db`, wird diese vollständig übernommen
  (`SqliteUebernehmen`, eine Transaktion; die Datei bleibt). Sichern übernimmt der Datenbankserver (`installation/update.sh`:
  `mariadb-dump`); `--sichern`, `Sicherungsdienst` und `POST /api/sicherungen` gelten nur für SQLite.
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
* **Sofortiges Speichern (kein „Speichern“ mehr nötig):** `Arbeitsdokument` meldet jede gemeldete Änderung (`AendernAsync`,
  `AusfuehrenAsync` mit Änderungsart – also auch Rückgängig/Wiederholen) nach dem Freigeben der Sperre an den `Dokumentdienst`
  (`Vormerken`). Nach `STUDIO_SPEICHERN_VERZOEGERUNG_MS` (800 ms) wird gespeichert; weitere Änderungen in dieser Zeit gehören zum
  selben Schreibvorgang, Änderungen während des Schreibens werden neu vorgemerkt. `SpeichernAsync` erzeugt den Inhalt unter
  der Dokumentsperre (`Dokument.Speichern(Action<byte[]>)` setzt `IstGeaendert` zurück) und schreibt danach **außerhalb** der
  Sperre (Komprimieren + eine Transaktion); eine eigene Speichersperre je Dokument hält die Reihenfolge. Schlägt das Schreiben
  fehl: Dokument wieder „geändert“, `Speicherfehler` gesetzt, Ereignis `speicherfehler`, neuer Versuch nach 2, 4, 8 … höchstens 60 s.
  `Autospeicherung` (alle `STUDIO_AUTOSPEICHERN_SEKUNDEN`, 30) ist nur noch Sicherheitsnetz, speichert beim Beenden alles
  (`Dokumentdienst.BeendenAsync`, wartet laufende Vorgänge ab) und entlädt lange unbenutzte Dokumente ohne Ereignis-Abonnenten
  (`STUDIO_LEERLAUF_MINUTEN`). Andere Dienste können `Dokumentdienst.Geaendert` abonnieren (z. B. `VertretungsUebertragung`).
* **MultiUser** ist davon unberührt: alle Benutzer arbeiten weiterhin an demselben `Arbeitsdokument` im Speicher, Sperren je
  Bereich, Exklusivbetrieb und Rechte prüft der Endpunktfilter vor jeder Änderung wie bisher. Gespeichert wird je Dokument
  (nicht je Benutzer) – wie früher, als „Speichern“ eines Benutzers die Änderungen aller speicherte, nur jetzt sofort.
  `speichern` und `sicherungspunkt` sind nie gesperrt (`MultiUserDienst.Frei`).
* Fehlermeldungen des Core (`InvalidOperationException`, `FormatException`) werden als HTTP 400 `{ "fehler": "…" }`
  gemeldet als Hinweis. Eigene Fehler: `throw StudioFehler.Ungueltig(...)`, `.NichtGefunden(...)`, `.Verboten()`.
* Lange Berechnungen (z. B. Optimierung) nicht unter der Sperre laufen lassen: Daten unter `LesenAsync` kopieren
  (`Dokument.Klonen`), rechnen, Ergebnis per `AendernAsync` übernehmen.

### Ereignisse (Aktualisierung zwischen Fenstern und Benutzern)

`GET /api/dokumente/{dok}/ereignisse` (Server-Sent Events): `hallo`, `aenderung` (`{ version, bereich, beschreibung, benutzer, zeit }`),
`gespeichert` (nach jedem Speichervorgang), `speicherfehler`, `untplanweb` (direkte Übertragung beendet, `beschreibung` = Ergebnis),
`geschlossen`. Zusätzlich trägt jede Antwort eines Dokument-Endpunkts die Kopfzeilen `X-Dokument-Version`
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
| dokumente | `GET /api/dokumente` (Liste + zuletzt), `POST /api/dokumente/neu`, `POST /api/dokumente/beispiel`, `POST /api/dokumente/hochladen` (multipart `datei`: .up oder BAL); je Dokument: `GET ""` (Stand), `GET /grunddaten` (Zeitraster, Perioden nach Beginn sortiert mit `ende` = letzter gültiger Tag und `mutterId`), `POST /speichern` (sofort schreiben, z. B. „Erneut versuchen“), `POST /sicherungspunkt` (Strg+S), `GET /fassungen` (ältere Fassungen `{nr, zeit, groesse, art, benutzer}`), Stand mit `geaendert`/`speichert`/`speicherfehler`, `GET /herunterladen`, `POST /schliessen`, `DELETE ""`, `PUT /name`, `POST /rueckgaengig`, `POST /wiederholen`, `POST /bal-import` (multipart + Optionen), `GET /ereignisse` |
| stammdaten | `GET /stammdaten/{typ}`, `GET /stammdaten/{typ}/felder`, `POST /stammdaten/{typ}` (`{kurzname, werte}`), `PATCH /stammdaten/{typ}/{id}` (`{feld, wert}`), `POST /stammdaten/{typ}/aendern` (`{aenderungen:[{id,feld,wert}]}`), `POST /stammdaten/{typ}/loeschen` (`{ids}`), `DELETE /stammdaten/{typ}/{id}`, `GET /stammdaten/{typ}/verwendung?ids=`, `GET /elemente?typen=` (Auswahllisten `{k,l}`) |
| unterricht | `GET /unterricht?sicht=klasse|lehrer|fach|alle&element=`, `GET /unterricht/spalten` (je Spalte `art`, `auswahl`), `POST /unterricht` (`{sicht, element, werte}`), `PATCH /unterricht/{uid}` (`{feld, wert, zeile}`), `POST /unterricht/aendern` (`{aenderungen:[{uid,feld,wert,zeile}]}`, eine Rückgängig-Stufe, alles oder nichts), `POST /unterricht/{uid}/zeilen`, `DELETE /unterricht/{uid}/zeilen/{nr}`, `POST /unterricht/{uid}/kopieren`, `POST /unterricht/loeschen`, `GET /unterricht/online`, `GET/PUT /unterricht/{uid}/online` (siehe „Findet online statt“) |
| stundenplan | `GET /stundenplan/{typ}/{id}` (Zellen mit Einträgen je Kopplungszeile, nicht verplante Stunden), `GET /stundenplan/{typ}/block?ids=` (Blockansicht: `{zeitraster, periode, alle:[{id,kurz,lang,gruppe}], plaene:[{element, zellen, nichtVerplant}]}`, ids leer = alle; gruppe = Jahrgang/Abteilung/Raumart), `GET /stundenplan/zielstatus?unterricht=&tag=&stunde=`, `POST /stundenplan/verplanen`, `POST /stundenplan/verschieben`, `POST /stundenplan/entplanen`, `POST /stundenplan/fixieren` |
| vertretung | Datum: `GET /vertretung/start`, `GET …/blaettern?datum=&richtung=&woche=`, `POST …/aktualisieren` (Tageswechsel, nur bei Bedarf); `GET …/kalender?datum=`, `POST …/kalendertag`, `PUT …/tagestexte`; Absenzen: `GET …/absenzen?art=&von=&bis=`, `POST …/absenzen/speichern` (liefert `nachfragen`), `…/nachfrage`, `…/loeschen`, `…/teilen`, `…/kopieren`, `…/zusammenfassen`; Liste: `GET …/liste` (Spalten + Zeilen, Filter), `GET …/optionen?id=&spalte=`, `POST …/aendern` (`{ids, spalte, wert}`), `…/entfall`, `…/ohnelehrer`, `…/teilen`, `…/vormerken`, `…/zuruecksetzen`, `…/loeschen`, `…/kennzeichen`, `…/neuberechnen`, `…/veranstaltungslehrer`, `GET/POST …/automatik`; Vorschlag: `GET …/vorschlag/{id}`, `POST …/vorschlag/{id}/uebernehmen|betreuung|raum|vorziehen`; `POST …/sondereinsaetze`, `GET …/klassenkonferenz`, `GET …/bereitschaften`, `…/bereitschaftsplanung[/vorschlag|/{aktion}]`, `GET/POST …/vormerkungen[/{id}/verplanen|/loeschen]`; tagesaktuell: `GET …/plan/{typ}/{id}?datum=`, `GET …/plan/zielstatus`, `POST …/plan/verlegen|entfall|entfallrueckgaengig|vormerken|aenderungenrueckgaengig|text`; Online-Stunden: `GET/PUT …/online`, `GET …/online/stunde` (siehe „Findet online statt“); `GET/PUT …/einstellungen`. Rückfragen: Antwort `{ frage: { schluessel, text, optionen } }`, Wiederholung mit `antworten: { schluessel: index }` |
| veranstaltungen | `GET /veranstaltungen?von=&bis=`, `POST /veranstaltungen[/{id}]` (`{feld, wert, datum}`), `GET …/gruppen?feld=&va=`, `POST …/schnell[/{id}]`, `…/{id}/ausstunden`, `…/ausstunde`, `…/{id}/kopieren`, `…/loeschen`, `GET …/schuelergruppen` |
| optimierung | `GET /optimierung/diagnose?rubrik=`, `GET /optimierung/kennzahlen`, `GET/PUT /optimierung/gewichtung` (`{werte}`), `GET /optimierung/gewichtung/analyse`, `GET /optimierung/strategien`, `POST /optimierung/start` (`{optionen, zuordnen}` → Hintergrundauftrag auf `Dokument.Klonen`), `GET /optimierung/auftrag` (Status/Fortschritt/Ergebnisse, Abfrage ~0,6 s), `POST /optimierung/auftrag/abbrechen`, `POST /optimierung/auftrag/uebernehmen` (`{nummer, trotzAenderung}`; 409 wenn das Dokument inzwischen geändert wurde), `DELETE /optimierung/auftrag`, `GET /optimierung/auftrag/plan/{nummer}/{typ}/{id}` (Ergebnisvergleich) |
| planung | `GET /planung/zielstatus?unterricht=&tag=&stunde=&einzeln=&laenge=` (`{status, gruende}` je Feld), `POST /planung/verschieben` (Block bzw. `einzeln`; `aktion` auto/entplanen/kollision – ohne Aktion bei Behinderung `{ok:false, frage}`), `POST /planung/verplanen` (`{unterricht, tag, stunde, laenge, aktion}`), `POST /planung/entplanen` / `POST /planung/fixieren` (`{stunden:[{unterricht,tag,stunde}]}`, Mehrfachauswahl), `POST /planung/alle-entplanen`, `POST /planung/alle-fixieren`, `GET/POST /planung/raum` (Raumliste bzw. zuordnen/löschen mit `umfang`, `loesung`), `GET /planung/tausch` (Tauschvorschläge), `POST /planung/tauschen` |
| zeitwuensche | `GET /zeitwuensche/{typ}` (Elemente mit Anzahl), `GET/PUT /zeitwuensche/{typ}/{id}` (`{aenderungen:[{tag,stunde,wert}]}` bzw. `{alleLoeschen}`), `PUT /zeitwuensche/{typ}/{id}/unbestimmte` – typ: klasse, lehrer, raum, fach, unterricht |
| austausch | `GET /austausch` (Übersicht), `POST /austausch/csv/{lehrer|klassen|schueler}` (multipart), `POST /austausch/gpu` (mehrere Dateien oder ZIP), `GET /austausch/gpu` (ZIP), `GET /austausch/unterricht.csv`, `GET /austausch/infostundenplan.zip`, `GET /austausch/ical/{lehrer}?von=&bis=`, `GET /austausch/untplanweb.json`, `GET/POST /austausch/abteilung/{id}` (Abteilungsdatei exportieren/zusammenführen) |
| untplanweb | `GET /untplanweb` (Zeilen, Status, Anfangsdatum), `GET/PUT /untplanweb/einstellungen` (leerer API-Schlüssel = unverändert), `POST /untplanweb/pruefen`, `GET /untplanweb/schulname`, `PUT /untplanweb/anfangsdatum`, `POST /untplanweb/export/{stammdaten|unterricht|vertretungen|alles}` bzw. `POST /untplanweb/import/{absenzen|studenten|kurse}` (Hintergrundauftrag) + `GET /untplanweb/auftrag/{id}` (Fortschritt), `GET /untplanweb/stpl?von=&bis=&erledigte=&neu=`, `POST /untplanweb/stpl/uebernehmen|ignorieren` (`{ids}`), `PUT /untplanweb/stpl/einstellungen`, `GET/POST /untplanweb/klausuren`, `PUT/DELETE /untplanweb/klausuren/{id}`, `GET /untplanweb/schuelerabwesenheiten`, `GET /untplanweb/klassenbuch`, `GET/PUT /untplanweb/abgleich`, `POST /untplanweb/abgleich/jetzt` (automatischer Abgleich: Hintergrunddienst `UpwAbgleichDienst`, Einstellungen in der Datenbank, `ablage` Bereich `untplanweb`); direkte Übertragung: `POST /untplanweb/vertretungen/senden` (ein Klick, wartet auf das Ergebnis; dasselbe Paket wie Export „Vertretungen*“: Stammdaten + Vertretungen, Tage mit `nurAenderungen`), `GET/PUT /untplanweb/direkt` (`{automatisch, sekunden}` → Stand `{eingerichtet, automatisch, sekunden, laufend, faellig, letzte: {zeit, ok, text, revision, automatisch, benutzer}, zuletztErfolgreich, revision}`; automatisch: `VertretungsUebertragung` sendet spätestens `sekunden` nach einer Änderung der Art `Vertretung`/`Alles`, Fehler werden mit 1, 2, 4 … 15 min wiederholt). Exporte vermerken Revision/Zeit ohne eigene Rückgängig-Stufe |
| abrechnung | `GET /abrechnung/werte`, `PATCH /abrechnung/werte/{lehrer}` (`{feld: Wochensoll|Wertkorrektur, wert}`), `GET /abrechnung/matrix?art=0|1|2`, `GET/PUT /abrechnung/stundentafel`, `POST /abrechnung/stundentafel/jahrgang|nrw`, `GET /abrechnung/berichte`, `GET /abrechnung/statistik?bericht=0..6&von=&bis=&lehrer=` (+ `.html` mit `alle=true`, `.csv`), `GET /abrechnung/zaehler/{lehrer}?datum=` |
| pausenaufsicht | `GET /pausenaufsicht`, `GET /pausenaufsicht/gang/{id}`, `GET /pausenaufsicht/lehrer/{id}`, `PUT /pausenaufsicht/zelle` (`{gang,tag,nach,lehrer:"AB, CD"}`), `GET /pausenaufsicht/vorschlag?gang=&tag=&nach=`, `POST /pausenaufsicht/zuordnen|teile|loeschen|optimieren`, `GET/PUT /pausenaufsicht/gewichtung`, `GET/POST /pausenaufsicht/vertretung/{datum}` (Aufsichtsvertretungen mit Kandidaten) |
| kursplanung | `GET /kursplanung` (Klassen), `GET /kursplanung/{klasse}`, `PATCH /kursplanung/{klasse}/kurs/{uid}` (`{feld: band|kursname}`), `PUT /kursplanung/{klasse}/wahl`, `POST /kursplanung/{klasse}/zufall|bandbildung|baender` |
| kommentare | `GET /kommentare?typ=&element=`, `GET /kommentare/kategorien`, `POST /kommentare`, `PUT /kommentare/{id}`, `POST /kommentare/loeschen` |
| multiuser | je Dokument: `GET /multiuser?nach=&taetigkeit=` (Lebenszeichen, aktive Benutzer, Sperren, Exklusiv, Nachrichten), `POST /multiuser/lebenszeichen|abmelden|nachricht`, `POST /multiuser/sperren` (`{bereich}`), `DELETE /multiuser/sperren/{bereich}`, `POST /multiuser/exklusiv` (`{ein}`); global: `GET /api/multiuser/ich`, Admin: `GET /api/multiuser/verwaltung`, `POST/PUT/DELETE /api/multiuser/gruppen[/{id}]`, `PUT /api/multiuser/benutzer/{name}`. Ein Endpunktfilter auf `/api/dokumente/{dok}` prüft jede ändernde Anfrage (423 Sperre/Exklusivbetrieb eines anderen Benutzers, 403 fehlende Rechtestufe der Gruppe; Bereich = erstes Pfadsegment, siehe `MultiUserDienst.BereichVon`) |
| einstellungen-schule | `GET/PUT /schule/schuldaten`, `GET/PUT /schule/zeitraster`, `GET/POST /schule/ferien`, `PATCH /schule/ferien/{id}` (`{feld, wert}`), `POST /schule/ferien/loeschen`, `POST /schule/ferien/nrw`, `POST /schule/ferien/tag` (`{datum, unterrichtsfrei, feiertag}`), `POST /schule/ferien/freigeben` (`{von, bis}`: Zeitraum wieder Schultage, Einträge kürzen/teilen, eine Rückgängig-Stufe), `GET/POST /schule/perioden` (POST `{mutterId, name, von, bis, aktivieren}` – `aktivieren` setzt sie in derselben Rückgängig-Stufe aktiv), `PUT/DELETE /schule/perioden/{id}`, `POST /schule/perioden/{id}/aktiv`, `PUT /schule/perioden/folgeperioden`, `GET/POST /schule/ugruppen`, `PUT /schule/ugruppen/{id}`, `POST /schule/ugruppen/loeschen`, `PUT /schule/wochenperiodizitaet` |
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

* **Technik:** React 18, TypeScript (strict), Fluent UI v9 (`@fluentui/react-components`, Symbole aus
  `@fluentui/react-icons`), TanStack Table + Virtual (Tabellen), dnd-kit (Ziehen und Ablegen), React Router (Adressen),
  zustand (gemeinsamer Zustand). Quelle in `studio/client`, Build mit Vite nach `src/UntPlanStudio/wwwroot`
  (`npm run build` = `tsc --noEmit` + `vite build`). Das Ziel `StudioOberflaecheBauen` in `UntPlanStudio.csproj` baut die
  Oberfläche bei `dotnet build/publish/test` automatisch, sobald sich `studio/client` geändert hat (Node.js 22 nötig;
  abschaltbar mit `-p:StudioOberflaecheBauen=false`, das Dockerfile baut sie in einer eigenen Node-Stufe). Keine CDN-Quellen.
* **Gestaltung** nach `design/MARKE.md` und `design/DESIGN.md`: Fluent-Thema aus der Petrol-Rampe (`src/theme.ts`,
  `createLightTheme/createDarkTheme` mit eigenen Neutraltönen für Kontrast), Modusfarbe über `data-modus` am `<html>`
  (`--edo-modus`, Stundenplanung Petrol, Vertretungsplanung Indigo; `src/stile/thema.css`), Thema vor dem ersten Zeichnen aus
  `public/thema.js` (CSP: kein Inline-Skript), Schrift IBM Plex Sans (lokal, `public/fonts`), Grundwerte aus `design/tokens.css`
  (Fachfarben, Statusflächen `--up-…`). Hell/Dunkel/Automatisch im Kontomenü. Keine Verläufe, keine Symbolkacheln.
* **Shell:** Kopfleiste (Schuldatei-Menü, Modus Stundenplanung/Vertretungsplanung, Steuerelemente der Module wie Planungsdatum
  und aktive Benutzer, im Vertretungsmodus „An Web senden“ (`module/untplanweb/Senden.tsx`, Befehl `untplanweb.vertretungenSenden`,
  einbindbar als `<VertretungenSendenKnopf />`), Rückgängig/Wiederholen, Speicherstand `shell/speicherstatus.tsx` – „Gespeichert · 14:32“ /
  „Speichert …“ / „Nicht gespeichert · Erneut versuchen“; Strg+S = Sicherungspunkt –, Befehlssuche Strg+K, Konto), Seitenleiste (Fluent `NavDrawer`,
  fachliche Gruppen aus `src/shell/navigation.ts`; in schmalen Fenstern überlagernd) und darunter die **Seite**.
* **Seiten und Adressen:** Jede Ansicht hat eine Adresse `/<pfad>?<parameter>` (z. B. `/stundenplan?typ=klasse&element=3`);
  Zurück/Vor des Browsers und Neuladen funktionieren (der Server liefert für alle Oberflächen-Adressen `index.html`).
  Öffnet eine Ansicht eine verwandte Ansicht, erscheint sie als **Nebenbereich** rechts (`?n=<typ>&n.<parameter>=…`).
  **Arbeitsplätze** (`/arbeitsplatz/<name>`, z. B. „Manuell planen“, „Tagesplanung“) zeigen mehrere Bereiche mit
  verschiebbaren Trennern; Ansichten darin sind verknüpft (Ereignis `element`, `vertretung.auswahl`). Gehört eine Seite zu
  einem Modus (`modus` der Ansicht), wird er beim Öffnen eingestellt; ein Moduswechsel führt zur Übersicht.
* `src/kern/` – Grundlagen (bitte nutzen statt eigene zu bauen):
  * `api/client.ts` – `api.get/post/put/patch/loeschen/hochladen`, `api.dok('/pfad')`, `einstellungLesen/einstellungSchreiben`,
    `dateiHerunterladen`. Option `{ quelle: ansicht.id }` bei Änderungen, damit die auslösende Ansicht ihr eigenes
    `daten`-Ereignis überspringt. Jede Antwort mit `X-Dokument-Version` löst `daten` aus (auch Änderungen anderer Benutzer per SSE).
  * `ereignisse.ts` – typisierter Ereignisbus: `an`, `melden`, `useEreignis`, `betrifft(ereignis, 'Stammdaten', …)`.
  * `zustand.ts` – `useStudio` (Benutzer, Dokument, Grunddaten, Modus, Thema), `elemente(typ)`, `useDarfSchreiben()`.
  * `laden.ts` – `useDaten(laden, deps, { bereiche, quelle })`: lädt und lädt bei passenden Datenänderungen still nach.
  * `ansichten.tsx` – Registry der Ansichten `{ titel, pfad, komponente (lazy), modus, schluessel(p), ohneDokument }` und
    `useAnsicht()` → `{ id, typ, lage, p, parameterSetzen, oeffnen(typ, p), schliessen, alsSeite }`.
  * `befehle.ts` – Befehle (`befehlRegistrieren`, `befehl`), **Befehlseinträge** (`{ id, text, gruppe, ansicht | arbeitsplatz |
    befehl | aktion, menue, braucht: 'dokument'|'schreiben'|'admin', taste, modus }`), Tastenkürzel, `seiteOeffnen`.
* `src/komponenten/` – `AnsichtRahmen` (Seitenkopf bzw. Bereichskopf, Werkzeugleiste, Filter, Fuß), `Werkzeug`, `Feld`,
  `ElementAuswahl` (durchsuchbar); `farbwahl` (`farbwahl(x, y, {wert, titel})` → Palette mit 24 Farben + Hex, `zufallsfarben(n, vorhandene)` gut unterscheidbar, Host in der Shell); `Segmente` (Segmentschalter, z. B. Einzelplan/Blockansicht); `SuchAuswahl` (`suchauswahl.tsx`, Fluent Combobox: Tippen filtert, nur Werte der
  Liste, einzeln/mehrfach – auch `formular`-Felder `auswahl`, `element`, `elemente`; `datum` = Kalender, ISO);
  `Tabelle` (siehe „Tabelle“ unten); `Raster`/`Stundenplanraster` (Stundenpläne mit Blöcken und Kopplungen; Ziehen mit dnd-kit: Verplanen,
  Verschieben, Tauschen, Zielstatus je Feld mit Begründung am Mauszeiger); `dialoge` (Promise-Dialoge `dialog`, `frage`,
  `meldung`, `formular`, `dialogZeigen` mit `StandardDialog`), `menue` (Kontextmenüs, `MenueKnopf`), `hinweise`
  (`hinweis`, `fehlerMelden`), `ziehen` (gemeinsamer `DndContext`, damit zwischen Bereichen gezogen werden kann).
* **Tabelle** (`src/komponenten/tabelle/`: `Tabelle.tsx`, `vorschlagsliste.tsx` Auswahlliste, `pruefung.ts` Prüfung/TSV/Filter,
  `mehrfach.tsx` Dialog „Mehrfach ändern“) – bedient sich wie eine Tabellenkalkulation:
  * Spalten `{ schluessel, titel, art, auswahl, refTyp, editierbar(Fuer), pruefen, zusatzWerte, zulassen, vorschlaege, wert, farbe, klasse }`;
    `art` steuert Editor und Prüfung: `Element`/`ElementListe` (Kombinationsfeld bzw. Mehrfachauswahl mit Haken aus
    `optionen(s)`), `Auswahl` (`auswahl`), `Bool` (Haken), `Datum` (Eingabefeld „19.10.2026“ + Fluent-Kalender wie `DatumFeld`, öffnet bei Enter/F2/Doppelklick, Alt+↓/F4 schaltet ihn um), `Ganzzahl`/`Dezimal`/`Bereich`/`Farbe`
    (geprüft), `Text` (Vorschläge aus vorhandenen Werten). Der Server liefert die Metadaten mit (`felder` der Stammdaten,
    `spalten` des Unterrichts mit `art`/`auswahl`) – die Oberfläche baut daraus die Editoren generisch.
  * Unbekannte/ungültige Werte werden nie gespeichert (Editor bleibt offen mit Meldung; beim Einfügen Zelle `.fehler` mit
    `title`); Serverfehler beim Speichern markieren die Zelle ebenso. `zusatzWerte` (z. B. `-`, `+` für Vertreter) und
    `zulassen(teil)` (z. B. „Alle Klassen außer …“) erweitern die zulässigen Werte, `pruefen: false` schaltet die Prüfung ab.
  * Auswahl: Zeilen (`gewaehlt`, Klick/Strg/Umschalt, Auswahlkästchen) und Zellbereich (`bereich`, Umschalt+Pfeil, Ziehen);
    `beiAuswahl(zeilen, aktiv)`. Fußleiste `[data-tabelle-status]`: Anzahl, Summe, Filter, Kopieren/Mehrfach ändern/Löschen.
  * Sammelaktionen (Einfügen, Ausfüllen Strg+D, Inhalte löschen, Mehrfach ändern) laufen über `aendernMehrere(liste)`
    (eine Rückgängig-Stufe: `POST …/stammdaten/{typ}/aendern`, `POST …/unterricht/aendern`; Vertretungen je Spalte+Wert
    `…/vertretung/aendern`), sonst nacheinander über `aendern`.
  * Kontextmenü = Einträge des Moduls (`kontextmenue`) + Standardeinträge; Spaltenkopf-Menü (sortieren, filtern, nach
    Wert filtern, ausblenden, Breite). Filterzeile (Strg+Umschalt+L); durch Bearbeitung herausfallende Zeilen bleiben bis
    zur nächsten Filteränderung (`.tb-ausserfilter`).
  * Spaltenzustand (Reihenfolge, Breite, Sichtbarkeit, Sortierung, `fz` Filterzeile, `mk` Auswahlkästchen, `kp` kompakt
    24 px statt 28 px) in `localStorage` (`studio.<zustandSchluessel>` bzw. `studio.tabelle.<name>`) und mit
    `zustandSchluessel` zusätzlich als Benutzereinstellung. Kopf `position: sticky`, Zeilen virtualisiert (TanStack Virtual).
  * Test: `tests/smoke/tabellen.cjs`; Selektoren `.tb-zeile[data-r]`, `.tb-zelle[data-c]`, `.tb-editor`, `.vs-liste`,
    `.tb-filterzeile input[data-filter=<spalte>]`, `.tb-mk`.
* Ein Oberflächen-Modul (`src/module/<modul>/index.ts`) exportiert ein `StudioModul`:
  `{ id, ansichten, arbeitsplaetze, befehle, eintraege, start }`. Eigenes Steuerelement in der Kopfleiste:
  `kopfleistenElement({ id, komponente, ort: 'mitte' | 'rechts', modus })`. **Gleiche `id` ersetzt einen früheren Eintrag.**
  Damit ein Eintrag in der Seitenleiste erscheint, in `NAVIGATION` (`src/shell/navigation.ts`) einen Verweis
  `{ ref: '<id>', text }` ergänzen; die Befehlssuche findet jeden Eintrag und Untermenüpunkt ohnehin.
* **Online-Unterricht:** Unterricht hat „Findet online statt“ mit Link (Spalten Online/OnlineLink, Dialog „Online …“ in der
  Unterrichtsansicht); einzelne Stunden lassen sich in den Tagesplänen der Vertretungsplanung abweichend online bzw. in
  Präsenz schalten (Kontextmenü „Findet online statt …“, Kennzeichen an der Stunde, Ansicht „Online-Stunden“).
* **Tests:** `OberflaecheTests` (Modulregister, Seitenpfade, Startseite ohne externe Quellen, `tsc --noEmit`) und die
  Playwright-Tests in `tests/smoke` (`smoke.cjs` Rundgang über alle Seiten, `planung.cjs`, `vertretung.cjs`, `druck.cjs`,
  `smoke-austausch.cjs`, `tabellen.cjs`). Selektoren: `[data-ansicht="<typ>"]`, `[data-tabelle="<name>"] .tb-zeile`, `.ra-eintrag`,
  `[data-nav="<id>"]`; `window.studioTest.eintrag(id)` führt einen Befehlseintrag aus.

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
2. Oberfläche: Ordner `studio/client/src/module/<modul>/` mit `index.ts` (Ansichten `'<modul>.<ansicht>'` mit eigenem
   `pfad`, Befehle `'<modul>.<befehl>'`, Befehlseinträge; Verweis in `src/shell/navigation.ts`) und den Ansichten als
   `*.tsx` (lazy geladen), optional `<modul>.css` (Klassen mit Modulpräfix). Zwei Zeilen in `src/module/register.ts`
   (Import + Liste).
3. Tests: `studio/tests/UntPlanStudio.Tests/<Modul>Tests.cs` (`IClassFixture<StudioFabrik>`, Hilfen in `StudioFabrik.cs`).
   Modulregister, Seitenpfade und die Typprüfung der Oberfläche werden automatisch geprüft.
4. Benutzereinstellungen mit Präfix `<modul>.`; CSS-Klassen mit Präfix; keine Änderungen an Kern-Dateien nötig –
   fehlt im Kern etwas Allgemeines, klein und rückwärtskompatibel ergänzen.
