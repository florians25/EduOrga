// Modul „Planung“: manuelles Planen (Arbeitsplatz „Manuell planen“), Tauschvorschläge, Räume zuordnen, alle Stunden
// entplanen bzw. fixieren. Die Planungsaktionen im Stundenplan stehen in aktionen.tsx.
import { lazy } from 'react';
import type { StudioModul } from '../typen';
import { befehlAlleEntplanen, befehlAlleFixieren, befehlRaum, befehlTausch } from './aktionen';

const modul: StudioModul = {
  id: 'planung',
  arbeitsplaetze: {
    manuell: { titel: 'Manuell planen', modus: 'stundenplan', komponente: lazy(() => import('./ManuellPlanen')) },
  },
  befehle: {
    'planung.tausch': befehlTausch,
    'planung.raum': befehlRaum,
    'planung.alleEntplanen': befehlAlleEntplanen,
    'planung.alleFixieren': befehlAlleFixieren,
  },
  eintraege: [
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
