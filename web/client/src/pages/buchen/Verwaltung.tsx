// Buchen → Neuer Unterricht (Unterricht außerhalb des Studio-Stundenplans anlegen, dann zusätzliche Stunden verplanen) und
// Verwaltung (Administration): Ressourcenarten mit Symbol, Ressourcen (mobil mit Anzahl und Standort bzw. fest in einem Raum) und Raumdaten
// (Kapazität, Gebäude, Abteilung, Raumgruppe) für die Auswahlkriterien.
import { useEffect, useState } from 'react';
import { Alert, Autocomplete, Box, Button, FormControlLabel, IconButton, MenuItem, Paper, Stack, Switch, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import EditOutlined from '@mui/icons-material/EditOutlined';
import EventRepeatOutlined from '@mui/icons-material/EventRepeatOutlined';
import GridViewOutlined from '@mui/icons-material/GridViewOutlined';
import { holen, loeschen, senden } from '../../api/client';
import { useSitzung } from '../../app/sitzung';
import { Geladen, Seite } from '../../components/Seite';
import { FormDialog, Plakette, SuchFeld, Wahl } from '../../components/Bausteine';
import { Tabelle } from '../../components/Tabelle';
import { bestaetigen, fehler, toast } from '../../lib/meldungen';
import { link, navigieren } from '../../lib/router';
import { useLaden } from '../../lib/useLaden';
import type { EigenerUnterricht } from './Assistent';
import { BASIS, ResSymbol, ressourcenSymbolName, SYMBOLE, type Optionen } from './gemeinsam';

// ------------------------------------------------------------------ Neuer Unterricht

export function NeuerUnterricht() {
  const { ich, elemente } = useSitzung();
  const g = useLaden(async sig => ({ liste: await holen<EigenerUnterricht[]>(`${BASIS}/unterricht`, sig), el: await elemente() }), []);
  const [neu, setNeu] = useState(false);
  const [w, setW] = useState({ lehrer: ich.element || '', fach: '', klassen: [] as string[], wochenstunden: 1, gruppe: '', text: '' });
  return (
    <Seite titel="Unterricht anlegen" untertitel="Legen Sie hier Unterricht an, der nicht im Stundenplan aus EduOrga Studio steht, und verplanen Sie danach seine Stunden über „Zusätzliche Stunden“."
      aktionen={<><Button variant="outlined" href="#/unterricht">Mein Unterricht</Button><Button variant="contained" startIcon={<AddRounded />} onClick={() => setNeu(true)}>Neuer Unterricht</Button></>}>
      <Geladen g={g}>{({ liste, el }) => (
        <>
          <Tabelle zeilen={liste} schluessel={u => u.id} leer="Noch kein Unterricht in EduOrga Web angelegt."
            spalten={[
              { id: 'fach', kopf: 'Fach', sortWert: u => u.fach, zelle: u => <Plakette ton="primaer">{u.fach}</Plakette> },
              { id: 'klassen', kopf: 'Klassen', zelle: u => <b>{u.klassen.join(', ') || '–'}</b> },
              { id: 'lehrer', kopf: 'Lehrkraft', zelle: u => u.lehrer },
              { id: 'gruppe', kopf: 'Bezeichnung', zelle: u => <Box>{u.gruppe}{u.text && <Typography variant="body2" color="text.secondary">{u.text}</Typography>}</Box>, verbergenMobil: true },
              { id: 'wst', kopf: 'Wst', rechts: true, zelle: u => u.wochenstunden || '' },
              { id: 'geb', kopf: 'gebucht', rechts: true, zelle: u => `${u.gebuchteStunden} Std.` },
              { id: 'akt', kopf: '', rechts: true, nowrap: true, zelle: u => (
                <Stack direction="row" gap={0.5} justifyContent="flex-end">
                  <Button size="small" variant="outlined" startIcon={<EventRepeatOutlined />} href={link('buchen', 'stunden', u.id)}>Zusätzliche Stunden</Button>
                  {(ich.admin || u.benutzerId === ich.id) && <IconButton size="small" color="error" aria-label="Löschen" onClick={async () => {
                    if (!(await bestaetigen('Unterricht löschen', 'Den Unterricht löschen? Seine kommenden zusätzlichen Stunden werden storniert.'))) return;
                    try { await loeschen(`${BASIS}/unterricht/${u.id}`); toast('Gelöscht.'); void g.neu(); } catch (err) { fehler(err); }
                  }}><DeleteOutlineRounded fontSize="small" /></IconButton>}
                </Stack>
              ) },
            ]} />
          {neu && (
            <FormDialog offen titel="Neuer Unterricht" breite="md" onClose={() => setNeu(false)} aktionText="Anlegen" aktion={async () => {
              if (!w.fach) { toast('Bitte ein Fach wählen.', true); return false; }
              const u = await senden<{ id: number }>(`${BASIS}/unterricht`, { ...w, lehrer: w.lehrer || null });
              toast('Unterricht angelegt – jetzt zusätzliche Stunden verplanen.');
              navigieren(link('buchen', 'stunden', u.id));
            }}>
              <Stack gap={2} sx={{ pt: 0.5 }}>
                <Stack direction="row" gap={2}>
                  <TextField select label="Lehrkraft" value={w.lehrer} onChange={e => setW({ ...w, lehrer: e.target.value })} sx={{ flex: 1 }}><MenuItem value="">bitte wählen</MenuItem>{el.lehrer.map(l => <MenuItem key={l.kurz} value={l.kurz}>{l.kurz} · {l.name}</MenuItem>)}</TextField>
                  <TextField select label="Fach" value={w.fach} onChange={e => setW({ ...w, fach: e.target.value })} sx={{ flex: 1 }} required><MenuItem value="">bitte wählen</MenuItem>{el.faecher.map(f => <MenuItem key={f.kurz} value={f.kurz}>{f.kurz} · {f.name}</MenuItem>)}</TextField>
                </Stack>
                <Stack direction="row" gap={2}>
                  <Autocomplete multiple options={el.klassen.map(k => k.kurz)} value={w.klassen} onChange={(_, v) => setW({ ...w, klassen: v })} renderInput={p => <TextField {...p} label="Klasse(n)" />} sx={{ flex: 1 }} disableCloseOnSelect />
                  <TextField type="number" label="Wochenstunden" value={w.wochenstunden} onChange={e => setW({ ...w, wochenstunden: Number(e.target.value) || 0 })} slotProps={{ htmlInput: { min: 0, max: 40 } }} sx={{ width: 150 }} />
                </Stack>
                <TextField label="Bezeichnung / Schülergruppe" value={w.gruppe} onChange={e => setW({ ...w, gruppe: e.target.value })} placeholder="z. B. Förderkurs Mathematik" slotProps={{ htmlInput: { maxLength: 100 } }} />
                <TextField label="Text" value={w.text} onChange={e => setW({ ...w, text: e.target.value })} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 1000 } }} />
              </Stack>
            </FormDialog>
          )}
        </>
      )}</Geladen>
    </Seite>
  );
}

// ------------------------------------------------------------------ Ressourcen verwalten

interface Art { id: number; name: string; symbol?: string; reihenfolge: number }
interface Ressource { id: number; name: string; art?: string; artId?: number | null; raum?: string; mobil: boolean; anzahl: number; standort?: string; bemerkung?: string; aktiv: boolean; symbol?: string }

export function Ressourcenverwaltung() {
  const { ich } = useSitzung();
  const g = useLaden(async sig => {
    const [opt, arten, liste, symbole] = await Promise.all([holen<Optionen>(`${BASIS}/optionen`, sig), holen<Art[]>(`${BASIS}/ressourcenarten`, sig), holen<Ressource[]>(`${BASIS}/ressourcen`, sig), holen<string[]>(`${BASIS}/symbole`, sig)]);
    return { opt, arten, liste, symbole };
  }, []);
  const [neueArt, setNeueArt] = useState('');
  const [art, setArt] = useState<Art | null>(null);
  const [formular, setFormular] = useState<Partial<Ressource> | null>(null);
  const [suche, setSuche] = useState('');
  const [artFilter, setArtFilter] = useState('');
  const [zuordnung, setZuordnung] = useState('');
  if (!ich.admin) return <Seite titel="Geräte & Medien verwalten"><Alert severity="warning">Nur für die Administration.</Alert></Seite>;
  return (
    <Seite titel="Geräte & Medien verwalten" untertitel={g.daten ? `${g.daten.liste.length} Ressourcen` : undefined}
      aktionen={<><Button variant="outlined" startIcon={<GridViewOutlined />} href="#/buchen/ressourcen">Gerätebelegung</Button><Button variant="contained" startIcon={<AddRounded />} onClick={() => setFormular({})}>Ressource hinzufügen</Button></>}>
      <Geladen g={g}>{({ opt, arten, liste, symbole }) => {
        const q = suche.toLowerCase();
        const sichtbar = liste.filter(r => (!q || `${r.name} ${r.art} ${r.raum} ${r.standort}`.toLowerCase().includes(q)) && (!artFilter || String(r.artId ?? '') === artFilter) && (!zuordnung || (r.raum ? 'fest' : 'mobil') === zuordnung));
        return (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '340px minmax(0, 1fr)' }, gap: 2.5, alignItems: 'start' }}>
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography variant="h3" sx={{ mb: 0.5 }}>Ressourcenarten</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Nach diesen Arten filtern Lehrkräfte bei der Raum- und Ressourcensuche (z. B. Beamer, Internet, Laptop tragbar).</Typography>
              {arten.map(a => (
                <Stack key={a.id} direction="row" gap={1} alignItems="center" sx={{ py: 0.75, borderTop: 1, borderColor: 'divider' }}>
                  <Box sx={{ color: 'primary.main', display: 'flex' }}><ResSymbol r={{ symbol: a.symbol, art: a.name }} /></Box>
                  <Typography sx={{ flex: 1, fontWeight: 500 }}>{a.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{liste.filter(r => r.artId === a.id).length}</Typography>
                  <IconButton size="small" aria-label="Bearbeiten" onClick={() => setArt(a)}><EditOutlined fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" aria-label="Löschen" onClick={async () => {
                    if (!(await bestaetigen('Ressourcenart löschen', `„${a.name}“ löschen? Die Ressourcen bleiben erhalten (ohne Art).`))) return;
                    try { await loeschen(`${BASIS}/ressourcenarten/${a.id}`); void g.neu(); } catch (err) { fehler(err); }
                  }}><DeleteOutlineRounded fontSize="small" /></IconButton>
                </Stack>
              ))}
              {!arten.length && <Typography variant="body2" color="text.secondary">Noch keine Ressourcenarten.</Typography>}
              <Stack direction="row" gap={1} sx={{ mt: 1.5 }} component="form" onSubmit={async e => {
                e.preventDefault();
                if (!neueArt.trim()) return;
                try { await senden(`${BASIS}/ressourcenarten`, { name: neueArt, reihenfolge: arten.length * 10 + 10 }); toast('Ressourcenart angelegt.'); setNeueArt(''); void g.neu(); } catch (err) { fehler(err); }
              }}>
                <TextField size="small" value={neueArt} onChange={e => setNeueArt(e.target.value)} placeholder="Neue Ressourcenart" sx={{ flex: 1 }} slotProps={{ htmlInput: { maxLength: 100 } }} />
                <Button type="submit" variant="contained" startIcon={<AddRounded />}>Hinzufügen</Button>
              </Stack>
            </Paper>
            <Box>
              <Stack direction="row" gap={1.5} flexWrap="wrap" sx={{ mb: 1.5 }}>
                <SuchFeld wert={suche} onWert={setSuche} platzhalter="Ressource, Raum oder Standort suchen" breite={280} />
                <Wahl label="Art" wert={artFilter} onWert={setArtFilter} alle="Alle Arten" optionen={arten.map(a => [String(a.id), a.name])} />
                <Wahl label="Zuordnung" wert={zuordnung} onWert={setZuordnung} alle="Mobil und fest" optionen={[['mobil', 'Mobil'], ['fest', 'Fest in einem Raum']]} />
              </Stack>
              {liste.length ? (
                <Tabelle zeilen={sichtbar} schluessel={r => r.id} onZeile={r => setFormular(r)}
                  spalten={[
                    { id: 'name', kopf: 'Ressource', sortWert: r => r.name, zelle: r => <Stack direction="row" gap={1.25} alignItems="center"><Box sx={{ color: 'primary.main', display: 'flex' }}><ResSymbol r={r} /></Box><Box><Typography sx={{ fontWeight: 500 }}>{r.name}</Typography>{r.bemerkung && <Typography variant="caption" color="text.secondary">{r.bemerkung}</Typography>}</Box></Stack> },
                    { id: 'art', kopf: 'Art', sortWert: r => r.art ?? '', zelle: r => r.art ? <Plakette>{r.art}</Plakette> : null },
                    { id: 'zu', kopf: 'Zuordnung', zelle: r => (r.raum ? <Plakette>fest in {r.raum}</Plakette> : <Plakette ton="termin">mobil</Plakette>) },
                    { id: 'ort', kopf: 'Standort', zelle: r => (r.mobil ? r.standort : ''), verbergenMobil: true },
                    { id: 'anzahl', kopf: 'Anzahl', rechts: true, zelle: r => r.anzahl },
                    { id: 'status', kopf: 'Status', zelle: r => (r.aktiv ? <Plakette ton="ok">aktiv</Plakette> : <Plakette>inaktiv</Plakette>) },
                    { id: 'akt', kopf: '', rechts: true, zelle: r => <IconButton size="small" color="error" aria-label="Löschen" onClick={async e => {
                      e.stopPropagation();
                      if (!(await bestaetigen('Ressource löschen', `„${r.name}“ löschen? Bestehende Buchungen behalten ihre Termine.`))) return;
                      try { await loeschen(`${BASIS}/ressourcen/${r.id}`); void g.neu(); } catch (err) { fehler(err); }
                    }}><DeleteOutlineRounded fontSize="small" /></IconButton> },
                  ]} />
              ) : (
                <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
                  <Typography sx={{ fontWeight: 600 }}>Noch keine Ressourcen angelegt.</Typography>
                  <Typography variant="body2" color="text.secondary">Mobile Geräte (Beamer, Laptopwagen, Tablet-Koffer …) mit Anzahl und Standort oder feste Ausstattung eines Raums.</Typography>
                  <Stack direction="row" gap={1} justifyContent="center" sx={{ mt: 2 }}>
                    <Button variant="outlined" startIcon={<AutoAwesomeOutlined />} onClick={async () => { try { const r = await senden<{ angelegt: number }>(`${BASIS}/ressourcen/beispiele`, {}); toast(`${r.angelegt} Beispiel-Ressourcen angelegt.`); void g.neu(); } catch (err) { fehler(err); } }}>Beispiel-Ressourcen anlegen</Button>
                    <Button variant="contained" startIcon={<AddRounded />} onClick={() => setFormular({})}>Ressource hinzufügen</Button>
                  </Stack>
                </Paper>
              )}
            </Box>
            {art && <ArtDialog art={art} symbole={symbole} onClose={() => setArt(null)} fertig={() => void g.neu()} />}
            {formular && <RessourceDialog r={formular} arten={arten} opt={opt} standorte={[...new Set(liste.map(r => r.standort).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'de'))} onClose={() => setFormular(null)} fertig={() => void g.neu()} />}
          </Box>
        );
      }}</Geladen>
    </Seite>
  );
}

function ArtDialog({ art, symbole, onClose, fertig }: { art: Art; symbole: string[]; onClose: () => void; fertig: () => void }) {
  const [name, setName] = useState(art.name);
  const [symbol, setSymbol] = useState(art.symbol ?? '');
  const auto = ressourcenSymbolName({ art: name });
  return (
    <FormDialog offen titel="Ressourcenart bearbeiten" onClose={onClose} aktion={async () => { await senden(`${BASIS}/ressourcenarten/${art.id}`, { name, reihenfolge: art.reihenfolge, symbol }, 'PUT'); fertig(); }}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        <TextField label="Name" value={name} onChange={e => setName(e.target.value)} slotProps={{ htmlInput: { maxLength: 100 } }} />
        <Typography variant="body2" color="text.secondary">Symbol</Typography>
        <ToggleButtonGroup exclusive value={symbol} onChange={(_, v) => v !== null && setSymbol(v)} sx={{ flexWrap: 'wrap', gap: 0.5, '& .MuiToggleButton-root': { border: 1, borderColor: 'divider', borderRadius: '10px !important', width: 48, height: 44 } }}>
          {['', ...symbole].map(x => <Tooltip key={x} title={x || 'automatisch'}><ToggleButton value={x}>{x ? SYMBOLE[x] ?? x : <Stack alignItems="center">{SYMBOLE[auto]}<Typography sx={{ fontSize: 9 }}>auto</Typography></Stack>}</ToggleButton></Tooltip>)}
        </ToggleButtonGroup>
      </Stack>
    </FormDialog>
  );
}

function RessourceDialog({ r, arten, opt, standorte, onClose, fertig }: { r: Partial<Ressource>; arten: Art[]; opt: Optionen; standorte: string[]; onClose: () => void; fertig: () => void }) {
  const [w, setW] = useState({ name: r.name ?? '', artId: r.artId ?? null, fest: !!r.raum, raum: r.raum ?? '', anzahl: r.anzahl ?? 1, standort: r.standort ?? '', bemerkung: r.bemerkung ?? '', aktiv: r.aktiv !== false });
  return (
    <FormDialog offen titel={r.id ? 'Ressource bearbeiten' : 'Ressource hinzufügen'} breite="md" onClose={onClose} aktion={async () => {
      if (w.fest && !w.raum) { toast('Bitte einen Raum wählen.', true); return false; }
      const daten = { name: w.name, artId: w.artId, raum: w.fest ? w.raum : '', anzahl: w.fest ? 1 : w.anzahl || 1, bemerkung: w.bemerkung, aktiv: w.aktiv, standort: w.fest ? '' : w.standort };
      await senden(r.id ? `${BASIS}/ressourcen/${r.id}` : `${BASIS}/ressourcen`, daten, r.id ? 'PUT' : 'POST');
      toast('Ressource gespeichert.'); fertig();
    }}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        <Stack direction="row" gap={2}>
          <TextField label="Name" value={w.name} onChange={e => setW({ ...w, name: e.target.value })} placeholder="z. B. Beamer mobil 1" sx={{ flex: 2 }} slotProps={{ htmlInput: { maxLength: 100 } }} />
          <TextField select label="Ressourcenart" value={w.artId ?? ''} onChange={e => setW({ ...w, artId: e.target.value === '' ? null : Number(e.target.value) })} sx={{ flex: 1 }}><MenuItem value="">keine</MenuItem>{arten.map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}</TextField>
        </Stack>
        <ToggleButtonGroup exclusive value={w.fest ? 'fest' : 'mobil'} onChange={(_, v) => v && setW({ ...w, fest: v === 'fest' })}><ToggleButton value="mobil">Mobil (unabhängig von Räumen)</ToggleButton><ToggleButton value="fest">Fest in einem Raum</ToggleButton></ToggleButtonGroup>
        {w.fest ? (
          <TextField select label="Raum" value={w.raum} onChange={e => setW({ ...w, raum: e.target.value })}><MenuItem value="">bitte wählen</MenuItem>{opt.raeume.map(x => <MenuItem key={x.kurz} value={x.kurz}>{x.kurz}<Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>{x.name}</Typography></MenuItem>)}</TextField>
        ) : (
          <Stack direction="row" gap={2}>
            <TextField type="number" label="Anzahl (Stück)" value={w.anzahl} onChange={e => setW({ ...w, anzahl: Number(e.target.value) || 1 })} slotProps={{ htmlInput: { min: 1, max: 999 } }} sx={{ width: 160 }} />
            <Autocomplete freeSolo options={standorte} value={w.standort} onInputChange={(_, v) => setW({ ...w, standort: v })} sx={{ flex: 1 }} renderInput={p => <TextField {...p} label="Standort (Ausgabe bzw. Lagerort)" placeholder="z. B. Medienraum" />} />
          </Stack>
        )}
        <TextField label="Bemerkung" value={w.bemerkung} onChange={e => setW({ ...w, bemerkung: e.target.value })} slotProps={{ htmlInput: { maxLength: 500 } }} />
        <FormControlLabel control={<Switch checked={w.aktiv} onChange={e => setW({ ...w, aktiv: e.target.checked })} />} label="aktiv (buchbar bzw. als Kriterium wählbar)" />
      </Stack>
    </FormDialog>
  );
}

// ------------------------------------------------------------------ Raumdaten

type Raum = Optionen['raeume'][0];

function RaumZeile({ r, opt }: { r: Raum; opt: Optionen }) {
  const [w, setW] = useState({ kapazitaet: r.kapazitaet !== r.kapazitaetUntPlan ? String(r.kapazitaet ?? '') : '', gebaeude: r.gebaeude, abteilung: r.abteilung, raumgruppe: r.raumgruppe });
  const [alt, setAlt] = useState(w);
  useEffect(() => { setAlt(w); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const speichern = async () => {
    if (JSON.stringify(w) === JSON.stringify(alt)) return;
    try {
      await senden(`${BASIS}/raumdaten/${encodeURIComponent(r.kurz)}`, { kapazitaet: Number(w.kapazitaet) || 0, gebaeude: w.gebaeude, abteilung: w.abteilung, raumgruppe: w.raumgruppe }, 'PUT');
      setAlt(w); toast(`Raum ${r.kurz} gespeichert.`);
    } catch (err) { fehler(err); }
  };
  const frei = (k: 'gebaeude' | 'abteilung' | 'raumgruppe', liste: string[]) => (
    <Autocomplete freeSolo size="small" options={liste} value={w[k]} onInputChange={(_, v) => setW(x => ({ ...x, [k]: v }))} onBlur={speichern} sx={{ minWidth: 150 }} renderInput={p => <TextField {...p} aria-label={`${k} ${r.kurz}`} />} />
  );
  return (
    <Stack direction="row" gap={1.5} alignItems="center" sx={{ py: 1, borderTop: 1, borderColor: 'divider', flexWrap: { xs: 'wrap', lg: 'nowrap' } }}>
      <Box sx={{ width: 150 }}><Typography sx={{ fontWeight: 600 }}>{r.kurz}</Typography><Typography variant="caption" color="text.secondary">{r.name !== r.kurz ? r.name : ''}</Typography></Box>
      <Box sx={{ width: 110 }}>{r.raumart && <Plakette>{r.raumart}</Plakette>}</Box>
      <Box sx={{ width: 70 }}>{r.buchbar ? <Plakette ton="ok">ja</Plakette> : <Plakette>nein</Plakette>}</Box>
      <TextField size="small" type="number" value={w.kapazitaet} placeholder={String(r.kapazitaetUntPlan || '')} onChange={e => setW({ ...w, kapazitaet: e.target.value })} onBlur={speichern} sx={{ width: 100 }} slotProps={{ htmlInput: { min: 0, max: 9999, 'aria-label': `Kapazität ${r.kurz}` } }} />
      {frei('gebaeude', opt.gebaeude)}{frei('abteilung', opt.abteilungen)}{frei('raumgruppe', opt.raumgruppen)}
      <Stack direction="row" gap={0.5} flexWrap="wrap" sx={{ flex: 1 }}>{r.ressourcen.map(x => <Plakette key={x}>{x}</Plakette>)}</Stack>
    </Stack>
  );
}

export function Raumdaten() {
  const { ich } = useSitzung();
  const g = useLaden(sig => holen<Optionen>(`${BASIS}/optionen`, sig), []);
  const [suche, setSuche] = useState('');
  const [geb, setGeb] = useState('');
  const [buchbar, setBuchbar] = useState('');
  if (!ich.admin) return <Seite titel="Raumdaten"><Alert severity="warning">Nur für die Administration.</Alert></Seite>;
  return (
    <Seite titel="Raumdaten" untertitel={g.daten ? `${g.daten.raeume.length} Räume` : undefined}
      filter={g.daten && <>
        <SuchFeld wert={suche} onWert={setSuche} platzhalter="Raum suchen" />
        {g.daten.gebaeude.length > 0 && <Wahl label="Gebäude" wert={geb} onWert={setGeb} alle="Alle Gebäude" optionen={g.daten.gebaeude.map(x => [x, x])} />}
        <Wahl label="Buchbar" wert={buchbar} onWert={setBuchbar} alle="Alle Räume" optionen={[['ja', 'Nur buchbare'], ['nein', 'Nicht buchbare']]} />
      </>}>
      <Alert severity="info" sx={{ mb: 2 }}>Raumart, Kapazität und „buchbar“ kommen aus den Stammdaten von EduOrga Studio. Hier ergänzen Sie Gebäude, Abteilung und Raumgruppe (und bei Bedarf eine abweichende Kapazität) für die Auswahlkriterien beim Buchen. Feste Ressourcen ordnen Sie unter „Ressourcen verwalten“ zu. Änderungen werden beim Verlassen des Feldes gespeichert.</Alert>
      <Geladen g={g}>{opt => {
        const q = suche.toLowerCase();
        const l = opt.raeume.filter(r => (!q || `${r.kurz} ${r.name} ${r.raumart} ${r.gebaeude} ${r.abteilung} ${r.raumgruppe}`.toLowerCase().includes(q)) && (!geb || r.gebaeude === geb) && (!buchbar || (r.buchbar ? 'ja' : 'nein') === buchbar));
        return (
          <Paper variant="outlined" sx={{ px: 2, overflowX: 'auto' }}>
            <Stack direction="row" gap={1.5} sx={{ py: 1, color: 'text.secondary', fontSize: 12.5, fontWeight: 600, display: { xs: 'none', lg: 'flex' } }}>
              <Box sx={{ width: 150 }}>Raum</Box><Box sx={{ width: 110 }}>Raumart</Box><Box sx={{ width: 70 }}>Buchbar</Box><Box sx={{ width: 100 }}>Kapazität</Box><Box sx={{ minWidth: 150, flex: 1 }}>Gebäude</Box><Box sx={{ minWidth: 150, flex: 1 }}>Abteilung</Box><Box sx={{ minWidth: 150, flex: 1 }}>Raumgruppe</Box><Box sx={{ flex: 1 }}>Feste Ressourcen</Box>
            </Stack>
            {l.map(r => <RaumZeile key={r.kurz} r={r} opt={opt} />)}
          </Paper>
        );
      }}</Geladen>
    </Seite>
  );
}
