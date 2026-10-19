// Updatehinweis für die Administration: GET /api/app/admin/update (Standard: GitHub-Releases von florians25/UntPlanNext, am Server
// 6 Stunden zwischengespeichert). Ist eine neuere Version veröffentlicht, zeigen „Heute“ und „Übersicht“ einen schließbaren Hinweis
// (je Version ausblendbar, Gerätespeicher) und der Bereich „Administration“ in der Navigation einen Punkt. Der Dialog zeigt die
// Versionshinweise, den Link zum Release und – wenn ein Updater eingerichtet ist – „Update installieren“, sonst den Befehl.
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  Alert, AlertTitle, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Link, Stack, Typography,
} from '@mui/material';
import CloseRounded from '@mui/icons-material/CloseRounded';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import { holen, senden } from '../api/client';
import { bestaetigen, fehler, toast } from '../lib/meldungen';
import { lesen, schreiben } from '../lib/speicher';
import { useSitzung } from './sitzung';

export interface Updatestand {
  version: string; neueste?: string | null; pruefungAktiv: boolean; fehler?: string | null; updateVerfuegbar: boolean;
  hinweisurl?: string | null; releaseUrl?: string | null; releaseName?: string | null; veroeffentlicht?: string | null; hinweise?: string | null;
  geprueft?: string | null; installierbar: boolean; befehl: string; datenbank: string; schemastand: string | number; angefordert?: string | null;
  mobil?: { version: string; updateVerfuegbar: boolean } | null;
}

const SPEICHER = 'untplan:update-ausgeblendet';

// kleiner gemeinsamer Zustand (einmal je Sitzung geladen, von Navigation, Startseiten und Administration geteilt)
let stand: Updatestand | null = null;
let ausgeblendet: string | null = lesen<string | null>(SPEICHER, null);
let angefragt = false;
const hoerer = new Set<() => void>();
const aendern = () => hoerer.forEach(f => f());
const abonnieren = (f: () => void) => { hoerer.add(f); return () => { hoerer.delete(f); }; };

/** Stand aus der Administration übernehmen (z. B. nach „Erneut prüfen“). */
export function updatestandSetzen(s: Updatestand) { stand = s; aendern(); }

async function laden() {
  try { updatestandSetzen(await holen<Updatestand>('/api/app/admin/update')); } catch { /* kein Hinweis bei Fehlern */ }
}

/** Hinweis für diese Version ausblenden (bis eine neuere erscheint). */
function ausblenden(version?: string | null) {
  if (!version) return;
  ausgeblendet = version;
  schreiben(SPEICHER, version);
  aendern();
}

/** Updatestand für Administratoren (sonst null); neu = Hinweis für diese Version nicht ausgeblendet. */
export function useUpdatestand(): { stand: Updatestand | null; neu: boolean } {
  const { ich } = useSitzung();
  const s = useSyncExternalStore(abonnieren, () => stand);
  const weg = useSyncExternalStore(abonnieren, () => ausgeblendet);
  useEffect(() => {
    if (!ich.admin || angefragt) return;
    angefragt = true;
    void laden();
  }, [ich.admin]);
  if (!ich.admin || !s) return { stand: null, neu: false };
  return { stand: s, neu: s.updateVerfuegbar && weg !== s.neueste };
}

// ------------------------------------------------------------------ Versionshinweise (Markdown, kleiner sicherer Umfang ohne HTML)

function inline(text: string): ReactNode[] {
  const teile: ReactNode[] = [];
  let rest = 0;
  for (const m of text.matchAll(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g)) {
    if (m.index! > rest) teile.push(text.slice(rest, m.index));
    const t = m[0];
    if (t.startsWith('**')) teile.push(<strong key={m.index}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith('`')) teile.push(<Box component="code" key={m.index} sx={{ fontSize: '0.92em' }}>{t.slice(1, -1)}</Box>);
    else teile.push(<Link key={m.index} href={m[2]} target="_blank" rel="noopener noreferrer">{t.slice(1, t.indexOf(']('))}</Link>);
    rest = m.index! + t.length;
  }
  if (rest < text.length) teile.push(text.slice(rest));
  return teile;
}

export function Versionshinweise({ text }: { text: string }) {
  const bloecke: ReactNode[] = [];
  let liste: string[] = [];
  let absatz: string[] = [];
  const fertig = () => {
    if (absatz.length) bloecke.push(<Typography key={bloecke.length} variant="body2" sx={{ my: 0.75 }}>{inline(absatz.join(' '))}</Typography>);
    if (liste.length) bloecke.push(<Box component="ul" key={bloecke.length} sx={{ my: 0.5, pl: 2, typography: 'body2' }}>{liste.map((x, i) => <li key={i}>{inline(x)}</li>)}</Box>);
    absatz = []; liste = [];
  };
  for (const roh of text.split('\n')) {
    const z = roh.trimEnd();
    const kopf = /^#{1,6}\s+(.*)$/.exec(z);
    const punkt = /^\s*[-*+]\s+(.*)$/.exec(z);
    if (kopf) { fertig(); bloecke.push(<Typography key={bloecke.length} variant="subtitle2" sx={{ mt: 1.5, mb: 0.5 }}>{inline(kopf[1])}</Typography>); }
    else if (punkt) { if (absatz.length) fertig(); liste.push(punkt[1]); }
    else if (!z.trim()) fertig();
    else { if (liste.length) fertig(); absatz.push(z.trim()); }
  }
  fertig();
  return <>{bloecke}</>;
}

const datum = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

/** Update anstoßen (Watchtower bzw. Anforderungsdatei); true, wenn angestoßen. */
export async function updateInstallieren(): Promise<boolean> {
  if (!(await bestaetigen('Update installieren', 'Die Datenbank wird gesichert (SQLite) und das neueste Image geladen. EduOrga Web startet danach neu und ist kurz nicht erreichbar.', 'Installieren'))) return false;
  try { const r = await senden<{ meldung: string }>('/api/app/admin/update/installieren', {}); toast(r.meldung); return true; } catch (err) { fehler(err); return false; }
}

/** Dialog mit Versionshinweisen, Link zum Release und Update-Knopf bzw. -Befehl. */
export function UpdateDialog({ stand: u, offen, schliessen }: { stand: Updatestand; offen: boolean; schliessen: () => void }) {
  const url = u.releaseUrl ?? u.hinweisurl;
  return (
    <Dialog open={offen} onClose={schliessen} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        {u.updateVerfuegbar ? `Neue Version ${u.neueste} verfügbar` : `EduOrga Web ${u.version}`}
        <IconButton onClick={schliessen} aria-label="Schließen" sx={{ position: 'absolute', right: 12, top: 12 }}><CloseRounded /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2">
          Installiert: <b>{u.version}</b>{u.neueste && <> · Neueste: <b>{u.neueste}</b>{u.releaseName && u.releaseName !== u.neueste ? ` („${u.releaseName}“)` : ''}</>}
          {u.veroeffentlicht && <Typography component="span" variant="body2" color="text.secondary"> · veröffentlicht am {datum(u.veroeffentlicht)}</Typography>}
        </Typography>
        {u.hinweise && (
          <Box sx={{ mt: 2, px: 2, py: 0.5, maxHeight: '45vh', overflow: 'auto', bgcolor: 'action.hover', borderRadius: 1.5 }}>
            <Versionshinweise text={u.hinweise} />
          </Box>
        )}
        {!u.installierbar && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">Update auf dem Server (Sicherung vorher, Migrationen laufen beim Start automatisch):</Typography>
            <Box component="code" sx={{ display: 'block', p: 1, mt: 0.5, bgcolor: 'action.hover', borderRadius: 1.5, fontSize: 12.5, userSelect: 'all', overflowWrap: 'anywhere' }}>{u.befehl}</Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
        <Box>{url && <Button href={url} target="_blank" rel="noopener noreferrer" endIcon={<OpenInNewRounded />}>Auf GitHub ansehen</Button>}</Box>
        <Stack direction="row" gap={1}>
          {u.updateVerfuegbar && <Button onClick={() => { ausblenden(u.neueste); schliessen(); }}>Hinweis ausblenden</Button>}
          {u.installierbar && u.updateVerfuegbar
            ? <Button variant="contained" onClick={async () => { if (await updateInstallieren()) schliessen(); }}>Update installieren</Button>
            : <Button variant="contained" onClick={schliessen}>Schließen</Button>}
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

/** Hinweis auf eine neue Version (nur Administration, nur solange nicht für diese Version ausgeblendet). */
export function UpdateHinweis() {
  const { stand: u, neu } = useUpdatestand();
  const [offen, setOffen] = useState(false);
  if (!u || !neu) return null;
  return (
    <>
      <Alert severity="info" sx={{ mb: 3, alignItems: 'center' }} data-testid="update-hinweis"
        action={<>
          <Button color="inherit" size="small" onClick={() => setOffen(true)}>Versionshinweise</Button>
          {u.installierbar && <Button color="inherit" size="small" onClick={() => { void updateInstallieren(); }}>Update installieren</Button>}
          <IconButton color="inherit" size="small" aria-label="Für diese Version ausblenden" title="Für diese Version ausblenden" onClick={() => ausblenden(u.neueste)}><CloseRounded fontSize="small" /></IconButton>
        </>}>
        <AlertTitle sx={{ mb: 0 }}>Neue Version {u.neueste} verfügbar</AlertTitle>
        EduOrga Web {u.version} ist installiert{u.veroeffentlicht ? ` · veröffentlicht am ${datum(u.veroeffentlicht)}` : ''}.
      </Alert>
      <UpdateDialog stand={u} offen={offen} schliessen={() => setOffen(false)} />
    </>
  );
}
