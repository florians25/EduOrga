// Klassenbuch | Einstellungen (Recht „Klassenbuch-Einstellungen“): Reiter Hauptseite, Allgemein, Unterricht und Noten als Karten mit Schaltern,
// Auswahlfeldern und Hilfetexten; unten eine feste Leiste mit „Speichern“. Unterricht | Einstellungen (#/kbeinstellungen/unterricht) zeigt nur
// den Reiter „Unterricht“ (Prüfungen). Ohne Recht sind alle Felder nur lesbar. Leere Zahlenfelder bedeuten „unbegrenzt“.
import { useEffect, useState, type ReactNode } from 'react';
import {
  Alert, Box, Button, FormControlLabel, InputAdornment, MenuItem, Paper, Radio, RadioGroup, Stack, Switch, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import AssignmentTurnedInOutlined from '@mui/icons-material/AssignmentTurnedInOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import EmojiEventsOutlined from '@mui/icons-material/EmojiEventsOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import SendRounded from '@mui/icons-material/SendRounded';
import TuneOutlined from '@mui/icons-material/TuneOutlined';
import WebOutlined from '@mui/icons-material/WebOutlined';
import { holen, senden } from '../../api/client';
import { useSitzung } from '../../app/sitzung';
import { Geladen, Seite } from '../../components/Seite';
import { Plakette } from '../../components/Bausteine';
import { DatumFeld, ZeitFeld } from '../../components/Auswahl';
import { WOCHENTAGE } from '../../lib/datum';
import { fehler, toast } from '../../lib/meldungen';
import { navigieren } from '../../lib/router';
import { useLaden } from '../../lib/useLaden';
import type { SeitenProps } from '../register';

type W = Record<string, string | number | boolean | null>;
interface Daten { einstellungen: W; darf: boolean; gruende: { kurz: string; name: string; entschuldigt: boolean }[]; loeschsperreHoechstens: number }
interface Noten { schemen: { id: number; name: string; noten: { text: string }[]; mitDurchschnitt: boolean; aktiv: boolean }[]; gesamt: number | null }
const REITER: [string, string, ReactNode][] = [['hauptseite', 'Hauptseite', <WebOutlined key="h" />], ['allgemein', 'Allgemein', <TuneOutlined key="a" />], ['unterricht', 'Unterricht', <AssignmentTurnedInOutlined key="u" />], ['noten', 'Noten', <EmojiEventsOutlined key="n" />]];
const STATUS: [string, string][] = [['offen', 'offen'], ['entschuldigt', 'entschuldigt'], ['unentschuldigt', 'nicht entschuldigt']];
const AB: [string, string][] = [['woche', 'Beginn der aktuellen Woche'], ['schuljahr', 'Beginn des Schuljahres'], ['datum', 'Fixes Datum'], ['tage', 'Tage zurück']];

export default function KbEinstellungen({ teile }: SeitenProps) {
  // Unterricht | Einstellungen: nur der Reiter „Unterricht“; Reiterwechsel im Klassenbuch schreibt „/r“ an die Adresse
  const nurUnterricht = teile[0] === 'unterricht' && teile[1] !== 'r';
  const g = useLaden(async sig => {
    const [d, noten] = await Promise.all([holen<Daten>('/api/app/klassenbuch/einstellungen', sig), holen<Noten>('/api/app/notenschemen', sig).catch(() => ({ schemen: [], gesamt: null }))]);
    return { d, noten };
  }, []);
  return <Geladen g={g}>{({ d, noten }) => <Formular d={d} noten={noten} reiterStart={REITER.some(r => r[0] === teile[0]) ? teile[0] : 'hauptseite'} nurUnterricht={nurUnterricht} />}</Geladen>;
}

function Zeile({ label, children, hilfe }: { label: string; children: ReactNode; hilfe?: ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '300px minmax(0, 1fr)' }, gap: { xs: 1, md: 3 }, py: 1.75, borderTop: 1, borderColor: 'divider', '&:first-of-type': { borderTop: 0 } }}>
      <Typography sx={{ fontWeight: 500, pt: { md: 1 } }}>{label}</Typography>
      <Box>{children}{hilfe && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>{hilfe}</Typography>}</Box>
    </Box>
  );
}

function Formular({ d, noten, reiterStart, nurUnterricht }: { d: Daten; noten: Noten; reiterStart: string; nurUnterricht: boolean }) {
  const { ich } = useSitzung();
  const [reiter, setReiter] = useState(nurUnterricht ? 'unterricht' : reiterStart);
  const [gespeichert, setGespeichert] = useState<W>(d.einstellungen);
  const [w, setW] = useState<W>(d.einstellungen);
  const [laeuft, setLaeuft] = useState(false);
  const darf = d.darf;
  const geaendert = JSON.stringify(w) !== JSON.stringify(gespeichert);
  useEffect(() => {
    const warnen = (ev: BeforeUnloadEvent) => { if (geaendert) { ev.preventDefault(); ev.returnValue = ''; } };
    window.addEventListener('beforeunload', warnen);
    return () => window.removeEventListener('beforeunload', warnen);
  }, [geaendert]);
  const set = (n: string, v: W[string]) => setW(alt => ({ ...alt, [n]: v }));
  const gruende: [string, string][] = [['', '– kein Standardgrund –'], ...d.gruende.map(x => [x.kurz, `${x.name} (${x.kurz})${x.entschuldigt ? ' – gilt als entschuldigt' : ''}`] as [string, string])];

  // ------------------------------------------------ Bausteine
  const schalter = (n: string, label: string, hilfe?: string) => (
    <Box sx={{ py: 1.25, borderTop: 1, borderColor: 'divider', '&:first-of-type': { borderTop: 0 } }}>
      <FormControlLabel control={<Switch checked={!!w[n]} onChange={e => set(n, e.target.checked)} disabled={!darf} />} label={<Typography sx={{ fontWeight: 500 }}>{label}</Typography>} />
      {hilfe && <Typography variant="body2" color="text.secondary" sx={{ ml: 6.5 }}>{hilfe}</Typography>}
    </Box>
  );
  const radios = (n: string, liste: [string, string][], zusatz: Record<string, ReactNode> = {}) => (
    <RadioGroup value={String(w[n] ?? '')} onChange={e => set(n, e.target.value)}>
      {liste.map(([v, t]) => <Stack key={v} direction="row" alignItems="center" gap={1} flexWrap="wrap"><FormControlLabel value={v} control={<Radio size="small" disabled={!darf} />} label={t} />{w[n] === v && zusatz[v]}</Stack>)}
    </RadioGroup>
  );
  const zahl = (n: string, { max = 3650, leer = '', einheit = '' }: { max?: number; leer?: string; einheit?: string } = {}) => (
    <TextField type="number" size="small" value={w[n] ?? ''} placeholder={leer} disabled={!darf} sx={{ width: 170 }}
      onChange={e => set(n, e.target.value === '' ? (leer ? null : 0) : Number(e.target.value))}
      slotProps={{ htmlInput: { min: 0, max }, input: { endAdornment: einheit ? <InputAdornment position="end">{einheit}</InputAdornment> : undefined } }} />
  );
  const auswahl = (n: string, liste: [string | number, string][], breite = 360) => (
    <TextField select size="small" value={w[n] ?? ''} onChange={e => set(n, typeof liste[0]?.[0] === 'number' ? Number(e.target.value) : e.target.value)} disabled={!darf} sx={{ width: breite, maxWidth: '100%' }}>
      {liste.map(([v, t]) => <MenuItem key={String(v)} value={v}>{t}</MenuItem>)}
    </TextField>
  );
  const datum = (n: string) => <DatumFeld label="" wert={(w[n] as string) || null} onWert={v => set(n, v ?? '')} deaktiviert={!darf} />;
  const bereich = (von: string, bis: string) => <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">{datum(von)}<span>bis</span>{datum(bis)}</Stack>;
  const text = (n: string) => <TextField multiline minRows={3} fullWidth value={w[n] ?? ''} onChange={e => set(n, e.target.value)} disabled={!darf} slotProps={{ htmlInput: { maxLength: 2000 } }} />;
  const karte = (titel: string, kinder: ReactNode, rechts?: ReactNode) => (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
      <Stack direction="row" alignItems="center" sx={{ mb: 1 }}><Typography variant="h3" sx={{ flex: 1 }}>{titel}</Typography>{rechts}</Stack>{kinder}
    </Paper>
  );

  const hauptseite = (
    <>
      <Alert severity="info">Diese Einstellungen gelten für die Hauptseite des Klassenbuchs in den Stundendetails, in der Fachlehrkräfte Abwesenheiten und Lehrstoff eintragen.</Alert>
      {karte('Schülerliste', <>
        <Zeile label="Sortierung der Schülerliste">{radios('sortierung', [['nachname', 'Nach Nachname'], ['vorname', 'Nach Vorname']])}</Zeile>
        <Zeile label="Anordnung" hilfe="Gilt als Vorgabe; Lehrkräfte können die Ansicht über das Zahnrad für sich ändern.">{radios('richtung', [['spalten', 'Von oben nach unten'], ['zeilen', 'Von links nach rechts']])}</Zeile>
        {schalter('nachKlasse', 'Sortierung der Schüler*innen nach Klasse', 'Bei gekoppeltem Unterricht mehrerer Klassen zuerst nach Klasse sortieren.')}
      </>)}
      {karte('Abwesenheiten', <>
        {schalter('abwesenheitNurInStunde', 'Abwesenheitseintrag darf nur in der Unterrichtsstunde erfolgen', 'Fachlehrkräfte tragen Abwesenheiten nur während der Stunde ein; Klassenleitung und Administration sind ausgenommen.')}
        <Zeile label="Vorgabe für das Ende einer Abwesenheit" hilfe="Stundenende: In den folgenden Stunden erscheint die Abwesenheit mit dem Knopf „Abwesenheit verlängern“, solange die Schülerin bzw. der Schüler fehlt. Tagesende bzw. fixer Zeitpunkt: Die Abwesenheit gilt gleich für die folgenden Stunden und wird dort verkürzt, sobald die Schülerin bzw. der Schüler wieder da ist.">
          {radios('abwesenheitEnde', [['stunde', 'Stundenende'], ['tag', 'Tagesende'], ['zeit', 'Fixer Zeitpunkt']], {
            zeit: <ZeitFeld label="" wert={String(w.abwesenheitEndeZeit ?? '')} onWert={v => set('abwesenheitEndeZeit', v)} deaktiviert={!darf} />,
          })}
        </Zeile>
        {schalter('direkteEingabe', 'Direkte Abwesenheitseingabe über das Häkchen', 'Ein Klick auf das Häkchen in der Schülerkachel trägt die Abwesenheit sofort ein (mit dem Standardgrund für „abwesend“).')}
        {schalter('alleAbwesenheitenDesTages', 'Alle Abwesenheiten des Tages anzeigen', 'Zeigt in den Stundendetails auch die Abwesenheiten aus späteren Stunden des Tages.')}
      </>)}
      {karte('Anzeige', <>
        <Zeile label="Klassenbucheinträge anzeigen ab">{radios('eintraegeAb', AB, { datum: datum('eintraegeAbDatum'), tage: zahl('eintraegeTage', { max: 366, einheit: 'Tage' }) })}</Zeile>
        {schalter('faelligeHausaufgaben', 'Fällige, unerledigte Hausaufgaben anzeigen')}
      </>)}
    </>
  );

  const allgemein = (
    <>
      {karte('Eingaben', <>
        {schalter('abwesenheitskontrolle', 'Abwesenheitskontrolle', 'Stunden ohne Kontrolle der Abwesenheiten gelten als offen. Mit einer eingetragenen Abwesenheit gilt die Stunde als kontrolliert; sind alle anwesend, bestätigt die Lehrkraft die Kontrolle in den Stundendetails.')}
        <Zeile label="Erlaubter Datumsbereich für Eingaben" hilfe="Leer = keine Einschränkung.">{bereich('datumVon', 'datumBis')}</Zeile>
        <Zeile label="Eingabe bis Tage in die Vergangenheit">{zahl('tageVergangenheit', { leer: 'unbegrenzt', einheit: 'Tage' })}</Zeile>
        <Zeile label="Eingabe bis Tage in die Zukunft" hilfe="Leer = unbegrenzt (Standard). Die Abwesenheitskontrolle über „Abwesenheiten kontrollieren“ bleibt immer möglich.">{zahl('tageZukunft', { leer: 'unbegrenzt', einheit: 'Tage' })}</Zeile>
        <Zeile label="Abwesenheiten und Klassenbucheinträge dürfen nach … nicht mehr gelöscht werden" hilfe={`0 = jederzeit. Höchstens ${d.loeschsperreHoechstens} Stunden; die Administration kann immer löschen.`}>{zahl('loeschsperre', { max: d.loeschsperreHoechstens, einheit: 'Stunden' })}</Zeile>
      </>)}
      {karte('Offene Stunden', <>
        <Zeile label="Offene Stunden anzeigen ab" hilfe="Vorgabe der Seite „Offene Stunden“; Lehrkräfte können den Zeitraum dort für sich ändern.">{radios('offenAb', AB, { datum: datum('offenAbDatum'), tage: zahl('offenTage', { max: 366, einheit: 'Tage' }) })}</Zeile>
        <Zeile label="Offene Stunden anzeigen für">{auswahl('offenFuer', [['beide', 'Abwesenheitskontrolle und Lehrstoff'], ['kontrolle', 'Abwesenheitskontrolle'], ['lehrstoff', 'Lehrstoff']])}</Zeile>
      </>)}
      {karte('Fehlzeiten', <>
        <Zeile label="Fehlstunde zählt ab" hilfe="Minuten (z. B. 20) oder Prozent der Stunde (z. B. 50%)."><TextField size="small" value={w.fehlstundeAb ?? ''} onChange={e => set('fehlstundeAb', e.target.value)} disabled={!darf} sx={{ width: 140 }} /></Zeile>
        <Zeile label="Fehltag zählt ab" hilfe="Minuten oder Prozent des Unterrichtstages; wichtig für die Berichte."><TextField size="small" value={w.fehltagAb ?? ''} onChange={e => set('fehltagAb', e.target.value)} disabled={!darf} sx={{ width: 140 }} /></Zeile>
        <Zeile label="Max. Fehlminuten pro Unterrichtseinheit" hilfe="0 = ohne Grenze.">{zahl('maxFehlminuten', { max: 600, einheit: 'Minuten' })}</Zeile>
        {schalter('pruefungenIgnorieren', 'Prüfungen für Fehlzeiten ignorieren')}
      </>)}
      {karte('Lehrstoff', <>
        <Zeile label="Lehrstoffeintragung bis Tage in die Vergangenheit" hilfe="Leer = unbegrenzt (Standard).">{zahl('lehrstoffTage', { leer: 'unbegrenzt', einheit: 'Tage' })}</Zeile>
        {schalter('lehrstoffZukunft', 'Lehrstoffeintragung für Stunden in der Zukunft erlauben')}
        {schalter('lehrstoffBlock', 'Lehrstoff für alle Stunden eines Blocks eintragen', 'Bei Doppel- und Mehrfachstunden gilt der Lehrstoff der ersten Stunde für den ganzen Block.')}
      </>)}
      {karte('Abwesenheitsgründe und Entschuldigungen', <>
        {schalter('statusMitGrund', 'Entschuldigungsstatus immer mit Abwesenheitsgrund ändern', 'Der Status folgt dem Abwesenheitsgrund (Stammdaten → Abwesenheitsgründe, „gilt als entschuldigt“).')}
        {schalter('grundTextGesperrt', 'Eingabe von Abwesenheitsgrund und Text nicht erlauben', 'Fachlehrkräfte können dann weder Grund noch Text eintragen; es gilt der Standardgrund.')}
        <Zeile label="Standardgrund für abwesende Schüler*innen">{auswahl('grundAbwesend', gruende)}</Zeile>
        <Zeile label="Standardgrund für später kommende Schüler*innen">{auswahl('grundSpaeter', gruende)}</Zeile>
        <Zeile label="Standardgrund für früher gehende Schüler*innen">{auswahl('grundFrueher', gruende)}</Zeile>
        <Zeile label="Standardgrund bei Abwesenheitsmeldung durch die Schüler*innen" hilfe="Standardgründe werden automatisch eingetragen und lassen sich ändern.">{auswahl('grundMeldung', gruende)}</Zeile>
        <Zeile label="Standard-Entschuldigungsstatus">{auswahl('standardStatus', STATUS, 240)}</Zeile>
        <Zeile label="Automatische Entschuldigung nach" hilfe="Offene Abwesenheiten erhalten nach so vielen Tagen automatisch diesen Status (einmal täglich). Leer = aus.">
          <Stack direction="row" gap={1} flexWrap="wrap">{zahl('autoTage', { leer: 'aus', einheit: 'Tagen' })}{auswahl('autoStatus', STATUS.slice(1), 220)}</Stack>
        </Zeile>
        <Zeile label="Nummerierung von Entschuldigungen">{auswahl('nummerierung', [['klassenuebergreifend', 'Klassenübergreifend'], ['klasse', 'Je Klasse'], ['schueler', 'Je Schüler*in'], ['keine', 'Keine Nummerierung']], 260)}</Zeile>
        <Zeile label="Entschuldigungstext vor Unterschrift">{text('textVorUnterschrift')}</Zeile>
        <Zeile label="Entschuldigungstext nach Unterschrift" hilfe="Beide Textblöcke erscheinen auf den Entschuldigungsberichten.">{text('textNachUnterschrift')}</Zeile>
        <Zeile label="Entschuldigungsschreiben für Schüler*innen">{auswahl('entschuldigungsschreiben', [['sichtbar', 'sichtbar'], ['ausgeblendet', 'ausgeblendet']], 200)}</Zeile>
      </>)}
      {karte('Fachlehrer-Entschuldigungen', <>
        {schalter('fachlehrerEntschuldigungen', 'Fachlehrer-Entschuldigungen aktivieren', 'Lehrkräfte entschuldigen einzelne Fehlstunden aus ihrem Unterricht unter Klassenbuch → Fehlzeiten bzw. in der App (Recht „Fehlstunden im eigenen Unterricht entschuldigen“). Gilt ohne Einschränkung für alle Jahrgänge.')}
        {schalter('fachlehrerJahrgangEinschraenken', 'Einschränkung auf Jahrgangsstufen', 'Nur Fehlstunden von Klassen in diesen Jahrgangsstufen. Die Stammdaten der Klassen müssen eine Jahrgangsstufe enthalten.')}
        <Zeile label="Jahrgangsstufen von – bis"><Stack direction="row" gap={1} alignItems="center">{zahl('fachlehrerJahrgangVon', { max: 20, leer: '–' })}<span>bis</span>{zahl('fachlehrerJahrgangBis', { max: 20, leer: '–' })}</Stack></Zeile>
        <Alert severity="warning" sx={{ mt: 1 }}><b>Deaktivieren während des Schuljahres:</b> Bitte vorher alle Abwesenheiten von der Klassenleitung kontrollieren und bestätigen lassen. Ein einmal gesetzter Status bleibt erhalten; Abwesenheiten mit unterschiedlichen Status der Stunden bleiben „offen“ (mehrdeutig). Wir empfehlen, die Funktion nicht im laufenden Schuljahr zu deaktivieren.</Alert>
      </>)}
      {karte('Automatische Erinnerung bei offenen Stunden', <>
        {schalter('erinnerung', 'Automatische Erinnerung über offene Stunden des aktuellen Schuljahres')}
        <Zeile label="Versand jeden">{auswahl('erinnerungTag', WOCHENTAGE.map((t, i) => [i + 1, t] as [number, string]), 200)}</Zeile>
        <Alert severity="info" sx={{ mt: 1 }}><b>Wann gilt eine Stunde als offen?</b> Nach „Offene Stunden anzeigen für“: fehlender Lehrstoff, fehlende Abwesenheitskontrolle oder beides.<br />
          <b>Wer erhält die Erinnerung?</b> Die für die Stunde verantwortliche Lehrkraft als Mitteilung – mit einem Link, der direkt zur Stunde führt.</Alert>
      </>, darf && <Button size="small" variant="outlined" startIcon={<SendRounded />} onClick={async () => {
        try {
          const r = await senden<{ lehrkraefte: number; stunden: number }>('/api/app/klassenbuch/einstellungen/erinnerung', {});
          toast(r.lehrkraefte ? `Erinnerung an ${r.lehrkraefte} ${r.lehrkraefte === 1 ? 'Lehrkraft' : 'Lehrkräfte'} gesendet (${r.stunden} offene Stunden).` : 'Keine offenen Stunden – es wurde keine Erinnerung gesendet.');
        } catch (err) { fehler(err); }
      }}>Jetzt senden</Button>)}
    </>
  );

  const unterricht = karte('Prüfungen', <>
    <Zeile label="Erlaubter Datumsbereich für Prüfungseingaben" hilfe="Leer = keine Einschränkung.">{bereich('pruefungVon', 'pruefungBis')}</Zeile>
    {schalter('raumkonflikt', 'Raumkonflikt bei Prüfung zulassen', 'Prüfungen dürfen dann auch in Räumen eingetragen werden, die zu dieser Zeit belegt sind.')}
    <Zeile label="Prüfungsübernahme nach EduOrga Studio bis Tage in die Zukunft" hilfe="Prüfungen werden wie Buchungen an EduOrga Studio übergeben; spätere Prüfungen folgen, sobald sie im Zeitraum liegen.">{zahl('uebernahmeTage', { leer: 'unbegrenzt', einheit: 'Tage' })}</Zeile>
    {schalter('nurVertretungsrelevant', 'Nur vertretungsrelevante Prüfungen nach EduOrga Studio übernehmen', 'Vertretungsrelevant sind Prüfungen mit Raum oder zugewiesener Lehrkraft (Aufsicht).')}
  </>);

  const gesamt = noten.schemen.find(s => s.id === noten.gesamt);
  const notenReiter = (
    <>
      {karte('Notenschemen', <>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Falls das verwendete Notenschema noch nicht vorhanden ist, legt die Administration unter Stammdaten → Notenschemen eigene Schemen an, z. B. „1 – 5“ oder „+, ~, -“. Ohne Werte bei den Noten werden für dieses Schema keine Durchschnitte berechnet.</Typography>
        {noten.schemen.length ? noten.schemen.map(s => (
          <Stack key={s.id} direction="row" gap={1.5} alignItems="center" flexWrap="wrap" sx={{ py: 1, borderTop: 1, borderColor: 'divider' }}>
            <Typography sx={{ fontWeight: 500, minWidth: 160 }}>{s.name}</Typography><Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>{s.noten.map(n => n.text).join(' · ')}</Typography>
            {s.mitDurchschnitt ? <Plakette ton="ok">mit Durchschnitt</Plakette> : <Plakette>ohne Werte</Plakette>}{!s.aktiv && <Plakette>inaktiv</Plakette>}
          </Stack>
        )) : <Typography variant="body2" color="text.secondary">Es sind noch keine Notenschemen angelegt.</Typography>}
        <Zeile label="Gesamtnotenschema"><Typography sx={{ pt: 1 }}>{gesamt ? gesamt.name : 'nicht gewählt'}</Typography></Zeile>
      </>, ich.admin && <Button size="small" variant="outlined" startIcon={<EditOutlined />} href="#/stammdaten/notenschemen">Verwalten</Button>)}
      {karte('Prüfungsarten', <Typography variant="body2" color="text.secondary">Prüfungsarten mit Höchstzahlen je Schüler*in, Farben und Notenschema pflegt die Administration unter Stammdaten → Prüfungsarten. Hat eine Prüfungsart kein Notenschema, wählt die Lehrkraft beim Anlegen der Prüfung ein individuelles Schema.</Typography>,
        ich.admin && <Button size="small" variant="outlined" startIcon={<EditOutlined />} href="#/stammdaten/pruefungsarten">Verwalten</Button>)}
    </>
  );

  const inhalt: Record<string, ReactNode> = { hauptseite, allgemein, unterricht, noten: notenReiter };
  return (
    <Seite titel={nurUnterricht ? 'Unterricht-Einstellungen' : 'Klassenbuch-Einstellungen'}>
      {!nurUnterricht && (
        <Tabs value={reiter} onChange={(_, v) => { setReiter(v); navigieren(`#/kbeinstellungen/${v}/r`, true); }} variant="scrollable" sx={{ mb: 2.5, borderBottom: 1, borderColor: 'divider' }}>
          {REITER.map(([r, t, s]) => <Tab key={r} value={r} label={t} icon={s as React.ReactElement} iconPosition="start" sx={{ minHeight: 48 }} />)}
        </Tabs>
      )}
      {!darf && <Alert severity="info" icon={<LockOutlined />} sx={{ mb: 2 }}>Die Einstellungen ändert die Administration (Recht „Klassenbuch-Einstellungen“). Sie sehen die aktuellen Werte.</Alert>}
      <Stack gap={2.5} sx={{ maxWidth: 1000, pb: darf ? 10 : 0 }}>{inhalt[nurUnterricht ? 'unterricht' : reiter]}</Stack>
      {darf && reiter !== 'noten' && (
        <Paper elevation={6} className="nicht-drucken" sx={{ position: 'sticky', bottom: 16, mt: 2, maxWidth: 1000, px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1, borderRadius: 999 }}>
          <Typography variant="body2" color={geaendert ? 'warning.main' : 'text.secondary'} sx={{ flex: 1, pl: 1 }}>{geaendert ? 'Nicht gespeicherte Änderungen' : 'Alle Änderungen gespeichert'}</Typography>
          <Button disabled={!geaendert} onClick={() => setW(gespeichert)}>Verwerfen</Button>
          <Button variant="contained" disabled={!geaendert || laeuft} onClick={async () => {
            setLaeuft(true);
            try { const neu = await senden<W>('/api/app/klassenbuch/einstellungen', w, 'PUT'); setGespeichert(neu); setW(neu); toast('Einstellungen gespeichert.'); } catch (err) { fehler(err); } finally { setLaeuft(false); }
          }}>Speichern</Button>
        </Paper>
      )}
    </Seite>
  );
}
