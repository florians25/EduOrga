// Administration | Darstellung der Stundenkarten: links die Einstellungen (Vorlagen, Fachfarbe, Fläche, Rahmen, Dichte, Inhalt, Status),
// rechts eine Live-Vorschau mit der echten Kachel im echten Wochenraster (Woche bzw. Tag) und eine Listenzeile wie auf der Startseite.
// Speichern gilt schulweit für alle Konten (mit der nächsten Sitzung; die eigene Oberfläche sofort).
import { useMemo, useState, type ReactNode } from 'react';
import {
  Alert, Box, Button, FormControlLabel, Grid, MenuItem, Paper, Slider, Stack, Switch, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { api, holen, senden } from '../../api/client';
import type { Karte, Wochenplan } from '../../api/types';
import { useSitzung } from '../../app/sitzung';
import { Geladen } from '../../components/Seite';
import { Wochenraster } from '../../components/plan/Wochenraster';
import { karteAus } from '../../components/plan/karte';
import {
  DarstellungsAnbieter, FachMarke, istStandard, mitBalken, mitStandard, mitToenung, STANDARD, VORLAGEN, vorlageVon,
  type Kartendarstellung, type Namen,
} from '../../components/plan/darstellung';
import { bestaetigen, fehler, toast } from '../../lib/meldungen';
import { useLaden } from '../../lib/useLaden';
import { Karte as Kasten } from './Admin';

// ------------------------------------------------------------------ Beispielwoche der Vorschau (Klasse 5a, Mo–Mi, ohne heutigen Tag)

const TAGE = ['2030-03-04', '2030-03-05', '2030-03-06'];
const ZEITEN = [
  { nr: 1, bezeichnung: '1', beginn: '08:00', ende: '08:45' }, { nr: 2, bezeichnung: '2', beginn: '08:50', ende: '09:35' },
  { nr: 3, bezeichnung: '3', beginn: '09:55', ende: '10:40' }, { nr: 4, bezeichnung: '4', beginn: '10:45', ende: '11:30' },
];
const zeit = (von: number, bis = von) => ({ beginn: ZEITEN[von - 1].beginn, ende: ZEITEN[bis - 1].ende });
const BEISPIELE: Karte[] = [
  karteAus({ datum: TAGE[0], von: 1, bis: 2, ...zeit(1, 2), fach: 'M', fachName: 'Mathematik', farbe: '#2f6f9f', lehrer: ['MUE'], raeume: ['R101'], klassen: ['5a'] }),
  karteAus({ datum: TAGE[0], von: 3, ...zeit(3), status: 'geaendert', art: 'Vertretung', fach: 'D', fachName: 'Deutsch', farbe: '#b0413e', lehrer: [{ k: 'BEC', alt: 'HOF', neu: true }], raeume: ['R102'], klassen: ['5a'] }),
  karteAus({ datum: TAGE[0], von: 4, ...zeit(4), status: 'geaendert', art: 'Raumänderung', fach: 'E', fachName: 'Englisch', farbe: '#3d8b5a', lehrer: ['KRA'], raeume: [{ k: 'R204', alt: 'R105', neu: true }], klassen: ['5a'] }),
  karteAus({ datum: TAGE[1], von: 1, ...zeit(1), status: 'entfall', art: 'Entfall', fach: 'BIO', fachName: 'Biologie', farbe: '#6f8f2f', lehrer: ['SNE'], raeume: ['R110'], klassen: ['5a'] }),
  karteAus({ datum: TAGE[1], von: 2, ...zeit(2), status: 'offen', art: 'Vertretung', fach: 'PH', fachName: 'Physik', farbe: '#7a5aa6', lehrer: [{ k: '', alt: 'WEI' }], raeume: ['R301'], klassen: ['5a'], vertretungOffen: true }),
  karteAus({ datum: TAGE[1], von: 3, bis: 4, ...zeit(3, 4), status: 'klausur', art: 'Klausur', fach: 'M', fachName: 'Mathematik', farbe: '#2f6f9f', lehrer: ['MUE'], raeume: ['R101'], klassen: ['5a'] }),
  karteAus({ datum: TAGE[2], von: 1, ...zeit(1), fach: 'EK', fachName: 'Erdkunde', farbe: '#a0712b', lehrer: ['LOR'], raeume: ['R205'], klassen: ['5a'], online: true, onlineLink: 'https://example.org/unterricht' }),
  karteAus({ datum: TAGE[2], von: 2, ...zeit(2), status: 'veranstaltung', art: 'Veranstaltung', text: 'Lesewettbewerb', lehrer: ['HOF'], raeume: ['Aula'], klassen: ['5a'] }),
  karteAus({ datum: TAGE[2], von: 3, ...zeit(3), fach: 'KU', fachName: 'Kunst', farbe: '#c0508a', lehrer: ['ROS'], raeume: ['K1'], klassen: ['5a'] }),
  karteAus({ datum: TAGE[2], von: 4, ...zeit(4), fach: 'SP', fachName: 'Sport', farbe: '#2b8c8c', lehrer: ['BRA'], raeume: ['TH'], klassen: ['5a'] }),
];
const PLAN: Wochenplan = {
  typ: 'klasse', element: '5a', name: '5a', montag: TAGE[0], woche: '', zeitraster: ZEITEN, karten: BEISPIELE, aufsichten: [], gesperrt: false, sperrhinweis: null, abwesenheiten: [],
  tage: TAGE.map(datum => ({ datum, wochentag: '', woche: '', frei: false, freiGrund: null, tagesaktuell: false, hinweise: [], ereignisse: [], freiArt: null, freiVon: null, freiBis: null })),
};
const NAMEN: Namen = {
  lehrer: new Map([['mue', 'Müller'], ['bec', 'Becker'], ['hof', 'Hofmann'], ['kra', 'Krause'], ['sne', 'Schneider'], ['wei', 'Weiß'], ['lor', 'Lorenz'], ['ros', 'Rose'], ['bra', 'Braun']]),
  klassen: new Map(), raeume: new Map(),
};

// ------------------------------------------------------------------ Bausteine des Formulars

function Feld({ titel, hilfe, children }: { titel: string; hilfe?: string; children: ReactNode }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.75 }}>{titel}</Typography>
      {children}
      {hilfe && <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>{hilfe}</Typography>}
    </Box>
  );
}

function Wahl<T extends string>({ wert, optionen, onWahl, label }: { wert: T; optionen: [T, string][]; onWahl: (v: T) => void; label: string }) {
  return (
    <ToggleButtonGroup exclusive size="small" value={wert} onChange={(_, v) => v && onWahl(v as T)} aria-label={label}
      sx={{ display: 'flex', flexWrap: 'wrap', '& .MuiToggleButton-root': { flex: '1 1 auto', px: 1.25, whiteSpace: 'nowrap' } }}>
      {optionen.map(([v, t]) => <ToggleButton key={v} value={v}>{t}</ToggleButton>)}
    </ToggleButtonGroup>
  );
}

function Abschnitt({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <Stack gap={2} sx={{ pt: 2, borderTop: 1, borderColor: 'divider' }}>
      <Typography variant="h4" component="h3">{titel}</Typography>
      {children}
    </Stack>
  );
}

// ------------------------------------------------------------------ Vorschau

function Vorschau({ d }: { d: Kartendarstellung }) {
  const [ansicht, setAnsicht] = useState<'woche' | 'tag'>('woche');
  return (
    <DarstellungsAnbieter wert={d} namen={NAMEN}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.5 }} flexWrap="wrap">
        <Typography variant="h4" component="h3" sx={{ flex: 1 }}>Vorschau</Typography>
        <ToggleButtonGroup exclusive size="small" value={ansicht} onChange={(_, v) => v && setAnsicht(v)} aria-label="Vorschau als Woche oder Tag">
          <ToggleButton value="woche">Woche</ToggleButton><ToggleButton value="tag">Tag</ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      <Paper variant="outlined" sx={{ borderRadius: '4px', overflow: 'hidden' }} aria-label="Vorschau der Stundenkarten (Beispielwoche Klasse 5a)" role="region">
        <Wochenraster plan={PLAN} onOpen={() => undefined} optionen={{ nurTag: ansicht === 'tag' ? 0 : null }} />
      </Paper>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
        Beispiele: Doppelstunde, Vertretung (BEC statt HOF), Raumänderung, Entfall, offene Vertretung, Prüfung, Online-Unterricht, Termin.
      </Typography>
      <Typography variant="h4" component="h3" sx={{ mt: 2.5, mb: 1 }}>Listen und Stundendetails</Typography>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack gap={1}>
          {BEISPIELE.slice(1, 3).map((k, i) => (
            <Stack key={i} direction="row" alignItems="center" gap={1.25} sx={{ minHeight: 28 }}>
              <Typography variant="body2" color="text.secondary" sx={{ width: 48, fontVariantNumeric: 'tabular-nums' }}>{k.beginn}</Typography>
              <FachMarke farbe={k.farbe} />
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{d.fach === 'name' ? k.fachName : k.fach}</Typography>
              <Typography variant="body2" color="text.secondary" noWrap>{k.raeume.map(w => w.k).join(', ')}</Typography>
            </Stack>
          ))}
        </Stack>
      </Paper>
    </DarstellungsAnbieter>
  );
}

// ------------------------------------------------------------------ Seite

export default function Stundenkarten() {
  const s = useSitzung();
  const g = useLaden(sig => holen<Kartendarstellung>('/api/app/darstellung', sig).then(mitStandard), []);
  const [entwurf, setEntwurf] = useState<Kartendarstellung | null>(null);
  const [speichert, setSpeichert] = useState(false);
  const gespeichert = g.daten ?? STANDARD;
  const d = entwurf ?? gespeichert;
  const geaendert = useMemo(() => !!entwurf && (Object.keys(STANDARD) as (keyof Kartendarstellung)[]).some(k => entwurf[k] !== gespeichert[k]), [entwurf, gespeichert]);
  const set = <K extends keyof Kartendarstellung>(k: K, v: Kartendarstellung[K]) => setEntwurf({ ...d, [k]: v });
  const vorlage = vorlageVon(d);
  const balken = mitBalken(d.fachfarbe);

  const uebernehmen = (neu: Kartendarstellung) => {
    g.setDaten(neu);
    setEntwurf(null);
    s.setSitzung({ ...s.sitzung, darstellung: neu });
  };
  const speichern = async () => {
    setSpeichert(true);
    try { uebernehmen(mitStandard(await senden<Kartendarstellung>('/api/app/darstellung', d, 'PUT'))); toast('Darstellung der Stundenkarten gespeichert – sie gilt für alle Konten.'); }
    catch (err) { fehler(err); } finally { setSpeichert(false); }
  };
  const zuruecksetzen = async () => {
    if (!(await bestaetigen('Auf Standard zurücksetzen?', 'Die Stundenkarten erscheinen danach für alle Konten wieder in der Standarddarstellung „Klassisch“.', 'Zurücksetzen'))) return;
    setSpeichert(true);
    try { uebernehmen(mitStandard(await api<Kartendarstellung>('/api/app/darstellung', { methode: 'DELETE' }))); toast('Standarddarstellung wiederhergestellt.'); }
    catch (err) { fehler(err); } finally { setSpeichert(false); }
  };

  return (
    <Geladen g={g}>{() => (
      <Grid container spacing={2.5} alignItems="flex-start">
        <Grid size={{ xs: 12, lg: 5 }} sx={{ order: { xs: 2, lg: 1 } }}>
          <Kasten>
            <Stack gap={2}>
              <Typography variant="body2" color="text.secondary">
                Legt fest, wie Stunden im Stundenplan, auf den Tagesseiten, der Startseite und in den Stundendetails erscheinen – für alle Konten.
                Änderungen, Entfall, Prüfungen und Termine bleiben immer an Linie, Schraffur und Kürzel-Plaketten erkennbar.
              </Typography>
              <Feld titel="Vorlage" hilfe={vorlage ? VORLAGEN.find(v => v.id === vorlage)?.hinweis : 'Eigene Einstellung'}>
                <ToggleButtonGroup exclusive size="small" value={vorlage} onChange={(_, v) => { const x = VORLAGEN.find(y => y.id === v); if (x) setEntwurf({ ...x.werte }); }} aria-label="Vorlage"
                  sx={{ display: 'flex', flexWrap: 'wrap', '& .MuiToggleButton-root': { flex: '1 1 auto', px: 1.25, whiteSpace: 'nowrap' } }}>
                  {VORLAGEN.map(v => <ToggleButton key={v.id} value={v.id}>{v.name}</ToggleButton>)}
                </ToggleButtonGroup>
              </Feld>

              <Abschnitt titel="Fachfarbe">
                <Wahl label="Fachfarbe" wert={d.fachfarbe} onWahl={v => set('fachfarbe', v)}
                  optionen={[['balken-innen', 'Streifen innen'], ['balken-flaeche', 'Balken links und Tönung'], ['balken-links', 'Balken links'], ['balken-oben', 'Balken oben'], ['quadrat', 'Quadrat'], ['flaeche', 'Fläche'], ['keine', 'Keine']]} />
                {balken && (
                  <Feld titel={`Balkenbreite: ${d.balkenbreite} px`}>
                    <Slider size="small" min={2} max={6} step={1} marks value={d.balkenbreite} onChange={(_, v) => set('balkenbreite', v as number)} aria-label="Balkenbreite in Pixel" valueLabelDisplay="auto" sx={{ maxWidth: 320 }} />
                  </Feld>
                )}
                {mitToenung(d.fachfarbe) && (
                  <Feld titel={`Deckkraft der Tönung: ${d.deckkraft} %`} hilfe="Niedrige Werte halten den Text gut lesbar; Entfall wird nie getönt.">
                    <Slider size="small" min={6} max={30} step={1} value={d.deckkraft} onChange={(_, v) => set('deckkraft', v as number)} aria-label="Deckkraft der Fachfarbe in Prozent" valueLabelDisplay="auto" sx={{ maxWidth: 320 }} />
                  </Feld>
                )}
              </Abschnitt>

              <Abschnitt titel="Karte">
                <Feld titel="Fläche"><Wahl label="Kartenfläche" wert={d.flaeche} onWahl={v => set('flaeche', v)} optionen={[['neutral', 'Neutral'], ['weiss', 'Weiß'], ['getoent', 'Getönt']]} /></Feld>
                <Feld titel="Rahmen" hilfe={d.rahmen === 'keiner' ? 'Status-Linien (Änderung, Entfall, Prüfung, Termin) bleiben sichtbar.' : undefined}>
                  <Wahl label="Rahmen" wert={d.rahmen} onWahl={v => set('rahmen', v)} optionen={[['schatten', 'Schatten'], ['fein', 'Fein'], ['kraeftig', 'Kräftig'], ['keiner', 'Keiner']]} />
                </Feld>
                <Feld titel={`Eckenradius: ${d.eckenradius} px`}>
                  <Slider size="small" min={0} max={8} step={1} marks value={d.eckenradius} onChange={(_, v) => set('eckenradius', v as number)} aria-label="Eckenradius in Pixel" valueLabelDisplay="auto" sx={{ maxWidth: 320 }} />
                </Feld>
                <Feld titel="Raster"><Wahl label="Raster" wert={d.raster} onWahl={v => set('raster', v)} optionen={[['grau', 'Hellgrau'], ['weiss', 'Weiß']]} /></Feld>
                <Feld titel="Dichte" hilfe="Innenabstand und Schriftgrößen der Kacheln.">
                  <Wahl label="Dichte" wert={d.dichte} onWahl={v => set('dichte', v)} optionen={[['kompakt', 'Kompakt'], ['normal', 'Normal'], ['grosszuegig', 'Großzügig']]} />
                </Feld>
              </Abschnitt>

              <Abschnitt titel="Inhalt">
                <Feld titel="Reihenfolge" hilfe="Untereinander braucht eine Karte mindestens 45 Minuten Höhe; kürzere Karten zeigen Fach und Lehrkraft bzw. Klasse in einer Zeile.">
                  <Wahl label="Reihenfolge" wert={d.reihenfolge} onWahl={v => set('reihenfolge', v)} optionen={[['element', 'Lehrkraft/Klasse · Fach · Raum'], ['fach', 'Fach und Raum oben']]} />
                </Feld>
                <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap">
                  <TextField select label="Fach als" value={d.fach} onChange={e => set('fach', e.target.value as Kartendarstellung['fach'])} sx={{ minWidth: 180 }}>
                    <MenuItem value="kuerzel">Kürzel</MenuItem><MenuItem value="name">Ausgeschrieben</MenuItem>
                  </TextField>
                  <FormControlLabel control={<Switch checked={d.raum} onChange={e => set('raum', e.target.checked)} />} label="Raum anzeigen" />
                </Stack>
                <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap">
                  <FormControlLabel control={<Switch checked={d.zeile2} onChange={e => set('zeile2', e.target.checked)} />} label="Lehrkraft bzw. Klasse anzeigen" />
                  <TextField select label="Lehrkraft bzw. Klasse als" value={d.zeile2Text} disabled={!d.zeile2} onChange={e => set('zeile2Text', e.target.value as Kartendarstellung['zeile2Text'])} sx={{ minWidth: 180 }}>
                    <MenuItem value="kuerzel">Kürzel</MenuItem><MenuItem value="name">Name</MenuItem>
                  </TextField>
                </Stack>
                {(!d.raum || !d.zeile2) && <Typography variant="caption" color="text.secondary">Geänderte Räume und Lehrkräfte stehen trotzdem auf der Kachel.</Typography>}
                <Feld titel="Kürzel als Label"><Wahl label="Kürzel als Label" wert={d.kuerzel} onWahl={v => set('kuerzel', v)} optionen={[['gefuellt', 'Gefüllt'], ['umrandet', 'Umrandet'], ['text', 'Text']]} /></Feld>
              </Abschnitt>

              <Abschnitt titel="Status">
                <Typography variant="body2" color="text.secondary">Linie, Schraffur, Durchstreichung und Kürzel-Plaketten bleiben unverändert.</Typography>
                <FormControlLabel control={<Switch checked={d.statusflaeche} onChange={e => set('statusflaeche', e.target.checked)} />} label="Änderungen und Prüfungen hell hinterlegen (Vertretung violett, Prüfung bernstein)" />
                <FormControlLabel control={<Switch checked={d.statuswoerter} onChange={e => set('statuswoerter', e.target.checked)} />} label="Statuswörter auf Kacheln anzeigen (Entfall, Offen, Vertreten …)" />
              </Abschnitt>

              {geaendert && <Alert severity="info" variant="outlined">Nicht gespeicherte Änderungen – erst „Speichern“ übernimmt die Darstellung für alle.</Alert>}
              <Stack direction="row" gap={1} flexWrap="wrap" sx={{ pt: 1 }}>
                <Button variant="contained" disabled={!geaendert || speichert} onClick={speichern}>Speichern</Button>
                <Button variant="outlined" disabled={!geaendert || speichert} onClick={() => setEntwurf(null)}>Abbrechen</Button>
                <Box sx={{ flex: 1 }} />
                <Button color="inherit" disabled={speichert || (istStandard(gespeichert) && !entwurf)} onClick={zuruecksetzen}>Zurücksetzen auf Standard</Button>
              </Stack>
            </Stack>
          </Kasten>
        </Grid>
        <Grid size={{ xs: 12, lg: 7 }} sx={{ order: { xs: 1, lg: 2 }, position: { lg: 'sticky' }, top: { lg: 16 } }}>
          <Kasten><Vorschau d={d} /></Kasten>
        </Grid>
      </Grid>
    )}</Geladen>
  );
}
