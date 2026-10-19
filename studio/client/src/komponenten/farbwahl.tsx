// Farbwahl: kleine schwebende Fläche mit einer ruhigen Palette (24 Farben in drei Reihen: mittel, hell, gedeckt), „Keine Farbe“
// und eigener Farbe als Hex-Wert. Aufruf von überall: `await farbwahl(x, y, { wert, titel })` → '#rrggbb', '' (keine Farbe) oder
// null (abgebrochen). Dazu Hilfen für gut unterscheidbare Zufallsfarben (`zufallsfarben`) und lesbare Schrift auf einer Farbe.
import { Button, Input, Popover, PopoverSurface, makeStyles, tokens, type PositioningVirtualElement } from '@fluentui/react-components';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { create } from 'zustand';

/** Kuratierte Palette: Reihe 1 mittel, Reihe 2 hell, Reihe 3 gedeckt – je 8 Farbtöne (Blau, Petrol, Grün, Oliv, Orange, Rot, Rosa, Violett). */
export const FARBPALETTE: { wert: string; name: string }[] = [
  { wert: '#4e79a7', name: 'Blau' }, { wert: '#499894', name: 'Petrol' }, { wert: '#59a14f', name: 'Grün' }, { wert: '#b6992d', name: 'Oliv' },
  { wert: '#e08a3c', name: 'Orange' }, { wert: '#e15759', name: 'Rot' }, { wert: '#d37295', name: 'Rosa' }, { wert: '#b07aa1', name: 'Violett' },
  { wert: '#a0cbe8', name: 'Hellblau' }, { wert: '#86bcb6', name: 'Helles Petrol' }, { wert: '#8cd17d', name: 'Hellgrün' }, { wert: '#f1ce63', name: 'Gelb' },
  { wert: '#ffbe7d', name: 'Apricot' }, { wert: '#ff9d9a', name: 'Lachs' }, { wert: '#fabfd2', name: 'Hellrosa' }, { wert: '#d4a6c8', name: 'Flieder' },
  { wert: '#2f5d8a', name: 'Dunkelblau' }, { wert: '#2e6e6a', name: 'Dunkles Petrol' }, { wert: '#3d7a3a', name: 'Dunkelgrün' }, { wert: '#7f6a1f', name: 'Ocker' },
  { wert: '#9d7660', name: 'Braun' }, { wert: '#a33a3c', name: 'Weinrot' }, { wert: '#79706e', name: 'Grau' }, { wert: '#6b5b95', name: 'Dunkelviolett' },
];

const HEX = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i;

/** '#abc', 'abc', '#AABBCC' → '#aabbcc'; sonst null. */
export function hexNormal(t: string | null | undefined): string | null {
  const m = HEX.exec((t || '').trim());
  if (!m) return null;
  let h = m[1]!.toLowerCase();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return `#${h}`;
}

// ---- Farbabstand (OKLab) ----
const lin = (c: number) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
const delin = (x: number) => { const c = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055; return Math.round(Math.min(1, Math.max(0, c)) * 255); };
type Lab = [number, number, number];
function oklab(hex: string): Lab {
  const n = parseInt(hex.slice(1), 16);
  const r = lin(n >> 16), g = lin((n >> 8) & 255), b = lin(n & 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function ausOklch(L: number, C: number, h: number): string {
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return `#${[r, g, bl].map((x) => delin(x).toString(16).padStart(2, '0')).join('')}`;
}
const abstand = (x: Lab, y: Lab) => Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);

/**
 * `anzahl` gut unterscheidbare Farben, möglichst weit weg von den schon vergebenen (`vorhanden`) und voneinander:
 * zuerst aus der Palette (zufällige Reihenfolge, dann jeweils die am weitesten entfernte), danach weitere Töne auf einem
 * Farbkreis mit gleicher Helligkeit und Sättigung. Alle Farben tragen dunkle bzw. helle Schrift mit ausreichendem Kontrast.
 */
export function zufallsfarben(anzahl: number, vorhanden: string[] = []): string[] {
  const belegt: Lab[] = vorhanden.map(hexNormal).filter((x): x is string => !!x).map(oklab);
  const kandidaten = FARBPALETTE.map((f) => f.wert).sort(() => Math.random() - 0.5);
  // weitere Kandidaten (für sehr viele Elemente): Farbkreis in drei Helligkeiten
  const start = Math.random() * Math.PI * 2;
  for (let i = 0; i < Math.max(0, anzahl - kandidaten.length) * 2 + 12; i++) {
    const L = [0.68, 0.8, 0.56][i % 3]!;
    kandidaten.push(ausOklch(L, 0.11, start + i * 2.399963));
  }
  const erg: string[] = [];
  const frei = kandidaten.map((h) => ({ h, lab: oklab(h) }));
  while (erg.length < anzahl && frei.length) {
    let besterI = 0, besterD = -1;
    frei.forEach((k, i) => {
      const d = belegt.length ? Math.min(...belegt.map((b) => abstand(b, k.lab))) : 1;
      if (d > besterD + 1e-9) { besterD = d; besterI = i; }
    });
    const [k] = frei.splice(besterI, 1);
    erg.push(k!.h);
    belegt.push(k!.lab);
    // Palette erschöpft: Abstände wieder zulassen (Farben dürfen sich wiederholen)
    if (!frei.length && erg.length < anzahl) frei.push(...kandidaten.map((h) => ({ h, lab: oklab(h) })));
  }
  return erg;
}

/** Relative Leuchtdichte (WCAG) */
function leuchtdichte(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
/** Schriftfarbe mit dem besseren Kontrast auf dieser Farbe (dunkler Text oder weiß). */
export function schriftAuf(hex: string | null | undefined): string | undefined {
  const h = hexNormal(hex);
  if (!h) return undefined;
  const L = leuchtdichte(h);
  return (L + 0.05) / 0.05 >= 1.05 / (L + 0.05) ? '#1b2a2f' : '#ffffff';
}

// ---- Fläche ----
interface Wahl { offen: boolean; x: number; y: number; wert: string; titel: string; nr: number; fertig: ((w: string | null) => void) | null }
const useWahl = create<Wahl>(() => ({ offen: false, x: 0, y: 0, wert: '', titel: '', nr: 0, fertig: null }));

/** Farbwahl an Position (x, y) öffnen. Ergebnis: '#rrggbb', '' = keine Farbe, null = abgebrochen. */
export function farbwahl(x: number, y: number, { wert = '', titel = 'Farbe' }: { wert?: string | null; titel?: string } = {}): Promise<string | null> {
  return new Promise((fertig) => {
    useWahl.getState().fertig?.(null);
    useWahl.setState((s) => ({ offen: true, x, y, wert: hexNormal(wert) || '', titel, nr: s.nr + 1, fertig }));
  });
}
/** Farbwahl unter einem Element öffnen. */
export const farbwahlAn = (el: Element | null | undefined, o?: { wert?: string | null; titel?: string }) => {
  const r = el?.getBoundingClientRect();
  return farbwahl(r ? r.left : window.innerWidth / 2 - 130, r ? r.bottom + 2 : 160, o);
};

const useStile = makeStyles({
  flaeche: { padding: '12px', width: '262px', display: 'flex', flexDirection: 'column', gap: '10px' },
  titel: { fontWeight: tokens.fontWeightSemibold, fontSize: tokens.fontSizeBase300, margin: 0 },
  gitter: { display: 'grid', gridTemplateColumns: 'repeat(8, 26px)', gap: '6px' },
  feld: {
    width: '26px', height: '26px', borderRadius: '3px', border: `1px solid color-mix(in srgb, ${tokens.colorNeutralForeground1} 18%, transparent)`, padding: 0, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    ':focus-visible': { outline: `2px solid ${tokens.colorStrokeFocus2}`, outlineOffset: '1px' },
    ':hover': { boxShadow: `0 0 0 1px ${tokens.colorNeutralForeground2}` },
  },
  gewaehlt: { boxShadow: `0 0 0 2px ${tokens.colorNeutralBackground1}, 0 0 0 4px ${tokens.colorBrandStroke1}`, ':hover': { boxShadow: `0 0 0 2px ${tokens.colorNeutralBackground1}, 0 0 0 4px ${tokens.colorBrandStroke1}` } },
  zeile: { display: 'flex', alignItems: 'center', gap: '6px' },
  vorschau: { width: '26px', height: '26px', borderRadius: '3px', border: `1px solid ${tokens.colorNeutralStroke1}`, flexShrink: 0 },
  leer: { backgroundImage: `linear-gradient(135deg, transparent 46%, ${tokens.colorPaletteRedForeground1} 46%, ${tokens.colorPaletteRedForeground1} 54%, transparent 54%)` },
  hex: { width: '96px', fontVariantNumeric: 'tabular-nums' },
  nativ: { width: '30px', height: '26px', padding: 0, border: `1px solid ${tokens.colorNeutralStroke1}`, borderRadius: '3px', background: 'none', cursor: 'pointer' },
  knoepfe: { display: 'flex', justifyContent: 'space-between', gap: '8px' },
});

export function FarbwahlHost() {
  const s = useStile();
  const { offen, x, y, wert, titel, nr, fertig } = useWahl();
  const [hex, setHex] = useState(wert);
  const gitter = useRef<HTMLDivElement>(null);
  useEffect(() => { setHex(wert); }, [wert, nr]);
  useEffect(() => {
    if (!offen) return;
    const t = setTimeout(() => {
      const knopf = gitter.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]') || gitter.current?.querySelector<HTMLButtonElement>('button');
      knopf?.focus();
    }, 30);
    return () => clearTimeout(t);
  }, [offen, nr]);
  const ziel: PositioningVirtualElement = { getBoundingClientRect: () => ({ x, y, left: x, top: y, right: x, bottom: y, width: 0, height: 0 } as DOMRect) };
  const schliessen = (w: string | null) => { useWahl.setState({ offen: false, fertig: null }); fertig?.(w); };
  const eigen = hexNormal(hex);
  const pfeile = (e: KeyboardEvent<HTMLDivElement>) => {
    const knoepfe = [...(gitter.current?.querySelectorAll<HTMLButtonElement>('button') || [])];
    const i = knoepfe.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 8, ArrowUp: -8 }[e.key];
    if (!d) return;
    e.preventDefault();
    knoepfe[Math.max(0, Math.min(knoepfe.length - 1, i + d))]?.focus();
  };
  return (
    <Popover key={nr} open={offen} trapFocus onOpenChange={(_, d) => { if (!d.open) schliessen(null); }}
      positioning={{ target: ziel, position: 'below', align: 'start', offset: 2 }}>
      <PopoverSurface className={s.flaeche} aria-label={titel} data-testid="farbwahl">
        <p className={s.titel}>{titel}</p>
        <div ref={gitter} className={s.gitter} role="group" aria-label="Palette" onKeyDown={pfeile}>
          {FARBPALETTE.map((f) => (
            <button key={f.wert} type="button" className={`${s.feld}${wert === f.wert ? ` ${s.gewaehlt}` : ''}`} style={{ background: f.wert }}
              title={`${f.name} (${f.wert})`} aria-label={f.name} aria-pressed={wert === f.wert} data-farbe={f.wert}
              onClick={() => schliessen(f.wert)} />
          ))}
        </div>
        <div className={s.zeile}>
          <span className={`${s.vorschau}${eigen ? '' : ` ${s.leer}`}`} style={eigen ? { background: eigen } : undefined} aria-hidden />
          <Input size="small" className={s.hex} value={hex} placeholder="#3f7f9a" aria-label="Eigene Farbe (Hex)" data-testid="farbwahl-hex"
            onChange={(_, d) => setHex(d.value)} onKeyDown={(e) => { if (e.key === 'Enter' && eigen) { e.preventDefault(); schliessen(eigen); } }} />
          <input type="color" className={s.nativ} value={eigen || '#4e79a7'} aria-label="Farbe frei wählen" title="Farbe frei wählen"
            onChange={(e) => setHex(e.target.value)} />
          <Button size="small" appearance="primary" disabled={!eigen} onClick={() => schliessen(eigen)}>OK</Button>
        </div>
        <div className={s.knoepfe}>
          <Button size="small" appearance="subtle" onClick={() => schliessen('')} data-testid="farbwahl-keine">Keine Farbe</Button>
          <Button size="small" appearance="subtle" onClick={() => schliessen(null)}>Abbrechen</Button>
        </div>
      </PopoverSurface>
    </Popover>
  );
}
