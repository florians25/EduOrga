// Buchungsassistent in drei Schritten: Termin (einmalig oder Serie mit Wochentagen, Stunden oder Uhrzeit, Vorschau der Termine) →
// Raum bzw. Ressourcen (Verfügbarkeit über alle Termine, Filter an der Liste, Ersatzraum je belegtem Termin) → Angaben & buchen
// (Titel, Klassen, Lehrkraft, Fach, Bemerkung, Hinweise auf Überschneidungen, Live-Zusammenfassung). Für Raum, Ressource,
// Neue Aktivität und Zusätzliche Stunden eines Unterrichts; Vorbelegung aus Raum- bzw. Ressourcenübersicht über die Adresse.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert, Autocomplete, Box, Button, ButtonBase, Checkbox, Chip, FormControlLabel, MenuItem, Paper, Stack, Step, StepButton, Stepper, Switch, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import CheckRounded from '@mui/icons-material/CheckRounded';
import EventBusyOutlined from '@mui/icons-material/EventBusyOutlined';
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded';
import { holen, senden } from '../../api/client';
import type { Elemente } from '../../api/types';
import { useSitzung } from '../../app/sitzung';
import { Geladen, Leer, Seite } from '../../components/Seite';
import { Plakette } from '../../components/Bausteine';
import { DatumFeld, ZeitFeld } from '../../components/Auswahl';
import { neuerRaumFilter, RaumListe, type RaumStatus } from '../../components/RaumListe';
import { datumDe, heuteIso, istIsoDatum, plusTage, WOCHENTAGE_KURZ } from '../../lib/datum';
import { fehler, toast } from '../../lib/meldungen';
import { link, navigieren } from '../../lib/router';
import { useLaden } from '../../lib/useLaden';
import { ART_NAME, ART_TON, BASIS, ResSymbol, stdText, tagIndex, tagKurz, WIEDERHOLUNG, type Optionen } from './gemeinsam';

export type Art = 'raum' | 'ressource' | 'aktivitaet' | 'unterricht';
const TITEL: Record<Art, string> = { raum: 'Raum buchen', ressource: 'Geräte & Medien buchen', aktivitaet: 'Termin eintragen', unterricht: 'Zusätzliche Stunden' };
export interface EigenerUnterricht { id: number; fach: string; klassen: string[]; lehrer: string; gruppe: string; text: string; wochenstunden: number; gebuchteStunden: number; benutzerId: number }
interface Zeit { wiederholung: string; datum: string; von: string; bis: string; wochentage: number[]; modus: 'stunden' | 'uhrzeit'; stundeVon: number; stundeBis: number; beginn: string; ende: string }
interface TerminRoh { datum: string; stundeVon: number; stundeBis: number }
interface SucheRaum extends RaumStatus { belegt?: never; belegtIdx: number[]; ressourcen?: string[] }
interface SucheRes { id: number; name: string; art?: string; artId?: number; standort?: string; bemerkung?: string; anzahl: number; frei: number; belegt: number[]; verfuegbar: number[]; symbol?: string }
interface Suche { termine: { termin: TerminRoh; freieRaeume: string[] }[]; uebersprungen: string[]; raeume: SucheRaum[]; ressourcen: SucheRes[] }
interface Gebucht { buchungen: { titel: string; datum: string; stundeVon: number; stundeBis: number; raum?: string }[]; hinweise?: string[] }

function zeitText(z: Zeit) {
  const zeit = z.modus === 'uhrzeit' ? `${z.beginn}–${z.ende} Uhr` : stdText(z.stundeVon, z.stundeBis);
  if (z.wiederholung === 'einmalig') return `${tagKurz(z.datum)} · ${zeit}`;
  const w = WIEDERHOLUNG.find(x => x[0] === z.wiederholung)?.[1] ?? '';
  const tage = z.wiederholung === 'taeglich' ? '' : ` ${z.wochentage.slice().sort().map(t => WOCHENTAGE_KURZ[t]).join(', ')}`;
  return `${w}${tage} · ${datumDe(z.von)} – ${datumDe(z.bis)} · ${zeit}`;
}
function zeitDaten(z: Zeit) {
  const d: Record<string, unknown> = { wiederholung: z.wiederholung, wochentage: z.wochentage };
  if (z.wiederholung === 'einmalig') d.datum = z.datum; else { d.von = z.von; d.bis = z.bis; }
  if (z.modus === 'uhrzeit') { d.beginn = z.beginn; d.ende = z.ende; } else { d.stundeVon = z.stundeVon; d.stundeBis = z.stundeBis; }
  return d;
}

export function BuchenKopfAktionen() {
  return <><Button variant="outlined" href="#/buchen/raeume">Raumbelegung</Button><Button variant="outlined" href="#/buchen/meine">Meine Buchungen</Button></>;
}

export function Assistent({ art, rest }: { art: Art; rest: string[] }) {
  const { elemente } = useSitzung();
  const g = useLaden(async sig => {
    const [opt, el] = await Promise.all([holen<Optionen>(`${BASIS}/optionen`, sig), elemente()]);
    const unterricht = art === 'unterricht' ? (await holen<EigenerUnterricht[]>(`${BASIS}/unterricht`, sig)).find(u => String(u.id) === rest[0]) ?? null : null;
    return { opt, el, unterricht };
  }, [art, rest.join('/')]);
  const u = g.daten?.unterricht;
  return (
    <Seite titel={art === 'unterricht' && u ? `Zusätzliche Stunden – ${u.fach} ${u.klassen.join(', ')}` : TITEL[art]} aktionen={<BuchenKopfAktionen />}>
      <Geladen g={g}>{d => (art === 'unterricht' && !d.unterricht ? <Alert severity="warning">Der Unterricht wurde nicht gefunden.</Alert>
        : <Ablauf key={`${art}/${rest.join('/')}`} art={art} rest={rest} opt={d.opt} el={d.el} unterricht={d.unterricht} />)}</Geladen>
    </Seite>
  );
}

function UnterrichtKopf({ u }: { u: EigenerUnterricht }) {
  return (
    <Paper variant="outlined" sx={{ px: 2, py: 1.25, mb: 2, display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
      <b>{u.fach}</b><span>{u.klassen.join(', ') || 'ohne Klasse'}</span><Plakette>{u.lehrer}</Plakette>{u.gruppe && <Typography variant="body2" color="text.secondary">{u.gruppe}</Typography>}
      <Box sx={{ flex: 1 }} /><Plakette>{u.gebuchteStunden} Stunden gebucht</Plakette>
    </Paper>
  );
}

function Karte({ titel, icon, rechts, children }: { titel: string; icon?: ReactNode; rechts?: ReactNode; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, mb: 2 }}>
      <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 2 }}><Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box><Typography variant="h3" sx={{ flex: 1 }}>{titel}</Typography>{rechts}</Stack>
      {children}
    </Paper>
  );
}

function Ablauf({ art, rest, opt, el, unterricht }: { art: Art; rest: string[]; opt: Optionen; el: Elemente; unterricht: EigenerUnterricht | null }) {
  const raster = opt.zeitraster.filter(z => z.nr > 0);
  const heute = heuteIso();
  const [pDatum, pVon, pBis, pZiel] = rest;
  const vorbelegt = (art === 'raum' || art === 'ressource') && istIsoDatum(pDatum);
  const start = vorbelegt ? pDatum : opt.naechsterTag && opt.naechsterTag > heute ? opt.naechsterTag : heute;
  const [z, setZ] = useState<Zeit>({
    wiederholung: 'einmalig', datum: start, von: start, bis: plusTage(start, 56), wochentage: [Math.min(tagIndex(start), 4)], modus: 'stunden',
    stundeVon: Number(pVon) || raster[0]?.nr || 1, stundeBis: Number(pBis) || Number(pVon) || raster[0]?.nr || 1, beginn: '13:30', ende: '14:15',
  });
  const S = art === 'ressource' ? ['Termin', 'Ressourcen', 'Angaben & buchen'] : ['Termin', 'Raum', 'Angaben & buchen'];
  const [schritt, setSchritt] = useState(0);
  const [vorschau, setVorschau] = useState<{ termine: TerminRoh[]; uebersprungen: string[]; beginn?: string; ende?: string } | null>(null);
  const [vorschauFehler, setVorschauFehler] = useState('');
  const [suche, setSuche] = useState<Suche | null>(null);
  const [raum, setRaum] = useState<string | null>(vorbelegt && art === 'raum' ? pZiel || null : null);
  const [raumFilter, setRaumFilter] = useState(neuerRaumFilter(true));
  const [ersatz, setErsatz] = useState<Record<number, string>>({});
  const [resWahl, setResWahl] = useState<Map<number, number>>(new Map());
  const [resArten, setResArten] = useState<Set<string>>(new Set());
  const [resNurFrei, setResNurFrei] = useState(true);
  const [details, setDetails] = useState({ klassen: [] as string[], lehrer: opt.ich ?? '', fach: '', titel: '', text: '', benachrichtigen: false });
  const [hinweise, setHinweise] = useState<string[]>([]);
  const [gespeichert, setGespeichert] = useState<Gebucht | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const zSet = (w: Partial<Zeit>) => { setZ(a => ({ ...a, ...w })); setSuche(null); };

  // Vorschau der Termine (verzögert bei Änderungen)
  const nr = useRef(0);
  useEffect(() => {
    if (schritt !== 0) return;
    const meine = ++nr.current;
    const t = setTimeout(() => {
      senden<typeof vorschau>(`${BASIS}/termine`, zeitDaten(z)).then(v => { if (meine === nr.current) { setVorschau(v); setVorschauFehler(''); } })
        .catch(err => { if (meine === nr.current) { setVorschau(null); setVorschauFehler((err as Error).message); } });
    }, 200);
    return () => clearTimeout(t);
  }, [z, schritt]);

  const suchen = async () => {
    const s = await senden<Suche & { raeume: (RaumStatus & { belegt: number[] })[] }>(`${BASIS}/suche/${art === 'ressource' ? 'ressourcen' : 'raeume'}`, { zeit: zeitDaten(z), kriterien: { maxBelegung: 100 } });
    const n = s.termine.length;
    const raeume = (s.raeume ?? []).map(r => ({ ...r, belegtIdx: r.belegt as unknown as number[], belegt: undefined, frei: (r.belegt as unknown as number[]).length < n })) as unknown as SucheRaum[];
    const neu: Suche = { ...s, raeume, ressourcen: s.ressourcen ?? [], termine: s.termine.map(t => ('termin' in t ? t : { termin: t as unknown as TerminRoh, freieRaeume: [] })) };
    setSuche(neu);
    setErsatz({});
    if (art === 'ressource') setResWahl(m => new Map([...m].filter(([id]) => neu.ressourcen.some(r => r.id === id && r.belegt.length < n))));
    else if (raum) {
      const r = neu.raeume.find(x => x.kurz.toLowerCase() === raum.toLowerCase());
      setRaum(r && r.belegtIdx.length < n ? r.kurz : null);
      if (!(r && r.belegtIdx.length < n) && vorbelegt) toast(`${raum} ist zu dieser Zeit nicht frei.`, true);
    }
    return neu;
  };

  // Vorbelegung aus den Übersichten: gleich zur Raum- bzw. Ressourcenliste
  useEffect(() => {
    if (!vorbelegt) return;
    void (async () => {
      try {
        const s = await suchen();
        if (art === 'ressource' && Number(pZiel)) {
          const r = s.ressourcen.find(x => x.id === Number(pZiel));
          if (r && r.belegt.length < s.termine.length) setResWahl(new Map([[r.id, 1]])); else toast('Die Ressource ist zu dieser Zeit nicht verfügbar.', true);
        }
        if (s.termine.length) setSchritt(1);
      } catch (err) { fehler(err); }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const termineGewaehlt = useMemo(() => {
    const s = suche;
    if (!s) return (vorschau?.termine ?? []).map(t => ({ ...t, raum: null as string | null }));
    if (art === 'ressource') {
      const wahl = [...resWahl.entries()];
      return s.termine.filter((_, i) => wahl.every(([id, menge]) => (s.ressourcen.find(r => r.id === id)?.verfuegbar[i] ?? 0) >= menge))
        .map(t => ({ ...t.termin, raum: null as string | null }));
    }
    const r = s.raeume.find(x => x.kurz.toLowerCase() === raum?.toLowerCase());
    return s.termine.map((t, i) => ({ ...t.termin, raum: !r ? null : r.belegtIdx.includes(i) ? ersatz[i] || null : r.kurz }))
      .filter(t => art !== 'raum' || t.raum);
  }, [suche, resWahl, raum, ersatz, art, vorschau]);

  const weiter = async () => {
    setLaeuft(true);
    try {
      if (schritt === 0) {
        if (!vorschau?.termine.length) throw new Error('Im gewählten Zeitbereich gibt es keinen Unterrichtstag.');
        if (!suche) await suchen();
        setSchritt(1);
      } else if (schritt === 1) {
        if (art === 'raum' && !raum) throw new Error('Bitte einen Raum wählen.');
        if (art === 'ressource' && !resWahl.size) throw new Error('Bitte mindestens eine Ressource wählen.');
        if (!termineGewaehlt.length) throw new Error(art === 'ressource' ? 'Die Auswahl ist an keinem Termin verfügbar.' : 'Es bleibt kein Termin übrig – bitte für belegte Termine einen anderen Raum wählen.');
        setSchritt(2);
      } else {
        const g = await senden<Gebucht>(BASIS, {
          art, termine: termineGewaehlt, ressourcen: [...resWahl.entries()].map(([id, menge]) => ({ id, menge })),
          klassen: unterricht ? [] : details.klassen, lehrer: unterricht ? null : details.lehrer || '', fach: unterricht ? null : details.fach, titel: details.titel, text: details.text,
          benachrichtigen: art === 'aktivitaet' && details.benachrichtigen, unterrichtId: unterricht?.id ?? null,
          beginn: z.modus === 'uhrzeit' ? z.beginn : null, ende: z.modus === 'uhrzeit' ? z.ende : null,
        });
        toast(g.buchungen.length === 1 ? 'Gebucht.' : `${g.buchungen.length} Termine gebucht.`);
        setGespeichert(g);
      }
      window.scrollTo(0, 0);
    } catch (err) { fehler(err); } finally { setLaeuft(false); }
  };

  // Überschneidungen (Lehrkraft, Klassen) im letzten Schritt
  useEffect(() => {
    if (schritt !== 2 || unterricht) { setHinweise([]); return; }
    senden<string[]>(`${BASIS}/hinweise`, { termine: termineGewaehlt, lehrer: details.lehrer || null, klassen: details.klassen }).then(setHinweise).catch(() => setHinweise([]));
  }, [schritt, details.lehrer, details.klassen, termineGewaehlt, unterricht]);

  if (gespeichert) {
    const b = gespeichert.buchungen;
    const raeume = [...new Set(b.map(x => x.raum).filter(Boolean))];
    return (
      <Paper variant="outlined" sx={{ p: 2, maxWidth: 760 }}>
        <Typography variant="h3" component="h2">{b.length === 1 ? 'Die Buchung ist gespeichert.' : `Serie mit ${b.length} Terminen gespeichert.`}</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>{b[0].titel} · {tagKurz(b[0].datum)}{b.length > 1 ? ` – ${tagKurz(b[b.length - 1].datum)}` : ''} · {stdText(b[0].stundeVon, b[0].stundeBis)}{raeume.length ? ` · ${raeume.length > 1 ? 'Räume' : 'Raum'} ${raeume.join(', ')}` : ''}</Typography>
        {!!gespeichert.hinweise?.length && <Alert severity="warning" sx={{ mt: 2 }}>{gespeichert.hinweise.join(' ')}</Alert>}
        <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 2 }}>
          <Button variant="outlined" href="#/buchen/meine">Meine Buchungen</Button>
          {b[0].raum && <Button variant="outlined" href={link('plan', 'raum', b[0].raum, b[0].datum)}>Raumplan</Button>}
          <Button variant="contained" onClick={() => navigieren(art === 'unterricht' ? link('buchen', 'stunden', String(unterricht!.id)) : link('buchen', art === 'raum' ? 'raum' : art), true)}>Weitere Buchung</Button>
        </Stack>
      </Paper>
    );
  }

  const n = suche?.termine.length ?? vorschau?.termine.length ?? 0;
  const zeitLeiste = (
    <ButtonBase onClick={() => setSchritt(0)} sx={{ width: '100%', justifyContent: 'flex-start', gap: 1.5, px: 2, py: 1.25, mb: 2, borderRadius: 1.5, border: 1, borderColor: 'divider', bgcolor: 'background.paper', textAlign: 'left' }}>
      <CalendarMonthOutlined color="primary" /><Typography sx={{ fontWeight: 500 }}>{zeitText(z)}</Typography><Typography variant="body2" color="text.secondary">{n} {n === 1 ? 'Termin' : 'Termine'}</Typography>
      <Box sx={{ flex: 1 }} /><Typography variant="body2" color="primary.main" sx={{ fontWeight: 500 }}>Ändern</Typography>
    </ButtonBase>
  );
  const tage = WOCHENTAGE_KURZ.slice(0, opt.tageProWoche);
  const einmalig = z.wiederholung === 'einmalig';
  const stdWahl = (label: string, wert: number, onWert: (n: number) => void) => (
    <TextField select label={label} value={wert} onChange={e => onWert(Number(e.target.value))} sx={{ width: 170 }}>
      {raster.map(r => <MenuItem key={r.nr} value={r.nr}>{r.nr}. Stunde<Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>{r.beginn}–{r.ende}</Typography></MenuItem>)}
    </TextField>
  );

  let inhalt: ReactNode;
  if (schritt === 0) {
    inhalt = (
      <Karte titel="Wann?" icon={<CalendarMonthOutlined />}>
        <Stack gap={2.5}>
          <ToggleButtonGroup exclusive value={z.wiederholung} onChange={(_, v) => {
            if (!v) return;
            if (einmalig && v !== 'einmalig') zSet({ wiederholung: v, von: z.datum, wochentage: [Math.min(tagIndex(z.datum), opt.tageProWoche - 1)], bis: z.bis <= z.datum ? plusTage(z.datum, 56) : z.bis });
            else if (v === 'einmalig' && !einmalig) zSet({ wiederholung: v, datum: z.von });
            else zSet({ wiederholung: v });
          }} sx={{ flexWrap: 'wrap' }}>{WIEDERHOLUNG.map(([w, t]) => <ToggleButton key={w} value={w}>{t}</ToggleButton>)}</ToggleButtonGroup>
          <Stack direction="row" gap={2} flexWrap="wrap" alignItems="center">
            {einmalig ? <DatumFeld label="Datum" wert={z.datum} onWert={v => v && zSet({ datum: v })} min={heute} pflicht />
              : <><DatumFeld label="Von" wert={z.von} onWert={v => v && zSet({ von: v, bis: z.bis < v ? plusTage(v, 56) : z.bis })} min={heute} pflicht /><DatumFeld label="Bis" wert={z.bis} onWert={v => v && zSet({ bis: v })} min={z.von} pflicht /></>}
            <ToggleButtonGroup exclusive size="small" value={z.modus} onChange={(_, v) => v && zSet({ modus: v })}><ToggleButton value="stunden">Stunden</ToggleButton><ToggleButton value="uhrzeit">Uhrzeit</ToggleButton></ToggleButtonGroup>
            {z.modus === 'stunden' ? <>{stdWahl('Von Stunde', z.stundeVon, v => zSet({ stundeVon: v, stundeBis: Math.max(v, z.stundeBis) }))}{stdWahl('Bis Stunde', z.stundeBis, v => zSet({ stundeBis: Math.max(v, z.stundeVon) }))}</>
              : <><ZeitFeld label="Beginn" wert={z.beginn ?? ''} onWert={v => zSet({ beginn: v })} />
                <ZeitFeld label="Ende" wert={z.ende ?? ''} onWert={v => zSet({ ende: v })} /></>}
          </Stack>
          {!einmalig && z.wiederholung !== 'taeglich' && (
            <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>Wochentage</Typography>
              {tage.map((t, i) => <Chip key={t} label={t} color={z.wochentage.includes(i) ? 'primary' : 'default'} variant={z.wochentage.includes(i) ? 'filled' : 'outlined'}
                onClick={() => zSet({ wochentage: z.wochentage.includes(i) ? z.wochentage.filter(x => x !== i) : [...z.wochentage, i] })} aria-pressed={z.wochentage.includes(i)} />)}</Stack>
          )}
          <Box sx={{ bgcolor: 'action.hover', borderRadius: 1.5, p: 2 }}>
            {vorschauFehler ? <Typography color="error.main">{vorschauFehler}</Typography> : vorschau ? (
              <>
                <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap" sx={{ mb: vorschau.termine.length ? 1.25 : 0 }}>
                  {vorschau.termine.length ? <CheckRounded color="success" fontSize="small" /> : <EventBusyOutlined color="error" fontSize="small" />}
                  <Typography sx={{ fontWeight: 600 }}>{vorschau.termine.length ? `${vorschau.termine.length} ${vorschau.termine.length === 1 ? 'Termin' : 'Termine'}` : 'Kein Unterrichtstag im gewählten Zeitbereich'}</Typography>
                  {vorschau.beginn && vorschau.termine.length > 0 && <Typography variant="body2" color="text.secondary">{vorschau.beginn}–{vorschau.ende} Uhr</Typography>}
                  {vorschau.uebersprungen.length > 0 && <Plakette title={vorschau.uebersprungen.map(tagKurz).join(', ')}>{vorschau.uebersprungen.length} unterrichtsfreie {vorschau.uebersprungen.length === 1 ? 'Tag' : 'Tage'} ausgelassen</Plakette>}
                </Stack>
                <Stack direction="row" gap={0.5} flexWrap="wrap">{vorschau.termine.slice(0, 24).map(t => <Chip key={t.datum} size="small" label={tagKurz(t.datum)} variant="outlined" />)}{vorschau.termine.length > 24 && <Chip size="small" label={`+${vorschau.termine.length - 24}`} />}</Stack>
              </>
            ) : <Typography color="text.secondary">…</Typography>}
          </Box>
        </Stack>
      </Karte>
    );
  } else if (schritt === 1 && suche && art !== 'ressource') {
    const optional = art !== 'raum';
    const r = suche.raeume.find(x => x.kurz.toLowerCase() === raum?.toLowerCase());
    inhalt = (
      <>
        {zeitLeiste}
        {suche.uebersprungen.length > 0 && <Alert severity="info" sx={{ mb: 2 }}>{suche.uebersprungen.length} unterrichtsfreie Tage im Zeitraum werden ausgelassen.</Alert>}
        <Karte titel={optional ? 'Raum (optional)' : 'Raum wählen'} rechts={n > 1 && <Typography variant="body2" color="text.secondary">Verfügbarkeit über alle {n} Termine</Typography>}>
          <RaumListe raeume={suche.raeume} gewaehlt={raum} onWahl={k => { setRaum(k); setErsatz({}); }} filter={raumFilter} setFilter={setRaumFilter}
            nurFreiText={n > 1 ? 'Nur an allen Terminen frei' : 'Nur freie'} waehlbar={x => (x as SucheRaum).belegtIdx.length < n}
            status={x => { const b = (x as SucheRaum).belegtIdx.length; return !b ? { frei: true, text: n > 1 ? `alle ${n} frei` : 'frei' } : b >= n ? { frei: false, text: 'belegt' } : { frei: true, text: `${n - b} von ${n} frei`, titel: `belegt: ${(x as SucheRaum).belegtIdx.map(i => tagKurz(suche.termine[i].termin.datum)).join(', ')}` }; }}
            zusatz={x => { const l = [x.raumart, ...((x as SucheRaum).ressourcen ?? [])].filter(Boolean); return l.length ? <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{l.join(' · ')}</Typography> : null; }}
            ohne={optional ? 'Ohne Raum buchen' : undefined}
            leerText={n > 1 ? 'Kein Raum ist an allen Terminen frei – schalten Sie „Nur an allen Terminen frei“ aus und wählen Sie für belegte Termine einen anderen Raum.' : 'Zu dieser Zeit ist kein passender Raum frei.'} />
        </Karte>
        {r && r.belegtIdx.length > 0 && (
          <Karte titel={`${r.kurz} ist an ${r.belegtIdx.length} ${r.belegtIdx.length === 1 ? 'Termin' : 'Terminen'} belegt`} icon={<WarningAmberRounded />}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Wählen Sie für diese Termine einen anderen freien Raum{optional ? ', buchen Sie ohne Raum' : ''} oder lassen Sie den Termin aus.</Typography>
            <Stack gap={1}>{r.belegtIdx.map(i => { const t = suche.termine[i]; return (
              <Stack key={i} direction="row" gap={2} alignItems="center">
                <Box sx={{ width: 130 }}><Typography sx={{ fontWeight: 600 }}>{tagKurz(t.termin.datum)}</Typography><Typography variant="caption" color="text.secondary">{stdText(t.termin.stundeVon, t.termin.stundeBis)}</Typography></Box>
                <TextField select size="small" value={ersatz[i] ?? ''} onChange={e => setErsatz({ ...ersatz, [i]: e.target.value })} sx={{ minWidth: 220 }}>
                  <MenuItem value="">{optional ? 'Ohne Raum' : 'Termin auslassen'}</MenuItem>
                  {t.freieRaeume.map(x => <MenuItem key={x} value={x}>{x}<Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>{opt.raeume.find(y => y.kurz === x)?.name ?? ''}</Typography></MenuItem>)}
                </TextField>
              </Stack>
            ); })}</Stack>
          </Karte>
        )}
      </>
    );
  } else if (schritt === 1 && suche) {
    const arten = [...new Set(suche.ressourcen.map(r => r.art).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'de'));
    const sichtbar = suche.ressourcen.filter(r => (!resArten.size || resArten.has(r.art ?? '')) && (!resNurFrei || !r.belegt.length || resWahl.has(r.id)));
    const ausgelassen = resWahl.size ? n - termineGewaehlt.length : 0;
    inhalt = (
      <>
        {zeitLeiste}
        <Karte titel="Ressourcen wählen">
          {suche.ressourcen.length > 0 && (
            <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center" sx={{ mb: 2 }}>
              {arten.map(a => <Chip key={a} label={a} color={resArten.has(a) ? 'primary' : 'default'} variant={resArten.has(a) ? 'filled' : 'outlined'} onClick={() => setResArten(s => { const x = new Set(s); if (x.has(a)) x.delete(a); else x.add(a); return x; })} />)}
              <Box sx={{ flex: 1 }} />
              <FormControlLabel control={<Switch size="small" checked={resNurFrei} onChange={e => setResNurFrei(e.target.checked)} />} label={n > 1 ? 'Nur an allen Terminen verfügbar' : 'Nur verfügbare'} />
            </Stack>
          )}
          {sichtbar.length ? <Stack gap={0.75}>{sichtbar.map(r => {
            const an = resWahl.has(r.id);
            const aus = r.belegt.length >= n;
            const maxMenge = Math.max(1, ...r.verfuegbar);
            return (
              <Stack key={r.id} direction="row" gap={1.5} alignItems="center" sx={{ p: 1.25, borderRadius: 1.5, border: 1, borderColor: an ? 'primary.main' : 'divider', bgcolor: an ? 'action.selected' : 'transparent', opacity: aus ? 0.5 : 1, cursor: aus ? 'default' : 'pointer' }}
                onClick={() => !aus && setResWahl(m => { const x = new Map(m); if (x.has(r.id)) x.delete(r.id); else x.set(r.id, 1); return x; })}>
                <Checkbox checked={an} disabled={aus} sx={{ p: 0.5 }} />
                <Box sx={{ width: 36, height: 36, borderRadius: 1.5, display: 'grid', placeItems: 'center', bgcolor: 'action.hover', color: 'primary.main' }}><ResSymbol r={r} /></Box>
                <Box sx={{ flex: 1, minWidth: 0 }}><Typography sx={{ fontWeight: 500 }}>{r.name}</Typography><Typography variant="body2" color="text.secondary" noWrap>{[r.art, r.standort ? `Standort: ${r.standort}` : '', r.bemerkung].filter(Boolean).join(' · ')}</Typography></Box>
                {r.anzahl > 1 && <TextField type="number" size="small" label={`von ${r.anzahl}`} value={resWahl.get(r.id) ?? 1} onClick={e => e.stopPropagation()} sx={{ width: 100 }}
                  onChange={e => { const v = Math.max(1, Math.min(maxMenge, Number(e.target.value) || 1)); setResWahl(m => new Map(m).set(r.id, v)); }} slotProps={{ htmlInput: { min: 1, max: maxMenge } }} />}
                {!r.belegt.length ? <Plakette ton="ok">{r.frei} verfügbar</Plakette> : aus ? <Plakette ton="entfall">ausgebucht</Plakette> : <Plakette ton="pruefung">{n - r.belegt.length} von {n} Terminen</Plakette>}
              </Stack>
            );
          })}</Stack> : (
            <Leer text={opt.ressourcen.some(r => !r.raum) ? 'Keine passende Ressource ist verfügbar.' : 'Es sind noch keine mobilen Ressourcen angelegt.'}
              aktion={suche.ressourcen.length && (resArten.size || resNurFrei) ? { text: 'Alle zeigen', onClick: () => { setResArten(new Set()); setResNurFrei(false); } } : opt.admin ? { text: 'Ressourcen verwalten', onClick: () => navigieren('#/buchen/verwaltung') } : undefined} />
          )}
        </Karte>
        {ausgelassen > 0 && <Alert severity="info" sx={{ mb: 2 }}>{ausgelassen} {ausgelassen === 1 ? 'Termin wird' : 'Termine werden'} ausgelassen, weil die gewählte Menge dort nicht verfügbar ist.</Alert>}
      </>
    );
  } else if (schritt === 1) {
    inhalt = <Typography color="text.secondary">…</Typography>;
  } else {
    const d = details;
    const u = unterricht;
    const aktivitaet = art === 'aktivitaet';
    const raeume = [...new Set(termineGewaehlt.map(t => t.raum).filter(Boolean))];
    const res = [...resWahl.entries()].map(([id, m]) => { const r = suche?.ressourcen.find(x => x.id === id); return `${m > 1 ? `${m}× ` : ''}${r?.name ?? id}`; });
    const zf = (t: string, w: ReactNode) => (w ? <Box sx={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr)', gap: 1.5, py: 0.75, borderTop: 1, borderColor: 'divider' }}><Typography variant="body2" color="text.secondary">{t}</Typography><Box sx={{ fontSize: 14 }}>{w}</Box></Box> : null);
    inhalt = (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: u ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 380px' }, gap: 2, alignItems: 'start' }}>
        {!u && (
          <Karte titel={aktivitaet ? 'Aktivität' : 'Angaben'} rechts={<Typography variant="body2" color="text.secondary">optional</Typography>}>
            <Stack gap={2}>
              <TextField label="Titel / Anlass" value={d.titel} onChange={e => setDetails({ ...d, titel: e.target.value })} placeholder={aktivitaet ? 'z. B. Förderunterricht, Exkursion' : 'z. B. Projektarbeit'} slotProps={{ htmlInput: { maxLength: 200 } }} />
              <Autocomplete multiple options={el.klassen.map(k => k.kurz)} value={d.klassen} onChange={(_, v) => setDetails({ ...d, klassen: v })} renderInput={p => <TextField {...p} label="Klasse(n)" />} disableCloseOnSelect />
              <Stack direction="row" gap={2}>
                <TextField select label="Lehrkraft" value={d.lehrer} onChange={e => setDetails({ ...d, lehrer: e.target.value })} sx={{ flex: 1 }}><MenuItem value="">keine</MenuItem>{el.lehrer.map(l => <MenuItem key={l.kurz} value={l.kurz}>{l.kurz}<Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>{l.name}</Typography></MenuItem>)}</TextField>
                <TextField select label="Fach" value={d.fach} onChange={e => setDetails({ ...d, fach: e.target.value })} sx={{ flex: 1 }}><MenuItem value="">kein Fach</MenuItem>{el.faecher.map(f => <MenuItem key={f.kurz} value={f.kurz}>{f.kurz}<Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>{f.name}</Typography></MenuItem>)}</TextField>
              </Stack>
              <TextField label="Bemerkung (für alle sichtbar)" value={d.text} onChange={e => setDetails({ ...d, text: e.target.value })} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 1000 } }} />
              {aktivitaet && <FormControlLabel control={<Switch checked={d.benachrichtigen} onChange={e => setDetails({ ...d, benachrichtigen: e.target.checked })} />} label="Lehrkraft der Aktivität benachrichtigen (Mitteilung im Posteingang)" />}
            </Stack>
          </Karte>
        )}
        <Paper variant="outlined" sx={{ p: 2.5, position: { lg: 'sticky' }, top: { lg: 16 } }}>
          <Stack direction="row" alignItems="center" sx={{ mb: 1 }}><Typography variant="h3" sx={{ flex: 1 }}>Zusammenfassung</Typography><Plakette ton={ART_TON[art]}>{ART_NAME[art]}</Plakette></Stack>
          {zf('Titel', d.titel || (u ? u.gruppe || 'Zusätzlicher Unterricht' : ART_NAME[art]))}
          {zf('Zeitbereich', zeitText(z))}
          {zf(termineGewaehlt.length === 1 ? 'Termin' : `${termineGewaehlt.length} Termine`, <Stack direction="row" gap={0.5} flexWrap="wrap">{termineGewaehlt.slice(0, 12).map(t => <Chip key={t.datum} size="small" variant="outlined" label={`${tagKurz(t.datum)}${raeume.length > 1 && t.raum ? ` · ${t.raum}` : ''}`} />)}{termineGewaehlt.length > 12 && <Chip size="small" label={`+${termineGewaehlt.length - 12}`} />}</Stack>)}
          {zf(raeume.length > 1 ? 'Räume' : 'Raum', raeume.join(', ') || (art === 'ressource' ? '' : <Typography variant="body2" color="text.secondary">ohne Raum</Typography>))}
          {zf('Ressourcen', res.join(', '))}
          {zf('Klasse(n)', (u ? u.klassen : d.klassen).join(', '))}
          {zf('Lehrkraft', u ? u.lehrer : d.lehrer)}
          {zf('Fach', u ? u.fach : d.fach)}
          {zf('Bemerkung', d.text)}
          {aktivitaet && d.benachrichtigen && d.lehrer && zf('Benachrichtigung', `Mitteilung an ${d.lehrer}`)}
          {hinweise.length > 0 && <Alert severity="warning" sx={{ mt: 1.5 }}><b>Zur gleichen Zeit schon eingeplant</b><Box component="ul" sx={{ m: 0, pl: 2 }}>{hinweise.slice(0, 6).map(x => <li key={x}>{x}</li>)}{hinweise.length > 6 && <li>… und {hinweise.length - 6} weitere</li>}</Box>Die Buchung ist trotzdem möglich.</Alert>}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>Die Buchung erscheint sofort in „Meine Buchungen“ und in den Stundenplänen{art === 'ressource' ? '' : ' und wird an EduOrga Studio übermittelt'}.</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1100 }}>
      <Stepper activeStep={schritt} nonLinear sx={{ mb: 3 }}>
        {S.map((s, i) => <Step key={s} completed={i < schritt}><StepButton onClick={() => i < schritt && setSchritt(i)} disabled={i >= schritt}>{s}</StepButton></Step>)}
      </Stepper>
      {unterricht && <UnterrichtKopf u={unterricht} />}
      {inhalt}
      <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
        {schritt > 0 ? <Button variant="outlined" size="large" startIcon={<ArrowBackRounded />} onClick={() => setSchritt(schritt - 1)}>Zurück</Button> : <span />}
        <Button variant="contained" size="large" disabled={laeuft} endIcon={schritt === 2 ? <CheckRounded /> : <ArrowForwardRounded />} onClick={weiter}>
          {schritt === 0 ? (art === 'ressource' ? 'Ressourcen wählen' : 'Raum wählen') : schritt === 1 ? 'Weiter' : termineGewaehlt.length > 1 ? `${termineGewaehlt.length} Termine buchen` : 'Jetzt buchen'}
        </Button>
      </Stack>
    </Box>
  );
}
