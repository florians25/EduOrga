// Bausteine im Fenster „Unterrichtsstunde“: Karte mit getöntem Kopfband und Hinweistext.
import type { ReactNode } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';

export function Bereichskarte({ titel, zahl, rechts, children, sx, id }: { titel: ReactNode; zahl?: number | null; rechts?: ReactNode; children: ReactNode; sx?: object; id?: string }) {
  return (
    <Paper variant="outlined" component="section" aria-labelledby={id} sx={{ borderRadius: 2, overflow: 'hidden', minWidth: 0, ...sx }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ px: 2, minHeight: 42, bgcolor: 'flaechen.band', borderBottom: 1, borderColor: 'divider' }}>
        <Typography id={id} variant="h5" component="h3" sx={{ fontSize: 14 }}>{titel}</Typography>
        {!!zahl && <Box sx={{ px: 0.75, minWidth: 20, height: 18, borderRadius: '3px', bgcolor: 'action.hover', fontSize: 12, fontWeight: 600, display: 'grid', placeItems: 'center' }}>{zahl}</Box>}
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>{rechts}</Box>
      </Stack>
      <Box sx={{ p: 2 }}>{children}</Box>
    </Paper>
  );
}

export const Hinweis = ({ children }: { children: ReactNode }) => <Typography variant="body2" color="text.secondary">{children}</Typography>;
