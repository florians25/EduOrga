// Klassenbucheinträge (Vermerke wie Lob, Ordnungsmaßnahme, Elterngespräch) über alle oder eine Klasse: Filter, Details, Bearbeiten, Löschen.
import { useEffect, useState } from 'react';
import { Alert, Box, Button, IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { api, holen, senden, qs } from '../../api/client';
import type { Elemente } from '../../api/types';
import { useSitzung } from '../../app/sitzung';
import { Geladen, Seite } from '../../components/Seite';
import { Angabe, FormDialog, Plakette, SuchFeld, Wahl, type Ton } from '../../components/Bausteine';
import { DatumFeld } from '../../components/Auswahl';
import { Tabelle } from '../../components/Tabelle';
import { bestaetigen, toast } from '../../lib/meldungen';
import { datumDe, datumLang, heuteIso, istIsoDatum, plusTage, zeitstempel } from '../../lib/datum';
import { navigieren } from '../../lib/router';
import { useLaden } from '../../lib/useLaden';
import type { SeitenProps } from '../register';

export const VERMERK_TON: Record<string, Ton> = { Lob: 'ok', Ordnungsmaßnahme: 'entfall', Elterngespräch: 'termin', 'Hausaufgabe fehlt': 'pruefung', 'Material vergessen': 'pruefung' };
interface Eintrag { id: number; datum: string; klasse: string; schuelerId: number | null; schueler?: string; art: string; text: string; lehrer: string; erstellt?: string; stunde?: number; zeit?: string; bearbeiten: boolean; loeschen: boolean }
const stundeText = (x: Eintrag) => (x.stunde ? `${x.stunde}. Stunde${x.zeit ? ` · ${x.zeit} Uhr` : ''}` : x.zeit ? `${x.zeit} Uhr` : '');

function EintragFormular({ el, x, arten, onClose, fertig }: { el: Elemente; x: Partial<Eintrag>; arten: string[]; onClose: () => void; fertig: () => void }) {
  const bearbeiten = !!x.id;
  const [klasse, setKlasse] = useState(x.klasse ?? el.klassen[0]?.kurz ?? '');
  const [datum, setDatum] = useState<string | null>(x.datum ?? heuteIso());
  const [art, setArt] = useState(x.art ?? arten[0] ?? 'Vermerk');
  const [sid, setSid] = useState<number | ''>(x.schuelerId ?? '');
  const [text, setText] = useState(x.text ?? '');
  const [schueler, setSchueler] = useState<{ id: number; name: string; vorname: string }[]>([]);
  useEffect(() => { holen<typeof schueler>(`/api/app/klassenbuch/schueler?klasse=${encodeURIComponent(klasse)}`).then(setSchueler).catch(() => setSchueler([])); }, [klasse]);
  return (
    <FormDialog offen titel={bearbeiten ? 'Klassenbucheintrag bearbeiten' : 'Neuer Klassenbucheintrag'} onClose={onClose} aktion={async () => {
      if (!text.trim()) { toast('Bitte einen Text eingeben.', true); return false; }
      const d = { datum, klasse: bearbeiten ? x.klasse : klasse, schuelerId: sid || null, art, text };
      if (bearbeiten) await senden(`/api/app/klassenbuch/vermerke/${x.id}`, { ...d, zeit: x.zeit || null }, 'PUT'); else await senden('/api/app/klassenbuch/vermerke', d);
      toast('Eintrag gespeichert.'); fertig();
    }}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        <Stack direction="row" gap={2}>
          <TextField select label="Klasse" value={klasse} onChange={e => { setKlasse(e.target.value); setSid(''); }} disabled={bearbeiten} sx={{ flex: 1 }}>{el.klassen.map(k => <MenuItem key={k.kurz} value={k.kurz}>{k.kurz}</MenuItem>)}</TextField>
          <DatumFeld label="Datum" wert={datum} onWert={setDatum} pflicht />
        </Stack>
        <Stack direction="row" gap={2}>
          <TextField select label="Art" value={art} onChange={e => setArt(e.target.value)} sx={{ flex: 1 }}>{arten.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}</TextField>
          <TextField select label="Betrifft" value={sid} onChange={e => setSid(e.target.value === '' ? '' : Number(e.target.value))} sx={{ flex: 1 }}><MenuItem value="">ganze Klasse</MenuItem>{schueler.map(s => <MenuItem key={s.id} value={s.id}>{s.name}, {s.vorname}</MenuItem>)}</TextField>
        </Stack>
        <TextField label="Text" multiline minRows={3} value={text} onChange={e => setText(e.target.value)} required slotProps={{ htmlInput: { maxLength: 1000 } }} />
      </Stack>
    </FormDialog>
  );
}

export default function Eintraege({ teile }: SeitenProps) {
  const { elemente } = useSitzung();
  const [vP, bP, kP, aP] = teile;
  const von = istIsoDatum(vP) ? vP : plusTage(heuteIso(), -30);
  const bis = istIsoDatum(bP) ? bP : heuteIso();
  const klasse = kP && kP !== '-' ? kP : '';
  const art = aP && aP !== '-' ? aP : '';
  const ziel = (v = von, b = bis, k = klasse, a = art) => `#/eintraege/${v}/${b}/${encodeURIComponent(k || '-')}/${encodeURIComponent(a || '-')}`;
  const [suche, setSuche] = useState('');
  const [dialog, setDialog] = useState<null | { art: 'neu' } | { art: 'details'; x: Eintrag } | { art: 'bearbeiten'; x: Eintrag }>(null);
  const g = useLaden(async () => ({ el: await elemente(), d: await holen<{ eintraege: Eintrag[]; arten: string[] }>(`/api/app/klassenbucheintraege${qs({ von, bis, klasse, art })}`) }), [von, bis, klasse, art]);
  const loeschen = async (id: number) => {
    if (!(await bestaetigen('Eintrag löschen', 'Den Klassenbucheintrag endgültig löschen?'))) return false;
    try { await api(`/api/app/klassenbuch/vermerke/${id}`, { methode: 'DELETE' }); toast('Eintrag gelöscht.'); void g.neu(); return true; } catch (err) { toast((err as Error).message, true); return false; }
  };
  const verfasser = (el: Elemente, k: string) => { const l = el.lehrer.find(x => x.kurz === k); return l ? `${l.name} (${l.kurz})` : k || '–'; };
  return (
    <Seite titel="Klassenbucheinträge" aktionen={<Button variant="contained" onClick={() => setDialog({ art: 'neu' })} disabled={!g.daten}>Neuer Eintrag</Button>}
      filter={g.daten && <>
        <SuchFeld wert={suche} onWert={setSuche} platzhalter="Schüler*in, Text oder Lehrkraft suchen" breite={300} />
        <Wahl label="Klasse" wert={klasse} onWert={k => navigieren(ziel(von, bis, k))} optionen={g.daten.el.klassen.map(k => [k.kurz, k.kurz])} alle="Alle Klassen" breite={150} />
        <Wahl label="Art" wert={art} onWert={a => navigieren(ziel(von, bis, klasse, a))} optionen={g.daten.d.arten.map(a => [a, a])} alle="Alle Arten" breite={190} />
        <DatumFeld label="Von" wert={von} onWert={v => v && navigieren(ziel(v))} pflicht />
        <DatumFeld label="Bis" wert={bis} onWert={b => b && navigieren(ziel(von, b))} pflicht />
      </>}>
      <Geladen g={g}>{({ el, d }) => {
        const l = d.eintraege.filter(x => !suche || `${x.schueler} ${x.text} ${x.lehrer} ${x.klasse} ${x.art}`.toLowerCase().includes(suche.toLowerCase()));
        return (
          <>
            <Tabelle zeilen={l} schluessel={x => x.id} onZeile={x => setDialog({ art: 'details', x })} leer="Keine Klassenbucheinträge im Zeitraum." sortierung={{ id: 'datum', richtung: 'desc' }}
              spalten={[
                { id: 'datum', kopf: 'Datum', sortWert: x => x.datum + (x.zeit ?? ''), nowrap: true, zelle: x => <><Typography variant="body2">{datumDe(x.datum)}</Typography>{stundeText(x) && <Typography variant="caption" color="text.secondary">{stundeText(x)}</Typography>}</> },
                { id: 'klasse', kopf: 'Klasse', sortWert: x => x.klasse, zelle: x => <b>{x.klasse}</b> },
                { id: 'schueler', kopf: 'Schüler*in', sortWert: x => x.schueler ?? '', zelle: x => x.schueler || 'ganze Klasse' },
                { id: 'art', kopf: 'Art', sortWert: x => x.art, zelle: x => <Plakette ton={VERMERK_TON[x.art] ?? 'neutral'}>{x.art}</Plakette> },
                { id: 'text', kopf: 'Text', zelle: x => <Typography variant="body2" sx={{ maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.text}</Typography> },
                { id: 'lehrer', kopf: 'Lehrkraft', sortWert: x => x.lehrer, zelle: x => x.lehrer, verbergenMobil: true },
                { id: 'akt', kopf: '', rechts: true, zelle: x => (x.loeschen ? <IconButton size="small" color="error" aria-label="Löschen" onClick={e => { e.stopPropagation(); void loeschen(x.id); }}><DeleteOutlineRounded fontSize="small" /></IconButton> : null) },
              ]} />
            {dialog?.art === 'details' && (
              <FormDialog offen titel="Klassenbucheintrag" onClose={() => setDialog(null)} ohneAbbrechen={false}
                links={<>{dialog.x.loeschen && <Button color="error" onClick={async () => { if (await loeschen(dialog.x.id)) setDialog(null); }}>Löschen</Button>}
                  {dialog.x.bearbeiten && <Button variant="contained" onClick={() => setDialog({ art: 'bearbeiten', x: dialog.x })}>Bearbeiten</Button>}</>}>
                <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 1.5 }}><Plakette ton={VERMERK_TON[dialog.x.art] ?? 'neutral'}>{dialog.x.art}</Plakette><Typography color="text.secondary">Klasse {dialog.x.klasse}</Typography></Stack>
                <Typography sx={{ fontSize: 15, whiteSpace: 'pre-line', mb: 2 }}>{dialog.x.text}</Typography>
                <Angabe titel="Datum">{datumLang(dialog.x.datum)}</Angabe><Angabe titel="Stunde">{stundeText(dialog.x) || '–'}</Angabe>
                <Angabe titel="Schüler*in">{dialog.x.schueler || 'ganze Klasse'}</Angabe><Angabe titel="Verfasser*in">{verfasser(el, dialog.x.lehrer)}</Angabe>
                <Angabe titel="Erfasst">{zeitstempel(dialog.x.erstellt) || '–'}</Angabe>
                {!dialog.x.bearbeiten && <Alert severity="info" icon={<LockOutlined />} sx={{ mt: 1.5 }}>Bearbeiten können die Verfasserin bzw. der Verfasser und die Klassenleitung.</Alert>}
              </FormDialog>
            )}
            {dialog?.art === 'neu' && <EintragFormular el={el} x={{ klasse: klasse || el.klassen[0]?.kurz }} arten={d.arten} onClose={() => setDialog(null)} fertig={() => void g.neu()} />}
            {dialog?.art === 'bearbeiten' && <EintragFormular el={el} x={dialog.x} arten={d.arten} onClose={() => setDialog(null)} fertig={() => void g.neu()} />}
            <Box />
          </>
        );
      }}</Geladen>
    </Seite>
  );
}
