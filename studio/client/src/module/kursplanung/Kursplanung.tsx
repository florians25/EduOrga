// Kursplanung: Kurse einer Klasse bzw. eines Jahrgangs (Kursname und Band änderbar), Kurswahlen der Schüler,
// Kollisionsmatrix, automatische Bandbildung mit Vorschlag und Übernahme der Bänder.
import { Button, Input, Select, Tab, TabList, makeStyles, tokens } from '@fluentui/react-components';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/api/client';
import { useAnsicht, type AnsichtProps } from '@/kern/ansichten';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, Feld, Leer, Trenner, Werkzeug } from '@/komponenten/ansicht';
import { formular, frage } from '@/komponenten/dialoge';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { MenueKnopf } from '@/komponenten/menue';
import { Tabelle, type Spalte } from '@/komponenten/tabelle/Tabelle';

interface Kurs { id: number; kursname: string; fach: string; lehrer: string; klassen: string; wst: number; band: string; teilnehmer: number; mw: string }
interface Band { band: string; kurse: string[]; schueler: number }
interface KpDaten { klasse: { id: number; kurz: string }; kurse: Kurs[]; schueler: { id: number; name: string; wahlen: number[] }[]; matrix: number[][]; baender: Band[]; status: string; kollisionen: number }
interface Vorschlag { baender: Band[]; zuordnung: unknown; text: string }

const useStile = makeStyles({
  werkzeug: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, flexWrap: 'wrap' },
  leise: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  kollision: { color: 'var(--up-entfall)' },
});

export default function Kursplanung({ p }: AnsichtProps) {
  const s = useStile();
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const tab = ['kurse', 'wahlen', 'matrix', 'baender'].includes(String(p.tab)) ? String(p.tab) : 'kurse';
  const { daten: klassen } = useDaten(() => api.get<{ id: number; kurz: string }[]>(api.dok('/kursplanung')), [], { bereiche: ['Stammdaten', 'Unterricht'] });
  const klasse = klassen ? (klassen.some((k) => k.id === Number(p.klasse)) ? Number(p.klasse) : klassen[0]?.id ?? null) : null;
  const { daten: d, setDaten, laedt } = useDaten(() => api.get<KpDaten>(api.dok(`/kursplanung/${klasse}`)), [klasse], { bereiche: ['Stammdaten', 'Unterricht'], quelle: a.id, aktiv: klasse != null });
  const [vorschlag, setVorschlag] = useState<Vorschlag | null>(null);
  const [maxBaender, setMaxBaender] = useState(10);
  const [status, setStatus] = useState('');
  useEffect(() => { setVorschlag(null); setStatus(d?.status || ''); }, [d]);

  const kursSpalten = useMemo<Spalte<Kurs>[]>(() => ([['id', 'Unterricht', 80, false, 'rechts'], ['kursname', 'Kursname', 110, true], ['fach', 'Fach', 60], ['lehrer', 'Lehrkraft', 80], ['klassen', 'Klassen', 90], ['wst', 'Wochenstd.', 90, false, 'rechts'], ['band', 'Band', 90, true], ['teilnehmer', 'Teilnehmer', 90, false, 'rechts'], ['mw', 'm/w', 70, false, 'rechts']] as [string, string, number, boolean?, 'rechts'?][])
    .map(([schluessel, titel, breite, edit, ausrichtung]) => ({ schluessel, titel, breite, ausrichtung, art: edit && schreiben ? 'Text' : 'NurLesen', editierbar: !!edit && schreiben })), [schreiben]);

  type W = { id: number; name: string; anzahl: number; [k: string]: unknown };
  const wahlZeilen = useMemo<W[]>(() => (d?.schueler || []).map((x) => {
    const z: W = { id: x.id, name: x.name, anzahl: x.wahlen.length };
    for (const k of d!.kurse) z[`k${k.id}`] = x.wahlen.includes(k.id) ? 'X' : '';
    return z;
  }), [d]);
  const wahlSpalten = useMemo<(Spalte<W> & { kurs?: number })[]>(() => [
    { schluessel: 'name', titel: 'Schülerin bzw. Schüler', breite: 190, art: 'NurLesen' }, { schluessel: 'anzahl', titel: 'Kurse', breite: 60, art: 'NurLesen', ausrichtung: 'rechts' },
    ...(d?.kurse || []).map((k) => ({ schluessel: `k${k.id}`, kurs: k.id, titel: k.kursname, breite: 76, art: schreiben ? 'Bool' as const : 'NurLesen' as const, editierbar: schreiben, ausrichtung: 'mitte' as const })),
  ], [d?.kurse, schreiben]);

  type M = { id: number; i: number; kurs: string; werte: number[] };
  const matrixZeilen = useMemo<M[]>(() => (d?.kurse || []).map((k, i) => ({ id: k.id, i, kurs: `${k.kursname} (${k.band})`, werte: d!.matrix[i] || [] })), [d]);
  const matrixSpalten: Spalte<M>[] = [{ schluessel: 'kurs', titel: 'Kurs', breite: 120, art: 'NurLesen' },
    ...(d?.kurse || []).map((k, j) => ({
      schluessel: `m${j}`, titel: k.kursname, hinweis: `${k.kursname} – Band ${k.band || 'ohne'}`, breite: 76, art: 'NurLesen' as const, ausrichtung: 'rechts' as const,
      wert: (z: M) => ((z.werte[j] ?? 0) > 0 ? z.werte[j] : ''),
      farbe: (z: M) => { if ((z.werte[j] ?? 0) < 0) return 'var(--colorNeutralBackground3)'; const x = d!.kurse[z.i]!; return x.band && x.band === k.band ? ((z.werte[j] ?? 0) > 0 ? 'var(--up-entfall-flaeche)' : 'var(--up-ok-flaeche)') : null; },
    }))];

  const baender = vorschlag ? vorschlag.baender : d?.baender || [];
  const maxK = Math.max(0, ...baender.map((b) => b.kurse.length));
  const bandSpalten: Spalte<Band>[] = [{ schluessel: 'band', titel: vorschlag ? 'Band (Vorschlag)' : 'Band (aktuell)', breite: 130, art: 'NurLesen' },
    ...Array.from({ length: maxK }, (_, i) => ({ schluessel: `k${i}`, titel: `Kurs ${i + 1}`, breite: 100, art: 'NurLesen' as const, wert: (z: Band) => z.kurse[i] || '' })),
    { schluessel: 'schueler', titel: 'Schüler', breite: 80, art: 'NurLesen', ausrichtung: 'rechts' }];

  async function uebernehmen() {
    if (!vorschlag || !d) { hinweis('Bitte zuerst die Bandbildung starten.', 'warnung'); return; }
    const w = await formular('Bänder übernehmen', [{ name: 'praefix', titel: 'Präfix für die Bandbezeichnung', wert: d.klasse.kurz, pflicht: true }]);
    if (!w) return;
    setDaten(await api.post<KpDaten>(api.dok(`/kursplanung/${d.klasse.id}/baender`), { praefix: w.praefix, zuordnung: vorschlag.zuordnung }, { quelle: a.id }));
    hinweis('Bänder in den Unterricht übernommen.', 'ok');
  }
  async function zufall() {
    if (!d || !(await frage('Für alle Schülerinnen und Schüler der Klasse ohne Kurswahl zufällig Kurse wählen (je Fach höchstens ein Kurs)? Gedacht für Testdaten.', { ja: 'Füllen', nein: 'Abbrechen' }))) return;
    setDaten(await api.post<KpDaten>(api.dok(`/kursplanung/${d.klasse.id}/zufall`), {}, { quelle: a.id }));
  }

  return (
    <AnsichtRahmen titel="Kursplanung" laden={laedt}
      werkzeuge={<>
        <Feld titel="Klasse oder Jahrgang">
          <Select size="small" value={klasse != null ? String(klasse) : ''} onChange={(_, x) => a.parameterSetzen({ klasse: Number(x.value) })}>{(klassen || []).map((k) => <option key={k.id} value={k.id}>{k.kurz}</option>)}</Select>
        </Feld>
        <Trenner />
        <Werkzeug text="Schülerinnen und Schüler" titel="Stammdaten der Schülerinnen und Schüler" aktion={() => a.oeffnen('stammdaten', { typ: 'schueler' })} />
        {schreiben ? <MenueKnopf text="Weitere Aktionen" eintraege={[{ text: 'Fehlende Kurswahlen zufällig füllen (Testdaten) …', aktion: zufall }]} /> : null}
      </>}
      filter={<TabList size="small" selectedValue={tab} onTabSelect={(_, x) => a.parameterSetzen({ tab: String(x.value) })}>
        <Tab value="kurse">Kurse</Tab><Tab value="wahlen">Kurswahlen</Tab><Tab value="matrix">Kollisionsmatrix</Tab><Tab value="baender">Bandbildung</Tab>
      </TabList>}
      fuss={<span className={d?.kollisionen ? s.kollision : undefined}>{vorschlag ? vorschlag.text : status}</span>}>
      {klassen && !klassen.length ? <Leer text="Es sind keine Klassen mit Kursen vorhanden." /> : !d ? null : tab === 'kurse' ? (
        <Tabelle<Kurs> name="kurse" spalten={kursSpalten} zeilen={d.kurse} zustandSchluessel="tabelle.kursplanung.kurse" leerText="Diese Klasse hat keine Kurse."
          aendern={schreiben ? async (z, sp, wert) => setDaten(await api.patch<KpDaten>(api.dok(`/kursplanung/${d.klasse.id}/kurs/${z.id}`), { feld: sp.schluessel, wert }, { quelle: a.id })) : undefined} />
      ) : tab === 'wahlen' ? (
        <Tabelle<W> name="kurswahlen" spalten={wahlSpalten} zeilen={wahlZeilen} leerText="Diese Klasse hat keine Schülerinnen und Schüler."
          aendern={schreiben ? async (z, sp, wert) => setDaten(await api.put<KpDaten>(api.dok(`/kursplanung/${d.klasse.id}/wahl`), { schueler: z.id, kurs: (sp as { kurs?: number }).kurs, gewaehlt: ['X', 'x', 'true'].includes(wert) }, { quelle: a.id })) : undefined} />
      ) : tab === 'matrix' ? (
        <Tabelle<M> key={d.kurse.length} name="kollisionsmatrix" spalten={matrixSpalten} zeilen={matrixZeilen} />
      ) : (
        <>
          <div className={s.werkzeug}>
            <span className={s.leise}>Höchstens</span><Input size="small" type="number" min={1} max={30} value={String(maxBaender)} style={{ width: 72 }} onChange={(_, x) => setMaxBaender(Number(x.value) || 10)} /><span className={s.leise}>Bänder</span>
            <Button size="small" onClick={async () => { try { setVorschlag(await api.post<Vorschlag>(api.dok(`/kursplanung/${d.klasse.id}/bandbildung`), { maxBaender })); } catch (e) { fehlerMelden(e); } }}>Bandbildung starten</Button>
            <Button size="small" disabled={!schreiben} onClick={() => uebernehmen().catch(fehlerMelden)}>Bänder übernehmen</Button>
            <span className={s.leise}>Zuerst einen Vorschlag berechnen, dann in den Unterricht übernehmen.</span>
          </div>
          <Tabelle<Band> key={`${vorschlag ? 'v' : 'a'}${maxK}`} name="baender" spalten={bandSpalten} zeilen={baender} id={(z) => z.band} leerText="Noch keine Bänder – zuerst die Bandbildung starten." />
        </>
      )}
    </AnsichtRahmen>
  );
}
