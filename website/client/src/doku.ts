import { DATEI } from "./inhalt";

/**
 * Dokumentation auf der Website (/dokumentation): Kapitel je Anwendung. Die Texte fassen die Beschreibungen im
 * Repository zusammen (docs/HANDBUCH.md, studio|web|mobile|ios/README.md, docs/datenschutz/) und verlinken sie.
 */
export type Block =
  | { art: "text"; text: string }
  | { art: "liste"; punkte: string[] }
  | { art: "schritte"; punkte: string[] }
  | { art: "tabelle"; kopf: string[]; zeilen: string[][] }
  | { art: "hinweis"; titel: string; text: string };

export interface Abschnitt {
  id: string;
  titel: string;
  bloecke: Block[];
}

export interface Kapitel {
  id: string;
  titel: string;
  kurz: string;
  einleitung: string;
  abschnitte: Abschnitt[];
  quellen: { titel: string; zu: string }[];
}

export const KAPITEL: Kapitel[] = [
  {
    id: "ueberblick",
    titel: "Überblick",
    kurz: "Wie Studio, Web und die Apps zusammenarbeiten",
    einleitung:
      "EduOrga besteht aus vier Oberflächen. Geplant wird in EduOrga Studio; EduOrga Web stellt die Ergebnisse der Schulgemeinschaft bereit; EduOrga Mobile und die App für iPhone und iPad holen alles von EduOrga Web.",
    abschnitte: [
      {
        id: "zusammenspiel",
        titel: "Zusammenspiel",
        bloecke: [
          {
            art: "tabelle",
            kopf: ["Anwendung", "Aufgabe", "Daten"],
            zeilen: [
              ["EduOrga Studio", "Stunden-, Kurs- und Vertretungsplanung im Schulbüro", "eigene Datenbank (SQLite oder MariaDB)"],
              ["EduOrga Web", "Portal: Pläne, Klassenbuch, Kommunikation, Sprechtag, Verwaltung", "eigene Datenbank (SQLite oder MariaDB)"],
              ["EduOrga Mobile", "installierbare App fürs Telefon (PWA)", "keine eigene Datenbank, alles von EduOrga Web"],
              ["EduOrga für iPhone und iPad", "native App (noch nicht im App Store)", "vom Server der Schule, Zugangsdaten im Schlüsselbund"],
            ],
          },
          {
            art: "schritte",
            punkte: [
              "Studio überträgt Stammdaten, Stundenpläne, Vertretungen, Termine und Nachrichten zum Tag an EduOrga Web – mit einem Klick oder automatisch.",
              "Web und Apps zeigen die Daten je nach Rolle: Lehrerversion für das Kollegium, Schülerversion ohne Abwesenheitsgründe für Klassen und Eltern.",
              "Abwesenheitsmeldungen, Raumbuchungen, Klausuren und Fehlzeiten aus dem Klassenbuch holt Studio beim nächsten Datenaustausch zurück.",
            ],
          },
          {
            art: "text",
            text: "Studio kann ohne Web betrieben, gesichert und aktualisiert werden und umgekehrt. Jedes Programm läuft als eigener Docker-Container.",
          },
        ],
      },
    ],
    quellen: [{ titel: "README im Repository", zu: DATEI("README.md") }],
  },
  {
    id: "studio",
    titel: "EduOrga Studio",
    kurz: "Stammdaten, Stundenplan, Vertretung, Veröffentlichen",
    einleitung:
      "Studio folgt dem Ablauf einer Stundenplanerstellung: Schuldaten → Stammdaten → Unterricht → automatische Planung → manuelles Planen → Stundenpläne → Vertretungsplanung → Ausgabe → Datenaustausch. Jede Funktion ist außerdem über die Befehlssuche (Strg+K) erreichbar. Gespeichert wird nach jeder Änderung automatisch; Strg+S legt einen Sicherungspunkt an.",
    abschnitte: [
      {
        id: "studio-start",
        titel: "Erste Schritte",
        bloecke: [
          {
            art: "schritte",
            punkte: [
              "Adresse des Studio-Servers im Browser öffnen und mit dem Administrator anmelden (Benutzer und Passwort zeigt install.sh am Ende an).",
              "Über das Menü der Schuldatei in der Kopfleiste „Neue Schuldatei …“ wählen: leere Schuldatei mit Schulname und Schulform (Fächer und Zeitraster nach NRW-Vorgaben werden angelegt) oder die Beispielschule zum Ausprobieren.",
              "Schule → Schuldaten: Schuljahr, Schulnummer, Wochenperiodizität (A/B-Wochen) und Einstellungen der Vertretungsplanung.",
              "Schule → Kalender und Ferien: „Ferien und Feiertage NRW eintragen“ oder freie Tage im Jahreskalender markieren.",
              "Schule → Zeitraster: Beginn und Ende jeder Stunde, Vormittag, Nachmittag, Mittagspause und Pausen mit Aufsicht.",
            ],
          },
          { art: "text", text: "Studio arbeitet in zwei Modi – Stundenplanung und Vertretungsplanung –, umgeschaltet in der Kopfleiste oder mit Strg+Umschalt+V." },
        ],
      },
      {
        id: "stammdaten",
        titel: "Stammdaten",
        bloecke: [
          {
            art: "text",
            text: "Stammdaten → Klassen, Lehrkräfte, Räume, Fächer, Schülerinnen und Schüler; unter „weitere“ Raumgruppen, Aufsichtsbereiche, Abteilungen, Abwesenheitsgründe und Kommentare. Jede Liste ist eine bearbeitbare Tabelle.",
          },
          {
            art: "liste",
            punkte: [
              "Neues Element: Kurzname in die letzte Zeile „Neu: …“ schreiben oder „Neu“ wählen.",
              "Mehrfachänderung: Zeilen markieren und gemeinsam ändern; Umbenennen passt alle Verweise an.",
              "Farben: Farbfeld je Fach, Klasse oder Lehrkraft, Zufallsfarben für alle ohne Farbe.",
              "Zeitwünsche: bestimmte (−3 … +3, Kernzeit) und unbestimmte, z. B. „ein freier Vormittag“.",
              "Datenübernahme: Datenaustausch → Import und Export – Lehrkräfte und Klassen aus SchILD-NRW (CSV), Schülerinnen und Schüler mit Kurswahlen, GPU-Textdateien oder BAL-Datei. Das Protokoll zeigt, was angelegt wurde.",
            ],
          },
        ],
      },
      {
        id: "stundenplan",
        titel: "Unterricht und Stundenplan",
        bloecke: [
          {
            art: "liste",
            punkte: [
              "Unterricht → Nach Klassen, Lehrkräften oder Fächern: einfacher und gekoppelter Unterricht, Doppelstunden, Blöcke, Kursbänder, A/B-Wochen, befristeter Unterricht. Fach- und Stammraum werden vorgeschlagen.",
              "Planung → Gewichtung: 26 Kriterien von 0 (unwichtig) bis 5 (extrem wichtig); die Analyse nennt Kriterien, die mit den Daten schwer zu erfüllen sind.",
              "Planung → Diagnose prüft die Eingabedaten, die Optimierung erstellt den Plan mit mehreren Verfahren, Ergebnisvergleich und Bewertungszahl.",
              "Planung → Manuell planen: Unterricht und Klassenplan nebeneinander; Verplanen, Verschieben und Tauschen per Drag & Drop mit Zielanzeige, Fixieren, Tauschvorschläge.",
              "Stundenpläne → Klassen, Lehrkräfte, Räume, Fächer; Blockansicht für mehrere Pläne, Gesamtübersichten, eigene Planformate.",
            ],
          },
        ],
      },
      {
        id: "vertretung",
        titel: "Tagesplanung und Vertretung",
        bloecke: [
          {
            art: "text",
            text: "Im Modus Vertretungsplanung ist die Tagesplanung der Arbeitsplatz für den Planungstag: alle Klassen nach Jahrgang als Zeilen, die Stunden des Tages als Spalten. Offene Stunden sind rot markiert, die bisherige Lehrkraft ist durchgestrichen.",
          },
          {
            art: "schritte",
            punkte: [
              "Abwesenheit erfassen (Taste N oder Strg+M): Lehrkraft, Klasse oder Raum mit Zeitraum und Grund. Studio erzeugt sofort die offenen Vertretungen.",
              "Offene Stunde wählen: Rechts stehen Empfehlung und Alternativen mit Begründung („schließt an · kennt Klasse · Fach“). Übernehmen mit Enter.",
              "Andere Lösung: Entfall (Vorschlag in Randstunden ab EF), Vertretung ohne Lehrkraft, Zusammenlegen, Raum zuordnen, Verlegen und Tauschen.",
              "F3 springt zur nächsten offenen Vertretung; „Automatische Vertretung“ bearbeitet einen ganzen Zeitraum nacheinander.",
              "„Veröffentlichen“ öffnet „Prüfen und veröffentlichen“; daneben steht der Stand der letzten Übertragung.",
            ],
          },
          {
            art: "liste",
            punkte: [
              "Bereitschaften werden im Vorschlag bevorzugt und zählen nicht als Mehrarbeit.",
              "Pausenaufsichten: Aufsichtsbereiche × Pausen × Tage, automatische Einteilung und Aufsichtsvertretungen.",
              "Statistik und Abrechnung: Vertretungen, Entfälle, Saldo und vergütungsfähige Mehrarbeit nach NRW-Regel (mehr als 3 Stunden im Kalendermonat, Grenze einstellbar).",
              "Vertretungsplan ausgeben: Klassen- oder Lehrerversion als PDF, HTML oder Monitor-Ansicht.",
            ],
          },
        ],
      },
      {
        id: "veroeffentlichen",
        titel: "Veröffentlichen nach EduOrga Web",
        bloecke: [
          {
            art: "schritte",
            punkte: [
              "In EduOrga Web unter Verwaltung → System & Datenabgleich Adresse, Schul-ID und API-Schlüssel ablesen.",
              "In EduOrga Studio unter EduOrga Web → Einstellungen eintragen. Laufen beide mit install.sh auf demselben Server: Server untplannext-web, Port 8080, ohne HTTPS. Dann „Verbindung prüfen“.",
              "„Exportieren“ überträgt Stammdaten, Stundenplan und Vertretungen; jeder Teil lässt sich einzeln senden. Im Vertretungsmodus genügt „An Web senden“ in der Kopfleiste.",
              "Optional „Vertretungen automatisch übertragen“ einschalten: Änderungen gehen spätestens nach der eingestellten Zeit (Standard 30 Sekunden) gesammelt hinaus.",
              "„Importieren“ holt Abwesenheiten, Raumbuchungen und Klausuren aus EduOrga Web ab. Beim Öffnen der Tagesplanung fragt Studio nach, wenn neue Rückmeldungen vorliegen.",
              "In EduOrga Web unter Administration → Benutzer → „Konten aus Stammdaten“ Konten für alle Lehrkräfte und Klassen anlegen.",
            ],
          },
          {
            art: "hinweis",
            titel: "Personenbezogene Daten",
            text: "E-Mail-Adressen, Lehrer-Abwesenheiten und Abwesenheitsgründe werden nur übertragen, wenn sie in den Exportoptionen ausdrücklich freigegeben sind; vertrauliche Gründe nie.",
          },
        ],
      },
    ],
    quellen: [
      { titel: "Benutzerhandbuch EduOrga Studio", zu: DATEI("docs/HANDBUCH.md") },
      { titel: "README EduOrga Studio", zu: DATEI("studio/README.md") },
      { titel: "Schnittstelle Studio ↔ Web", zu: DATEI("docs/SYNC_API.md") },
    ],
  },
  {
    id: "web",
    titel: "EduOrga Web",
    kurz: "Portal für Kollegium, Klassen und Eltern",
    einleitung:
      "EduOrga Web ist das Portal der Schule im Browser. Die Seitenleiste zeigt je nach Rolle und Rechten die Bereiche Start, Mein Tag, Stundenpläne, Vertretungen, Unterricht & Prüfungen, Klassenbuch, Kommunikation, Termine & Buchungen, Stammdaten und Verwaltung.",
    abschnitte: [
      {
        id: "web-einrichten",
        titel: "Einrichten",
        bloecke: [
          {
            art: "schritte",
            punkte: [
              "Mit dem Konto admin anmelden (Passwort aus install.sh bzw. mit ./passwort.sh web neu setzen).",
              "Studio verbinden und die erste Übertragung abwarten (siehe EduOrga Studio → Veröffentlichen).",
              "Administration → Rechte und Rollen: Passwortrichtlinie und je Rolle das Planfenster (Wochen zurück und voraus).",
              "Administration → Benutzer: Konten aus Stammdaten anlegen; Zugangsdaten lassen sich als Karten zum Ausschneiden drucken.",
              "Verwaltung → Datenschutz: Aufbewahrungsfristen und Datenschutzhinweise der Schule eintragen.",
            ],
          },
        ],
      },
      {
        id: "web-plaene",
        titel: "Pläne und Vertretungen",
        bloecke: [
          {
            art: "liste",
            punkte: [
              "Stundenpläne für Klassen, Lehrkräfte und Räume als Woche oder Tag, mit Jetzt-Linie und Stand der letzten Übertragung aus Studio.",
              "Kennzeichnung: Änderungen grün mit „neu (bisher durchgestrichen)“, Entfall rot und durchgestrichen, offene Vertretung grau gestrichelt, Prüfung bernsteinfarben – immer auch als Wort.",
              "Vertretungsplan in Schüler- und Lehrerversion, als PDF und als Aushang mit großer Schrift.",
              "Monitore: Vertretungsplan für Bildschirme im Schulhaus über einen geheimen Link (Administration → Monitore).",
              "Darstellung der Stundenkarten schulweit anpassbar, mit Live-Vorschau.",
            ],
          },
        ],
      },
      {
        id: "web-klassenbuch",
        titel: "Klassenbuch",
        bloecke: [
          {
            art: "text",
            text: "Lehrkräfte öffnen eine Stunde aus dem Stundenplan oder dem Klassenbuch im Fenster „Unterrichtsstunde“. Alles wird automatisch gespeichert; Alt+←/→ blättert zur vorigen bzw. nächsten Stunde.",
          },
          {
            art: "tabelle",
            kopf: ["Reiter", "Inhalt"],
            zeilen: [
              ["Stunde", "Thema (Lehrstoff) mit Vorstunden zum Übernehmen, Hausaufgaben, Bemerkungen"],
              ["Anwesenheit", "Liste oder Sitzplan: Anwesend, Abwesend, Verspätet, Früher weg"],
              ["Einträge", "Klassenbucheinträge für einzelne Schülerinnen und Schüler oder die Klasse"],
              ["Prüfungen", "Klausuren und Prüfungen der Stunde"],
              ["Verlauf", "Themen der letzten Stunden des Kurses"],
            ],
          },
          {
            art: "text",
            text: "Der Bereich Klassenbuch enthält Wochenübersicht, Meine Stunden, Offene Stunden, Abwesenheiten mit Meldungen der Eltern, Fehlzeiten, Befreiungen, Einträge, Klassendienste, Sitzplan und Auswertungen als PDF oder CSV.",
          },
        ],
      },
      {
        id: "web-kommunikation",
        titel: "Kommunikation und Sprechtag",
        bloecke: [
          {
            art: "liste",
            punkte: [
              "Mitteilungen: Posteingang, Gesendet, Entwürfe, Empfängerlisten; Anhänge, Antworten, Weiterleiten, Drucken.",
              "Nachrichten zum Tag: bearbeitbar durch Schulleitung und Administration, sichtbar auf Start, im Vertretungsplan und auf Monitoren.",
              "Elternsprechtag: Lehrkräfte sperren und geben Zeiten frei, laden Familien ein und tragen Termine ein; Eltern buchen, sagen ab oder setzen sich auf die Warteliste. Terminpläne als PDF.",
              "Melden & Buchen: Abwesenheit melden, Raum buchen, Prüfung eintragen, Meine Meldungen.",
            ],
          },
        ],
      },
    ],
    quellen: [{ titel: "README EduOrga Web", zu: DATEI("web/README.md") }],
  },
  {
    id: "mobile",
    titel: "EduOrga Mobile",
    kurz: "Die App fürs Telefon (PWA)",
    einleitung:
      "EduOrga Mobile bringt EduOrga Web aufs Telefon – als installierbare App ohne App-Store. Angemeldet wird mit dem Konto von EduOrga Web; die App hat keine eigene Datenbank.",
    abschnitte: [
      {
        id: "mobile-installieren",
        titel: "Als App installieren",
        bloecke: [
          {
            art: "schritte",
            punkte: [
              "Die Adresse von EduOrga Mobile der Schule im Browser des Telefons öffnen (z. B. app.meine-schule.de) und anmelden.",
              "iPhone und iPad: in Safari „Teilen“ → „Zum Home-Bildschirm“. Android: im Browsermenü „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.",
              "Unter „Mehr“ bzw. „Schule“ die Benachrichtigungen einschalten. Auf iPhone und iPad funktioniert das in der App vom Home-Bildschirm ab iOS 16.4.",
            ],
          },
          {
            art: "hinweis",
            titel: "HTTPS ist Voraussetzung",
            text: "Installation als App, Offline-Betrieb und Benachrichtigungen funktionieren nur über HTTPS. install.sh richtet das mit Caddy ein; hinter einem vorhandenen Reverse-Proxy dort ein Zertifikat für die Adresse von Mobile hinterlegen.",
          },
        ],
      },
      {
        id: "mobile-bereiche",
        titel: "Bereiche",
        bloecke: [
          {
            art: "tabelle",
            kopf: ["Bereich", "Inhalt"],
            zeilen: [
              ["Heute", "Datum, Hinweise des Tages, die nächsten Stunden, Termine und Prüfungen, eigene Abwesenheiten, Sprechtag"],
              ["Plan", "Woche oder Tag; Klasse, Lehrkraft oder Raum über den Titel; Wischen = andere Woche, Aufziehen = Tag"],
              ["Postfach", "Posteingang, Gesendet, Entwürfe; Lesen, Antworten, Schreiben, Suchen"],
              ["Schule bzw. Mehr", "Klassenbuch, Prüfungen, Vertretungsplan, Melden, Buchen, Sprechtag – je nach Rolle; Profile, Darstellung, Benachrichtigungen"],
            ],
          },
          {
            art: "text",
            text: "Für die eigene Stunde zeigen die Stundendetails die Reiter Details und Klassenbuch: zuerst das Thema, darunter die Anwesenheitskontrolle mit „Alle anwesend“, dann Hausaufgaben, Klassenbucheinträge, Notizen und „Prüfung eintragen“.",
          },
          {
            art: "liste",
            punkte: [
              "Mehrere Profile: weitere Konten unter „Mehr → Weiteres Profil anmelden“, Wechsel ohne neue Anmeldung.",
              "Benachrichtigungen sind standardmäßig datensparsam („Änderung im Stundenplan“), ohne Fach, Klasse, Raum oder Namen.",
              "Offline bleiben App und zuletzt geladene Wochen verfügbar; der Stand ist als „Offline — Stand hh:mm“ gekennzeichnet.",
            ],
          },
        ],
      },
    ],
    quellen: [{ titel: "README EduOrga Mobile", zu: DATEI("mobile/README.md") }],
  },
  {
    id: "ios",
    titel: "App für iPhone und iPad",
    kurz: "Native App – noch nicht im App Store",
    einleitung:
      "Die native App EduOrga (SwiftUI) ist eine App für alle Schulen: Jede Schule betreibt ihr EduOrga Web selbst, die App verbindet sich mit der Adresse der eigenen Schule. Sie ist noch nicht im App Store veröffentlicht.",
    abschnitte: [
      {
        id: "ios-stand",
        titel: "Stand",
        bloecke: [
          {
            art: "hinweis",
            titel: "Noch nicht im App Store",
            text: "Bis zur Veröffentlichung lässt sich die App nur mit Xcode 26 aus dem Repository bauen (ios/UntPlanNext.xcodeproj, Zielsystem iOS 18 oder neuer). Für den Schulalltag steht bis dahin EduOrga Mobile zur Verfügung. Eine Android-App ist in Arbeit.",
          },
        ],
      },
      {
        id: "ios-einrichtung",
        titel: "Einrichtung",
        bloecke: [
          {
            art: "schritte",
            punkte: [
              "EduOrga-Adresse der Schule eingeben (z. B. plan.meine-schule.de) – die App prüft schon beim Tippen Format, Server und Schulname – oder den QR-Code der Schule scannen.",
              "Mit Benutzername und Passwort der Schule anmelden; „Passwort merken“ legt die Zugangsdaten im Schlüsselbund ab.",
              "Weitere Konten, auch an anderen Schulen, unter Profil → Konten hinzufügen.",
            ],
          },
          { art: "text", text: "Inhalt des QR-Codes bzw. Einrichtungslink: untplannext://einrichten?server=plan.meine-schule.de" },
        ],
      },
      {
        id: "ios-bereiche",
        titel: "Bereiche",
        bloecke: [
          {
            art: "tabelle",
            kopf: ["Reiter", "Inhalt"],
            zeilen: [
              ["Heute", "Fokuskarte „Jetzt“ bzw. „Als Nächstes“, alle Stunden des Tages, Hinweise der Schule, Zu erledigen"],
              ["Plan", "Agenda, Woche (Standard) oder Tag; „Nur Änderungen“, Auswahl und Filter, mehrere Pläne nebeneinander"],
              ["Postfach", "Mitteilungen lesen und schreiben"],
              ["Schule", "Klassenbuch, Prüfungen, Vertretungen, Melden, Elternsprechtag – je nach Rolle"],
              ["Profil", "Konten und Schulen, Termine, Einstellungen, Abmelden"],
            ],
          },
          {
            art: "text",
            text: "Lehrstoff, Hausaufgaben, Klassenbucheinträge und Anwesenheit, die ohne Verbindung gespeichert werden, landen im Schreibpuffer und werden gesendet, sobald das Netz zurück ist.",
          },
        ],
      },
    ],
    quellen: [{ titel: "README der App", zu: DATEI("ios/README.md") }],
  },
  {
    id: "datenschutz",
    titel: "Datenschutz und Rollen",
    kurz: "Rollen, Rechte, Fristen, Auskunft",
    einleitung:
      "Die Schule ist Verantwortliche für alle Daten in EduOrga. Die Programme laufen auf dem Server der Schule bzw. ihres Betreibers, ohne Cloud, Telemetrie, Tracking oder Inhalte von fremden Servern.",
    abschnitte: [
      {
        id: "rollen",
        titel: "Rollen in EduOrga Web",
        bloecke: [
          {
            art: "tabelle",
            kopf: ["Rolle", "sieht", "darf"],
            zeilen: [
              ["Administration", "alles", "Benutzer, Synchronisation, Stammdaten, Einstellungen, Monitore, Nachrichten"],
              ["Schulleitung", "alles (Lehrerversion)", "Nachrichten zum Tag, Mitteilungen an alle"],
              ["Lehrkraft", "alle Pläne, Lehrerversion", "melden, buchen, Klassenbuch für eigene Stunden"],
              ["Klasse, Schülerin, Schüler", "eigene Klasse, Räume, Schülerversion", "Mitteilungen an Klassenleitung und Schulleitung"],
            ],
          },
          {
            art: "text",
            text: "Feinere Rechte (z. B. Prüfungen eintragen, Räume buchen, Entschuldigungen) vergibt die Administration unter Rechte und Rollen. In EduOrga Studio regeln Gruppen und Rechte als Matrix Gruppe × Bereich, wer was bearbeiten darf.",
          },
        ],
      },
      {
        id: "dsgvo",
        titel: "Datenschutzfunktionen",
        bloecke: [
          {
            art: "liste",
            punkte: [
              "Aufbewahrung und Löschung: Fristen je Kategorie mit Vorgaben (z. B. Klassenbuch 10 Jahre, übrige Schülerdaten 5 Jahre nach VO-DV I – von der Schule zu prüfen), Probelauf, täglicher Löschlauf, Löschprotokoll nur mit Anzahlen.",
              "Auskunft nach Art. 15 als PDF oder JSON je Person; Löschen bzw. Sperren nach Art. 18; Konten anonymisieren.",
              "Datenschutzhinweise der Schule öffentlich unter /datenschutz; Schüler- und Elternkonten bestätigen die Kenntnisnahme.",
              "Benachrichtigungen standardmäßig ohne Einzelheiten; Anmeldeprotokoll mit IP-Adressen nach 30 Tagen gelöscht.",
              "Sicherungen auf Wunsch verschlüsselt mit age oder gpg; der private Schlüssel bleibt außerhalb des Servers.",
            ],
          },
          {
            art: "hinweis",
            titel: "Vor dem Start mit echten Daten",
            text: "Den Leitfaden für Schulen in NRW durchgehen: Rollen, DSGVO, SchulG NRW §§ 120–122, VO-DV I/II, Löschfristen, DSFA – mit Vorlagen für Verzeichnis von Verarbeitungstätigkeiten, TOM und AV-Vertrag. Die Vorlagen sind keine Rechtsberatung.",
          },
        ],
      },
    ],
    quellen: [
      { titel: "Leitfaden Datenschutz", zu: DATEI("docs/datenschutz/README.md") },
      { titel: "Technische und organisatorische Maßnahmen", zu: DATEI("docs/datenschutz/TOM.md") },
      { titel: "Verzeichnis von Verarbeitungstätigkeiten", zu: DATEI("docs/datenschutz/VERZEICHNIS.md") },
      { titel: "Vorlage AV-Vertrag", zu: DATEI("docs/datenschutz/AV-Vertrag-Vorlage.md") },
    ],
  },
  {
    id: "betrieb",
    titel: "Installation und Betrieb",
    kurz: "Server, Update, Sicherung, Fehlerbehebung",
    einleitung:
      "Installation, erster Login, Update, Sicherung, Wiederherstellung und Fehlerbehebung stehen ausführlich auf der Seite Installation und in docs/INSTALLATION.md bzw. docs/BETRIEB.md im Repository.",
    abschnitte: [
      {
        id: "betrieb-kurz",
        titel: "Auf einen Blick",
        bloecke: [
          {
            art: "tabelle",
            kopf: ["Aufgabe", "Befehl im Ordner /opt/untplannext"],
            zeilen: [
              ["Installieren bzw. neu starten", "sh install.sh"],
              ["Neu einrichten (Daten bleiben)", "./install.sh --neu"],
              ["Aktualisieren mit Sicherung", "./update.sh"],
              ["Nur sichern", "./update.sh --nur-sichern"],
              ["Passwort neu setzen", "./passwort.sh studio|web [benutzer]"],
              ["Zustand und Protokoll", "docker compose ps, docker compose logs"],
            ],
          },
        ],
      },
    ],
    quellen: [
      { titel: "Installation Schritt für Schritt", zu: DATEI("docs/INSTALLATION.md") },
      { titel: "Betrieb: Update, Sicherung, Fehlerbehebung", zu: DATEI("docs/BETRIEB.md") },
      { titel: "installation/README.md", zu: DATEI("installation/README.md") },
    ],
  },
];
