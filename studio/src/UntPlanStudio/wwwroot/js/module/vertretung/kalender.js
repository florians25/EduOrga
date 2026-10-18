// Ansicht „Kalender“: Kalenderwoche und Datum, Woche mit Kennzahlen (offene Vertretungen, abwesende Klassen, Freistellungen,
// gesperrte Räume, Raumvertretungen, Tagestexte, Kollisionen – Klick wählt den Tag), Reiter Tagestexte (direkte Eingabe) und
// Kalendertag (Schultag, Feiertag, unterrichtsfrei mit Grund, einzelne Stunden unterrichtsfrei, Notiz). Dazu die Datumsauswahl
// in der Kopfleiste.
import { h, leeren } from '../../kern/dom.js';
import { api } from '../../kern/api.js';
import { an } from '../../kern/ereignisse.js';
import { zustand, elemente, darfSchreiben } from '../../kern/zustand.js';
import { betrifft } from '../../kern/ereignisse.js';
import { fehlerMelden, hinweis } from '../../kern/dialog.js';
import { symbol } from '../../kern/symbole.js';
import { vpfad, planungsdatum, datumSetzen, blaettern, tagKurz, datumText, datumLesen, montag, plusTage } from './kern.js';
import { reiter, listenTabelle, filterleiste, filterGruppe } from './steuer.js';

/** Datumsauswahl in der Kopfleiste: Woche zurück, Tag zurück, [Mo 02.11.2026], Tag vor, Woche vor – Strg+Bild↑ / Strg+Bild↓ blättern. */
export function datumsElement() {
  const text = h('span', { class: 'vt-rb-text' });
  const eingabe = h('input', { type: 'date', class: 'vt-rb-datum', title: 'Planungsdatum wählen' });
  const knopf = (t, titel, f) => h('button', { type: 'button', class: 'vt-rb-pfeil', title: titel, onclick: () => f().catch?.(fehlerMelden) }, t);
  const el = h('div', { class: 'vt-rb-datumsauswahl', title: 'Planungsdatum – Tag blättern mit Strg+Bild↑ / Strg+Bild↓' },
    h('div', { class: 'vt-rb-zeile' }, knopf(symbol('pfeil_doppel_links'), 'Eine Woche zurück', () => blaettern(-1, true)), knopf(symbol('pfeil_links'), 'Vorheriger Unterrichtstag (Strg+Bild↑)', () => blaettern(-1)),
      h('label', { class: 'vt-rb-mitte' }, symbol('kalender'), text, eingabe),
      knopf(symbol('pfeil_rechts'), 'Nächster Unterrichtstag (Strg+Bild↓)', () => blaettern(1)), knopf(symbol('pfeil_doppel_rechts'), 'Eine Woche weiter', () => blaettern(1, true))),
    h('div', { class: 'vt-rb-unter' }, 'Datum'));
  const zeigen = () => {
    const d = planungsdatum();
    text.textContent = d ? `${tagKurz(d)} ${datumText(d)}` : '–';
    eingabe.value = d || '';
    el.classList.toggle('aus', !zustand.dokument);
  };
  eingabe.addEventListener('change', () => { if (eingabe.value) datumSetzen(eingabe.value); });
  const ab = [an('vertretung.datum', zeigen), an('dokument', zeigen)];
  // beim Neuzeichnen des Menübands verschwindet das alte Element; Abmelden, sobald es nicht mehr im Dokument hängt
  const pruefen = setInterval(() => { if (!el.isConnected && el.dataset.gesehen) { ab.forEach((x) => x()); clearInterval(pruefen); } else if (el.isConnected) el.dataset.gesehen = '1'; }, 5000);
  zeigen();
  return el;
}

const TAGESTEXT_ARTEN = ['Alle', 'Klassen', 'Lehrer', 'Nur Lehrer'];
const TAGESTEXT_ART_TEXT = { Alle: 'Alle', Klassen: 'Klassen', Lehrer: 'Lehrkräfte', 'Nur Lehrer': 'Nur Lehrkräfte' };

function kalenderFenster(f, p) {
  const schreiben = darfSchreiben();
  let daten = null;
  const kw = h('input', { class: 'eingabe vt-kw', type: 'number', min: 1, max: 53, title: 'Kalenderwoche' });
  const datum = h('input', { class: 'eingabe', type: 'date', title: 'Datum' });
  const typ = h('span', { class: 'leise vt-kw-typ' });
  f.inhalt.append(filterleiste(filterGruppe('Kalenderwoche', kw), filterGruppe('Datum', datum), typ));
  kw.addEventListener('change', () => {
    const d = planungsdatum();
    if (!d || !kw.value) return;
    const diff = Number(kw.value) - daten.kw;
    if (diff) datumSetzen(montag(plusTage(d, diff * 7)));
  });
  datum.addEventListener('change', () => { if (datum.value) datumSetzen(datum.value); });

  const oben = h('div', { class: 'vt-kal-oben' });
  const unten = h('div', { class: 'vt-kal-unten' });
  f.inhalt.append(oben, unten);
  const zahl = (k) => (w) => (w[k] ? String(w[k]) : '');
  const rot = (k) => (w, td) => { if (w[k] > 0) td.classList.add('vt-rot'); };
  const woche = listenTabelle(oben, {
    spalten: [
      { titel: 'Datum', breite: 56, wert: (w) => w.text }, { titel: 'Tag', breite: 40, wert: (w) => w.tag },
      { titel: 'Offen', breite: 52, klasse: 'rechts', hinweis: 'Offene Vertretungen', wert: zahl('offen'), zelle: rot('offen') },
      { titel: 'Kl. abw.', breite: 60, klasse: 'rechts', hinweis: 'Abwesende Klassen', wert: zahl('abwKl') },
      { titel: 'Freigest.', breite: 66, klasse: 'rechts', hinweis: 'Freigestellte Lehrkräfte (Klasse abwesend)', wert: zahl('freis') },
      { titel: 'Gesperrt', breite: 64, klasse: 'rechts', hinweis: 'Gesperrte Räume', wert: zahl('blRaeume') },
      { titel: 'Raumvertr.', breite: 76, klasse: 'rechts', hinweis: 'Raumvertretungen', wert: zahl('raumV') },
      { titel: 'Texte', breite: 52, klasse: 'rechts', hinweis: 'Tagestexte', wert: zahl('tagestexte') },
      { titel: 'Koll. L.', breite: 60, klasse: 'rechts', hinweis: 'Kollisionen von Lehrkräften', wert: zahl('kollL'), zelle: rot('kollL') },
      { titel: 'Koll. R.', breite: 60, klasse: 'rechts', hinweis: 'Kollisionen von Räumen', wert: zahl('kollR'), zelle: rot('kollR') },
      { titel: 'Hinweis', wert: (w) => w.frei },
    ],
    zeilenKlasse: (w) => `${w.unterrichtstag ? '' : 'vt-frei'} ${w.datum === planungsdatum() ? 'vt-heute' : ''}`,
    beiWahl: (w) => { if (w.datum !== planungsdatum()) datumSetzen(w.datum); },
  });

  // ---- Tagestexte ----
  const texteFlaeche = h('div', { class: 'vt-texte' });
  const tagFlaeche = h('div', { class: 'vt-kaltag' });
  const tabs = reiter(['Tagestexte (0)', 'Kalendertag'], (i) => { texteFlaeche.hidden = i !== 0; tagFlaeche.hidden = i !== 1; f.parameterSetzen({ reiter: i }); }, p.reiter ?? 0);
  unten.append(tabs.el, texteFlaeche, tagFlaeche);
  texteFlaeche.hidden = tabs.index !== 0;
  tagFlaeche.hidden = tabs.index !== 1;

  function textZeile(t) {
    const bis = h('input', { class: 'eingabe', value: t ? datumText(t.bis) : '', placeholder: datumText(planungsdatum()), title: 'Gültig bis', disabled: !schreiben });
    const text = h('input', { class: 'eingabe', value: t?.text || '', placeholder: t ? '' : 'Neuer Tagestext …', title: t?.formatiert ? 'Formatierter Tagestext (Formatierung bleibt erhalten, solange der Text nicht geändert wird)' : 'Tagestext', disabled: !schreiben });
    const portal = h('input', { type: 'checkbox', checked: t ? t.portal : true, title: 'In UntPlan Web anzeigen', disabled: !schreiben });
    const art = h('select', { class: 'eingabe', disabled: !schreiben, title: 'Für wen der Text gilt' }, TAGESTEXT_ARTEN.map((a) => h('option', { value: a, selected: a === (t?.art || 'Alle') }, TAGESTEXT_ART_TEXT[a])));
    const elem = h('input', { class: 'eingabe', value: t?.elemente || '', title: 'Klassen bzw. Lehrkräfte (Kurznamen)', placeholder: t ? '' : 'alle', disabled: !schreiben });
    const loeschen = h('button', { type: 'button', class: 'vt-symbolknopf', title: 'Tagestext löschen', 'aria-label': 'Tagestext löschen', disabled: !schreiben || !t }, symbol('loeschen'));
    const tr = h('tr', { class: t?.formatiert ? 'fett' : '' }, h('td', null, bis), h('td', null, text), h('td', { class: 'mitte' }, portal), h('td', null, art), h('td', null, elem), h('td', null, loeschen));
    tr.dataset.start = t?.start || '';
    for (const x of [bis, text, elem]) x.addEventListener('change', () => texteSpeichern());
    for (const x of [portal, art]) x.addEventListener('change', () => texteSpeichern());
    loeschen.addEventListener('click', () => { tr.remove(); texteSpeichern(); });
    tr.werte = () => ({ start: tr.dataset.start || null, bis: bis.value ? datumLesen(bis.value, planungsdatum()) : null, text: text.value.trim(), portal: portal.checked, art: art.value, elemente: elem.value });
    return tr;
  }
  const texteKoerper = h('tbody');
  texteFlaeche.append(h('table', { class: 'vt-eingabetabelle vt-tagestexte' },
    h('colgroup', null, h('col', { style: { width: '104px' } }), h('col'), h('col', { style: { width: '56px' } }), h('col', { style: { width: '128px' } }), h('col', { style: { width: '120px' } }), h('col', { style: { width: '36px' } })),
    h('thead', null, h('tr', null, h('th', null, 'Gültig bis'), h('th', null, 'Text'), h('th', { class: 'mitte', title: 'In UntPlan Web anzeigen' }, 'Web'), h('th', null, 'Für'), h('th', null, 'Elemente'), h('th'))), texteKoerper));
  let speichertTexte = false;
  async function texteSpeichern() {
    if (speichertTexte) return;
    speichertTexte = true;
    try {
      const texte = [...texteKoerper.children].map((tr) => tr.werte()).filter((t) => t.text);
      daten = await api.put(vpfad('/tagestexte'), { datum: planungsdatum(), texte }, { quelle: f.id });
      anzeigen();
    } catch (e) { fehlerMelden(e); } finally { speichertTexte = false; }
  }

  // ---- Kalendertag ----
  const radio = (wert, text) => h('label', { class: 'vt-radio kontrolle' }, h('input', { type: 'radio', name: `kt-${f.id}`, value: wert, disabled: !schreiben }), text);
  const rNormal = radio('normal', 'Normaler Schultag');
  const rFeiertag = radio('feiertag', 'Feiertag');
  const rFrei = radio('frei', 'Unterrichtsfrei');
  const rStunden = radio('stunden', 'Nur einzelne Stunden unterrichtsfrei');
  const grund = h('select', { class: 'eingabe', disabled: !schreiben, id: `kt-grund-${f.id}` });
  const stunden = h('input', { class: 'eingabe', placeholder: 'z. B. 6-8 oder 1,5', disabled: !schreiben, id: `kt-stunden-${f.id}` });
  const notiz = h('input', { class: 'eingabe', placeholder: 'Nur für die Planung, wird nicht ausgegeben', disabled: !schreiben, id: `kt-notiz-${f.id}` });
  const titel = h('h3', { class: 'vt-kaltitel' });
  tagFlaeche.append(h('div', { class: 'vt-kalform' }, titel, h('div', { class: 'formular' },
    h('span', { class: 'vt-flabel' }, 'Art des Tages'), h('div', { class: 'vt-radios', role: 'radiogroup' }, rNormal, rFeiertag, rFrei, rStunden),
    h('label', { for: grund.id }, 'Grund'), grund,
    h('label', { for: stunden.id }, 'Freie Stunden'), stunden,
    h('label', { for: notiz.id }, 'Notiz'), notiz)));
  const artWert = () => tagFlaeche.querySelector(`input[name="kt-${f.id}"]:checked`)?.value || 'normal';
  async function kalendertagSpeichern() {
    daten = await api.post(vpfad('/kalendertag'), { datum: planungsdatum(), art: artWert(), grund: grund.value, stunden: stunden.value, notiz: notiz.value }, { quelle: f.id });
    anzeigen();
    hinweis('Kalendertag gespeichert.', 'ok', 1500);
  }
  tagFlaeche.addEventListener('change', (e) => { if (e.target.matches('input[type=radio], select')) kalendertagSpeichern().catch(fehlerMelden); });
  stunden.addEventListener('focus', () => { rStunden.firstChild.checked = true; });
  stunden.addEventListener('change', () => kalendertagSpeichern().catch(fehlerMelden));
  notiz.addEventListener('change', () => kalendertagSpeichern().catch(fehlerMelden));

  async function anzeigen() {
    if (!daten) return;
    kw.value = daten.kw;
    datum.value = daten.datum;
    typ.textContent = `${daten.wochentyp}-Woche${daten.unterrichtstag ? '' : ' · kein Unterrichtstag'}`;
    typ.classList.toggle('vt-frei-text', !daten.unterrichtstag);
    woche.setzen(daten.woche);
    const i = daten.woche.findIndex((w) => w.datum === daten.datum);
    if (i >= 0) woche._markieren?.();
    leeren(texteKoerper).append(...daten.tagestexte.map(textZeile), textZeile(null));
    tabs.texte([`Tagestexte (${daten.tagestexte.length})`, 'Kalendertag']);
    titel.textContent = daten.titel;
    const gruende = await elemente('abwesenheitsgrund');
    leeren(grund).append(h('option', { value: '' }, 'Ohne Grund'), ...gruende.map((g) => h('option', { value: g.k, selected: g.k === daten.kalendertag.grund }, g.l ? `${g.k} – ${g.l}` : g.k)));
    for (const r of [rNormal, rFeiertag, rFrei, rStunden]) r.firstChild.checked = r.firstChild.value === daten.kalendertag.art;
    stunden.value = daten.kalendertag.stunden;
    notiz.value = daten.kalendertag.notiz;
    f.titel(`Kalender – ${daten.titel}`);
  }
  async function laden() {
    const d = planungsdatum();
    if (!d) return;
    daten = await api.get(vpfad(`/kalender?datum=${d}`));
    await anzeigen();
  }
  f.an('vertretung.datum', () => laden().catch(fehlerMelden));
  f.an('daten', (e) => { if (betrifft(e, 'Vertretung', 'Einstellungen') && !f.el.contains(document.activeElement)) laden().catch(() => {}); });
  f.werkzeug({ text: '', symbol: 'pfeil_links', nurSymbol: true, titel: 'Vorheriger Unterrichtstag (Strg+Bild↑)', aktion: () => blaettern(-1) });
  f.werkzeug({ text: 'Heute', titel: 'Zum heutigen Tag', aktion: () => import('./kern.js').then((k) => k.datumSetzen(k.isoAus(new Date()))) });
  f.werkzeug({ text: '', symbol: 'pfeil_rechts', nurSymbol: true, titel: 'Nächster Unterrichtstag (Strg+Bild↓)', aktion: () => blaettern(1) });
  laden().catch(fehlerMelden);
}

export const fenster = {
  'vertretung.kalender': {
    titel: 'Kalender', symbol: 'kalender', breite: 620, hoehe: 520, einzig: () => 'kalender',
    erneutGeoeffnet: (f, p) => { if (p?.reiter !== undefined) f.inhalt.querySelectorAll('.vt-reiter button')[p.reiter]?.click(); },
    erstellen: kalenderFenster,
  },
};
