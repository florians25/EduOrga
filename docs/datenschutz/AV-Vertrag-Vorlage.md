# Auftragsverarbeitung (Art. 28 DSGVO) – unverbindliche Gliederung für den Betrieb von EduOrga

> **Unverbindliche Vorlage, kein Rechtsrat.** Sie soll Schule und Betreiber (Schulträger, kommunales Rechenzentrum,
> IT-Dienstleister) helfen, an alle Punkte von Art. 28 Abs. 3 DSGVO zu denken. Verwenden Sie bevorzugt die
> Mustervereinbarungen Ihres Schulträgers bzw. der Aufsichtsbehörde und lassen Sie den Vertrag von der bzw. dem
> Datenschutzbeauftragten und ggf. der Rechtsabteilung des Schulträgers prüfen. Ob der Schulträger im konkreten Fall
> Auftragsverarbeiter ist oder eigene Aufgaben nach § 122 SchulG NRW wahrnimmt, ist **zu prüfen**.
> Der Hersteller von EduOrga ist **nicht** Auftragsverarbeiter: Er betreibt keine Server und hat keinen Zugriff auf Daten.

**Vertrag über die Verarbeitung personenbezogener Daten im Auftrag**

zwischen **[Schule, Anschrift]**, vertreten durch [Schulleitung] – *Verantwortlicher* –
und **[Betreiber, Anschrift]** – *Auftragsverarbeiter* –

## § 1 Gegenstand und Dauer

1. Gegenstand: Bereitstellung und Betrieb der Software EduOrga (EduOrga Studio, EduOrga Web, EduOrga Mobile) auf
   [Server/Standort] einschließlich Installation, Updates, Sicherungen und Störungsbehebung.
2. Dauer: ab [Datum] bis [Datum/unbefristet, Kündigung mit Frist von …]; Regelungen zur Rückgabe/Löschung siehe § 10.

## § 2 Art, Zweck, Daten, Betroffene

1. Art der Verarbeitung: Speicherung, Sicherung, Wiederherstellung, technischer Betrieb; **keine** inhaltliche Nutzung.
2. Zweck: Erfüllung des Bildungs- und Erziehungsauftrags der Schule (Stunden-/Vertretungsplan, digitales Klassenbuch,
   Kommunikation, Sprechtag, Buchungen).
3. Datenkategorien und Betroffene: siehe Verzeichnis der Verarbeitungstätigkeiten (Anlage 1, Vorlage
   [`VERZEICHNIS.md`](VERZEICHNIS.md)), insbesondere Daten Minderjähriger und Gesundheitsangaben (Art. 9 DSGVO) bei
   Fehlzeiten, Entschuldigungen und Befreiungen.

## § 3 Weisungen

1. Verarbeitung nur auf dokumentierte Weisung des Verantwortlichen (Art. 28 Abs. 3 Buchst. a); Weisungsberechtigte:
   [Namen]; Weisungsempfänger: [Namen]. Hält der Auftragsverarbeiter eine Weisung für rechtswidrig, informiert er unverzüglich.
2. Zugriffe auf Inhalte (z. B. Datenbank öffnen, Sicherungen einspielen, Passwort zurücksetzen mit `passwort.sh`) nur
   auf Weisung im Einzelfall; Dokumentation [wie].

## § 4 Vertraulichkeit

Eingesetzte Personen sind zur Vertraulichkeit verpflichtet (Art. 28 Abs. 3 Buchst. b) und im Datenschutz unterwiesen.

## § 5 Technische und organisatorische Maßnahmen

Maßnahmen nach Art. 32 gemäß Anlage 2 (Vorlage [`TOM.md`](TOM.md), Abschnitt B ausgefüllt), mindestens: Server in der
EU, Festplattenverschlüsselung, HTTPS mit HSTS, Firewall, zeitnahe Sicherheitsupdates von Betriebssystem, Docker und
EduOrga, verschlüsselte Sicherungen mit getrennt verwahrtem Schlüssel, Wiederherstellungstest [Intervall],
begrenzte Server-Protokolle [Frist]. Änderungen nur, wenn das Schutzniveau nicht sinkt; wesentliche Änderungen werden
mitgeteilt.

## § 6 Unterauftragsverarbeiter

1. Weitere Auftragsverarbeiter nur mit vorheriger [gesonderter/allgemeiner] schriftlicher Genehmigung (Art. 28 Abs. 2, 4).
2. Genehmigt: [z. B. Rechenzentrum/Hoster – Name, Ort, Leistung] bzw. „keine“.
3. Keine Verarbeitung außerhalb der EU/des EWR ohne Genehmigung und Garantien nach Kapitel V DSGVO. Hinweis: Nutzt die
   Schule Sofort-Benachrichtigungen, werden Gerätekennungen und eine allgemeine Nachricht an Apple bzw. die Push-Dienste
   der Browser übermittelt – Bewertung durch den Verantwortlichen (**zu prüfen**).

## § 7 Unterstützung des Verantwortlichen

1. Bei Anträgen Betroffener (Art. 15–22): Unterstützung, z. B. Bereitstellung von Auskünften aus Sicherungen; die
   Funktionen in EduOrga (Auskunft, Löschung, Fristen) bedient die Schule selbst.
2. Bei Art. 32–36: Informationen zu TOM, Unterstützung bei DSFA und Konsultation.
3. **Datenpannen**: Meldung an [Kontakt der Schule] unverzüglich, spätestens innerhalb von [24] Stunden nach
   Kenntnis, mit den Angaben nach Art. 33 Abs. 3, damit die Schule die Frist von 72 Stunden einhalten kann.

## § 8 Kontrollen

Der Verantwortliche bzw. die/der DSB darf die Einhaltung prüfen (Art. 28 Abs. 3 Buchst. h) – Auskünfte, Nachweise,
nach Anmeldung Vor-Ort-Kontrollen [Regelung].

## § 9 Haftung

[nach den Vorgaben des Schulträgers; Art. 82 DSGVO bleibt unberührt]

## § 10 Ende des Auftrags

Nach Ende des Auftrags nach Wahl des Verantwortlichen Rückgabe (Datenbank-Export bzw. Sicherung) und anschließende
Löschung aller Daten einschließlich Sicherungen [Frist], schriftliche Bestätigung (Art. 28 Abs. 3 Buchst. g).
Technisch: Sicherung mit `./update.sh --nur-sichern`, Übergabe, danach `docker compose down -v` und Löschen von
`./sicherungen` und externen Sicherungskopien.

## Anlagen

1. Verzeichnis der Verarbeitungstätigkeiten (Auszug)
2. Technische und organisatorische Maßnahmen
3. Unterauftragsverarbeiter
4. Weisungsberechtigte und Ansprechpersonen

[Ort, Datum, Unterschriften]
