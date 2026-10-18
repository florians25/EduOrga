// Modul „MultiUser“: mehrere Benutzer arbeiten gleichzeitig an derselben Schuldatei. Anzeige, wer gerade aktiv ist (mit
// Tätigkeit = aktive Ansicht), Bereichssperren und Exklusivbetrieb, Nachrichten, eigene Rechte und – für Administratoren –
// Gruppen mit Rechten/Rechtestufen und Zuordnung der Benutzer.
import { lazy } from 'react';
import { seiteOeffnen } from '@/kern/befehle';
import { beiDokumentwechsel } from '@/kern/dokument';
import { an } from '@/kern/ereignisse';
import { istAdmin, zustand } from '@/kern/zustand';
import { kopfleistenElement } from '@/shell/kopfleiste-elemente';
import type { StudioModul } from '../typen';
import Praesenz from './Praesenz';
import { abfragen, starten, useMultiuser } from './stand';

let dokId: string | null = null;

const modul: StudioModul = {
  id: 'multiuser',
  ansichten: {
    multiuser: { titel: 'Aktive Benutzer', pfad: 'benutzer-aktiv', komponente: lazy(() => import('./MultiUser')) },
    'multiuser.verwaltung': { titel: 'Gruppen und Rechte', pfad: 'gruppen-und-rechte', komponente: lazy(() => import('./Verwaltung')), ohneDokument: true },
  },
  befehle: {
    'multiuser.oeffnen': () => (zustand().dokument ? seiteOeffnen('multiuser') : istAdmin() ? seiteOeffnen('multiuser.verwaltung') : null),
    'multiuser.verwaltung': () => seiteOeffnen('multiuser.verwaltung'),
    'multiuser.aktualisieren': () => abfragen(),
  },
  eintraege: [
    {
      id: 'start.multiuser', text: 'Mehrbenutzerbetrieb', gruppe: 'Schule', hinweis: 'Mehrere Benutzer an einer Datei: aktive Benutzer, Sperren, Exklusivbetrieb, Rechte',
      menue: [
        { id: 'multiuser.aktive', text: 'Angemeldete Benutzer', ansicht: { typ: 'multiuser' }, braucht: 'dokument' },
        { id: 'multiuser.aktualisieren', text: 'Anzeige aktualisieren', befehl: 'multiuser.aktualisieren', braucht: 'dokument' },
        { id: 'multiuser.verwaltung', text: 'Gruppen und Rechte', ansicht: { typ: 'multiuser.verwaltung' }, braucht: 'admin' },
      ],
    },
  ],
  start() {
    kopfleistenElement({ id: 'multiuser.praesenz', komponente: Praesenz, ort: 'rechts' });
    beiDokumentwechsel((d) => {
      const id = d?.id ?? null;
      if (id === dokId) return;
      dokId = id;
      starten();
    });
    an('daten', (e) => {
      const s = useMultiuser.getState().stand;
      if (e?.benutzer && s && e.benutzer !== s.ich && e.quelle == null) void abfragen();
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) void abfragen(); });
    dokId = zustand().dokument?.id ?? null;
    starten();
  },
};

export default modul;
