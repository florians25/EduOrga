// Stundenkachel: Fachfarbe als Tönung, Kopfzeile Fach und Raum, darunter Lehrkraft bzw. Klasse; Status als Schraffur (Entfall),
// Petrol-Rahmen (Änderung), Bernstein (Prüfung), Violett gestrichelt (Termin), grau gestrichelt (Lehrkraft vertreten). Plaketten und
// Symbole (online, Hausaufgabe fällig, Notizen) unten. Überfahren zeigt eine Kurzinfo, Klick öffnet die Stundendetails.
import { memo, type CSSProperties, type KeyboardEvent } from 'react';
import { alpha, Box, Stack, Tooltip, Typography, useTheme, type Theme } from '@mui/material';
import VideocamOutlined from '@mui/icons-material/VideocamOutlined';
import EditNoteRounded from '@mui/icons-material/EditNoteRounded';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import type { Karte } from '../../api/types';
import { artVon, gueltigeFarbe, infoText, istEntfall, istOnline, kachelZeilen, kopfRaeume, plaketten, sichererLink, abwesendSet, statusText, titelText, type Typ, type Plakette } from './logik';
import { WerteListe, wertText } from './Werte';

export function PlaketteChip({ p, klein = false }: { p: Plakette; klein?: boolean }) {
  const t = useTheme();
  const farbe = p.ton === 'neutral' ? t.palette.text.secondary : t.palette.status[p.ton].main;
  const chip = (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', height: klein ? 16 : 18, px: 0.6, borderRadius: 1, fontSize: klein ? 9.5 : 10.5, fontWeight: 600,
      letterSpacing: '0.04em', textTransform: 'uppercase', color: p.ton === 'neutral' ? 'text.secondary' : '#fff', bgcolor: p.ton === 'neutral' ? alpha(farbe, 0.12) : farbe,
      whiteSpace: 'nowrap', flex: 'none' }}>{p.text}</Box>
  );
  return p.hinweis ? <Tooltip title={p.hinweis}>{chip}</Tooltip> : chip;
}

/** Hintergrund, Rahmen und Textfarbe je Art. */
export function kachelStil(k: Karte, typ: Typ, t: Theme): CSSProperties & Record<string, unknown> {
  const art = artVon(k, typ);
  const fach = gueltigeFarbe(k.farbe);
  const papier = t.palette.background.paper;
  const dunkel = t.palette.mode === 'dark';
  const ton = fach ? alpha(fach, dunkel ? 0.22 : 0.17) : alpha(t.palette.text.secondary, 0.07);
  const basis = { background: `linear-gradient(${ton}, ${ton}), ${papier}`, border: `1px solid ${fach ? alpha(fach, 0.45) : t.palette.divider}` };
  switch (art) {
    case 'entfall': return {
      background: `repeating-linear-gradient(135deg, ${alpha(t.palette.status.entfall.main, 0.11)} 0 1.5px, transparent 1.5px 7px), ${t.palette.status.entfall.flaeche}`,
      border: `1px solid ${alpha(t.palette.status.entfall.main, 0.35)}`, color: alpha(t.palette.text.primary, 0.72),
    };
    case 'aenderung': return { ...basis, border: `1.5px solid ${t.palette.status.aenderung.main}`, boxShadow: `inset 0 0 0 1px ${alpha(t.palette.status.aenderung.main, 0.12)}` };
    case 'pruefung': return { background: t.palette.status.pruefung.flaeche, border: `1.5px solid ${alpha(t.palette.status.pruefung.main, 0.7)}` };
    case 'termin': return { background: t.palette.status.termin.flaeche, border: `1.5px dashed ${alpha(t.palette.status.termin.main, 0.7)}` };
    case 'abwesend': return { background: `repeating-linear-gradient(135deg, ${alpha(t.palette.text.secondary, 0.07)} 0 1.5px, transparent 1.5px 7px), ${papier}`,
      border: `1.5px dashed ${alpha(t.palette.text.secondary, 0.55)}`, color: t.palette.text.secondary };
    case 'buchung': return { background: t.palette.status.frei.flaeche, border: `1.5px dashed ${alpha(t.palette.status.frei.main, 0.6)}` };
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
        {gueltigeFarbe(k.farbe) && <Box sx={{ width: 10, height: 10, borderRadius: 0.75, bgcolor: k.farbe }} />}
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
  const kompakt = hoehe < 46;
  const sehrKlein = hoehe < 30;
  const zeilen = kachelZeilen(k, typ);
  const raeume = kopfRaeume(k, typ);
  const pl = plaketten(k, typ);
  const info = infoText(k);
  const online = istOnline(k, typ);
  const titel = k.fach ? (k.fachAlt && !entfall ? <><Box component="s" sx={{ color: 'text.secondary', fontWeight: 400, mr: 0.4 }}>{k.fachAlt}</Box><Box component="span" sx={{ color: 'status.aenderung.main' }}>{k.fach}</Box></> : k.fach) : (k.text || k.art || '—');
  const abw = abwesendSet(k);
  const symbole = (
    <>
      {online && (k.onlineLink && sichererLink(k.onlineLink) ? (
        <Tooltip title="Online-Unterricht beitreten">
          <Box component="a" href={k.onlineLink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} aria-label="Online-Unterricht beitreten"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, height: 18, px: 0.6, borderRadius: 1, bgcolor: 'primary.main', color: '#fff', fontSize: 10.5, fontWeight: 600, textDecoration: 'none', flex: 'none' }}>
            <VideocamOutlined sx={{ fontSize: 13 }} />Online
          </Box>
        </Tooltip>
      ) : (
        <Tooltip title="Findet online statt">
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, height: 18, px: 0.6, borderRadius: 1, bgcolor: alpha(t.palette.primary.main, 0.12), color: 'primary.main', fontSize: 10.5, fontWeight: 600, flex: 'none' }}>
            <VideocamOutlined sx={{ fontSize: 13 }} />Online
          </Box>
        </Tooltip>
      ))}
      {k.hausaufgabeFaellig && <Tooltip title="Hausaufgabe fällig"><EditNoteRounded sx={{ fontSize: 16, color: 'text.secondary' }} aria-label="Hausaufgabe fällig" /></Tooltip>}
      {info.length > 0 && <Tooltip title={<Box sx={{ whiteSpace: 'pre-line' }}>{info.join('\n')}</Box>}><InfoOutlined sx={{ fontSize: 15, color: 'text.secondary' }} aria-label="Hinweis" /></Tooltip>}
    </>
  );
  const hatSymbole = online || k.hausaufgabeFaellig || info.length > 0;
  const tasten = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(k); } };
  return (
    <Tooltip title={<KachelInfo k={k} typ={typ} />} placement="right-start" enterDelay={450} enterNextDelay={300} disableInteractive
      slotProps={{ tooltip: { sx: { bgcolor: 'background.paper', color: 'text.primary', border: 1, borderColor: 'divider', boxShadow: '0 12px 32px rgba(21,26,33,.16)', p: 1.5, maxWidth: 360 } }, arrow: { sx: { color: 'background.paper', '&:before': { border: 1, borderColor: 'divider' } } } }}>
      <Box role="button" tabIndex={0} aria-label={titelText(k)} onClick={() => onOpen?.(k)} onKeyDown={tasten} data-karte=""
        sx={{
          position: 'relative', ...kachelStil(k, typ, t), borderRadius: 1.25, px: kompakt ? 0.75 : 0.9, py: sehrKlein ? 0 : kompakt ? 0.35 : 0.6, overflow: 'hidden', cursor: onOpen ? 'pointer' : 'default',
          display: 'flex', flexDirection: 'column', gap: 0.15, fontSize: 12.5, lineHeight: 1.25, color: entfall ? undefined : 'text.primary',
          opacity: gedimmt ? 0.28 : vorbei ? 0.62 : 1, transition: 'opacity .12s, box-shadow .12s, transform .12s',
          '&:hover': { boxShadow: '0 4px 14px rgba(21,26,33,.14)', zIndex: 3, opacity: 1 }, '&:focus-visible': { outline: `2px solid ${t.palette.primary.main}`, outlineOffset: 1 },
          ...style,
        }}>
        <Stack direction="row" alignItems="baseline" gap={0.75} sx={{ minWidth: 0 }}>
          <Typography component="span" noWrap sx={{ fontWeight: 600, fontSize: gross ? 14.5 : 13, textDecoration: entfall ? 'line-through' : 'none', minWidth: 0, flex: '0 1 auto' }}>{titel}</Typography>
          {kompakt && zeilen[0] && (
            <Typography component="span" noWrap sx={{ fontSize: 11.5, color: 'text.secondary', textDecoration: entfall ? 'line-through' : 'none', minWidth: 0 }}>
              <WerteListe werte={zeilen[0].werte} entfall={entfall} mitAlt={false} abwesend={zeilen[0].art === 'klassen' ? abw : undefined} />
            </Typography>
          )}
          {raeume.length > 0 && (
            <Typography component="span" noWrap sx={{ ml: 'auto', fontSize: 12, fontWeight: 500, color: 'text.secondary', textDecoration: entfall ? 'line-through' : 'none', flex: 'none', maxWidth: '55%' }}>
              <WerteListe werte={raeume} entfall={entfall} mitAlt={!kompakt} />
            </Typography>
          )}
        </Stack>
        {!kompakt && zeilen.map((z, i) => (
          <Typography key={i} component="div" noWrap sx={{ fontSize: 12, color: z.art === 'mitklassen' ? 'text.disabled' : 'text.secondary', textDecoration: entfall ? 'line-through' : 'none' }}>
            <WerteListe werte={z.werte} entfall={entfall} abwesend={z.art === 'klassen' ? abw : undefined} />
          </Typography>
        ))}
        {!kompakt && (pl.length > 0 || hatSymbole || zeit) && (
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 'auto', pt: 0.25, minWidth: 0, flexWrap: 'nowrap', overflow: 'hidden' }}>
            {pl.slice(0, hoehe >= 74 || gross ? 3 : 2).map((p, i) => <PlaketteChip key={i} p={p} klein={!gross} />)}
            {zeit && <Typography component="span" sx={{ fontSize: 11, color: 'text.secondary' }}>{zeit}</Typography>}
            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.4 }}>{symbole}</Box>
          </Stack>
        )}
        {kompakt && !sehrKlein && pl[0] && <Box sx={{ position: 'absolute', right: 3, bottom: 2 }}><PlaketteChip p={pl[0]} klein /></Box>}
      </Box>
    </Tooltip>
  );
});
