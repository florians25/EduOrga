# UntPlan für iOS

Native iOS-App (SwiftUI) zu **UntPlan Web**. Sie zeigt den Tag, den Plan, das Postfach und alle weiteren
Funktionen für Lehrkräfte, Schüler*innen und Erziehungsberechtigte und spricht direkt die JSON-API von UntPlan Web
unter `/api/app` an. Eine eigene Datenbank hat die App nicht; angemeldet wird mit dem Konto von UntPlan Web.

**Eine App für alle Schulen:** Die App enthält keine Schul- oder Server-Voreinstellung und kann neutral im App Store
veröffentlicht werden. Jede Schule betreibt ihre eigene UntPlan-Installation; beim ersten Start gibt man deren Adresse
ein (siehe [Einrichtung und Anmelden](#einrichtung-und-anmelden)). Mehrere Schulen und Konten lassen sich gleichzeitig
nutzen.

Gestaltung nach dem UntPlan-Designsystem (`design/DESIGN.md`, Farben aus `design/tokens.css`): Systemschrift,
Akzentfarbe Marine, Neutraltöne Schiefer, feste Statusfarben. SF Symbols nur in der Tab-Leiste und für Funktionen
(Aktionen, Pfeile, Status). Keine eigenen Bild-Assets außer App-Symbol und Akzentfarbe.

## Aufbau der Oberfläche

Tab-Leiste des Systems mit vier Reitern:

- **Heute** – gruppierte Liste: Datum und Schule, die (noch kommenden) Stunden des Tages (laufende Stunde mit Uhrzeit
  in Marine, „Tag im Plan öffnen“) bzw. ein Hinweis bei Abwesenheit, freiem Tag, Ferien oder gesperrtem Zeitraum,
  „Heute an der Schule“ (Nachrichten, Veranstaltungen, Hinweise) und eine Übersicht (Termine, Abwesenheiten,
  Entschuldigungen, Hausaufgaben, Sprechtage, Änderungen).
- **Plan** – startet mit dem **Tag als Liste**: oben die Wochentage (antippen springt zum Tag), darunter die Stunden
  mit Beginn und Ende links und der Kachel rechts, Freistunden als schmale Zeile „Frei“; waagrecht wischen wechselt
  zum nächsten bzw. vorherigen Schultag. Im Menü wahlweise das Raster nach Uhrzeit für 2 Tage, 3 Tage oder die Woche.
  Planname oben öffnet die Planauswahl (eigener Plan, Favoriten, Klassen, Lehrkräfte, Räume). Antippen einer Stunde
  öffnet die Stundendetails als Blatt mit Ziehgriff.
- **Postfach** – Posteingang, Gesendet und Entwürfe; lesen, antworten, löschen, neue Mitteilung mit Empfängerauswahl
  und Anhängen. Die Zahl ungelesener Mitteilungen steht als Plakette am Reiter.
- **Mehr** – Profil, Konten und Schulen (mehrere Konten auch verschiedener Schulen, Wechsel ohne Abmelden), Termine, Abwesenheiten, Entschuldigungen,
  Pausenaufsichten, Hausaufgaben, Änderungen, Sprechtage, Pläne von Klassen, Lehrkräften und Räumen, Einstellungen
  (Mitteilungen bei Planänderungen, Kontaktdaten und Kalender-Abo, Passwort), Neuigkeiten, Über und Abmelden.

## Plan-Darstellung

Umsetzung von `design/DESIGN.md`, Abschnitt 5 (`Ansichten/StundenKarteView.swift`, `Ansichten/StundenplanView.swift`,
Logik in `Dienste/Kachelbau.swift`). Tagesliste (`TagesagendaView`) und Raster (`WochenrasterView`) verwenden dieselben
Kacheln:

- Kacheln mit der Fachfarbe als Tönung (14 %, im Dunkelmodus 22 %), Radius 4 pt, Fachkürzel halbfett, Raum rechts,
  darunter Lehrkraft bzw. Klasse. Ohne Fachfarbe neutrale Fläche mit feinem Rand.
- **Entfall:** schräge Schraffur, Inhalt durchgestrichen, Plakette „Entfall“.
- **Änderung, Vertretung, Raumänderung:** 1,5-pt-Rahmen in Petrol, der geänderte Wert petrolfarben unterstrichen,
  der alte Wert durchgestrichen.
- **Prüfung:** helle Bernstein-Fläche mit Plakette „Prüfung“.
- **Veranstaltung, Termin, Raumbuchung:** helle Violett-Fläche mit gestricheltem Rahmen.
- **Ferien, Feiertage:** die ganze Tagesspalte hellblau mit Name und Zeitraum.
- **Stunde ohne die betrachtete Lehrkraft** (abgegeben) und Bereitschaft einer abwesenden Lehrkraft: ohne Fläche,
  gepunkteter Rahmen, kleine Plakette. **Bereitschaft:** gestrichelter neutraler Rahmen.
- **Pausenaufsichten** als schmale Kacheln in der Pause (Vertretung mit Petrol-Rahmen, abgegeben gepunktet, entfallen
  schraffiert). **Parallele Stunden** nebeneinander in Spuren; passt es nicht, ein Zählstreifen am rechten Rand.
- Tagesliste: Uhrzeit (Beginn halbfett, Ende als Hinweistext) statt Stundennummer, gleichzeitige Stunden untereinander,
  Freistunden gestrichelt mit „Frei“, eigene Abwesenheit als graue Zeile, ganztägige Termine oben.
- Raster: Zeitspalte mit Stundennummer, Beginn und Ende; Pausen als schmale graue Bänder; Jetzt-Linie in Marine mit Kreis am
  Rand der Zeitspalte; der heutige Tag mit Marine-Schrift, Linie unter dem Spaltenkopf und leichter Tönung.
- Zeichen unten rechts in der Kachel: Information bzw. Notiz, Hausaufgabe fällig, online.

## Öffnen in Xcode

1. `ios/UntPlanMobile.xcodeproj` in Xcode 15 oder neuer öffnen.
   Alternativ mit [XcodeGen](https://github.com/yonaskolb/XcodeGen) im Ordner `ios/` `xcodegen generate` ausführen.
2. Ziel **UntPlanMobile** wählen, unter *Signing & Capabilities* ein **Team** eintragen
   (bei Bedarf die Bundle-ID `de.untplan.mobile` anpassen).
3. Simulator oder Gerät mit iOS 17 oder neuer wählen und starten (⌘R).
4. Für die Mitteilungen bei Planänderungen: unter *Signing & Capabilities* die Fähigkeit **Background Modes** mit
   **Background fetch** prüfen bzw. hinzufügen. `UntPlanMobile/Info.plist` (per `INFOPLIST_FILE` mit der generierten
   Info.plist zusammengeführt) enthält bereits `UIBackgroundModes` (`fetch`) und `BGTaskSchedulerPermittedIdentifiers`
   (`de.untplan.mobile.planpruefung`). Testen im Debugger: App in den Hintergrund, pausieren und
   `e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"de.untplan.mobile.planpruefung"]`
   ausführen.

## Einrichtung und Anmelden

Beim ersten Start (noch kein Konto gespeichert) führt die App in zwei Schritten durch die Einrichtung
(`Ansichten/AnmeldungView.swift`):

1. **Schule** – nur die **Adresse der UntPlan-Installation** der Schule, z. B. `plan.meine-schule.de`
   (`https://` wird ergänzt; läuft UntPlan Web unter einem Unterpfad, diesen mit angeben). Die App ruft den
   öffentlichen Endpunkt `GET /api/app/sitzung` auf (`ApiClient.serverPruefen`, eigene flüchtige Verbindung) und prüft,
   ob dort wirklich UntPlan läuft (`eingerichtet` und `schule` in der Antwort). Bei Erfolg geht es mit dem Namen der
   Schule weiter. Verständliche Meldungen für: Adresse nicht gefunden, keine Internetverbindung, Zeitüberschreitung,
   nur unverschlüsselt (http) erreichbar, ungültiges Zertifikat, Serverfehler, „kein UntPlan unter dieser Adresse“ und
   „noch nicht eingerichtet“. Enthält die Eingabe einen Pfad (z. B. eine kopierte Adresse), wird zusätzlich die reine
   Domain geprüft.
2. **Anmeldung** – oben die Schule (Name und Adresse) mit „Ändern“, darunter **Benutzername**, **Passwort** und
   „Passwort merken“.

„Mehr“ → „Konten und Schulen“ → „Konto oder Schule hinzufügen“ läuft durch dieselben zwei Schritte; bereits bekannte
Schulen stehen dort zur Auswahl (weiteres Konto an derselben Schule). Ist eine Sitzung abgelaufen bzw. hat man sich
abgemeldet, beginnt die Anmeldemaske gleich mit Schritt 2 an der gespeicherten Schule.

**Einrichtungslink:** `untplan://einrichten?server=plan.meine-schule.de` (z. B. als QR-Code im Elternbrief) trägt die
Adresse ein und prüft sie sofort; ist die App bereits angemeldet, öffnet sich „Konto hinzufügen“. Das URL-Schema
`untplan` ist in `UntPlanMobile/Info.plist` (`CFBundleURLTypes`) eingetragen.

Die Server-Adresse wird in den Einstellungen der App gespeichert, das Passwort nur bei „Passwort merken“ im
Schlüsselbund des Geräts. Die Sitzung läuft über das Anmelde-Cookie von UntPlan Web; ist es abgelaufen, meldet sich
die App mit dem gemerkten Passwort selbst wieder an.

## Veröffentlichung im App Store

Die App ist schulneutral: keine fest eingetragene Adresse, kein Schulname, kein Schullogo. App-Name „UntPlan“,
Bundle-ID `de.untplan.mobile` (bei Bedarf anpassen). Für die App-Prüfung braucht Apple die Adresse einer
Demo-Installation mit Testkonto (in App Store Connect unter „Informationen zur App-Prüfung“ eintragen).

## Mitteilungen bei Planänderungen

Nur Lehrkräfte (`Dienste/Planmitteilungen.swift`): Beim Öffnen und im Hintergrund (BGAppRefreshTask, frühestens alle
30 Minuten) vergleicht die App den eigenen Plan der aktuellen und nächsten Woche mit dem zuletzt gesehenen Stand und
meldet Entfall, Vertretung, Raumänderung, neue Stunden und Prüfungen als lokale Mitteilung (ab vier Änderungen
gebündelt). Antippen öffnet den Tag im Plan. Schalter unter „Mehr“ → „Einstellungen“.

## App-Symbol

Das App-Symbol ist das Monogramm aus `design/logo/monogramm.svg` (weißes „U“ auf Marine-900, flächig; iOS rundet die
Ecken selbst). Neu erzeugen (hell, dunkel, getönt, je 1024 px) mit

```
cd ios
python3 Gestaltung/appicon_rendern.py UntPlanMobile/Assets.xcassets/AppIcon.appiconset /tmp/vorschau.png
```

(benötigt nur Pillow).

## Hinweise

- UntPlan Web muss per **HTTPS** erreichbar sein. iOS blockiert unverschlüsselte Verbindungen (App Transport
  Security); für Tests im eigenen Netz lässt sich in Xcode eine Ausnahme (`NSAppTransportSecurity`) ergänzen.
- Alle ändernden Aufrufe senden den Kopf `X-UntPlanWeb: 1`, den UntPlan Web als Schutz verlangt.

## Genutzte Endpunkte (Auswahl)

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/app/sitzung` (ohne Anmeldung) | Ersteinrichtung: prüft, ob UntPlan läuft, und liefert den Schulnamen |
| POST | `/api/app/anmelden` | Anmeldung `{login, passwort}`, setzt das Cookie |
| POST | `/api/app/abmelden` | Abmelden |
| GET | `/api/app/sitzung` | Schule, Benutzer, ungelesene Mitteilungen |
| GET | `/api/app/heute` | Seite „Heute“ (Stunden, Nachrichten, Termine …) |
| GET | `/api/app/plan?typ=&element=&datum=` | Wochenplan (Zeitraster, Tage, Karten) |
| GET | `/api/app/elemente` | Klassen, Lehrkräfte, Räume für die Planauswahl |
| GET | `/api/app/mitteilungen?ordner=` | Posteingang, `gesendet` bzw. `entwuerfe` |
| POST | `/api/app/mitteilungen/{id}/gelesen` | Als gelesen markieren |
| DELETE | `/api/app/mitteilungen/{id}` | Mitteilung löschen |
| GET | `/api/app/profil` | Profil und iCal-Adresse |

## Ordner

```
ios/
├── UntPlanMobile.xcodeproj
├── project.yml                  XcodeGen-Alternative
├── Gestaltung/appicon_rendern.py App-Symbol aus dem Monogramm
└── UntPlanMobile/
    ├── UntPlanMobileApp.swift   Einstieg
    ├── Modelle/                 Codable-Modelle der API, nachsichtige Dekodierung
    ├── Dienste/                 API-Client, Sitzungszustand, Kachelbau, Schlüsselbund, Datumsformate, Mitteilungen
    ├── Ansichten/               Heute, Plan, Stundendetails, Postfach, Mehr, Einrichtung/Anmeldung, Konten, Abwesenheiten,
    │                            Entschuldigungen, Sprechtag; Farben und gemeinsame Bausteine
    └── Assets.xcassets          App-Symbol, Akzentfarbe Marine (hell und dunkel)
```
