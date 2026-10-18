// Modul „Import und Export“: Schild-NRW-CSV, Schüler mit Kurswahlen, GPU-Dateien, Unterrichtsverteilung, Aushang,
// Lehrer-Kalender (iCal), UntPlan-Web-Paket, Abteilungsdatei sowie Schuldatei (.up) und BAL.
import { lazy } from 'react';
import { api, dateiHerunterladen } from '@/api/client';
import { seiteOeffnen } from '@/kern/befehle';
import { zustand } from '@/kern/zustand';
import type { StudioModul } from '../typen';
import { csvImport, gpuImport } from './aktionen';

const modul: StudioModul = {
  id: 'austausch',
  ansichten: {
    austausch: { titel: 'Import und Export', pfad: 'austausch', komponente: lazy(() => import('./Austausch')) },
  },
  befehle: {
    'austausch.oeffnen': () => (zustand().dokument ? seiteOeffnen('austausch') : null),
    'austausch.schueler': () => csvImport('schueler', 'Import Schüler'),
    'austausch.lehrer': () => csvImport('lehrer', 'Import Lehrkräfte'),
    'austausch.klassen': () => csvImport('klassen', 'Import Klassen'),
    'austausch.gpu': gpuImport,
  },
  eintraege: [
    {
      id: 'eingabe.importexport', text: 'Import und Export', ansicht: { typ: 'austausch' }, braucht: 'dokument', gruppe: 'Datenaustausch', hinweis: 'Import und Export (CSV, GPU, iCalendar, Aushang, Abteilungsdatei)',
      menue: [
        { text: 'Import und Export …', ansicht: { typ: 'austausch' } },
        null,
        { text: 'Lehrkräfte aus Schild-NRW importieren (CSV) …', befehl: 'austausch.lehrer', braucht: 'schreiben' },
        { text: 'Klassen aus Schild-NRW importieren (CSV) …', befehl: 'austausch.klassen', braucht: 'schreiben' },
        { text: 'Schülerinnen und Schüler importieren (CSV) …', befehl: 'austausch.schueler', braucht: 'schreiben' },
        { text: 'GPU-Dateien importieren …', befehl: 'austausch.gpu', braucht: 'schreiben' },
        { text: 'BAL-Datei importieren …', befehl: 'datei.balImport', braucht: 'schreiben' },
        null,
        { text: 'GPU-Dateien exportieren', aktion: () => dateiHerunterladen(api.dok('/austausch/gpu'), 'GPU.zip') },
        { text: 'Unterrichtsverteilung exportieren (CSV)', aktion: () => dateiHerunterladen(api.dok('/austausch/unterricht.csv'), 'Unterrichtsverteilung.csv') },
      ],
    },
    { id: 'kurs.import', text: 'Kurswahlen importieren', befehl: 'austausch.schueler', braucht: 'schreiben', gruppe: 'Oberstufe', hinweis: 'Schüler mit Kurswahlen aus einer CSV-Datei übernehmen' },
  ],
};

export default modul;
