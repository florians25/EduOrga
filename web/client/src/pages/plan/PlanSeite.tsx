// Stundenpläne (Klasse, Lehrkraft, Raum, „Mein Stundenplan“): flache Werkzeugleiste mit Elementwahl (Alt+←/→), Woche bzw. Tag mit
// Kalender, Segmentschalter Woche/Tag, Legende als Text mit kleinen Mustern (Hervorhebung), Menü „Ansicht“ und Hilfe; darunter das Wochenraster. Klick auf eine Stunde öffnet
// die Stundendetails (mit Klassenbuch für Lehrkräfte).
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Grid, IconButton, ListItemIcon, ListItemText, ListSubheader, Menu, MenuItem,
  Paper, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import HelpOutlineRounded from '@mui/icons-material/HelpOutlineRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import PrintOutlined from '@mui/icons-material/PrintOutlined';
import LinkRounded from '@mui/icons-material/LinkRounded';
import { holen, qs } from '../../api/client';
import type { Element, Karte, PlanTyp, Wochenplan } from '../../api/types';
import { useSitzung } from '../../app/sitzung';
import { ElementWahl, ZeitNavi } from '../../components/Auswahl';
import { Fehler, Laden, Seite } from '../../components/Seite';
import { Wochenraster, type Aufsichtsmodus } from '../../components/plan/Wochenraster';
import { Legende, LegendeTabelle } from '../../components/plan/Legende';
import { useDarstellung } from '../../components/plan/darstellung';
import { Stundendetails } from '../../components/plan/Stundendetails';
import type { Art } from '../../components/plan/logik';
import { heuteIso, istIsoDatum, kalenderwoche, montag, wochenText, wochentagKurz, datumKurz } from '../../lib/datum';
import { navigieren } from '../../lib/router';
import { lesen, schreiben } from '../../lib/speicher';
import { useLaden } from '../../lib/useLaden';
import { toast } from '../../lib/meldungen';
import type { SeitenProps } from '../register';

export const TYPEN: Record<PlanTyp, string> = { klasse: 'Klasse', lehrer: 'Lehrkraft', raum: 'Raum' };
export const LISTE: Record<PlanTyp, 'klassen' | 'lehrer' | 'raeume'> = { klasse: 'klassen', lehrer: 'lehrer', raum: 'raeume' };

export interface PlanEinstellungen { zeiten: boolean; abwesenheiten: boolean; aufsichten: Aufsichtsmodus; ansicht: 'woche' | 'tag' }

export function planEinstellungen(zeitenVorgabe: boolean, mobil: boolean): PlanEinstellungen {
  const w = lesen<Partial<PlanEinstellungen> & { aufsichten?: string }>('untplan:planeinstellungen', {});
  return { zeiten: w.zeiten ?? zeitenVorgabe, abwesenheiten: w.abwesenheiten ?? true, aufsichten: ((w.aufsichten as string) === 'halbiert' ? 'kompakt' : w.aufsichten as Aufsichtsmodus) ?? 'normal', ansicht: mobil ? 'tag' : w.ansicht ?? 'woche' };
}

export function elementInfo(typ: PlanTyp, x: Element | undefined) {
  if (!x) return '';
  if (typ === 'klasse') return x.leitung?.length ? `Klassenleitung: ${x.leitung.join(', ')}` : (x.name && x.name !== x.kurz ? x.name : '');
  return x.name && x.name !== x.kurz ? x.name : '';
}

function langname(plan: Wochenplan) {
  let n = (plan.name || '').trim();
  if (n.toLowerCase().startsWith(plan.element.toLowerCase())) n = n.slice(plan.element.length).replace(/^\s*[–-]\s*/, '');
  return n && n !== plan.element ? n : '';
}

/** Legende „Änderungstyp | Darstellung“ als eigenes Fenster (Knopf „Legende“ in der Werkzeugleiste). */
export function LegendeDialog({ offen, zu }: { offen: boolean; zu: () => void }) {
  return (
    <Dialog open={offen} onClose={zu} maxWidth="sm" fullWidth>
      <DialogTitle>Legende</DialogTitle>
      <DialogContent sx={{ px: { xs: 1, sm: 3 } }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Jede Änderung ist grün, ein Entfall rot und vollständig durchgestrichen. Die betroffene Angabe steht im Feld, z. B. „+Gal (Gor)“: neue Lehrkraft, in Klammern die bisherige.</Typography>
        <LegendeTabelle />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}><Button variant="contained" onClick={zu}>Schließen</Button></DialogActions>
    </Dialog>
  );
}

export function PlanHilfe({ offen, zu }: { offen: boolean; zu: () => void }) {
  return (
    <Dialog open={offen} onClose={zu} maxWidth="md" fullWidth>
      <DialogTitle>Hilfe zum Stundenplan</DialogTitle>
      <DialogContent>
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Typography variant="h4" sx={{ mb: 1.5 }}>Darstellung</Typography>
            <LegendeTabelle />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>Die Kurzinfo beim Überfahren nennt die Art der Änderung. „Online“ führt zur Videokonferenz, das Stiftsymbol zeigt eine fällige Hausaufgabe, das Info-Symbol Notizen oder einen Vertretungstext; „+2“ am rechten Rand öffnet weitere Stunden zur selben Zeit.</Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Typography variant="h4" sx={{ mb: 1.5 }}>Bedienung</Typography>
            <Box component="ul" sx={{ pl: 2, m: 0, '& li': { mb: 0.75, fontSize: 14 } }}>
              <li>Der Zeitraum öffnet den Kalender, „Heute“ springt zur aktuellen Woche.</li>
              <li>Klasse, Lehrkraft oder Raum wählen Sie links (Alt+← / Alt+→ blättert).</li>
              <li>„Woche“ und „Tag“ schalten zwischen Wochen- und Tagesansicht.</li>
              <li>Die Höhe der Stunden entspricht der Uhrzeit; die Linie zeigt die aktuelle Zeit.</li>
              <li>Überfahren zeigt eine Kurzinfo, ein Klick öffnet die Stundendetails mit Klassenbuch.</li>
              <li>Die Leiste über dem Plan hebt einzelne Arten hervor (z. B. nur Änderungen); „Legende“ erklärt jede Darstellung, „Ansicht“ enthält weitere Einstellungen.</li>
              <li>Der Plan lädt Änderungen sofort, wenn Sie zum Fenster zurückkehren, und sonst alle zwei Minuten.</li>
            </Box>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}><Button variant="contained" onClick={zu}>Schließen</Button></DialogActions>
    </Dialog>
  );
}

export function AnsichtMenue({ einst, setEinst, mitAbwesenheiten = true }: { einst: PlanEinstellungen; setEinst: (e: PlanEinstellungen) => void; mitAbwesenheiten?: boolean }) {
  const [anker, setAnker] = useState<HTMLElement | null>(null);
  const haken = (an: boolean) => <ListItemIcon>{an ? <CheckRounded fontSize="small" /> : null}</ListItemIcon>;
  return (
    <>
      <Button variant="outlined" onClick={e => setAnker(e.currentTarget)} aria-haspopup="menu">Ansicht</Button>
      <Menu anchorEl={anker} open={!!anker} onClose={() => setAnker(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <ListSubheader sx={{ lineHeight: '32px' }}>Kacheln</ListSubheader>
        <MenuItem onClick={() => setEinst({ ...einst, zeiten: !einst.zeiten })}>{haken(einst.zeiten)}<ListItemText>Uhrzeiten in den Kacheln</ListItemText></MenuItem>
        {mitAbwesenheiten && <MenuItem onClick={() => setEinst({ ...einst, abwesenheiten: !einst.abwesenheiten })}>{haken(einst.abwesenheiten)}<ListItemText>Abwesenheiten anzeigen</ListItemText></MenuItem>}
        <ListSubheader sx={{ lineHeight: '32px' }}>Pausenaufsichten</ListSubheader>
        {([['normal', 'In der Pause'], ['kompakt', 'Schmal'], ['aus', 'Ausblenden']] as const).map(([w, t]) => (
          <MenuItem key={w} onClick={() => setEinst({ ...einst, aufsichten: w })}>{haken(einst.aufsichten === w)}<ListItemText>{t}</ListItemText></MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={() => { setAnker(null); setTimeout(() => window.print(), 100); }}><ListItemIcon><PrintOutlined fontSize="small" /></ListItemIcon>Drucken</MenuItem>
        <MenuItem onClick={async () => { setAnker(null); try { await navigator.clipboard.writeText(location.href); toast('Link in die Zwischenablage kopiert.'); } catch { window.prompt('Link zum Stundenplan:', location.href); } }}>
          <ListItemIcon><LinkRounded fontSize="small" /></ListItemIcon>Link kopieren</MenuItem>
      </Menu>
    </>
  );
}

interface Kind { id: number; klasse: string; name?: string }

export default function PlanSeite({ teile }: SeitenProps) {
  const s = useSitzung();
  const { ich } = s;
  const t = useTheme();
  const mobil = useMediaQuery(t.breakpoints.down('md'));
  let [typParam, elementParam, datumParam, stundeParam] = teile;
  const el = useLaden(() => s.elemente(), []);
  const kinder = useLaden(async () => (s.familie && (ich.klassen ?? []).length > 1 ? holen<Kind[]>('/api/app/familie/kinder').catch(() => []) : []), []);
  const [einst, setEinstRoh] = useState(() => planEinstellungen(!!s.sitzung.ansicht.kartenZeiten, mobil));
  const setEinst = (e: PlanEinstellungen) => { setEinstRoh(e); schreiben('untplan:planeinstellungen', mobil ? { ...e, ansicht: lesen<{ ansicht?: string }>('untplan:planeinstellungen', {}).ansicht ?? 'woche' } : e); };
  const [fokus, setFokus] = useState<Set<Art>>(() => new Set(lesen<Art[]>('untplan:fokus', [], true)));
  const [hilfe, setHilfe] = useState(false);
  const [legende, setLegende] = useState(false);
  const [details, setDetails] = useState<{ k: Karte; liste: Karte[] } | null>(null);
  const leiste = useRef<HTMLDivElement>(null);
  const [leistenHoehe, setLeistenHoehe] = useState(0);
  useEffect(() => schreiben('untplan:fokus', [...fokus], true), [fokus]);

  // eigener Plan; Eltern mit mehreren Kindern: Klasse des gewählten Kindes
  let meinElement = ich.element, meinKind = 0;
  const kindId = lesen<number>('untplan:kind', 0, true);
  const kind = kindId ? (kinder.daten ?? []).find(x => x.id === kindId) : undefined;
  if (kind) { meinElement = kind.klasse; meinKind = kind.id; }
  const mein = !typParam || typParam === 'mein';
  if (mein && meinElement) { datumParam = istIsoDatum(elementParam) ? elementParam : datumParam; typParam = ich.typ; elementParam = meinElement; }
  const erlaubt: PlanTyp[] = ich.kollegium ? ['klasse', 'lehrer', 'raum'] : ['klasse', 'raum'];
  const typ: PlanTyp = (erlaubt as string[]).includes(typParam) ? typParam as PlanTyp : (ich.typ && (erlaubt as string[]).includes(ich.typ) ? ich.typ as PlanTyp : 'klasse');
  const datum = istIsoDatum(datumParam) ? datumParam : heuteIso();
  const liste = el.daten ? el.daten[LISTE[typ]] : [];
  let element = elementParam && elementParam !== '-' ? elementParam : '';
  if (!element && el.daten) element = typ === ich.typ && ich.element ? ich.element : liste[0]?.kurz ?? '';
  const istMein = mein && typ === ich.typ && !!meinElement && element.toLowerCase() === meinElement.toLowerCase();
  const ziel = (ty: string, x: string, d: string) => `#/plan/${ty}/${encodeURIComponent(x)}/${d}`;
  const zuDatum = (d: string) => navigieren(istMein ? `#/plan/mein/${d}` : ziel(typ, element, d));

  const plan = useLaden(async signal => {
    if (!element || (s.familie && kinder.daten === undefined)) return undefined;
    return holen<Wochenplan>(`/api/app/plan${qs({ typ, element, datum, schueler: istMein && meinKind ? meinKind : undefined })}`, signal);
  }, [typ, element, datum, meinKind, kinder.daten]);

  // Änderungen sofort zeigen: beim Zurückkehren zum Fenster bzw. Tab und alle zwei Minuten neu laden (ohne Ladeanzeige, ohne Cache)
  const planNeu = plan.neu;
  useEffect(() => {
    let zuletzt = Date.now();
    const auffrischen = () => { if (document.visibilityState === 'visible' && Date.now() - zuletzt > 5000) { zuletzt = Date.now(); void planNeu(); } };
    const takt = window.setInterval(() => { if (document.visibilityState === 'visible') { zuletzt = Date.now(); void planNeu(); } }, 120000);
    window.addEventListener('focus', auffrischen);
    document.addEventListener('visibilitychange', auffrischen);
    return () => { window.clearInterval(takt); window.removeEventListener('focus', auffrischen); document.removeEventListener('visibilitychange', auffrischen); };
  }, [planNeu]);

  // Tag der Tagesansicht
  const [tagWahl, setTagWahl] = useState<number | null>(null);
  const tagIndex = useMemo(() => {
    const p = plan.daten;
    if (!p) return 0;
    if (tagWahl !== null && tagWahl < p.tage.length) return tagWahl;
    const i = p.tage.findIndex(x => x.datum === datum);
    return i >= 0 ? i : Math.max(0, p.tage.findIndex(x => x.datum >= heuteIso()));
  }, [plan.daten, datum, tagWahl]);
  useEffect(() => setTagWahl(null), [datum, element]);

  // Alt+←/→ blättert durch die Elemente
  useEffect(() => {
    const f = (ev: KeyboardEvent) => {
      if (!ev.altKey || istMein || (ev.target as HTMLElement)?.closest?.('input, textarea, select')) return;
      const pos = liste.findIndex(x => x.kurz.toLowerCase() === element.toLowerCase());
      const n = ev.key === 'ArrowLeft' ? -1 : ev.key === 'ArrowRight' ? 1 : 0;
      if (n && liste[pos + n]) { ev.preventDefault(); navigieren(ziel(typ, liste[pos + n].kurz, datum)); }
    };
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  });

  // Höhe der Werkzeugleiste (der Tageskopf klebt darunter)
  useEffect(() => {
    if (!leiste.current) return;
    const ro = new ResizeObserver(() => setLeistenHoehe(leiste.current?.offsetHeight ?? 0));
    ro.observe(leiste.current);
    return () => ro.disconnect();
  }, [el.daten]);

  // Link direkt zur Stunde (#/plan/<typ>/<element>/<datum>/<stunde>)
  useEffect(() => {
    const nr = Number(stundeParam);
    const p = plan.daten;
    if (!p || !(nr > 0)) return;
    const k = p.karten.find(x => x.datum === datum && x.von <= nr && x.bis >= nr && x.unterricht);
    if (k) setDetails({ k, liste: p.karten });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.daten]);

  if (el.fehler) return <Fehler fehler={el.fehler} neu={el.neu} />;
  if (!el.daten) return <Laden hoehe={300} />;
  if (!element) return <Seite titel="Stundenplan"><Alert severity="info">Noch keine Stammdaten vorhanden.</Alert></Seite>;

  const aktuell = liste.find(x => x.kurz.toLowerCase() === element.toLowerCase());
  const p = plan.daten;
  const mo = montag(datum);
  const titel = istMein ? 'Mein Stundenplan' : `${TYPEN[typ]} ${element}`;
  const oben = mobil ? 56 : 0;

  return (
    <Seite dokumentTitel={titel}>
      <Box ref={leiste} className="nicht-drucken" sx={{ position: 'sticky', top: oben, zIndex: 8, bgcolor: 'background.default', pt: { xs: 0.5, lg: 0 }, pb: 1, mt: { lg: -1 } }}>
        <Box role="toolbar" aria-label="Stundenplan" sx={{ py: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, rowGap: 1, borderBottom: 1, borderColor: 'divider' }}>
          {istMein ? (
            <Box sx={{ px: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600 }}>{TYPEN[typ]} {element}{kind?.name ? ` · ${kind.name}` : ''}</Typography>
              {aktuell && elementInfo(typ, aktuell) && <Typography variant="caption" color="text.secondary">{elementInfo(typ, aktuell)}</Typography>}
            </Box>
          ) : (
            <ElementWahl liste={liste} wert={element} onWahl={x => navigieren(ziel(typ, x, datum))} platzhalter={`${TYPEN[typ]} wählen`} info={x => elementInfo(typ, x)} breite={mobil ? 200 : 250} />
          )}
          <ZeitNavi datum={einst.ansicht === 'tag' && p ? p.tage[tagIndex]?.datum ?? datum : datum} art={einst.ansicht === 'tag' && mobil ? 'tag' : 'woche'} onDatum={zuDatum} tage={p?.tage.length ?? 5} />
          {!mobil && (
            <ToggleButtonGroup exclusive size="small" value={einst.ansicht} onChange={(_, v) => v && setEinst({ ...einst, ansicht: v })} aria-label="Ansicht">
              <ToggleButton value="woche">Woche</ToggleButton><ToggleButton value="tag">Tag</ToggleButton>
            </ToggleButtonGroup>
          )}
          <Box sx={{ flex: 1 }} />
          <Button variant="outlined" onClick={() => setLegende(true)}>Legende</Button>
          <AnsichtMenue einst={einst} setEinst={setEinst} mitAbwesenheiten={istMein} />
          <Tooltip title="Hilfe zum Stundenplan"><IconButton size="small" onClick={() => setHilfe(true)} aria-label="Hilfe zum Stundenplan"><HelpOutlineRounded fontSize="small" /></IconButton></Tooltip>
        </Box>
        {p && (
          <Stack direction="row" alignItems="flex-end" gap={1.5} flexWrap="wrap" sx={{ mt: 1.5 }}>
            <Box sx={{ minWidth: 0, mr: 1 }}>
              <Typography component="h1" sx={{ fontSize: 20, fontWeight: 600, lineHeight: 1.25 }} noWrap>{TYPEN[typ]} {p.element}{langname(p) ? <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}> · {langname(p)}</Box> : null}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>KW {kalenderwoche(mo)} · {wochenText(mo, p.tage.length)}{p.woche ? ` · ${p.woche}-Woche` : ''}</Typography>
            </Box>
            <Box sx={{ ml: { md: 'auto' } }}><Legende karten={p.karten} typ={typ} fokus={fokus} setFokus={setFokus} /></Box>
          </Stack>
        )}
        {p && einst.ansicht === 'tag' && (
          <ToggleButtonGroup exclusive size="small" value={tagIndex} onChange={(_, v) => v !== null && setTagWahl(v)} aria-label="Tag wählen"
            sx={{ mt: 1, display: 'flex', width: { xs: '100%', md: 'fit-content' }, overflowX: 'auto' }}>
            {p.tage.map((x, i) => {
              const n = p.karten.filter(k => k.datum === x.datum && k.status !== 'regulaer').length;
              return (
                <ToggleButton key={x.datum} value={i} title={n ? `${n} Änderung${n === 1 ? '' : 'en'}` : undefined}
                  sx={{ flex: { xs: 1, md: 'none' }, minWidth: 0, px: { xs: 0.5, md: 1.5 }, gap: 0.5, position: 'relative', fontVariantNumeric: 'tabular-nums', flexDirection: { xs: 'column', sm: 'row' }, lineHeight: 1.2 }}>
                  <Box component="span" sx={{ fontWeight: 600 }}>{wochentagKurz(x.datum)}</Box>
                  <Box component="span" sx={{ fontWeight: 400 }}>{datumKurz(x.datum)}</Box>
                  {n > 0 && <Box component="span" aria-hidden sx={{ position: 'absolute', top: 4, right: 4, width: 5, height: 5, bgcolor: 'status.aenderung.main' }} />}
                </ToggleButton>
              );
            })}
          </ToggleButtonGroup>
        )}
      </Box>
      <Fehler fehler={plan.fehler} neu={plan.neu} />
      {!p ? <Laden hoehe={400} /> : (
        <Paper variant="outlined" sx={{ borderRadius: '4px', overflow: 'visible', opacity: plan.laedt && (p.montag !== mo || p.element.toLowerCase() !== element.toLowerCase()) ? 0.7 : 1, transition: 'opacity .12s' }}>
          <Wochenraster plan={p} onOpen={(k, l) => setDetails({ k, liste: l })}
            optionen={{ nurTag: einst.ansicht === 'tag' ? tagIndex : null, kartenZeiten: einst.zeiten, aufsichten: einst.aufsichten, abwesenheiten: einst.abwesenheiten, fokus, oben: oben + leistenHoehe }} />
        </Paper>
      )}
      <PlanHilfe offen={hilfe} zu={() => setHilfe(false)} />
      <LegendeDialog offen={legende} zu={() => setLegende(false)} />
      {details && <Stundendetails karte={details.k} liste={details.liste} typ={typ} onClose={() => setDetails(null)} onGeaendert={() => void plan.neu()} />}
    </Seite>
  );
}
