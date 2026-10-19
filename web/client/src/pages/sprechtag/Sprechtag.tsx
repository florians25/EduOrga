// Sprechtag (Elternsprechtag):
// - Liste der Sprechtage (#/sprechtag); Administration legt an und bearbeitet (#/sprechtag/neu, #/sprechtag/<id>/verwalten), sieht die Übersicht je Lehrkraft
//   und kann den ganzen Sprechtag absagen.
// - Lehrkraft (#/sprechtag/<id>, Administration: #/sprechtag/<id>/lehrer/<Kürzel>): Raum bzw. Online-Link, Warteliste, „Gespräche wünschen“ (Einladungen),
//   „Meine Termine“ als Zeitraster (frei/gebucht/gesperrt) mit Sperren, Eintragen, Verschieben, Absagen und Terminplan als PDF.
// - Erziehungsberechtigte bzw. Schüler*innen: eigene Termine, Lehrkräfte je Kind mit freien Zeitfenstern, buchen, Warteliste, absagen.
import { useState } from 'react';
import {
  Alert, Box, Button, Checkbox, FormControlLabel, IconButton, MenuItem, Paper, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import EditOutlined from '@mui/icons-material/EditOutlined';
import LockOpenOutlined from '@mui/icons-material/LockOpenOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined';
import PrintOutlined from '@mui/icons-material/PrintOutlined';
import SendRounded from '@mui/icons-material/SendRounded';
import SwapHorizRounded from '@mui/icons-material/SwapHorizRounded';
import UndoRounded from '@mui/icons-material/UndoRounded';
import VideocamOutlined from '@mui/icons-material/VideocamOutlined';
import { holen, loeschen, senden } from '../../api/client';
import { useSitzung } from '../../app/sitzung';
import { Geladen, Leer, Seite } from '../../components/Seite';
import { FormDialog, Kennzahl, Plakette } from '../../components/Bausteine';
import { Tabelle } from '../../components/Tabelle';
import { bestaetigen, fehler, toast } from '../../lib/meldungen';
import { navigieren } from '../../lib/router';
import { useLaden } from '../../lib/useLaden';
import type { SeitenProps } from '../register';
import { AbsageDialog, BASIS, Kopf, PhasenPlakette, absagbar, schuelerName, zeitDe, type SchuelerKurz, type Sprechtag } from './gemeinsam';
import { SprechtagFormular } from './SprechtagFormular';

export default function SprechtagSeite({ teile }: SeitenProps) {
  const { ich } = useSitzung();
  const [a, b, c] = teile;
  if (!a) return <Liste />;
  if (a === 'neu') return <SprechtagFormular id={null} />;
  const id = Number(a);
  if (!id) return <Liste />;
  if (b === 'verwalten') return <SprechtagFormular id={id} />;
  if (ich.rolle === 'eltern' || ich.rolle === 'schueler') return <Eltern id={id} />;
  if (b === 'lehrer' && c) return <LehrkraftSeite id={id} lehrer={c} />;
  return <Start id={id} />;
}

// ------------------------------------------------------------------ Liste

function Liste() {
  const g = useLaden(sig => holen<{ admin: boolean; eltern: boolean; schueler: boolean; sprechtage: { sprechtag: Sprechtag; beteiligt: boolean; termine: number }[] }>(BASIS, sig).then(d => {
    const relevant = d.sprechtage.filter(x => d.admin || d.eltern || d.schueler || x.beteiligt);
    if (!d.admin && relevant.length === 1 && relevant[0].sprechtag.phase !== 'vorbei') navigieren(`#/sprechtag/${relevant[0].sprechtag.id}`, true);
    return d;
  }), []);
  return (
    <Seite titel="Elternsprechtag" aktionen={g.daten?.admin && <Button variant="contained" startIcon={<AddRounded />} href="#/sprechtag/neu">Sprechtag anlegen</Button>}>
      <Geladen g={g}>{d => (
        <Tabelle zeilen={d.sprechtage} schluessel={x => x.sprechtag.id} onZeile={x => navigieren(`#/sprechtag/${x.sprechtag.id}`)}
          leer={d.admin ? 'Noch kein Sprechtag angelegt.' : 'Zurzeit ist kein Sprechtag freigegeben.'}
          spalten={[
            { id: 'name', kopf: 'Sprechtag', zelle: ({ sprechtag: t, beteiligt }) => <Box><Typography sx={{ fontWeight: 500 }}>{t.name}</Typography>
              <Typography variant="body2" color="text.secondary">{t.lehrkraefte.length} Lehrkräfte · {t.zeitfenster} Zeitfenster à {t.dauer} Min.{t.ort ? ` · ${t.ort}` : ''}{beteiligt ? ' · Sie sind beteiligt' : ''}</Typography></Box> },
            { id: 'datum', kopf: 'Datum', nowrap: true, sortWert: x => x.sprechtag.datum, zelle: ({ sprechtag: t }) => `${t.datumText} · ${t.beginn}–${t.ende} Uhr` },
            { id: 'status', kopf: 'Status', zelle: ({ sprechtag: t }) => <PhasenPlakette t={t} familie={d.eltern || d.schueler} /> },
            { id: 'anm', kopf: 'Anmeldung', nowrap: true, verbergenMobil: true, zelle: ({ sprechtag: t }) => <Typography variant="body2" color="text.secondary">{zeitDe(t.anmeldungVon)} – {zeitDe(t.anmeldungBis)}</Typography> },
            { id: 'termine', kopf: 'Termine', rechts: true, zelle: x => x.termine },
            { id: 'akt', kopf: '', rechts: true, nowrap: true, zelle: ({ sprechtag: t }) => d.admin && (
              <Stack direction="row" justifyContent="flex-end" onClick={e => e.stopPropagation()}>
                <IconButton size="small" href={`#/sprechtag/${t.id}/verwalten`} aria-label="Bearbeiten"><EditOutlined fontSize="small" /></IconButton>
                <IconButton size="small" color="error" aria-label="Löschen" onClick={async () => {
                  if (!(await bestaetigen('Sprechtag löschen', `„${t.name}“ mit allen Einladungen und Terminen löschen?`))) return;
                  try { await loeschen(`${BASIS}/${t.id}`); toast('Sprechtag gelöscht.'); void g.neu(); } catch (err) { fehler(err); }
                }}><DeleteOutlineRounded fontSize="small" /></IconButton>
              </Stack>
            ) },
          ]} />
      )}</Geladen>
    </Seite>
  );
}

// ------------------------------------------------------------------ Einstieg: Administration (Übersicht) bzw. Lehrkraft

interface Info { sprechtag: Sprechtag; beteiligt: boolean; admin: boolean; uebersicht: { lehrer: string; name: string; raum?: string; gebucht: number; frei: number; gesperrt: number; einladungen: number }[] }

function Start({ id }: { id: number }) {
  const g = useLaden(sig => holen<Info>(`${BASIS}/${id}`, sig), [id]);
  const [absage, setAbsage] = useState(false);
  if (g.daten?.beteiligt && !g.daten.admin) return <LehrkraftSeite id={id} lehrer={null} />;
  const t = g.daten?.sprechtag;
  return (
    <Seite titel={t?.name ?? 'Elternsprechtag'} aktionen={t && g.daten!.admin && <>
      <Button variant="outlined" startIcon={<PictureAsPdfOutlined />} href={`${BASIS}/${t.id}/plan.pdf`} target="_blank">Gesamtplan (PDF)</Button>
      <Button variant="outlined" startIcon={<PrintOutlined />} href={`${BASIS}/${t.id}/plan.pdf?leer=true`} target="_blank">Aushang</Button>
      {absagbar(t) && <>
        <Button variant="outlined" color="error" startIcon={<CloseRounded />} onClick={() => setAbsage(true)}>Sprechtag absagen</Button>
        <Button variant="contained" startIcon={<EditOutlined />} href={`#/sprechtag/${t.id}/verwalten`}>Bearbeiten</Button>
      </>}
    </>}>
      <Geladen g={g}>{d => {
        const t = d.sprechtag;
        if (!d.admin) return <><Kopf t={t} familie /><Alert severity="info">Sie sind an diesem Sprechtag nicht beteiligt.</Alert></>;
        const abgesagt = new Set(t.lehrkraefte.filter(l => l.abgesagt).map(l => l.lehrer));
        const summe = (k: 'gebucht' | 'frei' | 'gesperrt' | 'einladungen') => d.uebersicht.reduce((n, l) => n + l[k], 0);
        return (
          <>
            <Kopf t={t} />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(5, minmax(0, 1fr))' }, gap: 1.25, mb: 2.5 }}>
              <Kennzahl wert={d.uebersicht.length} text="Lehrkräfte" ton="neutral" /><Kennzahl wert={summe('gebucht')} text="Termine" ton="pruefung" />
              <Kennzahl wert={summe('frei')} text="frei" ton="ok" /><Kennzahl wert={summe('gesperrt')} text="gesperrt" ton="entfall" /><Kennzahl wert={summe('einladungen')} text="Einladungen" ton="termin" />
            </Box>
            <Tabelle zeilen={d.uebersicht} schluessel={l => l.lehrer} onZeile={l => navigieren(`#/sprechtag/${t.id}/lehrer/${encodeURIComponent(l.lehrer)}`)}
              spalten={[
                { id: 'name', kopf: 'Lehrkraft', sortWert: l => l.name, zelle: l => <><b>{l.name}</b> <Plakette>{l.lehrer}</Plakette>{abgesagt.has(l.lehrer) && <Plakette ton="entfall" sx={{ ml: 0.5 }}>abgesagt</Plakette>}</> },
                { id: 'raum', kopf: 'Raum', zelle: l => l.raum || '–' },
                { id: 'g', kopf: 'Termine', rechts: true, sortWert: l => l.gebucht, zelle: l => l.gebucht },
                { id: 'f', kopf: 'Frei', rechts: true, zelle: l => l.frei },
                { id: 's', kopf: 'Gesperrt', rechts: true, zelle: l => l.gesperrt },
                { id: 'e', kopf: 'Einladungen', rechts: true, zelle: l => l.einladungen },
                { id: 'pdf', kopf: '', rechts: true, zelle: l => <Tooltip title="Terminplan (PDF)"><IconButton size="small" href={`${BASIS}/${t.id}/plan.pdf?lehrer=${encodeURIComponent(l.lehrer)}`} target="_blank" onClick={e => e.stopPropagation()}><PictureAsPdfOutlined fontSize="small" /></IconButton></Tooltip> },
              ]} />
            {absage && <AbsageDialog titel="Sprechtag absagen" knopf="Sprechtag absagen" onClose={() => setAbsage(false)}
              text={`„${t.name}“ am ${t.datumText} absagen? Alle gebuchten Termine entfallen; alle beteiligten Lehrkräfte und Erziehungsberechtigten werden per Mitteilung benachrichtigt.`}
              absagen={async grund => { const r = await senden<{ termine: number; benachrichtigt: number }>(`${BASIS}/${t.id}/absagen`, { grund }); toast(`Sprechtag abgesagt · ${r.termine} Termine entfallen · ${r.benachrichtigt} Konten benachrichtigt.`); void g.neu(); }} />}
          </>
        );
      }}</Geladen>
    </Seite>
  );
}

// ------------------------------------------------------------------ Lehrkraft

interface Termin { id: number; schueler: SchuelerKurz; gebuchtVon?: string; quelle?: string; bemerkung: string }
interface Fenster { beginn: string; ende: string; status: 'frei' | 'gebucht' | 'gesperrt'; termin?: Termin }
interface LehrkraftDaten {
  sprechtag: Sprechtag; admin: boolean; darfRaum: boolean; einladenMoeglich: boolean; raeume: { kurz: string; name: string }[];
  lehrer: { name: string; raum?: string; online?: boolean; link?: string; abgesagt?: string | null; absageGrund?: string };
  zeitfenster: Fenster[]; einladungen: { id: number; schueler: SchuelerKurz; termin?: string; benachrichtigt: boolean }[];
  warteliste?: { id: number; schueler: SchuelerKurz; benachrichtigt: boolean }[];
}

function LehrkraftSeite({ id, lehrer }: { id: number; lehrer: string | null }) {
  const q = lehrer ? `?lehrer=${encodeURIComponent(lehrer)}` : '';
  const g = useLaden(async sig => {
    const [d, sch] = await Promise.all([holen<LehrkraftDaten>(`${BASIS}/${id}/lehrkraft${q}`, sig), holen<{ klassen: string[]; eigeneKlassen: string[]; schueler: SchuelerKurz[] }>(`${BASIS}/${id}/schueler${q}`, sig)]);
    return { d, sch };
  }, [id, q]);
  const mit = <T extends object>(o: T) => (lehrer ? { ...o, lehrer } : o);
  const [dialog, setDialog] = useState<null | { art: 'teilnahme' } | { art: 'eintragen'; beginn: string } | { art: 'verschieben'; f: Fenster } | { art: 'storno'; f: Fenster }>(null);
  const [wahl, setWahl] = useState<Set<string>>(new Set());
  const [klasse, setKlasse] = useState<string | null>(null);
  const [einladen, setEinladen] = useState<number[]>([]);
  const [text, setText] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const tue = async (f: () => Promise<unknown>, meldung?: string) => { try { await f(); if (meldung) toast(meldung); setWahl(new Set()); void g.neu(); } catch (err) { fehler(err); } };
  const d = g.daten?.d;
  const t = d?.sprechtag;
  return (
    <Seite titel={t ? (lehrer ? `${t.name} · ${d!.lehrer.name}` : t.name) : 'Elternsprechtag'} aktionen={t && <>
      {absagbar(t) && (d!.lehrer.abgesagt
        ? <Button variant="outlined" color="success" startIcon={<UndoRounded />} onClick={() => tue(() => senden(`${BASIS}/${id}/teilnahme/wiederaufnehmen`, mit({})), 'Teilnahme wieder aufgenommen – die Zeitfenster sind wieder buchbar.')}>Teilnahme wieder aufnehmen</Button>
        : <Button variant="outlined" color="error" startIcon={<CloseRounded />} onClick={() => setDialog({ art: 'teilnahme' })}>Teilnahme absagen</Button>)}
      {d!.admin && <Button variant="outlined" startIcon={<ArrowBackRounded />} href={`#/sprechtag/${id}`}>Übersicht</Button>}
    </>}>
      <Geladen g={g}>{({ d, sch }) => {
        const t = d.sprechtag;
        const gebucht = d.zeitfenster.filter(z => z.status === 'gebucht').length;
        const gesperrt = d.zeitfenster.filter(z => z.status === 'gesperrt').length;
        const kl = klasse ?? sch.eigeneKlassen[0] ?? '';
        const eingeladen = new Set(d.einladungen.map(x => x.schueler.id));
        const auswahl = d.zeitfenster.filter(z => wahl.has(z.beginn));
        const sperren = (beginne: string[], an: boolean) => tue(() => senden(`${BASIS}/${id}/sperren`, mit({ beginne, gesperrt: an }), 'PUT'), an ? `${beginne.length === 1 ? 'Zeitfenster' : beginne.length + ' Zeitfenster'} gesperrt.` : 'Freigegeben.');
        return (
          <>
            <Kopf t={t} zusatz={`${d.lehrer.name}${d.lehrer.raum ? ` · Raum ${d.lehrer.raum}` : ''}`} />
            {d.lehrer.abgesagt && <Alert severity="error" sx={{ mb: 2 }}>Die Teilnahme wurde am {zeitDe(d.lehrer.abgesagt.replace(' ', 'T'))} abgesagt{d.lehrer.absageGrund ? ` (${d.lehrer.absageGrund})` : ''}. Es können keine Termine gebucht werden.</Alert>}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 5fr) minmax(0, 7fr)' }, gap: 2.5, alignItems: 'start' }}>
              <Stack gap={2.5}>
                {d.darfRaum ? (
                  <Paper variant="outlined" sx={{ p: 2.5 }}>
                    <Typography variant="h3" sx={{ mb: 2 }}>Raum und Online-Gespräche</Typography>
                    <TextField select fullWidth label="Raum" value={d.lehrer.raum ?? ''} onChange={e => tue(() => senden(`${BASIS}/${id}/raum`, mit({ raum: e.target.value }), 'PUT'), 'Raum gespeichert.')}>
                      <MenuItem value="">– kein Raum –</MenuItem>{d.raeume.map(r => <MenuItem key={r.kurz} value={r.kurz}>{r.kurz}<Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>{r.name}</Typography></MenuItem>)}
                    </TextField>
                    <FormControlLabel sx={{ mt: 1.5 }} control={<Switch checked={!!d.lehrer.online} onChange={e => tue(() => senden(`${BASIS}/${id}/raum`, mit({ online: e.target.checked, link: link ?? d.lehrer.link ?? '' }), 'PUT'), e.target.checked ? 'Online-Gespräche gespeichert.' : 'Gespräche wieder vor Ort.')} />} label="Gespräche finden online statt" />
                    {d.lehrer.online && (
                      <Stack direction="row" gap={1} sx={{ mt: 1 }}>
                        <TextField fullWidth size="small" value={link ?? d.lehrer.link ?? ''} onChange={e => setLink(e.target.value)} placeholder="https://… (Link zur Videokonferenz)" helperText="Den Link sehen nur Familien mit Termin bei Ihnen." slotProps={{ htmlInput: { maxLength: 500 } }} />
                        <Button variant="outlined" onClick={() => tue(() => senden(`${BASIS}/${id}/raum`, mit({ online: true, link: link ?? '' }), 'PUT'), 'Online-Gespräche gespeichert.')} sx={{ alignSelf: 'flex-start' }}>Speichern</Button>
                      </Stack>
                    )}
                  </Paper>
                ) : d.lehrer.online && <Alert icon={<VideocamOutlined />} severity="info">Ihre Gespräche finden online statt{d.lehrer.link ? `: ${d.lehrer.link}` : ''}.</Alert>}
                {!!d.warteliste?.length && (
                  <Paper variant="outlined" sx={{ p: 2.5 }}>
                    <Typography variant="h3" sx={{ mb: 1 }}>Warteliste <Plakette>{d.warteliste.length}</Plakette></Typography>
                    <Table size="small"><TableBody>{d.warteliste.map(w => (
                      <TableRow key={w.id}><TableCell>{w.schueler.klasse}</TableCell><TableCell sx={{ fontWeight: 500 }}>{schuelerName(w.schueler)}</TableCell>
                        <TableCell>{w.benachrichtigt ? <Plakette ton="ok">benachrichtigt</Plakette> : <Plakette ton="termin">wartet</Plakette>}</TableCell>
                        <TableCell align="right"><IconButton size="small" color="error" aria-label="Von der Warteliste nehmen" onClick={() => tue(() => loeschen(`${BASIS}/${id}/warteliste/${w.id}`), 'Von der Warteliste genommen.')}><CloseRounded fontSize="small" /></IconButton></TableCell></TableRow>
                    ))}</TableBody></Table>
                  </Paper>
                )}
                <Paper variant="outlined" sx={{ p: 2.5 }}>
                  <Stack direction="row" alignItems="center" sx={{ mb: 1.5 }}><Typography variant="h3" sx={{ flex: 1 }}>Gespräche wünschen</Typography><Plakette ton="termin">{d.einladungen.length} Einladungen</Plakette></Stack>
                  {d.einladenMoeglich ? (
                    <Stack gap={1.5} sx={{ mb: 2 }}>
                      <Stack direction="row" gap={1.5}>
                        <TextField select label="Klasse" value={kl} onChange={e => { setKlasse(e.target.value); setEinladen([]); }} sx={{ width: 150 }}>
                          <MenuItem value="">alle Klassen</MenuItem>{sch.klassen.map(k => <MenuItem key={k} value={k}>{k}{sch.eigeneKlassen.includes(k) ? ' · eigene' : ''}</MenuItem>)}
                        </TextField>
                        <TextField select label="Schüler*innen" value={einladen} onChange={e => setEinladen(typeof e.target.value === 'string' ? [] : (e.target.value as unknown as number[]))} sx={{ flex: 1, minWidth: 0 }}
                          slotProps={{ select: { multiple: true, renderValue: v => `${(v as number[]).length} gewählt` } }}>
                          {sch.schueler.filter(s => !kl || s.klasse === kl).map(s => (
                            <MenuItem key={s.id} value={s.id} disabled={eingeladen.has(s.id)}><Checkbox size="small" checked={einladen.includes(s.id)} sx={{ p: 0.5, mr: 1 }} />
                              {schuelerName(s)}<Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>{s.klasse}{s.elternkonto ? '' : ' · ohne Elternkonto'}{eingeladen.has(s.id) ? ' · bereits eingeladen' : ''}</Typography></MenuItem>
                          ))}
                        </TextField>
                      </Stack>
                      <TextField label="Nachricht an die Eltern (optional)" value={text} onChange={e => setText(e.target.value)} placeholder="z. B. Anlass des Gesprächs" slotProps={{ htmlInput: { maxLength: 1000 } }} />
                      <Button variant="contained" startIcon={<SendRounded />} sx={{ alignSelf: 'flex-start' }} onClick={() => {
                        if (!einladen.length) { toast('Bitte mindestens eine Schülerin bzw. einen Schüler wählen.', true); return; }
                        void tue(async () => {
                          const r = await senden<{ neu: number; ohneKonto: string[] }>(`${BASIS}/${id}/einladungen`, mit({ schuelerIds: einladen, text }));
                          toast(`${r.neu} ${r.neu === 1 ? 'Einladung' : 'Einladungen'} versendet${r.ohneKonto.length ? ` – ohne Elternkonto: ${r.ohneKonto.join(', ')}` : ''}.`);
                          setEinladen([]); setText('');
                        });
                      }}>Anfordern</Button>
                    </Stack>
                  ) : <Alert severity="info" sx={{ mb: 2 }}>{t.phase === 'vorbereitung' ? 'Der Sprechtag ist noch nicht freigegeben.' : 'Die Einladungsphase ist beendet.'}</Alert>}
                  {d.einladungen.length ? (
                    <Table size="small"><TableHead><TableRow><TableCell>Klasse</TableCell><TableCell>Schüler*in</TableCell><TableCell>Status</TableCell><TableCell /></TableRow></TableHead>
                      <TableBody>{d.einladungen.slice().sort((x, y) => (x.schueler.klasse || '').localeCompare(y.schueler.klasse || '', 'de') || schuelerName(x.schueler).localeCompare(schuelerName(y.schueler), 'de')).map(x => (
                        <TableRow key={x.id}><TableCell>{x.schueler.klasse}</TableCell><TableCell sx={{ fontWeight: 500 }}>{schuelerName(x.schueler)}</TableCell>
                          <TableCell>{x.termin ? <Plakette ton="ok">Termin {x.termin}</Plakette> : x.benachrichtigt ? <Plakette ton="termin">eingeladen</Plakette> : <Plakette ton="pruefung" title="Kein Elternkonto – bitte anders benachrichtigen">ohne Elternkonto</Plakette>}</TableCell>
                          <TableCell align="right"><IconButton size="small" color="error" aria-label="Einladung löschen" onClick={() => tue(() => loeschen(`${BASIS}/${id}/einladungen/${x.id}`), 'Einladung gelöscht.')}><CloseRounded fontSize="small" /></IconButton></TableCell></TableRow>
                      ))}</TableBody></Table>
                  ) : <Typography variant="body2" color="text.secondary">Noch keine Einladungen.</Typography>}
                </Paper>
              </Stack>
              <Paper variant="outlined" sx={{ p: 2.5 }}>
                <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{ mb: 1.5 }}>
                  <Typography variant="h3" sx={{ flex: 1 }}>Meine Termine</Typography>
                  <Plakette ton="pruefung">{gebucht} gebucht</Plakette>{gesperrt > 0 && <Plakette ton="entfall">{gesperrt} gesperrt</Plakette>}
                  <Button size="small" variant="outlined" startIcon={<PictureAsPdfOutlined />} href={`${BASIS}/${id}/plan.pdf${q}`} target="_blank">Terminliste</Button>
                  <Button size="small" variant="outlined" startIcon={<PrintOutlined />} href={`${BASIS}/${id}/plan.pdf?leer=true${lehrer ? `&lehrer=${encodeURIComponent(lehrer)}` : ''}`} target="_blank">Aushang</Button>
                </Stack>
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead><TableRow><TableCell padding="checkbox" /><TableCell>Termin</TableCell><TableCell>Schüler*in</TableCell><TableCell>Klasse</TableCell><TableCell>Hinweis</TableCell><TableCell /></TableRow></TableHead>
                    <TableBody>{d.zeitfenster.map(z => {
                      const x = z.termin;
                      return (
                        <TableRow key={z.beginn} selected={wahl.has(z.beginn)} sx={{ bgcolor: z.status === 'gesperrt' ? 'action.hover' : undefined }}>
                          <TableCell padding="checkbox">{z.status !== 'gebucht' && <Checkbox size="small" checked={wahl.has(z.beginn)} onChange={e => setWahl(s => { const n = new Set(s); if (e.target.checked) n.add(z.beginn); else n.delete(z.beginn); return n; })} aria-label={`Zeitfenster ${z.beginn} wählen`} />}</TableCell>
                          <TableCell sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: z.status === 'gebucht' ? 'primary.main' : undefined }}>{z.beginn}</TableCell>
                          <TableCell sx={{ fontWeight: x ? 500 : 400 }}>{x ? schuelerName(x.schueler) : z.status === 'gesperrt' ? <Plakette ton="entfall">abwesend</Plakette> : <Typography variant="body2" color="text.secondary">frei</Typography>}</TableCell>
                          <TableCell>{x?.schueler.klasse}</TableCell>
                          <TableCell><Typography variant="body2" color="text.secondary">{x ? [x.gebuchtVon ? `gebucht von ${x.gebuchtVon}` : x.quelle === 'eltern' ? '' : 'eingetragen', x.bemerkung].filter(Boolean).join(' · ') : ''}</Typography></TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            {x ? <>
                              <Tooltip title="Verschieben"><IconButton size="small" onClick={() => setDialog({ art: 'verschieben', f: z })}><SwapHorizRounded fontSize="small" /></IconButton></Tooltip>
                              <Tooltip title="Absagen"><IconButton size="small" color="error" onClick={() => setDialog({ art: 'storno', f: z })}><CloseRounded fontSize="small" /></IconButton></Tooltip>
                            </> : z.status === 'frei' ? <>
                              <Tooltip title="Termin eintragen"><IconButton size="small" onClick={() => setDialog({ art: 'eintragen', beginn: z.beginn })}><AddRounded fontSize="small" /></IconButton></Tooltip>
                              <Tooltip title="Sperren (abwesend)"><IconButton size="small" onClick={() => sperren([z.beginn], true)}><LockOutlined fontSize="small" /></IconButton></Tooltip>
                            </> : <Tooltip title="Freigeben"><IconButton size="small" onClick={() => sperren([z.beginn], false)}><LockOpenOutlined fontSize="small" /></IconButton></Tooltip>}
                          </TableCell>
                        </TableRow>
                      );
                    })}</TableBody>
                  </Table>
                </Box>
                <Stack direction="row" gap={1} alignItems="center" sx={{ mt: 1.5 }} flexWrap="wrap">
                  <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>{wahl.size ? `${wahl.size} Zeitfenster gewählt` : 'Zeitfenster wählen, um sie zu sperren (abwesend) oder freizugeben.'}</Typography>
                  <Button size="small" color="error" variant="outlined" startIcon={<LockOutlined />} disabled={!auswahl.some(z => z.status === 'frei')} onClick={() => sperren(auswahl.filter(z => z.status === 'frei').map(z => z.beginn), true)}>Sperren</Button>
                  <Button size="small" color="success" variant="outlined" startIcon={<LockOpenOutlined />} disabled={!auswahl.some(z => z.status === 'gesperrt')} onClick={() => sperren(auswahl.filter(z => z.status === 'gesperrt').map(z => z.beginn), false)}>Freigeben</Button>
                </Stack>
              </Paper>
            </Box>
            {dialog?.art === 'teilnahme' && <AbsageDialog titel="Teilnahme absagen" knopf="Teilnahme absagen" onClose={() => setDialog(null)}
              text={`${lehrer ? d.lehrer.name : 'Ihre'} Teilnahme am Sprechtag „${t.name}“ absagen? ${gebucht ? `${gebucht} gebuchte(r) Termin(e) entfallen; die Erziehungsberechtigten werden per Mitteilung benachrichtigt.` : 'Es sind noch keine Termine gebucht.'}`}
              absagen={async grund => { const r = await senden<{ termine: number; benachrichtigt: number }>(`${BASIS}/${id}/teilnahme/absagen`, mit({ grund })); toast(`Teilnahme abgesagt · ${r.termine} Termine entfallen · ${r.benachrichtigt} Konten benachrichtigt.`); void g.neu(); }} />}
            {dialog?.art === 'storno' && <AbsageDialog titel="Termin absagen" onClose={() => setDialog(null)}
              text={`Termin um ${dialog.f.beginn} Uhr mit ${schuelerName(dialog.f.termin!.schueler)} absagen? Die Erziehungsberechtigten werden per Mitteilung informiert.`}
              absagen={async grund => { await senden(`${BASIS}/${id}/termine/${dialog.f.termin!.id}/absagen`, { grund }); toast('Termin abgesagt.'); void g.neu(); }} />}
            {(dialog?.art === 'eintragen' || dialog?.art === 'verschieben') && (
              <TerminDialog fenster={d.zeitfenster} sch={sch} vorgabeKlasse={kl} f={dialog.art === 'verschieben' ? dialog.f : null} beginn={dialog.art === 'eintragen' ? dialog.beginn : dialog.f.beginn}
                onClose={() => setDialog(null)} speichern={async (w) => {
                  if (dialog.art === 'eintragen') { await senden(`${BASIS}/${id}/termine`, mit({ schuelerId: w.schuelerId, beginn: w.beginn, bemerkung: w.bemerkung })); toast('Termin eingetragen.'); }
                  else { await senden(`${BASIS}/${id}/termine/${dialog.f.termin!.id}`, { beginn: w.beginn, bemerkung: w.bemerkung }, 'PUT'); toast('Termin gespeichert.'); }
                  void g.neu();
                }} />
            )}
          </>
        );
      }}</Geladen>
    </Seite>
  );
}

function TerminDialog({ fenster, sch, vorgabeKlasse, f, beginn: b0, onClose, speichern }: {
  fenster: Fenster[]; sch: { klassen: string[]; schueler: SchuelerKurz[] }; vorgabeKlasse: string; f: Fenster | null; beginn: string; onClose: () => void;
  speichern: (w: { schuelerId: number; beginn: string; bemerkung: string }) => Promise<void>;
}) {
  const [klasse, setKlasse] = useState(vorgabeKlasse);
  const [sid, setSid] = useState<number | ''>('');
  const [beginn, setBeginn] = useState(b0);
  const [bemerkung, setBemerkung] = useState(f?.termin?.bemerkung ?? '');
  const frei = fenster.filter(z => z.status !== 'gebucht' || (f && z.termin?.id === f.termin?.id));
  return (
    <FormDialog offen titel={f ? `Termin verschieben · ${schuelerName(f.termin!.schueler)}` : `Termin eintragen · ${b0} Uhr`} onClose={onClose} aktionText={f ? 'Speichern' : 'Eintragen'}
      aktion={async () => { if (!f && !sid) { toast('Bitte eine Schülerin bzw. einen Schüler wählen.', true); return false; } await speichern({ schuelerId: Number(sid), beginn, bemerkung }); }}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        {!f && <Stack direction="row" gap={2}>
          <TextField select label="Klasse" value={klasse} onChange={e => { setKlasse(e.target.value); setSid(''); }} sx={{ width: 150 }}><MenuItem value="">alle Klassen</MenuItem>{sch.klassen.map(k => <MenuItem key={k} value={k}>{k}</MenuItem>)}</TextField>
          <TextField select label="Schüler*in" value={sid} onChange={e => setSid(Number(e.target.value))} sx={{ flex: 1 }}>{sch.schueler.filter(s => !klasse || s.klasse === klasse).map(s => <MenuItem key={s.id} value={s.id}>{schuelerName(s)} <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>{s.klasse}</Typography></MenuItem>)}</TextField>
        </Stack>}
        <TextField select label={f ? 'Neue Uhrzeit' : 'Uhrzeit'} value={beginn} onChange={e => setBeginn(e.target.value)}>{frei.map(z => <MenuItem key={z.beginn} value={z.beginn}>{z.beginn}–{z.ende}{z.status === 'gesperrt' ? ' · gesperrt' : ''}</MenuItem>)}</TextField>
        <TextField label={f ? 'Bemerkung' : 'Bemerkung (optional)'} value={bemerkung} onChange={e => setBemerkung(e.target.value)} placeholder="z. B. telefonisch vereinbart" slotProps={{ htmlInput: { maxLength: 500 } }} />
        {f?.termin?.gebuchtVon && <Typography variant="body2" color="text.secondary">Die Erziehungsberechtigten werden per Mitteilung über die neue Uhrzeit informiert.</Typography>}
      </Stack>
    </FormDialog>
  );
}

// ------------------------------------------------------------------ Erziehungsberechtigte bzw. Schüler*innen

interface ElternLehrkraft {
  kurz: string; name: string; faecher: string[]; dauer: number; raum?: string; online?: boolean; klassenleitung?: boolean; eingeladen?: boolean; einladungText?: string; abgesagt?: boolean;
  termin?: { id: number; beginn: string; ende: string }; warteliste?: { id: number; position: number }; ausgebucht?: boolean; zeitfenster?: { beginn: string; ende: string; konflikt?: boolean }[];
}
interface ElternDaten {
  sprechtag: Sprechtag; nurLesen?: boolean; buchbar: boolean; warteliste: boolean; maxTermine: number; gebuchtFamilie: number;
  termine: { id: number; beginn: string; ende: string; lehrerName: string; raum?: string; online?: boolean; link?: string; schueler: SchuelerKurz }[];
  kinder: (SchuelerKurz & { lehrkraefte: ElternLehrkraft[] })[];
}

function Eltern({ id }: { id: number }) {
  const g = useLaden(sig => holen<ElternDaten>(`${BASIS}/${id}/eltern`, sig), [id]);
  const [zeiten, setZeiten] = useState<Record<string, string>>({});
  const [storno, setStorno] = useState<{ id: number; text: string } | null>(null);
  const tue = async (f: () => Promise<unknown>) => { try { await f(); void g.neu(); } catch (err) { fehler(err); } };
  const d = g.daten;
  return (
    <Seite titel={d?.sprechtag.name ?? 'Elternsprechtag'} aktionen={d && !d.nurLesen && <Button variant="outlined" startIcon={<PictureAsPdfOutlined />} href={`${BASIS}/${id}/elternplan.pdf`} target="_blank">Meine Termine (PDF)</Button>}>
      <Geladen g={g}>{d => {
        const t = d.sprechtag;
        const lesen = !!d.nurLesen;
        const termine = d.termine.slice().sort((a, b) => a.beginn.localeCompare(b.beginn));
        const voll = d.maxTermine > 0 && d.gebuchtFamilie >= d.maxTermine;
        const optionen = [d.maxTermine > 0 ? `höchstens ${d.maxTermine} Termine je Familie (gebucht: ${d.gebuchtFamilie})` : '', d.warteliste ? 'Warteliste bei ausgebuchten Lehrkräften' : ''].filter(Boolean).join(' · ');
        const terminZelle = (k: SchuelerKurz, l: ElternLehrkraft) => {
          const schl = `${k.id}-${l.kurz}`;
          if (l.termin) return <Stack direction="row" gap={1} alignItems="center"><Typography sx={{ fontWeight: 600, color: 'primary.main' }}>{l.termin.beginn}</Typography><Typography variant="body2" color="text.secondary">bis {l.termin.ende}</Typography>
            {absagbar(t) && !lesen && <Button size="small" color="error" onClick={() => setStorno({ id: l.termin!.id, text: `${l.termin!.beginn} Uhr bei ${l.name}` })}>Absagen</Button>}</Stack>;
          if (l.abgesagt) return <Plakette ton="entfall">Teilnahme abgesagt</Plakette>;
          if (l.warteliste) return <Stack direction="row" gap={1} alignItems="center"><Plakette ton="termin">Warteliste · Platz {l.warteliste.position}</Plakette>
            {!lesen && <Button size="small" onClick={() => tue(async () => { await loeschen(`${BASIS}/${id}/warteliste/${l.warteliste!.id}`); toast('Von der Warteliste ausgetragen.'); })}>Austragen</Button>}</Stack>;
          if (lesen) return <Typography variant="body2" color="text.secondary">{t.status === 'angekuendigt' ? `Buchung ab ${zeitDe(t.anmeldungVon)}` : d.buchbar ? '' : '–'}</Typography>;
          if (!d.buchbar) return <Typography variant="body2" color="text.secondary">{t.status === 'angekuendigt' || t.phase === 'einladung' ? `Buchung ab ${zeitDe(t.anmeldungVon)}` : 'keine Buchung mehr möglich'}</Typography>;
          if (l.ausgebucht || !l.zeitfenster?.length) return d.warteliste
            ? <Stack direction="row" gap={1} alignItems="center"><Typography variant="body2" color="text.secondary">ausgebucht</Typography><Button size="small" variant="outlined" onClick={() => tue(async () => {
              const r = await senden<{ position: number }>(`${BASIS}/${id}/warteliste`, { lehrer: l.kurz, schuelerId: k.id }); toast(`Auf der Warteliste (Platz ${r.position}). Sie erhalten eine Mitteilung, sobald ein Termin frei wird.`);
            })}>Auf die Warteliste</Button></Stack>
            : <Typography variant="body2" color="text.secondary">keine freien Termine</Typography>;
          if (voll) return <Typography variant="body2" color="text.secondary">Höchstzahl von {d.maxTermine} Terminen erreicht</Typography>;
          return (
            <Stack direction="row" gap={1} alignItems="center">
              <TextField select size="small" label="Uhrzeit" value={zeiten[schl] ?? ''} onChange={e => setZeiten({ ...zeiten, [schl]: e.target.value })} sx={{ width: 150 }}>
                {l.zeitfenster.map(z => <MenuItem key={z.beginn} value={z.beginn} disabled={z.konflikt}>{z.beginn}–{z.ende}{z.konflikt ? ' · Überschneidung' : ''}</MenuItem>)}
              </TextField>
              <Button variant="contained" size="small" disabled={!zeiten[schl]} onClick={() => tue(async () => { await senden(`${BASIS}/${id}/buchen`, { lehrer: l.kurz, schuelerId: k.id, beginn: zeiten[schl] }); toast(`Termin um ${zeiten[schl]} Uhr gebucht.`); })}>Buchen</Button>
            </Stack>
          );
        };
        return (
          <Stack gap={2.5}>
            <Kopf t={t} familie />
            {t.status === 'angekuendigt' && (
              <Paper variant="outlined" sx={{ p: 2.5 }}>
                <Typography variant="h3" sx={{ mb: 1.5 }}>Angekündigt</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: 2 }}>
                  {[['Datum', [t.datumText, ...(t.reihe ?? []).filter(r => r.id !== t.id).map(r => r.datumText)].join(' · ')], ['Uhrzeit', `${t.beginn}–${t.ende} Uhr`], ...(t.ort ? [['Ort', t.ort]] : []),
                    ['Anmeldung', `${t.anmeldungVonText} – ${t.anmeldungBisText}`]].map(([k, v]) => <Box key={k}><Typography variant="caption" color="text.secondary">{k}</Typography><Typography sx={{ fontWeight: 500 }}>{v}</Typography></Box>)}
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>{lesen ? 'Die Termine buchen deine Erziehungsberechtigten im Anmeldezeitraum.' : 'Die Buchung ist ab Beginn der Anmeldung möglich. Unten sehen Sie bereits die beteiligten Lehrkräfte Ihres Kindes.'}</Typography>
              </Paper>
            )}
            {optionen && !lesen && <Alert severity="info">{optionen}</Alert>}
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 1.5 }}><Typography variant="h3">{lesen ? 'Termine' : 'Meine Termine'}</Typography><Plakette ton="pruefung">{termine.length}</Plakette></Stack>
              {termine.length ? (
                <Box sx={{ overflowX: 'auto' }}><Table size="small"><TableHead><TableRow><TableCell>Zeit</TableCell><TableCell>Lehrkraft</TableCell><TableCell>Ort</TableCell><TableCell>Kind</TableCell><TableCell /></TableRow></TableHead>
                  <TableBody>{termine.map(x => (
                    <TableRow key={x.id}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}><b>{x.beginn}</b> <Typography component="span" variant="body2" color="text.secondary">– {x.ende}</Typography></TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{x.lehrerName}</TableCell>
                      <TableCell>{x.online ? (x.link ? <Button size="small" startIcon={<VideocamOutlined />} href={x.link} target="_blank" rel="noopener noreferrer">Online-Gespräch</Button> : 'online') : x.raum || '–'}</TableCell>
                      <TableCell>{x.schueler.vorname} {x.schueler.name} <Typography component="span" variant="body2" color="text.secondary">{x.schueler.klasse}</Typography></TableCell>
                      <TableCell align="right">{absagbar(t) && !lesen && <Button size="small" color="error" onClick={() => setStorno({ id: x.id, text: `${x.beginn} Uhr bei ${x.lehrerName}` })}>Absagen</Button>}</TableCell>
                    </TableRow>
                  ))}</TableBody></Table></Box>
              ) : <Typography variant="body2" color="text.secondary">Noch keine Termine gebucht.</Typography>}
            </Paper>
            {d.kinder.length ? d.kinder.map(k => (
              <Paper key={k.id} variant="outlined" sx={{ p: 2.5 }}>
                <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 1.5 }}><Typography variant="h3">{lesen ? 'Beteiligte Lehrkräfte' : `Lehrkräfte von ${k.vorname} ${k.name}`}</Typography><Plakette>{k.klasse}</Plakette></Stack>
                {k.lehrkraefte.length ? (
                  <Box sx={{ overflowX: 'auto' }}><Table size="small"><TableHead><TableRow><TableCell>Lehrkraft</TableCell><TableCell>Fächer</TableCell><TableCell>Ort</TableCell><TableCell>Termin</TableCell></TableRow></TableHead>
                    <TableBody>{k.lehrkraefte.map(l => (
                      <TableRow key={l.kurz}>
                        <TableCell><Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap"><Typography sx={{ fontWeight: 500 }}>{l.name}</Typography>
                          {l.klassenleitung && <Plakette>Klassenleitung</Plakette>}{l.online && <Plakette><VideocamOutlined sx={{ fontSize: 13 }} />online</Plakette>}
                          {l.eingeladen && <Plakette ton="termin" title={l.einladungText}>Einladung</Plakette>}</Stack></TableCell>
                        <TableCell><Typography variant="body2" color="text.secondary">{l.faecher.join(', ')}{l.dauer !== t.dauer ? ` · ${l.dauer} Min.` : ''}</Typography></TableCell>
                        <TableCell>{l.online ? 'online' : l.raum || '–'}</TableCell>
                        <TableCell>{terminZelle(k, l)}</TableCell>
                      </TableRow>
                    ))}</TableBody></Table></Box>
                ) : <Typography variant="body2" color="text.secondary">{lesen ? 'Keine deiner Lehrkräfte nimmt an diesem Sprechtag teil.' : 'Keine Lehrkraft Ihres Kindes nimmt an diesem Sprechtag teil.'}</Typography>}
              </Paper>
            )) : <Leer text={lesen ? 'Deinem Konto ist keine Schülerin bzw. kein Schüler zugeordnet.' : 'Ihrem Konto ist kein Kind zugeordnet. Bitte wenden Sie sich an die Schule.'} />}
            {storno && <AbsageDialog titel="Termin absagen" onClose={() => setStorno(null)} text={`Termin ${storno.text} absagen? Die Lehrkraft wird per Mitteilung informiert.`}
              absagen={async grund => { await senden(`${BASIS}/${id}/termine/${storno.id}/absagen`, { grund }); toast('Termin abgesagt.'); void g.neu(); }} />}
          </Stack>
        );
      }}</Geladen>
    </Seite>
  );
}
