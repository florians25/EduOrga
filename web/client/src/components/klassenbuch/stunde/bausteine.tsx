// Bausteine im Fenster „Unterrichtsstunde“: Bereich mit schlichter Kopfzeile (Text, Linie darunter) und Hinweistext.
import type { ReactNode } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';

export function Bereichskarte({ titel, zahl, rechts, children, sx, id }: { titel: ReactNode; zahl?: number | null; rechts?: ReactNode; children: ReactNode; sx?: object; id?: string }) {
  return (
    <Paper variant="outlined" component="section" aria-labelledby={id} sx={{ borderRadius: 1.5, overflow: 'hidden', minWidth: 0, ...sx }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ px: 2, minHeight: 40, borderBottom: 1, borderColor: 'divider' }}>
        <Typography id={id} variant="h5" component="h3" sx={{ fontSize: 14 }}>{titel}</Typography>
        {!!zahl && <Box component="span" sx={{ fontSize: 13, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{zahl}</Box>}
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>{rechts}</Box>
      </Stack>
      <Box sx={{ p: 2 }}>{children}</Box>
    </Paper>
  );
}

export const Hinweis = ({ children }: { children: ReactNode }) => <Typography variant="body2" color="text.secondary">{children}</Typography>;
