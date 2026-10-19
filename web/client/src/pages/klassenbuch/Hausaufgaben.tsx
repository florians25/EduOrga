// Hausaufgaben: Kollegium – Liste (Meine/Alle, Klasse, Zeitraum, Suche), Details und neue Hausaufgabe; Klassenkonten – nach Fälligkeit
// gruppiert mit Reiter „Lehrstoff“; Schüler*innen und Eltern – eigene Seite (FamilieHausaufgaben). Auch unter „Unterricht → Aufgaben“.
import { useState } from 'react';
import { Box, Button, Paper, Stack, Tab, Tabs, Typography } from '@mui/material';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import { holen, qs } from '../../api/client';
import { useSitzung } from '../../app/sitzung';
import { Geladen, Leer, Seite } from '../../components/Seite';
import { DatumKachel, Plakette, SuchFeld, Wahl } from '../../components/Bausteine';
import { DatumFeld } from '../../components/Auswahl';
import { Tabelle } from '../../components/Tabelle';
import { HausaufgabeDetails, HausaufgabeFormular, type Hausaufgabe } from '../../components/klassenbuch/Hausaufgabe';
import { datumDe, datumKurz, heuteIso, istIsoDatum, montag, plusTage } from '../../lib/datum';
import { navigieren } from '../../lib/router';
import { useLaden } from '../../lib/useLaden';
import FamilieHausaufgaben from '../familie/FamilieHausaufgaben';
import type { SeitenProps } from '../register';

const BEREICHE: Record<string, [string, (() => [string, string]) | null]> = {
  woche: ['Aktuelle Woche', () => [montag(heuteIso()), plusTage(montag(heuteIso()), 6)]],
  vier: ['Nächste 4 Wochen', () => [heuteIso(), plusTage(heuteIso(), 27)]],
  monat: ['Letzte 4 Wochen', () => [plusTage(heuteIso(), -27), heuteIso()]],
  jahr: ['Schuljahr', null],
};

function Liste({ bereichP, basis }: { bereichP?: string; basis: string }) {
  const { ich, schuljahr } = useSitzung();
  const bereich = BEREICHE[bereichP ?? ''] ? bereichP! : 'woche';
  const [von, bis] = bereich === 'jahr' ? [schuljahr?.von || heuteIso(), schuljahr?.bis || heuteIso()] : BEREICHE[bereich][1]!();
  const [wahl, setWahl] = useState(ich.element ? 'meine' : 'alle');
  const [klasse, setKlasse] = useState('');
  const [suche, setSuche] = useState('');
  const [dialog, setDialog] = useState<null | { art: 'neu' } | { art: 'details'; h: Hausaufgabe }>(null);
  const g = useLaden(() => holen<Hausaufgabe[]>(`/api/app/hausaufgaben/eintraege${qs({ von, bis, lehrer: wahl === 'meine' && ich.element ? ich.element : undefined })}`), [von, bis, wahl]);
  const klassen = [...new Set((g.daten ?? []).flatMap(h => h.klassen ?? []))].sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
  const heute = heuteIso();
  const l = (g.daten ?? []).filter(h => (!klasse || (h.klassen ?? []).includes(klasse)) && (!suche || `${h.fach} ${h.lehrer} ${h.text} ${h.bemerkung} ${(h.klassen ?? []).join(' ')}`.toLowerCase().includes(suche.toLowerCase())));
  return (
    <Seite titel={basis === '#/aufgaben' ? 'Aufgaben' : 'Hausaufgaben'} untertitel={`${datumDe(von)} – ${datumDe(bis)} · ${l.length} ${l.length === 1 ? 'Hausaufgabe' : 'Hausaufgaben'}`}
      aktionen={ich.element ? <Button variant="contained" onClick={() => setDialog({ art: 'neu' })}>Neue Hausaufgabe</Button> : undefined}
      filter={<>
        <SuchFeld wert={suche} onWert={setSuche} platzhalter="Hausaufgaben durchsuchen" />
        {ich.element && <Wahl label="Auswahl" wert={wahl} onWert={setWahl} optionen={[['meine', 'Meine'], ['alle', 'Alle']]} breite={130} />}
        <Wahl label="Klasse" wert={klasse} onWert={setKlasse} optionen={klassen.map(k => [k, k])} alle="Alle Klassen" breite={150} />
        <Box sx={{ flex: 1 }} />
        <Wahl label="Zeitraum" wert={bereich} onWert={b => navigieren(`${basis}/${b}`)} optionen={Object.entries(BEREICHE).map(([k, [t]]) => [k, t])} breite={190} />
      </>}>
      <Geladen g={g}>{() => (
        <Tabelle zeilen={l} schluessel={h => h.id} onZeile={h => setDialog({ art: 'details', h })} leer={suche || klasse ? 'Keine Hausaufgabe passt zur Suche.' : 'Keine Hausaufgaben im Zeitraum.'}
          zeilenSx={h => (h.erledigt ? { opacity: 0.6 } : {})}
          spalten={[
            { id: 'datum', kopf: 'Aufgabedatum', zelle: h => datumDe(h.datum), sortWert: h => h.datum, nowrap: true },
            { id: 'faellig', kopf: 'Fällig', zelle: h => <Box component="span" sx={{ color: h.faellig && h.faellig < heute && !h.erledigt ? 'status.entfall.main' : undefined, fontWeight: 500 }}>{datumDe(h.faellig)}</Box>, sortWert: h => h.faellig ?? '', nowrap: true },
            { id: 'fach', kopf: 'Fach', zelle: h => <b>{h.fach}</b>, sortWert: h => h.fach ?? '' },
            { id: 'klasse', kopf: 'Klasse', zelle: h => (h.klassen ?? []).join(', ') },
            { id: 'lehrer', kopf: 'Erstellt von', zelle: h => h.lehrer, verbergenMobil: true },
            { id: 'text', kopf: 'Hausaufgabe', zelle: h => <Typography variant="body2" sx={{ maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={h.text}>{h.text}</Typography> },
            { id: 'st', kopf: '', zelle: h => (h.erledigt ? <CheckCircleRounded sx={{ color: 'status.ok.main', fontSize: 18 }} aria-label="Erledigt" /> : null), breite: 32 },
          ]} />
      )}</Geladen>
      {dialog?.art === 'neu' && <HausaufgabeFormular lehrer={ich.element} onClose={() => setDialog(null)} geaendert={() => void g.neu()} />}
      {dialog?.art === 'details' && <HausaufgabeDetails h={dialog.h} darf={!!dialog.h.darf} onClose={() => setDialog(null)} geaendert={() => void g.neu()} />}
    </Seite>
  );
}

interface HaZeile { fach: string; klassen: string[]; lehrer: string; hausaufgabe: string; datum: string; stunde: number; faellig?: string | null }
interface Lehrstoff { datum: string; stunde: number; fach: string; lehrer: string; thema: string; notizSchueler?: string }

/** Klassenkonten bzw. Filteransicht mit Zeitraum: Hausaufgaben nach Fälligkeit, Reiter „Lehrstoff“ (Klassenkonten). */
function Gefiltert({ teile }: { teile: string[] }) {
  const { ich, elemente } = useSitzung();
  const [rP, vP, bP, kP, lP] = teile;
  const reiter = rP === 'lehrstoff' ? 'lehrstoff' : 'offen';
  const von = istIsoDatum(vP) ? vP : plusTage(heuteIso(), -7);
  const bis = istIsoDatum(bP) ? bP : plusTage(heuteIso(), 28);
  const klasse = ich.kollegium ? (kP && kP !== '-' ? kP : '') : ich.element;
  const lehrer = ich.kollegium ? (lP && lP !== '-' ? lP : (!kP && ich.element ? ich.element : '')) : '';
  const ziel = (r: string, v: string, b: string, k = klasse, l = lehrer) => `#/hausaufgaben/${r}/${v}/${b}/${encodeURIComponent(k || '-')}/${encodeURIComponent(l || '-')}`;
  const g = useLaden(async () => {
    const el = await elemente();
    if (reiter === 'lehrstoff') return { el, ha: [] as HaZeile[], ls: (await holen<Lehrstoff[]>(`/api/app/klassenbuch/klasse${qs({ klasse, von, bis })}`)).filter(x => x.thema) };
    return { el, ha: await holen<HaZeile[]>(`/api/app/hausaufgaben${qs({ von, bis, klasse, lehrer })}`), ls: [] as Lehrstoff[] };
  }, [reiter, von, bis, klasse, lehrer]);
  const heute = heuteIso();
  return (
    <Seite titel="Hausaufgaben" aktionen={<Button variant="outlined" onClick={() => window.print()}>Drucken</Button>}
      filter={<>
        <DatumFeld label="Von" wert={von} onWert={v => v && navigieren(ziel(reiter, v, bis))} pflicht />
        <DatumFeld label="Bis" wert={bis} onWert={b => b && navigieren(ziel(reiter, von, b))} pflicht />
        {ich.kollegium && g.daten && <>
          <Wahl label="Klasse" wert={klasse} onWert={k => navigieren(ziel(reiter, von, bis, k))} optionen={g.daten.el.klassen.map(k => [k.kurz, k.kurz])} alle="alle" breite={140} />
          <Wahl label="Lehrkraft" wert={lehrer} onWert={l => navigieren(ziel(reiter, von, bis, klasse, l))} optionen={g.daten.el.lehrer.map(l => [l.kurz, l.kurz])} alle="alle" breite={140} />
        </>}
      </>}>
      {!ich.kollegium && <Tabs value={reiter} onChange={(_, v) => navigieren(ziel(v, von, bis))} sx={{ mb: 2 }}><Tab value="offen" label="Hausaufgaben" /><Tab value="lehrstoff" label="Lehrstoff" /></Tabs>}
      <Geladen g={g}>{d => {
        if (reiter === 'lehrstoff') return d.ls.length ? (
          <Paper variant="outlined" sx={{ borderRadius: 1.5 }}>{d.ls.map((x, i) => (
            <Stack key={i} direction="row" gap={2} sx={{ p: 2, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}>
              <DatumKachel datum={x.datum} />
              <Box><Typography sx={{ fontWeight: 600 }}>{x.fach} <Typography component="span" color="text.secondary">· {x.stunde}. Std. · {x.lehrer}</Typography></Typography><Typography>{x.thema}</Typography>
                {x.notizSchueler && <Typography variant="body2" color="text.secondary">{x.notizSchueler}</Typography>}</Box>
            </Stack>))}</Paper>
        ) : <Leer text="Kein Lehrstoff im Zeitraum." />;
        const gruppen = new Map<string, HaZeile[]>();
        for (const h of d.ha) { const s = h.faellig ?? h.datum; gruppen.set(s, [...(gruppen.get(s) ?? []), h]); }
        return d.ha.length ? (
          <Paper variant="outlined" sx={{ borderRadius: 1.5 }}>
            {[...gruppen.entries()].map(([datum, hs]) => (
              <Stack key={datum} direction="row" gap={2} sx={{ p: 2, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 }, opacity: datum < heute ? 0.7 : 1 }}>
                <DatumKachel datum={datum} />
                <Stack gap={1.25} sx={{ flex: 1 }}>{hs.map((h, i) => (
                  <Box key={i}><Typography sx={{ fontWeight: 600 }}>{h.fach} <Typography component="span" color="text.secondary">· {h.klassen.join(', ')} · {h.lehrer}</Typography></Typography>
                    <Typography>{h.hausaufgabe}</Typography><Typography variant="caption" color="text.secondary">erteilt am {datumKurz(h.datum)} ({h.stunde}. Std.){h.faellig ? '' : ' · ohne Fälligkeit'}</Typography></Box>))}</Stack>
                <Box><Plakette ton={datum < heute ? 'neutral' : datum <= plusTage(heute, 1) ? 'pruefung' : 'primaer'}>{datum < heute ? 'fällig gewesen' : 'fällig'}</Plakette></Box>
              </Stack>
            ))}
          </Paper>
        ) : <Leer text="Keine Hausaufgaben im Zeitraum." />;
      }}</Geladen>
    </Seite>
  );
}

export default function Hausaufgaben({ teile }: SeitenProps) {
  const s = useSitzung();
  if (s.familie) return <FamilieHausaufgaben teile={teile} />;
  if (s.ich.kollegium && !istIsoDatum(teile[1])) return <Liste bereichP={teile[0]} basis={location.hash.startsWith('#/aufgaben') ? '#/aufgaben' : '#/hausaufgaben'} />;
  return <Gefiltert teile={teile} />;
}
