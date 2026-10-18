// Kinder des Kontos (Erziehungsberechtigte) und das gewählte Kind.
import { MenuItem, TextField } from '@mui/material';
import { holen } from '../../api/client';
import { lesen, schreiben } from '../../lib/speicher';

export interface Kind { id: number; vorname: string; name: string; klasse: string }
export async function kinderLaden() {
  const liste = await holen<Kind[]>('/api/app/familie/kinder').catch(() => [] as Kind[]);
  const id = lesen<number | null>('untplan:kind', null, true);
  return { liste, kind: liste.find(k => k.id === Number(id)) ?? liste[0] ?? null };
}
export function KindWahl({ liste, kind, onWahl }: { liste: Kind[]; kind: Kind; onWahl: () => void }) {
  if (liste.length < 2) return null;
  return (
    <TextField select label="Kind" value={kind.id} onChange={e => { schreiben('untplan:kind', Number(e.target.value), true); onWahl(); }} sx={{ minWidth: 220 }}>
      {liste.map(k => <MenuItem key={k.id} value={k.id}>{k.vorname} {k.name} ({k.klasse})</MenuItem>)}
    </TextField>
  );
}
export const OHNE_ZUORDNUNG = 'Ihrem Konto ist noch keine Schülerin bzw. kein Schüler zugeordnet. Bitte wenden Sie sich an die Schule.';
