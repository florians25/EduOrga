// Navigation: Seitenleiste mit Arbeitsbereichen und Befehlssuche (Strg+K).
//
// Die Befehle selbst kommen weiterhin aus den Modulen (Einträge mit id, befehl, args, menue, braucht … – siehe
// modulsystem.js). Die Seitenleiste ordnet sie hier fachlich: NAVIGATION verweist per `ref` auf die Eintrags-id eines
// Moduls (Befehl, Untermenü, Rechte und Zustand werden von dort übernommen) oder nennt `befehl`/`args` direkt.
// Die Befehlssuche findet zusätzlich alle übrigen Einträge und Untermenüpunkte – keine Funktion geht verloren.
import { h, leeren, vergleich } from './dom.js';
import { symbol } from './symbole.js';
import { an } from './ereignisse.js';
import { zustand } from './zustand.js';
import { menue, menueSchliessen } from './dialog.js';
import { alleRibbonEintraege, verfuegbar, eintragAusfuehren } from './modulsystem.js';
import { einstellungLesen, einstellungSchreiben } from './api.js';

/** Fachliche Gliederung. modus: nur in diesem Modus sichtbar. */
export const NAVIGATION = [
  {
    id: 'vertretung', titel: 'Vertretungsplanung', modus: 'vertretung', eintraege: [
      { text: 'Tagesplanung', befehl: 'vertretung.standard', braucht: 'dokument', hinweis: 'Kalender, Abwesenheiten, Vertretungen, Vorschlag und Tagespläne zusammen' },
      { ref: 'vertretung.kalender', text: 'Kalender', symbol: 'kalender', befehl: 'vertretung.kalender' },
      { ref: 'vertretung.absenzen', text: 'Abwesenheiten', befehl: 'vertretung.absenzen' },
      { ref: 'vertretung.vertretungen', text: 'Vertretungen', symbol: 'vertretung', befehl: 'vertretung.liste' },
      { ref: 'vertretung.vorschlag', text: 'Vertretungsvorschlag', symbol: 'zuweisen' },
      { ref: 'vertretung.automatik', text: 'Automatische Vertretung', symbol: 'optimierung' },
      { ref: 'vertretung.planungsdialog', text: 'Verlegen und Tauschen', symbol: 'tausch' },
      { ref: 'vertretung.vormerkungen', text: 'Vormerkungen', symbol: 'gekennzeichnet' },
    ],
  },
  {
    id: 'ereignisse', titel: 'Ereignisse', modus: 'vertretung', eintraege: [
      { ref: 'vertretung.veranstaltungen', text: 'Veranstaltungen', symbol: 'veranstaltung' },
      { ref: 'vertretung.sondereinsaetze', text: 'Sondereinsätze', symbol: 'zuweisen' },
      { ref: 'vertretung.bereitschaften', text: 'Bereitschaften', symbol: 'zeitwunsch' },
      { ref: 'eingabe.bereitschaft', text: 'Bereitschaftsplanung', symbol: 'kalender' },
      { ref: 'vertretung.pausenaufsichten', text: 'Pausenaufsichten', symbol: 'pausenaufsicht' },
    ],
  },
  {
    id: 'tagesplaene', titel: 'Tagespläne', modus: 'vertretung', eintraege: [
      { ref: 'vertretung.plan.klasse', text: 'Klassen', symbol: 'klassen' },
      { ref: 'vertretung.plan.lehrer', text: 'Lehrkräfte', symbol: 'lehrer' },
      { ref: 'vertretung.plan.raum', text: 'Räume', symbol: 'raeume' },
      { ref: 'vertretung.plan.klein', text: 'Kompaktpläne', symbol: 'nebeneinander' },
    ],
  },
  {
    id: 'vertretung-ausgabe', titel: 'Auswertung und Ausgabe', modus: 'vertretung', eintraege: [
      { ref: 'vertretung.ausgabe', text: 'Vertretungsplan ausgeben', symbol: 'drucken' },
      { ref: 'vertretung.statistik', text: 'Statistik und Abrechnung', symbol: 'statistik' },
      { ref: 'vertretung.untplanweb', text: 'UntPlan Web', symbol: 'web' },
      { ref: 'vertretung.formate', text: 'Listenansichten', symbol: 'spalten' },
      { ref: 'vertretung.einstellungen', text: 'Einstellungen', symbol: 'einstellungen' },
    ],
  },
  {
    id: 'stammdaten', titel: 'Stammdaten', eintraege: [
      { ref: 'eingabe.klassen', text: 'Klassen', symbol: 'klassen' },
      { ref: 'eingabe.lehrer', text: 'Lehrkräfte', symbol: 'lehrer' },
      { ref: 'eingabe.raeume', text: 'Räume', symbol: 'raeume' },
      { ref: 'eingabe.faecher', text: 'Fächer', symbol: 'faecher' },
      { ref: 'eingabe.schueler', text: 'Schülerinnen und Schüler', symbol: 'schueler' },
      { ref: 'eingabe.raumgruppen', text: 'Raumgruppen', symbol: 'raeume', weitere: true },
      { ref: 'eingabe.gaenge', text: 'Gänge (Aufsichtsbereiche)', symbol: 'gaenge', weitere: true },
      { ref: 'eingabe.abteilungen', text: 'Abteilungen', symbol: 'abteilungen', weitere: true },
      { ref: 'eingabe.gruende', text: 'Abwesenheitsgründe', symbol: 'abwesenheit', weitere: true },
      { ref: 'eingabe.kommentare', text: 'Kommentare', symbol: 'info', weitere: true },
    ],
  },
  {
    id: 'unterricht', titel: 'Unterricht', modus: 'stundenplan', eintraege: [
      { ref: 'eingabe.unterricht.klassen', text: 'Nach Klassen', symbol: 'unterricht' },
      { ref: 'eingabe.unterricht.lehrer', text: 'Nach Lehrkräften', symbol: 'unterricht' },
      { ref: 'eingabe.unterricht.faecher', text: 'Nach Fächern', symbol: 'unterricht' },
      { ref: 'eingabe.unterricht.alle', text: 'Alle Unterrichte', symbol: 'liste' },
      { ref: 'eingabe.zeitwuensche', text: 'Zeitwünsche', symbol: 'zeitwunsch' },
      { ref: 'planung.uzeitwuensche', text: 'Zeitwünsche je Unterricht', symbol: 'zeitwunsch', weitere: true },
      { ref: 'eingabe.ugruppen', text: 'Unterrichtsgruppen', symbol: 'perioden', weitere: true },
      { ref: 'eingabe.stundentafel', text: 'Stundentafel', symbol: 'uebersicht', weitere: true },
    ],
  },
  {
    id: 'planung', titel: 'Planung', modus: 'stundenplan', eintraege: [
      { text: 'Manuell planen', befehl: 'fenster.standard', braucht: 'dokument', hinweis: 'Unterricht und Klassenplan nebeneinander' },
      { ref: 'planung.optimierung', text: 'Automatische Planung', symbol: 'optimierung' },
      { ref: 'planung.diagnose', text: 'Diagnose', symbol: 'diagnose' },
      { ref: 'planung.gewichtung', text: 'Gewichtung', symbol: 'gewichtung' },
      { ref: 'planung.tausch', text: 'Tauschvorschläge', symbol: 'tausch' },
      { ref: 'planung.raum', text: 'Räume zuordnen', symbol: 'raeume' },
      { ref: 'planung.fixieren', text: 'Fixierungen', symbol: 'fixieren', weitere: true },
      { ref: 'planung.entplanen', text: 'Alle Stunden entplanen', symbol: 'loeschen', weitere: true },
    ],
  },
  {
    id: 'stundenplaene', titel: 'Stundenpläne', eintraege: [
      { ref: 'stundenplaene.klasse', text: 'Klassen', symbol: 'klassen' },
      { ref: 'stundenplaene.lehrer', text: 'Lehrkräfte', symbol: 'lehrer' },
      { ref: 'stundenplaene.raum', text: 'Räume', symbol: 'raeume' },
      { ref: 'stundenplaene.fach', text: 'Fächer', symbol: 'faecher' },
      { ref: 'stundenplaene.uebersicht.klasse', text: 'Gesamtübersicht Klassen', symbol: 'uebersicht' },
      { ref: 'stundenplaene.uebersicht.lehrer', text: 'Gesamtübersicht Lehrkräfte', symbol: 'uebersicht' },
      { ref: 'stundenplaene.uebersicht.raum', text: 'Gesamtübersicht Räume', symbol: 'uebersicht', weitere: true },
      { text: 'Kompaktpläne', symbol: 'nebeneinander', braucht: 'dokument', weitere: true, menue: [
        { text: 'Klassen kompakt', befehl: 'stundenplan.oeffnen', args: { typ: 'klasse', kompakt: true } },
        { text: 'Lehrkräfte kompakt', befehl: 'stundenplan.oeffnen', args: { typ: 'lehrer', kompakt: true } },
        { text: 'Räume kompakt', befehl: 'stundenplan.oeffnen', args: { typ: 'raum', kompakt: true } },
      ] },
      { ref: 'stundenplaene.formate', text: 'Planformate', symbol: 'spalten', weitere: true },
    ],
  },
  {
    id: 'kursplanung', titel: 'Oberstufe', modus: 'stundenplan', eintraege: [
      { ref: 'kurs.kurse', text: 'Kurse und Bänder', symbol: 'kurs' },
      { ref: 'kurs.schueler', text: 'Schülerinnen und Schüler', symbol: 'schueler' },
      { ref: 'kurs.import', text: 'Kurswahlen importieren', symbol: 'import' },
    ],
  },
  {
    id: 'auswertung', titel: 'Auswertung', modus: 'stundenplan', eintraege: [
      { ref: 'module.sollist', text: 'Soll und Ist', symbol: 'statistik' },
      { ref: 'module.matrix', text: 'Unterrichtsmatrix', symbol: 'uebersicht' },
      { ref: 'module.statistik', text: 'Vertretungsstatistik', symbol: 'statistik' },
      { ref: 'start.pausenaufsichten', text: 'Pausenaufsichten', symbol: 'pausenaufsicht' },
    ],
  },
  {
    id: 'ausgabe', titel: 'Ausgabe', eintraege: [
      { ref: 'start.berichte', text: 'Drucken', symbol: 'drucken' },
      { ref: 'stundenplaene.berichte', text: 'Berichte und Listen', symbol: 'liste' },
      { ref: 'stundenplaene.html', text: 'Aushang (HTML)', symbol: 'web' },
      { ref: 'stundenplaene.ical', text: 'Kalenderdateien (iCal)', symbol: 'kalender' },
    ],
  },
  {
    id: 'austausch', titel: 'Datenaustausch', eintraege: [
      { ref: 'eingabe.importexport', text: 'Import und Export', symbol: 'austausch' },
      { ref: 'start.untplanweb', text: 'UntPlan Web', symbol: 'web' },
      { ref: 'eingabe.bal', text: 'BAL-Import', symbol: 'bal', weitere: true },
    ],
  },
  {
    id: 'schule', titel: 'Schule', eintraege: [
      { ref: 'start.einstellungen', text: 'Schuldaten', symbol: 'schule' },
      { ref: 'eingabe.zeitraster', text: 'Zeitraster', symbol: 'zeitwunsch' },
      { ref: 'eingabe.ferien', text: 'Ferien und Kalender', symbol: 'kalender' },
      { ref: 'start.perioden', text: 'Perioden', symbol: 'perioden' },
      { ref: 'start.multiuser', text: 'Mehrbenutzerbetrieb', symbol: 'klassen' },
    ],
  },
];

// ---------------------------------------------------------------------------------------------

/** Eintrag aus Navigation/Suche ausführen: öffnet seine Ansicht als neue Seite. */
async function neueSeite(e) {
  const { fensterverwaltung } = await import('./fenster.js');
  fensterverwaltung.naechsterAufrufNeueSeite();
  return eintragAusfuehren(e);
}

function registriert() {
  return new Map(alleRibbonEintraege().map((e) => [e.id, e]));
}

/** Navigationseintrag mit den Angaben des Modul-Eintrags zusammenführen. */
function aufloesen(n, reg) {
  const r = n.ref ? reg.get(n.ref) : null;
  if (n.ref && !r) return null;
  const e = { ...(r || {}), ...n, id: n.ref || `nav:${n.text}` };
  if (r && !n.befehl) { e.befehl = r.befehl; e.args = r.args; e.aktion = r.aktion; }
  if (r && !n.menue) e.menue = r.menue;
  if (r && !n.braucht) e.braucht = r.braucht;
  if (n.befehl && r?.menue && !n.menue) e.menue = null; // Hauptbefehl direkt, Untermenü nur in der Suche
  return e;
}

function sichtbar(gruppe) {
  return !gruppe.modus || gruppe.modus === zustand.modus;
}

export class Navigation {
  constructor(eltern) {
    this.eingeklappt = false;
    this.offen = {};
    this.knoepfe = [];
    this.liste = h('nav', { class: 'nav-liste', 'aria-label': 'Arbeitsbereiche' });
    this.fuss = h('div', { class: 'nav-fuss' });
    this.el = h('aside', { class: 'navigation' },
      h('div', { class: 'nav-kopf' }, h('span', { class: 'nav-marke' }, h('b', null, 'UntPlan'), h('span', null, 'Studio'))),
      this.liste, this.fuss);
    eltern.append(this.el);
    for (const name of ['stand', 'dokument', 'benutzer']) an(name, () => this.aktualisieren());
    an('modus', () => this.zeichnen());
    an('seite', ({ arbeitsplatz }) => { this.seitentitel = arbeitsplatz || null; this.markieren(); });
    Promise.all([einstellungLesen('navigation.eingeklappt'), einstellungLesen('navigation.offen')]).then(([ein, offen]) => {
      if (offen && typeof offen === 'object') this.offen = offen;
      if (ein) this.einklappen(true, false);
      else this.zeichnen();
    }).catch(() => {});
  }

  /** Seitenleiste aus- bzw. einblenden (Strg+B). */
  einklappen(ein, speichern = true) {
    this.eingeklappt = ein;
    document.documentElement.classList.toggle('nav-eingeklappt', ein);
    if (speichern) einstellungSchreiben('navigation.eingeklappt', ein);
    this.zeichnen();
  }

  zeichnen() {
    leeren(this.liste);
    this.knoepfe = [];
    const reg = registriert();
    this.liste.append(this._knopf({ id: 'nav:uebersicht', text: 'Übersicht', befehl: 'start.uebersicht', braucht: 'dokument' }, 'haupt'));
    for (const g of NAVIGATION.filter(sichtbar)) {
      const eintraege = g.eintraege.map((n) => aufloesen(n, reg)).filter(Boolean);
      if (!eintraege.length) continue;
      const offen = this.offen[g.id] !== false;
      const inhalt = h('div', { class: 'nav-eintraege', hidden: !offen });
      for (const e of eintraege) inhalt.append(this._knopf(e));
      const kopf = h('button', {
        type: 'button', class: `nav-gruppe${offen ? ' offen' : ''}`, 'aria-expanded': offen ? 'true' : 'false',
        onclick: () => { this.offen[g.id] = !offen; einstellungSchreiben('navigation.offen', this.offen); this.zeichnen(); },
      }, h('span', null, g.titel), symbol('pfeil_runter'));
      this.liste.append(h('div', { class: 'nav-abschnitt', dataset: { gruppe: g.id } }, kopf, inhalt));
    }
    leeren(this.fuss);
    this.fuss.append(
      this._knopf({ id: 'nav:dateien', text: 'Schuldateien', befehl: 'datei.backstage', args: { seite: 'oeffnen' } }, 'fussknopf'));
    this.aktualisieren();
    this.markieren();
  }

  _knopf(e, art = '') {
    const k = h('button', {
      class: `nav-punkt ${art}`, type: 'button', title: e.hinweis || '', dataset: { id: e.id },
    }, h('span', { class: 'text' }, e.text), e.menue ? symbol('pfeil_rechts', 'nav-pfeil') : null);
    k.addEventListener('click', () => {
      if (e.menue) {
        const r = k.getBoundingClientRect();
        menue(r.right + 4, r.top, e.menue.map((m) => (m ? { ...m, symbol: undefined, deaktiviert: !verfuegbar({ braucht: e.braucht, ...m }), aktion: () => neueSeite(m) } : null)));
      } else neueSeite(e);
    });
    this.knoepfe.push({ k, e });
    return k;
  }

  /** Aktiviert/deaktiviert die Einträge nach Dokument, Rechten und Modus. */
  aktualisieren() {
    for (const { k, e } of this.knoepfe) {
      k.disabled = !verfuegbar(e);
      k.classList.toggle('gedrueckt', !!e.gedrueckt?.());
    }
  }

  /** Markiert den Eintrag, der zur gezeigten Seite gehört (Arbeitsplatz über den Titel, sonst über die Hauptansicht). */
  async markieren() {
    const { fensterverwaltung } = await import('./fenster.js');
    const haupt = fensterverwaltung.anordnung()[0];
    const titel = this.seitentitel;
    let gefunden = false;
    for (const { k, e } of this.knoepfe) {
      const an_ = !gefunden && (titel ? e.text === titel : !!haupt && passt(e, haupt));
      if (an_) gefunden = true;
      k.classList.toggle('aktiv', an_);
    }
  }

  /** Kompatibilität mit älteren Modulen (Menüband). */
  zeige() {}
}

/** Gehört der Eintrag zur Ansicht? (gleicher Befehl und gleiche Parameter, grob) */
function passt(e, f) {
  if (!e.befehl) return false;
  const typ = f.typ, p = f.parameter || {};
  const [modul] = e.befehl.split('.');
  if (e.befehl === 'start.uebersicht') return typ === 'start.uebersicht';
  if (e.befehl === 'stammdaten.oeffnen') return typ === 'stammdaten' && p.typ === e.args?.typ;
  if (e.befehl === 'unterricht.oeffnen') return typ === 'unterricht' && p.sicht === e.args?.sicht;
  if (e.befehl === 'stundenplan.oeffnen') return typ === 'stundenplan' && p.typ === e.args?.typ && !!p.kompakt === !!e.args?.kompakt && e.id !== 'planung.planen';
  if (e.befehl === 'vertretung.plan') return typ === 'vertretung.plan' && p.typ === e.args?.typ && !p.kompakt;
  if (e.befehl === 'uebersicht.oeffnen') return typ === 'uebersicht' && p.typ === e.args?.typ;
  if (e.befehl === 'zeitwuensche.oeffnen') return typ === 'zeitwuensche' && (e.args?.typ === 'unterricht') === (p.typ === 'unterricht');
  if (e.befehl === 'vertretung.liste') return typ === 'vertretung.liste';
  if (e.befehl === 'vertretung.absenzen') return typ === 'vertretung.absenzen';
  if (e.befehl === 'vertretung.kalender') return typ === 'vertretung.kalender';
  if (e.befehl === 'vertretung.vorschlag') return typ === 'vertretung.vorschlag';
  if (e.befehl === 'vertretung.vormerkungen') return typ === 'vertretung.vormerkungen';
  if (e.befehl === 'vertretung.bereitschaften') return typ === 'vertretung.bereitschaften';
  return modul !== 'vertretung' && modul !== 'stundenplan' && typ === e.befehl.replace(/\.oeffnen$/, '');
}

// ---------------------------------------------------------------------------------------------
// Befehlssuche (Strg+K)

/** Alle ausführbaren Befehle (Navigation, Moduleinträge, Untermenüpunkte) mit Suchtext. */
function befehlsliste() {
  const reg = registriert();
  const liste = [];
  const gesehen = new Set();
  const dazu = (text, ort, e, sym) => {
    if (!e || (!e.befehl && !e.aktion) || e.element) return;
    const schluessel = `${e.befehl || text}|${JSON.stringify(e.args || {})}`;
    if (gesehen.has(schluessel)) return;
    gesehen.add(schluessel);
    liste.push({ text, ort, e, symbol: sym || e.symbol || 'modul' });
  };
  for (const g of NAVIGATION.filter(sichtbar)) {
    for (const n of g.eintraege) {
      const e = aufloesen(n, reg);
      if (!e) continue;
      dazu(e.text, g.titel, e);
      for (const m of e.menue || []) if (m) dazu(m.text.replace(/\s*…$/, ''), `${g.titel} › ${e.text}`, { braucht: e.braucht, ...m }, e.symbol);
    }
  }
  for (const e of alleRibbonEintraege()) {
    if (e.geplant) continue;
    const t = (e.text || '').replace(/-/g, '');
    dazu(t, 'Weitere Befehle', e);
    for (const m of e.menue || []) if (m) dazu(m.text.replace(/\s*…$/, ''), t, { braucht: e.braucht, ...m }, e.symbol);
  }
  return liste;
}

function normal(t) {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');
}

let suchOffen = null;

export function befehlssuche() {
  if (suchOffen) { suchOffen.querySelector('input').focus(); return; }
  menueSchliessen();
  const alle = befehlsliste().filter((b) => verfuegbar(b.e));
  const eingabe = h('input', { class: 'bs-eingabe', type: 'text', placeholder: 'Befehl oder Ansicht suchen …', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Befehl suchen' });
  const ergebnis = h('div', { class: 'bs-liste', role: 'listbox' });
  const box = h('div', { class: 'bs-box', role: 'dialog', 'aria-label': 'Befehlssuche' },
    h('div', { class: 'bs-kopf' }, symbol('suchen'), eingabe, h('kbd', null, 'Esc')), ergebnis,
    h('div', { class: 'bs-fuss' }, h('span', null, h('kbd', null, '↑'), h('kbd', null, '↓'), ' auswählen'), h('span', null, h('kbd', null, 'Enter'), ' öffnen')));
  const hg = h('div', { class: 'bs-hintergrund' }, box);
  let treffer = [], index = 0;
  const zu = () => { hg.remove(); suchOffen = null; };
  const ausfuehren = (b) => { zu(); neueSeite(b.e); };
  const zeichnen = () => {
    const q = normal(eingabe.value.trim());
    const teile = q.split(/\s+/).filter(Boolean);
    treffer = alle.map((b) => {
      const t = normal(b.text), o = normal(b.ort);
      if (!teile.every((x) => t.includes(x) || o.includes(x))) return null;
      const rang = !q ? 0 : t.startsWith(q) ? 0 : t.includes(q) ? 1 : 2;
      return { b, rang };
    }).filter(Boolean).sort((a, c) => a.rang - c.rang || (a.b.ort === 'Weitere Befehle') - (c.b.ort === 'Weitere Befehle') || vergleich(a.b.text, c.b.text)).slice(0, 60).map((x) => x.b);
    if (index >= treffer.length) index = Math.max(0, treffer.length - 1);
    leeren(ergebnis);
    if (!treffer.length) ergebnis.append(h('div', { class: 'bs-leer' }, 'Keine passenden Befehle.'));
    treffer.forEach((b, i) => {
      const z = h('button', { type: 'button', class: `bs-treffer${i === index ? ' aktiv' : ''}`, role: 'option', 'aria-selected': i === index ? 'true' : 'false' },
        h('span', { class: 'bs-text' }, b.text), h('span', { class: 'bs-ort' }, b.ort), b.e.taste ? h('kbd', null, b.e.taste) : null);
      z.addEventListener('click', () => ausfuehren(b));
      z.addEventListener('pointermove', () => { if (index !== i) { index = i; markieren(); } });
      ergebnis.append(z);
    });
  };
  const markieren = () => {
    [...ergebnis.children].forEach((z, i) => { z.classList.toggle('aktiv', i === index); z.setAttribute('aria-selected', i === index ? 'true' : 'false'); });
    ergebnis.children[index]?.scrollIntoView({ block: 'nearest' });
  };
  eingabe.addEventListener('input', () => { index = 0; zeichnen(); });
  eingabe.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); index = Math.min(treffer.length - 1, index + 1); markieren(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); index = Math.max(0, index - 1); markieren(); }
    if (e.key === 'Enter') { e.preventDefault(); if (treffer[index]) ausfuehren(treffer[index]); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); zu(); }
  });
  hg.addEventListener('pointerdown', (e) => { if (e.target === hg) zu(); });
  document.body.append(hg);
  suchOffen = hg;
  zeichnen();
  eingabe.focus();
}
