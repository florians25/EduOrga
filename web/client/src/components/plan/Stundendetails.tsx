// Fenster „Unterrichtsstunde“: großes, zentriertes Fenster (ca. 94 % × 90 % des Bildschirms, auf dem Telefon Vollbild) für jede Stunde aus
// Stundenplan, Klassenbuch, Offenen Stunden und Startseite. Fester Kopf mit Fach (FachMarke), Plaketten und den Angaben Datum, Zeit, Klasse,
// Lehrkraft, Raum (Links auf die Pläne, Änderungen „alt → neu“), Stand der Dokumentation, Blättern zur vorigen/nächsten Stunde und Wahl
// Block/Einzelstunde. Reiter: Stunde (Thema, Hausaufgaben, Bemerkungen, Hinweise, Räume, Klassendienste), Anwesenheit (Liste oder Sitzplan),
// Einträge (Klassenbucheinträge), Prüfungen und Verlauf (frühere Stunden des Unterrichts). Eingaben werden automatisch gespeichert; der Fuß
// zeigt den Speicherstand. Tastatur: Alt+←/→ Stunde wechseln, Alt+1…5 Reiter, Strg+S sofort speichern, Esc schließen.
// Online-Unterricht wird nur angezeigt (festgelegt in EduOrga Studio). Schüler*innen und Eltern sehen nur den Reiter „Stunde“ und den Verlauf.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Box, Button, Dialog, IconButton, Link, Menu, MenuItem, Skeleton, Stack, Tab, Tabs, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
  useMediaQuery, useTheme,
} from '@mui/material';
import CloseRounded from '@mui/icons-material/CloseRounded';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded';
import MoreHorizRounded from '@mui/icons-material/MoreHorizRounded';
import LinkRounded from '@mui/icons-material/LinkRounded';
import { holen, senden } from '../../api/client';
import type { Karte, PlanTyp, Wert, Zeit } from '../../api/types';
import { useSitzung } from '../../app/sitzung';
import { datumDe, heuteIso, hhmm, jetztMinuten, plusTage, wochentag, wochentagKurz } from '../../lib/datum';
import { navigieren } from '../../lib/router';
import { toast } from '../../lib/meldungen';
import { FormDialog } from '../Bausteine';
import { HausaufgabeDetails, HausaufgabeFormular } from '../klassenbuch/Hausaufgabe';
import { AbwesenheitDialog, EintragDialog, PruefungBearbeitenDialog, PruefungDialog, pruefungLoeschen, pruefungsartenLaden, type Bereich, type Eintrag, type Grund, type Vermerk } from '../klassenbuch/StundenDialoge';
import { EinstellungenPanel, SitzplanEditor, darfIrgendwas, kbEinstellungen, kbEinstellungenSpeichern, kontextVon, schulVorgabeSetzen, stundeLaden } from '../klassenbuch/sitzplan';
import { LEER, type AnwesenheitMit, type Daten, type Dialog as Unterfenster, type Dienst, type HwListe, type Reiter, type Speicherzustand, type StundenAntwort, type StundeProps } from '../klassenbuch/stunde/kontext';
import { Bereichskarte, Hinweis } from '../klassenbuch/stunde/bausteine';
import { ReiterStunde } from '../klassenbuch/stunde/ReiterStunde';
import { ReiterAnwesenheit, anwesenheitSenden, kannKontrollieren } from '../klassenbuch/stunde/ReiterAnwesenheit';
import { ReiterEintraege } from '../klassenbuch/stunde/ReiterEintraege';
import { ReiterTermine } from '../klassenbuch/stunde/ReiterTermine';
import { ReiterVerlauf } from '../klassenbuch/stunde/ReiterVerlauf';
import { PlaketteChip } from './Kachel';
import { FachMarke } from './darstellung';
import { istEntfall as entfallVon, KEIN_ELEMENT, kuerzel, sichererLink, statusText, verlegungsText, verlegungsRichtung, istVerlegung, type Typ } from './logik';

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

const REITER_TEXT: Record<Reiter, string> = { stunde: 'Stunde', anwesenheit: 'Anwesenheit', eintraege: 'Einträge', termine: 'Prüfungen', verlauf: 'Verlauf' };
const gleicheStunde = (a: Karte, b: Karte) => a.datum === b.datum && a.von === b.von && a.unterricht === b.unterricht && a.fach === b.fach;

export function Stundendetails({ karte, liste: rohListe, typ, onClose, onGeaendert }: { karte: Karte; liste?: Karte[]; typ: Typ; onClose: () => void; onGeaendert?: () => void }) {
  const t = useTheme();
  const mobil = useMediaQuery(t.breakpoints.down('sm'));
  const schmal = useMediaQuery(t.breakpoints.down('md'));
  const s = useSitzung();
  const { ich } = s;
  const kollegium = !!ich.kollegium;
  const liste = useMemo(() => (rohListe ?? [karte]).filter(x => !x.ereignis).slice().sort((a, b) => a.datum.localeCompare(b.datum) || a.von - b.von), [rohListe, karte]);
  const [k, setK] = useState(karte);
  const [einzel, setEinzel] = useState<number | null>(null);
  const [reiter, setReiter] = useState<Reiter>('stunde');
  const [d, setD] = useState<Daten | null>(null);
  const [zeiten, setZeiten] = useState<Zeit[]>([]);
  const [geaendert, setGeaendert] = useState(false);
  const [dialog, setDialog] = useState<Unterfenster>(null);
  const [kbw, setKbw] = useState(kbEinstellungen);
  const [mehr, setMehr] = useState<HTMLElement | null>(null);
  const [tasten, setTasten] = useState(false);
  const [speicher, setSpeicher] = useState<Speicherzustand>({ art: 'bereit' });

  const ptyp = typ ?? null;
  const kl = kuerzel(k.klassen);
  const unterrichtKarte = !!k.unterricht && !['vorgemerkt', 'buchung', 'veranstaltung'].includes(k.status);
  const mitKlassenbuch = kollegium && !!k.unterricht && !['entfall', 'abwesend', 'vorgemerkt', 'buchung', 'veranstaltung'].includes(k.status);
  const darfPruefung = kollegium && kl.length > 0 && k.datum >= heuteIso() && !['entfall', 'abwesend', 'veranstaltung', 'vorgemerkt'].includes(k.status);
  const istPruefung = (k.status === 'klausur' || (k.status === 'vorgemerkt' && /^klausur/i.test(k.art || ''))) && kollegium && k.datum >= heuteIso();
  const darfRaum = darfPruefung && !!k.unterricht && (!!d?.st?.darf || ich.admin);
  const istBlock = !!k.unterricht && k.bis > k.von && !['vorgemerkt', 'buchung', 'veranstaltung'].includes(k.status);
  const reiterListe: Reiter[] = ['stunde', ...(mitKlassenbuch ? ['anwesenheit', 'eintraege'] as Reiter[] : []),
    ...(kollegium && kl.length > 0 && !['buchung', 'veranstaltung'].includes(k.status) ? ['termine'] as Reiter[] : []), ...(unterrichtKarte && kl.length > 0 ? ['verlauf'] as Reiter[] : [])];
  const aktiv: Reiter = reiterListe.includes(reiter) ? reiter : 'stunde';
  const ep = einzel ? `&einzelstunde=${einzel}` : '';
  const eb = useMemo(() => (einzel ? { einzelstunde: einzel } : {}), [einzel]);
  const einzigeLehrkraft = () => { const l = kuerzel(k.lehrer); return l.length === 1 && !(k.lehrer[0].alt && !k.lehrer[0].k) ? `&lehrer=${encodeURIComponent(l[0])}` : ''; };
  const einzelstunden = d?.st?.einzelstunden?.length ? d.st.einzelstunden
    : Array.from({ length: k.bis - k.von + 1 }, (_, i) => k.von + i).map(n => { const z = zeiten.find(x => x.nr === n); return { stunde: n, beginn: z?.beginn ?? '', ende: z?.ende ?? '', eintrag: false }; });
  const bereich: Bereich = !einzel ? { von: k.von, bis: k.bis, beginn: k.beginn, ende: k.ende }
    : (() => { const z = einzelstunden.find(x => x.stunde === einzel); return { von: einzel, bis: einzel, beginn: z?.beginn || k.beginn, ende: z?.ende || k.ende }; })();
  const schluessel = `${k.datum}|${k.von}|${k.unterricht}|${k.fach}|${einzel ?? 0}`;
  const schluesselRef = useRef(schluessel);
  schluesselRef.current = schluessel;

  const hwLaden = useCallback(() => holen<HwListe>(`/api/app/klassenbuch/hausaufgabenliste?datum=${k.datum}&stunde=${k.von}&bis=${k.bis}&unterricht=${k.unterricht}&fach=${encodeURIComponent(k.fach || '')}&klassen=${encodeURIComponent(kl.join(','))}${ep}`), [k, ep, kl.join(',')]);
  const anwLaden = useCallback(() => holen<AnwesenheitMit>(`/api/app/klassenbuch/anwesenheit?datum=${k.datum}&stunde=${k.von}&unterricht=${k.unterricht}${ep}`), [k, ep]);

  // ---------------------------------------------------------------- Laden
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
    })();
    return () => { ok = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k.datum, k.von, k.unterricht, einzel]);

  const markieren = () => setGeaendert(true);
  const anwNeu = async () => { const anw = await anwLaden(); setD(x => (x ? { ...x, anw } : x)); markieren(); };
  const hwNeu = async () => { try { const hw = await hwLaden(); setD(x => (x ? { ...x, hw } : x)); markieren(); } catch (err) { toast((err as Error).message, true); } };

  // ---------------------------------------------------------------- Automatisch speichern (Thema, Lehrform, Anmerkung, Bemerkungen)
  const ausstehend = useRef<{ schluessel: string; ziel: object; felder: Partial<Eintrag> } | null>(null);
  const zeitgeber = useRef<number | undefined>(undefined);
  const kette = useRef<Promise<void>>(Promise.resolve());
  const jetzt = () => hhmm(jetztMinuten());
  const sichern = useCallback(() => {
    window.clearTimeout(zeitgeber.current);
    kette.current = kette.current.then(async () => {
      const a = ausstehend.current;
      if (!a) return;
      ausstehend.current = null;
      setSpeicher({ art: 'speichert' });
      try {
        const e = await senden<Eintrag>('/api/app/klassenbuch/stunde', { ...a.ziel, ...a.felder }, 'PUT');
        if (a.schluessel === schluesselRef.current) {
          setD(x => x && x.st ? { ...x, st: { ...x.st, eintrag: e, ...((a.ziel as { einzelstunde?: number }).einzelstunde ? { einzelstunden: (x.st.einzelstunden ?? []).map(z => (z.stunde === (a.ziel as { einzelstunde?: number }).einzelstunde ? { ...z, eintrag: true } : z)) } : { blockEintrag: e }) } } : x);
        }
        setGeaendert(true);
        setSpeicher(ausstehend.current ? { art: 'ungespeichert' } : { art: 'gespeichert', zeit: jetzt() });
      } catch (err) {
        // nicht verlieren: beim nächsten Versuch erneut senden
        ausstehend.current = { ...a, felder: { ...a.felder, ...((ausstehend.current as typeof a | null)?.felder ?? {}) } };
        setSpeicher({ art: 'fehler', text: (err as Error).message });
        toast((err as Error).message, true);
      }
    });
    return kette.current;
  }, []);
  const vormerken = (felder: Partial<Eintrag>, sofort = false) => {
    if (Object.keys(felder).length) {
      const lk = kuerzel(k.lehrer);
      const ziel = { datum: k.datum, stunde: k.von, unterricht: k.unterricht, lehrer: lk.length === 1 ? lk[0] : null, ...eb };
      const alt = ausstehend.current?.schluessel === schluessel ? ausstehend.current.felder : {};
      if (ausstehend.current && ausstehend.current.schluessel !== schluessel) void sichern();
      ausstehend.current = { schluessel, ziel, felder: { ...alt, ...felder } };
      setSpeicher({ art: 'ungespeichert' });
    }
    window.clearTimeout(zeitgeber.current);
    if (!ausstehend.current) return;
    if (sofort) void sichern(); else zeitgeber.current = window.setTimeout(() => void sichern(), 900);
  };
  useEffect(() => () => window.clearTimeout(zeitgeber.current), []);

  const schliessen = async () => {
    if (ausstehend.current) await sichern();
    onClose();
    if (geaendert || ausstehend.current === null && speicher.art === 'gespeichert') onGeaendert?.();
  };

  // ---------------------------------------------------------------- Blättern
  const posInListe = liste.findIndex(y => gleicheStunde(y, k));
  const wechseln = async (x: Karte) => {
    if (ausstehend.current) await sichern();
    setEinzel(null); setDialog(null);
    setK(liste.find(y => gleicheStunde(y, x)) ?? x);
  };
  const blaettern = (n: number) => { const x = liste[posInListe + n]; if (x) void wechseln(x); };

  // Tastatur: Alt+←/→ Stunde wechseln, Alt+1…5 Reiter, Strg+S speichern
  const tastenRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  tastenRef.current = (e: KeyboardEvent) => {
    if (dialog) return;
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); blaettern(e.key === 'ArrowLeft' ? -1 : 1); return; }
    if (e.altKey && /^[1-5]$/.test(e.key)) { const r = reiterListe[Number(e.key) - 1]; if (r) { e.preventDefault(); setReiter(r); } return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (ausstehend.current) void sichern(); else toast('Alle Änderungen sind gespeichert.'); }
  };
  useEffect(() => {
    const f = (e: KeyboardEvent) => tastenRef.current(e);
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);

  // ---------------------------------------------------------------- Kopf
  const entfall = entfallVon(k, ptyp);
  const alleKlassen = [...k.klassen, ...(k.mitklassen || [])];
  const linkTyp = (x: PlanTyp) => (kollegium || (x !== 'lehrer' && (x !== 'klasse' || !!ich.element)) ? x : null);
  const fachTeil = k.fachAlt && !entfall ? <><Box component="s" sx={{ opacity: 0.7 }}>{k.fachAlt}</Box> → {k.fach}</> : k.status === 'veranstaltung' ? k.fach || k.text || 'Termin' : k.fach || k.text || k.art || 'Stunde';
  const zeitText = `${bereich.von === bereich.bis ? `${bereich.von}. Stunde` : `${bereich.von}.–${bereich.bis}. Stunde`}${bereich.beginn ? ` · ${bereich.beginn}–${bereich.ende}` : ''}`;
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

  const stoff = !!(d?.st?.eintrag?.thema || (einzel && d?.st?.blockEintrag?.thema));
  const kommend = k.datum > heuteIso() || (k.datum === heuteIso() && !!bereich.beginn && bereich.beginn > hhmm(jetztMinuten()));
  // Stand der Dokumentation als schlichter Text: Erledigtes in Zweittextfarbe, Fehlendes in Bernstein – keine Häkchen-Symbole.
  const stand = (an: boolean, ja: string, nein: string, warn: boolean) => (
    <Box component="span" sx={{ fontSize: 13, color: !an && warn ? 'status.pruefung.main' : 'text.secondary', fontWeight: !an && warn ? 500 : 400, whiteSpace: 'nowrap' }}>{an ? ja : nein}</Box>
  );
  const dokumentation = mitKlassenbuch && d && (
    <Stack direction="row" gap={1} alignItems="center" aria-label="Stand der Dokumentation" sx={{ color: 'text.disabled', fontSize: 13 }}>
      {stand(stoff, 'Thema eingetragen', 'Thema fehlt', !kommend)}
      <span aria-hidden>·</span>
      {stand(!!d.anw?.geprueft, 'Anwesenheit kontrolliert', kommend ? 'Anwesenheit ab Stundenbeginn' : 'Anwesenheit offen', !kommend)}
    </Stack>
  );
  const angabe = (titel: string, inhalt: ReactNode) => (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: 11.5, color: 'text.secondary', lineHeight: '16px' }}>{titel}</Typography>
      <Typography component="div" sx={{ fontSize: 13.5, lineHeight: '20px', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{inhalt}</Typography>
    </Box>
  );
  const angaben = [
    angabe('Datum', `${mobil ? wochentagKurz(k.datum) : wochentag(k.datum)}, ${datumDe(k.datum)}`),
    angabe('Zeit', zeitText),
    alleKlassen.length > 0 && angabe(alleKlassen.length > 1 ? 'Klassen' : 'Klasse', <KopfWerte werte={alleKlassen} typ={linkTyp('klasse')} datum={k.datum} />),
    k.lehrer.length > 0 && angabe(k.lehrer.length > 1 ? 'Lehrkräfte' : 'Lehrkraft', <KopfWerte werte={k.lehrer} typ={linkTyp('lehrer')} datum={k.datum} />),
    online ? angabe('Raum', 'Online-Unterricht') : k.raeume.length > 0 && angabe(k.raeume.length > 1 ? 'Räume' : 'Raum', <KopfWerte werte={k.raeume} typ="raum" datum={k.datum} />),
  ].filter(Boolean);
  const navi = liste.length > 1 && (
    <Stack direction="row" alignItems="center" className="nicht-drucken" sx={{ border: 1, borderColor: 'divider', borderRadius: '6px', bgcolor: 'background.paper' }}>
      <Tooltip title="Vorige Stunde (Alt + ←)"><span><IconButton size="small" disabled={posInListe <= 0} onClick={() => blaettern(-1)} aria-label="Vorige Stunde"><ChevronLeftRounded fontSize="small" /></IconButton></span></Tooltip>
      <Typography variant="caption" sx={{ px: 0.5, minWidth: 48, textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: 'text.secondary' }}>{posInListe >= 0 ? `${posInListe + 1} von ${liste.length}` : `– von ${liste.length}`}</Typography>
      <Tooltip title="Nächste Stunde (Alt + →)"><span><IconButton size="small" disabled={posInListe < 0 || posInListe >= liste.length - 1} onClick={() => blaettern(1)} aria-label="Nächste Stunde"><ChevronRightRounded fontSize="small" /></IconButton></span></Tooltip>
    </Stack>
  );
  const kopf = (
    <Box component="header" sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 1.5, sm: 2 }, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider', flex: 'none' }}>
      <Stack direction="row" alignItems="flex-start" gap={1.5}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.25 }}>{mitKlassenbuch || unterrichtKarte ? 'Unterrichtsstunde' : k.status === 'veranstaltung' ? 'Termin' : 'Stunde'}</Typography>
          <Stack direction="row" alignItems="center" columnGap={1.25} rowGap={0.5} flexWrap="wrap" sx={{ minWidth: 0 }}>
            {k.fach && <FachMarke farbe={k.farbe} groesse={10} />}
            <Typography variant="h2" component="h2" id="stunde-titel" sx={{ fontSize: { xs: 18, sm: 20 }, lineHeight: 1.3, fontWeight: 600, color: entfall ? 'status.entfall.main' : 'text.primary', textDecoration: entfall ? 'line-through' : 'none', textDecorationThickness: 1, minWidth: 0 }}>
              {fachTeil}
              {k.fachName && k.fachName !== k.fach && <Box component="span" sx={{ ml: 1, fontWeight: 400, color: 'text.secondary', fontSize: 15 }}>{k.fachName}</Box>}
              {k.gruppe && <Box component="span" sx={{ ml: 1, fontWeight: 400, color: 'text.secondary' }}>{k.gruppe}</Box>}
            </Typography>
            {plaketten.map((p, i) => <PlaketteChip key={i} p={{ text: p.text, ton: p.ton, hinweis: p.hinweis }} />)}
            {online && <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, color: 'primary.main', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}><LinkRounded sx={{ fontSize: 13 }} />Online</Box>}
          </Stack>
        </Box>
        {!schmal && dokumentation && <Box sx={{ pt: 2.25 }}>{dokumentation}</Box>}
        <Stack direction="row" gap={0.75} alignItems="center" className="nicht-drucken" sx={{ pt: { xs: 0, sm: 1.5 } }}>
          {!mobil && navi}
          <Tooltip title="Weitere Aktionen"><IconButton size="small" onClick={e => setMehr(e.currentTarget)} aria-label="Weitere Aktionen" aria-haspopup="menu"><MoreHorizRounded fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Schließen (Esc)"><IconButton size="small" onClick={() => void schliessen()} aria-label="Schließen"><CloseRounded fontSize="small" /></IconButton></Tooltip>
        </Stack>
      </Stack>
      <Stack direction="row" columnGap={{ xs: 2, sm: 3.5 }} rowGap={1} flexWrap="wrap" sx={{ mt: 1.25 }}>{angaben}</Stack>
      {schmal && dokumentation && <Box sx={{ mt: 1 }}>{dokumentation}</Box>}
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'flex-end' }} columnGap={2} sx={{ mt: 1 }}>
        {reiterListe.length > 1 ? (
          <Tabs value={aktiv} onChange={(_, v) => setReiter(v)} variant="scrollable" allowScrollButtonsMobile sx={{ minHeight: 42, flex: 1, minWidth: 0, '& .MuiTab-root': { minHeight: 42, px: { xs: 1.5, sm: 2 } } }} aria-label="Bereiche der Stunde">
            {reiterListe.map((r, i) => <Tab key={r} value={r} label={<Stack direction="row" gap={0.75} alignItems="center">{REITER_TEXT[r]}{reiterZahl(r)}</Stack>} id={`stunde-reiter-${r}`} aria-controls="stunde-inhalt" title={`${REITER_TEXT[r]} (Alt + ${i + 1})`} />)}
          </Tabs>
        ) : <Box sx={{ flex: 1, height: 12 }} />}
        {istBlock && (
          <ToggleButtonGroup exclusive size="small" value={einzel ?? 0} onChange={(_, v) => { if (v === null || v === (einzel ?? 0)) return; void (async () => { if (ausstehend.current) await sichern(); setEinzel(v || null); })(); }}
            sx={{ mb: 1, alignSelf: { xs: 'flex-start', md: 'auto' } }} aria-label="Ganzer Block oder Einzelstunde">
            <ToggleButton value={0}>Ganzer Block</ToggleButton>
            {einzelstunden.map(z => <ToggleButton key={z.stunde} value={z.stunde} title={z.beginn ? `${z.beginn}–${z.ende}` : undefined}>{z.stunde}. Std.{z.eintrag && <Box component="span" sx={{ ml: 0.75, width: 6, height: 6, borderRadius: 1.5, bgcolor: 'primary.main' }} />}</ToggleButton>)}
          </ToggleButtonGroup>
        )}
      </Stack>
      <Menu anchorEl={mehr} open={!!mehr} onClose={() => setMehr(null)}>
        {kl[0] && kollegium && <MenuItem onClick={() => { setMehr(null); void schliessen().then(() => navigieren(`#/klassenbuch/${encodeURIComponent(kl[0])}/woche/${k.datum}`)); }}>Klassenbuch der Klasse {kl[0]}</MenuItem>}
        {kollegium && <MenuItem onClick={() => { setMehr(null); void schliessen().then(() => navigieren('#/mitteilungen/verfassen')); }}>Mitteilung schreiben</MenuItem>}
        {mitKlassenbuch && <MenuItem onClick={() => { setMehr(null); setDialog({ art: 'ticket' }); }}>Ticket an Schulleitung und Administration</MenuItem>}
        {mitKlassenbuch && <MenuItem onClick={() => { setMehr(null); setDialog({ art: 'einst' }); }}>Anzeige der Schülerliste</MenuItem>}
        <MenuItem onClick={() => { setMehr(null); window.print(); }}>Drucken</MenuItem>
        {!mobil && <MenuItem onClick={() => { setMehr(null); setTasten(true); }}>Tastenkürzel</MenuItem>}
      </Menu>
    </Box>
  );
  function reiterZahl(r: Reiter): ReactNode {
    if (!d) return null;
    const zahl = (n: number, ton: 'warn' | 'neutral') => n > 0 && <Box component="span" sx={{ fontSize: 12.5, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: ton === 'warn' ? 'status.entfall.main' : 'text.secondary' }}>{n}</Box>;
    if (r === 'anwesenheit') return d.anw && !kommend && !d.anw.geprueft ? <Box component="span" title="noch nicht kontrolliert" sx={{ width: 7, height: 7, borderRadius: 1.5, bgcolor: 'status.pruefung.main' }} /> : zahl((d.anw?.fehlzeiten ?? []).filter(f => f.art === 'fehlt').length, 'warn');
    if (r === 'eintraege') return zahl(d.vermerke.filter(v => v.datum === k.datum).length, 'neutral');
    return null;
  }

  // ---------------------------------------------------------------- Inhalt
  const onlineKarte = unterrichtKarte && online && d && (
    <Bereichskarte titel="Findet online statt" rechts={einzel && d.st?.blockEintrag?.online ? <Typography variant="caption" color="text.secondary">ganzer Block</Typography> : null}>
      {sichererLink(onlineLink) ? (
        <Button variant="contained" href={onlineLink} target="_blank" rel="noopener noreferrer">Online-Unterricht beitreten</Button>
      ) : <Hinweis>Es wurde noch kein Link zum Online-Unterricht hinterlegt.</Hinweis>}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Online-Unterricht und Link legt die Schulleitung in EduOrga Studio fest.</Typography>
    </Bereichskarte>
  );
  const props: StundeProps | null = d && {
    k, d, setD, einzel, bereich, zeiten, kollegium, kbw, setKbw, liste, setDialog, markieren, vormerken, anwNeu, hwNeu, setK,
    oeffnen: x => void wechseln(x),
  };
  const anwSpeicher = (z: 'speichert' | 'gespeichert' | 'fehler', text?: string) => setSpeicher(z === 'gespeichert' ? { art: 'gespeichert', zeit: jetzt() } : z === 'fehler' ? { art: 'fehler', text: text ?? '' } : { art: 'speichert' });
  const pruefungWeg = async () => { if (await pruefungLoeschen(k)) { setGeaendert(true); onClose(); onGeaendert?.(); } };
  const inhalt = !props ? <Stack gap={2}>{[0, 1, 2].map(i => <Skeleton key={i} variant="rounded" height={i ? 90 : 160} />)}</Stack>
    : aktiv === 'anwesenheit' ? <ReiterAnwesenheit {...props} onSpeichern={anwSpeicher} />
    : aktiv === 'eintraege' ? <ReiterEintraege {...props} />
    : aktiv === 'termine' ? <ReiterTermine {...props} darfPruefung={darfPruefung} istPruefung={istPruefung} loeschen={() => void pruefungWeg()} />
    : aktiv === 'verlauf' ? <ReiterVerlauf {...props} />
    : <ReiterStunde key={schluessel} {...props} unterrichtKarte={unterrichtKarte} mitKlassenbuch={mitKlassenbuch} darfRaum={darfRaum} online={onlineKarte} typ={ptyp} />;

  // ---------------------------------------------------------------- Fuß
  const speicherText = speicher.art === 'speichert' ? 'Wird gespeichert …' : speicher.art === 'ungespeichert' ? (mobil ? 'Ungespeichert' : 'Änderungen werden gleich gespeichert')
    : speicher.art === 'gespeichert' ? (mobil ? `Gespeichert ${speicher.zeit}` : `Alle Änderungen gespeichert · ${speicher.zeit}`) : speicher.art === 'fehler' ? `Nicht gespeichert: ${speicher.text}` : d?.st?.darf && !mobil ? 'Eingaben werden automatisch gespeichert' : '';
  const kontrolle = d && kannKontrollieren({ k, bereich }, d.anw);
  const bestaetigen = async () => {
    if (!d?.anw) return;
    try {
      setSpeicher({ art: 'speichert' });
      const m = new Map((d.anw.fehlzeiten ?? []).map(f => [f.schuelerId, { art: f.art, minuten: f.minuten, bemerkung: f.text ?? f.bemerkung, grund: f.grund, von: f.beginn || null, bis: f.ende || null }]));
      await anwesenheitSenden({ k, einzel }, m);
      await anwNeu(); setSpeicher({ art: 'gespeichert', zeit: jetzt() }); toast('Anwesenheit bestätigt.');
    } catch (err) { setSpeicher({ art: 'fehler', text: (err as Error).message }); toast((err as Error).message, true); }
  };
  const fussAktion = (() => {
    if (!d || !mitKlassenbuch) return null;
    if (aktiv === 'anwesenheit') return d.anw?.geprueft
      ? (!mobil && posInListe >= 0 && posInListe < liste.length - 1 ? <Button variant="outlined" endIcon={<ChevronRightRounded />} onClick={() => blaettern(1)}>Nächste Stunde</Button> : null)
      : kontrolle ? <Button variant="contained" onClick={() => void bestaetigen()}>{(d.anw?.fehlzeiten ?? []).length ? 'Anwesenheit bestätigen' : 'Alle anwesend – bestätigen'}</Button> : null;
    if (aktiv === 'stunde' && kontrolle && !d.anw?.geprueft) return <Button variant="outlined" endIcon={<ChevronRightRounded />} onClick={() => setReiter('anwesenheit')}>{mobil ? 'Anwesenheit' : 'Weiter zur Anwesenheit'}</Button>;
    return null;
  })();
  const fuss = (
    <Stack component="footer" direction="row" gap={1.5} alignItems="center" className="nicht-drucken" sx={{ px: { xs: 2, sm: 3 }, py: 1.25, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper', flex: 'none', minHeight: 56 }}>
      <Stack direction="row" gap={0.75} alignItems="center" sx={{ minWidth: 0, flex: 1, color: speicher.art === 'fehler' ? 'status.entfall.main' : 'text.secondary' }} role="status" aria-live="polite">
        {speicher.art === 'fehler' && <ErrorOutlineRounded sx={{ fontSize: 17 }} />}
        <Typography variant="body2" noWrap sx={{ color: 'inherit' }}>{speicherText}</Typography>
        {speicher.art === 'fehler' && <Button size="small" onClick={() => void sichern()}>Erneut versuchen</Button>}
      </Stack>
      {mobil && navi}
      {fussAktion}
    </Stack>
  );

  return (
    <Dialog open onClose={() => void schliessen()} fullScreen={mobil} maxWidth={false} aria-labelledby="stunde-titel" scroll="paper"
      slotProps={{
        paper: { sx: mobil ? { display: 'flex', flexDirection: 'column' } : { width: reiterListe.length > 1 ? 'min(1360px, 94vw)' : 'min(760px, 94vw)', height: reiterListe.length > 1 ? '90vh' : 'auto', maxHeight: '90vh', m: 2, display: 'flex', flexDirection: 'column', borderRadius: 1.5, overflow: 'hidden' } },
        backdrop: { sx: { bgcolor: 'rgba(12,44,49,.32)' } },
      }}>
      {kopf}
      <Box id="stunde-inhalt" role="tabpanel" aria-labelledby={`stunde-reiter-${aktiv}`} sx={{ flex: 1, overflowY: 'auto', bgcolor: 'background.default', px: { xs: 1.5, sm: 3 }, py: { xs: 1.5, sm: 2.5 } }}>{inhalt}</Box>
      {fuss}

      {d?.anw && dialog?.art === 'abw' && <AbwesenheitDialog k={k} ids={dialog.ids} f={dialog.f} a={d.anw} gruende={d.gruende} zeiten={zeiten} bereich={bereich} eb={eb}
        namen={dialog.ids.map(id => { const x = d.anw!.schueler.find(y => y.id === id); return x ? `${x.name} ${x.vorname}` : ''; }).filter(Boolean)}
        onClose={() => setDialog(null)} fertig={() => void anwNeu()} />}
      {d && dialog?.art === 'eintrag' && <EintragDialog k={k} schueler={d.anw?.schueler ?? []} vorauswahl={dialog.ids} arten={d.arten} zeiten={zeiten} bereich={bereich} onClose={() => setDialog(null)}
        fertig={neu => { setD(x => (x ? { ...x, vermerke: [...neu, ...x.vermerke] } : x)); markieren(); }} />}
      {d && dialog?.art === 'pruefung' && <PruefungDialog k={k} schueler={d.anw?.schueler ?? []} zeiten={zeiten} onClose={() => setDialog(null)} fertig={() => { setGeaendert(true); onClose(); onGeaendert?.(); }} />}
      {dialog?.art === 'pruefungEdit' && <PruefungBearbeitenDialog k={k} zeiten={zeiten} onClose={() => setDialog(null)} fertig={() => { setGeaendert(true); onClose(); onGeaendert?.(); }} />}
      {dialog?.art === 'hw' && <HausaufgabeDetails h={dialog.h} darf={dialog.darf} onClose={() => setDialog(null)} geaendert={() => void hwNeu()} />}
      {dialog?.art === 'hwNeu' && <HausaufgabeFormular stunde={{ datum: k.datum, von: k.von, unterricht: k.unterricht, fach: k.fach, klassen: kl, einzelstunde: einzel }} onClose={() => setDialog(null)} geaendert={() => void hwNeu()} />}
      {dialog?.art === 'ticket' && <TicketDialog k={k} einzel={einzel} onClose={() => setDialog(null)} />}
      <EinstellungenPanel offen={dialog?.art === 'einst'} zu={() => setDialog(null)} onAendern={setKbw} sitzplan={d?.sitz ? { darf: darfIrgendwas(d.sitz), onOeffnen: () => setDialog({ art: 'sitz' }) } : null} />
      {d?.sitz && dialog?.art === 'sitz' && (
        <SitzplanEditor offen zu={() => setDialog(null)} d={d.sitz} kontext={{ ...kontextVon(k), klasse: d.sitz.kontext?.klasse ?? null }} titel="Sitzplan"
          untertitel={[kl.join(', '), k.fach, kuerzel(k.lehrer).join(', '), kuerzel(k.raeume).join(', ')].filter(Boolean).join(' · ')}
          onGespeichert={async () => { const sitz = await stundeLaden(kontextVon(k)).catch(() => null); setD(x => (x ? { ...x, sitz } : x)); const n = { ...kbEinstellungen(), ansicht: 'sitzplan' as const }; kbEinstellungenSpeichern(n); setKbw(n); }} />
      )}
      <FormDialog offen={tasten} titel="Tastenkürzel" onClose={() => setTasten(false)} ohneAbbrechen={false}>
        <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 3, rowGap: 1, '& dt': { fontWeight: 600, fontVariantNumeric: 'tabular-nums' }, '& dd': { m: 0 } }}>
          {[['Alt + ← / →', 'vorige bzw. nächste Stunde'], ['Alt + 1 … 5', 'Reiter wechseln (Stunde, Anwesenheit, Einträge, Prüfungen, Verlauf)'], ['Strg + S', 'Eingaben sofort speichern'], ['Strg + Enter', 'Hausaufgabe hinzufügen'], ['Esc', 'Fenster schließen (Eingaben werden vorher gespeichert)']]
            .map(([a, b]) => [<dt key={a}>{a}</dt>, <dd key={a + 'b'}>{b}</dd>])}
        </Box>
      </FormDialog>
    </Dialog>
  );
}

function TicketDialog({ k, einzel, onClose }: { k: Karte; einzel: number | null; onClose: () => void }) {
  const [text, setText] = useState('');
  const kl = kuerzel(k.klassen);
  return (
    <FormDialog offen titel="Ticket erstellen" untertitel="Das Ticket geht als Mitteilung an Schulleitung und Administration." onClose={onClose} aktionText="Senden" aktion={async () => {
      if (!text.trim()) { toast('Bitte beschreiben Sie das Anliegen.', true); return false; }
      await senden('/api/app/mitteilungen', { empfaenger: ['gruppe:leitung'], betreff: `Ticket: ${kl.join(', ')} ${k.fach || ''} ${datumDe(k.datum)} ${einzel ?? k.von}. Std.`.trim(), text, wichtig: false });
      toast('Ticket gesendet.');
    }}>
      <TextField multiline minRows={4} fullWidth value={text} onChange={e => setText(e.target.value)} placeholder="Was soll erledigt werden? (z. B. Beamer defekt, Raum nicht geöffnet)" autoFocus sx={{ mt: 0.5 }} />
    </FormDialog>
  );
}
