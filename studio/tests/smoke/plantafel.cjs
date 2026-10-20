// Oberflächentest der Plantafel (Playwright, Chromium): Steckbrett, Vorrat, Blöcke, Zielfarben, Tastatur, Klasse mit verknüpften
// Plänen und Dialog „Neuer Unterricht“.
//
//   NODE_PATH=$(npm root -g) STUDIO_PASSWORT=geheim123 node studio/tests/smoke/plantafel.cjs
//   (optional STUDIO_GROSSSCHULE=/tmp/gross.up: zusätzlich Steckbrett mit 60 Klassen, Datei siehe tagesplanung-gross.cjs)
//
// Ablauf bei 1440×900 und 1280×800: Beispielschule → Plantafel (Steckbrett der Klassen) → „Neuer Unterricht“ im Vorrat (Dialog:
// Pflichtfelder, Fach, Klasse, Lehrkraft, 3 Stunden, genau eine Doppelstunde) → Doppelstunde aus dem Vorrat in das Brett ziehen:
// Zeilen des Unterrichts und Stundenkopf zeigen grün/bernstein/rot, Grund am Mauszeiger, Ablage auf „frei“ → Block als Ganzes
// verschieben (beide Stunden wandern) → zurück in den Vorrat (entplant) → per Tastatur setzen (Enter, Pfeile, Enter) → gekoppelte
// Stunde: alle beteiligten Zeilen hervorgehoben → Darstellung „Klasse“: Pläne der Lehrkraft und des Raums der gewählten Stunde,
// Zielfarben auch dort → Unterricht: „Neu“ öffnet den Dialog, Pflichtfelder werden geprüft. Bildschirmfotos in STUDIO_SCREENSHOTS.
const fs = require('fs');
const h = require('./hilfe.cjs');

const GROESSEN = [[1440, 900], [1280, 800]];

async function tafel(dok, cookie) { return (await h.api(`${dok}/planung/plantafel?typ=klasse`, { headers: { cookie } })).json(); }

async function warten(f, text, ms = 10000) {
  const ende = Date.now() + ms;
  for (;;) {
    const w = await f();
    if (w) return w;
    if (Date.now() > ende) throw new Error(`Zeitüberschreitung: ${text}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

/** Mitte eines Elements bzw. einer Zielzelle (Seite) */
const mitte = (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

async function ziehenBis(page, von, ziel, schritte = 10) {
  await page.mouse.move(von.x, von.y);
  await page.mouse.down();
  await page.mouse.move(von.x + 12, von.y + 6, { steps: 3 });
  if (ziel) await page.mouse.move(ziel.x, ziel.y, { steps: schritte });
}

/** Erste Zielzelle einer Stufe in einer Zeile des gezogenen Unterrichts (sichtbar im Brett), ohne die ausgeschlossenen Spalten. */
async function zielzelle(page, stufe, ohne = []) {
  return page.evaluate(({ stufe, ohne }) => {
    const brett = document.querySelector('[data-testid=steckbrett]').getBoundingClientRect();
    const zellen = [...document.querySelectorAll(`.pt-zielzeile .pt-ziel.${stufe}`)];
    for (const z of zellen) {
      const r = z.getBoundingClientRect();
      const x = Math.round(r.left);
      if (ohne.some((o) => Math.abs(o - x) < 3)) continue;
      if (r.top >= brett.top + 40 && r.bottom <= brett.bottom && r.left > brett.left + 64 && r.right < brett.right) return { x: r.left + r.width / 2, y: r.top + r.height / 2, links: x };
    }
    return null;
  }, { stufe, ohne });
}

async function lauf(breite, hoehe) {
  const cookie = await h.apiAnmelden();
  const b = await h.beispielschule(cookie);
  const dok = `/api/dokumente/${b.id}`;
  const t = await h.starten('studio-shots-plantafel', { breite, hoehe });
  const { page, foto } = t;
  const n = (x) => `plantafel-${breite}-${x}`;
  await h.abschliessen(`Oberflächentest Plantafel ${breite}×${hoehe}`, t, async () => {
    await h.anmelden(page);
    await h.dokumentOffen(page);

    // Steckbrett
    await h.eintrag(page, 'planung.plantafel');
    await page.waitForSelector('[data-testid=steckbrett] .pt-chip');
    const zeilen = await page.locator('[data-testid=steckbrett] .pt-zeile').count();
    const vorher = await tafel(dok, cookie);
    if (zeilen !== vorher.zeilen.length) throw new Error(`Steckbrett: ${zeilen} Zeilen statt ${vorher.zeilen.length}`);
    await foto(n('steckbrett'));

    // Neuer Unterricht aus dem Vorrat: Pflichtfelder, dann anlegen
    await page.locator('[data-testid=vorrat] button', { hasText: 'Neuer Unterricht' }).click();
    await page.waitForSelector('[role=dialog] [data-testid=neuer-unterricht]');
    await page.locator('[role=dialog]').getByRole('button', { name: 'Anlegen', exact: true }).click();
    await page.waitForSelector('[role=dialog] :text("Bitte ein Fach wählen.")');
    // Suchauswahl: tippen öffnet die Liste (Einzelwahl: listbox/option, Mehrfachwahl: menu/menuitemcheckbox)
    const waehlen = async (label, text) => {
      const cb = page.locator(`[role=dialog] [role=combobox][aria-label="${label}"]`);
      await cb.click();
      await page.keyboard.type(text, { delay: 20 });
      const opt = page.locator('[role=listbox] [role=option], [role=menu] [role=menuitemcheckbox]').first();
      await opt.click();
      // Mehrfachauswahl bleibt offen: mit Klick auf den Titel schließen (Esc schlösse den Dialog)
      if (await page.locator('[role=menu]').isVisible().catch(() => false)) await page.locator('[role=dialog] h2').first().click();
    };
    const lehrer = vorher.unterrichte.reduce((m, u) => { for (const l of u.lehrer) m[l] = (m[l] || 0) + u.wst; return m; }, {});
    const wenig = Object.entries(lehrer).sort((x, y) => x[1] - y[1])[0][0];
    await waehlen('Fach', 'M');
    await waehlen('Klassen', vorher.namen.klassen[vorher.zeilen[0].id]);
    await waehlen('Lehrkraft', vorher.namen.lehrer[wenig]);
    await page.locator('[role=dialog] input[name=wochenstunden]').fill('3');
    await page.locator('[role=dialog] [aria-label=Doppelstunden]').click();
    await page.locator('[role=listbox] [role=option]', { hasText: 'Genau eine' }).click();
    await page.waitForSelector('[role=dialog] [data-testid=vorschau]:has-text("1 Doppelstunde, 1 Einzelstunde")');
    await foto(n('neuer-unterricht'));
    await page.locator('[role=dialog]').getByRole('button', { name: 'Anlegen', exact: true }).click();
    await page.waitForSelector('[role=dialog]', { state: 'detached' });
    let d = await tafel(dok, cookie);
    const bekannt = new Set(vorher.unterrichte.map((u) => u.u));
    const neu = d.unterrichte.find((u) => !bekannt.has(u.u));
    if (!neu) throw new Error('Neuer Unterricht fehlt in der Plantafel');
    if (JSON.stringify(neu.offen) !== '[2,1]') throw new Error(`Neuer Unterricht: offen ${JSON.stringify(neu.offen)}`);
    const doppel = page.locator(`[data-testid=vorrat] [data-vorrat="${neu.u}"][data-laenge="2"]`).first();
    await doppel.waitFor();

    // Doppelstunde aus dem Vorrat ziehen: Zielfarben, Grund, Ablage auf „frei“
    const zeile = page.locator(`[data-testid=steckbrett] .pt-zeile[data-zeile="${neu.klassen[0]}"]`);
    const zb = await zeile.boundingBox();
    await ziehenBis(page, mitte(await doppel.boundingBox()), { x: zb.x + 300, y: zb.y + zb.height / 2 });
    await page.waitForSelector('.pt-zielzeile .pt-ziel.frei', { timeout: 10000 });
    const hart = await page.locator('.pt-zielzeile .pt-ziel.hart').count();
    const frei = await page.locator('.pt-zielzeile .pt-ziel.frei').count();
    if (!hart || !frei) throw new Error(`Zielfarben: ${frei} frei, ${hart} hart`);
    if (!(await page.locator('.pt-std.frei').count())) throw new Error('Stundenkopf ohne Zielfarben');
    const ziel1 = await zielzelle(page, 'frei');
    await page.mouse.move(ziel1.x, ziel1.y, { steps: 6 });
    await page.waitForSelector('.pt-marke.frei');
    await page.waitForSelector('[data-testid=pt-grund]');
    await foto(n('ziehen-vorrat'));
    // über eine belegte Zelle: Grund am Mauszeiger
    const rot = await zielzelle(page, 'hart');
    if (rot) {
      await page.mouse.move(rot.x, rot.y, { steps: 4 });
      await page.waitForSelector('.pt-marke.hart');
      const grund = await page.locator('[data-testid=pt-grund]').textContent();
      if (!/Kollision|Zeitraster|gesperrt|Zeitwunsch|belegt/.test(grund)) throw new Error(`Grund am Mauszeiger: ${grund}`);
      await foto(n('ziehen-konflikt'));
      await page.mouse.move(ziel1.x, ziel1.y, { steps: 4 });
    }
    await page.mouse.up();
    d = await warten(async () => { const x = await tafel(dok, cookie); return JSON.stringify(x.unterrichte.find((u) => u.u === neu.u).offen) === '[1]' ? x : null; }, 'Doppelstunde verplant');
    const gesetzt = d.stunden.filter((s) => s.u === neu.u).sort((a, b) => a.stunde - b.stunde);
    if (gesetzt.length !== 2 || gesetzt[0].tag !== gesetzt[1].tag || gesetzt[1].stunde !== gesetzt[0].stunde + 1) throw new Error(`Doppelstunde: ${JSON.stringify(gesetzt)}`);

    // Block als Ganzes verschieben
    const chip = page.locator(`[data-testid=steckbrett] .pt-chip[data-u="${neu.u}"]`).first();
    await chip.waitFor();
    const cb = await chip.boundingBox();
    await ziehenBis(page, { x: cb.x + cb.width * 0.25, y: cb.y + cb.height / 2 }, null);
    await page.mouse.move(cb.x + cb.width * 0.25 + 40, cb.y + cb.height / 2, { steps: 4 });
    await page.waitForSelector('.pt-zielzeile .pt-ziel.eigen', { timeout: 10000 });
    const ziel2 = await zielzelle(page, 'frei', [Math.round(cb.x - 1)]);
    if (!ziel2) throw new Error('Kein freies Ziel für den Block');
    await page.mouse.move(ziel2.x, ziel2.y, { steps: 8 });
    await page.waitForSelector('.pt-marke.frei');
    await foto(n('block-verschieben'));
    await page.mouse.up();
    d = await warten(async () => {
      const x = await tafel(dok, cookie);
      const st = x.stunden.filter((s) => s.u === neu.u).sort((a, b) => a.stunde - b.stunde);
      return st.length === 2 && JSON.stringify(st.map((s) => [s.tag, s.stunde])) !== JSON.stringify(gesetzt.map((s) => [s.tag, s.stunde])) ? x : null;
    }, 'Block verschoben');
    const bewegt = d.stunden.filter((s) => s.u === neu.u).sort((a, b) => a.stunde - b.stunde);
    if (bewegt[0].tag !== bewegt[1].tag || bewegt[1].stunde !== bewegt[0].stunde + 1) throw new Error(`Block zerrissen: ${JSON.stringify(bewegt)}`);

    // zurück in den Vorrat = entplanen
    const chip2 = page.locator(`[data-testid=steckbrett] .pt-chip[data-u="${neu.u}"]`).first();
    await page.waitForFunction((u) => document.querySelectorAll(`[data-testid=steckbrett] .pt-chip[data-u="${u}"]`).length > 0, neu.u);
    const vb = await page.locator('[data-testid=vorrat]').boundingBox();
    await ziehenBis(page, mitte(await chip2.boundingBox()), { x: vb.x + vb.width / 2, y: vb.y + vb.height / 2 });
    await page.waitForSelector('[data-testid=vorrat].drueber');
    await foto(n('in-vorrat'));
    await page.mouse.up();
    await warten(async () => JSON.stringify((await tafel(dok, cookie)).unterrichte.find((u) => u.u === neu.u).offen) === '[2,1]', 'In den Vorrat entplant');

    // Tastatur: Doppelstunde im Vorrat mit Enter aufnehmen, mit den Pfeilen auf ein freies Feld, Enter legt ab
    const ziele = await (await h.api(`${dok}/planung/plantafel/ziele?unterricht=${neu.u}&laenge=2`, { headers: { cookie } })).json();
    const S = ziele.stufen[0].length;
    let freiSlot = -1;
    ziele.stufen.forEach((tg, ti) => tg.forEach((s, si) => { if (freiSlot < 0 && s === 'frei' && ti > 0) freiSlot = ti * S + si; }));
    await page.locator(`[data-testid=vorrat] [data-vorrat="${neu.u}"][data-laenge="2"]`).first().focus();
    await page.keyboard.press('Enter');
    await page.waitForSelector('.pt-cursor.zug');
    await page.keyboard.press('Home');
    for (let i = 0; i < freiSlot; i++) await page.keyboard.press('ArrowRight');
    await page.waitForSelector('.pt-marke.frei');
    await foto(n('tastatur'));
    await page.keyboard.press('Enter');
    d = await warten(async () => { const x = await tafel(dok, cookie); return JSON.stringify(x.unterrichte.find((u) => u.u === neu.u).offen) === '[1]' ? x : null; }, 'per Tastatur gesetzt');
    const perTaste = d.stunden.filter((s) => s.u === neu.u).sort((a, b) => a.stunde - b.stunde);
    if (perTaste[0].tag * S + perTaste[0].stunde - 1 !== freiSlot) throw new Error(`Tastatur: gesetzt ${JSON.stringify(perTaste)} statt Feld ${freiSlot}`);

    // Rückgängig (Kopfleiste) nimmt das Setzen zurück, das Brett zeigt es sofort
    await page.locator('[data-testid=rueckgaengig]').click();
    await warten(async () => JSON.stringify((await tafel(dok, cookie)).unterrichte.find((u) => u.u === neu.u).offen) === '[2,1]', 'Rückgängig');
    await page.waitForFunction((u) => !document.querySelector(`[data-testid=steckbrett] .pt-chip[data-u="${u}"]`), neu.u, { timeout: 10000 });
    await page.locator('[data-testid=wiederholen]').click();
    await page.waitForFunction((u) => document.querySelector(`[data-testid=steckbrett] .pt-chip[data-u="${u}"]`), neu.u, { timeout: 10000 });

    // gekoppelte Stunde: alle beteiligten Zeilen hervorgehoben
    const gek = page.locator('[data-testid=steckbrett] .pt-chip.gekoppelt').first();
    if (await gek.count()) {
      await gek.click();
      const beteiligt = await page.locator('[data-testid=steckbrett] .pt-zeile.beteiligt').count();
      if (beteiligt < 2) throw new Error(`Kopplung: ${beteiligt} Zeilen hervorgehoben`);
      await foto(n('kopplung'));
    }

    // Zeilen umschalten: Lehrkräfte (eine Zeile je Lehrkraft, gekoppelte Stunden in jeder beteiligten Zeile)
    await page.locator('[data-testid=pt-zeilen] [data-wert=lehrer]').click();
    await page.waitForFunction(() => document.querySelector('[data-testid=steckbrett] .pt-ecke')?.textContent === 'Lehrkraft' && document.querySelectorAll('[data-testid=steckbrett] .pt-chip').length > 0);
    await foto(n('lehrkraefte'));
    await page.locator('[data-testid=pt-zeilen] [data-wert=klasse]').click();
    await page.waitForFunction(() => document.querySelector('[data-testid=steckbrett] .pt-ecke')?.textContent === 'Klasse');

    // Darstellung „Klasse“: verknüpfte Pläne der gewählten Stunde, Zielfarben beim Ziehen
    await page.locator('[data-testid=pt-modus] [data-wert=klasse]').click();
    await page.waitForSelector('[data-testid=klassentafel] .ra-eintrag');
    await page.locator('[data-testid=klassentafel] .pt-k-plan .ra-eintrag:not(.gekoppelt)').first().click();
    await page.waitForSelector('[data-testid=verknuepft] [data-verknuepft^="lehrer:"] .ra-eintrag');
    await foto(n('klasse'));
    const q = await page.locator('[data-testid=klassentafel] .pt-k-plan .ra-eintrag.ziehbar').first().boundingBox();
    await ziehenBis(page, mitte(q), { x: q.x + q.width / 2 + 60, y: q.y + q.height / 2 + 60 });
    await page.waitForFunction(() => document.querySelectorAll('.pt-k-plan .ra-feld[class*="ziel-"]').length > 0 && document.querySelectorAll('[data-verknuepft] .ra-feld[class*="pt-zf-"]').length > 0, null, { timeout: 10000 });
    await foto(n('klasse-ziehen'));
    await page.keyboard.press('Escape');
    await page.mouse.up();

    // Unterricht: „Neu“ öffnet den Dialog
    await h.eintrag(page, 'eingabe.unterricht.klassen');
    await page.waitForSelector('[data-ansicht=unterricht] [data-tabelle] .tb-zeile');
    await h.werkzeug(page, 'unterricht', 'Neu');
    await page.waitForSelector('[role=dialog] [data-testid=neuer-unterricht]');
    if (!(await page.locator('[role=dialog] [role=combobox][aria-label=Klassen]').inputValue())) throw new Error('Dialog: Klasse der Sicht nicht vorbelegt');
    await page.locator('[role=dialog]').getByRole('button', { name: 'Anlegen', exact: true }).click();
    await page.waitForSelector('[role=dialog] :text("Bitte ein Fach wählen.")');
    await foto(n('unterricht-neu'));
    await page.keyboard.press('Escape');
    await page.waitForSelector('[role=dialog]', { state: 'detached' });

    // dunkles Thema
    if (breite === 1440) {
      await page.evaluate(() => localStorage.setItem('studio.thema', 'dunkel'));
      await page.reload();
      await page.waitForFunction(() => document.body.dataset.bereit === '1', null, { timeout: 20000 });
      await h.eintrag(page, 'planung.plantafel');
      await page.locator('[data-testid=pt-modus] [data-wert=steckbrett]').click();
      await page.waitForSelector('[data-testid=steckbrett] .pt-chip');
      await foto(n('dunkel'));
      await page.evaluate(() => localStorage.setItem('studio.thema', 'hell'));
    }
  });
  return t;
}

async function gross(breite, hoehe) {
  const datei = process.env.STUDIO_GROSSSCHULE;
  if (!datei || !fs.existsSync(datei)) return;
  const cookie = await h.apiAnmelden();
  const form = new FormData();
  form.append('datei', new Blob([fs.readFileSync(datei)]), 'Gesamtschule Großstadt.up');
  const r = await fetch(`${h.URL}/api/dokumente/hochladen`, { method: 'POST', body: form, headers: { 'X-UntPlan-Studio': '1', cookie } });
  if (!r.ok) throw new Error(`Hochladen: ${r.status}`);
  const t = await h.starten('studio-shots-plantafel', { breite, hoehe });
  const { page, foto } = t;
  await h.abschliessen(`Plantafel mit 60 Klassen ${breite}×${hoehe}`, t, async () => {
    await h.anmelden(page);
    await h.dokumentOffen(page, 'Großstadt');
    const start = Date.now();
    await h.eintrag(page, 'planung.plantafel');
    await page.waitForSelector('[data-testid=steckbrett] .pt-chip', { timeout: 20000 });
    const ms = Date.now() - start;
    const gezeichnet = await page.locator('[data-testid=steckbrett] .pt-zeile').count();
    if (gezeichnet >= 60) throw new Error(`Fenster: ${gezeichnet} Zeilen gezeichnet (erwartet: nur die sichtbaren)`);
    await foto(`plantafel-${breite}-gross`);
    // rollen und ziehen bleibt flüssig
    await page.locator('[data-testid=steckbrett]').evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(300);
    // eine sichtbare, ziehbare Karte im unteren Teil des Bretts
    const b = await page.evaluate(() => {
      const r = document.querySelector('[data-testid=steckbrett]').getBoundingClientRect();
      const k = [...document.querySelectorAll('[data-testid=steckbrett] .pt-chip.ziehbar')].map((e) => e.getBoundingClientRect())
        .filter((x) => x.top > r.top + 60 && x.bottom < r.bottom - 4 && x.left > r.left + 70 && x.right < r.right - 140);
      const x = k[k.length - 1];
      return x ? { x: x.left, y: x.top, width: x.width, height: x.height } : null;
    });
    if (!b) throw new Error('Keine sichtbare Karte im Steckbrett');
    const t0 = Date.now();
    await ziehenBis(page, mitte(b), { x: b.x + 120, y: b.y + 4 });
    await page.waitForSelector('.pt-zielzeile .pt-ziel', { timeout: 10000 });
    const zieh = Date.now() - t0;
    await foto(`plantafel-${breite}-gross-ziehen`);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    console.log(`  60 Klassen: Steckbrett nach ${ms} ms, Zielfarben nach ${zieh} ms, ${gezeichnet} Zeilen gezeichnet`);
  });
}

(async () => {
  for (const [b, hh] of GROESSEN) {
    await lauf(b, hh);
    if (process.exitCode) return;
  }
  // große Schule zuletzt (sie wird beim Hochladen zum zuletzt geöffneten Dokument)
  for (const [b, hh] of GROESSEN) {
    await gross(b, hh);
    if (process.exitCode) return;
  }
})().catch((e) => { console.error(e); process.exit(1); });
