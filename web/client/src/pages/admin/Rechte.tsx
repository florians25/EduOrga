// Administration → Rechte und Rollen: Rollen als Rechte-Profile (Matrix Rollen × Rechte bzw. Rolle für Rolle auf schmalen Bildschirmen),
// Stufen „Kein Zugriff / Lesen / Schreiben“, Stundenplan-Zeitraum je Rolle, Rollen anlegen/kopieren/bearbeiten/zurücksetzen/löschen;
// Rechte einzelner Benutzer (Profil, Überschreibungen, Vorschau der effektiven Rechte) und Passwortregeln. Alle Rechte kommen aus dem
// Katalog des Servers – neue Rechte und Gruppen erscheinen automatisch.
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert, alpha, Box, Button, Divider, IconButton, List, ListItemButton, ListItemText, MenuItem, Paper, Stack, Tab, Tabs, TextField, ToggleButton, ToggleButtonGroup,
  Tooltip, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import BlockRounded from '@mui/icons-material/BlockRounded';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import DoneAllRounded from '@mui/icons-material/DoneAllRounded';
import EditOutlined from '@mui/icons-material/EditOutlined';
import EditRounded from '@mui/icons-material/EditRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import RestartAltRounded from '@mui/icons-material/RestartAltRounded';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import { holen, loeschen, senden } from '../../api/client';
import { Geladen } from '../../components/Seite';
import { FormDialog, Plakette, SuchFeld, Wahl } from '../../components/Bausteine';
import { bestaetigen, fehler, toast } from '../../lib/meldungen';
import { navigieren } from '../../lib/router';
import { lesen as speicherLesen, schreiben as speicherSchreiben } from '../../lib/speicher';
import { useLaden } from '../../lib/useLaden';
import { Einstellung } from './Admin';

interface Recht { id: string; name: string; beschreibung: string; gruppe: string; zweistufig: boolean; nurKollegium?: boolean; standard?: Record<string, number> }
interface Profil { id: string; name: string; beschreibung: string; basis: string; basisName: string; system: boolean; aenderbar: boolean; benutzer: number; rechte: Record<string, number>; planWochenZurueck?: number | null; planWochenVor?: number | null }
interface Katalog { rechte: Recht[]; profile: Profil[]; gruppen?: string[]; basisrollen: { id: string; name: string }[]; planWochenHoechstens?: number; rueckwirkendTage?: number }
const FENSTER: ['planWochenZurueck' | 'planWochenVor', string, string][] = [
  ['planWochenZurueck', 'Wochen zurück', 'Wie viele Wochen vor der aktuellen Woche der Stundenplan angezeigt wird. Leer = unbegrenzt, 0 = keine früheren Wochen.'],
  ['planWochenVor', 'Wochen voraus', 'Wie viele Wochen nach der aktuellen Woche der Stundenplan angezeigt wird. Leer = unbegrenzt, 0 = keine künftigen Wochen.'],
];
const wochenZahl = (v: string) => (v === '' ? null : Math.max(0, Math.round(Number(v))));
const fensterText = (v?: number | null) => (v == null ? 'unbegrenzt' : v === 1 ? '1 Woche' : `${v} Wochen`);
const gruppenAus = (k: Katalog) => [...new Set([...(k.gruppen ?? []), ...k.rechte.map(r => r.gruppe || 'Weitere Rechte')])];
const norm = (t: string) => String(t ?? '').toLocaleLowerCase('de-DE');

export default function Rechte({ teil }: { teil?: string; weitere?: string[] }) {
  const reiter = teil === 'benutzer' || teil === 'passwort' ? teil : 'rollen';
  return (
    <>
      <Tabs value={reiter} onChange={(_, v) => navigieren(`#/admin/rechte/${v}`, true)} sx={{ mb: 2.5, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="rollen" label="Rollen & Rechte" /><Tab value="benutzer" label="Rechte einzelner Benutzer" /><Tab value="passwort" label="Passwortregeln" />
      </Tabs>
      {reiter === 'rollen' ? <Rollen /> : reiter === 'benutzer' ? <Benutzerrechte /> : (
        <Einstellung bereich="passwort" titel="Sicherheitsrichtlinie (Passwortregeln)" felder={[
          { name: 'minLaenge', typ: 'zahl', label: 'Mindestlänge', min: 8, max: 64 },
          { name: 'grossbuchstaben', typ: 'schalter', label: 'Großbuchstaben erforderlich' }, { name: 'ziffern', typ: 'schalter', label: 'Ziffern erforderlich' },
          { name: 'sonderzeichen', typ: 'schalter', label: 'Sonderzeichen erforderlich' },
          { typ: 'hinweis', text: 'Gilt für selbst gewählte Passwörter (Passwort ändern). Startpasswörter erzeugt EduOrga Web zufällig.' }]} />
      )}
    </>
  );
}

function StufenWahl({ r, wert, onWert, geaendert }: { r: Recht; wert: number; onWert: (v: number) => void; geaendert?: boolean }) {
  const t = useTheme();
  const pillen: [number, string, ReactNode][] = r.zweistufig ? [[0, 'Kein Zugriff', <BlockRounded key="0" />], [1, 'Lesen', <VisibilityOutlined key="1" />], [2, 'Schreiben', <EditRounded key="2" />]]
    : [[0, 'Kein Zugriff', <BlockRounded key="0" />], [2, 'Zugriff', <CheckRounded key="2" />]];
  const farbe = (v: number) => (v === 2 ? t.palette.status.ok.main : v === 1 ? t.palette.primary.main : t.palette.text.secondary);
  return (
    <ToggleButtonGroup exclusive size="small" value={wert} onChange={(_, v) => v !== null && onWert(v)} aria-label={r.name}
      sx={{ outline: geaendert ? `2px solid ${t.palette.primary.main}` : 'none', outlineOffset: 1, borderRadius: 1.5, '& .MuiToggleButton-root': { px: 1, py: 0.25, gap: 0.5, fontSize: 12, '& svg': { fontSize: 15 } },
        '& .Mui-selected': { color: `${farbe(wert)} !important`, bgcolor: `${alpha(farbe(wert), 0.12)} !important` } }}>
      {pillen.map(([v, text, icon]) => <Tooltip key={v} title={text}><ToggleButton value={v}>{icon}<Box component="span" sx={{ display: v === wert ? 'inline' : { xs: 'none', xl: 'inline' } }}>{text}</Box></ToggleButton></Tooltip>)}
    </ToggleButtonGroup>
  );
}

function Rollen() {
  const t = useTheme();
  const schmal = useMediaQuery(t.breakpoints.down('lg'));
  const g = useLaden(sig => holen<Katalog>('/api/app/admin/rechte/katalog', sig), []);
  const [aenderungen, setAenderungen] = useState<Record<string, Record<string, number>>>({});
  const [fenster, setFenster] = useState<Record<string, Partial<Record<'planWochenZurueck' | 'planWochenVor', number | null>>>>({});
  const [suche, setSuche] = useState('');
  const [gruppe, setGruppe] = useState('');
  const [filter, setFilter] = useState('alle');
  const [ansichtWahl, setAnsichtWahl] = useState(() => speicherLesen('untplan:rechte-ansicht', 'matrix'));
  const [rolle, setRolle] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | { art: 'neu'; vorlage?: string } | { art: 'bearbeiten'; p: Profil }>(null);
  const [laeuft, setLaeuft] = useState(false);
  const ansicht = schmal ? 'rolle' : ansichtWahl;
  const neu = () => { setAenderungen({}); setFenster({}); void g.neu(); };
  return (
    <Geladen g={g}>{k => {
      const profile = k.profile;
      const gruppen = gruppenAus(k);
      const istWert = (p: Profil, r: Recht) => aenderungen[p.id]?.[r.id] ?? p.rechte[r.id] ?? r.standard?.[p.basis] ?? 0;
      const gesperrt = (p: Profil, r: Recht) => !!r.nurKollegium && (p.basis === 'schueler' || p.basis === 'eltern');
      const abweichend = (r: Recht) => profile.some(p => p.aenderbar && !gesperrt(p, r) && istWert(p, r) !== (r.standard?.[p.basis] ?? istWert(p, r)));
      const ungespeichert = (r: Recht) => profile.some(p => aenderungen[p.id]?.[r.id] !== undefined);
      const q = norm(suche).trim();
      const passt = (r: Recht) => (!q || q.split(/\s+/).every(x => norm(`${r.name} ${r.beschreibung} ${r.gruppe} ${r.id}`).includes(x))) && (!gruppe || (r.gruppe || 'Weitere Rechte') === gruppe)
        && (filter !== 'abweichend' || abweichend(r)) && (filter !== 'ungespeichert' || ungespeichert(r));
      const fensterPasst = (!gruppe || gruppe === 'Stundenplan-Zeitraum' || gruppe === 'Stundenplan')
        && (filter !== 'abweichend' || profile.some(p => FENSTER.some(([f]) => (p[f] ?? null) !== null)))
        && (filter !== 'ungespeichert' || Object.values(fenster).some(a => Object.keys(a).length))
        && (!q || FENSTER.some(([, tt, b]) => q.split(/\s+/).every(x => norm(`${tt} ${b} stundenplan zeitraum`).includes(x))));
      const anzahl = Object.values(aenderungen).reduce((n, a) => n + Object.keys(a).length, 0) + Object.values(fenster).reduce((n, a) => n + Object.keys(a).length, 0);
      const setzen = (p: Profil, r: Recht, v: number) => setAenderungen(alt => {
        const a = { ...(alt[p.id] ?? {}) };
        if (v === (p.rechte[r.id] ?? r.standard?.[p.basis] ?? 0)) delete a[r.id]; else a[r.id] = v;
        return { ...alt, [p.id]: a };
      });
      const zelle = (p: Profil, r: Recht) => !p.aenderbar ? <Plakette ton="ok"><DoneAllRounded sx={{ fontSize: 14 }} />Vollzugriff</Plakette>
        : gesperrt(p, r) ? <Typography variant="caption" color="text.disabled" title="Nur für Konten des Kollegiums">nicht verfügbar</Typography>
        : <StufenWahl r={r} wert={istWert(p, r)} onWert={v => setzen(p, r, v)} geaendert={aenderungen[p.id]?.[r.id] !== undefined} />;
      const fensterZelle = (p: Profil, f: 'planWochenZurueck' | 'planWochenVor', titel: string) => {
        if (!p.aenderbar) return <Typography variant="caption" color="text.disabled">unbegrenzt</Typography>;
        const geaendert = !!fenster[p.id] && f in fenster[p.id];
        const v = geaendert ? fenster[p.id][f] : p[f];
        return <TextField size="small" type="number" value={v ?? ''} placeholder="unbegrenzt" aria-label={`${titel} – ${p.name}`} sx={{ width: 130, '& fieldset': geaendert ? { borderColor: 'primary.main', borderWidth: 2 } : {} }}
          slotProps={{ htmlInput: { min: 0, max: k.planWochenHoechstens ?? 520 } }}
          onChange={e => { const z = wochenZahl(e.target.value); setFenster(alt => { const a = { ...(alt[p.id] ?? {}) }; if (z === (p[f] ?? null)) delete a[f]; else a[f] = z; return { ...alt, [p.id]: a }; }); }} />;
      };
      const rolleKopf = (p: Profil) => (
        <Stack gap={0.5} sx={{ minWidth: 0 }}>
          <Typography noWrap sx={{ fontWeight: 600, fontSize: 14 }} title={p.name}>{p.name}</Typography>
          <Typography variant="caption" color="text.secondary">{p.system ? 'Systemrolle' : `Eigene Rolle · Basis ${p.basisName}`} · <a href={`#/admin/benutzer/${p.basis}`}>{p.benutzer} {p.benutzer === 1 ? 'Konto' : 'Konten'}</a></Typography>
          <Stack direction="row" gap={0.25}>
            {p.aenderbar && <>
              <Tooltip title="Name, Beschreibung und Stundenplan-Zeitraum"><IconButton size="small" onClick={() => setDialog({ art: 'bearbeiten', p })}><EditOutlined fontSize="small" /></IconButton></Tooltip>
              <Tooltip title="Rolle kopieren"><IconButton size="small" onClick={() => setDialog({ art: 'neu', vorlage: p.id })}><ContentCopyRounded fontSize="small" /></IconButton></Tooltip>
            </>}
            {p.system && p.aenderbar && <Tooltip title="Auf Standard zurücksetzen"><IconButton size="small" onClick={async () => {
              if (!(await bestaetigen('Rolle zurücksetzen', 'Die Rechte dieser Systemrolle auf die Standardwerte zurücksetzen?', 'Zurücksetzen'))) return;
              try { await senden(`/api/app/admin/rechte/profile/${encodeURIComponent(p.id)}/zuruecksetzen`, {}); toast('Zurückgesetzt.'); neu(); } catch (err) { fehler(err); }
            }}><RestartAltRounded fontSize="small" /></IconButton></Tooltip>}
            {!p.system && <Tooltip title="Rolle löschen"><IconButton size="small" color="error" onClick={async () => {
              if (!(await bestaetigen('Rolle löschen', `Die Rolle „${p.name}“ löschen? ${p.benutzer} Konten erhalten wieder das Standardprofil ihrer Basisrolle.`))) return;
              try { await loeschen(`/api/app/admin/rechte/profile/${encodeURIComponent(p.id)}`); toast('Rolle gelöscht.'); neu(); } catch (err) { fehler(err); }
            }}><DeleteOutlineRounded fontSize="small" /></IconButton></Tooltip>}
            {!p.aenderbar && <Typography variant="caption" color="text.secondary">hat immer alle Rechte</Typography>}
          </Stack>
        </Stack>
      );
      const rechtText = (name: string, b: string) => <Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 500, fontSize: 14 }}>{name}</Typography>{b && <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={b}>{b}</Typography>}</Box>;
      const abschnitte: { titel: string; zeilen: { key: string; text: ReactNode; zelle: (p: Profil) => ReactNode }[] }[] = [];
      if (fensterPasst) abschnitte.push({ titel: 'Stundenplan-Zeitraum', zeilen: FENSTER.map(([f, tt, b]) => ({ key: f, text: rechtText(tt, b), zelle: p => fensterZelle(p, f, tt) })) });
      gruppen.forEach(gr => {
        const rs = k.rechte.filter(r => (r.gruppe || 'Weitere Rechte') === gr && passt(r));
        if (rs.length) abschnitte.push({ titel: gr, zeilen: rs.map(r => ({ key: r.id, text: rechtText(r.name, r.beschreibung), zelle: p => zelle(p, r) })) });
      });
      const gewaehlt = profile.find(p => p.id === rolle) ?? profile.find(p => p.aenderbar) ?? profile[0];
      const spalten = `minmax(260px, 1.3fr) repeat(${profile.length}, minmax(170px, 1fr))`;
      return (
        <>
          <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="center" sx={{ mb: 1.5 }}>
            <SuchFeld wert={suche} onWert={setSuche} platzhalter="Recht suchen …" breite={300} />
            <Wahl label="Gruppe" wert={gruppe} onWert={setGruppe} alle="Alle Gruppen" optionen={['Stundenplan-Zeitraum', ...gruppen].map(x => [x, x] as [string, string])} breite={220} />
            <Wahl label="Filter" wert={filter} onWert={setFilter} optionen={[['alle', 'Alle Rechte'], ['abweichend', 'Abweichend vom Standard'], ['ungespeichert', 'Ungespeichert']]} breite={220} />
            <Box sx={{ flex: 1 }} />
            {!schmal && <ToggleButtonGroup exclusive size="small" value={ansichtWahl} onChange={(_, v) => { if (v) { setAnsichtWahl(v); speicherSchreiben('untplan:rechte-ansicht', v); } }}><ToggleButton value="matrix">Matrix</ToggleButton><ToggleButton value="rolle">Rolle für Rolle</ToggleButton></ToggleButtonGroup>}
            <Button variant="contained" onClick={() => setDialog({ art: 'neu' })}>Neue Rolle</Button>
          </Stack>
          <Alert severity="info" sx={{ mb: 2 }}>{k.rechte.length} Rechte in {gruppen.length} Gruppen · Administration hat immer alle Rechte. Eigene Rollen bauen auf einer Basisrolle auf (Kollegium, Schüler*in, Erziehungsberechtigte); Rechte des Kollegiums wirken bei Schüler- und Elternkonten nicht.
            „Rückwirkend bearbeiten“: Abwesenheiten, die länger als {Number(k.rueckwirkendTage) || 0} Tage zurückliegen. Stundenplan-Zeitraum: Wochen vor bzw. nach der aktuellen Woche (leer = unbegrenzt, 0 = nur die aktuelle Woche). Einzelnen Konten lassen sich unter „Rechte einzelner Benutzer“ Rechte zusätzlich geben oder entziehen.</Alert>
          {ansicht === 'matrix' ? (
            <Paper variant="outlined" sx={{ overflow: 'auto', maxHeight: 'max(440px, calc(100dvh - 300px))' }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: spalten, minWidth: 260 + profile.length * 170 }}>
                <Box sx={{ position: 'sticky', top: 0, left: 0, zIndex: 4, bgcolor: 'background.paper', p: 2, borderBottom: 1, borderRight: 1, borderColor: 'divider', display: 'flex', alignItems: 'flex-end' }}><Typography variant="caption" color="text.secondary">Recht</Typography></Box>
                {profile.map(p => <Box key={p.id} sx={{ position: 'sticky', top: 0, zIndex: 3, bgcolor: 'background.paper', p: 1.5, borderBottom: 1, borderColor: 'divider', borderTop: 3, borderTopColor: p.aenderbar ? 'primary.main' : 'text.primary' }}>{rolleKopf(p)}</Box>)}
                {abschnitte.map(a => (
                  <Fragment key={a.titel}>
                    <Box sx={{ gridColumn: '1 / -1', position: 'sticky', left: 0, px: 2, pt: 2, pb: 1, bgcolor: 'background.default', borderTop: 1, borderColor: 'divider' }}><Typography variant="overline" color="text.secondary">{a.titel} · {a.zeilen.length}</Typography></Box>
                    {a.zeilen.map(z => (
                      <Fragment key={z.key}>
                        <Box sx={{ position: 'sticky', left: 0, zIndex: 1, bgcolor: 'background.paper', px: 2, py: 1.25, borderTop: 1, borderRight: 1, borderColor: 'divider' }}>{z.text}</Box>
                        {profile.map(p => <Box key={p.id} sx={{ px: 1.5, py: 1.25, borderTop: 1, borderColor: 'divider', display: 'flex', alignItems: 'center' }}>{z.zelle(p)}</Box>)}
                      </Fragment>
                    ))}
                  </Fragment>
                ))}
                {!abschnitte.length && <Box sx={{ gridColumn: '1 / -1', p: 5, textAlign: 'center', color: 'text.secondary' }}>Kein Recht passt zur Suche bzw. zum Filter.</Box>}
              </Box>
            </Paper>
          ) : (
            <>
              <Stack direction="row" gap={1} sx={{ overflowX: 'auto', pb: 1, mb: 1 }}>
                {profile.map(p => <Button key={p.id} variant={p.id === gewaehlt.id ? 'contained' : 'outlined'} onClick={() => setRolle(p.id)} sx={{ flexShrink: 0 }}>{p.name}</Button>)}
              </Stack>
              <Paper variant="outlined">
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>{rolleKopf(gewaehlt)}</Box>
                {abschnitte.map(a => (
                  <Box key={a.titel}>
                    <Typography variant="overline" color="text.secondary" sx={{ display: 'block', px: 2, pt: 1.5, bgcolor: 'background.default' }}>{a.titel} · {a.zeilen.length}</Typography>
                    {a.zeilen.map(z => <Stack key={z.key} direction={{ xs: 'column', sm: 'row' }} gap={1} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ px: 2, py: 1.25, borderTop: 1, borderColor: 'divider' }}>{z.text}{z.zelle(gewaehlt)}</Stack>)}
                  </Box>
                ))}
                {!abschnitte.length && <Typography sx={{ p: 5, textAlign: 'center' }} color="text.secondary">Kein Recht passt zur Suche bzw. zum Filter.</Typography>}
              </Paper>
            </>
          )}
          {anzahl > 0 && (
            <Paper elevation={8} sx={{ position: 'sticky', bottom: 16, mt: 2, ml: 'auto', width: 'fit-content', maxWidth: '100%', px: 2, py: 1, borderRadius: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: 'text.primary', color: 'background.paper' }} role="status">
              <Typography variant="body2">{anzahl === 1 ? '1 ungespeicherte Änderung' : `${anzahl} ungespeicherte Änderungen`}</Typography>
              <Button size="small" sx={{ color: 'inherit' }} onClick={() => { setAenderungen({}); setFenster({}); }}>Verwerfen</Button>
              <Button size="small" variant="contained" disabled={laeuft} onClick={async () => {
                setLaeuft(true);
                try {
                  for (const id of new Set([...Object.keys(aenderungen), ...Object.keys(fenster)])) {
                    const a = aenderungen[id] ?? {}, f = fenster[id] ?? {};
                    if (!Object.keys(a).length && !Object.keys(f).length) continue;
                    const p = profile.find(x => x.id === id)!;
                    await senden(`/api/app/admin/rechte/profile/${encodeURIComponent(id)}`, { name: p.name, beschreibung: p.beschreibung, rechte: { ...p.rechte, ...a },
                      planWochenZurueck: 'planWochenZurueck' in f ? f.planWochenZurueck : p.planWochenZurueck ?? null, planWochenVor: 'planWochenVor' in f ? f.planWochenVor : p.planWochenVor ?? null }, 'PUT');
                  }
                  toast('Rechte gespeichert.'); neu();
                } catch (err) { fehler(err); } finally { setLaeuft(false); }
              }}>Speichern</Button>
            </Paper>
          )}
          {dialog?.art === 'neu' && <NeueRolle k={k} vorlage={dialog.vorlage} onClose={() => setDialog(null)} fertig={neu} />}
          {dialog?.art === 'bearbeiten' && <RolleBearbeiten k={k} p={dialog.p} aenderungen={aenderungen[dialog.p.id]} fenster={fenster[dialog.p.id]} onClose={() => setDialog(null)} fertig={neu} />}
        </>
      );
    }}</Geladen>
  );
}

function NeueRolle({ k, vorlage, onClose, fertig }: { k: Katalog; vorlage?: string; onClose: () => void; fertig: () => void }) {
  const [name, setName] = useState('');
  const [basis, setBasis] = useState('lehrer');
  const [beschreibung, setBeschreibung] = useState('');
  return (
    <FormDialog offen titel={vorlage ? 'Rolle kopieren' : 'Neue Rolle'} aktionText="Anlegen" onClose={onClose} aktion={async () => {
      if (!name.trim()) { toast('Bitte einen Namen eingeben.', true); return false; }
      if (vorlage) await senden(`/api/app/admin/rechte/profile/${encodeURIComponent(vorlage)}/kopieren`, { name });
      else await senden('/api/app/admin/rechte/profile', { name, basis, beschreibung });
      toast('Rolle angelegt.'); fertig();
    }}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        <TextField label="Name" value={name} onChange={e => setName(e.target.value)} required placeholder="z. B. Referendar*in, Sekretariat, Oberstufenkoordination" slotProps={{ htmlInput: { maxLength: 100 } }} />
        {vorlage ? <Typography variant="body2" color="text.secondary">Kopie von „{k.profile.find(p => p.id === vorlage)?.name}“ mit denselben Rechten und derselben Basisrolle.</Typography> : <>
          <TextField select label="Basisrolle" value={basis} onChange={e => setBasis(e.target.value)} helperText="Die Basisrolle bestimmt die Art des Kontos (Kollegium, Schüler*in, Erziehungsberechtigte) und die Ausgangsrechte.">
            {k.basisrollen.filter(b => b.id !== 'admin').map(b => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
          </TextField>
          <TextField label="Beschreibung" value={beschreibung} onChange={e => setBeschreibung(e.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} />
        </>}
      </Stack>
    </FormDialog>
  );
}

function RolleBearbeiten({ k, p, aenderungen, fenster, onClose, fertig }: { k: Katalog; p: Profil; aenderungen?: Record<string, number>; fenster?: Partial<Record<string, number | null>>; onClose: () => void; fertig: () => void }) {
  const [name, setName] = useState(p.name);
  const [beschreibung, setBeschreibung] = useState(p.beschreibung);
  const [w, setW] = useState({ planWochenZurueck: String((fenster && 'planWochenZurueck' in fenster ? fenster.planWochenZurueck : p.planWochenZurueck) ?? ''), planWochenVor: String((fenster && 'planWochenVor' in fenster ? fenster.planWochenVor : p.planWochenVor) ?? '') });
  return (
    <FormDialog offen titel={`Rolle „${p.name}“`} onClose={onClose} aktion={async () => {
      await senden(`/api/app/admin/rechte/profile/${encodeURIComponent(p.id)}`, { name: p.system ? p.name : name, beschreibung, rechte: { ...p.rechte, ...(aenderungen ?? {}) },
        planWochenZurueck: wochenZahl(w.planWochenZurueck), planWochenVor: wochenZahl(w.planWochenVor) }, 'PUT');
      toast('Gespeichert.'); fertig();
    }}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        {!p.system && <TextField label="Name" value={name} onChange={e => setName(e.target.value)} slotProps={{ htmlInput: { maxLength: 100 } }} />}
        <TextField label="Beschreibung" value={beschreibung} onChange={e => setBeschreibung(e.target.value)} multiline minRows={3} slotProps={{ htmlInput: { maxLength: 500 } }} />
        <Typography variant="h4">Stundenplan-Zeitraum</Typography>
        <Stack direction="row" gap={2}>
          {FENSTER.map(([f, tt]) => <TextField key={f} type="number" label={tt} value={w[f]} placeholder="unbegrenzt" onChange={e => setW({ ...w, [f]: e.target.value })} slotProps={{ htmlInput: { min: 0, max: k.planWochenHoechstens ?? 520 } }} sx={{ width: 160 }} />)}
        </Stack>
        <Typography variant="body2" color="text.secondary">Wochen vor bzw. nach der aktuellen Woche, die Konten dieser Rolle im Stundenplan sehen (Web und Apps). Leer = unbegrenzt, 0 = nur die aktuelle Woche. Aktuell: {fensterText(p.planWochenZurueck)} zurück, {fensterText(p.planWochenVor)} voraus.</Typography>
      </Stack>
    </FormDialog>
  );
}

// ------------------------------------------------------------------ Rechte einzelner Benutzer

interface Konto { id: number; login: string; anzeigename: string; rollenname: string }
interface Vorschau {
  benutzer: { login: string; anzeigename: string; rollenname: string; rolle: string; zusatzrechte: string[] }; anzahl: number; profil: string; ueberschreibungen: Record<string, number>;
  profile: { id: string; name: string; system: boolean }[]; rechte: { recht: string; profil: number; zusatz: number; effektiv: number; quelle: string }[];
}

function Wert({ s, r }: { s: number; r?: Recht }) {
  const text = s === 0 ? 'Nein' : s === 1 ? 'Lesen' : r?.zweistufig ? 'Schreiben' : 'Ja';
  return <Plakette ton={s === 2 ? 'ok' : s === 1 ? 'primaer' : 'neutral'}>{text}</Plakette>;
}

function Benutzerrechte() {
  const g = useLaden(async sig => {
    const [liste, k] = await Promise.all([holen<Konto[]>('/api/app/admin/benutzer', sig), holen<Katalog>('/api/app/admin/rechte/katalog', sig)]);
    return { liste, k };
  }, []);
  const [suche, setSuche] = useState('');
  const [gewaehlt, setGewaehlt] = useState<number | null>(() => Number(new URLSearchParams(location.hash.split('?')[1] ?? '').get('id')) || null);
  return (
    <Geladen g={g}>{({ liste, k }) => (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '320px minmax(0, 1fr)' }, gap: 2.5, alignItems: 'start' }}>
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <SuchFeld wert={suche} onWert={setSuche} platzhalter="Benutzer suchen …" breite="100%" />
          <List dense sx={{ maxHeight: '65vh', overflow: 'auto', mt: 1 }}>
            {liste.filter(u => !suche || `${u.login} ${u.anzeigename} ${u.rollenname}`.toLowerCase().includes(suche.toLowerCase())).slice(0, 300).map(u => (
              <ListItemButton key={u.id} selected={u.id === gewaehlt} onClick={() => setGewaehlt(u.id)} sx={{ borderRadius: 1.5 }}>
                <ListItemText primary={u.anzeigename || u.login} secondary={`${u.login} · ${u.rollenname}`} />
              </ListItemButton>
            ))}
          </List>
        </Paper>
        {gewaehlt ? <BenutzerDetail key={gewaehlt} id={gewaehlt} k={k} /> : <Paper variant="outlined" sx={{ p: 3 }}><Typography color="text.secondary">Bitte links ein Konto wählen.</Typography></Paper>}
      </Box>
    )}</Geladen>
  );
}

function BenutzerDetail({ id, k }: { id: number; k: Katalog }) {
  const g = useLaden(sig => holen<Vorschau>(`/api/app/admin/rechte/benutzer/${id}`, sig), [id]);
  const [v, setV] = useState<Vorschau | null>(null);
  const [profil, setProfil] = useState<string | null>(null);
  const [ueber, setUeber] = useState<Record<string, number> | null>(null);
  const [filter, setFilter] = useState('');
  useEffect(() => { if (g.daten) { setV(g.daten); setProfil(g.daten.profil); setUeber({ ...g.daten.ueberschreibungen }); } }, [g.daten]);
  const katalog = useMemo(() => Object.fromEntries(k.rechte.map(r => [r.id, r])), [k]);
  const vorschau = async (p: string, u: Record<string, number>) => { try { setV(await senden<Vorschau>(`/api/app/admin/rechte/benutzer/${id}/vorschau`, { profil: p, ueberschreibungen: u })); } catch (err) { fehler(err); } };
  if (!v || !profil || !ueber) return <Paper variant="outlined" sx={{ p: 3 }}><Geladen g={g}>{() => null}</Geladen></Paper>;
  const admin = v.benutzer.rolle === 'admin';
  const q = filter.toLowerCase();
  return (
    <Paper variant="outlined">
      <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap" sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography sx={{ fontWeight: 600 }}>{v.benutzer.anzeigename || v.benutzer.login}</Typography><Plakette>{v.benutzer.rollenname}</Plakette><Plakette ton="ok">{v.anzahl} Rechte effektiv</Plakette>
        {v.benutzer.zusatzrechte.length > 0 && <Plakette ton="termin" title="Bisherige Zusatzrechte (wirken weiter)">Zusatzrechte: {v.benutzer.zusatzrechte.join(', ')}</Plakette>}
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" size="small" disabled={admin} onClick={async () => { try { setV(await senden<Vorschau>(`/api/app/admin/rechte/benutzer/${id}`, { profil, ueberschreibungen: ueber }, 'PUT')); toast('Rechte gespeichert.'); } catch (err) { fehler(err); } }}>Speichern</Button>
      </Stack>
      <Stack direction="row" gap={2} flexWrap="wrap" sx={{ p: 2 }}>
        <TextField select label="Rolle (Rechte-Profil)" value={profil} disabled={admin} onChange={e => { setProfil(e.target.value); void vorschau(e.target.value, ueber); }} sx={{ minWidth: 260 }}>
          {v.profile.map(p => <MenuItem key={p.id} value={p.id}>{p.name}{p.system ? ' (Standard)' : ''}</MenuItem>)}
        </TextField>
        <SuchFeld wert={filter} onWert={setFilter} platzhalter="Recht suchen …" />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 1.5 }}>{admin ? 'Die Administration hat immer alle Rechte.' : 'Überschreibung „Wie Rolle“ = Wert der Rolle. Geänderte Werte zeigen die Vorschau sofort; gespeichert wird erst mit „Speichern“.'}</Typography>
      <Divider />
      <Box sx={{ maxHeight: '60vh', overflow: 'auto' }}>
        {gruppenAus(k).map(gr => {
          const rs = v.rechte.filter(x => katalog[x.recht] && (katalog[x.recht].gruppe || 'Weitere Rechte') === gr && (!q || `${katalog[x.recht].name} ${katalog[x.recht].beschreibung}`.toLowerCase().includes(q)));
          if (!rs.length) return null;
          return (
            <Box key={gr}>
              <Typography variant="overline" color="text.secondary" sx={{ display: 'block', px: 2, pt: 1.5, bgcolor: 'background.default' }}>{gr}</Typography>
              {rs.map(x => {
                const r = katalog[x.recht];
                const optionen: [string, string][] = [['', 'Wie Rolle'], ...((r.zweistufig ? [['0', 'Nein'], ['1', 'Lesen'], ['2', 'Schreiben']] : [['0', 'Nein'], ['2', 'Ja']]) as [string, string][])];
                return (
                  <Stack key={x.recht} direction={{ xs: 'column', md: 'row' }} gap={1.5} alignItems={{ md: 'center' }} sx={{ px: 2, py: 1.25, borderTop: 1, borderColor: 'divider' }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}><Typography sx={{ fontWeight: 500, fontSize: 14 }}>{r.name}</Typography><Typography variant="caption" color="text.secondary">{r.beschreibung}</Typography></Box>
                    <Box sx={{ width: 90 }}><Wert s={Math.max(x.profil, x.zusatz)} r={r} /></Box>
                    <ToggleButtonGroup exclusive size="small" disabled={admin} value={ueber[x.recht] === undefined ? '' : String(ueber[x.recht])}
                      onChange={(_, w) => { if (w === null) return; const u = { ...ueber }; if (w === '') delete u[x.recht]; else u[x.recht] = Number(w); setUeber(u); void vorschau(profil, u); }}>
                      {optionen.map(([w, tt]) => <ToggleButton key={w} value={w} sx={{ px: 1, py: 0.25, fontSize: 12 }}>{tt}</ToggleButton>)}
                    </ToggleButtonGroup>
                    <Box sx={{ width: 120 }}><Wert s={x.effektiv} r={r} /><Typography variant="caption" sx={{ display: 'block', color: x.quelle === 'gewährt' ? 'success.main' : x.quelle === 'entzogen' ? 'error.main' : 'text.secondary' }}>{x.quelle}</Typography></Box>
                  </Stack>
                );
              })}
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}
