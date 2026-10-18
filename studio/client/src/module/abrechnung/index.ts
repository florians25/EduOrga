// Modul „Soll und Ist“ (Lehrkräfte Soll/Ist, Unterrichtsmatrix, Stundentafel) und „Vertretungsstatistik“.
import { lazy } from 'react';
import { seiteOeffnen } from '@/kern/befehle';
import { zustand } from '@/kern/zustand';
import type { StudioModul } from '../typen';

const wert = (tab: string) => () => (zustand().dokument ? seiteOeffnen('abrechnung.wertrechnung', { tab }) : null);

const modul: StudioModul = {
  id: 'abrechnung',
  ansichten: {
    'abrechnung.wertrechnung': { titel: 'Soll und Ist', pfad: 'soll-ist', komponente: lazy(() => import('./SollIst')) },
    'abrechnung.statistik': { titel: 'Vertretungsstatistik', pfad: 'statistik', komponente: lazy(() => import('./Statistik')) },
  },
  befehle: {
    'abrechnung.werte': wert('werte'),
    'abrechnung.matrix': wert('matrix'),
    'abrechnung.stundentafel': wert('tafel'),
    'abrechnung.statistik': () => (zustand().dokument ? seiteOeffnen('abrechnung.statistik') : null),
  },
  eintraege: [
    { id: 'module.sollist', text: 'Soll und Ist der Lehrkräfte', ansicht: { typ: 'abrechnung.wertrechnung', p: { tab: 'werte' } }, braucht: 'dokument', gruppe: 'Auswertung' },
    { id: 'module.matrix', text: 'Unterrichtsmatrix', ansicht: { typ: 'abrechnung.wertrechnung', p: { tab: 'matrix' } }, braucht: 'dokument', gruppe: 'Auswertung' },
    { id: 'eingabe.stundentafel', text: 'Stundentafel', ansicht: { typ: 'abrechnung.wertrechnung', p: { tab: 'tafel' } }, braucht: 'dokument', gruppe: 'Unterricht' },
    { id: 'module.statistik', text: 'Vertretungsstatistik', ansicht: { typ: 'abrechnung.statistik' }, braucht: 'dokument', gruppe: 'Auswertung', hinweis: 'Vertretungsabrechnung, Zähler, Mehrarbeit NRW, Berichte' },
    { id: 'vertretung.statistik', text: 'Statistik und Abrechnung', ansicht: { typ: 'abrechnung.statistik' }, braucht: 'dokument', gruppe: 'Vertretungsplanung', modus: 'vertretung' },
  ],
};

export default modul;
