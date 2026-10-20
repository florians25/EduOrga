// Steckbrett der Plantafel: Zeilen = Klassen, Lehrkräfte oder Räume, Spalten = Tage × Stunden, je Block eine kompakte Karte
// (Fach, darunter Lehrkraft bzw. Klasse in der Dichte „Normal“). Für viele Zeilen gebaut: nur sichtbare Zeilen werden gezeichnet,
// das Brett ist EINE Ablage (dnd-kit), das Zielfeld ergibt sich aus der Mausposition. Beim Ziehen färben sich die Zeilen des
// gezogenen Unterrichts (bei Kopplung alle beteiligten Zeilen) und der Stundenkopf nach der Zielstufe (frei, Tausch, Hinweis, hart),
// der Grund steht am Mauszeiger. Tastatur: Pfeile bewegen den Cursor, Enter nimmt eine Karte auf bzw. legt sie ab, Esc bricht ab,
// Entf entplant, F fixiert, Umschalt+F10 öffnet das Kontextmenü.
import { useDndMonitor, useDraggable, useDroppable, type DragStartEvent } from '@dnd-kit/core';
import {
  forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState,
  type KeyboardEvent, type MouseEvent,
} from 'react';
import { useZiehen, type AblageDaten, type ZiehDaten } from '@/komponenten/ziehen';
import {
  STUFENTEXT, kartenText, slot, zieleLaden, type Aufbereitet, type Karte, type Stufe, type TafelDaten, type TafelTyp, type TafelZeile, type Ziele,
} from './daten';

/** Ein Zug: verplante Karte (an der Stunde „stunde“ gegriffen) oder offener Block aus dem Vorrat. */
export interface TafelZug { art: 'karte' | 'vorrat'; u: number; laenge: number; tag?: number; stunde?: number; einzeln?: boolean; karte?: Karte }
export interface TafelAblage { zug: TafelZug; zielTag: number; zielStunde: number; stufe: Stufe | null }
export interface TafelAuswahl { u: number; karte?: string; zeile?: number }

export interface SteckbrettApi { zuZeile: (id: number) => void; fokus: () => void }

interface Props {
  daten: TafelDaten;
  auf: Aufbereitet;
  typ: TafelTyp;
  zeilen: TafelZeile[];
  dichte: 'kompakt' | 'normal';
  /** Fachfarben aus den Stammdaten zeigen (sonst neutral) */
  farben: boolean;
  version: number;
  schreiben: boolean;
  auswahl: TafelAuswahl | null;
  beiAuswahl: (a: TafelAuswahl | null) => void;
  zeileGewaehlt: number | null;
  beiZeile: (id: number | null) => void;
  tastZug: TafelZug | null;
  setTastZug: (z: TafelZug | null) => void;
  beiAblegen: (a: TafelAblage) => void;
  beiEntplanen: (k: Karte, nurStunde?: number) => void;
  beiFixieren: (k: Karte) => void;
  beiKontext: (k: Karte, zeile: number, x: number, y: number) => void;
  beiZeileOeffnen: (id: number) => void;
  /** offene Stunden je Zeile (Zahl am Zeilenkopf) */
  offenJeZeile: Map<number, number>;
}

const KOPF_TAG = 22;
const KOPF_STUNDE = 20;
const KOPF = KOPF_TAG + KOPF_STUNDE;
const LABEL = 64;
const MIN_SPALTE = 22;

interface Geometrie { spalte: number; breite: number; S: number; T: number; spur: number; oben: number[]; hoehe: number[]; gesamt: number }

const zugAus = (d: ZiehDaten | null | undefined): TafelZug | null =>
  d && (d.art === 'tafel-karte' || d.art === 'tafel-vorrat') ? (d.zug as TafelZug) : null;

// ---------------------------------------------------------------------------------------------
// Karte (Chip)

interface ChipProps {
  karte: Karte; zeile: number; x: number; w: number; y: number; h: number; dichte: 'kompakt' | 'normal';
  fach: string; zweit: string; farbe: string | null; gekoppelt: boolean; titel: string; woche: string | null;
  gewaehlt: boolean; verbunden: boolean; ziehbar: boolean; spalte: number;
  klick: (k: Karte, zeile: number, ev: MouseEvent) => void;
  doppelklick: (zeile: number) => void;
  kontext: (k: Karte, zeile: number, ev: MouseEvent) => void;
}

const Chip = memo(function Chip(p: ChipProps) {
  const { karte, zeile } = p;
  const daten = useMemo<ZiehDaten>(() => {
    const zug: TafelZug = { art: 'karte', u: karte.u, laenge: karte.laenge, tag: karte.tag, stunde: karte.von, einzeln: false, karte };
    const d: ZiehDaten = {
      art: 'tafel-karte', zug,
      vorschau: () => <div className="pt-vorschau"><b>{p.fach}</b>{p.zweit ? ` · ${p.zweit}` : ''}{karte.laenge > 1 ? ` · ${karte.laenge} Std.` : ''}</div>,
      beimStart: (ev: DragStartEvent) => {
        const r = ev.active.rect.current.initial;
        const pe = ev.activatorEvent as PointerEvent;
        const idx = r && pe.clientX !== undefined ? Math.max(0, Math.min(karte.laenge - 1, Math.floor((pe.clientX - r.left) / (r.width / karte.laenge)))) : 0;
        zug.stunde = karte.von + idx;
        zug.einzeln = !!pe.shiftKey && karte.laenge > 1;
      },
    };
    return d;
  }, [karte, p.fach, p.zweit]);
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: `tk|${zeile}|${karte.key}`, data: daten, disabled: !p.ziehbar });
  const schmal = p.w < 30;
  return (
    <div ref={setNodeRef} {...(p.ziehbar ? listeners : {})} {...(p.ziehbar ? attributes : {})} tabIndex={-1} role="button"
      aria-roledescription="Stunde" aria-label={p.titel.replace(/\n/g, ', ')}
      className={`pt-chip${p.gekoppelt ? ' gekoppelt' : ''}${karte.fix ? ' fix' : ''}${p.gewaehlt ? ' gewaehlt' : ''}${p.verbunden ? ' verbunden' : ''}${isDragging ? ' zieht' : ''}${p.ziehbar ? ' ziehbar' : ''}${schmal ? ' schmal' : ''}`}
      style={{ left: p.x, top: p.y, width: p.w, height: p.h, ...(p.farbe ? { ['--fachfarbe' as string]: p.farbe } : {}) }}
      title={p.titel} data-u={karte.u} data-karte={karte.key} data-zeile={zeile}
      onClick={(ev) => p.klick(karte, zeile, ev)} onDoubleClick={() => p.doppelklick(zeile)} onContextMenu={(ev) => p.kontext(karte, zeile, ev)}>
      <span className="f">{p.fach}{p.woche && !schmal ? <span className="w">{p.woche}</span> : null}</span>
      {p.dichte === 'normal' && p.h >= 30 && p.w >= 34 ? <span className="z">{p.zweit}</span> : null}
    </div>
  );
});

// ---------------------------------------------------------------------------------------------
// Zielmarke am Mauszeiger bzw. am Tastatur-Cursor (eigene Komponente: zeichnet bei jeder Mausbewegung nur sich neu)

function Zielmarke({ koerper, geo, zug, ziele, zeilenIdx, cursor, zeilen, tage }: {
  koerper: React.RefObject<HTMLDivElement>; geo: Geometrie; zug: TafelZug | null; ziele: Ziele | null; zeilenIdx: number[];
  cursor: { z: number; s: number } | null; zeilen: TafelZeile[]; tage: string[];
}) {
  const { aktiv, x, y, ueber } = useZiehen();
  if (!zug) return null;
  let s: number | null = null;
  let maus = false;
  if (aktiv && zugAus(aktiv)) {
    if (ueber !== 'pt-brett' || !koerper.current) return null;
    const r = koerper.current.getBoundingClientRect();
    const rx = x - r.left - LABEL;
    if (rx < 0) return null;
    s = Math.min(geo.S * geo.T - 1, Math.floor(rx / geo.spalte));
    maus = true;
  } else if (cursor) s = cursor.s;
  if (s == null) return null;
  const tag = Math.floor(s / geo.S), stunde = (s % geo.S) + 1;
  const stufe = ziele?.stufen[tag]?.[stunde - 1] ?? null;
  const grund = ziele?.gruende[tag]?.[stunde - 1] || '';
  const start = zug.art === 'karte' ? s - (ziele?.versatz ?? ((zug.stunde ?? 0) - (zug.karte?.von ?? 0))) : s;
  const n = ziele?.laenge ?? zug.laenge;
  const reihen = zeilenIdx.length ? zeilenIdx : cursor ? [cursor.z] : [];
  const tagName = `${tage[tag] ?? ''} ${stunde}. Stunde`;
  const text = stufe ? `${tagName}: ${grund || STUFENTEXT[stufe]}` : `${tagName}: wird geprüft …`;
  return (
    <>
      {reihen.map((zi) => (
        <div key={zi} className={`pt-marke${stufe ? ` ${stufe}` : ''}`}
          style={{ left: LABEL + Math.max(0, start) * geo.spalte, top: geo.oben[zi]!, width: n * geo.spalte, height: geo.hoehe[zi]! }} />
      ))}
      {maus ? <div className="pt-grund" style={{ left: Math.min(x + 14, window.innerWidth - 330), top: y + 18 }} data-testid="pt-grund">{text}</div> : null}
      {!maus && cursor ? <span className="pt-unsichtbar" aria-live="polite">{`${zeilen[cursor.z]?.kurz ?? ''}, ${text}`}</span> : null}
    </>
  );
}

// ---------------------------------------------------------------------------------------------

export const Steckbrett = forwardRef<SteckbrettApi, Props>(function Steckbrett(props, ref) {
  const { daten, auf, typ, zeilen, dichte, auswahl, tastZug } = props;
  const rollen = useRef<HTMLDivElement>(null);
  const koerper = useRef<HTMLDivElement>(null);
  const [breiteAussen, setBreiteAussen] = useState(1000);
  const [fenster, setFenster] = useState({ oben: 0, hoehe: 800 });
  const [mausZug, setMausZug] = useState<TafelZug | null>(null);
  const [ziele, setZiele] = useState<Ziele | null>(null);
  const [cursor, setCursor] = useState<{ z: number; s: number } | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  // ---- Geometrie ----
  useLayoutEffect(() => {
    const el = rollen.current;
    if (!el) return;
    const messen = () => { setBreiteAussen(el.clientWidth); setFenster({ oben: el.scrollTop, hoehe: el.clientHeight }); };
    messen();
    const ro = new ResizeObserver(messen);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const geo = useMemo<Geometrie>(() => {
    const S = daten.zeitraster.stunden.length, T = daten.zeitraster.tage.length;
    const spalte = Math.max(MIN_SPALTE, (breiteAussen - LABEL - 1) / Math.max(1, S * T));
    const spur = dichte === 'normal' ? 34 : 22;
    const oben: number[] = [], hoehe: number[] = [];
    let y = 0;
    for (const z of zeilen) {
      const h = (auf.spuren.get(z.id) ?? 1) * spur + 4;
      oben.push(y); hoehe.push(h); y += h;
    }
    return { spalte, breite: LABEL + spalte * S * T, S, T, spur, oben, hoehe, gesamt: y };
  }, [daten.zeitraster, breiteAussen, dichte, zeilen, auf.spuren]);

  const sichtbar = useMemo(() => {
    const { oben, hoehe } = fenster;
    const von = Math.max(0, oben - KOPF - 200), bis = oben + hoehe + 200;
    let a = 0, b = geo.oben.length;
    while (a < b) { const m = (a + b) >> 1; if (geo.oben[m]! + geo.hoehe[m]! < von) a = m + 1; else b = m; }
    const erg: number[] = [];
    for (let i = a; i < geo.oben.length && geo.oben[i]! <= bis; i++) erg.push(i);
    return erg;
  }, [fenster, geo]);

  const zeileIndex = useMemo(() => new Map(zeilen.map((z, i) => [z.id, i])), [zeilen]);

  const zuZeile = useCallback((i: number) => {
    const el = rollen.current;
    if (!el || i < 0 || i >= geo.oben.length) return;
    const y = geo.oben[i]!, h = geo.hoehe[i]!;
    if (y < el.scrollTop) el.scrollTop = y;
    else if (y + h > el.scrollTop + el.clientHeight - KOPF) el.scrollTop = y + h - el.clientHeight + KOPF + 8;
  }, [geo]);
  const zuSpalte = useCallback((s: number) => {
    const el = rollen.current;
    if (!el) return;
    const x = LABEL + s * geo.spalte;
    if (x - LABEL < el.scrollLeft) el.scrollLeft = x - LABEL;
    else if (x + geo.spalte > el.scrollLeft + el.clientWidth) el.scrollLeft = x + geo.spalte - el.clientWidth + 4;
  }, [geo]);

  useImperativeHandle(ref, () => ({
    zuZeile: (id) => { const i = zeileIndex.get(id); if (i !== undefined) { zuZeile(i); setCursor((c) => ({ z: i, s: c?.s ?? 0 })); } },
    fokus: () => rollen.current?.focus({ preventScroll: true }),
  }), [zeileIndex, zuZeile]);

  // ---- Zug: Mausziehen (dnd-kit) bzw. Tastatur ----
  const zug = mausZug ?? tastZug;
  const ladeNr = useRef(0);
  const zieleHolen = useCallback((z: TafelZug | null) => {
    const n = ++ladeNr.current;
    setZiele(null);
    if (!z) return;
    const angabe = z.art === 'karte' ? { u: z.u, tag: z.tag, stunde: z.stunde, einzeln: z.einzeln } : { u: z.u, laenge: z.laenge };
    zieleLaden(angabe, propsRef.current.version).then((x) => { if (n === ladeNr.current) setZiele(x); }).catch(() => {});
  }, []);
  useDndMonitor({
    onDragStart: (ev) => {
      const z = zugAus(ev.active.data.current as ZiehDaten | undefined);
      if (!z) return;
      setMausZug({ ...z });
      zieleHolen(z);
      propsRef.current.beiAuswahl({ u: z.u, karte: z.karte?.key });
    },
    onDragEnd: () => { setMausZug(null); if (!propsRef.current.tastZug) zieleHolen(null); },
    onDragCancel: () => { setMausZug(null); if (!propsRef.current.tastZug) zieleHolen(null); },
  });
  useEffect(() => { if (!mausZug) zieleHolen(tastZug); }, [tastZug]); // eslint-disable-line react-hooks/exhaustive-deps
  // Tastaturzug aus dem Vorrat: Cursor in die erste Zeile des Unterrichts setzen
  useEffect(() => {
    if (!tastZug) return;
    rollen.current?.focus({ preventScroll: true });
    if (tastZug.art === 'vorrat') {
      const zi = auf.zeilenVon(tastZug.u).map((id) => zeileIndex.get(id)).find((x) => x !== undefined);
      setCursor((c) => ({ z: zi ?? c?.z ?? 0, s: c?.s ?? 0 }));
      if (zi !== undefined) zuZeile(zi);
    }
  }, [tastZug]); // eslint-disable-line react-hooks/exhaustive-deps

  const zugZeilen = useMemo(() => (zug ? auf.zeilenVon(zug.u).map((id) => zeileIndex.get(id)).filter((x): x is number => x !== undefined) : []), [zug, auf, zeileIndex]);
  const auswahlZeilen = useMemo(() => new Set(auswahl ? auf.zeilenVon(auswahl.u) : []), [auswahl, auf]);

  // ---- Ablage: das ganze Brett ----
  const zielAus = (x: number): { tag: number; stunde: number } | null => {
    const el = koerper.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const rx = x - r.left - LABEL;
    if (rx < 0 || rx > geo.spalte * geo.S * geo.T) return null;
    const s = Math.min(geo.S * geo.T - 1, Math.floor(rx / geo.spalte));
    return { tag: Math.floor(s / geo.S), stunde: (s % geo.S) + 1 };
  };
  const ablegen = (z: TafelZug, tag: number, stunde: number) => {
    const st = ziele && ziele.u === z.u ? ziele.stufen[tag]?.[stunde - 1] ?? null : null;
    if (st === 'eigen') return;
    propsRef.current.beiAblegen({ zug: z, zielTag: tag, zielStunde: stunde, stufe: st });
  };
  const ablage: AblageDaten = {
    annehmen: (d) => !!zugAus(d) && propsRef.current.schreiben,
    ablegen: (d) => {
      const z = zugAus(d);
      const ort = zielAus(useZiehen.getState().x);
      if (z && ort) ablegen(z, ort.tag, ort.stunde);
    },
  };
  const { setNodeRef: ablageRef } = useDroppable({ id: 'pt-brett', data: ablage, disabled: !props.schreiben });
  const koerperRef = useCallback((el: HTMLDivElement | null) => { (koerper as React.MutableRefObject<HTMLDivElement | null>).current = el; ablageRef(el); }, [ablageRef]);

  // ---- Bedienung ----
  const klick = useCallback((k: Karte, zeile: number, ev: MouseEvent) => {
    ev.stopPropagation();
    const i = zeileIndex.get(zeile);
    if (i !== undefined) setCursor({ z: i, s: slot(k.tag, k.von, geo.S) });
    propsRef.current.beiAuswahl({ u: k.u, karte: k.key, zeile });
    rollen.current?.focus({ preventScroll: true });
  }, [zeileIndex, geo.S]);
  const doppelklick = useCallback((zeile: number) => propsRef.current.beiZeileOeffnen(zeile), []);
  const kontext = useCallback((k: Karte, zeile: number, ev: MouseEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    propsRef.current.beiAuswahl({ u: k.u, karte: k.key, zeile });
    const { clientX, clientY } = ev;
    setTimeout(() => propsRef.current.beiKontext(k, zeile, clientX, clientY));
  }, []);

  const karteAm = (zi: number, s: number): Karte | null => {
    const z = zeilen[zi];
    if (!z) return null;
    for (const b of auf.jeZeile.get(z.id) || []) {
      const a = slot(b.karte.tag, b.karte.von, geo.S);
      if (s >= a && s < a + b.karte.laenge) return b.karte;
    }
    return null;
  };

  const taste = (ev: KeyboardEvent<HTMLDivElement>) => {
    const p = propsRef.current;
    const max = geo.S * geo.T - 1;
    const c = cursor ?? { z: 0, s: 0 };
    let n: { z: number; s: number } | null = null;
    switch (ev.key) {
      case 'ArrowLeft': n = { z: c.z, s: Math.max(0, c.s - 1) }; break;
      case 'ArrowRight': n = { z: c.z, s: Math.min(max, c.s + 1) }; break;
      case 'ArrowUp': n = { z: Math.max(0, c.z - 1), s: c.s }; break;
      case 'ArrowDown': n = { z: Math.min(zeilen.length - 1, c.z + 1), s: c.s }; break;
      case 'PageUp': n = { z: Math.max(0, c.z - 10), s: c.s }; break;
      case 'PageDown': n = { z: Math.min(zeilen.length - 1, c.z + 10), s: c.s }; break;
      case 'Home': n = { z: ev.ctrlKey ? 0 : c.z, s: 0 }; break;
      case 'End': n = { z: ev.ctrlKey ? zeilen.length - 1 : c.z, s: max }; break;
      case 'Escape':
        if (p.tastZug) { p.setTastZug(null); ev.preventDefault(); ev.stopPropagation(); return; }
        if (p.auswahl) { p.beiAuswahl(null); ev.preventDefault(); return; }
        return;
      case 'Enter': case ' ': {
        ev.preventDefault();
        if (!cursor) { setCursor(c); return; }
        if (p.tastZug) {
          const z = p.tastZug;
          p.setTastZug(null);
          ablegen(z, Math.floor(c.s / geo.S), (c.s % geo.S) + 1);
          return;
        }
        const k = karteAm(c.z, c.s);
        if (!k) return;
        p.beiAuswahl({ u: k.u, karte: k.key, zeile: zeilen[c.z]?.id });
        if (p.schreiben && !k.fix) {
          const gegriffen = (c.s % geo.S) + 1;
          p.setTastZug({ art: 'karte', u: k.u, laenge: k.laenge, tag: k.tag, stunde: gegriffen, einzeln: ev.shiftKey && k.laenge > 1, karte: k });
        }
        return;
      }
      case 'Delete': {
        const k = karteAm(c.z, c.s);
        if (k && p.schreiben) { ev.preventDefault(); p.beiEntplanen(k, ev.shiftKey ? (c.s % geo.S) + 1 : undefined); }
        return;
      }
      case 'f': case 'F': {
        const k = karteAm(c.z, c.s);
        if (k && p.schreiben && !ev.ctrlKey && !ev.metaKey) { ev.preventDefault(); p.beiFixieren(k); }
        return;
      }
      case 'ContextMenu': case 'F10': {
        if (ev.key === 'F10' && !ev.shiftKey) return;
        const k = karteAm(c.z, c.s);
        const el = koerper.current;
        if (k && el) {
          ev.preventDefault();
          const r = el.getBoundingClientRect();
          p.beiKontext(k, zeilen[c.z]!.id, r.left + LABEL + (c.s + 1) * geo.spalte, r.top + geo.oben[c.z]! + geo.hoehe[c.z]!);
        }
        return;
      }
      default: return;
    }
    ev.preventDefault();
    setCursor(n);
    zuZeile(n.z);
    zuSpalte(n.s);
    if (!p.tastZug) {
      const k = karteAm(n.z, n.s);
      if (k) p.beiAuswahl({ u: k.u, karte: k.key, zeile: zeilen[n.z]?.id });
    }
  };

  // ---- Zeichnen ----
  const { zeitraster } = daten;
  const S = geo.S;
  const kopfStufe = (t: number, s: number) => (zug && ziele && ziele.u === zug.u ? ziele.stufen[t]?.[s - 1] : null);
  const tagKurz = useMemo(() => zeitraster.tage.map((t) => t.kurz), [zeitraster]);
  const gesperrt = useMemo(() => {
    const l: { s: number; art: string }[] = [];
    zeitraster.tage.forEach((_, t) => zeitraster.stunden.forEach((st, j) => {
      const art = zeitraster.belegung?.[t]?.[j] ?? 'V';
      if (art !== 'V') l.push({ s: slot(t, st.nr, S), art });
    }));
    return l;
  }, [zeitraster, S]);

  return (
    <div ref={rollen} className={`pt-brett${zug ? ' zieht' : ''}`} tabIndex={0} role="application" data-testid="steckbrett"
      aria-label={`Steckbrett: ${zeilen.length} Zeilen, ${zeitraster.tage.length} Tage mit je ${S} Stunden`}
      aria-describedby="pt-hilfe" onKeyDown={taste}
      onScroll={(e) => { const el = e.currentTarget; setFenster({ oben: el.scrollTop, hoehe: el.clientHeight }); }}
      onFocus={() => { if (!cursor && zeilen.length) setCursor({ z: 0, s: 0 }); }}
      style={{ ['--pt-spalte' as string]: `${geo.spalte}px`, ['--pt-tag' as string]: `${geo.spalte * S}px`, ['--pt-label' as string]: `${LABEL}px` }}>
      <span id="pt-hilfe" className="pt-unsichtbar">Pfeiltasten bewegen den Cursor. Enter nimmt die Stunde auf und legt sie ab, Escape bricht ab. Entf entplant, F fixiert, Umschalt+F10 öffnet das Menü.</span>
      <div className="pt-kopf" style={{ width: geo.breite }}>
        <div className="pt-ecke" style={{ width: LABEL }}>{typ === 'klasse' ? 'Klasse' : typ === 'lehrer' ? 'Lehrkraft' : 'Raum'}</div>
        {zeitraster.tage.map((t, i) => (
          <div key={t.nr} className="pt-tag" style={{ left: LABEL + i * S * geo.spalte, width: S * geo.spalte }} title={t.lang}>{geo.spalte * S > 140 ? t.lang : t.kurz}</div>
        ))}
        {zeitraster.tage.map((t, i) => zeitraster.stunden.map((st) => {
          const stufe = kopfStufe(i, st.nr);
          return (
            <div key={`${t.nr}:${st.nr}`} className={`pt-std${st.nr === 1 ? ' tagbeginn' : ''}${stufe ? ` ${stufe}` : ''}`} data-tag={i} data-stunde={st.nr}
              style={{ left: LABEL + slot(i, st.nr, S) * geo.spalte, width: geo.spalte }} title={`${t.lang}, ${st.label}. Stunde${st.beginn ? ` (${st.beginn}–${st.ende})` : ''}`}>{st.label}</div>
          );
        }))}
      </div>
      <div ref={koerperRef} className="pt-koerper" style={{ height: geo.gesamt, width: geo.breite }}>
        {gesperrt.map((g) => <div key={g.s} className={`pt-frei ${g.art === 'N' ? 'nachmittag' : 'gesperrt'}`} style={{ left: LABEL + g.s * geo.spalte, width: geo.spalte, height: geo.gesamt }} />)}
        {sichtbar.map((i) => {
          const z = zeilen[i]!;
          const belegt = auf.jeZeile.get(z.id) || [];
          const neueGruppe = i > 0 && zeilen[i - 1]!.gruppe !== z.gruppe;
          const offen = props.offenJeZeile.get(z.id) || 0;
          const imZug = zugZeilen.includes(i);
          return (
            <div key={z.id} className={`pt-zeile${neueGruppe ? ' gruppe' : ''}${auswahlZeilen.has(z.id) ? ' beteiligt' : ''}${props.zeileGewaehlt === z.id ? ' gewaehlt' : ''}${imZug ? ' imzug' : ''}`}
              style={{ top: geo.oben[i], height: geo.hoehe[i], width: geo.breite }} data-zeile={z.id}
              onClick={(ev) => {
                const el = koerper.current;
                if (!el) return;
                const rx = ev.clientX - el.getBoundingClientRect().left - LABEL;
                if (rx >= 0) setCursor({ z: i, s: Math.min(S * geo.T - 1, Math.floor(rx / geo.spalte)) });
                propsRef.current.beiAuswahl(null);
              }}>
              <button type="button" className="pt-label" style={{ width: LABEL }} title={`${z.lang || z.kurz}${offen ? ` – ${offen} Stunden offen` : ''}\nKlick: Zeile wählen, Doppelklick: Plan öffnen`}
                onClick={(ev) => { ev.stopPropagation(); propsRef.current.beiZeile(props.zeileGewaehlt === z.id ? null : z.id); }}
                onDoubleClick={(ev) => { ev.stopPropagation(); propsRef.current.beiZeileOeffnen(z.id); }}>
                <span className="k">{z.kurz}</span>{offen ? <span className="o" aria-label={`${offen} offen`}>{offen}</span> : null}
              </button>
              {belegt.map(({ karte, spur }) => {
                const u = auf.uMap.get(karte.u);
                if (!u) return null;
                const t = kartenText(u, typ, z.id, daten, karte);
                const gewaehlt = !!auswahl && auswahl.karte === karte.key && (auswahl.zeile === undefined || auswahl.zeile === z.id);
                return (
                  <Chip key={karte.key} karte={karte} zeile={z.id} dichte={dichte} spalte={geo.spalte}
                    x={LABEL + slot(karte.tag, karte.von, S) * geo.spalte + 1} w={karte.laenge * geo.spalte - 2}
                    y={2 + spur * geo.spur + 1} h={geo.spur - 2}
                    fach={t.fach} zweit={t.zweit} farbe={props.farben ? t.farbe : null} gekoppelt={t.gekoppelt} titel={t.titel} woche={u.woche}
                    gewaehlt={gewaehlt} verbunden={!!auswahl && auswahl.u === karte.u && !gewaehlt}
                    ziehbar={props.schreiben && !karte.fix} klick={klick} doppelklick={doppelklick} kontext={kontext} />
                );
              })}
            </div>
          );
        })}
        {zug && ziele && ziele.u === zug.u ? zugZeilen.filter((i) => sichtbar.includes(i)).map((i) => (
          <div key={`z${i}`} className="pt-zielzeile" style={{ top: geo.oben[i], height: geo.hoehe[i], left: LABEL, width: geo.breite - LABEL }}>
            {ziele.stufen.map((tagS, t) => tagS.map((st, j) => (
              <div key={`${t}:${j}`} className={`pt-ziel ${st}`} style={{ left: slot(t, j + 1, S) * geo.spalte, width: geo.spalte }} title={ziele.gruende[t]?.[j] || STUFENTEXT[st]} />
            )))}
          </div>
        )) : null}
        {cursor && !useZiehen.getState().aktiv && cursor.z < zeilen.length ? (
          <div className={`pt-cursor${tastZug ? ' zug' : ''}`} style={{ left: LABEL + cursor.s * geo.spalte, top: geo.oben[cursor.z], width: geo.spalte, height: geo.hoehe[cursor.z] }} />
        ) : null}
        <Zielmarke koerper={koerper} geo={geo} zug={zug} ziele={ziele && zug && ziele.u === zug.u ? ziele : null} zeilenIdx={zugZeilen} cursor={tastZug ? cursor : null} zeilen={zeilen} tage={tagKurz} />
      </div>
    </div>
  );
});
