// Hülle der App: helle Seitenleiste links (Marke, Schule, Schuljahr, Bereiche mit Symbol und aufklappbaren Seiten, Konto unten),
// einklappbar zur Symbolleiste; auf Telefon und Tablet als Schublade mit Kopfleiste. Rechts der Inhalt der aktuellen Seite.
import { Suspense, useEffect, useMemo, useState, type MouseEvent } from 'react';
import {
  AppBar, Avatar, Badge, Box, Collapse, Divider, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, ListSubheader, Menu, MenuItem,
  Select, Stack, Toolbar, Tooltip, Typography, useMediaQuery, useTheme,
} from '@mui/material';
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
import { api, holen, senden } from '../api/client';
import { useSitzung } from './sitzung';
import { allePunkte, menue, navAus, type Bereich } from './menue';
import { InfocenterAnbieter, InfocenterKnopf, useInfocenter } from './Infocenter';
import { Marke, Zeichen } from '../components/Marke';
import { Fehler, Laden } from '../components/Seite';
import { useHash, navigieren } from '../lib/router';
import { lesen, schreiben } from '../lib/speicher';
import { fehler, toast } from '../lib/meldungen';
import { SEITEN, darfSeite } from '../pages/register';
import { FehlerGrenze } from '../components/FehlerGrenze';

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
  const teile = useHash();
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
            const n = new Notification('Neue Mitteilung', { body: text, tag: 'untplan-mitteilung' });
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
  const titel = allePunkte(m).find(p => p.nav === nav)?.text ?? 'UntPlan';

  return (
    <InfocenterAnbieter>
      <Box sx={{ display: 'flex', minHeight: '100dvh', bgcolor: 'background.default' }}>
        {mobil ? (
          <>
            <AppBar position="fixed" color="inherit" className="nicht-drucken" sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider', zIndex: t => t.zIndex.drawer - 1 }}>
              <Toolbar sx={{ gap: 1, minHeight: { xs: 56 } }}>
                <IconButton edge="start" onClick={() => setMobilOffen(true)} aria-label="Menü öffnen"><MenuRounded /></IconButton>
                <Box sx={{ color: 'primary.main', display: 'flex' }}><Zeichen groesse={22} /></Box>
                <Typography sx={{ fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>{titel}</Typography>
                <InfocenterKnopf />
              </Toolbar>
            </AppBar>
            <Drawer open={mobilOffen} onClose={() => setMobilOffen(false)} slotProps={{ paper: { sx: { width: Math.min(BREIT + 16, 320) } } }}>{leiste}</Drawer>
          </>
        ) : (
          <Box component="nav" className="nicht-drucken" sx={{ width: schmal ? SCHMAL : BREIT, flex: 'none', transition: 'width .16s ease' }}>
            <Box sx={{ position: 'fixed', top: 0, bottom: 0, left: 0, width: schmal ? SCHMAL : BREIT, borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper', transition: 'width .16s ease', zIndex: 1100 }}>
              {leiste}
            </Box>
          </Box>
        )}
        <Box component="main" sx={{ flex: 1, minWidth: 0, px: { xs: 1.5, sm: 2.5, lg: 3.5 }, pt: { xs: 9, lg: 3 }, pb: 6, '@media print': { p: 0 } }}>
          <FehlerGrenze schluessel={teile.join('/')}>
            <Suspense fallback={<Laden hoehe={320} />}>
              {Seite ? <Seite key={name} teile={teile.slice(1)} nav={nav} /> : <Fehler fehler={new Error('Seite nicht gefunden.')} />}
            </Suspense>
          </FehlerGrenze>
        </Box>
      </Box>
    </InfocenterAnbieter>
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
  const zahl = (an?: boolean) => (an && ungelesen ? <Badge badgeContent={ungelesen > 99 ? '99+' : ungelesen} color="primary" sx={{ mr: 1.5, '& .MuiBadge-badge': { position: 'static', transform: 'none' } }} /> : null);

  const aktiv = (g: Bereich) => g.nav === nav || !!g.unter?.some(p => p.nav === nav);
  const kopfKlick = (g: Bereich, ev: MouseEvent<HTMLElement>) => {
    if (!g.unter) { if (g.href) navigieren(g.href); schliessen(); return; }
    if (schmal) { setPopover({ el: ev.currentTarget, g }); return; }
    setOffen(offen === g.id ? null : g.id);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Stack direction="row" alignItems="center" sx={{ px: schmal ? 0 : 2.25, pt: 2, pb: 1, minHeight: 64, justifyContent: schmal ? 'center' : 'space-between' }}>
        <Box component="a" href="#/heute" onClick={schliessen} sx={{ textDecoration: 'none', color: 'inherit', minWidth: 0 }} title="UntPlan">
          {schmal ? <Box sx={{ color: 'primary.main', display: 'flex' }}><Zeichen groesse={28} /></Box> : <Marke groesse={28} />}
        </Box>
        {!schmal && (mobil ? <IconButton onClick={schliessen} aria-label="Menü schließen"><CloseRounded /></IconButton> : <InfocenterKnopf />)}
      </Stack>
      {!schmal && (
        <Box sx={{ px: 2.25, pb: 1.5 }}>
          <Typography variant="body2" color="text.secondary" noWrap title={sitzung.schule.name}>{sitzung.schule.name}</Typography>
          {s.schuljahre.length > 0 && (
            <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary">Schuljahr</Typography>
              <Tooltip title={`Aktuelles Schuljahr: ${s.schuljahre[0].text}`} placement="right">
                <Select value={s.schuljahr.von} onChange={e => { s.schuljahrWaehlen(e.target.value); toast(`Schuljahr ${s.schuljahre.find(x => x.von === e.target.value)?.text} gewählt.`); }}
                  variant="outlined" size="small" sx={{ fontSize: 13, fontWeight: 500, borderRadius: 999, '& .MuiSelect-select': { py: 0.4, pl: 1.5 },
                    ...(s.schuljahr.aktuell ? {} : { bgcolor: 'status.pruefung.flaeche', color: 'status.pruefung.main' }) }}>
                  {s.schuljahre.map(x => <MenuItem key={x.von} value={x.von}>{x.text}</MenuItem>)}
                </Select>
              </Tooltip>
            </Stack>
          )}
        </Box>
      )}
      <Divider />
      <List component="div" sx={{ flex: 1, overflowY: 'auto', px: schmal ? 1 : 1.25, py: 1.25 }} aria-label="Navigation">
        {m.map(g => {
          const an = aktiv(g);
          const knopf = (
            <ListItemButton key={g.id} onClick={ev => kopfKlick(g, ev)} selected={an && (!g.unter || schmal)} aria-current={g.nav === nav ? 'page' : undefined}
              aria-expanded={g.unter && !schmal ? offen === g.id : undefined}
              sx={{ mb: 0.25, minHeight: 42, px: schmal ? 0 : 1.25, justifyContent: schmal ? 'center' : 'flex-start',
                color: an ? 'primary.main' : 'text.primary', '&.Mui-selected': { bgcolor: 'action.selected', color: 'primary.main' },
                '& .MuiListItemIcon-root': { color: an ? 'primary.main' : 'text.secondary' } }}>
              <ListItemIcon sx={{ minWidth: schmal ? 0 : 38, justifyContent: 'center' }}>
                {g.zaehler && schmal ? <Badge variant="dot" color="primary" invisible={!ungelesen}>{g.icon}</Badge> : g.icon}
              </ListItemIcon>
              {!schmal && <ListItemText primary={g.text} slotProps={{ primary: { sx: { fontWeight: an ? 600 : 500, fontSize: 14 } } }} />}
              {!schmal && zahl(g.zaehler && offen !== g.id)}
              {!schmal && g.unter && <ExpandMoreRounded fontSize="small" sx={{ color: 'text.secondary', transform: offen === g.id ? 'rotate(180deg)' : 'none', transition: 'transform .16s' }} />}
            </ListItemButton>
          );
          return (
            <Box key={g.id}>
              {schmal ? <Tooltip title={g.text} placement="right">{knopf}</Tooltip> : knopf}
              {g.unter && !schmal && (
                <Collapse in={offen === g.id} timeout={160} unmountOnExit>
                  <List component="div" disablePadding sx={{ ml: 3.1, pl: 1.25, borderLeft: 1, borderColor: 'divider', mb: 0.75 }}>
                    {g.unter.filter(p => !p.verborgen).map(p => (
                      <ListItemButton key={p.nav} component="a" href={p.href} onClick={schliessen} selected={p.nav === nav} aria-current={p.nav === nav ? 'page' : undefined}
                        sx={{ minHeight: 34, py: 0.25, px: 1.25, mb: 0.25, '&.Mui-selected': { bgcolor: 'action.selected', color: 'primary.main', fontWeight: 600 } }}>
                        <ListItemText primary={p.text} slotProps={{ primary: { sx: { fontSize: 13.5, fontWeight: 'inherit' } } }} />
                        {zahl(p.zaehler)}
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
      <Divider />
      <Konto schmal={schmal} abmelden={abmelden} neuStarten={neuStarten} schliessen={schliessen} />
      {!mobil && (
        <ListItemButton onClick={() => einklappen(!schmal)} sx={{ mx: 1, mb: 1, minHeight: 36, justifyContent: schmal ? 'center' : 'flex-start', color: 'text.secondary' }}
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
  return (
    <>
      <ListItemButton onClick={e => oeffnen(e.currentTarget)} aria-haspopup="menu" sx={{ m: 1, mb: 0.5, py: 1, px: schmal ? 0 : 1.25, justifyContent: schmal ? 'center' : 'flex-start', gap: 1.25 }}>
        <Badge variant="dot" color="error" invisible={!ic.ungelesen || !schmal} overlap="circular">
          <Avatar sx={{ width: 34, height: 34, fontSize: 13, fontWeight: 600, bgcolor: 'primary.main' }}>{initialen(ich.anzeigename || ich.login)}</Avatar>
        </Badge>
        {!schmal && (
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontWeight: 600, fontSize: 13.5 }} noWrap>{ich.anzeigename || ich.login}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap component="div">{ich.login} · {ich.rollenname}</Typography>
          </Box>
        )}
        {!schmal && <ExpandMoreRounded fontSize="small" sx={{ color: 'text.secondary', transform: 'rotate(180deg)' }} />}
      </ListItemButton>
      <Menu anchorEl={anker} open={!!anker} onClose={() => setAnker(null)} anchorOrigin={{ vertical: 'top', horizontal: schmal ? 'right' : 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }} slotProps={{ paper: { sx: { minWidth: 260 } } }}>
        <MenuItem component="a" href="#/profil" onClick={() => { setAnker(null); schliessen(); }}><ListItemIcon><PersonOutlineRounded fontSize="small" /></ListItemIcon>Mein Profil</MenuItem>
        <MenuItem component="a" href="#/neuigkeiten" onClick={() => { setAnker(null); schliessen(); }}>
          <ListItemIcon><NewReleasesOutlined fontSize="small" /></ListItemIcon>Neuigkeiten
          {ic.ungelesen > 0 && <Badge badgeContent={ic.ungelesen} color="error" sx={{ ml: 'auto', '& .MuiBadge-badge': { position: 'static', transform: 'none' } }} />}
        </MenuItem>
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
        <MenuItem onClick={() => { setAnker(null); abmelden(); }}><ListItemIcon><LogoutRounded fontSize="small" /></ListItemIcon>Abmelden</MenuItem>
      </Menu>
    </>
  );
}
