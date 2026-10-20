export const REPO = "https://github.com/florians25/EduOrga";
export const RELEASES = `${REPO}/releases`;
export const ISSUES = `${REPO}/issues`;
export const DISCUSSIONS = `${REPO}/discussions`;
export const COMMITS = `${REPO}/commits/master`;
export const DATEI = (pfad: string) => `${REPO}/blob/master/${pfad}`;

/** Rückmeldung über GitHub: Auswahl der Vorlagen bzw. direkt die Formulare aus .github/ISSUE_TEMPLATE. */
export const ISSUE_NEU = `${ISSUES}/new/choose`;
export const ISSUE_FEHLER = `${ISSUES}/new?template=fehler.yml`;
export const ISSUE_WUNSCH = `${ISSUES}/new?template=wunsch.yml`;

export const SLOGAN = "Einfach mehr Schulalltag.";

/** Rechtlicher Hinweis – Wortlaut aus design/MARKE.md (verbindlich). */
export const RECHTLICHER_HINWEIS =
  "EduOrga ist ein privates Hobbyprojekt eines Auszubildenden zum Fachinformatiker für Systemintegration, entwickelt mit Unterstützung von Claude (Anthropic). Jede Schule bzw. jeder Betreiber ist für Einsatz, Betrieb und Datenschutz selbst verantwortlich.";

export interface Bild {
  datei: string;
  titel: string;
  telefon?: boolean;
  breite?: number;
  hoehe?: number;
}

// --- Stand der Plattformen ------------------------------------------------------------------------------------------

export type Plattformstand = "verfuegbar" | "unveroeffentlicht" | "arbeit";

export interface Plattform {
  name: string;
  art: string;
  stand: Plattformstand;
  standText: string;
  hinweis: string;
  pfad: string;
}

/** Ehrlicher Stand je Plattform – auf der Startseite und der Seite „Mobile und iOS“. */
export const PLATTFORMEN: Plattform[] = [
  {
    name: "EduOrga Studio",
    art: "Planung im Browser",
    stand: "verfuegbar",
    standText: "Verfügbar",
    hinweis: "Entwicklungsstand, Installation mit Docker",
    pfad: "/studio",
  },
  {
    name: "EduOrga Web",
    art: "Portal im Browser",
    stand: "verfuegbar",
    standText: "Verfügbar",
    hinweis: "Entwicklungsstand, Installation mit Docker",
    pfad: "/web",
  },
  {
    name: "EduOrga Mobile",
    art: "App fürs Telefon (PWA)",
    stand: "verfuegbar",
    standText: "Verfügbar",
    hinweis: "Entwicklungsstand, auf iPhone und Android über den Browser installierbar",
    pfad: "/mobile",
  },
  {
    name: "EduOrga für iPhone und iPad",
    art: "Native App (iOS 18 oder neuer)",
    stand: "unveroeffentlicht",
    standText: "Noch nicht im App Store veröffentlicht",
    hinweis: "Bauen mit Xcode aus dem Repository; bis dahin EduOrga Mobile",
    pfad: "/mobile#ios",
  },
  {
    name: "EduOrga für Android",
    art: "Native App",
    stand: "arbeit",
    standText: "In Arbeit",
    hinweis: "Bis dahin EduOrga Mobile im Browser des Telefons",
    pfad: "/mobile#android",
  },
];

// --- Anwendungen ----------------------------------------------------------------------------------------------------

export interface Modul {
  kennung: string;
  pfad: string;
  rolle: string;
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
    name: "EduOrga Studio",
    kurz: "Stunden-, Kurs- und Vertretungsplanung im Browser",
    fuerWen: "Schulleitung und Planungsteam",
    beschreibung:
      "Das Planungswerkzeug von EduOrga: Stammdaten, Unterricht, Zeitwünsche, automatische und manuelle Stundenplanung, Vertretungsplanung, Pausenaufsichten, Auswertungen, Druck und Datenaustausch – im Browser und mit mehreren Planenden gleichzeitig. Alle Berechnungen laufen auf dem eigenen Server, jede Änderung ist nach weniger als einer Sekunde gespeichert.",
    funktionen: [
      { titel: "Schuldaten", text: "Schuljahr, NRW-Schulformen, Zeitraster mit Vormittag, Nachmittag und Mittagspause, Ferien und Feiertage NRW per Knopf, eigene freie Tage im Jahreskalender, A/B-Wochen, Perioden." },
      { titel: "Stammdaten", text: "Klassen, Lehrkräfte, Räume, Fächer, Raumgruppen, Aufsichtsbereiche, Abteilungen, Schülerinnen und Schüler – als bearbeitbare Tabellen mit Mehrfachänderung und Umbenennen samt Verweisen." },
      { titel: "Unterricht und Zeitwünsche", text: "Einfacher und gekoppelter Unterricht, Doppelstunden, Blöcke, Kursbänder, A/B-Wochen, befristeter Unterricht; bestimmte und unbestimmte Zeitwünsche wie „ein freier Vormittag“." },
      { titel: "Automatische Planung", text: "Gewichtung mit 26 Kriterien, mehrere Verfahren mit Ergebnisvergleich und Bewertungszahl, Tausch- und Raumoptimierung, Diagnose der Eingabedaten und des Plans." },
      { titel: "Manuelles Planen", text: "Verplanen, Verschieben und Tauschen per Drag & Drop mit Zielanzeige, Fixieren, Tauschvorschläge, Raumzuordnung und Gesamtübersichten." },
      { titel: "Vertretungsplanung", text: "Tagesplanung als Übersicht Klassen × Stunden, Abwesenheiten, Vertretungsvorschlag mit Gewichtung, Bereitschaften, Entfall-Vorschlag ab EF, Verlegen und Tauschen, Klausuren, Tagestexte, automatische Vertretung ganzer Tage." },
      { titel: "Pausenaufsichten", text: "Aufsichtsbereiche je Pause und Tag, automatische Einteilung und Aufsichtsvertretungen." },
      { titel: "Auswertung", text: "Soll/Ist, Unterrichtsmatrix, Stundentafel, Vertretungsstatistik mit der NRW-Mehrarbeitsregel und Monatsabrechnung mit Unterschriftszeile." },
      { titel: "Druck und Ausgabe", text: "Stundenpläne, Vertretungsplan und Berichte als PDF im Schulformular-Layout, Aushang als HTML, Monitor-Ansicht, iCal und CSV." },
      { titel: "Oberstufe", text: "Kurswahlen, Kollisionsmatrix und automatische Bandbildung." },
      { titel: "Mehrbenutzerbetrieb", text: "Mehrere Planende gleichzeitig, Bereichssperren, Exklusivbetrieb, Gruppen und Rechte als Matrix." },
      { titel: "Datenübernahme", text: "SchILD-NRW-CSV (Lehrkräfte, Klassen, Schüler), BAL- und GPU-Textdateien für den Umstieg, Veröffentlichung nach EduOrga Web mit einem Klick oder automatisch." },
    ],
    bilder: [
      { datei: "/bilder/studio/vertretung.png", titel: "Tagesplanung der Vertretung mit Empfehlung und Miniplan" },
      { datei: "/bilder/studio/planen.png", titel: "Manuell planen: Unterricht und Klassenplan nebeneinander" },
      { datei: "/bilder/studio/uebersicht.png", titel: "Übersicht mit Planqualität und häufigen Aufgaben" },
      { datei: "/bilder/studio/suche.png", titel: "Befehlssuche über alle Funktionen (Strg+K)" },
      { datei: "/bilder/studio/rechte.png", titel: "Gruppen und Rechte als Matrix" },
      { datei: "/bilder/studio/dunkel.png", titel: "Dunkles Erscheinungsbild" },
    ],
    technik: [
      ["Container", "untplannext-studio"],
      ["Standard-Port", "8190"],
      ["Daten", "SQLite im Volume untplannext-studio-daten oder MariaDB"],
      ["Oberfläche", "React, TypeScript, Fluent UI"],
    ],
    readme: DATEI("studio/README.md"),
  },
  {
    kennung: "web",
    pfad: "/web",
    rolle: "Portal für die Schulgemeinschaft",
    name: "EduOrga Web",
    kurz: "Das Portal für Kollegium, Schülerinnen, Schüler und Eltern",
    fuerWen: "Kollegium, Schulleitung, Klassen und Eltern",
    beschreibung:
      "EduOrga Studio überträgt Stammdaten, Stundenpläne und Vertretungen an EduOrga Web. Lehrkräfte, Schulleitung, Schülerinnen, Schüler und Eltern sehen dort ihre Pläne auf PC, Tablet und Telefon. Abwesenheiten, Raumbuchungen und Prüfungen, die im Portal eingetragen werden, holt Studio beim nächsten Datenaustausch ab.",
    funktionen: [
      { titel: "Stundenpläne", text: "Wochen- und Tagesraster für Klassen, Lehrkräfte und Räume mit Jetzt-Linie und eindeutiger Kennzeichnung: Änderung, Entfall, offene Vertretung, Prüfung, Termin – nie nur über Farbe." },
      { titel: "Mein Tag und Start", text: "Nachrichten zum Tag, Hinweis auf offene Stunden und der nächste eigene Unterricht mit Klassenbuch, Lehrstoff und Hausaufgaben." },
      { titel: "Vertretungsplan", text: "Schüler- und Lehrerversion; die Schülerversion zeigt keine Abwesenheitsgründe, Bereitschaften oder Aufsichten. Als PDF und als großer Aushang." },
      { titel: "Klassenbuch", text: "Unterrichtsstunde mit Thema, Anwesenheit (Liste oder Sitzplan), Einträgen, Prüfungen und Verlauf – automatisch gespeichert. Dazu Fehlzeiten, Befreiungen, Klassendienste und Berichte als PDF und CSV." },
      { titel: "Elternsprechtag", text: "Lehrkräfte geben Zeiten frei und laden Familien ein, Eltern buchen, sagen ab oder stehen auf der Warteliste; Terminpläne als PDF." },
      { titel: "Kommunikation", text: "Mitteilungen mit Anhängen an Gruppen, Klassen oder einzelne Konten, Nachrichten zum Tag, Neuigkeiten der Schule." },
      { titel: "Melden und Buchen", text: "Abwesenheit melden, Räume und Geräte buchen, Prüfungen eintragen mit Prüfung auf Überschneidungen – die Meldungen gehen an Studio." },
      { titel: "Monitore", text: "Vertretungsplan für Bildschirme im Schulhaus über einen geheimen Link, mit Uhr und automatischem Bildlauf." },
      { titel: "Datenschutz in der Verwaltung", text: "Aufbewahrungsfristen mit Probelauf und Löschprotokoll, Auskunft nach Art. 15 als PDF, Sperren und Löschen, Datenschutzhinweise der Schule." },
      { titel: "Administration", text: "Verbindung mit Studio, Benutzer, Rollen und Rechte, Planfenster je Rolle, Darstellung der Stundenkarten mit Live-Vorschau, Update aus der Oberfläche." },
    ],
    bilder: [
      { datei: "/bilder/web/stundenplan.png", titel: "Klassenplan mit Änderungen, Entfall und Terminen" },
      { datei: "/bilder/web/klassenbuch.png", titel: "Klassenbuch: Wochenübersicht" },
      { datei: "/bilder/web/klassenbuch-anwesenheit.png", titel: "Unterrichtsstunde: Anwesenheit" },
      { datei: "/bilder/web/vertretungsplan.png", titel: "Vertretungsplan" },
      { datei: "/bilder/web/heute.png", titel: "Start: Nachrichten und nächster Unterricht" },
      { datei: "/bilder/web/monitor.png", titel: "Monitor im Schulhaus" },
      { datei: "/bilder/web/administration.png", titel: "Administration" },
      { datei: "/bilder/web/stundenplan-telefon.png", titel: "Stundenplan auf dem Telefon", telefon: true },
      { datei: "/bilder/web/heute-telefon.png", titel: "Start auf dem Telefon", telefon: true },
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
    name: "EduOrga Mobile",
    kurz: "Installierbare App fürs Telefon (PWA)",
    fuerWen: "Lehrkräfte, Schülerinnen, Schüler und Eltern",
    beschreibung:
      "Stundenplan, Vertretungen, Klassenbuch, Sprechtag und Mitteilungen von EduOrga Web auf dem Telefon – als installierbare App ohne App-Store, auf iPhone und Android. EduOrga Mobile hat keine eigene Datenbank: Die App holt alles von EduOrga Web, angemeldet wird mit dem vorhandenen Konto.",
    funktionen: [
      { titel: "Heute", text: "Datum, Hinweise des Tages, die nächsten Stunden, Termine und Prüfungen, eigene Abwesenheiten." },
      { titel: "Plan", text: "Woche über die ganze Breite oder Tag; Klasse, Lehrkraft oder Raum; Wischen wechselt die Woche, Aufziehen mit zwei Fingern zeigt den Tag." },
      { titel: "Klassenbuch in der Stunde", text: "Reiter „Klassenbuch“ in den Stundendetails: Thema, Anwesenheitskontrolle, „Alle anwesend“, Hausaufgaben, Einträge, Notizen und „Prüfung eintragen“." },
      { titel: "Elternsprechtag", text: "Für Lehrkräfte Zeiten sperren, Termine eintragen, Familien einladen; für Eltern buchen, absagen, Warteliste – mit Terminplan als PDF." },
      { titel: "Postfach", text: "Posteingang, Gesendet und Entwürfe – Lesen, Antworten, Schreiben und Suchen." },
      { titel: "Melden und Buchen", text: "Abwesenheit melden, Raum oder Gerät buchen, Prüfungen ansehen und eintragen – je nach Rolle und Recht." },
      { titel: "Benachrichtigungen", text: "Web-Push bei Änderungen im eigenen Plan, auch auf iPhone und iPad ab iOS 16.4 (HTTPS vorausgesetzt); standardmäßig ohne Einzelheiten." },
      { titel: "Offline und mehrere Profile", text: "App und die zuletzt geladenen Wochen bleiben auf dem Gerät; weitere Konten ohne neue Anmeldung wechseln. Hell und dunkel." },
    ],
    bilder: [
      { datei: "/bilder/mobile/plan-woche.png", titel: "Wochenplan", telefon: true },
      { datei: "/bilder/mobile/heute.png", titel: "Heute", telefon: true },
      { datei: "/bilder/mobile/stundendetails-klassenbuch.png", titel: "Stunde: Klassenbuch", telefon: true },
      { datei: "/bilder/mobile/sprechtag-eltern.png", titel: "Elternsprechtag (Eltern)", telefon: true },
      { datei: "/bilder/mobile/postfach.png", titel: "Postfach", telefon: true },
      { datei: "/bilder/mobile/vertretungsplan.png", titel: "Vertretungsplan", telefon: true },
      { datei: "/bilder/mobile/zeichenerklaerung.png", titel: "Kennzeichnungen", telefon: true },
      { datei: "/bilder/mobile/dunkel-plan-woche.png", titel: "Wochenplan dunkel", telefon: true },
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
    name: "EduOrga für iPhone und iPad",
    kurz: "Native App zu EduOrga Web (SwiftUI)",
    fuerWen: "Lehrkräfte, Schülerinnen, Schüler und Eltern mit iPhone oder iPad",
    beschreibung:
      "Eine App für alle Schulen: Nach dem Start wird die EduOrga-Adresse der eigenen Schule eingegeben oder ihr QR-Code gescannt, dann meldet man sich mit dem Konto der Schule an. Die App spricht nur mit dem Server der Schule. Sie ist noch nicht im App Store veröffentlicht und wird bis dahin mit Xcode aus dem Repository gebaut.",
    funktionen: [
      { titel: "Heute", text: "Fokuskarte „Jetzt · noch 23 Min.“ bzw. „Als Nächstes“, alle Stunden des Tages, Hinweise der Schule und für Lehrkräfte „Klassenbuch erfassen“." },
      { titel: "Plan", text: "Woche als Raster über die ganze Breite, Agenda und Tag; Mehrfachauswahl mehrerer Pläne nebeneinander, „Nur Änderungen“, Filter und Legende." },
      { titel: "Stundendetails", text: "Reiter Details und Klassenbuch: Änderungen als „neu (bisher)“, Thema mit Vorschlägen, Anwesenheitskontrolle, Hausaufgaben, Prüfung eintragen, Einträge, Verlauf." },
      { titel: "Ohne Netz weiterarbeiten", text: "Lehrstoff, Hausaufgaben, Einträge und Anwesenheit landen ohne Verbindung im Schreibpuffer und werden gesendet, sobald das Netz zurück ist." },
      { titel: "Schule", text: "Prüfungen eintragen, ändern und löschen, Vertretungsplan, Abwesenheit melden, Entschuldigungen und Elternsprechtag mit Erinnerungen." },
      { titel: "Systemgerecht", text: "Dynamic Type, VoiceOver mit ganzen Sätzen, Tippflächen ab 44 pt, hell und dunkel; Liquid Glass ab iOS 26, iOS 18 oder neuer." },
    ],
    bilder: [],
    technik: [
      ["Stand", "Noch nicht im App Store veröffentlicht"],
      ["Voraussetzung", "Xcode 26, Zielsystem iOS 18 oder neuer"],
      ["Projekt", "ios/UntPlanNext.xcodeproj"],
      ["Daten", "vom Server der Schule, Zugangsdaten im Schlüsselbund"],
    ],
    readme: DATEI("ios/README.md"),
  },
];

// --- Startseite -----------------------------------------------------------------------------------------------------

export const ZIELGRUPPEN: { titel: string; satz: string; punkte: string[] }[] = [
  {
    titel: "Schulleitung",
    satz: "Überblick und Verlässlichkeit, ohne selbst planen zu müssen.",
    punkte: [
      "Vertretungsplan und Nachrichten zum Tag für alle zur selben Zeit",
      "Mitteilungen an Kollegium, Klassen und Eltern",
      "Statistik mit NRW-Mehrarbeitsregel und Monatsabrechnung",
      "Daten auf dem Server der Schule, Vorlagen für den Datenschutz",
    ],
  },
  {
    titel: "Stundenplanung",
    satz: "Werkzeug für die, die morgens um sieben die Lücken schließen.",
    punkte: [
      "Automatische Planung mit 26 Kriterien und Ergebnisvergleich",
      "Tagesplanung mit Vertretungsvorschlag und Bereitschaften",
      "Verlegen und Tauschen per Drag & Drop",
      "Mehrere Planende gleichzeitig an einer Schuldatei",
    ],
  },
  {
    titel: "Lehrkräfte",
    satz: "Der eigene Tag auf dem Telefon, das Klassenbuch in der Stunde.",
    punkte: [
      "Eigener Plan mit jeder Änderung, Benachrichtigung bei Änderungen",
      "Thema, Anwesenheit und Hausaufgaben direkt aus der Stunde",
      "Prüfungen eintragen mit Prüfung auf Überschneidungen",
      "Elternsprechtag ohne Zettel und Listen",
    ],
  },
  {
    titel: "Schülerinnen, Schüler und Eltern",
    satz: "Wissen, was morgen ist – ohne Gruppenchat.",
    punkte: [
      "Stundenplan und Vertretungen der eigenen Klasse",
      "Hausaufgaben und Prüfungstermine",
      "Abwesenheit melden, Entschuldigung als PDF",
      "Sprechtagstermine buchen und absagen",
    ],
  },
];

/** Beispiel eines Morgens – jeder Schritt entspricht einer vorhandenen Funktion (Tagesplanung, Vorschlag, Übertragung, PWA). */
export const MORGEN: { zeit: string; titel: string; text: string }[] = [
  { zeit: "07:02", titel: "Krankmeldung", text: "Eine Lehrkraft fällt aus. In der Tagesplanung entstehen sofort die offenen Stunden." },
  { zeit: "07:06", titel: "Vertretung gewählt", text: "Der Vertretungsvorschlag nennt freie Lehrkräfte mit Begründung. Übernehmen mit Enter." },
  { zeit: "07:07", titel: "Veröffentlicht", text: "„An Web senden“ – oder die automatische Übertragung schickt die Änderung nach spätestens 30 Sekunden." },
  { zeit: "07:08", titel: "Auf jedem Gerät", text: "Klasse, Lehrkraft und Eltern sehen die Vertretung im Plan, auf Wunsch mit Benachrichtigung." },
];

export interface Vorteil {
  id: string;
  ueber: string;
  titel: string;
  text: string;
  punkte: string[];
  link: { zu: string; text: string };
}

export const VORTEILE: Record<"planung" | "aktuell" | "klassenbuch" | "kommunikation", Vorteil> = {
  planung: {
    id: "planung",
    ueber: "Stundenplan und Vertretung",
    titel: "Vom Ausfall zur fertigen Vertretung in Minuten.",
    text: "EduOrga Studio zeigt den Planungstag als Übersicht aller Klassen und Stunden. Offene Stunden stehen dort, wo sie entstehen – mit einer begründeten Empfehlung daneben.",
    punkte: [
      "Vertretungsvorschlag nach Fach- und Klassenkenntnis, Bereitschaft, Zählern und Zeitwünschen",
      "Automatische Vertretung ganzer Tage, Entfall-Vorschlag in Randstunden ab EF",
      "Stundenplan automatisch mit 26 Kriterien oder manuell per Drag & Drop",
      "Pausenaufsichten, Klausuren, Veranstaltungen und Tagestexte im selben Werkzeug",
    ],
    link: { zu: "/studio", text: "EduOrga Studio im Einzelnen" },
  },
  aktuell: {
    id: "aktuell",
    ueber: "Immer aktuell",
    titel: "Jede Änderung sofort auf allen Geräten.",
    text: "Was im Schulbüro entschieden wird, steht kurz darauf im Plan der Betroffenen – im Browser, in der App und auf dem Monitor im Eingang. Jede Ansicht nennt den Stand der letzten Übertragung.",
    punkte: [
      "Übertragung mit einem Klick oder automatisch, gesammelt nach spätestens 30 Sekunden",
      "Web und App laden beim Öffnen, beim Zurückkehren und alle zwei Minuten neu",
      "Benachrichtigung bei Änderungen im eigenen Plan",
      "„Stand EduOrga Studio: vor 5 Min.“ in jeder Planansicht",
    ],
    link: { zu: "/web", text: "EduOrga Web im Einzelnen" },
  },
  klassenbuch: {
    id: "klassenbuch",
    ueber: "Digitales Klassenbuch",
    titel: "Das Klassenbuch ist in der Stunde – nicht im Lehrerzimmer.",
    text: "Lehrkräfte tippen auf ihre Stunde und tragen ein, was sonst auf Papier steht. Alles wird automatisch gespeichert; offene Stunden erinnern an Fehlendes.",
    punkte: [
      "Lehrstoff mit Vorschlägen aus den Vorstunden",
      "Anwesenheitskontrolle mit „Alle anwesend“, Verspätung und Meldungen der Eltern",
      "Hausaufgaben mit Fälligkeit, Klassenbucheinträge, Notizen",
      "Klausuren und Prüfungen direkt aus der Stunde eintragen",
    ],
    link: { zu: "/mobile", text: "Klassenbuch auf dem Telefon" },
  },
  kommunikation: {
    id: "kommunikation",
    ueber: "Sprechtag und Mitteilungen",
    titel: "Elternsprechtag und Mitteilungen ohne Zettelwirtschaft.",
    text: "Lehrkräfte geben Zeiten frei, Familien buchen selbst. Mitteilungen erreichen Gruppen, Klassen oder einzelne Konten – mit Anhängen, im Browser und in der App.",
    punkte: [
      "Zeiten sperren und freigeben, Familien einladen, Warteliste",
      "Terminplan je Lehrkraft und Termine der Familie als PDF",
      "Postfach mit Posteingang, Gesendet und Entwürfen",
      "Nachrichten zum Tag auf Start, Vertretungsplan und Monitor",
    ],
    link: { zu: "/web", text: "Kommunikation in EduOrga Web" },
  },
};

export const GRUNDSAETZE: { titel: string; text: string; link?: { zu: string; text: string } }[] = [
  {
    titel: "Datenschutz nach DSGVO",
    text: "Die Schule bleibt Verantwortliche. Aufbewahrungsfristen mit Löschprotokoll, Auskunft nach Art. 15, Sperren nach Art. 18. Vorlagen für Verzeichnis, TOM und AV-Vertrag liegen bei.",
    link: { zu: DATEI("docs/datenschutz/README.md"), text: "Leitfaden Datenschutz" },
  },
  {
    titel: "Eigener Server, keine Cloud-Pflicht",
    text: "Alle Programme laufen als Docker-Container auf dem Server der Schule oder ihres Schulträgers. Keine Telemetrie, kein Tracking, keine Inhalte von fremden Servern.",
    link: { zu: "/installation", text: "Installation" },
  },
  {
    titel: "Offener Quellcode",
    text: "Der vollständige Quellcode liegt öffentlich auf GitHub. Jede Änderung ist nachvollziehbar, die Dokumentation entsteht mit dem Code.",
    link: { zu: REPO, text: "Quellcode auf GitHub" },
  },
  {
    titel: "Barrierefreiheit",
    text: "Kontraste nach WCAG 2.1 AA geprüft, sichtbarer Fokus, Bedienung per Tastatur. Status steht nie nur in Farbe, sondern auch als Wort, Durchstreichung oder Strichelung.",
  },
  {
    titel: "Druck und PDF",
    text: "Stundenpläne, Vertretungsplan, Abrechnung, Klassenbuch-Berichte, Entschuldigungen und Sprechtagspläne – als PDF im schlichten Schulformular-Layout für Schwarz-Weiß-Drucker.",
    link: { zu: DATEI("docs/HANDBUCH.md#10-ausgabe"), text: "Beispiele im Handbuch" },
  },
  {
    titel: "Umstieg ohne Abtippen",
    text: "Lehrkräfte, Klassen und Schüler aus SchILD-NRW (CSV), Stundenpläne aus BAL- und GPU-Textdateien. Das Protokoll zeigt, was angelegt wurde.",
  },
];

/** Funktionsübersicht: welche Anwendung was kann (nur vorhandene Funktionen, siehe READMEs). */
export const UEBERSICHT_SPALTEN = ["Studio", "Web", "Mobile", "iOS"] as const;
export const UEBERSICHT: { gruppe: string; zeilen: [string, boolean, boolean, boolean, boolean][] }[] = [
  {
    gruppe: "Planung",
    zeilen: [
      ["Stundenplan automatisch und manuell planen", true, false, false, false],
      ["Vertretungsplanung mit Vorschlag", true, false, false, false],
      ["Pausenaufsichten einteilen", true, false, false, false],
      ["Oberstufe: Kurswahlen und Bänder", true, false, false, false],
      ["Datenübernahme SchILD-NRW, BAL, GPU-Textdateien", true, false, false, false],
    ],
  },
  {
    gruppe: "Pläne",
    zeilen: [
      ["Pläne für Klassen, Lehrkräfte und Räume", true, true, true, true],
      ["Vertretungsplan", true, true, true, true],
      ["Benachrichtigung bei Planänderungen", false, false, true, true],
      ["Monitor im Schulhaus", true, true, false, false],
    ],
  },
  {
    gruppe: "Unterricht",
    zeilen: [
      ["Klassenbuch: Lehrstoff, Anwesenheit, Einträge", false, true, true, true],
      ["Hausaufgaben", false, true, true, true],
      ["Prüfungen und Klausuren eintragen", false, true, true, true],
      ["Raum oder Gerät buchen", false, true, true, false],
    ],
  },
  {
    gruppe: "Kommunikation",
    zeilen: [
      ["Mitteilungen und Postfach", false, true, true, true],
      ["Elternsprechtag", false, true, true, true],
      ["Abwesenheit melden", false, true, true, true],
    ],
  },
  {
    gruppe: "Betrieb",
    zeilen: [
      ["Druck und PDF", true, true, true, true],
      ["Hell und dunkel", true, true, true, true],
      ["Datenschutz: Fristen, Auskunft, Löschung", false, true, false, false],
      ["Benutzer, Gruppen und Rechte", true, true, false, false],
    ],
  },
];

export const SCHRITTE: { titel: string; text: string; befehl?: string; link: { zu: string; text: string } }[] = [
  {
    titel: "Installieren",
    text: "Ein Skript fragt ab, welche Programme laufen sollen, richtet auf Wunsch HTTPS ein, erzeugt Passwörter und startet die Container.",
    befehl: "sh install.sh",
    link: { zu: "/installation", text: "Anleitung Schritt für Schritt" },
  },
  {
    titel: "Daten übernehmen und planen",
    text: "Stammdaten aus SchILD-NRW oder vorhandenen Planungsdateien übernehmen, Unterricht prüfen, Stundenplan automatisch erstellen und von Hand verfeinern.",
    link: { zu: "/dokumentation#studio", text: "Planen mit EduOrga Studio" },
  },
  {
    titel: "Veröffentlichen",
    text: "Studio mit EduOrga Web verbinden und übertragen. Kollegium, Klassen und Eltern melden sich an – im Browser, mit EduOrga Mobile oder der App.",
    link: { zu: "/dokumentation#veroeffentlichen", text: "Veröffentlichen und verbinden" },
  },
];

export const FAQ: { frage: string; antwort: string }[] = [
  {
    frage: "Brauchen wir dafür eine Cloud oder ein Abo?",
    antwort:
      "Nein. EduOrga läuft auf einem eigenen Linux-Server mit Docker – bei der Schule, beim Schulträger oder bei einem Dienstleister Ihrer Wahl. Es gibt kein Abo und keinen Vertrieb; Kosten entstehen für Server, Domain und Betrieb.",
  },
  {
    frage: "Welcher Server reicht?",
    antwort:
      "Ein Linux-Server mit Docker Engine und dem Compose-Plugin. SQLite als Datenbank reicht für die meisten Schulen, für große Schulen oder vorhandene Sicherungskonzepte lässt sich MariaDB wählen. Für den Zugriff von außen und die Installation der App sind eine Domain und HTTPS nötig.",
  },
  {
    frage: "Können wir mit vorhandenen Daten umsteigen?",
    antwort:
      "Ja. EduOrga Studio übernimmt Lehrkräfte, Klassen sowie Schülerinnen und Schüler mit Kurswahlen aus SchILD-NRW (CSV) und Stundenpläne aus BAL- und GPU-Textdateien. Diese Formate dienen ausschließlich der Datenübernahme beim Umstieg.",
  },
  {
    frage: "Gibt es die App im App Store?",
    antwort:
      "Noch nicht. Die App für iPhone und iPad ist entwickelt, aber noch nicht im App Store veröffentlicht. Bis dahin lässt sich EduOrga Mobile auf jedem Telefon über den Browser als App installieren – mit Plan, Klassenbuch, Postfach und Benachrichtigungen.",
  },
  {
    frage: "Und Android?",
    antwort:
      "Eine eigene Android-App ist in Arbeit. EduOrga Mobile funktioniert schon heute auf Android-Telefonen und lässt sich dort wie eine App auf dem Startbildschirm ablegen.",
  },
  {
    frage: "Wie steht es um den Datenschutz?",
    antwort:
      "Alle Daten bleiben auf dem Server der Schule. EduOrga Web bringt Aufbewahrungsfristen, Löschprotokoll, Auskunft und Datenschutzhinweise mit; im Repository liegen ein Leitfaden für Schulen in NRW und Vorlagen für Verzeichnis, TOM und AV-Vertrag. Die Prüfung im Einzelfall bleibt Aufgabe der Schule.",
  },
  {
    frage: "Ist EduOrga nur für Nordrhein-Westfalen?",
    antwort:
      "NRW ist voreingestellt: Schulformen, Ferien und Feiertage per Knopf, SchILD-NRW-Import und die NRW-Mehrarbeitsregel. Ferien und freie Tage anderer Länder lassen sich im Jahreskalender selbst eintragen.",
  },
  {
    frage: "Ist EduOrga schon fertig?",
    antwort:
      "EduOrga ist im Entwicklungsstand und wird laufend erweitert. Studio, Web und Mobile sind installierbar; vor dem Einsatz mit echten Daten sollten Schulen Funktion, Sicherung und Datenschutz im Probebetrieb prüfen. Den aktuellen Stand zeigt die Liste der Änderungen auf GitHub.",
  },
  {
    frage: "Wer steht hinter EduOrga?",
    antwort: RECHTLICHER_HINWEIS,
  },
  {
    frage: "Wie melden wir Fehler oder Wünsche?",
    antwort:
      "Direkt auf GitHub über die Formulare „Fehler melden“ und „Idee oder Wunsch“. Bitte keine personenbezogenen Daten von Schülerinnen, Schülern oder Lehrkräften einstellen.",
  },
];

// --- Installation ---------------------------------------------------------------------------------------------------

export const INSTALLATION = {
  laden: `mkdir -p /opt/untplannext && cd /opt/untplannext
curl -fsSL -H "Accept: application/vnd.github.raw" -o install.sh "https://api.github.com/repos/florians25/EduOrga/contents/installation/install.sh?ref=master"
sh install.sh`,
  pruefen: `docker --version
docker compose version
docker info`,
  aktualisieren: `cd /opt/untplannext
./update.sh              # alles: Studio und Web sichern, neue Images laden, neu starten
./update.sh studio       # nur EduOrga Studio
./update.sh web mobile   # nur EduOrga Web und Mobile
./update.sh --nur-sichern`,
  automatisch: "30 3 * * * cd /opt/untplannext && ./update.sh >> update.log 2>&1",
  angefordert: "* * * * * cd /opt/untplannext && ./update.sh --wenn-angefordert >> update.log 2>&1",
  passwort: `cd /opt/untplannext
./passwort.sh studio              # Administrator von Studio (STUDIO_ADMIN_BENUTZER aus .env, sonst admin)
./passwort.sh studio planer1      # beliebiger Studio-Benutzer
./passwort.sh web                 # Konto admin von EduOrga Web
./passwort.sh web mueller --aenderungspflicht   # bei der nächsten Anmeldung neues Passwort wählen
./passwort.sh web chefin --anlegen              # fehlendes Konto als Administrator anlegen`,
  einstellungen: `cd /opt/untplannext
nano .env    # bzw. vi .env – z. B. COMPOSE_PROFILES, Ports, UNTPLAN_VERSION
docker compose up -d --remove-orphans`,
  neu: "./install.sh --neu",
  status: `cd /opt/untplannext
docker compose ps
docker compose logs --tail 100 untplannext-web`,
  sicherungenAnsehen: `docker compose exec untplannext-studio ls /data/sicherungen
docker compose exec untplannext-web ls /data/sicherungen
ls -l sicherungen/                 # MariaDB-Abzüge und verschlüsselte Kopien`,
  wiederherstellenStudio: `docker compose exec untplannext-studio ls /data/sicherungen
docker compose stop untplannext-studio
# alte WAL-/SHM-Dateien mit entfernen, sonst würden sie auf die zurückgespielte Datenbank angewendet
docker compose run --rm --entrypoint sh untplannext-studio -c 'rm -f /data/studio.db-wal /data/studio.db-shm && cp /data/sicherungen/<datei> /data/studio.db'
docker compose start untplannext-studio`,
  wiederherstellenMariadb: `# EduOrga Web mit MariaDB
gunzip -c sicherungen/untplannext-web-<zeit>.sql.gz | docker compose exec -T untplannext-mariadb \\
  sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE"'

# EduOrga Studio mit MariaDB (Studio dafür kurz anhalten)
docker compose stop untplannext-studio
gunzip -c sicherungen/untplannext-studio-<zeit>.sql.gz | docker compose exec -T untplannext-mariadb \\
  sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" eduorga_studio'
docker compose start untplannext-studio`,
  verschluesseln: `# auf einem anderen Rechner (nicht auf dem Server):
age-keygen -o schluessel.txt
# nur den öffentlichen Schlüssel in .env auf dem Server eintragen:
SICHERUNG_AGE_EMPFAENGER=age1…
# wiederherstellen:
age -d -i schluessel.txt datei.sql.gz.age | gunzip | …`,
  nginx: `# Beispiel für einen vorhandenen nginx (EduOrga ohne eigenes HTTPS eingerichtet,
# in .env BIND_ADRESSE=127.0.0.1, dann docker compose up -d)
server {
    listen 443 ssl;
    server_name studio.meine-schule.de;
    # ssl_certificate … / ssl_certificate_key … wie bei den übrigen Seiten des Servers
    client_max_body_size 64m;          # Hochladen von Schuldateien
    location / {
        proxy_pass http://127.0.0.1:8190;
        proxy_buffering off;           # Live-Aktualisierung in Studio
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
server {
    listen 443 ssl;
    server_name plan.meine-schule.de;
    location / {
        proxy_pass http://127.0.0.1:8180;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
# app.meine-schule.de entsprechend auf http://127.0.0.1:8181`,
  caddy: `# Von install.sh erzeugt (Auszug), wenn HTTPS gewählt wurde
studio.meine-schule.de {
	encode zstd gzip
	reverse_proxy untplannext-studio:8080 {
		flush_interval -1
	}
	request_body {
		max_size 64MB
	}
	header Strict-Transport-Security "max-age=31536000"
}

plan.meine-schule.de {
	encode zstd gzip
	reverse_proxy untplannext-web:8080
	header Strict-Transport-Security "max-age=31536000"
}`,
  deinstallieren: `docker compose down      # Container anhalten und entfernen, Daten bleiben in den Volumes
docker compose down -v   # zusätzlich ALLE Daten löschen`,
};

export const CONTAINER: [string, string, string, string][] = [
  ["untplannext-studio", "Stundenplanung im Browser (EduOrga Studio)", "8190", "SQLite im Volume untplannext-studio-daten oder MariaDB (eduorga_studio)"],
  ["untplannext-web", "Portal für Lehrkräfte, Schüler und Eltern (EduOrga Web)", "8180", "SQLite im Volume untplannext-web-daten oder MariaDB (untplanweb)"],
  ["untplannext-mobile", "App fürs Telefon (EduOrga Mobile), nutzt EduOrga Web", "8181", "Geräteprofile im Volume untplannext-mobile-daten"],
  ["untplannext-mariadb", "optional, Datenbanken für Web und/oder Studio", "–", "Volume untplannext-mariadb-daten"],
  ["untplannext-caddy", "optional, HTTPS mit automatischem Zertifikat", "80 / 443", "Volumes untplannext-caddy-daten, -config"],
  ["untplannext-watchtower", "optional, Update aus der Administration von EduOrga Web", "–", "–"],
];

/** Fragen von install.sh in der Reihenfolge des Skripts (installation/install.sh). */
export const FRAGEN: [string, string][] = [
  ["EduOrga Studio installieren?", "j (Vorschlag)"],
  ["EduOrga Web installieren?", "j"],
  ["EduOrga Mobile installieren?", "j – nur, wenn Web gewählt ist"],
  ["Datenbank für EduOrga Web", "sqlite oder mariadb"],
  ["Datenbank für EduOrga Studio", "sqlite oder mariadb (derselbe MariaDB-Container, Datenbank eduorga_studio)"],
  ["HTTPS mit automatischem Zertifikat einrichten?", "j: je Programm eine Domain und eine E-Mail für Hinweise zum Zertifikat"],
  ["Updates aus der Administration von EduOrga Web erlauben (Watchtower)?", "n (Vorschlag)"],
  ["Zeitzone", "Europe/Berlin"],
  ["Ports selbst festlegen?", "n: Studio 8190, Web 8180, Mobile 8181, bei HTTPS 80 und 443; belegte Ports fragt das Skript neu ab"],
  ["Benutzername des Administrators von Studio", "admin"],
  ["Passwörter der Administratoren", "verdeckt, mindestens 8 Zeichen; leer = zufällig erzeugt"],
];

export const FEHLERBEHEBUNG: { problem: string; loesung: string; befehl?: string }[] = [
  {
    problem: "„Docker ist nicht installiert“ bzw. „Docker Compose (Plugin „docker compose“) fehlt“",
    loesung: "Docker Engine mit dem Compose-Plugin nach der Anleitung des Docker-Projekts für die Distribution installieren und install.sh erneut aufrufen.",
  },
  {
    problem: "„Kein Zugriff auf Docker“",
    loesung: "install.sh als root oder als Mitglied der Gruppe „docker“ ausführen.",
  },
  {
    problem: "„pull access denied“ oder „Images konnten nicht geladen werden“",
    loesung: "Die Images liegen auf ghcr.io. Sind die Pakete nicht öffentlich, auf dem Server mit einem Token (Recht read:packages) anmelden und das Skript erneut aufrufen – die Einstellungen bleiben erhalten.",
    befehl: "docker login ghcr.io -u <GitHub-Benutzer>\n./install.sh",
  },
  {
    problem: "„docker-compose.yml ist nicht die aktuelle Fassung“",
    loesung: "GitHub lieferte eine zwischengespeicherte Datei. Die Datei entfernen und install.sh nach ein paar Minuten erneut aufrufen.",
    befehl: "rm docker-compose.yml\nsh install.sh",
  },
  {
    problem: "Port bereits belegt",
    loesung: "install.sh erkennt belegte Ports und fragt neu (Vorschlag: Port + 1000). Später lassen sich STUDIO_PORT, WEB_PORT, MOBILE_PORT, HTTP_PORT und HTTPS_PORT in .env ändern, danach docker compose up -d.",
  },
  {
    problem: "Kein Zertifikat für HTTPS",
    loesung: "Die Domains müssen auf den Server zeigen und die Ports 80 und 443 aus dem Internet erreichbar sein – andere Ports nur mit Weiterleitung im Router. Protokoll von Caddy ansehen.",
    befehl: "docker compose logs --tail 100 untplannext-caddy",
  },
  {
    problem: "„WARNUNG: Das Passwort … konnte nicht gesetzt werden“ oder Anmeldung schlägt fehl",
    loesung: "Die Passwörter in .env gelten nur beim allerersten Start. Passwort auf dem Server neu setzen; bei EduOrga Web hebt das auch eine Sperre nach Fehlversuchen auf.",
    befehl: "./passwort.sh studio\n./passwort.sh web",
  },
  {
    problem: "EduOrga Mobile lässt sich nicht als App installieren",
    loesung: "Die Installation als App und Benachrichtigungen setzen HTTPS voraus. Ohne HTTPS läuft Mobile nur im Browser.",
  },
  {
    problem: "Studio überträgt nicht an EduOrga Web",
    loesung: "In Studio unter EduOrga Web → Einstellungen Server untplannext-web, Port 8080, ohne HTTPS eintragen, dazu Schul-ID und API-Schlüssel aus EduOrga Web (Verwaltung → System & Datenabgleich). „Verbindung prüfen“ nennt den Fehler.",
  },
  {
    problem: "Update bricht mit „Sicherung … fehlgeschlagen“ ab",
    loesung: "Das ist Absicht: Ohne Sicherung wird nicht aktualisiert. Läuft der Container? Ist bei verschlüsselten Sicherungen „age“ bzw. „gpg“ installiert? Protokoll prüfen und erneut aufrufen.",
    befehl: "docker compose ps\ndocker compose logs --tail 100 untplannext-studio",
  },
];
