// Modul „Druck“: Druckauswahl für Stundenpläne (PDF groß/kompakt, eigenes Format, HTML), Druckvorschau, Aushang (HTML bzw.
// ZIP), iCalendar je Lehrkraft, Vertretungsplan-Ausgabe mit Seitenlayout und Berichte (PDF/HTML/CSV). Alle Dateien erzeugt
// der Server (Api/DruckApi.cs, /api/dokumente/{dok}/druck/…).
import { lazy } from 'react';
import { seiteOeffnen, type Params } from '@/kern/befehle';
import { zustand } from '@/kern/zustand';
import type { StudioModul } from '../typen';
import { iCalendar, infoStundenplan } from './dialoge';

const mitDok = (f: (a: Params) => unknown) => (a: Params) => (zustand().dokument ? f(a || {}) : null);

const modul: StudioModul = {
  id: 'druck',
  ansichten: {
    'druck.vorschau': { titel: 'Druckvorschau', pfad: 'druck/vorschau', komponente: lazy(() => import('./Vorschau')), schluessel: (p) => String(p.url || '') },
    'druck.auswahl': { titel: 'Druckauswahl', pfad: 'druck', komponente: lazy(() => import('./Auswahl')) },
    'druck.berichte': { titel: 'Berichte', pfad: 'berichte', komponente: lazy(() => import('./Berichte')) },
    'druck.vertretung': { titel: 'Vertretungsplan ausgeben', pfad: 'vertretungsplan-ausgabe', komponente: lazy(() => import('./Vertretungsplan')) },
  },
  befehle: {
    'druck.stundenplaene': mitDok((a) => seiteOeffnen('druck.auswahl', a)),
    'druck.berichte': mitDok((a) => seiteOeffnen('druck.berichte', a)),
    'druck.vertretung': mitDok((a) => seiteOeffnen('druck.vertretung', a)),
    'druck.info': mitDok(infoStundenplan),
    'druck.ical': mitDok(iCalendar),
    'druck.vorschau': mitDok((a) => seiteOeffnen('druck.vorschau', { url: a.url, titel: a.titel })),
  },
  eintraege: [
    { id: 'start.infostundenplan', text: 'Aushang (HTML)', befehl: 'druck.info', braucht: 'dokument', gruppe: 'Ausgabe' },
    {
      id: 'start.berichte', text: 'Drucken', gruppe: 'Ausgabe', braucht: 'dokument', ansicht: { typ: 'druck.auswahl', p: { typ: 'klasse' } }, taste: 'Strg+P',
      menue: [
        { text: 'Klassenpläne drucken', ansicht: { typ: 'druck.auswahl', p: { typ: 'klasse' } } },
        { text: 'Pläne der Lehrkräfte drucken', ansicht: { typ: 'druck.auswahl', p: { typ: 'lehrer' } } },
        { text: 'Raumpläne drucken', ansicht: { typ: 'druck.auswahl', p: { typ: 'raum' } } },
        null,
        { text: 'Vertretungsplan ausgeben', ansicht: { typ: 'druck.vertretung' } },
        { text: 'Berichte (Listen, Auswertungen)', ansicht: { typ: 'druck.berichte' } },
      ],
    },
    { id: 'stundenplaene.drucken', text: 'Stundenpläne drucken', ansicht: { typ: 'druck.auswahl', p: { typ: 'klasse' } }, braucht: 'dokument', gruppe: 'Ausgabe' },
    { id: 'stundenplaene.html', text: 'Aushang (HTML)', befehl: 'druck.info', braucht: 'dokument', gruppe: 'Ausgabe' },
    { id: 'stundenplaene.ical', text: 'Kalenderdateien (iCal)', befehl: 'druck.ical', braucht: 'dokument', gruppe: 'Ausgabe' },
    { id: 'stundenplaene.berichte', text: 'Berichte', ansicht: { typ: 'druck.berichte' }, braucht: 'dokument', gruppe: 'Ausgabe' },
    { id: 'vertretung.ausgabe', text: 'Vertretungsplan ausgeben', ansicht: { typ: 'druck.vertretung' }, braucht: 'dokument', gruppe: 'Vertretungsplanung', hinweis: 'Vertretungsplan drucken (PDF), HTML und Monitor; Seitenlayout' },
  ],
};

export default modul;
