// Modul „EduOrga Web“: Datenaustausch mit EduOrga Web (Übertragen/Übernehmen mit Fortschritt, automatischer Abgleich),
// Einstellungen, Stundenplanänderungen, Klausuren und übernommene Listen. Die Logik liegt in UntPlan.Core.
// Direkt senden: Knopf „An Web senden“ in der Kopfleiste der Vertretungsplanung und Befehl „untplanweb.vertretungenSenden“
// (für andere Ansichten, z. B. den Kopf der Tagesplanung: befehl('untplanweb.vertretungenSenden') oder <VertretungenSendenKnopf />
// aus './Senden').
import { lazy } from 'react';
import { api, dateiHerunterladen } from '@/api/client';
import { seiteOeffnen } from '@/kern/befehle';
import { zustand } from '@/kern/zustand';
import { kopfleistenElement } from '@/shell/kopfleiste-elemente';
import type { StudioModul } from '../typen';
import { einstellungenDialog } from './kern';
import KopfleisteSenden, { direktBeobachten, vertretungenSenden } from './Senden';

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
    'untplanweb.vertretungenSenden': mitDokument(() => vertretungenSenden()),
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
    {
      id: 'untplanweb.vertretungenSenden', text: 'Vertretungen jetzt an EduOrga Web senden', gruppe: 'Vertretungsplanung', befehl: 'untplanweb.vertretungenSenden',
      braucht: 'schreiben', modus: 'vertretung', hinweis: 'Geänderte Vertretungen sofort übertragen (wie „Vertretungen*“ im Datenaustausch)',
    },
    { id: 'vertretung.untplanweb', text: 'EduOrga Web', gruppe: 'Vertretungsplanung', ansicht: { typ: 'untplanweb' }, braucht: 'dokument', modus: 'vertretung', hinweis: 'Vertretungen an EduOrga Web übertragen, Rückmeldungen übernehmen' },
  ],
  start() {
    kopfleistenElement({ id: 'untplanweb.senden', komponente: KopfleisteSenden, modus: 'vertretung', ort: 'mitte' });
    direktBeobachten();
  },
};

export default modul;
