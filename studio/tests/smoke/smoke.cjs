// Oberflächen-Smoke-Test für UntPlan Studio (Playwright, Chromium).
//
//   NODE_PATH=$(npm root -g) node studio/tests/smoke/smoke.cjs
//
// Ablauf: Anmelden → Beispiel-Schuldatei als .up hochladen (Seite „Schuldateien“) → Lehrkräfte: Wert in der Tabelle ändern →
// Klassenplan, Unterricht, Arbeitsplatz „Manuell planen“ → Befehlssuche (Strg+K) → Vertretungsmodus → Rundgang über alle
// weiteren Seiten (jede Seite muss ohne Fehler laden) → schmales Fenster. Umgebungsvariablen: siehe hilfe.cjs.
const fs = require('fs');
const path = require('path');
const h = require('./hilfe.cjs');

/** Seiten des Rundgangs: Adresse und ein Element, das nach dem Laden sichtbar sein muss. */
const RUNDGANG = [
  ['/uebersicht', '[data-ansicht="start.uebersicht"]'],
  ['/stammdaten?typ=klasse', '[data-tabelle] .tb-zeile'],
  ['/stammdaten?typ=raum', '[data-tabelle] .tb-zeile'],
  ['/kommentare', '[data-ansicht=kommentare]'],
  ['/zeitwuensche', '.zw-tabelle td[data-tag]'],
  ['/diagnose', '[data-ansicht="optimierung.diagnose"] [role=option]'],
  ['/optimierung', '[data-ansicht="optimierung.lauf"]'],
  ['/gesamtuebersicht?typ=lehrer', '.ue-zelle'],
  ['/druck?typ=klasse', '.dr-element'],
  ['/berichte', '.dr-bericht.aktiv'],
  ['/planformate', '.fm-liste'],
  ['/einstellungen', '.es-formular'],
  ['/zeitraster', '.es-zr-zelle'],
  ['/ferien', '.es-monat td.tag'],
  ['/perioden', '.es-perioden-liste tr.gewaehlt'],
  ['/unterrichtsgruppen', '.es-liste'],
  ['/pausenaufsichten', '[data-ansicht=pausenaufsicht]'],
  ['/untplanweb', '[data-teil]'],
  ['/klausuren', '[data-tabelle="upw-klausuren"]'],
  ['/benutzer-aktiv', '[data-ansicht=multiuser] table'],
  ['/gruppen-und-rechte', '[data-ansicht="multiuser.verwaltung"] table'],
];

(async () => {
  const cookie = await h.apiAnmelden();
  // Beispiel-Schuldatei (.up) über die API erzeugen, herunterladen und wieder löschen
  const stand = await h.beispielschule(cookie);
  const up = Buffer.from(await (await h.api(`/api/dokumente/${stand.id}/herunterladen`, { headers: { cookie } })).arrayBuffer());
  await h.api(`/api/dokumente/${stand.id}`, { method: 'DELETE', headers: { cookie } });

  const t = await h.starten('studio-shots');
  const { page, foto } = t;
  const upDatei = path.join(t.bilder, 'Beispielschule.up');
  fs.writeFileSync(upDatei, up);

  await h.abschliessen('Smoke-Test', t, async () => {
    await h.anmelden(page);
    await foto('01-start');

    // Schuldateien → Datei hochladen
    await page.click('[data-nav="nav:dateien"]');
    await page.waitForSelector('[data-testid=ablage]');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-testid=ablage] button').click()]);
    await chooser.setFiles(upDatei);
    await h.dokumentOffen(page, 'Beispielschule');

    // Stammdaten → Lehrkräfte: Nachname der ersten Zeile ändern
    await h.eintrag(page, 'eingabe.lehrer');
    await page.waitForSelector('[data-ansicht=stammdaten] .tb-zeile[data-r="0"]');
    const zelle = page.locator('[data-ansicht=stammdaten] .tb-zeile[data-r="0"] .tb-zelle').nth(1);
    await zelle.dblclick();
    await page.waitForSelector('.tb-editor');
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Smoketest');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => [...document.querySelectorAll('[data-ansicht=stammdaten] .tb-zelle')].some((z) => z.textContent === 'Smoketest'));
    await foto('02-lehrkraefte');

    // Stundenpläne → Klassen
    await h.eintrag(page, 'stundenplaene.klasse');
    await page.waitForSelector('[data-ansicht=stundenplan] .ra-eintrag');
    await foto('03-stundenplan');

    // Unterricht nach Klassen
    await h.eintrag(page, 'eingabe.unterricht.klassen');
    await page.waitForSelector('[data-ansicht=unterricht] .tb-zeile');
    await foto('04-unterricht');

    // Arbeitsplatz „Manuell planen“: Unterricht und Klassenplan nebeneinander
    await h.eintrag(page, 'planung.manuell');
    await page.waitForSelector('[data-arbeitsplatz=manuell] [data-ansicht=unterricht] .tb-zeile');
    await page.waitForSelector('[data-arbeitsplatz=manuell] [data-ansicht=stundenplan] .ra-eintrag');
    await foto('05-manuell-planen');

    // Befehlssuche
    await page.keyboard.press('Control+k');
    await page.waitForSelector('[data-testid=befehlssuche]');
    await page.keyboard.type('Räume');
    await page.waitForTimeout(300);
    await foto('06-befehlssuche');
    await page.keyboard.press('Escape');

    // Vertretungsmodus
    await h.modus(page, 'vertretung');
    await page.waitForSelector('[data-testid=planungsdatum]');
    await foto('07-vertretungsmodus');
    await h.modus(page, 'stundenplan');

    // Rundgang: jede Seite lädt ohne Fehler
    for (const [adresse, merkmal] of RUNDGANG) {
      await h.seite(page, adresse);
      await page.waitForSelector(merkmal, { timeout: 15000 }).catch((e) => { throw new Error(`${adresse}: ${e.message}`); });
    }
    await foto('08-rundgang-ende');

    // Schmales Fenster (Telefon)
    await page.setViewportSize({ width: 390, height: 844 });
    await h.seite(page, '/stundenplan?typ=klasse');
    await page.waitForSelector('[data-ansicht=stundenplan] .ra-eintrag');
    await foto('09-schmal');
  });
})().catch((e) => { console.error(e); process.exit(1); });
