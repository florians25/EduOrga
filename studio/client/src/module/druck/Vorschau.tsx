// Druckvorschau: eingebettete PDF- bzw. HTML-Ausgabe des Servers.
import { useState } from 'react';
import { useAnsicht } from '@/kern/ansichten';
import { AnsichtRahmen, FussText, Werkzeug } from '@/komponenten/ansicht';
import { herunterladen, imTab } from './kern';
import './druck.css';

export default function Vorschau() {
  const a = useAnsicht();
  const url = String(a.p.url || '');
  const titel = String(a.p.titel || 'Druckvorschau');
  const [nr, setNr] = useState(0);
  return (
    <AnsichtRahmen titel={titel}
      werkzeuge={<>
        <Werkzeug text="Im Browser öffnen" titel="In neuem Browser-Tab öffnen und dort drucken" aktion={() => imTab(url)} />
        <Werkzeug text="Herunterladen" aktion={() => herunterladen(url)} />
        <Werkzeug text="Neu laden" aktion={() => setNr((x) => x + 1)} />
      </>}
      fuss={<FussText>Zum Drucken die Ausgabe im Browser öffnen und den Druck des Browsers verwenden; das Querformat ist im PDF bereits eingestellt.</FussText>}>
      {url ? <iframe key={nr} className="dr-vorschau" src={url} title={titel} /> : null}
    </AnsichtRahmen>
  );
}
