// Hoch- oder Querformat vor dem Erstellen eines PDF-Formulars bzw. vor dem Drucken wählen (letzte Wahl je Formular gemerkt).
import { useEffect, useState } from 'react';
import { Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import { lesen, schreiben } from './speicher';

type Ausrichtung = 'hoch' | 'quer';
let anfrage: ((v: { vorgabe: Ausrichtung; schluessel: string; ok: (a: Ausrichtung | null) => void }) => void) | null = null;

export function pdfAusrichtung(vorgabe: Ausrichtung = 'quer', schluessel = ''): Promise<Ausrichtung | null> {
  return new Promise(ok => { if (anfrage) anfrage({ vorgabe, schluessel, ok }); else ok(vorgabe); });
}
export const mitAusrichtung = (url: string, a: Ausrichtung) => `${url}${url.includes('?') ? '&' : '?'}ausrichtung=${a}`;

/** PDF-Adresse der Schnittstelle nach Formatwahl in neuem Tab öffnen. */
export async function pdfOeffnen(url: string, vorgabe: Ausrichtung = 'quer') {
  const a = await pdfAusrichtung(vorgabe, url.split('?')[0].replace(/\/\d+(?=\/|$)/g, ''));
  if (a) window.open(mitAusrichtung(url, a), '_blank', 'noopener');
}

/** Browserdruck im gewählten Format (setzt @page für diesen Druck). */
export async function druckenMitAusrichtung(vorgabe: Ausrichtung = 'quer', schluessel = 'druck') {
  const w = await pdfAusrichtung(vorgabe, schluessel);
  if (!w) return false;
  const st = document.createElement('style');
  st.textContent = `@page { size: A4 ${w === 'hoch' ? 'portrait' : 'landscape'}; }`;
  document.head.append(st);
  const weg = () => { st.remove(); window.removeEventListener('afterprint', weg); };
  window.addEventListener('afterprint', weg);
  window.print();
  setTimeout(weg, 1500);
  return true;
}

export function PdfWahl() {
  const [z, setZ] = useState<{ vorgabe: Ausrichtung; schluessel: string; ok: (a: Ausrichtung | null) => void } | null>(null);
  const [wahl, setWahl] = useState<Ausrichtung>('quer');
  useEffect(() => {
    anfrage = v => { setWahl(lesen<Ausrichtung | null>(`untplan:pdf:${v.schluessel}`, null) ?? v.vorgabe); setZ(v); };
    return () => { anfrage = null; };
  }, []);
  const fertig = (a: Ausrichtung | null) => { if (a && z?.schluessel) schreiben(`untplan:pdf:${z.schluessel}`, a); z?.ok(a); setZ(null); };
  return (
    <Dialog open={!!z} onClose={() => fertig(null)} maxWidth="xs" fullWidth>
      <DialogTitle>Format des Formulars</DialogTitle>
      <DialogContent>
        <Stack direction="row" gap={2} justifyContent="center">
          {(['hoch', 'quer'] as const).map(a => (
            <ButtonBase key={a} onClick={() => setWahl(a)} onDoubleClick={() => fertig(a)} aria-pressed={wahl === a}
              sx={{ flexDirection: 'column', gap: 1, p: 2, borderRadius: 3, border: 2, borderColor: wahl === a ? 'primary.main' : 'divider', width: 130 }}>
              <Box sx={{ width: a === 'hoch' ? 44 : 62, height: a === 'hoch' ? 62 : 44, border: 2, borderColor: 'text.secondary', borderRadius: 1, p: 0.75, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {[0, 1, 2].map(i => <Box key={i} sx={{ height: 3, bgcolor: 'divider', borderRadius: 1 }} />)}
              </Box>
              <Typography sx={{ fontWeight: 500 }}>{a === 'hoch' ? 'Hochformat' : 'Querformat'}</Typography>
              {z?.vorgabe === a && <Typography variant="caption" color="text.secondary">empfohlen</Typography>}
            </ButtonBase>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}><Button variant="outlined" onClick={() => fertig(null)}>Abbrechen</Button><Button variant="contained" onClick={() => fertig(wahl)} autoFocus>PDF erstellen</Button></DialogActions>
    </Dialog>
  );
}
