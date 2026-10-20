// Modul „Planung“: Plantafel (Steckbrett aller Klassen, Lehrkräfte oder Räume mit Vorrat; Klasse mit verknüpften Plänen),
// manuelles Planen (Arbeitsplatz „Manuell planen“), Tauschvorschläge, Räume zuordnen, alle Stunden entplanen bzw. fixieren,
// Dialog „Neuer Unterricht“. Die Planungsaktionen im Stundenplan stehen in aktionen.tsx.
import { lazy } from 'react';
import type { StudioModul } from '../typen';
import { seiteOeffnen } from '@/kern/befehle';
import { zustand } from '@/kern/zustand';
import { befehlAlleEntplanen, befehlAlleFixieren, befehlRaum, befehlTausch } from './aktionen';
import { befehlNeuerUnterricht } from './neuerUnterricht';

const modul: StudioModul = {
  id: 'planung',
  ansichten: {
    'planung.plantafel': {
      titel: 'Plantafel', pfad: 'plantafel', modus: 'stundenplan', schluessel: () => 'plantafel',
      komponente: lazy(() => import('./plantafel/Plantafel')),
    },
  },
  arbeitsplaetze: {
    manuell: { titel: 'Manuell planen', modus: 'stundenplan', komponente: lazy(() => import('./ManuellPlanen')) },
  },
  befehle: {
    'planung.tausch': befehlTausch,
    'planung.raum': befehlRaum,
    'planung.alleEntplanen': befehlAlleEntplanen,
    'planung.alleFixieren': befehlAlleFixieren,
    'planung.plantafel': (p: { modus?: string; zeilen?: string; element?: number } = {}) => (zustand().dokument ? seiteOeffnen('planung.plantafel', p) : null),
    'planung.neuerUnterricht': befehlNeuerUnterricht,
  },
  eintraege: [
    { id: 'planung.plantafel', text: 'Plantafel', ansicht: { typ: 'planung.plantafel' }, braucht: 'dokument', gruppe: 'Planung', hinweis: 'Steckbrett aller Klassen mit Vorrat, Klassenplan mit den Plänen der Lehrkräfte und Räume' },
    { id: 'planung.neuerUnterricht', text: 'Neuer Unterricht', befehl: 'planung.neuerUnterricht', braucht: 'schreiben', gruppe: 'Unterricht', hinweis: 'Unterricht im Dialog anlegen (Fach, Klassen, Lehrkräfte, Stunden, Doppelstunden, Raum, Kopplung)' },
    { id: 'planung.manuell', text: 'Manuell planen', arbeitsplatz: 'manuell', braucht: 'dokument', gruppe: 'Planung', hinweis: 'Unterricht und Klassenplan nebeneinander' },
    { id: 'planung.tausch', text: 'Tauschvorschläge', befehl: 'planung.tausch', braucht: 'schreiben', gruppe: 'Planung', hinweis: 'Tauschvorschläge für die gewählte Stunde im Stundenplan' },
    { id: 'planung.raum', text: 'Raum zuordnen', befehl: 'planung.raum', braucht: 'dokument', gruppe: 'Planung', hinweis: 'Raum der gewählten Stunde zuordnen oder entfernen' },
    { id: 'planung.entplanen', text: 'Alle Stunden entplanen', befehl: 'planung.alleEntplanen', braucht: 'schreiben', gruppe: 'Planung' },
    {
      id: 'planung.fixieren', text: 'Fixierungen', braucht: 'schreiben', gruppe: 'Planung', menue: [
        { text: 'Alle Stunden fixieren', befehl: 'planung.alleFixieren', args: { fixieren: true } },
        { text: 'Alle Fixierungen aufheben', befehl: 'planung.alleFixieren', args: { fixieren: false } },
      ],
    },
  ],
};

export default modul;
