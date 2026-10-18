// Schüler*innen und Erziehungsberechtigte: „Meine Abwesenheiten“ (Zeiträume, aufklappbar mit den Stunden) und „Fehlzeiten“ (je Stunde),
// Zeitraum, Kind, Status, Export (PDF, CSV) und Entschuldigungsschreiben.
import { Fragment, useState } from 'react';
import { Box, Button, Checkbox, Collapse, IconButton, MenuItem, Paper, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Tooltip, Typography } from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined';
import TableViewOutlined from '@mui/icons-material/TableViewOutlined';
import PrintOutlined from '@mui/icons-material/PrintOutlined';
import { holen } from '../../api/client';
import { useSitzung } from '../../app/sitzung';
import { Geladen, Leer, Seite } from '../../components/Seite';
import { DatumFeld } from '../../components/Auswahl';
import { DatumZelle, FehlzeitenTabelle, StatusLabel, STATUS_TEXT, type FehlzeitZeile } from '../../components/klassenbuch/fehlzeiten';
import { Plakette } from '../../components/Bausteine';
import { heuteIso, istIsoDatum, plusTage } from '../../lib/datum';
import { navigieren } from '../../lib/router';
import { pdfAusrichtung } from '../../lib/pdf';
import { toast } from '../../lib/meldungen';
import { useLaden } from '../../lib/useLaden';
import { KindWahl, kinderLaden, OHNE_ZUORDNUNG } from './kinder';

interface Zeitraum { ids: number[]; vonDatum: string; vonZeit: string; bisDatum: string; bisZeit: string; grund: string; art: string; minuten: number; status: string; statusGemischt?: boolean; entschuldigt: number; unentschuldigt: number; fehlstunden: number; text: string }
export const monatPlus = (iso: string, n: number) => { const d = new Date(iso + 'T12:00'); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };

export default function FamilieAbwesenheiten({ teile }: { teile: string[] }) {
  const { schuljahr } = useSitzung();
  const [reiterP, vonP, statusP, bisP] = teile;
  const reiter = reiterP === 'fehlzeiten' ? 'fehlzeiten' : 'meine';
  const start = schuljahr?.von && schuljahr.von <= heuteIso() ? schuljahr.von : plusTage(heuteIso(), -90);
  const von = istIsoDatum(vonP) ? vonP : start;
  const bisWahl = istIsoDatum(bisP) && bisP >= von ? bisP : '';
  const bis = bisWahl || (schuljahr?.bis && schuljahr.bis > von ? schuljahr.bis : plusTage(von, 365));
  const status = ['offen', 'entschuldigt', 'unentschuldigt'].includes(statusP) ? statusP : '';
  const ziel = (r = reiter, v = von, s = status, b = bisWahl) => `#/abwesenheiten/${r}/${v}/${s || '-'}${b ? `/${b}` : ''}`;
  const [auswahl, setAuswahl] = useState<Set<number>>(new Set());
  const [auf, setAuf] = useState<Set<number>>(new Set());
  const g = useLaden(async () => {
    const { liste, kind } = await kinderLaden();
    if (!kind) return { liste, kind, zeilen: [], stunden: new Map<number, FehlzeitZeile>(), gruende: {} as Record<string, string>, q: '' };
    const q = `schueler=${kind.id}&von=${von}&bis=${bis}${status ? `&status=${status}` : ''}`;
    const [d, gruende, st] = await Promise.all([
      holen<{ zeilen: (Zeitraum | FehlzeitZeile)[] }>(`/api/app/familie/${reiter === 'meine' ? 'abwesenheiten' : 'fehlzeiten'}?${q}`),
      holen<Record<string, string>>('/api/app/familie/gruende').catch(() => ({} as Record<string, string>)),
      reiter === 'meine' ? holen<{ zeilen: FehlzeitZeile[] }>(`/api/app/familie/fehlzeiten?schueler=${kind.id}&von=${von}&bis=${bis}`).catch(() => null) : null,
    ]);
    return { liste, kind, zeilen: d.zeilen, stunden: new Map((st?.zeilen ?? []).map(f => [f.id, f])), gruende, q };
  }, [reiter, von, bis, status]);
  const brief = async (kindId: number, zeilen: Zeitraum[]) => {
    const ids = [...auswahl].map(i => zeilen[i].ids[0]);
    const a = await pdfAusrichtung('hoch', 'entschuldigung');
    if (!a) return;
    const r = await fetch(`/api/app/familie/entschuldigung?schueler=${kindId}&von=${von}&bis=${bis}${ids.length ? `&ids=${ids.join(',')}` : ''}&ausrichtung=${a}`, { credentials: 'same-origin' });
    if (!r.ok) { toast((await r.json().catch(() => null))?.fehler ?? 'Das Entschuldigungsschreiben konnte nicht erstellt werden.', true); return; }
    const url = URL.createObjectURL(await r.blob());
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  return (
    <Seite titel="Abwesenheiten">
      <Tabs value={reiter} onChange={(_, v) => navigieren(ziel(v))} sx={{ mb: 2 }}><Tab value="meine" label="Meine Abwesenheiten" /><Tab value="fehlzeiten" label="Fehlzeiten" /></Tabs>
      <Geladen g={g}>{d => !d.kind ? <Leer text={OHNE_ZUORDNUNG} /> : (
        <>
          <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
            <IconButton onClick={() => navigieren(ziel(reiter, monatPlus(von, -1)))} aria-label="Einen Monat früher"><ArrowBackRounded /></IconButton>
            <DatumFeld label="Ab" wert={von} onWert={v => v && navigieren(ziel(reiter, v))} pflicht />
            <IconButton onClick={() => navigieren(ziel(reiter, monatPlus(von, 1)))} aria-label="Einen Monat später"><ArrowForwardRounded /></IconButton>
            <DatumFeld label="Bis" wert={bis} onWert={b => navigieren(ziel(reiter, von, status, b ?? ''))} min={von} />
            <KindWahl liste={d.liste} kind={d.kind} onWahl={() => void g.neu()} />
            <TextField select label="Status" value={status} onChange={e => navigieren(ziel(reiter, von, e.target.value))} sx={{ minWidth: 170 }}>
              <MenuItem value="">Alle</MenuItem>{Object.entries(STATUS_TEXT).map(([k, [t]]) => <MenuItem key={k} value={k}>{t}</MenuItem>)}
            </TextField>
            <Box sx={{ flex: 1 }} />
            <Tooltip title="Als PDF exportieren"><IconButton href={`/api/app/familie/export?liste=${reiter === 'meine' ? 'abwesenheiten' : 'fehlzeiten'}&format=pdf&${d.q}`} aria-label="Als PDF exportieren"><PictureAsPdfOutlined /></IconButton></Tooltip>
            <Tooltip title="Als CSV exportieren (Excel)"><IconButton href={`/api/app/familie/export?liste=${reiter === 'meine' ? 'abwesenheiten' : 'fehlzeiten'}&format=csv&${d.q}`} aria-label="Als CSV exportieren"><TableViewOutlined /></IconButton></Tooltip>
          </Paper>
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
            {reiter === 'fehlzeiten' ? <FehlzeitenTabelle zeilen={d.zeilen as FehlzeitZeile[]} grundName={x => d.gruende[x] ?? x} /> : !d.zeilen.length ? <Leer text="Keine Abwesenheiten im Zeitraum." /> : (
              <Box sx={{ overflowX: 'auto' }}><Table size="small">
                <TableHead><TableRow><TableCell padding="checkbox"><Checkbox size="small" checked={auswahl.size === d.zeilen.length} onChange={e => setAuswahl(e.target.checked ? new Set(d.zeilen.map((_, i) => i)) : new Set())} inputProps={{ 'aria-label': 'Alle auswählen' }} /></TableCell>
                  <TableCell>Von</TableCell><TableCell>Bis</TableCell><TableCell>Abwesenheitsgrund</TableCell><TableCell>Status</TableCell><TableCell align="right">Fehlstd.</TableCell><TableCell>Text</TableCell><TableCell /></TableRow></TableHead>
                <TableBody>{(d.zeilen as Zeitraum[]).map((z, i) => (
                  <Fragment key={i}>
                    <TableRow hover onClick={() => setAuf(a => { const n = new Set(a); if (n.has(i)) n.delete(i); else n.add(i); return n; })} sx={{ cursor: 'pointer' }}>
                      <TableCell padding="checkbox" onClick={e => e.stopPropagation()}><Checkbox size="small" checked={auswahl.has(i)} onChange={() => setAuswahl(a => { const n = new Set(a); if (n.has(i)) n.delete(i); else n.add(i); return n; })} inputProps={{ 'aria-label': 'Abwesenheit auswählen' }} /></TableCell>
                      <TableCell><DatumZelle iso={z.vonDatum} zeit={z.vonZeit} /></TableCell>
                      <TableCell><DatumZelle iso={z.bisDatum} zeit={z.bisZeit} vor="bis " /></TableCell>
                      <TableCell>{d.gruende[z.grund] ?? z.grund}{z.art !== 'fehlt' && <Typography component="span" variant="body2" color="text.secondary"> ({z.art === 'verspaetet' ? 'verspätet' : 'vorzeitig gegangen'} {z.minuten} min)</Typography>}</TableCell>
                      <TableCell>{z.statusGemischt ? <Tooltip title={`${z.entschuldigt} entschuldigt, ${z.unentschuldigt} nicht entschuldigt`}><span><Plakette ton="pruefung">teilweise</Plakette></span></Tooltip> : <StatusLabel s={z.status} />}</TableCell>
                      <TableCell align="right">{z.fehlstunden}</TableCell><TableCell>{z.text}</TableCell>
                      <TableCell><ExpandMoreRounded sx={{ transform: auf.has(i) ? 'rotate(180deg)' : 'none', color: 'text.secondary' }} /></TableCell>
                    </TableRow>
                    <TableRow><TableCell colSpan={8} sx={{ p: 0, borderBottom: auf.has(i) ? undefined : 0 }}><Collapse in={auf.has(i)} unmountOnExit>
                      <Box sx={{ px: 6, py: 1.5, bgcolor: 'background.default' }}>
                        {z.ids.map(id => d.stunden.get(id)).filter(Boolean).map((f, j) => (
                          <Stack key={j} direction="row" gap={2} sx={{ py: 0.5, fontSize: 13 }}><DatumZelle iso={f!.datum} /><span>{f!.stunde}. Std. {f!.abwesendVon}–{f!.abwesendBis}</span><span>{f!.fach}</span><span>{f!.lehrer}</span><StatusLabel s={f!.status} /></Stack>
                        ))}
                        {!z.ids.some(id => d.stunden.has(id)) && <Typography variant="body2" color="text.secondary">Keine Unterrichtsstunden laut Stundenplan.</Typography>}
                      </Box></Collapse></TableCell></TableRow>
                  </Fragment>
                ))}</TableBody></Table></Box>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 2, py: 1, borderTop: 1, borderColor: 'divider' }}>{d.zeilen.length} {d.zeilen.length === 1 ? 'Element' : 'Elemente'}</Typography>
          </Paper>
          {reiter === 'meine' && (
            <Stack direction="row" gap={1.5} alignItems="center" sx={{ mt: 2 }} flexWrap="wrap">
              <Button variant="contained" startIcon={<PrintOutlined />} onClick={() => void brief(d.kind!.id, d.zeilen as Zeitraum[])}>Entschuldigungsschreiben drucken</Button>
              <Typography variant="body2" color="text.secondary">Ohne Auswahl: alle noch nicht entschuldigten Abwesenheiten im Zeitraum.</Typography>
            </Stack>
          )}
        </>
      )}</Geladen>
    </Seite>
  );
}
