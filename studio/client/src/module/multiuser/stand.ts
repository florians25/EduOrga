// Gemeinsamer Stand des Mehrbenutzerbetriebs: Lebenszeichen alle 20 Sekunden (mit Tätigkeit = Titel der aktiven Ansicht),
// aktive Benutzer, Sperren, Exklusivbetrieb, Nachrichten.
import { create } from 'zustand';
import { api } from '@/api/client';
import { zustand } from '@/kern/zustand';
import { hinweis } from '@/komponenten/hinweise';

export interface Aktiver { benutzer: string; anzeigename: string; aktiv: boolean; taetigkeit: string; seit: string; aktivitaet: string }
export interface Sperre { bereich: string; benutzer: string; anzeigename: string; seit: string }
export interface Nachricht { id: number; von: string; an?: string | null; text: string; zeit: string }
export interface BereichRecht { bereich: string; text: string; stufeText: string; bearbeiten: boolean }
export interface MultiuserStand {
  ich: string;
  aktive: Aktiver[];
  sperren: Sperre[];
  exklusiv: { benutzer: string; anzeigename: string; seit: string; eigen: boolean } | null;
  nachrichten: Nachricht[];
  rechte: { gruppe: string; nurLesen: boolean; bereiche: BereichRecht[] };
}

export const useMultiuser = create<{ stand: MultiuserStand | null; verlauf: Nachricht[] }>(() => ({ stand: null, verlauf: [] }));

let nachrichtNach = 0;
let takt = 0;

const taetigkeit = () => document.title.replace(/ – UntPlan Studio$/, '').replace(/ – [^–]*$/, '');

function aufnehmen(neu: MultiuserStand) {
  const { verlauf } = useMultiuser.getState();
  const dazu = neu.nachrichten.filter((n) => !verlauf.some((x) => x.id === n.id));
  useMultiuser.setState({ stand: neu, verlauf: dazu.length ? [...verlauf, ...dazu] : verlauf });
}

export async function abfragen(): Promise<void> {
  if (!zustand().dokument) return;
  try {
    const neu = await api.get<MultiuserStand>(api.dok(`/multiuser?nach=${nachrichtNach}&taetigkeit=${encodeURIComponent(taetigkeit())}`));
    const vorher = useMultiuser.getState().stand;
    const ich = neu.ich.toLowerCase();
    for (const n of neu.nachrichten) {
      nachrichtNach = Math.max(nachrichtNach, n.id);
      if (n.von.toLowerCase() !== ich && vorher) hinweis(`Nachricht von ${n.von}: ${n.text}`, 'info', 10000);
    }
    if (vorher) {
      const alt = new Set(vorher.aktive.filter((s) => s.aktiv).map((s) => s.benutzer));
      for (const s of neu.aktive) if (s.aktiv && !alt.has(s.benutzer) && s.benutzer !== neu.ich) hinweis(`${s.anzeigename} arbeitet jetzt ebenfalls an dieser Datei.`, 'info', 5000);
      if (neu.exklusiv && !neu.exklusiv.eigen && !vorher.exklusiv) hinweis(`${neu.exklusiv.anzeigename} arbeitet jetzt exklusiv – Änderungen sind gesperrt.`, 'warnung', 8000);
    }
    aufnehmen(neu);
  } catch { /* still: nächster Versuch */ }
}

/** Stand nach einer Aktion (Sperren, Exklusivbetrieb) übernehmen. */
export const standSetzen = (s: MultiuserStand) => aufnehmen(s);

/** Vollständige Nachrichtenliste einmal holen (für die Ansicht „Aktive Benutzer“). */
export async function verlaufLaden(): Promise<void> {
  if (!zustand().dokument) return;
  const s = await api.get<MultiuserStand>(api.dok('/multiuser?nach=0'));
  for (const n of s.nachrichten) nachrichtNach = Math.max(nachrichtNach, n.id);
  aufnehmen(s);
}

export function starten(): void {
  clearInterval(takt);
  nachrichtNach = 0;
  useMultiuser.setState({ stand: null, verlauf: [] });
  if (!zustand().dokument) return;
  void abfragen();
  takt = window.setInterval(abfragen, 20000);
}
