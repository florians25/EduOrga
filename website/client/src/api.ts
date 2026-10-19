// Zugriff auf die Server-Schnittstelle (/api). Ändernde Anfragen tragen den Schutzkopf der Verwaltung.

export class ApiFehler extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T>(pfad: string, optionen: { methode?: string; daten?: unknown } = {}): Promise<T> {
  const methode = optionen.methode ?? "GET";
  const kopf: Record<string, string> = { Accept: "application/json" };
  if (methode !== "GET") kopf["X-EduOrga-Website"] = "1";
  if (optionen.daten !== undefined) kopf["Content-Type"] = "application/json";
  const r = await fetch(pfad, {
    method: methode,
    headers: kopf,
    body: optionen.daten === undefined ? undefined : JSON.stringify(optionen.daten),
    credentials: "same-origin",
  });
  if (r.status === 204) return undefined as T;
  let inhalt: unknown = null;
  try {
    inhalt = await r.json();
  } catch {
    /* kein JSON */
  }
  if (!r.ok) {
    const meldung = (inhalt as { meldung?: string } | null)?.meldung ?? (r.status === 401 ? "Bitte melden Sie sich an." : `Fehler ${r.status}`);
    throw new ApiFehler(meldung, r.status);
  }
  return inhalt as T;
}

export type Status = "eingereicht" | "in_pruefung" | "abgelehnt" | "backlog" | "in_arbeit" | "erledigt";
export type Typ = "idee" | "wunsch" | "fehler";
export type Prioritaet = "keine" | "niedrig" | "mittel" | "hoch" | "kritisch";

export interface OeffentlicherEintrag {
  nummer: number;
  typ: Typ;
  titel: string;
  beschreibung: string;
  modul: string;
  status: Status;
  statusText: string;
  oeffentlicheAntwort: string;
  erstelltAm: string;
  geaendertAm: string;
}

export interface AdminEintrag {
  id: number;
  typ: Typ;
  titel: string;
  beschreibung: string;
  modul: string;
  email: string | null;
  status: Status;
  prioritaet: Prioritaet;
  tags: string[];
  position: number;
  interneNotiz: string;
  oeffentlicheAntwort: string;
  ablehnungsgrund: string;
  oeffentlich: boolean;
  erstelltAm: string;
  geaendertAm: string;
  nachfolger: Status[];
}

export interface Verlaufseintrag {
  id: number;
  zeit: string;
  benutzer: string;
  aktion: string;
  details: string;
}

export interface Info {
  version: string;
  betreiber: { name: string; anschrift: string; email: string };
  emailAufbewahrungTage: number;
}

let infoCache: Promise<Info> | null = null;
export function infoLaden(): Promise<Info> {
  infoCache ??= api<Info>("/api/info").catch((e) => {
    infoCache = null;
    throw e;
  });
  return infoCache;
}

export const datum = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
export const datumZeit = (iso: string) =>
  new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
