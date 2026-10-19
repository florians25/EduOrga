// Dialoge des Druckmoduls: Aushang (HTML/ZIP) und Kalender der Lehrkräfte (iCalendar).
import { Field, Input, Select } from '@fluentui/react-components';
import { useState } from 'react';
import { api } from '@/api/client';
import { vergleich } from '@/kern/hilfen';
import { dialog, dialogZeigen, StandardDialog } from '@/komponenten/dialoge';
import { DatumFeld } from '@/komponenten/eingaben';
import { direktLaden, druckUrl, heute, imTab, plusTage, type Auswahl } from './kern';

export async function infoStundenplan(): Promise<void> {
  const w = await dialog<string>({
    titel: 'Aushang (HTML)',
    inhalt: 'Stundenpläne aller Klassen, Lehrkräfte und Räume als HTML-Seiten mit Übersichtsseite.\nIm Browser ansehen oder als ZIP-Datei herunterladen, um sie auf einem Webserver zu veröffentlichen.',
    knoepfe: [{ text: 'Im Browser ansehen', wert: 'ansehen', primaer: true }, { text: 'ZIP herunterladen', wert: 'zip' }, { text: 'Abbrechen', wert: null }],
  });
  if (w === 'ansehen') imTab(druckUrl('/info/index.html'));
  if (w === 'zip') direktLaden(druckUrl('/infostundenplan.zip'));
}

export async function iCalendar(): Promise<void> {
  const daten = await api.get<Auswahl>(druckUrl('/auswahl'));
  const lehrer = [...daten.lehrer].sort((x, y) => vergleich(x.k, y.k));
  function Inhalt({ schliessen }: { schliessen: (w: { lehrer: string; von: string; bis: string } | null) => void }) {
    const [w, setW] = useState({ lehrer: '', von: heute(), bis: plusTage(heute(), 27) });
    return (
      <StandardDialog<boolean> titel="Kalender für Lehrkräfte (iCalendar)" breite="480px" knoepfe={[{ text: 'Herunterladen', wert: true, primaer: true }, { text: 'Abbrechen', wert: null }]}
        beiKnopf={(x) => schliessen(x ? w : null)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Lehrkraft">
            <Select value={w.lehrer} onChange={(_, d) => setW({ ...w, lehrer: d.value })}>
              <option value="">Alle Lehrkräfte (ZIP-Datei)</option>
              {lehrer.map((l) => <option key={l.id} value={l.id}>{l.l ? `${l.k} – ${l.l}` : l.k}</option>)}
            </Select>
          </Field>
          <Field label="Von"><DatumFeld size="medium" wert={w.von} beiAenderung={(datum) => setW({ ...w, von: datum })} /></Field>
          <Field label="Bis" hint="Stundenplan der Lehrkraft mit Vertretungen als .ics-Datei zum Import in Kalenderprogramme.">
            <DatumFeld size="medium" wert={w.bis} beiAenderung={(datum) => setW({ ...w, bis: datum })} />
          </Field>
        </div>
      </StandardDialog>
    );
  }
  const w = await dialogZeigen<{ lehrer: string; von: string; bis: string }>((schliessen) => <Inhalt schliessen={schliessen} />);
  if (w) direktLaden(druckUrl('/ical', { lehrer: w.lehrer || undefined, von: w.von, bis: w.bis }));
}
