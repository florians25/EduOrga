// Vertretung der Pausenaufsichten eines Tages (Vertretungsmodus): abwesende Aufsichten, Auswahl der Vertretung.
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { useAnsicht } from '@/kern/ansichten';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, Feld, FussText, Leer, Rechts, Werkzeug } from '@/komponenten/ansicht';
import { fehlerMelden } from '@/komponenten/hinweise';
import { DatumFeld } from '@/komponenten/eingaben';
import { isoAus, usePlanungsdatum } from '../vertretung/kern';
import './pausenaufsicht.css';
import { SuchAuswahl } from '@/komponenten/suchauswahl';

interface Kandidat { id: number; kurz: string; zaehler: number; aufsichten: number }
interface PvZeile { id: number; pause: string; gang: string; lehrer: string; vertreterId?: number | null; vertreter?: string; text: string; offen: boolean; kandidaten: Kandidat[] }
interface PvDaten { datumText: string; unterrichtstag: boolean; zeilen: PvZeile[] }

export default function AufsichtVertretung() {
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const planungsdatum = usePlanungsdatum();
  const [datum, setDatum] = useState(() => (a.p.datum as string) || planungsdatum || isoAus(new Date()));
  useEffect(() => { if (planungsdatum) setDatum(planungsdatum); }, [planungsdatum]);
  const { daten, setDaten, laedt, neuLaden } = useDaten(() => api.get<PvDaten>(api.dok(`/pausenaufsicht/vertretung/${datum}`)), [datum], { bereiche: ['Vertretung', 'Stundenplan'], quelle: a.id });

  const waehlen = async (z: PvZeile, wert: string) => {
    try { setDaten(await api.post<PvDaten>(api.dok(`/pausenaufsicht/vertretung/${datum}`), { vertretung: z.id, lehrer: wert ? Number(wert) : null }, { quelle: a.id })); }
    catch (e) { fehlerMelden(e); await neuLaden(true); }
  };

  return (
    <AnsichtRahmen titel="Vertretung der Pausenaufsichten" laden={laedt && !daten}
      werkzeuge={<>
        <Feld titel="Datum"><DatumFeld size="small" wert={datum} beiAenderung={(datum) => { if (datum) setDatum(datum); }} /></Feld>
        <Rechts><Werkzeug text="Wochenplan" titel="Wöchentliche Pausenaufsichten" aktion={() => a.oeffnen('pausenaufsicht')} /></Rechts>
      </>}
      fuss={daten ? <>
        <span>{daten.datumText}</span><span>{`${daten.zeilen.length} zu vertreten`}</span><span>{`${daten.zeilen.filter((z) => z.offen).length} offen`}</span>
        {!daten.unterrichtstag ? <FussText rechts>kein Unterrichtstag</FussText> : null}
      </> : null}>
      {daten && !daten.zeilen.length ? <Leer text="An diesem Tag ist keine Pausenaufsicht zu vertreten." /> : daten ? (
        <div className="pa-vertretung">
          <table className="pa-tabelle pa-voll">
            <thead><tr>{['Pause', 'Aufsichtsbereich', 'Abwesend', 'Vertretung', 'Text', 'Weitere Lehrkräfte (Zähler, Aufsichten)'].map((x) => <th key={x}>{x}</th>)}</tr></thead>
            <tbody>
              {daten.zeilen.map((z) => (
                <tr key={z.id} className={z.offen ? 'pa-offen' : undefined}>
                  <td>{z.pause}</td><td>{z.gang}</td><td>{z.lehrer}</td>
                  <td>
                    <SuchAuswahl size="small" breite={220} disabled={!schreiben} ariaLabel={`Vertretung ${z.pause} ${z.gang}`} wert={z.vertreterId ? String(z.vertreterId) : ''}
                      beiWahl={(w) => void waehlen(z, w)} platzhalter={z.offen ? 'Offen' : undefined}
                      optionen={[
                        { wert: '', text: z.offen ? 'Offen' : 'Vertretung aufheben' },
                        ...(z.vertreterId && !z.kandidaten.some((k) => k.id === z.vertreterId) ? [{ wert: String(z.vertreterId), text: z.vertreter || String(z.vertreterId) }] : []),
                        ...z.kandidaten.map((k) => ({ wert: String(k.id), kurz: k.kurz, text: `${k.kurz} (${k.zaehler}, ${k.aufsichten})` })),
                      ]} />
                  </td>
                  <td>{z.text}</td>
                  <td className="pa-leise">{z.kandidaten.slice(0, 6).map((k) => k.kurz).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </AnsichtRahmen>
  );
}
