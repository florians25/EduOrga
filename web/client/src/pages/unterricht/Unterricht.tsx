// Unterricht → Mein Unterricht (bzw. Unterricht einer Klasse): Suche, Aktivitätsart, Zeitraum; Tabelle mit Klasse, Schülergruppe, Fach,
// Lehrkraft, Wochenstunden und Schnellzugriffen auf Klassenbuch, Termine im Plan, Lehrstoff, Fehlzeiten, Schülergruppe und Berichte.
import { useState } from 'react';
import { Button, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import AssessmentOutlined from '@mui/icons-material/AssessmentOutlined';
import CalendarViewWeekOutlined from '@mui/icons-material/CalendarViewWeekOutlined';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import NotesOutlined from '@mui/icons-material/NotesOutlined';
import PersonOffOutlined from '@mui/icons-material/PersonOffOutlined';
import { holen, speichern } from '../../api/client';
import { useSitzung } from '../../app/sitzung';
import { Geladen, Leer, Seite } from '../../components/Seite';
import { Plakette, SuchFeld, Wahl } from '../../components/Bausteine';
import { ElementWahl } from '../../components/Auswahl';
import { Tabelle } from '../../components/Tabelle';
import { ZeitraumWahl, zeitraumAus } from '../../components/Zeitraum';
import { link, navigieren } from '../../lib/router';
import { useLaden } from '../../lib/useLaden';
import type { SeitenProps } from '../register';

interface U { id: number; klassen: string[]; kurs: string; fach: string; lehrer: string[]; wochenstunden: number; termine: string[]; raeume: string[]; text: string }
export const csv = (zeilen: unknown[][]) => zeilen.map(z => z.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');

export default function Unterricht({ teile }: SeitenProps) {
  const { ich, elemente, schuljahr } = useSitzung();
  const [aP, eP, bP, vP, biP, akP] = teile;
  const art = aP === 'klasse' ? 'klasse' : 'lehrer';
  const z = zeitraumAus(bP, vP, biP, schuljahr);
  const akt = akP && akP !== '-' ? akP : '';
  const [suche, setSuche] = useState('');
  const g = useLaden(async sig => {
    const el = await elemente();
    const element = (eP && eP !== '-' ? eP : '') || (art === 'lehrer' ? ich.element : el.klassen[0]?.kurz) || '';
    if (!element) return { el, element, zeilen: [] as (U & { aktivitaet: string })[] };
    const [liste, stunden] = await Promise.all([
      holen<U[]>(`/api/app/unterricht?${art}=${encodeURIComponent(element)}&datum=${z.von}`, sig),
      art === 'lehrer' ? holen<{ zeilen: { status: string; unterricht: number }[] }>(`/api/app/klassenbuch/stunden?von=${z.von}&bis=${z.bis}&lehrer=${encodeURIComponent(element)}`, sig).catch(() => null) : Promise.resolve(null),
    ]);
    const geaendert = new Set((stunden?.zeilen ?? []).filter(x => x.status !== 'regulaer').map(x => x.unterricht));
    return { el, element, zeilen: liste.map(u => ({ ...u, aktivitaet: geaendert.has(u.id) ? 'Vertretung' : 'Unterricht' })) };
  }, [art, eP, z.von, z.bis]);
  const element = g.daten?.element ?? '';
  const ziel = (o: { e?: string; b?: string; v?: string; bi?: string; ak?: string }) => {
    const zeit = o.v ? [o.v, o.bi] : !o.b && z.eigen ? [z.von, z.bis] : ['-', '-'];
    navigieren(link('unterricht', art, o.e ?? (element || '-'), o.b ?? z.bereich, ...zeit, (o.ak ?? akt) || '-'));
  };
  const titel = art === 'lehrer' ? `${element === ich.element ? 'Mein Unterricht' : 'Unterricht'} ${element}` : `Unterricht ${element}`;
  return (
    <Seite titel={titel} aktionen={<>
      {ich.kollegium && <Button variant="outlined" startIcon={<AddRounded />} href="#/buchen/unterricht">Neuer Unterricht</Button>}
      <Button variant="outlined" startIcon={<DownloadRounded />} disabled={!g.daten?.zeilen.length} onClick={() => g.daten && speichern(csv([
        ['Aktivitätsart', 'Klassen', 'Schülergruppe', 'Fach', 'Lehrkraft', 'Wochenstunden', 'Termine', 'Räume'],
        ...g.daten.zeilen.map(u => [u.aktivitaet, u.klassen.join(', '), u.kurs, u.fach, u.lehrer.join(', '), u.wochenstunden, u.termine.join(', '), u.raeume.join(', ')]),
      ]), `unterricht-${element}-${z.von}-${z.bis}.csv`)}>Bericht</Button>
    </>}
      filter={<>
        <SuchFeld wert={suche} onWert={setSuche} breite={220} />
        {art === 'klasse' && g.daten && <ElementWahl liste={g.daten.el.klassen} wert={element} onWahl={x => ziel({ e: x })} platzhalter="Klasse wählen" breite={180} />}
        <Wahl label="Aktivitätsart" wert={akt} onWert={a => ziel({ ak: a })} alle="Alle" optionen={['Unterricht', 'Vertretung', 'Prüfung'].map(a => [a, a] as [string, string])} breite={170} />
        <ZeitraumWahl bereich={z.bereich} von={z.von} bis={z.bis} eigen={z.eigen} onBereich={b => ziel({ b })} onVonBis={(v, bi) => ziel({ v, bi })} />
      </>}>
      <Geladen g={g}>{d => {
        if (!d.element) return <Leer text="Bitte eine Klasse wählen." />;
        const f = suche.trim().toLowerCase();
        const zeilen = d.zeilen.filter(u => (!akt || u.aktivitaet === akt || (akt === 'Prüfung' && /klausur|prüfung/i.test(u.text)))
          && (!f || [u.klassen.join(' '), u.kurs, u.fach, u.lehrer.join(' ')].join(' ').toLowerCase().includes(f)));
        const knopf = (href: string, titel: string, icon: React.ReactNode) => <Tooltip title={titel}><IconButton size="small" href={href} aria-label={titel}>{icon}</IconButton></Tooltip>;
        return (
          <Tabelle zeilen={zeilen} schluessel={u => u.id} leer="Keine Unterrichte gefunden." sortierung={{ id: 'klasse', richtung: 'asc' }}
            spalten={[
              { id: 'klasse', kopf: 'Klasse', sortWert: u => u.klassen.join(', '), zelle: u => <b>{u.klassen.join(', ') || '–'}</b> },
              { id: 'gruppe', kopf: 'Schülergruppe', zelle: u => <Typography variant="body2" color="text.secondary">{u.kurs || (u.klassen.length ? `SG_${u.klassen.join('_')}` : '')}</Typography>, verbergenMobil: true },
              { id: 'fach', kopf: 'Fach', sortWert: u => u.fach, zelle: u => <Plakette ton="primaer">{u.fach}</Plakette> },
              { id: 'lehrer', kopf: 'Lehrkraft', sortWert: u => u.lehrer.join(', '), zelle: u => u.lehrer.join(', ') },
              { id: 'wst', kopf: 'Wst', rechts: true, sortWert: u => u.wochenstunden, zelle: u => u.wochenstunden },
              { id: 'akt', kopf: 'Aktivität', zelle: u => <Plakette ton={u.aktivitaet === 'Vertretung' ? 'aenderung' : 'neutral'}>{u.aktivitaet}</Plakette>, verbergenMobil: true },
              { id: 'links', kopf: '', rechts: true, nowrap: true, zelle: u => { const k = u.klassen[0] ?? ''; return (
                <Stack direction="row" justifyContent="flex-end">
                  {knopf(link('klassenbuch', k || '-', 'woche'), 'Klassenbuch', <MenuBookOutlined fontSize="small" />)}
                  {knopf(link('plan', 'klasse', k, z.von), u.termine.join(', ') || 'Termine im Stundenplan', <CalendarViewWeekOutlined fontSize="small" />)}
                  {knopf(link('klassenbuch', k, 'verlauf'), 'Lehrstoff', <NotesOutlined fontSize="small" />)}
                  {knopf(link('klassenbuch', k, 'fehlzeiten'), 'Schüler*innen und Fehlzeiten', <PersonOffOutlined fontSize="small" />)}
                  {knopf(link('schueler', k), 'Schülergruppe', <GroupsOutlined fontSize="small" />)}
                  {knopf(link('berichte', '-', k, z.von, z.bis), 'Berichte', <AssessmentOutlined fontSize="small" />)}
                </Stack>
              ); } },
            ]} />
        );
      }}</Geladen>
    </Seite>
  );
}
