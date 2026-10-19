// Seitengerüst: Kopf mit Titel, Untertitel und Aktionen, optionale Filterleiste, Inhalt. Dazu Lade-, Leer- und Fehlerzustände.
import { useEffect, type ReactNode } from 'react';
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { PRODUKT } from './Marke';

export function Seite({ titel, untertitel, aktionen, filter, children, breit = true, dokumentTitel }: {
  titel?: ReactNode; untertitel?: ReactNode; aktionen?: ReactNode; filter?: ReactNode; children?: ReactNode; breit?: boolean; dokumentTitel?: string;
}) {
  useEffect(() => {
    const t = dokumentTitel ?? (typeof titel === 'string' ? titel : '');
    document.title = t ? `${t} – ${PRODUKT}` : PRODUKT;
  }, [titel, dokumentTitel]);
  return (
    <Box sx={{ maxWidth: breit ? 'none' : 1100, mx: breit ? 0 : 'auto', width: '100%' }}>
      {(titel || aktionen) && (
        <Stack direction="row" alignItems="flex-end" justifyContent="space-between" gap={2} flexWrap="wrap" className="seitenkopf"
          sx={{ mb: 2, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ minWidth: 0 }}>
            {titel && <Typography variant="h1" component="h1">{titel}</Typography>}
            {untertitel && <Typography color="text.secondary" variant="body2" sx={{ mt: 0.25, maxWidth: 900 }}>{untertitel}</Typography>}
          </Box>
          {aktionen && <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center" className="nicht-drucken">{aktionen}</Stack>}
        </Stack>
      )}
      {filter && (
        <Box className="nicht-drucken" sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>{filter}</Box>
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

/** Leerer Zustand: eine sachliche Zeile links, ohne Symbol oder Illustration; optional Zusatzzeile und Knopf. */
export function Leer({ text, aktion, unter }: { text: string; aktion?: { text: string; onClick: () => void }; unter?: ReactNode }) {
  return (
    <Box sx={{ py: 1.5, px: 2, color: 'text.secondary' }}>
      <Typography variant="body2">{text}</Typography>
      {unter && <Typography variant="body2" sx={{ mt: 0.5 }}>{unter}</Typography>}
      {aktion && <Button variant="outlined" size="small" sx={{ mt: 1 }} onClick={aktion.onClick}>{aktion.text}</Button>}
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

/** Abschnitt (Fläche mit 1-px-Rahmen) mit schlichter Kopfzeile: Titel als Text, Linie darunter, keine Tönung. */
export function Abschnitt({ titel, aktion, children, sx, kein_rand }: { titel?: ReactNode; aktion?: ReactNode; children: ReactNode; sx?: object; kein_rand?: boolean }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 1.5, overflow: 'hidden', ...sx }}>
      {(titel || aktion) && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} sx={{ px: 2, py: 1, minHeight: 40, borderBottom: 1, borderColor: 'divider', mb: kein_rand ? 0 : 0.5 }}>
          {typeof titel === 'string' ? <Typography variant="h4" component="h2">{titel}</Typography> : titel}
          {aktion}
        </Stack>
      )}
      {children}
    </Paper>
  );
}
