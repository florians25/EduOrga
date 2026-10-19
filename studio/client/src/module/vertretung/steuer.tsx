// Steuerelemente der Vertretungsplanung: Zeitraum (Tag / Woche / frei), Datumsauswahl in der Kopfleiste und ein Knopf mit
// aufklappbarer Fläche für Optionen bzw. Filter (Schalter und Auswahlfelder, die nicht ständig sichtbar sein müssen).
import {
  Button, Popover, PopoverSurface, PopoverTrigger, Select, ToolbarButton, Tooltip, makeStyles, mergeClasses, tokens,
} from '@fluentui/react-components';
import {
  ArrowPrevious20Regular, ArrowNext20Regular, ChevronDown16Regular, ChevronLeft20Regular, ChevronRight20Regular,
} from '@fluentui/react-icons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useEreignis } from '@/kern/ereignisse';
import { fehlerMelden } from '@/komponenten/hinweise';
import { DatumFeld } from '@/komponenten/eingaben';
import { blaettern, datumSetzen, montag, planungsdatum, plusTage, usePlanungsdatum } from './kern';

const useStile = makeStyles({
  zeitraum: { display: 'inline-flex', alignItems: 'center', gap: '4px' },
  datum: { width: '150px' },
  bis: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, padding: '0 2px' },
  kopf: { display: 'inline-flex', alignItems: 'center', gap: '2px', padding: '0 4px', flexShrink: 0 },
  kopfDatum: { width: '150px', fontVariantNumeric: 'tabular-nums' },
  flaeche: { display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px 16px', minWidth: '260px', maxWidth: '420px' },
  flaecheTitel: { fontSize: tokens.fontSizeBase200, fontWeight: tokens.fontWeightSemibold, color: tokens.colorNeutralForeground2, margin: '4px 0 0 0' },
  anzahl: { marginLeft: '4px', color: tokens.colorBrandForeground1, fontVariantNumeric: 'tabular-nums' },
  umschalter: {
    display: 'inline-flex', alignItems: 'stretch', flexShrink: 0, borderRadius: tokens.borderRadiusMedium, overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground1, border: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  umschalterWahl: {
    border: 'none', margin: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: tokens.fontSizeBase200, fontWeight: tokens.fontWeightRegular,
    lineHeight: '22px', padding: '0 10px', backgroundColor: 'transparent', color: tokens.colorNeutralForeground2,
    ':not(:first-child)': { borderLeft: `1px solid ${tokens.colorNeutralStroke2}` },
    ':hover': { color: tokens.colorNeutralForeground1, backgroundColor: tokens.colorNeutralBackground1Hover },
    ':focus-visible': { outline: `2px solid ${tokens.colorStrokeFocus2}`, outlineOffset: '-2px' },
  },
  umschalterAn: {
    backgroundColor: tokens.colorNeutralBackground3, color: tokens.colorNeutralForeground1, fontWeight: tokens.fontWeightSemibold,
    boxShadow: 'inset 0 -2px 0 var(--edo-modus)', cursor: 'default',
    ':hover': { backgroundColor: tokens.colorNeutralBackground3, color: tokens.colorNeutralForeground1 },
  },
});

/** Umschalter mit zwei oder mehr Möglichkeiten („Tag | Woche“): flache Segmente, das gewählte grau hinterlegt mit Linie in der Modusfarbe. */
export function Umschalter<T extends string>({ wert, optionen, beiWahl, titel, testid }: {
  wert: T; optionen: { wert: T; text: string; titel?: string }[]; beiWahl: (w: T) => void; titel: string; testid?: string;
}) {
  const s = useStile();
  return (
    <span className={s.umschalter} role="radiogroup" aria-label={titel} title={titel} data-testid={testid}>
      {optionen.map((o) => (
        <button key={o.wert} type="button" role="radio" aria-checked={o.wert === wert} title={o.titel} data-wert={o.wert}
          className={mergeClasses(s.umschalterWahl, o.wert === wert && s.umschalterAn)} onClick={() => { if (o.wert !== wert) beiWahl(o.wert); }}>
          {o.text}
        </button>
      ))}
    </span>
  );
}

/** Werkzeugknopf „Optionen ▾“ bzw. „Filter ▾“ mit einer Fläche für Schalter und Felder; aktiv = Anzahl gesetzter Optionen. */
export function OptionenKnopf({ text, aktiv = 0, titel, children, testid }: { text: string; aktiv?: number; titel?: string; children: ReactNode; testid?: string }) {
  const s = useStile();
  return (
    <Popover positioning="below-start" trapFocus>
      <PopoverTrigger disableButtonEnhancement>
        <ToolbarButton title={titel || text} data-testid={testid} style={{ minWidth: 0 }}>
          {text}{aktiv ? <span className={s.anzahl}>{`(${aktiv})`}</span> : null}<ChevronDown16Regular style={{ marginLeft: 4 }} />
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverSurface className={s.flaeche}>{children}</PopoverSurface>
    </Popover>
  );
}

/** Zwischenüberschrift in einer Optionen-Fläche. */
export function OptionenTitel({ children }: { children: ReactNode }) {
  const s = useStile();
  return <p className={s.flaecheTitel}>{children}</p>;
}

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
      <DatumFeld size="small" className={s.datum} wert={z.von || ''} aria-label="Von" beiAenderung={(datum) => { if (!datum) return; if (z.art === 'tag') void datumSetzen(datum); else z.setzen(datum, z.bis); }} />
      <Tooltip content="Weiter" relationship="label"><Button size="small" appearance="subtle" icon={<ChevronRight20Regular />} onClick={() => schritt(1)} /></Tooltip>
      {z.art !== 'tag' ? <>
        <span className={s.bis}>bis</span>
        <DatumFeld size="small" className={s.datum} wert={z.bis || ''} disabled={z.art !== 'vonbis'} aria-label="Bis" beiAenderung={(datum) => { if (datum) z.setzen(z.von, datum); }} />
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
    <span className={s.kopf} title="Planungsdatum – Tag blättern mit Strg+Bild↑ / Strg+Bild↓, Woche mit Strg+Umschalt+Bild↑ / Strg+Umschalt+Bild↓" data-testid="planungsdatum">
      <Tooltip content="Eine Woche zurück (Strg+Umschalt+Bild↑)" relationship="label"><Button size="small" appearance="subtle" icon={<ArrowPrevious20Regular />} onClick={los(() => blaettern(-1, true))} /></Tooltip>
      <Tooltip content="Vorheriger Unterrichtstag (Strg+Bild↑)" relationship="label"><Button size="small" appearance="subtle" icon={<ChevronLeft20Regular />} onClick={los(() => blaettern(-1))} /></Tooltip>
      <DatumFeld size="small" className={s.kopfDatum} wert={d || ''} aria-label="Planungsdatum" beiAenderung={(datum) => { if (datum) void datumSetzen(datum); }} />
      <Tooltip content="Nächster Unterrichtstag (Strg+Bild↓)" relationship="label"><Button size="small" appearance="subtle" icon={<ChevronRight20Regular />} onClick={los(() => blaettern(1))} /></Tooltip>
      <Tooltip content="Eine Woche weiter (Strg+Umschalt+Bild↓)" relationship="label"><Button size="small" appearance="subtle" icon={<ArrowNext20Regular />} onClick={los(() => blaettern(1, true))} /></Tooltip>
    </span>
  );
}
