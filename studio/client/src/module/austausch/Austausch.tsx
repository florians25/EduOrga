// Import und Export: alles in einer Seite (Schuldatei, Import, Export, Abteilungsplanung, Protokoll des letzten Imports).
import { Button, Input, Select, makeStyles, tokens } from '@fluentui/react-components';
import { useState, type ReactNode } from 'react';
import { api, dateiHerunterladen } from '@/api/client';
import { befehl } from '@/kern/befehle';
import { dateienWaehlen } from '@/kern/hilfen';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, Feld, Ladeanzeige } from '@/komponenten/ansicht';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { DatumFeld } from '@/komponenten/eingaben';
import { berichtText, csvImport, gpuImport, type Importbericht } from './aktionen';

interface Info { schulname?: string; abteilungen: { id: number; kurz: string; lang: string; unterrichte: number }[]; lehrer: { id: number; kurz: string; lang: string }[]; zaehler: Record<string, number> }

const useStile = makeStyles({
  seite: { padding: '8px 20px 32px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(520px, 1fr))', gap: '16px', alignItems: 'start', position: 'relative' },
  karte: { border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusLarge, backgroundColor: tokens.colorNeutralBackground1 },
  h3: { margin: 0, padding: '12px 16px', fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold, borderBottom: `1px solid ${tokens.colorNeutralStroke2}` },
  zeile: { display: 'flex', alignItems: 'center', gap: '16px', padding: '10px 16px', borderBottom: `1px solid ${tokens.colorNeutralStroke3}`, ':last-child': { borderBottom: 'none' }, flexWrap: 'wrap' },
  text: { flex: 1, minWidth: '200px' },
  titel: { fontWeight: tokens.fontWeightMedium },
  beschreibung: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  aktion: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  kennzahlen: { display: 'flex', gap: '28px', padding: '12px 16px', borderBottom: `1px solid ${tokens.colorNeutralStroke3}`, flexWrap: 'wrap' },
  zahl: { display: 'block', fontSize: '20px', fontWeight: tokens.fontWeightSemibold, fontVariantNumeric: 'tabular-nums' },
  klein: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  erklaerung: { margin: 0, padding: '10px 16px', color: tokens.colorNeutralForeground2, fontSize: tokens.fontSizeBase300 },
  protokoll: { padding: '12px 16px', fontSize: tokens.fontSizeBase200, whiteSpace: 'pre-wrap', maxHeight: '260px', overflow: 'auto' },
});

export default function Austausch() {
  const s = useStile();
  const schreiben = useDarfSchreiben();
  const { daten: info } = useDaten(() => api.get<Info>(api.dok('/austausch')), [], { bereiche: ['Stammdaten', 'Unterricht', 'Stundenplan'] });
  const [protokoll, setProtokoll] = useState<string>('');
  const [laeuft, setLaeuft] = useState(false);
  const [lehrer, setLehrer] = useState('');
  const heute = new Date().toISOString().slice(0, 10);
  const [von, setVon] = useState(heute);
  const [bis, setBis] = useState(new Date(Date.now() + 27 * 86400000).toISOString().slice(0, 10));
  const [abteilung, setAbteilung] = useState('');
  const ab = abteilung || String(info?.abteilungen[0]?.id ?? '');
  const lk = lehrer || String(info?.lehrer[0]?.id ?? '');

  const aktion = (text: string, f: () => unknown, { nurSchreiben = false, titel }: { nurSchreiben?: boolean; titel?: string } = {}) => (
    <Button size="small" title={titel} disabled={laeuft || (nurSchreiben && !schreiben)} onClick={async () => {
      setLaeuft(true);
      try { const b = (await f()) as Importbericht | null; if (b && typeof b === 'object' && 'neu' in b) setProtokoll(berichtText(b)); } catch (e) { fehlerMelden(e); } finally { setLaeuft(false); }
    }}>{text}</Button>
  );
  const zeile = (titel: string, beschreibung: string, ...rechts: ReactNode[]) => (
    <div className={s.zeile}><div className={s.text}><div className={s.titel}>{titel}</div><div className={s.beschreibung}>{beschreibung}</div></div><div className={s.aktion}>{rechts}</div></div>
  );
  const z = info?.zaehler || {};
  const kz = (w: number | undefined, t: string) => <div><span className={s.zahl}>{w ?? 0}</span><span className={s.klein}>{t}</span></div>;
  return (
    <AnsichtRahmen titel="Import und Export" rollen>
      <div className={s.seite}>
        <section className={s.karte}>
          <h3 className={s.h3}>Schuldatei</h3>
          <div className={s.kennzahlen}>{kz(z.lehrer, 'Lehrkräfte')}{kz(z.klassen, 'Klassen')}{kz(z.schueler, 'Schülerinnen und Schüler')}{kz(z.unterrichte, 'Unterrichte')}{kz(z.stunden, 'verplante Stunden')}</div>
          {zeile('Schuldatei herunterladen', `Aktueller Stand von „${info?.schulname || 'Schuldatei'}“ als Schuldatei (.up)`, aktion('Herunterladen', () => befehl('datei.herunterladen')))}
          {zeile('Schuldatei hochladen', 'Eine .up- oder BAL-Datei als neue Schuldatei auf den Server laden', aktion('Hochladen …', () => befehl('datei.hochladen'), { nurSchreiben: true }))}
          {zeile('BAL-Datei übernehmen', 'Stundenplan aus einer BAL-Datei (WILLI2) in diese Schuldatei übernehmen', aktion('Importieren …', () => befehl('datei.balImport'), { nurSchreiben: true }))}
        </section>
        <section className={s.karte}>
          <h3 className={s.h3}>Import</h3>
          {zeile('Lehrkräfte (Schild-NRW, CSV)', 'Lehrkräfte aus einer Schild-NRW-Exportdatei anlegen bzw. aktualisieren', aktion('Importieren …', () => csvImport('lehrer', 'Import Lehrkräfte'), { nurSchreiben: true }))}
          {zeile('Klassen (Schild-NRW, CSV)', 'Klassen aus einer Schild-NRW-Exportdatei anlegen bzw. aktualisieren', aktion('Importieren …', () => csvImport('klassen', 'Import Klassen'), { nurSchreiben: true }))}
          {zeile('Schülerinnen und Schüler mit Kurswahlen (CSV)', 'Liste mit Name, Vorname, Klasse und Kursen übernehmen', aktion('Importieren …', () => csvImport('schueler', 'Import Schüler'), { nurSchreiben: true }))}
          {zeile('GPU-Dateien', 'GPU001 bis GPU006 (mehrere Dateien oder ein ZIP) beim Umstieg übernehmen', aktion('Importieren …', gpuImport, { nurSchreiben: true }))}
        </section>
        <section className={s.karte}>
          <h3 className={s.h3}>Export</h3>
          {zeile('GPU-Dateien (ZIP)', 'GPU001 bis GPU006 im Latin-1-Format', aktion('Herunterladen', () => dateiHerunterladen(api.dok('/austausch/gpu'), 'GPU.zip')))}
          {zeile('Unterrichtsverteilung (CSV)', 'Alle Unterrichte mit Kopplungszeilen', aktion('Herunterladen', () => dateiHerunterladen(api.dok('/austausch/unterricht.csv'), 'Unterrichtsverteilung.csv')))}
          {zeile('Aushang (HTML, ZIP)', 'Statische HTML-Seiten aller Pläne zum Veröffentlichen', aktion('Herunterladen', () => dateiHerunterladen(api.dok('/austausch/infostundenplan.zip'), 'Aushang.zip')))}
          {zeile('Paket für EduOrga Web (JSON)', 'Paket im Schema untplanweb/1, z. B. für ein manuelles Hochladen', aktion('Herunterladen', () => dateiHerunterladen(api.dok('/austausch/untplanweb.json'), 'untplanweb.json')))}
          {zeile('Kalender einer Lehrkraft (iCalendar)', 'Stundenplan mit Vertretungen als .ics-Datei',
            <Select key="l" size="small" value={lk} onChange={(_, d) => setLehrer(d.value)} title="Lehrkraft für den Kalenderexport">{(info?.lehrer || []).map((l) => <option key={l.id} value={l.id}>{`${l.kurz} – ${l.lang}`}</option>)}</Select>,
            <Feld key="v" titel="Von"><DatumFeld size="small" wert={von} beiAenderung={(datum) => setVon(datum)} /></Feld>,
            <Feld key="b" titel="Bis"><DatumFeld size="small" wert={bis} beiAenderung={(datum) => setBis(datum)} /></Feld>,
            <span key="k">{aktion('Herunterladen', () => { if (!lk) throw new Error('Bitte eine Lehrkraft wählen.'); return dateiHerunterladen(api.dok(`/austausch/ical/${lk}?von=${von}&bis=${bis}`), 'Stundenplan.ics'); })}</span>)}
        </section>
        <section className={s.karte}>
          <h3 className={s.h3}>Abteilungsplanung</h3>
          <p className={s.erklaerung}>Eine Abteilungsdatei enthält alle Stammdaten; beweglich sind nur die Unterrichte der Abteilung. Nach der Bearbeitung wird sie wieder zusammengeführt.</p>
          <div className={s.zeile}>
            <div className={s.text}>
              <Feld titel="Abteilung">
                <Select size="small" value={ab} onChange={(_, d) => setAbteilung(d.value)}>
                  {info?.abteilungen.length ? info.abteilungen.map((x) => <option key={x.id} value={x.id}>{`${x.kurz}${x.lang ? ` – ${x.lang}` : ''} (${x.unterrichte} Unterrichte)`}</option>) : <option value="">Keine Abteilungen angelegt</option>}
                </Select>
              </Feld>
            </div>
            <div className={s.aktion}>
              {aktion('Exportieren', () => { if (!ab) throw new Error('Bitte zuerst unter Stammdaten → Abteilungen eine Abteilung anlegen.'); return dateiHerunterladen(api.dok(`/austausch/abteilung/${ab}`), 'Abteilung.up'); })}
              {aktion('Zusammenführen …', async () => {
                if (!ab) throw new Error('Bitte eine Abteilung wählen.');
                const [datei] = await dateienWaehlen('.up,.untplan,application/json');
                if (!datei) return null;
                const b = await api.hochladenMehrere<Importbericht>(api.dok(`/austausch/abteilung/${ab}`), [datei], 'datei');
                hinweis(b.text || 'Zusammengeführt.', 'ok');
                return b;
              }, { nurSchreiben: true, titel: 'Unterrichte und Stunden der Abteilung aus einer Abteilungsdatei übernehmen' })}
            </div>
          </div>
        </section>
        <section className={s.karte}>
          <h3 className={s.h3}>Protokoll des letzten Imports</h3>
          <div className={s.protokoll}>{protokoll || <span className={s.klein}>Noch kein Import in dieser Sitzung.</span>}</div>
        </section>
        {laeuft ? <Ladeanzeige /> : null}
      </div>
    </AnsichtRahmen>
  );
}
