// Wochenraster mit echtem Zeitmaßstab: Höhe proportional zur Uhrzeit, gerade 1-px-Linien, Pausen als schmale graue Bänder (mit
// Pausenaufsichten), Spaltenköpfe linksbündig „Mo 02.11.“, heutiger Tag mit Marine-Linie oben und sehr leichter Tönung, Jetzt-Linie 1 px
// mit Uhrzeit an der Zeitachse. Ferien und freie Tage als Fläche, ganztägige Termine und
// Hinweise im Tageskopf, eigene Abwesenheiten als graue Fläche hinter den Stunden.
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { alpha, Box, Stack, Tooltip, Typography, useTheme } from '@mui/material';
import LockOutlined from '@mui/icons-material/LockOutlined';
import type { Aufsicht, Karte, Tageskopf, Wochenplan, Zeit } from '../../api/types';
import { heuteIso, hhmm, jetztMinuten, minuten, wochentagKurz, datumKurz } from '../../lib/datum';
import { Kachel } from './Kachel';
import { artVon, aufsichtOrt, aufsichtTitel, aufsichtVertretung, freiText, spuren, tagHinweise, vergangen, type Art } from './logik';

export type Aufsichtsmodus = 'normal' | 'kompakt' | 'aus';

export interface RasterOptionen {
  /** Index des allein gezeigten Tages (Tagesansicht) oder null für die Woche. */
  nurTag?: number | null;
  kartenZeiten?: boolean;
  aufsichten?: Aufsichtsmodus;
  abwesenheiten?: boolean;
  /** hervorgehobene Arten (leer = alle normal) */
  fokus?: Set<Art>;
  oben?: number;
}

const PX_MIN = 64 / 45;   // 45 Minuten = 64 px
const MIN_PAUSE_AUFSICHT = 24;

interface Abschnitt { art: 'stunde' | 'pause'; von: number; bis: number; y: number; h: number; nr?: number; nach?: number; z?: Zeit }

/** Zeitmaßstab: Stunden und Pausen als Abschnitte, Lage einer Uhrzeit stückweise linear. */
export function zeitmassstab(zeiten: Zeit[], pausenMitAufsicht: Set<number>) {
  const ab: Abschnitt[] = [];
  let y = 0;
  zeiten.forEach((z, i) => {
    const b = minuten(z.beginn), e = Math.max(b + 5, minuten(z.ende));
    if (i > 0) {
      const vorher = ab[ab.length - 1];
      const luecke = b - vorher.bis;
      const mitAufsicht = pausenMitAufsicht.has(zeiten[i - 1].nr);
      const h = Math.max(luecke > 0 ? Math.max(4, luecke * PX_MIN) : 0, mitAufsicht ? MIN_PAUSE_AUFSICHT : 0);
      if (h > 0) { ab.push({ art: 'pause', von: vorher.bis, bis: Math.max(b, vorher.bis), y, h, nach: zeiten[i - 1].nr }); y += h; }
    }
    const h = (e - b) * PX_MIN;
    ab.push({ art: 'stunde', von: b, bis: e, y, h, nr: z.nr, z });
    y += h;
  });
  const letzte = zeiten[zeiten.length - 1];
  if (letzte && pausenMitAufsicht.has(letzte.nr)) { const v = ab[ab.length - 1]; ab.push({ art: 'pause', von: v.bis, bis: v.bis + 15, y, h: MIN_PAUSE_AUFSICHT, nach: letzte.nr }); y += MIN_PAUSE_AUFSICHT; }
  const yVon = (m: number) => {
    if (!ab.length) return 0;
    if (m <= ab[0].von) return 0;
    for (const a of ab) if (m <= a.bis) return a.y + (a.bis > a.von ? ((m - a.von) / (a.bis - a.von)) * a.h : 0);
    return y;
  };
  const stunde = new Map(ab.filter(a => a.art === 'stunde').map(a => [a.nr!, a]));
  const pause = new Map(ab.filter(a => a.art === 'pause').map(a => [a.nach!, a]));
  return { abschnitte: ab, hoehe: y, yVon, stunde, pause, beginn: ab[0]?.von ?? 0, ende: ab[ab.length - 1]?.bis ?? 0 };
}

/** Veranstaltungen eines Tages, die nicht schon als Kachel im Plan stehen (nicht ganztägig) – als Termin-Kachel. */
export function ereignisKarten(t: Tageskopf, karten: Karte[], zeiten: Zeit[]): Karte[] {
  const erste = zeiten[0]?.nr ?? 1, letzte = zeiten[zeiten.length - 1]?.nr ?? 10;
  return t.ereignisse.filter(x => !x.ganztaegig && !karten.some(k => k.text === x.titel && k.von <= x.bis && k.bis >= x.von)).map(x => {
    const von = Math.max(x.von, erste), bis = Math.min(x.bis, letzte);
    const zv = zeiten.find(z => z.nr === von), zb = zeiten.find(z => z.nr === bis);
    return {
      ereignis: true, datum: t.datum, von, bis, beginn: zv?.beginn ?? '', ende: zb?.ende ?? '', status: 'veranstaltung', fach: '', fachAlt: null, fachName: '', farbe: '',
      klassen: x.klassen.map(k => ({ k })), lehrer: x.lehrer.map(k => ({ k })), raeume: x.raeume.map(k => ({ k })), art: 'Veranstaltung', text: x.titel,
      vertretung: null, unterricht: null, gruppe: '', notizSchueler: '', notizLehrer: '', hausaufgabeFaellig: false, online: false, onlineLink: '', zusaetzlich: false,
      verlegung: null, verlegungVon: null, verlegungNach: null, marker: [], abwesendeKlassen: [], abwesendText: '', lehrerAbwesend: false, bereitschaft: false,
      vertretungOffen: false, mitklassen: [],
    } as Karte;
  });
}

function useJetzt() {
  const [jetzt, setJetzt] = useState(() => ({ tag: heuteIso(), min: jetztMinuten() }));
  useEffect(() => {
    const t = setInterval(() => setJetzt({ tag: heuteIso(), min: jetztMinuten() }), 30000);
    return () => clearInterval(t);
  }, []);
  return jetzt;
}

export function Wochenraster({ plan, onOpen, optionen = {}, kopfZusatz }: { plan: Wochenplan; onOpen: (k: Karte, liste: Karte[]) => void; optionen?: RasterOptionen; kopfZusatz?: (t: Tageskopf, i: number) => ReactNode }) {
  const t = useTheme();
  const { nurTag = null, kartenZeiten = false, aufsichten: aufsichtModus = 'normal', abwesenheiten = true, fokus, oben = 0 } = optionen;
  const jetzt = useJetzt();
  const zeiten = useMemo(() => plan.zeitraster.filter(z => z.beginn && z.ende), [plan.zeitraster]);
  const pausenMitAufsicht = useMemo(() => new Set(aufsichtModus === 'aus' ? [] : plan.aufsichten.map(a => a.nachStunde)), [plan.aufsichten, aufsichtModus]);
  const mass = useMemo(() => zeitmassstab(zeiten, pausenMitAufsicht), [zeiten, pausenMitAufsicht]);
  const tage = plan.tage.map((tag, i) => ({ tag, i })).filter(x => nurTag === null || x.i === nurTag);
  const alleKarten = useMemo(() => plan.karten.filter(k => !k.ereignis), [plan.karten]);
  const proTag = useMemo(() => new Map(plan.tage.map(tag => {
    const karten = plan.karten.filter(k => k.datum === tag.datum && mass.stunde.has(k.von));
    return [tag.datum, [...karten, ...ereignisKarten(tag, karten, zeiten)]];
  })), [plan, mass, zeiten]);

  if (!zeiten.length) return <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>Kein Zeitraster übertragen.</Box>;

  const heuteDrin = plan.tage.some(x => x.datum === jetzt.tag);
  const jetztY = heuteDrin && jetzt.min >= mass.beginn && jetzt.min <= mass.ende ? mass.yVon(jetzt.min) : null;
  const achse = 64;
  const spalten = `${achse}px repeat(${tage.length}, minmax(0, 1fr))`;
  const linie = t.palette.divider;
  const feineLinie = alpha(t.palette.text.primary, 0.075);
  const heuteTon = alpha(t.palette.primary.main, 0.028);

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Tageskopf (bleibt beim Scrollen stehen) */}
      <Box sx={{ display: 'grid', gridTemplateColumns: spalten, position: 'sticky', top: oben, zIndex: 6, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider', borderTopLeftRadius: 4, borderTopRightRadius: 4 }}>
        <Box sx={{ borderRight: `1px solid ${linie}` }} />
        {tage.map(({ tag, i }) => {
          const heute = tag.datum === jetzt.tag;
          const ganz = tag.ereignisse.filter(x => x.ganztaegig && !plan.karten.some(k => k.datum === tag.datum && k.text === x.titel));
          const hinweise = tagHinweise(tag.hinweise);
          return (
            <Box key={tag.datum} aria-current={heute ? 'date' : undefined} sx={{ px: 1, pt: 1, pb: 0.875, borderLeft: i === tage[0]?.i ? 0 : `1px solid ${linie}`, minWidth: 0,
              bgcolor: heute ? heuteTon : undefined, boxShadow: heute ? `inset 0 2px 0 ${t.palette.primary.main}` : undefined }}>
              <Stack direction="row" alignItems="baseline" gap={0.5} sx={{ minWidth: 0, fontSize: 13, lineHeight: '20px', color: heute ? 'primary.main' : 'text.primary' }}>
                <Box component="span" sx={{ fontWeight: 600 }}>{wochentagKurz(tag.datum)}</Box>
                <Box component="span" sx={{ fontWeight: 400, color: heute ? 'primary.main' : 'text.secondary' }}>{datumKurz(tag.datum)}</Box>
                {kopfZusatz?.(tag, i)}
              </Stack>
              {(ganz.length > 0 || hinweise.length > 0) && (
                <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.75 }}>
                  {ganz.map((x, j) => (
                    <Tooltip key={j} title={[x.titel, x.klassen.length ? `Klassen: ${x.klassen.join(', ')}` : '', x.lehrer.length ? `Lehrkräfte: ${x.lehrer.join(', ')}` : '', x.raeume.length ? `Räume: ${x.raeume.join(', ')}` : ''].filter(Boolean).join('\n')}
                      slotProps={{ tooltip: { sx: { whiteSpace: 'pre-line' } } }}>
                      <Box sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 0.75, maxWidth: '100%', px: 0.75, py: '1px', borderRadius: '2px', color: 'text.primary', fontSize: 12, border: `1px dashed ${alpha(t.palette.text.secondary, 0.6)}` }}>
                        <Box component="span" sx={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'status.termin.main', flex: 'none' }}>Termin</Box>
                        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.titel}</Box>
                      </Box>
                    </Tooltip>
                  ))}
                  {hinweise.map((h, j) => (
                    <Tooltip key={`h${j}`} title={h}>
                      <Box sx={{ maxWidth: '100%', px: 0.75, py: '1px', borderRadius: '2px', border: `1px solid ${linie}`, color: 'text.secondary', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h}</Box>
                    </Tooltip>
                  ))}
                </Stack>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Raster */}
      <Box sx={{ display: 'grid', gridTemplateColumns: spalten, position: 'relative' }}>
        {/* Zeitachse */}
        <Box sx={{ position: 'relative', height: mass.hoehe + 8, borderRight: `1px solid ${linie}` }}>
          {mass.abschnitte.map((a, j) => a.art === 'pause'
            ? <Box key={`p${j}`} sx={{ position: 'absolute', top: a.y, height: a.h, left: 0, right: 0, bgcolor: 'background.default' }} />
            : (
              <Box key={a.nr} sx={{ position: 'absolute', top: a.y, height: a.h, left: 0, right: 0, px: 1, pt: 0.75, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', borderBottom: `1px solid ${feineLinie}`, fontVariantNumeric: 'tabular-nums' }}>
                <Typography sx={{ fontWeight: 600, fontSize: 13, lineHeight: '16px' }}>{a.z!.bezeichnung || a.nr}</Typography>
                {!kartenZeiten && a.h >= 40 && <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: '14px', mt: '1px' }}>{a.z!.beginn}<br />{a.z!.ende}</Typography>}
              </Box>
            ))}
          {jetztY !== null && (
            <Box sx={{ position: 'absolute', top: jetztY - 8, right: 4, height: 16, px: 0.5, borderRadius: '2px', bgcolor: 'primary.main', color: 'primary.contrastText', fontSize: 10.5, fontWeight: 600, display: 'flex', alignItems: 'center', zIndex: 5, fontVariantNumeric: 'tabular-nums' }}>
              {hhmm(jetzt.min)}
            </Box>
          )}
        </Box>
        {tage.map(({ tag }) => {
          const heute = tag.datum === jetzt.tag;
          const karten = proTag.get(tag.datum) ?? [];
          const lage = spuren(karten);
          const frei = tag.frei;
          const ft = frei ? freiText(tag) : null;
          const aufs = aufsichtModus === 'aus' ? [] : plan.aufsichten.filter(a => a.datum === tag.datum && mass.pause.has(a.nachStunde));
          const proPause = new Map<number, Aufsicht[]>();
          aufs.forEach(a => proPause.set(a.nachStunde, [...(proPause.get(a.nachStunde) ?? []), a]));
          const abw = abwesenheiten ? (plan.abwesenheiten || []).filter(a => a.datum === tag.datum) : [];
          return (
            <Box key={tag.datum} sx={{ position: 'relative', height: mass.hoehe + 8, borderLeft: tag.datum === tage[0]?.tag.datum ? 0 : `1px solid ${linie}`, bgcolor: heute ? heuteTon : undefined }}>
              {/* Linien und Pausenbänder */}
              {mass.abschnitte.map((a, j) => a.art === 'pause'
                ? <Box key={j} sx={{ position: 'absolute', top: a.y, height: a.h, left: 0, right: 0, bgcolor: 'background.default' }} />
                : <Box key={j} sx={{ position: 'absolute', top: a.y + a.h - 1, left: 0, right: 0, borderTop: `1px solid ${feineLinie}` }} />)}
              {/* eigene Abwesenheit */}
              {abw.map((a, j) => {
                const y0 = mass.yVon(minuten(a.von)), y1 = mass.yVon(minuten(a.bis));
                if (y1 - y0 < 4) return null;
                const text = [{ verspaetet: 'Verspätet', vorzeitig: 'Vorzeitig gegangen' }[a.art] || 'Abwesend', a.grund].filter(Boolean).join(' · ');
                return (
                  <Tooltip key={`a${j}`} title={`${text} (${a.von}–${a.bis})`}>
                    <Box role="note" aria-label={`${text} (${a.von}–${a.bis})`} sx={{ position: 'absolute', top: y0, height: y1 - y0, left: 0, right: 0, zIndex: 0,
                      background: `repeating-linear-gradient(135deg, ${alpha(t.palette.text.secondary, 0.1)} 0 2px, transparent 2px 9px)`, borderTop: `2px solid ${alpha(t.palette.text.secondary, 0.4)}` }}>
                      <Typography sx={{ position: 'absolute', left: 6, top: 2, fontSize: 10, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{text}</Typography>
                    </Box>
                  </Tooltip>
                );
              })}
              {/* freie Tage */}
              {frei && ft && (
                <Box sx={{ position: 'absolute', inset: 0, zIndex: 1, bgcolor: 'status.frei.flaeche',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'status.frei.main', p: 1, gap: 0.25 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{ft.titel}</Typography>
                  {ft.name && <Typography variant="body2">{ft.name}</Typography>}
                  {ft.zeitraum && <Typography variant="caption">{ft.zeitraum}</Typography>}
                </Box>
              )}
              {/* Kacheln */}
              {karten.map((k, j) => {
                const { spur, anzahl } = lage.get(k)!;
                const sv = mass.stunde.get(k.von), sb = mass.stunde.get(k.bis) ?? mass.stunde.get(Math.min(k.bis, zeiten[zeiten.length - 1].nr)) ?? sv;
                if (!sv || !sb) return null;
                const y0 = sv.y + 2, h = sb.y + sb.h - sv.y - 4;
                const breite = 100 / anzahl;
                const zeit = kartenZeiten && h >= 56 && (anzahl === 1 || spur === 0) ? `${sv.z!.beginn}–${sb.z!.ende}` : null;
                const art = artVon(k, plan.typ);
                const gedimmt = !!fokus?.size && !fokus.has(art);
                return (
                  <Kachel key={j} k={k} typ={plan.typ} hoehe={h} zeit={zeit} gedimmt={gedimmt} vorbei={k.status === 'regulaer' && vergangen(k, jetzt.tag, jetzt.min)}
                    gross={nurTag !== null}
                    onOpen={k.ereignis ? undefined : x => onOpen(x, alleKarten)}
                    style={{ position: 'absolute', top: y0, height: h, left: `calc(${spur * breite}% + 3px)`, width: `calc(${breite}% - 6px)`, zIndex: 2 }} />
                );
              })}
              {/* Pausenaufsichten */}
              {[...proPause].map(([nach, liste]) => {
                const p = mass.pause.get(nach)!;
                const b = 100 / liste.length;
                return liste.map((a, j) => {
                  const v = aufsichtVertretung(a);
                  const vorbei = a.datum < jetzt.tag || (a.datum === jetzt.tag && minuten(a.ende) <= jetzt.min);
                  const ton = a.status === 'entfall' ? t.palette.status.entfall.main : a.status === 'vertretung' ? t.palette.status.aenderung.main : t.palette.text.secondary;
                  return (
                    <Tooltip key={`${nach}-${j}`} title={aufsichtTitel(a)}>
                      <Box sx={{ position: 'absolute', top: p.y + 3, height: Math.max(14, p.h - 6), left: `calc(${j * b}% + 3px)`, width: `calc(${b}% - 6px)`, zIndex: 2, borderRadius: '2px',
                        display: 'flex', alignItems: 'center', gap: 0.5, px: 0.75, fontSize: 11, fontWeight: 500, overflow: 'hidden', whiteSpace: 'nowrap', opacity: vorbei ? 0.55 : 1,
                        color: ton, bgcolor: 'background.paper', border: `1px ${a.status === 'vertreten' || a.status === 'entfall' ? 'dashed' : 'solid'} ${a.status === 'regulaer' || !a.status ? linie : alpha(ton, 0.55)}`,
                        textDecoration: a.status === 'entfall' ? 'line-through' : 'none' }}>
                        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Aufsicht {aufsichtOrt(a)}</Box>
                        {v && <Box component="span" sx={{ color: 'status.aenderung.main' }}>{v.neu}</Box>}
                      </Box>
                    </Tooltip>
                  );
                });
              })}
              {/* Jetzt-Linie */}
              {jetztY !== null && (
                <Fragment>
                  <Box sx={{ position: 'absolute', top: jetztY, left: 0, right: 0, borderTop: heute ? `1px solid ${t.palette.primary.main}` : `1px dashed ${alpha(t.palette.primary.main, 0.3)}`, zIndex: 4, pointerEvents: 'none' }} />
                  {heute && <Box sx={{ position: 'absolute', top: jetztY - 3, left: -3, width: 7, height: 7, borderRadius: '50%', bgcolor: 'primary.main', zIndex: 4, pointerEvents: 'none' }} />}
                </Fragment>
              )}
            </Box>
          );
        })}
        {plan.gesperrt && (
          <Box role="status" sx={{ position: 'absolute', inset: 0, zIndex: 7, display: 'grid', placeItems: 'center', bgcolor: alpha(t.palette.background.paper, 0.75), backdropFilter: 'blur(1px)' }}>
            <Box sx={{ textAlign: 'center', maxWidth: 420, p: 3 }}>
              <Box sx={{ width: 48, height: 48, borderRadius: 24, bgcolor: 'action.hover', display: 'grid', placeItems: 'center', mx: 'auto', mb: 1.5 }}><LockOutlined color="action" /></Box>
              <Typography sx={{ fontWeight: 600 }}>Es werden hier keine Termine angezeigt.</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{plan.sperrhinweis || 'Die Anzeige des Stundenplans ist durch die Administration beschränkt.'}</Typography>
            </Box>
          </Box>
        )}
      </Box>
      {linie && null}
    </Box>
  );
}
