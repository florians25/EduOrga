// Oberflächen-Smoke-Test der Module Import/Export, UntPlanWeb, Wertrechnung/Statistik, Pausenaufsichten, Kursplanung,
// Kommentare und MultiUser (Playwright, Chromium). Ein gemockter UntPlanWeb-Server (Node http) nimmt den Export an und
// liefert eine Prüfung als Stundenplanänderung.
//
//   NODE_PATH=$(npm root -g) STUDIO_URL=http://127.0.0.1:5514 STUDIO_PASSWORT=geheim123 node studio/tests/smoke/smoke-austausch.cjs
//
// Umgebungsvariablen wie smoke.cjs (STUDIO_URL, STUDIO_BENUTZER, STUDIO_PASSWORT, STUDIO_SCREENSHOTS).
const { chromium } = require('playwright');

// Befehl über die Navigation auslösen (Eintrag in der Seitenleiste, sonst über das Modulsystem).
async function eintrag(page, id) {
  const k = page.locator(`.nav-punkt[data-id="${id}"]`);
  if (await k.count() && await k.first().isVisible()) return k.first().click();
  return page.evaluate(async (id) => { const m = await import('/js/kern/modulsystem.js'); const e = m.alleRibbonEintraege().find((x) => x.id === id); if (!e) throw new Error(`Eintrag ${id} fehlt`); return m.eintragAusfuehren(e); }, id);
}
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const URL = process.env.STUDIO_URL || 'http://127.0.0.1:5501';
const BENUTZER = process.env.STUDIO_BENUTZER || 'admin';
const PASSWORT = process.env.STUDIO_PASSWORT || 'geheim123';
const BILDER = process.env.STUDIO_SCREENSHOTS || path.join(os.tmpdir(), 'studio-shots-austausch');

async function api(pfad, optionen = {}, cookie = '') {
  const r = await fetch(URL + pfad, { ...optionen, headers: { 'X-UntPlan-Studio': '1', 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}), ...(optionen.headers || {}) } });
  if (!r.ok) throw new Error(`${pfad}: ${r.status} ${await r.text()}`);
  return r;
}
const anmelden = async (b, p) => (await api('/api/anmeldung', { method: 'POST', body: JSON.stringify({ benutzer: b, passwort: p }) })).headers.get('set-cookie').split(';')[0];

/** Attrappe des UntPlanWeb-Servers. */
function attrappe(rueckmeldungen) {
  const empfangen = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const json = (x) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(x)); };
      if (req.url.endsWith('/status')) return json({ schule: 'Attrappe-Gymnasium' });
      if (req.method === 'PUT' && req.url.endsWith('/untplanweb')) { const p = JSON.parse(body); empfangen.push(p); return json({ ok: true, revision: p.revision }); }
      if (req.url.endsWith('/rueckmeldungen')) return json(rueckmeldungen);
      if (req.url.endsWith('/quittieren')) return json({});
      res.writeHead(404); res.end();
    });
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ server, port: server.address().port, empfangen })));
}

(async () => {
  fs.mkdirSync(BILDER, { recursive: true });
  const cookie = await anmelden(BENUTZER, PASSWORT);
  const stand = await (await api('/api/dokumente/beispiel', { method: 'POST', body: '{}' }, cookie)).json();
  const dok = `/api/dokumente/${stand.id}`;
  // Tag der Prüfung: nächster Werktag
  const tag = new Date();
  let iso = '';
  for (let i = 0; i < 120; i++) {
    tag.setDate(tag.getDate() + 1);
    iso = tag.toISOString().slice(0, 10);
    if ((await (await api(`${dok}/pausenaufsicht/vertretung/${iso}`, {}, cookie)).json()).unterrichtstag) break;
  }
  const el = await (await api(`${dok}/elemente?typen=klasse,lehrer,raum`, {}, cookie)).json();
  const web = await attrappe([{ id: 'klausur-1', typ: 'klausur', absender: 'MÜL', von: iso, stundeVon: 2, stundeBis: 3, titel: 'Mathe-Klausur', klassen: [el.klasse[0].k], lehrer: el.lehrer[0].k, raeume: [el.raum[0].k] }]);
  await api(`${dok}/untplanweb/einstellungen`, { method: 'PUT', body: JSON.stringify({ schulId: '123456', server: '127.0.0.1', port: web.port, https: false, apiSchluessel: 'geheim' }) }, cookie);
  // zweiter Benutzer für MultiUser
  try { await api('/api/benutzer', { method: 'POST', body: JSON.stringify({ name: 'pia', anzeigename: 'Pia Planer', rolle: 'Planer', passwort: 'planer-pw' }) }, cookie); } catch { /* vorhanden */ }
  const pia = await anmelden('pia', 'planer-pw');
  await api(`${dok}/multiuser?taetigkeit=${encodeURIComponent('Vertretungen')}`, {}, pia);
  await api(`${dok}/multiuser/sperren`, { method: 'POST', body: JSON.stringify({ bereich: 'Kursplanung' }) }, pia);
  // Gang mit Aufsicht für die Pausenaufsichten
  const gaenge = (await (await api(`${dok}/pausenaufsicht`, {}, cookie)).json()).gaenge;
  if (!gaenge.length) await api(`${dok}/stammdaten/gang`, { method: 'POST', body: JSON.stringify({ kurzname: 'Hof' }) }, cookie);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const fehler = [];
  page.on('pageerror', (e) => fehler.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/423|Locked/.test(m.text())) fehler.push(m.text()); });
  const foto = (name) => page.screenshot({ path: path.join(BILDER, name) });
  const reiter = async (name) => {}; // Reiter gibt es nicht mehr – Navigation ist immer sichtbar
  const ansichtZu = (typ) => page.evaluate(async (typ) => (await import('/js/kern/fenster.js')).fensterverwaltung.alle().find((f) => f.typ === typ)?.schliessen(), typ);
  const allesZu = async () => { await page.evaluate(async () => (await import('/js/kern/fenster.js')).fensterverwaltung.alleSchliessen()); };

  try {
    await page.goto(URL);
    await page.fill('input[name=benutzer]', BENUTZER);
    await page.fill('input[name=passwort]', PASSWORT);
    await page.click('button[type=submit]');
    await page.waitForSelector('.navigation .nav-punkt');
    await page.waitForFunction(() => document.title.includes(' – UntPlan'), null, { timeout: 15000 });
    if (await page.isVisible('.backstage')) await page.keyboard.press('Escape');

    // ---- UntPlanWeb ----
    await reiter('Module');
    await eintrag(page, 'module.untplanweb');
    await page.waitForSelector('.fenster[data-typ=untplanweb] .upw-zeile-teil');
    await page.click('.fenster[data-typ=untplanweb] button[data-teil=vertretungen]');
    await page.waitForSelector('.dialog .d-inhalt:has-text("erfolgreich")', { timeout: 30000 });
    await foto('01-untplanweb-export-erfolg.png');
    await page.click('.dialog .knopf.primaer');
    await page.waitForSelector('.fenster[data-typ=untplanweb] .upw-status .upw-statustext:has-text("übertragen")');
    if (!web.empfangen.length) throw new Error('Die Attrappe hat kein Paket erhalten.');
    await foto('02-untplanweb-fenster.png');

    // Stundenplanänderungen
    await page.click('.fenster[data-typ=untplanweb] button[data-teil=stpl-aenderungen]');
    await page.waitForSelector('.fenster[data-typ="untplanweb.stpl"] .t-kopf');
    await page.waitForTimeout(600);
    await page.fill('.fenster[data-typ="untplanweb.stpl"] input[type=date] >> nth=1', iso);
    await page.click('.fenster[data-typ="untplanweb.stpl"] button:text-is("Laden")');
    await page.waitForSelector('.fenster[data-typ="untplanweb.stpl"] .t-zeile:has-text("Mathe-Klausur")', { timeout: 15000 });
    await page.click('.fenster[data-typ="untplanweb.stpl"] .fenster-werkzeuge button:has-text("Prüfungen markieren")');
    await foto('03-stundenplanaenderungen.png');
    await page.click('.fenster[data-typ="untplanweb.stpl"] .fenster-werkzeuge button:has-text("Übernehmen")');
    await page.waitForSelector('.fenster[data-typ="untplanweb.stpl"] .fenster-fuss:has-text("übernommen")');
    await ansichtZu('untplanweb.stpl');
    // Klausuren
    await page.click('.fenster[data-typ=untplanweb] .fenster-werkzeuge button:has-text("Klausuren")');
    await page.waitForSelector('.fenster[data-typ="untplanweb.klausuren"] .t-zeile:has-text("Mathe-Klausur")');
    await foto('04-klausuren.png');
    await ansichtZu('untplanweb.klausuren');
    // Einstellungen-Dialog
    await page.click('.fenster[data-typ=untplanweb] .fenster-werkzeuge button:has-text("Einstellungen")');
    await page.waitForSelector('.dialog .upw-einstellungen');
    await page.click('.dialog button:has-text("Verbindung prüfen")');
    await page.waitForSelector('.dialog .upw-pruefung.ok');
    await foto('05-untplanweb-einstellungen.png');
    await page.click('.dialog .knopf:text-is("Abbrechen")');
    await allesZu();

    // ---- Import/Export ----
    await reiter('Dateneingabe');
    await eintrag(page, 'eingabe.importexport');
    await page.click('.menue .m-eintrag:has-text("Import und Export …")');
    await page.waitForSelector('.fenster[data-typ=austausch] .ax-karte');
    await foto('06-import-export.png');
    await allesZu();

    // ---- Wertrechnung / Statistik ----
    await reiter('Module');
    await eintrag(page, 'module.sollist');
    await page.waitForSelector('.fenster[data-typ="abrechnung.wertrechnung"] .t-zeile');
    await foto('07-wertrechnung-soll-ist.png');
    await page.click('.fenster[data-typ="abrechnung.wertrechnung"] .abr-reiter button:text-is("Unterrichtsmatrix")');
    await page.waitForSelector('.fenster[data-typ="abrechnung.wertrechnung"] .t-zeile');
    await foto('08-unterrichtsmatrix.png');
    await page.click('.fenster[data-typ="abrechnung.wertrechnung"] .abr-reiter button:text-is("Stundentafel")');
    await page.click('.fenster[data-typ="abrechnung.wertrechnung"] button:text-is("NRW-Jahrgänge eintragen")');
    await page.waitForSelector('.fenster[data-typ="abrechnung.wertrechnung"] .abr-links .t-zeile');
    await foto('09-stundentafel.png');
    await allesZu();
    await eintrag(page, 'module.statistik');
    await page.waitForSelector('.fenster[data-typ="abrechnung.statistik"] .abr-summe');
    await foto('10-vertretungsstatistik.png');
    await allesZu();

    // ---- Pausenaufsichten ----
    await reiter('Start');
    await eintrag(page, 'start.pausenaufsichten');
    await page.waitForSelector('.fenster[data-typ=pausenaufsicht] .pa-zelle');
    await page.click('.fenster[data-typ=pausenaufsicht] .fenster-werkzeuge button:has-text("Optimierung")');
    await page.click('.dialog .knopf.primaer');
    await page.waitForTimeout(800);
    await page.click('.fenster[data-typ=pausenaufsicht] .pa-zelle >> nth=0');
    await page.click('.fenster[data-typ=pausenaufsicht] .fenster-werkzeuge button:has-text("Vorschlag")');
    await page.waitForSelector('.dialog .pa-vorschlag .t-zeile');
    await foto('11-pausenaufsicht-vorschlag.png');
    await page.click('.dialog .knopf:text-is("Abbrechen")');
    await foto('12-pausenaufsichten.png');
    await allesZu();

    // ---- Kursplanung, Kommentare ----
    await eintrag(page, 'start.kursplanung');
    await page.waitForSelector('.fenster[data-typ=kursplanung] .kp-status');
    await foto('13-kursplanung.png');
    await allesZu();
    await reiter('Dateneingabe');
    await eintrag(page, 'eingabe.kommentare');
    await page.waitForSelector('.fenster[data-typ=kommentare]');
    await page.click('.fenster[data-typ=kommentare] .fenster-werkzeuge button:has-text("Neu")');
    await page.waitForSelector('.dialog textarea');
    await page.fill('.dialog textarea', 'Teilzeit ab Februar');
    await page.click('.dialog .knopf.primaer');
    await page.waitForSelector('.fenster[data-typ=kommentare] .t-zeile:has-text("Teilzeit")');
    await foto('14-kommentare.png');
    await allesZu();

    // ---- MultiUser ----
    await page.click('.kl-praesenz .mu-feld');
    await page.waitForSelector('.fenster[data-typ=multiuser] .mu-tabelle');
    await page.waitForSelector('.fenster[data-typ=multiuser] td:has-text("Pia Planer")');
    await foto('15-multiuser.png');
    if (!(await page.textContent('.kl-praesenz .mu-feld')).includes('aktiv')) throw new Error('Anzeige der aktiven Benutzer in der Kopfleiste fehlt.');
    await page.click('.fenster[data-typ=multiuser] .fenster-werkzeuge button:has-text("Gruppen und Rechte")');
    await page.waitForSelector('.fenster[data-typ="multiuser.verwaltung"] .mu-tabelle');
    await foto('16-multiuser-gruppen.png');

    if (fehler.length) throw new Error('Fehler im Browser:\n' + fehler.join('\n'));
    console.log(`Smoke Austausch OK – Bildschirmfotos in ${BILDER}`);
  } catch (e) {
    await foto('fehler.png').catch(() => {});
    console.error(e);
    process.exitCode = 1;
  } finally {
    await browser.close();
    web.server.close();
    await api(`${dok}/multiuser/abmelden`, { method: 'POST', body: '{}' }, pia).catch(() => {});
  }
})();
