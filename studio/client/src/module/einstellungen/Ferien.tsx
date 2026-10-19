// Kalender und Ferien: Ferienliste (direkt bearbeitbar), Jahresdaten, Jahreskalender mit Tages- bzw. Zeitraumauswahl,
// Unterrichtsfrei/Feiertag je Tag, Ferien und Feiertage NRW.
import { Button, Checkbox, Input } from '@fluentui/react-components';
import { useEffect, useState, type MouseEvent } from 'react';
import { api } from '@/api/client';
import { useAnsicht } from '@/kern/ansichten';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, FussText, Trenner, Werkzeug } from '@/komponenten/ansicht';
import { formular, frage } from '@/komponenten/dialoge';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { DatumFeld } from '@/komponenten/eingaben';
import { datum, de, iso, isoAusDe, kw, MONATE, pfad, TAGE_KURZ } from './kern';
import './einstellungen.css';

interface Ferien { id: number; kurzname: string; langname: string; von: string; bis: string; tage: number; wocheDanach: string; wochennummerierung: boolean; feiertag: boolean }
interface FerienDaten {
  ferien: Ferien[]; schuljahrVon: string; schuljahrBis: string; ersterSchultag: number; tageProWoche: number;
  jahresdaten: { schuljahrTage: number; schuljahrWochen: number; anzahlFerien: number; anzahlFeiertage: number; unterrichtTage: number; unterrichtWochen: number; ferientage: number };
}

function TextZelle({ wert, breite, gesperrt, setzen }: { wert: string; breite?: number; gesperrt: boolean; setzen: (v: string) => void }) {
  const [t, setT] = useState(wert ?? '');
  useEffect(() => setT(wert ?? ''), [wert]);
  return <Input size="small" style={breite ? { width: breite } : { width: '100%' }} disabled={gesperrt} value={t} onChange={(_, d) => setT(d.value)} onBlur={() => { if (t !== (wert ?? '')) setzen(t); }} />;
}

export default function FerienAnsicht() {
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const lesen = !schreiben;
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [anker, setAnker] = useState<string | null>(null);
  const [markiert, setMarkiert] = useState<Set<number>>(new Set());
  const { daten: d, setDaten, laedt } = useDaten(() => api.get<FerienDaten>(pfad('/ferien')), [], { bereiche: ['Einstellungen'], quelle: a.id });

  const senden = async (p: Promise<FerienDaten>) => { try { setDaten(await p); } catch (e) { fehlerMelden(e); } };
  const feldAendern = (fe: Ferien, feld: string, wert: string) => senden(api.patch<FerienDaten>(pfad(`/ferien/${fe.id}`), { feld, wert }, { quelle: a.id }));
  const ferienAm = (t: string) => d?.ferien.filter((x) => t >= x.von && t <= x.bis).sort((x, y) => x.tage - y.tage)[0];
  const bereich = (): [string, string] | null => {
    if (!gewaehlt) return null;
    const x = anker || gewaehlt;
    return x <= gewaehlt ? [x, gewaehlt] : [gewaehlt, x];
  };

  const neu = async () => {
    if (!d) return;
    const [v, b] = bereich() || [d.schuljahrVon, d.schuljahrVon];
    const w = await formular('Neue Ferien', [
      { name: 'kurzname', titel: 'Kurzname', wert: v === b ? `${Number(v.slice(8))}.${Number(v.slice(5, 7))}` : 'Ferien', pflicht: true },
      { name: 'langname', titel: 'Bezeichnung', wert: v === b ? de(v) : `Ferien ${de(v)} – ${de(b)}` },
      { name: 'von', titel: 'Von (TT.MM.JJJJ)', wert: de(v), pflicht: true },
      { name: 'bis', titel: 'Bis (TT.MM.JJJJ)', wert: de(b), pflicht: true },
      { name: 'feiertag', titel: 'Feiertag', art: 'bool', wert: false },
    ], { okText: 'Anlegen' });
    if (!w) return;
    await senden(api.post<FerienDaten>(pfad('/ferien'), { kurzname: w.kurzname, langname: w.langname, von: isoAusDe(w.von), bis: isoAusDe(w.bis), feiertag: w.feiertag }, { quelle: a.id }));
    setAnker(null);
    hinweis('Ferien angelegt.', 'ok', 1500);
  };
  const loeschen = async () => {
    const ids = [...markiert];
    if (!ids.length) { hinweis('Bitte zuerst Ferien in der Liste oder im Kalender wählen.', 'warnung'); return; }
    if (!(await frage(ids.length === 1 ? 'Den gewählten Ferieneintrag löschen?' : `${ids.length} Ferieneinträge löschen?`, { ja: 'Löschen', gefahr: true }))) return;
    setMarkiert(new Set());
    await senden(api.post<FerienDaten>(pfad('/ferien/loeschen'), { ids }, { quelle: a.id }));
  };
  const nrw = async () => {
    if (!(await frage('Ferien und gesetzliche Feiertage NRW für das Schuljahr eintragen? Vorhandene Einträge bleiben erhalten.'))) return;
    await senden(api.post<FerienDaten>(pfad('/ferien/nrw'), {}, { quelle: a.id }));
    hinweis('Ferien und Feiertage NRW eingetragen – Strg+Z macht es rückgängig.', 'ok');
  };

  const zeileKlick = (e: MouseEvent, fe: Ferien) => {
    if ((e.target as HTMLElement).closest('input')) return;
    setMarkiert((m) => { const n = e.ctrlKey || e.metaKey ? new Set(m) : new Set<number>(); if (n.has(fe.id) && (e.ctrlKey || e.metaKey)) n.delete(fe.id); else n.add(fe.id); return n; });
    setGewaehlt(fe.von);
    setAnker(null);
  };
  const tagKlick = (e: MouseEvent, s: string) => {
    if (e.shiftKey && gewaehlt) { setAnker(anker || gewaehlt); setGewaehlt(s); } else { setAnker(null); setGewaehlt(s); }
    const fe = ferienAm(s);
    setMarkiert(new Set(fe ? [fe.id] : []));
  };

  const kalender = (d: FerienDaten) => {
    const von = datum(d.schuljahrVon);
    const start = new Date(von.getFullYear(), von.getMonth() - 1, 1);
    const ende = datum(d.schuljahrBis);
    const [bv, bb] = bereich() || [null, null];
    const schultag = (t: string, wd: number) => t >= d.schuljahrVon && t <= d.schuljahrBis && ((wd - d.ersterSchultag + 7) % 7) < d.tageProWoche;
    const monate: JSX.Element[] = [];
    for (let m = new Date(start); m <= new Date(ende.getFullYear(), ende.getMonth() + 1, 1); m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      const wochen: JSX.Element[][] = [];
      const erster = (m.getDay() + 6) % 7;
      let woche: JSX.Element[] = [<td key="kw" className="kw">{kw(m)}</td>];
      for (let i = 0; i < erster; i++) woche.push(<td key={`l${i}`} />);
      const tage = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      for (let t = 1; t <= tage; t++) {
        const dt = new Date(m.getFullYear(), m.getMonth(), t);
        const wd = (dt.getDay() + 6) % 7;
        if (wd === 0 && t > 1) { wochen.push(woche); woche = [<td key="kw" className="kw">{kw(dt)}</td>]; }
        const s = iso(dt);
        const fe = ferienAm(s);
        const kl = ['tag', wd >= 5 ? 'we' : '', fe ? (fe.feiertag ? 'feiertag' : 'ferien') : schultag(s, wd) ? 'schultag' : '', bv && bb && s >= bv && s <= bb ? 'auswahl' : '', s === gewaehlt ? 'aktiv' : ''].filter(Boolean).join(' ');
        woche.push(<td key={s} className={kl} data-d={s} title={fe ? `${fe.langname || fe.kurzname} (${de(fe.von)} – ${de(fe.bis)})` : de(s)}
          onClick={(e) => tagKlick(e, s)} onDoubleClick={() => { if (!lesen) void neu(); }}>{t}</td>);
      }
      wochen.push(woche);
      monate.push(
        <table key={`${m.getFullYear()}-${m.getMonth()}`} className="es-monat">
          <caption>{`${MONATE[m.getMonth()]} ${m.getFullYear()}`}</caption>
          <thead><tr><th className="kw">KW</th>{TAGE_KURZ.map((t) => <th key={t}>{t}</th>)}</tr></thead>
          <tbody>{wochen.map((w, i) => <tr key={i}>{w}</tr>)}</tbody>
        </table>,
      );
    }
    return monate;
  };

  const tagesinfo = () => {
    if (!gewaehlt) return <span className="es-leise">Tag im Kalender wählen.</span>;
    const [bv, bb] = bereich()!;
    const dt = datum(gewaehlt);
    const fe = ferienAm(gewaehlt);
    const zeitraum = bv !== bb;
    const umschalten = (frei: boolean, feiertag: boolean) => senden(api.post<FerienDaten>(pfad('/ferien/tag'), { datum: gewaehlt, unterrichtsfrei: frei, feiertag }, { quelle: a.id }));
    return <>
      <b>{zeitraum ? `Zeitraum ${de(bv)} – ${de(bb)}` : `${TAGE_KURZ[(dt.getDay() + 6) % 7]} ${dt.getDate()}.${dt.getMonth() + 1}.${dt.getFullYear()}`}</b>
      <span className="es-leise">{`Kalenderwoche ${kw(dt)}`}</span>
      <Checkbox label="Unterrichtsfrei" disabled={lesen || zeitraum} checked={!!fe} onChange={(_, x) => void umschalten(!!x.checked, x.checked ? !!fe?.feiertag : false)} />
      <Checkbox label="Feiertag" disabled={lesen || zeitraum} checked={!!fe?.feiertag} onChange={(_, x) => void umschalten(!!fe || !!x.checked, !!x.checked)} />
      {fe ? <span>{fe.langname || fe.kurzname}</span> : null}
      {zeitraum && !lesen ? <Button size="small" onClick={() => void neu()}>Ferien für den Zeitraum anlegen …</Button> : null}
    </>;
  };

  return (
    <AnsichtRahmen titel="Kalender und Ferien" laden={laedt && !d}
      werkzeuge={<>
        <Werkzeug text="Neue Ferien …" deaktiviert={lesen} aktion={neu} />
        <Werkzeug text="Löschen" deaktiviert={lesen} aktion={loeschen} />
        <Trenner />
        <Werkzeug text="Ferien und Feiertage NRW eintragen …" deaktiviert={lesen} aktion={nrw} />
      </>}
      fuss={<>
        <span className="es-legende"><i className="schultag" />Schultag<i className="ferien" />Ferien<i className="feiertag" />Feiertag<i className="auswahl" />Auswahl</span>
        <FussText rechts>Umschalt+Klick wählt einen Zeitraum, Doppelklick legt Ferien an.</FussText>
      </>}>
      {d ? (
        <div className="es-ferien">
          <div className="es-ferien-links">
            <div className="es-ferienliste">
              <table className="es-liste">
                <thead><tr>
                  <th>Kurzname</th><th>Bezeichnung</th><th>Von</th><th>Bis</th><th className="zahl">Tage</th>
                  <th title="Wochenbuchstabe der ersten Woche nach den Ferien">Woche danach</th><th className="mitte" title="Wochen während der Ferien mitzählen">Wochen zählen</th><th className="mitte">Feiertag</th>
                </tr></thead>
                <tbody>
                  {d.ferien.map((fe) => (
                    <tr key={fe.id} className={`klickbar${markiert.has(fe.id) ? ' gewaehlt' : ''}`} onClick={(e) => zeileKlick(e, fe)}>
                      <td><TextZelle wert={fe.kurzname} breite={80} gesperrt={lesen} setzen={(v) => void feldAendern(fe, 'kurzname', v)} /></td>
                      <td><TextZelle wert={fe.langname} gesperrt={lesen} setzen={(v) => void feldAendern(fe, 'langname', v)} /></td>
                      <td><DatumFeld size="small" disabled={lesen} wert={fe.von} beiAenderung={(datum) => { if (datum) void feldAendern(fe, 'von', datum); }} /></td>
                      <td><DatumFeld size="small" disabled={lesen} wert={fe.bis} beiAenderung={(datum) => { if (datum) void feldAendern(fe, 'bis', datum); }} /></td>
                      <td className="zahl">{fe.tage}</td>
                      <td><TextZelle wert={fe.wocheDanach} breite={50} gesperrt={lesen} setzen={(v) => void feldAendern(fe, 'wocheDanach', v)} /></td>
                      <td className="mitte"><Checkbox aria-label="Wochen zählen" disabled={lesen} checked={fe.wochennummerierung} onChange={(_, x) => void feldAendern(fe, 'wochennummerierung', x.checked ? 'X' : '')} /></td>
                      <td className="mitte"><Checkbox aria-label="Feiertag" disabled={lesen} checked={fe.feiertag} onChange={(_, x) => void feldAendern(fe, 'feiertag', x.checked ? 'X' : '')} /></td>
                    </tr>
                  ))}
                  {!d.ferien.length ? <tr><td colSpan={8} className="es-leer">Noch keine Ferien eingetragen.</td></tr> : null}
                </tbody>
              </table>
            </div>
            <div className="es-jahresdaten">
              <dl>
                <dt>Schuljahr</dt><dd>{`${de(d.schuljahrVon)} – ${de(d.schuljahrBis)}`}</dd>
                <dt>Kalendertage</dt><dd>{d.jahresdaten.schuljahrTage}</dd>
                <dt>Wochen</dt><dd>{d.jahresdaten.schuljahrWochen}</dd>
                <dt>Ferienabschnitte</dt><dd>{d.jahresdaten.anzahlFerien}</dd>
                <dt>Feiertage</dt><dd>{d.jahresdaten.anzahlFeiertage}</dd>
                <dt>Unterrichtstage</dt><dd>{d.jahresdaten.unterrichtTage}</dd>
                <dt>Unterrichtswochen</dt><dd>{d.jahresdaten.unterrichtWochen}</dd>
                <dt>Ferientage</dt><dd>{d.jahresdaten.ferientage}</dd>
              </dl>
            </div>
          </div>
          <div className="es-ferien-rechts">
            <div className="es-tag">{tagesinfo()}</div>
            <div className="es-kalender">{kalender(d)}</div>
          </div>
        </div>
      ) : null}
    </AnsichtRahmen>
  );
}
