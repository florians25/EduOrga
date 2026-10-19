// Öffentliche Hinweise für die Anmeldeseite (#/hinweise; Administration bzw. Recht „Infocenter verwalten“): Titel, Text, Anzeigezeitraum
// und „anzeigen“ – nur allgemeine Informationen. DSGVO: keine Namen, keine Termine einzelner Personen, keine Links und E-Mail-Adressen;
// die Anmeldeseite lädt die freigegebenen Hinweise ohne Cookies und ohne Tracking.
import { useState } from 'react';
import { Alert, Box, Button, FormControlLabel, IconButton, Stack, Switch, TextField, Typography } from '@mui/material';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import ShieldOutlined from '@mui/icons-material/ShieldOutlined';
import { holen, loeschen, senden } from '../../api/client';
import { useSitzung } from '../../app/sitzung';
import { Geladen, Seite } from '../../components/Seite';
import { FormDialog, Plakette, type Ton } from '../../components/Bausteine';
import { DatumFeld } from '../../components/Auswahl';
import { Tabelle } from '../../components/Tabelle';
import { bestaetigen, fehler, toast } from '../../lib/meldungen';
import { datumKurz, heuteIso } from '../../lib/datum';
import { useLaden } from '../../lib/useLaden';

const BASIS = '/api/app/hinweise';
interface Hinweis { id: number; titel: string; text: string; von?: string | null; bis?: string | null; aktiv: boolean }

function status(h: Hinweis): [Ton, string] {
  const heute = heuteIso();
  if (!h.aktiv) return ['neutral', 'aus'];
  if (h.von && h.von > heute) return ['termin', `ab ${datumKurz(h.von)}`];
  if (h.bis && h.bis < heute) return ['neutral', 'abgelaufen'];
  return ['ok', 'wird angezeigt'];
}

export default function Hinweise() {
  const { ich } = useSitzung();
  const darf = ich.admin || !!ich.rechte?.['infocenter.verwalten'];
  const g = useLaden(sig => (darf ? holen<Hinweis[]>(BASIS, sig) : Promise.resolve([] as Hinweis[])), [darf]);
  const [formular, setFormular] = useState<{ h: Hinweis | null } | null>(null);
  if (!darf) return <Seite titel="Hinweise auf der Anmeldeseite"><Alert severity="warning">Öffentliche Hinweise verwalten Administration und Schulleitung.</Alert></Seite>;
  return (
    <Seite titel="Hinweise auf der Anmeldeseite" aktionen={<Button variant="contained" onClick={() => setFormular({ h: null })}>Hinweis</Button>}>
      <Alert severity="info" icon={<ShieldOutlined />} sx={{ mb: 2, maxWidth: 980 }}>
        Diese Hinweise sind <b>ohne Anmeldung öffentlich</b> sichtbar. Bitte nur allgemeine Informationen eintragen (z. B. „Elternsprechtag am 12.11. von 15 bis 19 Uhr“) –
        keine Namen, keine Termine einzelner Personen, keine Links und keine E-Mail-Adressen. Die Anmeldeseite lädt die Hinweise ohne Cookies und ohne Tracking.
      </Alert>
      <Geladen g={g}>{liste => (
        <Tabelle zeilen={liste} schluessel={h => h.id} leer="Noch keine öffentlichen Hinweise." onZeile={h => setFormular({ h })}
          spalten={[
            { id: 'titel', kopf: 'Hinweis', zelle: h => <Box><Typography sx={{ fontWeight: 500 }}>{h.titel}</Typography>{h.text && <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line', maxWidth: 560 }}>{h.text}</Typography>}</Box> },
            { id: 'zeit', kopf: 'Zeitraum', nowrap: true, zelle: h => `${h.von ? datumKurz(h.von) : 'sofort'} – ${h.bis ? datumKurz(h.bis) : 'offen'}` },
            { id: 'status', kopf: 'Status', zelle: h => { const [ton, text] = status(h); return <Plakette ton={ton}>{text}</Plakette>; } },
            { id: 'akt', kopf: '', rechts: true, zelle: h => (
              <IconButton size="small" color="error" aria-label="Löschen" onClick={async e => {
                e.stopPropagation();
                if (!(await bestaetigen('Hinweis löschen', `„${h.titel}“ löschen?`))) return;
                try { await loeschen(`${BASIS}/${h.id}`); toast('Hinweis gelöscht.'); void g.neu(); } catch (err) { fehler(err); }
              }}><DeleteOutlineRounded fontSize="small" /></IconButton>
            ) },
          ]} />
      )}</Geladen>
      {formular && <HinweisFormular h={formular.h} onClose={() => setFormular(null)} fertig={() => void g.neu()} />}
    </Seite>
  );
}

function HinweisFormular({ h, onClose, fertig }: { h: Hinweis | null; onClose: () => void; fertig: () => void }) {
  const [x, setX] = useState<Hinweis>(h ?? { id: 0, titel: '', text: '', von: null, bis: null, aktiv: true });
  return (
    <FormDialog offen titel={h ? 'Hinweis bearbeiten' : 'Neuer Hinweis'} onClose={onClose} aktion={async () => {
      if (!x.titel.trim()) { toast('Bitte einen Titel eingeben.', true); return false; }
      await senden(h ? `${BASIS}/${h.id}` : BASIS, { titel: x.titel, text: x.text, von: x.von ?? '', bis: x.bis ?? '', aktiv: x.aktiv }, h ? 'PUT' : 'POST');
      toast('Hinweis gespeichert.'); fertig();
    }}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        <TextField label="Titel" value={x.titel} onChange={e => setX({ ...x, titel: e.target.value })} placeholder="z. B. Elternsprechtag" required slotProps={{ htmlInput: { maxLength: 120 } }} />
        <TextField label="Text" value={x.text} onChange={e => setX({ ...x, text: e.target.value })} multiline minRows={4} slotProps={{ htmlInput: { maxLength: 1000 } }}
          placeholder="z. B. Am Do, 12.11. findet von 15 bis 19 Uhr der Elternsprechtag statt." helperText="Nur Text – keine personenbezogenen Daten, keine Links." />
        <Stack direction="row" gap={2}>
          <DatumFeld label="Anzeigen ab" wert={x.von ?? null} onWert={v => setX({ ...x, von: v })} />
          <DatumFeld label="Anzeigen bis" wert={x.bis ?? null} onWert={v => setX({ ...x, bis: v })} />
        </Stack>
        <Typography variant="caption" color="text.secondary">Leer = sofort bzw. ohne Ende.</Typography>
        <FormControlLabel control={<Switch checked={x.aktiv} onChange={e => setX({ ...x, aktiv: e.target.checked })} />} label="Auf der Anmeldeseite anzeigen" />
      </Stack>
    </FormDialog>
  );
}
