// Änderungstypen der Stundenkarte – gleiche Regeln auf allen Plattformen (design/DESIGN.md, Abschnitt 10 „Stundenkarte (alle Plattformen)“).
// Eine Karte zeigt untereinander Fach (600), Klasse, Lehrkraft und Raum; die Zeile des gezeigten Elements entfällt, solange sie sich nicht
// geändert hat. EduOrga-Kennzeichnung: jede Änderung grün (3-px-Leiste links, Kennzeichen am Rand, Tag auf der betroffenen Zeile), Entfall
// rot (alles durchgestrichen, Tag „entfällt“), offene Vertretung neutral. Tags (eigene Wortwahl):
//   Lehrervertretung  „Gal ← Gor“         Raumänderung  „105 ← 303“            Fachänderung  „BI ← MU“
//   Lehrkraft fehlt   „Abr fehlt“ (Kollegium) bzw. „Vertretung folgt“            Klasse fehlt  „5b fehlt“
//   hinzugekommen     „neu B070“          Entfall „entfällt“   Zusatzstunde „zusätzlich“
//   verlegt           „verlegt → Di 21.10., 6. Std“ (hier entfallen) bzw. „verlegt ← Mo 20.10., 3. Std“ (hierher)
import type { Karte, Verlegungszeit, Wert } from '../../api/types';
import { datumKurz, wochentagKurz } from '../../lib/datum';
import { abwesendSet, artVon, istEntfall, istOnline, istVerlegung, istZusatz, KEIN_ELEMENT, lehrerAbwesend, verlegungsRichtung, type Typ } from './logik';

/** Status-Tönung: grün (Änderung), rot (nur Entfall), neutral grau (offene Vertretung – „Vertretung folgt“, nie rot). */
export type Ton = 'aenderung' | 'entfall' | 'offen';

/** Teil einer Kartenzeile: Text oder Feld (Chip) in der Status-Tönung. */
export interface Teil { text: string; feld?: Ton; titel?: string }
export type ZeilenArt = 'fach' | 'klassen' | 'lehrer' | 'raeume';
export interface Kartenzeile { art: ZeilenArt; teile: Teil[]; geaendert: boolean }

export type Aenderungstyp =
  | 'klasse-fehlt' | 'lehrer-fehlt' | 'vertretungsentfall' | 'entfall' | 'lehrervertretung' | 'raumaenderung' | 'fachaenderung'
  | 'verschoben-auf' | 'verschoben-von' | 'zusatz' | 'hinzugefuegt' | 'klassenaenderung';

export interface Statusfeld { text: string; ton: Ton; titel: string }

export interface Kartenbild {
  /** Tönung der Karte: grün (Änderung), rot (Entfall) bzw. keine. */
  ton: Ton | null;
  /** Entfall: alles durchgestrichen. */
  entfall: boolean;
  zeilen: Kartenzeile[];
  /** Feld unten auf der Karte (Entfall, Verlegung, Zusatz). */
  status: Statusfeld | null;
  typen: Aenderungstyp[];
}

/** Block einer Veranstaltung bzw. eines Termins (warmes Neutral, ohne Kante): Status Veranstaltung oder Stunde ohne Fach und Unterricht mit Anlass. */
export const istTerminBlock = (k: Karte) => k.status === 'veranstaltung' || (!k.fach && !k.unterricht && !!(k.text || '').trim() && k.status !== 'entfall');

/** Verlegungsziel bzw. -ursprung: „Di 21.10., 6. Std“ (ohne Stunde mit Uhrzeit „Di 21.10., 12:20“). */
export function verlegungKurz(v: Verlegungszeit | null | undefined): string {
  if (!v?.datum) return '';
  const tag = `${wochentagKurz(v.datum)} ${datumKurz(v.datum)}`;
  return v.stunde > 0 ? `${tag}, ${v.stunde}. Std` : v.beginn ? `${tag}, ${v.beginn}` : tag;
}

const gleich = (a: string | null | undefined, b: string | null | undefined) => (a || '').toLowerCase() === (b || '').toLowerCase();

/** Ein Wert als Teil: unverändert Text, ersetzt „neu ← bisher“, hinzugekommen „neu B070“, fehlend „bisher fehlt“. */
export function wertTeil(w: Wert, { entfall, abwesend, zusatzLehrer = false, kollegium = true, praefix = '' }: { entfall: boolean; abwesend?: Set<string>; zusatzLehrer?: boolean; kollegium?: boolean; praefix?: string }): Teil {
  const k = KEIN_ELEMENT.test(w.k || '') ? '' : w.k || '';
  const alt = KEIN_ELEMENT.test(w.alt || '') ? '' : w.alt || '';
  if (abwesend?.has(k.toLowerCase())) return { text: `${k} fehlt`, feld: entfall ? 'entfall' : 'aenderung', titel: `Klasse ${k} fehlt` };
  if (entfall) return { text: k || alt };
  if (zusatzLehrer) return { text: k || alt };
  if (alt && k && !gleich(alt, k)) return { text: `${k} ← ${alt}`, feld: 'aenderung', titel: `${praefix}${k} statt ${alt}` };
  // Offene Vertretung: neutral (nie rot) – Kollegium sieht die fehlende Lehrkraft „(Abr)“, Schüler*innen und Eltern „Vertretung folgt“
  if (alt && !k) return kollegium ? { text: `${alt} fehlt`, feld: 'offen', titel: `${alt} fehlt – Vertretung folgt` } : { text: 'Vertretung folgt', feld: 'offen', titel: 'Vertretung folgt' };
  if (!k && w.neu) return { text: kollegium ? '?' : 'Vertretung folgt', feld: 'offen', titel: 'Vertretung folgt' };
  if (k && w.neu && !alt) return { text: `neu ${k}`, feld: 'aenderung', titel: `${praefix}${k} neu hinzugekommen` };
  return { text: k || alt };
}

const zeile = (art: ZeilenArt, teile: Teil[]): Kartenzeile => ({ art, teile, geaendert: teile.some(t => t.feld) });

/**
 * Kartenbild einer Stunde: Zeilen (Fach, Klasse, Lehrkraft, Raum) mit Feldern, Tönung und Statusfeld nach den gemeinsamen Regeln.
 * `typ` ist die Planart (die Zeile des gezeigten Elements entfällt, solange sie unverändert ist).
 */
export function kartenbild(k: Karte, typ: Typ, { kollegium = true }: { kollegium?: boolean } = {}): Kartenbild {
  const entfall = istEntfall(k, typ);
  const abw = abwesendSet(k);
  const typen: Aenderungstyp[] = [];
  const verlegt = istVerlegung(k) && k.status !== 'klausur' && k.status !== 'veranstaltung';
  const richtung = verlegt ? verlegungsRichtung(k, typ) : null;
  // Veranstaltung ohne Fach (z. B. Projekttag als zusätzliche Stunde): Termin-Block, kein Zusatz
  const terminArtig = istTerminBlock(k);
  const zusatz = !verlegt && !terminArtig && istZusatz(k) && k.status !== 'veranstaltung';
  const optionen = { entfall, abwesend: abw, kollegium };
  const teile = (l: Wert[] | null | undefined, extra: Partial<typeof optionen> & { zusatzLehrer?: boolean; praefix?: string } = {}) =>
    (l || []).filter(w => w.k || w.alt || w.neu).map(w => wertTeil(w, { ...optionen, ...extra }));

  const zeilen: Kartenzeile[] = [];
  // Fach (bzw. Anlass einer Veranstaltung)
  if (k.fach) zeilen.push(zeile('fach', k.fachAlt && !entfall && !gleich(k.fachAlt, k.fach)
    ? [{ text: `${k.fach} ← ${k.fachAlt}`, feld: 'aenderung', titel: `Fach ${k.fach} statt ${k.fachAlt}` }] : [{ text: k.fach }]));
  else zeilen.push(zeile('fach', [{ text: k.text || k.art || '—' }]));

  // Klasse: im Klassenplan nur, wenn sie fehlt bzw. gekoppelte Klassen dabei sind
  const klassen = teile(k.klassen);
  const mit = teile(k.mitklassen);
  const klassenTeile = typ === 'klasse' ? [...klassen.filter(t => t.feld), ...(entfall ? [] : mit)] : [...klassen, ...mit];
  if (klassenTeile.length) zeilen.push(zeile('klassen', klassenTeile));

  // Lehrkraft: im Lehrerplan nur, wenn sie sich geändert hat (Vertretung, eigene Stunde wird von anderen gehalten)
  const lehrer = teile(lehrerAbwesend(k, typ) ? (k.lehrer || []).filter(w => w.alt || w.k) : k.lehrer, { zusatzLehrer: zusatz && !!k.zusaetzlich && !k.vertretungOffen });
  if (lehrer.length && (typ !== 'lehrer' || lehrer.some(t => t.feld) || lehrer.length > 1)) zeilen.push(zeile('lehrer', lehrer));

  // Raum: online kein Raum; im Raumplan nur, wenn er sich geändert hat
  const raeume = istOnline(k, typ) ? [] : teile(k.raeume, { praefix: 'Raum ' });   // Tag „105 ← 303“, zugänglicher Name „Raum 105 statt 303“
  if (raeume.length && (typ !== 'raum' || raeume.some(t => t.feld))) zeilen.push(zeile('raeume', raeume));

  // Änderungstypen (Legende, Bildschirmleser)
  if (abw.size) typen.push('klasse-fehlt');
  if (k.fachAlt && !entfall) typen.push('fachaenderung');
  if (!entfall) {
    if (lehrer.some(t => t.feld === 'offen')) typen.push('lehrer-fehlt');
    if (lehrer.some(t => t.feld && t.text.includes(' ← '))) typen.push('lehrervertretung');
    if (raeume.some(t => t.feld && t.text.includes(' ← '))) typen.push('raumaenderung');
    if ([...lehrer, ...raeume, ...klassen, ...mit].some(t => t.feld && t.text.startsWith('neu '))) typen.push('hinzugefuegt');
  }

  let status: Statusfeld | null = null;
  if (richtung === 'von' || (verlegt && entfall)) {
    const ziel = verlegungKurz(k.verlegungNach);
    status = { text: ziel ? `verlegt → ${ziel}` : 'verlegt', ton: 'entfall', titel: ziel ? `Verlegt auf ${ziel}` : 'Verlegt' };
    typen.push('verschoben-auf');
  } else if (entfall) {
    status = { text: 'entfällt', ton: 'entfall', titel: 'Die Stunde entfällt' };
    if (!abw.size) typen.push(k.status === 'abwesend' || /vertret/i.test(k.art || '') ? 'vertretungsentfall' : 'entfall');
  } else if (richtung === 'nach') {
    const von = verlegungKurz(k.verlegungVon);
    status = { text: von ? `verlegt ← ${von}` : 'hierher verlegt', ton: 'aenderung', titel: von ? `Verlegt von ${von}` : 'Hierher verlegt' };
    typen.push('verschoben-von');
  } else if (zusatz) {
    status = { text: 'zusätzlich', ton: 'aenderung', titel: 'Zusätzliche Unterrichtsstunde' };
    typen.push('zusatz');
  }

  const art = artVon(k, typ);
  // Nur eine offene Vertretung (sonst nichts geändert): neutrale Karte mit grau gestrichelter Kante
  const nurOffen = !entfall && !status && !k.fachAlt && zeilen.some(z => z.teile.some(t => t.feld === 'offen'))
    && !zeilen.some(z => z.teile.some(t => t.feld && t.feld !== 'offen'));
  const geaendert = zeilen.some(z => z.geaendert) || !!status || art === 'aenderung' || art === 'abwesend';
  const ton: Ton | null = terminArtig && !entfall ? null : nurOffen ? 'offen' : entfall ? 'entfall' : k.status === 'klausur' || k.status === 'veranstaltung' || k.status === 'buchung' || k.status === 'vorgemerkt'
    ? (zeilen.some(z => z.geaendert) ? 'aenderung' : null) : geaendert ? 'aenderung' : null;
  return { ton, entfall, zeilen, status, typen };
}

/** Text einer Zeile (Tooltips, Bildschirmleser). */
export const zeilenText = (z: Kartenzeile) => z.teile.map(t => t.text).join(', ');

/** Kennzeichnungen (Legende) – eigene Gliederung: Gruppe, Beispiel-Tag und Satz; dazu je Gruppe eine Musterkarte. */
export interface Kennzeichen { tag: Teil; satz: string }
export interface Kennzeichengruppe { id: 'unterricht' | 'aenderung' | 'entfall' | 'offen' | 'hinweis'; titel: string; satz: string; ton: Ton | null; muster: Teil[][]; status?: Statusfeld; eintraege: Kennzeichen[] }

export const KENNZEICHNUNGEN: Kennzeichengruppe[] = [
  { id: 'unterricht', titel: 'Unterricht', satz: 'Helle Karte mit grauer Leiste; hat das Fach eine Farbe, sind Leiste und Fläche leicht in der Fachfarbe.', ton: null,
    muster: [[{ text: 'D' }], [{ text: '6b' }], [{ text: 'Kre' }], [{ text: '023' }]], eintraege: [] },
  { id: 'aenderung', titel: 'Geändert', satz: 'Grüne Leiste und Kennzeichen, helle grüne Fläche; das Geänderte steht als Tag auf seiner Zeile.', ton: 'aenderung',
    muster: [[{ text: 'SP' }], [{ text: '6b' }], [{ text: 'Gal ← Gor', feld: 'aenderung' }], [{ text: 'TH1' }]],
    eintraege: [
      { tag: { text: 'Gal ← Gor', feld: 'aenderung' }, satz: 'Vertretung: Gal übernimmt für Gor.' },
      { tag: { text: '105 ← 303', feld: 'aenderung' }, satz: 'Raumänderung: Raum 105 statt 303.' },
      { tag: { text: 'BI ← MU', feld: 'aenderung' }, satz: 'Fachänderung.' },
      { tag: { text: 'neu B070', feld: 'aenderung' }, satz: 'Ein Raum, eine Klasse oder Lehrkraft kommt hinzu.' },
      { tag: { text: 'verlegt ← Mo 20.10., 3. Std', feld: 'aenderung' }, satz: 'Die Stunde wurde hierher verlegt.' },
      { tag: { text: 'zusätzlich', feld: 'aenderung' }, satz: 'Zusätzliche Stunde außerhalb des Regelplans.' },
    ] },
  { id: 'offen', titel: 'Offen', satz: 'Graue Leiste, gestrichelter Rand: die Vertretung ist noch nicht vergeben – die Stunde entfällt nicht.', ton: 'offen',
    muster: [[{ text: 'E' }], [{ text: '7c' }], [{ text: 'Abr fehlt', feld: 'offen' }], [{ text: '403' }]],
    eintraege: [
      { tag: { text: 'Abr fehlt', feld: 'offen' }, satz: 'So sehen es Lehrkräfte.' },
      { tag: { text: 'Vertretung folgt', feld: 'offen' }, satz: 'So steht es für Schüler*innen und Eltern.' },
    ] },
  { id: 'entfall', titel: 'Entfällt', satz: 'Rote Leiste und Kennzeichen, helle rote Fläche, der ganze Inhalt durchgestrichen.', ton: 'entfall',
    muster: [[{ text: 'M' }], [{ text: '10e' }], [{ text: 'Rth' }], [{ text: '126' }]], status: { text: 'entfällt', ton: 'entfall', titel: '' },
    eintraege: [
      { tag: { text: 'entfällt', feld: 'entfall' }, satz: 'Die Stunde findet nicht statt.' },
      { tag: { text: '5b fehlt', feld: 'entfall' }, satz: 'Die Klasse ist abwesend, deshalb entfällt die Stunde.' },
      { tag: { text: 'verlegt → Di 21.10., 6. Std', feld: 'entfall' }, satz: 'Die Stunde findet stattdessen am genannten Termin statt.' },
    ] },
  { id: 'hinweis', titel: 'Hinweise', satz: 'Ohne Leiste, über die betroffenen Stunden.', ton: null,
    muster: [],
    eintraege: [
      { tag: { text: 'Termin' }, satz: 'Veranstaltung oder Termin als ruhiger beiger Block (Titel, Beteiligte, Uhrzeit).' },
      { tag: { text: 'Mitteilung' }, satz: 'Hinweis der Schule zum Tag als helle gelbe Notiz.' },
      { tag: { text: 'Prüfung' }, satz: 'Bernsteinfarbene Linie und Wort „Prüfung“.' },
      { tag: { text: '+2' }, satz: 'Weitere Stunden zur selben Zeit – anklicken zeigt alle.' },
    ] },
];
