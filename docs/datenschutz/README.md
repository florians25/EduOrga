# Datenschutz mit EduOrga – Leitfaden für Schulen in NRW

> **Kein Rechtsrat.** Diese Unterlagen beschreiben, was EduOrga technisch tut, und geben Vorlagen. Verantwortlich für die
> Datenverarbeitung ist die **Schule** (Schulleitung); prüfen Sie alle Angaben mit Ihrer bzw. Ihrem
> **Datenschutzbeauftragten** und ggf. dem Schulträger. Stellen, an denen eine Prüfung nötig ist, sind mit
> „**zu prüfen**“ markiert. EduOrga ist ein privates Hobbyprojekt (siehe `design/MARKE.md`); es gibt keine
> Zusicherung, dass der Einsatz an Ihrer Schule rechtskonform ist.

| Unterlage | Inhalt |
|---|---|
| [`VERZEICHNIS.md`](VERZEICHNIS.md) | Vorlage für das Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO) mit Datenbestand je Programm (Tabellen, Cookies, Gerätespeicher, Protokolle, Sicherungen) |
| [`TOM.md`](TOM.md) | Technische und organisatorische Maßnahmen (Art. 32 DSGVO): was EduOrga umsetzt, was der Betrieb ergänzen muss |
| [`AV-Vertrag-Vorlage.md`](AV-Vertrag-Vorlage.md) | **unverbindliche** Gliederung eines Auftragsverarbeitungsvertrags (Art. 28 DSGVO) für Schulträger bzw. IT-Dienstleister |

## Rollen

| Rolle | Wer | Aufgaben |
|---|---|---|
| **Verantwortlicher** (Art. 4 Nr. 7 DSGVO) | die Schule, vertreten durch die Schulleitung | Zwecke und Mittel festlegen, Verzeichnis (Art. 30), Informationspflichten (Art. 13/14), Betroffenenrechte (Art. 15–22), Löschfristen, ggf. DSFA (Art. 35), Rechte und Rollen in EduOrga vergeben |
| **Datenschutzbeauftragte*r** | von der Schule bzw. Schulaufsicht bestellt (in NRW häufig für mehrere Schulen – **zu prüfen**) | beraten, prüfen, Ansprechperson für Betroffene; Kontakt in den Datenschutzhinweisen |
| **Auftragsverarbeiter** (Art. 28) | wer den Server betreibt: Schulträger, kommunales Rechenzentrum, IT-Dienstleister | Betrieb nur nach Weisung, AV-Vertrag, TOM des Betriebs (Server, Netz, Sicherungen, Updates) |
| **Hersteller** | EduOrga (Quelltext auf GitHub) | liefert Software; hat **keinen Zugriff** auf die Daten der Schule – es gibt keine Telemetrie, keine Cloud und keinen Fernzugang |

Liegt der Server in der Schule und wird er von Lehrkräften der Schule betrieben, gibt es keinen Auftragsverarbeiter;
die TOM des Betriebs gelten dann für die Schule selbst. Externe Dienste, die beim Betrieb berührt werden:
GitHub/ghcr.io (Laden der Programme, Prüfung auf neue Versionen – ohne Daten der Schule, abschaltbar mit
`UNTPLANWEB_UPDATE_PRUEFEN=0`/`STUDIO_UPDATE_PRUEFEN=0`), Let's Encrypt (Zertifikat), Push-Dienste der Gerätehersteller
(Apple, Google, Mozilla – nur Gerätekennung und eine allgemeine Nachricht, siehe [TOM](TOM.md#5-push-benachrichtigungen)).

## Rechtsgrundlagen (Überblick, zu prüfen)

- **DSGVO**: Grundsätze (Art. 5), Rechtmäßigkeit (Art. 6 Abs. 1 Buchst. c und e), besondere Kategorien wie
  Gesundheitsdaten bei Krankmeldungen und Befreiungen (Art. 9), Informationspflichten (Art. 12–14), Betroffenenrechte
  (Art. 15–22), Datenschutz durch Technikgestaltung und datenschutzfreundliche Voreinstellungen (Art. 25),
  Auftragsverarbeitung (Art. 28), Verzeichnis (Art. 30), Sicherheit (Art. 32), DSFA (Art. 35).
- **Schulgesetz NRW §§ 120–122** (Datenverarbeitung durch Schulen, Schulaufsicht und Schulträger).
- **VO-DV I** (Daten von Schülerinnen, Schülern und Eltern; BASS 10-44 Nr. 2.1) mit den **Aufbewahrungsfristen in § 9**,
  **VO-DV II** (Daten der Lehrerinnen und Lehrer).
- **DSG NRW** ergänzend für öffentliche Stellen des Landes.
- **TDDDG § 25** für Cookies und Gerätespeicher (EduOrga verwendet nur technisch notwendige).

### Aufbewahrungsfristen (VO-DV I § 9)

Nach den uns vorliegenden Quellen (Stand der Fassung in der BASS bitte selbst prüfen) gilt u. a.:

| Unterlagen | Frist |
|---|---|
| Zweitschriften von Abgangs- und Abschlusszeugnissen | 50 Jahre |
| Schülerstammblätter | 20 Jahre |
| Zeugnislisten, Zeugnisdurchschriften (außer Abgangs-/Abschlusszeugnisse), **Unterlagen über die Klassenführung (Klassenbuch, Kursbuch)**, Akten über Schülerprüfungen | **10 Jahre** |
| übrige Daten | 5 Jahre |

Die Fristen beginnen mit **Ablauf des Kalenderjahres**, in dem die Unterlagen abgeschlossen wurden (bei EduOrga: das
Schuljahr des Eintrags endete). Ob zusätzlich „nicht vor Ablauf des Kalenderjahres, in dem die Schulpflicht endet“ gilt
und wie die Fristen auf das digitale Klassenbuch anzuwenden sind, ist **zu prüfen**. Fristen sind Höchstfristen für die
Aufbewahrung *und* Pflicht zur Aufbewahrung: Vorher darf nicht gelöscht, danach muss gelöscht werden.
Schülerstammblatt und Zeugnisse führt die Schule in der Schulverwaltung (z. B. SchILD-NRW), nicht in EduOrga.

## Was EduOrga dafür bietet

**EduOrga Web → Verwaltung → Datenschutz** (nur Administration):

1. **Aufbewahrung & Löschung** – je Kategorie Frist und „automatisch löschen“, Probelauf (wie viele Einträge vor
   welchem Datum), „jetzt löschen“, täglicher Löschlauf, **Löschprotokoll** (nur Anzahlen). Vorgaben:

   | Kategorie | Vorgabe | ab Werk |
   |---|---|---|
   | Anmeldeprotokoll (Zeit, IP-Adresse, Gerät) | 30 Tage | an |
   | Gemerkte Konten auf Geräten | 30 Tage | an |
   | Verwaltungsprotokoll | 365 Tage | an |
   | Geräte für Sofort-Benachrichtigungen | 180 Tage ohne Meldung | aus |
   | Mitteilungen mit Anhängen | 365 Tage | aus – Festlegung der Schule |
   | Abwesenheitsmeldungen der Eltern | 5 Jahre nach Schuljahresende (VO-DV I „übrige Daten“, zu prüfen) | aus |
   | Klassenbuch (Lehrstoff, Hausaufgaben, Anwesenheit, Fehlzeiten, Entschuldigungen, Vermerke, Befreiungen, Klassendienste) | 10 Jahre nach Schuljahresende (VO-DV I, zu prüfen) | aus |
   | Elternsprechtag (Termine, Einladungen, Wartelisten) | 90 Tage nach dem Sprechtag | aus |
   | Raum- und Gerätebuchungen | 730 Tage | aus |

   Inhaltliche Kategorien löschen erst, wenn die Schule sie einschaltet – damit nach einem Update nichts ungeprüft
   verschwindet. Bis dahin zeigt die Seite einen Hinweis.
2. **Auskunft & Löschung von Personen** – Auskunft (Art. 15) als PDF bzw. JSON für Schüler*innen und Konten;
   **Löschung** (Art. 17) einer Schülerin bzw. eines Schülers: Läuft für Klassenbuch-/Abwesenheitsdaten noch die Frist,
   werden diese **gesperrt** (Einschränkung, Art. 18 – die Person erscheint in keiner Liste mehr) und nach Fristablauf
   automatisch gelöscht; alles andere (Sprechtag, Gruppen, Sitzplatz, persönliche Angaben, Kontozuordnung) wird sofort
   gelöscht, Schülerkonten werden gesperrt. **Konten anonymisieren**: Name, E-Mail, Anmeldeprotokoll, Geräte, Listen
   und Zuordnungen weg, Mitteilungen bleiben für andere als „Gelöschtes Konto“. Berichtigung (Art. 16): Benutzer- bzw.
   Schülerverwaltung.
3. **Datenschutzhinweise** – Vorlage nach Art. 13/14 mit Platzhaltern (Verantwortlicher, DSB, Betreiber); die Seite
   `https://<EduOrga Web>/datenschutz` ist ohne Anmeldung erreichbar, verlinkt auf der Anmeldeseite, im Kontomenü, in
   EduOrga Mobile und in der iOS-App. Schüler- und Elternkonten sehen nach der ersten Anmeldung (und nach jeder neuen
   Fassung) einen Hinweis „Zur Kenntnis genommen“ – das ist **keine Einwilligung**.
4. **Sofort-Benachrichtigungen** datensparsam (Standard): nur „Änderung im Stundenplan“; Einzelheiten nur, wenn die
   Administration sie einschaltet.

Weitere datenschutzfreundliche Voreinstellungen: EduOrga Studio überträgt Abwesenheitsgründe von Lehrkräften und deren
E-Mail-Adressen nur, wenn eingeschaltet, und „vertrauliche“ Gründe nie; die Schülerversion des Vertretungsplans zeigt
keine Gründe; Eltern sehen nur ihre Kinder, Schüler*innen nur sich selbst; Lehrkräfte ohne Klassenleitung sehen von
Schüler*innen nur Name, Klasse und Geschlecht.

## Datenschutz-Folgenabschätzung (Art. 35)

Ein digitales Klassenbuch mit Fehlzeiten, Entschuldigungen (teils Gesundheitsangaben) und Kommunikation mit Familien
verarbeitet Daten **Minderjähriger** in großem Umfang. Ob eine DSFA nötig ist, entscheidet die Schule mit ihrer bzw.
ihrem DSB anhand der Kriterien von Art. 35 Abs. 1 und 3 und der Liste der Aufsichtsbehörde nach Art. 35 Abs. 4
(**zu prüfen**). Wir empfehlen, sie durchzuführen oder die Entscheidung dagegen zu dokumentieren. Checkliste:

- [ ] Beschreibung der Verarbeitung: genutzte Module (Klassenbuch, Mitteilungen, Sprechtag, Apps), Rollen, Datenflüsse Studio → Web → Mobile/iOS (Vorlage: [`VERZEICHNIS.md`](VERZEICHNIS.md))
- [ ] Notwendigkeit und Verhältnismäßigkeit: Welche Module braucht die Schule wirklich? Welche Felder (Geburtsdatum, E-Mail, Bemerkungen, Gründe) werden gepflegt?
- [ ] Risiken für Betroffene: unbefugter Zugriff (Konto-Übernahme, geteilte Geräte), Offenlegung von Gesundheitsangaben, falsche Zuordnung von Eltern zu Kindern, zu lange Speicherung, Ausfall
- [ ] Maßnahmen: [`TOM.md`](TOM.md), Fristen in *Aufbewahrung & Löschung* eingeschaltet, Passwortregeln, HTTPS, verschlüsselte Sicherungen, Rollen und Rechte geprüft, Schulung des Kollegiums
- [ ] Restrisiko bewertet, Stellungnahme der bzw. des DSB, Entscheidung der Schulleitung, Wiedervorlage (z. B. jährlich und bei neuen Modulen)

## Schritte bis zum Start

1. **Betrieb klären:** Wer betreibt den Server? Bei Schulträger/Dienstleister: AV-Vertrag ([Vorlage](AV-Vertrag-Vorlage.md)), Standort des Servers (EU), Zuständigkeit für Updates und Sicherungen.
2. **Installation mit HTTPS** (`installation/install.sh`, Caddy mit HSTS); Programme nur über Caddy erreichbar (`BIND_ADRESSE=127.0.0.1`).
3. **Sicherungen verschlüsseln:** `SICHERUNG_AGE_EMPFAENGER` bzw. `SICHERUNG_GPG_EMPFAENGER` in `.env`; privaten Schlüssel getrennt verwahren; Wiederherstellung einmal üben.
4. **Konten und Rechte:** starke Passwörter (*Rechte und Rollen → Passwortregeln*), Administration auf wenige Personen beschränken, Zuordnung Eltern ↔ Kinder sorgfältig prüfen (Import aus SchILD-NRW), Klassenkonten nur, wenn nötig.
5. **EduOrga Studio → EduOrga Web:** nur übertragen, was gebraucht wird (Schülerliste, Abwesenheitsgründe, E-Mail-Adressen); Gründe wie „Krankheit“ als *vertraulich* markieren.
6. **Fristen festlegen:** *Verwaltung → Datenschutz → Aufbewahrung & Löschung* – Kategorien prüfen, einschalten, speichern.
7. **Datenschutzhinweise** ausfüllen, mit DSB abstimmen, „geprüft“ setzen; im Verzeichnis (Art. 30) und ggf. in der Schulordnung bzw. Elterninformation darauf verweisen.
8. **Verzeichnis und TOM** aus den Vorlagen übernehmen und ergänzen; DSFA (siehe oben) dokumentieren.
9. **Kollegium informieren:** keine sensiblen Inhalte in Mitteilungen ohne Notwendigkeit, Abmelden an geteilten Geräten, private Endgeräte nur nach den Regeln der VO-DV I/II und mit Genehmigung der Schulleitung (**zu prüfen**).
10. **Regelmäßig:** Updates einspielen (`./update.sh`), Löschprotokoll und Protokoll ansehen, Konten ehemaliger Schüler*innen, Eltern und Lehrkräfte sperren bzw. löschen, Fristen und Hinweise jährlich prüfen.

## Anfragen von Betroffenen

| Recht | In EduOrga |
|---|---|
| Auskunft (Art. 15) | *Datenschutz → Auskunft & Löschung von Personen → Auskunft (PDF/JSON)*; ergänzend Daten aus Studio und der Schulverwaltung |
| Berichtigung (Art. 16) | *Verwaltung → Benutzer*, *Unterricht → Schüler\*innen*; Stammdaten aus Studio/SchILD dort ändern |
| Löschung (Art. 17) | *Löschen …* bei der Person bzw. *Anonymisieren …* beim Konto; Fristen beachten |
| Einschränkung (Art. 18) | automatisch beim Löschen innerhalb der Aufbewahrungsfrist (Sperre bis Fristende) |
| Datenübertragbarkeit (Art. 20) | JSON-Auskunft (maschinenlesbar); Anwendbarkeit bei öffentlicher Aufgabe **zu prüfen** |
| Widerspruch (Art. 21) | Entscheidung der Schule; technisch über Löschen/Sperren |

Jede Auskunft, Löschung und Anonymisierung steht im Protokoll der Administration und im Löschprotokoll.
