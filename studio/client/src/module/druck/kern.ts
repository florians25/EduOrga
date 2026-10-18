// Gemeinsames des Druckmoduls: URLs der Druckausgaben (der Server erzeugt alle Dateien, Api/DruckApi.cs), Herunterladen,
// Öffnen im Browser-Tab, Datumshilfen.
import { api } from '@/api/client';
import { isoAus, plusTage } from '../vertretung/kern';

export const TYPEN: [string, string][] = [['klasse', 'Klassen'], ['lehrer', 'Lehrkräfte'], ['raum', 'Räume'], ['fach', 'Fächer']];
export const heute = () => isoAus(new Date());
export { plusTage };

/** URL einer Druckausgabe des geöffneten Dokuments. */
export function druckUrl(pfad: string, parameter: Record<string, unknown> = {}): string {
  const q = new URLSearchParams(Object.entries(parameter).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false).map(([k, v]) => [k, String(v)]));
  const s = q.toString();
  return api.dok(`/druck${pfad}${s ? `?${s}` : ''}`);
}

function ankerKlicken(href: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = '';
  a.style.display = 'none';
  document.body.append(a);
  a.click();
  a.remove();
}

/** Datei herunterladen (Server liefert sie als Anhang). */
export const herunterladen = (url: string) => ankerKlicken(`${url}${url.includes('?') ? '&' : '?'}herunterladen=true`);
/** Datei direkt laden (Server liefert bereits als Anhang). */
export const direktLaden = (url: string) => ankerKlicken(url);

/** In neuem Browser-Tab öffnen (PDF-Anzeige bzw. Druck des Browsers). */
export const imTab = (url: string) => { window.open(url, '_blank', 'noopener'); };

/** Heute bzw. der nächste Wochentag (Mo–Fr). */
export function naechsterWochentag(): string {
  let t = heute();
  for (let i = 0; i < 3; i++) { const wd = new Date(`${t}T12:00:00`).getDay(); if (wd !== 0 && wd !== 6) break; t = plusTage(t, 1); }
  return t;
}

export interface Element { id: number; k: string; l?: string }
export interface Auswahl {
  klasse: Element[]; lehrer: Element[]; raum: Element[]; fach: Element[];
  formate: { typ: string; name: string; gross: boolean }[];
  berichte: { id: string; gruppe: string; titel: string; hinweis: string; zeitraum?: boolean }[];
  schuljahrVon: string; schuljahrBis: string;
}
