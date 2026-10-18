// Stundenplan-Diagnose: Prüfungen der Eingabedaten und des Stundenplans mit Gewicht und Anzahl, Fälle der gewählten Prüfung.
import { Tab, TabList, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { api } from '@/api/client';
import { useAnsicht } from '@/kern/ansichten';
import { useDaten } from '@/kern/laden';
import { AnsichtRahmen, FussText, Trenner, Werkzeug } from '@/komponenten/ansicht';
import { hinweis } from '@/komponenten/hinweise';
import { Tabelle, type TabelleApi } from '@/komponenten/tabelle/Tabelle';
import { gewichtungDialog, optimierungStarten } from './dialoge';

interface Fall { element: string; u?: number | string; zeit: string; detail: string; typ?: string; id?: number; klasse?: number; lehrer?: number }
interface Punkt { rubrik: string; gruppe: string; titel: string; beschreibung: string; gewicht: number; anzahl: number; faelle: Fall[] }
interface DiagnoseDaten { eingabedaten: Punkt[]; stundenplan: Punkt[]; kennzahlen: Record<string, number>; planstunden: number; periode: string }

const gruppenName = (g: string) => (g === 'Lehrer' ? 'Lehrkräfte' : g === 'Klasse' ? 'Klassen' : g === 'Raum' ? 'Räume' : g);
const zahl = (n: unknown) => (typeof n === 'number' ? n.toLocaleString('de-DE') : String(n ?? ''));

const useStile = makeStyles({
  aufbau: { display: 'grid', gridTemplateColumns: 'minmax(280px, 2fr) minmax(0, 3fr)', flex: 1, minHeight: 0 },
  links: { display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: `1px solid ${tokens.colorNeutralStroke2}` },
  liste: { flex: 1, overflowY: 'auto', outline: 'none' },
  zeile: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 64px 56px', gap: '8px', padding: '5px 12px', fontSize: tokens.fontSizeBase300, cursor: 'pointer', ':hover': { backgroundColor: tokens.colorNeutralBackground1Hover } },
  kopf: { fontWeight: tokens.fontWeightMedium, fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2, backgroundColor: tokens.colorNeutralBackground2, cursor: 'default', position: 'sticky', top: 0, ':hover': { backgroundColor: tokens.colorNeutralBackground2 } },
  gruppe: { fontWeight: tokens.fontWeightSemibold, cursor: 'default', marginTop: '6px', ':hover': { backgroundColor: 'transparent' } },
  leer: { color: tokens.colorNeutralForeground3 },
  schwer: { color: tokens.colorPaletteRedForeground1 },
  gewaehlt: { backgroundColor: tokens.colorBrandBackground2, ':hover': { backgroundColor: tokens.colorBrandBackground2Hover } },
  z: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  rechts: { display: 'flex', flexDirection: 'column', minHeight: 0 },
  titel: { padding: '12px 16px 4px 16px' },
  pfad: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 },
  h3: { margin: '2px 0 0 0', fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold },
  beschreibung: { padding: '4px 16px 12px 16px', color: tokens.colorNeutralForeground2, fontSize: tokens.fontSizeBase300, borderBottom: `1px solid ${tokens.colorNeutralStroke2}` },
  faelle: { flex: 1, minHeight: 0, display: 'flex' },
  reiter: { padding: '4px 8px' },
});

export default function Diagnose() {
  const s = useStile();
  const a = useAnsicht();
  const [rubrik, setRubrik] = useState<'eingabedaten' | 'stundenplan'>('eingabedaten');
  const [punktSchluessel, setPunktSchluessel] = useState<string | null>(null);
  const faelle = useRef<TabelleApi<Fall & { nr: number }>>(null);
  const { daten, laedt, neuLaden } = useDaten(() => api.get<DiagnoseDaten>(api.dok('/optimierung/diagnose')), [], { bereiche: ['Stammdaten', 'Unterricht', 'Stundenplan', 'Einstellungen'] });
  const punkte = daten?.[rubrik] || [];
  const key = (p: Punkt) => `${p.gruppe}|${p.titel}`;
  const punkt = punkte.find((p) => key(p) === punktSchluessel) || punkte.find((p) => p.anzahl > 0) || null;
  const gruppen = [...new Set(punkte.map((p) => p.gruppe))];
  const zeilen = useMemo(() => (punkt?.faelle || []).map((x, i) => ({ ...x, nr: i, u: x.u ?? '' })), [punkt]);

  const planZeigen = (z = faelle.current?.aktiveZeile()) => {
    if (!z) { hinweis('Bitte einen Fall wählen.', 'warnung'); return; }
    if (z.typ && z.id) a.oeffnen('stundenplan', { typ: z.typ, element: z.id });
    else if (z.klasse) a.oeffnen('stundenplan', { typ: 'klasse', element: z.klasse });
    else if (z.lehrer) a.oeffnen('stundenplan', { typ: 'lehrer', element: z.lehrer });
    else hinweis('Zu diesem Fall gibt es keinen Stundenplan.', 'info');
  };
  const taste = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const i = punkt ? punkte.indexOf(punkt) : -1;
    const n = punkte[Math.max(0, Math.min(punkte.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
    if (n) setPunktSchluessel(key(n));
  };
  const k = daten?.kennzahlen || {};
  const summe = (r: 'eingabedaten' | 'stundenplan') => (daten?.[r] || []).reduce((x, p) => x + p.anzahl, 0);

  return (
    <AnsichtRahmen titel="Diagnose" laden={laedt && !daten}
      werkzeuge={<>
        <Werkzeug text="Aktualisieren" aktion={() => neuLaden()} />
        <Werkzeug text="Stundenplan anzeigen" titel="Stundenplan zum markierten Fall öffnen (Doppelklick)" aktion={() => planZeigen()} />
        <Trenner />
        <Werkzeug text="Gewichtung" aktion={gewichtungDialog} />
        <Werkzeug text="Optimierung" titel="Automatische Planung starten" aktion={optimierungStarten} />
      </>}
      fuss={daten ? <>
        <span>Bewertung {zahl(k.bewertung)}</span><span>{zahl(k.nichtVerplant)} nicht verplant</span><span>{zahl(k.kollisionen)} Kollisionen</span>
        <span>{zahl(daten.planstunden)} Planstunden</span><FussText rechts>{daten.periode}</FussText>
      </> : null}>
      <div className={s.aufbau}>
        <div className={s.links}>
          <TabList className={s.reiter} size="small" selectedValue={rubrik} onTabSelect={(_, d) => { setRubrik(d.value as typeof rubrik); setPunktSchluessel(null); }}>
            <Tab value="eingabedaten">{`Eingabedaten${daten ? ` (${summe('eingabedaten')})` : ''}`}</Tab>
            <Tab value="stundenplan">{`Stundenplan${daten ? ` (${summe('stundenplan')})` : ''}`}</Tab>
          </TabList>
          <div className={s.liste} tabIndex={0} onKeyDown={taste} role="listbox" aria-label="Prüfungen">
            <div className={mergeClasses(s.zeile, s.kopf)}><span>Prüfung</span><span className={s.z} title="Gewicht (0 bis 5)">Gewicht</span><span className={s.z}>Fälle</span></div>
            {daten && !punkte.length ? <div className={mergeClasses(s.zeile, s.leer)}>{rubrik === 'stundenplan' ? 'Der Stundenplan verletzt keine Vorgaben.' : 'Die Eingabedaten sind ohne Auffälligkeiten.'}</div> : null}
            {gruppen.map((g) => {
              const ps = punkte.filter((p) => p.gruppe === g);
              return (
                <div key={g}>
                  <div className={mergeClasses(s.zeile, s.gruppe)}><span>{gruppenName(g)}</span><span /><span className={s.z}>{ps.reduce((x, p) => x + p.anzahl, 0)}</span></div>
                  {ps.map((p) => (
                    <div key={key(p)} role="option" aria-selected={p === punkt} className={mergeClasses(s.zeile, p.anzahl === 0 && s.leer, p.gewicht >= 5 && p.anzahl > 0 && s.schwer, p === punkt && s.gewaehlt)}
                      onClick={() => setPunktSchluessel(key(p))}>
                      <span>{p.titel}</span><span className={s.z}>{p.gewicht}</span><span className={s.z}>{p.anzahl}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        <div className={s.rechts}>
          <div className={s.titel}>
            <div className={s.pfad}>{punkt ? `${punkt.rubrik} · ${gruppenName(punkt.gruppe)}` : 'Diagnose'}</div>
            <h3 className={s.h3}>{punkt ? punkt.titel : 'Keine Prüfung gewählt'}</h3>
          </div>
          <div className={s.beschreibung}>{punkt ? punkt.beschreibung : 'Links eine Prüfung wählen, um die einzelnen Fälle zu sehen.'}</div>
          <div className={s.faelle}>
            <Tabelle ref={faelle} name="diagnose-faelle" id={(z) => z.nr} zustandSchluessel="optimierung.diagnose.faelle" leerText="Zu dieser Prüfung gibt es keine Fälle." zeilen={zeilen}
              spalten={[
                { schluessel: 'element', titel: 'Element', breite: 100, art: 'NurLesen' },
                { schluessel: 'u', titel: 'Unterricht', breite: 80, art: 'NurLesen', ausrichtung: 'rechts' },
                { schluessel: 'zeit', titel: 'Zeit', breite: 80, art: 'NurLesen' },
                { schluessel: 'detail', titel: 'Detail', breite: 460, art: 'NurLesen' },
              ]}
              beiDoppelklick={(z) => planZeigen(z)} />
          </div>
        </div>
      </div>
    </AnsichtRahmen>
  );
}
