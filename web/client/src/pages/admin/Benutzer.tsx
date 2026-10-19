// Administration → Benutzer und Personen & Konten:
// - Benutzerliste mit Suche, Filtern (Rolle, Status, Zuordnung, letzte Anmeldung), Kennzahlen, Sortierung, Mehrfachauswahl und Sammelaktionen;
//   Seitenpanel je Konto mit Stammdaten, Rolle und Zusatzrechten, Personenzuordnung, Status, Anmeldehistorie und Konto-Aktionen.
// - Personen (Lehrkräfte, Schüler*innen, Erziehungsberechtigte, sonstiges Personal) mit Konto-Status; fehlende Konten einzeln oder gesammelt
//   nach Login-Schema anlegen, Zugangsdaten als CSV bzw. PDF (Schwarz-Weiß).
import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Checkbox, Drawer, FormControlLabel, IconButton, MenuItem, Stack, Switch, Tab, Tabs, TextField, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import EditOutlined from '@mui/icons-material/EditOutlined';
import KeyRounded from '@mui/icons-material/KeyRounded';
import LockOutlined from '@mui/icons-material/LockOutlined';
import PersonAddAltRounded from '@mui/icons-material/PersonAddAltRounded';
import PrintOutlined from '@mui/icons-material/PrintOutlined';
import { holen, loeschen, senden, speichern } from '../../api/client';
import { useSitzung } from '../../app/sitzung';
import { Geladen } from '../../components/Seite';
import { FormDialog, Kennzahl, NamensAvatar, Plakette, SuchFeld, Wahl, type Ton } from '../../components/Bausteine';
import { Tabelle } from '../../components/Tabelle';
import { heuteIso } from '../../lib/datum';
import { bestaetigen, fehler, toast } from '../../lib/meldungen';
import { pdfAusrichtung } from '../../lib/pdf';
import { navigieren } from '../../lib/router';
import { useLaden } from '../../lib/useLaden';
import { csv } from '../unterricht/Unterricht';
import { kurzZeit, ROLLEN } from './Admin';

const KOLLEGIUM = ['admin', 'leitung', 'lehrer'];
const ARTEN: Record<string, string> = { lehrer: 'Lehrkräfte', schueler: 'Schüler*innen', eltern: 'Erziehungsberechtigte', personal: 'Sonstiges Personal' };
const SCHEMATA: Record<string, string> = { kuerzel: 'Kürzel (z. B. bec)', 'vorname.nachname': 'vorname.nachname', 'v.nachname': 'v.nachname', 'nachname.vorname': 'nachname.vorname', nachname: 'nachname' };
const ERGEBNIS: Record<string, [Ton, string]> = { ok: ['ok', 'erfolgreich'], falsch: ['entfall', 'falsches Passwort'], gesperrt: ['pruefung', 'Konto gesperrt'] };

interface Konto { id: number; login: string; anzeigename: string; rolle: string; rollenname: string; element: string; email: string; gesperrt: boolean; passwortAendern: boolean; letzteAnmeldung?: string | null; erstellt: string; zusatzrechte?: string[]; schuelerIds?: number[]; personId?: number; klassen?: string[] }
interface Person { art: string; schluessel: string; vorname: string; name: string; kurz: string; klasse: string; email: string; funktion: string; kinder: number[]; elternkonten: { id: number; login: string }[]; konto?: { id: number; login: string; gesperrt: boolean; letzteAnmeldung?: string } | null }
interface Zugang { anzahl: number; konten: { name: string; klasse?: string; zuordnung?: string; rollenname: string; rolle?: string; login: string; passwort: string }[]; csv: string }

const zeitAus = (s: string) => new Date(s.replace(' ', 'T'));
function seit(s?: string | null) {
  if (!s) return 'nie';
  const t = Math.floor((Date.now() - zeitAus(s).getTime()) / 864e5);
  if (t <= 0) return `heute, ${zeitAus(s).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
  if (t === 1) return 'gestern';
  if (t < 30) return `vor ${t} Tagen`;
  if (t < 365) return `vor ${Math.round(t / 30)} Mon.`;
  return `vor ${Math.round(t / 365)} J.`;
}
const tageSeit = (s?: string | null) => (s ? (Date.now() - zeitAus(s).getTime()) / 864e5 : Infinity);
const personName = (p: { vorname?: string; name?: string }) => [p.vorname, p.name].filter(Boolean).join(' ');
function geraetKurz(ua: string) {
  if (!ua) return '';
  const b = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : ua.split(/[ /]/)[0];
  const s = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return [b, s].filter(Boolean).join(' · ');
}

/** Zugangsdaten (Startpasswörter nur jetzt sichtbar) mit CSV- und PDF-Export. */
export function ZugangsdatenDialog({ titel, r, onClose }: { titel: string; r: Zugang; onClose: () => void }) {
  if (!r.anzahl) return <FormDialog offen titel={titel} onClose={onClose}><Typography>Es wurden keine Konten angelegt – alle gewählten Personen haben bereits ein Konto.</Typography></FormDialog>;
  return (
    <FormDialog offen titel={titel} breite="md" onClose={onClose} links={<>
      <Button startIcon={<DownloadRounded />} onClick={() => speichern(r.csv, `zugangsdaten-${heuteIso()}.csv`)}>CSV</Button>
      <Button startIcon={<PrintOutlined />} onClick={async () => {
        const ausrichtung = await pdfAusrichtung('hoch', 'zugangsdaten');
        if (!ausrichtung) return;
        try {
          const a = await fetch('/api/app/admin/personen/zugangsdaten.pdf', { method: 'POST', credentials: 'same-origin', headers: { 'X-UntPlanWeb': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ konten: r.konten, titel, ausrichtung }) });
          if (!a.ok) throw new Error((await a.json().catch(() => ({}))).fehler ?? 'PDF konnte nicht erzeugt werden.');
          speichern(await a.blob(), `zugangsdaten-${heuteIso()}.pdf`);
        } catch (err) { fehler(err); }
      }}>PDF (S/W)</Button>
    </>}>
      <Alert severity="warning" sx={{ mb: 2 }}>Die Startpasswörter werden nur jetzt angezeigt. Bitte die Zugangsdaten herunterladen bzw. drucken und sicher verteilen.</Alert>
      <Tabelle zeilen={r.konten} schluessel={k => k.login} dicht
        spalten={[{ id: 'n', kopf: 'Name', zelle: k => k.name }, { id: 'k', kopf: 'Klasse / Kürzel', zelle: k => k.klasse || k.zuordnung }, { id: 'r', kopf: 'Rolle', zelle: k => k.rollenname },
          { id: 'l', kopf: 'Benutzername', zelle: k => <b>{k.login}</b> }, { id: 'p', kopf: 'Startpasswort', zelle: k => <Box component="span" sx={{ fontFamily: 'monospace' }}>{k.passwort}</Box> }]} />
    </FormDialog>
  );
}

// ================================================================== Benutzer

export function Benutzer({ weitere = [] }: { weitere?: string[] }) {
  const { ich, elemente } = useSitzung();
  const [rolleP, idP] = weitere;
  const g = useLaden(async sig => {
    const [liste, grundlagen, personen, el] = await Promise.all([holen<Konto[]>('/api/app/admin/benutzer', sig), holen<{ zusatzrechte: { id: string; name: string; beschreibung: string }[] }>('/api/app/admin/benutzerverwaltung/grundlagen', sig),
      holen<Person[]>('/api/app/admin/personen', sig).catch(() => [] as Person[]), elemente()]);
    return { liste, grundlagen, personen, el };
  }, []);
  const [f, setF] = useState({ suche: '', rolle: rolleP && ROLLEN[rolleP] ? rolleP : '', status: '', zuordnung: '', anmeldung: '' });
  const [auswahl, setAuswahl] = useState<Set<string | number>>(new Set());
  const [panel, setPanel] = useState<{ b: Konto | null } | null>(null);
  const [zugang, setZugang] = useState<{ titel: string; r: Zugang } | null>(null);
  const [sammelRolle, setSammelRolle] = useState('');
  useEffect(() => { if (idP && g.daten) { const b = g.daten.liste.find(x => x.id === Number(idP)); if (b) setPanel({ b }); } }, [idP, g.daten]);

  return (
    <Geladen g={g}>{({ liste, grundlagen, personen, el }) => {
      const schueler = personen.filter(p => p.art === 'schueler');
      const sNach = Object.fromEntries(schueler.map(s => [Number(s.schluessel), s]));
      const lNach = Object.fromEntries(personen.filter(p => p.art === 'lehrer').map(l => [l.kurz.toLowerCase(), l]));
      const pNach = Object.fromEntries(personen.filter(p => p.art === 'eltern' || p.art === 'personal').map(p => [Number(p.schluessel), p]));
      const zuordnung = (b: Konto): { text: string; unter: string } | null => {
        if (KOLLEGIUM.includes(b.rolle) && b.element) { const l = lNach[b.element.toLowerCase()]; return { text: b.element, unter: l ? personName(l) : 'nicht in den Stammdaten' }; }
        if (b.rolle === 'schueler' && b.schuelerIds?.length) { const s = sNach[b.schuelerIds[0]]; return { text: s ? personName(s) : `#${b.schuelerIds[0]}`, unter: s ? `Klasse ${s.klasse}` : 'nicht mehr in der Schülerliste' }; }
        if (b.rolle === 'eltern' && b.schuelerIds?.length) return { text: b.schuelerIds.map(i => (sNach[i] ? personName(sNach[i]) : `#${i}`)).join(', '), unter: `${b.schuelerIds.length === 1 ? 'Kind' : 'Kinder'}${b.klassen?.length ? ' · ' + b.klassen.join(', ') : ''}` };
        if (b.personId && pNach[b.personId]) { const p = pNach[b.personId]; return { text: personName(p), unter: p.funktion || ARTEN[p.art] }; }
        if (b.rolle === 'schueler' && b.element) return { text: `Klasse ${b.element}`, unter: 'Klassenkonto' };
        return null;
      };
      const q = f.suche.trim().toLowerCase();
      const sichtbar = liste.filter(b => {
        const z = zuordnung(b);
        const t = tageSeit(b.letzteAnmeldung);
        return (!f.rolle || b.rolle === f.rolle) && (f.status !== 'aktiv' || !b.gesperrt) && (f.status !== 'gesperrt' || b.gesperrt) && (f.status !== 'start' || b.passwortAendern)
          && (f.zuordnung !== 'ohne' || (!z && b.rolle !== 'admin')) && (f.zuordnung !== 'mit' || !!z)
          && (f.anmeldung !== '7' || t <= 7) && (f.anmeldung !== '30' || t <= 30) && (f.anmeldung !== 'alt' || (t > 90 && t !== Infinity)) && (f.anmeldung !== 'nie' || !b.letzteAnmeldung)
          && (!q || `${b.login} ${b.anzeigename} ${b.element} ${b.email} ${z?.text ?? ''} ${z?.unter ?? ''}`.toLowerCase().includes(q));
      });
      const sammel = async (aktion: string, rolle?: string) => {
        const ids = [...auswahl] as number[];
        if (aktion !== 'inaktive_sperren' && !ids.length) { toast('Bitte zuerst Benutzer auswählen.', true); return; }
        const texte: Record<string, [string, string]> = {
          loeschen: [`${ids.length} Benutzer löschen?`, 'Löschen'], inaktive_sperren: ['Alle Konten sperren, deren Lehrer- bzw. Klassenkürzel oder Person nicht mehr in den Stammdaten steht?', 'Sperren'],
          passwort_zuruecksetzen: [`Für ${ids.length} Benutzer ein neues Startpasswort erzeugen? Die bisherigen Passwörter werden ungültig.`, 'Zurücksetzen'],
          rolle: [`${ids.length} Benutzer erhalten die Rolle „${ROLLEN[rolle ?? '']}“. Fortfahren?`, 'Rolle setzen'],
        };
        if (texte[aktion] && !(await bestaetigen('Sammelaktion', texte[aktion][0], texte[aktion][1]))) return;
        try {
          const r = await senden<{ anzahl: number; konten?: Zugang }>('/api/app/admin/benutzer/sammelaktion', { aktion, ids, rolle });
          toast(`${r.anzahl} Benutzer geändert.`);
          if (r.konten) setZugang({ titel: 'Neue Startpasswörter', r: r.konten });
          setAuswahl(new Set()); void g.neu();
        } catch (err) { fehler(err); }
      };
      const anzahl = (r: string) => liste.filter(b => b.rolle === r).length;
      return (
        <>
          <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="center" sx={{ mb: 2 }}>
            <SuchFeld wert={f.suche} onWert={s => setF({ ...f, suche: s })} platzhalter="Benutzername, Name, Kürzel oder E-Mail" breite={300} />
            <Wahl label="Rolle" wert={f.rolle} onWert={v => setF({ ...f, rolle: v })} alle="Alle Rollen" optionen={Object.entries(ROLLEN)} breite={200} />
            <Wahl label="Status" wert={f.status} onWert={v => setF({ ...f, status: v })} alle="Jeder Status" optionen={[['aktiv', 'Aktiv'], ['gesperrt', 'Gesperrt'], ['start', 'Startpasswort offen']]} breite={180} />
            <Wahl label="Zuordnung" wert={f.zuordnung} onWert={v => setF({ ...f, zuordnung: v })} alle="Jede Zuordnung" optionen={[['ohne', 'Ohne Zuordnung'], ['mit', 'Mit Zuordnung']]} breite={180} />
            <Wahl label="Letzte Anmeldung" wert={f.anmeldung} onWert={v => setF({ ...f, anmeldung: v })} alle="Jede Anmeldung" optionen={[['7', 'In den letzten 7 Tagen'], ['30', 'In den letzten 30 Tagen'], ['alt', 'Vor mehr als 90 Tagen'], ['nie', 'Noch nie angemeldet']]} breite={210} />
            <Box sx={{ flex: 1 }} />
            <Button variant="outlined" startIcon={<DownloadRounded />} onClick={() => speichern(csv([['Benutzername', 'Name', 'Rolle', 'Zuordnung', 'Kürzel', 'E-Mail', 'Zusatzrechte', 'gesperrt', 'Startpasswort offen', 'Letzte Anmeldung'],
              ...sichtbar.map(b => [b.login, b.anzeigename, b.rollenname, zuordnung(b)?.text ?? '', b.element, b.email, (b.zusatzrechte ?? []).join(', '), b.gesperrt ? 'ja' : 'nein', b.passwortAendern ? 'ja' : 'nein', b.letzteAnmeldung ?? ''])]), `benutzer-${heuteIso()}.csv`)}>Bericht</Button>
            <Button variant="outlined" href="#/admin/personen">Personen & Konten</Button>
            <Button variant="contained" startIcon={<AddRounded />} onClick={() => setPanel({ b: null })}>Benutzer anlegen</Button>
          </Stack>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(124px, 1fr))', gap: 1.25, mb: 2 }}>
            <Kennzahl wert={liste.length} text="alle" ton="neutral" onClick={() => setF({ ...f, rolle: '', status: '', zuordnung: '' })} />
            {Object.entries(ROLLEN).map(([r, n]) => anzahl(r) ? <Kennzahl key={r} wert={anzahl(r)} text={n} ton={f.rolle === r ? 'primaer' : 'neutral'} onClick={() => setF({ ...f, rolle: r, status: '', zuordnung: '' })} /> : null)}
            <Kennzahl wert={liste.filter(b => b.gesperrt).length} text="gesperrt" ton="entfall" onClick={() => setF({ ...f, status: f.status === 'gesperrt' ? '' : 'gesperrt' })} />
            <Kennzahl wert={liste.filter(b => !zuordnung(b) && b.rolle !== 'admin').length} text="ohne Zuordnung" ton="pruefung" onClick={() => setF({ ...f, zuordnung: f.zuordnung === 'ohne' ? '' : 'ohne' })} />
          </Box>
          <Tabelle zeilen={sichtbar} schluessel={b => b.id} auswahl={auswahl} setAuswahl={setAuswahl} onZeile={b => setPanel({ b })} sortierung={{ id: 'name', richtung: 'asc' }} max={300}
            zeilenSx={b => (b.gesperrt ? { opacity: 0.65 } : {})} leer="Keine Benutzer gefunden."
            spalten={[
              { id: 'name', kopf: 'Benutzer', sortWert: b => (b.anzeigename || b.login).toLowerCase(), zelle: b => <Stack direction="row" gap={1.25} alignItems="center"><NamensAvatar name={b.anzeigename || b.login} id={b.id} groesse={32} />
                <Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 500 }} noWrap>{b.anzeigename || b.login}</Typography><Typography variant="caption" color="text.secondary" noWrap>{b.login}{b.email ? ` · ${b.email}` : ''}</Typography></Box></Stack> },
              { id: 'rolle', kopf: 'Rolle', sortWert: b => Object.keys(ROLLEN).indexOf(b.rolle), zelle: b => <Stack direction="row" gap={0.5} flexWrap="wrap"><Plakette>{b.rollenname}</Plakette>{(b.zusatzrechte ?? []).map(r => <Plakette key={r} ton="termin" title="Zusatzrecht">+ {grundlagen.zusatzrechte.find(x => x.id === r)?.name ?? r}</Plakette>)}</Stack> },
              { id: 'zuordnung', kopf: 'Zuordnung', sortWert: b => zuordnung(b)?.text?.toLowerCase() ?? '~', zelle: b => { const z = zuordnung(b); return z ? <Box><Typography variant="body2">{z.text}</Typography><Typography variant="caption" color="text.secondary">{z.unter}</Typography></Box> : b.rolle === 'admin' ? '–' : <Plakette ton="pruefung">ohne Zuordnung</Plakette>; }, verbergenMobil: true },
              { id: 'status', kopf: 'Status', sortWert: b => (b.gesperrt ? 2 : b.passwortAendern ? 1 : 0), zelle: b => <Stack direction="row" gap={0.5}>{b.gesperrt ? <Plakette ton="entfall"><LockOutlined sx={{ fontSize: 13 }} />gesperrt</Plakette> : <Plakette ton="ok">aktiv</Plakette>}{b.passwortAendern && <Plakette ton="pruefung" title="Das Startpasswort muss bei der nächsten Anmeldung geändert werden">Startpasswort</Plakette>}</Stack> },
              { id: 'anmeldung', kopf: 'Letzte Anmeldung', nowrap: true, sortWert: b => b.letzteAnmeldung ?? '', zelle: b => <span title={kurzZeit(b.letzteAnmeldung)}>{seit(b.letzteAnmeldung)}</span>, verbergenMobil: true },
            ]} />
          <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center" sx={{ mt: 1.5 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>{sichtbar.length} von {liste.length} Benutzern{auswahl.size ? ` · ${auswahl.size} ausgewählt` : ''}</Typography>
            <Button size="small" disabled={!auswahl.size} onClick={() => sammel('sperren')}>Sperren</Button>
            <Button size="small" disabled={!auswahl.size} onClick={() => sammel('entsperren')}>Entsperren</Button>
            <Button size="small" disabled={!auswahl.size} onClick={() => sammel('passwort_zuruecksetzen')}>Passwort zurücksetzen</Button>
            <Button size="small" disabled={!auswahl.size} onClick={() => sammel('passwort_aendern')}>Passwortänderung erzwingen</Button>
            <TextField select size="small" label="Rolle setzen …" value={sammelRolle} disabled={!auswahl.size} onChange={e => { setSammelRolle(''); if (e.target.value) void sammel('rolle', e.target.value); }} sx={{ width: 180 }}>
              {Object.entries(ROLLEN).map(([r, n]) => <MenuItem key={r} value={r}>{n}</MenuItem>)}
            </TextField>
            <Button size="small" disabled={!auswahl.size} title="E-Mail-Adresse der Lehrkraft aus den Stammdaten übernehmen" onClick={() => sammel('email_uebernehmen')}>E-Mail übernehmen</Button>
            <Button size="small" color="error" disabled={!auswahl.size} onClick={() => sammel('loeschen')}>Löschen</Button>
            <Box sx={{ flex: 1 }} />
            <Button size="small" title="Konten sperren, deren Kürzel bzw. Person nicht mehr in den Stammdaten steht" onClick={() => sammel('inaktive_sperren')}>Inaktive Personen sperren</Button>
          </Stack>
          {panel && <KontoPanel b={panel.b} personen={personen} klassen={el.klassen.map(k => ({ kurz: k.kurz, name: k.name }))} zusatzrechte={grundlagen.zusatzrechte} ichId={ich.id}
            onClose={() => { setPanel(null); if (idP) navigieren('#/admin/benutzer', true); }} fertig={() => void g.neu()} zugang={(titel, r) => setZugang({ titel, r })} />}
          {zugang && <ZugangsdatenDialog titel={zugang.titel} r={zugang.r} onClose={() => setZugang(null)} />}
        </>
      );
    }}</Geladen>
  );
}

function KontoPanel({ b, personen, klassen, zusatzrechte, ichId, onClose, fertig, zugang }: {
  b: Konto | null; personen: Person[]; klassen: { kurz: string; name: string }[]; zusatzrechte: { id: string; name: string; beschreibung: string }[]; ichId: number;
  onClose: () => void; fertig: () => void; zugang: (titel: string, r: Zugang) => void;
}) {
  const t = useTheme();
  const mobil = useMediaQuery(t.breakpoints.down('sm'));
  const d = useLaden(sig => (b ? holen<{ benutzer: Konto; anmeldungen: { zeit: string; ergebnis: string; adresse: string; geraet: string }[] }>(`/api/app/admin/benutzer/${b.id}`, sig) : Promise.resolve(null)), [b?.id]);
  const k = d.daten?.benutzer ?? b ?? ({ rolle: 'lehrer', zusatzrechte: [], schuelerIds: [] } as unknown as Konto);
  const [w, setW] = useState<{ login: string; anzeigename: string; email: string; passwort: string; rolle: string; lehrer: string; klasse: string; schueler: number | null; kinder: number[]; personId: number; zusatzrechte: string[]; gesperrt: boolean } | null>(null);
  useEffect(() => {
    if (b && !d.daten) return;
    setW({ login: k.login ?? '', anzeigename: k.anzeigename ?? '', email: k.email ?? '', passwort: '', rolle: k.rolle, lehrer: KOLLEGIUM.includes(k.rolle) ? k.element ?? '' : '',
      klasse: k.rolle === 'schueler' && !(k.schuelerIds ?? []).length ? k.element ?? '' : '', schueler: k.rolle === 'schueler' ? (k.schuelerIds ?? [])[0] ?? null : null,
      kinder: k.rolle === 'eltern' ? k.schuelerIds ?? [] : [], personId: k.personId ?? 0, zusatzrechte: k.zusatzrechte ?? [], gesperrt: !!k.gesperrt });
  }, [d.daten]); // eslint-disable-line react-hooks/exhaustive-deps
  const schueler = personen.filter(p => p.art === 'schueler');
  const lehrer = personen.filter(p => p.art === 'lehrer');
  const andere = personen.filter(p => p.art === 'eltern' || p.art === 'personal');
  const optSchueler = useMemo(() => schueler.map(s => ({ id: Number(s.schluessel), text: `${s.name}, ${s.vorname}`, klasse: s.klasse, fremd: !!s.konto && s.konto.id !== k.id ? s.konto.login : '' })), [schueler, k.id]);
  const speichernKonto = async () => {
    if (!w) return;
    const r = w.rolle;
    const daten = {
      login: w.login, anzeigename: w.anzeigename, email: w.email, passwort: w.passwort, rolle: r,
      element: KOLLEGIUM.includes(r) ? w.lehrer : r === 'schueler' ? w.klasse : '',
      schuelerIds: r === 'schueler' ? (w.schueler ? [w.schueler] : []) : r === 'eltern' ? w.kinder : [],
      personId: KOLLEGIUM.includes(r) || r === 'eltern' ? w.personId : 0, zusatzrechte: KOLLEGIUM.includes(r) && r !== 'admin' ? w.zusatzrechte : [], gesperrt: w.gesperrt,
    };
    try {
      if (b) { await senden(`/api/app/admin/benutzer/${b.id}`, daten, 'PUT'); toast('Gespeichert.'); }
      else {
        if (!w.login.trim()) { toast('Bitte einen Benutzernamen eingeben.', true); return; }
        const x = await senden<{ benutzer: Konto; passwort?: string }>('/api/app/admin/benutzer', daten);
        toast('Benutzer angelegt.');
        if (x.passwort) zugang('Startpasswort', { anzahl: 1, konten: [{ login: x.benutzer.login, passwort: x.passwort, rollenname: x.benutzer.rollenname, rolle: x.benutzer.rolle, name: x.benutzer.anzeigename, zuordnung: x.benutzer.element, klasse: (x.benutzer.klassen ?? []).join(', ') }], csv: `Benutzername;Startpasswort\r\n${x.benutzer.login};${x.passwort}\r\n` });
      }
      onClose(); fertig();
    } catch (err) { fehler(err); }
  };
  const aktion = async (art: string) => {
    try {
      if (art === 'passwort') {
        if (!(await bestaetigen('Passwort zurücksetzen', `Für ${k.login} ein neues Startpasswort erzeugen?`, 'Zurücksetzen'))) return;
        const r = await senden<{ passwort: string }>(`/api/app/admin/benutzer/${k.id}/passwort`, {});
        zugang('Neues Startpasswort', { anzahl: 1, konten: [{ login: k.login, passwort: r.passwort, rollenname: k.rollenname, rolle: k.rolle, name: k.anzeigename, zuordnung: k.element, klasse: (k.klassen ?? []).join(', ') }], csv: `Benutzername;Startpasswort\r\n${k.login};${r.passwort}\r\n` });
      } else if (art === 'erzwingen') {
        await senden('/api/app/admin/benutzer/sammelaktion', { aktion: 'passwort_aendern', ids: [k.id] }); toast('Das Passwort muss bei der nächsten Anmeldung geändert werden.');
      } else {
        if (!(await bestaetigen('Benutzer löschen', `${k.login} wirklich löschen?`))) return;
        await loeschen(`/api/app/admin/benutzer/${k.id}`); toast('Benutzer gelöscht.');
      }
      onClose(); fertig();
    } catch (err) { fehler(err); }
  };
  const abschnitt = (titel: string, kinder: React.ReactNode) => <Box sx={{ py: 2, borderTop: 1, borderColor: 'divider' }}><Typography variant="overline" color="text.secondary">{titel}</Typography><Stack gap={1.5} sx={{ mt: 1 }}>{kinder}</Stack></Box>;
  const personWahl = (art: string, label: string) => (
    <TextField select label={label} value={w?.personId ?? 0} onChange={e => setW(x => x && { ...x, personId: Number(e.target.value) })}>
      <MenuItem value={0}>Keine Person zugeordnet</MenuItem>
      {andere.filter(p => p.art === art).map(p => { const fremd = !!p.konto && p.konto.id !== k.id; return <MenuItem key={p.schluessel} value={Number(p.schluessel)} disabled={fremd}>{personName(p)}<Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>{p.funktion || ARTEN[p.art]}{fremd ? ` · Konto: ${p.konto!.login}` : ''}</Typography></MenuItem>; })}
    </TextField>
  );
  return (
    <Drawer anchor="right" open onClose={onClose} slotProps={{ paper: { sx: { width: mobil ? '100%' : 520, display: 'flex' } } }}>
      <Stack direction="row" gap={1.5} alignItems="center" sx={{ p: 2.5, borderBottom: 1, borderColor: 'divider' }}>
        {b ? <NamensAvatar name={k.anzeigename || k.login} id={k.id} groesse={44} /> : <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: 'action.selected', display: 'grid', placeItems: 'center' }}><PersonAddAltRounded /></Box>}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h3" noWrap>{b ? k.anzeigename || k.login : 'Benutzer anlegen'}</Typography>
          <Typography variant="body2" color="text.secondary">{b ? `${k.login} · ${k.rollenname}` : 'Neues Konto mit Rolle und Personenzuordnung'}</Typography>
          {b && <Stack direction="row" gap={0.5} sx={{ mt: 0.5 }}>{k.gesperrt ? <Plakette ton="entfall">gesperrt</Plakette> : <Plakette ton="ok">aktiv</Plakette>}{k.passwortAendern && <Plakette ton="pruefung">Startpasswort offen</Plakette>}</Stack>}
        </Box>
        <IconButton onClick={onClose} aria-label="Schließen"><CloseRounded /></IconButton>
      </Stack>
      <Box sx={{ flex: 1, overflow: 'auto', px: 2.5 }}>
        {!w ? <Geladen g={d}>{() => null}</Geladen> : <>
          {abschnitt('Stammdaten', <>
            <Stack direction="row" gap={1.5}>
              <TextField label="Benutzername" value={w.login} onChange={e => setW({ ...w, login: e.target.value })} disabled={!!b} required sx={{ flex: 1 }} autoComplete="off" />
              <TextField label="Anzeigename" value={w.anzeigename} onChange={e => setW({ ...w, anzeigename: e.target.value })} sx={{ flex: 1 }} autoComplete="off" />
            </Stack>
            <TextField label="E-Mail (optional)" type="email" value={w.email} onChange={e => setW({ ...w, email: e.target.value })} />
            {!b && <TextField label="Passwort" type="password" value={w.passwort} onChange={e => setW({ ...w, passwort: e.target.value })} autoComplete="new-password" helperText="Leer lassen, um ein Startpasswort zu erzeugen (muss bei der ersten Anmeldung geändert werden)." />}
          </>)}
          {abschnitt('Rolle & Rechte', <>
            <TextField select label="Rolle" value={w.rolle} onChange={e => setW({ ...w, rolle: e.target.value })} disabled={!!b && k.id === ichId} helperText={b && k.id === ichId ? 'Die eigene Rolle kann nicht geändert werden.' : undefined}>
              {Object.entries(ROLLEN).map(([r, n]) => <MenuItem key={r} value={r}>{n}</MenuItem>)}
            </TextField>
            {KOLLEGIUM.includes(w.rolle) && w.rolle !== 'admin' && zusatzrechte.length > 0 && <Box>
              <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>Zusatzrechte</Typography>
              {zusatzrechte.map(r => <FormControlLabel key={r.id} sx={{ alignItems: 'flex-start', display: 'flex', mb: 0.5 }} control={<Checkbox checked={w.zusatzrechte.includes(r.id)} onChange={e => setW({ ...w, zusatzrechte: e.target.checked ? [...w.zusatzrechte, r.id] : w.zusatzrechte.filter(x => x !== r.id) })} />}
                label={<Box sx={{ pt: 1 }}><Typography variant="body2" sx={{ fontWeight: 500 }}>{r.name}</Typography><Typography variant="caption" color="text.secondary">{r.beschreibung}</Typography></Box>} />)}
            </Box>}
          </>)}
          {abschnitt('Personenzuordnung', KOLLEGIUM.includes(w.rolle) ? <>
            <Autocomplete options={lehrer} value={lehrer.find(l => l.kurz.toLowerCase() === w.lehrer.toLowerCase()) ?? null} onChange={(_, v) => setW({ ...w, lehrer: v?.kurz ?? '' })}
              getOptionLabel={l => `${l.kurz} · ${personName(l)}`} getOptionDisabled={l => !!l.konto && l.konto.id !== k.id}
              renderOption={(p, l) => { const { key, ...rest } = p as typeof p & { key: string }; return <li key={key} {...rest}><b style={{ minWidth: 56 }}>{l.kurz}</b>&nbsp;{personName(l)}{l.konto && l.konto.id !== k.id && <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>Konto: {l.konto.login}</Typography>}</li>; }}
              renderInput={p => <TextField {...p} label="Lehrkraft (Kürzel aus den Stammdaten)" helperText={w.rolle === 'admin' ? 'Optional.' : 'Ein Kürzel gehört genau zu einem Konto des Kollegiums (eigener Plan, Klassenbuch, Meldungen).'} />} />
            {w.rolle !== 'admin' && personWahl('personal', 'Person (sonstiges Personal)')}
          </> : w.rolle === 'schueler' ? <>
            <Autocomplete options={optSchueler} value={optSchueler.find(s => s.id === w.schueler) ?? null} onChange={(_, v) => setW({ ...w, schueler: v?.id ?? null })} groupBy={s => `Klasse ${s.klasse}`}
              getOptionLabel={s => s.text} getOptionDisabled={s => !!s.fremd} renderInput={p => <TextField {...p} label="Schüler*in" helperText="Leer = Klassenkonto. Ein Schülerkonto gehört zu genau einer Person." />} />
            <TextField select label="Klasse (nur für Klassenkonten ohne Schülerzuordnung)" value={w.klasse} onChange={e => setW({ ...w, klasse: e.target.value })} disabled={!!w.schueler}>
              <MenuItem value="">–</MenuItem>{klassen.map(x => <MenuItem key={x.kurz} value={x.kurz}>{x.kurz}</MenuItem>)}
            </TextField>
          </> : w.rolle === 'eltern' ? <>
            <Autocomplete multiple options={optSchueler} value={optSchueler.filter(s => w.kinder.includes(s.id))} onChange={(_, v) => setW({ ...w, kinder: v.map(s => s.id) })} groupBy={s => `Klasse ${s.klasse}`}
              getOptionLabel={s => s.text} disableCloseOnSelect renderInput={p => <TextField {...p} label="Kinder" helperText="Konten von Erziehungsberechtigten können mehreren Kindern zugeordnet sein." />} />
            {personWahl('eltern', 'Person (Erziehungsberechtigte*r)')}
          </> : <Typography variant="body2" color="text.secondary">Konten der Administration benötigen keine Personenzuordnung.</Typography>)}
          {b && abschnitt('Status', <>
            <FormControlLabel control={<Switch checked={w.gesperrt} onChange={e => setW({ ...w, gesperrt: e.target.checked })} disabled={k.id === ichId} />} label="Konto gesperrt (keine Anmeldung möglich)" />
            <Typography variant="body2" color="text.secondary">Erstellt: {kurzZeit(k.erstellt) || k.erstellt || '–'} · Letzte Anmeldung: {k.letzteAnmeldung ? kurzZeit(k.letzteAnmeldung) : 'nie'}<br />Passwort: {k.passwortAendern ? 'Startpasswort – muss bei der nächsten Anmeldung geändert werden' : 'selbst gewählt'}</Typography>
          </>)}
          {b && abschnitt('Anmeldehistorie', d.daten?.anmeldungen.length ? d.daten.anmeldungen.map((a, i) => (
            <Stack key={i} direction="row" gap={1} alignItems="center" flexWrap="wrap">
              <Typography variant="body2" sx={{ width: 120 }}>{kurzZeit(a.zeit)}</Typography><Plakette ton={(ERGEBNIS[a.ergebnis] ?? ['neutral'])[0]}>{(ERGEBNIS[a.ergebnis] ?? ['', a.ergebnis])[1]}</Plakette>
              <Typography variant="caption" color="text.secondary">{a.adresse}</Typography><Typography variant="caption" color="text.secondary" title={a.geraet}>{geraetKurz(a.geraet)}</Typography>
            </Stack>
          )) : <Typography variant="body2" color="text.secondary">Noch keine Anmeldungen aufgezeichnet.</Typography>)}
          {b && abschnitt('Konto-Aktionen', <Stack direction="row" gap={1} flexWrap="wrap">
            <Button variant="outlined" startIcon={<KeyRounded />} onClick={() => aktion('passwort')}>Passwort zurücksetzen</Button>
            <Button variant="outlined" disabled={k.passwortAendern} onClick={() => aktion('erzwingen')}>Passwortänderung erzwingen</Button>
            {k.id !== ichId && <Button variant="outlined" color="error" startIcon={<DeleteOutlineRounded />} onClick={() => aktion('loeschen')}>Konto löschen</Button>}
          </Stack>)}
        </>}
      </Box>
      <Stack direction="row" gap={1} justifyContent="flex-end" sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button variant="outlined" onClick={onClose}>Abbrechen</Button><Button variant="contained" disabled={!w} onClick={speichernKonto}>{b ? 'Speichern' : 'Anlegen'}</Button>
      </Stack>
    </Drawer>
  );
}

// ================================================================== Personen & Konten

function loginBeispiel(schema: string, p: Person) {
  const n = (s: string) => String(s ?? '').trim().toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s-]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '');
  const v = n(p.vorname), na = n(p.name), k = n(p.kurz);
  const l = schema === 'kuerzel' && k ? k : schema === 'v.nachname' && v ? `${v[0]}.${na}` : schema === 'nachname.vorname' && v ? `${na}.${v}` : schema === 'nachname' ? na : v ? `${v}.${na}` : na;
  return l || '–';
}

export function Personen({ weitere = [] }: { weitere?: string[] }) {
  const art = ARTEN[weitere[0]] ? weitere[0] : 'lehrer';
  const g = useLaden(sig => holen<Person[]>('/api/app/admin/personen', sig), []);
  const [f, setF] = useState({ suche: '', klasse: '', konto: '' });
  const [auswahl, setAuswahl] = useState<Set<string | number>>(new Set());
  const [konten, setKonten] = useState<{ auswahl: string[] | null } | null>(null);
  const [person, setPerson] = useState<{ p: Person | null } | null>(null);
  const [zugang, setZugang] = useState<{ titel: string; r: Zugang } | null>(null);
  useEffect(() => { setAuswahl(new Set()); }, [art]);
  return (
    <Geladen g={g}>{alle => {
      const liste = alle.filter(p => p.art === art);
      const schueler = alle.filter(p => p.art === 'schueler');
      const sNach = Object.fromEntries(schueler.map(s => [Number(s.schluessel), s]));
      const ohne = liste.filter(p => !p.konto).length;
      const verwaltet = art === 'eltern' || art === 'personal';
      const q = f.suche.trim().toLowerCase();
      const sichtbar = liste.filter(p => (!f.klasse || p.klasse === f.klasse) && (!f.konto || (f.konto === 'fehlt') === !p.konto) && (!q || `${p.vorname} ${p.name} ${p.kurz} ${p.klasse} ${p.email} ${p.funktion} ${p.konto?.login ?? ''}`.toLowerCase().includes(q)));
      return (
        <>
          <Tabs value={art} onChange={(_, v) => navigieren(`#/admin/personen/${v}`, true)} variant="scrollable" sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
            {Object.entries(ARTEN).map(([a, tt]) => <Tab key={a} value={a} label={`${tt} (${alle.filter(p => p.art === a).length})`} />)}
          </Tabs>
          <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="center" sx={{ mb: 2 }}>
            <SuchFeld wert={f.suche} onWert={s => setF({ ...f, suche: s })} platzhalter={`Name${art === 'lehrer' ? ', Kürzel' : ''} oder Benutzername`} breite={280} />
            {art === 'schueler' && <Wahl label="Klasse" wert={f.klasse} onWert={v => setF({ ...f, klasse: v })} alle="Alle Klassen" optionen={[...new Set(schueler.map(s => s.klasse))].map(k => [k, k] as [string, string])} breite={150} />}
            <Wahl label="Konto" wert={f.konto} onWert={v => setF({ ...f, konto: v })} alle="Mit und ohne Konto" optionen={[['fehlt', 'Ohne Konto'], ['vorhanden', 'Mit Konto']]} breite={190} />
            <Box sx={{ flex: 1 }} />
            <Button variant="outlined" href="#/admin/benutzer">Benutzer</Button>
            {verwaltet && <Button variant="outlined" startIcon={<AddRounded />} onClick={() => setPerson({ p: null })}>{art === 'eltern' ? 'Erziehungsberechtigte*n' : 'Person'} erfassen</Button>}
            <Button variant="contained" startIcon={<PersonAddAltRounded />} disabled={!ohne} onClick={() => setKonten({ auswahl: null })}>Konten anlegen …</Button>
          </Stack>
          {verwaltet && <Alert severity="info" sx={{ mb: 2 }}>{art === 'eltern' ? 'Erziehungsberechtigte werden in EduOrga Web erfasst und mit ihren Kindern verknüpft; das Elternkonto erhält die Kinder automatisch.' : 'Sonstiges Personal (z. B. Sekretariat, Hausmeister, Schulsozialarbeit) wird in EduOrga Web erfasst. Konten erhalten standardmäßig die Rolle Lehrkraft ohne Kürzel (Pläne und Vertretungsplan des Kollegiums).'}</Alert>}
          <Stack direction="row" gap={1} sx={{ mb: 2 }} flexWrap="wrap">
            <Plakette>{liste.length} {ARTEN[art]}</Plakette><Plakette ton="ok">{liste.length - ohne} mit Konto</Plakette><Plakette ton="pruefung">{ohne} ohne Konto</Plakette>
          </Stack>
          <Tabelle zeilen={sichtbar} schluessel={p => p.schluessel} auswahl={auswahl} setAuswahl={s => setAuswahl(new Set([...s].filter(x => !liste.find(p => p.schluessel === x)?.konto)))} max={400}
            leer={liste.length ? 'Keine Personen gefunden.' : art === 'eltern' ? 'Noch keine Erziehungsberechtigten erfasst.' : art === 'personal' ? 'Noch kein sonstiges Personal erfasst.' : 'Keine Personen – bitte zuerst Daten aus EduOrga Studio übertragen.'}
            spalten={[
              { id: 'name', kopf: 'Name', sortWert: p => `${p.name} ${p.vorname}`, zelle: p => <Stack direction="row" gap={1.25} alignItems="center"><NamensAvatar name={personName(p) || p.kurz} groesse={30} /><Typography sx={{ fontWeight: 500 }}>{art === 'schueler' ? `${p.name}, ${p.vorname}` : personName(p) || p.kurz}</Typography></Stack> },
              { id: 'z', kopf: art === 'schueler' ? 'Klasse' : art === 'lehrer' ? 'Kürzel' : art === 'eltern' ? 'Kinder' : 'Funktion', sortWert: p => p.klasse || p.kurz || p.funktion,
                zelle: p => art === 'schueler' ? <Plakette>{p.klasse}</Plakette> : art === 'lehrer' ? <b>{p.kurz}</b> : art === 'eltern' ? (p.kinder.length ? <Box>{p.kinder.map(i => <Typography key={i} variant="body2">{sNach[i] ? `${personName(sNach[i])} · ${sNach[i].klasse}` : `#${i}`}</Typography>)}</Box> : '–') : p.funktion },
              { id: 'e', kopf: art === 'schueler' ? 'Elternkonten' : 'E-Mail', zelle: p => art === 'schueler' ? (p.elternkonten.length ? <Stack direction="row" gap={0.5} flexWrap="wrap">{p.elternkonten.map(x => <Plakette key={x.id}><a href={`#/admin/benutzer/-/${x.id}`}>{x.login}</a></Plakette>)}</Stack> : '–') : p.email, verbergenMobil: true },
              { id: 'konto', kopf: 'Konto', sortWert: p => (p.konto ? 1 : 0), zelle: p => p.konto ? <Box><a href={`#/admin/benutzer/-/${p.konto.id}`}><Plakette ton={p.konto.gesperrt ? 'entfall' : 'ok'}>{p.konto.login}</Plakette></a><Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{p.konto.letzteAnmeldung ? `zuletzt ${seit(p.konto.letzteAnmeldung)}` : 'noch nie angemeldet'}</Typography></Box>
                : <Stack direction="row" gap={1} alignItems="center"><Plakette>fehlt</Plakette><Button size="small" onClick={() => setKonten({ auswahl: [p.schluessel] })}>Konto anlegen</Button></Stack> },
              { id: 'akt', kopf: '', rechts: true, nowrap: true, zelle: p => verwaltet && <Stack direction="row" justifyContent="flex-end">
                <IconButton size="small" aria-label="Bearbeiten" onClick={() => setPerson({ p })}><EditOutlined fontSize="small" /></IconButton>
                <IconButton size="small" color="error" aria-label="Löschen" onClick={async () => {
                  if (!(await bestaetigen('Person löschen', `${personName(p)} aus der Personenliste löschen?${p.konto ? ` Das Konto „${p.konto.login}“ bleibt erhalten, verliert aber die Zuordnung.` : ''}`))) return;
                  try { await loeschen(`/api/app/admin/personen/${p.schluessel}`); toast('Gelöscht.'); void g.neu(); } catch (err) { fehler(err); }
                }}><DeleteOutlineRounded fontSize="small" /></IconButton>
              </Stack> },
            ]} />
          <Stack direction="row" gap={1} alignItems="center" sx={{ mt: 1.5 }}>
            <Typography variant="body2" color="text.secondary">{sichtbar.length} von {liste.length}{auswahl.size ? ` · ${auswahl.size} ausgewählt` : ''}</Typography>
            <Button size="small" startIcon={<AddRounded />} disabled={!auswahl.size} onClick={() => setKonten({ auswahl: [...auswahl] as string[] })}>Konten für Auswahl anlegen</Button>
          </Stack>
          {konten && <KontenDialog art={art} liste={liste} schueler={schueler} auswahl={konten.auswahl} onClose={() => setKonten(null)} fertig={r => { setAuswahl(new Set()); void g.neu(); setZugang({ titel: `Zugangsdaten ${ARTEN[art]}`, r }); }} />}
          {person && <PersonDialog art={art} p={person.p} schueler={schueler} onClose={() => setPerson(null)} fertig={() => void g.neu()} />}
          {zugang && <ZugangsdatenDialog titel={zugang.titel} r={zugang.r} onClose={() => setZugang(null)} />}
        </>
      );
    }}</Geladen>
  );
}

function KontenDialog({ art, liste, schueler, auswahl, onClose, fertig }: { art: string; liste: Person[]; schueler: Person[]; auswahl: string[] | null; onClose: () => void; fertig: (r: Zugang) => void }) {
  const schemata = art === 'lehrer' ? SCHEMATA : Object.fromEntries(Object.entries(SCHEMATA).filter(([k]) => k !== 'kuerzel'));
  const rollen: Record<string, string> | null = art === 'lehrer' ? { '': 'Automatisch (Zuordnungsgruppen: Schulleitung, sonst Lehrkraft)', lehrer: 'Lehrkraft', leitung: 'Schulleitung', admin: 'Administration' }
    : art === 'personal' ? { lehrer: 'Lehrkraft ohne Kürzel (Kollegium)', leitung: 'Schulleitung', admin: 'Administration' } : null;
  const [schema, setSchema] = useState(art === 'lehrer' ? 'kuerzel' : 'vorname.nachname');
  const [rolle, setRolle] = useState(art === 'personal' ? 'lehrer' : '');
  const [umfang, setUmfang] = useState('');
  const beispiel = liste.find(p => !p.konto && (!auswahl || auswahl.includes(p.schluessel))) ?? liste[0];
  const klassen = [...new Set(schueler.filter(s => !s.konto).map(s => s.klasse))];
  const ohne = liste.filter(p => !p.konto).length;
  return (
    <FormDialog offen titel={auswahl?.length === 1 ? `Konto anlegen – ${personName(liste.find(p => p.schluessel === auswahl[0])!)}` : `Konten für ${ARTEN[art]} anlegen`} aktionText="Konten anlegen" onClose={onClose} aktion={async () => {
      const r = await senden<Zugang>('/api/app/admin/personen/konten', { art, schluessel: auswahl ?? [], klasse: umfang || null, schema, rolle: rolle || null });
      toast(`${r.anzahl} ${r.anzahl === 1 ? 'Konto' : 'Konten'} angelegt.`); fertig(r);
    }}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        {auswahl ? <Alert severity="info">{auswahl.length} {auswahl.length === 1 ? 'Person' : 'Personen'} ausgewählt.</Alert> : (
          <TextField select label="Umfang" value={umfang} onChange={e => setUmfang(e.target.value)}>
            <MenuItem value="">Alle {ARTEN[art]} ohne Konto ({ohne})</MenuItem>
            {art === 'schueler' && klassen.map(k => <MenuItem key={k} value={k}>Nur Klasse {k} ({schueler.filter(s => s.klasse === k && !s.konto).length} ohne Konto)</MenuItem>)}
          </TextField>
        )}
        <Stack direction="row" gap={2}>
          <TextField select label="Login-Schema" value={schema} onChange={e => setSchema(e.target.value)} sx={{ flex: 1 }}>{Object.entries(schemata).map(([k, tt]) => <MenuItem key={k} value={k}>{tt}</MenuItem>)}</TextField>
          <TextField label="Beispiel" value={beispiel ? loginBeispiel(schema, beispiel) : '–'} slotProps={{ input: { readOnly: true, sx: { fontFamily: 'monospace' } } }} sx={{ flex: 1 }} />
        </Stack>
        {rollen && <TextField select label="Rolle" value={rolle} onChange={e => setRolle(e.target.value)}>{Object.entries(rollen).map(([k, tt]) => <MenuItem key={k} value={k}>{tt}</MenuItem>)}</TextField>}
        <Typography variant="body2" color="text.secondary">Jedes Konto erhält ein zufälliges Startpasswort, das bei der ersten Anmeldung geändert werden muss. Gibt es den Benutzernamen schon, wird eine Zahl angehängt.
          {art === 'schueler' ? ' Schülerkonten werden der Person zugeordnet (eine Person – ein Konto).' : art === 'eltern' ? ' Elternkonten erhalten die erfassten Kinder.' : ''}</Typography>
      </Stack>
    </FormDialog>
  );
}

function PersonDialog({ art, p, schueler, onClose, fertig }: { art: string; p: Person | null; schueler: Person[]; onClose: () => void; fertig: () => void }) {
  const [w, setW] = useState({ vorname: p?.vorname ?? '', name: p?.name ?? '', funktion: p?.funktion ?? '', email: p?.email ?? '', kinder: p?.kinder ?? [] as number[] });
  const opt = schueler.map(s => ({ id: Number(s.schluessel), text: `${s.name}, ${s.vorname}`, klasse: s.klasse }));
  return (
    <FormDialog offen titel={p ? `${personName(p)} bearbeiten` : art === 'eltern' ? 'Erziehungsberechtigte*n erfassen' : 'Person erfassen'} onClose={onClose} aktion={async () => {
      if (!w.name.trim()) { toast('Bitte einen Nachnamen eingeben.', true); return false; }
      await senden(p ? `/api/app/admin/personen/${p.schluessel}` : '/api/app/admin/personen', { art, ...w, kinder: art === 'eltern' ? w.kinder : [] }, p ? 'PUT' : 'POST');
      toast('Gespeichert.'); fertig();
    }}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        <Stack direction="row" gap={2}>
          <TextField label="Vorname" value={w.vorname} onChange={e => setW({ ...w, vorname: e.target.value })} sx={{ flex: 1 }} />
          <TextField label="Nachname" value={w.name} onChange={e => setW({ ...w, name: e.target.value })} required sx={{ flex: 1 }} />
        </Stack>
        {art === 'personal' && <TextField label="Funktion" value={w.funktion} onChange={e => setW({ ...w, funktion: e.target.value })} placeholder="z. B. Sekretariat" />}
        <TextField label="E-Mail (optional)" type="email" value={w.email} onChange={e => setW({ ...w, email: e.target.value })} />
        {art === 'eltern' && <Autocomplete multiple options={opt} value={opt.filter(s => w.kinder.includes(s.id))} onChange={(_, v) => setW({ ...w, kinder: v.map(s => s.id) })} groupBy={s => `Klasse ${s.klasse}`}
          getOptionLabel={s => s.text} disableCloseOnSelect renderInput={pp => <TextField {...pp} label="Kinder" placeholder="Kinder zuordnen …" />} />}
      </Stack>
    </FormDialog>
  );
}
