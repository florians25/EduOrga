# UntPlanWeb – Schnittstelle und Vorbereitung

UntPlanWeb ist das webbasierte Gegenstück zu UntPlan: Stunden- und Vertretungspläne im Browser und in Apps für
Schülerinnen und Schüler, Lehrkräfte und Eltern, dazu Krankmeldungen, Nachrichten und Raumbuchungen. UntPlanWeb wird
im Ordner `web/` entwickelt (Server `web/src/UntPlanWeb`, Tests `web/tests/UntPlanWeb.Tests`, Bedienung und Betrieb in
`web/README.md`). Dieses Dokument beschreibt die Schnittstelle zwischen UntPlan und UntPlanWeb und die Gestaltung der Weboberfläche.

## Architektur

```
UntPlan (Desktop, führend)  ──PUT  Paket untplanweb/1──▶  UntPlanWeb (Server + Weboberfläche)
                            ◀─GET  Rückmeldungen ───────   (Krankmeldungen, Nachrichten, Raumbuchungen)
                            ──POST Quittieren ─────────▶
```

* UntPlan bleibt die **führende Quelle**. UntPlanWeb speichert jeweils das zuletzt übertragene Paket (und darf ältere
  Revisionen ablehnen: HTTP 409).
* Rückmeldungen aus UntPlanWeb werden in UntPlan geprüft und übernommen (Krankmeldung → Lehrer-Absenz, Nachricht →
  Tagestext für das Kollegium) und anschließend quittiert.

## Gemeinsame Verträge: `src/UntPlan.Web.Contracts`

Die Klassenbibliothek **UntPlan.Web.Contracts** (net8.0, keine Abhängigkeiten) enthält alle Datenverträge. UntPlanWeb
bindet sie unverändert ein – als Git-Submodul/Projektverweis oder als NuGet-Paket (`dotnet pack src/UntPlan.Web.Contracts`).

| Typ | Inhalt |
|---|---|
| `WebPaket` | Schema, Revision, Schule, Zeitraster, Perioden (Unterricht + Regelstundenplan), Elemente, tagesaktuelle Pläne (`Tage`), Vertretungen, Absenzen, Termine (Veranstaltungen, Klausuren), Tagestexte, Ferien, Pausenaufsichten |
| `WebUnterricht` | Unterricht einer Periode; `online`/`onlineLink`: findet regelmäßig online statt (in UntPlan Studio festgelegt; ältere Pakete: `false`/leer) |
| `WebTag` / `WebStunde` | aufgelöster Plan je Datum: Fach, Klassen, Lehrer, Räume, Status `regulaer`, `vertreten`, `offen`, `entfall`, `zusaetzlich`, `frei`; `online`/`onlineLink` = „Findet online statt“ an diesem Datum (Unterricht bzw. Abweichung der Stunde; bei `nurAenderungen` stehen Stunden mit abweichendem Online-Stand als geänderte Stunden im Tag) |
| `WebVertretung` | Vertretungsplanzeile wie im Aushang (Art, (Lehrer), Vertreter, Fach, Raum, Vertr. von, (Le.) nach, Text, `nurLehrer`) |
| `WebRueckmeldung` | `absenz`, `nachricht`, `raumbuchung` |
| `WebAntwort` | `ok`, `revision`, `meldung` |

JSON: camelCase, Datum `yyyy-MM-dd`, Uhrzeit `HH:mm`, Nullwerte werden weggelassen (`UntPlanWebSchema.Json`).

## REST-Endpunkte (`UntPlanWebSchema.Pfade`)

Authentifizierung: `Authorization: Bearer <API-Schlüssel der Schule>`, nur über HTTPS.

| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `api/v1/status` | Name, Version, Schema |
| PUT | `api/v1/schulen/{schule}/untplanweb` | `WebPaket` übertragen → `WebAntwort` (409 bei veralteter Revision) |
| GET | `api/v1/schulen/{schule}/rueckmeldungen` | offene `WebRueckmeldung[]` |
| POST | `api/v1/schulen/{schule}/rueckmeldungen/quittieren` | `string[]` Ids → übernommen |
| GET | `api/v1/schulen/{schule}/fehlzeiten?ab=yyyy-MM-dd[&bis=…]` | `WebFehlzeit[]` (Import „Studenten*“ → Schülerabwesenheiten; Abgleich über Datum, Stunde, Schüler) |
| GET | `api/v1/schulen/{schule}/klassenbuch?ab=yyyy-MM-dd[&bis=…]` | `WebKlassenbucheintrag[]` (Import „Kurse“ → Klassenbuch; ohne interne Notizen) |

Ohne `bis` liefern beide Klassenbuch-Endpunkte ein Jahr ab `ab` (höchstens 400 Tage). Im abgefragten Zeitraum auf dem Server
gelöschte Einträge entfernt UntPlan beim Import.

**Rückmeldungen** (`WebRueckmeldung.typ`, Konstanten in `WebRueckmeldungsTypen`):

| Typ | Übernahme in UntPlan |
|---|---|
| `absenz` | Lehrer-Absenz (`lehrer`, `von`, `bis`, `stundeVon`, `stundeBis`, `grund`) |
| `nachricht` | Tagestext für das Kollegium |
| `raumbuchung` | Vertretungszeile der Art *Raumbuchung* je Stunde (`lehrer`, `von`, `stundeVon/Bis`, `raum` bzw. `raeume`, `klassen`, `titel`); abgelehnt, wenn der Raum belegt ist |
| `klausur` | Klausur (`titel`, `von`, `stundeVon/Bis`, `klassen`, `lehrer` + `weitereLehrer` als Aufsicht, `raeume`); der Unterricht der Klassen entfällt |

Unbekannte Kurznamen oder ein Tag ohne Unterricht führen zur Ablehnung; abgelehnte Rückmeldungen werden nicht quittiert.

**Teilpakete:** `WebPaket.teile` nennt die übertragenen Teile (`WebTeile`). Ist die Liste leer, ist das Paket vollständig.

| Teil | JSON-Felder |
|---|---|
| `stammdaten` | `schule`, `zeitraster`, `elemente`, `ferien` |
| `unterricht` | `perioden`, `pausenaufsichten` |
| `vertretungen` | `tage`, `vertretungen`, `absenzen`, `termine`, `tagestexte`, `von`, `bis` |

UntPlanWeb ersetzt nur die Felder der übertragenen Teile und behält die übrigen vom letzten Stand (`WebTeile.Felder`).
UntPlan sendet `stammdaten` immer mit, wenn Unterricht oder Vertretungen übertragen werden.

Der Referenzserver `src/UntPlan.Portal` implementiert diese Endpunkte (zusätzlich zum älteren Schema `untplan-sync/1`,
siehe `SYNC_API.md`) und dient UntPlanWeb als Vorlage und für Tests (`tests/UntPlan.Core.Tests/UntPlanWebTests.cs`).

## Datenschutz (DSGVO)

`WebExportOptionen` steuert, was übertragen wird:

* E-Mail-Adressen der Lehrkräfte nur mit Freigabe (`LehrerEmail`).
* Lehrer-Absenzen nur als Zeitraum (`LehrerAbsenzen`), Absenzgründe nur mit Freigabe (`Absenzgruende`);
  **als vertraulich markierte Gründe werden nie übertragen**.
* Tagestexte nur, wenn „Portal“ angehakt ist; Vertretungszeilen mit `nurLehrer` gehören nicht in die Schülerversion.
* Übertragen wird nur ein Zeitfenster (`TageZurueck` … `TageVoraus`) der tagesaktuellen Daten.

## In UntPlan

*Datei → UntPlanWeb*:

* **Datenaustausch:** Stammdaten, Unterricht und Vertretungen einzeln oder alles exportieren, Absenzen und Nachrichten importieren, optional ab einem Anfangsdatum; Übertragungsfehler werden im Dialog angezeigt.
* **Paket als Datei exportieren (JSON).**
* **Einstellungen:** Schul-ID, Server, Port, https, API-Schlüssel, Verbindung prüfen sowie die Exportoptionen.

## Weboberfläche

Die Weboberfläche (`web/src/UntPlanWeb/wwwroot`) kommt ohne Build-Schritt und ohne Laden aus dem Internet aus: Bootstrap 5.3,
ES-Module je Seite, Schrift IBM Plex Sans (SIL OFL), Linien-Symbole aus Lucide (ISC-Lizenz). Grundlage ist das Designsystem in
`design/DESIGN.md` mit den Grundwerten aus `design/tokens.css` (als `wwwroot/css/tokens.css` eingebunden).

* **Marke:** Zeichen „UP“ und Wortmarke „UntPlan“ als Text; Favicon und App-Symbole aus dem Monogramm (`img/logo.svg`,
  PNG-Dateien mit `design/logo/icons_rendern.cjs` erzeugt).
* **Seitenleiste:** hell, nur Text; Bereiche klappen an Ort und Stelle auf, der aktive Punkt ist hell marineblau hinterlegt.
  Auf Telefon und Tablet als Schublade über den Knopf *Menü*.
* **Stundenplan:** Werkzeugleiste über dem Raster, Zeitspalte mit Stundennummer und Uhrzeiten, heutiger Tag hervorgehoben,
  Jetzt-Linie; Kacheln in der Fachfarbe getönt, Status als Schraffur, Rahmen oder Schild; Stundendetails als Bereich rechts.
* **Klassenbuch-Seiten:** dichte Arbeitsansicht mit Filterzeile und Tabellen.
* **Übrige Seiten:** gemeinsame Bausteine (Knöpfe, Felder, Listen, Dialoge) in den Farben des Designsystems.
* **Monitor:** Vertretungsplan für Bildschirme im Schulhaus auf dunkler Marine-Fläche.

## Hinweise zur Weiterentwicklung

* ASP.NET Core (Minimal API) mit SQLite oder MariaDB/MySQL für Pakete, Benutzer und Rückmeldungen.
* Rollen: Schüler/Eltern (Klassenplan, Vertretungen der Klasse), Lehrkräfte (eigener Plan, Lehrerversion, Krankmeldung),
  Schulleitung/Admin (Freigaben, API-Schlüssel).
* Ansichten aus `WebPaket.Tage` erzeugen (bereits aufgelöst – keine Planlogik im Web nötig), Regelplan aus `Perioden`.
* Kompatibilität: neue Felder nur ergänzen; inkompatible Änderungen erhalten ein neues Schema (`untplanweb/2`).
