// Geöffnetes Arbeitsdokument: Öffnen/Schließen, Stand (Titel, Rückgängig, Speicherstand), Ereignisverbindung (Server-Sent Events),
// Sicherungspunkt/Speichern, Rückgängig/Wiederholen, Herunterladen. Gespeichert wird auf dem Server automatisch nach jeder Änderung.
import { api, dokumentIdSetzen } from '@/api/client';
import type { Bereich, DokumentStand, Grunddaten } from '@/api/typen';
import { an, melden } from './ereignisse';
import { elementeVerwerfen, setzen, zustand } from './zustand';
import { entprellen } from './hilfen';

let quelle: EventSource | null = null;
let wiederverbinden = 0;
const dokumentHoerer = new Set<(stand: DokumentStand | null) => void>();

/** Wird bei jedem Dokumentwechsel gerufen (Stand oder null). */
export function beiDokumentwechsel(f: (stand: DokumentStand | null) => void): () => void {
  dokumentHoerer.add(f);
  return () => { dokumentHoerer.delete(f); };
}

function wechselMelden(stand: DokumentStand | null) {
  for (const f of [...dokumentHoerer]) { try { f(stand); } catch (e) { console.error(e); } }
}

/** Öffnet ein Dokument (Id oder bereits geladener Stand). */
export async function dokumentOeffnen(idOderStand: string | DokumentStand): Promise<DokumentStand> {
  const stand = typeof idOderStand === 'string' ? await api.get<DokumentStand>(`/api/dokumente/${idOderStand}`) : idOderStand;
  if (zustand().dokument?.id !== stand.id) trennen();
  const grunddaten = await api.get<Grunddaten>(`/api/dokumente/${stand.id}/grunddaten`);
  dokumentIdSetzen(stand.id);
  elementeVerwerfen();
  setzen({ dokument: stand, version: stand.version, grunddaten });
  try { sessionStorage.setItem('studio.dokument', stand.id); } catch { /* privat */ }
  verbinden();
  wechselMelden(stand);
  return stand;
}

export async function dokumentSchliessen(): Promise<void> {
  const d = zustand().dokument;
  if (!d) return;
  trennen();
  dokumentIdSetzen(null);
  setzen({ dokument: null, grunddaten: null });
  try { sessionStorage.removeItem('studio.dokument'); } catch { /* privat */ }
  wechselMelden(null);
  try { await api.post(`/api/dokumente/${d.id}/schliessen`); } catch { /* bereits geschlossen */ }
}

/** Stand neu laden (entprellt) – nach Änderungen, Speichern, Rückgängig. */
export const standAktualisieren = entprellen(async () => {
  const d = zustand().dokument;
  if (!d) return;
  try {
    const stand = await api.get<DokumentStand>(api.dok());
    if (stand.id !== zustand().dokument?.id) return;
    setzen({ dokument: stand });
  } catch { /* nächster Versuch beim nächsten Ereignis */ }
}, 250);

/** Neuer Änderungsstand gesehen (aus einer API-Antwort oder einem Server-Ereignis). */
function versionGesehen({ version, bereich, quelle: q, benutzer }: { version: number; bereich: Bereich; quelle: string | null; benutzer?: string }) {
  const z = zustand();
  if (!z.dokument || !(version > z.version)) return;
  setzen({ version });
  if (bereich === 'Stammdaten' || bereich === 'Alles') elementeVerwerfen();
  if (bereich === 'Alles' || bereich === 'Einstellungen') {
    api.get<Grunddaten>(api.dok('/grunddaten')).then((g) => { setzen({ grunddaten: g }); melden('grunddaten', g); }).catch(() => {});
  }
  melden('daten', { version, bereich, quelle: q, benutzer });
  standAktualisieren();
}

an('version', versionGesehen);

function verbinden() {
  const d = zustand().dokument;
  if (!d || quelle || typeof EventSource === 'undefined') return;
  const id = d.id;
  quelle = new EventSource(`/api/dokumente/${id}/ereignisse`);
  quelle.addEventListener('hallo', () => {
    wiederverbinden = 0;
    setzen({ verbunden: true });
    melden('verbindung', true);
  });
  quelle.addEventListener('aenderung', (e) => {
    const x = JSON.parse((e as MessageEvent).data) as { version: number; bereich: Bereich; beschreibung: string; benutzer: string };
    versionGesehen({ version: x.version, bereich: x.bereich, quelle: null, benutzer: x.benutzer });
    if (x.benutzer && x.benutzer !== zustand().benutzer?.name) melden('meldung', { text: `${x.benutzer}: ${x.beschreibung}`, art: 'info' });
  });
  quelle.addEventListener('gespeichert', () => standAktualisieren());
  quelle.addEventListener('speicherfehler', () => standAktualisieren());
  quelle.addEventListener('untplanweb', (e) => {
    const x = JSON.parse((e as MessageEvent).data) as { beschreibung: string; benutzer: string; zeit: string };
    melden('untplanweb.direkt', { text: x.beschreibung, benutzer: x.benutzer, zeit: x.zeit });
  });
  quelle.addEventListener('geschlossen', (e) => {
    const x = JSON.parse((e as MessageEvent).data) as { benutzer?: string };
    if (x.benutzer !== zustand().benutzer?.name) melden('meldung', { text: `Das Dokument wurde von ${x.benutzer || 'jemand anderem'} geschlossen.`, art: 'warnung' });
  });
  quelle.onerror = () => {
    setzen({ verbunden: false });
    melden('verbindung', false);
    if (quelle && quelle.readyState === EventSource.CLOSED) {
      quelle = null;
      const warten = Math.min(30000, 1000 * 2 ** wiederverbinden++);
      setTimeout(() => { if (zustand().dokument?.id === id) verbinden(); }, warten);
    }
  };
}

function trennen() {
  if (quelle) quelle.close();
  quelle = null;
  setzen({ verbunden: false });
  melden('verbindung', false);
}

// ---- Befehle rund ums Dokument (Kopfleiste, Tastatur) ----

/** Sofort speichern (normalerweise nicht nötig – der Server speichert jede Änderung; z. B. „Erneut versuchen“ nach einem Fehler). */
export async function speichern(): Promise<void> {
  if (!zustand().dokument) return;
  const stand = await api.post<DokumentStand>(api.dok('/speichern'));
  setzen({ dokument: stand });
}

/** Strg+S: aktuellen Stand als Sicherungspunkt ablegen (ältere Fassung, die nicht automatisch verdrängt wird). */
export async function sicherungspunkt(): Promise<void> {
  if (!zustand().dokument) return;
  const stand = await api.post<DokumentStand>(api.dok('/sicherungspunkt'));
  setzen({ dokument: stand });
  melden('meldung', { text: 'Sicherungspunkt angelegt.', art: 'ok' });
}

export async function rueckgaengig(): Promise<void> {
  if (!zustand().dokument?.kannRueckgaengig) return;
  const stand = await api.post<DokumentStand>(api.dok('/rueckgaengig'));
  setzen({ dokument: stand });
}

export async function wiederholen(): Promise<void> {
  if (!zustand().dokument?.kannWiederholen) return;
  const stand = await api.post<DokumentStand>(api.dok('/wiederholen'));
  setzen({ dokument: stand });
}

export async function umbenennen(name: string): Promise<void> {
  const stand = await api.put<DokumentStand>(api.dok('/name'), { name });
  setzen({ dokument: stand });
}

export function herunterladen(): void {
  if (!zustand().dokument) return;
  const a = document.createElement('a');
  a.href = api.dok('/herunterladen');
  a.download = '';
  document.body.append(a);
  a.click();
  a.remove();
}
