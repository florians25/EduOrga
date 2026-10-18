// Klassenbuch → Abwesenheiten: Zeiträume der Schülerabwesenheiten mit Filter (Klasse, Status, Art, Grund, Zeitraum), Kennzahlen,
// Neu/Bearbeiten/Löschen, Entschuldigen, Zusammenfassen, CSV; Reiter „Meine Abwesenheiten“ (eigene Meldungen der Lehrkraft).
// Schüler*innen und Erziehungsberechtigte sehen ihre eigenen Seiten (FamilieAbwesenheiten).
import { useEffect, useState } from 'react';
import { Autocomplete, Box, Button, ButtonBase, FormControlLabel, MenuItem, Paper, Stack, Switch, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import { holen, senden, qs, speichern } from '../../api/client';
import type { Elemente } from '../../api/types';
import { useSitzung } from '../../app/sitzung';
import { Geladen, Leer, Seite } from '../../components/Seite';
import { DatumKachel, FormDialog, NamensAvatar, Plakette, SuchFeld, Wahl } from '../../components/Bausteine';
import { DatumFeld, ZeitFeld } from '../../components/Auswahl';
import { Tabelle } from '../../components/Tabelle';
import { abwZeitraum, DetailFelder, detailsVon, DetailSymbole, NACHWEISE, StatusLabel, STATUS_TEXT, type Details } from '../../components/klassenbuch/fehlzeiten';
import { bestaetigen, toast } from '../../lib/meldungen';
import { datumDe, heuteIso, istIsoDatum, plusTage, wochentagKurz, datumKurz } from '../../lib/datum';
import { navigieren } from '../../lib/router';
import { useLaden } from '../../lib/useLaden';
import { meldungText, MeldungStatus, type Meldung } from '../melden/meldungen';
import FamilieAbwesenheiten from '../familie/FamilieAbwesenheiten';
import { AbwesenheitEntschuldigen, FehlzeitenLeiste, type FeAbwesenheit } from './Entschuldigen';
import type { SeitenProps } from '../register';

interface Zeitraum extends Partial<Details> {
  schluessel: string; ids: number[]; schuelerId: number; schueler: string; klasse: string; vonDatum: string; vonZeit: string; bisDatum: string; bisZeit: string; art: string; minuten: number;
  fehlstunden: number; fehlminuten: number; grund: string; status: string; statusGemischt?: boolean; entschuldigt: number; unentschuldigt: number; text: string; lehrer: string[]; faecher: string[]; verwalten: boolean; erstellt?: string;
}
const ARTEN: Record<string, string> = { fehlt: 'abwesend', verspaetet: 'verspätet', vorzeitig: 'vorzeitig gegangen' };
interface Grund { kurz: string; name: string }

function ArtChip({ z }: { z: Zeitraum }) {
  if (z.art === 'verspaetet') return <Plakette ton="pruefung">verspätet {z.minuten} min</Plakette>;
  if (z.art === 'vorzeitig') return <Plakette ton="termin">vorzeitig {z.minuten} min</Plakette>;
  return <span>abwesend</span>;
}

function AbwesenheitFormular({ z, el, gruende, texte, klasseVorgabe, onClose, fertig }: { z: Zeitraum | null; el: Elemente; gruende: Grund[]; texte: string[]; klasseVorgabe: string; onClose: () => void; fertig: () => void }) {
  const tagesbeginn = el.stunden[0]?.beginn || '07:45', tagesende = el.stunden[el.stunden.length - 1]?.ende || '16:00';
  const [klasse, setKlasse] = useState(z?.klasse ?? klasseVorgabe);
  const [schueler, setSchueler] = useState<{ id: number; name: string; vorname: string }[]>([]);
  const [sid, setSid] = useState<number | ''>(z?.schuelerId ?? '');
  const [vd, setVd] = useState(z?.vonDatum ?? heuteIso());
  const [vz, setVz] = useState(z?.vonZeit ?? tagesbeginn);
  const [bd, setBd] = useState(z?.bisDatum ?? heuteIso());
  const [bz, setBz] = useState(z?.bisZeit ?? tagesende);
  const [ganz, setGanz] = useState(!!z && z.vonZeit <= tagesbeginn && z.bisZeit >= tagesende);
  const [grund, setGrund] = useState(z?.grund ?? '');
  const [status, setStatus] = useState(z?.status ?? 'offen');
  const [text, setText] = useState(z?.text ?? '');
  const [det, setDet] = useState<Details>(detailsVon(z ?? {}));
  useEffect(() => {
    if (z || !klasse) return;
    holen<typeof schueler>(`/api/app/klassenbuch/schueler?klasse=${encodeURIComponent(klasse)}`).then(s => { setSchueler(s); setSid(s[0]?.id ?? ''); }).catch(() => setSchueler([]));
  }, [klasse, z]);
  const speichern2 = async () => {
    if (!sid) { toast('Bitte eine Schülerin bzw. einen Schüler wählen.', true); return false; }
    const r = await senden<{ stunden: number }>('/api/app/klassenbuch/abwesenheit', { schuelerIds: [sid], von: `${vd}T${ganz ? tagesbeginn : vz}`, bis: `${bd}T${ganz ? tagesende : bz}`, ganztaegig: ganz || null,
      ...(z ? { ersetzen: z.ids } : {}), grund, status, text, ...det });
    toast(z ? 'Gespeichert.' : `${r.stunden} ${r.stunden === 1 ? 'Fehlstunde' : 'Fehlstunden'} eingetragen.`);
    fertig();
  };
  return (
    <FormDialog offen titel={z ? `Abwesenheit ${z.schueler}` : 'Neue Abwesenheit'} untertitel={z ? `${z.fehlstunden} Fehlstunden · ${z.fehlminuten} min · ${z.faecher.join(', ')}` : undefined} onClose={onClose} aktion={speichern2} breite="md">
      <Stack gap={2} sx={{ pt: 0.5 }}>
        {!z && (
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <TextField select label="Klasse" value={klasse} onChange={e => setKlasse(e.target.value)} sx={{ width: { sm: 160 } }}>{el.klassen.map(k => <MenuItem key={k.kurz} value={k.kurz}>{k.kurz}</MenuItem>)}</TextField>
            <TextField select label="Schüler*in" value={sid} onChange={e => setSid(Number(e.target.value))} sx={{ flex: 1 }}>{schueler.map(s => <MenuItem key={s.id} value={s.id}>{s.name} {s.vorname}</MenuItem>)}</TextField>
          </Stack>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <Stack direction="row" gap={1}><DatumFeld label="Von" wert={vd} onWert={d => d && setVd(d)} pflicht /><ZeitFeld label="Uhrzeit" wert={ganz ? tagesbeginn : vz ?? ''} onWert={v => setVz(v)} deaktiviert={ganz} /></Stack>
          <Stack direction="row" gap={1}><DatumFeld label="Bis" wert={bd} onWert={d => d && setBd(d)} pflicht /><ZeitFeld label="Uhrzeit" wert={ganz ? tagesende : bz ?? ''} onWert={v => setBz(v)} deaktiviert={ganz} /></Stack>
        </Stack>
        <Typography variant="caption" color="text.secondary">Minutengenau: angebrochene Stunden werden als Verspätung bzw. vorzeitiges Gehen gezählt.</Typography>
        <FormControlLabel control={<Switch checked={ganz} onChange={e => setGanz(e.target.checked)} />} label="Ganztägig – alle Unterrichtsstunden der gewählten Tage" />
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <TextField select label="Abwesenheitsgrund" value={grund} onChange={e => setGrund(e.target.value)} sx={{ flex: 1 }}><MenuItem value="">–</MenuItem>{gruende.map(g => <MenuItem key={g.kurz} value={g.kurz}>{g.name}</MenuItem>)}</TextField>
          <TextField select label="Status" value={status} onChange={e => setStatus(e.target.value)} sx={{ flex: 1 }}>{Object.entries(STATUS_TEXT).map(([k, [t]]) => <MenuItem key={k} value={k}>{t}</MenuItem>)}</TextField>
        </Stack>
        <Autocomplete freeSolo options={texte} value={text} onInputChange={(_, v) => setText(v)} renderInput={p => <TextField {...p} label="Text" />} />
        <DetailFelder w={det} setW={setDet} />
        {z?.erstellt && <Typography variant="caption" color="text.secondary">Erfasst {datumDe(z.erstellt.slice(0, 10))}{z.erstellt.slice(10)}{z.lehrer.length ? ` von ${z.lehrer.join(', ')}` : ''}</Typography>}
      </Stack>
    </FormDialog>
  );
}

function EntschuldigenDialog({ ids, texte, onClose, fertig }: { ids: number[]; texte: string[]; onClose: () => void; fertig: () => void }) {
  const [text, setText] = useState('');
  const [nachweis, setNachweis] = useState('');
  const [am, setAm] = useState<string | null>(heuteIso());
  return (
    <FormDialog offen titel="Entschuldigen" onClose={onClose} aktionText="Entschuldigen" aktion={async () => {
      await senden('/api/app/abwesenheiten', { ids, status: 'entschuldigt', bemerkung: text.trim() || null, nachweis: nachweis || null, entschuldigtAm: am || null }, 'PUT');
      toast('Entschuldigt.'); fertig();
    }}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        <Autocomplete freeSolo options={texte} value={text} onInputChange={(_, v) => setText(v)} renderInput={p => <TextField {...p} label="Text" placeholder="z. B. Attest liegt vor" />} />
        <Stack direction="row" gap={2}>
          <TextField select label="Nachweis" value={nachweis} onChange={e => setNachweis(e.target.value)} sx={{ flex: 1 }}><MenuItem value="">kein Nachweis</MenuItem>{Object.entries(NACHWEISE).map(([k, t]) => <MenuItem key={k} value={k}>{t}</MenuItem>)}</TextField>
          <DatumFeld label="Eingegangen am" wert={am} onWert={setAm} />
        </Stack>
      </Stack>
    </FormDialog>
  );
}

export default function Abwesenheiten(props: SeitenProps) {
  const s = useSitzung();
  if (s.familie) return <FamilieAbwesenheiten teile={props.teile} />;
  return <AbwesenheitenKollegium {...props} />;
}

function AbwesenheitenKollegium({ teile }: SeitenProps) {
  const { ich, elemente } = useSitzung();
  const [rP, vP, bP, kP, sP, gP, aP] = teile;
  const reiter = rP === 'meine' && ich.element ? 'meine' : 'schueler';
  const gemeinsam = abwZeitraum();
  const von = istIsoDatum(vP) ? vP : gemeinsam?.von ?? plusTage(heuteIso(), -14);
  const bis = istIsoDatum(bP) ? bP : gemeinsam?.bis ?? heuteIso();
  const klasse = kP && kP !== '-' ? kP : kP === '-' ? '' : gemeinsam?.klasse ?? '';
  const status = ['offen', 'entschuldigt', 'unentschuldigt'].includes(sP) ? sP : '';
  const grund = gP && gP !== '-' ? gP : '';
  const art = ARTEN[aP] ? aP : '';
  useEffect(() => { if (reiter === 'schueler') abwZeitraum({ von, bis, klasse: klasse || gemeinsam?.klasse || '' }); });
  const ziel = (r = reiter, v = von, b = bis, k = klasse, st = status, g = grund, a = art) => `#/abwesenheiten/${r}/${v}/${b}/${encodeURIComponent(k || '-')}/${st || '-'}/${encodeURIComponent(g || '-')}${a ? `/${a}` : ''}`;
  const [suche, setSuche] = useState('');
  const [auswahl, setAuswahl] = useState<Set<string | number>>(new Set());
  const [dialog, setDialog] = useState<null | { art: 'neu' } | { art: 'bearbeiten'; z: Zeitraum } | { art: 'entschuldigen'; ids: number[] } | { art: 'fe'; liste: FeAbwesenheit[]; status: string } | { art: 'leiste'; a: FeAbwesenheit }>(null);
  const g = useLaden(async () => {
    const el = await elemente();
    if (reiter === 'meine') return { el, meine: (await holen<Meldung[]>('/api/app/meldungen')).filter(m => m.typ === 'absenz') };
    const q = qs({ von, bis, klasse, status });
    const [zr, gruende, fe, texte] = await Promise.all([
      holen<Zeitraum[]>(`/api/app/abwesenheiten/zeitraeume${q}`),
      holen<Grund[]>('/api/app/abwesenheitsgruende?art=abwesenheit').catch(() => []),
      holen<{ aktiv: boolean }>('/api/app/entschuldigungen/einstellungen').then(x => (x.aktiv ? holen<FeAbwesenheit[]>(`/api/app/entschuldigungen/abwesenheiten${q}`) : null)).catch(() => null),
      holen<string[]>('/api/app/abwesenheiten/texte').catch(() => []),
    ]);
    return { el, zr, gruende, fe: fe ? Object.fromEntries(fe.map(x => [x.schluessel, x])) as Record<string, FeAbwesenheit> : null, texte };
  }, [reiter, von, bis, klasse, status]);
  const neu = () => { setAuswahl(new Set()); void g.neu(); };
  const d = g.daten;
  const roh = d?.zr ?? [];
  const liste = roh.filter(z => (!grund || z.grund === grund) && (!art || z.art === art) && (!suche || `${z.schueler} ${z.klasse}`.toLowerCase().includes(suche.toLowerCase())));
  const verwalten = roh.some(z => z.verwalten) || ich.admin;
  const grundName = (x: string) => d?.gruende?.find(y => y.kurz === x)?.name ?? x;
  const gewaehlt = () => liste.filter(z => auswahl.has(z.schluessel));
  const statusSetzen = async (st: string) => {
    const a = gewaehlt();
    if (!a.length) { toast('Bitte zuerst Abwesenheiten auswählen.', true); return; }
    if (d?.fe && a.every(z => d.fe![z.schluessel])) { setDialog({ art: 'fe', liste: a.map(z => d.fe![z.schluessel]), status: st }); return; }
    if (st === 'entschuldigt') { setDialog({ art: 'entschuldigen', ids: a.flatMap(z => z.ids) }); return; }
    try { await senden('/api/app/klassenbuch/fehlzeiten/status', { ids: a.flatMap(z => z.ids), status: st }); toast('Status geändert.'); neu(); } catch (err) { toast((err as Error).message, true); }
  };
  const csv = () => speichern(['Schüler*in;Klasse;Von;Bis;Fehlstunden;Art;Minuten;Grund;Fach;Status;Text;Nachweis;Entschuldigung am;Eltern informiert;erfasst von',
    ...liste.map(z => [z.schueler, z.klasse, `${z.vonDatum} ${z.vonZeit}`, `${z.bisDatum} ${z.bisZeit}`, z.fehlstunden, z.art, z.art === 'fehlt' ? z.fehlminuten : z.minuten, grundName(z.grund), z.faecher.join(', '), z.status, z.text,
      NACHWEISE[z.nachweis ?? ''] ?? '', z.entschuldigtAm ?? '', z.elternInformiert ? 'ja' : '', z.lehrer.join(', ')].map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(';'))].join('\r\n'), `abwesenheiten-${von}-${bis}.csv`);
  const kz = (text: string, n: number | string, an: boolean, onClick?: () => void, ton?: 'entfall' | 'pruefung' | 'termin') => (
    <ButtonBase onClick={onClick} disabled={!onClick} sx={{ px: 1.5, py: 0.75, borderRadius: 999, border: 1, borderColor: an ? 'primary.main' : 'divider', bgcolor: an ? 'action.selected' : 'background.paper', gap: 0.75, fontSize: 13 }}>
      <Box component="b" sx={{ color: ton ? `status.${ton}.main` : 'text.primary' }}>{n}</Box>{text}
    </ButtonBase>
  );
  return (
    <Seite titel="Abwesenheiten" untertitel={reiter === 'schueler' && d?.zr ? `${liste.length} ${liste.length === 1 ? 'Abwesenheit' : 'Abwesenheiten'}` : undefined}
      aktionen={reiter === 'meine' ? <Button variant="contained" startIcon={<AddRounded />} href="#/melden/abwesenheit">Abwesenheit melden</Button> : <>
        <Button variant="outlined" startIcon={<FileDownloadOutlined />} onClick={csv} disabled={!liste.length}>Bericht (CSV)</Button>
        {verwalten && <Button variant="contained" startIcon={<AddRounded />} onClick={() => setDialog({ art: 'neu' })}>Hinzufügen</Button>}</>}>
      {ich.element && <Tabs value={reiter} onChange={(_, v) => navigieren(ziel(v))} sx={{ mb: 2 }}><Tab value="schueler" label="Schüler*innen" /><Tab value="meine" label="Meine Abwesenheiten" /></Tabs>}
      <Geladen g={g}>{dd => reiter === 'meine' ? (
        <Paper variant="outlined" sx={{ borderRadius: 3.5 }}>
          {dd.meine?.length ? dd.meine.map(m => (
            <Stack key={m.id} direction="row" gap={2} alignItems="center" sx={{ p: 2, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}>
              <DatumKachel datum={m.von ?? heuteIso()} />
              <Box sx={{ flex: 1 }}><Typography sx={{ fontWeight: 600 }}>{m.grund || 'Abwesenheit'}</Typography><Typography variant="body2" color="text.secondary">{meldungText(m)}</Typography>{m.text && <Typography variant="body2">{m.text}</Typography>}</Box>
              <MeldungStatus s={m.status} />
            </Stack>
          )) : <Leer text="Sie haben noch keine Abwesenheit gemeldet." />}
        </Paper>
      ) : (
        <>
          <Paper variant="outlined" className="nicht-drucken" sx={{ p: 1.5, mb: 1.5, borderRadius: 3.5, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <SuchFeld wert={suche} onWert={setSuche} platzhalter="Schüler*in suchen" breite={220} />
            <Wahl label="Klasse" wert={klasse} onWert={k => navigieren(ziel(reiter, von, bis, k))} optionen={dd.el.klassen.map(k => [k.kurz, k.kurz])} alle="Alle Klassen" breite={140} />
            <Wahl label="Status" wert={status} onWert={x => navigieren(ziel(reiter, von, bis, klasse, x))} optionen={Object.entries(STATUS_TEXT).map(([k, [t]]) => [k, t])} alle="Jeder Status" breite={170} />
            <Wahl label="Art" wert={art} onWert={x => navigieren(ziel(reiter, von, bis, klasse, status, grund, x))} optionen={Object.entries(ARTEN)} alle="Alle Arten" breite={170} />
            <Wahl label="Grund" wert={grund} onWert={x => navigieren(ziel(reiter, von, bis, klasse, status, x, art))} optionen={(dd.gruende ?? []).map(x => [x.kurz, x.name])} alle="Alle Gründe" breite={170} />
            <DatumFeld label="Von" wert={von} onWert={v => v && navigieren(ziel(reiter, v))} pflicht />
            <DatumFeld label="Bis" wert={bis} onWert={b => b && navigieren(ziel(reiter, von, b))} pflicht />
          </Paper>
          <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mb: 2 }}>
            {kz('offen', roh.filter(z => z.status === 'offen').length, status === 'offen', () => navigieren(ziel(reiter, von, bis, klasse, status === 'offen' ? '' : 'offen')), 'pruefung')}
            {kz('nicht entschuldigt', roh.filter(z => z.status === 'unentschuldigt').length, status === 'unentschuldigt', () => navigieren(ziel(reiter, von, bis, klasse, status === 'unentschuldigt' ? '' : 'unentschuldigt')), 'entfall')}
            {kz('Verspätungen', roh.filter(z => z.art === 'verspaetet').length, art === 'verspaetet', () => navigieren(ziel(reiter, von, bis, klasse, '', grund, art === 'verspaetet' ? '' : 'verspaetet')), 'pruefung')}
            {kz('vorzeitig gegangen', roh.filter(z => z.art === 'vorzeitig').length, art === 'vorzeitig', () => navigieren(ziel(reiter, von, bis, klasse, '', grund, art === 'vorzeitig' ? '' : 'vorzeitig')), 'termin')}
            {kz('Minuten', roh.filter(z => z.art !== 'fehlt').reduce((n, z) => n + z.minuten, 0), false)}
            <Box sx={{ flex: 1 }} />
            <Button size="small" href={`#/klassenbuch/${encodeURIComponent(klasse || dd.el.klassen[0]?.kurz || '-')}/fehlzeiten/${bis}/${von}`}>Fehlzeiten je Stunde</Button>
          </Stack>
          <Tabelle zeilen={liste} schluessel={z => z.schluessel} auswahl={verwalten ? auswahl : undefined} setAuswahl={setAuswahl} leer="Keine Abwesenheiten im Zeitraum."
            spalten={[
              { id: 'name', kopf: 'Name', sortWert: z => z.schueler, zelle: z => (
                <Stack direction="row" gap={1.25} alignItems="center"><NamensAvatar name={z.schueler} id={z.schuelerId} />
                  <Box><Typography variant="body2" sx={{ fontWeight: 600 }}>{z.schueler}</Typography><Typography variant="caption" color="text.secondary">{z.klasse}{z.lehrer.length ? ` · erfasst von ${z.lehrer.join(', ')}` : ''}</Typography></Box></Stack>) },
              { id: 'zeit', kopf: 'Zeitraum', sortWert: z => z.vonDatum + z.vonZeit, nowrap: true, zelle: z => (
                <Box><Typography variant="body2">{wochentagKurz(z.vonDatum)} {datumKurz(z.vonDatum)} <Box component="span" sx={{ color: 'text.secondary' }}>{z.vonZeit}</Box> – {z.bisDatum !== z.vonDatum ? `${wochentagKurz(z.bisDatum)} ${datumKurz(z.bisDatum)} ` : ''}<Box component="span" sx={{ color: 'text.secondary' }}>{z.bisZeit}</Box></Typography>
                  <Typography variant="caption" color="text.secondary">{z.fehlstunden} {z.fehlstunden === 1 ? 'Fehlstunde' : 'Fehlstunden'} · {z.fehlminuten} min</Typography></Box>) },
              { id: 'art', kopf: 'Art', zelle: z => <ArtChip z={z} /> },
              { id: 'grund', kopf: 'Grund', zelle: z => (z.grund ? <Plakette>{grundName(z.grund)}</Plakette> : ''), sortWert: z => z.grund, verbergenMobil: true },
              { id: 'status', kopf: 'Status', zelle: z => (
                <Box>{z.statusGemischt ? <Tooltip title={`${z.entschuldigt} entschuldigt, ${z.unentschuldigt} nicht entschuldigt, ${z.fehlstunden - z.entschuldigt - z.unentschuldigt} offen`}><span><Plakette ton="pruefung">teilweise</Plakette></span></Tooltip> : <StatusLabel s={z.status} />}
                  {dd.fe?.[z.schluessel]?.mehrdeutig && <Typography variant="caption" color="status.pruefung.main" component="div">(mehrdeutig)</Typography>}
                  {dd.fe?.[z.schluessel]?.lehrerGesamt ? <Button size="small" sx={{ ml: -1 }} onClick={() => setDialog({ art: 'leiste', a: dd.fe![z.schluessel] })}>{dd.fe[z.schluessel].lehrerBearbeitet}/{dd.fe[z.schluessel].lehrerGesamt} Lehrer bearbeitet</Button> : null}</Box>) },
              { id: 'text', kopf: 'Text', verbergenMobil: true, zelle: z => <Box sx={{ maxWidth: 240 }}><Typography variant="body2">{z.text}</Typography><DetailSymbole z={z} /></Box> },
              { id: 'akt', kopf: '', rechts: true, nowrap: true, zelle: z => (z.verwalten || ich.admin ? <>
                <Tooltip title="Bearbeiten"><Button size="small" sx={{ minWidth: 0 }} onClick={() => setDialog({ art: 'bearbeiten', z })} aria-label="Bearbeiten"><EditOutlined fontSize="small" /></Button></Tooltip>
                <Tooltip title="Löschen"><Button size="small" color="error" sx={{ minWidth: 0 }} aria-label="Löschen" onClick={async () => {
                  if (!(await bestaetigen('Abwesenheit löschen', `Abwesenheit von ${z.schueler} am ${datumDe(z.vonDatum)}${z.bisDatum !== z.vonDatum ? ' – ' + datumDe(z.bisDatum) : ''} löschen?`))) return;
                  await senden('/api/app/abwesenheiten/loeschen', { ids: z.ids }); toast('Gelöscht.'); neu();
                }}><DeleteOutlineRounded fontSize="small" /></Button></Tooltip></> : null) },
            ]} />
          {verwalten && liste.length > 0 && (
            <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center" sx={{ mt: 1.5 }}>
              <Typography variant="body2" color="text.secondary">{auswahl.size} ausgewählt:</Typography>
              <Button size="small" variant="outlined" color="success" onClick={() => void statusSetzen('entschuldigt')}>Entschuldigen</Button>
              <Button size="small" variant="outlined" color="error" onClick={() => void statusSetzen('unentschuldigt')}>Nicht entschuldigt</Button>
              <Button size="small" variant="outlined" onClick={() => void statusSetzen('offen')}>Offen</Button>
              <Button size="small" variant="outlined" onClick={async () => {
                const a = gewaehlt();
                if (a.length < 2) { toast('Bitte mindestens zwei Abwesenheiten einer Schülerin bzw. eines Schülers auswählen.', true); return; }
                try { await senden('/api/app/abwesenheiten/zusammenfassen', { ids: a.flatMap(z => z.ids) }); toast('Zusammengefasst.'); neu(); } catch (err) { toast((err as Error).message, true); }
              }}>Zusammenfassen</Button>
              <Box sx={{ flex: 1 }} />
              <Button size="small" href={`#/berichte/abwesenheiten/${encodeURIComponent(klasse || '-')}/${von}/${bis}`}>Berichte</Button>
            </Stack>
          )}
          {dialog?.art === 'neu' && <AbwesenheitFormular z={null} el={dd.el} gruende={dd.gruende ?? []} texte={dd.texte ?? []} klasseVorgabe={klasse || dd.el.klassen.find(k => ich.element && (k.leitung ?? []).includes(ich.element))?.kurz || dd.el.klassen[0]?.kurz || ''} onClose={() => setDialog(null)} fertig={neu} />}
          {dialog?.art === 'bearbeiten' && <AbwesenheitFormular z={dialog.z} el={dd.el} gruende={dd.gruende ?? []} texte={dd.texte ?? []} klasseVorgabe="" onClose={() => setDialog(null)} fertig={neu} />}
          {dialog?.art === 'entschuldigen' && <EntschuldigenDialog ids={dialog.ids} texte={dd.texte ?? []} onClose={() => setDialog(null)} fertig={neu} />}
          {dialog?.art === 'fe' && <AbwesenheitEntschuldigen liste={dialog.liste} status={dialog.status} nachweise={NACHWEISE} onClose={() => setDialog(null)} fertig={neu} />}
          {dialog?.art === 'leiste' && <FehlzeitenLeiste a={dialog.a} grundName={grundName} onClose={() => setDialog(null)} />}
        </>
      )}</Geladen>
    </Seite>
  );
}
