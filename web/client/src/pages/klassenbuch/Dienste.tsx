// Klassenbuch → Klassendienste: Listenansicht (Einteilungen gleicher Dienste und Zeiträume zusammengefasst, Anlegen/Bearbeiten mit
// Mehrfachauswahl, Sammellöschen) und Zeitansicht (Schüler*innen × Wochen zum Ankreuzen, automatische Einteilung reihum), Bericht.
// Adresse: #/dienste/<Klasse|alle>/<Dienst|alle>/<liste|zeit>/<von>/<bis>
import { useEffect, useState } from 'react';
import { Box, Button, Checkbox, Chip, FormControlLabel, IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableFooter, TableHead, TableRow, TextField, Typography } from '@mui/material';
import EditOutlined from '@mui/icons-material/EditOutlined';
import BadgeOutlined from '@mui/icons-material/BadgeOutlined';
import { api, holen, senden } from '../../api/client';
import { useSitzung } from '../../app/sitzung';
import { Geladen, Leer, Seite } from '../../components/Seite';
import { FormDialog, Plakette, SuchFeld, Wahl } from '../../components/Bausteine';
import { DatumFeld } from '../../components/Auswahl';
import { bestaetigen, fehler, toast } from '../../lib/meldungen';
import { datumDe, datumKurz, heuteIso, istIsoDatum, montag, plusTage } from '../../lib/datum';
import { navigieren } from '../../lib/router';
import { useLaden } from '../../lib/useLaden';
import type { SeitenProps } from '../register';

interface Art { id: number; kurz: string; name: string }
interface Zuordnung { id: number; dienstId: number; dienst: string; dienstKurz?: string; schuelerId: number; schueler: string; klasse: string; von: string; bis: string; text: string }
interface Daten { arten: Art[]; zuordnungen: Zuordnung[]; schueler: { id: number; name: string; vorname: string }[]; verwalten: boolean }
interface Gruppe { dienstId: number; dienst: string; von: string; bis: string; klasse: string; text: string; eintraege: Zuordnung[] }

function EinteilenDialog({ d, g, klasse, dienstVorgabe, onClose, fertig }: { d: Daten; g: Gruppe | null; klasse: string; dienstVorgabe?: number; onClose: () => void; fertig: () => void }) {
  const kl = g?.klasse || klasse;
  const [schueler, setSchueler] = useState(d.schueler);
  useEffect(() => { if (!d.schueler.length && kl) holen<Daten['schueler']>(`/api/app/klassenbuch/schueler?klasse=${encodeURIComponent(kl)}`).then(setSchueler).catch(() => undefined); }, [kl, d.schueler]);
  const m = montag(heuteIso());
  const [dienstId, setDienstId] = useState(g?.dienstId ?? dienstVorgabe ?? d.arten[0]?.id ?? 0);
  const [von, setVon] = useState<string | null>(g?.von ?? m);
  const [bis, setBis] = useState<string | null>(g?.bis ?? plusTage(m, 4));
  const [ids, setIds] = useState<Set<number>>(new Set((g?.eintraege ?? []).map(z => z.schuelerId)));
  const [text, setText] = useState(g?.text ?? '');
  const [suche, setSuche] = useState('');
  const alt = new Set((g?.eintraege ?? []).map(z => z.schuelerId));
  return (
    <FormDialog offen titel={g ? 'Einteilung bearbeiten' : `Dienst einteilen · ${kl}`} breite="md" onClose={onClose}
      links={g ? <Button color="error" onClick={async () => { for (const z of g.eintraege) await api(`/api/app/klassendienste/${z.id}`, { methode: 'DELETE' }); toast('Einteilung gelöscht.'); fertig(); onClose(); }}>Löschen</Button> : undefined}
      aktion={async () => {
        if (!ids.size) { toast('Bitte mindestens eine Schülerin bzw. einen Schüler wählen.', true); return false; }
        if (!von || !bis || bis < von) { toast('Das Ende liegt vor dem Beginn.', true); return false; }
        const daten = (sid: number) => ({ dienstId, schuelerId: sid, von, bis, text });
        for (const z of g?.eintraege ?? []) {
          if (ids.has(z.schuelerId)) await senden(`/api/app/klassendienste/${z.id}`, daten(z.schuelerId), 'PUT'); else await api(`/api/app/klassendienste/${z.id}`, { methode: 'DELETE' });
        }
        for (const sid of [...ids].filter(x => !alt.has(x))) await senden('/api/app/klassendienste', daten(sid));
        toast('Gespeichert.'); fertig();
      }}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <TextField select label="Dienst" value={dienstId} onChange={e => setDienstId(Number(e.target.value))} sx={{ flex: 1 }}>{d.arten.map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}</TextField>
          <DatumFeld label="Von" wert={von} onWert={setVon} pflicht /><DatumFeld label="Bis" wert={bis} onWert={setBis} pflicht />
        </Stack>
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><Typography variant="body2" color="text.secondary">Zeitraum:</Typography>
          <Chip label="diese Woche" onClick={() => { setVon(m); setBis(plusTage(m, 4)); }} variant="outlined" />
          <Chip label="nächste Woche" onClick={() => { setVon(plusTage(m, 7)); setBis(plusTage(m, 11)); }} variant="outlined" />
          <Chip label="2 Wochen" onClick={() => { setVon(m); setBis(plusTage(m, 11)); }} variant="outlined" /></Stack>
        <Box>
          <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}><Typography variant="subtitle2">Schüler*innen</Typography>{ids.size > 0 && <Typography variant="caption" color="text.secondary">· {ids.size} gewählt</Typography>}
            <Box sx={{ flex: 1 }} /><SuchFeld wert={suche} onWert={setSuche} platzhalter="Name suchen …" breite={200} /></Stack>
          <Box sx={{ maxHeight: 280, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1.5, p: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 0.5 }}>
            {schueler.filter(x => !suche || `${x.name} ${x.vorname}`.toLowerCase().includes(suche.toLowerCase())).map(x => (
              <FormControlLabel key={x.id} sx={{ m: 0 }} control={<Checkbox size="small" checked={ids.has(x.id)} onChange={() => setIds(s => { const n = new Set(s); if (n.has(x.id)) n.delete(x.id); else n.add(x.id); return n; })} />} label={`${x.name} ${x.vorname}`} />
            ))}
            {!schueler.length && <Typography variant="body2" color="text.secondary">Keine Schülerliste übertragen.</Typography>}
          </Box>
        </Box>
        <TextField label="Text (optional)" value={text} onChange={e => setText(e.target.value)} placeholder="z. B. Tafel wischen, Fenster schließen" slotProps={{ htmlInput: { maxLength: 200 } }} />
      </Stack>
    </FormDialog>
  );
}

function AutoDialog({ klasse, dienst, von, bis, onClose, fertig }: { klasse: string; dienst: Art; von: string; bis: string; onClose: () => void; fertig: () => void }) {
  const [pro, setPro] = useState(2);
  const [v, setV] = useState<string | null>(montag(von));
  const [b, setB] = useState<string | null>(bis);
  return (
    <FormDialog offen titel="Automatische Schülereinteilung" untertitel={`Teilt die Schüler*innen der Klasse ${klasse} reihum (alphabetisch) für „${dienst.name}“ ein. Bestehende Einteilungen ab ${datumDe(montag(von))} werden ersetzt, Ferienwochen übersprungen.`}
      onClose={onClose} aktionText="Einteilen" aktion={async () => {
        const r = await senden<{ eingeteilt: number }>('/api/app/klassendienste/automatisch', { klasse, dienstId: dienst.id, proWoche: pro, von: v, bis: b });
        toast(`${r.eingeteilt} Einteilungen angelegt.`); fertig();
      }}>
      <Stack direction="row" gap={2} sx={{ pt: 0.5 }}>
        <TextField type="number" label="je Woche" value={pro} onChange={e => setPro(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} sx={{ width: 110 }} />
        <DatumFeld label="Von" wert={v} onWert={setV} pflicht /><DatumFeld label="Bis" wert={b} onWert={setB} pflicht />
      </Stack>
    </FormDialog>
  );
}

export default function Dienste({ teile }: SeitenProps) {
  const { ich, elemente, sitzung } = useSitzung();
  const [kP, dP, aP, vP, bP] = teile;
  const liste = aP !== 'zeit';
  const sj = sitzung.schuljahr;
  const von = istIsoDatum(vP) ? vP : montag(heuteIso());
  const bis = istIsoDatum(bP) ? bP : sj?.bis && sj.bis > von ? (plusTage(von, 70) < sj.bis ? plusTage(von, 69) : sj.bis) : plusTage(von, 69);
  const [suche, setSuche] = useState('');
  const [auswahl, setAuswahl] = useState<Set<number>>(new Set());
  const [dialog, setDialog] = useState<null | { art: 'einteilen'; g: Gruppe | null } | { art: 'auto' }>(null);
  const g = useLaden(async () => {
    const el = await elemente();
    const eigene = el.klassen.find(k => ich.element && (k.leitung ?? []).some(l => l.toLowerCase() === ich.element.toLowerCase()))?.kurz;
    const alleKlassen = kP === 'alle' && liste;
    const klasse = alleKlassen ? '' : kP && kP !== '-' && kP !== 'alle' ? kP : eigene ?? el.klassen[0]?.kurz ?? '';
    const d = await holen<Daten>(`/api/app/klassendienste?klasse=${encodeURIComponent(klasse)}&von=${von}&bis=${bis}`);
    return { el, klasse, alleKlassen, d };
  }, [kP, aP, von, bis]);
  return (
    <Geladen g={g}>{({ el, klasse, alleKlassen, d }) => {
      const alleDienste = liste && (!dP || dP === '-' || dP === 'alle');
      const dienst = d.arten.find(a => String(a.id) === dP) ?? d.arten.find(a => a.name === 'Klassenordner') ?? d.arten[0];
      const ziel = (k: string = alleKlassen ? 'alle' : klasse, di: string | number | undefined = alleDienste ? 'alle' : dienst?.id, a = liste ? 'liste' : 'zeit', v = von, b = bis) => `#/dienste/${encodeURIComponent(k || '-')}/${di ?? '-'}/${a}/${v}/${b}`;
      const zuordnungen = d.zuordnungen.filter(z => alleDienste || !dienst || z.dienstId === dienst.id);
      const neu = () => { setAuswahl(new Set()); void g.neu(); };
      const filter = <>
        {liste && <SuchFeld wert={suche} onWert={setSuche} platzhalter="Schüler*in, Dienst oder Text suchen" />}
        <Wahl label="Klasse" wert={liste ? klasse || 'alle' : klasse} onWert={k => navigieren(ziel(k))} optionen={[...(liste ? [['alle', 'Alle Klassen'] as [string, string]] : []), ...el.klassen.map(k => [k.kurz, k.kurz] as [string, string])]} breite={150} />
        <Wahl label="Dienst" wert={alleDienste ? 'alle' : String(dienst?.id ?? '')} onWert={x => navigieren(ziel(undefined, x))} optionen={[...(liste ? [['alle', 'Alle Dienste'] as [string, string]] : []), ...d.arten.map(a => [String(a.id), a.name] as [string, string])]} breite={190} />
        <DatumFeld label="Von" wert={von} onWert={v => v && navigieren(ziel(undefined, undefined, undefined, v))} pflicht />
        <DatumFeld label="Bis" wert={bis} onWert={b => b && navigieren(ziel(undefined, undefined, undefined, von, b))} pflicht />
      </>;
      const aktionen = <>
        <Button variant="outlined" href={liste ? ziel(klasse || el.klassen[0]?.kurz, dienst?.id, 'zeit') : ziel(klasse, dienst?.id, 'liste')}>{liste ? 'Zeitansicht' : 'Listenansicht'}</Button>
        <Button variant="outlined" href={`#/berichte/klassendienste/${encodeURIComponent(klasse || '-')}/${von}/${bis}`}>Bericht</Button>
        {d.verwalten && !liste && dienst && <Button variant="outlined" onClick={() => setDialog({ art: 'auto' })}>Automatische Einteilung</Button>}
        {d.verwalten && liste && <Button variant="contained" onClick={() => setDialog({ art: 'einteilen', g: null })}>Dienst einteilen</Button>}
      </>;
      const heute = heuteIso();
      if (liste) {
        const gruppen: Gruppe[] = [];
        for (const z of zuordnungen) {
          const x = gruppen.find(y => y.dienstId === z.dienstId && y.von === z.von && y.bis === z.bis && y.klasse === z.klasse && y.text === z.text);
          if (x) x.eintraege.push(z); else gruppen.push({ dienstId: z.dienstId, dienst: z.dienst, von: z.von, bis: z.bis, klasse: z.klasse, text: z.text, eintraege: [z] });
        }
        gruppen.sort((a, b) => a.von.localeCompare(b.von) || a.dienst.localeCompare(b.dienst, 'de'));
        const q = suche.toLowerCase();
        const sicht = gruppen.map((x, i) => ({ x, i })).filter(({ x }) => !q || `${x.dienst} ${x.text} ${x.eintraege.map(z => z.schueler).join(' ')}`.toLowerCase().includes(q));
        const darf = d.verwalten || ich.admin;
        return (
          <Seite titel="Klassendienste" untertitel={klasse || 'alle Klassen'} aktionen={aktionen} filter={filter}>
            {!d.arten.length ? <Leer text="Noch keine Dienste angelegt" unter="Die Administration legt Dienste wie Tafeldienst oder Klassenordner unter Stammdaten → Dienste an." />
              : !sicht.length ? <Leer text="Niemand eingeteilt" unter={`Im Zeitraum ${datumDe(von)} – ${datumDe(bis)} ist ${alleDienste ? 'für keinen Dienst' : `für „${dienst?.name ?? ''}“`} jemand eingeteilt.`} />
              : (
                <Paper variant="outlined" sx={{ borderRadius: 1.5, overflow: 'hidden' }}>
                  <Box sx={{ overflowX: 'auto' }}><Table>
                    <TableHead><TableRow>{darf && <TableCell padding="checkbox"><Checkbox size="small" checked={auswahl.size === sicht.length} onChange={e => setAuswahl(e.target.checked ? new Set(sicht.map(s => s.i)) : new Set())} inputProps={{ 'aria-label': 'Alle auswählen' }} /></TableCell>}
                      <TableCell>Dienst</TableCell><TableCell>Schüler*innen</TableCell><TableCell>Zeitraum</TableCell><TableCell>Text</TableCell>{darf && <TableCell />}</TableRow></TableHead>
                    <TableBody>{sicht.map(({ x, i }) => {
                      const phase = x.bis < heute ? ['vorbei', 'neutral'] as const : x.von > heute ? ['geplant', 'primaer'] as const : ['aktuell', 'ok'] as const;
                      return (
                        <TableRow key={i} hover selected={auswahl.has(i)} sx={{ opacity: x.bis < heute ? 0.65 : 1 }}>
                          {darf && <TableCell padding="checkbox"><Checkbox size="small" checked={auswahl.has(i)} onChange={() => setAuswahl(s => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })} inputProps={{ 'aria-label': 'auswählen' }} /></TableCell>}
                          <TableCell><Stack direction="row" gap={1.25} alignItems="center"><BadgeOutlined color="action" /><Box><Typography variant="body2" sx={{ fontWeight: 600 }}>{x.dienst}</Typography>{!klasse && <Typography variant="caption" color="text.secondary">Klasse {x.klasse}</Typography>}</Box></Stack></TableCell>
                          <TableCell><Stack direction="row" gap={0.5} flexWrap="wrap">{x.eintraege.map(z => <Chip key={z.id} size="small" label={z.schueler} variant="outlined" />)}</Stack></TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}><Typography variant="body2">{x.von === x.bis ? datumDe(x.von) : `${datumKurz(x.von)} – ${datumDe(x.bis)}`}</Typography><Plakette ton={phase[1]}>{phase[0]}</Plakette></TableCell>
                          <TableCell>{x.text || <Typography component="span" color="text.disabled">–</Typography>}</TableCell>
                          {darf && <TableCell align="right"><IconButton size="small" onClick={() => setDialog({ art: 'einteilen', g: x })} aria-label="Bearbeiten"><EditOutlined fontSize="small" /></IconButton></TableCell>}
                        </TableRow>
                      );
                    })}</TableBody>
                  </Table></Box>
                  {darf && <Stack direction="row" alignItems="center" sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>{sicht.length} {sicht.length === 1 ? 'Einteilung' : 'Einteilungen'}</Typography>
                    <Button color="error" variant="outlined" size="small" disabled={!auswahl.size} onClick={async () => {
                      const ids = [...auswahl].flatMap(i => gruppen[i].eintraege.map(z => z.id));
                      if (!(await bestaetigen('Einteilungen löschen', `${ids.length} ${ids.length === 1 ? 'Einteilung' : 'Einteilungen'} löschen?`))) return;
                      try { for (const id of ids) await api(`/api/app/klassendienste/${id}`, { methode: 'DELETE' }); toast('Gelöscht.'); } catch (err) { fehler(err); }
                      neu();
                    }}>Auswahl löschen</Button></Stack>}
                </Paper>
              )}
            {!d.verwalten && klasse && <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Einteilen kann die Klassenleitung bzw. die Schulleitung.</Typography>}
            {dialog?.art === 'einteilen' && <EinteilenDialog d={d} g={dialog.g} klasse={klasse || el.klassen[0]?.kurz || ''} dienstVorgabe={alleDienste ? undefined : dienst?.id} onClose={() => setDialog(null)} fertig={neu} />}
          </Seite>
        );
      }
      const wochen: string[] = [];
      for (let w = montag(von); w <= bis && wochen.length < 60; w = plusTage(w, 7)) wochen.push(w);
      const aktiv = (sid: number, w: string) => zuordnungen.some(z => z.schuelerId === sid && z.von <= plusTage(w, 6) && z.bis >= w);
      return (
        <Seite titel={klasse && dienst ? `Klassendienste: ${klasse} | ${dienst.name}` : 'Klassendienste'} aktionen={aktionen} filter={filter}>
          {!klasse ? <Leer text="Keine Klassen vorhanden." /> : !dienst ? <Leer text="Es sind noch keine Dienste angelegt (Stammdaten → Dienste)." /> : !d.schueler.length ? <Leer text="Für diese Klasse wurde keine Schülerliste aus EduOrga Studio übertragen." /> : (
            <Paper variant="outlined" sx={{ borderRadius: 1.5, overflow: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead><TableRow><TableCell sx={{ position: 'sticky', left: 0, zIndex: 3 }}>Schüler*in</TableCell>{wochen.map(w => <TableCell key={w} align="center" title={`Woche ab ${datumDe(w)}`}>{datumKurz(w)}</TableCell>)}<TableCell align="center">Σ</TableCell></TableRow></TableHead>
                <TableBody>{d.schueler.map(s => (
                  <TableRow key={s.id} hover>
                    <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'background.paper', whiteSpace: 'nowrap', fontWeight: 500 }}>{s.name} {s.vorname}</TableCell>
                    {wochen.map(w => (
                      <TableCell key={w} align="center" padding="checkbox"><Checkbox size="small" checked={aktiv(s.id, w)} disabled={!d.verwalten} inputProps={{ 'aria-label': `${s.vorname} ${s.name} Woche ${datumDe(w)}` }}
                        onChange={async e => { try { await senden('/api/app/klassendienste/woche', { dienstId: dienst.id, schuelerId: s.id, datum: w, an: e.target.checked }); void g.neu(); } catch (err) { fehler(err); } }} /></TableCell>
                    ))}
                    <TableCell align="center" sx={{ fontWeight: 600 }}>{wochen.filter(w => aktiv(s.id, w)).length || ''}</TableCell>
                  </TableRow>
                ))}</TableBody>
                <TableFooter><TableRow><TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'background.paper' }}>Summe</TableCell>{wochen.map(w => <TableCell key={w} align="center">{d.schueler.filter(s => aktiv(s.id, w)).length || ''}</TableCell>)}<TableCell /></TableRow></TableFooter>
              </Table>
            </Paper>
          )}
          {!d.verwalten && <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>Einteilen kann die Klassenleitung bzw. die Schulleitung.</Typography>}
          {dialog?.art === 'auto' && dienst && <AutoDialog klasse={klasse} dienst={dienst} von={von} bis={bis} onClose={() => setDialog(null)} fertig={() => void g.neu()} />}
        </Seite>
      );
    }}</Geladen>
  );
}
