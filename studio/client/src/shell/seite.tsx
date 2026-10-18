// Seite: eine Ansicht mit eigener Adresse (/<pfad>?<parameter>), optional mit einem Nebenbereich rechts
// (Adresse: n=<typ>&n.<parameter>=…), der beim Öffnen einer verwandten Ansicht aus der Seite heraus erscheint.
import { makeStyles, tokens } from '@fluentui/react-components';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { adresseVon, ansichtDef, ansichtNachPfad, paramsAusSuche, sucheAusParams } from '@/kern/ansichten';
import type { Params } from '@/kern/befehle';
import { useModusBindung } from './modusbindung';
import { Leer } from '@/komponenten/ansicht';
import { AnsichtHost } from './ansichthost';
import { seitenortSetzen } from './seitenort';

const useStile = makeStyles({
  seite: { display: 'flex', flex: 1, minHeight: 0, minWidth: 0, height: '100%' },
  haupt: { flex: 1, minWidth: '320px', minHeight: 0, display: 'flex', flexDirection: 'column' },
  neben: {
    flexShrink: 0, minWidth: '320px', maxWidth: '75%', display: 'flex', flexDirection: 'column', position: 'relative',
    borderLeft: `1px solid ${tokens.colorNeutralStroke1}`, boxShadow: tokens.shadow4,
  },
  griff: {
    position: 'absolute', left: '-4px', top: 0, bottom: 0, width: '8px', cursor: 'col-resize', zIndex: 3,
    ':hover': { backgroundColor: tokens.colorBrandStroke2 },
  },
});

const schluessel = (typ: string, p: Params) => `${typ}|${ansichtDef(typ)?.schluessel?.(p) ?? ''}`;

function nebenBreite(): number {
  try { return Math.max(320, Number(localStorage.getItem('studio.nebenbreite')) || 560); } catch { return 560; }
}

export function Seite() {
  const s = useStile();
  const ort = useLocation();
  const navigate = useNavigate();
  const [suche, setSuche] = useSearchParams();
  const treffer = ansichtNachPfad(ort.pathname);
  const typ = treffer?.[0];
  const def = treffer?.[1];
  const sucheText = suche.toString();
  const p = useMemo(() => paramsAusSuche(new URLSearchParams(sucheText)), [sucheText]);
  const nebenTyp = suche.get('n');
  const nebenP = useMemo(() => paramsAusSuche(new URLSearchParams(sucheText), 'n.'), [sucheText]);
  const [breite, setBreite] = useState(nebenBreite);
  const breiteRef = useRef(breite);
  breiteRef.current = breite;

  useEffect(() => { if (typ) seitenortSetzen({ typ, p }); }, [typ, p]);
  useModusBindung(def?.modus, typ);

  const aktuelleSuche = () => new URLSearchParams(window.location.search);

  const parameterSetzen = useCallback((neu: Params) => {
    const q = aktuelleSuche();
    for (const [k, v] of Object.entries(neu)) { if (v === undefined || v === null || v === '') q.delete(k); else q.set(k, String(v)); }
    setSuche(q, { replace: true });
  }, [setSuche]);

  const nebenParameterSetzen = useCallback((neu: Params) => {
    const q = aktuelleSuche();
    for (const [k, v] of Object.entries(neu)) { if (v === undefined || v === null || v === '') q.delete(`n.${k}`); else q.set(`n.${k}`, String(v)); }
    setSuche(q, { replace: true });
  }, [setSuche]);

  const nebenOeffnen = useCallback((t: string, np?: Params) => {
    const q = aktuelleSuche();
    const hauptP = paramsAusSuche(q);
    // gleiche Ansicht wie die Seite: die Seite selbst zeigt das neue Ziel
    if (typ && schluessel(t, np || {}) === schluessel(typ, hauptP)) { parameterSetzen(np || {}); return; }
    for (const k of [...q.keys()]) if (k === 'n' || k.startsWith('n.')) q.delete(k);
    q.set('n', t);
    sucheAusParams(np, 'n.', q);
    setSuche(q);
  }, [typ, parameterSetzen, setSuche]);

  const nebenSchliessen = useCallback(() => {
    const q = aktuelleSuche();
    for (const k of [...q.keys()]) if (k === 'n' || k.startsWith('n.')) q.delete(k);
    setSuche(q);
  }, [setSuche]);

  const nebenAlsSeite = useCallback(() => {
    if (nebenTyp) navigate(adresseVon(nebenTyp, nebenP));
  }, [navigate, nebenTyp, nebenP]);

  const ziehen = (e: RPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const start = e.clientX, b0 = breiteRef.current;
    const bewegen = (ev: PointerEvent) => setBreite(Math.max(320, Math.min(window.innerWidth * 0.75, b0 - (ev.clientX - start))));
    const ende = () => {
      removeEventListener('pointermove', bewegen);
      removeEventListener('pointerup', ende);
      try { localStorage.setItem('studio.nebenbreite', String(Math.round(breiteRef.current))); } catch { /* privat */ }
    };
    addEventListener('pointermove', bewegen);
    addEventListener('pointerup', ende);
  };

  if (!typ || !def) return <Leer text="Diese Seite gibt es nicht." />;
  return (
    <div className={s.seite}>
      <div className={s.haupt}>
        <AnsichtHost key={schluessel(typ, p)} typ={typ} p={p} lage="seite" parameterSetzen={parameterSetzen} oeffnen={nebenOeffnen} />
      </div>
      {nebenTyp && ansichtDef(nebenTyp) ? (
        <aside className={s.neben} style={{ width: breite }} aria-label="Nebenbereich">
          <div className={s.griff} onPointerDown={ziehen} role="separator" aria-orientation="vertical" />
          <AnsichtHost key={schluessel(nebenTyp, nebenP)} typ={nebenTyp} p={nebenP} lage="neben" parameterSetzen={nebenParameterSetzen}
            oeffnen={nebenOeffnen} schliessen={nebenSchliessen} alsSeite={nebenAlsSeite} />
        </aside>
      ) : null}
    </div>
  );
}
