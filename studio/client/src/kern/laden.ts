// Daten einer Ansicht laden und bei passenden Änderungen (Ereignis „daten“) neu laden.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Bereich } from '@/api/typen';
import { fehlerMelden } from '@/komponenten/hinweise';
import { betrifft, useEreignis } from './ereignisse';

export interface LadeOptionen {
  /** Neu laden bei Änderungen dieser Bereiche */
  bereiche?: Bereich[];
  /** Änderungen dieser Quelle (eigene Ansicht) nicht neu laden */
  quelle?: string;
  /** false = (noch) nicht laden */
  aktiv?: boolean;
}

export function useDaten<T>(laden: () => Promise<T>, deps: unknown[], o: LadeOptionen = {}) {
  const [daten, setDaten] = useState<T | undefined>(undefined);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<unknown>(null);
  const nr = useRef(0);
  const ladenRef = useRef(laden);
  ladenRef.current = laden;
  const aktiv = o.aktiv !== false;

  const neuLaden = useCallback(async (still = false) => {
    const n = ++nr.current;
    if (!still) setLaedt(true);
    try {
      const d = await ladenRef.current();
      if (n === nr.current) { setDaten(d); setFehler(null); }
    } catch (e) {
      if (n === nr.current) { setFehler(e); if (!still) fehlerMelden(e); }
    } finally {
      if (n === nr.current) setLaedt(false);
    }
  }, []);

  useEffect(() => {
    if (aktiv) void neuLaden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktiv, ...deps]);

  useEreignis('daten', (e) => {
    if (!aktiv || !o.bereiche) return;
    if (o.quelle && e.quelle === o.quelle) return;
    if (betrifft(e, ...o.bereiche)) void neuLaden(true);
  });

  return { daten, setDaten, laedt, fehler, neuLaden };
}
