// Vorschlagsliste (Auswahlliste eines Kombinationsfeldes) für Eingabefelder: Einträge mit Kurz- und Langname.
//
// Arten:
//   * einzeln (Standard)  – Element/Auswahl: Liste der zulässigen Werte, erster Treffer vorgewählt, Enter/Tab übernimmt.
//   * liste               – mehrere Werte („5a,5b“): ergänzt bzw. ersetzt den Teil nach dem letzten Komma; gewählte Werte
//                           tragen einen Haken, Klick schaltet einen Wert hinzu bzw. weg (Liste bleibt offen).
//   * frei                – Freitext: Vorschläge aus vorhandenen Werten, nichts vorgewählt (Enter speichert den Text).
// Reihenfolge der Treffer: gleicher Kurzname, Kurzname beginnt mit der Eingabe, Langname beginnt damit, Kurz- oder Langname
// enthält die Eingabe. Tastatur: ↑/↓ wählen, Enter/Tab übernehmen, Alt+↓ bzw. F4 alle zeigen, Esc schließen.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { ElementOption } from '@/api/typen';

export interface VorschlagslisteApi {
  /** Taste behandeln; true = verbraucht (der Aufrufer tut dann nichts weiter) */
  taste: (e: KeyboardEvent) => boolean;
  zeigen: (alle?: boolean) => void;
  umschalten: () => void;
  offen: () => boolean;
}

interface Props {
  input: RefObject<HTMLInputElement | null>;
  optionen: () => Promise<ElementOption[]> | ElementOption[];
  /** mehrere Werte, durch Komma getrennt */
  liste?: boolean;
  /** Freitext: nichts vorwählen, nur bei passenden Treffern zeigen */
  frei?: boolean;
  /** Wert gesetzt (nach Auswahl) */
  beiWahl?: (wert: string) => void;
  /** Liste sofort zeigen (alle Einträge, der aktuelle Wert vorgewählt) */
  sofort?: boolean;
  /** Kennung der Liste (aria-controls des Eingabefeldes) */
  id?: string;
}

const TRENNER = /[,;]/;

function token(v: string, liste: boolean) {
  if (!liste) return v.trim();
  const i = Math.max(v.lastIndexOf(','), v.lastIndexOf(';'));
  return v.slice(i + 1).trim();
}

/** Teile einer Liste („5a, 5b;6c“) */
export function listenTeile(v: string): string[] {
  return v.split(TRENNER).map((x) => x.trim()).filter(Boolean);
}

/** Treffer nach Rang: gleicher Kurzname, Kurzname beginnt mit t, Langname beginnt mit t, enthält t. */
export function treffer(alle: ElementOption[], t: string, max = 300): ElementOption[] {
  t = t.trim().toLowerCase();
  if (!t) return alle.slice(0, max);
  const r: ElementOption[][] = [[], [], [], [], []];
  for (const e of alle) {
    const k = e.k.toLowerCase(), l = (e.l || '').toLowerCase();
    if (k === t) r[0]!.push(e);
    else if (k.startsWith(t)) r[1]!.push(e);
    else if (l.startsWith(t) || l.split(/[\s,–-]+/).some((w) => w.startsWith(t))) r[2]!.push(e);
    else if (k.includes(t)) r[3]!.push(e);
    else if (l.includes(t)) r[4]!.push(e);
  }
  return r.flat().slice(0, max);
}

export const Vorschlagsliste = forwardRef<VorschlagslisteApi, Props>(function Vorschlagsliste({ input, optionen, liste = false, frei = false, beiWahl, sofort, id }, ref) {
  const [offen, setOffen] = useState(false);
  const [eintraege, setEintraege] = useState<ElementOption[]>([]);
  const [fokus, setFokus] = useState(-1);
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(() => new Set());
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; minWidth: number }>({ left: 0, top: 0, minWidth: 180 });
  const alleRef = useRef<ElementOption[] | null>(null);
  const listeRef = useRef<HTMLDivElement>(null);
  const zustandRef = useRef({ offen, eintraege, fokus });
  zustandRef.current = { offen, eintraege, fokus };

  const zeigen = async (alle = false, start = false) => {
    const el = input.current;
    if (!el) return;
    if (!alleRef.current) {
      try { alleRef.current = await optionen(); } catch { alleRef.current = []; }
    }
    if (!el.isConnected) return;
    const t = alle ? '' : token(el.value, liste);
    let l = treffer(alleRef.current, t);
    if (frei) l = l.filter((e) => e.k.toLowerCase() !== el.value.trim().toLowerCase());
    if (frei && (!t || !l.length)) { setOffen(false); return; }
    setEintraege(l);
    setGewaehlt(new Set(liste ? listenTeile(el.value).map((x) => x.toLowerCase()) : []));
    // vorwählen: beim Öffnen der aktuelle Wert, beim Tippen der erste Treffer (Freitext: nichts)
    const aktuell = el.value.trim().toLowerCase();
    setFokus(frei ? -1 : start && !liste ? l.findIndex((e) => e.k.toLowerCase() === aktuell) : t && l.length ? 0 : -1);
    const r = el.getBoundingClientRect();
    const unten = innerHeight - r.bottom;
    setPos(unten < 240 && r.top > unten
      ? { left: Math.max(4, Math.min(r.left, innerWidth - 280)), bottom: innerHeight - r.top, minWidth: Math.max(200, r.width) }
      : { left: Math.max(4, Math.min(r.left, innerWidth - 280)), top: r.bottom, minWidth: Math.max(200, r.width) });
    setOffen(true);
  };

  /** Eintrag übernehmen; in Listen: schaltet um (Klick) bzw. ergänzt den angefangenen Teil (Tastatur). */
  const waehlen = (i: number, umschalten: boolean) => {
    const e = zustandRef.current.eintraege[i];
    const el = input.current;
    if (!e || !el) return;
    if (liste) {
      const teile = listenTeile(el.value);
      const angefangen = token(el.value, true);
      const ohneAngefangen = angefangen && !TRENNER.test(el.value.slice(-1)) ? teile.slice(0, -1) : teile;
      const vorhanden = ohneAngefangen.findIndex((x) => x.toLowerCase() === e.k.toLowerCase());
      let neu: string[];
      if (vorhanden >= 0 && umschalten) neu = ohneAngefangen.filter((_, j) => j !== vorhanden);
      else if (vorhanden >= 0) neu = ohneAngefangen;
      else neu = [...ohneAngefangen, e.k];
      el.value = neu.join(',') + (neu.length ? ',' : '');
      setGewaehlt(new Set(neu.map((x) => x.toLowerCase())));
      setFokus(-1);
      // Liste bleibt offen und zeigt wieder alle Einträge
      void zeigen(true);
    } else {
      el.value = e.k;
      setOffen(false);
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
    beiWahl?.(el.value);
  };

  useEffect(() => {
    const el = input.current;
    if (!el) return;
    const eingabe = () => { void zeigen(); };
    const blur = () => setTimeout(() => { if (document.activeElement !== input.current) setOffen(false); }, 120);
    el.addEventListener('input', eingabe);
    el.addEventListener('blur', blur);
    if (sofort) void zeigen(true, true);
    return () => { el.removeEventListener('input', eingabe); el.removeEventListener('blur', blur); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  useEffect(() => { listeRef.current?.querySelector('.vs-eintrag.fokus')?.scrollIntoView({ block: 'nearest' }); }, [fokus, offen]);
  useEffect(() => { input.current?.setAttribute('aria-expanded', String(offen)); }, [offen, input]);

  useImperativeHandle(ref, () => ({
    offen: () => zustandRef.current.offen,
    zeigen: (alle) => { void zeigen(!!alle, !!alle); },
    umschalten: () => { if (zustandRef.current.offen) setOffen(false); else void zeigen(true, true); },
    taste: (e) => {
      if ((e.key === 'ArrowDown' && e.altKey) || e.key === 'F4') { e.preventDefault(); void zeigen(true, true); return true; }
      const z = zustandRef.current;
      if (!z.offen) return false;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = z.eintraege.length;
        if (n) setFokus(z.fokus < 0 ? (e.key === 'ArrowDown' ? 0 : n - 1) : (z.fokus + (e.key === 'ArrowDown' ? 1 : -1) + n) % n);
        return true;
      }
      if ((e.key === 'PageDown' || e.key === 'PageUp') && z.eintraege.length) {
        e.preventDefault();
        setFokus(Math.max(0, Math.min(z.eintraege.length - 1, z.fokus + (e.key === 'PageDown' ? 10 : -10))));
        return true;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && z.fokus >= 0 && !e.ctrlKey) {
        const t = token(input.current?.value || '', liste).toLowerCase();
        const e0 = z.eintraege[z.fokus]!;
        if (liste) {
          if (e.key === 'Enter') { e.preventDefault(); waehlen(z.fokus, !t); return true; }
          if (e0.k.toLowerCase() !== t && t) waehlen(z.fokus, false);
          setOffen(false);
          return false;
        }
        // einzeln: übernehmen und (vom Aufrufer) speichern
        if (e0.k.toLowerCase() !== t) waehlen(z.fokus, false);
        setOffen(false);
        return false;
      }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOffen(false); return true; }
      return false;
    },
  }));

  if (!offen) return null;
  return createPortal(
    <div className="vs-liste" role="listbox" id={id} aria-multiselectable={liste || undefined} ref={listeRef}
      style={{ left: pos.left, top: pos.top, bottom: pos.bottom, minWidth: pos.minWidth }} onPointerDown={(e) => e.preventDefault()}>
      {eintraege.length === 0 ? <div className="vs-leer">Kein passender Eintrag</div> : null}
      {eintraege.map((e, i) => {
        const an = liste && gewaehlt.has(e.k.toLowerCase());
        return (
          <div key={`${e.id}-${e.k}`} role="option" aria-selected={liste ? an : i === fokus}
            className={`vs-eintrag${i === fokus ? ' fokus' : ''}${an ? ' an' : ''}${e.c ? ` v-${e.c}` : ''}`} onClick={() => waehlen(i, true)}>
            {liste ? <span className={`vs-haken${an ? ' an' : ''}`} /> : null}
            <span className="k">{e.k}</span><span className="l">{e.l || ''}</span>
          </div>
        );
      })}
      {liste ? <div className="vs-fuss">Klick schaltet um · Enter ergänzt · Tab bzw. Strg+Enter speichert</div> : null}
    </div>,
    document.body,
  );
});
