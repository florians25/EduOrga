// Stundenkachel: helle neutrale Fläche mit kräftigerer 1-px-Linie (Radius 3 px), Fachfarbe nur als 8-px-Quadrat vor dem Fachkürzel;
// Kopfzeile Fach und Raum (Kürzel-Plakette), darunter Lehrkraft bzw. Klasse. Status ohne Wörter: Entfall rot durchgestrichen mit feiner
// Schraffur, Änderung mit Petrol-Linie und petrolfarbenen Kürzel-Plaketten (bisheriger Wert grau durchgestrichen, offene Vertretung „?“),
// Prüfung Bernstein-Linie, Termin und vertretene Stunde gestrichelt. Als Wort nur, was sich sonst nicht ablesen lässt (Prüfung, Termin,
// Buchung, Verlegung). Die Bedeutung steht im aria-label und in der Kurzinfo beim Überfahren; Klick öffnet die Stundendetails.
import { memo, type CSSProperties, type KeyboardEvent } from 'react';
import { alpha, Box, Stack, Tooltip, Typography, useTheme, type Theme } from '@mui/material';
import LinkRounded from '@mui/icons-material/LinkRounded';
import EditNoteRounded from '@mui/icons-material/EditNoteRounded';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import type { Karte } from '../../api/types';
import { artVon, gueltigeFarbe, infoText, istEntfall, istOnline, kachelZeilen, kopfRaeume, plaketten, sichererLink, abwesendSet, statusText, titelText, KACHEL_PLAKETTEN, type Typ, type Plakette } from './logik';
import { Kuerzel, WerteListe, wertText } from './Werte';

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

/** Fläche, Rahmen und Textfarbe je Art: weiße Kachel mit 1-px-Linie; Status über Linienfarbe, Schraffur und Plakette – keine farbigen Flächen. */
export function kachelStil(k: Karte, typ: Typ, t: Theme): CSSProperties & Record<string, unknown> {
  const art = artVon(k, typ);
  const papier = t.palette.background.paper;
  const linie = t.palette.kachel.rand;
  const basis = { backgroundColor: t.palette.kachel.flaeche, border: `1px solid ${linie}` };
  const s = t.palette.status;
  switch (art) {
    case 'entfall': return {
      backgroundColor: papier, backgroundImage: `repeating-linear-gradient(135deg, ${alpha(s.entfall.main, 0.09)} 0 1px, transparent 1px 6px)`,
      border: `1px solid ${alpha(s.entfall.main, 0.45)}`, color: t.palette.text.secondary,
    };
    case 'aenderung': return { ...basis, backgroundColor: papier, border: `1px solid ${s.aenderung.main}` };
    case 'pruefung': return { ...basis, backgroundColor: papier, border: `1px solid ${s.pruefung.main}` };
    case 'termin': return { ...basis, backgroundColor: papier, border: `1px dashed ${alpha(t.palette.text.secondary, 0.7)}` };
    case 'abwesend': return { ...basis, backgroundColor: papier, border: `1px dashed ${alpha(t.palette.text.secondary, 0.7)}`, color: t.palette.text.secondary };
    case 'buchung': return { ...basis, backgroundColor: papier, border: `1px dashed ${s.frei.main}` };
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
  const entfall = istEntfall(k, typ);
  const art = artVon(k, typ);
  const kompakt = hoehe < 44;
  const sehrKlein = hoehe < 30;
  const mittel = !kompakt && hoehe < 74;
  const zeilen = kachelZeilen(k, typ);
  const raeume = kopfRaeume(k, typ);
  const pl = plaketten(k, typ).filter(p => KACHEL_PLAKETTEN.has(p.text));
  const info = infoText(k);
  const online = istOnline(k, typ);
  const durch = entfall ? 'line-through' : 'none';
  const titel = k.fach ? (k.fachAlt && !entfall ? <Box component="span" sx={{ display: 'inline-flex', gap: '3px', alignItems: 'center' }}><Kuerzel art="alt" title={`bisher ${k.fachAlt}`}>{k.fachAlt}</Kuerzel><Kuerzel art="neu" title={`${k.fach} statt ${k.fachAlt}`}>{k.fach}</Kuerzel></Box> : k.fach) : (k.text || k.art || '—');
  const abw = abwesendSet(k);
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
  const hover = art === 'entfall' ? {} : { backgroundColor: t.palette.kachel.hover };
  return (
    <Tooltip title={<KachelInfo k={k} typ={typ} />} placement="right-start" enterDelay={450} enterNextDelay={300} disableInteractive
      slotProps={{ tooltip: { sx: { bgcolor: 'background.paper', color: 'text.primary', border: 1, borderColor: 'divider', boxShadow: '0 8px 24px rgba(21,26,33,.14)', p: 1.5, maxWidth: 360 } }, arrow: { sx: { color: 'background.paper', '&:before': { border: 1, borderColor: 'divider' } } } }}>
      <Box role="button" tabIndex={0} aria-label={titelText(k)} onClick={() => onOpen?.(k)} onKeyDown={tasten} data-karte="" data-art={art}
        sx={{
          position: 'relative', ...kachelStil(k, typ, t), borderRadius: '3px', px: 1, py: sehrKlein ? 0 : kompakt ? 0.375 : 0.625, overflow: 'hidden', cursor: onOpen ? 'pointer' : 'default',
          display: 'flex', flexDirection: 'column', gap: '1px', fontSize: 12, lineHeight: 1.25, color: entfall ? undefined : 'text.primary', fontVariantNumeric: 'tabular-nums',
          opacity: gedimmt ? 0.3 : vorbei ? 0.72 : 1, containerType: 'inline-size', transition: 'opacity .12s, background-color .12s, border-color .12s',
          '&:hover': { ...hover, zIndex: 3, opacity: 1 }, '&:focus-visible': { outline: `2px solid ${t.palette.primary.main}`, outlineOffset: 1 },
          ...style,
        }}>
        <Stack direction="row" alignItems="center" gap={0.75} sx={{ minWidth: 0, flex: 'none', height: 17 }}>
          {k.fach && <FachQuadrat farbe={k.farbe} />}
          <Typography component="span" noWrap sx={{ fontWeight: 600, fontSize: gross ? 14 : 13, lineHeight: '17px', color: entfall ? 'status.entfall.main' : 'text.primary', textDecoration: durch, minWidth: 0, flex: '0 1 auto' }}>{titel}</Typography>
          {kompakt && zeilen[0] && (
            <Typography component="span" noWrap sx={{ fontSize: 12, color: 'text.secondary', textDecoration: durch, minWidth: 0 }}>
              <WerteListe werte={zeilen[0].werte} entfall={entfall} mitAlt={false} abwesend={zeilen[0].art === 'klassen' ? abw : undefined} offen={k.status === 'offen' && zeilen[0].art === 'lehrer'} />
            </Typography>
          )}
          {raeume.length > 0 && (
            <Typography component="span" noWrap sx={{ ml: 'auto', fontSize: 12, fontWeight: 500, color: 'text.secondary', textDecoration: durch, flex: 'none', maxWidth: '55%', textAlign: 'right', '@container (max-width: 76px)': { display: 'none' } }}>
              {!entfall && raeume.every(w => !w.alt && !w.neu) ? <Box component="span" sx={{ display: 'inline-flex', gap: '3px' }}>{raeume.map((w, i) => <Kuerzel key={i}>{w.k}</Kuerzel>)}</Box>
                : <WerteListe werte={raeume} entfall={entfall} mitAlt={!kompakt} trenner=" " />}
            </Typography>
          )}
        </Stack>
        {!kompakt && zeilen.length > 0 && (
          <Box sx={{ flex: '0 1 auto', minHeight: 0, overflow: 'hidden', pl: k.fach ? '14px' : 0 }}>
            {(mittel ? zeilen.slice(0, 1) : zeilen).map((z, i) => (
              <Typography key={i} component="div" noWrap sx={{ fontSize: 12, lineHeight: '18px', color: z.art === 'mitklassen' ? 'text.disabled' : 'text.secondary', textDecoration: durch }}>
                <WerteListe werte={z.werte} entfall={entfall} abwesend={z.art === 'klassen' ? abw : undefined} offen={k.status === 'offen' && z.art === 'lehrer'} />
              </Typography>
            ))}
          </Box>
        )}
        {!kompakt && (pl.length > 0 || hatSymbole || zeit) && (
          <Stack direction="row" alignItems="center" gap={0.75} sx={{ mt: 'auto', pl: k.fach ? '14px' : 0, minWidth: 0, flex: 'none', flexWrap: 'nowrap', overflow: 'hidden', height: 15, '@container (max-width: 64px)': { display: 'none' } }}>
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
