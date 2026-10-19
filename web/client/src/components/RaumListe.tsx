// Raumauswahl: eingebettete Liste mit Suche und Filtern (Gebäude, Abteilung, Raumart, Kapazität, nur freie) und das Raumfeld
// (mehrere Räume, Belegung zur gewählten Zeit) für Prüfungen. Belegung über GET /api/app/buchen/raumstatus.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { alpha, Autocomplete, Box, Button, Chip, FormControlLabel, Stack, Switch, TextField, Tooltip, Typography, useTheme } from '@mui/material';
import PeopleOutlineRounded from '@mui/icons-material/PeopleOutlineRounded';
import { holen, qs } from '../api/client';
import { SuchFeld, Wahl } from './Bausteine';
import { Leer } from './Seite';

export interface RaumStatus { kurz: string; name?: string; raumart?: string; kapazitaet?: number; gebaeude?: string; abteilung?: string; buchbar?: boolean; eigen?: boolean; frei: boolean; belegt?: { stunde: number; art: string; text?: string }[] }
const STATUS_ART: Record<string, string> = { unterricht: 'Unterricht', klausur: 'Prüfung', vorgemerkt: 'vorgemerkt', buchung: 'Buchung', termin: 'Termin', gesperrt: 'gesperrt' };
export const belegtText = (r: RaumStatus) => (r.belegt ?? []).map(b => `${b.stunde}. Std.: ${STATUS_ART[b.art] ?? b.art}${b.text ? ` – ${b.text}` : ''}`).join('\n');
const sortiertDe = (l: (string | undefined)[]) => [...new Set(l.filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
const KAPAZITAETEN = [10, 15, 20, 25, 30, 40, 60, 100];

export function RaumStatusPlakette({ r, status }: { r: RaumStatus; status?: { text: string; frei: boolean; titel?: string } }) {
  const t = useTheme();
  const s = status ?? { text: r.frei ? 'frei' : 'belegt', frei: r.frei, titel: r.frei ? '' : belegtText(r) };
  const farbe = s.frei ? t.palette.status.ok.main : t.palette.status.entfall.main;
  return <Tooltip title={s.titel ? <Box sx={{ whiteSpace: 'pre-line' }}>{s.titel}</Box> : ''}><Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 500, color: farbe }}>{s.text}</Box></Tooltip>;
}

export interface RaumFilter { suche: string; gebaeude: string; abteilung: string; raumart: string; kapazitaet: string; nurFrei: boolean }
export const neuerRaumFilter = (nurFrei = true): RaumFilter => ({ suche: '', gebaeude: '', abteilung: '', raumart: '', kapazitaet: '', nurFrei });

export function RaumListe({ raeume: roh, gewaehlt, onWahl, filter, setFilter, waehlbar = () => true, zusatz, status, leerText, ohne, titel, nurFreiText = 'Nur freie' }: {
  raeume: RaumStatus[]; gewaehlt: string | null; onWahl: (k: string | null) => void; filter: RaumFilter; setFilter: (f: RaumFilter) => void;
  waehlbar?: (r: RaumStatus) => boolean; zusatz?: (r: RaumStatus) => ReactNode; status?: (r: RaumStatus) => { text: string; frei: boolean; titel?: string };
  leerText?: string; ohne?: string; titel?: string; nurFreiText?: string;
}) {
  const t = useTheme();
  const raeume = useMemo(() => (roh.some(r => r.abteilung) ? roh : roh.map(r => ({ ...r, abteilung: (r.kurz.match(/^[A-Za-zÄÖÜäöü]+/)?.[0] ?? '').toUpperCase() }))), [roh]);
  const f = filter;
  const frei = (r: RaumStatus) => (status ? status(r).frei : r.frei);
  const q = f.suche.toLowerCase();
  const sichtbar = raeume.filter(r => (!q || `${r.kurz} ${r.name ?? ''} ${r.raumart ?? ''}`.toLowerCase().includes(q))
    && (!f.gebaeude || r.gebaeude === f.gebaeude) && (!f.abteilung || r.abteilung === f.abteilung) && (!f.raumart || r.raumart === f.raumart)
    && (!f.kapazitaet || (Number(r.kapazitaet) || 0) >= Number(f.kapazitaet)) && (!f.nurFrei || frei(r) || r.kurz === gewaehlt));
  const maxKap = Math.max(0, ...raeume.map(r => Number(r.kapazitaet) || 0));
  const gefiltert = !!(f.suche || f.gebaeude || f.abteilung || f.raumart || f.kapazitaet);
  const pille = (n: 'gebaeude' | 'abteilung' | 'raumart', titel2: string) => {
    const werte = sortiertDe(raeume.map(r => r[n]));
    return werte.length > 1 || f[n] ? <Wahl label={titel2} wert={f[n]} onWert={v => setFilter({ ...f, [n]: v })} optionen={werte.map(w => [w, w] as [string, string])} alle="Alle" breite={150} /> : null;
  };
  const zeile = (r: RaumStatus | null) => {
    const kurz = r?.kurz ?? null;
    const an = gewaehlt === kurz;
    const aus = r ? !waehlbar(r) : false;
    return (
      <Box key={kurz ?? '-'} role="option" aria-selected={an} aria-disabled={aus} tabIndex={aus ? -1 : 0} onClick={() => !aus && onWahl(kurz)}
        onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !aus) { e.preventDefault(); onWahl(kurz); } }}
        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1, borderRadius: 1.5, cursor: aus ? 'not-allowed' : 'pointer', opacity: aus ? 0.5 : 1,
          bgcolor: an ? alpha(t.palette.primary.main, 0.08) : 'transparent', border: 1, borderColor: an ? 'primary.main' : 'transparent', '&:hover': { bgcolor: aus ? undefined : an ? undefined : 'action.hover' } }}>
        <Box sx={{ width: 18, height: 18, borderRadius: 9, border: 2, borderColor: an ? 'primary.main' : 'text.disabled', display: 'grid', placeItems: 'center', flex: 'none' }}>
          {an && <Box sx={{ width: 8, height: 8, borderRadius: 1.5, bgcolor: 'primary.main' }} />}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 14 }} component="span">{r ? r.kurz : ohne}</Typography>
          {r?.name && r.name !== r.kurz && <Typography component="span" color="text.secondary" sx={{ ml: 1, fontSize: 13 }}>{r.name}</Typography>}
          {r && zusatz?.(r)}
        </Box>
        {r?.kapazitaet ? <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }} title={`${r.kapazitaet} Plätze`}><PeopleOutlineRounded sx={{ fontSize: 15 }} />{r.kapazitaet}</Typography> : null}
        {r && <RaumStatusPlakette r={r} status={status?.(r)} />}
      </Box>
    );
  };
  return (
    <Box>
      {titel && <Typography variant="h4" sx={{ mb: 1.5 }}>{titel}</Typography>}
      <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center" sx={{ mb: 1.5 }}>
        <SuchFeld wert={f.suche} onWert={v => setFilter({ ...f, suche: v })} platzhalter="Raum suchen" breite={200} />
        {pille('gebaeude', 'Gebäude')}{pille('abteilung', 'Abteilung')}{pille('raumart', 'Raumart')}
        {maxKap > 0 && <Wahl label="Kapazität" wert={f.kapazitaet} onWert={v => setFilter({ ...f, kapazitaet: String(v) })} optionen={KAPAZITAETEN.filter(k => k <= maxKap).map(k => [String(k), `ab ${k} Plätzen`] as [string, string])} alle="Alle" breite={150} />}
        <FormControlLabel control={<Switch size="small" checked={f.nurFrei} onChange={e => setFilter({ ...f, nurFrei: e.target.checked })} />} label={nurFreiText} />
        {gefiltert && <Button size="small" onClick={() => setFilter(neuerRaumFilter(f.nurFrei))}>Filter zurücksetzen</Button>}
      </Stack>
      <Typography variant="caption" color="text.secondary">{sichtbar.length === raeume.length ? `${raeume.length} ${raeume.length === 1 ? 'Raum' : 'Räume'}` : `${sichtbar.length} von ${raeume.length} Räumen`} · {raeume.filter(frei).length} frei</Typography>
      <Stack role="listbox" aria-label="Räume" gap={0.25} sx={{ mt: 1 }}>
        {ohne && zeile(null)}
        {sichtbar.map(zeile)}
        {!sichtbar.length && <Leer text={gefiltert ? 'Kein Raum passt zu den Filtern.' : f.nurFrei ? (leerText ?? 'Zu dieser Zeit ist kein passender Raum frei.') : 'Keine Räume.'}
          aktion={f.nurFrei && !gefiltert ? { text: 'Auch belegte zeigen', onClick: () => setFilter({ ...f, nurFrei: false }) } : gefiltert ? { text: 'Filter zurücksetzen', onClick: () => setFilter(neuerRaumFilter(f.nurFrei)) } : undefined} />}
      </Stack>
    </Box>
  );
}

/** Mehrere Räume wählen (Prüfung): Vorschläge mit Belegung zur gewählten Zeit; freie Eingabe möglich. */
export function RaumFeld({ label = 'Räume', wert, onWert, datum, von, bis, unterricht }: { label?: string; wert: string[]; onWert: (l: string[]) => void; datum: string | null; von: number; bis: number; unterricht?: number | null }) {
  const [raeume, setRaeume] = useState<RaumStatus[]>([]);
  useEffect(() => {
    if (!datum) return;
    let ok = true;
    holen<RaumStatus[]>(`/api/app/buchen/raumstatus${qs({ datum, von, bis: Math.max(von, bis), unterricht })}`).then(r => ok && setRaeume(r)).catch(() => ok && setRaeume([]));
    return () => { ok = false; };
  }, [datum, von, bis, unterricht]);
  const belegt = wert.map(x => raeume.find(r => r.kurz.toLowerCase() === x.toLowerCase())).filter((r): r is RaumStatus => !!r && !r.frei);
  const gruppe = (r: RaumStatus) => (r.eigen ? 'Raum der Stunde' : r.buchbar ? 'Buchbare Räume' : 'Weitere Räume');
  const sortiert = [...raeume].sort((a, b) => gruppe(a).localeCompare(gruppe(b)) * -1 || 0);
  const reihenfolge = ['Raum der Stunde', 'Buchbare Räume', 'Weitere Räume'];
  sortiert.sort((a, b) => reihenfolge.indexOf(gruppe(a)) - reihenfolge.indexOf(gruppe(b)));
  return (
    <Autocomplete multiple freeSolo options={sortiert.map(r => r.kurz)} value={wert} onChange={(_, v) => onWert(v.map(x => x.trim()).filter(Boolean))}
      groupBy={k => { const r = raeume.find(x => x.kurz === k); return r ? gruppe(r) : ''; }}
      renderOption={(props, k) => {
        const { key, ...rest } = props as typeof props & { key: string };
        const r = raeume.find(x => x.kurz === k)!;
        return <Box component="li" key={key} {...rest} sx={{ display: 'flex', gap: 1.5 }}><b>{k}</b><Typography variant="body2" color="text.secondary" sx={{ flex: 1 }} noWrap>{r?.name}</Typography>{r?.kapazitaet ? <Typography variant="caption" color="text.secondary">{r.kapazitaet} Pl.</Typography> : null}{r && <RaumStatusPlakette r={r} />}</Box>;
      }}
      renderValue={(v, getProps) => v.map((k, i) => { const { key, ...p } = getProps({ index: i }); const r = raeume.find(x => x.kurz === k); return <Chip key={key} {...p} size="small" label={k} color={r && !r.frei ? 'error' : 'default'} variant="outlined" />; })}
      renderInput={p => <TextField {...p} label={label} placeholder={wert.length ? '' : 'Raum suchen (Kürzel oder Name)'}
        helperText={belegt.length ? belegt.map(r => `${r.kurz} ist zur gewählten Zeit belegt${r.belegt?.[0]?.text ? ` (${r.belegt[0].text})` : ''}.`).join(' ') : undefined}
        error={belegt.length > 0} />}
    />
  );
}
