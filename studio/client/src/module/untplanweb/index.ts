// Modul „EduOrga Web“: Datenaustausch mit EduOrga Web (Übertragen/Übernehmen mit Fortschritt, automatischer Abgleich),
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
    untplanweb: { titel: 'EduOrga Web', pfad: 'untplanweb', komponente: lazy(() => import('./UntPlanWeb')) },
    'untplanweb.stpl': { titel: 'Stundenplanänderungen aus EduOrga Web', pfad: 'untplanweb/stundenplanaenderungen', komponente: lazy(() => import('./Stpl')) },
    'untplanweb.klausuren': { titel: 'Klausuren', pfad: 'klausuren', komponente: lazy(() => import('./Klausuren')) },
    'untplanweb.liste': { titel: 'EduOrga Web', pfad: 'untplanweb/liste', komponente: lazy(() => import('./Liste')), schluessel: (p) => String(p.art || '') },
  },
  befehle: {
    'untplanweb.oeffnen': mitDokument(() => seiteOeffnen('untplanweb')),
    'untplanweb.einstellungen': () => einstellungenDialog(),
    'untplanweb.stpl': mitDokument(() => seiteOeffnen('untplanweb.stpl')),
    'untplanweb.klausuren': mitDokument(() => seiteOeffnen('untplanweb.klausuren')),
  },
  eintraege: [
    {
      id: 'start.untplanweb', text: 'EduOrga Web', gruppe: 'Datenaustausch', braucht: 'dokument', hinweis: 'Datenaustausch mit EduOrga Web', ansicht: { typ: 'untplanweb' },
      menue: [
        { text: 'Datenaustausch mit EduOrga Web', ansicht: { typ: 'untplanweb' } },
        { text: 'Stundenplanänderungen aus EduOrga Web', ansicht: { typ: 'untplanweb.stpl' } },
        { text: 'Klausuren', ansicht: { typ: 'untplanweb.klausuren' } },
        { text: 'Paket als Datei exportieren (JSON) …', aktion: () => dateiHerunterladen(api.dok('/austausch/untplanweb.json'), 'untplanweb.json') },
        { text: 'Einstellungen für EduOrga Web …', befehl: 'untplanweb.einstellungen', braucht: 'schreiben' },
      ],
    },
    { id: 'vertretung.untplanweb', text: 'EduOrga Web', gruppe: 'Vertretungsplanung', ansicht: { typ: 'untplanweb' }, braucht: 'dokument', modus: 'vertretung', hinweis: 'Vertretungen an EduOrga Web übertragen, Rückmeldungen übernehmen' },
  ],
};

export default modul;
