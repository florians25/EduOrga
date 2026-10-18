// Importe der Austausch-Seite (auch als Befehle für Navigation und Befehlssuche).
import { api } from '@/api/client';
import { dateienWaehlen } from '@/kern/hilfen';
import { meldung } from '@/komponenten/dialoge';

export interface Importbericht { art?: string; text?: string; neu?: number; aktualisiert?: number; hinweise?: string[] }

export const berichtText = (b: Importbericht) => [b.text || `${b.art}: ${b.neu} neu, ${b.aktualisiert} aktualisiert`, ...(b.hinweise || []).slice(0, 40)].join('\n');

export async function csvImport(art: string, titel: string): Promise<Importbericht | null> {
  const [datei] = await dateienWaehlen('.csv,.txt,text/csv,text/plain');
  if (!datei) return null;
  const b = await api.hochladenMehrere<Importbericht>(api.dok(`/austausch/csv/${art}`), [datei], 'datei');
  await meldung(berichtText(b), titel);
  return b;
}

export async function gpuImport(): Promise<Importbericht | null> {
  const dateien = await dateienWaehlen('.txt,.TXT,.zip', true);
  if (!dateien.length) return null;
  const b = await api.hochladenMehrere<Importbericht>(api.dok('/austausch/gpu'), dateien, 'datei');
  await meldung(berichtText(b), 'GPU-Import');
  return b;
}
