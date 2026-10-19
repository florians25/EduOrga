export const REPO = "https://github.com/florians25/UntPlanNext";
export const RELEASES = `${REPO}/releases`;
export const ISSUES = `${REPO}/issues`;
export const DISCUSSIONS = `${REPO}/discussions`;
export const COMMITS = `${REPO}/commits/master`;
export const DATEI = (pfad: string) => `${REPO}/blob/master/${pfad}`;

export const SLOGAN = "Einfach mehr Schulalltag.";

/** Rechtlicher Hinweis – Wortlaut aus design/MARKE.md (verbindlich). */
export const RECHTLICHER_HINWEIS =
  "EduOrga ist ein privates Hobbyprojekt eines Auszubildenden zum Fachinformatiker für Systemintegration, entwickelt mit Unterstützung von Claude (Anthropic). Jede Schule bzw. jeder Betreiber ist für Einsatz, Betrieb und Datenschutz selbst verantwortlich.";

export interface Bild {
  datei: string;
  titel: string;
  telefon?: boolean;
}

export interface Modul {
  kennung: string;
  /** Seite der Website, auf der das Modul ausführlich steht */
  pfad: string;
  /** kurze Einordnung über dem Namen */
  rolle: string;
  /** drei bis vier Kernpunkte für die Startseite */
  kernpunkte: string[];
  name: string;
  kurz: string;
  fuerWen: string;
  beschreibung: string;
  funktionen: { titel: string; text: string }[];
  bilder: Bild[];
  technik: [string, string][];
  readme: string;
}

export const MODUL_LISTE: Modul[] = [
  {
    kennung: "studio",
    pfad: "/studio",
    rolle: "Planung im Schulbüro",
    kernpunkte: ["Stunden-, Kurs- und Vertretungsplanung", "Automatische Planung mit Ergebnisvergleich", "Pausenaufsichten, Auswertungen, Druck", "Mehrere Planende gleichzeitig"],
    name: "EduOrga Studio",
    kurz: "Stunden-, Kurs- und Vertretungsplanung im Browser",
    fuerWen: "Schulleitung und Planungsteam",
    beschreibung:
      "Das Planungswerkzeug von EduOrga: Stammdaten, Unterricht, Zeitwünsche, automatische und manuelle Stundenplanung, Vertretungsplanung, Pausenaufsichten, Auswertungen, Druck und Datenaustausch – im Browser und mit mehreren Benutzern gleichzeitig. Alle Berechnungen laufen auf dem eigenen Server.",
    funktionen: [
      { titel: "Schuldaten", text: "Schuljahr, NRW-Schulformen, Zeitraster mit Vormittag, Nachmittag und Mittagspause, NRW-Ferien und -Feiertage, A/B-Wochen, Perioden." },
      { titel: "Stammdaten", text: "Klassen, Lehrkräfte, Räume, Fächer, Raumgruppen, Aufsichtsbereiche, Abteilungen, Schülerinnen und Schüler – mit Tabellenbearbeitung und Mehrfachänderung." },
      { titel: "Unterricht und Zeitwünsche", text: "Einfacher und gekoppelter Unterricht, Doppelstunden, Blöcke, Kursbänder, befristeter Unterricht; bestimmte und unbestimmte Zeitwünsche." },
      { titel: "Automatische Planung", text: "Gewichtung mit 26 Kriterien, mehrere Verfahren mit Ergebnisvergleich und Bewertungszahl, Tausch- und Raumoptimierung, Diagnose." },
      { titel: "Manuelles Planen", text: "Verplanen, Verschieben und Tauschen per Drag & Drop mit Zielanzeige, Fixieren, Tauschvorschläge und Raumzuordnung." },
      { titel: "Vertretungsplanung", text: "Abwesenheiten, offene Vertretungen, Vertretungsvorschlag mit Gewichtung, Bereitschaften, Verlegung, Betreuung, Klausuren und Tagestexte." },
      { titel: "Pausenaufsichten", text: "Aufsichtsbereiche je Pause und Tag, automatische Einteilung und Aufsichtsvertretungen." },
      { titel: "Auswertung und Ausgabe", text: "Soll/Ist, Unterrichtsmatrix, Vertretungsstatistik mit der NRW-Mehrarbeitsregel, Druck als PDF, HTML-Aushang, iCal und CSV." },
      { titel: "Oberstufe", text: "Kurswahlen, Kollisionsmatrix und automatische Bandbildung." },
      { titel: "Mehrbenutzerbetrieb", text: "Mehrere Planende gleichzeitig, Bereichssperren, Exklusivbetrieb, Gruppen und Rechte." },
      { titel: "Import und Export", text: "SchILD-NRW-CSV, BAL und GPU-Textdateien für die Datenübernahme beim Umstieg, Veröffentlichung nach EduOrga Web." },
    ],
    bilder: [
      { datei: "/bilder/studio/uebersicht.png", titel: "Übersicht mit Planqualität und häufigen Aufgaben" },
      { datei: "/bilder/studio/planen.png", titel: "Manuell planen: Unterricht und Klassenplan" },
      { datei: "/bilder/studio/vertretung.png", titel: "Tagesplanung der Vertretung" },
      { datei: "/bilder/studio/suche.png", titel: "Suche über alle Funktionen (Strg+K)" },
    ],
    technik: [
      ["Container", "untplannext-studio"],
      ["Standard-Port", "8190"],
      ["Daten", "eigene SQLite-Datenbank im Volume untplannext-studio-daten"],
      ["Oberfläche", "React, TypeScript, Fluent UI"],
    ],
    readme: DATEI("studio/README.md"),
  },
  {
    kennung: "web",
    pfad: "/web",
    rolle: "Portal für die Schulgemeinschaft",
    kernpunkte: ["Stunden- und Vertretungspläne", "Digitales Klassenbuch", "Mitteilungen und Monitore im Schulhaus", "Abwesenheiten melden, Räume buchen"],
    name: "EduOrga Web",
    kurz: "Portal für Lehrkräfte, Schülerinnen, Schüler und Eltern",
    fuerWen: "Kollegium, Schulleitung, Klassen und Eltern",
    beschreibung:
      "EduOrga Studio überträgt Stammdaten, Stundenpläne und Vertretungen an EduOrga Web. Lehrkräfte, Schulleitung und Klassen sehen dort ihre Pläne auf PC, Tablet und Telefon. Abwesenheiten, Raumbuchungen und Klausuren, die im Browser eingetragen werden, holt Studio beim nächsten Datenaustausch ab.",
    funktionen: [
      { titel: "Stundenpläne", text: "Wochen- und Tagesraster für Klassen, Lehrkräfte und Räume mit Zeitachse, Jetzt-Linie und klaren Statusfarben für Entfall, Vertretung, Prüfung und Termin." },
      { titel: "Heute und Übersicht", text: "Nachrichten zum Tag, Hinweis auf offene Stunden und „Mein nächster Unterricht“ auf einen Blick." },
      { titel: "Vertretungsplan", text: "Schüler- und Lehrerversion; die Schülerversion zeigt keine Abwesenheitsgründe, Bereitschaften oder Aufsichten." },
      { titel: "Monitore", text: "Vertretungsplan für Info-Bildschirme im Schulhaus über einen geheimen Link, mit Uhr und automatischem Bildlauf." },
      { titel: "Klassenbuch", text: "Lehrstoff, Abwesenheitskontrolle, Einträge, Hausaufgaben, Klassendienste und Prüfungen." },
      { titel: "Melden und Buchen", text: "Abwesenheit melden, freie Räume buchen und Prüfungen eintragen – die Meldungen gehen an Studio." },
      { titel: "Mitteilungen", text: "Nachrichten zwischen Kollegium, Schulleitung und Klassen an Gruppen, Klassen oder einzelne Benutzer." },
      { titel: "Administration", text: "Verbindung mit Studio, Benutzer, Rechte und Rollen, Darstellung der Stundenkarten, Update aus der Oberfläche." },
    ],
    bilder: [
      { datei: "/bilder/web/stundenplan.png", titel: "Klassenplan mit Änderungen und Entfall" },
      { datei: "/bilder/web/heute.png", titel: "Heute: Nachrichten und nächster Unterricht" },
      { datei: "/bilder/web/vertretungsplan.png", titel: "Vertretungsplan" },
      { datei: "/bilder/web/klassenbuch.png", titel: "Klassenbuch" },
      { datei: "/bilder/web/stundenplan-telefon.png", titel: "Stundenplan auf dem Telefon", telefon: true },
      { datei: "/bilder/web/heute-telefon.png", titel: "Heute auf dem Telefon", telefon: true },
    ],
    technik: [
      ["Container", "untplannext-web"],
      ["Standard-Port", "8180"],
      ["Daten", "SQLite im Volume untplannext-web-daten oder MariaDB"],
      ["Oberfläche", "React, TypeScript, MUI"],
    ],
    readme: DATEI("web/README.md"),
  },
  {
    kennung: "mobile",
    pfad: "/mobile",
    rolle: "Für unterwegs",
    kernpunkte: ["Installierbare App ohne App-Store", "Heute, Plan, Postfach, Klassenbuch", "Benachrichtigungen bei Planänderungen", "Offline verfügbar"],
    name: "EduOrga Mobile",
    kurz: "Installierbare App fürs Telefon (PWA)",
    fuerWen: "Lehrkräfte, Schülerinnen und Schüler unterwegs",
    beschreibung:
      "Stundenplan, Vertretungen, Klassenbuch und Mitteilungen von EduOrga Web auf dem Telefon – als installierbare App ohne App-Store. EduOrga Mobile hat keine eigene Datenbank: Die App holt alles von EduOrga Web; angemeldet wird mit dem Konto von EduOrga Web.",
    funktionen: [
      { titel: "Heute", text: "Datum, Hinweise des Tages, die nächsten Stunden des eigenen Plans, Termine, Prüfungen und eigene Abwesenheiten." },
      { titel: "Plan", text: "Eigener Plan oder Klasse, Lehrkraft, Raum; Woche, zwei oder drei Tage oder Tag; Stundendetails als Blatt von unten." },
      { titel: "Postfach", text: "Posteingang, Gesendet und Entwürfe – Lesen, Antworten, Schreiben und Suchen." },
      { titel: "Klassenbuch unterwegs", text: "Anwesenheit der Schülerinnen und Schüler, Lehrstoff und Raum ersetzen direkt aus der Stunde." },
      { titel: "Benachrichtigungen", text: "Web-Push bei Änderungen im eigenen Plan, auch auf iPhone und iPad ab iOS 16.4 (HTTPS vorausgesetzt)." },
      { titel: "Offline", text: "App, Schriften und die zuletzt geladenen Wochen bleiben auf dem Gerät verfügbar." },
      { titel: "Mehrere Profile", text: "Weitere Konten auf einem Gerät anmelden und ohne neue Anmeldung wechseln." },
      { titel: "Hell und dunkel", text: "Erscheinungsbild automatisch, hell oder dunkel." },
    ],
    bilder: [
      { datei: "/bilder/mobile/heute.png", titel: "Heute", telefon: true },
      { datei: "/bilder/mobile/plan-woche.png", titel: "Wochenplan", telefon: true },
      { datei: "/bilder/mobile/stundendetails.png", titel: "Stundendetails", telefon: true },
      { datei: "/bilder/mobile/postfach.png", titel: "Postfach", telefon: true },
    ],
    technik: [
      ["Container", "untplannext-mobile"],
      ["Standard-Port", "8181"],
      ["Daten", "Geräteprofile im Volume untplannext-mobile-daten, Plandaten von EduOrga Web"],
      ["Voraussetzung", "EduOrga Web; für die Installation als App HTTPS"],
    ],
    readme: DATEI("mobile/README.md"),
  },
  {
    kennung: "ios",
    pfad: "/mobile#ios",
    rolle: "iPhone und iPad",
    kernpunkte: ["Native App in SwiftUI", "Heute mit laufender Stunde", "Deutliche Kennzeichnung von Änderungen", "Liquid Glass ab iOS 26"],
    name: "EduOrga für iPhone und iPad",
    kurz: "Native App zu EduOrga Web (SwiftUI)",
    fuerWen: "Lehrkräfte, Schülerinnen und Schüler mit iPhone oder iPad",
    beschreibung:
      "Die native App zu EduOrga Web mit den Bereichen Heute, Plan, Postfach und Suche. Sie nutzt die Gestaltung des Systems (Liquid Glass ab iOS 26) für die Bedienebene und hält die Inhalte deckend und gut lesbar. Die App wird mit Xcode aus dem Repository gebaut.",
    funktionen: [
      { titel: "Heute", text: "Jetzt-Karte mit laufender Stunde, Restzeit und „Danach“, der Tag als Liste großer Kacheln und die Übersicht des Tages." },
      { titel: "Plan", text: "Für eine Hand gebaut: Wischen zum nächsten Schultag, schwebende Wochenleiste, Wochenübersicht mit Kennzahlen." },
      { titel: "Deutliche Änderungen", text: "Vertretung, Raumänderung, Entfall und Prüfung als gefüllte Plakette, Balken und Rahmen in der Statusfarbe." },
      { titel: "Postfach und Suche", text: "Mitteilungen lesen und schreiben; Klassen, Lehrkräfte und Räume finden." },
      { titel: "Mitteilungen bei Planänderungen", text: "Prüfung im Hintergrund, Hinweis auf Änderungen im eigenen Plan." },
      { titel: "Systemgerecht", text: "Dynamic Type, hell und dunkel, iOS 18 oder neuer; Liquid Glass ab iOS 26." },
    ],
    bilder: [],
    technik: [
      ["Voraussetzung", "Xcode 26, Zielsystem iOS 18 oder neuer"],
      ["Projekt", "ios/UntPlanNext.xcodeproj"],
      ["Daten", "von EduOrga Web, Zugangsdaten im Schlüsselbund"],
      ["Technik", "SwiftUI"],
    ],
    readme: DATEI("ios/README.md"),
  },
];

export const INSTALLATION = {
  voraussetzungen: [
    "Linux-Server mit Docker Engine und dem Compose-Plugin (docker compose version)",
    "für HTTPS: je Programm eine Domain (z. B. studio.meine-schule.de, plan.meine-schule.de, app.meine-schule.de), die auf den Server zeigt; Ports 80 und 443 erreichbar",
  ],
  installieren: `mkdir -p /opt/untplannext && cd /opt/untplannext
curl -fsSL -H "Accept: application/vnd.github.raw" -o install.sh "https://api.github.com/repos/florians25/UntPlanNext/contents/installation/install.sh?ref=master"
sh install.sh`,
  aktualisieren: `cd /opt/untplannext
./update.sh              # alles: Studio und Web sichern, neue Images laden, neu starten
./update.sh studio       # nur EduOrga Studio
./update.sh web mobile   # nur EduOrga Web und Mobile
./update.sh --nur-sichern`,
  automatisch: "30 3 * * * cd /opt/untplannext && ./update.sh >> update.log 2>&1",
  passwort: `cd /opt/untplannext
./passwort.sh studio              # Administrator von Studio
./passwort.sh web                 # Konto admin von EduOrga Web
./passwort.sh web chefin --anlegen              # fehlendes Konto als Administrator anlegen`,
  einstellungen: "docker compose up -d --remove-orphans",
  neu: "./install.sh --neu",
};

export const CONTAINER: [string, string, string][] = [
  ["untplannext-studio", "Stundenplanung im Browser (EduOrga Studio)", "8190"],
  ["untplannext-web", "Portal für Lehrkräfte, Schüler und Eltern (EduOrga Web)", "8180"],
  ["untplannext-mobile", "App fürs Telefon (EduOrga Mobile), nutzt EduOrga Web", "8181"],
  ["untplannext-mariadb", "optional, Datenbank für EduOrga Web", "–"],
  ["untplannext-caddy", "optional, HTTPS mit automatischem Zertifikat", "80 / 443"],
  ["untplannext-watchtower", "optional, Update aus der Administration von EduOrga Web", "–"],
];
