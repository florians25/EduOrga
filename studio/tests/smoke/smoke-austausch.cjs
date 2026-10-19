// Oberflächentest der Module UntPlan Web, Import/Export, Soll und Ist, Statistik, Pausenaufsichten, Kursplanung, Kommentare und
// Mehrbenutzerbetrieb (Playwright, Chromium). UntPlan Web wird durch eine Attrappe (HTTP-Server in diesem Skript) ersetzt.
//
//   NODE_PATH=$(npm root -g) STUDIO_URL=http://127.0.0.1:5501 STUDIO_PASSWORT=geheim123 node studio/tests/smoke/smoke-austausch.cjs
//
// Umgebungsvariablen: hilfe.cjs.
const http = require('http');
const h = require('./hilfe.cjs');

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
  const cookie = await h.apiAnmelden();
  const stand = await h.beispielschule(cookie);
  const dok = `/api/dokumente/${stand.id}`;
  const mit = (c, o = {}) => ({ ...o, headers: { cookie: c } });
  // Tag der Prüfung: nächster Unterrichtstag
  const tag = new Date();
  let iso = '';
  for (let i = 0; i < 120; i++) {
    tag.setDate(tag.getDate() + 1);
    iso = tag.toISOString().slice(0, 10);
    if ((await (await h.api(`${dok}/pausenaufsicht/vertretung/${iso}`, mit(cookie))).json()).unterrichtstag) break;
  }
  const el = await (await h.api(`${dok}/elemente?typen=klasse,lehrer,raum`, mit(cookie))).json();
  const web = await attrappe([{ id: 'klausur-1', typ: 'klausur', absender: 'MÜL', von: iso, stundeVon: 2, stundeBis: 3, titel: 'Mathe-Klausur', klassen: [el.klasse[0].k], lehrer: el.lehrer[0].k, raeume: [el.raum[0].k] }]);
  await h.api(`${dok}/untplanweb/einstellungen`, mit(cookie, { method: 'PUT', body: JSON.stringify({ schulId: '123456', server: '127.0.0.1', port: web.port, https: false, apiSchluessel: 'geheim' }) }));
  // zweiter Benutzer für den Mehrbenutzerbetrieb: aktiv, sperrt die Kursplanung
  try { await h.api('/api/benutzer', mit(cookie, { method: 'POST', body: JSON.stringify({ name: 'pia', anzeigename: 'Pia Planer', rolle: 'Planer', passwort: 'planer-pw' }) })); } catch { /* vorhanden */ }
  const pia = await h.apiAnmelden('pia', 'planer-pw');
  await h.api(`${dok}/multiuser?taetigkeit=${encodeURIComponent('Vertretungen')}`, mit(pia));
  await h.api(`${dok}/multiuser/sperren`, mit(pia, { method: 'POST', body: JSON.stringify({ bereich: 'Kursplanung' }) })).catch(() => {});
  // Gang mit Aufsicht für die Pausenaufsichten
  const gaenge = (await (await h.api(`${dok}/pausenaufsicht`, mit(cookie))).json()).gaenge;
  if (!gaenge.length) await h.api(`${dok}/stammdaten/gang`, mit(cookie, { method: 'POST', body: JSON.stringify({ kurzname: 'Hof' }) }));

  const t = await h.starten('studio-shots-austausch');
  const { page, foto } = t;
  // gesperrte Bereiche (423) sind hier erwartet
  t.fehler.length = 0;
  page.removeAllListeners('console');
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 4\d\d|423|Locked/.test(m.text())) t.fehler.push(m.text()); });

  await h.abschliessen('Oberflächentest Austausch und Module', t, async () => {
    await h.anmelden(page);
    await h.dokumentOffen(page);

    // ---- UntPlan Web: Vertretungen übertragen ----
    await h.eintrag(page, 'start.untplanweb');
    const upw = '[data-ansicht=untplanweb]';
    await page.waitForSelector(`${upw} [data-teil=vertretungen] button`);
    await page.click(`${upw} [data-teil=vertretungen] button`);
    await page.waitForSelector('[role=dialog]:has-text("erfolgreich")', { timeout: 30000 });
    await foto('01-untplanweb-export-erfolg');
    await h.dialogKnopf(page, 'OK');
    await page.waitForSelector(`${upw} :text("übertragen")`);
    if (!web.empfangen.length) throw new Error('Die Attrappe hat kein Paket erhalten.');
    await foto('02-untplanweb');

    // Stundenplanänderungen: Zeitraum bis zum Prüfungstag, Prüfungen markieren und übernehmen
    await page.click(`${upw} [data-teil=stpl-aenderungen] button`);
    const stpl = '[data-ansicht="untplanweb.stpl"]';
    await page.waitForSelector(`${stpl} [data-tabelle="upw-stpl"]`);
    // Datumsfeld (Fluent DatePicker): deutsches Datum eintippen, Enter übernimmt, Escape schließt den Kalender
    const bisFeld = page.locator(`${stpl} input[data-datum]`).nth(1);
    await bisFeld.click();
    await bisFeld.fill(iso.split('-').reverse().join('.'));
    await bisFeld.press('Enter');
    await page.keyboard.press('Escape');
    await page.waitForFunction(([s, d]) => document.querySelectorAll(`${s} input[data-datum]`)[1]?.dataset.datum === d, [stpl, iso], { timeout: 5000 });
    await page.locator(`${stpl} button`, { hasText: /^Laden$/ }).click();
    await page.waitForSelector(`${stpl} .tb-zeile:has-text("Mathe-Klausur")`, { timeout: 15000 });
    await h.werkzeug(page, 'untplanweb.stpl', 'Prüfungen markieren');
    await foto('03-stundenplanaenderungen');
    await h.werkzeug(page, 'untplanweb.stpl', 'Übernehmen');
    await page.waitForSelector(`${stpl} footer:has-text("übernommen")`, { timeout: 15000 });

    // Klausuren
    await h.werkzeug(page, 'untplanweb', 'Klausuren');
    await page.waitForSelector('[data-tabelle="upw-klausuren"] .tb-zeile:has-text("Mathe-Klausur")', { timeout: 15000 });
    await foto('04-klausuren');

    // Einstellungen: Verbindung prüfen
    await h.werkzeug(page, 'untplanweb', 'Einstellungen');
    await page.waitForSelector('[role=dialog]:has-text("Einstellungen für")');
    await page.locator('[role=dialog] button', { hasText: 'Verbindung prüfen' }).click();
    await page.waitForSelector('[role=dialog] [data-pruefung=ok]', { timeout: 15000 });
    await foto('05-untplanweb-einstellungen');
    await h.dialogKnopf(page, 'Abbrechen');

    // ---- Import und Export ----
    await h.eintrag(page, 'eingabe.importexport');
    await page.waitForSelector('[data-ansicht=austausch] button');
    await foto('06-import-export');

    // ---- Soll und Ist, Unterrichtsmatrix, Stundentafel, Statistik ----
    await h.eintrag(page, 'module.sollist');
    await page.waitForSelector('[data-ansicht="abrechnung.wertrechnung"] .tb-zeile');
    await foto('07-soll-ist');
    await page.locator('[data-ansicht="abrechnung.wertrechnung"] [role=tab]', { hasText: 'Unterrichtsmatrix' }).click();
    await page.waitForSelector('[data-tabelle=matrix] .tb-zeile');
    await foto('08-unterrichtsmatrix');
    await page.locator('[data-ansicht="abrechnung.wertrechnung"] [role=tab]', { hasText: 'Stundentafel' }).click();
    await page.locator('[data-ansicht="abrechnung.wertrechnung"] button', { hasText: 'NRW-Jahrgänge eintragen' }).click();
    await page.waitForSelector('[data-tabelle=stundentafel] .tb-zeile', { timeout: 15000 });
    await foto('09-stundentafel');
    await h.eintrag(page, 'module.statistik');
    await page.waitForSelector('[data-ansicht="abrechnung.statistik"] [data-tabelle=statistik]');
    await foto('10-vertretungsstatistik');

    // ---- Pausenaufsichten: automatisch einteilen, Vorschlag ----
    await h.eintrag(page, 'start.pausenaufsichten');
    await page.waitForSelector('[data-ansicht=pausenaufsicht] .pa-zelle');
    await h.werkzeug(page, 'pausenaufsicht', 'Automatisch einteilen');
    await h.dialogKnopf(page, 'Einteilen');
    await page.waitForTimeout(800);
    await page.locator('[data-ansicht=pausenaufsicht] .pa-zelle').first().click();
    await h.werkzeug(page, 'pausenaufsicht', 'Vorschlag');
    await page.waitForSelector('[role=dialog] [data-tabelle=pa-vorschlag] .tb-zeile');
    await foto('11-pausenaufsicht-vorschlag');
    await h.dialogKnopf(page, 'Abbrechen');
    await foto('12-pausenaufsichten');

    // ---- Kursplanung, Kommentare ----
    await h.eintrag(page, 'kurs.kurse');
    await page.waitForSelector('[data-ansicht=kursplanung]');
    await page.waitForTimeout(600);
    await foto('13-kursplanung');
    await h.eintrag(page, 'eingabe.kommentare');
    await page.waitForSelector('[data-ansicht=kommentare]');
    await h.werkzeug(page, 'kommentare', 'Neu');
    await page.waitForSelector('[role=dialog] textarea');
    await page.fill('[role=dialog] textarea', 'Teilzeit ab Februar');
    await page.locator('[role=dialog] button.fui-Button[class*=primary], [role=dialog] .fui-DialogActions button').first().click();
    await page.waitForSelector('[data-tabelle=kommentare] .tb-zeile:has-text("Teilzeit")', { timeout: 15000 });
    await foto('14-kommentare');

    // ---- Mehrbenutzerbetrieb ----
    await page.evaluate(() => window.studioTest.befehl('multiuser.aktualisieren'));
    await page.waitForFunction(() => /2 Benutzer aktiv/.test(document.querySelector('[data-testid=multiuser-praesenz]')?.getAttribute('aria-label') || ''), null, { timeout: 15000 });
    await page.click('[data-testid=multiuser-praesenz]');
    await page.waitForSelector('[data-ansicht=multiuser] td:has-text("Pia Planer")');
    await foto('15-multiuser');
    await h.werkzeug(page, 'multiuser', 'Gruppen und Rechte');
    await page.waitForSelector('[data-ansicht="multiuser.verwaltung"] table');
    await foto('16-multiuser-gruppen');
  });
  web.server.close();
})().catch((e) => { console.error(e); process.exit(1); });
