// Kleine Hilfen ohne Abhängigkeiten: Entprellen, Sortiervergleich, Textbreite, Datums- und Größenangaben.

/** Führt f höchstens einmal je `ms` Millisekunden aus (letzter Aufruf gewinnt). */
export function entprellen<A extends unknown[]>(f: (...a: A) => unknown, ms = 200): (...a: A) => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...a: A) => {
    clearTimeout(t);
    t = setTimeout(() => { void f(...a); }, ms);
  };
}

/** Sortiervergleich: deutsch, Zahlen numerisch, Groß-/Kleinschreibung egal. */
export const vergleich = new Intl.Collator('de', { numeric: true, sensitivity: 'base' }).compare;

let leinwand: CanvasRenderingContext2D | null = null;
/** Breite eines Textes in Pixeln (für „Spalten anpassen“). */
export function textbreite(text: string, schrift = '13px "IBM Plex Sans", sans-serif'): number {
  if (!leinwand) leinwand = document.createElement('canvas').getContext('2d');
  if (!leinwand) return text.length * 7;
  leinwand.font = schrift;
  return leinwand.measureText(text).width;
}

export function datumDe(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function groesse(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

export function initialen(name = ''): string {
  const t = name.trim().split(/\s+/).filter(Boolean);
  return ((t[0]?.[0] || '') + (t.length > 1 ? t[t.length - 1]![0] : t[0]?.[1] || '')).toUpperCase();
}

/** Text normalisieren für die Suche (ohne Akzente, ß → ss). */
export function normal(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');
}

/** Datei(en) auswählen (Promise mit File[]; leer = abgebrochen). */
export function dateienWaehlen(accept = '', mehrere = false): Promise<File[]> {
  return new Promise((fertig) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = mehrere;
    input.style.display = 'none';
    input.addEventListener('change', () => { fertig([...(input.files || [])]); input.remove(); });
    input.addEventListener('cancel', () => { fertig([]); input.remove(); });
    document.body.append(input);
    input.click();
  });
}

export async function dateiWaehlen(accept = ''): Promise<File | null> {
  return (await dateienWaehlen(accept, false))[0] ?? null;
}

/** Eindeutige Id für Ansichten u. ä. */
let zaehler = 0;
export const neueId = (praefix = 'a') => `${praefix}${++zaehler}`;
