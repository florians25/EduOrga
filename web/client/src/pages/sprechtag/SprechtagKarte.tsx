// Hinweiskarte „Sprechtag“ auf der Startseite (Einladungs- bzw. Anmeldezeitraum).
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import ForumOutlined from '@mui/icons-material/ForumOutlined';
import { holen } from '../../api/client';
import { useLaden } from '../../lib/useLaden';
import { Plakette } from '../../components/Bausteine';

interface StartKarte { id: number; name: string; datumText: string; beginn?: string; ende?: string; ort?: string; status?: string; text?: string }

export function SprechtagKarte() {
  const g = useLaden(() => holen<StartKarte[]>('/api/app/sprechtag/start').catch(() => []), []);
  if (!g.daten?.length) return null;
  return (
    <>
      {g.daten.map(k => (
        <Paper key={k.id} variant="outlined" sx={{ p: 2, borderRadius: 3.5, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: 'action.selected', color: 'primary.main', display: 'grid', placeItems: 'center', flex: 'none' }}><ForumOutlined fontSize="small" /></Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><Typography sx={{ fontWeight: 600 }}>{k.name}</Typography>{k.status === 'angekuendigt' && <Plakette ton="termin">angekündigt</Plakette>}</Stack>
            <Typography variant="body2" color="text.secondary">{k.datumText}{k.beginn ? ` · ${k.beginn}–${k.ende} Uhr` : ''}{k.ort ? ` · ${k.ort}` : ''}</Typography>
            {k.text && <Typography variant="body2" sx={{ mt: 0.5 }}>{k.text}</Typography>}
            <Button size="small" href={`#/sprechtag/${k.id}`} sx={{ mt: 1, ml: -1 }}>Zum Sprechtag</Button>
          </Box>
        </Paper>
      ))}
    </>
  );
}
