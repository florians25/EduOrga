// Tagesübersicht der Tagesplanung als Matrix („Klassen“ bzw. „Lehrkräfte“): Zeilen = Klassen (nach Jahrgang gegliedert, einklappbar)
// bzw. Lehrkräfte (abwesende zuerst), Spalten = Stunden des Planungstags. Jede Zelle zeigt die Stunde kompakt (Fach, Raum, Lehrkraft
// bzw. Klasse) mit ihrem Stand: regulär (ruhig), offen (rote Linie, „?“), vertreten (violett, bisherige Lehrkraft durchgestrichen),
// Raumänderung, ohne Lehrkraft, Entfall (schraffiert, Fach durchgestrichen), zusätzlich/verlegt, Termin, Klausur; Doppelstunden als
// eine Zelle, eine abwesende Klasse (Ausflug) als durchgehendes Band. Im Spaltenkopf je Stunde die offenen Stunden und die verfügbaren
// Lehrkräfte (Bereitschaft, freigesetzt, Hohlstunde), darunter die Bereitschaften des Tages. Rechts die Entscheidung zur gewählten
// Zelle (Empfehlung, Alternativen, Entfall …); Mehrfachauswahl (Strg/Umschalt+Klick, Ziehen) mit gemeinsamen Kandidaten. Tasten:
// Pfeile bewegen, J/K nächste/vorherige offene Stunde, Enter/1–3 Empfehlung/Alternativen, E, B, O, R, M, Entf, P Miniplan, Esc.
// Kontextmenü: Pläne als Miniplan, Entfall, Abwesenheit der Klasse (Ausflug) bzw. Lehrkraft ab dieser Stunde, Abwesenheit entfernen.
import { Button, Checkbox, Input, Popover, PopoverSurface, PopoverTrigger, Select, Spinner, mergeClasses } from '@fluentui/react-components';
import { Keyboard20Regular } from '@fluentui/react-icons';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useRef, useState, type MouseEvent as RMouseEvent } from 'react';
import { api } from '@/api/client';
import type { AnsichtProps } from '@/kern/ansichten';
import { rueckgaengig } from '@/kern/dokument';
import { useEreignis } from '@/kern/ereignisse';
import { useDaten } from '@/kern/laden';
import { elemente, useDarfSchreiben, useStudio } from '@/kern/zustand';
import { formular } from '@/komponenten/dialoge';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { MenueKnopf, menue, type MenueListe } from '@/komponenten/menue';
import { absenzenSpeichern } from '../Absenzen';
import { mitRueckfragen, tpAnsichtSetzen, tpBlattSetzen, tpKontextSetzen, usePlanungsdatum, vpfad } from '../kern';
import { Pruefung } from './Arbeitsliste';
import {
  QUELLE, alleBetreuen, alleZuweisen, arbeitslisteLaden, auswahlSetzen, entfallen, kandidatenAnfordern, mehrzahl, ohneLehrkraft, probeLaden,
  useKandidaten, zuruecksetzen, type Gemeinsam, type Probe,
} from './daten';
import { Entscheidung, entscheidungsTaste, type EntscheidungProps } from './Entscheidung';
import { miniplaeneFolgen, miniplaeneUmschalten, miniplanOeffnen } from './Miniplan';
import { Sammelleiste } from './Sammelleiste';
import './ablauf.css';
import './matrix.css';

/** Stunde in einer Zelle (Kurzform des Servers). */
export interface ME {
  v: number | null; u: number | null; s: string; f: string; fa: string; l: string; la: string; r: string; ra: string; k: string;
  li: number | null; lo: number | null; ri: number | null; ki: number | null; art: string; t: string; kl: boolean;
  /** das Element der Zeile nimmt nicht mehr teil (z. B. abwesende Lehrkraft, deren Stunde vertreten wird) */
  w?: boolean;
}
interface Abw { s: number; a: 'absenz' | 'termin'; id: number; t: string }
interface MZeile { id: number; k: string; name: string; gruppe: string; rang: number; abw: Abw[]; zellen: { s: number; e: ME[] }[] }
interface MStunde { nr: number; zeit: string; bereit: string[]; freigesetzt: string[]; hohl: string[]; bereitschaften: { k: string; id: number; stand: string }[] }
interface MDaten { datum: string; art: 'klasse' | 'lehrer'; unterrichtstag: boolean; frei: string; stunden: MStunde[]; zeilen: MZeile[]; ohneZeile: number }

type Seg = { von: number; len: number; art: 'z' | 'abw' | 'leer'; e: ME[]; abw?: Abw };
type Reihe = { art: 'gruppe'; key: string; text: string; n: number; offen: number; zu: boolean } | { art: 'z'; key: string; z: MZeile; segs: Seg[]; offen: number; geaendert: boolean };

const PRIO: Record<string, number> = { o: 0, ro: 1, v: 2, r: 2, x: 2, z: 2, k: 2, t: 2, e: 3, n: 4, b: 5 };
const OFFEN = (e: ME) => e.s === 'o' || e.s === 'ro';
const sig = (e: ME) => [e.u, e.s, e.f, e.l, e.la, e.r, e.ra, e.k].join('|');
const HOEHE = 44, HOEHE_GRUPPE = 28;
const MX_QUELLE = 'tagesmatrix';
const STATUS_TEXT: Record<string, string> = {
  n: 'regulär', o: 'offen – Vertretung fehlt', ro: 'Raum fehlt', v: 'vertreten', r: 'Raumänderung', x: 'ohne Lehrkraft', e: 'entfällt', z: 'zusätzlich bzw. verlegt',
  t: 'Termin', k: 'Klausur', b: 'Bereitschaft',
};

/** Zellen einer Zeile: Abwesenheit (Klasse) als Band, Doppelstunden zusammengefasst, sonst je Stunde eine Zelle. */
function segmente(z: MZeile, stunden: number[], lehrer: boolean, block: boolean): Seg[] {
  const zellen = new Map(z.zellen.map((c) => [c.s, [...c.e].sort((a, b) => (PRIO[a.s] ?? 9) - (PRIO[b.s] ?? 9))]));
  const abw = new Map(z.abw.map((a) => [a.s, a]));
  const segs: Seg[] = [];
  for (let i = 0; i < stunden.length;) {
    const s = stunden[i]!;
    const a = abw.get(s);
    if (a && !lehrer) {
      let n = 1;
      while (i + n < stunden.length && abw.get(stunden[i + n]!)?.id === a.id) n++;
      segs.push({ von: i, len: n, art: 'abw', e: stunden.slice(i, i + n).flatMap((x) => zellen.get(x) || []), abw: a });
      i += n;
      continue;
    }
    const es = zellen.get(s) || [];
    if (!es.length) { segs.push({ von: i, len: 1, art: 'leer', e: [], abw: a }); i++; continue; }
    let n = 1;
    if (es.length === 1 && (es[0]!.s !== 'o' || block)) {
      while (i + n < stunden.length) {
        const nx = zellen.get(stunden[i + n]!) || [];
        if (nx.length !== 1 || sig(nx[0]!) !== sig(es[0]!) || !!abw.get(stunden[i + n]!) !== !!a || (!lehrer && abw.get(stunden[i + n]!))) break;
        n++;
      }
    }
    segs.push({ von: i, len: n, art: 'z', e: n > 1 ? stunden.slice(i, i + n).flatMap((x) => zellen.get(x) || []) : es, abw: a });
    i += n;
  }
  return segs;
}

/** Kurzinfo einer Zelle. */
function zellTitel(z: MZeile, seg: Seg, st: MStunde[], lehrer: boolean) {
  const von = st[seg.von]!, bis = st[seg.von + seg.len - 1]!;
  const kopf = `${z.k} · ${seg.len > 1 ? `${von.nr}.–${bis.nr}.` : `${von.nr}.`} Stunde`;
  if (seg.art === 'abw') return `${kopf}\n${seg.abw!.a === 'absenz' ? 'Klasse abwesend' : 'Termin'}${seg.abw!.t ? `: ${seg.abw!.t}` : ''}${seg.e.length ? `\n${seg.e.length} Stunde(n) entfallen bzw. freigesetzt` : ''}`;
  const zeilen = [...new Map(seg.e.map((e) => [sig(e), e])).values()].map((e) => {
    const wer = lehrer ? e.k : e.l || (e.la ? '???' : '');
    return `${e.f}${e.fa ? ` (statt ${e.fa})` : ''} ${wer}${e.la && !lehrer ? ` statt ${e.la}` : ''}${e.r ? ` · ${e.r}` : ''}${e.ra ? ` statt ${e.ra}` : ''} – ${STATUS_TEXT[e.s] || e.s}${e.art && e.s !== 'n' ? ` (${e.art})` : ''}${e.t ? `\n  ${e.t}` : ''}`;
  });
  return [kopf, ...(seg.abw ? [`abwesend${seg.abw.t ? `: ${seg.abw.t}` : ''}`] : []), ...zeilen].join('\n');
}

/** Inhalt einer Zelle: Fach und Raum oben, Lehrkraft (bzw. Klasse) darunter; Änderungen mit bisherigem Wert durchgestrichen. */
function Zelle({ e, mehr, lehrer }: { e: ME; mehr: number; lehrer: boolean }) {
  const offen = e.s === 'o';
  const zweit = lehrer ? e.k : e.l;
  const alt = lehrer ? '' : e.la;
  return (
    <>
      <span className="mx-z1">
        <span className="mx-f">{e.f || e.art || '—'}</span>
        {mehr > 0 ? <span className="mx-mehr">{`+${mehr}`}</span> : null}
        <span className={mergeClasses('mx-r', !!e.ra && 'neu')}>{e.s === 'ro' ? '?' : e.r}</span>
      </span>
      <span className="mx-z2">
        {alt ? <s className="mx-alt">{alt}</s> : null}
        {offen && !lehrer ? <span className="mx-frage">?</span> : e.s === 'x' ? <span className="mx-neu">ohne</span> : <span className={mergeClasses('mx-l', !!alt && 'mx-neu')}>{zweit}</span>}
        {lehrer && e.w && e.s === 'v' ? <span className="mx-neu">{`→ ${e.l || '?'}`}</span> : lehrer && offen ? <span className="mx-frage">?</span> : null}
      </span>
    </>
  );
}

export default function Matrix({ p }: AnsichtProps) {
  const art = (p as { art?: string } | undefined)?.art === 'lehrer' ? 'lehrer' : 'klasse';
  const lehrer = art === 'lehrer';
  const datum = usePlanungsdatum();
  const schreiben = useDarfSchreiben();
  const benutzer = useStudio((x) => x.benutzer?.name || '');
  const block = useKandidaten((x) => x.block);
  const werte = useKandidaten((x) => x.werte);
  const kStand = useKandidaten((x) => x.stand);
  const bereiche = ['Vertretung', 'Stundenplan', 'Unterricht', 'Stammdaten', 'Einstellungen'] as const;
  const { daten, laedt } = useDaten(() => api.get<MDaten>(vpfad(`/tagesablauf/matrix?datum=${datum}&art=${art}`)), [datum, art], { bereiche: [...bereiche], aktiv: !!datum });
  const { daten: liste } = useDaten(() => arbeitslisteLaden(datum!), [datum], { bereiche: [...bereiche], aktiv: !!datum });

  // Filter (je Benutzer gemerkt): nur Zeilen mit Änderungen, Jahrgang, Suche; eingeklappte Gruppen
  const merkSchluessel = `vertretung.matrix.${art}.${benutzer}`;
  const [merk, setMerk] = useState<{ nurAenderungen: boolean; zu: string[] }>(() => {
    try { const w = JSON.parse(localStorage.getItem(merkSchluessel) || 'null'); if (w) return { nurAenderungen: !!w.nurAenderungen, zu: Array.isArray(w.zu) ? w.zu : [] }; } catch { /* privat */ }
    return { nurAenderungen: false, zu: [] };
  });
  const merken = (n: Partial<typeof merk>) => setMerk((m) => { const x = { ...m, ...n }; try { localStorage.setItem(merkSchluessel, JSON.stringify(x)); } catch { /* privat */ } return x; });
  const [suche, setSuche] = useState('');
  const [nurJg, setNurJg] = useState('');

  // sichtbare Stunden: bis zur letzten Stunde mit Unterricht (mindestens 6)
  const stunden = useMemo(() => {
    if (!daten) return [];
    let letzte = 6;
    for (const z of daten.zeilen) for (const c of z.zellen) letzte = Math.max(letzte, c.s);
    return daten.stunden.filter((s) => s.nr <= letzte);
  }, [daten]);
  const nrs = useMemo(() => stunden.map((s) => s.nr), [stunden]);

  const offenNachId = useMemo(() => new Map((liste?.offen || []).map((o) => [o.id, o])), [liste]);
  const bearbeitetNachId = useMemo(() => new Map((liste?.bearbeitet || []).map((b) => [b.id, b])), [liste]);
  const jahrgaenge = useMemo(() => [...new Set((daten?.zeilen || []).map((z) => z.gruppe).filter(Boolean))], [daten]);

  const reihen = useMemo<Reihe[]>(() => {
    if (!daten) return [];
    const t = suche.trim().toLowerCase();
    const r: Reihe[] = [];
    let gruppe: Reihe | null = null;
    const gruppen = new Set(daten.zeilen.map((z) => z.gruppe));
    const mitKopf = gruppen.size > 1;
    for (const z of daten.zeilen) {
      if (nurJg && z.gruppe !== nurJg) continue;
      const alle = z.zellen.flatMap((c) => c.e);
      const offen = alle.filter(OFFEN).length;
      const geaendert = z.abw.length > 0 || alle.some((e) => e.s !== 'n' && e.s !== 'b');
      if (merk.nurAenderungen && !geaendert) continue;
      if (t && !`${z.k} ${z.name}`.toLowerCase().includes(t) && !alle.some((e) => `${e.f} ${e.l} ${e.la} ${e.k}`.toLowerCase().split(/[\s,]+/).includes(t))) continue;
      if (mitKopf && (gruppe?.art !== 'gruppe' || gruppe.text !== (z.gruppe || '–'))) {
        gruppe = { art: 'gruppe', key: `g:${z.gruppe}`, text: z.gruppe || '–', n: 0, offen: 0, zu: merk.zu.includes(z.gruppe || '–') };
        r.push(gruppe);
      }
      if (gruppe?.art === 'gruppe') { gruppe.n++; gruppe.offen += offen; if (gruppe.zu) continue; }
      r.push({ art: 'z', key: `z:${z.id}`, z, segs: segmente(z, nrs, lehrer, block), offen, geaendert });
    }
    return r;
  }, [daten, nrs, lehrer, block, suche, nurJg, merk]);
  const datenReihen = useMemo(() => reihen.map((x, i) => (x.art === 'z' ? i : -1)).filter((i) => i >= 0), [reihen]);
  const reiheVon = useMemo(() => new Map(reihen.map((x, i) => [x.art === 'z' ? x.z.id : -1, i])), [reihen]);

  // offene Zellen in Reihenfolge der Stunden (Spalte für Spalte, darin von oben nach unten)
  const offeneZellen = useMemo(() => {
    const l: { zeile: number; col: number; pos: number; v: number }[] = [];
    datenReihen.forEach((ri, pos) => {
      const x = reihen[ri] as Extract<Reihe, { art: 'z' }>;
      for (const sg of x.segs) if (sg.art === 'z') { const o = sg.e.find(OFFEN); if (o?.v) l.push({ zeile: x.z.id, col: sg.von, pos, v: o.v }); }
    });
    return l.sort((a, b) => a.col - b.col || a.pos - b.pos);
  }, [reihen, datenReihen]);

  // Auswahl: Zeile (Element) und Spalte; idx = Eintrag der Zelle (mehrere Stunden gleichzeitig)
  const [wahl, setWahl] = useState<{ zeile: number; col: number; idx: number } | null>(null);
  const [markiert, setMarkiert] = useState<number[]>([]);
  const [zuletzt, setZuletzt] = useState<string | null>(null);
  const [probe, setProbe] = useState<Probe | null>(null);
  const [probeLaeuft, setProbeLaeuft] = useState(false);
  const weiter = useRef<{ col: number; pos: number } | null>(null);
  const zug = useRef<{ start: { zeile: number; col: number }; gezogen: boolean } | null>(null);
  const gemeinsamRef = useRef<Gemeinsam | null>(null);
  const mehrRef = useRef<HTMLSpanElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setWahl(null); setMarkiert([]); setZuletzt(null); setProbe(null); }, [datum, art]);
  useEffect(() => { const ende = () => { setTimeout(() => { zug.current = null; }); }; document.addEventListener('mouseup', ende); return () => document.removeEventListener('mouseup', ende); }, []);

  const segAn = (zeile: number, col: number): Seg | null => {
    const ri = reiheVon.get(zeile);
    const x = ri != null ? reihen[ri] : null;
    return x?.art === 'z' ? x.segs.find((s) => col >= s.von && col < s.von + s.len) ?? null : null;
  };
  const gewaehltSeg = wahl ? segAn(wahl.zeile, wahl.col) : null;
  const gewaehltZeile = wahl ? (reihen[reiheVon.get(wahl.zeile) ?? -1] as Extract<Reihe, { art: 'z' }> | undefined) : undefined;
  const eintrag: ME | null = gewaehltSeg?.art === 'z' ? gewaehltSeg.e[Math.min(wahl!.idx, gewaehltSeg.e.length - 1)] ?? null : null;
  const o = eintrag?.v ? offenNachId.get(eintrag.v) ?? null : null;
  const b = eintrag?.v && !o ? bearbeitetNachId.get(eintrag.v) ?? null : null;
  const mehrere = markiert.length > 1;
  const sammelIds = useMemo(() => [...new Set(markiert.flatMap((id) => [id, ...(block ? offenNachId.get(id)?.blockIds || [] : [])]))], [markiert, block, offenNachId]);

  // nach einer Entscheidung: nächste offene Zelle (ab der bisherigen Stelle); sonst die Auswahl auf eine gültige Zelle stellen
  useEffect(() => {
    if (!daten) return;
    const w = weiter.current;
    if (w) {
      weiter.current = null;
      const n = offeneZellen.find((x) => x.col > w.col || (x.col === w.col && x.pos >= w.pos)) ?? offeneZellen[0];
      if (n) { setWahl({ zeile: n.zeile, col: n.col, idx: 0 }); return; }
    }
    if (wahl && !segAn(wahl.zeile, wahl.col)) setWahl(null);
  }, [daten, reihen]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setMarkiert((m) => { const n = m.filter((id) => offenNachId.has(id)); return n.length === m.length ? m : n.length > 1 ? n : []; }); }, [offenNachId]);

  // Auswahl melden: Kontextbereich (Pläne, Wer ist frei?, Kandidaten) und Minipläne folgen
  useEffect(() => {
    if (mehrere) return;
    if (o) auswahlSetzen(o, datum);
    else if (b) auswahlSetzen(b, datum, b.vertreter);
    const z = gewaehltZeile?.z;
    if (!z) return;
    const e = eintrag;
    miniplaeneFolgen({
      klasse: lehrer ? { id: e?.ki, kurz: (e?.k || '').split(',')[0] || '' } : { id: z.id, kurz: z.k },
      lehrer: lehrer ? { id: z.id, kurz: z.k } : { id: e?.li ?? e?.lo, kurz: e?.l || e?.la || '' },
      raum: { id: e?.ri, kurz: e?.r || '' },
    });
  }, [wahl?.zeile, wahl?.col, wahl?.idx, o?.id, b?.id, eintrag?.v]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!mehrere) return;
    const x = offenNachId.get(markiert[0]!);
    if (x) auswahlSetzen({ ...x, id: x.id }, datum);
  }, [markiert.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  // Auswahl aus einem Miniplan oder einer anderen Ansicht übernehmen
  useEreignis('vertretung.auswahl', (x) => {
    if (!x || x.quelle === QUELLE || x.quelle === MX_QUELLE || x.id === eintrag?.v) return;
    for (const ri of datenReihen) {
      const r = reihen[ri] as Extract<Reihe, { art: 'z' }>;
      for (const sg of r.segs) {
        const idx = sg.e.findIndex((e) => e.v === x.id);
        if (idx >= 0) { setMarkiert([]); setWahl({ zeile: r.z.id, col: sg.von, idx }); return; }
      }
    }
  });

  // Kandidaten der gewählten und der nächsten beiden offenen Stunden
  useEffect(() => {
    if (!o) return;
    const i = offeneZellen.findIndex((x) => x.v === o.id);
    kandidatenAnfordern([o.id, ...offeneZellen.slice(i + 1, i + 3).map((x) => x.v)]);
  }, [o?.id, offeneZellen, kStand]); // eslint-disable-line react-hooks/exhaustive-deps

  const virt = useVirtualizer({
    count: reihen.length, getScrollElement: () => scrollRef.current, overscan: 8, getItemKey: (i) => reihen[i]?.key ?? i,
    estimateSize: (i) => (reihen[i]?.art === 'gruppe' ? HOEHE_GRUPPE : HOEHE),
  });
  useEffect(() => { const ri = wahl ? reiheVon.get(wahl.zeile) : undefined; if (ri != null) virt.scrollToIndex(ri, { align: 'auto' }); }, [wahl?.zeile]); // eslint-disable-line react-hooks/exhaustive-deps

  const waehlen = (zeile: number, col: number, idx = 0) => { setWahl({ zeile, col, idx }); };
  /** offene Vertretungen im Rechteck zwischen zwei Zellen */
  const rechteck = (a: { zeile: number; col: number }, c: { zeile: number; col: number }) => {
    const p1 = datenReihen.indexOf(reiheVon.get(a.zeile) ?? -1), p2 = datenReihen.indexOf(reiheVon.get(c.zeile) ?? -1);
    if (p1 < 0 || p2 < 0) return [];
    const ids: number[] = [];
    for (let p = Math.min(p1, p2); p <= Math.max(p1, p2); p++) {
      const r = reihen[datenReihen[p]!] as Extract<Reihe, { art: 'z' }>;
      for (const sg of r.segs) if (sg.von + sg.len > Math.min(a.col, c.col) && sg.von <= Math.max(a.col, c.col)) for (const e of sg.e) if (e.s === 'o' && e.v && !ids.includes(e.v)) ids.push(e.v);
    }
    return ids;
  };
  const klick = (zeile: number, sg: Seg, ev: RMouseEvent) => {
    if (zug.current?.gezogen) return;
    const offeneIds = sg.e.filter((e) => e.s === 'o' && e.v).map((e) => e.v!);
    if ((ev.ctrlKey || ev.metaKey) && offeneIds.length) {
      setMarkiert((m) => {
        const basis = m.length ? m : eintrag?.s === 'o' && eintrag.v ? [eintrag.v] : [];
        return offeneIds.every((id) => basis.includes(id)) ? basis.filter((id) => !offeneIds.includes(id)) : [...new Set([...basis, ...offeneIds])];
      });
      waehlen(zeile, sg.von);
      return;
    }
    if (ev.shiftKey && wahl) { setMarkiert(rechteck(wahl, { zeile, col: sg.von })); return; }
    setMarkiert([]);
    waehlen(zeile, sg.von);
  };
  const maus = {
    runter: (zeile: number, sg: Seg, e: RMouseEvent) => {
      if (e.button !== 0 || e.ctrlKey || e.shiftKey || e.metaKey || !sg.e.some((x) => x.s === 'o')) return;
      zug.current = { start: { zeile, col: sg.von }, gezogen: false };
    },
    rein: (zeile: number, sg: Seg, e: RMouseEvent) => {
      const z = zug.current;
      if (!z || e.buttons !== 1 || (z.start.zeile === zeile && z.start.col === sg.von)) return;
      z.gezogen = true;
      window.getSelection()?.removeAllRanges();
      setMarkiert(rechteck(z.start, { zeile, col: sg.von }));
      waehlen(z.start.zeile, z.start.col);
    },
  };

  /** Pfeiltasten: Zelle für Zelle (zusammengefasste Zellen als eine), oben/unten in derselben Spalte. */
  const gehe = (dz: number, ds: number, erweitern = false) => {
    if (!datenReihen.length || !nrs.length) return;
    let pos = wahl ? datenReihen.indexOf(reiheVon.get(wahl.zeile) ?? -1) : -1;
    let col = wahl?.col ?? 0;
    if (pos < 0) { pos = 0; col = 0; } else {
      pos = Math.max(0, Math.min(datenReihen.length - 1, pos + dz));
      const r = reihen[datenReihen[pos]!] as Extract<Reihe, { art: 'z' }>;
      const sg = r.segs.find((s) => col >= s.von && col < s.von + s.len);
      if (ds > 0 && sg) col = Math.min(nrs.length - 1, sg.von + sg.len);
      else if (ds < 0 && sg) col = Math.max(0, sg.von - 1);
    }
    const r = reihen[datenReihen[pos]!] as Extract<Reihe, { art: 'z' }>;
    const sg = r.segs.find((s) => col >= s.von && col < s.von + s.len);
    const ziel = { zeile: r.z.id, col: sg?.von ?? col };
    if (erweitern && wahl) {
      const neu = sg?.e.filter((e) => e.s === 'o' && e.v).map((e) => e.v!) || [];
      setMarkiert((m) => [...new Set([...(m.length ? m : eintrag?.s === 'o' && eintrag.v ? [eintrag.v] : []), ...neu])]);
    } else setMarkiert([]);
    setWahl({ ...ziel, idx: 0 });
  };
  const offeneBlaettern = (r: number) => {
    if (!offeneZellen.length) return;
    const pos = wahl ? datenReihen.indexOf(reiheVon.get(wahl.zeile) ?? -1) : -1;
    const col = wahl?.col ?? -1;
    const i = offeneZellen.findIndex((x) => x.col === col && x.pos === pos);
    let n;
    if (i >= 0) n = offeneZellen[(i + r + offeneZellen.length) % offeneZellen.length];
    else if (r > 0) n = offeneZellen.find((x) => x.col > col || (x.col === col && x.pos > pos)) ?? offeneZellen[0];
    else n = [...offeneZellen].reverse().find((x) => x.col < col || (x.col === col && x.pos < pos)) ?? offeneZellen[offeneZellen.length - 1];
    setMarkiert([]);
    if (n) setWahl({ zeile: n.zeile, col: n.col, idx: 0 });
  };

  const aktion = (_id: number, f: () => Promise<unknown>, text?: string) => {
    if (!schreiben) return;
    const pos = wahl ? datenReihen.indexOf(reiheVon.get(wahl.zeile) ?? -1) : 0;
    f().then((r) => {
      if (r === null) return;
      if (text) setZuletzt(text);
      weiter.current = { col: wahl?.col ?? 0, pos };
      scrollRef.current?.focus({ preventScroll: true });
    }).catch(fehlerMelden);
  };
  const sammelFertig = () => { weiter.current = { col: wahl?.col ?? 0, pos: 0 }; setMarkiert([]); scrollRef.current?.focus({ preventScroll: true }); };
  async function automatik() {
    if (!datum) return;
    setProbeLaeuft(true);
    try { setProbe(await probeLaden(datum)); } catch (e) { fehlerMelden(e); } finally { setProbeLaeuft(false); }
  }

  // Abwesenheit aus der Matrix: Klasse (Ausflug …) bzw. Lehrkraft ab einer Stunde
  const letzteStunde = nrs[nrs.length - 1] ?? 8;
  async function abwesendMelden(typ: 'klasse' | 'lehrer', kurz: string, ab: number, ganz = false) {
    if (!datum || !kurz) return;
    let neu = { id: 0, element: kurz, von: datum, bis: datum, sv: ganz ? 1 : ab, sb: 99, grund: '', text: '' };
    if (typ === 'klasse' || !ganz) {
      const gruende = await elemente('abwesenheitsgrund').catch(() => []);
      const w = await formular(typ === 'klasse' ? `Klasse ${kurz} abwesend` : `${kurz} abwesend`, [
        { name: 'sv', titel: 'Ab Stunde', art: 'auswahl', wert: String(ganz ? 1 : ab), optionen: nrs.map((n) => ({ wert: String(n), text: `${n}. Stunde` })) },
        { name: 'sb', titel: 'Bis Stunde', art: 'auswahl', wert: String(letzteStunde), optionen: nrs.map((n) => ({ wert: String(n), text: `${n}. Stunde` })) },
        { name: 'grund', titel: 'Grund', art: 'auswahl', wert: '', optionen: [{ wert: '', text: '–' }, ...gruende.map((g) => ({ wert: g.k, text: g.l && g.l !== g.k ? `${g.k} – ${g.l}` : g.k }))] },
        { name: 'text', titel: typ === 'klasse' ? 'Text (z. B. Ausflug, Museum)' : 'Text', wert: '' },
      ], { okText: 'Speichern' });
      if (!w) return;
      const sv = Number(w.sv) || 1;
      neu = { ...neu, sv, sb: Math.max(sv, Number(w.sb) || letzteStunde), grund: w.grund || '', text: w.text || '' };
    }
    try {
      await absenzenSpeichern(typ, [neu], [], MX_QUELLE, 'Abwesenheit eingeben');
      hinweis(`${typ === 'klasse' ? `Klasse ${kurz}` : kurz} abwesend ${neu.sv <= 1 && neu.sb >= letzteStunde ? 'ganztägig' : `${neu.sv}.–${Math.min(neu.sb, letzteStunde)}. Stunde`} – Strg+Z macht es rückgängig.`, 'ok', 3000);
    } catch (e) { fehlerMelden(e); }
  }
  const absenzLoeschen = (id: number) => api.post(vpfad('/absenzen/loeschen'), { ids: [id] }, { quelle: MX_QUELLE }).then(() => hinweis('Abwesenheit entfernt – Strg+Z macht es rückgängig.', 'ok', 2500)).catch(fehlerMelden);
  const regulaerEntfall = (e: ME, stunde: number) => mitRueckfragen(vpfad('/plan/entfall'), { datum, stunde, unterricht: e.u, zeile: null }, { quelle: MX_QUELLE });

  function planMenue(z: MZeile, e: ME | null): MenueListe {
    const l: MenueListe = [];
    if (lehrer) {
      l.push({ text: `Plan von ${z.k} anzeigen`, aktion: () => miniplanOeffnen('lehrer', z.id, z.k) });
      if (e?.ki) l.push({ text: `Plan von ${e.k.split(',')[0]} anzeigen`, aktion: () => miniplanOeffnen('klasse', e.ki, e.k.split(',')[0]!) });
    } else {
      l.push({ text: `Plan von ${z.k} anzeigen`, aktion: () => miniplanOeffnen('klasse', z.id, z.k) });
      if (e?.lo && e.la) l.push({ text: `Plan von ${e.la} anzeigen`, aktion: () => miniplanOeffnen('lehrer', e.lo, e.la) });
      if (e?.li && e.l) l.push({ text: `Plan von ${e.l.split(',')[0]} anzeigen`, aktion: () => miniplanOeffnen('lehrer', e.li, e.l.split(',')[0]!) });
    }
    if (e?.ri && e.r) l.push({ text: `Plan von Raum ${e.r.split(',')[0]} anzeigen`, aktion: () => miniplanOeffnen('raum', e.ri, e.r.split(',')[0]!) });
    return l;
  }
  function zellMenue(z: MZeile, sg: Seg, ev: RMouseEvent) {
    ev.preventDefault();
    if (!wahl || wahl.zeile !== z.id || wahl.col !== sg.von) { setMarkiert([]); waehlen(z.id, sg.von); }
    const st = nrs[sg.von]!;
    const e = sg.art === 'z' ? sg.e[0]! : null;
    const l: MenueListe = [{ titel: `${z.k} · ${sg.len > 1 ? `${st}.–${nrs[sg.von + sg.len - 1]}.` : `${st}.`} Stunde${e ? ` · ${e.f} ${lehrer ? e.k : e.l || e.la}` : ''}` }, ...planMenue(z, e), null];
    if (e) {
      if (e.s === 'o' && e.v) l.push({ text: 'Entfall', taste: 'E', deaktiviert: !schreiben, aktion: () => aktion(e.v!, () => entfallen([e.v!]), `${st}. Std. ${z.k} ${e.f}: Entfall`) });
      else if (e.s === 'n' && e.u) l.push({ text: 'Stunde entfallen lassen', deaktiviert: !schreiben, aktion: () => aktion(0, () => regulaerEntfall(e, st), `${st}. Std. ${z.k} ${e.f}: Entfall`) });
      if (e.v && e.s !== 'o' && e.s !== 'n') l.push({ text: 'Änderung zurücknehmen', taste: 'Entf', deaktiviert: !schreiben, aktion: () => aktion(e.v!, () => zuruecksetzen([e.v!]), `${st}. Std. ${z.k} ${e.f}: zurückgesetzt`) });
    }
    if (sg.abw?.a === 'absenz') l.push({ text: 'Abwesenheit entfernen', deaktiviert: !schreiben, aktion: () => void absenzLoeschen(sg.abw!.id) });
    l.push(null);
    if (lehrer) {
      l.push({ text: `${z.k} ab der ${st}. Stunde abwesend …`, deaktiviert: !schreiben, aktion: () => void abwesendMelden('lehrer', z.k, st) });
    } else {
      l.push({ text: `Klasse ${z.k} ab der ${st}. Stunde abwesend (Ausflug …) …`, deaktiviert: !schreiben, aktion: () => void abwesendMelden('klasse', z.k, st) });
      if (e?.la || (e?.l && e.s === 'n')) {
        const k = e.la || e.l.split(',')[0]!;
        l.push({ text: `${k} ab der ${st}. Stunde abwesend melden`, deaktiviert: !schreiben, aktion: () => void abwesendMelden('lehrer', k, st, false) });
        l.push({ text: `${k} ganztägig abwesend melden`, deaktiviert: !schreiben, aktion: () => void abwesendMelden('lehrer', k, 1, true) });
      }
    }
    menue(ev.clientX, ev.clientY, l);
  }
  function zeilenMenue(z: MZeile, ev: RMouseEvent) {
    ev.preventDefault();
    menue(ev.clientX, ev.clientY, [
      { titel: lehrer ? `${z.k} – ${z.name}` : `Klasse ${z.k}` },
      ...planMenue(z, null), null,
      lehrer ? { text: `${z.k} ganztägig abwesend melden`, deaktiviert: !schreiben, aktion: () => void abwesendMelden('lehrer', z.k, 1, true) }
        : { text: `Klasse ${z.k} ganztägig abwesend (Ausflug …) …`, deaktiviert: !schreiben, aktion: () => void abwesendMelden('klasse', z.k, 1, true) },
      lehrer ? { text: `${z.k} stundenweise abwesend …`, deaktiviert: !schreiben, aktion: () => void abwesendMelden('lehrer', z.k, 1) } : null,
      ...z.abw.filter((a, i, l) => a.a === 'absenz' && l.findIndex((x) => x.id === a.id) === i).map((a) => ({ text: `Abwesenheit entfernen${a.t ? ` (${a.t})` : ''}`, deaktiviert: !schreiben, aktion: () => void absenzLoeschen(a.id) })),
    ]);
  }

  // Entscheidung zur gewählten Zelle
  const eProps: EntscheidungProps = { o, b, info: o ? werte[o.id] : undefined, block, schreiben, aktion, stand: o ? `${offeneZellen.findIndex((x) => x.v === o.id) + 1} von ${offeneZellen.length}` : undefined };
  const tasteRef = useRef<(e: KeyboardEvent) => boolean>(() => false);
  tasteRef.current = (e: KeyboardEvent) => {
    if (probe) return false;
    const k = e.key.toLowerCase();
    if (e.key === 'ArrowDown') { gehe(1, 0, e.shiftKey); return true; }
    if (e.key === 'ArrowUp') { gehe(-1, 0, e.shiftKey); return true; }
    if (e.key === 'ArrowRight') { gehe(0, 1, e.shiftKey); return true; }
    if (e.key === 'ArrowLeft') { gehe(0, -1, e.shiftKey); return true; }
    if (k === 'j') { offeneBlaettern(1); return true; }
    if (k === 'k') { offeneBlaettern(-1); return true; }
    if (k === 'p') { miniplaeneUmschalten(lehrer ? 'klasse' : 'lehrer'); return true; }
    if (k === 'a' && schreiben && offeneZellen.length) { void automatik(); return true; }
    if (e.key === 'Escape' && markiert.length) { setMarkiert([]); return true; }
    if (mehrere && schreiben) {
      const g = gemeinsamRef.current;
      const nach = (f: () => Promise<unknown>) => { f().then((r) => { if (r !== null) sammelFertig(); }).catch(fehlerMelden); };
      if (/^[1-3]$/.test(e.key) || e.key === 'Enter') { const c = g?.kandidaten[e.key === 'Enter' ? 0 : Number(e.key) - 1]; if (c && g) nach(() => alleZuweisen(g.ids, c.lehrer)); return true; }
      if (k === 'e') { nach(() => entfallen(sammelIds)); return true; }
      if (k === 'o') { nach(() => ohneLehrkraft(sammelIds)); return true; }
      if (k === 'b' && g?.betreuung) { nach(() => alleBetreuen(g.ids, g.betreuung!.lehrer)); return true; }
      return false;
    }
    if (o || b) return entscheidungsTaste(e, eProps, mehrRef.current);
    // reguläre Stunde: E lässt sie entfallen
    if (k === 'e' && eintrag?.s === 'n' && eintrag.u && schreiben && gewaehltZeile) {
      const st = nrs[wahl!.col]!;
      aktion(0, () => regulaerEntfall(eintrag, st), `${st}. Std. ${gewaehltZeile.z.k} ${eintrag.f}: Entfall`);
      return true;
    }
    if (k === 'v' || k === 'f') { tpKontextSetzen(k === 'v' ? 'vorschlag' : 'frei'); return true; }
    return false;
  };
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, select, [contenteditable=true], [data-tabelle], [role=dialog], [role=menu], [role=listbox], [data-testid=miniplan]')) return;
      if ((e.key === 'Enter' || e.key === ' ') && t?.closest('button, a')) return;
      if (document.querySelector('[role=dialog], .fui-OverlayDrawer')) return;
      if (tasteRef.current(e)) e.preventDefault();
    };
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  }, []);

  const tasten: MenueListe = [
    { titel: 'Tasten der Tagesübersicht' },
    { text: 'Zelle wählen', taste: '← → ↑ ↓', aktion: () => {} },
    { text: 'Nächste / vorherige offene Stunde', taste: 'J / K', aktion: () => {} },
    { text: 'Empfehlung übernehmen', taste: 'Enter / 1', aktion: () => {} },
    { text: 'Alternative übernehmen', taste: '2 3', aktion: () => {} },
    { text: 'Entfall', taste: 'E', aktion: () => {} },
    { text: 'Zusammenlegen, ohne Lehrkraft, Raum', taste: 'B O R', aktion: () => {} },
    { text: 'Weitere Möglichkeiten', taste: 'M', aktion: () => {} },
    { text: 'Änderung zurücknehmen', taste: 'Entf', aktion: () => {} },
    { text: 'Miniplan (folgt der Auswahl)', taste: 'P', aktion: () => miniplaeneUmschalten(lehrer ? 'klasse' : 'lehrer') },
    { text: 'Alle Kandidaten, Wer ist frei?', taste: 'V F', aktion: () => {} },
    { text: 'Empfehlungen für alle prüfen', taste: 'A', aktion: () => void automatik() },
    { text: 'Abwesenheit erfassen', taste: 'N', aktion: () => tpBlattSetzen('abwesenheiten') },
    null,
    { text: 'Mehrere Stunden: Strg+Klick, Umschalt+Klick, Umschalt+Pfeil oder ziehen; Esc hebt auf', aktion: () => {} },
    { text: 'Rechtsklick: Miniplan, Entfall, Abwesenheit (Klasse auf Ausflug, Lehrkraft ab dieser Stunde)', aktion: () => {} },
  ];

  // feste Spaltenbreiten aus der verfügbaren Breite (alle Zeilen gleich breit, mindestens 76 px je Stunde)
  const [breite, setBreite] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBreite(el.clientWidth));
    ro.observe(el);
    setBreite(el.clientWidth);
    return () => ro.disconnect();
  }, [!!daten, reihen.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  const kopfBreite = lehrer ? 84 : 76;
  const spalteBreite = Math.max(76, Math.floor((Math.max(0, breite - kopfBreite)) / Math.max(1, nrs.length)));
  const gesamtBreite = kopfBreite + spalteBreite * nrs.length;
  const spalten = `${kopfBreite}px repeat(${nrs.length}, ${spalteBreite}px)`;
  const offenJeSpalte = useMemo(() => { const n = new Array(nrs.length).fill(0); for (const x of offeneZellen) n[x.col]++; return n; }, [offeneZellen, nrs.length]);
  const nOffen = offeneZellen.length;
  const nKlassen = new Set(offeneZellen.map((x) => x.zeile)).size;
  const nEntfall = useMemo(() => (daten?.zeilen || []).reduce((n, z) => n + z.zellen.reduce((m, c) => m + c.e.filter((e) => e.s === 'e' && !e.kl).length, 0), 0), [daten]);
  const nAbw = useMemo(() => (daten?.zeilen || []).filter((z) => z.abw.length).length, [daten]);
  const hatBereitschaft = stunden.some((s) => s.bereitschaften.length);

  const kopfZelle = (s: MStunde, i: number) => {
    const frei = s.bereit.length + s.freigesetzt.length + s.hohl.length;
    const titel = [`${s.nr}. Stunde ${s.zeit}`, offenJeSpalte[i] ? `${offenJeSpalte[i]} offen` : 'nichts offen',
      `Verfügbar: ${frei}`, s.bereit.length ? `Bereitschaft: ${s.bereit.join(', ')}` : '', s.freigesetzt.length ? `Freigesetzt: ${s.freigesetzt.join(', ')}` : '',
      s.hohl.length ? `Hohlstunde: ${s.hohl.join(', ')}` : '', 'Klick: Wer ist frei?'].filter(Boolean).join('\n');
    return (
      <button key={s.nr} type="button" className={mergeClasses('mx-kopf', wahl?.col === i && 'gewaehlt')} title={titel} onClick={() => tpKontextSetzen('frei')} data-stunde={s.nr}>
        <span className="mx-kopf-std"><b>{`${s.nr}.`}</b><span>{s.zeit.split('–')[0]}</span></span>
        <span className="mx-kopf-zahl">
          {offenJeSpalte[i] ? <span className="mx-kopf-offen">{`${offenJeSpalte[i]} offen`}</span> : null}
          <span className={mergeClasses('mx-kopf-frei', offenJeSpalte[i] > frei && 'knapp')} data-testid="mx-frei">{`${frei} frei`}</span>
        </span>
      </button>
    );
  };

  const leer = !daten ? (laedt ? 'Wird geladen …' : '') : !daten.unterrichtstag && !daten.zeilen.some((z) => z.zellen.length) ? `An diesem Tag findet kein Unterricht statt${daten.frei ? ` (${daten.frei})` : ''}.`
    : !reihen.length ? (merk.nurAenderungen ? `Keine ${lehrer ? 'Lehrkraft' : 'Klasse'} mit Änderungen.` : `Keine ${lehrer ? 'Lehrkraft' : 'Klasse'} passt zum Filter.`) : '';
  const titelLeiste = gewaehltZeile && wahl ? `${gewaehltZeile.z.k} · ${gewaehltSeg && gewaehltSeg.len > 1 ? `${nrs[gewaehltSeg.von]}.–${nrs[gewaehltSeg.von + gewaehltSeg.len - 1]}.` : `${nrs[wahl.col]}.`} Stunde` : '';

  return (
    <section className="mx-flaeche" data-ansicht="vertretung.matrix" data-art={art} aria-label={lehrer ? 'Tagesübersicht nach Lehrkräften' : 'Tagesübersicht nach Klassen'}>
      <div className="mx-haupt">
        <div className="mx-werkzeuge" data-testid="mx-werkzeuge">
          <Input size="small" className="mx-suche" placeholder={lehrer ? 'Lehrkraft, Klasse, Fach' : 'Klasse, Lehrkraft, Fach'} value={suche} onChange={(_, d) => setSuche(d.value)} aria-label="Zeilen filtern" />
          {!lehrer && jahrgaenge.length > 1 ? (
            <Select size="small" className="mx-jg" value={nurJg} onChange={(_, d) => setNurJg(d.value)} aria-label="Jahrgang">
              <option value="">Alle Jahrgänge</option>{jahrgaenge.map((j) => <option key={j} value={j}>{`Jahrgang ${j}`}</option>)}
            </Select>
          ) : null}
          <Checkbox size="medium" checked={merk.nurAenderungen} onChange={(_, d) => merken({ nurAenderungen: !!d.checked })} label="Nur mit Änderungen" data-testid="mx-nur-aenderungen" />
          <span className="mx-summe" data-testid="mx-summe">
            <span className={nOffen ? 'tp-offen' : undefined}>{`${nOffen} offen`}</span>
            {nOffen ? <span className="mx-breit">{`in ${mehrzahl(nKlassen, lehrer ? 'Zeile' : 'Klasse', lehrer ? 'Zeilen' : 'Klassen')}`}</span> : null}
            {nEntfall ? <span>{mehrzahl(nEntfall, 'Entfall', 'Entfälle')}</span> : null}
            {nAbw ? <span className="mx-breit">{`${nAbw} abwesend`}</span> : null}
            {daten?.ohneZeile ? <button type="button" className="tp-link mx-ohne" onClick={() => tpAnsichtSetzen('liste')} title={lehrer ? 'Offene Stunden ohne Lehrkraft-Zeile – in „Offene Stunden“ lösen' : 'Offene Aufsichten bzw. Termine ohne Klasse – in „Offene Stunden“ lösen'}>{`${daten.ohneZeile} ohne ${lehrer ? 'Zeile' : 'Klasse'}`}</button> : null}
          </span>
          <span className="mx-rechts">
            <Popover positioning="below-end" withArrow={false}>
              <PopoverTrigger disableButtonEnhancement><Button size="small" appearance="subtle" data-testid="mx-legende">Legende</Button></PopoverTrigger>
              <PopoverSurface className="mx-legende">
                {([['n', 'regulär'], ['o', 'offen – Vertretung fehlt'], ['v', 'vertreten (bisherige Lehrkraft durchgestrichen)'], ['r', 'Raumänderung'], ['x', 'ohne Lehrkraft'], ['e', 'Entfall'], ['z', 'zusätzlich bzw. verlegt'], ['t', 'Termin'], ['k', 'Klausur']] as const).map(([s, t]) => (
                  <span key={s} className="mx-lg"><i className={`mx-muster mx-st-${s}`} />{t}</span>
                ))}
                {lehrer ? null : <span className="mx-lg"><i className="mx-muster mx-abwband" />Klasse abwesend (Ausflug, Praktikum …)</span>}
                <span className="mx-lg mx-lg-text">Im Spaltenkopf: offene Stunden und verfügbare Lehrkräfte (Bereitschaft, freigesetzt, Hohlstunde).</span>
              </PopoverSurface>
            </Popover>
            {schreiben && nOffen > 1 ? <Button size="small" appearance="subtle" onClick={() => void automatik()} disabled={probeLaeuft || !!probe} data-testid="alle-empfehlungen" title="Die Automatik schlägt für alle offenen Stunden eine Lösung vor – zur Prüfung, noch ohne Änderung (A)">{probeLaeuft ? 'Wird berechnet …' : 'Empfehlungen prüfen …'}</Button> : null}
            <MenueKnopf art="knopf" size="small" appearance="subtle" text="" titel="Tasten der Tagesübersicht" eintraege={tasten} testid="tasten" icon={<Keyboard20Regular />} />
          </span>
        </div>
        {leer ? <div className="tp-leer">{leer}</div> : (
          <div ref={scrollRef} className="mx-scroll" tabIndex={0} role="grid" aria-label={lehrer ? 'Lehrkräfte × Stunden' : 'Klassen × Stunden'} aria-multiselectable data-testid="matrix"
            style={{ ['--mx-spalten' as string]: spalten, ['--mx-breite' as string]: `${gesamtBreite}px` }}>
            <div className="mx-kopfzeilen" role="rowgroup">
              <div className="mx-reihe mx-kopfreihe" role="row">
                <span className="mx-ecke">{lehrer ? 'Lehrkraft' : 'Klasse'}</span>
                {stunden.map(kopfZelle)}
              </div>
              {hatBereitschaft ? (
                <div className="mx-reihe mx-bereitreihe" role="row" data-testid="mx-bereitschaft">
                  <span className="mx-ecke" title="Bereitschaften bzw. Präsenzlehrkräfte des Tages">Bereitschaft</span>
                  {stunden.map((s) => (
                    <span key={s.nr} className="mx-bereit" title={s.bereitschaften.map((x) => `${x.k}: ${x.stand}`).join('\n') || undefined}>
                      {s.bereitschaften.slice(0, s.bereitschaften.length > 3 ? 2 : 3).map((x) => <span key={x.id} className={`mx-b-${x.stand}`}>{x.k}</span>)}
                      {s.bereitschaften.length > 3 ? <span className="mx-mehr">{`+${s.bereitschaften.length - 2}`}</span> : null}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <div style={{ height: virt.getTotalSize(), position: 'relative', width: gesamtBreite }} role="rowgroup">
              {virt.getVirtualItems().map((vi) => {
                const x = reihen[vi.index]!;
                const stil = { position: 'absolute' as const, top: 0, left: 0, width: gesamtBreite, height: vi.size, transform: `translateY(${vi.start}px)` };
                if (x.art === 'gruppe') {
                  return (
                    <div key={vi.key} className="mx-gruppe" style={stil} role="row">
                      <button type="button" className="mx-gruppe-knopf" aria-expanded={!x.zu} onClick={() => merken({ zu: x.zu ? merk.zu.filter((g) => g !== x.text) : [...merk.zu, x.text] })}
                        title={x.zu ? 'Ausklappen' : 'Einklappen'}>
                        <span className="mx-chevron" aria-hidden>{x.zu ? '›' : '⌄'}</span>
                        <span className="mx-gruppe-text">{lehrer ? x.text : x.text === '–' ? 'Ohne Jahrgang' : /^\d/.test(x.text) ? `Jahrgang ${x.text}` : x.text}</span>
                        <span className="mx-gruppe-zahl">{x.n}</span>
                        {x.offen ? <span className="mx-gruppe-offen">{`${x.offen} offen`}</span> : null}
                      </button>
                    </div>
                  );
                }
                const z = x.z;
                const abwesendGanz = lehrer && z.abw.length >= nrs.length;
                return (
                  <div key={vi.key} className={mergeClasses('mx-reihe', wahl?.zeile === z.id && 'gewaehlt', x.offen > 0 && 'mit-offen')} style={stil} role="row" data-zeile={z.k}>
                    <span className="mx-name" role="rowheader" title={`${z.name}${x.offen ? `\n${x.offen} offen` : ''}`} onContextMenu={(e) => zeilenMenue(z, e)}
                      onDoubleClick={() => miniplanOeffnen(lehrer ? 'lehrer' : 'klasse', z.id, z.k)}>
                      <b>{z.k}</b>{x.offen ? <span className="mx-name-offen">{x.offen}</span> : null}
                      {abwesendGanz ? <span className="mx-name-abw">abw.</span> : null}
                    </span>
                    {x.segs.map((sg) => {
                      const sel = wahl?.zeile === z.id && wahl.col === sg.von;
                      const e = sg.art === 'z' ? sg.e[0]! : null;
                      const mark = markiert.length > 1 && sg.e.some((y) => y.v && markiert.includes(y.v));
                      const uniq = sg.art === 'z' ? new Set(sg.e.map(sig)).size : 0;
                      return (
                        <div key={sg.von} role="gridcell" aria-selected={sel || mark} tabIndex={-1} data-col={sg.von} data-stunde={nrs[sg.von]} data-v={e?.v ?? undefined} data-status={sg.art === 'abw' ? 'abw' : e?.s ?? 'leer'}
                          className={mergeClasses('mx-zelle', sg.art === 'abw' ? 'mx-abwband' : e ? `mx-st-${e.s}` : 'mx-leer', sg.abw && sg.art !== 'abw' && 'mx-abw', sel && 'gewaehlt', mark && 'markiert', sg.len > 1 && 'mx-doppel')}
                          style={{ gridColumn: `${sg.von + 2} / span ${sg.len}` }} title={zellTitel(z, sg, stunden, lehrer)}
                          onClick={(ev) => klick(z.id, sg, ev)} onMouseDown={(ev) => maus.runter(z.id, sg, ev)} onMouseEnter={(ev) => maus.rein(z.id, sg, ev)}
                          onContextMenu={(ev) => zellMenue(z, sg, ev)} onDoubleClick={() => { if (e) miniplanOeffnen(lehrer ? 'klasse' : 'lehrer', lehrer ? e.ki : e.li ?? e.lo, lehrer ? e.k.split(',')[0]! : (e.l || e.la).split(',')[0]!); }}>
                          {sg.art === 'abw' ? <span className="mx-abwtext">{sg.abw!.t || (sg.abw!.a === 'termin' ? 'Termin' : 'abwesend')}</span>
                            : e ? <Zelle e={e} mehr={sg.len > 1 ? 0 : uniq - 1} lehrer={lehrer} />
                            : sg.abw && lehrer && (sg.von === 0 || !segAn(z.id, sg.von - 1)?.abw) ? <span className="mx-abwtext">{sg.abw.t || 'abwesend'}</span> : null}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <aside className={mergeClasses('mx-seite tp-entscheidung-flaeche', !!probe && 'breit')} data-testid="entscheidung-flaeche" aria-label="Entscheidung">
        {probe ? (
          <Pruefung probe={probe} schreiben={schreiben} schliessen={() => setProbe(null)} nurIds={null}
            uebernommen={(fertig) => setProbe((p0) => { if (!p0) return p0; const rest = p0.vorschlaege.filter((v) => !fertig.includes(v.id)); return rest.length ? { ...p0, vorschlaege: rest } : null; })} />
        ) : mehrere ? (
          <Sammelleiste ids={sammelIds} schreiben={schreiben} aufheben={() => setMarkiert([])} fertig={sammelFertig} beiDaten={(g) => { gemeinsamRef.current = g; }} />
        ) : <>
          {zuletzt ? (
            <div className="tp-zuletzt" data-testid="zuletzt">
              <span>{`Zuletzt: ${zuletzt}`}</span>
              <button type="button" className="tp-link" onClick={() => { setZuletzt(null); rueckgaengig().catch(fehlerMelden); }} title="Letzte Änderung zurücknehmen (Strg+Z)">Rückgängig</button>
            </div>
          ) : null}
          {gewaehltZeile && wahl ? (
            <div className="mx-ort" data-testid="mx-ort">
              {o || b ? null : <span className="mx-ort-text">{titelLeiste}</span>}
              <span className="mx-ort-plaene">
                <span>Miniplan</span>
                {planMenue(gewaehltZeile.z, eintrag).filter((x): x is { text: string; aktion: () => void } => !!x && 'aktion' in x).slice(0, 4).map((x) => (
                  <button key={x.text} type="button" className="tp-link mx-ort-link" onClick={x.aktion} title={x.text.replace(' anzeigen', ' als Miniplan zeigen')}>{x.text.replace(/^Plan von (Raum )?(.*) anzeigen$/, '$2')}</button>
                ))}
              </span>
            </div>
          ) : null}
          {gewaehltSeg && new Set(gewaehltSeg.e.map(sig)).size > 1 ? (
            <div className="mx-auswahl" role="list" aria-label="Stunden in dieser Zelle">
              {gewaehltSeg.e.map((x, i) => (gewaehltSeg.e.findIndex((y) => sig(y) === sig(x)) !== i ? null : (
                <button key={i} type="button" role="listitem" className={mergeClasses('mx-auswahl-e', `mx-st-${x.s}`, i === wahl!.idx && 'gewaehlt')} onClick={() => setWahl({ ...wahl!, idx: i })}>
                  <Zelle e={x} mehr={0} lehrer={lehrer} />
                </button>
              )))}
            </div>
          ) : null}
          {o || b ? <Entscheidung {...eProps} mehrRef={mehrRef} />
            : gewaehltSeg?.art === 'abw' ? (
              <div className="tp-entscheidung" data-testid="entscheidung-abw">
                <div className="tp-abschnitt">
                  <div className="tp-label">{gewaehltSeg.abw!.a === 'absenz' ? 'Klasse abwesend' : 'Termin'}</div>
                  <div className="mx-info">{gewaehltSeg.abw!.t || '–'}</div>
                  <div className="tp-leise">{`${mehrzahl(gewaehltSeg.e.length, 'Stunde', 'Stunden')} ${gewaehltSeg.e.length === 1 ? 'entfällt' : 'entfallen'} bzw. ${gewaehltSeg.e.length === 1 ? 'ist' : 'sind'} freigesetzt – die Lehrkräfte stehen für Vertretungen zur Verfügung.`}</div>
                </div>
                {schreiben && gewaehltSeg.abw!.a === 'absenz' ? <div className="tp-andere"><Button size="small" onClick={() => void absenzLoeschen(gewaehltSeg.abw!.id)}>Abwesenheit entfernen</Button><Button size="small" appearance="subtle" onClick={() => tpBlattSetzen('abwesenheiten')}>Abwesenheiten …</Button></div> : null}
              </div>
            )
            : eintrag && gewaehltZeile ? (
              <div className="tp-entscheidung" data-testid="entscheidung-info">
                <div className="tp-abschnitt">
                  <div className="tp-etitel"><b>{lehrer ? eintrag.k : gewaehltZeile.z.k}</b><span>{eintrag.f}</span></div>
                  <div className="tp-emeta">
                    <span>{lehrer ? gewaehltZeile.z.k : eintrag.l || '–'}</span>{eintrag.r ? <span>{`Raum ${eintrag.r}`}</span> : null}
                    <span className={eintrag.s === 'e' ? 'tp-offen' : undefined}>{eintrag.s === 'n' ? 'regulär' : `${STATUS_TEXT[eintrag.s] || ''}${eintrag.art ? ` (${eintrag.art})` : ''}`}</span>
                  </div>
                  {eintrag.t ? <div className="tp-leise">{eintrag.t}</div> : null}
                </div>
                {schreiben && eintrag.s === 'n' && eintrag.u ? (
                  <div className="tp-abschnitt">
                    <div className="tp-label">Ändern</div>
                    <div className="tp-andere">
                      <Button size="small" onClick={() => aktion(0, () => regulaerEntfall(eintrag, nrs[wahl!.col]!), `${nrs[wahl!.col]}. Std. ${gewaehltZeile.z.k} ${eintrag.f}: Entfall`)} title="Stunde entfallen lassen (E)">Entfall<kbd>E</kbd></Button>
                      {!lehrer && eintrag.l ? <Button size="small" appearance="subtle" onClick={() => void abwesendMelden('lehrer', eintrag.l.split(',')[0]!, nrs[wahl!.col]!)}>{`${eintrag.l.split(',')[0]} ab hier abwesend …`}</Button> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            )
            : daten ? (
              <div className="tp-leer" data-testid="mx-start">
                {nOffen ? `${mehrzahl(nOffen, 'offene Stunde', 'offene Stunden')} in ${mehrzahl(nKlassen, lehrer ? 'Zeile' : 'Klasse', lehrer ? 'Zeilen' : 'Klassen')}. Eine Zelle wählen oder J für die erste offene Stunde.`
                  : !daten.unterrichtstag ? 'Kein Unterrichtstag.' : 'Keine offenen Stunden.'}
                <span className="tp-leer-knoepfe">
                  {nOffen ? <Button size="small" appearance="primary" onClick={() => offeneBlaettern(1)} data-testid="mx-erste-offene">Erste offene Stunde</Button> : null}
                  {schreiben ? <Button size="small" onClick={() => tpBlattSetzen('abwesenheiten')}>Abwesenheit erfassen …</Button> : null}
                </span>
              </div>
            ) : laedt ? <div className="tp-leer"><Spinner size="tiny" /></div> : null}
        </>}
      </aside>
    </section>
  );
}
