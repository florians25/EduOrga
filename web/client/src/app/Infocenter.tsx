// Infocenter: Glocke mit Zahl ungelesener Einträge (Infos der Schule, Neuigkeiten zu UntPlanWeb), Liste als Seitenleiste rechts.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Badge, Box, Button, Chip, Drawer, IconButton, InputAdornment, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import NotificationsNoneOutlined from '@mui/icons-material/NotificationsNoneOutlined';
import CloseRounded from '@mui/icons-material/CloseRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import { holen, senden } from '../api/client';
import { fehler } from '../lib/meldungen';
import { MONATE } from '../lib/datum';
import { Leer } from '../components/Seite';

export interface InfoEintrag {
  schluessel: string; art: 'info' | 'neuigkeit' | string; kategorie: string; datum: string; titel: string; text?: string; punkte?: string[];
  gelesen: boolean; wichtig?: boolean; id?: number; [k: string]: unknown;
}
interface Zustand { eintraege: InfoEintrag[]; ungelesen: number; darfVerwalten: boolean }

interface IcKontext extends Zustand { laden: () => Promise<void>; gelesen: (schluessel?: string[]) => Promise<void>; oeffnen: () => void }
const Ctx = createContext<IcKontext | null>(null);
export const useInfocenter = () => useContext(Ctx)!;

export function InfocenterAnbieter({ children }: { children: ReactNode }) {
  const [z, setZ] = useState<Zustand>({ eintraege: [], ungelesen: 0, darfVerwalten: false });
  const [offen, setOffen] = useState(false);
  const laden = useCallback(async () => {
    try {
      const d = await holen<Zustand>('/api/app/infocenter');
      setZ({ eintraege: d.eintraege ?? [], ungelesen: d.ungelesen ?? 0, darfVerwalten: !!d.darfVerwalten });
    } catch { /* still */ }
  }, []);
  const gelesen = useCallback(async (schluessel?: string[]) => {
    const offenL = schluessel ? schluessel.filter(s => z.eintraege.some(x => x.schluessel === s && !x.gelesen)) : null;
    if (offenL && !offenL.length) return;
    try { await senden('/api/app/infocenter/gelesen', offenL ? { schluessel: offenL } : { alle: true }); } catch (err) { fehler(err); return; }
    setZ(alt => {
      const eintraege = alt.eintraege.map(x => (!offenL || offenL.includes(x.schluessel) ? { ...x, gelesen: true } : x));
      return { ...alt, eintraege, ungelesen: eintraege.filter(x => !x.gelesen).length };
    });
  }, [z.eintraege]);
  useEffect(() => {
    void laden();
    const t = setInterval(() => { if (!document.hidden) void laden(); }, 300000);
    return () => clearInterval(t);
  }, [laden]);
  const wert = useMemo(() => ({ ...z, laden, gelesen, oeffnen: () => setOffen(true) }), [z, laden, gelesen]);
  return (
    <Ctx.Provider value={wert}>
      {children}
      <InfocenterPanel offen={offen} zu={() => setOffen(false)} />
    </Ctx.Provider>
  );
}

export function InfocenterKnopf({ hell = false }: { hell?: boolean }) {
  const ic = useInfocenter();
  return (
    <Tooltip title="Infocenter">
      <IconButton onClick={ic.oeffnen} aria-label={ic.ungelesen ? `Infocenter – ${ic.ungelesen} ungelesen` : 'Infocenter'} sx={{ color: hell ? '#fff' : 'text.secondary' }}>
        <Badge badgeContent={ic.ungelesen > 9 ? '9+' : ic.ungelesen} color="error" invisible={!ic.ungelesen}><NotificationsNoneOutlined /></Badge>
      </IconButton>
    </Tooltip>
  );
}

const KAT_FARBE: Record<string, 'error' | 'primary' | 'success' | 'default'> = { Wichtig: 'error', Info: 'primary', Update: 'success' };

export function InfoKarte({ x, onClick, werkzeuge }: { x: InfoEintrag; onClick?: () => void; werkzeuge?: ReactNode }) {
  const [auf, setAuf] = useState(false);
  const d = new Date(String(x.datum).slice(0, 10) + 'T12:00');
  const lang = (x.text?.length ?? 0) > 220 || (x.punkte?.length ?? 0) > 3;
  return (
    <Box onClick={onClick} sx={{ display: 'flex', gap: 2, p: 2, borderRadius: 2, border: 1, borderColor: x.gelesen ? 'divider' : 'primary.light', bgcolor: x.gelesen ? 'background.paper' : 'action.selected',
      cursor: onClick && !x.gelesen ? 'pointer' : 'default', position: 'relative' }}>
      <Box sx={{ textAlign: 'center', minWidth: 40 }}>
        <Typography sx={{ fontSize: 20, fontWeight: 600, lineHeight: 1 }}>{Number.isNaN(d.getTime()) ? '' : d.getDate()}</Typography>
        <Typography variant="caption" color="text.secondary">{Number.isNaN(d.getTime()) ? '' : MONATE[d.getMonth()].slice(0, 3)}</Typography>
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 0.5 }}>
          <Chip size="small" label={x.kategorie} color={KAT_FARBE[x.kategorie] ?? 'default'} variant="outlined" />
          {werkzeuge}
        </Stack>
        <Typography sx={{ fontWeight: 600 }}>{x.titel}</Typography>
        <Box sx={{ maxHeight: auf || !lang ? 'none' : 96, overflow: 'hidden', color: 'text.secondary', fontSize: 13, mt: 0.5 }}>
          {x.text && <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{x.text}</Typography>}
          {!!x.punkte?.length && <Box component="ul" sx={{ pl: 2.5, my: 0.5 }}>{x.punkte.map((p, i) => <li key={i}>{p}</li>)}</Box>}
        </Box>
        {lang && <Button size="small" onClick={e => { e.stopPropagation(); setAuf(!auf); }} sx={{ mt: 0.5, ml: -1 }}>{auf ? 'weniger' : 'mehr'}</Button>}
      </Box>
      {!x.gelesen && <Box sx={{ width: 8, height: 8, borderRadius: 4, bgcolor: 'primary.main', position: 'absolute', top: 14, right: 14 }} aria-label="ungelesen" />}
    </Box>
  );
}

function InfocenterPanel({ offen, zu }: { offen: boolean; zu: () => void }) {
  const ic = useInfocenter();
  const [art, setArt] = useState('alle');
  const [suche, setSuche] = useState('');
  const liste = ic.eintraege.filter(x => (art === 'alle' || x.art === art) && (!suche || `${x.titel} ${x.text ?? ''} ${x.kategorie} ${(x.punkte ?? []).join(' ')}`.toLowerCase().includes(suche.toLowerCase())));
  return (
    <Drawer anchor="right" open={offen} onClose={zu} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 440 }, bgcolor: 'background.default' } } }}>
      <Stack direction="row" alignItems="center" sx={{ px: 2.5, py: 1.5, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h3" component="h2" sx={{ flex: 1 }}>Infocenter</Typography>
        <Button size="small" disabled={!ic.ungelesen} onClick={() => ic.gelesen()}>Alle als gelesen markieren</Button>
        <IconButton onClick={zu} aria-label="Infocenter schließen"><CloseRounded /></IconButton>
      </Stack>
      <Stack gap={1.5} sx={{ p: 2 }}>
        <TextField placeholder="Infocenter durchsuchen" value={suche} onChange={e => setSuche(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> } }} />
        <ToggleButtonGroup exclusive size="small" value={art} onChange={(_, v) => v && setArt(v)} sx={{ alignSelf: 'flex-start' }}>
          <ToggleButton value="alle">Alle</ToggleButton><ToggleButton value="info">Infos der Schule</ToggleButton><ToggleButton value="neuigkeit">Updates</ToggleButton>
        </ToggleButtonGroup>
        {liste.length ? liste.slice(0, 40).map(x => <InfoKarte key={x.schluessel} x={x} onClick={() => !x.gelesen && ic.gelesen([x.schluessel])} />)
          : <Leer text={suche ? 'Keine Treffer' : 'Keine Einträge'} unter={suche ? 'Kein Eintrag passt zur Suche.' : 'Sobald es etwas Neues gibt, erscheint es hier.'} />}
        <Stack direction="row" gap={1} justifyContent="center">
          <Button href="#/neuigkeiten" onClick={zu}>Alle Neuigkeiten</Button>
          {ic.darfVerwalten && <Button href="#/neuigkeiten/verwalten" onClick={zu}>Infos verwalten</Button>}
        </Stack>
      </Stack>
    </Drawer>
  );
}
