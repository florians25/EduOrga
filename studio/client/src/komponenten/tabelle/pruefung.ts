// Prüfung und Vereinheitlichung von Zellwerten vor dem Speichern (Eingabe, Einfügen, Mehrfachänderung).
// Elemente werden mit den zulässigen Werten (Kurznamen) verglichen – Groß-/Kleinschreibung egal, Ergebnis in der
// Schreibweise der Liste. Unbekannte Werte werden nicht gespeichert, sondern gemeldet (Zelle rot mit Hinweis).
import type { ElementOption } from '@/api/typen';
import { listenTeile } from './vorschlagsliste';

/** Was die Prüfung über eine Spalte wissen muss (Teilmenge von Spalte<Z>). */
export interface PruefSpalte {
  titel: string;
  art?: string;
  auswahl?: string[];
  pruefen?: boolean;
  zusatzWerte?: string[];
  zulassen?: (teil: string) => boolean;
}

export type Pruefergebnis = { ok: true; wert: string } | { ok: false; fehler: string };

const WAHR = ['x', '1', 'true', 'ja', 'wahr', 'j', 'y', 'yes', '✓'];
const FALSCH = ['', '0', 'false', 'nein', 'falsch', 'n', 'no', '-'];

export const ok = (wert: string): Pruefergebnis => ({ ok: true, wert });
const fehler = (f: string): Pruefergebnis => ({ ok: false, fehler: f });

/** Spalten, deren Werte aus einer Liste stammen (Kombinationsfeld). */
export const istListenart = (art?: string) => art === 'Element' || art === 'ElementListe' || art === 'Auswahl';

/** Auswahlwerte als Optionen („3 Text“ → Kurz „3“, Lang „Text“ wäre irreführend – der ganze Text ist der Wert). */
export const auswahlOptionen = (auswahl: string[] = []): ElementOption[] => auswahl.filter((a) => a !== '').map((a, i) => ({ id: i, k: a, l: '' }));

function element(t: string, optionen: ElementOption[], zusatz: string[], zulassen?: (teil: string) => boolean): string | null {
  const k = t.trim().toLowerCase();
  if (zulassen?.(t.trim())) return t.trim();
  const z = zusatz.find((x) => x.toLowerCase() === k);
  if (z !== undefined) return z;
  const e = optionen.find((o) => o.k.toLowerCase() === k);
  return e ? e.k : null;
}

/**
 * Wert prüfen und vereinheitlichen. optionen: zulässige Elemente (bei Element/ElementListe; null/leer = nicht prüfen).
 */
export function pruefeWert(s: PruefSpalte, roh: string, optionen: ElementOption[] | null): Pruefergebnis {
  if (s.pruefen === false) return ok(roh);
  const t = roh.trim();
  const titel = s.titel ? ` (${s.titel})` : '';
  switch (s.art) {
    case 'Bool': {
      const k = t.toLowerCase();
      if (WAHR.includes(k)) return ok('X');
      if (FALSCH.includes(k)) return ok('');
      return fehler(`„${t}“ ist kein Ja/Nein-Wert${titel} – erlaubt sind X oder leer.`);
    }
    case 'Ganzzahl':
      return t === '' || /^[-+]?\d+$/.test(t) ? ok(t) : fehler(`„${t}“ ist keine ganze Zahl${titel}.`);
    case 'Dezimal':
      return t === '' || /^[-+]?\d+([.,]\d+)?$/.test(t) ? ok(t) : fehler(`„${t}“ ist keine Zahl${titel}.`);
    case 'Bereich':
      return /^[\d\s,;-]*$/.test(t) ? ok(t) : fehler(`„${t}“ ist kein Bereich${titel} (z. B. 1-2 oder 1,3).`);
    case 'Datum':
      return t === '' || /^\d{4}-\d{2}-\d{2}$/.test(t) || /^[+-]\d+$/.test(t) || /^((Mo|Di|Mi|Do|Fr|Sa|So),?\s+)?\d{1,2}\.\d{1,2}\.?(\d{2}|\d{4})?$/i.test(t)
        ? ok(t) : fehler(`„${t}“ ist kein Datum${titel} (z. B. 12.10.2026).`);
    case 'Farbe':
      return t === '' || /^#?[0-9a-f]{6}$/i.test(t) ? ok(t === '' || t.startsWith('#') ? t : `#${t}`) : fehler(`„${t}“ ist keine Farbe${titel} (z. B. #3366CC).`);
    case 'Auswahl': {
      if (t === '') return ok('');
      const liste = (s.auswahl || []).filter((a) => a !== '');
      if (!liste.length) return ok(t);
      const k = t.toLowerCase();
      const a = liste.find((x) => x.toLowerCase() === k) ?? liste.find((x) => x.toLowerCase().startsWith(`${k} `));
      if (a !== undefined) return ok(a);
      return fehler(`„${t}“ ist kein zulässiger Wert${titel}. Möglich: ${liste.slice(0, 8).join(', ')}${liste.length > 8 ? ' …' : ''}`);
    }
    case 'Element': {
      if (t === '' || !optionen?.length) return ok(t);
      const e = element(t, optionen, s.zusatzWerte || [], s.zulassen);
      return e !== null ? ok(e) : fehler(`„${t}“ ist nicht vorhanden${titel}.`);
    }
    case 'ElementListe': {
      if (t === '' || !optionen?.length) return ok(listenTeile(t).join(','));
      const erg: string[] = [];
      const unbekannt: string[] = [];
      for (const teil of listenTeile(t)) {
        const e = element(teil, optionen, s.zusatzWerte || [], s.zulassen);
        if (e !== null) { if (!erg.includes(e)) erg.push(e); continue; }
        // „5a 5b“ (mit Leerzeichen getrennt) zulassen, wenn alle Teile bekannt sind
        const woerter = teil.split(/\s+/);
        const ew = woerter.map((w) => element(w, optionen, s.zusatzWerte || []));
        if (woerter.length > 1 && ew.every((x) => x !== null)) { for (const x of ew) if (!erg.includes(x!)) erg.push(x!); continue; }
        unbekannt.push(teil);
      }
      if (unbekannt.length) return fehler(`${unbekannt.map((u) => `„${u}“`).join(', ')} ${unbekannt.length === 1 ? 'ist' : 'sind'} nicht vorhanden${titel}.`);
      return ok(erg.join(','));
    }
    default:
      return ok(roh);
  }
}

/** Tabulator-Text (Tabellenkalkulation) in Zeilen und Zellen zerlegen; Anführungszeichen wie in Excel/CSV. */
export function tsvLesen(text: string): string[][] {
  const zeilen: string[][] = [];
  let zeile: string[] = [];
  let feld = '';
  let i = 0;
  let inAnf = false;
  const t = text.replace(/\r\n?/g, '\n');
  while (i < t.length) {
    const c = t[i]!;
    if (inAnf) {
      if (c === '"' && t[i + 1] === '"') { feld += '"'; i += 2; continue; }
      if (c === '"') { inAnf = false; i++; continue; }
      feld += c; i++; continue;
    }
    if (c === '"' && feld === '') { inAnf = true; i++; continue; }
    if (c === '\t') { zeile.push(feld); feld = ''; i++; continue; }
    if (c === '\n') { zeile.push(feld); zeilen.push(zeile); zeile = []; feld = ''; i++; continue; }
    feld += c; i++;
  }
  if (feld !== '' || zeile.length) { zeile.push(feld); zeilen.push(zeile); }
  return zeilen;
}

/** Zellen als Tabulator-Text (Werte mit Tabulator, Zeilenumbruch oder Anführungszeichen in Anführungszeichen). */
export function tsvSchreiben(zeilen: string[][]): string {
  const feld = (v: string) => (/[\t\n"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return zeilen.map((z) => z.map(feld).join('\t')).join('\r\n');
}

/** Spaltenfilter: Text enthält; „=x“ genau; „!x“ enthält nicht; „>5“, „<5“, „>=5“, „<=5“ Zahlen; „=“ leer; „!=“ nicht leer. */
export function filterPasst(wert: string, filter: string): boolean {
  const f = filter.trim().toLowerCase();
  if (!f) return true;
  const w = wert.toLowerCase();
  const zahl = (x: string) => Number(x.replace(',', '.'));
  const m = /^(>=|<=|>|<)\s*(-?\d+(?:[.,]\d+)?)$/.exec(f);
  if (m) {
    const a = zahl(w), b = zahl(m[2]!);
    if (w.trim() === '' || Number.isNaN(a)) return false;
    return m[1] === '>' ? a > b : m[1] === '<' ? a < b : m[1] === '>=' ? a >= b : a <= b;
  }
  if (f === '=') return w.trim() === '';
  if (f === '!=' || f === '!') return w.trim() !== '';
  if (f.startsWith('!')) return !w.includes(f.slice(1).trim());
  if (f.startsWith('=')) return w.trim() === f.slice(1).trim();
  return w.includes(f);
}
