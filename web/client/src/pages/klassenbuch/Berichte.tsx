// Klassenbuch → Berichte: Berichte in Gruppen (Abwesenheiten, Klassenbucheinträge, Arbeitsbericht, Prüfungen, Weitere) mit Suche,
// Parameterdialog (Klasse, Schüler*in, Zeitraum, Schwellenwerte), Vorschau (gegliedert mit Zwischensummen), PDF, CSV, Druck;
// Entschuldigungsschreiben je Schüler*in als Druckseite.
// Adresse: #/berichte/<Bericht|->/<Klasse|->/<von>/<bis>/<Schüler|->/<n1>/<n2>
import { useEffect, useState } from 'react';
import { alpha, Box, Button, ButtonBase, Chip, IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography, useTheme } from '@mui/material';
import PersonOffOutlined from '@mui/icons-material/PersonOffOutlined';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined';
import AssignmentOutlined from '@mui/icons-material/AssignmentOutlined';
import GridViewOutlined from '@mui/icons-material/GridViewOutlined';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined';
import TableViewOutlined from '@mui/icons-material/TableViewOutlined';
import PrintOutlined from '@mui/icons-material/PrintOutlined';
import CloseRounded from '@mui/icons-material/CloseRounded';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import { ApiFehler, holen, speichern } from '../../api/client';
import { useSitzung } from '../../app/sitzung';
import { Fehler, Geladen, Laden, Leer, Seite } from '../../components/Seite';
import { FormDialog, Plakette, SuchFeld, Wahl } from '../../components/Bausteine';
import { DatumFeld } from '../../components/Auswahl';
import { druckenMitAusrichtung, pdfAusrichtung } from '../../lib/pdf';
import { fehler } from '../../lib/meldungen';
import { datumDe, heuteIso, istIsoDatum, plusTage } from '../../lib/datum';
import { navigieren } from '../../lib/router';
import { lesen, schreiben } from '../../lib/speicher';
import { useLaden } from '../../lib/useLaden';
import type { SeitenProps } from '../register';

interface Art { id: string; titel: string; gruppe: string; klasseNoetig?: boolean; parameter?: string }
interface Ergebnis { titel: string; von: string; bis: string; spalten: string[]; zeilen: (string | number | null)[][]; arten?: (string | null)[]; hinweis?: string }
const ALIAS: Record<string, string> = { fehlzeiten: 'fehlzeiten_schueler', lehrstoff: 'arbeitsbericht_tag' };
const GRUPPEN: Record<string, { icon: React.ReactNode; ton: 'entfall' | 'frei' | 'ok' | 'pruefung' | 'termin' }> = {
  Abwesenheiten: { icon: <PersonOffOutlined />, ton: 'entfall' }, Klassenbucheinträge: { icon: <MenuBookOutlined />, ton: 'frei' }, Arbeitsbericht: { icon: <FactCheckOutlined />, ton: 'ok' },
  Prüfungen: { icon: <AssignmentOutlined />, ton: 'pruefung' }, Weitere: { icon: <GridViewOutlined />, ton: 'termin' },
};
const BESCHREIBUNG: Record<string, string> = {
  fehlzeiten_schueler: 'Fehlstunden, Fehltage und Entschuldigungsstatus je Schüler*in im gewählten Zeitraum.', fehlzeiten_klasse: 'Summen der Fehlzeiten je Klasse – geeignet für Konferenzen und Zeugnisse.',
  fehlzeiten_fach: 'Fehlstunden aufgeschlüsselt nach Fächern.', fehltage_klasse: 'Fehltage je Klasse und Schüler*in mit Datum, Stunden und Status, Summen je Schüler*in (mit Schultagen) und je Klasse.',
  verspaetungen: 'Alle Verspätungen und vorzeitigen Abgänge mit Minuten.', verspaetungen_auffaellig: 'Schüler*innen, die im Zeitraum auffällig oft zu spät kamen.',
  abwesenheitsueberschreitung: 'Wer in einem gleitenden Zeitraum mehr Fehlstunden als erlaubt hat.', abwesenheiten: 'Abwesenheiten als Zeiträume mit Grund, Text und Status.',
  anwesenheiten: 'Anwesenheit je Schüler*in über alle erfassten Stunden.', unentschuldigt: 'Zusammenhängende Abwesenheiten ohne Entschuldigung je Schüler*in mit Beginn, Ende, Tagen, Stunden und Grund; Summen je Klasse.',
  statusuebersicht: 'Fehlzeiten gruppiert nach offen, entschuldigt und nicht entschuldigt.', entschuldigungsschreiben: 'Vordruck je Schüler*in mit den offenen Fehlstunden und Unterschriftsfeld.',
  klassenbucheintraege: 'Klassenbucheinträge wie Lob, Vermerke und Ordnungsmaßnahmen je Klasse.', klassenbucheintraege_schueler: 'Klassenbucheinträge je Schüler*in.',
  arbeitsbericht_tag: 'Lehrstoff und Hausaufgaben einer Klasse Tag für Tag.', tagesuebersicht: 'Alle Stunden der Klasse je Tag mit Lehrstoff und Abwesenheiten.',
  wochenuebersicht: 'Wochenweise Übersicht der Stunden und Einträge einer Klasse.', pruefungen: 'Prüfungen und Klassenarbeiten im Zeitraum.',
  befreiungen: 'Befreiungen vom Unterricht mit Fach und Zeitraum.', klassendienste: 'Eingeteilte Klassendienste im Zeitraum.',
};
interface Param { klasse: string; schueler: string; von: string; bis: string; n1: number; n2: number }
const abfrage = (p: Param) => `klasse=${encodeURIComponent(p.klasse)}&von=${p.von}&bis=${p.bis}${p.schueler ? `&schueler=${p.schueler}` : ''}&n1=${p.n1}&n2=${p.n2}`;

async function holeDatei(url: string) {
  const r = await fetch(url, { credentials: 'same-origin', headers: { 'X-UntPlanWeb': '1' } });
  if (!r.ok) throw new ApiFehler(r.status, (await r.json().catch(() => null))?.fehler ?? `Fehler ${r.status}`);
  return r.blob();
}

function GruppenSymbol({ g }: { g: string }) {
  const t = useTheme();
  const x = GRUPPEN[g] ?? GRUPPEN.Weitere;
  const f = t.palette.status[x.ton].main;
  return <Box sx={{ width: 38, height: 38, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: alpha(f, 0.1), color: f, flex: 'none' }}>{x.icon}</Box>;
}

export default function Berichte({ teile }: SeitenProps) {
  const s = useSitzung();
  const [bP, kP, vP, biP, sP, n1P, n2P] = teile;
  const von = istIsoDatum(vP) ? vP : plusTage(heuteIso(), -30);
  const bis = istIsoDatum(biP) ? biP : heuteIso();
  const klasse = kP && kP !== '-' ? kP : '';
  const schueler = sP && sP !== '-' ? sP : '';
  const n1 = Number(n1P) || 0, n2 = Number(n2P) || 0;
  const ziel = (a: string | null, k = klasse, v = von, b = bis, sch = schueler, x1 = n1, x2 = n2) => `#/berichte/${a ?? '-'}/${encodeURIComponent(k || '-')}/${v}/${b}/${sch || '-'}/${x1 || 0}/${x2 || 0}`;
  const [suche, setSuche] = useState('');
  const [gruppe, setGruppeRoh] = useState(() => lesen<string>('untplan:berichtgruppe', 'alle', true));
  const setGruppe = (g: string) => { setGruppeRoh(g); schreiben('untplan:berichtgruppe', g, true); };
  const [panel, setPanel] = useState<Art | null>(null);
  const g = useLaden(async () => {
    const [el, arten, sl] = await Promise.all([s.elemente(), holen<Art[]>('/api/app/berichte/liste'), klasse ? holen<{ id: number; name: string; vorname: string }[]>(`/api/app/klassenbuch/schueler?klasse=${encodeURIComponent(klasse)}`).catch(() => []) : Promise.resolve([])]);
    return { el, arten, sl };
  }, [klasse]);
  const arten = g.daten?.arten ?? [];
  const art = arten.find(a => a.id === (ALIAS[bP] ?? bP))?.id ?? null;
  const vorgabe = (a: Art, n: 1 | 2) => (n === 1 ? (a.id === art && n1 ? n1 : a.id === 'unentschuldigt' ? 1 : 16) : (a.id === art && n2 ? n2 : 4));
  const standard = (a: Art): Param => ({ klasse, schueler, von, bis, n1: vorgabe(a, 1), n2: vorgabe(a, 2) });
  const anzeigen = (a: Art, p: Param) => {
    if (a.klasseNoetig && !p.klasse) { fehler(new Error('Für diesen Bericht bitte eine Klasse wählen.')); return; }
    setPanel(null);
    navigieren(ziel(a.id, p.klasse, p.von, p.bis, p.schueler, a.parameter ? p.n1 : 0, a.parameter ? p.n2 : 0));
  };
  const exportieren = async (a: Art, p: Param, format: 'pdf' | 'csv') => {
    if (a.klasseNoetig && !p.klasse) { fehler(new Error('Für diesen Bericht bitte eine Klasse wählen.')); return; }
    if (a.id === 'entschuldigungsschreiben') {
      setPanel(null);
      if (a.id === art) { void druckenMitAusrichtung('hoch', 'entschuldigungsschreiben'); return; }
      schreiben('untplan:berichtdruck', 1, true);
      navigieren(ziel(a.id, p.klasse, p.von, p.bis, p.schueler, p.n1, p.n2));
      return;
    }
    const ausrichtung = format === 'pdf' ? await pdfAusrichtung('quer', 'bericht') : null;
    if (format === 'pdf' && !ausrichtung) return;
    try { speichern(await holeDatei(`/api/app/berichte/erstellen/${a.id}?${abfrage(p)}&format=${format}${ausrichtung ? `&ausrichtung=${ausrichtung}` : ''}`), `${a.id}-${p.klasse || 'alle'}-${p.von}-${p.bis}.${format}`); }
    catch (err) { fehler(err); }
  };
  const gruppen = [...new Set(arten.map(a => a.gruppe))];
  const q = suche.trim().toLowerCase();
  const sicht = arten.filter(a => (gruppe === 'alle' || a.gruppe === gruppe) && (!q || `${a.titel} ${BESCHREIBUNG[a.id] ?? ''}`.toLowerCase().includes(q)));
  const reihe = (a: Art) => {
    const fehlt = !!a.klasseNoetig && !klasse;
    return (
      <Stack key={a.id} direction="row" alignItems="center" gap={1.5} sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 }, bgcolor: a.id === art ? 'action.selected' : undefined }}>
        <GruppenSymbol g={a.gruppe} />
        <ButtonBase onClick={() => setPanel(a)} sx={{ flex: 1, minWidth: 0, justifyContent: 'flex-start', textAlign: 'left', flexDirection: 'column', alignItems: 'flex-start', borderRadius: 1 }}>
          <Typography sx={{ fontWeight: 600 }}>{a.titel}</Typography>
          <Typography variant="body2" color="text.secondary">{BESCHREIBUNG[a.id] ?? a.gruppe}</Typography>
        </ButtonBase>
        <Stack direction="row" gap={0.5} sx={{ display: { xs: 'none', md: 'flex' } }}>
          {a.klasseNoetig && <Plakette ton={fehlt ? 'warnung' : 'neutral'}>{fehlt ? 'Klasse wählen' : 'je Klasse'}</Plakette>}
          {a.parameter && <Plakette>{a.parameter.replace('{n1}', String(vorgabe(a, 1))).replace('{n2}', String(vorgabe(a, 2)))}</Plakette>}
        </Stack>
        <Stack direction="row" gap={0.5}>
          <Button size="small" startIcon={<VisibilityOutlined />} disabled={fehlt} onClick={() => anzeigen(a, standard(a))}>Anzeigen</Button>
          <IconButton size="small" disabled={fehlt} onClick={() => void exportieren(a, standard(a), 'pdf')} aria-label="Als PDF" title="Als PDF herunterladen"><PictureAsPdfOutlined fontSize="small" /></IconButton>
          <IconButton size="small" disabled={fehlt || a.id === 'entschuldigungsschreiben'} onClick={() => void exportieren(a, standard(a), 'csv')} aria-label="Als CSV" title="Als CSV herunterladen"><TableViewOutlined fontSize="small" /></IconButton>
        </Stack>
      </Stack>
    );
  };
  return (
    <Seite titel="Berichte" untertitel={klasse ? `Klasse ${klasse}` : 'alle Klassen'}
      filter={g.daten && <>
        <SuchFeld wert={suche} onWert={setSuche} platzhalter="Bericht suchen" />
        <Wahl label="Berichtsgruppe" wert={gruppe} onWert={setGruppe} optionen={[['alle', `Alle Berichte (${arten.length})`], ...gruppen.map(x => [x, `${x} (${arten.filter(a => a.gruppe === x).length})`] as [string, string])]} breite={230} />
        <Wahl label="Klasse" wert={klasse} onWert={k => navigieren(ziel(art, k, von, bis, ''))} optionen={g.daten.el.klassen.map(k => [k.kurz, k.kurz])} alle="Alle Klassen" breite={140} />
        <Wahl label="Schüler*in" wert={schueler} onWert={x => navigieren(ziel(art, klasse, von, bis, x))} optionen={g.daten.sl.map(x => [String(x.id), `${x.name} ${x.vorname}`])} alle="Alle" breite={200} deaktiviert={!klasse} />
        <DatumFeld label="Von" wert={von} onWert={v => v && navigieren(ziel(art, klasse, v))} pflicht />
        <DatumFeld label="Bis" wert={bis} onWert={b => b && navigieren(ziel(art, klasse, von, b))} pflicht />
      </>}>
      <Geladen g={g}>{d => (
        <>
          {art && <Vorschau a={arten.find(x => x.id === art)!} p={standard(arten.find(x => x.id === art)!)} schule={s.sitzung.schule.name} zuHref={ziel(null)} exportieren={exportieren} />}
          {!sicht.length ? <Leer text="Kein Bericht gefunden" unter={`Für „${suche}“ gibt es keinen passenden Bericht.`} />
            : gruppe === 'alle' && !q ? gruppen.map(x => (
              <Box key={x} sx={{ mb: 2.5 }} className="nicht-drucken"><Typography variant="overline" color="text.secondary">{x}</Typography>
                <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>{arten.filter(a => a.gruppe === x).map(reihe)}</Paper></Box>))
            : <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }} className="nicht-drucken">{sicht.map(reihe)}</Paper>}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }} className="nicht-drucken"><InfoOutlined sx={{ fontSize: 16, verticalAlign: -3, mr: 0.5 }} />Notfallliste, BAföG- und Fahrkostenbescheinigungen benötigen Adress- bzw. Kontaktdaten, die UntPlan nicht überträgt.</Typography>
          {panel && <ParameterDialog a={panel} p={standard(panel)} el={d.el} onClose={() => setPanel(null)} anzeigen={p => anzeigen(panel, p)} exportieren={(p, f) => void exportieren(panel, p, f)} />}
        </>
      )}</Geladen>
    </Seite>
  );
}

function ParameterDialog({ a, p, el, onClose, anzeigen, exportieren }: { a: Art; p: Param; el: { klassen: { kurz: string }[] }; onClose: () => void; anzeigen: (p: Param) => void; exportieren: (p: Param, f: 'pdf' | 'csv') => void }) {
  const { schuljahr } = useSitzung();
  const [w, setW] = useState<Param>({ ...p, klasse: p.klasse || (a.klasseNoetig ? el.klassen[0]?.kurz ?? '' : '') });
  const [sl, setSl] = useState<{ id: number; name: string; vorname: string }[]>([]);
  useEffect(() => { if (w.klasse) holen<typeof sl>(`/api/app/klassenbuch/schueler?klasse=${encodeURIComponent(w.klasse)}`).then(setSl).catch(() => setSl([])); else setSl([]); }, [w.klasse]);
  const zeit = (z: string) => {
    const heute = heuteIso();
    const m = Number(heute.slice(5, 7));
    const start = z === '30' ? plusTage(heute, -30) : z === 'sj' ? schuljahr.von || plusTage(heute, -180) : m >= 2 && m < 8 ? `${heute.slice(0, 4)}-02-01` : schuljahr.von || plusTage(heute, -180);
    setW({ ...w, von: start, bis: heute });
  };
  const teile = a.parameter ? a.parameter.split(/(\{n1\}|\{n2\})/) : [];
  return (
    <FormDialog offen titel={a.titel} untertitel={a.gruppe} onClose={onClose} aktionText="Anzeigen" aktion={() => { anzeigen(w); return false; }}
      links={<><Button startIcon={<TableViewOutlined />} disabled={a.id === 'entschuldigungsschreiben'} onClick={() => exportieren(w, 'csv')}>CSV</Button><Button startIcon={<PictureAsPdfOutlined />} onClick={() => exportieren(w, 'pdf')}>PDF</Button></>}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        <Typography variant="body2" color="text.secondary">{BESCHREIBUNG[a.id]}</Typography>
        <TextField select label="Klasse" value={w.klasse} onChange={e => setW({ ...w, klasse: e.target.value, schueler: '' })} required={a.klasseNoetig}>
          {!a.klasseNoetig && <MenuItem value="">Alle Klassen</MenuItem>}{el.klassen.map(k => <MenuItem key={k.kurz} value={k.kurz}>{k.kurz}</MenuItem>)}</TextField>
        <TextField select label="Schüler*in" value={w.schueler} onChange={e => setW({ ...w, schueler: e.target.value })} disabled={!w.klasse}><MenuItem value="">Alle</MenuItem>{sl.map(x => <MenuItem key={x.id} value={String(x.id)}>{x.name} {x.vorname}</MenuItem>)}</TextField>
        <Stack direction="row" gap={2}><DatumFeld label="Von" wert={w.von} onWert={v => v && setW({ ...w, von: v })} pflicht /><DatumFeld label="Bis" wert={w.bis} onWert={v => v && setW({ ...w, bis: v })} pflicht /></Stack>
        <Stack direction="row" gap={1}><Chip label="30 Tage" variant="outlined" onClick={() => zeit('30')} /><Chip label="Halbjahr" variant="outlined" onClick={() => zeit('hj')} /><Chip label="Schuljahr" variant="outlined" onClick={() => zeit('sj')} /></Stack>
        {a.parameter && (
          <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><Typography variant="subtitle2" sx={{ mr: 1 }}>Schwellenwert</Typography>
            {teile.map((x, i) => x === '{n1}' ? <TextField key={i} type="number" value={w.n1} onChange={e => setW({ ...w, n1: Number(e.target.value) || 1 })} sx={{ width: 80 }} slotProps={{ htmlInput: { min: 1, 'aria-label': 'Wert 1' } }} />
              : x === '{n2}' ? <TextField key={i} type="number" value={w.n2} onChange={e => setW({ ...w, n2: Number(e.target.value) || 1 })} sx={{ width: 80 }} slotProps={{ htmlInput: { min: 1, 'aria-label': 'Wert 2' } }} />
              : <Typography key={i} variant="body2">{x}</Typography>)}
          </Stack>
        )}
      </Stack>
    </FormDialog>
  );
}

function Vorschau({ a, p, schule, zuHref, exportieren }: { a: Art; p: Param; schule: string; zuHref: string; exportieren: (a: Art, p: Param, f: 'pdf' | 'csv') => Promise<void> }) {
  const g = useLaden(() => holen<Ergebnis>(`/api/app/berichte/erstellen/${a.id}?${abfrage(p)}`), [a.id, abfrage(p)]);
  const brief = a.id === 'entschuldigungsschreiben';
  const druck = () => void druckenMitAusrichtung(brief ? 'hoch' : 'quer', brief ? 'entschuldigungsschreiben' : 'bericht-druck');
  useEffect(() => { if (g.daten && lesen('untplan:berichtdruck', 0, true)) { schreiben('untplan:berichtdruck', 0, true); setTimeout(druck, 300); } });
  if (g.fehler) return <Fehler fehler={g.fehler} />;
  if (!g.daten) return <Laden />;
  const r = g.daten;
  const za = r.arten ?? null;
  const zahl = r.spalten.map((_, i) => r.zeilen.some((z, n) => !za?.[n] && z[i] !== '' && z[i] != null) && r.zeilen.every((z, n) => za?.[n] || z[i] === '' || z[i] == null || typeof z[i] === 'number'));
  const datenzeilen = za ? za.filter(x => !x).length : r.zeilen.length;
  const proSchueler = new Map<string, (string | number | null)[][]>();
  if (brief) r.zeilen.forEach(z => proSchueler.set(String(z[0]), [...(proSchueler.get(String(z[0])) ?? []), z]));
  const kopf = <Typography variant="body2" sx={{ display: 'none', '@media print': { display: 'block', mb: 1 } }}><b>{schule}</b> · {r.titel}{p.klasse ? ` · Klasse ${p.klasse}` : ''} · {datumDe(r.von)} – {datumDe(r.bis)}</Typography>;
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, mb: 3, overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" gap={1.5} sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }} className="nicht-drucken">
        <GruppenSymbol g={a.gruppe} />
        <Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="h4">{r.titel}</Typography><Typography variant="body2" color="text.secondary">{p.klasse ? `Klasse ${p.klasse} · ` : ''}{datumDe(r.von)} – {datumDe(r.bis)} · {brief ? `${proSchueler.size} Schüler*innen` : `${datenzeilen} ${datenzeilen === 1 ? 'Zeile' : 'Zeilen'}`}</Typography></Box>
        {!brief && <><Button size="small" variant="outlined" startIcon={<PictureAsPdfOutlined />} onClick={() => void exportieren(a, p, 'pdf')}>PDF</Button><Button size="small" variant="outlined" startIcon={<TableViewOutlined />} onClick={() => void exportieren(a, p, 'csv')}>CSV</Button></>}
        <Button size="small" variant="outlined" startIcon={<PrintOutlined />} onClick={druck}>Drucken</Button>
        <IconButton href={zuHref} aria-label="Vorschau schließen"><CloseRounded /></IconButton>
      </Stack>
      {r.hinweis && <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1, bgcolor: 'background.default' }}><InfoOutlined sx={{ fontSize: 16, verticalAlign: -3, mr: 0.5 }} />{r.hinweis}</Typography>}
      {brief ? (proSchueler.size ? [...proSchueler].map(([name, zeilen]) => (
        <Box key={name} sx={{ p: 3, borderBottom: 1, borderColor: 'divider', '@media print': { breakAfter: 'page' } }}>
          {kopf}
          <Typography variant="h4" sx={{ mb: 1 }}>Entschuldigung für {name} ({zeilen[0][1]})</Typography>
          <Typography variant="body2" sx={{ mb: 1.5 }}>Hiermit entschuldige ich das Fehlen meines Kindes zu folgenden Zeiten:</Typography>
          <Table size="small"><TableHead><TableRow><TableCell>Datum</TableCell><TableCell>Stunden</TableCell><TableCell>Fächer</TableCell><TableCell>Grund</TableCell></TableRow></TableHead>
            <TableBody>{zeilen.map((z, i) => <TableRow key={i}><TableCell>{z[2]}</TableCell><TableCell>{z[3]}</TableCell><TableCell>{z[4]}</TableCell><TableCell>{z[5]}</TableCell></TableRow>)}</TableBody></Table>
          <Stack direction="row" gap={4} sx={{ pt: 5 }}><Typography variant="body2" sx={{ flex: 1, borderTop: 1, pt: 0.5 }}>Datum</Typography><Typography variant="body2" sx={{ flex: 1, borderTop: 1, pt: 0.5 }}>Unterschrift Erziehungsberechtigte</Typography></Stack>
        </Box>)) : <Leer text="Keine offenen Fehlstunden im Zeitraum." />)
        : !r.zeilen.length ? <Leer text="Keine Daten für diese Auswahl." /> : (
          <Box sx={{ overflowX: 'auto' }}>{kopf}
            <Table size="small">
              <TableHead><TableRow>{r.spalten.map((x, i) => <TableCell key={i} align={za && zahl[i] ? 'right' : 'left'}>{x}</TableCell>)}</TableRow></TableHead>
              <TableBody>{r.zeilen.map((z, n) => za?.[n] === 'gruppe'
                ? <TableRow key={n}><TableCell colSpan={r.spalten.length} sx={{ fontWeight: 600, bgcolor: 'action.hover' }}>{z[0]}</TableCell></TableRow>
                : <TableRow key={n} hover sx={za?.[n] ? { '& td': { fontWeight: 600, bgcolor: za[n] === 'summe' ? 'action.selected' : 'background.default' } } : undefined}>
                  {z.map((x, i) => <TableCell key={i} align={za && zahl[i] ? 'right' : 'left'} sx={{ fontWeight: i === 0 || r.spalten[i] === 'Schüler*in' ? 600 : undefined }}>{x ?? ''}</TableCell>)}</TableRow>)}</TableBody>
            </Table>
          </Box>
        )}
    </Paper>
  );
}
