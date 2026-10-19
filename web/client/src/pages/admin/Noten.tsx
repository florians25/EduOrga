// Stammdaten | Notenschemen und Prüfungsarten: Gesamtnotenschema, Liste mit Reihenfolge (hoch/runter, alphabetisch), Auswahl löschen;
// Bearbeiten im Dialog (Notenschema: Name, aktiv, Noten mit optionalem Wert; Prüfungsart: Kurz-/Langname, schriftlich/mündlich, Farben,
// Höchstzahlen je Schüler*in, Notenschema, Gewichtung – beim Anlegen auch „Speichern & Neu“). Bericht als CSV.
import { useState } from 'react';
import { Alert, Box, Button, Checkbox, FormControlLabel, IconButton, MenuItem, Paper, Radio, RadioGroup, Stack, Switch, TextField, Typography } from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import ArrowDownwardRounded from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRounded from '@mui/icons-material/ArrowUpwardRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import SortByAlphaRounded from '@mui/icons-material/SortByAlphaRounded';
import { holen, senden, speichern } from '../../api/client';
import { Geladen, Seite } from '../../components/Seite';
import { FormDialog, Plakette, SuchFeld } from '../../components/Bausteine';
import { Tabelle } from '../../components/Tabelle';
import { bestaetigen, fehler, toast } from '../../lib/meldungen';
import { useLaden } from '../../lib/useLaden';
import { csv } from '../unterricht/Unterricht';

interface Note { text: string; wert: number | null }
interface Schema { id: number; name: string; aktiv: boolean; noten: Note[]; mitDurchschnitt: boolean }

function Reihenfolge({ pfad, ids, i, neu }: { pfad: string; ids: number[]; i: number; neu: () => void }) {
  const tausch = async (j: number) => {
    const l = [...ids];
    [l[i], l[j]] = [l[j], l[i]];
    try { await senden(`${pfad}/reihenfolge`, { ids: l }, 'PUT'); neu(); } catch (err) { fehler(err); }
  };
  return (
    <>
      <IconButton size="small" disabled={i === 0} onClick={e => { e.stopPropagation(); void tausch(i - 1); }} aria-label="Nach oben"><ArrowUpwardRounded fontSize="small" /></IconButton>
      <IconButton size="small" disabled={i === ids.length - 1} onClick={e => { e.stopPropagation(); void tausch(i + 1); }} aria-label="Nach unten"><ArrowDownwardRounded fontSize="small" /></IconButton>
    </>
  );
}

// ------------------------------------------------------------------ Notenschemen

export function Notenschemen() {
  const g = useLaden(sig => holen<{ schemen: Schema[]; gesamt: number | null }>('/api/app/notenschemen', sig), []);
  const [auswahl, setAuswahl] = useState<Set<string | number>>(new Set());
  const [form, setForm] = useState<{ s: Schema | null } | null>(null);
  const [gesamt, setGesamt] = useState<number | '' | null>(null);
  const neu = () => { setAuswahl(new Set()); void g.neu(); };
  const loeschen = async (ids: number[], l: Schema[]) => {
    const namen = l.filter(s => ids.includes(s.id)).map(s => s.name);
    if (!ids.length || !(await bestaetigen('Notenschemen löschen', `${namen.length === 1 ? `„${namen[0]}“` : `${namen.length} Notenschemen`} löschen? Prüfungsarten mit diesem Schema verlieren die Zuordnung.`))) return;
    try { await senden('/api/app/notenschemen/loeschen', { ids }); toast('Gelöscht.'); neu(); } catch (err) { fehler(err); }
  };
  return (
    <Seite titel="Notenschemen" untertitel="Notenschemen legen fest, welche Noten vergeben werden, z. B. „1 – 5“, „+, ~, -“ oder „Bestanden / Nicht bestanden“. Werte sind optional – ohne Werte werden keine Durchschnittsnoten berechnet."
      aktionen={<Button variant="contained" startIcon={<AddRounded />} onClick={() => setForm({ s: null })}>Neu</Button>}>
      <Geladen g={g}>{d => {
        const ids = d.schemen.map(s => s.id);
        const gw = gesamt ?? d.gesamt ?? '';
        return (
          <Stack gap={2.5}>
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography variant="h3" sx={{ mb: 1.5 }}>Gesamtnotenschema</Typography>
              <Stack direction="row" gap={1.5} alignItems="center">
                <TextField select label="Schema für Gesamtnoten" value={gw} onChange={e => setGesamt(e.target.value === '' ? '' : Number(e.target.value))} sx={{ width: 300 }}>
                  <MenuItem value="">– Auswahl –</MenuItem>{d.schemen.filter(s => s.aktiv).map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </TextField>
                <Button variant="outlined" onClick={async () => { try { await senden('/api/app/notenschemen/gesamt', { id: gw === '' ? null : gw }, 'PUT'); toast('Gesamtnotenschema gespeichert.'); } catch (err) { fehler(err); } }}>Speichern</Button>
              </Stack>
            </Paper>
            <Stack direction="row" gap={1} justifyContent="flex-end">
              <Button startIcon={<SortByAlphaRounded />} disabled={d.schemen.length < 2} onClick={async () => { await senden('/api/app/notenschemen/reihenfolge', { ids: null }, 'PUT'); toast('Alphabetisch sortiert.'); neu(); }}>Sortieren</Button>
              <Button color="error" startIcon={<DeleteOutlineRounded />} disabled={!auswahl.size} onClick={() => loeschen([...auswahl] as number[], d.schemen)}>Löschen{auswahl.size ? ` (${auswahl.size})` : ''}</Button>
            </Stack>
            <Tabelle zeilen={d.schemen} schluessel={s => s.id} auswahl={auswahl} setAuswahl={setAuswahl} onZeile={s => setForm({ s })} leer="Noch keine Notenschemen – legen Sie mit „Neu“ das erste an."
              spalten={[
                { id: 'name', kopf: 'Name', zelle: s => <b>{s.name}</b> },
                { id: 'noten', kopf: 'Noten', zelle: s => <Stack direction="row" gap={0.5} flexWrap="wrap">{s.noten.map((n, i) => <Plakette key={i}>{n.text}{n.wert !== null && n.wert !== undefined && <Box component="span" sx={{ opacity: 0.6, ml: 0.5 }}>{String(n.wert).replace('.', ',')}</Box>}</Plakette>)}</Stack> },
                { id: 'ds', kopf: 'Durchschnitt', zelle: s => (s.mitDurchschnitt ? <Plakette ton="ok">ja</Plakette> : <Plakette>ohne Werte</Plakette>) },
                { id: 'aktiv', kopf: 'aktiv', zelle: s => (s.aktiv ? <CheckRounded color="success" fontSize="small" /> : null) },
                { id: 'akt', kopf: '', rechts: true, nowrap: true, zelle: (s, i) => <Stack direction="row" justifyContent="flex-end"><Reihenfolge pfad="/api/app/notenschemen" ids={ids} i={i} neu={neu} />
                  <IconButton size="small" color="error" aria-label="Löschen" onClick={e => { e.stopPropagation(); void loeschen([s.id], d.schemen); }}><DeleteOutlineRounded fontSize="small" /></IconButton></Stack> },
              ]} />
          </Stack>
        );
      }}</Geladen>
      {form && <SchemaFormular s={form.s} onClose={() => setForm(null)} fertig={neu} />}
    </Seite>
  );
}

function SchemaFormular({ s, onClose, fertig }: { s: Schema | null; onClose: () => void; fertig: () => void }) {
  const [name, setName] = useState(s?.name ?? '');
  const [aktiv, setAktiv] = useState(s?.aktiv ?? true);
  const [noten, setNoten] = useState<Note[]>((s?.noten ?? []).map(n => ({ text: n.text, wert: n.wert ?? null })));
  const [neue, setNeue] = useState('');
  const hinzu = () => { if (neue.trim()) { setNoten([...noten, { text: neue.trim(), wert: null }]); setNeue(''); } };
  const tausch = (i: number, j: number) => setNoten(l => { const x = [...l]; [x[i], x[j]] = [x[j], x[i]]; return x; });
  return (
    <FormDialog offen titel={s ? `Notenschema ${s.name}` : 'Neues Notenschema'} breite="md" onClose={onClose} aktion={async () => {
      const l = neue.trim() ? [...noten, { text: neue.trim(), wert: null }] : noten;
      await senden(s ? `/api/app/notenschemen/${s.id}` : '/api/app/notenschemen', { name, aktiv, noten: l }, s ? 'PUT' : 'POST');
      toast('Gespeichert.'); fertig();
    }}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        <Stack direction="row" gap={2} alignItems="center">
          <TextField label="Name" value={name} onChange={e => setName(e.target.value)} required sx={{ flex: 1 }} slotProps={{ htmlInput: { maxLength: 100 } }} />
          <FormControlLabel control={<Switch checked={aktiv} onChange={e => setAktiv(e.target.checked)} />} label="aktiv" />
        </Stack>
        <Typography variant="h4">Noten</Typography>
        <Stack gap={1}>
          {noten.map((n, i) => (
            <Stack key={i} direction="row" gap={1} alignItems="center">
              <IconButton size="small" disabled={i === 0} onClick={() => tausch(i, i - 1)} aria-label="Nach oben"><ArrowUpwardRounded fontSize="small" /></IconButton>
              <IconButton size="small" disabled={i === noten.length - 1} onClick={() => tausch(i, i + 1)} aria-label="Nach unten"><ArrowDownwardRounded fontSize="small" /></IconButton>
              <TextField size="small" label="Note" value={n.text} onChange={e => setNoten(l => l.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} sx={{ flex: 1 }} slotProps={{ htmlInput: { maxLength: 30 } }} />
              <TextField size="small" type="number" label="Wert" value={n.wert ?? ''} placeholder="–" onChange={e => setNoten(l => l.map((x, j) => (j === i ? { ...x, wert: e.target.value === '' ? null : Number(e.target.value) } : x)))} sx={{ width: 110 }} slotProps={{ htmlInput: { step: 'any' } }} />
              <IconButton size="small" color="error" onClick={() => setNoten(l => l.filter((_, j) => j !== i))} aria-label="Note löschen"><CloseRounded fontSize="small" /></IconButton>
            </Stack>
          ))}
          <Stack direction="row" gap={1} alignItems="center" sx={{ pl: 9 }}>
            <TextField size="small" value={neue} onChange={e => setNeue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); hinzu(); } }} placeholder="Neue Note eingeben und Enter drücken" sx={{ flex: 1 }} slotProps={{ htmlInput: { maxLength: 30 } }} />
            <IconButton color="primary" onClick={hinzu} aria-label="Note hinzufügen"><AddRounded /></IconButton>
          </Stack>
        </Stack>
        <Typography variant="body2" color="text.secondary">Werte sind optional. Nur wenn alle Noten einen Wert haben, werden Durchschnittsnoten berechnet.</Typography>
      </Stack>
    </FormDialog>
  );
}

// ------------------------------------------------------------------ Prüfungsarten

interface PArt {
  id: number; kurz: string; name: string; aktiv: boolean; muendlich: boolean; angekuendigt: boolean; uebergeben: boolean; vordergrund: string; hintergrund: string;
  maxTag: number; maxWoche: number; maxZeitraum: number; zeitraumTage: number; gruppierung: number; freieTage: number; mitWochenende: boolean; notenschemaId: number | null; notenschema?: string; gewichtung: number;
}
const LEER: Omit<PArt, 'id'> = { kurz: '', name: '', aktiv: true, muendlich: false, angekuendigt: true, uebergeben: true, vordergrund: '#000000', hintergrund: '#ffffff', maxTag: 0, maxWoche: 0, maxZeitraum: 0, zeitraumTage: 0, gruppierung: 0, freieTage: 0, mitWochenende: true, notenschemaId: null, gewichtung: 1 };

export function Pruefungsarten() {
  const g = useLaden(async sig => {
    const [d, ns] = await Promise.all([holen<{ arten: PArt[] }>('/api/app/pruefungsarten?alle=true', sig), holen<{ schemen: Schema[] }>('/api/app/notenschemen', sig)]);
    return { arten: d.arten, schemen: ns.schemen };
  }, []);
  const [suche, setSuche] = useState('');
  const [auswahl, setAuswahl] = useState<Set<string | number>>(new Set());
  const [form, setForm] = useState<{ a: PArt | null } | null>(null);
  const neu = () => { setAuswahl(new Set()); void g.neu(); };
  const zahl = (n: number) => (n ? String(n) : '–');
  const loeschen = async (ids: number[], l: PArt[]) => {
    const namen = l.filter(a => ids.includes(a.id)).map(a => a.kurz);
    if (!ids.length || !(await bestaetigen('Prüfungsarten löschen', `${namen.length === 1 ? `„${namen[0]}“` : `${namen.length} Prüfungsarten`} löschen?`))) return;
    try { await senden('/api/app/pruefungsarten/loeschen', { ids }); toast('Gelöscht.'); neu(); } catch (err) { fehler(err); }
  };
  return (
    <Seite titel="Prüfungsarten" aktionen={<>
      <Button variant="outlined" startIcon={<DownloadRounded />} disabled={!g.daten?.arten.length} onClick={() => speichern(csv([
        ['Kurzname', 'Langname', 'Art', 'Max pro Tag', 'Max pro Woche', 'Max pro Zeitbereich', 'innerhalb Tagen', 'Keine Prüfung nach freien Tagen', 'Gruppierung', 'Notenschema', 'Gewichtung', 'aktiv'],
        ...g.daten!.arten.map(a => [a.kurz, a.name, a.muendlich ? 'mündlich' : 'schriftlich', a.maxTag, a.maxWoche, a.maxZeitraum, a.zeitraumTage, a.freieTage, a.gruppierung, a.notenschema, String(a.gewichtung).replace('.', ','), a.aktiv ? 'ja' : 'nein']),
      ]), 'pruefungsarten.csv')}>Bericht</Button>
      <Button variant="contained" startIcon={<AddRounded />} onClick={() => setForm({ a: null })}>Neu</Button>
    </>} filter={<SuchFeld wert={suche} onWert={setSuche} platzhalter="Suche (Kurz- oder Langname)" breite={280} />}>
      <Geladen g={g}>{d => {
        const ids = d.arten.map(a => a.id);
        const l = d.arten.filter(a => !suche || `${a.kurz} ${a.name}`.toLowerCase().includes(suche.toLowerCase()));
        return (
          <>
            <Stack direction="row" gap={1} justifyContent="flex-end" sx={{ mb: 1.5 }}>
              <Button startIcon={<SortByAlphaRounded />} disabled={d.arten.length < 2} onClick={async () => { await senden('/api/app/pruefungsarten/reihenfolge', { ids: null }, 'PUT'); toast('Alphabetisch sortiert.'); neu(); }}>Sortieren</Button>
              <Button color="error" startIcon={<DeleteOutlineRounded />} disabled={!auswahl.size} onClick={() => loeschen([...auswahl] as number[], d.arten)}>Löschen{auswahl.size ? ` (${auswahl.size})` : ''}</Button>
            </Stack>
            <Tabelle zeilen={l} schluessel={a => a.id} auswahl={auswahl} setAuswahl={setAuswahl} onZeile={a => setForm({ a })} leer="Noch keine Prüfungsarten – legen Sie mit „Neu“ die erste an."
              spalten={[
                { id: 'kurz', kopf: 'Prüfungsart', zelle: a => <Box component="span" sx={{ px: 1, py: 0.25, borderRadius: 1.5, fontWeight: 600, color: a.vordergrund, bgcolor: a.hintergrund, border: 1, borderColor: 'divider' }}>{a.kurz}</Box> },
                { id: 'name', kopf: 'Langname', zelle: a => <>{a.name}{a.muendlich && <Plakette sx={{ ml: 1 }}>mündlich</Plakette>}</> },
                { id: 'tag', kopf: 'Max/Tag', rechts: true, zelle: a => zahl(a.maxTag) },
                { id: 'woche', kopf: 'Max/Woche', rechts: true, zelle: a => zahl(a.maxWoche), verbergenMobil: true },
                { id: 'zr', kopf: 'Max/Tage', rechts: true, zelle: a => (a.maxZeitraum || a.zeitraumTage ? `${a.maxZeitraum} / ${a.zeitraumTage}` : '–'), verbergenMobil: true },
                { id: 'frei', kopf: 'Keine Prüfung nach', zelle: a => (a.freieTage ? `${a.freieTage} ${a.freieTage === 1 ? 'Tag' : 'Tagen'}` : '–'), verbergenMobil: true },
                { id: 'gr', kopf: 'Gruppierung', rechts: true, zelle: a => zahl(a.gruppierung), verbergenMobil: true },
                { id: 'ns', kopf: 'Notenschema', zelle: a => a.notenschema || <Typography variant="body2" color="text.secondary">individuell</Typography> },
                { id: 'aktiv', kopf: 'aktiv', zelle: a => (a.aktiv ? <CheckRounded color="success" fontSize="small" /> : null) },
                { id: 'akt', kopf: '', rechts: true, nowrap: true, zelle: a => <Stack direction="row" justifyContent="flex-end"><Reihenfolge pfad="/api/app/pruefungsarten" ids={ids} i={ids.indexOf(a.id)} neu={neu} />
                  <IconButton size="small" color="error" aria-label="Löschen" onClick={e => { e.stopPropagation(); void loeschen([a.id], d.arten); }}><DeleteOutlineRounded fontSize="small" /></IconButton></Stack> },
              ]} />
            {form && <ArtFormular a={form.a} schemen={d.schemen} onClose={() => setForm(null)} fertig={neu} />}
          </>
        );
      }}</Geladen>
    </Seite>
  );
}

function ArtFormular({ a, schemen, onClose, fertig }: { a: PArt | null; schemen: Schema[]; onClose: () => void; fertig: () => void }) {
  const [x, setX] = useState<Omit<PArt, 'id'>>({ ...LEER, ...(a ?? {}) });
  const [gespeichert, setGespeichert] = useState(false);
  const set = (w: Partial<PArt>) => setX(alt => ({ ...alt, ...w }));
  const speichernArt = async () => {
    const r = await senden<{ kurz: string }>(a ? `/api/app/pruefungsarten/${a.id}` : '/api/app/pruefungsarten', x, a ? 'PUT' : 'POST');
    toast(`Prüfungsart ${r.kurz} gespeichert.`);
    setGespeichert(true);
  };
  const zahl = (k: keyof PArt, label: string) => <TextField size="small" type="number" label={label} value={x[k as keyof typeof x] as number} onChange={e => set({ [k]: Number(e.target.value || 0) } as Partial<PArt>)} slotProps={{ htmlInput: { min: 0, max: 99 } }} sx={{ width: 150 }} />;
  return (
    <FormDialog offen titel={a ? `Prüfungsart ${a.kurz}` : 'Neue Prüfungsart'} breite="md" onClose={() => { if (gespeichert) fertig(); onClose(); }}
      links={!a && <Button onClick={async () => { try { await speichernArt(); setX({ ...LEER }); } catch (err) { fehler(err); } }}>Speichern & Neu</Button>}
      aktion={async () => { await speichernArt(); fertig(); }}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        <Stack direction="row" gap={2} alignItems="center">
          <TextField label="Kurzname" value={x.kurz} onChange={e => set({ kurz: e.target.value })} required sx={{ width: 180 }} slotProps={{ htmlInput: { maxLength: 20 } }} />
          <TextField label="Langname" value={x.name} onChange={e => set({ name: e.target.value })} sx={{ flex: 1 }} slotProps={{ htmlInput: { maxLength: 100 } }} />
          <FormControlLabel control={<Switch checked={x.aktiv} onChange={e => set({ aktiv: e.target.checked })} />} label="aktiv" />
        </Stack>
        <Stack direction="row" gap={3} flexWrap="wrap" alignItems="center">
          <RadioGroup row value={x.muendlich ? '1' : '0'} onChange={e => set({ muendlich: e.target.value === '1' })}><FormControlLabel value="0" control={<Radio />} label="Schriftlich" /><FormControlLabel value="1" control={<Radio />} label="Mündlich" /></RadioGroup>
          <FormControlLabel control={<Checkbox checked={x.angekuendigt} onChange={e => set({ angekuendigt: e.target.checked })} />} label="Angekündigte Prüfung" />
          <FormControlLabel control={<Checkbox checked={x.uebergeben} onChange={e => set({ uebergeben: e.target.checked })} />} label="An EduOrga Studio übergeben" />
        </Stack>
        <Stack direction="row" gap={2} alignItems="center">
          <TextField type="color" label="Vordergrund" value={x.vordergrund} onChange={e => set({ vordergrund: e.target.value })} sx={{ width: 120 }} />
          <TextField type="color" label="Hintergrund" value={x.hintergrund} onChange={e => set({ hintergrund: e.target.value })} sx={{ width: 120 }} />
          <Box sx={{ px: 1.5, py: 0.5, borderRadius: 1.5, fontWeight: 600, color: x.vordergrund, bgcolor: x.hintergrund, border: 1, borderColor: 'divider' }}>{x.kurz || 'Vorschau'}</Box>
        </Stack>
        <Typography variant="h4">Maximale Anzahl der Prüfungen pro Schüler*in</Typography>
        <Stack direction="row" gap={2} flexWrap="wrap" alignItems="center">
          {zahl('maxTag', 'Pro Tag')}{zahl('maxWoche', 'Pro Kalenderwoche')}{zahl('maxZeitraum', 'Pro Zeitbereich')}{zahl('zeitraumTage', 'innerhalb von Tagen')}{zahl('gruppierung', 'Gruppierung')}
        </Stack>
        <Stack direction="row" gap={2} alignItems="center">
          {zahl('freieTage', 'Keine Prüfung nach … freien Tagen')}
          <FormControlLabel control={<Checkbox checked={x.mitWochenende} onChange={e => set({ mitWochenende: e.target.checked })} />} label="mit Wochenende" />
        </Stack>
        <Typography variant="caption" color="text.secondary">0 = keine Begrenzung.</Typography>
        <Typography variant="h4">Noten</Typography>
        <Stack direction="row" gap={2}>
          <TextField select label="Notenschema" value={x.notenschemaId ?? ''} onChange={e => set({ notenschemaId: e.target.value === '' ? null : Number(e.target.value) })} sx={{ flex: 1 }}>
            <MenuItem value="">– individuell durch die Lehrkraft –</MenuItem>{schemen.filter(s => s.aktiv || s.id === x.notenschemaId).map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
          </TextField>
          <TextField type="number" label="Gewichtungsfaktor" value={x.gewichtung} onChange={e => set({ gewichtung: Number(e.target.value || 0) })} slotProps={{ htmlInput: { step: 0.1, min: 0, max: 100 } }} sx={{ width: 170 }} />
        </Stack>
        {!x.notenschemaId && <Alert severity="info">Ohne Notenschema wird die Lehrkraft beim Anlegen einer Prüfung dieser Art nach einem individuellen Notenschema gefragt.</Alert>}
      </Stack>
    </FormDialog>
  );
}
