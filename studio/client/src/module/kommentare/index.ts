// Modul „Kommentare“: Notizen an Stammdaten (Lehrkraft, Klasse, Raum …) mit Kategorie, Element und Feld.
import { lazy } from 'react';
import { seiteOeffnen } from '@/kern/befehle';
import { zustand } from '@/kern/zustand';
import type { StudioModul } from '../typen';
import { kommentarNeu } from './dialog';

const modul: StudioModul = {
  id: 'kommentare',
  ansichten: { kommentare: { titel: 'Kommentare', pfad: 'kommentare', komponente: lazy(() => import('./Kommentare')) } },
  befehle: {
    'kommentare.oeffnen': () => (zustand().dokument ? seiteOeffnen('kommentare') : null),
    'kommentare.neu': (a: Record<string, unknown>) => kommentarNeu(a),
  },
  eintraege: [
    { id: 'eingabe.kommentare', text: 'Kommentare', ansicht: { typ: 'kommentare' }, braucht: 'dokument', gruppe: 'Stammdaten', hinweis: 'Alle Kommentare zu den Stammdaten' },
  ],
};

export default modul;
