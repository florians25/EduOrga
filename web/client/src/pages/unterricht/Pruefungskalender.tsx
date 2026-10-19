// Unterricht → Prüfungskalender: Filter (Prüfungsart, „Alle Ihre Prüfungen anzeigen“, Mein Unterricht) und das Jahresraster
// (Monate August–Juli × Tage 1–31, Wochentag in jeder Zelle, Wochenenden und Ferien grau) mit farbigen Prüfungstagen und Legende.
import { useMemo, useState } from 'react';
import { alpha, Box, Button, Checkbox, FormControlLabel, MenuItem, Paper, Radio, RadioGroup, Stack, TextField, Tooltip, Typography, useTheme } from '@mui/material';
import { holen } from '../../api/client';
import { useSitzung } from '../../app/sitzung';
import { Geladen, Seite } from '../../components/Seite';
import { FormDialog, Plakette } from '../../components/Bausteine';
import { datumDe, heuteIso } from '../../lib/datum';
import { useLaden } from '../../lib/useLaden';
import { pruefungLoeschen, type Pruefung } from './Pruefungen';

const MONATE = ['August', 'September', 'Oktober', 'November', 'Dezember', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli'];
const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const GRUNDARTEN = ['Klausur', 'Klassenarbeit', 'Test', 'Abschlussprüfung', 'Präsentation', 'Referat', 'Vergleichsarbeit'];
type Kat = 'eigen-art' | 'eigen-andere' | 'fremd-art' | 'eigen-klassen' | 'fremd';
const RANG: Kat[] = ['eigen-art', 'eigen-andere', 'fremd-art', 'eigen-klassen', 'fremd'];
const z2 = (n: number) => String(n).padStart(2, '0');

export default function Pruefungskalender() {
  const { ich, schuljahr, elemente } = useSitzung();
  const t = useTheme();
  const startJahr = Number((schuljahr?.von || heuteIso()).slice(0, 4)) - (schuljahr?.von ? 0 : new Date().getMonth() < 7 ? 1 : 0);
  const von = `${startJahr}-08-01`, bis = `${startJahr + 1}-07-31`;
  const g = useLaden(async sig => {
    const [pruefungen, el, unterricht, arten] = await Promise.all([
      holen<Pruefung[]>(`/api/app/pruefungen?von=${von}&bis=${bis}`, sig),
      elemente(),
      ich.kollegium && ich.element ? holen<{ fach: string; klassen: string[]; kurs: string }[]>(`/api/app/unterricht?lehrer=${encodeURIComponent(ich.element)}`, sig).catch(() => []) : Promise.resolve([]),
      ich.kollegium ? holen<{ arten?: { name?: string; kurz: string }[] }>('/api/app/pruefungsarten', sig).then(r => r.arten?.map(a => a.name || a.kurz) ?? null).catch(() => null) : Promise.resolve(null),
    ]);
    return { pruefungen, el, wahlen: unterricht.filter(u => u.klassen.length).map(u => ({ text: `${u.fach} – ${u.klassen.join(', ')}${u.kurs ? ' – ' + u.kurs : ''}`, klassen: u.klassen })), arten: arten?.length ? arten : GRUNDARTEN };
  }, [von]);
  const [art, setArt] = useState('alle');
  const [alleEigenen, setAlleEigenen] = useState(true);
  const [gewaehlt, setGewaehlt] = useState(0);
  const [tag, setTag] = useState<string | null>(null);
  const farben: Record<Kat, string> = {
    'eigen-art': t.palette.primary.main, 'eigen-andere': alpha(t.palette.primary.main, 0.45), 'fremd-art': t.palette.status.pruefung.main,
    'eigen-klassen': alpha(t.palette.status.termin.main, 0.55), fremd: alpha(t.palette.status.pruefung.main, 0.35),
  };
  const proTag = useMemo(() => {
    const m = new Map<string, { p: Pruefung; k: Kat }[]>();
    if (!g.daten) return m;
    const w = g.daten.wahlen[gewaehlt];
    for (const p of g.daten.pruefungen) {
      const eigen = !!ich.element && p.lehrer.some(l => l.toLowerCase() === ich.element.toLowerCase());
      const klasse = !!w && p.klassen.some(k => w.klassen.includes(k));
      const artPasst = art === 'alle' || p.art === art;
      const k: Kat | null = eigen && klasse && artPasst ? 'eigen-art' : eigen && klasse ? 'eigen-andere' : eigen && alleEigenen ? 'eigen-klassen' : klasse && artPasst ? 'fremd-art' : klasse ? 'fremd' : !w && artPasst ? 'fremd-art' : null;
      if (k) m.set(p.datum, [...(m.get(p.datum) ?? []), { p, k }]);
    }
    return m;
  }, [g.daten, art, alleEigenen, gewaehlt, ich.element]);
  const heute = heuteIso();
  return (
    <Seite titel="Prüfungskalender" untertitel={`Schuljahr ${startJahr}/${String(startJahr + 1).slice(2)}`}>
      <Geladen g={g}>{d => {
        const istFerien = (iso: string) => (d.el.ferien ?? []).some(f => iso >= f.von && iso <= f.bis);
        return (
          <Stack direction={{ xs: 'column', xl: 'row' }} gap={2} alignItems="flex-start">
            <Paper variant="outlined" sx={{ p: 2, width: { xs: '100%', xl: 280 }, flexShrink: 0 }}>
              <Stack gap={2}>
                <TextField select label="Prüfungsart" value={art} onChange={e => setArt(e.target.value)}><MenuItem value="alle">Alle Prüfungsarten</MenuItem>{d.arten.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}</TextField>
                {ich.element && <FormControlLabel control={<Checkbox checked={alleEigenen} onChange={e => setAlleEigenen(e.target.checked)} />} label="Alle Ihre Prüfungen anzeigen" />}
                {d.wahlen.length > 0 && <Box>
                  <Typography variant="overline" color="text.secondary">Mein Unterricht</Typography>
                  <RadioGroup value={gewaehlt} onChange={e => setGewaehlt(Number(e.target.value))}>
                    {d.wahlen.map((w, i) => <FormControlLabel key={i} value={i} control={<Radio size="small" />} label={<Typography variant="body2">{w.text}</Typography>} />)}
                  </RadioGroup>
                </Box>}
              </Stack>
            </Paper>
            <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
              <Paper variant="outlined" sx={{ overflowX: 'auto', p: 1 }}>
                <Box component="table" sx={{ borderCollapse: 'separate', borderSpacing: 2, width: '100%', minWidth: 900, fontSize: 11.5, '& th': { fontWeight: 500, color: 'text.secondary', p: 0.5 },
                  '& td': { textAlign: 'center', borderRadius: 1, height: 20, color: 'text.secondary', position: 'relative' } }}>
                  <thead><tr><th />{MONATE.map(m => <th key={m}>{m}</th>)}</tr></thead>
                  <tbody>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(tg => (
                      <tr key={tg}><th>{tg}</th>
                        {MONATE.map((_, m) => {
                          const jahr = m < 5 ? startJahr : startJahr + 1, monat = (m + 7) % 12;
                          const dd = new Date(jahr, monat, tg, 12);
                          if (dd.getMonth() !== monat) return <td key={m} />;
                          const iso = `${jahr}-${z2(monat + 1)}-${z2(tg)}`;
                          const we = dd.getDay() === 0 || dd.getDay() === 6;
                          const liste = proTag.get(iso) ?? [];
                          const k = RANG.find(r => liste.some(x => x.k === r));
                          const zelle = (
                            <Box component="td" key={m} onClick={liste.length ? () => setTag(iso) : undefined} tabIndex={liste.length ? 0 : undefined} role={liste.length ? 'button' : undefined}
                              onKeyDown={e => { if (liste.length && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setTag(iso); } }}
                              sx={{ bgcolor: k ? farben[k] : istFerien(iso) && !we ? t.palette.status.frei.flaeche : we ? 'action.hover' : 'transparent', color: k ? '#fff !important' : undefined,
                                cursor: liste.length ? 'pointer' : 'default', outline: iso === heute ? `2px solid ${t.palette.primary.main}` : undefined, fontWeight: k ? 500 : 400 }}>
                              {WT[dd.getDay()]}{liste.length > 1 && <sup>{liste.length}</sup>}
                            </Box>
                          );
                          return liste.length ? <Tooltip key={m} title={<Box sx={{ whiteSpace: 'pre-line' }}>{datumDe(iso) + '\n' + liste.map(x => `${x.p.titel} (${x.p.klassen.join(', ')}${x.p.lehrer.length ? ', ' + x.p.lehrer.join(', ') : ''})`).join('\n')}</Box>}>{zelle}</Tooltip> : zelle;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </Box>
              </Paper>
              <Stack direction="row" gap={2} flexWrap="wrap" sx={{ mt: 1.5, fontSize: 13, color: 'text.secondary' }}>
                {([['eigen-art', 'Ihre Prüfungen für die ausgewählte Art'], ['fremd-art', 'Prüfungen der ausgewählten Klasse und Art'], ['fremd', 'Fremde Prüfungen für die ausgewählte Klasse'],
                  ['eigen-andere', 'Ihre Prüfungen für alle anderen Arten'], ['eigen-klassen', 'Ihre Prüfungen für andere Klassen']] as [Kat, string][]).map(([k, txt]) => (
                  <Stack key={k} direction="row" gap={0.75} alignItems="center"><Box sx={{ width: 14, height: 14, borderRadius: 0.75, bgcolor: farben[k] }} />{txt}</Stack>
                ))}
                <Stack direction="row" gap={0.75} alignItems="center"><Box sx={{ width: 14, height: 14, borderRadius: 0.75, bgcolor: t.palette.status.frei.flaeche, border: 1, borderColor: 'divider' }} />Ferien, Feiertage</Stack>
              </Stack>
            </Box>
            {tag && (
              <FormDialog offen titel={`Prüfungen am ${datumDe(tag)}`} onClose={() => setTag(null)}>
                <Stack gap={1}>
                  {(proTag.get(tag) ?? []).map(({ p }, i) => (
                    <Stack key={i} direction="row" gap={1.5} alignItems="center" sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontWeight: 500 }}>{p.titel}{p.status === 'vorgemerkt' && <Plakette sx={{ ml: 1 }}>vorgemerkt</Plakette>}</Typography>
                        <Typography variant="body2" color="text.secondary">{p.stundeVon === p.stundeBis ? `${p.stundeVon}.` : `${p.stundeVon}.–${p.stundeBis}.`} Stunde · {p.klassen.join(', ')}{p.lehrer.length ? ' · ' + p.lehrer.join(', ') : ''}{p.raeume.length ? ' · ' + p.raeume.join(', ') : ''}</Typography>
                      </Box>
                      {p.darfLoeschen && <Button color="error" size="small" onClick={async () => { if (await pruefungLoeschen(p)) { setTag(null); void g.neu(); } }}>Löschen</Button>}
                    </Stack>
                  ))}
                </Stack>
              </FormDialog>
            )}
          </Stack>
        );
      }}</Geladen>
    </Seite>
  );
}
