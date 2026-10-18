// Modul „Pausenaufsichten“: Wochenplan je Aufsichtsbereich bzw. Lehrkraft und Vertretung der Aufsichten eines Tages.
import { lazy } from 'react';
import { seiteOeffnen } from '@/kern/befehle';
import { zustand } from '@/kern/zustand';
import type { StudioModul } from '../typen';

const modul: StudioModul = {
  id: 'pausenaufsicht',
  ansichten: {
    pausenaufsicht: { titel: 'Pausenaufsichten', pfad: 'pausenaufsichten', komponente: lazy(() => import('./Wochenplan')) },
    'pausenaufsicht.vertretung': { titel: 'Vertretung der Pausenaufsichten', pfad: 'pausenaufsichten/vertretung', komponente: lazy(() => import('./Vertretung')), modus: 'vertretung' },
  },
  befehle: {
    'pausenaufsicht.oeffnen': () => (zustand().dokument ? seiteOeffnen('pausenaufsicht') : null),
    'pausenaufsicht.vertretung': () => (zustand().dokument ? seiteOeffnen('pausenaufsicht.vertretung') : null),
  },
  eintraege: [
    { id: 'start.pausenaufsichten', text: 'Pausenaufsichten', ansicht: { typ: 'pausenaufsicht' }, braucht: 'dokument', gruppe: 'Auswertung', hinweis: 'Wochenplan der Pausenaufsichten' },
    {
      id: 'vertretung.pausenaufsichten', text: 'Pausenaufsichten', gruppe: 'Vertretungsplanung', braucht: 'dokument', modus: 'vertretung',
      menue: [
        { text: 'Vertretung der Pausenaufsichten', ansicht: { typ: 'pausenaufsicht.vertretung' } },
        { text: 'Wochenplan', ansicht: { typ: 'pausenaufsicht' } },
      ],
    },
  ],
};

export default modul;
