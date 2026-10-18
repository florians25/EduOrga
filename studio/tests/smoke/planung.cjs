// Oberflächentest der Module Planung, Optimierung und Zeitwünsche (Playwright, Chromium).
//
//   NODE_PATH=$(npm root -g) STUDIO_URL=http://127.0.0.1:5501 STUDIO_PASSWORT=geheim123 node studio/tests/smoke/planung.cjs
//
// Ablauf: Beispielschule → Klassenplan: Stunde wählen, Kontextmenü, Mehrfachauswahl (Strg+Klick), Ziehen mit Zielstatus
// (dnd-kit) → Raum zuordnen → Tauschvorschläge → Diagnose → Gewichtung → Zeitwünsche malen → Optimierung starten, Ergebnis,
// Vergleich, Plan übernehmen → schmales Fenster. Umgebungsvariablen: hilfe.cjs.
const h = require('./hilfe.cjs');

(async () => {
  const cookie = await h.apiAnmelden();
  await h.beispielschule(cookie); // wird „zuletzt geöffnet“
  const t = await h.starten('studio-shots-planung');
  const { page, foto } = t;
  const plan = '[data-ansicht=stundenplan]';

  await h.abschliessen('Oberflächentest Planung', t, async () => {
    await h.anmelden(page);
    await h.dokumentOffen(page);

    // Klassenplan
    await h.eintrag(page, 'stundenplaene.klasse');
    await page.waitForSelector(`${plan} .ra-eintrag`);
    await foto('01-klassenplan');
    const stunde = page.locator(`${plan} .ra-eintrag:not(.gekoppelt)`).first();
    await stunde.click();
    await stunde.click({ button: 'right' });
    await page.waitForSelector('[role=menu] [role=menuitem]');
    await foto('02-kontextmenue');
    await page.keyboard.press('Escape');

    // Mehrfachauswahl
    await page.locator(`${plan} .ra-eintrag:not(.gekoppelt)`).nth(3).click({ modifiers: ['Control'] });
    const markiert = await page.locator(`${plan} .ra-eintrag.markiert, ${plan} .ra-eintrag.gewaehlt`).count();
    if (markiert < 2) throw new Error(`Mehrfachauswahl: ${markiert} markiert`);
    await foto('03-mehrfachauswahl');
    await page.keyboard.press('Escape');

    // Ziehen: Zielstatus der Felder wird angezeigt, Esc bricht ab
    const quelle = page.locator(`${plan} .ra-eintrag.ziehbar`).first();
    const q = await quelle.boundingBox();
    const ziel = await page.locator(`${plan} .ra-feld`).last().boundingBox();
    await page.mouse.move(q.x + q.width / 2, q.y + q.height / 2);
    await page.mouse.down();
    await page.mouse.move(q.x + q.width / 2 + 20, q.y + q.height / 2 + 10, { steps: 4 });
    await page.mouse.move(ziel.x + ziel.width / 2, ziel.y + ziel.height / 2, { steps: 12 });
    await page.waitForFunction((s) => document.querySelectorAll(`${s} .ra-feld[class*="ziel-"]`).length > 0, plan, { timeout: 10000 });
    await foto('04-ziehen-zielstatus');
    await page.keyboard.press('Escape');
    await page.mouse.up();

    // Raum zuordnen (zur gewählten Stunde)
    await stunde.click();
    await h.eintrag(page, 'planung.raum');
    await page.waitForSelector('[role=dialog] table tbody tr');
    await page.waitForTimeout(400);
    await foto('05-raum-zuordnen');
    await h.dialogKnopf(page, 'Schließen');

    // Tauschvorschläge
    await stunde.click();
    await h.eintrag(page, 'planung.tausch');
    await page.waitForSelector('[role=dialog]:has-text("Tauschvorschläge")');
    await page.waitForFunction(() => document.querySelector('[role=dialog]') && !document.querySelector('[role=dialog] [role=progressbar], [role=dialog] .fui-Spinner'), null, { timeout: 30000 });
    await foto('06-tauschvorschlaege');
    await page.keyboard.press('Escape');

    // Diagnose
    await h.eintrag(page, 'planung.diagnose');
    await page.waitForSelector('[data-ansicht="optimierung.diagnose"] [role=option]');
    await page.locator('[data-ansicht="optimierung.diagnose"] [role=tab]', { hasText: 'Stundenplan' }).click();
    await foto('07-diagnose');

    // Gewichtung
    await h.eintrag(page, 'planung.gewichtung');
    await page.waitForSelector('[role=dialog] [role=slider], [role=dialog] input[type=range]');
    await foto('08-gewichtung');
    await page.locator('[role=dialog] [role=tab][value=Verteilung]').click();
    await foto('08b-gewichtung-verteilung');
    await page.keyboard.press('Escape');

    // Zeitwünsche malen
    await h.eintrag(page, 'eingabe.zeitwuensche');
    await page.waitForSelector('.zw-tabelle td[data-tag]');
    await page.click('.zw-wertknopf.zw-w-3');
    const a = await page.locator('.zw-tabelle td[data-tag="0"][data-spalte="5"]').boundingBox();
    const b = await page.locator('.zw-tabelle td[data-tag="0"][data-spalte="7"]').boundingBox();
    await page.mouse.move(a.x + 5, a.y + 5);
    await page.mouse.down();
    await page.mouse.move(b.x + 5, b.y + 5, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(600);
    await page.click('.zw-wertknopf.zw-w2');
    await page.click('.zw-tabelle td[data-tag="2"][data-spalte="0"]');
    await page.waitForTimeout(500);
    const gesetzt = await page.locator('.zw-tabelle td.zw-w-3').count();
    if (gesetzt < 3) throw new Error(`Zeitwünsche: ${gesetzt} Felder −3`);
    await foto('09-zeitwuensche');

    // Optimierung: Verfahren A, drei Pläne
    await h.eintrag(page, 'planung.optimierung');
    await page.waitForSelector('[data-ansicht="optimierung.lauf"]');
    await h.werkzeug(page, 'optimierung.lauf', 'Neue Optimierung');
    await page.waitForSelector('[role=dialog]:has-text("Optimierung starten") select');
    await page.locator('[role=dialog] select').first().selectOption('A');
    await page.locator('[role=dialog] input[type=number]').first().fill('3');
    await foto('10-steuerdaten');
    await h.dialogKnopf(page, 'Optimierung starten');
    await page.waitForTimeout(500);
    await foto('11-optimierung-laeuft');
    const uebernehmenKnopf = page.locator('[data-ansicht="optimierung.lauf"] [role=toolbar] button', { hasText: 'Plan übernehmen' });
    await page.waitForFunction(() => {
      const k = [...document.querySelectorAll('[data-ansicht="optimierung.lauf"] [role=toolbar] button')].find((x) => x.textContent.includes('Plan übernehmen'));
      return k && !k.disabled && k.getAttribute('aria-disabled') !== 'true';
    }, null, { timeout: 180000 });
    await foto('12-optimierung-ergebnis');
    await h.werkzeug(page, 'optimierung.lauf', 'Vergleich');
    await page.waitForSelector('[data-ansicht="optimierung.lauf"] .ra-eintrag', { timeout: 15000 });
    await page.waitForTimeout(400);
    await foto('13-ergebnisvergleich');
    await uebernehmenKnopf.click();
    await page.waitForSelector('[data-ansicht="optimierung.lauf"] :text("übernommen")', { timeout: 15000 });
    await foto('14-uebernommen');

    // Schmales Fenster (Telefon)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await foto('15-schmal');
  });
})().catch((e) => { console.error(e); process.exit(1); });
