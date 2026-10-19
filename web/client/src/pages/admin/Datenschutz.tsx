// Administration → Datenschutz: Aufbewahrung & Löschung (Fristen je Kategorie mit Probelauf und Löschprotokoll), Auskunft & Löschung von Personen
// (Art. 15, 17, 18 DSGVO) und Datenschutzhinweise der Schule (Art. 13/14, Seite /datenschutz). Siehe docs/datenschutz/README.md.
import { useEffect, useState } from 'react';
import { Alert, Box, Button, Checkbox, FormControlLabel, Link, Stack, Switch, Tab, Tabs, TextField, Typography } from '@mui/material';
import { holen, senden } from '../../api/client';
import { Geladen } from '../../components/Seite';
import { Plakette, SuchFeld } from '../../components/Bausteine';
import { Tabelle } from '../../components/Tabelle';
import { datumDe } from '../../lib/datum';
import { bestaetigen, fehler, toast } from '../../lib/meldungen';
import { navigieren } from '../../lib/router';
import { useLaden } from '../../lib/useLaden';
import { Karte, kurzZeit } from './Admin';

const TEILE: [string, string][] = [['aufbewahrung', 'Aufbewahrung & Löschung'], ['personen', 'Auskunft & Löschung von Personen'], ['hinweise', 'Datenschutzhinweise'], ['protokoll', 'Löschprotokoll']];

export default function Datenschutz({ teil }: { teil?: string }) {
  const t = TEILE.some(x => x[0] === teil) ? teil! : 'aufbewahrung';
  return (
    <Stack gap={2}>
      <Tabs value={t} onChange={(_, v) => navigieren(`#/admin/datenschutz/${v}`, true)} variant="scrollable" allowScrollButtonsMobile>
        {TEILE.map(([id, text]) => <Tab key={id} value={id} label={text} />)}
      </Tabs>
      {t === 'aufbewahrung' ? <Aufbewahrung /> : t === 'personen' ? <Personen /> : t === 'hinweise' ? <Hinweise /> : <Loeschprotokoll />}
    </Stack>
  );
}

// ------------------------------------------------------------------ Aufbewahrung & Löschung

interface Kategorie {
  id: string; name: string; beschreibung: string; einheit: 'tage' | 'jahre'; vorgabe: number; vorgabeAktiv: boolean; grundlage: string; pruefen: boolean;
  minimum: number; maximum: number; aktiv: boolean; wert: number; grenze: string; anzahl: number; tabellen: Record<string, number>;
}
interface Eintrag { id: number; zeit: string; ausgeloest: string; kategorie: string; anzahl: number; grenze: string; details: string }
interface Aufbewahrungsdaten { kategorien: Kategorie[]; festgelegtVon: string; festgelegtAm: string; letzte: Eintrag[] }

const einheit = (k: { einheit: string }, n: number) => (k.einheit === 'jahre' ? `${n} ${n === 1 ? 'Jahr' : 'Jahre'} nach Schuljahresende` : `${n} Tage`);

function Aufbewahrung() {
  const g = useLaden(sig => holen<Aufbewahrungsdaten>('/api/app/admin/datenschutz/aufbewahrung', sig), []);
  const [w, setW] = useState<Record<string, { aktiv: boolean; wert: number }>>({});
  const [push, setPush] = useState<boolean | null>(null);
  useEffect(() => { if (g.daten) setW(Object.fromEntries(g.daten.kategorien.map(k => [k.id, { aktiv: k.aktiv, wert: k.wert }]))); }, [g.daten]);
  useEffect(() => { holen<{ details: boolean }>('/api/app/admin/push').then(d => setPush(!!d.details), () => setPush(null)); }, []);
  const speichern = async () => {
    try {
      await senden('/api/app/admin/datenschutz/aufbewahrung', { regeln: Object.entries(w).map(([id, r]) => ({ id, aktiv: r.aktiv, wert: r.wert })) }, 'PUT');
      toast('Aufbewahrungsfristen gespeichert.');
      void g.neu();
    } catch (err) { fehler(err); }
  };
  const ausfuehren = async (nur?: string[]) => {
    const d = g.daten!;
    const liste = d.kategorien.filter(k => (nur ? nur.includes(k.id) : k.aktiv));
    const n = liste.reduce((s, k) => s + k.anzahl, 0);
    if (!await bestaetigen('Jetzt löschen?', `${n} Einträge (${liste.map(k => k.name).join(', ') || '–'}) werden endgültig gelöscht. Das lässt sich nicht rückgängig machen (nur aus einer Sicherung).`, 'Endgültig löschen')) return;
    try {
      const r = await senden<{ anzahl: number }>('/api/app/admin/datenschutz/aufbewahrung/ausfuehren', { kategorien: nur ?? null });
      toast(`${r.anzahl} Einträge gelöscht.`);
      void g.neu();
    } catch (err) { fehler(err); }
  };
  return (
    <Geladen g={g}>{d => {
      const geaendert = d.kategorien.some(k => w[k.id] && (w[k.id].aktiv !== k.aktiv || w[k.id].wert !== k.wert));
      const inhaltAus = d.kategorien.filter(k => k.pruefen && !k.aktiv);
      return (
        <Stack gap={2}>
          <Alert severity={inhaltAus.length ? 'warning' : 'info'}>
            Die Schule legt als Verantwortliche fest, wie lange Daten gespeichert werden (Art. 5 Abs. 1 Buchst. e DSGVO). Die Vorgaben sind Vorschläge; Fristen für
            Schülerdaten stützen sich auf § 9 VO-DV I (Klassenbuch 10 Jahre, übrige Daten 5 Jahre – Fassung in der BASS und Anwendung mit der bzw. dem
            Datenschutzbeauftragten prüfen). Technische Protokolle sind von Anfang an begrenzt; inhaltliche Kategorien löschen erst, wenn Sie sie einschalten.
            {inhaltAus.length > 0 && <> Noch nicht eingeschaltet: {inhaltAus.map(k => k.name).join(', ')}.</>}
            {d.festgelegtAm && <> Zuletzt festgelegt am {kurzZeit(d.festgelegtAm)} von {d.festgelegtVon}.</>}
          </Alert>
          <Tabelle zeilen={d.kategorien} schluessel={k => k.id}
            spalten={[
              { id: 'n', kopf: 'Daten', zelle: k => <Box><Typography sx={{ fontWeight: 500 }}>{k.name}{k.pruefen && <Plakette ton="warnung" sx={{ ml: 1 }} title="Vorgabe der Schule – zu prüfen">zu prüfen</Plakette>}</Typography>
                <Typography variant="caption" color="text.secondary" component="div">{k.beschreibung}</Typography>
                <Typography variant="caption" color="text.secondary" component="div">Grundlage: {k.grundlage}</Typography></Box> },
              { id: 'a', kopf: 'Automatisch löschen', zelle: k => <Switch checked={!!w[k.id]?.aktiv} onChange={e => setW({ ...w, [k.id]: { ...w[k.id], aktiv: e.target.checked } })} inputProps={{ 'aria-label': `${k.name} automatisch löschen` }} /> },
              { id: 'f', kopf: 'Frist', zelle: k => <Stack gap={0.5}>
                <TextField type="number" size="small" sx={{ width: 120 }} value={w[k.id]?.wert ?? k.wert} label={k.einheit === 'jahre' ? 'Jahre' : 'Tage'}
                  onChange={e => setW({ ...w, [k.id]: { ...w[k.id], wert: Number(e.target.value) } })} slotProps={{ htmlInput: { min: k.minimum, max: k.maximum } }} />
                <Typography variant="caption" color="text.secondary">Vorgabe: {einheit(k, k.vorgabe)}</Typography></Stack> },
              { id: 'v', kopf: 'Probelauf', zelle: k => <Box><Typography variant="body2">{k.anzahl === 0 ? 'nichts zu löschen' : `${k.anzahl} Einträge`}</Typography>
                <Typography variant="caption" color="text.secondary">vor dem {datumDe(k.grenze)}</Typography>
                {k.anzahl > 0 && <Box><Link component="button" variant="caption" onClick={() => void ausfuehren([k.id])}>jetzt löschen</Link></Box>}</Box> },
            ]} />
          <Stack direction="row" gap={1} flexWrap="wrap">
            <Button variant="contained" disabled={!geaendert} onClick={speichern}>Fristen speichern</Button>
            <Button variant="outlined" color="error" onClick={() => void ausfuehren()}>Eingeschaltete Kategorien jetzt löschen</Button>
            <Button onClick={() => void g.neu()}>Probelauf aktualisieren</Button>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Der Probelauf zählt mit den gespeicherten Fristen, was gelöscht würde. Eingeschaltete Kategorien löscht EduOrga Web einmal täglich automatisch; jeder Lauf steht im
            Löschprotokoll (nur Anzahlen). Frist „Jahre“: gelöscht wird nach Ablauf des Kalenderjahres, in dem das Schuljahr des Eintrags endete, plus die Zahl der Jahre.
            Datenbanksicherungen enthalten gelöschte Daten noch bis zum Ende ihrer Aufbewahrung (Standard 14 Sicherungen).
          </Typography>
          <Karte titel="Sofort-Benachrichtigungen (iOS)">
            {push === null ? <Typography variant="body2" color="text.secondary">Nicht verfügbar.</Typography> : (
              <Stack gap={1}>
                <FormControlLabel control={<Switch checked={push} onChange={async e => {
                  const v = e.target.checked;
                  try { await senden('/api/app/admin/push', { details: v }, 'PUT'); setPush(v); toast('Gespeichert.'); } catch (err) { fehler(err); }
                }} />} label="Einzelheiten (Tag, Stunde, Fach, Klasse) in Benachrichtigungen senden" />
                <Typography variant="body2" color="text.secondary">Aus (Standard): Die Benachrichtigung enthält nur „Änderung im Stundenplan“. Inhalte von Push-Nachrichten laufen über
                  den Dienst von Apple und erscheinen auf dem Sperrbildschirm.</Typography>
              </Stack>
            )}
          </Karte>
        </Stack>
      );
    }}</Geladen>
  );
}

// ------------------------------------------------------------------ Personen: Auskunft, Löschung, Anonymisierung

interface Konto { id: number; login: string; anzeigename: string; rollenname: string; gesperrt: boolean }
interface Schueler { id: number; name: string; klasse: string; gesperrtBis: string | null }
interface Plan { einschraenken: boolean; fristBis: string | null; letzterEintrag: string | null; loeschen: Record<string, number>; aufbewahren: Record<string, number>; hinweise: string[] }

function Personen() {
  const [suche, setSuche] = useState('');
  const g = useLaden(sig => holen<{ konten: Konto[]; schueler: Schueler[] }>(`/api/app/admin/datenschutz/personen?suche=${encodeURIComponent(suche)}`, sig), [suche]);
  const [plan, setPlan] = useState<{ s: Schueler; p: Plan } | null>(null);
  const [grund, setGrund] = useState('');
  const [ok, setOk] = useState(false);
  const auskunft = (art: 'benutzer' | 'schueler', id: number) => (
    <Stack direction="row" gap={1}>
      <Button size="small" href={`/api/app/admin/datenschutz/auskunft?${art}=${id}&format=pdf`} target="_blank" rel="noopener">Auskunft (PDF)</Button>
      <Button size="small" href={`/api/app/admin/datenschutz/auskunft?${art}=${id}&format=json`} download>JSON</Button>
    </Stack>
  );
  const planLaden = async (s: Schueler) => {
    try { setPlan({ s, p: await holen<Plan>(`/api/app/admin/datenschutz/schueler/${s.id}/loeschen`) }); setGrund(''); setOk(false); } catch (err) { fehler(err); }
  };
  const loeschen = async () => {
    if (!plan) return;
    try {
      const r = await senden<Plan>(`/api/app/admin/datenschutz/schueler/${plan.s.id}/loeschen`, { grund, bestaetigt: ok });
      toast(r.einschraenken ? `Gesperrt bis ${datumDe(r.fristBis ?? '')}; übrige Daten gelöscht.` : 'Gelöscht.');
      setPlan(null);
      void g.neu();
    } catch (err) { fehler(err); }
  };
  const anonymisieren = async (k: Konto) => {
    if (!await bestaetigen('Konto anonymisieren?', `„${k.login}“ wird gesperrt; Name, E-Mail, Anmeldeprotokoll, Geräte und Zuordnungen werden gelöscht. Mitteilungen bleiben für die Empfänger*innen als „Gelöschtes Konto“ erhalten.`, 'Anonymisieren und sperren')) return;
    try { await senden(`/api/app/admin/datenschutz/benutzer/${k.id}/anonymisieren`, {}); toast('Konto anonymisiert.'); void g.neu(); } catch (err) { fehler(err); }
  };
  return (
    <Stack gap={2}>
      <Alert severity="info">
        Auskunft (Art. 15 DSGVO): alle in EduOrga Web gespeicherten Daten einer Person als PDF bzw. JSON. Berichtigung (Art. 16): unter Benutzer bzw. Schüler*innen.
        Löschung (Art. 17): Läuft für Klassenbuch- oder Abwesenheitsdaten noch eine Aufbewahrungsfrist, werden diese gesperrt (Art. 18) und nach Fristablauf gelöscht.
        Daten in EduOrga Studio und in der Schulverwaltung (SchILD-NRW) sind getrennt zu bearbeiten.
      </Alert>
      <SuchFeld wert={suche} onWert={setSuche} platzhalter="Name, Klasse oder Benutzername" breite={340} />
      <Geladen g={g}>{d => (
        <Stack gap={2}>
          <Karte titel="Schüler*innen">
            <Tabelle zeilen={d.schueler} schluessel={s => s.id} leer="Keine Treffer." dicht
              spalten={[
                { id: 'n', kopf: 'Name', zelle: s => <>{s.name}{s.gesperrtBis && <Plakette ton="warnung" sx={{ ml: 1 }}>gesperrt bis {datumDe(s.gesperrtBis)}</Plakette>}</> },
                { id: 'k', kopf: 'Klasse', zelle: s => s.klasse },
                { id: 'a', kopf: '', zelle: s => <Stack direction="row" gap={1} flexWrap="wrap">{auskunft('schueler', s.id)}
                  {!s.gesperrtBis && <Button size="small" color="error" onClick={() => void planLaden(s)}>Löschen …</Button>}</Stack> },
              ]} />
          </Karte>
          {plan && (
            <Karte titel={`Löschen: ${plan.s.name} (${plan.s.klasse})`}>
              <Stack gap={1.5}>
                {plan.p.hinweise.map((h, i) => <Alert key={i} severity="warning">{h}</Alert>)}
                <Typography variant="body2"><b>Wird gelöscht:</b> {Object.entries(plan.p.loeschen).map(([t, n]) => `${t} (${n})`).join(', ') || 'keine Einträge'}; persönliche Angaben (Geburtsdatum, E-Mail, Bemerkung) werden geleert, Schülerkonten gesperrt.</Typography>
                {plan.p.einschraenken && <Typography variant="body2"><b>Wird bis {datumDe(plan.p.fristBis ?? '')} gesperrt:</b> {Object.entries(plan.p.aufbewahren).map(([t, n]) => `${t} (${n})`).join(', ')}</Typography>}
                <TextField label="Grund bzw. Antrag (für die Dokumentation)" value={grund} onChange={e => setGrund(e.target.value)} slotProps={{ htmlInput: { maxLength: 500 } }} />
                <FormControlLabel control={<Checkbox checked={ok} onChange={e => setOk(e.target.checked)} />} label="Ich habe die Löschung geprüft (Antrag, Aufbewahrungsfristen) und bestätige sie." />
                <Stack direction="row" gap={1}><Button variant="contained" color="error" disabled={!ok} onClick={loeschen}>{plan.p.einschraenken ? 'Löschen bzw. sperren' : 'Endgültig löschen'}</Button><Button onClick={() => setPlan(null)}>Abbrechen</Button></Stack>
              </Stack>
            </Karte>
          )}
          <Karte titel="Benutzerkonten">
            <Tabelle zeilen={d.konten} schluessel={k => k.id} leer="Keine Treffer." dicht
              spalten={[
                { id: 'n', kopf: 'Konto', zelle: k => <>{k.anzeigename || k.login} <Typography component="span" variant="caption" color="text.secondary">{k.login}</Typography>{k.gesperrt && <Plakette sx={{ ml: 1 }}>gesperrt</Plakette>}</> },
                { id: 'r', kopf: 'Rolle', zelle: k => k.rollenname },
                { id: 'a', kopf: '', zelle: k => <Stack direction="row" gap={1} flexWrap="wrap">{auskunft('benutzer', k.id)}
                  {!k.login.startsWith('geloescht-') && <Button size="small" color="error" onClick={() => void anonymisieren(k)}>Anonymisieren …</Button>}</Stack> },
              ]} />
          </Karte>
        </Stack>
      )}</Geladen>
    </Stack>
  );
}

// ------------------------------------------------------------------ Datenschutzhinweise

interface Angaben { verantwortlicher: string; anschrift: string; vertretung: string; kontakt: string; dsbName: string; dsbKontakt: string; betreiber: string; aufsichtsbehoerde: string; zusatz: string; geprueft: boolean; stand: string }

const FELDER: [keyof Angaben, string, string, boolean?][] = [
  ['verantwortlicher', 'Verantwortlicher (Name der Schule)', 'z. B. Städtisches Gymnasium Musterstadt'],
  ['anschrift', 'Anschrift', 'Straße, PLZ Ort', true],
  ['vertretung', 'Vertreten durch', 'Schulleiterin bzw. Schulleiter'],
  ['kontakt', 'Kontakt der Schule', 'E-Mail, Telefon'],
  ['dsbName', 'Datenschutzbeauftragte*r', 'Name (behördliche*r Datenschutzbeauftragte*r der Schule)'],
  ['dsbKontakt', 'Kontakt der bzw. des Datenschutzbeauftragten', 'E-Mail, Telefon, Anschrift', true],
  ['betreiber', 'Betrieb des Servers (Auftragsverarbeiter)', 'z. B. Schulträger, IT-Dienstleister – mit AV-Vertrag nach Art. 28 DSGVO', true],
  ['aufsichtsbehoerde', 'Aufsichtsbehörde (leer = LDI NRW)', 'Landesbeauftragte für Datenschutz und Informationsfreiheit NRW'],
  ['zusatz', 'Weitere Hinweise der Schule', 'z. B. Rechtsgrundlagen im Einzelnen, Gesundheitsdaten, Fotos, weitere Empfänger', true],
];

function Hinweise() {
  const g = useLaden(sig => holen<Angaben>('/api/app/admin/datenschutz/hinweise', sig), []);
  const [w, setW] = useState<Angaben | null>(null);
  useEffect(() => { if (g.daten) setW(g.daten); }, [g.daten]);
  return (
    <Geladen g={g}>{() => w && (
      <Stack gap={2} sx={{ maxWidth: 860 }}>
        <Alert severity={w.geprueft ? 'success' : 'warning'}>
          Die Seite <Link href="/datenschutz" target="_blank" rel="noopener">/datenschutz</Link> ist ohne Anmeldung erreichbar und von der Anmeldeseite, dem Kontomenü und den Apps verlinkt.
          Sie ist eine Vorlage von EduOrga, die die Schule mit ihrer bzw. ihrem Datenschutzbeauftragten prüfen und ergänzen muss. Schüler- und Elternkonten sehen nach
          der Anmeldung einen Hinweis darauf – erneut, sobald Sie hier speichern.
        </Alert>
        <Karte>
          <Stack gap={2}>
            {FELDER.map(([k, label, platz, mehr]) => (
              <TextField key={k} label={label} placeholder={platz} value={String(w[k] ?? '')} onChange={e => setW({ ...w, [k]: e.target.value })} multiline={!!mehr} minRows={mehr ? 2 : undefined} />
            ))}
            <FormControlLabel control={<Checkbox checked={w.geprueft} onChange={e => setW({ ...w, geprueft: e.target.checked })} />}
              label="Von der Schule bzw. der/dem Datenschutzbeauftragten geprüft (blendet den Vorlagen-Hinweis aus)" />
            <Stack direction="row" gap={1}>
              <Button variant="contained" onClick={async () => {
                try { setW(await senden<Angaben>('/api/app/admin/datenschutz/hinweise', w, 'PUT')); toast('Datenschutzhinweise gespeichert.'); } catch (err) { fehler(err); }
              }}>Speichern</Button>
              <Button href="/datenschutz" target="_blank" rel="noopener">Vorschau</Button>
            </Stack>
            {w.stand && <Typography variant="caption" color="text.secondary">Stand: {kurzZeit(w.stand)}</Typography>}
          </Stack>
        </Karte>
      </Stack>
    )}</Geladen>
  );
}

// ------------------------------------------------------------------ Löschprotokoll

function Loeschprotokoll() {
  const g = useLaden(sig => holen<Eintrag[]>('/api/app/admin/datenschutz/loeschprotokoll', sig), []);
  return (
    <Geladen g={g}>{d => (
      <Stack gap={1}>
        <Tabelle zeilen={d} schluessel={e => e.id} leer="Noch keine Löschungen." dicht
          spalten={[
            { id: 'z', kopf: 'Zeit', nowrap: true, zelle: e => kurzZeit(e.zeit) },
            { id: 'a', kopf: 'Ausgelöst', zelle: e => e.ausgeloest },
            { id: 'k', kopf: 'Kategorie', zelle: e => e.kategorie },
            { id: 'n', kopf: 'Anzahl', rechts: true, zelle: e => e.anzahl },
            { id: 'g', kopf: 'Grenze', nowrap: true, zelle: e => (e.grenze ? datumDe(e.grenze) : '–') },
            { id: 'd', kopf: 'Einzelheiten', zelle: e => e.details },
          ]} />
        <Typography variant="body2" color="text.secondary">Das Löschprotokoll enthält nur Anzahlen und Nummern, keine gelöschten Inhalte (Nachweis nach Art. 5 Abs. 2 DSGVO).</Typography>
      </Stack>
    )}</Geladen>
  );
}
