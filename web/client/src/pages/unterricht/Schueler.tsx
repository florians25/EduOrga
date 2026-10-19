// Unterricht → Schüler*innen: Liste je Klasse mit Suche. Administration und Schulleitung legen an, ändern (auch Klassenwechsel ab Datum)
// und löschen, die Klassenleitung bearbeitet ihre Klassen, andere Lehrkräfte sehen Name, Klasse und Geschlecht.
// Die Liste aus EduOrga Studio bleibt Grundlage; Änderungen in EduOrga Web überlagern sie.
import { useState } from 'react';
import { Button, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import EditOutlined from '@mui/icons-material/EditOutlined';
import SwapHorizRounded from '@mui/icons-material/SwapHorizRounded';
import { holen, loeschen, senden, speichern } from '../../api/client';
import { Geladen, Seite } from '../../components/Seite';
import { FormDialog, SuchFeld, Wahl } from '../../components/Bausteine';
import { DatumFeld } from '../../components/Auswahl';
import { Tabelle } from '../../components/Tabelle';
import { datumDe } from '../../lib/datum';
import { bestaetigen, fehler, toast } from '../../lib/meldungen';
import { link, navigieren } from '../../lib/router';
import { useLaden } from '../../lib/useLaden';
import type { SeitenProps } from '../register';
import { csv } from './Unterricht';
import { KlassenwechselDialog } from './UnterrichtKlassen';

const GESCHLECHT: Record<string, string> = { '': '–', m: 'männlich', w: 'weiblich', d: 'divers' };
interface S { id: number; name: string; vorname: string; klasse: string; geschlecht: string; geburtsdatum: string; email: string; bemerkung: string; quelle: string; bearbeiten: boolean }
interface Antwort { schueler: S[]; klassen: { kurz: string; bearbeiten: boolean }[]; anlegen: boolean; loeschen: boolean; klassenwechsel: boolean }

export default function Schueler({ teile }: SeitenProps) {
  const klasse = teile[0] && teile[0] !== '-' ? teile[0] : '';
  const g = useLaden(sig => holen<Antwort>(`/api/app/schueler${klasse ? `?klasse=${encodeURIComponent(klasse)}` : ''}`, sig), [klasse]);
  const [suche, setSuche] = useState('');
  const [dialog, setDialog] = useState<null | { art: 'form'; s: S | null } | { art: 'wechsel'; s: S }>(null);
  const d = g.daten;
  return (
    <Seite titel="Schüler*innen" untertitel={d ? `${d.schueler.length} Schüler*innen` : undefined}
      aktionen={d && <>
        {d.anlegen && <Button variant="contained" onClick={() => setDialog({ art: 'form', s: null })}>Neu</Button>}
        <Button variant="outlined" onClick={() => speichern(csv([['Nachname', 'Vorname', 'Klasse', 'Geschlecht', 'Geburtsdatum', 'E-Mail'],
          ...d.schueler.map(s => [s.name, s.vorname, s.klasse, s.geschlecht, s.geburtsdatum, s.email])]), `schueler-${klasse || 'alle'}.csv`)}>CSV</Button>
      </>}
      filter={d && <>
        <Wahl label="Klasse" wert={klasse} onWert={k => navigieren(link('schueler', k || '-'))} alle="Alle" optionen={d.klassen.map(k => [k.kurz, k.kurz])} breite={150} />
        <SuchFeld wert={suche} onWert={setSuche} platzhalter="Name suchen" />
      </>}>
      <Geladen g={g}>{d => {
        const f = suche.trim().toLowerCase();
        const l = d.schueler.filter(s => !f || `${s.name} ${s.vorname} ${s.klasse}`.toLowerCase().includes(f));
        return (
          <>
            <Tabelle zeilen={l} schluessel={s => s.id} leer="Keine Schüler*innen gefunden." onZeile={s => s.bearbeiten && setDialog({ art: 'form', s })} sortierung={{ id: 'name', richtung: 'asc' }}
              spalten={[
                { id: 'name', kopf: 'Nachname', sortWert: s => s.name, zelle: s => <b>{s.name}</b> },
                { id: 'vorname', kopf: 'Vorname', sortWert: s => s.vorname, zelle: s => s.vorname },
                { id: 'klasse', kopf: 'Klasse', sortWert: s => s.klasse, zelle: s => s.klasse },
                { id: 'g', kopf: 'Geschlecht', zelle: s => GESCHLECHT[s.geschlecht] ?? s.geschlecht, verbergenMobil: true },
                { id: 'geb', kopf: 'Geburtsdatum', sortWert: s => s.geburtsdatum, zelle: s => datumDe(s.geburtsdatum), verbergenMobil: true },
                { id: 'mail', kopf: 'E-Mail', zelle: s => s.email, verbergenMobil: true },
                { id: 'bem', kopf: 'Bemerkung', zelle: s => <Typography variant="body2" sx={{ maxWidth: 220 }} noWrap title={s.bemerkung}>{s.bemerkung}</Typography>, verbergenMobil: true },
                { id: 'quelle', kopf: 'Quelle', zelle: s => <Typography variant="caption" color="text.secondary">{s.quelle}</Typography>, verbergenMobil: true },
                { id: 'akt', kopf: '', rechts: true, nowrap: true, zelle: s => (
                  <Stack direction="row" justifyContent="flex-end" onClick={e => e.stopPropagation()}>
                    {s.bearbeiten && <Tooltip title="Bearbeiten"><IconButton size="small" onClick={() => setDialog({ art: 'form', s })}><EditOutlined fontSize="small" /></IconButton></Tooltip>}
                    {d.klassenwechsel && <Tooltip title="Klassenwechsel"><IconButton size="small" onClick={() => setDialog({ art: 'wechsel', s })}><SwapHorizRounded fontSize="small" /></IconButton></Tooltip>}
                    {d.loeschen && <Tooltip title="Löschen"><IconButton size="small" color="error" onClick={async () => {
                      if (!(await bestaetigen('Schüler*in löschen', `${s.name}, ${s.vorname} (${s.klasse}) aus EduOrga Web entfernen?`))) return;
                      try { await loeschen(`/api/app/schueler/${s.id}`); toast('Gelöscht.'); void g.neu(); } catch (err) { fehler(err); }
                    }}><DeleteOutlineRounded fontSize="small" /></IconButton></Tooltip>}
                  </Stack>
                ) },
              ]} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              {d.loeschen ? 'Sie können alle Schüler*innen bearbeiten.' : d.anlegen ? 'Sie können die Schüler*innen Ihrer Klassen bearbeiten; Klassenwechsel und Löschen nimmt die Administration vor.' : 'Bearbeiten können die Klassenleitung, die Schulleitung und die Administration.'}
              {' '}Die Schülerliste kommt aus EduOrga Studio; Änderungen in EduOrga Web bleiben bei der nächsten Übertragung erhalten.
            </Typography>
            {dialog?.art === 'form' && <SchuelerFormular s={dialog.s} d={d} klasse={klasse} onClose={() => setDialog(null)} fertig={() => void g.neu()} />}
            {dialog?.art === 'wechsel' && <KlassenwechselDialog schueler={dialog.s} klassen={d.klassen} onClose={() => setDialog(null)} fertig={() => void g.neu()} />}
          </>
        );
      }}</Geladen>
    </Seite>
  );
}

function SchuelerFormular({ s, d, klasse, onClose, fertig }: { s: S | null; d: Antwort; klasse: string; onClose: () => void; fertig: () => void }) {
  const neu = !s;
  const darfKlasse = neu || d.klassenwechsel;
  const auswahl = darfKlasse ? d.klassen.filter(k => k.bearbeiten) : d.klassen;
  const [x, setX] = useState({ name: s?.name ?? '', vorname: s?.vorname ?? '', klasse: s?.klasse ?? (klasse || auswahl[0]?.kurz || ''), geschlecht: s?.geschlecht ?? '', geburtsdatum: s?.geburtsdatum ?? '', email: s?.email ?? '', bemerkung: s?.bemerkung ?? '' });
  const feld = (k: keyof typeof x, label: string, extra: object = {}) => <TextField label={label} value={x[k]} onChange={e => setX({ ...x, [k]: e.target.value })} sx={{ flex: '1 1 220px' }} {...extra} />;
  return (
    <FormDialog offen titel={neu ? 'Schüler*in anlegen' : `${s!.name}, ${s!.vorname}`} onClose={onClose} aktion={async () => {
      if (!x.name.trim()) { toast('Bitte einen Nachnamen eingeben.', true); return false; }
      if (neu) await senden('/api/app/schueler', x); else await senden(`/api/app/schueler/${s!.id}`, x, 'PUT');
      toast('Gespeichert.'); fertig();
    }}>
      <Stack direction="row" gap={2} flexWrap="wrap" sx={{ pt: 0.5 }}>
        {feld('name', 'Nachname', { required: true, slotProps: { htmlInput: { maxLength: 100 } } })}
        {feld('vorname', 'Vorname', { slotProps: { htmlInput: { maxLength: 100 } } })}
        <TextField select label="Klasse" value={x.klasse} onChange={e => setX({ ...x, klasse: e.target.value })} disabled={!darfKlasse} sx={{ flex: '1 1 220px' }}>{auswahl.map(k => <MenuItem key={k.kurz} value={k.kurz}>{k.kurz}</MenuItem>)}</TextField>
        <TextField select label="Geschlecht" value={x.geschlecht} onChange={e => setX({ ...x, geschlecht: e.target.value })} sx={{ flex: '1 1 220px' }}>{Object.entries(GESCHLECHT).map(([k, t]) => <MenuItem key={k} value={k}>{t}</MenuItem>)}</TextField>
        <DatumFeld label="Geburtsdatum" wert={x.geburtsdatum || null} onWert={v => setX({ ...x, geburtsdatum: v ?? '' })} breite="calc(50% - 8px)" />
        {feld('email', 'E-Mail', { type: 'email' })}
        <TextField label="Bemerkung" value={x.bemerkung} onChange={e => setX({ ...x, bemerkung: e.target.value })} multiline minRows={2} fullWidth slotProps={{ htmlInput: { maxLength: 1000 } }} />
      </Stack>
    </FormDialog>
  );
}
