// Zugriff auf die REST-API des Studios (/api/...). Fehler kommen als ApiFehler mit der Meldung des Servers.
// Jede ändernde Anfrage trägt die Kopfzeile X-UntPlan-Studio (Schutz gegen Cross-Site-Anfragen). Antworten der
// Dokument-Endpunkte tragen den Änderungsstand (X-Dokument-Version/-Bereich) – er wird als Ereignis „version“ gemeldet.
import { melden } from '@/kern/ereignisse';
import type { Bereich } from './typen';

export class ApiFehler extends Error {
  status: number;
  constructor(status: number, meldung: string) {
    super(meldung);
    this.status = status;
  }
}

export interface AnfrageOptionen {
  /** Id der auslösenden Ansicht – sie kann ihr eigenes „daten“-Ereignis überspringen. */
  quelle?: string | null;
}

let dokumentId: string | null = null;
/** Vom Dokumentdienst gesetzt: Id des geöffneten Dokuments (für api.dok). */
export function dokumentIdSetzen(id: string | null) { dokumentId = id; }

async function fehlertext(antwort: Response): Promise<string> {
  try { return ((await antwort.json()) as { fehler?: string }).fehler || `Fehler ${antwort.status}`; } catch { return `Fehler ${antwort.status}`; }
}

async function senden(methode: string, pfad: string, body: unknown, optionen: AnfrageOptionen = {}): Promise<Response> {
  const kopf: Record<string, string> = { 'X-UntPlan-Studio': '1', Accept: 'application/json' };
  let inhalt: BodyInit | undefined;
  if (body instanceof FormData) inhalt = body;
  else if (body !== undefined) {
    kopf['Content-Type'] = 'application/json';
    inhalt = JSON.stringify(body);
  }
  let antwort: Response;
  try {
    antwort = await fetch(pfad, { method: methode, headers: kopf, body: inhalt, credentials: 'same-origin' });
  } catch {
    throw new ApiFehler(0, 'Keine Verbindung zum Server.');
  }
  const version = antwort.headers.get('X-Dokument-Version');
  if (version !== null) {
    melden('version', { version: Number(version), bereich: (antwort.headers.get('X-Dokument-Bereich') || 'Alles') as Bereich, quelle: optionen.quelle ?? null });
  }
  if (antwort.status === 401 && !pfad.endsWith('/anmeldung')) {
    melden('abgemeldet', undefined);
    throw new ApiFehler(401, 'Bitte erneut anmelden.');
  }
  return antwort;
}

async function anfrage<T>(methode: string, pfad: string, body?: unknown, optionen?: AnfrageOptionen): Promise<T> {
  const antwort = await senden(methode, pfad, body, optionen);
  const text = await antwort.text();
  let daten: unknown = null;
  if (text) {
    try { daten = JSON.parse(text); } catch { daten = text; }
  }
  if (!antwort.ok) throw new ApiFehler(antwort.status, (daten as { fehler?: string } | null)?.fehler || `Fehler ${antwort.status}`);
  return daten as T;
}

export const api = {
  get: <T = unknown>(pfad: string, o?: AnfrageOptionen) => anfrage<T>('GET', pfad, undefined, o),
  post: <T = unknown>(pfad: string, body?: unknown, o?: AnfrageOptionen) => anfrage<T>('POST', pfad, body ?? {}, o),
  put: <T = unknown>(pfad: string, body?: unknown, o?: AnfrageOptionen) => anfrage<T>('PUT', pfad, body, o),
  patch: <T = unknown>(pfad: string, body?: unknown, o?: AnfrageOptionen) => anfrage<T>('PATCH', pfad, body, o),
  loeschen: <T = unknown>(pfad: string, o?: AnfrageOptionen) => anfrage<T>('DELETE', pfad, undefined, o),

  /** Rohantwort (z. B. für Dateien); Fehler als ApiFehler. */
  async roh(pfad: string): Promise<Response> {
    const antwort = await senden('GET', pfad, undefined);
    if (!antwort.ok) throw new ApiFehler(antwort.status, await fehlertext(antwort));
    return antwort;
  },

  /** Datei hochladen (multipart, Feld „datei“) mit weiteren Formularfeldern. */
  hochladen<T = unknown>(pfad: string, datei: File, felder: Record<string, unknown> = {}, o?: AnfrageOptionen) {
    const fd = new FormData();
    fd.append('datei', datei, datei.name);
    for (const [k, v] of Object.entries(felder)) fd.append(k, String(v));
    return anfrage<T>('POST', pfad, fd, o);
  },

  /** Mehrere Dateien hochladen (Feld „dateien“ bzw. eigener Name). */
  hochladenMehrere<T = unknown>(pfad: string, dateien: File[], feld = 'dateien', o?: AnfrageOptionen) {
    const fd = new FormData();
    for (const d of dateien) fd.append(feld, d, d.name);
    return anfrage<T>('POST', pfad, fd, o);
  },

  /** Pfad unterhalb des geöffneten Dokuments: api.dok('/stammdaten/lehrer') → /api/dokumente/<id>/stammdaten/lehrer */
  dok(pfad = ''): string {
    if (!dokumentId) throw new ApiFehler(0, 'Es ist kein Dokument geöffnet.');
    return `/api/dokumente/${dokumentId}${pfad}`;
  },
};

/** Benutzereinstellung lesen (null, wenn nicht vorhanden). */
export async function einstellungLesen<T = unknown>(schluessel: string): Promise<T | null> {
  try { return ((await api.get<{ wert?: T }>(`/api/einstellungen/${encodeURIComponent(schluessel)}`))?.wert ?? null); } catch { return null; }
}

/** Benutzereinstellung speichern (Fehler werden nur protokolliert). */
export async function einstellungSchreiben(schluessel: string, wert: unknown): Promise<void> {
  try { await api.put(`/api/einstellungen/${encodeURIComponent(schluessel)}`, wert); } catch (e) { console.warn('Einstellung nicht gespeichert', schluessel, e); }
}

/** Datei über eine Adresse herunterladen (Anmeldecookie wird mitgeschickt). */
export async function dateiHerunterladen(pfad: string, standard = 'Datei'): Promise<void> {
  const antwort = await api.roh(pfad);
  const blob = await antwort.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dispo = antwort.headers.get('Content-Disposition') || '';
  const m = dispo.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
  a.download = (m ? decodeURIComponent(m[1] || m[2] || '') : '') || standard;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
