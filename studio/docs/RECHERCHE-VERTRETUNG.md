# Recherche: Wie Vertretungsplanungsprogramme den Tag zeigen

Stand: Oktober 2026. Grundlage für die Überarbeitung der Tagesplanung in EduOrga Studio (Tagesübersicht nach Klassen,
Miniplan). Ziel war, typische Arbeitsabläufe und Ansichten zu verstehen – **nicht**, Aussehen, Namen oder Menüs eines
Produkts zu übernehmen (siehe `design/DESIGN.md`, Abschnitt 8).

**Methode und Grenzen:** Websuche nach Herstellerhilfen, Handreichungen und Schulkonzepten. Die Hilfeseiten der Hersteller
selbst ließen sich aus der Arbeitsumgebung nicht abrufen (Namensauflösung gesperrt); ausgewertet wurden daher die
Suchergebnisse mit ihren Auszügen sowie allgemein bekanntes Wissen über diese Programme. Aussagen ohne Quelle sind als
Erfahrungswissen gekennzeichnet.

## Was die verbreiteten Programme gemeinsam haben

| Programm | Was für die Tagesplanung auffällt |
|---|---|
| **Untis** (Modul Vertretungsplanung, WebUntis) | Eigenes Fenster *Abwesenheiten* (Lehrkräfte, Klassen, Räume), daraus entsteht die Liste der *Vertretungen*; der *Vertretungsvorschlag* reiht die Kandidaten und zeigt seit 2019 auch, wer zur Zeit eigenen Unterricht hat. Daneben Stundenplanfenster für Klasse und Lehrkraft, in denen man Stunden per Ziehen verlegt (der alte Platz wird zum Entfall, der neue zur Verlegung); konfliktfreie Ziele werden farbig markiert. Zähler für Entfälle, Vertretungen, Zusatzstunden und Freisetzungen. *(Quellen 1–4)* |
| **DaVinci** (Stüber) | Ansicht *Abwesenheiten* für Tages- oder Zeitraumabwesenheiten von Lehrkräften, Klassen und Räumen; daraus entstehen Vertretungen, die einer Lehrkraft zugewiesen, durch eine Alternativstunde ersetzt oder offen gelassen werden. Veröffentlichung als kompakte Liste über ein bis sechs Tage bzw. App. *(Quellen 5–6)* |
| **aSc Vertretungen / EduPage** | Drei Schritte: Abwesende (Lehrkräfte, Räume, Klassen) eingeben, das Programm listet die zu vertretenden Stunden, man wählt aus gereihten Vorschlägen (der oberste ist der beste). Getrennte Tagesberichte für Lehrkräfte und für Schüler; die Schülerfassung (nach Klassen) ist beliebt, weil Schüler morgens nachsehen, was in ihrer Klasse passiert. Je Lehrkraft einstellbar, ob und wann sie vertreten darf. *(Quellen 7–8)* |
| **Indiware / Stundenplan24** | Vertretungsplan als eigenes Modul neben dem Stundenplan; Veröffentlichung im Web und in einer App (Plan einer Klasse, Lehrkraft oder eines Raums, Änderungen rot hervorgehoben). Version 7 erlaubt Stundenplan und Vertretungsplan nebeneinander. *(Quellen 9–11)* |
| **Schulmanager-Online, Sdui, kleinere Werkzeuge** | Eher halbautomatisch; Schwerpunkt auf Mitteilung an Lehrkräfte, Eltern und Schüler. Offene Projekte (z. B. Anzeige-Apps für vorhandene Pläne) planen selbst nicht, sondern zeigen fertige Pläne an. *(Quellen 12–14)* |

## Ansichten, die Planer nutzen (Erfahrungswissen, durch die Quellen gestützt)

1. **Liste der offenen Stunden** mit Kandidaten – der Kern aller Programme (Vorschlag mit Reihung, Belastung/Zähler).
2. **Plan von Klasse und Lehrkraft daneben** – zum Verlegen, Tauschen und um zu sehen, ob eine Klasse ohnehin
   Randstunden hat (Entfall statt Vertretung). In den Desktop-Programmen sind das frei anordenbare Fenster.
3. **Übersicht nach Klassen** – entspricht dem Schülerplan: „Was passiert heute in der 7b?“ Planer prüfen damit, ob eine
   Klasse zu viele Entfälle hat, ob Doppelstunden zusammen besetzt sind und ob eine Klasse ohnehin unterwegs ist.
4. **Übersicht nach Lehrkräften bzw. „Wer ist frei?“** – Lehrkräfte × Stunden mit Bereitschaften, Freisetzungen und
   Hohlstunden; dazu Zähler, wie oft jemand diese Woche/diesen Monat schon vertreten hat (Gerechtigkeit, Mehrarbeit).
5. **Klassenabwesenheit** (Ausflug, Praktikum, Prüfung) als eigene Abwesenheit: Sie *setzt Lehrkräfte frei*, die dann als
   Vertretung zur Verfügung stehen – ein wichtiger Teil der Planung.
6. **Bereitschaften / Präsenzlehrkräfte** je Stunde sichtbar und als erste Wahl.
7. **Veröffentlichen** mit Stand (wann zuletzt gesendet), getrennte Fassungen für Lehrkräfte und Schüler, Tagestexte.

**Typischer Ablauf:** Krankmeldungen am Morgen erfassen → offene Stunden entstehen → nach Dringlichkeit (Uhrzeit,
Klausuraufsicht, jüngere Klassen) lösen: Bereitschaft, freigesetzte Lehrkraft, Hohlstunde, Entfall bei Randstunden,
Zusammenlegen → Pläne prüfen (Kollisionen, Raum) → veröffentlichen; im Laufe des Tages nachsteuern.

**Tastatur:** In den Desktop-Programmen sind Pfeiltasten, Enter für „Vorschlag übernehmen“ und eigene Tasten für Entfall
üblich; Planer arbeiten unter Zeitdruck (vor der ersten Stunde) und wollen ohne Maus durchkommen.

## Was wir daraus ableiten (eigene Gestaltung)

* **Klassen zuerst.** Die Hauptansicht ist eine *Tagesübersicht* Klassen × Stunden. Jede Zelle zeigt Fach, Raum und
  Lehrkraft; Status über Linie, Durchstreichung, Schraffur und Textfarbe (nicht über Wörter oder Farbflächen): offen = rote
  Linie mit „?“, vertreten = violette Linie, neue Lehrkraft violett und bisherige durchgestrichen, Entfall schraffiert,
  Raumänderung, ohne Lehrkraft, Termin, Klausur. Doppelstunden sind eine Zelle, eine abwesende Klasse ein Band über die
  Stunden. Gruppiert nach Jahrgang (einklappbar), Filter *Nur Änderungen*, Jahrgang und Suche; virtualisiert für große
  Schulen (70+ Klassen, 200+ Lehrkräfte).
* **Entscheiden direkt in der Übersicht.** Die bewährte Entscheidung (Empfehlung mit Enter, zwei Alternativen, Entfall,
  Zusammenlegen, weitere Möglichkeiten) steht rechts neben der Matrix; nach jeder Entscheidung ist die nächste offene Stunde
  gewählt (Stunde für Stunde, also nach Dringlichkeit). Mehrfachauswahl für gemeinsame Kandidaten.
* **Verfügbarkeit im Spaltenkopf.** Je Stunde „3 offen · 2 frei“ (Bereitschaft, freigesetzt, Hohlstunde); ist mehr offen
  als frei, ist die Zahl bernsteinfarben. Darunter die Bereitschaften des Tages (eingesetzt durchgestrichen).
* **Abwesenheit aus der Übersicht.** Rechtsklick auf eine Klasse bzw. Zelle: Klasse ab dieser Stunde abwesend (Ausflug …),
  Lehrkraft ab dieser Stunde bzw. ganztägig abwesend, Abwesenheit entfernen – ohne Umweg über ein Formular.
* **Pläne als Miniplan.** Statt fester Bereiche kleine, frei verschiebbare Fenster (Klasse, Lehrkraft, Raum; Tag oder
  Woche), die an den Rändern einschnappen, sich auf die Titelzeile einklappen lassen, gemerkt werden und auf Wunsch der
  Auswahl folgen. In der Klassenübersicht zeigt der Miniplan standardmäßig die Lehrkraft (die Klasse steht als Zeile da).
* **Lehrkräfte als zweite Sicht** derselben Matrix (abwesende zuerst; vertretene Stunden „→ SRO“).
* Die frühere Liste bleibt als *Offene Stunden*, die Tabelle als *Tabelle*.

## Quellen

1. Untis-Hilfe „Substitution suggestion“: https://www.untis.at/HTML/WebHelp/uk/untis/vp_vertretungsvorschlag.htm
2. Untis-Hilfe „Shift substitutions“: https://webhelp.untis.at/HTML/WebHelp/uk/untis/vp_vertretungsverlegung.htm
3. Untis-Hilfe „Shifts and cancellations“: https://webhelp.untis.at/HTML/WebHelp/uk/untis/vp_stundenverschiebungen_und_entf.htm
4. Untis, Zusammenfassung AWT 2022 (Vertretungszähler): https://www.untis.at/fileadmin/user_upload/2022_AWT_Themen-Zusammenfassung.pdf
5. Stüber Systems, DaVinci Substitution Plan: https://www.stueber.de/en/davinci/davinci-substitutions.php
6. Stüber Systems, DaVinci Look: https://www.stueber.de/en/davinci/davinci-look.php
7. aSc TimeTables, Online-Hilfe Vertretungen: https://help.asctimetables.com/text.php?id=1020 und https://help.asctimetables.com/pdf/asc_substitutions_en_P1.pdf
8. EduPage, Stundenplan und Vertretungen: https://www.edupage.org/timetables_de.html
9. Indiware, Handreichung online und mobil: https://www.indiware.de/service/daten/Handreichung%20Indiware%20online%20und%20mobil%20V6.pdf
10. Indiware, Handreichung V7 (Betatester): https://www.indiware.de/service/daten/Handreichung%20V7%20Betatester%20Sp.pdf
11. Indiware, Schulung Vertretungsplan 2025: https://www.indiware.de/service/daten/2025_SchulungVp.pdf
12. Vertretungskonzept eines Bremer Gymnasiums (Arten von Abwesenheit, Einsatz der Software): https://309.sixcms.schule.bremen.de/sixcms/media.php/13/Vertretungskonzept%20Gymnasium%20Horn%20Stand%202026%20-%20Version%20Homepage.pdf
13. Übersicht von Werkzeugen zur Vertretungsplanung (Anbieterseite, kritisch gelesen): https://www.ki-syndikat.de/usecases/bildung/19-vertretungsplanung/
14. Offene Anzeige-Apps: https://github.com/Skn0tt/vplan, https://f-droid.org/packages/io.vertretungsplan.client.android/
