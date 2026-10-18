// Zustand der Oberfläche: Benutzer, geöffnetes Dokument, Grunddaten, Modus, Thema. Lesbar in React (useStudio) und
// außerhalb (zustand()). Dazu die zwischengespeicherten Auswahllisten der Elemente.
import { create } from 'zustand';
import { api } from '@/api/client';
import { an, melden } from './ereignisse';
import type { Benutzer, DokumentStand, ElementOption, Grunddaten, SystemInfo } from '@/api/typen';

export type Modus = 'stundenplan' | 'vertretung';
export type Thema = 'hell' | 'dunkel' | 'auto';

export interface StudioZustand {
  system: SystemInfo | null;
  benutzer: Benutzer | null;
  dokument: DokumentStand | null;
  grunddaten: Grunddaten | null;
  version: number;
  modus: Modus;
  verbunden: boolean;
  navEingeklappt: boolean;
  thema: Thema;
}

function gespeicherterModus(): Modus {
  try { return localStorage.getItem('studio.modus') === 'vertretung' ? 'vertretung' : 'stundenplan'; } catch { return 'stundenplan'; }
}
function gespeichertesThema(): Thema {
  try { const t = localStorage.getItem('studio.thema'); return t === 'dunkel' || t === 'auto' ? t : 'hell'; } catch { return 'hell'; }
}

export const useStudio = create<StudioZustand>(() => ({
  system: null,
  benutzer: null,
  dokument: null,
  grunddaten: null,
  version: 0,
  modus: gespeicherterModus(),
  verbunden: false,
  navEingeklappt: false,
  thema: gespeichertesThema(),
}));

export const zustand = () => useStudio.getState();
export const setzen = (teil: Partial<StudioZustand>) => useStudio.setState(teil);

export const darfSchreiben = () => !!useStudio.getState().benutzer?.darfSchreiben;
export const istAdmin = () => useStudio.getState().benutzer?.rolle === 'Admin';

/** Hook: darf der Benutzer schreiben? */
export const useDarfSchreiben = () => useStudio((s) => !!s.benutzer?.darfSchreiben);

export function modusSetzen(modus: Modus) {
  if (useStudio.getState().modus === modus) return;
  setzen({ modus });
  try { localStorage.setItem('studio.modus', modus); } catch { /* privat */ }
  melden('meldung', { text: modus === 'vertretung' ? 'Vertretungsplanung' : 'Stundenplanung', art: 'info' });
}

export function themaSetzen(thema: Thema) {
  setzen({ thema });
  try { localStorage.setItem('studio.thema', thema); } catch { /* privat */ }
}

// ---- Auswahllisten (Kurz-/Langname) je Elementtyp, zwischengespeichert bis zur nächsten Stammdatenänderung ----
let elementCache: Promise<Record<string, ElementOption[]>> | null = null;

/** Elemente eines Typs als [{ id, k, l }] (typ: 'klasse', 'lehrer', 'raum', 'fach', 'raumgruppe', …). */
export async function elemente(typ: string): Promise<ElementOption[]> {
  if (!useStudio.getState().dokument) return [];
  if (!elementCache) {
    elementCache = api.get<Record<string, ElementOption[]>>(api.dok('/elemente')).catch((e) => { elementCache = null; throw e; });
  }
  const alle = await elementCache;
  return alle[typ] || [];
}

export function elementeVerwerfen() { elementCache = null; }

an('daten', (e) => { if (e.bereich === 'Stammdaten' || e.bereich === 'Alles') elementeVerwerfen(); });
