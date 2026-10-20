// Bänder in der Plantafel: Kurse einer Schiene (gleiches Band) liegen gleichzeitig und wandern gemeinsam – aus dem Vorrat in das
// Brett, im Brett und zurück in den Vorrat. Server: POST /planung/band/verschieben, /planung/band/verplanen (Rückfrage wie
// /planung/verschieben bzw. /verplanen); entplant wird über /planung/entplanen mit den Stunden aller mitziehenden Kurse.
import { hinweis } from '@/komponenten/hinweise';
import type { PlanEintrag, StundeZiehen } from '@/komponenten/raster/Stundenplanraster';
import { ablegen as einzelnAblegen, mitRueckfrage } from '../aktionen';
import type { Aufbereitet, Karte } from './daten';

export type StundenRef = { u: number; tag: number; stunde: number; e?: PlanEintrag };

/** Gehört der Unterricht zu einem Band mit weiteren Kursen? */
export const imBand = (auf: Aufbereitet, u: number) => auf.bandVon(u).length > 1;

/**
 * Karten, die mit einer Karte wandern: die Karte selbst und die Karten der übrigen Kurse des Bandes am selben Tag, die sich mit ihr
 * überschneiden (parallel liegende Kurse). Ohne Band nur die Karte.
 */
export function mitziehend(auf: Aufbereitet, k: Karte): Karte[] {
  const erg = [k];
  for (const m of auf.bandVon(k.u)) {
    if (m === k.u) continue;
    for (const x of auf.kartenVon.get(m) || []) if (x.tag === k.tag && x.von < k.von + k.laenge && k.von < x.von + x.laenge) erg.push(x);
  }
  return erg;
}

/** Stunden einer Karte samt mitziehender Kurse (nur: nur diese Stunde je Kurs). */
export function bandStunden(auf: Aufbereitet, k: Karte, nur?: number): StundenRef[] {
  return mitziehend(auf, k).flatMap((x) => (nur ? (nur >= x.von && nur < x.von + x.laenge ? [nur] : []) : Array.from({ length: x.laenge }, (_, i) => x.von + i))
    .filter((s) => s >= k.von && s < k.von + k.laenge)
    .map((s) => ({ u: x.u, tag: x.tag, stunde: s, e: { fix: x.teilFix } as PlanEintrag })));
}

/** Stunde bzw. Block ablegen; mit Band wandern bzw. setzen sich alle Kurse des Bandes gemeinsam. */
export async function ablegen(auf: Aufbereitet, d: StundeZiehen & { zielTag: number; zielStunde: number }, quelle?: string): Promise<boolean> {
  if (!imBand(auf, d.u)) return einzelnAblegen(d, quelle);
  const n = auf.bandVon(d.u).length;
  if (d.tag !== undefined) {
    const erg = await mitRueckfrage<{ ok?: boolean; frage?: string; unveraendert?: boolean; art?: string }>('/planung/band/verschieben',
      { unterricht: d.u, tag: d.tag, stunde: d.stunde, zielTag: d.zielTag, zielStunde: d.zielStunde, einzeln: !!d.einzeln }, quelle);
    if (!erg || erg.unveraendert) return false;
    hinweis(`${erg.art === 'tausch' ? 'Band getauscht' : 'Band verschoben'} (${n} Kurse) – Strg+Z macht es rückgängig.`, 'ok', 2500);
    return true;
  }
  const erg = await mitRueckfrage('/planung/band/verplanen', { unterricht: d.u, tag: d.zielTag, stunde: d.zielStunde, laenge: d.laenge || 1 }, quelle);
  if (!erg) return false;
  hinweis(`Band verplant (${n} Kurse) – Strg+Z macht es rückgängig.`, 'ok', 2500);
  return true;
}
