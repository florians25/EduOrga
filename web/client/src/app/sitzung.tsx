// Sitzung (angemeldete Person, Schule, Schuljahr, Ansichtseinstellungen, Darstellung der Stundenkarten) und Stammdaten als gemeinsamer Kontext aller Seiten.
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { holen } from '../api/client';
import type { Benutzer, Elemente, Sitzung } from '../api/types';
import { lesen, schreiben } from '../lib/speicher';
import { DarstellungsAnbieter, namenAus } from '../components/plan/darstellung';

export interface Schuljahr { von: string; bis: string; text: string; aktuell: boolean }

export interface SitzungsKontext {
  sitzung: Sitzung;
  ich: Benutzer;
  /** Schüler- bzw. Elternkonto mit zugeordneter Person (eigene Seiten). */
  familie: boolean;
  schuljahre: Schuljahr[];
  schuljahr: Schuljahr;
  schuljahrWaehlen: (von: string) => void;
  elemente: () => Promise<Elemente>;
  neuLaden: () => Promise<Sitzung>;
  setSitzung: (s: Sitzung) => void;
  recht: (name: string) => boolean;
}

const Kontext = createContext<SitzungsKontext | null>(null);

export function useSitzung(): SitzungsKontext {
  const k = useContext(Kontext);
  if (!k) throw new Error('Kein Sitzungskontext');
  return k;
}

export const istFamilie = (b: Benutzer | null | undefined) => !!b?.familie && (b.rolle === 'eltern' || (b.schuelerIds ?? []).length > 0);

function schuljahrText(sj: { von: string; bis: string }) {
  const v = sj.von.slice(0, 4), b = sj.bis.slice(0, 4);
  return v === b ? v : `${v}/${b}`;
}

export function SitzungsAnbieter({ sitzung, setSitzung, children }: { sitzung: Sitzung; setSitzung: (s: Sitzung) => void; children: ReactNode }) {
  const cache = useRef<Promise<Elemente> | null>(null);
  const [jahrVon, setJahrVon] = useState<string | null>(() => lesen<string | null>('untplan:schuljahr', null, true));

  const schuljahre = useMemo<Schuljahr[]>(() => {
    const sj = sitzung.schuljahr;
    if (!sj) return [];
    const start = Number(sj.von.slice(0, 4));
    return Array.from({ length: 8 }, (_, i) => {
      const j = start - i;
      return i === 0 ? { von: sj.von, bis: sj.bis, text: schuljahrText(sj), aktuell: true }
        : { von: `${j}-08-01`, bis: `${j + 1}-07-31`, text: `${j}/${j + 1}`, aktuell: false };
    });
  }, [sitzung.schuljahr]);

  const elemente = useCallback(() => {
    if (!cache.current) cache.current = holen<Elemente>('/api/app/elemente').catch(err => { cache.current = null; throw err; });
    return cache.current;
  }, []);

  const neuLaden = useCallback(async () => {
    const s = await holen<Sitzung>('/api/app/sitzung');
    setSitzung(s);
    return s;
  }, [setSitzung]);

  const wert = useMemo<SitzungsKontext>(() => {
    const ich = sitzung.benutzer!;
    return {
      sitzung, ich, familie: istFamilie(ich), schuljahre,
      schuljahr: schuljahre.find(x => x.von === jahrVon) ?? schuljahre[0] ?? { von: '', bis: '', text: '', aktuell: true },
      schuljahrWaehlen: von => { schreiben('untplan:schuljahr', von, true); setJahrVon(von); },
      elemente, neuLaden, setSitzung,
      recht: name => ich.admin || (ich.rechte?.[name] ?? 0) > 0,
    };
  }, [sitzung, schuljahre, jahrVon, elemente, neuLaden, setSitzung]);

  const namenLaden = useCallback(() => elemente().then(namenAus), [elemente]);
  return (
    <Kontext.Provider value={wert}>
      <DarstellungsAnbieter wert={sitzung.darstellung} namenLaden={namenLaden}>{children}</DarstellungsAnbieter>
    </Kontext.Provider>
  );
}
