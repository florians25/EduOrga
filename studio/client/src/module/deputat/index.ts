// Modul „Deputat und Unterrichtsverteilung“: Deputatsrechnung je Lehrkraft nach Landesprofil (NRW voreingestellt),
// Verteilungsmatrix mit offenen Unterrichten, Stundentafel- und Kontingentprüfung, Ausgabe (CSV, UVD.TXT, PDF).
import { lazy } from 'react';
import { seiteOeffnen } from '@/kern/befehle';
import { zustand } from '@/kern/zustand';
import type { StudioModul } from '../typen';

const oeffnen = (tab: string) => () => (zustand().dokument ? seiteOeffnen('deputat', { tab }) : null);

const modul: StudioModul = {
  id: 'deputat',
  ansichten: {
    deputat: { titel: 'Deputat und Unterrichtsverteilung', pfad: 'deputat', komponente: lazy(() => import('./Deputat')) },
  },
  befehle: {
    'deputat.lehrkraefte': oeffnen('lehrkraefte'),
    'deputat.verteilung': oeffnen('verteilung'),
    'deputat.tafel': oeffnen('tafel'),
  },
  eintraege: [
    { id: 'deputat.uebersicht', text: 'Deputat und Unterrichtsverteilung', ansicht: { typ: 'deputat' }, braucht: 'dokument', gruppe: 'Unterricht',
      hinweis: 'Pflichtstunden, Ermäßigungen, Anrechnungen, Soll/Ist, Verteilungsmatrix (NRW)' },
    { id: 'deputat.matrix', text: 'Unterrichtsverteilung (Matrix)', ansicht: { typ: 'deputat', p: { tab: 'verteilung' } }, braucht: 'dokument', gruppe: 'Unterricht' },
    { id: 'deputat.stundentafel', text: 'Stundentafel prüfen (Kontingente)', ansicht: { typ: 'deputat', p: { tab: 'tafel' } }, braucht: 'dokument', gruppe: 'Unterricht' },
  ],
};

export default modul;
