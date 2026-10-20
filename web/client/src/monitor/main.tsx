// Monitoranzeige (ohne Anmeldung, über geheimen Link /monitor/<token>): Vertretungsplan für Bildschirme im Schulhaus auf dunkler
// Marine-Fläche mit Uhr, automatischem Bildlauf, einstellbarer Aktualisierung und Nachrichten (Kopfzeile oder Laufschrift).
import { standDatum, standText } from '../components/DatenStand';
import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Box, CssBaseline, GlobalStyles, ThemeProvider, Typography } from '@mui/material';
import '../fonts.css';
import { theme, farben, SCHRIFT } from '../theme';
import { Marke } from '../components/Marke';
import { datumLang } from '../lib/datum';

interface Zeile { klassen: string; stunde: string; fach: string; fachAlt?: string; lehrer: string; lehrerAlt?: string; raum: string; raumAlt?: string; art: string; text: string; status: string }
interface Tag { datum: string; woche?: string; frei?: boolean; freiGrund?: string; nachrichten: string[]; veranstaltungen?: string[]; abwesendeKlassen: string[]; abwesendeLehrer: string[]; blockierteRaeume: string[]; zeilen: Zeile[] }
interface Daten { name: string; schule: string; jetzt: string; stand?: string | null; version: string; tage: Tag[]; anzeige?: { ticker?: boolean; kopfzeile?: boolean; aktualisierung?: number } }

const token = location.pathname.split('/').filter(Boolean).pop() ?? '';
const M = farben.marine;

const Alt = ({ w }: { w?: string }) => (w ? <Box component="span" sx={{ color: '#8fb0b4', textDecoration: 'line-through', mr: 0.5 }}>{w}</Box> : null);
function Wechsel({ a, n, trenn = '→' }: { a?: string; n: string; trenn?: string }) {
  return a && n ? <><Alt w={a} /><Box component="span" sx={{ color: '#8fb0b4', mr: 0.5 }}>{trenn}</Box>{n}</> : <><Alt w={a} />{n}</>;
}

function Rollbereich({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let pos = 0, warten = 120, richtung = 1, f = 0;
    const schritt = () => {
      const b = ref.current;
      if (b) {
        const max = b.scrollHeight - b.clientHeight;
        if (max > 0) {
          if (warten > 0) warten--;
          else {
            pos += richtung * 0.6;
            if (pos >= max) { pos = max; warten = 160; richtung = -1; }
            if (richtung < 0) pos = Math.max(0, pos - 6);
            if (pos <= 0 && richtung < 0) { pos = 0; warten = 160; richtung = 1; }
          }
          b.scrollTop = pos;
        }
      }
      f = requestAnimationFrame(schritt);
    };
    f = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(f);
  }, []);
  return <Box ref={ref} sx={{ maxHeight: 'calc(100vh - 260px)', overflow: 'hidden' }}>{children}</Box>;
}

function TagKarte({ t, lehrer, mitNachrichten }: { t: Tag; lehrer: boolean; mitNachrichten: boolean }) {
  const infos = [t.abwesendeKlassen.length ? `Abwesende Klassen: ${t.abwesendeKlassen.join(', ')}` : '', lehrer && t.abwesendeLehrer.length ? `Abwesende Lehrkräfte: ${t.abwesendeLehrer.join(', ')}` : '',
    t.blockierteRaeume.length ? `Nicht verfügbare Räume: ${t.blockierteRaeume.join(', ')}` : ''].filter(Boolean);
  const art = (z: Zeile) => ({ color: z.status === 'entfall' ? '#ff9b91' : z.status === 'geaendert' || z.status === 'offen' ? '#c3b3ff' : M[200] });
  return (
    <Box component="section" sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, bgcolor: M[800], border: '1px solid rgba(255,255,255,.1)', borderRadius: '4px', overflow: 'hidden' }}>
      <Box component="header" sx={{ px: 2, py: 2, borderBottom: '1px solid rgba(255,255,255,.1)', fontSize: 22, fontWeight: 600, color: '#fff' }}>
        {datumLang(t.datum)}{t.woche && <Box component="small" sx={{ fontSize: 16, fontWeight: 400, color: M[200], ml: 1 }}>{t.woche}-Woche</Box>}
      </Box>
      {(mitNachrichten && t.nachrichten.length > 0) || (t.veranstaltungen ?? []).length > 0 || infos.length > 0 ? (
        <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
          {mitNachrichten && t.nachrichten.map((n, i) => <Box key={i} sx={{ px: 1.5, py: 1, mb: 1, borderLeft: `3px solid ${M[300]}`, bgcolor: 'rgba(255,255,255,.05)', borderRadius: '0 3px 3px 0' }}>{n}</Box>)}
          {(t.veranstaltungen ?? []).map((v, i) => <Box key={`v${i}`} sx={{ mb: 0.75, fontSize: 16, color: M[200] }}>Veranstaltung: {v}</Box>)}
          {infos.map((x, i) => <Box key={`i${i}`} sx={{ mb: 0.75, fontSize: 16, color: M[200] }}>{x}</Box>)}
        </Box>
      ) : null}
      <Rollbereich>
        {t.frei ? <Typography sx={{ px: 2, py: 2, color: M[200] }}>{t.freiGrund || 'Unterrichtsfrei'}</Typography>
          : !t.zeilen.length ? <Typography sx={{ px: 2, py: 2, color: M[200] }}>Keine Vertretungen.</Typography> : (
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: { xs: 15, md: 19 }, '& th': { px: { xs: 1.25, md: 2.25 }, py: 1, textAlign: 'left', fontSize: 14, fontWeight: 500, letterSpacing: '.04em', textTransform: 'uppercase', color: M[300], borderBottom: '1px solid rgba(255,255,255,.12)' },
              '& td': { px: { xs: 1.25, md: 2.25 }, py: 1, borderBottom: '1px solid rgba(255,255,255,.07)', verticalAlign: 'top' }, '& td:first-of-type': { fontWeight: 600, color: '#fff' } }}>
              <thead><tr><th>Klasse</th><th>Std.</th><th>Fach</th><th>Lehrkraft</th><th>Raum</th><th>Art</th><th>Text</th></tr></thead>
              <tbody>{t.zeilen.map((z, i) => {
                const e = z.status === 'entfall';
                return (
                  <Box component="tr" key={i} sx={e ? { '& td': { color: '#9fb8bb' }, '& td:nth-of-type(n+3):not(:last-of-type)': { textDecoration: 'line-through' } } : undefined}>
                    <td>{z.klassen}</td><td>{z.stunde}</td>
                    <td>{e ? <><Alt w={z.fachAlt} />{z.fach}</> : <Wechsel a={z.fachAlt} n={z.fach} />}</td>
                    <Box component="td" sx={z.status === 'offen' ? { color: '#ffb4ab' } : undefined}>{z.status === 'offen' ? <><Alt w={z.lehrerAlt} />???</> : e ? <><Alt w={z.lehrerAlt} />{z.lehrer}</> : <Wechsel a={z.lehrerAlt} n={z.lehrer} trenn="|" />}</Box>
                    <td>{e ? <><Alt w={z.raumAlt} />{z.raum}</> : <Wechsel a={z.raumAlt} n={z.raum} />}</td>
                    <td><Box component="span" sx={{ display: 'inline-block', fontSize: { xs: 12, md: 14 }, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap', ...art(z) }}>{z.art}</Box></td>
                    <td>{z.text}</td>
                  </Box>
                );
              })}</tbody>
            </Box>
          )}
      </Rollbereich>
    </Box>
  );
}

function Monitor() {
  const [d, setD] = useState<Daten | null>(null);
  const [fehlt, setFehlt] = useState(false);
  const [versatz, setVersatz] = useState(0);
  const [uhr, setUhr] = useState('');
  const [takt, setTakt] = useState(60000);
  useEffect(() => {
    const laden = async () => {
      try {
        const r = await fetch(`/api/monitor/${encodeURIComponent(token)}`, { cache: 'no-store' });
        if (r.status === 404) { setFehlt(true); return; }
        const x = (await r.json()) as Daten;
        setVersatz(new Date(x.jetzt).getTime() - Date.now());
        document.title = `${x.name} · EduOrga`;
        setD(x);
        setTakt(Math.max(15, Number(x.anzeige?.aktualisierung) || 60) * 1000);
      } catch { /* alten Stand weiter anzeigen */ }
    };
    void laden();
    const z = setInterval(laden, takt);
    return () => clearInterval(z);
  }, [takt]);
  useEffect(() => {
    const f = () => setUhr(new Date(Date.now() + versatz).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
    f();
    const z = setInterval(f, 5000);
    return () => clearInterval(z);
  }, [versatz]);
  const a = d?.anzeige ?? {};
  const ticker = a.ticker && d?.tage[0]?.nachrichten.length ? d.tage[0].nachrichten.join('   +++   ') : '';
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: M[900], color: '#e8f1f2', fontFamily: SCHRIFT, fontSize: { xs: 15, md: 18 }, px: { xs: 1.5, md: 4 }, pt: { xs: 1.5, md: 3 }, pb: 9 }}>
      <Box component="header" sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: 2, mb: 3, borderBottom: '1px solid rgba(255,255,255,.12)' }}>
        <Box sx={{ pr: 2, borderRight: '1px solid rgba(255,255,255,.2)' }}><Marke hell zusatz="" groesse={30} /></Box>
        <Box><Typography component="h1" sx={{ fontSize: { xs: 20, md: 28 }, fontWeight: 600, color: '#fff' }}>{fehlt ? 'Monitor nicht gefunden' : 'Vertretungsplan'}</Typography>
          <Typography sx={{ color: M[200] }}>{fehlt ? 'Der Link ist ungültig oder wurde zurückgesetzt.' : d?.schule}</Typography></Box>
        {!fehlt && d?.stand && <Typography sx={{ ml: 'auto', fontSize: { xs: 12, md: 14 }, color: 'rgba(255,255,255,.75)', textAlign: 'right' }}>Stand EduOrga Studio<br />{standText(standDatum(d.stand)!)}</Typography>}
        {!fehlt && <Typography sx={{ ml: d?.stand ? 2 : 'auto', fontSize: { xs: 26, md: 40 }, fontWeight: 600, color: '#fff' }}>{uhr}</Typography>}
      </Box>
      {d && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(auto-fit, minmax(560px, 1fr))' }, gap: 2 }}>
          {d.tage.length ? d.tage.map(t => <TagKarte key={t.datum} t={t} lehrer={d.version === 'lehrer'} mitNachrichten={a.kopfzeile !== false} />) : <Typography sx={{ color: M[200] }}>Keine Daten.</Typography>}
        </Box>
      )}
      {ticker && (
        <Box sx={{ position: 'fixed', left: 0, right: 0, bottom: 0, py: 1.5, overflow: 'hidden', whiteSpace: 'nowrap', bgcolor: M[800], borderTop: '1px solid rgba(255,255,255,.14)', color: '#fff', fontSize: 20, fontWeight: 500 }}>
          <Box component="span" sx={{ display: 'inline-block', pl: '100%', animation: 'ticker 40s linear infinite', '@media (prefers-reduced-motion: reduce)': { animationDuration: '120s' } }}>{ticker}</Box>
        </Box>
      )}
    </Box>
  );
}

createRoot(document.getElementById('monitor')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles styles={{ body: { background: M[900] }, '@keyframes ticker': { to: { transform: 'translateX(-100%)' } } }} />
      <Monitor />
    </ThemeProvider>
  </StrictMode>,
);
