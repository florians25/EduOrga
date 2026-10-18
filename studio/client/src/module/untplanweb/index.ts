// Modul „UntPlan Web“: Datenaustausch mit UntPlan Web (Übertragen/Übernehmen mit Fortschritt, automatischer Abgleich),
// Einstellungen, Stundenplanänderungen, Klausuren und übernommene Listen. Die Logik liegt in UntPlan.Core.
import { lazy } from 'react';
import { api, dateiHerunterladen } from '@/api/client';
import { seiteOeffnen } from '@/kern/befehle';
import { zustand } from '@/kern/zustand';
import type { StudioModul } from '../typen';
import { einstellungenDialog } from './kern';

const mitDokument = (f: () => unknown) => () => (zustand().dokument ? f() : null);

const modul: StudioModul = {
  id: 'untplanweb',
  ansichten: {
    untplanweb: { titel: 'UntPlan Web', pfad: 'untplanweb', komponente: lazy(() => import('./UntPlanWeb')) },
    'untplanweb.stpl': { titel: 'Stundenplanänderungen aus UntPlan Web', pfad: 'untplanweb/stundenplanaenderungen', komponente: lazy(() => import('./Stpl')) },
    'untplanweb.klausuren': { titel: 'Klausuren', pfad: 'klausuren', komponente: lazy(() => import('./Klausuren')) },
    'untplanweb.liste': { titel: 'UntPlan Web', pfad: 'untplanweb/liste', komponente: lazy(() => import('./Liste')), schluessel: (p) => String(p.art || '') },
  },
  befehle: {
    'untplanweb.oeffnen': mitDokument(() => seiteOeffnen('untplanweb')),
    'untplanweb.einstellungen': () => einstellungenDialog(),
    'untplanweb.stpl': mitDokument(() => seiteOeffnen('untplanweb.stpl')),
    'untplanweb.klausuren': mitDokument(() => seiteOeffnen('untplanweb.klausuren')),
  },
  eintraege: [
    {
      id: 'start.untplanweb', text: 'UntPlan Web', gruppe: 'Datenaustausch', braucht: 'dokument', hinweis: 'Datenaustausch mit UntPlan Web', ansicht: { typ: 'untplanweb' },
      menue: [
        { text: 'Datenaustausch mit UntPlan Web', ansicht: { typ: 'untplanweb' } },
        { text: 'Stundenplanänderungen aus UntPlan Web', ansicht: { typ: 'untplanweb.stpl' } },
        { text: 'Klausuren', ansicht: { typ: 'untplanweb.klausuren' } },
        { text: 'Paket als Datei exportieren (JSON) …', aktion: () => dateiHerunterladen(api.dok('/austausch/untplanweb.json'), 'untplanweb.json') },
        { text: 'Einstellungen für UntPlan Web …', befehl: 'untplanweb.einstellungen', braucht: 'schreiben' },
      ],
    },
    { id: 'vertretung.untplanweb', text: 'UntPlan Web', gruppe: 'Vertretungsplanung', ansicht: { typ: 'untplanweb' }, braucht: 'dokument', modus: 'vertretung', hinweis: 'Vertretungen an UntPlan Web übertragen, Rückmeldungen übernehmen' },
  ],
};

export default modul;
