// Ansicht „Vertretungen“: Listenansichten (Klassen, Lehrkräfte, Druckansichten, Pausenaufsichten), Filterleiste (Ansicht,
// Klasse bzw. Lehrkraft, Zeitraum, Schalter „Nur offene“, „Nur Kollisionen“, „Veranstaltungen zusammenfassen“), wählbare Spalten,
// Sprung zur Nummer, direkte Eingabe (Vertretung mit „+“ = ohne Lehrkraft, „-“ = Entfall, Fach, Raum, Text …) für die bearbeitete
// bzw. alle markierten Zeilen. Häufige Aktionen als Textknöpfe, seltene unter „Weitere Aktionen“.
import { h, leeren, entprellen } from '../../kern/dom.js';
import { api, einstellungLesen, einstellungSchreiben } from '../../kern/api.js';
import { zustand, elemente, darfSchreiben } from '../../kern/zustand.js';
import { betrifft } from '../../kern/ereignisse.js';
import { Tabelle } from '../../kern/tabelle.js';
import { frage, meldung, hinweis, fehlerMelden, formular, dialog } from '../../kern/dialog.js';
import { fensterverwaltung } from '../../kern/fenster.js';
import { symbol } from '../../kern/symbole.js';
import { vpfad, mitRueckfragen, auswahlMelden, aktuelleAuswahl, planungsdatum, tageswechsel, status } from './kern.js';
import { zeitraumAuswahl, filterleiste, filterGruppe, schalter, menueKnopf } from './steuer.js';

/** Interne Schlüssel der Listenansichten (Server, gespeicherte Einstellungen) und ihre Anzeigenamen. */
export const ANSICHTEN = ['Klasse - Standard', 'Lehrer - Standard', 'Druck - Klasse', 'Druck - Lehrer', 'Pausenaufsichten'];
const ANSICHT_TEXT = { 'Klasse - Standard': 'Klassen', 'Lehrer - Standard': 'Lehrkräfte', 'Druck - Klasse': 'Druckansicht Klassen', 'Druck - Lehrer': 'Druckansicht Lehrkräfte', Pausenaufsichten: 'Pausenaufsichten' };
export const ansichtText = (a) => ANSICHT_TEXT[a] || a;

/** Spaltenbezeichnungen der Oberfläche (Titel, Beschreibung) und Mindestbreiten; Schlüssel wie vom Server. */
const TITEL = {
  Nr: ['Nr.', 'Nummer der Vertretung'], Art: ['Art', 'Art der Vertretung'], Std: ['Std.', 'Stunde'], Zeit: ['Zeit', 'Beginn und Ende'],
  Fach: ['Fach bisher', 'Fach laut Stundenplan'], NFach: ['Fach', 'Fach der Vertretung'], Lehrer: ['Lehrkraft', 'Lehrkraft laut Stundenplan'],
  Vertreter: ['Vertretung', 'Vertretende Lehrkraft'], AKlassen: ['Klassen bisher', 'Klassen laut Stundenplan'], Klassen: ['Klassen', 'Klassen der Vertretung'],
  Raum: ['Raum bisher', 'Raum laut Stundenplan'], NRaum: ['Raum', 'Raum der Vertretung'], Von: ['Verlegt von', 'Herkunft einer Verlegung'],
  Nach: ['Verlegt nach', 'Ziel einer Verlegung'], Text: ['Text', 'Text zur Vertretung'], Kz: ['Statistik', 'Statistikkennzeichen'], Grund: ['Grund', 'Abwesenheitsgrund'],
  UText: ['Unterrichtstext', 'Text des Unterrichts'], UZText: ['Zeilentext', 'Zeilentext des Unterrichts'], Beschr: ['Beschreibung', 'Beschreibung'],
  Entf: ['Entfall', 'Entfall'], Mitb: ['Mitbetreuung', 'Mitbetreuung'], Kopp: ['Kopplung', 'Gekoppelte Vertretungen'], Neu: ['Neu', 'Neue Vertretung'],
  Fix: ['Fixiert', 'Fixiert – wird nicht automatisch geändert'], ND: ['Nicht drucken', 'Wird nicht ausgegeben'], Text2: ['Text 2', 'Zweiter Text'],
  Ben: ['Benachrichtigen', 'Lehrkraft benachrichtigen'], Zaehler: ['Zähler', 'Vertretungszähler'], Wert: ['Wert', 'Wert bzw. Faktor'], Mehr: ['Mehrarbeit', 'Mehrarbeit'],
};
const BREITE = { Nr: 56, Art: 100, Datum: 62, Std: 46, Fach: 84, NFach: 60, Lehrer: 76, Vertreter: 86, AKlassen: 100, Klassen: 76, Raum: 86, NRaum: 64, Von: 92, Nach: 92, Fix: 60, ND: 96 };
const spaltenTitel = (s) => TITEL[s.schluessel]?.[0] || s.titel;
const spaltenFeld = (s) => TITEL[s.schluessel]?.[1] || s.feld;
const FELDER = 'vertretung.felder';
const ARTEN_AUS = 'vertretung.artenAus';
const EDITIERBAR = new Set(['NFach', 'Vertreter', 'NRaum', 'Text', 'Kz', 'SG', 'Beschr', 'Kopp', 'Text2', 'Wert']);
const ELEMENT = { NFach: 'fach', Vertreter: 'lehrer', NRaum: 'raum' };

/** Gespeicherte Spaltenauswahl: Spalte → Kennzeichen („a“ aktiv, „d“ drucken, „L“ Langname); fehlt = Standard. */
export async function feldEinstellungen(ansicht, spalten) {
  const alle = (await einstellungLesen(FELDER)) || {};
  const f = { ...(alle[ansicht] || {}) };
  for (const s of spalten) if (f[s.schluessel] === undefined) f[s.schluessel] = s.standard ? 'ad' : '';
  f.Nr = `a${f.Nr.includes('d') ? 'd' : ''}${f.Nr.includes('L') ? 'L' : ''}`;
  return f;
}

/** Dialog „Spalten“: Spalte / anzeigen / drucken / Name (Kurzname, Langname). */
export async function felderDialog(ansicht, spalten) {
  const f = await feldEinstellungen(ansicht, spalten);
  const zeilen = spalten.map((s) => {
    const a = h('input', { type: 'checkbox', checked: f[s.schluessel].includes('a'), disabled: s.schluessel === 'Nr' });
    const d = h('input', { type: 'checkbox', checked: f[s.schluessel].includes('d') });
    const l = s.lang ? h('select', { class: 'eingabe' }, h('option', { value: '' }, 'Kurzname'), h('option', { value: 'L', selected: f[s.schluessel].includes('L') }, 'Langname')) : h('span');
    return { s, a, d, l, tr: h('tr', null, h('td', { class: s.standard ? 'fett' : '', title: s.feld || '' }, spaltenFeld(s) || s.feld), h('td', { class: 'mitte' }, a), h('td', { class: 'mitte' }, d), h('td', null, l)) };
  });
  const inhalt = h('div', { class: 'vt-felder' }, h('p', { class: 'leise' }, 'Fett gesetzte Spalten gehören zur Grundeinstellung.'),
    h('div', { class: 'vt-tabwrap' }, h('table', { class: 'vt-dtabelle' }, h('thead', null, h('tr', null, h('th', null, 'Spalte'), h('th', { class: 'mitte' }, 'Anzeigen'), h('th', { class: 'mitte' }, 'Drucken'), h('th', null, 'Name'))),
      h('tbody', null, zeilen.map((z) => z.tr)))));
  const ok = await dialog({ titel: `Spalten – ${ansichtText(ansicht)}`, inhalt, breite: '480px', knoepfe: [{ text: 'Übernehmen', wert: true, primaer: true }, { text: 'Grundeinstellung', wert: 'std' }, { text: 'Abbrechen', wert: null }] });
  if (!ok) return false;
  const alle = (await einstellungLesen(FELDER)) || {};
  if (ok === 'std') delete alle[ansicht];
  else alle[ansicht] = Object.fromEntries(zeilen.map((z) => [z.s.schluessel, `${z.a.checked || z.s.schluessel === 'Nr' ? 'a' : ''}${z.d.checked ? 'd' : ''}${z.l.value === 'L' ? 'L' : ''}`]));
  await einstellungSchreiben(FELDER, alle);
  return true;
}

/** Angezeigte Vertretungsarten je Listenansicht und regulären Unterricht anzeigen. */
async function artenDialog(ansicht) {
  const ein = await api.get(vpfad('/einstellungen'));
  const alle = (await einstellungLesen(ARTEN_AUS)) || {};
  const aus = new Set(alle[ansicht] || []);
  const unterricht = !!alle.__unterricht;
  const arten = ein.arten.slice().sort((a, b) => (a.text || a.standard).localeCompare(b.text || b.standard, 'de'));
  const boxen = arten.map((a) => ({ a, el: h('input', { type: 'checkbox', checked: a.art === 'Unterricht' ? unterricht : !aus.has(a.art) }) }));
  const inhalt = h('div', { class: 'vt-arten' }, h('p', null, `Diese Vertretungsarten zeigt die Ansicht „${ansichtText(ansicht)}“:`),
    h('div', { class: 'vt-artenliste' }, boxen.map((b) => h('label', { class: 'kontrolle' }, b.el, b.a.text || b.a.standard))),
    h('p', { class: 'leise' }, '„Unterricht“ blendet auch den regulär stattfindenden Unterricht ein. Bezeichnung und Farbe der Vertretungsarten stehen in den Einstellungen unter „Arten und Farben“.'));
  if (!(await dialog({ titel: 'Angezeigte Vertretungsarten', inhalt, breite: '460px', knoepfe: [{ text: 'Übernehmen', wert: true, primaer: true }, { text: 'Abbrechen', wert: null }] }))) return false;
  alle[ansicht] = boxen.filter((b) => b.a.art !== 'Unterricht' && !b.el.checked).map((b) => b.a.art);
  alle.__unterricht = boxen.find((b) => b.a.art === 'Unterricht')?.el.checked || false;
  await einstellungSchreiben(ARTEN_AUS, alle);
  return true;
}

/** Dialog „Raum zuordnen“ einer Vertretung (mögliche Räume wie im Vorschlag, Reiter Räume); Raum entfernen. */
export async function raumDialog(id, ids, quelle) {
  let besetzt = false;
  let daten = await api.get(vpfad(`/vorschlag/${id}?besetzt=false`));
  const zusatzS = schalter('Zusätzlich zum bisherigen Raum zuordnen');
  const besetztS = schalter('Auch belegte Räume anzeigen');
  const zusatz = zusatzS.eingabe;
  const auchBesetzt = besetztS.eingabe;
  const sel = h('select', { class: 'eingabe vt-raumliste', size: 12 });
  const fuellen = () => {
    leeren(sel).append(...daten.raeume.map((r) => h('option', { value: r.raum, class: r.besetzt ? 'besetzt' : r.ar || r.sr ? 'ausweich' : '' },
      `${r.name}${r.kap ? ` · ${r.kap} Plätze` : ''}${r.ar ? ' · Ausweichraum' : ''}${r.sr ? ' · Ausweich-Fachraum' : ''}${r.besetzt ? ` · ${r.gesperrt ? 'gesperrt' : `belegt: ${r.belegung}`}` : ''}`)));
    if (sel.options.length) sel.selectedIndex = 0;
  };
  auchBesetzt.addEventListener('change', async () => { besetzt = auchBesetzt.checked; daten = await api.get(vpfad(`/vorschlag/${id}?besetzt=${besetzt}`)); fuellen(); });
  fuellen();
  const inhalt = h('div', { class: 'vt-raumdialog' }, h('p', { class: 'vt-dkopf' }, daten.kopf), sel, h('div', { class: 'vt-schalterreihe' }, besetztS, zusatzS));
  sel.addEventListener('dblclick', () => inhalt.closest('.dialog')?.querySelector('.knopf.primaer')?.click());
  const w = await dialog({ titel: 'Raum zuordnen', inhalt, breite: '480px', knoepfe: [{ text: 'Zuordnen', wert: 'zu', primaer: true }, { text: 'Raum entfernen', wert: 'weg' }, { text: 'Abbrechen', wert: null }] });
  if (!w) return;
  const raum = w === 'weg' ? null : Number(sel.value);
  if (w === 'zu' && !raum) return;
  await mitRueckfragen(vpfad(`/vorschlag/${id}/raum`), { raum, zusatz: zusatz.checked, ids }, { quelle });
}

function vertretungenFenster(f, p) {
  const schreiben = darfSchreiben();
  let ansicht = ANSICHTEN.includes(p.ansicht) ? p.ansicht : ANSICHTEN[0];
  let element = null;
  let daten = null;
  let felder = {};
  let behalten = new Set();
  let filter = { offen: !!p.offen, kollisionen: false, sammeln: p.sammeln !== false };
  let vorInhalt = null;
  let vorschlagCache = new Map();
  let optionenCache = new Map();
  const lehrerSicht = () => ansicht.startsWith('Lehrer') || ansicht === 'Druck - Lehrer';
  const FA = () => behalten.size > 0 || filter.offen || filter.kollisionen || element != null || ansicht.startsWith('Druck');

  // ---- Filterleiste: Ansicht, Element, Zeitraum, Schalter ----
  const ansichtSel = h('select', { class: 'eingabe', title: 'Listenansicht' }, ANSICHTEN.map((a) => h('option', { value: a, selected: a === ansicht }, ansichtText(a))));
  const elSel = h('select', { class: 'eingabe', title: 'Nur Vertretungen dieser Klasse bzw. Lehrkraft' });
  const elGruppe = filterGruppe('Klasse', elSel);
  const offenS = schalter('Nur offene', { checked: filter.offen, titel: 'Nur Vertretungen ohne Lehrkraft oder ohne Raum zeigen' });
  const kollS = schalter('Nur Kollisionen', { titel: 'Nur Vertretungen mit Doppelbelegung von Lehrkraft oder Raum zeigen' });
  const sammelnS = schalter('Veranstaltungen zusammenfassen', { checked: filter.sammeln, titel: 'Entfälle und Freistellungen einer Veranstaltung je Tag in einer Zeile zeigen (alle Klassen, Stunden 1–6)' });
  const offen = offenS.eingabe;
  const koll = kollS.eingabe;
  const sammeln = sammelnS.eingabe;
  const zr = zeitraumAuswahl(f, { art: p.zeitraum || 'tag', tageProWoche: zustand.grunddaten?.zeitraster?.tage?.length || 5, beiAenderung: (von, bis) => {
    f.parameterSetzen({ zeitraum: zr.art });
    if (bis !== von && schreiben) tageswechsel(von, bis).then(() => laden());
    else laden();
  } });
  const kopf = filterleiste(filterGruppe('Ansicht', ansichtSel), elGruppe, filterGruppe('Zeitraum', zr.el),
    h('span', { class: 'vt-gruppe vt-schalterreihe' }, offenS, kollS, sammelnS));
  f.inhalt.append(kopf);
  offen.addEventListener('change', () => { filter.offen = offen.checked; behalten.clear(); laden(); });
  koll.addEventListener('change', () => { filter.kollisionen = koll.checked; behalten.clear(); laden(); });
  sammeln.addEventListener('change', () => { filter.sammeln = sammeln.checked; f.parameterSetzen({ sammeln: filter.sammeln }); laden(); });
  elSel.addEventListener('change', () => { element = elSel.value ? Number(elSel.value) : null; behalten.clear(); laden(); });

  async function elementeFuellen() {
    const liste = await elemente(lehrerSicht() ? 'lehrer' : 'klasse');
    const alt = element;
    leeren(elSel).append(h('option', { value: '' }, '(alle)'), ...liste.map((e) => h('option', { value: e.id }, e.k)));
    element = liste.some((e) => e.id === alt) ? alt : null;
    elSel.value = element ?? '';
    elGruppe.firstChild.textContent = lehrerSicht() ? 'Lehrkraft' : 'Klasse';
  }

  // ---- Tabelle ----
  const tabelle = new Tabelle(f.inhalt, {
    spalten: [],
    sortierbar: true,
    leerText: 'Im gewählten Zeitraum gibt es keine Vertretungen.',
    zeilenHoehe: 30,
    zeilenKlasse: (z) => [z.m.unterricht ? 'vt-unterricht' : '', z.m.koll ? 'vt-kollision' : '', z.m.sammel ? 'vt-sammel' : '', behalten.has(z.m.v) ? 'vt-behalten' : ''].filter(Boolean).join(' '),
    aendern: schreiben ? (z, s, wert) => eingeben(z, s.schluessel, wert) : undefined,
    optionen: (s) => optionen(s.schluessel),
    beiAuswahl: (zeilen, aktiv) => gewaehlt(zeilen, aktiv),
    beiDoppelklick: (z) => {
      if (z.m.sammel) { sammeln.checked = false; sammeln.dispatchEvent(new Event('change')); return; }
      vorschlagOeffnen();
    },
    beiEntf: () => zuruecksetzen(),
    kontextmenue: (zeilen) => kontextmenue(zeilen),
  });

  function spaltenAufbauen() {
    const neu = daten.spalten.map((s) => ({
      schluessel: s.schluessel, titel: spaltenTitel(s), hinweis: spaltenFeld(s), breite: Math.max(s.breite, BREITE[s.schluessel] || 0),
      art: s.schluessel in ELEMENT ? 'Element' : s.nurLesen ? 'NurLesen' : 'Text', refTyp: ELEMENT[s.schluessel],
      editierbar: EDITIERBAR.has(s.schluessel) && schreiben,
      editierbarFuer: (z) => editierbar(z, s.schluessel),
      ausrichtung: ['Nr', 'Std', 'Entf', 'Fix', 'ND', 'Mitb', 'Neu', 'Ben', 'Zaehler'].includes(s.schluessel) ? 'rechts' : undefined,
      sichtbar: felder[s.schluessel]?.includes('a') ?? s.standard,
      farbe: (z) => farbe(z, s.schluessel),
      klasse: (z) => zellKlasse(z, s.schluessel),
    }));
    if (tabelle.spalten.length !== neu.length) tabelle.spaltenSetzen(neu);
    else {
      for (const s of tabelle.spalten) { const n = neu.find((x) => x.schluessel === s.schluessel); if (n && !vorInhalt) s.sichtbar = n.sichtbar; }
      tabelle._kopfZeichnen();
    }
  }

  const istVerlegungsArt = (a) => a === 'Tausch' || a === 'Verlegung' || a === 'Verlegt';
  function farbe(z, s) {
    const m = z.m;
    if (s === 'Art' && m.farbe) return `color-mix(in srgb, ${m.farbe} 24%, var(--zelle))`;
    if (m.koll && ((s === 'Vertreter' && m.kollL) || (s === 'NRaum' && m.kollR))) return 'var(--up-entfall-flaeche)';
    if (s === 'Vertreter' && m.pause) return 'var(--up-frei-flaeche)';
    if (istVerlegungsArt(m.art) && ['Klassen', 'Vertreter', 'NRaum', 'NFach', 'Text'].includes(s)) return 'var(--up-aenderung-flaeche)';
    if (s === 'UText' || s === 'UZText') return 'var(--up-schiefer-50)';
    if (m.unterricht && s !== 'Art') return 'var(--up-schiefer-25)';
    return null;
  }
  function zellKlasse(z, s) {
    const m = z.m;
    if ((s === 'Vertreter' && m.offen) || (s === 'NRaum' && m.raumOffen)) return 'vt-rot';
    if (s === 'Nr' && m.koll) return 'vt-rot';
    if (m.koll && ((s === 'Vertreter' && m.kollL) || (s === 'NRaum' && m.kollR))) return 'vt-kollrand';
    return null;
  }
  function editierbar(z, s) {
    const m = z.m;
    if (!schreiben || !m.v || m.unterricht || !EDITIERBAR.has(s)) return false;
    if (m.fix) { status(statusEl, `Vertretung ${m.v} ist fixiert – zum Ändern zuerst die Fixierung lösen.`, 'warnung'); return false; }
    if (m.veranstaltung && s !== 'Vertreter' && s !== 'Text') return false;
    if (m.sammel && !['Text', 'Text2', 'Kz'].includes(s)) return false;
    if (m.freisetzung && ['Vertreter', 'NFach', 'NRaum'].includes(s)) return false;
    return true;
  }

  async function optionen(spalte) {
    const z = tabelle.aktiveZeile();
    if (!z?.m.v) return elemente(ELEMENT[spalte] || 'lehrer');
    const k = `${z.m.v}/${spalte}`;
    if (!optionenCache.has(k)) optionenCache.set(k, api.get(vpfad(`/optionen?id=${z.m.v}&spalte=${spalte}`)));
    return optionenCache.get(k);
  }

  /** Ziel einer Eingabe: bearbeitete Zeile (mit allen Stunden einer zusammengefassten Veranstaltung) bzw. alle markierten Zeilen. */
  function zielIds(z) {
    const markiert = tabelle.ausgewaehlte();
    const liste = markiert.some((x) => x.id === z.id) ? markiert : [z];
    return [...new Set(liste.flatMap((x) => (x.m.gruppe?.length ? x.m.gruppe : [x.m.v])).filter((x) => x > 0))];
  }
  function markierteIds() {
    const liste = tabelle.ausgewaehlte();
    return [...new Set(liste.flatMap((x) => (x.m.gruppe?.length ? x.m.gruppe : [x.m.v])).filter((x) => x > 0))];
  }

  async function aktion(pfad, daten2, ids) {
    if (!ids.length) return null;
    if (FA()) ids.forEach((i) => behalten.add(i));
    const r = await mitRueckfragen(vpfad(pfad), { ...daten2, ids }, { quelle: f.id });
    await laden();
    return r;
  }

  async function eingeben(z, spalte, wert) {
    await aktion('/aendern', { spalte, wert }, zielIds(z));
    return null;
  }

  const entfall = () => aktion('/entfall', {}, markierteIds());
  const ohneLehrer = () => aktion('/ohnelehrer', {}, markierteIds());
  const zuruecksetzen = () => aktion('/zuruecksetzen', {}, markierteIds());
  const vormerken = () => aktion('/vormerken', {}, markierteIds());
  async function kennzeichen(art) {
    const liste = tabelle.ausgewaehlte().filter((z) => z.m.v);
    if (!liste.length) return;
    const ziel = !liste.every((z) => (art === 'fix' ? z.m.fix : z.m.nd));
    await api.post(vpfad('/kennzeichen'), { ids: markierteIds(), art, wert: ziel }, { quelle: f.id });
    await laden();
  }
  async function loeschen() {
    const ids = markierteIds();
    if (!ids.length) return;
    const abgeleitet = tabelle.ausgewaehlte().filter((z) => z.m.abgeleitet).length;
    if (abgeleitet === tabelle.ausgewaehlte().length) {
      await meldung('Vertretungen, die aus einer Abwesenheit oder Veranstaltung entstehen, können nicht gelöscht werden.\n\nMit „Entfall“ entfällt die Stunde, mit „Zurücksetzen“ wird sie wieder offen. Soll sie ganz verschwinden, die Abwesenheit ändern.', 'Vertretung löschen');
      return;
    }
    if (!(await frage(`${tabelle.ausgewaehlte().length - abgeleitet} Vertretung(en) löschen?${abgeleitet ? `\n\n${abgeleitet} Zeile(n) aus Abwesenheiten oder Veranstaltungen bleiben erhalten.` : ''}`, { gefahr: true, ja: 'Löschen', nein: 'Abbrechen' }))) return;
    await api.post(vpfad('/loeschen'), { ids }, { quelle: f.id });
    await laden();
  }
  async function teilen() {
    const z = tabelle.aktiveZeile();
    if (!z?.m.v) return;
    const w = await formular('Vertretung teilen', [{ name: 'klassen', titel: 'Klassen der neuen Zeile', hinweis: 'Kurznamen; die übrigen bleiben in der bisherigen Zeile (leer = gleiche Klassen).' }], { okText: 'Teilen' });
    if (!w) return;
    await api.post(vpfad('/teilen'), { id: z.m.v, klassen: w.klassen }, { quelle: f.id });
    await laden();
  }
  async function lehrkraftHinzufuegen() {
    const z = tabelle.ausgewaehlte().find((x) => x.m.veranstaltung);
    if (!z) { hinweis('Bitte die Zeile einer Veranstaltung markieren.', 'warnung'); return; }
    const w = await formular(`Lehrkraft zur Veranstaltung hinzufügen (${z.Datum})`, [{ name: 'lehrer', titel: 'Zusätzliche Lehrkraft', pflicht: true, hinweis: 'Kurzname, mehrere mit Komma.' }], { okText: 'Hinzufügen' });
    if (!w) return;
    const bisher = String(z.Vertreter || '').split(',').filter((x) => x && x !== '?');
    await aktion('/veranstaltungslehrer', { id: z.m.v, wert: [...bisher, w.lehrer].join(',') }, [z.m.v]).catch(fehlerMelden);
  }
  async function raumZuordnen() {
    const z = tabelle.aktiveZeile();
    if (!z?.m.v || z.m.pause) return;
    if (FA()) behalten.add(z.m.v);
    await raumDialog(z.m.v, markierteIds(), f.id);
    await laden();
  }
  async function neuBerechnen() {
    const r = await api.post(vpfad('/neuberechnen'), { von: zr.von, bis: zr.bis }, { quelle: f.id });
    await laden();
    if (r.uebertragen || r.hinweise?.length) meldung(`${r.uebertragen} Vertretung(en) umgeplanter Stunden übertragen.${r.hinweise?.length ? `\n\n${r.hinweise.join('\n')}` : ''}`, 'Änderungen des Stundenplans übernommen');
    else hinweis('Vertretungen neu berechnet.', 'ok', 2000);
  }

  function felderMitInhalt(an) {
    if (an) {
      vorInhalt = new Set(tabelle.spalten.filter((s) => s.sichtbar).map((s) => s.schluessel));
      for (const s of tabelle.spalten) if (s.schluessel === 'Nr' || tabelle.zeilen.some((z) => String(z[s.schluessel] ?? '') !== '')) s.sichtbar = true;
    } else if (vorInhalt) {
      for (const s of tabelle.spalten) s.sichtbar = vorInhalt.has(s.schluessel);
      vorInhalt = null;
    }
    tabelle._kopfZeichnen();
    tabelle._neuZeichnen();
  }

  /** Zur nächsten (bzw. vorherigen) offenen Vertretung springen. */
  function naechsteOffene(richtung = 1) {
    const z = tabelle.ansicht;
    if (!z.length) return false;
    const start = tabelle.akt.r;
    for (let i = 1; i <= z.length; i++) {
      const x = z[(((start + richtung * i) % z.length) + z.length) % z.length];
      if (x.m.offen || x.m.raumOffen) { tabelle.waehle(x.id); return true; }
    }
    return false;
  }

  function vorschlagOeffnen() {
    gewaehlt(tabelle.ausgewaehlte(), tabelle.aktiveZeile());
    fensterverwaltung.oeffnen('vertretung.vorschlag', {});
  }

  // ---- Auswahl und Fensterverknüpfung ----
  let letzteAktiv = null;
  function gewaehlt(zeilen, aktiv) {
    const z = aktiv || zeilen[0];
    nr.value = z?.m.v || '';
    status(statusEl, z?.m.koll ? `Kollision: ${z.m.koll}` : '', z?.m.koll ? 'fehler' : '');
    // bearbeitete Zeilen verschwinden erst beim Wechsel in eine andere Zeile, wenn sie nicht mehr zum Filter passen
    if (z && letzteAktiv && z.id !== letzteAktiv && behalten.size && !behalten.has(z.m.v)) { behalten.clear(); entprelltLaden(); }
    letzteAktiv = z?.id ?? null;
    if (z?.m.v) auswahlMelden({ id: z.m.v, ids: markierteIds(), zeile: z.m, quelle: f.id, text: `${z.Datum} ${z.Std}. Std. ${z.Klassen || ''}` });
    vorschlagVorladen(z);
  }
  const vorschlagVorladen = entprellen((z) => {
    if (!z?.m.v || z.m.pause || vorschlagCache.has(z.m.v)) return;
    vorschlagCache.set(z.m.v, api.get(vpfad(`/vorschlag/${z.m.v}`)).catch(() => null));
  }, 300);
  f.an('vertretung.auswahl', (a) => { if (a?.quelle !== f.id && a?.id && tabelle.zeilen.some((z) => z.m.v === a.id)) tabelle.waehle(`V${a.id}`); });
  f.an('vertretung.naechsteOffene', () => { if (!naechsteOffene()) hinweis('Keine weitere offene Vertretung.', 'info', 2000); });

  // ---- Kontextmenü ----
  function kontextmenue(zeilen) {
    const liste = zeilen.filter((z) => z.m.v);
    const e = [];
    const anzahl = markierteIds().length;
    if (liste.length) {
      const z = liste[0];
      e.push({ text: 'Vertretungsvorschlag', aktion: vorschlagOeffnen, taste: 'Enter' });
      if (!z.m.pause) {
        const unter = [{ text: 'wird berechnet …', deaktiviert: true }];
        e.push({ text: 'Vertretung zuweisen', menue: unter });
        if (!vorschlagCache.has(z.m.v)) vorschlagCache.set(z.m.v, api.get(vpfad(`/vorschlag/${z.m.v}`)).catch(() => null));
        const ids = markierteIds();
        vorschlagCache.get(z.m.v).then((v) => {
          const k8 = (v?.kandidaten || []).slice(0, 8).map((k) => ({
            text: `${k.name} · ${k.lage || k.kriterien || '–'} · Zähler ${k.zaehler || '0'}`, deaktiviert: !schreiben,
            aktion: async () => { if (FA()) ids.forEach((i) => behalten.add(i)); await mitRueckfragen(vpfad(`/vorschlag/${z.m.v}/uebernehmen`), { lehrer: k.lehrer, ids }, { quelle: f.id }); await laden(); },
          }));
          unter.splice(0, unter.length, ...(k8.length ? k8 : [{ text: 'Kein Vorschlag', deaktiviert: true }]));
        });
      }
      e.push(null);
      const alleEntfall = liste.every((x) => x.m.entfall && !x.m.freisetzung);
      e.push(alleEntfall ? { text: 'Entfall aufheben', deaktiviert: !schreiben, aktion: entfall }
        : { text: `Entfall${anzahl > 1 ? ` (${anzahl} Stunden)` : ''}`, taste: '-', deaktiviert: !schreiben, aktion: entfall });
      e.push({ text: `Ohne Lehrkraft${anzahl > 1 ? ` (${anzahl} Stunden)` : ''}`, taste: '+', deaktiviert: !schreiben, aktion: ohneLehrer });
      if (liste.some((x) => x.m.veranstaltung)) e.push({ text: 'Lehrkraft zur Veranstaltung hinzufügen …', deaktiviert: !schreiben, aktion: lehrkraftHinzufuegen });
      e.push({ text: 'Vertretung teilen …', deaktiviert: !schreiben, aktion: teilen });
      e.push({ text: 'Raum zuordnen …', deaktiviert: !schreiben || z.m.pause, aktion: raumZuordnen });
      e.push({ text: 'Als Vormerkung beiseitelegen', deaktiviert: !schreiben, aktion: vormerken });
      e.push({ text: 'Nicht drucken', haken: liste.every((x) => x.m.nd), deaktiviert: !schreiben, aktion: () => kennzeichen('nd') });
      e.push({ text: 'Fixiert', haken: liste.every((x) => x.m.fix), deaktiviert: !schreiben, aktion: () => kennzeichen('fix') });
      e.push(null);
      if (z.m.vertreter) e.push({ text: `Tagesplan Lehrkraft ${z.Vertreter}`, aktion: () => fensterverwaltung.oeffnen('vertretung.plan', { typ: 'lehrer', element: z.m.vertreter }) });
      if (z.m.lehrer && z.m.lehrer !== z.m.vertreter) e.push({ text: `Tagesplan Lehrkraft ${String(z.Lehrer).replace('*', '')}`, aktion: () => fensterverwaltung.oeffnen('vertretung.plan', { typ: 'lehrer', element: z.m.lehrer }) });
      if (z.m.klasse) e.push({ text: `Tagesplan Klasse ${String(z.Klassen).replace(/[()]/g, '').split(',')[0]}`, aktion: () => fensterverwaltung.oeffnen('vertretung.plan', { typ: 'klasse', element: z.m.klasse }) });
      e.push(null);
      e.push({ text: 'Zurücksetzen (wieder offen)', taste: 'Entf', deaktiviert: !schreiben, aktion: zuruecksetzen });
      e.push({ text: 'Löschen', deaktiviert: !schreiben, aktion: loeschen });
      e.push(null);
    }
    e.push({ text: 'Sondereinsatz …', deaktiviert: !schreiben, aktion: () => import('./weitere.js').then((w) => w.sondereinsatzDialog({ stunde: liste[0]?.m.stunde, klassen: liste[0]?.Klassen?.replace(/[()]/g, '') })) });
    e.push({ text: 'Tagestexte …', aktion: () => fensterverwaltung.oeffnen('vertretung.kalender', { reiter: 0 }) });
    return e;
  }

  // ---- Werkzeugleiste: häufige Aktionen als Textknöpfe, seltene unter „Weitere Aktionen“ ----
  const spaltenWaehlen = async () => { if (await felderDialog(ansicht, daten.spalten)) { felder = await feldEinstellungen(ansicht, daten.spalten); spaltenAufbauen(); tabelle._neuZeichnen(); } };
  f.werkzeug({ text: 'Vorschlag', titel: 'Vertretungsvorschlag für die markierte Stunde (Enter, Doppelklick)', aktion: vorschlagOeffnen });
  f.werkzeug({ text: 'Nächste offene', titel: 'Zur nächsten offenen Vertretung springen (F3, Umschalt+F3 rückwärts)', aktion: () => { if (!naechsteOffene()) hinweis('Keine offene Vertretung.', 'info', 2000); } });
  if (schreiben) {
    f.trenner();
    f.werkzeug({ text: 'Entfall', titel: 'Unterricht entfällt (Taste -); erneut ausgeführt wird daraus wieder eine offene Vertretung', aktion: entfall });
    f.werkzeug({ text: 'Ohne Lehrkraft', titel: 'Stunde findet ohne Lehrkraft statt (Taste +)', aktion: ohneLehrer });
    f.werkzeug({ text: 'Zurücksetzen', titel: 'Wieder zur offenen Vertretung machen (Entf)', aktion: zuruecksetzen });
  }
  menueKnopf(f, 'Weitere Aktionen', () => {
    const liste = tabelle.ausgewaehlte().filter((z) => z.m.v);
    const keine = !liste.length;
    return [
      { text: 'Raum zuordnen …', deaktiviert: !schreiben || keine, aktion: raumZuordnen },
      { text: 'Vertretung teilen …', deaktiviert: !schreiben || keine, aktion: teilen },
      { text: 'Lehrkraft zur Veranstaltung hinzufügen …', deaktiviert: !schreiben || !liste.some((x) => x.m.veranstaltung), aktion: lehrkraftHinzufuegen },
      { text: 'Als Vormerkung beiseitelegen', deaktiviert: !schreiben || keine, aktion: vormerken },
      { text: 'Sondereinsatz …', deaktiviert: !schreiben, aktion: () => import('./weitere.js').then((w) => w.sondereinsatzDialog({ stunde: tabelle.aktiveZeile()?.m.stunde })) },
      null,
      { text: 'Fixiert', haken: !keine && liste.every((x) => x.m.fix), deaktiviert: !schreiben || keine, aktion: () => kennzeichen('fix') },
      { text: 'Nicht drucken', haken: !keine && liste.every((x) => x.m.nd), deaktiviert: !schreiben || keine, aktion: () => kennzeichen('nd') },
      null,
      { text: 'Automatische Vertretung …', deaktiviert: !schreiben, aktion: () => import('./weitere.js').then((w) => w.automatikDialog(zr.von, zr.bis)) },
      { text: 'Neu berechnen', deaktiviert: !schreiben, aktion: neuBerechnen },
      { text: 'Tagestexte …', aktion: () => fensterverwaltung.oeffnen('vertretung.kalender', { reiter: 0 }) },
      null,
      { text: 'Löschen …', deaktiviert: !schreiben || keine, aktion: loeschen },
    ];
  }, 'Weitere Aktionen für die markierten Vertretungen');
  const darstellung = menueKnopf(f, 'Darstellung', () => [
    { text: 'Spalten …', aktion: spaltenWaehlen },
    { text: 'Nur Spalten mit Inhalt', haken: !!vorInhalt, aktion: () => felderMitInhalt(!vorInhalt) },
    { text: 'Angezeigte Vertretungsarten …', aktion: async () => { if (await artenDialog(ansicht)) laden(); } },
    null,
    { text: 'Einstellungen der Vertretungsplanung …', aktion: () => import('./weitere.js').then((w) => w.einstellungenDialog(0)) },
  ], 'Spalten, angezeigte Vertretungsarten und Einstellungen');
  darstellung.classList.add('rechts');

  // ---- Fuß: Nummer, Status, Anzahl ----
  const nr = h('input', { class: 'eingabe vt-nr', inputmode: 'numeric', title: 'Nummer eingeben und Enter: zur Vertretung springen' });
  const statusEl = h('span', { class: 'vt-status' });
  const zaehler = h('span', { class: 'rechts' });
  f.fuss.append(h('label', { class: 'vt-fussfeld' }, 'Nr.', nr), statusEl, zaehler);
  nr.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const n = Number(nr.value);
    if (!n) return;
    if (tabelle.waehle(`V${n}`)) return;
    offen.checked = koll.checked = false;
    filter.offen = filter.kollisionen = false;
    element = null;
    elSel.value = '';
    await laden();
    if (!tabelle.waehle(`V${n}`)) hinweis(`Die Vertretung Nr. ${n} ist im gewählten Zeitraum nicht vorhanden.`, 'warnung');
  });
  ansichtSel.addEventListener('change', async () => ansichtSetzen(ansichtSel.value));

  async function ansichtSetzen(a) {
    ansicht = a;
    ansichtSel.value = a;
    f.parameterSetzen({ ansicht });
    f.titel(`Vertretungen – ${ansichtText(ansicht)}`);
    if (vorInhalt) vorInhalt = null;
    behalten.clear();
    await elementeFuellen();
    felder = daten ? await feldEinstellungen(ansicht, daten.spalten) : {};
    await laden();
  }

  // Tasten: „+“ / „-“ (ohne Bearbeitung im Feld Vertreter bzw. in nicht editierbaren Feldern), Enter = Vorschlag, F3
  tabelle.el.addEventListener('keydown', (e) => {
    if (tabelle.editor) return;
    const s = tabelle.aktiveSpalte();
    const z = tabelle.aktiveZeile();
    if ((e.key === '+' || e.key === '-') && !e.ctrlKey && schreiben && (s?.schluessel === 'Vertreter' || !editierbar(z || { m: {} }, s?.schluessel))) {
      e.preventDefault(); e.stopImmediatePropagation();
      (e.key === '+' ? ohneLehrer : entfall)().catch(fehlerMelden);
    } else if (e.key === 'F3') {
      e.preventDefault(); e.stopImmediatePropagation();
      naechsteOffene(e.shiftKey ? -1 : 1);
    } else if (e.key === 'Enter' && z && !editierbar(z, s?.schluessel)) {
      e.preventDefault(); e.stopImmediatePropagation();
      vorschlagOeffnen();
    } else if (e.key === 'Delete' && z && (s?.schluessel === 'Vertreter' || !editierbar(z, s?.schluessel)) && schreiben) {
      e.preventDefault(); e.stopImmediatePropagation();
      zuruecksetzen().catch(fehlerMelden);
    }
  }, true);

  // ---- Laden ----
  let ladeNr = 0;
  async function laden() {
    if (!zr.von) return;
    const n = ++ladeNr;
    const artenAus = (await einstellungLesen(ARTEN_AUS)) || {};
    const lang = Object.entries(felder).filter(([, v]) => v.includes('L')).map(([k]) => k).join(',');
    const q = new URLSearchParams({
      von: zr.von, bis: zr.bis, ansicht: String(ANSICHTEN.indexOf(ansicht)), offen: String(filter.offen), kollisionen: String(filter.kollisionen),
      sammeln: String(filter.sammeln), behalten: [...behalten].join(','), lang, artenAus: (artenAus[ansicht] || []).join(','), unterricht: String(!!artenAus.__unterricht),
    });
    if (element) q.set('element', element);
    const d = await api.get(vpfad(`/liste?${q}`));
    if (n !== ladeNr) return;
    const ersterAufbau = !daten;
    daten = d;
    vorschlagCache = new Map();
    optionenCache = new Map();
    if (ersterAufbau) felder = await feldEinstellungen(ansicht, d.spalten);
    spaltenAufbauen();
    tabelle.daten(d.zeilen);
    zaehler.textContent = `${d.zeilen.length} ${d.zeilen.length === 1 ? 'Zeile' : 'Zeilen'} · ${d.offen} offen`;
    if (ersterAufbau && d.zeilen.length && !tabelle.aktiveZeile()) tabelle.waehle(d.zeilen[0].id);
  }
  const entprelltLaden = entprellen(() => laden().catch(() => {}), 150);

  f.an('daten', (e) => { if (betrifft(e, 'Vertretung', 'Stundenplan', 'Unterricht', 'Stammdaten', 'Einstellungen')) entprelltLaden(); });
  f.an('vertretung.ansicht', (a) => { if (ANSICHTEN.includes(a)) ansichtSetzen(a); });
  f.titel(`Vertretungen – ${ansichtText(ansicht)}`);
  elementeFuellen().then(() => laden()).catch(fehlerMelden);
  // Selbsttest/Smoke: Zugriff auf die Tabelle
  f.el.vtTabelle = tabelle;
  void aktuelleAuswahl; void symbol; void planungsdatum; void felderMitInhalt;
}

export const fenster = {
  'vertretung.liste': {
    titel: 'Vertretungen', symbol: 'vertretung', breite: 1100, hoehe: 480,
    einzig: () => 'liste',
    erneutGeoeffnet: (f, p) => { if (p?.ansicht) import('../../kern/ereignisse.js').then((e) => e.melden('vertretung.ansicht', p.ansicht)); },
    erstellen: vertretungenFenster,
  },
};
