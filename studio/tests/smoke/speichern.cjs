// Oberflächentest: sofortiges Speichern (Speicherstand in der Kopfleiste, Strg+S = Sicherungspunkt) und
// „An Web senden“ in der Kopfleiste der Vertretungsplanung.
//   NODE_PATH=$(npm root -g) STUDIO_PASSWORT=geheim123 node studio/tests/smoke/speichern.cjs
const h = require('./hilfe.cjs');

(async () => {
  const s = await h.starten('studio-shots-speichern');
  const { page, foto } = s;
  await h.abschliessen('Oberflächentest Speichern', s, async () => {
    const cookie = await h.apiAnmelden();
    const dok = await h.beispielschule(cookie);
    await h.anmelden(page);
    await h.dokumentOffen(page, dok.name); // zuletzt verwendetes Dokument öffnet die Oberfläche selbst
    await page.waitForSelector('[data-testid=speicherstand][data-stand=gespeichert]', { timeout: 20000 });
    if (await page.locator('[data-testid=speichern]').count()) throw new Error('Speichern-Knopf ist noch da');
    const text = await page.locator('[data-testid=speicherstand]').textContent();
    if (!/^Gespeichert/.test(text || '')) throw new Error('Speicherstand: ' + text);
    await foto('01-gespeichert');

    // Änderung über die API (wie aus einer Ansicht) → kurz danach wieder „Gespeichert“
    await page.evaluate(async (id) => {
      await fetch(`/api/dokumente/${id}/schule/schuldaten`, { method: 'PUT', headers: { 'content-type': 'application/json', 'X-UntPlan-Studio': '1' }, body: JSON.stringify({ schulname: 'Gespeicherte Schule' }) });
    }, dok.id);
    await page.waitForSelector('[data-testid=speicherstand][data-stand=gespeichert]', { timeout: 10000 });

    // Strg+S legt einen Sicherungspunkt an
    await page.keyboard.press('Control+s');
    await page.waitForSelector('[data-testid=statusmeldung]:has-text("Sicherungspunkt angelegt")', { timeout: 10000 });
    const fassungen = await page.evaluate(async (id) => (await (await fetch(`/api/dokumente/${id}/fassungen`)).json()), dok.id);
    if (!fassungen.some((f) => f.art === 'sicherungspunkt')) throw new Error('kein Sicherungspunkt: ' + JSON.stringify(fassungen));

    // Vertretungsplanung: „An Web senden“ in der Kopfleiste (ohne Verbindung → Einstellungsdialog)
    await h.modus(page, 'vertretung');
    await page.waitForSelector('[data-testid=untplanweb-senden] button', { timeout: 10000 });
    await foto('02-vertretung-kopfleiste');
    await page.click('[data-testid=untplanweb-senden] button');
    await page.waitForSelector('[role=dialog]:has-text("Vertretungen automatisch übertragen")', { timeout: 10000 });
    await foto('03-einstellungen-direkt');
    await h.dialogKnopf(page, 'Abbrechen');
  });
})();
