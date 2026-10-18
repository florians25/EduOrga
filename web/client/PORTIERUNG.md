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
