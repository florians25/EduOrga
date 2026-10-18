// Vorschlagsliste für Eingabefelder: Elemente mit Kurz- und Langname. Für Listen (z. B. Klassen „5a,5b“) wird der Teil nach
// dem letzten Komma ergänzt. Tastatur: ↑/↓ wählen, Enter/Tab übernehmen, Alt+↓ bzw. F4 alle zeigen, Esc schließen.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { ElementOption } from '@/api/typen';

export interface VorschlagslisteApi {
  /** Taste behandeln; true = verbraucht (der Aufrufer tut dann nichts weiter) */
  taste: (e: KeyboardEvent) => boolean;
  zeigen: (alle?: boolean) => void;
  offen: () => boolean;
}

interface Props {
  input: RefObject<HTMLInputElement | null>;
  optionen: () => Promise<ElementOption[]> | ElementOption[];
  liste?: boolean;
  /** Wert gesetzt (nach Auswahl) */
  beiWahl?: (wert: string) => void;
  /** Liste sofort zeigen */
  sofort?: boolean;
}

function token(v: string, liste: boolean) {
  if (!liste) return v.trim();
  const i = Math.max(v.lastIndexOf(','), v.lastIndexOf(';'));
  return v.slice(i + 1).trim();
}

export const Vorschlagsliste = forwardRef<VorschlagslisteApi, Props>(function Vorschlagsliste({ input, optionen, liste = false, beiWahl, sofort }, ref) {
  const [offen, setOffen] = useState(false);
  const [treffer, setTreffer] = useState<ElementOption[]>([]);
  const [fokus, setFokus] = useState(-1);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; minWidth: number }>({ left: 0, top: 0, minWidth: 180 });
  const alleRef = useRef<ElementOption[] | null>(null);
  const listeRef = useRef<HTMLDivElement>(null);
  const zustandRef = useRef({ offen, treffer, fokus });
  zustandRef.current = { offen, treffer, fokus };

  const zeigen = async (alle = false) => {
    const el = input.current;
    if (!el) return;
    if (!alleRef.current) alleRef.current = await optionen();
    if (!el.isConnected) return;
    const t = alle ? '' : token(el.value, liste).toLowerCase();
    const a: ElementOption[] = [], b: ElementOption[] = [], c: ElementOption[] = [];
    for (const e of alleRef.current) {
      const k = e.k.toLowerCase();
      if (!t || k.startsWith(t)) a.push(e);
      else if (k.includes(t)) b.push(e);
      else if ((e.l || '').toLowerCase().includes(t)) c.push(e);
    }
    setTreffer([...a, ...b, ...c].slice(0, 300));
    setFokus(t && a.length + b.length + c.length ? 0 : -1);
    const r = el.getBoundingClientRect();
    const unten = innerHeight - r.bottom;
    setPos(unten < 220 && r.top > unten
      ? { left: Math.min(r.left, innerWidth - 260), bottom: innerHeight - r.top, minWidth: Math.max(180, r.width) }
      : { left: Math.min(r.left, innerWidth - 260), top: r.bottom, minWidth: Math.max(180, r.width) });
    setOffen(true);
  };

  const waehlen = (i: number) => {
    const e = zustandRef.current.treffer[i];
    const el = input.current;
    if (!e || !el) return;
    if (liste) {
      const v = el.value;
      const p = Math.max(v.lastIndexOf(','), v.lastIndexOf(';'));
      el.value = (p >= 0 ? v.slice(0, p + 1) : '') + e.k;
    } else el.value = e.k;
    setOffen(false);
    beiWahl?.(el.value);
  };

  useEffect(() => {
    const el = input.current;
    if (!el) return;
    const eingabe = () => { void zeigen(); };
    const blur = () => setTimeout(() => setOffen(false), 120);
    el.addEventListener('input', eingabe);
    el.addEventListener('blur', blur);
    if (sofort) void zeigen();
    return () => { el.removeEventListener('input', eingabe); el.removeEventListener('blur', blur); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  useEffect(() => { listeRef.current?.querySelector('.vs-eintrag.fokus')?.scrollIntoView({ block: 'nearest' }); }, [fokus]);

  useImperativeHandle(ref, () => ({
    offen: () => zustandRef.current.offen,
    zeigen: (alle) => { void zeigen(alle); },
    taste: (e) => {
      if ((e.key === 'ArrowDown' && e.altKey) || e.key === 'F4') { e.preventDefault(); void zeigen(true); return true; }
      const z = zustandRef.current;
      if (!z.offen) return false;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = z.treffer.length;
        if (n) setFokus((z.fokus + (e.key === 'ArrowDown' ? 1 : -1) + n) % n);
        return true;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && z.fokus >= 0) {
        const t = token(input.current?.value || '', liste).toLowerCase();
        if (z.treffer[z.fokus]!.k.toLowerCase() !== t) { e.preventDefault(); waehlen(z.fokus); return e.key === 'Enter'; }
        setOffen(false);
        return false;
      }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOffen(false); return true; }
      return false;
    },
  }));

  if (!offen) return null;
  return createPortal(
    <div className="vs-liste" role="listbox" ref={listeRef} style={{ left: pos.left, top: pos.top, bottom: pos.bottom, minWidth: pos.minWidth }} onPointerDown={(e) => e.preventDefault()}>
      {treffer.length === 0 ? <div className="vs-leer">Kein passender Eintrag</div> : null}
      {treffer.map((e, i) => (
        <div key={`${e.id}-${e.k}`} role="option" aria-selected={i === fokus} className={`vs-eintrag${i === fokus ? ' fokus' : ''}${e.c ? ` v-${e.c}` : ''}`} onClick={() => waehlen(i)}>
          <span className="k">{e.k}</span><span className="l">{e.l || ''}</span>
        </div>
      ))}
    </div>,
    document.body,
  );
});
