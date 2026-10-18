// Ansicht „Abwesenheiten“: Reiter Lehrkräfte / Klassen / Räume mit Anzahl, Zeitraum, direkte Eingabe in der Liste
// (Nr., Element, Von, ab Std., Bis, bis Std., Grund, Text, Begleitung, offen). Änderungen einer Zeile werden erst beim Verlassen
// der Zeile übernommen (Strg+Enter sofort, Esc verwirft); neue Abwesenheiten: Planungsdatum, 1. bis letzte Stunde.
import { h, entprellen } from '../../kern/dom.js';
import { api, einstellungLesen, einstellungSchreiben } from '../../kern/api.js';
import { elemente, darfSchreiben } from '../../kern/zustand.js';
import { betrifft } from '../../kern/ereignisse.js';
import { Tabelle } from '../../kern/tabelle.js';
import { frage, meldung, hinweis, fehlerMelden, formular } from '../../kern/dialog.js';
import { fensterverwaltung } from '../../kern/fenster.js';
import { vpfad, tagText, datumLesen, planungsdatum, datumText } from './kern.js';
import { zeitraumAuswahl, reiter, filterleiste, filterGruppe, menueKnopf, werkzeugSchalter } from './steuer.js';

const ARTEN = [{ art: 'lehrer', titel: 'Lehrkräfte', einzel: 'Lehrkraft', typ: 'lehrer' }, { art: 'klasse', titel: 'Klassen', einzel: 'Klasse', typ: 'klasse' }, { art: 'raum', titel: 'Räume', einzel: 'Raum', typ: 'raum' }];

/** Abwesenheiten speichern und die Rückfragen stellen (Vertretung abwesend, Veranstaltung, Verlegungen, Sondereinsätze). */
export async function absenzenSpeichern(art, neu, alt, quelle, text) {
  const r = await api.post(vpfad('/absenzen/speichern'), { art, neu, alt, text }, { quelle });
  if (r.doppelt) hinweis('Diese Abwesenheit ist bereits vorhanden.', 'warnung');
  if (r.betroffen?.length) {
    await meldung(`Folgende Vertretungen waren mit einer Lehrkraft geplant, die nun abwesend ist. Sie sind wieder offen und müssen neu besetzt werden:\n\n${r.betroffen.join('\n')}`, 'Vertretende Lehrkraft abwesend');
  }
  for (const n of r.nachfragen || []) {
    if (!(await frage(n.text, { titel: 'Rückfrage' }))) continue;
    await api.post(vpfad('/absenzen/nachfrage'), n, { quelle });
    if (n.art === 'veranstaltung' && n.hinweis) await meldung(n.hinweis, 'Hinweis');
  }
  return r;
}

function absenzFenster(f, p) {
  const schreiben = darfSchreiben();
  let artIndex = Math.max(0, ARTEN.findIndex((a) => a.art === p.art));
  let daten = null;
  let entwurf = null; // { id, zeile, neu, bisGesetzt }
  let markiert = null; // { typ, id }
  let vaZeigen = false;
  const art = () => ARTEN[artIndex];

  const tabs = reiter(ARTEN.map((a) => `${a.titel} (0)`), async (i) => {
    await entwurfUebernehmen();
    artIndex = i;
    f.parameterSetzen({ art: art().art });
    f.titel(`Abwesenheiten – ${art().titel}`);
    spalten();
    laden();
  }, artIndex);
  const zr = zeitraumAuswahl(f, { art: p.zeitraum || 'tag', beiAenderung: async () => { await entwurfUebernehmen(); f.parameterSetzen({ zeitraum: zr.art }); laden(); } });
  f.inhalt.append(tabs.el, filterleiste(filterGruppe('Zeitraum', zr.el)));

  const letzte = () => daten?.letzteStunde || 8;
  const tabelle = new Tabelle(f.inhalt, {
    spalten: [],
    sortierbar: false,
    leerText: 'Im gewählten Zeitraum ist niemand abwesend.',
    zeilenHoehe: 30,
    neuText: schreiben ? 'Neue Abwesenheit …' : undefined,
    neu: schreiben ? async (s, wert) => {
      await entwurfUebernehmen();
      const z = { id: `neu${Date.now()}`, nr: 'neu *', element: '', vonIso: zr.von, bisIso: zr.von, sv: '1', sb: String(letzte()), grund: '', text: '', begleit: '', offen: '', entwurf: true };
      entwurf = { id: z.id, neu: true, bisGesetzt: false, zeile: z };
      return anwenden(z, s.schluessel, wert);
    } : undefined,
    aendern: schreiben ? async (z, s, wert) => {
      if (z.va) return null;
      if (entwurf && entwurf.id !== z.id) await entwurfUebernehmen();
      if (!entwurf) entwurf = { id: z.id, neu: false, bisGesetzt: true, zeile: z };
      return anwenden({ ...entwurf.zeile }, s.schluessel, wert);
    } : undefined,
    optionen: async (s) => (s.refTyp === 'abwesenheitsgrund' ? elemente('abwesenheitsgrund') : elemente(s.refTyp)),
    zeilenKlasse: (z) => [z.va ? 'vt-va' : '', z.entwurf ? 'vt-entwurf' : '', markiert && !z.va && z.elementId === markiert.id && markiert.typ === art().typ ? 'vt-markiert' : ''].filter(Boolean).join(' '),
    beiAuswahl: (_, aktiv) => { if (entwurf && aktiv?.id !== entwurf.id) entwurfUebernehmen(); },
    beiDoppelklick: (z) => (z.va ? fensterverwaltung.oeffnen('veranstaltungen.liste', {}) : bearbeiten()),
    kontextmenue: () => [
      { text: 'Neue Abwesenheit …', taste: 'Einfg', deaktiviert: !schreiben, aktion: neuDialog },
      { text: 'Bearbeiten …', deaktiviert: !schreiben, aktion: bearbeiten },
      ...weitereEintraege(),
      null,
      { text: 'Löschen', taste: 'Strg+Entf', deaktiviert: !schreiben, aktion: loeschen },
    ],
    beiEntf: () => loeschen(),
  });

  function spalten() {
    const t = art();
    tabelle.spaltenSetzen([
      { schluessel: 'nr', titel: 'Nr.', breite: 60, art: 'NurLesen', ausrichtung: 'rechts' },
      { schluessel: 'element', titel: t.einzel, breite: 84, art: 'Element', refTyp: t.typ, editierbarFuer: (z) => !z.va },
      { schluessel: 'von', titel: 'Von', breite: 104, editierbarFuer: (z) => !z.va, wert: (z) => tagText(z.vonIso) },
      { schluessel: 'sv', titel: 'ab Std.', breite: 60, art: 'Ganzzahl', ausrichtung: 'rechts', editierbarFuer: (z) => !z.va },
      { schluessel: 'bis', titel: 'Bis', breite: 104, editierbarFuer: (z) => !z.va, wert: (z) => tagText(z.bisIso) },
      { schluessel: 'sb', titel: 'bis Std.', breite: 64, art: 'Ganzzahl', ausrichtung: 'rechts', editierbarFuer: (z) => !z.va },
      { schluessel: 'grund', titel: 'Grund', breite: 76, art: 'Element', refTyp: 'abwesenheitsgrund', editierbarFuer: (z) => !z.va },
      { schluessel: 'text', titel: 'Text', breite: 240, editierbarFuer: (z) => !z.va },
      ...(t.art === 'klasse' ? [{ schluessel: 'begleit', titel: 'Begleitung', breite: 110, hinweis: 'Begleitende Lehrkräfte (gelten ebenfalls als abwesend)', art: 'ElementListe', refTyp: 'lehrer', editierbarFuer: (z) => !z.va }] : []),
      { schluessel: 'offen', titel: 'Offen', breite: 56, hinweis: 'Offene Vertretungen', art: 'NurLesen', ausrichtung: 'rechts', klasse: (z) => (Number(z.offen) > 0 ? 'vt-rot' : null) },
    ]);
  }

  /** Eingabe in den Entwurf der Zeile übernehmen (gespeichert wird beim Zeilenwechsel). */
  function anwenden(z, feld, wert) {
    const w = String(wert ?? '').trim();
    const L = letzte();
    switch (feld) {
      case 'element': z.element = w.toUpperCase() === w ? w : w; break;
      case 'von': z.vonIso = datumLesen(w, z.vonIso); if (!entwurf.bisGesetzt || z.bisIso < z.vonIso) z.bisIso = z.vonIso; break;
      case 'bis': z.bisIso = datumLesen(w, z.bisIso); entwurf.bisGesetzt = true; if (z.bisIso < z.vonIso) z.vonIso = z.bisIso; break;
      case 'sv': z.sv = String(w ? Math.min(Math.max(1, Number(w) || 1), L) : 1); break;
      case 'sb': z.sb = String(w ? Math.min(Math.max(1, Number(w) || L), L) : L); break;
      case 'grund': z.grund = w; break;
      case 'text': z.text = w; break;
      case 'begleit': z.begleit = w; break;
      default: return null;
    }
    z.entwurf = true;
    z.nr = entwurf.neu ? 'neu *' : `${String(z.nr).replace(' *', '')} *`;
    entwurf.zeile = z;
    return z;
  }

  async function entwurfUebernehmen() {
    const e = entwurf;
    if (!e) return;
    entwurf = null;
    const z = e.zeile;
    if (!z.element) {
      if (!e.neu) hinweis('Ohne Element kann die Abwesenheit nicht gespeichert werden – die Änderung wurde verworfen.', 'warnung');
      await laden();
      return;
    }
    try {
      await absenzenSpeichern(art().art, [{ id: e.neu ? 0 : Number(String(z.nr).replace(' *', '')), element: z.element, von: z.vonIso, bis: z.bisIso, sv: Number(z.sv), sb: Number(z.sb), grund: z.grund, text: z.text, begleit: z.begleit }],
        e.neu ? [] : [Number(String(z.nr).replace(' *', ''))], f.id, e.neu ? 'Abwesenheit eingeben' : 'Abwesenheit geändert');
    } catch (x) { fehlerMelden(x); }
    await laden();
  }

  const markierte = () => tabelle.ausgewaehlte().filter((z) => !z.va && !String(z.id).startsWith('neu')).map((z) => Number(String(z.nr).replace(' *', '')));

  async function formularAbsenz(titel, z) {
    const gruende = await elemente('abwesenheitsgrund');
    const w = await formular(titel, [
      { name: 'element', titel: art().einzel, wert: z?.element || '', pflicht: true },
      { name: 'von', titel: 'Von', wert: datumText(z?.vonIso || zr.von), hinweis: 'TT.MM.JJJJ' },
      { name: 'sv', titel: 'Ab Stunde', art: 'zahl', wert: z?.sv || 1 },
      { name: 'bis', titel: 'Bis', wert: datumText(z?.bisIso || zr.von), hinweis: 'TT.MM.JJJJ' },
      { name: 'sb', titel: 'Bis Stunde', art: 'zahl', wert: z?.sb || letzte() },
      { name: 'grund', titel: 'Grund', art: 'auswahl', wert: z?.grund || '', optionen: [{ wert: '', text: '' }, ...gruende.map((g) => ({ wert: g.k, text: g.l ? `${g.k} – ${g.l}` : g.k }))] },
      { name: 'text', titel: 'Text', wert: z?.text || '' },
      ...(art().art === 'klasse' ? [{ name: 'begleit', titel: 'Begleitung', wert: z?.begleit || '', hinweis: 'Kurznamen der Lehrkräfte; gelten ebenfalls als abwesend (z. B. Klassenfahrt).' }] : []),
    ], { okText: 'Speichern', breite: '480px' });
    if (!w) return null;
    const von = datumLesen(w.von, zr.von);
    return { element: w.element.trim(), von, bis: datumLesen(w.bis, von), sv: Number(w.sv) || 1, sb: Number(w.sb) || letzte(), grund: w.grund, text: w.text, begleit: w.begleit || '' };
  }
  async function neuDialog() {
    await entwurfUebernehmen();
    const a = await formularAbsenz('Neue Abwesenheit');
    if (a) { await absenzenSpeichern(art().art, [{ id: 0, ...a }], [], f.id, 'Abwesenheit eingeben'); await laden(); }
  }
  async function bearbeiten() {
    await entwurfUebernehmen();
    const z = tabelle.aktiveZeile();
    if (!z || z.va) return;
    const a = await formularAbsenz(`Abwesenheit ${z.nr} bearbeiten`, z);
    if (a) { await absenzenSpeichern(art().art, [{ id: Number(z.nr), ...a }], [Number(z.nr)], f.id, 'Abwesenheit geändert'); await laden(); }
  }
  async function teilen() {
    await entwurfUebernehmen();
    const z = tabelle.aktiveZeile();
    if (!z || z.va) return;
    if (z.vonIso === z.bisIso) { hinweis('Eine eintägige Abwesenheit kann nicht geteilt werden.', 'warnung'); return; }
    const w = await formular('Abwesenheit teilen', [{ name: 'ab', titel: 'Zweiter Teil beginnt am', wert: datumText(z.vonIso === z.bisIso ? z.vonIso : (await import('./kern.js')).plusTage(z.vonIso, 1)), pflicht: true }], { okText: 'Teilen' });
    if (!w) return;
    await api.post(vpfad('/absenzen/teilen'), { id: Number(z.nr), ab: datumLesen(w.ab, z.vonIso) }, { quelle: f.id });
    await laden();
  }
  async function kopieren() {
    await entwurfUebernehmen();
    const z = tabelle.aktiveZeile();
    if (!z || z.va) return;
    const w = await formular('Abwesenheit übertragen', [{ name: 'elemente', titel: art().titel, pflicht: true, hinweis: 'Kurznamen, mehrere mit Komma. Zeitraum und Grund werden übernommen.' }], { okText: 'Übertragen' });
    if (!w) return;
    await api.post(vpfad('/absenzen/kopieren'), { id: Number(z.nr), elemente: w.elemente }, { quelle: f.id });
    await laden();
  }
  async function zusammenfassen() {
    await entwurfUebernehmen();
    await api.post(vpfad('/absenzen/zusammenfassen'), { ids: markierte() }, { quelle: f.id });
    await laden();
  }
  async function loeschen() {
    await entwurfUebernehmen();
    const ids = markierte();
    if (!ids.length || !(await frage(`${ids.length} Abwesenheit(en) löschen? Daraus entstandene Vertretungen werden entfernt.`, { gefahr: true, ja: 'Löschen', nein: 'Abbrechen' }))) return;
    await api.post(vpfad('/absenzen/loeschen'), { ids }, { quelle: f.id });
    await laden();
  }

  function weitereEintraege() {
    return [
      { text: 'Abwesenheit teilen …', deaktiviert: !schreiben, aktion: teilen },
      { text: 'Auf weitere übertragen …', deaktiviert: !schreiben, aktion: kopieren },
      { text: 'Abwesenheiten zusammenfassen', deaktiviert: !schreiben, aktion: zusammenfassen },
    ];
  }
  if (schreiben) {
    f.werkzeug({ text: 'Neu', titel: 'Neue Abwesenheit (Einfg)', aktion: neuDialog });
    f.werkzeug({ text: 'Bearbeiten', titel: 'Markierte Abwesenheit bearbeiten', aktion: bearbeiten });
    f.werkzeug({ text: 'Löschen', titel: 'Markierte Abwesenheiten löschen (Strg+Entf)', aktion: loeschen });
  }
  menueKnopf(f, 'Weitere Aktionen', () => [
    ...weitereEintraege(),
    null,
    { text: 'Veranstaltungen …', aktion: () => fensterverwaltung.oeffnen('veranstaltungen.liste', {}) },
  ]);
  const vaSchalter = werkzeugSchalter(f, 'Veranstaltungen zeigen', { titel: 'Veranstaltungen des Zeitraums in der Liste mit anzeigen', beiAenderung: async (w) => { vaZeigen = w; await einstellungSchreiben('vertretung.absenzen.va', vaZeigen); laden(); } });
  vaSchalter.classList.add('rechts');

  tabelle.el.addEventListener('keydown', (e) => {
    if (tabelle.editor) return;
    if (e.key === 'Escape' && entwurf) { e.preventDefault(); e.stopImmediatePropagation(); entwurf = null; laden(); }
    else if (e.key === 'Enter' && e.ctrlKey && entwurf) { e.preventDefault(); e.stopImmediatePropagation(); entwurfUebernehmen(); }
    else if (e.key === 'Delete' && e.ctrlKey) { e.preventDefault(); e.stopImmediatePropagation(); loeschen(); }
    else if (e.key === 'Insert' && schreiben) { e.preventDefault(); neuDialog(); }
  }, true);
  f.beimSchliessen(() => { entwurfUebernehmen(); });
  f.an('fenster-aktiv', (x) => { if (x !== f && entwurf) entwurfUebernehmen(); });

  let ladeNr = 0;
  async function laden() {
    if (entwurf || !zr.von) return;
    const n = ++ladeNr;
    const d = await api.get(vpfad(`/absenzen?art=${art().art}&von=${zr.von}&bis=${zr.bis}&veranstaltungen=${vaZeigen}`));
    if (n !== ladeNr || entwurf) return;
    daten = d;
    const zeilen = d.zeilen.map((z) => ({ ...z, vonIso: z.von, bisIso: z.bis, sv: String(z.sv), sb: String(z.sb), offen: z.offen ? String(z.offen) : '', nr: String(z.nr) }));
    for (const v of d.veranstaltungen) zeilen.push({ id: v.id, va: v.nr, nr: `VA ${v.nr}`, element: '', vonIso: v.von, bisIso: v.bis, sv: String(v.sv), sb: String(v.sb), grund: v.grund, text: `Veranstaltung: ${v.elemente} ${v.text}`.trim(), begleit: '', offen: '' });
    tabelle.daten(zeilen);
    tabs.texte([`Lehrkräfte (${d.anzahl.lehrer})`, `Klassen (${d.anzahl.klasse})`, `Räume (${d.anzahl.raum})`]);
    f.fuss.replaceChildren(h('span', null, `${d.zeilen.length} ${d.zeilen.length === 1 ? 'Abwesenheit' : 'Abwesenheiten'}`), h('span', null, `${d.zeilen.reduce((a, z) => a + z.offen, 0)} offene Vertretungen`),
      h('span', { class: 'rechts leise' }, 'Zeile verlassen speichert · Strg+Enter sofort · Esc verwirft'));
  }
  const entprelltLaden = entprellen(() => laden().catch(() => {}), 150);

  // Verknüpfung mit der Auswahl: Abwesenheiten der gewählten Lehrkraft (Klasse, Raum) hervorheben
  function markieren(typ, id) {
    if (entwurf || tabelle.editor) return;
    markiert = { typ, id };
    const i = ARTEN.findIndex((a) => a.typ === typ);
    if (i >= 0 && i !== artIndex) { tabs.waehlen(i); return; }
    tabelle._neuZeichnen();
    const z = tabelle.zeilen.find((x) => x.elementId === id);
    if (z && !f.el.contains(document.activeElement)) tabelle.waehle(z.id);
  }
  f.an('vertretung.auswahl', (a) => {
    if (!a?.zeile || f.el.contains(document.activeElement)) return;
    if (art().art === 'klasse' && a.zeile.klasse) markieren('klasse', a.zeile.klasse);
    else if (a.zeile.lehrer) markieren('lehrer', a.zeile.lehrer);
  });
  f.an('element', (e) => { if (e.quelle !== f.id && ['lehrer', 'klasse', 'raum'].includes(e.typ)) markieren(e.typ, e.id); });
  f.an('daten', (e) => { if (betrifft(e, 'Vertretung', 'Stammdaten', 'Stundenplan')) entprelltLaden(); });
  f.an('vertretung.datum', () => { if (entwurf) entwurfUebernehmen(); });

  spalten();
  einstellungLesen('vertretung.absenzen.va').then((w) => { vaZeigen = !!w; vaSchalter.eingabe.checked = vaZeigen; }).finally(() => laden().catch(fehlerMelden));
  f.titel(`Abwesenheiten – ${art().titel}`);
  void planungsdatum;
}

export const fenster = {
  'vertretung.absenzen': { titel: 'Abwesenheiten', symbol: 'abwesenheit', breite: 820, hoehe: 340, einzig: () => 'absenzen', erstellen: absenzFenster },
};
