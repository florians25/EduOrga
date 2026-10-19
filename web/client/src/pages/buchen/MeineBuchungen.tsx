// Meine Buchungen (Administration: auf Wunsch alle): Kommend / Vergangen / Storniert / Alle, Suche, Art, Zeitraum, nach Monaten gruppiert;
// Serien zusammengefasst und aufklappbar, Storno einzeln oder Serie, CSV-Export.
import { useMemo, useState } from 'react';
import { Box, Button, Collapse, FormControlLabel, Link, Paper, Stack, Switch, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import { api, holen, speichern } from '../../api/client';
import { useSitzung } from '../../app/sitzung';
import { Geladen, Leer, Seite } from '../../components/Seite';
import { Plakette, SuchFeld, Wahl } from '../../components/Bausteine';
import { DatumFeld } from '../../components/Auswahl';
import { datumDe, heuteIso, istIsoDatum, plusTage } from '../../lib/datum';
import { bestaetigen, fehler, toast } from '../../lib/meldungen';
import { link, navigieren } from '../../lib/router';
import { useLaden } from '../../lib/useLaden';
import { csv } from '../unterricht/Unterricht';
import { ART_NAME, ART_TON, BASIS, stdText, StornoDialog, tagKurz } from './gemeinsam';

interface Buchung {
  id: number; datum: string; wochentag: string; stundeVon: number; stundeBis: number; beginn: string; ende: string; art: string; artName: string; raum?: string; titel: string; text: string;
  klassen: string[]; lehrer: string; fach: string; status: string; serie?: string | null; absender: string; benutzerId: number; uebertragen: boolean; erstellt: string; ressourcen: { name: string; menge: number }[];
}
const ANSICHTEN: [string, string][] = [['kommend', 'Kommend'], ['vergangen', 'Vergangen'], ['storniert', 'Storniert'], ['alle', 'Alle']];
const passt = (b: Buchung, a: string, heute: string) => (a === 'kommend' ? b.status === 'aktiv' && b.datum >= heute : a === 'vergangen' ? b.status === 'aktiv' && b.datum < heute : a === 'storniert' ? b.status === 'storniert' : true);
let merkFilter = { ansicht: 'kommend', art: '', suche: '' };

export function MeineBuchungen({ rest }: { rest: string[] }) {
  const { ich } = useSitzung();
  const [vP, bP, aP] = rest;
  const von = istIsoDatum(vP) ? vP : plusTage(heuteIso(), -30);
  const bis = istIsoDatum(bP) ? bP : plusTage(heuteIso(), 180);
  const alle = ich.admin && aP === 'alle';
  const ziel = (v = von, b = bis, a = alle) => navigieren(`#/buchen/meine/${v}/${b}${a ? '/alle' : ''}`, true);
  const g = useLaden(sig => holen<Buchung[]>(`${BASIS}/liste?von=${von}&bis=${bis}${alle ? '&alle=true' : ''}`, sig), [von, bis, alle]);
  const [f, setF] = useState(merkFilter);
  const filter = (w: Partial<typeof f>) => { const n = { ...f, ...w }; merkFilter = n; setF(n); };
  const [offen, setOffen] = useState<Set<string>>(new Set());
  const [storno, setStorno] = useState<{ b: Buchung; n: number } | null>(null);
  const heute = heuteIso();
  const liste = g.daten ?? [];
  const serien = useMemo(() => liste.reduce((m, b) => (b.serie ? m.set(b.serie, (m.get(b.serie) ?? 0) + 1) : m), new Map<string, number>()), [liste]);
  const anzahl = (a: string) => liste.filter(b => passt(b, a, heute)).length;
  const q = f.suche.toLowerCase();
  const sichtbar = liste.filter(b => passt(b, f.ansicht, heute) && (!f.art || b.art === f.art)
    && (!q || [b.titel, b.text, b.raum, b.klassen.join(' '), b.lehrer, b.fach, b.absender, b.artName, b.ressourcen.map(r => r.name).join(' '), datumDe(b.datum)].join(' ').toLowerCase().includes(q)))
    .sort((a, b) => (f.ansicht === 'vergangen' ? -1 : 1) * (a.datum.localeCompare(b.datum) || a.stundeVon - b.stundeVon));
  const darf = (b: Buchung) => (ich.admin || b.benutzerId === ich.id) && b.status === 'aktiv' && (ich.admin || b.datum >= heute);
  const serieStornieren = async (b: Buchung) => {
    if (!(await bestaetigen('Serie stornieren', `Alle kommenden Termine der Serie „${b.titel || b.artName}“ stornieren?`, 'Stornieren'))) return;
    try { const r = await api<{ storniert: number }>(`${BASIS}/${b.id}?serie=true`, { methode: 'DELETE' }); toast(`${r.storniert} Termine storniert.`); void g.neu(); } catch (err) { fehler(err); }
  };

  const Zeile = ({ b, kind = false }: { b: Buchung; kind?: boolean }) => {
    const d = new Date(b.datum + 'T12:00');
    return (
      <Stack direction="row" gap={2} alignItems="flex-start" sx={{ px: 2, py: 1.5, pl: kind ? 6 : 2, borderTop: 1, borderColor: 'divider', opacity: b.status === 'storniert' || b.datum < heute ? 0.6 : 1 }}>
        <Box sx={{ width: 48, textAlign: 'center', flexShrink: 0 }}>
          <Typography sx={{ fontSize: 20, fontWeight: 600, lineHeight: 1.1 }}>{d.getDate()}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>{d.toLocaleDateString('de-DE', { month: 'short' })}</Typography>
          <Typography variant="caption" color="text.secondary">{d.toLocaleDateString('de-DE', { weekday: 'short' })}</Typography>
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><Typography sx={{ fontWeight: 500, textDecoration: b.status === 'storniert' ? 'line-through' : 'none' }}>{b.titel || b.artName}</Typography><Plakette ton={ART_TON[b.art] ?? 'neutral'}>{b.artName}</Plakette></Stack>
          <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 0.25 }}>
            <span>{stdText(b.stundeVon, b.stundeBis)} · {b.beginn}–{b.ende}</span>
            {b.raum && <Link href={link('plan', 'raum', b.raum, b.datum)}>{b.raum}</Link>}
            {b.ressourcen.length > 0 && <span>{b.ressourcen.map(r => `${r.menge > 1 ? `${r.menge}× ` : ''}${r.name}`).join(', ')}</span>}
            {b.klassen.length > 0 && <span>{b.klassen.join(', ')}</span>}
            {b.lehrer && <span>{b.lehrer}{b.fach ? ` · ${b.fach}` : ''}</span>}
            {(alle || b.benutzerId !== ich.id) && <span>gebucht von {b.absender}</span>}
          </Typography>
          {b.text && <Typography variant="body2" sx={{ mt: 0.5 }}>{b.text}</Typography>}
        </Box>
        <Stack alignItems="flex-end" gap={1} sx={{ flexShrink: 0 }}>
          {b.status === 'storniert' ? <Plakette ton="entfall">storniert</Plakette> : b.uebertragen ? <Plakette ton="ok" title="von EduOrga Studio übernommen">übernommen</Plakette> : b.datum < heute ? <Plakette>vergangen</Plakette> : <Plakette ton="pruefung">gebucht</Plakette>}
          {darf(b) && <Button size="small" onClick={() => setStorno({ b, n: b.serie ? serien.get(b.serie) ?? 0 : 0 })}>Stornieren</Button>}
        </Stack>
      </Stack>
    );
  };

  const bloecke: React.ReactNode[] = [];
  const fertig = new Set<string>();
  const gruppen = new Map<string, Buchung[]>();
  sichtbar.forEach(b => { if (b.serie) gruppen.set(b.serie, [...(gruppen.get(b.serie) ?? []), b]); });
  let monat = '';
  for (const b of sichtbar) {
    if (b.serie && fertig.has(b.serie)) continue;
    const m = new Date(b.datum + 'T12:00').toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    if (m !== monat) { monat = m; bloecke.push(<Typography key={'m' + m} variant="overline" color="text.secondary" sx={{ display: 'block', px: 2, pt: 2, pb: 0.5, bgcolor: 'background.default' }}>{m}</Typography>); }
    const gr = b.serie ? gruppen.get(b.serie)! : null;
    if (gr && gr.length > 1) {
      fertig.add(b.serie!);
      const auf = offen.has(b.serie!);
      const kommend = gr.filter(x => x.status === 'aktiv' && x.datum >= heute);
      bloecke.push(
        <Box key={'s' + b.id}>
          <Zeile b={b} />
          <Stack direction="row" gap={1} alignItems="center" sx={{ px: 2, pb: 1.25, pl: 10 }}>
            <Button size="small" endIcon={<ExpandMoreRounded sx={{ transform: auf ? 'rotate(180deg)' : 'none' }} />} aria-expanded={auf}
              onClick={() => setOffen(s => { const x = new Set(s); if (x.has(b.serie!)) x.delete(b.serie!); else x.add(b.serie!); return x; })}>
              Serie · {gr.length === serien.get(b.serie!) ? `${gr.length} Termine` : `${gr.length} von ${serien.get(b.serie!)} Terminen`} · bis {tagKurz(gr[gr.length - 1].datum)}
            </Button>
            {kommend.length > 0 && darf(kommend[0]) && <Button size="small" color="error" onClick={() => serieStornieren(kommend[0])}>Serie stornieren</Button>}
          </Stack>
          <Collapse in={auf} unmountOnExit>{gr.slice(1).map(x => <Zeile key={x.id} b={x} kind />)}</Collapse>
        </Box>,
      );
    } else bloecke.push(<Zeile key={b.id} b={b} />);
  }

  return (
    <Seite titel={alle ? 'Alle Buchungen' : 'Meine Buchungen'} untertitel={g.daten ? `${anzahl('kommend')} kommende Buchungen` : undefined}
      aktionen={<>
        <Button variant="outlined" href="#/buchen/raeume">Raumbelegung</Button>
        <Button variant="outlined" disabled={!sichtbar.length} onClick={() => speichern(csv([
          ['Datum', 'Wochentag', 'Stunde von', 'Stunde bis', 'Beginn', 'Ende', 'Art', 'Raum', 'Ressourcen', 'Klassen', 'Lehrkraft', 'Fach', 'Titel', 'Bemerkung', 'Status', 'Serie', 'Gebucht von', 'Erstellt'],
          ...sichtbar.map(b => [datumDe(b.datum), b.wochentag, b.stundeVon, b.stundeBis, b.beginn, b.ende, b.artName, b.raum, b.ressourcen.map(r => `${r.menge > 1 ? `${r.menge}x ` : ''}${r.name}`).join(', '),
            b.klassen.join(', '), b.lehrer, b.fach, b.titel, b.text, b.status, b.serie, b.absender, b.erstellt]),
        ]), `buchungen-${von}-${bis}.csv`)}>Export</Button>
        <Button variant="contained" href="#/buchen/raum">Neue Buchung</Button>
      </>}
      filter={<>
        <SuchFeld wert={f.suche} onWert={s => filter({ suche: s })} platzhalter="Titel, Raum, Klasse …" breite={240} />
        <Wahl label="Art" wert={f.art} onWert={a => filter({ art: a })} alle="Alle Arten" optionen={Object.entries(ART_NAME)} breite={200} />
        <DatumFeld label="Von" wert={von} onWert={v => v && ziel(v)} pflicht />
        <DatumFeld label="Bis" wert={bis} onWert={b => b && ziel(von, b)} pflicht />
        {ich.admin && <FormControlLabel control={<Switch checked={alle} onChange={e => ziel(von, bis, e.target.checked)} />} label="Buchungen aller Lehrkräfte" />}
      </>}>
      <ToggleButtonGroup exclusive value={f.ansicht} onChange={(_, v) => v && filter({ ansicht: v })} sx={{ mb: 2, flexWrap: 'wrap' }}>
        {ANSICHTEN.map(([w, t]) => <ToggleButton key={w} value={w}>{t}<Plakette sx={{ ml: 1 }}>{anzahl(w)}</Plakette></ToggleButton>)}
      </ToggleButtonGroup>
      <Geladen g={g}>{() => sichtbar.length ? <Paper variant="outlined" sx={{ overflow: 'hidden', '& > :first-of-type': { borderTop: 0 } }}>{bloecke}</Paper>
        : <Leer text={liste.length ? 'Keine Buchungen für diesen Filter' : 'Keine Buchungen im Zeitraum'} unter={liste.length ? 'Ändern Sie Ansicht, Art oder Suche.' : `Zeitraum ${datumDe(von)} – ${datumDe(bis)}`}
          aktion={liste.length ? { text: 'Filter zurücksetzen', onClick: () => filter({ ansicht: 'alle', art: '', suche: '' }) } : { text: 'Raum buchen', onClick: () => navigieren('#/buchen/raum') }} />}</Geladen>
      {storno && <StornoDialog b={storno.b} serienAnzahl={storno.n} onClose={() => setStorno(null)} fertig={() => void g.neu()} />}
    </Seite>
  );
}
