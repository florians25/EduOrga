// Zeitraum-Auswahl für Listen (Unterricht, Prüfungen): Voreinstellungen (Woche, nächste Woche, Monat, Schuljahr) und Von/Bis.
import { MenuItem, TextField } from '@mui/material';
import type { Schuljahr } from '../app/sitzung';
import { heuteIso, istIsoDatum, montag, plusTage } from '../lib/datum';
import { DatumFeld } from './Auswahl';

export type Bereich = 'woche' | 'naechste' | 'monat' | 'vier' | 'jahr';
const monat = (): [string, string] => {
  const h = heuteIso();
  const d = new Date(h.slice(0, 7) + '-01T12:00');
  d.setMonth(d.getMonth() + 1); d.setDate(0);
  return [h.slice(0, 8) + '01', h.slice(0, 8) + String(d.getDate()).padStart(2, '0')];
};
export const BEREICHE: Record<Bereich, string> = { woche: 'Aktuelle Woche', naechste: 'Nächste Woche', monat: 'Aktueller Monat', vier: 'Nächste 4 Wochen', jahr: 'Schuljahr' };

export function bereichZeitraum(b: Bereich, sj?: Schuljahr | null): [string, string] {
  const mo = montag(heuteIso());
  switch (b) {
    case 'naechste': return [plusTage(mo, 7), plusTage(mo, 13)];
    case 'monat': return monat();
    case 'vier': return [heuteIso(), plusTage(heuteIso(), 27)];
    case 'jahr': return [sj?.von ?? heuteIso(), sj?.bis ?? plusTage(heuteIso(), 300)];
    default: return [mo, plusTage(mo, 6)];
  }
}

/** Bereich aus der Adresse, optional überschrieben durch eigenes Von/Bis. */
export function zeitraumAus(bP: string | undefined, vP: string | undefined, biP: string | undefined, sj: Schuljahr | null, vorgabe: Bereich = 'woche') {
  const bereich = (bP && bP in BEREICHE ? bP : vorgabe) as Bereich;
  let [von, bis] = bereichZeitraum(bereich, sj);
  const eigen = istIsoDatum(vP) && istIsoDatum(biP);
  if (eigen) { von = vP!; bis = biP!; }
  return { bereich, von, bis, eigen };
}

export function ZeitraumWahl({ bereich, von, bis, eigen, onBereich, onVonBis, bereiche = ['woche', 'naechste', 'monat', 'jahr'], mitDatum = true }: {
  bereich: Bereich; von: string; bis: string; eigen?: boolean; onBereich: (b: Bereich) => void; onVonBis?: (von: string, bis: string) => void; bereiche?: Bereich[]; mitDatum?: boolean;
}) {
  return (
    <>
      <TextField select label="Zeitraum" value={eigen ? 'eigen' : bereich} onChange={e => e.target.value !== 'eigen' && onBereich(e.target.value as Bereich)} sx={{ width: 190 }}>
        {bereiche.map(b => <MenuItem key={b} value={b}>{BEREICHE[b]}</MenuItem>)}
        {eigen && <MenuItem value="eigen">Benutzerdefiniert</MenuItem>}
      </TextField>
      {mitDatum && onVonBis && <>
        <DatumFeld label="Von" wert={von} onWert={v => v && onVonBis(v, v > bis ? v : bis)} pflicht />
        <DatumFeld label="Bis" wert={bis} onWert={b => b && onVonBis(von, b)} pflicht />
      </>}
    </>
  );
}
