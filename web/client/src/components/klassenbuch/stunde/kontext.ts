// Gemeinsame Typen des Fensters „Unterrichtsstunde“ (components/plan/Stundendetails.tsx) und seiner Reiter.
import type { Karte, Zeit } from '../../../api/types';
import type { Hausaufgabe } from '../Hausaufgabe';
import type { Anwesenheit, Bereich, Eintrag, Fehlzeit, Grund, Vermerk } from '../StundenDialoge';
import type { KbEinstellungen, SitzDaten } from '../sitzplan';

export interface Einzelstunde { stunde: number; beginn: string; ende: string; eintrag: boolean }
export interface StundenAntwort {
  eintrag: Eintrag | null; darf: boolean; blockEintrag?: Eintrag | null; einzelstunden?: Einzelstunde[];
  einzelEintraege?: (Eintrag & { einzelstunde?: number; stunde?: number })[]; online?: boolean; onlineLink?: string;
}
export interface HwListe { liste: Hausaufgabe[]; faellig: Hausaufgabe[]; darf: boolean }
export interface Dienst { dienstId: number; dienst: string; von: string; bis: string; klasse: string; text?: string; schueler: string }
/** Abwesenheitsmeldung der Eltern bzw. Schüler*innen für den Tag der Stunde (Text nur für die Klassenleitung). */
export interface Meldung { id: number; schuelerId: number; von: string; bis: string; grund: string; status: 'gemeldet' | 'bestaetigt'; gemeldet: string; text?: string }
export type AnwesenheitMit = Anwesenheit & { meldungen?: Meldung[] };

export interface Daten {
  st: StundenAntwort | null; hw: HwListe; anw: AnwesenheitMit | null; vermerke: Vermerk[]; arten: string[]; dienste: Dienst[]; gruende: Grund[];
  befreit: Set<number>; sitz: SitzDaten | null;
}
export const LEER: Daten = { st: null, hw: { liste: [], faellig: [], darf: false }, anw: null, vermerke: [], arten: [], dienste: [], gruende: [], befreit: new Set(), sitz: null };

export type Reiter = 'stunde' | 'anwesenheit' | 'eintraege' | 'termine' | 'verlauf';
export type Speicherzustand = { art: 'bereit' } | { art: 'ungespeichert' } | { art: 'speichert' } | { art: 'gespeichert'; zeit: string } | { art: 'fehler'; text: string };

/** Fehlzeit je Schüler*in, wie sie beim Speichern der Anwesenheit geschickt wird. */
export type Fz = { art: string; minuten?: number; bemerkung?: string; grund?: string; von?: string | null; bis?: string | null };

export type Dialog = null | { art: 'abw'; ids: number[]; f: Fehlzeit | null } | { art: 'eintrag'; ids: number[] } | { art: 'pruefung' } | { art: 'pruefungEdit' }
  | { art: 'hw'; h: Hausaufgabe; darf: boolean } | { art: 'hwNeu'; faellig?: string | null } | { art: 'einst' } | { art: 'sitz' } | { art: 'ticket' };

/** Was alle Reiter brauchen: Stunde, geladene Daten und die Aktionen des Fensters. */
export interface StundeProps {
  k: Karte; d: Daten; setD: (f: (d: Daten | null) => Daten | null) => void; einzel: number | null; bereich: Bereich; zeiten: Zeit[]; kollegium: boolean;
  kbw: KbEinstellungen; setKbw: (w: KbEinstellungen) => void; liste: Karte[];
  setDialog: (d: Dialog) => void; markieren: () => void;
  /** Feld des Klassenbucheintrags vormerken; gespeichert wird kurz nach der letzten Eingabe (bzw. sofort mit sofort = true). */
  vormerken: (a: Partial<Eintrag>, sofort?: boolean) => void;
  anwNeu: () => Promise<void>; hwNeu: () => Promise<void>;
  oeffnen: (k: Karte) => void;
  setK: (k: Karte) => void;
}
