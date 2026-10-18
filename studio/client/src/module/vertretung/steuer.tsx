// Steuerelemente der Vertretungsplanung: Zeitraum (Tag / Woche / frei) und Datumsauswahl in der Kopfleiste.
import { Button, Input, Select, Tooltip, makeStyles, tokens } from '@fluentui/react-components';
import {
  ArrowPrevious20Regular, ArrowNext20Regular, ChevronLeft20Regular, ChevronRight20Regular,
} from '@fluentui/react-icons';
import { useEffect, useRef, useState } from 'react';
import { useEreignis } from '@/kern/ereignisse';
import { fehlerMelden } from '@/komponenten/hinweise';
import { blaettern, datumSetzen, montag, planungsdatum, plusTage, tagKurz, usePlanungsdatum } from './kern';

const useStile = makeStyles({
  zeitraum: { display: 'inline-flex', alignItems: 'center', gap: '4px' },
  datum: { width: '140px' },
  bis: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, padding: '0 2px' },
  kopf: { display: 'inline-flex', alignItems: 'center', gap: '2px', padding: '0 4px' },
  kopfDatum: { width: '150px', fontVariantNumeric: 'tabular-nums' },
});

export type ZeitraumArt = 'tag' | 'woche' | 'vonbis';
export interface Zeitraum { von: string | null; bis: string | null; art: ZeitraumArt }

function berechnen(v: string, b: string | null, art: ZeitraumArt, tageProWoche: number): Zeitraum {
  if (art === 'tag') return { von: v, bis: v, art };
  if (art === 'woche') { const m = montag(v); return { von: m, bis: plusTage(m, tageProWoche - 1), art }; }
  return { von: v, bis: b && b >= v ? b : v, art };
}

/** Zeitraum einer Ansicht: folgt dem Planungsdatum (Tag, Woche) oder frei (Zeitraum). */
export function useZeitraum(start: ZeitraumArt = 'tag', tageProWoche = 5, beiAenderung?: (z: Zeitraum) => void) {
  const d = usePlanungsdatum();
  const [z, setZ] = useState<Zeitraum>(() => (d ? berechnen(d, d, start, tageProWoche) : { von: null, bis: null, art: start }));
  const ref = useRef(beiAenderung); ref.current = beiAenderung;
  const setzen = (v: string | null, b: string | null, art: ZeitraumArt = z.art) => {
    if (!v) return;
    const n = berechnen(v, b, art, tageProWoche);
    setZ(n);
    ref.current?.(n);
  };
  useEreignis('vertretung.datum', (neu) => { if (z.art !== 'vonbis') setzen(neu, neu); });
  useEffect(() => { if (!z.von && d) setzen(d, d); }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...z, setzen };
}

export function ZeitraumAuswahl({ z }: { z: ReturnType<typeof useZeitraum> }) {
  const s = useStile();
  const schritt = (r: number) => {
    if (z.art === 'tag') { blaettern(r).catch(fehlerMelden); return; }
    if (!z.von || !z.bis) return;
    const n = z.art === 'woche' ? 7 : Math.max(1, (new Date(z.bis).getTime() - new Date(z.von).getTime()) / 864e5 + 1);
    z.setzen(plusTage(z.von, r * n), plusTage(z.bis, r * n));
  };
  return (
    <span className={s.zeitraum}>
      <Select size="small" value={z.art} onChange={(_, x) => z.setzen(z.von || planungsdatum(), z.bis, x.value as ZeitraumArt)} aria-label="Zeitraum">
        <option value="tag">Tag</option><option value="woche">Woche</option><option value="vonbis">Zeitraum</option>
      </Select>
      <Tooltip content="Zurück" relationship="label"><Button size="small" appearance="subtle" icon={<ChevronLeft20Regular />} onClick={() => schritt(-1)} /></Tooltip>
      <Input size="small" type="date" className={s.datum} value={z.von || ''} aria-label="Von"
        onChange={(_, x) => { if (!x.value) return; if (z.art === 'tag') void datumSetzen(x.value); else z.setzen(x.value, z.bis); }} />
      <Tooltip content="Weiter" relationship="label"><Button size="small" appearance="subtle" icon={<ChevronRight20Regular />} onClick={() => schritt(1)} /></Tooltip>
      {z.art !== 'tag' ? <>
        <span className={s.bis}>bis</span>
        <Input size="small" type="date" className={s.datum} value={z.bis || ''} disabled={z.art !== 'vonbis'} aria-label="Bis" onChange={(_, x) => { if (x.value) z.setzen(z.von, x.value); }} />
      </> : null}
    </span>
  );
}

/** Planungsdatum in der Kopfleiste: Woche zurück, Tag zurück, [Datum], Tag vor, Woche vor (Strg+Bild↑ / Strg+Bild↓). */
export function DatumsAuswahl() {
  const s = useStile();
  const d = usePlanungsdatum();
  const los = (f: () => Promise<void>) => () => { f().catch(fehlerMelden); };
  return (
    <span className={s.kopf} title="Planungsdatum – Tag blättern mit Strg+Bild↑ / Strg+Bild↓" data-testid="planungsdatum">
      <Tooltip content="Eine Woche zurück" relationship="label"><Button size="small" appearance="subtle" icon={<ArrowPrevious20Regular />} onClick={los(() => blaettern(-1, true))} /></Tooltip>
      <Tooltip content="Vorheriger Unterrichtstag (Strg+Bild↑)" relationship="label"><Button size="small" appearance="subtle" icon={<ChevronLeft20Regular />} onClick={los(() => blaettern(-1))} /></Tooltip>
      <Input size="small" type="date" className={s.kopfDatum} value={d || ''} contentBefore={d ? <span style={{ fontSize: 12 }}>{tagKurz(d)}</span> : undefined}
        aria-label="Planungsdatum" onChange={(_, x) => { if (x.value) void datumSetzen(x.value); }} />
      <Tooltip content="Nächster Unterrichtstag (Strg+Bild↓)" relationship="label"><Button size="small" appearance="subtle" icon={<ChevronRight20Regular />} onClick={los(() => blaettern(1))} /></Tooltip>
      <Tooltip content="Eine Woche weiter" relationship="label"><Button size="small" appearance="subtle" icon={<ArrowNext20Regular />} onClick={los(() => blaettern(1, true))} /></Tooltip>
    </span>
  );
}
