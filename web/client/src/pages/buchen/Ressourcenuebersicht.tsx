// Ressourcenübersicht: Karten bzw. Liste mit Symbol je Art, Standort, Verfügbarkeit im gewählten Zeitraum (ganzer Tag oder Stunden von–bis),
// Belegungs-Zeitstrahl je Tag (Woche: je Wochentag) und Buchen direkt aus der Übersicht; ohne Ressourcen bietet die Administration
// Beispiel-Ressourcen an.
import { useEffect, useState } from 'react';
import { alpha, Box, Button, ButtonBase, Chip, FormControlLabel, IconButton, MenuItem, Paper, Stack, Switch, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography, useTheme } from '@mui/material';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import { holen, senden } from '../../api/client';
import { Geladen, Leer, Seite } from '../../components/Seite';
import { FormDialog, Plakette, SuchFeld, Wahl } from '../../components/Bausteine';
import { DatumFeld } from '../../components/Auswahl';
import { heuteIso, istIsoDatum, plusTage, WOCHENTAGE_KURZ } from '../../lib/datum';
import { lesen, schreiben } from '../../lib/speicher';
import { fehler, toast } from '../../lib/meldungen';
import { link, navigieren } from '../../lib/router';
import { useLaden } from '../../lib/useLaden';
import { BASIS, ResSymbol, stdText, tagIndex, tagKurz, type Optionen, type Zeitraster } from './gemeinsam';

interface Res {
  id: number; name: string; art?: string; artId?: number; symbol?: string; mobil: boolean; standort?: string; raum?: string; anzahl: number; bemerkung?: string;
  gebucht?: Record<string, Record<string, number>>; belegung: Record<string, { von: number; bis: number; menge: number; text?: string; absender?: string }[]>;
}
interface RU { tage: { datum: string; frei: boolean; grund?: string }[]; ressourcen: Res[] }
let merk = { arten: new Set<number>(), suche: '', ort: '', nurFrei: false, von: 0, bis: 0 };

export function Ressourcenuebersicht({ rest }: { rest: string[] }) {
  const t = useTheme();
  const [dP, wP] = rest;
  const woche = wP === 'woche';
  const [f, setFRoh] = useState(merk);
  const setF = (w: Partial<typeof f>) => { const n = { ...f, ...w }; merk = n; setFRoh(n); };
  const [ansicht, setAnsicht] = useState(() => lesen('untplan:buchen:ressourcen', 'karten'));
  const [buchen, setBuchen] = useState<{ r: Res; datum: string; von: number; bis: number } | null>(null);
  const og = useLaden(sig => holen<Optionen>(`${BASIS}/optionen`, sig), []);
  const opt = og.daten;
  const heute = heuteIso();
  const datum = istIsoDatum(dP) ? dP : opt?.naechsterTag && opt.naechsterTag > heute ? opt.naechsterTag : heute;
  const g = useLaden(sig => holen<RU>(`${BASIS}/ressourcenuebersicht?datum=${datum}${woche ? '' : '&tage=1'}`, sig), [datum, woche]);
  const raster: Zeitraster[] = (opt?.zeitraster ?? []).filter(z => z.nr > 0);
  useEffect(() => {
    if (raster.length && (!raster.some(z => z.nr === f.von) || !raster.some(z => z.nr === f.bis) || f.bis < f.von)) setF({ von: raster[0].nr, bis: raster[raster.length - 1].nr });
  }, [raster.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const ziel = (d = datum, w = woche) => navigieren(`#/buchen/ressourcen/${d}${w ? '/woche' : ''}`);
  const ganzerTag = () => f.von === raster[0]?.nr && f.bis === raster[raster.length - 1]?.nr;
  const zeitVon = (nr: number) => raster.find(z => z.nr === nr);
  const zrText = () => (ganzerTag() ? 'ganzer Tag' : `${stdText(f.von, f.bis)} (${zeitVon(f.von)?.beginn ?? ''}–${zeitVon(f.bis)?.ende ?? ''})`);
  const gebucht = (r: Res, d: string, st: number) => r.gebucht?.[d]?.[st] ?? 0;
  const verfuegbar = (r: Res, d = datum) => Math.min(...raster.filter(z => z.nr >= f.von && z.nr <= f.bis).map(z => r.anzahl - gebucht(r, d, z.nr)));
  const freieBloecke = (r: Res, d = datum) => {
    const bl: [number, number][] = [];
    raster.forEach((z, i) => {
      if (r.anzahl - gebucht(r, d, z.nr) <= 0) return;
      const l = bl[bl.length - 1];
      if (l && l[1] === raster[i - 1]?.nr) l[1] = z.nr; else bl.push([z.nr, z.nr]);
    });
    return bl;
  };
  const tag = g.daten?.tage.find(x => x.datum === datum) ?? g.daten?.tage[0];
  const zustand = (r: Res): { ton: 'ok' | 'pruefung' | 'entfall' | 'neutral'; text: string; v: number; wahl: [number, number]; frei?: string } => {
    if (tag?.frei) return { ton: 'neutral', text: tag.grund || 'unterrichtsfrei', v: 0, wahl: [f.von, f.bis] };
    if (ganzerTag()) {
      const bl = freieBloecke(r);
      const voll = Math.max(0, verfuegbar(r));
      const wahl = bl[0] ?? [f.von, f.bis];
      const anzahlFrei = bl.reduce((s, [v, b]) => s + raster.filter(z => z.nr >= v && z.nr <= b).length, 0);
      if (voll >= r.anzahl) return { ton: 'ok', text: r.mobil ? 'ganztägig verfügbar' : 'Raum ganztägig frei', v: voll, wahl, frei: 'ganztägig' };
      if (!bl.length) return { ton: 'entfall', text: r.mobil ? 'ausgebucht' : 'Raum belegt', v: 0, wahl };
      return { ton: 'pruefung', text: anzahlFrei >= raster.length ? 'teilweise gebucht' : `${anzahlFrei} von ${raster.length} Std. frei`, v: Math.max(1, voll), wahl, frei: bl.map(([v, b]) => (v === b ? `${v}.` : `${v}.–${b}.`)).join(', ') };
    }
    const v = Math.max(0, verfuegbar(r));
    const wahl: [number, number] = [f.von, f.bis];
    if (!r.mobil) return v > 0 ? { ton: 'ok', text: 'Raum frei', v, wahl } : { ton: 'entfall', text: 'Raum belegt', v, wahl };
    if (v >= r.anzahl) return { ton: 'ok', text: r.anzahl > 1 ? `alle ${r.anzahl} verfügbar` : 'verfügbar', v, wahl };
    return v > 0 ? { ton: 'pruefung', text: `${v} von ${r.anzahl} verfügbar`, v, wahl } : { ton: 'entfall', text: 'ausgebucht', v, wahl };
  };
  const darfBuchen = (r: Res, d: string) => r.mobil && opt?.ressourcenBuchen !== false && d >= heute;
  const s = t.palette.status;

  const strahl = (r: Res, tg: RU['tage'][0]) => (
    <Stack direction="row" gap={0.25} sx={{ flex: 1 }}>
      {raster.map(z => {
        const gb = gebucht(r, tg.datum, z.nr);
        const anteil = tg.frei ? 0 : Math.min(1, gb / r.anzahl);
        const farbe = tg.frei ? t.palette.action.disabledBackground : gb <= 0 ? s.ok.main : gb >= r.anzahl ? s.entfall.main : s.pruefung.main;
        const zr = tg.datum === datum && !ganzerTag() && z.nr >= f.von && z.nr <= f.bis;
        const klick = !tg.frei && gb < r.anzahl && darfBuchen(r, tg.datum);
        const eintraege = (r.belegung[tg.datum] ?? []).filter(x => x.von <= z.nr && x.bis >= z.nr);
        const titel = tg.frei ? tg.grund || 'unterrichtsfrei' : (
          <Box><b>{r.mobil ? (gb <= 0 ? (r.anzahl > 1 ? `alle ${r.anzahl} verfügbar` : 'verfügbar') : gb >= r.anzahl ? 'ausgebucht' : `${r.anzahl - gb} von ${r.anzahl} verfügbar`) : gb ? `Raum ${r.raum} belegt` : `Raum ${r.raum} frei`}</b>
            <div>{tagKurz(tg.datum)} · {z.nr}. Std. · {z.beginn}–{z.ende} Uhr</div>
            {r.mobil && eintraege.map((x, i) => <div key={i}>{x.menge > 1 ? `${x.menge}× ` : ''}{x.text || 'Buchung'}{x.absender ? ` (${x.absender})` : ''}</div>)}
            {klick && <div style={{ marginTop: 4 }}>Anklicken, um diese Stunde zu buchen</div>}</Box>
        );
        return (
          <Tooltip key={z.nr} title={titel} disableInteractive>
            <ButtonBase disabled={!klick} onClick={() => setBuchen({ r, datum: tg.datum, von: z.nr, bis: z.nr })} aria-label={`${r.name} ${tagKurz(tg.datum)} ${z.nr}. Stunde`}
              sx={{ flex: 1, height: 22, borderRadius: 1, position: 'relative', overflow: 'hidden', bgcolor: alpha(farbe, tg.frei ? 1 : 0.14), opacity: tg.datum < heute ? 0.5 : 1,
                outline: zr ? `2px solid ${t.palette.primary.main}` : 'none', outlineOffset: -1, '&:hover': klick ? { bgcolor: alpha(farbe, 0.3) } : {} }}>
              <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: `${anteil * 100}%`, bgcolor: alpha(farbe, 0.55) }} />
            </ButtonBase>
          </Tooltip>
        );
      })}
    </Stack>
  );
  const achse = <Stack direction="row" gap={0.25} sx={{ flex: 1 }}>{raster.map(z => <Typography key={z.nr} variant="caption" color="text.secondary" sx={{ flex: 1, textAlign: 'center', fontSize: 10.5 }}>{z.nr}</Typography>)}</Stack>;
  const zeitstrahl = (r: Res, nurTag = false) => (woche && !nurTag && g.daten ? (
    <Stack gap={0.5}>
      {g.daten.tage.map(tg => <Stack key={tg.datum} direction="row" gap={1} alignItems="center"><ButtonBase onClick={() => ziel(tg.datum, true)} sx={{ width: 22, fontSize: 11.5, fontWeight: 600, color: tg.datum === heute ? 'primary.main' : tg.datum === datum ? 'text.primary' : 'text.secondary' }}>{WOCHENTAGE_KURZ[tagIndex(tg.datum)]}</ButtonBase>{strahl(r, tg)}</Stack>)}
      <Stack direction="row" gap={1}><Box sx={{ width: 22 }} />{achse}</Stack>
    </Stack>
  ) : tag ? <Stack gap={0.25}>{strahl(r, tag)}{achse}</Stack> : null);
  const ort = (r: Res) => (r.mobil ? <span>{r.standort || 'kein Standort'}</span>
    : <span>fest in {r.raum}</span>);
  const knopf = (r: Res, zz: ReturnType<typeof zustand>) => {
    if (tag?.frei) return null;
    const [v, b] = zz.wahl;
    if (!r.mobil) return opt?.raumBuchen === false || datum < heute || zz.v <= 0 ? null : <Button size="small" variant="outlined" href={`#/buchen/raum/${datum}/${v}/${b}/${encodeURIComponent(r.raum ?? '')}`}>Raum buchen</Button>;
    if (!darfBuchen(r, datum)) return null;
    return zz.v > 0 ? <Button size="small" variant="outlined" onClick={() => setBuchen({ r, datum, von: v, bis: b })}>Buchen</Button>
      : <Button size="small" variant="outlined" onClick={() => setBuchen({ r, datum, von: v, bis: b })}>Andere Zeit</Button>;
  };
  // Geräteart als einfarbiges Symbol ohne Kachel (Erkennung in langen Listen)
  const symbol = (r: Res) => <Box sx={{ display: 'flex', color: 'text.secondary', flexShrink: 0, '& svg': { fontSize: 20 } }}><ResSymbol r={r} /></Box>;

  return (
    <Seite titel="Gerätebelegung" aktionen={opt && <>
      {opt.admin && <Button variant="outlined" href="#/buchen/verwaltung">Verwalten</Button>}
      {opt.ressourcenBuchen !== false && <Button variant="contained" href="#/buchen/ressource">Geräte &amp; Medien buchen</Button>}
    </>}
      filter={g.daten && opt && <>
        <SuchFeld wert={f.suche} onWert={x => setF({ suche: x })} platzhalter="Ressource oder Standort suchen" breite={240} />
        <Wahl label="Standort" wert={f.ort} onWert={x => setF({ ort: x })} alle="Alle Standorte" breite={180}
          optionen={[...new Set(g.daten.ressourcen.map(r => (r.mobil ? r.standort : `fest in ${r.raum}`)).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'de')).map(x => [x, x])} />
        <Stack direction="row" alignItems="center" gap={0.5}>
          <IconButton onClick={() => ziel(plusTage(datum, woche ? -7 : -1))} aria-label="zurück"><ChevronLeftRounded /></IconButton>
          <DatumFeld label="Datum" wert={datum} onWert={d => d && ziel(d)} pflicht breite={160} />
          <IconButton onClick={() => ziel(plusTage(datum, woche ? 7 : 1))} aria-label="weiter"><ChevronRightRounded /></IconButton>
          <Button size="small" variant="outlined" onClick={() => ziel(heuteIso())}>Heute</Button>
        </Stack>
        <ToggleButtonGroup exclusive size="small" value={woche ? 'woche' : 'tag'} onChange={(_, v) => v && ziel(datum, v === 'woche')}><ToggleButton value="tag">Tag</ToggleButton><ToggleButton value="woche">Woche</ToggleButton></ToggleButtonGroup>
        <Stack direction="row" gap={0.5} alignItems="center">
          <TextField select size="small" label="Von" value={f.von || ''} onChange={e => { const v = Number(e.target.value); setF({ von: v, bis: Math.max(v, f.bis) }); }} sx={{ width: 110 }}>{raster.map(z => <MenuItem key={z.nr} value={z.nr}>{z.nr}. {z.beginn}</MenuItem>)}</TextField>
          <TextField select size="small" label="Bis" value={f.bis || ''} onChange={e => { const b = Number(e.target.value); setF({ bis: b, von: Math.min(b, f.von) }); }} sx={{ width: 110 }}>{raster.map(z => <MenuItem key={z.nr} value={z.nr}>{z.nr}. – {z.ende}</MenuItem>)}</TextField>
        </Stack>
      </>}>
      <Geladen g={g}>{u => {
        const arten = [...new Map(u.ressourcen.map(r => [r.artId ?? 0, { id: r.artId ?? 0, name: r.art || 'Ohne Art', r }])).values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
        const q = f.suche.toLowerCase();
        const sichtbar = u.ressourcen.filter(r => (!f.arten.size || f.arten.has(r.artId ?? 0)) && (!q || `${r.name} ${r.art} ${r.standort} ${r.raum} ${r.bemerkung}`.toLowerCase().includes(q))
          && (!f.ort || (r.mobil ? r.standort : `fest in ${r.raum}`) === f.ort) && (!f.nurFrei || zustand(r).v > 0));
        if (!u.ressourcen.length) return (
          <Leer text="Es sind noch keine Ressourcen angelegt." unter={opt?.admin ? 'Legen Sie mobile Geräte wie Beamer, Laptopwagen oder Tablet-Koffer an – oder übernehmen Sie zum Start typische Beispiele.' : 'Die Administration legt buchbare Geräte wie Beamer oder Laptopwagen an.'}
            aktion={opt?.admin ? { text: 'Beispiel-Ressourcen anlegen', onClick: async () => { try { const r = await senden<{ angelegt: number }>(`${BASIS}/ressourcen/beispiele`, {}); toast(`${r.angelegt} Beispiel-Ressourcen angelegt.`); void g.neu(); } catch (err) { fehler(err); } } } : undefined} />
        );
        return (
          <>
            <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center" sx={{ mb: 1.5 }}>
              {arten.length > 1 && <>
                <Chip label={`Alle ${u.ressourcen.length}`} color={!f.arten.size ? 'primary' : 'default'} variant={!f.arten.size ? 'filled' : 'outlined'} onClick={() => setF({ arten: new Set() })} />
                {arten.map(a => <Chip key={a.id} label={`${a.name} ${u.ressourcen.filter(r => (r.artId ?? 0) === a.id).length}`} color={f.arten.has(a.id) ? 'primary' : 'default'} variant={f.arten.has(a.id) ? 'filled' : 'outlined'}
                  onClick={() => { const x = new Set(f.arten); if (x.has(a.id)) x.delete(a.id); else x.add(a.id); setF({ arten: x }); }} />)}
              </>}
              <Box sx={{ flex: 1 }} />
              <FormControlLabel control={<Switch size="small" checked={f.nurFrei} onChange={e => setF({ nurFrei: e.target.checked })} />} label="Nur verfügbare" />
              <ToggleButtonGroup exclusive size="small" value={ansicht} onChange={(_, v) => { if (v) { setAnsicht(v); schreiben('untplan:buchen:ressourcen', v); } }}><ToggleButton value="karten">Karten</ToggleButton><ToggleButton value="liste">Liste</ToggleButton></ToggleButtonGroup>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              <b>{sichtbar.length}</b> {sichtbar.length === 1 ? 'Ressource' : 'Ressourcen'}{sichtbar.length < u.ressourcen.length ? ` von ${u.ressourcen.length}` : ''} ·{' '}
              {tag?.frei ? `${tagKurz(datum)}: ${tag.grund || 'unterrichtsfrei'}` : `${sichtbar.filter(r => zustand(r).v > 0).length} ${ganzerTag() ? 'mit freien Stunden' : 'verfügbar'} am ${tagKurz(datum)}${ganzerTag() ? '' : `, ${zrText()}`}`}
            </Typography>
            {!sichtbar.length ? <Leer text="Keine Ressource passt zu den Filtern." aktion={{ text: 'Alle zeigen', onClick: () => setF({ arten: new Set(), suche: '', ort: '', nurFrei: false }) }} />
              : ansicht === 'liste' ? (
                <Paper variant="outlined">{sichtbar.map((r, i) => { const zz = zustand(r); return (
                  <Stack key={r.id} direction={{ xs: 'column', md: 'row' }} gap={1.5} alignItems={{ md: 'center' }} sx={{ p: 1.5, borderTop: i ? 1 : 0, borderColor: 'divider' }}>
                    <Stack direction="row" gap={1.5} alignItems="center" sx={{ width: { md: 280 } }}>{symbol(r)}<Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 500 }} noWrap>{r.name}</Typography><Typography variant="caption" color="text.secondary">{r.art || 'Ohne Art'}</Typography></Box></Stack>
                    <Typography variant="body2" color="text.secondary" component="div" sx={{ width: { md: 180 } }}>{ort(r)}</Typography>
                    <Box sx={{ width: { md: 170 } }}><Plakette ton={zz.ton}>{zz.text}</Plakette></Box>
                    <Box sx={{ flex: 1, minWidth: 200 }}>{zeitstrahl(r, true)}</Box>
                    <Box sx={{ width: { md: 130 }, textAlign: 'right' }}>{knopf(r, zz)}</Box>
                  </Stack>
                ); })}</Paper>
              ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(auto-fill, minmax(340px, 1fr))' }, gap: 1.5 }}>
                  {sichtbar.map(r => { const zz = zustand(r); const n = (r.belegung[datum] ?? []).length; return (
                    <Paper key={r.id} variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Stack direction="row" gap={1.5} alignItems="center">{symbol(r)}<Box sx={{ flex: 1, minWidth: 0 }}><Typography sx={{ fontWeight: 500 }} noWrap>{r.name}</Typography><Typography variant="caption" color="text.secondary">{r.art || 'Ohne Art'}</Typography></Box><Plakette ton={zz.ton}>{zz.text}</Plakette></Stack>
                      <Stack direction="row" gap={2} flexWrap="wrap" sx={{ fontSize: 13, color: 'text.secondary' }}>{ort(r)}<span>{r.anzahl} Stück</span>
                        {!tag?.frei && (ganzerTag() ? zz.frei && zz.frei !== 'ganztägig' && <span>frei: <b>{zz.frei}</b> Std.</span> : r.mobil && <span><b>{zz.v}</b>/{r.anzahl} frei · {zrText()}</span>)}</Stack>
                      {r.bemerkung && <Typography variant="body2">{r.bemerkung}</Typography>}
                      {zeitstrahl(r)}
                      <Stack direction="row" alignItems="center" gap={1}><Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>{tag?.frei ? '' : r.mobil ? (n ? `${n} ${n === 1 ? 'Buchung' : 'Buchungen'} am ${tagKurz(datum)}` : `Am ${tagKurz(datum)} nicht gebucht`) : `Belegung von ${r.raum}`}</Typography>{knopf(r, zz)}</Stack>
                    </Paper>
                  ); })}
                </Box>
              )}
          </>
        );
      }}</Geladen>
      {buchen && opt && <RessourceBuchen {...buchen} opt={opt} raster={raster} onClose={() => setBuchen(null)} fertig={() => void g.neu()} />}
    </Seite>
  );
}

/** Ressource direkt buchen: Datum, Stunden und Menge (Verfügbarkeit wird live geprüft), Titel und Bemerkung. */
function RessourceBuchen({ r, datum: d0, von: v0, bis: b0, opt, raster, onClose, fertig }: { r: Res; datum: string; von: number; bis: number; opt: Optionen; raster: Zeitraster[]; onClose: () => void; fertig: () => void }) {
  const [datum, setDatum] = useState(d0);
  const [von, setVon] = useState(v0);
  const [bis, setBis] = useState(b0);
  const [menge, setMenge] = useState(1);
  const [titel, setTitel] = useState('');
  const [text, setText] = useState('');
  const [frei, setFrei] = useState<number | null>(null);
  const [fehlerText, setFehlerText] = useState('');
  useEffect(() => {
    let aktiv = true;
    setFrei(null);
    senden<{ ressourcen: { id: number; frei: number }[] }>(`${BASIS}/suche/ressourcen`, { zeit: { wiederholung: 'einmalig', datum, stundeVon: von, stundeBis: bis }, kriterien: { maxBelegung: 100 } })
      .then(s => { if (aktiv) { const x = s.ressourcen.find(y => y.id === r.id)?.frei ?? 0; setFrei(x); setFehlerText(''); setMenge(m => Math.max(1, Math.min(m, x))); } })
      .catch(err => { if (aktiv) { setFrei(0); setFehlerText((err as Error).message); } });
    return () => { aktiv = false; };
  }, [datum, von, bis, r.id]);
  return (
    <FormDialog offen titel={`${r.name} buchen`} untertitel={[r.art, r.standort ? `Standort: ${r.standort}` : '', r.anzahl > 1 ? `${r.anzahl} Stück` : ''].filter(Boolean).join(' · ')} onClose={onClose} aktionText="Buchen" deaktiviert={!frei}
      links={<Button onClick={() => { onClose(); navigieren(link('buchen', 'ressource', datum, von, bis, r.id)); }}>Serie / weitere Optionen</Button>}
      aktion={async () => {
        await senden(BASIS, { art: 'ressource', termine: [{ datum, stundeVon: von, stundeBis: bis, raum: null }], ressourcen: [{ id: r.id, menge }], klassen: [], lehrer: opt.ich || '', fach: '', titel, text, benachrichtigen: false, unterrichtId: null, beginn: null, ende: null });
        toast(`${r.name} gebucht.`); fertig();
      }}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        <Stack direction="row" gap={2} alignItems="center">
          <DatumFeld label="Datum" wert={datum} onWert={v => v && setDatum(v)} min={heuteIso()} pflicht />
          <Box>{frei === null ? <Typography color="text.secondary">…</Typography> : fehlerText ? <Plakette ton="entfall">{fehlerText}</Plakette>
            : <Plakette ton={frei <= 0 ? 'entfall' : frei < r.anzahl ? 'pruefung' : 'ok'}>{frei <= 0 ? 'ausgebucht' : r.anzahl > 1 ? `${frei} von ${r.anzahl} verfügbar` : 'verfügbar'}</Plakette>}</Box>
        </Stack>
        <Stack direction="row" gap={2}>
          <TextField select label="Von Stunde" value={von} onChange={e => { const v = Number(e.target.value); setVon(v); if (bis < v) setBis(v); }} sx={{ flex: 1 }}>{raster.map(z => <MenuItem key={z.nr} value={z.nr}>{z.nr}. Stunde ({z.beginn})</MenuItem>)}</TextField>
          <TextField select label="Bis Stunde" value={bis} onChange={e => setBis(Math.max(von, Number(e.target.value)))} sx={{ flex: 1 }}>{raster.map(z => <MenuItem key={z.nr} value={z.nr}>{z.nr}. Stunde ({z.ende})</MenuItem>)}</TextField>
          {r.anzahl > 1 && <TextField type="number" label="Menge" value={menge} onChange={e => setMenge(Math.max(1, Math.min(frei || 1, Number(e.target.value) || 1)))} sx={{ width: 100 }} slotProps={{ htmlInput: { min: 1, max: Math.max(1, frei ?? 1) } }} />}
        </Stack>
        <TextField label="Titel / Anlass" value={titel} onChange={e => setTitel(e.target.value)} placeholder="z. B. Referate 9b" autoFocus slotProps={{ htmlInput: { maxLength: 200 } }} />
        <TextField label="Bemerkung" value={text} onChange={e => setText(e.target.value)} placeholder="optional" slotProps={{ htmlInput: { maxLength: 1000 } }} />
      </Stack>
    </FormDialog>
  );
}
