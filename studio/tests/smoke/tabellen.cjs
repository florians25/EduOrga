// Oberflächentest der Datentabelle (Playwright, Chromium): Mehrfachauswahl, Fußleiste, Kopieren, Kombinationsfeld mit
// Auswahlliste (Lehrkraft), Vorschläge beim Tippen, unbekannte Werte, Mehrfachauswahl in Listen (Klassen), Einfügen aus der
// Zwischenablage mit Prüfung je Zelle, Mehrfach ändern, Filterzeile, Auswahlkästchen und gespeicherter Spaltenzustand.
//
//   NODE_PATH=$(npm root -g) node studio/tests/smoke/tabellen.cjs      (Umgebungsvariablen: siehe hilfe.cjs)
const h = require('./hilfe.cjs');

(async () => {
  const cookie = await h.apiAnmelden();
  const dok = await h.beispielschule(cookie);
  const elemente = await (await h.api(`/api/dokumente/${dok.id}/elemente`, { headers: { cookie } })).json();
  const lehrer = elemente.lehrer.map((e) => e.k);
  const klassen = elemente.klasse.map((e) => e.k);
  const t = await h.starten('untplan-studio-tabellen');
  const { page, foto } = t;
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: h.URL });
  const schritt = (s) => console.log(`  ✓ ${s}`);

  await h.abschliessen('Tabellen-Test', t, async () => {
    await h.anmelden(page);
    await h.dokumentOffen(page);

    // ---- Stammdaten Lehrkräfte: Mehrfachauswahl, Fußleiste, Kopieren, Strg+A ----
    await h.seite(page, '/stammdaten?typ=lehrer');
    const st = '[data-tabelle="stammdaten-lehrer"]';
    await page.waitForSelector(`${st} .tb-zeile[data-r="3"]`);
    const zelle = (tab, r, c) => page.locator(`${tab} .tb-zeile[data-r="${r}"] .tb-zelle[data-c="${c}"]`);
    await zelle(st, 0, 1).click();
    await zelle(st, 3, 2).click({ modifiers: ['Shift'] });
    await page.waitForFunction((s) => document.querySelectorAll(`${s} .tb-zeile.gewaehlt`).length === 4, st);
    await zelle(st, 5, 1).click({ modifiers: ['Control'] });
    await page.waitForFunction((s) => document.querySelectorAll(`${s} .tb-zeile.gewaehlt`).length === 5, st);
    const status = await page.locator(`${st} [data-tabelle-status]`).textContent();
    if (!/5 von \d+ Zeilen markiert/.test(status)) throw new Error(`Fußleiste: ${status}`);
    await foto('01-mehrfachauswahl');
    schritt('Klick, Umschalt+Klick, Strg+Klick markieren; Fußleiste zeigt die Anzahl');

    await zelle(st, 0, 0).click();
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Shift+ArrowRight');
    await page.waitForFunction((s) => document.querySelectorAll(`${s} .tb-zelle.imbereich`).length === 6, st);
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(200);
    const kopie = await page.evaluate(() => navigator.clipboard.readText());
    const zeilen = kopie.split(/\r?\n/);
    if (zeilen.length !== 3 || zeilen.some((z) => z.split('\t').length !== 2)) throw new Error(`Kopierter Bereich: ${JSON.stringify(kopie)}`);
    schritt(`Umschalt+Pfeile markieren einen Bereich (3×2), Strg+C kopiert ihn als Tabulator-Text`);
    await page.keyboard.press('Control+a');
    await page.waitForFunction((s) => /(\d+) von \1 Zeilen markiert/.test(document.querySelector(`${s} [data-tabelle-status]`)?.textContent || ''), st);
    await page.keyboard.press('Escape');
    await page.waitForFunction((s) => !document.querySelector(`${s} [data-tabelle-status]`), st);
    schritt('Strg+A markiert alles, Esc hebt die Auswahl auf');

    // ---- Unterricht: Kombinationsfeld Lehrkraft ----
    await h.seite(page, '/unterricht?sicht=alle');
    const ut = '[data-tabelle="unterricht"]';
    await page.waitForSelector(`${ut} .tb-zeile[data-r="5"]`);
    const spalte = (k) => page.evaluate(([s, k]) => [...document.querySelectorAll(`${s} .tb-kz`)].findIndex((x) => x.dataset.spalte === k), [ut, k]);
    const cLehrer = await spalte('Lehrer'), cText = await spalte('Text'), cKlassen = await spalte('Klassen'), cFach = await spalte('Fach');
    const text = (r, c) => zelle(ut, r, c).textContent();
    await zelle(ut, 0, cLehrer).dblclick();
    await page.waitForSelector('.vs-liste .vs-eintrag');
    const anzahlListe = await page.locator('.vs-liste .vs-eintrag').count();
    if (anzahlListe < 5) throw new Error(`Auswahlliste Lehrkraft: ${anzahlListe} Einträge`);
    await foto('02-auswahlliste-lehrkraft');
    // Vorschläge beim Tippen: Kurzname beginnt mit …
    const bisher = await text(0, cLehrer);
    const ziel = lehrer.find((k) => k !== bisher && k.length >= 2) || lehrer[1];
    await page.keyboard.press('Control+a');
    await page.keyboard.type(ziel.slice(0, 2).toLowerCase());
    await page.waitForFunction((p) => (document.querySelector('.vs-liste .vs-eintrag .k')?.textContent || '').toLowerCase().startsWith(p), ziel.slice(0, 2).toLowerCase());
    await foto('03-vorschlaege-beim-tippen');
    await page.keyboard.press('Control+a');
    await page.keyboard.type(ziel.toLowerCase());
    await page.keyboard.press('Enter');
    await page.waitForFunction(([s, c, k]) => document.querySelector(`${s} .tb-zeile[data-r="0"] .tb-zelle[data-c="${c}"]`)?.textContent === k, [ut, cLehrer, ziel], { timeout: 15000 });
    schritt(`Lehrkraft über das Kombinationsfeld gesetzt (Eingabe „${ziel.toLowerCase()}“ → ${ziel})`);

    // unbekannter Wert: Feld bleibt offen und zeigt den Fehler, Esc verwirft
    await zelle(ut, 0, cLehrer).click();
    await page.keyboard.type('ZZQX');
    await page.keyboard.press('Escape'); // Liste schließen
    await page.keyboard.press('Enter');
    await page.waitForSelector('.tb-editbox.fehler .tb-editor-fehler');
    await foto('04-unbekannter-wert');
    await page.keyboard.press('Escape'); // Liste schließen
    if (await page.locator('.tb-editbox').count()) await page.keyboard.press('Escape'); // Eingabe verwerfen
    await page.waitForFunction(() => !document.querySelector('.tb-editbox'));
    if ((await text(0, cLehrer)) !== ziel) throw new Error('Unbekannter Wert wurde gespeichert');
    schritt('Unbekannte Lehrkraft wird nicht gespeichert (Fehler am Feld)');

    // Klassen: Mehrfachauswahl in der Liste
    const vorher = (await text(0, cKlassen)).split(',').filter(Boolean);
    const neueKlasse = klassen.find((k) => !vorher.includes(k));
    await zelle(ut, 0, cKlassen).click();
    await page.keyboard.press('F2');
    await page.waitForSelector('.vs-liste[aria-multiselectable=true] .vs-eintrag');
    await foto('05-klassen-mehrfachauswahl');
    await page.locator('.vs-liste .vs-eintrag', { has: page.locator('.k', { hasText: new RegExp(`^${neueKlasse}$`) }) }).click();
    await page.waitForSelector('.vs-liste .vs-eintrag.an');
    await page.keyboard.press('Tab');
    await page.waitForFunction(([s, c, k]) => (document.querySelector(`${s} .tb-zeile[data-r="0"] .tb-zelle[data-c="${c}"]`)?.textContent || '').split(',').includes(k), [ut, cKlassen, neueKlasse], { timeout: 15000 });
    schritt(`Klasse ${neueKlasse} per Mehrfachauswahl hinzugefügt (${await text(0, cKlassen)})`);

    // ---- Einfügen (Tabulator-Text) mit Prüfung je Zelle ----
    const einfuegen = (txt) => page.evaluate(([s, txt]) => {
      const dt = new DataTransfer();
      dt.setData('text/plain', txt);
      document.querySelector(s).dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    }, [ut, txt]);
    const ersteZeilen = await page.evaluate(([s, c]) => [...document.querySelectorAll(`${s} .tb-zeile`)].filter((z) => !z.classList.contains('gruppe-folge') && !z.classList.contains('tb-neu')).slice(0, 3).map((z) => Number(z.dataset.r)), [ut, cText]);
    await zelle(ut, ersteZeilen[0], cText).click();
    await einfuegen('Eingefügt A\nEingefügt B');
    await page.waitForFunction(([s, c]) => [...document.querySelectorAll(`${s} .tb-zelle[data-c="${c}"]`)].some((z) => z.textContent === 'Eingefügt A'), [ut, cText], { timeout: 15000 });
    // ungültige Lehrkraft beim Einfügen: Zelle rot markiert, nicht gespeichert
    await zelle(ut, ersteZeilen[0], cLehrer).click();
    await einfuegen('GIBTSNICHT');
    await page.waitForSelector(`${ut} .tb-zelle.fehler[data-c="${cLehrer}"]`);
    const titel = await page.locator(`${ut} .tb-zelle.fehler`).first().getAttribute('title');
    if (!/nicht vorhanden/.test(titel || '')) throw new Error(`Fehlerhinweis: ${titel}`);
    await foto('06-einfuegen-gepueft');
    schritt('Einfügen: gültige Werte gespeichert, unbekannte Lehrkraft rot markiert mit Hinweis');

    // ---- Mehrfach ändern ----
    await zelle(ut, ersteZeilen[0], cText).click();
    await zelle(ut, ersteZeilen[2], cText).click({ modifiers: ['Shift'] });
    await zelle(ut, ersteZeilen[1], cText).click({ button: 'right' });
    await page.getByRole('menuitem', { name: /Mehrfach ändern/ }).click();
    await page.waitForSelector('[data-testid=mehrfach-aendern]');
    await page.locator('[data-testid=mehrfach-aendern] input[aria-label="Neuer Wert"]').fill('Serienwert');
    await foto('07-mehrfach-aendern');
    await page.locator('[role=dialog] button', { hasText: /Zeilen ändern/ }).click();
    await page.waitForFunction(([s, c, rs]) => rs.every((r) => document.querySelector(`${s} .tb-zeile[data-r="${r}"] .tb-zelle[data-c="${c}"]`)?.textContent === 'Serienwert'), [ut, cText, ersteZeilen], { timeout: 15000 });
    schritt('Mehrfach ändern: Text in 3 Unterrichten gesetzt (eine Rückgängig-Stufe, POST /unterricht/aendern)');

    // ---- Filterzeile, gespeicherter Zustand ----
    await zelle(ut, 0, 0).click();
    if (!(await page.locator(`${ut} .tb-filterzeile`).count())) await page.keyboard.press('Control+Shift+L');
    await page.waitForSelector(`${ut} .tb-filterzeile`);
    const fach = (await text(0, cFach)).trim();
    await page.locator(`${ut} input[data-filter="Fach"]`).fill(`=${fach}`);
    await page.waitForFunction(([s, c, f]) => {
      const z = [...document.querySelectorAll(`${s} .tb-zeile:not(.gruppe-folge):not(.tb-neu) .tb-zelle[data-c="${c}"]`)];
      return z.length > 0 && z.every((x) => x.textContent === f);
    }, [ut, cFach, fach]);
    await page.waitForSelector(`${ut} [data-tabelle-status]:has-text("Filter")`);
    await foto('08-filterzeile');
    schritt(`Filterzeile: Fach = ${fach}`);
    // Auswahlkästchen über das Spaltenmenü
    if (!(await page.locator(`${ut} .tb-mk`).count())) {
      await page.locator(`${ut} .tb-kz[data-spalte="Fach"]`).click({ button: 'right' });
      await page.getByRole('menuitem', { name: 'Auswahlkästchen' }).click();
    }
    await page.waitForSelector(`${ut} .tb-zeile .tb-mk .tb-haken`);
    await page.locator(`${ut} .tb-zeile[data-r="0"] .tb-mk`).click();
    await page.waitForSelector(`${ut} .tb-zeile.gewaehlt`);
    await foto('09-auswahlkaestchen');
    await page.waitForTimeout(900);
    const gespeichert = await page.evaluate(() => JSON.parse(localStorage.getItem('studio.tabelle.unterricht') || 'null'));
    if (!gespeichert?.fz || !gespeichert?.mk) throw new Error(`Spaltenzustand nicht gespeichert: ${JSON.stringify(gespeichert)}`);
    await page.reload();
    await page.waitForFunction(() => document.body.dataset.bereit === '1', null, { timeout: 20000 });
    await page.waitForSelector(`${ut} .tb-filterzeile`);
    await page.waitForSelector(`${ut} .tb-mk`);
    schritt('Filterzeile und Auswahlkästchen bleiben nach dem Neuladen erhalten');
    // ---- Spaltenbreite ziehen, Spalte verschieben, kompakte Zeilen ----
    const kopf = (k) => page.locator(`${ut} .tb-kz[data-spalte="${k}"]`);
    const reihe = () => page.evaluate((s) => [...document.querySelectorAll(`${s} .tb-kz`)].map((x) => x.dataset.spalte), ut);
    const ausgang = await reihe();
    const breiteVorher = (await kopf('Fach').boundingBox()).width;
    const griff = await kopf('Fach').locator('.tb-breite').boundingBox();
    await page.mouse.move(griff.x + griff.width / 2, griff.y + griff.height / 2);
    await page.mouse.down();
    await page.mouse.move(griff.x + 40, griff.y + 10, { steps: 6 });
    await page.mouse.move(griff.x + 70, griff.y + 10, { steps: 6 });
    await page.mouse.up();
    const breiteNachher = (await kopf('Fach').boundingBox()).width;
    if (breiteNachher < breiteVorher + 50) throw new Error(`Spaltenbreite: ${breiteVorher} → ${breiteNachher}`);
    const vorherReihe = await reihe();
    if (vorherReihe.join() !== ausgang.join()) throw new Error(`Spaltenbreite ziehen hat Spalten verschoben: ${vorherReihe}`);
    if (vorherReihe.indexOf('Lehrer') > vorherReihe.indexOf('Text')) { await kopf('Lehrer').dragTo(kopf('Fach')); }
    await kopf('Lehrer').dragTo(kopf('Text'));
    const nachherReihe = await reihe();
    if (nachherReihe.indexOf('Lehrer') !== nachherReihe.indexOf('Text') + 1) throw new Error(`Spalte verschieben: ${nachherReihe.join(',')}`);
    await page.waitForTimeout(900);
    const zustand = await page.evaluate(() => JSON.parse(localStorage.getItem('studio.tabelle.unterricht') || 'null'));
    const gesp = zustand.spalten.map((x) => x.s);
    if (gesp.indexOf('Lehrer') !== gesp.indexOf('Text') + 1 || (zustand.spalten.find((x) => x.s === 'Fach')?.b || 0) < breiteVorher + 50) throw new Error(`Spaltenzustand: ${JSON.stringify(zustand.spalten.slice(0, 12))}`);
    schritt(`Spaltenbreite ${Math.round(breiteVorher)} → ${Math.round(breiteNachher)} px gezogen, Lehrkraft hinter Text verschoben, gespeichert`);
    await kopf('Fach').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Kompakte Zeilen' }).click();
    await page.waitForFunction((s) => {
      const a = document.querySelector(`${s} .tb-zeile[data-r="1"]`).getBoundingClientRect(), b = document.querySelector(`${s} .tb-zeile[data-r="2"]`).getBoundingClientRect();
      return Math.round(a.height) === 24 && Math.round(b.top - a.top) === 24;
    }, ut);
    await foto('10-kompakt-verschoben');
    await kopf('Fach').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Kompakte Zeilen' }).click();
    await kopf('Lehrer').dragTo(kopf('Fach'));
    schritt('Kompakte Zeilen (24 px) umschaltbar');
    // zurück zur Grundeinstellung
    await page.locator(`${ut} .tb-kz[data-spalte="Fach"]`).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Auswahlkästchen' }).click();
    await page.locator(`${ut} .tb-zeile[data-r="0"] .tb-zelle[data-c="0"]`).click();
    await page.keyboard.press('Control+Shift+L');
    await page.waitForFunction((s) => !document.querySelector(`${s} .tb-filterzeile`) && !document.querySelector(`${s} .tb-mk`), ut);
    await page.waitForTimeout(900);
  });

})();
