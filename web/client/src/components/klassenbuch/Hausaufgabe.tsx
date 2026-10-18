// Hausaufgaben als Fenster: Details (Fach, Klasse, Lehrkraft, Aufgabedatum, Fälligkeit, Text, Bemerkung, Erledigt; Bearbeiten/Löschen
// für die Lehrkraft) und Formular zum Anlegen bzw. Bearbeiten – gemeinsam für Klassenbuch → Hausaufgaben und die Stundendetails.
import { useEffect, useState } from 'react';
import { Alert, Box, Button, Checkbox, FormControlLabel, MenuItem, Stack, TextField, Typography } from '@mui/material';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import { api, holen, senden, qs } from '../../api/client';
import { FormDialog, Angabe, Plakette } from '../Bausteine';
import { DatumFeld } from '../Auswahl';
import { bestaetigen, toast } from '../../lib/meldungen';
import { datumDe, heuteIso, plusTage, wochentagKurz } from '../../lib/datum';

export interface Hausaufgabe { id: number; datum: string; stunde?: number; klassen?: string[]; fach?: string; lehrer?: string; text: string; faellig?: string | null; bemerkung?: string; erledigt?: boolean; darf?: boolean; unterricht?: number; einzelstunde?: number | null }
export interface FesteStunde { datum: string; von: number; unterricht?: number | null; fach?: string; klassen?: string[]; einzelstunde?: number | null }

const mitTag = (iso?: string | null) => (iso ? `${wochentagKurz(iso)}, ${datumDe(iso)}` : '–');

export function HausaufgabeDetails({ h, darf, onClose, geaendert }: { h: Hausaufgabe; darf: boolean; onClose: () => void; geaendert: () => void }) {
  const [erledigt, setErledigt] = useState(!!h.erledigt);
  const [bearbeiten, setBearbeiten] = useState(false);
  const ueberfaellig = !!h.faellig && h.faellig < heuteIso() && !erledigt;
  if (bearbeiten) return <HausaufgabeFormular h={h} onClose={onClose} geaendert={geaendert} />;
  return (
    <FormDialog offen titel="Hausaufgabe" onClose={onClose} ohneAbbrechen={false}
      links={darf && h.id ? <>
        <Button color="error" onClick={async () => { if (!(await bestaetigen('Hausaufgabe löschen', 'Diese Hausaufgabe endgültig löschen?'))) return; await api(`/api/app/klassenbuch/hausaufgabenliste/${h.id}`, { methode: 'DELETE' }); toast('Hausaufgabe gelöscht.'); geaendert(); onClose(); }}>Löschen</Button>
        <Button onClick={() => setBearbeiten(true)}>Bearbeiten</Button></> : undefined}>
      <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="h3">{h.fach || '–'}</Typography>
        <Typography color="text.secondary">{(h.klassen ?? []).join(', ')}</Typography>
        <Box sx={{ ml: 'auto' }}><Plakette ton={erledigt ? 'ok' : ueberfaellig ? 'entfall' : 'neutral'}>{erledigt ? 'Erledigt' : ueberfaellig ? 'Überfällig' : 'Offen'}</Plakette></Box>
      </Stack>
      <Typography sx={{ whiteSpace: 'pre-line', fontSize: 15, mb: 2 }}>{h.text}</Typography>
      <Angabe titel="Lehrkraft">{h.lehrer || '–'}</Angabe>
      <Angabe titel="Aufgabedatum">{mitTag(h.datum)}{h.stunde ? <Typography component="span" color="text.secondary"> · {h.stunde}. Std.</Typography> : null}</Angabe>
      <Angabe titel="Fälligkeit">{h.faellig ? mitTag(h.faellig) : <Typography component="span" color="text.secondary">ohne Fälligkeit</Typography>}</Angabe>
      {h.bemerkung && <Angabe titel="Bemerkung">{h.bemerkung}</Angabe>}
      <Angabe titel="Status">{darf && h.id ? (
        <FormControlLabel sx={{ my: -1 }} control={<Checkbox checked={erledigt} onChange={async e => {
          const v = e.target.checked;
          try { await senden(`/api/app/klassenbuch/hausaufgabenliste/${h.id}`, { erledigt: v }, 'PUT'); setErledigt(v); toast(v ? 'Als erledigt markiert.' : 'Wieder offen.'); geaendert(); } catch (err) { toast((err as Error).message, true); }
        }} />} label="Erledigt" />) : erledigt ? 'Erledigt' : 'Offen'}</Angabe>
      {!h.id && <Alert severity="info" sx={{ mt: 1 }}>Diese Hausaufgabe steht nur im Klassenbuch-Feld der Stunde und kann in den Stundendetails geändert werden.</Alert>}
    </FormDialog>
  );
}

interface Uebersichtsstunde { von: number; bis: number; unterricht: number; klassen: string[]; fach: string; beginn?: string; status?: string }

/** Anlegen bzw. Bearbeiten. stunde: feste Stunde (Stundendetails); ohne beides wählt die Lehrkraft Datum und Stunde aus ihren Unterrichten. */
export function HausaufgabeFormular({ h, stunde, lehrer, onClose, geaendert }: { h?: Hausaufgabe | null; stunde?: FesteStunde | null; lehrer?: string; onClose: () => void; geaendert: () => void }) {
  const neu = !h;
  const fest: FesteStunde | null = h ? { datum: h.datum, von: h.stunde ?? 0, klassen: h.klassen, fach: h.fach } : stunde ?? null;
  const [datum, setDatum] = useState(fest?.datum ?? heuteIso());
  const [faellig, setFaellig] = useState<string | null>(h ? h.faellig ?? null : plusTage(fest?.datum ?? heuteIso(), 7));
  const [text, setText] = useState(h?.text ?? '');
  const [bemerkung, setBemerkung] = useState(h?.bemerkung ?? '');
  const [stunden, setStunden] = useState<Uebersichtsstunde[] | null>(null);
  const [wahl, setWahl] = useState(0);
  useEffect(() => {
    if (fest) return;
    setStunden(null);
    holen<{ tage: { stunden: Uebersichtsstunde[] }[] }>(`/api/app/klassenbuch/uebersicht${qs({ von: datum, bis: datum, lehrer })}`)
      .then(r => setStunden((r.tage[0]?.stunden ?? []).filter(s => s.status !== 'entfall'))).catch(() => setStunden([]));
    if (!faellig || faellig < datum) setFaellig(plusTage(datum, 7));
    setWahl(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datum]);
  const speichern = async () => {
    const daten = { text: text.trim(), faellig: faellig || null, bemerkung: bemerkung.trim() };
    if (!daten.text) { toast('Bitte die Hausaufgabe eingeben.', true); return false; }
    if (!neu) await senden(`/api/app/klassenbuch/hausaufgabenliste/${h!.id}`, daten, 'PUT');
    else if (fest) await senden('/api/app/klassenbuch/hausaufgabenliste', { datum: fest.datum, stunde: fest.von, unterricht: fest.unterricht, ...daten, ...(fest.einzelstunde ? { einzelstunde: fest.einzelstunde } : {}) });
    else {
      const s = stunden?.[wahl];
      if (!s) { toast('Bitte eine Stunde wählen.', true); return false; }
      await senden('/api/app/klassenbuch/hausaufgabenliste', { datum, stunde: s.von, unterricht: s.unterricht, ...daten });
    }
    toast(neu ? 'Hausaufgabe erstellt.' : 'Hausaufgabe gespeichert.');
    geaendert();
  };
  return (
    <FormDialog offen titel={neu ? 'Neue Hausaufgabe' : 'Hausaufgabe bearbeiten'} onClose={onClose} aktion={speichern} aktionText={neu ? 'Erstellen' : 'Speichern'}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        {fest ? (
          <Stack direction="row" gap={1} alignItems="center" sx={{ p: 1.25, borderRadius: 2, bgcolor: 'action.hover' }}>
            <MenuBookOutlined fontSize="small" color="action" />
            <Typography variant="body2">{(fest.klassen ?? []).join(', ')}{fest.fach ? ` | ${fest.fach}` : ''} · {mitTag(fest.datum)}{fest.von ? ` · ${fest.einzelstunde ?? fest.von}. Std.` : ''}</Typography>
          </Stack>
        ) : (
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <DatumFeld label="Aufgabedatum" wert={datum} onWert={d => d && setDatum(d)} pflicht />
            <TextField select label="Stunde" value={stunden?.length ? wahl : ''} onChange={e => setWahl(Number(e.target.value))} sx={{ flex: 1 }} disabled={!stunden?.length}
              helperText={stunden && !stunden.length ? 'An diesem Tag haben Sie keinen Unterricht' : undefined}>
              {(stunden ?? []).map((s, i) => <MenuItem key={i} value={i}>{s.von === s.bis ? s.von : `${s.von}.–${s.bis}`}. Std. · {s.klassen.join(', ')} | {s.fach}{s.beginn ? ` (${s.beginn})` : ''}</MenuItem>)}
            </TextField>
          </Stack>
        )}
        <DatumFeld label="Fälligkeitsdatum" wert={faellig} onWert={setFaellig} min={fest?.datum ?? datum} />
        <TextField label="Hausaufgabe" required multiline minRows={4} value={text} onChange={e => setText(e.target.value)} placeholder="z. B. S. 45 Nr. 3 a–d" slotProps={{ htmlInput: { maxLength: 2000 } }} autoFocus />
        <TextField label="Bemerkung" value={bemerkung} onChange={e => setBemerkung(e.target.value)} placeholder="optional" slotProps={{ htmlInput: { maxLength: 500 } }} />
      </Stack>
    </FormDialog>
  );
}
