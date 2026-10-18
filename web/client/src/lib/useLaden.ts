// Daten laden mit Ladezustand und Fehler; neu() lädt erneut. Veraltete Antworten (schneller Seitenwechsel) werden verworfen.
import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

export interface Geladen<T> { daten: T | undefined; laedt: boolean; fehler: Error | null; neu: () => Promise<void>; setDaten: (d: T | ((alt: T | undefined) => T)) => void }

export function useLaden<T>(laden: (signal: AbortSignal) => Promise<T>, abh: DependencyList): Geladen<T> {
  const [daten, setDaten] = useState<T | undefined>(undefined);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<Error | null>(null);
  const lauf = useRef(0);
  const fn = useRef(laden);
  fn.current = laden;

  const neu = useCallback(async () => {
    const nr = ++lauf.current;
    const ac = new AbortController();
    setLaedt(true);
    try {
      const d = await fn.current(ac.signal);
      if (nr === lauf.current) { setDaten(d); setFehler(null); }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      if (nr === lauf.current) setFehler(err as Error);
    } finally {
      if (nr === lauf.current) setLaedt(false);
    }
  }, []);

  useEffect(() => {
    void neu();
    return () => { lauf.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, abh);

  return { daten, laedt, fehler, neu, setDaten: setDaten as Geladen<T>['setDaten'] };
}
