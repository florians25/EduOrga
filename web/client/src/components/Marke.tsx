// Marke „UP“ (U und P teilen sich den mittleren Strich) und Wortmarke „UntPlan“.
import { Box, Typography } from '@mui/material';

export function Zeichen({ groesse = 28, farbe = 'currentColor' }: { groesse?: number; farbe?: string }) {
  return (
    <svg viewBox="8 10 48 46" width={groesse} height={groesse * 46 / 48} aria-hidden="true" focusable="false" style={{ color: farbe, flex: 'none' }}>
      <path d="M14 16v18a10 10 0 0 0 20 0V16" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="square" />
      <path d="M34 16h8a8 8 0 0 1 0 16h-8M34 34v16" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="square" />
    </svg>
  );
}

export function Marke({ zusatz = 'Web', groesse = 28, hell = false }: { zusatz?: string; groesse?: number; hell?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, color: hell ? '#fff' : 'primary.main' }}>
      <Zeichen groesse={groesse} />
      <Typography component="span" sx={{ fontWeight: 600, fontSize: groesse * 0.68, color: hell ? '#fff' : 'text.primary', letterSpacing: '-0.01em' }}>
        UntPlan{zusatz && <Box component="span" sx={{ fontWeight: 400, color: hell ? 'rgba(255,255,255,.7)' : 'text.secondary', ml: 0.75 }}>{zusatz}</Box>}
      </Typography>
    </Box>
  );
}
