# Portierung der Oberfläche (Vanilla-JS → React + TypeScript + Fluent UI v9)

Stand der Portierung je Modul der bisherigen Oberfläche (`wwwroot/js/module/*`, `js/kern/*`). Die alte Oberfläche ist
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
