// Rückmeldungen an die Benutzer*innen: kurze Hinweise (Snackbar unten) und Rückfragen (Bestätigungsdialog).
// Beides ist auch außerhalb von Komponenten aufrufbar: toast(), fehler(), bestaetigen().
import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Snackbar } from '@mui/material';

interface Hinweis { id: number; text: string; fehler: boolean }
interface Rueckfrage { titel: string; text: string; knopf: string; gefahr: boolean; ok: (x: boolean) => void }

let zaehler = 0;
const hoerer = new Set<(h: Hinweis) => void>();
const frageHoerer = new Set<(f: Rueckfrage) => void>();

export function toast(text: string, istFehler = false) {
  const h = { id: ++zaehler, text, fehler: istFehler };
  hoerer.forEach(f => f(h));
}
export function fehler(err: unknown) {
  toast((err as Error)?.message ?? String(err), true);
}
/** Rückfrage (z. B. vor dem Löschen). Ergebnis: bestätigt? */
export function bestaetigen(titel: string, text: string, knopf = 'Löschen'): Promise<boolean> {
  return new Promise(ok => {
    const f = { titel, text, knopf, gefahr: /lösch|entfern|sperr|zurückzieh|absag/i.test(knopf), ok };
    if (!frageHoerer.size) ok(window.confirm(text));
    frageHoerer.forEach(h => h(f));
  });
}

export function Meldungen() {
  const [liste, setListe] = useState<Hinweis[]>([]);
  const [frage, setFrage] = useState<Rueckfrage | null>(null);
  useEffect(() => {
    const f = (h: Hinweis) => setListe(l => [...l.slice(-2), h]);
    const g = (x: Rueckfrage) => setFrage(x);
    hoerer.add(f);
    frageHoerer.add(g);
    return () => { hoerer.delete(f); frageHoerer.delete(g); };
  }, []);
  const aktuell = liste[0];
  const schliessen = (antwort: boolean) => { frage?.ok(antwort); setFrage(null); };
  return (
    <>
      <Snackbar key={aktuell?.id} open={!!aktuell} autoHideDuration={aktuell?.fehler ? 6000 : 3200}
        onClose={(_, grund) => { if (grund !== 'clickaway') setListe(l => l.slice(1)); }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {aktuell ? (
          <Alert variant="filled" severity={aktuell.fehler ? 'error' : 'success'} onClose={() => setListe(l => l.slice(1))}
            sx={{ minWidth: 280, boxShadow: '0 12px 32px rgba(21,26,33,.18)', ...(aktuell.fehler ? {} : { bgcolor: 'grey.900', color: '#fff' }) }}>
            {aktuell.text}
          </Alert>
        ) : undefined}
      </Snackbar>
      <Dialog open={!!frage} onClose={() => schliessen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{frage?.titel}</DialogTitle>
        <DialogContent><DialogContentText sx={{ whiteSpace: 'pre-line' }}>{frage?.text}</DialogContentText></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => schliessen(false)}>Abbrechen</Button>
          <Button variant="contained" color={frage?.gefahr ? 'error' : 'primary'} onClick={() => schliessen(true)} autoFocus>{frage?.knopf}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
