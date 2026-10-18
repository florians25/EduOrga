// Datumshilfen (ISO „JJJJ-MM-TT“ in lokaler Zeit, deutsche Anzeige).

export const WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export const WOCHENTAGE_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

const z2 = (n: number) => String(n).padStart(2, '0');

export function iso(d: Date): string {
  return `${d.getFullYear()}-${z2(d.getMonth() + 1)}-${z2(d.getDate())}`;
}
export function ausIso(s: string): Date {
  const [j, m, t] = s.slice(0, 10).split('-').map(Number);
  return new Date(j, (m || 1) - 1, t || 1);
}
export const heuteIso = () => iso(new Date());
export function plusTage(s: string, n: number): string {
  const d = ausIso(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}
export function montag(s: string): string {
  const d = ausIso(s);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
}
/** Index des Wochentags (0 = Montag). */
export const wochentagIndex = (s: string) => (ausIso(s).getDay() + 6) % 7;
export const wochentag = (s: string) => WOCHENTAGE[wochentagIndex(s)];
export const wochentagKurz = (s: string) => WOCHENTAGE_KURZ[wochentagIndex(s)];
export const istIsoDatum = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** „12.10.“ */
export function datumKurz(s: string): string {
  if (!s) return '';
  const d = ausIso(s);
  return `${z2(d.getDate())}.${z2(d.getMonth() + 1)}.`;
}
/** „12.10.2026“ */
export function datumDe(s: string | null | undefined): string {
  if (!s) return '';
  const [j, m, t] = s.slice(0, 10).split('-');
  return `${t}.${m}.${j}`;
}
/** „Montag, 12.10.2026“ */
export function datumLang(s: string): string {
  return `${wochentag(s)}, ${datumDe(s)}`;
}
/** „Montag, 12. Oktober 2026“ */
export function datumText(s: string): string {
  const d = ausIso(s);
  return `${wochentag(s)}, ${d.getDate()}. ${MONATE[d.getMonth()]} ${d.getFullYear()}`;
}
/** „12.10.2026 08:15“ aus „2026-10-12 08:15:00“ bzw. ISO-Zeitstempel. */
export function zeitstempel(s: string | null | undefined): string {
  const m = String(s ?? '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}` : String(s ?? '');
}

export function minuten(hhmm: string | null | undefined): number {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
export const hhmm = (m: number) => `${z2(Math.floor(m / 60))}:${z2(m % 60)}`;
export function jetztMinuten(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/** Kalenderwoche nach ISO 8601. */
export function kalenderwoche(s: string): number {
  const d = ausIso(s);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const jan4 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
}

/** „12.10.–16.10.2026“ */
export function wochenText(mo: string, tage = 5): string {
  const ende = plusTage(mo, tage - 1);
  return `${datumKurz(mo)}–${datumKurz(ende)}${ende.slice(0, 4)}`;
}

/** „vor 5 Minuten“, „gestern“ … für Listen (Mitteilungen). */
export function relativ(s: string | null | undefined): string {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return s;
  const heute = heuteIso();
  const tag = iso(d);
  if (tag === heute) return `${z2(d.getHours())}:${z2(d.getMinutes())}`;
  if (tag === plusTage(heute, -1)) return 'gestern';
  if (d.getFullYear() === new Date().getFullYear()) return `${z2(d.getDate())}.${z2(d.getMonth() + 1)}.`;
  return datumDe(tag);
}
