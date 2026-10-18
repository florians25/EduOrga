// Gemeinsame Bausteine der Vertretungsplanung: Planungsdatum, Auswahl der aktiven Vertretung (Verknüpfung zwischen
// Vertretungsliste, Vorschlag, Abwesenheiten und Tagesplänen), API-Pfade, Rückfragen und Datumshilfen.
import { useState } from 'react';
import { create } from 'zustand';
import { api, type AnfrageOptionen } from '@/api/client';
import type { ServerFrage } from '@/api/typen';
import { beiDokumentwechsel } from '@/kern/dokument';
import { melden, type VertretungsAuswahl } from '@/kern/ereignisse';
import { zustand } from '@/kern/zustand';
import { StandardDialog, dialogZeigen } from '@/komponenten/dialoge';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';

export const TAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** Pfad unterhalb der Vertretungsplanung des geöffneten Dokuments. */
export const vpfad = (p = '') => api.dok(`/vertretung${p}`);

// ---------------------------------------------------------------------------------------------
// Datum

export function isoAus(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const dateAus = (iso: string) => new Date(`${iso}T12:00:00`);
export const plusTage = (iso: string, n: number) => { const d = dateAus(iso); d.setDate(d.getDate() + n); return isoAus(d); };
export const montag = (iso: string) => { const d = dateAus(iso); return plusTage(iso, -((d.getDay() + 6) % 7)); };
export const tagKurz = (iso: string) => TAGE[dateAus(iso).getDay()]!;
/** „02.11.2026“ */
export const datumText = (iso?: string | null) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');
/** „Mo 02.11.26“ wie die Datumsspalten */
export const tagText = (iso?: string | null) => (iso ? `${tagKurz(iso)} ${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(2, 4)}` : '');
export const kurzText = (iso?: string | null) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.` : '');

/** Datumseingabe lesen: „2.11.“, „02.11.26“, „2.11.2026“, „+1“/„-1“ (Tage), ISO, leer = Basis. */
export function datumLesen(text: string | null | undefined, basis: string): string {
  const t = String(text ?? '').trim().replace(/^(Mo|Di|Mi|Do|Fr|Sa|So)\s+/i, '');
  if (!t) return basis;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  if (/^[+-]\d+$/.test(t)) return plusTage(basis, Number(t));
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?$/);
  if (!m) throw new Error(`Das Datum „${text}“ ist ungültig.`);
  let jahr = m[3] ? Number(m[3]) : dateAus(basis).getFullYear();
  if (jahr < 100) jahr += 2000;
  const d = new Date(jahr, Number(m[2]) - 1, Number(m[1]), 12);
  if (d.getMonth() !== Number(m[2]) - 1) throw new Error(`Das Datum „${text}“ ist ungültig.`);
  return isoAus(d);
}

export const useVertretung = create<{ datum: string | null }>(() => ({ datum: null }));
/** Aktuelles Planungsdatum (ISO). */
export const planungsdatum = () => useVertretung.getState().datum;
export const usePlanungsdatum = () => useVertretung((s) => s.datum);

const speicherSchluessel = () => `vertretung.datum.${zustand().dokument?.id || ''}`;

let tageswechselLaeuft: { schluessel: string; p: Promise<unknown> } | null = null;

/** Vertretungen eines Zeitraums aktualisieren (Probeberechnung auf dem Server, Änderung nur bei Bedarf). */
export async function tageswechsel(von: string, bis: string): Promise<unknown> {
  const schluessel = `${von}/${bis}`;
  if (tageswechselLaeuft?.schluessel === schluessel) return tageswechselLaeuft.p;
  const p = api.post(vpfad('/aktualisieren'), { von, bis }).catch((e) => { if (e?.status !== 403) fehlerMelden(e); return null; });
  tageswechselLaeuft = { schluessel, p };
  try { return await p; } finally { if (tageswechselLaeuft?.p === p) tageswechselLaeuft = null; }
}

/**
 * Planungsdatum setzen: alle verknüpften Ansichten folgen (Ereignis „vertretung.datum“). Im Vertretungsmodus werden beim
 * Tageswechsel die Vertretungen aus Absenzen, Veranstaltungen und Klausuren berechnet (nur wenn sich etwas ändert).
 */
export async function datumSetzen(neu: string | null | undefined, { aktualisieren = true } = {}): Promise<void> {
  if (!neu) return;
  const gleich = neu === planungsdatum();
  useVertretung.setState({ datum: neu });
  try { sessionStorage.setItem(speicherSchluessel(), neu); } catch { /* privat */ }
  const z = zustand();
  if (aktualisieren && z.modus === 'vertretung' && z.dokument && z.benutzer?.darfSchreiben) await tageswechsel(neu, neu);
  if (!gleich) melden('vertretung.datum', neu);
}

/** Startdatum beim Öffnen eines Dokuments: zuletzt benutztes Datum der Sitzung bzw. heute / nächster Unterrichtstag. */
export async function datumInitialisieren(): Promise<void> {
  if (!zustand().dokument) { useVertretung.setState({ datum: null }); return; }
  let gemerkt: string | null = null;
  try { gemerkt = sessionStorage.getItem(speicherSchluessel()); } catch { /* privat */ }
  const start = gemerkt || (await api.get<{ datum: string }>(vpfad('/start'))).datum;
  await datumSetzen(start, { aktualisieren: false });
  melden('vertretung.datum', start);
}

export async function blaettern(richtung: number, woche = false): Promise<void> {
  const d = planungsdatum();
  if (!d) return;
  const r = await api.get<{ datum: string }>(vpfad(`/blaettern?datum=${d}&richtung=${richtung}&woche=${woche}`));
  await datumSetzen(r.datum);
}

// ---------------------------------------------------------------------------------------------
// Auswahl der aktiven Vertretung

let auswahl: VertretungsAuswahl | null = null;
export function auswahlMelden(a: VertretungsAuswahl | null) { auswahl = a; melden('vertretung.auswahl', a); }
export const aktuelleAuswahl = () => auswahl;

beiDokumentwechsel(() => { auswahl = null; datumInitialisieren().catch(() => {}); });

// ---------------------------------------------------------------------------------------------
// Rückfragen: Server antwortet { frage: { schluessel, text, optionen } }, die Anfrage wird mit der Antwort wiederholt.

function Rueckfrage({ f, schliessen }: { f: ServerFrage; schliessen: (w: number | null) => void }) {
  const knoepfe = f.optionen.map((o, i) => ({ text: o, wert: i, primaer: i === 0 }));
  if (f.optionen.length > 2) knoepfe.push({ text: 'Abbrechen', wert: null as unknown as number, primaer: false });
  const [breite] = useState(f.optionen.some((o) => o.length > 20) ? '560px' : undefined);
  return (
    <StandardDialog<number> titel="Rückfrage" breite={breite} knoepfe={knoepfe} beiKnopf={schliessen}>
      {f.text.split('\n').map((z, i) => (z ? <p key={i} style={{ margin: '0 0 8px 0' }}>{z}</p> : <br key={i} />))}
    </StandardDialog>
  );
}

export const rueckfrage = (f: ServerFrage) => dialogZeigen<number>((schliessen) => <Rueckfrage f={f} schliessen={schliessen} />);

/** POST mit Rückfragen; liefert die Antwort oder null (abgebrochen). */
export async function mitRueckfragen<T = any>(pfad: string, daten: Record<string, unknown> = {}, optionen: AnfrageOptionen = {}): Promise<T | null> {
  const antworten: Record<string, number> = { ...((daten.antworten as Record<string, number>) || {}) };
  for (let i = 0; i < 8; i++) {
    const r = await api.post<{ frage?: ServerFrage; hinweis?: string } & T>(pfad, { ...daten, antworten }, optionen);
    if (!r?.frage) {
      if (r?.hinweis) hinweis(r.hinweis, 'info', 5000);
      return r;
    }
    const w = await rueckfrage(r.frage);
    if (w === null || w === undefined) return null;
    antworten[r.frage.schluessel] = w;
  }
  return null;
}
