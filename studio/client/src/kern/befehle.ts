// Befehle und Befehlseinträge der Module.
//
// Ein Befehl ist eine Funktion unter einem Namen ('stammdaten.oeffnen', 'planung.alleEntplanen' …). Ein Befehlseintrag
// beschreibt eine aufrufbare Funktion für Navigation und Befehlssuche:
//   { id, text, ansicht?: { typ, p }, arbeitsplatz?, befehl?, args?, aktion?, menue?, braucht?, taste?, hinweis? }
// ansicht/arbeitsplatz öffnen eine Seite; befehl/aktion führen etwas aus (z. B. einen Dialog). Gleiche id ersetzt einen
// früheren Eintrag. braucht: 'dokument' | 'schreiben' | 'admin'.
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { zustand } from './zustand';

export type Braucht = 'dokument' | 'schreiben' | 'admin';
export type Params = Record<string, string | number | boolean | null | undefined>;

export interface Befehlseintrag {
  id: string;
  text: string;
  /** Ort in der Befehlssuche, falls der Eintrag nicht in der Navigation steht. */
  gruppe?: string;
  ansicht?: { typ: string; p?: Params };
  arbeitsplatz?: string;
  befehl?: string;
  args?: unknown;
  aktion?: (args?: unknown) => unknown;
  menue?: (Omit<Befehlseintrag, 'id'> & { id?: string } | null)[];
  braucht?: Braucht | Braucht[];
  taste?: string;
  hinweis?: string;
  /** nur in diesem Modus in der Befehlssuche */
  modus?: 'stundenplan' | 'vertretung';
}

const befehle = new Map<string, (args: any) => unknown>();
const eintraege = new Map<string, Befehlseintrag & { _nr: number }>();
const tasten = new Map<string, { aktion: () => unknown; braucht?: Braucht | Braucht[] }>();

export function befehlRegistrieren(name: string, f: (args: any) => unknown) { befehle.set(name, f); }

/** Befehl ausführen (Fehler werden als Hinweis gezeigt). */
export async function befehl(name: string, args?: unknown): Promise<unknown> {
  const f = befehle.get(name);
  if (!f) { hinweis(`Der Befehl „${name}“ ist noch nicht verfügbar.`, 'warnung'); return undefined; }
  try { return await f(args ?? {}); } catch (e) { fehlerMelden(e); return undefined; }
}

export const befehlVorhanden = (name: string) => befehle.has(name);

export function eintragRegistrieren(e: Befehlseintrag) {
  const alt = eintraege.get(e.id);
  eintraege.set(e.id, { ...e, _nr: alt?._nr ?? eintraege.size });
  if (e.taste && (e.befehl || e.aktion || e.ansicht || e.arbeitsplatz)) tasten.set(normTaste(e.taste), { aktion: () => eintragAusfuehren(e), braucht: e.braucht });
}

export function eintrag(id: string): Befehlseintrag | undefined { return eintraege.get(id); }

export function alleEintraege(): Befehlseintrag[] {
  return [...eintraege.values()].sort((a, b) => a._nr - b._nr);
}

/** Darf der Eintrag gerade benutzt werden? */
export function verfuegbar(e: { braucht?: Braucht | Braucht[] }): boolean {
  const b = Array.isArray(e.braucht) ? e.braucht : e.braucht ? [e.braucht] : [];
  const z = zustand();
  if (b.includes('dokument') && !z.dokument) return false;
  if (b.includes('schreiben') && (!z.dokument || !z.benutzer?.darfSchreiben)) return false;
  if (b.includes('admin') && z.benutzer?.rolle !== 'Admin') return false;
  return true;
}

let seiteOeffnenFn: (typ: string, p?: Params) => void = () => {};
let arbeitsplatzOeffnenFn: (name: string) => void = () => {};
let adresseOeffnenFn: (url: string) => void = () => {};
/** Von der Shell gesetzt (Router). */
export function navigationEinrichten(seite: typeof seiteOeffnenFn, arbeitsplatz: typeof arbeitsplatzOeffnenFn, adresse: typeof adresseOeffnenFn) {
  seiteOeffnenFn = seite;
  arbeitsplatzOeffnenFn = arbeitsplatz;
  adresseOeffnenFn = adresse;
}

/** Ansicht als neue Seite öffnen (Navigation, Befehlssuche, Befehle). */
export const seiteOeffnen = (typ: string, p?: Params) => seiteOeffnenFn(typ, p);
export const arbeitsplatzOeffnen = (name: string) => arbeitsplatzOeffnenFn(name);
/** Adresse innerhalb der Anwendung öffnen (z. B. gespeicherter Arbeitsplatz). */
export const adresseOeffnen = (url: string) => adresseOeffnenFn(url);

export function eintragAusfuehren(e: Pick<Befehlseintrag, 'ansicht' | 'arbeitsplatz' | 'befehl' | 'args' | 'aktion'>): Promise<unknown> | undefined {
  if (e.ansicht) { seiteOeffnenFn(e.ansicht.typ, e.ansicht.p); return undefined; }
  if (e.arbeitsplatz) { arbeitsplatzOeffnenFn(e.arbeitsplatz); return undefined; }
  if (e.aktion) return Promise.resolve().then(() => e.aktion!(e.args ?? {})).catch(fehlerMelden);
  if (e.befehl) return befehl(e.befehl, e.args);
  return undefined;
}

// ---- Tastenkürzel ('Strg+S', 'Strg+Umschalt+V', 'F5', 'Strg+PageDown') ----

function normTaste(t: string): string {
  return t.split('+').map((x) => x.trim().toLowerCase().replace('strg', 'ctrl').replace('umschalt', 'shift').replace('bild↓', 'pagedown').replace('bild↑', 'pageup'))
    .sort().join('+');
}

export function tasteRegistrieren(taste: string, aktion: () => unknown, braucht?: Braucht | Braucht[]) {
  tasten.set(normTaste(taste), { aktion, braucht });
}

export function tasteBehandeln(ev: KeyboardEvent): boolean {
  const teile: string[] = [];
  if (ev.ctrlKey || ev.metaKey) teile.push('ctrl');
  if (ev.shiftKey) teile.push('shift');
  if (ev.altKey) teile.push('alt');
  teile.push(ev.key.toLowerCase());
  const e = tasten.get(teile.sort().join('+'));
  if (!e || (e.braucht && !verfuegbar(e))) return false;
  ev.preventDefault();
  Promise.resolve().then(e.aktion).catch(fehlerMelden);
  return true;
}
