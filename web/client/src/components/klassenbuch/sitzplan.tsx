// Sitzplan: Klassenbuch-Einstellungen dieses Geräts (Ansicht Liste/Sitzplan, Sortierung, Namen), Sitzplan-Anordnung der Schülerkacheln,
// Editor (Raster, Lehrerpult, Tische entfernen, Ziehen und Ablegen mit Maus/Touch/Stift oder Antippen, zufällig/alphabetisch füllen,
// Rückgängig, PDF) mit Wirkungsbereich Klasse/Unterricht/Raum. Gültiger Plan einer Stunde (Server): Unterricht vor Raum vor Klasse.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  alpha, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Drawer, FormControlLabel, IconButton, Radio, RadioGroup, Stack,
  TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import CloseRounded from '@mui/icons-material/CloseRounded';
import RemoveRounded from '@mui/icons-material/RemoveRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import CoPresentOutlined from '@mui/icons-material/CoPresentOutlined';
import { holen, senden, api } from '../../api/client';
import type { Karte } from '../../api/types';
import { lesen, schreiben } from '../../lib/speicher';
import { bestaetigen, fehler, toast } from '../../lib/meldungen';
import { pdfAusrichtung } from '../../lib/pdf';
import { SuchFeld } from '../Bausteine';

export interface Schueler { id: number; vorname: string; name: string; klasse?: string }
export interface KbEinstellungen { ansicht: 'liste' | 'sitzplan'; sortierung: 'name' | 'vorname'; nachKlasse: boolean; richtung: 'zeilen' | 'spalten'; namen: 'nachname' | 'vorname' | 'kurz'; klasseZeigen: boolean }
export interface Sitzplan { bereich: string; zeilen: number; spalten: number; pult: 'vorne' | 'hinten'; belegung: Record<string, number>; ohneTisch: string[]; geaendert?: string; vorhanden?: boolean }
export interface SitzDaten {
  kontext?: { unterricht?: number | null; raeume?: string[]; klassen?: string[]; klasse?: string | null; raum?: string | null; lehrer?: string | null };
  schueler: Schueler[]; gueltig: Sitzplan | null; plaene: Record<string, Sitzplan | null>; rechte: Record<string, boolean>;
}
export interface SitzKontext { unterricht?: number | null; raeume?: string[]; klassen?: string[]; lehrer?: string | null; klasse?: string | null }

const SCHLUESSEL = 'untplan:klassenbuch-einstellungen';
const VORGABE: KbEinstellungen = { ansicht: 'liste', sortierung: 'name', nachKlasse: false, richtung: 'zeilen', namen: 'nachname', klasseZeigen: false };
let schulVorgabe: Partial<KbEinstellungen> = {};
export function schulVorgabeSetzen(w: Partial<KbEinstellungen>) { schulVorgabe = { ...w }; }
export const kbEinstellungen = (): KbEinstellungen => ({ ...VORGABE, ...schulVorgabe, ...lesen<Partial<KbEinstellungen>>(SCHLUESSEL, {}) });
export const kbEinstellungenSpeichern = (w: KbEinstellungen) => schreiben(SCHLUESSEL, w);

const de = (a?: string, b?: string) => (a || '').localeCompare(b || '', 'de', { sensitivity: 'base' });
export function sortieren<T extends Schueler>(l: T[], w = kbEinstellungen()): T[] {
  const n = w.sortierung === 'vorname' ? (a: T, b: T) => de(a.vorname, b.vorname) || de(a.name, b.name) : (a: T, b: T) => de(a.name, b.name) || de(a.vorname, b.vorname);
  return l.slice().sort((a, b) => (w.nachKlasse ? de(a.klasse, b.klasse) : 0) || n(a, b));
}
export function nameZeilen(s: Schueler, w = kbEinstellungen()): [string, string] {
  if (w.namen === 'kurz') return [s.vorname || s.name, s.vorname && s.name ? `${s.name[0]}.` : ''];
  return w.namen === 'vorname' ? [s.vorname, s.name] : [s.name, s.vorname];
}
export const anzeigeName = (s: Schueler, w = kbEinstellungen()) => nameZeilen(s, w).filter(Boolean).join(' ');

export function kontextVon(k: Karte): SitzKontext {
  const kurz = (l: { k: string; alt?: string | null }[]) => (l ?? []).filter(x => x.k && !(x.alt && !x.k)).map(x => x.k);
  const lehrer = kurz(k.lehrer);
  return { unterricht: k.unterricht, raeume: kurz(k.raeume), klassen: kurz(k.klassen), lehrer: lehrer.length === 1 ? lehrer[0] : null };
}
const abfrage = (kx: SitzKontext) => `unterricht=${kx.unterricht ?? ''}&raeume=${encodeURIComponent((kx.raeume ?? []).join(','))}&klassen=${encodeURIComponent((kx.klassen ?? []).join(','))}${kx.lehrer ? `&lehrer=${encodeURIComponent(kx.lehrer)}` : ''}`;
export const stundeLaden = (kx: SitzKontext) => holen<SitzDaten>(`/api/app/sitzplaene/stunde?${abfrage(kx)}`);
export const darfIrgendwas = (d: SitzDaten | null | undefined) => !!(d?.rechte && (d.rechte.klasse || d.rechte.unterricht || d.rechte.raum));
export const bereichName = (b: string) => ({ klasse: 'Klasse', unterricht: 'Unterricht', raum: 'Raum' } as Record<string, string>)[b] ?? '';

export async function sitzplanPdf(daten: object) {
  const ausrichtung = await pdfAusrichtung('quer', 'sitzplan');
  if (!ausrichtung) return;
  const fenster = window.open('', '_blank');
  try {
    const r = await fetch('/api/app/sitzplaene/pdf', { method: 'POST', credentials: 'same-origin', headers: { 'X-UntPlanWeb': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ ...daten, ausrichtung }) });
    if (!r.ok) throw new Error((await r.json().catch(() => null))?.fehler ?? `Fehler ${r.status}`);
    const url = URL.createObjectURL(await r.blob());
    if (fenster) fenster.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) { fenster?.close(); fehler(err); }
}

/** Kleine Schülerkarte (zwei Namenszeilen, ohne Initialen-Avatar). */
export function SchuelerKarte({ s, w, gewaehlt, onClick, zusatz, ziehbar, sx }: { s: Schueler; w: KbEinstellungen; gewaehlt?: boolean; onClick?: () => void; zusatz?: ReactNode; ziehbar?: boolean; sx?: object }) {
  const [a, b] = nameZeilen(s, w);
  return (
    <Box data-karte={s.id} role="button" tabIndex={0} onClick={onClick} aria-pressed={gewaehlt} aria-label={anzeigeName(s, w)}
      onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && onClick) { e.preventDefault(); onClick(); } }}
      sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.75, borderRadius: 1, bgcolor: 'background.paper', border: 1, borderColor: gewaehlt ? 'primary.main' : 'divider',
        boxShadow: gewaehlt ? t => `0 0 0 2px ${alpha(t.palette.primary.main, 0.25)}` : 'none', cursor: ziehbar ? 'grab' : onClick ? 'pointer' : 'default', userSelect: 'none', touchAction: ziehbar ? 'none' : 'auto', minWidth: 0, ...sx }}>
      <Box sx={{ minWidth: 0, lineHeight: 1.2 }}>
        <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 500 }}>{a}</Typography>
        {b && <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary' }}>{b}</Typography>}
        {w.klasseZeigen && s.klasse && <Typography noWrap sx={{ fontSize: 10.5, color: 'text.disabled' }}>{s.klasse}</Typography>}
      </Box>
      {zusatz}
    </Box>
  );
}

/** Seitenleiste „Klassenbuch-Einstellungen“ (gilt sofort, auf dem Gerät gespeichert). */
export function EinstellungenPanel({ offen, zu, onAendern, sitzplan }: { offen: boolean; zu: () => void; onAendern: (w: KbEinstellungen) => void; sitzplan?: { darf: boolean; onOeffnen: () => void } | null }) {
  const [w, setW] = useState(kbEinstellungen);
  useEffect(() => { if (offen) setW(kbEinstellungen()); }, [offen]);
  const setzen = (n: Partial<KbEinstellungen>) => { const neu = { ...w, ...n }; setW(neu); kbEinstellungenSpeichern(neu); onAendern(neu); };
  const beispiel: Schueler[] = [{ id: 3, vorname: 'Emma', name: 'Schulz', klasse: '7a' }, { id: 1, vorname: 'Ben', name: 'Aydin', klasse: '7b' }];
  const gruppe = (titel: string, kinder: ReactNode) => <Box sx={{ mb: 2.5 }}><Typography variant="overline" color="text.secondary">{titel}</Typography>{kinder}</Box>;
  return (
    <Drawer anchor="right" open={offen} onClose={zu} sx={{ zIndex: t => t.zIndex.modal + 2 }} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 380 } } } }}>
      <Stack direction="row" alignItems="center" sx={{ px: 2.5, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h3" component="h2" sx={{ flex: 1 }}>Klassenbuch-Einstellungen</Typography>
        <IconButton onClick={zu} aria-label="Schließen"><CloseRounded /></IconButton>
      </Stack>
      <Box sx={{ p: 2.5, overflowY: 'auto', flex: 1 }}>
        {gruppe('Schüler*innen anzeigen als', (
          <ToggleButtonGroup exclusive value={w.ansicht} onChange={(_, v) => v && setzen({ ansicht: v })} sx={{ mt: 0.5 }}>
            <ToggleButton value="liste">Liste</ToggleButton><ToggleButton value="sitzplan">Sitzplan</ToggleButton>
          </ToggleButtonGroup>
        ))}
        {gruppe('Sortierung der Schülerliste', (
          <>
            <RadioGroup value={w.sortierung} onChange={e => setzen({ sortierung: e.target.value as KbEinstellungen['sortierung'] })}>
              <FormControlLabel value="name" control={<Radio size="small" />} label="Nach Familienname" />
              <FormControlLabel value="vorname" control={<Radio size="small" />} label="Nach Vorname" />
            </RadioGroup>
            <FormControlLabel control={<Checkbox size="small" checked={w.nachKlasse} onChange={e => setzen({ nachKlasse: e.target.checked })} />} label="Nach Klasse sortieren (Mischgruppen)" />
            <RadioGroup value={w.richtung} onChange={e => setzen({ richtung: e.target.value as KbEinstellungen['richtung'] })} sx={{ mt: 1 }}>
              <FormControlLabel value="zeilen" control={<Radio size="small" />} label="Von links nach rechts" />
              <FormControlLabel value="spalten" control={<Radio size="small" />} label="Von oben nach unten" />
            </RadioGroup>
          </>
        ))}
        {gruppe('Darstellung der Namen', (
          <>
            <RadioGroup value={w.namen} onChange={e => setzen({ namen: e.target.value as KbEinstellungen['namen'] })}>
              <FormControlLabel value="nachname" control={<Radio size="small" />} label="Familienname vor Vorname" />
              <FormControlLabel value="vorname" control={<Radio size="small" />} label="Vorname vor Familienname" />
              <FormControlLabel value="kurz" control={<Radio size="small" />} label="Kurzform (z. B. „Emma S.“)" />
            </RadioGroup>
            <FormControlLabel control={<Checkbox size="small" checked={w.klasseZeigen} onChange={e => setzen({ klasseZeigen: e.target.checked })} />} label="Klasse anzeigen" />
            <Stack direction="row" gap={1} sx={{ mt: 1.5 }}>{beispiel.map(s => <SchuelerKarte key={s.id} s={s} w={w} sx={{ flex: 1 }} />)}</Stack>
          </>
        ))}
        <Typography variant="body2" color="text.secondary">Die Einstellungen gelten auf diesem Gerät für alle Stunden.</Typography>
      </Box>
      <Stack direction="row" gap={1} justifyContent="flex-end" sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        {sitzplan && <Button variant="contained" disabled={!sitzplan.darf} onClick={() => { zu(); sitzplan.onOeffnen(); }}>Sitzplan bearbeiten</Button>}
        <Button variant="outlined" onClick={zu}>Schließen</Button>
      </Stack>
    </Drawer>
  );
}

/** Schülerkacheln in Sitzplan-Anordnung; ohne gültigen Plan null. */
export function SitzplanAnordnung({ d, schueler, kachel, w }: { d: SitzDaten | null; schueler: Schueler[]; kachel: (s: Schueler) => ReactNode; w: KbEinstellungen }) {
  const plan = d?.gueltig;
  if (!plan) return null;
  const nachId = new Map(schueler.map(s => [s.id, s]));
  const ohne = new Set(plan.ohneTisch ?? []);
  const hinten = plan.pult === 'hinten';
  const zellen: ReactNode[] = [];
  for (let dz = 0; dz < plan.zeilen; dz++) for (let ds = 0; ds < plan.spalten; ds++) {
    const z = hinten ? plan.zeilen - dz : dz + 1, sp = hinten ? plan.spalten - ds : ds + 1;
    const key = `${z}-${sp}`, s = nachId.get(plan.belegung[key]);
    zellen.push(s ? <Box key={key}>{kachel(s)}</Box> : ohne.has(key) ? <Box key={key} /> : <Box key={key} title={`Reihe ${z}, Platz ${sp} – frei`} sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 1.5, minHeight: 56 }} />);
  }
  const gesetzt = new Set(Object.values(plan.belegung));
  const rest = sortieren(schueler.filter(s => !gesetzt.has(s.id)), w);
  const pult = <Box sx={{ mx: 'auto', my: 1, px: 3, py: 0.5, borderRadius: 1, bgcolor: 'action.hover', color: 'text.secondary', fontSize: 12, fontWeight: 600, width: 'fit-content', display: 'flex', gap: 0.75, alignItems: 'center' }}><CoPresentOutlined sx={{ fontSize: 16 }} />Lehrerpult</Box>;
  return (
    <Box>
      <Box sx={{ overflowX: 'auto' }}>
        {!hinten && pult}
        <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${plan.spalten}, minmax(108px, 1fr))`, gap: 1 }}>{zellen}</Box>
        {hinten && pult}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Sitzplan: {bereichName(plan.bereich)}{plan.geaendert ? ` · geändert ${plan.geaendert.slice(8, 10)}.${plan.geaendert.slice(5, 7)}.${plan.geaendert.slice(0, 4)}` : ''}</Typography>
      {rest.length > 0 && <Box sx={{ mt: 2 }}><Typography variant="subtitle2" sx={{ mb: 1 }}>Ohne Sitzplatz ({rest.length})</Typography><Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1 }}>{rest.map(s => <Box key={s.id}>{kachel(s)}</Box>)}</Box></Box>}
    </Box>
  );
}

const BEREICHE: [string, string][] = [['klasse', 'Klasse'], ['unterricht', 'Unterricht'], ['raum', 'Raum']];
const BEREICH_TEXT: Record<string, string> = {
  klasse: 'Gilt in jedem Unterricht der Klasse (nur Klassenleitung).',
  unterricht: 'Gilt nur in diesem Unterricht – der Klassen-Sitzplan wird hier nicht mehr angezeigt.',
  raum: 'Gilt in Ihren Stunden in diesem Raum (z. B. Fachraum).',
};
const OHNE_RECHT: Record<string, string> = {
  klasse: 'Einen Klassen-Sitzplan legt nur die Klassenleitung an (bei Unterricht mit einer Klasse).',
  unterricht: 'Nur für eigene Unterrichte.',
  raum: 'Nur für Räume eigener Unterrichte.',
};

interface Stand { zeilen: number; spalten: number; pult: 'vorne' | 'hinten'; belegung: Map<string, number>; ohne: Set<string> }

/** Sitzplan-Editor als großes Fenster. */
export function SitzplanEditor({ offen, zu, d, kontext, titel = 'Sitzplan', untertitel = '', bereich, onGespeichert }: {
  offen: boolean; zu: () => void; d: SitzDaten; kontext: SitzKontext; titel?: string; untertitel?: string; bereich?: string; onGespeichert?: (p: Sitzplan | null) => void;
}) {
  const t = useTheme();
  const mobil = useMediaQuery(t.breakpoints.down('md'));
  const w = useMemo(kbEinstellungen, [offen]);
  const schueler = useMemo(() => sortieren(d.schueler ?? [], w), [d.schueler, w]);
  const nachId = useMemo(() => new Map(schueler.map(s => [s.id, s])), [schueler]);
  const rechte = d.rechte ?? {};
  const erlaubt = (b: string) => !!rechte[b];
  const start = d.gueltig && erlaubt(d.gueltig.bereich) ? d.gueltig.bereich : bereich && erlaubt(bereich) ? bereich : ['unterricht', 'klasse', 'raum'].find(erlaubt) ?? 'unterricht';
  const ausPlan = (p: Sitzplan | null | undefined): Stand => ({
    zeilen: p?.zeilen ?? 5, spalten: p?.spalten ?? 6, pult: p?.pult ?? 'vorne',
    belegung: new Map(Object.entries(p?.belegung ?? {}).filter(([, id]) => nachId.has(id))), ohne: new Set(p?.ohneTisch ?? []),
  });
  const [st, setSt] = useState<Stand>(() => ausPlan(d.gueltig ?? d.plaene?.[start]));
  const [ber, setBer] = useState(start);
  const [tische, setTische] = useState(false);
  const [suche, setSuche] = useState('');
  const [gewaehlt, setGewaehlt] = useState<number | null>(null);
  const [verlauf, setVerlauf] = useState<Stand[]>([]);
  const [geaendert, setGeaendert] = useState(false);
  const [eingabe, setEingabe] = useState({ zeilen: st.zeilen, spalten: st.spalten });
  const [ziel, setZiel] = useState<string | null>(null);
  const geist = useRef<HTMLDivElement>(null);

  const aendern = (f: (s: Stand) => Stand) => {
    setVerlauf(v => [...v.slice(-59), { ...st, belegung: new Map(st.belegung), ohne: new Set(st.ohne) }]);
    setSt(f({ ...st, belegung: new Map(st.belegung), ohne: new Set(st.ohne) }));
    setGeaendert(true);
    setGewaehlt(null);
  };
  const platzVon = (id: number) => { for (const [k, v] of st.belegung) if (v === id) return k; return null; };
  const setzen = (id: number, zielKey: string | null) => {
    const von = platzVon(id);
    if (zielKey === von || (zielKey && st.ohne.has(zielKey))) return;
    aendern(s => {
      if (!zielKey) { if (von) s.belegung.delete(von); }
      else {
        const anderer = s.belegung.get(zielKey);
        if (von) { if (anderer) s.belegung.set(von, anderer); else s.belegung.delete(von); }
        s.belegung.set(zielKey, id);
      }
      return s;
    });
  };
  const plaetze = (s: Stand) => {
    const l: string[] = [];
    if (w.richtung === 'spalten') { for (let x = 1; x <= s.spalten; x++) for (let z = 1; z <= s.zeilen; z++) l.push(`${z}-${x}`); }
    else for (let z = 1; z <= s.zeilen; z++) for (let x = 1; x <= s.spalten; x++) l.push(`${z}-${x}`);
    return l.filter(k => !s.ohne.has(k));
  };
  const fuellen = (liste: Schueler[]) => aendern(s => {
    s.belegung.clear();
    const p = plaetze(s);
    liste.slice(0, p.length).forEach((x, i) => s.belegung.set(p[i], x.id));
    if (liste.length > p.length) toast(`${liste.length - p.length} Schüler*innen haben keinen Platz – bitte Raster vergrößern.`, true);
    return s;
  });
  const anwenden = (zeilen: number, spalten: number) => {
    const z = Math.max(1, Math.min(15, zeilen || 1)), x = Math.max(1, Math.min(15, spalten || 1));
    setEingabe({ zeilen: z, spalten: x });
    if (z === st.zeilen && x === st.spalten) return;
    aendern(s => {
      s.zeilen = z; s.spalten = x;
      const imRaster = (k: string) => { const [a, b] = k.split('-').map(Number); return a >= 1 && a <= z && b >= 1 && b <= x; };
      let raus = 0;
      for (const k of [...s.belegung.keys()]) if (!imRaster(k)) { s.belegung.delete(k); raus++; }
      for (const k of [...s.ohne]) if (!imRaster(k)) s.ohne.delete(k);
      if (raus) toast(`${raus} Schüler*in${raus === 1 ? '' : 'nen'} wieder in „nicht zugeordnet“.`);
      return s;
    });
  };
  const zurueck = () => {
    const v = verlauf[verlauf.length - 1];
    if (!v) return;
    setVerlauf(verlauf.slice(0, -1));
    setSt(v);
    setEingabe({ zeilen: v.zeilen, spalten: v.spalten });
  };
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !(e.target as HTMLElement).matches('input')) { e.preventDefault(); zurueck(); } };
    if (offen) document.addEventListener('keydown', f, true);
    return () => document.removeEventListener('keydown', f, true);
  });

  const planDaten = () => ({
    bereich: ber, unterricht: kontext.unterricht ?? null, raeume: kontext.raeume ?? [], klassen: kontext.klassen ?? [], lehrer: kontext.lehrer ?? null,
    klasse: kontext.klasse ?? null, raum: d.kontext?.raum ?? null, zeilen: st.zeilen, spalten: st.spalten, pult: st.pult,
    belegung: Object.fromEntries(st.belegung), ohneTisch: [...st.ohne],
  });
  const schliessen = async () => { if (geaendert && !(await bestaetigen('Sitzplan', 'Änderungen am Sitzplan verwerfen?', 'Verwerfen'))) return; zu(); };
  const speichern = async () => {
    try {
      const neu = await senden<Sitzplan>('/api/app/sitzplaene', planDaten(), 'PUT');
      toast(`Sitzplan gespeichert – gilt für: ${bereichName(ber)}.`);
      zu();
      onGespeichert?.(neu);
    } catch (err) { fehler(err); }
  };
  const loeschen = async () => {
    if (!(await bestaetigen('Sitzplan löschen', `Sitzplan für den Wirkungsbereich „${bereichName(ber)}“ löschen?`))) return;
    const p = planDaten();
    const q = `bereich=${p.bereich}&${abfrage(p)}${p.klasse ? `&klasse=${encodeURIComponent(p.klasse)}` : ''}${p.raum ? `&raum=${encodeURIComponent(p.raum)}` : ''}`;
    try { await api(`/api/app/sitzplaene?${q}`, { methode: 'DELETE' }); toast('Sitzplan gelöscht.'); zu(); onGespeichert?.(null); } catch (err) { fehler(err); }
  };

  // Ziehen und Ablegen (Pointer-Events: Maus, Touch, Stift)
  const ziehen = useRef<{ id: number; dx: number; dy: number; sx: number; sy: number; aktiv: boolean; breite: number } | null>(null);
  const unterdruecken = useRef(false);
  const runter = (e: React.PointerEvent, id: number) => {
    if (tische || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    ziehen.current = { id, dx: e.clientX - r.left, dy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, aktiv: false, breite: r.width };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ohne */ }
  };
  const bewegen = (e: React.PointerEvent) => {
    const z = ziehen.current;
    if (!z) return;
    if (!z.aktiv) { if (Math.hypot(e.clientX - z.sx, e.clientY - z.sy) < 6) return; z.aktiv = true; }
    if (geist.current) {
      geist.current.style.display = 'block';
      geist.current.style.width = `${z.breite}px`;
      geist.current.style.transform = `translate(${e.clientX - z.dx}px, ${e.clientY - z.dy}px)`;
      geist.current.textContent = anzeigeName(nachId.get(z.id)!, w);
    }
    const unter = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const platz = unter?.closest<HTMLElement>('[data-platz]');
    setZiel(platz && !st.ohne.has(platz.dataset.platz!) ? platz.dataset.platz! : unter?.closest('[data-ablage]') ? 'ablage' : null);
  };
  const hoch = (e: React.PointerEvent) => {
    const z = ziehen.current;
    ziehen.current = null;
    if (geist.current) geist.current.style.display = 'none';
    if (!z?.aktiv) return;
    unterdruecken.current = true;
    setTimeout(() => { unterdruecken.current = false; }, 0);
    const zz = ziel;
    setZiel(null);
    if (e.type === 'pointercancel' || !zz) return;
    if (zz === 'ablage') { if (platzVon(z.id)) setzen(z.id, null); } else setzen(z.id, zz);
  };
  const karteKlick = (id: number, platz: string | null) => {
    if (unterdruecken.current) return;
    if (gewaehlt !== null && gewaehlt !== id && platz) { setzen(gewaehlt, platz); return; }
    setGewaehlt(gewaehlt === id ? null : id);
  };
  const platzKlick = (k: string) => {
    if (tische) {
      if (st.belegung.has(k)) { toast('Auf diesem Platz sitzt jemand – zuerst die Schülerin bzw. den Schüler entfernen.', true); return; }
      aendern(s => { if (s.ohne.has(k)) s.ohne.delete(k); else s.ohne.add(k); return s; });
      return;
    }
    if (gewaehlt !== null) setzen(gewaehlt, k);
  };

  const hinten = st.pult === 'hinten';
  const gesetzt = new Set(st.belegung.values());
  const frei = schueler.filter(s => !gesetzt.has(s.id));
  const q = suche.trim().toLowerCase();
  const gefiltert = q ? frei.filter(s => `${s.vorname} ${s.name} ${s.name} ${s.vorname} ${s.klasse}`.toLowerCase().includes(q)) : frei;
  const zellen: ReactNode[] = [];
  for (let dz = 0; dz < st.zeilen; dz++) for (let ds = 0; ds < st.spalten; ds++) {
    const z = hinten ? st.zeilen - dz : dz + 1, sp = hinten ? st.spalten - ds : ds + 1;
    const k = `${z}-${sp}`, s = nachId.get(st.belegung.get(k) ?? -1);
    const ohne = st.ohne.has(k);
    zellen.push(
      <Box key={k} data-platz={k} onClick={() => (!s || tische) && platzKlick(k)} role={!s ? 'button' : undefined} tabIndex={!s ? 0 : undefined}
        aria-label={`Reihe ${z}, Platz ${sp}${ohne ? ': kein Tisch' : s ? '' : ': frei'}`}
        sx={{ position: 'relative', minHeight: 64, borderRadius: 1.5, p: 0.5, display: 'flex', alignItems: 'stretch',
          border: ohne ? '1px dashed transparent' : `1px ${s ? 'solid' : 'dashed'} ${ziel === k ? t.palette.primary.main : t.palette.divider}`,
          bgcolor: ohne ? (tische ? alpha(t.palette.text.primary, 0.04) : 'transparent') : ziel === k ? alpha(t.palette.primary.main, 0.08) : s ? alpha(t.palette.primary.main, 0.03) : 'background.paper',
          cursor: tische || (!s && gewaehlt !== null) ? 'pointer' : 'default' }}>
        {s && !ohne ? (
          <Box onPointerDown={e => runter(e, s.id)} onPointerMove={bewegen} onPointerUp={hoch} onPointerCancel={hoch} sx={{ width: '100%' }}
            onKeyDown={e => { if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); setzen(s.id, null); } }}>
            <SchuelerKarte s={s} w={w} gewaehlt={gewaehlt === s.id} ziehbar onClick={() => karteKlick(s.id, k)} sx={{ height: '100%' }} />
          </Box>
        ) : (
          <Box sx={{ m: 'auto', color: 'text.disabled', fontSize: 11, display: 'flex', alignItems: 'center' }}>
            {tische ? (ohne ? <AddRounded fontSize="small" /> : <CloseRounded fontSize="small" />) : ohne ? null : `${z}·${sp}`}
          </Box>
        )}
      </Box>,
    );
  }
  const pult = <Box sx={{ mx: 'auto', my: 1.5, px: 4, py: 0.75, borderRadius: 1, bgcolor: 'action.hover', color: 'text.secondary', fontSize: 12.5, fontWeight: 600, width: 'fit-content', display: 'flex', gap: 0.75, alignItems: 'center' }}><CoPresentOutlined sx={{ fontSize: 18 }} />Lehrerpult</Box>;
  const zahl = (n: 'zeilen' | 'spalten', text: string) => (
    <Stack direction="row" alignItems="center" gap={0.5}>
      <Typography variant="body2" color="text.secondary">{text}</Typography>
      <IconButton size="small" onClick={() => anwenden(n === 'zeilen' ? st.zeilen - 1 : st.zeilen, n === 'spalten' ? st.spalten - 1 : st.spalten)} aria-label={`${text} verringern`}><RemoveRounded fontSize="small" /></IconButton>
      <TextField value={eingabe[n]} onChange={e => setEingabe({ ...eingabe, [n]: Number(e.target.value) || 0 })} onBlur={() => anwenden(eingabe.zeilen, eingabe.spalten)}
        onKeyDown={e => { if (e.key === 'Enter') anwenden(eingabe.zeilen, eingabe.spalten); }} sx={{ width: 56 }} slotProps={{ htmlInput: { inputMode: 'numeric', 'aria-label': text, style: { textAlign: 'center' } } }} />
      <IconButton size="small" onClick={() => anwenden(n === 'zeilen' ? st.zeilen + 1 : st.zeilen, n === 'spalten' ? st.spalten + 1 : st.spalten)} aria-label={`${text} erhöhen`}><AddRounded fontSize="small" /></IconButton>
    </Stack>
  );
  const vorhanden = d.plaene?.[ber];
  return (
    <Dialog open={offen} onClose={schliessen} fullScreen={mobil} maxWidth="xl" fullWidth sx={{ zIndex: x => x.zIndex.modal + 2 }} slotProps={{ paper: { sx: { height: mobil ? '100%' : '92vh' } } }}>
      <DialogTitle sx={{ pr: 6 }}>{titel}{untertitel && <Typography variant="body2" color="text.secondary">{untertitel}</Typography>}
        <IconButton onClick={schliessen} aria-label="Schließen" sx={{ position: 'absolute', right: 10, top: 10 }}><CloseRounded /></IconButton></DialogTitle>
      <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap" sx={{ px: 3, pb: 1.5 }}>
        {zahl('spalten', 'Spalten')}{zahl('zeilen', 'Reihen')}
        <ToggleButtonGroup exclusive size="small" value={st.pult} onChange={(_, v) => v && v !== st.pult && aendern(s => ({ ...s, pult: v }))}>
          <ToggleButton value="vorne">Pult oben</ToggleButton><ToggleButton value="hinten">Pult unten</ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Plätze ohne Tisch festlegen (Gänge, Lücken)"><Button size="small" variant={tische ? 'contained' : 'outlined'} onClick={() => { setTische(!tische); setGewaehlt(null); }} aria-pressed={tische}>Tische</Button></Tooltip>
        <Button size="small" variant="outlined" onClick={() => { const l = schueler.slice(); for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } fuellen(l); }}>Zufällig</Button>
        <Button size="small" variant="outlined" onClick={() => fuellen(schueler)}>Alphabetisch</Button>
        <Button size="small" variant="outlined" onClick={() => st.belegung.size && aendern(s => { s.belegung.clear(); return s; })}>Leeren</Button>
        <Button size="small" variant="outlined" onClick={zurueck} disabled={!verlauf.length}>Rückgängig</Button>
        <Button size="small" variant="outlined" onClick={() => sitzplanPdf({ ...planDaten(), titel, vornameZuerst: w.namen === 'vorname', kurz: w.namen === 'kurz', klasseZeigen: w.klasseZeigen })}>Drucken</Button>
      </Stack>
      <Divider />
      <DialogContent sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) 280px' }, gap: 2, p: 2, bgcolor: 'background.default' }}>
        <Box sx={{ overflow: 'auto', p: 1 }}>
          {!hinten && pult}
          <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${st.spalten}, minmax(120px, 1fr))`, gap: 1 }}>{zellen}</Box>
          {hinten && pult}
        </Box>
        <Box data-ablage onClick={() => { if (gewaehlt !== null && platzVon(gewaehlt)) setzen(gewaehlt, null); }}
          sx={{ border: 1, borderColor: ziel === 'ablage' ? 'primary.main' : 'divider', borderRadius: 1.5, p: 1.5, bgcolor: 'background.paper', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="subtitle2">Nicht zugeordnet ({frei.length})</Typography>
          <SuchFeld wert={suche} onWert={setSuche} platzhalter="Name suchen …" breite="100%" />
          {!schueler.length ? <Typography variant="body2" color="text.secondary">Für diese Stunde ist keine Schülerliste vorhanden.</Typography>
            : !frei.length ? <Typography variant="body2" color="text.secondary">Alle Schüler*innen haben einen Platz.</Typography>
            : gefiltert.map(s => (
              <Box key={s.id} onPointerDown={e => runter(e, s.id)} onPointerMove={bewegen} onPointerUp={hoch} onPointerCancel={hoch} onClick={e => e.stopPropagation()}>
                <SchuelerKarte s={s} w={w} gewaehlt={gewaehlt === s.id} ziehbar onClick={() => karteKlick(s.id, null)} />
              </Box>
            ))}
        </Box>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3, py: 1.5, flexWrap: 'wrap', gap: 1.5 }}>
        <Stack direction="row" alignItems="center" gap={1.5} sx={{ mr: 'auto', flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary">Wirkungsbereich</Typography>
          <ToggleButtonGroup exclusive size="small" value={ber} onChange={(_, v) => v && setBer(v)}>
            {BEREICHE.map(([b, x]) => <Tooltip key={b} title={erlaubt(b) ? '' : OHNE_RECHT[b]}><span><ToggleButton value={b} disabled={!erlaubt(b)}>{x}{d.plaene?.[b] ? ' •' : ''}</ToggleButton></span></Tooltip>)}
          </ToggleButtonGroup>
          <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 360 }}>{erlaubt(ber) ? BEREICH_TEXT[ber] : OHNE_RECHT[ber]}</Typography>
          {vorhanden && erlaubt(ber) && <Button size="small" onClick={() => aendern(() => ausPlan(vorhanden))}>Gespeicherten Plan laden</Button>}
        </Stack>
        {vorhanden && erlaubt(ber) && <Button color="error" onClick={loeschen}>Löschen</Button>}
        <Button variant="outlined" onClick={schliessen}>Abbrechen</Button>
        <Button variant="contained" onClick={speichern} disabled={!erlaubt(ber)}>Speichern</Button>
      </DialogActions>
      <Box ref={geist} sx={{ display: 'none', position: 'fixed', left: 0, top: 0, zIndex: 3000, pointerEvents: 'none', px: 1.5, py: 1, borderRadius: 1.5, bgcolor: 'background.paper', border: 1, borderColor: 'primary.main', boxShadow: '0 12px 32px rgba(21,26,33,.2)', fontSize: 13, fontWeight: 600 }} />
    </Dialog>
  );
}
