// Datenstand: Zeitpunkt der letzten Übertragung aus EduOrga Studio („Stand EduOrga Studio: Di 20.10.2026, 14:32 · vor 5 Min.“) –
// Plan, Vertretungsplan und Startseite. Vollständiger Zeitpunkt in der Kurzinfo; älter als 24 Stunden an einem Schultag (Mo–Fr): dezenter
// Hinweis „Daten evtl. nicht aktuell“ (Text, nicht nur Farbe).
import { useEffect, useState } from 'react';
import { Box, Tooltip } from '@mui/material';
import { WOCHENTAGE_KURZ } from '../lib/datum';

const z2 = (n: number) => String(n).padStart(2, '0');

/** „2026-10-20 14:32:05“ → Date (Ortszeit); ungültig: null. */
export function standDatum(stand: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(stand ?? '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)) : null;
}

/** „vor 5 Min.“, „vor 3 Std.“, „vor 2 Tagen“, „gerade eben“. */
export function relativKurz(d: Date, jetzt = new Date()): string {
  const min = Math.max(0, Math.round((jetzt.getTime() - d.getTime()) / 60000));
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const std = Math.round(min / 60);
  if (std < 24) return `vor ${std} Std.`;
  const t = Math.round(std / 24);
  return t === 1 ? 'vor 1 Tag' : `vor ${t} Tagen`;
}

export const standText = (d: Date) => `${WOCHENTAGE_KURZ[(d.getDay() + 6) % 7]} ${z2(d.getDate())}.${z2(d.getMonth() + 1)}.${d.getFullYear()}, ${z2(d.getHours())}:${z2(d.getMinutes())}`;

/** Älter als 24 Stunden an einem Schultag (Mo–Fr)? */
export const veraltet = (d: Date, jetzt = new Date()) => jetzt.getDay() >= 1 && jetzt.getDay() <= 5 && jetzt.getTime() - d.getTime() > 24 * 3600 * 1000;

export function DatenStand({ stand, sx }: { stand: string | null | undefined; sx?: object }) {
  const [jetzt, setJetzt] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setJetzt(new Date()), 60000); return () => clearInterval(t); }, []);
  const d = standDatum(stand);
  if (!d) return null;
  const alt = veraltet(d, jetzt);
  return (
    <Tooltip title={`Letzte Übertragung aus EduOrga Studio: ${standText(d)}`}>
      <Box component="span" role="status" data-datenstand="" sx={{ fontSize: 12, color: 'text.secondary', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', ...sx }}>
        Stand EduOrga Studio: {standText(d)} · {relativKurz(d, jetzt)}
        {alt && <Box component="span" sx={{ ml: 0.75, color: 'status.pruefung.main', fontWeight: 500 }}>Daten evtl. nicht aktuell</Box>}
      </Box>
    </Tooltip>
  );
}
