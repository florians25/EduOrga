// Modul „Datei“: Schuldateien – Informationen, Neu, Öffnen (Server-Liste, Hochladen .up/BAL), Speichern, Herunterladen,
// BAL-Import in die geöffnete Datei, Schließen, Konto (Passwort, Abmelden), Benutzerverwaltung (Admin), Über.
import { lazy } from 'react';
import { seiteOeffnen } from '@/kern/befehle';
import { dokumentSchliessen, herunterladen, speichern } from '@/kern/dokument';
import type { StudioModul } from '../typen';
import { hochladen } from './aktionen';

const modul: StudioModul = {
  id: 'datei',
  ansichten: {
    datei: { titel: 'Schuldateien', pfad: 'dateien', ohneDokument: true, komponente: lazy(() => import('./DateiSeite')) },
  },
  befehle: {
    'datei.backstage': ({ seite }: { seite?: string } = {}) => seiteOeffnen('datei', { seite }),
    'datei.hochladen': () => hochladen(),
    'datei.speichern': () => speichern(),
    'datei.herunterladen': () => herunterladen(),
    'datei.schliessen': () => dokumentSchliessen(),
    'datei.balImport': () => seiteOeffnen('datei', { seite: 'import' }),
  },
  eintraege: [
    { id: 'eingabe.bal', text: 'BAL-Import', befehl: 'datei.balImport', braucht: 'schreiben', hinweis: 'Stundenplan aus einer WILLI2-BAL-Datei übernehmen' },
    { id: 'datei.speichern', text: 'Speichern', befehl: 'datei.speichern', braucht: 'schreiben', gruppe: 'Schuldatei', taste: 'Strg+S' },
    { id: 'datei.herunterladen', text: 'Schuldatei herunterladen (.up)', befehl: 'datei.herunterladen', braucht: 'dokument', gruppe: 'Schuldatei' },
    { id: 'datei.oeffnen', text: 'Schuldatei öffnen', befehl: 'datei.backstage', args: { seite: 'oeffnen' }, gruppe: 'Schuldatei' },
    { id: 'datei.neu', text: 'Neue Schuldatei', befehl: 'datei.backstage', args: { seite: 'neu' }, braucht: 'schreiben', gruppe: 'Schuldatei' },
    { id: 'datei.hochladen', text: 'Datei hochladen', befehl: 'datei.hochladen', braucht: 'schreiben', gruppe: 'Schuldatei' },
    { id: 'datei.info', text: 'Informationen zur Schuldatei', befehl: 'datei.backstage', args: { seite: 'info' }, braucht: 'dokument', gruppe: 'Schuldatei' },
    { id: 'datei.schliessen', text: 'Schuldatei schließen', befehl: 'datei.schliessen', braucht: 'dokument', gruppe: 'Schuldatei' },
    { id: 'datei.konto', text: 'Konto und Passwort', befehl: 'datei.backstage', args: { seite: 'konto' }, gruppe: 'Konto' },
    { id: 'datei.benutzer', text: 'Benutzerverwaltung', befehl: 'datei.backstage', args: { seite: 'benutzer' }, braucht: 'admin', gruppe: 'Konto' },
  ],
};

export default modul;
