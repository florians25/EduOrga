// Perioden: Baum der Perioden (Tochterperioden), aktive Periode, Fixierung, Unterrichtsänderungen in Folgeperioden.
import { Badge, Button, Checkbox, Input } from '@fluentui/react-components';
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { useAnsicht } from '@/kern/ansichten';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen } from '@/komponenten/ansicht';
import { formular, frage } from '@/komponenten/dialoge';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { DatumFeld } from '@/komponenten/eingaben';
import { de, isoAusDe, pfad } from './kern';
import './einstellungen.css';

interface Periode { id: number; name: string; langname: string; von: string; bis?: string | null; ende: string; schultage: number; mutter?: string; ebene: number; aktiv: boolean; fixiert: boolean; unterrichte: number; planstunden: number }
interface PeriodenDaten { perioden: Periode[]; aktiv: number; unterrichtInFolgeperioden: boolean }

function Bearbeiten({ p, lesen, anzahl, senden, neu, loeschen }: { p: Periode; lesen: boolean; anzahl: number; senden: (pr: Promise<PeriodenDaten>, text?: string) => Promise<void>; neu: (p: Periode) => void; loeschen: (p: Periode) => void }) {
  const a = useAnsicht();
  const [w, setW] = useState({ name: p.name, langname: p.langname, von: p.von, bis: p.bis || '', fixiert: p.fixiert });
  useEffect(() => setW({ name: p.name, langname: p.langname, von: p.von, bis: p.bis || '', fixiert: p.fixiert }), [p]);
  return (
    <div className="es-seite">
      <h3>{/^periode/i.test(p.name) ? p.name : `Periode ${p.name}`}</h3>
      <p className="es-leise">{`${p.unterrichte} Unterrichte, ${p.planstunden} verplante Stunden, ${p.schultage} Schultage`}</p>
      <div className="es-formular" style={{ gridTemplateColumns: '120px minmax(0, 320px)' }}>
        <label>Name</label><Input size="small" disabled={lesen} value={w.name} onChange={(_, d) => setW({ ...w, name: d.value })} />
        <label>Bezeichnung</label><Input size="small" disabled={lesen} value={w.langname} onChange={(_, d) => setW({ ...w, langname: d.value })} />
        <label>Von</label><DatumFeld size="small" disabled={lesen} wert={w.von} beiAenderung={(datum) => setW({ ...w, von: datum })} />
        <label>Bis</label><DatumFeld size="small" disabled={lesen} wert={w.bis} beiAenderung={(datum) => setW({ ...w, bis: datum })} />
        <p className="es-hinweis">{`Leer bedeutet bis ${de(p.ende)}.`}</p>
        <span /><Checkbox label="Fixiert" disabled={lesen} checked={w.fixiert} onChange={(_, d) => setW({ ...w, fixiert: !!d.checked })} />
        <p className="es-hinweis">Unterricht und Stundenplan sind dann gegen Änderungen gesperrt.</p>
      </div>
      <div className="es-knoepfe">
        <Button size="small" appearance="primary" disabled={lesen} onClick={() => void senden(api.put<PeriodenDaten>(pfad(`/perioden/${p.id}`), { ...w, bis: w.bis || null }, { quelle: a.id }), 'Periode geändert.')}>Übernehmen</Button>
        <Button size="small" disabled={lesen || p.aktiv} onClick={() => void senden(api.post<PeriodenDaten>(pfad(`/perioden/${p.id}/aktiv`), {}, { quelle: a.id }), `${p.name} ist jetzt die aktive Periode.`)}>Als aktive Periode setzen</Button>
        <Button size="small" disabled={lesen} onClick={() => neu(p)}>Untergeordnete Periode …</Button>
        <Button size="small" disabled={lesen || anzahl <= 1} onClick={() => loeschen(p)}>Löschen</Button>
      </div>
    </div>
  );
}

export default function Perioden() {
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const lesen = !schreiben;
  const [gewaehlt, setGewaehlt] = useState<number | null>(null);
  const { daten: d, setDaten, laedt } = useDaten(() => api.get<PeriodenDaten>(pfad('/perioden')), [], { bereiche: ['Einstellungen'], quelle: a.id });
  const senden = async (pr: Promise<PeriodenDaten>, text?: string) => {
    try { const n = await pr; setDaten(n); if (text) hinweis(text, 'ok', 2000); } catch (e) { fehlerMelden(e); }
  };
  const id = d?.perioden.some((x) => x.id === gewaehlt) ? gewaehlt : d?.aktiv ?? null;
  const p = d?.perioden.find((x) => x.id === id);

  const neu = async (mutter: Periode) => {
    if (!d) return;
    const w = await formular(`Neue Periode unter ${mutter.name}`, [
      { name: 'name', titel: 'Name', wert: `Periode${d.perioden.length + 1}`, pflicht: true },
      { name: 'von', titel: 'Von (TT.MM.JJJJ)', wert: de(mutter.von), pflicht: true },
      { name: 'bis', titel: 'Bis (leer = offen)', wert: '' },
    ], { okText: 'Anlegen' });
    if (!w) return;
    try {
      const n = await api.post<PeriodenDaten>(pfad('/perioden'), { mutterId: mutter.id, name: w.name, von: isoAusDe(w.von), bis: isoAusDe(w.bis, true) }, { quelle: a.id });
      setDaten(n);
      hinweis('Periode angelegt.', 'ok', 2000);
      const neue = n.perioden.find((x) => x.name === String(w.name).trim());
      if (neue) setGewaehlt(neue.id);
    } catch (e) { fehlerMelden(e); }
  };
  const loeschen = async (x: Periode) => {
    if (!(await frage(`Periode ${x.name} mit Unterricht und Stundenplan löschen? Untergeordnete Perioden gehören danach zur nächsthöheren Periode.`, { gefahr: true, ja: 'Löschen' }))) return;
    await senden(api.loeschen<PeriodenDaten>(pfad(`/perioden/${x.id}`), { quelle: a.id }), 'Periode gelöscht.');
  };

  return (
    <AnsichtRahmen titel="Perioden" laden={laedt && !d}>
      {d ? (
        <div className="es-perioden">
          <div className="es-perioden-liste">
            <table className="es-liste">
              <thead><tr><th>Name</th><th>Bezeichnung</th><th>Von</th><th>Bis</th><th className="zahl">Schultage</th><th>Übergeordnet</th><th>Status</th></tr></thead>
              <tbody>
                {d.perioden.map((x) => (
                  <tr key={x.id} className={`klickbar${x.id === id ? ' gewaehlt' : ''}`} tabIndex={0} onClick={() => setGewaehlt(x.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setGewaehlt(x.id); } }}>
                    <td style={{ paddingLeft: 8 + x.ebene * 16 }}>{x.aktiv ? <b>{x.name}</b> : x.name}</td>
                    <td>{x.langname}</td><td>{de(x.von)}</td><td>{x.bis ? de(x.bis) : <span className="es-leise">{de(x.ende)}</span>}</td>
                    <td className="zahl">{x.schultage}</td><td>{x.mutter || ''}</td>
                    <td>{x.aktiv ? <Badge appearance="tint" color="brand">Aktiv</Badge> : null} {x.fixiert ? <Badge appearance="outline" color="informative">Fixiert</Badge> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="es-unter">
              <Checkbox label="Unterrichtsänderungen in Folgeperioden übernehmen" disabled={lesen} checked={d.unterrichtInFolgeperioden}
                onChange={(_, x) => void senden(api.put<PeriodenDaten>(pfad('/perioden/folgeperioden'), { wert: !!x.checked }, { quelle: a.id }))} />
              <p className="es-leise">Eine untergeordnete Periode übernimmt Unterricht, Stundenplan und Pausenaufsichten der übergeordneten. An jedem Tag gilt die zuletzt beginnende Periode. Die aktive Periode wird in allen Ansichten bearbeitet.</p>
            </div>
          </div>
          {p ? <Bearbeiten p={p} lesen={lesen} anzahl={d.perioden.length} senden={senden} neu={(x) => void neu(x)} loeschen={(x) => void loeschen(x)} /> : null}
        </div>
      ) : null}
    </AnsichtRahmen>
  );
}
