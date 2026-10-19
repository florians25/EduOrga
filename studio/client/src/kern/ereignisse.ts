// Ereignisbus der Oberfläche (zwischen Shell, Ansichten und Modulen) – typisiert.
//
//   version    – neuer Änderungsstand aus einer API-Antwort (intern, siehe dokument.ts)
//   daten      – Daten geändert: { version, bereich, quelle, benutzer } (quelle = Id der auslösenden Ansicht)
//   element    – Element in einer Ansicht gewählt { typ, id, quelle } (Verknüpfung von Ansichten, „Auswahl folgen“)
//   meldung    – Text für die Statusanzeige { text, art }
//   abgemeldet – Sitzung abgelaufen
import { useEffect, useRef } from 'react';
import type { Bereich, Grunddaten } from '@/api/typen';

export type MeldungArt = 'info' | 'ok' | 'warnung' | 'fehler';

export interface DatenEreignis { version: number; bereich: Bereich; quelle: string | null; benutzer?: string }

/** Auswahl der aktiven Vertretung (Verknüpfung Vertretungsliste, Vorschlag, Abwesenheiten, Tagespläne). */
export interface VertretungsAuswahl {
  id: number;
  ids: number[];
  zeile: Record<string, any>;
  quelle: string;
  text?: string;
}

export interface Ereignisse {
  version: { version: number; bereich: Bereich; quelle: string | null; benutzer?: string };
  daten: DatenEreignis;
  element: { typ: string; id: number; quelle?: string };
  unterricht: { id: number; quelle?: string };
  meldung: { text: string; art?: MeldungArt; angezeigt?: boolean };
  abgemeldet: undefined;
  verbindung: boolean;
  grunddaten: Grunddaten;
  'vertretung.datum': string;
  'vertretung.auswahl': VertretungsAuswahl | null;
  'vertretung.naechsteOffene': undefined;
  'vertretung.ansicht': string;
  /** Stand der (schlanken) Vertretungsliste der Tagesplanung: Zeitraum, offene Vertretungen, Entfälle, Zeilen. */
  'vertretung.liste': { von: string; bis: string; offen: number; entfall: number; zeilen: number };
  /** Ansicht im Arbeitsplatz aktiviert (Id). */
  'ansicht.aktiv': string;
  /** Direkte Übertragung der Vertretungen an EduOrga Web beendet (Server-Ereignis „untplanweb“). */
  'untplanweb.direkt': { text: string; benutzer: string; zeit: string };
}

type Hoerer<K extends keyof Ereignisse> = (daten: Ereignisse[K]) => void;

const hoerer = new Map<keyof Ereignisse, Set<(d: any) => void>>();

/** Meldet sich für ein Ereignis an; liefert eine Funktion zum Abmelden. */
export function an<K extends keyof Ereignisse>(name: K, f: Hoerer<K>): () => void {
  if (!hoerer.has(name)) hoerer.set(name, new Set());
  hoerer.get(name)!.add(f);
  return () => { hoerer.get(name)?.delete(f); };
}

export function melden<K extends keyof Ereignisse>(name: K, daten: Ereignisse[K]): void {
  for (const f of [...(hoerer.get(name) || [])]) {
    try { f(daten); } catch (e) { console.error(`Fehler im Ereignis ${String(name)}`, e); }
  }
}

/** Betrifft eine Datenänderung die genannten Bereiche? („Alles“ betrifft immer alles.) */
export function betrifft(ereignis: { bereich?: Bereich } | null | undefined, ...bereiche: Bereich[]): boolean {
  return !ereignis?.bereich || ereignis.bereich === 'Alles' || bereiche.includes(ereignis.bereich);
}

/** React-Hook: Ereignis abonnieren, solange die Komponente besteht (immer mit der aktuellen Funktion). */
export function useEreignis<K extends keyof Ereignisse>(name: K, f: Hoerer<K>): void {
  const ref = useRef(f);
  ref.current = f;
  useEffect(() => an(name, (d) => ref.current(d)), [name]);
}
