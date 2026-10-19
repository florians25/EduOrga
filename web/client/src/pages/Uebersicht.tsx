// Übersicht für alle Rollen: Seitentitel „Start“ mit Tageszeile (Datum, nächste Stunde bzw. „Heute kein Unterricht“, Ferienhinweis als Text)
// und ein Raster aus vier Bereichen mit schlichter Kopfzeile (keine Begrüßung, keine Kennzahl-Kacheln, keine Symbole) – „Heute & nächste Tage“ (Stunden mit Änderungen), „Zu erledigen“
// (Klassenbuch, offene Abwesenheiten, Hausaufgaben), „Termine“ (Prüfungen, Aufsichten, Sprechtag) und „Mitteilungen & Infos“.
// Jede Gruppe zeigt höchstens fünf Zeilen („Alle anzeigen“); leere Gruppen werden in einer Textzeile zusammengefasst.
import { Fragment, useState, type ReactNode } from 'react';
import { alpha, Box, ButtonBase, Link, Paper, Stack, Typography, useTheme } from '@mui/material';
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
    <Stack direction="row" alignItems="center" gap={1} sx={{ width: '100%', minHeight: 34, px: 1, borderRadius: '4px', opacity: z.blass ? 0.55 : 1 }}>
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

function UKarte({ titel, href, linkText, gruppen, vorne }: { titel: string; href?: string; linkText?: string; gruppen: GruppeDaten[]; vorne?: ReactNode }) {
  const voll = gruppen.filter(g => g.zeilen.length);
  const leer = gruppen.filter(g => !g.zeilen.length && g.leer).map(g => g.leer!);
  return (
    <Paper variant="outlined" component="section" aria-label={titel} sx={{ px: 1, pb: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%', overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mx: -1, px: 2, py: 1, minHeight: 40, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h3" component="h2" sx={{ flex: 1 }}>{titel}</Typography>
        {href && <Link href={href} underline="hover" sx={{ fontSize: 13 }}>{linkText ?? 'Öffnen'}</Link>}
      </Stack>
      {vorne}
      {voll.map(g => (
        <Box key={g.titel}>
          <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 0.25, px: 1 }}>
            <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 600, lineHeight: 2 }}>{g.href ? <Link href={g.href} color="inherit" underline="hover">{g.titel}</Link> : g.titel}</Typography>
            {(g.zahl ?? g.zeilen.length) > 0 && <Typography component="span" variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>{anzahl(g.zahl ?? g.zeilen.length)}</Typography>}
            <Box sx={{ flex: 1 }} />
            {g.zeilen.length > MAX && g.href && <Link href={g.href} underline="hover" sx={{ fontSize: 12.5 }}>Alle anzeigen ({anzahl(g.zeilen.length)})</Link>}
          </Stack>
          {g.zeilen.slice(0, MAX).map((z, i) => <Zeile key={i} z={z} />)}
        </Box>
      ))}
      {leer.length > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>{leer.map((x, i) => (i ? x.charAt(0).toLowerCase() + x.slice(1) : x)).join(' · ')}</Typography>
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
          karten.push(<UKarte key="heute" titel="Heute & nächste Tage" href="#/plan/mein" linkText="Stundenplan" gruppen={gruppen}
            vorne={ferien && ferienVorne ? <Typography variant="body2" sx={{ px: 1, color: 'status.frei.main', fontWeight: 500 }}>{ferien.text}</Typography> : null} />);
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
        if (erledigen.length) karten.push(<UKarte key="erl" titel="Zu erledigen" gruppen={erledigen} />);
        const termine: GruppeDaten[] = [{ titel: 'Prüfungen · 4 Wochen', href: '#/pruefungen', leer: 'Keine Prüfungen',
          zeilen: d.pruefungen.map(p => ({ links: tagKurz(p.datum), titel: p.titel, neben: (p.klassen ?? []).join(', '), rechts: <>{stdText(p.stundeVon, p.stundeBis)} Std.{p.raeume?.length ? ` · ${p.raeume.join(', ')}` : ''}{p.status === 'vorgemerkt' && <Plakette>vorgemerkt</Plakette>}</> })) }];
        if (kollegium && element) termine.push({ titel: 'Aufsichten · 7 Tage', href: '#/plan/mein', leer: 'Keine Aufsichten',
          zeilen: aufsichten.map(a => ({ links: tagKurz(a.datum), titel: a.gangName || a.gang, rechts: <>{a.beginn}–{a.ende}{a.status === 'vertretung' && <Plakette ton="aenderung">Vertretung</Plakette>}</> })) });
        termine.push({ titel: 'Elternsprechtag', href: '#/sprechtag', zeilen: d.sprechtage.map(s => ({ links: s.datum ? tagKurz(s.datum) : '', titel: s.name, neben: s.text, href: `#/sprechtag/${s.id}` })) });
        karten.push(<UKarte key="term" titel="Termine" gruppen={termine} />);
        const sortiert = [...ungelesen, ...d.mitteilungen.filter(m => m.gelesen)];
        karten.push(<UKarte key="mt" titel="Mitteilungen & Infos" href="#/mitteilungen" linkText="Posteingang" gruppen={[
          { titel: 'Mitteilungen', href: '#/mitteilungen', zahl: ungelesen.length, leer: 'Keine Mitteilungen',
            zeilen: sortiert.map(m => ({ links: m.erstellt ? tagKurz(m.erstellt.slice(0, 10)) : '', titel: <>{!m.gelesen && <Box component="span" sx={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', bgcolor: 'primary.main', mr: 0.75, verticalAlign: 'middle' }} />}{m.absender}</>,
              neben: m.betreff || '(ohne Betreff)', rechts: m.wichtig ? <Plakette ton="entfall">wichtig</Plakette> : null, fett: !m.gelesen, href: `#/mitteilungen/eingang/${m.id}` })) },
          { titel: 'Infos der Schule', href: '#/neuigkeiten/infos', zahl: infosNeu.length, leer: 'Keine Infos der Schule',
            zeilen: d.infos.map(x => ({ links: x.datum ? tagKurz(String(x.datum).slice(0, 10)) : '', titel: x.titel, rechts: x.wichtig ? <Plakette ton="entfall">wichtig</Plakette> : null, fett: !x.gelesen, href: '#/neuigkeiten/infos' })) },
        ]} />);

        return (
          <Stack gap={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems={{ sm: 'flex-end' }} sx={{ pb: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h1">Start</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {teile.map((x, i) => <Fragment key={i}>{i > 0 && ' · '}{x}</Fragment>)}
                  {ferienPille && <> · <Box component="span" sx={{ color: 'status.frei.main' }}>{ferien!.text}</Box></>}
                </Typography>
              </Box>
              {familie && kind && <KindWahl liste={d.kinder} kind={kind} onWahl={() => setNeu(n => n + 1)} />}
            </Stack>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 2, '& > :last-child': karten.length % 2 ? { gridColumn: { lg: '1 / -1' } } : {} }}>{karten}</Box>
            {details && <Stundendetails karte={details.k} liste={details.liste} typ={typ as 'lehrer'} onClose={() => setDetails(null)} onGeaendert={() => void g.neu()} />}
          </Stack>
        );
      }}</Geladen>
    </Seite>
  );
}
