// Mein Profil: Reiter „Allgemein“ (E-Mail, Sprache, Benachrichtigungen, Passwort ändern) und „Freigaben“
// (Kalenderabo des eigenen Stundenplans, gemerkte Konten auf diesem Gerät).
import { useEffect, useState } from 'react';
import { Box, Button, Checkbox, FormControlLabel, IconButton, InputAdornment, MenuItem, Paper, Stack, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import { holen, loeschen, senden } from '../../api/client';
import { useSitzung } from '../../app/sitzung';
import { Geladen, Seite } from '../../components/Seite';
import { FormDialog, Plakette } from '../../components/Bausteine';
import { bestaetigen, fehler, toast } from '../../lib/meldungen';
import { navigieren } from '../../lib/router';
import { useLaden } from '../../lib/useLaden';
import type { SeitenProps } from '../register';

interface Profil { login: string; anzeigename: string; rolle: string; element: string; kollegium: boolean; email: string; sprache: string; benachrichtigung: boolean; vorherigeAnmeldung?: string | null; ical: string }
interface Konto { id: number; login: string; rolle: string; aktuell: boolean }

export default function ProfilSeite({ teile }: SeitenProps) {
  const reiter = teile[0] === 'freigaben' ? 'freigaben' : 'allgemein';
  const g = useLaden(sig => holen<Profil>('/api/app/profil', sig), []);
  return (
    <Seite titel="Mein Profil">
      <Tabs value={reiter} onChange={(_, v) => navigieren(v === 'freigaben' ? '#/profil/freigaben' : '#/profil', true)} sx={{ mb: 2.5, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="allgemein" label="Allgemein" /><Tab value="freigaben" label="Freigaben" />
      </Tabs>
      <Geladen g={g}>{p => (reiter === 'allgemein' ? <Allgemein p={p} /> : <Freigaben p={p} />)}</Geladen>
    </Seite>
  );
}

function Allgemein({ p }: { p: Profil }) {
  const s = useSitzung();
  const [email, setEmail] = useState(p.email ?? '');
  const [sprache, setSprache] = useState(p.sprache === 'English' ? 'English' : 'Deutsch');
  const [benachrichtigung, setB] = useState(!!p.benachrichtigung);
  const [pw, setPw] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const fest = (label: string, wert: string) => <TextField label={label} value={wert} slotProps={{ input: { readOnly: true } }} sx={{ flex: '1 1 260px' }} />;
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, maxWidth: 880 }}>
      <Stack direction="row" gap={2} alignItems="center" sx={{ mb: 3 }}>
        <Box><Typography variant="overline" color="text.secondary">{p.rolle}</Typography><Typography variant="h2">{p.anzeigename || p.login}</Typography></Box>
      </Stack>
      <Stack direction="row" gap={2} flexWrap="wrap">
        {fest('Benutzername', p.login)}
        {fest(p.kollegium ? 'Lehrerkürzel' : 'Klasse', p.element || '–')}
        <TextField label="E-Mail-Adresse" type="email" value={email} onChange={e => setEmail(e.target.value)} sx={{ flex: '1 1 260px' }} />
        <TextField select label="Sprache" value={sprache} onChange={e => setSprache(e.target.value)} sx={{ flex: '1 1 260px' }}><MenuItem value="Deutsch">Deutsch</MenuItem><MenuItem value="English">English</MenuItem></TextField>
        {fest('Benutzergruppe', p.rolle)}
        {fest('Letzte Anmeldung', p.vorherigeAnmeldung ? new Date(p.vorherigeAnmeldung.replace(' ', 'T')).toLocaleString('de-DE') : '–')}
      </Stack>
      <FormControlLabel sx={{ mt: 2 }} control={<Checkbox checked={benachrichtigung} onChange={e => setB(e.target.checked)} />}
        label="Benachrichtigungen über neue Mitteilungen erhalten (Hinweis im Browser bzw. auf dem Gerät)" />
      <Stack direction="row" gap={1.5} sx={{ mt: 3 }} flexWrap="wrap">
        <Button variant="contained" disabled={laeuft} onClick={async () => {
          setLaeuft(true);
          try {
            await senden('/api/app/profil', { email, sprache, benachrichtigung }, 'PUT');
            if (benachrichtigung && 'Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch { /* nicht unterstützt */ } }
            await s.neuLaden();
            toast('Gespeichert.');
          } catch (err) { fehler(err); } finally { setLaeuft(false); }
        }}>Speichern</Button>
        <Button variant="outlined" onClick={() => setPw(true)}>Passwort ändern</Button>
      </Stack>
      {pw && <PasswortDialog onClose={() => setPw(false)} />}
    </Paper>
  );
}

function PasswortDialog({ onClose }: { onClose: () => void }) {
  const [alt, setAlt] = useState('');
  const [neu, setNeu] = useState('');
  const [neu2, setNeu2] = useState('');
  return (
    <FormDialog offen titel="Passwort ändern" onClose={onClose} aktionText="Passwort ändern" aktion={async () => {
      if (neu !== neu2) { toast('Die neuen Passwörter stimmen nicht überein.', true); return false; }
      await senden('/api/app/passwort', { alt, neu });
      toast('Passwort geändert.');
    }}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        <TextField label="Bisheriges Passwort" type="password" value={alt} onChange={e => setAlt(e.target.value)} autoComplete="current-password" required autoFocus />
        <TextField label="Neues Passwort" type="password" value={neu} onChange={e => setNeu(e.target.value)} autoComplete="new-password" required helperText="Mindestens 8 Zeichen (bzw. nach der Sicherheitsrichtlinie der Schule)." />
        <TextField label="Neues Passwort wiederholen" type="password" value={neu2} onChange={e => setNeu2(e.target.value)} autoComplete="new-password" required error={!!neu2 && neu !== neu2} />
      </Stack>
    </FormDialog>
  );
}

function Freigaben({ p }: { p: Profil }) {
  const [ical, setIcal] = useState(p.ical);
  const [konten, setKonten] = useState<Konto[]>([]);
  const laden = () => holen<Konto[]>('/api/app/konten').then(setKonten).catch(() => setKonten([]));
  useEffect(() => { void laden(); }, []);
  return (
    <Stack direction={{ xs: 'column', lg: 'row' }} gap={2.5} sx={{ maxWidth: 1100 }} alignItems="flex-start">
      {p.element && (
        <Paper variant="outlined" sx={{ p: 2.5, flex: 7, width: '100%' }}>
          <Typography variant="h3" sx={{ mb: 1 }}>Stundenplan im Kalender abonnieren</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Persönlicher Link für Outlook, Google Kalender oder das Smartphone (Stunden und Vertretungen der nächsten vier Wochen). Bitte nicht weitergeben.</Typography>
          <TextField fullWidth value={ical} slotProps={{ input: { readOnly: true, sx: { fontFamily: 'monospace', fontSize: 13 }, endAdornment: (
            <InputAdornment position="end"><Tooltip title="Kopieren"><IconButton aria-label="Kopieren" onClick={() => navigator.clipboard?.writeText(ical).then(() => toast('Link kopiert.'), () => toast('Bitte den Link manuell kopieren.', true))}><ContentCopyRounded fontSize="small" /></IconButton></Tooltip></InputAdornment>
          ) } }} />
          <Button size="small" variant="outlined" sx={{ mt: 1.5 }} onClick={async () => {
            if (!(await bestaetigen('Neuen Kalenderlink erzeugen', 'Der bisherige Link funktioniert danach nicht mehr.', 'Neu erzeugen'))) return;
            try { setIcal((await senden<{ ical: string }>('/api/app/profil/ical', {})).ical); toast('Neuer Link erzeugt.'); } catch (err) { fehler(err); }
          }}>Neuen Link erzeugen</Button>
        </Paper>
      )}
      <Paper variant="outlined" sx={{ p: 2.5, flex: 5, width: '100%' }}>
        <Typography variant="h3" sx={{ mb: 1.5 }}>Konten auf diesem Gerät</Typography>
        {konten.length ? konten.map(k => (
          <Stack key={k.id} direction="row" gap={1.5} alignItems="center" sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}>
            <Box sx={{ flex: 1 }}><Typography sx={{ fontWeight: 500 }}>{k.login}{k.aktuell && <Plakette ton="ok" sx={{ ml: 1 }}>angemeldet</Plakette>}</Typography><Typography variant="caption" color="text.secondary">{k.rolle}</Typography></Box>
            {!k.aktuell && <Button size="small" variant="outlined" onClick={async () => { try { await loeschen(`/api/app/konten/${k.id}`); void laden(); } catch (err) { fehler(err); } }}>Entfernen</Button>}
          </Stack>
        )) : <Typography variant="body2" color="text.secondary">Keine weiteren Konten gemerkt.</Typography>}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>Über das Konto-Menü unten links wechseln Sie zwischen den hier gemerkten Konten, ohne sich neu anzumelden (30 Tage).</Typography>
      </Paper>
    </Stack>
  );
}
