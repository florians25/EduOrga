// Oberflächentest „Deputat und Unterrichtsverteilung“ (Playwright, Chromium).
//
//   NODE_PATH=$(npm root -g) STUDIO_URL=http://127.0.0.1:5501 STUDIO_PASSWORT=geheim123 node studio/tests/smoke/deputat.cjs
//
// Ablauf: Beispielschule → einige Lehrkräfte über die API in Teilzeit, mit Geburtsdatum bzw. GdB (Altersermäßigung,
// Schwerbehindertenermäßigung) → Seite über die Seitenleiste → Umfang in der Tabelle ändern (Soll ändert sich sofort) →
// Ermäßigungen und Anrechnungen im Dialog → Einstellungen (Grundstellen) → Verteilung: Lehrkraft aus einer Zelle entfernen,
// offenen Unterricht wählen und neu zuweisen → Fächer-Spalten → Stundentafel → Rückgängig. Bildschirmfotos 1280 × 800
// (STUDIO_SCREENSHOTS, sonst Temp-Ordner). Umgebungsvariablen: hilfe.cjs.
const h = require('./hilfe.cjs');

(async () => {
  const cookie = await h.apiAnmelden();
  const dok = await h.beispielschule(cookie);
  const pfad = (p) => `/api/dokumente/${dok.id}${p}`;
  const json = async (p, o = {}) => (await h.api(pfad(p), { ...o, headers: { cookie, ...(o.headers || {}) } })).json();

  // Beispieldaten: Teilzeit, Alter, Schwerbehinderung, Leitungszeit – damit die Seite wie an einer echten Schule aussieht
  const u = await json('/deputat');
  const l = Object.fromEntries(u.lehrer.map((x) => [x.kurz, x]));
  const setze = (kurz, feld, wert) => (l[kurz] ? json(`/deputat/lehrer/${l[kurz].id}`, { method: 'PATCH', body: JSON.stringify({ feld, wert }) }) : null);
  let i = 0;
  const voll = [];
  for (const x of u.lehrer) {
    // Umfang nahe am tatsächlichen Einsatz: Teilzeit in halben Stunden, mindestens 8 Stunden
    const ziel = Math.max(8, Math.round((x.ist + x.sonstige + x.leitung) * 2) / 2);
    if (ziel < 25.5 && i++ % 3 !== 2) await setze(x.kurz, 'umfang', String(ziel).replace('.', ','));
    else voll.push(x.kurz);
  }
  await setze(voll[0], 'geburtsdatum', '12.03.1964');
  await setze(voll[1], 'geburtsdatum', '30.07.1970');
  await setze(voll[2], 'gdb', '50');
  await setze(voll[3], 'alter', '58');
  await setze(voll[4], 'mehrarbeit', '1');
  await setze(u.lehrer[1].kurz, 'geburtsdatum', '02.08.1971'); // 55 erst nach dem 1. August vollendet → noch keine Ermäßigung
  await json('/deputat/einstellungen', { method: 'PUT', body: JSON.stringify({ grundstellen: 21.5 }) });
  // Stundentafel bis Jahrgang 10 ergänzen (Kontingentprüfung G9)
  for (const j of ['8', '9', '10']) await json('/abrechnung/stundentafel/jahrgang', { method: 'POST', body: JSON.stringify({ jahrgang: j }) });
  const tafel = await json('/abrechnung/stundentafel');
  const fid = (k) => tafel.faecher.find((f) => f.kurz === k)?.id;
  for (const [j, k, w] of [['8', 'D', '3'], ['9', 'D', '3'], ['10', 'D', '3'], ['8', 'M', '3'], ['9', 'M', '4'], ['10', 'M', '3'], ['8', 'E', '3'], ['9', 'E', '3'], ['10', 'E', '3'], ['8', 'F', '4'], ['9', 'F', '4'], ['10', 'F', '3']])
    if (fid(k)) await json('/abrechnung/stundentafel', { method: 'PUT', body: JSON.stringify({ jahrgang: j, fach: fid(k), wert: w }) });

  const t = await h.starten('studio-shots-deputat', { breite: 1280, hoehe: 800 });
  const { page, foto } = t;
  const ans = '[data-ansicht="deputat"]';
  const tab = `${ans} [data-tabelle="deputat"]`;

  await h.abschliessen('Oberflächentest Deputat und Unterrichtsverteilung', t, async () => {
    await h.anmelden(page);
    await h.dokumentOffen(page);
    await h.modus(page, 'stundenplan');
    await h.eintrag(page, 'deputat.uebersicht');
    await page.waitForSelector(`${tab} .tb-zeile`);
    await page.waitForSelector('[data-testid=deputat-kennzahlen]:has-text("Nordrhein-Westfalen")');

    // Spalten ermitteln
    const spalte = async (titel) => page.evaluate(([s, t]) => {
      const i = [...document.querySelectorAll(`${s} .tb-kopf .tb-kz`)].findIndex((e) => (e.textContent || '').trim().startsWith(t));
      return i < 0 ? null : String(i);
    }, [tab, titel]);
    const cUmfang = await spalte('Umfang');
    const cSoll = await spalte('Soll');
    if (cUmfang == null || cSoll == null) throw new Error('Spalten Umfang/Soll nicht gefunden');
    const zelle = (r, c) => page.locator(`${tab} .tb-zeile[data-r="${r}"] .tb-zelle[data-c="${c}"]`);

    // Lehrkraft mit Geburtsdatum 1964 (60+): Rechnung rechts zeigt die berechnete Altersermäßigung
    await page.locator(`${tab} .tb-zelle[data-c="0"]`, { hasText: new RegExp(`^${voll[0]}$`) }).click();
    await page.waitForSelector('[data-testid=deputat-rechnung]:has-text("Altersermäßigung ab 60")');
    await foto('deputat-lehrkraefte');

    // Umfang der ersten Lehrkraft ändern → Soll aktualisiert sich
    const vorher = (await zelle(0, cSoll).textContent()) || '';
    await zelle(0, cUmfang).click();
    await page.keyboard.type('20');
    await page.keyboard.press('Enter');
    await page.waitForFunction(([s, c, v]) => {
      const t = document.querySelector(`${s} .tb-zeile[data-r="0"] .tb-zelle[data-c="${c}"]`)?.textContent;
      return t && t !== v;
    }, [tab, cSoll, vorher], { timeout: 15000 });

    // Ermäßigungen und Anrechnungen (Dialog)
    await zelle(0, 0).click();
    await page.locator(`${ans} button`, { hasText: 'Ermäßigungen und Anrechnungen' }).click();
    await page.waitForSelector('[role=dialog] .dep-posten');
    await page.locator('[role=dialog] button', { hasText: 'Eintrag hinzufügen' }).click();
    await page.locator('[role=dialog] input[aria-label=Grund]').last().fill('Oberstufenkoordination');
    await page.locator('[role=dialog] input[aria-label=Stunden]').last().fill('2');
    await foto('deputat-anrechnungen');
    await h.dialogKnopf(page, 'Übernehmen');
    await page.waitForSelector('[data-testid=deputat-rechnung]:has-text("Oberstufenkoordination")');
    await page.waitForSelector('[data-testid=deputat-kennzahlen]:has-text("Anrechnungstopf 2")');

    // Einstellungen
    await page.locator(`${ans} button`, { hasText: 'Einstellungen' }).click();
    await page.waitForSelector('[role=dialog] >> text=Landesprofil');
    await h.dialogKnopf(page, 'Abbrechen');

    // Verteilung
    await page.getByRole('tab', { name: 'Verteilung' }).click();
    await page.waitForSelector('[data-testid=deputat-matrix] tbody tr');
    await page.waitForSelector('[data-testid=deputat-offen]');
    await foto('deputat-verteilung');
    // Zelle anklicken → Unterricht entfernen → offen
    await page.locator('[data-testid=deputat-matrix] tbody td:not(.dep-fest)').filter({ hasText: /\d/ }).first().click();
    await page.locator(`${ans} .dep-liste button`, { hasText: 'Entfernen' }).first().click();
    await page.waitForSelector('[data-testid=deputat-offen] .dep-offen');
    await page.locator('[data-testid=deputat-offen] .dep-offen').first().click();
    await page.waitForSelector('.dep-kandidat-zeile');
    await page.waitForSelector('[data-testid=deputat-matrix] .dep-zuweisen');
    await foto('deputat-zuweisen');
    await page.locator('.dep-kandidat-zeile button', { hasText: 'Zuweisen' }).first().click();
    await page.waitForSelector('[data-testid=deputat-offen]:has-text("Keine offenen Unterrichte")', { timeout: 15000 });

    // Spalten nach Fächern, Filter Fach
    await page.waitForTimeout(2500); // Hinweise ausblenden lassen
    await page.locator('[data-testid=deputat-nach] button[data-wert=fach]').click();
    await page.waitForSelector('[data-testid=deputat-matrix] thead th:has-text("D")');
    await foto('deputat-faecher');

    // Stundentafel
    await page.getByRole('tab', { name: 'Stundentafel' }).click();
    await page.waitForSelector(`${ans} [data-tabelle="deputat-tafel"]`);
    await page.waitForSelector(`${ans} [data-tabelle="deputat-kontingente"] .tb-zeile`);
    await foto('deputat-stundentafel');

    // Rückgängig (Strg+Z) macht die letzte Zuweisung rückgängig – Daten bleiben konsistent
    const a1 = await json('/deputat');
    if (!a1.lehrer.some((x) => x.posten.some((p) => p.grund === 'Oberstufenkoordination'))) throw new Error('Anrechnung nicht gespeichert');
    await h.api(pfad('/rueckgaengig'), { method: 'POST', body: '{}', headers: { cookie } });
    const v = await json('/deputat/verteilung');
    if (v.offen.length !== 1) throw new Error(`Nach Rückgängig sollte ein Unterricht offen sein, gefunden: ${v.offen.length}`);
  });
})();
