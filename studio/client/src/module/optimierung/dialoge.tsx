// Gewichtung der Optimierungsziele (Regler 0–5 je Abschnitt, Verteilung, Analyse) und Steuerdaten der Optimierung.
import {
  Checkbox, Field, Input, Slider, Tab, TabList, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow,
  makeStyles, mergeClasses, tokens,
} from '@fluentui/react-components';
import { useEffect, useState } from 'react';
import { api, einstellungLesen, einstellungSchreiben } from '@/api/client';
import { seiteOeffnen } from '@/kern/befehle';
import { darfSchreiben, zustand } from '@/kern/zustand';
import { StandardDialog, dialogZeigen } from '@/komponenten/dialoge';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { SuchAuswahl } from '@/komponenten/suchauswahl';

const useStile = makeStyles({
  gewichtung: { display: 'grid', gridTemplateColumns: '200px minmax(0, 1fr)', gap: '16px', minHeight: '440px' },
  regler: { display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '8px' },
  zeile: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 180px 150px 110px', alignItems: 'center', gap: '8px', padding: '2px 0' },
  wert: { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  standard: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  h3: { margin: '0 0 8px 0', fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold },
  leise: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, margin: '8px 0' },
  verteilung: { display: 'flex', alignItems: 'flex-end', gap: '16px', height: '220px', padding: '8px 0', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` },
  saeule: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', flex: 1, height: '100%', gap: '4px' },
  balken: { width: '100%', backgroundColor: tokens.colorBrandBackground, borderRadius: '3px 3px 0 0', minHeight: '1px' },
  achse: { display: 'flex', justifyContent: 'space-between', color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, marginTop: '4px' },
  rollen: { maxHeight: '52vh', overflow: 'auto' },
  z: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  formular: { display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr)', gap: '10px 16px', alignItems: 'center' },
  voll: { gridColumn: '1 / -1' },
  abschnitt: { gridColumn: '1 / -1', margin: '8px 0 0 0', fontSize: tokens.fontSizeBase300, fontWeight: tokens.fontWeightSemibold },
  aus: { opacity: 0.5 },
  zahl: { width: '96px' },
  hint: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, marginLeft: '8px' },
});

interface Regler { schluessel: string; text: string; karteikarte: string; wert: number; standard: number }
interface GewichtungDaten { regler: Regler[]; karteikarten: string[]; ziffern: { text: string }[] }

/** Abschnittsname einer Reglergruppe: „Lehrer (1/2)“ und „Lehrer (2/2)“ bilden einen Abschnitt „Lehrkräfte“. */
const abschnittVon = (karte: string) => { const b = String(karte).replace(/\s*\(\d+\/\d+\)$/, ''); return b === 'Lehrer' ? 'Lehrkräfte' : b; };
const zahl = (n: unknown) => (typeof n === 'number' ? n.toLocaleString('de-DE') : String(n ?? ''));

function Gewichtung({ g, schliessen }: { g: GewichtungDaten; schliessen: (w: boolean | null) => void }) {
  const s = useStile();
  const schreiben = darfSchreiben();
  const [werte, setWerte] = useState<Record<string, number>>(() => Object.fromEntries(g.regler.map((r) => [r.schluessel, r.wert])));
  const abschnitte = [...new Set(g.karteikarten.map(abschnittVon))];
  const karten = [...abschnitte, 'Verteilung', 'Analyse'];
  const [karte, setKarte] = useState(karten[0]!);
  const [analyse, setAnalyse] = useState<{ schluessel: string; text: string; verstoesse: number | null }[] | null>(null);
  const ziffer = (w: number) => g.ziffern[w]?.text || '';
  useEffect(() => { if (karte === 'Analyse' && !analyse) api.get<typeof analyse>(api.dok('/optimierung/gewichtung/analyse')).then(setAnalyse).catch(fehlerMelden); }, [karte, analyse]);
  const speichern = async () => { await api.put(api.dok('/optimierung/gewichtung'), { werte }); hinweis('Gewichtung gespeichert.', 'ok', 2000); };
  const anzahl = [0, 0, 0, 0, 0, 0];
  for (const v of Object.values(werte)) anzahl[Math.max(0, Math.min(5, v))]!++;
  const max = Math.max(1, ...anzahl);
  return (
    <StandardDialog<string> titel="Gewichtung" breite="min(960px, 96vw)"
      knoepfe={schreiben ? [{ text: 'Voreinstellungen', wert: 'standard' }, { text: 'Übernehmen', wert: 'uebernehmen' }, { text: 'OK', wert: 'ok', primaer: true }, { text: 'Abbrechen', wert: null }] : [{ text: 'Schließen', wert: null, primaer: true }]}
      beiKnopf={async (w) => {
        if (w === 'standard') { setWerte(Object.fromEntries(g.regler.map((r) => [r.schluessel, r.standard]))); return; }
        if (w === 'uebernehmen') { await speichern().catch(fehlerMelden); return; }
        if (w === 'ok') { try { await speichern(); } catch (e) { fehlerMelden(e); return; } schliessen(true); return; }
        schliessen(null);
      }}>
      <div className={s.gewichtung}>
        <TabList vertical size="small" selectedValue={karte} onTabSelect={(_, d) => setKarte(String(d.value))}>
          {karten.map((k) => <Tab key={k} value={k}>{k}</Tab>)}
        </TabList>
        <div>
          {karte === 'Verteilung' ? <>
            <h3 className={s.h3}>Verteilung der Gewichte</h3>
            <p className={s.leise}>Anzahl der Regler je Gewicht. Ziel ist eine glockenförmige Verteilung mit wenigen Reglern auf 4 und 5.</p>
            <div className={s.verteilung}>
              {anzahl.map((n, i) => (
                <div key={i} className={s.saeule} title={`${n} Regler auf ${i} (${ziffer(i)})`}>
                  <span>{n}</span><div className={s.balken} style={{ height: `${(n / max) * 80}%` }} /><span>{i}</span>
                </div>
              ))}
            </div>
            <div className={s.achse}><span>Unwichtig</span><span>Extrem wichtig</span></div>
          </> : karte === 'Analyse' ? <>
            <h3 className={s.h3}>Analyse</h3>
            <p className={s.leise}>Gewicht jedes Reglers und die Zahl der Verstöße im aktuellen Stundenplan.</p>
            <div className={s.rollen}>
              <Table size="extra-small">
                <TableHeader><TableRow><TableHeaderCell>Regler</TableHeaderCell><TableHeaderCell>Gewicht</TableHeaderCell><TableHeaderCell className={s.z}>Verstöße</TableHeaderCell></TableRow></TableHeader>
                <TableBody>
                  {!analyse ? <TableRow><TableCell colSpan={3}>Wird berechnet …</TableCell></TableRow> : analyse.map((r) => (
                    <TableRow key={r.schluessel}><TableCell>{r.text}</TableCell><TableCell>{`${werte[r.schluessel]} – ${ziffer(werte[r.schluessel] ?? 0)}`}</TableCell><TableCell className={s.z}>{r.verstoesse === null ? '–' : zahl(r.verstoesse)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </> : <>
            <h3 className={s.h3}>{karte}</h3>
            <div className={s.regler}>
              {g.regler.filter((r) => abschnittVon(r.karteikarte) === karte).map((r) => {
                const w = werte[r.schluessel] ?? 0;
                return (
                  <div key={r.schluessel} className={s.zeile}>
                    <span>{r.text}</span>
                    <Slider min={0} max={5} step={1} value={w} disabled={!schreiben} aria-label={r.text} aria-valuetext={`${w} – ${ziffer(w)}`} onChange={(_, d) => setWerte((x) => ({ ...x, [r.schluessel]: d.value }))} />
                    <span className={s.wert}><b>{w}</b> {ziffer(w)}</span>
                    <span className={s.standard}>{r.standard !== w ? `Voreinstellung ${r.standard}` : ''}</span>
                  </div>
                );
              })}
            </div>
            <p className={s.leise}>Gewichte 4 und 5 sparsam einsetzen: Zwischen 4 und 5 liegt ein sehr großer Unterschied. Regler zunächst höchstens auf 4 stellen.</p>
          </>}
        </div>
      </div>
    </StandardDialog>
  );
}

export async function gewichtungDialog() {
  const g = await api.get<GewichtungDaten>(api.dok('/optimierung/gewichtung'));
  await dialogZeigen<boolean>((zu) => <Gewichtung g={g} schliessen={zu} />);
}

// ---------------------------------------------------------------------------------------------
// Steuerdaten und Start

const STANDARD = { strategie: 'B', anzahlPlaene: 3, schritte: 2, startProzent: 30, erhoehungProzent: 20, aehnlichkeit: 0, bedingtFixieren: false, nurGewuenschteFreieTage: false, doppelstundenBesonders: false, nurNichtVerplante: false, zuordnen: false };
type Optionen = typeof STANDARD;

function Steuerdaten({ strategien, start, schliessen }: { strategien: { wert: string; text: string }[]; start: Optionen; schliessen: (o: Optionen | null) => void }) {
  const s = useStile();
  const [o, setO] = useState<Optionen>(start);
  const setzen = <K extends keyof Optionen>(k: K, v: Optionen[K]) => setO((x) => ({ ...x, [k]: v }));
  const stufen = ['C', 'D'].includes(o.strategie);
  const z = (k: 'anzahlPlaene' | 'schritte' | 'aehnlichkeit' | 'startProzent' | 'erhoehungProzent', min: number, max: number, hint: string, aus = false) => (
    <span><Input className={s.zahl} type="number" min={min} max={max} value={String(o[k])} disabled={aus} onChange={(_, d) => setzen(k, Math.round(Number(d.value) || 0))} /><span className={s.hint}>{hint}</span></span>
  );
  return (
    <StandardDialog<boolean> titel="Optimierung starten" breite="min(660px, 96vw)" knoepfe={[{ text: 'Optimierung starten', wert: true, primaer: true }, { text: 'Abbrechen', wert: null }]} beiKnopf={(w) => schliessen(w ? o : null)}>
      <div className={s.formular}>
        <h3 className={s.abschnitt}>Ablauf</h3>
        <span>Verfahren</span>
        <SuchAuswahl ariaLabel="Verfahren" wert={String(o.strategie)} beiWahl={(w) => setzen('strategie', w)} optionen={strategien.map((x) => ({ wert: String(x.wert), text: x.text.replace(/^[A-E]\s+/, '') }))} />
        <span>Pläne je Lauf</span>{z('anzahlPlaene', 1, 20, '1 bis 20')}
        <span>Optimierungsschritte je Plan</span>{z('schritte', 1, 9, '1 bis 9')}
        <span>Ähnlichkeit zum bisherigen Plan</span>{z('aehnlichkeit', 0, 4, '0 = beliebig, 4 = sehr ähnlich', o.bedingtFixieren)}
        <h3 className={s.abschnitt}>Optionen</h3>
        <div className={s.voll} style={{ display: 'flex', flexDirection: 'column' }}>
          <Checkbox label="Vorhandenen Plan bedingt fixieren" title="Vorhandene Stunden werden nur verlegt, wenn es nicht anders geht" checked={o.bedingtFixieren} onChange={(_, d) => setzen('bedingtFixieren', !!d.checked)} />
          <Checkbox label="Lehrkräfte nur an gewünschten Tagen frei" checked={o.nurGewuenschteFreieTage} onChange={(_, d) => setzen('nurGewuenschteFreieTage', !!d.checked)} />
          <Checkbox label="Doppelstunden besonders berücksichtigen" checked={o.doppelstundenBesonders} onChange={(_, d) => setzen('doppelstundenBesonders', !!d.checked)} />
          <Checkbox label="Nur nicht verplante Stunden setzen" checked={o.nurNichtVerplante} onChange={(_, d) => setzen('nurNichtVerplante', !!d.checked)} />
          <Checkbox label="Unterricht ohne Lehrkraft vorher automatisch zuordnen" checked={o.zuordnen} onChange={(_, d) => setzen('zuordnen', !!d.checked)} />
        </div>
        <h3 className={s.abschnitt}>Stufenweise Verfahren</h3>
        <span className={mergeClasses(!stufen && s.aus)}>Startanteil</span>{z('startProzent', 5, 100, 'Prozent der Stunden in der ersten Stufe', !stufen)}
        <span className={mergeClasses(!stufen && s.aus)}>Erhöhung je Stufe</span>{z('erhoehungProzent', 5, 100, 'Prozent', !stufen)}
        <Field className={s.voll}><span className={s.leise}>Vor den ersten Läufen die Eingabedaten mit der Diagnose prüfen. Fixierte Stunden bleiben immer stehen. Die Optimierung läuft auf dem Server im Hintergrund – Sie können währenddessen weiterarbeiten.</span></Field>
      </div>
    </StandardDialog>
  );
}

async function steuerdatenDialog(): Promise<Optionen | null> {
  const [strategien, gemerkt] = await Promise.all([api.get<{ wert: string; text: string }[]>(api.dok('/optimierung/strategien')), einstellungLesen<Partial<Optionen>>('optimierung.optionen')]);
  const o = await dialogZeigen<Optionen>((zu) => <Steuerdaten strategien={strategien} start={{ ...STANDARD, ...(gemerkt || {}) }} schliessen={zu} />);
  if (o) void einstellungSchreiben('optimierung.optionen', o);
  return o;
}

export async function optimierungStarten() {
  if (!zustand().dokument) return;
  const lauf = await api.get<{ status: string }>(api.dok('/optimierung/auftrag')).catch(() => null);
  if (lauf?.status === 'laeuft') { seiteOeffnen('optimierung.lauf'); hinweis('Die Optimierung läuft bereits.', 'info'); return; }
  if (!darfSchreiben()) { if (lauf?.status !== 'keiner') seiteOeffnen('optimierung.lauf'); else hinweis('Zum Optimieren fehlt die Berechtigung.', 'warnung'); return; }
  const o = await steuerdatenDialog();
  if (!o) return;
  const { zuordnen, ...optionen } = o;
  const a = await api.post<{ zugeordnet?: number }>(api.dok('/optimierung/start'), { optionen, zuordnen });
  if (a.zugeordnet) hinweis(`${a.zugeordnet} Kopplungszeilen wurde vor der Optimierung ein Lehrer zugeordnet.`, 'info', 5000);
  seiteOeffnen('optimierung.lauf', { neu: Date.now() });
}
