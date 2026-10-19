// Kopfleiste: Navigation ein/aus, Wortmarke, Schuldatei (Menü), Modus Stundenplanung/Vertretungsplanung, Steuerelemente der
// Module, Rückgängig/Wiederholen mit Speicherstand (gespeichert wird automatisch, siehe speicherstatus.tsx), Suche (Strg+K) und Konto.
import {
  Avatar, Button, Menu, MenuDivider, MenuGroupHeader, MenuItem, MenuList, MenuPopover, MenuTrigger, Tab, TabList, Text, Tooltip,
  makeStyles, mergeClasses, tokens,
} from '@fluentui/react-components';
import {
  ArrowRedo20Regular, ArrowUndo20Regular, Checkmark16Regular, ChevronDown16Regular, Navigation20Regular, Search20Regular,
} from '@fluentui/react-icons';
import { useEffect, useState } from 'react';
import logo from '../../../../design/logo/edo-monogramm.svg';
import { api } from '@/api/client';
import type { DokumentListe } from '@/api/typen';
import { befehl } from '@/kern/befehle';
import { dokumentOeffnen, herunterladen, rueckgaengig, sicherungspunkt, wiederholen } from '@/kern/dokument';
import { an } from '@/kern/ereignisse';
import { initialen } from '@/kern/hilfen';
import { modusSetzen, setzen, themaSetzen, useStudio, zustand, type Thema } from '@/kern/zustand';
import { fehlerMelden } from '@/komponenten/hinweise';
import { useKopfleistenElemente } from './kopfleiste-elemente';
import { befehlssucheOeffnen } from './befehlssuche';
import { UpdatePunkt, updateDialogZeigen, useVersionsstand } from './updatehinweis';
import { Speicherstatus } from './speicherstatus';

const useStile = makeStyles({
  leiste: {
    display: 'flex', alignItems: 'center', gap: '8px', height: '48px', padding: '0 12px 0 8px', flexShrink: 0,
    backgroundColor: tokens.colorNeutralBackground1, borderBottom: `1px solid ${tokens.colorNeutralStroke1}`, boxSizing: 'border-box',
    position: 'relative', zIndex: 2,
  },
  marke: { display: 'flex', alignItems: 'center', gap: '10px', paddingRight: '8px', userSelect: 'none' },
  logo: { width: '28px', height: '28px', display: 'block' },
  wortmarke: { fontSize: '17px', whiteSpace: 'nowrap', letterSpacing: '-0.005em', '@media (max-width: 1440px)': { display: 'none' } },
  wortmarkeFett: { fontWeight: tokens.fontWeightSemibold, color: tokens.colorNeutralForeground1 },
  wortmarkeLeicht: { fontWeight: tokens.fontWeightRegular, color: tokens.colorNeutralForeground1 },
  zusatz: { color: tokens.colorNeutralForeground3, marginLeft: '6px', fontWeight: tokens.fontWeightRegular },
  modi: { flexShrink: 0, alignSelf: 'stretch', alignItems: 'stretch' },
  modusTab: {
    padding: '0 12px', borderRadius: 0, '@media (max-width: 1440px)': { padding: '0 8px' },
    '::after': { display: 'none' }, '::before': { display: 'none' },
    '& .fui-Tab__content': { fontWeight: tokens.fontWeightRegular, color: tokens.colorNeutralForeground2 },
  },
  modusGewaehlt: {
    boxShadow: 'inset 0 -3px 0 var(--edo-modus)',
    '& .fui-Tab__content': { fontWeight: tokens.fontWeightSemibold, color: tokens.colorNeutralForeground1 },
  },
  trenner: { width: '1px', height: '24px', backgroundColor: tokens.colorNeutralStroke2, margin: '0 4px' },
  dokKnopf: { maxWidth: '280px', minWidth: '120px', flexShrink: 1, '@media (max-width: 1500px)': { maxWidth: '210px' }, overflow: 'hidden', justifyContent: 'flex-start', padding: '2px 8px', height: '40px' },
  dokTexte: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, flex: '1 1 auto', overflow: 'hidden', textAlign: 'left' },
  dokName: { fontWeight: tokens.fontWeightSemibold, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', lineHeight: '18px' },
  dokInfo: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', lineHeight: '16px' },
  mitte: { flex: '1 1 auto', minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px' },
  gruppe: { display: 'flex', alignItems: 'center', gap: '2px' },
  status: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, whiteSpace: 'nowrap', maxWidth: '180px', flexShrink: 1, overflow: 'hidden', textOverflow: 'ellipsis', '@media (max-width: 1500px)': { maxWidth: '120px' } },
  ungespeichert: { color: tokens.colorPaletteMarigoldForeground2 },
  getrennt: { color: tokens.colorPaletteRedForeground1 },
  meldung: { color: tokens.colorNeutralForeground2 },
  sucheText: { display: 'contents', '@media (max-width: 1500px)': { display: 'none' } },
  suche: {
    minWidth: '150px', flexShrink: 0, '@media (max-width: 1500px)': { minWidth: 0 }, justifyContent: 'flex-start', color: tokens.colorNeutralForeground3, fontWeight: tokens.fontWeightRegular,
    border: `1px solid ${tokens.colorNeutralStroke1}`, backgroundColor: tokens.colorNeutralBackground2,
  },
  taste: {
    marginLeft: 'auto', paddingLeft: '16px', fontSize: tokens.fontSizeBase100, color: tokens.colorNeutralForeground3,
  },
  konto: { minWidth: 0, padding: '2px 4px' },
});

function useStatusMeldung() {
  const [m, setM] = useState<{ text: string; art?: string } | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const ab = an('meldung', ({ text, art, angezeigt }) => {
      if (angezeigt) return;
      setM({ text, art });
      clearTimeout(t);
      t = setTimeout(() => setM(null), art === 'fehler' ? 10000 : 6000);
    });
    return () => { ab(); clearTimeout(t); };
  }, []);
  return m;
}

function DokumentMenue() {
  const s = useStile();
  const d = useStudio((x) => x.dokument);
  const schreiben = useStudio((x) => !!x.benutzer?.darfSchreiben);
  const [zuletzt, setZuletzt] = useState<{ id: string; name: string }[]>([]);
  const laden = async (offen: boolean) => {
    if (!offen) return;
    try {
      const liste = await api.get<DokumentListe>('/api/dokumente');
      setZuletzt(liste.zuletzt.map((id) => liste.dokumente.find((x) => x.id === id)).filter((x): x is NonNullable<typeof x> => !!x && x.id !== zustand().dokument?.id).slice(0, 5));
    } catch { setZuletzt([]); }
  };
  const los = (f: () => unknown) => () => { Promise.resolve().then(f).catch(fehlerMelden); };
  const info = d ? [d.schulname, d.periode ? `${d.periode}${d.periodeFixiert ? ' (fixiert)' : ''}` : ''].filter(Boolean).join(' · ') : 'Öffnen oder neu anlegen';
  return (
    <Menu onOpenChange={(_, x) => { void laden(x.open); }}>
      <MenuTrigger disableButtonEnhancement>
        <Button appearance="subtle" className={s.dokKnopf} icon={undefined} title="Schuldatei wechseln" data-testid="dokument-menue">
          <span className={s.dokTexte}>
            <span className={s.dokName}>{d ? d.name : 'Keine Schuldatei'}</span>
            <span className={s.dokInfo}>{info}</span>
          </span>
          <ChevronDown16Regular style={{ marginLeft: 8, flexShrink: 0 }} />
        </Button>
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          {d ? (
            <>
              <MenuGroupHeader>{d.name}</MenuGroupHeader>
              <MenuItem onClick={los(() => befehl('datei.backstage', { seite: 'info' }))}>Informationen</MenuItem>
              <MenuItem disabled={!schreiben} secondaryContent="Strg+S" onClick={los(sicherungspunkt)}>Sicherungspunkt anlegen</MenuItem>
              <MenuItem onClick={los(herunterladen)}>Herunterladen (.up)</MenuItem>
              <MenuItem onClick={los(() => befehl('datei.schliessen'))}>Schließen</MenuItem>
              <MenuDivider />
            </>
          ) : null}
          {zuletzt.length ? (
            <>
              <MenuGroupHeader>Zuletzt verwendet</MenuGroupHeader>
              {zuletzt.map((x) => <MenuItem key={x.id} onClick={los(() => dokumentOeffnen(x.id))}>{x.name}</MenuItem>)}
              <MenuDivider />
            </>
          ) : null}
          <MenuItem onClick={los(() => befehl('datei.backstage', { seite: 'oeffnen' }))}>Alle Schuldateien …</MenuItem>
          <MenuItem disabled={!schreiben} onClick={los(() => befehl('datei.backstage', { seite: 'neu' }))}>Neue Schuldatei …</MenuItem>
          <MenuItem disabled={!schreiben} onClick={los(() => befehl('datei.hochladen'))}>Datei hochladen …</MenuItem>
        </MenuList>
      </MenuPopover>
    </Menu>
  );
}

const THEMA_TEXT: Record<Thema, string> = { hell: 'Hell', dunkel: 'Dunkel', auto: 'Wie das System' };

function KontoMenue() {
  const s = useStile();
  const b = useStudio((x) => x.benutzer);
  const thema = useStudio((x) => x.thema);
  const navEin = useStudio((x) => x.navEingeklappt);
  const update = useVersionsstand().stand;
  if (!b) return null;
  const los = (f: () => unknown) => () => { Promise.resolve().then(f).catch(fehlerMelden); };
  const rolle = b.rolle === 'Admin' ? 'Administration' : b.rolle === 'Leser' ? 'Nur lesen' : 'Planung';
  return (
    <Menu>
      <MenuTrigger disableButtonEnhancement>
        <Button appearance="subtle" className={s.konto} aria-label={`Konto ${b.anzeigename || b.name}`} data-testid="konto">
          <UpdatePunkt><Avatar size={28} name={b.anzeigename || b.name} initials={initialen(b.anzeigename || b.name)} color="brand" /></UpdatePunkt>
        </Button>
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          <MenuGroupHeader>{`${b.anzeigename || b.name} · ${rolle}`}</MenuGroupHeader>
          {update?.updateVerfuegbar ? (
            <>
              <MenuItem onClick={() => { void updateDialogZeigen(update); }} data-testid="update-menue">{`Neue Version ${update.neueste} verfügbar …`}</MenuItem>
              <MenuDivider />
            </>
          ) : null}
          <MenuItem onClick={los(() => befehl('datei.backstage', { seite: 'konto' }))}>Konto und Passwort</MenuItem>
          {b.rolle === 'Admin' ? <MenuItem onClick={los(() => befehl('datei.backstage', { seite: 'benutzer' }))}>Benutzerverwaltung</MenuItem> : null}
          <MenuItem secondaryContent="Strg+B" onClick={() => setzen({ navEingeklappt: !navEin })}>Navigation ein-/ausblenden</MenuItem>
          <MenuItem onClick={los(() => befehl('fenster.anordnungen'))}>Gespeicherte Arbeitsplätze …</MenuItem>
          <Menu>
            <MenuTrigger disableButtonEnhancement><MenuItem>Darstellung</MenuItem></MenuTrigger>
            <MenuPopover>
              <MenuList>
                {(['hell', 'dunkel', 'auto'] as Thema[]).map((t) => (
                  <MenuItem key={t} onClick={() => themaSetzen(t)} icon={thema === t ? <Checkmark16Regular /> : <span style={{ width: 16, display: 'inline-block' }} />}>{THEMA_TEXT[t]}</MenuItem>
                ))}
              </MenuList>
            </MenuPopover>
          </Menu>
          <MenuItem onClick={los(() => befehl('datei.backstage', { seite: 'ueber' }))}>Über EduOrga Studio</MenuItem>
          <MenuDivider />
          <MenuItem onClick={los(async () => { await api.post('/api/abmeldung'); location.href = '/'; })}>Abmelden</MenuItem>
        </MenuList>
      </MenuPopover>
    </Menu>
  );
}

export function Kopfleiste() {
  const s = useStile();
  const d = useStudio((x) => x.dokument);
  const modus = useStudio((x) => x.modus);
  const schreiben = useStudio((x) => !!x.benutzer?.darfSchreiben);
  const navEin = useStudio((x) => x.navEingeklappt);
  const elemente = useKopfleistenElemente((x) => x.liste);
  const meldung = useStatusMeldung();
  const mac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
  const los = (f: () => unknown) => () => { Promise.resolve().then(f).catch(fehlerMelden); };
  const sichtbar = (e: (typeof elemente)[number]) => (!e.modus || e.modus === modus) && (e.ohneDokument || !!d);


  return (
    <header className={s.leiste} role="banner">
      <Tooltip content="Navigation ein-/ausblenden (Strg+B)" relationship="label">
        <Button appearance="subtle" icon={<Navigation20Regular />} onClick={() => setzen({ navEingeklappt: !navEin })} />
      </Tooltip>
      <div className={s.marke}>
        <img src={logo} alt="" className={s.logo} />
        <span className={s.wortmarke} aria-label="EduOrga Studio"><span className={s.wortmarkeFett}>Edu</span><span className={s.wortmarkeLeicht}>Orga</span><span className={s.zusatz}>Studio</span></span>
      </div>
      <span className={s.trenner} />
      <DokumentMenue />
      <span className={s.trenner} />
      <TabList size="small" selectedValue={modus} disabled={!d} onTabSelect={(_, x) => modusSetzen(x.value as typeof modus)} aria-label="Arbeitsmodus" className={s.modi}>
        <Tab value="stundenplan" className={mergeClasses('edo-modus-tab', s.modusTab, modus === 'stundenplan' && s.modusGewaehlt)}>Stundenplanung</Tab>
        <Tab value="vertretung" className={mergeClasses('edo-modus-tab', s.modusTab, modus === 'vertretung' && s.modusGewaehlt)}>Vertretungsplanung</Tab>
      </TabList>
      <div className={s.mitte}>
        {elemente.filter((e) => e.ort === 'mitte' && sichtbar(e)).map((e) => <e.komponente key={e.id} />)}
      </div>
      <div className={s.gruppe}>
        <Tooltip content={d?.rueckgaengigText ? `Rückgängig: ${d.rueckgaengigText} (Strg+Z)` : 'Rückgängig (Strg+Z)'} relationship="label">
          <Button appearance="subtle" icon={<ArrowUndo20Regular />} disabled={!d?.kannRueckgaengig || !schreiben} onClick={los(rueckgaengig)} data-testid="rueckgaengig" />
        </Tooltip>
        <Tooltip content={d?.wiederholenText ? `Wiederholen: ${d.wiederholenText} (Strg+Y)` : 'Wiederholen (Strg+Y)'} relationship="label">
          <Button appearance="subtle" icon={<ArrowRedo20Regular />} disabled={!d?.kannWiederholen || !schreiben} onClick={los(wiederholen)} data-testid="wiederholen" />
        </Tooltip>
      </div>
      {meldung && d ? <Text className={mergeClasses(s.status, s.meldung)} title={meldung.text} data-testid="statusmeldung">{meldung.text}</Text> : <Speicherstatus />}
      {elemente.filter((e) => e.ort === 'rechts' && sichtbar(e)).map((e) => <e.komponente key={e.id} />)}
      <Button className={s.suche} appearance="secondary" icon={<Search20Regular />} onClick={befehlssucheOeffnen} data-testid="suche" aria-label="Suchen (Strg+K)">
        <span className={s.sucheText}>Suchen<span className={s.taste}>{mac ? '⌘K' : 'Strg+K'}</span></span>
      </Button>
      <KontoMenue />
    </header>
  );
}
