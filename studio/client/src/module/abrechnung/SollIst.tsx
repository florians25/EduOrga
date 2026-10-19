// Soll und Ist: Lehrkräfte (Wochensoll, Wertkorrektur bearbeitbar), Unterrichtsmatrix (Anzeige Lehrer/Stunden), Stundentafel
// (Wochenstunden je Jahrgang und Fach, rechts die Abweichungen zum Unterricht).
import { Button, Tab, TabList, makeStyles, tokens } from '@fluentui/react-components';
import { useMemo } from 'react';
import { api } from '@/api/client';
import { useAnsicht, type AnsichtProps } from '@/kern/ansichten';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, Feld } from '@/komponenten/ansicht';
import { formular } from '@/komponenten/dialoge';
import { fehlerMelden } from '@/komponenten/hinweise';
import { Tabelle, type Spalte } from '@/komponenten/tabelle/Tabelle';
import './abrechnung.css';
import { SuchAuswahl } from '@/komponenten/suchauswahl';

const useStile = makeStyles({
  flaeche: { display: 'flex', flex: 1, minHeight: 0 },
  links: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  rechts: { width: '400px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${tokens.colorNeutralStroke2}` },
  titel: { padding: '8px 12px', fontWeight: tokens.fontWeightSemibold, borderBottom: `1px solid ${tokens.colorNeutralStroke2}` },
  tipp: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 },
});

interface WZeile { id: number; werte: string[]; differenz: number }
interface MZeile { id: number; werte: string[] }
interface Tafel { faecher: { id: number; kurz: string }[]; zeilen: { jahrgang: string; werte: string[]; summe: string }[]; abgleich: { klasse: string; fach: string; soll: string; ist: string; differenz: string; zuWenig: boolean }[] }

function Werte({ quelle }: { quelle: string }) {
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const { daten, setDaten } = useDaten(() => api.get<{ spalten: string[]; zeilen: WZeile[]; summe: string }>(api.dok('/abrechnung/werte')), [], { bereiche: ['Stammdaten', 'Unterricht', 'Stundenplan', 'Einstellungen'], quelle });
  const spalten = useMemo<Spalte<WZeile>[]>(() => (daten?.spalten || []).map((titel, i) => {
    const edit = schreiben && (i === 2 || i === 6);
    return {
      schluessel: i === 2 ? 'wochensoll' : i === 6 ? 'wertkorrektur' : `s${i}`, titel, breite: [65, 150, 80, 80, 60, 60, 90, 70, 50, 60, 200][i], art: edit ? 'Dezimal' : 'NurLesen', editierbar: edit,
      wert: (z) => z.werte[i],
      farbe: i === 7 ? (z) => (z.differenz > 0.5 ? 'var(--up-pruefung-flaeche)' : z.differenz < -0.5 ? 'var(--up-frei-flaeche)' : 'var(--up-ok-flaeche)') : undefined,
    };
  }), [daten?.spalten, schreiben]);
  return (
    <>
      <Tabelle<WZeile> name="soll-ist" spalten={spalten} zeilen={daten?.zeilen || []} zustandSchluessel="tabelle.abrechnung.werte"
        beiDoppelklick={(z) => a.oeffnen('stundenplan', { typ: 'lehrer', element: z.id })}
        aendern={schreiben ? async (z, s, wert) => setDaten(await api.patch(api.dok(`/abrechnung/werte/${z.id}`), { feld: s.schluessel, wert }, { quelle })) : undefined} />
      <SummenZeile text={daten?.summe} />
    </>
  );
}

function SummenZeile({ text }: { text?: string }) {
  return text ? <div style={{ padding: '6px 16px', borderTop: '1px solid var(--colorNeutralStroke2)', fontSize: 12, color: 'var(--colorNeutralForeground2)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'pre-wrap' }}>{text}</div> : null;
}

function Matrix({ art }: { art: number }) {
  const a = useAnsicht();
  const { daten } = useDaten(() => api.get<{ spalten: string[]; zeilen: MZeile[] }>(api.dok(`/abrechnung/matrix?art=${art}`)), [art], { bereiche: ['Stammdaten', 'Unterricht', 'Stundenplan'] });
  const spalten: Spalte<MZeile>[] = (daten?.spalten || []).map((titel, i) => ({ schluessel: `m${i}`, titel, breite: i === 0 ? 60 : art === 1 ? 44 : 76, art: 'NurLesen', wert: (z) => z.werte[i] }));
  return (
    <>
      <Tabelle<MZeile> key={art} name="matrix" spalten={spalten} zeilen={daten?.zeilen || []} beiDoppelklick={(z) => a.oeffnen('unterricht', { sicht: 'klasse', element: z.id })} />
      <SummenZeile text={daten ? `${daten.zeilen.length} Klassen · ${daten.spalten.length - 2} Fächer` : undefined} />
    </>
  );
}

function Stundentafel({ quelle }: { quelle: string }) {
  const s = useStile();
  const schreiben = useDarfSchreiben();
  const { daten, neuLaden } = useDaten(() => api.get<Tafel>(api.dok('/abrechnung/stundentafel')), [], { bereiche: ['Stammdaten', 'Unterricht', 'Einstellungen'], quelle });
  type Z = Tafel['zeilen'][number];
  const spalten: (Spalte<Z> & { fach?: number })[] = [
    { schluessel: 'jahrgang', titel: 'Jahrgang', breite: 70, art: 'NurLesen' },
    ...(daten?.faecher || []).map((x, i) => ({ schluessel: `f${x.id}`, fach: x.id, titel: x.kurz, breite: 48, art: schreiben ? 'Dezimal' as const : 'NurLesen' as const, editierbar: schreiben, wert: (z: Z) => z.werte[i] })),
    { schluessel: 'summe', titel: 'Summe', breite: 64, art: 'NurLesen' },
  ];
  type A = Tafel['abgleich'][number];
  return (
    <>
      <div className={s.flaeche}>
        <div className={s.links}>
          <Tabelle<Z> name="stundentafel" spalten={spalten} zeilen={daten?.zeilen || []} id={(z) => z.jahrgang}
            leerText="Noch keine Stundentafel. Jahrgänge über „Jahrgang hinzufügen“ oder „NRW-Jahrgänge eintragen“ anlegen."
            aendern={schreiben ? async (z, sp, wert) => { await api.put(api.dok('/abrechnung/stundentafel'), { jahrgang: z.jahrgang, fach: (sp as { fach?: number }).fach, wert }, { quelle }); await neuLaden(true); } : undefined} />
        </div>
        <div className={s.rechts}>
          <div className={s.titel}>Abweichungen zum Unterricht</div>
          <Tabelle<A> name="stundentafel-abgleich" zeilen={daten?.abgleich || []} id={(z) => `${z.klasse}|${z.fach}`} leerText="Keine Abweichungen." zeilenKlasse={(z) => (z.zuWenig ? 'abr-zuwenig' : 'abr-zuviel')}
            spalten={([['klasse', 'Klasse', 70], ['fach', 'Fach', 70], ['soll', 'Soll', 55], ['ist', 'Ist', 55], ['differenz', 'Differenz', 70]] as [string, string, number][]).map(([schluessel, titel, breite]) => ({ schluessel, titel, breite, art: 'NurLesen' as const }))} />
        </div>
      </div>
      <SummenZeile text={daten ? `${daten.zeilen.length} Jahrgänge · ${daten.abgleich.length} Abweichungen` : undefined} />
    </>
  );
}

export default function SollIst({ p }: AnsichtProps) {
  const s = useStile();
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const tab = ['werte', 'matrix', 'tafel'].includes(String(p.tab)) ? String(p.tab) : 'werte';
  const art = typeof p.matrixArt === 'number' ? p.matrixArt : 2;
  return (
    <AnsichtRahmen titel="Soll und Ist"
      filter={<>
        <TabList size="small" selectedValue={tab} onTabSelect={(_, d) => a.parameterSetzen({ tab: String(d.value) })}>
          <Tab value="werte">Lehrkräfte</Tab><Tab value="matrix">Unterrichtsmatrix</Tab><Tab value="tafel">Stundentafel</Tab>
        </TabList>
        {tab === 'matrix' ? <>
          <Feld titel="Anzeige"><SuchAuswahl size="small" breite={180} ariaLabel="Anzeige" wert={String(art)} beiWahl={(w) => a.parameterSetzen({ matrixArt: Number(w) })} optionen={['Lehrkräfte', 'Stunden', 'Lehrkräfte und Stunden'].map((t, i) => ({ wert: String(i), text: t }))} /></Feld>
          <span className={s.tipp}>Doppelklick öffnet den Unterricht der Klasse.</span>
        </> : null}
        {tab === 'tafel' ? <>
          {schreiben ? <>
            <Button size="small" onClick={async () => { const w = await formular('Jahrgang hinzufügen', [{ name: 'jahrgang', titel: 'Jahrgang', pflicht: true, hinweis: 'z. B. 5, 6, EF, Q1' }]); if (w) await api.post(api.dok('/abrechnung/stundentafel/jahrgang'), w).catch(fehlerMelden); }}>Jahrgang hinzufügen …</Button>
            <Button size="small" onClick={() => void api.post(api.dok('/abrechnung/stundentafel/nrw'), {}).catch(fehlerMelden)}>NRW-Jahrgänge eintragen</Button>
          </> : null}
          <span className={s.tipp}>Wochenstunden je Jahrgang und Fach; rechts die Abweichungen zum eingegebenen Unterricht.</span>
        </> : null}
      </>}>
      {tab === 'werte' ? <Werte quelle={a.id} /> : tab === 'matrix' ? <Matrix art={art} /> : <Stundentafel quelle={a.id} />}
    </AnsichtRahmen>
  );
}
