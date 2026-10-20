// Daten der Plantafel (GET /planung/plantafel): Zeilen, Unterrichte mit offenen Blöcken, verplante Stunden. Daraus entstehen Karten
// (zusammenhängende Stunden eines Unterrichts an einem Tag = Block bzw. Doppelstunde), je Zeile mit Spuren für gleichzeitige Stunden
// (A-/B-Woche, Kollisionen), und der Vorrat (offene Blöcke). Zielstufen beim Ziehen (GET /planung/plantafel/ziele) werden je
// Ziehbeginn einmal geladen und bis zur nächsten Änderung zwischengespeichert.
import { api } from '@/api/client';
import type { Zeitraster } from '@/api/typen';

export type TafelTyp = 'klasse' | 'lehrer' | 'raum';
export type Stufe = 'frei' | 'tausch' | 'weich' | 'hart' | 'eigen';

export interface TafelZeile { id: number; kurz: string; lang: string; gruppe: string }
export interface TafelUZeile { fach: string; farbe: string | null; lehrer: number | null; klassen: number[] }
export interface TafelUnterricht {
  u: number; fach: string; fachLang: string; farbe: string | null; zeilen: TafelUZeile[]; lehrer: number[]; klassen: number[];
  wst: number; offen: number[]; text: string; woche: string | null; band: string; fix: boolean;
  /** bevorzugte Räume bzw. Raumgruppen je Kopplungszeile (Fachraum vor Stammraum) */
  wunsch?: { art: string; raum: number | null; gruppe: number | null }[];
}
export interface TafelStunde { u: number; tag: number; stunde: number; fix: boolean; raeume: number[] }
export interface TafelDaten {
  typ: TafelTyp; periode: string; zeitraster: Zeitraster; zeilen: TafelZeile[];
  namen: { klassen: Record<string, string>; lehrer: Record<string, string>; raeume: Record<string, string>; raumgruppen?: Record<string, string> };
  /** Räume je Raumgruppe */
  raumgruppen?: Record<string, number[]>;
  unterrichte: TafelUnterricht[]; stunden: TafelStunde[];
}

/** Zusammenhängende Stunden eines Unterrichts an einem Tag (Einzelstunde, Doppelstunde, Block). */
export interface Karte { key: string; u: number; tag: number; von: number; laenge: number; fix: boolean; teilFix: boolean; raeume: number[] }
export interface Belegung { karte: Karte; spur: number }

export interface Aufbereitet {
  uMap: Map<number, TafelUnterricht>;
  karten: Karte[];
  kartenVon: Map<number, Karte[]>;
  jeZeile: Map<number, Belegung[]>;
  spuren: Map<number, number>;
  /** Zeilen (Ids), in denen ein Unterricht steht – Klassen bzw. Lehrkräfte des Unterrichts, Räume seiner verplanten Stunden */
  zeilenVon: (u: number) => number[];
  /** Kurse desselben Bandes (der Unterricht selbst zuerst); ohne Band nur er */
  bandVon: (u: number) => number[];
  /** Zeilen aller Kurse des Bandes */
  zeilenVonBand: (u: number) => number[];
  stundenProTag: number;
  tage: number;
  verplant: number;
  offen: number;
}

export const slot = (tag: number, stunde: number, stundenProTag: number) => tag * stundenProTag + (stunde - 1);

export function aufbereiten(d: TafelDaten, typ: TafelTyp): Aufbereitet {
  const uMap = new Map(d.unterrichte.map((u) => [u.u, u]));
  const S = d.zeitraster.stunden.length;
  // Stunden je Unterricht und Tag zu Blöcken zusammenfassen
  const gruppen = new Map<string, TafelStunde[]>();
  for (const st of d.stunden) {
    const k = `${st.u}:${st.tag}`;
    const l = gruppen.get(k);
    if (l) l.push(st); else gruppen.set(k, [st]);
  }
  const karten: Karte[] = [];
  for (const l of gruppen.values()) {
    l.sort((a, b) => a.stunde - b.stunde);
    let i = 0;
    while (i < l.length) {
      let j = i + 1;
      while (j < l.length && l[j]!.stunde === l[j - 1]!.stunde + 1) j++;
      const teil = l.slice(i, j);
      const raeume = [...new Set(teil.flatMap((x) => x.raeume))];
      karten.push({
        key: `${teil[0]!.u}:${teil[0]!.tag}:${teil[0]!.stunde}`, u: teil[0]!.u, tag: teil[0]!.tag, von: teil[0]!.stunde, laenge: teil.length,
        fix: teil.every((x) => x.fix) || !!uMap.get(teil[0]!.u)?.fix, teilFix: teil.some((x) => x.fix), raeume,
      });
      i = j;
    }
  }
  const kartenVon = new Map<number, Karte[]>();
  for (const k of karten) { const l = kartenVon.get(k.u); if (l) l.push(k); else kartenVon.set(k.u, [k]); }

  const zeilenVonKarte = (k: Karte): number[] => {
    const u = uMap.get(k.u);
    if (!u) return [];
    return typ === 'klasse' ? u.klassen : typ === 'lehrer' ? u.lehrer : k.raeume;
  };
  const zeilenVon = (uid: number): number[] => {
    const u = uMap.get(uid);
    if (!u) return [];
    if (typ === 'klasse') return u.klassen;
    if (typ === 'lehrer') return u.lehrer;
    return [...new Set((kartenVon.get(uid) || []).flatMap((k) => k.raeume))];
  };

  // Belegung je Zeile mit Spuren: gleichzeitige Karten (A-/B-Woche, Kollision) liegen untereinander
  const roh = new Map<number, Karte[]>();
  for (const k of karten) for (const z of zeilenVonKarte(k)) { const l = roh.get(z); if (l) l.push(k); else roh.set(z, [k]); }
  const jeZeile = new Map<number, Belegung[]>();
  const spuren = new Map<number, number>();
  for (const [z, l] of roh) {
    l.sort((a, b) => slot(a.tag, a.von, S) - slot(b.tag, b.von, S) || b.laenge - a.laenge || a.u - b.u);
    const ende: number[] = []; // je Spur: erster freier Platz
    const erg: Belegung[] = [];
    for (const k of l) {
      const a = slot(k.tag, k.von, S);
      let sp = ende.findIndex((e) => e <= a);
      if (sp < 0) { sp = ende.length; ende.push(0); }
      ende[sp] = a + k.laenge;
      erg.push({ karte: k, spur: sp });
    }
    jeZeile.set(z, erg);
    spuren.set(z, Math.max(1, ende.length));
  }
  const offen = d.unterrichte.reduce((x, u) => x + u.offen.reduce((a, b) => a + b, 0), 0);
  const baender = new Map<string, number[]>();
  for (const u of d.unterrichte) { const b = u.band?.trim(); if (!b) continue; const l = baender.get(b); if (l) l.push(u.u); else baender.set(b, [u.u]); }
  const bandVon = (uid: number): number[] => {
    const b = uMap.get(uid)?.band?.trim();
    const l = b ? baender.get(b) : undefined;
    return l && l.length > 1 ? [uid, ...l.filter((x) => x !== uid)] : [uid];
  };
  const zeilenVonBand = (uid: number) => [...new Set(bandVon(uid).flatMap(zeilenVon))];
  return { uMap, karten, kartenVon, jeZeile, spuren, zeilenVon, bandVon, zeilenVonBand, stundenProTag: S, tage: d.zeitraster.tage.length, verplant: d.stunden.length, offen };
}

const kurzListe = (ids: number[], namen: Record<string, string>) => ids.map((i) => namen[String(i)] || '?').join(', ');

/** Beschriftung einer Karte in einer Zeile: Fach (bei Kopplung die Fächer dieser Zeile), zweite Zeile, Farbe, Kurzinfo. */
export function kartenText(u: TafelUnterricht, typ: TafelTyp, zeile: number | null, d: TafelDaten, k?: Karte) {
  const passend = zeile == null ? u.zeilen
    : typ === 'klasse' ? u.zeilen.filter((z) => z.klassen.includes(zeile))
      : typ === 'lehrer' ? u.zeilen.filter((z) => z.lehrer === zeile) : u.zeilen;
  const zl = passend.length ? passend : u.zeilen;
  const faecher = [...new Set(zl.map((z) => z.fach).filter(Boolean))];
  const fach = faecher.join('/') || u.fach || '—';
  const farbe = zl.find((z) => z.farbe)?.farbe ?? u.farbe;
  const lehrer = [...new Set(zl.map((z) => z.lehrer).filter((x): x is number => x != null))];
  const klassen = [...new Set(zl.flatMap((z) => z.klassen))];
  const zweit = typ === 'klasse' ? kurzListe(lehrer, d.namen.lehrer) : kurzListe(klassen, d.namen.klassen);
  const gekoppelt = typ === 'klasse' ? u.klassen.length > 1 || u.lehrer.length > 1 : typ === 'lehrer' ? u.lehrer.length > 1 || u.klassen.length > 1 : u.zeilen.length > 1;
  const zeilenTitel = [
    `U-Nr. ${u.u} · ${u.fachLang && u.fachLang !== u.fach ? `${u.fach} (${u.fachLang})` : fach}`,
    `Klassen: ${kurzListe(u.klassen, d.namen.klassen) || '–'}`,
    `Lehrkräfte: ${kurzListe(u.lehrer, d.namen.lehrer) || '–'}`,
    k ? `Raum: ${kurzListe(k.raeume, d.namen.raeume) || '–'}` : '',
    k ? `${d.zeitraster.tage[k.tag]?.lang ?? ''} ${k.von}.${k.laenge > 1 ? `–${k.von + k.laenge - 1}.` : ''} Stunde${k.laenge === 2 ? ' (Doppelstunde)' : k.laenge > 2 ? ` (${k.laenge}er-Block)` : ''}` : '',
    gekoppelt ? 'gekoppelt' : '',
    u.band ? `Band ${u.band} – wandert mit den übrigen Kursen` : '',
    u.woche ? `Woche ${u.woche}` : '',
    k?.fix ? 'fixiert' : '',
    u.text,
  ].filter(Boolean);
  return { fach, zweit, farbe, gekoppelt: gekoppelt || !!u.band?.trim(), titel: zeilenTitel.join('\n') };
}

export interface Ziele { u: number; stufen: Stufe[][]; gruende: string[][]; laenge: number; versatz: number; /** mitziehende Kurse des Bandes */ band?: number[] }
export interface ZiehAngabe { u: number; tag?: number; stunde?: number; einzeln?: boolean; laenge?: number }

let cacheVersion = -1;
const cache = new Map<string, Promise<Ziele>>();

/** Zielstufen für einen Ziehvorgang (verplante Stunde bzw. offener Block); gleiche Anfragen derselben Datenfassung aus dem Speicher. */
export function zieleLaden(z: ZiehAngabe, version: number): Promise<Ziele> {
  if (version !== cacheVersion) { cache.clear(); cacheVersion = version; }
  const q = new URLSearchParams({ unterricht: String(z.u) });
  if (z.tag !== undefined && z.stunde !== undefined) { q.set('tag', String(z.tag)); q.set('stunde', String(z.stunde)); if (z.einzeln) q.set('einzeln', 'true'); } else q.set('laenge', String(z.laenge || 1));
  const k = q.toString();
  let p = cache.get(k);
  if (!p) {
    p = api.get<Omit<Ziele, 'u'>>(api.dok(`/planung/plantafel/ziele?${k}`)).then((x) => ({ ...x, u: z.u }));
    p.catch(() => cache.delete(k));
    cache.set(k, p);
  }
  return p;
}

export const STUFENTEXT: Record<Stufe, string> = {
  frei: 'frei', tausch: 'Tausch möglich', weich: 'möglich mit Hinweis', hart: 'belegt bzw. gesperrt', eigen: 'aktuelle Lage',
};
