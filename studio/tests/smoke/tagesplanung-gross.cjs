// Oberflächentest „Fall für Fall“ mit einer großen Schule (Playwright, Chromium): 300 Lehrkräfte, 60 Klassen, 15 Abwesenheiten.
//
//   STUDIO_GROSSSCHULE=/tmp/gross.up dotnet test studio/tests/UntPlanStudio.Tests --filter GrosseSchuleMitFuenfzehnAbwesenheiten
//   NODE_PATH=$(npm root -g) STUDIO_GROSSSCHULE=/tmp/gross.up STUDIO_PASSWORT=geheim123 node studio/tests/smoke/tagesplanung-gross.cjs
//
// Die Schuldatei entsteht im Lasttest der API (Grossschule.cs). Ablauf je Bildschirmgröße (1280×800 = 13-Zoll-Notebook, 1440×900):
// Schule hochladen → 15 Lehrkräfte mit den meisten Stunden abwesend (drei ab der 3. Stunde) → Tagesplanung öffnet „Fall für Fall“ →
// Doppelstunde wählen: Kandidaten für beide Stunden → Übernehmen: nächster offener Fall gewählt, Klassenliste und Leiste stehen still
// → Verlegen: eine andere Stunde vorziehen, „von …“ bzw. „verlegt auf …“ an ihren Stunden → Z macht es rückgängig → parallele Gruppen
// (Wahlpflicht geteilt, beide Lehrkräfte fehlen): ein Fall, beide Gruppen übereinander in der Leiste, eine Lehrkraft für beide Gruppen
// (zusammengelegt), Z, dann je Gruppe (Gr. 2 Entfall) → Ziehen: eine Stunde der Leiste in die Lücke ziehen – beim Ziehen zeigen die
// Stunden ihren Stand mit Grund und darunter der Tag der Lehrkraft und des Raums, nichts verschiebt sich; Ablegen = Vorziehen, Z →
// Vorschläge für alle → nach abwesender Lehrkraft. Bildschirmfotos in STUDIO_SCREENSHOTS (Standard: Temp-Ordner).
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
  const sortiert = m.zeilen.sort((a, b) => b.zellen.length - a.zellen.length || a.k.localeCompare(b.k)).map((z) => z.k);
  // dazu beide Lehrkräfte einer geteilten Klasse (Wahlpflicht Gr. 1 / Gr. 2, gleichzeitig): ein Fall mit parallelen Gruppen
  const mk = await holen(`/vertretung/tagesablauf/matrix?datum=${datum}&art=klasse`);
  let paar = null;
  for (const z of mk.zeilen) {
    for (const c of z.zellen) {
      const e = c.e.filter((x) => x.s === 'n' && x.g && x.k.split(',').length === 1);
      const l = [...new Set(e.map((x) => x.l))];
      if (e.length >= 2 && l.length >= 2 && !l.some((x) => sortiert.slice(0, 13).includes(x))) { paar = { lehrer: l.slice(0, 2), klasse: z.id }; break; }
    }
    if (paar) break;
  }
  if (!paar) throw new Error('Keine geteilte Klasse in der großen Schule');
  const meiste = [...sortiert.filter((k) => !paar.lehrer.includes(k)).slice(0, 13), ...paar.lehrer];
  await senden('/vertretung/absenzen/speichern', { art: 'lehrer', neu: meiste.map((k, i) => ({ id: 0, element: k, von: datum, bis: datum, sv: i >= 10 && i < 13 ? 3 : 1, sb: 99, grund: 'K', text: '' })), alt: [] });
  const f = await holen(`/vertretung/tagesablauf/faelle?datum=${datum}`);
  const parallel = f.faelle.find((x) => x.parallel && x.klassenIds.includes(paar.klasse) && x.zustand === 'offen');
  if (!parallel) throw new Error('Kein paralleler Fall');
  // Ziehen: eine reguläre Stunde einer Klasse mit Lücke, die sich in die Lücke ziehen lässt
  const mk2 = await holen(`/vertretung/tagesablauf/matrix?datum=${datum}&art=klasse`);
  let zug = null;
  for (const fa of f.faelle.filter((x) => !x.parallel && x.zustand === 'offen' && x.klassenIds.length === 1 && x.stunden.length === 1 && x.schluessel !== parallel.schluessel)) {
    const z = mk2.zeilen.find((r) => r.id === fa.klassenIds[0]);
    for (const c of z.zellen) {
      const e = c.e.find((x) => x.s === 'n' && x.u && c.e.length === 1);
      if (!e) continue;
      // Einzelstunde (kein Block): die Nachbarstunden gehören zu anderem Unterricht
      const nb = z.zellen.filter((y) => Math.abs(y.s - c.s) === 1 && y.e.some((x) => x.u === e.u));
      if (nb.length) continue;
      const zl = await holen(`/vertretung/tagesablauf/fallziele?datum=${datum}&stunde=${c.s}&unterricht=${e.u}&laenge=1`);
      const ziel = zl.ziele.find((x) => x.status === 'luecke' && x.luecke && x.s === fa.stunden[0]);
      if (ziel) { zug = { klasse: fa.klassenIds[0], fall: fa.schluessel, von: c.s, nach: ziel.s, fach: e.f }; break; }
    }
    if (zug) break;
  }
  return { datum, faelle: f.faelle, klassen: f.klassen, parallel, zug };
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
      if (daten.zug) {
        await page.click(`${fa} [data-gruppe="k:${daten.zug.klasse}"]`);
        await page.click(`${fa} [data-schluessel="${daten.zug.fall}"]`);
      } else await page.click(`${fa} [data-testid=fa-gruppen] [data-offen]:not([data-offen="0"])`);
      await page.waitForSelector(`${fa} [data-testid=fa-kandidat], ${fa} [data-testid=fa-keine]`, { timeout: 15000 });
      await page.keyboard.press('v');
      await page.waitForSelector(`${fa} [data-testid=fa-verlegen-liste] :is([data-testid=fa-vorziehen], .fa-leise:not(.fa-laedt))`, { timeout: 15000 });
      await foto('4-verlegen');
      if (await page.locator(`${fa} [data-testid=fa-vorziehen]`).count()) {
        const l1 = await lage(page);
        await page.locator(`${fa} [data-testid=fa-vorziehen]`).first().click();
        await page.waitForFunction(() => (document.querySelector('[data-testid=fa-zuletzt]')?.textContent || '').includes('vorgezogen'), null, { timeout: 15000 });
        // danach ist der nächste offene Fall gewählt (ggf. in einer anderen Klasse) – zurück zur Klasse
        if (daten.zug) await page.click(`${fa} [data-gruppe="k:${daten.zug.klasse}"]`);
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

      // parallele Gruppen: ein Fall, beide Gruppen übereinander in der Leiste, eine Lehrkraft für beide Gruppen
      const pf = daten.parallel;
      const pk = daten.klassen.find((k) => k.id === pf.klassenIds[0]).k;
      await page.click(`${fa} [data-gruppe="k:${pf.klassenIds[0]}"]`);
      await page.click(`${fa} [data-schluessel="${pf.schluessel}"]`);
      await page.waitForSelector(`${fa} [data-testid=fa-entscheidung][data-parallel="2"]`, { timeout: 15000 });
      await page.waitForSelector(`${fa} [data-testid=fa-kandidaten] :is([data-testid=fa-kandidat], [data-testid=fa-keine])`, { timeout: 20000 });
      if ((await page.locator(`${fa} [data-testid=fa-teil]`).count()) !== 2) throw new Error('Gruppen fehlen in der Entscheidung');
      const gruppenZellen = await page.$$eval(`${fa} [data-testid=fa-leiste] [data-gruppen="2"]`, (l) => l.map((x) => Number(x.dataset.stunde)));
      if (!pf.stunden.every((s) => gruppenZellen.includes(s))) throw new Error(`Gruppen nicht übereinander in der Leiste: ${gruppenZellen}`);
      const label = await page.textContent(`${fa} [data-testid=fa-kandidaten] .fa-e-label`);
      if (!/beide Gruppen/.test(label)) throw new Error(`Kandidaten nicht für beide Gruppen: ${label}`);
      await foto('8-parallel');
      schritt(`Paralleler Fall ${pk} ${pf.stunden.join('.–')}. ${pf.fach}: ${label}`);
      if (await page.locator(`${fa} [data-testid=fa-kandidat]`).count()) {
        const lp = await lage(page);
        const kp = await page.getAttribute(`${fa} [data-testid=fa-kandidat][aria-selected=true]`, 'data-lehrer');
        await page.keyboard.press('Enter');
        await page.waitForFunction((k) => (document.querySelector('[data-testid=fa-zuletzt]')?.textContent || '').includes(`${k} für beide Gruppen`), kp, { timeout: 15000 });
        await page.click(`${fa} [data-gruppe="k:${pf.klassenIds[0]}"]`);
        await page.click(`${fa} [data-schluessel="${pf.schluessel}"]`);
        await page.waitForFunction((s) => document.querySelector(`[data-schluessel="${s}"]`)?.dataset.zustand === 'erledigt', pf.schluessel, { timeout: 15000 });
        const st = await page.$$eval(`${fa} [data-testid=fa-leiste] [data-stunde="${pf.stunden[0]}"] .fa-karte`, (l) => l.map((x) => [...x.classList].find((c) => c.startsWith('fa-st-'))));
        if (st.length !== 2 || !st.every((x) => x === 'fa-st-v')) throw new Error(`Gruppen nach dem Zusammenlegen: ${st}`);
        if ((await lage(page)).leiste !== lp.leiste) throw new Error('Die Leiste hat sich beim Zusammenlegen verschoben');
        await foto('9-parallel-geloest');
        schritt(`Enter: ${kp} für beide Gruppen (zusammengelegt), beide Karten grün`);
        await page.keyboard.press('z');
        await page.waitForFunction((s) => document.querySelector(`[data-schluessel="${s}"]`)?.dataset.zustand === 'offen', pf.schluessel, { timeout: 15000 });
      }
      // je Gruppe: Gr. 2 entfällt, Gr. 1 bleibt offen
      await page.locator(`${fa} [data-testid=fa-teil-einzeln]`).nth(1).click();
      await page.waitForSelector(`${fa} [data-testid=fa-entscheidung][data-teil]`, { timeout: 15000 });
      await page.waitForSelector(`${fa} [data-testid=fa-teil-zurueck]`);
      await page.keyboard.press('e');
      await page.waitForFunction((s) => document.querySelector(`[data-schluessel="${s}"]`)?.dataset.zustand === 'teilweise', pf.schluessel, { timeout: 15000 });
      await page.waitForSelector(`${fa} [data-testid=fa-entscheidung]:is([data-teil], [data-parallel])`, { timeout: 15000 });
      const st2 = await page.$$eval(`${fa} [data-testid=fa-leiste] [data-stunde="${pf.stunden[0]}"] .fa-karte`, (l) => l.map((x) => [...x.classList].find((c) => c.startsWith('fa-st-'))));
      if (!st2.includes('fa-st-e') || !st2.includes('fa-st-o')) throw new Error(`Gruppe 2 nicht entfallen: ${st2}`);
      await foto('10-gruppe-einzeln');
      schritt(`Gruppe einzeln: ${pf.parallel[1].fach} ${pf.parallel[1].gruppe} Entfall, ${pf.parallel[0].fach} ${pf.parallel[0].gruppe} weiter offen`);
      await page.keyboard.press('z');
      await page.waitForFunction((s) => document.querySelector(`[data-schluessel="${s}"]`)?.dataset.zustand === 'offen', pf.schluessel, { timeout: 15000 });

      // Ziehen: eine Stunde der Leiste in die Lücke – Stand je Stunde mit Grund, darunter der Tag der Lehrkraft und des Raums
      if (daten.zug) {
        const z = daten.zug;
        await page.click(`${fa} [data-gruppe="k:${z.klasse}"]`);
        await page.click(`${fa} [data-schluessel="${z.fall}"]`);
        await page.waitForSelector(`${fa} [data-testid=fa-leiste] [data-stunde="${z.von}"] .fa-karte.ziehbar`);
        const l0 = await lage(page);
        const quelle = await page.locator(`${fa} [data-testid=fa-leiste] [data-stunde="${z.von}"] .fa-karte`).first().boundingBox();
        const ziel = await page.locator(`${fa} [data-testid=fa-leiste] [data-stunde="${z.nach}"]`).boundingBox();
        await page.mouse.move(quelle.x + quelle.width / 2, quelle.y + 20);
        await page.mouse.down();
        for (let i = 1; i <= 12; i++) await page.mouse.move(quelle.x + quelle.width / 2 + ((ziel.x - quelle.x) * i) / 12, quelle.y + 20 + ((ziel.y - quelle.y) * i) / 12);
        await page.waitForSelector(`${fa} [data-testid=fa-ziehplan] [data-testid=tagesreihe]`, { timeout: 15000 });
        await page.waitForSelector(`${fa} [data-testid=fa-leiste][data-zieht=bereit]`, { timeout: 15000 });
        await page.mouse.move(ziel.x + ziel.width / 2, ziel.y + 30);
        await page.waitForFunction((s) => document.querySelector(`[data-testid=fa-leiste] [data-stunde="${s}"]`)?.classList.contains('dz-ueber'), z.nach, { timeout: 5000 });
        const stand = await page.$$eval(`${fa} [data-testid=fa-leiste] [data-stunde]`, (l) => l.map((x) => `${x.dataset.stunde}:${x.dataset.ziel || '-'}`));
        if (!stand.includes(`${z.nach}:luecke`) || !stand.includes(`${z.von}:quelle`)) throw new Error(`Ziele beim Ziehen: ${stand}`);
        const reihen = await page.$$eval(`${fa} [data-testid=fa-ziehplan] [data-testid=tagesreihe]`, (l) => l.map((x) => `${x.dataset.typ} ${x.dataset.kurz}`));
        if (!reihen.some((x) => x.startsWith('lehrer'))) throw new Error(`Kein Lehrerplan beim Ziehen: ${reihen}`);
        const spalten = await page.$$eval(`${fa} [data-testid=fa-ziehplan] [data-testid=tagesreihe]`, (l) => l[0].querySelectorAll('.mp-reihe-zelle').length);
        if (spalten !== (await page.locator(`${fa} [data-testid=fa-leiste] [data-stunde]`).count())) throw new Error(`Lehrerplan nicht in den Spalten der Leiste: ${spalten}`);
        if ((await lage(page)).leiste !== l0.leiste || (await lage(page)).gruppen !== l0.gruppen) throw new Error('Beim Ziehen hat sich etwas verschoben');
        await page.waitForTimeout(300);
        await foto('11-ziehen');
        schritt(`Ziehen ${z.fach} ${z.von}. → ${z.nach}.: ${stand.filter((x) => !x.endsWith('-')).length} Stunden mit Stand, Pläne ${reihen.join(', ')} (${spalten} Spalten)`);
        await page.mouse.up();
        await page.waitForFunction(() => (document.querySelector('[data-testid=fa-zuletzt]')?.textContent || '').includes('vorgezogen'), null, { timeout: 15000 });
        await page.waitForFunction((s) => document.querySelector(`[data-schluessel="${s}"]`)?.dataset.zustand === 'erledigt', z.fall, { timeout: 15000 }).catch(async () => {
          await page.click(`${fa} [data-gruppe="k:${z.klasse}"]`);
          await page.waitForFunction((s) => document.querySelector(`[data-schluessel="${s}"]`)?.dataset.zustand === 'erledigt', z.fall, { timeout: 15000 });
        });
        if (await page.locator(`${fa} [data-testid=fa-ziehplan]`).count()) throw new Error('Der Ziehplan bleibt nach dem Ablegen stehen');
        await page.click(`${fa} [data-gruppe="k:${z.klasse}"]`);
        await page.waitForSelector(`${fa} [data-testid=fa-leiste] .fa-tag-neu`, { timeout: 15000 });
        const tags = await page.$$eval(`${fa} [data-testid=fa-leiste] .fa-tag`, (l) => l.map((x) => x.textContent));
        if (!tags.includes(`von ${z.von}.`)) throw new Error(`Nach dem Ablegen: ${tags}`);
        if ((await lage(page)).leiste !== l0.leiste) throw new Error('Die Leiste hat sich beim Ablegen verschoben');
        await foto('12-gezogen');
        schritt(`Abgelegt: ${z.fach} aus der ${z.von}. in die ${z.nach}. vorgezogen (${tags.filter((x) => /von|verlegt/.test(x)).join(' / ')})`);
        await page.keyboard.press('z');
        await page.waitForFunction((s) => document.querySelector(`[data-schluessel="${s}"]`)?.dataset.zustand === 'offen', z.fall, { timeout: 15000 });
        schritt('Z: Ziehen rückgängig');
      } else console.log('– keine Stunde zum Ziehen in eine Lücke gefunden');

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
