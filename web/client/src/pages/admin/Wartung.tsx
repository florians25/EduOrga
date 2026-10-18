// Administration → Wartung: Aktive Benutzer (Sitzungen mit letzter Aktivität), Zugriff ent-/sperren (Wartungsmodus: nur die Administration
// kann sich anmelden, angemeldete Benutzer bleiben angemeldet) und „Über UntPlan“ (Version, letzte Übertragungen, Module).
import { useEffect, useState } from 'react';
import { Alert, Box, Button, FormControlLabel, Paper, Stack, Switch, TextField, Typography, useTheme } from '@mui/material';
import CheckCircleOutlineRounded from '@mui/icons-material/CheckCircleOutlineRounded';
import LockOpenOutlined from '@mui/icons-material/LockOpenOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import RemoveCircleOutlineRounded from '@mui/icons-material/RemoveCircleOutlineRounded';
import { holen, senden } from '../../api/client';
import { Geladen } from '../../components/Seite';
import { NamensAvatar, Plakette, SuchFeld, Wahl } from '../../components/Bausteine';
import { Tabelle } from '../../components/Tabelle';
import { datumDe } from '../../lib/datum';
import { fehler, toast } from '../../lib/meldungen';
import { navigieren } from '../../lib/router';
import { useLaden } from '../../lib/useLaden';
import { Karte, kurzZeit } from './Admin';

const vor = (min: number) => (min < 1 ? 'gerade eben' : min < 60 ? `vor ${min} min` : min < 1440 ? `vor ${Math.floor(min / 60)} h` : `vor ${Math.floor(min / 1440)} d`);

export default function Wartung({ art, teil }: { art: 'aktive' | 'zugriff' | 'ueber'; teil?: string }) {
  return art === 'aktive' ? <Aktive stunden={['1', '24', '168'].includes(teil ?? '') ? teil! : '24'} /> : art === 'zugriff' ? <Zugriff /> : <Ueber />;
}

interface Sitzung { benutzerId: number; login: string; anzeigename: string; rollenname: string; geraet?: string; adresse?: string; beginn: string; letzte: string; minuten: number; aktiv: boolean }

function Aktive({ stunden }: { stunden: string }) {
  const t = useTheme();
  const g = useLaden(sig => holen<{ sitzungen: Sitzung[]; aktivMinuten: number; gesperrt: boolean }>(`/api/app/admin/sitzungen?stunden=${stunden}`, sig), [stunden]);
  const [suche, setSuche] = useState('');
  return (
    <Geladen g={g}>{d => {
      const aktiv = d.sitzungen.filter(s => s.aktiv);
      const l = d.sitzungen.filter(s => !suche || `${s.login} ${s.anzeigename} ${s.rollenname}`.toLowerCase().includes(suche.toLowerCase()));
      return (
        <Stack gap={2}>
          {d.gesperrt && <Alert severity="warning" icon={<LockOutlined />}>Der Zugriff ist gesperrt: Nur die Administration kann sich anmelden. <a href="#/admin/zugriff">Zugriff freigeben</a></Alert>}
          <Stack direction="row" gap={1} flexWrap="wrap">
            <Plakette ton="ok">{aktiv.length} gerade aktiv (letzte {d.aktivMinuten} min)</Plakette><Plakette>{d.sitzungen.length} Sitzungen</Plakette><Plakette>{new Set(d.sitzungen.map(s => s.benutzerId)).size} Benutzer</Plakette>
          </Stack>
          <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="center">
            <SuchFeld wert={suche} onWert={setSuche} platzhalter="Benutzer suchen" />
            <Wahl label="Aktivität" wert={stunden} onWert={v => navigieren(`#/admin/aktive/${v}`, true)} optionen={[['1', 'letzte Stunde'], ['24', 'letzte 24 Stunden'], ['168', 'letzte 7 Tage']]} />
            <Box sx={{ flex: 1 }} />
            <Button startIcon={<RefreshRounded />} onClick={() => void g.neu()}>Aktualisieren</Button>
            <Button variant="outlined" startIcon={<LockOutlined />} href="#/admin/zugriff">Zugriff ent-/sperren</Button>
          </Stack>
          <Tabelle zeilen={l} schluessel={(s, i) => `${s.benutzerId}-${i}`} leer="In diesem Zeitraum war niemand angemeldet."
            spalten={[
              { id: 'b', kopf: 'Benutzer', sortWert: s => s.anzeigename || s.login, zelle: s => <Stack direction="row" gap={1.25} alignItems="center"><Box sx={{ position: 'relative' }}><NamensAvatar name={s.anzeigename || s.login} groesse={32} />
                {s.aktiv && <Box sx={{ position: 'absolute', right: -1, bottom: -1, width: 10, height: 10, borderRadius: '50%', bgcolor: t.palette.status.ok.main, border: 2, borderColor: 'background.paper' }} />}</Box>
                <Box><Typography sx={{ fontWeight: 500 }}>{s.anzeigename || s.login}</Typography><Typography variant="caption" color="text.secondary">{s.login}</Typography></Box></Stack> },
              { id: 'r', kopf: 'Rolle', zelle: s => s.rollenname },
              { id: 'g', kopf: 'Gerät', zelle: s => s.geraet || '–', verbergenMobil: true },
              { id: 'a', kopf: 'Adresse', zelle: s => s.adresse || '–', verbergenMobil: true },
              { id: 'seit', kopf: 'Angemeldet seit', nowrap: true, sortWert: s => s.beginn, zelle: s => kurzZeit(s.beginn), verbergenMobil: true },
              { id: 'letzte', kopf: 'Letzte Aktivität', nowrap: true, sortWert: s => -s.minuten, zelle: s => <Box><Typography variant="body2">{vor(s.minuten)}</Typography><Typography variant="caption" color="text.secondary">{kurzZeit(s.letzte)}</Typography></Box> },
            ]} />
          <Typography variant="body2" color="text.secondary">Angezeigt werden Sitzungen seit dem letzten Start von UntPlanWeb. „Gerade aktiv“: Aktivität in den letzten {d.aktivMinuten} Minuten. Vor Wartungsarbeiten (z. B. einem Import aus dem Desktop-Programm) prüfen Sie hier, ob noch jemand arbeitet.</Typography>
        </Stack>
      );
    }}</Geladen>
  );
}

function Zugriff() {
  const g = useLaden(sig => holen<{ gesperrt: boolean; seit?: string; von?: string; hinweis: string; standardHinweis: string; aktiv: number; aktivMinuten: number; aktivOhneAdmin: number }>('/api/app/admin/zugriff', sig), []);
  const [w, setW] = useState<{ gesperrt: boolean; hinweis: string } | null>(null);
  useEffect(() => { if (g.daten) setW({ gesperrt: g.daten.gesperrt, hinweis: g.daten.hinweis }); }, [g.daten]);
  return (
    <Geladen g={g}>{d => w && (
      <Stack gap={2.5} sx={{ maxWidth: 820 }}>
        <Paper variant="outlined" sx={{ p: 2.5, display: 'flex', gap: 2, alignItems: 'center', borderColor: d.gesperrt ? 'warning.main' : 'divider' }}>
          <Box sx={{ width: 48, height: 48, borderRadius: 3, display: 'grid', placeItems: 'center', bgcolor: 'action.selected', color: d.gesperrt ? 'warning.main' : 'success.main' }}>{d.gesperrt ? <LockOutlined /> : <LockOpenOutlined />}</Box>
          <Box><Typography variant="h3">{d.gesperrt ? 'Zugriff gesperrt' : 'Zugriff freigegeben'}</Typography>
            <Typography variant="body2" color="text.secondary">{d.gesperrt ? `Seit ${kurzZeit(d.seit)}${d.von ? ` (${d.von})` : ''} können sich nur Konten der Administration anmelden.` : 'Alle Benutzer können sich anmelden.'}</Typography></Box>
        </Paper>
        <Karte>
          <Stack gap={2}>
            <FormControlLabel control={<Switch checked={w.gesperrt} onChange={e => setW({ ...w, gesperrt: e.target.checked })} />} label="Zugriff sperren (Wartungsmodus)" />
            <TextField label="Hinweis auf der Anmeldeseite" value={w.hinweis} onChange={e => setW({ ...w, hinweis: e.target.value })} placeholder={d.standardHinweis} multiline minRows={3} slotProps={{ htmlInput: { maxLength: 500 } }} />
            <Alert severity="info">Bereits angemeldete Benutzer werden durch das Sperren nicht abgemeldet. Derzeit {d.aktiv === 1 ? 'ist 1 Sitzung' : `sind ${d.aktiv} Sitzungen`} aktiv (letzte {d.aktivMinuten} min){d.aktivOhneAdmin ? `, davon ${d.aktivOhneAdmin} ohne Administration` : ''}. Prüfen Sie vor dem Sperren unter <a href="#/admin/aktive">Aktive Benutzer</a>, dass niemand mehr arbeitet.</Alert>
            <Box><Button variant="contained" onClick={async () => {
              try { const r = await senden<{ gesperrt: boolean }>('/api/app/admin/zugriff', w, 'PUT'); toast(r.gesperrt ? 'Zugriff gesperrt – nur die Administration kann sich anmelden.' : 'Zugriff freigegeben.'); void g.neu(); } catch (err) { fehler(err); }
            }}>Speichern</Button></Box>
          </Stack>
        </Karte>
      </Stack>
    )}</Geladen>
  );
}

interface UeberDaten {
  produkt: string; version: string; datenbank: string; schemastand: number; laufzeit: string; schule?: string;
  paket?: { schuljahrVon: string; schuljahrBis: string; klassen: number; lehrer: number; schueler: number };
  importe: { name: string; empfangen?: string; revision?: number; programmversion?: string }[]; module: { name: string; aktiv: boolean; hinweis?: string }[];
}

function Ueber() {
  const g = useLaden(sig => holen<UeberDaten>('/api/app/admin/ueber', sig), []);
  return (
    <Geladen g={g}>{d => {
      const wert = (t: string, w: string) => <Box key={t}><Typography variant="caption" color="text.secondary">{t}</Typography><Typography sx={{ fontWeight: 500 }}>{w}</Typography></Box>;
      return (
        <Stack gap={2.5}>
          <Karte titel={`${d.produkt} ${d.version}`}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
              {wert('Version', d.version)}{wert('Datenbank', `${d.datenbank} · Schema ${d.schemastand}`)}{wert('Laufzeit', d.laufzeit)}{wert('Schule', d.schule || '–')}
              {d.paket && wert('Schuljahr', `${datumDe(d.paket.schuljahrVon)} – ${datumDe(d.paket.schuljahrBis)}`)}
              {d.paket && wert('Daten', `${d.paket.klassen} Klassen · ${d.paket.lehrer} Lehrkräfte · ${d.paket.schueler} Schüler*innen`)}
            </Box>
          </Karte>
          <Karte titel="Letzte Übertragungen aus dem Desktop-Programm">
            <Tabelle zeilen={d.importe} schluessel={i => i.name} rahmen={false}
              spalten={[{ id: 'n', kopf: 'Daten', zelle: i => <b>{i.name}</b> }, { id: 'e', kopf: 'Übertragen am', zelle: i => (i.empfangen ? kurzZeit(i.empfangen) : <Plakette>noch nie</Plakette>) },
                { id: 'r', kopf: 'Revision', zelle: i => i.revision ?? '–' }, { id: 'v', kopf: 'Desktop-Version', zelle: i => i.programmversion || '–' }]} />
          </Karte>
          <Karte titel="Module">
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>
              {d.module.map(m => (
                <Stack key={m.name} direction="row" gap={1.25} alignItems="center" sx={{ opacity: m.aktiv ? 1 : 0.6 }}>
                  {m.aktiv ? <CheckCircleOutlineRounded color="success" /> : <RemoveCircleOutlineRounded color="disabled" />}
                  <Box><Typography sx={{ fontWeight: 500 }}>{m.name}</Typography><Typography variant="caption" color="text.secondary">{m.aktiv ? 'freigeschaltet' : 'nicht eingerichtet'}{m.hinweis ? ` · ${m.hinweis}` : ''}</Typography></Box>
                </Stack>
              ))}
            </Box>
          </Karte>
        </Stack>
      );
    }}</Geladen>
  );
}
