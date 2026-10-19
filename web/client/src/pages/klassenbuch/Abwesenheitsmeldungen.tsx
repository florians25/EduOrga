// Klassenbuch → Abwesenheiten → „Meldungen der Eltern“: Arbeitsliste der Klassenleitung (bzw. wer Abwesenheiten aller Klassen verwaltet).
// Eltern bzw. Schüler*innen melden eine Abwesenheit; hier wird sie bestätigt – dabei entsteht die Abwesenheit für alle Unterrichtsstunden
// der Tage, auf Wunsch gleich entschuldigt – oder mit einer Antwort abgelehnt. Bearbeitete Meldungen bleiben zur Nachverfolgung sichtbar.
import { useState } from 'react';
import { Box, Button, Checkbox, FormControlLabel, Paper, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { holen, senden } from '../../api/client';
import { FormDialog, Plakette } from '../../components/Bausteine';
import { Geladen, Leer } from '../../components/Seite';
import { datumDe, wochentagKurz, zeitstempel } from '../../lib/datum';
import { toast } from '../../lib/meldungen';
import { useLaden } from '../../lib/useLaden';
import { MELDUNG_STATUS, type Meldung } from '../familie/Meldungen';

const zeitraum = (m: Meldung) => (m.von === m.bis ? `${wochentagKurz(m.von)} ${datumDe(m.von)}` : `${wochentagKurz(m.von)} ${datumDe(m.von)} – ${wochentagKurz(m.bis)} ${datumDe(m.bis)}`);

export function Abwesenheitsmeldungen({ klasse, grundName, geaendert }: { klasse: string; grundName: (k: string) => string; geaendert: () => void }) {
  const [ansicht, setAnsicht] = useState<'offen' | 'alle'>('offen');
  const [dialog, setDialog] = useState<{ m: Meldung; art: 'bestaetigen' | 'ablehnen' } | null>(null);
  const g = useLaden(() => holen<Meldung[]>(`/api/app/abwesenheiten/meldungen${ansicht === 'offen' ? '?status=gemeldet' : ''}${klasse ? `${ansicht === 'offen' ? '&' : '?'}klasse=${encodeURIComponent(klasse)}` : ''}`), [ansicht, klasse]);
  return (
    <>
      <Stack direction="row" gap={1.5} alignItems="center" flexWrap="wrap" sx={{ mb: 1.5 }}>
        <ToggleButtonGroup exclusive size="small" value={ansicht} onChange={(_, v) => v && setAnsicht(v)} aria-label="Meldungen">
          <ToggleButton value="offen">Zu bestätigen</ToggleButton><ToggleButton value="alle">Alle Meldungen</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="body2" color="text.secondary">Eltern und Schüler*innen melden Abwesenheiten online. Mit „Bestätigen“ wird die Abwesenheit für alle Unterrichtsstunden der Tage eingetragen.</Typography>
      </Stack>
      <Geladen g={g}>{l => !l.length ? <Leer text={ansicht === 'offen' ? 'Keine Meldungen zu bestätigen.' : 'Noch keine Meldungen.'} /> : (
        <Paper variant="outlined" sx={{ borderRadius: 1.5, overflow: 'hidden' }}>
          {l.map(m => {
            const [st, ton] = MELDUNG_STATUS[m.status] ?? [m.status, 'neutral'];
            return (
              <Box key={m.id} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(200px, 1fr) 230px minmax(0, 1.4fr) auto' }, gap: 1.5, px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 }, alignItems: 'center' }}>
                <Stack direction="row" gap={1.25} alignItems="center">
                  <Box><Typography variant="body2" sx={{ fontWeight: 600 }}>{m.schueler || `Schüler*in ${m.schuelerId}`}</Typography><Typography variant="caption" color="text.secondary">Klasse {m.klasse}</Typography></Box></Stack>
                <Box><Typography variant="body2" sx={{ fontWeight: 500 }}>{zeitraum(m)}</Typography><Typography variant="caption" color="text.secondary">gemeldet {zeitstempel(m.gemeldet)} · {m.gemeldetVon}</Typography></Box>
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><Plakette ton={ton}>{st}</Plakette>{m.grund && <Plakette>{grundName(m.grund)}</Plakette>}</Stack>
                  {m.text && <Typography variant="body2" sx={{ mt: 0.5 }}>{m.text}</Typography>}
                  {m.status !== 'gemeldet' && m.bearbeitetVon && <Typography variant="caption" color="text.secondary">{m.status === 'bestaetigt' ? 'Bestätigt' : 'Bearbeitet'} von {m.bearbeitetVon} am {zeitstempel(m.bearbeitet)}{m.antwort ? ` · Antwort: ${m.antwort}` : ''}</Typography>}
                </Box>
                <Stack direction="row" gap={1}>{m.status === 'gemeldet' && <>
                  <Button size="small" variant="outlined" color="error" onClick={() => setDialog({ m, art: 'ablehnen' })}>Ablehnen</Button>
                  <Button size="small" variant="contained" onClick={() => setDialog({ m, art: 'bestaetigen' })}>Bestätigen</Button></>}</Stack>
              </Box>
            );
          })}
        </Paper>
      )}</Geladen>
      {dialog && <BearbeitenDialog {...dialog} onClose={() => setDialog(null)} fertig={() => { void g.neu(); geaendert(); }} />}
    </>
  );
}

function BearbeitenDialog({ m, art, onClose, fertig }: { m: Meldung; art: 'bestaetigen' | 'ablehnen'; onClose: () => void; fertig: () => void }) {
  const [entschuldigt, setEntschuldigt] = useState(true);
  const [antwort, setAntwort] = useState('');
  const ja = art === 'bestaetigen';
  return (
    <FormDialog offen titel={ja ? 'Meldung bestätigen' : 'Meldung ablehnen'} untertitel={`${m.schueler} (${m.klasse}) · ${zeitraum(m)}`} onClose={onClose} aktionText={ja ? 'Bestätigen und eintragen' : 'Ablehnen'} gefahr={!ja}
      aktion={async () => {
        if (!ja && !antwort.trim()) { toast('Bitte eine kurze Begründung angeben.', true); return false; }
        if (ja) {
          const r = await senden<{ stunden: number }>(`/api/app/abwesenheiten/meldungen/${m.id}/bestaetigen`, { entschuldigt, antwort });
          toast(`Bestätigt – ${r.stunden} ${r.stunden === 1 ? 'Fehlstunde' : 'Fehlstunden'} eingetragen.`);
        } else { await senden(`/api/app/abwesenheiten/meldungen/${m.id}/ablehnen`, { antwort }); toast('Meldung abgelehnt.'); }
        fertig();
      }}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        {m.text && <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover' }}><Typography variant="caption" color="text.secondary">Nachricht von {m.gemeldetVon}</Typography><Typography variant="body2">{m.text}</Typography></Box>}
        {ja && <FormControlLabel control={<Checkbox checked={entschuldigt} onChange={e => setEntschuldigt(e.target.checked)} />} label="Gleich als entschuldigt eintragen (Recht „Entschuldigen“ erforderlich)" />}
        <TextField label={ja ? 'Antwort (optional)' : 'Begründung'} multiline minRows={2} value={antwort} onChange={e => setAntwort(e.target.value)} required={!ja} slotProps={{ htmlInput: { maxLength: 500 } }}
          helperText="Sichtbar für Eltern bzw. Schüler*in." />
      </Stack>
    </FormDialog>
  );
}
