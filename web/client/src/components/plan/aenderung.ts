// Änderungstypen der Stundenkarte – gleiche Regeln auf allen Plattformen (design/DESIGN.md, Abschnitt 10 „Stundenkarte (alle Plattformen)“).
// Eine Karte zeigt untereinander Fach (600), Klasse, Lehrkraft und Raum; die Zeile des gezeigten Elements entfällt, solange sie sich nicht
// geändert hat. Jede Änderung ist grün (Feld „+neu (bisher)“ auf der betroffenen Zeile, schraffierte Kante, grüne Fläche), ein Entfall rot
// (alles durchgestrichen, rote Fläche, Feld „× entfällt“). Verlegungen und Zusatzstunden tragen unten ein eigenes Feld:
//   Klasse fehlt               (5b) · × entfällt          Lehrer fehlt ohne Vertretung  (Abr)
//   Vertretungsentfall         × entfällt                 Lehrervertretung              +Gal (Gor)
//   Raumänderung               +105 (303)                 Fachänderung                  +BI (MU)
//   verschoben auf             × auf Di 21.10. 6 | 12:20  verschoben von                ⊕ von Mo 20.10. 3 | 09:45
//   Zusatz                     ⊕ Zusatz                   hinzugekommener Wert          +B070
import type { Karte, Verlegungszeit, Wert } from '../../api/types';
import { datumKurz, wochentagKurz } from '../../lib/datum';
import { abwesendSet, artVon, istEntfall, istOnline, istVerlegung, istZusatz, KEIN_ELEMENT, lehrerAbwesend, verlegungsRichtung, type Typ } from './logik';

export type Ton = 'aenderung' | 'entfall';

/** Teil einer Kartenzeile: Text oder Feld (Chip) in der Status-Tönung. */
export interface Teil { text: string; feld?: Ton; titel?: string }
export type ZeilenArt = 'fach' | 'klassen' | 'lehrer' | 'raeume';
export interface Kartenzeile { art: ZeilenArt; teile: Teil[]; geaendert: boolean }

export type Aenderungstyp =
  | 'klasse-fehlt' | 'lehrer-fehlt' | 'vertretungsentfall' | 'entfall' | 'lehrervertretung' | 'raumaenderung' | 'fachaenderung'
  | 'verschoben-auf' | 'verschoben-von' | 'zusatz' | 'hinzugefuegt' | 'klassenaenderung';

export interface Statusfeld { text: string; ton: Ton; zeichen: '×' | '⊕'; titel: string }

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

/** Verlegungsziel bzw. -ursprung wie im Enbrea-Muster: „Di 21.10. 6 | 12:20“. */
export function verlegungKurz(v: Verlegungszeit | null | undefined): string {
  if (!v?.datum) return '';
  const tag = `${wochentagKurz(v.datum)} ${datumKurz(v.datum)}`;
  const std = v.stunde > 0 ? ` ${v.stunde}` : '';
  return `${tag}${std}${v.beginn ? ` | ${v.beginn}` : ''}`;
}

const gleich = (a: string | null | undefined, b: string | null | undefined) => (a || '').toLowerCase() === (b || '').toLowerCase();

/** Ein Wert als Teil: unverändert Text, ersetzt „+neu (bisher)“, hinzugekommen „+neu“, fehlend „(bisher)“, offen „?“. */
export function wertTeil(w: Wert, { entfall, abwesend, zusatzLehrer = false }: { entfall: boolean; abwesend?: Set<string>; zusatzLehrer?: boolean }): Teil {
  const k = KEIN_ELEMENT.test(w.k || '') ? '' : w.k || '';
  const alt = KEIN_ELEMENT.test(w.alt || '') ? '' : w.alt || '';
  if (abwesend?.has(k.toLowerCase())) return { text: `(${k})`, feld: entfall ? 'entfall' : 'aenderung', titel: `${k} fehlt` };
  if (entfall) return { text: k || alt };
  if (zusatzLehrer) return { text: k || alt };
  if (alt && k && !gleich(alt, k)) return { text: `+${k} (${alt})`, feld: 'aenderung', titel: `${k} statt ${alt}` };
  if (alt && !k) return { text: `(${alt})`, feld: 'aenderung', titel: `${alt} fehlt – noch ohne Vertretung` };
  if (!k && w.neu) return { text: '?', feld: 'aenderung', titel: 'Vertretung offen' };
  if (k && w.neu && !alt) return { text: `+${k}`, feld: 'aenderung', titel: `${k} hinzugekommen` };
  return { text: k || alt };
}

const zeile = (art: ZeilenArt, teile: Teil[]): Kartenzeile => ({ art, teile, geaendert: teile.some(t => t.feld) });

/**
 * Kartenbild einer Stunde: Zeilen (Fach, Klasse, Lehrkraft, Raum) mit Feldern, Tönung und Statusfeld nach den gemeinsamen Regeln.
 * `typ` ist die Planart (die Zeile des gezeigten Elements entfällt, solange sie unverändert ist).
 */
export function kartenbild(k: Karte, typ: Typ): Kartenbild {
  const entfall = istEntfall(k, typ);
  const abw = abwesendSet(k);
  const typen: Aenderungstyp[] = [];
  const verlegt = istVerlegung(k) && k.status !== 'klausur' && k.status !== 'veranstaltung';
  const richtung = verlegt ? verlegungsRichtung(k, typ) : null;
  const zusatz = !verlegt && istZusatz(k) && k.status !== 'veranstaltung';
  const optionen = { entfall, abwesend: abw };
  const teile = (l: Wert[] | null | undefined, extra: Partial<typeof optionen> & { zusatzLehrer?: boolean } = {}) =>
    (l || []).filter(w => w.k || w.alt || w.neu).map(w => wertTeil(w, { ...optionen, ...extra }));

  const zeilen: Kartenzeile[] = [];
  // Fach (bzw. Anlass einer Veranstaltung)
  if (k.fach) zeilen.push(zeile('fach', k.fachAlt && !entfall && !gleich(k.fachAlt, k.fach)
    ? [{ text: `+${k.fach} (${k.fachAlt})`, feld: 'aenderung', titel: `${k.fach} statt ${k.fachAlt}` }] : [{ text: k.fach }]));
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
  const raeume = istOnline(k, typ) ? [] : teile(k.raeume);
  if (raeume.length && (typ !== 'raum' || raeume.some(t => t.feld))) zeilen.push(zeile('raeume', raeume));

  // Änderungstypen (Legende, Bildschirmleser)
  if (abw.size) typen.push('klasse-fehlt');
  if (k.fachAlt && !entfall) typen.push('fachaenderung');
  if (!entfall) {
    if (lehrer.some(t => t.feld && t.text.startsWith('('))) typen.push('lehrer-fehlt');
    if (lehrer.some(t => t.feld && t.text.startsWith('+') && t.text.includes('('))) typen.push('lehrervertretung');
    if (raeume.some(t => t.feld && t.text.startsWith('+') && t.text.includes('('))) typen.push('raumaenderung');
    if ([...lehrer, ...raeume, ...klassen, ...mit].some(t => t.feld && t.text.startsWith('+') && !t.text.includes('('))) typen.push('hinzugefuegt');
  }

  let status: Statusfeld | null = null;
  if (richtung === 'von' || (verlegt && entfall)) {
    const ziel = verlegungKurz(k.verlegungNach);
    status = { text: ziel ? `auf ${ziel}` : 'verschoben', ton: 'entfall', zeichen: '×', titel: ziel ? `Verschoben auf ${ziel}` : 'Verschoben' };
    typen.push('verschoben-auf');
  } else if (entfall) {
    status = { text: 'entfällt', ton: 'entfall', zeichen: '×', titel: 'Die Stunde entfällt' };
    if (!abw.size) typen.push(k.status === 'abwesend' || /vertret/i.test(k.art || '') ? 'vertretungsentfall' : 'entfall');
  } else if (richtung === 'nach') {
    const von = verlegungKurz(k.verlegungVon);
    status = { text: von ? `von ${von}` : 'verschoben', ton: 'aenderung', zeichen: '⊕', titel: von ? `Verschoben von ${von}` : 'Hierher verschoben' };
    typen.push('verschoben-von');
  } else if (zusatz) {
    status = { text: 'Zusatz', ton: 'aenderung', zeichen: '⊕', titel: 'Zusätzliche Unterrichtsstunde' };
    typen.push('zusatz');
  }

  const art = artVon(k, typ);
  const geaendert = zeilen.some(z => z.geaendert) || !!status || art === 'aenderung' || art === 'abwesend';
  const ton: Ton | null = entfall ? 'entfall' : k.status === 'klausur' || k.status === 'veranstaltung' || k.status === 'buchung' || k.status === 'vorgemerkt'
    ? (zeilen.some(z => z.geaendert) ? 'aenderung' : null) : geaendert ? 'aenderung' : null;
  return { ton, entfall, zeilen, status, typen };
}

/** Text einer Zeile (Tooltips, Bildschirmleser). */
export const zeilenText = (z: Kartenzeile) => z.teile.map(t => t.text).join(', ');

/** Muster der Legende „Änderungstyp | Darstellung“ – dieselben Zeilen wie im Enbrea-Leitfaden, in EduOrga-Farben. */
export interface Legendeneintrag { id: Aenderungstyp | 'mitteilung' | 'regulaer'; titel: string; text: string; ton: Ton | null; zeilen: Teil[][]; status?: Statusfeld; notiz?: string }

export const LEGENDE_EINTRAEGE: Legendeneintrag[] = [
  { id: 'regulaer', titel: 'Unterricht', text: 'Helle Karte mit grauer Kante; hat das Fach eine Farbe, sind Kante und Fläche leicht in der Fachfarbe.', ton: null,
    zeilen: [[{ text: 'D' }], [{ text: '6b' }], [{ text: 'Kre' }], [{ text: '023' }]] },
  { id: 'klasse-fehlt', titel: 'Klasse fehlt', text: 'Die Klasse ist abwesend, die Stunde entfällt.', ton: 'entfall',
    zeilen: [[{ text: 'NAWI' }], [{ text: '(5b)', feld: 'entfall' }], [{ text: 'Maq' }], [{ text: '122' }]], status: { text: 'entfällt', ton: 'entfall', zeichen: '×', titel: '' } },
  { id: 'lehrer-fehlt', titel: 'Lehrkraft fehlt, keine Vertretung erstellt', text: 'Die Stunde ist noch offen; die fehlende Lehrkraft steht in Klammern.', ton: 'aenderung',
    zeilen: [[{ text: 'E4' }], [{ text: '12' }], [{ text: '(Abr)', feld: 'aenderung' }], [{ text: '21' }]] },
  { id: 'vertretungsentfall', titel: 'Vertretungsentfall', text: 'Die Stunde entfällt (z. B. weil die Lehrkraft fehlt) – alles durchgestrichen, rot.', ton: 'entfall',
    zeilen: [[{ text: 'E' }], [{ text: '7c' }], [{ text: 'Had' }], [{ text: '403' }]], status: { text: 'entfällt', ton: 'entfall', zeichen: '×', titel: '' } },
  { id: 'lehrervertretung', titel: 'Lehrervertretung', text: 'Neue Lehrkraft, dahinter in Klammern die bisherige.', ton: 'aenderung',
    zeilen: [[{ text: 'SP1' }], [{ text: '6b' }], [{ text: '+Gal (Gor)', feld: 'aenderung' }], [{ text: 'UH' }]] },
  { id: 'raumaenderung', titel: 'Raumänderung', text: 'Neuer Raum, dahinter in Klammern der bisherige.', ton: 'aenderung',
    zeilen: [[{ text: 'BILI' }], [{ text: '6b' }], [{ text: 'Abr' }], [{ text: '+105 (303)', feld: 'aenderung' }]] },
  { id: 'fachaenderung', titel: 'Fachänderung', text: 'Neues Fach, dahinter in Klammern das bisherige.', ton: 'aenderung',
    zeilen: [[{ text: '+BI (MU)', feld: 'aenderung' }], [{ text: '6b' }], [{ text: 'Kre' }], [{ text: '023' }]] },
  { id: 'verschoben-auf', titel: 'Verschoben auf einen anderen Termin', text: 'Die Stunde findet hier nicht statt, sondern am genannten Tag (Stunde | Beginn).', ton: 'entfall',
    zeilen: [[{ text: 'M' }], [{ text: '10e' }], [{ text: 'Rth' }], [{ text: '126' }]], status: { text: 'auf Di 21.10. 6 | 12:20', ton: 'entfall', zeichen: '×', titel: '' } },
  { id: 'verschoben-von', titel: 'Verschoben von einem anderen Termin', text: 'Die Stunde ist hierher verlegt worden.', ton: 'aenderung',
    zeilen: [[{ text: 'M' }], [{ text: '10e' }], [{ text: 'Rth' }], [{ text: '126' }]], status: { text: 'von Mo 20.10. 3 | 09:45', ton: 'aenderung', zeichen: '⊕', titel: '' } },
  { id: 'zusatz', titel: 'Zusatzunterricht', text: 'Zusätzliche Stunde, die nicht im Regelplan steht.', ton: 'aenderung',
    zeilen: [[{ text: 'BI' }], [{ text: '5e, 11' }], [{ text: 'Abr' }], [{ text: '03' }]], status: { text: 'Zusatz', ton: 'aenderung', zeichen: '⊕', titel: '' } },
  { id: 'mitteilung', titel: 'Mitteilung', text: 'Hinweis der Schule zum Tag als helle gelbe Notiz.', ton: null, zeilen: [], notiz: 'Aufbau der Bühne ab 16:00 Uhr' },
];
