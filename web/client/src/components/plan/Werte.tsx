// Darstellung der Werte einer Stunde (Klassen, Lehrkräfte, Räume): geänderter Wert petrol, ersetzter Wert durchgestrichen davor,
// hinzugefügter Wert „+R105“, entfernter Wert durchgestrichen, offene Vertretung „???“, abwesende Klasse grau durchgestrichen.
import { Box } from '@mui/material';
import type { Wert } from '../../api/types';
import { KEIN_ELEMENT } from './logik';

export function WertAnzeige({ w, entfall = false, mitAlt = true, weg = false, link }: { w: Wert; entfall?: boolean; mitAlt?: boolean; weg?: boolean; link?: (kurz: string) => string | null }) {
  const a = (kurz: string, inhalt: React.ReactNode) => {
    const href = link && kurz && !KEIN_ELEMENT.test(kurz) ? link(kurz) : null;
    return href ? <Box component="a" href={href} onClick={e => e.stopPropagation()} sx={{ color: 'inherit', textDecorationColor: 'currentColor', textUnderlineOffset: 2, '&:hover': { color: 'primary.main' } }}>{inhalt}</Box> : inhalt;
  };
  if (entfall) return <span>{w.alt || w.k}</span>;
  if (weg) return <Box component="s" sx={{ color: 'text.disabled' }}>{w.k}</Box>;
  if (w.alt && !w.k) return <Box component="s" sx={{ color: 'status.aenderung.main', fontWeight: 600 }}>{a(w.alt, w.alt)}</Box>;
  if (!w.k && w.neu) return <Box component="span" sx={{ color: 'status.aenderung.main', fontWeight: 600 }}>???</Box>;
  if (w.alt) return (
    <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
      {mitAlt && <Box component="s" sx={{ color: 'text.secondary', fontWeight: 400, mr: 0.4, opacity: 0.85 }}>{a(w.alt, w.alt)}</Box>}
      <Box component="span" sx={{ color: 'status.aenderung.main', fontWeight: 600, textDecoration: 'underline', textDecorationThickness: 1.5, textUnderlineOffset: 2 }}>{a(w.k, w.k)}</Box>
    </Box>
  );
  if (w.neu) return <Box component="span" sx={{ color: 'status.aenderung.main', fontWeight: 600 }}>+{a(w.k, w.k)}</Box>;
  return <span>{a(w.k, w.k)}</span>;
}

export function WerteListe({ werte, entfall, mitAlt = true, abwesend, link, trenner = ', ' }: {
  werte: Wert[]; entfall?: boolean; mitAlt?: boolean; abwesend?: Set<string>; link?: (kurz: string) => string | null; trenner?: string;
}) {
  return (
    <>
      {werte.map((w, i) => (
        <span key={`${w.k}-${w.alt}-${i}`}>
          {i > 0 && trenner}
          <WertAnzeige w={w} entfall={entfall} mitAlt={mitAlt} weg={!!abwesend?.has((w.k || '').toLowerCase())} link={link} />
        </span>
      ))}
    </>
  );
}

/** Klartext „HOF → BEC“ eines Werts (Tooltips). */
export const wertText = (w: Wert) => (w.alt && w.k ? `${w.alt} → ${w.k}` : w.alt && !w.k ? `${w.alt} (entfällt)` : !w.k && w.neu ? '???' : w.neu ? `+${w.k}` : w.k);
