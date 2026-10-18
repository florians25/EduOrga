// Fachliche Regeln der Stundenplan-Darstellung (gleich in Wochenraster, Tagesübersicht, Startseite und Stundendetails).
import type { Aufsicht, Karte, PlanTyp, Wert } from '../../api/types';
import { minuten } from '../../lib/datum';

export type Typ = PlanTyp | null | undefined;

export const STATUSTEXT: Record<string, string> = {
  geaendert: 'Änderung', offen: 'Vertretung offen', entfall: 'Entfall', abwesend: 'vertreten', klausur: 'Prüfung',
  bereitschaft: 'Bereitschaft', buchung: 'Raumbuchung', vorgemerkt: 'vorgemerkt', veranstaltung: 'Termin',
};
export const ZUSATZ_TEXT = 'Zusätzl. Unterrichtsstunde';
/** Platzhalter ohne eigenes Element (offene Vertretung, Zusatzstunde ohne Lehrkraft). */
export const KEIN_ELEMENT = /^(-{3}|\?{3}|\+{1,3})$/;

/** Lehrkraft abwesend: eigene Stunde wird von anderen gehalten bzw. Bereitschaft entfällt – gestrichelt statt Entfall (nie im Raumplan). */
export const lehrerAbwesend = (k: Karte, typ: Typ) => k.status === 'abwesend' && (typ === 'lehrer' || (typ !== 'raum' && !!k.lehrerAbwesend));
/** Echter Entfall (schraffiert, durchgestrichen). */
export const istEntfall = (k: Karte, typ: Typ) => k.status === 'entfall' || (k.status === 'abwesend' && !lehrerAbwesend(k, typ));
export const istVerlegung = (k: Karte) => !!k.verlegung || /verleg|statt/i.test(k.art || '');
export const verlegungsRichtung = (k: Karte, typ: Typ): 'von' | 'nach' => k.verlegung === 'von' || k.verlegung === 'nach' ? k.verlegung : istEntfall(k, typ) ? 'von' : 'nach';
export const istZusatz = (k: Karte) => k.status === 'veranstaltung' || (k.status === 'geaendert' && !istVerlegung(k) && (k.zusaetzlich || /sondereinsatz|zusatz|mitbetreuung/i.test(k.art || '')));
export const istOnline = (k: Karte, typ: Typ) => !!k.online && !istEntfall(k, typ) && k.status !== 'abwesend';
export const istGeaendert = (k: Karte) => k.status === 'geaendert' || k.status === 'offen';

const alleWerte = (k: Karte) => [...(k.klassen || []), ...(k.lehrer || []), ...(k.raeume || []), ...(k.mitklassen || [])];
export const wertGeaendert = (k: Karte) => !!k.fachAlt || alleWerte(k).some(w => w.alt || w.neu);
export const zusatzWertGeaendert = (k: Karte) => !!k.fachAlt || [...(k.klassen || []), ...(k.zusaetzlich ? [] : k.lehrer || []), ...(k.raeume || []), ...(k.mitklassen || [])].some(w => w.alt || w.neu);

/** Kategorie für Farbe, Legende und Filter. */
export type Art = 'regulaer' | 'entfall' | 'aenderung' | 'pruefung' | 'termin' | 'abwesend' | 'buchung';
export function artVon(k: Karte, typ: Typ): Art {
  if (istEntfall(k, typ)) return 'entfall';
  if (k.status === 'klausur') return 'pruefung';
  if (k.status === 'veranstaltung') return 'termin';
  if (lehrerAbwesend(k, typ)) return 'abwesend';
  if (k.status === 'buchung' || k.status === 'vorgemerkt') return 'buchung';
  if (istGeaendert(k) || (k.abwesendeKlassen || []).length) return 'aenderung';
  return 'regulaer';
}

/** Statustext (die interne Vertretungsart wird bewusst nicht angezeigt). */
export function statusText(k: Karte) {
  if (k.zusaetzlich && k.status === 'geaendert') return ZUSATZ_TEXT;
  return STATUSTEXT[k.status] ?? '';
}

/** Plaketten einer Stunde: kurze Bezeichnung und Ton (die Kachel zeigt davon nur die nicht aus Farbe/Linie ablesbaren, siehe KACHEL_PLAKETTEN). */
export interface Plakette { text: string; ton: 'entfall' | 'aenderung' | 'pruefung' | 'termin' | 'frei' | 'neutral'; hinweis?: string }
/** Auf der Kachel als Wort gezeigt – alles andere (Entfall, Änderung, offen, vertreten …) liest man an Schraffur, Linie und Kürzel-Plaketten ab. */
export const KACHEL_PLAKETTEN = new Set(['Prüfung', 'Termin', 'Buchung', 'Vorgemerkt', 'Verlegt', 'Verlegung']);
export function plaketten(k: Karte, typ: Typ): Plakette[] {
  const p: Plakette[] = [];
  const verlegt = istVerlegung(k) && k.status !== 'klausur';
  if (verlegt) {
    const r = verlegungsRichtung(k, typ);
    p.push({ text: r === 'von' ? 'Verlegt' : 'Verlegung', ton: r === 'von' ? 'entfall' : 'aenderung', hinweis: verlegungsText(k, r) });
  } else if (istEntfall(k, typ)) p.push({ text: 'Entfall', ton: 'entfall' });
  if (k.status === 'klausur') p.push({ text: 'Prüfung', ton: 'pruefung' });
  else if (k.status === 'veranstaltung') p.push({ text: 'Termin', ton: 'termin' });
  else if (!verlegt && istZusatz(k)) p.push({ text: 'Zusatz', ton: 'aenderung', hinweis: k.zusaetzlich ? ZUSATZ_TEXT : k.art });
  else if (k.status === 'offen') p.push({ text: 'Offen', ton: 'aenderung', hinweis: 'Vertretung noch offen' });
  else if (k.status === 'buchung') p.push({ text: 'Buchung', ton: 'frei' });
  else if (k.status === 'vorgemerkt') p.push({ text: 'Vorgemerkt', ton: 'neutral', hinweis: 'In UntPlanWeb beantragt, von UntPlan noch nicht übernommen' });
  else if (lehrerAbwesend(k, typ)) p.push({ text: 'Vertreten', ton: 'neutral' });
  if ((k.abwesendeKlassen || []).length && !istEntfall(k, typ)) p.push({ text: k.abwesendText || 'abwesend', ton: 'neutral', hinweis: `${k.abwesendeKlassen.join(', ')} ${k.abwesendText || 'abwesend'}` });
  return p;
}

export const datumDe = (iso: string) => (iso ? iso.split('-').reverse().join('.') : '');
const verlegungsZeit = (z: { datum: string; beginn: string; ende: string }) => `${datumDe(z.datum)}${z.beginn ? ` ${z.beginn}${z.ende ? `–${z.ende}` : ''}` : ''}`;
export const verlegungsText = (k: Karte, r: 'von' | 'nach') => k.verlegungVon && k.verlegungNach ? `${verlegungsZeit(k.verlegungVon)} → ${verlegungsZeit(k.verlegungNach)}`
  : r === 'von' ? 'Verlegt (ursprüngliche Stunde)' : 'Verlegung (hierher verlegt)';

/** Vertretungstext und Notizen (Info-Symbol auf der Kachel). */
export function infoText(k: Karte): string[] {
  const z: string[] = [];
  if (k.text && k.fach && !/^entf(ä|ae|a)llt\.?$/i.test(k.text.trim())) z.push(`Vertretungstext: ${k.text}`);
  if (k.notizLehrer) z.push(`Notizen für Lehrkräfte: ${k.notizLehrer}`);
  if (k.notizSchueler) z.push(`Notizen für Schüler*innen: ${k.notizSchueler}`);
  return z;
}

export const kuerzel = (l: Wert[] | null | undefined) => (l || []).map(w => w.k || w.alt || '').filter(Boolean);
export const abwesendSet = (k: Karte) => new Set((k.abwesendeKlassen || []).map(x => x.toLowerCase()));

/** Klartext einer Stunde für Bildschirmleser und Tooltips. */
export function titelText(k: Karte) {
  const w = (l: Wert[]) => (l || []).map(x => (x.alt && x.k ? `${x.k} (statt ${x.alt})` : x.k || (x.alt ? `${x.alt} fehlt` : '???'))).join(', ');
  return [k.fachName || k.fach || k.text, w([...(k.klassen || []), ...(k.mitklassen || [])]), w(k.lehrer), k.online ? 'findet online statt' : w(k.raeume),
    k.status !== 'regulaer' ? statusText(k) : '', k.fach && k.text].filter(Boolean).join(' · ');
}

/** Zeilen der Kachel je Planart: welche Werte (Lehrkräfte bzw. Klassen) stehen unter dem Fach. */
export function kachelZeilen(k: Karte, typ: Typ): { art: 'lehrer' | 'klassen' | 'mitklassen'; werte: Wert[] }[] {
  const entfall = istEntfall(k, typ);
  const z: { art: 'lehrer' | 'klassen' | 'mitklassen'; werte: Wert[] }[] = [];
  const lehrer = k.lehrer || [], klassen = k.klassen || [];
  if (!k.fach) {
    if (klassen.length) z.push({ art: 'klassen', werte: klassen });
    if (typ !== 'lehrer' || lehrer.length > 1) z.push({ art: 'lehrer', werte: lehrer });
  } else if (typ === 'klasse') {
    z.push({ art: 'lehrer', werte: lehrer });
    if (klassen.length > 1 || abwesendSet(k).size) z.push({ art: 'klassen', werte: klassen });
    if (!entfall && (k.mitklassen || []).length) z.push({ art: 'mitklassen', werte: k.mitklassen });
  } else if (typ === 'raum') {
    z.push({ art: 'klassen', werte: klassen }, { art: 'lehrer', werte: lehrer });
  } else {
    z.push({ art: 'klassen', werte: klassen });
    if (lehrerAbwesend(k, typ)) z.push({ art: 'lehrer', werte: lehrer.filter(w => w.alt || w.k) });
    else if (lehrer.length > 1 || lehrer.some(w => w.alt || w.neu)) z.push({ art: 'lehrer', werte: lehrer });
  }
  return z.filter(x => x.werte.length);
}

/** Raum im Kopf der Kachel (im Raumplan nur ein geänderter Raum; online: kein Raum). */
export function kopfRaeume(k: Karte, typ: Typ): Wert[] {
  if (istOnline(k, typ)) return [];
  const r = k.raeume || [];
  const geaendert = !istEntfall(k, typ) && r.some(w => w.alt || w.neu);
  return typ === 'raum' && !geaendert ? [] : r;
}

/** Spuren für gleichzeitige Karten (nebeneinander); geänderte Karten stehen links. */
export function spuren<T extends { von: number; bis: number; status: string }>(karten: T[]): Map<T, { spur: number; anzahl: number }> {
  const gruen = (k: T) => k.status === 'geaendert' || k.status === 'offen';
  const sortiert = [...karten].sort((a, b) => a.von - b.von || b.bis - a.bis);
  const gruppen: T[][] = [];
  let gruppe: T[] | null = null, ende = -1;
  for (const k of sortiert) {
    if (!gruppe || k.von > ende) { gruppe = []; gruppen.push(gruppe); ende = k.bis; }
    gruppe.push(k);
    ende = Math.max(ende, k.bis);
  }
  const res = new Map<T, { spur: number; anzahl: number }>();
  const ueber = (a: T, b: T) => a.von <= b.bis && b.von <= a.bis;
  for (const g of gruppen) {
    const belegt: T[][] = [];
    for (const k of [...g.filter(gruen), ...g.filter(x => !gruen(x))]) {
      let ab = 0;
      if (!gruen(k)) belegt.forEach((l, i) => { if (l.some(o => gruen(o) && ueber(o, k))) ab = i + 1; });
      let spur = belegt.findIndex((l, i) => i >= ab && l.every(o => !ueber(o, k)));
      if (spur < 0) { spur = belegt.length; belegt.push([]); }
      belegt[spur].push(k);
      res.set(k, { spur, anzahl: 0 });
    }
    for (const k of g) res.get(k)!.anzahl = belegt.length;
  }
  return res;
}

export const gueltigeFarbe = (f: string | null | undefined) => (/^#[0-9a-f]{6}$/i.test(f || '') ? f! : null);

export const vergangen = (k: { datum: string; ende: string }, heute: string, jetzt: number) => k.datum < heute || (k.datum === heute && !!k.ende && minuten(k.ende) <= jetzt);

/** Aufsichtsbereich („Hof“) ohne „Früh“ davor. */
export function aufsichtOrt(a: Aufsicht) {
  const roh = String(a.gang || a.gangName || '').trim();
  return roh.replace(/^(früh(aufsicht)?|fa)[\s:\-–]*/i, '').trim() || roh || 'Aufsicht';
}
const echt = (x: string | null | undefined) => (x && !/^[?+-]+$/.test(x) ? x : '');
export function aufsichtTitel(a: Aufsicht) {
  const ersatz = echt(a.lehrer);
  const zustand = a.status === 'vertretung' ? ` (Vertretung für ${a.alt})`
    : a.status === 'vertreten' ? (ersatz ? ` (vertreten durch ${ersatz})` : ' (Vertretung offen)')
    : a.status === 'entfall' ? ` (entfällt${a.grund ? ' – ' + a.grund : ''})` : '';
  return `Pausenaufsicht ${a.gangName || a.gang} ${a.beginn}–${a.ende}${zustand}`;
}
/** Vertretung einer Aufsicht: neue Lehrkraft und ggf. die ersetzte. */
export function aufsichtVertretung(a: Aufsicht): { neu: string; alt: string } | null {
  if (a.status !== 'vertretung' && a.status !== 'vertreten') return null;
  const neu = echt(a.lehrer);
  return neu ? { neu, alt: echt(a.alt) } : null;
}

/** Hinweise über dem Tag (ohne die, die schon die Karten zeigen). */
export const tagHinweise = (h: string[]) => h.filter(x => !/^(abwesend|raum gesperrt|klasse abwesend)\b/i.test(x));

export const FREI_TEXT: Record<string, string> = { ferien: 'Ferien', feiertag: 'Feiertag', frei: 'Unterrichtsfrei' };
const nurDatum = (n: string) => /^\d{1,2}\.\d{1,2}\.(\d{2,4})?$/.test((n || '').trim());
export function freiText(t: { freiArt: string | null; freiGrund: string | null; freiVon: string | null; freiBis: string | null; datum: string }) {
  const titel = FREI_TEXT[t.freiArt ?? ''] ?? t.freiGrund ?? 'Unterrichtsfrei';
  const name = (t.freiGrund || '').trim();
  const von = t.freiVon || t.datum, bis = t.freiBis || von;
  return { titel, name: name && !nurDatum(name) && name.toLowerCase() !== titel.toLowerCase() ? name : '', zeitraum: von ? (bis && bis !== von ? `${datumDe(von)} – ${datumDe(bis)}` : datumDe(von)) : '' };
}

/** Link zum Online-Unterricht: nur absolute http-/https-Adressen. */
export function sichererLink(x: string | null | undefined): boolean {
  if (!x) return false;
  try { const u = new URL(x); return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname && !/\s/.test(x); } catch { return false; }
}
