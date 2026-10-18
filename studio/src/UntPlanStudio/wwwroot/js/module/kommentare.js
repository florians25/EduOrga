// Modul „Kommentare“: Notizen an Stammdaten (Lehrkraft, Klasse, Raum …) mit Kategorie (Farbe), Element und Feld –
// Liste aller Kommentare, Anlegen (Element wählen), Bearbeiten, Löschen. Befehl 'kommentare.neu' für andere Module.
import { h } from '../kern/dom.js';
import { api } from '../kern/api.js';
import { zustand, darfSchreiben, elemente } from '../kern/zustand.js';
import { betrifft } from '../kern/ereignisse.js';
import { Tabelle } from '../kern/tabelle.js';
import { dialog, frage, hinweis, fehlerMelden } from '../kern/dialog.js';
import { fensterverwaltung } from '../kern/fenster.js';
import { werkzeugFeld } from './unterricht.js';

const TYPEN = [['lehrer', 'Lehrkraft'], ['klasse', 'Klasse'], ['raum', 'Raum'], ['fach', 'Fach'], ['schueler', 'Schüler'], ['gang', 'Gang'], ['abteilung', 'Abteilung']];

/** Kommentar-Dialog; vorgabe: { typ, element, feld, kategorie, text } – liefert die Eingabe oder null. */
async function kommentarDialog(vorgabe = {}, titel = 'Kommentar') {
  const kategorien = await api.get(api.dok('/kommentare/kategorien'));
  const typ = h('select', { class: 'eingabe', disabled: !!vorgabe.id, 'aria-label': 'Art des Elements' }, TYPEN.map(([w, t]) => h('option', { value: w, selected: w === (vorgabe.typ || 'lehrer') }, t)));
  const element = h('select', { class: 'eingabe', disabled: !!vorgabe.id, 'aria-label': 'Element' });
  const feld = h('input', { class: 'eingabe', id: 'km-feld', value: vorgabe.feld || '', placeholder: 'Optional, z. B. Wochensoll' });
  const kat = h('select', { class: 'eingabe', id: 'km-kategorie' }, kategorien.map((k) => h('option', { value: k.nr, selected: k.nr === (vorgabe.kategorie || 1) }, k.name)));
  const text = h('textarea', { class: 'eingabe', id: 'km-text', rows: 6 }, vorgabe.text || '');
  const fuellen = async () => {
    const liste = await elemente(typ.value);
    element.replaceChildren(...liste.map((e) => h('option', { value: e.id, selected: e.id === vorgabe.element }, e.l ? `${e.k} – ${e.l}` : e.k)));
  };
  typ.addEventListener('change', fuellen);
  await fuellen();
  const ok = await dialog({
    titel, breite: '520px',
    inhalt: h('div', { class: 'formular' }, h('label', null, 'Element'), h('div', { class: 'km-zeile' }, typ, element), h('label', { for: 'km-feld' }, 'Feld'), feld,
      h('label', { for: 'km-kategorie' }, 'Kategorie'), kat, h('label', { for: 'km-text' }, 'Kommentar'), text),
    knoepfe: [{ text: vorgabe.id ? 'Speichern' : 'Anlegen', wert: true, primaer: true }, { text: 'Abbrechen', wert: null }],
    pruefen: () => { text.classList.toggle('ungueltig', !text.value.trim()); return !!text.value.trim() && !!element.value; },
  });
  return ok ? { typ: typ.value, element: Number(element.value), feld: feld.value, kategorie: Number(kat.value), text: text.value } : null;
}

async function kommentarNeu(vorgabe = {}) {
  if (!zustand.dokument) return null;
  const e = await kommentarDialog(vorgabe, 'Kommentar anlegen');
  if (!e) return null;
  const liste = await api.post(api.dok('/kommentare'), e);
  hinweis('Kommentar angelegt.', 'ok', 2000);
  return liste;
}

function uebersicht(f) {
  f.titel('Kommentare');
  const schreiben = darfSchreiben();
  let alle = [];
  const tabelle = new Tabelle(f.inhalt, {
    zustandSchluessel: 'tabelle.kommentare',
    leerText: 'Es sind noch keine Kommentare erfasst.',
    beiDoppelklick: (z) => bearbeiten(z),
    beiEntf: () => loeschen(),
    spalten: [
      { schluessel: 'kategorieName', titel: 'Kategorie', breite: 120, farbe: (z) => (z.farbe ? `color-mix(in srgb, ${z.farbe} 35%, var(--up-flaeche))` : null) },
      { schluessel: 'typName', titel: 'Art', breite: 90 }, { schluessel: 'elementName', titel: 'Element', breite: 100 }, { schluessel: 'feld', titel: 'Feld', breite: 110 },
      { schluessel: 'text', titel: 'Kommentar', breite: 420 }, { schluessel: 'erstellt', titel: 'Erstellt', breite: 130 },
    ].map((s) => ({ ...s, art: 'NurLesen', editierbar: false })),
    kontextmenue: (zeilen) => [
      { text: 'Kommentar anlegen …', aktion: neu, deaktiviert: !schreiben },
      { text: 'Bearbeiten …', aktion: () => bearbeiten(zeilen[0]), deaktiviert: !zeilen.length || !schreiben },
      { text: 'Löschen', taste: 'Entf', aktion: loeschen, deaktiviert: !zeilen.length || !schreiben },
      null,
      { text: 'Element in den Stammdaten zeigen', aktion: () => elementZeigen(zeilen[0]), deaktiviert: !zeilen.length },
    ],
  });
  const elementZeigen = (z) => { if (z) fensterverwaltung.oeffnen('stammdaten', { typ: z.typ, element: z.element }); };
  if (schreiben) {
    f.werkzeug({ text: 'Neu', titel: 'Kommentar anlegen', aktion: neu });
    f.werkzeug({ text: 'Bearbeiten', titel: 'Markierten Kommentar bearbeiten (Doppelklick)', aktion: () => bearbeiten(tabelle.aktiveZeile()) });
    f.werkzeug({ text: 'Löschen', titel: 'Markierte Kommentare löschen (Entf)', aktion: loeschen });
    f.trenner();
  }
  f.werkzeug({ text: 'Element zeigen', titel: 'Element des Kommentars in den Stammdaten zeigen', aktion: () => elementZeigen(tabelle.aktiveZeile()) });
  let filter = '';
  const suche = h('input', { class: 'eingabe', type: 'search', placeholder: 'Kommentare durchsuchen', 'aria-label': 'Suchen', style: { width: '220px' } });
  const sucheFeld = werkzeugFeld(null, suche);
  sucheFeld.classList.add('rechts');
  f.werkzeuge.append(sucheFeld);
  const zeigen = () => {
    const l = filter ? alle.filter((z) => [z.kategorieName, z.typName, z.elementName, z.feld, z.text].some((w) => String(w ?? '').toLowerCase().includes(filter))) : alle;
    tabelle.daten(l);
    f.fuss.replaceChildren(...[h('span', null, `${alle.length} ${alle.length === 1 ? 'Kommentar' : 'Kommentare'}`), filter ? h('span', null, `${l.length} angezeigt`) : null].filter(Boolean));
  };
  suche.addEventListener('input', () => { filter = suche.value.trim().toLowerCase(); zeigen(); });
  const anzeigen = (liste) => { alle = liste; zeigen(); };
  async function neu() { const l = await kommentarNeu(); if (l) anzeigen(l); }
  async function bearbeiten(z) {
    if (!z || !schreiben) return;
    const e = await kommentarDialog(z, 'Kommentar bearbeiten');
    if (e) anzeigen(await api.put(api.dok(`/kommentare/${z.id}`), e, { quelle: f.id }));
  }
  async function loeschen() {
    const ids = tabelle.ausgewaehlte().map((z) => z.id);
    if (!ids.length || !schreiben || !(await frage(ids.length === 1 ? 'Kommentar löschen?' : `${ids.length} Kommentare löschen?`, { ja: 'Löschen', gefahr: true }))) return;
    anzeigen(await api.post(api.dok('/kommentare/loeschen'), { ids }, { quelle: f.id }));
  }
  const laden_ = () => api.get(api.dok('/kommentare')).then(anzeigen).catch(fehlerMelden);
  f.an('daten', (e) => { if (e.quelle !== f.id && betrifft(e, 'Stammdaten')) laden_(); });
  laden_();
}

export default {
  id: 'kommentare',
  css: ['css/module/planung.css'],
  fenster: { kommentare: { titel: 'Kommentare', symbol: 'info', breite: 860, hoehe: 360, einzig: () => 'komm', erstellen: uebersicht } },
  befehle: {
    'kommentare.oeffnen': () => { if (zustand.dokument) fensterverwaltung.oeffnen('kommentare', {}); },
    'kommentare.neu': (a) => kommentarNeu(a),
  },
  ribbon: [
    { id: 'eingabe.kommentare', reiter: 'Dateneingabe', gruppe: 'Hilfsmittel', text: 'Kommentare', symbol: 'info', befehl: 'kommentare.oeffnen', braucht: 'dokument', hinweis: 'Alle Kommentare zu den Stammdaten' },
  ],
};
