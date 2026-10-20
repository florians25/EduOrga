// Darstellung der Stundenkarten (Administration | Darstellung der Stundenkarten): schulweite Einstellung aus der Sitzung, als Kontext für
// Kachel, Legende, Startseite, Übersicht und Stundendetails. Standard ist „EduOrga Standard“ (design/DESIGN.md, Abschnitt 10, Stundenkarte v6):
// kompakte helle Karten auf hellgrauem Raster, 5-px-Leiste links (grau, mit Fachfarbe in der Fachfarbe samt leichter Tönung), Kontur 1,5 px,
// Radius 4 px, je eine Zeile Fach (600)
// · Klasse · Lehrkraft · Raum; Änderungen grün, Entfall rot (aenderung.ts). Die Statusdarstellung (schraffierte Kante, Felder „+neu
// (bisher)“, Durchstreichung, Statusfeld) bleibt in jeder Variante erhalten.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Box } from '@mui/material';
import type { Elemente } from '../../api/types';
import { gueltigeFarbe } from './logik';

export type Fachfarbe = 'balken-innen' | 'quadrat' | 'balken-links' | 'balken-flaeche' | 'balken-oben' | 'flaeche' | 'keine';
export type KartenFlaeche = 'neutral' | 'weiss' | 'getoent';
export type Rahmen = 'fein' | 'kraeftig' | 'schatten' | 'keiner';
/** Zeilenfolge: Fach · Klasse · Lehrkraft · Raum je eine Zeile (Standard), Fach oben (Raum rechts) oder Lehrkraft/Klasse zuerst. */
export type Reihenfolge = 'zeilen' | 'fach' | 'element';
export type Raster = 'weiss' | 'grau';
export type Dichte = 'kompakt' | 'normal' | 'grosszuegig';
export type TextArt = 'kuerzel' | 'name';
export type KuerzelStil = 'gefuellt' | 'umrandet' | 'text';

export interface Kartendarstellung {
  fachfarbe: Fachfarbe;
  /** Breite des Fachfarbbalkens (2–6 px). */
  balkenbreite: number;
  /** Deckkraft der Fachfarb-Tönung in Prozent (6–30). */
  deckkraft: number;
  flaeche: KartenFlaeche;
  rahmen: Rahmen;
  /** Eckenradius (0–8 px). */
  eckenradius: number;
  dichte: Dichte;
  /** Zeile 1: Fach als Kürzel oder ausgeschrieben. */
  fach: TextArt;
  /** Raum rechts in Zeile 1 (geänderte Räume stehen immer da). */
  raum: boolean;
  /** Zeile 2: Lehrkraft bzw. Klasse (Änderungen stehen immer da). */
  zeile2: boolean;
  zeile2Text: TextArt;
  /** Unveränderte Kürzel (Raum): gefüllte oder umrandete Plakette oder Text. */
  kuerzel: KuerzelStil;
  /** Statuswörter (Entfall, Offen, Vertreten …) zusätzlich auf den Kacheln. */
  statuswoerter: boolean;
  /** Geänderte Stunden und Prüfungen zusätzlich in der hellen Statusfläche (Änderung grün, Prüfung bernstein). */
  statusflaeche: boolean;
  /** Zeilenfolge der Karte. */
  reihenfolge: Reihenfolge;
  /** Fläche des Stundenrasters hinter den Karten (weiß oder hellgrau). */
  raster: Raster;
}

/** „EduOrga Standard“ (alle Plattformen gleich, Stundenkarte v6): helle Karte, 5-px-Leiste links grau bzw. in der Fachfarbe mit leichter Tönung,
 * Kontur 1,5 px („fein“), Radius 4 px, Fach · Klasse · Lehrkraft · Raum. */
export const STANDARD: Kartendarstellung = {
  fachfarbe: 'balken-flaeche', balkenbreite: 5, deckkraft: 12, flaeche: 'weiss', rahmen: 'fein', eckenradius: 4, dichte: 'kompakt',
  fach: 'kuerzel', raum: true, zeile2: true, zeile2Text: 'kuerzel', kuerzel: 'text', statuswoerter: false, statusflaeche: true,
  reihenfolge: 'zeilen', raster: 'grau',
};

/** Bisheriger Standard „Klassisch“ (Streifen innen links, Lehrkraft bzw. Klasse oben) – als Vorlage weiter wählbar. */
const KLASSISCH: Kartendarstellung = { ...STANDARD, fachfarbe: 'balken-innen', balkenbreite: 4, rahmen: 'schatten', eckenradius: 2, reihenfolge: 'element' };

/** Bisherige Grunddarstellung „Sachlich“ (Fachfarbe als Quadrat, neutrale Fläche) – als Vorlage weiter wählbar. */
const SACHLICH: Kartendarstellung = {
  fachfarbe: 'quadrat', balkenbreite: 3, deckkraft: 12, flaeche: 'neutral', rahmen: 'fein', eckenradius: 3, dichte: 'normal',
  fach: 'kuerzel', raum: true, zeile2: true, zeile2Text: 'kuerzel', kuerzel: 'umrandet', statuswoerter: false, statusflaeche: false,
  reihenfolge: 'fach', raster: 'weiss',
};

export const VORLAGEN: { id: string; name: string; hinweis: string; werte: Kartendarstellung }[] = [
  { id: 'standard', name: 'EduOrga Standard', hinweis: 'Helle Karten auf hellgrauem Raster, kräftige Leiste links (5 px) grau bzw. in der Fachfarbe mit leichter Tönung, Kontur 1,5 px, Radius 4 px, je eine Zeile: Fach · Klasse · Lehrkraft · Raum', werte: STANDARD },
  { id: 'klassisch', name: 'Klassisch', hinweis: 'Weiße Karten auf hellgrauem Raster, Fachfarbe als schmaler Streifen innen links, drei kurze Zeilen: Lehrkraft bzw. Klasse · Fach · Raum', werte: KLASSISCH },
  { id: 'kompakt', name: 'Kompakt', hinweis: 'Kompakte Karten mit Fachfarbe als Balken links und leichter Tönung, Fach fett, Raum rechts', werte: { ...KLASSISCH, fachfarbe: 'balken-flaeche', rahmen: 'fein', reihenfolge: 'fach', raster: 'weiss' } },
  { id: 'sachlich', name: 'Sachlich', hinweis: 'Neutrale Fläche, Fachfarbe als kleines Quadrat', werte: SACHLICH },
  { id: 'akzent', name: 'Akzentbalken', hinweis: 'Weiße Karte mit Fachfarbe als Balken am linken Rand', werte: { ...SACHLICH, fachfarbe: 'balken-links', balkenbreite: 4, flaeche: 'weiss', eckenradius: 4, kuerzel: 'text' } },
  { id: 'flaeche', name: 'Farbfläche', hinweis: 'Leicht getönte Fläche in der Fachfarbe', werte: { ...SACHLICH, fachfarbe: 'flaeche', deckkraft: 14, flaeche: 'weiss', eckenradius: 4, kuerzel: 'gefuellt' } },
  { id: 'minimal', name: 'Minimal', hinweis: 'Ohne Fachfarbe, weiße Fläche, kompakt', werte: { ...SACHLICH, fachfarbe: 'keine', flaeche: 'weiss', eckenradius: 2, dichte: 'kompakt', kuerzel: 'text' } },
];

/** Fachfarbe als Balken (links bzw. oben, auch zusammen mit der Tönung)? */
export const mitBalken = (f: Fachfarbe) => f === 'balken-links' || f === 'balken-oben' || f === 'balken-flaeche' || f === 'balken-innen';
/** Fachfarbe als Tönung der Fläche? */
export const mitToenung = (f: Fachfarbe) => f === 'flaeche' || f === 'balken-flaeche';

const gleich = (a: Kartendarstellung, b: Kartendarstellung) => (Object.keys(STANDARD) as (keyof Kartendarstellung)[]).every(k => a[k] === b[k]);
/** Vorlage, der die Werte genau entsprechen (sonst null = „Eigene“). */
export const vorlageVon = (d: Kartendarstellung) => VORLAGEN.find(v => gleich(v.werte, d))?.id ?? null;
export const istStandard = (d: Kartendarstellung) => gleich(d, STANDARD);

/** Werte aus der Sitzung bzw. vom Server mit Standardwerten ergänzt (ältere Server liefern nichts). */
export const mitStandard = (d: Partial<Kartendarstellung> | null | undefined): Kartendarstellung => ({ ...STANDARD, ...(d ?? {}) });

/** Abstände und Schriftgrößen je Dichte; luecke = Abstand der Karte zum Rand der Rasterzelle (kompakt: Karten füllen die Zelle). */
export const DICHTE: Record<Dichte, { px: number; py: number; fach: number; zeile: number; zeilenhoehe: number; kopf: number; luecke: number }> = {
  kompakt: { px: 6, py: 3, fach: 13, zeile: 12, zeilenhoehe: 16, kopf: 17, luecke: 1 },
  normal: { px: 8, py: 5, fach: 13, zeile: 12, zeilenhoehe: 18, kopf: 17, luecke: 3 },
  grosszuegig: { px: 10, py: 7, fach: 14, zeile: 13, zeilenhoehe: 19, kopf: 19, luecke: 4 },
};

/** Langnamen der Elemente (für „Name“ statt Kürzel). */
export interface Namen { lehrer: Map<string, string>; klassen: Map<string, string>; raeume: Map<string, string> }

export function namenAus(e: Pick<Elemente, 'lehrer' | 'klassen' | 'raeume'>): Namen {
  const m = (l: { kurz: string; name: string }[]) => new Map(l.filter(x => x.name && x.name !== x.kurz).map(x => [x.kurz.toLowerCase(), x.name]));
  return { lehrer: m(e.lehrer), klassen: m(e.klassen), raeume: m(e.raeume) };
}

interface Wert { d: Kartendarstellung; namen: Namen | null }
const Kontext = createContext<Wert>({ d: STANDARD, namen: null });

export const useDarstellung = () => useContext(Kontext);

/** Stellt die Darstellung bereit; Namen werden nur geladen, wenn Zeile 2 Namen zeigen soll. */
export function DarstellungsAnbieter({ wert, namen, namenLaden, children }: {
  wert: Partial<Kartendarstellung> | null | undefined; namen?: Namen | null; namenLaden?: () => Promise<Namen>; children: ReactNode;
}) {
  const d = useMemo(() => mitStandard(wert), [wert]);
  const [geladen, setGeladen] = useState<Namen | null>(null);
  const brauchtNamen = d.zeile2 && d.zeile2Text === 'name' && !namen;
  useEffect(() => {
    if (!brauchtNamen || geladen || !namenLaden) return;
    let aktiv = true;
    namenLaden().then(n => { if (aktiv) setGeladen(n); }, () => { /* ohne Namen: Kürzel */ });
    return () => { aktiv = false; };
  }, [brauchtNamen, geladen, namenLaden]);
  const v = useMemo(() => ({ d, namen: namen ?? geladen }), [d, namen, geladen]);
  return <Kontext.Provider value={v}>{children}</Kontext.Provider>;
}

/** Name eines Werts (Lehrkraft bzw. Klasse) oder das Kürzel. */
export function nameVon(namen: Namen | null, art: 'lehrer' | 'klassen' | 'raeume', kurz: string) {
  return (kurz && namen?.[art].get(kurz.toLowerCase())) || kurz;
}

/** Breite der Fachmarke samt Abstand (Einzug der Zeilen darunter). */
export function fachMarkeEinzug(d: Kartendarstellung, groesse: number, abstand: number) {
  if (d.fachfarbe === 'keine') return 0;
  return (mitBalken(d.fachfarbe) ? Math.max(3, d.balkenbreite) : groesse) + abstand;
}

/**
 * Fachfarbe in Listen und Kopfzeilen (Startseite, Übersicht, Stundendetails) passend zur Kartendarstellung: Quadrat (auch bei Farbfläche),
 * schmaler senkrechter Balken bei Balken-Varianten, nichts bei „keine“. Rein dekorativ (aria-hidden) – das Fach steht als Text daneben.
 */
export function FachMarke({ farbe, groesse = 8, sx }: { farbe: string | null | undefined; groesse?: number; sx?: object }) {
  const { d } = useDarstellung();
  const f = gueltigeFarbe(farbe) ?? (farbe && /^(rgba?|hsla?|color)\(/.test(farbe) ? farbe : null);
  if (d.fachfarbe === 'keine') return null;
  if (mitBalken(d.fachfarbe))
    return <Box component="span" aria-hidden data-fachmarke="balken" sx={{ display: 'inline-block', width: Math.max(3, d.balkenbreite), height: Math.round(groesse * 2), borderRadius: '1px', flex: 'none', alignSelf: 'center',
      bgcolor: f ?? 'kachel.balken', ...sx }} />;
  return <Box component="span" aria-hidden data-fachmarke="quadrat" sx={{ display: 'inline-block', width: groesse, height: groesse, borderRadius: '1px', flex: 'none', bgcolor: f ?? 'transparent',
    border: f ? 0 : 1, borderColor: 'text.disabled', boxShadow: f ? 'inset 0 0 0 1px rgba(0,0,0,.08)' : 'none', ...sx }} />;
}
