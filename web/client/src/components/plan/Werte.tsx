// Darstellung der Werte einer Stunde (Klassen, Lehrkräfte, Räume) in Listen und Kopfzeilen – gleiche Sprache wie die Stundenkarte
// (aenderung.ts): unveränderte Werte als Text, geänderter Wert als grüner Tag „neu statt bisher“, hinzugefügter Wert „neu zusätzlich“,
// fehlender Wert „bisher fehlt“, offene Vertretung als gestricheltes „?“-Feld, abwesende Klasse grau durchgestrichen.
// Die Bedeutung steht im Tooltip (title) und in der Legende.
import { Box } from '@mui/material';
import type { ReactNode } from 'react';
import type { Wert } from '../../api/types';
import { KEIN_ELEMENT } from './logik';
import type { KuerzelStil } from './darstellung';

export type KuerzelArt = 'normal' | 'neu' | 'alt' | 'plus' | 'offen';

/** Kürzel als kleine Plakette (11 px, Radius 3 px); unveränderte Kürzel je nach Kartendarstellung umrandet, gefüllt oder als Text. */
export function Kuerzel({ art = 'normal', children, title, stil: variante = 'umrandet' }: { art?: KuerzelArt; children: ReactNode; title?: string; stil?: KuerzelStil }) {
  const normal = variante === 'gefuellt' ? { border: '1px solid', borderColor: 'transparent', color: 'text.primary', bgcolor: 'kachel.rand' }
    : variante === 'text' ? { border: '1px solid', borderColor: 'transparent', color: 'text.secondary', bgcolor: 'transparent', px: 0, fontWeight: 500, fontSize: 12 }
    : { border: '1px solid', borderColor: 'kachel.rand', color: 'text.secondary', bgcolor: 'background.paper' };
  const stil = {
    normal,
    neu: { border: '1px solid', borderColor: 'status.aenderung.main', bgcolor: 'background.paper', color: 'status.aenderung.text' },
    plus: { border: '1px solid', borderColor: 'status.aenderung.main', bgcolor: 'background.paper', color: 'status.aenderung.text' },
    alt: { border: '1px solid', borderColor: 'kachel.rand', bgcolor: 'action.hover', color: 'text.disabled', textDecoration: 'line-through' },
    offen: { border: '1px dashed', borderColor: 'status.aenderung.main', color: 'status.aenderung.main', bgcolor: 'background.paper', minWidth: 18, justifyContent: 'center' },
  }[art];
  return (
    <Box component="span" title={title} sx={{ display: 'inline-flex', alignItems: 'center', height: 16, px: '4px', borderRadius: '3px', fontSize: 11, lineHeight: '14px', fontWeight: 600,
      letterSpacing: '0.01em', whiteSpace: 'nowrap', verticalAlign: 'middle', boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums', ...stil }} data-kuerzel={art === 'normal' ? variante : art}>{children}</Box>
  );
}

export function WertAnzeige({ w, entfall = false, mitAlt = true, weg = false, link, offen = false, anzeige }: {
  w: Wert; entfall?: boolean; mitAlt?: boolean; weg?: boolean; link?: (kurz: string) => string | null; offen?: boolean;
  /** Anzeigetext eines Kürzels (z. B. Name der Lehrkraft); ohne: das Kürzel. */
  anzeige?: (kurz: string) => string;
}) {
  const n = (x: string) => (anzeige ? anzeige(x) : x);
  const a = (kurz: string, inhalt: ReactNode) => {
    const href = link && kurz && !KEIN_ELEMENT.test(kurz) ? link(kurz) : null;
    return href ? <Box component="a" href={href} onClick={e => e.stopPropagation()} sx={{ color: 'inherit', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>{inhalt}</Box> : inhalt;
  };
  const fragezeichen = (t: string) => <Kuerzel art="offen" title={t}>?</Kuerzel>;
  if (entfall) return <span>{n(w.alt || w.k)}</span>;
  if (weg) return <Box component="s" sx={{ color: 'text.disabled' }} title={`${w.k} abwesend`}>{n(w.k)}</Box>;
  if (w.alt && !w.k) return (
    <Box component="span" sx={{ display: 'inline-flex', gap: '3px', alignItems: 'center' }}>
      <Kuerzel art="neu" title={offen ? `${w.alt} – Vertretung folgt` : `${w.alt} fehlt`}>{a(w.alt, n(w.alt))} fehlt</Kuerzel>
      {offen && fragezeichen(`Vertretung für ${w.alt} offen`)}
    </Box>
  );
  if (!w.k && w.neu) return fragezeichen('Vertretung offen');
  if (w.alt) return <Kuerzel art="neu" title={`${w.k} statt ${w.alt}`}>{a(w.k, n(w.k))}{mitAlt && <> statt {a(w.alt, n(w.alt))}</>}</Kuerzel>;
  if (w.neu) return <Kuerzel art="plus" title={`${w.k} zusätzlich`}>{a(w.k, n(w.k))} zusätzlich</Kuerzel>;
  return <span>{a(w.k, n(w.k))}</span>;
}

export function WerteListe({ werte, entfall, mitAlt = true, abwesend, link, trenner = ', ', offen = false, anzeige }: {
  werte: Wert[]; entfall?: boolean; mitAlt?: boolean; abwesend?: Set<string>; link?: (kurz: string) => string | null; trenner?: string; offen?: boolean; anzeige?: (kurz: string) => string;
}) {
  return (
    <>
      {werte.map((w, i) => (
        <span key={`${w.k}-${w.alt}-${i}`}>
          {i > 0 && trenner}
          <WertAnzeige w={w} entfall={entfall} mitAlt={mitAlt} weg={!!abwesend?.has((w.k || '').toLowerCase())} link={link} offen={offen} anzeige={anzeige} />
        </span>
      ))}
    </>
  );
}

/** Klartext „HOF → BEC“ eines Werts (Tooltips). */
export const wertText = (w: Wert) => (w.alt && w.k ? `${w.alt} → ${w.k}` : w.alt && !w.k ? `${w.alt} (entfällt)` : !w.k && w.neu ? '???' : w.neu ? `+${w.k}` : w.k);
