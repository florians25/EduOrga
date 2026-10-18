// Gesamtübersichten: alle Klassen, Lehrkräfte bzw. Räume als Zeilen, Tage × Stunden als Spalten. Schnell auch bei großen
// Schulen: kompakte Server-Antwort, nur die sichtbaren Zeilen werden gezeichnet (virtualisiert).
// Drag & Drop (dnd-kit): Stunde innerhalb der Zeile verschieben/tauschen; im Raum-Übersichtsplan in eine andere Raumzeile =
// Raumverlegung. Server: Api/UebersichtApi.cs (/uebersicht/{typ}), Druck: /druck/uebersicht (PDF).
import { useDndMonitor, useDraggable, useDroppable } from '@dnd-kit/core';
import { Input, Select } from '@fluentui/react-components';
import { useVirtualizer } from '@tanstack/react-virtual';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/api/client';
import { useAnsicht } from '@/kern/ansichten';
import { melden, useEreignis } from '@/kern/ereignisse';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, Feld, FussText, Trenner, Werkzeug } from '@/komponenten/ansicht';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { useZiehen, type AblageDaten, type ZiehDaten } from '@/komponenten/ziehen';
import { druckUrl, herunterladen } from '../druck/kern';
import './uebersicht.css';

const TITEL: Record<string, string> = { klasse: 'Klassen', lehrer: 'Lehrkräfte', raum: 'Räume', fach: 'Fächer' };
const ZH = 26;
const NAME = 72;

/** [tag, stunde, unterricht, text, titel, farbe, fixiert] */
type Zelle = [number, number, number, string, string, string | null, boolean];
interface UeDaten {
  elemente: { id: number; k: string; l?: string }[];
  zellen: Zelle[][];
  zeitraster: { tage: { kurz: string; lang: string }[]; stunden: { label: string }[] };
  periode: string;
}
interface Gezogen extends ZiehDaten { u: number; tag: number; stunde: number; i: number; ueQuelle: string }

function textfarbe(hex: string | null): string | undefined {
  if (!hex) return undefined;
  const n = parseInt(hex.slice(1), 16);
  const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l < 0.55 ? 'var(--up-text-invers)' : 'var(--up-schiefer-800)';
}

const ZellenEintrag = memo(function ZellenEintrag({ z, i, links, breite, ziehbar, quelle }: { z: Zelle; i: number; links: number; breite: number; ziehbar: boolean; quelle: string }) {
  const [tag, stunde, u, text, titel, farbe, fix] = z;
  const daten: Gezogen = { art: 'uebersicht.stunde', u, tag, stunde, i, ueQuelle: quelle, vorschau: () => <div className="ue-vorschau">{text}</div> };
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: `${quelle}|${i}|${u}|${tag}|${stunde}`, data: daten, disabled: !ziehbar });
  return (
    <div ref={setNodeRef} {...(ziehbar ? listeners : {})} {...(ziehbar ? attributes : {})} role={ziehbar ? 'button' : undefined}
      className={`ue-zelle${fix ? ' fix' : ''}${ziehbar ? ' ziehbar' : ''}${isDragging ? ' zieht' : ''}`} title={titel} data-i={i}
      style={{ left: links, width: breite, background: farbe || undefined, color: textfarbe(farbe) }}>{text}</div>
  );
});

export default function Uebersicht() {
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const typ = TITEL[String(a.p.typ)] ? String(a.p.typ) : 'klasse';
  const inhalt = String(a.p.inhalt || 'Standard');
  const [filter, setFilter] = useState('');
  const [aktivId, setAktivId] = useState<number | null>(null);
  const [breite, setBreite] = useState(0);
  const [scrollLinks, setScrollLinks] = useState(0);
  const koerper = useRef<HTMLDivElement>(null);
  const platz = useRef<HTMLDivElement | null>(null);
  const { daten, neuLaden, laedt } = useDaten(() => api.get<UeDaten>(api.dok(`/uebersicht/${typ}?inhalt=${inhalt}`)), [typ, inhalt],
    { bereiche: ['Stundenplan', 'Unterricht', 'Stammdaten'], quelle: a.id });
  useEreignis('grunddaten', () => void neuLaden(true));

  const sichtbar = useMemo(() => {
    if (!daten) return [];
    const t = filter.trim().toLowerCase();
    return daten.elemente.map((_, i) => i).filter((i) => !t || daten.elemente[i]!.k.toLowerCase().includes(t) || (daten.elemente[i]!.l || '').toLowerCase().includes(t));
  }, [daten, filter]);
  const n = daten?.zeitraster.stunden.length || 1;
  const spalten = (daten?.zeitraster.tage.length || 0) * n;
  const sb = Math.max(18, Math.floor((breite - NAME - 2) / Math.max(1, spalten)));
  const gesamt = NAME + sb * spalten;

  useLayoutEffect(() => {
    const el = koerper.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBreite(el.clientWidth));
    ro.observe(el);
    setBreite(el.clientWidth);
    return () => ro.disconnect();
  }, [daten]);

  const virt = useVirtualizer({ count: sichtbar.length, getScrollElement: () => koerper.current, estimateSize: () => ZH, overscan: 6 });

  // Auswahl anderer Ansichten folgen
  useEreignis('element', (e) => {
    if (e.quelle === a.id || e.typ !== typ || !daten) return;
    const r = sichtbar.findIndex((i) => daten.elemente[i]!.id === e.id);
    if (r < 0) return;
    setAktivId(e.id);
    virt.scrollToIndex(r, { align: 'auto' });
  });
  const waehlen = (i: number) => { const id = daten!.elemente[i]!.id; setAktivId(id); melden('element', { typ, id, quelle: a.id }); };
  const planOeffnen = (i: number) => a.oeffnen('stundenplan', { typ, element: daten!.elemente[i]!.id });

  // ---- Drag & Drop ----
  const ziel = (x: number, y: number) => {
    const r = platz.current?.getBoundingClientRect();
    if (!r || !daten) return null;
    const px = x - r.left - NAME;
    const zeile = Math.floor((y - r.top) / ZH);
    const spalte = Math.floor(px / sb);
    if (px < 0 || zeile < 0 || zeile >= sichtbar.length || spalte < 0 || spalte >= spalten) return null;
    return { zeile, i: sichtbar[zeile]!, tag: Math.floor(spalte / n), stunde: (spalte % n) + 1 };
  };
  const zulaessig = (g: Gezogen, zl: NonNullable<ReturnType<typeof ziel>>) => zl.i === g.i || (typ === 'raum' && zl.tag === g.tag && zl.stunde === g.stunde);
  const ablage: AblageDaten = {
    annehmen: (d) => d.art === 'uebersicht.stunde' && (d as Gezogen).ueQuelle === a.id,
    ablegen: (d) => {
      const g = d as Gezogen;
      const { x, y } = useZiehen.getState();
      const zl = ziel(x, y);
      if (!zl || !daten || !zulaessig(g, zl)) return;
      let anfrage: Promise<unknown>;
      if (zl.i !== g.i) {
        const alt = daten.elemente[g.i]!;
        const neu = daten.elemente[zl.i]!;
        anfrage = api.post(api.dok('/uebersicht/raum'), { unterricht: g.u, tag: g.tag, stunde: g.stunde, alterRaum: alt.id, neuerRaum: neu.id }, { quelle: a.id })
          .then(() => hinweis(`Raum ${alt.k} → ${neu.k} – Strg+Z macht es rückgängig.`, 'ok', 2500));
      } else {
        if (zl.tag === g.tag && zl.stunde === g.stunde) return;
        anfrage = api.post(api.dok('/stundenplan/verschieben'), { unterricht: g.u, tag: g.tag, stunde: g.stunde, zielTag: zl.tag, zielStunde: zl.stunde, tauschen: true }, { quelle: a.id })
          .then(() => hinweis('Stunde verschoben – Strg+Z macht es rückgängig.', 'ok', 2000));
      }
      anfrage.then(() => neuLaden(true)).catch(fehlerMelden);
    },
  };
  const { setNodeRef: ablageRef } = useDroppable({ id: `${a.id}:uebersicht`, data: ablage, disabled: !schreiben });
  const [zieht, setZieht] = useState<Gezogen | null>(null);
  useDndMonitor({
    onDragStart: (e) => { const d = e.active.data.current as Gezogen | undefined; if (d?.art === 'uebersicht.stunde' && d.ueQuelle === a.id) setZieht(d); },
    onDragEnd: () => setZieht(null),
    onDragCancel: () => setZieht(null),
  });
  const maus = useZiehen((s) => (zieht ? `${s.x}|${s.y}` : ''));
  const marke = useMemo(() => {
    if (!zieht || !maus) return null;
    const [x, y] = maus.split('|').map(Number);
    const zl = ziel(x!, y!);
    return zl ? { ...zl, ok: zulaessig(zieht, zl) } : null;
  }, [zieht, maus]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setScrollLinks(koerper.current?.scrollLeft || 0); }, [daten]);
  const anzahl = daten?.zellen.reduce((x, z) => x + z.length, 0) || 0;
  const z = daten?.zeitraster;

  return (
    <AnsichtRahmen titel={`Gesamtübersicht ${TITEL[typ]}`} laden={laedt && !daten}
      werkzeuge={<>
        <Feld titel="Zelleninhalt">
          <Select size="small" aria-label="Zelleninhalt" value={inhalt} onChange={(_, d) => a.parameterSetzen({ inhalt: d.value })}>
            {[['Standard', 'Standard'], ['Fach', 'Fach'], ['Lehrer', 'Lehrkräfte'], ['Klasse', 'Klassen'], ['Raum', 'Räume']].map(([w, t]) => <option key={w} value={w}>{t}</option>)}
          </Select>
        </Feld>
        <Input type="search" size="small" placeholder={`${TITEL[typ]} filtern`} aria-label="Filtern" style={{ width: 160 }} value={filter} onChange={(_, d) => setFilter(d.value)} />
        <Trenner />
        <Werkzeug text="Drucken" titel="Druckvorschau" aktion={() => a.oeffnen('druck.vorschau', { url: druckUrl('/uebersicht', { typ, inhalt }), titel: `Gesamtübersicht ${TITEL[typ]}` })} />
        <Werkzeug text="PDF" titel="Als PDF herunterladen" aktion={() => herunterladen(druckUrl('/uebersicht', { typ, inhalt }))} />
      </>}
      fuss={daten ? <>
        <span>{`${daten.elemente.length} ${TITEL[typ]}`}</span><span>{`${anzahl} belegte Stunden`}</span>
        <span>{schreiben ? (typ === 'raum' ? 'In eine andere Raumzeile ziehen verlegt den Raum; in der Zeile verschieben oder tauschen' : 'Stunden in der Zeile ziehen verschiebt oder tauscht') : 'Fixierte Stunden sind umrandet'} · Doppelklick öffnet den Stundenplan</span>
        <FussText rechts>{daten.periode}</FussText>
      </> : null}>
      {daten && z ? (
        <div className="ue-rahmen">
          <div className="ue-kopf">
            <div className="ue-kopf-innen" style={{ width: gesamt, transform: `translateX(${-scrollLinks}px)` }}>
              <div className="ue-ecke" style={{ width: NAME }}>{TITEL[typ]}</div>
              {z.tage.map((t, i) => (
                <div key={i} className="ue-tag" style={{ left: NAME + i * n * sb, width: n * sb }}>
                  {sb * n > 120 ? t.lang : t.kurz}
                  <div className="ue-stunden">{z.stunden.map((s, j) => <span key={j} style={{ width: sb }}>{s.label}</span>)}</div>
                </div>
              ))}
            </div>
          </div>
          <div ref={koerper} className="ue-koerper" data-testid="uebersicht" onScroll={(e) => setScrollLinks(e.currentTarget.scrollLeft)}>
            <div ref={(el) => { platz.current = el; ablageRef(el); }} className="ue-platz" style={{ width: gesamt, height: sichtbar.length * ZH }}>
              {virt.getVirtualItems().map((v) => {
                const i = sichtbar[v.index]!;
                const el = daten.elemente[i]!;
                return (
                  <div key={el.id} className="ue-zeile" style={{ top: v.start, height: ZH, width: gesamt }} data-i={i}
                    onClick={() => waehlen(i)} onDoubleClick={() => planOeffnen(i)}>
                    <div className={`ue-name${aktivId === el.id ? ' aktiv' : ''}`} style={{ width: NAME }} title={el.l || el.k}>{el.k}</div>
                    {z.tage.slice(1).map((_, t) => <div key={t} className="ue-taglinie" style={{ left: NAME + (t + 1) * n * sb }} />)}
                    {daten.zellen[i]!.map((c) => (
                      <ZellenEintrag key={`${c[2]}|${c[0]}|${c[1]}`} z={c} i={i} links={NAME + (c[0] * n + c[1] - 1) * sb + 1} breite={sb - 2} ziehbar={schreiben && !c[6]} quelle={a.id} />
                    ))}
                  </div>
                );
              })}
              {marke ? <div className={`ue-ziel${marke.ok ? '' : ' ungueltig'}`} style={{ top: marke.zeile * ZH, left: NAME + (marke.tag * n + marke.stunde - 1) * sb, width: sb, height: ZH }} /> : null}
            </div>
          </div>
        </div>
      ) : null}
    </AnsichtRahmen>
  );
}
