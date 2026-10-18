// Modul „Planformate“: eigene Formate für Stundenpläne (in der Schuldatei), gewählt in der Druckauswahl.
import { lazy } from 'react';
import { seiteOeffnen, type Params } from '@/kern/befehle';
import { zustand } from '@/kern/zustand';
import type { StudioModul } from '../typen';

const modul: StudioModul = {
  id: 'formate',
  ansichten: { 'formate.editor': { titel: 'Planformate', pfad: 'planformate', komponente: lazy(() => import('./Formate')) } },
  befehle: { 'formate.oeffnen': (a: Params) => (zustand().dokument ? seiteOeffnen('formate.editor', a) : null) },
  eintraege: [
    { id: 'stundenplaene.formate', text: 'Planformate', ansicht: { typ: 'formate.editor' }, braucht: 'dokument', gruppe: 'Ausgabe', hinweis: 'Eigene Formate für Stundenpläne' },
  ],
};

export default modul;
