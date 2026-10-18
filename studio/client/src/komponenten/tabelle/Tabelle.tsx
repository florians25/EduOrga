// Datentabelle (TanStack Table + TanStack Virtual) für Stammdaten, Unterricht und die Listen der Module.
//
// Spalten: [{ schluessel, titel, breite, art, editierbar, editierbarFuer, auswahl, refTyp, ausrichtung, standard, karteikarte,
//            wert(z), farbe(z), klasse(z), aendern(z, wert) }]
//   art: 'Text' | 'Ganzzahl' | 'Dezimal' | 'Bool' | 'Bereich' | 'Element' | 'ElementListe' | 'Farbe' | 'Auswahl' | 'Datum' | 'NurLesen'
// Bedienung: Pfeile, Tab, Bild↑/↓, Pos1/Ende, Enter/F2 (bearbeiten), Esc, Entf (leeren), Leertaste (Haken), Tippen beginnt die
// Eingabe, Strg+C/Strg+V (Tabulator-Text, auch aus Tabellenkalkulationen), Strg+A, Umschalt+Pfeil/Klick (Bereich),
// Strg+Klick (einzeln). Kopfzeile: Klick sortiert, Rand ziehen ändert die Breite, Kopf ziehen verschiebt die Spalte,
// Rechtsklick blendet Spalten ein/aus. Spaltenzustand wird als Benutzereinstellung gespeichert (zustandSchluessel).
import {
  getCoreRowModel, useReactTable, type ColumnDef, type ColumnOrderState, type ColumnSizingState, type VisibilityState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowSortDown16Regular, ArrowSortUp16Regular, Checkmark16Regular } from '@fluentui/react-icons';
import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
  type ClipboardEvent, type KeyboardEvent, type MouseEvent as RMouseEvent, type ReactElement, type Ref,
} from 'react';
import { einstellungLesen, einstellungSchreiben } from '@/api/client';
import type { ElementOption } from '@/api/typen';
import { entprellen, textbreite, vergleich } from '@/kern/hilfen';
import { fehlerMelden, hinweis } from '../hinweise';
import { menue, type MenueListe } from '../menue';
import { Vorschlagsliste, type VorschlagslisteApi } from './vorschlagsliste';
import './tabelle.css';

export type Spaltenart = 'Text' | 'Ganzzahl' | 'Dezimal' | 'Bool' | 'Bereich' | 'Element' | 'ElementListe' | 'Farbe' | 'Auswahl' | 'Datum' | 'NurLesen' | 'Haken';

export interface Spalte<Z> {
  schluessel: string;
  titel: string;
  breite?: number;
  art?: Spaltenart;
  editierbar?: boolean;
  editierbarFuer?: (z: Z) => boolean;
  auswahl?: string[];
  refTyp?: string;
  ausrichtung?: 'rechts' | 'mitte';
  /** sichtbar in der Grundeinstellung (Standard: ja) */
  standard?: boolean;
  /** Gruppe im Menü „Spalten ein-/ausblenden“ */
  karteikarte?: string;
  hinweis?: string;
  wert?: (z: Z) => unknown;
  farbe?: (z: Z) => string | null | undefined;
  klasse?: (z: Z) => string | null | undefined;
  aendern?: (z: Z, wert: string) => Promise<unknown>;
}

export interface Aenderung<Z> { zeile: Z; spalte: Spalte<Z>; wert: string }

export interface TabelleProps<Z> {
  spalten: Spalte<Z>[];
  zeilen: Z[];
  id?: (z: Z) => string | number;
  zeilenHoehe?: number;
  zustandSchluessel?: string;
  aendern?: (z: Z, s: Spalte<Z>, wert: string) => Promise<unknown>;
  aendernMehrere?: (liste: Aenderung<Z>[]) => Promise<unknown>;
  neu?: (s: Spalte<Z>, wert: string) => Promise<unknown>;
  neuText?: string;
  optionen?: (s: Spalte<Z>) => Promise<ElementOption[]> | ElementOption[];
  beiAuswahl?: (zeilen: Z[], aktiv: Z | null) => void;
  beiDoppelklick?: (z: Z, s: Spalte<Z> | undefined) => void;
  beiEntf?: (zeilen: Z[]) => void;
  kontextmenue?: (zeilen: Z[], s: Spalte<Z> | undefined) => MenueListe;
  zeilenKlasse?: (z: Z, i: number) => string | null | undefined;
  leerText?: string;
  /** Zeilen derselben Gruppe bleiben beim Sortieren zusammen (z. B. Kopplungszeilen eines Unterrichts) */
  gruppiert?: (z: Z) => unknown;
  sortierbar?: boolean;
  /** Eigene Tasten vor der Standardbehandlung (true = behandelt) */
  tasten?: (e: KeyboardEvent<HTMLDivElement>) => boolean;
  className?: string;
  /** Kennung für Tests (data-tabelle) */
  name?: string;
}

export interface TabelleApi<Z> {
  waehle: (id: string | number, spalte?: string) => boolean;
  ausgewaehlte: () => Z[];
  aktiveZeile: () => Z | null;
  aktiveSpalte: () => Spalte<Z> | undefined;
  fokus: () => void;
  bearbeiten: (start?: string) => void;
  spaltenMenue: (x: number, y: number) => void;
  spaltenAnpassen: () => void;
  ansicht: () => Z[];
  aktIndex: () => number;
  editorOffen: () => boolean;
  /** Sichtbarkeit einzelner Spalten setzen (ohne Speichern) */
  sichtbarSetzen: (werte: Record<string, boolean>) => void;
  sichtbare: () => string[];
}

const NEU_ID = '__neu';
const NEU = Object.freeze({ __neu: true }) as unknown;
const istNeu = (z: unknown) => z === NEU;

interface GespeicherterZustand { spalten?: { s: string; b?: number; v?: boolean }[]; sort?: { schluessel: string; ab: boolean } | null }

function TabelleInnen<Z>(props: TabelleProps<Z>, ref: Ref<TabelleApi<Z>>) {
  const {
    spalten, zeilen, zeilenHoehe: H = 30, zustandSchluessel, leerText = 'Keine Einträge', sortierbar = true, name,
  } = props;
  const idVon = useCallback((z: Z) => (props.id ? props.id(z) : (z as { id: string | number }).id), [props.id]);
  const propsRef = useRef(props);
  propsRef.current = props;

  // ---- Spaltenzustand (Reihenfolge, Sichtbarkeit, Breite) und Sortierung ----
  const [reihenfolge, setReihenfolge] = useState<ColumnOrderState>([]);
  const [sichtbarkeit, setSichtbarkeit] = useState<VisibilityState>({});
  const [breiten, setBreiten] = useState<ColumnSizingState>({});
  const [sort, setSort] = useState<{ schluessel: string; ab: boolean } | null>(null);
  const gespeichert = useRef<GespeicherterZustand | null>(null);
  const geladen = useRef(!zustandSchluessel);

  const schluesselListe = spalten.map((s) => s.schluessel).join('|');
  // neue Spalten: Grundeinstellung bzw. gespeicherter Zustand
  useEffect(() => {
    const g = gespeichert.current;
    const map = new Map((g?.spalten || []).map((x, i) => [x.s, { ...x, i }]));
    setReihenfolge((alt) => {
      const vorhanden = spalten.map((s) => s.schluessel);
      if (g?.spalten) return [...vorhanden].sort((a, b) => (map.get(a)?.i ?? 999) - (map.get(b)?.i ?? 999));
      const bleiben = alt.filter((k) => vorhanden.includes(k));
      return [...bleiben, ...vorhanden.filter((k) => !bleiben.includes(k))];
    });
    setSichtbarkeit((alt) => {
      const n: VisibilityState = {};
      for (const s of spalten) n[s.schluessel] = map.has(s.schluessel) ? !!map.get(s.schluessel)!.v : (alt[s.schluessel] ?? s.standard !== false);
      if (!Object.values(n).some(Boolean) && spalten[0]) n[spalten[0].schluessel] = true;
      return n;
    });
    setBreiten((alt) => {
      const n: ColumnSizingState = {};
      for (const s of spalten) n[s.schluessel] = map.get(s.schluessel)?.b || alt[s.schluessel] || s.breite || 80;
      return n;
    });
    if (g?.sort && spalten.some((s) => s.schluessel === g.sort!.schluessel)) setSort(g.sort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluesselListe]);

  useEffect(() => {
    if (!zustandSchluessel) return;
    let aktiv = true;
    void einstellungLesen<GespeicherterZustand>(zustandSchluessel).then((z) => {
      if (!aktiv) return;
      geladen.current = true;
      if (!z?.spalten) return;
      gespeichert.current = z;
      const map = new Map(z.spalten.map((x, i) => [x.s, { ...x, i }]));
      setReihenfolge((alt) => [...alt].sort((a, b) => (map.get(a)?.i ?? 999) - (map.get(b)?.i ?? 999)));
      setSichtbarkeit((alt) => { const n = { ...alt }; for (const [k, v] of map) if (k in n) n[k] = !!v.v; if (!Object.values(n).some(Boolean)) { const e = Object.keys(n)[0]; if (e) n[e] = true; } return n; });
      setBreiten((alt) => { const n = { ...alt }; for (const [k, v] of map) if (v.b) n[k] = v.b; return n; });
      if (z.sort) setSort(z.sort);
    });
    return () => { aktiv = false; };
  }, [zustandSchluessel]);

  const speichern = useMemo(() => entprellen((z: GespeicherterZustand) => {
    if (!zustandSchluessel || !geladen.current) return;
    gespeichert.current = z;
    void einstellungSchreiben(zustandSchluessel, z);
  }, 600), [zustandSchluessel]);
  const zustandMerken = useRef(false);
  useEffect(() => {
    if (!zustandMerken.current) return;
    zustandMerken.current = false;
    speichern({ spalten: reihenfolge.map((k) => ({ s: k, b: breiten[k], v: !!sichtbarkeit[k] })), sort });
  }, [reihenfolge, sichtbarkeit, breiten, sort, speichern]);
  const geaendert = () => { zustandMerken.current = true; };

  // ---- TanStack: Spaltenmodell ----
  const spaltenMap = useMemo(() => new Map(spalten.map((s) => [s.schluessel, s])), [spalten]);
  const defs = useMemo<ColumnDef<Z>[]>(() => spalten.map((s) => ({ id: s.schluessel, header: s.titel, size: s.breite || 80, minSize: 24, maxSize: 900 })), [spalten]);
  const tabelle = useReactTable<Z>({
    data: [] as Z[],
    columns: defs,
    state: { columnOrder: reihenfolge, columnVisibility: sichtbarkeit, columnSizing: breiten },
    onColumnSizingChange: (u) => { setBreiten(u); geaendert(); },
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
  });
  const sichtbar = tabelle.getVisibleLeafColumns().map((c) => ({ c, s: spaltenMap.get(c.id)! })).filter((x) => x.s);
  const gesamtbreite = sichtbar.reduce((a, x) => a + x.c.getSize(), 0);

  // ---- Zeilen (sortiert) ----
  const text = useCallback((z: Z | undefined, s: Spalte<Z> | undefined): string => {
    if (!z || !s || istNeu(z)) return '';
    const v = s.wert ? s.wert(z) : (z as Record<string, unknown>)[s.schluessel];
    return v === null || v === undefined ? '' : String(v);
  }, []);
  const ansicht = useMemo(() => {
    const s = sort && spaltenMap.get(sort.schluessel);
    if (!s || !sortierbar) return zeilen.slice();
    const f = sort!.ab ? -1 : 1;
    if (props.gruppiert) {
      const gruppen = new Map<unknown, Z[]>();
      for (const z of zeilen) { const g = props.gruppiert(z); if (!gruppen.has(g)) gruppen.set(g, []); gruppen.get(g)!.push(z); }
      return [...gruppen.values()].sort((a, b) => f * vergleich(text(a[0], s), text(b[0], s))).flat();
    }
    return zeilen.slice().sort((a, b) => f * vergleich(text(a, s), text(b, s)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zeilen, sort, spaltenMap, sortierbar, text]);
  const anzahl = ansicht.length + (props.neu ? 1 : 0);
  const zeile = (r: number): Z | undefined => (r < ansicht.length ? ansicht[r] : props.neu && r === ansicht.length ? (NEU as Z) : undefined);

  // ---- Auswahl ----
  const [akt, setAkt] = useState({ r: 0, c: 0 });
  const [gewaehlt, setGewaehlt] = useState<Set<string | number>>(() => new Set());
  const anker = useRef(0);
  const aktRef = useRef(akt); aktRef.current = akt;
  const gewaehltRef = useRef(gewaehlt); gewaehltRef.current = gewaehlt;
  const ansichtRef = useRef(ansicht); ansichtRef.current = ansicht;
  const sichtbarRef = useRef(sichtbar); sichtbarRef.current = sichtbar;
  const aktIdRef = useRef<string | number | null>(null);

  // Daten neu: aktive Zeile über die Id halten, Auswahl bereinigen
  useEffect(() => {
    const ids = new Set(ansicht.map(idVon));
    setGewaehlt((g) => { const n = new Set([...g].filter((x) => ids.has(x))); return n.size === g.size ? g : n; });
    if (aktIdRef.current !== null) {
      const r = ansicht.findIndex((z) => idVon(z) === aktIdRef.current);
      if (r >= 0 && r !== aktRef.current.r) setAkt((a) => ({ ...a, r }));
    }
    setAkt((a) => (a.r > Math.max(0, anzahl - 1) ? { ...a, r: Math.max(0, anzahl - 1) } : a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ansicht]);

  const ausgewaehlteVon = (g: Set<string | number>, a: { r: number }): Z[] => {
    if (g.size) return ansichtRef.current.filter((z) => g.has(idVon(z)));
    const z = a.r < ansichtRef.current.length ? ansichtRef.current[a.r] : undefined;
    return z ? [z] : [];
  };

  const rollen = useRef<HTMLDivElement>(null);
  const wurzel = useRef<HTMLDivElement>(null);
  const virt = useVirtualizer({ count: anzahl, getScrollElement: () => rollen.current, estimateSize: () => H, overscan: 10 });

  const sichtbarMachen = (r: number, c: number) => {
    const k = rollen.current;
    if (!k) return;
    const y = r * H;
    const kopfH = 32;
    if (y < k.scrollTop) k.scrollTop = y;
    else if (y + H > k.scrollTop + k.clientHeight - kopfH) k.scrollTop = y + H - k.clientHeight + kopfH;
    let x = 0;
    const sp = sichtbarRef.current;
    for (let i = 0; i < c; i++) x += sp[i]!.c.getSize();
    const b = sp[c]?.c.getSize() || 0;
    if (x < k.scrollLeft) k.scrollLeft = x;
    else if (x + b > k.scrollLeft + k.clientWidth) k.scrollLeft = x + b - k.clientWidth;
  };

  const gehe = (r: number, c: number, erweitern = false, einzeln = false) => {
    const n = ansichtRef.current.length + (propsRef.current.neu ? 1 : 0);
    if (n === 0) return;
    r = Math.max(0, Math.min(n - 1, r));
    c = Math.max(0, Math.min(sichtbarRef.current.length - 1, c));
    let g = gewaehltRef.current;
    if (erweitern) {
      g = new Set();
      const [a, b] = [Math.min(anker.current, r), Math.max(anker.current, r)];
      for (let i = a; i <= b; i++) { const z = ansichtRef.current[i]; if (z) g.add(idVon(z)); }
    } else if (einzeln) {
      g = new Set(g);
      const z = ansichtRef.current[r];
      if (z) { const id = idVon(z); if (g.has(id)) g.delete(id); else g.add(id); }
      anker.current = r;
    } else {
      if (g.size) g = new Set();
      anker.current = r;
    }
    const neuAkt = { r, c };
    setAkt(neuAkt);
    setGewaehlt(g);
    aktRef.current = neuAkt;
    gewaehltRef.current = g;
    const z = ansichtRef.current[r];
    aktIdRef.current = z ? idVon(z) : null;
    sichtbarMachen(r, c);
    propsRef.current.beiAuswahl?.(ausgewaehlteVon(g, neuAkt), z ?? null);
  };

  // ---- Bearbeiten ----
  const [editor, setEditor] = useState<{ r: number; c: number; start?: string; nr: number } | null>(null);
  const editorRef = useRef(editor); editorRef.current = editor;
  const eingabe = useRef<HTMLInputElement | null>(null);
  const vorschlag = useRef<VorschlagslisteApi>(null);

  const editierbar = (s: Spalte<Z> | undefined, z: Z | undefined): boolean => {
    if (!s || !z || s.art === 'NurLesen' || s.art === 'Haken' || s.editierbar === false) return false;
    if (istNeu(z)) return !!propsRef.current.neu;
    if (typeof s.editierbarFuer === 'function') return s.editierbarFuer(z);
    return !!(propsRef.current.aendern || s.aendern);
  };

  const fokus = () => { if (!editorRef.current) wurzel.current?.focus({ preventScroll: true }); };

  const speichernWert = async (z: Z, s: Spalte<Z>, wert: string) => {
    try {
      if (istNeu(z)) { await propsRef.current.neu?.(s, wert); return; }
      if (s.aendern) await s.aendern(z, wert);
      else await propsRef.current.aendern?.(z, s, wert);
    } catch (f) { fehlerMelden(f); }
  };

  const bearbeiten = (start?: string) => {
    const { r, c } = aktRef.current;
    const z = zeile(r), s = sichtbarRef.current[c]?.s;
    if (!z || !editierbar(s, z)) return;
    sichtbarMachen(r, c);
    setEditor({ r, c, start, nr: Date.now() });
  };

  const editorBeenden = async (uebernehmen: boolean, wert?: string) => {
    const ed = editorRef.current;
    if (!ed) return;
    setEditor(null);
    editorRef.current = null;
    const z = zeile(ed.r), s = sichtbarRef.current[ed.c]?.s;
    if (!z || !s) return;
    const alt = text(z, s);
    const w = wert ?? eingabe.current?.value ?? '';
    if (uebernehmen && w !== alt) await speichernWert(z, s, w);
  };

  const editorTaste = (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (vorschlag.current?.taste(e as KeyboardEvent)) { e.stopPropagation(); return; }
    const { r, c } = aktRef.current;
    const weiter = (dr: number, dc: number) => { void editorBeenden(true).then(() => { if (dr || dc) gehe(r + dr, c + dc); setTimeout(fokus); }); };
    if (e.key === 'Enter') { e.preventDefault(); weiter(e.shiftKey ? -1 : 1, 0); }
    else if (e.key === 'Tab') { e.preventDefault(); weiter(0, e.shiftKey ? -1 : 1); }
    else if (e.key === 'Escape') { e.preventDefault(); void editorBeenden(false); setTimeout(fokus); }
    else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.currentTarget instanceof HTMLInputElement) { e.preventDefault(); weiter(e.key === 'ArrowDown' ? 1 : -1, 0); }
    e.stopPropagation();
  };

  useEffect(() => {
    if (!editor) return;
    const el = eingabe.current;
    if (!el) return;
    el.focus();
    if (editor.start === undefined) el.select(); else el.setSelectionRange(el.value.length, el.value.length);
    if (editor.start !== undefined) vorschlag.current?.zeigen();
  }, [editor]);

  // ---- Tastatur ----
  const taste = (e: KeyboardEvent<HTMLDivElement>) => {
    if (editorRef.current) return;
    if (propsRef.current.tasten?.(e)) { e.preventDefault(); return; }
    const { r, c } = aktRef.current;
    const seite = Math.max(1, Math.floor((rollen.current?.clientHeight || 300) / H) - 2);
    const strg = e.ctrlKey || e.metaKey;
    const z = zeile(r), s = sichtbarRef.current[c]?.s;
    const nSp = sichtbarRef.current.length;
    switch (e.key) {
      case 'ArrowDown': gehe(r + 1, c, e.shiftKey); break;
      case 'ArrowUp': gehe(r - 1, c, e.shiftKey); break;
      case 'ArrowRight': gehe(r, c + 1); break;
      case 'ArrowLeft': gehe(r, c - 1); break;
      case 'PageDown': gehe(r + seite, c, e.shiftKey); break;
      case 'PageUp': gehe(r - seite, c, e.shiftKey); break;
      case 'Home': gehe(strg ? 0 : r, 0); break;
      case 'End': gehe(strg ? anzahl - 1 : r, nSp - 1); break;
      case 'Tab':
        if (e.shiftKey) { if (c > 0) gehe(r, c - 1); else gehe(r - 1, nSp - 1); }
        else if (c < nSp - 1) gehe(r, c + 1); else gehe(r + 1, 0);
        break;
      case 'Enter': case 'F2':
        if (z && editierbar(s, z) && s?.art !== 'Bool') bearbeiten();
        else if (e.key === 'Enter') gehe(r + (e.shiftKey ? -1 : 1), c);
        break;
      case ' ':
        if (s?.art === 'Bool' && z && !istNeu(z) && editierbar(s, z)) void speichernWert(z, s, text(z, s) === 'X' ? '' : 'X');
        else return;
        break;
      case 'Delete': case 'Backspace':
        if (z && !istNeu(z) && editierbar(s, z) && s?.art !== 'Bool' && text(z, s) !== '') void speichernWert(z, s!, '');
        else if (e.key === 'Delete' && propsRef.current.beiEntf) propsRef.current.beiEntf(ausgewaehlteVon(gewaehltRef.current, aktRef.current));
        break;
      case 'a': case 'A':
        if (!strg) { tippen(e); return; }
        {
          const g = new Set(ansichtRef.current.map(idVon));
          setGewaehlt(g);
          gewaehltRef.current = g;
          propsRef.current.beiAuswahl?.(ausgewaehlteVon(g, aktRef.current), zeile(aktRef.current.r) ?? null);
        }
        break;
      default:
        tippen(e);
        return;
    }
    e.preventDefault();
  };

  const tippen = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
    const z = zeile(aktRef.current.r), s = sichtbarRef.current[aktRef.current.c]?.s;
    if (!z || !editierbar(s, z) || s?.art === 'Bool' || s?.art === 'Auswahl') return;
    e.preventDefault();
    bearbeiten(e.key);
  };

  // ---- Maus ----
  const zelleBei = (e: RMouseEvent): { r: number; c: number } | null => {
    const el = (e.target as HTMLElement).closest('[data-r]') as HTMLElement | null;
    if (!el) return null;
    const zelle = (e.target as HTMLElement).closest('[data-c]') as HTMLElement | null;
    return { r: Number(el.dataset.r), c: zelle ? Number(zelle.dataset.c) : aktRef.current.c };
  };

  const klick = (e: RMouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.tb-editor')) return;
    const p = zelleBei(e);
    if (!p) return;
    if (editorRef.current) void editorBeenden(true);
    const z = zeile(p.r);
    if (e.button === 2 && gewaehltRef.current.size > 1 && z && gewaehltRef.current.has(idVon(z))) { setAkt(p); aktRef.current = p; return; }
    gehe(p.r, p.c, e.shiftKey, e.ctrlKey || e.metaKey);
    const s = sichtbarRef.current[p.c]?.s;
    if (e.button === 0 && !e.shiftKey && !e.ctrlKey && s?.art === 'Bool' && z && !istNeu(z) && (e.target as HTMLElement).closest('.tb-haken') && editierbar(s, z)) {
      void speichernWert(z, s, text(z, s) === 'X' ? '' : 'X');
    }
  };

  const doppelklick = (e: RMouseEvent<HTMLDivElement>) => {
    const p = zelleBei(e);
    if (!p) return;
    const z = zeile(p.r), s = sichtbarRef.current[p.c]?.s;
    if (propsRef.current.beiDoppelklick && z && !istNeu(z) && (!editierbar(s, z) || s?.art === 'Bool')) { propsRef.current.beiDoppelklick(z, s); return; }
    bearbeiten();
  };

  const kontext = (e: RMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!propsRef.current.kontextmenue) return;
    const p = zelleBei(e);
    const z = p ? zeile(p.r) : undefined;
    if (p && !(z && !istNeu(z) && gewaehltRef.current.has(idVon(z)))) gehe(p.r, p.c);
    const liste = propsRef.current.kontextmenue(ausgewaehlteVon(gewaehltRef.current, aktRef.current), sichtbarRef.current[aktRef.current.c]?.s);
    if (liste?.length) menue(e.clientX, e.clientY, liste);
  };

  // ---- Zwischenablage ----
  const kopieren = (e: ClipboardEvent<HTMLDivElement>) => {
    if (editorRef.current) return;
    const g = gewaehltRef.current;
    const zl = g.size > 1 ? ausgewaehlteVon(g, aktRef.current) : null;
    const sp = sichtbarRef.current.map((x) => x.s);
    const t = zl ? zl.map((z) => sp.map((s) => text(z, s)).join('\t')).join('\r\n') : text(zeile(aktRef.current.r), sp[aktRef.current.c]);
    e.clipboardData.setData('text/plain', t);
    e.preventDefault();
    hinweis(zl ? `${zl.length} Zeilen kopiert.` : 'Zelle kopiert.', 'info', 1500);
  };

  const einfuegen = async (e: ClipboardEvent<HTMLDivElement>) => {
    if (editorRef.current) return;
    const t = e.clipboardData.getData('text/plain');
    if (!t) return;
    e.preventDefault();
    const zl = t.replace(/\r/g, '').split('\n');
    if (zl.length && zl[zl.length - 1] === '') zl.pop();
    const aenderungen: Aenderung<Z>[] = [];
    const sp = sichtbarRef.current.map((x) => x.s);
    zl.forEach((zeileText, i) => {
      const z = ansichtRef.current[aktRef.current.r + i];
      if (!z) return;
      zeileText.split('\t').forEach((wert, j) => {
        const s = sp[aktRef.current.c + j];
        if (s && editierbar(s, z) && text(z, s) !== wert) aenderungen.push({ zeile: z, spalte: s, wert });
      });
    });
    if (!aenderungen.length) return;
    try {
      if (propsRef.current.aendernMehrere) await propsRef.current.aendernMehrere(aenderungen);
      else for (const a of aenderungen) await speichernWert(a.zeile, a.spalte, a.wert);
      hinweis(`${aenderungen.length} Werte eingefügt.`, 'ok', 2000);
    } catch (f) { fehlerMelden(f); }
  };

  // ---- Spalten: Menü, Anpassen, Verschieben, Sortieren ----
  const spaltenAnpassen = () => {
    const n: ColumnSizingState = { ...breiten };
    for (const { s } of sichtbarRef.current) {
      let max = textbreite(s.titel, '500 12px "IBM Plex Sans", sans-serif') + 26;
      for (let i = 0; i < Math.min(ansichtRef.current.length, 2000); i++) max = Math.max(max, textbreite(text(ansichtRef.current[i], s)) + 18);
      n[s.schluessel] = Math.min(420, Math.ceil(max));
    }
    setBreiten(n);
    geaendert();
  };

  const spaltenMenue = (x: number, y: number) => {
    const karten = [...new Set(spalten.map((s) => s.karteikarte || ''))];
    const liste: MenueListe = [
      { text: 'Alle Spalten anpassen', aktion: spaltenAnpassen },
      { text: 'Standardspalten', aktion: () => { setSichtbarkeit(Object.fromEntries(spalten.map((s) => [s.schluessel, s.standard !== false]))); geaendert(); } },
    ];
    if (sort) liste.push({ text: 'Sortierung aufheben', aktion: () => { setSort(null); geaendert(); } });
    liste.push(null, { titel: 'Spalten ein-/ausblenden' });
    for (const k of karten) {
      const punkte = spalten.filter((s) => (s.karteikarte || '') === k).map((s) => ({
        text: s.titel, haken: !!sichtbarkeit[s.schluessel],
        aktion: () => {
          setSichtbarkeit((v) => { const n = { ...v, [s.schluessel]: !v[s.schluessel] }; if (!Object.values(n).some(Boolean)) n[s.schluessel] = true; return n; });
          geaendert();
        },
      }));
      if (karten.length > 1) liste.push({ text: k || 'Allgemein', menue: punkte });
      else liste.push(...punkte);
    }
    menue(x, y, liste);
  };

  const sortieren = (k: string) => {
    if (!sortierbar) return;
    setSort((s) => (s?.schluessel === k ? (s.ab ? null : { schluessel: k, ab: true }) : { schluessel: k, ab: false }));
    geaendert();
  };

  const spalteVerschieben = (von: string, nach: string) => {
    if (!von || von === nach) return;
    setReihenfolge((alt) => {
      const l = alt.filter((x) => x !== von);
      l.splice(l.indexOf(nach), 0, von);
      return l;
    });
    geaendert();
  };
  const [ziehtUeber, setZiehtUeber] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    waehle: (id, spalte) => {
      const r = id === NEU_ID && propsRef.current.neu ? ansichtRef.current.length : ansichtRef.current.findIndex((z) => idVon(z) === id);
      if (r < 0) return false;
      const sp = sichtbarRef.current;
      const c = spalte && sp.some((x) => x.s.schluessel === spalte) ? sp.findIndex((x) => x.s.schluessel === spalte) : aktRef.current.c;
      gehe(r, c);
      return true;
    },
    ausgewaehlte: () => ausgewaehlteVon(gewaehltRef.current, aktRef.current),
    aktiveZeile: () => { const z = zeile(aktRef.current.r); return z && !istNeu(z) ? z : null; },
    aktiveSpalte: () => sichtbarRef.current[aktRef.current.c]?.s,
    fokus,
    bearbeiten,
    spaltenMenue,
    spaltenAnpassen,
    ansicht: () => ansichtRef.current,
    aktIndex: () => aktRef.current.r,
    editorOffen: () => !!editorRef.current,
    sichtbarSetzen: (werte) => setSichtbarkeit((v) => ({ ...v, ...werte })),
    sichtbare: () => sichtbarRef.current.map((x) => x.s.schluessel),
  }));

  // ---- Zeichnen ----
  const neuSpalte = Math.max(0, sichtbar.findIndex((x) => x.s.editierbar !== false && x.s.art !== 'NurLesen' && x.s.art !== 'Bool'));
  const items = virt.getVirtualItems();
  let edX = 0;
  if (editor) for (let i = 0; i < editor.c; i++) edX += sichtbar[i]?.c.getSize() || 0;
  const edZeile = editor ? zeile(editor.r) : undefined;
  const edSpalte = editor ? sichtbar[editor.c]?.s : undefined;

  return (
    <div ref={wurzel} className={`tb${props.className ? ` ${props.className}` : ''}`} tabIndex={0} role="grid" aria-rowcount={anzahl} data-tabelle={name}
      onKeyDown={taste} onCopy={kopieren} onPaste={(e) => { void einfuegen(e); }}>
      <div ref={rollen} className="tb-rollen">
        <div className="tb-kopf" style={{ width: Math.max(gesamtbreite, 0) }} role="row" onContextMenu={(e) => { e.preventDefault(); spaltenMenue(e.clientX, e.clientY); }}>
          {tabelle.getFlatHeaders().filter((h) => h.column.getIsVisible()).map((h) => {
            const s = spaltenMap.get(h.column.id)!;
            const rechts = s.ausrichtung === 'rechts' || s.art === 'Ganzzahl' || s.art === 'Dezimal';
            return (
              <div key={h.id} role="columnheader" className={`tb-kz${rechts ? ' rechts' : ''}${ziehtUeber === s.schluessel ? ' zieht' : ''}`} style={{ width: h.getSize() }}
                title={s.hinweis || s.titel} draggable data-spalte={s.schluessel}
                onClick={(e) => { if (!(e.target as HTMLElement).classList.contains('tb-breite')) sortieren(s.schluessel); }}
                onDragStart={(e) => { e.dataTransfer.setData('text/x-spalte', s.schluessel); e.dataTransfer.effectAllowed = 'move'; }}
                onDragOver={(e) => { if (e.dataTransfer.types.includes('text/x-spalte')) { e.preventDefault(); setZiehtUeber(s.schluessel); } }}
                onDragLeave={() => setZiehtUeber(null)}
                onDrop={(e) => { e.preventDefault(); setZiehtUeber(null); spalteVerschieben(e.dataTransfer.getData('text/x-spalte'), s.schluessel); }}>
                <span className="tb-titel">{s.titel}</span>
                {sort?.schluessel === s.schluessel ? <span className="tb-sort">{sort.ab ? <ArrowSortDown16Regular /> : <ArrowSortUp16Regular />}</span> : null}
                <span className={`tb-breite${h.column.getIsResizing() ? ' aktiv' : ''}`} draggable={false}
                  onMouseDown={(e) => { e.stopPropagation(); h.getResizeHandler()(e); }} onTouchStart={h.getResizeHandler()}
                  onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }} onClick={(e) => e.stopPropagation()} />
              </div>
            );
          })}
        </div>
        <div className="tb-platz" style={{ height: virt.getTotalSize(), width: gesamtbreite }} onMouseDown={klick} onDoubleClick={doppelklick} onContextMenu={kontext}>
          {items.map((v) => {
            const r = v.index;
            const z = zeile(r)!;
            const neu = istNeu(z);
            const id = neu ? NEU_ID : idVon(z);
            const kl = ['tb-zeile'];
            if (neu) kl.push('tb-neu');
            else {
              if (gewaehlt.has(id)) kl.push('gewaehlt');
              const k = props.zeilenKlasse?.(z, r);
              if (k) kl.push(k);
            }
            return (
              <div key={`${String(id)}-${r}`} className={kl.join(' ')} data-r={r} role="row" aria-selected={gewaehlt.has(id) || undefined}
                style={{ top: v.start, height: H, width: gesamtbreite }}>
                {sichtbar.map(({ c, s }, ci) => {
                  const t = neu ? (ci === neuSpalte ? (props.neuText || 'Neu …') : '') : text(z, s);
                  const zk = ['tb-zelle'];
                  if (s.art === 'Bool' || s.art === 'Haken') zk.push('mitte');
                  else if (s.ausrichtung === 'rechts' || s.art === 'Ganzzahl' || s.art === 'Dezimal') zk.push('rechts');
                  else if (s.ausrichtung === 'mitte') zk.push('mitte');
                  if (!neu && (s.art === 'NurLesen' || s.art === 'Haken' || s.editierbar === false)) zk.push('nurlesen');
                  if (r === akt.r && ci === akt.c) zk.push('aktiv');
                  const extra = !neu ? s.klasse?.(z) : null;
                  if (extra) zk.push(extra);
                  const farbe = !neu ? s.farbe?.(z) : null;
                  let inhalt: ReactElement;
                  if (!neu && s.art === 'Bool') inhalt = <span className={`tb-haken${t === 'X' || t === 'true' ? ' an' : ''}`} />;
                  else if (!neu && s.art === 'Haken') inhalt = t && t !== 'false' ? <Checkmark16Regular /> : <span />;
                  else if (!neu && s.art === 'Farbe' && t) inhalt = <><span className="tb-farbpunkt" style={{ background: t }} /><span className="t">{t}</span></>;
                  else inhalt = <span className="t" title={t.length > 12 ? t : undefined}>{t}</span>;
                  return (
                    <div key={c.id} className={zk.join(' ')} data-c={ci} role="gridcell" style={{ width: c.getSize(), background: farbe || undefined }}>{inhalt}</div>
                  );
                })}
              </div>
            );
          })}
          {editor && edZeile && edSpalte ? (
            edSpalte.art === 'Auswahl' && edSpalte.auswahl?.length ? (
              <select className="tb-editor" autoFocus defaultValue={text(edZeile, edSpalte)} key={editor.nr}
                style={{ left: edX, top: editor.r * H, width: Math.max(edSpalte.breite || 80, sichtbar[editor.c]!.c.getSize()), height: H + 1 }}
                onChange={(e) => { void editorBeenden(true, e.target.value).then(() => setTimeout(fokus)); }} onKeyDown={editorTaste}
                onBlur={() => setTimeout(() => { if (editorRef.current?.nr === editor.nr) void editorBeenden(false); }, 150)}>
                <option value="" />
                {edSpalte.auswahl.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            ) : (
              <>
                <input ref={eingabe} key={editor.nr} className="tb-editor" spellCheck={false} autoComplete="off" defaultValue={editor.start ?? text(edZeile, edSpalte)}
                  style={{ left: edX, top: editor.r * H, width: Math.max(sichtbar[editor.c]!.c.getSize(), edSpalte.art === 'ElementListe' ? 160 : 60), height: H + 1 }}
                  onKeyDown={editorTaste} onMouseDown={(e) => e.stopPropagation()}
                  onBlur={() => setTimeout(() => { if (editorRef.current?.nr === editor.nr && document.activeElement !== eingabe.current) void editorBeenden(true); }, 150)} />
                {(edSpalte.art === 'Element' || edSpalte.art === 'ElementListe') && props.optionen ? (
                  <Vorschlagsliste key={`v${editor.nr}`} ref={vorschlag} input={eingabe} liste={edSpalte.art === 'ElementListe'} optionen={() => props.optionen!(edSpalte)} />
                ) : null}
              </>
            )
          ) : null}
        </div>
        {ansicht.length === 0 && !props.neu ? <div className="tb-leer">{leerText}</div> : null}
      </div>
    </div>
  );
}

/** Datentabelle; die Methoden (waehle, ausgewaehlte …) über eine ref (TabelleApi). */
export const Tabelle = forwardRef(TabelleInnen) as <Z>(p: TabelleProps<Z> & { ref?: Ref<TabelleApi<Z>> }) => ReactElement;
