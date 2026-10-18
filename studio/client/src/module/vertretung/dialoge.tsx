// Dialoge der Vertretungsliste: Spalten (anzeigen, drucken, Kurz-/Langname), angezeigte Vertretungsarten, Raum zuordnen.
import { Checkbox, Select, Switch, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, makeStyles, tokens } from '@fluentui/react-components';
import { useEffect, useState } from 'react';
import { api, einstellungLesen, einstellungSchreiben } from '@/api/client';
import { StandardDialog, dialogZeigen } from '@/komponenten/dialoge';
import { fehlerMelden } from '@/komponenten/hinweise';
import { mitRueckfragen, vpfad } from './kern';

export const ANSICHTEN = ['Klasse - Standard', 'Lehrer - Standard', 'Druck - Klasse', 'Druck - Lehrer', 'Pausenaufsichten'];
const ANSICHT_TEXT: Record<string, string> = { 'Klasse - Standard': 'Klassen', 'Lehrer - Standard': 'Lehrkräfte', 'Druck - Klasse': 'Druckansicht Klassen', 'Druck - Lehrer': 'Druckansicht Lehrkräfte', Pausenaufsichten: 'Pausenaufsichten' };
export const ansichtText = (a: string) => ANSICHT_TEXT[a] || a;

/** Spaltenbezeichnungen der Oberfläche (Titel, Beschreibung); Schlüssel wie vom Server. */
export const TITEL: Record<string, [string, string]> = {
  Nr: ['Nr.', 'Nummer der Vertretung'], Art: ['Art', 'Art der Vertretung'], Std: ['Std.', 'Stunde'], Zeit: ['Zeit', 'Beginn und Ende'],
  Fach: ['Fach bisher', 'Fach laut Stundenplan'], NFach: ['Fach', 'Fach der Vertretung'], Lehrer: ['Lehrkraft', 'Lehrkraft laut Stundenplan'],
  Vertreter: ['Vertretung', 'Vertretende Lehrkraft'], AKlassen: ['Klassen bisher', 'Klassen laut Stundenplan'], Klassen: ['Klassen', 'Klassen der Vertretung'],
  Raum: ['Raum bisher', 'Raum laut Stundenplan'], NRaum: ['Raum', 'Raum der Vertretung'], Von: ['Verlegt von', 'Herkunft einer Verlegung'],
  Nach: ['Verlegt nach', 'Ziel einer Verlegung'], Text: ['Text', 'Text zur Vertretung'], Kz: ['Statistik', 'Statistikkennzeichen'], Grund: ['Grund', 'Abwesenheitsgrund'],
  UText: ['Unterrichtstext', 'Text des Unterrichts'], UZText: ['Zeilentext', 'Zeilentext des Unterrichts'], Beschr: ['Beschreibung', 'Beschreibung'],
  Entf: ['Entfall', 'Entfall'], Mitb: ['Mitbetreuung', 'Mitbetreuung'], Kopp: ['Kopplung', 'Gekoppelte Vertretungen'], Neu: ['Neu', 'Neue Vertretung'],
  Fix: ['Fixiert', 'Fixiert – wird nicht automatisch geändert'], ND: ['Nicht drucken', 'Wird nicht ausgegeben'], Text2: ['Text 2', 'Zweiter Text'],
  Ben: ['Benachrichtigen', 'Lehrkraft benachrichtigen'], Zaehler: ['Zähler', 'Vertretungszähler'], Wert: ['Wert', 'Wert bzw. Faktor'], Mehr: ['Mehrarbeit', 'Mehrarbeit'],
};
export interface ListenSpalte { schluessel: string; titel: string; feld?: string; breite: number; standard: boolean; nurLesen?: boolean; lang?: boolean }
export const spaltenTitel = (s: ListenSpalte) => TITEL[s.schluessel]?.[0] || s.titel;
export const spaltenFeld = (s: ListenSpalte) => TITEL[s.schluessel]?.[1] || s.feld || s.titel;

const FELDER = 'vertretung.felder';
export const ARTEN_AUS = 'vertretung.artenAus';

const useStile = makeStyles({
  rollen: { maxHeight: '56vh', overflow: 'auto', border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusMedium },
  leise: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, margin: '0 0 8px 0' },
  fett: { fontWeight: tokens.fontWeightSemibold },
  mitte: { textAlign: 'center' },
  arten: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '2px 12px', margin: '8px 0' },
  liste: { width: '100%', minHeight: '260px', fontFamily: 'inherit', fontSize: tokens.fontSizeBase300, padding: '4px', border: `1px solid ${tokens.colorNeutralStroke1}`, borderRadius: tokens.borderRadiusMedium, backgroundColor: tokens.colorNeutralBackground1, color: tokens.colorNeutralForeground1 },
  kopf: { fontWeight: tokens.fontWeightSemibold, margin: '0 0 8px 0' },
  reihe: { display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '8px' },
});

/** Gespeicherte Spaltenauswahl: Spalte → Kennzeichen („a“ aktiv, „d“ drucken, „L“ Langname); fehlt = Standard. */
export async function feldEinstellungen(ansicht: string, spalten: ListenSpalte[]): Promise<Record<string, string>> {
  const alle = (await einstellungLesen<Record<string, Record<string, string>>>(FELDER)) || {};
  const f: Record<string, string> = { ...(alle[ansicht] || {}) };
  for (const s of spalten) if (f[s.schluessel] === undefined) f[s.schluessel] = s.standard ? 'ad' : '';
  const nr = f.Nr || '';
  f.Nr = `a${nr.includes('d') ? 'd' : ''}${nr.includes('L') ? 'L' : ''}`;
  return f;
}

function FelderInhalt({ ansicht, spalten, start, schliessen }: { ansicht: string; spalten: ListenSpalte[]; start: Record<string, string>; schliessen: (w: Record<string, string> | 'std' | null) => void }) {
  const s = useStile();
  const [f, setF] = useState(start);
  const setzen = (k: string, z: string, an: boolean) => setF((x) => { const v = (x[k] || '').replace(z, ''); return { ...x, [k]: an ? v + z : v }; });
  return (
    <StandardDialog<string> titel={`Spalten – ${ansichtText(ansicht)}`} breite="520px"
      knoepfe={[{ text: 'Übernehmen', wert: 'ok', primaer: true }, { text: 'Grundeinstellung', wert: 'std' }, { text: 'Abbrechen', wert: null }]}
      beiKnopf={(w) => schliessen(w === 'ok' ? f : w === 'std' ? 'std' : null)}>
      <p className={s.leise}>Fett gesetzte Spalten gehören zur Grundeinstellung.</p>
      <div className={s.rollen}>
        <Table size="extra-small">
          <TableHeader><TableRow><TableHeaderCell>Spalte</TableHeaderCell><TableHeaderCell className={s.mitte}>Anzeigen</TableHeaderCell><TableHeaderCell className={s.mitte}>Drucken</TableHeaderCell><TableHeaderCell>Name</TableHeaderCell></TableRow></TableHeader>
          <TableBody>
            {spalten.map((x) => {
              const w = f[x.schluessel] || '';
              return (
                <TableRow key={x.schluessel}>
                  <TableCell className={x.standard ? s.fett : undefined} title={x.feld || ''}>{spaltenFeld(x)}</TableCell>
                  <TableCell className={s.mitte}><Checkbox checked={w.includes('a') || x.schluessel === 'Nr'} disabled={x.schluessel === 'Nr'} onChange={(_, d) => setzen(x.schluessel, 'a', !!d.checked)} /></TableCell>
                  <TableCell className={s.mitte}><Checkbox checked={w.includes('d')} onChange={(_, d) => setzen(x.schluessel, 'd', !!d.checked)} /></TableCell>
                  <TableCell>{x.lang ? <Select size="small" value={w.includes('L') ? 'L' : ''} onChange={(_, d) => setzen(x.schluessel, 'L', d.value === 'L')}><option value="">Kurzname</option><option value="L">Langname</option></Select> : null}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </StandardDialog>
  );
}

/** Dialog „Spalten“: Spalte / anzeigen / drucken / Name. true = geändert. */
export async function felderDialog(ansicht: string, spalten: ListenSpalte[]): Promise<boolean> {
  const start = await feldEinstellungen(ansicht, spalten);
  const w = await dialogZeigen<Record<string, string> | 'std'>((zu) => <FelderInhalt ansicht={ansicht} spalten={spalten} start={start} schliessen={zu} />);
  if (!w) return false;
  const alle = (await einstellungLesen<Record<string, Record<string, string>>>(FELDER)) || {};
  if (w === 'std') delete alle[ansicht];
  else alle[ansicht] = Object.fromEntries(spalten.map((x) => [x.schluessel, x.schluessel === 'Nr' ? `a${(w.Nr || '').replace('a', '')}` : w[x.schluessel] || '']));
  await einstellungSchreiben(FELDER, alle);
  return true;
}

interface Art { art: string; text: string; standard: string; farbe?: string | null }

function ArtenInhalt({ ansicht, arten, aus, unterricht, schliessen }: { ansicht: string; arten: Art[]; aus: Set<string>; unterricht: boolean; schliessen: (w: { aus: string[]; unterricht: boolean } | null) => void }) {
  const s = useStile();
  const [an, setAn] = useState<Record<string, boolean>>(() => Object.fromEntries(arten.map((a) => [a.art, a.art === 'Unterricht' ? unterricht : !aus.has(a.art)])));
  return (
    <StandardDialog<boolean> titel="Angezeigte Vertretungsarten" breite="480px" knoepfe={[{ text: 'Übernehmen', wert: true, primaer: true }, { text: 'Abbrechen', wert: null }]}
      beiKnopf={(w) => schliessen(w ? { aus: arten.filter((a) => a.art !== 'Unterricht' && !an[a.art]).map((a) => a.art), unterricht: !!an.Unterricht } : null)}>
      <p>{`Diese Vertretungsarten zeigt die Ansicht „${ansichtText(ansicht)}“:`}</p>
      <div className={s.arten}>{arten.map((a) => <Checkbox key={a.art} label={a.text || a.standard} checked={!!an[a.art]} onChange={(_, d) => setAn((x) => ({ ...x, [a.art]: !!d.checked }))} />)}</div>
      <p className={s.leise}>„Unterricht“ blendet auch den regulär stattfindenden Unterricht ein. Bezeichnung und Farbe der Vertretungsarten stehen in den Einstellungen unter „Arten und Farben“.</p>
    </StandardDialog>
  );
}

/** Angezeigte Vertretungsarten je Listenansicht und regulären Unterricht anzeigen. true = geändert. */
export async function artenDialog(ansicht: string): Promise<boolean> {
  const ein = await api.get<{ arten: Art[] }>(vpfad('/einstellungen'));
  const alle = ((await einstellungLesen<Record<string, unknown>>(ARTEN_AUS)) || {}) as Record<string, unknown>;
  const aus = new Set((alle[ansicht] as string[]) || []);
  const arten = ein.arten.slice().sort((a, b) => (a.text || a.standard).localeCompare(b.text || b.standard, 'de'));
  const w = await dialogZeigen<{ aus: string[]; unterricht: boolean }>((zu) => <ArtenInhalt ansicht={ansicht} arten={arten} aus={aus} unterricht={!!alle.__unterricht} schliessen={zu} />);
  if (!w) return false;
  alle[ansicht] = w.aus;
  alle.__unterricht = w.unterricht;
  await einstellungSchreiben(ARTEN_AUS, alle);
  return true;
}

interface VorschlagRaum { raum: number; name: string; lang: string; kap: number; ar: boolean; sr: boolean; besetzt: boolean; gesperrt: boolean; belegung: string; rg: string; gang: string }

function RaumInhalt({ id, schliessen }: { id: number; schliessen: (w: { raum: number | null; zusatz: boolean } | null) => void }) {
  const s = useStile();
  const [besetzt, setBesetzt] = useState(false);
  const [zusatz, setZusatz] = useState(false);
  const [daten, setDaten] = useState<{ kopf: string; raeume: VorschlagRaum[] } | null>(null);
  const [wahl, setWahl] = useState<number | null>(null);
  useEffect(() => {
    api.get<{ kopf: string; raeume: VorschlagRaum[] }>(vpfad(`/vorschlag/${id}?besetzt=${besetzt}`)).then((d) => { setDaten(d); setWahl(d.raeume[0]?.raum ?? null); }).catch(fehlerMelden);
  }, [id, besetzt]);
  return (
    <StandardDialog<string> titel="Raum zuordnen" breite="520px"
      knoepfe={[{ text: 'Zuordnen', wert: 'zu', primaer: true, deaktiviert: !wahl }, { text: 'Raum entfernen', wert: 'weg' }, { text: 'Abbrechen', wert: null }]}
      beiKnopf={(w) => schliessen(w === 'zu' ? { raum: wahl, zusatz } : w === 'weg' ? { raum: null, zusatz } : null)}>
      <p className={s.kopf}>{daten?.kopf}</p>
      <select className={s.liste} size={12} value={wahl ?? ''} onChange={(e) => setWahl(Number(e.target.value))} onDoubleClick={() => wahl && schliessen({ raum: wahl, zusatz })} aria-label="Räume">
        {(daten?.raeume || []).map((r) => (
          <option key={r.raum} value={r.raum} style={r.besetzt ? { color: 'var(--colorNeutralForeground3)' } : r.ar || r.sr ? { color: 'var(--up-aenderung)' } : undefined}>
            {`${r.name}${r.kap ? ` · ${r.kap} Plätze` : ''}${r.ar ? ' · Ausweichraum' : ''}${r.sr ? ' · Ausweich-Fachraum' : ''}${r.besetzt ? ` · ${r.gesperrt ? 'gesperrt' : `belegt: ${r.belegung}`}` : ''}`}
          </option>
        ))}
      </select>
      <div className={s.reihe}>
        <Switch label="Auch belegte Räume anzeigen" checked={besetzt} onChange={(_, d) => setBesetzt(d.checked)} />
        <Switch label="Zusätzlich zum bisherigen Raum zuordnen" checked={zusatz} onChange={(_, d) => setZusatz(d.checked)} />
      </div>
    </StandardDialog>
  );
}

/** Dialog „Raum zuordnen“ einer Vertretung (mögliche Räume wie im Vorschlag); Raum entfernen. */
export async function raumDialog(id: number, ids: number[], quelle?: string): Promise<boolean> {
  const w = await dialogZeigen<{ raum: number | null; zusatz: boolean }>((zu) => <RaumInhalt id={id} schliessen={zu} />);
  if (!w) return false;
  await mitRueckfragen(vpfad(`/vorschlag/${id}/raum`), { raum: w.raum, zusatz: w.zusatz, ids }, { quelle });
  return true;
}
