// Modul „Zeitwünsche“: Raster-Editor für die Zeitwünsche von Klassen, Lehrkräften, Räumen, Fächern und Unterrichten
// (+3 unbedingt Unterricht … −3 unbedingt frei, Farben). Wert wählen und Stunden mit gedrückter Maustaste (oder dem
// Finger) überstreichen; Klick auf „Ganzer Tag“/„Vormittag“/„Nachmittag“ setzt den ganzen (Halb-)Tag.
// Darunter die Zeitwünsche ohne feste Lage (z. B. „1 Tag unbedingt frei“).
import { h, leeren } from '../kern/dom.js';
import { symbol } from '../kern/symbole.js';
import { api } from '../kern/api.js';
import { zustand, darfSchreiben } from '../kern/zustand.js';
import { betrifft, melden } from '../kern/ereignisse.js';
import { fehlerMelden, frage, laden } from '../kern/dialog.js';
import { fensterverwaltung } from '../kern/fenster.js';
import { befehl } from '../kern/modulsystem.js';
import { werkzeugFeld, schalter, weitereAktionen } from './unterricht.js';

export const TYPEN = { klasse: 'Klasse', lehrer: 'Lehrkraft', raum: 'Raum', fach: 'Fach', unterricht: 'Unterricht' };
const WERTE = [3, 2, 1, 0, -1, -2, -3];
const TEXT = {
  3: '+3 unbedingt Unterricht (Kernzeit)', 2: '+2 möglichst Unterricht', 1: '+1 eher Unterricht', 0: '0 kein Wunsch',
  '-1': '−1 eher frei', '-2': '−2 möglichst frei', '-3': '−3 unbedingt frei (gesperrt)',
};
const UNBESTIMMT = [[-3, 'Unbedingt frei (−3)'], [-2, 'Möglichst frei (−2)'], [-1, 'Eher frei (−1)']];
const BEREICHE = [['Tage', 'Ganze Tage'], ['Vormittage', 'Vormittage'], ['Nachmittage', 'Nachmittage']];
const zeichenText = (w) => (w > 0 ? `+${w}` : w < 0 ? `−${-w}` : '0');
const wertText = (w) => (w === 0 ? '' : zeichenText(w));

function zeitwunschFenster(f, p) {
  let typ = TYPEN[p.typ] ? p.typ : 'lehrer';
  let element = p.element ?? null;
  let wert = Number.isInteger(p.wert) ? p.wert : -3;
  let verknuepft = p.verknuepft !== false;
  let daten = null;
  let liste = [];
  const schreiben = darfSchreiben();

  // ---- Werkzeugleiste: Art · Element ‹ › | Wert +3 … −3 | Stundenplan · Weitere Aktionen | Auswahl folgen ----
  const typWahl = h('select', { class: 'eingabe zw-typ', 'aria-label': 'Art' }, Object.entries(TYPEN).map(([k, t]) => h('option', { value: k, selected: k === typ }, t)));
  const elWahl = h('select', { class: 'eingabe zw-element', 'aria-label': 'Element' });
  const blaettern = (d) => {
    const i = liste.findIndex((e) => e.id === element);
    const n = liste[Math.max(0, Math.min(liste.length - 1, i + d))];
    if (n && n.id !== element) setzen(typ, n.id);
  };
  elWahl.addEventListener('keydown', (e) => { if (e.key === 'PageUp' || e.key === 'PageDown') { e.preventDefault(); blaettern(e.key === 'PageUp' ? -1 : 1); } });
  f.werkzeuge.append(werkzeugFeld(null, typWahl, h('span', { class: 'pl-elementwahl' },
    h('button', { class: 'wz-knopf nur-symbol', type: 'button', title: 'Vorheriges Element (Bild auf)', 'aria-label': 'Vorheriges Element', onclick: () => blaettern(-1) }, symbol('pfeil_links')), elWahl,
    h('button', { class: 'wz-knopf nur-symbol', type: 'button', title: 'Nächstes Element (Bild ab)', 'aria-label': 'Nächstes Element', onclick: () => blaettern(1) }, symbol('pfeil_rechts')))));
  f.trenner();
  const wertGruppe = h('span', { class: 'zw-werte', role: 'radiogroup', 'aria-label': 'Wert zum Eintragen' });
  const wertKnoepfe = WERTE.map((w) => {
    const k = h('button', { class: `wz-knopf zw-wert zw-w${w}`, type: 'button', role: 'radio', title: TEXT[w], disabled: !schreiben, dataset: { wert: w } }, zeichenText(w));
    k.addEventListener('click', () => wertWaehlen(w));
    wertGruppe.append(k);
    return k;
  });
  f.werkzeuge.append(werkzeugFeld('Wert', wertGruppe));
  f.trenner();
  f.werkzeug({ text: 'Stundenplan', titel: 'Stundenplan des Elements', aktion: () => {
    if (typ !== 'unterricht' && element) befehl('stundenplan.oeffnen', { typ, element });
  } });
  weitereAktionen(f, () => [
    { text: 'Alle Zeitwünsche des Elements löschen …', deaktiviert: !schreiben || !daten?.anzahl, aktion: async () => {
      if (!daten?.anzahl || !(await frage(`Alle Zeitwünsche von ${daten.element.kurz} löschen?`, { ja: 'Löschen', gefahr: true }))) return;
      await speichern({ alleLoeschen: true });
    } },
  ]);
  const sw = schalter('Auswahl folgen', verknuepft, (an) => { verknuepft = an; f.parameterSetzen({ verknuepft }); }, 'Zeigt das Element, das in einer anderen Ansicht gewählt wird');
  sw.classList.add('rechts');
  f.werkzeuge.append(sw);

  // ---- Inhalt ----
  const name = h('div', { class: 'zw-name' });
  const raster = h('div', { class: 'zw-raster', tabindex: '0' });
  const hilfe = h('p', { class: 'zw-hilfe' }, 'Wert wählen und die Stunden mit gedrückter Maustaste überstreichen. „Ganzer Tag“, „Vormittag“ und „Nachmittag“ setzen den ganzen Bereich. Tasten 3, 2, 1, 0 und Umschalt+1, 2, 3 (für −1, −2, −3) wählen den Wert.');
  const unbestimmtBox = h('div', { class: 'zw-unbestimmt' });
  f.inhalt.append(h('div', { class: 'zw-flaeche' }, name, raster, hilfe, unbestimmtBox));

  function wertWaehlen(w) {
    wert = w;
    for (const k of wertKnoepfe) { k.classList.toggle('gedrueckt', Number(k.dataset.wert) === w); k.setAttribute('aria-checked', String(Number(k.dataset.wert) === w)); }
    f.parameterSetzen({ wert });
    const r = f.fuss.querySelector('.rechts');
    if (r) r.textContent = `Gewählter Wert: ${TEXT[w]}`;
  }

  // ---- Malen ----
  let malen = null; // { werte: Map("t:s" → w) }
  function zelleSetzen(td, w, verfuegbar) {
    td.textContent = wertText(w);
    td.className = `zw-zelle zw-w${w}${verfuegbar ? '' : ' zw-aus'}`;
  }
  function stundenVon(spalte) {
    const n = daten.stunden.length;
    if (spalte < n) return [daten.stunden[spalte].nr];
    if (spalte === n) return daten.stunden.map((s) => s.nr);
    if (spalte === n + 1) return daten.stunden.filter((s) => s.vormittag).map((s) => s.nr);
    return daten.stunden.filter((s) => !s.vormittag).map((s) => s.nr);
  }
  function malenAuf(td) {
    if (!malen || !td?.dataset?.tag) return;
    const t = Number(td.dataset.tag);
    for (const s of stundenVon(Number(td.dataset.spalte))) {
      malen.werte.set(`${t}:${s}`, wert);
      const z = raster.querySelector(`td[data-tag="${t}"][data-spalte="${daten.stunden.findIndex((x) => x.nr === s)}"]`);
      if (z) zelleSetzen(z, wert, daten.verfuegbar[t][s - 1]);
    }
  }
  raster.addEventListener('pointerdown', (e) => {
    const td = e.target.closest('td[data-tag]');
    if (!td || !schreiben || e.button !== 0) return;
    e.preventDefault();
    raster.focus({ preventScroll: true });
    malen = { werte: new Map() };
    raster.setPointerCapture(e.pointerId);
    malenAuf(td);
  });
  raster.addEventListener('pointermove', (e) => {
    if (!malen) return;
    malenAuf(document.elementFromPoint(e.clientX, e.clientY)?.closest?.('td[data-tag]'));
  });
  const malenEnde = () => {
    if (!malen) return;
    const aenderungen = [...malen.werte].map(([k, w]) => { const [tag, stunde] = k.split(':').map(Number); return { tag, stunde, wert: w }; })
      .filter((a) => daten.werte[a.tag][a.stunde - 1] !== a.wert);
    malen = null;
    if (aenderungen.length) speichern({ aenderungen }).catch((e) => { fehlerMelden(e); neu(); });
  };
  raster.addEventListener('pointerup', malenEnde);
  raster.addEventListener('pointercancel', malenEnde);
  raster.addEventListener('keydown', (e) => {
    const m = /^(?:Digit|Numpad)([0-3])$/.exec(e.code || '');
    if (!m || !schreiben || e.ctrlKey || e.metaKey || e.altKey) return;
    const n = Number(m[1]);
    wertWaehlen(e.shiftKey && n ? -n : n);
    e.preventDefault();
  });

  function zeichnen() {
    const d = daten;
    name.replaceChildren(...(d ? [h('h3', null, `${TYPEN[typ]} ${d.element.kurz}`), d.element.lang ? h('span', { class: 'leise' }, d.element.lang) : null].filter(Boolean) : []));
    f.titel(`Zeitwünsche / ${TYPEN[typ]}${d ? ` ${d.element.kurz}` : ''}`);
    leeren(raster);
    if (!d) { raster.append(h('div', { class: 'pl-leer' }, 'Für diese Art sind keine Elemente vorhanden.')); return; }
    const ersteNachmittag = d.stunden.findIndex((s) => !s.vormittag);
    const kopf = h('tr', null, h('th', { class: 'zw-ecke' }),
      d.stunden.map((s, j) => h('th', { class: `${s.vormittag ? 'zw-vm' : 'zw-nm'}${j === ersteNachmittag ? ' zw-grenze' : ''}`, title: s.vormittag ? 'Vormittag' : 'Nachmittag' }, s.label)),
      ['Ganzer Tag', 'Vormittag', 'Nachmittag'].map((t, i) => h('th', { class: `zw-ganz${i === 0 ? ' zw-grenze-ganz' : ''}` }, t)));
    const rumpf = h('tbody');
    d.tage.forEach((t) => {
      const tr = h('tr', null, h('th', { class: 'zw-tag' }, t.lang));
      d.stunden.forEach((s, j) => {
        const td = h('td', { dataset: { tag: t.nr, spalte: j }, title: `${t.lang}, ${s.label}. Stunde` });
        zelleSetzen(td, d.werte[t.nr][s.nr - 1], d.verfuegbar[t.nr][s.nr - 1]);
        if (j === ersteNachmittag) td.dataset.grenze = '1';
        tr.append(td);
      });
      ['Ganzen Tag', 'Vormittag', 'Nachmittag'].forEach((x, i) => tr.append(h('td', { class: `zw-zelle zw-ganzzelle${i === 0 ? ' zw-grenze-ganz' : ''}`, dataset: { tag: t.nr, spalte: d.stunden.length + i }, title: `${x} auf den gewählten Wert setzen` })));
      rumpf.append(tr);
    });
    raster.append(h('table', { class: 'zw-tabelle' }, h('thead', null, kopf), rumpf));
    unbestimmtZeichnen();
    f.fuss.replaceChildren(h('span', null, `${d.anzahl} Stunden mit Zeitwunsch`), h('span', { class: 'rechts' }, `Gewählter Wert: ${TEXT[wert]}`));
  }

  // ---- unbestimmte Zeitwünsche ----
  function unbestimmtZeichnen() {
    leeren(unbestimmtBox);
    if (!daten?.unbestimmte) { unbestimmtBox.hidden = true; return; }
    unbestimmtBox.hidden = false;
    const zeilen = daten.unbestimmte.map((u) => ({ ...u }));
    const tbody = h('tbody');
    const speichernU = () => api.put(api.dok(`/zeitwuensche/${typ}/${element}/unbestimmte`), { liste: zeilen.map(({ bereich, anzahl, wunsch }) => ({ bereich, anzahl, wunsch })) }, { quelle: f.id })
      .then((d) => { daten = d; zeichnen(); }).catch((e) => { fehlerMelden(e); neu(); });
    zeilen.forEach((u, i) => {
      const bereich = h('select', { class: 'eingabe', disabled: !schreiben, 'aria-label': 'Bereich' }, BEREICHE.map(([b, t]) => h('option', { value: b, selected: b === u.bereich }, t)));
      const anzahl = h('input', { class: 'eingabe zw-anzahl', type: 'number', min: 1, max: 7, value: u.anzahl, disabled: !schreiben, 'aria-label': 'Anzahl' });
      const wunsch = h('select', { class: 'eingabe', disabled: !schreiben, 'aria-label': 'Zeitwunsch' }, UNBESTIMMT.map(([w, t]) => h('option', { value: w, selected: w === u.wunsch }, t)));
      bereich.addEventListener('change', () => { u.bereich = bereich.value; speichernU(); });
      anzahl.addEventListener('change', () => { u.anzahl = Math.max(1, Math.min(7, Number(anzahl.value) || 1)); speichernU(); });
      wunsch.addEventListener('change', () => { u.wunsch = Number(wunsch.value); speichernU(); });
      tbody.append(h('tr', null, h('td', null, anzahl), h('td', null, bereich), h('td', null, wunsch),
        h('td', { class: 'zw-aktion' }, schreiben ? h('button', { class: 'knopf still klein zw-weg', type: 'button', title: 'Zeile entfernen', 'aria-label': 'Zeile entfernen', onclick: () => { zeilen.splice(i, 1); speichernU(); } }, symbol('schliessen')) : null)));
    });
    unbestimmtBox.append(h('div', { class: 'pl-abschnitt-kopf' }, h('h3', null, 'Zeitwünsche ohne feste Lage'),
      schreiben ? h('button', { class: 'knopf klein', type: 'button', onclick: () => { zeilen.push({ bereich: 'Tage', anzahl: 1, wunsch: -3 }); speichernU(); } }, 'Hinzufügen') : null),
    h('p', { class: 'zw-hilfe' }, 'Freie Tage oder Halbtage, deren Lage die Planung bestimmt – z. B. „1 ganzer Tag unbedingt frei“.'),
    zeilen.length ? h('table', { class: 'pl-tabelle zw-utabelle' }, h('thead', null, h('tr', null, h('th', null, 'Anzahl'), h('th', null, 'Bereich'), h('th', null, 'Zeitwunsch'), h('th', null, ''))), tbody)
      : h('p', { class: 'zw-uleer' }, 'Keine Zeitwünsche ohne feste Lage erfasst.'));
  }

  // ---- Laden/Speichern ----
  const optionText = (e, mitWunsch) => `${typ === 'unterricht' ? `${e.k} ${e.l}` : e.l ? `${e.k} – ${e.l}` : e.k}${mitWunsch ? ' · mit Zeitwünschen' : ''}`;
  async function listeLaden() {
    liste = await api.get(api.dok(`/zeitwuensche/${typ}`));
    leeren(elWahl).append(...liste.map((e) => h('option', { value: e.id }, optionText(e, !!(e.n || e.f)))));
    if (!liste.some((e) => e.id === element)) element = liste[0]?.id ?? null;
    if (element !== null) elWahl.value = String(element);
  }

  async function neu() {
    if (element === null) { daten = null; zeichnen(); return; }
    const weg = laden(f.inhalt);
    try { daten = await api.get(api.dok(`/zeitwuensche/${typ}/${element}`)); zeichnen(); } finally { weg(); }
  }

  async function speichern(aenderung) {
    daten = await api.put(api.dok(`/zeitwuensche/${typ}/${element}`), aenderung, { quelle: f.id });
    zeichnen();
    const eintrag = liste.find((e) => e.id === element);
    if (eintrag && Boolean(eintrag.n) !== Boolean(daten.anzahl)) { eintrag.n = daten.anzahl; const opt = elWahl.querySelector(`option[value="${element}"]`); if (opt) opt.textContent = optionText(eintrag, !!(daten.anzahl || eintrag.f)); }
  }

  async function setzen(t, id, { melde = true } = {}) {
    const typWechsel = t !== typ;
    typ = t;
    element = id ?? null;
    typWahl.value = typ;
    if (typWechsel || !liste.length) await listeLaden();
    else if (element !== null) elWahl.value = String(element);
    f.parameterSetzen({ typ, element });
    await neu();
    if (melde && element !== null && typ !== 'unterricht') melden('element', { typ, id: element, quelle: f.id });
  }

  typWahl.addEventListener('change', () => setzen(typWahl.value, null).catch(fehlerMelden));
  elWahl.addEventListener('change', () => setzen(typ, Number(elWahl.value)).catch(fehlerMelden));
  f.an('element', (e) => { if (verknuepft && e.quelle !== f.id && TYPEN[e.typ] && (e.typ !== typ || e.id !== element)) setzen(e.typ, e.id, { melde: false }).catch(() => {}); });
  f.an('daten', (e) => {
    if (e.quelle === f.id) return;
    if (betrifft(e, 'Stammdaten', 'Unterricht', 'Einstellungen')) listeLaden().then(neu).catch(() => {});
  });
  f.an('grunddaten', () => neu().catch(() => {}));
  f._setzen = (t, id) => setzen(t, id, { melde: false });

  wertWaehlen(wert);
  return (async () => { await listeLaden(); f.parameterSetzen({ typ, element }); await neu(); })();
}

const oeffnen = ({ typ = 'lehrer', element } = {}) => {
  if (!zustand.dokument) return null;
  const f = fensterverwaltung.oeffnen('zeitwuensche', { typ, element });
  return f;
};

export default {
  id: 'zeitwuensche',
  css: ['css/module/zeitwuensche.css', 'css/module/planung.css'],
  fenster: {
    zeitwuensche: {
      titel: 'Zeitwünsche', symbol: 'zeitwunsch', breite: 720, hoehe: 440,
      einzig: () => 'zeitwuensche',
      erneutGeoeffnet: (f, p) => { if (p?.typ) f._setzen?.(p.typ, p.element ?? null)?.catch?.(fehlerMelden); },
      erstellen: zeitwunschFenster,
    },
  },
  befehle: { 'zeitwuensche.oeffnen': oeffnen },
  ribbon: [
    { id: 'eingabe.zeitwuensche', reiter: 'Dateneingabe', gruppe: 'Zeit', text: 'Zeitwünsche', symbol: 'zeitwunsch', gross: true, befehl: 'zeitwuensche.oeffnen', args: { typ: 'lehrer' }, braucht: 'dokument',
      hinweis: 'Zeitwünsche der Lehrkräfte, Klassen, Räume und Fächer (+3 … −3)' },
    { id: 'planung.uzeitwuensche', reiter: 'Planung', gruppe: 'Werkzeuge', text: 'Unterrichtszeitwünsche', symbol: 'zeitwunsch', befehl: 'zeitwuensche.oeffnen', args: { typ: 'unterricht' }, braucht: 'dokument' },
  ],
};

