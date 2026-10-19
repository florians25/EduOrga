// Oberflächentest Farben, Blockansicht, Periodenwechsel und Jahreskalender (Playwright, Chromium).
//
//   NODE_PATH=$(npm root -g) STUDIO_URL=http://127.0.0.1:5501 STUDIO_PASSWORT=geheim123 node studio/tests/smoke/farben-kalender.cjs
//
// Ablauf: Beispielschule → Fächer: Farbfeld → Palette → Farbe gewählt, „Rückgängig“ im Hinweis; zwei Fächer markieren →
// „Farbe entfernen“ → Zufallsfarben für Fächer ohne Farbe → neutrale Karten im Klassenplan → Blockansicht (Kacheln,
// Schnellauswahl) → Periodenwechsel in der Kopfleiste: „Neue Periode ab …“ (Datum im Kalender), Wechsel mit ‹ › →
// Jahreskalender: Tage aufziehen → „Als frei markieren …“ → „Wieder Schultage“ → Kopfleiste bei 1366 px ohne Abschneiden.
// Umgebungsvariablen: hilfe.cjs.
const h = require('./hilfe.cjs');

(async () => {
  const cookie = await h.apiAnmelden();
  await h.beispielschule(cookie); // wird „zuletzt geöffnet“
  const t = await h.starten('studio-shots-farben-kalender');
  const { page, foto } = t;
  const tab = '[data-tabelle="stammdaten-fach"]';
  const schritt = (s) => console.log(`  ✓ ${s}`);

  await h.abschliessen('Oberflächentest Farben, Blockansicht, Perioden und Kalender', t, async () => {
    await h.anmelden(page);
    await h.dokumentOffen(page);

    // ---- Farben der Fächer ----
    await h.seite(page, '/stammdaten?typ=fach');
    await page.waitForSelector(`${tab} .tb-zeile[data-r="2"] .tb-farbpunkt`);
    const farbeVon = (r) => page.evaluate(([s, r]) => {
      const kz = [...document.querySelectorAll(`${s} .tb-kz`)].findIndex((x) => x.dataset.spalte === 'Hintergrund');
      return document.querySelector(`${s} .tb-zeile[data-r="${r}"] .tb-zelle[data-c="${kz}"]`)?.textContent || '';
    }, [tab, r]);
    const vorher = await farbeVon(0);
    await page.locator(`${tab} .tb-zeile[data-r="0"] .tb-farbpunkt`).click();
    await page.waitForSelector('[data-testid=farbwahl] [data-farbe]');
    await foto('01-farbwahl');
    await page.locator('[data-testid=farbwahl] [data-farbe="#499894"]').click();
    await page.waitForFunction(([s]) => [...document.querySelectorAll(`${s} .tb-zeile[data-r="0"] .tb-zelle`)].some((z) => /#499894/i.test(z.textContent || '')), [tab], { timeout: 10000 });
    schritt(`Farbfeld öffnet die Palette, gewählte Farbe gespeichert (vorher ${vorher || 'keine'})`);
    await page.locator('[data-testid=hinweis-aktion]').last().click();
    await page.waitForFunction(([s, v]) => {
      const z = [...document.querySelectorAll(`${s} .tb-zeile[data-r="0"] .tb-zelle`)].map((x) => x.textContent || '');
      return v ? z.some((x) => x.toLowerCase() === v.toLowerCase()) : !z.some((x) => /#499894/i.test(x));
    }, [tab, vorher], { timeout: 10000 });
    schritt('„Rückgängig“ im Hinweis stellt die Farbe wieder her');

    // zwei Zeilen markieren → Farbe entfernen → Zufallsfarben für Fächer ohne Farbe
    await page.locator(`${tab} .tb-zeile[data-r="1"] .tb-zelle[data-c="0"]`).click();
    await page.locator(`${tab} .tb-zeile[data-r="2"] .tb-zelle[data-c="0"]`).click({ modifiers: ['Control'] });
    await page.locator('[data-testid=farben-knopf] button').click();
    await page.getByRole('menuitem', { name: 'Farbe entfernen' }).click();
    await page.waitForFunction(([s]) => document.querySelectorAll(`${s} .tb-farbpunkt.leer`).length >= 2, [tab], { timeout: 10000 });
    schritt('Mehrfachauswahl → „Farbe entfernen“');
    await h.seite(page, '/stundenplan?typ=klasse');
    await page.waitForSelector('[data-ansicht=stundenplan] .ra-eintrag');
    const neutral = await page.evaluate(() => {
      const e = [...document.querySelectorAll('.ra-eintrag')].find((x) => !x.getAttribute('style')?.includes('--fachfarbe'));
      if (!e) return null;
      const st = getComputedStyle(e);
      return { flaeche: st.backgroundColor, rand: st.borderTopColor, breite: st.borderTopWidth };
    });
    if (neutral && (neutral.flaeche === 'rgba(0, 0, 0, 0)' || neutral.breite === '0px')) throw new Error(`Karte ohne Fachfarbe: ${JSON.stringify(neutral)}`);
    schritt(`Stunden ohne Fachfarbe als neutrale Karte (${neutral ? neutral.flaeche : 'alle Fächer gefärbt'})`);
    await h.seite(page, '/stammdaten?typ=fach');
    await page.waitForSelector(`${tab} .tb-farbpunkt.leer`);
    await page.locator('[data-testid=farben-knopf] button').click();
    await page.getByRole('menuitem', { name: /Zufallsfarben für Fächer ohne Farbe/ }).click();
    await page.waitForFunction(([s]) => !document.querySelector(`${s} .tb-farbpunkt.leer`), [tab], { timeout: 10000 });
    await foto('02-zufallsfarben');
    schritt('Zufallsfarben für Fächer ohne Farbe');

    // ---- Blockansicht ----
    await h.seite(page, '/stundenplan?typ=klasse');
    await page.waitForSelector('[data-testid=plan-darstellung]');
    await page.locator('[data-testid=plan-darstellung] [data-wert=block]').click();
    await page.waitForSelector('[data-testid=blockansicht] .sp-kachel .ra-eintrag', { timeout: 15000 });
    await page.locator('[data-ansicht=stundenplan] [role=toolbar] button', { hasText: 'Schnellauswahl' }).click();
    await page.getByRole('menuitem', { name: /^Alle Klassen/ }).click();
    await page.waitForFunction(() => document.querySelectorAll('[data-testid=blockansicht] .sp-kachel').length >= 4, null, { timeout: 15000 });
    const kacheln = await page.locator('[data-testid=blockansicht] .sp-kachel').count();
    await foto('03-blockansicht');
    await page.locator('[data-testid=blockansicht] .sp-kachel-kopf').first().click();
    await page.waitForSelector('[data-testid=plan-darstellung] [data-wert=einzel][aria-checked=true]');
    schritt(`Blockansicht mit ${kacheln} Kacheln, Kachelkopf öffnet den Einzelplan`);

    // ---- Periodenwechsel ----
    await page.locator('[data-testid=periode-knopf]').click();
    await page.locator('[data-testid=periode-neu-knopf]').click();
    await page.waitForSelector('[data-testid=periode-neu]');
    const beginn = page.locator('[data-testid=periode-neu] input[aria-label=Beginn]');
    await beginn.fill('');
    await beginn.fill(await page.evaluate(() => {
      const d = new Date(); d.setDate(d.getDate() + 30);
      return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    }));
    await beginn.press('Enter');
    await page.locator('[data-testid=periode-neu] input[aria-label=Name]').fill('Smoke-Periode');
    await foto('04-neue-periode');
    await h.dialogKnopf(page, 'Anlegen');
    await page.waitForFunction(() => (document.querySelector('[data-testid=periode-knopf]')?.textContent || '').includes('Smoke-Periode'), null, { timeout: 15000 });
    schritt('„Neue Periode ab …“ legt die Periode an und setzt sie aktiv');
    await page.locator('[data-testid=periode-vorher]').click();
    await page.waitForFunction(() => !(document.querySelector('[data-testid=periode-knopf]')?.textContent || '').includes('Smoke-Periode'), null, { timeout: 15000 });
    await page.locator('[data-testid=periode-nachher]').click();
    await page.waitForFunction(() => (document.querySelector('[data-testid=periode-knopf]')?.textContent || '').includes('Smoke-Periode'), null, { timeout: 15000 });
    schritt('‹ › wechseln zur vorherigen bzw. nächsten Periode');

    // ---- Jahreskalender ----
    await h.seite(page, '/ferien');
    await page.waitForSelector('[data-testid=jahreskalender] td.schultag');
    const tage = await page.evaluate(() => {
      // drei aufeinanderfolgende Schultage (Mo–Mi) einer Woche
      const s = [...document.querySelectorAll('[data-testid=jahreskalender] td.schultag')].map((x) => x.dataset.d);
      for (const d of s) {
        const t = new Date(`${d}T12:00:00`);
        if (t.getDay() !== 1) continue;
        const n = (k) => { const x = new Date(t); x.setDate(t.getDate() + k); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
        if (s.includes(n(1)) && s.includes(n(2))) return [d, n(2)];
      }
      return null;
    });
    if (!tage) throw new Error('Keine drei Schultage in Folge gefunden');
    const zelle = (d) => page.locator(`[data-testid=jahreskalender] td[data-d="${d}"]`);
    await zelle(tage[0]).scrollIntoViewIfNeeded();
    const a = await zelle(tage[0]).boundingBox(), b = await zelle(tage[1]).boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + a.width * 1.5, a.y + a.height / 2, { steps: 4 });
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 });
    await page.mouse.up();
    await page.waitForFunction(() => document.querySelectorAll('[data-testid=jahreskalender] td.auswahl').length === 3);
    schritt('Tage im Kalender aufgezogen (3 Tage)');
    await page.locator('[data-testid=frei-markieren]').click();
    await page.waitForSelector('[data-testid=frei-dialog]');
    await page.getByRole('radio', { name: 'Beweglicher Ferientag' }).click();
    await page.locator('[data-testid=frei-dialog] input[aria-label=Name]').fill('Smoke-frei');
    await foto('05-als-frei-markieren');
    await h.dialogKnopf(page, 'Übernehmen');
    await page.waitForFunction((d) => document.querySelector(`[data-testid=jahreskalender] td[data-d="${d}"]`)?.classList.contains('ferien'), tage[0], { timeout: 10000 });
    await page.waitForSelector('.es-ferienliste tr:has(input[value="Smoke-frei"])');
    schritt('„Als frei markieren …“ trägt die Tage ein (Kalender und Liste)');
    await zelle(tage[0]).click();
    await zelle(tage[1]).click({ modifiers: ['Shift'] });
    await page.locator('[data-testid=frei-aufheben]').click();
    await page.waitForFunction((d) => document.querySelector(`[data-testid=jahreskalender] td[data-d="${d}"]`)?.classList.contains('schultag'), tage[0], { timeout: 10000 });
    schritt('„Wieder Schultage“ nimmt die Tage heraus');

    // ---- Kopfleiste bei 1366 px ----
    await page.setViewportSize({ width: 1366, height: 768 });
    for (const m of ['stundenplan', 'vertretung']) {
      await h.modus(page, m);
      await page.waitForTimeout(800);
      const ueber = await page.evaluate(() => {
        const k = document.querySelector('header[role=banner]');
        return k ? [...k.querySelectorAll('button, [data-testid]')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > window.innerWidth + 0.5; }).map((e) => e.textContent || e.getAttribute('aria-label')) : ['keine Kopfleiste'];
      });
      if (ueber.length) throw new Error(`Kopfleiste (${m}) bei 1366 px abgeschnitten: ${ueber.join(', ')}`);
      await foto(`06-kopfleiste-1366-${m}`);
    }
    await h.modus(page, 'stundenplan');
    schritt('Kopfleiste passt bei 1366 px in beiden Modi');
  });
})();
