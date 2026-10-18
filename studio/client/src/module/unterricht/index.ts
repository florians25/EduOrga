// Modul „Unterricht“: Unterrichtsansicht je Klasse, Lehrkraft, Fach oder alle Unterrichte.
import { lazy } from 'react';
import { seiteOeffnen, type Befehlseintrag } from '@/kern/befehle';
import { zustand } from '@/kern/zustand';
import type { StudioModul } from '../typen';

const e = (id: string, text: string, sicht: string): Befehlseintrag => ({ id, text: `Unterricht – ${text}`, ansicht: { typ: 'unterricht', p: { sicht } }, braucht: 'dokument', gruppe: 'Unterricht' });

const modul: StudioModul = {
  id: 'unterricht',
  ansichten: {
    unterricht: { titel: 'Unterricht', pfad: 'unterricht', schluessel: (p) => String(p.sicht || 'alle'), komponente: lazy(() => import('./Unterricht')) },
  },
  befehle: {
    'unterricht.oeffnen': ({ sicht = 'klasse', element }: { sicht?: string; element?: number } = {}) => (zustand().dokument ? seiteOeffnen('unterricht', { sicht, element }) : null),
  },
  eintraege: [
    e('eingabe.unterricht.klassen', 'nach Klassen', 'klasse'),
    e('eingabe.unterricht.lehrer', 'nach Lehrkräften', 'lehrer'),
    e('eingabe.unterricht.faecher', 'nach Fächern', 'fach'),
    e('eingabe.unterricht.alle', 'alle Unterrichte', 'alle'),
  ],
};

export default modul;
