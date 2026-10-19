// Hülle der App: Seitenleiste links in der Primärfarbe Petrol (Marke EduOrga, Schule, Schuljahr, Bereiche mit Symbol und aufklappbaren
// Seiten, Konto unten), einklappbar zur Symbolleiste; auf Telefon und Tablet als Schublade mit Petrol-Kopfleiste. Rechts der Inhalt.
// Kontomenü mit Erscheinungsbild (hell, dunkel, wie das System) und „Über EduOrga“.
import { Suspense, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import {
  AppBar, Avatar, Badge, Box, Button, Collapse, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Drawer, Link, IconButton, List, ListItemButton, ListItemIcon, ListItemText, ListSubheader, Menu, MenuItem,
  Select, Stack, Toolbar, Tooltip, Typography, useColorScheme, useMediaQuery, useTheme,
} from '@mui/material';
import LightModeOutlined from '@mui/icons-material/LightModeOutlined';
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined';
import ContrastOutlined from '@mui/icons-material/ContrastOutlined';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import CheckRounded from '@mui/icons-material/CheckRounded';
import MenuRounded from '@mui/icons-material/MenuRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import KeyboardDoubleArrowLeftRounded from '@mui/icons-material/KeyboardDoubleArrowLeftRounded';
import KeyboardDoubleArrowRightRounded from '@mui/icons-material/KeyboardDoubleArrowRightRounded';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import PersonOutlineRounded from '@mui/icons-material/PersonOutlineRounded';
import SwitchAccountOutlined from '@mui/icons-material/SwitchAccountOutlined';
import PersonAddAltOutlined from '@mui/icons-material/PersonAddAltOutlined';
import NewReleasesOutlined from '@mui/icons-material/NewReleasesOutlined';
import CloseRounded from '@mui/icons-material/CloseRounded';
import PrivacyTipOutlined from '@mui/icons-material/PrivacyTipOutlined';
import { api, holen, senden } from '../api/client';
import { useSitzung } from './sitzung';
import { allePunkte, menue, navAus, ohneAlias, type Bereich } from './menue';
import { InfocenterAnbieter, InfocenterKnopf, useInfocenter } from './Infocenter';
import { useUpdatestand } from './Update';
import { Marke, Monogramm, PRODUKT } from '../components/Marke';
import { UeberDialog } from '../components/Ueber';
import { Fehler, Laden } from '../components/Seite';
import { useHash, navigieren } from '../lib/router';
import { lesen, schreiben } from '../lib/speicher';
import { fehler, toast } from '../lib/meldungen';
import { SEITEN, darfSeite } from '../pages/register';
import { FehlerGrenze } from '../components/FehlerGrenze';
import { KLASSENBUCH_NAVS, KlassenbuchRahmen } from '../components/klassenbuch/Bereich';

const BREIT = 272;
const SCHMAL = 76;

interface Konto { id: number; login: string; rolle: string; aktuell: boolean }

function initialen(text: string) {
  const t = text.trim().split(/\s+/);
  return (t.length > 1 ? t[0][0] + t[t.length - 1][0] : t[0].slice(0, 2)).toUpperCase();
}

export function Shell({ abmelden, neuStarten }: { abmelden: () => void; neuStarten: () => void }) {
  const theme = useTheme();
  const mobil = useMediaQuery(theme.breakpoints.down('lg'));
  const teile = ohneAlias(useHash());
  const s = useSitzung();
  const { ich, sitzung } = s;
  const m = useMemo(() => menue(ich), [ich]);
  const [zu, setZu] = useState<boolean>(() => lesen<string>('untplan:leiste', 'offen') === 'zu');
  const [mobilOffen, setMobilOffen] = useState(false);

  // Seite aus der Adresse (mit Rechteprüfung wie im Server-Menü)
  let name = teile[0] || (sitzung.ansicht.startseite === 'stundenplan' && ich.element ? 'plan' : sitzung.ansicht.startseite === 'uebersicht' ? 'uebersicht' : 'heute');
  let nav = navAus([name, ...teile.slice(1)], ich);
  if (name === 'klassenbuch' && !ich.kollegium) { name = 'hausaufgaben'; nav = 'hausaufgaben'; }
  const erlaubt = darfSeite(name, nav, ich, allePunkte(m));
  if (!SEITEN[name] || !erlaubt) { name = 'heute'; nav = 'heute'; }
  const Seite = SEITEN[name];
  // Klassenbuch-Bereich mit eigener Unternavigation (Kollegium); „Unterricht → Aufgaben“ und „Unterricht | Einstellungen“ bleiben ohne
  const imKlassenbuch = !!ich.kollegium && KLASSENBUCH_NAVS.has(nav) && name !== 'aufgaben' && !(name === 'kbeinstellungen' && teile[1] === 'unterricht');
  const aktiveGruppe = m.find(g => g.unter?.some(p => p.nav === nav))?.id ?? null;
  const [offen, setOffen] = useState<string | null>(aktiveGruppe);
  useEffect(() => { if (aktiveGruppe) setOffen(aktiveGruppe); setMobilOffen(false); window.scrollTo(0, 0); }, [aktiveGruppe, teile.join('/')]);

  // ungelesene Mitteilungen regelmäßig nachladen (Benachrichtigung bei neuen)
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.hidden && !ich.benachrichtigung) return;
      try {
        const neu = await holen<typeof sitzung>('/api/app/sitzung');
        const mehr = (neu.ungelesen ?? 0) - (sitzung.ungelesen ?? 0);
        if (neu.ungelesen !== sitzung.ungelesen) s.setSitzung({ ...sitzung, ungelesen: neu.ungelesen });
        if (mehr > 0) {
          const text = mehr === 1 ? 'Sie haben eine neue Mitteilung empfangen.' : `Sie haben ${mehr} neue Mitteilungen empfangen.`;
          if (!location.hash.startsWith('#/mitteilungen')) toast(text);
          if (ich.benachrichtigung && 'Notification' in window && Notification.permission === 'granted') {
            const n = new Notification('Neue Mitteilung', { body: text, tag: 'untplan-mitteilung', icon: '/img/icon-192.png' });
            n.onclick = () => { window.focus(); location.hash = '#/mitteilungen'; n.close(); };
          }
        }
      } catch { /* still */ }
    }, 120000);
    return () => clearInterval(t);
  }, [sitzung, ich.benachrichtigung, s]);

  const einklappen = (z: boolean) => { setZu(z); schreiben('untplan:leiste', z ? 'zu' : 'offen'); };
  const schmal = !mobil && zu;
  const leiste = <Leiste m={m} nav={nav} offen={offen} setOffen={setOffen} schmal={schmal} einklappen={einklappen} abmelden={abmelden} neuStarten={neuStarten} mobil={mobil} schliessen={() => setMobilOffen(false)} />;
  const titel = allePunkte(m).find(p => p.nav === nav)?.text ?? PRODUKT;

  return (
    <InfocenterAnbieter>
      <Box sx={{ display: 'flex', minHeight: '100dvh', bgcolor: 'background.default' }}>
        {mobil ? (
          <>
            <AppBar position="fixed" color="inherit" className="nicht-drucken" sx={{ bgcolor: 'nav.flaeche', color: 'nav.text', boxShadow: 'none', borderBottom: '3px solid', borderColor: 'primary.light', zIndex: t => t.zIndex.drawer - 1 }}>
              <Toolbar sx={{ gap: 1, minHeight: { xs: 54 } }}>
                <IconButton edge="start" onClick={() => setMobilOffen(true)} aria-label="Menü öffnen" sx={{ color: 'inherit' }}><MenuRounded /></IconButton>
                <Box sx={{ display: 'flex', borderRadius: '4px', boxShadow: '0 0 0 1px rgba(255,255,255,.22)' }}><Monogramm groesse={24} /></Box>
                <Typography sx={{ fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>{titel}</Typography>
                <InfocenterKnopf hell />
              </Toolbar>
            </AppBar>
            <Drawer open={mobilOffen} onClose={() => setMobilOffen(false)} slotProps={{ paper: { sx: { width: Math.min(BREIT + 16, 320), bgcolor: 'nav.flaeche', color: 'nav.text' } } }}>{leiste}</Drawer>
          </>
        ) : (
          <Box component="nav" className="nicht-drucken" sx={{ width: schmal ? SCHMAL : BREIT, flex: 'none', transition: 'width .16s ease' }}>
            <Box sx={{ position: 'fixed', top: 0, bottom: 0, left: 0, width: schmal ? SCHMAL : BREIT, bgcolor: 'nav.flaeche', color: 'nav.text', transition: 'width .16s ease', zIndex: 1100 }}>
              {leiste}
            </Box>
          </Box>
        )}
        <Box component="main" sx={{ flex: 1, minWidth: 0, px: { xs: 1.5, sm: 2.5, lg: 3 }, pt: { xs: 9, lg: 2.5 }, pb: 6, '@media print': { p: 0 } }}>
          <FehlerGrenze schluessel={teile.join('/')}>
            <Suspense fallback={<Laden hoehe={320} />}>
              {!Seite ? <Fehler fehler={new Error('Seite nicht gefunden.')} />
                : imKlassenbuch ? <KlassenbuchRahmen nav={nav}><Seite key={name} teile={teile.slice(1)} nav={nav} /></KlassenbuchRahmen>
                : <Seite key={name} teile={teile.slice(1)} nav={nav} />}
            </Suspense>
          </FehlerGrenze>
        </Box>
      </Box>
      {ich.datenschutzHinweis && <DatenschutzHinweis />}
    </InfocenterAnbieter>
  );
}

/** Erste Anmeldung von Schüler- und Elternkonten (und nach jeder neuen Fassung): Hinweis auf die Datenschutzhinweise der Schule (Art. 13 DSGVO). */
function DatenschutzHinweis() {
  const [offen, setOffen] = useState(true);
  const bestaetigen = async () => {
    try { await senden('/api/app/datenschutz/kenntnis', {}); setOffen(false); } catch (err) { fehler(err); }
  };
  return (
    <Dialog open={offen} maxWidth="sm" fullWidth aria-labelledby="datenschutz-titel">
      <DialogTitle id="datenschutz-titel">Hinweise zum Datenschutz</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 1.5 }}>
          Die Schule verarbeitet in EduOrga Web personenbezogene Daten (z. B. Stundenplan, Abwesenheiten, Mitteilungen) zur Erfüllung ihres Bildungs- und
          Erziehungsauftrags. Sie sehen nur Ihre eigenen Daten bzw. die Ihrer Kinder.
        </Typography>
        <Typography sx={{ mb: 1.5 }}>
          Wer verantwortlich ist, wie lange Daten gespeichert werden und welche Rechte Sie haben (Auskunft, Berichtigung, Löschung, Beschwerde), steht in den{' '}
          <Link href="/datenschutz" target="_blank" rel="noopener">Datenschutzhinweisen der Schule</Link>.
        </Typography>
        <Typography variant="body2" color="text.secondary">Eine Einwilligung ist dafür nicht nötig; mit „Zur Kenntnis genommen“ blenden Sie diesen Hinweis aus.</Typography>
      </DialogContent>
      <DialogActions>
        <Button href="/datenschutz" target="_blank" rel="noopener">Hinweise öffnen</Button>
        <Button variant="contained" onClick={bestaetigen}>Zur Kenntnis genommen</Button>
      </DialogActions>
    </Dialog>
  );
}

function Leiste({ m, nav, offen, setOffen, schmal, einklappen, abmelden, neuStarten, mobil, schliessen }: {
  m: Bereich[]; nav: string; offen: string | null; setOffen: (id: string | null) => void; schmal: boolean; einklappen: (z: boolean) => void;
  abmelden: () => void; neuStarten: () => void; mobil: boolean; schliessen: () => void;
}) {
  const s = useSitzung();
  const { ich, sitzung } = s;
  const [popover, setPopover] = useState<{ el: HTMLElement; g: Bereich } | null>(null);
  const ungelesen = sitzung.ungelesen ?? 0;
  // neue Version verfügbar: Punkt an „Administration“ (bzw. „Übersicht & Synchronisation“ mit der Karte „Version & Updates“)
  const update = useUpdatestand().stand?.updateVerfuegbar ?? false;
  const updatePunkt = (g: Bereich) => update && g.id === 'admin';
  const zahl = (an?: boolean) => (an && ungelesen ? <Badge badgeContent={ungelesen > 99 ? '99+' : ungelesen} color="error" sx={{ mr: 1.5, '& .MuiBadge-badge': { position: 'static', transform: 'none' } }} /> : null);

  const aktiv = (g: Bereich) => g.nav === nav || !!g.unter?.some(p => p.nav === nav);
  const kopfKlick = (g: Bereich, ev: MouseEvent<HTMLElement>) => {
    if (!g.unter) { if (g.href) navigieren(g.href); schliessen(); return; }
    if (schmal) { setPopover({ el: ev.currentTarget, g }); return; }
    setOffen(offen === g.id ? null : g.id);
  };

  // Seitenleiste in Petrol, klassisch: Zeilen über die volle Breite, eckig; aktive Zeile leicht getönt mit 3-px-Kante links und Schrift 600,
  // Überfahren nur sehr leicht getönt; Unterpunkte als eingerückter Text
  const zeile = { color: 'nav.text', borderRadius: 0, '&:hover': { bgcolor: 'nav.hover' }, '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'nav.marke', outlineOffset: -2 } };
  const aktivZeile = { bgcolor: 'nav.aktiv', color: 'nav.text', fontWeight: 600, boxShadow: 'inset 3px 0 0 var(--mui-palette-nav-marke)', '&:hover': { bgcolor: 'nav.aktiv' } };
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', color: 'nav.text' }}>
      <Stack direction="row" alignItems="center" sx={{ px: schmal ? 0 : 2, pt: 2, pb: 1, minHeight: 60, justifyContent: schmal ? 'center' : 'space-between' }}>
        <Box component="a" href="#/" onClick={schliessen} sx={{ textDecoration: 'none', color: 'inherit', minWidth: 0 }} title={`${PRODUKT} – Startseite`}>
          {schmal ? <Box sx={{ display: 'flex', borderRadius: '5px', boxShadow: '0 0 0 1px rgba(255,255,255,.22)' }}><Monogramm groesse={30} /></Box> : <Marke hell groesse={28} />}
        </Box>
        {!schmal && (mobil ? <IconButton onClick={schliessen} aria-label="Menü schließen" sx={{ color: 'inherit' }}><CloseRounded /></IconButton> : <InfocenterKnopf hell />)}
      </Stack>
      {!schmal && (
        <Box sx={{ px: 2, pb: 1.5 }}>
          <Typography variant="body2" sx={{ color: 'nav.text2', fontWeight: 500 }} noWrap title={sitzung.schule.name}>{sitzung.schule.name}</Typography>
          {s.schuljahre.length > 0 && (
            <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 1 }}>
              <Typography variant="caption" sx={{ color: 'nav.text2' }}>Schuljahr</Typography>
              <Tooltip title={`Aktuelles Schuljahr: ${s.schuljahre[0].text}`} placement="right">
                <Select value={s.schuljahr.von} onChange={e => { s.schuljahrWaehlen(e.target.value); toast(`Schuljahr ${s.schuljahre.find(x => x.von === e.target.value)?.text} gewählt.`); }}
                  variant="outlined" size="small" sx={{ fontSize: 13, fontWeight: 600, borderRadius: '6px', color: 'nav.text', bgcolor: 'nav.hover', '& .MuiSelect-select': { py: 0.5, pl: 1 },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'nav.linie' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'nav.text2' }, '& .MuiSvgIcon-root': { color: 'nav.text2' },
                    ...(s.schuljahr.aktuell ? {} : { bgcolor: 'status.pruefung.flaeche', color: 'status.pruefung.main' }) }}>
                  {s.schuljahre.map(x => <MenuItem key={x.von} value={x.von}>{x.text}</MenuItem>)}
                </Select>
              </Tooltip>
            </Stack>
          )}
        </Box>
      )}
      <Divider sx={{ borderColor: 'nav.linie' }} />
      <List component="div" sx={{ flex: 1, overflowY: 'auto', px: 0, py: 0.75, scrollbarColor: 'rgba(255,255,255,.25) transparent' }} aria-label="Navigation">
        {m.map(g => {
          const an = aktiv(g);
          const knopf = (
            <ListItemButton key={g.id} onClick={ev => kopfKlick(g, ev)} selected={an && (!g.unter || schmal)} aria-current={g.nav === nav ? 'page' : undefined}
              aria-expanded={g.unter && !schmal ? offen === g.id : undefined}
              sx={{ ...zeile, minHeight: 38, px: schmal ? 0 : 2, justifyContent: schmal ? 'center' : 'flex-start',
                '&.Mui-selected': aktivZeile, '& .MuiListItemIcon-root': { color: an ? 'nav.text' : 'nav.text2' } }}>
              <ListItemIcon sx={{ minWidth: schmal ? 0 : 34, justifyContent: 'center', '& svg': { fontSize: 20 } }}>
                {g.zaehler && schmal ? <Badge variant="dot" color="error" invisible={!ungelesen}>{g.icon}</Badge>
                  : updatePunkt(g) ? <Badge variant="dot" color="warning" title="Neue Version verfügbar">{g.icon}</Badge> : g.icon}
              </ListItemIcon>
              {!schmal && <ListItemText primary={g.text} slotProps={{ primary: { sx: { fontWeight: an ? 600 : 500, fontSize: 14 } } }} />}
              {!schmal && zahl(g.zaehler && offen !== g.id)}
              {!schmal && updatePunkt(g) && offen !== g.id && <Badge badgeContent="neu" color="warning" title="Neue Version verfügbar" sx={{ mr: 2, '& .MuiBadge-badge': { position: 'static', transform: 'none' } }} />}
              {!schmal && g.unter && <ExpandMoreRounded fontSize="small" sx={{ color: 'nav.text2', transform: offen === g.id ? 'rotate(180deg)' : 'none', transition: 'transform .16s' }} />}
            </ListItemButton>
          );
          return (
            <Box key={g.id}>
              {schmal ? <Tooltip title={g.text} placement="right">{knopf}</Tooltip> : knopf}
              {g.unter && !schmal && (
                <Collapse in={offen === g.id} timeout={160} unmountOnExit>
                  <List component="div" disablePadding sx={{ pb: 0.5 }}>
                    {g.unter.filter(p => !p.verborgen).map(p => (
                      <ListItemButton key={p.nav} component="a" href={p.href} onClick={schliessen} selected={p.nav === nav} aria-current={p.nav === nav ? 'page' : undefined}
                        sx={{ ...zeile, color: 'nav.text2', minHeight: 30, py: 0.25, pl: 6.25, pr: 2, '&:hover': { bgcolor: 'nav.hover', color: 'nav.text' }, '&.Mui-selected': aktivZeile }}>
                        <ListItemText primary={p.text} slotProps={{ primary: { sx: { fontSize: 13.5, fontWeight: 'inherit' } } }} />
                        {zahl(p.zaehler)}
                        {update && p.nav === 'admin-sync' && <Badge badgeContent="Update" color="warning" sx={{ mr: 2, '& .MuiBadge-badge': { position: 'static', transform: 'none' } }} />}
                      </ListItemButton>
                    ))}
                  </List>
                </Collapse>
              )}
            </Box>
          );
        })}
      </List>
      <Menu anchorEl={popover?.el} open={!!popover} onClose={() => setPopover(null)} anchorOrigin={{ vertical: 'top', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { minWidth: 220 } } }}>
        {popover && <ListSubheader sx={{ lineHeight: '36px', fontWeight: 600 }}>{popover.g.text}</ListSubheader>}
        {popover?.g.unter?.filter(p => !p.verborgen).map(p => (
          <MenuItem key={p.nav} component="a" href={p.href} selected={p.nav === nav} onClick={() => setPopover(null)}>{p.text}</MenuItem>
        ))}
      </Menu>
      <Divider sx={{ borderColor: 'nav.linie' }} />
      <Konto schmal={schmal} abmelden={abmelden} neuStarten={neuStarten} schliessen={schliessen} />
      {!mobil && (
        <ListItemButton onClick={() => einklappen(!schmal)} sx={{ ...zeile, color: 'nav.text2', flex: 'none', px: schmal ? 0 : 2, minHeight: 34, justifyContent: schmal ? 'center' : 'flex-start' }}
          aria-label="Navigation ein- oder ausklappen" title="Navigation ein- oder ausklappen">
          {schmal ? <KeyboardDoubleArrowRightRounded fontSize="small" /> : <><KeyboardDoubleArrowLeftRounded fontSize="small" /><Typography variant="caption" sx={{ ml: 1 }}>Navigation einklappen</Typography></>}
        </ListItemButton>
      )}
      {ich && null}
    </Box>
  );
}

function Konto({ schmal, abmelden, neuStarten, schliessen }: { schmal: boolean; abmelden: () => void; neuStarten: () => void; schliessen: () => void }) {
  const { ich } = useSitzung();
  const ic = useInfocenter();
  const [anker, setAnker] = useState<HTMLElement | null>(null);
  const [konten, setKonten] = useState<Konto[] | null>(null);
  const oeffnen = async (el: HTMLElement) => {
    setAnker(el);
    setKonten(null);
    try { setKonten(await holen<Konto[]>('/api/app/konten')); } catch { setKonten([]); }
  };
  const wechseln = async (id: number) => {
    try { await senden(`/api/app/konten/${id}/wechseln`, {}); history.replaceState(null, '', '#/heute'); setAnker(null); neuStarten(); toast('Konto gewechselt.'); } catch (err) { fehler(err); }
  };
  const vergessen = async (id: number) => {
    try { await api(`/api/app/konten/${id}`, { methode: 'DELETE' }); setKonten(k => (k ?? []).filter(x => x.id !== id)); } catch (err) { fehler(err); }
  };
  const andere = (konten ?? []).filter(k => !k.aktuell);
  const { mode, setMode } = useColorScheme();
  const [ueber, setUeber] = useState(false);
  const modi: ['light' | 'dark' | 'system', string, ReactNode][] = [['light', 'Hell', <LightModeOutlined fontSize="small" />], ['dark', 'Dunkel', <DarkModeOutlined fontSize="small" />], ['system', 'Wie das System', <ContrastOutlined fontSize="small" />]];
  return (
    <>
      <ListItemButton onClick={e => oeffnen(e.currentTarget)} aria-haspopup="menu" sx={{ flex: 'none', py: 1, px: schmal ? 0 : 2, justifyContent: schmal ? 'center' : 'flex-start', gap: 1, borderRadius: 0, color: 'nav.text', '&:hover': { bgcolor: 'nav.hover' } }}>
        <Badge variant="dot" color="error" invisible={!ic.ungelesen || !schmal} overlap="circular">
          <Avatar sx={{ width: 32, height: 32, fontSize: 13, fontWeight: 600, bgcolor: 'secondary.main', color: '#fff', border: '1px solid', borderColor: 'nav.linie' }}>{initialen(ich.anzeigename || ich.login)}</Avatar>
        </Badge>
        {!schmal && (
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontWeight: 600, fontSize: 13.5 }} noWrap>{ich.anzeigename || ich.login}</Typography>
            <Typography variant="caption" sx={{ color: 'nav.text2' }} noWrap component="div">{ich.login} · {ich.rollenname}</Typography>
          </Box>
        )}
        {!schmal && <ExpandMoreRounded fontSize="small" sx={{ color: 'nav.text2', transform: 'rotate(180deg)' }} />}
      </ListItemButton>
      <Menu anchorEl={anker} open={!!anker} onClose={() => setAnker(null)} anchorOrigin={{ vertical: 'top', horizontal: schmal ? 'right' : 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }} slotProps={{ paper: { sx: { minWidth: 260 } } }}>
        <MenuItem component="a" href="#/profil" onClick={() => { setAnker(null); schliessen(); }}><ListItemIcon><PersonOutlineRounded fontSize="small" /></ListItemIcon>Mein Profil</MenuItem>
        <MenuItem component="a" href="#/neuigkeiten" onClick={() => { setAnker(null); schliessen(); }}>
          <ListItemIcon><NewReleasesOutlined fontSize="small" /></ListItemIcon>Neuigkeiten
          {ic.ungelesen > 0 && <Badge badgeContent={ic.ungelesen} color="error" sx={{ ml: 'auto', '& .MuiBadge-badge': { position: 'static', transform: 'none' } }} />}
        </MenuItem>
        <Divider />
        <ListSubheader sx={{ lineHeight: '30px' }}>Erscheinungsbild</ListSubheader>
        {modi.map(([w, text, sym]) => (
          <MenuItem key={w} onClick={() => setMode(w)} selected={(mode ?? 'system') === w} dense>
            <ListItemIcon>{sym}</ListItemIcon><ListItemText primary={text} />{(mode ?? 'system') === w && <CheckRounded fontSize="small" sx={{ ml: 1, color: 'secondary.main' }} />}
          </MenuItem>
        ))}
        <Divider />
        {konten === null && <MenuItem disabled>Konten werden geladen …</MenuItem>}
        {andere.length > 0 && <ListSubheader sx={{ lineHeight: '32px' }}>Konto wechseln</ListSubheader>}
        {andere.map(k => (
          <MenuItem key={k.id} onClick={() => wechseln(k.id)}>
            <ListItemIcon><SwitchAccountOutlined fontSize="small" /></ListItemIcon>
            <ListItemText primary={k.login} secondary={k.rolle} />
            <IconButton size="small" aria-label="Konto vom Gerät entfernen" title="Vom Gerät entfernen" onClick={e => { e.stopPropagation(); void vergessen(k.id); }}><CloseRounded fontSize="small" /></IconButton>
          </MenuItem>
        ))}
        <MenuItem onClick={() => { setAnker(null); abmelden(); }}><ListItemIcon><PersonAddAltOutlined fontSize="small" /></ListItemIcon>Weiteres Konto anmelden</MenuItem>
        <Divider />
        <MenuItem component="a" href="/datenschutz" target="_blank" rel="noopener" onClick={() => setAnker(null)}><ListItemIcon><PrivacyTipOutlined fontSize="small" /></ListItemIcon>Datenschutz</MenuItem>
        <MenuItem onClick={() => { setAnker(null); setUeber(true); }}><ListItemIcon><InfoOutlined fontSize="small" /></ListItemIcon>Über EduOrga</MenuItem>
        <MenuItem onClick={() => { setAnker(null); abmelden(); }}><ListItemIcon><LogoutRounded fontSize="small" /></ListItemIcon>Abmelden</MenuItem>
      </Menu>
      <UeberDialog offen={ueber} onClose={() => setUeber(false)} />
    </>
  );
}
