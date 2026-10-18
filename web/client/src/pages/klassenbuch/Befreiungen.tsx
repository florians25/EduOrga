// Klassenbuch → Befreiungen vom Unterricht: Liste mit Filter (Klasse, Grund, Zeitraum, Suche), Neu/Bearbeiten/Löschen durch die
// Klassenleitung, Bericht. Befreite Schüler*innen sind in den Stundendetails gekennzeichnet.
import { useEffect, useState } from 'react';
import { Button, IconButton, MenuItem, Stack, TextField } from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import EditOutlined from '@mui/icons-material/EditOutlined';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import { api, holen, senden } from '../../api/client';
import type { Elemente } from '../../api/types';
import { useSitzung } from '../../app/sitzung';
import { Geladen, Seite } from '../../components/Seite';
import { FormDialog, SuchFeld, Wahl } from '../../components/Bausteine';
import { DatumFeld } from '../../components/Auswahl';
import { Tabelle } from '../../components/Tabelle';
import { bestaetigen, toast } from '../../lib/meldungen';
import { datumDe, heuteIso, istIsoDatum, plusTage, WOCHENTAGE } from '../../lib/datum';
import { navigieren } from '../../lib/router';
import { useLaden } from '../../lib/useLaden';
import type { SeitenProps } from '../register';

interface Befreiung { id: number; schuelerId: number; schueler: string; klasse: string; von: string; bis: string; wochentag: number; fach: string; beginn: string; ende: string; grund: string; text: string }
interface Grund { kurz: string; name: string }

function Formular({ b, el, gruende, klasseVorgabe, onClose, fertig }: { b: Befreiung | null; el: Elemente; gruende: Grund[]; klasseVorgabe: string; onClose: () => void; fertig: () => void }) {
  const [klasse, setKlasse] = useState(b?.klasse ?? klasseVorgabe);
  const [schueler, setSchueler] = useState<{ id: number; name: string; vorname: string }[]>([]);
  const [w, setW] = useState({ schuelerId: b?.schuelerId ?? 0, von: b?.von ?? heuteIso(), bis: b?.bis ?? plusTage(heuteIso(), 30), wochentag: b?.wochentag ?? 0, fach: b?.fach ?? '', beginn: b?.beginn ?? '', ende: b?.ende ?? '', grund: b?.grund ?? gruende[0]?.kurz ?? '', text: b?.text ?? '' });
  useEffect(() => { holen<typeof schueler>(`/api/app/klassenbuch/schueler?klasse=${encodeURIComponent(klasse)}`).then(s => { setSchueler(s); if (!b) setW(x => ({ ...x, schuelerId: s[0]?.id ?? 0 })); }).catch(() => setSchueler([])); }, [klasse, b]);
  return (
    <FormDialog offen titel={b ? 'Befreiung' : 'Neue Befreiung'} breite="md" onClose={onClose}
      links={b ? <Button color="error" onClick={async () => { await api(`/api/app/befreiungen/${b.id}`, { methode: 'DELETE' }); toast('Gelöscht.'); fertig(); onClose(); }}>Löschen</Button> : undefined}
      aktion={async () => { await senden(b ? `/api/app/befreiungen/${b.id}` : '/api/app/befreiungen', w, b ? 'PUT' : 'POST'); toast('Gespeichert.'); fertig(); }}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <TextField select label="Klasse" value={klasse} onChange={e => setKlasse(e.target.value)} sx={{ width: { sm: 150 } }}>{el.klassen.map(k => <MenuItem key={k.kurz} value={k.kurz}>{k.kurz}</MenuItem>)}</TextField>
          <TextField select label="Schüler*in" value={w.schuelerId || ''} onChange={e => setW({ ...w, schuelerId: Number(e.target.value) })} sx={{ flex: 1 }}>{schueler.map(s => <MenuItem key={s.id} value={s.id}>{s.name} {s.vorname}</MenuItem>)}</TextField>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <DatumFeld label="Von" wert={w.von} onWert={v => setW({ ...w, von: v ?? '' })} pflicht />
          <DatumFeld label="Bis" wert={w.bis} onWert={v => setW({ ...w, bis: v ?? '' })} pflicht />
          <TextField select label="Wochentag" value={w.wochentag} onChange={e => setW({ ...w, wochentag: Number(e.target.value) })} sx={{ flex: 1 }}>
            <MenuItem value={0}>jeden Tag</MenuItem>{WOCHENTAGE.map((t, i) => <MenuItem key={t} value={i + 1}>{t}</MenuItem>)}</TextField>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <TextField select label="Fach" value={w.fach} onChange={e => setW({ ...w, fach: e.target.value })} sx={{ flex: 1 }}><MenuItem value="">alle Fächer</MenuItem>{el.faecher.map(f => <MenuItem key={f.kurz} value={f.kurz}>{f.kurz} – {f.name}</MenuItem>)}</TextField>
          <TextField type="time" label="Beginnzeit" value={w.beginn} onChange={e => setW({ ...w, beginn: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 140 }} />
          <TextField type="time" label="Endzeit" value={w.ende} onChange={e => setW({ ...w, ende: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 140 }} />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <TextField select label="Befreiungsgrund" value={w.grund} onChange={e => setW({ ...w, grund: e.target.value })} sx={{ flex: 1 }}>{gruende.map(g => <MenuItem key={g.kurz} value={g.kurz}>{g.name}</MenuItem>)}</TextField>
          <TextField label="Text" value={w.text} onChange={e => setW({ ...w, text: e.target.value })} sx={{ flex: 1 }} />
        </Stack>
      </Stack>
    </FormDialog>
  );
}

export default function Befreiungen({ teile }: SeitenProps) {
  const { ich, elemente } = useSitzung();
  const [kP, vP, bP, gP] = teile;
  const von = istIsoDatum(vP) ? vP : plusTage(heuteIso(), -30);
  const bis = istIsoDatum(bP) ? bP : plusTage(heuteIso(), 180);
  const grund = gP && gP !== '-' ? gP : '';
  const [suche, setSuche] = useState('');
  const [dialog, setDialog] = useState<{ b: Befreiung | null } | null>(null);
  const g = useLaden(async () => {
    const el = await elemente();
    const eigene = el.klassen.find(k => ich.element && (k.leitung ?? []).some(l => l.toLowerCase() === ich.element.toLowerCase()))?.kurz;
    const klasse = kP === '-' ? '' : kP ?? eigene ?? '';
    const d = await holen<{ befreiungen: Befreiung[]; gruende: Grund[]; verwalten: boolean }>(`/api/app/befreiungen?${klasse ? `klasse=${encodeURIComponent(klasse)}&` : ''}von=${von}&bis=${bis}`);
    return { el, eigene, klasse, d };
  }, [kP, von, bis]);
  return (
    <Geladen g={g}>{({ el, eigene, klasse, d }) => {
      const ziel = (k = klasse, v = von, b = bis, gr = grund) => `#/befreiungen/${encodeURIComponent(k || '-')}/${v}/${b}/${encodeURIComponent(gr || '-')}`;
      const q = suche.toLowerCase();
      const liste = d.befreiungen.filter(b => (!grund || b.grund === grund) && (!q || `${b.schueler} ${b.fach} ${b.text}`.toLowerCase().includes(q)));
      const gName = (x: string) => d.gruende.find(y => y.kurz === x)?.name ?? x;
      return (
        <Seite titel="Befreiungen vom Unterricht" untertitel={`${liste.length} ${liste.length === 1 ? 'Befreiung' : 'Befreiungen'}`}
          aktionen={<><Button variant="outlined" href={`#/berichte/befreiungen/${encodeURIComponent(klasse || '-')}/${von}/${bis}`}>Bericht Befreiungen</Button>
            {d.verwalten && <Button variant="contained" startIcon={<AddRounded />} onClick={() => setDialog({ b: null })}>Neu</Button>}</>}
          filter={<>
            <SuchFeld wert={suche} onWert={setSuche} platzhalter="Schüler*in, Fach oder Text suchen" />
            <Wahl label="Klasse" wert={klasse} onWert={k => navigieren(ziel(k))} optionen={el.klassen.map(k => [k.kurz, k.kurz])} alle="Alle Klassen" breite={150} />
            <Wahl label="Befreiungsgrund" wert={grund} onWert={x => navigieren(ziel(klasse, von, bis, x))} optionen={d.gruende.map(x => [x.kurz, x.name])} alle="Alle Gründe" breite={200} />
            <DatumFeld label="Von" wert={von} onWert={v => v && navigieren(ziel(klasse, v))} pflicht />
            <DatumFeld label="Bis" wert={bis} onWert={b => b && navigieren(ziel(klasse, von, b))} pflicht />
          </>}>
          <Tabelle zeilen={liste} schluessel={b => b.id} leer="Keine Befreiungen gefunden." onZeile={d.verwalten ? b => setDialog({ b }) : undefined}
            spalten={[
              { id: 'schueler', kopf: 'Schüler*in', zelle: b => <b style={{ fontWeight: 500 }}>{b.schueler}</b>, sortWert: b => b.schueler },
              { id: 'klasse', kopf: 'Klasse', zelle: b => b.klasse, sortWert: b => b.klasse },
              { id: 'von', kopf: 'Von', zelle: b => datumDe(b.von), sortWert: b => b.von, nowrap: true },
              { id: 'bis', kopf: 'Bis', zelle: b => datumDe(b.bis), sortWert: b => b.bis, nowrap: true },
              { id: 'wt', kopf: 'Wochentag', zelle: b => (b.wochentag ? WOCHENTAGE[b.wochentag - 1] : 'jeden Tag') },
              { id: 'fach', kopf: 'Fach', zelle: b => b.fach || 'alle' },
              { id: 'zeit', kopf: 'Zeit', zelle: b => (b.beginn || b.ende ? `${b.beginn}–${b.ende}` : ''), verbergenMobil: true },
              { id: 'grund', kopf: 'Grund', zelle: b => gName(b.grund) },
              { id: 'text', kopf: 'Text', zelle: b => b.text, verbergenMobil: true },
              { id: 'akt', kopf: '', rechts: true, nowrap: true, zelle: b => (d.verwalten ? <>
                <IconButton size="small" onClick={e => { e.stopPropagation(); setDialog({ b }); }} aria-label="Bearbeiten"><EditOutlined fontSize="small" /></IconButton>
                <IconButton size="small" color="error" aria-label="Löschen" onClick={async e => { e.stopPropagation(); if (!(await bestaetigen('Befreiung löschen', 'Diese Befreiung löschen?'))) return; await api(`/api/app/befreiungen/${b.id}`, { methode: 'DELETE' }); void g.neu(); }}><DeleteOutlineRounded fontSize="small" /></IconButton></> : null) },
            ]} />
          {dialog && <Formular b={dialog.b} el={el} gruende={d.gruende} klasseVorgabe={klasse || eigene || el.klassen[0]?.kurz || ''} onClose={() => setDialog(null)} fertig={() => void g.neu()} />}
        </Seite>
      );
    }}</Geladen>
  );
}
