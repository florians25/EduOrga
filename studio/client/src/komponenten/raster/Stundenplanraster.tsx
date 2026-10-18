// Stundenplan-Raster der Planung: Woche (Tage × Stunden), gleiche Folgestunden als Block (Doppel-/Blockstunden), Kopplungen
// nebeneinander, gesperrte Zeiten schraffiert. Drag & Drop (dnd-kit): Stunden verschieben bzw. nicht verplante Stunden setzen;
// Zielfelder nach dem Zielstatus des Servers (grün frei, rot Vorgabe verletzt, violett kein Raum, Rahmen = Tausch), Gründe am
// Mauszeiger. Mehrfachauswahl: Strg/Umschalt+Klick. Ein Block wird an der Stelle gegriffen, an der man ihn anfasst
// (Umschalt beim Ziehen = nur diese eine Stunde des Blocks).
import { useDndMonitor, useDraggable, type DragStartEvent } from '@dnd-kit/core';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { Zeitraster } from '@/api/typen';
import type { ZiehDaten } from '../ziehen';
import { Raster, type RasterBlock } from './Raster';

export interface PlanEintrag {
  u: number; zeile: number; fach: string; klassen: string; lehrer: string; raum: string; farbe?: string | null; fix?: boolean; gekoppelt?: boolean;
  woche?: string | null; text?: string | null; [k: string]: unknown;
}
export interface PlanZelle { tag: number; stunde: number; eintraege: PlanEintrag[] }
export interface NichtVerplant { u: number; text: string; anzahl: number; bloecke?: number[] }
export interface Stundenplan {
  element: { typ: string; id: number; kurz: string; lang: string };
  zeitraster: Zeitraster;
  zellen: PlanZelle[];
  nichtVerplant: NichtVerplant[];
  periode: string;
}

/** Gezogene Stunde ({ tag, stunde } gesetzt) bzw. nicht verplanter Block (nur laenge). */
export interface StundeZiehen { u: number; tag?: number; stunde?: number; einzeln?: boolean; laenge?: number }
export interface Markierung { u: number; tag: number; stunde: number; e: PlanEintrag }
export interface Auswahl { u: number; tag: number; stunde: number; laenge: number; stunden: number[]; e: PlanEintrag }
export interface Zielantwort { status: (string | null)[][]; gruende?: (string | null)[][] }

export interface StundenplanrasterApi {
  auswahl: () => Auswahl | null;
  markierte: () => Markierung[];
  anzahlMarkiert: () => number;
  alleMarkieren: (filter?: (e: PlanEintrag) => boolean) => void;
  stundenMarkieren: (liste: { u: number; tag: number; stunde: number }[]) => void;
  markierungAufheben: () => void;
  fokus: () => void;
}

interface Props {
  id: string;
  plan: Stundenplan | null;
  typ: string;
  kompakt?: boolean;
  ziehen?: boolean;
  mehrfach?: boolean;
  zielstatus?: (d: StundeZiehen) => Promise<Zielantwort | (string | null)[][] | null>;
  beiAblegen?: (d: StundeZiehen & { zielTag: number; zielStunde: number }) => void;
  beiKlick?: (e: PlanEintrag, tag: number, stunde: number) => void;
  beiDoppelklick?: (e: PlanEintrag, tag: number, stunde: number) => void;
  kontextmenue?: (e: PlanEintrag, tag: number, stunde: number, ev: MouseEvent) => void;
  feldKontextmenue?: (tag: number, stunde: number, ev: MouseEvent) => void;
  beiMarkierung?: (m: Markierung[]) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
  feldKlasse?: (tag: number, stunde: number) => string | null | undefined;
}

const sk = (u: number, tag: number, stunde: number) => `${u}:${tag}:${stunde}`;

interface EintragProps {
  rasterId: string; e: PlanEintrag; tag: number; stunden: number[]; typ: string; kompakt?: boolean; ziehbar: boolean;
  gewaehlt: boolean; markiert: boolean;
  klick: (ev: MouseEvent) => void; doppelklick: () => void; kontext: (ev: MouseEvent) => void;
}

function Eintrag({ rasterId, e, tag, stunden, typ, kompakt, ziehbar, gewaehlt, markiert, klick, doppelklick, kontext }: EintragProps) {
  const zeilen = typ === 'lehrer' ? [e.klassen, e.raum] : typ === 'raum' || typ === 'fach' ? [e.klassen, e.lehrer] : [e.lehrer, e.raum];
  const daten: ZiehDaten = {
    art: 'stunde', raster: rasterId, u: e.u, tag, stunde: stunden[0], laenge: stunden.length, einzeln: false,
    vorschau: () => <div className="ra-vorschau"><b>{e.fach}</b> {e.klassen} · {e.lehrer}</div>,
    beimStart: (ev: DragStartEvent) => {
      const r = ev.active.rect.current.initial;
      const p = ev.activatorEvent as PointerEvent;
      const idx = r ? Math.max(0, Math.min(stunden.length - 1, Math.floor((p.clientY - r.top) / (r.height / stunden.length)))) : 0;
      daten.stunde = stunden[idx];
      daten.einzeln = !!p.shiftKey && stunden.length > 1;
    },
  };
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: `${rasterId}|${e.u}|${e.zeile}|${tag}|${stunden[0]}`, data: daten, disabled: !ziehbar });
  const titel = `U-Nr. ${e.u}${e.gekoppelt ? ' (gekoppelt)' : ''}${e.woche ? ` · Woche ${e.woche}` : ''}\n${e.fach} – ${e.klassen} – ${e.lehrer}${e.raum ? ` – ${e.raum}` : ''}${e.text ? `\n${e.text}` : ''}${e.fix ? '\nfixiert' : ''}`;
  return (
    <div ref={setNodeRef} {...(ziehbar ? listeners : {})} {...(ziehbar ? attributes : {})} role="button" tabIndex={-1}
      className={`ra-eintrag${ziehbar ? ' ziehbar' : ''}${e.gekoppelt ? ' gekoppelt' : ''}${gewaehlt ? ' gewaehlt' : ''}${markiert ? ' markiert' : ''}${isDragging ? ' zieht' : ''}`}
      style={e.farbe ? { ['--fachfarbe' as string]: e.farbe } : undefined} title={titel} data-u={e.u}
      onClick={klick} onDoubleClick={doppelklick} onContextMenu={kontext}>
      <span className="kopfzeile">
        <span className="fach">{e.fach || '—'}</span>
        {e.woche ? <span className="woche" title={`Woche ${e.woche}`}>{e.woche}</span> : null}
        {kompakt ? null : <span className="zeile3">{zeilen[1] || ''}</span>}
      </span>
      <span className="zeile2">{zeilen[0] || ''}</span>
      {e.fix ? <span className="fix" title="fixiert" /> : null}
    </div>
  );
}

export const Stundenplanraster = forwardRef<StundenplanrasterApi, Props>(function Stundenplanraster(props, ref) {
  const { id, plan, typ, kompakt, ziehen = false } = props;
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [markiert, setMarkiert] = useState<Map<string, Markierung>>(() => new Map());
  const [ziele, setZiele] = useState<{ status: (string | null)[][]; gruende: (string | null)[][] | null } | null>(null);
  const element = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  // Einträge je Feld, gleiche Folgestunden zu Blöcken zusammengefasst
  const bloecke = useMemo(() => {
    const erg: { tag: number; von: number; stunden: number[]; eintraege: PlanEintrag[] }[] = [];
    if (!plan) return erg;
    const { tage, stunden } = plan.zeitraster;
    const zellen = new Map(plan.zellen.map((z) => [`${z.tag}:${z.stunde}`, z.eintraege]));
    const schluessel = (l?: PlanEintrag[]) => (l || []).map((e) => `${e.u}.${e.zeile}`).sort().join('|');
    tage.forEach((t, i) => {
      let j = 0;
      while (j < stunden.length) {
        const eintraege = zellen.get(`${t.nr}:${stunden[j]!.nr}`);
        if (!eintraege?.length) { j++; continue; }
        const k = schluessel(eintraege);
        let n = 1;
        while (j + n < stunden.length && schluessel(zellen.get(`${t.nr}:${stunden[j + n]!.nr}`)) === k) n++;
        erg.push({ tag: i, von: j, stunden: stunden.slice(j, j + n).map((s) => s.nr), eintraege });
        j += n;
      }
    });
    return erg;
  }, [plan]);

  const tagNr = (i: number) => plan?.zeitraster.tage[i]?.nr ?? i;
  const markierteListe = (m = markiert): Markierung[] => [...m.values()];
  const meldenMarkierung = (m: Map<string, Markierung>) => propsRef.current.beiMarkierung?.(markierteListe(m));

  const blockMarkieren = (m: Map<string, Markierung>, e: PlanEintrag, tag: number, stunden: number[], an: boolean) => {
    for (const s of stunden) { const k = sk(e.u, tag, s); if (an) m.set(k, { u: e.u, tag, stunde: s, e }); else m.delete(k); }
  };

  const auswahlVon = (key: string | null): Auswahl | null => {
    if (!key) return null;
    const [u, t, s] = key.split(':').map(Number) as [number, number, number];
    for (const b of bloecke) {
      if (tagNr(b.tag) !== t || !b.stunden.includes(s)) continue;
      const e = b.eintraege.find((x) => x.u === u);
      if (e) return { u, tag: t, stunde: s, laenge: b.stunden.length, stunden: b.stunden, e };
    }
    return null;
  };

  useImperativeHandle(ref, () => ({
    auswahl: () => auswahlVon(gewaehlt),
    markierte: () => {
      if (markiert.size) return markierteListe();
      const a = auswahlVon(gewaehlt);
      return a ? a.stunden.map((s) => ({ u: a.u, tag: a.tag, stunde: s, e: a.e })) : [];
    },
    anzahlMarkiert: () => markiert.size,
    alleMarkieren: (filter) => {
      const m = new Map<string, Markierung>();
      for (const b of bloecke) for (const e of b.eintraege) if (!filter || filter(e)) blockMarkieren(m, e, tagNr(b.tag), b.stunden, true);
      setMarkiert(m);
      meldenMarkierung(m);
    },
    stundenMarkieren: (liste) => {
      const m = new Map<string, Markierung>();
      const ziel = new Set(liste.map((x) => sk(x.u, x.tag, x.stunde)));
      for (const b of bloecke) for (const e of b.eintraege) {
        const t = tagNr(b.tag);
        if (b.stunden.some((s) => ziel.has(sk(e.u, t, s)))) blockMarkieren(m, e, t, b.stunden.filter((s) => ziel.has(sk(e.u, t, s))), true);
      }
      setMarkiert(m);
      meldenMarkierung(m);
    },
    markierungAufheben: () => { const m = new Map(); setMarkiert(m); meldenMarkierung(m); },
    fokus: () => element.current?.focus({ preventScroll: true }),
  }), [gewaehlt, markiert, bloecke]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Ziehen: Zielstatus für Ziehvorgänge aus diesem Raster bzw. für diesen Raster bestimmte nicht verplante Stunden ----
  const ladeNr = useRef(0);
  useDndMonitor({
    onDragStart: (ev) => {
      const d = ev.active.data.current as ZiehDaten | undefined;
      if (!d || d.raster !== id || (d.art !== 'stunde' && d.art !== 'unterricht') || !propsRef.current.zielstatus) return;
      const n = ++ladeNr.current;
      const zd: StundeZiehen = d.art === 'stunde' ? { u: d.u as number, tag: d.tag as number, stunde: d.stunde as number, einzeln: !!d.einzeln, laenge: d.laenge as number } : { u: d.u as number, laenge: (d.laenge as number) || 1 };
      void Promise.resolve(propsRef.current.zielstatus(zd)).then((a) => {
        if (n !== ladeNr.current || !a) return;
        if (Array.isArray(a)) setZiele({ status: a, gruende: null });
        else setZiele({ status: a.status, gruende: a.gruende || null });
      }).catch(() => {});
    },
    onDragEnd: () => { ladeNr.current++; setZiele(null); },
    onDragCancel: () => { ladeNr.current++; setZiele(null); },
  });

  const ablage = useCallback((tag: number, stunde: number) => {
    if (!ziehen) return null;
    return {
      annehmen: (d: ZiehDaten) => d.art === 'stunde' || d.art === 'unterricht',
      ablegen: (d: ZiehDaten) => {
        const zd: StundeZiehen = d.art === 'stunde' ? { u: d.u as number, tag: d.tag as number, stunde: d.stunde as number, einzeln: !!d.einzeln, laenge: d.laenge as number } : { u: d.u as number, laenge: (d.laenge as number) || 1 };
        propsRef.current.beiAblegen?.({ ...zd, zielTag: plan?.zeitraster.tage[tag]?.nr ?? tag, zielStunde: stunde });
      },
    };
  }, [ziehen, plan]);

  if (!plan) return <div className="ra" />;
  const { tage, stunden, belegung } = plan.zeitraster;

  const rasterBloecke: RasterBlock[] = bloecke.map((b) => {
    const t = tagNr(b.tag);
    return {
      key: `${b.tag}:${b.von}:${b.eintraege.map((e) => `${e.u}.${e.zeile}`).join(',')}`, tag: b.tag, von: b.von, laenge: b.stunden.length,
      inhalt: b.eintraege.map((e) => {
        const keys = b.stunden.map((s) => sk(e.u, t, s));
        const istGewaehlt = !!gewaehlt && keys.includes(gewaehlt);
        const istMarkiert = keys.some((k) => markiert.has(k));
        return (
          <Eintrag key={`${e.u}.${e.zeile}`} rasterId={id} e={e} tag={t} stunden={b.stunden} typ={typ} kompakt={kompakt} ziehbar={ziehen && !e.fix}
            gewaehlt={istGewaehlt} markiert={istMarkiert}
            klick={(ev) => {
              ev.stopPropagation();
              if (props.mehrfach && (ev.ctrlKey || ev.metaKey || ev.shiftKey)) {
                const m = new Map(markiert);
                const a = auswahlVon(gewaehlt);
                if (a && !m.size) blockMarkieren(m, a.e, a.tag, a.stunden, true);
                blockMarkieren(m, e, t, b.stunden, !istMarkiert);
                setMarkiert(m);
                meldenMarkierung(m);
                return;
              }
              if (markiert.size) { const m = new Map(); setMarkiert(m); meldenMarkierung(m); }
              setGewaehlt(keys[0]!);
              element.current?.focus({ preventScroll: true });
              props.beiKlick?.(e, t, b.stunden[0]!);
            }}
            doppelklick={() => props.beiDoppelklick?.(e, t, b.stunden[0]!)}
            kontext={(ev) => {
              if (!props.kontextmenue) return;
              ev.preventDefault();
              ev.stopPropagation();
              if (!istMarkiert) {
                if (markiert.size) { const m = new Map(); setMarkiert(m); meldenMarkierung(m); }
                setGewaehlt(keys[0]!);
              }
              // Auswahl gilt sofort (der Menüaufruf liest sie)
              setTimeout(() => props.kontextmenue!(e, t, b.stunden[0]!, ev));
            }} />
        );
      }),
    };
  });

  return (
    <Raster ref={element} id={id} kompakt={kompakt} stunden={stunden} belegung={belegung} bloecke={rasterBloecke}
      tage={tage.map((t) => ({ kopf: <><span className="kurz">{t.kurz}</span><span className="lang">{t.lang || t.kurz}</span></>, titel: t.lang }))}
      ziele={ziele?.status} gruende={ziele?.gruende} ablage={ziehen ? ablage : undefined} onKeyDown={props.onKeyDown} feldKlasse={props.feldKlasse ? (i, st) => props.feldKlasse!(tagNr(i), st) : undefined}
      feldKontextmenue={props.feldKontextmenue ? (i, s, e) => props.feldKontextmenue!(tagNr(i), s, e) : undefined}
      feldKlick={() => { if (markiert.size) { const m = new Map(); setMarkiert(m); meldenMarkierung(m); } }} />
  );
});
