// Neuigkeiten: Infos der Schule und Neuerungen in EduOrga Web als ruhige Liste (wie im Infocenter), Filter nach Art.
// #/neuigkeiten/verwalten: Infos anlegen, bearbeiten, löschen (Administration, Schulleitung).
import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, FormControlLabel, IconButton, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import { holen, loeschen, senden } from '../../api/client';
import { InfoKarte, useInfocenter } from '../../app/Infocenter';
import { Geladen, Leer, Seite } from '../../components/Seite';
import { FormDialog, Plakette, SuchFeld, Wahl } from '../../components/Bausteine';
import { DatumFeld } from '../../components/Auswahl';
import { Tabelle } from '../../components/Tabelle';
import { bestaetigen, fehler, toast } from '../../lib/meldungen';
import { datumDe, heuteIso } from '../../lib/datum';
import { navigieren } from '../../lib/router';
import { useLaden } from '../../lib/useLaden';
import type { SeitenProps } from '../register';

const ZIELGRUPPEN: Record<string, string> = { alle: 'Alle', kollegium: 'Lehrkräfte', schueler: 'Schüler*innen', eltern: 'Eltern' };

export default function Neuigkeiten({ teile }: SeitenProps) {
  if (teile[0] === 'verwalten') return <Verwalten />;
  return <Liste filter={['infos', 'updates'].includes(teile[0]) ? teile[0] : ''} />;
}

function Liste({ filter }: { filter: string }) {
  const ic = useInfocenter();
  const [suche, setSuche] = useState('');
  // beim Ansehen gelten die gezeigten Einträge als gelesen; die Markierung bleibt bis zum nächsten Aufruf sichtbar
  const ungelesenBeimOeffnen = useRef<Set<string> | null>(null);
  const passend = ic.eintraege.filter(x => !filter || (filter === 'infos' ? x.art === 'info' : x.art === 'neuigkeit'));
  useEffect(() => {
    if (!ic.eintraege.length) return;
    if (!ungelesenBeimOeffnen.current) ungelesenBeimOeffnen.current = new Set(ic.eintraege.filter(x => !x.gelesen).map(x => x.schluessel));
    const offen = passend.filter(x => !x.gelesen).map(x => x.schluessel);
    if (offen.length) void ic.gelesen(offen);
  }, [ic.eintraege.length, filter]); // eslint-disable-line react-hooks/exhaustive-deps
  const neu = ungelesenBeimOeffnen.current ?? new Set(ic.eintraege.filter(x => !x.gelesen).map(x => x.schluessel));
  const zahl = (art?: string) => ic.eintraege.filter(x => !art || x.art === art).length;
  const offen = (art?: string) => ic.eintraege.filter(x => neu.has(x.schluessel) && (!art || x.art === art)).length;
  const optionText = (text: string, art?: string) => `${text} (${zahl(art)}${offen(art) ? `, ${offen(art)} neu` : ''})`;
  const f = suche.trim().toLowerCase();
  const liste = passend.filter(x => !f || `${x.titel} ${x.text ?? ''} ${(x.punkte ?? []).join(' ')} ${x.kategorie}`.toLowerCase().includes(f));
  return (
    <Seite titel="Neuigkeiten" untertitel="Infos der Schule und Neuerungen in EduOrga Web – neue Einträge sind mit einem Punkt markiert."
      aktionen={<>
        {ic.ungelesen > 0 && <Button variant="outlined" onClick={() => ic.gelesen()}>Alle als gelesen markieren</Button>}
        {ic.darfVerwalten && <Button variant="contained" href="#/neuigkeiten/verwalten">Infos verwalten</Button>}
      </>}
      filter={<>
        <SuchFeld wert={suche} onWert={setSuche} platzhalter="Neuigkeiten durchsuchen" breite={300} />
        <Wahl label="Art" wert={filter} onWert={w => navigieren(`#/neuigkeiten${w ? '/' + w : ''}`, true)} alle={optionText('Alle')} breite={280}
          optionen={[['infos', optionText('Infos der Schule', 'info')], ['updates', optionText('Neuerungen in EduOrga Web', 'neuigkeit')]]} />
      </>}>
      {liste.length ? (
        <Stack gap={1.25} sx={{ maxWidth: 900 }}>
          {liste.map(x => <InfoKarte key={x.schluessel} x={{ ...x, gelesen: !neu.has(x.schluessel) }} />)}
        </Stack>
      ) : (
        <Leer text={filter === 'infos' ? 'Keine Infos der Schule' : 'Keine Neuigkeiten'}
          unter={filter === 'infos' ? 'Die Schule hat aktuell keine Infos veröffentlicht.' : 'Sobald es etwas Neues gibt, erscheint es hier.'} />
      )}
    </Seite>
  );
}

interface Info { id: number; titel: string; text: string; zielgruppe: string; von?: string | null; bis?: string | null; wichtig: boolean }
const zeitraum = (i: Info) => (!i.von && !i.bis ? 'unbegrenzt' : `${i.von ? datumDe(i.von) : '…'} – ${i.bis ? datumDe(i.bis) : '…'}`);

function Verwalten() {
  const ic = useInfocenter();
  const g = useLaden(sig => holen<Info[]>('/api/app/infocenter/infos', sig), []);
  const [formular, setFormular] = useState<{ i: Info | null } | null>(null);
  const heute = heuteIso();
  const aktiv = (i: Info) => (!i.von || i.von <= heute) && (!i.bis || i.bis >= heute);
  const fertig = async () => { await ic.laden(); await g.neu(); };
  return (
    <Seite titel="Infos verwalten" untertitel="Infos erscheinen im Infocenter (Glocke) bei der gewählten Zielgruppe – im angegebenen Zeitraum. Wichtige Infos stehen oben."
      aktionen={<><Button variant="outlined" startIcon={<ArrowBackRounded />} href="#/neuigkeiten">Neuigkeiten</Button>
        <Button variant="contained" onClick={() => setFormular({ i: null })}>Info erstellen</Button></>}>
      {g.fehler ? <Alert severity="warning">{g.fehler.message}</Alert> : (
        <Geladen g={g}>{infos => (
          <Tabelle zeilen={infos} schluessel={i => i.id} leer="Noch keine Infos angelegt." onZeile={i => setFormular({ i })}
            spalten={[
              { id: 'titel', kopf: 'Titel', sortWert: i => i.titel, zelle: i => <Box><Typography sx={{ fontWeight: 500 }}>{i.titel}{i.wichtig && <Plakette ton="entfall" sx={{ ml: 1 }}>Wichtig</Plakette>}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520 }} noWrap>{i.text.slice(0, 140)}</Typography></Box> },
              { id: 'ziel', kopf: 'Zielgruppe', sortWert: i => i.zielgruppe, zelle: i => ZIELGRUPPEN[i.zielgruppe] ?? i.zielgruppe },
              { id: 'zeit', kopf: 'Gültig', nowrap: true, zelle: zeitraum, verbergenMobil: true },
              { id: 'status', kopf: 'Status', zelle: i => <Plakette ton={aktiv(i) ? 'ok' : 'neutral'}>{aktiv(i) ? 'sichtbar' : 'nicht sichtbar'}</Plakette> },
              { id: 'akt', kopf: '', rechts: true, zelle: i => (
                <IconButton size="small" color="error" aria-label="Löschen" onClick={async e => {
                  e.stopPropagation();
                  if (!(await bestaetigen('Info löschen', `„${i.titel}“ wirklich löschen?`))) return;
                  try { await loeschen(`/api/app/infocenter/infos/${i.id}`); toast('Info gelöscht.'); await fertig(); } catch (err) { fehler(err); }
                }}><DeleteOutlineRounded fontSize="small" /></IconButton>
              ) },
            ]} />
        )}</Geladen>
      )}
      {formular && <InfoFormular info={formular.i} onClose={() => setFormular(null)} fertig={fertig} />}
    </Seite>
  );
}

function InfoFormular({ info, onClose, fertig }: { info: Info | null; onClose: () => void; fertig: () => Promise<void> }) {
  const [i, setI] = useState<Info>(info ?? { id: 0, titel: '', text: '', zielgruppe: 'alle', von: null, bis: null, wichtig: false });
  return (
    <FormDialog offen titel={info ? 'Info bearbeiten' : 'Info erstellen'} onClose={onClose} aktion={async () => {
      if (!i.titel.trim()) { toast('Bitte einen Titel eingeben.', true); return false; }
      const daten = { titel: i.titel, text: i.text, zielgruppe: i.zielgruppe, von: i.von || null, bis: i.bis || null, wichtig: i.wichtig };
      await senden(info ? `/api/app/infocenter/infos/${info.id}` : '/api/app/infocenter/infos', daten, info ? 'PUT' : 'POST');
      toast(info ? 'Info gespeichert.' : 'Info erstellt.');
      await fertig();
    }}>
      <Stack gap={2} sx={{ pt: 0.5 }}>
        <TextField label="Titel" value={i.titel} onChange={e => setI({ ...i, titel: e.target.value })} required slotProps={{ htmlInput: { maxLength: 200 } }} />
        <TextField label="Text" value={i.text} onChange={e => setI({ ...i, text: e.target.value })} multiline minRows={4} slotProps={{ htmlInput: { maxLength: 4000 } }} />
        <TextField select label="Zielgruppe" value={i.zielgruppe} onChange={e => setI({ ...i, zielgruppe: e.target.value })}>{Object.entries(ZIELGRUPPEN).map(([k, t]) => <MenuItem key={k} value={k}>{t}</MenuItem>)}</TextField>
        <Stack direction="row" gap={2}><DatumFeld label="Gültig von" wert={i.von ?? null} onWert={v => setI({ ...i, von: v })} /><DatumFeld label="Gültig bis" wert={i.bis ?? null} onWert={v => setI({ ...i, bis: v })} /></Stack>
        <FormControlLabel control={<Switch checked={i.wichtig} onChange={e => setI({ ...i, wichtig: e.target.checked })} />} label="Wichtig (oben, hervorgehoben)" />
      </Stack>
    </FormDialog>
  );
}
