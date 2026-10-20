// Oberflächentest „Fall für Fall“ mit einer großen Schule (Playwright, Chromium): 300 Lehrkräfte, 60 Klassen, 15 Abwesenheiten.
//
//   STUDIO_GROSSSCHULE=/tmp/gross.up dotnet test studio/tests/UntPlanStudio.Tests --filter GrosseSchuleMitFuenfzehnAbwesenheiten
//   NODE_PATH=$(npm root -g) STUDIO_GROSSSCHULE=/tmp/gross.up STUDIO_PASSWORT=geheim123 node studio/tests/smoke/tagesplanung-gross.cjs
//
// Die Schuldatei entsteht im Lasttest der API (Grossschule.cs). Ablauf je Bildschirmgröße (1280×800 = 13-Zoll-Notebook, 1440×900):
// Schule hochladen → 15 Lehrkräfte mit den meisten Stunden abwesend (drei ab der 3. Stunde) → Tagesplanung öffnet „Fall für Fall“ →
// Doppelstunde wählen: Kandidaten für beide Stunden → Übernehmen: nächster offener Fall gewählt, Klassenliste und Leiste stehen still
// → Verlegen: eine andere Stunde vorziehen, „von …“ bzw. „verlegt auf …“ an ihren Stunden → Z macht es rückgängig → Vorschläge für
// alle → nach abwesender Lehrkraft. Bildschirmfotos in STUDIO_SCREENSHOTS (Standard: Temp-Ordner).
const fs = require('fs');
const h = require('./hilfe.cjs');

const DATEI = process.env.STUDIO_GROSSSCHULE;
const GROESSEN = [[1280, 800], [1440, 900]];

async function vorbereiten() {
  if (!DATEI || !fs.existsSync(DATEI)) throw new Error('STUDIO_GROSSSCHULE: Pfad der großen Schuldatei fehlt (siehe Kopf der Datei).');
  const cookie = await h.apiAnmelden();
  const form = new FormData();
  form.append('datei', new Blob([fs.readFileSync(DATEI)]), 'Gesamtschule Großstadt.up');
  const r = await fetch(`${h.URL}/api/dokumente/hochladen`, { method: 'POST', body: form, headers: { 'X-UntPlan-Studio': '1', cookie } });
  if (!r.ok) throw new Error(`Hochladen: ${r.status} ${await r.text()}`);
  const id = (await r.json()).dokument.id;
  const dok = `/api/dokumente/${id}`;
  const holen = async (p) => (await h.api(dok + p, { headers: { cookie } })).json();
  const senden = async (p, b) => (await h.api(dok + p, { method: 'POST', body: JSON.stringify(b), headers: { cookie } })).json();
  const datum = (await holen('/vertretung/start')).datum;
  const m = await holen(`/vertretung/tagesablauf/matrix?datum=${datum}&art=lehrer`);
  const meiste = m.zeilen.sort((a, b) => b.zellen.length - a.zellen.length || a.k.localeCompare(b.k)).slice(0, 15).map((z) => z.k);
  await senden('/vertretung/absenzen/speichern', { art: 'lehrer', neu: meiste.map((k, i) => ({ id: 0, element: k, von: datum, bis: datum, sv: i >= 12 ? 3 : 1, sb: 99, grund: 'K', text: '' })), alt: [] });
  const f = await holen(`/vertretung/tagesablauf/faelle?datum=${datum}`);
  return { datum, faelle: f.faelle, klassen: f.klassen };
}

/** Lage der Klassenliste und der Spalten der Leiste (zum Vergleich vor und nach einer Entscheidung). */
const lage = (page) => page.evaluate(() => ({
  gruppen: [...document.querySelectorAll('[data-testid=fa-gruppen] [data-gruppe]')].map((x) => `${x.dataset.gruppe}@${x.offsetTop}`).join(),
  leiste: [...document.querySelectorAll('[data-testid=fa-leiste] [data-stunde]')].map((x) => `${x.dataset.stunde}@${Math.round(x.getBoundingClientRect().left)}`).join(),
}));

(async () => {
  const daten = await vorbereiten();
  const block = daten.faelle.find((x) => x.offeneIds.length > 1 && x.klassenIds.length === 1);
  const kBlock = daten.klassen.find((k) => k.id === block.klassenIds[0]).k;
  console.log(`✓ ${daten.faelle.length} Fälle in ${daten.klassen.length} Klassen am ${daten.datum}; Doppelstunde ${kBlock} ${block.fach} ${block.stunden.join('.–')}.`);
  for (const [breite, hoehe] of GROESSEN) {
    const t = await h.starten('studio-shots-tagesplanung-gross', { breite, hoehe });
    const { page } = t;
    const foto = (n) => t.foto(`${breite}-${n}`);
    const schritt = (s) => console.log(`✓ ${breite}×${hoehe}: ${s}`);
    await h.abschliessen(`Fall für Fall ${breite}×${hoehe}`, t, async () => {
      await h.anmelden(page);
      await h.dokumentOffen(page, 'Großstadt');
      await h.modus(page, 'vertretung');
      await h.eintrag(page, 'vertretung.tagesplanung');
      const fa = '[data-testid=faelle]';
      await page.waitForSelector(`${fa} [data-testid=fa-kandidat]`, { timeout: 30000 });
      const hScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (hScroll) throw new Error('Die Seite blättert waagrecht');
      await foto('1-start');
      schritt('Fall für Fall geöffnet, erster offener Fall mit Kandidaten');

      // Doppelstunde: Kandidaten für beide Stunden
      await page.click(`${fa} [data-gruppe="k:${block.klassenIds[0]}"]`);
      await page.click(`${fa} [data-schluessel="${block.schluessel}"]`);
      await page.waitForFunction(() => /beide Stunden/.test(document.querySelector('[data-testid=fa-kandidaten]')?.textContent || ''), null, { timeout: 15000 });
      await page.waitForSelector(`${fa} [data-testid=fa-kandidat]`);
      const gruende = await page.textContent(`${fa} [data-testid=fa-kandidat]`);
      if (!gruende.includes(`frei ${block.stunden[0]}.–${block.stunden[block.stunden.length - 1]}.`)) throw new Error(`Kandidat ohne „frei ${block.stunden.join('.–')}.“: ${gruende}`);
      await foto('2-doppelstunde');
      schritt(`Doppelstunde ${kBlock}: Kandidaten für beide Stunden`);

      // Übernehmen: der nächste offene Fall ist gewählt, Liste und Leiste stehen still
      const vorher = await lage(page);
      const kand = await page.getAttribute(`${fa} [data-testid=fa-kandidat][aria-selected=true]`, 'data-lehrer');
      await page.keyboard.press('Enter');
      await page.waitForFunction((k) => (document.querySelector('[data-testid=fa-zuletzt]')?.textContent || '').includes(k), kand, { timeout: 15000 });
      await page.waitForFunction((s) => document.querySelector('[data-testid=fa-faelle] [aria-selected=true]')?.dataset.schluessel !== s, block.schluessel, { timeout: 15000 });
      await page.click(`${fa} [data-gruppe="k:${block.klassenIds[0]}"]`);
      await page.waitForFunction((s) => document.querySelector(`[data-schluessel="${s}"]`)?.dataset.zustand === 'erledigt', block.schluessel, { timeout: 15000 });
      const nachher = await lage(page);
      if (vorher.gruppen !== nachher.gruppen) throw new Error('Die Klassenliste hat sich verschoben');
      if (vorher.leiste !== nachher.leiste) throw new Error('Die Leiste hat sich verschoben');
      const status = await page.$$eval(`${fa} [data-testid=fa-leiste] [data-stunde]`, (l, st) => l.filter((x) => st.includes(Number(x.dataset.stunde))).map((x) => x.dataset.status), block.stunden);
      if (!status.every((s) => s === 'v')) throw new Error(`Leiste nach dem Übernehmen: ${status}`);
      await foto('3-uebernommen');
      schritt(`Enter: ${kand} für ${kBlock} ${block.stunden.join('.–')}. – nächster Fall gewählt, nichts verschoben`);

      // Verlegen: eine andere Stunde in die Lücke vorziehen
      await page.click(`${fa} [data-testid=fa-gruppen] [data-offen]:not([data-offen="0"])`);
      await page.waitForSelector(`${fa} [data-testid=fa-kandidat], ${fa} [data-testid=fa-keine]`, { timeout: 15000 });
      await page.keyboard.press('v');
      await page.waitForSelector(`${fa} [data-testid=fa-verlegen-liste] :is([data-testid=fa-vorziehen], .fa-leise:not(.fa-laedt))`, { timeout: 15000 });
      await foto('4-verlegen');
      if (await page.locator(`${fa} [data-testid=fa-vorziehen]`).count()) {
        const l1 = await lage(page);
        await page.locator(`${fa} [data-testid=fa-vorziehen]`).first().click();
        await page.waitForFunction(() => (document.querySelector('[data-testid=fa-zuletzt]')?.textContent || '').includes('vorgezogen'), null, { timeout: 15000 });
        await page.waitForSelector(`${fa} [data-testid=fa-leiste] :is(.fa-tag-neu, .fa-tag-entfall)`, { timeout: 15000 });
        const tags = await page.$$eval(`${fa} [data-testid=fa-leiste] .fa-tag`, (l) => l.map((x) => x.textContent));
        if (!tags.some((x) => /^von \d+\.$/.test(x)) || !tags.some((x) => /^verlegt auf \d+\.$/.test(x))) throw new Error(`Verlegung nicht an ihren Stunden: ${tags}`);
        if ((await lage(page)).leiste !== l1.leiste) throw new Error('Die Leiste hat sich beim Verlegen verschoben');
        await foto('5-vorgezogen');
        schritt(`Vorgezogen: ${tags.filter((x) => /von|verlegt/.test(x)).join(' / ')}`);
        await page.keyboard.press('z');
        await page.waitForFunction(() => !document.querySelector('[data-testid=fa-leiste] .fa-tag-entfall'), null, { timeout: 15000 });
        schritt('Z: Vorziehung rückgängig');
      }

      // Vorschläge für alle offenen Fälle (nichts geändert, bis „Alle übernehmen“)
      await page.click('[data-testid=fa-alle-vorschlaege]');
      await page.waitForSelector(`${fa} [data-testid=fa-vorschlagsleiste]`, { timeout: 60000 });
      await foto('6-vorschlaege');
      schritt((await page.textContent(`${fa} [data-testid=fa-vorschlagsleiste] > span`)).trim());
      await page.locator(`${fa} [data-testid=fa-vorschlagsleiste] button`, { hasText: 'Verwerfen' }).click();

      // nach abwesender Lehrkraft
      await page.click(`${fa} [data-testid=fa-nach-lehrer]`);
      await page.waitForSelector('[data-testid=faelle][data-modus=lehrer] [data-gruppe^="l:"]', { timeout: 15000 });
      await page.waitForSelector(`${fa} [data-testid=fa-leiste] [data-status=o]`, { timeout: 15000 });
      await foto('7-nach-lehrkraft');
      schritt('Liste nach abwesender Lehrkraft');
      await page.click(`${fa} [data-testid=fa-nach-klasse]`);
      // Rückgängig der Übernahme (sauberer Stand für die nächste Größe)
      await page.keyboard.press('z');
      await page.waitForTimeout(800);
    });
    if (process.exitCode) break;
  }
})();
