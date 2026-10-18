// Arbeitsplätze: fest gestaltete Seiten mit mehreren Bereichen (Manuell planen, Tagesplanung, Verlegen und Tauschen).
// Bereiche sind Ansichten mit eigener Kopfzeile; die Aufteilung lässt sich mit den Trennern ändern (wird gemerkt).
// Öffnet eine Ansicht eine verwandte Ansicht, zeigt sie ein passender Bereich (gleicher Typ) – sonst erscheint sie in
// einem Seitenbereich rechts (nicht modal, der Arbeitsplatz bleibt bedienbar).
import { DrawerBody, OverlayDrawer, Spinner, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import {
  Children, Suspense, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type PointerEvent as RPointerEvent,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adresseVon, ansichtDef } from '@/kern/ansichten';
import type { Params } from '@/kern/befehle';
import { arbeitsplatzDef } from '@/kern/modulsystem';
import { modusSetzen, useStudio } from '@/kern/zustand';
import { Leer } from '@/komponenten/ansicht';
import { AnsichtHost, KeinDokument } from './ansichthost';
import { bereichVon } from './navigation';
import { seitenortSetzen } from './seitenort';

const useStile = makeStyles({
  seite: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0, height: '100%' },
  kopf: { padding: '14px 20px 10px 20px', flexShrink: 0 },
  pfad: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, lineHeight: tokens.lineHeightBase200 },
  titel: { margin: 0, fontSize: '20px', lineHeight: '28px', fontWeight: tokens.fontWeightSemibold },
  flaeche: { flex: 1, minHeight: 0, display: 'flex', padding: '0 12px 12px 12px' },
  teilung: { display: 'flex', flex: 1, minWidth: 0, minHeight: 0 },
  zeilen: { flexDirection: 'column' },
  teil: { display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden' },
  trennerS: { width: '8px', flexShrink: 0, cursor: 'col-resize', ':hover': { backgroundColor: tokens.colorBrandBackground2 } },
  trennerW: { height: '8px', flexShrink: 0, cursor: 'row-resize', ':hover': { backgroundColor: tokens.colorBrandBackground2 } },
  bereich: {
    display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden',
    border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusLarge, backgroundColor: tokens.colorNeutralBackground1,
  },
  drawerBody: { padding: 0, display: 'flex', flexDirection: 'column' },
});

interface BereichEintrag { typ: string; p: () => Params; setzen: (p: Params) => void }

interface ArbeitsplatzKontextWert {
  name: string;
  registrieren: (id: string, e: BereichEintrag) => () => void;
  oeffnen: (typ: string, p?: Params) => void;
}

const ArbeitsplatzKontext = createContext<ArbeitsplatzKontextWert | null>(null);

const schluesselVon = (typ: string, p: Params) => `${typ}|${ansichtDef(typ)?.schluessel?.(p) ?? ''}`;

function gemerkt<T>(k: string, standard: T): T {
  try { const w = sessionStorage.getItem(k); return w ? (JSON.parse(w) as T) : standard; } catch { return standard; }
}
function merken(k: string, w: unknown) { try { sessionStorage.setItem(k, JSON.stringify(w)); } catch { /* privat */ } }

export function ArbeitsplatzSeite() {
  const s = useStile();
  const { name = '' } = useParams();
  const def = arbeitsplatzDef(name);
  const modus = useStudio((x) => x.modus);
  const dokument = useStudio((x) => x.dokument?.id);
  const navigate = useNavigate();
  const bereiche = useRef(new Map<string, BereichEintrag>());
  const [seitlich, setSeitlich] = useState<{ typ: string; p: Params } | null>(null);

  useEffect(() => { seitenortSetzen({ arbeitsplatz: name, p: {} }); }, [name]);
  useEffect(() => { if (def?.modus && def.modus !== modus) modusSetzen(def.modus); }, [def, modus]);
  useEffect(() => { if (def) document.title = `${def.titel} – UntPlan Studio`; }, [def]);

  const kontext = useMemo<ArbeitsplatzKontextWert>(() => ({
    name,
    registrieren: (id, e) => { bereiche.current.set(id, e); return () => { bereiche.current.delete(id); }; },
    oeffnen: (typ, p = {}) => {
      const k = schluesselVon(typ, p);
      for (const b of bereiche.current.values()) {
        if (schluesselVon(b.typ, b.p()) === k) { b.setzen(p); return; }
      }
      setSeitlich({ typ, p });
    },
  }), [name]);

  if (!def) return <Leer text="Diesen Arbeitsplatz gibt es nicht." />;
  const K = def.komponente;
  return (
    <ArbeitsplatzKontext.Provider value={kontext}>
      <div className={s.seite} data-arbeitsplatz={name}>
        <header className={s.kopf}>
          <div className={s.pfad}>{bereichVon({ arbeitsplatz: name, p: {} }, modus) || ''}</div>
          <h1 className={s.titel}>{def.titel}</h1>
        </header>
        <div className={s.flaeche}>{dokument ? <Suspense fallback={<Spinner size="small" />}><K key={dokument} /></Suspense> : <KeinDokument />}</div>
      </div>
      <OverlayDrawer open={!!seitlich} position="end" size="large" modalType="non-modal" onOpenChange={(_, d) => { if (!d.open) setSeitlich(null); }}>
        <DrawerBody className={s.drawerBody}>
          {seitlich ? (
            <AnsichtHost key={schluesselVon(seitlich.typ, seitlich.p)} typ={seitlich.typ} p={seitlich.p} lage="neben"
              parameterSetzen={(p) => setSeitlich((x) => (x ? { ...x, p: { ...x.p, ...p } } : x))}
              oeffnen={kontext.oeffnen} schliessen={() => setSeitlich(null)}
              alsSeite={() => { const x = seitlich; setSeitlich(null); navigate(adresseVon(x.typ, x.p)); }} />
          ) : null}
        </DrawerBody>
      </OverlayDrawer>
    </ArbeitsplatzKontext.Provider>
  );
}

/** Bereich eines Arbeitsplatzes mit einer Ansicht. id: fester Name innerhalb des Arbeitsplatzes (Parameter werden gemerkt). */
export function Bereich({ id, typ, p: start = {} }: { id: string; typ: string; p?: Params }) {
  const s = useStile();
  const ap = useContext(ArbeitsplatzKontext)!;
  const navigate = useNavigate();
  const speicher = `arbeitsplatz.${ap.name}.${id}`;
  const [p, setP] = useState<Params>(() => ({ ...start, ...gemerkt<Params>(speicher, {}) }));
  const pRef = useRef(p);
  pRef.current = p;
  const parameterSetzen = useCallback((neu: Params) => {
    setP((x) => { const n = { ...x, ...neu }; merken(speicher, n); return n; });
  }, [speicher]);
  useEffect(() => ap.registrieren(id, { typ, p: () => pRef.current, setzen: parameterSetzen }), [ap, id, typ, parameterSetzen]);
  return (
    <div className={s.bereich} data-bereich={id}>
      <AnsichtHost typ={typ} p={p} lage="bereich" parameterSetzen={parameterSetzen} oeffnen={ap.oeffnen}
        alsSeite={() => navigate(adresseVon(typ, pRef.current))} />
    </div>
  );
}

/** Aufteilung in Spalten (waagerecht) oder Zeilen (senkrecht) mit verschiebbaren Trennern. anteile in Prozent. */
export function Teilung({ richtung = 'spalten', anteile, schluessel, children }: { richtung?: 'spalten' | 'zeilen'; anteile: number[]; schluessel: string; children: ReactNode }) {
  const s = useStile();
  const teile = Children.toArray(children);
  const speicher = `teilung.${schluessel}`;
  const [werte, setWerte] = useState<number[]>(() => {
    try { const w = JSON.parse(localStorage.getItem(speicher) || 'null') as number[] | null; if (w && w.length === teile.length) return w; } catch { /* */ }
    return anteile;
  });
  const ref = useRef<HTMLDivElement>(null);
  const spalten = richtung === 'spalten';
  const ziehen = (i: number) => (e: RPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = ref.current;
    if (!el) return;
    const gesamt = spalten ? el.clientWidth : el.clientHeight;
    const start = spalten ? e.clientX : e.clientY;
    const a0 = werte[i]!, b0 = werte[i + 1]!;
    let aktuell = werte;
    const bewegen = (ev: PointerEvent) => {
      const d = (((spalten ? ev.clientX : ev.clientY) - start) / gesamt) * 100;
      const a = Math.max(10, Math.min(a0 + b0 - 10, a0 + d));
      aktuell = werte.map((w, j) => (j === i ? a : j === i + 1 ? a0 + b0 - a : w));
      setWerte(aktuell);
    };
    const ende = () => {
      removeEventListener('pointermove', bewegen);
      removeEventListener('pointerup', ende);
      try { localStorage.setItem(speicher, JSON.stringify(aktuell)); } catch { /* privat */ }
    };
    addEventListener('pointermove', bewegen);
    addEventListener('pointerup', ende);
  };
  return (
    <div ref={ref} className={mergeClasses(s.teilung, !spalten && s.zeilen)}>
      {teile.map((t, i) => (
        <FragmentMitTrenner key={i} erster={i === 0} trennerKlasse={spalten ? s.trennerS : s.trennerW} beiZiehen={i > 0 ? ziehen(i - 1) : undefined}>
          <div className={s.teil} style={{ flex: `${werte[i] ?? 1} 1 0` }}>{t}</div>
        </FragmentMitTrenner>
      ))}
    </div>
  );
}

function FragmentMitTrenner({ erster, trennerKlasse, beiZiehen, children }: { erster: boolean; trennerKlasse: string; beiZiehen?: (e: RPointerEvent<HTMLDivElement>) => void; children: ReactNode }) {
  return (
    <>
      {!erster ? <div className={trennerKlasse} role="separator" onPointerDown={beiZiehen} /> : null}
      {children}
    </>
  );
}

