// Stundenplan je Klasse, Lehrkraft, Raum oder Fach (Wochenraster, Blöcke, Kopplungen nebeneinander). Planen-Modus: Stunden
// und Blöcke per Drag & Drop verschieben/tauschen, nicht verplante Blöcke setzen, Mehrfachauswahl, Planungsaktionen in der
// Werkzeugleiste und im Kontextmenü (fixieren, Raum, Tausch, entplanen) – Logik in module/planung/aktionen.tsx.
// Umschalter „Einzelplan | Blockansicht“: mehrere Pläne kompakt als Kacheln (Blockansicht.tsx, Parameter block=true).
import { useDraggable } from '@dnd-kit/core';
import { MoreHorizontal20Regular } from '@fluentui/react-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/api/client';
import { useAnsicht, type AnsichtProps } from '@/kern/ansichten';
import { melden, useEreignis } from '@/kern/ereignisse';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben, useStudio } from '@/kern/zustand';
import { AnsichtRahmen, ElementAuswahl, FussText, Rechts, Schalter, Segmente, Trenner, Werkzeug } from '@/komponenten/ansicht';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { MenueKnopf, menue } from '@/komponenten/menue';
import { Stundenplanraster, type NichtVerplant, type Stundenplan, type StundenplanrasterApi } from '@/komponenten/raster/Stundenplanraster';
import type { ZiehDaten } from '@/komponenten/ziehen';
import { befehl, seiteOeffnen } from '@/kern/befehle';
import { ersterOder, useElemente } from '../gemeinsam';
import * as planung from '../planung/aktionen';
import Blockansicht from './Blockansicht';

const TYPEN: Record<string, string> = { klasse: 'Klasse', lehrer: 'Lehrkraft', raum: 'Raum', fach: 'Fach' };

function NvChip({ rasterId, n, laenge, anzahl, ziehbar, kontext }: { rasterId: string; n: NichtVerplant; laenge: number; anzahl: number; ziehbar: boolean; kontext: (e: React.MouseEvent) => void }) {
  const daten: ZiehDaten = { art: 'unterricht', raster: rasterId, u: n.u, laenge, vorschau: () => <div className="ra-vorschau"><b>{n.text}</b>{laenge > 1 ? ` · ${laenge}-stündig` : ''}</div> };
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: `${rasterId}|nv|${n.u}|${laenge}`, data: daten, disabled: !ziehbar });
  return (
    <span ref={setNodeRef} {...(ziehbar ? listeners : {})} {...(ziehbar ? attributes : {})} className={`ra-nv-chip${ziehbar ? ' ziehbar' : ''}`} style={isDragging ? { opacity: 0.4 } : undefined}
      title={`Unterricht Nr. ${n.u}: ${n.anzahl === 1 ? '1 Stunde' : `${n.anzahl} Stunden`} nicht verplant${laenge > 1 ? ` – Block mit ${laenge} Stunden` : ''}${ziehbar ? ' – in den Plan ziehen' : ''}`}
      onContextMenu={(e) => { e.preventDefault(); kontext(e); }} data-nv={n.u}>
      <span className="anzahl">{anzahl}×</span><span>{n.text}</span>{laenge > 1 ? <span className="laenge">{laenge}-stündig</span> : null}
    </span>
  );
}

export default function StundenplanSeite({ p }: AnsichtProps) {
  const typ = TYPEN[String(p.typ)] ? String(p.typ) : 'klasse';
  return p.block ? <Blockansicht p={p} typ={typ} /> : <StundenplanAnsicht p={p} />;
}

function StundenplanAnsicht({ p }: AnsichtProps) {
  const a = useAnsicht();
  const typ = TYPEN[String(p.typ)] ? String(p.typ) : 'klasse';
  const schreiben = useDarfSchreiben();
  const liste = useElemente(typ);
  const element = ersterOder(liste, p.element);
  const verknuepft = p.verknuepft !== false;
  const planen = schreiben && p.planen !== false;
  const kompakt = !!p.kompakt;
  const raster = useRef<StundenplanrasterApi>(null);
  const [markiert, setMarkiert] = useState(0);
  const grunddaten = useStudio((x) => x.grunddaten);

  const { daten: plan, laedt, neuLaden } = useDaten(() => api.get<Stundenplan>(api.dok(`/stundenplan/${typ}/${element}`)), [typ, element, grunddaten],
    { bereiche: ['Stundenplan', 'Unterricht', 'Stammdaten'], quelle: a.id, aktiv: element != null });
  const planRef = useRef(plan); planRef.current = plan;

  useEffect(() => { if (element != null && p.element !== element) a.parameterSetzen({ element }); }, [element]); // eslint-disable-line react-hooks/exhaustive-deps
  useEreignis('element', (e) => { if (verknuepft && e.quelle !== a.id && e.typ === typ && e.id !== element) a.parameterSetzen({ element: e.id }); });

  const ctx = useMemo<planung.PlanKontext>(() => ({
    id: a.id, typ, schreiben, raster: () => raster.current, plan: () => planRef.current ?? null, element: () => element,
    planen: () => planen, neuLaden: () => neuLaden(true), oeffnen: (t, x) => a.oeffnen(t, x as never),
  }), [a, typ, schreiben, element, planen, neuLaden]);
  useEffect(() => planung.planAnmelden(ctx), [ctx]);

  const planAktion = async (f: () => Promise<boolean>) => { if (await f()) await neuLaden(true); };
  const mitStunde = (f: (x: NonNullable<ReturnType<StundenplanrasterApi['auswahl']>>) => Promise<boolean>) => {
    const x = raster.current?.auswahl();
    if (!x) { hinweis('Bitte zuerst eine Stunde anklicken.', 'warnung'); return Promise.resolve(); }
    return planAktion(() => f(x));
  };
  const unterrichtOeffnen = () => a.oeffnen('unterricht', { sicht: typ === 'raum' || typ === 'fach' ? 'alle' : typ, element: typ === 'raum' || typ === 'fach' ? undefined : element ?? undefined });

  const summe = plan ? plan.zellen.reduce((x, z) => x + new Set(z.eintraege.map((e) => e.u)).size, 0) : 0;
  const nvSumme = plan ? plan.nichtVerplant.reduce((x, n) => x + n.anzahl, 0) : 0;
  const titel = plan ? `${TYPEN[typ]} ${plan.element.kurz}${plan.element.lang && plan.element.lang !== plan.element.kurz && !plan.element.lang.includes(plan.element.kurz) ? ` (${plan.element.lang})` : ''} – Stundenplan` : 'Stundenplan';

  return (
    <AnsichtRahmen titel={titel} laden={laedt && !plan}
      werkzeuge={<>
        <Segmente titel="Darstellung" testid="plan-darstellung" wert="einzel"
          beiWahl={() => (a.lage === 'seite' ? a.parameterSetzen({ block: true }) : seiteOeffnen('stundenplan', { typ, block: true, element: element ?? undefined }))}
          optionen={[{ wert: 'einzel', text: 'Einzelplan', titel: 'Ein Plan mit allen Angaben' }, { wert: 'block', text: 'Blockansicht', titel: a.lage === 'seite' ? 'Mehrere Pläne kompakt neben- und untereinander' : 'Blockansicht als eigene Seite öffnen' }]} />
        <Trenner />
        <ElementAuswahl typ={typ} liste={liste} wert={element} beiWahl={(id) => { a.parameterSetzen({ element: id }); melden('element', { typ: typ, id, quelle: a.id }); }} />
        <Trenner />
        {schreiben ? <>
          <Werkzeug text="Planen" titel="Planen-Modus: Stunden per Drag & Drop verschieben und setzen" gedrueckt={planen} aktion={() => a.parameterSetzen({ planen: !planen })} />
          <Werkzeug text="Fixieren" titel="Markierte Stunden fixieren bzw. lösen (F)" aktion={() => planAktion(() => planung.fixieren(raster.current?.markierte() || [], a.id))} />
          <Werkzeug text="Raum" titel="Raum der Stunde zuordnen oder entfernen" aktion={() => mitStunde((x) => planung.raumDialog(x, a.id))} />
          <Werkzeug text="Tauschen" titel="Tauschvorschläge für die Stunde" aktion={() => mitStunde((x) => planung.tauschDialog(x, a.id))} />
          <Werkzeug text="Entplanen" titel="Markierte Stunden entplanen (Entf)" aktion={() => planAktion(() => planung.entplanen(raster.current?.markierte() || [], a.id))} />
          <Trenner />
        </> : null}
        {typ !== 'raum' ? <Werkzeug text="Unterricht" titel="Unterricht des Elements" aktion={unterrichtOeffnen} /> : null}
        <MenueKnopf text="" icon={<MoreHorizontal20Regular />} titel="Weitere Aktionen" eintraege={() => [
          { text: 'Kompakte Darstellung', haken: kompakt, aktion: () => a.parameterSetzen({ kompakt: !kompakt }) },
          null,
          { text: 'Zeitwünsche', aktion: () => a.oeffnen('zeitwuensche', { typ, element: element ?? undefined }) },
          { text: 'Diagnose', aktion: () => befehl('optimierung.diagnose') },
          schreiben ? null : undefined,
          schreiben ? { text: 'Alle Stunden markieren', taste: 'Strg+A', aktion: () => raster.current?.alleMarkieren() } : undefined,
        ]} />
        <Rechts><Schalter text="Auswahl folgen" an={verknuepft} beiAenderung={(x) => a.parameterSetzen({ verknuepft: x })} titel="Zeigt das Element, das in einer anderen Ansicht gewählt wird" /></Rechts>
      </>}
      fuss={<>
        <span>{summe} Stunden verplant</span>
        {nvSumme ? <span>{nvSumme} nicht verplant</span> : null}
        {planen ? <span>Planen: Stunden ziehen · Entf entplant · F fixiert</span> : null}
        {markiert ? <span>{markiert} Stunden markiert</span> : null}
        <FussText rechts>{plan?.periode}</FussText>
      </>}>
      <div onFocus={() => planung.planAktivieren(ctx)} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <Stundenplanraster ref={raster} id={`plan-${a.id}`} plan={plan ?? null} typ={typ} kompakt={kompakt} ziehen={planen} mehrfach
          zielstatus={(d) => planung.zielstatus(d)}
          beiAblegen={(d) => { void planung.ablegen(d, a.id).then((ok) => (ok ? neuLaden(true) : undefined)).catch(fehlerMelden); }}
          beiDoppelklick={() => unterrichtOeffnen()}
          kontextmenue={(e, tag, stunde, ev) => menue(ev.clientX, ev.clientY, planung.kontextEintraege(ctx, e, tag, stunde))}
          feldKontextmenue={(_, __, ev) => menue(ev.clientX, ev.clientY, planung.feldEintraege(ctx))}
          beiMarkierung={(m) => setMarkiert(m.length)}
          onKeyDown={(ev) => { if (planung.taste(ctx, ev)) { ev.preventDefault(); ev.stopPropagation(); } }} />
        {plan?.nichtVerplant.length ? (
          <div className="ra-nv" aria-label="Nicht verplante Stunden">
            <span className="ra-nv-titel" title={planen ? 'In den Plan ziehen, um die Stunden zu verplanen' : undefined}>Nicht verplant</span>
            {plan.nichtVerplant.flatMap((n) => {
              const bloecke = n.bloecke?.length ? n.bloecke : Array<number>(n.anzahl).fill(1);
              const laengen = [...new Set(bloecke)].sort((x, y) => y - x);
              return laengen.map((laenge) => (
                <NvChip key={`${n.u}-${laenge}`} rasterId={`plan-${a.id}`} n={n} laenge={laenge} anzahl={bloecke.filter((b) => b === laenge).length} ziehbar={planen}
                  kontext={(ev) => menue(ev.clientX, ev.clientY, [
                    { titel: `Unterricht Nr. ${n.u}` },
                    { text: 'Unterricht bearbeiten …', aktion: unterrichtOeffnen },
                    { text: 'Zeitwünsche des Unterrichts', aktion: () => a.oeffnen('zeitwuensche', { typ: 'unterricht', element: n.u }) },
                  ])} />
              ));
            })}
          </div>
        ) : null}
      </div>
    </AnsichtRahmen>
  );
}
