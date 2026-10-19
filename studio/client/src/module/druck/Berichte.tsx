// Berichte: Listen und Auswertungen als PDF (Vorschau), HTML oder CSV; bei Bedarf mit Zeitraum.
import { Button, Input } from '@fluentui/react-components';
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { useAnsicht } from '@/kern/ansichten';
import { useDaten } from '@/kern/laden';
import { AnsichtRahmen, Feld, Werkzeug } from '@/komponenten/ansicht';
import { DatumFeld } from '@/komponenten/eingaben';
import { druckUrl, heute, herunterladen, imTab, type Auswahl } from './kern';
import './druck.css';

export default function Berichte() {
  const a = useAnsicht();
  const { daten, laedt } = useDaten(() => api.get<Auswahl>(druckUrl('/auswahl')), []);
  const [von, setVon] = useState('');
  const [bis, setBis] = useState('');
  const [nr, setNr] = useState(0);
  useEffect(() => {
    if (!daten) return;
    const h0 = heute();
    setVon(daten.schuljahrVon);
    setBis(h0 < daten.schuljahrVon ? daten.schuljahrVon : h0 > daten.schuljahrBis ? daten.schuljahrBis : h0);
  }, [daten]);
  const berichte = daten?.berichte || [];
  const b = berichte.find((x) => x.id === a.p.bericht) || berichte.find((x) => x.id === 'lehrer-sollist') || berichte[0];
  const url = (ausgabe: string) => (b ? druckUrl(`/bericht/${b.id}`, { von: b.zeitraum ? von : undefined, bis: b.zeitraum ? bis : undefined, ausgabe }) : '');
  const [pdf, setPdf] = useState('');
  useEffect(() => { if (b && von) setPdf(url('pdf')); }, [b?.id, nr, von, bis]); // eslint-disable-line react-hooks/exhaustive-deps
  const gruppen = [...new Set(berichte.map((x) => x.gruppe))];

  return (
    <AnsichtRahmen titel="Berichte" laden={laedt && !daten}
      werkzeuge={<>
        <Werkzeug text="PDF öffnen" titel="Bericht als PDF in neuem Browser-Tab öffnen" deaktiviert={!b} aktion={() => imTab(url('pdf'))} />
        <Werkzeug text="HTML" titel="Bericht als HTML-Seite öffnen" deaktiviert={!b} aktion={() => imTab(url('html'))} />
        <Werkzeug text="CSV" titel="Bericht als CSV-Datei herunterladen" deaktiviert={!b} aktion={() => herunterladen(url('csv'))} />
      </>}>
      {b ? (
        <div className="dr-teilung">
          <nav className="dr-berichtliste" aria-label="Berichte">
            {gruppen.map((g) => (
              <div key={g} className="dr-gruppe">
                <div className="dr-gruppentitel">{g}</div>
                {berichte.filter((x) => x.gruppe === g).map((x) => (
                  <button key={x.id} type="button" className={`dr-bericht${x.id === b.id ? ' aktiv' : ''}`} title={x.hinweis} aria-current={x.id === b.id ? 'true' : undefined}
                    onClick={() => a.parameterSetzen({ bericht: x.id })}>{x.titel}</button>
                ))}
              </div>
            ))}
          </nav>
          <div className="dr-berichtvorschau">
            <div className="dr-berichtkopf">
              <div><b>{b.titel}</b><div className="dr-leise">{b.hinweis}</div></div>
              {b.zeitraum ? (
                <div className="dr-zeitraum">
                  <Feld titel="Von"><DatumFeld size="small" wert={von} beiAenderung={(datum) => setVon(datum)} /></Feld>
                  <Feld titel="Bis"><DatumFeld size="small" wert={bis} beiAenderung={(datum) => setBis(datum)} /></Feld>
                  <Button size="small" onClick={() => setNr((x) => x + 1)}>Anzeigen</Button>
                </div>
              ) : null}
            </div>
            {pdf ? <iframe key={nr} className="dr-vorschau" title={b.titel} src={pdf} /> : null}
          </div>
        </div>
      ) : null}
    </AnsichtRahmen>
  );
}
