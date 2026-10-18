// Befehlssuche (Strg+K): findet jeden Eintrag der Navigation, jeden Befehl der Module und jeden Untermenüpunkt.
import { Dialog, DialogSurface, Input, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { Search20Regular } from '@fluentui/react-icons';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { create } from 'zustand';
import { eintragAusfuehren, verfuegbar } from '@/kern/befehle';
import { normal, vergleich } from '@/kern/hilfen';
import { useStudio } from '@/kern/zustand';
import { befehlsliste } from './navigation';

const useOffen = create<{ offen: boolean }>(() => ({ offen: false }));
export const befehlssucheOeffnen = () => useOffen.setState({ offen: true });
export const befehlssucheIstOffen = () => useOffen.getState().offen;

const useStile = makeStyles({
  flaeche: { width: '640px', maxWidth: 'calc(100vw - 32px)', padding: 0, alignSelf: 'flex-start', marginTop: '12vh' },
  kopf: { padding: '12px', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` },
  liste: { maxHeight: '52vh', overflowY: 'auto', padding: '4px' },
  treffer: {
    display: 'flex', alignItems: 'baseline', gap: '12px', width: '100%', padding: '8px 12px', border: 'none', background: 'none',
    textAlign: 'left', cursor: 'pointer', borderRadius: tokens.borderRadiusMedium, color: tokens.colorNeutralForeground1,
    fontFamily: 'inherit', fontSize: tokens.fontSizeBase300,
  },
  aktiv: { backgroundColor: tokens.colorNeutralBackground1Selected },
  text: { flex: 1, minWidth: 0 },
  ort: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '45%' },
  taste: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase100, border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: '3px', padding: '0 4px' },
  leer: { padding: '16px', color: tokens.colorNeutralForeground3 },
  fuss: { display: 'flex', gap: '16px', padding: '8px 12px', borderTop: `1px solid ${tokens.colorNeutralStroke2}`, color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
});

export function Befehlssuche() {
  const s = useStile();
  const offen = useOffen((x) => x.offen);
  const modus = useStudio((x) => x.modus);
  const dokument = useStudio((x) => x.dokument?.id);
  const [q, setQ] = useState('');
  const [index, setIndex] = useState(0);
  const listeRef = useRef<HTMLDivElement>(null);
  const alle = useMemo(() => (offen ? befehlsliste(modus).filter((b) => verfuegbar(b.e)) : []), [offen, modus, dokument]);
  const treffer = useMemo(() => {
    const n = normal(q.trim());
    const teile = n.split(/\s+/).filter(Boolean);
    return alle.map((b) => {
      const t = normal(b.text), o = normal(b.ort);
      if (!teile.every((x) => t.includes(x) || o.includes(x))) return null;
      return { b, rang: !n ? 0 : t.startsWith(n) ? 0 : t.includes(n) ? 1 : 2 };
    }).filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, c) => a.rang - c.rang || Number(a.b.ort === 'Weitere Befehle') - Number(c.b.ort === 'Weitere Befehle') || vergleich(a.b.text, c.b.text))
      .slice(0, 60).map((x) => x.b);
  }, [alle, q]);
  useEffect(() => { if (offen) { setQ(''); setIndex(0); } }, [offen]);
  useEffect(() => { listeRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [index]);
  const zu = () => useOffen.setState({ offen: false });
  const ausfuehren = (i: number) => { const b = treffer[i]; if (!b) return; zu(); void eintragAusfuehren(b.e); };
  const taste = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(treffer.length - 1, i + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
    if (e.key === 'Enter') { e.preventDefault(); ausfuehren(index); }
  };
  return (
    <Dialog open={offen} onOpenChange={(_, d) => { if (!d.open) zu(); }}>
      <DialogSurface className={s.flaeche} aria-label="Befehlssuche">
        <div className={s.kopf}>
          <Input autoFocus value={q} onChange={(_, d) => { setQ(d.value); setIndex(0); }} onKeyDown={taste} contentBefore={<Search20Regular />}
            placeholder="Befehl oder Ansicht suchen …" aria-label="Befehl suchen" style={{ width: '100%' }} appearance="underline" data-testid="befehlssuche" />
        </div>
        <div className={s.liste} role="listbox" ref={listeRef}>
          {treffer.length ? treffer.map((b, i) => (
            <button key={`${b.ort}|${b.text}|${i}`} type="button" role="option" aria-selected={i === index} className={mergeClasses(s.treffer, i === index && s.aktiv)}
              onClick={() => ausfuehren(i)} onPointerMove={() => { if (i !== index) setIndex(i); }}>
              <span className={s.text}>{b.text}</span>
              <span className={s.ort}>{b.ort}</span>
              {b.e.taste ? <span className={s.taste}>{b.e.taste}</span> : null}
            </button>
          )) : <div className={s.leer}>Keine passenden Befehle.</div>}
        </div>
        <div className={s.fuss}><span>↑ ↓ auswählen</span><span>Enter öffnen</span><span>Esc schließen</span></div>
      </DialogSurface>
    </Dialog>
  );
}
