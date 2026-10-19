// Übersicht für alle Rollen: Begrüßung mit Tageszeile (Datum, nächste Stunde bzw. „Heute kein Unterricht“, Ferienhinweis), eine Leiste
// mit wenigen anklickbaren Kennzahlen und ein Raster aus vier Karten – „Heute & nächste Tage“ (Stunden mit Änderungen), „Zu erledigen“
// (Klassenbuch, offene Abwesenheiten, Hausaufgaben), „Termine“ (Prüfungen, Aufsichten, Sprechtag) und „Mitteilungen & Infos“.
// Jede Gruppe zeigt höchstens fünf Zeilen („Alle anzeigen“); leere Gruppen werden in einer ruhigen Zeile zusammengefasst.
import { useState, type ReactNode } from 'react';
import { alpha, Box, ButtonBase, Link, Paper, Stack, Typography, useTheme } from '@mui/material';
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import CheckRounded from '@mui/icons-material/CheckRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import EventOutlined from '@mui/icons-material/EventOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import MailOutline from '@mui/icons-material/MailOutline';
import TaskAltRounded from '@mui/icons-material/TaskAltRounded';
import WbSunnyOutlined from '@mui/icons-material/WbSunnyOutlined';
import { holen } from '../api/client';
import type { Karte, Tageskopf, Wochenplan } from '../api/types';
import { istFamilie, useSitzung } from '../app/sitzung';
import { Geladen, Seite } from '../components/Seite';
import { Plakette, type Ton } from '../components/Bausteine';
import { Stundendetails } from '../components/plan/Stundendetails';
import { gueltigeFarbe, statusText } from '../components/plan/logik';
import { FachMarke } from '../components/plan/darstellung';
import { ausIso, datumKurz, heuteIso, jetztMinuten, minuten, montag, MONATE, plusTage, WOCHENTAGE, wochentagKurz } from '../lib/datum';
import { useLaden } from '../lib/useLaden';
import { KindWahl, kinderLaden, OHNE_ZUORDNUNG, type Kind } from './familie/kinder';
import { UpdateHinweis } from '../app/Update';

const MAX = 5;
const OHNE_AENDERUNG = ['regulaer', 'bereitschaft'];
const ENTFALL = ['entfall', 'abwesend'];
const tagKurz = (iso: string) => `${wochentagKurz(iso)} ${datumKurz(iso)}`;
const wtLang = (iso: string) => WOCHENTAGE[(ausIso(iso).getDay() + 6) % 7];
const tagRel = (iso: string, heute: string) => (iso === heute ? 'Heute' : iso === plusTage(heute, 1) ? 'Morgen' : tagKurz(iso));
const tagTitel = (iso: string, heute: string) => `${iso === heute ? 'Heute · ' : iso === plusTage(heute, 1) ? 'Morgen · ' : ''}${wtLang(iso)} ${datumKurz(iso)}`;
const datumVoll = (iso: string) => { const d = ausIso(iso); return `${wtLang(iso)}, ${d.getDate()}. ${MONATE[d.getMonth()]} ${d.getFullYear()}`; };
const stdText = (v: number, b: number) => (v === b ? `${v}.` : `${v}.–${b}.`);
const anzahl = (n: number) => (n > 99 ? '99+' : String(n));
const gruss = () => { const h = new Date().getHours(); return h < 11 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend'; };
const chipTon = (k: Karte): Ton => (ENTFALL.includes(k.status) ? 'entfall' : k.status === 'klausur' ? 'pruefung' : k.status === 'offen' || k.vertretungOffen ? 'pruefung' : k.status === 'veranstaltung' || k.status === 'buchung' ? 'termin' : 'aenderung');

function ferienAb(tage: Tageskopf[], heute: string) {
  const t = tage.find(x => x.frei && x.datum >= heute && ['ferien', 'feiertag', 'frei'].includes(x.freiArt ?? ''));
  if (!t) return null;
  const von = t.freiVon || t.datum, bis = t.freiBis || von;
  const name = t.freiGrund || ({ ferien: 'Ferien', feiertag: 'Feiertag' } as Record<string, string>)[t.freiArt ?? ''] || 'Unterrichtsfrei';
  const laeuft = von <= heute;
  return { text: laeuft ? `${name} bis ${tagKurz(bis)}` : von === bis ? `${name} am ${tagKurz(von)}` : `${name} ${tagKurz(von)} – ${tagKurz(bis)}`, laeuft, von, bis };
}

interface ZeileDaten { links?: ReactNode; titel: ReactNode; neben?: ReactNode; rechts?: ReactNode; farbe?: string | null; durch?: boolean; blass?: boolean; fett?: boolean; onClick?: () => void; href?: string }
interface GruppeDaten { titel: string; href?: string; zeilen: ZeileDaten[]; zahl?: number; leer?: string }

function Zeile({ z }: { z: ZeileDaten }) {
  const inhalt = (
    <Stack direction="row" alignItems="center" gap={1.25} sx={{ width: '100%', minHeight: 34, px: 1, borderRadius: '4px', opacity: z.blass ? 0.55 : 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: 78, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }} noWrap>{z.links}</Typography>
      {z.farbe !== undefined && <FachMarke farbe={z.farbe} />}
      <Box sx={{ minWidth: 0, flex: 1, display: 'flex', gap: 1, alignItems: 'baseline' }}>
        <Typography noWrap sx={{ fontSize: 14, fontWeight: z.fett ? 600 : 500, textDecoration: z.durch ? 'line-through' : 'none', flexShrink: 0, maxWidth: '60%' }}>{z.titel}</Typography>
        {z.neben && <Typography noWrap variant="body2" color="text.secondary" sx={{ minWidth: 0 }}>{z.neben}</Typography>}
      </Box>
      {z.rechts && <Box sx={{ flexShrink: 0, fontSize: 13, color: 'text.secondary', display: 'flex', gap: 0.5, alignItems: 'center' }}>{z.rechts}</Box>}
    </Stack>
  );
  if (z.href) return <ButtonBase component="a" href={z.href} sx={{ width: '100%', borderRadius: '4px', textAlign: 'left', color: 'inherit', '&:hover': { bgcolor: 'action.hover' } }}>{inhalt}</ButtonBase>;
  if (z.onClick) return <ButtonBase onClick={z.onClick} sx={{ width: '100%', borderRadius: '4px', textAlign: 'left', '&:hover': { bgcolor: 'action.hover' } }}>{inhalt}</ButtonBase>;
  return inhalt;
}

function UKarte({ symbol, titel, href, linkText, gruppen, vorne, leerSymbol }: { symbol: ReactNode; titel: string; href?: string; linkText?: string; gruppen: GruppeDaten[]; vorne?: ReactNode; leerSymbol?: ReactNode }) {
  const voll = gruppen.filter(g => g.zeilen.length);
  const leer = gruppen.filter(g => !g.zeilen.length && g.leer).map(g => g.leer!);
  return (
    <Paper variant="outlined" component="section" aria-label={titel} sx={{ p: 2, pt: 0, display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%', overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mx: -2, px: 2, py: 1.1, minHeight: 44, bgcolor: 'flaechen.band', borderBottom: 1, borderColor: 'divider', '& svg': { fontSize: 20 } }}>
        <Box sx={{ color: 'primary.main', display: 'flex' }}>{symbol}</Box>
        <Typography variant="h3" component="h2" sx={{ flex: 1 }}>{titel}</Typography>
        {href && <Link href={href} underline="hover" sx={{ display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 500 }}>{linkText ?? 'Öffnen'}<ChevronRightRounded fontSize="small" /></Link>}
      </Stack>
      {vorne}
      {voll.map(g => (
        <Box key={g.titel}>
          <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 0.25, px: 1 }}>
            <Typography variant="overline" sx={{ color: 'text.secondary', lineHeight: 2 }}>{g.href ? <Link href={g.href} color="inherit" underline="hover">{g.titel}</Link> : g.titel}</Typography>
            {(g.zahl ?? g.zeilen.length) > 0 && <Plakette>{anzahl(g.zahl ?? g.zeilen.length)}</Plakette>}
            <Box sx={{ flex: 1 }} />
            {g.zeilen.length > MAX && g.href && <Link href={g.href} underline="hover" sx={{ fontSize: 12.5 }}>Alle anzeigen ({anzahl(g.zeilen.length)})</Link>}
          </Stack>
          {g.zeilen.slice(0, MAX).map((z, i) => <Zeile key={i} z={z} />)}
        </Box>
      ))}
      {leer.length > 0 && (
        <Stack direction="row" gap={1} alignItems="center" sx={{ color: 'text.secondary', bgcolor: 'action.hover', borderRadius: 2, px: 1.5, py: 1, fontSize: 13.5 }}>
          {leerSymbol ?? <CheckRounded fontSize="small" />}<span>{leer.map((x, i) => (i ? x.charAt(0).toLowerCase() + x.slice(1) : x)).join(' · ')}</span>
        </Stack>
      )}
    </Paper>
  );
}

interface Daten {
  kind: Kind | null; kinder: Kind[]; typ: string; element: string; plaene: Wochenplan[]; pruefungen: { datum: string; titel: string; klassen: string[]; stundeVon: number; stundeBis: number; raeume?: string[]; status: string }[];
  hausaufgaben: { fach: string; hausaufgabe: string; faellig?: string; datum?: string; klassen?: string[] }[]; offen: { datum: string; fach: string; klassen: string[]; von: number; bis: number }[];
  mitteilungen: { id: number; absender: string; betreff: string; erstellt: string; gelesen?: string | null; wichtig: boolean }[];
  abwesenheiten: { vonDatum: string; bisDatum?: string; vonZeit?: string; bisZeit?: string; schueler?: string; klasse?: string; art?: string; minuten?: number; statusGemischt?: boolean }[];
  infos: { titel: string; datum: string; gelesen: boolean; wichtig?: boolean; art: string }[];
  sprechtage: { id: number; name: string; datum?: string; text?: string }[];
}

export default function Uebersicht() {
  const { ich } = useSitzung();
  const t = useTheme();
  const familie = istFamilie(ich);
  const kollegium = !!ich.kollegium;
  const [details, setDetails] = useState<{ k: Karte; liste: Karte[] } | null>(null);
  const [neuZaehler, setNeu] = useState(0);
  const heute = heuteIso();
  const mo = montag(heute);
  const g = useLaden<Daten | null>(async sig => {
    let kinder: Kind[] = [], kind: Kind | null = null;
    if (familie) { ({ liste: kinder, kind } = await kinderLaden()); if (!kind) return null; }
    const typ = familie ? 'klasse' : ich.typ || '';
    const element = familie ? kind!.klasse : ich.element;
    const filter = !element ? '' : typ === 'klasse' ? `&klasse=${encodeURIComponent(element)}` : `&lehrer=${encodeURIComponent(element)}`;
    const leer = { karten: [], tage: [], aufsichten: [] } as unknown as Wochenplan;
    const plan = (d: string) => (element ? holen<Wochenplan>(`/api/app/plan?typ=${typ}&element=${encodeURIComponent(element)}&datum=${d}`, sig).catch(() => leer) : Promise.resolve(leer));
    const fehlzeiten = kollegium && ich.fehlzeiten;
    const [w1, w2, pruefungen, hausaufgaben, offen, mitteilungen, abwesenheiten, info, fam, sprechtage] = await Promise.all([
      plan(mo), plan(plusTage(mo, 7)),
      holen<Daten['pruefungen']>(`/api/app/pruefungen?von=${heute}&bis=${plusTage(heute, 28)}${filter}`, sig).catch(() => []),
      familie || !element ? Promise.resolve([]) : holen<Daten['hausaufgaben']>(`/api/app/hausaufgaben?von=${plusTage(heute, -7)}&bis=${plusTage(heute, 28)}${filter}`, sig).catch(() => []),
      kollegium && element ? holen<Daten['offen']>('/api/app/klassenbuch/offen', sig).catch(() => []) : Promise.resolve([]),
      holen<Daten['mitteilungen']>('/api/app/mitteilungen?ordner=eingang', sig).catch(() => []),
      fehlzeiten ? holen<Daten['abwesenheiten']>(`/api/app/abwesenheiten/zeitraeume?von=${plusTage(heute, -30)}&bis=${heute}&status=offen`, sig).catch(() => []) : Promise.resolve([]),
      holen<{ eintraege?: Daten['infos'] }>('/api/app/infocenter', sig).catch(() => ({ eintraege: [] })),
      familie ? holen<{ offeneAbwesenheiten?: Daten['abwesenheiten']; hausaufgaben?: { fach: string; text: string; faellig: string }[] }>(`/api/app/familie/uebersicht?schueler=${kind!.id}`, sig).catch(() => ({ offeneAbwesenheiten: [], hausaufgaben: [] })) : Promise.resolve(null),
      holen<Daten['sprechtage']>('/api/app/sprechtag/start', sig).catch(() => []),
    ]);
    const plaene = [w1, w2];
    const tage0 = [...(w1.tage ?? []), ...(w2.tage ?? [])].sort((a, b) => a.datum.localeCompare(b.datum));
    const fv = element ? ferienAb(tage0, heute) : null;
    if (fv && fv.bis >= plusTage(mo, 13) && ![...(w1.karten ?? []), ...(w2.karten ?? [])].some(k => k.datum >= heute)) plaene.push(await plan(montag(plusTage(fv.bis, 3))));
    return {
      kind, kinder, typ, element, plaene, pruefungen,
      hausaufgaben: familie ? (fam?.hausaufgaben ?? []).map(h => ({ fach: h.fach, hausaufgabe: h.text, faellig: h.faellig, klassen: [] })) : hausaufgaben.filter(h => (h.faellig ?? h.datum ?? '') >= heute).sort((a, b) => (a.faellig ?? a.datum ?? '').localeCompare(b.faellig ?? b.datum ?? '')),
      offen, mitteilungen, abwesenheiten: familie ? fam?.offeneAbwesenheiten ?? [] : abwesenheiten, infos: (info.eintraege ?? []).filter(x => x.art === 'info'), sprechtage,
    };
  }, [neuZaehler]);

  return (
    <Seite titel="" dokumentTitel="Start">
      <UpdateHinweis />
      <Geladen g={g}>{d => {
        if (!d) return <Typography color="text.secondary">{OHNE_ZUORDNUNG}</Typography>;
        const { typ, element, kind } = d;
        const alleKarten = d.plaene.flatMap(p => p.karten ?? []);
        const alleTage = d.plaene.flatMap(p => p.tage ?? []).sort((a, b) => a.datum.localeCompare(b.datum));
        const kartenAm = (x: string) => alleKarten.filter(k => k.datum === x).sort((a, b) => a.von - b.von);
        const unterrichtstage = alleTage.filter(x => x.datum >= heute && !x.frei && kartenAm(x.datum).length).slice(0, 2).map(x => x.datum);
        const zweiWochen = [...(d.plaene[0].karten ?? []), ...(d.plaene[1].karten ?? [])];
        const aenderungen = zweiWochen.filter(k => k.datum >= heute && !OHNE_AENDERUNG.includes(k.status)).sort((a, b) => a.datum.localeCompare(b.datum) || a.von - b.von);
        const weitere = aenderungen.filter(k => !unterrichtstage.includes(k.datum));
        const ferien = element ? ferienAb(alleTage, heute) : null;
        const gesperrt = d.plaene.slice(0, 2).some(p => p.gesperrt) && !alleKarten.length;
        const aufsichten = d.plaene.slice(0, 2).flatMap(p => p.aufsichten ?? []).filter(a => a.datum >= heute && a.datum <= plusTage(heute, 6) && a.status !== 'vertreten' && a.status !== 'entfall')
          .sort((a, b) => a.datum.localeCompare(b.datum) || a.nachStunde - b.nachStunde);
        const ungelesen = d.mitteilungen.filter(m => !m.gelesen);
        const infosNeu = d.infos.filter(x => !x.gelesen);
        const zeigeAbw = (kollegium && ich.fehlzeiten) || familie;
        const jetzt = jetztMinuten();

        // Tageszeile
        const name = familie ? (ich.rolle === 'eltern' ? ich.anzeigename || '' : kind!.vorname) : ich.anzeigename || ich.login || '';
        const teile: ReactNode[] = [datumVoll(heute)];
        if (familie && ich.rolle === 'eltern' && d.kinder.length < 2) teile.push(<><b>{kind!.vorname} {kind!.name}</b> · Klasse {kind!.klasse}</>);
        if (element && !gesperrt) {
          const heuteStunden = kartenAm(heute).filter(k => !ENTFALL.includes(k.status));
          const naechste = heuteStunden.find(k => k.ende && minuten(k.ende) > jetzt);
          const folgetag = unterrichtstage.find(x => x > heute);
          const ab = (x: string) => { const k = kartenAm(x).find(y => !ENTFALL.includes(y.status)); return k?.beginn ? ` ab ${k.beginn}` : ''; };
          if (naechste) {
            const laeuft = naechste.beginn && minuten(naechste.beginn) <= jetzt;
            const was = [naechste.fach || naechste.text || naechste.art, ...(typ !== 'klasse' ? (naechste.klassen ?? []).map(x => x.k) : []), ...(naechste.raeume ?? []).map(x => x.k)].filter(Boolean).join(' · ');
            teile.push(<>{laeuft ? 'Jetzt' : 'Als Nächstes'} <b>{naechste.beginn || `${stdText(naechste.von, naechste.bis)} Std.`}</b> {was}</>);
          } else if (heuteStunden.length) teile.push(`Unterricht für heute beendet${folgetag ? ` · ${tagRel(folgetag, heute)}${ab(folgetag)}` : ''}`);
          else teile.push(<><b>Heute kein Unterricht</b>{folgetag ? ` · nächster Unterricht ${tagRel(folgetag, heute)}${ab(folgetag)}` : ''}</>);
        }
        const ferienPille = !!ferien && (ferien.laeuft || ferien.von <= plusTage(heute, 14));

        // Kennzahlen
        const zahlen: { zahl: number; titel: string; href: string }[] = [];
        if (kollegium && element) zahlen.push({ zahl: d.offen.length, titel: 'Offene Klassenbuch-Einträge', href: '#/offen' });
        if (zeigeAbw) zahlen.push({ zahl: d.abwesenheiten.length, titel: 'Offene Abwesenheiten', href: '#/abwesenheiten' });
        if (element && !kollegium) zahlen.push({ zahl: aenderungen.length, titel: 'Änderungen', href: '#/plan/mein' });
        if (familie) zahlen.push({ zahl: d.hausaufgaben.length, titel: 'Hausaufgaben', href: '#/hausaufgaben' });
        zahlen.push({ zahl: d.pruefungen.length, titel: 'Prüfungen', href: '#/pruefungen' });
        if (!element) zahlen.push({ zahl: infosNeu.length, titel: 'Neue Infos', href: '#/neuigkeiten/infos' });
        zahlen.push({ zahl: ungelesen.length, titel: 'Ungelesene Mitteilungen', href: '#/mitteilungen' });

        // Karten
        const karten: ReactNode[] = [];
        if (element) {
          const stundeZeile = (k: Karte, mitTag: boolean, liste: Karte[]): ZeileDaten => {
            const entfall = ENTFALL.includes(k.status);
            const neben = [mitTag ? `${stdText(k.von, k.bis)} Std.` : '', ...(typ !== 'klasse' ? (k.klassen ?? []).map(x => (x.alt && entfall ? x.alt : x.k || x.alt)) : []),
              ...(k.raeume ?? []).map(x => x.k || x.alt), k.fach && k.text && !OHNE_AENDERUNG.includes(k.status) ? k.text : ''].filter(Boolean).join(' · ');
            return {
              links: mitTag ? tagKurz(k.datum) : k.beginn || `${stdText(k.von, k.bis)} Std.`, titel: k.fach || k.text || k.art || '–', neben,
              rechts: !OHNE_AENDERUNG.includes(k.status) ? <Plakette ton={chipTon(k)}>{statusText(k)}</Plakette> : null,
              farbe: gueltigeFarbe(k.farbe) ?? alpha(t.palette.primary.main, 0.35), durch: entfall,
              blass: !mitTag && k.datum === heute && !!k.ende && minuten(k.ende) <= jetzt, onClick: () => setDetails({ k, liste }),
            };
          };
          const gruppen: GruppeDaten[] = unterrichtstage.map(x => {
            const l = kartenAm(x);
            return { titel: tagTitel(x, heute), href: '#/plan/mein', zeilen: l.map(k => stundeZeile(k, false, l)), zahl: l.filter(k => !ENTFALL.includes(k.status)).length };
          });
          gruppen.push({ titel: 'Weitere Änderungen', href: kollegium ? '#/vertretungen' : '#/plan/mein', zeilen: weitere.map(k => stundeZeile(k, true, weitere)) });
          if (!unterrichtstage.length) gruppen.unshift({ titel: 'leer', zeilen: [], leer: gesperrt ? 'Die Anzeige des Stundenplans ist beschränkt' : ferien?.laeuft ? undefined : 'Kein Unterricht in den nächsten Tagen' });
          const ferienVorne = !!ferien && (!unterrichtstage.length || unterrichtstage[0] > ferien.bis);
          karten.push(<UKarte key="heute" symbol={<CalendarMonthOutlined />} titel="Heute & nächste Tage" href="#/plan/mein" linkText="Stundenplan" gruppen={gruppen} leerSymbol={gesperrt ? <LockOutlined fontSize="small" /> : undefined}
            vorne={ferien && ferienVorne ? <Stack direction="row" gap={1} alignItems="center" sx={{ bgcolor: t.palette.status.frei.flaeche, borderRadius: 2, px: 1.5, py: 1, fontSize: 14 }}><WbSunnyOutlined fontSize="small" />{ferien.text}</Stack> : null} />);
        }
        const erledigen: GruppeDaten[] = [];
        if (kollegium && element) erledigen.push({ titel: 'Klassenbuch · Lehrstoff fehlt', href: '#/offen', leer: 'Klassenbuch vollständig',
          zeilen: d.offen.slice().reverse().map(o => ({ links: tagKurz(o.datum), titel: o.fach, neben: (o.klassen || []).join(', '), rechts: `${stdText(o.von, o.bis)} Std.`, href: '#/offen' })) });
        if (zeigeAbw) erledigen.push({ titel: 'Offene Abwesenheiten', href: '#/abwesenheiten', leer: 'Keine offenen Abwesenheiten',
          zeilen: d.abwesenheiten.map(z => familie ? {
            links: tagKurz(z.vonDatum), titel: z.art === 'verspaetet' ? 'Verspätet' : z.art === 'vorzeitig' ? 'Vorzeitig gegangen' : 'Abwesend',
            neben: z.bisDatum && z.bisDatum !== z.vonDatum ? `bis ${tagKurz(z.bisDatum)}` : z.art === 'verspaetet' ? `${z.minuten} min (${z.vonZeit}–${z.bisZeit})` : z.art === 'vorzeitig' ? `ab ${z.vonZeit}` : z.vonZeit && z.bisZeit ? `${z.vonZeit}–${z.bisZeit}` : z.vonZeit ? `ab ${z.vonZeit}` : 'ganztägig',
            rechts: <Plakette ton="pruefung">{z.statusGemischt ? 'teilweise entschuldigt' : 'offen'}</Plakette>, href: '#/abwesenheiten',
          } : { links: tagKurz(z.vonDatum), titel: z.schueler ?? '', neben: z.klasse, rechts: z.bisDatum && z.bisDatum !== z.vonDatum ? `bis ${datumKurz(z.bisDatum)}` : z.vonZeit && z.bisZeit ? `${z.vonZeit}–${z.bisZeit}` : '', href: '#/abwesenheiten' }) });
        if (element) erledigen.push({ titel: familie ? 'Hausaufgaben' : 'Hausaufgaben · fällig', href: '#/hausaufgaben', leer: 'Keine Hausaufgaben',
          zeilen: d.hausaufgaben.map(h => ({ links: h.faellig ? tagKurz(h.faellig) : '', titel: h.fach, neben: h.hausaufgabe, rechts: !familie && h.klassen?.length ? h.klassen.join(', ') : '', fett: !!h.faellig && h.faellig <= plusTage(heute, 1) })) });
        if (erledigen.length) karten.push(<UKarte key="erl" symbol={<TaskAltRounded />} titel="Zu erledigen" gruppen={erledigen} />);
        const termine: GruppeDaten[] = [{ titel: 'Prüfungen · 4 Wochen', href: '#/pruefungen', leer: 'Keine Prüfungen',
          zeilen: d.pruefungen.map(p => ({ links: tagKurz(p.datum), titel: p.titel, neben: (p.klassen ?? []).join(', '), rechts: <>{stdText(p.stundeVon, p.stundeBis)} Std.{p.raeume?.length ? ` · ${p.raeume.join(', ')}` : ''}{p.status === 'vorgemerkt' && <Plakette>vorgemerkt</Plakette>}</> })) }];
        if (kollegium && element) termine.push({ titel: 'Aufsichten · 7 Tage', href: '#/plan/mein', leer: 'Keine Aufsichten',
          zeilen: aufsichten.map(a => ({ links: tagKurz(a.datum), titel: a.gangName || a.gang, rechts: <>{a.beginn}–{a.ende}{a.status === 'vertretung' && <Plakette ton="aenderung">Vertretung</Plakette>}</> })) });
        termine.push({ titel: 'Elternsprechtag', href: '#/sprechtag', zeilen: d.sprechtage.map(s => ({ links: s.datum ? tagKurz(s.datum) : '', titel: s.name, neben: s.text, href: `#/sprechtag/${s.id}` })) });
        karten.push(<UKarte key="term" symbol={<EventOutlined />} titel="Termine" gruppen={termine} />);
        const sortiert = [...ungelesen, ...d.mitteilungen.filter(m => m.gelesen)];
        karten.push(<UKarte key="mt" symbol={<MailOutline />} titel="Mitteilungen & Infos" href="#/mitteilungen" linkText="Posteingang" gruppen={[
          { titel: 'Mitteilungen', href: '#/mitteilungen', zahl: ungelesen.length, leer: 'Keine Mitteilungen',
            zeilen: sortiert.map(m => ({ links: m.erstellt ? tagKurz(m.erstellt.slice(0, 10)) : '', titel: <>{!m.gelesen && <Box component="span" sx={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', bgcolor: 'primary.main', mr: 0.75, verticalAlign: 'middle' }} />}{m.absender}</>,
              neben: m.betreff || '(ohne Betreff)', rechts: m.wichtig ? <Plakette ton="entfall">wichtig</Plakette> : null, fett: !m.gelesen, href: `#/mitteilungen/eingang/${m.id}` })) },
          { titel: 'Infos der Schule', href: '#/neuigkeiten/infos', zahl: infosNeu.length, leer: 'Keine Infos der Schule',
            zeilen: d.infos.map(x => ({ links: x.datum ? tagKurz(String(x.datum).slice(0, 10)) : '', titel: x.titel, rechts: x.wichtig ? <Plakette ton="entfall">wichtig</Plakette> : null, fett: !x.gelesen, href: '#/neuigkeiten/infos' })) },
        ]} />);

        return (
          <Stack gap={2.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems={{ sm: 'flex-end' }} sx={{ pb: 1.5, borderBottom: '1px solid', borderColor: 'flaechen.rand' }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h1">{gruss()}{name ? `, ${name}` : ''}</Typography>
                <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center" sx={{ mt: 0.75, color: 'text.secondary', fontSize: 14.5 }}>
                  {teile.map((x, i) => <Box component="span" key={i} sx={{ display: 'flex', gap: 1 }}>{i > 0 && <span aria-hidden>·</span>}<span>{x}</span></Box>)}
                  {ferienPille && <Plakette ton="frei" sx={{ ml: 0.5 }}><WbSunnyOutlined sx={{ fontSize: 14 }} />{ferien!.text}</Plakette>}
                </Stack>
              </Box>
              {familie && kind && <KindWahl liste={d.kinder} kind={kind} onWahl={() => setNeu(n => n + 1)} />}
            </Stack>
            <Box component="nav" aria-label="Kennzahlen" sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: `repeat(${zahlen.length}, minmax(0, 1fr))` }, gap: 1.25 }}>
              {zahlen.map(z => (
                <Paper key={z.titel} variant="outlined" component="a" href={z.href} sx={{ p: 1.75, textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 0.25, transition: 'box-shadow .12s, border-color .12s',
                  '&:hover': { borderColor: 'primary.main', boxShadow: '0 4px 14px rgba(21,26,33,.06)' } }}>
                  <Typography sx={{ fontSize: 26, fontWeight: 600, lineHeight: 1.1, color: z.zahl > 0 ? 'primary.main' : 'text.disabled', fontVariantNumeric: 'tabular-nums' }}>{anzahl(z.zahl)}</Typography>
                  <Typography variant="body2" color="text.secondary">{z.titel}</Typography>
                </Paper>
              ))}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 2, '& > :last-child': karten.length % 2 ? { gridColumn: { lg: '1 / -1' } } : {} }}>{karten}</Box>
            {details && <Stundendetails karte={details.k} liste={details.liste} typ={typ as 'lehrer'} onClose={() => setDetails(null)} onGeaendert={() => void g.neu()} />}
          </Stack>
        );
      }}</Geladen>
    </Seite>
  );
}
