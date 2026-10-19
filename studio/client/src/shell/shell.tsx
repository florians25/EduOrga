// App-Shell: Kopfleiste, Seitenleiste, Inhalt (Seite bzw. Arbeitsplatz), Dialoge, Menüs, Hinweise, Befehlssuche,
// Drag & Drop (ein gemeinsamer Kontext, damit zwischen Bereichen gezogen werden kann), Tastenkürzel und die zuletzt
// gezeigte Seite je Schuldatei.
import { makeStyles, tokens } from '@fluentui/react-components';
import { Suspense, useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { einstellungLesen, einstellungSchreiben } from '@/api/client';
import { adresseVon } from '@/kern/ansichten';
import { navigationEinrichten, tasteBehandeln, tasteRegistrieren } from '@/kern/befehle';
import { beiDokumentwechsel, rueckgaengig, sicherungspunkt, wiederholen } from '@/kern/dokument';
import { entprellen } from '@/kern/hilfen';
import { setzen, zustand } from '@/kern/zustand';
import { DialogHost, dialogOffen } from '@/komponenten/dialoge';
import { HinweisHost, fehlerMelden } from '@/komponenten/hinweise';
import { KontextmenueHost } from '@/komponenten/menue';
import { ZiehKontext } from '@/komponenten/ziehen';
import { Befehlssuche, befehlssucheIstOffen, befehlssucheOeffnen } from './befehlssuche';
import { Kopfleiste } from './kopfleiste';
import { NavLeiste } from './navleiste';
import { UpdateLeiste } from './updatehinweis';

const useStile = makeStyles({
  app: { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', backgroundColor: tokens.colorNeutralBackground2 },
  unten: { display: 'flex', flex: 1, minHeight: 0 },
  inhalt: { flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', backgroundColor: tokens.colorNeutralBackground1 },
});

const merkeSeite = entprellen((id: string, url: string) => { void einstellungSchreiben(`fenster.dok.${id}`, url); }, 800);

export function Shell() {
  const s = useStile();
  const navigate = useNavigate();
  const ort = useLocation();
  const erster = useRef(true);

  useEffect(() => {
    navigationEinrichten((typ, p) => navigate(adresseVon(typ, p)), (name) => navigate(`/arbeitsplatz/${name}`), (url) => navigate(url));
  }, [navigate]);

  // zuletzt gezeigte Seite je Schuldatei merken
  useEffect(() => {
    const d = zustand().dokument;
    if (d && ort.pathname !== '/' && !ort.pathname.startsWith('/dateien')) merkeSeite(d.id, ort.pathname + ort.search);
  }, [ort.pathname, ort.search]);

  // Dokumentwechsel: zuletzt gezeigte Seite der Datei (beim Start bleibt die Adresse, z. B. nach Neuladen)
  useEffect(() => beiDokumentwechsel(async (stand) => {
    const start = erster.current;
    erster.current = false;
    if (!stand) { navigate('/'); return; }
    if (start && window.location.pathname !== '/' && !window.location.pathname.startsWith('/dateien')) return;
    const gemerkt = await einstellungLesen<unknown>(`fenster.dok.${stand.id}`);
    if (zustand().dokument?.id !== stand.id) return;
    navigate(typeof gemerkt === 'string' && gemerkt.startsWith('/') ? gemerkt : '/uebersicht');
  }), [navigate]);

  // Tastatur
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (dialogOffen() || befehlssucheIstOffen()) return;
      const ziel = e.target as HTMLElement;
      const imFeld = ziel instanceof HTMLInputElement || ziel instanceof HTMLTextAreaElement || ziel instanceof HTMLSelectElement || ziel?.isContentEditable;
      const strg = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      const los = (f: () => Promise<void>) => { e.preventDefault(); f().catch(fehlerMelden); };
      if (strg && !e.shiftKey && k === 'k') { e.preventDefault(); befehlssucheOeffnen(); return; }
      // Strg+S: gespeichert wird ohnehin sofort – legt einen Sicherungspunkt an
      if (strg && !e.shiftKey && k === 's') { if (zustand().dokument && zustand().benutzer?.darfSchreiben) los(sicherungspunkt); else e.preventDefault(); return; }
      if (!imFeld && strg && !e.shiftKey && k === 'z') { los(rueckgaengig); return; }
      if (!imFeld && strg && (k === 'y' || (e.shiftKey && k === 'z'))) { los(wiederholen); return; }
      if (!imFeld) tasteBehandeln(e);
    };
    document.addEventListener('keydown', taste);
    return () => document.removeEventListener('keydown', taste);
  }, []);
  useEffect(() => { tasteRegistrieren('Strg+B', () => setzen({ navEingeklappt: !zustand().navEingeklappt })); }, []);

  return (
    <div className={s.app}>
      <Kopfleiste />
      <UpdateLeiste />
      <div className={s.unten}>
        <NavLeiste />
        <main className={s.inhalt}>
          <ZiehKontext>
            <Suspense fallback={null}><Outlet /></Suspense>
          </ZiehKontext>
        </main>
      </div>
      <Befehlssuche />
      <DialogHost />
      <KontextmenueHost />
      <HinweisHost />
    </div>
  );
}
