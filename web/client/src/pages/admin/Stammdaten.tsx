// Stammdaten: Klassen, Schüler*innen, Lehrkräfte, Fächer und Räume aus UntPlan (nur lesen), Stundenplan-Versionen (Übertragungsverlauf),
// die in UntPlanWeb gepflegten Abwesenheits-/Befreiungsgründe und Klassendienste sowie Notenschemen und Prüfungsarten (Noten.tsx).
import { useState } from 'react';
import { Box, Button, FormControlLabel, IconButton, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import { holen, loeschen, senden, speichern } from '../../api/client';
import { Geladen, Seite } from '../../components/Seite';
import { FormDialog, Plakette, SuchFeld, Wahl } from '../../components/Bausteine';
import { Tabelle, type Spalte } from '../../components/Tabelle';
import { datumDe } from '../../lib/datum';
import { bestaetigen, fehler, toast } from '../../lib/meldungen';
import { useLaden } from '../../lib/useLaden';
import type { SeitenProps } from '../register';
import { csv } from '../unterricht/Unterricht';
import { Notenschemen, Pruefungsarten } from './Noten';

type Zeile = Record<string, string | number | boolean | null>;
const ARTEN: Record<string, { titel: string; spalten: [string, string][] }> = {
  klassen: { titel: 'Klassen', spalten: [['kurz', 'Klasse'], ['name', 'Langname'], ['jahrgang', 'Jahrgang'], ['leitung', 'Klassenleitung'], ['schueler', 'Schüler*innen']] },
  schueler: { titel: 'Schüler*innen', spalten: [['name', 'Nachname'], ['vorname', 'Vorname'], ['klasse', 'Klasse'], ['id', 'Nummer']] },
  lehrer: { titel: 'Lehrkräfte', spalten: [['kurz', 'Kürzel'], ['name', 'Nachname'], ['vorname', 'Vorname'], ['email', 'E-Mail']] },
  faecher: { titel: 'Fächer', spalten: [['kurz', 'Fach'], ['name', 'Langname'], ['farbe', 'Farbe']] },
  raeume: { titel: 'Räume', spalten: [['kurz', 'Raum'], ['name', 'Langname'], ['buchbar', 'buchbar (Web)']] },
  versionen: { titel: 'Stundenplan-Versionen', spalten: [['revision', 'Revision'], ['empfangen', 'Empfangen'], ['programmversion', 'UntPlan'], ['klassen', 'Klassen'], ['lehrer', 'Lehrkräfte'], ['raeume', 'Räume'], ['tage', 'Tage'], ['vertretungen', 'Vertretungen'], ['von', 'Von'], ['bis', 'Bis']] },
  gruende: { titel: 'Abwesenheitsgründe', spalten: [['kurz', 'Kürzel'], ['name', 'Bezeichnung'], ['art', 'Art'], ['entschuldigt', 'gilt als entschuldigt'], ['reihenfolge', 'Reihenfolge'], ['aktiv', 'aktiv']] },
  dienste: { titel: 'Dienste', spalten: [['kurz', 'Kürzel'], ['name', 'Bezeichnung'], ['reihenfolge', 'Reihenfolge'], ['aktiv', 'aktiv']] },
};
const FILTER: Record<string, [string, string, Record<string, string>?][]> = {
  schueler: [['klasse', 'Klasse']], klassen: [['jahrgang', 'Jahrgang']], raeume: [['buchbar', 'Buchbar', { true: 'buchbar', false: 'nicht buchbar' }]],
  gruende: [['art', 'Art', { abwesenheit: 'Abwesenheit', befreiung: 'Befreiung' }], ['aktiv', 'Aktiv', { true: 'aktiv', false: 'inaktiv' }]], dienste: [['aktiv', 'Aktiv', { true: 'aktiv', false: 'inaktiv' }]],
};

function anzeige(k: string, w: Zeile[string]) {
  if (typeof w === 'boolean') return w ? <CheckRounded color="success" fontSize="small" /> : null;
  if (k === 'farbe' && typeof w === 'string' && /^#[0-9a-f]{6}$/i.test(w)) return <Stack direction="row" gap={1} alignItems="center"><Box sx={{ width: 14, height: 14, borderRadius: 1, bgcolor: w }} />{w}</Stack>;
  if (k === 'art') return w === 'befreiung' ? 'Befreiung' : 'Abwesenheit';
  if ((k === 'von' || k === 'bis') && typeof w === 'string' && /^\d{4}-/.test(w)) return datumDe(w);
  return w ?? '';
}

export default function Stammdaten({ teile }: SeitenProps) {
  if (teile[0] === 'notenschemen') return <Notenschemen />;
  if (teile[0] === 'pruefungsarten') return <Pruefungsarten />;
  const art = ARTEN[teile[0]] ? teile[0] : 'klassen';
  return <Liste key={art} art={art} />;
}

function Liste({ art }: { art: string }) {
  const a = ARTEN[art];
  const bearbeitbar = art === 'gruende' || art === 'dienste';
  const pfad = art === 'gruende' ? '/api/app/admin/gruende' : '/api/app/admin/dienstarten';
  const g = useLaden(sig => holen<Zeile[]>(`/api/app/stammdaten/${art}`, sig), [art]);
  const [suche, setSuche] = useState('');
  const [filter, setFilter] = useState<Record<string, string>>({});
  const [form, setForm] = useState<Zeile | null>(null);
  const liste = g.daten ?? [];
  const q = suche.toLowerCase();
  const sichtbar = liste.filter(x => (!q || Object.values(x).join(' ').toLowerCase().includes(q)) && (FILTER[art] ?? []).every(([k]) => !filter[k] || String(x[k] ?? '') === filter[k]));
  const spalten: Spalte<Zeile>[] = a.spalten.map(([k, t], j) => ({
    id: k, kopf: t, sortWert: x => (typeof x[k] === 'boolean' ? Number(x[k]) : (x[k] as string | number | null) ?? ''),
    zelle: (x, i) => <>{j === 0 ? <b>{anzeige(k, x[k])}</b> : anzeige(k, x[k])}{art === 'versionen' && j === 0 && i === 0 && <Plakette ton="ok" sx={{ ml: 1 }}>aktiv</Plakette>}</>,
  }));
  if (bearbeitbar) spalten.push({ id: 'akt', kopf: '', rechts: true, zelle: x => <IconButton size="small" color="error" aria-label="Löschen" onClick={async e => {
    e.stopPropagation();
    if (!(await bestaetigen(`${a.titel} löschen`, `„${x.name}“ löschen?${art === 'dienste' ? ' Alle Einteilungen dieses Dienstes werden ebenfalls gelöscht.' : ''}`))) return;
    try { await loeschen(`${pfad}/${x.id}`); void g.neu(); } catch (err) { fehler(err); }
  }}><DeleteOutlineRounded fontSize="small" /></IconButton> });
  return (
    <Seite titel={a.titel} untertitel={!bearbeitbar && art !== 'versionen' ? 'Diese Stammdaten werden in UntPlan gepflegt und mit jeder Übertragung aktualisiert.' : art === 'versionen' ? 'Jede Übertragung aus UntPlan erzeugt eine neue Version des Stundenplans; aktiv ist immer die zuletzt empfangene.' : undefined}
      aktionen={<>
        {bearbeitbar && <Button variant="contained" startIcon={<AddRounded />} onClick={() => setForm({})}>Neu</Button>}
        <Button variant="outlined" startIcon={<DownloadRounded />} disabled={!liste.length} onClick={() => speichern(csv([a.spalten.map(([, t]) => t), ...liste.map(x => a.spalten.map(([k]) => (typeof x[k] === 'boolean' ? (x[k] ? 'ja' : 'nein') : x[k])))]), `${art}.csv`)}>Bericht</Button>
      </>}
      filter={<>
        <SuchFeld wert={suche} onWert={setSuche} />
        {(FILTER[art] ?? []).map(([k, label, texte]) => {
          const werte = [...new Set(liste.map(x => String(x[k] ?? '')).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'de', { numeric: true }));
          return <Wahl key={k} label={label} wert={filter[k] ?? ''} onWert={v => setFilter({ ...filter, [k]: v })} alle="Alle" optionen={werte.map(w => [w, texte?.[w] ?? w] as [string, string])} breite={170} />;
        })}
      </>}>
      <Geladen g={g}>{() => <Tabelle zeilen={sichtbar} schluessel={(x, i) => String(x.id ?? x.kurz ?? x.revision ?? i)} spalten={spalten} onZeile={bearbeitbar ? x => setForm(x) : undefined} leer="Keine Einträge vorhanden." max={500} />}</Geladen>
      {form && <GrundFormular art={art} titel={a.titel} pfad={pfad} x={form} onClose={() => setForm(null)} fertig={() => void g.neu()} />}
    </Seite>
  );
}

function GrundFormular({ art, titel, pfad, x, onClose, fertig }: { art: string; titel: string; pfad: string; x: Zeile; onClose: () => void; fertig: () => void }) {
  const [w, setW] = useState({ kurz: String(x.kurz ?? ''), name: String(x.name ?? ''), art: String(x.art ?? 'abwesenheit'), entschuldigt: !!x.entschuldigt, reihenfolge: Number(x.reihenfolge ?? 10), aktiv: x.aktiv !== false });
  return (
    <FormDialog offen titel={x.id ? `${titel}: ${x.name}` : `Neu: ${titel}`} onClose={onClose} aktion={async () => {
      if (!w.name.trim()) { toast('Bitte eine Bezeichnung eingeben.', true); return false; }
      await senden(x.id ? `${pfad}/${x.id}` : pfad, art === 'gruende' ? w : { kurz: w.kurz, name: w.name, reihenfolge: w.reihenfolge, aktiv: w.aktiv }, x.id ? 'PUT' : 'POST');
      toast('Gespeichert.'); fertig();
    }}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        <Stack direction="row" gap={2}>
          <TextField label="Kürzel" value={w.kurz} onChange={e => setW({ ...w, kurz: e.target.value })} sx={{ width: 140 }} slotProps={{ htmlInput: { maxLength: 10 } }} />
          <TextField label="Bezeichnung" value={w.name} onChange={e => setW({ ...w, name: e.target.value })} required sx={{ flex: 1 }} />
        </Stack>
        {art === 'gruende' && (
          <Stack direction="row" gap={2} alignItems="center">
            <TextField select label="Art" value={w.art} onChange={e => setW({ ...w, art: e.target.value })} sx={{ width: 200 }}><MenuItem value="abwesenheit">Abwesenheit</MenuItem><MenuItem value="befreiung">Befreiung</MenuItem></TextField>
            <FormControlLabel control={<Switch checked={w.entschuldigt} onChange={e => setW({ ...w, entschuldigt: e.target.checked })} />} label="gilt als entschuldigt" />
          </Stack>
        )}
        <Stack direction="row" gap={2} alignItems="center">
          <TextField type="number" label="Reihenfolge" value={w.reihenfolge} onChange={e => setW({ ...w, reihenfolge: Number(e.target.value) })} sx={{ width: 140 }} />
          <FormControlLabel control={<Switch checked={w.aktiv} onChange={e => setW({ ...w, aktiv: e.target.checked })} />} label="aktiv" />
        </Stack>
        <Typography variant="caption" color="text.secondary" />
      </Stack>
    </FormDialog>
  );
}
