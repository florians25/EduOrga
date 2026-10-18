// Modul „Veranstaltungen“ (Vertretungsmodus): Exkursionen, Klassenfahrten, Konferenzen … mit betroffenen Klassen, Lehrkräften
// und Räumen.
import { lazy } from 'react';
import { seiteOeffnen } from '@/kern/befehle';
import { zustand } from '@/kern/zustand';
import type { StudioModul } from '../typen';

const modul: StudioModul = {
  id: 'veranstaltungen',
  ansichten: {
    'veranstaltungen.liste': { titel: 'Veranstaltungen', pfad: 'veranstaltungen', modus: 'vertretung', komponente: lazy(() => import('./Veranstaltungen')) },
  },
  befehle: { 'veranstaltungen.oeffnen': () => (zustand().dokument ? seiteOeffnen('veranstaltungen.liste') : null) },
  eintraege: [
    { id: 'vertretung.veranstaltungen', text: 'Veranstaltungen', ansicht: { typ: 'veranstaltungen.liste' }, braucht: 'dokument', gruppe: 'Vertretungsplanung' },
  ],
};

export default modul;
