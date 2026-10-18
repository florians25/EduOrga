// Melden: Übersicht der Meldearten als Kacheln (Abwesenheit melden, Prüfung eintragen, Raum buchen, Meine Meldungen) mit den letzten
// Meldungen, Formulare für Abwesenheit und Prüfung (Raumwahl mit Belegung) und „Meine Meldungen“ mit Suche, Status- und Art-Filter,
// Zurückziehen offener Meldungen und Löschen eingetragener Prüfungen. Raum buchen führt in das Buchungsmodul.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, Autocomplete, Badge, Box, Button, Chip, MenuItem, Paper, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import ArrowForwardIosRounded from '@mui/icons-material/ArrowForwardIosRounded';
import ChatOutlined from '@mui/icons-material/ChatOutlined';
import ChecklistRounded from '@mui/icons-material/ChecklistRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import EventBusyOutlined from '@mui/icons-material/EventBusyOutlined';
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined';
import HighlightOffRounded from '@mui/icons-material/HighlightOffRounded';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import MeetingRoomOutlined from '@mui/icons-material/MeetingRoomOutlined';
import PersonRemoveOutlined from '@mui/icons-material/PersonRemoveOutlined';
import SendRounded from '@mui/icons-material/SendRounded';
import UndoRounded from '@mui/icons-material/UndoRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import { holen, loeschen, senden } from '../../api/client';
import type { Element, Zeit } from '../../api/types';
import { useSitzung } from '../../app/sitzung';
import { Geladen, Leer, Seite } from '../../components/Seite';
import { SuchFeld, Wahl } from '../../components/Bausteine';
import { DatumFeld } from '../../components/Auswahl';
import { RaumFeld } from '../../components/RaumListe';
import { datumLang, heuteIso, plusTage } from '../../lib/datum';
import { bestaetigen, fehler, toast } from '../../lib/meldungen';
import { navigieren } from '../../lib/router';
import { useLaden } from '../../lib/useLaden';
import type { SeitenProps } from '../register';
import { pruefungLoeschen, type Pruefung } from '../unterricht/Pruefungen';
import { meldungText, MeldungStatus, type Meldung } from './meldungen';

const GRUENDE = ['Krankheit', 'Fortbildung', 'Dienstlicher Termin', 'Klassenfahrt / Exkursion', 'Sonderurlaub', 'Sonstiges'];
const ART: Record<string, { text: string; icon: ReactNode }> = {
  absenz: { text: 'Abwesenheit', icon: <PersonRemoveOutlined /> }, klausur: { text: 'Prüfung', icon: <FactCheckOutlined /> }, klausurloeschen: { text: 'Prüfung löschen', icon: <DeleteOutlineRounded /> },
  raumbuchung: { text: 'Raumbuchung', icon: <MeetingRoomOutlined /> }, buchungstorno: { text: 'Storno', icon: <HighlightOffRounded /> }, nachricht: { text: 'Nachricht', icon: <ChatOutlined /> },
};
const artVon = (m: Meldung) => ART[m.typ] ?? ART.nachricht;
const titelVon = (m: Meldung) => meldungText(m).replace(/^Klausur /, 'Prüfung ');
const erstelltText = (m: Meldung) => { const d = new Date(String(m.erstellt ?? '').replace(' ', 'T')); return isNaN(+d) ? '' : d.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }); };

export default function Melden({ teile }: SeitenProps) {
  const { elemente } = useSitzung();
  const bereich = ['abwesenheit', 'klausur', 'meine'].includes(teile[0]) ? teile[0] : 'uebersicht';
  useEffect(() => { if (teile[0] === 'raum') navigieren('#/buchen/raum', true); }, [teile]);
  const g = useLaden(async () => {
    const el = await elemente();
    const stunden: Zeit[] = (el.stunden ?? []).filter(s => s.nr > 0);
    if (!stunden.length) for (let i = 1; i <= 10; i++) stunden.push({ nr: i, bezeichnung: String(i), beginn: '', ende: '' });
    return { el, stunden };
  }, []);
  const titel = { uebersicht: 'Melden', abwesenheit: 'Abwesenheit melden', klausur: 'Prüfung eintragen', meine: 'Meine Meldungen' }[bereich]!;
  if (bereich === 'meine') return <Meine />;
  return (
    <Seite titel={titel} breit={bereich === 'uebersicht'}>
      {bereich === 'uebersicht' ? <Uebersicht /> : <Geladen g={g}>{({ el, stunden }) => bereich === 'abwesenheit' ? <Abwesenheit stunden={stunden} /> : <Klausur stunden={stunden} klassen={el.klassen} lehrer={el.lehrer} />}</Geladen>}
    </Seite>
  );
}

function MeldungZeile({ m, aktionen, neu }: { m: Meldung; aktionen?: boolean; neu?: () => void }) {
  const a = artVon(m);
  const aktion = !aktionen ? null : m.typ === 'klausur' && (m.von ?? '') >= heuteIso()
    ? <Button size="small" color="error" startIcon={<DeleteOutlineRounded />} onClick={async () => {
      if (await pruefungLoeschen({ datum: m.von!, stundeVon: m.stundeVon ?? 1, stundeBis: m.stundeBis ?? m.stundeVon ?? 1, klassen: m.klassen ?? [], titel: m.titel ?? '' } as Pruefung)) neu?.();
    }}>Löschen</Button>
    : m.status === 'offen' ? <Button size="small" startIcon={<UndoRounded />} onClick={async () => {
      if (!(await bestaetigen('Meldung zurückziehen', 'Soll die Meldung zurückgezogen werden?', 'Zurückziehen'))) return;
      try { await loeschen(`/api/app/meldungen/${encodeURIComponent(m.id)}`); toast('Meldung zurückgezogen.'); neu?.(); } catch (err) { fehler(err); }
    }}>Zurückziehen</Button> : null;
  return (
    <Stack direction="row" gap={1.5} alignItems="center" sx={{ py: 1.25, px: 2, borderTop: 1, borderColor: 'divider', '&:first-of-type': { borderTop: 0 }, opacity: m.status === 'abgelehnt' ? 0.75 : 1 }}>
      <Box sx={{ width: 36, height: 36, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'action.selected', color: 'primary.main', flexShrink: 0, '& svg': { fontSize: 20 } }} title={a.text}>{a.icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 500 }} noWrap>{titelVon(m)}</Typography>
        <Typography variant="body2" color="text.secondary" noWrap>{a.text}{erstelltText(m) && ` · gemeldet ${erstelltText(m)}`}{m.text && m.typ !== 'nachricht' ? ` · ${m.text}` : ''}</Typography>
      </Box>
      <MeldungStatus s={m.status} />
      {aktion}
    </Stack>
  );
}

function Uebersicht() {
  const g = useLaden(sig => holen<Meldung[]>('/api/app/meldungen', sig).catch(() => [] as Meldung[]), []);
  const offen = (g.daten ?? []).filter(m => m.status === 'offen').length;
  const kachel = (href: string, icon: ReactNode, titel: string, text: string, zahl = 0) => (
    <Paper variant="outlined" component="a" href={href} sx={{ p: 2.25, display: 'flex', gap: 2, alignItems: 'center', textAlign: 'left', borderRadius: 3.5, justifyContent: 'flex-start', textDecoration: 'none', color: 'inherit', transition: 'border-color .12s, box-shadow .12s', '&:hover': { borderColor: 'primary.main', boxShadow: '0 6px 18px rgba(21,26,33,.07)' } }}>
      <Badge badgeContent={zahl} color="primary"><Box sx={{ width: 46, height: 46, borderRadius: 3, display: 'grid', placeItems: 'center', bgcolor: 'action.selected', color: 'primary.main' }}>{icon}</Box></Badge>
      <Box sx={{ flex: 1 }}><Typography sx={{ fontWeight: 600 }}>{titel}</Typography><Typography variant="body2" color="text.secondary">{text}</Typography></Box>
      <ArrowForwardIosRounded sx={{ fontSize: 14, color: 'text.disabled' }} />
    </Paper>
  );
  return (
    <Stack gap={3}>
      <Typography color="text.secondary">Was möchten Sie melden? Meldungen gehen an die Planung und erscheinen nach der Übernahme im Stundenplan.</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
        {kachel('#/melden/abwesenheit', <PersonRemoveOutlined />, 'Abwesenheit melden', 'Krankheit, Fortbildung oder Termin – ganztägig oder für einzelne Stunden')}
        {kachel('#/melden/klausur', <FactCheckOutlined />, 'Prüfung eintragen', 'Klassenarbeit, Klausur oder Test mit Raum und Aufsicht')}
        {kachel('#/buchen/raum', <MeetingRoomOutlined />, 'Raum buchen', 'Freien Raum für eine Stunde oder als Serie buchen')}
        {kachel('#/melden/meine', <ChecklistRounded />, 'Meine Meldungen', 'Status verfolgen, offene Meldungen zurückziehen', offen)}
      </Box>
      <Paper variant="outlined">
        <Stack direction="row" alignItems="center" sx={{ px: 2, pt: 1.75, pb: 1 }}><Typography variant="h3" sx={{ flex: 1 }}>Zuletzt gemeldet</Typography>{!!g.daten?.length && <Button size="small" href="#/melden/meine">Alle anzeigen</Button>}</Stack>
        <Geladen g={g}>{l => l.length ? <Box>{l.slice(0, 4).map(m => <MeldungZeile key={m.id} m={m} />)}</Box> : <Leer text="Noch keine Meldungen" unter="Ihre Meldungen erscheinen hier mit ihrem Status." />}</Geladen>
      </Paper>
    </Stack>
  );
}

function FormKarte({ icon, titel, unter, children, fuss }: { icon: ReactNode; titel: string; unter: string; children: ReactNode; fuss: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ maxWidth: 820 }}>
      <Stack direction="row" gap={2} alignItems="center" sx={{ p: 2.5, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ width: 44, height: 44, borderRadius: 3, display: 'grid', placeItems: 'center', bgcolor: 'action.selected', color: 'primary.main' }}>{icon}</Box>
        <Box><Typography variant="h3">{titel}</Typography><Typography variant="body2" color="text.secondary">{unter}</Typography></Box>
      </Stack>
      <Box sx={{ p: 2.5 }}>{children}</Box>
      <Stack direction="row" gap={1} justifyContent="flex-end" sx={{ px: 2.5, py: 1.5, borderTop: 1, borderColor: 'divider' }}>{fuss}</Stack>
    </Paper>
  );
}

const stundenWahl = (stunden: Zeit[], label: string, wert: number, onWert: (n: number) => void) => (
  <TextField select label={label} value={wert} onChange={e => onWert(Number(e.target.value))} sx={{ flex: 1, minWidth: 140 }}>
    {stunden.map(s => <MenuItem key={s.nr} value={s.nr}>{s.bezeichnung || s.nr}. Stunde{s.beginn && <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>{s.beginn}{s.ende ? `–${s.ende}` : ''}</Typography>}</MenuItem>)}
  </TextField>
);

function Abwesenheit({ stunden }: { stunden: Zeit[] }) {
  const [von, setVon] = useState(heuteIso());
  const [bis, setBis] = useState(heuteIso());
  const [ganz, setGanz] = useState(true);
  const [sv, setSv] = useState(1);
  const [sb, setSb] = useState(stunden[stunden.length - 1].nr);
  const [grund, setGrund] = useState(GRUENDE[0]);
  const [text, setText] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const zeitraum = von === bis || !bis ? datumLang(von) : `${datumLang(von)} bis ${datumLang(bis)}`;
  return (
    <FormKarte icon={<PersonRemoveOutlined />} titel="Abwesenheit melden" unter="Die Meldung geht an die Vertretungsplanung und wird dort als Abwesenheit übernommen."
      fuss={<><Button variant="outlined" href="#/melden">Abbrechen</Button><Button variant="contained" startIcon={<SendRounded />} disabled={laeuft} onClick={async () => {
        setLaeuft(true);
        try {
          await senden('/api/app/meldungen/abwesenheit', { von, bis, grund, text, stundeVon: ganz ? null : sv, stundeBis: ganz ? null : sb });
          toast('Abwesenheit gemeldet.'); navigieren('#/melden/meine');
        } catch (err) { fehler(err); } finally { setLaeuft(false); }
      }}>Abwesenheit melden</Button></>}>
      <Stack gap={2.5}>
        <Stack direction="row" gap={2} flexWrap="wrap">
          <DatumFeld label="Von" wert={von} onWert={v => { if (v) { setVon(v); if (bis < v) setBis(v); } }} pflicht />
          <DatumFeld label="Bis" wert={bis} onWert={v => v && setBis(v)} min={von} pflicht />
        </Stack>
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>Umfang</Typography>
          <ToggleButtonGroup exclusive value={ganz ? 'ganz' : 'stunden'} onChange={(_, v) => v && setGanz(v === 'ganz')}><ToggleButton value="ganz">Ganztägig</ToggleButton><ToggleButton value="stunden">Einzelne Stunden</ToggleButton></ToggleButtonGroup>
        </Box>
        {!ganz && <Stack direction="row" gap={2}>{stundenWahl(stunden, 'Ab', sv, n => { setSv(n); if (sb < n) setSb(n); })}{stundenWahl(stunden, 'Bis', sb, n => setSb(Math.max(n, sv)))}</Stack>}
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>Grund</Typography>
          <Stack direction="row" gap={1} flexWrap="wrap" role="radiogroup" aria-label="Grund">{GRUENDE.map(x => <Chip key={x} label={x} role="radio" aria-checked={grund === x} color={grund === x ? 'primary' : 'default'} variant={grund === x ? 'filled' : 'outlined'} onClick={() => setGrund(x)} />)}</Stack>
        </Box>
        <TextField label="Hinweise für die Vertretung (optional)" value={text} onChange={e => setText(e.target.value)} multiline minRows={3} placeholder="z. B. Material liegt im Fach, Aufgaben im Kurs" slotProps={{ htmlInput: { maxLength: 1000 } }} />
        <Alert severity="info" icon={<InfoOutlined />}>{zeitraum}{ganz ? ', ganztägig' : `, ${sv}.–${sb}. Stunde`} · {grund}</Alert>
      </Stack>
    </FormKarte>
  );
}

function Klausur({ stunden, klassen, lehrer }: { stunden: Zeit[]; klassen: Element[]; lehrer: Element[] }) {
  const [titel, setTitel] = useState('');
  const [datum, setDatum] = useState(plusTage(heuteIso(), 7));
  const [sv, setSv] = useState(Math.min(3, stunden[stunden.length - 1].nr));
  const [sb, setSb] = useState(Math.min(4, stunden[stunden.length - 1].nr));
  const [kl, setKl] = useState<string[]>([]);
  const [raeume, setRaeume] = useState<string[]>([]);
  const [aufsicht, setAufsicht] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const mehrfach = (label: string, liste: Element[], wert: string[], onWert: (l: string[]) => void, platzhalter: string) => (
    <Autocomplete multiple options={liste.map(x => x.kurz)} value={wert} onChange={(_, v) => onWert(v)} disableCloseOnSelect sx={{ flex: '1 1 280px' }}
      getOptionLabel={o => o} renderOption={(p, o) => { const { key, ...rest } = p as typeof p & { key: string }; const x = liste.find(y => y.kurz === o); return <li key={key} {...rest}><b>{o}</b>{x?.name && x.name !== o && <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>{x.name}</Typography>}</li>; }}
      renderInput={p => <TextField {...p} label={label} placeholder={wert.length ? '' : platzhalter} />} />
  );
  return (
    <FormKarte icon={<FactCheckOutlined />} titel="Prüfung eintragen" unter="Die Prüfung steht sofort im Stundenplan und wird von UntPlan übernommen."
      fuss={<><Button variant="outlined" href="#/melden">Abbrechen</Button><Button variant="contained" startIcon={<SendRounded />} disabled={laeuft} onClick={async () => {
        if (!titel.trim()) { toast('Bitte einen Titel angeben.', true); return; }
        if (!kl.length) { toast('Bitte mindestens eine Klasse auswählen.', true); return; }
        setLaeuft(true);
        try {
          await senden('/api/app/meldungen/klausur', { datum, stundeVon: sv, stundeBis: sb, klassen: kl, raeume, aufsicht, titel: titel.trim(), text });
          toast('Prüfung eingetragen.'); navigieren('#/melden/meine');
        } catch (err) { fehler(err); } finally { setLaeuft(false); }
      }}>Prüfung eintragen</Button></>}>
      <Stack gap={2.5}>
        <TextField label="Titel" value={titel} onChange={e => setTitel(e.target.value)} required placeholder="z. B. Deutsch Klassenarbeit" slotProps={{ htmlInput: { maxLength: 200 } }} />
        <Stack direction="row" gap={2} flexWrap="wrap">
          <DatumFeld label="Datum" wert={datum} onWert={v => v && setDatum(v)} min={heuteIso()} pflicht />
          {stundenWahl(stunden, 'Von', sv, n => { setSv(n); if (sb < n) setSb(n); })}{stundenWahl(stunden, 'Bis', sb, n => setSb(Math.max(n, sv)))}
        </Stack>
        <Stack direction="row" gap={2} flexWrap="wrap">{mehrfach('Klassen / Kurse', klassen, kl, setKl, 'Klassen wählen')}{mehrfach('Aufsicht (optional)', lehrer, aufsicht, setAufsicht, 'Lehrkräfte wählen')}</Stack>
        <RaumFeld label="Räume (optional)" wert={raeume} onWert={setRaeume} datum={datum} von={sv} bis={sb} />
        <TextField label="Bemerkung (optional)" value={text} onChange={e => setText(e.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} />
      </Stack>
    </FormKarte>
  );
}

function Meine() {
  const g = useLaden(sig => holen<Meldung[]>('/api/app/meldungen', sig), []);
  const [suche, setSuche] = useState('');
  const [status, setStatus] = useState('');
  const [art, setArt] = useState('');
  const liste = g.daten ?? [];
  const arten = useMemo(() => [...new Set(liste.map(m => (ART[m.typ] ? m.typ : 'nachricht')))], [liste]);
  const anzahl = (s: string) => liste.filter(m => !s || m.status === s).length;
  const f = suche.trim().toLowerCase();
  const l = liste.filter(m => (!status || m.status === status) && (!art || (ART[m.typ] ? m.typ : 'nachricht') === art) && (!f || `${titelVon(m)} ${m.text ?? ''} ${artVon(m).text}`.toLowerCase().includes(f)));
  return (
    <Seite titel="Meine Meldungen" untertitel={g.daten ? `${liste.length} Meldungen` : undefined} aktionen={<Button variant="contained" startIcon={<AddRounded />} href="#/melden">Neue Meldung</Button>}
      filter={<>
        <SuchFeld wert={suche} onWert={setSuche} platzhalter="Meldungen durchsuchen" />
        <Wahl label="Status" wert={status} onWert={setStatus} alle={`Jeder Status (${anzahl('')})`} breite={220}
          optionen={[['offen', 'Offen'], ['quittiert', 'Übernommen'], ['abgelehnt', 'Abgelehnt']].map(([w, t]) => [w, `${t} (${anzahl(w)})`] as [string, string])} />
        {arten.length > 1 && <Wahl label="Art" wert={art} onWert={setArt} alle="Alle Arten" optionen={arten.map(a => [a, ART[a].text] as [string, string])} />}
      </>}>
      <Geladen g={g}>{() => !liste.length
        ? <Leer text="Noch keine Meldungen" symbol={<EventBusyOutlined />} unter="Melden Sie eine Abwesenheit oder tragen Sie eine Prüfung ein – hier sehen Sie dann den Status." aktion={{ text: 'Neue Meldung', onClick: () => navigieren('#/melden') }} />
        : l.length ? <Paper variant="outlined">{l.map(m => <MeldungZeile key={m.id} m={m} aktionen neu={() => void g.neu()} />)}</Paper>
          : <Leer text="Keine Meldungen für diesen Filter" aktion={{ text: 'Filter zurücksetzen', onClick: () => { setSuche(''); setStatus(''); setArt(''); } }} />}</Geladen>
    </Seite>
  );
}
