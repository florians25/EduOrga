// Reiter „Einträge“ im Fenster „Unterrichtsstunde“: Klassenbucheinträge der Klasse(n) – zur Klasse oder zu einzelnen Schüler*innen –
// mit Filter (Zeitraum, Schüler*in, Kategorie) und „Neuer Eintrag“. Bearbeiten und Löschen unter Klassenbuch → Einträge.
import { useState } from 'react';
import { Box, Button, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { datumDe, plusTage, wochentagKurz } from '../../../lib/datum';
import { Plakette } from '../../Bausteine';
import { kuerzel } from '../../plan/logik';
import { Bereichskarte, Hinweis } from './bausteine';
import type { StundeProps } from './kontext';

export const vermerkTon = (art: string) => (art === 'Lob' ? 'ok' : /ordnung|verweis|tadel/i.test(art) ? 'entfall' : /eltern/i.test(art) ? 'frei' : 'neutral') as 'ok' | 'entfall' | 'frei' | 'neutral';

export function ReiterEintraege({ k, d, setDialog }: StundeProps) {
  const [zeitraum, setZeitraum] = useState<'tag' | 'woche' | 'alle'>('woche');
  const [schueler, setSchueler] = useState<number | ''>('');
  const [art, setArt] = useState('');
  const sl = d.anw?.schueler ?? [];
  const name = (id: number | null) => { if (!id) return ''; const x = sl.find(y => y.id === id); return x ? `${x.name}, ${x.vorname}` : 'Schüler*in'; };
  const ab = zeitraum === 'tag' ? k.datum : zeitraum === 'woche' ? plusTage(k.datum, -6) : '';
  const liste = d.vermerke.filter(v => (!ab || (v.datum >= ab && v.datum <= k.datum)) && (!schueler || v.schuelerId === schueler) && (!art || v.art === art));
  const arten = [...new Set([...d.arten, ...d.vermerke.map(v => v.art)])];
  return (
    <Bereichskarte titel={`Klassenbucheinträge · ${kuerzel(k.klassen).join(', ')}`} zahl={liste.length || null}
      rechts={<Button size="small" variant="contained" onClick={() => setDialog({ art: 'eintrag', ids: schueler ? [schueler] : [] })}>Neuer Eintrag</Button>}>
      <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="center" sx={{ mb: 2 }}>
        <ToggleButtonGroup exclusive size="small" value={zeitraum} onChange={(_, v) => v && setZeitraum(v)} aria-label="Zeitraum">
          <ToggleButton value="tag">Dieser Tag</ToggleButton><ToggleButton value="woche">7 Tage</ToggleButton><ToggleButton value="alle">Schuljahr</ToggleButton>
        </ToggleButtonGroup>
        <TextField select label="Betrifft" value={schueler} onChange={e => setSchueler(e.target.value === '' ? '' : Number(e.target.value))} sx={{ minWidth: 220 }}>
          <MenuItem value="">alle (Klasse und Schüler*innen)</MenuItem>{sl.map(x => <MenuItem key={x.id} value={x.id}>{x.name}, {x.vorname}</MenuItem>)}
        </TextField>
        <TextField select label="Kategorie" value={art} onChange={e => setArt(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">alle</MenuItem>{arten.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
        </TextField>
        <Box sx={{ flex: 1 }} />
        <Button size="small" href="#/eintraege">Alle Einträge verwalten</Button>
      </Stack>
      {liste.length ? (
        <Box role="list">
          {liste.slice(0, 100).map(v => (
            <Box role="listitem" key={v.id} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '112px 150px minmax(0, 1fr) auto' }, columnGap: 1.5, rowGap: 0.25, py: 1, borderTop: 1, borderColor: 'divider', alignItems: 'baseline' }}>
              <Typography variant="body2" color="text.secondary">{wochentagKurz(v.datum)} {datumDe(v.datum)}</Typography>
              <Box><Plakette ton={vermerkTon(v.art)}>{v.art}</Plakette></Box>
              <Typography variant="body2"><b>{v.schuelerId ? name(v.schuelerId) : `Klasse ${v.klasse}`}: </b>{v.text}</Typography>
              <Typography variant="caption" color="text.secondary">{v.lehrer}</Typography>
            </Box>
          ))}
        </Box>
      ) : <Hinweis>{zeitraum === 'alle' ? 'Noch keine Klassenbucheinträge.' : 'Keine Einträge im gewählten Zeitraum.'}</Hinweis>}
    </Bereichskarte>
  );
}
