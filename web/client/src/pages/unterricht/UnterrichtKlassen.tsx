// Unterricht → Unterricht Klassen: Unterrichte einer Klasse im Zeitraum (U-Nr, Klassen, Schülergruppe, Lehrkräfte, Fach, Stunden, Termine,
// Schüler*innen, Schülergruppen, Berichte). Schülergruppen eines Unterrichts mit Teilnahmezeitraum je Schüler*in (Abmeldung ab Datum),
// befristeter Unterrichtswechsel als Assistent (Zeitraum → Schüler*innen → Zielklasse → Unterrichte) und Klassenwechsel ab Datum.
import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Stack, Step, StepLabel, Stepper,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import AssessmentOutlined from '@mui/icons-material/AssessmentOutlined';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import EditOutlined from '@mui/icons-material/EditOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import PersonOutlineRounded from '@mui/icons-material/PersonOutlineRounded';
import RestartAltRounded from '@mui/icons-material/RestartAltRounded';
import SwapHorizRounded from '@mui/icons-material/SwapHorizRounded';
import { holen, loeschen, senden, speichern } from '../../api/client';
import type { Element } from '../../api/types';
import { useSitzung } from '../../app/sitzung';
import { Geladen, Leer, Seite } from '../../components/Seite';
import { FormDialog, NamensAvatar, Plakette, SuchFeld } from '../../components/Bausteine';
import { DatumFeld, ElementWahl } from '../../components/Auswahl';
import { Tabelle } from '../../components/Tabelle';
import { ZeitraumWahl, zeitraumAus } from '../../components/Zeitraum';
import { datumDe, heuteIso } from '../../lib/datum';
import { bestaetigen, fehler, toast } from '../../lib/meldungen';
import { link, navigieren } from '../../lib/router';
import { useLaden } from '../../lib/useLaden';
import type { SeitenProps } from '../register';
import { csv } from './Unterricht';

interface UK { id: number; klassen: string[]; gruppe: string; geaendert: boolean; lehrer: string[]; fach: string; fachName: string; farbe: string; wochenstunden: number; termine: string[]; schueler: number; gruppen: number; gaeste: number }
const zeitraum = (v?: string, b?: string) => (v || b ? `${v ? datumDe(v) : '…'} – ${b ? datumDe(b) : '…'}` : 'ganzes Schuljahr');
const GESCHLECHT: Record<string, string> = { m: 'männlich', w: 'weiblich', d: 'divers' };

export default function UnterrichtKlassen({ teile }: SeitenProps) {
  const { elemente, schuljahr } = useSitzung();
  const [kP, bP, vP, biP] = teile;
  const z = zeitraumAus(bP, vP, biP, schuljahr);
  const [suche, setSuche] = useState('');
  const [dialog, setDialog] = useState<null | { art: 'schueler' | 'gruppen'; u: number } | { art: 'wechsel' }>(null);
  const g = useLaden(async sig => {
    const el = await elemente();
    const klasse = (kP && kP !== '-' ? kP : '') || el.klassen[0]?.kurz || '';
    const d = klasse ? await holen<{ unterricht: UK[]; leitung?: string[]; schreiben: boolean; stichtag: string }>(`/api/app/unterrichtklassen?klasse=${encodeURIComponent(klasse)}&von=${z.von}&bis=${z.bis}`, sig) : null;
    return { el, klasse, d };
  }, [kP, z.von, z.bis]);
  const klasse = g.daten?.klasse ?? '';
  const ziel = (k = klasse, b = z.bereich, zeit: string[] = []) => navigieren(link('unterrichtklassen', k || '-', b, ...zeit));
  return (
    <Seite titel={`Unterricht Klasse ${klasse}`} untertitel={g.daten?.d?.leitung?.length ? `Klassenleitung: ${g.daten.d.leitung.join(', ')}` : undefined}
      aktionen={g.daten?.d && <>
        {g.daten.d.schreiben && <Button variant="outlined" startIcon={<SwapHorizRounded />} onClick={() => setDialog({ art: 'wechsel' })}>Befristeter Unterrichtswechsel</Button>}
        <Button variant="outlined" startIcon={<DownloadRounded />} onClick={() => speichern(csv([['U-Nr', 'Klassen', 'Schülergruppe', 'Lehrkraft', 'Fach', 'Std.', 'Termine', 'Schüler*innen', 'Schülergruppen'],
          ...g.daten!.d!.unterricht.map(u => [u.id, u.klassen.join(', '), u.gruppe, u.lehrer.join(', '), u.fach, u.wochenstunden, u.termine.join(', '), u.schueler, u.gruppen])]), `unterricht-klasse-${klasse}-${z.von}-${z.bis}.csv`)}>Bericht</Button>
      </>}
      filter={g.daten && <>
        <ElementWahl liste={g.daten.el.klassen} wert={klasse} onWahl={k => ziel(k)} platzhalter="Klasse wählen" breite={170} />
        <ZeitraumWahl bereich={z.bereich} von={z.von} bis={z.bis} eigen={z.eigen} onBereich={b => ziel(klasse, b)} onVonBis={(v, b) => ziel(klasse, z.bereich, [v, b])} />
        <SuchFeld wert={suche} onWert={setSuche} breite={200} />
      </>}>
      <Geladen g={g}>{({ el, d }) => {
        if (!d) return <Leer text="Bitte eine Klasse wählen." />;
        const f = suche.trim().toLowerCase();
        const zeilen = d.unterricht.filter(u => !f || [u.id, u.klassen.join(' '), u.gruppe, u.fach, u.fachName, u.lehrer.join(' ')].join(' ').toLowerCase().includes(f));
        return (
          <>
            <Tabelle zeilen={zeilen} schluessel={u => u.id} leer="Keine Unterrichte in diesem Zeitraum."
              spalten={[
                { id: 'nr', kopf: 'U-Nr', sortWert: u => u.id, zelle: u => <Typography variant="body2" color="text.secondary">{u.id}</Typography> },
                { id: 'klassen', kopf: 'Klasse(n)', sortWert: u => u.klassen.join(), zelle: u => <b>{u.klassen.join(', ')}</b> },
                { id: 'gruppe', kopf: 'Schülergruppe', zelle: u => <>{u.gruppe}{u.geaendert && <Plakette ton="pruefung" sx={{ ml: 1 }} title="Schülergruppe in UntPlanWeb geändert">geändert</Plakette>}</>, verbergenMobil: true },
                { id: 'lehrer', kopf: 'Lehrkraft', sortWert: u => u.lehrer.join(), zelle: u => u.lehrer.join(', ') },
                { id: 'fach', kopf: 'Fach', sortWert: u => u.fach, zelle: u => (
                  <Stack direction="row" gap={0.75} alignItems="center" title={u.fachName}><Box sx={{ width: 10, height: 10, borderRadius: 1, bgcolor: /^#[0-9a-f]{6}$/i.test(u.farbe) ? u.farbe : 'divider' }} /><b>{u.fach}</b></Stack>
                ) },
                { id: 'std', kopf: 'Std.', rechts: true, sortWert: u => u.wochenstunden, zelle: u => u.wochenstunden },
                { id: 'termine', kopf: 'Termine', zelle: u => <Stack direction="row" gap={0.5} flexWrap="wrap">{u.termine.length ? u.termine.map(t => <Plakette key={t}>{t}</Plakette>) : '–'}</Stack>, verbergenMobil: true },
                { id: 'schueler', kopf: 'Schüler*innen', zelle: u => <Button size="small" variant="outlined" startIcon={<PersonOutlineRounded />} onClick={() => setDialog({ art: 'schueler', u: u.id })}>{u.schueler}</Button> },
                { id: 'gruppen', kopf: 'Schülergruppen', zelle: u => (
                  <Stack direction="row" gap={0.75} alignItems="center"><Button size="small" variant="outlined" startIcon={<GroupsOutlined />} onClick={() => setDialog({ art: 'gruppen', u: u.id })}>{u.gruppen}</Button>
                    {u.gaeste > 0 && <Plakette ton="termin">{u.gaeste} Gast</Plakette>}</Stack>
                ) },
                { id: 'ber', kopf: '', rechts: true, zelle: () => <Tooltip title="Berichte"><IconButton size="small" href={link('berichte', '-', klasse, z.von, z.bis)}><AssessmentOutlined fontSize="small" /></IconButton></Tooltip> },
              ]} />
            {dialog?.art === 'schueler' && <MitgliederDialog unterricht={dialog.u} gruppe={0} stichtag={d.stichtag} onClose={() => setDialog(null)} fertig={() => void g.neu()} />}
            {dialog?.art === 'gruppen' && <GruppenDialog unterricht={dialog.u} stichtag={d.stichtag} onClose={() => setDialog(null)} fertig={() => void g.neu()} />}
            {dialog?.art === 'wechsel' && <Unterrichtswechsel klassen={el.klassen} vorgabe={klasse} onClose={() => setDialog(null)} fertig={() => void g.neu()} />}
          </>
        );
      }}</Geladen>
    </Seite>
  );
}

// ------------------------------------------------------------------ Schülergruppen eines Unterrichts

interface Gruppe { id: number; name: string; gast: boolean; gilt: boolean; von: string; bis: string; anzahl: number; abweichungen: number }

function GruppenDialog({ unterricht, stichtag, onClose, fertig }: { unterricht: number; stichtag: string; onClose: () => void; fertig: () => void }) {
  const g = useLaden(sig => holen<{ fach: string; klassen: string[]; lehrer: string[]; stichtag: string; schreiben: boolean; gruppen: Gruppe[] }>(`/api/app/unterrichtklassen/${unterricht}/gruppen?datum=${stichtag}`, sig), [unterricht]);
  const [mitglieder, setMitglieder] = useState<number | null>(null);
  const [aendern, setAendern] = useState<Gruppe | null>(null);
  const neu = () => { void g.neu(); fertig(); };
  return (
    <FormDialog offen breite="md" titel={g.daten ? `Schülergruppen des Unterrichts ${g.daten.fach} ${g.daten.klassen.join(', ')}` : 'Schülergruppen'} onClose={onClose}>
      <Geladen g={g}>{d => (
        <Stack gap={2}>
          <Stack direction="row" gap={3} flexWrap="wrap" sx={{ color: 'text.secondary', fontSize: 14 }}>
            <span>Lehrkraft: <b>{d.lehrer.join(', ') || '–'}</b></span><span>Fach: <b>{d.fach}</b></span><span>Klasse: <b>{d.klassen.join(', ')}</b></span><span>Stand: <b>{datumDe(d.stichtag)}</b></span>
          </Stack>
          <Table size="small">
            <TableHead><TableRow><TableCell>Name</TableCell><TableCell>Art</TableCell><TableCell>Zeitraum</TableCell><TableCell align="right">Schüler*innen</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>
              {d.gruppen.map(x => (
                <TableRow key={x.id}>
                  <TableCell sx={{ fontWeight: 500 }}>{x.name}</TableCell>
                  <TableCell><Stack direction="row" gap={0.5}>{x.gast ? <Plakette ton="termin">Gast</Plakette> : <Plakette>Standard</Plakette>}{!x.gast && x.abweichungen > 0 && <Plakette ton="pruefung">{x.abweichungen} Abweichung{x.abweichungen === 1 ? '' : 'en'}</Plakette>}</Stack></TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{zeitraum(x.von, x.bis)}{x.gast && !x.gilt && <Plakette sx={{ ml: 1 }}>nicht am Stichtag</Plakette>}</TableCell>
                  <TableCell align="right">{x.anzahl}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Button size="small" startIcon={<PersonOutlineRounded />} onClick={() => setMitglieder(x.id)}>Schüler*innen</Button>
                    {d.schreiben && x.gast && <IconButton size="small" aria-label="Bearbeiten" onClick={() => setAendern(x)}><EditOutlined fontSize="small" /></IconButton>}
                    {d.schreiben && (x.gast || (x.id > 0 && x.abweichungen > 0)) && (
                      <Tooltip title={x.gast ? 'Löschen' : 'Abweichungen zurücksetzen'}><IconButton size="small" color="error" onClick={async () => {
                        const text = x.gast ? `Gast-Schülergruppe „${x.name}“ löschen? Die Gäste erscheinen dann nicht mehr im Klassenbuch dieses Unterrichts.`
                          : `Alle Abweichungen der Schülergruppe „${x.name}“ zurücksetzen? Danach nehmen wieder alle Schüler*innen der Klassen teil.`;
                        if (!(await bestaetigen('Schülergruppe', text, x.gast ? 'Löschen' : 'Zurücksetzen'))) return;
                        try { await loeschen(`/api/app/unterrichtklassen/${unterricht}/gruppen/${x.id}`); toast(x.gast ? 'Gelöscht.' : 'Zurückgesetzt.'); neu(); } catch (err) { fehler(err); }
                      }}>{x.gast ? <DeleteOutlineRounded fontSize="small" /> : <RestartAltRounded fontSize="small" />}</IconButton></Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Typography variant="body2" color="text.secondary">Die Standardgruppe umfasst die Schüler*innen der Klassen; Abmeldungen und befristete Teilnahme werden je Schüler*in eingetragen.
            Gast-Schülergruppen „(Name)“ entstehen durch den befristeten Unterrichtswechsel und gelten genau für ihren Zeitraum.</Typography>
          {mitglieder !== null && <MitgliederDialog unterricht={unterricht} gruppe={mitglieder} stichtag={stichtag} onClose={() => setMitglieder(null)} fertig={neu} />}
          {aendern && <GruppeAendern unterricht={unterricht} gruppe={aendern} onClose={() => setAendern(null)} fertig={neu} />}
        </Stack>
      )}</Geladen>
    </FormDialog>
  );
}

function GruppeAendern({ unterricht, gruppe, onClose, fertig }: { unterricht: number; gruppe: Gruppe; onClose: () => void; fertig: () => void }) {
  const [name, setName] = useState(gruppe.name);
  const [von, setVon] = useState<string | null>(gruppe.von || null);
  const [bis, setBis] = useState<string | null>(gruppe.bis || null);
  return (
    <FormDialog offen titel={`Schülergruppe ${gruppe.name}`} onClose={onClose} aktion={async () => {
      await senden(`/api/app/unterrichtklassen/${unterricht}/gruppen/${gruppe.id}`, { name, von: von ?? '', bis: bis ?? '' }, 'PUT');
      toast('Gespeichert.'); fertig();
    }}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        <TextField label="Name" value={name} onChange={e => setName(e.target.value)} slotProps={{ htmlInput: { maxLength: 100 } }} />
        <Stack direction="row" gap={2}><DatumFeld label="Von" wert={von} onWert={setVon} /><DatumFeld label="Bis" wert={bis} onWert={setBis} /></Stack>
      </Stack>
    </FormDialog>
  );
}

// ------------------------------------------------------------------ Schüler*innen in der Schülergruppe

interface Mitglied { id: number; name: string; vorname: string; klasse: string; geschlecht: string; auswahl: boolean; von: string; bis: string }

function MitgliederDialog({ unterricht, gruppe, stichtag, onClose, fertig }: { unterricht: number; gruppe: number; stichtag: string; onClose: () => void; fertig: () => void }) {
  const pfad = `/api/app/unterrichtklassen/${unterricht}/gruppen/${gruppe}/schueler?datum=${stichtag}`;
  const g = useLaden(sig => holen<{ klassen: string[]; fach: string; stichtag: string; schreiben: boolean; gruppe: { name: string; gast: boolean; von: string; bis: string }; schueler: Mitglied[] }>(pfad, sig), [pfad]);
  const [zeilen, setZeilen] = useState<Mitglied[]>([]);
  const [suche, setSuche] = useState('');
  useEffect(() => { if (g.daten) setZeilen(g.daten.schueler.map(x => ({ ...x }))); }, [g.daten]);
  const setze = (id: number, w: Partial<Mitglied>) => setZeilen(l => l.map(x => (x.id === id ? { ...x, ...w } : x)));
  const d = g.daten;
  const status = (x: Mitglied) => (!x.auswahl ? <Plakette ton="entfall">abgemeldet</Plakette> : x.von || x.bis ? <Plakette ton="pruefung">{zeitraum(x.von, x.bis)}</Plakette>
    : d?.gruppe.gast ? <Plakette ton="termin">Gast</Plakette> : <Plakette ton="ok">nimmt teil</Plakette>);
  const sichtbar = zeilen.filter(x => !suche || `${x.name} ${x.vorname} ${x.klasse}`.toLowerCase().includes(suche.toLowerCase()));
  return (
    <FormDialog offen breite="md" titel={d ? `Schüler*innen in der Schülergruppe ${d.gruppe.name}` : 'Schüler*innen'} onClose={onClose}
      aktion={d?.schreiben ? async () => {
        for (const x of zeilen) if (x.von && x.bis && x.von > x.bis) { toast(`${x.vorname} ${x.name}: „Von“ liegt nach „Bis“.`, true); return false; }
        await senden(pfad, { schueler: zeilen.map(x => ({ schuelerId: x.id, auswahl: x.auswahl, von: x.von, bis: x.bis })) }, 'PUT');
        toast('Schülergruppe gespeichert.'); fertig();
      } : undefined}>
      <Geladen g={g}>{d => (
        <Stack gap={1.5}>
          <Stack direction="row" gap={3} flexWrap="wrap" sx={{ color: 'text.secondary', fontSize: 14 }}>
            <span>Klasse: <b>{d.klassen.join(', ')}</b></span><span>Fach: <b>{d.fach}</b></span><span>Schüler*innen: <b>{zeilen.filter(x => x.auswahl).length}</b></span>
            {d.gruppe.gast ? <span>Zeitraum: <b>{zeitraum(d.gruppe.von, d.gruppe.bis)}</b></span> : <span>Stand: <b>{datumDe(d.stichtag)}</b></span>}
          </Stack>
          <SuchFeld wert={suche} onWert={setSuche} platzhalter="Name suchen" />
          {!zeilen.length ? <Leer text="Keine Schüler*innen in dieser Gruppe." /> : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell padding="checkbox">{d.schreiben && <Checkbox checked={sichtbar.every(x => x.auswahl)} onChange={e => sichtbar.forEach(x => setze(x.id, { auswahl: e.target.checked }))} aria-label="Alle auswählen" />}</TableCell>
                  <TableCell>Name</TableCell><TableCell>Klasse</TableCell><TableCell>Von</TableCell><TableCell>Bis</TableCell><TableCell>Teilnahme</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {sichtbar.map(x => (
                    <TableRow key={x.id} sx={{ opacity: x.auswahl ? 1 : 0.6 }}>
                      <TableCell padding="checkbox"><Checkbox checked={x.auswahl} disabled={!d.schreiben} onChange={e => setze(x.id, { auswahl: e.target.checked })} aria-label={`${x.vorname} ${x.name} nimmt teil`} /></TableCell>
                      <TableCell><Stack direction="row" gap={1} alignItems="center"><NamensAvatar name={`${x.vorname} ${x.name}`} id={x.id} groesse={28} /><Box><Typography variant="body2" sx={{ fontWeight: 500 }}>{x.name}, {x.vorname}</Typography><Typography variant="caption" color="text.secondary">{GESCHLECHT[x.geschlecht] ?? ''}</Typography></Box></Stack></TableCell>
                      <TableCell>{x.klasse}</TableCell>
                      <TableCell><DatumFeld label="Von" wert={x.von || null} onWert={v => setze(x.id, { von: v ?? '' })} deaktiviert={!d.schreiben} breite={150} /></TableCell>
                      <TableCell><DatumFeld label="Bis" wert={x.bis || null} onWert={v => setze(x.id, { bis: v ?? '' })} deaktiviert={!d.schreiben} breite={150} /></TableCell>
                      <TableCell>{status(x)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
          <Typography variant="body2" color="text.secondary">{d.gruppe.gast ? 'Ohne Häkchen wird der Gast aus der Gruppe entfernt. Von/Bis schränken die Teilnahme innerhalb des Gruppenzeitraums ein.'
            : 'Ohne Häkchen ist die Schülerin bzw. der Schüler vom Unterricht abgemeldet. Mit „Bis“ (letzter Tag) endet die Teilnahme, mit „Von“ beginnt sie zu diesem Datum. Das Klassenbuch einer Stunde zeigt nur, wer an diesem Tag teilnimmt.'}</Typography>
        </Stack>
      )}</Geladen>
    </FormDialog>
  );
}

// ------------------------------------------------------------------ Befristeter Unterrichtswechsel (Assistent)

const SCHRITTE = ['Zeitraum', 'Schüler*innen', 'Zielklasse', 'Unterricht'];
interface WU { id: number; klassen: string[]; lehrer: string[]; fach: string; wochenstunden: number; gruppen: number }

function Unterrichtswechsel({ klassen, vorgabe, onClose, fertig }: { klassen: Element[]; vorgabe: string; onClose: () => void; fertig: () => void }) {
  const t = useTheme();
  const mobil = useMediaQuery(t.breakpoints.down('sm'));
  const [schritt, setSchritt] = useState(0);
  const [von, setVon] = useState(heuteIso());
  const [bis, setBis] = useState(heuteIso());
  const [filter, setFilter] = useState('');
  const [suche, setSuche] = useState('');
  const [schueler, setSchueler] = useState<Set<number>>(new Set());
  const [ziel, setZiel] = useState(vorgabe);
  const [unterrichte, setUnterrichte] = useState<Set<number>>(new Set());
  const [alle, setAlle] = useState<{ id: number; name: string; vorname: string; klasse: string }[] | null>(null);
  const [liste, setListe] = useState<WU[]>([]);
  const [laeuft, setLaeuft] = useState(false);
  useEffect(() => { if (schritt === 1 && !alle) holen<{ schueler: { id: number; name: string; vorname: string; klasse: string }[] }>('/api/app/schueler').then(r => setAlle(r.schueler)).catch(fehler); }, [schritt, alle]);
  const umschalten = <T,>(s: Set<T>, x: T, an: boolean) => { const n = new Set(s); if (an) n.add(x); else n.delete(x); return n; };
  const weiter = async () => {
    setLaeuft(true);
    try {
      if (schritt === 0 && von > bis) throw new Error('„Bis“ liegt vor „Von“.');
      if (schritt === 1 && !schueler.size) throw new Error('Bitte mindestens eine Schülerin bzw. einen Schüler wählen.');
      if (schritt === 2) {
        if (!ziel) throw new Error('Bitte die Zielklasse wählen.');
        const l = await holen<WU[]>(`/api/app/unterrichtswechsel/unterricht?klasse=${encodeURIComponent(ziel)}&von=${von}&bis=${bis}`);
        setListe(l);
        setUnterrichte(s => new Set([...s].filter(id => l.some(u => u.id === id))));
      }
      if (schritt === 3) {
        if (!unterrichte.size) throw new Error('Bitte mindestens einen Unterricht wählen.');
        const r = await senden<{ gruppen: unknown[] }>('/api/app/unterrichtswechsel', { von, bis, schuelerIds: [...schueler], zielklasse: ziel, unterrichte: [...unterrichte] });
        toast(`Gespeichert: ${schueler.size} Schüler*innen in ${r.gruppen.length} Unterricht${r.gruppen.length === 1 ? '' : 'en'} der Klasse ${ziel}.`);
        fertig(); onClose(); return;
      }
      setSchritt(schritt + 1);
    } catch (err) { fehler(err); } finally { setLaeuft(false); }
  };
  const gefiltert = (alle ?? []).filter(x => (!filter || x.klasse === filter) && (!suche || `${x.name} ${x.vorname}`.toLowerCase().includes(suche.toLowerCase())));
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth fullScreen={mobil}>
      <DialogTitle>Befristeter Unterrichtswechsel für Schüler*innen</DialogTitle>
      <DialogContent dividers sx={{ minHeight: 380 }}>
        <Stepper activeStep={schritt} alternativeLabel sx={{ mb: 3 }}>{SCHRITTE.map(s => <Step key={s}><StepLabel>{s}</StepLabel></Step>)}</Stepper>
        {schritt === 0 && (
          <Stack gap={2}>
            <Typography sx={{ fontWeight: 500 }}>In welchem Zeitraum besuchen die Schüler*innen einen anderen Unterricht?</Typography>
            <Stack direction="row" gap={2}><DatumFeld label="Von" wert={von} onWert={v => { if (v) { setVon(v); if (bis < v) setBis(v); } }} pflicht /><DatumFeld label="Bis" wert={bis} onWert={v => v && setBis(v)} pflicht /></Stack>
            <Typography variant="body2" color="text.secondary">Zum Beispiel während einer Klassenfahrt für Schüler*innen, die nicht mitfahren.</Typography>
          </Stack>
        )}
        {schritt === 1 && (
          <Stack gap={1.5}>
            <Typography sx={{ fontWeight: 500 }}>Bitte wählen Sie die Schüler*innen</Typography>
            <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="center">
              <TextField select label="Klasse" value={filter} onChange={e => setFilter(e.target.value)} sx={{ width: 150 }}><MenuItem value="">Alle</MenuItem>{klassen.map(k => <MenuItem key={k.kurz} value={k.kurz}>{k.kurz}</MenuItem>)}</TextField>
              <SuchFeld wert={suche} onWert={setSuche} platzhalter="Name" breite={220} />
              <Chip label={`${schueler.size} gewählt`} color="primary" variant="outlined" />
              <Button size="small" onClick={() => setSchueler(s => new Set([...s, ...gefiltert.map(x => x.id)]))}>Alle angezeigten wählen</Button>
              <Button size="small" onClick={() => setSchueler(new Set())}>Auswahl leeren</Button>
            </Stack>
            <Box sx={{ maxHeight: 320, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              {gefiltert.map(x => (
                <Stack key={x.id} component="label" direction="row" alignItems="center" sx={{ px: 1, cursor: 'pointer', bgcolor: schueler.has(x.id) ? 'action.selected' : undefined }}>
                  <Checkbox size="small" checked={schueler.has(x.id)} onChange={e => setSchueler(s => umschalten(s, x.id, e.target.checked))} />
                  <Typography variant="body2" sx={{ flex: 1 }}>{x.name} {x.vorname}</Typography><Typography variant="caption" color="text.secondary" sx={{ pr: 1 }}>{x.klasse}</Typography>
                </Stack>
              ))}
              {alle && !gefiltert.length && <Typography color="text.secondary" sx={{ p: 2 }}>Keine Schüler*innen gefunden.</Typography>}
            </Box>
          </Stack>
        )}
        {schritt === 2 && (
          <Stack gap={2}>
            <Typography sx={{ fontWeight: 500 }}>Bitte wählen Sie die Zielklasse</Typography>
            <TextField select label="Klasse" value={ziel} onChange={e => setZiel(e.target.value)} sx={{ width: 200 }}>{klassen.map(k => <MenuItem key={k.kurz} value={k.kurz}>{k.kurz}</MenuItem>)}</TextField>
            <Typography variant="body2" color="text.secondary">{schueler.size} Schüler*innen besuchen vom {datumDe(von)} bis {datumDe(bis)} den Unterricht dieser Klasse.</Typography>
          </Stack>
        )}
        {schritt === 3 && (
          <Stack gap={1.5}>
            <Typography sx={{ fontWeight: 500 }}>Bitte wählen Sie den Unterricht der Klasse {ziel}</Typography>
            {liste.length ? (
              <Table size="small">
                <TableHead><TableRow><TableCell padding="checkbox"><Checkbox checked={liste.every(u => unterrichte.has(u.id))} onChange={e => setUnterrichte(e.target.checked ? new Set(liste.map(u => u.id)) : new Set())} aria-label="Alle auswählen" /></TableCell>
                  <TableCell>Klasse</TableCell><TableCell>Lehrkraft</TableCell><TableCell>Fach</TableCell><TableCell align="right">Std.</TableCell><TableCell>Schülergruppen</TableCell></TableRow></TableHead>
                <TableBody>{liste.map(u => (
                  <TableRow key={u.id} hover onClick={() => setUnterrichte(s => umschalten(s, u.id, !s.has(u.id)))} sx={{ cursor: 'pointer' }}>
                    <TableCell padding="checkbox"><Checkbox checked={unterrichte.has(u.id)} /></TableCell>
                    <TableCell>{u.klassen.join(', ')}</TableCell><TableCell>{u.lehrer.join(', ')}</TableCell><TableCell><b>{u.fach}</b></TableCell><TableCell align="right">{u.wochenstunden}</TableCell>
                    <TableCell>{u.gruppen ? <Plakette><GroupsOutlined sx={{ fontSize: 14 }} />{u.gruppen}</Plakette> : null}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            ) : <Alert severity="info">Die Klasse hat in diesem Zeitraum keinen Unterricht.</Alert>}
            <Typography variant="body2" color="text.secondary">Je Unterricht entsteht eine Gast-Schülergruppe „(Name)“ genau für den Zeitraum. Die Schüler*innen erscheinen dann im Klassenbuch dieser Stunden;
              nachträglich lässt sich die Gruppe unter „Schülergruppen“ bearbeiten.</Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button variant="outlined" onClick={onClose} sx={{ mr: 'auto' }}>Abbrechen</Button>
        <Button variant="outlined" disabled={schritt === 0 || laeuft} onClick={() => setSchritt(schritt - 1)}>Zurück</Button>
        <Button variant="contained" disabled={laeuft} onClick={weiter}>{schritt === SCHRITTE.length - 1 ? 'Speichern' : 'Weiter'}</Button>
      </DialogActions>
    </Dialog>
  );
}

// ------------------------------------------------------------------ Klassenwechsel (Schülerverwaltung)

interface Verlauf { bearbeiten: boolean; verlauf: { klasse: string; beginn: string; ende: string; wechselId?: number }[] }

export function KlassenwechselDialog({ schueler, klassen, onClose, fertig }: { schueler: { id: number; name: string; vorname: string; klasse: string }; klassen: { kurz: string }[]; onClose: () => void; fertig: () => void }) {
  const pfad = `/api/app/schueler/${schueler.id}/klassenwechsel`;
  const g = useLaden(sig => holen<Verlauf>(pfad, sig), [pfad]);
  const [klasse, setKlasse] = useState(klassen.find(k => k.kurz !== schueler.klasse)?.kurz ?? '');
  const [beginn, setBeginn] = useState<string | null>(heuteIso());
  const [geaendert, setGeaendert] = useState(false);
  const heute = heuteIso();
  const zu = () => { if (geaendert) fertig(); onClose(); };
  return (
    <FormDialog offen titel={`Klassenwechsel für ${schueler.name} ${schueler.vorname}`} onClose={zu} aktionText="Klassenwechsel speichern"
      aktion={g.daten?.bearbeiten ? async () => {
        if (!beginn) { toast('Bitte ein Beginndatum wählen.', true); return false; }
        g.setDaten(await senden<Verlauf>(pfad, { klasse, beginn }));
        toast('Klassenwechsel gespeichert.'); setGeaendert(true); return false;
      } : undefined}>
      <Geladen g={g}>{d => (
        <Stack gap={2}>
          {d.bearbeiten && (
            <Stack direction="row" gap={2}>
              <TextField select label="Neue Klasse" value={klasse} onChange={e => setKlasse(e.target.value)} sx={{ width: 180 }}>{klassen.filter(k => k.kurz !== schueler.klasse).map(k => <MenuItem key={k.kurz} value={k.kurz}>{k.kurz}</MenuItem>)}</TextField>
              <DatumFeld label="Beginndatum" wert={beginn} onWert={setBeginn} pflicht />
            </Stack>
          )}
          <Table size="small">
            <TableHead><TableRow><TableCell>Klasse</TableCell><TableCell>Beginndatum</TableCell><TableCell>Enddatum</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>{d.verlauf.map((z, i) => {
              const aktuell = (!z.beginn || z.beginn <= heute) && (!z.ende || heute <= z.ende);
              return (
                <TableRow key={i} selected={aktuell}>
                  <TableCell sx={{ fontWeight: 500 }}>{z.klasse}{aktuell && <Plakette ton="ok" sx={{ ml: 1 }}>aktuell</Plakette>}</TableCell><TableCell>{datumDe(z.beginn) || '–'}</TableCell><TableCell>{datumDe(z.ende) || '–'}</TableCell>
                  <TableCell align="right">{d.bearbeiten && z.wechselId && <IconButton size="small" color="error" aria-label="Klassenwechsel löschen" onClick={async () => {
                    if (!(await bestaetigen('Klassenwechsel löschen', 'Diesen Klassenwechsel löschen?'))) return;
                    try { g.setDaten(await loeschen<Verlauf>(`${pfad}/${z.wechselId}`)); setGeaendert(true); } catch (err) { fehler(err); }
                  }}><DeleteOutlineRounded fontSize="small" /></IconButton>}</TableCell>
                </TableRow>
              );
            })}</TableBody>
          </Table>
          <Typography variant="body2" color="text.secondary">Die Klassenzugehörigkeit gilt ab dem Beginndatum: Klassenbuch, Schülerlisten und Fehlzeiten berücksichtigen das Datum. Die Daten aus dem Desktop-Programm bleiben unverändert.</Typography>
        </Stack>
      )}</Geladen>
    </FormDialog>
  );
}
