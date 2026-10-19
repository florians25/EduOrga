// Raumübersicht: Belegungsraster Räume × Stunden (Tag) bzw. × Wochentage und Stunden (Woche) mit fester Kopfzeile und Raumspalte, Farben
// je Belegungsart, Details beim Überfahren, Filter (Suche, Gebäude, Raumart, Abteilung, Raumgruppe, Ausstattung, Kapazität, Verfügbarkeit),
// Zoom und Gruppen je Gebäude; auf dem Telefon eine Liste je Raum. Freie Stunde anklicken → Schnellbuchung, eigene Buchung → Storno.
import { useMemo, useState, type ReactNode } from 'react';
import { alpha, Box, Button, ButtonBase, Chip, IconButton, MenuItem, Paper, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import ApartmentOutlined from '@mui/icons-material/ApartmentOutlined';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import ScheduleRounded from '@mui/icons-material/ScheduleRounded';
import { holen, senden } from '../../api/client';
import type { Elemente } from '../../api/types';
import { useSitzung } from '../../app/sitzung';
import { Geladen, Leer, Seite } from '../../components/Seite';
import { FormDialog, Plakette, SuchFeld, Wahl } from '../../components/Bausteine';
import { DatumFeld } from '../../components/Auswahl';
import { heuteIso, istIsoDatum, jetztMinuten, minuten, montag, plusTage } from '../../lib/datum';
import { lesen, schreiben } from '../../lib/speicher';
import { toast } from '../../lib/meldungen';
import { navigieren } from '../../lib/router';
import { useLaden } from '../../lib/useLaden';
import { BASIS, BELEGT_TEXT, stdText, StornoDialog, tagKurz, tagLang, type Optionen, type Zeitraster } from './gemeinsam';

interface Belegung { stunde: number; art: string; text?: string; buchung?: number | null }
interface Raum { kurz: string; name: string; raumart?: string; kapazitaet?: number; gebaeude?: string; abteilung?: string; belegung: Record<string, Belegung[]> }
interface Uebersicht { zeitraster: Zeitraster[]; tage: { datum: string; frei: boolean; grund?: string }[]; raeume: Raum[] }
interface Lauf { art: string; text?: string; buchung?: number | null; von: number; bis: number; n: number; datum: string }
const ZUSTAND: Record<string, string> = { ...BELEGT_TEXT, frei: 'frei', vergangen: 'vergangen', tagfrei: 'unterrichtsfrei' };
const SERVERFILTER = ['raumart', 'gebaeude', 'abteilung', 'raumgruppe', 'ressourcenarten', 'kapazitaet'] as const;
type Filter = Record<(typeof SERVERFILTER)[number] | 'frei' | 'suche', string>;
let merkFilter: Filter = { raumart: '', gebaeude: '', abteilung: '', raumgruppe: '', ressourcenarten: '', kapazitaet: '', frei: '', suche: '' };

export function useFarben() {
  const t = useTheme();
  const s = t.palette.status;
  return (art: string): { bg: string; rand: string; text: string } => {
    switch (art) {
      case 'unterricht': return { bg: alpha(t.palette.primary.main, 0.13), rand: alpha(t.palette.primary.main, 0.35), text: t.palette.primary.main };
      case 'buchung': return { bg: s.aenderung.flaeche, rand: alpha(s.aenderung.main, 0.4), text: s.aenderung.main };
      case 'klausur': return { bg: s.pruefung.flaeche, rand: alpha(s.pruefung.main, 0.45), text: s.pruefung.main };
      case 'termin': return { bg: s.termin.flaeche, rand: alpha(s.termin.main, 0.4), text: s.termin.main };
      case 'vorgemerkt': return { bg: alpha(s.aenderung.main, 0.06), rand: alpha(s.aenderung.main, 0.5), text: s.aenderung.main };
      case 'gesperrt': return { bg: s.entfall.flaeche, rand: alpha(s.entfall.main, 0.4), text: s.entfall.main };
      case 'tagfrei': return { bg: s.frei.flaeche, rand: 'transparent', text: t.palette.text.secondary };
      case 'vergangen': return { bg: t.palette.action.hover, rand: 'transparent', text: t.palette.text.disabled };
      default: return { bg: 'transparent', rand: t.palette.divider, text: t.palette.text.secondary };
    }
  };
}

export function Raumuebersicht({ rest }: { rest: string[] }) {
  const { elemente } = useSitzung();
  const t = useTheme();
  const mobil = useMediaQuery(t.breakpoints.down('md'));
  const farbe = useFarben();
  const [dP, wP] = rest;
  const woche = wP === 'woche';
  const [f, setF] = useState<Filter>(merkFilter);
  const filter = (w: Partial<Filter>) => { const n = { ...f, ...w }; merkFilter = n; setF(n); };
  const [zoom, setZoom] = useState(() => lesen('untplan:buchen:zoom', 'normal'));
  const [schnell, setSchnell] = useState<{ raum: Raum; datum: string; stunde: number } | null>(null);
  const [storno, setStorno] = useState<{ id: number; titel: string; datum: string; von: number; bis: number; raum: string } | null>(null);
  const opt = useLaden(async sig => ({ opt: await holen<Optionen>(`${BASIS}/optionen`, sig), el: await elemente() }), []);
  const heute = heuteIso();
  const o = opt.daten?.opt;
  const datum = istIsoDatum(dP) ? dP : o?.naechsterTag && o.naechsterTag > heute ? o.naechsterTag : heute;
  const start = woche ? montag(datum) : datum;
  const serverQ = SERVERFILTER.map(n => (f[n] ? `&${n}=${encodeURIComponent(f[n])}` : '')).join('');
  const g = useLaden(sig => (o ? holen<Uebersicht>(`${BASIS}/raumuebersicht?datum=${start}&tage=${woche ? o.tageProWoche : 1}${serverQ}`, sig) : Promise.resolve(null)), [o, start, woche, serverQ]);
  const ziel = (d = datum, w = woche) => navigieren(`#/buchen/raeume/${d}${w ? '/woche' : ''}`);

  const daten = useMemo(() => {
    const u = g.daten;
    if (!u) return null;
    const raster = u.zeitraster.filter(z => z.nr > 0);
    const jetzt = jetztMinuten();
    const jetztStd = raster.find(z => minuten(z.beginn) <= jetzt && jetzt < minuten(z.ende))?.nr ?? null;
    const slot = (r: Raum, tg: Uebersicht['tage'][0], nr: number): Omit<Lauf, 'von' | 'bis' | 'n' | 'datum'> => {
      if (tg.frei) return { art: 'tagfrei', text: tg.grund || 'unterrichtsfrei' };
      const b = (r.belegung[tg.datum] ?? []).find(x => x.stunde === nr);
      if (b) return { art: b.art, text: b.text, buchung: b.buchung ?? null };
      return { art: tg.datum < heute ? 'vergangen' : 'frei' };
    };
    const laeufe = (r: Raum, tg: Uebersicht['tage'][0]) => {
      const l: Lauf[] = [];
      for (const z of raster) {
        const s = slot(r, tg, z.nr);
        const letzter = l[l.length - 1];
        if (letzter && s.art !== 'frei' && letzter.art === s.art && letzter.text === s.text && letzter.buchung === s.buchung) { letzter.bis = z.nr; letzter.n++; continue; }
        l.push({ ...s, von: z.nr, bis: z.nr, n: 1, datum: tg.datum });
      }
      return l;
    };
    const zeilen = u.raeume.map(r => {
      const tl = u.tage.map(tg => laeufe(r, tg));
      const frei = tl.flat().filter(x => x.art === 'frei').length;
      const offen = tl.flat().filter(x => x.art !== 'tagfrei' && x.art !== 'vergangen').reduce((s, x) => s + x.n, 0);
      return { r, tl, frei, offen, jetztFrei: u.tage.some(tg => tg.datum === heute && !tg.frei && !!jetztStd && slot(r, tg, jetztStd).art === 'frei') };
    });
    return { u, raster, jetztStd, slot, zeilen };
  }, [g.daten, heute]);

  const sichtbar = useMemo(() => {
    if (!daten) return [];
    const q = f.suche.toLowerCase();
    const frei = woche && /^\d+$/.test(f.frei) ? 'irgend' : f.frei;
    const l = daten.zeilen.filter(d => (!q || `${d.r.kurz} ${d.r.name} ${d.r.raumart} ${d.r.gebaeude} ${d.r.abteilung}`.toLowerCase().includes(q))
      && (frei !== 'irgend' || d.frei > 0) && (!/^\d+$/.test(frei) || daten.slot(d.r, daten.u.tage[0], Number(frei)).art === 'frei'));
    return l;
  }, [daten, f, woche]);
  const gruppieren = new Set(sichtbar.map(d => d.r.gebaeude || '')).size > 1 && !f.gebaeude;
  const reihe = gruppieren ? [...sichtbar].sort((a, b) => (a.r.gebaeude || '￿').localeCompare(b.r.gebaeude || '￿', 'de')) : sichtbar;
  const filterAktiv = SERVERFILTER.some(n => f[n]) || !!f.frei || !!f.suche;

  const info = (r: Raum, b: Lauf) => {
    const raster = daten!.raster;
    const zv = raster.find(z => z.nr === b.von), zb = raster.find(z => z.nr === b.bis);
    return (
      <Box sx={{ minWidth: 200 }}>
        <Stack direction="row" gap={1} alignItems="center"><Box sx={{ width: 10, height: 10, borderRadius: 1, bgcolor: farbe(b.art).text }} /><b>{ZUSTAND[b.art] ?? b.art}</b><Box sx={{ flex: 1 }} /><span>{r.kurz}</span></Stack>
        <div>{tagKurz(b.datum)}{b.art !== 'tagfrei' && ` · ${stdText(b.von, b.bis)} · ${zv?.beginn ?? ''}–${zb?.ende ?? ''} Uhr`}</div>
        {b.text && <div style={{ marginTop: 4 }}>{b.text}</div>}
        <div style={{ opacity: 0.75, marginTop: 4 }}>{[r.name !== r.kurz ? r.name : '', r.raumart, r.kapazitaet ? `${r.kapazitaet} Plätze` : '', r.gebaeude].filter(Boolean).join(' · ')}</div>
        {b.art === 'frei' ? <div style={{ marginTop: 4 }}>Anklicken, um den Raum zu buchen</div> : b.buchung && b.datum >= heute ? <div style={{ marginTop: 4 }}>Anklicken, um die Buchung zu stornieren</div> : null}
      </Box>
    );
  };
  const klick = (r: Raum, b: Lauf) => {
    if (b.art === 'frei' && o?.raumBuchen !== false) setSchnell({ raum: r, datum: b.datum, stunde: b.von });
    else if (b.buchung && b.datum >= heute) setStorno({ id: b.buchung, titel: b.text ?? 'Buchung', datum: b.datum, von: b.von, bis: b.bis, raum: r.kurz });
  };
  const freiZahl = (d: { frei: number; offen: number }) => <Plakette ton={d.frei === 0 ? 'entfall' : d.frei < d.offen / 3 ? 'pruefung' : 'ok'} title={`${d.frei} von ${d.offen} Stunden frei`}>{d.frei} frei</Plakette>;
  const meta = (r: Raum) => [r.name !== r.kurz ? r.name : '', r.kapazitaet ? `${r.kapazitaet} Pl.` : '', r.raumart].filter(Boolean).join(' · ');
  const zellH = zoom === 'kompakt' ? 26 : zoom === 'gross' ? 52 : 38;

  const tabelle = (): ReactNode => {
    const { u, raster, jetztStd } = daten!;
    const tage = u.tage;
    const n = tage.length * raster.length;
    const zelleB = woche ? (zoom === 'kompakt' ? 14 : zoom === 'gross' ? 30 : 20) : (zoom === 'kompakt' ? 56 : zoom === 'gross' ? 120 : 84);
    let gruppe: string | null = null;
    return (
      <Paper variant="outlined" sx={{ overflow: 'auto', maxHeight: 'calc(100dvh - 260px)', minHeight: 300 }} tabIndex={0} aria-label="Belegungsraster">
        <Box component="table" sx={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '100%', fontSize: zoom === 'kompakt' ? 11.5 : 12.5,
          '& th, & td': { borderBottom: 1, borderColor: 'divider', p: 0 }, '& thead th': { position: 'sticky', bgcolor: 'background.paper', zIndex: 2 },
          '& .raum': { position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1, borderRight: 1, borderColor: 'divider' } }}>
          <colgroup><col style={{ width: 170 }} />{Array.from({ length: n }, (_, i) => <col key={i} style={{ width: zelleB }} />)}</colgroup>
          <thead>
            {woche && <tr><th className="raum" style={{ top: 0, zIndex: 3 }} rowSpan={2}><Box sx={{ px: 1.5, textAlign: 'left' }}>Raum<Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{reihe.length} Räume</Typography></Box></th>
              {tage.map(tg => <th key={tg.datum} colSpan={raster.length} style={{ top: 0 }}><ButtonBase onClick={() => ziel(tg.datum, false)} sx={{ py: 0.75, width: '100%', fontWeight: 600, fontSize: 12.5, color: tg.datum === heute ? 'primary.main' : tg.frei ? 'text.disabled' : 'text.primary', borderLeft: 1, borderColor: 'divider' }}>{tagKurz(tg.datum)}</ButtonBase></th>)}</tr>}
            <tr>
              {!woche && <th className="raum" style={{ top: 0, zIndex: 3 }}><Box sx={{ px: 1.5, textAlign: 'left' }}>Raum<Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{reihe.length} Räume</Typography></Box></th>}
              {tage.map(tg => raster.map((z, j) => (
                <th key={tg.datum + z.nr} style={{ top: woche ? 33 : 0 }} title={`${z.beginn}–${z.ende}`}>
                  <Box sx={{ py: 0.5, borderLeft: woche && j === 0 ? 1 : 0, borderColor: 'divider', color: tg.datum === heute && z.nr === jetztStd ? 'primary.main' : String(z.nr) === f.frei ? 'primary.main' : 'text.secondary', fontWeight: 600 }}>
                    {z.nr}{!woche && zoom !== 'kompakt' && <Typography variant="caption" sx={{ display: 'block', fontWeight: 400 }}>{z.beginn}</Typography>}
                  </Box>
                </th>
              )))}
            </tr>
          </thead>
          <tbody>
            {reihe.map(d => {
              const geb = d.r.gebaeude || 'Ohne Gebäude';
              const kopf = gruppieren && geb !== gruppe ? (
                <tr key={'g' + geb}><th colSpan={n + 1} style={{ textAlign: 'left', position: 'sticky', left: 0 }}><Stack direction="row" gap={1} alignItems="center" sx={{ px: 1.5, py: 0.75, bgcolor: 'background.default', color: 'text.secondary', fontWeight: 600 }}><ApartmentOutlined fontSize="small" />{geb}<Typography variant="caption">{reihe.filter(x => (x.r.gebaeude || 'Ohne Gebäude') === geb).length} Räume</Typography></Stack></th></tr>
              ) : null;
              gruppe = geb;
              return [kopf, (
                <tr key={d.r.kurz}>
                  <th className="raum" scope="row" style={{ textAlign: 'left' }}>
                    <Box sx={{ px: 1.5, py: 0.5, opacity: d.frei ? 1 : 0.7 }}>
                      <Stack direction="row" gap={1} alignItems="center"><Typography sx={{ fontWeight: 600, fontSize: 13.5 }}>{d.r.kurz}</Typography>{freiZahl(d)}</Stack>
                      {zoom !== 'kompakt' && <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: 150 }}>{meta(d.r)}</Typography>}
                    </Box>
                  </th>
                  {d.tl.map((l, ti) => l.map(b => {
                    const c = farbe(b.art);
                    const aktiv = (b.art === 'frei' && o?.raumBuchen !== false) || (!!b.buchung && b.datum >= heute);
                    const jetztK = b.n === 1 && b.datum === heute && b.von === jetztStd;
                    return (
                      <td key={`${ti}-${b.von}`} colSpan={b.n} style={{ borderLeft: woche && b.von === daten!.raster[0]?.nr ? `1px solid ${t.palette.divider}` : undefined }}>
                        <Tooltip title={info(d.r, b)} disableInteractive enterDelay={250} placement="top">
                          <ButtonBase disabled={!aktiv && b.art === 'vergangen'} onClick={() => klick(d.r, b)} aria-label={`${d.r.kurz} ${tagKurz(b.datum)} ${stdText(b.von, b.bis)}: ${ZUSTAND[b.art] ?? b.art}`}
                            sx={{ width: '100%', height: zellH, p: 0.25, cursor: aktiv ? 'pointer' : 'default' }}>
                            <Box sx={{ width: '100%', height: '100%', borderRadius: 1.25, bgcolor: c.bg, border: 1, borderColor: jetztK ? 'primary.main' : c.rand, borderStyle: b.art === 'frei' || b.art === 'vorgemerkt' ? 'dashed' : 'solid',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', color: c.text, transition: 'background-color .1s',
                              '&:hover': aktiv ? { bgcolor: b.art === 'frei' ? alpha(t.palette.status.ok.main, 0.15) : c.bg, borderColor: b.art === 'frei' ? 'success.main' : c.rand } : {} }}>
                              {b.art === 'frei' ? <AddRounded sx={{ fontSize: 15, opacity: 0.35 }} />
                                : !woche && b.art !== 'vergangen' && zoom !== 'kompakt' ? <Typography noWrap sx={{ fontSize: zoom === 'gross' ? 12.5 : 11.5, px: 0.75, fontWeight: 500 }}>{b.text}</Typography> : null}
                            </Box>
                          </ButtonBase>
                        </Tooltip>
                      </td>
                    );
                  }))}
                </tr>
              )];
            })}
          </tbody>
        </Box>
      </Paper>
    );
  };

  const liste = (): ReactNode => {
    const { u } = daten!;
    let gruppe: string | null = null;
    return (
      <Stack gap={1.25}>
        {reihe.map(d => {
          const geb = d.r.gebaeude || 'Ohne Gebäude';
          const kopf = gruppieren && geb !== gruppe ? <Typography key={'g' + geb} variant="overline" color="text.secondary" sx={{ display: 'flex', gap: 0.75, alignItems: 'center', mt: 1 }}><ApartmentOutlined fontSize="small" />{geb}</Typography> : null;
          gruppe = geb;
          return [kopf, (
            <Paper key={d.r.kurz} variant="outlined" sx={{ p: 1.5 }}>
              <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 1 }}><Box sx={{ flex: 1 }}><Typography sx={{ fontWeight: 600 }}>{d.r.kurz}</Typography><Typography variant="caption" color="text.secondary">{meta(d.r)}</Typography></Box>{freiZahl(d)}</Stack>
              {u.tage.map((tg, i) => (
                <Box key={tg.datum} sx={{ mb: woche ? 0.75 : 0 }}>
                  {woche && <Typography variant="caption" color={tg.datum === heute ? 'primary.main' : 'text.secondary'} sx={{ fontWeight: 600 }}>{tagKurz(tg.datum)}</Typography>}
                  <Stack direction="row" gap={0.5} flexWrap="wrap">
                    {d.tl[i].map(b => { const c = farbe(b.art); return (
                      <ButtonBase key={b.von} onClick={() => klick(d.r, b)} sx={{ minWidth: 30 * b.n, height: 30, px: 0.75, borderRadius: 1.5, bgcolor: c.bg, border: 1, borderColor: c.rand, borderStyle: b.art === 'frei' ? 'dashed' : 'solid', color: c.text, fontSize: 12, fontWeight: 600 }}
                        aria-label={`${b.von === b.bis ? b.von : `${b.von}–${b.bis}`}. Stunde ${ZUSTAND[b.art] ?? b.art}`}>
                        {b.art === 'tagfrei' ? b.text : b.von === b.bis ? b.von : `${b.von}–${b.bis}`}
                      </ButtonBase>
                    ); })}
                  </Stack>
                </Box>
              ))}
              {!woche && (() => {
                const belegt = d.tl[0].filter(b => !['frei', 'vergangen', 'tagfrei'].includes(b.art));
                return belegt.length ? <Stack gap={0.25} sx={{ mt: 1 }}>{belegt.map(b => <Typography key={b.von} variant="body2" color="text.secondary"><Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, borderRadius: 1, bgcolor: farbe(b.art).text, mr: 0.75 }} /><b>{stdText(b.von, b.bis)}</b> {b.text}</Typography>)}</Stack> : null;
              })()}
            </Paper>
          )];
        })}
      </Stack>
    );
  };

  return (
    <Seite titel="Raumbelegung" aktionen={<>
      <Button variant="outlined" href="#/buchen/meine">Meine Buchungen</Button>
      {o?.raumBuchen !== false && <Button variant="contained" href="#/buchen/raum">Raum buchen</Button>}
    </>}
      filter={o && <>
        <SuchFeld wert={f.suche} onWert={s => filter({ suche: s })} platzhalter="Raum suchen" breite={200} />
        <Stack direction="row" alignItems="center" gap={0.5}>
          <IconButton onClick={() => ziel(plusTage(datum, woche ? -7 : -1))} aria-label={woche ? 'Woche zurück' : 'Tag zurück'}><ChevronLeftRounded /></IconButton>
          <DatumFeld label="Datum" wert={datum} onWert={d => d && ziel(d)} pflicht breite={160} />
          <IconButton onClick={() => ziel(plusTage(datum, woche ? 7 : 1))} aria-label={woche ? 'Woche weiter' : 'Tag weiter'}><ChevronRightRounded /></IconButton>
          <Button variant="outlined" size="small" onClick={() => ziel(heuteIso())}>Heute</Button>
        </Stack>
        <ToggleButtonGroup exclusive size="small" value={woche ? 'woche' : 'tag'} onChange={(_, v) => v && ziel(datum, v === 'woche')}><ToggleButton value="tag">Tag</ToggleButton><ToggleButton value="woche">Woche</ToggleButton></ToggleButtonGroup>
        {o.gebaeude.length > 0 && <Wahl label="Gebäude" wert={f.gebaeude} onWert={v => filter({ gebaeude: v })} alle="Alle" optionen={o.gebaeude.map(x => [x, x])} breite={150} />}
        {o.raumarten.length > 0 && <Wahl label="Raumart" wert={f.raumart} onWert={v => filter({ raumart: v })} alle="Alle" optionen={o.raumarten.map(x => [x, x])} breite={150} />}
        {o.abteilungen.length > 0 && <Wahl label="Abteilung" wert={f.abteilung} onWert={v => filter({ abteilung: v })} alle="Alle" optionen={o.abteilungen.map(x => [x, x])} breite={150} />}
        {o.raumgruppen.length > 0 && <Wahl label="Raumgruppe" wert={f.raumgruppe} onWert={v => filter({ raumgruppe: v })} alle="Alle" optionen={o.raumgruppen.map(x => [x, x])} breite={150} />}
        {o.ressourcenarten.length > 0 && <Wahl label="Ausstattung" wert={f.ressourcenarten} onWert={v => filter({ ressourcenarten: v })} alle="Alle" optionen={o.ressourcenarten.map(a => [String(a.id), a.name])} breite={160} />}
        <Wahl label="Kapazität" wert={f.kapazitaet} onWert={v => filter({ kapazitaet: v })} alle="Alle" optionen={[10, 15, 20, 25, 30, 40, 60].map(x => [String(x), `ab ${x} Plätzen`] as [string, string])} breite={150} />
        <Wahl label="Verfügbarkeit" wert={woche && /^\d+$/.test(f.frei) ? 'irgend' : f.frei} onWert={v => filter({ frei: v })} alle="Alle Räume" breite={190}
          optionen={[['irgend', 'Mit freien Stunden'], ...(woche ? [] : o.zeitraster.filter(z => z.nr > 0).map(z => [String(z.nr), `Frei in der ${z.nr}. Std.`] as [string, string]))]} />
        {filterAktiv && <Button size="small" onClick={() => filter({ raumart: '', gebaeude: '', abteilung: '', raumgruppe: '', ressourcenarten: '', kapazitaet: '', frei: '', suche: '' })}>Filter zurücksetzen</Button>}
      </>}>
      <Geladen g={opt}>{() => (
        <Geladen g={g}>{() => !daten ? null : (
          <>
            <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap" sx={{ mb: 1.5 }}>
              <Typography variant="body2"><b>{reihe.length}</b> {reihe.length === 1 ? 'Raum' : 'Räume'}{reihe.length < daten.u.raeume.length ? ` von ${daten.u.raeume.length}` : ''}</Typography>
              {daten.u.tage.some(tg => tg.datum === heute) && daten.jetztStd && <Chip size="small" icon={<ScheduleRounded />} label={`${reihe.filter(d => d.jetztFrei).length} jetzt frei (${daten.jetztStd}. Std.)`} />}
              {!woche && daten.u.tage[0]?.frei && <Plakette ton="frei">{daten.u.tage[0].grund || 'unterrichtsfrei'}</Plakette>}
              <Box sx={{ flex: 1 }} />
              <Stack direction="row" gap={1.25} flexWrap="wrap" sx={{ fontSize: 12.5, color: 'text.secondary' }} aria-label="Legende">
                {['unterricht', 'buchung', 'klausur', 'termin', 'vorgemerkt', 'gesperrt', 'frei'].map(a => (
                  <Stack key={a} direction="row" gap={0.5} alignItems="center"><Box sx={{ width: 12, height: 12, borderRadius: 0.75, bgcolor: farbe(a).bg, border: 1, borderColor: farbe(a).rand, borderStyle: a === 'frei' ? 'dashed' : 'solid' }} />{a === 'frei' ? 'frei – anklicken zum Buchen' : BELEGT_TEXT[a]}</Stack>
                ))}
              </Stack>
              {!mobil && <ToggleButtonGroup exclusive size="small" value={zoom} onChange={(_, v) => { if (v) { setZoom(v); schreiben('untplan:buchen:zoom', v); } }}>
                <ToggleButton value="kompakt">Kompakt</ToggleButton><ToggleButton value="normal">Normal</ToggleButton><ToggleButton value="gross">Groß</ToggleButton></ToggleButtonGroup>}
            </Stack>
            {reihe.length ? (mobil ? liste() : tabelle()) : <Leer text="Kein Raum passt zu den Filtern." aktion={filterAktiv ? { text: 'Filter zurücksetzen', onClick: () => filter({ raumart: '', gebaeude: '', abteilung: '', raumgruppe: '', ressourcenarten: '', kapazitaet: '', frei: '', suche: '' }) } : undefined} />}
          </>
        )}</Geladen>
      )}</Geladen>
      {schnell && opt.daten && daten && <Schnellbuchung {...schnell} opt={opt.daten.opt} el={opt.daten.el} raster={daten.raster} onClose={() => setSchnell(null)} fertig={() => void g.neu()} />}
      {storno && <StornoDialog b={{ id: storno.id, titel: storno.titel, datum: storno.datum, stundeVon: storno.von, stundeBis: storno.bis, raum: storno.raum }} onClose={() => setStorno(null)} fertig={() => void g.neu()} />}
    </Seite>
  );
}

/** Schnellbuchung aus der Raumübersicht: Raum und Stunde vorbelegt, bis-Stunde (nur durchgehend frei), Titel, Klassen, Bemerkung. */
function Schnellbuchung({ raum, datum, stunde, opt, el, raster, onClose, fertig }: { raum: Raum; datum: string; stunde: number; opt: Optionen; el: Elemente; raster: Zeitraster[]; onClose: () => void; fertig: () => void }) {
  const belegt = new Set((raum.belegung[datum] ?? []).map(x => x.stunde));
  const bisListe: Zeitraster[] = [];
  for (const z of raster.filter(x => x.nr >= stunde)) { if (belegt.has(z.nr)) break; bisListe.push(z); }
  const [bis, setBis] = useState(stunde);
  const [titel, setTitel] = useState('');
  const [klassen, setKlassen] = useState<string[]>([]);
  const [text, setText] = useState('');
  return (
    <FormDialog offen titel={`${raum.kurz} buchen`} untertitel={`${tagLang(datum)}${raum.kapazitaet ? ` · ${raum.kapazitaet} Plätze` : ''}${raum.name && raum.name !== raum.kurz ? ` · ${raum.name}` : ''}`} onClose={onClose} aktionText="Buchen"
      links={<Button onClick={() => { onClose(); navigieren(`#/buchen/raum/${datum}/${stunde}/${bis}/${encodeURIComponent(raum.kurz)}`); }}>Serie / weitere Optionen</Button>}
      aktion={async () => {
        await senden(BASIS, { art: 'raum', termine: [{ datum, stundeVon: stunde, stundeBis: bis, raum: raum.kurz }], ressourcen: [], klassen, lehrer: opt.ich || '', fach: '', titel, text, benachrichtigen: false, unterrichtId: null, beginn: null, ende: null });
        toast(`${raum.kurz} gebucht.`); fertig();
      }}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        <Stack direction="row" gap={2}>
          <TextField label="Von Stunde" value={`${stunde}. Stunde`} disabled sx={{ flex: 1 }} />
          <TextField select label="Bis Stunde" value={bis} onChange={e => setBis(Number(e.target.value))} sx={{ flex: 1 }}>{bisListe.map(z => <MenuItem key={z.nr} value={z.nr}>{z.nr}. Stunde ({z.ende})</MenuItem>)}</TextField>
        </Stack>
        <TextField label="Titel / Anlass" value={titel} onChange={e => setTitel(e.target.value)} placeholder="z. B. Projektarbeit" autoFocus slotProps={{ htmlInput: { maxLength: 200 } }} />
        <TextField select label="Klasse(n)" value={klassen} onChange={e => setKlassen(e.target.value as unknown as string[])} slotProps={{ select: { multiple: true } }}>{el.klassen.map(k => <MenuItem key={k.kurz} value={k.kurz}>{k.kurz}</MenuItem>)}</TextField>
        <TextField label="Bemerkung" value={text} onChange={e => setText(e.target.value)} placeholder="optional" slotProps={{ htmlInput: { maxLength: 1000 } }} />
      </Stack>
    </FormDialog>
  );
}

