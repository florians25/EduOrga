// Stundendetails als Seitenleiste rechts: sachlicher weißer Kopf (Fachquadrat und Fach, Plaketten, darunter Angaben als Schlüssel/Wert:
// Datum, Zeit, Klasse, Lehrkraft, Raum mit Links auf die Pläne, Änderungen „alt → neu“), Wahl Block/Einzelstunde. Reiter „Klassenbuch“ (Kollegium: Schülerkacheln mit
// Anwesenheit, Lehrstoff, Abwesende Schüler*innen, Hausaufgaben, Klassenbucheinträge, Klassendienste, Ticket) und „Details“ (online –
// nur Anzeige, festgelegt in UntPlan Studio –, Vertretungstext, Lehrstoff, Hausaufgaben, Notizen, Räume). Fuß: Stand bzw. Blättern,
// Prüfung erstellen/editieren/löschen.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  alpha, Box, Button, ButtonBase, Checkbox, Chip, Divider, Drawer, IconButton, Link, ListItemIcon, Menu, MenuItem, Skeleton, Stack, Tab, Table, TableBody, TableCell,
  TableHead, TableRow, Tabs, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import CloseRounded from '@mui/icons-material/CloseRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import VideocamOutlined from '@mui/icons-material/VideocamOutlined';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRounded from '@mui/icons-material/RadioButtonUncheckedRounded';
import EditOutlined from '@mui/icons-material/EditOutlined';
import AddRounded from '@mui/icons-material/AddRounded';
import MailOutline from '@mui/icons-material/MailOutline';
import PrintOutlined from '@mui/icons-material/PrintOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import AccessTimeRounded from '@mui/icons-material/AccessTimeRounded';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import KeyboardTabRounded from '@mui/icons-material/KeyboardTabRounded';
import SwapHorizRounded from '@mui/icons-material/SwapHorizRounded';
import BadgeOutlined from '@mui/icons-material/BadgeOutlined';
import { holen, senden } from '../../api/client';
import type { Karte, PlanTyp, Wert, Zeit } from '../../api/types';
import { useSitzung } from '../../app/sitzung';
import { datumDe, heuteIso, jetztMinuten, minuten, plusTage, wochentag } from '../../lib/datum';
import { navigieren } from '../../lib/router';
import { toast } from '../../lib/meldungen';
import { Plakette } from '../Bausteine';
import { RaumListe, neuerRaumFilter, type RaumFilter, type RaumStatus } from '../RaumListe';
import { HausaufgabeDetails, HausaufgabeFormular, type Hausaufgabe } from '../klassenbuch/Hausaufgabe';
import {
  AbwesenheitDialog, EintragDialog, LehrstoffDialog, PruefungBearbeitenDialog, PruefungDialog, pruefungLoeschen, pruefungsartenLaden,
  type Anwesenheit, type Bereich, type Eintrag, type Fehlzeit, type Grund, type Vermerk,
} from '../klassenbuch/StundenDialoge';
import {
  EinstellungenPanel, SitzplanAnordnung, SitzplanEditor, darfIrgendwas, kbEinstellungen, kbEinstellungenSpeichern, kontextVon, nameZeilen, schulVorgabeSetzen, sortieren, stundeLaden,
  avatarFarbe, initialenVon, type SitzDaten, type Schueler,
} from '../klassenbuch/sitzplan';
import { PlaketteChip } from './Kachel';
import { FachMarke, fachMarkeEinzug, useDarstellung } from './darstellung';
import LinkRounded from '@mui/icons-material/LinkRounded';
import { istEntfall as entfallVon, KEIN_ELEMENT, kuerzel, sichererLink, statusText, verlegungsText, verlegungsRichtung, istVerlegung, type Typ } from './logik';

interface Einzelstunde { stunde: number; beginn: string; ende: string; eintrag: boolean }
interface StundenAntwort { eintrag: Eintrag | null; darf: boolean; blockEintrag?: Eintrag | null; einzelstunden?: Einzelstunde[]; einzelEintraege?: (Eintrag & { einzelstunde?: number; stunde?: number })[]; online?: boolean; onlineLink?: string }
interface HwListe { liste: Hausaufgabe[]; faellig: Hausaufgabe[]; darf: boolean }
interface Dienst { dienstId: number; dienst: string; von: string; bis: string; klasse: string; text?: string; schueler: string }
interface Daten {
  st: StundenAntwort | null; hw: HwListe; anw: Anwesenheit | null; vermerke: Vermerk[]; arten: string[]; dienste: Dienst[]; gruende: Grund[]; befreit: Set<number>; sitz: SitzDaten | null;
}
const LEER: Daten = { st: null, hw: { liste: [], faellig: [], darf: false }, anw: null, vermerke: [], arten: [], dienste: [], gruende: [], befreit: new Set(), sitz: null };

type Dialog = null | { art: 'lehrstoff' } | { art: 'abw'; ids: number[]; f: Fehlzeit | null } | { art: 'eintrag'; ids: number[] } | { art: 'pruefung' } | { art: 'pruefungEdit' }
  | { art: 'hw'; h: Hausaufgabe; darf: boolean } | { art: 'hwNeu' } | { art: 'einst' } | { art: 'sitz' };

/** Wert im Kopf: geänderter Wert „alt (durchgestrichen) → neu“, Klassen/Lehrkräfte/Räume als Link auf ihren Plan. */
function KopfWerte({ werte, typ, datum, max = 6 }: { werte: Wert[]; typ: PlanTyp | null; datum: string; max?: number }) {
  const l = werte.filter(w => w.k || w.alt);
  const teil = l.length > max + 1 ? l.slice(0, max - 1) : l;
  const link = (kurz: string) => !typ || !kurz || KEIN_ELEMENT.test(kurz) ? <span>{kurz}</span>
    : <Link href={`#/plan/${typ}/${encodeURIComponent(kurz)}/${datum}`} color="inherit" underline="hover" sx={{ fontWeight: 'inherit' }}>{kurz}</Link>;
  return (
    <>
      {teil.map((w, i) => (
        <Box component="span" key={i} sx={{ whiteSpace: 'nowrap' }}>
          {i > 0 && ', '}
          {w.alt && <Box component="s" sx={{ opacity: 0.7 }}>{link(w.alt)}</Box>}
          {w.alt && w.k && <Box component="span" sx={{ mx: 0.5, opacity: 0.8 }}>→</Box>}
          {w.k && <Box component="span" sx={{ fontWeight: w.alt || w.neu ? 600 : 'inherit', textDecoration: w.alt || w.neu ? 'underline' : 'none', textUnderlineOffset: 3 }}>{w.neu && !w.alt ? '+' : ''}{link(w.k)}</Box>}
        </Box>
      ))}
      {teil.length < l.length && <Tooltip title={l.map(w => w.k || w.alt).join(', ')}><span> … +{l.length - teil.length}</span></Tooltip>}
    </>
  );
}

function Abschnitt({ titel, zahl, rechts, children }: { titel: string; zahl?: number | null; rechts?: ReactNode; children: ReactNode }) {
  return (
    <Box component="section" sx={{ py: 2, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.25 }}>
        <Typography variant="h5" component="h3">{titel}</Typography>
        {!!zahl && <Box sx={{ px: 0.75, minWidth: 20, height: 18, borderRadius: '3px', bgcolor: 'action.hover', fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 600, display: 'grid', placeItems: 'center' }}>{zahl}</Box>}
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>{rechts}</Box>
      </Stack>
      {children}
    </Box>
  );
}

const Hinweis = ({ children }: { children: ReactNode }) => <Typography variant="body2" color="text.secondary">{children}</Typography>;

export function Stundendetails({ karte, liste: rohListe, typ, onClose, onGeaendert }: { karte: Karte; liste?: Karte[]; typ: Typ; onClose: () => void; onGeaendert?: () => void }) {
  const t = useTheme();
  const { d: darstellung } = useDarstellung();
  const mobil = useMediaQuery(t.breakpoints.down('sm'));
  const s = useSitzung();
  const { ich } = s;
  const kollegium = !!ich.kollegium;
  const liste = useMemo(() => (rohListe ?? [karte]).filter(x => !x.ereignis).slice().sort((a, b) => a.datum.localeCompare(b.datum) || a.von - b.von), [rohListe, karte]);
  const [k, setK] = useState(karte);
  const [einzel, setEinzel] = useState<number | null>(null);
  const [reiter, setReiter] = useState<'klassenbuch' | 'details' | 'raum'>('details');
  const [d, setD] = useState<Daten | null>(null);
  const [zeiten, setZeiten] = useState<Zeit[]>([]);
  const [geaendert, setGeaendert] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [auswahl, setAuswahl] = useState<Set<number>>(new Set());
  const [abwAuswahl, setAbwAuswahl] = useState<Set<number>>(new Set());
  const [blockMenue, setBlockMenue] = useState<HTMLElement | null>(null);
  const [kbw, setKbw] = useState(kbEinstellungen);
  const [ticket, setTicket] = useState<string | null>(null);
  const [notiz, setNotiz] = useState<Record<string, string | null>>({});
  const [raumModus, setRaumModus] = useState<{ art: 'ersetzen' | 'hinzufuegen'; raum: string | null; gewaehlt: string | null } | null>(null);
  const [raumFilter, setRaumFilter] = useState<RaumFilter>(() => neuerRaumFilter(true));
  const [raeume, setRaeume] = useState<RaumStatus[] | null>(null);
  const [raumMenue, setRaumMenue] = useState<{ el: HTMLElement; raum: string } | null>(null);

  const ptyp = typ ?? null;
  const istEntfall = () => entfallVon(k, ptyp);
  const unterrichtKarte = !!k.unterricht && !['vorgemerkt', 'buchung', 'veranstaltung'].includes(k.status);
  const mitKlassenbuch = kollegium && !!k.unterricht && !['entfall', 'abwesend', 'vorgemerkt', 'buchung', 'veranstaltung'].includes(k.status);
  const darfPruefung = kollegium && kuerzel(k.klassen).length > 0 && k.datum >= heuteIso() && !['entfall', 'abwesend', 'veranstaltung', 'vorgemerkt'].includes(k.status);
  const darfRaum = darfPruefung && !!k.unterricht && (!!d?.st?.darf || ich.admin);
  const istBlock = !!k.unterricht && k.bis > k.von && !['vorgemerkt', 'buchung', 'veranstaltung'].includes(k.status);
  const ep = einzel ? `&einzelstunde=${einzel}` : '';
  const eb = useMemo(() => (einzel ? { einzelstunde: einzel } : {}), [einzel]);
  const kl = kuerzel(k.klassen);
  const einzigeLehrkraft = () => { const l = kuerzel(k.lehrer); return l.length === 1 && !(k.lehrer[0].alt && !k.lehrer[0].k) ? `&lehrer=${encodeURIComponent(l[0])}` : ''; };
  const einzelstunden: Einzelstunde[] = d?.st?.einzelstunden?.length ? d.st.einzelstunden
    : Array.from({ length: k.bis - k.von + 1 }, (_, i) => k.von + i).map(n => { const z = zeiten.find(x => x.nr === n); return { stunde: n, beginn: z?.beginn ?? '', ende: z?.ende ?? '', eintrag: false }; });
  const bereich: Bereich = !einzel ? { von: k.von, bis: k.bis, beginn: k.beginn, ende: k.ende }
    : (() => { const z = einzelstunden.find(x => x.stunde === einzel); return { von: einzel, bis: einzel, beginn: z?.beginn || k.beginn, ende: z?.ende || k.ende }; })();

  const hwLaden = useCallback(() => holen<HwListe>(`/api/app/klassenbuch/hausaufgabenliste?datum=${k.datum}&stunde=${k.von}&bis=${k.bis}&unterricht=${k.unterricht}&fach=${encodeURIComponent(k.fach || '')}&klassen=${encodeURIComponent(kl.join(','))}${ep}`), [k, ep, kl.join(',')]);
  const anwLaden = useCallback(() => holen<Anwesenheit>(`/api/app/klassenbuch/anwesenheit?datum=${k.datum}&stunde=${k.von}&unterricht=${k.unterricht}${ep}`), [k, ep]);

  // Laden
  useEffect(() => {
    let ok = true;
    setD(null);
    (async () => {
      const z = zeiten.length ? zeiten : (await s.elemente().catch(() => null))?.stunden ?? [];
      if (ok && !zeiten.length) setZeiten(z);
      const neu: Daten = { ...LEER, befreit: new Set() };
      if (unterrichtKarte) {
        const [st, hw] = await Promise.all([
          holen<StundenAntwort>(`/api/app/klassenbuch/stunde?datum=${k.datum}&stunde=${k.von}&unterricht=${k.unterricht}${einzigeLehrkraft()}${ep}`).catch(() => null),
          hwLaden().catch(() => null),
        ]);
        neu.st = st;
        if (hw) neu.hw = hw;
        if (kollegium) void pruefungsartenLaden();
        if (mitKlassenbuch) {
          const [anw, verm, dienste, gruende, befreit] = await Promise.all([
            anwLaden().catch(() => null),
            Promise.all(kl.map(x => holen<{ vermerke: Vermerk[]; arten: string[] }>(`/api/app/klassenbuch/vermerke?klasse=${encodeURIComponent(x)}&von=${plusTage(k.datum, -365)}&bis=${k.datum}`).catch(() => null))),
            Promise.all(kl.map(x => holen<{ zuordnungen: Dienst[] }>(`/api/app/klassendienste?klasse=${encodeURIComponent(x)}&von=${k.datum}&bis=${k.datum}`).catch(() => null))),
            holen<Grund[]>('/api/app/abwesenheitsgruende?art=abwesenheit').catch(() => []),
            holen<number[]>(`/api/app/klassenbuch/befreit?datum=${k.datum}&klassen=${encodeURIComponent(kl.join(','))}&fach=${encodeURIComponent(k.fach || '')}&beginn=${encodeURIComponent(k.beginn || '')}`).catch(() => []),
          ]);
          neu.anw = anw;
          const kbe = anw?.einstellungen;
          if (kbe) {
            schulVorgabeSetzen({ sortierung: kbe.sortierung === 'vorname' ? 'vorname' : 'name', richtung: kbe.richtung === 'spalten' ? 'spalten' : 'zeilen', nachKlasse: !!kbe.nachKlasse });
            if (kbe.faelligeHausaufgaben === false) neu.hw = { ...neu.hw, faellig: [] };
          }
          neu.vermerke = verm.filter(Boolean).flatMap(v => v!.vermerke ?? []).filter(v => !kbe?.eintraegeAb || v.datum >= kbe.eintraegeAb).sort((a, b) => b.datum.localeCompare(a.datum) || b.id - a.id);
          neu.arten = verm.find(Boolean)?.arten ?? [];
          neu.dienste = dienste.filter(Boolean).flatMap(x => x!.zuordnungen ?? []);
          neu.gruende = (gruende ?? []).filter(g => g.aktiv !== false);
          neu.befreit = new Set(befreit ?? []);
          neu.sitz = await stundeLaden(kontextVon(k)).catch(() => null);
        }
      }
      if (!ok) return;
      setD(neu);
      setKbw(kbEinstellungen());
      setReiter(r => (r === 'raum' ? 'details' : mitKlassenbuch ? (r === 'details' && geaendert ? r : 'klassenbuch') : 'details'));
    })();
    return () => { ok = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k.datum, k.von, k.unterricht, einzel]);

  const schliessen = () => { onClose(); if (geaendert) onGeaendert?.(); };
  const markieren = () => setGeaendert(true);
  const anwNeu = async () => { const anw = await anwLaden(); setD(x => (x ? { ...x, anw } : x)); markieren(); };
  const hwNeu = async () => { try { const hw = await hwLaden(); setD(x => (x ? { ...x, hw } : x)); markieren(); } catch (err) { toast((err as Error).message, true); } };

  const eintragSpeichern = async (aenderung: Partial<Eintrag>): Promise<Eintrag | null> => {
    const alt = d?.st?.eintrag ?? {};
    const neu = { thema: alt.thema ?? '', hausaufgabe: alt.hausaufgabe ?? '', faellig: alt.faellig ?? null, notiz: alt.notiz ?? '', notizSchueler: alt.notizSchueler ?? '', lehrform: alt.lehrform ?? '', anmerkung: alt.anmerkung ?? '', ...aenderung };
    try {
      const lk = kuerzel(k.lehrer);
      const e = await senden<Eintrag>('/api/app/klassenbuch/stunde', { datum: k.datum, stunde: k.von, unterricht: k.unterricht, ...neu, faellig: neu.faellig || null, lehrer: lk.length === 1 ? lk[0] : null, ...eb }, 'PUT');
      setD(x => x && x.st ? { ...x, st: { ...x.st, eintrag: e, ...(einzel ? { einzelstunden: (x.st.einzelstunden ?? []).map(z => (z.stunde === einzel ? { ...z, eintrag: true } : z)) } : { blockEintrag: e }) } } : x);
      markieren();
      toast('Gespeichert.');
      return e;
    } catch (err) { toast((err as Error).message, true); return null; }
  };

  type Fz = { art: string; minuten?: number; bemerkung?: string; grund?: string; von?: string | null; bis?: string | null };
  const fz = () => new Map<number, Fz>((d?.anw?.fehlzeiten ?? []).map(f => [f.schuelerId, { art: f.art, minuten: f.minuten, bemerkung: f.text ?? f.bemerkung, grund: f.grund, von: f.beginn || null, bis: f.ende || null }]));
  const anwesenheitSpeichern = async (m: Map<number, Fz>) => {
    const eintraege = [...m].map(([schuelerId, f]) => ({ schuelerId, art: f.art, minuten: f.minuten || 5, bemerkung: f.bemerkung ?? '', grund: f.grund ?? '', restTag: null, von: f.von ?? null, bis: f.bis ?? null }));
    try { await senden('/api/app/klassenbuch/anwesenheit', { datum: k.datum, stunde: k.von, unterricht: k.unterricht, eintraege, ...eb }, 'PUT'); await anwNeu(); } catch (err) { toast((err as Error).message, true); }
  };
  const abwesenheitEntfernen = async (ids: number[]) => {
    try { await senden('/api/app/klassenbuch/abwesenheit/loeschen', { datum: k.datum, stunde: k.von, unterricht: k.unterricht, schuelerIds: ids, ...eb }); await anwNeu(); } catch (err) { toast((err as Error).message, true); }
  };
  const verlaengern = async (ids: number[], bis: 'stunde' | 'tagesbeginn') => {
    try {
      await senden('/api/app/klassenbuch/abwesenheit/verlaengern', { datum: k.datum, stunde: k.von, unterricht: k.unterricht, schuelerIds: ids, bis, ...eb });
      await anwNeu(); setAbwAuswahl(new Set());
      toast(bis === 'tagesbeginn' ? 'Abwesenheit auf Tagesbeginn verlängert.' : 'Abwesenheit bis Stundenende verlängert.');
    } catch (err) { toast((err as Error).message, true); }
  };

  const blaettern = (n: number) => {
    const x = liste[liste.findIndex(y => y.datum === k.datum && y.von === k.von && y.unterricht === k.unterricht && y.fach === k.fach) + n];
    if (!x) return;
    setEinzel(null); setAuswahl(new Set()); setAbwAuswahl(new Set()); setTicket(null); setNotiz({});
    setK(x);
  };
  const posInListe = liste.findIndex(y => y.datum === k.datum && y.von === k.von && y.unterricht === k.unterricht && y.fach === k.fach);

  // Raum ersetzen, entfernen, hinzufügen (Raumbuchung)
  const raeumeNach = (bisher: Wert[], neu: string[]): Wert[] => {
    const entfernt = bisher.filter(w => w.k && !neu.includes(w.k)).map(w => w.alt || w.k);
    let j = 0;
    const res: Wert[] = neu.map(x => bisher.find(w => w.k === x) ?? (() => { const a = entfernt[j++] ?? null; return a === x ? { k: x } : { k: x, alt: a, neu: true }; })());
    for (; j < entfernt.length; j++) res.push({ k: '', alt: entfernt[j], neu: true });
    return res;
  };
  const raumAendern = async (neu: string[], meldung: string) => {
    try {
      await senden('/api/app/meldungen/raumaenderung', { datum: k.datum, stundeVon: k.von, stundeBis: k.bis, unterricht: k.unterricht, raeume: neu });
      setK({ ...k, raeume: raeumeNach(k.raeume, neu), status: k.status === 'regulaer' ? 'geaendert' : k.status });
      markieren(); toast(meldung); setReiter('details'); setRaumModus(null);
    } catch (err) { toast((err as Error).message, true); }
  };
  useEffect(() => {
    if (reiter !== 'raum') return;
    setRaeume(null);
    holen<RaumStatus[]>(`/api/app/buchen/raumstatus?datum=${k.datum}&von=${k.von}&bis=${k.bis}${k.unterricht ? `&unterricht=${k.unterricht}` : ''}`)
      .then(r => { const akt = kuerzel(k.raeume.filter(w => w.k)); setRaeume(r.filter(x => (x.buchbar || x.eigen) && !akt.includes(x.kurz))); })
      .catch(err => { toast((err as Error).message, true); setRaeume([]); });
  }, [reiter, k]);

  // ---------------------------------------------------------------- Kopf
  const entfall = istEntfall();
  const alleKlassen = [...k.klassen, ...(k.mitklassen || [])];
  const linkTyp = (x: PlanTyp) => (kollegium || (x !== 'lehrer' && (x !== 'klasse' || !!ich.element)) ? x : null);
  const fachTeil = k.fachAlt && !entfall ? <><Box component="s" sx={{ opacity: 0.7 }}>{k.fachAlt}</Box> → {k.fach}</> : k.status === 'veranstaltung' ? k.fach || k.text || 'Termin' : k.fach || k.text || k.art || 'Stunde';
  const zeitText = bereich.beginn ? `${bereich.beginn}–${bereich.ende}` : `${bereich.von === bereich.bis ? bereich.von + '.' : `${bereich.von}.–${bereich.bis}.`} Std.`;
  const plaketten: { text: string; ton: 'entfall' | 'aenderung' | 'pruefung' | 'termin' | 'neutral'; hinweis?: string }[] = [];
  if (entfall) plaketten.push({ text: 'Entfall', ton: 'entfall' });
  if (istVerlegung(k) && k.status !== 'klausur') plaketten.push({ text: verlegungsRichtung(k, ptyp) === 'von' ? 'Verlegt' : 'Verlegung', ton: 'aenderung', hinweis: verlegungsText(k, verlegungsRichtung(k, ptyp)) });
  if (k.status === 'klausur') plaketten.push({ text: 'Prüfung', ton: 'pruefung' });
  if (k.status === 'veranstaltung') plaketten.push({ text: 'Termin', ton: 'termin' });
  if (k.zusaetzlich) plaketten.push({ text: 'Zusätzl. Unterrichtsstunde', ton: 'aenderung' });
  if (!entfall && ['geaendert', 'offen'].includes(k.status) && !k.zusaetzlich && !istVerlegung(k)) plaketten.push({ text: statusText(k), ton: 'aenderung' });
  if (k.status === 'buchung' || k.status === 'vorgemerkt') plaketten.push({ text: statusText(k), ton: 'neutral' });
  if ((k.abwesendeKlassen || []).length && !entfall) plaketten.push({ text: `${k.abwesendeKlassen.join(', ')} ${k.abwesendText || 'abwesend'}`, ton: 'neutral' });
  const online = einzel && d?.st?.blockEintrag?.online ? true : (d?.st?.eintrag?.online ?? d?.st?.online ?? (!einzel && k.online)) && !entfall;
  const onlineLink = (d?.st?.eintrag?.onlineLink || d?.st?.onlineLink || (!einzel ? k.onlineLink : '') || (einzel ? d?.st?.blockEintrag?.onlineLink : '')) ?? '';

  const kv = (titel: string, inhalt: ReactNode) => (
    <>
      <Typography component="dt" sx={{ fontSize: 12, color: 'text.secondary', lineHeight: '20px' }}>{titel}</Typography>
      <Typography component="dd" sx={{ m: 0, fontSize: 13.5, lineHeight: '20px', minWidth: 0, fontVariantNumeric: 'tabular-nums' }}>{inhalt}</Typography>
    </>
  );
  const kopf = (
    <Box sx={{ position: 'relative', px: 2.5, pt: 2, pb: 1.75, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
      <Stack direction="row" alignItems="flex-start" gap={1}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" alignItems="center" gap={1.25} sx={{ minWidth: 0 }}>
            {k.fach && <FachMarke farbe={k.farbe} groesse={10} />}
            <Typography variant="h2" component="h2" sx={{ fontSize: 20, lineHeight: 1.3, fontWeight: 600, color: entfall ? 'status.entfall.main' : 'text.primary', textDecoration: entfall ? 'line-through' : 'none', textDecorationThickness: 1, minWidth: 0 }}>
              {fachTeil}
              {k.gruppe && <Box component="span" sx={{ ml: 1, fontWeight: 400, color: 'text.secondary' }}>{k.gruppe}</Box>}
            </Typography>
          </Stack>
          {k.fachName && k.fachName !== k.fach && <Typography variant="body2" color="text.secondary" sx={{ pl: k.fach ? `${fachMarkeEinzug(darstellung, 10, 10)}px` : 0 }}>{k.fachName}</Typography>}
          {(plaketten.length > 0 || online || einzel) && (
            <Stack direction="row" columnGap={1.5} rowGap={0.5} flexWrap="wrap" alignItems="center" sx={{ mt: 0.75, pl: k.fach ? `${fachMarkeEinzug(darstellung, 10, 10)}px` : 0 }}>
              {plaketten.map((p, i) => <PlaketteChip key={i} p={{ text: p.text, ton: p.ton, hinweis: p.hinweis }} />)}
              {online && <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, color: 'primary.main', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}><LinkRounded sx={{ fontSize: 13 }} />Online</Box>}
              {einzel && <PlaketteChip p={{ text: `${einzel}. Stunde`, ton: 'neutral' }} />}
            </Stack>
          )}
          <Box component="dl" sx={{ m: 0, mt: 1.5, display: 'grid', gridTemplateColumns: '84px minmax(0, 1fr)', columnGap: 1.5, rowGap: 0.25 }}>
            {kv('Datum', `${wochentag(k.datum)}, ${datumDe(k.datum)}`)}
            {kv('Zeit', zeitText)}
            {alleKlassen.length > 0 && kv(alleKlassen.length > 1 ? 'Klassen' : 'Klasse', <KopfWerte werte={alleKlassen} typ={linkTyp('klasse')} datum={k.datum} />)}
            {k.lehrer.length > 0 && kv(k.lehrer.length > 1 ? 'Lehrkräfte' : 'Lehrkraft', <KopfWerte werte={k.lehrer} typ={linkTyp('lehrer')} datum={k.datum} />)}
            {online ? kv('Raum', 'Online-Unterricht') : k.raeume.length > 0 && kv(k.raeume.length > 1 ? 'Räume' : 'Raum', <KopfWerte werte={k.raeume} typ="raum" datum={k.datum} />)}
          </Box>
        </Box>
        <Stack direction="row" className="nicht-drucken" sx={{ mt: -0.5, mr: -1 }}>
          {istBlock && reiter !== 'raum' && (
            <Tooltip title="Ganzer Block oder Einzelstunde"><IconButton size="small" onClick={e => setBlockMenue(e.currentTarget)} aria-label="Ganzer Block oder Einzelstunde" aria-haspopup="menu"><ExpandMoreRounded fontSize="small" /></IconButton></Tooltip>
          )}
          <Tooltip title="Schließen (Esc)"><IconButton size="small" onClick={schliessen} aria-label="Schließen"><CloseRounded fontSize="small" /></IconButton></Tooltip>
        </Stack>
      </Stack>
      <Menu anchorEl={blockMenue} open={!!blockMenue} onClose={() => setBlockMenue(null)}>
        {[{ stunde: 0, beginn: '', ende: '', eintrag: false }, ...einzelstunden].map(z => (
          <MenuItem key={z.stunde} selected={(einzel ?? 0) === z.stunde} onClick={() => { setBlockMenue(null); if ((einzel ?? 0) !== z.stunde) { setEinzel(z.stunde || null); setAuswahl(new Set()); setAbwAuswahl(new Set()); } }}>
            <ListItemIcon>{(einzel ?? 0) === z.stunde ? <CheckRounded fontSize="small" /> : null}</ListItemIcon>
            {z.stunde === 0 ? `Ganzer Block (${k.von}.–${k.bis}. Stunde)` : `${z.stunde}. Stunde${z.beginn ? ` ${z.beginn}–${z.ende}` : ''}`}
            {z.eintrag && <Box sx={{ ml: 1, width: 7, height: 7, borderRadius: 4, bgcolor: 'primary.main' }} title="Eigene Einträge vorhanden" />}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );

  // ---------------------------------------------------------------- Inhalte
  const ebenenHinweis = (feld: 'thema' | 'notizSchueler' | 'notiz') => {
    if (einzel) { const w = d?.st?.blockEintrag?.[feld]; return w ? <Typography variant="body2" sx={{ mt: 0.5 }}><Plakette ton="neutral" sx={{ mr: 1 }}>Ganzer Block</Plakette>{w}</Typography> : null; }
    return (d?.st?.einzelEintraege ?? []).filter(x => x[feld]).map((x, i) => <Typography key={i} variant="body2" sx={{ mt: 0.5 }}><Plakette ton="neutral" sx={{ mr: 1 }}>{x.einzelstunde ?? x.stunde}. Stunde</Plakette>{x[feld]}</Typography>);
  };
  const hwZeile = (h: Hausaufgabe, darf: boolean) => (
    <ButtonBase key={h.id} onClick={() => setDialog({ art: 'hw', h, darf })} sx={{ width: '100%', textAlign: 'left', justifyContent: 'flex-start', gap: 1.5, p: 1.25, mb: 0.75, borderRadius: 2, border: 1, borderColor: 'divider', '&:hover': { bgcolor: 'action.hover' } }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {h.faellig && <Typography variant="caption" sx={{ color: h.faellig < heuteIso() && !h.erledigt ? 'status.entfall.main' : 'text.secondary', fontWeight: 600 }}>bis {datumDe(h.faellig)}</Typography>}
        <Typography variant="body2" sx={{ textDecoration: h.erledigt ? 'line-through' : 'none' }}>{h.text}</Typography>
        {h.bemerkung && <Typography variant="caption" color="text.secondary">{h.bemerkung}</Typography>}
      </Box>
      {h.erledigt && <CheckCircleRounded sx={{ color: 'status.ok.main', fontSize: 18 }} />}
      <ChevronRightRounded sx={{ color: 'text.disabled' }} />
    </ButtonBase>
  );
  const notizFeld = (feld: 'notizSchueler' | 'notiz', titel: string, wert: string) => {
    const darf = !!d?.st?.darf;
    const entwurf = notiz[feld];
    if (!darf) return wert || ebenenHinweis(feld) ? <Abschnitt titel={titel}><Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{wert}</Typography>{ebenenHinweis(feld)}</Abschnitt> : null;
    return (
      <Abschnitt titel={titel}>
        {ebenenHinweis(feld)}
        <TextField multiline minRows={2} fullWidth value={entwurf ?? wert} onChange={e => setNotiz({ ...notiz, [feld]: e.target.value })} placeholder={einzel ? `Nur für die ${einzel}. Stunde` : 'Notiz hinzufügen …'} sx={{ mt: 0.5 }} />
        {entwurf !== undefined && entwurf !== null && entwurf !== wert && (
          <Stack direction="row" gap={1} justifyContent="flex-end" sx={{ mt: 1 }}>
            <Button size="small" onClick={() => setNotiz({ ...notiz, [feld]: null })}>Abbrechen</Button>
            <Button size="small" variant="contained" onClick={async () => {
              if (await eintragSpeichern({ [feld]: entwurf })) { if (!einzel) setK({ ...k, [feld === 'notiz' ? 'notizLehrer' : 'notizSchueler']: entwurf }); setNotiz({ ...notiz, [feld]: null }); }
            }}>Speichern</Button>
          </Stack>
        )}
      </Abschnitt>
    );
  };

  const details = () => {
    if (!d) return null;
    const ein = d.st?.eintrag;
    const teile: ReactNode[] = [];
    if (unterrichtKarte && online) teile.push(
      <Abschnitt key="online" titel="Findet online statt" rechts={einzel && d.st?.blockEintrag?.online ? <Plakette ton="neutral">Ganzer Block</Plakette> : null}>
        {sichererLink(onlineLink) ? (
          <Button variant="contained" startIcon={<VideocamOutlined />} href={onlineLink} target="_blank" rel="noopener noreferrer">Online-Unterricht beitreten</Button>
        ) : <Hinweis>Es wurde noch kein Link zum Online-Unterricht hinterlegt.</Hinweis>}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Online-Unterricht und Link legt die Schulleitung in UntPlan Studio fest.</Typography>
      </Abschnitt>,
    );
    if (darfRaum) {
      const r = kuerzel(k.raeume.filter(w => w.k));
      teile.push(
        <Abschnitt key="raum" titel="Räume">
          <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
            {r.map(x => <Chip key={x} label={x} onClick={e => setRaumMenue({ el: e.currentTarget, raum: x })} onDelete={e => setRaumMenue({ el: (e.currentTarget as HTMLElement).parentElement!, raum: x })} deleteIcon={<ExpandMoreRounded />} variant="outlined" />)}
            <Tooltip title="Raum hinzufügen"><IconButton size="small" onClick={() => { setRaumModus({ art: 'hinzufuegen', raum: null, gewaehlt: null }); setReiter('raum'); }} aria-label="Raum hinzufügen" sx={{ border: 1, borderColor: 'divider' }}><AddRounded fontSize="small" /></IconButton></Tooltip>
          </Stack>
          <Menu anchorEl={raumMenue?.el} open={!!raumMenue} onClose={() => setRaumMenue(null)}>
            <MenuItem onClick={() => { setRaumModus({ art: 'ersetzen', raum: raumMenue!.raum, gewaehlt: null }); setReiter('raum'); setRaumMenue(null); }}><ListItemIcon><SwapHorizRounded fontSize="small" /></ListItemIcon>Ersetzen</MenuItem>
            <MenuItem onClick={() => { const x = raumMenue!.raum; setRaumMenue(null); void raumAendern(kuerzel(k.raeume.filter(w => w.k)).filter(y => y !== x), `Raum ${x} entfernt.`); }}><ListItemIcon><CloseRounded fontSize="small" /></ListItemIcon>Löschen</MenuItem>
          </Menu>
        </Abschnitt>,
      );
    }
    const vertretung = k.text && (k.fach || k.status !== 'veranstaltung') ? k.text : '';
    if (vertretung && k.status !== 'klausur') teile.push(<Abschnitt key="vt" titel={k.fach ? 'Vertretungstext' : 'Bezeichnung'}><Typography variant="body2">{vertretung}</Typography></Abschnitt>);
    if (k.status === 'veranstaltung' && !k.fach && (k.text || k.art)) teile.push(
      <Abschnitt key="info" titel="Information zur Stunde"><Typography variant="body2">{k.text || k.art}</Typography>
        {k.lehrer.length > 3 && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Lehrkräfte: {kuerzel(k.lehrer).join(', ')}</Typography>}</Abschnitt>,
    );
    if (k.status === 'klausur') teile.push(<Abschnitt key="pr" titel="Prüfung"><Typography variant="body2">{[k.art, k.text].filter(Boolean).join(' – ')}</Typography></Abschnitt>);
    if (istVerlegung(k) && k.verlegungVon && k.verlegungNach) teile.push(
      <Abschnitt key="vl" titel="Verlegung"><Typography variant="body2">{verlegungsText(k, verlegungsRichtung(k, ptyp))}</Typography></Abschnitt>,
    );
    const hinweis = ebenenHinweis('thema');
    if (ein?.thema || (Array.isArray(hinweis) ? hinweis.length : hinweis)) teile.push(<Abschnitt key="ls" titel="Lehrstoff">{ein?.thema && <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{ein.thema}</Typography>}{hinweis}</Abschnitt>);
    if (d.hw.faellig.length) teile.push(<Abschnitt key="hf" titel="Fällige Hausaufgaben">{d.hw.faellig.map(h => hwZeile(h, false))}</Abschnitt>);
    if (d.hw.liste.length) teile.push(<Abschnitt key="hw" titel="Hausaufgaben">{d.hw.liste.map(h => hwZeile(h, d.hw.darf))}</Abschnitt>);
    if (unterrichtKarte) {
      const ersatz = einzel || (d.st?.einzelEintraege?.length ?? 0) > 0;
      teile.push(<Box key="ns">{notizFeld('notizSchueler', 'Notizen für Schüler*innen', ein ? ein.notizSchueler ?? '' : ersatz ? '' : k.notizSchueler)}</Box>);
      if (kollegium) teile.push(<Box key="nl">{notizFeld('notiz', 'Notizen für Lehrkräfte', ein ? ein.notiz ?? '' : ersatz ? '' : k.notizLehrer)}</Box>);
    }
    return teile.filter(Boolean).length ? teile : (
      <Box sx={{ py: 6, textAlign: 'center' }}><Typography sx={{ fontWeight: 600 }}>Keine weiteren Details</Typography><Hinweis>Zu dieser Stunde gibt es keine zusätzlichen Informationen.</Hinweis></Box>
    );
  };

  const klassenbuch = () => {
    if (!d) return null;
    const a = d.anw;
    const darf = !!a?.darf;
    const sl = sortieren(a?.schueler ?? [], kbw);
    const fehlzeitVon = (id: number) => (a?.fehlzeiten ?? []).find(f => f.schuelerId === id);
    const name = (id: number) => { const x = a?.schueler.find(y => y.id === id); return x ? `${x.name} ${x.vorname}` : ''; };
    const kachel = (x: Schueler) => {
      const f = fehlzeitVon(x.id);
      const st = !f ? 'da' : f.art === 'verspaetet' ? 'spaet' : f.art === 'vorzeitig' ? 'frueh' : 'weg';
      const befreit = d.befreit.has(x.id);
      const an = auswahl.has(x.id);
      const ton = st === 'da' ? t.palette.status.ok.main : st === 'weg' ? t.palette.status.entfall.main : t.palette.status.pruefung.main;
      const [z1, z2] = nameZeilen(x, kbw);
      const titel = befreit ? 'vom Unterricht befreit' : st === 'weg' ? 'abwesend' : st === 'spaet' ? `verspätet (${f!.minuten} min)` : st === 'frueh' ? `vorzeitig gegangen (${f!.minuten} min)` : 'anwesend';
      return (
        <Tooltip key={x.id} title={titel + (f?.fehlstunden && st !== 'weg' ? ' – als Fehlstunde gewertet' : '')}>
          <Box role="button" tabIndex={0} aria-pressed={an} onClick={() => darf && setAuswahl(s2 => { const n = new Set(s2); if (n.has(x.id)) n.delete(x.id); else n.add(x.id); return n; })}
            onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && darf) { e.preventDefault(); setAuswahl(s2 => { const n = new Set(s2); if (n.has(x.id)) n.delete(x.id); else n.add(x.id); return n; }); } }}
            sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 1, p: 1, pr: 4, borderRadius: 2, cursor: darf ? 'pointer' : 'default', userSelect: 'none', minWidth: 0,
              border: 1.5, borderColor: an ? 'primary.main' : st === 'da' ? 'divider' : alpha(ton, 0.5),
              bgcolor: an ? alpha(t.palette.primary.main, 0.07) : st === 'weg' ? t.palette.status.entfall.flaeche : st !== 'da' ? t.palette.status.pruefung.flaeche : 'background.paper',
              opacity: befreit && st === 'da' ? 0.6 : 1 }}>
            <Box sx={{ position: 'relative', flex: 'none' }}>
              <Box sx={{ width: 34, height: 34, borderRadius: 17, bgcolor: avatarFarbe(x.id), color: 'grey.800', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600 }}>{initialenVon(x)}</Box>
              <Box sx={{ position: 'absolute', right: -3, bottom: -3, width: 16, height: 16, borderRadius: 8, bgcolor: ton, color: '#fff', display: 'grid', placeItems: 'center', border: `2px solid ${t.palette.background.paper}` }}>
                {st === 'da' ? <CheckRounded sx={{ fontSize: 10 }} /> : st === 'weg' ? <CloseRounded sx={{ fontSize: 10 }} /> : st === 'spaet' ? <AccessTimeRounded sx={{ fontSize: 10 }} /> : <LogoutRounded sx={{ fontSize: 10 }} />}
              </Box>
            </Box>
            <Box sx={{ minWidth: 0, lineHeight: 1.2 }}>
              <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }}>{z1}</Typography>
              <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary' }}>{z2}{f && st !== 'weg' ? ` · ${st === 'spaet' ? '+' : '−'}${f.minuten}′` : ''}{befreit ? ' · befreit' : ''}</Typography>
              {kbw.klasseZeigen && x.klasse && <Typography noWrap sx={{ fontSize: 10.5, color: 'text.disabled' }}>{x.klasse}</Typography>}
            </Box>
            {darf && a?.einstellungen?.direkteEingabe !== false && (
              <Tooltip title={st === 'da' ? 'Als abwesend markieren' : 'Als anwesend markieren'}>
                <IconButton size="small" aria-label={st === 'da' ? 'Als abwesend markieren' : 'Als anwesend markieren'} sx={{ position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)', color: st === 'da' ? 'text.disabled' : 'status.ok.main' }}
                  onClick={e => { e.stopPropagation(); const m = fz(); if (m.has(x.id)) void abwesenheitEntfernen([x.id]); else { m.set(x.id, { art: 'fehlt', minuten: 0 }); void anwesenheitSpeichern(m); } }}>
                  {st === 'da' ? <CloseRounded fontSize="small" /> : <CheckRounded fontSize="small" />}
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Tooltip>
      );
    };
    const raster = <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 1, ...(kbw.richtung === 'spalten' ? {} : {}) }}>{sl.map(kachel)}</Box>;
    const zeitVon = (nr: number) => zeiten.find(z => z.nr === nr);
    const fruehere = zeiten.some(z => z.nr < bereich.von);
    const zeilen = [...(a?.fehlzeiten ?? []).map(f => ({ f, vor: false, spaeter: false })), ...(a?.vorstunden ?? []).map(f => ({ f, vor: true, spaeter: false })), ...(a?.weitere ?? []).map(f => ({ f, vor: true, spaeter: true }))];
    const STATUS: Record<string, [string, 'pruefung' | 'ok' | 'entfall']> = { offen: ['offen', 'pruefung'], entschuldigt: ['entschuldigt', 'ok'], unentschuldigt: ['nicht entschuldigt', 'entfall'] };
    const v = d.vermerke;
    const gruppen: { dienst: string; von: string; bis: string; klasse: string; text?: string; schueler: string[] }[] = [];
    for (const z of d.dienste) {
      const g = gruppen.find(x => x.dienst === z.dienst && x.von === z.von && x.bis === z.bis && x.klasse === z.klasse);
      if (g) g.schueler.push(z.schueler); else gruppen.push({ dienst: z.dienst, von: z.von, bis: z.bis, klasse: z.klasse, text: z.text, schueler: [z.schueler] });
    }
    return (
      <>
        <Abschnitt titel="Schüler*innen im Unterricht" zahl={sl.length} rechts={a && <>
          {sl.length > 0 && <ToggleButtonGroup exclusive size="small" value={kbw.ansicht} onChange={(_, x) => { if (x) { const n = { ...kbw, ansicht: x }; kbEinstellungenSpeichern(n); setKbw(n); } }}>
            <ToggleButton value="liste">Liste</ToggleButton><ToggleButton value="sitzplan">Sitzplan</ToggleButton></ToggleButtonGroup>}
          <Tooltip title="Mitteilung schreiben"><IconButton size="small" onClick={() => { schliessen(); navigieren('#/mitteilungen/verfassen'); }} aria-label="Mitteilung schreiben"><MailOutline fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Drucken"><IconButton size="small" onClick={() => window.print()} aria-label="Drucken"><PrintOutlined fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Klassenbuch-Einstellungen"><IconButton size="small" onClick={() => setDialog({ art: 'einst' })} aria-label="Klassenbuch-Einstellungen"><SettingsOutlined fontSize="small" /></IconButton></Tooltip></>}>
          {!a ? <Hinweis>Anwesenheit kann nicht geladen werden.</Hinweis>
            : !sl.length ? <Hinweis>Für diese Klasse wurde keine Schülerliste aus UntPlan übertragen (UntPlan → UntPlanWeb → Einstellungen → „Schülerliste übertragen“).</Hinweis>
            : <>
              {darf && <Stack direction="row" gap={1} sx={{ mb: 1.5 }}><Button size="small" variant="outlined" onClick={() => setAuswahl(new Set(sl.map(x => x.id)))}>Alle auswählen</Button><Button size="small" variant="outlined" onClick={() => setAuswahl(new Set())} disabled={!auswahl.size}>Auswahl löschen</Button>
                {auswahl.size > 0 && <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>{auswahl.size} ausgewählt</Typography>}</Stack>}
              {kbw.ansicht === 'sitzplan' && d.sitz?.gueltig ? <SitzplanAnordnung d={d.sitz} schueler={sl} kachel={kachel} w={kbw} /> : (
                <>{kbw.ansicht === 'sitzplan' && (
                  <Stack direction="row" alignItems="center" gap={1} sx={{ p: 1.5, mb: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                    <Typography variant="body2" sx={{ flex: 1 }}>Für diese Stunde ist noch kein Sitzplan hinterlegt.</Typography>
                    {darfIrgendwas(d.sitz) && <Button size="small" variant="contained" onClick={() => setDialog({ art: 'sitz' })}>Sitzplan erstellen</Button>}
                  </Stack>)}{raster}</>
              )}
              {darf && <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1.5 }}>
                <Button size="small" variant="contained" color="error" disableElevation disabled={!auswahl.size} onClick={() => { const m = fz(); for (const id of auswahl) m.set(id, { ...(m.get(id) ?? {}), art: 'fehlt', minuten: 0 }); setAuswahl(new Set()); void anwesenheitSpeichern(m); }}>abwesend</Button>
                <Button size="small" variant="outlined" startIcon={<AccessTimeRounded />} disabled={!auswahl.size} onClick={() => setDialog({ art: 'abw', ids: [...auswahl], f: null })} title="Verspätung, vorzeitig gegangen, Zeitraum">Abwesenheit …</Button>
                <Button size="small" variant="outlined" disabled={!auswahl.size} onClick={() => setDialog({ art: 'eintrag', ids: [...auswahl] })}>Klassenbucheintrag</Button>
              </Stack>}
            </>}
        </Abschnitt>

        <Abschnitt titel="Lehrstoff" rechts={d.st?.darf && <Tooltip title="Lehrstoff bearbeiten"><IconButton size="small" onClick={() => setDialog({ art: 'lehrstoff' })} aria-label="Lehrstoff bearbeiten"><EditOutlined fontSize="small" /></IconButton></Tooltip>}>
          {d.st?.eintrag?.thema ? <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{d.st.eintrag.thema}</Typography> : <Hinweis>{einzel ? 'Kein Lehrstoff für diese Stunde eingetragen' : 'Kein Lehrstoff eingetragen'}</Hinweis>}
          {(d.st?.eintrag?.lehrform || d.st?.eintrag?.anmerkung) && <Typography variant="caption" color="text.secondary">{[d.st.eintrag.lehrform && `Lehrform: ${d.st.eintrag.lehrform}`, d.st.eintrag.anmerkung && `Anmerkung: ${d.st.eintrag.anmerkung}`].filter(Boolean).join(' · ')}</Typography>}
          {ebenenHinweis('thema')}
        </Abschnitt>

        {a && (
          <Abschnitt titel="Abwesende Schüler*innen" zahl={(a.fehlzeiten ?? []).length} rechts={a.darf && zeilen.length > 0 && (
            <Button size="small" startIcon={<SwapHorizRounded />} disabled={!abwAuswahl.size} onClick={() => {
              const vor = new Set((a.vorstunden ?? []).map(f => f.schuelerId));
              const ids = [...abwAuswahl];
              const ausVor = ids.filter(id => vor.has(id));
              if (ausVor.length) void verlaengern(ausVor, 'stunde');
              else if (fruehere) void verlaengern(ids, 'tagesbeginn');
              else toast('Die Abwesenheit reicht bereits bis zum Stundenende.');
            }}>Verlängern</Button>)}>
            {zeilen.length ? (
              <Box sx={{ overflowX: 'auto', mx: -1 }}>
                <Table size="small">
                  <TableHead><TableRow>
                    <TableCell padding="checkbox"><Checkbox size="small" checked={abwAuswahl.size > 0 && abwAuswahl.size === zeilen.filter(z => !z.spaeter).length} onChange={e => setAbwAuswahl(e.target.checked ? new Set(zeilen.filter(z => !z.spaeter).map(z => z.f.schuelerId)) : new Set())} inputProps={{ 'aria-label': 'Alle auswählen' }} /></TableCell>
                    <TableCell>Schüler*in</TableCell><TableCell>Von</TableCell><TableCell>Bis</TableCell><TableCell>Grund</TableCell><TableCell>Status</TableCell><TableCell>Text</TableCell><TableCell />
                  </TableRow></TableHead>
                  <TableBody>{zeilen.map(({ f, vor, spaeter }, i) => {
                    const sv = vor ? zeitVon(f.stunde ?? 0) : zeitVon(bereich.von);
                    const beginn = !vor && f.vonZeit ? f.vonZeit : sv?.beginn || bereich.beginn;
                    const ende = vor ? zeitVon(f.stunde ?? 0)?.ende ?? '' : f.bisZeit || zeitVon(bereich.bis)?.ende || bereich.ende;
                    const vonD = !vor && f.vonDatum ? f.vonDatum : f.datum || k.datum, bisD = !vor && f.bisDatum ? f.bisDatum : f.datum || k.datum;
                    const stt = STATUS[f.status ?? ''];
                    const zusatz = spaeter ? `${f.stunde}. Stunde` : vor ? 'verlängern' : f.art === 'verspaetet' ? `verspätet ${f.minuten} min` : f.art === 'vorzeitig' ? `vorzeitig ${f.minuten} min` : '';
                    return (
                      <TableRow key={i} selected={abwAuswahl.has(f.schuelerId)} sx={{ opacity: vor ? 0.75 : 1 }}>
                        <TableCell padding="checkbox">{!spaeter && <Checkbox size="small" checked={abwAuswahl.has(f.schuelerId)} onChange={() => setAbwAuswahl(x => { const n = new Set(x); if (n.has(f.schuelerId)) n.delete(f.schuelerId); else n.add(f.schuelerId); return n; })} inputProps={{ 'aria-label': `${name(f.schuelerId)} auswählen` }} />}</TableCell>
                        <TableCell sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{name(f.schuelerId)}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {!vor && f.art === 'fehlt' && fruehere && a.darf && <Tooltip title="Abwesenheit auf Tagesbeginn verlängern"><IconButton size="small" onClick={() => void verlaengern([f.schuelerId], 'tagesbeginn')} aria-label="Auf Tagesbeginn verlängern"><KeyboardTabRounded sx={{ fontSize: 16, transform: 'scaleX(-1)' }} /></IconButton></Tooltip>}
                          {datumDe(vonD)} <Typography component="span" variant="caption" color="text.secondary">{beginn}</Typography></TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{datumDe(bisD)} <Typography component="span" variant="caption" color="text.secondary">{ende}</Typography>
                          {vor && !spaeter && a.darf && <Tooltip title="Abwesenheit bis Stundenende verlängern"><IconButton size="small" onClick={() => void verlaengern([f.schuelerId], 'stunde')} aria-label="Bis Stundenende verlängern"><KeyboardTabRounded sx={{ fontSize: 16 }} /></IconButton></Tooltip>}</TableCell>
                        <TableCell>{f.grund || '–'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{spaeter ? <Plakette>spätere Stunde</Plakette> : vor ? <Plakette>Vorstunde</Plakette> : stt ? <Plakette ton={stt[1]}>{stt[0]}</Plakette> : null}
                          {zusatz && <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75 }}>{zusatz}</Typography>}</TableCell>
                        <TableCell sx={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.text ?? f.bemerkung ?? ''}>{f.text ?? f.bemerkung}</TableCell>
                        <TableCell align="right">{a.darf && !vor && <IconButton size="small" onClick={() => setDialog({ art: 'abw', ids: [f.schuelerId], f })} aria-label={`Abwesenheit von ${name(f.schuelerId)} bearbeiten`}><EditOutlined fontSize="small" /></IconButton>}</TableCell>
                      </TableRow>
                    );
                  })}</TableBody>
                </Table>
              </Box>
            ) : <Hinweis>Keine Abwesenheiten vorhanden</Hinweis>}
          </Abschnitt>
        )}

        <Abschnitt titel="Hausaufgaben" zahl={d.hw.liste.length || null} rechts={d.hw.darf && <Tooltip title="Neue Hausaufgabe"><IconButton size="small" onClick={() => setDialog({ art: 'hwNeu' })} aria-label="Neue Hausaufgabe" sx={{ bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' } }}><AddRounded fontSize="small" /></IconButton></Tooltip>}>
          {d.hw.liste.length ? d.hw.liste.map(h => hwZeile(h, d.hw.darf)) : <Hinweis>Keine Hausaufgaben vorhanden</Hinweis>}
          {d.hw.faellig.length > 0 && <Box sx={{ mt: 1.5 }}><Typography variant="subtitle2" sx={{ mb: 0.75 }}>Fällige Hausaufgaben</Typography>{d.hw.faellig.map(h => hwZeile(h, false))}</Box>}
        </Abschnitt>

        <Abschnitt titel="Klassenbucheinträge" zahl={v.length} rechts={<Tooltip title="Klassenbucheintrag erfassen"><IconButton size="small" onClick={() => setDialog({ art: 'eintrag', ids: [] })} aria-label="Klassenbucheintrag erfassen" sx={{ bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' } }}><AddRounded fontSize="small" /></IconButton></Tooltip>}>
          {v.length ? (
            <Box sx={{ overflowX: 'auto', mx: -1 }}><Table size="small"><TableBody>{v.slice(0, 30).map(x => (
              <TableRow key={x.id} title={x.text}>
                <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 500 }}>{x.schuelerId ? name(x.schuelerId) || '–' : `Klasse ${x.klasse}`}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{datumDe(x.datum)}</TableCell>
                <TableCell><Plakette>{x.art}</Plakette></TableCell>
                <TableCell sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.text}</TableCell>
                <TableCell>{x.lehrer}</TableCell>
              </TableRow>))}</TableBody></Table></Box>
          ) : <Hinweis>Keine Klassenbucheinträge vorhanden</Hinweis>}
        </Abschnitt>

        <Abschnitt titel="Klassendienste" zahl={gruppen.length || null} rechts={kl[0] && <Button size="small" href={`#/dienste/${encodeURIComponent(kl[0])}/alle/liste`} onClick={schliessen}>Klassendienste</Button>}>
          {gruppen.length ? <Stack gap={1}>{gruppen.map((g, i) => (
            <Stack key={i} direction="row" gap={1.5} alignItems="center" sx={{ p: 1, borderRadius: 2, border: 1, borderColor: 'divider' }}>
              <BadgeOutlined color="action" />
              <Box sx={{ minWidth: 0, flex: 1 }}><Typography variant="body2" sx={{ fontWeight: 600 }}>{g.dienst}</Typography>
                <Typography variant="caption" color="text.secondary">{g.von === g.bis ? datumDe(g.von) : `${datumDe(g.von)} – ${datumDe(g.bis)}`}{new Set(gruppen.map(x => x.klasse)).size > 1 ? ` · ${g.klasse}` : ''}{g.text ? ` · ${g.text}` : ''}</Typography></Box>
              <Stack direction="row" gap={0.5} flexWrap="wrap">{g.schueler.map(x => <Chip key={x} size="small" label={x} />)}</Stack>
            </Stack>))}</Stack> : <Hinweis>Für diesen Tag ist niemand eingeteilt.</Hinweis>}
        </Abschnitt>

        <Box sx={{ py: 2 }}>
          {ticket === null ? <Button variant="outlined" size="small" onClick={() => setTicket('')}>Ticket erstellen</Button> : (
            <Box sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2">Ticket erstellen</Typography>
              <Typography variant="caption" color="text.secondary">Das Ticket geht als Mitteilung an Schulleitung und Administration.</Typography>
              <TextField multiline minRows={3} fullWidth value={ticket} onChange={e => setTicket(e.target.value)} placeholder="Was soll erledigt werden?" sx={{ my: 1 }} autoFocus />
              <Stack direction="row" gap={1}><Button size="small" variant="contained" onClick={async () => {
                if (!ticket.trim()) { toast('Bitte beschreiben Sie das Anliegen.', true); return; }
                try { await senden('/api/app/mitteilungen', { empfaenger: ['gruppe:leitung'], betreff: `Ticket: ${kl.join(', ')} ${k.fach || ''} ${datumDe(k.datum)} ${einzel ?? k.von}. Std.`.trim(), text: ticket, wichtig: false }); setTicket(null); toast('Ticket gesendet.'); } catch (err) { toast((err as Error).message, true); }
              }}>Senden</Button><Button size="small" onClick={() => setTicket(null)}>Abbrechen</Button></Stack>
            </Box>
          )}
        </Box>
      </>
    );
  };

  // ---------------------------------------------------------------- Fuß
  const fuss = () => {
    if (reiter === 'raum') return (
      <Stack direction="row" gap={1} justifyContent="flex-end">
        <Button variant="outlined" onClick={() => { setReiter('details'); setRaumModus(null); }}>Abbrechen</Button>
        <Button variant="contained" disabled={!raumModus?.gewaehlt} onClick={() => {
          const akt = kuerzel(k.raeume.filter(w => w.k));
          const g = raumModus!.gewaehlt!;
          const neu = raumModus!.art === 'ersetzen' ? akt.map(x => (x === raumModus!.raum ? g : x)) : [...akt, g];
          void raumAendern([...new Set(neu)], raumModus!.art === 'ersetzen' ? `${raumModus!.raum} durch ${g} ersetzt.` : `Raum ${g} hinzugefügt.`);
        }}>Speichern</Button>
      </Stack>
    );
    if (reiter === 'klassenbuch' && d) {
      const a = d.anw;
      const stoff = !!(d.st?.eintrag?.thema || (einzel && d.st?.blockEintrag?.thema));
      const jetzt = jetztMinuten();
      const kannKontrolle = a?.darf && (k.datum < heuteIso() || (k.datum === heuteIso() && (!bereich.beginn || minuten(bereich.beginn) <= jetzt)));
      const ok = (text: string) => <Stack direction="row" gap={0.75} alignItems="center" sx={{ color: 'status.ok.main', fontSize: 13, fontWeight: 500 }}><CheckCircleRounded sx={{ fontSize: 18 }} />{text}</Stack>;
      return (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} justifyContent="space-between" alignItems={{ sm: 'center' }}>
          {stoff ? ok('Lehrstoffeintragung vorhanden') : d.st?.darf ? <Button variant="contained" onClick={() => setDialog({ art: 'lehrstoff' })}>Lehrstoff eingeben</Button>
            : <Stack direction="row" gap={0.75} alignItems="center" sx={{ color: 'text.secondary', fontSize: 13 }}><RadioButtonUncheckedRounded sx={{ fontSize: 18 }} />Keine Lehrstoffeintragung</Stack>}
          {a?.geprueft ? ok('Abwesenheiten wurden kontrolliert') : kannKontrolle ? <Button variant="contained" onClick={() => void anwesenheitSpeichern(fz())}>Abwesenheiten kontrollieren</Button>
            : <Typography variant="body2" color="text.secondary">Abwesenheitskontrolle ab: {datumDe(k.datum)} – {bereich.beginn}</Typography>}
        </Stack>
      );
    }
    const pruefung = (k.status === 'klausur' || (k.status === 'vorgemerkt' && /^klausur/i.test(k.art || ''))) && kollegium && k.datum >= heuteIso();
    return (
      <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
        <Button variant="outlined" startIcon={<ChevronLeftRounded />} disabled={posInListe <= 0} onClick={() => blaettern(-1)}>Vorherige</Button>
        <Button variant="outlined" endIcon={<ChevronRightRounded />} disabled={posInListe < 0 || posInListe >= liste.length - 1} onClick={() => blaettern(1)}>Nächste</Button>
        <Box sx={{ flex: 1 }} />
        {pruefung ? <>
          <Button variant="outlined" onClick={() => setDialog({ art: 'pruefungEdit' })}>Prüfung editieren</Button>
          <Button variant="outlined" color="error" onClick={async () => { if (await pruefungLoeschen(k)) { setGeaendert(true); onClose(); onGeaendert?.(); } }}>Prüfung löschen</Button>
        </> : darfPruefung && <Button variant="contained" onClick={async () => {
          if (!d?.anw && k.unterricht) { const anw = await anwLaden().catch(() => null); setD(x => (x ? { ...x, anw } : x)); }
          setDialog({ art: 'pruefung' });
        }}>Prüfung erstellen</Button>}
      </Stack>
    );
  };

  const breit = reiter !== 'details';
  const fertigUndZu = () => { setGeaendert(true); onClose(); onGeaendert?.(); };
  return (
    <Drawer anchor="right" open onClose={schliessen} slotProps={{ paper: { sx: { width: mobil ? '100%' : breit ? 'min(760px, 92vw)' : 480, transition: 'width .16s', display: 'flex', flexDirection: 'column' } }, backdrop: { sx: { bgcolor: 'rgba(17,38,74,.18)' } } }}
      aria-label="Stundendetails">
      {kopf}
      {reiter === 'raum' ? (
        <Box sx={{ px: 2.5, py: 1.25, borderBottom: 1, borderColor: 'divider' }}><Typography variant="h5">{raumModus?.art === 'ersetzen' ? `${raumModus.raum} ersetzen` : 'Raum hinzufügen'}</Typography></Box>
      ) : (
        <Tabs value={reiter} onChange={(_, v) => setReiter(v)} sx={{ px: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          {mitKlassenbuch && <Tab value="klassenbuch" label="Klassenbuch" />}
          <Tab value="details" label="Details" />
        </Tabs>
      )}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5 }}>
        {!d ? <Stack gap={1.5} sx={{ py: 3 }}>{[0, 1, 2, 3].map(i => <Skeleton key={i} variant="rounded" height={i ? 56 : 120} />)}</Stack>
          : reiter === 'klassenbuch' ? klassenbuch()
          : reiter === 'raum' ? <Box sx={{ py: 2 }}>{raeume === null ? <Skeleton variant="rounded" height={200} /> : (
            <RaumListe raeume={raeume} gewaehlt={raumModus?.gewaehlt ?? null} onWahl={x => setRaumModus(m => (m ? { ...m, gewaehlt: x } : m))} filter={raumFilter} setFilter={setRaumFilter}
              waehlbar={r => r.frei} zusatz={r => (r.eigen ? <Typography component="span" variant="caption" color="primary" sx={{ ml: 1 }}>ursprünglicher Raum</Typography> : null)}
              leerText="In dieser Zeit ist kein passender buchbarer Raum frei." />)}</Box>
          : details()}
      </Box>
      <Divider />
      <Box sx={{ px: 2.5, py: 1.5 }} className="nicht-drucken">{fuss()}</Box>

      {d && dialog?.art === 'lehrstoff' && <LehrstoffDialog k={k} eintrag={d.st?.eintrag ?? null} bereich={bereich} block={istBlock} einzel={einzel} lehrerQs={einzigeLehrkraft()} speichern={eintragSpeichern} onClose={() => setDialog(null)} />}
      {d?.anw && dialog?.art === 'abw' && <AbwesenheitDialog k={k} ids={dialog.ids} f={dialog.f} a={d.anw} gruende={d.gruende} zeiten={zeiten} bereich={bereich} eb={eb}
        namen={dialog.ids.map(id => { const x = d.anw!.schueler.find(y => y.id === id); return x ? `${x.name} ${x.vorname}` : ''; }).filter(Boolean)}
        onClose={() => setDialog(null)} fertig={() => { setAuswahl(new Set()); void anwNeu(); }} />}
      {d && dialog?.art === 'eintrag' && <EintragDialog k={k} schueler={d.anw?.schueler ?? []} vorauswahl={dialog.ids} arten={d.arten} zeiten={zeiten} bereich={bereich} onClose={() => setDialog(null)}
        fertig={neu => { setAuswahl(new Set()); setD(x => (x ? { ...x, vermerke: [...neu, ...x.vermerke] } : x)); }} />}
      {d && dialog?.art === 'pruefung' && <PruefungDialog k={k} schueler={d.anw?.schueler ?? []} zeiten={zeiten} onClose={() => setDialog(null)} fertig={fertigUndZu} />}
      {dialog?.art === 'pruefungEdit' && <PruefungBearbeitenDialog k={k} zeiten={zeiten} onClose={() => setDialog(null)} fertig={fertigUndZu} />}
      {dialog?.art === 'hw' && <HausaufgabeDetails h={dialog.h} darf={dialog.darf} onClose={() => setDialog(null)} geaendert={() => void hwNeu()} />}
      {dialog?.art === 'hwNeu' && <HausaufgabeFormular stunde={{ datum: k.datum, von: k.von, unterricht: k.unterricht, fach: k.fach, klassen: kl, einzelstunde: einzel }} onClose={() => setDialog(null)} geaendert={() => void hwNeu()} />}
      <EinstellungenPanel offen={dialog?.art === 'einst'} zu={() => setDialog(null)} onAendern={setKbw} sitzplan={d?.sitz ? { darf: darfIrgendwas(d.sitz), onOeffnen: () => setDialog({ art: 'sitz' }) } : null} />
      {d?.sitz && dialog?.art === 'sitz' && (
        <SitzplanEditor offen zu={() => setDialog(null)} d={d.sitz} kontext={{ ...kontextVon(k), klasse: d.sitz.kontext?.klasse ?? null }} titel="Sitzplan"
          untertitel={[kl.join(', '), k.fach, kuerzel(k.lehrer).join(', '), kuerzel(k.raeume).join(', ')].filter(Boolean).join(' · ')}
          onGespeichert={async () => { const sitz = await stundeLaden(kontextVon(k)).catch(() => null); setD(x => (x ? { ...x, sitz } : x)); const n = { ...kbEinstellungen(), ansicht: 'sitzplan' as const }; kbEinstellungenSpeichern(n); setKbw(n); }} />
      )}
    </Drawer>
  );
}
