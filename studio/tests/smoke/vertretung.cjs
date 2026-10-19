// Oberflächentest der Vertretungsplanung (Playwright, Chromium).
//
//   NODE_PATH=$(npm root -g) STUDIO_URL=http://127.0.0.1:5501 STUDIO_PASSWORT=geheim123 node studio/tests/smoke/vertretung.cjs
//
// Ablauf: Beispielschule → Vertretungsmodus mit Planungsdatum → Abwesenheit direkt in der Liste erfassen (Entwurf, Strg+Enter)
// → Vertretungen mit offenen Stunden (Plakette „Offen“) → Vorschlag (Enter) und ersten Kandidaten übernehmen → Entfall mit „-“ →
// Kontextmenü → Kalender → Arbeitsplatz „Verlegen und Tauschen“ → Veranstaltung „Alle Lehrkräfte“ → Arbeitsplatz
// Tagesplanung (Tageskopf, schlanke Liste, Filter, Vorschlag zur gewählten Zeile, Tagespläne als Tagesansicht) → Tag blättern
// (Strg+Bild↓) → Wochenansicht (Umschalter Tag | Woche im Plan und im Tageskopf, Wochenstreifen, Strg+Umschalt+Bild↓/↑,
// Plan vergrößern, gemerkte Ansicht) → Verknüpfung der Pläne (Klick auf eine Stunde) → Einstellungen. Umgebungsvariablen: hilfe.cjs.
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
    // Entwurf (Strg+Enter speichert) – oder die Tabelle speichert die neue Zeile bereits beim Verlassen der Zelle
    await page.waitForFunction(([s, k]) => !!document.querySelector(`${s} .tb-zeile.vt-entwurf`) || [...document.querySelectorAll(`${s} .tb-zeile:not(.tb-neu)`)].some((z) => z.textContent.includes(k)), [abs, kurz], { timeout: 15000 });
    if (await page.locator(`${abs} .tb-zeile.vt-entwurf`).count()) await page.keyboard.press('Control+Enter');
    await page.waitForFunction(([s, k]) => [...document.querySelectorAll(`${s} .tb-zeile:not(.vt-entwurf):not(.tb-neu)`)].some((z) => z.textContent.includes(k)), [abs, kurz], { timeout: 15000 });
    await page.waitForTimeout(600);
    if (await page.locator('text=bereits vorhanden').count()) throw new Error('Abwesenheit wurde doppelt gespeichert');
    await foto('02-abwesenheiten');
    schritt('Abwesenheit gespeichert');

    // Vertretungen mit offenen Stunden
    await h.eintrag(page, 'vertretung.vertretungen');
    const liste = '[data-ansicht="vertretung.liste"]';
    await page.waitForSelector(`${liste} .tb-zelle.vt-z-offen`, { timeout: 15000 });
    if (await page.locator(`${liste} .tb-zelle`, { hasText: '???' }).count()) throw new Error('„???“ statt Plakette „Offen“');
    await foto('03-vertretungen-offen');
    schritt('Vertretungen mit Plakette „Offen“ angezeigt');

    const offeneZeile = () => page.evaluate((s) => {
      const z = [...document.querySelectorAll(`${s} .tb-zeile`)].find((x) => x.querySelector('.tb-zelle.vt-z-offen'));
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
    // Mehrfachauswahl: das erste Enter übernimmt den Vorschlag, das zweite beendet die Eingabe
    await page.waitForTimeout(500);
    if (!(await page.evaluate((s) => [...document.querySelectorAll(`${s} .tb-zelle`)].some((z) => z.textContent.includes('Alle Lehrkräfte')), va))) await page.keyboard.press('Enter');
    await page.waitForFunction((s) => [...document.querySelectorAll(`${s} .tb-zelle`)].some((z) => z.textContent.includes('Alle Lehrkräfte')), va, { timeout: 15000 });
    await foto('08-veranstaltung-alle');
    schritt('Veranstaltung „Alle Lehrkräfte“ angelegt');

    // Arbeitsplatz Tagesplanung: Tageskopf, schlanke Liste, Vorschlag und Tagespläne (Kalender und Abwesenheiten auf eigenen Seiten)
    await page.click('[data-nav="nav:Tagesplanung"]');
    const tp = '[data-arbeitsplatz=tagesplanung]';
    await page.waitForSelector(`${tp} [data-ansicht="vertretung.liste"] .tb-zeile`, { timeout: 15000 });
    await page.waitForSelector(`${tp} [data-ansicht="vertretung.plan"] .ra-eintrag`, { timeout: 15000 });
    await page.waitForFunction((s) => /offen/.test(document.querySelector(`${s} [data-testid=tagessumme]`)?.textContent || ''), tp, { timeout: 15000 });
    if (await page.locator(`${tp} [data-ansicht="vertretung.kalender"], ${tp} [data-ansicht="vertretung.absenzen"]`).count()) throw new Error('Kalender/Abwesenheiten gehören nicht mehr in die Tagesplanung');
    const tagSpalten = await page.locator(`${tp} [data-ansicht="vertretung.plan"]`).first().locator('.ra-kopf').count();
    if (tagSpalten !== 1) throw new Error(`Tagesplan zeigt ${tagSpalten} Tage statt nur des Planungstags`);
    await page.locator(`${tp} [data-ansicht="vertretung.liste"] .tb-zeile`).first().locator('.tb-zelle').first().click();
    await page.waitForSelector(`${tp} [data-testid=vorschlag-kopf]`, { timeout: 15000 });
    await foto('09-tagesplanung');
    await page.click(`${tp} [data-testid=liste-filter]`);
    await page.waitForSelector('[role=switch], input[role=switch]', { timeout: 5000 }).catch(() => {});
    await page.getByLabel('Nur offene').check();
    await page.waitForFunction((s) => [...document.querySelectorAll(`${s} [data-ansicht="vertretung.liste"] .tb-zeile`)].every((z) => z.querySelector('.vt-z-offen')), tp, { timeout: 15000 });
    await foto('09b-tagesplanung-filter');
    await page.keyboard.press('Escape');
    schritt('Tagesplanung: Tageskopf, Liste mit Filter, Vorschlag, Tagespläne');

    // Tag blättern mit Strg+Bild↓
    await page.locator('[data-arbeitsplatz=tagesplanung] [data-ansicht="vertretung.liste"] .tb-zeile').first().click().catch(() => {});
    await page.keyboard.press('Control+PageDown');
    await page.waitForFunction((d) => (document.querySelector('[data-testid=planungsdatum] input[type=date]')?.value || '') > d, datum, { timeout: 10000 });
    await page.waitForTimeout(600);
    await foto('10-naechster-tag');
    schritt(`Tag gewechselt: ${await datumImKopf()}`);

    // Wochenansicht: Umschalter Tag | Woche im Plankopf, Planungstag hervorgehoben, Klick auf einen anderen Tag wechselt das Datum
    const planK = `${tp} [data-bereich=plan-klasse]`;
    await page.click(`${tp} [data-testid=plan-ansicht-klasse] [data-wert=woche]`);
    await page.waitForFunction((s) => document.querySelectorAll(`${s} .ra-kopf`).length >= 5, planK, { timeout: 10000 });
    if ((await page.locator(`${planK} .ra-kopf.vt-planungstag`).count()) !== 1) throw new Error('Planungstag im Wochenplan nicht hervorgehoben');
    if ((await page.locator(`${tp} [data-bereich=plan-lehrer] .ra-kopf`).count()) !== 1) throw new Error('Lehrkräfteplan sollte in der Tagesansicht bleiben');
    const d0 = await datumImKopf();
    await page.locator(`${planK} .ra-kopf button.vt-tagwahl`).first().click();
    await page.waitForFunction((d) => document.querySelector('[data-testid=planungsdatum] input[type=date]')?.value !== d, d0, { timeout: 10000 });
    await page.waitForTimeout(500);
    const d1 = await datumImKopf();
    if (!(await page.locator(`${tp} [data-testid=wochenstreifen] [data-datum="${d1}"][aria-pressed=true]`).count())) throw new Error('Wochenstreifen folgt dem Planungstag nicht');
    await foto('12-wochenplan-klasse');
    schritt(`Wochenplan Klasse, Tag gewechselt ${d0} → ${d1}`);

    // ganze Seite im Wochenmodus: Liste nach Tagen gegliedert, beide Pläne als Woche untereinander, Wochenstreifen
    await page.click(`${tp} [data-testid=seiten-ansicht] [data-wert=woche]`);
    await page.waitForSelector(`${tp} [data-ansicht="vertretung.liste"] .tb-zeile.vt-tageskopf`, { timeout: 15000 });
    await page.waitForFunction((s) => document.querySelectorAll(`${s} [data-bereich=plan-lehrer] .ra-kopf`).length >= 5, tp, { timeout: 10000 });
    if ((await page.locator(`${tp}`).getAttribute('data-arbeitsplatz')) !== 'tagesplanung' || !(await page.locator('[data-ansicht-art=woche]').count())) throw new Error('Wochenaufteilung fehlt');
    const kb = await page.locator(`${tp} [data-bereich=plan-klasse]`).boundingBox();
    const lb = await page.locator(`${tp} [data-bereich=plan-lehrer]`).boundingBox();
    if (!(lb.y > kb.y + kb.height - 2)) throw new Error('Pläne stehen im Wochenmodus nicht untereinander');
    await foto('13-tagesplanung-woche');
    // Wochenstreifen: anderer Tag
    const tageImListe = await page.evaluate((s) => [...document.querySelectorAll(`${s} .tb-zeile.vt-tageskopf`)].map((z) => z.textContent), tp);
    const streifen = page.locator(`${tp} [data-testid=wochenstreifen] button[aria-pressed=false]:not(.frei)`);
    const ziel = await streifen.first().getAttribute('data-datum');
    await streifen.first().click();
    await page.waitForFunction((d) => document.querySelector('[data-testid=planungsdatum] input[type=date]')?.value === d, ziel, { timeout: 10000 });
    const zielText = `${ziel.slice(8, 10)}.${ziel.slice(5, 7)}.`;
    if (tageImListe.some((x) => x.includes(zielText))) await page.waitForSelector(`${tp} .tb-zeile.vt-tageskopf.vt-planungstag`, { timeout: 10000 });
    schritt(`Liste der Woche nach Tagen: ${tageImListe.length} Tag(e); Wochenstreifen → ${ziel}`);
    // Woche blättern mit Strg+Umschalt+Bild↓ / Bild↑
    await page.locator(`${tp} [data-ansicht="vertretung.liste"] .tb-zeile`).first().click().catch(() => {});
    await page.keyboard.press('Control+Shift+PageDown');
    await page.waitForFunction((d) => (document.querySelector('[data-testid=planungsdatum] input[type=date]')?.value || '') >= new Date(new Date(d).getTime() + 5 * 864e5).toISOString().slice(0, 10), ziel, { timeout: 10000 });
    const naechste = await datumImKopf();
    await page.keyboard.press('Control+Shift+PageUp');
    await page.waitForFunction((d) => (document.querySelector('[data-testid=planungsdatum] input[type=date]')?.value || '') < d, naechste, { timeout: 10000 });
    schritt(`Woche blättern: ${naechste} → ${await datumImKopf()}`);
    // Plan vergrößern und mit Esc zurück
    await page.click(`${tp} [data-testid=plan-gross-klasse]`);
    await page.waitForSelector(`${tp} [data-bereich=liste]`, { state: 'hidden', timeout: 5000 });
    await page.waitForSelector(`${tp} [data-bereich=plan-lehrer]`, { state: 'hidden', timeout: 5000 });
    await foto('14-plan-vergroessert');
    await page.keyboard.press('Escape');
    await page.waitForSelector(`${tp} [data-bereich=liste]`, { state: 'visible', timeout: 5000 });
    // gemerkt (localStorage): nach dem Neuladen wieder Woche
    await page.reload();
    await page.waitForSelector(`${tp} [data-testid=seiten-ansicht] [data-wert=woche][aria-checked=true]`, { timeout: 20000 });
    await page.waitForFunction((s) => document.querySelectorAll(`${s} [data-bereich=plan-lehrer] .ra-kopf`).length >= 5, tp, { timeout: 15000 });
    await page.click(`${tp} [data-testid=seiten-ansicht] [data-wert=tag]`);
    await page.waitForFunction((s) => document.querySelectorAll(`${s} [data-bereich=plan-klasse] .ra-kopf`).length === 1, tp, { timeout: 10000 });
    schritt('Tagesplanung im Wochenmodus: Liste nach Tagen, Pläne untereinander, Wochenstreifen, Vergrößern, gemerkt');

    // Verknüpfung der Pläne: Stunde im Klassenplan → Lehrkräfteplan zeigt deren Lehrkraft (und umgekehrt die Klasse)
    // Titel des Plans („Lehrkraft MEY“, aria-label des Bereichs)
    const gewaehlteOption = (b) => page.evaluate((s) => document.querySelector(`${s} section[aria-label]`)?.getAttribute('aria-label') || '', `${tp} [data-bereich=${b}]`);
    // Stunde mit Lehrkraft (bei einer Vertretung zeigt der Plan wie die Liste die ursprüngliche Lehrkraft, „statt …“)
    await page.waitForSelector(`${tp} [data-bereich=plan-klasse] .ra-eintrag`, { timeout: 15000 });
    const kandidaten = page.locator(`${tp} [data-bereich=plan-klasse] .ra-eintrag:not(.vt-st-Entfall)`);
    let stunde = null, lk = null;
    for (let i = 0; i < await kandidaten.count() && !lk; i++) {
      const tt = (await kandidaten.nth(i).getAttribute('title')) || '';
      const statt = tt.match(/statt (\S+)/);
      const l = statt ? statt[1] : tt.split('\n')[1]?.split(' – ')[2];
      if (l && l !== '???') { stunde = kandidaten.nth(i); lk = l; }
    }
    if (!stunde) throw new Error('keine Stunde mit Lehrkraft im Klassenplan');
    await stunde.click();
    await page.waitForFunction(([s, k]) => (document.querySelector(`${s} [data-bereich=plan-lehrer] section[aria-label]`)?.getAttribute('aria-label') || '').endsWith(` ${k}`), [tp, lk], { timeout: 10000 });
    const kl = await page.evaluate((s) => document.querySelector(`${s} [data-bereich=plan-lehrer] .ra-eintrag .zeile2`)?.textContent || '', tp);
    if (kl) {
      await page.locator(`${tp} [data-bereich=plan-lehrer] .ra-eintrag`).first().click();
      await page.waitForFunction(([s, k]) => (document.querySelector(`${s} [data-bereich=plan-klasse] section[aria-label]`)?.getAttribute('aria-label') || '').endsWith(` ${k.replace(/[()]/g, '').split(',')[0].trim()}`), [tp, kl], { timeout: 10000 });
    }
    schritt(`Pläne verknüpft: Klassenplan → ${await gewaehlteOption('plan-lehrer')}, Lehrkräfteplan → ${await gewaehlteOption('plan-klasse')}`);

    // Einstellungen der Vertretungsplanung (Dialog, Seite Vertretungsvorschlag)
    await page.evaluate(() => { void window.studioTest.befehl('vertretung.einstellungen', { seite: 2 }); });
    await page.waitForSelector('[role=dialog]');
    await foto('11-einstellungen');
    await page.keyboard.press('Escape');
  });
})().catch((e) => { console.error(e); process.exit(1); });
