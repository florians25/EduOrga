// Gemeinsame Typen der API (Anmeldung, Dokumente, Grunddaten). Fachliche Typen stehen bei den Modulen.

/** Änderungsbereich (AenderungsArt des Core). */
export type Bereich = 'Stammdaten' | 'Unterricht' | 'Stundenplan' | 'Vertretung' | 'Einstellungen' | 'Alles';

export interface SystemInfo { anwendung: string; version: string; beta: boolean }

export type Rolle = 'Admin' | 'Planer' | 'Leser';

export interface Benutzer { name: string; anzeigename: string; rolle: Rolle; darfSchreiben: boolean }

export interface DokumentStand {
  id: string;
  name: string;
  version: number;
  /** noch nicht in der Datenbank (Speichern ist vorgemerkt) */
  geaendert: boolean;
  gespeichert: string | null;
  /** wird gerade in die Datenbank geschrieben */
  speichert?: boolean;
  /** letzter Speicherversuch fehlgeschlagen (Grund) */
  speicherfehler?: string | null;
  kannRueckgaengig: boolean;
  rueckgaengigText: string | null;
  kannWiederholen: boolean;
  wiederholenText?: string | null;
  schulname: string;
  schuljahr: string;
  periode: string;
  periodeFixiert: boolean;
  besitzer: string;
  herkunft: string;
  abonnenten: number;
  zaehler: Record<string, number>;
}

export interface DokumentEintrag {
  id: string; name: string; besitzer: string; erstellt: string; geaendert: string; herkunft: string; groesse: number; offen: boolean; ungespeichert: boolean;
}

export interface DokumentListe { dokumente: DokumentEintrag[]; zuletzt: string[] }

export interface Tag { nr: number; kurz: string; lang: string }
export interface Stunde { nr: number; label: string; beginn: string; ende: string; pauseDanach: string | null }
export interface Zeitraster { tage: Tag[]; stunden: Stunde[]; belegung: string[][] }

export interface Periode { id: number; name: string; langname: string; von: string; bis: string | null; ende: string; mutterId: number | null; fixiert: boolean; aktiv: boolean }

export interface Grunddaten { schulname: string; zeitraster: Zeitraster; perioden: Periode[]; wochenperiodizitaet: number }

/** Auswahlliste eines Elementtyps: Id, Kurzname, Langname (optional Klasse für die Darstellung). */
export interface ElementOption { id: number; k: string; l: string; c?: string }

export type ElementTyp = 'klasse' | 'lehrer' | 'raum' | 'fach' | 'raumgruppe' | 'gang' | 'abteilung' | 'abwesenheitsgrund' | 'schueler';

/** Rückfrage des Servers (Vertretungsplanung): Wiederholung mit antworten[schluessel] = Index. */
export interface ServerFrage { schluessel: string; text: string; optionen: string[] }
