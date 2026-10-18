// Aktionen rund um Schuldateien (auch aus der Kopfleiste und der Startseite).
import { api } from '@/api/client';
import type { DokumentStand } from '@/api/typen';
import { dokumentOeffnen } from '@/kern/dokument';
import { dateiWaehlen } from '@/kern/hilfen';
import { meldung } from '@/komponenten/dialoge';
import { hinweis } from '@/komponenten/hinweise';

export interface ImportBericht { neu: number; aktualisiert: number; hinweise?: string[] }

export function importBerichtZeigen(b: ImportBericht) {
  return meldung([`BAL-Import abgeschlossen: ${b.neu} neu, ${b.aktualisiert} aktualisiert.`, ...(b.hinweise || []).slice(0, 30)].join('\n'), 'BAL-Import');
}

/** Ergebnis einer Anfrage (Stand oder { dokument, bericht }) als Dokument öffnen. */
export async function oeffnenMit(f: () => Promise<DokumentStand | { dokument: DokumentStand; bericht?: ImportBericht }>) {
  const erg = await f();
  const stand = 'dokument' in erg ? erg.dokument : erg;
  await dokumentOeffnen(stand);
  if ('bericht' in erg && erg.bericht) await importBerichtZeigen(erg.bericht);
  else hinweis(`„${stand.name}“ geöffnet.`, 'ok');
}

export async function hochladen(datei?: File) {
  const d = datei ?? (await dateiWaehlen('.up,.untplan,.txt,.bal,.csv,text/plain'));
  if (!d) return;
  await oeffnenMit(() => api.hochladen('/api/dokumente/hochladen', d));
}
