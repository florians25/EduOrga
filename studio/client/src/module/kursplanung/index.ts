// Modul „Kursplanung“ (Oberstufe): Kurse, Kurswahlen, Kollisionsmatrix, automatische Bandbildung.
import { lazy } from 'react';
import { seiteOeffnen } from '@/kern/befehle';
import { zustand } from '@/kern/zustand';
import type { StudioModul } from '../typen';

const modul: StudioModul = {
  id: 'kursplanung',
  ansichten: { kursplanung: { titel: 'Kursplanung', pfad: 'kursplanung', komponente: lazy(() => import('./Kursplanung')) } },
  befehle: { 'kursplanung.oeffnen': () => (zustand().dokument ? seiteOeffnen('kursplanung') : null) },
  eintraege: [{ id: 'kurs.kurse', text: 'Kurse und Bänder', ansicht: { typ: 'kursplanung' }, braucht: 'dokument', gruppe: 'Oberstufe' }],
};

export default modul;
