// Blockansicht der Stundenpläne: mehrere Pläne eines Elementtyps (z. B. alle Klassen eines Jahrgangs) als Kacheln neben- und
// untereinander, mit kompakten Feldern; gleiche Folgestunden sind wie im Einzelplan zu Blöcken zusammengefasst, Kopplungen
// stehen nebeneinander. Auswahl: Liste (Mehrfachauswahl, durchsuchbar) und Schnellauswahl nach Gruppe (Jahrgang, Abteilung,
// Raumart). Klick auf einen Kachelkopf bzw. Doppelklick auf eine Stunde öffnet den Einzelplan; „Drucken“ gibt die Kacheln aus
// (Querformat, mehrere Pläne je Seite). Server: GET /stundenplan/{typ}/block?ids=.
import { DndContext } from '@dnd-kit/core';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/api/client';
import type { Zeitraster } from '@/api/typen';
import { useAnsicht, type AnsichtProps } from '@/kern/ansichten';
import { melden } from '@/kern/ereignisse';
import { useDaten } from '@/kern/laden';
import { useStudio } from '@/kern/zustand';
import { AnsichtRahmen, Feld, FussText, Leer, Rechts, Segmente, Trenner, Werkzeug } from '@/komponenten/ansicht';
import { MenueKnopf } from '@/komponenten/menue';
import { Stundenplanraster, type PlanZelle, type Stundenplan } from '@/komponenten/raster/Stundenplanraster';
import { SuchAuswahl } from '@/komponenten/suchauswahl';
import './stundenplan.css';

const TYPEN: Record<string, { einzahl: string; mehrzahl: string; gruppe: string }> = {
  klasse: { einzahl: 'Klasse', mehrzahl: 'Klassen', gruppe: 'Jahrgang' },
  lehrer: { einzahl: 'Lehrkraft', mehrzahl: 'Lehrkräfte', gruppe: 'Abteilung' },
  raum: { einzahl: 'Raum', mehrzahl: 'Räume', gruppe: 'Raumart' },
  fach: { einzahl: 'Fach', mehrzahl: 'Fächer', gruppe: 'Gruppe' },
};

interface BlockElement { id: number; kurz: string; lang: string; gruppe: string }
interface BlockPlan { element: { id: number; typ: string; kurz: string; lang: string }; zellen: PlanZelle[]; nichtVerplant: number }
interface BlockDaten { zeitraster: Zeitraster; periode: string; alle: BlockElement[]; plaene: BlockPlan[] }

const SPALTEN = [['auto', 'Automatisch'], ['2', '2 je Zeile'], ['3', '3 je Zeile'], ['4', '4 je Zeile'], ['6', '6 je Zeile']] as const;

function Kachel({ plan, zeitraster, d, typ, oeffnen, rasterId }: { plan: BlockPlan; zeitraster: Zeitraster; d: BlockDaten; typ: string; oeffnen: (id: number) => void; rasterId: string }) {
  const sp = useMemo<Stundenplan>(() => ({ element: plan.element, zeitraster, zellen: plan.zellen, nichtVerplant: [], periode: d.periode }), [plan, d, zeitraster]);
  const stunden = plan.zellen.reduce((x, z) => x + new Set(z.eintraege.map((e) => e.u)).size, 0);
  const lang = plan.element.lang && plan.element.lang !== plan.element.kurz && !plan.element.lang.includes(plan.element.kurz) ? plan.element.lang : '';
  return (
    <section className="sp-kachel" aria-label={`${TYPEN[typ]?.einzahl} ${plan.element.kurz}`} data-element={plan.element.id}>
      <button type="button" className="sp-kachel-kopf" onClick={() => oeffnen(plan.element.id)} title="Einzelplan öffnen">
        <span className="kurz">{plan.element.kurz}</span>
        {lang ? <span className="lang">{lang}</span> : null}
        <span className="zahl">{`${stunden} Std.${plan.nichtVerplant ? ` · ${plan.nichtVerplant} offen` : ''}`}</span>
      </button>
      <Stundenplanraster id={`${rasterId}-${plan.element.id}`} plan={sp} typ={typ} kompakt
        beiKlick={() => melden('element', { typ, id: plan.element.id, quelle: rasterId })}
        beiDoppelklick={() => oeffnen(plan.element.id)} />
    </section>
  );
}

export default function Blockansicht({ p, typ }: AnsichtProps & { typ: string }) {
  const a = useAnsicht();
  const t = TYPEN[typ] || TYPEN.klasse!;
  const grunddaten = useStudio((x) => x.grunddaten);
  const auswahl = p.elemente == null ? null : String(p.elemente);
  const spalten = String(p.spalten || 'auto');
  const [drucken, setDrucken] = useState(false);
  const ids = auswahl === null ? '-1' : auswahl === 'alle' ? '' : auswahl;
  const { daten: d, laedt } = useDaten(() => api.get<BlockDaten>(api.dok(`/stundenplan/${typ}/block?ids=${encodeURIComponent(ids)}`)), [typ, ids, grunddaten],
    { bereiche: ['Stundenplan', 'Unterricht', 'Stammdaten'], quelle: a.id });

  const gruppen = useMemo(() => {
    const m = new Map<string, BlockElement[]>();
    for (const e of d?.alle || []) if (e.gruppe) m.set(e.gruppe, [...(m.get(e.gruppe) || []), e]);
    return [...m.entries()].sort((x, y) => x[0].localeCompare(y[0], 'de', { numeric: true }));
  }, [d?.alle]);

  // erste Auswahl: Gruppe des gewählten Elements, sonst die erste Gruppe, sonst die ersten acht
  useEffect(() => {
    if (auswahl !== null || !d) return;
    const aktuell = d.alle.find((e) => e.id === Number(p.element));
    const g = (aktuell?.gruppe && gruppen.find(([k]) => k === aktuell.gruppe)) || gruppen[0];
    const liste = g && g[1].length > 1 ? g[1] : d.alle.slice(0, 8);
    a.parameterSetzen({ elemente: liste.map((e) => e.id).join(',') || 'alle' });
  }, [auswahl, d, gruppen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!drucken) return;
    const fertig = () => setDrucken(false);
    window.addEventListener('afterprint', fertig);
    const z = setTimeout(() => window.print(), 300);
    return () => { clearTimeout(z); window.removeEventListener('afterprint', fertig); };
  }, [drucken]);

  const setzen = (liste: number[] | 'alle') => a.parameterSetzen({ elemente: liste === 'alle' ? 'alle' : liste.join(',') || 'alle' });
  const gewaehlt = auswahl === 'alle' ? (d?.alle || []).map((e) => String(e.id)).join(',') : auswahl || '';
  const oeffnen = (id: number) => a.parameterSetzen({ block: false, element: id });
  const plaene = d?.plaene || [];
  // dichter: Stunden nach der letzten belegten Stunde aller gezeigten Pläne weglassen (mindestens sechs)
  const zeitraster = useMemo<Zeitraster | null>(() => {
    if (!d) return null;
    const letzte = Math.max(0, ...plaene.flatMap((pl) => pl.zellen.filter((z) => z.eintraege.length).map((z) => z.stunde)));
    const n = d.zeitraster.stunden.findIndex((st) => st.nr === letzte) + 1;
    const bis = Math.min(d.zeitraster.stunden.length, Math.max(n, 6));
    return { ...d.zeitraster, stunden: d.zeitraster.stunden.slice(0, bis), belegung: d.zeitraster.belegung?.map((t) => t.slice(0, bis)) };
  }, [d, plaene]);
  const stil = spalten === 'auto' ? undefined : { gridTemplateColumns: `repeat(${spalten}, minmax(0, 1fr))` };
  const kacheln = (id: string) => d && zeitraster ? plaene.map((pl) => <Kachel key={pl.element.id} plan={pl} zeitraster={zeitraster} d={d} typ={typ} oeffnen={oeffnen} rasterId={id} />) : null;

  return (
    <AnsichtRahmen titel={`${t.mehrzahl} – Blockansicht`} laden={laedt && !d}
      werkzeuge={<>
        <Segmente titel="Darstellung" testid="plan-darstellung" wert="block" beiWahl={() => a.parameterSetzen({ block: false })}
          optionen={[{ wert: 'einzel', text: 'Einzelplan', titel: 'Ein Plan mit allen Angaben' }, { wert: 'block', text: 'Blockansicht', titel: 'Mehrere Pläne kompakt neben- und untereinander' }]} />
        <Trenner />
        <Feld titel={t.mehrzahl}>
          <SuchAuswahl mehrfach size="small" className="sp-block-wahl" ariaLabel={`${t.mehrzahl} der Blockansicht`} platzhalter={`${t.mehrzahl} wählen`}
            wert={(d?.alle || []).filter((e) => gewaehlt.split(',').includes(String(e.id))).map((e) => e.kurz).join(',')}
            beiWahl={(w) => { const k = w.split(',').filter(Boolean); setzen((d?.alle || []).filter((e) => k.includes(e.kurz)).map((e) => e.id)); }}
            optionen={(d?.alle || []).map((e) => ({ wert: e.kurz, kurz: e.kurz, text: e.lang && e.lang !== e.kurz ? `${e.kurz} – ${e.lang}` : e.kurz }))} />
        </Feld>
        <MenueKnopf text="Schnellauswahl" titel={`${t.mehrzahl} nach ${t.gruppe} wählen`} eintraege={() => [
          { text: `Alle ${t.mehrzahl}`, aktion: () => setzen('alle') },
          gruppen.length ? null : undefined,
          gruppen.length ? { titel: t.gruppe } : undefined,
          ...gruppen.map(([g, l]) => ({ text: `${g} (${l.length})`, aktion: () => setzen(l.map((e) => e.id)) })),
        ]} />
        <MenueKnopf text="Anordnung" eintraege={() => SPALTEN.map(([w, text]) => ({ text, haken: spalten === w, aktion: () => a.parameterSetzen({ spalten: w === 'auto' ? undefined : w }) }))} />
        <Trenner />
        <Werkzeug text="Drucken" titel="Die gezeigten Pläne drucken (Querformat, mehrere je Seite)" deaktiviert={!plaene.length} aktion={() => setDrucken(true)} />
        <Rechts><span className="sp-leise">{d ? `${plaene.length} von ${d.alle.length} ${t.mehrzahl}` : ''}</span></Rechts>
      </>}
      fuss={<>
        <span>{`${plaene.length} ${plaene.length === 1 ? 'Plan' : 'Pläne'}`}</span>
        <span>Klick auf den Kopf einer Kachel oder Doppelklick auf eine Stunde öffnet den Einzelplan</span>
        <FussText rechts>{d?.periode}</FussText>
      </>}>
      {d && !plaene.length && auswahl !== null ? <Leer text={`Keine ${t.mehrzahl} gewählt – oben auswählen oder die Schnellauswahl nutzen.`} /> : null}
      {plaene.length ? <div className="sp-bloecke" style={stil} data-testid="blockansicht">{kacheln(`blk-${a.id}`)}</div> : null}
      {drucken && d ? createPortal(
        <DndContext>
          <div className="sp-druck">
            <h1>{`${t.mehrzahl} – Stundenpläne · ${d.periode}`}</h1>
            <div className="sp-bloecke" style={stil}>{kacheln(`druck-${a.id}`)}</div>
          </div>
        </DndContext>, document.body) : null}
    </AnsichtRahmen>
  );
}
