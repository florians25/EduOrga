# Recherche: Deputat und Unterrichtsverteilung in Nordrhein-Westfalen

Stand der Recherche: 20.10.2026 (Schuljahr 2026/27, Werte aus den Fassungen 2025/26 und 2026/27). Grundlage für
`src/UntPlan.Core/Module/Deputat.cs` (Landesprofil „NW“) und den Arbeitsbereich **Deputat und Unterrichtsverteilung** im Studio.

Die amtlichen Seiten (bass.schule.nrw, schulministerium.nrw, recht.nrw.de) waren aus der Arbeitsumgebung nicht direkt
abrufbar. Die Werte stammen aus Suchergebnissen mit Auszügen dieser Seiten sowie aus Handreichungen von
Bezirksregierungen und Verbänden (Quellen unten). Alles, was nicht aus mindestens zwei übereinstimmenden Quellen stammt,
ist mit **(unsicher)** markiert. **Vor dem Einsatz an einer Schule gegen die aktuelle BASS prüfen** – alle Werte sind im
Programm Voreinstellungen und lassen sich je Lehrkraft bzw. je Schule überschreiben.

## 1. Rechtsgrundlagen

| Thema | Vorschrift | Fundstelle |
|---|---|---|
| Pflichtstunden, Ermäßigungen, Anrechnungsstunden, Leitungszeit, Stellenberechnung | Verordnung zur Ausführung des § 93 Abs. 2 Schulgesetz (VO zu § 93 Abs. 2 SchulG, kurz AVO) | BASS 11-11 Nr. 1 |
| Verwaltungsvorschriften dazu | AVO-Richtlinien 2026/2027 (AVO-RL) | BASS 11-11 Nr. 1.1 |
| Mehrarbeit | Runderlass Mehrarbeit und nebenamtlicher Unterricht im Schuldienst; MVergV | BASS 21-22 Nr. 21 (bzw. 21-22 Nr. 2.1) |
| Stundentafeln Sek I | Ausbildungs- und Prüfungsordnung Sekundarstufe I (APO-S I) mit Anlagen; VVzAPO-S I | BASS 13-21 Nr. 1.1 / 1.2 |
| Gymnasiale Oberstufe | APO-GOSt (Kursarten GK/LK/ZK/VTF/PJK) | BASS 13-32 Nr. 3.1 |
| Verteilung der Anrechnungsstunden | § 68 SchulG: Schulleitung entscheidet nach Grundsätzen der Lehrerkonferenz | SchulG NRW |

## 2. Wöchentliche Pflichtstunden (§ 2 Abs. 1 AVO)

| Schulform | Pflichtstunden | im Programm |
|---|---|---|
| Grundschule | 28 | GS 28 |
| Hauptschule | 28 | HS 28 |
| Realschule | 28 | RS 28 |
| Sekundarschule | 25,5 | SK 25,5 |
| Gymnasium | 25,5 | GY 25,5 |
| Gesamtschule | 25,5 | GE 25,5 |
| Berufskolleg | 25,5 (Werkstattlehrkräfte 30) | BK 25,5, je Lehrkraft „Pflichtstd.“ = 30 |
| Förderschule, Schule für Kranke | 27,5 | FS 27,5 |
| Weiterbildungskolleg | Abendrealschule 25, Abendgymnasium und Kolleg 22 | WB 25, je Lehrkraft 22 eintragbar |
| PRIMUS-Schule | (unsicher) – nicht gesondert gefunden | PS 25,5 als Voreinstellung |

* Für die Schulformen mit Bruchteilen (Nr. 4–9 der Tabelle) wird die Pflichtstundenzahl über einen Zeitraum von drei
  Schuljahren auf- und abgerundet (abwechselnd 25 / 26), damit im Mittel 25,5 erreicht werden. Das GEW-Bildungslexikon
  nennt zwei Schuljahre; maßgeblich ist der AVO-Text (drei Schuljahre). **Im Programm:** 25,5 als Rechenwert; die
  tatsächliche Rundung im jeweiligen Schuljahr wird über „Mehrarbeit/Vorgriff“ (+0,5 / −0,5) oder abweichende
  Pflichtstunden je Lehrkraft abgebildet.
* Aus schulorganisatorischen Gründen darf die Unterrichtsverpflichtung vorübergehend um bis zu sechs Stunden
  (für bis zu sechs Monate bzw. ein Schulhalbjahr) über- oder unterschritten werden; der Ausgleich erfolgt später
  (Änderung 2018/19). **Im Programm:** Feld „Mehrarbeit/Vorgriff“ (positiv = mehr, negativ = Ausgleich).
* Die KMK-Übersicht „Pflichtstunden der Lehrkräfte 2025/2026“ bestätigt die Werte.

## 3. Teilzeit

* Teilzeit wird als Stundenzahl je Woche vereinbart (z. B. 19,5 von 25,5). Der Anteil = Stunden / Pflichtstunden steuert
  die Ermäßigungsstufen (≥ 50 %, ≥ 75 %, Vollzeit).
* „Wird die Zahl der Pflichtstunden um nicht mehr als eine Stunde verringert, wird die volle Ermäßigung gewährt“
  (§ 2 Abs. 8 AVO laut „Schule NRW von A bis Z“) **(unsicher in der genauen Reichweite)**. **Im Programm:** Umfang ≥
  Pflichtstunden − 1 zählt für die Ermäßigungen als Vollzeit.
* Eingabe im Programm: Spalte „Umfang“ akzeptiert Stunden („19,5“), „Vollzeit“ oder Prozent („75 %“).

## 4. Altersermäßigung (§ 2 Abs. 2 AVO)

| ab Vollendung des | Vollzeit | Teilzeit ≥ 75 % | Teilzeit ≥ 50 % | unter 50 % |
|---|---|---|---|---|
| 55. Lebensjahres | 1 | 0,5 | 0,5 | – |
| 60. Lebensjahres | 3 | 2 | 1,5 | – |

* **Beginn:** „vom Beginn des Schuljahres an, das auf die Vollendung des 55. bzw. 60. Lebensjahres folgt“.
  Beispiele der Bezirksregierung Münster: geb. 25.07.1957 → ab 01.08.2012; geb. 02.08.1957 → ab 01.08.2013.
  Das Schuljahr beginnt am 1. August; ein Lebensjahr ist mit Ablauf des Tages vor dem Geburtstag vollendet (geb. 01.08.
  → vollendet am 31.07. → Ermäßigung ab diesem 1. August). **Im Programm:** `Deputat.Vollendet` (Unit-Tests mit
  diesen Beispielen).
* Ist nur das Geburtsjahr bekannt, gilt die Ermäßigung erst, wenn das Lebensjahr sicher im Vorjahr vollendet wurde;
  das Programm weist im Grenzjahr darauf hin.
* Altersteilzeit: Während der Altersteilzeit entfällt die Ermäßigung ab 60 (§ 2 Abs. 2 Satz 3); bei früherem Beginn
  Verzicht auf die Ermäßigung ab 55 für höchstens fünf Schuljahre (Satz 4). **Im Programm:** Schalter
  „Ohne Altersermäßigung“ (Kontextmenü der Lehrkraft).
* Die 1,5-Stunden-Stufe (ab 60, mindestens 50 %) nennen GEW-Material und Ministeriumsseite übereinstimmend.

## 5. Ermäßigung bei Schwerbehinderung (§ 2 Abs. 3 AVO)

| Grad der Behinderung | Vollzeit | Teilzeit ≥ 75 % | Teilzeit ≥ 50 % |
|---|---|---|---|
| ab 50 | 2 | 1,5 **(unsicher)** | 1 |
| ab 70 | 3 | 2 | 1,5 |
| ab 90 | 4 | 3 | 2 |

* Die Ermäßigung gilt unabhängig von der Altersermäßigung (beide werden addiert).
* Die Dienstvorgesetzten können die Ermäßigung in besonderen Fällen befristet um bis zu vier Stunden erhöhen
  (GEW Wuppertal) – im Programm als zusätzlicher Eintrag „Ermäßigung“.
* Gleichgestellte (GdB 30/40) erhalten keine Pflichtstundenermäßigung nach dieser Tabelle **(unsicher)**.
* **Im Programm:** Spalte „GdB“; ein Eintrag mit „Schwerbehinderung“ im Grund ersetzt die Berechnung.

## 6. Anrechnungsstunden („Anrechnungstopf“, § 2 Abs. 5 AVO)

Allgemeine Anrechnungsstunden je Stelle (Grundstellen der Schule × Faktor, gerundet):

| Schulform | je Stelle |
|---|---|
| Grundschule | 0,2 |
| Hauptschule | 0,6 |
| Realschule, Sekundarschule, Gymnasium Sek I, Gesamtschule Sek I | 0,5 |
| Gymnasium und Gesamtschule Sek II | 1,2 |
| Förderschule (alle Förderschwerpunkte), Schule für Kranke | 0,4 |
| Weiterbildungskolleg | 1,0 |
| Berufskolleg | je Bildungsgang: Berufsschule 0,5, Fachschule 1,0, Berufsfachschule/Fachoberschule 1,2 **(unsicher, ältere Fassung)** |

* Rechenbeispiel aus „Schule NRW von A bis Z“: 28,5 Grundstellen × 0,5 = 14,25 → 14 Anrechnungsstunden.
* Die Grundstellen ergeben sich aus Schülerzahl / Schüler-Lehrer-Relation (§ 7 AVO, z. B. Realschule 404 / 20,19); die
  Schule kennt sie aus der Stellenberechnung (SchIPS-Schulmitteilung). **Im Programm:** Einstellungen → „Grundstellen“
  und „Grundstellen Sek II“; ohne Eintrag wird aus der Summe der Beschäftigungsumfänge geschätzt (Hinweis in der Kopfzeile).
  Berufskolleg vereinfacht: Grundstellen × 0,5 + „Sek II“-Feld × 1,2. Der Topf kann von Hand überschrieben werden.
* Über die Verteilung entscheidet die Schulleitung nach Grundsätzen der Lehrerkonferenz (§ 68 SchulG).

## 7. Leitungszeit (§ 5 AVO)

`Leitungszeit = 9 + 0,7 × Stellen (bis zur 50. Stelle) + 0,3 × jede weitere Stelle`, Bruchteile unter 0,5 ab-, sonst
aufgerundet; Grundschulen + 2 Wochenstunden je Schule, offene Ganztagsschulen im Primarbereich zusätzlich + 1.
Grundlage sind die Grundstellen einschließlich Ganztagszuschlag und Mehrbedarfe. Die Schulleitung verteilt die
Leitungszeit auf die Mitglieder der Schulleitung. Beispiele (eigene Rechnung): Grundschule 12 Stellen → 19; Gymnasium
40 Stellen → 37; 60 Stellen → 47. **Im Programm:** `Deputat.LeitungszeitNrw`, Einträge der Art „Leitungszeit“ zählen
gegen diese Summe.

## 8. Mehrarbeit, Vorgriffsstunden, Arbeitszeitkonto

* Mehrarbeit wird im Schuldienst in der Regel vergütet (BASS 21-22 Nr. 21, MVergV). Vollzeitkräfte: vergütet, wenn im
  Kalendermonat mehr als drei Unterrichtsstunden Mehrarbeit anfallen (dann alle). Seit 2026 gilt die
  „Bagatellgrenze“ für Teilzeitkräfte anteilig zur Teilzeitquote (GEW-Bildungslexikon) **(unsicher im Detail)**. Die
  Abrechnung ist in der Vertretungsstatistik (Mehrarbeit NRW) umgesetzt; im Deputat geht es nur um **regelmäßige**
  Mehrarbeit je Woche.
* Vorgriffsstunden: Die historische Vorgriffsstunde (Lehrkräfte 30–50 Jahre) endete 2003/04. Derzeit gibt es eine
  Vorgriffsstunde mit Ausgleichskonto („wird dem Ausgleichskonto für den längerfristigen Freizeitausgleich zugeführt oder
  auf Antrag ausgezahlt“, KMK-Übersicht 2025/26) **(unsicher, Einzelheiten nicht verifiziert)**.
* Geplant (Gesetz zur Modernisierung des öffentlichen Dienstes, 2026 im Landtag): Lebensarbeitszeitkonto, Lehrkräfte
  erhalten eine Gutschrift von 0,5 Pflichtstunden je Woche, Altersstaffelung „angemessen berücksichtigt“ – Stand der
  Verabschiedung nicht bestätigt **(unsicher)**.
* **Im Programm:** Feld „Mehrarbeit/Vorgriff“ je Lehrkraft (Stunden je Woche, + erhöht das Soll, − Ausgleich).

## 9. Stundentafeln (APO-S I, APO-GOSt)

* Gymnasium G9, Sek I (Anlage 3a, ab 01.08.2021 aufwachsend ab Klasse 5): Kontingentstundentafel, 182 Stunden in den
  Klassen 5–10 zuzüglich bis zu 6 Ergänzungsstunden (höchstens 188); Wochenrahmen 28–30 (5/6) bzw. 30–33 (7–10).
  Kontingente (5/6 | 7–10): Deutsch 9 | 13, Mathematik 9 | 13, Englisch 9 | 13, Gesellschaftslehre 6 | 17,
  Naturwissenschaften 6 | 17, Informatik 2 | –, zweite Fremdsprache – | 15, Wahlpflicht 7–10: 6. Englisch und zweite
  Fremdsprache sind in den Auszügen nicht eindeutig lesbar **(unsicher)**; Kunst/Musik, Religion/Praktische
  Philosophie und Sport sind im Programm nicht hinterlegt. Schulbeispiele (Deutsch 22, Mathematik 22, Englisch 22 in 5–10)
  bestätigen 9 + 13.
* Andere Schulformen (Realschule, Gesamtschule, Sekundarschule, Hauptschule): eigene Anlagen der APO-S I – im Programm
  nicht als Kontingente hinterlegt; geprüft wird die **schulinterne** Stundentafel (Jahrgang × Fach) gegen den Unterricht.
* Oberstufe (APO-GOSt): Grundkurs 3, Leistungskurs 5, Vertiefungskurs 2, Projektkurs 2, Zusatzkurs 3 Wochenstunden
  (bereits in `Nrw.Kursarten`).
* Seit 2026/27: Fächer Wirtschaft und Informatik an allen Schulformen (BASS 13-21, Verordnung zur Einführung der Fächer
  Wirtschaft und Informatik) – betrifft die Kontingente; Fach-Kürzel WI/IF werden im Programm zugeordnet.

## 10. Unterrichtsverteilung, SchILD-NRW und ASD

* SchILD-NRW (bzw. SVWS-Server) importiert die Unterrichtsverteilung aus Stundenplanprogrammen über
  **„Unterrichts-Daten als UVD-TXT“** (Verwaltung → Import). Übernommen wird die „Grund-UVD“ des Halbjahres
  (klassenbezogen); individuelle Fach- und Kurszuweisungen folgen gesondert, Kurse der Sek II kommen meist aus der
  Kursplanung (LuPO/Kurs42).
* Nach Forenangaben erwartet der SchILD-Import eine Kopfzeile mit Feldern wie Klasse, Jahrgang, Kursart, Wochenstunden
  (WoStd), Fach, Lehrer, in Anführungszeichen und durch Semikolon getrennt. Eine amtliche Feldbeschreibung wurde nicht
  gefunden **(unsicher)**.
* Davon zu unterscheiden ist die UVD.TXT für die amtliche Schulstatistik (ASDPC): ohne Kopfzeile, Leerzeichen als
  Trenner, mit Schulnummer – nicht austauschbar.
* **Im Programm:** Ausgabe → „Unterrichtsverteilung als UVD.TXT (SchILD-NRW)“ mit Kopfzeile
  `"Klasse";"Jahrgang";"Kursart";"WoStd";"Fach";"Lehrer";"Kurs"`, eine Zeile je Kopplungszeile und Klasse. Die
  Spaltenfolge ist an die Forenangaben angelehnt und vor dem ersten Import an einer Testdatenbank zu prüfen; das
  ASDPC-Format wird nicht erzeugt. Zusätzlich gibt es die Deputatsübersicht als CSV (Semikolon, UTF-8 mit BOM) und PDF.

## 11. Begriffe

Deputat (Unterrichtsverpflichtung), Pflichtstunden, Beschäftigungsumfang, Ermäßigung (Alter, Schwerbehinderung),
Anrechnungsstunden (Topf), Leitungszeit, Mehrarbeit, Vorgriffsstunde, Grundstellen, Unterrichtsverteilung (UVD),
Lehrbefähigung (Fakultas), Kontingentstundentafel.

## Quellen

* BASS 11-11 Nr. 1, VO zu § 93 Abs. 2 SchulG: <https://bass.schule.nrw/6218.htm>, <https://bass.schule.nrw/Inhalt/6218.htm>, PDF <https://bass.schule.nrw/pdf/6218.pdf>
* BASS 11-11 Nr. 1.1, AVO-Richtlinien 2026/2027: <https://bass.schule.nrw/6219.htm>
* Änderungsverordnungen 2016/17 (Rundung) und 2018/19 (Abweichung bis 6 Stunden): <https://bass.schule.nrw/16163.htm>, <https://bass.schule.nrw/17921.htm>
* Schulministerium NRW, AVO (PDF): <https://www.schulministerium.nrw/system/files/media/document/file/avo.pdf>
* BASS-Stichwortverzeichnis Teilzeit/Pflichtstundenermäßigung: <https://bass.schule.nrw/Stichwort/Ebene5?Ebene1=T&Ebene2=TE&Ebene3=Teilzeitbesch%C3%A4ftigung&Ebene4=Pflichtstundenerm%C3%A4%C3%9Figung+%28%C2%A7+2+Abs.+2+und+3+AVO%29>
* KMK, Übersicht über die Pflichtstunden der Lehrkräfte 2025/2026: <https://www.kmk.org/fileadmin/Dateien/pdf/Statistik/Dokumentationen/Pflichtstunden_der_LehrerInnen_2025_2026.pdf>
* GEW NRW, Bildungslexikon Arbeitszeit: <https://bildungslexikon.gew-nrw.de/arbeitszeit>; Mehrarbeit: <https://bildungslexikon.gew-nrw.de/mehrarbeit>
* GEW Coesfeld, Altersermäßigung und Ermäßigung bei Schwerbehinderung 2025: <https://coesfeld.gew-nrw.de/fileadmin/Untergliederung/Coesfeld/GEWplus/Altersermaessigung_2025.pdf>
* GEW Wuppertal, kurz & knapp Altersermäßigung: <https://wuppertal.gew-nrw.de/fileadmin/Untergliederung/Wuppertal/Textdateien/kurz_und_knapp/GEW-Wuppertal-Altersermaessigung.pdf>; Leitungszeit: <https://wuppertal.gew-nrw.de/fileadmin/Untergliederung/Wuppertal/Textdateien/kurz_und_knapp/GEW-Wuppertal-Leitungszeit.pdf>
* GEW NRW, Schwerbehinderung – Infos und Tipps: <https://www.gew-nrw.de/fileadmin/user_upload/Themen_Wissen_PDFs/Arbeit_PDFs/Schwerbehinderung_PDFs/gew-schwerbehinderung-infos-und-tipps-fuer-paedagogisches-personal-pdf.pdf>
* Bezirksregierung Köln, Merkblatt Pflichtstundenermäßigung (Schwerbehinderung): <https://www.bezreg-koeln.nrw.de/system/files/media/document/file/schule_und_bildung_personalangelegenheiten_schwerbehindertenangelegenheiten_merkblatt_pflichtstundenermaessigung.pdf>
* Bezirksregierung Münster, Personalrat Förderschulen – Altersermäßigung (Beispiele zum Beginn): <https://www.bezreg-muenster.de/system/files/media/document/file/46_personalrat_foerderschule_alterermaessigung.pdf>; Pflichtstunden und Pflichtstundenermäßigung: <https://www.brms.nrw.de/themen/bildung-schule-und-sport/personalangelegenheiten/dienst-und-tarifrecht/pflichtstunden-und>
* lehrer nrw, „Schule NRW von A bis Z“ 2025/26 (Gesamtausgabe, Dienstrecht, Mehrarbeit): <https://lehrernrw.de/wp-content/uploads/Schule-von-A-Z-2025-01-gesamtausgabe-schule-nrw-von-a-bis-z-2025-26-mit-lesezeichen-stand-1-8-25.pdf>, <https://lehrernrw.de/wp-content/uploads/Schule-von-A-Z-2025-01-mehrarbeit-2025-mit-lesezeichen-stand-1-8-25.pdf>
* Seiteneinstieg in den Schuldienst (Pflichtstunden Weiterbildungskolleg): <https://msb.xn--broschren-v9a.nrw/seiteneinstieg-in-den-schuldienst/fragen-zum-unterricht>
* Landesamt für Besoldung und Versorgung NRW, Regelmäßige Arbeitszeit / Pflichtstunden: <https://www.finanzverwaltung.nrw.de/sites/default/files/asset/document/regelmaessige_arbeitszeit_pflichtstunden_lehrer_abt5_lbv.pdf>
* Finanzministerium NRW, Gesetz zur Modernisierung des öffentlichen Dienstes: <https://www.finanzverwaltung.nrw.de/uebersicht-rubrik-aktuelles-und-presse/pressemitteilungen/landesregierung-bringt-gesetz-zur>; GEW NRW dazu: <https://www.gew-nrw.de/fileadmin/user_upload/Themen_Wissen_PDFs/Arbeit_PDFs/Beamt_innenrecht_PDFs/gew-nrw_modernisierungsoffensive_2026.pdf>
* Stundentafel G9 Sek I, Anlage 3a: <https://www.schulministerium.nrw/system/files/media/document/file/Stundentafel_SI_G9_Anlage_3a_ab_210801_neu_ab_Klasse5.pdf>; Weiterentwicklung G8/G9: <https://www.schulministerium.nrw/weiterentwicklung-des-gymnasiums-g8g9>; VVzAPO-S I: <https://bass.schule.nrw/13199.htm>; APO-S I: <https://bass.schule.nrw/12691.htm>; Wirtschaft und Informatik: <https://bass.schule.nrw/19173.htm>
* Schulbeispiel Stundentafel G9: <https://www.gymnasium-zitadelle.de/unterricht/sekundarstufe-i/stundentafel-g9/>
* SchILD-NRW/SVWS: Unterrichts-Daten als UVD-TXT: <https://schulverwaltungsinfos.nrw.de/svws/wiki/index.php?title=Unterrichts-Daten_als_UVD-TXT_%28Verwaltung_Import%29>; UVD-Datei importieren: <https://wiki.svws.nrw.de/mediawiki/index.php?title=UVD-Datei_importieren>; Forum „Import einer UVD.txt“: <https://schulverwaltungsinfos.nrw.de/svws/forum/viewtopic.php?p=40947>; Statistik mit ASDPC: <https://wiki.svws.nrw.de/mediawiki/index.php?title=Statistik_mit_ASDPC_Vorbereitung>
