// „Über EduOrga“ (Anmeldeseite und Kontomenü): Produkt, Slogan, Bestandteile und der rechtliche Hinweis aus design/MARKE.md.
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import { Marke, PRODUKT, RECHTSHINWEIS, SLOGAN } from './Marke';

/** Rechtlicher Hinweis als Block (auch in Administration | Über EduOrga). */
export function Rechtshinweis() {
  return (
    <Box sx={{ borderLeft: '3px solid', borderColor: 'secondary.main', bgcolor: 'flaechen.band', px: 1.75, py: 1.25, borderRadius: 1 }}>
      <Typography variant="subtitle2" sx={{ mb: 0.25 }}>Rechtlicher Hinweis</Typography>
      <Typography variant="body2" color="text.secondary">{RECHTSHINWEIS}</Typography>
    </Box>
  );
}

export function UeberDialog({ offen, onClose }: { offen: boolean; onClose: () => void }) {
  return (
    <Dialog open={offen} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="ueber-titel">
      <DialogTitle id="ueber-titel">Über EduOrga</DialogTitle>
      <DialogContent>
        <Stack gap={2}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap">
            <Marke groesse={30} />
            <Typography sx={{ fontWeight: 500 }}>{SLOGAN}</Typography>
          </Stack>
          <Typography variant="body2">
            {PRODUKT} ist das Portal der Schule für Lehrkräfte, Schüler*innen und Eltern: Stundenpläne, Vertretungen, Klassenbuch,
            Mitteilungen, Termine und Buchungen. Geplant wird in EduOrga Studio; unterwegs gibt es EduOrga Mobile.
          </Typography>
          <Rechtshinweis />
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Schließen</Button></DialogActions>
    </Dialog>
  );
}
