// Mitteilungen (Postfach): Posteingang, Gesendet, Entwürfe, Listen (Kollegium) und Einstellungen (Administration).
// Posteingang: offene Lesebestätigungen oben, Lesen im großen Fenster mit Antworten, Allen antworten, Weiterleiten, als ungelesen
// markieren, Drucken, Löschen. Gesendet: „bestätigt | Empfänger*innen“ – Klick zeigt die Lesebestätigungsliste. Schreiben mit
// Empfängersuche (Filter Liste, Klasse, Abteilung, Rolle, Gruppe), Markdown-Vorschau, Lesebestätigung, „wichtig“ und Anhängen.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, IconButton, InputAdornment,
  List, ListItemButton, Menu, MenuItem, Paper, Stack, Switch, Tab, Tabs, TextField, ToggleButton, Tooltip, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import AttachFileRounded from '@mui/icons-material/AttachFileRounded';
import CheckCircleOutlineRounded from '@mui/icons-material/CheckCircleOutlineRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import EditOutlined from '@mui/icons-material/EditOutlined';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import ForwardOutlined from '@mui/icons-material/ForwardOutlined';
import InsertDriveFileOutlined from '@mui/icons-material/InsertDriveFileOutlined';
import MarkEmailReadOutlined from '@mui/icons-material/MarkEmailReadOutlined';
import MarkEmailUnreadOutlined from '@mui/icons-material/MarkEmailUnreadOutlined';
import PriorityHighRounded from '@mui/icons-material/PriorityHighRounded';
import PrintOutlined from '@mui/icons-material/PrintOutlined';
import ReplyAllRounded from '@mui/icons-material/ReplyAllRounded';
import ReplyRounded from '@mui/icons-material/ReplyRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import { api, holen, loeschen as entfernen, senden } from '../../api/client';
import { useSitzung } from '../../app/sitzung';
import { Geladen, Leer, Seite } from '../../components/Seite';
import { FormDialog, Plakette, SuchFeld, Wahl } from '../../components/Bausteine';
import { Tabelle } from '../../components/Tabelle';
import { bestaetigen, fehler, toast } from '../../lib/meldungen';
import { navigieren } from '../../lib/router';
import { useLaden } from '../../lib/useLaden';
import type { SeitenProps } from '../register';
import { klartext, Markdown } from './markdown';

const BASIS = '/api/app/mitteilungen';

interface Anhang { id: number; name: string; groesse: number }
export interface Mitteilung {
  id: number; betreff: string; text: string; absender: string; absenderRolle?: string; empfaenger: string[]; empfaengerText?: string; erstellt: string;
  gelesen?: string | null; bestaetigt?: string | null; lesebestaetigung: boolean; wichtig: boolean; antwortAuf?: number | null; anhaenge?: Anhang[];
  anzahl: number; gelesenAnzahl: number; bestaetigtAnzahl: number; entwurfEmpfaenger?: string[];
}
interface Optionen { darfSenden: boolean; darfAntworten: boolean; wichtig: boolean; maxAnhangMb: number; maxAnhaenge: number; listen?: boolean }
interface Empfaenger { id: string; name: string; kategorie: string; klasse?: string; art?: string }
interface SchreibVorgabe { an?: string; vorgabe?: { empfaenger?: { id: string; name: string }[]; betreff?: string; text?: string; antwortAuf?: number }; entwurf?: Mitteilung; titel?: string }
type Ordner = 'eingang' | 'gesendet' | 'entwuerfe';

const TITEL: Record<Ordner, string> = { eingang: 'Posteingang', gesendet: 'Gesendete Mitteilungen', entwuerfe: 'Entwürfe' };
const datum = (s: string) => new Date(String(s).replace(' ', 'T'));
function zeitKurz(s: string) {
  const d = datum(s);
  if (isNaN(+d)) return s;
  const heute = new Date();
  return d.toDateString() === heute.toDateString()
    ? d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: d.getFullYear() === heute.getFullYear() ? undefined : 'numeric' });
}
const zeitLang = (s: string) => { const d = datum(s); return isNaN(+d) ? s : `${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}, ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`; };
const groesse = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function Mitteilungen({ teile }: SeitenProps) {
  const [a, id] = teile;
  if (a === 'listen') return <Listen />;
  if (a === 'einstellungen') return <Einstellungen />;
  const ordner: Ordner = a === 'gesendet' || a === 'entwuerfe' ? a : 'eingang';
  return <Postfach key={ordner} ordner={ordner} verfassen={a === 'verfassen'} oeffnenId={id} />;
}

// ------------------------------------------------------------------ Postfach

function Postfach({ ordner, verfassen, oeffnenId }: { ordner: Ordner; verfassen: boolean; oeffnenId?: string }) {
  const s = useSitzung();
  const g = useLaden(async sig => {
    const [liste, optionen] = await Promise.all([holen<Mitteilung[]>(`${BASIS}?ordner=${ordner}`, sig), holen<Optionen>(`${BASIS}/optionen`, sig)]);
    return { liste, optionen };
  }, [ordner]);
  const [suche, setSuche] = useState('');
  const [merkmal, setMerkmal] = useState('');
  const [lesen, setLesen] = useState<Mitteilung | null>(null);
  const [schreiben, setSchreiben] = useState<SchreibVorgabe | null>(null);
  const [lb, setLb] = useState<Mitteilung | null>(null);
  const eingang = ordner === 'eingang';
  const geoeffnet = useRef(false);

  useEffect(() => {
    if (!g.daten || geoeffnet.current) return;
    geoeffnet.current = true;
    if (verfassen && g.daten.optionen.darfSenden) setSchreiben({});
    const m = oeffnenId ? g.daten.liste.find(x => String(x.id) === oeffnenId) : undefined;
    if (m) oeffnen(m);
  }, [g.daten]); // eslint-disable-line react-hooks/exhaustive-deps

  const offenBestaetigen = (m: Mitteilung) => eingang && m.lesebestaetigung && !m.bestaetigt;
  const kopfName = (m: Mitteilung) => (eingang ? m.absender : ordner === 'entwuerfe' ? m.empfaengerText || 'Entwurf' : m.empfaengerText || m.empfaenger.join(', '));
  const merkmale = (m: Mitteilung) => [eingang && !m.gelesen ? 'ungelesen' : '', m.wichtig ? 'wichtig' : '', m.anhaenge?.length ? 'anhang' : '', offenBestaetigen(m) ? 'bestaetigen' : ''];

  function oeffnen(m: Mitteilung) {
    if (ordner === 'entwuerfe') { setSchreiben({ entwurf: m }); return; }
    setLesen(m);
    if (eingang && !m.gelesen) {
      senden(`${BASIS}/${m.id}/gelesen`, {}).then(() => {
        g.setDaten(d => ({ ...d!, liste: d!.liste.map(x => (x.id === m.id ? { ...x, gelesen: new Date().toISOString() } : x)) }));
        void s.neuLaden();
      }).catch(() => { /* nicht kritisch */ });
    }
  }
  const nachSenden = (ziel: string) => { if (location.hash === ziel) void g.neu(); else navigieren(ziel); };

  return (
    <Seite titel={TITEL[ordner]} aktionen={g.daten?.optionen.darfSenden && <Button variant="contained" onClick={() => setSchreiben({})}>Neue Mitteilung</Button>}
      filter={<>
        <SuchFeld wert={suche} onWert={setSuche} platzhalter="Inhalt oder Person suchen" breite={320} />
        <Wahl label="Anzeigen" wert={merkmal} onWert={setMerkmal} alle="Alle" breite={200}
          optionen={[...(eingang ? [['ungelesen', 'Ungelesen'], ['bestaetigen', 'Lesebestätigung offen']] as [string, string][] : []), ['wichtig', 'Wichtig'], ['anhang', 'Mit Anhang']]} />
      </>}>
      <Geladen g={g}>{({ liste, optionen }) => {
        const f = suche.trim().toLowerCase();
        const gezeigt = liste
          .filter(m => (!f || `${m.betreff} ${m.absender} ${m.text} ${m.empfaenger.join(' ')} ${m.empfaengerText ?? ''} ${(m.anhaenge ?? []).map(x => x.name).join(' ')}`.toLowerCase().includes(f))
            && (!merkmal || merkmale(m).includes(merkmal)))
          .sort((x, y) => Number(offenBestaetigen(y)) - Number(offenBestaetigen(x)));
        return (
          <>
            {!liste.length ? <Leer text={ordner === 'gesendet' ? 'Noch keine Mitteilungen gesendet.' : ordner === 'entwuerfe' ? 'Keine Entwürfe.' : 'Keine Mitteilungen.'} />
              : !gezeigt.length ? <Leer text="Keine Treffer." />
              : (
                <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                  <List disablePadding>
                    {gezeigt.map((m, i) => {
                      const neu = eingang && !m.gelesen;
                      return (
                        <Box key={m.id}>
                          {i > 0 && <Divider component="li" />}
                          <ListItemButton onClick={() => oeffnen(m)} sx={{ gap: 1.5, py: 1.25, alignItems: 'center', position: 'relative', bgcolor: neu ? 'action.hover' : undefined }}>
                            {neu && <Box sx={{ position: 'absolute', left: 4, top: '50%', mt: '-4px', width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main' }} />}
                            <Box sx={{ minWidth: 0, flex: 1, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(140px, 220px) minmax(0, 1fr)' }, columnGap: 2, alignItems: 'baseline' }}>
                              <Typography noWrap sx={{ fontWeight: neu ? 600 : 500, fontSize: 14 }} title={kopfName(m)}>{kopfName(m)}</Typography>
                              <Typography noWrap sx={{ fontSize: 14, color: 'text.secondary' }}>
                                {m.wichtig && <Plakette ton="entfall" sx={{ mr: 0.75 }}>wichtig</Plakette>}
                                {m.antwortAuf ? <ReplyRounded sx={{ fontSize: 15, verticalAlign: '-3px', mr: 0.5 }} /> : null}
                                <Box component="span" sx={{ color: 'text.primary', fontWeight: neu ? 600 : 500 }}>{m.betreff || '(ohne Betreff)'}</Box>
                                <Box component="span" sx={{ mx: 0.75, color: 'divider' }}>|</Box>{klartext(m.text).slice(0, 240)}
                              </Typography>
                            </Box>
                            <Stack direction="row" gap={0.75} alignItems="center" sx={{ flexShrink: 0, color: 'text.secondary' }}>
                              {ordner === 'gesendet' && m.lesebestaetigung && (
                                <Tooltip title="Lesebestätigungen anzeigen"><Chip size="small" icon={<MarkEmailReadOutlined />} label={`${m.bestaetigtAnzahl} | ${m.anzahl}`}
                                  onClick={e => { e.stopPropagation(); setLb(m); }} color={m.bestaetigtAnzahl >= m.anzahl ? 'success' : 'default'} variant="outlined" /></Tooltip>
                              )}
                              {offenBestaetigen(m) && <Tooltip title="Lesebestätigung erforderlich"><MarkEmailUnreadOutlined fontSize="small" color="warning" /></Tooltip>}
                              {!!m.anhaenge?.length && <AttachFileRounded fontSize="small" aria-label="mit Anhang" />}
                              <Typography variant="caption" sx={{ minWidth: 48, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{zeitKurz(m.erstellt)}</Typography>
                            </Stack>
                          </ListItemButton>
                        </Box>
                      );
                    })}
                  </List>
                </Paper>
              )}
            {lesen && (
              <LesenDialog m={lesen} ordner={ordner} optionen={optionen} onClose={() => setLesen(null)} onLb={() => setLb(lesen)}
                onSchreiben={v => { setLesen(null); setSchreiben(v); }}
                onBestaetigt={b => { setLesen({ ...lesen, bestaetigt: b }); g.setDaten(d => ({ ...d!, liste: d!.liste.map(x => (x.id === lesen.id ? { ...x, bestaetigt: b } : x)) })); }}
                onGeaendert={async ziel => { setLesen(null); await s.neuLaden(); nachSenden(ziel); }} />
            )}
            {schreiben && (
              <SchreibDialog {...schreiben} onClose={() => { setSchreiben(null); if (verfassen) navigieren('#/mitteilungen', true); }}
                fertig={ziel => { setSchreiben(null); nachSenden(ziel); }} />
            )}
            {lb && <LesebestaetigungenDialog m={lb} onClose={() => setLb(null)} />}
          </>
        );
      }}</Geladen>
    </Seite>
  );
}

function LesenDialog({ m, ordner, optionen, onClose, onSchreiben, onBestaetigt, onGeaendert, onLb }: {
  m: Mitteilung; ordner: Ordner; optionen: Optionen; onClose: () => void; onSchreiben: (v: SchreibVorgabe) => void; onBestaetigt: (b: string) => void;
  onGeaendert: (ziel: string) => void; onLb: () => void;
}) {
  const t = useTheme();
  const mobil = useMediaQuery(t.breakpoints.down('sm'));
  const eingang = ordner === 'eingang';
  const kannAntworten = eingang && optionen.darfSenden;
  const [laeuft, setLaeuft] = useState(false);
  const an = m.empfaenger.length > 6 ? `${m.empfaenger.slice(0, 6).join(', ')} und ${m.empfaenger.length - 6} weitere` : m.empfaenger.join(', ');
  const aktion = async (f: () => Promise<void>) => { setLaeuft(true); try { await f(); } catch (err) { fehler(err); } finally { setLaeuft(false); } };
  const antworten = (alle: boolean) => aktion(async () => onSchreiben({ vorgabe: await holen(`${BASIS}/${m.id}/antwort${alle ? '?alle=true' : ''}`), titel: alle ? 'Allen antworten' : 'Antworten' }));
  const knopf = (titel: string, icon: React.ReactNode, onClick: () => void, farbe?: 'error') => (
    <Tooltip title={titel}><span><IconButton aria-label={titel} onClick={onClick} disabled={laeuft} color={farbe}>{icon}</IconButton></span></Tooltip>
  );
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth fullScreen={mobil} className="mt-lesen">
      <DialogTitle sx={{ pr: 6 }}>
        <Stack direction="row" gap={1} alignItems="center">{m.wichtig && <Plakette ton="entfall" fest><PriorityHighRounded sx={{ fontSize: 14 }} />wichtig</Plakette>}<span>{m.betreff || '(ohne Betreff)'}</span></Stack>
        <IconButton onClick={onClose} aria-label="Schließen" sx={{ position: 'absolute', right: 10, top: 10 }} className="nicht-drucken"><CloseRounded /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack direction="row" gap={1.5} alignItems="flex-start" sx={{ mb: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {eingang ? (
              <>
                <Typography sx={{ fontWeight: 600 }}>{m.absender}{m.absenderRolle && <Plakette sx={{ ml: 1 }}>{m.absenderRolle}</Plakette>}</Typography>
                {m.empfaenger.length > 0 && <Typography variant="body2" color="text.secondary">an {an}</Typography>}
              </>
            ) : (
              <>
                <Typography sx={{ fontWeight: 600 }}>An: {m.empfaengerText || m.empfaenger.join(', ')}</Typography>
                <Typography variant="body2" color="text.secondary">{m.anzahl} Empfänger*innen · {m.gelesenAnzahl} gelesen</Typography>
              </>
            )}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>{zeitLang(m.erstellt)}</Typography>
        </Stack>
        <Markdown text={m.text} />
        {!!m.anhaenge?.length && (
          <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 2.5 }}>
            {m.anhaenge.map(x => (
              <Chip key={x.id} component="a" href={`${BASIS}/anhang/${x.id}`} clickable icon={<InsertDriveFileOutlined />} variant="outlined"
                label={<>{x.name} <Box component="span" sx={{ color: 'text.secondary', ml: 0.5 }}>{groesse(x.groesse)}</Box></>} {...{ download: x.name }} />
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions className="nicht-drucken" sx={{ px: 2, py: 1, gap: 0.5, flexWrap: 'wrap' }}>
        {knopf('Drucken', <PrintOutlined />, () => window.print())}
        {kannAntworten && knopf('Antworten', <ReplyRounded />, () => void antworten(false))}
        {kannAntworten && m.empfaenger.length > 1 && knopf('Allen antworten', <ReplyAllRounded />, () => void antworten(true))}
        {optionen.darfSenden && knopf('Weiterleiten', <ForwardOutlined />, () => void aktion(async () => onSchreiben({ entwurf: await senden<Mitteilung>(`${BASIS}/${m.id}/weiterleiten`, {}), titel: 'Weiterleiten' })))}
        {!eingang && m.lesebestaetigung && <Chip icon={<MarkEmailReadOutlined />} label={`${m.bestaetigtAnzahl} | ${m.anzahl} bestätigt`} onClick={onLb} variant="outlined" sx={{ mx: 0.5 }} />}
        {eingang && knopf('Als ungelesen markieren', <MarkEmailUnreadOutlined />, () => void aktion(async () => { await senden(`${BASIS}/${m.id}/ungelesen`, {}); toast('Als ungelesen markiert.'); onGeaendert('#/mitteilungen'); }))}
        {knopf('Löschen', <DeleteOutlineRounded />, () => void aktion(async () => {
          if (!(await bestaetigen('Mitteilung löschen', `„${m.betreff}“ wirklich löschen?`))) return;
          await entfernen(`${BASIS}/${m.id}`); toast('Mitteilung gelöscht.');
          onGeaendert(ordner === 'gesendet' ? '#/mitteilungen/gesendet' : '#/mitteilungen');
        }), 'error')}
        <Box sx={{ ml: 'auto' }}>
          {eingang && m.lesebestaetigung && !m.bestaetigt && (
            <Button variant="contained" disabled={laeuft}
              onClick={() => void aktion(async () => { const r = await senden<{ bestaetigt: string }>(`${BASIS}/${m.id}/bestaetigen`, {}); toast('Lesebestätigung gesendet.'); onBestaetigt(r.bestaetigt); })}>Lesebestätigung senden</Button>
          )}
          {m.bestaetigt && <Typography variant="body2" color="success.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><CheckCircleOutlineRounded fontSize="small" />Lesebestätigung gesendet am {zeitLang(m.bestaetigt)}</Typography>}
        </Box>
      </DialogActions>
    </Dialog>
  );
}

function LesebestaetigungenDialog({ m, onClose }: { m: Mitteilung; onClose: () => void }) {
  const g = useLaden(sig => holen<{ bestaetigt: number; anzahl: number; empfaenger: { name: string; rolle: string; gelesen?: string | null; bestaetigt?: string | null }[] }>(`${BASIS}/${m.id}/lesebestaetigungen`, sig), [m.id]);
  return (
    <FormDialog offen titel={g.daten ? `Lesebestätigungen ${g.daten.bestaetigt} | ${g.daten.anzahl}` : 'Lesebestätigungen'} untertitel={`Betreff: ${m.betreff}`} onClose={onClose}>
      <Geladen g={g}>{d => (
        <List dense disablePadding>
          {d.empfaenger.map((x, i) => (
            <Stack key={i} direction="row" gap={1.5} alignItems="center" sx={{ py: 0.75, borderBottom: 1, borderColor: 'divider' }}>
              <Box sx={{ width: 22, color: x.bestaetigt ? 'success.main' : 'text.secondary' }}>{x.bestaetigt ? <CheckCircleOutlineRounded fontSize="small" /> : x.gelesen ? <VisibilityOutlined fontSize="small" titleAccess="gelesen, nicht bestätigt" /> : null}</Box>
              <Box sx={{ flex: 1 }}><Typography variant="body2" sx={{ fontWeight: 500 }}>{x.name}</Typography><Typography variant="caption" color="text.secondary">{x.rolle}</Typography></Box>
              <Typography variant="caption" color="text.secondary">{x.bestaetigt ? zeitLang(x.bestaetigt) : x.gelesen ? `gelesen ${zeitLang(x.gelesen)}` : '–'}</Typography>
            </Stack>
          ))}
        </List>
      )}</Geladen>
    </FormDialog>
  );
}

// ------------------------------------------------------------------ Empfänger*innen (Personensuche)

interface Person { id: string; name: string; anzeigename: string; login: string; kuerzel: string; initialen?: string; rollen: { art: string; text: string }[]; klassen: string[]; abteilungen: string[]; gruppen?: string[] }
interface Personen {
  personen: Person[]; gruppen?: { id: string; name: string; art: string; klasse?: string }[];
  filter: { listen?: { id: string; name: string; mitglieder: string[] }[]; klassen: string[]; abteilungen: string[]; rollen?: { id: string; name: string }[]; gruppen?: { id: string; name: string }[] };
}
type FilterSchluessel = 'liste' | 'klasse' | 'abteilung' | 'rolle' | 'gruppe';
const EW_FILTER: [FilterSchluessel, string, (d: Personen) => { id: string; name: string }[], (p: Person, w: string, d: Personen) => boolean][] = [
  ['liste', 'Liste (indiv.)', d => (d.filter.listen ?? []).map(l => ({ id: l.id, name: l.name })), (p, w, d) => (d.filter.listen?.find(l => l.id === w)?.mitglieder ?? []).includes(p.id)],
  ['klasse', 'Klasse', d => d.filter.klassen.map(k => ({ id: k, name: k })), (p, w) => p.klassen.includes(w)],
  ['abteilung', 'Abteilung', d => d.filter.abteilungen.map(x => ({ id: x, name: x })), (p, w) => p.abteilungen.includes(w)],
  ['rolle', 'Rolle', d => d.filter.rollen ?? [], (p, w) => p.rollen.some(r => r.art === w)],
  ['gruppe', 'Gruppe', d => d.filter.gruppen ?? [], (p, w) => (p.gruppen ?? []).includes(w)],
];
const DUNKEL = new Set(['lehrkraft', 'schulleitung', 'administration', 'schueler', 'eltern']);
const chipName = (p: Person) => (p.kuerzel && p.anzeigename && p.anzeigename !== p.kuerzel ? `${p.anzeigename} (${p.kuerzel})` : p.anzeigename || p.name);

function EmpfaengerDialog({ kollegium, gewaehlt, onClose, fertig }: { kollegium: boolean; gewaehlt: Map<string, string>; onClose: () => void; fertig: (m: Map<string, string>) => void }) {
  const g = useLaden(sig => holen<Personen>(`${BASIS}/personen?typ=${kollegium ? 'individuell' : 'kollegium'}`, sig), [kollegium]);
  const [neu, setNeu] = useState(() => new Map(gewaehlt));
  const [suche, setSuche] = useState('');
  const [nurGewaehlt, setNurGewaehlt] = useState(false);
  const [filter, setFilter] = useState<Partial<Record<FilterSchluessel, string>>>({});
  const [menue, setMenue] = useState<{ el: HTMLElement; k: FilterSchluessel } | null>(null);
  const umschalten = (id: string, name: string) => setNeu(alt => { const m = new Map(alt); if (m.has(id)) m.delete(id); else m.set(id, name); return m; });
  return (
    <FormDialog offen titel="Empfänger*innen" breite="md" onClose={onClose} aktionText="Übernehmen" aktion={() => fertig(neu)}>
      <Geladen g={g}>{d => {
        const f = suche.trim().toLowerCase();
        const passt = (p: Person) => (!f || `${p.name} ${p.anzeigename} ${p.login} ${p.kuerzel}`.toLowerCase().includes(f)) && (!nurGewaehlt || neu.has(p.id))
          && EW_FILTER.every(([k, , , pruef]) => !filter[k] || pruef(p, filter[k]!, d));
        const personen = d.personen.filter(passt);
        const gruppen = (d.gruppen ?? []).filter(x => x.art !== 'liste' && !(filter.liste || filter.abteilung || filter.rolle || filter.gruppe)
          && (!filter.klasse || x.klasse === filter.klasse) && (!nurGewaehlt || neu.has(x.id)) && (!f || x.name.toLowerCase().includes(f)));
        const alle = personen.length > 0 && personen.every(p => neu.has(p.id));
        const zeile = (id: string, name: string, chip: string, pills: React.ReactNode, titel?: string) => (
          <ListItemButton key={id} onClick={() => umschalten(id, chip)} sx={{ gap: 1.5, borderRadius: 1.5, py: 0.75 }} title={titel} role="checkbox" aria-checked={neu.has(id)}>
            <Checkbox edge="start" checked={neu.has(id)} tabIndex={-1} disableRipple sx={{ p: 0.5 }} />
            <Box sx={{ minWidth: 0 }}><Typography noWrap sx={{ fontSize: 14, fontWeight: 500 }}>{name}</Typography><Stack direction="row" gap={0.5} flexWrap="wrap">{pills}</Stack></Box>
          </ListItemButton>
        );
        return (
          <Stack gap={1.5}>
            <TextField autoFocus value={suche} onChange={e => setSuche(e.target.value)} placeholder={kollegium ? 'Kolleg*innen suchen' : 'Lehrkräfte suchen'} type="search"
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> } }} />
            <Stack direction="row" gap={0.75} sx={{ overflowX: 'auto', pb: 0.5 }}>
              <Chip label={`Ausgewählt${neu.size ? ` (${neu.size})` : ''}`} color={nurGewaehlt ? 'primary' : 'default'} variant={nurGewaehlt ? 'filled' : 'outlined'} onClick={() => setNurGewaehlt(!nurGewaehlt)} />
              {EW_FILTER.map(([k, titel, optionen]) => {
                if (!optionen(d).length && (!kollegium || (k === 'liste' && !d.filter.listen))) return null;
                const wert = filter[k] ? optionen(d).find(o => o.id === filter[k])?.name ?? filter[k] : '';
                return <Chip key={k} label={wert ? `${titel.replace(/ \(.*\)/, '')}: ${wert}` : titel} color={wert ? 'primary' : 'default'} variant={wert ? 'filled' : 'outlined'}
                  deleteIcon={<ExpandMoreRounded />} onDelete={e => setMenue({ el: (e.currentTarget as HTMLElement).parentElement!, k })} onClick={e => setMenue({ el: e.currentTarget, k })} />;
              })}
            </Stack>
            {menue && (() => {
              const [, titel, optionen] = EW_FILTER.find(x => x[0] === menue.k)!;
              const opts = [{ id: '', name: `Alle (${titel.replace(/ \(.*\)/, '')})` }, ...optionen(d)];
              return (
                <Menu open anchorEl={menue.el} onClose={() => setMenue(null)} slotProps={{ paper: { sx: { maxHeight: 360 } } }}>
                  {opts.map(o => <MenuItem key={o.id} selected={(filter[menue.k] ?? '') === o.id} onClick={() => { setFilter({ ...filter, [menue.k]: o.id || undefined }); setMenue(null); }}>{o.name}</MenuItem>)}
                  {opts.length === 1 && <MenuItem disabled>{menue.k === 'liste' ? 'Keine eigenen Listen angelegt' : menue.k === 'abteilung' ? 'Keine Abteilungen hinterlegt' : 'Keine Einträge'}</MenuItem>}
                </Menu>
              );
            })()}
            <List dense disablePadding sx={{ maxHeight: { xs: 'none', sm: 420 }, overflow: 'auto', mx: -1 }}>
              {personen.length > 0 && (
                <ListItemButton sx={{ gap: 1.5, borderRadius: 1.5 }} onClick={() => setNeu(alt => { const m = new Map(alt); personen.forEach(p => (alle ? m.delete(p.id) : m.set(p.id, chipName(p)))); return m; })}>
                  <Checkbox edge="start" checked={alle} indeterminate={!alle && personen.some(p => neu.has(p.id))} tabIndex={-1} disableRipple sx={{ p: 0.5 }} />
                  <Typography sx={{ fontSize: 14, fontWeight: 500 }}>Alle auswählen ({personen.length})</Typography>
                </ListItemButton>
              )}
              {personen.map(p => zeile(p.id, p.name, chipName(p),
                p.rollen.map((r, i) => <Plakette key={i} ton={DUNKEL.has(r.art) ? 'primaer' : 'neutral'}>{r.text}</Plakette>), p.anzeigename !== p.name ? p.anzeigename : undefined))}
              {gruppen.length > 0 && <Typography variant="overline" color="text.secondary" sx={{ display: 'block', px: 1.5, pt: 1.5 }}>Gruppen und Klassen</Typography>}
              {gruppen.map(x => zeile(x.id, x.name, x.name,
                <Plakette>{x.art === 'klasse' ? 'Klasse' : 'Gruppe'}</Plakette>))}
              {!personen.length && !gruppen.length && <Typography color="text.secondary" sx={{ p: 2 }}>{f || nurGewaehlt || Object.values(filter).some(Boolean) ? 'Keine Treffer.' : 'Keine Empfänger*innen verfügbar.'}</Typography>}
            </List>
          </Stack>
        );
      }}</Geladen>
    </FormDialog>
  );
}

// ------------------------------------------------------------------ Schreiben

function SchreibDialog({ an, vorgabe, entwurf, titel, onClose, fertig }: SchreibVorgabe & { onClose: () => void; fertig: (ziel: string) => void }) {
  const t = useTheme();
  const mobil = useMediaQuery(t.breakpoints.down('sm'));
  const g = useLaden(async sig => {
    const [empfaenger, optionen] = await Promise.all([holen<Empfaenger[]>(`${BASIS}/empfaenger`, sig), holen<Optionen>(`${BASIS}/optionen`, sig)]);
    return { empfaenger, optionen };
  }, []);
  const [gewaehlt, setGewaehlt] = useState<Map<string, string>>(new Map());
  const [betreff, setBetreff] = useState(entwurf?.betreff ?? vorgabe?.betreff ?? '');
  const [text, setText] = useState(entwurf?.text ?? vorgabe?.text ?? '');
  const [lesebestaetigung, setLb] = useState(!!entwurf?.lesebestaetigung);
  const [wichtig, setWichtig] = useState(!!entwurf?.wichtig);
  const [vorschau, setVorschau] = useState(false);
  const [vorhandene, setVorhandene] = useState<Anhang[]>(entwurf?.anhaenge ?? []);
  const [dateien, setDateien] = useState<File[]>([]);
  const [wahl, setWahl] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const entwurfId = useRef<number | null>(entwurf?.id ?? null);
  const antwortAuf = vorgabe?.antwortAuf ?? entwurf?.antwortAuf ?? null;

  useEffect(() => {
    if (!g.daten) return;
    const namen = new Map(g.daten.empfaenger.map(x => [x.id, x.name]));
    const m = new Map<string, string>();
    for (const x of vorgabe?.empfaenger ?? []) m.set(x.id, x.name);
    for (const id of entwurf?.entwurfEmpfaenger ?? (an ? [an] : [])) m.set(id, namen.get(id) ?? 'Empfänger*in');
    setGewaehlt(m);
  }, [g.daten]); // eslint-disable-line react-hooks/exhaustive-deps

  const o = g.daten?.optionen;
  const nurAntwort = !!o && !o.darfSenden;
  const gesperrt = !!o && ((nurAntwort && !(o.darfAntworten && antwortAuf)) || (!g.daten!.empfaenger.length && !vorgabe?.empfaenger?.length && !entwurf?.antwortAuf));
  const werte = () => ({ empfaenger: [...gewaehlt.keys()], betreff, text, wichtig, lesebestaetigung, antwortAuf });
  const speichernEntwurf = async () => {
    entwurfId.current = (await senden<{ id: number }>(`${BASIS}/entwurf`, { id: entwurfId.current, ...werte() })).id;
    const hoch: Anhang[] = [];
    for (const d of dateien) {
      const fd = new FormData();
      fd.append('datei', d);
      hoch.push(await api<Anhang>(`${BASIS}/${entwurfId.current}/anhaenge`, { methode: 'POST', formular: fd }));
    }
    setDateien([]);
    setVorhandene(v => [...v, ...hoch]);
    return entwurfId.current;
  };
  const los = async (f: () => Promise<void>) => { setLaeuft(true); try { await f(); } catch (err) { fehler(err); } finally { setLaeuft(false); } };
  const dateienWaehlen = (liste: FileList | null) => {
    if (!o || !liste) return;
    const neu = [...dateien];
    for (const d of Array.from(liste)) {
      if (d.size > o.maxAnhangMb * 1024 * 1024) { toast(`${d.name} ist größer als ${o.maxAnhangMb} MB.`, true); continue; }
      if (neu.length + vorhandene.length >= o.maxAnhaenge) { toast(`Höchstens ${o.maxAnhaenge} Anhänge.`, true); break; }
      neu.push(d);
    }
    setDateien(neu);
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth fullScreen={mobil}>
      <DialogTitle sx={{ pr: 6 }}>{titel ?? (entwurf ? 'Entwurf bearbeiten' : vorgabe ? 'Antworten' : 'Neue Mitteilung')}
        <IconButton onClick={onClose} aria-label="Schließen" sx={{ position: 'absolute', right: 10, top: 10 }}><CloseRounded /></IconButton></DialogTitle>
      <DialogContent dividers>
        <Geladen g={g}>{() => gesperrt ? (
          <Alert severity="info">{nurAntwort ? 'Ihr Konto darf keine Mitteilungen senden.' : 'Für Ihr Konto sind keine Empfänger verfügbar.'}</Alert>
        ) : (
          <Stack gap={2}>
            <Stack direction="row" gap={1} alignItems="center" sx={{ borderBottom: 1, borderColor: 'divider', pb: 1.25 }}>
              <Typography color="text.secondary" sx={{ width: 64, flexShrink: 0 }}>An</Typography>
              <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ flex: 1 }}>
                {[...gewaehlt].map(([id, name]) => <Chip key={id} label={name.replace(/\s*\(.*?\)\s*/, ' ').replace(/\s+–.*/, '').trim()} title={name} color="primary" size="small"
                  onDelete={() => setGewaehlt(m => { const n = new Map(m); n.delete(id); return n; })} />)}
                {!gewaehlt.size && <Typography color="text.secondary" variant="body2">Empfänger*innen über + auswählen</Typography>}
              </Stack>
              {!nurAntwort && <Tooltip title="Empfänger*innen auswählen"><IconButton onClick={() => setWahl(true)} color="primary" aria-label="Empfänger*innen auswählen"><AddRounded /></IconButton></Tooltip>}
            </Stack>
            <TextField label="Betreff" value={betreff} onChange={e => setBetreff(e.target.value)} required slotProps={{ htmlInput: { maxLength: 200 } }} />
            {vorschau
              ? <Paper variant="outlined" sx={{ p: 2, minHeight: 300 }}>{text.trim() ? <Markdown text={text} /> : <Typography color="text.secondary">Kein Text.</Typography>}</Paper>
              : <TextField multiline minRows={12} value={text} onChange={e => setText(e.target.value)} placeholder="Text hier eingeben" aria-label="Nachricht"
                helperText="Formatierung: **fett**, *kursiv*, ~~durchgestrichen~~, # Überschrift, - Liste, [Link](https://…)" />}
            {(vorhandene.length > 0 || dateien.length > 0) && (
              <Stack direction="row" gap={1} flexWrap="wrap">
                {vorhandene.map(x => <Chip key={'v' + x.id} icon={<InsertDriveFileOutlined />} variant="outlined" label={`${x.name} · ${groesse(x.groesse)}`}
                  onDelete={() => void los(async () => { await entfernen(`${BASIS}/anhaenge/${x.id}`); setVorhandene(v => v.filter(y => y.id !== x.id)); })} />)}
                {dateien.map((d, i) => <Chip key={'n' + i} icon={<InsertDriveFileOutlined />} variant="outlined" label={`${d.name} · ${groesse(d.size)}`} onDelete={() => setDateien(l => l.filter((_, j) => j !== i))} />)}
              </Stack>
            )}
          </Stack>
        )}</Geladen>
      </DialogContent>
      {o && !gesperrt && (
        <DialogActions sx={{ px: 2, py: 1.25, gap: 0.75, flexWrap: 'wrap' }}>
          <Button variant="outlined" onClick={() => void los(async () => { await speichernEntwurf(); toast('Entwurf gespeichert.'); fertig('#/mitteilungen/entwuerfe'); })} disabled={laeuft}>Speichern</Button>
          <Tooltip title="Lesebestätigung anfordern"><ToggleButton value="lb" size="small" selected={lesebestaetigung} onChange={() => setLb(!lesebestaetigung)} aria-label="Lesebestätigung anfordern"><MarkEmailReadOutlined fontSize="small" /></ToggleButton></Tooltip>
          {o.wichtig && <Tooltip title="Als wichtig markieren"><ToggleButton value="w" size="small" selected={wichtig} onChange={() => setWichtig(!wichtig)} aria-label="Als wichtig markieren"><PriorityHighRounded fontSize="small" /></ToggleButton></Tooltip>}
          {o.maxAnhaenge > 0 && (
            <Tooltip title={`Anhang hinzufügen (höchstens ${o.maxAnhaenge} Dateien, je ${o.maxAnhangMb} MB)`}>
              <ToggleButton value="a" size="small" component="label" selected={false} aria-label="Anhang hinzufügen"><AttachFileRounded fontSize="small" />
                <input type="file" multiple hidden onChange={e => { dateienWaehlen(e.target.files); e.target.value = ''; }} /></ToggleButton>
            </Tooltip>
          )}
          <Tooltip title="Vorschau"><ToggleButton value="v" size="small" selected={vorschau} onChange={() => setVorschau(!vorschau)} aria-label="Vorschau"><VisibilityOutlined fontSize="small" /></ToggleButton></Tooltip>
          <Box sx={{ flex: 1 }} />
          <Button variant="outlined" onClick={onClose}>Abbrechen</Button>
          <Button variant="contained" disabled={laeuft} onClick={() => void los(async () => {
            if (!gewaehlt.size) { toast('Bitte mindestens einen Empfänger auswählen.', true); return; }
            if (!betreff.trim()) { toast('Bitte einen Betreff eingeben.', true); return; }
            if (entwurfId.current || dateien.length) { const id = await speichernEntwurf(); await senden(`${BASIS}/${id}/senden`, {}); }
            else await senden(BASIS, werte());
            toast('Mitteilung gesendet.');
            fertig('#/mitteilungen/gesendet');
          })}>Senden</Button>
        </DialogActions>
      )}
      {wahl && o && <EmpfaengerDialog kollegium={!!o.listen} gewaehlt={gewaehlt} onClose={() => setWahl(false)} fertig={m => setGewaehlt(new Map(m))} />}
    </Dialog>
  );
}

// ------------------------------------------------------------------ Listen (eigene Verteiler)

const KATEGORIEN: [string, string][] = [['lehrkraefte', 'Lehrkräfte'], ['klassen', 'Klassen'], ['schueler', 'Schüler*innen'], ['eltern', 'Erziehungsberechtigte'], ['gruppen', 'Gruppen'], ['listen', 'Listen']];

/** Empfängerauswahl nach Kategorien (Reiter), mit Suche und Klassenfilter. */
function KategorieAuswahl({ empfaenger, gewaehlt, setGewaehlt }: { empfaenger: Empfaenger[]; gewaehlt: Map<string, string>; setGewaehlt: (m: Map<string, string>) => void }) {
  const kategorien = KATEGORIEN.filter(([k]) => empfaenger.some(x => x.kategorie === k));
  const [reiter, setReiter] = useState(kategorien[0]?.[0] ?? '');
  const [suche, setSuche] = useState('');
  const [klasse, setKlasse] = useState('');
  const inKat = empfaenger.filter(x => x.kategorie === reiter);
  const klassen = [...new Set(inKat.map(x => x.klasse).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
  const sichtbar = inKat.filter(x => (!suche || x.name.toLowerCase().includes(suche.toLowerCase())) && (!klasse || x.klasse === klasse));
  const alle = sichtbar.length > 0 && sichtbar.every(x => gewaehlt.has(x.id));
  const setzen = (l: Empfaenger[], an: boolean) => { const m = new Map(gewaehlt); l.forEach(x => (an ? m.set(x.id, x.name) : m.delete(x.id))); setGewaehlt(m); };
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography sx={{ fontWeight: 600 }}>Mitglieder</Typography><Typography variant="body2" color="text.secondary">{gewaehlt.size} ausgewählt</Typography></Stack>
      <Tabs value={reiter} onChange={(_, v) => { setReiter(v); setKlasse(''); }} variant="scrollable" sx={{ mb: 1 }}>{kategorien.map(([k, t]) => <Tab key={k} value={k} label={t} />)}</Tabs>
      <Stack direction="row" gap={1} sx={{ mb: 1 }} flexWrap="wrap">
        <SuchFeld wert={suche} onWert={setSuche} breite={240} />
        {klassen.length > 1 && <Wahl label="Klasse" wert={klasse} onWert={setKlasse} alle="Alle Klassen" optionen={klassen.map(k => [k, k])} breite={160} />}
      </Stack>
      <FormControlLabel control={<Checkbox checked={alle} onChange={e => setzen(sichtbar, e.target.checked)} />} label="Alle auswählen" />
      <Box sx={{ maxHeight: 300, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
        {sichtbar.map(x => (
          <FormControlLabel key={x.id} sx={{ display: 'flex', mx: 0, px: 1, borderBottom: 1, borderColor: 'divider' }}
            control={<Checkbox size="small" checked={gewaehlt.has(x.id)} onChange={e => setzen([x], e.target.checked)} />}
            label={<Stack direction="row" gap={1} alignItems="center"><span>{x.name}</span>{x.art && !['gruppe', 'klasse', 'liste'].includes(x.art) && <Plakette>{x.art}</Plakette>}</Stack>} />
        ))}
        {!sichtbar.length && <Typography color="text.secondary" sx={{ p: 2 }}>Keine Empfänger in dieser Gruppe.</Typography>}
      </Box>
    </Box>
  );
}

interface Liste { id: number; name: string; mitglieder: string[]; namen: string[]; erstellt: string }

function Listen() {
  const g = useLaden(sig => holen<Liste[]>(`${BASIS}/listen`, sig), []);
  const [formular, setFormular] = useState<{ l: Liste | null } | null>(null);
  const [schreiben, setSchreiben] = useState<string | null>(null);
  return (
    <Seite titel="Listen" untertitel="Eigene Listen fassen Empfänger zusammen (Personen, Klassen, Gruppen). Beim Schreiben erscheinen sie im Filter „Liste“."
      aktionen={<Button variant="contained" onClick={() => setFormular({ l: null })}>Erstellen</Button>}>
      <Geladen g={g}>{liste => (
        <Tabelle zeilen={liste} schluessel={l => l.id} leer="Noch keine Listen angelegt." onZeile={l => setFormular({ l })}
          spalten={[
            { id: 'name', kopf: 'Name', sortWert: l => l.name, zelle: l => <b>{l.name}</b> },
            { id: 'mitglieder', kopf: 'Mitglieder', zelle: l => <Typography variant="body2" sx={{ maxWidth: 520 }}>{l.namen.join(', ')}</Typography> },
            { id: 'erstellt', kopf: 'erstellt', sortWert: l => l.erstellt, zelle: l => zeitKurz(l.erstellt), verbergenMobil: true, nowrap: true },
            { id: 'akt', kopf: '', rechts: true, nowrap: true, zelle: l => (
              <Stack direction="row" gap={0.5} justifyContent="flex-end" onClick={e => e.stopPropagation()}>
                <Button size="small" variant="outlined" onClick={() => setSchreiben('liste:' + l.id)}>Schreiben</Button>
                <IconButton size="small" aria-label="Bearbeiten" onClick={() => setFormular({ l })}><EditOutlined fontSize="small" /></IconButton>
                <IconButton size="small" color="error" aria-label="Löschen" onClick={async () => {
                  if (!(await bestaetigen('Liste löschen', `Liste „${l.name}“ löschen?`))) return;
                  try { await entfernen(`${BASIS}/listen/${l.id}`); void g.neu(); } catch (err) { fehler(err); }
                }}><DeleteOutlineRounded fontSize="small" /></IconButton>
              </Stack>
            ) },
          ]} />
      )}</Geladen>
      {formular && <ListenFormular l={formular.l} onClose={() => setFormular(null)} fertig={() => void g.neu()} />}
      {schreiben && <SchreibDialog an={schreiben} onClose={() => setSchreiben(null)} fertig={ziel => { setSchreiben(null); navigieren(ziel); }} />}
    </Seite>
  );
}

function ListenFormular({ l, onClose, fertig }: { l: Liste | null; onClose: () => void; fertig: () => void }) {
  const g = useLaden(async sig => (await holen<Empfaenger[]>(`${BASIS}/empfaenger`, sig)).filter(x => x.art !== 'liste'), []);
  const [name, setName] = useState(l?.name ?? '');
  const [gewaehlt, setGewaehlt] = useState(() => new Map((l?.mitglieder ?? []).map((id, i) => [id, l!.namen[i] ?? id])));
  return (
    <FormDialog offen titel={l ? `Liste ${l.name}` : 'Neue Liste'} breite="md" onClose={onClose} aktion={async () => {
      if (!name.trim()) { toast('Bitte einen Namen eingeben.', true); return false; }
      await senden(l ? `${BASIS}/listen/${l.id}` : `${BASIS}/listen`, { name, mitglieder: [...gewaehlt.keys()] }, l ? 'PUT' : 'POST');
      toast('Liste gespeichert.'); fertig();
    }}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        <TextField label="Name" value={name} onChange={e => setName(e.target.value)} required />
        <Geladen g={g}>{empfaenger => <KategorieAuswahl empfaenger={empfaenger} gewaehlt={gewaehlt} setGewaehlt={setGewaehlt} />}</Geladen>
      </Stack>
    </FormDialog>
  );
}

// ------------------------------------------------------------------ Einstellungen (Administration)

type Einst = Record<string, boolean | number> & { gesperrt?: number[] };
const SCHALTER: ([string, string, string?] | string)[] = [
  'Lehrkräfte',
  ['lehrerAnFamilie', 'Lehrkräfte schreiben Schüler*innen und Erziehungsberechtigten', 'Einzelne Personen sowie Schüler*innen bzw. Erziehungsberechtigte einer Klasse. Schulleitung und Konten mit dem Recht „Nachrichten“ dürfen immer.'],
  ['lehrerNurEigeneKlassen', 'nur in den eigenen Klassen', 'Klassen mit eigenem Unterricht bzw. eigener Klassenleitung.'],
  'Schüler*innen und Erziehungsberechtigte',
  ['elternSenden', 'Erziehungsberechtigte dürfen Mitteilungen schreiben'],
  ['schuelerSenden', 'Schüler*innen dürfen Mitteilungen schreiben'],
  ['familieAnKlassenleitung', 'an die Klassenleitung'],
  ['familieAnLehrkraefte', 'an alle Lehrkräfte der Klasse'],
  ['familieAnLeitung', 'an die Schulleitung'],
  ['familieAntworten', 'auf erhaltene Mitteilungen antworten', 'Auch wenn sie dem Absender sonst nicht schreiben dürften.'],
];

function Einstellungen() {
  const g = useLaden(sig => holen<{ einstellungen: Einst; benutzer: { id: number; name: string; rolle: string }[] }>(`${BASIS}/einstellungen`, sig), []);
  const [x, setX] = useState<Einst | null>(null);
  const [gesperrt, setGesperrt] = useState<Set<number>>(new Set());
  const [suche, setSuche] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  useEffect(() => { if (g.daten) { setX(g.daten.einstellungen); setGesperrt(new Set(g.daten.einstellungen.gesperrt ?? [])); } }, [g.daten]);
  const konten = useMemo(() => (g.daten?.benutzer ?? []).filter(b => !suche || `${b.name} ${b.rolle}`.toLowerCase().includes(suche.toLowerCase())), [g.daten, suche]);
  const zahl = (name: string, label: string, min: number, max: number) => (
    <TextField type="number" label={label} value={x?.[name] ?? ''} onChange={e => setX({ ...x!, [name]: Number(e.target.value) })} slotProps={{ htmlInput: { min, max } }} sx={{ width: 240 }} />
  );
  return (
    <Seite titel="Einstellungen Mitteilungen" aktionen={<Button variant="contained" disabled={!x || laeuft} onClick={async () => {
      setLaeuft(true);
      try { await senden(`${BASIS}/einstellungen`, { ...x, gesperrt: [...gesperrt] }, 'PUT'); toast('Einstellungen gespeichert.'); } catch (err) { fehler(err); } finally { setLaeuft(false); }
    }}>Speichern</Button>}>
      <Geladen g={g}>{() => x && (
        <Stack gap={2.5} sx={{ maxWidth: 880 }}>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="h3" sx={{ mb: 1 }}>Wer darf an wen schreiben?</Typography>
            {SCHALTER.map((sch, i) => typeof sch === 'string'
              ? <Typography key={i} variant="overline" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>{sch}</Typography>
              : (
                <FormControlLabel key={sch[0]} sx={{ display: 'flex', alignItems: 'flex-start', my: 0.5, ml: 0 }} control={<Switch checked={!!x[sch[0]]} onChange={e => setX({ ...x, [sch[0]]: e.target.checked })} />}
                  label={<Box sx={{ pt: 0.75 }}><Typography sx={{ fontWeight: 500 }}>{sch[1]}</Typography>{sch[2] && <Typography variant="body2" color="text.secondary">{sch[2]}</Typography>}</Box>} />
              ))}
          </Paper>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="h3" sx={{ mb: 2 }}>Anhänge und Aufbewahrung</Typography>
            <Stack direction="row" gap={2} flexWrap="wrap">
              {zahl('maxAnhangMb', 'Größe je Anhang (MB)', 1, 25)}
              {zahl('maxAnhaenge', 'Anhänge je Mitteilung', 0, 10)}
              {zahl('aufbewahrungTage', 'Automatisch löschen nach (Tagen)', 30, 3650)}
            </Stack>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" sx={{ mb: 1 }}><Typography variant="h3">Sperren</Typography><Box sx={{ flex: 1 }} /><Plakette ton={gesperrt.size ? 'entfall' : 'neutral'}>{gesperrt.size} gesperrt</Plakette></Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Gesperrte Konten können Mitteilungen lesen, aber keine senden.</Typography>
            <SuchFeld wert={suche} onWert={setSuche} platzhalter="Konto suchen" />
            <Box sx={{ maxHeight: 360, overflow: 'auto', mt: 1.5, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
              {konten.map(b => (
                <FormControlLabel key={b.id} sx={{ display: 'flex', mx: 0, px: 1, borderBottom: 1, borderColor: 'divider' }}
                  control={<Checkbox size="small" checked={gesperrt.has(b.id)} onChange={e => setGesperrt(s => { const n = new Set(s); if (e.target.checked) n.add(b.id); else n.delete(b.id); return n; })} />}
                  label={<Stack direction="row" gap={1}><span>{b.name}</span><Plakette>{b.rolle}</Plakette></Stack>} />
              ))}
            </Box>
          </Paper>
        </Stack>
      )}</Geladen>
    </Seite>
  );
}
