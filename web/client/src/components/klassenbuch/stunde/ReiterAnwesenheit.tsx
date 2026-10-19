// Reiter „Anwesenheit“ im Fenster „Unterrichtsstunde“: schnelle Liste (je Schüler*in Anwesend / Abwesend / Verspätet / Früher weg mit
// Minuten, Entschuldigungsstatus, Hinweise) oder Sitzplan (Klick = anwesend/abwesend), Mehrfachauswahl für Abwesenheit mit Zeitraum und
// Klassenbucheintrag, gemeldete Abwesenheiten der Eltern, Abwesenheiten aus der Vorstunde und Befreiungen. Jede Änderung wird sofort
// gespeichert (Reihenfolge bleibt erhalten); „Anwesenheit bestätigen“ schließt die Kontrolle ab.
import { useEffect, useRef, useState } from 'react';
import { alpha, Box, Button, Checkbox, IconButton, InputAdornment, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import CheckRounded from '@mui/icons-material/CheckRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import AccessTimeRounded from '@mui/icons-material/AccessTimeRounded';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import EditOutlined from '@mui/icons-material/EditOutlined';
import { senden } from '../../../api/client';
import { datumDe, heuteIso, jetztMinuten, minuten, zeitstempel } from '../../../lib/datum';
import { toast } from '../../../lib/meldungen';
import { Plakette } from '../../Bausteine';
import { kbEinstellungenSpeichern, nameZeilen, sortieren, SitzplanAnordnung, darfIrgendwas, type Schueler } from '../sitzplan';
import type { Fehlzeit } from '../StundenDialoge';
import { Bereichskarte, Hinweis } from './bausteine';
import type { AnwesenheitMit, Fz, StundeProps } from './kontext';

type Status = 'da' | 'fehlt' | 'verspaetet' | 'vorzeitig';
const STATUS_TEXT: Record<string, [string, 'pruefung' | 'ok' | 'entfall']> = { offen: ['offen', 'pruefung'], entschuldigt: ['entschuldigt', 'ok'], unentschuldigt: ['nicht entschuldigt', 'entfall'] };

const fzAus = (a: AnwesenheitMit | null) => new Map<number, Fz>((a?.fehlzeiten ?? []).map(f => [f.schuelerId, { art: f.art, minuten: f.minuten, bemerkung: f.text ?? f.bemerkung, grund: f.grund, von: f.beginn || null, bis: f.ende || null }]));
const statusVon = (f?: Fz | Fehlzeit | null): Status => (!f ? 'da' : f.art === 'verspaetet' ? 'verspaetet' : f.art === 'vorzeitig' ? 'vorzeitig' : 'fehlt');

/** Anwesenheit kontrollieren: ab Stundenbeginn (Server: nicht im Voraus). */
export function kannKontrollieren(p: Pick<StundeProps, 'k' | 'bereich'>, a: AnwesenheitMit | null) {
  const jetzt = jetztMinuten();
  return !!a?.darf && (p.k.datum < heuteIso() || (p.k.datum === heuteIso() && (!p.bereich.beginn || minuten(p.bereich.beginn) <= jetzt)));
}

/** Anwesenheit der Stunde speichern (ersetzt die Fehlzeiten der Stunde und vermerkt die Kontrolle). */
export async function anwesenheitSenden(p: Pick<StundeProps, 'k' | 'einzel'>, m: Map<number, Fz>) {
  const eintraege = [...m].map(([schuelerId, f]) => ({ schuelerId, art: f.art, minuten: f.minuten || 5, bemerkung: f.bemerkung ?? '', grund: f.grund ?? '', restTag: null, von: f.von ?? null, bis: f.bis ?? null }));
  await senden('/api/app/klassenbuch/anwesenheit', { datum: p.k.datum, stunde: p.k.von, unterricht: p.k.unterricht, eintraege, ...(p.einzel ? { einzelstunde: p.einzel } : {}) }, 'PUT');
}

export function ReiterAnwesenheit(p: StundeProps & { onSpeichern: (z: 'speichert' | 'gespeichert' | 'fehler', text?: string) => void }) {
  const { k, d, einzel, kbw, setKbw, setDialog, anwNeu, onSpeichern } = p;
  const t = useTheme();
  const schmal = useMediaQuery(t.breakpoints.down('md'));
  const a = d.anw;
  const aRef = useRef(a);
  useEffect(() => { aRef.current = a; }, [a]);
  const [auswahl, setAuswahl] = useState<Set<number>>(new Set());
  // Änderungen, die noch unterwegs sind (sofort sichtbar, gespeichert der Reihe nach)
  const [ueber, setUeber] = useState<Map<number, Fz | null>>(new Map());
  const ueberRef = useRef(ueber);
  const offen = useRef(0);
  const kette = useRef<Promise<void>>(Promise.resolve());
  const [minutenEntwurf, setMinutenEntwurf] = useState<Record<number, string>>({});
  const minTimer = useRef<Record<number, number>>({});

  if (!a) return <Bereichskarte titel="Anwesenheit"><Hinweis>Die Anwesenheit kann nicht geladen werden.</Hinweis></Bereichskarte>;
  const sl = sortieren(a.schueler ?? [], kbw);
  const darf = !!a.darf;
  const zukunft = k.datum > heuteIso();
  const bedienbar = darf && !zukunft;
  const basis = fzAus(a);
  for (const [id, f] of ueber) { if (f) basis.set(id, f); else basis.delete(id); }
  const fzVon = (id: number) => basis.get(id) ?? null;
  const server = (id: number) => (a.fehlzeiten ?? []).find(f => f.schuelerId === id);
  const name = (id: number) => { const x = a.schueler.find(y => y.id === id); return x ? `${x.vorname} ${x.name}` : ''; };
  const meldungen = (a.meldungen ?? []).filter(m => a.schueler.some(x => x.id === m.schuelerId));

  const setzen = (aenderungen: [number, Fz | null][]) => {
    const n = new Map(ueberRef.current);
    for (const [id, f] of aenderungen) n.set(id, f);
    ueberRef.current = n; setUeber(n);
    offen.current++;
    onSpeichern('speichert');
    kette.current = kette.current.then(async () => {
      const m = fzAus(aRef.current);
      for (const [id, f] of ueberRef.current) { if (f) m.set(id, f); else m.delete(id); }
      await anwesenheitSenden(p, m);
    }).then(async () => {
      offen.current--;
      if (offen.current === 0) { await anwNeu(); ueberRef.current = new Map(); setUeber(new Map()); onSpeichern('gespeichert'); }
    }, async err => {
      offen.current--;
      toast((err as Error).message, true); onSpeichern('fehler', (err as Error).message);
      if (offen.current === 0) { await anwNeu().catch(() => undefined); ueberRef.current = new Map(); setUeber(new Map()); }
    });
  };
  const statusSetzen = (id: number, st: Status) => {
    const alt = fzVon(id);
    if (st === 'da') setzen([[id, null]]);
    else setzen([[id, { ...(alt ?? {}), art: st, minuten: st === 'fehlt' ? 0 : alt && alt.art === st ? alt.minuten : 5, von: null, bis: null }]]);
  };
  const minutenSetzen = (id: number, wert: string, sofort = false) => {
    setMinutenEntwurf(x => ({ ...x, [id]: wert }));
    window.clearTimeout(minTimer.current[id]);
    const los = () => {
      const n = Math.max(1, Math.min(240, Math.round(Number(wert) || 0)));
      const alt = fzVon(id);
      if (alt && n !== alt.minuten) setzen([[id, { ...alt, minuten: n, von: null, bis: null }]]);
      setMinutenEntwurf(x => { const y = { ...x }; delete y[id]; return y; });
    };
    if (sofort) los(); else minTimer.current[id] = window.setTimeout(los, 800);
  };
  const verlaengern = async (ids: number[]) => {
    try {
      onSpeichern('speichert');
      await senden('/api/app/klassenbuch/abwesenheit/verlaengern', { datum: k.datum, stunde: k.von, unterricht: k.unterricht, schuelerIds: ids, bis: 'stunde', ...(einzel ? { einzelstunde: einzel } : {}) });
      await anwNeu(); onSpeichern('gespeichert'); toast('Abwesenheit bis Stundenende übernommen.');
    } catch (err) { toast((err as Error).message, true); onSpeichern('fehler', (err as Error).message); }
  };
  const umschalten = (id: number) => setAuswahl(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const zahl = { fehlt: 0, verspaetet: 0, vorzeitig: 0 };
  for (const x of sl) { const st = statusVon(fzVon(x.id)); if (st !== 'da') zahl[st]++; }
  const anwesend = sl.length - zahl.fehlt;

  // ------------------------------------------------------------------ Hinweise (Meldungen, Vorstunde, Befreiungen)
  const vorstunde = (a.vorstunden ?? []).filter((f, i, l) => l.findIndex(y => y.schuelerId === f.schuelerId) === i && !fzVon(f.schuelerId));
  const befreit = sl.filter(x => d.befreit.has(x.id));
  const hinweise = (meldungen.length > 0 || vorstunde.length > 0 || befreit.length > 0) && (
    <Stack gap={1} sx={{ mb: 2 }}>
      {meldungen.map(m => {
        const da = statusVon(fzVon(m.schuelerId)) === 'da';
        return (
          <Stack key={m.id} direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }} sx={{ px: 1.5, py: 1, borderRadius: 1, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
            <Plakette ton="frei">{m.status === 'bestaetigt' ? 'Gemeldet · bestätigt' : 'Gemeldet'}</Plakette>
            <Typography variant="body2" sx={{ flex: 1 }}><b>{name(m.schuelerId)}</b> – {m.von === m.bis ? datumDe(m.von) : `${datumDe(m.von)} bis ${datumDe(m.bis)}`}{m.grund ? ` · Grund ${m.grund}` : ''}{m.text ? ` · ${m.text}` : ''}
              <Typography component="span" variant="caption" color="text.secondary"> · gemeldet {zeitstempel(m.gemeldet)}</Typography></Typography>
            {bedienbar && da && <Button size="small" variant="outlined" onClick={() => setzen([[m.schuelerId, { art: 'fehlt', minuten: 0, grund: m.grund, bemerkung: 'laut Abwesenheitsmeldung' }]])}>Als abwesend eintragen</Button>}
          </Stack>
        );
      })}
      {vorstunde.length > 0 && (
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }} sx={{ px: 1.5, py: 1, borderRadius: 1, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Plakette ton="warnung">Vorstunde</Plakette>
          <Typography variant="body2" sx={{ flex: 1 }}>In einer früheren Stunde heute abwesend: <b>{vorstunde.map(f => name(f.schuelerId)).join(', ')}</b></Typography>
          {bedienbar && <Button size="small" variant="outlined" onClick={() => void verlaengern(vorstunde.map(f => f.schuelerId))}>Für diese Stunde übernehmen</Button>}
        </Stack>
      )}
      {befreit.length > 0 && (
        <Stack direction="row" gap={1} alignItems="center" sx={{ px: 1.5, py: 1, borderRadius: 1, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Plakette>Befreit</Plakette>
          <Typography variant="body2">Vom Unterricht befreit: <b>{befreit.map(x => `${x.vorname} ${x.name}`).join(', ')}</b></Typography>
        </Stack>
      )}
    </Stack>
  );

  // ------------------------------------------------------------------ Liste
  const segment = (x: Schueler) => {
    const st = statusVon(fzVon(x.id));
    const farbe = (v: Status) => (v === 'fehlt' ? t.palette.status.entfall.main : t.palette.status.pruefung.main);
    // Desktop: nur Text. Schmal: Symbol für die nicht gewählten Zustände (Platz), Text für den gewählten.
    // „Anwesend“ gewählt = neutral (Normalfall, keine Farbe); nur Abweichungen tragen die Statusfarbe.
    const knopf = (v: Status, text: string, symbol: React.ReactNode) => (
      <ToggleButton value={v} aria-label={`${x.vorname} ${x.name}: ${text}`} sx={{ px: schmal ? 1 : 1.25, minWidth: schmal ? 0 : 76, fontSize: 12.5,
        '&.Mui-selected, &.Mui-selected:hover': v === 'da' ? { bgcolor: 'action.selected', color: 'text.primary' } : { bgcolor: alpha(farbe(v), 0.1), color: farbe(v) } }}>
        {schmal && v !== st ? symbol : text}
      </ToggleButton>
    );
    return (
      <ToggleButtonGroup exclusive size="small" value={st} disabled={!bedienbar} onChange={(_, v) => v && v !== st && statusSetzen(x.id, v)}>
        {knopf('da', 'Anwesend', <CheckRounded sx={{ fontSize: 16 }} />)}
        {knopf('fehlt', 'Abwesend', <CloseRounded sx={{ fontSize: 16 }} />)}
        {knopf('verspaetet', 'Verspätet', <AccessTimeRounded sx={{ fontSize: 16 }} />)}
        {knopf('vorzeitig', 'Früher weg', <LogoutRounded sx={{ fontSize: 16 }} />)}
      </ToggleButtonGroup>
    );
  };
  const zeile = (x: Schueler) => {
    const f = fzVon(x.id), sf = server(x.id), st = statusVon(f);
    const [z1, z2] = nameZeilen(x, kbw);
    const stt = sf?.status ? STATUS_TEXT[sf.status] : null;
    const gemeldet = meldungen.find(m => m.schuelerId === x.id);
    const an = auswahl.has(x.id);
    return (
      <Box key={x.id} role="row" sx={{ display: 'grid', gridTemplateColumns: schmal ? '36px minmax(0, 1fr) auto' : '36px minmax(170px, 1.1fr) auto 96px minmax(120px, 1fr) 40px', alignItems: 'center', columnGap: 1, rowGap: 0.75,
        px: 1, py: 0.5, borderBottom: 1, borderColor: 'divider', bgcolor: an ? 'action.selected' : st === 'fehlt' ? alpha(t.palette.status.entfall.main, 0.04) : 'transparent' }}>
        <Checkbox size="small" checked={an} onChange={() => umschalten(x.id)} disabled={!darf} inputProps={{ 'aria-label': `${x.vorname} ${x.name} auswählen` }} />
        <Stack direction="row" alignItems="center" sx={{ minWidth: 0, opacity: d.befreit.has(x.id) ? 0.6 : 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.25 }}>{z1} {z2}</Typography>
            {(kbw.klasseZeigen && x.klasse) || d.befreit.has(x.id) || gemeldet ? <Typography noWrap sx={{ fontSize: 11.5, color: 'text.secondary' }}>{[kbw.klasseZeigen && x.klasse, d.befreit.has(x.id) && 'befreit', gemeldet && 'Abwesenheit gemeldet'].filter(Boolean).join(' · ')}</Typography> : null}
          </Box>
        </Stack>
        {schmal ? <Box sx={{ gridColumn: '3', justifySelf: 'end' }}>{darf && <IconButton size="small" onClick={() => setDialog({ art: 'abw', ids: [x.id], f: sf ?? null })} aria-label={`Abwesenheit von ${x.vorname} ${x.name} bearbeiten`}><EditOutlined fontSize="small" /></IconButton>}</Box> : null}
        <Box sx={schmal ? { gridColumn: '2 / span 2', overflowX: 'auto' } : {}}>{segment(x)}</Box>
        {(!schmal || st === 'verspaetet' || st === 'vorzeitig' || stt) && (
          <Box sx={schmal ? { gridColumn: '2 / span 2', display: 'flex', gap: 1, alignItems: 'center' } : {}}>
            {(st === 'verspaetet' || st === 'vorzeitig') ? (
              <TextField size="small" type="number" value={minutenEntwurf[x.id] ?? String(f?.minuten ?? 5)} disabled={!bedienbar} onChange={e => minutenSetzen(x.id, e.target.value)} onBlur={e => minutenEntwurf[x.id] !== undefined && minutenSetzen(x.id, e.target.value, true)}
                slotProps={{ htmlInput: { min: 1, max: 240, 'aria-label': `Minuten ${x.vorname} ${x.name}` }, input: { endAdornment: <InputAdornment position="end">min</InputAdornment> } }} sx={{ width: 96 }} />
            ) : schmal ? null : <Box />}
            {schmal && stt && <Plakette ton={stt[1]}>{stt[0]}</Plakette>}
          </Box>
        )}
        {!schmal && <Box sx={{ minWidth: 0 }}>{stt && st !== 'da' ? <Plakette ton={stt[1]}>{stt[0]}</Plakette> : null}{sf?.grund ? <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>{sf.grund}</Typography> : null}</Box>}
        {!schmal && <Box>{darf && <Tooltip title="Abwesenheit mit Zeitraum, Grund und Status"><IconButton size="small" onClick={() => setDialog({ art: 'abw', ids: [x.id], f: sf ?? null })} aria-label={`Abwesenheit von ${x.vorname} ${x.name} bearbeiten`}><EditOutlined fontSize="small" /></IconButton></Tooltip>}</Box>}
      </Box>
    );
  };

  // ------------------------------------------------------------------ Sitzplan
  const kachel = (x: Schueler) => {
    const f = fzVon(x.id), st = statusVon(f);
    const ton = st === 'da' ? t.palette.status.ok.main : st === 'fehlt' ? t.palette.status.entfall.main : t.palette.status.pruefung.main;
    const [z1, z2] = nameZeilen(x, kbw);
    const titel = st === 'da' ? 'anwesend' : st === 'fehlt' ? 'abwesend' : st === 'verspaetet' ? `verspätet (${f!.minuten} min)` : `früher gegangen (${f!.minuten} min)`;
    return (
      <Tooltip key={x.id} title={`${titel}${bedienbar ? ' – klicken zum Umschalten' : ''}`}>
        <Box role="button" tabIndex={0} aria-label={`${x.vorname} ${x.name}: ${titel}`} onClick={() => bedienbar && statusSetzen(x.id, st === 'da' ? 'fehlt' : 'da')}
          onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && bedienbar) { e.preventDefault(); statusSetzen(x.id, st === 'da' ? 'fehlt' : 'da'); } }}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.75, borderRadius: 1, cursor: bedienbar ? 'pointer' : 'default', userSelect: 'none', minWidth: 0,
            border: 1, borderColor: st === 'da' ? 'divider' : alpha(ton, 0.5), bgcolor: st === 'fehlt' ? 'status.entfall.flaeche' : st !== 'da' ? 'status.pruefung.flaeche' : 'background.paper', opacity: d.befreit.has(x.id) && st === 'da' ? 0.6 : 1 }}>
          <Box sx={{ minWidth: 0, lineHeight: 1.2 }}>
            <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 500 }}>{z1}</Typography>
            <Typography noWrap sx={{ fontSize: 11.5, color: st === 'da' ? 'text.secondary' : ton }}>{st === 'da' ? z2 : `${z2 ? `${z2} · ` : ''}${st === 'fehlt' ? 'abwesend' : `${st === 'verspaetet' ? '+' : '−'}${f!.minuten} min`}`}</Typography>
          </Box>
        </Box>
      </Tooltip>
    );
  };

  const ansicht = kbw.ansicht === 'sitzplan' ? 'sitzplan' : 'liste';
  const kopf = (
    <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="center" sx={{ mb: 1.5 }}>
      <ToggleButtonGroup exclusive size="small" value={ansicht} onChange={(_, v) => { if (v) { const n = { ...kbw, ansicht: v }; kbEinstellungenSpeichern(n); setKbw(n); } }} aria-label="Darstellung">
        <ToggleButton value="liste">Liste</ToggleButton><ToggleButton value="sitzplan">Sitzplan</ToggleButton>
      </ToggleButtonGroup>
      <Stack direction="row" gap={2} sx={{ fontSize: 13 }} aria-live="polite">
        <Typography variant="body2"><b>{anwesend}</b>/{sl.length} anwesend</Typography>
        {zahl.fehlt > 0 && <Typography variant="body2" sx={{ color: 'status.entfall.main' }}><b>{zahl.fehlt}</b> abwesend</Typography>}
        {zahl.verspaetet > 0 && <Typography variant="body2" sx={{ color: 'status.pruefung.main' }}><b>{zahl.verspaetet}</b> verspätet</Typography>}
        {zahl.vorzeitig > 0 && <Typography variant="body2" sx={{ color: 'status.pruefung.main' }}><b>{zahl.vorzeitig}</b> früher weg</Typography>}
      </Stack>
      <Box sx={{ flex: 1 }} />
      {a.geprueft && <Typography variant="body2" color="text.secondary">Kontrolliert{a.geprueft.length > 10 ? ` ${zeitstempel(a.geprueft)}` : ''}</Typography>}
      {ansicht === 'sitzplan' && darfIrgendwas(d.sitz) && <Button size="small" variant="outlined" onClick={() => setDialog({ art: 'sitz' })}>{d.sitz?.gueltig ? 'Sitzplan bearbeiten' : 'Sitzplan erstellen'}</Button>}
    </Stack>
  );
  const sammel = darf && auswahl.size > 0 && (
    <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center" sx={{ position: 'sticky', bottom: 0, zIndex: 2, mt: 1.5, p: 1, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Typography variant="body2" sx={{ fontWeight: 500, mr: 1 }}>{auswahl.size} ausgewählt</Typography>
      <Button size="small" variant="contained" color="error" disabled={!bedienbar} onClick={() => { setzen([...auswahl].map(id => [id, { ...(fzVon(id) ?? {}), art: 'fehlt', minuten: 0, von: null, bis: null }])); setAuswahl(new Set()); }}>Abwesend</Button>
      <Button size="small" variant="outlined" onClick={() => setDialog({ art: 'abw', ids: [...auswahl], f: null })}>Abwesenheit mit Zeitraum …</Button>
      <Button size="small" variant="outlined" onClick={() => setDialog({ art: 'eintrag', ids: [...auswahl] })}>Klassenbucheintrag …</Button>
      <Button size="small" onClick={() => setAuswahl(new Set())}>Auswahl aufheben</Button>
    </Stack>
  );

  return (
    <Box>
      {hinweise}
      <Bereichskarte titel={schmal ? 'Schüler*innen' : 'Schüler*innen im Unterricht'} zahl={sl.length} rechts={darf && sl.length > 0 && ansicht === 'liste' && (
        <Button size="small" sx={{ whiteSpace: 'nowrap' }} onClick={() => setAuswahl(auswahl.size === sl.length ? new Set() : new Set(sl.map(x => x.id)))}>{auswahl.size === sl.length ? 'Keine auswählen' : 'Alle auswählen'}</Button>)}>
        {!sl.length ? <Hinweis>Für diese Klasse wurde keine Schülerliste aus EduOrga Studio übertragen (EduOrga Studio → EduOrga Web → Einstellungen → „Schülerliste übertragen“).</Hinweis> : (
          <>
            {kopf}
            {zukunft && <Typography variant="body2" sx={{ mb: 1.5, color: 'text.secondary' }}>Die Anwesenheit wird ab dem Tag der Stunde erfasst.</Typography>}
            {!darf && <Typography variant="body2" sx={{ mb: 1.5, color: 'text.secondary' }}>Nur Anzeige – die Anwesenheit erfasst die Lehrkraft der Stunde bzw. die Klassenleitung.</Typography>}
            {ansicht === 'sitzplan' ? (d.sitz?.gueltig ? <SitzplanAnordnung d={d.sitz} schueler={sl} kachel={kachel} w={kbw} />
              : <Box sx={{ py: 1 }}><Typography variant="body2">Für diese Stunde ist noch kein Sitzplan hinterlegt.{darfIrgendwas(d.sitz) ? ' Legen Sie ihn mit „Sitzplan erstellen“ an.' : ''}</Typography></Box>)
              : <Box role="table" aria-label="Anwesenheit" sx={{ mx: -1, borderTop: 1, borderColor: 'divider' }}>{sl.map(zeile)}</Box>}
            {sammel}
          </>
        )}
      </Bereichskarte>
    </Box>
  );
}
