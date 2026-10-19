// Unterricht → Prüfungen: Suche, „Alle / Meine“, Art und Zeitraum; Liste mit Auswahl (für den Bericht), Art, Name, Klasse, Fach, Lehrkraft,
// Datum, Von, Bis, Räume, Aufgegeben am, Text. Klausuren aus EduOrga Studio und in EduOrga Web vorgemerkte Prüfungen; Löschen nach Rückfrage.
import { useState } from 'react';
import { Button, IconButton, Tooltip, Typography } from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import { holen, senden, speichern } from '../../api/client';
import { useSitzung } from '../../app/sitzung';
import { Geladen, Seite } from '../../components/Seite';
import { Plakette, SuchFeld, Wahl } from '../../components/Bausteine';
import { Tabelle } from '../../components/Tabelle';
import { ZeitraumWahl, zeitraumAus } from '../../components/Zeitraum';
import { datumDe, heuteIso } from '../../lib/datum';
import { bestaetigen, toast } from '../../lib/meldungen';
import { link, navigieren } from '../../lib/router';
import { useLaden } from '../../lib/useLaden';
import type { SeitenProps } from '../register';
import { csv } from './Unterricht';

export interface Pruefung {
  art: string; titel: string; klassen: string[]; fach: string; lehrer: string[]; datum: string; beginn: string; ende: string; raeume: string[];
  aufgegeben?: string; text: string; status: string; stundeVon: number; stundeBis: number; darfLoeschen: boolean;
}

/** Prüfung nach Rückfrage löschen: nicht übernommene werden zurückgezogen, übernommene gehen als Löschmeldung an EduOrga Studio. */
export async function pruefungLoeschen(p: Pruefung) {
  const stunden = p.stundeVon === p.stundeBis ? `${p.stundeVon}.` : `${p.stundeVon}.–${p.stundeBis}.`;
  if (!(await bestaetigen('Prüfung löschen', `Prüfung „${p.titel || 'Prüfung'}“ (${(p.klassen || []).join(', ')}) am ${datumDe(p.datum)}, ${stunden} Stunde löschen?`))) return false;
  try {
    const r = await senden<{ meldung?: unknown }>('/api/app/meldungen/klausur/loeschen', { datum: p.datum, stundeVon: p.stundeVon, stundeBis: p.stundeBis, klassen: p.klassen || [], titel: p.titel || null });
    toast(r?.meldung ? 'Prüfung gelöscht – EduOrga Studio übernimmt die Löschung beim nächsten Abgleich.' : 'Prüfung gelöscht.');
    return true;
  } catch (err) { toast((err as Error).message, true); return false; }
}

export default function Pruefungen({ teile }: SeitenProps) {
  const { ich, schuljahr } = useSitzung();
  const [bP, wP] = teile;
  const z = zeitraumAus(bP, undefined, undefined, schuljahr);
  const eigen = ich.kollegium && !!ich.element;
  const wahl = eigen && wP === 'meine' ? 'meine' : 'alle';
  const g = useLaden(sig => holen<Pruefung[]>(`/api/app/pruefungen?von=${z.von}&bis=${z.bis}${wahl === 'meine' ? `&lehrer=${encodeURIComponent(ich.element)}` : ''}`, sig), [z.von, z.bis, wahl]);
  const [suche, setSuche] = useState('');
  const [art, setArt] = useState('');
  const [auswahl, setAuswahl] = useState<Set<string | number>>(new Set());
  const arten = [...new Set((g.daten ?? []).map(p => p.art).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
  const f = suche.trim().toLowerCase();
  const l = (g.daten ?? []).map((p, i) => ({ ...p, i })).filter(p => (!art || p.art === art) && (!f || [p.art, p.titel, p.fach, p.text, ...p.klassen, ...p.lehrer, ...p.raeume].join(' ').toLowerCase().includes(f)));
  const heute = heuteIso();
  return (
    <Seite titel="Prüfungen" untertitel={g.daten ? `${l.length} Prüfungen · ${datumDe(z.von)} – ${datumDe(z.bis)}` : undefined}
      aktionen={<>
        {ich.kollegium && <Button variant="outlined" startIcon={<AddRounded />} href="#/melden/klausur">Prüfung eintragen</Button>}
        <Button variant="outlined" startIcon={<DownloadRounded />} disabled={!l.length} onClick={() => {
          const zeilen = auswahl.size ? l.filter(p => auswahl.has(p.i)) : l;
          speichern(csv([['Art', 'Name', 'Klassen', 'Fach', 'Lehrkräfte', 'Datum', 'Von', 'Bis', 'Räume', 'Aufgegeben am', 'Text', 'Status'],
            ...zeilen.map(p => [p.art, p.titel, p.klassen.join(', '), p.fach, p.lehrer.join(', '), datumDe(p.datum), p.beginn, p.ende, p.raeume.join(', '), datumDe(p.aufgegeben), p.text, p.status])]), `pruefungen-${z.von}-${z.bis}.csv`);
        }}>Bericht{auswahl.size ? ` (${auswahl.size})` : ''}</Button>
      </>}
      filter={<>
        <SuchFeld wert={suche} onWert={setSuche} platzhalter="Prüfungen durchsuchen" />
        {eigen && <Wahl label="Auswahl" wert={wahl} onWert={w => navigieren(link('pruefungen', z.bereich, w))} optionen={[['alle', 'Alle'], ['meine', 'Meine']]} breite={130} />}
        <Wahl label="Art" wert={art} onWert={setArt} alle="Alle Arten" optionen={arten.map(a => [a, a])} breite={170} />
        <ZeitraumWahl bereich={z.bereich} von={z.von} bis={z.bis} onBereich={b => navigieren(link('pruefungen', b, wahl))} bereiche={['woche', 'naechste', 'vier', 'jahr']} mitDatum={false} />
      </>}>
      <Geladen g={g}>{() => (
        <Tabelle zeilen={l} schluessel={p => p.i} auswahl={auswahl} setAuswahl={setAuswahl} leer={f || art ? 'Keine Prüfung passt zur Suche.' : 'Keine Prüfungen im gewählten Zeitraum.'}
          zeilenSx={p => (p.datum < heute ? { opacity: 0.6 } : {})} sortierung={{ id: 'datum', richtung: 'asc' }}
          spalten={[
            { id: 'art', kopf: 'Art', sortWert: p => p.art, zelle: p => <Plakette ton="pruefung">{p.art}</Plakette> },
            { id: 'titel', kopf: 'Name', sortWert: p => p.titel, zelle: p => <b>{p.titel}</b> },
            { id: 'klassen', kopf: 'Klasse', sortWert: p => p.klassen.join(), zelle: p => p.klassen.join(', ') },
            { id: 'fach', kopf: 'Fach', sortWert: p => p.fach, zelle: p => p.fach },
            { id: 'lehrer', kopf: 'Lehrkraft', zelle: p => p.lehrer.join(', '), verbergenMobil: true },
            { id: 'datum', kopf: 'Datum', sortWert: p => p.datum + p.beginn, nowrap: true, zelle: p => datumDe(p.datum) },
            { id: 'zeit', kopf: 'Zeit', nowrap: true, zelle: p => `${p.beginn}–${p.ende}`, verbergenMobil: true },
            { id: 'raeume', kopf: 'Räume', zelle: p => p.raeume.join(', '), verbergenMobil: true },
            { id: 'aufg', kopf: 'Aufgegeben am', zelle: p => datumDe(p.aufgegeben), verbergenMobil: true },
            { id: 'text', kopf: 'Text', zelle: p => <>{p.text && <Typography variant="body2" noWrap sx={{ maxWidth: 180 }} title={p.text}>{p.text}</Typography>}{p.status === 'vorgemerkt' && <Plakette>vorgemerkt</Plakette>}</> },
            { id: 'akt', kopf: '', rechts: true, zelle: p => p.darfLoeschen && (
              <Tooltip title="Prüfung löschen"><IconButton size="small" color="error" onClick={async e => { e.stopPropagation(); if (await pruefungLoeschen(p)) void g.neu(); }}><DeleteOutlineRounded fontSize="small" /></IconButton></Tooltip>
            ) },
          ]} />
      )}</Geladen>
    </Seite>
  );
}
