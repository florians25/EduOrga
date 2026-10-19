// Vertretungsplan ausgeben: Zeitraum und Fassung, Seitenlayout (Felder, Gruppierung, Raster …, in der Schuldatei gespeichert),
// Vorschau als PDF; HTML und Monitoransicht.
import { Button, Checkbox, Input, Select, Tooltip } from '@fluentui/react-components';
import { ArrowUp16Regular } from '@fluentui/react-icons';
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { useAnsicht } from '@/kern/ansichten';
import { useDaten } from '@/kern/laden';
import { useEreignis, betrifft } from '@/kern/ereignisse';
import { useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, Feld, FussText, Rechts, Werkzeug } from '@/komponenten/ansicht';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { MenueKnopf } from '@/komponenten/menue';
import { DatumFeld } from '@/komponenten/eingaben';
import { druckUrl, herunterladen, imTab, naechsterWochentag } from './kern';
import './druck.css';

interface Feldlayout { schluessel: string; drucken: boolean; ueberschrift: string; anteil: number }
type Layout = Record<string, unknown> & { felder: Feldlayout[]; gruppierung: string; schriftgroesse: number; ueberschrift: string; klassenAuswahl?: string[]; lehrerAuswahl?: string[] };
interface Aushang { layout: Layout; felder: { schluessel: string; klassen: string; lehrer: string }[]; gruppierungen: string[]; titel: string }

const SEITE: [string, string, string?][] = [
  ['querformat', 'Querformat'], ['raster', 'Tabellenraster'], ['ueberschriftJeElement', 'Überschrift je Element'], ['eineSeiteJeElement', 'Eine Seite je Element'],
  ['elementueberschriftKomprimiert', 'Überschrift je Element kompakt'], ['ersteBeschriftungJedeSeite', 'Element oben auf jeder Seite'], ['stundenbezeichnung', 'Stundenbezeichnung'],
];
const INHALT: [string, string, string?][] = [
  ['nachrichten', 'Nachrichten zum Tag'], ['blockierteRaeume', 'Blockierte Räume'], ['abwesendeKlassen', 'Abwesende Klassen'],
  ['abwesendeLehrer', 'Abwesende Lehrkräfte', 'Nur in der Fassung für Lehrkräfte'], ['lehrerMitAbsenzgrund', 'Abwesende Lehrkräfte mit Grund'],
  ['abwesendeNichtDrucken', 'Abwesende nicht drucken'], ['entfallslehrerDurchstreichen', 'Lehrkraft bei Entfall durchstreichen'],
  ['kombinierteKlassen', 'Klassen zusammenfassen (2a, 2b → 2ab)'], ['blockvertretungenZusammenfassen', 'Mehrstündige Vertretungen zusammenfassen'],
  ['keinEntfallBeiErsatz', 'Kein Entfall bei Ersatz in derselben Stunde'], ['auchElementeOhneVertretung', 'Auch Elemente ohne Vertretung'], ['nurNeue', 'Nur neue Vertretungen'],
];

function ListenFeld({ wert, gesperrt, setzen }: { wert: string[] | undefined; gesperrt: boolean; setzen: (w: string[]) => void }) {
  const [t, setT] = useState((wert || []).join(','));
  useEffect(() => setT((wert || []).join(',')), [wert]);
  return <Input size="small" value={t} placeholder="alle" disabled={gesperrt} onChange={(_, d) => setT(d.value)} onBlur={() => setzen(t.split(',').map((x) => x.trim()).filter(Boolean))} />;
}

export default function Vertretungsplan() {
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const start = (a.p.von as string) || naechsterWochentag();
  const von = start;
  const bis = (a.p.bis as string) && (a.p.bis as string) >= von ? (a.p.bis as string) : von;
  const version = a.p.version === 'lehrer' ? 'lehrer' : 'klassen';
  const [layout, setLayout] = useState<Layout | null>(null);
  const [geaendert, setGeaendert] = useState(false);
  const [status, setStatus] = useState('');
  const [nr, setNr] = useState(0);
  const { daten: d, setDaten, neuLaden } = useDaten(() => api.get<Aushang>(druckUrl('/aushang')), []);
  useEffect(() => { if (d) { setLayout(structuredClone(d.layout)); setGeaendert(false); } }, [d]);
  useEreignis('daten', (e) => {
    if (e.quelle === a.id) return;
    if (betrifft(e, 'Vertretung')) setNr((x) => x + 1);
    if (!geaendert && betrifft(e, 'Einstellungen')) void neuLaden(true);
  });

  const url = (ausgabe: string) => druckUrl('/vertretungsplan', { von, bis, version, ausgabe });
  const lehrer = version === 'lehrer';
  const aendern = (teil: Partial<Layout>) => {
    setLayout((l) => (l ? { ...l, ...teil } : l));
    setGeaendert(true);
    setStatus('Seitenlayout geändert – „Layout speichern“ übernimmt es in die Schuldatei.');
  };
  const feldAendern = (i: number, teil: Partial<Feldlayout>) => layout && aendern({ felder: layout.felder.map((f, j) => (j === i ? { ...f, ...teil } : f)) });
  const hoch = (i: number) => { if (!layout || i === 0) return; const f = [...layout.felder]; f.splice(i - 1, 0, f.splice(i, 1)[0]!); aendern({ felder: f }); };
  const zeitraum = (teil: { von?: string; bis?: string; version?: string }) => {
    const n = { von, bis, version, ...teil };
    if (n.bis < n.von) n.bis = n.von;
    a.parameterSetzen(n);
  };
  const speichern = async () => {
    if (!layout) return;
    try {
      const neu = await api.put<Aushang>(druckUrl('/aushang'), layout, { quelle: a.id });
      setDaten(neu);
      setStatus('Seitenlayout gespeichert.');
      hinweis('Seitenlayout gespeichert.', 'ok', 1500);
      setNr((x) => x + 1);
    } catch (e) { fehlerMelden(e); }
  };
  const schalter = ([name, text, titel]: [string, string, string?]) => (
    <Checkbox key={name} label={text} title={titel} disabled={!schreiben} checked={!!layout?.[name]} onChange={(_, x) => aendern({ [name]: !!x.checked })} />
  );

  return (
    <AnsichtRahmen titel="Vertretungsplan ausgeben" laden={!d}
      werkzeuge={<>
        <Werkzeug text="Seitenansicht" aktion={() => a.oeffnen('druck.vorschau', { url: url('pdf'), titel: 'Druckvorschau' })} />
        <Werkzeug text="PDF öffnen" titel="PDF in neuem Browser-Tab öffnen und dort drucken" aktion={() => imTab(url('pdf'))} />
        <Werkzeug text="Herunterladen" aktion={() => herunterladen(url('pdf'))} />
        <MenueKnopf text="Weitere Aktionen" eintraege={() => [
          { text: 'Als HTML öffnen', aktion: () => imTab(url('html')) },
          { text: 'Monitoransicht öffnen (HTML)', aktion: () => imTab(url('monitor')) },
        ]} />
        <Rechts>
          <Werkzeug text="Layout speichern" deaktiviert={!schreiben || !geaendert} aktion={speichern} />
          <Werkzeug text="Verwerfen" titel="Änderungen am Seitenlayout verwerfen" deaktiviert={!geaendert} aktion={() => { void neuLaden(true); setStatus(''); }} />
        </Rechts>
      </>}
      filter={<>
        <Feld titel="Von"><DatumFeld size="small" wert={von} beiAenderung={(datum) => { if (datum) zeitraum({ von: datum }); }} /></Feld>
        <Feld titel="Bis"><DatumFeld size="small" wert={bis} beiAenderung={(datum) => { if (datum) zeitraum({ bis: datum }); }} /></Feld>
        <Feld titel="Fassung">
          <Select size="small" value={version} onChange={(_, x) => zeitraum({ version: x.value })}>
            <option value="klassen">Für Schülerinnen und Schüler</option><option value="lehrer">Für Lehrkräfte</option>
          </Select>
        </Feld>
      </>}
      fuss={<FussText>{status}</FussText>}>
      {d && layout ? (
        <div className="dr-teilung">
          <div className="dr-layout">
            <h3>Seitenlayout</h3>
            <div className="dr-formular">
              <label>Überschrift</label><Input size="small" value={layout.ueberschrift} placeholder={d.titel} disabled={!schreiben} onChange={(_, x) => aendern({ ueberschrift: x.value })} />
              <label>Schriftgröße (pt)</label><Input size="small" type="number" min={6} max={20} step={0.5} style={{ width: 80 }} value={String(layout.schriftgroesse)} disabled={!schreiben} onChange={(_, x) => aendern({ schriftgroesse: Number(x.value) })} />
              <label>Gruppierung</label>
              <Select size="small" value={layout.gruppierung} disabled={!schreiben} onChange={(_, x) => aendern({ gruppierung: x.value })}>
                {d.gruppierungen.map((g) => <option key={g} value={g}>{g}</option>)}
              </Select>
              <label>Nur Klassen</label><ListenFeld wert={layout.klassenAuswahl} gesperrt={!schreiben} setzen={(w) => aendern({ klassenAuswahl: w })} />
              <label>Nur Lehrkräfte</label><ListenFeld wert={layout.lehrerAuswahl} gesperrt={!schreiben} setzen={(w) => aendern({ lehrerAuswahl: w })} />
            </div>
            <h3>Seite</h3>
            <div className="dr-schalterliste">{SEITE.map(schalter)}</div>
            <h3>Inhalt</h3>
            <div className="dr-schalterliste">{INHALT.map(schalter)}</div>
            <h3>Spalten</h3>
            <table className="dr-felder">
              <thead><tr><th className="mitte">Drucken</th><th>Spalte</th><th>Überschrift</th><th>Breite</th><th /></tr></thead>
              <tbody>
                {layout.felder.map((fe, i) => {
                  const std = d.felder.find((x) => x.schluessel === fe.schluessel);
                  const name = lehrer ? std?.lehrer : std?.klassen;
                  return (
                    <tr key={fe.schluessel}>
                      <td className="mitte"><Checkbox aria-label={`${name} drucken`} checked={fe.drucken} disabled={!schreiben} onChange={(_, x) => feldAendern(i, { drucken: !!x.checked })} /></td>
                      <td>{name}</td>
                      <td><Input size="small" value={fe.ueberschrift} placeholder={name} disabled={!schreiben} onChange={(_, x) => feldAendern(i, { ueberschrift: x.value })} /></td>
                      <td className="zahl"><Input size="small" type="number" min={2} max={60} style={{ width: 64 }} aria-label="Breite in Prozent" value={String(Math.round(fe.anteil * 100))} disabled={!schreiben}
                        onChange={(_, x) => feldAendern(i, { anteil: Math.max(2, Number(x.value) || 10) / 100 })} /> %</td>
                      <td><Tooltip content="Nach oben" relationship="label"><Button size="small" appearance="subtle" icon={<ArrowUp16Regular />} disabled={!schreiben || i === 0} onClick={() => hoch(i)} /></Tooltip></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="dr-leise">Das Seitenlayout wird mit „Layout speichern“ in der Schuldatei gespeichert.</p>
          </div>
          <iframe key={`${nr}|${von}|${bis}|${version}`} className="dr-vorschau" title="Vertretungsplan" src={url('pdf')} />
        </div>
      ) : null}
    </AnsichtRahmen>
  );
}
