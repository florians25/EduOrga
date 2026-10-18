// Arbeitsbereich: Ansichten (Fenstertypen der Module) als Reiter in Bereichen, die sich in Spalten und Zeilen teilen.
// Kein Überlappen: Der Arbeitsbereich ist immer vollständig aufgeteilt. Reiter lassen sich per Ziehen in einen anderen
// Bereich verschieben oder an dessen Rand ablegen (teilt den Bereich), Trenner zwischen Spalten/Zeilen sind verschiebbar,
// ein Bereich lässt sich vergrößern (füllt den Arbeitsbereich). Anordnungen werden je Dokument gespeichert.
//
// Fenstertypen registrieren die Module (siehe modulsystem.js):
//   { titel, symbol, symbolFuer(parameter), breite, hoehe, einzig(parameter) → Schlüssel|null, erneutGeoeffnet(fenster, parameter), erstellen(fenster, parameter) }
//
// lage beim Öffnen (optional): { andock: 'links'|'rechts'|'lo'|'lu'|'ro'|'ru'|'max' } oder { x, y, b, h } (Pixel im
// Arbeitsbereich) – daraus wird die Spalte/Zeile bestimmt. Ohne lage öffnet die Ansicht als Reiter im aktiven Bereich.
import { h, leeren, entprellen } from './dom.js';
import { symbol } from './symbole.js';
import { an, melden } from './ereignisse.js';
import { fehlerMelden, menue } from './dialog.js';

const typen = new Map();
const fenster = [];
let flaeche = null;
let zaehler = 0;
let aenderungMelden = () => {};

/** Spalten des Arbeitsbereichs: [{ id, anteil, x, zeilen: [Bereich] }] (anteil in Pixeln, relativ zueinander). */
let spalten = [];
let aktiverBereich = null;
let grosserBereich = null;

const ZIEH_TYP = 'application/x-studio-ansicht';
let gezogeneAnsicht = null;

export function fenstertypRegistrieren(name, def) {
  typen.set(name, def);
}

export function fenstertyp(name) { return typen.get(name); }

/** Reitertitel vereinheitlichen: „Element / Art“ → „Element – Art“, doppelte Langnamen („Klasse 5a (Klasse 5a)“) kürzen. */
function titelFormen(t) {
  const m = String(t).match(/^(.*) \/ (.*)$/);
  if (m) t = m[2] === 'Stammdaten' ? m[1] : `${m[1]} – ${m[2]}`;
  return t.replace(/^(\S+) (\S+) \(\1 \2\)/, '$1 $2');
}

// ---------------------------------------------------------------------------------------------
// Bereich: Reiterleiste + Ansichten

class Bereich {
  constructor({ anteil, y } = {}) {
    this.id = `b${++zaehler}`;
    this.anteil = anteil || 1000;
    this.y = y ?? null;
    this.fenster = [];
    this.aktiv = null;
    this.reiter = h('div', { class: 'ws-reiter', role: 'tablist' });
    this.aktionen = h('div', { class: 'ws-aktionen' },
      h('button', { type: 'button', class: 'ws-aktion', title: 'Rechts teilen', onclick: () => this.teilen('rechts') }, symbol('nebeneinander')),
      h('button', { type: 'button', class: 'ws-aktion', title: 'Unten teilen', onclick: () => this.teilen('unten') }, symbol('untereinander')),
      this.zoomKnopf = h('button', { type: 'button', class: 'ws-aktion', title: 'Bereich vergrößern', onclick: () => this.zoom() }, symbol('maximieren')),
      h('button', { type: 'button', class: 'ws-aktion', title: 'Weitere Aktionen', onclick: (e) => this.menue(e.currentTarget) }, symbol('mehr')));
    this.kopf = h('div', { class: 'ws-kopf' }, this.reiter, this.aktionen);
    this.ansichten = h('div', { class: 'ws-ansichten' });
    this.ablage = h('div', { class: 'ws-ablage', hidden: true });
    this.el = h('section', { class: 'ws-bereich', dataset: { bereich: this.id } }, this.kopf, this.ansichten, this.ablage);
    this.el.addEventListener('pointerdown', () => bereichAktivieren(this), true);
    this.kopf.addEventListener('dblclick', (e) => { if (!e.target.closest('button')) this.zoom(); });
    this._ablageEinrichten();
  }

  aufnehmen(f, index = this.fenster.length) {
    if (f.bereich && f.bereich !== this) f.bereich.abgeben(f);
    f.bereich = this;
    if (!this.fenster.includes(f)) this.fenster.splice(index, 0, f);
    this.ansichten.append(f.el);
    this.zeigen(f);
  }

  abgeben(f) {
    const i = this.fenster.indexOf(f);
    if (i < 0) return;
    this.fenster.splice(i, 1);
    if (f.el.parentNode === this.ansichten) f.el.remove();
    f.bereich = null;
    if (this.aktiv === f) this.aktiv = null;
    if (!this.fenster.length) bereichEntfernen(this);
    else {
      if (!this.aktiv) this.zeigen(this.fenster[Math.min(i, this.fenster.length - 1)]);
      this.reiterZeichnen();
    }
  }

  zeigen(f) {
    this.aktiv = f;
    for (const x of this.fenster) x.el.hidden = x !== f;
    this.reiterZeichnen();
  }

  reiterZeichnen() {
    leeren(this.reiter);
    for (const f of this.fenster) {
      const aktiv = f === this.aktiv;
      const knopf = h('div', {
        class: `ws-tab${aktiv ? ' aktiv' : ''}`, role: 'tab', 'aria-selected': aktiv ? 'true' : 'false', tabindex: aktiv ? '0' : '-1',
        title: f.titelText, draggable: 'true', dataset: { typ: f.typ },
      }, h('span', { class: 'ws-tab-symbol' }, symbol(f.symbolName)), h('span', { class: 'ws-tab-text' }, f.titelText),
      h('button', { type: 'button', class: 'ws-tab-zu', title: 'Schließen', onclick: (e) => { e.stopPropagation(); f.schliessen(); } }, symbol('schliessen')));
      knopf.addEventListener('click', () => f.aktivieren());
      knopf.addEventListener('auxclick', (e) => { if (e.button === 1) { e.preventDefault(); f.schliessen(); } });
      knopf.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f.aktivieren(); }
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          const i = this.fenster.indexOf(f) + (e.key === 'ArrowRight' ? 1 : -1);
          const n = this.fenster[(i + this.fenster.length) % this.fenster.length];
          n.aktivieren();
          this.reiter.querySelector('.ws-tab.aktiv')?.focus();
        }
      });
      knopf.addEventListener('contextmenu', (e) => { e.preventDefault(); this.menue(null, f, e.clientX, e.clientY); });
      knopf.addEventListener('dragstart', (e) => {
        gezogeneAnsicht = f;
        e.dataTransfer.setData(ZIEH_TYP, f.id);
        e.dataTransfer.effectAllowed = 'move';
        document.body.classList.add('ws-zieht');
      });
      knopf.addEventListener('dragend', () => { gezogeneAnsicht = null; document.body.classList.remove('ws-zieht'); ablagenVerbergen(); });
      this.reiter.append(knopf);
    }
    this.el.classList.toggle('mehrere', this.fenster.length > 1);
  }

  /** Aktive Ansicht in einen neuen Bereich rechts bzw. unten verschieben. */
  teilen(richtung, f = this.aktiv) {
    if (!f) return;
    if (this.fenster.length < 2) {
      // einzige Ansicht: Bereich leer teilen ist nicht sinnvoll – stattdessen eine Kopie anbieten, falls möglich
      if (f.def?.einzig?.(f.parameter)) return;
      const neu = neuerBereichNeben(this, richtung);
      fensterverwaltung.oeffnenIn(neu, f.typ, { ...f.parameter });
      return;
    }
    const neu = neuerBereichNeben(this, richtung);
    neu.aufnehmen(f);
    bereichAktivieren(neu);
    layoutZeichnen();
    aenderungMelden();
  }

  zoom() {
    grosserBereich = grosserBereich === this ? null : this;
    layoutZeichnen();
    aenderungMelden();
  }

  menue(knopf, f = this.aktiv, x, y) {
    if (knopf) { const r = knopf.getBoundingClientRect(); x = r.right - 220; y = r.bottom + 4; }
    menue(x, y, [
      { text: 'Rechts teilen', symbol: 'nebeneinander', aktion: () => this.teilen('rechts', f), deaktiviert: !f },
      { text: 'Unten teilen', symbol: 'untereinander', aktion: () => this.teilen('unten', f), deaktiviert: !f },
      { text: grosserBereich === this ? 'Verkleinern' : 'Vergrößern', symbol: grosserBereich === this ? 'wiederherstellen' : 'maximieren', aktion: () => this.zoom() },
      null,
      { text: 'Schließen', symbol: 'schliessen', aktion: () => f?.schliessen(), deaktiviert: !f },
      { text: 'Andere Reiter schließen', aktion: () => { for (const x2 of [...this.fenster]) if (x2 !== f) x2.schliessen(); }, deaktiviert: this.fenster.length < 2 },
      { text: 'Bereich schließen', aktion: () => { for (const x2 of [...this.fenster]) x2.schliessen(); } },
    ]);
  }

  _ablageEinrichten() {
    const zone = (e) => {
      const r = this.el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      if (e.clientY - r.top < 40) return 'mitte';
      if (x < 0.22) return 'links';
      if (x > 0.78) return 'rechts';
      if (y < 0.25) return 'oben';
      if (y > 0.75) return 'unten';
      return 'mitte';
    };
    this.el.addEventListener('dragover', (e) => {
      if (!gezogeneAnsicht || !e.dataTransfer.types.includes(ZIEH_TYP)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const z = zone(e);
      ablagenVerbergen(this);
      this.ablage.hidden = false;
      this.ablage.dataset.zone = z;
    });
    this.el.addEventListener('dragleave', (e) => { if (!this.el.contains(e.relatedTarget)) this.ablage.hidden = true; });
    this.el.addEventListener('drop', (e) => {
      if (!gezogeneAnsicht || !e.dataTransfer.types.includes(ZIEH_TYP)) return;
      e.preventDefault();
      const f = gezogeneAnsicht, z = zone(e);
      gezogeneAnsicht = null;
      ablagenVerbergen();
      if (z === 'mitte') {
        if (f.bereich === this) return;
        this.aufnehmen(f);
      } else {
        if (f.bereich === this && this.fenster.length === 1) return;
        const neu = neuerBereichNeben(this, z);
        neu.aufnehmen(f);
      }
      bereichAktivieren(f.bereich);
      layoutZeichnen();
      aenderungMelden();
    });
  }
}

function ablagenVerbergen(ausser) {
  for (const s of spalten) for (const b of s.zeilen) if (b !== ausser) b.ablage.hidden = true;
}

function alleBereiche() { return spalten.flatMap((s) => s.zeilen); }

function spalteVon(b) { return spalten.find((s) => s.zeilen.includes(b)); }

function bereichAktivieren(b) {
  if (!b || aktiverBereich === b) return;
  aktiverBereich = b;
  for (const x of alleBereiche()) x.el.classList.toggle('aktiv', x === b);
  if (b.aktiv) melden('fenster-aktiv', b.aktiv);
}

/** Neuen Bereich neben b anlegen: 'rechts'/'links' = neue Spalte, 'unten'/'oben' = neue Zeile in der Spalte von b. */
function neuerBereichNeben(b, richtung) {
  const s = spalteVon(b);
  if (richtung === 'rechts' || richtung === 'links') {
    const anteil = s.anteil / 2;
    s.anteil = anteil;
    const neu = new Bereich();
    const spalte = { id: `s${++zaehler}`, anteil, x: null, zeilen: [neu] };
    const i = spalten.indexOf(s);
    spalten.splice(richtung === 'rechts' ? i + 1 : i, 0, spalte);
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
  if (grosserBereich === b) grosserBereich = null;
  if (aktiverBereich === b) {
    aktiverBereich = null;
    bereichAktivieren(alleBereiche()[0]);
  }
  layoutZeichnen();
}

/** Bereich für ein neues Fenster bestimmen (siehe lage oben). */
function zielBereich(lage) {
  const breite = flaeche?.clientWidth || 1200, hoehe = flaeche?.clientHeight || 800;
  if (!spalten.length) {
    const b = new Bereich({ anteil: hoehe, y: lage.y ?? null });
    spalten.push({ id: `s${++zaehler}`, anteil: lage.b ?? breite, x: lage.x ?? null, zeilen: [b] });
    if (lage.andock === 'lu' || lage.andock === 'ru') return neuerBereichNeben(b, 'unten');
    return b;
  }
  const a = lage.andock;
  if (a === 'links' || a === 'lo' || a === 'lu' || a === 'rechts' || a === 'ro' || a === 'ru') {
    const rechts = a === 'rechts' || a === 'ro' || a === 'ru';
    if (rechts && spalten.length < 2) neuerBereichNeben(spalten[0].zeilen[0], 'rechts');
    const s = rechts ? spalten[spalten.length - 1] : spalten[0];
    if (a === 'lo' || a === 'ro') return s.zeilen[0];
    if (a === 'lu' || a === 'ru') return s.zeilen.length > 1 ? s.zeilen[s.zeilen.length - 1] : neuerBereichNeben(s.zeilen[0], 'unten');
    return s.zeilen[0];
  }
  if (lage.x !== undefined && lage.x !== null) {
    // absolute Lage (Standardanordnungen, ältere gespeicherte Fensteranordnungen): Spalte nach x, Zeile nach y
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
  return aktiverBereich && alleBereiche().includes(aktiverBereich) ? aktiverBereich : alleBereiche()[0];
}

// ---------------------------------------------------------------------------------------------
// Layout (Spalten/Zeilen mit Trennern)

function layoutZeichnen() {
  if (!flaeche) return;
  const alt = [...flaeche.children].filter((c) => c.classList.contains('ws-spalte') || c.classList.contains('ws-trenner'));
  for (const c of alt) c.remove();
  const vor = flaeche.querySelector('.willkommen');
  spalten.forEach((s, i) => {
    if (i > 0) flaeche.insertBefore(trenner('senkrecht', spalten[i - 1], s), vor);
    const el = h('div', { class: 'ws-spalte', style: { flex: `${s.anteil} 1 0` } });
    s.zeilen.forEach((b, j) => {
      if (j > 0) el.append(trenner('waagerecht', s.zeilen[j - 1], b));
      b.el.style.flex = `${b.anteil} 1 0`;
      el.append(b.el);
    });
    flaeche.insertBefore(el, vor);
  });
  flaeche.classList.toggle('ws-gross', !!grosserBereich);
  for (const b of alleBereiche()) {
    b.el.classList.toggle('gross', b === grosserBereich);
    b.zoomKnopf.replaceChildren(symbol(b === grosserBereich ? 'wiederherstellen' : 'maximieren'));
    b.zoomKnopf.title = b === grosserBereich ? 'Verkleinern' : 'Bereich vergrößern';
    b.el.classList.toggle('aktiv', b === aktiverBereich);
    b.el.classList.toggle('einzeln', alleBereiche().length === 1);
  }
}

function trenner(art, a, b) {
  const t = h('div', { class: `ws-trenner ${art}`, role: 'separator', 'aria-orientation': art === 'senkrecht' ? 'vertical' : 'horizontal' });
  t.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    t.setPointerCapture(e.pointerId);
    const senkrecht = art === 'senkrecht';
    const elA = senkrecht ? t.previousElementSibling : t.previousElementSibling, elB = t.nextElementSibling;
    const gA = senkrecht ? elA.offsetWidth : elA.offsetHeight, gB = senkrecht ? elB.offsetWidth : elB.offsetHeight;
    const summe = a.anteil + b.anteil, start = senkrecht ? e.clientX : e.clientY;
    t.classList.add('zieht');
    const bewegen = (ev) => {
      const d = (senkrecht ? ev.clientX : ev.clientY) - start;
      const neuA = Math.max(160, Math.min(gA + gB - 160, gA + d));
      a.anteil = summe * (neuA / (gA + gB));
      b.anteil = summe - a.anteil;
      elA.style.flex = `${a.anteil} 1 0`;
      elB.style.flex = `${b.anteil} 1 0`;
    };
    const ende = () => {
      t.removeEventListener('pointermove', bewegen);
      t.removeEventListener('pointerup', ende);
      t.classList.remove('zieht');
      aenderungMelden();
    };
    t.addEventListener('pointermove', bewegen);
    t.addEventListener('pointerup', ende);
  });
  t.addEventListener('dblclick', () => {
    const summe = a.anteil + b.anteil;
    a.anteil = summe / 2;
    b.anteil = summe / 2;
    layoutZeichnen();
    aenderungMelden();
  });
  return t;
}

// ---------------------------------------------------------------------------------------------
// Ansicht (bisher „Fenster“) – API für die Module unverändert

export class Fenster {
  constructor(typName, parameter) {
    this.id = `f${++zaehler}`;
    this.typ = typName;
    this.def = typen.get(typName);
    this.parameter = parameter ?? {};
    this.bereich = null;
    this.symbolName = this.def?.symbolFuer?.(this.parameter) || this.def?.symbol || 'fenster';
    this.titelText = this.def?.titel || typName;
    this._abmelden = [];
    this._schliessenRueckrufe = [];

    this.werkzeuge = h('div', { class: 'fenster-werkzeuge', role: 'toolbar' });
    this.inhalt = h('div', { class: 'fenster-inhalt' });
    this.fuss = h('div', { class: 'fenster-fuss' });
    this.el = h('section', { class: 'fenster', 'aria-label': this.titelText, role: 'tabpanel' }, this.werkzeuge, this.inhalt, this.fuss);
    this.el.dataset.typ = typName;
    this.el.addEventListener('pointerdown', () => { if (this.bereich) bereichAktivieren(this.bereich); }, true);
  }

  // ---- für die Inhalte ----

  /** Titel setzen. */
  titel(text) {
    this.titelText = titelFormen(text);
    this.el.setAttribute('aria-label', this.titelText);
    this.bereich?.reiterZeichnen();
    if (this.istAktiv()) melden('fenster-titel', this);
  }

  /** Parameter ändern (z. B. gewähltes Element) – wird in der Anordnung gespeichert. */
  parameterSetzen(p) { this.parameter = { ...this.parameter, ...p }; aenderungMelden(); }

  /** Knopf in der Werkzeugleiste. */
  werkzeug({ text, symbol: sym, titel, aktion, nurSymbol = false }) {
    const k = h('button', { class: `wz-knopf${nurSymbol ? ' nur-symbol' : ''}`, type: 'button', title: titel || text },
      sym ? symbol(sym) : null, nurSymbol ? null : h('span', null, text));
    k.addEventListener('click', () => Promise.resolve().then(aktion).catch(fehlerMelden));
    this.werkzeuge.append(k);
    return k;
  }

  trenner() { this.werkzeuge.append(h('span', { class: 'trenner' })); }

  /** Ereignis abonnieren, das beim Schließen automatisch abgemeldet wird. */
  an(name, f) { this._abmelden.push(an(name, f)); }

  beimSchliessen(f) { this._schliessenRueckrufe.push(f); }

  istAktiv() { return !!this.bereich && this.bereich === aktiverBereich && this.bereich.aktiv === this; }

  // ---- Funktionen ----

  aktivieren() {
    if (!this.bereich) return;
    if (this.bereich.aktiv !== this) this.bereich.zeigen(this);
    if (aktiverBereich !== this.bereich) bereichAktivieren(this.bereich);
    else melden('fenster-aktiv', this);
  }

  /** Andere Ansicht des Bereichs zeigen (ersetzt das Minimieren). */
  minimieren() {
    const b = this.bereich;
    if (!b || b.fenster.length < 2) return;
    b.zeigen(b.fenster[(b.fenster.indexOf(this) + 1) % b.fenster.length]);
    aenderungMelden();
  }

  /** Bereich vergrößern bzw. wieder einpassen. */
  maximieren() { this.bereich?.zoom(); }

  schliessen() {
    const i = fenster.indexOf(this);
    if (i < 0) return;
    fenster.splice(i, 1);
    for (const f of this._schliessenRueckrufe) { try { f(); } catch (e) { console.error(e); } }
    for (const ab of this._abmelden) ab();
    this.bereich?.abgeben(this);
    this.el.remove();
    melden('fenster-geschlossen', this);
    aenderungMelden();
  }

  /** Beschreibung für gespeicherte Anordnungen. */
  beschreibung() {
    const s = spalten.findIndex((x) => x.zeilen.includes(this.bereich));
    const sp = spalten[s];
    const z = sp ? sp.zeilen.indexOf(this.bereich) : 0;
    return {
      typ: this.typ, parameter: this.parameter, spalte: s, zeile: z, spalteAnteil: sp?.anteil, zeileAnteil: this.bereich?.anteil,
      sichtbar: this.bereich?.aktiv === this, fokus: this.istAktiv(), gross: grosserBereich === this.bereich,
    };
  }
}

// ---------------------------------------------------------------------------------------------

function ansichtErstellen(f) {
  const def = f.def;
  try {
    const erg = def.erstellen(f, f.parameter);
    if (erg?.catch) erg.catch((e) => { fehlerMelden(e); f.inhalt.append(h('div', { class: 'fehlertext', style: { padding: '16px' } }, String(e.message || e))); });
  } catch (e) {
    fehlerMelden(e);
    f.inhalt.append(h('div', { class: 'fehlertext', style: { padding: '16px' } }, String(e.message || e)));
  }
}

export const fensterverwaltung = {
  /** Arbeitsbereich einrichten (einmalig durch die Shell). */
  einrichten(flaecheEl, _leiste, beiAenderung) {
    flaeche = flaecheEl;
    flaeche.classList.add('ws');
    aenderungMelden = entprellen(() => { beiAenderung?.(); melden('arbeitsbereich'); }, 400);
  },

  /**
   * Ansicht öffnen. Ist der Typ „einzig“ (gleicher Schlüssel), wird die vorhandene Ansicht gezeigt.
   * lage: siehe Kopf der Datei.
   */
  oeffnen(typ, parameter = {}, lage = {}) {
    const def = typen.get(typ);
    if (!def) { fehlerMelden(new Error(`Unbekannte Ansicht „${typ}“.`)); return null; }
    const key = def.einzig?.(parameter);
    if (key) {
      const vorhanden = fenster.find((f) => f.typ === typ && f.def.einzig?.(f.parameter) === key);
      if (vorhanden) { vorhanden.aktivieren(); vorhanden.def.erneutGeoeffnet?.(vorhanden, parameter); return vorhanden; }
    }
    return this.oeffnenIn(zielBereich(lage || {}), typ, parameter, lage);
  },

  /** Ansicht in einem bestimmten Bereich öffnen (intern und für „Teilen“). */
  oeffnenIn(bereich, typ, parameter = {}, lage = {}) {
    const f = new Fenster(typ, parameter);
    fenster.push(f);
    bereich.aufnehmen(f);
    if (lage?.andock === 'max') grosserBereich = bereich;
    layoutZeichnen();
    if (lage?.minimiert === true && bereich.fenster.length > 1) bereich.zeigen(bereich.fenster[0]);
    bereichAktivieren(bereich);
    ansichtErstellen(f);
    melden('fenster-aktiv', f);
    aenderungMelden();
    return f;
  },

  alle: () => [...fenster],
  aktiv: () => aktiverBereich?.aktiv || null,

  /** Anordnen: 'nebeneinander' (je Ansicht eine Spalte) | 'untereinander' (je Ansicht eine Zeile) | 'ueberlappend' (alle als Reiter). */
  anordnen(art) {
    if (!fenster.length) return;
    const fokus = this.aktiv();
    const liste = alleBereiche().flatMap((b) => b.fenster);
    for (const b of alleBereiche()) b.el.remove();
    spalten = [];
    grosserBereich = null;
    aktiverBereich = null;
    const breite = flaeche.clientWidth || 1200, hoehe = flaeche.clientHeight || 800;
    if (art === 'ueberlappend') {
      const b = new Bereich({ anteil: hoehe });
      spalten.push({ id: `s${++zaehler}`, anteil: breite, x: null, zeilen: [b] });
      for (const f of liste) { f.bereich = null; b.aufnehmen(f); }
      if (fokus) b.zeigen(fokus);
    } else if (art === 'untereinander') {
      const s = { id: `s${++zaehler}`, anteil: breite, x: null, zeilen: [] };
      spalten.push(s);
      for (const f of liste) { const b = new Bereich({ anteil: hoehe / liste.length }); s.zeilen.push(b); f.bereich = null; b.aufnehmen(f); }
    } else {
      for (const f of liste) {
        const b = new Bereich({ anteil: hoehe });
        spalten.push({ id: `s${++zaehler}`, anteil: breite / liste.length, x: null, zeilen: [b] });
        f.bereich = null;
        b.aufnehmen(f);
      }
    }
    layoutZeichnen();
    bereichAktivieren(fokus?.bereich || alleBereiche()[0]);
    aenderungMelden();
  },

  alleSchliessen() {
    for (const f of [...fenster]) f.schliessen();
    spalten = [];
    grosserBereich = null;
    aktiverBereich = null;
    layoutZeichnen();
  },

  /** Aktuelle Anordnung (serialisierbar). */
  anordnung: () => alleBereiche().flatMap((b) => b.fenster).map((f) => f.beschreibung()),

  /** Anordnung wiederherstellen (vorhandene Ansichten werden geschlossen). Versteht auch ältere Formate mit x/y/b/h. */
  anordnungLaden(liste) {
    this.alleSchliessen();
    const gueltig = (liste || []).filter((b) => typen.has(b.typ));
    if (!gueltig.length) return;
    if (gueltig.every((b) => Number.isInteger(b.spalte))) {
      const breite = flaeche.clientWidth || 1200, hoehe = flaeche.clientHeight || 800;
      let fokus = null, gross = null;
      for (const b of gueltig) {
        while (spalten.length <= b.spalte) spalten.push({ id: `s${++zaehler}`, anteil: breite, x: null, zeilen: [] });
        const s = spalten[b.spalte];
        if (b.spalteAnteil) s.anteil = b.spalteAnteil;
        while (s.zeilen.length <= b.zeile) s.zeilen.push(new Bereich({ anteil: hoehe }));
        const ber = s.zeilen[b.zeile];
        if (b.zeileAnteil) ber.anteil = b.zeileAnteil;
        const f = this.oeffnenIn(ber, b.typ, b.parameter);
        if (b.sichtbar) ber.zeigen(f);
        if (b.fokus) fokus = f;
        if (b.gross) gross = ber;
      }
      // leere Platzhalter (z. B. übersprungene Typen) entfernen
      for (const s of [...spalten]) for (const ber of [...s.zeilen]) if (!ber.fenster.length) bereichEntfernen(ber);
      grosserBereich = gross;
      layoutZeichnen();
      if (fokus) fokus.aktivieren();
      return;
    }
    for (const b of gueltig) this.oeffnen(b.typ, b.parameter, b.andock ? { andock: b.andock } : b);
  },
};
