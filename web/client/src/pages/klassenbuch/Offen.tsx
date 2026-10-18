// Klassenbuch → Offene Stunden: Stunden ohne Abwesenheitskontrolle bzw. Lehrstoff im Zeitraum (gespeicherter Zeitbereich auf dem Server),
// Suche mit Lehrkräften/Klassen (Administration bzw. Klassenleitung), Art der Anzeige, „Prüfen“ (Stundendetails), „Eingeben“ (Lehrstoff
// in der Seitenleiste mit Vorstunden und Blättern), Nachricht an die Lehrkräfte, Bericht (CSV).
import { useEffect, useState } from 'react';
import { Autocomplete, Box, Button, Chip, Drawer, IconButton, MenuItem, Skeleton, Stack, TextField, Tooltip, Typography, useTheme } from '@mui/material';
import CheckRounded from '@mui/icons-material/CheckRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import TaskAltRounded from '@mui/icons-material/TaskAltRounded';
import { holen, senden, speichern } from '../../api/client';
import type { Karte } from '../../api/types';
import { useSitzung } from '../../app/sitzung';
import { Geladen, Leer, Seite } from '../../components/Seite';
import { FormDialog, Wahl } from '../../components/Bausteine';
import { DatumFeld } from '../../components/Auswahl';
import { Tabelle } from '../../components/Tabelle';
import { Stundendetails } from '../../components/plan/Stundendetails';
import { karteAus } from '../../components/plan/karte';
import { gueltigeFarbe } from '../../components/plan/logik';
import { LEHRFORMEN } from '../../components/klassenbuch/StundenDialoge';
import { toast } from '../../lib/meldungen';
import { datumDe, istIsoDatum, wochentagKurz } from '../../lib/datum';
import { navigieren } from '../../lib/router';
import { useLaden } from '../../lib/useLaden';
import type { SeitenProps } from '../register';

const ART: Record<string, string> = { offen: 'Offen', kontrolle: 'Abwesenheiten fehlen', lehrstoff: 'Lehrstoff fehlt', alle: 'Alle Stunden' };
interface Zeile { datum: string; von: number; bis: number; beginn: string; ende: string; status: string; fach: string; fachName: string; farbe: string; klassen: string[]; lehrer: string; raeume: string[]; art: string; unterricht: number; geprueft: boolean; lehrstoff: boolean; i: number }
interface Antwort { zeilen: Omit<Zeile, 'i'>[]; bereich: string; bereiche: { id: string; text: string }[]; von: string; bis: string; heute: string; lehrer: string[]; klasse: string | null; alle: boolean; klassenleitung: string[]; offenFuer?: string; gesamt: number }
const passtArt = (art: string, z: Zeile) => (art === 'kontrolle' ? !z.geprueft : art === 'lehrstoff' ? !z.lehrstoff : art === 'alle' ? true : !z.geprueft || !z.lehrstoff);

function LehrstoffLeiste({ liste, start, onClose }: { liste: Zeile[]; start: number; onClose: (gespeichert: boolean) => void }) {
  const t = useTheme();
  const [i, setI] = useState(Math.max(0, start));
  const [st, setSt] = useState<{ eintrag: { thema?: string; lehrform?: string } | null; darf: boolean } | null | undefined>(undefined);
  const [vor, setVor] = useState<{ datum: string; thema: string }[]>([]);
  const [thema, setThema] = useState('');
  const [lehrform, setLehrform] = useState('');
  const [gespeichert, setGespeichert] = useState(false);
  const z = liste[i];
  useEffect(() => {
    setSt(undefined);
    const lk = z.lehrer ? `&lehrer=${encodeURIComponent(z.lehrer)}` : '';
    Promise.all([holen<{ eintrag: { thema?: string; lehrform?: string } | null; darf: boolean }>(`/api/app/klassenbuch/stunde?datum=${z.datum}&stunde=${z.von}&unterricht=${z.unterricht}${lk}`).catch(() => null),
      holen<{ datum: string; thema: string }[]>(`/api/app/klassenbuch/lehrstoff/vorstunden?datum=${z.datum}&stunde=${z.von}&unterricht=${z.unterricht}`).catch(() => [])])
      .then(([s, v]) => { setSt(s); setVor(v); setThema(s?.eintrag?.thema ?? ''); setLehrform(s?.eintrag?.lehrform ?? ''); });
  }, [z]);
  const sichern = async () => {
    if (!thema.trim()) { toast('Bitte den Lehrstoff eingeben.', true); return; }
    try {
      await senden('/api/app/klassenbuch/stunde', { datum: z.datum, stunde: z.von, unterricht: z.unterricht, thema: thema.trim(), lehrform, lehrer: z.lehrer || null }, 'PUT');
      setGespeichert(true); z.lehrstoff = true; toast('Lehrstoff gespeichert.');
      if (i < liste.length - 1) setI(i + 1); else onClose(true);
    } catch (err) { toast((err as Error).message, true); }
  };
  return (
    <Drawer anchor="right" open onClose={() => onClose(gespeichert)} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 440 }, display: 'flex', flexDirection: 'column' } } }}>
      <Stack direction="row" alignItems="center" sx={{ px: 2.5, py: 1.5, borderBottom: 1, borderColor: 'divider' }}><Typography variant="h3" sx={{ flex: 1 }}>Lehrstoff</Typography><IconButton onClick={() => onClose(gespeichert)} aria-label="Schließen"><CloseRounded /></IconButton></Stack>
      <Box sx={{ p: 2.5, flex: 1, overflowY: 'auto' }}>
        <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
          <Typography sx={{ fontWeight: 600 }}>{datumDe(z.datum)}</Typography><Typography color="text.secondary">{z.beginn} – {z.ende}</Typography>
          <Box sx={{ flex: 1 }} />
          <IconButton size="small" disabled={i <= 0} onClick={() => setI(i - 1)} aria-label="Vorherige Stunde"><ChevronLeftRounded /></IconButton>
          <Typography variant="caption">{i + 1}/{liste.length}</Typography>
          <IconButton size="small" disabled={i >= liste.length - 1} onClick={() => setI(i + 1)} aria-label="Nächste Stunde"><ChevronRightRounded /></IconButton>
        </Stack>
        <Box sx={{ p: 1.5, mb: 2, borderRadius: 2, borderLeft: `4px solid ${gueltigeFarbe(z.farbe) ?? t.palette.divider}`, bgcolor: 'action.hover', display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <b>{z.fach}</b><span>{z.klassen.join(', ')}</span><span>{z.lehrer}</span><span>{z.raeume.join(', ')}</span>
        </Box>
        {st === undefined ? <Skeleton variant="rounded" height={160} /> : (
          <Stack gap={2}>
            <TextField select label="Lehrform" value={lehrform} onChange={e => setLehrform(e.target.value)}><MenuItem value="">–</MenuItem>{LEHRFORMEN.map(l => <MenuItem key={l} value={l}>{l}</MenuItem>)}</TextField>
            <TextField label="Lehrstoff" multiline minRows={4} value={thema} onChange={e => setThema(e.target.value)} disabled={!st?.darf} autoFocus placeholder="Lehrstoff hier eingeben" />
            {st && !st.darf && <Typography variant="body2" color="text.secondary">Diese Stunde gehört nicht zu Ihrem Unterricht.</Typography>}
            <Box><Typography variant="subtitle2" sx={{ mb: 1 }}>Vorstunden</Typography>
              {vor.length ? vor.map((v, n) => (
                <Stack key={n} direction="row" gap={1} alignItems="center" sx={{ py: 0.5 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ width: 76 }}>{wochentagKurz(v.datum)} {datumDe(v.datum).slice(0, 6)}</Typography>
                  <Typography variant="body2" sx={{ flex: 1 }} noWrap title={v.thema}>{v.thema || '–'}</Typography>
                  {v.thema && st?.darf && <Tooltip title="Lehrstoff übernehmen"><IconButton size="small" onClick={() => setThema(v.thema)} aria-label="Lehrstoff übernehmen"><ContentCopyRounded fontSize="small" /></IconButton></Tooltip>}
                </Stack>)) : <Typography variant="body2" color="text.secondary">Keine Vorstunden</Typography>}</Box>
          </Stack>
        )}
      </Box>
      <Stack direction="row" gap={1} justifyContent="flex-end" sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button variant="outlined" onClick={() => onClose(gespeichert)}>Abbrechen</Button><Button variant="contained" disabled={!st?.darf} onClick={() => void sichern()}>Speichern</Button>
      </Stack>
    </Drawer>
  );
}

function NachrichtDialog({ liste, onClose }: { liste: Zeile[]; onClose: () => void }) {
  const g = useLaden(() => holen<{ id: string; name: string }[]>('/api/app/mitteilungen/empfaenger'), []);
  const kuerzel = [...new Set(liste.map(z => z.lehrer))];
  const ziele = (g.daten ?? []).filter(x => x.id.startsWith('benutzer:') && kuerzel.some(k => x.name.toLowerCase().includes(`(${k.toLowerCase()})`) || x.name.toLowerCase().includes(k.toLowerCase())));
  const [betreff, setBetreff] = useState('Offene Stunden im Klassenbuch');
  const [text, setText] = useState(`Bitte tragen Sie für folgende Stunden die Abwesenheitskontrolle bzw. den Lehrstoff nach:\n\n${liste.slice(0, 60).map(z =>
    `- ${datumDe(z.datum)} ${z.beginn}–${z.ende} ${z.klassen.join(', ')} ${z.fach} (${z.lehrer})${!z.geprueft ? ' · Abwesenheiten' : ''}${!z.lehrstoff ? ' · Lehrstoff' : ''}`).join('\n')}${liste.length > 60 ? `\n… und ${liste.length - 60} weitere` : ''}`);
  return (
    <FormDialog offen titel="Nachricht senden" breite="md" onClose={onClose} aktionText="Nachricht senden" aktion={async () => {
      if (!ziele.length) { toast('Keine Empfänger vorhanden.', true); return false; }
      await senden('/api/app/mitteilungen', { empfaenger: ziele.map(x => x.id), betreff, text, wichtig: false }); toast('Nachricht gesendet.');
    }}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        <Box><Typography variant="subtitle2" sx={{ mb: 0.75 }}>Empfänger</Typography>
          {ziele.length ? <Stack direction="row" gap={0.5} flexWrap="wrap">{ziele.map(x => <Chip key={x.id} label={x.name} size="small" />)}</Stack> : <Typography variant="body2" color="text.secondary">{g.daten ? 'Für die betroffenen Lehrkräfte gibt es kein Benutzerkonto.' : 'Wird geladen …'}</Typography>}</Box>
        <TextField label="Betreff" value={betreff} onChange={e => setBetreff(e.target.value)} />
        <TextField label="Nachricht" multiline minRows={8} value={text} onChange={e => setText(e.target.value)} />
      </Stack>
    </FormDialog>
  );
}

export default function Offen({ teile }: SeitenProps) {
  const { elemente } = useSitzung();
  const [bP, aP, lP, kP, vP, biP] = teile;
  const lehrerWahl = lP && lP !== '-' ? lP.split(',').filter(Boolean) : [];
  const klasseWahl = kP && kP !== '-' ? kP : '';
  const bereichWahl = bP && bP !== '-' ? bP : '';
  const individuell = bereichWahl === 'individuell' && istIsoDatum(vP) && istIsoDatum(biP);
  const [suche, setSuche] = useState('');
  const [auswahl, setAuswahl] = useState<Set<string | number>>(new Set());
  const [details, setDetails] = useState<{ k: Karte; liste: Karte[] } | null>(null);
  const [leiste, setLeiste] = useState<{ liste: Zeile[]; start: number } | null>(null);
  const [nachricht, setNachricht] = useState<Zeile[] | null>(null);
  const g = useLaden(async () => {
    const q = new URLSearchParams({ art: 'alle' });
    if (bereichWahl) q.set('bereich', bereichWahl);
    if (individuell) { q.set('von', vP); q.set('bis', biP); }
    if (lehrerWahl.length) q.set('lehrer', lehrerWahl.join(','));
    if (klasseWahl) q.set('klasse', klasseWahl);
    const [r, el] = await Promise.all([holen<Antwort>(`/api/app/klassenbuch/offene-stunden?${q}`), elemente()]);
    return { r, el };
  }, [teile.join('/')]);
  return (
    <Geladen g={g}>{({ r, el }) => {
      const art = ART[aP] ? aP : r.offenFuer === 'kontrolle' || r.offenFuer === 'lehrstoff' ? r.offenFuer : 'offen';
      const zustand = { bereich: r.bereich, art, lehrer: r.alle ? r.lehrer.filter(l => lehrerWahl.includes(l)) : [], klasse: r.klasse ?? '', von: r.von, bis: r.bis };
      const ziel = (x: Partial<typeof zustand> = {}) => {
        const z = { ...zustand, ...x };
        const t = [z.bereich || '-', z.art, encodeURIComponent(z.lehrer.join(',') || '-'), encodeURIComponent(z.klasse || '-')];
        if (z.bereich === 'individuell') t.push(z.von, z.bis);
        return `#/offen/${t.join('/')}`;
      };
      const bereichSetzen = async (bereich: string, von?: string, bis?: string) => {
        try { await senden('/api/app/klassenbuch/offene-stunden/zeitbereich', { bereich, von: von ?? null, bis: bis ?? null }, 'PUT'); } catch (err) { toast((err as Error).message, true); }
        navigieren(ziel({ bereich, von, bis }));
      };
      const zeilen: Zeile[] = r.zeilen.map((z, i) => ({ ...z, i }));
      const q = suche.trim().toLowerCase();
      const liste = zeilen.filter(z => passtArt(art, z) && (!q || `${z.lehrer} ${z.klassen.join(' ')} ${z.fach} ${z.fachName} ${z.raeume.join(' ')} ${datumDe(z.datum)}`.toLowerCase().includes(q)));
      const gewaehlt = () => (auswahl.size ? zeilen.filter(z => auswahl.has(z.i)) : liste);
      const karten = liste.map(z => karteAus({ datum: z.datum, von: z.von, bis: z.bis, beginn: z.beginn, ende: z.ende, status: z.status === 'klausur' ? 'regulaer' : z.status, fach: z.fach, fachName: z.fachName, farbe: z.farbe, klassen: z.klassen, lehrer: [z.lehrer], raeume: z.raeume, art: z.art, unterricht: z.unterricht }));
      const optionen = [
        ...r.klassenleitung.map(k => ({ typ: 'klasse', wert: k, gruppe: 'Meine Klassen', info: 'alle Stunden der Klasse' })),
        ...el.klassen.filter(k => !r.klassenleitung.includes(k.kurz)).map(k => ({ typ: 'klasse', wert: k.kurz, gruppe: 'Klassen', info: k.name !== k.kurz ? k.name : '' })),
        ...(r.alle ? el.lehrer.map(l => ({ typ: 'lehrer', wert: l.kurz, gruppe: 'Lehrkräfte', info: l.name })) : []),
      ];
      const gewaehltOpt = optionen.filter(o => (o.typ === 'lehrer' && zustand.lehrer.includes(o.wert)) || (o.typ === 'klasse' && o.wert === zustand.klasse && o.gruppe !== (r.klassenleitung.includes(o.wert) ? 'Klassen' : '')));
      const nachrichtErlaubt = r.alle || r.klassenleitung.length > 0;
      return (
        <Seite titel="Offene Stunden" untertitel={`${datumDe(r.von)} – ${datumDe(r.bis)} · ${liste.length} ${liste.length === 1 ? 'Stunde' : 'Stunden'}`}
          aktionen={<>{nachrichtErlaubt && <Button variant="outlined" disabled={!liste.length} onClick={() => setNachricht(gewaehlt())}>Nachricht senden</Button>}
            <Button variant="outlined" disabled={!liste.length} onClick={() => speichern(['Datum;Beginn;Ende;Stunde;Klasse;Fach;Lehrkraft;Art;Raum;Abwesenheiten kontrolliert;Lehrstoff',
              ...gewaehlt().map(z => [datumDe(z.datum), z.beginn, z.ende, z.von === z.bis ? z.von : `${z.von}-${z.bis}`, z.klassen.join(', '), z.fach, z.lehrer, z.art, z.raeume.join(', '), z.geprueft ? 'ja' : 'nein', z.lehrstoff ? 'ja' : 'nein'].map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(';'))].join('\r\n'), `offene-stunden-${r.von}-${r.bis}.csv`)}>Bericht</Button></>}
          filter={<>
            <Autocomplete multiple options={optionen} groupBy={o => o.gruppe} value={gewaehltOpt} getOptionLabel={o => o.wert} isOptionEqualToValue={(a, b) => a.typ === b.typ && a.wert === b.wert}
              inputValue={suche} onInputChange={(_, v, grund) => { if (grund !== 'reset') setSuche(v); }}
              onChange={(_, v) => { const kl = v.filter(x => x.typ === 'klasse').pop(); navigieren(ziel({ lehrer: v.filter(x => x.typ === 'lehrer').map(x => x.wert), klasse: kl?.wert ?? '' })); }}
              renderOption={(p, o) => { const { key, ...x } = p as typeof p & { key: string }; return <li key={key} {...x}><b style={{ minWidth: 56, display: 'inline-block' }}>{o.wert}</b><Typography component="span" variant="body2" color="text.secondary">{o.info}</Typography></li>; }}
              renderInput={p => <TextField {...p} placeholder={r.alle ? 'Lehrkraft, Klasse oder Fach suchen' : 'Klasse oder Fach suchen'} />} sx={{ minWidth: 300, flex: 1, maxWidth: 520 }} freeSolo={false} />
            <Wahl label="Anzeigen" wert={art} onWert={a => navigieren(ziel({ art: a }))} optionen={Object.entries(ART)} breite={210} />
            <Wahl label="Zeitbereich" wert={r.bereich} onWert={b => (b === 'individuell' ? undefined : void bereichSetzen(b))} optionen={r.bereiche.map(b => [b.id, b.text])} breite={200} />
            <DatumFeld label="Von" wert={r.von} max={r.heute} onWert={v => v && void bereichSetzen('individuell', v, r.bis)} pflicht breite={155} />
            <DatumFeld label="Bis" wert={r.bis} max={r.heute} onWert={b => b && void bereichSetzen('individuell', r.von, b)} pflicht breite={155} />
          </>}>
          {liste.length ? (
            <Tabelle zeilen={liste} schluessel={z => z.i} auswahl={auswahl} setAuswahl={setAuswahl} onZeile={z => { const i = liste.indexOf(z); setDetails({ k: karten[i], liste: karten }); }}
              spalten={[
                { id: 'lehrer', kopf: 'Lehrkraft', zelle: z => z.lehrer, sortWert: z => z.lehrer },
                { id: 'klasse', kopf: 'Klasse', zelle: z => z.klassen.join(', '), sortWert: z => z.klassen.join(',') },
                { id: 'fach', kopf: 'Fach', zelle: z => <Stack direction="row" gap={1} alignItems="center"><Box sx={{ width: 4, height: 18, borderRadius: 1, bgcolor: gueltigeFarbe(z.farbe) ?? 'divider' }} /><b>{z.fach}</b></Stack>, sortWert: z => z.fach },
                { id: 'datum', kopf: 'Datum', zelle: z => `${datumDe(z.datum)} ${z.beginn} – ${z.ende}`, sortWert: z => z.datum + z.beginn, nowrap: true },
                { id: 'art', kopf: 'Art', zelle: z => z.art, verbergenMobil: true },
                { id: 'raum', kopf: 'Raum', zelle: z => z.raeume.join(', '), verbergenMobil: true },
                { id: 'kontrolle', kopf: 'Abwesenheitskontrolle', zelle: z => (z.geprueft ? <Tooltip title="Abwesenheiten kontrolliert"><CheckRounded sx={{ color: 'status.ok.main' }} /></Tooltip> : <Button size="small" variant="outlined" onClick={e => { e.stopPropagation(); const i = liste.indexOf(z); setDetails({ k: karten[i], liste: karten }); }}>Prüfen</Button>) },
                { id: 'lehrstoff', kopf: 'Lehrstoff', zelle: z => (z.lehrstoff ? <Tooltip title="Lehrstoff eingetragen"><CheckRounded sx={{ color: 'status.ok.main' }} /></Tooltip> : <Button size="small" variant="outlined" onClick={e => { e.stopPropagation(); setLeiste({ liste, start: liste.indexOf(z) }); }}>Eingeben</Button>) },
              ]} />
          ) : <Leer symbol={<TaskAltRounded />} text={r.gesamt ? 'Alles erledigt' : 'Keine gehaltenen Stunden'} unter={r.gesamt ? (q ? 'Keine Stunde passt zur Suche.' : 'Im gewählten Zeitraum sind Abwesenheiten und Lehrstoff vollständig eingetragen.') : 'Im gewählten Zeitraum gibt es keine gehaltenen Stunden.'} />}
          {!r.alle && r.klassenleitung.length > 0 && !zustand.klasse && <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>Als Klassenleitung können Sie über die Suche alle Stunden {r.klassenleitung.length === 1 ? 'Ihrer Klasse' : 'Ihrer Klassen'} anzeigen.</Typography>}
          {details && <Stundendetails karte={details.k} liste={details.liste} typ="lehrer" onClose={() => setDetails(null)} onGeaendert={() => void g.neu()} />}
          {leiste && <LehrstoffLeiste liste={leiste.liste} start={leiste.start} onClose={x => { setLeiste(null); if (x) void g.neu(); }} />}
          {nachricht && <NachrichtDialog liste={nachricht} onClose={() => setNachricht(null)} />}
        </Seite>
      );
    }}</Geladen>
  );
}
