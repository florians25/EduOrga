// Klassenbuch (Kollegium) im Klassenbuch-Bereich (Unternavigation components/klassenbuch/Bereich.tsx): „Meine Stunden“ – alle Unterrichte des
// Schuljahres je Tag (eigene Unterrichte, Lehrkraft der eigenen Klassen bzw. Suche für Administration/Schulleitung, Filter „Lehrstoff fehlt“
// und „Abwesenheiten nicht kontrolliert“) –, Wochenübersicht einer Klasse (Raster bzw. Tagesliste auf dem Telefon, Stand je Stunde:
// dokumentiert, offen, entfallen, geplant; Filter „Nur offene“, Sprung zu Datum), Fehlzeiten, Vermerke und Inhalte einer Klasse.
// Jede Stunde öffnet das Fenster „Unterrichtsstunde“. Klassenkonten: offene Hausaufgaben und Unterrichtsinhalte.
// Adressen: #/klassenbuch/<Kriterien|->/uebersicht/<Datum>/<Unterricht|->, #/klassenbuch/<Klasse>/(woche|fehlzeiten|vermerke|verlauf)/<Datum>[/<von>]
import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  alpha, Autocomplete, Box, Button, ButtonBase, Checkbox, Collapse, IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField,
  ToggleButton, ToggleButtonGroup, Tooltip, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import CheckRounded from '@mui/icons-material/CheckRounded';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import PersonOffOutlined from '@mui/icons-material/PersonOffOutlined';
import AccessTimeRounded from '@mui/icons-material/AccessTimeRounded';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import HomeWorkOutlined from '@mui/icons-material/HomeWorkOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import FlagOutlined from '@mui/icons-material/FlagOutlined';
import { api, holen, senden, qs } from '../../api/client';
import type { Elemente, Karte } from '../../api/types';
import { useSitzung } from '../../app/sitzung';
import { Abschnitt, Fehler, Geladen, Laden, Leer, Seite } from '../../components/Seite';
import { FormDialog, NamensAvatar, Plakette, SuchFeld, Wahl } from '../../components/Bausteine';
import { DatumFeld, ElementWahl } from '../../components/Auswahl';
import { Stundendetails } from '../../components/plan/Stundendetails';
import { karteAus } from '../../components/plan/karte';
import { gueltigeFarbe } from '../../components/plan/logik';
import { abwZeitraum, DatumZelle, DetailFelder, detailsVon, StatusLabel, STATUS_TEXT, Zaehlt, type Details } from '../../components/klassenbuch/fehlzeiten';
import { bestaetigen, toast } from '../../lib/meldungen';
import { datumDe, datumKurz, heuteIso, istIsoDatum, kalenderwoche, montag, plusTage, wochentag, wochentagKurz, MONATE, ausIso, hhmm, jetztMinuten } from '../../lib/datum';
import { kbKlasse, kbKlasseMerken } from '../../components/klassenbuch/Bereich';
import { navigieren } from '../../lib/router';
import { lesen, schreiben } from '../../lib/speicher';
import { useLaden } from '../../lib/useLaden';
import KlassenkontoHausaufgaben from './KlassenkontoHausaufgaben';
import type { SeitenProps } from '../register';

// ---------------------------------------------------------------- Übersicht
interface Krit { typ: 'klasse' | 'lehrer' | 'fach'; kurz: string }
export function kriterienAus(code?: string): Krit[] {
  if (!code || code === '-') return [];
  if (code.startsWith('@')) return [{ typ: 'lehrer', kurz: code.slice(1) }];
  if (!/^[klf]:/.test(code)) return [{ typ: 'klasse', kurz: code }];
  const TYP: Record<string, Krit['typ']> = { k: 'klasse', l: 'lehrer', f: 'fach' };
  return code.split(',').map(t => ({ typ: TYP[t[0]], kurz: t.slice(2) })).filter(x => x.typ && x.kurz);
}
export const kriterienCode = (l: Krit[]) => (l.length ? l.map(x => `${x.typ[0]}:${x.kurz}`).join(',') : '-');

interface UStunde { von: number; bis: number; beginn: string; ende: string; fach: string; fachName: string; farbe: string; art?: string; klassen: string[]; lehrer: string[]; raeume: string[]; status: string; unterricht: number; lehrstoff: string; geprueft: boolean; abwesend: number; entschuldigt: number; unentschuldigt?: number; hausaufgaben: string; verspaetet: number; eintraege: number }
interface UTag { datum: string; stunden: UStunde[]; eintraege: number; kw: number }
interface Unterricht { id: number; fach: string; klassen: string[]; lehrer: string[] }

export function AbwesenheitTags({ s, kommend }: { s: UStunde; kommend: boolean }) {
  if (s.status === 'entfall' || kommend) return null;
  const teile: React.ReactNode[] = [];
  if (s.abwesend) {
    const unent = s.unentschuldigt ?? 0, offen = s.abwesend - s.entschuldigt - unent;
    const [ton, text] = unent ? ['entfall', 'nicht entschuldigt'] as const : offen ? ['pruefung', 'offen'] as const : ['ok', 'entschuldigt'] as const;
    teile.push(<Tooltip key="a" title={`${s.abwesend} abwesend: ${s.entschuldigt} entschuldigt, ${offen} offen, ${unent} nicht entschuldigt`}><span><Plakette ton={ton}><b>{offen + unent}</b>/{s.abwesend} {text}</Plakette></span></Tooltip>);
  }
  if (s.verspaetet) teile.push(<Plakette key="v" ton="pruefung"><AccessTimeRounded sx={{ fontSize: 13 }} />{s.verspaetet} verspätet</Plakette>);
  if (teile.length) return <Stack direction="row" gap={0.5} flexWrap="wrap">{teile}</Stack>;
  return s.geprueft ? <Plakette ton="ok">Keine Abwesenheiten</Plakette> : <Plakette ton="warnung">Abwesenheiten prüfen</Plakette>;
}

function Uebersicht({ el, kritParam, datumParam, uParam }: { el: Elemente; kritParam?: string; datumParam?: string; uParam?: string }) {
  const s = useSitzung();
  const { ich } = s;
  const t = useTheme();
  const heute = heuteIso();
  const sjVon = s.sitzung.schuljahr?.von || plusTage(heute, -300), sjBis = s.sitzung.schuljahr?.bis || plusTage(heute, 300);
  const grenze = (d: string) => (d < sjVon ? sjVon : d > sjBis ? sjBis : d);
  const zielDatum = grenze(istIsoDatum(datumParam) ? datumParam : heute);
  const unterricht = /^\d+$/.test(uParam ?? '') ? Number(uParam) : null;
  const suchModus = ich.admin || !ich.element;
  const kriterien = kriterienAus(kritParam);
  const ziel = ({ k = kriterien, d = zielDatum, u = unterricht }: { k?: Krit[]; d?: string; u?: number | null } = {}) => `#/klassenbuch/${encodeURIComponent(kriterienCode(k))}/uebersicht/${d}/${u ?? '-'}`;
  const [filter, setFilterRoh] = useState<Set<string>>(() => new Set(lesen<string[]>('untplan:kbl-filter', [], true)));
  const setFilter = (f: Set<string>) => { setFilterRoh(f); schreiben('untplan:kbl-filter', [...f], true); };
  const [details, setDetails] = useState<{ k: Karte; liste: Karte[] } | null>(null);
  const eigeneKlassen = suchModus ? [] : el.klassen.filter(k => (k.leitung ?? []).some(l => l.toLowerCase() === ich.element.toLowerCase())).map(k => k.kurz);
  let lehrkraft = suchModus ? '' : kriterien.find(x => x.typ === 'lehrer' && eigeneKlassen.length)?.kurz ?? ich.element;
  if (!suchModus && lehrkraft.toLowerCase() !== ich.element.toLowerCase() && !eigeneKlassen.length) lehrkraft = ich.element;
  const fremd = !suchModus && lehrkraft.toLowerCase() !== ich.element.toLowerCase();
  const lehrerName = (k: string) => el.lehrer.find(l => l.kurz === k)?.name || k;
  const [bereich, setBereich] = useState(() => ({ von: grenze(plusTage(montag(zielDatum), -7)), bis: grenze(plusTage(zielDatum, 21)) }));

  const auswahl = useLaden(async () => {
    if (suchModus) return { unterrichte: [] as Unterricht[], kollegen: [] as string[] };
    const [eigene, ...klassenU] = await Promise.all([holen<Unterricht[]>(`/api/app/unterricht?lehrer=${encodeURIComponent(lehrkraft)}`).catch(() => []),
      ...eigeneKlassen.map(k => holen<Unterricht[]>(`/api/app/unterricht?klasse=${encodeURIComponent(k)}`).catch(() => []))]);
    const inKlassen = new Set(klassenU.flat().map(u => u.id));
    return { unterrichte: eigene.filter(u => u.klassen.length && (!fremd || inKlassen.has(u.id))),
      kollegen: [...new Set(klassenU.flat().flatMap(u => u.lehrer))].filter(l => l.toLowerCase() !== ich.element.toLowerCase()).sort((a, b) => a.localeCompare(b, 'de')) };
  }, [lehrkraft]);
  const abfrage = useMemo(() => {
    const q: Record<string, string> = {};
    if (suchModus) {
      const k = kriterien.filter(x => x.typ === 'klasse').map(x => x.kurz), l = kriterien.filter(x => x.typ === 'lehrer').map(x => x.kurz), f = kriterien.filter(x => x.typ === 'fach').map(x => x.kurz);
      if (!k.length && !l.length) return null;
      if (k.length) q.klasse = k.join(','); if (l.length) q.lehrer = l.join(','); if (f.length) q.fach = f.join(',');
    } else if (fremd) { q.klasse = eigeneKlassen.join(','); q.lehrer = lehrkraft; } else q.lehrer = ich.element;
    if (unterricht) q.unterricht = String(unterricht);
    return q;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kritParam, unterricht, lehrkraft]);
  const daten = useLaden(async () => {
    if (!abfrage) return [] as UTag[];
    const tage: UTag[] = [];
    for (let x = bereich.von; x <= bereich.bis; x = plusTage(x, 31)) {
      const y = plusTage(x, 30) < bereich.bis ? plusTage(x, 30) : bereich.bis;
      tage.push(...(await holen<{ tage: UTag[] }>(`/api/app/klassenbuch/uebersicht${qs({ ...abfrage, von: x, bis: y })}`)).tage);
    }
    return tage;
  }, [abfrage, bereich.von, bereich.bis]);
  const jetzt = hhmm(jetztMinuten());
  const kommend = (x: UStunde, d: string) => x.status !== 'entfall' && (d > heute || (d === heute && (x.beginn || '99:99') > jetzt));
  const passt = (x: UStunde, d: string) => !filter.size || (x.status !== 'entfall' && !kommend(x, d) && (!filter.has('lehrstoff') || !x.lehrstoff) && (!filter.has('kontrolle') || !x.geprueft));
  const mitLehrer = suchModus || fremd;
  const optionen: (Krit & { info: string })[] = [
    ...el.klassen.map(k => ({ typ: 'klasse' as const, kurz: k.kurz, info: k.name !== k.kurz ? k.name : '' })),
    ...el.lehrer.map(l => ({ typ: 'lehrer' as const, kurz: l.kurz, info: l.name })),
    ...el.faecher.map(f => ({ typ: 'fach' as const, kurz: f.kurz, info: f.name !== f.kurz ? f.name : '' })),
  ];
  const GRUPPE = { klasse: 'Klassen', lehrer: 'Lehrkräfte', fach: 'Fächer' };
  const karten: Karte[] = [];
  const tage = (daten.daten ?? []).slice().sort((a, b) => a.datum.localeCompare(b.datum));
  let letzteKw = -1;
  return (
    <Seite titel={suchModus ? 'Stunden suchen' : 'Meine Stunden'} untertitel={suchModus ? 'Unterrichte nach Klasse, Lehrkraft oder Fach – mit Thema, Anwesenheitskontrolle und Hausaufgaben.' : 'Ihre Unterrichte des Schuljahres je Tag – offene Dokumentation ist markiert.'} dokumentTitel="Klassenbuch – Stunden">
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2.5, borderRadius: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', position: 'sticky', top: { xs: 60, lg: 8 }, zIndex: 5 }} className="nicht-drucken">
        {suchModus ? (
          <Autocomplete multiple options={optionen} value={optionen.filter(o => kriterien.some(k => k.typ === o.typ && k.kurz === o.kurz))} groupBy={o => GRUPPE[o.typ]}
            getOptionLabel={o => o.kurz} isOptionEqualToValue={(a, b) => a.typ === b.typ && a.kurz === b.kurz}
            onChange={(_, v) => navigieren(ziel({ k: v.map(x => ({ typ: x.typ, kurz: x.kurz })), u: null }))}
            filterOptions={(o, st) => { const q = st.inputValue.toLowerCase(); return o.filter(x => !q || x.kurz.toLowerCase().includes(q) || x.info.toLowerCase().includes(q)).slice(0, 60); }}
            renderOption={(p, o) => { const { key, ...r } = p as typeof p & { key: string }; return <li key={key} {...r}><b style={{ minWidth: 56, display: 'inline-block' }}>{o.kurz}</b><Typography variant="body2" color="text.secondary" component="span">{o.info}</Typography></li>; }}
            renderInput={p => <TextField {...p} placeholder={kriterien.length ? '' : 'Klasse, Lehrkraft oder Fach suchen'} InputProps={{ ...p.InputProps, startAdornment: <><SearchRounded fontSize="small" sx={{ color: 'text.secondary', ml: 0.5 }} />{p.InputProps.startAdornment}</> }} />}
            sx={{ minWidth: 320, flex: 1, maxWidth: 560 }} />
        ) : (
          <>
            <TextField select label="Unterricht" value={unterricht ?? ''} onChange={e => navigieren(ziel({ u: e.target.value ? Number(e.target.value) : null }))} sx={{ minWidth: 220 }}>
              <MenuItem value="">Alle Unterrichte</MenuItem>
              {(auswahl.daten?.unterrichte ?? []).map(u => <MenuItem key={u.id} value={u.id}>{u.klassen.join(', ')} | {u.fach}</MenuItem>)}
            </TextField>
            {eigeneKlassen.length > 0 && (
              <TextField select label="Lehrkraft" value={lehrkraft} onChange={e => navigieren(ziel({ k: e.target.value === ich.element ? [] : [{ typ: 'lehrer', kurz: e.target.value }], u: null }))} sx={{ minWidth: 200 }}
                helperText={undefined}>
                <MenuItem value={ich.element}>{lehrerName(ich.element)} (eigene)</MenuItem>
                {(auswahl.daten?.kollegen ?? []).map(l => <MenuItem key={l} value={l}>{lehrerName(l)}</MenuItem>)}
              </TextField>
            )}
          </>
        )}
        <Box sx={{ flex: 1 }} />
        {[['lehrstoff', 'Lehrstoff fehlt'], ['kontrolle', 'Abwesenheiten nicht kontrolliert']].map(([f, text]) => (
          <ToggleButton key={f} value={f} size="small" selected={filter.has(f)} onChange={() => { const n = new Set(filter); if (n.has(f)) n.delete(f); else n.add(f); setFilter(n); }}
            sx={{ borderRadius: '6px', border: '1px solid', borderColor: 'divider', px: 1.5 }}>{text}</ToggleButton>
        ))}
        <DatumFeld label="Gehe zu" wert={zielDatum} min={sjVon} max={sjBis} onWert={d => { if (d) { setBereich({ von: grenze(plusTage(montag(d), -7)), bis: grenze(plusTage(d, 21)) }); navigieren(ziel({ d })); } }} breite={160} />
      </Paper>
      {!abfrage ? <Leer symbol={<SearchRounded />} text={kriterien.length ? 'Nur ein Fach genügt nicht – bitte zusätzlich eine Klasse oder Lehrkraft angeben.' : 'Benutzen Sie die Suche, um das Ergebnis mit zumindest einer Lehrkraft und/oder Klasse einzuschränken.'} />
        : daten.fehler ? <Fehler fehler={daten.fehler} neu={daten.neu} /> : !daten.daten ? <Laden /> : (
          <>
            {bereich.von <= sjVon ? <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mb: 2 }}><FlagOutlined sx={{ fontSize: 16, verticalAlign: -3, mr: 0.5 }} />Beginn des Schuljahres · {datumDe(sjVon)}</Typography>
              : <Box sx={{ textAlign: 'center', mb: 2 }}><Button onClick={() => setBereich({ von: grenze(plusTage(bereich.von, -21)), bis: bereich.bis })} disabled={daten.laedt}>Frühere Unterrichte laden</Button></Box>}
            {tage.map(tag => {
              const sicht = tag.stunden.filter(x => passt(x, tag.datum));
              if (!sicht.length) return null;
              const kw = kalenderwoche(tag.datum), kwNeu = kw !== letzteKw; letzteKw = kw;
              const d = ausIso(tag.datum);
              return (
                <Box key={tag.datum} sx={{ mb: 2.5 }}>
                  <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 1 }}>
                    <Typography variant="caption" sx={{ width: 48, color: 'text.secondary', fontWeight: 600 }}>{kwNeu ? `KW ${kw}` : ''}</Typography>
                    <Typography sx={{ fontWeight: 600, color: tag.datum === heute ? 'primary.main' : 'text.primary' }}>{wochentag(tag.datum)} · {d.getDate()}. {MONATE[d.getMonth()]} {d.getFullYear()}</Typography>
                    {tag.datum === heute && <Plakette ton="primaer" fest>Heute</Plakette>}
                    <Box sx={{ flex: 1, borderTop: 1, borderColor: 'divider' }} />
                  </Stack>
                  <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', borderColor: tag.datum === heute ? alpha(t.palette.primary.main, 0.4) : 'divider' }}>
                    <Box sx={{ overflowX: 'auto' }}><Table size="small">
                      <TableHead><TableRow><TableCell sx={{ width: 44 }}>h</TableCell><TableCell>Fach</TableCell>{mitLehrer && <TableCell>Lehrkräfte</TableCell>}<TableCell>Klassen</TableCell><TableCell>Lehrstoff</TableCell><TableCell>Abwesenheiten</TableCell><TableCell>Hausaufgaben</TableCell></TableRow></TableHead>
                      <TableBody>{sicht.map(x => {
                        const k = karteAus({ datum: tag.datum, von: x.von, bis: x.bis, beginn: x.beginn, ende: x.ende, status: x.status, fach: x.fach, fachName: x.fachName, farbe: x.farbe, art: x.art ?? '', klassen: x.klassen, lehrer: x.lehrer, raeume: x.raeume, unterricht: x.unterricht });
                        karten.push(k);
                        const entfall = x.status === 'entfall', spaeter = kommend(x, tag.datum);
                        return (
                          <TableRow key={`${x.von}-${x.unterricht}-${x.fach}`} hover onClick={() => setDetails({ k, liste: karten })} sx={{ cursor: 'pointer', opacity: spaeter ? 0.6 : 1 }}>
                            <TableCell sx={{ fontWeight: 600 }}>{x.von === x.bis ? x.von : `${x.von}–${x.bis}`}</TableCell>
                            <TableCell><Stack direction="row" gap={1} alignItems="center"><Box sx={{ width: 4, height: 18, borderRadius: 1, bgcolor: gueltigeFarbe(x.farbe) ?? 'divider' }} /><b style={{ textDecoration: entfall ? 'line-through' : 'none' }}>{x.fach}</b></Stack></TableCell>
                            {mitLehrer && <TableCell>{x.lehrer.map(lehrerName).join(', ')}</TableCell>}
                            <TableCell>{x.klassen.join(', ')}</TableCell>
                            <TableCell sx={{ maxWidth: 300 }}>{entfall ? <Plakette ton="entfall">{x.art || 'Entfall'}</Plakette> : x.lehrstoff ? <Typography variant="body2" noWrap title={x.lehrstoff}>{x.lehrstoff}</Typography> : spaeter ? '' : <Plakette ton="warnung">Lehrstoff fehlt</Plakette>}</TableCell>
                            <TableCell><AbwesenheitTags s={x} kommend={spaeter} /></TableCell>
                            <TableCell sx={{ maxWidth: 220 }}><Typography variant="body2" noWrap title={x.hausaufgaben}>{x.hausaufgaben}</Typography></TableCell>
                          </TableRow>
                        );
                      })}</TableBody>
                    </Table></Box>
                  </Paper>
                </Box>
              );
            })}
            {!tage.some(tag => tag.stunden.some(x => passt(x, tag.datum))) && <Leer text={filter.size ? 'Im geladenen Zeitraum gibt es keine passenden Unterrichte.' : 'Im geladenen Zeitraum gibt es keinen Unterricht.'} />}
            {bereich.bis >= sjBis ? <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>Ende des Schuljahres · {datumDe(sjBis)}</Typography>
              : <Box sx={{ textAlign: 'center' }}><Button onClick={() => setBereich({ von: bereich.von, bis: grenze(plusTage(bereich.bis, 21)) })} disabled={daten.laedt}>Weitere Unterrichte laden</Button></Box>}
          </>
        )}
      {details && <Stundendetails karte={details.k} liste={details.liste} typ="lehrer" onClose={() => setDetails(null)} onGeaendert={() => void daten.neu()} />}
    </Seite>
  );
}

// ---------------------------------------------------------------- Vermerk-Dialog (Klassenbucheintrag einer Klasse)
function VermerkDialog({ klasse, datum, onClose, fertig }: { klasse: string; datum: string; onClose: () => void; fertig: () => void }) {
  const g = useLaden(() => Promise.all([holen<{ arten: string[] }>(`/api/app/klassenbuch/vermerke?klasse=${encodeURIComponent(klasse)}&von=${datum}&bis=${datum}`), holen<{ id: number; name: string; vorname: string }[]>(`/api/app/klassenbuch/schueler?klasse=${encodeURIComponent(klasse)}`)]), []);
  const [d, setD] = useState<string | null>(datum);
  const [art, setArt] = useState('');
  const [sid, setSid] = useState<number | ''>('');
  const [text, setText] = useState('');
  return (
    <FormDialog offen titel={`Klassenbucheintrag · ${klasse}`} onClose={onClose} aktion={async () => {
      if (!text.trim()) { toast('Bitte einen Text eingeben.', true); return false; }
      await senden('/api/app/klassenbuch/vermerke', { datum: d, klasse, schuelerId: sid || null, art: art || g.daten?.[0].arten[0] || 'Vermerk', text });
      toast('Vermerk gespeichert.'); fertig();
    }}>
      <Geladen g={g}>{([v, sl]) => (
        <Stack gap={2} sx={{ pt: 0.5 }}>
          <Stack direction="row" gap={2}><DatumFeld label="Datum" wert={d} onWert={setD} pflicht />
            <TextField select label="Art" value={art || v.arten[0] || ''} onChange={e => setArt(e.target.value)} sx={{ flex: 1 }}>{v.arten.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}</TextField></Stack>
          <TextField select label="Betrifft" value={sid} onChange={e => setSid(e.target.value === '' ? '' : Number(e.target.value))}><MenuItem value="">ganze Klasse</MenuItem>{sl.map(x => <MenuItem key={x.id} value={x.id}>{x.name}, {x.vorname}</MenuItem>)}</TextField>
          <TextField label="Text" multiline minRows={3} value={text} onChange={e => setText(e.target.value)} required autoFocus />
        </Stack>
      )}</Geladen>
    </FormDialog>
  );
}

// ---------------------------------------------------------------- Wochenübersicht einer Klasse
interface WStunde { von: number; bis: number; beginn: string; ende: string; fach: string; fachName: string; farbe: string; status: string; art: string; unterricht: number; lehrer: string[]; raeume: string[]; thema: string; hausaufgabe: string; geprueft: string | null; fehlend: string[]; verspaetet: string[]; vorzeitig?: string[]; hausaufgaben?: string[]; eintraege: number }
interface WTag { datum: string; frei: boolean; freiGrund: string | null; vermerke: { art: string; text: string; schueler?: string; lehrer: string; zeit?: string }[]; stunden: WStunde[] }
interface Woche { klasse: string; von: string; bis: string; schuelerAnzahl: number; raster: { nr: number; beginn: string; ende: string }[]; tage: WTag[] }

type Doku = 'dokumentiert' | 'offen' | 'entfall' | 'geplant';
const DOKU: Record<Doku, { text: string; ton: 'ok' | 'warnung' | 'entfall' | 'neutral' }> = {
  dokumentiert: { text: 'Dokumentiert', ton: 'ok' }, offen: { text: 'Offen', ton: 'warnung' }, entfall: { text: 'Entfallen', ton: 'entfall' }, geplant: { text: 'Geplant', ton: 'neutral' },
};

function Wochenansicht({ klasse, datum, ziel }: { klasse: string; datum: string; ziel: (k: string, r: string, d?: string) => string }) {
  const t = useTheme();
  const schmal = useMediaQuery(t.breakpoints.down('md'));
  const g = useLaden(() => holen<Woche>(`/api/app/klassenbuch/woche?klasse=${encodeURIComponent(klasse)}&datum=${datum}`), [klasse, datum]);
  const [details, setDetails] = useState<{ k: Karte; liste: Karte[] } | null>(null);
  const [vermerk, setVermerk] = useState<string | null>(null);
  const [nurOffen, setNurOffenRoh] = useState(() => lesen<boolean>('untplan:kb-nur-offen', false, true));
  const setNurOffen = (v: boolean) => { setNurOffenRoh(v); schreiben('untplan:kb-nur-offen', v, true); };
  const heute = heuteIso(), jetzt = hhmm(jetztMinuten());
  return (
    <Geladen g={g}>{w => {
      const tage = w.tage.filter(x => x.stunden.length || x.frei || ![5, 6].includes((ausIso(x.datum).getDay() + 6) % 7));
      const letzte = Math.max(0, ...tage.flatMap(x => x.stunden.map(s => s.bis)), ...w.raster.filter(r => r.nr <= 6).map(r => r.nr));
      const raster = w.raster.filter(r => r.nr <= letzte);
      const vergangen = (s: WStunde, d: string) => s.status !== 'entfall' && (d < heute || (d === heute && (s.beginn || '99:99') <= jetzt));
      const doku = (s: WStunde, d: string): Doku => (s.status === 'entfall' ? 'entfall' : !vergangen(s, d) ? 'geplant' : s.thema && s.geprueft != null ? 'dokumentiert' : 'offen');
      const fehlt = (s: WStunde) => [!s.thema && 'Thema fehlt', s.geprueft == null && 'Anwesenheit offen'].filter(Boolean).join(' · ');
      const alle = tage.flatMap(x => x.stunden.map(s => ({ s, d: x.datum })));
      const gehalten = alle.filter(x => vergangen(x.s, x.d));
      const offen = gehalten.filter(x => doku(x.s, x.d) === 'offen');
      const karten = alle.map(({ s, d }) => karteAus({ datum: d, von: s.von, bis: s.bis, beginn: s.beginn, ende: s.ende, status: s.status, fach: s.fach, fachName: s.fachName, farbe: s.farbe, art: s.art, klassen: [klasse], lehrer: s.lehrer, raeume: s.raeume, unterricht: s.unterricht }));
      const vermerke = tage.flatMap(x => x.vermerke.map(v => ({ ...v, datum: x.datum })));
      const sichtbar = (s: WStunde, d: string) => !nurOffen || doku(s, d) === 'offen';
      const oeffnen = (s: WStunde) => { const i = alle.findIndex(a => a.s === s); setDetails({ k: karten[i], liste: karten }); };
      const zahl = (n: number, text: string, ton?: 'warn' | 'entfall') => (
        <Typography variant="body2" sx={{ color: ton && n ? (ton === 'warn' ? 'status.pruefung.main' : 'status.entfall.main') : 'text.secondary', whiteSpace: 'nowrap' }}><b style={{ color: 'inherit' }}>{n}</b> {text}</Typography>
      );
      const statusZeile = (s: WStunde, d: string) => {
        const st = doku(s, d);
        return (
          <Stack direction="row" gap={0.75} alignItems="center" sx={{ minWidth: 0 }}>
            <Plakette ton={DOKU[st].ton}>{st === 'dokumentiert' && <CheckRounded sx={{ fontSize: 13 }} />}{DOKU[st].text}</Plakette>
            {st === 'offen' && <Typography variant="caption" noWrap sx={{ color: 'status.pruefung.main', fontWeight: 600 }}>{fehlt(s)}</Typography>}
          </Stack>
        );
      };
      const symbole = (s: WStunde) => {
        const hw = (s.hausaufgaben?.length ? s.hausaufgaben : [s.hausaufgabe]).filter(Boolean);
        const spaet = s.verspaetet.length + (s.vorzeitig?.length ?? 0);
        return (
          <Stack direction="row" gap={1} sx={{ color: 'text.secondary', '& svg': { fontSize: 15 } }}>
            {s.fehlend.length > 0 && <Tooltip title={`fehlt: ${s.fehlend.join('; ')}`}><Stack direction="row" alignItems="center" gap={0.25}><PersonOffOutlined />{s.fehlend.length}</Stack></Tooltip>}
            {spaet > 0 && <Tooltip title={[...s.verspaetet, ...(s.vorzeitig ?? [])].join('; ')}><Stack direction="row" alignItems="center" gap={0.25}><AccessTimeRounded />{spaet}</Stack></Tooltip>}
            {s.eintraege > 0 && <Tooltip title={`${s.eintraege} Klassenbucheinträge`}><Stack direction="row" alignItems="center" gap={0.25}><MenuBookOutlined />{s.eintraege}</Stack></Tooltip>}
            {hw.length > 0 && <Tooltip title={`Hausaufgabe: ${hw.join(' · ')}`}><HomeWorkOutlined /></Tooltip>}
          </Stack>
        );
      };
      const kachel = (s: WStunde, d: string, i: number, eng = false) => {
        const st = doku(s, d), entfall = st === 'entfall', komm = st === 'geplant';
        const farbe = gueltigeFarbe(s.farbe) ?? t.palette.divider;
        return (
          <ButtonBase key={i} onClick={() => oeffnen(s)} aria-label={`${s.fach} ${s.von}. Stunde, ${wochentag(d)} ${datumDe(d)}: ${DOKU[st].text}${st === 'offen' ? ` (${fehlt(s)})` : ''}`}
            sx={{ flex: 1, minWidth: 0, flexDirection: 'column', alignItems: 'stretch', textAlign: 'left', p: 1, gap: 0.5, borderRadius: 1.5,
              border: 1, borderColor: st === 'offen' ? alpha(t.palette.status.pruefung.main, 0.55) : 'divider', boxShadow: `inset 3px 0 0 ${entfall ? t.palette.status.entfall.main : farbe}`,
              bgcolor: entfall ? 'status.entfall.flaeche' : 'background.paper', opacity: komm ? 0.72 : 1, '&:hover': { borderColor: 'primary.light' } }}>
            <Stack direction="row" gap={0.75} alignItems="baseline" sx={{ pl: 0.5 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 13, textDecoration: entfall ? 'line-through' : 'none' }}>{s.fach}</Typography>
              <Typography variant="caption" color="text.secondary" noWrap>{s.lehrer.join(', ')}</Typography>
            </Stack>
            <Typography variant="caption" sx={{ pl: 0.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: entfall ? 'status.entfall.main' : 'text.primary', minHeight: 18 }} title={s.thema}>
              {entfall ? s.art || 'Entfall' : s.thema}</Typography>
            <Box sx={{ mt: 'auto', pl: 0.5, display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <Plakette ton={DOKU[st].ton} title={st === 'offen' ? fehlt(s) : undefined}>{st === 'dokumentiert' && <CheckRounded sx={{ fontSize: 13 }} />}{st === 'offen' ? (eng ? 'Offen' : s.thema ? 'Anwesenheit offen' : 'Thema fehlt') : DOKU[st].text}</Plakette>
              {!entfall && !komm && symbole(s)}
            </Box>
          </ButtonBase>
        );
      };
      return (
        <>
          <Paper variant="outlined" className="nicht-drucken" sx={{ px: 1.5, py: 1, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', bgcolor: 'flaechen.band' }}>
            <Stack direction="row" alignItems="center" gap={0.5}>
              <IconButton size="small" href={ziel(klasse, 'woche', plusTage(w.von, -7))} aria-label="Vorige Woche"><ChevronLeftRounded /></IconButton>
              <Typography sx={{ fontWeight: 600, minWidth: 170, textAlign: 'center' }}>KW {kalenderwoche(w.von)} · {datumKurz(w.von)} – {datumKurz(w.bis)}{w.bis.slice(0, 4)}</Typography>
              <IconButton size="small" href={ziel(klasse, 'woche', plusTage(w.von, 7))} aria-label="Nächste Woche"><ChevronRightRounded /></IconButton>
            </Stack>
            <Button size="small" variant="outlined" href={ziel(klasse, 'woche', heute)}>Heute</Button>
            <DatumFeld label="Gehe zu" wert={datum} onWert={x => x && navigieren(ziel(klasse, 'woche', x))} breite={170} />
            <ToggleButtonGroup exclusive size="small" value={nurOffen ? 'offen' : 'alle'} onChange={(_, v) => v && setNurOffen(v === 'offen')} aria-label="Filter">
              <ToggleButton value="alle">Alle Stunden</ToggleButton><ToggleButton value="offen">Nur offene{offen.length ? ` (${offen.length})` : ''}</ToggleButton>
            </ToggleButtonGroup>
            <Box sx={{ flex: 1 }} />
            <Stack direction="row" gap={2} flexWrap="wrap" alignItems="center">
              {zahl(gehalten.length, 'gehalten')}{zahl(offen.length, 'offen', 'warn')}{zahl(alle.filter(x => x.s.status === 'entfall').length, 'entfallen', 'entfall')}
              {zahl(alle.reduce((n, x) => n + (x.s.fehlend?.length ?? 0), 0), 'Abwesenheiten')}{zahl(vermerke.length, vermerke.length === 1 ? 'Eintrag' : 'Einträge')}
              <Typography variant="body2" color="text.secondary">{w.schuelerAnzahl ? `${w.schuelerAnzahl} Schüler*innen` : 'keine Schülerliste übertragen'}</Typography>
            </Stack>
          </Paper>
          {!raster.length || !tage.length ? <Leer text={`In dieser Woche gibt es für ${klasse} keinen Unterricht.`} /> : schmal ? (
            <Stack gap={2} sx={{ mb: 3 }}>
              {tage.map(x => {
                const st = x.stunden.filter(s => sichtbar(s, x.datum)).sort((a, b) => a.von - b.von);
                return (
                  <Paper key={x.datum} variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                    <Stack direction="row" alignItems="center" sx={{ px: 1.5, py: 0.75, bgcolor: x.datum === heute ? alpha(t.palette.primary.main, 0.06) : 'flaechen.band', borderBottom: 1, borderColor: 'divider' }}>
                      <Typography sx={{ fontWeight: 600, flex: 1, color: x.datum === heute ? 'primary.main' : 'text.primary' }}>{wochentag(x.datum)}, {datumKurz(x.datum)}</Typography>
                      {!x.frei && <IconButton size="small" onClick={() => setVermerk(x.datum)} aria-label={`Klassenbucheintrag am ${datumKurz(x.datum)}`}><AddRounded fontSize="small" /></IconButton>}
                    </Stack>
                    {x.frei ? <Typography sx={{ p: 1.5, color: 'status.frei.main' }}>{x.freiGrund || 'unterrichtsfrei'}</Typography>
                      : !st.length ? <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>{nurOffen ? 'Keine offenen Stunden.' : 'Kein Unterricht.'}</Typography>
                      : st.map((s, i) => (
                        <ButtonBase key={i} onClick={() => oeffnen(s)} sx={{ width: '100%', display: 'grid', gridTemplateColumns: '38px minmax(0, 1fr)', gap: 1, textAlign: 'left', px: 1.5, py: 1, borderTop: i ? 1 : 0, borderColor: 'divider' }}>
                          <Typography sx={{ fontWeight: 600, fontSize: 13 }}>{s.von === s.bis ? s.von : `${s.von}–${s.bis}`}</Typography>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontSize: 13.5, fontWeight: 600, textDecoration: s.status === 'entfall' ? 'line-through' : 'none' }}>{s.fach} <Typography component="span" variant="caption" color="text.secondary">{s.lehrer.join(', ')}</Typography></Typography>
                            {s.thema && <Typography variant="caption" noWrap sx={{ display: 'block' }}>{s.thema}</Typography>}
                            <Box sx={{ mt: 0.5 }}>{statusZeile(s, x.datum)}</Box>
                          </Box>
                        </ButtonBase>
                      ))}
                  </Paper>
                );
              })}
            </Stack>
          ) : (
            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'auto', mb: 3 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: `56px repeat(${tage.length}, minmax(150px, 1fr))`, minWidth: 56 + tage.length * 150 }}>
                <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'flaechen.band' }} />
                {tage.map(x => (
                  <Stack key={x.datum} direction="row" alignItems="center" sx={{ px: 1.25, py: 0.75, borderBottom: 1, borderLeft: 1, borderColor: 'divider', bgcolor: x.datum === heute ? alpha(t.palette.primary.main, 0.07) : 'flaechen.band', boxShadow: x.datum === heute ? `inset 0 2px 0 ${t.palette.primary.main}` : 'none' }}>
                    <Typography sx={{ fontWeight: 600, flex: 1, color: x.datum === heute ? 'primary.main' : 'text.primary' }}>{wochentagKurz(x.datum)} <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary' }}>{datumKurz(x.datum)}</Box></Typography>
                    {!x.frei && <Tooltip title={`Klassenbucheintrag am ${datumKurz(x.datum)}`}><IconButton size="small" onClick={() => setVermerk(x.datum)} aria-label={`Klassenbucheintrag am ${datumKurz(x.datum)}`}><AddRounded fontSize="small" /></IconButton></Tooltip>}
                  </Stack>
                ))}
                {raster.map(r => (
                  <Fragment key={r.nr}>
                    <Box sx={{ px: 1, py: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'flaechen.band' }}><Typography sx={{ fontWeight: 600, fontSize: 13 }}>{r.nr}</Typography><Typography variant="caption" color="text.secondary">{r.beginn}</Typography></Box>
                    {tage.map((x, ti) => {
                      if (x.frei) return r.nr === raster[0].nr ? <Box key={x.datum} sx={{ gridRow: `span ${raster.length}`, gridColumn: ti + 2, borderLeft: 1, borderColor: 'divider', bgcolor: 'status.frei.flaeche', color: 'status.frei.main', display: 'grid', placeItems: 'center', p: 1, textAlign: 'center' }}>{x.freiGrund || 'unterrichtsfrei'}</Box> : null;
                      const hier = x.stunden.filter(s => s.von <= r.nr && s.bis >= r.nr);
                      const start = hier.filter(s => s.von === r.nr || r.nr === raster[0].nr);
                      if (hier.length && !start.length) return null;
                      const span = start.length ? Math.max(...start.map(s => Math.min(s.bis, letzte) - r.nr + 1)) : 1;
                      return (
                        <Box key={x.datum} sx={{ gridColumn: ti + 2, gridRow: `span ${span}`, borderBottom: 1, borderLeft: 1, borderColor: 'divider', p: 0.5, display: 'flex', gap: 0.5, minHeight: 96 * span, bgcolor: x.datum === heute ? alpha(t.palette.primary.main, 0.025) : undefined }}>
                          {start.map((s, i) => (sichtbar(s, x.datum) ? kachel(s, x.datum, i, start.length > 1) : <Box key={i} sx={{ flex: 1, borderRadius: 1.5, border: '1px dashed', borderColor: 'divider' }} title={`${s.fach}: ${DOKU[doku(s, x.datum)].text}`} />))}
                        </Box>
                      );
                    })}
                  </Fragment>
                ))}
              </Box>
            </Paper>
          )}
          <Stack direction="row" gap={2} flexWrap="wrap" alignItems="center" sx={{ mb: 2, color: 'text.secondary' }} className="nicht-drucken" aria-label="Legende">
            {(Object.keys(DOKU) as Doku[]).map(x => <Stack key={x} direction="row" gap={0.75} alignItems="center"><Plakette ton={DOKU[x].ton}>{DOKU[x].text}</Plakette><Typography variant="caption">{
              x === 'dokumentiert' ? 'Thema eingetragen und Anwesenheit kontrolliert' : x === 'offen' ? 'Thema oder Anwesenheitskontrolle fehlt' : x === 'entfall' ? 'Stunde fällt aus' : 'Stunde liegt in der Zukunft'}</Typography></Stack>)}
          </Stack>
          <Abschnitt titel="Klassenbucheinträge der Woche" aktion={<Button size="small" startIcon={<AddRounded />} onClick={() => setVermerk(heute >= w.von && heute <= w.bis ? heute : w.von)}>Neuer Eintrag</Button>}>
            <Box sx={{ px: 2, pb: 1.5 }}>
              {vermerke.length ? vermerke.map((v, i) => (
                <Stack key={i} direction={{ xs: 'column', sm: 'row' }} columnGap={2} rowGap={0.25} sx={{ py: 1, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }} alignItems={{ sm: 'baseline' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ width: 110, flex: 'none' }}>{wochentagKurz(v.datum)} {datumKurz(v.datum)}{v.zeit ? ` · ${v.zeit}` : ''}</Typography>
                  <Box><Plakette>{v.art}</Plakette></Box>
                  <Typography variant="body2" sx={{ flex: 1 }}>{v.schueler && <b>{v.schueler}: </b>}{v.text}</Typography>
                  <Typography variant="body2" color="text.secondary">{v.lehrer}</Typography>
                </Stack>
              )) : <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>Keine Einträge in dieser Woche.</Typography>}
            </Box>
          </Abschnitt>
          {details && <Stundendetails karte={details.k} liste={details.liste} typ="klasse" onClose={() => setDetails(null)} onGeaendert={() => void g.neu()} />}
          {vermerk && <VermerkDialog klasse={klasse} datum={vermerk} onClose={() => setVermerk(null)} fertig={() => void g.neu()} />}
        </>
      );
    }}</Geladen>
  );
}

// ---------------------------------------------------------------- Fehlzeiten einer Klasse
interface FzSchueler { id: number; vorname: string; name: string; hinweis?: string }
interface FzZeile { id: number; schuelerId: number; datum: string; beginn: string; ende: string; abwesendVon: string; abwesendBis: string; fach: string; lehrer: string; fehlstunden: number; fehlminuten: number; fehltage: number; zaehlt: boolean; grund: string; status: string; text: string }
interface FzEintrag extends Partial<Details> { id: number; schuelerId: number; art: string; status: string }
interface Fz { schueler: FzSchueler[]; eintraege: FzEintrag[]; zeilen: FzZeile[]; verwalten: boolean }

function FehlenDialog({ schueler, onClose, fertig }: { schueler: FzSchueler[]; onClose: () => void; fertig: () => void }) {
  const [sid, setSid] = useState<number>(schueler[0]?.id ?? 0);
  const [von, setVon] = useState<string | null>(heuteIso());
  const [bis, setBis] = useState<string | null>(heuteIso());
  const [status, setStatus] = useState('offen');
  const [bemerkung, setBemerkung] = useState('');
  const [det, setDet] = useState(detailsVon());
  return (
    <FormDialog offen titel="Fehlen eintragen" untertitel="Trägt für alle Unterrichtsstunden der gewählten Tage eine Fehlzeit ein (z. B. nach einer Krankmeldung)." onClose={onClose} aktionText="Eintragen"
      aktion={async () => { const r = await senden<{ stunden: number }>('/api/app/abwesenheiten', { schuelerId: sid, von, bis, status, bemerkung, ...det }); toast(`${r.stunden} Fehlstunden eingetragen.`); fertig(); }}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        <TextField select label="Schüler*in" value={sid} onChange={e => setSid(Number(e.target.value))}>{schueler.map(x => <MenuItem key={x.id} value={x.id}>{x.name}, {x.vorname}</MenuItem>)}</TextField>
        <Stack direction="row" gap={2}><DatumFeld label="von" wert={von} onWert={setVon} pflicht /><DatumFeld label="bis" wert={bis} onWert={setBis} pflicht /></Stack>
        <Stack direction="row" gap={2}>
          <TextField select label="Status" value={status} onChange={e => setStatus(e.target.value)} sx={{ width: 200 }}>{Object.entries(STATUS_TEXT).map(([k, [x]]) => <MenuItem key={k} value={k}>{x}</MenuItem>)}</TextField>
          <TextField label="Bemerkung" value={bemerkung} onChange={e => setBemerkung(e.target.value)} placeholder="z. B. Krankmeldung der Eltern" sx={{ flex: 1 }} />
        </Stack>
        <DetailFelder w={det} setW={setDet} />
      </Stack>
    </FormDialog>
  );
}

function DetailsDialog({ ids, vorlage, onClose, fertig }: { ids: number[]; vorlage?: Partial<Details>; onClose: () => void; fertig: () => void }) {
  const [det, setDet] = useState(detailsVon(vorlage));
  return (
    <FormDialog offen titel={ids.length === 1 ? 'Fehlstunde – Details' : `${ids.length} Fehlstunden – Details`} onClose={onClose}
      aktion={async () => { await senden('/api/app/abwesenheiten', { ids, ...det }, 'PUT'); toast('Gespeichert.'); fertig(); }}>
      <DetailFelder w={det} setW={setDet} />
    </FormDialog>
  );
}

function Fehlzeiten({ klasse, bis, vonParam, ziel }: { klasse: string; bis: string; vonParam?: string; ziel: (k: string, r: string, d?: string) => string }) {
  const gemeinsam = abwZeitraum();
  const von = istIsoDatum(vonParam) ? vonParam : gemeinsam?.von && gemeinsam.von <= bis ? gemeinsam.von : plusTage(bis, -90);
  const [suche, setSuche] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [auf, setAuf] = useState<Set<number>>(new Set());
  const [wahl, setWahl] = useState<Set<number>>(new Set());
  const [dialog, setDialog] = useState<null | { art: 'fehlen' } | { art: 'details'; ids: number[]; vorlage?: Partial<Details> }>(null);
  const g = useLaden(async () => {
    abwZeitraum({ von, bis, klasse });
    const [f, gr] = await Promise.all([holen<Fz>(`/api/app/klassenbuch/fehlzeiten?klasse=${encodeURIComponent(klasse)}&von=${von}&bis=${bis}`), holen<{ kurz: string; name: string }[]>('/api/app/abwesenheitsgruende').catch(() => [])]);
    return { ...f, gruende: Object.fromEntries(gr.map(x => [x.kurz, x.name])) as Record<string, string> };
  }, [klasse, von, bis]);
  const neu = (v = von, b = bis) => navigieren(`${ziel(klasse, 'fehlzeiten', b)}/${v}`);
  return (
    <Geladen g={g}>{f => {
      const fehlt = f.eintraege.filter(x => x.art === 'fehlt');
      const zeilen = f.schueler.map(x => {
        const eig = fehlt.filter(y => y.schuelerId === x.id);
        return { ...x, stunden: eig.length, tage: f.zeilen.filter(z => z.schuelerId === x.id).reduce((n, z) => n + z.fehltage, 0), offen: eig.filter(y => y.status === 'offen').length,
          entschuldigt: eig.filter(y => y.status === 'entschuldigt').length, unentschuldigt: eig.filter(y => y.status === 'unentschuldigt').length };
      }).filter(x => f.zeilen.some(z => z.schuelerId === x.id)).sort((a, b) => b.stunden - a.stunden || a.name.localeCompare(b.name, 'de'))
        .filter(x => (!suche || `${x.name} ${x.vorname}`.toLowerCase().includes(suche.toLowerCase())) && (!statusFilter || x[statusFilter as 'offen' | 'unentschuldigt']));
      const status = async (st: string) => {
        if (!wahl.size) { toast('Bitte zuerst Fehlstunden auswählen.', true); return; }
        try { await senden('/api/app/klassenbuch/fehlzeiten/status', { ids: [...wahl], status: st }); toast(`${wahl.size} ${wahl.size === 1 ? 'Fehlstunde' : 'Fehlstunden'} geändert.`); setWahl(new Set()); void g.neu(); } catch (err) { toast((err as Error).message, true); }
      };
      const zahl = (n: number, ton?: 'entfall' | 'pruefung' | 'ok') => (n ? <Box component="b" sx={{ color: ton ? `status.${ton}.main` : 'text.primary' }}>{n}</Box> : <Box component="span" sx={{ color: 'text.disabled' }}>–</Box>);
      return (
        <>
          <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <DatumFeld label="Von" wert={von} onWert={v => v && neu(v)} pflicht />
            <DatumFeld label="Bis" wert={bis} onWert={b => b && neu(von, b)} pflicht />
            <SuchFeld wert={suche} onWert={setSuche} platzhalter="Schüler*in suchen" breite={200} />
            <Wahl label="Status" wert={statusFilter} onWert={setStatusFilter} optionen={[['offen', 'mit offenen Stunden'], ['unentschuldigt', 'mit nicht entschuldigten']]} alle="Alle mit Fehlzeiten" breite={210} />
            <Box sx={{ flex: 1 }} />
            {f.schueler.length > 0 && <Stack direction="row" gap={1.5}>
              <Typography variant="body2"><b>{zeilen.length}/{f.schueler.length}</b> mit Fehlzeiten</Typography><Typography variant="body2" color="status.entfall.main"><b>{fehlt.length}</b> Fehlstd.</Typography>
              <Typography variant="body2" color="status.pruefung.main"><b>{fehlt.filter(y => y.status === 'offen').length}</b> offen</Typography></Stack>}
            {f.verwalten && <Button variant="contained" startIcon={<AddRounded />} onClick={() => setDialog({ art: 'fehlen' })}>Fehlen eintragen</Button>}
          </Paper>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Fehlstunden entstehen aus einer Abwesenheit und dem Stundenplan. Den Zeitraum selbst erfassen Sie unter <a href={`#/abwesenheiten/schueler/${von}/${bis}/${encodeURIComponent(klasse)}`}>Abwesenheiten</a>.</Typography>
          {!f.schueler.length ? <Leer text="Für diese Klasse wurde keine Schülerliste aus EduOrga Studio übertragen." /> : !zeilen.length ? <Leer text="Im Zeitraum hat niemand gefehlt." /> : (
            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
              <Box sx={{ overflowX: 'auto' }}><Table size="small">
                <TableHead><TableRow>{f.verwalten && <TableCell padding="checkbox" />}<TableCell>Name</TableCell><TableCell align="right">Fehlstunden</TableCell><TableCell align="right">Fehltage</TableCell><TableCell align="right">offen</TableCell><TableCell align="right">entschuldigt</TableCell><TableCell align="right">nicht entsch.</TableCell><TableCell /></TableRow></TableHead>
                <TableBody>{zeilen.map(x => {
                  const ids = f.zeilen.filter(z => z.schuelerId === x.id).map(z => z.id);
                  const alleGewaehlt = ids.every(id => wahl.has(id));
                  return (
                    <Fragment key={x.id}>
                      <TableRow hover onClick={() => setAuf(a => { const n = new Set(a); if (n.has(x.id)) n.delete(x.id); else n.add(x.id); return n; })} sx={{ cursor: 'pointer' }}>
                        {f.verwalten && <TableCell padding="checkbox" onClick={e => e.stopPropagation()}><Checkbox size="small" checked={alleGewaehlt} indeterminate={!alleGewaehlt && ids.some(id => wahl.has(id))} onChange={() => setWahl(w => { const n = new Set(w); ids.forEach(id => (alleGewaehlt ? n.delete(id) : n.add(id))); return n; })} inputProps={{ 'aria-label': 'alle Fehlstunden auswählen' }} /></TableCell>}
                        <TableCell><Stack direction="row" gap={1.25} alignItems="center"><NamensAvatar name={`${x.name} ${x.vorname}`} id={x.id} /><Box><Typography variant="body2" sx={{ fontWeight: 600 }}>{x.name} {x.vorname}</Typography>{x.hinweis && <Typography variant="caption" color="status.entfall.main">{x.hinweis}</Typography>}</Box></Stack></TableCell>
                        <TableCell align="right">{zahl(x.stunden)}</TableCell><TableCell align="right">{zahl(x.tage)}</TableCell><TableCell align="right">{zahl(x.offen, 'pruefung')}</TableCell>
                        <TableCell align="right">{zahl(x.entschuldigt, 'ok')}</TableCell><TableCell align="right">{zahl(x.unentschuldigt, 'entfall')}</TableCell>
                        <TableCell align="right"><ExpandMoreRounded sx={{ transform: auf.has(x.id) ? 'rotate(180deg)' : 'none', color: 'text.secondary' }} /></TableCell>
                      </TableRow>
                      <TableRow><TableCell colSpan={8} sx={{ p: 0, borderBottom: auf.has(x.id) ? undefined : 0 }}><Collapse in={auf.has(x.id)} unmountOnExit>
                        <Box sx={{ pl: 6, pr: 2, py: 1.5, bgcolor: 'background.default' }}><Table size="small">
                          <TableHead><TableRow>{f.verwalten && <TableCell padding="checkbox" />}<TableCell>Datum</TableCell><TableCell>Zeit</TableCell><TableCell>Fach</TableCell><TableCell>Lehrkraft</TableCell><TableCell align="right">Fehlstd.</TableCell><TableCell align="right">Fehlmin.</TableCell><TableCell align="center">zählt</TableCell><TableCell>Grund</TableCell><TableCell>Status</TableCell><TableCell>Text</TableCell><TableCell /></TableRow></TableHead>
                          <TableBody>{f.zeilen.filter(z => z.schuelerId === x.id).map(z => {
                            const y = f.eintraege.find(q => q.id === z.id);
                            return (
                              <TableRow key={z.id}>
                                {f.verwalten && <TableCell padding="checkbox"><Checkbox size="small" checked={wahl.has(z.id)} onChange={() => setWahl(w => { const n = new Set(w); if (n.has(z.id)) n.delete(z.id); else n.add(z.id); return n; })} inputProps={{ 'aria-label': 'auswählen' }} /></TableCell>}
                                <TableCell><DatumZelle iso={z.datum} /></TableCell><TableCell sx={{ whiteSpace: 'nowrap' }}>{z.beginn} – {z.ende}</TableCell><TableCell>{z.fach}</TableCell><TableCell>{z.lehrer}</TableCell>
                                <TableCell align="right">{z.fehlstunden}</TableCell><TableCell align="right">{z.fehlminuten}</TableCell><TableCell align="center"><Zaehlt an={z.zaehlt} /></TableCell>
                                <TableCell>{f.gruende[z.grund] ?? z.grund}</TableCell><TableCell><StatusLabel s={z.status} /></TableCell><TableCell>{z.text}</TableCell>
                                <TableCell>{f.verwalten && <IconButton size="small" onClick={() => setDialog({ art: 'details', ids: [z.id], vorlage: y })} aria-label="Details bearbeiten"><EditOutlined fontSize="small" /></IconButton>}</TableCell>
                              </TableRow>
                            );
                          })}</TableBody></Table></Box>
                      </Collapse></TableCell></TableRow>
                    </Fragment>
                  );
                })}</TableBody>
              </Table></Box>
              {f.verwalten && (
                <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap" sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
                  <Typography variant="body2" color="text.secondary">Ausgewählte Fehlstunden ({wahl.size}):</Typography>
                  <Button size="small" variant="outlined" color="success" onClick={() => void status('entschuldigt')}>Entschuldigen</Button>
                  <Button size="small" variant="outlined" color="error" onClick={() => void status('unentschuldigt')}>Nicht entschuldigt</Button>
                  <Button size="small" variant="outlined" onClick={() => void status('offen')}>Offen</Button>
                  <Button size="small" variant="outlined" onClick={() => { if (!wahl.size) { toast('Bitte zuerst Fehlstunden auswählen.', true); return; } const ids = [...wahl]; setDialog({ art: 'details', ids, vorlage: ids.length === 1 ? f.eintraege.find(y => y.id === ids[0]) : undefined }); }}>Details …</Button>
                </Stack>
              )}
            </Paper>
          )}
          {dialog?.art === 'fehlen' && <FehlenDialog schueler={f.schueler} onClose={() => setDialog(null)} fertig={() => void g.neu()} />}
          {dialog?.art === 'details' && <DetailsDialog ids={dialog.ids} vorlage={dialog.vorlage} onClose={() => setDialog(null)} fertig={() => void g.neu()} />}
        </>
      );
    }}</Geladen>
  );
}

// ---------------------------------------------------------------- Vermerke und Verlauf
interface Vermerk { id: number; datum: string; art: string; text: string; schuelerId: number | null; lehrer: string }
function Vermerke({ klasse }: { klasse: string }) {
  const g = useLaden(() => Promise.all([holen<{ vermerke: Vermerk[] }>(`/api/app/klassenbuch/vermerke?klasse=${encodeURIComponent(klasse)}&von=${plusTage(heuteIso(), -365)}&bis=${plusTage(heuteIso(), 30)}`),
    holen<{ id: number; name: string; vorname: string }[]>(`/api/app/klassenbuch/schueler?klasse=${encodeURIComponent(klasse)}`)]), [klasse]);
  const [neu, setNeu] = useState(false);
  return (
    <Abschnitt titel={`Vermerke · ${klasse}`} aktion={<Button variant="contained" size="small" startIcon={<AddRounded />} onClick={() => setNeu(true)}>Neuer Vermerk</Button>}>
      <Geladen g={g}>{([v, sl]) => v.vermerke.length ? <Box sx={{ px: 2, pb: 1 }}>{v.vermerke.map(x => (
        <Stack key={x.id} direction="row" gap={2} alignItems="baseline" sx={{ py: 1, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}>
          <Typography variant="body2" color="text.secondary" sx={{ width: 90, flex: 'none' }}>{datumDe(x.datum)}</Typography>
          <Plakette ton={x.art === 'Lob' ? 'ok' : x.art === 'Ordnungsmaßnahme' ? 'entfall' : 'neutral'}>{x.art}</Plakette>
          <Typography variant="body2" sx={{ flex: 1 }}>{x.schuelerId && <b>{(() => { const s = sl.find(y => y.id === x.schuelerId); return s ? `${s.name}, ${s.vorname}: ` : ''; })()}</b>}{x.text}</Typography>
          <Typography variant="body2" color="text.secondary">{x.lehrer}</Typography>
          <IconButton size="small" color="error" aria-label="Löschen" onClick={async () => { if (!(await bestaetigen('Vermerk löschen', 'Den Vermerk endgültig löschen?'))) return; await api(`/api/app/klassenbuch/vermerke/${x.id}`, { methode: 'DELETE' }); void g.neu(); }}><DeleteOutlineRounded fontSize="small" /></IconButton>
        </Stack>))}</Box> : <Leer text="Noch keine Vermerke." />}</Geladen>
      {neu && <VermerkDialog klasse={klasse} datum={heuteIso()} onClose={() => setNeu(false)} fertig={() => void g.neu()} />}
    </Abschnitt>
  );
}

export interface VerlaufZeile { datum: string; stunde: number; fach: string; lehrer: string; thema: string; hausaufgabe: string; faellig?: string | null; notiz?: string }
export function VerlaufTabelle({ liste, kollegium }: { liste: VerlaufZeile[]; kollegium: boolean }) {
  if (!liste.length) return <Leer text="Keine Einträge im Zeitraum." />;
  return (
    <Box sx={{ overflowX: 'auto' }}><Table size="small">
      <TableHead><TableRow><TableCell>Datum</TableCell><TableCell>Std.</TableCell><TableCell>Fach</TableCell>{kollegium && <TableCell>Lehrkraft</TableCell>}<TableCell>Inhalt</TableCell><TableCell>Hausaufgabe</TableCell>{kollegium && <TableCell>Notiz</TableCell>}</TableRow></TableHead>
      <TableBody>{liste.map((x, i) => (
        <TableRow key={i} hover><TableCell sx={{ whiteSpace: 'nowrap' }}><DatumZelle iso={x.datum} /></TableCell><TableCell>{x.stunde}.</TableCell><TableCell sx={{ fontWeight: 600 }}>{x.fach}</TableCell>
          {kollegium && <TableCell>{x.lehrer}</TableCell>}<TableCell>{x.thema}</TableCell><TableCell>{x.hausaufgabe}{x.faellig && <Typography variant="caption" color="text.secondary" component="div">bis {datumKurz(x.faellig)}</Typography>}</TableCell>
          {kollegium && <TableCell sx={{ color: 'text.secondary' }}>{x.notiz}</TableCell>}</TableRow>))}</TableBody>
    </Table></Box>
  );
}
function Verlauf({ klasse }: { klasse: string }) {
  const [von, setVon] = useState<string | null>(plusTage(heuteIso(), -28));
  const [bis, setBis] = useState<string | null>(plusTage(heuteIso(), 14));
  const g = useLaden(() => holen<VerlaufZeile[]>(`/api/app/klassenbuch/klasse${qs({ klasse, von, bis })}`), [klasse, von, bis]);
  return (
    <Abschnitt titel="Inhalte & Hausaufgaben" aktion={<Stack direction="row" gap={1}><DatumFeld label="von" wert={von} onWert={setVon} breite={150} /><DatumFeld label="bis" wert={bis} onWert={setBis} breite={150} /></Stack>}>
      <Geladen g={g}>{l => <VerlaufTabelle liste={l} kollegium />}</Geladen>
    </Abschnitt>
  );
}

// ---------------------------------------------------------------- Seite
const TITEL: Record<string, string> = { woche: 'Wochenübersicht', fehlzeiten: 'Fehlzeiten', vermerke: 'Vermerke', verlauf: 'Inhalte & Hausaufgaben' };
const UNTERTITEL: Record<string, string> = {
  woche: 'Alle Stunden der Woche mit Stand der Dokumentation. Eine Stunde öffnen, um Thema, Anwesenheit und Einträge zu erfassen.',
  fehlzeiten: 'Fehlstunden der Klasse im Zeitraum – entschuldigen, Details erfassen, ganze Tage eintragen.',
  vermerke: 'Vermerke zur Klasse und zu einzelnen Schüler*innen.',
  verlauf: 'Behandelte Inhalte und Hausaufgaben aller Fächer der Klasse.',
};

export default function Klassenbuch({ teile }: SeitenProps) {
  const s = useSitzung();
  const { ich } = s;
  const [kP, rP, dP, vP] = teile;
  const el = useLaden(() => s.elemente(), []);
  const reiter = ['woche', 'fehlzeiten', 'vermerke', 'verlauf'].includes(rP) ? rP : 'woche';
  const klasseRoh = kP && kP !== '-' ? kP : '';
  useEffect(() => { if (klasseRoh && rP !== 'uebersicht') kbKlasseMerken(klasseRoh); }, [klasseRoh, rP]);
  if (!ich.kollegium) return <KlassenkontoHausaufgaben />;
  if (!el.daten) return el.fehler ? <Fehler fehler={el.fehler} neu={el.neu} /> : <Laden />;
  if (!kP || rP === 'uebersicht') return <Uebersicht el={el.daten} kritParam={kP && kP !== '-' ? kP : ''} datumParam={dP} uParam={vP} />;
  const gem = reiter === 'fehlzeiten' ? abwZeitraum() : null;
  const eigene = el.daten.klassen.find(k => ich.element && (k.leitung ?? []).some(l => l.toLowerCase() === ich.element.toLowerCase()))?.kurz;
  const gemerkt = kbKlasse();
  const klasse = klasseRoh || (reiter === 'fehlzeiten' && gem?.klasse && el.daten.klassen.some(k => k.kurz === gem.klasse) ? gem.klasse : null)
    || (gemerkt && el.daten.klassen.some(k => k.kurz === gemerkt) ? gemerkt : null) || eigene || el.daten.klassen[0]?.kurz || '';
  const datum = istIsoDatum(dP) ? dP : gem?.bis ?? heuteIso();
  const ziel = (k: string, r: string, d = datum) => `#/klassenbuch/${encodeURIComponent(k)}/${r}/${d}`;
  if (!klasse) return <Seite titel="Klassenbuch"><Leer text="Keine Klassen vorhanden." /></Seite>;
  const name = el.daten.klassen.find(k => k.kurz === klasse)?.name;
  const leitung = el.daten.klassen.find(k => k.kurz === klasse)?.leitung ?? [];
  return (
    <Seite titel={`${TITEL[reiter]} · ${klasse}`} untertitel={<>{name && name !== klasse ? `${name} · ` : ''}{leitung.length ? `Klassenleitung ${leitung.join(', ')} · ` : ''}{UNTERTITEL[reiter]}</>} dokumentTitel={`Klassenbuch ${klasse} – ${TITEL[reiter]}`}
      aktionen={<ElementWahl liste={el.daten.klassen} wert={klasse} onWahl={k => { kbKlasseMerken(k); navigieren(ziel(k, reiter)); }} platzhalter="Klasse wählen" breite={170} />}>
      {reiter === 'woche' && <Wochenansicht klasse={klasse} datum={datum} ziel={ziel} />}
      {reiter === 'fehlzeiten' && <Fehlzeiten klasse={klasse} bis={datum} vonParam={vP} ziel={ziel} />}
      {reiter === 'vermerke' && <Vermerke klasse={klasse} />}
      {reiter === 'verlauf' && <Verlauf klasse={klasse} />}
    </Seite>
  );
}
