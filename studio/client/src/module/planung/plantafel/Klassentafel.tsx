// Plantafel „Klasse“: Wochenplan einer Klasse (Ziehen, Kontextmenü, Tastatur wie im Stundenplan), rechts die offenen Blöcke der
// Klasse, darunter die verknüpften Pläne der gewählten bzw. gezogenen Stunde: nur die Lehrkräfte dieses Unterrichts und seine
// Räume. Beim Ziehen zeigen Klassenplan und verknüpfte Pläne dieselben Zielstufen (frei, Tausch, Hinweis, hart).
import { useDndMonitor, useDraggable, useDroppable } from '@dnd-kit/core';
import { Button } from '@fluentui/react-components';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/api/client';
import { useAnsicht } from '@/kern/ansichten';
import { useDaten } from '@/kern/laden';
import { fehlerMelden } from '@/komponenten/hinweise';
import { menue } from '@/komponenten/menue';
import {
  Stundenplanraster, type Stundenplan, type StundenplanrasterApi, type StundeZiehen,
} from '@/komponenten/raster/Stundenplanraster';
import type { AblageDaten, ZiehDaten } from '@/komponenten/ziehen';
import * as planung from '../aktionen';
import { kartenText, zieleLaden, type Aufbereitet, type Karte, type TafelDaten, type TafelUnterricht, type Ziele } from './daten';

export interface KlassenAuswahl { u: number; tag?: number; stunde?: number }

function KlassenVorratChip({ rasterId, u, laenge, anzahl, daten, klasse, ziehbar, farben }: { farben: boolean; rasterId: string; u: TafelUnterricht; laenge: number; anzahl: number; daten: TafelDaten; klasse: number; ziehbar: boolean }) {
  const t = kartenText(u, 'klasse', klasse, daten);
  const d: ZiehDaten = { art: 'unterricht', raster: rasterId, u: u.u, laenge, vorschau: () => <div className="pt-vorschau"><b>{t.fach}</b>{t.zweit ? ` · ${t.zweit}` : ''}{laenge > 1 ? ` · ${laenge} Std.` : ''}</div> };
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: `kv|${rasterId}|${u.u}|${laenge}`, data: d, disabled: !ziehbar });
  return (
    <div ref={setNodeRef} {...(ziehbar ? listeners : {})} {...(ziehbar ? attributes : {})} className={`pt-kchip${isDragging ? ' zieht' : ''}`} data-vorrat={u.u} data-laenge={laenge}
      style={t.farbe && farben ? { ['--fachfarbe' as string]: t.farbe } : undefined} title={`${t.titel}${ziehbar ? '\nIn den Plan ziehen' : ''}`}>
      <span className="f">{t.fach}</span>
      <span className="z">{t.zweit}</span>
      <span className="l">{anzahl > 1 ? `${anzahl} × ` : ''}{laenge === 1 ? 'Einzelstunde' : laenge === 2 ? 'Doppelstunde' : `${laenge}er-Block`}</span>
    </div>
  );
}

/** Kleiner, verknüpfter Plan (Lehrkraft bzw. Raum) mit hervorgehobenem Unterricht und den Zielstufen des laufenden Zugs. */
function VerknuepfterPlan({ typ, id, name, u, ziele, version }: { typ: 'lehrer' | 'raum'; id: number; name: string; u: number; ziele: Ziele | null; version: number }) {
  const { daten: plan } = useDaten(() => api.get<Stundenplan>(api.dok(`/stundenplan/${typ}/${id}`)), [typ, id, version]);
  const rid = `pt-vk-${typ}-${id}`;
  return (
    <section className="pt-vk" aria-label={`${typ === 'lehrer' ? 'Lehrkraft' : 'Raum'} ${name}`} data-verknuepft={`${typ}:${id}`}>
      <style>{`[data-raster="${rid}"] .ra-eintrag[data-u="${u}"] { box-shadow: 0 0 0 2px var(--colorBrandStroke1); z-index: 2; }`}</style>
      <h3 className="pt-vk-kopf"><span className="art">{typ === 'lehrer' ? 'Lehrkraft' : 'Raum'}</span> {name}{plan?.element.lang && plan.element.lang !== name ? <span className="lang">{plan.element.lang}</span> : null}</h3>
      <Stundenplanraster id={rid} plan={plan ?? null} typ={typ} kompakt
        feldKlasse={ziele ? (tag, stunde) => { const s = ziele.stufen[tag]?.[stunde - 1]; return s ? `pt-zf-${s}` : null; } : undefined} />
    </section>
  );
}

export function Klassentafel({ daten, auf, farben, element, version, schreiben, auswahl, setAuswahl, neuLaden, beiNeu }: {
  daten: TafelDaten; auf: Aufbereitet; farben: boolean; element: number; version: number; schreiben: boolean;
  auswahl: KlassenAuswahl | null; setAuswahl: (a: KlassenAuswahl | null) => void; neuLaden: () => Promise<void>; beiNeu: () => void;
}) {
  const a = useAnsicht();
  const raster = useRef<StundenplanrasterApi>(null);
  const rasterId = `pt-klasse-${a.id}`;
  const { daten: plan, neuLaden: planNeu } = useDaten(() => api.get<Stundenplan>(api.dok(`/stundenplan/klasse/${element}`)), [element, version]);
  const planRef = useRef(plan); planRef.current = plan;
  const [ziehZiele, setZiehZiele] = useState<Ziele | null>(null);
  const [ziehU, setZiehU] = useState<number | null>(null);

  const nachAenderung = async () => { await neuLaden(); await planNeu(true); };
  const ctx = useMemo<planung.PlanKontext>(() => ({
    id: a.id, typ: 'klasse', schreiben, raster: () => raster.current, plan: () => planRef.current ?? null, element: () => element,
    planen: () => schreiben, neuLaden: nachAenderung, oeffnen: (t, x) => a.oeffnen(t, x as never),
  }), [a, schreiben, element]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => planung.planAnmelden(ctx), [ctx]);

  // Zielstufen auch für die verknüpften Pläne (dieselbe Anfrage wie der Klassenplan, aus dem Speicher)
  const zielAngabe = (d: StundeZiehen) => (d.tag !== undefined ? { u: d.u, tag: d.tag, stunde: d.stunde, einzeln: d.einzeln } : { u: d.u, laenge: d.laenge || 1 });
  useDndMonitor({
    onDragStart: (ev) => {
      const d = ev.active.data.current as ZiehDaten | undefined;
      if (!d || d.raster !== rasterId || (d.art !== 'stunde' && d.art !== 'unterricht')) return;
      const z: StundeZiehen = d.art === 'stunde' ? { u: d.u as number, tag: d.tag as number, stunde: d.stunde as number, einzeln: !!d.einzeln } : { u: d.u as number, laenge: (d.laenge as number) || 1 };
      setZiehU(z.u);
      zieleLaden(zielAngabe(z), version).then((x) => setZiehZiele(x)).catch(() => {});
    },
    onDragEnd: () => { setZiehU(null); setZiehZiele(null); },
    onDragCancel: () => { setZiehU(null); setZiehZiele(null); },
  });

  const klasse = daten.zeilen.find((z) => z.id === element);
  const offene = daten.unterrichte.filter((u) => u.offen.length && u.klassen.includes(element));
  const offenStunden = offene.reduce((x, u) => x + u.offen.reduce((s, b) => s + b, 0), 0);

  // verknüpfte Pläne: Lehrkräfte des gewählten bzw. gezogenen Unterrichts und seine Räume
  const uid = ziehU ?? auswahl?.u ?? null;
  const u = uid != null ? auf.uMap.get(uid) : undefined;
  const raeume = useMemo(() => {
    if (!u) return [];
    const karten = auf.kartenVon.get(u.u) || [];
    const k = auswahl?.tag !== undefined ? karten.find((x) => x.tag === auswahl.tag && auswahl.stunde! >= x.von && auswahl.stunde! < x.von + x.laenge) : undefined;
    return [...new Set((k ? k.raeume : karten.flatMap((x) => x.raeume)))].slice(0, 2);
  }, [u, auf, auswahl]);

  // Ablage rechts: Stunde aus dem Plan hierher ziehen = entplanen
  const ablage: AblageDaten = {
    annehmen: (d) => d.art === 'stunde' && d.raster === rasterId && schreiben,
    ablegen: (d) => {
      const karte: Karte | undefined = (auf.kartenVon.get(d.u as number) || []).find((k) => k.tag === d.tag && (d.stunde as number) >= k.von && (d.stunde as number) < k.von + k.laenge);
      if (!karte) return;
      const stunden = d.einzeln ? [d.stunde as number] : Array.from({ length: karte.laenge }, (_, i) => karte.von + i);
      void planung.entplanen(stunden.map((s) => ({ u: karte.u, tag: karte.tag, stunde: s, e: { fix: karte.teilFix } as never })), a.id).then((ok) => (ok ? nachAenderung() : undefined)).catch(fehlerMelden);
    },
  };
  const { setNodeRef: ablageRef, isOver } = useDroppable({ id: `pt-kvorrat-${a.id}`, data: ablage, disabled: !schreiben });

  return (
    <div className={`pt-klasse${farben ? '' : ' ohne-farben'}`} data-testid="klassentafel">
      <div className="pt-k-haupt">
        <div className="pt-k-plan" onFocus={() => planung.planAktivieren(ctx)}>
          <Stundenplanraster ref={raster} id={rasterId} plan={plan ?? null} typ="klasse" ziehen={schreiben} mehrfach
            zielstatus={async (d) => { const z = await zieleLaden(zielAngabe(d), version); return { status: z.stufen, gruende: z.gruende }; }}
            beiAblegen={(d) => { void planung.ablegen(d, a.id).then((ok) => (ok ? nachAenderung() : undefined)).catch(fehlerMelden); }}
            beiKlick={(e, tag, stunde) => setAuswahl({ u: e.u, tag, stunde })}
            beiDoppelklick={() => a.oeffnen('unterricht', { sicht: 'klasse', element })}
            kontextmenue={(e, tag, stunde, ev) => { setAuswahl({ u: e.u, tag, stunde }); menue(ev.clientX, ev.clientY, planung.kontextEintraege(ctx, e, tag, stunde)); }}
            feldKontextmenue={(_, __, ev) => menue(ev.clientX, ev.clientY, planung.feldEintraege(ctx))}
            onKeyDown={(ev) => { if (planung.taste(ctx, ev)) { ev.preventDefault(); ev.stopPropagation(); } }} />
        </div>
        <aside ref={ablageRef} className={`pt-k-vorrat${isOver ? ' drueber' : ''}`} aria-label={`Offene Stunden der Klasse ${klasse?.kurz ?? ''}`} data-testid="klassenvorrat">
          <div className="pt-k-vkopf">
            <h2>Offen</h2>
            <span className="pt-vzahl">{offenStunden ? `${offenStunden} ${offenStunden === 1 ? 'Stunde' : 'Stunden'}` : 'keine'}</span>
          </div>
          <div className="pt-k-vliste">
            {!offene.length ? <p className="pt-vleer">Alle Stunden der Klasse {klasse?.kurz} sind verplant.</p> : null}
            {offene.flatMap((x) => [...new Set(x.offen)].sort((p, q) => q - p).map((l) => (
              <KlassenVorratChip key={`${x.u}-${l}`} rasterId={rasterId} u={x} laenge={l} anzahl={x.offen.filter((b) => b === l).length} daten={daten} klasse={element} ziehbar={schreiben} farben={farben} />
            )))}
          </div>
          {schreiben ? <div className="pt-k-vfuss"><Button size="small" onClick={beiNeu}>Neuer Unterricht</Button></div> : null}
        </aside>
      </div>
      <div className="pt-k-verknuepft" aria-label="Verknüpfte Pläne" data-testid="verknuepft">
        {u ? <>
          <div className="pt-k-vtitel">{(() => { const t = kartenText(u, 'klasse', element, daten); return <><b>{t.fach}</b> {u.klassen.map((k) => daten.namen.klassen[k]).join(', ')} · U-Nr. {u.u}{t.gekoppelt ? ' · gekoppelt' : ''}</>; })()}</div>
          <div className="pt-k-vplaene">
            {u.lehrer.map((l) => <VerknuepfterPlan key={`l${l}`} typ="lehrer" id={l} name={daten.namen.lehrer[l] ?? '?'} u={u.u} ziele={ziehU === u.u ? ziehZiele : null} version={version} />)}
            {raeume.map((r) => <VerknuepfterPlan key={`r${r}`} typ="raum" id={r} name={daten.namen.raeume[r] ?? '?'} u={u.u} ziele={ziehU === u.u ? ziehZiele : null} version={version} />)}
            {!u.lehrer.length && !raeume.length ? <p className="pt-vleer">Der Unterricht hat weder Lehrkraft noch Raum.</p> : null}
          </div>
        </> : <p className="pt-vleer">Eine Stunde anklicken oder ziehen: hier erscheinen die Pläne ihrer Lehrkräfte und Räume.</p>}
      </div>
    </div>
  );
}

