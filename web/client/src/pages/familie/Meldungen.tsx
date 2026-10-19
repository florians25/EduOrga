// Schüler*innen und Erziehungsberechtigte: Abwesenheit melden (ganze Tage von–bis, Grund, Text) und die eigenen Meldungen mit Status
// (gemeldet → von der Klassenleitung bestätigt bzw. abgelehnt mit Antwort). Solange die Schule nicht reagiert hat, lässt sich eine Meldung
// zurückziehen. Bestätigte Meldungen erscheinen als Abwesenheit unter „Meine Abwesenheiten“.
import { useState } from 'react';
import { Box, Button, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { api, holen, senden } from '../../api/client';
import { DatumFeld } from '../../components/Auswahl';
import { FormDialog, Plakette } from '../../components/Bausteine';
import { Geladen, Leer } from '../../components/Seite';
import { bestaetigen, toast } from '../../lib/meldungen';
import { datumDe, heuteIso, plusTage, wochentagKurz, zeitstempel } from '../../lib/datum';
import { useLaden } from '../../lib/useLaden';

export interface Meldung { id: number; schuelerId: number; schueler: string; klasse: string; von: string; bis: string; grund: string; text: string; status: string; gemeldetVon: string; gemeldet: string; bearbeitetVon: string; bearbeitet: string; antwort: string }
export const MELDUNG_STATUS: Record<string, [string, 'frei' | 'ok' | 'entfall' | 'neutral']> = {
  gemeldet: ['gemeldet – noch nicht bestätigt', 'frei'], bestaetigt: ['bestätigt', 'ok'], abgelehnt: ['abgelehnt', 'entfall'], zurueckgezogen: ['zurückgezogen', 'neutral'],
};
const zeitraumText = (m: { von: string; bis: string }) => (m.von === m.bis ? `${wochentagKurz(m.von)}, ${datumDe(m.von)}` : `${wochentagKurz(m.von)}, ${datumDe(m.von)} – ${wochentagKurz(m.bis)}, ${datumDe(m.bis)}`);

export function MeldenDialog({ kind, gruende, onClose, fertig }: { kind: { id: number; vorname: string; name: string }; gruende: Record<string, string>; onClose: () => void; fertig: () => void }) {
  const [von, setVon] = useState<string | null>(heuteIso());
  const [bis, setBis] = useState<string | null>(heuteIso());
  const [grund, setGrund] = useState('');
  const [text, setText] = useState('');
  return (
    <FormDialog offen titel="Abwesenheit melden" untertitel={`für ${kind.vorname} ${kind.name} – die Klassenleitung bestätigt die Meldung.`} onClose={onClose} aktionText="Melden"
      aktion={async () => {
        if (!von) { toast('Bitte den ersten Tag angeben.', true); return false; }
        await senden('/api/app/familie/meldungen', { schueler: kind.id, von, bis: bis ?? von, grund, text });
        toast('Abwesenheit gemeldet.'); fertig();
      }}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <DatumFeld label="Erster Tag" wert={von} onWert={v => { setVon(v); if (v && (!bis || bis < v)) setBis(v); }} min={plusTage(heuteIso(), -14)} pflicht />
          <DatumFeld label="Letzter Tag" wert={bis} onWert={setBis} min={von ?? undefined} pflicht />
        </Stack>
        {Object.keys(gruende).length > 0 && (
          <TextField select label="Grund" value={grund} onChange={e => setGrund(e.target.value)} helperText="optional">
            <MenuItem value="">– ohne Angabe –</MenuItem>{Object.entries(gruende).map(([k, n]) => <MenuItem key={k} value={k}>{n}</MenuItem>)}
          </TextField>
        )}
        <TextField label="Nachricht an die Klassenleitung" multiline minRows={3} value={text} onChange={e => setText(e.target.value)} placeholder="z. B. Fieber, voraussichtlich bis Freitag" slotProps={{ htmlInput: { maxLength: 500 } }} />
        <Typography variant="body2" color="text.secondary">Die Meldung ersetzt keine schriftliche Entschuldigung, falls die Schule eine verlangt. Gemeldet werden ganze Schultage.</Typography>
      </Stack>
    </FormDialog>
  );
}

export function MeldungenListe({ kind, gruende }: { kind: { id: number; vorname: string; name: string }; gruende: Record<string, string> }) {
  const [neu, setNeu] = useState(false);
  const g = useLaden(() => holen<{ meldungen: Meldung[] }>(`/api/app/familie/meldungen?schueler=${kind.id}`), [kind.id]);
  return (
    <>
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 1.5, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', bgcolor: 'flaechen.band' }}>
        <Box sx={{ flex: 1, minWidth: 240 }}>
          <Typography sx={{ fontWeight: 600 }}>{kind.vorname} kann nicht zur Schule kommen?</Typography>
          <Typography variant="body2" color="text.secondary">Melden Sie die Abwesenheit hier – die Klassenleitung sieht sie sofort und bestätigt sie. Die Lehrkräfte sehen die Meldung in ihren Stunden.</Typography>
        </Box>
        <Button variant="contained" onClick={() => setNeu(true)}>Abwesenheit melden</Button>
      </Paper>
      <Geladen g={g}>{d => !d.meldungen.length ? <Leer text="Noch keine Meldungen." /> : (
        <Paper variant="outlined" sx={{ borderRadius: 1.5, overflow: 'hidden' }}>
          {d.meldungen.map(m => {
            const [st, ton] = MELDUNG_STATUS[m.status] ?? [m.status, 'neutral'];
            return (
              <Box key={m.id} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '260px minmax(0, 1fr) auto' }, gap: 1.5, px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 }, alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ fontWeight: 600 }}>{zeitraumText(m)}</Typography>
                  <Typography variant="caption" color="text.secondary">gemeldet {zeitstempel(m.gemeldet)} von {m.gemeldetVon}</Typography>
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><Plakette ton={ton}>{st}</Plakette>{m.grund && <Typography variant="body2">{gruende[m.grund] ?? m.grund}</Typography>}</Stack>
                  {m.text && <Typography variant="body2" sx={{ mt: 0.5 }}>{m.text}</Typography>}
                  {m.antwort && <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>Antwort{m.bearbeitetVon ? ` (${m.bearbeitetVon})` : ''}: {m.antwort}</Typography>}
                </Box>
                <Box>{m.status === 'gemeldet' && <Button size="small" variant="outlined" onClick={async () => {
                  if (!(await bestaetigen('Meldung zurückziehen', 'Die Meldung zurückziehen? Die Klassenleitung sieht sie dann nicht mehr.'))) return;
                  try { await api(`/api/app/familie/meldungen/${m.id}`, { methode: 'DELETE' }); toast('Meldung zurückgezogen.'); void g.neu(); } catch (err) { toast((err as Error).message, true); }
                }}>Zurückziehen</Button>}</Box>
              </Box>
            );
          })}
        </Paper>
      )}</Geladen>
      {neu && <MeldenDialog kind={kind} gruende={gruende} onClose={() => setNeu(false)} fertig={() => void g.neu()} />}
    </>
  );
}
