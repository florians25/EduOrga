// Modul „Start“: Übersicht der Schuldatei (Kennzahlen, Planqualität, Schnellzugriff), Elementmenüs (Klassen, Lehrkräfte,
// Räume, Fächer), Moduswechsel Stundenplan/Vertretung, Arbeitsbereich (anordnen, Anordnungen speichern/laden, alle schließen).
import { zustand, modusSetzen } from '../kern/zustand.js';
import { fensterverwaltung } from '../kern/fenster.js';
import { api, einstellungLesen, einstellungSchreiben } from '../kern/api.js';
import { menue, formular, frage, hinweis } from '../kern/dialog.js';
import { h, leeren, datumDe } from '../kern/dom.js';
import { symbol } from '../kern/symbole.js';
import { betrifft } from '../kern/ereignisse.js';
import { befehl } from '../kern/modulsystem.js';

const ANORDNUNGEN = 'fenster.anordnungen';

function elementMenue(typ, mehrzahl) {
  const e = [
    { text: 'Stammdaten', symbol: typ === 'lehrer' ? 'lehrer' : typ === 'raum' ? 'raeume' : typ === 'fach' ? 'faecher' : 'klassen', befehl: 'stammdaten.oeffnen', args: { typ } },
  ];
  if (typ !== 'raum') e.push({ text: 'Unterricht', symbol: 'unterricht', befehl: 'unterricht.oeffnen', args: { sicht: typ } });
  e.push(null, { text: `${mehrzahl}plan`, symbol: 'stundenplan', befehl: 'stundenplan.oeffnen', args: { typ } });
  return e;
}

// ---------------------------------------------------------------------------------------------
// Übersicht

const KENNZAHLEN = [
  ['kollisionen', 'Kollisionen'], ['nichtVerplant', 'Nicht verplante Stunden'], ['ohneRaum', 'Stunden ohne Raum'],
  ['hohlstundenKlassen', 'Hohlstunden Klassen'], ['hohlstundenLehrer', 'Hohlstunden Lehrkräfte'], ['kernzeitverletzungen', 'Kernzeitverletzungen'],
  ['zeitwunschverletzungen', 'Zeitwunschverletzungen'], ['doppelstundenfehler', 'Doppelstundenfehler'], ['fachZweimalTag', 'Fach zweimal am Tag'],
];

function uebersicht(f) {
  f.titel('Übersicht');
  const seite = h('div', { class: 'st-seite' });
  f.inhalt.append(seite);
  f.werkzeug({ text: 'Aktualisieren', symbol: 'wiederholen', aktion: () => laden() });

  const kachel = (sym, wert, text, befehlName, args) => h('button', { type: 'button', class: 'st-kachel', onclick: () => befehl(befehlName, args) },
    h('span', { class: 'st-kachel-kopf' }, symbol(sym), text), h('span', { class: 'st-wert' }, String(wert ?? '–')));
  const zeile = (text, wert, schlecht) => h('div', { class: `st-kz${schlecht ? ' achtung' : ''}` },
    h('span', { class: 'st-kz-symbol' }, symbol(schlecht ? 'warnung' : 'haken')), h('span', { class: 'st-kz-text' }, text),
    h('span', { class: 'st-kz-wert' }, String(wert ?? 0)));
  const aktion = (sym, text, befehlName, args) => h('button', { type: 'button', class: 'st-aktion', onclick: () => befehl(befehlName, args) }, symbol(sym), h('span', null, text), symbol('pfeil_rechts'));

  async function laden() {
    const d = zustand.dokument;
    if (!d) return;
    let k = {};
    try { k = await api.get(api.dok('/optimierung/kennzahlen')); } catch { /* ohne Kennzahlen */ }
    const z = d.zaehler || {};
    const offen = KENNZAHLEN.filter(([s]) => (k[s] ?? 0) > 0).length;
    leeren(seite).append(
      h('header', { class: 'st-kopf' },
        h('div', null, h('h1', null, d.schulname || d.name),
          h('div', { class: 'st-meta' }, [d.schuljahr && `Schuljahr ${d.schuljahr}`, d.periode && `${d.periode}${d.periodeFixiert ? ' (fixiert)' : ''}`,
            d.geaendert ? 'Nicht gespeicherte Änderungen' : d.gespeichert ? `Gespeichert ${datumDe(d.gespeichert)}` : null].filter(Boolean).map((t) => h('span', null, t))))),
      h('div', { class: 'st-kacheln' },
        kachel('klassen', z.klassen, 'Klassen', 'stammdaten.oeffnen', { typ: 'klasse' }),
        kachel('lehrer', z.lehrer, 'Lehrkräfte', 'stammdaten.oeffnen', { typ: 'lehrer' }),
        kachel('raeume', z.raeume, 'Räume', 'stammdaten.oeffnen', { typ: 'raum' }),
        kachel('faecher', z.faecher, 'Fächer', 'stammdaten.oeffnen', { typ: 'fach' }),
        kachel('unterricht', z.unterrichte, 'Unterrichte', 'unterricht.oeffnen', { sicht: 'alle' }),
        kachel('stundenplan', z.planstunden, 'Planstunden', 'stundenplan.oeffnen', { typ: 'klasse' })),
      h('div', { class: 'st-spalten' },
        h('section', { class: 'st-karte' },
          h('div', { class: 'st-karte-kopf' }, h('h2', null, 'Planqualität'),
            h('span', { class: `plakette ${offen ? 'warnung' : 'ok'}` }, offen ? `${offen} Hinweise` : 'Ohne Befund')),
          k.bewertung !== undefined ? h('div', { class: 'st-bewertung' }, h('span', { class: 'leise' }, 'Bewertungszahl'), h('b', null, String(k.bewertung)), h('span', { class: 'leise' }, 'kleiner ist besser')) : null,
          h('div', { class: 'st-kz-liste' }, KENNZAHLEN.map(([s, t]) => zeile(t, k[s], (k[s] ?? 0) > 0))),
          h('div', { class: 'st-karte-fuss' },
            h('button', { type: 'button', class: 'knopf klein', onclick: () => befehl('optimierung.diagnose') }, symbol('diagnose'), 'Diagnose'),
            h('button', { type: 'button', class: 'knopf klein', onclick: () => befehl('optimierung.starten') }, symbol('optimierung'), 'Automatische Planung'))),
        h('section', { class: 'st-karte' },
          h('div', { class: 'st-karte-kopf' }, h('h2', null, 'Schnellzugriff')),
          h('div', { class: 'st-aktionen' },
            aktion('unterricht', 'Unterricht nach Klassen', 'unterricht.oeffnen', { sicht: 'klasse' }),
            aktion('stundenplan', 'Manuell planen', 'fenster.standard'),
            aktion('zeitwunsch', 'Zeitwünsche der Lehrkräfte', 'zeitwuensche.oeffnen', { typ: 'lehrer' }),
            aktion('uebersicht', 'Gesamtübersicht Klassen', 'uebersicht.oeffnen', { typ: 'klasse' }),
            aktion('vertretung', 'Vertretungsplanung', 'modus.umschalten'),
            aktion('drucken', 'Stundenpläne drucken', 'druck.stundenplaene', { typ: 'klasse' }),
            aktion('web', 'An UntPlan Web übertragen', 'untplanweb.oeffnen')))));
  }
  f.an('stand', () => laden());
  f.an('daten', (e) => { if (betrifft(e, 'Stammdaten', 'Unterricht', 'Stundenplan', 'Einstellungen')) laden(); });
  return laden();
}

async function anordnungenMenue() {
  const knopf = document.activeElement;
  const r = knopf?.getBoundingClientRect?.() || { left: 200, bottom: 160 };
  const alle = (await einstellungLesen(ANORDNUNGEN)) || {};
  const namen = Object.keys(alle).sort();
  menue(r.left, r.bottom + 2, [
    { text: 'Aktuelle Anordnung speichern …', symbol: 'speichern', aktion: anordnungSpeichern },
    null,
    namen.length ? { titel: 'Laden' } : { text: 'Noch keine gespeicherten Anordnungen', deaktiviert: true },
    ...namen.map((n) => ({ text: n, symbol: 'anordnung', aktion: () => fensterverwaltung.anordnungLaden(alle[n]) })),
    namen.length ? null : undefined,
    namen.length ? { text: 'Löschen', symbol: 'loeschen', menue: namen.map((n) => ({ text: n, aktion: () => anordnungLoeschen(n) })) } : undefined,
  ].filter((x) => x !== undefined));
}

async function anordnungSpeichern() {
  const w = await formular('Fensteranordnung speichern', [{ name: 'name', titel: 'Name', pflicht: true, hinweis: 'Gleicher Name überschreibt eine vorhandene Anordnung.' }], { okText: 'Speichern' });
  if (!w) return;
  const alle = (await einstellungLesen(ANORDNUNGEN)) || {};
  alle[w.name.trim()] = fensterverwaltung.anordnung();
  await einstellungSchreiben(ANORDNUNGEN, alle);
  hinweis(`Fensteranordnung „${w.name}“ gespeichert.`, 'ok');
}

async function anordnungLoeschen(name) {
  if (!(await frage(`Fensteranordnung „${name}“ löschen?`))) return;
  const alle = (await einstellungLesen(ANORDNUNGEN)) || {};
  delete alle[name];
  await einstellungSchreiben(ANORDNUNGEN, alle);
}

/** Standard-Fenstergruppe: Unterricht links, Klassenplan rechts. */
function standardFenster() {
  fensterverwaltung.alleSchliessen();
  fensterverwaltung.oeffnen('unterricht', { sicht: 'klasse' }, { andock: 'links' });
  fensterverwaltung.oeffnen('stundenplan', { typ: 'klasse' }, { andock: 'rechts' });
}

function modusUmschalten() {
  const neu = zustand.modus === 'vertretung' ? 'stundenplan' : 'vertretung';
  modusSetzen(neu);
  try { localStorage.setItem('studio.modus', neu); } catch { /* privat */ }
  hinweis(neu === 'vertretung' ? 'Vertretungsplanung' : 'Stundenplanung', 'info', 1500);
}

export default {
  id: 'start',
  css: ['css/module/start.css'],
  fenster: {
    'start.uebersicht': { titel: 'Übersicht', symbol: 'start', einzig: () => 'uebersicht', erstellen: uebersicht },
  },
  befehle: {
    'start.uebersicht': () => (zustand.dokument ? fensterverwaltung.oeffnen('start.uebersicht') : null),
    'fenster.anordnen': ({ art }) => fensterverwaltung.anordnen(art),
    'fenster.alleSchliessen': () => fensterverwaltung.alleSchliessen(),
    'fenster.anordnungen': anordnungenMenue,
    'fenster.standard': standardFenster,
    'modus.umschalten': modusUmschalten,
  },
  ribbon: [
    { id: 'start.klassen', reiter: 'Start', gruppe: 'Übersicht', text: 'Klassen', symbol: 'klassen', gross: true, braucht: 'dokument', menue: elementMenue('klasse', 'Klassen') },
    { id: 'start.lehrer', reiter: 'Start', gruppe: 'Übersicht', text: 'Lehrer', symbol: 'lehrer', gross: true, braucht: 'dokument', menue: elementMenue('lehrer', 'Lehrer') },
    { id: 'start.raeume', reiter: 'Start', gruppe: 'Übersicht', text: 'Räume', symbol: 'raeume', gross: true, braucht: 'dokument', menue: elementMenue('raum', 'Raum') },
    { id: 'start.faecher', reiter: 'Start', gruppe: 'Übersicht', text: 'Fächer', symbol: 'faecher', gross: true, braucht: 'dokument', menue: elementMenue('fach', 'Fach') },
    { id: 'start.vertretungsmodus', reiter: 'Start', gruppe: 'Module', text: 'Vertretungs-planung', symbol: 'vertretung', gross: true, befehl: 'modus.umschalten', taste: 'Strg+Umschalt+V',
      gedrueckt: () => zustand.modus === 'vertretung', hinweis: 'Zwischen Stundenplanung und Vertretungsplanung wechseln' },
    { id: 'start.fenster.standard', reiter: 'Start', gruppe: 'Fenster', text: 'Standard-Fenstergruppe', symbol: 'fenster', befehl: 'fenster.standard', braucht: 'dokument' },
    { id: 'start.fenster.anordnungen', reiter: 'Start', gruppe: 'Fenster', text: 'Fensteranordnungen', symbol: 'anordnung', befehl: 'fenster.anordnungen', hinweis: 'Eigene Fensteranordnungen speichern, laden und löschen' },
    { id: 'start.fenster.alle', reiter: 'Start', gruppe: 'Fenster', text: 'Alle schließen', symbol: 'schliessen', befehl: 'fenster.alleSchliessen' },
    { id: 'start.fenster.ueberlappend', reiter: 'Start', gruppe: 'Fenster', text: 'Überlappend', symbol: 'ueberlappend', befehl: 'fenster.anordnen', args: { art: 'ueberlappend' } },
    { id: 'start.fenster.nebeneinander', reiter: 'Start', gruppe: 'Fenster', text: 'Nebeneinander', symbol: 'nebeneinander', befehl: 'fenster.anordnen', args: { art: 'nebeneinander' } },
    { id: 'start.fenster.untereinander', reiter: 'Start', gruppe: 'Fenster', text: 'Untereinander', symbol: 'untereinander', befehl: 'fenster.anordnen', args: { art: 'untereinander' } },
    { id: 'vertretung.modus', reiter: 'Vertretungsplanung', gruppe: 'Modus', text: 'Vertretungs-planung', symbol: 'vertretung', gross: true, befehl: 'modus.umschalten',
      gedrueckt: () => zustand.modus === 'vertretung', hinweis: 'Zurück zur Stundenplanung (Strg+Umschalt+V)' },
  ],
  start() {
    let m = 'stundenplan';
    try { m = localStorage.getItem('studio.modus') || m; } catch { /* privat */ }
    if (m === 'vertretung') modusSetzen('vertretung');
  },
};
