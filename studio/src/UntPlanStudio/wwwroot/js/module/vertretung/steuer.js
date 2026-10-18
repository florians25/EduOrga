// Steuerelemente der Vertretungsplanung: Zeitraum (Tag / Woche / frei), Filterleiste (Beschriftung + Feld, Schalter),
// Menüknopf „Weitere Aktionen“, Textreiter mit Anzahlen, einfache Listen-Tabelle für Ansichten mit eigener Darstellung
// (Vorschlag, Bereitschaften, Kalender).
import { h, leeren } from '../../kern/dom.js';
import { symbol } from '../../kern/symbole.js';
import { an } from '../../kern/ereignisse.js';
import { menue } from '../../kern/dialog.js';
import { planungsdatum, montag, plusTage, datumSetzen } from './kern.js';

/**
 * Zeitraumauswahl. art: 'tag' (folgt dem Planungsdatum), 'woche' (Woche des Planungsdatums), 'vonbis' (frei).
 * beiAenderung(von, bis, art) wird bei jeder Änderung gerufen. Liefert { el, von, bis, art, setzen(von,bis,art) }.
 */
export function zeitraumAuswahl(f, { art = 'tag', beiAenderung, tageProWoche = 5 }) {
  const wahl = h('select', { class: 'eingabe vt-zr-art', title: 'Zeitraum' },
    h('option', { value: 'tag' }, 'Tag'), h('option', { value: 'woche' }, 'Woche'), h('option', { value: 'vonbis' }, 'Zeitraum'));
  const von = h('input', { class: 'eingabe', type: 'date', title: 'Von' });
  const bis = h('input', { class: 'eingabe vt-zr-bis', type: 'date', title: 'Bis' });
  const zurueck = h('button', { class: 'vt-pfeil', type: 'button', title: 'Zurück' }, symbol('pfeil_links'));
  const vor = h('button', { class: 'vt-pfeil', type: 'button', title: 'Weiter' }, symbol('pfeil_rechts'));
  const el = h('span', { class: 'vt-zeitraum' }, wahl, h('span', { class: 'vt-zr-datum' }, zurueck, von, vor), h('span', { class: 'vt-bis' }, 'bis'), bis);
  const z = { el, von: null, bis: null, art };
  const anwenden = (melden = true) => {
    wahl.value = z.art;
    von.value = z.von || '';
    bis.value = z.bis || '';
    bis.disabled = z.art !== 'vonbis';
    el.classList.toggle('ein-tag', z.art === 'tag');
    if (melden) beiAenderung?.(z.von, z.bis, z.art);
  };
  z.setzen = (v, b, a = z.art, melden = true) => {
    z.art = a;
    if (a === 'tag') { z.von = v; z.bis = v; } else if (a === 'woche') { z.von = montag(v); z.bis = plusTage(z.von, tageProWoche - 1); } else { z.von = v; z.bis = b && b >= v ? b : v; }
    anwenden(melden);
  };
  wahl.addEventListener('change', () => z.setzen(z.von || planungsdatum(), z.bis, wahl.value));
  von.addEventListener('change', () => {
    if (!von.value) return;
    if (z.art === 'tag') datumSetzen(von.value); else z.setzen(von.value, bis.value);
  });
  bis.addEventListener('change', () => { if (bis.value) z.setzen(z.von, bis.value); });
  const schritt = (r) => {
    if (z.art === 'tag') return import('./kern.js').then((k) => k.blaettern(r));
    const n = z.art === 'woche' ? 7 : Math.max(1, (new Date(z.bis) - new Date(z.von)) / 864e5 + 1);
    z.setzen(plusTage(z.von, r * n), plusTage(z.bis, r * n));
    return null;
  };
  zurueck.addEventListener('click', () => schritt(-1));
  vor.addEventListener('click', () => schritt(1));
  f.an('vertretung.datum', (d) => { if (z.art !== 'vonbis') z.setzen(d, d); });
  z.setzen(planungsdatum(), planungsdatum(), art, false);
  return z;
}

/** Filterleiste über einer Liste: Gruppen aus Beschriftung und Feld(ern) in einer Zeile. */
export function filterleiste(...gruppen) { return h('div', { class: 'vt-kopf' }, ...gruppen); }

/** Gruppe der Filterleiste: Beschriftung links, Felder rechts daneben. */
export function filterGruppe(titel, ...felder) {
  return h('span', { class: 'vt-gruppe' }, titel ? h('span', { class: 'vt-gtitel' }, titel) : null, ...felder);
}

/** Kontrollkästchen als Schalter mit Text. Liefert das Label; das Eingabefeld hängt als .eingabe daran. */
export function schalter(text, { checked = false, titel, disabled = false, klasse = '' } = {}) {
  const input = h('input', { type: 'checkbox', role: 'switch', checked, disabled });
  const el = h('label', { class: `vt-schalter${klasse ? ` ${klasse}` : ''}`, title: titel || null }, input, h('span', null, text));
  el.eingabe = input;
  return el;
}

/** Textknopf der Werkzeugleiste, der ein Menü öffnet (z. B. „Weitere Aktionen“). eintraege: Array oder Funktion. */
export function menueKnopf(f, text, eintraege, titel) {
  const k = f.werkzeug({ text, titel: titel || text, aktion: async () => {
    const r = k.getBoundingClientRect();
    const liste = typeof eintraege === 'function' ? await eintraege() : eintraege;
    menue(r.left, r.bottom + 4, liste.map((e) => (e && e.symbol ? { ...e, symbol: undefined } : e)));
  } });
  k.classList.add('vt-menueknopf');
  k.setAttribute('aria-haspopup', 'menu');
  k.append(h('span', { class: 'vt-chevron' }, symbol('pfeil_runter')));
  return k;
}

/** Schalter in der Werkzeugleiste (statt eines gedrückten Symbolknopfs). beiAenderung(wert). */
export function werkzeugSchalter(f, text, { checked = false, titel, beiAenderung } = {}) {
  const s = schalter(text, { checked, titel, klasse: 'vt-wz-schalter' });
  s.eingabe.addEventListener('change', () => beiAenderung?.(s.eingabe.checked));
  f.werkzeuge.append(s);
  return s;
}

/** Textreiter mit 2-px-Unterstrich. texte: Array; beiWahl(index). */
export function reiter(texte, beiWahl, aktiv = 0) {
  const el = h('div', { class: 'vt-reiter', role: 'tablist' });
  let index = aktiv;
  const knoepfe = texte.map((t, i) => {
    const k = h('button', { type: 'button', role: 'tab', class: i === aktiv ? 'aktiv' : '' }, t);
    k.addEventListener('click', () => r.waehlen(i));
    el.append(k);
    return k;
  });
  const r = {
    el,
    get index() { return index; },
    waehlen(i, melden = true) {
      index = i;
      knoepfe.forEach((k, j) => k.classList.toggle('aktiv', j === i));
      if (melden) beiWahl?.(i);
    },
    texte(neu) { neu.forEach((t, i) => { if (knoepfe[i]) knoepfe[i].textContent = t; }); },
  };
  return r;
}

/**
 * Einfache Listen-Tabelle mit fester Kopfzeile, Zeilenauswahl (Pfeiltasten, Klick), Doppelklick/Enter und Kontextmenü.
 * spalten: [{ titel, breite, klasse, wert(z) → string|Node, zelle(z, td) }].
 */
export function listenTabelle(eltern, { spalten, beiWahl, beiDoppelklick, kontextmenue, leerText = 'Keine Einträge', zeilenKlasse }) {
  const zahl = (s) => /(^|\s)rechts(\s|$)/.test(s.klasse || '');
  const kopf = h('tr', null, spalten.map((s) => h('th', { class: zahl(s) ? 'rechts' : /mitte/.test(s.klasse || '') ? 'mitte' : null, style: s.breite ? { width: `${s.breite}px` } : null, title: s.hinweis || s.titel }, s.titel)));
  const koerper = h('tbody');
  const leer = h('div', { class: 'vt-leer' });
  const el = h('div', { class: 'vt-tabelle', tabindex: '0' }, h('table', null, h('thead', null, kopf), koerper), leer);
  eltern.append(el);
  let zeilen = [];
  let aktiv = -1;
  const t = {
    el,
    get zeilen() { return zeilen; },
    get aktiv() { return zeilen[aktiv] ?? null; },
    get index() { return aktiv; },
    setzen(liste, behalteIndex = false) {
      zeilen = liste || [];
      leeren(koerper);
      zeilen.forEach((z, i) => {
        const tr = h('tr', { class: zeilenKlasse?.(z) || '' });
        for (const s of spalten) {
          const td = h('td', { class: s.klasse || '' });
          const w = s.wert ? s.wert(z) : z[s.schluessel];
          if (w instanceof Node) td.append(w); else td.textContent = w ?? '';
          s.zelle?.(z, td);
          tr.append(td);
        }
        tr.addEventListener('pointerdown', () => t.waehlen(i));
        tr.addEventListener('dblclick', () => beiDoppelklick?.(z));
        tr.addEventListener('contextmenu', (e) => {
          if (!kontextmenue) return;
          e.preventDefault();
          t.waehlen(i);
          kontextmenue(z, e);
        });
        koerper.append(tr);
      });
      leer.textContent = zeilen.length ? '' : leerText;
      aktiv = behalteIndex ? Math.min(aktiv, zeilen.length - 1) : (zeilen.length ? 0 : -1);
      t._markieren();
    },
    waehlen(i) {
      if (i < 0 || i >= zeilen.length) return;
      aktiv = i;
      t._markieren();
      koerper.children[i]?.scrollIntoView({ block: 'nearest' });
      beiWahl?.(zeilen[i]);
    },
    _markieren() { [...koerper.children].forEach((tr, i) => tr.classList.toggle('aktiv', i === aktiv)); },
  };
  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { t.waehlen(Math.min(zeilen.length - 1, aktiv + 1)); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { t.waehlen(Math.max(0, aktiv - 1)); e.preventDefault(); }
    else if (e.key === 'Enter' && t.aktiv) { beiDoppelklick?.(t.aktiv); e.preventDefault(); }
  });
  return t;
}

/** Ein Ereignis nur einmal je Fenster anmelden (Hilfe für Module, die mehrere Ereignisse gleich behandeln). */
export function anMehrere(f, namen, fn) { for (const n of namen) f.an(n, fn); }

export { an };
