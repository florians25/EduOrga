// Administration → Import → Schüler*innen: CSV/TXT hochladen (Trennzeichen und Kodierung automatisch), Vorschau, Spaltenzuordnung mit Vorlagen,
// Abgleich-Modus, Trockenlauf mit Ergebnisliste und Übernahme (optional mit Konten). Dazu die Quelle der Schülerdaten (auch unter Ansichtseinstellungen).
import { useEffect, useState } from 'react';
import { Alert, Box, Button, Checkbox, FormControlLabel, ListSubheader, MenuItem, Paper, Radio, RadioGroup, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { api, holen, loeschen, senden, speichern } from '../../api/client';
import { Geladen } from '../../components/Seite';
import { FormDialog, Plakette, type Ton } from '../../components/Bausteine';
import { heuteIso } from '../../lib/datum';
import { bestaetigen, fehler, toast } from '../../lib/meldungen';
import { useLaden } from '../../lib/useLaden';
import { Karte } from './Admin';

const STATUS: Record<string, [Ton, string]> = { neu: ['ok', 'neu'], geaendert: ['pruefung', 'geändert'], unveraendert: ['neutral', 'unverändert'], uebersprungen: ['neutral', 'übersprungen'], fehler: ['entfall', 'Fehler'], ausgetreten: ['termin', 'ausgetreten'] };
const QUELLE: Record<string, string> = { export: 'Studio-Export', web: 'Web-Verwaltung' };

export function QuelleKarte({ nachher }: { nachher?: (q: string) => void }) {
  const g = useLaden(sig => holen<{ quelle: string }>('/api/app/admin/schuelerimport/quelle', sig), []);
  return (
    <Karte titel="Quelle der Schülerdaten" sx={{ maxWidth: 860 }}>
      <Geladen g={g}>{q => (
        <>
          <RadioGroup value={q.quelle} onChange={async e => {
            const v = e.target.value;
            if (!(await bestaetigen('Quelle der Schülerdaten', `Quelle auf „${QUELLE[v]}“ umstellen?`, 'Umstellen'))) return;
            try { const n = await senden<{ quelle: string; uebernommen?: number }>('/api/app/admin/schuelerimport/quelle', { quelle: v }, 'PUT'); toast(n.uebernommen ? `Umgestellt – ${n.uebernommen} Schüler*innen übernommen.` : 'Umgestellt.'); g.setDaten({ quelle: n.quelle }); nachher?.(n.quelle); } catch (err) { fehler(err); }
          }}>
            {Object.entries(QUELLE).map(([id, t]) => <FormControlLabel key={id} value={id} control={<Radio />} sx={{ alignItems: 'flex-start', mb: 1 }} label={<Box sx={{ pt: 1 }}><b>{t}</b> – {id === 'export' ? 'Schüler*innen kommen mit jeder Übertragung aus der Desktop-App; Änderungen in EduOrga Web ergänzen sie.' : 'Schüler*innen werden in EduOrga Web gepflegt (Schülerverwaltung, CSV-Import); der Export überschreibt sie nicht.'}</Box>} />)}
          </RadioGroup>
          <Typography variant="body2" color="text.secondary">Beim Wechsel zur Web-Verwaltung werden die bisher übertragenen Schüler*innen übernommen.</Typography>
        </>
      )}</Geladen>
    </Karte>
  );
}

interface Grundlagen { schueler: number; quelle: string; darfQuelle: boolean; darfKonten: boolean; schemata: string[]; felder: { id: string; name: string; gruppe: string }[]; vorlagen: Vorlage[] }
interface Vorlage { name: string; kopfzeile: boolean; ueberschriften?: Record<string, string>; spalten?: Record<string, string> }
interface Datei { datei: string; anzahl: number; kodierung: string; trennzeichen: string; kopfzeile: boolean; vorschlag: Record<string, string>; ueberschriften: string[]; spalten: number; vorschau: string[][]; zeilen: string[][] }
interface Ergebnis { neu: number; geaendert: number; unveraendert: number; uebersprungen: number; fehler: number; ausgetreten: number; zeilen: { zeile: number; status: string; name: string; klasse: string; fehler?: string; aenderungen: string[]; hinweise: string[] }[]; konten?: unknown[]; csv?: string }

export function SchuelerImport() {
  const g = useLaden(sig => holen<Grundlagen>('/api/app/admin/schuelerimport/grundlagen', sig), []);
  const [quelle, setQuelle] = useState<string | null>(null);
  const [trenner, setTrenner] = useState('');
  const [kodierung, setKodierung] = useState('');
  const [datei, setDatei] = useState<File | null>(null);
  const [d, setD] = useState<Datei | null>(null);
  const [kopfzeile, setKopfzeile] = useState(true);
  const [zuordnung, setZuordnung] = useState<Record<string, string>>({});
  const [opt, setOpt] = useState({ modus: 'aktualisieren', schluessel: 'auto', schema: '', austrittMarkieren: false, kontenSchueler: false, kontenEltern: false });
  const [ergebnis, setErgebnis] = useState<{ r: Ergebnis; uebernommen: boolean } | null>(null);
  const [vorlageName, setVorlageName] = useState<string | null>(null);
  const [vorlage, setVorlage] = useState('');
  const [konten, setKonten] = useState<Ergebnis | null>(null);

  useEffect(() => {
    if (!datei) return;
    const fd = new FormData();
    fd.append('datei', datei); fd.append('trennzeichen', trenner); fd.append('kodierung', kodierung);
    api<Datei>('/api/app/admin/schuelerimport/lesen', { methode: 'POST', formular: fd }).then(x => { setD(x); setKopfzeile(x.kopfzeile); setZuordnung({ ...x.vorschlag }); setErgebnis(null); }).catch(fehler);
  }, [datei, trenner, kodierung]);

  const ausfuehren = async (gr: Grundlagen, uebernehmen: boolean) => {
    if (!d) return;
    try {
      const r = await senden<Ergebnis>(`/api/app/admin/schuelerimport/${uebernehmen ? 'uebernehmen' : 'pruefen'}`, { zeilen: d.zeilen, kopfzeile, zuordnung, optionen: { ...opt, schema: opt.schema || gr.schemata.filter(s => s !== 'kuerzel')[0] } });
      setErgebnis({ r, uebernommen: uebernehmen });
      if (uebernehmen) { toast('Import übernommen.'); if (r.konten?.length) setKonten(r); }
    } catch (err) { fehler(err); }
  };

  return (
    <Geladen g={g}>{gr => {
      const q = quelle ?? gr.quelle;
      const gruppen = [...new Set(gr.felder.map(f => f.gruppe))];
      return (
        <Stack gap={2.5}>
          {gr.darfQuelle ? <QuelleKarte nachher={setQuelle} /> : <Alert severity="info">Quelle der Schülerdaten: {QUELLE[q]}.</Alert>}
          <Karte titel="1 · Datei wählen">
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>CSV- oder TXT-Datei (Trennzeichen ; , oder Tab, UTF-8 oder Windows-1252 – beides wird erkannt). Aktuell {gr.schueler} Schüler*innen.</Typography>
            <Stack direction="row" gap={2} flexWrap="wrap" alignItems="center">
              <Button component="label" variant="outlined">Datei wählen<input type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={e => { setDatei(e.target.files?.[0] ?? null); e.target.value = ''; }} /></Button>
              <TextField select size="small" label="Trennzeichen" value={trenner} onChange={e => setTrenner(e.target.value)} sx={{ width: 160 }}><MenuItem value="">automatisch</MenuItem><MenuItem value=";">Semikolon</MenuItem><MenuItem value=",">Komma</MenuItem><MenuItem value="tab">Tabulator</MenuItem></TextField>
              <TextField select size="small" label="Kodierung" value={kodierung} onChange={e => setKodierung(e.target.value)} sx={{ width: 160 }}><MenuItem value="">automatisch</MenuItem><MenuItem value="utf-8">UTF-8</MenuItem><MenuItem value="windows-1252">Windows-1252</MenuItem></TextField>
              {d && <Typography variant="body2" color="text.secondary">{d.datei}: {d.anzahl} Zeilen · {d.kodierung} · Trennzeichen {d.trennzeichen === 'tab' ? 'Tabulator' : `„${d.trennzeichen}“`}</Typography>}
            </Stack>
          </Karte>
          {d && (
            <Karte titel="2 · Spalten zuordnen">
              <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="center" sx={{ mb: 1.5 }}>
                <FormControlLabel control={<Switch checked={kopfzeile} onChange={e => setKopfzeile(e.target.checked)} />} label="Erste Zeile ist Kopfzeile" />
                <TextField select size="small" label="Vorlage anwenden" value={vorlage} sx={{ minWidth: 220 }} onChange={e => {
                  setVorlage(e.target.value);
                  const v = gr.vorlagen.find(x => x.name === e.target.value);
                  if (!v) return;
                  const z: Record<string, string> = {};
                  d.ueberschriften.forEach((u, i) => { if (v.ueberschriften?.[u]) z[i] = v.ueberschriften[u]; });
                  if (!Object.keys(z).length) Object.entries(v.spalten ?? {}).forEach(([i, f]) => { if (Number(i) < d.spalten) z[i] = f; });
                  setKopfzeile(v.kopfzeile); setZuordnung(z);
                }}><MenuItem value="">–</MenuItem>{gr.vorlagen.map(v => <MenuItem key={v.name} value={v.name}>{v.name}</MenuItem>)}</TextField>
                <Button size="small" onClick={() => setVorlageName('')}>Als Vorlage speichern</Button>
                {vorlage && <Button size="small" color="error" onClick={async () => {
                  if (!(await bestaetigen('Vorlage löschen', `Vorlage „${vorlage}“ löschen?`))) return;
                  await loeschen(`/api/app/admin/schuelerimport/vorlagen/${encodeURIComponent(vorlage)}`); setVorlage(''); void g.neu();
                }}>Vorlage löschen</Button>}
              </Stack>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ '& td': { whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12.5 } }}>
                  <TableHead><TableRow>{d.ueberschriften.map((u, i) => (
                    <TableCell key={i} sx={{ verticalAlign: 'bottom', minWidth: 170 }}>
                      <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>{kopfzeile ? u : `Spalte ${i + 1}`}</Typography>
                      <TextField select size="small" fullWidth value={zuordnung[i] ?? ''} onChange={e => setZuordnung(z => { const n = { ...z }; Object.keys(n).forEach(x => { if (e.target.value && n[x] === e.target.value) delete n[x]; }); if (e.target.value) n[i] = e.target.value; else delete n[i]; return n; })}>
                        <MenuItem value="">– nicht übernehmen –</MenuItem>
                        {gruppen.flatMap(gg => [<ListSubheader key={'h' + gg}>{gg}</ListSubheader>, ...gr.felder.filter(f => f.gruppe === gg).map(f => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)])}
                      </TextField>
                    </TableCell>
                  ))}</TableRow></TableHead>
                  <TableBody>{d.vorschau.map((z, n) => <TableRow key={n} sx={{ opacity: n === 0 && kopfzeile ? 0.55 : 1 }}>{d.ueberschriften.map((_, i) => <TableCell key={i} title={z[i] ?? ''}>{z[i] ?? ''}</TableCell>)}</TableRow>)}</TableBody>
                </Table>
              </Box>
            </Karte>
          )}
          {d && (
            <Karte titel="3 · Abgleich">
              <Stack gap={2}>
                <Stack direction="row" gap={2} flexWrap="wrap">
                  <TextField select label="Modus" value={opt.modus} onChange={e => setOpt({ ...opt, modus: e.target.value })} sx={{ minWidth: 300 }}><MenuItem value="aktualisieren">Neue anlegen und vorhandene aktualisieren</MenuItem><MenuItem value="neu">Nur neue anlegen</MenuItem></TextField>
                  <TextField select label="Vorhandene erkennen über" value={opt.schluessel} onChange={e => setOpt({ ...opt, schluessel: e.target.value })} sx={{ minWidth: 300 }}><MenuItem value="auto">ID/externe Nummer, sonst Name + Geburtsdatum</MenuItem><MenuItem value="id">nur ID bzw. externe Nummer</MenuItem><MenuItem value="name_geburt">Name + Geburtsdatum</MenuItem></TextField>
                  <TextField select label="Login-Schema für Konten" value={opt.schema || gr.schemata.filter(s => s !== 'kuerzel')[0] || ''} onChange={e => setOpt({ ...opt, schema: e.target.value })} sx={{ minWidth: 200 }}>{gr.schemata.filter(s => s !== 'kuerzel').map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}</TextField>
                </Stack>
                <Stack direction="row" gap={2} flexWrap="wrap">
                  <FormControlLabel control={<Checkbox checked={opt.austrittMarkieren} onChange={e => setOpt({ ...opt, austrittMarkieren: e.target.checked })} />} label="Nicht enthaltene Schüler*innen als ausgetreten markieren" />
                  {gr.darfKonten && <>
                    <FormControlLabel control={<Checkbox checked={opt.kontenSchueler} onChange={e => setOpt({ ...opt, kontenSchueler: e.target.checked })} />} label="Konten für Schüler*innen anlegen" />
                    <FormControlLabel control={<Checkbox checked={opt.kontenEltern} onChange={e => setOpt({ ...opt, kontenEltern: e.target.checked })} />} label="Konten für Erziehungsberechtigte anlegen" />
                  </>}
                </Stack>
                {q === 'export' && <Alert severity="warning">Die Schülerdaten kommen aus dem Studio-Export. Importierte Änderungen ergänzen den Export; für eine vollständige Pflege in EduOrga Web oben auf „Web-Verwaltung“ umstellen.</Alert>}
                <Box><Button variant="outlined" onClick={() => ausfuehren(gr, false)}>Trockenlauf</Button></Box>
              </Stack>
            </Karte>
          )}
          {ergebnis && (
            <Karte titel={<Stack direction="row" gap={1} alignItems="center" flexWrap="wrap" component="span">{ergebnis.uebernommen ? '4 · Ergebnis der Übernahme' : '4 · Trockenlauf'}
              {Object.entries(STATUS).filter(([k]) => (ergebnis.r as unknown as Record<string, number>)[k]).map(([k, [ton, tt]]) => <Plakette key={k} ton={ton}>{(ergebnis.r as unknown as Record<string, number>)[k]} {tt}</Plakette>)}</Stack>}
              aktion={!ergebnis.uebernommen && <Button variant="contained" disabled={!(ergebnis.r.neu + ergebnis.r.geaendert + ergebnis.r.ausgetreten)} onClick={async () => {
                const r = ergebnis.r;
                const text = `${r.neu} neu, ${r.geaendert} geändert${r.ausgetreten ? `, ${r.ausgetreten} als ausgetreten markieren` : ''}${opt.kontenSchueler || opt.kontenEltern ? ', Konten anlegen' : ''}. Fortfahren?`;
                if (await bestaetigen('Schüler*innen übernehmen', text, 'Übernehmen')) await ausfuehren(gr, true);
              }}>Übernehmen</Button>}>
              {!ergebnis.uebernommen && <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Es wurde noch nichts gespeichert.{ergebnis.r.fehler ? ' Zeilen mit Fehlern werden beim Übernehmen übersprungen.' : ''}</Typography>}
              <Paper variant="outlined" sx={{ maxHeight: 480, overflow: 'auto' }}>
                <Table size="small" stickyHeader>
                  <TableHead><TableRow><TableCell>Zeile</TableCell><TableCell>Status</TableCell><TableCell>Name</TableCell><TableCell>Klasse</TableCell><TableCell>Details</TableCell></TableRow></TableHead>
                  <TableBody>{ergebnis.r.zeilen.slice(0, 2000).map((z, i) => (
                    <TableRow key={i} sx={{ bgcolor: z.status === 'fehler' ? 'action.hover' : undefined }}>
                      <TableCell>{z.zeile || ''}</TableCell><TableCell><Plakette ton={STATUS[z.status]?.[0] ?? 'neutral'}>{STATUS[z.status]?.[1] ?? z.status}</Plakette></TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{z.name}</TableCell><TableCell>{z.klasse}</TableCell>
                      <TableCell>{z.fehler && <Typography variant="body2" color="error">{z.fehler}</Typography>}{[...z.aenderungen, ...z.hinweise].map((a, j) => <Typography key={j} variant="caption" color="text.secondary" sx={{ display: 'block' }}>{a}</Typography>)}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </Paper>
            </Karte>
          )}
          {vorlageName !== null && d && (
            <FormDialog offen titel="Zuordnung als Vorlage speichern" onClose={() => setVorlageName(null)} aktion={async () => {
              const ueberschriften: Record<string, string> = {};
              if (kopfzeile) Object.entries(zuordnung).forEach(([i, f]) => { ueberschriften[d.ueberschriften[Number(i)]] = f; });
              await senden('/api/app/admin/schuelerimport/vorlagen', { name: vorlageName, kopfzeile, ueberschriften, spalten: zuordnung });
              toast('Vorlage gespeichert.'); void g.neu();
            }}>
              <TextField fullWidth label="Name der Vorlage" value={vorlageName} onChange={e => setVorlageName(e.target.value)} placeholder="z. B. Export Schulverwaltung" autoFocus slotProps={{ htmlInput: { maxLength: 100 } }} sx={{ mt: 0.5 }} />
            </FormDialog>
          )}
          {konten && (
            <FormDialog offen titel="Neue Konten" onClose={() => setKonten(null)} links={<Button onClick={() => speichern(konten.csv ?? '', `konten-${heuteIso()}.csv`)}>Liste herunterladen (CSV)</Button>}>
              <Typography>{konten.konten?.length} Konten angelegt.</Typography>
              <Alert severity="warning" sx={{ mt: 2 }}>Die Startpasswörter werden nur jetzt angezeigt. Bitte die Liste herunterladen.</Alert>
            </FormDialog>
          )}
        </Stack>
      );
    }}</Geladen>
  );
}
