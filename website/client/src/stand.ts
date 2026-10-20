import daten from "./stand.json";
import { COMMITS, RELEASES } from "./inhalt";

/** Stand des Projekts, beim Build von scripts/vorbereiten.mjs ermittelt (src/stand.json). */
export interface Stand {
  version: string;
  commit: string | null;
  letzteAenderung: string;
  gebaut: string;
  veroeffentlichung: { tag: string; datum: string | null; adresse: string | null } | null;
  handbuch: { nummer: number; titel: string; anker: string }[];
  /** Bildschirmfotos der iPhone-App (echt = aus ios/docs/bilder, sonst Ersatz aus EduOrga Mobile) */
  ios?: Record<string, { datei: string; echt: boolean; breite: number; hoehe: number }>;
}

export const STAND: Stand = daten as Stand;

export function datumLang(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" }).format(d);
}

/** Link „Projektstand & Änderungen“: Veröffentlichungen, sobald es welche gibt, sonst die Liste der Änderungen. */
export const STAND_LINK = STAND.veroeffentlichung ? RELEASES : COMMITS;
