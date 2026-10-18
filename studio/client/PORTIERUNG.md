# Portierung der Oberfläche (Vanilla-JS → React + TypeScript + Fluent UI v9)

Stand der Portierung je Modul der bisherigen Oberfläche (`wwwroot/js/module/*`, `js/kern/*`): **alle Module portiert.** Die alte Oberfläche ist
im Git-Verlauf (Commit vor der Umstellung) nachlesbar.

| Bereich | Alt | Neu | Status |
|---|---|---|---|
| Kern: API, Zustand, Ereignisse, Dokument (SSE, Undo/Redo, Speichern) | `kern/api.js`, `zustand.js`, `ereignisse.js`, `dokument.js` | `src/api`, `src/kern` | fertig |
| Shell: Kopfleiste, Navigation, Befehlssuche, Anmeldung, Tastenkürzel | `kern/shell.js`, `navigation.js` | `src/shell` | fertig |
| Seiten, Nebenbereich, Arbeitsplätze, Adresse/Zurück | `kern/fenster.js` | `src/shell/seite.tsx`, `arbeitsplatz.tsx` | fertig |
| Dialoge, Menüs, Hinweise | `kern/dialog.js` | `src/komponenten/dialoge.tsx`, `menue.tsx`, `hinweise.tsx` | fertig |
| Tabelle (virtualisiert, Inline-Bearbeitung, Kopieren/Einfügen, Spalten) | `kern/tabelle.js`, `auswahl.js` | `src/komponenten/tabelle` (TanStack Table/Virtual) | fertig |
| Stundenplan-Raster mit Drag & Drop | `kern/raster.js` | `src/komponenten/raster` (dnd-kit) | fertig |
| datei (Schuldateien, Konto, Benutzer, BAL-Import) | `module/datei.js` | `src/module/datei` | fertig |
| start (Übersicht, Moduswechsel, gespeicherte Arbeitsplätze) | `module/start.js` | `src/module/start` | fertig |
| stammdaten | `module/stammdaten.js` | `src/module/stammdaten` | fertig |
| unterricht (+ „Findet online statt“) | `module/unterricht.js` | `src/module/unterricht` | fertig |
| stundenplan | `module/stundenplan.js` | `src/module/stundenplan` | fertig |
| planung (Verschieben, Verplanen, Raum, Tausch, Fixieren, Manuell planen) | `module/planung.js` | `src/module/planung` | fertig |
| vertretung (Kalender, Abwesenheiten, Vertretungen, Vorschlag, Automatik, Tagespläne mit Drag & Drop, Bereitschaften, Sondereinsätze, Vormerkungen, Einstellungen, Arbeitsplätze Tagesplanung / Verlegen und Tauschen / Kompakt) | `module/vertretung.js`, `module/vertretung/*` | `src/module/vertretung` | fertig |
| Online-Unterricht je Stunde (Tagespläne, Ansicht „Online-Stunden“) | – (neu) | `src/module/vertretung/online.tsx` | fertig |
| optimierung (Diagnose, Gewichtung, Automatische Planung mit Fortschritt, Ergebnisvergleich, Übernehmen) | `module/optimierung.js` | `src/module/optimierung` | fertig |
| zeitwuensche (malen, je Unterricht, unbestimmte Zeitwünsche) | `module/zeitwuensche.js` | `src/module/zeitwuensche` | fertig |
| abrechnung (Soll und Ist, Unterrichtsmatrix, Stundentafel, Vertretungsstatistik) | `module/abrechnung.js` | `src/module/abrechnung` | fertig |
| austausch (Import und Export: CSV, GPU, iCal, Aushang, Abteilungsdatei, Kurswahlen) | `module/austausch.js` | `src/module/austausch` | fertig |
| kommentare | `module/kommentare.js` | `src/module/kommentare` | fertig |
| kursplanung (Kurse und Bänder) | `module/kursplanung.js` | `src/module/kursplanung` | fertig |
| multiuser (aktive Benutzer in der Kopfleiste, Sperren, Exklusivbetrieb, Nachrichten, Gruppen und Rechte) | `module/multiuser.js` | `src/module/multiuser` | fertig |
| pausenaufsicht (Wochenplan, Vorschlag, automatische Einteilung, Gewichtung, Vertretung der Aufsichten) | `module/pausenaufsicht.js` | `src/module/pausenaufsicht` | fertig |
| untplanweb (Datenaustausch mit Fortschritt, Einstellungen, Stundenplanänderungen, Klausuren, übernommene Listen, Abgleich) | `module/untplanweb.js` | `src/module/untplanweb` | fertig |
| druck (Druckauswahl, Vorschau, Berichte, Vertretungsplan-Ausgabe mit Seitenlayout, Aushang, iCalendar) | `module/druck.js` | `src/module/druck` | fertig |
| einstellungen (Schuldaten, Zeitraster, Kalender und Ferien, Perioden, Unterrichtsgruppen) | `module/einstellungen.js` | `src/module/einstellungen` | fertig |
| formate (Planformate mit Feld-Editor) | `module/formate.js` | `src/module/formate` | fertig |
| uebersicht (Gesamtübersichten, virtualisiert, Drag & Drop mit dnd-kit) | `module/uebersicht.js` | `src/module/uebersicht` | fertig |
| veranstaltungen | `module/veranstaltungen.js` | `src/module/veranstaltungen` | fertig |

## Bauen, Ausliefern, Prüfen

| Punkt | Stand |
|---|---|
| Build nach `src/UntPlanStudio/wwwroot` (Vite), `wwwroot` nicht eingecheckt (`.gitignore`) | fertig |
| `UntPlanStudio.csproj`: Ziel `StudioOberflaecheBauen` (inkrementell, abschaltbar) | fertig |
| `Program.cs`: Zwischenspeicher (`/assets/*` unveränderlich, sonst `no-cache`), Startseite für alle Oberflächen-Adressen | fertig |
| Dockerfile: Node-22-Stufe baut die Oberfläche | fertig |
| `.github/workflows/studio.yml`: Oberfläche bauen (npm-Cache) vor Tests und Smoke-Test | fertig |
| `OberflaecheTests` (Register, Pfade, Startseite, `tsc --noEmit`) | fertig |
| Playwright-Tests `tests/smoke/*.cjs` auf die neue Oberfläche umgestellt (gemeinsame Hilfen in `hilfe.cjs`) | fertig |

## Offen / bewusst anders

* Die alte Oberfläche hatte frei angeordnete Fenster; die neue arbeitet mit Seiten, Nebenbereich und festen Arbeitsplätzen
  (wie in `design/DESIGN.md` vorgesehen). Gespeicherte Arbeitsplatz-Anordnungen der alten Oberfläche werden nicht übernommen.
* Doc-Kommentar in `src/UntPlanStudio/Api/Modulregister.cs` verweist noch auf `wwwroot/js/module` (Server-Code wurde bei der
  Umstellung bewusst nicht angefasst).
