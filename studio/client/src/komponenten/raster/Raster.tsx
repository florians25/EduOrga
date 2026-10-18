// Grundraster eines Stundenplans: Spaltenköpfe (Tage), Zeitspalte (Stunde, Beginn–Ende), Felder je Tag und Stunde als
// Ablagen (dnd-kit), Blöcke über mehrere Stunden. Zielfelder werden beim Ziehen nach dem Zielstatus eingefärbt
// (Frei, VorgabeVerletzt, KeinRaum, TauschMoeglich, Kollision); liegt ein Grund vor, erscheint er am Mauszeiger.
import { useDroppable } from '@dnd-kit/core';
import { forwardRef, memo, type MouseEvent, type ReactNode } from 'react';
import type { Stunde } from '@/api/typen';
import { useZiehen, type AblageDaten } from '../ziehen';
import './raster.css';

export interface RasterTag { kopf: ReactNode; titel?: string; klasse?: string; gesperrt?: boolean }
export interface RasterBlock { key: string; tag: number; von: number; laenge: number; inhalt: ReactNode }

export interface RasterProps {
  id: string;
  tage: RasterTag[];
  stunden: Stunde[];
  /** je Tag (Index) und Stunde (Index): 'V' Vormittag, 'N' Nachmittag, '' nicht verfügbar */
  belegung?: string[][];
  kompakt?: boolean;
  bloecke: RasterBlock[];
  /** Zielstatus [tag][stunde-1] während des Ziehens */
  ziele?: (string | null)[][] | null;
  gruende?: (string | null)[][] | null;
  ablage?: (tag: number, stunde: number) => AblageDaten | null;
  feldKontextmenue?: (tag: number, stunde: number, e: MouseEvent) => void;
  feldKlick?: (tag: number, stunde: number) => void;
  zeitAnzeigen?: boolean;
  /** zusätzliche Klasse je Feld (Tag-Index, Stunde) */
  feldKlasse?: (tag: number, stunde: number) => string | null | undefined;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}

const Feld = memo(function Feld({ id, tag, stunde, zeile, spalte, klasse, ziel, ablage, kontext, klick }: {
  id: string; tag: number; stunde: number; zeile: number; spalte: number; klasse: string; ziel: string | null | undefined;
  ablage: AblageDaten | null; kontext?: (e: MouseEvent) => void; klick?: () => void;
}) {
  const { setNodeRef, isOver, active } = useDroppable({ id: `${id}:${tag}:${stunde}`, data: ablage ?? undefined, disabled: !ablage });
  const nimmt = isOver && !!ablage && !!active && ablage.annehmen(active.data.current as never);
  return (
    <div ref={setNodeRef} className={`ra-feld${klasse}${ziel ? ` ziel-${ziel}` : ''}${nimmt ? ' drueber' : ''}`} data-tag={tag} data-stunde={stunde}
      style={{ gridRow: String(zeile + 2), gridColumn: String(spalte + 2) }} onContextMenu={kontext ? (e) => { e.preventDefault(); kontext(e); } : undefined} onClick={klick} />
  );
});

function Grund({ id, gruende }: { id: string; gruende: (string | null)[][] }) {
  const { aktiv, x, y, ueber } = useZiehen();
  if (!aktiv || !ueber || !ueber.startsWith(`${id}:`)) return null;
  const [, t, s] = ueber.split(':');
  const text = gruende[Number(t)]?.[Number(s) - 1];
  if (!text) return null;
  return <div className="ra-grund" style={{ left: Math.min(x + 14, window.innerWidth - 310), top: y + 16 }}>{text}</div>;
}

export const Raster = forwardRef<HTMLDivElement, RasterProps>(function Raster(p, ref) {
  const { id, tage, stunden, belegung, kompakt, bloecke, ziele, gruende, ablage, zeitAnzeigen = true } = p;
  return (
    <div ref={ref} className={`ra${kompakt ? ' kompakt' : ''}${p.className ? ` ${p.className}` : ''}`} tabIndex={0} onKeyDown={p.onKeyDown} data-raster={id}>
      <div className="ra-gitter" style={{ ['--tage' as string]: tage.length, gridTemplateRows: `32px repeat(${stunden.length}, minmax(${kompakt ? 32 : 52}px, auto))` }}>
        <div className="ra-ecke" style={{ gridRow: '1', gridColumn: '1' }} />
        {tage.map((t, i) => <div key={`k${i}`} className={`ra-kopf${t.klasse ? ` ${t.klasse}` : ''}`} style={{ gridRow: '1', gridColumn: String(i + 2) }} title={t.titel}>{t.kopf}</div>)}
        {stunden.map((s, j) => {
          const pause = s.pauseDanach ? ' pause-danach' : '';
          return (
            <div key={`s${s.nr}`} className={`ra-stunde${pause}`} style={{ gridRow: String(j + 2), gridColumn: '1' }} title={s.pauseDanach ? `danach Pause: ${s.pauseDanach}` : ''}>
              <span className="nr">{s.label}</span>
              {s.beginn && zeitAnzeigen && !kompakt ? <span className="zeit">{s.beginn}–{s.ende}</span> : null}
            </div>
          );
        })}
        {tage.map((t, i) => stunden.map((s, j) => {
          const art = t.gesperrt ? '' : (belegung?.[i]?.[j] ?? 'V');
          const extra = p.feldKlasse?.(i, s.nr);
          const kl = `${s.pauseDanach ? ' pause-danach' : ''}${art === '' ? ' gesperrt' : art === 'N' ? ' nachmittag' : ''}${extra ? ` ${extra}` : ''}`;
          return (
            <Feld key={`f${i}:${s.nr}`} id={id} tag={i} stunde={s.nr} zeile={j} spalte={i} klasse={kl} ziel={ziele?.[i]?.[s.nr - 1]}
              ablage={ablage ? ablage(i, s.nr) : null}
              kontext={p.feldKontextmenue ? (e) => p.feldKontextmenue!(i, s.nr, e) : undefined}
              klick={p.feldKlick ? () => p.feldKlick!(i, s.nr) : undefined} />
          );
        }))}
        {bloecke.map((b) => (
          <div key={b.key} className="ra-block" style={{ gridColumn: String(b.tag + 2), gridRow: `${b.von + 2} / span ${b.laenge}` }}>{b.inhalt}</div>
        ))}
      </div>
      {gruende ? <Grund id={id} gruende={gruende} /> : null}
    </div>
  );
});
