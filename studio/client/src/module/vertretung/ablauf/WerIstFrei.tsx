// „Wer ist frei?“: alle Lehrkräfte × Stunden des Planungstags – Unterricht, vertritt, abwesend, Bereitschaft, freigesetzt,
// Hohlstunde oder frei – mit der Vertretungsbelastung in Woche und Monat. Die Spalte der gewählten offenen Stunde ist
// hervorgehoben; ein Doppelklick auf eine freie Zelle dort weist die Lehrkraft zu. Klick auf eine Zeile: der Lehrkräfteplan
// folgt. Filter (Suche, nur heute im Haus, nur frei in der gewählten Stunde) und Sortierung (Name, Belastung); virtualisiert.
import { Input, Select, makeStyles, mergeClasses } from '@fluentui/react-components';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useMemo, useRef, useState } from 'react';
import { useAnsicht } from '@/kern/ansichten';
import { melden, useEreignis } from '@/kern/ereignisse';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, Feld, FussText, Leer } from '@/komponenten/ansicht';
import { fehlerMelden } from '@/komponenten/hinweise';
import { aktuelleAuswahl, mitRueckfragen, usePlanungsdatum, vpfad } from '../kern';
import { QUELLE, freiLaden, mehrzahl, type FreiZeile } from './daten';
import './ablauf.css';

const useStile = makeStyles({
  rollen: { flex: 1, minHeight: 0, overflow: 'auto', position: 'relative' },
  suche: { width: '140px' },
  felder: { display: 'inline-flex', alignItems: 'center', gap: '14px' },
});

const CODE: Record<string, { text: string; titel: string }> = {
  U: { text: '', titel: 'Unterricht' }, V: { text: '', titel: 'vertritt' }, A: { text: 'abw.', titel: 'abwesend' }, B: { text: 'Ber.', titel: 'Bereitschaft' },
  X: { text: 'frei', titel: 'freigesetzt (eigener Unterricht entfällt)' }, H: { text: 'Hohl', titel: 'Hohlstunde (frei zwischen eigenem Unterricht)' }, '': { text: '', titel: 'frei' },
};
const FREI = new Set(['', 'H', 'B', 'X']);

type Sortierung = 'name' | 'last' | 'woche';

export default function WerIstFrei() {
  const s = useStile();
  const a = useAnsicht();
  const datum = usePlanungsdatum();
  const schreiben = useDarfSchreiben();
  const [suche, setSuche] = useState('');
  const [nur, setNur] = useState<'alle' | 'haus' | 'frei'>('alle');
  const [sort, setSort] = useState<Sortierung>('name');
  const [auswahl, setAuswahl] = useState(() => { const x = aktuelleAuswahl(); return x ? { id: x.id, stunde: Number(x.zeile?.stunde) || null } : null; });
  const [zeile, setZeile] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { daten, laedt } = useDaten(() => freiLaden(datum!), [datum], { bereiche: ['Vertretung', 'Stundenplan', 'Unterricht', 'Stammdaten'], aktiv: !!datum });
  useEreignis('vertretung.auswahl', (x) => setAuswahl(x ? { id: x.id, stunde: Number(x.zeile?.stunde) || null } : null));

  const spalte = daten && auswahl?.stunde ? daten.stunden.findIndex((x) => x.nr === auswahl.stunde) : -1;
  const liste = useMemo(() => {
    let l = daten?.lehrer || [];
    const t = suche.trim().toLowerCase();
    if (t) l = l.filter((x) => x.k.toLowerCase().includes(t) || x.name.toLowerCase().includes(t));
    if (nur === 'haus') l = l.filter((x) => x.unterricht > 0 && !x.zellen.every((z) => z[0] === 'A'));
    if (nur === 'frei' && spalte >= 0) l = l.filter((x) => FREI.has(x.zellen[spalte]![0]));
    if (sort === 'last') l = [...l].sort((x, y) => x.monat - y.monat || x.woche - y.woche || x.k.localeCompare(y.k, 'de'));
    if (sort === 'woche') l = [...l].sort((x, y) => y.woche - x.woche || y.monat - x.monat || x.k.localeCompare(y.k, 'de'));
    return l;
  }, [daten, suche, nur, sort, spalte]);
  const virt = useVirtualizer({ count: liste.length, getScrollElement: () => ref.current, estimateSize: () => 28, overscan: 12 });
  const freiInSpalte = spalte >= 0 ? (daten?.lehrer || []).filter((x) => FREI.has(x.zellen[spalte]![0])).length : 0;

  const zuweisen = (l: FreiZeile) => {
    if (!schreiben || !auswahl || spalte < 0 || !FREI.has(l.zellen[spalte]![0])) return;
    mitRueckfragen(vpfad(`/vorschlag/${auswahl.id}/uebernehmen`), { lehrer: l.id, ids: [auswahl.id] }, { quelle: QUELLE }).catch(fehlerMelden);
  };
  const breiteStunden = (daten?.stunden.length || 0) * 34;

  return (
    <AnsichtRahmen titel="Wer ist frei?" laden={laedt && !daten}
      werkzeuge={<>
        <span className={s.felder}>
        <Feld><Input size="small" className={s.suche} placeholder="Lehrkraft suchen" value={suche} onChange={(_, d) => setSuche(d.value)} aria-label="Lehrkraft suchen" /></Feld>
        <Feld titel="Zeigen">
          <Select size="small" value={nur} onChange={(_, d) => setNur(d.value as typeof nur)} aria-label="Zeigen">
            <option value="alle">alle Lehrkräfte</option><option value="haus">heute mit Unterricht</option>
            <option value="frei" disabled={spalte < 0}>frei in der gewählten Stunde</option>
          </Select>
        </Feld>
        <Feld titel="Sortieren">
          <Select size="small" value={sort} onChange={(_, d) => setSort(d.value as Sortierung)} aria-label="Sortieren">
            <option value="name">nach Kürzel</option><option value="last">wenigste Vertretungen zuerst</option><option value="woche">meiste Vertretungen zuerst</option>
          </Select>
        </Feld>
        </span>
      </>}
      fuss={<>
        <span>{mehrzahl(liste.length, 'Lehrkraft', 'Lehrkräfte')}</span>
        {spalte >= 0 ? <span data-testid="frei-in-stunde">{`${auswahl!.stunde}. Std.: ${freiInSpalte} frei`}</span> : null}
        <FussText rechts>
          <span className="ta-legende" aria-label="Legende" title={spalte >= 0 && schreiben ? 'Doppelklick auf eine freie Zelle der markierten Stunde weist die Lehrkraft zu' : 'Eine offene Stunde wählen, um ihre Spalte hervorzuheben'}>
            <span><i className="ta-z U" />Unterricht</span><span><i className="ta-z V" />vertritt</span><span><i className="ta-z B" />Bereitschaft</span>
            <span><i className="ta-z X" />freigesetzt</span><span><i className="ta-z H" />Hohlstunde</span><span><i className="ta-z A" />abwesend</span>
          </span>
        </FussText>
      </>}>
      {!daten ? null : !daten.unterrichtstag ? <Leer text="An diesem Tag findet kein Unterricht statt." /> : (
        <div ref={ref} className={s.rollen} data-testid="wer-ist-frei">
          <div className="ta-matrix" style={{ minWidth: 150 + breiteStunden + 96, ['--ta-std' as string]: daten.stunden.length }}>
            <div className="ta-mkopf" role="row">
              <span className="ta-mname" role="columnheader">Lehrkraft</span>
              {daten.stunden.map((x, i) => <span key={x.nr} role="columnheader" className={mergeClasses('ta-mstd', i === spalte && 'markiert')} title={x.zeit}>{x.nr}</span>)}
              <span className="ta-mlast" role="columnheader" title="Vertretungen diese Woche · im Monat">W · M</span>
            </div>
            <div style={{ height: virt.getTotalSize(), position: 'relative' }}>
              {virt.getVirtualItems().map((v) => {
                const l = liste[v.index]!;
                const maxW = l.maxWoche || 3;
                return (
                  <div key={l.id} role="row" className={mergeClasses('ta-mzeile', zeile === l.id && 'gewaehlt')} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 28, transform: `translateY(${v.start}px)` }}
                    onClick={() => { setZeile(l.id); melden('element', { typ: 'lehrer', id: l.id, quelle: a.id }); }}>
                    <span className="ta-mname" title={l.name}><b>{l.k}</b> {l.name}</span>
                    {l.zellen.map(([c, t], i) => (
                      <span key={i} role="cell" className={mergeClasses('ta-z', c, i === spalte && 'markiert', i === spalte && FREI.has(c) && schreiben && 'waehlbar')}
                        title={`${daten.stunden[i]!.nr}. Std. (${daten.stunden[i]!.zeit}): ${CODE[c]?.titel ?? c}${t ? ` – ${t}` : ''}`}
                        onDoubleClick={(e) => { if (i === spalte) { e.stopPropagation(); zuweisen(l); } }}>{c === 'U' || c === 'V' ? t.split(' ')[0] : CODE[c]?.text}</span>
                    ))}
                    <span className="ta-mlast" title={`Diese Woche ${l.woche}${l.maxWoche ? ` von höchstens ${l.maxWoche}` : ''}, im Monat ${l.monat}, heute ${l.heute}`}>
                      <span className={mergeClasses('ta-balken', l.maxWoche > 0 && l.woche >= l.maxWoche && 'voll')}><i style={{ width: `${Math.min(100, Math.round((l.woche / maxW) * 100))}%` }} /></span>
                      <span className="ta-last-text">{`${l.woche} · ${l.monat}`}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </AnsichtRahmen>
  );
}
