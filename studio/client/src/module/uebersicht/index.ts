// Modul „Gesamtübersichten“: Klassen, Lehrkräfte und Räume – alle Elemente als Zeilen, Tage × Stunden als Spalten.
import { lazy } from 'react';
import { seiteOeffnen } from '@/kern/befehle';
import { zustand } from '@/kern/zustand';
import type { StudioModul } from '../typen';

const TITEL: Record<string, string> = { klasse: 'Klassen', lehrer: 'Lehrkräfte', raum: 'Räume' };
const eintrag = (typ: string) => ({
  id: `stundenplaene.uebersicht.${typ}`, text: `Gesamtübersicht ${TITEL[typ]}`, ansicht: { typ: 'uebersicht', p: { typ } }, braucht: 'dokument' as const,
  gruppe: 'Stundenpläne', hinweis: `Gesamtübersicht: alle ${TITEL[typ]} mit Tagen und Stunden`,
});

const modul: StudioModul = {
  id: 'uebersicht',
  ansichten: {
    uebersicht: { titel: 'Gesamtübersicht', pfad: 'gesamtuebersicht', komponente: lazy(() => import('./Uebersicht')), schluessel: (p) => String(p.typ || 'klasse') },
  },
  befehle: {
    'uebersicht.oeffnen': ({ typ = 'klasse', inhalt }: { typ?: string; inhalt?: string } = {}) => (zustand().dokument ? seiteOeffnen('uebersicht', { typ, inhalt }) : null),
  },
  eintraege: [eintrag('klasse'), eintrag('lehrer'), eintrag('raum')],
};

export default modul;
