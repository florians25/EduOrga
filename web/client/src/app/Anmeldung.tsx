// Anmeldung, Einrichtungsassistent und Pflicht zum Passwortwechsel: zweigeteilte Seite – links die Marke auf Marine mit Schulname,
// Datum, öffentlichen Hinweisen der Schule und einer ruhigen Grafik (stilisierte Woche), rechts das Formular.
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Alert, Box, Button, Collapse, IconButton, InputAdornment, Link, Paper, Stack, Step, StepLabel, Stepper, TextField, Typography } from '@mui/material';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import CampaignOutlined from '@mui/icons-material/CampaignOutlined';
import { holen, senden } from '../api/client';
import type { Sitzung } from '../api/types';
import { Marke } from '../components/Marke';
import { datumText, heuteIso } from '../lib/datum';
import { schreiben } from '../lib/speicher';
import { farben } from '../theme';

interface Hinweis { id: number; titel: string; text: string }

function Wochengrafik() {
  // rein dekorativ: fünf Tage mit Stundenkacheln in gedämpften Tönen der Statusfarben
  const toene = ['#86a7dc', '#5582c8', '#3cc2b9', '#b6cbec', '#9f95f0'];
  const belegung = [[0, 1, 3, 4], [0, 2, 3], [1, 2, 4, 5], [0, 1, 2, 4], [0, 3, 4]];
  return (
    <Box component="svg" viewBox="0 0 400 300" aria-hidden="true" sx={{ width: '100%', maxWidth: 420, opacity: 0.95 }}>
      <rect x="0" y="0" width="400" height="300" rx="18" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.12)" />
      {[0, 1, 2, 3, 4].map(t => <rect key={t} x={22 + t * 74} y={18} width={44} height={8} rx={4} fill="rgba(255,255,255,.35)" />)}
      <line x1="10" x2="390" y1="40" y2="40" stroke="rgba(255,255,255,.14)" />
      {belegung.map((reihen, t) => reihen.map(r => (
        <g key={`${t}-${r}`}>
          <rect x={16 + t * 74} y={50 + r * 40} width={64} height={34} rx={7} fill={toene[(t + r) % toene.length]} fillOpacity={t === 2 && r === 2 ? 0.95 : 0.28} />
          <rect x={24 + t * 74} y={58 + r * 40} width={26} height={5} rx={2.5} fill="#fff" fillOpacity={0.85} />
          <rect x={24 + t * 74} y={68 + r * 40} width={38} height={4} rx={2} fill="#fff" fillOpacity={0.45} />
        </g>
      )))}
      <line x1="10" x2="390" y1="168" y2="168" stroke="#fff" strokeOpacity=".9" strokeWidth="1.5" />
      <circle cx="10" cy="168" r="4" fill="#fff" />
    </Box>
  );
}

function Rahmen({ sitzung, titel, untertitel, children }: { sitzung: Sitzung | null; titel: string; untertitel?: string; children: ReactNode }) {
  const [hinweise, setHinweise] = useState<Hinweis[]>([]);
  const schule = sitzung?.schule?.name || 'UntPlanWeb';
  useEffect(() => {
    fetch('/api/app/hinweise/oeffentlich', { credentials: 'omit', cache: 'no-store' })
      .then(r => (r.ok ? r.json() : [])).then(l => setHinweise(Array.isArray(l) ? l : [])).catch(() => undefined);
  }, []);
  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(380px, 46%) minmax(0, 1fr)' }, bgcolor: 'background.default' }}>
      <Box component="section" aria-label={schule} sx={{
        display: { xs: 'none', md: 'flex' }, flexDirection: 'column', gap: 4, p: { md: 6, lg: 8 }, color: '#fff', position: 'relative', overflow: 'hidden',
        background: `radial-gradient(1200px 600px at -10% -10%, ${farben.marine[700]} 0%, ${farben.marine[900]} 55%, #0b1a35 100%)`,
      }}>
        <Marke hell groesse={32} />
        <Box sx={{ mt: 'auto' }}>
          <Typography sx={{ display: 'inline-block', px: 1.5, py: 0.5, borderRadius: 999, bgcolor: 'rgba(255,255,255,.1)', fontSize: 13, fontWeight: 500, mb: 2 }}>{datumText(heuteIso())}</Typography>
          <Typography component="h2" sx={{ fontSize: { md: 30, lg: 36 }, fontWeight: 600, lineHeight: 1.15, letterSpacing: '-0.015em' }}>{schule}</Typography>
          <Typography sx={{ mt: 1.5, color: 'rgba(255,255,255,.72)', fontSize: 16, maxWidth: 460 }}>Stundenplan, Vertretungen und Klassenbuch – an einem Ort, immer aktuell.</Typography>
        </Box>
        {hinweise.length > 0 && (
          <Stack gap={1.5} sx={{ maxWidth: 480 }}>
            <Typography sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }} component="h2">Hinweise der Schule</Typography>
            {hinweise.map(h => (
              <Box key={h.id} sx={{ display: 'flex', gap: 1.5, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)' }}>
                <CampaignOutlined sx={{ color: 'rgba(255,255,255,.8)' }} />
                <Box><Typography sx={{ fontWeight: 600 }}>{h.titel}</Typography>{h.text && <Typography sx={{ color: 'rgba(255,255,255,.75)', whiteSpace: 'pre-line', fontSize: 13, mt: 0.25 }}>{h.text}</Typography>}</Box>
              </Box>
            ))}
          </Stack>
        )}
        <Box sx={{ mt: 'auto', mb: 2 }}><Wochengrafik /></Box>
      </Box>
      <Box component="section" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: { xs: 2, sm: 4 }, gap: 3 }}>
        <Box sx={{ display: { xs: 'block', md: 'none' }, textAlign: 'center', mt: 2 }}>
          <Box sx={{ display: 'inline-flex' }}><Marke groesse={30} /></Box>
          <Typography color="text.secondary" sx={{ mt: 1 }}>{schule}</Typography>
        </Box>
        <Paper variant="outlined" sx={{ width: '100%', maxWidth: 420, p: { xs: 3, sm: 4 }, borderRadius: 4, boxShadow: '0 12px 40px rgba(17,38,74,.08)' }}>
          <Typography variant="h2" component="h1">{titel}</Typography>
          {untertitel && <Typography color="text.secondary" sx={{ mt: 0.75 }}>{untertitel}</Typography>}
          <Box sx={{ mt: 3 }}>{children}</Box>
        </Paper>
        {hinweise.length > 0 && (
          <Stack gap={1} sx={{ width: '100%', maxWidth: 420, display: { md: 'none' } }}>
            {hinweise.map(h => <Alert key={h.id} severity="info" icon={<CampaignOutlined />}><b>{h.titel}</b>{h.text ? <> – {h.text}</> : null}</Alert>)}
          </Stack>
        )}
        <Typography variant="caption" color="text.secondary">UntPlanWeb · Webbegleiter zu UntPlan</Typography>
      </Box>
    </Box>
  );
}

function PasswortFeld({ label, name, autoComplete, autoFocus, wert, setWert, hilfe }: { label: string; name: string; autoComplete: string; autoFocus?: boolean; wert: string; setWert: (s: string) => void; hilfe?: string }) {
  const [zeigen, setZeigen] = useState(false);
  return (
    <TextField label={label} name={name} type={zeigen ? 'text' : 'password'} autoComplete={autoComplete} autoFocus={autoFocus} required fullWidth size="medium"
      value={wert} onChange={e => setWert(e.target.value)} helperText={hilfe}
      slotProps={{ input: { endAdornment: (
        <InputAdornment position="end">
          <IconButton aria-label={zeigen ? 'Passwort verbergen' : 'Passwort anzeigen'} onClick={() => setZeigen(!zeigen)} edge="end" size="small">
            {zeigen ? <VisibilityOffOutlined fontSize="small" /> : <VisibilityOutlined fontSize="small" />}
          </IconButton>
        </InputAdornment>) } }} />
  );
}

export function Anmeldung({ sitzung, fertig }: { sitzung: Sitzung | null; fertig: () => void }) {
  const [login, setLogin] = useState('');
  const [passwort, setPasswort] = useState('');
  const [meldung, setMeldung] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [vergessen, setVergessen] = useState(false);
  const [wartung, setWartung] = useState<string | null>(null);
  useEffect(() => {
    document.title = 'Anmelden – UntPlanWeb';
    holen<{ gesperrt: boolean; hinweis: string }>('/api/app/zugriff').then(z => setWartung(z.gesperrt ? z.hinweis : null)).catch(() => undefined);
  }, []);
  const absenden = async (ev: FormEvent) => {
    ev.preventDefault();
    setLaeuft(true);
    try {
      await senden('/api/app/anmelden', { login: login.trim(), passwort });
      fertig();
    } catch (err) {
      setMeldung((err as Error).message);
      setPasswort('');
    } finally { setLaeuft(false); }
  };
  return (
    <Rahmen sitzung={sitzung} titel="Anmelden" untertitel="Mit Ihrem Schulkonto weiter zu Stundenplan und Klassenbuch.">
      <Stack component="form" gap={2.25} onSubmit={absenden} autoComplete="on">
        {wartung && <Alert severity="warning" icon={<LockOutlined />}>{wartung}</Alert>}
        <TextField label="Benutzername" name="login" autoComplete="username" autoFocus required fullWidth size="medium" placeholder="z. B. mustermann"
          value={login} onChange={e => setLogin(e.target.value)} />
        <PasswortFeld label="Passwort" name="passwort" autoComplete="current-password" wert={passwort} setWert={setPasswort} />
        {meldung && <Alert severity="error">{meldung}</Alert>}
        <Button type="submit" variant="contained" size="large" disabled={laeuft} sx={{ minHeight: 46 }}>Anmelden</Button>
        <Box sx={{ textAlign: 'center' }}>
          <Link component="button" type="button" onClick={() => setVergessen(!vergessen)} aria-expanded={vergessen}>Passwort vergessen?</Link>
          <Collapse in={vergessen}><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Ein neues Passwort vergibt die Administration Ihrer Schule. Bitte wenden Sie sich dorthin.</Typography></Collapse>
        </Box>
      </Stack>
    </Rahmen>
  );
}

/** Einrichtungsassistent (erster Start ohne Konten): Schule, Administrationskonto, danach Schul-ID und API-Schlüssel für UntPlan. */
export function Einrichtung({ sitzung, fertig }: { sitzung: Sitzung | null; fertig: () => void }) {
  const [schritt, setSchritt] = useState(0);
  const [schulname, setSchulname] = useState('');
  const [login, setLogin] = useState('admin');
  const [passwort, setPasswort] = useState('');
  const [passwort2, setPasswort2] = useState('');
  const [meldung, setMeldung] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  useEffect(() => { document.title = 'Einrichtung – UntPlanWeb'; }, []);
  const absenden = async (ev: FormEvent) => {
    ev.preventDefault();
    if (schritt === 0) { if (schulname.trim()) { setSchritt(1); setMeldung(''); } return; }
    if (passwort.length < 8) return setMeldung('Das Passwort muss mindestens 8 Zeichen lang sein.');
    if (passwort !== passwort2) return setMeldung('Die Passwörter stimmen nicht überein.');
    setLaeuft(true);
    try {
      const r = await senden<{ schulId: string; apiSchluessel: string }>('/api/app/einrichten', { schulname: schulname.trim(), login: login.trim(), passwort });
      schreiben('untplan:neuerSchluessel', { schulId: r.schulId, apiSchluessel: r.apiSchluessel }, true);
      location.hash = '#/admin/sync';
      fertig();
    } catch (err) { setMeldung((err as Error).message); }
    finally { setLaeuft(false); }
  };
  return (
    <Rahmen sitzung={sitzung} titel="Ersteinrichtung" untertitel="Legen Sie die Schule und das Administrationskonto an. Danach verbinden Sie UntPlan mit Schul-ID und API-Schlüssel.">
      <Stepper activeStep={schritt} alternativeLabel sx={{ mb: 3 }}>
        {['Schule', 'Administration', 'Verbinden'].map(t => <Step key={t}><StepLabel>{t}</StepLabel></Step>)}
      </Stepper>
      <Stack component="form" gap={2.25} onSubmit={absenden}>
        {schritt === 0 ? (
          <TextField label="Name der Schule" required autoFocus fullWidth size="medium" value={schulname} onChange={e => setSchulname(e.target.value)} />
        ) : (
          <>
            <TextField label="Benutzername" required fullWidth size="medium" autoComplete="username" value={login} onChange={e => setLogin(e.target.value)} />
            <PasswortFeld label="Passwort" name="passwort" autoComplete="new-password" autoFocus wert={passwort} setWert={setPasswort} hilfe="Mindestens 8 Zeichen." />
            <PasswortFeld label="Passwort wiederholen" name="passwort2" autoComplete="new-password" wert={passwort2} setWert={setPasswort2} />
          </>
        )}
        {meldung && <Alert severity="error">{meldung}</Alert>}
        <Stack direction="row" gap={1}>
          {schritt > 0 && <Button variant="outlined" onClick={() => setSchritt(0)}>Zurück</Button>}
          <Button type="submit" variant="contained" size="large" fullWidth disabled={laeuft}>{schritt === 0 ? 'Weiter' : 'Einrichten'}</Button>
        </Stack>
      </Stack>
    </Rahmen>
  );
}

export function PasswortPflicht({ sitzung, fertig, abmelden }: { sitzung: Sitzung; fertig: () => void; abmelden: () => void }) {
  const [alt, setAlt] = useState('');
  const [neu, setNeu] = useState('');
  const [neu2, setNeu2] = useState('');
  const [meldung, setMeldung] = useState('');
  useEffect(() => { document.title = 'Passwort ändern – UntPlanWeb'; }, []);
  const absenden = async (ev: FormEvent) => {
    ev.preventDefault();
    if (neu !== neu2) return setMeldung('Die Passwörter stimmen nicht überein.');
    try { await senden('/api/app/passwort', { alt, neu }); fertig(); } catch (err) { setMeldung((err as Error).message); }
  };
  return (
    <Rahmen sitzung={sitzung} titel="Neues Passwort festlegen" untertitel="Bitte vergeben Sie vor der ersten Nutzung ein eigenes Passwort.">
      <Stack component="form" gap={2.25} onSubmit={absenden}>
        <PasswortFeld label="Bisheriges Passwort" name="alt" autoComplete="current-password" autoFocus wert={alt} setWert={setAlt} />
        <PasswortFeld label="Neues Passwort" name="neu" autoComplete="new-password" wert={neu} setWert={setNeu} hilfe="Mindestens 8 Zeichen." />
        <PasswortFeld label="Neues Passwort wiederholen" name="neu2" autoComplete="new-password" wert={neu2} setWert={setNeu2} />
        {meldung && <Alert severity="error">{meldung}</Alert>}
        <Button type="submit" variant="contained" size="large">Speichern</Button>
        <Button onClick={abmelden}>Abmelden</Button>
      </Stack>
    </Rahmen>
  );
}
