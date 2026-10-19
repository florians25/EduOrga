// Administration: Übersicht & Synchronisation (Verbindung mit EduOrga Studio, Datenstand, Schule, Version & Updates), Nachrichten zum Tag,
// Freie Tage & Ferien, Import, Export, Aktive Benutzer, Zugriff ent-/sperren, Über EduOrga, Rechte und Rollen, Benutzer, Personen & Konten,
// Zuordnungsgruppen, Rückmeldungen, Prüfungssperren, Verspätungen & Fehlzeiten, Ansichtseinstellungen, Darstellung der Stundenkarten,
// Monitoransichten, Protokoll.
import { lazy, Suspense, useState, type ReactNode } from 'react';
import {
  Alert, Box, Button, Checkbox, FormControlLabel, IconButton, InputAdornment, Link, MenuItem, Paper, Stack, Switch, TextField, Tooltip, Typography,
} from '@mui/material';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import { api, holen, loeschen, senden, speichern } from '../../api/client';
import { useSitzung } from '../../app/sitzung';
import { UpdateDialog, updateInstallieren, updatestandSetzen, type Updatestand } from '../../app/Update';
import { Geladen, Laden, Seite } from '../../components/Seite';
import { FormDialog, Plakette, Wahl } from '../../components/Bausteine';
import { DatumFeld } from '../../components/Auswahl';
import { Tabelle } from '../../components/Tabelle';
import { datumDe, heuteIso, WOCHENTAGE } from '../../lib/datum';
import { bestaetigen, fehler, toast } from '../../lib/meldungen';
import { lesen as speicherLesen, schreiben as speicherSchreiben } from '../../lib/speicher';
import { useLaden } from '../../lib/useLaden';
import { meldungText, MeldungStatus, type Meldung } from '../melden/meldungen';
import type { SeitenProps } from '../register';
import { csv } from '../unterricht/Unterricht';

const Benutzer = lazy(() => import('./Benutzer').then(m => ({ default: m.Benutzer })));
const Personen = lazy(() => import('./Benutzer').then(m => ({ default: m.Personen })));
const Rechte = lazy(() => import('./Rechte'));
const SchuelerImport = lazy(() => import('./Import').then(m => ({ default: m.SchuelerImport })));
const QuelleKarte = lazy(() => import('./Import').then(m => ({ default: m.QuelleKarte })));
const Wartung = lazy(() => import('./Wartung'));
const Stundenkarten = lazy(() => import('./Stundenkarten'));

const BEREICHE: { id: string; text: string; admin: boolean; recht?: string }[] = [
  { id: 'sync', text: 'System & Datenabgleich', admin: true }, { id: 'nachrichten', text: 'Nachrichten zum Tag', admin: false },
  { id: 'freietage', text: 'Freie Tage & Ferien', admin: true }, { id: 'import', text: 'Import', admin: true, recht: 'admin.import' },
  { id: 'export', text: 'Export', admin: true }, { id: 'aktive', text: 'Aktive Benutzer', admin: true, recht: 'admin.wartung' },
  { id: 'zugriff', text: 'Wartungsmodus', admin: true, recht: 'admin.wartung' }, { id: 'ueber', text: 'Über EduOrga', admin: true, recht: 'admin.wartung' },
  { id: 'rechte', text: 'Rechte und Rollen', admin: true }, { id: 'benutzer', text: 'Benutzer', admin: true, recht: 'admin.benutzer' },
  { id: 'personen', text: 'Personen & Konten', admin: true, recht: 'admin.benutzer' }, { id: 'zuordnung', text: 'Zuordnungsgruppen', admin: true },
  { id: 'rueckmeldungen', text: 'Rückmeldungen an Studio', admin: true }, { id: 'sperren', text: 'Prüfungssperren', admin: true },
  { id: 'verspaetung', text: 'Verspätungen & Fehlzeiten', admin: true }, { id: 'ansicht', text: 'Ansichtseinstellungen', admin: true },
  { id: 'stundenkarten', text: 'Darstellung der Stundenkarten', admin: true },
  { id: 'monitore', text: 'Monitoransichten', admin: true }, { id: 'protokoll', text: 'Protokoll', admin: true },
];
export const ROLLEN: Record<string, string> = { admin: 'Administration', leitung: 'Schulleitung', lehrer: 'Lehrkraft', schueler: 'Schüler*in / Klasse', eltern: 'Erziehungsberechtigte*r' };
export const kurzZeit = (s: string | null | undefined) => (s ? new Date(s.replace(' ', 'T')).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '');
export function kopieren(text: string) {
  navigator.clipboard?.writeText(text).then(() => toast('In die Zwischenablage kopiert.'), () => toast('Kopieren nicht möglich – bitte manuell markieren.', true));
}
export function KopierFeld({ wert, anzeige, label }: { wert: string; anzeige?: string; label?: string }) {
  return (
    <TextField fullWidth size="small" label={label} value={anzeige ?? wert} slotProps={{ input: { readOnly: true, sx: { fontFamily: 'monospace', fontSize: 13 }, endAdornment: (
      <InputAdornment position="end"><Tooltip title="Kopieren"><IconButton size="small" onClick={() => kopieren(wert)} aria-label="Kopieren"><ContentCopyRounded fontSize="small" /></IconButton></Tooltip></InputAdornment>
    ) } }} />
  );
}
export function Karte({ titel, aktion, children, sx }: { titel?: ReactNode; aktion?: ReactNode; children: ReactNode; sx?: object }) {
  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden', ...sx }}>
      {(titel || aktion) && <Stack direction="row" alignItems="center" gap={1} sx={{ px: { xs: 2, sm: 2.5 }, py: 1.1, minHeight: 44, bgcolor: 'flaechen.band', borderBottom: 1, borderColor: 'divider' }}><Typography variant="h3" component="h2" sx={{ flex: 1 }}>{titel}</Typography>{aktion}</Stack>}
      <Box sx={{ p: { xs: 2, sm: 2.5 } }}>{children}</Box>
    </Paper>
  );
}

export default function Admin({ teile }: SeitenProps) {
  const { ich } = useSitzung();
  const [b, ...weitere] = teile;
  const erlaubt = BEREICHE.filter(x => ich.admin || !x.admin || (x.recht && ich.rechte?.[x.recht]));
  const bereich = erlaubt.find(x => x.id === b) ?? erlaubt[0];
  if (!bereich) return <Seite titel="Administration"><Alert severity="warning">Keine Berechtigung.</Alert></Seite>;
  const inhalt: Record<string, () => ReactNode> = {
    sync: () => <Sync />, nachrichten: () => <Nachrichten />, freietage: () => <FreieTage />, import: () => <Import teil={weitere[0]} />, export: () => <Export />,
    aktive: () => <Wartung art="aktive" teil={weitere[0]} />, zugriff: () => <Wartung art="zugriff" />, ueber: () => <Wartung art="ueber" />,
    rechte: () => <Rechte teil={weitere[0]} weitere={weitere.slice(1)} />, benutzer: () => <Benutzer weitere={weitere} />, personen: () => <Personen weitere={weitere} />,
    zuordnung: () => <Einstellung bereich="zuordnung" titel="Zuordnung beim Anlegen von Konten aus den Stammdaten" felder={[
      { typ: 'hinweis', text: 'Bei „Konten aus Stammdaten“ (Benutzer) werden Lehrkräfte der Rolle Lehrkraft und Klassen der Rolle Klasse zugeordnet.' },
      { name: 'leitungKuerzel', typ: 'text', label: 'Kürzel, die der Schulleitung zugeordnet werden', hilfe: 'Mehrere Kürzel durch Komma trennen.' },
      { name: 'klassenkonten', typ: 'schalter', label: 'Klassenkonten standardmäßig mit anlegen' }]} />,
    rueckmeldungen: () => <Rueckmeldungen />,
    sperren: () => <Einstellung bereich="pruefungssperren" titel="Zeitliche Einschränkungen für das Eintragen von Prüfungen" felder={[
      { name: 'aktiv', typ: 'schalter', label: 'Prüfungssperren aktivieren' },
      { name: 'maxProTag', typ: 'zahl', label: 'Höchstens Prüfungen je Klasse und Tag', max: 10 }, { name: 'maxProWoche', typ: 'zahl', label: 'Höchstens Prüfungen je Klasse und Woche', max: 20 },
      { name: 'leitungAusnehmen', typ: 'schalter', label: 'Schulleitung und Administration von den Sperren ausnehmen' },
      { typ: 'hinweis', text: 'Gezählt werden Klausuren aus EduOrga Studio und noch nicht übernommene Prüfungen aus EduOrga Web. 0 = keine Grenze.' }]} />,
    verspaetung: () => <Einstellung bereich="verspaetung" titel="Verspätungen und vorzeitiges Gehen" felder={[
      { name: 'abwesendAbMinuten', typ: 'zahl', label: 'Stunde gilt als Fehlstunde ab (Minuten)', max: 240, hilfe: '0 = nur ganz verpasste Stunden werden Fehlstunden. Beispiel 20: Wer 20 min oder mehr zu spät kommt, fehlt in dieser Stunde.' },
      { name: 'hinweisAbAnzahl', typ: 'zahl', label: 'Hinweis an die Klassenleitung ab (Verspätungen)', max: 100, hilfe: 'Im Fehlzeitenbericht und in der Klassenübersicht markiert; 0 = aus.' },
      { name: 'minutenUmrechnen', typ: 'schalter', label: 'Verspätungs- und Gehminuten zu Fehlstunden zusammenrechnen' },
      { name: 'minutenProFehlstunde', typ: 'zahl', label: 'Minuten je Fehlstunde', min: 1, max: 240 },
      { name: 'vorzeitigRestTag', typ: 'schalter', label: 'Beim vorzeitigen Gehen standardmäßig für den Rest des Tages abwesend eintragen' },
      { typ: 'hinweis', text: 'Verspätungen werden ab der ersten, vorzeitiges Gehen bis zur letzten Stunde eines Blocks gerechnet; ganz verpasste Stunden zählen immer als Fehlstunden. Der Entschuldigungsstatus bleibt beim Bearbeiten erhalten.' }]} />,
    ansicht: () => <Stack gap={2.5}>
      <Einstellung bereich="ansicht" titel="Globale Einstellungen der Oberfläche" sitzungNeu felder={[
        { name: 'nachrichtenAnzeigen', typ: 'schalter', label: 'Nachrichten zum Tag auf der Startseite anzeigen' },
        { name: 'rss', typ: 'schalter', label: 'Öffentliche Nachrichten zum Tag als RSS-Feed veröffentlichen (/rss/nachrichten.xml)' },
        { name: 'kartenZeiten', typ: 'schalter', label: 'Uhrzeiten in den Stundenkacheln anzeigen (Voreinstellung)' },
        { name: 'startseite', typ: 'wahl', label: 'Startseite nach der Anmeldung', optionen: [['heute', 'Heute'], ['stundenplan', 'Mein Stundenplan']] }]} />
      <QuelleKarte />
    </Stack>,
    stundenkarten: () => <Stundenkarten />,
    monitore: () => <Monitore />, protokoll: () => <Protokoll />,
  };
  return (
    <Seite titel={bereich.text}>
      <Suspense fallback={<Laden />}>{inhalt[bereich.id]()}</Suspense>
    </Seite>
  );
}

// ------------------------------------------------------------------ Einstellungen (gemeinsam)

type Feld = { typ: 'hinweis'; text: string } | { typ: 'schalter' | 'text' | 'zahl' | 'wahl'; name: string; label: string; hilfe?: string; min?: number; max?: number; optionen?: [string, string][] };

export function Einstellung({ bereich, titel, felder, sitzungNeu }: { bereich: string; titel: string; felder: Feld[]; sitzungNeu?: boolean }) {
  const s = useSitzung();
  const g = useLaden(sig => holen<Record<string, string | number | boolean>>(`/api/app/admin/einstellungen/${bereich}`, sig), [bereich]);
  const [w, setW] = useState<Record<string, string | number | boolean> | null>(null);
  const werte = w ?? g.daten ?? {};
  const set = (n: string, v: string | number | boolean) => setW({ ...werte, [n]: v });
  return (
    <Karte titel={titel} sx={{ maxWidth: 860 }}>
      <Geladen g={g}>{() => (
        <Stack gap={2}>
          {felder.map((f, i) => f.typ === 'hinweis' ? <Typography key={i} variant="body2" color="text.secondary">{f.text}</Typography>
            : f.typ === 'schalter' ? <FormControlLabel key={f.name} control={<Switch checked={!!werte[f.name]} onChange={e => set(f.name, e.target.checked)} />} label={f.label} />
            : f.typ === 'wahl' ? <TextField key={f.name} select label={f.label} value={werte[f.name] ?? ''} onChange={e => set(f.name, e.target.value)} sx={{ maxWidth: 360 }}>{f.optionen!.map(([v, t]) => <MenuItem key={v} value={v}>{t}</MenuItem>)}</TextField>
            : <TextField key={f.name} type={f.typ === 'zahl' ? 'number' : 'text'} label={f.label} value={werte[f.name] ?? ''} helperText={f.hilfe} sx={{ maxWidth: f.typ === 'zahl' ? 420 : 560 }}
              onChange={e => set(f.name, f.typ === 'zahl' ? Number(e.target.value) : e.target.value)} slotProps={{ htmlInput: { min: f.min ?? 0, max: f.max } }} />)}
          <Box><Button variant="contained" disabled={!w} onClick={async () => {
            try { await senden(`/api/app/admin/einstellungen/${bereich}`, werte, 'PUT'); toast('Einstellungen gespeichert.'); setW(null); await g.neu(); if (sitzungNeu) await s.neuLaden(); } catch (err) { fehler(err); }
          }}>Speichern</Button></Box>
        </Stack>
      )}</Geladen>
    </Karte>
  );
}

// ------------------------------------------------------------------ Übersicht & Synchronisation

interface Uebersicht {
  adresse: string; schulId: string; schulname: string; apiSchluesselGesetzt: boolean; version?: string; offeneRueckmeldungen: number; benutzer: Record<string, number>;
  paket: null | { empfangen: string; revision: number; programmversion?: string; schuljahr: string; von?: string; bis?: string; klassen: number; lehrer: number; raeume: number; perioden: number; tage: number; vertretungen: number };
}

function Sync() {
  const s = useSitzung();
  const g = useLaden(sig => holen<Uebersicht>('/api/app/admin/uebersicht', sig), []);
  const [frisch] = useState<{ apiSchluessel?: string } | null>(() => { const x = speicherLesen<{ apiSchluessel?: string } | null>('untplan:neuerSchluessel', null, true); speicherSchreiben('untplan:neuerSchluessel', null, true); return x; });
  const [schluessel, setSchluessel] = useState<string | null>(frisch?.apiSchluessel ?? null);
  const [schule, setSchule] = useState<{ schulname: string; schulId: string } | null>(null);
  return (
    <Geladen g={g}>{u => {
      const p = u.paket;
      const anzahl = (r: string) => u.benutzer[r] ?? 0;
      const sw = schule ?? { schulname: u.schulname, schulId: u.schulId };
      const zeile = (t: string, w: ReactNode) => <Stack direction="row" gap={2} sx={{ py: 0.75, borderTop: 1, borderColor: 'divider' }}><Typography variant="body2" color="text.secondary" sx={{ width: 130, flexShrink: 0 }}>{t}</Typography><Typography variant="body2" component="div">{w}</Typography></Stack>;
      return (
        <Stack gap={2.5}>
          {frisch && <Alert severity="success"><b>EduOrga Web ist eingerichtet.</b> Tragen Sie die Verbindungsdaten in EduOrga Studio unter <em>EduOrga Web → Einstellungen</em> ein. Der API-Schlüssel wird nur einmal angezeigt.</Alert>}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', xl: 'repeat(2, minmax(0, 1fr))' }, gap: 2.5 }}>
            <Karte titel="Verbindung mit EduOrga Studio">
              <Stack gap={2}>
                <KopierFeld label="Adresse" wert={u.adresse} />
                <KopierFeld label="Schul-ID" wert={u.schulId || ''} />
                {schluessel ? <KopierFeld label="API-Schlüssel" wert={schluessel} /> : <TextField size="small" label="API-Schlüssel" value={u.apiSchluesselGesetzt ? 'gespeichert (wird aus Sicherheitsgründen nicht angezeigt)' : 'noch nicht erzeugt'} slotProps={{ input: { readOnly: true } }} />}
                <Box><Button variant="outlined" size="small" onClick={async () => {
                  if (u.apiSchluesselGesetzt && !(await bestaetigen('Neuen API-Schlüssel erzeugen', 'Der bisherige Schlüssel wird ungültig. EduOrga Studio muss danach mit dem neuen Schlüssel eingerichtet werden.', 'Neu erzeugen'))) return;
                  try { const r = await senden<{ apiSchluessel: string }>('/api/app/admin/apischluessel', {}); setSchluessel(r.apiSchluessel); toast('Neuer Schlüssel erzeugt.'); } catch (err) { fehler(err); }
                }}>{u.apiSchluesselGesetzt ? 'Neuen Schlüssel erzeugen' : 'Schlüssel erzeugen'}</Button></Box>
                <Typography variant="body2" color="text.secondary">In EduOrga Studio unter <b>EduOrga Web → Einstellungen</b> Adresse, Schul-ID und API-Schlüssel eintragen. Danach überträgt <b>Exportieren</b> die Daten; <b>Importieren</b> holt Abwesenheiten, Raumbuchungen und Klausuren ab.</Typography>
              </Stack>
            </Karte>
            <Karte titel="Datenstand" aktion={<Button component="label" size="small" variant="outlined">Paket hochladen<input type="file" accept=".json,application/json" hidden onChange={async e => {
              const datei = e.target.files?.[0];
              if (!datei) return;
              const fd = new FormData(); fd.append('datei', datei);
              try { const r = await api<{ revision: number }>('/api/app/admin/paket', { methode: 'POST', formular: fd }); toast(`Paket übernommen (Revision ${r.revision}).`); await s.neuLaden(); void g.neu(); } catch (err) { fehler(err); }
              e.target.value = '';
            }} /></Button>}>
              {p ? <Box>
                {zeile('Empfangen', kurzZeit(p.empfangen))}
                {zeile('Revision', <>{p.revision}{p.programmversion && <Typography component="span" variant="body2" color="text.secondary"> · EduOrga Studio {p.programmversion}</Typography>}</>)}
                {zeile('Schuljahr', p.schuljahr)}
                {zeile('Zeitraum', p.von ? `${datumDe(p.von)} – ${datumDe(p.bis)}` : '–')}
                {zeile('Stammdaten', `${p.klassen} Klassen, ${p.lehrer} Lehrkräfte, ${p.raeume} Räume`)}
                {zeile('Pläne', `${p.perioden} Perioden, ${p.tage} tagesaktuelle Tage, ${p.vertretungen} Vertretungen`)}
                {zeile('Benutzer', `${anzahl('lehrer') + anzahl('leitung') + anzahl('admin')} Kollegium, ${anzahl('schueler')} Klassenkonten`)}
                {zeile('Rückmeldungen', u.offeneRueckmeldungen ? <Button size="small" href="#/admin/rueckmeldungen" sx={{ p: 0, minWidth: 0 }}>{u.offeneRueckmeldungen} offen</Button> : 'keine offenen')}
              </Box> : <Typography color="text.secondary">Noch keine Daten empfangen.</Typography>}
            </Karte>
            <Karte titel="Schule">
              <Stack gap={2}>
                <Stack direction="row" gap={2}>
                  <TextField label="Name der Schule" value={sw.schulname} onChange={e => setSchule({ ...sw, schulname: e.target.value })} required sx={{ flex: 2 }} />
                  <TextField label="Schul-ID" value={sw.schulId} onChange={e => setSchule({ ...sw, schulId: e.target.value })} helperText="Kleinbuchstaben, Ziffern und Bindestriche" sx={{ flex: 1 }} />
                </Stack>
                <Stack direction="row" alignItems="center"><Button variant="contained" disabled={!schule} onClick={async () => {
                  try { await senden('/api/app/admin/schule', sw, 'PUT'); toast('Gespeichert.'); setSchule(null); await s.neuLaden(); void g.neu(); } catch (err) { fehler(err); }
                }}>Speichern</Button><Box sx={{ flex: 1 }} /><Typography variant="caption" color="text.secondary">Version {u.version ?? ''}</Typography></Stack>
              </Stack>
            </Karte>
            <UpdateKarte />
          </Box>
        </Stack>
      );
    }}</Geladen>
  );
}

function UpdateKarte() {
  const [neu, setNeu] = useState(0);
  const [hinweise, setHinweise] = useState(false);
  const g = useLaden(async sig => { const u = await holen<Updatestand>(`/api/app/admin/update${neu ? '?neu=1' : ''}`, sig); updatestandSetzen(u); return u; }, [neu]);
  return (
    <Karte titel="Version & Updates" aktion={<Tooltip title="Erneut prüfen"><IconButton onClick={() => setNeu(n => n + 1)} disabled={g.laedt}><RefreshRounded /></IconButton></Tooltip>}>
      <Geladen g={g}>{u => (
        <Stack gap={0.5}>
          <Typography variant="body2">EduOrga Web <b>{u.version}</b></Typography>
          <Typography variant="body2" component="div">Neueste: {!u.pruefungAktiv ? <Typography component="span" variant="body2" color="text.secondary">Prüfung abgeschaltet</Typography>
            : u.fehler ? <Typography component="span" variant="body2" color="error">{u.fehler}</Typography>
            : u.updateVerfuegbar ? <><Plakette ton="pruefung">Update verfügbar</Plakette> {u.neueste} · <Link component="button" variant="body2" onClick={() => setHinweise(true)} sx={{ verticalAlign: 'baseline' }}>Versionshinweise</Link></>
            : <><Plakette ton="ok">aktuell</Plakette> <Typography component="span" variant="body2" color="text.secondary">neueste: {u.neueste ?? '–'}</Typography></>}</Typography>
          {u.geprueft && <Typography variant="caption" color="text.secondary">geprüft {new Date(u.geprueft).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</Typography>}
          {u.mobil && <Typography variant="body2">EduOrga Mobile {u.mobil.version}{u.mobil.updateVerfuegbar && <Plakette ton="pruefung" sx={{ ml: 1 }}>Update verfügbar</Plakette>}</Typography>}
          <Typography variant="body2">Datenbank {u.datenbank} <Typography component="span" variant="body2" color="text.secondary">· Schemastand {u.schemastand}</Typography></Typography>
          {u.angefordert && <Typography variant="body2">Angefordert: {u.angefordert} – wartet auf das Update-Skript</Typography>}
          <Box sx={{ mt: 1.5 }}>{u.installierbar ? (
            <Button variant={u.updateVerfuegbar ? 'contained' : 'outlined'} onClick={async () => { if (await updateInstallieren()) void g.neu(); }}>Update installieren</Button>
          ) : <>
            <Typography variant="caption" color="text.secondary">Update auf dem Server (Sicherung vorher, Migrationen laufen beim Start automatisch):</Typography>
            <Box component="code" sx={{ display: 'block', p: 1.25, mt: 0.5, bgcolor: 'action.hover', borderRadius: 1.5, fontSize: 12.5, userSelect: 'all', overflowWrap: 'anywhere' }}>{u.befehl}</Box>
          </>}</Box>
          <UpdateDialog stand={u} offen={hinweise} schliessen={() => setHinweise(false)} />
        </Stack>
      )}</Geladen>
    </Karte>
  );
}

// ------------------------------------------------------------------ Rückmeldungen

function Rueckmeldungen() {
  const g = useLaden(sig => holen<(Meldung & { absender: string })[]>('/api/app/admin/rueckmeldungen', sig), []);
  return (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Rückmeldungen holt EduOrga Studio beim Datenaustausch ab und quittiert sie nach der Übernahme. Der Status kann hier bei Bedarf manuell geändert werden.</Typography>
      <Geladen g={g}>{l => (
        <Tabelle zeilen={l} schluessel={m => m.id} leer="Keine Rückmeldungen."
          spalten={[
            { id: 'm', kopf: 'Meldung', zelle: m => <Box>{meldungText(m)}{m.text && m.typ !== 'nachricht' && <Typography variant="body2" color="text.secondary">{m.text}</Typography>}</Box> },
            { id: 'von', kopf: 'Von', zelle: m => m.absender },
            { id: 'erstellt', kopf: 'Erstellt', nowrap: true, sortWert: m => m.erstellt ?? '', zelle: m => kurzZeit(m.erstellt) },
            { id: 'status', kopf: 'Status', zelle: m => <MeldungStatus s={m.status} /> },
            { id: 'akt', kopf: '', rechts: true, nowrap: true, zelle: m => (
              <Stack direction="row" gap={0.5} justifyContent="flex-end">
                <TextField select size="small" value={m.status} onChange={async e => { try { await senden(`/api/app/admin/rueckmeldungen/${encodeURIComponent(m.id)}`, { status: e.target.value }, 'PUT'); toast('Gespeichert.'); void g.neu(); } catch (err) { fehler(err); } }} sx={{ width: 130 }}>
                  {['offen', 'quittiert', 'abgelehnt'].map(x => <MenuItem key={x} value={x}>{x}</MenuItem>)}
                </TextField>
                <IconButton size="small" color="error" aria-label="Löschen" onClick={async () => { if (!(await bestaetigen('Rückmeldung löschen', 'Diese Rückmeldung endgültig löschen?'))) return; await loeschen(`/api/app/admin/rueckmeldungen/${encodeURIComponent(m.id)}`); void g.neu(); }}><DeleteOutlineRounded fontSize="small" /></IconButton>
              </Stack>
            ) },
          ]} />
      )}</Geladen>
    </>
  );
}

// ------------------------------------------------------------------ Nachrichten zum Tag

const ZIELGRUPPEN: Record<string, string> = { alle: 'Alle', lehrer: 'Nur Kollegium', schueler: 'Nur Schüler' };
interface Nachricht { id: number; von: string; bis: string; wochentag: number; betreff: string; text: string; zielgruppe: string; oeffentlich: boolean; startseite: boolean; mobil: boolean; monitor: boolean; aufgefaechert: boolean; reihenfolge: number }

function Nachrichten() {
  const g = useLaden(sig => holen<Nachricht[]>('/api/app/admin/nachrichten', sig), []);
  const [form, setForm] = useState<Partial<Nachricht> | null>(null);
  const heute = heuteIso();
  return (
    <>
      <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap" sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 280 }}>Nachrichten erscheinen im Vertretungsplan sowie wahlweise auf der Übersicht und den Monitoren. Tagestexte aus EduOrga Studio werden zusätzlich angezeigt.</Typography>
        <Button variant="outlined" href="#/heute">Startseite ansehen</Button>
        <Button variant="contained" onClick={() => setForm({})}>Nachricht</Button>
      </Stack>
      <Geladen g={g}>{l => (
        <Tabelle zeilen={l} schluessel={n => n.id} leer="Keine Nachrichten." onZeile={n => setForm(n)} zeilenSx={n => (n.bis < heute ? { opacity: 0.55 } : {})}
          spalten={[
            { id: 'zeit', kopf: 'Zeitraum', nowrap: true, sortWert: n => n.von, zelle: n => `${datumDe(n.von)}${n.bis !== n.von ? ` – ${datumDe(n.bis)}` : ''}` },
            { id: 'wt', kopf: 'Wochentag', zelle: n => (n.wochentag ? WOCHENTAGE[n.wochentag - 1] : 'jeden Tag'), verbergenMobil: true },
            { id: 'text', kopf: 'Betreff / Text', zelle: n => <Box>{n.betreff && <b>{n.betreff}</b>}<Typography variant="body2" sx={{ maxWidth: 520, whiteSpace: 'pre-line' }}>{n.text}</Typography></Box> },
            { id: 'fuer', kopf: 'Für', zelle: n => ZIELGRUPPEN[n.zielgruppe] ?? n.zielgruppe },
            { id: 'oeff', kopf: 'Öffentlich', zelle: n => (n.oeffentlich ? 'Ja' : 'Nein'), verbergenMobil: true },
            { id: 'bereich', kopf: 'Anzeigebereich', zelle: n => ['Vertretungsplan', n.startseite ? 'Startseite' : '', n.mobil ? 'Mobil' : '', n.monitor ? 'Monitor' : ''].filter(Boolean).join(', '), verbergenMobil: true },
            { id: 'akt', kopf: '', rechts: true, zelle: n => <IconButton size="small" color="error" aria-label="Löschen" onClick={async e => { e.stopPropagation(); if (!(await bestaetigen('Nachricht löschen', 'Diese Nachricht löschen?'))) return; await loeschen(`/api/app/admin/nachrichten/${n.id}`); void g.neu(); }}><DeleteOutlineRounded fontSize="small" /></IconButton> },
          ]} />
      )}</Geladen>
      {form && <NachrichtFormular n={form} onClose={() => setForm(null)} fertig={() => void g.neu()} />}
    </>
  );
}

function NachrichtFormular({ n, onClose, fertig }: { n: Partial<Nachricht>; onClose: () => void; fertig: () => void }) {
  const [w, setW] = useState({ von: n.von ?? heuteIso(), bis: n.bis ?? heuteIso(), zielgruppe: n.zielgruppe ?? 'alle', wochentag: n.wochentag ?? 0, reihenfolge: n.reihenfolge ?? 10, betreff: n.betreff ?? '', text: n.text ?? '',
    aufgefaechert: n.aufgefaechert ?? true, oeffentlich: !!n.oeffentlich, startseite: n.startseite ?? true, mobil: n.mobil ?? true, monitor: n.monitor ?? true });
  const chk = (k: 'aufgefaechert' | 'oeffentlich' | 'startseite' | 'mobil' | 'monitor', label: string) => <FormControlLabel control={<Checkbox checked={w[k]} onChange={e => setW({ ...w, [k]: e.target.checked })} />} label={label} />;
  return (
    <FormDialog offen titel={n.id ? 'Nachricht bearbeiten' : 'Neue Nachricht'} breite="md" onClose={onClose} aktion={async () => {
      if (!w.text.trim()) { toast('Bitte einen Text eingeben.', true); return false; }
      await senden(n.id ? `/api/app/admin/nachrichten/${n.id}` : '/api/app/admin/nachrichten', w, n.id ? 'PUT' : 'POST');
      toast('Gespeichert.'); fertig();
    }}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        <Stack direction="row" gap={2} flexWrap="wrap">
          <DatumFeld label="Von" wert={w.von} onWert={v => v && setW({ ...w, von: v, bis: w.bis < v ? v : w.bis })} pflicht />
          <DatumFeld label="Bis" wert={w.bis} onWert={v => v && setW({ ...w, bis: v })} pflicht />
          <Wahl label="Für" wert={w.zielgruppe} onWert={v => setW({ ...w, zielgruppe: v })} optionen={Object.entries(ZIELGRUPPEN)} />
          <Wahl label="Wochentag" wert={w.wochentag} onWert={v => setW({ ...w, wochentag: Number(v) })} optionen={[[0, 'jeden Tag'], ...WOCHENTAGE.map((t, i) => [i + 1, t] as [number, string])]} />
          <TextField type="number" label="Reihenfolge" value={w.reihenfolge} onChange={e => setW({ ...w, reihenfolge: Number(e.target.value) || 10 })} sx={{ width: 130 }} />
        </Stack>
        <TextField label="Betreff (optional)" value={w.betreff} onChange={e => setW({ ...w, betreff: e.target.value })} slotProps={{ htmlInput: { maxLength: 200 } }} />
        <TextField label="Text" value={w.text} onChange={e => setW({ ...w, text: e.target.value })} multiline minRows={4} required />
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <Stack sx={{ flex: 1 }}>{chk('aufgefaechert', 'Aufgefächert anzeigen')}{chk('oeffentlich', 'Öffentlich (RSS-Feed)')}</Stack>
          <Stack sx={{ flex: 1 }}><Typography variant="overline" color="text.secondary">Anzeigebereich</Typography>{chk('startseite', 'Startseite „Heute“')}{chk('mobil', 'EduOrga Mobile')}{chk('monitor', 'Monitore')}</Stack>
        </Stack>
      </Stack>
    </FormDialog>
  );
}

// ------------------------------------------------------------------ Monitore

interface Monitor { id: number; name: string; version: string; tage: number; link: string }

function Monitore() {
  const g = useLaden(sig => holen<Monitor[]>('/api/app/admin/monitore', sig), []);
  const [form, setForm] = useState<Partial<Monitor> | null>(null);
  return (
    <Stack gap={2.5}>
      <Einstellung bereich="monitor" titel="Darstellung" felder={[
        { name: 'ticker', typ: 'schalter', label: 'Nachrichten zum Tag als Laufschrift (Ticker)' }, { name: 'kopfzeile', typ: 'schalter', label: 'Nachrichten zum Tag in der Kopfzeile' },
        { name: 'nurOeffentlich', typ: 'schalter', label: 'Nur öffentliche Nachrichten anzeigen' }, { name: 'aktualisierung', typ: 'zahl', label: 'Aktualisierung [Sekunden]', min: 15, max: 3600 }]} />
      <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap">
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 280 }}>Ein Monitor zeigt den Vertretungsplan ohne Anmeldung über einen geheimen Link an, z. B. im Eingangsbereich (Browser im Vollbild).</Typography>
        <Button variant="contained" onClick={() => setForm({})}>Monitor</Button>
      </Stack>
      <Geladen g={g}>{l => (
        <Tabelle zeilen={l} schluessel={m => m.id} leer="Noch keine Monitore." onZeile={m => setForm(m)}
          spalten={[
            { id: 'name', kopf: 'Name', zelle: m => <b>{m.name}</b> },
            { id: 'version', kopf: 'Version', zelle: m => (m.version === 'lehrer' ? 'Lehrerversion' : 'Schülerversion') },
            { id: 'tage', kopf: 'Tage', rechts: true, zelle: m => m.tage },
            { id: 'link', kopf: 'Link', zelle: m => <Box sx={{ minWidth: 280 }} onClick={e => e.stopPropagation()}><KopierFeld wert={m.link} /></Box> },
            { id: 'akt', kopf: '', rechts: true, nowrap: true, zelle: m => <Stack direction="row" justifyContent="flex-end" onClick={e => e.stopPropagation()}>
              <Tooltip title="Öffnen"><IconButton size="small" href={m.link} target="_blank" rel="noopener"><OpenInNewRounded fontSize="small" /></IconButton></Tooltip>
              <IconButton size="small" color="error" aria-label="Löschen" onClick={async () => { if (!(await bestaetigen('Monitor löschen', 'Der Link wird ungültig. Fortfahren?'))) return; await loeschen(`/api/app/admin/monitore/${m.id}`); void g.neu(); }}><DeleteOutlineRounded fontSize="small" /></IconButton>
            </Stack> },
          ]} />
      )}</Geladen>
      {form && <MonitorFormular m={form} onClose={() => setForm(null)} fertig={() => void g.neu()} />}
    </Stack>
  );
}

function MonitorFormular({ m, onClose, fertig }: { m: Partial<Monitor>; onClose: () => void; fertig: () => void }) {
  const [w, setW] = useState({ name: m.name ?? '', version: m.version ?? 'schueler', tage: m.tage ?? 2 });
  return (
    <FormDialog offen titel={m.id ? 'Monitor bearbeiten' : 'Neuer Monitor'} onClose={onClose} aktion={async () => {
      if (!w.name.trim()) { toast('Bitte einen Namen eingeben.', true); return false; }
      await senden(m.id ? `/api/app/admin/monitore/${m.id}` : '/api/app/admin/monitore', w, m.id ? 'PUT' : 'POST'); toast('Gespeichert.'); fertig();
    }}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        <TextField label="Name" value={w.name} onChange={e => setW({ ...w, name: e.target.value })} placeholder="z. B. Foyer" required />
        <Stack direction="row" gap={2}>
          <TextField select label="Version" value={w.version} onChange={e => setW({ ...w, version: e.target.value })} sx={{ flex: 1 }}><MenuItem value="schueler">Schülerversion</MenuItem><MenuItem value="lehrer">Lehrerversion (Lehrerzimmer)</MenuItem></TextField>
          <TextField type="number" label="Anzahl Tage" value={w.tage} onChange={e => setW({ ...w, tage: Number(e.target.value) || 1 })} slotProps={{ htmlInput: { min: 1, max: 5 } }} sx={{ width: 130 }} />
        </Stack>
      </Stack>
    </FormDialog>
  );
}

// ------------------------------------------------------------------ Protokoll

function Protokoll() {
  const g = useLaden(sig => holen<{ zeit: string; benutzer: string; aktion: string; details: string }[]>('/api/app/admin/protokoll', sig), []);
  return (
    <Geladen g={g}>{l => (
      <Tabelle zeilen={l} schluessel={(_, i) => i} leer="Noch keine Einträge." max={300}
        spalten={[
          { id: 'zeit', kopf: 'Zeit', nowrap: true, zelle: p => <Typography variant="body2" color="text.secondary">{p.zeit}</Typography> },
          { id: 'benutzer', kopf: 'Benutzer', zelle: p => p.benutzer },
          { id: 'aktion', kopf: 'Aktion', zelle: p => <b>{p.aktion}</b> },
          { id: 'details', kopf: 'Details', zelle: p => <Typography variant="body2" color="text.secondary">{p.details}</Typography> },
        ]} />
    )}</Geladen>
  );
}

// ------------------------------------------------------------------ Freie Tage & Ferien

const FREIART: Record<string, string> = { frei: 'Unterrichtsfrei', ferien: 'Ferien', feiertag: 'Feiertag' };
interface Frei { id: number; name: string; art: string; von: string; bis: string }

function FreieTage() {
  const g = useLaden(sig => holen<{ eigene: Frei[]; ausUntPlan: { name: string; feiertag: boolean; von: string; bis: string }[] }>('/api/app/admin/freietage', sig), []);
  const [form, setForm] = useState<Partial<Frei> | null>(null);
  return (
    <Stack gap={2.5}>
      <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap">
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 280 }}>Ferien und Feiertage kommen aus EduOrga Studio. Hier lassen sich zusätzliche unterrichtsfreie Tage eintragen (z. B. pädagogischer Tag, beweglicher Ferientag) – sie erscheinen sofort in allen Plänen, im Vertretungsplan und im Klassenbuch.</Typography>
        <Button variant="contained" onClick={() => setForm({})}>Neu</Button>
      </Stack>
      <Geladen g={g}>{d => (
        <>
          <Typography variant="h3">In EduOrga Web eingetragen</Typography>
          <Tabelle zeilen={d.eigene} schluessel={f => f.id} leer="Keine zusätzlichen freien Tage." onZeile={f => setForm(f)}
            spalten={[
              { id: 'name', kopf: 'Bezeichnung', zelle: f => <b>{f.name}</b> }, { id: 'art', kopf: 'Art', zelle: f => FREIART[f.art] ?? f.art },
              { id: 'von', kopf: 'Von', sortWert: f => f.von, zelle: f => datumDe(f.von) }, { id: 'bis', kopf: 'Bis', zelle: f => datumDe(f.bis) },
              { id: 'akt', kopf: '', rechts: true, zelle: f => <IconButton size="small" color="error" aria-label="Löschen" onClick={async e => { e.stopPropagation(); if (!(await bestaetigen('Freien Tag löschen', 'Diesen Eintrag löschen?'))) return; await loeschen(`/api/app/admin/freietage/${f.id}`); void g.neu(); }}><DeleteOutlineRounded fontSize="small" /></IconButton> },
            ]} />
          <Typography variant="h3">Aus EduOrga Studio übertragen</Typography>
          <Tabelle zeilen={d.ausUntPlan} schluessel={(_, i) => i} leer="Keine Ferien übertragen."
            spalten={[{ id: 'name', kopf: 'Bezeichnung', zelle: f => f.name }, { id: 'art', kopf: 'Art', zelle: f => (f.feiertag ? 'Feiertag' : 'Ferien') },
              { id: 'von', kopf: 'Von', zelle: f => datumDe(f.von) }, { id: 'bis', kopf: 'Bis', zelle: f => datumDe(f.bis) }]} />
        </>
      )}</Geladen>
      {form && <FreiFormular f={form} onClose={() => setForm(null)} fertig={() => void g.neu()} />}
    </Stack>
  );
}

function FreiFormular({ f, onClose, fertig }: { f: Partial<Frei>; onClose: () => void; fertig: () => void }) {
  const [w, setW] = useState({ name: f.name ?? '', art: f.art ?? 'frei', von: f.von ?? heuteIso(), bis: f.bis ?? heuteIso() });
  return (
    <FormDialog offen titel={f.id ? 'Freien Tag bearbeiten' : 'Freien Tag eintragen'} aktionText={f.id ? 'Speichern' : 'Erstellen'} onClose={onClose} aktion={async () => {
      if (!w.name.trim()) { toast('Bitte eine Bezeichnung eingeben.', true); return false; }
      await senden(f.id ? `/api/app/admin/freietage/${f.id}` : '/api/app/admin/freietage', w, f.id ? 'PUT' : 'POST'); toast('Gespeichert.'); fertig();
    }}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        <TextField label="Bezeichnung" value={w.name} onChange={e => setW({ ...w, name: e.target.value })} placeholder="z. B. Pädagogischer Tag" required />
        <Stack direction="row" gap={2} flexWrap="wrap">
          <Wahl label="Art" wert={w.art} onWert={v => setW({ ...w, art: v })} optionen={Object.entries(FREIART)} breite={170} />
          <DatumFeld label="Von" wert={w.von} onWert={v => v && setW({ ...w, von: v, bis: w.bis < v ? v : w.bis })} pflicht />
          <DatumFeld label="Bis" wert={w.bis} onWert={v => v && setW({ ...w, bis: v })} pflicht />
        </Stack>
      </Stack>
    </FormDialog>
  );
}

// ------------------------------------------------------------------ Import (Benutzer aus CSV) und Export

interface ImportZeile { zeile: number; login: string; anzeigename: string; rolle: string; element: string; email: string; fehler?: string; vorhanden?: boolean }

function Import({ teil }: { teil?: string }) {
  const reiter = teil === 'schueler' ? 'schueler' : 'benutzer';
  const [pruefung, setPruefung] = useState<{ neu: number; vorhanden: number; fehler: number; zeilen: ImportZeile[] } | null>(null);
  const [ersetzen, setErsetzen] = useState(false);
  const [ergebnis, setErgebnis] = useState<{ neu: unknown[]; aktualisiert: number; uebersprungen: number; csv: string } | null>(null);
  return (
    <>
      <Stack direction="row" gap={1} sx={{ mb: 2.5 }}>
        <Button variant={reiter === 'benutzer' ? 'contained' : 'outlined'} href="#/admin/import">Benutzer</Button>
        <Button variant={reiter === 'schueler' ? 'contained' : 'outlined'} href="#/admin/import/schueler">Schüler*innen</Button>
      </Stack>
      {reiter === 'schueler' ? <SchuelerImport /> : (
        <Stack gap={2.5}>
          <Karte titel="Benutzer importieren (CSV)">
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Spalten: <code>Benutzername;Name;Rolle;Kürzel;E-Mail;Passwort</code> (Semikolon oder Komma, UTF-8 oder Windows-1252, erste Zeile darf eine Kopfzeile sein). Rolle: Administration, Schulleitung, Lehrkraft oder Klasse. Ohne Passwort wird ein Startpasswort erzeugt, das bei der ersten Anmeldung geändert werden muss.</Typography>
            <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap">
              <Button component="label" variant="outlined">Datei wählen und prüfen<input type="file" accept=".csv,text/csv,text/plain" hidden onChange={async e => {
                const datei = e.target.files?.[0];
                if (!datei) return;
                const fd = new FormData(); fd.append('datei', datei);
                try { setPruefung(await api('/api/app/admin/import/pruefen', { methode: 'POST', formular: fd })); } catch (err) { fehler(err); }
                e.target.value = '';
              }} /></Button>
              <FormControlLabel control={<Checkbox checked={ersetzen} onChange={e => setErsetzen(e.target.checked)} />} label="Vorhandene Konten aktualisieren (Ersetzen)" />
            </Stack>
          </Karte>
          {pruefung && (
            <Karte titel={<Stack direction="row" gap={1} alignItems="center" component="span">Vorschau <Plakette ton="ok">{pruefung.neu} neu</Plakette><Plakette>{pruefung.vorhanden} vorhanden</Plakette>{pruefung.fehler > 0 && <Plakette ton="entfall">{pruefung.fehler} Fehler</Plakette>}</Stack>}
              aktion={<Button variant="contained" disabled={pruefung.fehler > 0} title={pruefung.fehler ? 'Bitte zuerst die Fehler in der Datei beheben' : ''} onClick={async () => {
                if (ersetzen && !(await bestaetigen('Konten aktualisieren', 'Vorhandene Konten werden mit Name, Rolle, Kürzel und E-Mail aus der Datei überschrieben. Fortfahren?', 'Übernehmen'))) return;
                try { setErgebnis(await senden('/api/app/admin/import/uebernehmen', { zeilen: pruefung.zeilen, ersetzen })); setPruefung(null); } catch (err) { fehler(err); }
              }}>Übernehmen</Button>}>
              <Tabelle zeilen={pruefung.zeilen.slice(0, 500)} schluessel={z => z.zeile} dicht zeilenSx={z => (z.fehler ? { bgcolor: 'error.light', '& td': { color: 'error.contrastText' } } : {})}
                spalten={[{ id: 'z', kopf: 'Zeile', zelle: z => z.zeile }, { id: 'l', kopf: 'Benutzername', zelle: z => <b>{z.login}</b> }, { id: 'n', kopf: 'Name', zelle: z => z.anzeigename },
                  { id: 'r', kopf: 'Rolle', zelle: z => ROLLEN[z.rolle] ?? z.rolle }, { id: 'k', kopf: 'Kürzel', zelle: z => z.element }, { id: 'e', kopf: 'E-Mail', zelle: z => z.email },
                  { id: 'h', kopf: 'Hinweis', zelle: z => z.fehler ?? (z.vorhanden ? 'vorhanden' : 'neu') }]} />
            </Karte>
          )}
          <Typography variant="body2" color="text.secondary">Stammdaten (Lehrkräfte, Fächer, Klassen, Räume) und Pausenaufsichten werden nicht hier importiert: sie kommen bei jeder Übertragung aus EduOrga Studio.</Typography>
          {ergebnis && (
            <FormDialog offen titel="Import abgeschlossen" onClose={() => setErgebnis(null)} links={ergebnis.neu.length > 0 && <Button onClick={() => speichern(ergebnis.csv, `import-${heuteIso()}.csv`)}>Liste herunterladen (CSV)</Button>}>
              <Typography>{ergebnis.neu.length} Konten angelegt, {ergebnis.aktualisiert} aktualisiert, {ergebnis.uebersprungen} übersprungen.</Typography>
              {ergebnis.neu.length > 0 && <Alert severity="warning" sx={{ mt: 2 }}>Die Startpasswörter werden nur jetzt angezeigt. Bitte die Liste herunterladen.</Alert>}
            </FormDialog>
          )}
        </Stack>
      )}
    </>
  );
}

function Export() {
  const laden = async (id: string) => {
    let zeilen: unknown[][];
    if (id === 'benutzer') zeilen = [['Benutzername', 'Name', 'Rolle', 'Kürzel', 'E-Mail', 'gesperrt', 'erstellt', 'Letzte Anmeldung'],
      ...(await holen<{ login: string; anzeigename: string; rollenname: string; element: string; email: string; gesperrt: boolean; erstellt: string; letzteAnmeldung?: string }[]>('/api/app/admin/benutzer')).map(u => [u.login, u.anzeigename, u.rollenname, u.element, u.email, u.gesperrt ? 'ja' : 'nein', u.erstellt, u.letzteAnmeldung ?? ''])];
    else if (id === 'rollen') {
      const k = await holen<{ rechte: { id: string; gruppe: string; name: string; zweistufig: boolean }[]; profile: { name: string; system: boolean; basisName: string; benutzer: number; beschreibung: string; rechte: Record<string, number> }[] }>('/api/app/admin/rechte/katalog');
      const stufe = (r: { zweistufig: boolean }, s: number) => (s === 0 ? 'Nein' : s === 1 ? 'Lesen' : r.zweistufig ? 'Schreiben' : 'Ja');
      zeilen = [['Rolle', 'Art', 'Basisrolle', 'Benutzer', 'Beschreibung', ...k.rechte.map(r => `${r.gruppe}: ${r.name}`)],
        ...k.profile.map(p => [p.name, p.system ? 'Systemrolle' : 'eigene Rolle', p.basisName, p.benutzer, p.beschreibung, ...k.rechte.map(r => stufe(r, p.rechte[r.id] ?? 0))])];
    } else if (id === 'nachrichten') zeilen = [['Von', 'Bis', 'Wochentag', 'Betreff', 'Text', 'Für', 'Öffentlich', 'Startseite', 'Monitor'],
      ...(await holen<Nachricht[]>('/api/app/admin/nachrichten')).map(n => [n.von, n.bis, n.wochentag ? WOCHENTAGE[n.wochentag - 1] : 'jeden Tag', n.betreff, n.text, n.zielgruppe, n.oeffentlich ? 'ja' : 'nein', n.startseite ? 'ja' : 'nein', n.monitor ? 'ja' : 'nein'])];
    else if (id === 'rueckmeldungen') zeilen = [['Meldung', 'Von', 'Erstellt', 'Status'], ...(await holen<(Meldung & { absender: string })[]>('/api/app/admin/rueckmeldungen')).map(m => [meldungText(m), m.absender, m.erstellt, m.status])];
    else zeilen = [['Zeit', 'Benutzer', 'Aktion', 'Details'], ...(await holen<{ zeit: string; benutzer: string; aktion: string; details: string }[]>('/api/app/admin/protokoll')).map(p => [p.zeit, p.benutzer, p.aktion, p.details])];
    speichern(csv(zeilen), `${id}-${heuteIso()}.csv`);
  };
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
      {[['benutzer', 'Benutzer', 'Alle Benutzerkonten mit Rolle, Kürzel, E-Mail und letzter Anmeldung.'], ['rollen', 'Rechte und Rollen', 'Alle Rollen (Rechte-Profile) mit Basisrolle, Anzahl der Benutzer und Stufe je Recht.'],
        ['nachrichten', 'Nachrichten zum Tag', 'Alle Nachrichten mit Zeitraum, Betreff und Anzeigebereich.'], ['rueckmeldungen', 'Rückmeldungen', 'Meldungen an EduOrga Studio (Abwesenheiten, Buchungen, Klausuren).'],
        ['protokoll', 'Protokoll', 'Die letzten 300 Einträge des Protokolls.']].map(([id, t, x]) => (
        <Karte key={id} titel={t}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{x}</Typography>
          <Button variant="outlined" onClick={() => laden(id).catch(fehler)}>CSV herunterladen</Button>
        </Karte>
      ))}
    </Box>
  );
}
