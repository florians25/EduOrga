// Seitenleiste (Fluent Nav): Übersicht, Bereiche je Modus mit ihren Seiten, unten die Schuldateien.
import {
  NavCategory, NavCategoryItem, NavDrawer, NavDrawerBody, NavDrawerFooter, NavItem, NavSubItem, NavSubItemGroup, makeStyles, mergeClasses, tokens,
} from '@fluentui/react-components';
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { einstellungLesen, einstellungSchreiben } from '@/api/client';
import { eintragAusfuehren, verfuegbar } from '@/kern/befehle';
import { setzen, useStudio } from '@/kern/zustand';
import { menue } from '@/komponenten/menue';
import { NAV_SYMBOLE } from '@/komponenten/symbole';
import { NAVIGATION, aufloesen, passt, sichtbar, type NavPunkt } from './navigation';
import { useSeitenort } from './seitenort';

const useStile = makeStyles({
  nav: { width: '252px' },
  koerper: { paddingTop: '8px' },
  gruppe: { fontWeight: tokens.fontWeightMedium },
  unter: { fontSize: tokens.fontSizeBase300 },
  fuss: { borderTop: '1px solid var(--edo-navi-linie)', paddingTop: '4px' },
});

const SCHMAL = '(max-width: 900px)';

/** Schmales Fenster (Telefon, geteilter Bildschirm): Navigation als überlagernde Leiste. */
function useSchmal(): boolean {
  const [schmal, setSchmal] = useState(() => typeof window !== 'undefined' && window.matchMedia(SCHMAL).matches);
  useEffect(() => {
    const m = window.matchMedia(SCHMAL);
    const f = () => setSchmal(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return schmal;
}

export function NavLeiste() {
  const s = useStile();
  const modus = useStudio((x) => x.modus);
  const eingeklappt = useStudio((x) => x.navEingeklappt);
  const dokument = useStudio((x) => x.dokument);
  const benutzer = useStudio((x) => x.benutzer);
  const ort = useSeitenort();
  const [geschlossen, setGeschlossen] = useState<Record<string, boolean>>({});
  const schmal = useSchmal();
  const schmalVorher = useRef<boolean | null>(null);
  // schmal: Navigation zunächst zu (öffnet über den Menüknopf); wieder breit: Navigation zeigen
  useEffect(() => {
    if (schmalVorher.current === null ? schmal : schmalVorher.current !== schmal) setzen({ navEingeklappt: schmal });
    schmalVorher.current = schmal;
  }, [schmal]);

  useEffect(() => {
    void einstellungLesen<Record<string, boolean>>('navigation.offen').then((o) => {
      if (o && typeof o === 'object') setGeschlossen(Object.fromEntries(Object.entries(o).filter(([, v]) => v === false).map(([k]) => [k, true])));
    });
  }, []);

  const gruppen = useMemo(() => NAVIGATION.filter((g) => sichtbar(g, modus)).map((g) => ({
    g, eintraege: g.eintraege.map((n) => aufloesen(n, g.titel)).filter((e): e is NavPunkt => !!e),
  })).filter((x) => x.eintraege.length), [modus]);

  // gewählter Eintrag: erster, der zur gezeigten Seite passt
  const uebersicht: NavPunkt = { id: 'nav:uebersicht', text: 'Übersicht', ansicht: { typ: 'start.uebersicht' }, braucht: 'dokument', gruppe: '' };
  let gewaehlt = passt(uebersicht, ort) ? uebersicht.id : '';
  let gewaehlteGruppe = '';
  if (!gewaehlt) {
    for (const { g, eintraege } of gruppen) {
      const e = eintraege.find((x) => passt(x, ort));
      if (e) { gewaehlt = e.id; gewaehlteGruppe = g.id; break; }
    }
  }
  const offen = gruppen.map((x) => x.g.id).filter((id) => !geschlossen[id]);
  void dokument; void benutzer; // Verfügbarkeit hängt am Dokument und an den Rechten

  const ausfuehren = (e: NavPunkt, ev: MouseEvent<HTMLElement>) => {
    if (e.menue && !e.ansicht && !e.arbeitsplatz && !e.befehl && !e.aktion) {
      const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
      menue(r.right + 4, r.top, e.menue.map((m) => (m ? { text: m.text, deaktiviert: !verfuegbar({ braucht: e.braucht, ...m }), aktion: () => eintragAusfuehren(m) } : null)));
      return;
    }
    if (schmal) setzen({ navEingeklappt: true });
    void eintragAusfuehren(e);
  };

  return (
    <NavDrawer open={!eingeklappt} type={schmal ? 'overlay' : 'inline'} onOpenChange={(_, d) => { if (!d.open) setzen({ navEingeklappt: true }); }} className={mergeClasses('edo-navi', s.nav)} selectedValue={gewaehlt} selectedCategoryValue={gewaehlteGruppe}
      openCategories={offen} density="small" aria-label="Arbeitsbereiche"
      onNavCategoryItemToggle={(_, d) => {
        const id = String(d.value);
        const neu = { ...geschlossen, [id]: !geschlossen[id] };
        setGeschlossen(neu);
        void einstellungSchreiben('navigation.offen', Object.fromEntries(Object.entries(neu).map(([k, v]) => [k, !v])));
      }}>
      <NavDrawerBody className={s.koerper}>
        <NavItem value={uebersicht.id} icon={<UebersichtSymbol />} disabled={!verfuegbar(uebersicht)} onClick={(e) => ausfuehren(uebersicht, e)} data-nav={uebersicht.id}>Übersicht</NavItem>
        {gruppen.map(({ g, eintraege }) => {
          const Sym = NAV_SYMBOLE[g.symbol];
          return (
            <NavCategory key={g.id} value={g.id}>
              <NavCategoryItem icon={Sym ? <Sym /> : undefined} data-nav-gruppe={g.id} className={s.gruppe}>{g.titel}</NavCategoryItem>
              <NavSubItemGroup>
                {eintraege.map((e) => (
                  <NavSubItem key={e.id} value={e.id} className={s.unter} title={e.hinweis} disabled={!verfuegbar(e)}
                    onClick={(ev) => ausfuehren(e, ev)} data-nav={e.id}>{e.text}</NavSubItem>
                ))}
              </NavSubItemGroup>
            </NavCategory>
          );
        })}
      </NavDrawerBody>
      <NavDrawerFooter className={s.fuss}>
        <NavItem value="nav:dateien" icon={<DateienSymbol />} onClick={() => { if (schmal) setzen({ navEingeklappt: true }); void eintragAusfuehren({ befehl: 'datei.backstage', args: { seite: 'oeffnen' } }); }} data-nav="nav:dateien">Schuldateien</NavItem>
      </NavDrawerFooter>
    </NavDrawer>
  );
}

function UebersichtSymbol() { const S = NAV_SYMBOLE.uebersicht!; return <S />; }
function DateienSymbol() { const S = NAV_SYMBOLE.dateien!; return <S />; }
