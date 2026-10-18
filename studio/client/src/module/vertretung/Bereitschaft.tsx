// Bereitschaften des Tages und Bereitschaftsplanung (Raster mit Bedarf, Vorschlag, Automatik).
import { Button, Input, Text, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { useRef, useState } from 'react';
import { api } from '@/api/client';
import { useAnsicht } from '@/kern/ansichten';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, FussText, Rechts, Schalter, Werkzeug } from '@/komponenten/ansicht';
import { formular, frage } from '@/komponenten/dialoge';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { Tabelle, type Spalte } from '@/komponenten/tabelle/Tabelle';
import { auswahlMelden, usePlanungsdatum, vpfad } from './kern';

const useStile = makeStyles({
  lg: { display: 'inline-flex', alignItems: 'center', gap: '6px' },
  punkt: { width: '12px', height: '10px', borderRadius: '2px', display: 'inline-block', border: `1px solid ${tokens.colorNeutralStroke1}` },
  bp: { display: 'flex', flex: 1, minHeight: 0, gap: '16px', padding: '12px' },
  links: { flex: '1 1 60%', overflow: 'auto' },
  rechts: { flex: '1 1 40%', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 },
  raster: { borderCollapse: 'collapse', width: '100%', fontSize: tokens.fontSizeBase200, tableLayout: 'fixed' },
  th: { padding: '4px', fontWeight: tokens.fontWeightMedium, color: tokens.colorNeutralForeground2, backgroundColor: tokens.colorNeutralBackground2, border: `1px solid ${tokens.colorNeutralStroke2}` },
  td: { padding: '3px 4px', border: `1px solid ${tokens.colorNeutralStroke2}`, verticalAlign: 'top', cursor: 'pointer', height: '42px', overflow: 'hidden' },
  gesperrt: { backgroundColor: tokens.colorNeutralBackground3, color: tokens.colorNeutralForeground3 },
  fehlt: { backgroundColor: 'var(--up-entfall-flaeche)' },
  voll: { backgroundColor: 'var(--up-ok-flaeche)' },
  aktiv: { boxShadow: `inset 0 0 0 2px ${tokens.colorBrandStroke1}` },
  anz: { display: 'block', fontWeight: tokens.fontWeightSemibold, fontVariantNumeric: 'tabular-nums' },
  namen: { display: 'block', color: tokens.colorNeutralForeground2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  zeile: { display: 'flex', alignItems: 'center', gap: '10px' },
  liste: { width: '160px', fontFamily: 'inherit', fontSize: tokens.fontSizeBase300, border: `1px solid ${tokens.colorNeutralStroke1}`, borderRadius: '4px', backgroundColor: tokens.colorNeutralBackground1, color: tokens.colorNeutralForeground1 },
  titel: { margin: 0, fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold },
  vorschlag: { flex: 1, minHeight: '160px', display: 'flex', flexDirection: 'column', border: `1px solid ${tokens.colorNeutralStroke2}` },
});

interface BZeile { stunde: number; lehrer: string; lehrerId: number; fach: string; eingesetzt: string; zaehler: string; status: string; vertretungen?: number[] }

export function Bereitschaften() {
  const s = useStile();
  const a = useAnsicht();
  const datum = usePlanungsdatum();
  const { daten } = useDaten(() => api.get<{ titel: string; zeilen: BZeile[] }>(vpfad(`/bereitschaften?datum=${datum}`)), [datum], { bereiche: ['Vertretung', 'Stundenplan', 'Stammdaten'], aktiv: !!datum });
  const spalten: Spalte<BZeile & { id: string }>[] = [
    { schluessel: 'stunde', titel: 'Std.', breite: 50, art: 'NurLesen', ausrichtung: 'rechts' }, { schluessel: 'lehrer', titel: 'Lehrkraft', breite: 96, art: 'NurLesen' },
    { schluessel: 'fach', titel: 'Bereitschaft', breite: 110, art: 'NurLesen' }, { schluessel: 'eingesetzt', titel: 'Eingesetzt für', breite: 260, art: 'NurLesen' },
    { schluessel: 'zaehler', titel: 'Zähler', breite: 70, art: 'NurLesen', ausrichtung: 'rechts' },
  ];
  const zeilen = (daten?.zeilen || []).map((z, i) => ({ ...z, id: `${i}` }));
  return (
    <AnsichtRahmen titel={daten?.titel || 'Bereitschaften'}
      fuss={<>
        <span className={s.lg}><i className={s.punkt} style={{ background: 'var(--up-ok-flaeche)' }} />frei</span>
        <span className={s.lg}><i className={s.punkt} style={{ background: 'var(--up-aenderung-flaeche)' }} />eingesetzt</span>
        <span className={s.lg}><i className={s.punkt} style={{ background: 'var(--colorNeutralBackground3)' }} />abwesend</span>
        <FussText rechts>{`${zeilen.length} ${zeilen.length === 1 ? 'Bereitschaft' : 'Bereitschaften'}`}</FussText>
      </>}>
      <Tabelle name="bereitschaften" spalten={spalten} zeilen={zeilen} sortierbar={false} leerText="An diesem Tag sind keine Bereitschaften eingeplant."
        zeilenKlasse={(z) => `vt-b-${z.status}`}
        beiAuswahl={(_, z) => { if (z?.vertretungen?.length) auswahlMelden({ id: z.vertretungen[0]!, ids: z.vertretungen, zeile: { v: z.vertretungen[0], vertreter: z.lehrerId }, quelle: a.id }); }} />
    </AnsichtRahmen>
  );
}

interface BpZelle { verfuegbar: boolean; bedarf: number; lehrer: { id: number; kurz: string }[] }
interface BpDaten { tage: string[]; stunden: string[]; zellen: BpZelle[][]; anzahl: number; bedarf: number; nurDoppelstunden?: boolean }
interface BpVorschlag { lehrer: number; kurz: string; punkte: number; woche: number; dep: string; hinweis: string }

export function Bereitschaftsplanung() {
  const s = useStile();
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const [gewaehlt, setGewaehlt] = useState<{ tag: number; stunde: number } | null>(null);
  const [vorschlag, setVorschlag] = useState<BpVorschlag[]>([]);
  const [eingeteilt, setEingeteilt] = useState('');
  const vorschlagRef = useRef<{ aktiveZeile: () => (BpVorschlag & { id: number }) | null } | null>(null);
  const { daten, neuLaden } = useDaten(() => api.get<BpDaten>(vpfad('/bereitschaftsplanung')), [], { bereiche: ['Stundenplan', 'Einstellungen', 'Stammdaten', 'Unterricht'] });

  async function waehlen(tag: number, stunde: number) {
    setGewaehlt({ tag, stunde });
    setVorschlag(await api.get<BpVorschlag[]>(vpfad(`/bereitschaftsplanung/vorschlag?tag=${tag}&stunde=${stunde}`)));
  }
  async function aktion(x: string, d: Record<string, unknown> = {}) {
    const r = await api.post<{ anzahl?: number; fehlt?: number }>(vpfad(`/bereitschaftsplanung/${x}`), { tag: gewaehlt?.tag ?? 0, stunde: gewaehlt?.stunde ?? 1, ...d }, { quelle: a.id });
    if (x === 'automatisch') hinweis(`${r.anzahl} Bereitschaft(en) eingetragen${r.fehlt ? `, ${r.fehlt} fehlen noch` : ''}.`, 'ok');
    await neuLaden(true);
    if (gewaehlt) await waehlen(gewaehlt.tag, gewaehlt.stunde);
  }
  const zelle = gewaehlt && daten ? daten.zellen[gewaehlt.tag]?.[gewaehlt.stunde - 1] : null;
  const vSpalten: Spalte<BpVorschlag & { id: number }>[] = [
    { schluessel: 'kurz', titel: 'Lehrkraft', breite: 80, art: 'NurLesen' }, { schluessel: 'punkte', titel: 'Punkte', breite: 64, art: 'NurLesen', ausrichtung: 'rechts' },
    { schluessel: 'woche', titel: 'Pro Woche', breite: 80, art: 'NurLesen', ausrichtung: 'rechts', hinweis: 'Bereitschaften pro Woche' },
    { schluessel: 'dep', titel: 'Konto', breite: 64, art: 'NurLesen', ausrichtung: 'rechts', hinweis: 'Freies Stundenkonto' }, { schluessel: 'hinweis', titel: 'Lage', breite: 200, art: 'NurLesen' },
  ];
  return (
    <AnsichtRahmen titel="Bereitschaftsplanung"
      werkzeuge={<>
        {schreiben ? <>
          <Werkzeug text="Automatisch besetzen" titel="Fehlende Bereitschaften automatisch besetzen" aktion={() => aktion('automatisch')} />
          <Werkzeug text="Bedarf vormittags …" titel="Bedarf für alle Vormittagsstunden setzen" aktion={async () => { const w = await formular('Bedarf für alle Vormittagsstunden', [{ name: 'n', titel: 'Lehrkräfte je Stunde', art: 'zahl', wert: 1 }], { okText: 'Setzen' }); if (w) await aktion('vormittag', { anzahl: Number(w.n) || 0 }); }} />
          <Werkzeug text="Alle entfernen …" titel="Alle Bereitschaften entfernen" aktion={async () => { if (await frage('Alle Bereitschaften aus dem Stundenplan entfernen?', { gefahr: true, ja: 'Entfernen', nein: 'Abbrechen' })) await aktion('alleentfernen'); }} />
        </> : null}
        <Rechts><Schalter text="Nur Doppelstunden" an={!!daten?.nurDoppelstunden} deaktiviert={!schreiben} titel="Bereitschaften nur als Doppelstunden verplanen" beiAenderung={(w) => void aktion('doppelstunden', { anzahl: w ? 1 : 0 })} /></Rechts>
      </>}
      fuss={daten ? <>
        <span>{daten.anzahl} Bereitschaften eingeteilt</span><span>Bedarf {daten.bedarf}</span>
        <span className={s.lg}><i className={s.punkt} style={{ background: 'var(--up-ok-flaeche)' }} />Bedarf gedeckt</span>
        <span className={s.lg}><i className={s.punkt} style={{ background: 'var(--up-entfall-flaeche)' }} />Bedarf offen</span>
        <span className={s.lg}><i className={s.punkt} style={{ background: 'var(--colorNeutralBackground3)' }} />nicht verfügbar</span>
      </> : null}>
      <div className={s.bp}>
        <div className={s.links}>
          {daten ? (
            <table className={s.raster}>
              <thead><tr><th className={s.th} style={{ width: 48 }}>Std.</th>{daten.tage.map((t) => <th key={t} className={s.th}>{t}</th>)}</tr></thead>
              <tbody>
                {daten.stunden.map((st, j) => (
                  <tr key={st}><th className={s.th}>{st}</th>{daten.tage.map((_, t) => {
                    const z = daten.zellen[t]![j]!;
                    const kl = mergeClasses(s.td, !z.verfuegbar && s.gesperrt, z.bedarf > z.lehrer.length ? s.fehlt : z.bedarf && z.bedarf <= z.lehrer.length ? s.voll : undefined, gewaehlt?.tag === t && gewaehlt.stunde === j + 1 && s.aktiv);
                    return (
                      <td key={t} className={kl} onClick={() => void waehlen(t, j + 1).catch(fehlerMelden)}>
                        {z.bedarf || z.lehrer.length ? <><span className={s.anz}>{`${z.lehrer.length}/${z.bedarf}`}</span><span className={s.namen}>{z.lehrer.map((l) => l.kurz).join(', ')}</span></> : null}
                      </td>
                    );
                  })}</tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
        <div className={s.rechts}>
          <h3 className={s.titel}>{gewaehlt && daten ? `${daten.tage[gewaehlt.tag]}, ${daten.stunden[gewaehlt.stunde - 1]}. Stunde` : 'Keine Stunde gewählt'}</h3>
          <div className={s.zeile}><Text>Bedarf</Text>
            <Input type="number" min={0} max={20} style={{ width: 80 }} disabled={!schreiben || !zelle} value={String(zelle?.bedarf ?? '')} onChange={(_, d) => { if (gewaehlt) void aktion('bedarf', { anzahl: Number(d.value) || 0 }).catch(fehlerMelden); }} />
            <Text size={200}>Lehrkräfte</Text></div>
          <div className={s.zeile} style={{ alignItems: 'flex-start' }}><Text>Eingeteilt</Text>
            <select className={s.liste} size={5} value={eingeteilt} onChange={(e) => setEingeteilt(e.target.value)} aria-label="Eingeteilt">
              {(zelle?.lehrer || []).map((l) => <option key={l.id} value={l.id}>{l.kurz}</option>)}
            </select>
            <Button size="small" disabled={!schreiben || !eingeteilt} onClick={() => void aktion('entfernen', { lehrer: Number(eingeteilt) }).catch(fehlerMelden)}>Entfernen</Button></div>
          <div className={s.zeile}><Text weight="semibold">Vorschlag</Text><Text size={200}>Doppelklick trägt ein</Text>
            <Button size="small" appearance="primary" disabled={!schreiben} onClick={() => { const k = vorschlagRef.current?.aktiveZeile(); if (k) void aktion('setzen', { lehrer: k.lehrer }).catch(fehlerMelden); }}>Eintragen</Button></div>
          <div className={s.vorschlag}>
            <Tabelle ref={vorschlagRef as never} name="bp-vorschlag" spalten={vSpalten} zeilen={vorschlag.map((v) => ({ ...v, id: v.lehrer }))} sortierbar={false} leerText="Links eine Stunde wählen."
              beiDoppelklick={(k) => void aktion('setzen', { lehrer: k.lehrer }).catch(fehlerMelden)} />
          </div>
        </div>
      </div>
    </AnsichtRahmen>
  );
}
