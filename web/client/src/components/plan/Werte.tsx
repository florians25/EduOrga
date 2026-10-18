// Darstellung der Werte einer Stunde (Klassen, Lehrkräfte, Räume) mit Kürzel-Plaketten (Radius 3 px): unveränderte Werte als Text,
// geänderter Wert als gefüllte Plakette in der Änderungsfarbe, ersetzter Wert davor als graue, durchgestrichene Plakette, hinzugefügter
// Wert umrandet in der Änderungsfarbe, offene Vertretung als gestrichelte „?“-Plakette, abwesende Klasse grau durchgestrichen.
// Die Bedeutung steht im Tooltip (title) und in der Legende – auf der Kachel stehen keine Statuswörter.
import { Box } from '@mui/material';
import type { ReactNode } from 'react';
import type { Wert } from '../../api/types';
import { KEIN_ELEMENT } from './logik';

export type KuerzelArt = 'normal' | 'neu' | 'alt' | 'plus' | 'offen';

/** Kürzel als kleine Plakette (11 px, Radius 3 px). */
export function Kuerzel({ art = 'normal', children, title }: { art?: KuerzelArt; children: ReactNode; title?: string }) {
  const stil = {
    normal: { border: '1px solid', borderColor: 'kachel.rand', color: 'text.secondary', bgcolor: 'background.paper' },
    neu: { border: '1px solid', borderColor: 'status.aenderung.main', bgcolor: 'status.aenderung.main', color: '#fff' },
    plus: { border: '1px solid', borderColor: 'status.aenderung.main', color: 'status.aenderung.main', bgcolor: 'background.paper' },
    alt: { border: '1px solid', borderColor: 'kachel.rand', bgcolor: 'action.hover', color: 'text.disabled', textDecoration: 'line-through' },
    offen: { border: '1px dashed', borderColor: 'status.aenderung.main', color: 'status.aenderung.main', bgcolor: 'background.paper', minWidth: 18, justifyContent: 'center' },
  }[art];
  return (
    <Box component="span" title={title} sx={{ display: 'inline-flex', alignItems: 'center', height: 16, px: '4px', borderRadius: '3px', fontSize: 11, lineHeight: '14px', fontWeight: 600,
      letterSpacing: '0.01em', whiteSpace: 'nowrap', verticalAlign: 'middle', boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums', ...stil }}>{children}</Box>
  );
}

export function WertAnzeige({ w, entfall = false, mitAlt = true, weg = false, link, offen = false }: {
  w: Wert; entfall?: boolean; mitAlt?: boolean; weg?: boolean; link?: (kurz: string) => string | null; offen?: boolean;
}) {
  const a = (kurz: string, inhalt: ReactNode) => {
    const href = link && kurz && !KEIN_ELEMENT.test(kurz) ? link(kurz) : null;
    return href ? <Box component="a" href={href} onClick={e => e.stopPropagation()} sx={{ color: 'inherit', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>{inhalt}</Box> : inhalt;
  };
  const fragezeichen = (t: string) => <Kuerzel art="offen" title={t}>?</Kuerzel>;
  if (entfall) return <span>{w.alt || w.k}</span>;
  if (weg) return <Box component="s" sx={{ color: 'text.disabled' }} title={`${w.k} abwesend`}>{w.k}</Box>;
  if (w.alt && !w.k) return (
    <Box component="span" sx={{ display: 'inline-flex', gap: '3px', alignItems: 'center' }}>
      <Kuerzel art="alt" title={offen ? `${w.alt} – Vertretung offen` : `${w.alt} entfällt`}>{a(w.alt, w.alt)}</Kuerzel>
      {offen && fragezeichen(`Vertretung für ${w.alt} offen`)}
    </Box>
  );
  if (!w.k && w.neu) return fragezeichen('Vertretung offen');
  if (w.alt) return (
    <Box component="span" sx={{ display: 'inline-flex', gap: '3px', alignItems: 'center' }}>
      {mitAlt && <Kuerzel art="alt" title={`bisher ${w.alt}`}>{a(w.alt, w.alt)}</Kuerzel>}
      <Kuerzel art="neu" title={`${w.k} statt ${w.alt}`}>{a(w.k, w.k)}</Kuerzel>
    </Box>
  );
  if (w.neu) return <Kuerzel art="plus" title={`${w.k} zusätzlich`}>{a(w.k, w.k)}</Kuerzel>;
  return <span>{a(w.k, w.k)}</span>;
}

export function WerteListe({ werte, entfall, mitAlt = true, abwesend, link, trenner = ', ', offen = false }: {
  werte: Wert[]; entfall?: boolean; mitAlt?: boolean; abwesend?: Set<string>; link?: (kurz: string) => string | null; trenner?: string; offen?: boolean;
}) {
  return (
    <>
      {werte.map((w, i) => (
        <span key={`${w.k}-${w.alt}-${i}`}>
          {i > 0 && trenner}
          <WertAnzeige w={w} entfall={entfall} mitAlt={mitAlt} weg={!!abwesend?.has((w.k || '').toLowerCase())} link={link} offen={offen} />
        </span>
      ))}
    </>
  );
}

/** Klartext „HOF → BEC“ eines Werts (Tooltips). */
export const wertText = (w: Wert) => (w.alt && w.k ? `${w.alt} → ${w.k}` : w.alt && !w.k ? `${w.alt} (entfällt)` : !w.k && w.neu ? '???' : w.neu ? `+${w.k}` : w.k);
