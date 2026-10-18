// Unterrichtsgruppen: Unterricht in einzelnen Wochen (Mehrwochenpläne) oder Zeiträumen, mit Unterbrechungen; neue Gruppe in
// der letzten Zeile.
import { Button, Checkbox, Input } from '@fluentui/react-components';
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { useAnsicht } from '@/kern/ansichten';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, Werkzeug } from '@/komponenten/ansicht';
import { formular, frage } from '@/komponenten/dialoge';
import { fehlerMelden } from '@/komponenten/hinweise';
import { pfad } from './kern';
import './einstellungen.css';

interface Gruppe { id: number; kurzname: string; langname: string; von?: string | null; bis?: string | null; wochen?: string | null; fix: boolean; ignorieren: boolean; unterbrechungen: string; faktor?: number | string; unterrichte?: number }
interface UgDaten { gruppen: Gruppe[]; wochen: string[]; wochenperiodizitaet: number }
type Werte = { kurzname: string; langname: string; von: string; bis: string; wochen: Set<string>; fix: boolean; ignorieren: boolean; unterbrechungen: string };

function werteVon(g: Gruppe | null, wochen: string[]): Werte {
  return {
    kurzname: g?.kurzname ?? '', langname: g?.langname ?? '', von: g?.von ?? '', bis: g?.bis ?? '',
    wochen: new Set(wochen.filter((w) => !g || !g.wochen || g.wochen.includes(w))), fix: !!g?.fix, ignorieren: !!g?.ignorieren, unterbrechungen: g?.unterbrechungen ?? '',
  };
}

function Zeile({ g, d, lesen, speichern, loeschen }: { g: Gruppe | null; d: UgDaten; lesen: boolean; speichern: (g: Gruppe | null, w: Record<string, unknown>) => Promise<void>; loeschen: (g: Gruppe) => void }) {
  const [w, setW] = useState(() => werteVon(g, d.wochen));
  useEffect(() => setW(werteVon(g, d.wochen)), [g, d.wochen]);
  const senden = (n: Werte) => {
    if (!g && !n.kurzname.trim()) return;
    void speichern(g, { kurzname: n.kurzname, langname: n.langname, von: n.von || null, bis: n.bis || null, wochen: d.wochen.filter((x) => n.wochen.has(x)).join(''), fix: n.fix, ignorieren: n.ignorieren, unterbrechungen: n.unterbrechungen });
    if (!g) setW(werteVon(null, d.wochen));
  };
  const sofort = (teil: Partial<Werte>) => { const n = { ...w, ...teil }; setW(n); senden(n); };
  const text = (k: 'kurzname' | 'langname' | 'unterbrechungen', breite?: number, platzhalter?: string) => (
    <Input size="small" style={breite ? { width: breite } : { width: '100%' }} disabled={lesen} placeholder={platzhalter} aria-label={k} value={w[k]}
      onChange={(_, x) => setW({ ...w, [k]: x.value })} onBlur={() => { if (g ? w[k] !== (g[k] ?? '') : k === 'kurzname' && w.kurzname.trim()) senden(w); }} />
  );
  return (
    <tr>
      <td>{text('kurzname', 90, g ? undefined : 'Neue Gruppe')}</td>
      <td>{text('langname')}</td>
      <td><Input size="small" type="date" style={{ width: 140 }} disabled={lesen} value={w.von} onChange={(_, x) => sofort({ von: x.value })} /></td>
      <td><Input size="small" type="date" style={{ width: 140 }} disabled={lesen} value={w.bis} onChange={(_, x) => sofort({ bis: x.value })} /></td>
      {d.wochen.map((wo) => (
        <td key={wo} className="mitte"><Checkbox aria-label={`Woche ${wo}`} disabled={lesen} checked={w.wochen.has(wo)} onChange={(_, x) => { const s = new Set(w.wochen); if (x.checked) s.add(wo); else s.delete(wo); sofort({ wochen: s }); }} /></td>
      ))}
      <td className="zahl">{g?.faktor ?? ''}</td>
      <td className="mitte"><Checkbox aria-label="Fixiert" disabled={lesen} checked={w.fix} onChange={(_, x) => sofort({ fix: !!x.checked })} /></td>
      <td className="mitte"><Checkbox aria-label="Ignorieren" disabled={lesen} checked={w.ignorieren} onChange={(_, x) => sofort({ ignorieren: !!x.checked })} /></td>
      <td>{text('unterbrechungen', undefined, 'z. B. 01.12.-15.12.; 10.03.-20.03.')}</td>
      <td className="zahl">{g?.unterrichte ?? ''}</td>
      <td className="aktion">{g ? <Button size="small" appearance="subtle" disabled={lesen} onClick={() => loeschen(g)}>Löschen</Button> : null}</td>
    </tr>
  );
}

export default function Unterrichtsgruppen() {
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const lesen = !schreiben;
  const { daten: d, setDaten, laedt, neuLaden } = useDaten(() => api.get<UgDaten>(pfad('/ugruppen')), [], { bereiche: ['Unterricht', 'Einstellungen'], quelle: a.id });
  const senden = async (pr: Promise<UgDaten>) => { try { setDaten(await pr); } catch (e) { fehlerMelden(e); await neuLaden(true); } };
  const speichern = (g: Gruppe | null, w: Record<string, unknown>) =>
    senden(g ? api.put<UgDaten>(pfad(`/ugruppen/${g.id}`), w, { quelle: a.id }) : api.post<UgDaten>(pfad('/ugruppen'), w, { quelle: a.id }));
  const loeschen = async (g: Gruppe) => {
    if (!(await frage(`Unterrichtsgruppe ${g.kurzname} löschen? Zugeordneter Unterricht findet danach jede Woche statt.`, { ja: 'Löschen', gefahr: true }))) return;
    await senden(api.post<UgDaten>(pfad('/ugruppen/loeschen'), { ids: [g.id] }, { quelle: a.id }));
  };
  const periodizitaet = async () => {
    if (!d) return;
    const w = await formular('Wochenperiodizität', [{ name: 'wert', titel: 'Anzahl Wochen', art: 'zahl', wert: d.wochenperiodizitaet, pflicht: true, hinweis: '1 = jede Woche gleich, 2 = A/B-Wochen, höchstens 16' }]);
    if (w) await senden(api.put<UgDaten>(pfad('/wochenperiodizitaet'), { wert: Number(w.wert) }, { quelle: a.id }));
  };

  return (
    <AnsichtRahmen titel="Unterrichtsgruppen" laden={laedt && !d} werkzeuge={<Werkzeug text="Wochenperiodizität …" deaktiviert={lesen} aktion={periodizitaet} />}>
      {d ? (
        <div className="es-seite">
          <table className="es-liste">
            <thead><tr>
              <th>Kurzname</th><th>Bezeichnung</th><th>Von</th><th>Bis</th>
              {d.wochen.map((w) => <th key={w} className="mitte">{`Woche ${w}`}</th>)}
              <th className="zahl" title="Anteil der Schultage, an denen die Gruppe gilt">Faktor</th><th className="mitte">Fixiert</th>
              <th className="mitte" title="Gruppe bei der Planung nicht berücksichtigen">Ignorieren</th><th>Unterbrechungen</th><th className="zahl">Unterrichte</th><th />
            </tr></thead>
            <tbody>
              {d.gruppen.map((g) => <Zeile key={g.id} g={g} d={d} lesen={lesen} speichern={speichern} loeschen={(x) => void loeschen(x)} />)}
              {!lesen ? <Zeile g={null} d={d} lesen={lesen} speichern={speichern} loeschen={() => {}} /> : null}
              {lesen && !d.gruppen.length ? <tr><td colSpan={10 + d.wochen.length} className="es-leer">Keine Unterrichtsgruppen angelegt.</td></tr> : null}
            </tbody>
          </table>
          <p className="es-leise">{`Wochenperiodizität ${d.wochenperiodizitaet} (${d.wochen.join(', ')}). Eine neue Gruppe tragen Sie in der letzten Zeile ein; Unterricht ordnen Sie in der Unterrichtsansicht einer Gruppe zu.`}</p>
        </div>
      ) : null}
    </AnsichtRahmen>
  );
}
