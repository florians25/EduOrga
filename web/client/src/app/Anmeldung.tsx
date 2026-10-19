// Anmeldung, Einrichtungsassistent und Pflicht zum Passwortwechsel: zweigeteilte Seite – links die Marke EduOrga auf Petrol mit Schulname,
// Datum, Slogan „Einfach mehr Schulalltag.“ und öffentlichen Hinweisen der Schule, rechts das Formular; unten „Über EduOrga“ (Rechtshinweis).
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Alert, Box, Button, Collapse, IconButton, InputAdornment, Link, Paper, Stack, Step, StepLabel, Stepper, TextField, Typography } from '@mui/material';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { holen, senden } from '../api/client';
import type { Sitzung } from '../api/types';
import { Marke, PRODUKT, SLOGAN } from '../components/Marke';
import { UeberDialog } from '../components/Ueber';
import { datumText, heuteIso } from '../lib/datum';
import { schreiben } from '../lib/speicher';

interface Hinweis { id: number; titel: string; text: string }

function Rahmen({ sitzung, titel, untertitel, children }: { sitzung: Sitzung | null; titel: string; untertitel?: string; children: ReactNode }) {
  const [hinweise, setHinweise] = useState<Hinweis[]>([]);
  const [ueber, setUeber] = useState(false);
  const schule = sitzung?.schule?.name || PRODUKT;
  useEffect(() => {
    fetch('/api/app/hinweise/oeffentlich', { credentials: 'omit', cache: 'no-store' })
      .then(r => (r.ok ? r.json() : [])).then(l => setHinweise(Array.isArray(l) ? l : [])).catch(() => undefined);
  }, []);
  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(360px, 42%) minmax(0, 1fr)' }, bgcolor: 'background.default' }}>
      {/* links: Marke auf Petrol, Schule, Slogan, öffentliche Hinweise – ruhig, ohne Grafik */}
      <Box component="section" aria-label={schule} sx={{
        display: { xs: 'none', md: 'flex' }, flexDirection: 'column', gap: 4, p: { md: 6, lg: 8 }, color: '#fff', bgcolor: 'nav.flaeche',
      }}>
        <Marke hell groesse={32} />
        <Box sx={{ mt: 'auto' }}>
          <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,.7)', mb: 1 }}>{datumText(heuteIso())}</Typography>
          <Typography component="h2" sx={{ fontSize: { md: 24, lg: 28 }, fontWeight: 600, lineHeight: 1.25 }}>{schule}</Typography>
          <Typography sx={{ mt: 1, fontSize: 16, color: 'rgba(255,255,255,.82)' }}>{SLOGAN}</Typography>
        </Box>
        {hinweise.length > 0 && (
          <Stack gap={1} sx={{ maxWidth: 500 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.7)' }} component="h2">Hinweise der Schule</Typography>
            {hinweise.map(h => (
              <Box key={h.id} sx={{ px: 2, py: 1.5, borderRadius: 1.5, border: '1px solid rgba(255,255,255,.16)' }}>
                <Box><Typography sx={{ fontWeight: 600 }}>{h.titel}</Typography>{h.text && <Typography sx={{ color: 'rgba(255,255,255,.78)', whiteSpace: 'pre-line', fontSize: 13, mt: 0.25 }}>{h.text}</Typography>}</Box>
              </Box>
            ))}
          </Stack>
        )}
        <Typography sx={{ mt: 'auto', fontSize: 12, color: 'rgba(255,255,255,.55)' }}>{PRODUKT}</Typography>
      </Box>
      <Box component="section" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: { xs: 2, sm: 4 }, gap: 2 }}>
        <Box sx={{ display: { xs: 'block', md: 'none' }, textAlign: 'center', mt: 2 }}>
          <Box sx={{ display: 'inline-flex' }}><Marke groesse={32} /></Box>
          <Typography sx={{ mt: 1, fontWeight: 500 }}>{SLOGAN}</Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>{schule}</Typography>
        </Box>
        <Paper variant="outlined" sx={{ width: '100%', maxWidth: 400, p: { xs: 2, sm: 3 } }}>
          <Typography variant="h2" component="h1">{titel}</Typography>
          {untertitel && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{untertitel}</Typography>}
          <Box sx={{ mt: 3 }}>{children}</Box>
        </Paper>
        {hinweise.length > 0 && (
          <Stack gap={1} sx={{ width: '100%', maxWidth: 420, display: { md: 'none' } }}>
            {hinweise.map(h => <Alert key={h.id} severity="info" icon={false}><b>{h.titel}</b>{h.text ? <> – {h.text}</> : null}</Alert>)}
          </Stack>
        )}
        <Stack direction="row" gap={1} alignItems="center" sx={{ color: 'text.secondary' }}>
          <Typography variant="caption">{PRODUKT} · {SLOGAN}</Typography>
          <Typography variant="caption">·</Typography>
          <Link component="button" type="button" variant="caption" onClick={() => setUeber(true)}>Über EduOrga</Link>
          <Typography variant="caption">·</Typography>
          <Link variant="caption" href="/datenschutz" target="_blank" rel="noopener">Datenschutz</Link>
        </Stack>
      </Box>
      <UeberDialog offen={ueber} onClose={() => setUeber(false)} />
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
    document.title = `Anmelden – ${PRODUKT}`;
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
    <Rahmen sitzung={sitzung} titel="Anmelden" untertitel="Mit dem Benutzernamen und Passwort Ihres Schulkontos.">
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

/** Einrichtungsassistent (erster Start ohne Konten): Schule, Administrationskonto, danach Schul-ID und API-Schlüssel für EduOrga Studio. */
export function Einrichtung({ sitzung, fertig }: { sitzung: Sitzung | null; fertig: () => void }) {
  const [schritt, setSchritt] = useState(0);
  const [schulname, setSchulname] = useState('');
  const [login, setLogin] = useState('admin');
  const [passwort, setPasswort] = useState('');
  const [passwort2, setPasswort2] = useState('');
  const [meldung, setMeldung] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  useEffect(() => { document.title = `Einrichtung – ${PRODUKT}`; }, []);
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
    <Rahmen sitzung={sitzung} titel="Ersteinrichtung" untertitel="Legen Sie die Schule und das Administrationskonto an. Danach verbinden Sie EduOrga Studio mit Schul-ID und API-Schlüssel.">
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
  useEffect(() => { document.title = `Passwort ändern – ${PRODUKT}`; }, []);
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
