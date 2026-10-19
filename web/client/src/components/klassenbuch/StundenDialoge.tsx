// Fenster über den Stundendetails: Lehrstoff (mit Vorstunden), Abwesenheit (minutengenau, Status), Klassenbucheintrag, Prüfung erstellen
// bzw. editieren (Prüfungsart, Notenschema, Räume mit Belegung, Aufsicht, Teilnehmende).
import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Checkbox, Chip, FormControlLabel, MenuItem, Stack, Table, TableBody, TableCell, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded';
import { holen, senden } from '../../api/client';
import type { Karte, Zeit } from '../../api/types';
import { FormDialog } from '../Bausteine';
import { DatumFeld, ZeitFeld } from '../Auswahl';
import { RaumFeld } from '../RaumListe';
import { bestaetigen, toast } from '../../lib/meldungen';
import { datumDe, heuteIso, hhmm, jetztMinuten, minuten, wochentagKurz, zeitstempel } from '../../lib/datum';
import { kuerzel } from '../plan/logik';
import type { Schueler } from './sitzplan';

export const LEHRFORMEN = ['Einzelarbeit', 'Partnerarbeit', 'Gruppenarbeit', 'Frontalunterricht', 'Unterrichtsgespräch', 'Projektarbeit', 'Stationenlernen', 'Präsentation', 'Diskussion', 'Distanzunterricht'];

export interface Eintrag { thema?: string; hausaufgabe?: string; faellig?: string | null; notiz?: string; notizSchueler?: string; lehrform?: string; anmerkung?: string; geaendert?: string; geaendertVon?: string; lehrer?: string; online?: boolean; onlineLink?: string }
export interface Bereich { von: number; bis: number; beginn: string; ende: string }

function Kopf({ k, zusatz }: { k: Karte; zusatz?: [string, string][] }) {
  const z: [string, string][] = [['Klasse', kuerzel(k.klassen).join(', ')], ['Lehrkraft', kuerzel(k.lehrer).join(', ')], ['Fach', k.fach], ...(zusatz ?? [])];
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.5, p: 1.5, mb: 2, borderRadius: 2, bgcolor: 'action.hover', fontSize: 13 }}>
      {z.filter(x => x[1]).map(([a, b]) => [<Typography key={a} variant="body2" color="text.secondary">{a}</Typography>, <Typography key={a + 'w'} variant="body2" sx={{ fontWeight: 500 }}>{b}</Typography>])}
    </Box>
  );
}

export function LehrstoffDialog({ k, eintrag, bereich, block, einzel, lehrerQs, speichern, onClose }: {
  k: Karte; eintrag: Eintrag | null; bereich: Bereich; block: boolean; einzel: number | null; lehrerQs: string;
  speichern: (a: Partial<Eintrag>) => Promise<Eintrag | null>; onClose: () => void;
}) {
  const [thema, setThema] = useState(eintrag?.thema ?? '');
  const [lehrform, setLehrform] = useState(eintrag?.lehrform ?? '');
  const [anmerkung, setAnmerkung] = useState(eintrag?.anmerkung ?? '');
  const [stand, setStand] = useState(eintrag?.geaendert ? `Geändert am ${zeitstempel(eintrag.geaendert)} von ${eintrag.geaendertVon || eintrag.lehrer || ''}` : '');
  const [vor, setVor] = useState<{ datum: string; stunde: number; thema: string }[]>([]);
  useEffect(() => {
    holen<typeof vor>(`/api/app/klassenbuch/lehrstoff/vorstunden?datum=${k.datum}&stunde=${bereich.von}&unterricht=${k.unterricht}${lehrerQs}`).then(setVor).catch(() => setVor([]));
  }, [k, bereich.von, lehrerQs]);
  const sichern = async (zu: boolean) => {
    const e = await speichern({ thema, lehrform, anmerkung });
    if (!e) return false;
    if (zu) return true;
    setStand(`Geändert am ${zeitstempel(e.geaendert)} von ${e.geaendertVon ?? ''}`);
    return false;
  };
  return (
    <FormDialog offen titel="Lehrstoff" onClose={onClose} aktion={() => sichern(true)} aktionText="Speichern" breite="md"
      links={<Button onClick={() => void sichern(false)}>Übernehmen</Button>}>
      <Kopf k={k} zusatz={[['Datum', `${datumDe(k.datum)} ${bereich.beginn}${bereich.ende ? ' – ' + bereich.ende : ''}${block ? ` (${einzel ? `nur ${einzel}. Stunde` : `ganzer Block ${k.von}.–${k.bis}. Stunde`})` : ''}`]]} />
      <Stack gap={2}>
        <TextField label="Lehrstoff" multiline minRows={4} value={thema} onChange={e => setThema(e.target.value)} autoFocus slotProps={{ htmlInput: { maxLength: 2000 } }} />
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Lehrstoff aus Vorwochen</Typography>
          {vor.length ? (
            <Table size="small"><TableBody>{vor.map((v, i) => (
              <TableRow key={i}>
                <TableCell sx={{ whiteSpace: 'nowrap', width: 110 }}>{wochentagKurz(v.datum)} {datumDe(v.datum)}</TableCell>
                <TableCell sx={{ width: 36 }}>{v.stunde}.</TableCell>
                <TableCell sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.thema}>{v.thema}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  <Button size="small" onClick={() => setThema(v.thema)} title="Lehrstoff übernehmen (ersetzt den Text)">Übernehmen</Button>
                  <Button size="small" onClick={() => setThema(thema.trim() ? `${thema.replace(/\s+$/, '')}\n${v.thema}` : v.thema)} title="Lehrstoff an den Text anhängen">Anhängen</Button>
                </TableCell>
              </TableRow>))}</TableBody></Table>
          ) : <Typography variant="body2" color="text.secondary">Kein Lehrstoff aus Vorwochen</Typography>}
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <TextField select label="Lehrform" value={lehrform} onChange={e => setLehrform(e.target.value)} sx={{ minWidth: 220 }}>
            <MenuItem value="">– keine –</MenuItem>{LEHRFORMEN.map(l => <MenuItem key={l} value={l}>{l}</MenuItem>)}
          </TextField>
          <TextField label="Anmerkung" value={anmerkung} onChange={e => setAnmerkung(e.target.value)} fullWidth slotProps={{ htmlInput: { maxLength: 1000 } }} />
        </Stack>
        {stand && <Typography variant="caption" color="text.secondary">{stand}</Typography>}
      </Stack>
    </FormDialog>
  );
}

export interface Fehlzeit { schuelerId: number; art: string; minuten: number; grund?: string; text?: string; bemerkung?: string; status?: string; vonDatum?: string; vonZeit?: string; bisDatum?: string; bisZeit?: string; erstellt?: string; lehrer?: string; fehlstunden?: number; stunde?: number; datum?: string; beginn?: string; ende?: string }
export interface Anwesenheit {
  schueler: Schueler[]; fehlzeiten: Fehlzeit[]; vorstunden: Fehlzeit[]; weitere: Fehlzeit[]; geprueft: string | null; darf: boolean; verwalten: boolean; beginn?: string; ende?: string;
  einstellungen?: { sortierung?: string; richtung?: string; nachKlasse?: boolean; direkteEingabe?: boolean; faelligeHausaufgaben?: boolean; eintraegeAb?: string; abwesenheitEnde?: string; abwesenheitEndeZeit?: string; grundTextGesperrt?: boolean };
  standardgruende?: { abwesend?: string }; regeln?: { abwesendAbMinuten?: number };
}
export interface Grund { kurz: string; name: string; aktiv?: boolean }

export function AbwesenheitDialog({ k, ids, f, a, gruende, zeiten, bereich, eb, namen, onClose, fertig }: {
  k: Karte; ids: number[]; f: Fehlzeit | null; a: Anwesenheit; gruende: Grund[]; zeiten: Zeit[]; bereich: Bereich; eb: object; namen: string[]; onClose: () => void; fertig: () => void;
}) {
  const verwalten = !!a.verwalten;
  const zeitVon = (nr: number) => zeiten.find(z => z.nr === nr);
  const start = a.beginn || bereich.beginn || zeitVon(bereich.von)?.beginn || '08:00';
  const ende = a.ende || bereich.ende || zeitVon(bereich.bis)?.ende || '08:45';
  const tagesende = zeiten.length ? zeiten[zeiten.length - 1].ende : ende;
  const tagesbeginn = zeiten.length ? zeiten[0].beginn : start;
  const kbe = a.einstellungen ?? {};
  const endeVorgabe = kbe.abwesenheitEnde === 'tag' ? (tagesende > ende ? tagesende : ende) : kbe.abwesenheitEnde === 'zeit' && (kbe.abwesenheitEndeZeit ?? '') > ende ? kbe.abwesenheitEndeZeit! : ende;
  const [vd, setVd] = useState(f?.vonDatum || k.datum);
  const [vz, setVz] = useState(f?.vonZeit || start);
  const [bd, setBd] = useState(f?.bisDatum || k.datum);
  const [bz, setBz] = useState(f?.bisZeit || endeVorgabe);
  const [ganz, setGanz] = useState(!!f && (f.vonZeit ?? '') <= tagesbeginn && (f.bisZeit ?? '') >= tagesende);
  const [grund, setGrund] = useState(f ? f.grund ?? '' : a.standardgruende?.abwesend ?? '');
  const [text, setText] = useState(f?.text ?? '');
  const [status, setStatus] = useState(f?.status || 'offen');
  const grundGesperrt = !!kbe.grundTextGesperrt && !verwalten;
  const jetzt = jetztMinuten();
  const laeuft = k.datum === heuteIso() && jetzt > minuten(start) && jetzt < minuten(ende);
  const vorschau = useMemo(() => {
    if (!vd || !bd || !vz || !bz || `${bd}T${bz}` <= `${vd}T${vz}`) return { ok: false, warn: true, text: 'Das Ende muss nach dem Beginn liegen.' };
    if (ganz) return { ok: true, warn: false, text: `Ganztägig abwesend: alle Unterrichtsstunden ${vd === bd ? 'des Tages' : `vom ${datumDe(vd)} bis ${datumDe(bd)}`} werden als Fehlstunden eingetragen.` };
    const ab = vd === k.datum ? Math.max(minuten(vz), minuten(start)) : minuten(start);
    const bis = bd === k.datum ? Math.min(minuten(bz), minuten(ende)) : minuten(ende);
    const min = Math.max(0, bis - ab);
    let t = min === 0 ? 'In dieser Stunde anwesend.' : ab === minuten(start) && bis === minuten(ende) ? 'Diese Stunde ganz abwesend.'
      : ab === minuten(start) ? `Verspätung: ${min} min (gekommen um ${hhmm(minuten(start) + min)}).` : `Vorzeitig gegangen: ${min} min (ab ${hhmm(ab)}).`;
    const r = a.regeln ?? {};
    const gewertet = min > 0 && min < minuten(ende) - minuten(start) && (r.abwesendAbMinuten ?? 0) > 0 && min >= (r.abwesendAbMinuten ?? 0);
    if (gewertet) t += ' Zählt als Fehlstunde.';
    if (vd !== bd || vd !== k.datum || bz > ende) t += ' Weitere Stunden im Zeitraum werden ebenfalls als Fehlzeiten eingetragen.';
    return { ok: true, warn: gewertet, text: t };
  }, [vd, bd, vz, bz, ganz, k.datum, start, ende, a.regeln]);
  const schnell = (art: string) => {
    setVd(k.datum); setBd(k.datum); setGanz(false);
    const jz = hhmm(jetzt);
    if (art === 'stunde') { setVz(start); setBz(ende); }
    if (art === 'spaet') { setVz(start); setBz(jz); }
    if (art === 'frueh') { setVz(jz); setBz(ende); }
    if (art === 'rest') { if (vz >= ende) setVz(start); setBz(tagesende > ende ? tagesende : ende); }
  };
  const statusAendern = async (s: string) => {
    setStatus(s);
    if (!f || !verwalten) return;
    try {
      await senden('/api/app/klassenbuch/abwesenheit/status', { datum: k.datum, stunde: k.von, unterricht: k.unterricht, schuelerIds: ids, status: s, ...eb });
      toast({ entschuldigt: 'Als entschuldigt markiert.', unentschuldigt: 'Als nicht entschuldigt markiert.', offen: 'Status auf offen gesetzt.' }[s] ?? 'Gespeichert.');
      fertig();
    } catch (err) { toast((err as Error).message, true); }
  };
  const speichern = async () => {
    if (!vorschau.ok) return false;
    await senden('/api/app/klassenbuch/abwesenheit', {
      schuelerIds: ids, von: `${vd}T${ganz ? tagesbeginn : vz}`, bis: `${bd}T${ganz ? tagesende : bz}`, grund, text, status: verwalten ? status : null,
      datum: k.datum, stunde: k.von, unterricht: k.unterricht, ganztaegig: ganz || null, ...eb,
    });
    toast('Abwesenheit gespeichert.');
    fertig();
  };
  const loeschen = async () => {
    await senden('/api/app/klassenbuch/abwesenheit/loeschen', { datum: k.datum, stunde: k.von, unterricht: k.unterricht, schuelerIds: ids, ...eb });
    fertig(); onClose();
  };
  return (
    <FormDialog offen titel="Abwesenheit" onClose={onClose} aktion={speichern} links={f ? <Button color="error" onClick={() => void loeschen()}>Löschen</Button> : undefined}>
      <Stack gap={2}>
        <Typography><Typography component="span" color="text.secondary">Schüler*in: </Typography><b>{namen.length > 3 ? `${namen.slice(0, 3).join(', ')} und ${namen.length - 3} weitere` : namen.join(', ')}</b></Typography>
        <Stack direction="row" gap={1.5} alignItems="center" flexWrap="wrap">
          <DatumFeld label="Von" wert={vd} onWert={d => d && setVd(d)} deaktiviert={!verwalten} pflicht />
          <ZeitFeld label="Uhrzeit" wert={ganz ? tagesbeginn : vz} onWert={v => setVz(v)} deaktiviert={ganz} />
        </Stack>
        <Stack direction="row" gap={1.5} alignItems="center" flexWrap="wrap">
          <DatumFeld label="Bis" wert={bd} onWert={d => d && setBd(d)} deaktiviert={!verwalten} pflicht />
          <ZeitFeld label="Uhrzeit" wert={ganz ? tagesende : bz} onWert={v => setBz(v)} deaktiviert={ganz} />
        </Stack>
        <FormControlLabel control={<Checkbox checked={ganz} onChange={e => setGanz(e.target.checked)} />} label={<>Ganztägig <Typography component="span" variant="caption" color="text.secondary">alle Unterrichtsstunden {verwalten ? 'der gewählten Tage' : 'des Tages'}</Typography></>} />
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Chip label="ganze Stunde" onClick={() => schnell('stunde')} variant="outlined" title={`${start} – ${ende}`} />
          {laeuft && <Chip label="verspätet bis jetzt" onClick={() => schnell('spaet')} variant="outlined" />}
          {laeuft && <Chip label="ab jetzt gegangen" onClick={() => schnell('frueh')} variant="outlined" />}
          <Chip label="Rest des Tages" onClick={() => schnell('rest')} variant="outlined" title={`bis ${tagesende}`} />
        </Stack>
        <Alert severity={vorschau.warn ? 'warning' : 'info'} icon={vorschau.warn ? <WarningAmberRounded /> : <InfoOutlined />}>{vorschau.text}</Alert>
        <TextField select label="Abwesenheitsgrund" value={grund} onChange={e => setGrund(e.target.value)} disabled={grundGesperrt}>
          <MenuItem value="">–</MenuItem>{gruende.map(g => <MenuItem key={g.kurz} value={g.kurz}>{g.name}</MenuItem>)}
        </TextField>
        <TextField label="Text" value={text} onChange={e => setText(e.target.value)} disabled={grundGesperrt} helperText={grundGesperrt ? 'Grund und Text trägt die Klassenleitung ein.' : undefined} slotProps={{ htmlInput: { maxLength: 500 } }} />
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 0.75 }}>Status</Typography>
          <ToggleButtonGroup exclusive value={status} onChange={(_, v) => v && void statusAendern(v)} disabled={!verwalten} size="small">
            <ToggleButton value="entschuldigt">entschuldigt</ToggleButton><ToggleButton value="unentschuldigt">nicht entschuldigt</ToggleButton><ToggleButton value="offen">offen</ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {verwalten ? (f ? 'Wird sofort gespeichert.' : '') : 'Entschuldigen und Zeiträume über den Tag hinaus nur durch die Klassenleitung.'}</Typography>
        </Box>
        {f?.erstellt && <Typography variant="caption" color="text.secondary">Erfasst am {zeitstempel(f.erstellt)} von {f.lehrer}</Typography>}
      </Stack>
    </FormDialog>
  );
}

export interface Vermerk { id: number; datum: string; klasse: string; schuelerId: number | null; art: string; text: string; lehrer: string; erstellt?: string; zeit?: string }

export function EintragDialog({ k, schueler, vorauswahl, arten, zeiten, bereich, onClose, fertig }: {
  k: Karte; schueler: Schueler[]; vorauswahl: number[]; arten: string[]; zeiten: Zeit[]; bereich: Bereich; onClose: () => void; fertig: (neu: Vermerk[]) => void;
}) {
  const kl = kuerzel(k.klassen);
  const zeitWahl = [...new Set([...zeiten.filter(z => z.nr >= bereich.von && z.nr <= bereich.bis).map(z => z.beginn), bereich.beginn].filter(Boolean))].sort();
  const [datum, setDatum] = useState(k.datum);
  const [zeit, setZeit] = useState(zeitWahl[0] ?? '');
  const [ids, setIds] = useState<number[]>(vorauswahl);
  const [klassen, setKlassen] = useState<string[]>([]);
  const [art, setArt] = useState('');
  const [text, setText] = useState('');
  const speichern = async () => {
    if (!art) { toast('Bitte eine Eintragskategorie wählen.', true); return false; }
    if (!text.trim()) { toast('Bitte einen Text eingeben.', true); return false; }
    const neu: Vermerk[] = [];
    if (ids.length) for (const id of ids) neu.push(await senden<Vermerk>('/api/app/klassenbuch/vermerke', { datum, klasse: schueler.find(x => x.id === id)?.klasse || kl[0], schuelerId: id, art, text, zeit }));
    else for (const x of klassen.length ? klassen : kl.slice(0, 1)) neu.push(await senden<Vermerk>('/api/app/klassenbuch/vermerke', { datum, klasse: x, schuelerId: null, art, text, zeit }));
    toast('Klassenbucheintrag gespeichert.');
    fertig(neu);
  };
  return (
    <FormDialog offen titel="Klassenbucheintrag" onClose={onClose} aktion={speichern}>
      <Kopf k={k} />
      <Stack gap={2}>
        <Stack direction="row" gap={1.5}>
          <DatumFeld label="Datum" wert={datum} onWert={d => d && setDatum(d)} pflicht />
          <TextField select label="Zeit" value={zeit} onChange={e => setZeit(e.target.value)} sx={{ width: 120 }}>{zeitWahl.map(z => <MenuItem key={z} value={z}>{z}</MenuItem>)}</TextField>
        </Stack>
        <TextField select label="Schüler*innen" value={ids} onChange={e => setIds(e.target.value as unknown as number[])} slotProps={{ select: { multiple: true, renderValue: v => (v as number[]).map(id => { const s = schueler.find(x => x.id === id); return s ? `${s.name} ${s.vorname}` : ''; }).join(', ') } }}
          helperText="Ohne Auswahl gilt der Eintrag für die Klasse.">
          {schueler.map(s => <MenuItem key={s.id} value={s.id}><Checkbox size="small" checked={ids.includes(s.id)} sx={{ p: 0.5, mr: 1 }} />{s.name} {s.vorname}</MenuItem>)}
        </TextField>
        {!ids.length && kl.length > 1 && (
          <TextField select label="Klasse" value={klassen} onChange={e => setKlassen(e.target.value as unknown as string[])} slotProps={{ select: { multiple: true } }}>
            {kl.map(x => <MenuItem key={x} value={x}>{x}</MenuItem>)}
          </TextField>
        )}
        <TextField select label="Eintragskategorie" value={art} onChange={e => setArt(e.target.value)} required>
          {(arten.length ? arten : ['Vermerk']).map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
        </TextField>
        <TextField label="Klassenbucheintrag" multiline minRows={3} value={text} onChange={e => setText(e.target.value)} slotProps={{ htmlInput: { maxLength: 1000 } }}
          helperText={`Noch mögliche Zeichen: ${1000 - text.length}`} />
      </Stack>
    </FormDialog>
  );
}

interface Pruefungsart { name: string; schema: string }
let artenCache: Promise<{ arten: Pruefungsart[]; schemen: string[] }> | null = null;
const STANDARDARTEN = ['Klassenarbeit', 'Klausur', 'Test', 'Abschlussprüfung', 'Präsentation', 'Referat', 'Vergleichsarbeit'].map(name => ({ name, schema: '' }));
export function pruefungsartenLaden() {
  return artenCache ??= Promise.all([holen<{ arten: { name: string; kurz: string; notenschema: string }[] }>('/api/app/pruefungsarten'), holen<{ schemen: { name: string; aktiv: boolean }[] }>('/api/app/notenschemen')])
    .then(([a, n]) => ({ arten: a.arten?.length ? a.arten.map(x => ({ name: x.name || x.kurz, schema: x.notenschema })) : STANDARDARTEN, schemen: (n.schemen ?? []).filter(x => x.aktiv).map(x => x.name) }))
    .catch(() => { artenCache = null; return { arten: STANDARDARTEN, schemen: [] }; });
}

export function PruefungDialog({ k, schueler, zeiten, onClose, fertig }: { k: Karte; schueler: Schueler[]; zeiten: Zeit[]; onClose: () => void; fertig: () => void }) {
  const [arten, setArten] = useState<{ arten: Pruefungsart[]; schemen: string[] }>({ arten: STANDARDARTEN, schemen: [] });
  useEffect(() => { void pruefungsartenLaden().then(setArten); }, []);
  const [name, setName] = useState(k.fach || '');
  const [text, setText] = useState('');
  const [art, setArt] = useState('');
  const [schema, setSchema] = useState('');
  const [datum, setDatum] = useState<string | null>(k.datum);
  const [von, setVon] = useState(k.von);
  const [bis, setBis] = useState(k.bis);
  const [raeume, setRaeume] = useState(kuerzel(k.raeume));
  const [aufsicht, setAufsicht] = useState(kuerzel(k.lehrer).join(', '));
  const [teil, setTeil] = useState(() => new Set(schueler.map(s => s.id)));
  const ohneSchema = !!arten.arten.find(x => x.name === art && !x.schema);
  const max = Math.max(k.bis + 3, zeiten.length, 10);
  const speichern = async () => {
    if (!datum) { toast('Bitte ein Datum wählen.', true); return false; }
    const teilnehmende = schueler.length && teil.size < schueler.length ? `Teilnehmende: ${schueler.filter(s => teil.has(s.id)).map(s => `${s.vorname} ${s.name}`).join(', ')}` : '';
    const t = [art ? `${art}${text ? ': ' + text : ''}` : text, ohneSchema && schema ? `Notenschema: ${schema}` : '', teilnehmende].filter(Boolean).join(' – ');
    await senden('/api/app/meldungen/klausur', { datum, stundeVon: von, stundeBis: Math.max(von, bis), klassen: kuerzel(k.klassen), raeume, aufsicht: aufsicht.split(/[,;\s]+/).filter(Boolean), titel: name || 'Prüfung', text: t });
    toast('Prüfung erstellt – sie steht jetzt im Stundenplan.');
    fertig();
  };
  const stdWahl = (label: string, w: number, set: (n: number) => void) => (
    <TextField select label={label} value={w} onChange={e => set(Number(e.target.value))} sx={{ width: 110 }}>{Array.from({ length: max }, (_, i) => i + 1).map(x => <MenuItem key={x} value={x}>{x}.</MenuItem>)}</TextField>
  );
  return (
    <FormDialog offen titel="Prüfung erstellen" onClose={onClose} aktion={speichern} breite="md">
      <Kopf k={k} />
      <Stack gap={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <TextField label="Name" value={name} onChange={e => setName(e.target.value)} fullWidth />
          <TextField select label="Prüfungsart" value={art} onChange={e => setArt(e.target.value)} sx={{ minWidth: 220 }}>
            <MenuItem value="">–</MenuItem>{arten.arten.map(a => <MenuItem key={a.name} value={a.name}>{a.name}{a.schema ? ` (${a.schema})` : ''}</MenuItem>)}
          </TextField>
        </Stack>
        {ohneSchema && (
          <TextField select label="Notenschema" value={schema} onChange={e => setSchema(e.target.value)} helperText="Für diese Prüfungsart ist kein Notenschema hinterlegt – bitte ein Notenschema für diese Prüfung wählen.">
            <MenuItem value="">– individuell (im Text beschreiben) –</MenuItem>{arten.schemen.map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
          </TextField>
        )}
        <TextField label="Text" value={text} onChange={e => setText(e.target.value)} />
        <Stack direction="row" gap={1.5} alignItems="center" flexWrap="wrap">
          <DatumFeld label="Datum" wert={datum} onWert={setDatum} min={heuteIso()} pflicht />
          {stdWahl('von Stunde', von, n => { setVon(n); if (bis < n) setBis(n); })}{stdWahl('bis Stunde', bis, setBis)}
        </Stack>
        <RaumFeld wert={raeume} onWert={setRaeume} datum={datum} von={von} bis={bis} unterricht={k.unterricht} />
        <TextField label="Zugewiesene Lehrkraft (Aufsicht)" value={aufsicht} onChange={e => setAufsicht(e.target.value)} />
        <Box>
          <Stack direction="row" alignItems="center" sx={{ mb: 0.75 }}>
            <Typography variant="subtitle2" sx={{ flex: 1 }}>Schüler*innen ({teil.size} von {schueler.length || kuerzel(k.klassen).join(', ')})</Typography>
            {schueler.length > 0 && <><Button size="small" onClick={() => setTeil(new Set(schueler.map(s => s.id)))}>Alle</Button><Button size="small" onClick={() => setTeil(new Set())}>Keine</Button></>}
          </Stack>
          {schueler.length ? (
            <Stack direction="row" gap={0.75} flexWrap="wrap">
              {schueler.map(s => <Chip key={s.id} label={`${s.name} ${s.vorname}`} size="small" color={teil.has(s.id) ? 'primary' : 'default'} variant={teil.has(s.id) ? 'filled' : 'outlined'}
                onClick={() => { const n = new Set(teil); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); setTeil(n); }} />)}
            </Stack>
          ) : <Typography variant="body2" color="text.secondary">Klasse(n) {kuerzel(k.klassen).join(', ')}</Typography>}
        </Box>
      </Stack>
    </FormDialog>
  );
}

const stdText = (v: number, b: number) => (v === b ? `${v}.` : `${v}.–${b}.`);
export const pruefungAlt = (k: Karte) => ({ datum: k.datum, stundeVon: k.von, stundeBis: k.bis, klassen: kuerzel(k.klassen), titel: k.text || null });

export async function pruefungLoeschen(k: Karte): Promise<boolean> {
  if (!(await bestaetigen('Prüfung löschen', `Prüfung${k.text ? ` „${k.text}“` : ''} am ${datumDe(k.datum)} (${stdText(k.von, k.bis)} Stunde) löschen?`))) return false;
  try {
    await senden('/api/app/meldungen/klausur/loeschen', pruefungAlt(k));
    toast('Prüfung gelöscht – EduOrga Studio übernimmt die Löschung beim nächsten Import.');
    return true;
  } catch (err) { toast((err as Error).message, true); return false; }
}

export function PruefungBearbeitenDialog({ k, zeiten, onClose, fertig }: { k: Karte; zeiten: Zeit[]; onClose: () => void; fertig: () => void }) {
  const [titel, setTitel] = useState(k.text || '');
  const [datum, setDatum] = useState<string | null>(k.datum);
  const [von, setVon] = useState(k.von);
  const [bis, setBis] = useState(k.bis);
  const [raeume, setRaeume] = useState(kuerzel(k.raeume.filter(w => w.k)));
  const [aufsicht, setAufsicht] = useState(kuerzel(k.lehrer.filter(w => w.k)).join(', '));
  const speichern = async () => {
    if (!datum) { toast('Bitte ein Datum wählen.', true); return false; }
    const b = Math.max(von, bis);
    await senden('/api/app/meldungen/klausur/verlegen', { alt: pruefungAlt(k), neu: { datum, stundeVon: von, stundeBis: b, klassen: kuerzel(k.klassen), raeume, aufsicht: aufsicht.split(/[,;\s]+/).filter(Boolean), titel: titel.trim() || k.text || 'Prüfung', text: '' } });
    toast(datum !== k.datum || von !== k.von || b !== k.bis ? 'Prüfung verlegt.' : 'Prüfung gespeichert.');
    fertig();
  };
  const wahl = (label: string, w: number, set: (n: number) => void) => (
    <TextField select label={label} value={w} onChange={e => set(Number(e.target.value))} sx={{ width: 150 }}>{zeiten.map(z => <MenuItem key={z.nr} value={z.nr}>{z.nr}. Stunde <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>{z.beginn}–{z.ende}</Typography></MenuItem>)}</TextField>
  );
  return (
    <FormDialog offen titel="Prüfung editieren" untertitel={`${k.text || 'Prüfung'} · bisher ${datumDe(k.datum)}, ${stdText(k.von, k.bis)} Stunde`} onClose={onClose} aktion={speichern}
      links={<Button color="error" onClick={async () => { if (await pruefungLoeschen(k)) { fertig(); onClose(); } }}>Löschen</Button>}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        <TextField label="Name" value={titel} onChange={e => setTitel(e.target.value)} placeholder="Prüfung" slotProps={{ htmlInput: { maxLength: 200 } }} />
        <DatumFeld label="Datum" wert={datum} onWert={setDatum} min={heuteIso()} pflicht />
        <Stack direction="row" gap={1.5}>{wahl('von Stunde', von, n => { setVon(n); if (bis < n) setBis(n); })}{wahl('bis Stunde', bis, setBis)}</Stack>
        <RaumFeld wert={raeume} onWert={setRaeume} datum={datum} von={von} bis={bis} unterricht={k.unterricht} />
        <TextField label="Aufsicht" value={aufsicht} onChange={e => setAufsicht(e.target.value)} />
      </Stack>
    </FormDialog>
  );
}

