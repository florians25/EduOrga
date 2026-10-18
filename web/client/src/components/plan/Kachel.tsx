// Stundenkachel nach der schulweiten Kartendarstellung (Administration | Darstellung der Stundenkarten, siehe darstellung.tsx).
// Standard: helle neutrale Fläche mit kräftigerer 1-px-Linie (Radius 3 px), Fachfarbe als 8-px-Quadrat vor dem Fachkürzel; wahlweise
// Akzentbalken links/oben, leichte Tönung in der Fachfarbe oder keine Fachfarbe, andere Fläche, Rahmen, Radius, Dichte und Inhalte.
// Kopfzeile Fach und Raum (Kürzel-Plakette), darunter Lehrkraft bzw. Klasse. Status ohne Wörter: Entfall rot durchgestrichen mit feiner
// Schraffur, Änderung mit Petrol-Linie und petrolfarbenen Kürzel-Plaketten (bisheriger Wert grau durchgestrichen, offene Vertretung „?“),
// Prüfung Bernstein-Linie, Termin und vertretene Stunde gestrichelt. Als Wort nur, was sich sonst nicht ablesen lässt (Prüfung, Termin,
// Buchung, Verlegung) – auf Wunsch der Administration zusätzlich alle Statuswörter. Die Bedeutung steht im aria-label und in der
// Kurzinfo beim Überfahren; Klick öffnet die Stundendetails.
import { memo, type CSSProperties, type KeyboardEvent } from 'react';
import { alpha, Box, Stack, Tooltip, Typography, useTheme, type Theme } from '@mui/material';
import LinkRounded from '@mui/icons-material/LinkRounded';
import EditNoteRounded from '@mui/icons-material/EditNoteRounded';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import type { Karte, Wert } from '../../api/types';
import { artVon, gueltigeFarbe, infoText, istEntfall, istOnline, kachelZeilen, kopfRaeume, plaketten, sichererLink, abwesendSet, statusText, titelText, KACHEL_PLAKETTEN, type Typ, type Plakette } from './logik';
import { Kuerzel, WerteListe, wertText } from './Werte';
import { DICHTE, nameVon, STANDARD, useDarstellung, type Kartendarstellung } from './darstellung';

/** Statusbezeichnung: 10–11 px Großbuchstaben in der Statusfarbe, ohne Fläche (keine Pillen). */
export function PlaketteChip({ p, klein = false }: { p: Plakette; klein?: boolean }) {
  const chip = (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', fontSize: klein ? 10 : 10.5, lineHeight: '14px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
      color: p.ton === 'neutral' ? 'text.secondary' : `status.${p.ton}.main`, whiteSpace: 'nowrap', flex: 'none' }}>{p.text}</Box>
  );
  return p.hinweis ? <Tooltip title={p.hinweis}>{chip}</Tooltip> : chip;
}

/** Fachfarbe als kleines Quadrat (8 px) vor dem Fachkürzel. */
export function FachQuadrat({ farbe, groesse = 8, sx }: { farbe: string | null | undefined; groesse?: number; sx?: object }) {
  const f = gueltigeFarbe(farbe);
  return <Box component="span" aria-hidden sx={{ display: 'inline-block', width: groesse, height: groesse, borderRadius: '1px', flex: 'none', bgcolor: f ?? 'transparent',
    border: f ? 0 : 1, borderColor: 'text.disabled', boxShadow: f ? 'inset 0 0 0 1px rgba(0,0,0,.08)' : 'none', ...sx }} />;
}

/** Farbe mit Deckkraft – auch für CSS-Variablen (var(--…)), die alpha() nicht zerlegen kann. */
export const mischen = (farbe: string, wert: number) => (farbe.startsWith('var(') ? `color-mix(in srgb, ${farbe} ${Math.round(wert * 1000) / 10}%, transparent)` : alpha(farbe, wert));

/**
 * Fläche, Rahmen und Textfarbe je Art nach der Kartendarstellung: Grundfläche (neutral, weiß, getönt), Rahmen (fein, kräftig, keiner),
 * optional leichte Tönung in der Fachfarbe. Der Status bleibt immer an Linienfarbe, Schraffur und Plakette ablesbar – auch ohne Rahmen
 * und mit Farbfläche (Entfall nie getönt, sondern schraffiert auf weißer Fläche).
 */
export function kachelStil(k: Karte, typ: Typ, t: Theme, d: Kartendarstellung = STANDARD): CSSProperties & Record<string, unknown> {
  const art = artVon(k, typ);
  // CSS-Variablen des Themas (hell/dunkel wechseln ohne neues Rendern); Deckkraft über color-mix
  const pal = (t.vars ?? t).palette;
  const alpha = mischen;
  const papier = pal.background.paper;
  const kraeftig = d.rahmen === 'kraeftig';
  const breite = kraeftig ? 2 : 1;
  const linie = d.rahmen === 'keiner' ? 'transparent' : kraeftig ? alpha(pal.text.primary, 0.42) : pal.kachel.rand;
  const grund = d.flaeche === 'weiss' ? papier : d.flaeche === 'getoent' ? papier : pal.kachel.flaeche;
  const bilder: string[] = [];
  const fach = gueltigeFarbe(k.farbe);
  if (d.fachfarbe === 'flaeche' && fach && art !== 'entfall' && art !== 'abwesend') { const ton = alpha(fach, d.deckkraft / 100); bilder.push(`linear-gradient(${ton}, ${ton})`); }
  if (d.flaeche === 'getoent') { const ton = alpha(pal.primary.main, 0.05); bilder.push(`linear-gradient(${ton}, ${ton})`); }
  const bild = bilder.length ? { backgroundImage: bilder.join(', ') } : {};
  const basis = { backgroundColor: grund, border: `1px solid ${linie}`, ...bild };
  const s = pal.status;
  const statusLinie = (farbe: string, art: 'solid' | 'dashed' = 'solid') => `${breite}px ${art} ${farbe}`;
  // Status-Kacheln: weiße bzw. getönte Fläche, Linie in der Statusfarbe (auch bei „ohne Rahmen“)
  const statusGrund = d.flaeche === 'neutral' ? papier : grund;
  switch (art) {
    case 'entfall': return {
      backgroundColor: papier, backgroundImage: `repeating-linear-gradient(135deg, ${alpha(s.entfall.main, 0.09)} 0 1px, transparent 1px 6px)`,
      border: statusLinie(alpha(s.entfall.main, 0.45)), color: pal.text.secondary,
    };
    case 'aenderung': return { ...basis, backgroundColor: statusGrund, border: statusLinie(s.aenderung.main) };
    case 'pruefung': return { ...basis, backgroundColor: statusGrund, border: statusLinie(s.pruefung.main) };
    case 'termin': return { ...basis, backgroundColor: papier, border: statusLinie(alpha(pal.text.secondary, 0.7), 'dashed') };
    case 'abwesend': return { ...basis, backgroundColor: papier, border: statusLinie(alpha(pal.text.secondary, 0.7), 'dashed'), color: pal.text.secondary };
    case 'buchung': return { ...basis, backgroundColor: papier, border: statusLinie(s.frei.main, 'dashed') };
    default: return basis;
  }
}

/** Kurzinfo beim Überfahren: alle Angaben der Stunde. */
export function KachelInfo({ k, typ }: { k: Karte; typ: Typ }) {
  const entfall = istEntfall(k, typ);
  const zeile = (titel: string, inhalt: React.ReactNode) => (
    <Stack direction="row" gap={1.5}><Typography variant="caption" sx={{ color: 'text.secondary', width: 66, flex: 'none' }}>{titel}</Typography><Typography variant="body2" component="div">{inhalt}</Typography></Stack>
  );
  const st = istEntfall(k, typ) ? 'Entfall' : statusText(k);
  return (
    <Box sx={{ minWidth: 220, maxWidth: 320 }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 0.75 }}>
        {gueltigeFarbe(k.farbe) && <FachQuadrat farbe={k.farbe} groesse={10} />}
        <Typography sx={{ fontWeight: 600 }}>{k.fachName || k.fach || k.text || k.art}</Typography>
        {st && k.status !== 'regulaer' && <Typography variant="caption" sx={{ ml: 'auto', fontWeight: 600, color: entfall ? 'status.entfall.main' : 'status.aenderung.main' }}>{st}</Typography>}
      </Stack>
      <Stack gap={0.25}>
        {zeile('Zeit', `${k.von === k.bis ? `${k.von}.` : `${k.von}.–${k.bis}.`} Std. · ${k.beginn}–${k.ende}`)}
        {k.klassen?.length > 0 && zeile('Klasse', [...k.klassen, ...(k.mitklassen || [])].map(wertText).join(', '))}
        {k.lehrer?.length > 0 && zeile('Lehrkraft', k.lehrer.map(wertText).join(', '))}
        {istOnline(k, typ) ? zeile('Raum', 'Online-Unterricht') : k.raeume?.length > 0 && zeile('Raum', k.raeume.map(wertText).join(', '))}
        {k.fachAlt && zeile('Fach', `${k.fachAlt} → ${k.fach}`)}
        {infoText(k).map((t, i) => <Typography key={i} variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>{t}</Typography>)}
        {k.hausaufgabeFaellig && <Typography variant="body2" sx={{ mt: 0.5 }}>Hausaufgabe fällig</Typography>}
      </Stack>
    </Box>
  );
}

export interface KachelProps {
  k: Karte; typ: Typ; hoehe?: number; onOpen?: (k: Karte) => void; gedimmt?: boolean; vorbei?: boolean; zeit?: string | null; style?: CSSProperties; gross?: boolean;
}

export const Kachel = memo(function Kachel({ k, typ, hoehe = 64, onOpen, gedimmt, vorbei, zeit, style, gross }: KachelProps) {
  const t = useTheme();
  const { d, namen } = useDarstellung();
  const dichte = DICHTE[d.dichte];
  const entfall = istEntfall(k, typ);
  const art = artVon(k, typ);
  const kompakt = hoehe < 44;
  const sehrKlein = hoehe < 30;
  const mittel = !kompakt && hoehe < 74;
  // Zeile 2 und Raum lassen sich ausblenden – Änderungen (neues/bisheriges Kürzel, offene Vertretung) bleiben immer sichtbar
  const geaendert = (w: Wert) => !!(w.alt || w.neu) || (!w.k && !!w.neu);
  const zeilen = kachelZeilen(k, typ).filter(z => d.zeile2 || z.werte.some(geaendert) || (k.status === 'offen' && z.art === 'lehrer'));
  const raeume = kopfRaeume(k, typ).filter(w => d.raum || geaendert(w));
  const alle = plaketten(k, typ);
  const pl = d.statuswoerter ? alle : alle.filter(p => KACHEL_PLAKETTEN.has(p.text));
  const info = infoText(k);
  const online = istOnline(k, typ);
  const durch = entfall ? 'line-through' : 'none';
  const fachText = d.fach === 'name' && k.fachName ? k.fachName : k.fach;
  const titel = k.fach ? (k.fachAlt && !entfall ? <Box component="span" sx={{ display: 'inline-flex', gap: '3px', alignItems: 'center' }}><Kuerzel art="alt" title={`bisher ${k.fachAlt}`}>{k.fachAlt}</Kuerzel><Kuerzel art="neu" title={`${k.fach} statt ${k.fachAlt}`}>{fachText}</Kuerzel></Box> : fachText) : (k.text || k.art || '—');
  const abw = abwesendSet(k);
  const anzeige = (zeilenArt: string) => (d.zeile2Text === 'name' && namen ? (x: string) => nameVon(namen, zeilenArt === 'lehrer' ? 'lehrer' : 'klassen', x) : undefined);
  // Fachfarbe: Quadrat vor dem Fach, Balken links bzw. oben am Rand, Tönung der Fläche (kachelStil) oder keine
  const farbe = gueltigeFarbe(k.farbe);
  const balken = (d.fachfarbe === 'balken-links' || d.fachfarbe === 'balken-oben') && !!k.fach && !!farbe;
  const balkenLinks = balken && d.fachfarbe === 'balken-links' ? d.balkenbreite : 0;
  const balkenOben = balken && d.fachfarbe === 'balken-oben' ? d.balkenbreite : 0;
  const quadrat = d.fachfarbe === 'quadrat' && !!k.fach;
  const einzug = quadrat ? '14px' : 0;
  const symbole = (
    <>
      {online && (k.onlineLink && sichererLink(k.onlineLink) ? (
        <Tooltip title="Online-Unterricht beitreten">
          <Box component="a" href={k.onlineLink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} aria-label="Online-Unterricht beitreten"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, color: 'primary.main', fontSize: 10.5, lineHeight: '14px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
              textDecoration: 'none', flex: 'none', '&:hover': { textDecoration: 'underline' } }}>
            <LinkRounded sx={{ fontSize: 13 }} />Online
          </Box>
        </Tooltip>
      ) : (
        <Tooltip title="Findet online statt">
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, color: 'text.secondary', fontSize: 10.5, lineHeight: '14px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', flex: 'none' }}>
            <LinkRounded sx={{ fontSize: 13 }} />Online
          </Box>
        </Tooltip>
      ))}
      {k.hausaufgabeFaellig && <Tooltip title="Hausaufgabe fällig"><EditNoteRounded sx={{ fontSize: 15, color: 'text.secondary' }} aria-label="Hausaufgabe fällig" /></Tooltip>}
      {info.length > 0 && <Tooltip title={<Box sx={{ whiteSpace: 'pre-line' }}>{info.join('\n')}</Box>}><InfoOutlined sx={{ fontSize: 14, color: 'text.secondary' }} aria-label="Hinweis" /></Tooltip>}
    </>
  );
  const hatSymbole = online || k.hausaufgabeFaellig || info.length > 0;
  const tasten = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(k); } };
  const hover = art === 'entfall' ? {} : { backgroundColor: (t.vars ?? t).palette.kachel.hover };
  const py = sehrKlein ? 0 : kompakt ? Math.min(3, dichte.py) : dichte.py;
  const fachGroesse = dichte.fach + (gross ? 1 : 0);
  return (
    <Tooltip title={<KachelInfo k={k} typ={typ} />} placement="right-start" enterDelay={450} enterNextDelay={300} disableInteractive
      slotProps={{ tooltip: { sx: { bgcolor: 'background.paper', color: 'text.primary', border: 1, borderColor: 'divider', boxShadow: '0 8px 24px rgba(21,26,33,.14)', p: 1.5, maxWidth: 360 } }, arrow: { sx: { color: 'background.paper', '&:before': { border: 1, borderColor: 'divider' } } } }}>
      <Box role="button" tabIndex={0} aria-label={titelText(k)} onClick={() => onOpen?.(k)} onKeyDown={tasten} data-karte="" data-art={art} data-fachfarbe={d.fachfarbe}
        sx={{
          position: 'relative', ...kachelStil(k, typ, t, d), borderRadius: `${d.eckenradius}px`, pl: `${dichte.px + balkenLinks}px`, pr: `${dichte.px}px`, pt: `${py + balkenOben}px`, pb: `${py}px`,
          overflow: 'hidden', cursor: onOpen ? 'pointer' : 'default',
          display: 'flex', flexDirection: 'column', gap: '1px', fontSize: dichte.zeile, lineHeight: 1.25, color: entfall ? undefined : 'text.primary', fontVariantNumeric: 'tabular-nums',
          opacity: gedimmt ? 0.3 : vorbei ? 0.72 : 1, containerType: 'inline-size', transition: 'opacity .12s, background-color .12s, border-color .12s',
          '&:hover': { ...hover, zIndex: 3, opacity: 1 }, '&:focus-visible': { outline: `2px solid ${t.palette.primary.main}`, outlineOffset: 1 },
          ...style,
        }}>
        {balken && <Box aria-hidden data-fachbalken="" sx={{ position: 'absolute', bgcolor: farbe, opacity: entfall ? 0.35 : 1,
          ...(balkenLinks ? { left: 0, top: 0, bottom: 0, width: balkenLinks } : { left: 0, right: 0, top: 0, height: balkenOben }) }} />}
        <Stack direction="row" alignItems="center" gap={0.75} sx={{ minWidth: 0, flex: 'none', height: dichte.kopf }}>
          {quadrat && <FachQuadrat farbe={k.farbe} />}
          <Typography component="span" noWrap sx={{ fontWeight: 600, fontSize: fachGroesse, lineHeight: `${dichte.kopf}px`, color: entfall ? 'status.entfall.main' : 'text.primary', textDecoration: durch, minWidth: 0, flex: '0 1 auto' }}>{titel}</Typography>
          {kompakt && zeilen[0] && (
            <Typography component="span" noWrap sx={{ fontSize: dichte.zeile, color: 'text.secondary', textDecoration: durch, minWidth: 0 }}>
              <WerteListe werte={zeilen[0].werte} entfall={entfall} mitAlt={false} abwesend={zeilen[0].art === 'klassen' ? abw : undefined} offen={k.status === 'offen' && zeilen[0].art === 'lehrer'} anzeige={anzeige(zeilen[0].art)} />
            </Typography>
          )}
          {raeume.length > 0 && (
            <Typography component="span" noWrap sx={{ ml: 'auto', fontSize: dichte.zeile, fontWeight: 500, color: 'text.secondary', textDecoration: durch, flex: 'none', maxWidth: '55%', textAlign: 'right', '@container (max-width: 76px)': { display: 'none' } }}>
              {!entfall && raeume.every(w => !w.alt && !w.neu) ? <Box component="span" sx={{ display: 'inline-flex', gap: '3px' }}>{raeume.map((w, i) => <Kuerzel key={i} stil={d.kuerzel}>{w.k}</Kuerzel>)}</Box>
                : <WerteListe werte={raeume} entfall={entfall} mitAlt={!kompakt} trenner=" " />}
            </Typography>
          )}
        </Stack>
        {!kompakt && zeilen.length > 0 && (
          <Box sx={{ flex: '0 1 auto', minHeight: 0, overflow: 'hidden', pl: k.fach ? einzug : 0 }}>
            {(mittel ? zeilen.slice(0, 1) : zeilen).map((z, i) => (
              <Typography key={i} component="div" noWrap sx={{ fontSize: dichte.zeile, lineHeight: `${dichte.zeilenhoehe}px`, color: z.art === 'mitklassen' ? 'text.disabled' : 'text.secondary', textDecoration: durch }}>
                <WerteListe werte={z.werte} entfall={entfall} abwesend={z.art === 'klassen' ? abw : undefined} offen={k.status === 'offen' && z.art === 'lehrer'} anzeige={anzeige(z.art)} />
              </Typography>
            ))}
          </Box>
        )}
        {!kompakt && (pl.length > 0 || hatSymbole || zeit) && (
          <Stack direction="row" alignItems="center" gap={0.75} sx={{ mt: 'auto', pl: k.fach ? einzug : 0, minWidth: 0, flex: 'none', flexWrap: 'nowrap', overflow: 'hidden', height: 15, '@container (max-width: 64px)': { display: 'none' } }}>
            {pl.slice(0, mittel ? 2 : 3).map((p, i) => <PlaketteChip key={i} p={p} klein={!gross} />)}
            {zeit && <Typography component="span" sx={{ fontSize: 11, color: 'text.secondary' }}>{zeit}</Typography>}
            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>{symbole}</Box>
          </Stack>
        )}
        {kompakt && !sehrKlein && pl[0] && <Box sx={{ position: 'absolute', right: 6, bottom: 2 }}><PlaketteChip p={pl[0]} klein /></Box>}
      </Box>
    </Tooltip>
  );
});
