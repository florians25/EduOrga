// Reiter „Stunde“ im Fenster „Unterrichtsstunde“: Thema und Inhalt (Lehrstoff mit Lehrform und Anmerkung, Lehrstoff aus Vorwochen),
// Hausaufgaben mit Fälligkeit (direkt anlegen, Vorschlag „nächste Stunde“), Bemerkungen für Schüler*innen und Lehrkräfte – alles wird
// automatisch gespeichert. Rechts: Hinweise zur Stunde (Online, Vertretungstext, Prüfung, Verlegung), Räume und Klassendienste.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Box, Button, ButtonBase, Chip, Collapse, IconButton, ListItemIcon, Menu, MenuItem, Skeleton, Stack, Table, TableBody, TableCell, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import SwapHorizRounded from '@mui/icons-material/SwapHorizRounded';
import { holen, senden } from '../../../api/client';
import type { Wert } from '../../../api/types';
import { datumDe, heuteIso, plusTage, wochentagKurz, zeitstempel } from '../../../lib/datum';
import { toast } from '../../../lib/meldungen';
import { DatumFeld } from '../../Auswahl';
import { Plakette } from '../../Bausteine';
import { RaumListe, neuerRaumFilter, type RaumFilter, type RaumStatus } from '../../RaumListe';
import { istVerlegung, kuerzel, verlegungsRichtung, verlegungsText, type Typ } from '../../plan/logik';
import type { Hausaufgabe } from '../Hausaufgabe';
import { LEHRFORMEN } from '../StundenDialoge';
import { Bereichskarte, Hinweis } from './bausteine';
import type { StundeProps } from './kontext';

type Feld = 'thema' | 'notizSchueler' | 'notiz';

export function ReiterStunde(p: StundeProps & { unterrichtKarte: boolean; mitKlassenbuch: boolean; darfRaum: boolean; online: ReactNode; typ: Typ }) {
  const { k, d, einzel, bereich, kollegium, vormerken, setDialog, liste, unterrichtKarte, mitKlassenbuch, darfRaum, online, typ } = p;
  const darf = !!d.st?.darf;
  const ein = d.st?.eintrag ?? null;
  const ersatz = !!einzel || (d.st?.einzelEintraege?.length ?? 0) > 0;
  // Eingaben bleiben lokal (kein Springen der Schreibmarke); gespeichert wird über vormerken
  const [thema, setThema] = useState(ein?.thema ?? '');
  const [lehrform, setLehrform] = useState(ein?.lehrform ?? '');
  const [anmerkung, setAnmerkung] = useState(ein?.anmerkung ?? '');
  const [notizS, setNotizS] = useState(ein ? ein.notizSchueler ?? '' : ersatz ? '' : k.notizSchueler);
  const [notizL, setNotizL] = useState(ein ? ein.notiz ?? '' : ersatz ? '' : k.notizLehrer);
  const [vor, setVor] = useState<{ datum: string; stunde: number; thema: string }[] | null>(null);
  const [vorAuf, setVorAuf] = useState(false);
  const [raumModus, setRaumModus] = useState<{ art: 'ersetzen' | 'hinzufuegen'; raum: string | null; gewaehlt: string | null } | null>(null);
  const [raumMenue, setRaumMenue] = useState<{ el: HTMLElement; raum: string } | null>(null);

  const einzigeLehrkraft = () => { const l = kuerzel(k.lehrer); return l.length === 1 && !(k.lehrer[0].alt && !k.lehrer[0].k) ? `&lehrer=${encodeURIComponent(l[0])}` : ''; };
  useEffect(() => {
    if (!darf || !k.unterricht) return;
    holen<{ datum: string; stunde: number; thema: string }[]>(`/api/app/klassenbuch/lehrstoff/vorstunden?datum=${k.datum}&stunde=${bereich.von}&unterricht=${k.unterricht}${einzigeLehrkraft()}`)
      .then(setVor).catch(() => setVor([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [darf, k.datum, bereich.von, k.unterricht]);

  // nächste Stunde dieses Unterrichts (Vorschlag für die Fälligkeit)
  const naechste = useMemo(() => liste.filter(x => x.unterricht === k.unterricht && (x.datum > k.datum || (x.datum === k.datum && x.von > k.bis)) && !['entfall', 'abwesend'].includes(x.status))
    .sort((a, b) => a.datum.localeCompare(b.datum) || a.von - b.von)[0]?.datum ?? null, [liste, k]);

  const ebenen = (feld: Feld) => {
    if (einzel) { const w = d.st?.blockEintrag?.[feld]; return w ? <Typography variant="body2" sx={{ mt: 1 }}><Plakette sx={{ mr: 1 }}>Ganzer Block</Plakette>{w}</Typography> : null; }
    const l = (d.st?.einzelEintraege ?? []).filter(x => x[feld]);
    return l.length ? l.map((x, i) => <Typography key={i} variant="body2" sx={{ mt: 1 }}><Plakette sx={{ mr: 1 }}>{x.einzelstunde ?? x.stunde}. Stunde</Plakette>{x[feld]}</Typography>) : null;
  };

  // ------------------------------------------------------------------ Thema und Inhalt
  const themaKarte = unterrichtKarte && (
    <Bereichskarte titel="Thema und Inhalt" rechts={ein?.geaendert && <Typography variant="caption" color="text.secondary">Geändert {zeitstempel(ein.geaendert)}{ein.geaendertVon ? ` · ${ein.geaendertVon}` : ''}</Typography>}>
      {darf ? (
        <Stack gap={2}>
          <TextField label={einzel ? `Thema der ${einzel}. Stunde` : 'Thema / Lehrstoff'} multiline minRows={3} value={thema} placeholder="Was wurde in dieser Stunde behandelt?"
            onChange={e => { setThema(e.target.value); vormerken({ thema: e.target.value }); }} onBlur={() => vormerken({}, true)} slotProps={{ htmlInput: { maxLength: 2000, 'data-feld': 'thema' } }} fullWidth />
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <TextField select label="Lehrform" value={lehrform} onChange={e => { setLehrform(e.target.value); vormerken({ lehrform: e.target.value }, true); }} sx={{ minWidth: 220 }}>
              <MenuItem value="">– keine –</MenuItem>{LEHRFORMEN.map(l => <MenuItem key={l} value={l}>{l}</MenuItem>)}
            </TextField>
            <TextField label="Anmerkung" value={anmerkung} onChange={e => { setAnmerkung(e.target.value); vormerken({ anmerkung: e.target.value }); }} onBlur={() => vormerken({}, true)} fullWidth slotProps={{ htmlInput: { maxLength: 1000 } }} />
          </Stack>
          {ebenen('thema')}
          {vor !== null && (
            <Box>
              <Button size="small" onClick={() => setVorAuf(!vorAuf)} endIcon={<ExpandMoreRounded sx={{ transform: vorAuf ? 'rotate(180deg)' : 'none' }} />} sx={{ ml: -1 }} disabled={!vor.length}>
                {vor.length ? `Lehrstoff aus Vorwochen (${vor.length})` : 'Kein Lehrstoff aus Vorwochen'}
              </Button>
              <Collapse in={vorAuf} unmountOnExit>
                <Table size="small" sx={{ mt: 0.5 }}><TableBody>{vor.map((v, i) => (
                  <TableRow key={i}>
                    <TableCell sx={{ whiteSpace: 'nowrap', width: 120 }}>{wochentagKurz(v.datum)} {datumDe(v.datum)}</TableCell>
                    <TableCell sx={{ width: 40 }}>{v.stunde}.</TableCell>
                    <TableCell sx={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.thema}>{v.thema}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Button size="small" onClick={() => { setThema(v.thema); vormerken({ thema: v.thema }, true); }} title="Lehrstoff übernehmen (ersetzt den Text)">Übernehmen</Button>
                      <Button size="small" onClick={() => { const n = thema.trim() ? `${thema.replace(/\s+$/, '')}\n${v.thema}` : v.thema; setThema(n); vormerken({ thema: n }, true); }} title="Lehrstoff an den Text anhängen">Anhängen</Button>
                    </TableCell>
                  </TableRow>))}</TableBody></Table>
              </Collapse>
            </Box>
          )}
        </Stack>
      ) : (
        <>
          {ein?.thema ? <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{ein.thema}</Typography> : !ebenen('thema') && <Hinweis>{einzel ? 'Kein Lehrstoff für diese Stunde eingetragen.' : 'Kein Lehrstoff eingetragen.'}</Hinweis>}
          {(ein?.lehrform || ein?.anmerkung) && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>{[ein.lehrform && `Lehrform: ${ein.lehrform}`, ein.anmerkung && `Anmerkung: ${ein.anmerkung}`].filter(Boolean).join(' · ')}</Typography>}
          {ebenen('thema')}
        </>
      )}
    </Bereichskarte>
  );

  // ------------------------------------------------------------------ Hausaufgaben
  const hwZeile = (h: Hausaufgabe, darfH: boolean) => (
    <ButtonBase key={h.id} onClick={() => setDialog({ art: 'hw', h, darf: darfH })} sx={{ width: '100%', textAlign: 'left', justifyContent: 'flex-start', gap: 1.5, px: 1.25, py: 1, mb: 0.75, borderRadius: 1.5, border: 1, borderColor: 'divider', bgcolor: 'background.paper', '&:hover': { bgcolor: 'action.hover' } }}>
      <Box sx={{ width: 92, flex: 'none' }}>
        <Typography variant="caption" sx={{ display: 'block', color: h.faellig && h.faellig < heuteIso() && !h.erledigt ? 'status.entfall.main' : 'text.secondary', fontWeight: 600 }}>{h.faellig ? `bis ${wochentagKurz(h.faellig)} ${datumDe(h.faellig).slice(0, 6)}` : 'ohne Fälligkeit'}</Typography>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ textDecoration: h.erledigt ? 'line-through' : 'none', whiteSpace: 'pre-line' }}>{h.text}</Typography>
        {h.bemerkung && <Typography variant="caption" color="text.secondary">{h.bemerkung}</Typography>}
      </Box>
      {h.erledigt && <CheckCircleRounded sx={{ color: 'status.ok.main', fontSize: 18 }} />}
      <ChevronRightRounded sx={{ color: 'text.disabled' }} />
    </ButtonBase>
  );
  const hwKarte = unterrichtKarte && (
    <Bereichskarte titel="Hausaufgaben" zahl={d.hw.liste.length || null}>
      {d.hw.liste.length ? d.hw.liste.map(h => hwZeile(h, d.hw.darf)) : !d.hw.darf && <Hinweis>Keine Hausaufgaben aufgegeben.</Hinweis>}
      {d.hw.darf && <NeueHausaufgabe {...p} naechste={naechste} />}
      {d.hw.faellig.length > 0 && <Box sx={{ mt: 2 }}><Typography variant="subtitle2" sx={{ mb: 0.75 }}>Heute fällig</Typography>{d.hw.faellig.map(h => hwZeile(h, false))}</Box>}
    </Bereichskarte>
  );

  // ------------------------------------------------------------------ Bemerkungen
  const notiz = (feld: 'notizSchueler' | 'notiz', titel: string, wert: string, setWert: (v: string) => void, hinweis: string) => {
    if (!darf) return wert || ebenen(feld) ? <Box><Typography variant="subtitle2" sx={{ mb: 0.5 }}>{titel}</Typography><Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{wert}</Typography>{ebenen(feld)}</Box> : null;
    return (
      <Box>
        <TextField label={titel} multiline minRows={2} fullWidth value={wert} placeholder={einzel ? `Nur für die ${einzel}. Stunde` : hinweis}
          onChange={e => { setWert(e.target.value); vormerken({ [feld]: e.target.value }); }} onBlur={() => vormerken({}, true)} />
        {ebenen(feld)}
      </Box>
    );
  };
  const notizen = unterrichtKarte && [notiz('notizSchueler', 'Bemerkung für Schüler*innen', notizS, setNotizS, 'sichtbar für die Klasse und die Eltern'),
    kollegium ? notiz('notiz', 'Bemerkung für Lehrkräfte', notizL, setNotizL, 'nur für das Kollegium sichtbar') : null].filter(Boolean);
  const bemerkungKarte = notizen && notizen.length > 0 && <Bereichskarte titel="Bemerkungen"><Stack gap={2}>{notizen.map((n, i) => <Box key={i}>{n}</Box>)}</Stack></Bereichskarte>;

  // ------------------------------------------------------------------ Hinweise zur Stunde
  const hinweise: ReactNode[] = [];
  const vertretung = k.text && (k.fach || k.status !== 'veranstaltung') ? k.text : '';
  if (vertretung && k.status !== 'klausur') hinweise.push(<Box key="vt"><Typography variant="subtitle2">{k.fach ? 'Vertretungstext' : 'Bezeichnung'}</Typography><Typography variant="body2">{vertretung}</Typography></Box>);
  if (k.status === 'veranstaltung' && !k.fach && (k.text || k.art)) hinweise.push(<Box key="info"><Typography variant="subtitle2">Information zur Stunde</Typography><Typography variant="body2">{k.text || k.art}</Typography>
    {k.lehrer.length > 3 && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Lehrkräfte: {kuerzel(k.lehrer).join(', ')}</Typography>}</Box>);
  if (k.status === 'klausur') hinweise.push(<Box key="pr"><Typography variant="subtitle2">Prüfung</Typography><Typography variant="body2">{[k.art, k.text].filter(Boolean).join(' – ')}</Typography></Box>);
  if (istVerlegung(k) && k.verlegungVon && k.verlegungNach) hinweise.push(<Box key="vl"><Typography variant="subtitle2">Verlegung</Typography><Typography variant="body2">{verlegungsText(k, verlegungsRichtung(k, typ))}</Typography></Box>);
  const hinweisKarte = hinweise.length > 0 && <Bereichskarte titel="Hinweise zur Stunde"><Stack gap={1.5}>{hinweise}</Stack></Bereichskarte>;

  // ------------------------------------------------------------------ Räume (Raum ersetzen, entfernen, hinzufügen)
  const raeumeNach = (bisher: Wert[], neu: string[]): Wert[] => {
    const entfernt = bisher.filter(w => w.k && !neu.includes(w.k)).map(w => w.alt || w.k);
    let j = 0;
    const res: Wert[] = neu.map(x => bisher.find(w => w.k === x) ?? (() => { const a = entfernt[j++] ?? null; return a === x ? { k: x } : { k: x, alt: a, neu: true }; })());
    for (; j < entfernt.length; j++) res.push({ k: '', alt: entfernt[j], neu: true });
    return res;
  };
  const raumAendern = async (neu: string[], meldung: string) => {
    try {
      await senden('/api/app/meldungen/raumaenderung', { datum: k.datum, stundeVon: k.von, stundeBis: k.bis, unterricht: k.unterricht, raeume: neu });
      p.setK({ ...k, raeume: raeumeNach(k.raeume, neu), status: k.status === 'regulaer' ? 'geaendert' : k.status });
      p.markieren(); toast(meldung); setRaumModus(null);
    } catch (err) { toast((err as Error).message, true); }
  };
  const aktRaeume = kuerzel(k.raeume.filter(w => w.k));
  const raumKarte = darfRaum && (
    <Bereichskarte titel="Räume">
      <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
        {aktRaeume.map(x => <Chip key={x} label={x} onClick={e => setRaumMenue({ el: e.currentTarget, raum: x })} onDelete={e => setRaumMenue({ el: (e.currentTarget as HTMLElement).parentElement!, raum: x })} deleteIcon={<ExpandMoreRounded />} variant="outlined" />)}
        <Tooltip title="Raum hinzufügen"><IconButton size="small" onClick={() => setRaumModus({ art: 'hinzufuegen', raum: null, gewaehlt: null })} aria-label="Raum hinzufügen" sx={{ border: 1, borderColor: 'divider' }}><AddRounded fontSize="small" /></IconButton></Tooltip>
      </Stack>
      <Menu anchorEl={raumMenue?.el} open={!!raumMenue} onClose={() => setRaumMenue(null)}>
        <MenuItem onClick={() => { setRaumModus({ art: 'ersetzen', raum: raumMenue!.raum, gewaehlt: null }); setRaumMenue(null); }}><ListItemIcon><SwapHorizRounded fontSize="small" /></ListItemIcon>Ersetzen</MenuItem>
        <MenuItem onClick={() => { const x = raumMenue!.raum; setRaumMenue(null); void raumAendern(aktRaeume.filter(y => y !== x), `Raum ${x} entfernt.`); }}><ListItemIcon><CloseRounded fontSize="small" /></ListItemIcon>Löschen</MenuItem>
      </Menu>
    </Bereichskarte>
  );

  // ------------------------------------------------------------------ Klassendienste
  const gruppen: { dienst: string; von: string; bis: string; klasse: string; text?: string; schueler: string[] }[] = [];
  for (const z of d.dienste) {
    const g = gruppen.find(x => x.dienst === z.dienst && x.von === z.von && x.bis === z.bis && x.klasse === z.klasse);
    if (g) g.schueler.push(z.schueler); else gruppen.push({ dienst: z.dienst, von: z.von, bis: z.bis, klasse: z.klasse, text: z.text, schueler: [z.schueler] });
  }
  const kl = kuerzel(k.klassen);
  const dienstKarte = mitKlassenbuch && (
    <Bereichskarte titel="Klassendienste" zahl={gruppen.length || null} rechts={kl[0] && <Button size="small" href={`#/dienste/${encodeURIComponent(kl[0])}/alle/liste`}>Einteilung</Button>}>
      {gruppen.length ? <Stack gap={1}>{gruppen.map((g, i) => (
        <Stack key={i} direction="row" gap={1.5} alignItems="baseline" flexWrap="wrap">
          <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 120 }}>{g.dienst}</Typography>
          <Typography variant="body2" sx={{ flex: 1 }}>{g.schueler.join(', ')}</Typography>
          <Typography variant="caption" color="text.secondary">{g.von === g.bis ? datumDe(g.von) : `${datumDe(g.von)} – ${datumDe(g.bis)}`}{new Set(gruppen.map(x => x.klasse)).size > 1 ? ` · ${g.klasse}` : ''}</Typography>
        </Stack>))}</Stack> : <Hinweis>Für diesen Tag ist niemand eingeteilt.</Hinweis>}
    </Bereichskarte>
  );

  if (raumModus) return <RaumWahl k={k} modus={raumModus} setModus={setRaumModus} aendern={raumAendern} />;
  const links = [themaKarte, hwKarte].filter(Boolean);
  const rechts = [online, hinweisKarte, bemerkungKarte, raumKarte, dienstKarte].filter(Boolean);
  if (!links.length && !rechts.length) return <Box sx={{ py: 6, textAlign: 'center' }}><Typography sx={{ fontWeight: 600 }}>Keine weiteren Details</Typography><Hinweis>Zu dieser Stunde gibt es keine zusätzlichen Informationen.</Hinweis></Box>;
  if (!links.length) return <Stack gap={2} sx={{ maxWidth: 760 }}>{rechts.map((x, i) => <Box key={i}>{x}</Box>)}</Stack>;
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.55fr) minmax(0, 1fr)' }, gap: 2, alignItems: 'start' }}>
      <Stack gap={2} sx={{ minWidth: 0 }}>{links.map((x, i) => <Box key={i}>{x}</Box>)}</Stack>
      <Stack gap={2} sx={{ minWidth: 0 }}>{rechts.map((x, i) => <Box key={i}>{x}</Box>)}</Stack>
    </Box>
  );
}

/** Neue Hausaufgabe direkt in der Stunde: Text, Fälligkeit (Vorschlag nächste Stunde bzw. eine Woche), Hinzufügen. */
function NeueHausaufgabe({ k, einzel, hwNeu, naechste }: StundeProps & { naechste: string | null }) {
  const vorschlag = naechste ?? plusTage(k.datum, 7);
  const [text, setText] = useState('');
  const [faellig, setFaellig] = useState<string | null>(vorschlag);
  const [laeuft, setLaeuft] = useState(false);
  const anlegen = async () => {
    if (!text.trim()) { toast('Bitte die Hausaufgabe eingeben.', true); return; }
    setLaeuft(true);
    try {
      await senden('/api/app/klassenbuch/hausaufgabenliste', { datum: k.datum, stunde: k.von, unterricht: k.unterricht, text: text.trim(), faellig: faellig || null, bemerkung: '', ...(einzel ? { einzelstunde: einzel } : {}) });
      setText(''); setFaellig(vorschlag); toast('Hausaufgabe gespeichert.');
      await hwNeu();
    } catch (err) { toast((err as Error).message, true); } finally { setLaeuft(false); }
  };
  const chip = (titel: string, wert: string) => <Chip size="small" label={titel} variant={faellig === wert ? 'filled' : 'outlined'} color={faellig === wert ? 'primary' : 'default'} onClick={() => setFaellig(wert)} sx={{ borderRadius: '6px' }} />;
  return (
    <Box sx={{ mt: 1, p: 1.5, borderRadius: 1.5, border: '1px dashed', borderColor: 'flaechen.rand' }}>
      <TextField label="Neue Hausaufgabe" placeholder="z. B. S. 45 Nr. 3 a–d" fullWidth multiline minRows={1} value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void anlegen(); } }} slotProps={{ htmlInput: { maxLength: 2000 } }} />
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} alignItems={{ sm: 'center' }} sx={{ mt: 1.5 }}>
        <DatumFeld label="Fällig am" wert={faellig} onWert={setFaellig} min={k.datum} />
        <Stack direction="row" gap={0.75} flexWrap="wrap">
          {naechste && chip(`nächste Stunde (${wochentagKurz(naechste)} ${datumDe(naechste).slice(0, 6)})`, naechste)}
          {chip('in einer Woche', plusTage(k.datum, 7))}
        </Stack>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<AddRounded />} onClick={() => void anlegen()} disabled={laeuft || !text.trim()}>Hinzufügen</Button>
      </Stack>
    </Box>
  );
}

function RaumWahl({ k, modus, setModus, aendern }: {
  k: StundeProps['k']; modus: { art: 'ersetzen' | 'hinzufuegen'; raum: string | null; gewaehlt: string | null };
  setModus: (m: { art: 'ersetzen' | 'hinzufuegen'; raum: string | null; gewaehlt: string | null } | null) => void; aendern: (neu: string[], meldung: string) => Promise<void>;
}) {
  const [filter, setFilter] = useState<RaumFilter>(() => neuerRaumFilter(true));
  const [raeume, setRaeume] = useState<RaumStatus[] | null>(null);
  const akt = kuerzel(k.raeume.filter(w => w.k));
  useEffect(() => {
    holen<RaumStatus[]>(`/api/app/buchen/raumstatus?datum=${k.datum}&von=${k.von}&bis=${k.bis}${k.unterricht ? `&unterricht=${k.unterricht}` : ''}`)
      .then(r => setRaeume(r.filter(x => (x.buchbar || x.eigen) && !akt.includes(x.kurz))))
      .catch(err => { toast((err as Error).message, true); setRaeume([]); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);
  return (
    <Bereichskarte titel={modus.art === 'ersetzen' ? `${modus.raum} ersetzen` : 'Raum hinzufügen'} rechts={<>
      <Button size="small" variant="outlined" onClick={() => setModus(null)}>Abbrechen</Button>
      <Button size="small" variant="contained" disabled={!modus.gewaehlt} onClick={() => {
        const g = modus.gewaehlt!;
        const neu = modus.art === 'ersetzen' ? akt.map(x => (x === modus.raum ? g : x)) : [...akt, g];
        void aendern([...new Set(neu)], modus.art === 'ersetzen' ? `${modus.raum} durch ${g} ersetzt.` : `Raum ${g} hinzugefügt.`);
      }}>Speichern</Button></>}>
      {raeume === null ? <Skeleton variant="rounded" height={200} /> : (
        <RaumListe raeume={raeume} gewaehlt={modus.gewaehlt} onWahl={x => setModus({ ...modus, gewaehlt: x })} filter={filter} setFilter={setFilter}
          waehlbar={r => r.frei} zusatz={r => (r.eigen ? <Typography component="span" variant="caption" color="primary" sx={{ ml: 1 }}>ursprünglicher Raum</Typography> : null)}
          leerText="In dieser Zeit ist kein passender buchbarer Raum frei." />
      )}
    </Bereichskarte>
  );
}
