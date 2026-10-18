// Start der Oberfläche: Thema, Anmeldung, Module, Router, zuletzt geöffnetes Dokument.
import { FluentProvider, Spinner } from '@fluentui/react-components';
import { useEffect, useState } from 'react';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { api } from '@/api/client';
import type { Benutzer, DokumentListe, SystemInfo } from '@/api/typen';
import { befehl } from '@/kern/befehle';
import { dokumentOeffnen } from '@/kern/dokument';
import { an } from '@/kern/ereignisse';
import { moduleLaden } from '@/kern/modulsystem';
import { setzen, useStudio } from '@/kern/zustand';
import { fehlerMelden } from '@/komponenten/hinweise';
import { module } from '@/module/register';
import { Anmeldung } from '@/shell/anmeldung';
import { ArbeitsplatzSeite } from '@/shell/arbeitsplatz';
import { Seite } from '@/shell/seite';
import { Shell } from '@/shell/shell';
import { Startseite } from '@/shell/startseite';
import { dunklesThema, hellesThema } from './theme';

let router: ReturnType<typeof createBrowserRouter> | null = null;
function routerErstellen() {
  if (!router) {
    router = createBrowserRouter([
      {
        path: '/',
        element: <Shell />,
        children: [
          { index: true, element: <Startseite /> },
          { path: 'arbeitsplatz/:name', element: <ArbeitsplatzSeite /> },
          { path: '*', element: <Seite /> },
        ],
      },
    ]);
  }
  return router;
}

function useSystemDunkel() {
  const [dunkel, setDunkel] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const m = matchMedia('(prefers-color-scheme: dark)');
    const f = () => setDunkel(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return dunkel;
}

// Module sofort registrieren (Ansichten, Befehle), damit Router und Navigation sie beim ersten Zeichnen kennen
moduleLaden(module);

let gestartet = false;
async function dokumentWiederOeffnen() {
  let id: string | null = null;
  try { id = sessionStorage.getItem('studio.dokument'); } catch { /* privat */ }
  try {
    const liste = await api.get<DokumentListe>('/api/dokumente');
    if (!id || !liste.dokumente.some((d) => d.id === id)) id = liste.zuletzt[0] || null;
    if (id) await dokumentOeffnen(id);
    else if (location.pathname === '/') void befehl('datei.backstage', { seite: liste.dokumente.length ? 'oeffnen' : 'neu' });
  } catch (e) {
    fehlerMelden(e);
  }
  document.body.dataset.bereit = '1';
}

export function App() {
  const thema = useStudio((x) => x.thema);
  const benutzer = useStudio((x) => x.benutzer);
  const systemDunkel = useSystemDunkel();
  const [phase, setPhase] = useState<'laden' | 'anmelden' | 'bereit'>('laden');
  const dunkel = thema === 'dunkel' || (thema === 'auto' && systemDunkel);

  useEffect(() => { document.documentElement.dataset.thema = thema === 'auto' ? 'auto' : dunkel ? 'dunkel' : 'hell'; }, [thema, dunkel]);

  useEffect(() => {
    void (async () => {
      const system = await api.get<SystemInfo>('/api/system').catch(() => ({ anwendung: 'UntPlan Studio', version: '', beta: false }));
      const sitzung = await api.get<{ benutzer: Benutzer | null }>('/api/sitzung').catch(() => ({ benutzer: null }));
      setzen({ system, benutzer: sitzung.benutzer });
      setPhase(sitzung.benutzer ? 'bereit' : 'anmelden');
    })();
    return an('abgemeldet', () => { if (useStudio.getState().benutzer) { setzen({ benutzer: null }); setPhase('anmelden'); } });
  }, []);

  useEffect(() => {
    if (phase !== 'bereit' || gestartet) return;
    gestartet = true;
    void dokumentWiederOeffnen();
  }, [phase]);

  return (
    <FluentProvider theme={dunkel ? dunklesThema : hellesThema} style={{ minHeight: '100vh' }}>
      {phase === 'laden' ? <div style={{ height: '100vh', display: 'grid', placeItems: 'center' }}><Spinner label="UntPlan Studio wird geladen …" /></div> : null}
      {phase === 'anmelden' ? <Anmeldung fertig={(b) => {
        const vorher = gestartet;
        setzen({ benutzer: b });
        setPhase('bereit');
        if (vorher) location.reload();
      }} /> : null}
      {phase === 'bereit' && benutzer ? <RouterProvider router={routerErstellen()} /> : null}
    </FluentProvider>
  );
}
