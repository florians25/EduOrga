// Gemeinsames der Einstellungen (Server: Api/EinstellungenSchuleApi.cs, /api/dokumente/{dok}/schule/…).
import { api } from '@/api/client';

export const pfad = (p: string) => api.dok(`/schule${p}`);
export const TAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export const TAGE_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const datum = (s: string) => { const [y, m, t] = s.split('-').map(Number); return new Date(y!, m! - 1, t); };
export const de = (s?: string | null) => (s ? s.split('-').reverse().join('.') : '');
export function kw(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const n = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - n);
  return Math.ceil(((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
}
/** TT.MM.JJJJ → ISO (leer → null). */
export function isoAusDe(s: string, leerErlaubt = false): string | null {
  if (leerErlaubt && !s.trim()) return null;
  const m = s.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) throw new Error(`Ungültiges Datum „${s}“ (TT.MM.JJJJ).`);
  return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
}
