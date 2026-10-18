// Gemeinsame Bausteine für Abwesenheiten und Fehlzeiten: Status-Plaketten, „zählt“-Kästchen, Fehlzeitentabelle je Unterrichtsstunde,
// Nachweisarten und die Detailfelder (Nachweis, Eingang der Entschuldigung, Eltern informiert, interne Notiz), gemeinsamer Zeitraum.
import { Box, FormControlLabel, MenuItem, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { Plakette } from '../Bausteine';
import { DatumFeld } from '../Auswahl';
import { datumKurz, wochentagKurz } from '../../lib/datum';
import { lesen, schreiben } from '../../lib/speicher';

export const STATUS_TEXT: Record<string, [string, 'pruefung' | 'ok' | 'entfall']> = { offen: ['offen', 'pruefung'], entschuldigt: ['entschuldigt', 'ok'], unentschuldigt: ['nicht entschuldigt', 'entfall'] };
export function StatusLabel({ s }: { s: string }) {
  const x = STATUS_TEXT[s];
  return x ? <Plakette ton={x[1]}>{x[0]}</Plakette> : <Plakette>{s}</Plakette>;
}
export function Zaehlt({ an }: { an: boolean }) {
  return <Box component="span" role="img" aria-label={an ? 'zählt' : 'zählt nicht'} title={an ? 'zählt als Fehlstunde' : 'zählt nicht als Fehlstunde'}
    sx={{ display: 'inline-block', width: 14, height: 14, borderRadius: 0.75, border: 1.5, borderColor: an ? 'status.entfall.main' : 'divider', bgcolor: an ? 'status.entfall.main' : 'transparent' }} />;
}
export const DatumZelle = ({ iso, zeit, vor = '' }: { iso: string; zeit?: string; vor?: string }) => (
  <Box component="span" sx={{ whiteSpace: 'nowrap' }}><Box component="span" sx={{ color: 'text.secondary' }}>{vor}{wochentagKurz(iso)}</Box> <b style={{ fontWeight: 500 }}>{datumKurz(iso)}</b>{zeit && <Box component="span" sx={{ color: 'text.secondary' }}> {zeit}</Box>}</Box>
);

export interface FehlzeitZeile { id: number; schueler?: string; schuelerId?: number; datum: string; beginn: string; ende: string; abwesendVon: string; abwesendBis: string; fach: string; lehrer: string; fehltage: number; fehlstunden: number; fehlminuten: number; zaehlt: boolean; grund: string; status: string; text: string; stunde?: number; art?: string }

export function FehlzeitenTabelle({ zeilen, grundName = g => g, schueler = false }: { zeilen: FehlzeitZeile[]; grundName?: (g: string) => string; schueler?: boolean }) {
  if (!zeilen.length) return <Typography color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>Keine Fehlzeiten im Zeitraum.</Typography>;
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead><TableRow>{schueler && <TableCell>Schüler*in</TableCell>}<TableCell>Datum</TableCell><TableCell>Zeit</TableCell><TableCell>Fach</TableCell><TableCell>Lehrkraft</TableCell>
          <TableCell align="right">Fehltage</TableCell><TableCell align="right">Fehlstd.</TableCell><TableCell align="right">Fehlmin.</TableCell><TableCell align="center">zählt</TableCell><TableCell>Abwesenheitsgrund</TableCell><TableCell>Status</TableCell><TableCell>Text</TableCell></TableRow></TableHead>
        <TableBody>{zeilen.map((z, i) => (
          <TableRow key={z.id ?? i} hover>
            {schueler && <TableCell>{z.schueler}</TableCell>}
            <TableCell><DatumZelle iso={z.datum} /></TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{z.beginn} – {z.ende}{(z.abwesendVon !== z.beginn || z.abwesendBis !== z.ende) && <Typography variant="caption" component="div">abwesend {z.abwesendVon}–{z.abwesendBis}</Typography>}</TableCell>
            <TableCell>{z.fach}</TableCell><TableCell>{z.lehrer}</TableCell>
            <TableCell align="right">{z.fehltage}</TableCell><TableCell align="right">{z.fehlstunden}</TableCell><TableCell align="right">{z.fehlminuten}</TableCell>
            <TableCell align="center"><Zaehlt an={z.zaehlt} /></TableCell><TableCell>{grundName(z.grund)}</TableCell><TableCell><StatusLabel s={z.status} /></TableCell>
            <TableCell sx={{ maxWidth: 220 }}>{z.text}</TableCell>
          </TableRow>
        ))}</TableBody>
      </Table>
    </Box>
  );
}

export const NACHWEISE: Record<string, string> = { attest: 'ärztliches Attest', schriftlich: 'schriftliche Entschuldigung', muendlich: 'mündlich', telefonisch: 'telefonisch', email: 'per E-Mail' };
export const nachweisKurz = (n: string) => (NACHWEISE[n] ?? n).replace('ärztliches ', '').replace(' Entschuldigung', '');

export interface Details { nachweis: string; entschuldigtAm: string; elternInformiert: boolean; notizIntern: string }
export const detailsVon = (z: Partial<Details> = {}): Details => ({ nachweis: z.nachweis ?? '', entschuldigtAm: z.entschuldigtAm ?? '', elternInformiert: !!z.elternInformiert, notizIntern: z.notizIntern ?? '' });

export function DetailFelder({ w, setW }: { w: Details; setW: (d: Details) => void }) {
  return (
    <Stack gap={2}>
      <Typography variant="subtitle2" sx={{ mt: 1 }}>Weitere Angaben</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
        <TextField select label="Nachweis" value={w.nachweis} onChange={e => setW({ ...w, nachweis: e.target.value })} sx={{ flex: 1 }}>
          <MenuItem value="">kein Nachweis</MenuItem>{Object.entries(NACHWEISE).map(([k, t]) => <MenuItem key={k} value={k}>{t}</MenuItem>)}
        </TextField>
        <DatumFeld label="Entschuldigung eingegangen am" wert={w.entschuldigtAm || null} onWert={d => setW({ ...w, entschuldigtAm: d ?? '' })} breite={230} />
      </Stack>
      <FormControlLabel control={<Switch checked={w.elternInformiert} onChange={e => setW({ ...w, elternInformiert: e.target.checked })} />} label="Eltern bzw. Erziehungsberechtigte informiert" />
      <TextField label="Interne Notiz (nur Klassenleitung)" multiline minRows={2} value={w.notizIntern} onChange={e => setW({ ...w, notizIntern: e.target.value })} slotProps={{ htmlInput: { maxLength: 1000 } }} />
    </Stack>
  );
}

export function DetailSymbole({ z }: { z: Partial<Details> }) {
  return (
    <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
      {z.nachweis && <Plakette title={`Nachweis: ${NACHWEISE[z.nachweis] ?? z.nachweis}${z.entschuldigtAm ? ` · eingegangen ${z.entschuldigtAm.split('-').reverse().join('.')}` : ''}`}>{nachweisKurz(z.nachweis)}</Plakette>}
      {z.elternInformiert && <Plakette title="Eltern informiert">Eltern</Plakette>}
      {z.notizIntern && <Plakette title={z.notizIntern}>Notiz</Plakette>}
    </Stack>
  );
}

/** Gemeinsamer Zeitraum und Klasse von Fehlzeiten und Abwesenheiten (je Sitzung). */
export interface AbwZeitraum { von: string; bis: string; klasse: string }
export function abwZeitraum(wert?: AbwZeitraum): AbwZeitraum | null {
  if (wert) { schreiben('untplan:abw-zeitraum', wert, true); return wert; }
  const x = lesen<AbwZeitraum | null>('untplan:abw-zeitraum', null, true);
  return x && /^\d{4}-\d{2}-\d{2}$/.test(x.von) && /^\d{4}-\d{2}-\d{2}$/.test(x.bis) ? x : null;
}
