// Druckauswahl für Stundenpläne: Planart, Planformat, kompakt/farbig, Auswahl der Elemente; Ausgabe als PDF bzw. HTML.
import { Button, Checkbox, Field, Input, Link, Select, Tab, TabList } from '@fluentui/react-components';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/api/client';
import { useAnsicht } from '@/kern/ansichten';
import { useDaten } from '@/kern/laden';
import { AnsichtRahmen, FussText, Trenner, Werkzeug } from '@/komponenten/ansicht';
import { druckUrl, herunterladen, imTab, TYPEN, type Auswahl as AuswahlDaten } from './kern';
import './druck.css';

type Typ = 'klasse' | 'lehrer' | 'raum' | 'fach';

export default function Auswahl() {
  const a = useAnsicht();
  const typ = (['klasse', 'lehrer', 'raum', 'fach'].includes(String(a.p.typ)) ? a.p.typ : 'klasse') as Typ;
  const { daten, laedt } = useDaten(() => api.get<AuswahlDaten>(druckUrl('/auswahl')), [], { bereiche: ['Stammdaten', 'Einstellungen'] });
  const [gewaehlt, setGewaehlt] = useState<Set<number> | null>(null);
  const [format, setFormat] = useState('');
  const [kompakt, setKompakt] = useState(false);
  const [farbig, setFarbig] = useState(false);
  const [suche, setSuche] = useState('');
  const elemente = daten?.[typ] || [];
  // beim Wechsel der Planart bzw. beim Laden: alle wählen
  useEffect(() => { if (daten) setGewaehlt(new Set(daten[typ].map((e) => e.id))); }, [daten, typ]);
  const formate = (daten?.formate || []).filter((x) => x.typ === typ);
  const fmt = formate.some((x) => x.name === format) ? format : '';
  const auswahl = gewaehlt || new Set<number>();

  const url = (ausgabe?: string) => druckUrl('/stundenplaene', {
    typ, ids: auswahl.size === elemente.length ? 'alle' : [...auswahl].join(','), format: fmt, kompakt, farbig, ausgabe,
  });
  const treffer = useMemo(() => {
    const t = suche.trim().toLowerCase();
    return elemente.filter((e) => !t || e.k.toLowerCase().includes(t) || (e.l || '').toLowerCase().includes(t));
  }, [elemente, suche]);
  const umschalten = (id: number, an: boolean) => setGewaehlt((g) => { const n = new Set(g); if (an) n.add(id); else n.delete(id); return n; });

  return (
    <AnsichtRahmen titel="Druckauswahl" laden={laedt && !daten}
      werkzeuge={<>
        <Werkzeug text="Seitenansicht" aktion={() => a.oeffnen('druck.vorschau', { url: url(), titel: 'Druckvorschau' })} />
        <Werkzeug text="PDF öffnen" titel="PDF in neuem Browser-Tab öffnen und dort drucken" aktion={() => imTab(url())} />
        <Werkzeug text="Herunterladen" aktion={() => herunterladen(url())} />
        <Trenner />
        <Werkzeug text="HTML-Ausgabe" titel="Stundenpläne als HTML-Seite anzeigen" aktion={() => a.oeffnen('druck.vorschau', { url: url('html'), titel: 'Stundenpläne (HTML)' })} />
      </>}
      fuss={<FussText>{`${TYPEN.find((x) => x[0] === typ)![1]}: ${auswahl.size} von ${elemente.length} gewählt`}</FussText>}>
      <div className="dr-teilung">
        <div className="dr-optionen">
          <h3>Pläne</h3>
          <TabList size="small" selectedValue={typ} onTabSelect={(_, d) => a.parameterSetzen({ typ: d.value as string })} aria-label="Planart">
            {TYPEN.map(([k, t]) => <Tab key={k} value={k}>{t}</Tab>)}
          </TabList>
          <h3>Format</h3>
          <Field label="Planformat" orientation="horizontal">
            <Select size="small" value={fmt} onChange={(_, d) => { setFormat(d.value); const fo = formate.find((x) => x.name === d.value); if (fo) setKompakt(!fo.gross); }}>
              <option value="">Standard</option>
              {formate.map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}
            </Select>
          </Field>
          <Checkbox label="Kompakt (zwei Pläne je Seite)" checked={kompakt} onChange={(_, d) => setKompakt(!!d.checked)} />
          <Checkbox label="Fachfarben statt Graustufen" checked={farbig} onChange={(_, d) => setFarbig(!!d.checked)} />
          <Link as="button" onClick={() => a.oeffnen('formate.editor', { typ })}>Planformate bearbeiten</Link>
          <p className="dr-leise">Ausgabe als Formular in A4 quer: Raster mit Pausen, Unterrichtsliste, Fußnoten zu Kopplungen und Fächerlegende.</p>
        </div>
        <div className="dr-elemente">
          <div className="dr-listenkopf">
            <Input type="search" size="small" placeholder="Suchen" aria-label="Liste filtern" style={{ flex: 1, maxWidth: 320 }} value={suche} onChange={(_, d) => setSuche(d.value)} />
            <Button size="small" onClick={() => setGewaehlt(new Set(elemente.map((e) => e.id)))}>Alle wählen</Button>
            <Button size="small" onClick={() => setGewaehlt(new Set())}>Keine</Button>
          </div>
          <div className="dr-liste" data-testid="druck-liste">
            {!treffer.length ? <div className="dr-leer">{suche.trim() ? 'Keine Einträge zur Suche gefunden.' : 'Keine Einträge vorhanden.'}</div> : treffer.map((e) => (
              <Checkbox key={e.id} className="dr-element" checked={auswahl.has(e.id)} onChange={(_, d) => umschalten(e.id, !!d.checked)}
                label={<><b>{e.k}</b> <span className="dr-lang">{e.l || ''}</span></>} />
            ))}
          </div>
        </div>
      </div>
    </AnsichtRahmen>
  );
}
