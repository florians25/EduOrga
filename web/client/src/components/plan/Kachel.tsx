// Stundenkarte (design/DESIGN.md, Abschnitt 10 „Stundenkarte (alle Plattformen)“) nach der schulweiten Kartendarstellung
// (Administration | Darstellung der Stundenkarten, siehe darstellung.tsx). Standard „EduOrga Standard“: kompakte helle Karte, die ihre
// Rasterzelle füllt, 4-px-Leiste links (grau, mit Fachfarbe in der Fachfarbe samt leichter Tönung), darunter je eine Zeile Fach (600),
// Klasse, Lehrkraft, Raum. Kennzeichnung nach den gemeinsamen Regeln (aenderung.ts): durchgehende 3-px-Leiste und 5-px-Kennzeichen in der
// Statusfarbe, Tags „Gal (G̶o̶r̶)“, „105 (3̶0̶3̶)“, „neu B070“; Entfall rot und durchgestrichen („entfällt“, „verlegt auf …“); offen grau. Prüfung Bernstein, Veranstaltung als warmer Block ohne Kante, Buchung gestrichelt. Die übrigen Vorlagen
// (Klassisch, Kompakt, Sachlich …) ändern Fachfarbe, Fläche, Rahmen, Radius, Dichte und Zeilenfolge – die Statusdarstellung bleibt gleich.
// Die Bedeutung steht im aria-label und in der Kurzinfo beim Überfahren; Klick öffnet die Stundendetails.
import { memo, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { alpha, Box, Stack, Tooltip, Typography, useTheme, type Theme } from '@mui/material';
import LinkRounded from '@mui/icons-material/LinkRounded';
import EditNoteRounded from '@mui/icons-material/EditNoteRounded';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import type { Karte } from '../../api/types';
import { artVon, gueltigeFarbe, infoText, istEntfall, istOnline, plaketten, sichererLink, statusText, titelText, KACHEL_PLAKETTEN, type Typ, type Plakette } from './logik';
import { wertText } from './Werte';
import { istTerminBlock, kartenbild, type Kartenbild, type Kartenzeile, type Statusfeld, type Teil, type Ton } from './aenderung';
import { useKollegium } from '../../app/sitzung';
import { DICHTE, mitToenung, nameVon, STANDARD, useDarstellung, type Kartendarstellung, type Namen } from './darstellung';

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

/** Leiste links in der Statusfarbe (Änderung grün, Entfall rot, offen grau) – durchgehend, 3 px. */
export const leiste = (farbe: string, offen = false) => (offen ? `repeating-linear-gradient(180deg, ${farbe} 0 4px, transparent 4px 7px)` : farbe);

/** Tag auf der Karte: „Gal (G̶o̶r̶)“, „105 (3̶0̶3̶)“, „neu B070“, „entfällt“ – getönt mit feiner Linie (offen gestrichelt), Radius 3, Schrift ≥ 5:1 (WCAG AA), nie durchgestrichen. */
export function Feld({ ton, children, titel, klein = false, alt }: { ton: Ton; children: ReactNode; titel?: string; klein?: boolean; /** bisheriger Wert: „neu (b̶i̶s̶h̶e̶r̶)“ */ alt?: string }) {
  return (
    <Box component="span" title={titel} data-feld={ton}
      sx={{ display: 'inline-flex', alignItems: 'center', gap: '3px', maxWidth: '100%', height: klein ? 15 : 16, px: '3px', borderRadius: '3px', fontSize: klein ? 11 : 12, lineHeight: 1,
        fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'middle', boxSizing: 'border-box',
        bgcolor: ton === 'offen' ? 'status.offen.feld' : `status.${ton}.flaeche`, color: `status.${ton}.text`, border: '1px', borderStyle: ton === 'offen' ? 'dashed' : 'solid',
        borderColor: (t: Theme) => mischen((t.vars ?? t).palette.status[ton].main, ton === 'offen' ? 0.9 : 0.55), textDecoration: 'none', fontVariantNumeric: 'tabular-nums' }}>{children}{alt && <Box component="span" sx={{ fontWeight: 500 }}>{' ('}<Box component="s" sx={{ textDecorationThickness: '1px' }}>{alt}</Box>)</Box>}</Box>
  );
}

/** Status-Tag unten auf der Karte („entfällt“, „verlegt → Di 21.10., 6. Std“, „verlegt ← …“, „zusätzlich“). */
export function StatusFeld({ s, klein }: { s: Statusfeld; klein?: boolean }) {
  return <Feld ton={s.ton} titel={s.titel} klein={klein}>{s.text}</Feld>;
}

/** Teile einer Zeile: Text bzw. Felder, durch Komma getrennt. */
function Teile({ teile, anzeige }: { teile: Teil[]; anzeige?: (t: string) => string }) {
  return (
    <>
      {teile.map((t, i) => (
        <Box component="span" key={i}>
          {i > 0 && ', '}
          {t.feld ? <Feld ton={t.feld} titel={t.titel} alt={t.alt}>{t.text}</Feld> : (anzeige ? anzeige(t.text) : t.text)}
        </Box>
      ))}
    </>
  );
}

/**
 * Fläche und Rahmen je Art nach der Kartendarstellung: Grundfläche (neutral, weiß, getönt), Rahmen (fein, kräftig, Schatten, keiner),
 * optional leichte Tönung in der Fachfarbe. Änderung: grüne Statusfläche, Entfall: rote Fläche – nie in der Fachfarbe getönt.
 */
export function kachelStil(k: Karte, typ: Typ, t: Theme, d: Kartendarstellung = STANDARD, bild: Kartenbild = kartenbild(k, typ)): CSSProperties & Record<string, unknown> {
  const art = artVon(k, typ);
  const pal = (t.vars ?? t).palette;
  const papier = pal.background.paper;
  const kraeftig = d.rahmen === 'kraeftig';
  const breite = kraeftig ? 2 : 1;
  const linie = d.rahmen === 'keiner' || d.rahmen === 'schatten' ? 'transparent' : kraeftig ? mischen(pal.text.primary, 0.42) : pal.kachel.rand;
  // „Schatten“: helle Karte ohne Linie, leicht abgehoben (eigene, sehr flache Schattenkante)
  const schatten = d.rahmen === 'schatten' ? { boxShadow: '0 1px 1.5px rgba(12,44,49,.14), 0 0 0 0.5px rgba(12,44,49,.07)' } : {};
  const grund = d.flaeche === 'neutral' ? pal.kachel.flaeche : papier;
  const bilder: string[] = [];
  const fach = gueltigeFarbe(k.farbe);
  const s = pal.status;
  const statusLinie = (farbe: string, stil: 'solid' | 'dashed' = 'solid') => `${breite}px ${stil} ${farbe}`;
  if (bild.ton === 'entfall') return { backgroundColor: s.entfall.flaeche, border: statusLinie(mischen(s.entfall.main, 0.3)), ...schatten };
  if (istTerminBlock(k)) return { backgroundColor: pal.kachel.ereignis, border: `1px solid ${pal.kachel.ereignisRand}`, color: pal.kachel.ereignisText };
  if (art === 'pruefung') return { backgroundColor: d.statusflaeche ? s.pruefung.flaeche : grund, border: statusLinie(s.pruefung.main), ...schatten };
  if (art === 'buchung') return { backgroundColor: papier, border: statusLinie(s.frei.main, 'dashed') };
  if (bild.ton === 'aenderung') return { backgroundColor: d.statusflaeche ? s.aenderung.flaeche : grund, border: statusLinie(mischen(s.aenderung.main, 0.4)), ...schatten };
  if (bild.ton === 'offen') return { backgroundColor: grund, border: `1px dashed ${mischen(s.offen.main, 0.9)}` };
  if (mitToenung(d.fachfarbe) && fach) { const ton = mischen(fach, d.deckkraft / 100); bilder.push(`linear-gradient(${ton}, ${ton})`); }
  if (d.flaeche === 'getoent') { const ton = mischen(pal.primary.main, 0.05); bilder.push(`linear-gradient(${ton}, ${ton})`); }
  return { backgroundColor: grund, border: `1px solid ${linie}`, ...schatten, ...(bilder.length ? { backgroundImage: bilder.join(', ') } : {}) };
}

/** Kurzinfo beim Überfahren: alle Angaben der Stunde. */
export function KachelInfo({ k, typ }: { k: Karte; typ: Typ }) {
  const entfall = istEntfall(k, typ);
  const bild = kartenbild(k, typ, { kollegium: useKollegium() });
  const zeile = (titel: string, inhalt: ReactNode) => (
    <Stack direction="row" gap={1.5}><Typography variant="caption" sx={{ color: 'text.secondary', width: 66, flex: 'none' }}>{titel}</Typography><Typography variant="body2" component="div">{inhalt}</Typography></Stack>
  );
  const st = entfall ? 'Entfall' : statusText(k);
  return (
    <Box sx={{ minWidth: 220, maxWidth: 320 }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 0.75 }}>
        {gueltigeFarbe(k.farbe) && <FachQuadrat farbe={k.farbe} groesse={10} />}
        <Typography sx={{ fontWeight: 600 }}>{k.fachName || k.fach || k.text || k.art}</Typography>
        {st && k.status !== 'regulaer' && <Typography variant="caption" sx={{ ml: 'auto', fontWeight: 600, color: entfall ? 'status.entfall.main' : 'status.aenderung.text' }}>{st}</Typography>}
      </Stack>
      <Stack gap={0.25}>
        {zeile('Zeit', `${k.von === k.bis ? `${k.von}.` : `${k.von}.–${k.bis}.`} Std. · ${k.beginn}–${k.ende}`)}
        {k.klassen?.length > 0 && zeile('Klasse', [...k.klassen, ...(k.mitklassen || [])].map(wertText).join(', '))}
        {k.lehrer?.length > 0 && zeile('Lehrkraft', k.lehrer.map(wertText).join(', '))}
        {istOnline(k, typ) ? zeile('Raum', 'Online-Unterricht') : k.raeume?.length > 0 && zeile('Raum', k.raeume.map(wertText).join(', '))}
        {k.fachAlt && zeile('Fach', `${k.fachAlt} → ${k.fach}`)}
        {bild.status && zeile('Status', bild.status.titel)}
        {infoText(k).map((t, i) => <Typography key={i} variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>{t}</Typography>)}
        {k.hausaufgabeFaellig && <Typography variant="body2" sx={{ mt: 0.5 }}>Hausaufgabe fällig</Typography>}
      </Stack>
    </Box>
  );
}

/** Zugänglicher Name der Karte: ausgeschrieben, mit jeder Änderung (z. B. „Mathematik, 3. Stunde 09:45–10:30, Raumänderung: 105 statt 303“). */
export function sprechtext(k: Karte, _typ: Typ, bild: Kartenbild): string {
  const art: Record<string, string> = { 'klasse-fehlt': 'Klasse fehlt', 'lehrer-fehlt': 'Lehrkraft fehlt, Vertretung folgt', vertretungsentfall: 'Vertretungsentfall', entfall: 'Entfall',
    lehrervertretung: 'Lehrervertretung', raumaenderung: 'Raumänderung', fachaenderung: 'Fachänderung', 'verschoben-auf': 'verschoben', 'verschoben-von': 'hierher verschoben',
    zusatz: 'Zusatzunterricht', hinzugefuegt: 'hinzugekommen', klassenaenderung: 'Klassenänderung' };
  const zeit = `${k.von === k.bis ? `${k.von}.` : `${k.von}. bis ${k.bis}.`} Stunde${k.beginn ? `, ${k.beginn} bis ${k.ende}` : ''}`;
  const felder = bild.zeilen.flatMap(z => z.teile.filter(t => t.feld && t.titel).map(t => t.titel!));
  return [k.fachName || k.fach || k.text, zeit, titelText(k).split(' · ').slice(1).join(', '), ...bild.typen.map(x => art[x]).filter(Boolean),
    ...felder, bild.status?.titel].filter(Boolean).join('. ');
}

export interface KachelProps {
  k: Karte; typ: Typ; hoehe?: number; onOpen?: (k: Karte) => void; gedimmt?: boolean; vorbei?: boolean; zeit?: string | null; style?: CSSProperties; gross?: boolean;
}

/** Zeilenfolge nach der Darstellung: „zeilen“ Fach · Klasse · Lehrkraft · Raum; „element“ Lehrkraft bzw. Klasse oben; „fach“ Fach und Raum oben. */
function geordnet(zeilen: Kartenzeile[], d: Kartendarstellung, typ: Typ): Kartenzeile[] {
  if (d.reihenfolge !== 'element') return zeilen;
  const oben = typ === 'klasse' ? 'lehrer' : 'klassen';
  const i = zeilen.findIndex(z => z.art === oben);
  return i > 0 ? [zeilen[i], ...zeilen.filter((_, j) => j !== i)] : zeilen;
}

/** Zeilen, die in die Höhe passen: das Fach bleibt, Änderungen gehen vor, unveränderte Zeilen entfallen von unten. */
function passend(zeilen: Kartenzeile[], platz: number): Kartenzeile[] {
  if (zeilen.length <= platz) return zeilen;
  const behalten = new Set<Kartenzeile>([zeilen[0]]);
  for (const z of zeilen) if (behalten.size < platz && z.geaendert) behalten.add(z);
  for (const z of zeilen) if (behalten.size < platz) behalten.add(z);
  return zeilen.filter(z => behalten.has(z));
}

export const Kachel = memo(function Kachel({ k, typ, hoehe = 64, onOpen, gedimmt, vorbei, zeit, style, gross }: KachelProps) {
  const t = useTheme();
  const { d, namen } = useDarstellung();
  const pal = (t.vars ?? t).palette;
  const dichte = DICHTE[d.dichte];
  const kollegium = useKollegium();
  const bild = kartenbild(k, typ, { kollegium });
  const entfall = bild.entfall;
  const art = artVon(k, typ);
  const termin = istTerminBlock(k);
  const sehrKlein = hoehe < 30;
  // Zeile 2 (Lehrkraft bzw. Klasse) und Raum lassen sich ausblenden – geänderte Zeilen bleiben immer stehen
  const element = typ === 'klasse' ? 'lehrer' : 'klassen';
  let zeilen = geordnet(bild.zeilen, d, typ).filter(z => z.geaendert || ((z.art !== element || d.zeile2) && (z.art !== 'raeume' || d.raum)));
  const fachName = d.fach === 'name' && k.fachName && !k.fachAlt ? k.fachName : null;
  const alle = plaketten(k, typ);
  // Statuswörter: Verlegung und Zusatz stehen schon im Feld; Prüfung, Termin, Buchung und Vorgemerkt bleiben Wörter
  const pl = (d.statuswoerter ? alle : alle.filter(p => KACHEL_PLAKETTEN.has(p.text))).filter(p => !['Verlegt', 'Verlegung', 'Zusatz', 'Entfall'].includes(p.text) && !(termin && p.text === 'Termin'));
  const info = infoText(k);
  const online = istOnline(k, typ);
  const farbe = gueltigeFarbe(k.farbe);
  const stunde = !!k.fach || !!k.unterricht;
  // Kante links: Unterricht immer (grau ohne Fachfarbe), Änderung grün und Entfall rot schraffiert – auch bei Vorlagen ohne Balken
  const balkenVorlage = (d.fachfarbe === 'balken-links' || d.fachfarbe === 'balken-flaeche' || d.fachfarbe === 'balken-innen') && stunde;
  const kante = !termin && (bild.ton !== null || balkenVorlage);
  const kantenBreite = bild.ton ? 3 : Math.max(3, d.balkenbreite);
  const innen = d.fachfarbe === 'balken-innen';
  const balkenOben = d.fachfarbe === 'balken-oben' && stunde && !termin && !bild.ton ? d.balkenbreite : 0;
  const quadrat = d.fachfarbe === 'quadrat' && !!k.fach && !termin;
  const kantenFarbe = bild.ton ? pal.status[bild.ton].main : farbe ?? pal.kachel.balken;
  const einzugLinks = kante ? (innen ? 4 + kantenBreite + 4 : kantenBreite + 5) : dichte.px;
  const fachGroesse = dichte.fach + (gross ? 1 : 0) + 0.5;
  const zh = dichte.zeilenhoehe - 1;
  const py = sehrKlein ? 1 : Math.min(3, dichte.py);
  const statusH = bild.status ? 17 : 0;
  const unten = !sehrKlein && (pl.length > 0 || zeit || online || k.hausaufgabeFaellig || info.length > 0) ? 15 : 0;
  const platz = sehrKlein ? 1 : Math.max(1, Math.floor((hoehe - 2 * py - 2 - balkenOben - statusH - (termin ? 14 : 0) - (unten && !bild.status ? unten : 0) - dichte.kopf) / zh) + 1);
  zeilen = passend(zeilen, termin ? Math.min(platz, 3) : platz);
  const statusZeigen = !!bild.status && hoehe - 2 * py - dichte.kopf >= 15;
  const anzeige = (z: Kartenzeile) => (d.zeile2Text === 'name' && namen && z.art === element ? (x: string) => nameVon(namen as Namen, z.art === 'lehrer' ? 'lehrer' : 'klassen', x) : undefined);
  const tasten = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(k); } };
  const hover = entfall || termin ? {} : { filter: 'brightness(0.985)' };
  const durch = entfall ? 'line-through' : 'none';
  const textFarbe = entfall ? 'status.entfall.text' : termin ? 'kachel.ereignisText' : 'text.secondary';

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

  const zeilenInhalt = zeilen.map((z, i) => {
    const erste = i === 0;
    const raumRechts = d.reihenfolge === 'fach' && erste && z.art === 'fach' ? zeilen.find(x => x.art === 'raeume') : undefined;
    if (d.reihenfolge === 'fach' && !erste && z.art === 'raeume') return null;
    return (
      <Stack key={z.art} direction="row" alignItems="center" gap={0.75} sx={{ minWidth: 0, flex: 'none', height: erste ? dichte.kopf : zh }}>
        {erste && quadrat && <FachQuadrat farbe={k.farbe} />}
        <Typography component="div" noWrap data-zeile={z.art}
          sx={{ minWidth: 0, flex: '0 1 auto', fontSize: erste ? fachGroesse : dichte.zeile, lineHeight: `${erste ? dichte.kopf : zh}px`, fontWeight: erste || z.geaendert ? 600 : 400,
            color: erste ? (entfall ? 'status.entfall.main' : termin ? 'kachel.ereignisText' : 'text.primary') : textFarbe, textDecoration: durch, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {erste && fachName && z.art === 'fach' ? fachName : <Teile teile={z.teile} anzeige={anzeige(z)} />}
        </Typography>
        {raumRechts && (
          <Typography component="span" noWrap sx={{ ml: 'auto', fontSize: dichte.zeile, fontWeight: 500, color: textFarbe, textDecoration: durch, flex: 'none', maxWidth: '55%', textAlign: 'right', '@container (max-width: 76px)': { display: 'none' } }}>
            <Teile teile={raumRechts.teile} />
          </Typography>
        )}
      </Stack>
    );
  });

  return (
    <Tooltip title={<KachelInfo k={k} typ={typ} />} placement="right-start" enterDelay={450} enterNextDelay={300} disableInteractive
      slotProps={{ tooltip: { sx: { bgcolor: 'background.paper', color: 'text.primary', border: 1, borderColor: 'divider', boxShadow: '0 8px 24px rgba(21,26,33,.14)', p: 1.5, maxWidth: 360 } }, arrow: { sx: { color: 'background.paper', '&:before': { border: 1, borderColor: 'divider' } } } }}>
      <Box role="button" tabIndex={0} aria-label={sprechtext(k, typ, bild)} onClick={() => onOpen?.(k)} onKeyDown={tasten}
        data-karte="" data-art={art} data-ton={bild.ton ?? 'keiner'} data-fachfarbe={d.fachfarbe} data-typen={bild.typen.join(' ') || undefined}
        sx={{
          position: 'relative', ...kachelStil(k, typ, t, d, bild), borderRadius: `${d.eckenradius}px`, pl: `${termin ? dichte.px : einzugLinks}px`, pr: `${Math.min(dichte.px, 5)}px`, pt: `${py + balkenOben}px`, pb: `${py}px`,
          overflow: 'hidden', cursor: onOpen ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', gap: 0, fontVariantNumeric: 'tabular-nums',
          opacity: gedimmt ? 0.3 : vorbei ? 0.72 : 1, containerType: 'inline-size', transition: 'opacity .12s, filter .12s',
          '&:hover': { ...hover, zIndex: 3, opacity: 1 }, '&:focus-visible': { outline: `2px solid ${t.palette.primary.main}`, outlineOffset: 1, zIndex: 4 },
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          ...style,
        }}>
        {kante && <Box aria-hidden data-fachbalken={innen && !bild.ton ? 'innen' : bild.ton ? 'status' : 'links'} data-ohne-fachfarbe={farbe ? undefined : ''}
          sx={{ position: 'absolute', ...(innen && !bild.ton ? { left: 4, top: 4, bottom: 4, borderRadius: '2px' } : { left: 0, top: 0, bottom: 0 }), width: kantenBreite,
            background: leiste(kantenFarbe) }} />}
        {bild.ton && <Box aria-hidden data-kennzeichen={bild.ton} sx={{ position: 'absolute', top: 4, right: 4, width: 5, height: 5, borderRadius: 0, bgcolor: kantenFarbe, '@container (max-width: 44px)': { display: 'none' } }} />}
        {balkenOben > 0 && <Box aria-hidden data-fachbalken="oben" sx={{ position: 'absolute', left: 0, right: 0, top: 0, height: balkenOben, bgcolor: farbe ?? pal.kachel.balken }} />}
        {zeilenInhalt}
        {termin && hoehe >= 44 && <Typography component="div" noWrap sx={{ mt: 'auto', fontSize: 10.5, lineHeight: '14px', color: 'kachel.ereignisText', opacity: 0.85 }}>{k.beginn && k.ende ? `${k.beginn}–${k.ende}` : 'ganztägig'}</Typography>}
        {statusZeigen && bild.status && <Box sx={{ mt: 'auto', pt: '2px', minWidth: 0, display: 'flex', flex: 'none', '@container (max-width: 40px)': { display: 'none' } }}><StatusFeld s={bild.status} klein={!gross} /></Box>}
        {unten > 0 && (pl.length > 0 || hatSymbole || zeit) && (
          <Stack direction="row" alignItems="center" gap={0.75} sx={{ mt: statusZeigen ? '2px' : 'auto', minWidth: 0, flex: 'none', flexWrap: 'nowrap', overflow: 'hidden', height: 15, '@container (max-width: 64px)': { display: 'none' } }}>
            {pl.slice(0, 2).map((p, i) => <PlaketteChip key={i} p={p} klein={!gross} />)}
            {zeit && <Typography component="span" sx={{ fontSize: 11, color: 'text.secondary' }}>{zeit}</Typography>}
            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>{symbole}</Box>
          </Stack>
        )}
      </Box>
    </Tooltip>
  );
});
