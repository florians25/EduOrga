// Modul „Zeitwünsche“: Raster-Editor für Zeitwünsche von Klassen, Lehrkräften, Räumen, Fächern und Unterrichten.
import { lazy } from 'react';
import { seiteOeffnen } from '@/kern/befehle';
import { zustand } from '@/kern/zustand';
import type { StudioModul } from '../typen';

const modul: StudioModul = {
  id: 'zeitwuensche',
  ansichten: {
    zeitwuensche: { titel: 'Zeitwünsche', pfad: 'zeitwuensche', komponente: lazy(() => import('./Zeitwuensche')) },
  },
  befehle: {
    'zeitwuensche.oeffnen': ({ typ = 'lehrer', element }: { typ?: string; element?: number } = {}) => (zustand().dokument ? seiteOeffnen('zeitwuensche', { typ, element }) : null),
  },
  eintraege: [
    { id: 'eingabe.zeitwuensche', text: 'Zeitwünsche', ansicht: { typ: 'zeitwuensche', p: { typ: 'lehrer' } }, braucht: 'dokument', gruppe: 'Unterricht', hinweis: 'Zeitwünsche der Lehrkräfte, Klassen, Räume und Fächer (+3 … −3)' },
    { id: 'planung.uzeitwuensche', text: 'Zeitwünsche je Unterricht', ansicht: { typ: 'zeitwuensche', p: { typ: 'unterricht' } }, braucht: 'dokument', gruppe: 'Unterricht' },
  ],
};

export default modul;
