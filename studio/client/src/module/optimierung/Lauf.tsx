// Automatische Planung: Hintergrundauftrag auf dem Server (Status, Fortschritt, Abbrechen), Ergebnisse mit Kennzahlen,
// Vergleich aktueller Plan / Ergebnisplan, Plan übernehmen (409 = Schuldatei inzwischen geändert → Rückfrage).
import {
  Badge, Button, ProgressBar, Select, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, makeStyles, mergeClasses, tokens,
} from '@fluentui/react-components';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/api/client';
import { useAnsicht, type AnsichtProps } from '@/kern/ansichten';
import { befehl } from '@/kern/befehle';
import { betrifft, useEreignis } from '@/kern/ereignisse';
import { useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, Feld, Leer, Trenner, Werkzeug } from '@/komponenten/ansicht';
import { frage } from '@/komponenten/dialoge';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { MenueKnopf } from '@/komponenten/menue';
import { Stundenplanraster, type Stundenplan } from '@/komponenten/raster/Stundenplanraster';
import { useElemente } from '../gemeinsam';
import { gewichtungDialog, optimierungStarten } from './dialoge';

const KENNZAHLEN: [string, string, string?][] = [
  ['bewertung', 'Bewertung', 'Bewertungszahl: je niedriger, umso weniger Vorgaben sind verletzt'], ['nichtVerplant', 'Nicht verplant'],
  ['hohlstundenKlassen', 'Hohlstunden Klassen'], ['kernzeitverletzungen', 'Kernzeit verletzt'], ['fachZweimalTag', 'Fach mehrmals am Tag'],
  ['doppelstundenfehler', 'Doppelstunden verletzt'], ['zeitwunschverletzungen', 'Zeitwünsche verletzt'], ['hohlstundenLehrer', 'Hohlstunden Lehrkräfte'],
  ['ohneRaum', 'Ohne Raum'], ['kollisionen', 'Kollisionen'],
];
const zahl = (n: unknown) => (typeof n === 'number' ? n.toLocaleString('de-DE') : String(n ?? ''));

interface Ergebnis { nummer: number; kennzahlen: Record<string, number>; abweichungen: number; dauer: number }
interface Auftrag {
  status: 'keiner' | 'laeuft' | 'fertig' | 'abgebrochen' | 'fehler' | 'uebernommen'; anteil: number; phase: string; strategie: string; start: string; benutzer: string;
  plaene: number; optionen: { schritte: number }; dauer: number; fehler?: string; dokumentGeaendert?: boolean; ergebnisse?: Ergebnis[]; aktuell?: Record<string, number>; uebernommen?: number;
}

const useStile = makeStyles({
  seite: { padding: '12px 20px 24px 20px', display: 'flex', flexDirection: 'column', gap: '14px' },
  status: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  verfahren: { fontWeight: tokens.fontWeightSemibold, fontSize: tokens.fontSizeBase400 },
  leise: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  daten: { display: 'grid', gridTemplateColumns: 'repeat(4, auto)', justifyContent: 'start', gap: '2px 24px', fontSize: tokens.fontSizeBase300 },
  dt: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  hinweis: { color: 'var(--up-warnung)', backgroundColor: 'var(--up-warnung-flaeche)', padding: '8px 12px', borderRadius: tokens.borderRadiusMedium },
  fehler: { color: tokens.colorPaletteRedForeground1 },
  rollen: { overflowX: 'auto', border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusMedium },
  z: { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  kopf: { whiteSpace: 'normal', hyphens: 'auto', overflowWrap: 'break-word', lineHeight: '16px', verticalAlign: 'bottom', paddingTop: '6px', paddingBottom: '6px', '& > *': { whiteSpace: 'normal', overflow: 'visible', hyphens: 'auto', overflowWrap: 'break-word' } },
  gruen: { color: tokens.colorPaletteGreenForeground1, fontWeight: tokens.fontWeightSemibold },
  rot: { color: tokens.colorPaletteRedForeground1 },
  zeile: { cursor: 'pointer' },
  aktuell: { backgroundColor: tokens.colorNeutralBackground2, fontWeight: tokens.fontWeightSemibold },
  gewaehlt: { backgroundColor: tokens.colorBrandBackground2, ':hover': { backgroundColor: tokens.colorBrandBackground2Hover } },
  h3: { margin: 0, fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold },
  vergleichKopf: { display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' },
  plaene: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', minHeight: '360px' },
  plan: { display: 'flex', flexDirection: 'column', border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusMedium, minHeight: '360px', overflow: 'hidden' },
  planTitel: { padding: '6px 10px', fontWeight: tokens.fontWeightSemibold, borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, backgroundColor: tokens.colorNeutralBackground2 },
});

const STATUS: Record<string, [string, 'informative' | 'success' | 'warning' | 'danger' | 'brand']> = {
  laeuft: ['Läuft', 'brand'], fertig: ['Abgeschlossen', 'success'], abgebrochen: ['Abgebrochen', 'warning'], fehler: ['Fehler', 'danger'], uebernommen: ['Übernommen', 'informative'],
};

function Vergleich({ nummer, p, setzen }: { nummer: number; p: { typ: string; element?: number }; setzen: (x: { vergleichTyp?: string; vergleichElement?: number }) => void }) {
  const s = useStile();
  const typ = p.typ || 'klasse';
  const liste = useElemente(typ);
  const element = p.element && liste.some((e) => e.id === p.element) ? p.element : liste[0]?.id;
  const [plaene, setPlaene] = useState<[Stundenplan, Stundenplan] | null>(null);
  useEffect(() => {
    if (!element) return;
    Promise.all([api.get<Stundenplan>(api.dok(`/stundenplan/${typ}/${element}`)), api.get<Stundenplan>(api.dok(`/optimierung/auftrag/plan/${nummer}/${typ}/${element}`))])
      .then((x) => setPlaene(x)).catch(fehlerMelden);
  }, [typ, element, nummer]);
  const k = (pl: Stundenplan) => new Map(pl.zellen.map((z) => [`${z.tag}:${z.stunde}`, z.eintraege.map((e) => e.u).sort().join(',')]));
  const ka = plaene ? k(plaene[0]) : new Map<string, string>(), kb = plaene ? k(plaene[1]) : new Map<string, string>();
  return (
    <section>
      <div className={s.vergleichKopf}>
        <h3 className={s.h3}>Vergleich</h3>
        <Feld titel="Plan von">
          <Select size="small" value={typ} onChange={(_, d) => setzen({ vergleichTyp: d.value, vergleichElement: undefined })}>
            <option value="klasse">Klasse</option><option value="lehrer">Lehrkraft</option><option value="raum">Raum</option>
          </Select>
          <Select size="small" value={element ? String(element) : ''} onChange={(_, d) => setzen({ vergleichElement: Number(d.value) })}>
            {liste.map((e) => <option key={e.id} value={e.id}>{e.l ? `${e.k} – ${e.l}` : e.k}</option>)}
          </Select>
        </Feld>
        <span className={s.leise}>Geänderte Stunden sind im rechten Plan hervorgehoben.</span>
      </div>
      <div className={s.plaene} style={{ marginTop: 8 }}>
        <div className={s.plan}><div className={s.planTitel}>Aktueller Plan</div><Stundenplanraster id={`vgl-a-${nummer}`} plan={plaene?.[0] ?? null} typ={typ} kompakt /></div>
        <div className={s.plan}><div className={s.planTitel}>{`Plan ${nummer}`}</div>
          <Stundenplanraster id={`vgl-b-${nummer}`} plan={plaene?.[1] ?? null} typ={typ} kompakt feldKlasse={(t, st) => ((ka.get(`${t}:${st}`) || '') !== (kb.get(`${t}:${st}`) || '') ? 'op-anders' : null)} />
        </div>
      </div>
    </section>
  );
}

export default function Lauf({ p }: AnsichtProps) {
  const s = useStile();
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const [auftrag, setAuftrag] = useState<Auftrag | null>(null);
  const [gewaehlt, setGewaehlt] = useState<number | null>(null);
  const vergleich = !!p.vergleich;
  const gemeldet = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  async function abfragen() {
    clearTimeout(timer.current);
    let x: Auftrag | null = null;
    try { x = await api.get<Auftrag>(api.dok('/optimierung/auftrag')); setAuftrag(x); } catch (e) { if ((e as { status?: number }).status !== 401) console.warn(e); }
    if (x?.status === 'laeuft') timer.current = setTimeout(() => void abfragen(), 600);
    else if (x?.status === 'fertig' && !gemeldet.current) { gemeldet.current = true; hinweis('Optimierung abgeschlossen – Ergebnis prüfen und Plan übernehmen.', 'ok', 5000); }
  }
  useEffect(() => { gemeldet.current = false; void abfragen(); return () => clearTimeout(timer.current); }, [p.neu]); // eslint-disable-line react-hooks/exhaustive-deps
  useEreignis('daten', (e) => { if (auftrag?.status !== 'laeuft' && betrifft(e, 'Stundenplan')) void abfragen(); });
  useEffect(() => {
    const e = auftrag?.ergebnisse;
    if (e?.length && (!gewaehlt || !e.some((x) => x.nummer === gewaehlt))) setGewaehlt(e[0]!.nummer);
  }, [auftrag]); // eslint-disable-line react-hooks/exhaustive-deps

  async function uebernehmen(trotz = false): Promise<void> {
    if (!gewaehlt || !schreiben) return;
    try {
      const erg = await api.post<{ nummer: number; planstunden: number }>(api.dok('/optimierung/auftrag/uebernehmen'), { nummer: gewaehlt, trotzAenderung: trotz });
      hinweis(`Plan ${erg.nummer} übernommen (${zahl(erg.planstunden)} Stunden) – Strg+Z macht es rückgängig.`, 'ok', 4000);
      await abfragen();
    } catch (e) {
      const f = e as { status?: number; message: string };
      if (f.status === 409 && (await frage(`${f.message}\n\nTrotzdem übernehmen?`, { gefahr: true, ja: 'Übernehmen', nein: 'Abbrechen' }))) return uebernehmen(true);
      if (f.status !== 409) throw e;
    }
  }

  const x = auftrag;
  const laeuft = x?.status === 'laeuft';
  const titel = laeuft ? `Automatische Planung – ${Math.round((x?.anteil || 0) * 100)} %` : 'Automatische Planung';
  const [statusText, farbe] = (x ? (STATUS[x.status] || [x.status, 'informative']) : ['', 'informative']) as [string, 'informative' | 'success' | 'warning' | 'danger' | 'brand'];
  return (
    <AnsichtRahmen titel={titel} rollen
      werkzeuge={<>
        <Werkzeug text="Neue Optimierung" titel="Verfahren wählen und Lauf starten" deaktiviert={laeuft || !schreiben} aktion={optimierungStarten} />
        {laeuft ? <Werkzeug text="Abbrechen" titel="Laufende Optimierung abbrechen" deaktiviert={!schreiben} aktion={async () => { setAuftrag(await api.post<Auftrag>(api.dok('/optimierung/auftrag/abbrechen'))); }} /> : null}
        <Trenner />
        <Werkzeug text="Plan übernehmen" titel="Markierten Plan als Stundenplan übernehmen" deaktiviert={!schreiben || !x?.ergebnisse?.length || !gewaehlt || laeuft} aktion={() => uebernehmen()} />
        <Werkzeug text="Vergleich" titel="Aktuellen und markierten Plan nebeneinander zeigen" gedrueckt={vergleich} deaktiviert={!x?.ergebnisse?.length || !gewaehlt} aktion={() => a.parameterSetzen({ vergleich: !vergleich })} />
        <MenueKnopf text="Weitere Aktionen" eintraege={() => [
          { text: 'Ergebnisse verwerfen', deaktiviert: laeuft || !x || x.status === 'keiner' || !schreiben, aktion: async () => { await api.loeschen(api.dok('/optimierung/auftrag')); setAuftrag(null); setGewaehlt(null); await abfragen(); } },
          null,
          { text: 'Diagnose', aktion: () => befehl('optimierung.diagnose') },
          { text: 'Gewichtung …', aktion: gewichtungDialog },
        ]} />
      </>}>
      {!x || x.status === 'keiner' ? (
        <Leer text="Es liegt kein Optimierungslauf vor. Ein Lauf verplant die Stunden automatisch und läuft auf dem Server im Hintergrund.">
          {schreiben ? <Button appearance="primary" onClick={() => optimierungStarten().catch(fehlerMelden)}>Neue Optimierung</Button> : null}
        </Leer>
      ) : (
        <div className={s.seite}>
          <div className={s.status}>
            <Badge appearance="tint" color={farbe} size="large">{x.status === 'uebernommen' ? `Plan ${x.uebernommen} übernommen` : statusText}</Badge>
            <span className={s.verfahren}>{String(x.strategie || '').replace(/^[A-E]\s+/, '')}</span>
            <span className={s.leise}>{laeuft ? `${x.phase} · ${Math.round(x.anteil * 100)} %` : x.phase || ''}</span>
          </div>
          <ProgressBar value={laeuft ? x.anteil : 1} thickness="medium" color={x.status === 'fehler' ? 'error' : laeuft ? 'brand' : 'success'} />
          <div className={s.daten}>
            <span className={s.dt}>Pläne</span><span className={s.dt}>Schritte je Plan</span><span className={s.dt}>Dauer</span><span className={s.dt}>Gestartet</span>
            <span>{x.plaene}</span><span>{x.optionen?.schritte}</span><span>{`${(x.dauer ?? 0).toLocaleString('de-DE')} s`}</span>
            <span>{`${new Date(x.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} von ${x.benutzer}`}</span>
          </div>
          {x.fehler ? <div className={s.fehler}>{x.fehler}</div> : null}
          {x.dokumentGeaendert && x.ergebnisse && x.status === 'fertig' ? <div className={s.hinweis}>Die Schuldatei wurde seit dem Start geändert – beim Übernehmen gehen diese Stundenplanänderungen verloren.</div> : null}
          {x.ergebnisse?.length ? <>
            <h3 className={s.h3}>Ergebnisse</h3>
            <div className={s.rollen}>
              <Table size="small" aria-label="Ergebnisse">
                <TableHeader><TableRow>
                  <TableHeaderCell>Plan</TableHeaderCell>
                  {KENNZAHLEN.map(([k, t, ti]) => <TableHeaderCell key={k} className={mergeClasses(s.z, s.kopf)} title={ti}>{t}</TableHeaderCell>)}
                  <TableHeaderCell className={mergeClasses(s.z, s.kopf)} title="Stunden an anderer Stelle als im aktuellen Plan">Abweichungen</TableHeaderCell><TableHeaderCell className={s.z}>Dauer</TableHeaderCell>
                </TableRow></TableHeader>
                <TableBody>
                  <TableRow className={s.aktuell}><TableCell>Aktueller Plan</TableCell>{KENNZAHLEN.map(([k]) => <TableCell key={k} className={s.z}>{zahl(x.aktuell?.[k])}</TableCell>)}<TableCell /><TableCell /></TableRow>
                  {x.ergebnisse.map((e) => (
                    <TableRow key={e.nummer} tabIndex={0} className={mergeClasses(s.zeile, e.nummer === gewaehlt && s.gewaehlt)} onClick={() => setGewaehlt(e.nummer)}
                      onDoubleClick={() => { setGewaehlt(e.nummer); void uebernehmen().catch(fehlerMelden); }}
                      onKeyDown={(ev) => { if (ev.key === 'Enter') { setGewaehlt(e.nummer); void uebernehmen().catch(fehlerMelden); } }}>
                      <TableCell>{`Plan ${e.nummer}${x.uebernommen === e.nummer ? ' (übernommen)' : ''}`}</TableCell>
                      {KENNZAHLEN.map(([k]) => {
                        const d = (x.aktuell?.[k] ?? 0) - (e.kennzahlen[k] ?? 0);
                        return <TableCell key={k} className={mergeClasses(s.z, d > 0 && s.gruen, d < 0 && s.rot)} title={d ? `${d > 0 ? 'besser' : 'schlechter'} um ${zahl(Math.abs(d))}` : undefined}>{zahl(e.kennzahlen[k])}</TableCell>;
                      })}
                      <TableCell className={s.z}>{zahl(e.abweichungen)}</TableCell><TableCell className={s.z}>{`${e.dauer.toLocaleString('de-DE')} s`}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className={s.leise}>Je niedriger die Bewertungszahl, umso weniger Vorgaben sind verletzt. Der beste Plan ist vorausgewählt; grüne Werte sind besser als im aktuellen Plan. Doppelklick oder Enter übernimmt den Plan.</p>
            {vergleich && gewaehlt ? <Vergleich nummer={gewaehlt} p={{ typ: String(p.vergleichTyp || 'klasse'), element: p.vergleichElement ? Number(p.vergleichElement) : undefined }} setzen={(y) => a.parameterSetzen(y)} /> : null}
          </> : null}
        </div>
      )}
    </AnsichtRahmen>
  );
}
