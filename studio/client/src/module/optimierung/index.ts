// Modul „Optimierung“: automatische Planung als Hintergrundauftrag auf dem Server, Diagnose, Gewichtung.
import { lazy } from 'react';
import { api } from '@/api/client';
import { seiteOeffnen } from '@/kern/befehle';
import { beiDokumentwechsel } from '@/kern/dokument';
import { zustand } from '@/kern/zustand';
import type { StudioModul } from '../typen';
import { gewichtungDialog, optimierungStarten } from './dialoge';

const modul: StudioModul = {
  id: 'optimierung',
  ansichten: {
    'optimierung.diagnose': { titel: 'Diagnose', pfad: 'diagnose', komponente: lazy(() => import('./Diagnose')) },
    'optimierung.lauf': { titel: 'Automatische Planung', pfad: 'optimierung', komponente: lazy(() => import('./Lauf')) },
  },
  befehle: {
    'optimierung.diagnose': () => (zustand().dokument ? seiteOeffnen('optimierung.diagnose') : null),
    'optimierung.gewichtung': () => gewichtungDialog(),
    'optimierung.starten': () => optimierungStarten(),
    'optimierung.ergebnis': () => seiteOeffnen('optimierung.lauf'),
  },
  eintraege: [
    { id: 'planung.diagnose', text: 'Diagnose', ansicht: { typ: 'optimierung.diagnose' }, braucht: 'dokument', gruppe: 'Planung', hinweis: 'Stundenplan-Diagnose: Eingabedaten und Verstöße im Stundenplan' },
    { id: 'planung.gewichtung', text: 'Gewichtung', befehl: 'optimierung.gewichtung', braucht: 'dokument', gruppe: 'Planung', hinweis: 'Gewichtung der Optimierungsziele (0 unwichtig … 5 extrem wichtig)' },
    { id: 'planung.optimierung', text: 'Automatische Planung', ansicht: { typ: 'optimierung.lauf' }, braucht: 'dokument', gruppe: 'Planung', hinweis: 'Automatische Verplanung (läuft im Hintergrund)' },
    { id: 'start.optimierung', text: 'Optimierung starten', befehl: 'optimierung.starten', braucht: 'schreiben', gruppe: 'Planung' },
  ],
  start() {
    // nach dem Öffnen eines Dokuments: läuft dort gerade eine Optimierung, den Fortschritt zeigen
    beiDokumentwechsel(async (d) => {
      if (!d) return;
      try {
        const a = await api.get<{ status: string }>(api.dok('/optimierung/auftrag'));
        if (a.status === 'laeuft') seiteOeffnen('optimierung.lauf');
      } catch { /* ohne Hinweis */ }
    });
  },
};

export default modul;
