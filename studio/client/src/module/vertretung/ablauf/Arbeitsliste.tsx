// Offene Stunden der Tagesplanung („Liste“): links eine schlanke Liste der offenen (bzw. gelösten) Stunden des Planungstags,
// nach Stunden gegliedert, eine Zeile je Stunde (Klasse · Fach · fehlt: Lehrkraft) – rechts die Entscheidung zur gewählten
// Stunde (Empfehlung als ein Knopf, zwei Alternativen, Entfall, weitere Möglichkeiten). Eine Aufgabe nach der anderen: nach
// jeder Entscheidung ist die nächste offene Stunde gewählt. Für große Schulen: virtualisiert, Suche und Filter (Stunde,
// Jahrgang, Abteilung), Mehrfachauswahl (Strg/Umschalt+Klick oder Ziehen) mit gemeinsamen Kandidaten und „Empfehlungen für
// alle prüfen“ (Probe der Automatik, Übernahme nach Prüfung, eine Rückgängig-Stufe). Kandidaten werden nur für die gewählte
// und die nächsten Stunden geladen. Tasten: Enter/1 Empfehlung, 2–3 Alternativen, J/K bzw. ↓/↑, E, B, O, R, M, V, F, P, A, Esc.
import { Button, Checkbox, Input, Popover, PopoverSurface, PopoverTrigger, Select, makeStyles, mergeClasses } from '@fluentui/react-components';
import { Keyboard20Regular } from '@fluentui/react-icons';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as RKeyboardEvent, type MouseEvent as RMouseEvent } from 'react';
import { rueckgaengig } from '@/kern/dokument';
import { useEreignis } from '@/kern/ereignisse';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben } from '@/kern/zustand';
import { Leer } from '@/komponenten/ansicht';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { MenueKnopf, type MenueListe } from '@/komponenten/menue';
import { raumDialog } from '../dialoge';
import { auswahlMelden, tpBlattSetzen, tpKontextSetzen, tpKontextUmschalten, usePlanungsdatum } from '../kern';
import {
  QUELLE, alleBetreuen, alleZuweisen, arbeitslisteLaden, auswahlSetzen, entfallen, kandidatenAnfordern, mehrzahl, ohneLehrkraft, probeLaden,
  useKandidaten, vorschlaegeAnwenden, type BearbeiteteStunde, type Gemeinsam, type OffeneStunde, type Probe,
} from './daten';
import { Entscheidung, entscheidungsTaste, type EntscheidungProps } from './Entscheidung';
import { Sammelleiste } from './Sammelleiste';
import './ablauf.css';

const useStile = makeStyles({
  suche: { flex: 1, minWidth: '80px' },
});

/** Prüfung der automatischen Vorschläge: Liste mit Auswahl, alle oder einzeln übernehmen. */
function Pruefung({ probe, schreiben, schliessen, uebernommen, nurIds }: { probe: Probe; schreiben: boolean; schliessen: () => void; uebernommen: (ids: number[]) => void; nurIds: Set<number> | null }) {
  // ist die Liste gefiltert (Stunde, Jahrgang …), sind zunächst nur die Vorschläge der gefilterten Stunden gewählt
  const [aus, setAus] = useState<Set<number>>(() => new Set(nurIds ? probe.vorschlaege.filter((v) => !nurIds.has(v.id)).map((v) => v.id) : []));
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
          <div className="ta-pruefung-titel">Empfehlungen prüfen</div>
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
            <span className="ta-was"><b>{v.klassen}</b><span>{v.fach}</span>{v.lehrer ? <span className="ta-statt">{v.lehrer}</span> : null}</span>
            <span className="ta-pfeil" aria-hidden>→</span>
            <span className={mergeClasses('ta-pziel', v.art === 'entfall' && 'entfall')}>{v.text}</span>
            <span className="ta-gruende">{v.grund}</span>
            <Button size="small" appearance="subtle" disabled={!schreiben || laeuft} onClick={() => void anwenden([v])}>Übernehmen</Button>
          </div>
        ))}
        {probe.ohne.length ? (
          <div className="ta-pohne">
            <div className="ta-pruefung-titel">{`Ohne Vorschlag (${probe.ohne.length})`}</div>
            {probe.ohne.map((v) => <div key={v.id} className="ta-pzeile aus"><span className="ta-std">{`${v.stundeText}.`}</span><span className="ta-was"><b>{v.klassen}</b><span>{v.fach}</span><span className="ta-statt">{v.lehrer}</span></span><span className="ta-gruende">bleibt offen – bitte von Hand lösen</span></div>)}
          </div>
        ) : null}
        {!probe.vorschlaege.length && !probe.ohne.length ? <Leer text="Keine offenen Stunden." /> : null}
      </div>
    </div>
  );
}

type Filter = 'offen' | 'bearbeitet';
type Zeile = { art: 'kopf'; stunde: number; zeit: string; anzahl: number; key: string } | { art: 'o'; o: OffeneStunde; key: string } | { art: 'b'; b: BearbeiteteStunde; key: string };
const HOEHE_KOPF = 28, HOEHE_ZEILE = 32;

/** Zeile einer offenen Stunde: Klasse · Fach · fehlende Lehrkraft, rechts ein Hinweis (Klausur, Raum, Block). */
function OffenZeile({ o, block }: { o: OffeneStunde; block: boolean }) {
  const hinweisText = o.klausur ? 'Klausur' : o.raumOffen && !o.offen ? 'Raum' : block && o.block ? `${o.block[0]}.–${o.block[o.block.length - 1]}.` : o.veranstaltung && o.klassen ? 'Termin' : '';
  return (
    <>
      <span className="tp-zkl">{o.klassen || (o.veranstaltung ? 'Termin' : '–')}</span>
      <span className="tp-zfach" title={o.veranstaltung && !o.klassen ? [o.grund, o.text].filter(Boolean).join(' – ') || 'Veranstaltung' : undefined}>{o.pause ? `Aufsicht ${o.raum}` : o.fach}</span>
      <span className="tp-zfehlt">{o.offen && o.lehrer ? <span className="tp-statt">{o.lehrer}</span> : o.raumOffen ? 'ohne Raum' : ''}</span>
      {hinweisText ? <span className={mergeClasses('tp-zhinweis', o.klausur && 'tp-pruefung')} title={o.klausur ? 'Klausuraufsicht' : o.raumOffen && !o.offen ? 'Raum fehlt' : block && o.block ? 'Doppel- bzw. Blockstunde' : 'Veranstaltung'}>{hinweisText}</span> : null}
    </>
  );
}

function GeloestZeile({ b }: { b: BearbeiteteStunde }) {
  return (
    <>
      <span className="tp-zkl">{b.klassen || '–'}</span>
      <span className="tp-zfach">{b.fach}</span>
      <span className="tp-zfehlt">{b.lehrer ? <span className="tp-statt">{b.lehrer}</span> : null}</span>
      <span className="tp-zergebnis" data-entfall={b.entfall || undefined}>{b.ergebnis}</span>
    </>
  );
}

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
  const [suche, setSuche] = useState('');
  const [nurStd, setNurStd] = useState('');
  const [nurJg, setNurJg] = useState('');
  const [nurAbt, setNurAbt] = useState('');
  const indexNach = useRef<number | null>(null);
  // Mehrfachauswahl: Strg+Klick, Umschalt+Klick oder mit gedrückter Maustaste über mehrere Zeilen ziehen
  const [markiert, setMarkiert] = useState<number[]>([]);
  const gemeinsamRef = useRef<Gemeinsam | null>(null);
  const zug = useRef<{ start: number; gezogen: boolean } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mehrRef = useRef<HTMLSpanElement>(null);

  const { daten, laedt } = useDaten(() => arbeitslisteLaden(datum!), [datum], { bereiche: ['Vertretung', 'Stundenplan', 'Unterricht', 'Stammdaten', 'Einstellungen'], aktiv: !!datum });
  useEffect(() => { setProbe(null); setGewaehlt(null); setMarkiert([]); }, [datum]);
  useEffect(() => { const ende = () => { setTimeout(() => { zug.current = null; }); }; document.addEventListener('mouseup', ende); return () => document.removeEventListener('mouseup', ende); }, []);
  const alleOffen = daten?.offen || [];
  const bearbeitet = daten?.bearbeitet || [];

  // Filter (Suche, Stunde, Jahrgang, Abteilung) für große Schulen
  const passt = (x: { klassen: string; fach: string; lehrer: string; stunde: number }, jg?: string, abt?: string) => {
    if (nurStd && String(x.stunde) !== nurStd) return false;
    if (nurJg && jg !== undefined && jg !== nurJg) return false;
    if (nurAbt && abt !== undefined && abt !== nurAbt) return false;
    const t = suche.trim().toLowerCase();
    return !t || `${x.klassen} ${x.fach} ${x.lehrer}`.toLowerCase().includes(t);
  };
  const filterAktiv = !!(suche.trim() || nurStd || nurJg || nurAbt);
  const nFilter = [nurStd, nurJg, nurAbt].filter(Boolean).length;
  const offen = useMemo(() => (filterAktiv ? alleOffen.filter((o) => passt(o, o.jahrgangText, o.abteilung)) : alleOffen), [alleOffen, suche, nurStd, nurJg, nurAbt]); // eslint-disable-line react-hooks/exhaustive-deps
  const geloest = useMemo(() => (filterAktiv ? bearbeitet.filter((b) => passt(b)) : bearbeitet), [bearbeitet, suche, nurStd]); // eslint-disable-line react-hooks/exhaustive-deps
  const stunden = useMemo(() => [...new Set([...alleOffen, ...bearbeitet].map((x) => x.stunde))].sort((a, b) => a - b), [alleOffen, bearbeitet]);
  const jahrgaenge = useMemo(() => [...new Set(alleOffen.map((x) => x.jahrgangText).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de', { numeric: true })), [alleOffen]);
  const abteilungen = useMemo(() => [...new Set(alleOffen.map((x) => x.abteilung).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de')), [alleOffen]);

  // Zeilen: nach Stunden gegliedert (Kopfzeile „2. Stunde 08:45–09:30 · 3“), innerhalb der Stunde in der Reihenfolge des Servers
  const zeilen = useMemo<Zeile[]>(() => {
    const liste: (OffeneStunde | BearbeiteteStunde)[] = filter === 'offen' ? offen : geloest;
    const gruppen = new Map<number, (OffeneStunde | BearbeiteteStunde)[]>();
    for (const x of liste) { if (!gruppen.has(x.stunde)) gruppen.set(x.stunde, []); gruppen.get(x.stunde)!.push(x); }
    const z: Zeile[] = [];
    for (const std of [...gruppen.keys()].sort((a, b) => a - b)) {
      const g = gruppen.get(std)!;
      z.push({ art: 'kopf', stunde: std, zeit: g[0]!.zeit, anzahl: g.length, key: `k${std}` });
      for (const x of g) z.push(filter === 'offen' ? { art: 'o', o: x as OffeneStunde, key: `o${x.id}` } : { art: 'b', b: x as BearbeiteteStunde, key: `b${x.id}` });
    }
    return z;
  }, [filter, offen, geloest]);
  const ids = useMemo(() => zeilen.flatMap((z) => (z.art === 'o' ? [z.o.id] : z.art === 'b' ? [z.b.id] : [])), [zeilen]);
  const zeileVon = useMemo(() => new Map(zeilen.map((z, i) => [z.art === 'o' ? z.o.id : z.art === 'b' ? z.b.id : -1, i])), [zeilen]);

  // Auswahl halten: nach einer Aktion die Stunde an derselben Stelle (die nächste offene), sonst die erste
  useEffect(() => {
    if (!daten) return;
    if (gewaehlt != null && ids.includes(gewaehlt)) { indexNach.current = null; return; }
    const i = indexNach.current;
    indexNach.current = null;
    setGewaehlt(ids.length ? ids[Math.min(i ?? 0, ids.length - 1)]! : null);
  }, [daten, ids]); // eslint-disable-line react-hooks/exhaustive-deps

  const offenNachId = useMemo(() => new Map(alleOffen.map((o) => [o.id, o])), [alleOffen]);
  const bearbeitetNachId = useMemo(() => new Map(bearbeitet.map((b) => [b.id, b])), [bearbeitet]);
  useEffect(() => { setMarkiert((m) => { const n = m.filter((id) => ids.includes(id)); return n.length === m.length ? m : n.length > 1 ? n : []; }); }, [ids]);
  const mehrere = markiert.length > 1;
  const sammelIds = useMemo(() => [...new Set(markiert.flatMap((id) => [id, ...(block ? offenNachId.get(id)?.blockIds || [] : [])]))], [markiert, block, offenNachId]);
  useEffect(() => {
    if (!mehrere) return;
    const o = offenNachId.get(markiert[0]!);
    if (o) auswahlMelden({ id: o.id, ids: markiert, quelle: QUELLE, text: `${markiert.length} Stunden`, zeile: { v: o.id, klasse: o.klasse, lehrer: o.lehrerId, datum, stunde: o.stunde } });
  }, [markiert.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  // gewählte Stunde melden: Pläne, „Wer ist frei?“ und alle Kandidaten folgen
  useEffect(() => {
    if (gewaehlt == null || markiert.length > 1) return;
    const o = offenNachId.get(gewaehlt);
    const b = bearbeitetNachId.get(gewaehlt);
    if (o) auswahlSetzen(o, datum);
    else if (b) auswahlSetzen(b, datum, b.vertreter);
  }, [gewaehlt, offenNachId, bearbeitetNachId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Auswahl aus einem Plan oder einer anderen Ansicht übernehmen
  useEreignis('vertretung.auswahl', (x) => {
    if (!x || x.quelle === QUELLE || x.id === gewaehlt || !(offenNachId.has(x.id) || bearbeitetNachId.has(x.id))) return;
    setFilter(offenNachId.has(x.id) ? 'offen' : 'bearbeitet'); setSuche(''); setNurStd(''); setNurJg(''); setNurAbt(''); setGewaehlt(x.id);
  });

  const virt = useVirtualizer({
    count: zeilen.length, getScrollElement: () => scrollRef.current, overscan: 12, getItemKey: (i) => zeilen[i]?.key ?? i,
    estimateSize: (i) => (zeilen[i]?.art === 'kopf' ? HOEHE_KOPF : HOEHE_ZEILE),
  });
  const index = gewaehlt != null ? ids.indexOf(gewaehlt) : -1;
  // Kandidaten der gewählten und der nächsten beiden Stunden (die Entscheidung steht sofort bereit)
  useEffect(() => {
    if (filter !== 'offen' || index < 0) return;
    kandidatenAnfordern(ids.slice(index, index + 3));
  }, [index, ids, filter, kStand]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const z = gewaehlt != null ? zeileVon.get(gewaehlt) : undefined; if (z != null) virt.scrollToIndex(z, { align: 'auto' }); }, [gewaehlt]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (e.button !== 0 || e.ctrlKey || e.shiftKey || e.metaKey || filter !== 'offen') return;
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
    setMarkiert([]);
    setGewaehlt(ids[i]!);
  };
  const [zuletzt, setZuletzt] = useState<string | null>(null);
  useEffect(() => { setZuletzt(null); }, [datum]);
  const aktion = (id: number, f: () => Promise<unknown>, text?: string) => {
    if (!schreiben) return;
    indexNach.current = ids.indexOf(id);
    f().then((r) => { if (r !== null && text) setZuletzt(text); scrollRef.current?.focus({ preventScroll: true }); }).catch(fehlerMelden);
  };

  async function automatik() {
    if (!datum) return;
    setProbeLaeuft(true);
    try { setProbe(await probeLaden(datum)); } catch (e) { fehlerMelden(e); } finally { setProbeLaeuft(false); }
  }

  const o = gewaehlt != null && filter === 'offen' ? offenNachId.get(gewaehlt) ?? null : null;
  const b = gewaehlt != null && filter === 'bearbeitet' ? bearbeitetNachId.get(gewaehlt) ?? null : null;
  const eProps: EntscheidungProps = { o, b, info: o ? werte[o.id] : undefined, block, schreiben, aktion, stand: index >= 0 && ids.length > 1 ? `${index + 1} von ${ids.length}` : undefined };

  // Tasten: J/K bzw. ↓/↑, Pos1/Ende, Esc, A, mehrere markiert: 1–3, E, O, B, R; sonst die Tasten der Entscheidung
  const tasteRef = useRef<(e: KeyboardEvent) => boolean>(() => false);
  tasteRef.current = (e: KeyboardEvent) => {
    if (probe) return false;
    const k = e.key.toLowerCase();
    if (k === 'j' || e.key === 'ArrowDown') { blaettern(1); return true; }
    if (k === 'k' || e.key === 'ArrowUp') { blaettern(-1); return true; }
    if (k === 'a' && schreiben && alleOffen.length) { void automatik(); return true; }
    if (e.key === 'Escape' && markiert.length) { setMarkiert([]); return true; }
    if (mehrere && schreiben) {
      const g = gemeinsamRef.current;
      const nach = (f: () => Promise<unknown>) => { f().then((r) => { if (r !== null) sammelFertig(); }).catch(fehlerMelden); };
      if (/^[1-3]$/.test(e.key) || e.key === 'Enter') { const c = g?.kandidaten[e.key === 'Enter' ? 0 : Number(e.key) - 1]; if (c && g) nach(() => alleZuweisen(g.ids, c.lehrer)); return true; }
      if (k === 'e') { nach(() => entfallen(sammelIds)); return true; }
      if (k === 'o') { nach(() => ohneLehrkraft(sammelIds)); return true; }
      if (k === 'b' && g?.betreuung) { nach(() => alleBetreuen(g.ids, g.betreuung!.lehrer)); return true; }
      if (k === 'r') { nach(async () => ((await raumDialog(sammelIds[0]!, sammelIds, QUELLE)) ? true : null)); return true; }
      return false;
    }
    return entscheidungsTaste(e, eProps, mehrRef.current);
  };
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest('input, textarea, select, [contenteditable=true], [data-tabelle], [role=dialog], [role=menu], [role=listbox]:not([data-testid=arbeitsliste])'))) return;
      // Enter bzw. Leertaste auf einem Knopf: der Knopf selbst
      if ((e.key === 'Enter' || e.key === ' ') && t?.closest('button, a')) return;
      if (document.querySelector('[role=dialog], .fui-OverlayDrawer')) return;
      if (tasteRef.current(e)) e.preventDefault();
    };
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  }, []);
  const listenTaste = (e: RKeyboardEvent<HTMLDivElement>) => { if (e.key === 'Home') { setGewaehlt(ids[0] ?? null); e.preventDefault(); } else if (e.key === 'End') { setGewaehlt(ids[ids.length - 1] ?? null); e.preventDefault(); } };

  const tasten: MenueListe = [
    { titel: 'Tasten der Tagesplanung' },
    { text: 'Empfehlung übernehmen', taste: 'Enter / 1', aktion: () => {} },
    { text: 'Alternative übernehmen', taste: '2 3', aktion: () => {} },
    { text: 'Nächste / vorherige Stunde', taste: 'J / K, ↓ / ↑', aktion: () => {} },
    { text: 'Entfall', taste: 'E', aktion: () => {} },
    { text: 'Zusammenlegen (Betreuung)', taste: 'B', aktion: () => {} },
    { text: 'Ohne Lehrkraft', taste: 'O', aktion: () => {} },
    { text: 'Raum zuordnen …', taste: 'R', aktion: () => {} },
    { text: 'Weitere Möglichkeiten', taste: 'M', aktion: () => {} },
    { text: 'Alle Kandidaten', taste: 'V', aktion: () => tpKontextSetzen('vorschlag') },
    { text: 'Wer ist frei?', taste: 'F', aktion: () => tpKontextSetzen('frei') },
    { text: 'Pläne ein- und ausblenden', taste: 'P', aktion: () => tpKontextUmschalten() },
    { text: 'Empfehlungen für alle prüfen', taste: 'A', aktion: () => void automatik() },
    { text: 'Gelöste Stunde zurücksetzen', taste: 'Entf', aktion: () => {} },
    null,
    { text: 'Mehrere Stunden: Strg+Klick, Umschalt+Klick oder mit gedrückter Maustaste ziehen; Esc hebt auf', aktion: () => {} },
  ];

  const nOffen = alleOffen.length;
  const zeigeFilter = filterAktiv || alleOffen.length + bearbeitet.length > 8;
  const leerText = !daten ? '' : !daten.unterrichtstag ? 'An diesem Tag findet kein Unterricht statt.'
    : filterAktiv ? 'Keine Stunde passt zum Filter.' : filter === 'offen' ? 'Keine offenen Stunden.' : 'Heute wurde noch keine Stunde bearbeitet.';
  const reiter = (w: Filter, text: string, n: number, titel: string) => (
    <button type="button" role="tab" aria-selected={filter === w} data-wert={w} className={mergeClasses('tp-reiter', filter === w && 'aktiv')} title={titel}
      onClick={() => { if (filter !== w) { setFilter(w); setGewaehlt(null); setMarkiert([]); } }}>
      {text}<span className={mergeClasses('tp-reiter-zahl', w === 'offen' && n > 0 && 'offen')}>{n}</span>
    </button>
  );

  return (
    <section className="tp-flaeche" data-ansicht="vertretung.arbeitsliste" aria-label="Offene Stunden">
      <div className="tp-spalte">
        <div className="tp-reiterzeile" role="tablist" aria-label="Offene oder gelöste Stunden" data-testid="arbeitsliste-filter">
          {reiter('offen', 'Offen', nOffen, 'Stunden ohne Lehrkraft bzw. ohne Raum')}
          {reiter('bearbeitet', 'Gelöst', bearbeitet.length, 'Heute bereits besetzte, entfallene oder geänderte Stunden')}
          <span className="tp-reiter-rechts"><MenueKnopf art="knopf" size="small" appearance="subtle" text="" titel="Tasten der Tagesplanung" eintraege={tasten} testid="tasten" icon={<Keyboard20Regular />} /></span>
        </div>
        {zeigeFilter ? (
          <div className="tp-filter" data-testid="arbeitsliste-suche">
            <Input size="small" className={s.suche} placeholder="Klasse, Fach, Lehrkraft" value={suche} onChange={(_, d) => setSuche(d.value)} aria-label="Stunden filtern" />
            <Popover positioning="below-end" trapFocus>
              <PopoverTrigger disableButtonEnhancement>
                <Button size="small" appearance={nFilter ? 'secondary' : 'subtle'} data-testid="arbeitsliste-filtern" title="Nur eine Stunde, einen Jahrgang oder eine Abteilung zeigen">
                  {nFilter ? `Filter (${nFilter})` : 'Filter'}
                </Button>
              </PopoverTrigger>
              <PopoverSurface className="tp-filterflaeche">
                <label className="tp-filterfeld"><span>Stunde</span>
                  <Select size="small" value={nurStd} onChange={(_, d) => setNurStd(d.value)} aria-label="Stunde">
                    <option value="">alle</option>{stunden.map((n) => <option key={n} value={String(n)}>{`${n}. Stunde`}</option>)}
                  </Select>
                </label>
                {jahrgaenge.length > 1 ? (
                  <label className="tp-filterfeld"><span>Jahrgang</span>
                    <Select size="small" value={nurJg} onChange={(_, d) => setNurJg(d.value)} aria-label="Jahrgang">
                      <option value="">alle</option>{jahrgaenge.map((j) => <option key={j} value={j}>{j}</option>)}
                    </Select>
                  </label>
                ) : null}
                {abteilungen.length > 1 ? (
                  <label className="tp-filterfeld"><span>Abteilung</span>
                    <Select size="small" value={nurAbt} onChange={(_, d) => setNurAbt(d.value)} aria-label="Abteilung">
                      <option value="">alle</option>{abteilungen.map((j) => <option key={j} value={j}>{j}</option>)}
                    </Select>
                  </label>
                ) : null}
                {nFilter ? <Button size="small" appearance="subtle" onClick={() => { setNurStd(''); setNurJg(''); setNurAbt(''); }}>Filter aufheben</Button> : null}
              </PopoverSurface>
            </Popover>
          </div>
        ) : null}
        {!daten ? <div className="tp-leer">{laedt ? 'Wird geladen …' : ''}</div> : !ids.length ? <div className="tp-leer">{leerText}</div> : (
          <div ref={scrollRef} className="tp-liste" tabIndex={0} role="listbox" aria-multiselectable aria-label={filter === 'offen' ? 'Offene Stunden' : 'Gelöste Stunden'} onKeyDown={listenTaste} data-testid="arbeitsliste">
            <div style={{ height: virt.getTotalSize(), position: 'relative', width: '100%' }}>
              {virt.getVirtualItems().map((v) => {
                const z = zeilen[v.index]!;
                const stil = { position: 'absolute' as const, top: 0, left: 0, right: 0, height: v.size, transform: `translateY(${v.start}px)` };
                if (z.art === 'kopf') {
                  return (
                    <div key={v.key} className="tp-gruppe" style={stil} role="presentation">
                      <span className="tp-gruppe-std">{`${z.stunde}. Stunde`}</span><span className="tp-gruppe-zeit">{z.zeit}</span><span className="tp-gruppe-zahl">{z.anzahl}</span>
                    </div>
                  );
                }
                const id = z.art === 'o' ? z.o.id : z.b.id;
                const istGewaehlt = id === gewaehlt;
                const istMarkiert = mehrere && markiert.includes(id);
                return (
                  <div key={v.key} style={stil} role="option" aria-selected={istGewaehlt || istMarkiert} data-id={id}
                    className={mergeClasses('tp-zeile', istGewaehlt && 'gewaehlt', istMarkiert && 'markiert', z.art === 'b' && 'geloest', z.art === 'o' && z.o.klausur && 'klausur')}
                    onClick={(e) => waehlen(id, e)} onMouseDown={(e) => maus.runter(id, e)} onMouseEnter={(e) => maus.rein(id, e)}>
                    {z.art === 'o' ? <OffenZeile o={z.o} block={block} /> : <GeloestZeile b={z.b} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {schreiben && filter === 'offen' && nOffen > 1 ? (
          <div className="tp-fuss">
            <Button size="small" onClick={() => void automatik()} disabled={probeLaeuft || !!probe} data-testid="alle-empfehlungen" title="Die Automatik schlägt für alle offenen Stunden eine Lösung vor – zur Prüfung, noch ohne Änderung (A)">
              {probeLaeuft ? 'Wird berechnet …' : filterAktiv ? `Empfehlungen für ${offen.length} prüfen …` : 'Empfehlungen für alle prüfen …'}
            </Button>
          </div>
        ) : null}
      </div>
      <div className="tp-rechts" data-testid="entscheidung-flaeche">
        {probe ? (
          <Pruefung probe={probe} schreiben={schreiben} schliessen={() => setProbe(null)} nurIds={filterAktiv ? new Set(offen.map((x) => x.id)) : null}
            uebernommen={(fertig) => setProbe((p) => { if (!p) return p; const rest = p.vorschlaege.filter((v) => !fertig.includes(v.id)); return rest.length ? { ...p, vorschlaege: rest } : null; })} />
        ) : mehrere ? (
          <Sammelleiste ids={sammelIds} schreiben={schreiben} aufheben={() => setMarkiert([])} fertig={sammelFertig} beiDaten={(g) => { gemeinsamRef.current = g; }} />
        ) : o || b ? <>
          {zuletzt ? (
            <div className="tp-zuletzt" data-testid="zuletzt">
              <span>{`Zuletzt: ${zuletzt}`}</span>
              <button type="button" className="tp-link" onClick={() => { setZuletzt(null); rueckgaengig().catch(fehlerMelden); }} title="Letzte Änderung zurücknehmen (Strg+Z)">Rückgängig</button>
            </div>
          ) : null}
          <Entscheidung {...eProps} mehrRef={mehrRef} />
        </>
          : daten ? (
            <div className="tp-leer">
              {leerText}
              {daten.unterrichtstag && !filterAktiv && filter === 'offen' && schreiben ? (
                <span className="tp-leer-knoepfe">
                  <Button size="small" onClick={() => tpBlattSetzen('abwesenheiten')}>Abwesenheit erfassen …</Button>
                  <Button size="small" appearance="primary" onClick={() => tpBlattSetzen('veroeffentlichen')}>Veröffentlichen …</Button>
                </span>
              ) : null}
            </div>
          ) : null}
      </div>
    </section>
  );
}
