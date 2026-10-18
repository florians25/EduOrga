// Schnittstelle zu UntPlanWeb (/api/app/*): Sitzungscookie, CSRF-Kopf „X-UntPlanWeb: 1“ für ändernde Aufrufe, Fehler als ApiFehler.

export class ApiFehler extends Error {
  constructor(public status: number, meldung: string) {
    super(meldung);
  }
}

export interface ApiOptionen {
  methode?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  daten?: unknown;
  formular?: FormData;
  signal?: AbortSignal;
}

/** Ereignis bei abgelaufener Sitzung (401) – die App zeigt dann die Anmeldung. */
export const ABGEMELDET = 'untplan:abgemeldet';

export async function api<T = unknown>(pfad: string, { methode = 'GET', daten, formular, signal }: ApiOptionen = {}): Promise<T> {
  const headers: Record<string, string> = { 'X-UntPlanWeb': '1' };
  const init: RequestInit = { method: methode, headers, credentials: 'same-origin', signal };
  if (formular) init.body = formular;
  else if (daten !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(daten);
  }
  let antwort: Response;
  try {
    antwort = await fetch(pfad, init);
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiFehler(0, 'Keine Verbindung zum Server.');
  }
  const text = await antwort.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!antwort.ok) {
    if (antwort.status === 401 && !pfad.endsWith('/anmelden')) window.dispatchEvent(new CustomEvent(ABGEMELDET));
    const fehler = (json as { fehler?: string } | null)?.fehler;
    throw new ApiFehler(antwort.status, fehler ?? `Fehler ${antwort.status}`);
  }
  return json as T;
}

export const holen = <T = unknown>(pfad: string, signal?: AbortSignal) => api<T>(pfad, { signal });
export const senden = <T = unknown>(pfad: string, daten: unknown, methode: 'POST' | 'PUT' | 'DELETE' = 'POST') => api<T>(pfad, { methode, daten });
export const loeschen = <T = unknown>(pfad: string) => api<T>(pfad, { methode: 'DELETE' });

/** Abfrage-Zeichenkette aus einem Objekt (leere Werte entfallen). */
export function qs(werte: Record<string, string | number | boolean | null | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(werte)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Datei herunterladen (z. B. CSV/PDF eines Berichts) über einen GET-Aufruf mit Sitzungscookie. */
export async function dateiLaden(pfad: string, name?: string) {
  const r = await fetch(pfad, { credentials: 'same-origin', headers: { 'X-UntPlanWeb': '1' } });
  if (!r.ok) {
    let meldung = `Fehler ${r.status}`;
    try { meldung = (await r.json()).fehler ?? meldung; } catch { /* kein JSON */ }
    throw new ApiFehler(r.status, meldung);
  }
  const blob = await r.blob();
  const dispo = r.headers.get('Content-Disposition') ?? '';
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(dispo);
  speichern(blob, name ?? (m ? decodeURIComponent(m[1]) : 'download'));
}

/** Blob bzw. Text als Datei im Browser speichern (Text als CSV mit BOM für Excel). */
export function speichern(inhalt: Blob | string, name: string, typ = 'text/csv;charset=utf-8') {
  const blob = inhalt instanceof Blob ? inhalt : new Blob(['﻿' + inhalt], { type: typ });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
