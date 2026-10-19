// Kalender der Vertretungsplanung: Kalenderwoche und Datum, Woche mit Kennzahlen (offene Vertretungen, abwesende Klassen,
// Freistellungen, gesperrte Räume, Raumvertretungen, Tagestexte, Kollisionen – Klick wählt den Tag), Reiter Tagestexte
// (direkte Eingabe) und Kalendertag (Schultag, Feiertag, unterrichtsfrei mit Grund, einzelne Stunden unterrichtsfrei, Notiz).
import {
  Button, Checkbox, Field, Input, Radio, RadioGroup, Select, Tab, TabList, Text, makeStyles, tokens,
} from '@fluentui/react-components';
import { ChevronLeft20Regular, ChevronRight20Regular, Delete20Regular } from '@fluentui/react-icons';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/api/client';
import { useAnsicht, type AnsichtProps } from '@/kern/ansichten';
import { arbeitsplatzOeffnen } from '@/kern/befehle';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, Feld, Rechts, Werkzeug } from '@/komponenten/ansicht';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { Tabelle, type Spalte } from '@/komponenten/tabelle/Tabelle';
import { DatumFeld } from '@/komponenten/eingaben';
import { useElemente } from '../gemeinsam';
import { blaettern, datumLesen, datumSetzen, datumText, isoAus, montag, plusTage, usePlanungsdatum, vpfad } from './kern';

interface Wochentag { datum: string; text: string; tag: string; offen: number; abwKl: number; freis: number; blRaeume: number; raumV: number; tagestexte: number; kollL: number; kollR: number; frei: string; unterrichtstag: boolean }
interface Tagestext { start?: string | null; bis: string | null; text: string; portal: boolean; art: string; elemente: string; formatiert?: boolean }
interface KalenderDaten { kw: number; datum: string; wochentyp: string; unterrichtstag: boolean; titel: string; woche: Wochentag[]; tagestexte: Tagestext[]; kalendertag: { art: string; grund: string; stunden: string; notiz: string } }

const ARTEN: [string, string][] = [['Alle', 'Alle'], ['Klassen', 'Klassen'], ['Lehrer', 'Lehrkräfte'], ['Nur Lehrer', 'Nur Lehrkräfte']];

const useStile = makeStyles({
  aufbau: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 },
  oben: { flex: '1 1 45%', minHeight: '160px', display: 'flex', flexDirection: 'column' },
  unten: { flex: '1 1 55%', minHeight: '180px', display: 'flex', flexDirection: 'column', borderTop: `1px solid ${tokens.colorNeutralStroke2}` },
  reiter: { padding: '4px 12px 0 12px' },
  flaeche: { flex: 1, overflow: 'auto', padding: '8px 16px 16px 16px' },
  texte: { width: '100%', borderCollapse: 'collapse', fontSize: tokens.fontSizeBase300 },
  th: { textAlign: 'left', fontWeight: tokens.fontWeightMedium, color: tokens.colorNeutralForeground2, fontSize: tokens.fontSizeBase200, padding: '4px 4px' },
  td: { padding: '2px 4px', verticalAlign: 'middle' },
  formular: { display: 'grid', gridTemplateColumns: '160px minmax(0, 420px)', gap: '10px 16px', alignItems: 'center', marginTop: '8px' },
  label: { color: tokens.colorNeutralForeground2 },
  frei: { color: 'var(--up-frei)' },
  titel: { margin: '4px 0 0 0', fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold },
});

interface TextZeile extends Tagestext { schluessel: number }
let zz = 0;

export default function Kalender({ p }: AnsichtProps) {
  const s = useStile();
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const datum = usePlanungsdatum();
  const [reiter, setReiter] = useState(Number(p.reiter ?? 0));
  const gruende = useElemente('abwesenheitsgrund');
  const { daten, setDaten } = useDaten(() => api.get<KalenderDaten>(vpfad(`/kalender?datum=${datum}`)), [datum], { bereiche: ['Vertretung', 'Einstellungen'], quelle: a.id, aktiv: !!datum });
  const [texte, setTexte] = useState<TextZeile[]>([]);
  const [tag, setTag] = useState({ art: 'normal', grund: '', stunden: '', notiz: '' });

  useEffect(() => { if (p.reiter !== undefined) setReiter(Number(p.reiter)); }, [p.reiter]);
  useEffect(() => {
    if (!daten) return;
    setTexte(daten.tagestexte.map((t) => ({ ...t, schluessel: ++zz })));
    setTag({ ...daten.kalendertag });
  }, [daten]);

  const texteSpeichern = async (liste: TextZeile[]) => {
    try {
      const d = await api.put<KalenderDaten>(vpfad('/tagestexte'), { datum, texte: liste.filter((t) => t.text.trim()).map(({ schluessel: _, ...t }) => t) }, { quelle: a.id });
      setDaten(d);
    } catch (e) { fehlerMelden(e); }
  };
  const textAendern = (k: number, teil: Partial<Tagestext>, sofort = false) => {
    const liste = texte.map((t) => (t.schluessel === k ? { ...t, ...teil } : t));
    setTexte(liste);
    if (sofort) void texteSpeichern(liste);
  };
  const kalendertagSpeichern = async (n: typeof tag) => {
    setTag(n);
    try {
      setDaten(await api.post<KalenderDaten>(vpfad('/kalendertag'), { datum, ...n }, { quelle: a.id }));
      hinweis('Kalendertag gespeichert.', 'ok', 1500);
    } catch (e) { fehlerMelden(e); }
  };

  const zahl = (k: keyof Wochentag) => (w: Wochentag) => (w[k] ? String(w[k]) : '');
  const rot = (k: keyof Wochentag) => (w: Wochentag) => (Number(w[k]) > 0 ? 'vt-rot' : null);
  const spalten = useMemo<Spalte<Wochentag>[]>(() => [
    { schluessel: 'text', titel: 'Datum', breite: 64, art: 'NurLesen' }, { schluessel: 'tag', titel: 'Tag', breite: 44, art: 'NurLesen' },
    { schluessel: 'offen', titel: 'Offen', breite: 56, ausrichtung: 'rechts', art: 'NurLesen', hinweis: 'Offene Vertretungen', wert: zahl('offen'), klasse: rot('offen') },
    { schluessel: 'abwKl', titel: 'Kl. abw.', breite: 64, ausrichtung: 'rechts', art: 'NurLesen', hinweis: 'Abwesende Klassen', wert: zahl('abwKl') },
    { schluessel: 'freis', titel: 'Freigest.', breite: 72, ausrichtung: 'rechts', art: 'NurLesen', hinweis: 'Freigestellte Lehrkräfte (Klasse abwesend)', wert: zahl('freis') },
    { schluessel: 'blRaeume', titel: 'Gesperrt', breite: 68, ausrichtung: 'rechts', art: 'NurLesen', hinweis: 'Gesperrte Räume', wert: zahl('blRaeume') },
    { schluessel: 'raumV', titel: 'Raumvertr.', breite: 80, ausrichtung: 'rechts', art: 'NurLesen', hinweis: 'Raumvertretungen', wert: zahl('raumV') },
    { schluessel: 'tagestexte', titel: 'Texte', breite: 56, ausrichtung: 'rechts', art: 'NurLesen', hinweis: 'Tagestexte', wert: zahl('tagestexte') },
    { schluessel: 'kollL', titel: 'Koll. L.', breite: 64, ausrichtung: 'rechts', art: 'NurLesen', hinweis: 'Kollisionen von Lehrkräften', wert: zahl('kollL'), klasse: rot('kollL') },
    { schluessel: 'kollR', titel: 'Koll. R.', breite: 64, ausrichtung: 'rechts', art: 'NurLesen', hinweis: 'Kollisionen von Räumen', wert: zahl('kollR'), klasse: rot('kollR') },
    { schluessel: 'frei', titel: 'Hinweis', breite: 220, art: 'NurLesen' },
  ], []);

  const kwSetzen = (kw: number) => {
    if (!datum || !daten || !kw) return;
    const diff = kw - daten.kw;
    if (diff) void datumSetzen(montag(plusTage(datum, diff * 7)));
  };
  const neuerText = (): TextZeile => ({ schluessel: ++zz, start: null, bis: null, text: '', portal: true, art: 'Alle', elemente: '' });
  const alleTexte = [...texte, ...(schreiben ? [neuerText()] : [])];

  return (
    <AnsichtRahmen titel={daten ? `Kalender – ${daten.titel}` : 'Kalender'}
      werkzeuge={<>
        <Werkzeug titel="Vorheriger Unterrichtstag (Strg+Bild↑)" icon={<ChevronLeft20Regular />} aktion={() => blaettern(-1)} />
        <Werkzeug text="Heute" titel="Zum heutigen Tag" aktion={() => datumSetzen(isoAus(new Date()))} />
        <Werkzeug titel="Nächster Unterrichtstag (Strg+Bild↓)" icon={<ChevronRight20Regular />} aktion={() => blaettern(1)} />
        {a.lage === 'seite' ? <Rechts><Werkzeug text="Zur Tagesplanung" titel="Gewählten Tag in der Tagesplanung bearbeiten (Doppelklick auf einen Tag)" aktion={() => arbeitsplatzOeffnen('tagesplanung')} /></Rechts> : null}
      </>}
      filter={<>
        <Feld titel="Kalenderwoche"><Input size="small" type="number" min={1} max={53} style={{ width: 80 }} value={daten ? String(daten.kw) : ''} onChange={(_, x) => kwSetzen(Number(x.value))} /></Feld>
        <Feld titel="Datum"><DatumFeld size="small" wert={datum || ''} beiAenderung={(datum) => { if (datum) void datumSetzen(datum); }} /></Feld>
        {daten ? <Text size={200} className={daten.unterrichtstag ? undefined : s.frei}>{`${daten.wochentyp}-Woche${daten.unterrichtstag ? '' : ' · kein Unterrichtstag'}`}</Text> : null}
      </>}>
      <div className={s.aufbau}>
        <div className={s.oben}>
          <Tabelle<Wochentag> name="kalender-woche" spalten={spalten} zeilen={daten?.woche || []} id={(w) => w.datum} sortierbar={false} leerText="Keine Tage."
            zeilenKlasse={(w) => `${w.unterrichtstag ? '' : 'vt-frei'} ${w.datum === datum ? 'gewaehlt' : ''}`}
            beiAuswahl={(_, w) => { if (w && w.datum !== datum) void datumSetzen(w.datum); }}
            beiDoppelklick={(w) => { void datumSetzen(w.datum).then(() => { if (a.lage === 'seite') arbeitsplatzOeffnen('tagesplanung'); }); }} />
        </div>
        <div className={s.unten}>
          <TabList className={s.reiter} size="small" selectedValue={String(reiter)} onTabSelect={(_, x) => { const r = Number(x.value); setReiter(r); a.parameterSetzen({ reiter: r }); }}>
            <Tab value="0">{`Tagestexte (${daten?.tagestexte.length ?? 0})`}</Tab>
            <Tab value="1">Kalendertag</Tab>
          </TabList>
          <div className={s.flaeche}>
            {reiter === 0 ? (
              <table className={s.texte}>
                <colgroup><col style={{ width: 112 }} /><col /><col style={{ width: 56 }} /><col style={{ width: 140 }} /><col style={{ width: 130 }} /><col style={{ width: 40 }} /></colgroup>
                <thead><tr><th className={s.th}>Gültig bis</th><th className={s.th}>Text</th><th className={s.th} title="In UntPlan Web anzeigen">Web</th><th className={s.th}>Für</th><th className={s.th}>Elemente</th><th /></tr></thead>
                <tbody>
                  {alleTexte.map((t, i) => {
                    const neu = i >= texte.length;
                    const setzen = (teil: Partial<Tagestext>, sofort = false) => {
                      if (neu) { if (!teil.text && teil.text !== undefined) return; const n = { ...t, ...teil }; setTexte([...texte, n]); if (sofort) void texteSpeichern([...texte, n]); }
                      else textAendern(t.schluessel, teil, sofort);
                    };
                    return (
                      <tr key={t.schluessel} style={t.formatiert ? { fontWeight: 600 } : undefined}>
                        <td className={s.td}><Input size="small" disabled={!schreiben} defaultValue={datumText(t.bis)} placeholder={datumText(datum)} title="Gültig bis"
                          onBlur={(e) => { try { const b = e.target.value ? datumLesen(e.target.value, datum || '') : null; if (b !== t.bis) setzen({ bis: b }, true); } catch (f) { fehlerMelden(f); } }} /></td>
                        <td className={s.td}><Input size="small" style={{ width: '100%' }} disabled={!schreiben} value={t.text} placeholder={neu ? 'Neuer Tagestext …' : ''}
                          title={t.formatiert ? 'Formatierter Tagestext (Formatierung bleibt erhalten, solange der Text nicht geändert wird)' : 'Tagestext'}
                          onChange={(_, x) => setzen({ text: x.value })} onBlur={() => { if (!neu) void texteSpeichern(texte); }} /></td>
                        <td className={s.td}><Checkbox disabled={!schreiben} checked={t.portal} onChange={(_, x) => setzen({ portal: !!x.checked }, !neu)} /></td>
                        <td className={s.td}><Select size="small" disabled={!schreiben} value={t.art} onChange={(_, x) => setzen({ art: x.value }, !neu)}>{ARTEN.map(([w, x]) => <option key={w} value={w}>{x}</option>)}</Select></td>
                        <td className={s.td}><Input size="small" disabled={!schreiben} value={t.elemente} placeholder={neu ? 'alle' : ''} title="Klassen bzw. Lehrkräfte (Kurznamen)"
                          onChange={(_, x) => setzen({ elemente: x.value })} onBlur={() => { if (!neu) void texteSpeichern(texte); }} /></td>
                        <td className={s.td}>{!neu ? <Button size="small" appearance="subtle" icon={<Delete20Regular />} disabled={!schreiben} aria-label="Tagestext löschen" title="Tagestext löschen"
                          onClick={() => { const l = texte.filter((x) => x.schluessel !== t.schluessel); setTexte(l); void texteSpeichern(l); }} /> : null}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div>
                <h3 className={s.titel}>{daten?.titel}</h3>
                <div className={s.formular}>
                  <span className={s.label}>Art des Tages</span>
                  <RadioGroup layout="horizontal" value={tag.art} disabled={!schreiben} onChange={(_, x) => void kalendertagSpeichern({ ...tag, art: x.value })}>
                    <Radio value="normal" label="Normaler Schultag" /><Radio value="feiertag" label="Feiertag" /><Radio value="frei" label="Unterrichtsfrei" /><Radio value="stunden" label="Nur einzelne Stunden unterrichtsfrei" />
                  </RadioGroup>
                  <span className={s.label}>Grund</span>
                  <Select disabled={!schreiben} value={tag.grund} onChange={(_, x) => void kalendertagSpeichern({ ...tag, grund: x.value })}>
                    <option value="">Ohne Grund</option>
                    {gruende.map((g) => <option key={g.id} value={g.k}>{g.l ? `${g.k} – ${g.l}` : g.k}</option>)}
                  </Select>
                  <span className={s.label}>Freie Stunden</span>
                  <Field><Input disabled={!schreiben} value={tag.stunden} placeholder="z. B. 6-8 oder 1,5" onFocus={() => setTag((x) => ({ ...x, art: 'stunden' }))}
                    onChange={(_, x) => setTag((y) => ({ ...y, stunden: x.value }))} onBlur={() => void kalendertagSpeichern({ ...tag, art: tag.stunden ? 'stunden' : tag.art })} /></Field>
                  <span className={s.label}>Notiz</span>
                  <Input disabled={!schreiben} value={tag.notiz} placeholder="Nur für die Planung, wird nicht ausgegeben" onChange={(_, x) => setTag((y) => ({ ...y, notiz: x.value }))} onBlur={() => void kalendertagSpeichern(tag)} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AnsichtRahmen>
  );
}
