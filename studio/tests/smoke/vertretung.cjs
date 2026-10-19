// Oberflächentest der Vertretungsplanung (Playwright, Chromium).
//
//   NODE_PATH=$(npm root -g) STUDIO_URL=http://127.0.0.1:5501 STUDIO_PASSWORT=geheim123 node studio/tests/smoke/vertretung.cjs
//
// Ablauf: Beispielschule → Vertretungsmodus mit Planungsdatum → Abwesenheit direkt in der Liste erfassen (Entwurf, Strg+Enter)
// → Vertretungen mit offenen Stunden (Plakette „Offen“) → Vorschlag (Enter) und ersten Kandidaten übernehmen → Entfall mit „-“ →
// Kontextmenü → Kalender → Arbeitsplatz „Verlegen und Tauschen“ → Veranstaltung „Alle Lehrkräfte“ → Tagesplanung im Tagesablauf
// (Schnellerfassung einer Abwesenheit, Arbeitsliste mit Kandidaten, Tasten 1 und E, Wer ist frei?, Pläne, Automatik als Probe mit
// Prüfung und Übernahme, bearbeitete Stunde zurücksetzen, Prüfen und veröffentlichen mit Belastung) → Expertenansicht (Tageskopf, schlanke Liste, Filter, Vorschlag zur gewählten Zeile, Tagespläne als Tagesansicht) → Tag blättern
// (Strg+Bild↓) → Wochenansicht (Umschalter Tag | Woche im Plan und im Tageskopf, Wochenstreifen, Strg+Umschalt+Bild↓/↑,
// Plan vergrößern, gemerkte Ansicht) → Verknüpfung der Pläne (Klick auf eine Stunde) → Einstellungen. Umgebungsvariablen: hilfe.cjs.
const h = require('./hilfe.cjs');

(async () => {
  const cookie = await h.apiAnmelden();
  const stand = await h.beispielschule(cookie);
  const dok = `/api/dokumente/${stand.id}`;
  const holen = async (p) => (await h.api(dok + p, { headers: { cookie } })).json();
  // Lehrkraft mit mindestens drei Stunden am Planungsdatum
  const datum = (await holen('/vertretung/start')).datum;
  const lehrer = (await holen('/elemente?typen=lehrer')).lehrer;
  let kurz = null, kurz2 = null;
  for (const l of lehrer) {
    const plan = await holen(`/vertretung/plan/lehrer/${l.id}?datum=${datum}`);
    if (plan.zellen.filter((z) => z.datum === datum).length >= 3) { if (!kurz) kurz = l.k; else if (!kurz2) { kurz2 = l.k; break; } }
  }
  if (!kurz || !kurz2) throw new Error('keine Lehrkraft mit Unterricht');

  const t = await h.starten('studio-shots-vertretung');
  const { page, foto } = t;
  const schritt = (s) => console.log(`✓ ${s}`);
  const datumImKopf = () => page.getAttribute('[data-testid=planungsdatum] input[data-datum]', 'data-datum');

  await h.abschliessen('Oberflächentest Vertretungsplanung', t, async () => {
    await h.anmelden(page);
    await h.dokumentOffen(page);

    // Vertretungsmodus mit Planungsdatum
    await h.modus(page, 'vertretung');
    await page.waitForFunction((d) => document.querySelector('[data-testid=planungsdatum] input[data-datum]')?.dataset.datum === d, datum, { timeout: 15000 });
    await foto('01-vertretungsmodus');
    schritt(`Vertretungsmodus, Datum ${datum}, Lehrkraft ${kurz}`);

    // Abwesenheit direkt in der Liste: neue Zeile, Element eingeben, Strg+Enter speichert den Entwurf
    await h.eintrag(page, 'vertretung.absenzen');
    const abs = '[data-ansicht="vertretung.absenzen"]';
    await page.waitForSelector(`${abs} .tb-zeile.tb-neu`);
    await page.locator(`${abs} .tb-zeile.tb-neu .tb-zelle`).nth(1).click();
    await page.keyboard.type(kurz);
    await page.keyboard.press('Tab');
    // Entwurf (Strg+Enter speichert) – oder die Tabelle speichert die neue Zeile bereits beim Verlassen der Zelle
    await page.waitForFunction(([s, k]) => !!document.querySelector(`${s} .tb-zeile.vt-entwurf`) || [...document.querySelectorAll(`${s} .tb-zeile:not(.tb-neu)`)].some((z) => z.textContent.includes(k)), [abs, kurz], { timeout: 15000 });
    if (await page.locator(`${abs} .tb-zeile.vt-entwurf`).count()) await page.keyboard.press('Control+Enter');
    await page.waitForFunction(([s, k]) => [...document.querySelectorAll(`${s} .tb-zeile:not(.vt-entwurf):not(.tb-neu)`)].some((z) => z.textContent.includes(k)), [abs, kurz], { timeout: 15000 });
    await page.waitForTimeout(600);
    if (await page.locator('text=bereits vorhanden').count()) throw new Error('Abwesenheit wurde doppelt gespeichert');
    await foto('02-abwesenheiten');
    schritt('Abwesenheit gespeichert');

    // Vertretungen mit offenen Stunden
    await h.eintrag(page, 'vertretung.vertretungen');
    const liste = '[data-ansicht="vertretung.liste"]';
    await page.waitForSelector(`${liste} .tb-zelle.vt-z-offen`, { timeout: 15000 });
    if (await page.locator(`${liste} .tb-zelle`, { hasText: '???' }).count()) throw new Error('„???“ statt Plakette „Offen“');
    await foto('03-vertretungen-offen');
    schritt('Vertretungen mit Plakette „Offen“ angezeigt');

    const offeneZeile = () => page.evaluate((s) => {
      const z = [...document.querySelectorAll(`${s} .tb-zeile`)].find((x) => x.querySelector('.tb-zelle.vt-z-offen'));
      return z ? { r: z.dataset.r, nr: z.children[0].textContent.trim() } : null;
    }, liste);
    // erste offene Zeile: Vorschlag (Enter) und ersten Kandidaten übernehmen (Doppelklick)
    const o1 = await offeneZeile();
    await page.locator(`${liste} .tb-zeile[data-r="${o1.r}"] .tb-zelle`).first().click();
    await page.keyboard.press('Enter');
    const vorschlag = '[data-ansicht="vertretung.vorschlag"]';
    await page.waitForSelector(`${vorschlag} [data-tabelle="vorschlag-0"] .tb-zeile`, { timeout: 15000 });
    await foto('04-vertretungsvorschlag');
    const erste = page.locator(`${vorschlag} [data-tabelle="vorschlag-0"] .tb-zeile`).first();
    const kandidat = (await erste.locator('.tb-zelle').first().textContent()).trim();
    await erste.dblclick();
    await page.waitForFunction(([s, n, k]) => [...document.querySelectorAll(`${s} .tb-zeile`)].some((z) => z.children[0]?.textContent.trim() === n && z.textContent.includes(k)), [liste, o1.nr, kandidat], { timeout: 15000 });
    await foto('05-vorschlag-uebernommen');
    schritt(`Vorschlag übernommen: Nr. ${o1.nr} → ${kandidat}`);

    // Entfall mit „-“ auf der nächsten offenen Zeile
    const o2 = await offeneZeile();
    if (o2) {
      await page.locator(`${liste} .tb-zeile[data-r="${o2.r}"] .tb-zelle`).first().click();
      await page.keyboard.press('-');
      await page.waitForFunction(([s, n]) => [...document.querySelectorAll(`${s} .tb-zeile`)].some((z) => z.children[0]?.textContent.trim() === n && z.textContent.includes('---')), [liste, o2.nr], { timeout: 15000 });
      schritt(`Entfall Nr. ${o2.nr}`);
    }
    // Kontextmenü
    await page.locator(`${liste} .tb-zeile`).first().locator('.tb-zelle').nth(2).click({ button: 'right' });
    await page.waitForSelector('[role=menu] [role=menuitem]');
    await foto('06-kontextmenue');
    await page.keyboard.press('Escape');

    // Kalender und Arbeitsplatz „Verlegen und Tauschen“ (Tagespläne)
    await h.eintrag(page, 'vertretung.kalender');
    await page.waitForSelector('[data-ansicht="vertretung.kalender"] .tb-zeile');
    await h.eintrag(page, 'vertretung.planungsdialog');
    await page.waitForSelector('[data-arbeitsplatz=verlegen] [data-ansicht="vertretung.plan"] .ra-eintrag', { timeout: 15000 });
    await foto('07-verlegen-und-tauschen');
    schritt('Verlegen und Tauschen (Tagespläne)');

    // Veranstaltung mit allen Lehrkräften
    await h.eintrag(page, 'vertretung.veranstaltungen');
    const va = '[data-ansicht="veranstaltungen.liste"]';
    await page.waitForSelector(`${va} .tb-zeile.tb-neu`);
    await page.locator(`${va} .tb-zeile.tb-neu .tb-zelle`).nth(3).click();
    await page.keyboard.type('Alle Lehrkräfte');
    await page.keyboard.press('Enter');
    // Mehrfachauswahl: das erste Enter übernimmt den Vorschlag, das zweite beendet die Eingabe
    await page.waitForTimeout(500);
    if (!(await page.evaluate((s) => [...document.querySelectorAll(`${s} .tb-zelle`)].some((z) => z.textContent.includes('Alle Lehrkräfte')), va))) await page.keyboard.press('Enter');
    await page.waitForFunction((s) => [...document.querySelectorAll(`${s} .tb-zelle`)].some((z) => z.textContent.includes('Alle Lehrkräfte')), va, { timeout: 15000 });
    await foto('08-veranstaltung-alle');
    schritt('Veranstaltung „Alle Lehrkräfte“ angelegt');

    // Arbeitsplatz Tagesplanung, Tagesablauf: 1 Abwesenheiten erfassen → 2 offene Stunden lösen (Karten, Tasten, Automatik mit Prüfung,
    // Wer ist frei?) → 3 prüfen und veröffentlichen; danach die Expertenansicht (bisherige Tagesplanung)
    await page.click('[data-nav="nav:Tagesplanung"]');
    const tp = '[data-arbeitsplatz=tagesplanung]';
    await page.waitForSelector(`${tp} [data-testid=tp-modus]`, { timeout: 15000 });
    await page.click(`${tp} [data-testid=tp-modus] [data-wert=ablauf]`);
    await page.waitForSelector(`${tp} [data-testid=tp-schritte]`, { timeout: 10000 });
    await page.click(`${tp} [data-schritt=erfassen]`);
    await page.waitForSelector(`${tp} [data-testid=erfassen-form]`, { timeout: 15000 });
    const offenStand = async () => Number(((await page.textContent(`${tp} [data-testid=tageskopf] [data-schritt=loesen]`)) || '').match(/(\d+) offen/)?.[1] || 0);
    const offen0 = await offenStand();
    // Schnellerfassung: Lehrkraft wählen, ganztägig, Enter bzw. „Abwesenheit erfassen“
    const wer = page.locator(`${tp} [data-testid=erfassen-form] input[aria-label=Abwesend]`);
    await wer.click();
    await wer.fill(kurz2);
    await page.locator('[role=menuitemcheckbox], [role=option]', { hasText: kurz2 }).first().click();
    await page.keyboard.press('Escape');
    await page.click(`${tp} [data-testid=erfassen-speichern]`);
    // Rückfragen (z. B. Lehrkraft aus der Veranstaltung „Alle Lehrkräfte“ entfernen) bestätigen
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(500);
      const ja = page.locator('[role=dialog] button', { hasText: /^(Ja|OK)$/ });
      if (await ja.count()) await ja.first().click(); else if (i > 1) break;
    }
    await page.waitForFunction(([s, k]) => [...document.querySelectorAll(`${s} [data-bereich=abwesenheiten] .tb-zeile`)].some((z) => z.textContent.includes(k)), [tp, kurz2], { timeout: 15000 });
    await page.waitForFunction(([s, k]) => (document.querySelector(`${s} [data-testid=erfassen-auswirkungen]`)?.textContent || '').includes(k), [tp, kurz2], { timeout: 15000 });
    await foto('09-tagesablauf-erfassen');
    schritt(`Tagesablauf: Abwesenheit ${kurz2} erfasst (vorher ${offen0} offen)`);
    // Offene Stunden lösen: Karten mit Kandidaten, 1 weist den ersten zu, J/E: nächste Stunde entfällt
    await page.click(`${tp} [data-testid=weiter-loesen]`);
    const karten = `${tp} [data-testid=arbeitsliste] .ta-karte`;
    await page.waitForSelector(`${karten}.gewaehlt .ta-kandidaten :is(.ta-kandidat, .ta-leer)`, { timeout: 15000 });
    const zahlOffen = async () => Number(((await page.textContent(`${tp} [data-bereich=arbeitsliste] [data-testid=arbeitsliste-filter] [data-wert=offen]`)) || '').match(/\d+/)?.[0] || 0);
    const n1 = await zahlOffen();
    if (!n1) throw new Error('Arbeitsliste ohne offene Stunden');
    await foto('10-tagesablauf-loesen');
    // erste Karte mit Kandidaten (alle Lehrkräfte können durch die Veranstaltung gebunden sein)
    await page.waitForFunction((s) => ![...document.querySelectorAll(`${s} .ta-laedt`)].length, karten, { timeout: 15000 });
    const mitKandidat = page.locator(`${karten}:has(.ta-kandidat)`).first();
    if (await mitKandidat.count()) {
      const id1 = await mitKandidat.getAttribute('data-id');
      await mitKandidat.locator('.ta-kopf').click();
      await page.waitForSelector(`${karten}.gewaehlt[data-id="${id1}"]`, { timeout: 5000 });
      const k1 = (await page.textContent(`${karten}.gewaehlt .ta-kandidat .ta-kurz`)).trim();
      await page.keyboard.press('1');
      await page.waitForFunction(([s, id]) => !document.querySelector(`${s} [data-testid=arbeitsliste] .ta-karte[data-id="${id}"]`), [tp, id1], { timeout: 15000 });
      schritt(`Taste 1: Nr. ${id1} → ${k1}`);
    } else {
      // keine Lehrkraft frei: Kandidat aus „Wer ist frei?“ gibt es nicht – weiter mit Entfall
      schritt('Keine Karte mit freier Lehrkraft (Veranstaltung „Alle Lehrkräfte“)');
    }
    if ((await zahlOffen()) > 0) {
      await page.waitForSelector(`${karten}.gewaehlt`, { timeout: 10000 });
      const id2 = await page.getAttribute(`${karten}.gewaehlt`, 'data-id');
      await page.keyboard.press('e');
      await page.waitForFunction(([s, id]) => !document.querySelector(`${s} [data-testid=arbeitsliste] .ta-karte[data-id="${id}"]`), [tp, id2], { timeout: 15000 });
      schritt(`Taste E: Nr. ${id2} entfällt`);
    }
    // Kontext: Wer ist frei? (Matrix) und Pläne folgen der Auswahl
    await page.click(`${tp} [role=tab][data-kontext=frei]`);
    await page.waitForSelector(`${tp} [data-testid=wer-ist-frei] .ta-mzeile`, { timeout: 15000 });
    if ((await zahlOffen()) > 0) await page.waitForSelector(`${tp} [data-testid=wer-ist-frei] .ta-mstd.markiert`, { timeout: 10000 });
    await foto('11-tagesablauf-wer-ist-frei');
    await page.keyboard.press('p');
    await page.waitForSelector(`${tp} [data-bereich=plan-klasse] .ra-eintrag`, { timeout: 15000 });
    schritt('Wer ist frei? und Pläne im Kontextbereich');
    // Automatisch vorschlagen: Probe ohne Änderung, Prüfung, alle übernehmen
    if ((await zahlOffen()) > 0) {
      const vorher = await zahlOffen();
      await page.locator(`${tp} [data-bereich=arbeitsliste] [role=toolbar] button`, { hasText: 'Automatisch vorschlagen' }).click();
      await page.waitForSelector(`${tp} [data-testid=automatik-pruefung]`, { timeout: 20000 });
      if ((await zahlOffen()) !== vorher) throw new Error('Die Probe der Automatik hat bereits etwas geändert');
      await foto('12-tagesablauf-automatik');
      const alle = page.locator(`${tp} [data-testid=automatik-alle]`);
      if (await alle.isEnabled()) {
        await alle.click();
        await page.waitForFunction(([s, n]) => Number((document.querySelector(`${s} [data-bereich=arbeitsliste] [data-testid=arbeitsliste-filter] [data-wert=offen]`)?.textContent || '').match(/\d+/)?.[0] || 0) < n, [tp, vorher], { timeout: 20000 });
      } else await page.locator(`${tp} [data-testid=automatik-pruefung] button`, { hasText: 'Verwerfen' }).click();
      schritt(`Automatik geprüft und übernommen: ${vorher} → ${await zahlOffen()} offen`);
    }
    // Bearbeitete Stunden: zurücksetzen (Entf) macht eine Stunde wieder offen
    await page.click(`${tp} [data-testid=arbeitsliste-filter] [data-wert=bearbeitet]`);
    await page.waitForSelector(`${karten}.erledigt.gewaehlt`, { timeout: 10000 });
    const vorZurueck = await zahlOffen();
    await page.locator(`${karten}.erledigt.gewaehlt .ta-kopf`).click();
    await page.keyboard.press('Delete');
    await page.waitForFunction(([s, n]) => Number((document.querySelector(`${s} [data-testid=arbeitsliste-filter] [data-wert=offen]`)?.textContent || '').match(/\d+/)?.[0] || 0) > n, [tp, vorZurueck], { timeout: 15000 });
    await page.click(`${tp} [data-testid=arbeitsliste-filter] [data-wert=offen]`);
    schritt('Bearbeitete Stunde zurückgesetzt');
    // Prüfen und veröffentlichen: Stand, Zahlen, Belastung
    await page.click(`${tp} [data-schritt=pruefen]`);
    await page.waitForSelector(`${tp} [data-testid=pruefen] .ta-statusliste`, { timeout: 15000 });
    await page.waitForSelector(`${tp} [data-testid=belastung] .ta-bzeile:not(.kopf)`, { timeout: 15000 });
    await page.waitForSelector(`${tp} [data-testid=pruefen] [data-testid=pruefen-senden]`, { timeout: 10000 });
    await foto('13-tagesablauf-pruefen');
    schritt('Prüfen und veröffentlichen: Tagesbilanz, Belastung, Senden');

    // Expertenansicht: Tageskopf, schlanke Liste, Vorschlag und Tagespläne (Kalender und Abwesenheiten auf eigenen Seiten)
    await page.click(`${tp} [data-testid=tp-modus] [data-wert=experte]`);
    await page.waitForSelector(`${tp} [data-ansicht="vertretung.liste"] .tb-zeile`, { timeout: 15000 });
    await page.waitForSelector(`${tp} [data-ansicht="vertretung.plan"] .ra-eintrag`, { timeout: 15000 });
    await page.waitForFunction((s) => /offen/.test(document.querySelector(`${s} [data-testid=tagessumme]`)?.textContent || ''), tp, { timeout: 15000 });
    if (await page.locator(`${tp} [data-ansicht="vertretung.kalender"], ${tp} [data-ansicht="vertretung.absenzen"]`).count()) throw new Error('Kalender/Abwesenheiten gehören nicht mehr in die Tagesplanung');
    const tagSpalten = await page.locator(`${tp} [data-ansicht="vertretung.plan"]`).first().locator('.ra-kopf').count();
    if (tagSpalten !== 1) throw new Error(`Tagesplan zeigt ${tagSpalten} Tage statt nur des Planungstags`);
    await page.locator(`${tp} [data-ansicht="vertretung.liste"] .tb-zeile`).first().locator('.tb-zelle').first().click();
    await page.waitForSelector(`${tp} [data-testid=vorschlag-kopf]`, { timeout: 15000 });
    await foto('14-tagesplanung-experte');
    await page.click(`${tp} [data-testid=liste-filter]`);
    await page.waitForSelector('[role=switch], input[role=switch]', { timeout: 5000 }).catch(() => {});
    await page.getByLabel('Nur offene').check();
    await page.waitForFunction((s) => [...document.querySelectorAll(`${s} [data-ansicht="vertretung.liste"] .tb-zeile`)].every((z) => z.querySelector('.vt-z-offen')), tp, { timeout: 15000 });
    await foto('14b-tagesplanung-filter');
    await page.keyboard.press('Escape');
    schritt('Tagesplanung: Tageskopf, Liste mit Filter, Vorschlag, Tagespläne');

    // Tag blättern mit Strg+Bild↓
    await page.locator('[data-arbeitsplatz=tagesplanung] [data-ansicht="vertretung.liste"] .tb-zeile').first().click().catch(() => {});
    await page.keyboard.press('Control+PageDown');
    await page.waitForFunction((d) => (document.querySelector('[data-testid=planungsdatum] input[data-datum]')?.dataset.datum || '') > d, datum, { timeout: 10000 });
    await page.waitForTimeout(600);
    await foto('15-naechster-tag');
    schritt(`Tag gewechselt: ${await datumImKopf()}`);

    // Wochenansicht: Umschalter Tag | Woche im Plankopf, Planungstag hervorgehoben, Klick auf einen anderen Tag wechselt das Datum
    const planK = `${tp} [data-bereich=plan-klasse]`;
    await page.click(`${tp} [data-testid=plan-ansicht-klasse] [data-wert=woche]`);
    await page.waitForFunction((s) => document.querySelectorAll(`${s} .ra-kopf`).length >= 5, planK, { timeout: 10000 });
    if ((await page.locator(`${planK} .ra-kopf.vt-planungstag`).count()) !== 1) throw new Error('Planungstag im Wochenplan nicht hervorgehoben');
    if ((await page.locator(`${tp} [data-bereich=plan-lehrer] .ra-kopf`).count()) !== 1) throw new Error('Lehrkräfteplan sollte in der Tagesansicht bleiben');
    const d0 = await datumImKopf();
    await page.locator(`${planK} .ra-kopf button.vt-tagwahl`).first().click();
    await page.waitForFunction((d) => document.querySelector('[data-testid=planungsdatum] input[data-datum]')?.dataset.datum !== d, d0, { timeout: 10000 });
    await page.waitForTimeout(500);
    const d1 = await datumImKopf();
    if (!(await page.locator(`${tp} [data-testid=wochenstreifen] [data-datum="${d1}"][aria-pressed=true]`).count())) throw new Error('Wochenstreifen folgt dem Planungstag nicht');
    await foto('16-wochenplan-klasse');
    schritt(`Wochenplan Klasse, Tag gewechselt ${d0} → ${d1}`);

    // ganze Seite im Wochenmodus: Liste nach Tagen gegliedert, beide Pläne als Woche untereinander, Wochenstreifen
    await page.click(`${tp} [data-testid=seiten-ansicht] [data-wert=woche]`);
    await page.waitForSelector(`${tp} [data-ansicht="vertretung.liste"] .tb-zeile.vt-tageskopf`, { timeout: 15000 });
    await page.waitForFunction((s) => document.querySelectorAll(`${s} [data-bereich=plan-lehrer] .ra-kopf`).length >= 5, tp, { timeout: 10000 });
    if ((await page.locator(`${tp}`).getAttribute('data-arbeitsplatz')) !== 'tagesplanung' || !(await page.locator('[data-ansicht-art=woche]').count())) throw new Error('Wochenaufteilung fehlt');
    const kb = await page.locator(`${tp} [data-bereich=plan-klasse]`).boundingBox();
    const lb = await page.locator(`${tp} [data-bereich=plan-lehrer]`).boundingBox();
    if (!(lb.y > kb.y + kb.height - 2)) throw new Error('Pläne stehen im Wochenmodus nicht untereinander');
    await foto('17-tagesplanung-woche');
    // Wochenstreifen: anderer Tag
    const tageImListe = await page.evaluate((s) => [...document.querySelectorAll(`${s} .tb-zeile.vt-tageskopf`)].map((z) => z.textContent), tp);
    const streifen = page.locator(`${tp} [data-testid=wochenstreifen] button[aria-pressed=false]:not(.frei)`);
    const ziel = await streifen.first().getAttribute('data-datum');
    await streifen.first().click();
    await page.waitForFunction((d) => document.querySelector('[data-testid=planungsdatum] input[data-datum]')?.dataset.datum === d, ziel, { timeout: 10000 });
    const zielText = `${ziel.slice(8, 10)}.${ziel.slice(5, 7)}.`;
    if (tageImListe.some((x) => x.includes(zielText))) await page.waitForSelector(`${tp} .tb-zeile.vt-tageskopf.vt-planungstag`, { timeout: 10000 });
    schritt(`Liste der Woche nach Tagen: ${tageImListe.length} Tag(e); Wochenstreifen → ${ziel}`);
    // Woche blättern mit Strg+Umschalt+Bild↓ / Bild↑
    await page.locator(`${tp} [data-ansicht="vertretung.liste"] .tb-zeile`).first().click().catch(() => {});
    await page.keyboard.press('Control+Shift+PageDown');
    await page.waitForFunction((d) => (document.querySelector('[data-testid=planungsdatum] input[data-datum]')?.dataset.datum || '') >= new Date(new Date(d).getTime() + 5 * 864e5).toISOString().slice(0, 10), ziel, { timeout: 10000 });
    const naechste = await datumImKopf();
    await page.keyboard.press('Control+Shift+PageUp');
    await page.waitForFunction((d) => (document.querySelector('[data-testid=planungsdatum] input[data-datum]')?.dataset.datum || '') < d, naechste, { timeout: 10000 });
    schritt(`Woche blättern: ${naechste} → ${await datumImKopf()}`);
    // Plan vergrößern und mit Esc zurück
    await page.click(`${tp} [data-testid=plan-gross-klasse]`);
    await page.waitForSelector(`${tp} [data-bereich=liste]`, { state: 'hidden', timeout: 5000 });
    await page.waitForSelector(`${tp} [data-bereich=plan-lehrer]`, { state: 'hidden', timeout: 5000 });
    await foto('18-plan-vergroessert');
    await page.keyboard.press('Escape');
    await page.waitForSelector(`${tp} [data-bereich=liste]`, { state: 'visible', timeout: 5000 });
    // gemerkt (localStorage): nach dem Neuladen wieder Woche
    await page.reload();
    await page.waitForSelector(`${tp} [data-testid=seiten-ansicht] [data-wert=woche][aria-checked=true]`, { timeout: 20000 });
    await page.waitForFunction((s) => document.querySelectorAll(`${s} [data-bereich=plan-lehrer] .ra-kopf`).length >= 5, tp, { timeout: 15000 });
    await page.click(`${tp} [data-testid=seiten-ansicht] [data-wert=tag]`);
    await page.waitForFunction((s) => document.querySelectorAll(`${s} [data-bereich=plan-klasse] .ra-kopf`).length === 1, tp, { timeout: 10000 });
    schritt('Tagesplanung im Wochenmodus: Liste nach Tagen, Pläne untereinander, Wochenstreifen, Vergrößern, gemerkt');

    // Verknüpfung der Pläne: Stunde im Klassenplan → Lehrkräfteplan zeigt deren Lehrkraft (und umgekehrt die Klasse)
    // Titel des Plans („Lehrkraft MEY“, aria-label des Bereichs)
    const gewaehlteOption = (b) => page.evaluate((s) => document.querySelector(`${s} section[aria-label]`)?.getAttribute('aria-label') || '', `${tp} [data-bereich=${b}]`);
    // Stunde mit Lehrkraft (bei einer Vertretung zeigt der Plan wie die Liste die ursprüngliche Lehrkraft, „statt …“)
    await page.waitForSelector(`${tp} [data-bereich=plan-klasse] .ra-eintrag`, { timeout: 15000 });
    const kandidaten = page.locator(`${tp} [data-bereich=plan-klasse] .ra-eintrag:not(.vt-st-Entfall)`);
    let stunde = null, lk = null;
    for (let i = 0; i < await kandidaten.count() && !lk; i++) {
      const tt = (await kandidaten.nth(i).getAttribute('title')) || '';
      const statt = tt.match(/statt (\S+)/);
      const l = statt ? statt[1] : tt.split('\n')[1]?.split(' – ')[2];
      if (l && l !== '???') { stunde = kandidaten.nth(i); lk = l; }
    }
    if (!stunde) throw new Error('keine Stunde mit Lehrkraft im Klassenplan');
    await stunde.click();
    await page.waitForFunction(([s, k]) => (document.querySelector(`${s} [data-bereich=plan-lehrer] section[aria-label]`)?.getAttribute('aria-label') || '').endsWith(` ${k}`), [tp, lk], { timeout: 10000 });
    const kl = await page.evaluate((s) => document.querySelector(`${s} [data-bereich=plan-lehrer] .ra-eintrag .zeile2`)?.textContent || '', tp);
    if (kl) {
      await page.locator(`${tp} [data-bereich=plan-lehrer] .ra-eintrag`).first().click();
      await page.waitForFunction(([s, k]) => (document.querySelector(`${s} [data-bereich=plan-klasse] section[aria-label]`)?.getAttribute('aria-label') || '').endsWith(` ${k.replace(/[()]/g, '').split(',')[0].trim()}`), [tp, kl], { timeout: 10000 });
    }
    schritt(`Pläne verknüpft: Klassenplan → ${await gewaehlteOption('plan-lehrer')}, Lehrkräfteplan → ${await gewaehlteOption('plan-klasse')}`);

    // Einstellungen der Vertretungsplanung (Dialog, Seite Vertretungsvorschlag)
    await page.evaluate(() => { void window.studioTest.befehl('vertretung.einstellungen', { seite: 2 }); });
    await page.waitForSelector('[role=dialog]');
    await foto('19-einstellungen');
    await page.keyboard.press('Escape');
  });
})().catch((e) => { console.error(e); process.exit(1); });
