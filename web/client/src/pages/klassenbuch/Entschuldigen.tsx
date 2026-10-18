// Fehlzeiten eigener Unterricht (Fachlehrer-Entschuldigungen): Fehlstunden aus dem eigenen Unterricht entschuldigen (einzeln oder mehrere),
// gesperrte Stunden nur lesen. Dazu die Seitenleiste „Fehlzeiten“ einer Abwesenheit und der Entschuldigungsdialog der Klassenleitung.
import { useState } from 'react';
import { Alert, Box, Button, Drawer, FormControlLabel, IconButton, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material';
import CloseRounded from '@mui/icons-material/CloseRounded';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { holen, senden, qs } from '../../api/client';
import { Geladen, Seite } from '../../components/Seite';
import { FormDialog, SuchFeld, Wahl } from '../../components/Bausteine';
import { DatumFeld } from '../../components/Auswahl';
import { Tabelle } from '../../components/Tabelle';
import { DatumZelle, StatusLabel, STATUS_TEXT } from '../../components/klassenbuch/fehlzeiten';
import { datumDe, datumLang, heuteIso, istIsoDatum, plusTage, zeitstempel } from '../../lib/datum';
import { navigieren } from '../../lib/router';
import { toast } from '../../lib/meldungen';
import { useLaden } from '../../lib/useLaden';
import type { SeitenProps } from '../register';

interface Ent { text?: string; datum?: string; rolle?: string; lehrer?: string; zeit?: string }
export interface FeZeile { id: number; schueler: string; klasse: string; datum: string; beginn: string; ende: string; fach: string; lehrer: string; grund: string; status: string; darf: boolean; gesperrt: boolean; hinweis?: string; entschuldigung?: Ent | null; abwesenheitText?: string; texte?: (Ent & { fach?: string; stunde?: number; status: string })[]; stunde?: number }
export interface FeAbwesenheit { schluessel: string; ids: number[]; schueler: string; klasse: string; vonDatum: string; vonZeit: string; bisDatum: string; bisZeit: string; grund: string; status: string; mehrdeutig?: boolean; lehrerBearbeitet: number; lehrerGesamt: number; entschuldigtAm?: string; nachweis?: string; stunden: FeZeile[] }

export function StundenDialog({ zeilen, onClose, fertig }: { zeilen: FeZeile[]; onClose: () => void; fertig: () => void }) {
  const z = zeilen[0];
  const gesperrt = zeilen.length === 1 && z.gesperrt;
  const ent = z.entschuldigung;
  const [datum, setDatum] = useState<string | null>(ent?.datum || heuteIso());
  const [status, setStatus] = useState(gesperrt ? z.status : 'entschuldigt');
  const [text, setText] = useState(gesperrt ? ent?.text || z.abwesenheitText || '' : '');
  return (
    <FormDialog offen titel={zeilen.length === 1 ? `Entschuldigung für ${z.schueler}` : `Entschuldigung für ${zeilen.length} Fehlstunden`} onClose={onClose}
      aktion={gesperrt ? undefined : async () => {
        const r = await senden<{ geaendert: number; gesperrt?: number[] }>('/api/app/entschuldigungen/fehlzeiten', { ids: zeilen.map(x => x.id), status, text, datum });
        toast(r.gesperrt?.length ? `${r.geaendert} gespeichert, ${r.gesperrt.length} bereits entschuldigt (gesperrt).` : `${r.geaendert} ${r.geaendert === 1 ? 'Fehlstunde' : 'Fehlstunden'} gespeichert.`);
        fertig();
      }}>
      <Stack gap={2}>
        {gesperrt && <Alert severity="info" icon={<LockOutlined />}>{z.hinweis}</Alert>}
        <Stack direction="row" gap={2}>
          <DatumFeld label="Datum" wert={datum} onWert={setDatum} deaktiviert={gesperrt} />
          <TextField select label="Status" value={status} onChange={e => setStatus(e.target.value)} disabled={gesperrt} sx={{ flex: 1 }}>
            {gesperrt ? <MenuItem value={z.status}>{STATUS_TEXT[z.status]?.[0] ?? z.status}</MenuItem> : [<MenuItem key="e" value="entschuldigt">entschuldigt</MenuItem>, <MenuItem key="u" value="unentschuldigt">nicht entschuldigt</MenuItem>]}
          </TextField>
        </Stack>
        <Box><Typography variant="subtitle2">Abwesenheit</Typography>
          {zeilen.slice(0, 8).map(x => <Typography key={x.id} variant="body2" color="text.secondary">{x.schueler}, {x.fach}, {datumDe(x.datum)}, {x.beginn} – {x.ende}</Typography>)}
          {zeilen.length > 8 && <Typography variant="body2" color="text.secondary">… und {zeilen.length - 8} weitere</Typography>}</Box>
        <TextField label="Text" multiline minRows={3} value={text} onChange={e => setText(e.target.value)} disabled={gesperrt} placeholder="z. B. Attest liegt vor"
          helperText={gesperrt ? undefined : 'Der Text ist für andere Lehrkräfte mit einer Fehlstunde in derselben Abwesenheit sichtbar.'} slotProps={{ htmlInput: { maxLength: 1000 } }} />
        {zeilen.length === 1 && !!z.texte?.length && (
          <Box><Typography variant="subtitle2" sx={{ mb: 1 }}>Zuletzt eingegebene Entschuldigungstexte</Typography>
            {z.texte.map((t, i) => <Box key={i} sx={{ p: 1.25, mb: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
              <Typography variant="caption" color="text.secondary"><b>{t.lehrer || '–'}</b>{t.rolle === 'klassenleitung' ? ' (Klassenleitung)' : ''} · {zeitstempel(t.zeit)}{t.fach ? ` · ${t.fach}, ${t.stunde}. Std.` : ''} · {STATUS_TEXT[t.status]?.[0] ?? t.status}</Typography>
              <Typography variant="body2">{t.text}</Typography></Box>)}
          </Box>
        )}
      </Stack>
    </FormDialog>
  );
}

export function FehlzeitenLeiste({ a, grundName, onClose }: { a: FeAbwesenheit; grundName: (g: string) => string; onClose: () => void }) {
  const tage = [...new Set(a.stunden.map(x => x.datum))];
  return (
    <Drawer anchor="right" open onClose={onClose} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 420 } } } }}>
      <Stack direction="row" alignItems="center" sx={{ px: 2.5, py: 1.5, borderBottom: 1, borderColor: 'divider' }}><Typography variant="h3" sx={{ flex: 1 }}>Fehlzeiten</Typography><IconButton onClick={onClose} aria-label="Schließen"><CloseRounded /></IconButton></Stack>
      <Box sx={{ p: 2.5, overflowY: 'auto' }}>
        <Typography sx={{ fontWeight: 600 }}>{a.schueler}</Typography><Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{a.klasse}</Typography>
        <Typography variant="body2">Beginn: {datumDe(a.vonDatum)} {a.vonZeit}</Typography><Typography variant="body2">Ende: {datumDe(a.bisDatum)} {a.bisZeit}</Typography>
        {a.grund && <Typography variant="body2">Abwesenheitsgrund: {grundName(a.grund)}</Typography>}
        <Stack direction="row" gap={1} alignItems="center" sx={{ my: 1 }}><StatusLabel s={a.status} />{a.mehrdeutig && <Typography variant="caption" color="status.pruefung.main">(mehrdeutig)</Typography>}<Typography variant="body2" color="text.secondary">{a.lehrerBearbeitet}/{a.lehrerGesamt} Lehrkräfte bearbeitet</Typography></Stack>
        {a.mehrdeutig && <Alert severity="warning" sx={{ mb: 1.5 }}>Die Stunden haben unterschiedliche Status – bitte die Abwesenheit prüfen und als Ganzes entschuldigen.</Alert>}
        {tage.map(t => (
          <Box key={t} sx={{ mt: 2 }}><Typography variant="subtitle2" sx={{ mb: 1 }}>{datumLang(t)}</Typography>
            {a.stunden.filter(x => x.datum === t).sort((x, y) => (y.stunde ?? 0) - (x.stunde ?? 0)).map(x => (
              <Box key={x.id} sx={{ p: 1.25, mb: 1, borderRadius: 2, border: 1, borderColor: 'divider' }}>
                <Stack direction="row" justifyContent="space-between"><Typography variant="body2" sx={{ fontWeight: 500 }}>{x.beginn} – {x.ende}</Typography><StatusLabel s={x.status} /></Stack>
                <Typography variant="caption" color="text.secondary">{x.fach}{x.lehrer ? ` – ${x.lehrer}` : ''}{x.entschuldigung ? ` · ${x.entschuldigung.rolle === 'klassenleitung' ? 'Klassenleitung' : 'Fachlehrkraft'} ${x.entschuldigung.lehrer}, ${zeitstempel(x.entschuldigung.zeit)}` : ''}</Typography>
                {x.entschuldigung?.text && <Typography variant="body2" sx={{ mt: 0.5 }}>{x.entschuldigung.text}</Typography>}
              </Box>
            ))}
          </Box>
        ))}
      </Box>
    </Drawer>
  );
}

export function AbwesenheitEntschuldigen({ liste, status: vorgabe = 'entschuldigt', nachweise, onClose, fertig }: { liste: FeAbwesenheit[]; status?: string; nachweise: Record<string, string>; onClose: () => void; fertig: () => void }) {
  const ids = liste.flatMap(a => a.ids);
  const ueber = liste.some(a => a.stunden.some(x => x.entschuldigung?.rolle === 'fachlehrer'));
  const a = liste[0];
  const kl = liste.flatMap(x => x.stunden).map(x => x.entschuldigung).find(x => x?.rolle === 'klassenleitung');
  const [status, setStatus] = useState(vorgabe);
  const [datum, setDatum] = useState<string | null>(a.entschuldigtAm || heuteIso());
  const [nachweis, setNachweis] = useState(a.nachweis ?? '');
  const [text, setText] = useState(kl?.text ?? '');
  return (
    <FormDialog offen titel={liste.length === 1 ? `Entschuldigung für ${a.schueler}` : `Entschuldigung für ${liste.length} Abwesenheiten`} onClose={onClose} aktion={async () => {
      const r = status === 'offen' ? await senden<{ ueberschrieben?: number }>('/api/app/entschuldigungen/zuruecknehmen', { ids })
        : await senden<{ ueberschrieben?: number }>('/api/app/entschuldigungen/abwesenheit', { ids, status, text, datum, nachweis });
      toast(status === 'offen' ? 'Entschuldigung zurückgenommen.' : r.ueberschrieben ? `Gespeichert – ${r.ueberschrieben} ${r.ueberschrieben === 1 ? 'Stunde' : 'Stunden'} der Fachlehrkräfte überschrieben.` : 'Gespeichert.');
      fertig();
    }}>
      <Stack gap={2}>
        {ueber && <Alert severity="warning"><b>Warnung:</b> Der Entschuldigungsstatus der Fehlstunden wird überschrieben (Fachlehrkräfte haben einzelne Stunden bereits bearbeitet).</Alert>}
        <Stack direction="row" gap={2}>
          <TextField select label="Status" value={status} onChange={e => setStatus(e.target.value)} sx={{ flex: 1 }}>
            <MenuItem value="entschuldigt">entschuldigt</MenuItem><MenuItem value="unentschuldigt">nicht entschuldigt</MenuItem><MenuItem value="offen">offen (zurücknehmen)</MenuItem>
          </TextField>
          <DatumFeld label="Datum" wert={datum} onWert={setDatum} />
        </Stack>
        <Box>{liste.slice(0, 6).map(x => <Typography key={x.schluessel} variant="body2" color="text.secondary">{x.schueler}, {datumDe(x.vonDatum)} {x.vonZeit} – {datumDe(x.bisDatum)} {x.bisZeit}</Typography>)}{liste.length > 6 && <Typography variant="body2" color="text.secondary">… und {liste.length - 6} weitere</Typography>}</Box>
        <TextField select label="Nachweis" value={nachweis} onChange={e => setNachweis(e.target.value)}><MenuItem value="">kein Nachweis</MenuItem>{Object.entries(nachweise).map(([k, t]) => <MenuItem key={k} value={k}>{t}</MenuItem>)}</TextField>
        <TextField label="Text" multiline minRows={3} value={text} onChange={e => setText(e.target.value)} placeholder="z. B. Abwesenheit ist OK." helperText="Fachlehrkräfte sehen den Text, wenn sie eine Stunde dieser Abwesenheit öffnen." />
      </Stack>
    </FormDialog>
  );
}

export default function Entschuldigen({ teile }: SeitenProps) {
  const [vP, bP, kP, sP, oP] = teile;
  const von = istIsoDatum(vP) ? vP : plusTage(heuteIso(), -14);
  const bis = istIsoDatum(bP) ? bP : heuteIso();
  const klasse = kP && kP !== '-' ? kP : '';
  const status = ['offen', 'entschuldigt', 'unentschuldigt'].includes(sP) ? sP : '';
  const nurOffen = oP === '1';
  const ziel = (v = von, b = bis, k = klasse, s = status, o = nurOffen) => `#/entschuldigen/${v}/${b}/${encodeURIComponent(k || '-')}/${s || '-'}/${o ? 1 : 0}`;
  const [suche, setSuche] = useState('');
  const [auswahl, setAuswahl] = useState<Set<string | number>>(new Set());
  const [dialog, setDialog] = useState<FeZeile[] | null>(null);
  const g = useLaden(async () => {
    const [d, gr] = await Promise.all([
      holen<{ zeilen: FeZeile[]; klassen: string[]; darf: boolean }>(`/api/app/entschuldigungen/fehlzeiten${qs({ von, bis, klasse, status, nurOffene: nurOffen ? 'true' : undefined })}`),
      holen<{ kurz: string; name: string }[]>('/api/app/abwesenheitsgruende?art=abwesenheit').catch(() => []),
    ]);
    return { ...d, grund: Object.fromEntries(gr.map(x => [x.kurz, x.name])) as Record<string, string> };
  }, [von, bis, klasse, status, nurOffen]);
  return (
    <Seite titel="Fehlzeiten" untertitel="Fehlstunden aus Ihrem Unterricht" filter={g.daten && <>
      <SuchFeld wert={suche} onWert={setSuche} platzhalter="Schüler*in oder Fach suchen" />
      <Wahl label="Klasse" wert={klasse} onWert={k => navigieren(ziel(von, bis, k))} optionen={g.daten.klassen.map(k => [k, k])} alle="Alle Klassen" breite={150} />
      <Wahl label="Status" wert={status} onWert={s => navigieren(ziel(von, bis, klasse, s))} optionen={Object.entries(STATUS_TEXT).map(([k, [t]]) => [k, t])} alle="Jeder Status" breite={170} />
      <DatumFeld label="Von" wert={von} onWert={v => v && navigieren(ziel(v))} pflicht />
      <DatumFeld label="Bis" wert={bis} onWert={b => b && navigieren(ziel(von, b))} pflicht />
      <FormControlLabel control={<Switch checked={nurOffen} onChange={e => navigieren(ziel(von, bis, klasse, status, e.target.checked))} />} label="Nur offene" />
    </>}>
      <Geladen g={g}>{d => {
        const q = suche.toLowerCase();
        const liste = d.zeilen.filter(z => !q || `${z.schueler} ${z.fach} ${z.klasse}`.toLowerCase().includes(q));
        return (
          <>
            {!d.darf && <Alert severity="info" icon={<LockOutlined />} sx={{ mb: 2 }}>{d.zeilen.length ? 'Sie sehen die Fehlstunden Ihres Unterrichts. Entschuldigen ist für Ihr Konto nicht freigegeben bzw. die Fachlehrer-Entschuldigungen sind nicht eingeschaltet.' : 'Die Fachlehrer-Entschuldigungen sind nicht eingeschaltet bzw. für Ihr Konto nicht freigegeben.'}</Alert>}
            <Tabelle zeilen={liste} schluessel={z => z.id} auswahl={d.zeilen.some(z => z.darf) ? auswahl : undefined} setAuswahl={setAuswahl} leer="Keine Fehlstunden in Ihrem Unterricht im Zeitraum."
              spalten={[
                { id: 'schueler', kopf: 'Schüler*in', zelle: z => <b style={{ fontWeight: 500 }}>{z.schueler}</b>, sortWert: z => z.schueler },
                { id: 'klasse', kopf: 'Klasse', zelle: z => z.klasse, sortWert: z => z.klasse },
                { id: 'datum', kopf: 'Datum', zelle: z => <DatumZelle iso={z.datum} />, sortWert: z => z.datum + z.beginn },
                { id: 'zeit', kopf: 'Zeit', zelle: z => `${z.beginn} – ${z.ende}`, nowrap: true },
                { id: 'fach', kopf: 'Fach', zelle: z => z.fach }, { id: 'lehrer', kopf: 'Lehrkraft', zelle: z => z.lehrer, verbergenMobil: true },
                { id: 'grund', kopf: 'Grund', zelle: z => d.grund[z.grund] ?? z.grund, verbergenMobil: true },
                { id: 'status', kopf: 'Status', zelle: z => <Button size="small" variant={z.darf ? 'outlined' : 'text'} onClick={() => setDialog([z])} startIcon={z.gesperrt ? <LockOutlined fontSize="small" /> : undefined}>{z.darf ? 'entschuldigen' : <StatusLabel s={z.status} />}</Button> },
                { id: 'text', kopf: 'Text', zelle: z => z.entschuldigung?.text ?? '', verbergenMobil: true },
              ]} />
            {auswahl.size > 0 && <Stack direction="row" gap={1} sx={{ mt: 1.5 }}><Button variant="contained" color="success" onClick={() => setDialog(d.zeilen.filter(z => auswahl.has(z.id)))}>{auswahl.size} entschuldigen</Button></Stack>}
            {dialog && <StundenDialog zeilen={dialog} onClose={() => setDialog(null)} fertig={() => { setAuswahl(new Set()); void g.neu(); }} />}
          </>
        );
      }}</Geladen>
    </Seite>
  );
}
