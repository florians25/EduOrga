// Modul „Stundenplan“: Stundenplan je Klasse, Lehrkraft, Raum oder Fach (Ansicht und Planen per Drag & Drop).
import { lazy } from 'react';
import { seiteOeffnen, type Befehlseintrag } from '@/kern/befehle';
import { zustand } from '@/kern/zustand';
import type { StudioModul } from '../typen';

const e = (id: string, text: string, typ: string, extra: Record<string, unknown> = {}, gruppe = 'Stundenpläne'): Befehlseintrag =>
  ({ id, text, ansicht: { typ: 'stundenplan', p: { typ, ...extra } as never }, braucht: 'dokument', gruppe });

const modul: StudioModul = {
  id: 'stundenplan',
  ansichten: {
    stundenplan: { titel: 'Stundenplan', pfad: 'stundenplan', schluessel: (p) => `${p.typ || 'klasse'}`, komponente: lazy(() => import('./Stundenplan')) },
  },
  befehle: {
    'stundenplan.oeffnen': ({ typ = 'klasse', element, kompakt }: { typ?: string; element?: number; kompakt?: boolean } = {}) =>
      (zustand().dokument ? seiteOeffnen('stundenplan', { typ, element, kompakt }) : null),
  },
  eintraege: [
    e('stundenplaene.klasse', 'Klassenplan', 'klasse'),
    e('stundenplaene.lehrer', 'Pläne der Lehrkräfte', 'lehrer'),
    e('stundenplaene.raum', 'Raumplan', 'raum'),
    e('stundenplaene.fach', 'Fachplan', 'fach'),
    e('stundenplaene.klein.klasse', 'Klassenplan kompakt', 'klasse', { kompakt: true }),
    e('stundenplaene.klein.lehrer', 'Pläne der Lehrkräfte kompakt', 'lehrer', { kompakt: true }),
    e('stundenplaene.klein.raum', 'Raumplan kompakt', 'raum', { kompakt: true }),
    { ...e('planung.planen', 'Planen (Stundenplan)', 'klasse', {}, 'Planung'), hinweis: 'Stundenplan öffnen und Stunden per Drag & Drop verplanen' },
  ],
};

export default modul;
