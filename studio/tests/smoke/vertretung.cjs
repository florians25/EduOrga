// Oberflächentest der Vertretungsplanung (Playwright, Chromium).
//
//   NODE_PATH=$(npm root -g) STUDIO_URL=http://127.0.0.1:5501 STUDIO_PASSWORT=geheim123 node studio/tests/smoke/vertretung.cjs
//
// Ablauf: Beispielschule → Vertretungsmodus mit Planungsdatum → Abwesenheit direkt in der Liste erfassen (Entwurf, Strg+Enter)
// → Vertretungen mit offenen Stunden (Plakette „Offen“) → Vorschlag (Enter) und ersten Kandidaten übernehmen → Entfall mit „-“ →
// Kontextmenü → Kalender → Arbeitsplatz „Verlegen und Tauschen“ → Veranstaltung „Alle Lehrkräfte“ → Tagesplanung (Standard: Tagesübersicht
// nach Klassen; Abwesenheit im Blatt erfassen; Matrix: J, Enter, Rückgängig, Pfeile, Miniplan, Klasse abwesend, Mehrfachauswahl,
// 1280×720, Lehrkräfte) → Offene Stunden mit Entscheidung: Enter übernimmt die Empfehlung, E Entfall, Mehrfachauswahl,
// Wer ist frei? und Pläne im Seitenbereich, Empfehlungen für alle prüfen, gelöste Stunde zurücksetzen, Blatt Veröffentlichen
// mit Belastung) → Tabelle (schlanke Liste, Filter, Entscheidung und gemeinsame Kandidaten, Pläne als Tagesansicht) → Tag
// blättern (Strg+Bild↓) → Wochenansicht (Umschalter Tag | Woche im Plan, „Ganze Woche“ mit Wochenstreifen, Strg+Umschalt+Bild↓/↑,
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

    // Arbeitsplatz Tagesplanung (Liste): Abwesenheit im Blatt erfassen → offene Stunden eine nach der anderen lösen (Empfehlung
    // mit Enter, Entfall mit E, Mehrfachauswahl, Wer ist frei?, Pläne, Empfehlungen für alle prüfen, gelöste Stunde zurücksetzen)
    // → Veröffentlichen (Blatt) → Tabelle (Liste mit Filter, Entscheidung daneben, gemeinsame Kandidaten)
    await page.click('[data-nav="nav:Tagesplanung"]');
    const tp = '[data-arbeitsplatz=tagesplanung]';
    await page.waitForSelector(`${tp} [data-testid=tp-modus]`, { timeout: 15000 });
    // Standard ist die Tagesübersicht nach Klassen
    await page.waitForSelector(`${tp} [data-testid=tp-modus] [data-wert=klassen][aria-checked=true]`, { timeout: 10000 });
    await page.waitForSelector(`${tp} [data-ansicht="vertretung.matrix"] [data-testid=matrix] .mx-zelle`, { timeout: 15000 });
    await page.click(`${tp} [data-testid=tp-modus] [data-wert=liste]`);
    if (await page.locator(`${tp} [data-testid=tp-schritte], ${tp} [data-testid=wochenstreifen]`).count()) throw new Error('Schritte bzw. Wochenstreifen gehören nicht mehr in die Tagesansicht');
    const offenStand = async () => Number(((await page.textContent(`${tp} [data-testid=tagessumme]`)) || '').match(/(\d+) offen/)?.[1] || 0);
    await page.waitForFunction((s) => /offen/.test(document.querySelector(`${s} [data-testid=tagessumme]`)?.textContent || ''), tp, { timeout: 15000 });
    const offen0 = await offenStand();
    // Blatt „Abwesenheiten“: Schnellerfassung (Lehrkraft wählen, ganztägig), darunter die Abwesenheiten des Tages
    await page.click(`${tp} [data-testid=tp-abwesenheiten]`);
    const blattA = '[data-testid=blatt-abwesenheiten]';
    await page.waitForSelector(`${blattA} [data-testid=erfassen-form]`, { timeout: 15000 });
    const wer = page.locator(`${blattA} [data-testid=erfassen-form] input[aria-label=Abwesend]`);
    await wer.click();
    await wer.fill(kurz2);
    await page.locator('[role=menuitemcheckbox], [role=option]:not(.tp-zeile)', { hasText: kurz2 }).first().click();
    await page.keyboard.press('Escape');
    await page.click(`${blattA} [data-testid=erfassen-speichern]`);
    // Rückfragen (z. B. Lehrkraft aus der Veranstaltung „Alle Lehrkräfte“ entfernen) bestätigen
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(500);
      const ja = page.locator('[role=dialog]:not(.fui-OverlayDrawer) button', { hasText: /^(Ja|OK)$/ });
      if (await ja.count()) await ja.first().click(); else if (i > 1) break;
    }
    await page.waitForFunction(([s, k]) => [...document.querySelectorAll(`${s} [data-bereich=abwesenheiten] .tb-zeile`)].some((z) => z.textContent.includes(k)), [blattA, kurz2], { timeout: 15000 });
    await page.waitForFunction(([s, k]) => (document.querySelector(`${s} [data-testid=erfassen-auswirkungen]`)?.textContent || '').includes(k), [blattA, kurz2], { timeout: 15000 });
    await foto('09-tagesplanung-abwesenheiten');
    schritt(`Tagesplanung: Abwesenheit ${kurz2} im Blatt erfasst (vorher ${offen0} offen)`);
    await page.click(`${blattA} [data-testid=weiter-loesen]`);
    await page.waitForSelector(blattA, { state: 'detached', timeout: 5000 });

    // Tagesübersicht nach Klassen (Matrix Klassen × Stunden): J wählt die erste offene Stunde, Enter übernimmt die Empfehlung (Rückgängig),
    // Pfeiltasten, Miniplan (P, verschieben, einklappen, gemerkt), Kontextmenü, Klasse abwesend (Band) und wieder entfernen,
    // Mehrfachauswahl (Umschalt+Klick), Lehrkräfte-Variante; 1280×720 ohne waagrechtes Blättern der Seite
    {
      const mx = `${tp} [data-ansicht="vertretung.matrix"]`;
      await page.click(`${tp} [data-testid=tp-modus] [data-wert=klassen]`);
      await page.waitForSelector(`${mx} [data-testid=matrix] .mx-zelle[data-status=o]`, { timeout: 15000 });
      if (!(await page.locator(`${mx} [data-testid=mx-frei]`).count())) throw new Error('Spaltenkopf ohne verfügbare Lehrkräfte');
      await page.locator(`${mx} [data-testid=matrix]`).focus();
      await page.keyboard.press('j');
      await page.waitForSelector(`${mx} .mx-zelle.gewaehlt[data-status=o]`, { timeout: 10000 });
      await page.waitForSelector(`${mx} [data-testid=entscheidung] [data-testid=empfehlung] :is(button, .tp-leise:not(.tp-laedt))`, { timeout: 15000 });
      await foto('09a-tagesuebersicht-klassen');
      const v1 = await page.getAttribute(`${mx} .mx-zelle.gewaehlt`, 'data-v');
      if (await page.locator(`${mx} [data-testid=empfehlung-uebernehmen][data-art=lehrer]`).count()) {
        const k1 = await page.getAttribute(`${mx} [data-testid=empfehlung-uebernehmen]`, 'data-lehrer');
        await page.keyboard.press('Enter');
        await page.waitForFunction(([s, v]) => document.querySelector(`${s} .mx-zelle[data-v="${v}"]`)?.dataset.status === 'v', [mx, v1], { timeout: 15000 });
        await page.waitForFunction(([s, k]) => (document.querySelector(`${s} [data-testid=zuletzt]`)?.textContent || '').includes(k), [mx, k1], { timeout: 10000 });
        await foto('09b-tagesuebersicht-nach-enter');
        await page.locator(`${mx} [data-testid=zuletzt] button`, { hasText: 'Rückgängig' }).click();
        await page.waitForFunction(([s, v]) => document.querySelector(`${s} .mx-zelle[data-v="${v}"]`)?.dataset.status === 'o', [mx, v1], { timeout: 15000 });
        schritt(`Tagesübersicht: Enter trägt ${k1} ein (Nr. ${v1}), Rückgängig stellt die offene Stunde wieder her`);
      } else schritt('Tagesübersicht: keine Empfehlung mit Lehrkraft');
      // Pfeiltasten
      await page.locator(`${mx} .mx-zelle[data-v="${v1}"]`).click();
      const c0 = Number(await page.getAttribute(`${mx} .mx-zelle.gewaehlt`, 'data-col'));
      await page.keyboard.press(c0 > 0 ? 'ArrowLeft' : 'ArrowRight');
      await page.waitForFunction(([s, c]) => Number(document.querySelector(`${s} .mx-zelle.gewaehlt`)?.dataset.col ?? c) !== c, [mx, c0], { timeout: 5000 });
      await page.keyboard.press(c0 > 0 ? 'ArrowRight' : 'ArrowLeft');
      // Miniplan: P öffnet den Plan der Lehrkraft (folgt der Auswahl), verschieben, einklappen, nach dem Neuladen wieder da
      await page.keyboard.press('p');
      const mini = page.locator('[data-testid=miniplan]').first();
      await mini.waitFor({ timeout: 10000 });
      await page.waitForSelector('[data-testid=miniplan] .mp-raster', { timeout: 10000 });
      const m0 = await mini.boundingBox();
      await page.mouse.move(m0.x + 40, m0.y + 14); await page.mouse.down(); await page.mouse.move(m0.x - 160, m0.y - 100, { steps: 8 }); await page.mouse.up();
      const m1 = await mini.boundingBox();
      if (!(m1.x < m0.x - 100 && m1.y < m0.y - 50)) throw new Error('Miniplan lässt sich nicht verschieben');
      await foto('09c-tagesuebersicht-miniplan');
      await mini.locator('[data-testid=miniplan-min]').click();
      await page.waitForFunction(() => (document.querySelector('[data-testid=miniplan]')?.getBoundingClientRect().height || 0) < 40, null, { timeout: 5000 });
      await page.reload();
      await page.waitForSelector(`${mx} [data-testid=matrix] .mx-zelle`, { timeout: 20000 });
      await page.waitForSelector('[data-testid=miniplan]', { timeout: 10000 });
      const m2 = await page.locator('[data-testid=miniplan]').first().boundingBox();
      if (Math.abs(m2.x - m1.x) > 2 || m2.height > 40) throw new Error('Lage bzw. Zustand des Miniplans nicht gemerkt');
      await page.locator('[data-testid=miniplan] [data-testid=miniplan-zu]').first().click();
      await page.waitForSelector('[data-testid=miniplan]', { state: 'detached', timeout: 5000 });
      schritt('Miniplan: P öffnet, verschieben, einklappen, gemerkt, schließen');
      // Kontextmenü einer Zelle: Plan der Klasse als Miniplan
      await page.locator(`${mx} .mx-zelle[data-status=o]`).first().click({ button: 'right' });
      await page.locator('[role=menuitem]', { hasText: /^Plan von .* anzeigen$/ }).first().click();
      await page.waitForSelector('[data-testid=miniplan] .mp-raster', { timeout: 10000 });
      await page.locator('[data-testid=miniplan] [data-testid=miniplan-zu]').first().click();
      // Klasse abwesend (Ausflug) über das Kontextmenü der Zeile: Band über den Tag, danach wieder entfernen
      const kl = await page.getAttribute(`${mx} .mx-reihe[data-zeile]`, "data-zeile");
      await page.locator(`${mx} .mx-reihe[data-zeile="${kl}"] .mx-name`).click({ button: 'right' });
      await page.locator('[role=menuitem]', { hasText: 'ganztägig abwesend' }).click();
      await page.waitForSelector('[role=dialog]');
      await page.locator('[role=dialog] input').last().fill('Ausflug');
      await page.locator('[role=dialog] button', { hasText: 'Speichern' }).click();
      for (let i = 0; i < 4; i++) {
        await page.waitForTimeout(400);
        const ja = page.locator('[role=dialog] button', { hasText: /^(Ja|OK)$/ });
        if (await ja.count()) await ja.first().click(); else break;
      }
      await page.waitForSelector(`${mx} .mx-reihe[data-zeile="${kl}"] .mx-abwband`, { timeout: 15000 });
      if (!(await page.locator(`${mx} .mx-reihe[data-zeile="${kl}"] .mx-abwband`).textContent()).includes('Ausflug')) throw new Error('Band ohne Text');
      await foto('09d-tagesuebersicht-klasse-abwesend');
      await page.locator(`${mx} .mx-reihe[data-zeile="${kl}"] .mx-abwband`).first().click({ button: 'right' });
      await page.locator('[role=menuitem]', { hasText: 'Abwesenheit entfernen' }).click();
      await page.waitForSelector(`${mx} .mx-reihe[data-zeile="${kl}"] .mx-abwband`, { state: 'detached', timeout: 15000 });
      schritt(`Klasse ${kl} abwesend (Ausflug) als Band, wieder entfernt`);
      // Mehrfachauswahl: Umschalt+Klick über zwei offene Stunden → gemeinsame Kandidaten
      const offeneZ = page.locator(`${mx} .mx-zelle[data-status=o]`);
      if ((await offeneZ.count()) > 1) {
        await offeneZ.nth(0).click();
        await offeneZ.nth(1).click({ modifiers: ['Shift'] });
        await page.waitForSelector(`${mx} [data-testid=sammelleiste]`, { timeout: 15000 });
        if ((await page.locator(`${mx} .mx-zelle.markiert`).count()) < 2) throw new Error('Umschalt+Klick markiert nicht mehrere Stunden');
        await page.keyboard.press('Escape');
        await page.waitForSelector(`${mx} [data-testid=sammelleiste]`, { state: 'detached', timeout: 5000 });
        schritt('Tagesübersicht: Mehrfachauswahl mit gemeinsamen Kandidaten');
      }
      // 13-Zoll-Bildschirm: kein waagrechtes Blättern der Seite, Matrix und Entscheidung nebeneinander
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.waitForTimeout(500);
      if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) throw new Error('Waagrechtes Blättern bei 1280×720');
      const eb = await page.locator(`${mx} [data-testid=entscheidung-flaeche]`).boundingBox();
      if (!eb || eb.x + eb.width > 1281) throw new Error('Entscheidung bei 1280×720 abgeschnitten');
      await foto('09e-tagesuebersicht-1280');
      await page.setViewportSize({ width: 1600, height: 950 });
      // Lehrkräfte: abwesende zuerst
      await page.click(`${tp} [data-testid=tp-modus] [data-wert=lehrer]`);
      await page.waitForSelector(`${tp} [data-ansicht="vertretung.matrix"][data-art=lehrer] .mx-reihe[data-zeile="${kurz2}"]`, { timeout: 15000 });
      const ersteZeile = await page.getAttribute(`${tp} [data-ansicht="vertretung.matrix"][data-art=lehrer] .mx-reihe[data-zeile]`, 'data-zeile');
      if (!(await page.locator(`${tp} [data-ansicht="vertretung.matrix"][data-art=lehrer] .mx-gruppe`, { hasText: 'Abwesend' }).count())) throw new Error('Gruppe „Abwesend“ fehlt');
      await foto('09f-tagesuebersicht-lehrkraefte');
      schritt(`Tagesübersicht Lehrkräfte: erste Zeile ${ersteZeile}`);
      await page.click(`${tp} [data-testid=tp-modus] [data-wert=liste]`);
    }

    // Liste: eine Zeile je offener Stunde, rechts die Entscheidung (Empfehlung, Alternativen, Entfall)
    const zeilen = `${tp} [data-testid=arbeitsliste] .tp-zeile`;
    const entsch = `${tp} [data-testid=entscheidung]`;
    await page.waitForSelector(`${entsch} [data-testid=empfehlung] :is(button, .tp-leise:not(.tp-laedt))`, { timeout: 15000 });
    const zahlOffen = async () => Number(((await page.textContent(`${tp} [data-testid=arbeitsliste-filter] [data-wert=offen]`)) || '').match(/\d+/)?.[0] || 0);
    const n1 = await zahlOffen();
    if (!n1) throw new Error('Tagesplanung ohne offene Stunden');
    await foto('10-tagesplanung-liste');
    // Empfehlung mit Enter übernehmen (die nächste offene Stunde ist danach gewählt) – sonst die erste Stunde mit Empfehlung wählen
    let mitEmpfehlung = await page.locator(`${entsch} [data-testid=empfehlung-uebernehmen][data-art=lehrer]`).count();
    for (let i = 0; i < Math.min(n1, 8) && !mitEmpfehlung; i++) {
      await page.locator(`${tp} [data-testid=arbeitsliste]`).focus();
      await page.keyboard.press('j');
      await page.waitForTimeout(400);
      await page.waitForSelector(`${entsch} [data-testid=empfehlung] :is(button, .tp-leise:not(.tp-laedt))`, { timeout: 15000 });
      mitEmpfehlung = await page.locator(`${entsch} [data-testid=empfehlung-uebernehmen][data-art=lehrer]`).count();
    }
    if (mitEmpfehlung) {
      const id1 = await page.getAttribute(entsch, 'data-id');
      const k1 = await page.getAttribute(`${entsch} [data-testid=empfehlung-uebernehmen]`, 'data-lehrer');
      await page.locator(`${tp} [data-testid=arbeitsliste]`).focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(([s, id]) => !document.querySelector(`${s} [data-testid=arbeitsliste] .tp-zeile[data-id="${id}"]`), [tp, id1], { timeout: 15000 });
      await page.waitForFunction(([s, k]) => (document.querySelector(`${s} [data-testid=zuletzt]`)?.textContent || '').includes(k), [tp, k1], { timeout: 10000 });
      await foto('10a-tagesplanung-nach-enter');
      schritt(`Enter: Empfehlung übernommen, Nr. ${id1} → ${k1}`);
    } else schritt('Keine Stunde mit freier Lehrkraft (Veranstaltung „Alle Lehrkräfte“)');
    if ((await zahlOffen()) > 0) {
      await page.waitForSelector(`${zeilen}.gewaehlt`, { timeout: 10000 });
      const id2 = await page.getAttribute(`${zeilen}.gewaehlt`, 'data-id');
      await page.locator(`${tp} [data-testid=arbeitsliste]`).focus();
      await page.keyboard.press('e');
      await page.waitForFunction(([s, id]) => !document.querySelector(`${s} [data-testid=arbeitsliste] .tp-zeile[data-id="${id}"]`), [tp, id2], { timeout: 15000 });
      schritt(`Taste E: Nr. ${id2} entfällt`);
    }
    // Mehrfachauswahl: mit gedrückter Maustaste über zwei Zeilen ziehen → gemeinsame Kandidaten rechts
    if ((await zahlOffen()) > 1) {
      const a1 = await page.locator(zeilen).nth(0).boundingBox();
      const a2 = await page.locator(zeilen).nth(1).boundingBox();
      await page.mouse.move(a1.x + 30, a1.y + 8);
      await page.mouse.down();
      await page.mouse.move(a2.x + 30, a2.y + 8, { steps: 6 });
      await page.mouse.up();
      await page.waitForSelector(`${tp} [data-testid=sammelleiste] :is(.ta-kandidat, .ta-leer)`, { timeout: 15000 });
      if ((await page.locator(`${zeilen}.markiert`).count()) < 2) throw new Error('Ziehen markiert nicht mehrere Stunden');
      await foto('10b-tagesplanung-mehrfach');
      await page.keyboard.press('Escape');
      await page.waitForSelector(`${tp} [data-testid=sammelleiste]`, { state: 'detached', timeout: 5000 });
      schritt('Mehrfachauswahl durch Ziehen: gemeinsame Kandidaten');
    }
    if (!(await page.locator(`${tp} [data-testid=tageskopf-senden] [data-testid=tp-veroeffentlichen]`).count())) throw new Error('„Veröffentlichen“ fehlt im Tageskopf');
    // Seitenbereich: F zeigt „Wer ist frei?“ (Spalte der gewählten Stunde markiert), Reiter Pläne, P blendet ihn wieder aus
    if (await page.locator(`${tp} [data-testid=tp-kontext]`).count()) throw new Error('Pläne sollten zunächst ausgeblendet sein');
    await page.locator(`${tp} [data-testid=arbeitsliste]`).focus();
    await page.keyboard.press('f');
    await page.waitForSelector(`${tp} [data-testid=wer-ist-frei] .ta-mzeile`, { timeout: 15000 });
    if ((await zahlOffen()) > 0) await page.waitForSelector(`${tp} [data-testid=wer-ist-frei] .ta-mstd.markiert`, { timeout: 10000 });
    await foto('11-tagesplanung-wer-ist-frei');
    await page.click(`${tp} [role=tab][data-kontext=plaene]`);
    await page.waitForSelector(`${tp} [data-bereich=plan-klasse] .ra-eintrag`, { timeout: 15000 });
    await foto('11b-tagesplanung-plaene');
    await page.locator(`${tp} [data-testid=arbeitsliste]`).focus();
    await page.keyboard.press('p');
    await page.waitForSelector(`${tp} [data-testid=tp-kontext]`, { state: 'detached', timeout: 5000 });
    schritt('Wer ist frei? und Pläne im Seitenbereich, P blendet aus');
    // Empfehlungen für alle prüfen: Probe ohne Änderung, Prüfung, alle übernehmen
    if ((await zahlOffen()) > 1) {
      const vorher = await zahlOffen();
      await page.click(`${tp} [data-testid=alle-empfehlungen]`);
      await page.waitForSelector(`${tp} [data-testid=automatik-pruefung]`, { timeout: 20000 });
      if ((await zahlOffen()) !== vorher) throw new Error('Die Probe der Automatik hat bereits etwas geändert');
      await foto('12-tagesplanung-empfehlungen');
      const alle = page.locator(`${tp} [data-testid=automatik-alle]`);
      if (await alle.isEnabled()) {
        await alle.click();
        await page.waitForFunction(([s, n]) => Number((document.querySelector(`${s} [data-testid=arbeitsliste-filter] [data-wert=offen]`)?.textContent || '').match(/\d+/)?.[0] || 0) < n, [tp, vorher], { timeout: 20000 });
      } else await page.locator(`${tp} [data-testid=automatik-pruefung] button`, { hasText: 'Verwerfen' }).click();
      schritt(`Empfehlungen geprüft und übernommen: ${vorher} → ${await zahlOffen()} offen`);
    }
    // Gelöst: Entf setzt eine Stunde zurück (wieder offen)
    await page.click(`${tp} [data-testid=arbeitsliste-filter] [data-wert=bearbeitet]`);
    await page.waitForSelector(`${zeilen}.geloest.gewaehlt`, { timeout: 10000 });
    await page.waitForSelector(`${entsch} [data-testid=entscheidung-zuruecksetzen]`, { timeout: 10000 });
    const vorZurueck = await zahlOffen();
    await page.locator(`${zeilen}.geloest.gewaehlt`).click();
    await page.keyboard.press('Delete');
    await page.waitForFunction(([s, n]) => Number((document.querySelector(`${s} [data-testid=arbeitsliste-filter] [data-wert=offen]`)?.textContent || '').match(/\d+/)?.[0] || 0) > n, [tp, vorZurueck], { timeout: 15000 });
    await page.click(`${tp} [data-testid=arbeitsliste-filter] [data-wert=offen]`);
    schritt('Gelöste Stunde zurückgesetzt');
    // Blatt „Veröffentlichen“: Stand, Senden, Zahlen, Belastung; Esc schließt
    await page.click(`${tp} [data-testid=tp-veroeffentlichen]`);
    const blattV = '[data-testid=blatt-veroeffentlichen]';
    await page.waitForSelector(`${blattV} [data-testid=pruefen] .ta-statusliste`, { timeout: 15000 });
    await page.waitForFunction((s) => !!document.querySelector(`${s} [data-testid=belastung] .ta-bzeile:not(.kopf)`) || /niemand vertreten/.test(document.querySelector(`${s} [data-bereich=belastung]`)?.textContent || ''), blattV, { timeout: 15000 });
    await page.waitForSelector(`${blattV} [data-testid=pruefen-senden]`, { timeout: 10000 });
    await foto('13-tagesplanung-veroeffentlichen');
    await page.keyboard.press('Escape');
    await page.waitForSelector(blattV, { state: 'detached', timeout: 5000 });
    schritt('Veröffentlichen: Tagesbilanz, Belastung, Senden');

    // Tabelle: schlanke Liste, Entscheidung zur gewählten Zeile, gemeinsame Kandidaten, Filter; Kalender/Abwesenheiten auf eigenen Seiten
    await page.click(`${tp} [data-testid=tp-modus] [data-wert=tabelle]`);
    await page.waitForSelector(`${tp} [data-ansicht="vertretung.liste"] .tb-zeile`, { timeout: 15000 });
    if (await page.locator(`${tp} [data-ansicht="vertretung.kalender"], ${tp} [data-ansicht="vertretung.absenzen"]`).count()) throw new Error('Kalender/Abwesenheiten gehören nicht in die Tagesplanung');
    await page.locator(`${tp} [data-ansicht="vertretung.liste"] .tb-zeile`).first().locator('.tb-zelle').first().click();
    await page.waitForSelector(`${tp} [data-testid=entscheidung-flaeche] :is([data-testid=entscheidung], .tp-leer)`, { timeout: 15000 });
    {
      const zl = page.locator(`${tp} [data-ansicht="vertretung.liste"] .tb-zeile`);
      if ((await zl.count()) > 1) {
        const b1 = await zl.nth(0).locator('.tb-zelle').nth(1).boundingBox();
        const b2 = await zl.nth(1).locator('.tb-zelle').nth(1).boundingBox();
        await page.mouse.move(b1.x + 5, b1.y + 5); await page.mouse.down(); await page.mouse.move(b2.x + 5, b2.y + 5, { steps: 5 }); await page.mouse.up();
        await page.waitForSelector(`${tp} [data-testid=entscheidung-flaeche] [data-testid=sammelleiste]`, { timeout: 15000 });
        schritt('Tabelle: zwei Stunden aufgezogen – gemeinsame Kandidaten in der Entscheidung');
        await zl.nth(0).locator('.tb-zelle').first().click();
      }
    }
    await foto('14-tagesplanung-tabelle');
    await page.click(`${tp} [data-testid=liste-filter]`);
    await page.waitForSelector('[role=switch], input[role=switch]', { timeout: 5000 }).catch(() => {});
    await page.getByLabel('Nur offene').check();
    await page.waitForFunction((s) => [...document.querySelectorAll(`${s} [data-ansicht="vertretung.liste"] .tb-zeile`)].every((z) => z.querySelector('.vt-z-offen')), tp, { timeout: 15000 });
    await foto('14b-tagesplanung-filter');
    await page.keyboard.press('Escape');
    schritt('Tabelle: Liste mit Filter und Entscheidung');
    // Pläne einblenden: Tagespläne als Tagesansicht
    await page.click(`${tp} [data-testid=tp-plaene]`);
    await page.waitForSelector(`${tp} [data-ansicht="vertretung.plan"] .ra-eintrag`, { timeout: 15000 });
    const tagSpalten = await page.locator(`${tp} [data-ansicht="vertretung.plan"]`).first().locator('.ra-kopf').count();
    if (tagSpalten !== 1) throw new Error(`Tagesplan zeigt ${tagSpalten} Tage statt nur des Planungstags`);

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
    await foto('16-wochenplan-klasse');
    schritt(`Wochenplan Klasse, Tag gewechselt ${d0} → ${d1}`);

    // ganze Woche („…“ → Ganze Woche): Tabelle nach Tagen gegliedert, beide Pläne als Woche untereinander, Wochenstreifen im Kopf
    const ganzeWoche = async () => { await page.click(`${tp} [data-testid=tp-mehr]`); await page.locator('[role=menuitem]', { hasText: 'Ganze Woche' }).click(); };
    await ganzeWoche();
    await page.waitForSelector(`${tp} [data-ansicht="vertretung.liste"] .tb-zeile.vt-tageskopf`, { timeout: 15000 });
    await page.waitForFunction((s) => document.querySelectorAll(`${s} [data-bereich=plan-lehrer] .ra-kopf`).length >= 5, tp, { timeout: 10000 });
    if (!(await page.locator('[data-ansicht-art=woche]').count())) throw new Error('Wochenaufteilung fehlt');
    if (!(await page.locator(`${tp} [data-testid=wochenstreifen] [data-datum="${d1}"][aria-pressed=true]`).count())) throw new Error('Wochenstreifen folgt dem Planungstag nicht');
    const kb = await page.locator(`${tp} [data-bereich=plan-klasse]`).boundingBox();
    const lb = await page.locator(`${tp} [data-bereich=plan-lehrer]`).boundingBox();
    if (!(lb.y > kb.y + kb.height - 2)) throw new Error('Pläne stehen im Wochenmodus nicht untereinander');
    await foto('17-tagesplanung-woche');
    const tageImListe = await page.evaluate((s) => [...document.querySelectorAll(`${s} .tb-zeile.vt-tageskopf`)].map((z) => z.textContent), tp);
    const streifen = page.locator(`${tp} [data-testid=wochenstreifen] button[aria-pressed=false]:not(.frei)`);
    const ziel = await streifen.first().getAttribute('data-datum');
    await streifen.first().click();
    await page.waitForFunction((d) => document.querySelector('[data-testid=planungsdatum] input[data-datum]')?.dataset.datum === d, ziel, { timeout: 10000 });
    const zielText = `${ziel.slice(8, 10)}.${ziel.slice(5, 7)}.`;
    if (tageImListe.some((x) => x.includes(zielText))) await page.waitForSelector(`${tp} .tb-zeile.vt-tageskopf.vt-planungstag`, { timeout: 10000 });
    schritt(`Tabelle der Woche nach Tagen: ${tageImListe.length} Tag(e); Wochenstreifen → ${ziel}`);
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
    // gemerkt (localStorage): nach dem Neuladen wieder Tabelle, Pläne und Woche
    await page.reload();
    await page.waitForSelector(`${tp} [data-testid=wochenstreifen]`, { timeout: 20000 });
    await page.waitForSelector(`${tp} [data-testid=tp-modus] [data-wert=tabelle][aria-checked=true]`, { timeout: 10000 });
    await page.waitForFunction((s) => document.querySelectorAll(`${s} [data-bereich=plan-lehrer] .ra-kopf`).length >= 5, tp, { timeout: 15000 });
    await ganzeWoche();
    await page.waitForFunction((s) => document.querySelectorAll(`${s} [data-bereich=plan-klasse] .ra-kopf`).length === 1, tp, { timeout: 10000 });
    schritt('Tagesplanung: ganze Woche, Pläne untereinander, Wochenstreifen, Vergrößern, gemerkt');

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
