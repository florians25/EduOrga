// Modul „Veranstaltungen“ (Vertretungsmodus): Liste mit Nr., Klassen, Klassenteil, Lehrkräfte, Räume, Von, ab Std., Bis,
// bis Std., Grund, Text, zählt, Schülergruppe. Eingabe direkt in der Tabelle („Alle Lehrkräfte“, „Alle Klassen außer 5a“),
// Ersatzlehrkräfte statt „???“, Schnellauswahl (alle, nach Abteilung, Jahrgang, Gruppe …), alle aus den Stunden bzw. aus der gewählten
// Stunde übernehmen, Kopieren auf das eingestellte Datum.
import { h } from '../kern/dom.js';
import { symbol } from '../kern/symbole.js';
import { api } from '../kern/api.js';
import { zustand, elemente, darfSchreiben, modusSetzen } from '../kern/zustand.js';
import { betrifft } from '../kern/ereignisse.js';
import { Tabelle } from '../kern/tabelle.js';
import { frage, hinweis, fehlerMelden, menue, formular } from '../kern/dialog.js';
import { fensterverwaltung } from '../kern/fenster.js';
import { planungsdatum, datumText, datumLesen } from './vertretung/kern.js';
import { zeitraumAuswahl, filterleiste, filterGruppe, menueKnopf } from './vertretung/steuer.js';

const FELDER = [['K', 'Klassen (Unterricht entfällt)', 'klassen'], ['KT', 'Klassenteil (Unterricht parallel)', 'klassen'], ['L', 'Lehrkräfte', 'lehrer'], ['R', 'Räume', 'raeume']];
const vapfad = (p = '') => api.dok(`/veranstaltungen${p}`);

function veranstaltungenFenster(f, p) {
  const schreiben = darfSchreiben();
  let kopie = null;
  let letzteStunde = null;
  let maus = { x: 200, y: 200 };
  const zr = zeitraumAuswahl(f, { art: p.zeitraum || 'tag', beiAenderung: () => { f.parameterSetzen({ zeitraum: zr.art }); laden(); } });
  f.inhalt.append(filterleiste(filterGruppe('Zeitraum', zr.el)));

  const ed = (z) => schreiben && !!z;
  const tabelle = new Tabelle(f.inhalt, {
    spalten: [
      { schluessel: 'nr', titel: 'Nr.', breite: 56, art: 'NurLesen', ausrichtung: 'rechts', klasse: (z) => (z.offen ? 'vt-rot' : null) },
      { schluessel: 'k', titel: 'Klassen', breite: 110, hinweis: 'Klassen – ihr Unterricht entfällt', art: 'ElementListe', refTyp: 'klasse', editierbarFuer: ed },
      { schluessel: 'kt', titel: 'Klassenteil', breite: 90, hinweis: 'Klassenteil – der übrige Unterricht findet parallel statt', art: 'ElementListe', refTyp: 'klasse', editierbarFuer: ed },
      { schluessel: 'l', titel: 'Lehrkräfte', breite: 130, art: 'ElementListe', refTyp: 'lehrer', editierbarFuer: ed, farbe: (z) => (z.offen ? 'var(--up-entfall-flaeche)' : null), klasse: (z) => (z.offen ? 'vt-rot' : null) },
      { schluessel: 'r', titel: 'Räume', breite: 80, art: 'ElementListe', refTyp: 'raum', editierbarFuer: ed },
      { schluessel: 'v', titel: 'Von', breite: 96, editierbarFuer: ed },
      { schluessel: 'sv', titel: 'ab Std.', breite: 60, art: 'Ganzzahl', ausrichtung: 'rechts', editierbarFuer: ed },
      { schluessel: 'b', titel: 'Bis', breite: 96, editierbarFuer: ed },
      { schluessel: 'sb', titel: 'bis Std.', breite: 64, art: 'Ganzzahl', ausrichtung: 'rechts', editierbarFuer: ed },
      { schluessel: 'g', titel: 'Grund', breite: 72, art: 'Element', refTyp: 'abwesenheitsgrund', editierbarFuer: ed },
      { schluessel: 't', titel: 'Text', breite: 180, editierbarFuer: ed },
      { schluessel: 'z', titel: 'Zählt', breite: 56, hinweis: 'Wird im Vertretungszähler gezählt', art: 'Bool', editierbarFuer: ed },
      { schluessel: 'sg', titel: 'Schülergruppe', breite: 120, art: 'Element', refTyp: 'schuelergruppe', editierbarFuer: ed },
    ],
    sortierbar: false,
    zeilenHoehe: 30,
    leerText: 'Im gewählten Zeitraum gibt es keine Veranstaltungen.',
    neuText: schreiben ? 'Neue Veranstaltung …' : undefined,
    zeilenKlasse: (z) => (z.vergangen ? 'leise' : ''),
    neu: schreiben ? async (s, wert) => { const r = await feld(null, s.schluessel, wert); if (r?.id) tabelle.waehle(r.id); return null; } : undefined,
    aendern: schreiben ? async (z, s, wert) => { await feld(z.id, s.schluessel, wert); return null; } : undefined,
    optionen: async (s) => {
      if (s.refTyp === 'schuelergruppe') return (await api.get(vapfad('/schuelergruppen'))).map((x) => ({ k: x, l: '' }));
      const liste = await elemente(s.refTyp);
      return s.art === 'ElementListe' ? [{ k: s.refTyp === 'lehrer' ? 'Alle Lehrkräfte' : s.refTyp === 'raum' ? 'Alle Räume' : 'Alle Klassen', l: 'alle (wählbaren) Elemente' }, ...liste] : liste;
    },
    beiAuswahl: (_, z) => { nrEl.value = z?.id || ''; if (z?.offen) hinweis(z.offen, 'warnung', 4000); },
    kontextmenue: (zeilen, spalte) => { schnellMenue(FELDER.find((x) => x[0].toLowerCase() === spalte?.schluessel)?.[0] || null, maus.x, maus.y); return []; },
    beiEntf: () => loeschen(),
  });
  tabelle.el.addEventListener('contextmenu', (e) => { maus = { x: e.clientX, y: e.clientY }; }, true);

  async function feld(id, schluessel, wert) {
    const F = schluessel.toUpperCase();
    let w = wert;
    if (F === 'V' || F === 'B') w = datumText(datumLesen(wert, zr.von));
    const r = await api.post(vapfad(id ? `/${id}` : ''), { feld: F, wert: w, datum: zr.von }, { quelle: f.id });
    await laden();
    return r;
  }
  const aktuell = () => tabelle.aktiveZeile();

  async function schnell(feldname, ids, ersetzen = false) {
    const z = aktuell();
    const r = await api.post(vapfad(`/schnell${z ? `/${z.id}` : ''}`), { feld: feldname, ids, ersetzen, datum: zr.von }, { quelle: f.id });
    if (r.hinweis) hinweis(r.hinweis, 'info');
    await laden();
    if (r.id) tabelle.waehle(r.id);
  }
  async function gruppenEintraege(feldname) {
    const z = aktuell();
    const gruppen = await api.get(vapfad(`/gruppen?feld=${feldname}${z ? `&va=${z.id}` : ''}`));
    const e = gruppen.filter((g) => !g.bereich).map((g) => ({ text: `${g.name}  (${g.anzahl})`, aktion: () => schnell(feldname, g.ids) }));
    const bereiche = [...new Set(gruppen.filter((g) => g.bereich).map((g) => g.bereich))];
    for (const b of bereiche) e.push({ text: `Nach ${b}`, menue: gruppen.filter((g) => g.bereich === b).map((g) => ({ text: `${g.name}  (${g.anzahl})`, aktion: () => schnell(feldname, g.ids) })) });
    return e.length ? e : [{ text: 'Keine Elemente', deaktiviert: true }];
  }
  async function schnellMenue(feldname, x, y) {
    if (!schreiben) return;
    const z = aktuell();
    const eintraege = [];
    if (feldname) {
      eintraege.push(...await gruppenEintraege(feldname), null, { text: `${FELDER.find((q) => q[0] === feldname)[1]} leeren`, deaktiviert: !z, aktion: () => schnell(feldname, [], true) });
    } else {
      for (const [k, text] of FELDER) eintraege.push({ text, menue: await gruppenEintraege(k) });
    }
    eintraege.push(null, { text: 'Alle aus den Stunden der Veranstaltung übernehmen', deaktiviert: !z, aktion: ausStunden });
    eintraege.push({ text: letzteStunde ? `Alle aus der gewählten Stunde übernehmen (Unterricht ${letzteStunde.u})` : 'Alle aus der gewählten Stunde übernehmen (zuerst eine Stunde wählen)', deaktiviert: !letzteStunde, aktion: ausStunde });
    menue(x, y, eintraege);
  }
  async function ausStunden() {
    const z = aktuell();
    if (!z) { hinweis('Bitte zuerst eine Veranstaltung wählen.', 'warnung'); return; }
    const r = await api.post(vapfad(`/${z.id}/ausstunden`), {}, { quelle: f.id });
    if (r.hinweis) hinweis(r.hinweis, 'info');
    await laden();
  }
  async function ausStunde() {
    if (!letzteStunde) return;
    const r = await api.post(vapfad('/ausstunde'), { unterricht: letzteStunde.u, datum: letzteStunde.datum, stunde: letzteStunde.stunde, va: aktuell()?.id }, { quelle: f.id });
    if (r.hinweis) hinweis(r.hinweis, 'info');
    await laden();
    if (r.id) tabelle.waehle(r.id);
  }
  async function loeschen() {
    const ids = tabelle.ausgewaehlte().map((z) => z.id);
    if (!ids.length || !(await frage(`${ids.length} Veranstaltung(en) löschen?`, { gefahr: true, ja: 'Löschen', nein: 'Abbrechen' }))) return;
    await api.post(vapfad('/loeschen'), { ids }, { quelle: f.id });
    await laden();
  }

  if (schreiben) {
    f.werkzeug({ text: 'Neu', titel: 'Neue Veranstaltung', aktion: async () => {
      const w = await formular('Neue Veranstaltung', [
        { name: 'T', titel: 'Text', wert: 'Exkursion' }, { name: 'K', titel: 'Klassen', hinweis: 'Kurznamen, „Alle Klassen“ oder „Alle Klassen außer 5a“' }, { name: 'L', titel: 'Lehrkräfte', hinweis: 'Kurznamen oder „Alle Lehrkräfte“' }, { name: 'R', titel: 'Räume' },
        { name: 'V', titel: 'Von', wert: datumText(zr.von) }, { name: 'SV', titel: 'Ab Stunde', art: 'zahl', wert: 1 }, { name: 'B', titel: 'Bis', wert: datumText(zr.von) }, { name: 'SB', titel: 'Bis Stunde', art: 'zahl', wert: zustand.grunddaten?.zeitraster?.stunden?.length || 8 },
      ], { okText: 'Anlegen', breite: '500px' });
      if (!w) return;
      const r = await api.post(vapfad(''), { feld: 'T', wert: w.T || 'Veranstaltung', datum: datumLesen(w.V, zr.von) }, { quelle: f.id });
      for (const k of ['B', 'SV', 'SB', 'K', 'L', 'R']) if (w[k]) await api.post(vapfad(`/${r.id}`), { feld: k, wert: k === 'B' ? datumText(datumLesen(w[k], zr.von)) : w[k] }, { quelle: f.id });
      await laden();
      tabelle.waehle(r.id);
    } });
    f.werkzeug({ text: 'Löschen', titel: 'Markierte Veranstaltungen löschen (Entf)', aktion: loeschen });
    const hinzu = f.werkzeug({ text: 'Hinzufügen', titel: 'Schnell hinzufügen: alle Lehrkräfte, Klassen, Räume, nach Abteilung, Jahrgang oder Gruppe, alle aus den Stunden', aktion: () => { const r = hinzu.getBoundingClientRect(); return schnellMenue(null, r.left, r.bottom + 4); } });
    hinzu.classList.add('vt-menueknopf');
    hinzu.append(h('span', { class: 'vt-chevron' }, symbol('pfeil_runter')));
  }
  menueKnopf(f, 'Weitere Aktionen', () => [
    { text: 'Kopieren', deaktiviert: !schreiben, aktion: () => { kopie = aktuell()?.id; if (kopie) hinweis(`Veranstaltung ${kopie} kopiert – „Einfügen“ legt sie am eingestellten Datum an.`, 'info'); } },
    { text: 'Einfügen am eingestellten Datum', deaktiviert: !schreiben || !kopie, aktion: async () => {
      const r = await api.post(vapfad(`/${kopie}/kopieren`), { datum: zr.von }, { quelle: f.id });
      await laden();
      tabelle.waehle(r.id);
    } },
    null,
    { text: 'Alle aus den Stunden übernehmen', deaktiviert: !schreiben, aktion: ausStunden },
    null,
    { text: 'Vertretungen …', aktion: () => fensterverwaltung.oeffnen('vertretung.liste', {}) },
  ]);

  const nrEl = h('input', { class: 'eingabe vt-nr', inputmode: 'numeric', title: 'Nummer eingeben und Enter: zur Veranstaltung springen' });
  f.fuss.append(h('label', { class: 'vt-fussfeld' }, 'Nr.', nrEl));
  nrEl.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter' || !Number(nrEl.value)) return;
    if (!tabelle.waehle(Number(nrEl.value))) hinweis(`Die Veranstaltung Nr. ${nrEl.value} liegt nicht im gewählten Zeitraum.`, 'warnung');
  });

  let ladeNr = 0;
  async function laden() {
    if (!zr.von) return;
    const n = ++ladeNr;
    const d = await api.get(vapfad(`?von=${zr.von}&bis=${zr.bis}`));
    if (n !== ladeNr) return;
    tabelle.daten(d.zeilen.map((z) => ({ ...z, k: z.k.replace(/\n/g, ' '), kt: z.kt.replace(/\n/g, ' '), l: z.l.replace(/\n/g, ' '), r: z.r.replace(/\n/g, ' ') })));
  }
  f.an('vertretung.auswahl', (a) => { if (a?.zeile?.u && a.zeile.datum) letzteStunde = { u: a.zeile.u, datum: a.zeile.datum, stunde: a.zeile.stunde }; });
  f.an('daten', (e) => { if (betrifft(e, 'Vertretung', 'Stammdaten')) laden().catch(() => {}); });
  laden().catch(fehlerMelden);
  void planungsdatum;
}

export default {
  id: 'veranstaltungen',
  fenster: {
    'veranstaltungen.liste': { titel: 'Veranstaltungen', symbol: 'veranstaltung', breite: 1000, hoehe: 340, einzig: () => 'veranstaltungen', erstellen: veranstaltungenFenster },
  },
  befehle: {
    'veranstaltungen.oeffnen': () => {
      if (!zustand.dokument) return null;
      if (zustand.modus !== 'vertretung') { modusSetzen('vertretung'); try { localStorage.setItem('studio.modus', 'vertretung'); } catch { /* privat */ } }
      return fensterverwaltung.oeffnen('veranstaltungen.liste', {});
    },
  },
  ribbon: [
    { id: 'vertretung.veranstaltungen', reiter: 'Vertretungsplanung', gruppe: 'Ereignisse', text: 'Veranstaltungen', symbol: 'veranstaltung', braucht: 'dokument', befehl: 'veranstaltungen.oeffnen' },
  ],
};
