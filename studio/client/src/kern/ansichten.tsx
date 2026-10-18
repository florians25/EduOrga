// Ansichten: Inhalte, die als Seite (eigene Adresse), als Nebenbereich rechts (Aufruf aus einer Ansicht heraus) oder als
// Bereich eines Arbeitsplatzes erscheinen. Jede Ansicht bekommt ihren Kontext über useAnsicht():
//   id (Quelle für eigene Änderungen), p (Parameter), parameterSetzen, oeffnen (verwandte Ansicht daneben), lage.
import { createContext, useContext, type ComponentType, type LazyExoticComponent } from 'react';
import type { Params } from './befehle';
import type { Modus } from './zustand';

export interface AnsichtProps { p: Params }

export interface AnsichtDef {
  /** Standardtitel (die Ansicht setzt den genauen Titel selbst). */
  titel: string;
  /** Adresse der Seite (ohne führenden Schrägstrich), z. B. 'stammdaten' oder 'vertretung/liste'. */
  pfad: string;
  komponente: LazyExoticComponent<ComponentType<AnsichtProps>> | ComponentType<AnsichtProps>;
  /** Ansicht gehört zu diesem Modus (beim Öffnen wird umgeschaltet). */
  modus?: Modus;
  /** braucht ein geöffnetes Dokument (Standard: ja) */
  ohneDokument?: boolean;
  /** Parameter, die die Ansicht ausmachen (anderer Wert = neue Ansicht, z. B. Stammdaten-Typ); übrige Parameter
   *  (gewähltes Element …) ändern die bestehende Ansicht. */
  schluessel?: (p: Params) => string;
}

const ansichten = new Map<string, AnsichtDef>();

export function ansichtRegistrieren(typ: string, def: AnsichtDef) { ansichten.set(typ, def); }
export const ansichtDef = (typ: string) => ansichten.get(typ);
export function ansichtNachPfad(pfad: string): [string, AnsichtDef] | undefined {
  const p = pfad.replace(/^\/+|\/+$/g, '');
  for (const [typ, d] of ansichten) if (d.pfad === p) return [typ, d];
  return undefined;
}
export const alleAnsichten = () => [...ansichten.entries()];

export type Lage = 'seite' | 'neben' | 'bereich';

export interface AnsichtKontextWert {
  id: string;
  typ: string;
  lage: Lage;
  p: Params;
  /** Parameter ändern (fließen in die Adresse bzw. den Arbeitsplatz). */
  parameterSetzen: (p: Params) => void;
  /** Verwandte Ansicht öffnen: Nebenbereich der Seite bzw. passender Bereich des Arbeitsplatzes. */
  oeffnen: (typ: string, p?: Params) => void;
  /** Nebenbereich/Bereich schließen (nur dort vorhanden). */
  schliessen?: () => void;
  /** Ansicht als eigene Seite öffnen (im Nebenbereich und im Arbeitsplatz). */
  alsSeite?: () => void;
}

export const AnsichtKontext = createContext<AnsichtKontextWert | null>(null);

export function useAnsicht(): AnsichtKontextWert {
  const k = useContext(AnsichtKontext);
  if (!k) throw new Error('useAnsicht außerhalb einer Ansicht');
  return k;
}

// ---- Adressen: Parameter als Suchparameter (Zahlen und Wahrheitswerte werden zurückverwandelt) ----

export function wertLesen(v: string): string | number | boolean {
  if (/^-?\d+$/.test(v) && v.length < 15) return Number(v);
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}

export function paramsAusSuche(suche: URLSearchParams, praefix = ''): Params {
  const p: Params = {};
  for (const [k, v] of suche) {
    if (praefix ? !k.startsWith(praefix) : k === 'n' || k.startsWith('n.')) continue;
    p[praefix ? k.slice(praefix.length) : k] = wertLesen(v);
  }
  return p;
}

export function sucheAusParams(p: Params | undefined, praefix = '', suche = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(p || {})) if (v !== undefined && v !== null && v !== '') suche.set(praefix + k, String(v));
  return suche;
}

export function adresseVon(typ: string, p?: Params): string {
  const d = ansichten.get(typ);
  if (!d) return '/';
  const q = sucheAusParams(p).toString();
  return `/${d.pfad}${q ? `?${q}` : ''}`;
}
