// Modul „Stammdaten“: Klassen, Lehrkräfte, Räume, Fächer, Raumgruppen, Gänge, Abteilungen, Abwesenheitsgründe, Schüler.
import { lazy } from 'react';
import type { Befehlseintrag } from '@/kern/befehle';
import { seiteOeffnen } from '@/kern/befehle';
import { zustand } from '@/kern/zustand';
import type { StudioModul } from '../typen';
export { TYPEN } from './elementtypen';


const e = (id: string, text: string, typ: string, gruppe = 'Stammdaten'): Befehlseintrag => ({ id, text, ansicht: { typ: 'stammdaten', p: { typ } }, braucht: 'dokument', gruppe });

const modul: StudioModul = {
  id: 'stammdaten',
  ansichten: {
    stammdaten: { titel: 'Stammdaten', pfad: 'stammdaten', schluessel: (p) => String(p.typ || 'lehrer'), komponente: lazy(() => import('./Stammdaten')) },
  },
  befehle: {
    'stammdaten.oeffnen': ({ typ = 'lehrer', element }: { typ?: string; element?: number } = {}) => (zustand().dokument ? seiteOeffnen('stammdaten', { typ, element }) : null),
  },
  eintraege: [
    e('eingabe.klassen', 'Klassen', 'klasse'), e('eingabe.lehrer', 'Lehrkräfte', 'lehrer'), e('eingabe.raeume', 'Räume', 'raum'), e('eingabe.faecher', 'Fächer', 'fach'),
    e('eingabe.raumgruppen', 'Raumgruppen', 'raumgruppe'), e('eingabe.gaenge', 'Gänge', 'gang'), e('eingabe.abteilungen', 'Abteilungen', 'abteilung'),
    e('eingabe.gruende', 'Abwesenheitsgründe', 'abwesenheitsgrund'), e('eingabe.schueler', 'Schüler', 'schueler'),
    e('kurs.schueler', 'Schülerinnen und Schüler', 'schueler', 'Oberstufe'),
  ],
};

export default modul;
