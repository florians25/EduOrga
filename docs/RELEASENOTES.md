UntPlan – Stunden- und Vertretungsplanung für Schulen in NRW.

## UntPlan Next

### Datenschutz (DSGVO, Schulen in NRW)
- Leitfaden und Vorlagen unter `docs/datenschutz/`: Verzeichnis von Verarbeitungstätigkeiten, TOM, unverbindliche
  AV-Vertrags-Gliederung, DSFA-Checkliste, Schritte bis zum Start.
- EduOrga Web, *Verwaltung → Datenschutz*: Aufbewahrungsfristen je Kategorie (Vorgaben nach VO-DV I § 9 – von der Schule
  zu prüfen) mit Probelauf, täglichem Löschlauf und Löschprotokoll; Anmeldeprotokoll mit IP-Adressen ab Werk 30 Tage.
- Auskunft (Art. 15) als PDF/JSON, Löschung von Schüler*innen mit Sperre während laufender Aufbewahrungsfristen
  (Art. 18), Anonymisierung von Konten.
- Datenschutzhinweise der Schule unter `/datenschutz` (Vorlage mit Platzhaltern), verlinkt in Web, Mobile und iOS;
  Hinweis zur Kenntnisnahme für Schüler- und Elternkonten.
- Push-Nachrichten und lokale Mitteilungen der iOS-App standardmäßig ohne Einzelheiten; PWA löscht beim Abmelden die
  zwischengespeicherten Daten.
- Sicherungen optional mit age bzw. GPG verschlüsselt (`SICHERUNG_AGE_EMPFAENGER`, `SICHERUNG_GPG_EMPFAENGER`);
  `UNTPLANWEB_SICHERE_COOKIES`, `UNTPLANWEB_SITZUNG_TAGE`; SQLite mit `secure_delete`; Studio-Passwörter mindestens 8 Zeichen.

### UntPlan Studio statt Desktop-Anwendung
- Die Planung läuft vollständig als Web-Anwendung **UntPlan Studio** im Browser; die Windows-Desktop-Anwendung entfällt
  (kein Installer, keine lokale Installation). Alle Berechnungen – Planung, Optimierung, Vertretungsvorschläge,
  Auswertungen – führt der Server aus; Betrieb als Container, auch zusammen mit UntPlan Web auf einem Server.
- Schuldateien liegen auf dem Server und werden automatisch gespeichert; `.up`-Dateien lassen sich jederzeit
  herunterladen und wieder hochladen, BAL-Dateien werden übernommen.
- Mehrbenutzerbetrieb ohne eigene Datenbankeinrichtung: Konten mit den Rollen Administrator, Planer und Leser,
  Live-Anzeige der Änderungen anderer, aktive Benutzer, Nachrichten, Bereichssperren, Exklusivbetrieb, Gruppen und
  Rechte.

### Neue Bedienung
- Navigation nach Arbeitsbereichen (Stammdaten, Unterricht, Planung, Stundenpläne, Oberstufe, Auswertung, Ausgabe,
  Datenaustausch, Schule; im Vertretungsmodus zusätzlich Vertretungsplanung, Ereignisse, Tagespläne, Auswertung und
  Ausgabe) als schlichte Textnavigation statt Menüband.
- **Befehlssuche** (Strg+K) findet jede Funktion.
- Seiten statt Fenster: jede Aufgabe hat eine eigene Seite mit Adresse und Zurück-Taste; feste Arbeitsplätze für
  *Manuell planen*, *Tagesplanung* und *Verlegen und Tauschen*.
- Übersicht der Schuldatei mit Kennzahlen, Planqualität und häufigen Aufgaben.
- Optimierungsverfahren mit sprechenden Namen: *Kompakt*, *Gründlich*, *Stufenweise – schnell*, *Stufenweise –
  gründlich*, *Langlauf – über Nacht*; die Optimierung läuft im Hintergrund, mit Ergebnisvergleich.

### Designsystem
- Gemeinsames Designsystem für Studio, UntPlan Web, UntPlan Mobile und iOS: Schrift IBM Plex Sans, Markenfarbe Marine,
  ruhige Flächen, Wortmarke statt Bildzeichen, Symbole nur für Funktionen und einheitliche Statusfarben für Entfall, Vertretung/Änderung, Prüfung,
  Veranstaltung und unterrichtsfreie Tage.
- Einheitliche Stundenplan-Darstellung auf allen Oberflächen.

### UntPlan Web, UntPlan Mobile und iOS
- UntPlan Web, die Web-App UntPlan Mobile und die iOS-App sind nach dem neuen Designsystem gestaltet.
- Mobile und iOS mit der Navigation *Heute · Plan · Postfach · Mehr*.

### „Findet online statt“ in UntPlan Studio
- Online-Unterricht wird jetzt in **UntPlan Studio** festgelegt: regelmäßig je Unterricht (Spalten *online* und *Online-Link*
  bzw. Online-Einstellung des Unterrichts) und abweichend für einzelne Stunden an einem Datum in der Vertretungsplanung
  (auch für die ganze Doppel-/Blockstunde; „findet heute nicht online statt“ ebenso möglich). Links nur mit `http://` bzw. `https://`.
  Änderungen lassen sich wie alle anderen rückgängig machen und stehen in der Schuldatei (ältere Dateien: nicht online).
- Der Export an UntPlan Web überträgt „online“ und den Link je Unterricht und je Stunde. UntPlan Web, UntPlan Mobile und
  die iOS-App zeigen den Online-Unterricht nur noch an (Symbol auf der Karte, „Online-Unterricht“ mit Link zum Beitreten);
  Schüler*innen sehen den Link nur, wenn die Stunde online stattfindet.
- Der Schalter „Findet online statt“ im Klassenbuch von UntPlan Web, Mobile und iOS entfällt. Ältere Apps dürfen die
  bisherigen Felder weiter senden; sie werden ignoriert. **Migration:** bisher im Klassenbuch gespeicherte Online-Angaben
  (Spalten `online`/`online_link` der Tabelle `klassenbuch`) werden nicht übernommen und nicht mehr angezeigt – Online-Unterricht
  bitte in UntPlan Studio neu festlegen und an UntPlan Web übertragen.

### Bezeichnungen
- Neutrale, eigenständige Bezeichnungen in Oberfläche und Dokumentation; Dateiformate anderer Programme (z. B. GPU)
  werden nur als Import-/Exportformat genannt.

## Frühere Versionen

### Desktop-Anwendung (abgelöst durch UntPlan Studio)
- Vorabversion von UntPlan Studio im Browser mit Dateneingabe, Stundenplänen, Vertretungsplanung, Optimierung, Druck,
  Import/Export und Mehrbenutzerbetrieb.
- Veranstaltungen mit allen Lehrkräften oder Klassen kompakt dargestellt („Alle Lehrkräfte“, „Alle Klassen außer …“),
  Schnellauswahl nach Abteilung, Jahrgang oder Fachgruppe.
- Schnellerer Tageswechsel, Strg+Bild↑/↓ blättert die Unterrichtstage; Korrekturen bei der Übertragung von
  Raumvertretungen an UntPlan Web.

### UntPlan Web
- Stundenkarten: Verlegungen mit Pfeil-Symbol, Kennzeichnung hinzugefügter Elemente und Raumänderungen, Kopplungen
  nebeneinander.
- Einheitliches Seitenlayout mit gemeinsamem Suchfeld; übersichtlichere Rechteverwaltung.
- Überarbeitete Raum- und Ressourcenbuchung, Prüfungen bearbeiten und löschen.
- Sprechtage mit Ankündigung, Zeitblöcken, Termindauer je Lehrkraft, Warteliste und Online-Terminen.
- Abwesenheitsberichte (Fehltage pro Klasse, unentschuldigte Abwesenheiten), Fehlzeiten-Übersicht für Schülerinnen,
  Schüler und Eltern; eigene Abwesenheit im Plan als graue Fläche.

### Apps (iOS und Web-App)
- Neues App-Symbol, Kopplungen nebeneinander bzw. Zählerkarte bei wenig Platz, Kennzeichnung nur geänderter Elemente,
  angepasste Farben im Dunkelmodus, Sprechtag-Ankündigung, Fehlzeiten-Summen mit Kind-Auswahl.
