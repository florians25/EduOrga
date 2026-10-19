// Gemeinsame Bausteine des Sprechtags: Phasen, Kopfzeile, Absage mit Grund, Zeitfenster-Berechnung.
import { useState } from 'react';
import { Alert, Box, Link, Stack, TextField, Typography } from '@mui/material';
import { FormDialog, Plakette, type Ton } from '../../components/Bausteine';

export const BASIS = '/api/app/sprechtag';
export interface Lehrkraft { lehrer: string; raum?: string; dauer?: number; online?: boolean; link?: string; abgesagt?: string | null }
export interface Sprechtag {
  id: number; name: string; datum: string; datumText: string; beginn: string; ende: string; dauer: number; ort?: string; hinweis: string; phase: string; status?: string;
  einladungBis: string; einladungEnde?: string; anmeldungVon: string; anmeldungBis: string; anmeldungVonText?: string; anmeldungBisText?: string; sichtbar: boolean; raumwahl: boolean;
  pausen: { von: string; bis: string }[]; zeitbloecke?: { von: string; bis: string }[]; lehrkraefte: Lehrkraft[]; zeitfenster: number; absageGrund?: string;
  reihe?: { id: number; datumText: string }[];
  optionen?: { puffer?: number; maxTermineFamilie?: number; warteliste?: boolean; erinnerungStunden?: number; sichtbarEltern?: boolean; sichtbarSchueler?: boolean; ankuendigen?: boolean };
}
export interface SchuelerKurz { id: number; name: string; vorname: string; klasse: string; elternkonto?: boolean }

export const zeitDe = (iso: string | null | undefined) => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}` : '';
};
export const PHASEN: Record<string, [Ton, string]> = {
  vorbereitung: ['neutral', 'nicht sichtbar'], einladung: ['termin', 'Einladungsphase'], angekuendigt: ['termin', 'angekündigt'], anmeldung: ['ok', 'Anmeldung läuft'],
  geschlossen: ['pruefung', 'Anmeldung geschlossen'], vorbei: ['neutral', 'vorbei'], abgesagt: ['entfall', 'abgesagt'],
};
export const absagbar = (t: Sprechtag) => !['vorbei', 'abgesagt'].includes(t.phase);
export const schuelerName = (s?: { name: string; vorname: string } | null) => (s ? `${s.name}, ${s.vorname}` : '');
export const minutenAus = (hhmm: string) => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return h * 60 + m; };
export const zeitText = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function PhasenPlakette({ t, familie = false }: { t: Sprechtag; familie?: boolean }) {
  const p = familie ? t.status ?? t.phase : t.phase;
  const [ton, text] = PHASEN[p] ?? ['neutral', p];
  return <Plakette ton={ton}>{text}</Plakette>;
}

/** Zeitfenster wie auf dem Server: Blöcke (Lücken = Pausen), Takt Termindauer + Puffer. */
export function zeitfenster(bloecke: { von: string; bis: string }[], dauer: number, puffer: number): [number, number][] {
  const b = bloecke.filter(x => x.von && x.bis && minutenAus(x.bis) > minutenAus(x.von)).map(x => [minutenAus(x.von), minutenAus(x.bis)]).sort((x, y) => x[0] - y[0]);
  if (!b.length || !(dauer > 0)) return [];
  const pausen = b.slice(1).map((x, i) => [b[i][1], x[0]]).filter(([v, bis]) => bis > v);
  const ende = b[b.length - 1][1];
  const res: [number, number][] = [];
  let z = b[0][0];
  while (z + dauer <= ende && res.length < 500) {
    const p = pausen.find(([v, bis]) => z < bis && z + dauer > v);
    if (p) { z = Math.max(z + 1, p[1]); continue; }
    res.push([z, z + dauer]);
    z += dauer + Math.max(0, puffer || 0);
  }
  return res;
}

export function Kopf({ t, zusatz, familie = false }: { t: Sprechtag; zusatz?: string; familie?: boolean }) {
  const phaseText = familie && t.status === 'angekuendigt' ? `Anmeldung ab ${zeitDe(t.anmeldungVon)}` : ({
    einladung: `Einladungen bis ${zeitDe(t.einladungEnde)} · Anmeldung für Eltern ab ${zeitDe(t.anmeldungVon)}`,
    anmeldung: `Anmeldung für Eltern bis ${zeitDe(t.anmeldungBis)}`,
    geschlossen: 'Die Anmeldung ist geschlossen.', vorbei: 'Der Sprechtag ist vorbei.', vorbereitung: 'Noch nicht für Lehrkräfte und Eltern sichtbar.',
    abgesagt: `Der Sprechtag wurde abgesagt${t.absageGrund ? ` (${t.absageGrund})` : ''}. Alle Termine entfallen.`,
  } as Record<string, string>)[t.phase] ?? '';
  return (
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
        <Typography sx={{ fontWeight: 600, fontSize: 16 }}>{t.datumText}</Typography><PhasenPlakette t={t} familie={familie} />
        {phaseText && <Typography variant="body2" color="text.secondary">{phaseText}</Typography>}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {t.beginn}–{t.ende} Uhr{t.ort ? ` · ${t.ort}` : ''} · Termine à {t.dauer} Min.{t.optionen?.puffer ? ` (+${t.optionen.puffer} Min. Puffer)` : ''}
        {t.pausen.length ? ` · Pause ${t.pausen.map(p => `${p.von}–${p.bis}`).join(', ')}` : ''}
        {(t.reihe?.length ?? 0) > 1 && <> · Tage: {t.reihe!.map((r, i) => <span key={r.id}>{i > 0 && ', '}{r.id === t.id ? r.datumText : <Link href={`#/sprechtag/${r.id}`}>{r.datumText}</Link>}</span>)}</>}
        {zusatz && ` · ${zusatz}`}
      </Typography>
      {t.hinweis && <Alert severity="info" sx={{ mt: 1.5 }}>{t.hinweis}</Alert>}
    </Box>
  );
}

/** Absage mit optionalem Grund. */
export function AbsageDialog({ titel, text, knopf = 'Absagen', onClose, absagen }: { titel: string; text: string; knopf?: string; onClose: () => void; absagen: (grund: string) => Promise<void> }) {
  const [grund, setGrund] = useState('');
  return (
    <FormDialog offen titel={titel} onClose={onClose} aktionText={knopf} gefahr aktion={() => absagen(grund.trim())}>
      <Typography sx={{ mb: 2 }}>{text}</Typography>
      <TextField label="Grund (optional)" value={grund} onChange={e => setGrund(e.target.value)} multiline minRows={2} fullWidth placeholder="z. B. Erkrankung" slotProps={{ htmlInput: { maxLength: 1000 } }} />
    </FormDialog>
  );
}
