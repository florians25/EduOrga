// Daten und Aktionen der Tagesplanung: Arbeitsliste der offenen Stunden, die besten Kandidaten je Stunde (gebündelt
// nachgeladen für die gewählte und die nächsten Stunden; bei Änderungen verworfen), „Wer ist frei?“, Tagesbilanz,
// Probe der automatischen Vertretung und die Aktionen einer Stunde (zuweisen, Entfall, Betreuung, ohne Lehrkraft, Raum, zurücksetzen).
import { create } from 'zustand';
import { api } from '@/api/client';
import { an, betrifft } from '@/kern/ereignisse';
import { auswahlMelden, mitRueckfragen, vpfad } from '../kern';

export const QUELLE = 'tagesablauf';

export interface OffeneStunde {
  id: number; stunde: number; stundeText: string; zeit: string; klassen: string; klasse: number | null; fach: string; lehrer: string; lehrerId: number | null;
  raum: string; offen: boolean; raumOffen: boolean; pause: boolean; klausur: boolean; veranstaltung: boolean; art: string; grund: string; text: string;
  jahrgang: number; jahrgangText: string; abteilung: string; block: number[] | null; blockIds: number[] | null;
}
export interface BearbeiteteStunde {
  id: number; stunde: number; stundeText: string; zeit: string; klassen: string; klasse: number | null; fach: string; lehrer: string; lehrerId: number | null;
  raum: string; ergebnis: string; art: string; vertreter: number | null; entfall: boolean; fix: boolean; abgeleitet: boolean;
}
export interface Arbeitsliste { datum: string; offen: OffeneStunde[]; bearbeitet: BearbeiteteStunde[]; unterrichtstag: boolean }

export interface Mehrarbeit { geleistet: number; grenze: number; verguetung: number }
export interface Kandidat {
  lehrer: number; k: string; name: string; lage: string; gruende: string[]; woche: number; monat: number; maxWoche: number; maxMonat: number;
  mehrarbeit: boolean; mehrarbeitMonat: Mehrarbeit; rot: boolean;
}
export interface RaumKandidat { raum: number; k: string; name: string; gruende: string[] }
export interface KandidatenInfo {
  art: 'lehrer' | 'raum'; kandidaten: Kandidat[]; raeume?: RaumKandidat[]; weitere: number; entfallSinnvoll?: boolean; block?: boolean;
  betreuung?: { lehrer: number; k: string; naehe: string; kopplung: boolean; klassen: string } | null;
}

export interface FreiZeile { id: number; k: string; name: string; zellen: [string, string][]; heute: number; woche: number; monat: number; maxWoche: number; maxMonat: number; unterricht: number }
export interface FreiDaten { datum: string; stunden: { nr: number; zeit: string }[]; lehrer: FreiZeile[]; unterrichtstag: boolean }

export interface BilanzLehrer { id: number; k: string; name: string; heute: number; woche: number; monat: number; maxWoche: number; maxMonat: number; mehrarbeit: number; grenze: number; verguetung: number }
export interface Bilanz {
  datum: string;
  zahlen: { gesamt: number; vertreten: number; betreuung: number; aufsicht: number; entfall: number; freisetzung: number; ohneLehrkraft: number; raum: number; verlegung: number; offen: number; raumOffen: number };
  kollisionen: { lehrer: string[]; raeume: string[] };
  lehrer: BilanzLehrer[];
}

export interface ProbeVorschlag { id: number; stunde: number; stundeText: string; klassen: string; fach: string; lehrer: string; art: 'lehrer' | 'entfall' | 'raum'; lehrerId: number | null; raumId: number | null; text: string; grund: string }
export interface Probe { datum: string; vorschlaege: ProbeVorschlag[]; ohne: { id: number; stunde: number; stundeText: string; klassen: string; fach: string; lehrer: string }[] }

export const arbeitslisteLaden = (datum: string) => api.get<Arbeitsliste>(vpfad(`/tagesablauf?datum=${datum}`));
export const freiLaden = (datum: string) => api.get<FreiDaten>(vpfad(`/tagesablauf/frei?datum=${datum}`));
export const bilanzLaden = (datum: string) => api.get<Bilanz>(vpfad(`/tagesablauf/bilanz?datum=${datum}`));
export const probeLaden = (datum: string) => api.post<Probe>(vpfad('/tagesablauf/probe'), { datum });
export const vorschlaegeAnwenden = (eintraege: { id: number; lehrer?: number | null; raum?: number | null; entfall?: boolean; mit?: boolean }[]) =>
  api.post<{ ok: boolean; anzahl: number }>(vpfad('/tagesablauf/anwenden'), { eintraege }, { quelle: QUELLE });

// ---------------------------------------------------------------------------------------------
// Kandidaten je Stunde: gebündelt laden (höchstens 12 je Anfrage), bei Änderungen der Vertretungen verwerfen

interface KandidatenZustand { werte: Record<number, KandidatenInfo | null>; block: boolean; stand: number }
export const useKandidaten = create<KandidatenZustand>(() => ({ werte: {}, block: true, stand: 0 }));
const angefragt = new Set<number>();
let warteschlange: number[] = [];
let zeitgeber: ReturnType<typeof setTimeout> | null = null;
let stand = 0;

function abarbeiten() {
  zeitgeber = null;
  const ids = warteschlange.splice(0, 12);
  if (!ids.length) return;
  const nr = stand;
  const { block } = useKandidaten.getState();
  api.get<Record<string, KandidatenInfo>>(vpfad(`/tagesablauf/kandidaten?ids=${ids.join(',')}&block=${block}`))
    .then((r) => {
      if (nr !== stand) return;
      const neu: Record<number, KandidatenInfo | null> = {};
      for (const id of ids) neu[id] = r[String(id)] ?? null;
      useKandidaten.setState((s) => ({ werte: { ...s.werte, ...neu } }));
    })
    .catch(() => { for (const id of ids) angefragt.delete(id); })
    .finally(() => { if (warteschlange.length && !zeitgeber) zeitgeber = setTimeout(abarbeiten, 0); });
}

/** Kandidaten für diese Stunden anfordern (nur noch nicht geladene). */
export function kandidatenAnfordern(ids: number[]) {
  const fehlend = ids.filter((id) => !angefragt.has(id));
  if (!fehlend.length) return;
  for (const id of fehlend) angefragt.add(id);
  warteschlange.push(...fehlend);
  if (!zeitgeber) zeitgeber = setTimeout(abarbeiten, 40);
}

/** Geladene Kandidaten verwerfen (nach Änderungen); sichtbare Karten fordern sie neu an. */
export function kandidatenLeeren() {
  stand++;
  angefragt.clear();
  warteschlange = [];
  useKandidaten.setState((x) => ({ werte: {}, stand: x.stand + 1 }));
}
export function blockSetzen(block: boolean) { useKandidaten.setState({ block }); kandidatenLeeren(); }

an('daten', (e) => { if (betrifft(e, 'Vertretung', 'Stundenplan', 'Unterricht', 'Stammdaten', 'Einstellungen')) kandidatenLeeren(); });
an('vertretung.datum', () => kandidatenLeeren());

// ---------------------------------------------------------------------------------------------
// Aktionen einer Karte

const ziele = (o: { id: number; blockIds?: number[] | null }, block: boolean) => (block && o.blockIds?.length ? [...new Set([o.id, ...o.blockIds])] : [o.id]);

export async function zuweisen(o: OffeneStunde, lehrer: number, block: boolean) {
  return mitRueckfragen(vpfad(`/vorschlag/${o.id}/uebernehmen`), { lehrer, ids: ziele(o, block), block: block && !!o.block }, { quelle: QUELLE });
}
export async function betreuen(o: OffeneStunde, lehrer: number, block: boolean) {
  return mitRueckfragen(vpfad(`/vorschlag/${o.id}/betreuung`), { lehrer, ids: ziele(o, block), block: block && !!o.block }, { quelle: QUELLE });
}
export async function raumZuweisen(o: OffeneStunde, raum: number) {
  return mitRueckfragen(vpfad(`/vorschlag/${o.id}/raum`), { raum, zusatz: false, ids: [o.id] }, { quelle: QUELLE });
}
export async function entfallen(ids: number[]) { return mitRueckfragen(vpfad('/entfall'), { ids }, { quelle: QUELLE }); }
export async function ohneLehrkraft(ids: number[]) { return api.post(vpfad('/ohnelehrer'), { ids }, { quelle: QUELLE }); }
export async function zuruecksetzen(ids: number[]) { return mitRueckfragen(vpfad('/zuruecksetzen'), { ids }, { quelle: QUELLE }); }
export async function vormerken(ids: number[]) { return mitRueckfragen(vpfad('/vormerken'), { ids }, { quelle: QUELLE }); }

/** Die gewählte Stunde als Vertretungsauswahl melden: Pläne, Vorschlag und Abwesenheiten folgen. */
export function auswahlSetzen(o: { id: number; klasse: number | null; lehrerId: number | null; stunde: number; klassen: string } | null, datum: string | null, vertreter?: number | null) {
  if (!o) return;
  auswahlMelden({ id: o.id, ids: [o.id], quelle: QUELLE, text: `${o.stunde}. Std. ${o.klassen}`, zeile: { v: o.id, klasse: o.klasse, lehrer: o.lehrerId, vertreter: vertreter ?? null, datum, stunde: o.stunde } });
}

/** „3“ bzw. „2–3“ (Block) */
export const stundenText = (o: { stunde: number; block?: number[] | null }, block: boolean) =>
  block && o.block && o.block.length > 1 ? `${o.block[0]}.–${o.block[o.block.length - 1]}.` : `${o.stunde}.`;

export const mehrzahl = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;

/** Lage der Lehrkraft zur Stunde in Worten. */
export function lageText(lage: string): string {
  if (!lage) return '';
  if (lage === 'sonst frei') return 'heute sonst frei';
  if (lage === 'anschließend') return 'schließt an';
  const m = lage.match(/^Abstand (\d+)$/);
  if (m) return `${m[1]} Std. Abstand`;
  return lage;
}

/** Begründung eines Kandidaten: Lage und Kriterien ohne Wiederholungen („schließt an · kennt Klasse · Fach“). */
export function gruendeText(k: Kandidat): string {
  return [lageText(k.lage), ...k.gruende.filter((g) => g !== k.lage && !(k.lage === 'Bereitschaft' && g === 'Bereitschaft') && !(k.lage === 'freigesetzt' && g === 'freigesetzt'))].filter(Boolean).join(' · ');
}

/** Belastung eines Kandidaten als Kurzinfo (Woche, Monat, Mehrarbeit NRW). */
export function lastTitel(k: Kandidat): string {
  const ma = k.mehrarbeitMonat;
  return `Vertretungen diese Woche: ${k.woche}${k.maxWoche ? ` von höchstens ${k.maxWoche}` : ''}\nIm Monat: ${k.monat}${k.maxMonat ? ` von höchstens ${k.maxMonat}` : ''}`
    + (k.mehrarbeit ? `\nMehrarbeit im Monat: ${ma.geleistet} Std. (NRW: ab mehr als ${ma.grenze} Std. vergütungsfähig${ma.verguetung ? `, derzeit ${ma.verguetung}` : ''})` : '\nKeine Mehrarbeit (Bereitschaft bzw. freigesetzt)');
}

// ---------------------------------------------------------------------------------------------
// Mehrere Stunden auf einmal: gemeinsame Kandidaten (in allen Stunden frei)

export interface Gemeinsam { ids: number[]; stunden: number[]; gleicheZeit: boolean; kandidaten: Kandidat[]; betreuung: KandidatenInfo['betreuung']; entfallSinnvoll: boolean }
export const gemeinsamLaden = (ids: number[]) => api.get<Gemeinsam>(vpfad(`/tagesablauf/gemeinsam?ids=${ids.join(',')}`));
/** Eine Lehrkraft für alle markierten Stunden (Rückfragen wie beim einzelnen Zuweisen). */
export const alleZuweisen = (ids: number[], lehrer: number) => mitRueckfragen(vpfad(`/vorschlag/${ids[0]}/uebernehmen`), { lehrer, ids }, { quelle: QUELLE });
export const alleBetreuen = (ids: number[], lehrer: number) => mitRueckfragen(vpfad(`/vorschlag/${ids[0]}/betreuung`), { lehrer, ids }, { quelle: QUELLE });

// ---------------------------------------------------------------------------------------------
// „Fall für Fall“: Fälle des Tages (Stunde bzw. Block einer fehlenden Lehrkraft, auch gelöst), Kandidaten für den ganzen Block,
// Vorschläge für alle offenen Fälle (Probe, nichts geändert)

export interface FallTeil { id: number; stunde: number; offen: boolean; raumOffen: boolean; ergebnis: string; entfall: boolean; verlegt: boolean; vertreter: number | null; fix: boolean; text: string }
export interface Fall {
  schluessel: string; ids: number[]; offeneIds: number[]; klassenIds: number[]; klassen: string; stunden: number[]; zeit: string; fach: string; fachLang: string;
  /** Schülergruppe bzw. Kurs („Gr. 1“), leer = ganze Klasse */
  gruppe: string;
  lehrer: string; lehrerId: number | null; lehrerIds: number[]; lehrerName: string; raum: string; raumId: number | null; unterricht: number | null; pause: boolean; klausur: boolean;
  veranstaltung: boolean; grund: string; grundLang: string; zustand: 'offen' | 'teilweise' | 'erledigt'; ergebnis: string; teile: FallTeil[]; text: string;
  /** Parallele Gruppen zur selben Zeit (Teilungsgruppen, Kurse, Kopplungen) – ein Fall, je Gruppe lösbar; null = gewöhnlicher Fall */
  parallel: Fall[] | null;
}
/** Stand des Tages in den Kategorien der NRW-Unterrichtsstatistik (Unterrichtsstunden der Fälle). */
export interface FallStatistik { imFach: number; fachfremd: number; zusammen: number; eva: number; verlegt: number; ausfall: number; offen: number }
export interface FallKlasse { id: number; k: string; name: string; jahrgang: string; leitung: string }
export interface FallAbwesend { id: number; k: string; name: string; grund: string; zeit: string; text: string }
export interface FaelleDaten {
  datum: string; unterrichtstag: boolean; frei: string; stunden: { nr: number; zeit: string }[];
  klassen: FallKlasse[]; abwesend: FallAbwesend[]; faelle: Fall[]; statistik: FallStatistik;
}
export interface FallKandidat { lehrer: number; k: string; name: string; rot: boolean; lage?: string; gruende: string[]; woche?: number; maxWoche?: number; mehrarbeit?: boolean }
export interface FallBetreuung { lehrer: number; k: string; name: string; klassen: string; fach: string; naehe: string }
export interface FallKandidaten {
  ids: number[]; gleicheZeit: boolean; gruppen: number; kandidaten: FallKandidat[]; weitere: number; entfallSinnvoll: boolean;
  betreuung: FallBetreuung | null;
  /** Zusammenlegen im Block, Stunde für Stunde mit verschiedenen Klassen (wenn niemand alle Stunden betreut) */
  betreuungJeStunde: (FallBetreuung & { stunde: number; ids: number[] })[] | null;
}
export interface FallVorschlag {
  schluessel: string; ids: number[]; art: 'lehrer' | 'entfall'; lehrerId: number | null; text: string; grund: string;
  /** parallele Gruppen: die erste vertritt die Lehrkraft, die anderen betreut sie mit */
  teile: { ids: number[]; art: 'lehrer' | 'mit' }[] | null;
}

export const faelleLaden = (datum: string) => api.get<FaelleDaten>(vpfad(`/tagesablauf/faelle?datum=${datum}`));
export const fallVorschlaegeLaden = (datum: string) => api.post<{ datum: string; vorschlaege: FallVorschlag[]; ohne: string[] }>(vpfad('/tagesablauf/fallvorschlaege'), { datum });

/** Kandidaten eines Falls (gemerkt, bis sich die Vertretungen ändern). */
const fallCache = new Map<string, Promise<FallKandidaten>>();
export const useFallStand = create<{ stand: number }>(() => ({ stand: 0 }));
export function fallKandidaten(ids: number[], anzahl = 5): Promise<FallKandidaten> {
  const key = `${[...ids].sort((a, b) => a - b).join(',')}|${anzahl}`;
  let p = fallCache.get(key);
  if (!p) {
    p = api.get<FallKandidaten>(vpfad(`/tagesablauf/fallkandidaten?ids=${ids.join(',')}&anzahl=${anzahl}`));
    fallCache.set(key, p);
    p.catch(() => fallCache.delete(key));
  }
  return p;
}
function fallCacheLeeren() { fallCache.clear(); useFallStand.setState((s) => ({ stand: s.stand + 1 })); }
an('daten', (e) => { if (betrifft(e, 'Vertretung', 'Stundenplan', 'Unterricht', 'Stammdaten', 'Einstellungen')) fallCacheLeeren(); });
an('vertretung.datum', () => fallCacheLeeren());

/** Lösung eines Falls in einer Rückgängig-Stufe: je Teil Vertretung, Mitbetreuung (zusammengelegt), Entfall oder ohne Lehrkraft. */
export type FallLoesungTeil = { ids: number[]; art: 'lehrer' | 'mit' | 'entfall' | 'ohne'; lehrer?: number | null };
export const fallLoesen = (teile: FallLoesungTeil[], text?: string) => api.post<{ ok: boolean; anzahl: number }>(vpfad('/tagesablauf/fallloesen'), { teile, text }, { quelle: QUELLE });
/** Vorschlag übernehmen (bei parallelen Gruppen: eine Lehrkraft, die übrigen Gruppen betreut sie mit). */
export const vorschlagUebernehmen = (v: FallVorschlag) => (v.art === 'entfall' ? entfallen(v.ids)
  : v.teile ? fallLoesen(v.teile.map((t) => ({ ids: t.ids, art: t.art, lehrer: v.lehrerId })), `Vorschlag ${v.text}`) : alleZuweisen(v.ids, v.lehrerId!));
/** Einträge für „/tagesablauf/anwenden“ (Vorschläge für alle). */
export const vorschlagEintraege = (v: FallVorschlag) => (v.teile
  ? v.teile.flatMap((t) => t.ids.map((id) => ({ id, lehrer: v.lehrerId, entfall: false, mit: t.art === 'mit' })))
  : v.ids.map((id) => ({ id, lehrer: v.art === 'lehrer' ? v.lehrerId : null, entfall: v.art === 'entfall', mit: false })));

/** Verlegen per Ziehen: Zielstunden des Tages mit Stand und Grund, beteiligte Lehrkräfte und Räume. */
export type ZielStatus = 'quelle' | 'frei' | 'luecke' | 'tausch' | 'abwesend' | 'kollision';
export interface FallZiele {
  datum: string; von: string; stunde: number; unterricht: number; laenge: number; fach: string; klassen: string;
  lehrer: { id: number; k: string; name: string; fehlt: boolean }[]; raeume: { id: number; k: string }[];
  ziele: { s: number; status: ZielStatus; grund: string; luecke: number | null }[];
}
export const fallZieleLaden = (datum: string, von: string, stunde: number, unterricht: number, laenge: number) =>
  api.get<FallZiele>(vpfad(`/tagesablauf/fallziele?datum=${datum}&von=${von}&stunde=${stunde}&unterricht=${unterricht}&laenge=${laenge}`));
/** Stunde bzw. Block im tagesaktuellen Plan verlegen (mit den Rückfragen Tausch, Kollision, Lehrkraft fehlt). */
export const stundeVerlegen = (z: { von: string; stunde: number; u: number; laenge: number; ziel: string; zielStunde: number }) =>
  mitRueckfragen<{ ok?: boolean; abgebrochen?: boolean; text?: string }>(vpfad('/plan/verlegen'),
    { von: z.von, vonStunde: z.stunde, unterricht: z.u, zeile: null, laenge: z.laenge, ziel: z.ziel, zielStunde: z.zielStunde }, { quelle: QUELLE });

/** Hinweis zur Vertretung (Text im Vertretungsplan, z. B. „Aufgaben im Lernraum“). */
export const hinweisSetzen = (ids: number[], text: string) => api.post(vpfad('/aendern'), { ids, spalte: 'Text', wert: text }, { quelle: QUELLE });
export const vorziehen = (id: number, z: { datum: string; stunde: number; u: number | null }) =>
  api.post(vpfad(`/vorschlag/${id}/vorziehen`), { datum: z.datum, stunde: z.stunde, unterricht: z.u, alle: true }, { quelle: QUELLE });
export interface Vorziehung { lehrer: string; lehrerIds: number[]; tag: string; datum: string; stunde: number; klassen: string; fach: string; raum: string; art: string; beschreibung: string; u: number | null }
export const vorziehungenLaden = (id: number) => api.get<Vorziehung[]>(vpfad(`/tagesablauf/fallverlegungen?id=${id}`));

/** Zahlen und Auftrag „Vorschläge für alle“ – zwischen „Fall für Fall“ und dem Kopf der Tagesplanung. */
export const useFallKopf = create<{ offen: number; erledigt: number; anfrage: number; laeuft: boolean; vorschlaege: number }>(() => ({ offen: 0, erledigt: 0, anfrage: 0, laeuft: false, vorschlaege: 0 }));
export const vorschlaegeAnfordern = () => useFallKopf.setState((s) => ({ anfrage: s.anfrage + 1 }));
