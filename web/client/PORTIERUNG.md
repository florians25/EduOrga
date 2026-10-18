# Portierung der Weboberfläche nach React + TypeScript + MUI

Quelle der bisherigen Oberfläche: Git-Verlauf `web/src/UntPlanWeb/wwwroot/js` und `css` (Vanilla-JS, vor der Umstellung).
Neue Oberfläche: `web/client` (Vite, React 18, TypeScript strict, MUI v7), Build nach `web/src/UntPlanWeb/wwwroot`.

Legende: [x] portiert · [~] teilweise · [ ] offen

## Grundgerüst
- [x] API-Schicht (`src/api/client.ts`, `types.ts`), CSRF-Kopf, 401 → Anmeldung
- [x] Thema (Marine, Schiefer, Statusfarben, Pillen-Knöpfe, Karten Radius 12–14, Hell/Dunkel vorbereitet)
- [x] Anmeldung, Einrichtungsassistent, Passwortpflicht, öffentliche Hinweise, Wartungshinweis, SSO-Weiterleitung (`?weiter=/sso/…`)
- [x] Hülle: Seitenleiste je Rolle (einklappbar, Schublade mobil), Schuljahr-Auswahl, Konto (Profil, Konto wechseln, weiteres Konto, Abmelden), Infocenter
- [x] Hash-Router mit Rechteprüfung wie bisher (`#/plan/klasse/5a/2026-10-12`)
- [x] Monitor (`/monitor/<token>`)

## Seiten
Alle 38 Ansichten aus `js/ansichten` sind portiert (Verzeichnis: `src/pages/register.ts`; Test `WebOberflaecheTests.Alle_Menuepunkte_haben_eine_Seite`).

| alt (`js/ansichten`) | neu (`src/pages`) | Stand |
|---|---|---|
| heute.js | Heute.tsx | [x] |
| plan.js (+ plangitter.js, stundendetails.js) | plan/PlanSeite.tsx, components/plan/* | [x] Premium-Raster mit Zeitachse, Legende, Stundendetails |
| tag.js | TagSeite.tsx | [x] |
| vertretungen.js | Vertretungen.tsx | [x] |
| uebersicht.js | Uebersicht.tsx | [x] |
| mitteilungen.js | mitteilungen/Mitteilungen.tsx, markdown.tsx | [x] Postfach, Verfassen, Entwürfe, Empfänger, Lesebestätigungen, Listen, Einstellungen |
| unterricht.js | unterricht/Unterricht.tsx | [x] |
| unterrichtklassen.js | unterricht/UnterrichtKlassen.tsx | [x] Gruppen, Mitglieder, Klassenwechsel |
| schueler.js | unterricht/Schueler.tsx | [x] |
| pruefungen.js | unterricht/Pruefungen.tsx | [x] |
| pruefungskalender.js | unterricht/Pruefungskalender.tsx | [x] |
| offen.js | klassenbuch/Offen.tsx | [x] |
| klassenbuch.js | klassenbuch/Klassenbuch.tsx | [x] |
| eintraege.js | klassenbuch/Eintraege.tsx | [x] |
| hausaufgaben.js | klassenbuch/Hausaufgaben.tsx, KlassenkontoHausaufgaben.tsx | [x] |
| dienste.js | klassenbuch/Dienste.tsx | [x] |
| abwesenheiten.js | klassenbuch/Abwesenheiten.tsx | [x] |
| entschuldigungen.js | klassenbuch/Entschuldigen.tsx | [x] |
| befreiungen.js | klassenbuch/Befreiungen.tsx | [x] |
| berichte.js | klassenbuch/Berichte.tsx | [x] |
| sitzplan.js | klassenbuch/Sitzplan.tsx | [x] |
| kbeinstellungen.js | klassenbuch/KbEinstellungen.tsx | [x] |
| familie.js | familie/* | [x] |
| melden.js | melden/Melden.tsx | [x] |
| buchen.js, buchungsverwaltung.js | buchen/* | [x] Assistent, Meine Buchungen, Raum-/Ressourcenübersicht, Verwaltung |
| sprechtag.js | sprechtag/* | [x] |
| stammdaten.js | admin/Stammdaten.tsx | [x] |
| noten.js | admin/Noten.tsx | [x] Notenschemen, Prüfungsarten |
| admin.js, update.js | admin/Admin.tsx | [x] Übersicht & Sync, Update, Rückmeldungen, Nachrichten, Monitore, Protokoll, Freie Tage, Import/Export |
| benutzerverwaltung.js | admin/Benutzer.tsx | [x] Benutzer, Personen & Konten, Zugangsdaten |
| rechte.js | admin/Rechte.tsx | [x] Rollen-Matrix, Rechte einzelner Benutzer, Passwortregeln |
| import.js | admin/Import.tsx | [x] |
| wartung.js | admin/Wartung.tsx | [x] Aktive Sitzungen, Zugriff, Über |
| profil.js | konto/Profil.tsx | [x] |
| neuigkeiten.js | konto/Neuigkeiten.tsx | [x] |
| hinweise.js | konto/Hinweise.tsx | [x] |

## Bewusste Änderungen
- Online-Unterricht ist im Web **nur lesend**: Schild und Link „Online-Unterricht beitreten“ in Karten und Stundendetails, kein Umschalter (Umschalten in UntPlan Studio bzw. App).
- Uhrzeit- und Datumsfelder nutzen MUI `TimeField`/`DateTimePicker` (24 h, unabhängig von der Browsersprache) statt nativer Eingaben.
- Symbole: MUI-Material-Symbole statt Lucide-Maske (`css/symbole.css` entfällt).
- Die früheren Quelltext-Tests auf `wwwroot/js`/`css` wurden durch `WebOberflaecheTests` (Build-Ziel, Menü ↔ Seiten, Online nur lesend, Stundenplan-Zeitachse, keine Fremdnamen/kein Orange/keine fette Schrift) ersetzt.

## Build & Auslieferung
- [x] `npm run build` → `wwwroot/index.html`, `monitor.html`, `assets/` (nicht eingecheckt); feste Dateien (`fonts/`, `img/`, `manifest.webmanifest`, `neuigkeiten.json`) bleiben im Repository.
- [x] Fallback-Seite im Server, wenn die Oberfläche nicht gebaut ist.
- [x] `web/Dockerfile` (Node-Stufe baut die Oberfläche), `.github/workflows/web.yml` (npm ci + build vor `dotnet test`).
