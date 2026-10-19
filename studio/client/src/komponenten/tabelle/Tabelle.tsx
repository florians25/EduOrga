// Datentabelle (TanStack Table + TanStack Virtual) für Stammdaten, Unterricht und die Listen der Module – bedient sich wie
// eine Tabellenkalkulation.
//
// Spalten: [{ schluessel, titel, breite, art, editierbar, editierbarFuer, auswahl, refTyp, ausrichtung, standard, karteikarte,
//            pruefen, zusatzWerte, vorschlaege, wert(z), farbe(z), klasse(z), aendern(z, wert) }]
//   art: 'Text' | 'Ganzzahl' | 'Dezimal' | 'Bool' | 'Bereich' | 'Element' | 'ElementListe' | 'Farbe' | 'Auswahl' | 'Datum' | 'NurLesen'
//
// Auswahl: Klick markiert eine Zeile, Strg/⌘+Klick schaltet einzelne Zeilen um, Umschalt+Klick bzw. Ziehen mit der Maus
//   markiert einen Bereich (Zeilen × Spalten), Strg+A alles, optional Auswahlkästchen vor jeder Zeile (Spaltenmenü).
//   Die Fußleiste der Tabelle zeigt die Anzahl (und die Summe markierter Zahlen) und die Sammelaktionen.
// Tastatur: Pfeile, Tab, Bild↑/↓, Pos1/Ende, Strg+Pfeil (an den Rand), Umschalt+Pfeil (Bereich erweitern), Enter/F2
//   (bearbeiten), Tippen beginnt die Eingabe, Alt+↓/F4 öffnet die Auswahlliste, Esc (abbrechen bzw. Auswahl aufheben),
//   Entf (Zelle leeren, bei mehreren Zeilen: Zeilen löschen über beiEntf), Rücktaste bei Bereich (Inhalte löschen),
//   Leertaste (Haken), Strg+C/Strg+V (Tabulator-Text, auch aus Tabellenkalkulationen; ein Wert füllt den ganzen Bereich),
//   Strg+D (nach unten ausfüllen), Strg+Umschalt+L (Filterzeile).
// Bearbeiten: Element- und Auswahlspalten haben ein Kombinationsfeld mit den zulässigen Werten (Kurz- und Langname, Tippen
//   filtert: Kurzname beginnt mit …, dann Name enthält …), Listen (5a,5b) eine Mehrfachauswahl, Freitext Vorschläge aus den
//   vorhandenen Werten der Spalte. Unbekannte bzw. ungültige Werte werden nicht gespeichert: das Feld bleibt offen und zeigt
//   den Fehler, beim Einfügen wird die Zelle rot markiert (Hinweis am Mauszeiger).
// Kopfzeile: Klick sortiert, Rand ziehen ändert die Breite, Kopf ziehen verschiebt die Spalte, Rechtsklick: Spaltenmenü
//   (sortieren, filtern, nach Wert filtern, ausblenden, Spalten ein-/ausblenden). Spaltenzustand (Reihenfolge, Breite,
//   Sichtbarkeit, Sortierung, Filterzeile, Auswahlkästchen) wird je Tabelle im Browser (localStorage) und – mit
//   zustandSchluessel – zusätzlich als Benutzereinstellung gespeichert.
import {
  getCoreRowModel, useReactTable, type ColumnDef, type ColumnOrderState, type ColumnSizingState, type VisibilityState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button } from '@fluentui/react-components';
import { ArrowSortDown16Regular, ArrowSortUp16Regular, Checkmark16Regular, ChevronDown12Regular, Dismiss12Regular, Filter12Filled } from '@fluentui/react-icons';
import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
  type ClipboardEvent, type KeyboardEvent, type MouseEvent as RMouseEvent, type ReactElement, type Ref,
} from 'react';
import { einstellungLesen, einstellungSchreiben } from '@/api/client';
import type { ElementOption } from '@/api/typen';
import { entprellen, textbreite, vergleich } from '@/kern/hilfen';
import { frage } from '../dialoge';
import { fehlerMelden, hinweis } from '../hinweise';
import { menue, type MenueListe } from '../menue';
import { mehrfachDialog, mehrfachWert } from './mehrfach';
import { auswahlOptionen, filterPasst, istListenart, pruefeWert, tsvLesen, tsvSchreiben } from './pruefung';
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
  /** zulässige Werte bei art 'Auswahl' */
  auswahl?: string[];
  refTyp?: string;
  ausrichtung?: 'rechts' | 'mitte';
  /** sichtbar in der Grundeinstellung (Standard: ja) */
  standard?: boolean;
  /** Gruppe im Menü „Spalten ein-/ausblenden“ */
  karteikarte?: string;
  hinweis?: string;
  /** Eingaben vor dem Speichern prüfen (Standard: ja; false = Server entscheidet, z. B. „Alle Klassen außer 5a“) */
  pruefen?: boolean;
  /** weitere zulässige Werte einer Elementspalte (z. B. „-“ für Entfall) */
  zusatzWerte?: string[];
  /** weitere zulässige Teile einer Elementspalte (z. B. „Alle Klassen außer 5a“) */
  zulassen?: (teil: string) => boolean;
  /** Freitext: Vorschläge aus vorhandenen Werten der Spalte (Standard: ja) */
  vorschlaege?: boolean;
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
  /** mehrere Werte in einem Aufruf (Einfügen, Mehrfach ändern, Ausfüllen) – sonst nacheinander über aendern */
  aendernMehrere?: (liste: Aenderung<Z>[]) => Promise<unknown>;
  neu?: (s: Spalte<Z>, wert: string) => Promise<unknown>;
  neuText?: string;
  /** zulässige Werte einer Element-/ElementListe-Spalte */
  optionen?: (s: Spalte<Z>) => Promise<ElementOption[]> | ElementOption[];
  beiAuswahl?: (zeilen: Z[], aktiv: Z | null) => void;
  beiDoppelklick?: (z: Z, s: Spalte<Z> | undefined) => void;
  beiEntf?: (zeilen: Z[]) => void;
  /** eigene Einträge des Kontextmenüs (davor); die Tabelle ergänzt Kopieren, Einfügen, Mehrfach ändern, Filter … */
  kontextmenue?: (zeilen: Z[], s: Spalte<Z> | undefined) => MenueListe;
  zeilenKlasse?: (z: Z, i: number) => string | null | undefined;
  leerText?: string;
  /** Zeilen derselben Gruppe bleiben beim Sortieren und Filtern zusammen (z. B. Kopplungszeilen eines Unterrichts) */
  gruppiert?: (z: Z) => unknown;
  sortierbar?: boolean;
  /** Auswahlkästchen vor den Zeilen (Grundeinstellung; im Spaltenmenü umschaltbar) */
  auswahlSpalte?: boolean;
  /** Fußleiste mit Anzahl markierter Zeilen und Sammelaktionen (Standard: ja) */
  statusleiste?: boolean;
  /** Eigene Tasten vor der Standardbehandlung (true = behandelt) */
  tasten?: (e: KeyboardEvent<HTMLDivElement>) => boolean;
  className?: string;
  /** Kennung für Tests (data-tabelle) und Ablage des Spaltenzustands im Browser */
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
  /** Diese Zeilen markieren (Mehrfachauswahl ersetzen) */
  markieren: (ids: (string | number)[]) => void;
  /** Dialog „Mehrfach ändern“ für die markierten Zeilen */
  mehrfachAendern: (spalte?: string) => void;
  /** Filterzeile ein-/ausblenden */
  filterZeile: (an?: boolean) => void;
  auswahlAufheben: () => void;
}

const NEU_ID = '__neu';
const NEU = Object.freeze({ __neu: true }) as unknown;
const istNeu = (z: unknown) => z === NEU;
const KOPF_H = 32;
const FILTER_H = 30;
const MK_B = 30;

interface GespeicherterZustand {
  spalten?: { s: string; b?: number; v?: boolean }[];
  sort?: { schluessel: string; ab: boolean } | null;
  /** Auswahlkästchen */
  mk?: boolean;
  /** Filterzeile */
  fz?: boolean;
  /** kompakte Zeilen (24 px) */
  kp?: boolean;
}
interface Rechteck { r1: number; r2: number; c1: number; c2: number }
interface Editor { r: number; c: number; start?: string; wert?: string; fehler?: string; nr: number }

const lokalSchluessel = (k: string) => `studio.${k}`;
function lokalLesen(k: string | null): GespeicherterZustand | null {
  if (!k) return null;
  try { return JSON.parse(localStorage.getItem(lokalSchluessel(k)) || 'null') as GespeicherterZustand | null; } catch { return null; }
}
function lokalSchreiben(k: string | null, z: GespeicherterZustand) {
  if (!k) return;
  try { localStorage.setItem(lokalSchluessel(k), JSON.stringify(z)); } catch { /* privat/voll */ }
}

const zahlWert = (t: string): number | null => (/^\s*-?\d+([.,]\d+)?\s*$/.test(t) ? Number(t.replace(',', '.')) : null);
const zahlText = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 2 });

function TabelleInnen<Z>(props: TabelleProps<Z>, ref: Ref<TabelleApi<Z>>) {
  const {
    spalten, zeilen, zustandSchluessel, leerText = 'Keine Einträge', sortierbar = true, name,
  } = props;
  const idVon = useCallback((z: Z) => (props.id ? props.id(z) : (z as { id: string | number }).id), [props.id]);
  const propsRef = useRef(props);
  propsRef.current = props;
  const ablage = zustandSchluessel || (name ? `tabelle.${name}` : null);

  // ---- Spaltenzustand (Reihenfolge, Sichtbarkeit, Breite), Sortierung, Filter, Auswahlkästchen ----
  const gespeichert = useRef<GespeicherterZustand | null>(lokalLesen(ablage));
  const [reihenfolge, setReihenfolge] = useState<ColumnOrderState>([]);
  const [sichtbarkeit, setSichtbarkeit] = useState<VisibilityState>({});
  const [breiten, setBreiten] = useState<ColumnSizingState>({});
  const [sort, setSort] = useState<{ schluessel: string; ab: boolean } | null>(null);
  const [mitKaestchen, setMitKaestchen] = useState<boolean>(() => gespeichert.current?.mk ?? !!props.auswahlSpalte);
  const [filterZeile, setFilterZeile] = useState<boolean>(() => !!gespeichert.current?.fz);
  const [filter, setFilter] = useState<Record<string, string>>({});
  const [kompakt, setKompakt] = useState<boolean>(() => !!gespeichert.current?.kp);
  const H = kompakt ? 24 : props.zeilenHoehe ?? 28;
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
      lokalSchreiben(ablage, z);
      const map = new Map(z.spalten.map((x, i) => [x.s, { ...x, i }]));
      setReihenfolge((alt) => [...alt].sort((a, b) => (map.get(a)?.i ?? 999) - (map.get(b)?.i ?? 999)));
      setSichtbarkeit((alt) => { const n = { ...alt }; for (const [k, v] of map) if (k in n) n[k] = !!v.v; if (!Object.values(n).some(Boolean)) { const e = Object.keys(n)[0]; if (e) n[e] = true; } return n; });
      setBreiten((alt) => { const n = { ...alt }; for (const [k, v] of map) if (v.b) n[k] = v.b; return n; });
      if (z.sort !== undefined) setSort(z.sort);
      if (z.mk !== undefined) setMitKaestchen(z.mk);
      if (z.fz !== undefined) setFilterZeile(z.fz);
      if (z.kp !== undefined) setKompakt(z.kp);
    }).catch(() => { geladen.current = true; });
    return () => { aktiv = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zustandSchluessel]);

  const speichern = useMemo(() => entprellen((z: GespeicherterZustand) => {
    gespeichert.current = z;
    lokalSchreiben(ablage, z);
    if (zustandSchluessel && geladen.current) void einstellungSchreiben(zustandSchluessel, z);
  }, 600), [zustandSchluessel, ablage]);
  const zustandMerken = useRef(false);
  useEffect(() => {
    if (!zustandMerken.current) return;
    zustandMerken.current = false;
    speichern({ spalten: reihenfolge.map((k) => ({ s: k, b: breiten[k], v: !!sichtbarkeit[k] })), sort, mk: mitKaestchen, fz: filterZeile, kp: kompakt });
  }, [reihenfolge, sichtbarkeit, breiten, sort, mitKaestchen, filterZeile, kompakt, speichern]);
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
  const mkB = mitKaestchen ? MK_B : 0;
  const gesamtbreite = mkB + sichtbar.reduce((a, x) => a + x.c.getSize(), 0);
  const kopfH = KOPF_H + (filterZeile ? FILTER_H : 0);

  // ---- Zeilen (gefiltert, sortiert) ----
  const text = useCallback((z: Z | undefined, s: Spalte<Z> | undefined): string => {
    if (!z || !s || istNeu(z)) return '';
    const v = s.wert ? s.wert(z) : (z as Record<string, unknown>)[s.schluessel];
    return v === null || v === undefined ? '' : String(v);
  }, []);
  const filterAktiv = Object.entries(filter).filter(([k, f]) => f.trim() && spaltenMap.has(k));
  const filterText = filterAktiv.map(([k, f]) => `${k}=${f}`).join('\u0001');
  // Zeilen, die durch eine Bearbeitung aus dem Filter fallen, bleiben bis zur nächsten Filteränderung sichtbar
  const behalten = useRef(new Set<string | number>());
  const [behaltenNr, setBehaltenNr] = useState(0);
  useEffect(() => { behalten.current.clear(); setBehaltenNr((n) => n + 1); }, [filterText]);
  const behaltenMerken = (z: Z) => { if (filterAktivRef.current && !behalten.current.has(idVon(z))) { behalten.current.add(idVon(z)); setBehaltenNr((n) => n + 1); } };
  const gefiltert = useMemo(() => {
    if (!filterAktiv.length) return zeilen;
    const passt = (z: Z, k: string, f: string) => behalten.current.has(idVon(z)) || filterPasst(text(z, spaltenMap.get(k)), f);
    if (props.gruppiert) {
      const gruppen = new Map<unknown, Z[]>();
      for (const z of zeilen) { const g = props.gruppiert(z); if (!gruppen.has(g)) gruppen.set(g, []); gruppen.get(g)!.push(z); }
      return [...gruppen.values()].filter((l) => filterAktiv.every(([k, f]) => l.some((z) => passt(z, k, f)))).flat();
    }
    return zeilen.filter((z) => filterAktiv.every(([k, f]) => passt(z, k, f)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zeilen, filterText, spaltenMap, text, behaltenNr]);
  const filterAktivRef = useRef(false); filterAktivRef.current = filterAktiv.length > 0;
  const ansicht = useMemo(() => {
    const s = sort && spaltenMap.get(sort.schluessel);
    if (!s || !sortierbar) return gefiltert.slice();
    const f = sort!.ab ? -1 : 1;
    if (props.gruppiert) {
      const gruppen = new Map<unknown, Z[]>();
      for (const z of gefiltert) { const g = props.gruppiert(z); if (!gruppen.has(g)) gruppen.set(g, []); gruppen.get(g)!.push(z); }
      return [...gruppen.values()].sort((a, b) => f * vergleich(text(a[0], s), text(b[0], s))).flat();
    }
    return gefiltert.slice().sort((a, b) => f * vergleich(text(a, s), text(b, s)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gefiltert, sort, spaltenMap, sortierbar, text]);
  const anzahl = ansicht.length + (props.neu ? 1 : 0);
  const zeile = (r: number): Z | undefined => (r < ansichtRef.current.length ? ansichtRef.current[r] : propsRef.current.neu && r === ansichtRef.current.length ? (NEU as Z) : undefined);

  // ---- Auswahl ----
  const [akt, setAkt] = useState({ r: 0, c: 0 });
  const [gewaehlt, setGewaehlt] = useState<Set<string | number>>(() => new Set());
  const [bereich, setBereich] = useState<Rechteck | null>(null);
  const [fehler, setFehler] = useState<Map<string, string>>(() => new Map());
  const anker = useRef({ r: 0, c: 0 });
  const aktRef = useRef(akt); aktRef.current = akt;
  const gewaehltRef = useRef(gewaehlt); gewaehltRef.current = gewaehlt;
  const bereichRef = useRef(bereich); bereichRef.current = bereich;
  const ansichtRef = useRef(ansicht); ansichtRef.current = ansicht;
  const sichtbarRef = useRef(sichtbar); sichtbarRef.current = sichtbar;
  const mkRef = useRef(mkB); mkRef.current = mkB;
  const kopfRef = useRef(kopfH); kopfRef.current = kopfH;
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
    setBereich((b) => (b && b.r2 >= ansicht.length ? null : b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ansicht]);

  const ausgewaehlteVon = (g: Set<string | number>, a: { r: number }): Z[] => {
    if (g.size) return ansichtRef.current.filter((z) => g.has(idVon(z)));
    const z = a.r < ansichtRef.current.length ? ansichtRef.current[a.r] : undefined;
    return z ? [z] : [];
  };
  const fehlerSchluessel = (z: Z, s: Spalte<Z>) => `${String(idVon(z))}\u0001${s.schluessel}`;
  const fehlerSetzen = (z: Z, s: Spalte<Z>, f: string | null) => {
    if (istNeu(z)) return;
    const k = fehlerSchluessel(z, s);
    setFehler((m) => {
      if (f === null && !m.has(k)) return m;
      const n = new Map(m);
      if (f === null) n.delete(k); else n.set(k, f);
      return n;
    });
  };

  const rollen = useRef<HTMLDivElement>(null);
  const wurzel = useRef<HTMLDivElement>(null);
  const virt = useVirtualizer({ count: anzahl, getScrollElement: () => rollen.current, estimateSize: () => H, overscan: 10 });

  const sichtbarMachen = (r: number, c: number) => {
    const k = rollen.current;
    if (!k) return;
    const y = r * H;
    const kh = kopfRef.current;
    if (y < k.scrollTop) k.scrollTop = y;
    else if (y + H > k.scrollTop + k.clientHeight - kh) k.scrollTop = y + H - k.clientHeight + kh;
    let x = mkRef.current;
    const sp = sichtbarRef.current;
    for (let i = 0; i < c; i++) x += sp[i]!.c.getSize();
    const b = sp[c]?.c.getSize() || 0;
    if (x - mkRef.current < k.scrollLeft) k.scrollLeft = x - mkRef.current;
    else if (x + b > k.scrollLeft + k.clientWidth) k.scrollLeft = x + b - k.clientWidth;
  };

  const auswahlMelden = (g: Set<string | number>, a: { r: number }) => {
    const z = ansichtRef.current[a.r];
    propsRef.current.beiAuswahl?.(ausgewaehlteVon(g, a), z ?? null);
  };

  const gehe = (r: number, c: number, erweitern = false, einzeln = false) => {
    const n = ansichtRef.current.length + (propsRef.current.neu ? 1 : 0);
    if (n === 0) return;
    r = Math.max(0, Math.min(n - 1, r));
    c = Math.max(0, Math.min(sichtbarRef.current.length - 1, c));
    let g = gewaehltRef.current;
    let b: Rechteck | null = null;
    if (erweitern) {
      const a = anker.current;
      b = { r1: Math.min(a.r, r), r2: Math.max(a.r, r), c1: Math.min(a.c, c), c2: Math.max(a.c, c) };
      g = new Set();
      for (let i = b.r1; i <= b.r2; i++) { const z = ansichtRef.current[i]; if (z) g.add(idVon(z)); }
    } else if (einzeln) {
      g = new Set(g);
      // erste Strg-Auswahl: die bisher aktive Zeile bleibt markiert
      if (!g.size) { const alt = ansichtRef.current[aktRef.current.r]; if (alt && aktRef.current.r !== r) g.add(idVon(alt)); }
      const z = ansichtRef.current[r];
      if (z) { const id = idVon(z); if (g.has(id)) g.delete(id); else g.add(id); }
      anker.current = { r, c };
    } else {
      if (g.size) g = new Set();
      anker.current = { r, c };
    }
    const neuAkt = { r, c };
    setAkt(neuAkt);
    setGewaehlt(g);
    setBereich(b);
    aktRef.current = neuAkt;
    gewaehltRef.current = g;
    bereichRef.current = b;
    const z = ansichtRef.current[r];
    aktIdRef.current = z ? idVon(z) : null;
    sichtbarMachen(r, c);
    auswahlMelden(g, neuAkt);
  };

  const allesMarkieren = () => {
    const g = new Set(ansichtRef.current.map(idVon));
    const b = ansichtRef.current.length ? { r1: 0, r2: ansichtRef.current.length - 1, c1: 0, c2: Math.max(0, sichtbarRef.current.length - 1) } : null;
    setGewaehlt(g); gewaehltRef.current = g;
    setBereich(b); bereichRef.current = b;
    auswahlMelden(g, aktRef.current);
  };
  const auswahlAufheben = () => {
    const g = new Set<string | number>();
    setGewaehlt(g); gewaehltRef.current = g;
    setBereich(null); bereichRef.current = null;
    anker.current = { ...aktRef.current };
    auswahlMelden(g, aktRef.current);
  };

  // ---- Bearbeiten ----
  const [editor, setEditor] = useState<Editor | null>(null);
  const editorRef = useRef(editor); editorRef.current = editor;
  const eingabe = useRef<HTMLInputElement | null>(null);
  const vorschlag = useRef<VorschlagslisteApi>(null);

  const editierbar = (s: Spalte<Z> | undefined, z: Z | undefined): boolean => {
    if (!s || !z || s.art === 'NurLesen' || s.art === 'Haken' || s.editierbar === false) return false;
    if (istNeu(z)) return !!propsRef.current.neu;
    if (typeof s.editierbarFuer === 'function') return s.editierbarFuer(z);
    return !!(propsRef.current.aendern || s.aendern);
  };
  const aenderbar = () => !!(propsRef.current.aendern || propsRef.current.aendernMehrere || spalten.some((s) => s.aendern));

  const fokus = () => { if (!editorRef.current) wurzel.current?.focus({ preventScroll: true }); };

  /** zulässige Werte einer Spalte (Element/Liste: über props.optionen; Auswahl: s.auswahl) */
  const optionenVon = async (s: Spalte<Z>): Promise<ElementOption[] | null> => {
    if (s.art === 'Auswahl') return auswahlOptionen(s.auswahl);
    if ((s.art === 'Element' || s.art === 'ElementListe') && propsRef.current.optionen) {
      try { return await propsRef.current.optionen(s); } catch { return null; }
    }
    return null;
  };
  /** vorhandene Werte einer Freitextspalte (Vorschläge) */
  const spaltenWerte = (s: Spalte<Z>): ElementOption[] => {
    const m = new Set<string>();
    for (const z of propsRef.current.zeilen) { const t = text(z, s); if (t) m.add(t); if (m.size > 2000) break; }
    return [...m].sort(vergleich).map((k, i) => ({ id: i, k, l: '' }));
  };

  /** Speichert einen (geprüften) Wert; Fehler des Servers markieren die Zelle. true = gespeichert */
  const speichernWert = async (z: Z, s: Spalte<Z>, wert: string): Promise<boolean> => {
    try {
      if (istNeu(z)) { await propsRef.current.neu?.(s, wert); return true; }
      behaltenMerken(z);
      if (s.aendern) await s.aendern(z, wert);
      else await propsRef.current.aendern?.(z, s, wert);
      fehlerSetzen(z, s, null);
      return true;
    } catch (f) {
      fehlerMelden(f);
      fehlerSetzen(z, s, `„${wert}“ wurde nicht gespeichert: ${f instanceof Error ? f.message : String(f)}`);
      return false;
    }
  };

  const bearbeiten = (start?: string) => {
    const { r, c } = aktRef.current;
    const z = zeile(r), s = sichtbarRef.current[c]?.s;
    if (!z || !editierbar(s, z)) return;
    if (s!.art === 'Bool') { if (!istNeu(z)) void speichernWert(z, s!, text(z, s) === 'X' ? '' : 'X'); return; }
    sichtbarMachen(r, c);
    const ed = { r, c, start, nr: Date.now() };
    editorRef.current = ed;
    setEditor(ed);
  };

  /** Editor schließen; übernehmen = prüfen und speichern. false = ungültig (Editor bleibt bzw. Zelle wird markiert). */
  const editorBeenden = async (uebernehmen: boolean, wert?: string, ausBlur = false): Promise<boolean> => {
    const ed = editorRef.current;
    if (!ed) return true;
    const w = wert ?? eingabe.current?.value ?? '';
    setEditor(null);
    editorRef.current = null;
    const z = zeile(ed.r), s = sichtbarRef.current[ed.c]?.s;
    if (!z || !s || !uebernehmen) return true;
    const alt = text(z, s);
    if (w === alt) { fehlerSetzen(z, s, null); return true; }
    const p = pruefeWert(s, w, await optionenVon(s));
    if (!p.ok) {
      if (ausBlur) {
        fehlerSetzen(z, s, `${p.fehler} Nicht gespeichert.`);
        hinweis(`${p.fehler} Nicht gespeichert.`, 'warnung', 4000);
        return false;
      }
      const neu: Editor = { r: ed.r, c: ed.c, wert: w, fehler: p.fehler, nr: Date.now() };
      editorRef.current = neu;
      setEditor(neu);
      return false;
    }
    if (p.wert === alt) { fehlerSetzen(z, s, null); return true; }
    await speichernWert(z, s, p.wert);
    return true;
  };

  const editorTaste = (e: KeyboardEvent<HTMLInputElement>) => {
    if (vorschlag.current?.taste(e as KeyboardEvent)) { e.stopPropagation(); return; }
    const { r, c } = aktRef.current;
    const nSp = sichtbarRef.current.length;
    const weiter = (dr: number, dc: number) => {
      void editorBeenden(true).then((ok) => {
        if (!ok) return;
        if (dc > 0 && c >= nSp - 1) gehe(r + 1, 0);
        else if (dc < 0 && c <= 0) gehe(r - 1, nSp - 1);
        else if (dr || dc) gehe(r + dr, c + dc);
        setTimeout(fokus);
      });
    };
    if (e.key === 'Enter') { e.preventDefault(); weiter(e.ctrlKey || e.metaKey ? 0 : e.shiftKey ? -1 : 1, 0); }
    else if (e.key === 'Tab') { e.preventDefault(); weiter(0, e.shiftKey ? -1 : 1); }
    else if (e.key === 'Escape') { e.preventDefault(); void editorBeenden(false); setTimeout(fokus); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); weiter(e.key === 'ArrowDown' ? 1 : -1, 0); }
    e.stopPropagation();
  };

  useEffect(() => {
    if (!editor) return;
    const el = eingabe.current;
    if (!el) return;
    el.focus();
    if (editor.start === undefined && editor.wert === undefined) el.select(); else el.setSelectionRange(el.value.length, el.value.length);
    if (editor.start !== undefined) vorschlag.current?.zeigen();
  }, [editor]);

  // ---- Werte anwenden (Einfügen, Ausfüllen, Inhalte löschen, Mehrfach ändern) ----
  const werteAnwenden = async (ziele: { z: Z; s: Spalte<Z>; wert: string }[], was: string) => {
    const opts = new Map<string, ElementOption[] | null>();
    const aenderungen: Aenderung<Z>[] = [];
    let ungueltig = 0, gesperrt = 0;
    for (const { z, s, wert } of ziele) {
      if (istNeu(z)) continue;
      if (!editierbar(s, z)) { gesperrt++; continue; }
      if (!opts.has(s.schluessel)) opts.set(s.schluessel, await optionenVon(s));
      const p = pruefeWert(s, wert, opts.get(s.schluessel)!);
      if (!p.ok) { ungueltig++; fehlerSetzen(z, s, `${p.fehler} Nicht gespeichert.`); continue; }
      fehlerSetzen(z, s, null);
      if (text(z, s) !== p.wert) aenderungen.push({ zeile: z, spalte: s, wert: p.wert });
    }
    let fehlgeschlagen = 0;
    if (aenderungen.length) {
      const sammel = propsRef.current.aendernMehrere;
      const einzeln = sammel ? aenderungen.filter((x) => x.spalte.aendern) : aenderungen;
      try {
        const rest = aenderungen.filter((x) => !einzeln.includes(x));
        for (const x of rest) behaltenMerken(x.zeile);
        if (sammel && rest.length) await sammel(rest);
      } catch (f) {
        fehlerMelden(f);
        return;
      }
      for (const a of einzeln) if (!(await speichernWert(a.zeile, a.spalte, a.wert))) fehlgeschlagen++;
    }
    const teile = [`${was}: ${aenderungen.length - fehlgeschlagen} ${aenderungen.length - fehlgeschlagen === 1 ? 'Wert' : 'Werte'} geändert`];
    if (ungueltig) teile.push(`${ungueltig} ungültig (rot markiert)`);
    if (fehlgeschlagen) teile.push(`${fehlgeschlagen} abgelehnt`);
    if (gesperrt) teile.push(`${gesperrt} nicht änderbar`);
    hinweis(`${teile.join(' · ')}.`, ungueltig || fehlgeschlagen ? 'warnung' : 'ok', ungueltig || fehlgeschlagen ? 5000 : 2500);
  };

  /** Zielzellen der Auswahl: Bereich bzw. markierte Zeilen in der aktiven Spalte bzw. die aktive Zelle */
  const zielZellen = (): { z: Z; s: Spalte<Z> }[] => {
    const sp = sichtbarRef.current.map((x) => x.s);
    const b = bereichRef.current;
    const g = gewaehltRef.current;
    const erg: { z: Z; s: Spalte<Z> }[] = [];
    if (b) {
      for (let r = b.r1; r <= b.r2; r++) { const z = ansichtRef.current[r]; if (z) for (let c = b.c1; c <= b.c2; c++) if (sp[c]) erg.push({ z, s: sp[c]! }); }
    } else if (g.size > 1) {
      const s = sp[aktRef.current.c];
      if (s) for (const z of ausgewaehlteVon(g, aktRef.current)) erg.push({ z, s });
    } else {
      const z = ansichtRef.current[aktRef.current.r], s = sp[aktRef.current.c];
      if (z && s) erg.push({ z, s });
    }
    return erg;
  };

  const inhalteLoeschen = async () => {
    const ziele = zielZellen().filter((x) => editierbar(x.s, x.z) && text(x.z, x.s) !== '');
    if (!ziele.length) { hinweis('Keine änderbaren Inhalte markiert.', 'info', 2000); return; }
    if (ziele.length > 1 && !(await frage(`Inhalte von ${ziele.length} Zellen löschen?`, { ja: 'Löschen', gefahr: true }))) return;
    await werteAnwenden(ziele.map((x) => ({ ...x, wert: '' })), 'Inhalte gelöscht');
    fokus();
  };

  const ausfuellen = async () => {
    const sp = sichtbarRef.current.map((x) => x.s);
    const b = bereichRef.current;
    const ziele: { z: Z; s: Spalte<Z>; wert: string }[] = [];
    if (b && b.r2 > b.r1) {
      for (let c = b.c1; c <= b.c2; c++) {
        const s = sp[c]; const quelle = ansichtRef.current[b.r1];
        if (!s || !quelle) continue;
        const w = text(quelle, s);
        for (let r = b.r1 + 1; r <= b.r2; r++) { const z = ansichtRef.current[r]; if (z) ziele.push({ z, s, wert: w }); }
      }
    } else {
      const zl = ausgewaehlteVon(gewaehltRef.current, aktRef.current);
      const s = sp[aktRef.current.c];
      if (zl.length < 2 || !s) { hinweis('Zum Ausfüllen mehrere Zeilen markieren (Umschalt+↓).', 'info', 2500); return; }
      const w = text(zl[0], s);
      for (const z of zl.slice(1)) ziele.push({ z, s, wert: w });
    }
    await werteAnwenden(ziele, 'Ausgefüllt');
  };

  const mehrfachAendern = async (vorgabe?: string) => {
    const zl = ausgewaehlteVon(gewaehltRef.current, aktRef.current);
    if (!zl.length) { hinweis('Bitte zuerst Zeilen markieren.', 'info', 2000); return; }
    const reihen = new Map(reihenfolge.map((k, i) => [k, i]));
    const kandidaten = spalten
      .filter((s) => s.art !== 'NurLesen' && s.art !== 'Haken' && s.editierbar !== false && zl.some((z) => editierbar(s, z)))
      .sort((a, b) => (reihen.get(a.schluessel) ?? 999) - (reihen.get(b.schluessel) ?? 999));
    if (!kandidaten.length) { hinweis('In den markierten Zeilen ist keine Spalte änderbar.', 'info', 2500); return; }
    const e = await mehrfachDialog({
      spalten: kandidaten, vorgabe: vorgabe ?? sichtbarRef.current[aktRef.current.c]?.s.schluessel, anzahl: zl.length,
      optionen: async (x) => (await optionenVon(x as Spalte<Z>)) || [],
      werte: (x) => spaltenWerte(x as Spalte<Z>),
    });
    if (!e) { fokus(); return; }
    const s = spaltenMap.get(e.schluessel)!;
    await werteAnwenden(zl.map((z) => ({ z, s, wert: mehrfachWert(text(z, s), e) })), 'Mehrfach geändert');
    fokus();
  };

  // ---- Zwischenablage ----
  const kopierText = (): { text: string; anzahl: number } | null => {
    const sp = sichtbarRef.current.map((x) => x.s);
    const b = bereichRef.current;
    const g = gewaehltRef.current;
    if (b && (b.r2 > b.r1 || b.c2 > b.c1)) {
      const zl = ansichtRef.current.slice(b.r1, b.r2 + 1);
      return { text: tsvSchreiben(zl.map((z) => sp.slice(b.c1, b.c2 + 1).map((s) => text(z, s)))), anzahl: zl.length };
    }
    if (g.size > 1) {
      const zl = ausgewaehlteVon(g, aktRef.current);
      return { text: tsvSchreiben(zl.map((z) => sp.map((s) => text(z, s)))), anzahl: zl.length };
    }
    const z = zeile(aktRef.current.r);
    if (!z || istNeu(z)) return null;
    return { text: text(z, sp[aktRef.current.c]), anzahl: 0 };
  };
  const kopiertMelden = (k: { anzahl: number }) => hinweis(k.anzahl ? `${k.anzahl} ${k.anzahl === 1 ? 'Zeile' : 'Zeilen'} kopiert.` : 'Zelle kopiert.', 'info', 1500);

  const kopieren = (e: ClipboardEvent<HTMLDivElement>) => {
    if (editorRef.current || (e.target as HTMLElement).closest('input,textarea')) return;
    const k = kopierText();
    if (!k) return;
    e.clipboardData.setData('text/plain', k.text);
    e.preventDefault();
    kopiertMelden(k);
  };
  const kopierenAktion = async () => {
    const k = kopierText();
    if (!k) return;
    try { await navigator.clipboard.writeText(k.text); kopiertMelden(k); } catch { hinweis('Kopieren bitte mit Strg+C.', 'info', 2500); }
  };

  const einfuegenText = async (t: string) => {
    const m = tsvLesen(t);
    if (!m.length) return;
    const sp = sichtbarRef.current.map((x) => x.s);
    const b = bereichRef.current;
    const g = gewaehltRef.current;
    const ziele: { z: Z; s: Spalte<Z>; wert: string }[] = [];
    const einWert = m.length === 1 && m[0]!.length === 1;
    let ohneZiel = 0;
    if (einWert && ((b && (b.r2 > b.r1 || b.c2 > b.c1)) || g.size > 1)) {
      for (const x of zielZellen()) ziele.push({ ...x, wert: m[0]![0]! });
    } else {
      const r0 = b ? b.r1 : aktRef.current.r, c0 = b ? b.c1 : aktRef.current.c;
      m.forEach((zeileWerte, i) => {
        const z = ansichtRef.current[r0 + i];
        if (!z) { ohneZiel++; return; }
        zeileWerte.forEach((wert, j) => { const s = sp[c0 + j]; if (s) ziele.push({ z, s, wert }); });
      });
    }
    if (!ziele.length) return;
    await werteAnwenden(ziele, 'Eingefügt');
    if (ohneZiel) hinweis(`${ohneZiel} ${ohneZiel === 1 ? 'Zeile' : 'Zeilen'} der Zwischenablage ohne Zielzeile – nicht eingefügt.`, 'warnung', 4000);
  };
  const einfuegen = (e: ClipboardEvent<HTMLDivElement>) => {
    if (editorRef.current || (e.target as HTMLElement).closest('input,textarea')) return;
    const t = e.clipboardData.getData('text/plain');
    if (!t || !aenderbar()) return;
    e.preventDefault();
    void einfuegenText(t);
  };
  const einfuegenAktion = async () => {
    let t = '';
    try { t = await navigator.clipboard.readText(); } catch { hinweis('Einfügen bitte mit Strg+V.', 'info', 2500); return; }
    if (t) await einfuegenText(t);
  };

  // ---- Tastatur ----
  const taste = (e: KeyboardEvent<HTMLDivElement>) => {
    if (editorRef.current || (e.target as HTMLElement).closest('input,textarea,select')) return;
    if (propsRef.current.tasten?.(e)) { e.preventDefault(); return; }
    const { r, c } = aktRef.current;
    const seite = Math.max(1, Math.floor((rollen.current?.clientHeight || 300) / H) - 2);
    const strg = e.ctrlKey || e.metaKey;
    const z = zeile(r), s = sichtbarRef.current[c]?.s;
    const nSp = sichtbarRef.current.length;
    const n = ansichtRef.current.length + (propsRef.current.neu ? 1 : 0);
    const sh = e.shiftKey;
    switch (e.key) {
      case 'ArrowDown': if (e.altKey && istListenart(s?.art)) bearbeiten(); else gehe(strg ? n - 1 : r + 1, c, sh); break;
      case 'ArrowUp': gehe(strg ? 0 : r - 1, c, sh); break;
      case 'ArrowRight': gehe(r, strg ? nSp - 1 : c + 1, sh); break;
      case 'ArrowLeft': gehe(r, strg ? 0 : c - 1, sh); break;
      case 'PageDown': gehe(r + seite, c, sh); break;
      case 'PageUp': gehe(r - seite, c, sh); break;
      case 'Home': gehe(strg ? 0 : r, 0, sh); break;
      case 'End': gehe(strg ? n - 1 : r, nSp - 1, sh); break;
      case 'Tab':
        if (sh) { if (c > 0) gehe(r, c - 1); else gehe(r - 1, nSp - 1); }
        else if (c < nSp - 1) gehe(r, c + 1); else gehe(r + 1, 0);
        break;
      case 'Enter':
        if (z && editierbar(s, z) && s?.art !== 'Bool') bearbeiten();
        else gehe(r + (sh ? -1 : 1), c);
        break;
      case 'F2': bearbeiten(); break;
      case 'F4': if (istListenart(s?.art)) bearbeiten(); else return; break;
      case 'Escape':
        if (gewaehltRef.current.size || bereichRef.current) auswahlAufheben();
        else return;
        break;
      case ' ':
        if (s?.art === 'Bool' && z && !istNeu(z) && editierbar(s, z)) {
          const ziele = (gewaehltRef.current.size > 1 || bereichRef.current) ? zielZellen().filter((x) => x.s === s) : [];
          if (ziele.length > 1) { const w = text(z, s) === 'X' ? '' : 'X'; void werteAnwenden(ziele.map((x) => ({ ...x, wert: w })), w ? 'Gesetzt' : 'Entfernt'); }
          else void speichernWert(z, s, text(z, s) === 'X' ? '' : 'X');
        } else return;
        break;
      case 'Delete': case 'Backspace': {
        const b = bereichRef.current;
        const mehrereZellen = !!b && (b.r2 > b.r1 || b.c2 > b.c1);
        if (e.key === 'Backspace' && mehrereZellen) { void inhalteLoeschen(); break; }
        if (e.key === 'Delete' && gewaehltRef.current.size > 1 && propsRef.current.beiEntf) { propsRef.current.beiEntf(ausgewaehlteVon(gewaehltRef.current, aktRef.current)); break; }
        if (z && !istNeu(z) && editierbar(s, z) && s?.art !== 'Bool' && text(z, s) !== '') void speichernWert(z, s!, '');
        else if (e.key === 'Delete' && propsRef.current.beiEntf) propsRef.current.beiEntf(ausgewaehlteVon(gewaehltRef.current, aktRef.current));
        else if (e.key === 'Delete' && mehrereZellen) void inhalteLoeschen();
        break;
      }
      default:
        if (strg && (e.key === 'a' || e.key === 'A')) { allesMarkieren(); break; }
        if (strg && (e.key === 'd' || e.key === 'D') && aenderbar()) { void ausfuellen(); break; }
        if (strg && sh && (e.key === 'l' || e.key === 'L')) { filterZeileSetzen(!filterZeile); break; }
        tippen(e);
        return;
    }
    e.preventDefault();
  };

  const tippen = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
    const z = zeile(aktRef.current.r), s = sichtbarRef.current[aktRef.current.c]?.s;
    if (!z || !editierbar(s, z) || s?.art === 'Bool') return;
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
  const ziehtAuswahl = useRef(false);
  useEffect(() => {
    const los = () => { ziehtAuswahl.current = false; };
    window.addEventListener('mouseup', los);
    return () => window.removeEventListener('mouseup', los);
  }, []);

  const klick = (e: RMouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.tb-editbox')) return;
    const p = zelleBei(e);
    if (!p) return;
    if (editorRef.current) void editorBeenden(true, undefined, true);
    const z = zeile(p.r);
    if ((e.target as HTMLElement).closest('.tb-mk')) {
      if (e.button === 0 && z && !istNeu(z)) { if (e.shiftKey) gehe(p.r, aktRef.current.c, true); else gehe(p.r, aktRef.current.c, false, true); }
      e.preventDefault();
      return;
    }
    if (e.button === 2 && z && (gewaehltRef.current.size > 1 || bereichRef.current) && (gewaehltRef.current.has(idVon(z)) || imBereich(p.r, p.c))) { setAkt(p); aktRef.current = p; return; }
    gehe(p.r, p.c, e.shiftKey, e.ctrlKey || e.metaKey);
    if (e.button === 0 && !e.shiftKey && !e.ctrlKey && !e.metaKey) ziehtAuswahl.current = true;
    const s = sichtbarRef.current[p.c]?.s;
    if (e.button === 0 && !e.shiftKey && !e.ctrlKey && s?.art === 'Bool' && z && !istNeu(z) && (e.target as HTMLElement).closest('.tb-haken') && editierbar(s, z)) {
      void speichernWert(z, s, text(z, s) === 'X' ? '' : 'X');
    }
  };
  const ziehen = (e: RMouseEvent<HTMLDivElement>) => {
    if (!ziehtAuswahl.current || e.buttons !== 1 || editorRef.current) return;
    const p = zelleBei(e);
    if (!p || (p.r === aktRef.current.r && p.c === aktRef.current.c)) return;
    if (p.r >= ansichtRef.current.length) return;
    gehe(p.r, p.c, true);
  };
  const imBereich = (r: number, c: number) => { const b = bereichRef.current; return !!b && r >= b.r1 && r <= b.r2 && c >= b.c1 && c <= b.c2; };

  const doppelklick = (e: RMouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.tb-mk,.tb-editbox')) return;
    const p = zelleBei(e);
    if (!p) return;
    const z = zeile(p.r), s = sichtbarRef.current[p.c]?.s;
    if (propsRef.current.beiDoppelklick && z && !istNeu(z) && (!editierbar(s, z) || s?.art === 'Bool')) { propsRef.current.beiDoppelklick(z, s); return; }
    if (s?.art === 'Bool') return;
    bearbeiten();
  };

  // ---- Menüs ----
  const filterZeileSetzen = (an: boolean) => {
    setFilterZeile(an);
    if (!an) setFilter({});
    geaendert();
  };
  const filterSetzen = (k: string, f: string) => setFilter((x) => ({ ...x, [k]: f }));

  const standardMenue = (): MenueListe => {
    const sch = aenderbar();
    const nZeilen = ausgewaehlteVon(gewaehltRef.current, aktRef.current).length;
    return [
      { text: 'Kopieren', taste: 'Strg+C', aktion: kopierenAktion },
      sch ? { text: 'Einfügen', taste: 'Strg+V', aktion: einfuegenAktion } : undefined,
      sch ? { text: 'Inhalte löschen', aktion: inhalteLoeschen } : undefined,
      sch ? { text: nZeilen > 1 ? `Mehrfach ändern (${nZeilen} Zeilen) …` : 'Mehrfach ändern …', aktion: () => mehrfachAendern() } : undefined,
      sch ? { text: 'Nach unten ausfüllen', taste: 'Strg+D', aktion: ausfuellen, deaktiviert: nZeilen < 2 } : undefined,
      null,
      { text: 'Alles markieren', taste: 'Strg+A', aktion: allesMarkieren },
      gewaehltRef.current.size || bereichRef.current ? { text: 'Auswahl aufheben', taste: 'Esc', aktion: auswahlAufheben } : undefined,
      { text: 'Filterzeile', haken: filterZeile, taste: 'Strg+Umschalt+L', aktion: () => filterZeileSetzen(!filterZeile) },
      filterAktiv.length ? { text: 'Alle Filter entfernen', aktion: () => setFilter({}) } : undefined,
      { text: 'Spalten', menue: spaltenEintraege() },
    ];
  };

  const kontext = (e: RMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if ((e.target as HTMLElement).closest('.tb-editbox')) return;
    const p = zelleBei(e);
    const z = p ? zeile(p.r) : undefined;
    if (p && !(z && !istNeu(z) && (gewaehltRef.current.has(idVon(z)) || imBereich(p.r, p.c)))) gehe(p.r, p.c);
    const eigene = propsRef.current.kontextmenue?.(ausgewaehlteVon(gewaehltRef.current, aktRef.current), sichtbarRef.current[aktRef.current.c]?.s) || [];
    menue(e.clientX, e.clientY, [...eigene, null, ...standardMenue()]);
  };

  // ---- Spalten: Menü, Anpassen, Verschieben, Sortieren ----
  const spaltenAnpassen = (nur?: string) => {
    const n: ColumnSizingState = { ...breiten };
    for (const { s } of sichtbarRef.current) {
      if (nur && s.schluessel !== nur) continue;
      let max = textbreite(s.titel, '500 12px "IBM Plex Sans", sans-serif') + 26;
      for (let i = 0; i < Math.min(ansichtRef.current.length, 2000); i++) max = Math.max(max, textbreite(text(ansichtRef.current[i], s)) + 18);
      n[s.schluessel] = Math.min(420, Math.ceil(max));
    }
    setBreiten(n);
    geaendert();
  };

  const spaltenEintraege = (): MenueListe => {
    const karten = [...new Set(spalten.map((s) => s.karteikarte || ''))];
    const liste: MenueListe = [
      { text: 'Alle Spalten anpassen', aktion: () => spaltenAnpassen() },
      { text: 'Standardspalten', aktion: () => { setSichtbarkeit(Object.fromEntries(spalten.map((s) => [s.schluessel, s.standard !== false]))); geaendert(); } },
    ];
    if (sort) liste.push({ text: 'Sortierung aufheben', aktion: () => { setSort(null); geaendert(); } });
    liste.push({ text: 'Auswahlkästchen', haken: mitKaestchen, aktion: () => { setMitKaestchen(!mitKaestchen); geaendert(); } });
    liste.push({ text: 'Filterzeile', haken: filterZeile, aktion: () => filterZeileSetzen(!filterZeile) });
    liste.push({ text: 'Kompakte Zeilen', haken: kompakt, aktion: () => { setKompakt(!kompakt); geaendert(); } });
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
    return liste;
  };
  const spaltenMenue = (x: number, y: number) => menue(x, y, spaltenEintraege());

  /** Menü einer Spalte (Rechtsklick auf den Spaltenkopf) */
  const spaltenKopfMenue = (s: Spalte<Z>, x: number, y: number) => {
    const werte = [...new Set(zeilen.map((z) => text(z, s)))].sort(vergleich);
    const f = filter[s.schluessel] || '';
    const liste: MenueListe = [
      sortierbar ? { text: 'Aufsteigend sortieren', haken: sort?.schluessel === s.schluessel && !sort.ab, aktion: () => { setSort({ schluessel: s.schluessel, ab: false }); geaendert(); } } : undefined,
      sortierbar ? { text: 'Absteigend sortieren', haken: sort?.schluessel === s.schluessel && sort.ab, aktion: () => { setSort({ schluessel: s.schluessel, ab: true }); geaendert(); } } : undefined,
      sortierbar && sort ? { text: 'Sortierung aufheben', aktion: () => { setSort(null); geaendert(); } } : undefined,
      null,
      { text: 'Filtern …', aktion: () => { if (!filterZeile) filterZeileSetzen(true); setTimeout(() => (wurzel.current?.querySelector(`[data-filter="${s.schluessel}"]`) as HTMLInputElement | null)?.focus(), 50); } },
      {
        text: 'Nach Wert filtern', menue: [
          ...werte.slice(0, 40).map((w) => ({ text: w || '(leer)', haken: f === `=${w}`, aktion: () => { if (!filterZeile) { setFilterZeile(true); geaendert(); } filterSetzen(s.schluessel, `=${w}`); } })),
          ...(werte.length > 40 ? [{ text: `… ${werte.length - 40} weitere – Filterzeile nutzen`, deaktiviert: true }] : []),
        ],
      },
      f ? { text: 'Filter dieser Spalte entfernen', aktion: () => filterSetzen(s.schluessel, '') } : undefined,
      filterAktiv.length > 1 ? { text: 'Alle Filter entfernen', aktion: () => setFilter({}) } : undefined,
      null,
      { text: 'Spaltenbreite anpassen', aktion: () => spaltenAnpassen(s.schluessel) },
      { text: 'Spalte ausblenden', deaktiviert: sichtbar.length <= 1, aktion: () => { setSichtbarkeit((v) => ({ ...v, [s.schluessel]: false })); geaendert(); } },
      aenderbar() && s.art !== 'NurLesen' && s.editierbar !== false ? { text: 'Mehrfach ändern …', aktion: () => mehrfachAendern(s.schluessel) } : undefined,
      null,
      ...spaltenEintraege(),
    ];
    menue(x, y, liste);
  };

  const sortieren = (k: string) => {
    if (!sortierbar) return;
    setSort((s) => (s?.schluessel === k ? (s.ab ? null : { schluessel: k, ab: true }) : { schluessel: k, ab: false }));
    geaendert();
  };

  /** Spalte „von“ an die Stelle von „nach“ schieben (nach rechts: hinter, nach links: vor die Zielspalte) */
  const spalteVerschieben = (von: string, nach: string) => {
    if (!von || von === nach) return;
    setReihenfolge((alt) => {
      const basis = alt.length ? alt : spalten.map((x) => x.schluessel);
      const vi = basis.indexOf(von), ni = basis.indexOf(nach);
      if (vi < 0 || ni < 0) return basis;
      const l = basis.filter((x) => x !== von);
      l.splice(vi < ni ? l.indexOf(nach) + 1 : l.indexOf(nach), 0, von);
      return l;
    });
    geaendert();
  };
  // Ziehen am Rand ändert die Breite – darf kein Verschieben der Spalte (HTML-Ziehen des Kopfes) auslösen
  const breiteZieht = useRef(false);
  useEffect(() => {
    const los = () => { setTimeout(() => { breiteZieht.current = false; }, 0); };
    window.addEventListener('mouseup', los);
    window.addEventListener('touchend', los);
    return () => { window.removeEventListener('mouseup', los); window.removeEventListener('touchend', los); };
  }, []);
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
    spaltenAnpassen: () => spaltenAnpassen(),
    ansicht: () => ansichtRef.current,
    aktIndex: () => aktRef.current.r,
    editorOffen: () => !!editorRef.current,
    sichtbarSetzen: (werte) => setSichtbarkeit((v) => ({ ...v, ...werte })),
    sichtbare: () => sichtbarRef.current.map((x) => x.s.schluessel),
    markieren: (ids) => { const g = new Set(ids); setGewaehlt(g); gewaehltRef.current = g; setBereich(null); bereichRef.current = null; },
    mehrfachAendern: (spalte) => { void mehrfachAendern(spalte); },
    filterZeile: (an) => filterZeileSetzen(an ?? !filterZeile),
    auswahlAufheben,
  }));

  // ---- Fußleiste: Anzahl markiert, Summe, Sammelaktionen ----
  const bereichZellen = bereich ? (bereich.r2 - bereich.r1 + 1) * (bereich.c2 - bereich.c1 + 1) : 0;
  const summe = useMemo(() => {
    if (!bereich || bereichZellen < 2 || bereichZellen > 50000) return null;
    let n = 0, sum = 0;
    for (let r = bereich.r1; r <= bereich.r2; r++) for (let c = bereich.c1; c <= bereich.c2; c++) {
      const v = zahlWert(text(ansicht[r], sichtbar[c]?.s));
      if (v !== null) { n++; sum += v; }
    }
    return n > 1 ? { n, sum } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bereich, ansicht, sichtbar.length]);
  const markiertAnzahl = gewaehlt.size;
  const statusZeigen = props.statusleiste !== false && (markiertAnzahl > 1 || bereichZellen > 1 || filterAktiv.length > 0);

  // ---- Zeichnen ----
  const neuSpalte = Math.max(0, sichtbar.findIndex((x) => x.s.editierbar !== false && x.s.art !== 'NurLesen' && x.s.art !== 'Bool'));
  const items = virt.getVirtualItems();
  let edX = mkB;
  if (editor) for (let i = 0; i < editor.c; i++) edX += sichtbar[i]?.c.getSize() || 0;
  const edZeile = editor ? zeile(editor.r) : undefined;
  const edSpalte = editor ? sichtbar[editor.c]?.s : undefined;
  const edListe = edSpalte && (istListenart(edSpalte.art) && (edSpalte.art === 'Auswahl' ? !!edSpalte.auswahl?.length : !!props.optionen));
  const edFrei = edSpalte && !edListe && (!edSpalte.art || edSpalte.art === 'Text') && edSpalte.vorschlaege !== false;
  const alleMarkiert = ansicht.length > 0 && gewaehlt.size === ansicht.length;
  const b = bereich && bereichZellen > 1 ? bereich : null;

  return (
    <div ref={wurzel} className={`tb${props.className ? ` ${props.className}` : ''}`} tabIndex={0} role="grid" aria-rowcount={anzahl} aria-multiselectable data-tabelle={name}
      onKeyDown={taste} onCopy={kopieren} onPaste={einfuegen}>
      <div ref={rollen} className="tb-rollen">
        <div className="tb-kopfbereich" style={{ width: Math.max(gesamtbreite, 0) }}>
          <div className="tb-kopf" role="row" onContextMenu={(e) => { e.preventDefault(); if (!(e.target as HTMLElement).closest('.tb-kz')) spaltenMenue(e.clientX, e.clientY); }}>
            {mitKaestchen ? (
              <div className="tb-mk tb-mk-kopf" role="columnheader" title={alleMarkiert ? 'Auswahl aufheben' : 'Alle markieren'}
                onClick={() => (alleMarkiert ? auswahlAufheben() : allesMarkieren())}>
                <span className={`tb-haken${alleMarkiert ? ' an' : gewaehlt.size ? ' teil' : ''}`} />
              </div>
            ) : null}
            {tabelle.getFlatHeaders().filter((h) => h.column.getIsVisible()).map((h) => {
              const s = spaltenMap.get(h.column.id)!;
              const rechts = s.ausrichtung === 'rechts' || s.art === 'Ganzzahl' || s.art === 'Dezimal';
              const gefiltertSp = !!filter[s.schluessel]?.trim();
              return (
                <div key={h.id} role="columnheader" className={`tb-kz${rechts ? ' rechts' : ''}${ziehtUeber === s.schluessel ? ' zieht' : ''}`} style={{ width: h.getSize() }}
                  title={s.hinweis || s.titel} draggable data-spalte={s.schluessel}
                  aria-sort={sort?.schluessel === s.schluessel ? (sort.ab ? 'descending' : 'ascending') : undefined}
                  onClick={(e) => { if (!breiteZieht.current && !(e.target as HTMLElement).classList.contains('tb-breite')) sortieren(s.schluessel); }}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); spaltenKopfMenue(s, e.clientX, e.clientY); }}
                  onDragStart={(e) => { if (breiteZieht.current) { e.preventDefault(); return; } e.dataTransfer.setData('text/x-spalte', s.schluessel); e.dataTransfer.effectAllowed = 'move'; }}
                  onDragEnd={() => setZiehtUeber(null)}
                  onDragOver={(e) => { if (e.dataTransfer.types.includes('text/x-spalte')) { e.preventDefault(); setZiehtUeber(s.schluessel); } }}
                  onDragLeave={() => setZiehtUeber(null)}
                  onDrop={(e) => { e.preventDefault(); setZiehtUeber(null); spalteVerschieben(e.dataTransfer.getData('text/x-spalte'), s.schluessel); }}>
                  <span className="tb-titel">{s.titel}</span>
                  {gefiltertSp ? <span className="tb-filtersymbol" title={`Gefiltert: ${filter[s.schluessel]}`}><Filter12Filled /></span> : null}
                  {sort?.schluessel === s.schluessel ? <span className="tb-sort">{sort.ab ? <ArrowSortDown16Regular /> : <ArrowSortUp16Regular />}</span> : null}
                  <span className={`tb-breite${h.column.getIsResizing() ? ' aktiv' : ''}`} draggable={false}
                    onMouseDown={(e) => { e.stopPropagation(); breiteZieht.current = true; h.getResizeHandler()(e); }}
                    onTouchStart={(e) => { breiteZieht.current = true; h.getResizeHandler()(e); }}
                    onDoubleClick={(e) => { e.stopPropagation(); spaltenAnpassen(s.schluessel); }}
                    onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }} onClick={(e) => e.stopPropagation()} />
                </div>
              );
            })}
          </div>
          {filterZeile ? (
            <div className="tb-filterzeile" role="row">
              {mitKaestchen ? <div className="tb-mk" /> : null}
              {sichtbar.map(({ c, s }) => (
                <div key={c.id} className="tb-filterzelle" style={{ width: c.getSize() }}>
                  <input data-filter={s.schluessel} value={filter[s.schluessel] || ''} placeholder="Filter" spellCheck={false} autoComplete="off"
                    title={'Filter: Text enthält … · =Wert genau · !Text enthält nicht · >5 / <5 Zahlen · = leer · != nicht leer'}
                    aria-label={`Filter ${s.titel}`}
                    onChange={(e) => filterSetzen(s.schluessel, e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Escape') { if (filter[s.schluessel]) filterSetzen(s.schluessel, ''); else fokus(); }
                      if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); fokus(); }
                    }} />
                  {filter[s.schluessel] ? <button type="button" className="tb-filterweg" tabIndex={-1} aria-label="Filter entfernen" onClick={() => filterSetzen(s.schluessel, '')}><Dismiss12Regular /></button> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="tb-platz" style={{ height: virt.getTotalSize(), width: gesamtbreite }} onMouseDown={klick} onMouseMove={ziehen} onDoubleClick={doppelklick} onContextMenu={kontext}>
          {items.map((v) => {
            const r = v.index;
            const z = zeile(r)!;
            if (z === undefined) return null;
            const neu = istNeu(z);
            const id = neu ? NEU_ID : idVon(z);
            const kl = ['tb-zeile'];
            const markiert = !neu && gewaehlt.has(id);
            if (neu) kl.push('tb-neu');
            else {
              if (markiert) kl.push('gewaehlt');
              if (r % 2 === 1) kl.push('ungerade');
              if (filterAktiv.length && behalten.current.has(id) && !filterAktiv.every(([fk, fv]) => filterPasst(text(z, spaltenMap.get(fk)), fv))) kl.push('tb-ausserfilter');
              const k = props.zeilenKlasse?.(z, r);
              if (k) kl.push(k);
            }
            return (
              <div key={`${String(id)}-${r}`} className={kl.join(' ')} data-r={r} role="row" aria-selected={markiert || undefined}
                style={{ top: v.start, height: H, width: gesamtbreite }}>
                {mitKaestchen ? (
                  <div className="tb-mk" role="gridcell" title={neu ? undefined : 'Zeile markieren (Umschalt: Bereich)'}>
                    {neu ? null : <span className={`tb-haken${markiert ? ' an' : ''}`} role="checkbox" aria-checked={markiert} />}
                  </div>
                ) : null}
                {sichtbar.map(({ c, s }, ci) => {
                  const t = neu ? (ci === neuSpalte ? (props.neuText || 'Neu …') : '') : text(z, s);
                  const zk = ['tb-zelle'];
                  if (s.art === 'Bool' || s.art === 'Haken') zk.push('mitte');
                  else if (s.ausrichtung === 'rechts' || s.art === 'Ganzzahl' || s.art === 'Dezimal') zk.push('rechts');
                  else if (s.ausrichtung === 'mitte') zk.push('mitte');
                  if (!neu && (s.art === 'NurLesen' || s.art === 'Haken' || s.editierbar === false)) zk.push('nurlesen');
                  if (r === akt.r && ci === akt.c) zk.push('aktiv');
                  if (b && r >= b.r1 && r <= b.r2 && ci >= b.c1 && ci <= b.c2) zk.push('imbereich');
                  const f = neu ? undefined : fehler.get(`${String(id)}\u0001${s.schluessel}`);
                  if (f) zk.push('fehler');
                  const extra = !neu ? s.klasse?.(z) : null;
                  if (extra) zk.push(extra);
                  const farbe = !neu ? s.farbe?.(z) : null;
                  let inhalt: ReactElement;
                  if (!neu && s.art === 'Bool') inhalt = <span className={`tb-haken${t === 'X' || t === 'true' ? ' an' : ''}`} />;
                  else if (!neu && s.art === 'Haken') inhalt = t && t !== 'false' ? <Checkmark16Regular /> : <span />;
                  else if (!neu && s.art === 'Farbe' && t) inhalt = <><span className="tb-farbpunkt" style={{ background: t }} /><span className="t">{t}</span></>;
                  else inhalt = <span className="t">{t}</span>;
                  return (
                    <div key={c.id} className={zk.join(' ')} data-c={ci} role="gridcell" style={{ width: c.getSize(), background: farbe || undefined }}
                      title={f || (t.length > 12 ? t : undefined)} aria-invalid={f ? true : undefined}>{inhalt}</div>
                  );
                })}
              </div>
            );
          })}
          {editor && edZeile && edSpalte ? (
            <div className={`tb-editbox${editor.fehler ? ' fehler' : ''}`} onMouseDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}
              style={{ left: edX, top: editor.r * H, width: Math.max(sichtbar[editor.c]!.c.getSize(), edSpalte.art === 'ElementListe' ? 170 : edListe ? 110 : 60), height: H + 1 }}>
              <input ref={eingabe} key={editor.nr} className="tb-editor" spellCheck={false} autoComplete="off"
                defaultValue={editor.wert ?? editor.start ?? text(edZeile, edSpalte)}
                role={edListe || edFrei ? 'combobox' : undefined} aria-autocomplete={edListe || edFrei ? 'list' : undefined} aria-controls={edListe || edFrei ? `tb-vs-${editor.nr}` : undefined}
                aria-invalid={editor.fehler ? true : undefined} aria-label={edSpalte.titel}
                onKeyDown={editorTaste}
                onBlur={() => setTimeout(() => { if (editorRef.current?.nr === editor.nr && document.activeElement !== eingabe.current) void editorBeenden(true, undefined, true); }, 150)} />
              {edListe ? (
                <button type="button" className="tb-editor-knopf" tabIndex={-1} aria-label="Auswahlliste" title="Auswahlliste (Alt+↓)"
                  onMouseDown={(e) => { e.preventDefault(); vorschlag.current?.umschalten(); }}><ChevronDown12Regular /></button>
              ) : null}
              {editor.fehler ? <div className="tb-editor-fehler" role="alert">{editor.fehler} <span className="leise">Esc verwirft.</span></div> : null}
              {edListe ? (
                <Vorschlagsliste key={`v${editor.nr}`} ref={vorschlag} input={eingabe} id={`tb-vs-${editor.nr}`} liste={edSpalte.art === 'ElementListe'}
                  sofort={editor.start === undefined && editor.wert === undefined}
                  optionen={() => (edSpalte.art === 'Auswahl' ? auswahlOptionen(edSpalte.auswahl) : props.optionen!(edSpalte))} />
              ) : edFrei ? (
                <Vorschlagsliste key={`v${editor.nr}`} ref={vorschlag} input={eingabe} id={`tb-vs-${editor.nr}`} frei optionen={() => spaltenWerte(edSpalte)} />
              ) : null}
            </div>
          ) : null}
        </div>
        {ansicht.length === 0 && !props.neu ? <div className="tb-leer" style={{ top: kopfH + 24 }}>{filterAktiv.length ? 'Keine Zeile passt zum Filter.' : leerText}</div> : null}
      </div>
      {statusZeigen ? (
        <div className="tb-status" data-tabelle-status>
          {markiertAnzahl > 1 || bereichZellen > 1 ? (
            <span className="tb-status-anzahl">
              {markiertAnzahl > 1 ? `${markiertAnzahl} von ${ansicht.length} Zeilen markiert` : ''}
              {bereichZellen > 1 && bereich && bereich.c2 > bereich.c1 ? `${markiertAnzahl > 1 ? ' · ' : ''}${bereichZellen} Zellen` : ''}
            </span>
          ) : null}
          {summe ? <span title={`${summe.n} Zahlen`}>Summe {zahlText(summe.sum)} · Mittel {zahlText(summe.sum / summe.n)}</span> : null}
          {filterAktiv.length ? (
            <span>Filter: {ansicht.length} von {zeilen.length} Zeilen <Button size="small" appearance="transparent" onClick={() => setFilter({})}>Filter entfernen</Button></span>
          ) : null}
          <span className="tb-status-rest" />
          {markiertAnzahl > 1 || bereichZellen > 1 ? <>
            <Button size="small" appearance="subtle" onClick={() => void kopierenAktion()}>Kopieren</Button>
            {aenderbar() ? <Button size="small" appearance="subtle" onClick={() => void mehrfachAendern()}>Mehrfach ändern …</Button> : null}
            {props.beiEntf && markiertAnzahl > 1 ? <Button size="small" appearance="subtle" onClick={() => propsRef.current.beiEntf?.(ausgewaehlteVon(gewaehltRef.current, aktRef.current))}>Löschen …</Button> : null}
            <Button size="small" appearance="subtle" onClick={() => { auswahlAufheben(); fokus(); }}>Auswahl aufheben</Button>
          </> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Datentabelle; die Methoden (waehle, ausgewaehlte …) über eine ref (TabelleApi). */
export const Tabelle = forwardRef(TabelleInnen) as <Z>(p: TabelleProps<Z> & { ref?: Ref<TabelleApi<Z>> }) => ReactElement;
