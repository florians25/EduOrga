// Gemeinsame Hilfen der Oberflächentests (Playwright, Chromium) für UntPlan Studio (React + Fluent UI, studio/client).
//
// Umgebungsvariablen: STUDIO_URL (Standard http://127.0.0.1:5501), STUDIO_BENUTZER (admin), STUDIO_PASSWORT (geheim123),
// STUDIO_SCREENSHOTS (Ordner für Bildschirmfotos), PLAYWRIGHT_BROWSERS_PATH (z. B. /opt/pw-browsers).
//
// Selektoren der Oberfläche: Seiten und Bereiche tragen [data-ansicht="<typ>"], Tabellen [data-tabelle="<name>"] mit Zeilen
// .tb-zeile und Zellen .tb-zelle, Stundenpläne .ra-eintrag (Stunde) und .ra-feld (Ablage, beim Ziehen .ziel-<Status>),
// Einträge der Seitenleiste [data-nav="<id>"]. Befehle ohne Navigation führt window.studioTest.eintrag(id) aus.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');

const URL = process.env.STUDIO_URL || 'http://127.0.0.1:5501';
const BENUTZER = process.env.STUDIO_BENUTZER || 'admin';
const PASSWORT = process.env.STUDIO_PASSWORT || 'geheim123';

async function api(pfad, optionen = {}) {
  const r = await fetch(URL + pfad, { ...optionen, headers: { 'X-UntPlan-Studio': '1', 'Content-Type': 'application/json', ...(optionen.headers || {}) } });
  if (!r.ok) throw new Error(`${pfad}: ${r.status} ${await r.text()}`);
  return r;
}

/** Anmeldung über die API; liefert das Sitzungs-Cookie. */
async function apiAnmelden(benutzer = BENUTZER, passwort = PASSWORT) {
  const anm = await api('/api/anmeldung', { method: 'POST', body: JSON.stringify({ benutzer, passwort }) });
  return anm.headers.get('set-cookie').split(';')[0];
}

/** Beispielschule über die API anlegen (wird „zuletzt geöffnet“ und beim Anmelden wieder geöffnet). */
async function beispielschule(cookie) {
  return (await api('/api/dokumente/beispiel', { method: 'POST', body: '{}', headers: { cookie } })).json();
}

/** Browser starten; sammelt Fehler aus der Seite (Konsole, Ausnahmen). */
async function starten(ordner, { breite = 1600, hoehe = 950 } = {}) {
  const bilder = process.env.STUDIO_SCREENSHOTS || path.join(os.tmpdir(), ordner);
  fs.mkdirSync(bilder, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: breite, height: hoehe } });
  const fehler = [];
  page.on('pageerror', (e) => fehler.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 4\d\d/.test(m.text())) fehler.push(m.text()); });
  const foto = async (n) => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(bilder, n.endsWith('.png') ? n : `${n}.png`) }); };
  return { browser, page, fehler, foto, bilder };
}

/** In der Oberfläche anmelden und warten, bis sie bereit ist. */
async function anmelden(page, benutzer = BENUTZER, passwort = PASSWORT) {
  await page.goto(URL);
  await page.waitForSelector('input[name=benutzer], [data-testid=suche]');
  if (await page.locator('input[name=benutzer]').count()) {
    await page.fill('input[name=benutzer]', benutzer);
    await page.fill('input[name=passwort]', passwort);
    await page.click('button[type=submit]');
  }
  await page.waitForFunction(() => document.body.dataset.bereit === '1', null, { timeout: 20000 });
  await page.waitForSelector('[data-nav]');
}

/** Warten, bis ein Dokument geöffnet ist (Name im Dokumentmenü der Kopfleiste). */
async function dokumentOffen(page, teil = 'Beispiel') {
  await page.waitForFunction((t) => (document.querySelector('[data-testid=dokument-menue]')?.textContent || '').includes(t), teil, { timeout: 20000 });
}

/** Befehlseintrag ausführen: über die Seitenleiste, wenn sichtbar, sonst wie die Befehlssuche. */
async function eintrag(page, id) {
  const k = page.locator(`[data-nav="${id}"]`);
  if (await k.count() && await k.first().isVisible()) return k.first().click();
  return page.evaluate((x) => window.studioTest.eintrag(x), id);
}

/** Seite direkt über ihre Adresse öffnen (Routing im Browser, ohne Neuladen). */
async function seite(page, adresse) {
  await page.evaluate((a) => { window.history.pushState({}, '', a); window.dispatchEvent(new PopStateEvent('popstate')); }, adresse);
}

/** Arbeitsmodus wechseln (Tab in der Kopfleiste). */
async function modus(page, name) {
  await page.getByRole('tab', { name: name === 'vertretung' ? 'Vertretungsplanung' : 'Stundenplanung', exact: true }).click();
  await page.waitForTimeout(300);
}

/** Werkzeugknopf einer Ansicht (Text) anklicken. */
async function werkzeug(page, ansicht, text) {
  await page.locator(`[data-ansicht="${ansicht}"] [role=toolbar] button`, { hasText: text }).first().click();
}

/** Offenen Dialog über einen Knopf (Text) schließen bzw. bestätigen. */
async function dialogKnopf(page, text) {
  await page.locator('[role=dialog] button', { hasText: text }).last().click();
}

async function abschliessen(name, { browser, page, fehler, foto, bilder }, ablauf) {
  try {
    await ablauf();
    if (fehler.length) throw new Error('Fehler in der Seite:\n' + fehler.join('\n'));
    console.log(`${name} bestanden. Bildschirmfotos: ${bilder}`);
  } catch (e) {
    await foto('fehler').catch(() => {});
    console.error(e);
    if (fehler.length) console.error('Fehler in der Seite:\n' + fehler.join('\n'));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

module.exports = { URL, BENUTZER, PASSWORT, api, apiAnmelden, beispielschule, starten, anmelden, dokumentOffen, eintrag, seite, modus, werkzeug, dialogKnopf, abschliessen };
