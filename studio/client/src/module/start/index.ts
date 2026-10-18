// Modul „Start“: Übersicht der Schuldatei (Kennzahlen, Planqualität, häufige Aufgaben), Elementmenüs, Moduswechsel,
// gespeicherte Arbeitsplätze (aktuelle Seite unter einem Namen merken und wieder öffnen).
import { lazy } from 'react';
import { einstellungLesen, einstellungSchreiben } from '@/api/client';
import { adresseOeffnen, arbeitsplatzOeffnen, seiteOeffnen, type Befehlseintrag } from '@/kern/befehle';
import { modusSetzen, zustand } from '@/kern/zustand';
import { formular, frage } from '@/komponenten/dialoge';
import { hinweis } from '@/komponenten/hinweise';
import { menue } from '@/komponenten/menue';
import type { StudioModul } from '../typen';

const ANORDNUNGEN = 'fenster.anordnungen';

function elementMenue(typ: string, mehrzahl: string): Befehlseintrag['menue'] {
  const e: Befehlseintrag['menue'] = [{ text: 'Stammdaten', ansicht: { typ: 'stammdaten', p: { typ } } }];
  if (typ !== 'raum') e.push({ text: 'Unterricht', ansicht: { typ: 'unterricht', p: { sicht: typ } } });
  e.push(null, { text: `${mehrzahl}plan`, ansicht: { typ: 'stundenplan', p: { typ } } });
  return e;
}

async function anordnungenMenue() {
  const alle = ((await einstellungLesen<Record<string, unknown>>(ANORDNUNGEN)) || {}) as Record<string, unknown>;
  const namen = Object.keys(alle).filter((n) => typeof alle[n] === 'string').sort();
  const k = (document.activeElement as HTMLElement | null)?.getBoundingClientRect?.();
  const x = k && k.width ? k.left : window.innerWidth - 320;
  const y = k && k.height ? k.bottom + 2 : 56;
  menue(x, y, [
    { text: 'Aktuelle Seite als Arbeitsplatz speichern …', aktion: anordnungSpeichern },
    null,
    namen.length ? { titel: 'Öffnen' } : { text: 'Noch keine gespeicherten Arbeitsplätze', deaktiviert: true },
    ...namen.map((n) => ({ text: n, aktion: () => adresseOeffnen(String(alle[n])) })),
    namen.length ? null : undefined,
    namen.length ? { text: 'Löschen', menue: namen.map((n) => ({ text: n, aktion: () => anordnungLoeschen(n) })) } : undefined,
  ]);
}

async function anordnungSpeichern() {
  const w = await formular('Arbeitsplatz speichern', [{ name: 'name', titel: 'Name', pflicht: true, hinweis: 'Gleicher Name überschreibt einen vorhandenen Arbeitsplatz.' }], { okText: 'Speichern' });
  if (!w) return;
  const alle = ((await einstellungLesen<Record<string, unknown>>(ANORDNUNGEN)) || {}) as Record<string, unknown>;
  alle[String(w.name).trim()] = window.location.pathname + window.location.search;
  await einstellungSchreiben(ANORDNUNGEN, alle);
  hinweis(`Arbeitsplatz „${w.name}“ gespeichert.`, 'ok');
}

async function anordnungLoeschen(name: string) {
  if (!(await frage(`Arbeitsplatz „${name}“ löschen?`))) return;
  const alle = ((await einstellungLesen<Record<string, unknown>>(ANORDNUNGEN)) || {}) as Record<string, unknown>;
  delete alle[name];
  await einstellungSchreiben(ANORDNUNGEN, alle);
}

function modusUmschalten() {
  const neu = zustand().modus === 'vertretung' ? 'stundenplan' : 'vertretung';
  modusSetzen(neu);
  hinweis(neu === 'vertretung' ? 'Vertretungsplanung' : 'Stundenplanung', 'info', 1500);
}

const modul: StudioModul = {
  id: 'start',
  ansichten: {
    'start.uebersicht': { titel: 'Übersicht', pfad: 'uebersicht', komponente: lazy(() => import('./Uebersicht')) },
  },
  befehle: {
    'start.uebersicht': () => (zustand().dokument ? seiteOeffnen('start.uebersicht') : null),
    'fenster.anordnungen': anordnungenMenue,
    'fenster.standard': () => arbeitsplatzOeffnen('manuell'),
    'modus.umschalten': modusUmschalten,
  },
  eintraege: [
    { id: 'start.uebersicht', text: 'Übersicht', ansicht: { typ: 'start.uebersicht' }, braucht: 'dokument', gruppe: 'Start' },
    { id: 'start.klassen', text: 'Klassen', braucht: 'dokument', gruppe: 'Start', menue: elementMenue('klasse', 'Klassen') },
    { id: 'start.lehrer', text: 'Lehrkräfte', braucht: 'dokument', gruppe: 'Start', menue: elementMenue('lehrer', 'Lehrer') },
    { id: 'start.raeume', text: 'Räume', braucht: 'dokument', gruppe: 'Start', menue: elementMenue('raum', 'Raum') },
    { id: 'start.faecher', text: 'Fächer', braucht: 'dokument', gruppe: 'Start', menue: elementMenue('fach', 'Fach') },
    { id: 'start.vertretungsmodus', text: 'Modus wechseln (Stundenplanung / Vertretungsplanung)', befehl: 'modus.umschalten', taste: 'Strg+Umschalt+V', gruppe: 'Start', hinweis: 'Zwischen Stundenplanung und Vertretungsplanung wechseln' },
    { id: 'start.fenster.anordnungen', text: 'Gespeicherte Arbeitsplätze', befehl: 'fenster.anordnungen', gruppe: 'Start', hinweis: 'Aktuelle Seite als Arbeitsplatz speichern, laden und löschen' },
  ],
};

export default modul;
