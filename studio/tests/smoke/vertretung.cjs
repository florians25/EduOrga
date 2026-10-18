// Oberflächentest der Vertretungsplanung (Playwright, Chromium).
//
//   NODE_PATH=$(npm root -g) STUDIO_URL=http://127.0.0.1:5501 STUDIO_PASSWORT=geheim123 node studio/tests/smoke/vertretung.cjs
//
// Ablauf: Beispielschule → Vertretungsmodus mit Planungsdatum → Abwesenheit direkt in der Liste erfassen (Entwurf, Strg+Enter)
// → Vertretungen mit offenen Stunden (???) → Vorschlag (Enter) und ersten Kandidaten übernehmen → Entfall mit „-“ →
// Kontextmenü → Kalender → Arbeitsplatz „Verlegen und Tauschen“ → Veranstaltung „Alle Lehrkräfte“ → Arbeitsplatz
// Tagesplanung → Tag blättern (Strg+Bild↓) → Einstellungen. Umgebungsvariablen: hilfe.cjs.
const h = require('./hilfe.cjs');

(async () => {
  const cookie = await h.apiAnmelden();
  const stand = await h.beispielschule(cookie);
  const dok = `/api/dokumente/${stand.id}`;
  const holen = async (p) => (await h.api(dok + p, { headers: { cookie } })).json();
  // Lehrkraft mit mindestens drei Stunden am Planungsdatum
  const datum = (await holen('/vertretung/start')).datum;
  const lehrer = (await holen('/elemente?typen=lehrer')).lehrer;
  let kurz = null;
  for (const l of lehrer) {
    const plan = await holen(`/vertretung/plan/lehrer/${l.id}?datum=${datum}`);
    if (plan.zellen.filter((z) => z.datum === datum).length >= 3) { kurz = l.k; break; }
  }
  if (!kurz) throw new Error('keine Lehrkraft mit Unterricht');

  const t = await h.starten('studio-shots-vertretung');
  const { page, foto } = t;
  const schritt = (s) => console.log(`✓ ${s}`);
  const datumImKopf = () => page.inputValue('[data-testid=planungsdatum] input[type=date]');

  await h.abschliessen('Oberflächentest Vertretungsplanung', t, async () => {
    await h.anmelden(page);
    await h.dokumentOffen(page);

    // Vertretungsmodus mit Planungsdatum
    await h.modus(page, 'vertretung');
    await page.waitForFunction((d) => document.querySelector('[data-testid=planungsdatum] input[type=date]')?.value === d, datum, { timeout: 15000 });
    await foto('01-vertretungsmodus');
    schritt(`Vertretungsmodus, Datum ${datum}, Lehrkraft ${kurz}`);

    // Abwesenheit direkt in der Liste: neue Zeile, Element eingeben, Strg+Enter speichert den Entwurf
    await h.eintrag(page, 'vertretung.absenzen');
    const abs = '[data-ansicht="vertretung.absenzen"]';
    await page.waitForSelector(`${abs} .tb-zeile.tb-neu`);
    await page.locator(`${abs} .tb-zeile.tb-neu .tb-zelle`).nth(1).click();
    await page.keyboard.type(kurz);
    await page.keyboard.press('Tab');
    await page.waitForSelector(`${abs} .tb-zeile.vt-entwurf`);
    await page.keyboard.press('Control+Enter');
    await page.waitForFunction(([s, k]) => [...document.querySelectorAll(`${s} .tb-zeile:not(.vt-entwurf):not(.tb-neu)`)].some((z) => z.textContent.includes(k)), [abs, kurz], { timeout: 15000 });
    await page.waitForTimeout(600);
    if (await page.locator('text=bereits vorhanden').count()) throw new Error('Abwesenheit wurde doppelt gespeichert');
    await foto('02-abwesenheiten');
    schritt('Abwesenheit gespeichert');

    // Vertretungen mit offenen Stunden
    await h.eintrag(page, 'vertretung.vertretungen');
    const liste = '[data-ansicht="vertretung.liste"]';
    await page.waitForFunction((s) => [...document.querySelectorAll(`${s} .tb-zelle.vt-rot`)].some((z) => z.textContent === '???'), liste, { timeout: 15000 });
    await foto('03-vertretungen-offen');
    schritt('Vertretungen mit ??? angezeigt');

    const offeneZeile = () => page.evaluate((s) => {
      const z = [...document.querySelectorAll(`${s} .tb-zeile`)].find((x) => [...x.querySelectorAll('.tb-zelle.vt-rot')].some((c) => c.textContent === '???'));
      return z ? { r: z.dataset.r, nr: z.children[0].textContent.trim() } : null;
    }, liste);
    // erste offene Zeile: Vorschlag (Enter) und ersten Kandidaten übernehmen (Doppelklick)
    const o1 = await offeneZeile();
    await page.locator(`${liste} .tb-zeile[data-r="${o1.r}"] .tb-zelle`).first().click();
    await page.keyboard.press('Enter');
    const vorschlag = '[data-ansicht="vertretung.vorschlag"]';
    await page.waitForSelector(`${vorschlag} [data-tabelle="vorschlag-0"] .tb-zeile`, { timeout: 15000 });
    await foto('04-vertretungsvorschlag');
    const erste = page.locator(`${vorschlag} [data-tabelle="vorschlag-0"] .tb-zeile`).first();
    const kandidat = (await erste.locator('.tb-zelle').first().textContent()).trim();
    await erste.dblclick();
    await page.waitForFunction(([s, n, k]) => [...document.querySelectorAll(`${s} .tb-zeile`)].some((z) => z.children[0]?.textContent.trim() === n && z.textContent.includes(k)), [liste, o1.nr, kandidat], { timeout: 15000 });
    await foto('05-vorschlag-uebernommen');
    schritt(`Vorschlag übernommen: Nr. ${o1.nr} → ${kandidat}`);

    // Entfall mit „-“ auf der nächsten offenen Zeile
    const o2 = await offeneZeile();
    if (o2) {
      await page.locator(`${liste} .tb-zeile[data-r="${o2.r}"] .tb-zelle`).first().click();
      await page.keyboard.press('-');
      await page.waitForFunction(([s, n]) => [...document.querySelectorAll(`${s} .tb-zeile`)].some((z) => z.children[0]?.textContent.trim() === n && z.textContent.includes('---')), [liste, o2.nr], { timeout: 15000 });
      schritt(`Entfall Nr. ${o2.nr}`);
    }
    // Kontextmenü
    await page.locator(`${liste} .tb-zeile`).first().locator('.tb-zelle').nth(2).click({ button: 'right' });
    await page.waitForSelector('[role=menu] [role=menuitem]');
    await foto('06-kontextmenue');
    await page.keyboard.press('Escape');

    // Kalender und Arbeitsplatz „Verlegen und Tauschen“ (Tagespläne)
    await h.eintrag(page, 'vertretung.kalender');
    await page.waitForSelector('[data-ansicht="vertretung.kalender"] .tb-zeile');
    await h.eintrag(page, 'vertretung.planungsdialog');
    await page.waitForSelector('[data-arbeitsplatz=verlegen] [data-ansicht="vertretung.plan"] .ra-eintrag', { timeout: 15000 });
    await foto('07-verlegen-und-tauschen');
    schritt('Verlegen und Tauschen (Tagespläne)');

    // Veranstaltung mit allen Lehrkräften
    await h.eintrag(page, 'vertretung.veranstaltungen');
    const va = '[data-ansicht="veranstaltungen.liste"]';
    await page.waitForSelector(`${va} .tb-zeile.tb-neu`);
    await page.locator(`${va} .tb-zeile.tb-neu .tb-zelle`).nth(3).click();
    await page.keyboard.type('Alle Lehrkräfte');
    await page.keyboard.press('Enter');
    await page.waitForFunction((s) => [...document.querySelectorAll(`${s} .tb-zelle`)].some((z) => z.textContent.includes('Alle Lehrkräfte')), va, { timeout: 15000 });
    await foto('08-veranstaltung-alle');
    schritt('Veranstaltung „Alle Lehrkräfte“ angelegt');

    // Arbeitsplatz Tagesplanung
    await page.click('[data-nav="nav:Tagesplanung"]');
    await page.waitForSelector('[data-arbeitsplatz=tagesplanung] [data-ansicht="vertretung.liste"] .tb-zeile', { timeout: 15000 });
    await page.waitForSelector('[data-arbeitsplatz=tagesplanung] [data-ansicht="vertretung.plan"] .ra-eintrag', { timeout: 15000 });
    await foto('09-tagesplanung');

    // Tag blättern mit Strg+Bild↓
    await page.locator('[data-arbeitsplatz=tagesplanung] [data-ansicht="vertretung.liste"] .tb-zeile').first().click().catch(() => {});
    await page.keyboard.press('Control+PageDown');
    await page.waitForFunction((d) => (document.querySelector('[data-testid=planungsdatum] input[type=date]')?.value || '') > d, datum, { timeout: 10000 });
    await page.waitForTimeout(600);
    await foto('10-naechster-tag');
    schritt(`Tag gewechselt: ${await datumImKopf()}`);

    // Einstellungen der Vertretungsplanung (Dialog, Seite Vertretungsvorschlag)
    await page.evaluate(() => { void window.studioTest.befehl('vertretung.einstellungen', { seite: 2 }); });
    await page.waitForSelector('[role=dialog]');
    await foto('11-einstellungen');
    await page.keyboard.press('Escape');
  });
})().catch((e) => { console.error(e); process.exit(1); });
