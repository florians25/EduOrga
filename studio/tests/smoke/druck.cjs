// Oberflächentest der Module Einstellungen, Gesamtübersichten, Druck und Planformate (Playwright, Chromium).
//
//   NODE_PATH=$(npm root -g) STUDIO_URL=http://127.0.0.1:5501 STUDIO_PASSWORT=geheim123 node studio/tests/smoke/druck.cjs
//
// Ablauf: Beispielschule → Einstellungen (Schuldaten ändern und übernehmen) → Zeitraster (Zellen markieren, Pausen) →
// Kalender und Ferien → Perioden → Unterrichtsgruppe anlegen → Gesamtübersichten → Druckauswahl mit Seitenansicht (PDF) und
// HTML-Ausgabe → Berichte → Planformat aus Vorlage mit Feld-Editor → Vertretungsplan-Ausgabe. Umgebungsvariablen: hilfe.cjs.
const h = require('./hilfe.cjs');

(async () => {
  const cookie = await h.apiAnmelden();
  await h.beispielschule(cookie); // wird „zuletzt geöffnet“
  const t = await h.starten('studio-shots-druck');
  const { page, foto } = t;

  await h.abschliessen('Oberflächentest Druck und Einstellungen', t, async () => {
    await h.anmelden(page);
    await h.dokumentOffen(page);

    // Einstellungen (Schuldaten): Abschnitt Vertretungsplanung, dann Schulbezeichnung ändern und übernehmen
    await h.eintrag(page, 'start.einstellungen');
    await page.waitForSelector('[data-ansicht="einstellungen.schule"] .es-formular input');
    await page.click('.es-knoten[data-seite=Vertretungsplanung]');
    await page.waitForSelector('.es-gewichtung [role=slider], .es-gewichtung input[type=range]');
    await foto('01-einstellungen');
    await page.click('.es-knoten[data-seite=Allgemein]');
    const name = page.locator('[data-ansicht="einstellungen.schule"] .es-formular input').first();
    await name.fill('Städtisches Beispiel-Gymnasium Smoke');
    await h.werkzeug(page, 'einstellungen.schule', 'Übernehmen');
    await page.waitForSelector('[data-ansicht="einstellungen.schule"] footer:has-text("Übernommen")');

    // Zeitraster: letzte Zelle markieren und leeren, Reiter Pausen
    await h.eintrag(page, 'eingabe.zeitraster');
    await page.waitForSelector('.es-zr .es-zr-zelle');
    await page.locator('.es-zr .es-zr-zelle').last().dispatchEvent('pointerdown');
    await page.click('.es-eintragung button:has-text("Leer")');
    await page.waitForSelector('[data-ansicht="einstellungen.zeitraster"] footer:has-text("Geändert")');
    await foto('02-zeitraster');
    await page.getByRole('tab', { name: 'Pausen' }).click();
    await page.waitForSelector('[data-ansicht="einstellungen.zeitraster"] .es-liste');
    await foto('03-zeitraster-pausen');
    await h.werkzeug(page, 'einstellungen.zeitraster', 'Verwerfen');

    // Kalender und Ferien: Tag wählen
    await h.eintrag(page, 'eingabe.ferien');
    await page.waitForSelector('.es-monat td.tag');
    await page.locator('.es-monat td.schultag').nth(20).click();
    await page.waitForSelector('.es-tag b');
    await foto('04-kalender-ferien');

    // Perioden und Unterrichtsgruppen
    await h.eintrag(page, 'start.perioden');
    await page.waitForSelector('.es-perioden-liste tr.gewaehlt');
    await foto('05-perioden');
    await h.eintrag(page, 'eingabe.ugruppen');
    await page.waitForSelector('[data-ansicht="einstellungen.ugruppen"] .es-liste');
    const neu = page.locator('[data-ansicht="einstellungen.ugruppen"] input[placeholder="Neue Gruppe"]');
    await neu.fill('A-Wo');
    await neu.press('Tab');
    await page.waitForFunction(() => [...document.querySelectorAll('[data-ansicht="einstellungen.ugruppen"] input')].some((i) => i.value === 'A-Wo' && i.placeholder !== 'Neue Gruppe'));
    await foto('06-unterrichtsgruppen');

    // Gesamtübersichten
    await h.eintrag(page, 'stundenplaene.uebersicht.lehrer');
    await page.waitForSelector('[data-ansicht=uebersicht] .ue-zelle');
    await foto('07-lehrer-uebersicht');
    await h.eintrag(page, 'stundenplaene.uebersicht.raum');
    await page.waitForFunction(() => document.querySelector('[data-ansicht=uebersicht] .ue-ecke')?.textContent === 'Räume');
    await page.waitForSelector('[data-ansicht=uebersicht] .ue-zelle');
    await foto('08-raum-uebersicht');

    // Druckauswahl → Seitenansicht (PDF) und HTML-Ausgabe
    await h.eintrag(page, 'stundenplaene.drucken');
    await page.waitForSelector('.dr-element');
    await foto('09-druckauswahl');
    const [antwort] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/druck/stundenplaene') && r.status() === 200),
      h.werkzeug(page, 'druck.auswahl', 'Seitenansicht'),
    ]);
    if (!(antwort.headers()['content-type'] || '').includes('application/pdf')) throw new Error('Keine PDF-Antwort');
    await page.waitForSelector('[data-ansicht="druck.vorschau"] iframe');
    await foto('10-druckvorschau');
    await page.goBack();
    await page.waitForSelector('.dr-element');
    await h.werkzeug(page, 'druck.auswahl', 'HTML-Ausgabe');
    await page.waitForSelector('[data-ansicht="druck.vorschau"] iframe');
    await page.waitForTimeout(1000);
    await foto('10b-html-ausgabe');

    // Berichte
    await h.eintrag(page, 'stundenplaene.berichte');
    await page.waitForSelector('.dr-bericht.aktiv');
    await page.waitForTimeout(600);
    await foto('11-berichte');

    // Planformate: Format aus Vorlage anlegen, zwei Felder im Feld-Editor, speichern
    await h.eintrag(page, 'stundenplaene.formate');
    await page.waitForSelector('.fm-liste');
    await h.werkzeug(page, 'formate.editor', 'Neues Format');
    await page.fill('[role=dialog] input[name=neu]', 'Klasse Smoke');
    await h.dialogKnopf(page, 'Anlegen');
    await page.waitForSelector('.fm-eintrag.aktiv:has-text("Klasse Smoke")');
    await page.getByRole('tab', { name: 'Stundenfeld' }).click();
    await page.click('button:has-text("Feld hinzufügen")');
    await page.click('button:has-text("Feld hinzufügen")');
    await h.werkzeug(page, 'formate.editor', 'Speichern');
    await page.waitForSelector('[data-ansicht="formate.editor"] footer:has-text("Gespeichert")');
    await foto('12-planformate');

    // Vertretungsplan-Ausgabe
    await h.eintrag(page, 'vertretung.ausgabe');
    await page.waitForSelector('.dr-felder');
    await page.waitForTimeout(800);
    await foto('13-vertretungsplan-ausgabe');
  });
})().catch((e) => { console.error(e); process.exit(1); });
