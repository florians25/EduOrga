// Offene Stunden (Tagesablauf, Schritt 2): Arbeitsliste der offenen Stunden des Planungstags nach Dringlichkeit – Klausuraufsicht
// zuerst, dann nach Uhrzeit und jüngere Klassen vor älteren. Jede Karte zeigt die drei besten Lehrkräfte mit Begründung (Lage,
// kennt Klasse, Fach), Belastung in Woche und Monat und Mehrarbeit (NRW); ein Klick bzw. 1–3 weist zu. Alternativen als
// Nebenaktionen: Entfall (E), Zusammenlegen/Betreuung (B), ohne Lehrkraft (O), Raum (R), Vorziehen, Vormerken. J/K bzw. ↓/↑
// blättern, V zeigt alle Kandidaten, F „Wer ist frei?“, P die Pläne. „Automatisch vorschlagen“ rechnet die Automatik als Probe
// und zeigt die Vorschläge zur Prüfung (alle oder einzeln übernehmen). Die Liste ist virtualisiert (100+ Stunden am Tag).
import { Button, Checkbox, Spinner, Switch, Tooltip, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { Keyboard20Regular } from '@fluentui/react-icons';
import { useVirtualizer } from '@tanstack/react-virtual';
import { memo, useEffect, useMemo, useRef, useState, type KeyboardEvent as RKeyboardEvent, type MouseEvent as RMouseEvent } from 'react';
import { api } from '@/api/client';
import { useEreignis } from '@/kern/ereignisse';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, FussText, Leer, Rechts, Trenner, Werkzeug } from '@/komponenten/ansicht';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { MenueKnopf, type MenueListe } from '@/komponenten/menue';
import { raumDialog } from '../dialoge';
import { auswahlMelden, tpKontextSetzen, tpSchrittSetzen, usePlanungsdatum, vpfad } from '../kern';
import { Umschalter } from '../steuer';
import {
  QUELLE, arbeitslisteLaden, auswahlSetzen, betreuen, blockSetzen, entfallen, kandidatenAnfordern, mehrzahl, ohneLehrkraft, probeLaden, raumZuweisen,
  stundenText, useKandidaten, vormerken, vorschlaegeAnwenden, zuruecksetzen, zuweisen,
  alleBetreuen, alleZuweisen, type BearbeiteteStunde, type Gemeinsam, type Kandidat, type KandidatenInfo, type OffeneStunde, type Probe,
} from './daten';
import { Sammelleiste } from './Sammelleiste';
import './ablauf.css';

const useStile = makeStyles({
  liste: { flex: 1, minHeight: 0, overflowY: 'auto', outline: 'none', backgroundColor: tokens.colorNeutralBackground2, padding: '8px 10px' },
  innen: { position: 'relative', width: '100%' },
});

/** Lage der Lehrkraft zur Stunde in Worten. */
function lageText(lage: string): string {
  if (!lage) return '';
  if (lage === 'sonst frei') return 'heute sonst frei';
  if (lage === 'anschließend') return 'schließt an';
  const m = lage.match(/^Abstand (\d+)$/);
  if (m) return `${m[1]} Std. Abstand`;
  return lage;
}

/** Belastung: Woche als kleiner Balken (gegen das Wochenmaximum der Lehrkraft, sonst 3), Monat als Zahl. */
function Last({ k }: { k: Kandidat }) {
  const max = k.maxWoche || 3;
  const anteil = Math.min(1, k.woche / max);
  const voll = k.maxWoche > 0 && k.woche >= k.maxWoche;
  const ma = k.mehrarbeitMonat;
  const titel = `Vertretungen diese Woche: ${k.woche}${k.maxWoche ? ` von höchstens ${k.maxWoche}` : ''}\nIm Monat: ${k.monat}${k.maxMonat ? ` von höchstens ${k.maxMonat}` : ''}`
    + (k.mehrarbeit ? `\nMehrarbeit im Monat: ${ma.geleistet} Std. (NRW: ab mehr als ${ma.grenze} Std. vergütungsfähig${ma.verguetung ? `, derzeit ${ma.verguetung}` : ''})` : '\nKeine Mehrarbeit (Bereitschaft bzw. freigesetzt)');
  return (
    <span className="ta-last" title={titel}>
      <span className="ta-last-text">{`W ${k.woche}`}</span>
      <span className={mergeClasses('ta-balken', voll && 'voll')} aria-hidden><i style={{ width: `${Math.round(anteil * 100)}%` }} /></span>
      <span className="ta-last-text">{`M ${k.monat}`}</span>
      {!k.mehrarbeit ? <span className="ta-ma frei">keine MA</span> : ma.geleistet ? <span className={mergeClasses('ta-ma', ma.geleistet + 1 > ma.grenze && 'ueber')}>{`MA ${ma.geleistet}`}</span> : <span className="ta-ma" />}
    </span>
  );
}

function KandidatZeile({ k, nr, aktiv, beiWahl }: { k: Kandidat; nr: number; aktiv: boolean; beiWahl: () => void }) {
  const gruende = [lageText(k.lage), ...k.gruende.filter((g) => g !== k.lage && !(k.lage === 'Bereitschaft' && g === 'Bereitschaft') && !(k.lage === 'freigesetzt' && g === 'freigesetzt'))].filter(Boolean);
  return (
    <button type="button" className={mergeClasses('ta-kandidat', k.rot && 'rot')} disabled={!aktiv} onClick={(e) => { e.stopPropagation(); beiWahl(); }}
      title={`${k.name} zuweisen (Taste ${nr})${k.rot ? '\nungünstig (Merker, Zähler oder Sperrvermerk)' : ''}`} data-lehrer={k.k}>
      <kbd>{nr}</kbd>
      <span className="ta-kurz">{k.k}</span>
      <span className="ta-name">{k.name}</span>
      <span className="ta-gruende">{gruende.join(' · ')}</span>
      <Last k={k} />
    </button>
  );
}

interface KarteProps {
  o: OffeneStunde; info: KandidatenInfo | null | undefined; gewaehlt: boolean; markiert: boolean; block: boolean; schreiben: boolean;
  waehlen: (id: number, e: RMouseEvent) => void; maus: { runter: (id: number, e: RMouseEvent) => void; rein: (id: number, e: RMouseEvent) => void }; aktion: (o: OffeneStunde, f: () => Promise<unknown>) => void; mehr: (o: OffeneStunde) => MenueListe;
}

/** Karte einer offenen Stunde mit den besten Kandidaten; Nebenaktionen nur auf der gewählten Karte. */
const Karte = memo(function Karte({ o, info, gewaehlt, markiert, block, schreiben, waehlen, maus, aktion, mehr }: KarteProps) {
  const std = stundenText(o, block);
  const geladen = info !== undefined;
  return (
    <div className={mergeClasses('ta-karte', gewaehlt && 'gewaehlt', markiert && 'markiert', o.klausur && 'klausur')} role="option" aria-selected={gewaehlt || markiert} data-id={o.id}
      onClick={(e) => waehlen(o.id, e)} onMouseDown={(e) => maus.runter(o.id, e)} onMouseEnter={(e) => maus.rein(o.id, e)}>
      <div className="ta-kopf">
        <span className="ta-std">{std}</span>
        <span className="ta-zeit">{o.zeit}</span>
        <span className="ta-was">
          <b>{o.klassen || '–'}</b>
          {o.pause ? <span>Aufsicht {o.raum}</span> : <span>{o.fach}</span>}
          {o.lehrer ? <span className="ta-statt">{`statt ${o.lehrer}`}</span> : null}
          {!o.pause && o.raum ? <span className="ta-raum">{o.raum}</span> : null}
        </span>
        {o.klausur ? <span className="ta-plakette pruefung">Klausuraufsicht</span> : null}
        {o.raumOffen && !o.offen ? <span className="ta-plakette offen">Raum fehlt</span> : null}
        {o.veranstaltung ? <span className="ta-plakette termin">Veranstaltung</span> : null}
        {block && o.block ? <span className="ta-hinweis" title="Doppel- bzw. Blockstunde: die Zuweisung gilt für alle offenen Stunden des Blocks">{`Block ${o.block[0]}.–${o.block[o.block.length - 1]}.`}</span> : null}
        <span className="ta-nr" title="Vertretungsnummer">{`Nr. ${o.id}`}</span>
      </div>
      {o.grund || o.text ? <div className="ta-zusatz">{[o.grund, o.text].filter(Boolean).join(' – ')}</div> : null}
      <div className="ta-kandidaten">
        {!geladen ? <span className="ta-laedt"><Spinner size="extra-tiny" /> Kandidaten werden gesucht …</span>
          : info === null ? <span className="ta-leer">Kein Vorschlag verfügbar.</span>
            : info.art === 'raum' ? (
              info.raeume?.length ? info.raeume.map((r, i) => (
                <button key={r.raum} type="button" className="ta-kandidat" disabled={!schreiben} onClick={(e) => { e.stopPropagation(); aktion(o, () => raumZuweisen(o, r.raum)); }} title={`Raum ${r.k} zuordnen (Taste ${i + 1})`}>
                  <kbd>{i + 1}</kbd><span className="ta-kurz">{r.k}</span><span className="ta-name">{r.name}</span><span className="ta-gruende">{['frei', ...r.gruende].join(' · ')}</span>
                </button>
              )) : <span className="ta-leer">Kein freier Raum – „Raum …“ zeigt auch belegte Räume.</span>
            ) : info.kandidaten.length ? info.kandidaten.map((k, i) => (
              <KandidatZeile key={k.lehrer} k={k} nr={i + 1} aktiv={schreiben} beiWahl={() => aktion(o, () => zuweisen(o, k.lehrer, block))} />
            )) : <span className="ta-leer">Keine Lehrkraft frei.{info.entfallSinnvoll ? ' Entfall ist hier sinnvoll (Randstunde).' : ''}</span>}
        {geladen && info && info.weitere > 0 ? <span className="ta-weitere">{`+ ${info.weitere} weitere`}</span> : null}
      </div>
      {gewaehlt && !markiert && schreiben ? (
        <div className="ta-aktionen" onClick={(e) => e.stopPropagation()}>
          {o.offen ? <>
            <button type="button" className={mergeClasses('ta-aktion', info?.entfallSinnvoll && 'empfohlen')} onClick={() => aktion(o, () => entfallen([o.id]))} title={info?.entfallSinnvoll ? 'Entfall ist hier sinnvoll (Randstunde bzw. Regel der Stunde)' : 'Unterricht entfällt'}>Entfall <kbd>E</kbd></button>
            {info?.betreuung ? (
              <button type="button" className="ta-aktion" onClick={() => aktion(o, () => betreuen(o, info.betreuung!.lehrer, block))}
                title={`${info.betreuung.k} betreut die Klasse neben dem eigenen Unterricht (${info.betreuung.klassen}, ${info.betreuung.naehe || 'Nähe unbekannt'})`}>
                {`Zusammenlegen mit ${info.betreuung.k}`} <kbd>B</kbd>
              </button>
            ) : null}
            <button type="button" className="ta-aktion" onClick={() => aktion(o, () => ohneLehrkraft([o.id]))} title="Stunde findet ohne Lehrkraft statt (z. B. Aufgaben, EVA)">Ohne Lehrkraft <kbd>O</kbd></button>
          </> : null}
          <button type="button" className="ta-aktion" onClick={() => aktion(o, () => raumDialog(o.id, [o.id], QUELLE))} title="Raum zuordnen, tauschen oder zusätzlich zuordnen">Raum … <kbd>R</kbd></button>
          <button type="button" className="ta-aktion" onClick={() => tpKontextSetzen('vorschlag')} title="Alle Kandidaten, Betreuungen, Räume und Vorziehungen">Alle Kandidaten <kbd>V</kbd></button>
          <span className="ta-aktion-mehr"><MenueKnopf art="knopf" appearance="subtle" text="Mehr" titel="Vorziehen, Verlegen, Vormerken" eintraege={() => mehr(o)} /></span>
        </div>
      ) : null}
    </div>
  );
});

function ErledigtKarte({ b, gewaehlt, schreiben, waehlen, zurueck }: { b: BearbeiteteStunde; gewaehlt: boolean; schreiben: boolean; waehlen: () => void; zurueck: () => void }) {
  return (
    <div className={mergeClasses('ta-karte', 'erledigt', gewaehlt && 'gewaehlt')} role="option" aria-selected={gewaehlt} data-id={b.id} onClick={waehlen}>
      <div className="ta-kopf">
        <span className="ta-std">{`${b.stundeText}.`}</span>
        <span className="ta-zeit">{b.zeit}</span>
        <span className="ta-was"><b>{b.klassen || '–'}</b><span>{b.fach}</span>{b.lehrer ? <span className="ta-statt">{`statt ${b.lehrer}`}</span> : null}</span>
        <span className="ta-ergebnis" data-entfall={b.entfall || undefined}>{b.ergebnis}</span>
        <span className="ta-nr">{`Nr. ${b.id}`}</span>
      </div>
      {gewaehlt && schreiben && !b.fix ? (
        <div className="ta-aktionen" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="ta-aktion" onClick={zurueck} title="Wieder zur offenen Stunde machen">Zurücksetzen <kbd>Entf</kbd></button>
          <button type="button" className="ta-aktion" onClick={() => tpKontextSetzen('vorschlag')}>Andere Lehrkraft <kbd>V</kbd></button>
        </div>
      ) : null}
    </div>
  );
}

/** Prüfung der automatischen Vorschläge: Liste mit Auswahl, alle oder einzeln übernehmen. */
function Pruefung({ probe, schreiben, schliessen, uebernommen }: { probe: Probe; schreiben: boolean; schliessen: () => void; uebernommen: (ids: number[]) => void }) {
  const [aus, setAus] = useState<Set<number>>(() => new Set());
  const [laeuft, setLaeuft] = useState(false);
  const gewaehlt = probe.vorschlaege.filter((v) => !aus.has(v.id));
  const anwenden = async (liste: typeof probe.vorschlaege) => {
    if (!liste.length) return;
    setLaeuft(true);
    try {
      await vorschlaegeAnwenden(liste.map((v) => ({ id: v.id, lehrer: v.art === 'lehrer' ? v.lehrerId : null, raum: v.art === 'raum' ? v.raumId : null, entfall: v.art === 'entfall' })));
      hinweis(`${mehrzahl(liste.length, 'Vorschlag', 'Vorschläge')} übernommen – Strg+Z macht es rückgängig.`, 'ok', 3000);
      uebernommen(liste.map((v) => v.id));
    } catch (e) { fehlerMelden(e); } finally { setLaeuft(false); }
  };
  return (
    <div className="ta-pruefung" data-testid="automatik-pruefung">
      <div className="ta-pruefung-kopf">
        <div>
          <div className="ta-pruefung-titel">Vorschläge der Automatik prüfen</div>
          <div className="ta-pruefung-text">{`${mehrzahl(probe.vorschlaege.length, 'Vorschlag', 'Vorschläge')} für ${mehrzahl(probe.vorschlaege.length + probe.ohne.length, 'offene Stunde', 'offene Stunden')} – noch nichts geändert.`}</div>
        </div>
        <span className="ta-pruefung-knoepfe">
          <Button size="small" appearance="primary" disabled={!schreiben || laeuft || !gewaehlt.length} onClick={() => void anwenden(gewaehlt)} data-testid="automatik-alle">
            {gewaehlt.length === probe.vorschlaege.length ? `Alle übernehmen (${gewaehlt.length})` : `Auswahl übernehmen (${gewaehlt.length})`}
          </Button>
          <Button size="small" onClick={schliessen}>Verwerfen</Button>
        </span>
      </div>
      <div className="ta-pruefung-liste" role="list">
        {probe.vorschlaege.map((v) => (
          <div key={v.id} className={mergeClasses('ta-pzeile', aus.has(v.id) && 'aus')} role="listitem" data-id={v.id}>
            <Checkbox checked={!aus.has(v.id)} aria-label={`Vorschlag Nr. ${v.id} übernehmen`} onChange={(_, d) => setAus((s) => { const n = new Set(s); if (d.checked) n.delete(v.id); else n.add(v.id); return n; })} />
            <span className="ta-std">{`${v.stundeText}.`}</span>
            <span className="ta-was"><b>{v.klassen}</b><span>{v.fach}</span>{v.lehrer ? <span className="ta-statt">{`statt ${v.lehrer}`}</span> : null}</span>
            <span className="ta-pfeil" aria-hidden>→</span>
            <span className={mergeClasses('ta-pziel', v.art === 'entfall' && 'entfall')}>{v.text}</span>
            <span className="ta-gruende">{v.grund}</span>
            <Button size="small" appearance="subtle" disabled={!schreiben || laeuft} onClick={() => void anwenden([v])}>Übernehmen</Button>
          </div>
        ))}
        {probe.ohne.length ? (
          <div className="ta-pohne">
            <div className="ta-pruefung-titel">{`Ohne Vorschlag (${probe.ohne.length})`}</div>
            {probe.ohne.map((v) => <div key={v.id} className="ta-pzeile aus"><span className="ta-std">{`${v.stundeText}.`}</span><span className="ta-was"><b>{v.klassen}</b><span>{v.fach}</span><span className="ta-statt">{`statt ${v.lehrer}`}</span></span><span className="ta-gruende">bleibt offen – bitte von Hand lösen</span></div>)}
          </div>
        ) : null}
        {!probe.vorschlaege.length && !probe.ohne.length ? <Leer text="Es gibt keine offenen Stunden." /> : null}
      </div>
    </div>
  );
}

type Filter = 'offen' | 'bearbeitet';

export default function Arbeitsliste() {
  const s = useStile();
  const datum = usePlanungsdatum();
  const schreiben = useDarfSchreiben();
  const block = useKandidaten((x) => x.block);
  const werte = useKandidaten((x) => x.werte);
  const kStand = useKandidaten((x) => x.stand);
  const [filter, setFilter] = useState<Filter>('offen');
  const [gewaehlt, setGewaehlt] = useState<number | null>(null);
  const [probe, setProbe] = useState<Probe | null>(null);
  const [probeLaeuft, setProbeLaeuft] = useState(false);
  const indexNach = useRef<number | null>(null);
  // Mehrfachauswahl: Strg+Klick, Umschalt+Klick oder mit gedrückter Maustaste über mehrere Karten ziehen
  const [markiert, setMarkiert] = useState<number[]>([]);
  const gemeinsamRef = useRef<Gemeinsam | null>(null);
  const zug = useRef<{ start: number; gezogen: boolean } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { daten, laedt } = useDaten(() => arbeitslisteLaden(datum!), [datum], { bereiche: ['Vertretung', 'Stundenplan', 'Unterricht', 'Stammdaten', 'Einstellungen'], aktiv: !!datum });
  useEffect(() => { setProbe(null); setGewaehlt(null); setMarkiert([]); }, [datum]);
  useEffect(() => { const ende = () => { setTimeout(() => { zug.current = null; }); }; document.addEventListener('mouseup', ende); return () => document.removeEventListener('mouseup', ende); }, []);
  const offen = daten?.offen || [];
  const bearbeitet = daten?.bearbeitet || [];
  const ids = useMemo(() => (filter === 'offen' ? offen.map((o) => o.id) : bearbeitet.map((b) => b.id)), [filter, offen, bearbeitet]);

  // Auswahl halten: nach einer Aktion die Stunde an derselben Stelle (die nächste offene), sonst die erste
  useEffect(() => {
    if (!daten) return;
    if (gewaehlt != null && ids.includes(gewaehlt)) { indexNach.current = null; return; }
    const i = indexNach.current;
    indexNach.current = null;
    const neu = ids.length ? ids[Math.min(i ?? 0, ids.length - 1)]! : null;
    setGewaehlt(neu);
  }, [daten, ids]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setMarkiert((m) => { const n = m.filter((id) => ids.includes(id)); return n.length === m.length ? m : n.length > 1 ? n : []; }); }, [ids]);
  const mehrere = markiert.length > 1;
  useEffect(() => {
    if (!mehrere) return;
    const o = offenNachId.get(markiert[0]!);
    if (o) auswahlMelden({ id: o.id, ids: markiert, quelle: QUELLE, text: `${markiert.length} Stunden`, zeile: { v: o.id, klasse: o.klasse, lehrer: o.lehrerId, datum, stunde: o.stunde } });
  }, [markiert.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  // gewählte Stunde melden: Pläne und Vorschlag folgen
  const offenNachId = useMemo(() => new Map(offen.map((o) => [o.id, o])), [offen]);
  const bearbeitetNachId = useMemo(() => new Map(bearbeitet.map((b) => [b.id, b])), [bearbeitet]);
  useEffect(() => {
    if (gewaehlt == null || markiert.length > 1) return;
    const o = offenNachId.get(gewaehlt);
    const b = bearbeitetNachId.get(gewaehlt);
    if (o) auswahlSetzen(o, datum);
    else if (b) auswahlSetzen(b, datum, b.vertreter);
  }, [gewaehlt, offenNachId, bearbeitetNachId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Auswahl aus einem Plan oder einer anderen Ansicht übernehmen
  useEreignis('vertretung.auswahl', (x) => { if (x && x.quelle !== QUELLE && x.id !== gewaehlt && (offenNachId.has(x.id) || bearbeitetNachId.has(x.id))) { setFilter(offenNachId.has(x.id) ? 'offen' : 'bearbeitet'); setGewaehlt(x.id); } });

  const virt = useVirtualizer({
    count: ids.length, getScrollElement: () => scrollRef.current, overscan: 6, getItemKey: (i) => ids[i] ?? i,
    estimateSize: (i) => (filter === 'offen' ? (ids[i] === gewaehlt ? 196 : 152) : (ids[i] === gewaehlt ? 84 : 46)),
  });
  const sichtbar = virt.getVirtualItems();
  // Kandidaten der sichtbaren (und der nächsten) Karten anfordern
  const sichtKey = `${sichtbar[0]?.index ?? 0}-${sichtbar[sichtbar.length - 1]?.index ?? 0}-${ids.length}-${kStand}`;
  useEffect(() => {
    if (filter !== 'offen' || !sichtbar.length) return;
    const von = sichtbar[0]!.index, bis = Math.min(ids.length - 1, sichtbar[sichtbar.length - 1]!.index + 4);
    const g = gewaehlt != null ? [gewaehlt] : [];
    kandidatenAnfordern([...g, ...ids.slice(von, bis + 1)]);
  }, [sichtKey, filter, gewaehlt]); // eslint-disable-line react-hooks/exhaustive-deps

  const index = gewaehlt != null ? ids.indexOf(gewaehlt) : -1;
  useEffect(() => { if (index >= 0) virt.scrollToIndex(index, { align: 'auto' }); }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  const bereich = (a: number, b: number) => { const i = ids.indexOf(a), j = ids.indexOf(b); return i < 0 || j < 0 ? [b] : ids.slice(Math.min(i, j), Math.max(i, j) + 1); };
  const waehlen = (id: number, e?: RMouseEvent) => {
    if (zug.current?.gezogen) return;
    if (e && (e.ctrlKey || e.metaKey) && filter === 'offen') {
      setMarkiert((m) => { const basis = m.length ? m : gewaehlt != null ? [gewaehlt] : []; return basis.includes(id) ? basis.filter((x) => x !== id) : [...basis, id]; });
      setGewaehlt(id);
      return;
    }
    if (e?.shiftKey && gewaehlt != null && filter === 'offen') { setMarkiert(bereich(gewaehlt, id)); return; }
    setMarkiert([]);
    setGewaehlt(id);
  };
  const maus = {
    runter: (id: number, e: RMouseEvent) => {
      if (e.button !== 0 || e.ctrlKey || e.shiftKey || e.metaKey || filter !== 'offen' || (e.target as HTMLElement).closest('button')) return;
      zug.current = { start: id, gezogen: false };
    },
    rein: (id: number, e: RMouseEvent) => {
      const z = zug.current;
      if (!z || e.buttons !== 1 || id === z.start) return;
      z.gezogen = true;
      window.getSelection()?.removeAllRanges();
      setMarkiert(bereich(z.start, id));
      setGewaehlt(z.start);
    },
  };
  const sammelFertig = () => { indexNach.current = ids.indexOf(markiert[0] ?? -1); setMarkiert([]); scrollRef.current?.focus({ preventScroll: true }); };
  const blaettern = (r: number) => {
    if (!ids.length) return;
    const i = index < 0 ? 0 : Math.max(0, Math.min(ids.length - 1, index + r));
    setGewaehlt(ids[i]!);
  };
  const aktion = (o: { id: number }, f: () => Promise<unknown>) => {
    if (!schreiben) return;
    indexNach.current = ids.indexOf(o.id);
    f().then(() => scrollRef.current?.focus({ preventScroll: true })).catch(fehlerMelden);
  };
  const mehr = (o: OffeneStunde): MenueListe => [
    { text: 'Vorziehen', deaktiviert: !schreiben || !o.offen, menue: async () => {
      const v = await api.get<{ vorziehungen: { lehrer: string; tag: string; datum: string; stunde: number; klassen: string; fach: string; art: string; u: number | null }[] }>(vpfad(`/vorschlag/${o.id}`));
      const l: MenueListe = v.vorziehungen.slice(0, 10).map((z) => ({
        text: `${z.tag} ${z.stunde}. Std. · ${z.klassen} ${z.fach} ${z.lehrer} · ${z.art}`,
        aktion: () => aktion(o, () => api.post(vpfad(`/vorschlag/${o.id}/vorziehen`), { datum: z.datum, stunde: z.stunde, unterricht: z.u }, { quelle: QUELLE })),
      }));
      return l.length ? l : [{ text: 'Keine Vorziehung möglich', deaktiviert: true }];
    } },
    { text: 'Verlegen oder tauschen (Pläne, Drag & Drop)', aktion: () => { tpKontextSetzen('plaene'); hinweis('Stunde im Klassen- oder Lehrkräfteplan auf eine andere Stunde ziehen: Verlegen bzw. Tauschen.', 'info', 5000); } },
    { text: 'Als Vormerkung beiseitelegen', deaktiviert: !schreiben, aktion: () => aktion(o, () => vormerken([o.id])) },
    null,
    { text: 'In der Expertenansicht bearbeiten', aktion: () => import('../kern').then((k) => k.tpAnsichtSetzen('experte')) },
  ];

  async function automatik() {
    if (!datum) return;
    setProbeLaeuft(true);
    try { setProbe(await probeLaden(datum)); } catch (e) { fehlerMelden(e); } finally { setProbeLaeuft(false); }
  }

  // Tasten: J/K bzw. ↓/↑, 1–3, E, B, O, R, V, F, P, Entf, A
  const tasteRef = useRef<(e: KeyboardEvent) => boolean>(() => false);
  tasteRef.current = (e: KeyboardEvent) => {
    if (probe) return false;
    const k = e.key.toLowerCase();
    if (k === 'j' || e.key === 'ArrowDown') { blaettern(1); return true; }
    if (k === 'k' || e.key === 'ArrowUp') { blaettern(-1); return true; }
    if (k === 'v') { tpKontextSetzen('vorschlag'); return true; }
    if (k === 'f') { tpKontextSetzen('frei'); return true; }
    if (k === 'p') { tpKontextSetzen('plaene'); return true; }
    if (k === 'a' && schreiben && offen.length) { void automatik(); return true; }
    if (e.key === 'Escape' && markiert.length) { setMarkiert([]); return true; }
    if (mehrere && schreiben) {
      const g = gemeinsamRef.current;
      const nach = (f: () => Promise<unknown>) => { f().then((r) => { if (r !== null) sammelFertig(); }).catch(fehlerMelden); };
      if (/^[1-3]$/.test(e.key)) { const c = g?.kandidaten[Number(e.key) - 1]; if (c && g) nach(() => alleZuweisen(g.ids, c.lehrer)); return true; }
      if (k === 'e') { nach(() => entfallen(markiert)); return true; }
      if (k === 'o') { nach(() => ohneLehrkraft(markiert)); return true; }
      if (k === 'b' && g?.betreuung) { nach(() => alleBetreuen(g.ids, g.betreuung!.lehrer)); return true; }
      if (k === 'r') { nach(async () => ((await raumDialog(markiert[0]!, markiert, QUELLE)) ? true : null)); return true; }
      return false;
    }
    if (gewaehlt == null || !schreiben) return false;
    const o = offenNachId.get(gewaehlt);
    if (filter === 'bearbeitet' || !o) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && bearbeitetNachId.has(gewaehlt)) { aktion({ id: gewaehlt }, () => zuruecksetzen([gewaehlt])); return true; }
      return false;
    }
    const info = werte[o.id];
    if (/^[1-3]$/.test(e.key)) {
      const i = Number(e.key) - 1;
      if (info?.art === 'raum') { const r = info.raeume?.[i]; if (r) aktion(o, () => raumZuweisen(o, r.raum)); }
      else { const c = info?.kandidaten[i]; if (c) aktion(o, () => zuweisen(o, c.lehrer, block)); }
      return true;
    }
    if (k === 'e' && o.offen) { aktion(o, () => entfallen([o.id])); return true; }
    if (k === 'b' && o.offen && info?.betreuung) { aktion(o, () => betreuen(o, info.betreuung!.lehrer, block)); return true; }
    if (k === 'o' && o.offen) { aktion(o, () => ohneLehrkraft([o.id])); return true; }
    if (k === 'r') { aktion(o, () => raumDialog(o.id, [o.id], QUELLE)); return true; }
    return false;
  };
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest('input, textarea, select, [contenteditable=true], [data-tabelle], [role=dialog], [role=menu], [role=listbox]:not([data-testid=arbeitsliste])'))) return;
      if (document.querySelector('[role=dialog]')) return;
      if (tasteRef.current(e)) e.preventDefault();
    };
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  }, []);
  const listenTaste = (e: RKeyboardEvent<HTMLDivElement>) => { if (e.key === 'Home') { setGewaehlt(ids[0] ?? null); e.preventDefault(); } else if (e.key === 'End') { setGewaehlt(ids[ids.length - 1] ?? null); e.preventDefault(); } };

  const tasten: MenueListe = [
    { titel: 'Tasten der Arbeitsliste' },
    { text: 'Nächste / vorherige Stunde', taste: 'J / K', aktion: () => {} },
    { text: 'Kandidat 1–3 zuweisen', taste: '1 2 3', aktion: () => {} },
    { text: 'Entfall', taste: 'E', aktion: () => {} },
    { text: 'Zusammenlegen (Betreuung)', taste: 'B', aktion: () => {} },
    { text: 'Ohne Lehrkraft', taste: 'O', aktion: () => {} },
    { text: 'Raum zuordnen …', taste: 'R', aktion: () => {} },
    { text: 'Alle Kandidaten', taste: 'V', aktion: () => tpKontextSetzen('vorschlag') },
    { text: 'Wer ist frei?', taste: 'F', aktion: () => tpKontextSetzen('frei') },
    { text: 'Pläne von Klasse und Lehrkraft', taste: 'P', aktion: () => tpKontextSetzen('plaene') },
    { text: 'Automatisch vorschlagen', taste: 'A', aktion: () => void automatik() },
    { text: 'Bearbeitete: zurücksetzen', taste: 'Entf', aktion: () => {} },
    null,
    { text: 'Mehrere Stunden markieren: Strg+Klick, Umschalt+Klick oder mit gedrückter Maustaste ziehen', aktion: () => {} },
  ];

  const nOffen = offen.length;
  return (
    <AnsichtRahmen titel="Offene Stunden" laden={laedt && !daten}
      werkzeuge={<>
        <Umschalter<Filter> wert={filter} titel="Offene oder bereits bearbeitete Stunden des Tages" testid="arbeitsliste-filter" beiWahl={(w) => { setFilter(w); setGewaehlt(null); }}
          optionen={[{ wert: 'offen', text: `Offen (${nOffen})`, titel: 'Stunden ohne Lehrkraft bzw. ohne Raum' }, { wert: 'bearbeitet', text: `Bearbeitet (${bearbeitet.length})`, titel: 'Heute bereits besetzte, entfallene oder geänderte Stunden' }]} />
        <Trenner />
        {schreiben ? <Werkzeug text={probeLaeuft ? 'Wird berechnet …' : 'Automatisch vorschlagen'} titel="Die Automatik schlägt für alle offenen Stunden eine Lösung vor – zur Prüfung, noch ohne Änderung (Taste A)" aktion={automatik} deaktiviert={!nOffen || probeLaeuft} /> : null}
        <Tooltip content="Doppel- und Blockstunden gemeinsam besetzen (Kandidaten müssen in allen Stunden frei sein)" relationship="description">
          <Switch label="Blöcke gemeinsam" checked={block} onChange={(_, d) => blockSetzen(d.checked)} />
        </Tooltip>
        <Rechts><MenueKnopf text="" icon={<Keyboard20Regular />} titel="Tastenkürzel der Arbeitsliste" eintraege={tasten} /></Rechts>
      </>}
      fuss={<>
        <span data-testid="arbeitsliste-stand">{nOffen ? `${mehrzahl(nOffen, 'offene Stunde', 'offene Stunden')}` : 'Alle Stunden gelöst'}</span>
        <FussText rechts>J/K · 1–3 zuweisen · E Entfall · B Zusammenlegen · O ohne Lehrkraft</FussText>
      </>}>
      {probe ? (
        <Pruefung probe={probe} schreiben={schreiben} schliessen={() => setProbe(null)}
          uebernommen={(fertig) => setProbe((p) => { if (!p) return p; const rest = p.vorschlaege.filter((v) => !fertig.includes(v.id)); return rest.length ? { ...p, vorschlaege: rest } : null; })} />
      ) : !daten ? null : !ids.length ? (
        filter === 'offen' ? (
          <Leer text={daten.unterrichtstag ? 'Alle Stunden des Tages sind gelöst.' : 'An diesem Tag findet kein Unterricht statt.'}>
            {daten.unterrichtstag ? <Button appearance="primary" onClick={() => tpSchrittSetzen('pruefen')}>Weiter: Prüfen und veröffentlichen</Button> : null}
          </Leer>
        ) : <Leer text="Heute wurde noch keine Stunde bearbeitet." />
      ) : (<>
        {mehrere ? <Sammelleiste ids={markiert} schreiben={schreiben} aufheben={() => setMarkiert([])} fertig={sammelFertig} beiDaten={(g) => { gemeinsamRef.current = g; }} /> : null}
        <div ref={scrollRef} className={s.liste} tabIndex={0} role="listbox" aria-label={filter === 'offen' ? 'Offene Stunden' : 'Bearbeitete Stunden'} onKeyDown={listenTaste} data-testid="arbeitsliste">
          <div className={s.innen} style={{ height: virt.getTotalSize() }}>
            {sichtbar.map((v) => {
              const id = ids[v.index]!;
              return (
                <div key={v.key} ref={virt.measureElement} data-index={v.index} style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${v.start}px)`, paddingBottom: 8 }}>
                  {filter === 'offen' ? (
                    <Karte o={offenNachId.get(id)!} info={werte[id]} gewaehlt={id === gewaehlt} markiert={mehrere && markiert.includes(id)} block={block} schreiben={schreiben} waehlen={waehlen} maus={maus} aktion={aktion} mehr={mehr} />
                  ) : (
                    <ErledigtKarte b={bearbeitetNachId.get(id)!} gewaehlt={id === gewaehlt} schreiben={schreiben} waehlen={() => waehlen(id)} zurueck={() => aktion({ id }, () => zuruecksetzen([id]))} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </>)}
    </AnsichtRahmen>
  );
}
