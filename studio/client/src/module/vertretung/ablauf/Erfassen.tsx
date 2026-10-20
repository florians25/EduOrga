// Abwesenheiten erfassen (Tagesplanung, Blatt „Abwesenheiten“): Schnellerfassung „Lehrkraft(en) … ganztägig bzw. ab/bis Stunde … bis Datum …
// Grund … Text“ – mehrere Lehrkräfte (bzw. Klassen, Räume) auf einmal, Enter speichert. Darunter Rückmeldungen aus EduOrga Web
// (Krankmeldungen, sofern die Verbindung eingerichtet ist) und die Auswirkungen: entstandene offene Stunden je abwesender Lehrkraft,
// mit dem Übergang zu „Offene Stunden lösen“. Die vollständige Liste (bearbeiten, teilen, löschen) steht daneben.
import { Button, Input, Select, makeStyles, tokens } from '@fluentui/react-components';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/api/client';
import { arbeitsplatzOeffnen, seiteOeffnen } from '@/kern/befehle';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben, useStudio } from '@/kern/zustand';
import type { AnsichtProps } from '@/kern/ansichten';
import { AnsichtRahmen } from '@/komponenten/ansicht';
import { DatumFeld } from '@/komponenten/eingaben';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { SuchAuswahl } from '@/komponenten/suchauswahl';
import { useElemente } from '../../gemeinsam';
import { direktLaden, useDirekt } from '../../untplanweb/Senden';
import { absenzenSpeichern } from '../Absenzen';
import { tpBlattSetzen, usePlanungsdatum } from '../kern';
import { Umschalter } from '../steuer';
import { QUELLE, arbeitslisteLaden, mehrzahl } from './daten';
import './ablauf.css';

const useStile = makeStyles({
  inhalt: { flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', padding: '12px 14px 16px 14px' },
  form: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '10px 12px', alignItems: 'end' },
  ganz: { gridColumn: '1 / -1' },
  feld: { display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 },
  titel: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 },
  zeile: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  std: { width: '72px', minWidth: '72px' },
  knoepfe: { gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '12px' },
  leise: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
});

type Art = 'lehrer' | 'klasse' | 'raum';
const ARTEN: { wert: Art; text: string; titel: string }[] = [
  { wert: 'lehrer', text: 'Lehrkraft', titel: 'Abwesende Lehrkräfte (Krankheit, Fortbildung …)' },
  { wert: 'klasse', text: 'Klasse', titel: 'Abwesende Klassen (Ausflug, Praktikum …) – der Unterricht wird freigesetzt' },
  { wert: 'raum', text: 'Raum', titel: 'Gesperrte Räume' },
];

/** Im Blatt der Tagesplanung (p.eingebettet): ohne eigenen Rahmen und Titel. */
export default function Erfassen({ p }: AnsichtProps) {
  const s = useStile();
  const datum = usePlanungsdatum();
  const schreiben = useDarfSchreiben();
  const letzte = useStudio((x) => x.grunddaten?.zeitraster?.stunden?.length || 8);
  const [art, setArt] = useState<Art>('lehrer');
  const elemente = useElemente(art);
  const gruende = useElemente('abwesenheitsgrund');
  const [wer, setWer] = useState('');
  const [ganz, setGanz] = useState(true);
  const [ab, setAb] = useState(1);
  const [bisStd, setBisStd] = useState(letzte);
  const [bis, setBis] = useState<string>('');
  const [grund, setGrund] = useState('');
  const [text, setText] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const direkt = useDirekt((x) => x.stand);
  useEffect(() => { void direktLaden(); }, []);
  useEffect(() => { setBis(''); }, [datum]);
  useEffect(() => { setBisStd(letzte); }, [letzte]);

  const { daten } = useDaten(() => arbeitslisteLaden(datum!), [datum], { bereiche: ['Vertretung', 'Stammdaten', 'Stundenplan'], aktiv: !!datum });
  const gruppen = useMemo(() => {
    const m = new Map<string, { lehrer: string; stunden: string[]; offen: number }>();
    for (const o of daten?.offen || []) {
      const k = o.lehrer || (o.raumOffen ? 'Räume' : '–');
      if (!m.has(k)) m.set(k, { lehrer: k, stunden: [], offen: 0 });
      const g = m.get(k)!;
      g.stunden.push(`${o.stunde}. ${o.klassen} ${o.fach}`.trim());
      g.offen++;
    }
    return [...m.values()];
  }, [daten]);

  const optionen = useMemo(() => elemente.map((e) => ({ wert: e.k, text: e.l && e.l !== e.k ? `${e.k} – ${e.l}` : e.k, kurz: e.k })), [elemente]);
  const stunden = Array.from({ length: letzte }, (_, i) => i + 1);

  async function erfassen() {
    if (!datum || !schreiben || laeuft) return;
    const namen = wer.split(',').map((x) => x.trim()).filter(Boolean);
    if (!namen.length) { hinweis(`Bitte ${art === 'lehrer' ? 'eine Lehrkraft' : art === 'klasse' ? 'eine Klasse' : 'einen Raum'} wählen.`, 'warnung'); return; }
    const bisDatum = bis && bis >= datum ? bis : datum;
    setLaeuft(true);
    try {
      await absenzenSpeichern(art, namen.map((element) => ({ id: 0, element, von: datum, bis: bisDatum, sv: ganz ? 1 : ab, sb: ganz ? letzte : Math.max(ab, bisStd), grund, text })), [], QUELLE, namen.length > 1 ? `${namen.length} Abwesenheiten eingeben` : 'Abwesenheit eingeben');
      hinweis(`${mehrzahl(namen.length, 'Abwesenheit', 'Abwesenheiten')} erfasst: ${namen.join(', ')}`, 'ok', 2500);
      setWer(''); setText('');
      setTimeout(() => formRef.current?.querySelector<HTMLInputElement>('input')?.focus());
    } catch (e) { fehlerMelden(e); } finally { setLaeuft(false); }
  }
  const enter = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.defaultPrevented && !(e.target as HTMLElement).closest('[aria-expanded=true]')) { e.preventDefault(); void erfassen(); } };
  const nOffen = daten?.offen.length ?? 0;

  async function webAbwesenheiten() {
    try {
      const { verfolgen, sachlich } = await import('../../untplanweb/kern');
      const auftrag = await api.post<{ id: string; fertig: boolean; wert: number; text: string }>(api.dok('/untplanweb/import/absenzen'));
      const x = await verfolgen(auftrag as never, () => {});
      if (x.fehler) hinweis(sachlich(x.fehler), 'fehler'); else hinweis(sachlich(x.ergebnis || 'Abwesenheiten aus EduOrga Web übernommen.'), 'ok', 4000);
    } catch (e) { fehlerMelden(e); }
  }

  const inhalt = (
      <div className={s.inhalt}>
        {schreiben ? (
          <section className="ta-karte-flach" aria-label="Abwesenheit erfassen">
            <div className="ta-abschnitt-titel">Neue Abwesenheit am Planungstag</div>
            <div ref={formRef} className={s.form} onKeyDown={enter} data-testid="erfassen-form">
              <div className={`${s.feld} ${s.ganz}`} style={{ alignItems: 'flex-start' }}>
                <span className={s.titel}>Art</span>
                <Umschalter<Art> wert={art} titel="Lehrkraft, Klasse oder Raum" optionen={ARTEN} beiWahl={(w) => { setArt(w); setWer(''); }} testid="erfassen-art" />
              </div>
              <div className={`${s.feld} ${s.ganz}`}>
                <span className={s.titel}>{art === 'lehrer' ? 'Lehrkräfte (mehrere möglich)' : art === 'klasse' ? 'Klassen (mehrere möglich)' : 'Räume (mehrere möglich)'}</span>
                <SuchAuswahl optionen={optionen} wert={wer} beiWahl={setWer} mehrfach size="small" platzhalter="Kürzel oder Name tippen" ariaLabel="Abwesend" />
              </div>
              <div className={s.feld}>
                <span className={s.titel}>Zeit</span>
                <span className={s.zeile}>
                  <Umschalter<'ganz' | 'std'> wert={ganz ? 'ganz' : 'std'} titel="Ganztägig oder nur einzelne Stunden" testid="erfassen-zeit"
                    optionen={[{ wert: 'ganz', text: 'Ganztägig' }, { wert: 'std', text: 'Stunden' }]} beiWahl={(w) => setGanz(w === 'ganz')} />
                  {ganz ? null : <>
                    <Select size="small" className={s.std} value={String(ab)} aria-label="ab Stunde" onChange={(_, d) => setAb(Number(d.value))}>{stunden.map((n) => <option key={n} value={n}>{`ab ${n}.`}</option>)}</Select>
                    <Select size="small" className={s.std} value={String(Math.max(ab, bisStd))} aria-label="bis Stunde" onChange={(_, d) => setBisStd(Number(d.value))}>{stunden.filter((n) => n >= ab).map((n) => <option key={n} value={n}>{`bis ${n}.`}</option>)}</Select>
                  </>}
                </span>
              </div>
              <div className={s.feld}>
                <span className={s.titel}>Bis einschließlich</span>
                <DatumFeld size="small" wert={bis || datum || ''} min={datum || undefined} aria-label="Bis einschließlich" beiAenderung={(d) => setBis(d)} />
              </div>
              <div className={s.feld}>
                <span className={s.titel}>Grund</span>
                <Select size="small" value={grund} aria-label="Grund" onChange={(_, d) => setGrund(d.value)}>
                  <option value="">–</option>
                  {gruende.map((g) => <option key={g.id} value={g.k}>{g.l && g.l !== g.k ? `${g.k} – ${g.l}` : g.k}</option>)}
                </Select>
              </div>
              <div className={s.feld}>
                <span className={s.titel}>Text</span>
                <Input size="small" value={text} onChange={(_, d) => setText(d.value)} aria-label="Text" placeholder="z. B. Fortbildung, Arzttermin" />
              </div>
              <div className={s.knoepfe}>
                <Button appearance="primary" size="small" style={{ whiteSpace: 'nowrap', flexShrink: 0 }} disabled={laeuft || !wer} onClick={() => void erfassen()} data-testid="erfassen-speichern">
                  {wer.includes(',') ? `${wer.split(',').filter(Boolean).length} Abwesenheiten erfassen` : 'Abwesenheit erfassen'}
                </Button>
                <span className={s.leise}>Enter speichert · offene Stunden entstehen sofort</span>
              </div>
            </div>
          </section>
        ) : null}

        <section className="ta-karte-flach" aria-label="Rückmeldungen aus EduOrga Web">
          <div className="ta-abschnitt-titel">Rückmeldungen aus EduOrga Web</div>
          {direkt?.eingerichtet ? (
            <div className={s.zeile}>
              <span className={s.leise}>Krankmeldungen und Rückmeldungen der Lehrkräfte aus dem Portal übernehmen.</span>
              {schreiben ? <Button size="small" onClick={() => void webAbwesenheiten()}>Abwesenheiten abrufen</Button> : null}
              <Button size="small" appearance="subtle" onClick={() => seiteOeffnen('untplanweb.stpl')}>Rückmeldungen ansehen …</Button>
            </div>
          ) : (
            <div className={s.zeile}>
              <span className={s.leise}>EduOrga Web ist nicht verbunden. Ist die Verbindung eingerichtet, lassen sich Krankmeldungen aus dem Portal hier übernehmen.</span>
              <Button size="small" appearance="subtle" onClick={() => seiteOeffnen('untplanweb')}>EduOrga Web …</Button>
            </div>
          )}
        </section>

        <section className="ta-karte-flach" aria-label="Auswirkungen" data-testid="erfassen-auswirkungen">
          <div className="ta-abschnitt-titel">{nOffen ? `Daraus entstanden: ${mehrzahl(nOffen, 'offene Stunde', 'offene Stunden')}` : 'Keine offenen Stunden'}</div>
          {gruppen.length ? (
            <ul className="ta-auswirkung">
              {gruppen.map((g) => (
                <li key={g.lehrer}><b>{g.lehrer}</b><span className="ta-auswirkung-zahl">{g.offen}</span><span className={s.leise}>{g.stunden.join(' · ')}</span></li>
              ))}
            </ul>
          ) : <span className={s.leise}>Mit dem Erfassen einer Abwesenheit erscheinen hier die Stunden, die neu besetzt werden müssen.</span>}
          <div className={s.zeile} style={{ marginTop: 8 }}>
            <Button appearance={nOffen ? 'primary' : 'secondary'} size="small" onClick={() => { if (p.eingebettet) tpBlattSetzen(null); else arbeitsplatzOeffnen('tagesplanung'); }} data-testid="weiter-loesen">
              {nOffen ? `${mehrzahl(nOffen, 'offene Stunde', 'offene Stunden')} lösen` : 'Zu den offenen Stunden'}
            </Button>
          </div>
        </section>
      </div>
  );
  if (p.eingebettet) return <div className="ta-eingebettet" data-ansicht="vertretung.erfassen">{inhalt}</div>;
  return <AnsichtRahmen titel="Abwesenheiten erfassen">{inhalt}</AnsichtRahmen>;
}
