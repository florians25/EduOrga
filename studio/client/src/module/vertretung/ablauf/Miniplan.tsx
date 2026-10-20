// Miniplan: kleine, frei verschiebbare Fenster mit dem tagesaktuellen Plan einer Klasse, Lehrkraft oder eines Raums (Tag oder
// Woche) über der Tagesplanung. Mehrere Fenster gleichzeitig; ziehen am Titel, Größe an der Ecke unten rechts, an den Rändern
// schnappen sie ein. Einklappen auf die Titelzeile, Schließen. „Folgt der Auswahl“: das Fenster zeigt jeweils die Klasse bzw.
// Lehrkraft bzw. den Raum der gewählten Stunde. Lage, Größe und Wahl je Benutzer im Browser gemerkt. Ein Klick auf eine Stunde
// mit Vertretung wählt sie in der Tagesplanung.
import { Button, Portal, Tooltip, mergeClasses } from '@fluentui/react-components';
import { ChevronDown16Regular, ChevronUp16Regular, Dismiss16Regular, Pin16Filled, Pin16Regular } from '@fluentui/react-icons';
import { useEffect, useRef, type PointerEvent as RPointerEvent } from 'react';
import { create } from 'zustand';
import { api } from '@/api/client';
import type { Stunde } from '@/api/typen';
import { useDaten } from '@/kern/laden';
import { useStudio } from '@/kern/zustand';
import { hinweis } from '@/komponenten/hinweise';
import { auswahlMelden, usePlanungsdatum, vpfad } from '../kern';
import './matrix.css';

export type MiniTyp = 'klasse' | 'lehrer' | 'raum';
const TYPTEXT: Record<MiniTyp, string> = { klasse: 'Klasse', lehrer: 'Lehrkraft', raum: 'Raum' };
interface Fenster { id: string; typ: MiniTyp; element: number; kurz: string; x: number; y: number; w: number; h: number; min: boolean; folgt: boolean; woche: boolean; z: number }
interface MiniZustand { fenster: Fenster[]; z: number }

const RAND = 8;
const KOPF = 30;
const schluessel = () => `vertretung.miniplaene.${useStudio.getState().benutzer?.name || ''}`;
function lesen(): MiniZustand {
  try {
    const f = JSON.parse(localStorage.getItem(schluessel()) || 'null') as Fenster[] | null;
    if (Array.isArray(f)) return { fenster: f.filter((x) => x && x.typ && x.element).map((x, i) => ({ ...x, z: i + 1 })), z: f.length + 1 };
  } catch { /* privat */ }
  return { fenster: [], z: 1 };
}
export const useMiniplaene = create<MiniZustand>(() => lesen());
useStudio.subscribe((s, alt) => { if (s.benutzer?.name !== alt.benutzer?.name) useMiniplaene.setState(lesen()); });
function setzen(f: (l: Fenster[]) => Fenster[]) {
  useMiniplaene.setState((s) => ({ fenster: f(s.fenster) }));
  try { localStorage.setItem(schluessel(), JSON.stringify(useMiniplaene.getState().fenster)); } catch { /* privat */ }
}
const aendern = (id: string, n: Partial<Fenster>) => setzen((l) => l.map((x) => (x.id === id ? { ...x, ...n } : x)));
const nachVorn = (id: string) => useMiniplaene.setState((s) => {
  const f = s.fenster.find((x) => x.id === id);
  if (!f || f.z === s.z) return s;
  return { z: s.z + 1, fenster: s.fenster.map((x) => (x.id === id ? { ...x, z: s.z + 1 } : x)) };
});

/** Lage in den sichtbaren Bereich holen (eingeklappt zählt nur die Titelzeile). */
function eingepasst(f: Fenster): Fenster {
  const bw = window.innerWidth, bh = window.innerHeight;
  const w = Math.min(Math.max(200, f.w), bw - 2 * RAND);
  const h = Math.min(Math.max(140, f.h), bh - 2 * RAND);
  const hoehe = f.min ? KOPF : h;
  return { ...f, w, h, x: Math.max(RAND, Math.min(f.x, bw - w - RAND)), y: Math.max(RAND, Math.min(f.y, bh - hoehe - RAND)) };
}

/** Miniplan öffnen (vorhandenes Fenster desselben Elements kommt nach vorn und wird ausgeklappt). */
export function miniplanOeffnen(typ: MiniTyp, element: number | null | undefined, kurz: string, { folgt = false }: { folgt?: boolean } = {}) {
  if (!element) return;
  const { fenster, z } = useMiniplaene.getState();
  const da = fenster.find((x) => x.typ === typ && x.element === element) ?? (folgt ? fenster.find((x) => x.typ === typ && x.folgt) : undefined);
  if (da) { aendern(da.id, { element, kurz, min: false, ...(folgt ? { folgt: true } : {}) }); nachVorn(da.id); return; }
  // neue Fenster unten rechts über der Matrix (links der Entscheidung) nebeneinander, damit die Entscheidung frei bleibt
  const n = fenster.filter((x) => !x.min).length;
  const w = 240, h = Math.min(300, window.innerHeight - 200);
  const rechts = document.querySelector('.mx-seite')?.getBoundingClientRect().left ?? window.innerWidth;
  let x = rechts - w - 12 - n * (w + 8);
  let y = window.innerHeight - h - 12;
  if (x < 80) { x = rechts - w - 12 - (n % 3) * 28; y = window.innerHeight - h - 12 - (n % 3) * 28; }
  const neu = eingepasst({ id: `${Date.now().toString(36)}${fenster.length}`, typ, element, kurz, w, h, min: false, folgt, woche: false, z: z + 1, x, y });
  useMiniplaene.setState({ z: z + 1 });
  setzen((l) => [...l, neu]);
}

/** Fenster mit „folgt der Auswahl“ auf die Elemente der gewählten Stunde stellen. */
type Auswahl = Partial<Record<MiniTyp, { id: number | null | undefined; kurz: string }>>;
let letzteAuswahl: Auswahl = {};
export function miniplaeneFolgen(sel: Auswahl) {
  letzteAuswahl = sel;
  const { fenster } = useMiniplaene.getState();
  if (!fenster.some((f) => f.folgt)) return;
  setzen((l) => l.map((f) => {
    const s = sel[f.typ];
    return f.folgt && s?.id && s.id !== f.element ? { ...f, element: s.id, kurz: s.kurz } : f;
  }));
}

/** Miniplan, der der Auswahl folgt, ein- bzw. ausblenden (Taste P): in der Klassenübersicht die Lehrkraft der gewählten Stunde
 *  (die Klasse steht schon als Zeile da), in der Lehrkräfteübersicht die Klasse. */
export function miniplaeneUmschalten(typ: MiniTyp = 'lehrer') {
  const { fenster } = useMiniplaene.getState();
  if (fenster.some((f) => f.folgt)) { setzen((l) => l.filter((f) => !f.folgt)); return; }
  const a = letzteAuswahl[typ]?.id ? letzteAuswahl[typ]! : null;
  const t = a ? typ : (['lehrer', 'klasse', 'raum'] as MiniTyp[]).find((x) => letzteAuswahl[x]?.id);
  if (!t) { hinweis('Zuerst eine Stunde wählen – der Miniplan folgt dann der Auswahl.', 'info', 3000); return; }
  miniplanOeffnen(t, letzteAuswahl[t]!.id, letzteAuswahl[t]!.kurz, { folgt: true });
}
export const miniplaeneFolgenAktiv = () => useMiniplaene.getState().fenster.some((f) => f.folgt);

interface MEintrag { vtr?: number; fach: string; klassen: string; lehrer: string; lehrerAlt?: string; raum: string; raumAlt?: string; status: string; durch?: boolean; offen?: boolean }
interface MPlan { element: { kurz: string; lang: string }; zeitraster: { stunden: Stunde[] }; tage: { kurz: string; text: string; datum: string; unterrichtstag: boolean; frei?: string }[]; zellen: { tag: number; stunde: number; datum: string; eintraege: MEintrag[] }[] }

function Eintrag({ e, typ, datum, stunde }: { e: MEintrag; typ: MiniTyp; datum: string; stunde: number }) {
  const zweit = typ === 'lehrer' ? e.klassen : e.lehrer;
  const alt = typ === 'lehrer' ? '' : e.lehrerAlt;
  const st = e.status === 'Offen' || (e.offen && e.status !== 'Entfall') ? 'o' : e.durch || e.status === 'Entfall' ? 'e' : e.status === 'Regulaer' ? 'n' : 'v';
  const titel = [`${e.fach} – ${e.klassen} – ${e.lehrer || '???'}${e.raum ? ` – ${e.raum}` : ''}`, e.lehrerAlt ? `statt ${e.lehrerAlt}` : '', e.raumAlt ? `statt Raum ${e.raumAlt}` : ''].filter(Boolean).join('\n');
  return (
    <button type="button" className={`mp-e mx-st-${st}`} title={titel} disabled={!e.vtr} data-vtr={e.vtr}
      onClick={() => { if (e.vtr) auswahlMelden({ id: e.vtr, ids: [e.vtr], quelle: 'miniplan', zeile: { v: e.vtr, datum, stunde } }); }}>
      <span className="mp-fach">{e.fach || '—'}</span>
      <span className="mp-zweit">{alt ? <><s>{alt}</s> </> : null}{st === 'o' && typ !== 'lehrer' ? null : zweit}{st === 'o' ? <b className="mp-frage">{typ === 'lehrer' ? ' ?' : '?'}</b> : null}</span>
      {typ !== 'raum' ? <span className="mp-raum">{e.raum}</span> : null}
    </button>
  );
}

function Plan({ f }: { f: Fenster }) {
  const datum = usePlanungsdatum();
  const { daten, laedt } = useDaten(() => api.get<MPlan>(vpfad(`/plan/${f.typ}/${f.element}?datum=${datum}`)), [f.typ, f.element, datum],
    { bereiche: ['Vertretung', 'Stundenplan', 'Unterricht', 'Stammdaten'], aktiv: !!datum && !f.min });
  if (!daten) return <div className="mp-leer">{laedt ? 'Wird geladen …' : ''}</div>;
  const tage = daten.tage.map((t, i) => ({ t, i })).filter(({ t }) => f.woche || t.datum === datum);
  const zelle = (tag: number, std: number) => daten.zellen.find((z) => z.tag === tag && z.stunde === std);
  return (
    <div className="mp-raster" style={{ gridTemplateColumns: `28px repeat(${tage.length}, minmax(0, 1fr))` }}>
      <span className="mp-ecke" />
      {tage.map(({ t }) => <span key={t.datum} className={mergeClasses('mp-tag', t.datum === datum && 'heute', !t.unterrichtstag && 'frei')} title={t.frei || undefined}>{`${t.kurz} ${t.text}`}</span>)}
      {daten.zeitraster.stunden.map((s) => (
        <div key={s.nr} className="mp-zeile" style={{ display: 'contents' }}>
          <span className="mp-std" title={`${s.beginn}–${s.ende}`}>{s.nr}</span>
          {tage.map(({ t, i }) => {
            const z = zelle(i, s.nr);
            return (
              <span key={t.datum} className={mergeClasses('mp-zelle', t.datum === datum && f.woche && 'heute')}>
                {(z?.eintraege || []).slice(0, f.woche ? 1 : 2).map((e, j) => <Eintrag key={j} e={e} typ={f.typ} datum={t.datum} stunde={s.nr} />)}
                {z && z.eintraege.length > (f.woche ? 1 : 2) ? <span className="mp-mehr" title={z.eintraege.map((e) => `${e.fach} ${e.klassen} ${e.lehrer}`).join('\n')}>{`+${z.eintraege.length - (f.woche ? 1 : 2)}`}</span> : null}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function MiniFenster({ f }: { f: Fenster }) {
  const zug = useRef<{ art: 'ziehen' | 'groesse'; x0: number; y0: number; f0: Fenster } | null>(null);
  const runter = (art: 'ziehen' | 'groesse') => (e: RPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || (art === 'ziehen' && (e.target as HTMLElement).closest('button'))) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    zug.current = { art, x0: e.clientX, y0: e.clientY, f0: f };
    nachVorn(f.id);
  };
  const bewegen = (e: RPointerEvent<HTMLElement>) => {
    const z = zug.current;
    if (!z) return;
    const dx = e.clientX - z.x0, dy = e.clientY - z.y0;
    useMiniplaene.setState((s) => ({
      fenster: s.fenster.map((x) => (x.id !== f.id ? x : eingepasst(z.art === 'ziehen' ? { ...x, x: z.f0.x + dx, y: z.f0.y + dy } : { ...x, w: z.f0.w + dx, h: z.f0.h + dy }))),
    }));
  };
  const los = () => {
    if (!zug.current) return;
    zug.current = null;
    // an den Rändern einschnappen (16 px)
    const x = useMiniplaene.getState().fenster.find((y) => y.id === f.id);
    if (!x) return;
    const bw = window.innerWidth, bh = window.innerHeight, hoehe = x.min ? KOPF : x.h;
    const n: Partial<Fenster> = {};
    if (x.x < RAND + 16) n.x = RAND;
    if (x.x + x.w > bw - RAND - 16) n.x = bw - x.w - RAND;
    if (x.y < RAND + 16) n.y = RAND;
    if (x.y + hoehe > bh - RAND - 16) n.y = bh - hoehe - RAND;
    aendern(f.id, n);
  };
  const titel = `${TYPTEXT[f.typ]} ${f.kurz}`;
  return (
    <section className={mergeClasses('mp-fenster', f.min && 'min')} style={{ left: f.x, top: f.y, width: f.w, height: f.min ? KOPF : f.h, zIndex: f.z }}
      aria-label={`Miniplan ${titel}`} data-testid="miniplan" data-typ={f.typ} data-kurz={f.kurz} onPointerDown={() => nachVorn(f.id)}>
      <header className="mp-kopf" onPointerDown={runter('ziehen')} onPointerMove={bewegen} onPointerUp={los} onPointerCancel={los}
        onDoubleClick={(e) => { if (!(e.target as HTMLElement).closest('button')) aendern(f.id, { min: !f.min }); }}>
        <span className="mp-titel" title={`${titel} – am Titel verschieben, Doppelklick klappt ein`}><b>{f.kurz}</b><span>{TYPTEXT[f.typ]}</span></span>
        <button type="button" className={mergeClasses('mp-umschalter', f.woche && 'an')} onClick={() => aendern(f.id, { woche: !f.woche, w: !f.woche ? Math.max(f.w, 520) : 240 })}
          title={f.woche ? 'Nur den Planungstag zeigen' : 'Ganze Woche zeigen'} data-testid="miniplan-woche">{f.woche ? 'Woche' : 'Tag'}</button>
        <Tooltip content={f.folgt ? 'Folgt der Auswahl – lösen' : `Folgt der Auswahl (zeigt die ${TYPTEXT[f.typ]} der gewählten Stunde)`} relationship="label">
          <Button size="small" appearance="subtle" className="mp-knopf" aria-pressed={f.folgt} icon={f.folgt ? <Pin16Filled /> : <Pin16Regular />} onClick={() => aendern(f.id, { folgt: !f.folgt })} data-testid="miniplan-folgt" />
        </Tooltip>
        <Tooltip content={f.min ? 'Ausklappen' : 'Einklappen'} relationship="label">
          <Button size="small" appearance="subtle" className="mp-knopf" icon={f.min ? <ChevronDown16Regular /> : <ChevronUp16Regular />} onClick={() => setzen((l) => l.map((x) => (x.id === f.id ? eingepasst({ ...x, min: !x.min }) : x)))} data-testid="miniplan-min" />
        </Tooltip>
        <Tooltip content="Schließen" relationship="label">
          <Button size="small" appearance="subtle" className="mp-knopf" icon={<Dismiss16Regular />} onClick={() => setzen((l) => l.filter((x) => x.id !== f.id))} data-testid="miniplan-zu" />
        </Tooltip>
      </header>
      {f.min ? null : <>
        <div className="mp-inhalt"><Plan f={f} /></div>
        <span className="mp-griff" aria-hidden onPointerDown={runter('groesse')} onPointerMove={bewegen} onPointerUp={los} onPointerCancel={los} />
      </>}
    </section>
  );
}

/** Ebene mit allen Miniplänen (nur in der Tagesplanung eingehängt). */
export function Miniplaene() {
  const fenster = useMiniplaene((x) => x.fenster);
  useEffect(() => {
    const f = () => useMiniplaene.setState((s) => ({ fenster: s.fenster.map(eingepasst) }));
    f();
    addEventListener('resize', f);
    return () => removeEventListener('resize', f);
  }, []);
  if (!fenster.length) return null;
  return <Portal><div className="mp-ebene">{fenster.map((f) => <MiniFenster key={f.id} f={f} />)}</div></Portal>;
}
