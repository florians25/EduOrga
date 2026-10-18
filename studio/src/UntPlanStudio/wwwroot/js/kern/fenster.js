// Seitenverwaltung: Studio zeigt immer genau eine Seite. Eine Seite besteht aus einer Ansicht (Fenstertyp eines Moduls)
// oder – bei Arbeitsplätzen wie der Tagesplanung der Vertretung – aus mehreren fest angeordneten Bereichen.
//
//   * Aufruf aus der Navigation, der Befehlssuche oder der Übersicht → neue Seite (Adresse in der URL, Zurück-Taste).
//   * Aufruf aus einer Ansicht heraus (z. B. „Unterricht“ im Stundenplan) → Nebenbereich rechts auf derselben Seite.
//   * Aufruf mit lage (andock links/rechts/lo/lu/ro/ru bzw. x/y/b/h) → Bereich eines Arbeitsplatzes (Spalten und Zeilen).
//
// Fenstertypen registrieren die Module (siehe modulsystem.js):
//   { titel, symbol, symbolFuer(parameter), einzig(parameter) → Schlüssel|null, erneutGeoeffnet(fenster, parameter), erstellen(fenster, parameter) }
// Die API der Ansichten (f.titel, f.werkzeug, f.inhalt, f.fuss, f.an …) heißt aus historischen Gründen „Fenster“.
import { h, leeren, entprellen } from './dom.js';
import { symbol } from './symbole.js';
import { an, melden } from './ereignisse.js';
import { fehlerMelden } from './dialog.js';

const typen = new Map();
const fenster = [];
let flaeche = null, kopf = null;
let zaehler = 0;
let aenderungMelden = () => {};

/** Spalten der Seite: [{ id, anteil, x, zeilen: [Bereich] }] (anteil in Pixeln, relativ zueinander). */
let spalten = [];
let aktiverBereich = null;
let seitentitel = null;
let seitenwechselBis = 0;
let geschichteAus = false;

export function fenstertypRegistrieren(name, def) {
  typen.set(name, def);
}

export function fenstertyp(name) { return typen.get(name); }

/** Titel vereinheitlichen: „Element / Art“ → „Element – Art“, doppelte Langnamen („Klasse 5a (Klasse 5a)“) kürzen. */
function titelFormen(t) {
  const m = String(t).match(/^(.*) \/ (.*)$/);
  if (m) t = m[2] === 'Stammdaten' ? m[1] : `${m[1]} – ${m[2]}`;
  return t.replace(/^(\S+) (\S+) \(\1 \2\)/, '$1 $2');
}

// ---------------------------------------------------------------------------------------------
// Bereich: eine Ansicht mit schmaler Kopfzeile (nur auf Seiten mit mehreren Bereichen sichtbar)

class Bereich {
  constructor({ anteil, y } = {}) {
    this.id = `b${++zaehler}`;
    this.anteil = anteil || 1000;
    this.y = y ?? null;
    this.ansicht = null;
    this.titel = h('span', { class: 'pn-titel' });
    this.aktionen = h('div', { class: 'pn-aktionen' },
      h('button', { type: 'button', class: 'pn-knopf', title: 'Als eigene Seite öffnen', onclick: () => this.alsSeite() }, 'Öffnen'),
      h('button', { type: 'button', class: 'pn-knopf zu', title: 'Bereich schließen', 'aria-label': 'Bereich schließen', onclick: () => this.ansicht?.schliessen() }, symbol('schliessen')));
    this.kopf = h('div', { class: 'pn-kopf' }, this.titel, this.aktionen);
    this.ansichten = h('div', { class: 'pn-inhalt' });
    this.el = h('section', { class: 'pn-bereich', dataset: { bereich: this.id } }, this.kopf, this.ansichten);
    this.el.addEventListener('pointerdown', () => bereichAktivieren(this), true);
  }

  aufnehmen(f) {
    if (this.ansicht && this.ansicht !== f) this.ansicht.schliessen(true);
    if (f.bereich && f.bereich !== this) f.bereich.abgeben(f);
    f.bereich = this;
    this.ansicht = f;
    this.ansichten.append(f.el);
    this.titelZeigen();
  }

  abgeben(f) {
    if (this.ansicht !== f) return;
    if (f.el.parentNode === this.ansichten) f.el.remove();
    f.bereich = null;
    this.ansicht = null;
    bereichEntfernen(this);
  }

  titelZeigen() { this.titel.textContent = this.ansicht?.titelText || ''; }

  /** Ansicht dieses Bereichs als eigene Seite öffnen. */
  alsSeite() {
    const f = this.ansicht;
    if (!f) return;
    const typ = f.typ, p = { ...f.parameter };
    fensterverwaltung.seiteOeffnen(typ, p);
  }
}

function alleBereiche() { return spalten.flatMap((s) => s.zeilen); }

function spalteVon(b) { return spalten.find((s) => s.zeilen.includes(b)); }

function bereichAktivieren(b) {
  if (!b || aktiverBereich === b) return;
  aktiverBereich = b;
  for (const x of alleBereiche()) x.el.classList.toggle('aktiv', x === b);
  if (b.ansicht) melden('fenster-aktiv', b.ansicht);
}

/** Neuen Bereich neben b anlegen: 'rechts'/'links' = neue Spalte, 'unten'/'oben' = neue Zeile in der Spalte von b. */
function neuerBereichNeben(b, richtung, anteilNeu) {
  const s = spalteVon(b);
  if (richtung === 'rechts' || richtung === 'links') {
    const anteil = anteilNeu ?? s.anteil * 0.8;
    if (anteilNeu === undefined) s.anteil = s.anteil * 1.2;
    const neu = new Bereich();
    const i = spalten.indexOf(s);
    spalten.splice(richtung === 'rechts' ? i + 1 : i, 0, { id: `s${++zaehler}`, anteil, x: null, zeilen: [neu] });
    return neu;
  }
  const anteil = b.anteil / 2;
  b.anteil = anteil;
  const neu = new Bereich({ anteil });
  const i = s.zeilen.indexOf(b);
  s.zeilen.splice(richtung === 'unten' ? i + 1 : i, 0, neu);
  return neu;
}

function bereichEntfernen(b) {
  const s = spalteVon(b);
  if (!s) return;
  const i = s.zeilen.indexOf(b);
  s.zeilen.splice(i, 1);
  b.el.remove();
  if (s.zeilen.length) (s.zeilen[i] || s.zeilen[i - 1]).anteil += b.anteil;
  else {
    const j = spalten.indexOf(s);
    spalten.splice(j, 1);
    if (spalten.length) (spalten[j] || spalten[j - 1]).anteil += s.anteil;
  }
  if (aktiverBereich === b) {
    aktiverBereich = null;
    bereichAktivieren(alleBereiche()[0]);
  }
  if (alleBereiche().length <= 1) seitentitel = null;
  layoutZeichnen();
}

/** Bereich für eine Ansicht mit Lageangabe (Arbeitsplätze, gespeicherte Anordnungen). */
function bereichFuerLage(lage) {
  const breite = flaeche?.clientWidth || 1200, hoehe = flaeche?.clientHeight || 800;
  if (!spalten.length) {
    const b = new Bereich({ anteil: hoehe, y: lage.y ?? null });
    spalten.push({ id: `s${++zaehler}`, anteil: lage.b ?? breite, x: lage.x ?? null, zeilen: [b] });
    if (lage.andock === 'lu' || lage.andock === 'ru') return neuerBereichNeben(b, 'unten');
    return b;
  }
  const a = lage.andock;
  if (['links', 'lo', 'lu', 'rechts', 'ro', 'ru'].includes(a)) {
    const rechts = a === 'rechts' || a === 'ro' || a === 'ru';
    if (rechts && spalten.length < 2) neuerBereichNeben(spalten[0].zeilen[0], 'rechts', spalten[0].anteil);
    const s = rechts ? spalten[spalten.length - 1] : spalten[0];
    if (a === 'lo' || a === 'ro') return s.zeilen[0];
    if (a === 'lu' || a === 'ru') return s.zeilen.length > 1 ? s.zeilen[s.zeilen.length - 1] : neuerBereichNeben(s.zeilen[0], 'unten');
    return s.zeilen[0];
  }
  if (a === 'max') return alleBereiche()[0];
  const tol = 24;
  let s = spalten.find((x) => x.x !== null && Math.abs(x.x - lage.x) <= tol);
  if (!s) {
    s = { id: `s${++zaehler}`, anteil: lage.b ?? breite / (spalten.length + 1), x: lage.x, zeilen: [] };
    const i = spalten.findIndex((x) => x.x !== null && x.x > lage.x);
    spalten.splice(i < 0 ? spalten.length : i, 0, s);
  }
  const y = lage.y ?? 0;
  let b = s.zeilen.find((x) => x.y !== null && Math.abs(x.y - y) <= tol);
  if (!b) {
    b = new Bereich({ anteil: lage.h ?? hoehe, y });
    const i = s.zeilen.findIndex((x) => x.y !== null && x.y > y);
    s.zeilen.splice(i < 0 ? s.zeilen.length : i, 0, b);
  }
  return b;
}

/** Nebenbereich rechts (Aufruf aus einer Ansicht heraus). */
function nebenbereich() {
  if (spalten.length === 1 && spalten[0].zeilen.length === 1) {
    const s = spalten[0];
    return neuerBereichNeben(s.zeilen[0], 'rechts', s.anteil * 0.8);
  }
  const s = spalten[spalten.length - 1];
  return s.zeilen[s.zeilen.length - 1];
}

// ---------------------------------------------------------------------------------------------
// Layout und Seitenkopf

function layoutZeichnen() {
  if (!flaeche) return;
  for (const c of [...flaeche.children]) if (c.classList.contains('pn-spalte') || c.classList.contains('pn-trenner')) c.remove();
  const vor = flaeche.querySelector('.willkommen');
  spalten.forEach((s, i) => {
    if (i > 0) flaeche.insertBefore(trenner('senkrecht', spalten[i - 1], s), vor);
    const el = h('div', { class: 'pn-spalte', style: { flex: `${s.anteil} 1 0` } });
    s.zeilen.forEach((b, j) => {
      if (j > 0) el.append(trenner('waagerecht', s.zeilen[j - 1], b));
      b.el.style.flex = `${b.anteil} 1 0`;
      el.append(b.el);
    });
    flaeche.insertBefore(el, vor);
  });
  const mehrere = alleBereiche().length > 1;
  flaeche.classList.toggle('mehrere', mehrere);
  for (const b of alleBereiche()) b.el.classList.toggle('aktiv', mehrere && b === aktiverBereich);
  kopfZeichnen();
}

function kopfZeichnen() {
  if (!kopf) return;
  const haupt = alleBereiche()[0]?.ansicht;
  const titel = seitentitel || haupt?.titelText || '';
  kopf.hidden = !haupt;
  kopf.querySelector('.sk-titel').textContent = titel;
  melden('seite', { titel, haupt, arbeitsplatz: seitentitel });
}

function trenner(art, a, b) {
  const t = h('div', { class: `pn-trenner ${art}`, role: 'separator', 'aria-orientation': art === 'senkrecht' ? 'vertical' : 'horizontal' });
  t.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    t.setPointerCapture(e.pointerId);
    const senkrecht = art === 'senkrecht';
    const elA = t.previousElementSibling, elB = t.nextElementSibling;
    const gA = senkrecht ? elA.offsetWidth : elA.offsetHeight, gB = senkrecht ? elB.offsetWidth : elB.offsetHeight;
    const summe = a.anteil + b.anteil, start = senkrecht ? e.clientX : e.clientY;
    const bewegen = (ev) => {
      const neuA = Math.max(200, Math.min(gA + gB - 200, gA + (senkrecht ? ev.clientX : ev.clientY) - start));
      a.anteil = summe * (neuA / (gA + gB));
      b.anteil = summe - a.anteil;
      elA.style.flex = `${a.anteil} 1 0`;
      elB.style.flex = `${b.anteil} 1 0`;
    };
    const ende = () => {
      t.removeEventListener('pointermove', bewegen);
      t.removeEventListener('pointerup', ende);
      aenderungMelden();
    };
    t.addEventListener('pointermove', bewegen);
    t.addEventListener('pointerup', ende);
  });
  return t;
}

// ---------------------------------------------------------------------------------------------
// Ansicht – API für die Module

export class Fenster {
  constructor(typName, parameter) {
    this.id = `f${++zaehler}`;
    this.typ = typName;
    this.def = typen.get(typName);
    this.parameter = parameter ?? {};
    this.bereich = null;
    this.symbolName = this.def?.symbolFuer?.(this.parameter) || this.def?.symbol || 'fenster';
    this.titelText = titelFormen(this.def?.titel || typName);
    this._abmelden = [];
    this._schliessenRueckrufe = [];

    this.werkzeuge = h('div', { class: 'fenster-werkzeuge', role: 'toolbar' });
    this.inhalt = h('div', { class: 'fenster-inhalt' });
    this.fuss = h('div', { class: 'fenster-fuss' });
    this.el = h('section', { class: 'fenster', 'aria-label': this.titelText }, this.werkzeuge, this.inhalt, this.fuss);
    this.el.dataset.typ = typName;
  }

  /** Titel setzen. */
  titel(text) {
    this.titelText = titelFormen(text);
    this.el.setAttribute('aria-label', this.titelText);
    this.bereich?.titelZeigen();
    kopfZeichnen();
    if (this.istAktiv()) melden('fenster-titel', this);
  }

  /** Parameter ändern (z. B. gewähltes Element) – fließt in die Adresse und gespeicherte Anordnungen. */
  parameterSetzen(p) { this.parameter = { ...this.parameter, ...p }; aenderungMelden(); }

  /** Knopf in der Werkzeugleiste (mit Text: Textknopf; nurSymbol: Symbolknopf mit Hinweis). */
  werkzeug({ text, symbol: sym, titel, aktion, nurSymbol = false }) {
    const mitText = !nurSymbol && text;
    const k = h('button', { class: `wz-knopf${mitText ? '' : ' nur-symbol'}`, type: 'button', title: titel || text, 'aria-label': titel || text },
      mitText ? null : (sym ? symbol(sym) : null), mitText ? h('span', null, text) : null);
    k.addEventListener('click', () => Promise.resolve().then(aktion).catch(fehlerMelden));
    this.werkzeuge.append(k);
    return k;
  }

  trenner() { this.werkzeuge.append(h('span', { class: 'trenner' })); }

  /** Ereignis abonnieren, das beim Schließen automatisch abgemeldet wird. */
  an(name, f) { this._abmelden.push(an(name, f)); }

  beimSchliessen(f) { this._schliessenRueckrufe.push(f); }

  istAktiv() { return !!this.bereich && this.bereich === aktiverBereich; }

  aktivieren() {
    if (!this.bereich) return;
    if (aktiverBereich !== this.bereich) bereichAktivieren(this.bereich);
    else melden('fenster-aktiv', this);
  }

  /** Früher „minimieren“ – auf Seiten ohne Bedeutung. */
  minimieren() {}

  /** Früher „maximieren“ – öffnet die Ansicht als eigene Seite. */
  maximieren() { this.bereich?.alsSeite(); }

  schliessen(ersetzt = false) {
    const i = fenster.indexOf(this);
    if (i < 0) return;
    fenster.splice(i, 1);
    for (const f of this._schliessenRueckrufe) { try { f(); } catch (e) { console.error(e); } }
    for (const ab of this._abmelden) ab();
    if (!ersetzt) this.bereich?.abgeben(this);
    else { this.el.remove(); this.bereich = null; }
    this.el.remove();
    melden('fenster-geschlossen', this);
    aenderungMelden();
  }

  /** Beschreibung für Anordnungen und Adressen. */
  beschreibung() {
    const s = spalten.findIndex((x) => x.zeilen.includes(this.bereich));
    const sp = spalten[s];
    const z = sp ? sp.zeilen.indexOf(this.bereich) : 0;
    return { typ: this.typ, parameter: this.parameter, spalte: s, zeile: z, spalteAnteil: sp?.anteil, zeileAnteil: this.bereich?.anteil, fokus: this.istAktiv() };
  }
}

function ansichtErstellen(f) {
  try {
    const erg = f.def.erstellen(f, f.parameter);
    if (erg?.catch) erg.catch((e) => { fehlerMelden(e); f.inhalt.append(h('div', { class: 'fehlertext', style: { padding: '16px' } }, String(e.message || e))); });
  } catch (e) {
    fehlerMelden(e);
    f.inhalt.append(h('div', { class: 'fehlertext', style: { padding: '16px' } }, String(e.message || e)));
  }
}

// ---------------------------------------------------------------------------------------------
// Adresse (URL) und Zurück-Taste

function adresse() {
  const haupt = alleBereiche()[0]?.ansicht;
  if (!haupt) return '#/';
  const p = Object.keys(haupt.parameter || {}).length ? `?${encodeURIComponent(JSON.stringify(haupt.parameter))}` : '';
  return `#/${haupt.typ}${p}`;
}

function geschichteMerken(ersetzen = false) {
  if (geschichteAus) return;
  const zustand = { studio: true, titel: seitentitel, anordnung: fensterverwaltung.anordnung() };
  try {
    if (ersetzen || !history.state?.studio) history.replaceState(zustand, '', adresse());
    else history.pushState(zustand, '', adresse());
  } catch { /* z. B. in eingebetteten Vorschauen */ }
}

addEventListener('popstate', (e) => {
  const z = e.state;
  if (!z?.studio || !flaeche) return;
  geschichteAus = true;
  try {
    fensterverwaltung.anordnungLaden(z.anordnung || []);
    seitentitel = z.titel || null;
    kopfZeichnen();
  } finally { geschichteAus = false; }
});

/** Ansicht aus der aktuellen Adresse (beim Start bzw. nach Neuladen). */
export function ansichtAusAdresse() {
  const m = location.hash.match(/^#\/([^?]+)(?:\?(.*))?$/);
  if (!m || !typen.has(m[1])) return null;
  let p = {};
  try { p = m[2] ? JSON.parse(decodeURIComponent(m[2])) : {}; } catch { p = {}; }
  return { typ: m[1], parameter: p };
}

// ---------------------------------------------------------------------------------------------

export const fensterverwaltung = {
  /** Arbeitsfläche einrichten (einmalig durch die Shell). kopfEl: Seitenkopf mit .sk-titel */
  einrichten(flaecheEl, kopfEl, beiAenderung) {
    flaeche = flaecheEl;
    kopf = kopfEl;
    flaeche.classList.add('pn');
    aenderungMelden = entprellen(() => { beiAenderung?.(); geschichteMerken(true); melden('arbeitsbereich'); }, 400);
  },

  /** Der nächste Öffnen-Aufruf ohne Lage beginnt eine neue Seite (Navigation, Befehlssuche, Übersicht). */
  naechsterAufrufNeueSeite() { seitenwechselBis = Date.now() + 2000; },

  /** Titel der Seite (für Arbeitsplätze mit mehreren Bereichen). */
  seitentitel(t) { seitentitel = t || null; kopfZeichnen(); },

  /**
   * Ansicht öffnen. Ist der Typ „einzig“ (gleicher Schlüssel) und schon offen, wird er gezeigt.
   * lage: siehe Kopf der Datei.
   */
  oeffnen(typ, parameter = {}, lage = {}) {
    const def = typen.get(typ);
    if (!def) { fehlerMelden(new Error(`Unbekannte Ansicht „${typ}“.`)); return null; }
    lage = lage || {};
    const neueSeite = Date.now() < seitenwechselBis;
    seitenwechselBis = 0;
    const key = def.einzig?.(parameter);
    if (key) {
      const vorhanden = fenster.find((f) => f.typ === typ && f.def.einzig?.(f.parameter) === key);
      if (vorhanden && !(neueSeite && alleBereiche().length > 1)) {
        vorhanden.aktivieren(); vorhanden.def.erneutGeoeffnet?.(vorhanden, parameter); return vorhanden;
      }
    }
    const mitLage = !!(lage.andock || (lage.x !== undefined && lage.x !== null));
    if (mitLage) return this.oeffnenIn(bereichFuerLage(lage), typ, parameter, false);
    if (neueSeite || !spalten.length) return this.seiteOeffnen(typ, parameter);
    return this.oeffnenIn(nebenbereich(), typ, parameter, false);
  },

  /** Arbeitsplatz: neue Seite mit mehreren Bereichen; aufbauen() öffnet die Ansichten mit Lageangaben. */
  async arbeitsplatz(titel, aufbauen) {
    seitenwechselBis = 0;
    geschichteAus = true;
    try {
      this.alleSchliessen();
      await aufbauen();
      seitentitel = titel;
      kopfZeichnen();
    } finally { geschichteAus = false; }
    geschichteMerken(false);
  },

  /** Ansicht als neue Seite öffnen (bisherige Seite wird geschlossen). */
  seiteOeffnen(typ, parameter = {}) {
    geschichteAus = true;
    try { this.alleSchliessen(); } finally { geschichteAus = false; }
    seitentitel = null;
    const f = this.oeffnenIn(bereichFuerLage({}), typ, parameter, true);
    geschichteMerken(false);
    return f;
  },

  /** Ansicht in einem bestimmten Bereich öffnen (ersetzt dessen bisherige Ansicht). */
  oeffnenIn(bereich, typ, parameter = {}, _neu = false) {
    const f = new Fenster(typ, parameter);
    fenster.push(f);
    bereich.aufnehmen(f);
    layoutZeichnen();
    bereichAktivieren(bereich);
    ansichtErstellen(f);
    melden('fenster-aktiv', f);
    aenderungMelden();
    return f;
  },

  alle: () => [...fenster],
  aktiv: () => aktiverBereich?.ansicht || null,

  /** Früher Fensteranordnung; heute ohne sichtbare Wirkung außer „nebeneinander“ (Bereiche nebeneinander). */
  anordnen(art) {
    if (art !== 'nebeneinander' || fenster.length < 2) return;
    const liste = alleBereiche().map((b) => b.ansicht).filter(Boolean);
    for (const b of alleBereiche()) b.el.remove();
    spalten = [];
    const breite = flaeche.clientWidth || 1200, hoehe = flaeche.clientHeight || 800;
    for (const f of liste) {
      const b = new Bereich({ anteil: hoehe });
      spalten.push({ id: `s${++zaehler}`, anteil: breite / liste.length, x: null, zeilen: [b] });
      f.bereich = null;
      b.aufnehmen(f);
    }
    layoutZeichnen();
    aenderungMelden();
  },

  alleSchliessen() {
    for (const f of [...fenster]) f.schliessen();
    spalten = [];
    aktiverBereich = null;
    seitentitel = null;
    layoutZeichnen();
  },

  /** Aktuelle Anordnung (serialisierbar). */
  anordnung: () => alleBereiche().map((b) => b.ansicht).filter(Boolean).map((f) => f.beschreibung()),

  /** Anordnung wiederherstellen. Versteht auch ältere Formate mit x/y/b/h. */
  anordnungLaden(liste, titel) {
    const vorher = geschichteAus;
    geschichteAus = true;
    try {
      this.alleSchliessen();
      const gueltig = (liste || []).filter((b) => typen.has(b.typ));
      if (gueltig.length) {
        if (gueltig.every((b) => Number.isInteger(b.spalte) && b.spalte >= 0)) {
          const breite = flaeche.clientWidth || 1200, hoehe = flaeche.clientHeight || 800;
          let fokus = null;
          for (const b of gueltig) {
            while (spalten.length <= b.spalte) spalten.push({ id: `s${++zaehler}`, anteil: breite, x: null, zeilen: [] });
            const s = spalten[b.spalte];
            if (b.spalteAnteil) s.anteil = b.spalteAnteil;
            while (s.zeilen.length <= b.zeile) s.zeilen.push(new Bereich({ anteil: hoehe }));
            const ber = s.zeilen[b.zeile];
            if (b.zeileAnteil) ber.anteil = b.zeileAnteil;
            if (ber.ansicht) continue;
            const f = this.oeffnenIn(ber, b.typ, b.parameter);
            if (b.fokus) fokus = f;
          }
          for (const s of [...spalten]) for (const ber of [...s.zeilen]) if (!ber.ansicht) bereichEntfernen(ber);
          layoutZeichnen();
          fokus?.aktivieren();
        } else {
          for (const b of gueltig) this.oeffnen(b.typ, b.parameter, b.andock ? { andock: b.andock } : b);
        }
      }
      if (titel !== undefined) seitentitel = titel;
      kopfZeichnen();
    } finally { geschichteAus = vorher; }
    geschichteMerken(false);
  },
};
