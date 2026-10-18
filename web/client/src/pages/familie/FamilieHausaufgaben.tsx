// Hausaufgaben für Schüler*innen und Erziehungsberechtigte: Datum mit Woche bzw. Monat, Kind, Liste nach Fälligkeit.
import { IconButton, MenuItem, Paper, TextField, Typography } from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import { holen } from '../../api/client';
import { Geladen, Leer, Seite } from '../../components/Seite';
import { DatumFeld } from '../../components/Auswahl';
import { Tabelle } from '../../components/Tabelle';
import { DatumZelle } from '../../components/klassenbuch/fehlzeiten';
import { heuteIso, istIsoDatum, montag, plusTage } from '../../lib/datum';
import { navigieren } from '../../lib/router';
import { useLaden } from '../../lib/useLaden';
import { KindWahl, kinderLaden, OHNE_ZUORDNUNG } from './kinder';
import { monatPlus } from './FamilieAbwesenheiten';

interface Ha { id?: number; fach: string; lehrer: string; datum: string; faellig?: string; text: string; bemerkung?: string; erledigt?: boolean }

export default function FamilieHausaufgaben({ teile }: { teile: string[] }) {
  const zeitraum = teile[1] === 'woche' ? 'woche' : 'monat';
  const heute = heuteIso();
  const von = istIsoDatum(teile[0]) ? teile[0] : zeitraum === 'monat' ? `${heute.slice(0, 8)}01` : montag(heute);
  const bis = zeitraum === 'monat' ? plusTage(monatPlus(von, 1), -1) : plusTage(von, 6);
  const ziel = (v: string, z = zeitraum) => `#/hausaufgaben/${v}/${z}`;
  const g = useLaden(async () => {
    const { liste, kind } = await kinderLaden();
    return { liste, kind, zeilen: kind ? (await holen<{ zeilen: Ha[] }>(`/api/app/familie/hausaufgaben?schueler=${kind.id}&von=${von}&bis=${bis}`)).zeilen : [] };
  }, [von, bis]);
  return (
    <Seite titel="Hausaufgaben">
      <Geladen g={g}>{d => !d.kind ? <Leer text={OHNE_ZUORDNUNG} /> : (
        <>
          <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
            <IconButton onClick={() => navigieren(ziel(zeitraum === 'monat' ? monatPlus(von, -1) : plusTage(von, -7)))} aria-label="Zurück"><ArrowBackRounded /></IconButton>
            <DatumFeld label="Datum" wert={von} onWert={v => v && navigieren(ziel(v))} pflicht />
            <IconButton onClick={() => navigieren(ziel(zeitraum === 'monat' ? monatPlus(von, 1) : plusTage(von, 7)))} aria-label="Weiter"><ArrowForwardRounded /></IconButton>
            <TextField select label="Zeitraum" value={zeitraum} onChange={e => navigieren(ziel(von, e.target.value))} sx={{ width: 140 }}><MenuItem value="woche">Woche</MenuItem><MenuItem value="monat">Monat</MenuItem></TextField>
            <KindWahl liste={d.liste} kind={d.kind} onWahl={() => void g.neu()} />
          </Paper>
          <Tabelle zeilen={d.zeilen} schluessel={(h, i) => h.id ?? i} leer="Keine Hausaufgaben im Zeitraum." sortierung={{ id: 'faellig', richtung: 'asc' }}
            zeilenSx={h => (h.erledigt ? { opacity: 0.6 } : {})}
            spalten={[
              { id: 'fach', kopf: 'Fach', zelle: h => <b>{h.fach}</b>, sortWert: h => h.fach },
              { id: 'lehrer', kopf: 'Lehrkraft', zelle: h => h.lehrer },
              { id: 'datum', kopf: 'Aufgabedatum', zelle: h => <DatumZelle iso={h.datum} />, sortWert: h => h.datum },
              { id: 'faellig', kopf: 'Fällig', zelle: h => (h.faellig ? <DatumZelle iso={h.faellig} /> : ''), sortWert: h => h.faellig ?? '' },
              { id: 'text', kopf: 'Hausaufgabe', zelle: h => <>{h.text}{h.bemerkung && <Typography variant="caption" color="text.secondary" component="div">{h.bemerkung}</Typography>}</> },
            ]} />
        </>
      )}</Geladen>
    </Seite>
  );
}
