// Sprechtag anlegen bzw. bearbeiten (Administration): Allgemein, Zeitblöcke (Lücken = Pausen), Termindauer und Puffer, Ankündigung,
// Einladungs- und Anmeldezeitraum, Sichtbarkeit, Optionen (Raumwahl, Warteliste, Erinnerung), beteiligte Lehrkräfte mit Raum,
// eigener Dauer und Online-Link; rechts eine Vorschau mit Zeitslots und Kapazität.
import { useMemo, useState } from 'react';
import { Alert, Box, Button, Checkbox, Chip, FormControlLabel, IconButton, Link, MenuItem, Paper, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import LocalCafeOutlined from '@mui/icons-material/LocalCafeOutlined';
import { holen, senden } from '../../api/client';
import { useSitzung } from '../../app/sitzung';
import { Geladen, Seite } from '../../components/Seite';
import { Plakette, SuchFeld } from '../../components/Bausteine';
import { DatumFeld, ZeitFeld, DatumZeitFeld } from '../../components/Auswahl';
import { fehler, toast } from '../../lib/meldungen';
import { navigieren } from '../../lib/router';
import { useLaden } from '../../lib/useLaden';
import { BASIS, minutenAus, zeitDe, zeitfenster, zeitText, type Lehrkraft, type Sprechtag } from './gemeinsam';

const DAUERN = [5, 8, 10, 12, 15, 20, 25, 30, 45, 60];
const ERINNERUNG: [number, string][] = [[0, 'keine Erinnerung'], [2, '2 Stunden vorher'], [24, '1 Tag vorher'], [48, '2 Tage vorher'], [72, '3 Tage vorher'], [168, '1 Woche vorher']];
const datumLang = (iso: string) => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getDay()]}, ${m[3]}.${m[2]}.${m[1]}`;
};
const NEU: Sprechtag = {
  id: 0, name: 'Elternsprechtag', datum: '', datumText: '', beginn: '15:00', ende: '19:00', dauer: 10, pausen: [], zeitbloecke: [{ von: '15:00', bis: '17:00' }, { von: '17:15', bis: '19:00' }],
  einladungBis: '', anmeldungVon: '', anmeldungBis: '', sichtbar: false, raumwahl: false, hinweis: '', ort: '', lehrkraefte: [], reihe: [], phase: 'vorbereitung', zeitfenster: 0,
  optionen: { puffer: 0, maxTermineFamilie: 0, warteliste: false, erinnerungStunden: 24, sichtbarEltern: true, sichtbarSchueler: true, ankuendigen: true },
};

export function SprechtagFormular({ id }: { id: number | null }) {
  const { ich } = useSitzung();
  const darf = ich.admin || !!ich.rechte?.['sprechtag.verwalten'];
  const g = useLaden(async sig => {
    const [opt, vorhanden] = await Promise.all([
      holen<{ lehrer: { kurz: string; name: string }[]; raeume: { kurz: string; name: string }[] }>(`${BASIS}/optionen`, sig),
      id ? holen<{ sprechtag: Sprechtag }>(`${BASIS}/${id}`, sig) : Promise.resolve(null),
    ]);
    return { opt, t: vorhanden?.sprechtag ?? NEU };
  }, [id]);
  if (!darf) return <Seite titel="Elternsprechtag"><Alert severity="warning">Nur für die Administration.</Alert></Seite>;
  return <Geladen g={g}>{d => <Formular id={id} opt={d.opt} t={d.t} />}</Geladen>;
}

function Formular({ id, opt, t }: { id: number | null; opt: { lehrer: { kurz: string; name: string }[]; raeume: { kurz: string; name: string }[] }; t: Sprechtag }) {
  const o = t.optionen ?? {};
  const [f, setF] = useState({
    name: t.name, datum: t.datum, ort: t.ort ?? '', hinweis: t.hinweis ?? '', dauer: t.dauer, puffer: o.puffer ?? 0, maxTermineFamilie: o.maxTermineFamilie ?? 0,
    einladungBis: t.einladungBis ?? '', anmeldungVon: t.anmeldungVon ?? '', anmeldungBis: t.anmeldungBis ?? '', sichtbar: t.sichtbar, ankuendigen: o.ankuendigen ?? true,
    sichtbarEltern: o.sichtbarEltern ?? true, sichtbarSchueler: o.sichtbarSchueler ?? true, raumwahl: t.raumwahl, warteliste: !!o.warteliste, erinnerungStunden: o.erinnerungStunden ?? 0,
  });
  const set = (w: Partial<typeof f>) => setF(alt => ({ ...alt, ...w }));
  const [bloecke, setBloecke] = useState((t.zeitbloecke?.length ? t.zeitbloecke : [{ von: t.beginn, bis: t.ende }]).map(b => ({ ...b })));
  const [tage, setTage] = useState<string[]>([]);
  const [neuerTag, setNeuerTag] = useState<string | null>(null);
  const [lk, setLk] = useState<Map<string, Lehrkraft>>(() => new Map(t.lehrkraefte.map(l => [l.lehrer, { ...l }])));
  const [suche, setSuche] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const lehrer = opt.lehrer.filter(l => !suche || `${l.kurz} ${l.name}`.toLowerCase().includes(suche.toLowerCase()));
  const lkSetzen = (kurz: string, w: Partial<Lehrkraft> | null) => setLk(alt => {
    const m = new Map(alt);
    if (w === null) m.delete(kurz); else m.set(kurz, { ...(m.get(kurz) ?? { lehrer: kurz, raum: '', dauer: 0, online: false, link: '' }), ...w });
    return m;
  });

  const vorschau = useMemo(() => {
    const fenster = zeitfenster(bloecke, f.dauer, f.puffer);
    const kapazitaet = [...lk.values()].reduce((n, l) => n + zeitfenster(bloecke, l.dauer || f.dauer, f.puffer).length, 0);
    const gueltig = bloecke.filter(x => x.von && x.bis && minutenAus(x.bis) > minutenAus(x.von)).sort((a, b) => minutenAus(a.von) - minutenAus(b.von));
    const pausen = gueltig.slice(1).map((x, i) => [minutenAus(gueltig[i].bis), minutenAus(x.von)] as [number, number]).filter(([v, b]) => b > v);
    return { fenster, kapazitaet, gueltig, pausen };
  }, [bloecke, f.dauer, f.puffer, lk]);

  const speichern = async () => {
    setLaeuft(true);
    try {
      const zb = bloecke.filter(p => p.von || p.bis);
      const daten = {
        name: f.name, datum: f.datum, ort: f.ort, dauer: Number(f.dauer) || 10, beginn: zb[0]?.von ?? '', ende: zb[zb.length - 1]?.bis ?? '', pausen: [], zeitbloecke: zb,
        einladungBis: f.einladungBis, anmeldungVon: f.anmeldungVon, anmeldungBis: f.anmeldungBis, sichtbar: f.sichtbar, raumwahl: f.raumwahl, hinweis: f.hinweis,
        optionen: { puffer: Number(f.puffer) || 0, maxTermineFamilie: Number(f.maxTermineFamilie) || 0, warteliste: f.warteliste, erinnerungStunden: Number(f.erinnerungStunden) || 0,
          sichtbarEltern: f.sichtbarEltern, sichtbarSchueler: f.sichtbarSchueler, ankuendigen: f.ankuendigen },
        weitereTage: id ? null : tage,
        lehrkraefte: [...lk.values()].map(l => ({ lehrer: l.lehrer, raum: l.raum ?? '', dauer: Number(l.dauer) || 0, online: !!l.online, link: l.link ?? '' })),
      };
      const r = await senden<{ id: number }>(id ? `${BASIS}/${id}` : BASIS, daten, id ? 'PUT' : 'POST');
      toast(id ? 'Sprechtag gespeichert.' : tage.length ? `Sprechtag mit ${tage.length + 1} Tagen angelegt.` : 'Sprechtag angelegt.');
      navigieren(`#/sprechtag/${r.id}`);
    } catch (err) { fehler(err); } finally { setLaeuft(false); }
  };

  const schalter = (k: keyof typeof f, text: React.ReactNode) => <FormControlLabel sx={{ alignItems: 'flex-start', m: 0 }} control={<Switch checked={!!f[k]} onChange={e => set({ [k]: e.target.checked } as Partial<typeof f>)} />} label={<Box sx={{ pt: 1 }}>{text}</Box>} />;
  const karte = (titel: string, kinder: React.ReactNode, rechts?: React.ReactNode) => (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}><Stack direction="row" alignItems="center" gap={1} sx={{ px: 2.5, py: 1.1, minHeight: 44, bgcolor: 'flaechen.band', borderBottom: 1, borderColor: 'divider' }}><Typography variant="h3" component="h2" sx={{ flex: 1 }}>{titel}</Typography>{rechts}</Stack><Box sx={{ p: 2.5 }}>{kinder}</Box></Paper>
  );
  const zeitFeld = (label: string, k: 'einladungBis' | 'anmeldungVon' | 'anmeldungBis', hilfe?: string) => (
    <DatumZeitFeld label={label} wert={f[k] ?? ''} onWert={v => set({ [k]: v } as Partial<typeof f>)} hilfe={hilfe} breite="100%" />
  );
  const phasen = [
    f.sichtbar && f.ankuendigen ? ['termin', 'Angekündigt', 'sobald freigegeben'] : null,
    f.anmeldungVon ? ['ok', 'Anmeldung', `${zeitDe(f.anmeldungVon)} – ${zeitDe(f.anmeldungBis) || '…'}`] : null,
    f.datum ? ['pruefung', 'Sprechtag', [datumLang(f.datum), ...tage.map(datumLang), ...(t.reihe ?? []).filter(r => r.id !== t.id).map(r => r.datumText)].join(' · ')] : null,
  ].filter(Boolean) as ['termin' | 'ok' | 'pruefung', string, string][];

  return (
    <Seite titel={id ? 'Sprechtag bearbeiten' : 'Sprechtag anlegen'} aktionen={<>
      <Button variant="outlined" href={`#/sprechtag${id ? '/' + id : ''}`}>Abbrechen</Button>
      <Button variant="contained" startIcon={<CheckRounded />} disabled={laeuft} onClick={speichern}>Speichern</Button>
    </>}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 340px' }, gap: 2.5, alignItems: 'start' }}>
        <Stack gap={2.5}>
          {karte('Allgemein', (
            <Stack direction="row" gap={2} flexWrap="wrap">
              <TextField label="Name" value={f.name} onChange={e => set({ name: e.target.value })} required sx={{ flex: '2 1 280px' }} slotProps={{ htmlInput: { maxLength: 200 } }} />
              <DatumFeld label="Datum" wert={f.datum || null} onWert={v => set({ datum: v ?? '' })} pflicht breite={190} />
              <TextField label="Ort (optional)" value={f.ort} onChange={e => set({ ort: e.target.value })} placeholder="z. B. Hauptgebäude, 1. OG" sx={{ flex: '2 1 280px' }} slotProps={{ htmlInput: { maxLength: 300 } }} />
              {id ? ((t.reihe?.length ?? 0) > 1 && <Box sx={{ flex: '1 1 200px' }}><Typography variant="caption" color="text.secondary">Reihe</Typography><Typography variant="body2">{t.reihe!.map((r, i) => <span key={r.id}>{i > 0 && ' · '}{r.id === t.id ? <b>{r.datumText}</b> : <Link href={`#/sprechtag/${r.id}/verwalten`}>{r.datumText}</Link>}</span>)}</Typography></Box>)
                : (
                  <Stack gap={1} sx={{ flex: '1 1 260px' }}>
                    <Stack direction="row" gap={1} alignItems="center"><DatumFeld label="Weiterer Tag (optional)" wert={neuerTag} onWert={setNeuerTag} breite={200} />
                      <Button size="small" startIcon={<AddRounded />} onClick={() => { if (neuerTag && !tage.includes(neuerTag) && neuerTag !== f.datum) { setTage([...tage, neuerTag].sort()); setNeuerTag(null); } }}>Tag</Button></Stack>
                    <Stack direction="row" gap={0.5} flexWrap="wrap">{tage.map(d => <Chip key={d} size="small" label={datumLang(d)} onDelete={() => setTage(tage.filter(x => x !== d))} />)}</Stack>
                  </Stack>
                )}
              <TextField label="Hinweis für Lehrkräfte und Eltern (optional)" value={f.hinweis} onChange={e => set({ hinweis: e.target.value })} multiline minRows={2} fullWidth slotProps={{ htmlInput: { maxLength: 2000 } }} />
            </Stack>
          ))}
          {karte('Zeitfenster und Termine', (
            <Stack gap={2}>
              <Typography variant="body2" color="text.secondary">Mehrere Zeitblöcke sind möglich (z. B. 15–17 Uhr und 17:15–19 Uhr); die Lücken dazwischen sind Pausen.</Typography>
              {bloecke.map((b, i) => (
                <Stack key={i} direction="row" gap={1.5} alignItems="center">
                  <ZeitFeld label="Von" wert={b.von ?? ''} onWert={v => setBloecke(l => l.map((x, j) => (j === i ? { ...x, von: v } : x)))} />
                  <ZeitFeld label="Bis" wert={b.bis ?? ''} onWert={v => setBloecke(l => l.map((x, j) => (j === i ? { ...x, bis: v } : x)))} />
                  {bloecke.length > 1 && <IconButton color="error" aria-label="Zeitblock entfernen" onClick={() => setBloecke(l => l.filter((_, j) => j !== i))}><DeleteOutlineRounded /></IconButton>}
                </Stack>
              ))}
              <Stack direction="row" gap={2} flexWrap="wrap">
                <TextField type="number" label="Termindauer (Minuten)" value={f.dauer} onChange={e => set({ dauer: Number(e.target.value) })} slotProps={{ htmlInput: { min: 3, max: 120 } }} sx={{ width: 190 }} />
                <TextField type="number" label="Puffer danach (Minuten)" value={f.puffer} onChange={e => set({ puffer: Number(e.target.value) })} slotProps={{ htmlInput: { min: 0, max: 60 } }} sx={{ width: 190 }} />
                <TextField type="number" label="Höchstens Termine je Familie" value={f.maxTermineFamilie} onChange={e => set({ maxTermineFamilie: Number(e.target.value) })} helperText="0 = unbegrenzt" slotProps={{ htmlInput: { min: 0, max: 50 } }} sx={{ width: 230 }} />
              </Stack>
            </Stack>
          ), <Button size="small" startIcon={<AddRounded />} onClick={() => {
            const letzt = bloecke[bloecke.length - 1];
            const start = letzt?.bis ? minutenAus(letzt.bis) + 15 : 15 * 60;
            setBloecke([...bloecke, { von: zeitText(Math.min(start, 23 * 60)), bis: zeitText(Math.min(start + 60, 23 * 60 + 59)) }]);
          }}>Zeitblock</Button>)}
          {karte('Ankündigung, Einladungen und Anmeldung', (
            <Stack gap={2}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 2, alignItems: 'start' }}>
                {zeitFeld('Einladungen der Lehrkräfte bis', 'einladungBis', 'Leer = bis zum Ende der Anmeldung.')}
                {zeitFeld('Anmeldung für Eltern ab', 'anmeldungVon')}
                {zeitFeld('Anmeldung für Eltern bis', 'anmeldungBis')}
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
                {schalter('sichtbar', <><b>Freigegeben</b> – für Lehrkräfte und Familien sichtbar (Startseite und Menü)</>)}
                {schalter('ankuendigen', <>Schon vor der Anmeldung <b>ankündigen</b> (Datum, Zeit, Ort, Anmeldebeginn)</>)}
                {schalter('sichtbarEltern', <>Für <b>Erziehungsberechtigte</b> sichtbar (Buchung)</>)}
                {schalter('sichtbarSchueler', <>Für <b>Schüler*innen</b> sichtbar (nur Information und eigene Termine)</>)}
              </Box>
            </Stack>
          ))}
          {karte('Weitere Optionen', (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5, alignItems: 'start' }}>
              {schalter('raumwahl', <>Lehrkräfte dürfen ihren <b>Raum</b> bzw. ihren Online-Link <b>selbst wählen</b></>)}
              {schalter('warteliste', <><b>Warteliste</b> bei ausgebuchten Lehrkräften (Mitteilung, sobald ein Termin frei wird)</>)}
              <TextField select label="Erinnerung an Termine" value={f.erinnerungStunden} onChange={e => set({ erinnerungStunden: Number(e.target.value) })} helperText="Mitteilung an Familien und Lehrkräfte mit Termin.">
                {ERINNERUNG.map(([w, x]) => <MenuItem key={w} value={w}>{x}</MenuItem>)}
              </TextField>
            </Box>
          ))}
          {karte('Beteiligte Lehrkräfte', (
            <Stack gap={1.5}>
              <Stack direction="row" gap={1.5} alignItems="center" flexWrap="wrap"><SuchFeld wert={suche} onWert={setSuche} platzhalter="Lehrkraft suchen" />
                <Typography variant="body2" color="text.secondary">Alle wählen und einzelne abwählen schließt Lehrkräfte aus.</Typography></Stack>
              <Box sx={{ overflowX: 'auto', maxHeight: 520 }}>
                <Table size="small" stickyHeader>
                  <TableHead><TableRow><TableCell padding="checkbox" /><TableCell>Lehrkraft</TableCell><TableCell>Raum</TableCell><TableCell>Dauer</TableCell><TableCell>Online</TableCell></TableRow></TableHead>
                  <TableBody>{lehrer.map(l => {
                    const x = lk.get(l.kurz);
                    return (
                      <TableRow key={l.kurz} selected={!!x}>
                        <TableCell padding="checkbox"><Checkbox checked={!!x} onChange={e => lkSetzen(l.kurz, e.target.checked ? {} : null)} aria-label={`${l.name} beteiligt`} /></TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{l.name} <Plakette>{l.kurz}</Plakette></TableCell>
                        <TableCell><TextField select size="small" value={x?.raum ?? ''} onChange={e => lkSetzen(l.kurz, { raum: e.target.value })} sx={{ width: 130 }} aria-label={`Raum ${l.kurz}`}>
                          <MenuItem value="">– kein Raum –</MenuItem>{opt.raeume.map(r => <MenuItem key={r.kurz} value={r.kurz}>{r.kurz}</MenuItem>)}</TextField></TableCell>
                        <TableCell><TextField select size="small" value={x?.dauer ?? 0} onChange={e => lkSetzen(l.kurz, { dauer: Number(e.target.value) })} sx={{ width: 120 }} aria-label={`Termindauer ${l.kurz}`}>
                          <MenuItem value={0}>Standard</MenuItem>{DAUERN.map(d => <MenuItem key={d} value={d}>{d} Min.</MenuItem>)}</TextField></TableCell>
                        <TableCell><Stack direction="row" gap={1} alignItems="center"><Checkbox size="small" checked={!!x?.online} onChange={e => lkSetzen(l.kurz, { online: e.target.checked })} aria-label={`${l.kurz} online`} />
                          {x?.online && <TextField size="small" value={x.link ?? ''} onChange={e => lkSetzen(l.kurz, { link: e.target.value })} placeholder="https://…" sx={{ width: 200 }} slotProps={{ htmlInput: { maxLength: 500 } }} />}</Stack></TableCell>
                      </TableRow>
                    );
                  })}</TableBody>
                </Table>
              </Box>
            </Stack>
          ), <Stack direction="row" gap={1} alignItems="center"><Plakette ton="primaer">{lk.size} gewählt</Plakette>
            <Button size="small" onClick={() => lehrer.forEach(l => !lk.has(l.kurz) && lkSetzen(l.kurz, {}))}>Alle</Button>
            <Button size="small" onClick={() => lehrer.forEach(l => lkSetzen(l.kurz, null))}>Keine</Button></Stack>)}
        </Stack>
        <Paper variant="outlined" sx={{ p: 2.5, position: { lg: 'sticky' }, top: { lg: 16 } }} aria-label="Vorschau">
          <Typography variant="h3" sx={{ mb: 1.5 }}>Vorschau</Typography>
          <Stack direction="row" gap={1} sx={{ mb: 1.5 }} flexWrap="wrap"><Plakette ton="primaer">{vorschau.fenster.length} Termine je Lehrkraft</Plakette><Plakette ton="pruefung">{vorschau.kapazitaet} Termine gesamt</Plakette></Stack>
          <Typography sx={{ fontWeight: 600 }}>{f.datum ? datumLang(f.datum) : <Typography component="span" color="text.secondary">Datum fehlt</Typography>}{tage.length > 0 && <Typography component="span" variant="body2" color="text.secondary"> + {tage.length} weitere{tage.length === 1 ? 'r Tag' : ' Tage'}</Typography>}</Typography>
          <Typography variant="body2" color="text.secondary">{vorschau.gueltig.length ? `${vorschau.gueltig[0].von}–${vorschau.gueltig[vorschau.gueltig.length - 1].bis} Uhr` : 'Zeitfenster fehlt'}
            {vorschau.pausen.length ? ` · Pause ${vorschau.pausen.map(([v, b]) => `${zeitText(v)}–${zeitText(b)}`).join(', ')}` : ''}{f.ort ? ` · ${f.ort}` : ''}</Typography>
          <Typography variant="body2" color="text.secondary">Termine à {f.dauer} Min.{f.puffer ? ` + ${f.puffer} Min. Puffer` : ''}{f.maxTermineFamilie > 0 ? ` · max. ${f.maxTermineFamilie} je Familie` : ''}</Typography>
          {phasen.length > 0 && <Stack gap={0.75} sx={{ my: 1.5 }}>{phasen.map(([ton, n, x]) => <Stack key={n} direction="row" gap={1} alignItems="center"><Plakette ton={ton}>{n}</Plakette><Typography variant="body2" color="text.secondary">{x}</Typography></Stack>)}</Stack>}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 0.75, mt: 1.5, maxHeight: 420, overflow: 'auto' }}>
            {vorschau.fenster.length ? vorschau.fenster.map(([v, b], i) => {
              const pause = i > 0 ? vorschau.pausen.find(([pv, pb]) => pv >= vorschau.fenster[i - 1][1] - f.puffer && pb <= v) : null;
              return (
                <Box key={v} sx={{ display: 'contents' }}>
                  {pause && <Stack direction="row" gap={0.75} alignItems="center" sx={{ gridColumn: '1 / -1', color: 'text.secondary', fontSize: 12.5, py: 0.5 }}><LocalCafeOutlined sx={{ fontSize: 16 }} />Pause {zeitText(pause[0])}–{zeitText(pause[1])}</Stack>}
                  <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, px: 1, py: 0.5, textAlign: 'center' }}><Typography sx={{ fontWeight: 600, fontSize: 13 }}>{zeitText(v)}</Typography><Typography variant="caption" color="text.secondary">bis {zeitText(b)}</Typography></Box>
                </Box>
              );
            }) : <Typography variant="body2" color="text.secondary" sx={{ gridColumn: '1 / -1' }}>Keine Zeitfenster – bitte Zeitblock und Termindauer prüfen.</Typography>}
          </Box>
        </Paper>
      </Box>
    </Seite>
  );
}
