// Einstieg: Sitzung laden, dann Einrichtungsassistent, Anmeldung, Passwortpflicht oder die App.
import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button } from '@mui/material';
import { ABGEMELDET, holen, senden } from '../api/client';
import type { Sitzung } from '../api/types';
import { Anmeldung, Einrichtung, PasswortPflicht } from './Anmeldung';
import { SitzungsAnbieter } from './sitzung';
import { Shell } from './Shell';
import { Laden } from '../components/Seite';

/** Einmalanmeldung für EduOrga Mobile: nach der Anmeldung zurück zu /sso/… (nur relative Pfade). */
const weiter = (() => {
  const w = new URLSearchParams(location.search).get('weiter');
  if (w && w.startsWith('/sso/') && !w.startsWith('//')) {
    try { sessionStorage.setItem('untplan:weiter', w); } catch { /* privat */ }
    history.replaceState(null, '', location.pathname + location.hash);
  }
  try { return sessionStorage.getItem('untplan:weiter'); } catch { return w; }
})();

export function App() {
  const [sitzung, setSitzung] = useState<Sitzung | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [nr, setNr] = useState(0);

  const start = useCallback(async () => {
    try {
      const s = await holen<Sitzung>('/api/app/sitzung');
      setFehler(null);
      if (s.benutzer && !s.benutzer.passwortAendern && weiter) {
        try { sessionStorage.removeItem('untplan:weiter'); } catch { /* privat */ }
        location.href = weiter;
        return;
      }
      setSitzung(s);
      setNr(n => n + 1);
    } catch (err) { setFehler((err as Error).message); }
  }, []);

  useEffect(() => { void start(); }, [start]);
  useEffect(() => {
    const f = () => setSitzung(s => (s?.benutzer ? { ...s, benutzer: null } : s));
    window.addEventListener(ABGEMELDET, f);
    return () => window.removeEventListener(ABGEMELDET, f);
  }, []);

  const abmelden = useCallback(async () => {
    try { await senden('/api/app/abmelden', {}); } catch { /* egal */ }
    history.replaceState(null, '', '#/heute');
    setSitzung(null);
    void start();
  }, [start]);

  if (fehler) return (
    <Box sx={{ p: 4, maxWidth: 480, mx: 'auto', mt: 10 }}>
      <Alert severity="error" action={<Button color="inherit" onClick={() => location.reload()}>Erneut versuchen</Button>}>{fehler}</Alert>
    </Box>
  );
  if (!sitzung) return <Laden hoehe={400} />;
  if (!sitzung.eingerichtet) return <Einrichtung sitzung={sitzung} fertig={start} />;
  if (!sitzung.benutzer) return <Anmeldung sitzung={sitzung} fertig={start} />;
  if (sitzung.benutzer.passwortAendern) return <PasswortPflicht sitzung={sitzung} fertig={start} abmelden={abmelden} />;
  return (
    <SitzungsAnbieter key={`${sitzung.benutzer.id}-${nr}`} sitzung={sitzung} setSitzung={setSitzung}>
      <Shell abmelden={abmelden} neuStarten={start} />
    </SitzungsAnbieter>
  );
}
