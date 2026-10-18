// Seitengerüst: Kopf mit Titel, Untertitel und Aktionen, optionale Filterleiste, Inhalt. Dazu Lade-, Leer- und Fehlerzustände.
import { useEffect, type ReactNode } from 'react';
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import InboxOutlined from '@mui/icons-material/InboxOutlined';

export function Seite({ titel, untertitel, aktionen, filter, children, breit = true, dokumentTitel }: {
  titel?: ReactNode; untertitel?: ReactNode; aktionen?: ReactNode; filter?: ReactNode; children?: ReactNode; breit?: boolean; dokumentTitel?: string;
}) {
  useEffect(() => {
    const t = dokumentTitel ?? (typeof titel === 'string' ? titel : '');
    document.title = t ? `${t} – UntPlanWeb` : 'UntPlanWeb';
  }, [titel, dokumentTitel]);
  return (
    <Box sx={{ maxWidth: breit ? 'none' : 1100, mx: breit ? 0 : 'auto', width: '100%' }}>
      {(titel || aktionen) && (
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2} flexWrap="wrap" sx={{ mb: filter ? 2 : 3 }} className="seitenkopf">
          <Box sx={{ minWidth: 0 }}>
            {titel && <Typography variant="h1" component="h1">{titel}</Typography>}
            {untertitel && <Typography color="text.secondary" sx={{ mt: 0.5 }}>{untertitel}</Typography>}
          </Box>
          {aktionen && <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center" className="nicht-drucken">{aktionen}</Stack>}
        </Stack>
      )}
      {filter && (
        <Paper variant="outlined" className="nicht-drucken" sx={{ p: 1.5, mb: 2.5, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>{filter}</Paper>
      )}
      {children}
    </Box>
  );
}

export function Laden({ hoehe = 200 }: { hoehe?: number }) {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: hoehe }} role="status" aria-label="Wird geladen">
      <CircularProgress size={28} thickness={4} />
    </Box>
  );
}

export function Leer({ text, symbol, aktion, unter }: { text: string; symbol?: ReactNode; aktion?: { text: string; onClick: () => void }; unter?: ReactNode }) {
  return (
    <Box sx={{ textAlign: 'center', py: 6, px: 2, color: 'text.secondary' }}>
      <Box sx={{ color: 'text.disabled', mb: 1, '& svg': { fontSize: 36 } }}>{symbol ?? <InboxOutlined />}</Box>
      <Typography sx={{ fontWeight: 500 }}>{text}</Typography>
      {unter && <Typography variant="body2" sx={{ mt: 0.5 }}>{unter}</Typography>}
      {aktion && <Button variant="outlined" sx={{ mt: 2 }} onClick={aktion.onClick}>{aktion.text}</Button>}
    </Box>
  );
}

export function Fehler({ fehler, neu }: { fehler: Error | null | undefined; neu?: () => void }) {
  if (!fehler) return null;
  return <Alert severity="error" sx={{ mb: 2 }} action={neu ? <Button color="inherit" size="small" onClick={neu}>Erneut versuchen</Button> : undefined}>{fehler.message}</Alert>;
}

/** Inhalt erst nach dem Laden: Ladeanzeige, Fehler oder Kinder. */
export function Geladen<T>({ g, children, hoehe }: { g: { daten: T | undefined; laedt: boolean; fehler: Error | null; neu: () => void }; children: (d: T) => ReactNode; hoehe?: number }) {
  if (g.fehler && g.daten === undefined) return <Fehler fehler={g.fehler} neu={g.neu} />;
  if (g.daten === undefined) return <Laden hoehe={hoehe} />;
  return <>{children(g.daten)}</>;
}

/** Karte (Paper) mit Kopfzeile. */
export function Abschnitt({ titel, aktion, children, sx, kein_rand }: { titel?: ReactNode; aktion?: ReactNode; children: ReactNode; sx?: object; kein_rand?: boolean }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 3.5, overflow: 'hidden', ...sx }}>
      {(titel || aktion) && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} sx={{ px: 2, pt: 1.75, pb: kein_rand ? 1.75 : 1, ...(kein_rand ? { borderBottom: 1, borderColor: 'divider' } : {}) }}>
          {typeof titel === 'string' ? <Typography variant="h4" component="h2">{titel}</Typography> : titel}
          {aktion}
        </Stack>
      )}
      {children}
    </Paper>
  );
}
