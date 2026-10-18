// Oberflächen-Smoke-Test für UntPlan Studio (Playwright, Chromium).
//
//   NODE_PATH=$(npm root -g) node studio/tests/smoke/smoke.cjs
//
// Umgebungsvariablen: STUDIO_URL (Standard http://127.0.0.1:5501), STUDIO_BENUTZER (admin), STUDIO_PASSWORT,
// STUDIO_SCREENSHOTS (Ordner für Bildschirmfotos), PLAYWRIGHT_BROWSERS_PATH (z. B. /opt/pw-browsers).
// Ablauf: Anmelden → Beispiel-Schuldatei als .up hochladen (Datei → Öffnen) → Lehrkräfte öffnen und einen Wert in der Tabelle
// ändern → Klassenplan, Unterricht, Arbeitsplatz „Manuell planen“ → Vertretungsmodus → Bildschirmfotos.
const { chromium } = require('playwright');

// Befehl über die Navigation auslösen (Eintrag in der Seitenleiste, sonst über das Modulsystem).
async function eintrag(page, id) {
  const k = page.locator(`.nav-punkt[data-id="${id}"]`);
  if (await k.count() && await k.first().isVisible()) return k.first().click();
  return page.evaluate(async (id) => { const m = await import('/js/kern/modulsystem.js'); const e = m.alleRibbonEintraege().find((x) => x.id === id); if (!e) throw new Error(`Eintrag ${id} fehlt`); return m.eintragAusfuehren(e); }, id);
}
const fs = require('fs');
const path = require('path');
const os = require('os');

const URL = process.env.STUDIO_URL || 'http://127.0.0.1:5501';
const BENUTZER = process.env.STUDIO_BENUTZER || 'admin';
const PASSWORT = process.env.STUDIO_PASSWORT || 'geheim123';
const BILDER = process.env.STUDIO_SCREENSHOTS || path.join(os.tmpdir(), 'studio-shots');

async function api(pfad, optionen = {}) {
  const r = await fetch(URL + pfad, { ...optionen, headers: { 'X-UntPlan-Studio': '1', 'Content-Type': 'application/json', ...(optionen.headers || {}) } });
  if (!r.ok) throw new Error(`${pfad}: ${r.status} ${await r.text()}`);
  return r;
}

(async () => {
  fs.mkdirSync(BILDER, { recursive: true });
  // Beispiel-Schuldatei (.up) über die API erzeugen und herunterladen
  const anm = await api('/api/anmeldung', { method: 'POST', body: JSON.stringify({ benutzer: BENUTZER, passwort: PASSWORT }) });
  const cookie = anm.headers.get('set-cookie').split(';')[0];
  const stand = await (await api('/api/dokumente/beispiel', { method: 'POST', body: '{}', headers: { cookie } })).json();
  const up = Buffer.from(await (await api(`/api/dokumente/${stand.id}/herunterladen`, { headers: { cookie } })).arrayBuffer());
  await api(`/api/dokumente/${stand.id}`, { method: 'DELETE', headers: { cookie } });
  const upDatei = path.join(BILDER, 'Beispielschule.up');
  fs.writeFileSync(upDatei, up);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const fehler = [];
  page.on('pageerror', (e) => fehler.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') fehler.push(m.text()); });

  try {
  await page.goto(URL);
  await page.fill('input[name=benutzer]', BENUTZER);
  await page.fill('input[name=passwort]', PASSWORT);
  await page.click('button[type=submit]');
  await page.waitForSelector('.navigation .nav-punkt');
  await page.screenshot({ path: path.join(BILDER, '01-start.png') });

  // Datei → Öffnen → Hochladen
  // ohne zuletzt geöffnete Datei (frische Installation) ist die Dateiansicht schon offen
  if (!(await page.isVisible('.backstage'))) await page.click('.nav-punkt[data-id="nav:dateien"]');
  await page.click('.backstage nav button[data-seite=oeffnen]');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('.backstage .ablage button')]);
  await chooser.setFiles(upDatei);
  await page.waitForFunction(() => document.title.startsWith('Beispielschule'), null, { timeout: 15000 });
  await page.waitForSelector('.backstage', { state: 'detached' });

  // Dateneingabe → Lehrer
  await eintrag(page, 'eingabe.lehrer');
  await page.waitForSelector('.fenster[data-typ=stammdaten] .t-zeile');
  // Wert ändern: erste Zeile, Spalte Nachname
  const zelle = page.locator('.fenster[data-typ=stammdaten] .t-zeile[data-r="0"] .t-zelle').nth(1);
  await zelle.dblclick();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Smoketest');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => [...document.querySelectorAll('.fenster[data-typ=stammdaten] .t-zelle')].some((z) => z.textContent === 'Smoketest'));

  // Stundenpläne → Klassenplan (eigene Seite)
  await eintrag(page, 'stundenplaene.klasse');
  await page.waitForSelector('.fenster[data-typ=stundenplan] .r-eintrag');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(BILDER, '02-stundenplan.png') });

  // Unterricht der Klasse
  await eintrag(page, 'eingabe.unterricht.klassen');
  await page.waitForSelector('.fenster[data-typ=unterricht] .t-zeile');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(BILDER, '03-unterricht.png') });

  // Arbeitsplatz „Manuell planen“: Unterricht und Klassenplan nebeneinander
  await page.evaluate(async () => { const m = await import('/js/kern/modulsystem.js'); await m.befehl('fenster.standard'); });
  await page.waitForSelector('.fenster[data-typ=unterricht] .t-zeile');
  await page.waitForSelector('.fenster[data-typ=stundenplan] .r-eintrag');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(BILDER, '03b-manuell-planen.png') });

  // Vertretungsmodus (grün)
  await eintrag(page, 'start.vertretungsmodus');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(BILDER, '04-vertretungsmodus.png') });
  await eintrag(page, 'vertretung.modus');
  } catch (e) {
    await page.screenshot({ path: path.join(BILDER, 'fehler.png') }).catch(() => {});
    console.error('Seitenfehler:', fehler.join('\n'));
    throw e;
  }

  await browser.close();
  if (fehler.length) {
    console.error('Fehler in der Seite:\n' + fehler.join('\n'));
    process.exit(1);
  }
  console.log(`Smoke-Test bestanden. Bildschirmfotos: ${BILDER}`);
})().catch((e) => { console.error(e); process.exit(1); });
