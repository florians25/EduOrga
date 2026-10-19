// Modul „Einstellungen“: Einstellungen der Schuldatei – Schuldaten, Zeitraster, Kalender/Ferien, Perioden und
// Unterrichtsgruppen. Server: Api/EinstellungenSchuleApi.cs (/api/dokumente/{dok}/schule/…).
import { lazy } from 'react';
import { seiteOeffnen, type Params } from '@/kern/befehle';
import { zustand } from '@/kern/zustand';
import { kopfleistenElement } from '@/shell/kopfleiste-elemente';
import type { StudioModul } from '../typen';
import PeriodenWahl, { neuePeriodeDialog } from './Periodenwahl';

const oeffnen = (typ: string) => (p?: Params) => (zustand().dokument ? seiteOeffnen(typ, p && Object.keys(p).length ? p : undefined) : null);

const modul: StudioModul = {
  id: 'einstellungen',
  ansichten: {
    'einstellungen.schule': { titel: 'Einstellungen', pfad: 'einstellungen', komponente: lazy(() => import('./Schuldaten')) },
    'einstellungen.zeitraster': { titel: 'Zeitraster', pfad: 'zeitraster', komponente: lazy(() => import('./Zeitraster')) },
    'einstellungen.ferien': { titel: 'Kalender und Ferien', pfad: 'ferien', komponente: lazy(() => import('./Ferien')) },
    'einstellungen.perioden': { titel: 'Perioden', pfad: 'perioden', komponente: lazy(() => import('./Perioden')) },
    'einstellungen.ugruppen': { titel: 'Unterrichtsgruppen', pfad: 'unterrichtsgruppen', komponente: lazy(() => import('./Unterrichtsgruppen')) },
  },
  befehle: {
    'einstellungen.schule': oeffnen('einstellungen.schule'),
    'einstellungen.zeitraster': oeffnen('einstellungen.zeitraster'),
    'einstellungen.ferien': oeffnen('einstellungen.ferien'),
    'einstellungen.perioden': oeffnen('einstellungen.perioden'),
    'einstellungen.ugruppen': oeffnen('einstellungen.ugruppen'),
    'einstellungen.periodeNeu': () => (zustand().dokument ? neuePeriodeDialog() : null),
  },
  eintraege: [
    { id: 'start.einstellungen', text: 'Schuldaten', ansicht: { typ: 'einstellungen.schule' }, braucht: 'dokument', gruppe: 'Schule', hinweis: 'Schule, Schuljahr, Soll und Ist, Vertretungsplanung' },
    { id: 'start.perioden', text: 'Perioden', ansicht: { typ: 'einstellungen.perioden' }, braucht: 'dokument', gruppe: 'Schule' },
    { id: 'einstellungen.periodeNeu', text: 'Neue Periode ab …', befehl: 'einstellungen.periodeNeu', braucht: 'schreiben', gruppe: 'Schule', hinweis: 'Periode ab einem Datum als Kopie der aktiven anlegen und gleich aktiv setzen' },
    { id: 'start.ferien', text: 'Kalender und Ferien', ansicht: { typ: 'einstellungen.ferien' }, braucht: 'dokument', gruppe: 'Schule' },
    { id: 'eingabe.ugruppen', text: 'Unterrichtsgruppen', ansicht: { typ: 'einstellungen.ugruppen' }, braucht: 'dokument', gruppe: 'Unterricht' },
    { id: 'eingabe.zeitraster', text: 'Zeitraster', ansicht: { typ: 'einstellungen.zeitraster' }, braucht: 'dokument', gruppe: 'Schule' },
    { id: 'eingabe.ferien', text: 'Ferien', ansicht: { typ: 'einstellungen.ferien' }, braucht: 'dokument', gruppe: 'Schule' },
    { id: 'eingabe.schuljahr', text: 'Schuljahr', ansicht: { typ: 'einstellungen.schule', p: { seite: 'Allgemein' } }, braucht: 'dokument', gruppe: 'Schule' },
  ],
  start() {
    // Periodenwechsel in der Kopfleiste (nur Stundenplanung; in der Vertretungsplanung gilt die Periode des Planungstags)
    kopfleistenElement({ id: 'einstellungen.periode', komponente: PeriodenWahl, modus: 'stundenplan', ort: 'mitte' });
  },
};

export default modul;
