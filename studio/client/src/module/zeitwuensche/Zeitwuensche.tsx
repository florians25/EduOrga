// Zeitwünsche (+3 unbedingt Unterricht … −3 unbedingt frei): Wert wählen und Stunden mit gedrückter Maustaste (oder dem
// Finger) überstreichen; „Ganzer Tag“/„Vormittag“/„Nachmittag“ setzen den ganzen (Halb-)Tag. Darunter die Zeitwünsche ohne
// feste Lage (z. B. „1 Tag unbedingt frei“). Tasten 3, 2, 1, 0 und Umschalt+1–3 wählen den Wert.
import { Button, Input, Select, Tooltip, makeStyles, tokens } from '@fluentui/react-components';
import { ChevronLeft20Regular, ChevronRight20Regular, Dismiss16Regular } from '@fluentui/react-icons';
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type KeyboardEvent } from 'react';
import { api } from '@/api/client';
import { useAnsicht, type AnsichtProps } from '@/kern/ansichten';
import { melden, useEreignis, betrifft } from '@/kern/ereignisse';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben, useStudio } from '@/kern/zustand';
import { AnsichtRahmen, Feld, FussText, Rechts, Schalter, Trenner, Werkzeug } from '@/komponenten/ansicht';
import { frage } from '@/komponenten/dialoge';
import { fehlerMelden } from '@/komponenten/hinweise';
import { MenueKnopf } from '@/komponenten/menue';
import './zeitwuensche.css';

export const TYPEN: Record<string, string> = { klasse: 'Klasse', lehrer: 'Lehrkraft', raum: 'Raum', fach: 'Fach', unterricht: 'Unterricht' };
const WERTE = [3, 2, 1, 0, -1, -2, -3];
const TEXT: Record<string, string> = {
  3: '+3 unbedingt Unterricht (Kernzeit)', 2: '+2 möglichst Unterricht', 1: '+1 eher Unterricht', 0: '0 kein Wunsch',
  '-1': '−1 eher frei', '-2': '−2 möglichst frei', '-3': '−3 unbedingt frei (gesperrt)',
};
const UNBESTIMMT: [number, string][] = [[-3, 'Unbedingt frei (−3)'], [-2, 'Möglichst frei (−2)'], [-1, 'Eher frei (−1)']];
const BEREICHE: [string, string][] = [['Tage', 'Ganze Tage'], ['Vormittage', 'Vormittage'], ['Nachmittage', 'Nachmittage']];
const zeichen = (w: number) => (w > 0 ? `+${w}` : w < 0 ? `−${-w}` : '0');

interface Eintrag { id: number; k: string; l: string; n?: number; f?: number }
interface ZwDaten {
  element: { kurz: string; lang: string }; tage: { nr: number; lang: string }[]; stunden: { nr: number; label: string; vormittag: boolean }[];
  werte: number[][]; verfuegbar: boolean[][]; anzahl: number; unbestimmte?: { bereich: string; anzahl: number; wunsch: number }[] | null;
}

const useStile = makeStyles({
  werte: { display: 'inline-flex', gap: '2px' },
  unbestimmt: { marginTop: '20px', maxWidth: '640px' },
  kopf: { display: 'flex', alignItems: 'center', gap: '12px' },
  h3: { margin: 0, fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold },
  tab: { borderCollapse: 'collapse', marginTop: '8px' },
  td: { padding: '2px 6px' },
  th: { textAlign: 'left', fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2, fontWeight: tokens.fontWeightMedium, padding: '2px 6px' },
  leer: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
});

export default function Zeitwuensche({ p }: AnsichtProps) {
  const s = useStile();
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const grunddaten = useStudio((x) => x.grunddaten);
  const typ = TYPEN[String(p.typ)] ? String(p.typ) : 'lehrer';
  const [wert, setWert] = useState<number>(typeof p.wert === 'number' ? p.wert : -3);
  const verknuepft = p.verknuepft !== false;
  const { daten: liste, setDaten: setListe } = useDaten(() => api.get<Eintrag[]>(api.dok(`/zeitwuensche/${typ}`)), [typ], { bereiche: ['Stammdaten', 'Unterricht', 'Einstellungen'], quelle: a.id });
  const element = liste ? (liste.some((e) => e.id === Number(p.element)) ? Number(p.element) : liste[0]?.id ?? null) : null;
  const { daten, setDaten, laedt, neuLaden } = useDaten(() => api.get<ZwDaten>(api.dok(`/zeitwuensche/${typ}/${element}`)), [typ, element, grunddaten],
    { bereiche: ['Stammdaten', 'Unterricht', 'Einstellungen'], quelle: a.id, aktiv: element != null });
  const [gemalt, setGemalt] = useState<Map<string, number> | null>(null);
  const malen = useRef<Map<string, number> | null>(null);

  useEffect(() => { if (element != null && p.element !== element) a.parameterSetzen({ element }); }, [element]); // eslint-disable-line react-hooks/exhaustive-deps
  useEreignis('element', (e) => { if (verknuepft && e.quelle !== a.id && TYPEN[e.typ] && (e.typ !== typ || e.id !== element)) a.parameterSetzen({ typ: e.typ, element: e.id }); });
  useEreignis('daten', (e) => { if (e.quelle !== a.id && betrifft(e, 'Stammdaten')) void neuLaden(true); });

  const wertWaehlen = (w: number) => { setWert(w); a.parameterSetzen({ wert: w }); };
  const setzen = (t: string, id: number | null) => {
    a.parameterSetzen({ typ: t, element: id ?? undefined });
    if (id != null && t !== 'unterricht') melden('element', { typ: t, id, quelle: a.id });
  };
  const blaettern = (d: number) => {
    if (!liste) return;
    const i = liste.findIndex((e) => e.id === element);
    const n = liste[Math.max(0, Math.min(liste.length - 1, i + d))];
    if (n && n.id !== element) setzen(typ, n.id);
  };
  async function speichern(aenderung: object) {
    const d = await api.put<ZwDaten>(api.dok(`/zeitwuensche/${typ}/${element}`), aenderung, { quelle: a.id });
    setDaten(d);
    setListe((l) => l?.map((e) => (e.id === element ? { ...e, n: d.anzahl } : e)));
  }
  async function unbestimmteSpeichern(zeilen: NonNullable<ZwDaten['unbestimmte']>) {
    try {
      setDaten(await api.put<ZwDaten>(api.dok(`/zeitwuensche/${typ}/${element}/unbestimmte`), { liste: zeilen.map(({ bereich, anzahl, wunsch }) => ({ bereich, anzahl, wunsch })) }, { quelle: a.id }));
    } catch (e) { fehlerMelden(e); void neuLaden(true); }
  }

  // ---- Malen ----
  const stundenVon = (spalte: number) => {
    const st = daten!.stunden, n = st.length;
    if (spalte < n) return [st[spalte]!.nr];
    if (spalte === n) return st.map((x) => x.nr);
    if (spalte === n + 1) return st.filter((x) => x.vormittag).map((x) => x.nr);
    return st.filter((x) => !x.vormittag).map((x) => x.nr);
  };
  const auf = (el: Element | null) => {
    const td = el?.closest?.('td[data-tag]') as HTMLElement | null;
    if (!malen.current || !td) return;
    const t = Number(td.dataset.tag);
    for (const st of stundenVon(Number(td.dataset.spalte))) malen.current.set(`${t}:${st}`, wert);
    setGemalt(new Map(malen.current));
  };
  const runter = (e: RPointerEvent<HTMLTableElement>) => {
    if (!schreiben || e.button !== 0 || !(e.target as HTMLElement).closest('td[data-tag]')) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    malen.current = new Map();
    auf(e.target as Element);
  };
  const ende = () => {
    const m = malen.current;
    malen.current = null;
    if (!m || !daten) { setGemalt(null); return; }
    const aenderungen = [...m].map(([k, w]) => { const [tag, stunde] = k.split(':').map(Number) as [number, number]; return { tag, stunde, wert: w }; })
      .filter((x) => daten.werte[x.tag]?.[x.stunde - 1] !== x.wert);
    if (aenderungen.length) speichern({ aenderungen }).catch((e) => { fehlerMelden(e); void neuLaden(true); }).finally(() => setGemalt(null));
    else setGemalt(null);
  };
  const taste = (e: KeyboardEvent) => {
    const m = /^(?:Digit|Numpad)([0-3])$/.exec(e.code || '');
    if (!m || !schreiben || e.ctrlKey || e.metaKey || e.altKey) return;
    const n = Number(m[1]);
    wertWaehlen(e.shiftKey && n ? -n : n);
    e.preventDefault();
  };

  const optionText = (e: Eintrag) => `${typ === 'unterricht' ? `${e.k} ${e.l}` : e.l ? `${e.k} – ${e.l}` : e.k}${e.n || e.f ? ' · mit Zeitwünschen' : ''}`;
  const d = daten;
  const ersteNm = d ? d.stunden.findIndex((x) => !x.vormittag) : -1;
  return (
    <AnsichtRahmen titel={`Zeitwünsche – ${TYPEN[typ]}${d ? ` ${d.element.kurz}` : ''}`} laden={laedt && !d}
      werkzeuge={<>
        <Feld>
          <Select size="small" value={typ} aria-label="Art" onChange={(_, x) => setzen(x.value, null)}>{Object.entries(TYPEN).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</Select>
          <Tooltip content="Vorheriges Element (Bild auf)" relationship="label"><Button size="small" appearance="subtle" icon={<ChevronLeft20Regular />} onClick={() => blaettern(-1)} /></Tooltip>
          <Select size="small" style={{ minWidth: 200 }} aria-label="Element" value={element != null ? String(element) : ''} onChange={(_, x) => setzen(typ, Number(x.value))}
            onKeyDown={(e) => { if (e.key === 'PageUp' || e.key === 'PageDown') { e.preventDefault(); blaettern(e.key === 'PageUp' ? -1 : 1); } }}>
            {(liste || []).map((e) => <option key={e.id} value={e.id}>{optionText(e)}</option>)}
          </Select>
          <Tooltip content="Nächstes Element (Bild ab)" relationship="label"><Button size="small" appearance="subtle" icon={<ChevronRight20Regular />} onClick={() => blaettern(1)} /></Tooltip>
        </Feld>
        <Trenner />
        <Feld titel="Wert">
          <span className={s.werte} role="radiogroup" aria-label="Wert zum Eintragen">
            {WERTE.map((w) => (
              <Tooltip key={w} content={TEXT[String(w)]!} relationship="label">
                <Button size="small" role="radio" aria-checked={w === wert} disabled={!schreiben} className={`zw-wertknopf zw-w${w}`} onClick={() => wertWaehlen(w)}>{zeichen(w)}</Button>
              </Tooltip>
            ))}
          </span>
        </Feld>
        <Trenner />
        <Werkzeug text="Stundenplan" titel="Stundenplan des Elements" aktion={() => { if (typ !== 'unterricht' && element) a.oeffnen('stundenplan', { typ, element }); }} />
        <MenueKnopf text="Weitere Aktionen" eintraege={() => [
          { text: 'Alle Zeitwünsche des Elements löschen …', deaktiviert: !schreiben || !d?.anzahl, aktion: async () => {
            if (!d?.anzahl || !(await frage(`Alle Zeitwünsche von ${d.element.kurz} löschen?`, { ja: 'Löschen', gefahr: true }))) return;
            await speichern({ alleLoeschen: true });
          } },
        ]} />
        <Rechts><Schalter text="Auswahl folgen" an={verknuepft} beiAenderung={(x) => a.parameterSetzen({ verknuepft: x })} titel="Zeigt das Element, das in einer anderen Ansicht gewählt wird" /></Rechts>
      </>}
      fuss={d ? <><span>{d.anzahl} Stunden mit Zeitwunsch</span><FussText rechts>{`Gewählter Wert: ${TEXT[String(wert)]}`}</FussText></> : null}>
      <div className="zw-flaeche" tabIndex={0} onKeyDown={taste}>
        {!d ? (liste && !liste.length ? <div className={s.leer}>Für diese Art sind keine Elemente vorhanden.</div> : null) : <>
          <div className="zw-name"><h3>{`${TYPEN[typ]} ${d.element.kurz}`}</h3>{d.element.lang ? <span>{d.element.lang}</span> : null}</div>
          <table className="zw-tabelle" onPointerDown={runter} onPointerMove={(e) => { if (malen.current) auf(document.elementFromPoint(e.clientX, e.clientY)); }} onPointerUp={ende} onPointerCancel={ende}>
            <thead><tr>
              <th />
              {d.stunden.map((x, j) => <th key={x.nr} className={x.vormittag ? 'zw-vm' : 'zw-nm'} title={x.vormittag ? 'Vormittag' : 'Nachmittag'} style={j === ersteNm ? { borderLeft: '2px solid var(--colorNeutralStroke1)' } : undefined}>{x.label}</th>)}
              {['Ganzer Tag', 'Vormittag', 'Nachmittag'].map((t, i) => <th key={t} className={i === 0 ? 'zw-grenze-ganz' : undefined}>{t}</th>)}
            </tr></thead>
            <tbody>
              {d.tage.map((t) => (
                <tr key={t.nr}>
                  <th className="zw-tag">{t.lang}</th>
                  {d.stunden.map((x, j) => {
                    const w = gemalt?.get(`${t.nr}:${x.nr}`) ?? d.werte[t.nr]?.[x.nr - 1] ?? 0;
                    return <td key={x.nr} data-tag={t.nr} data-spalte={j} data-grenze={j === ersteNm ? '1' : undefined} title={`${t.lang}, ${x.label}. Stunde`}
                      className={`zw-w${w}${d.verfuegbar[t.nr]?.[x.nr - 1] ? '' : ' zw-aus'}`}>{w === 0 ? '' : zeichen(w)}</td>;
                  })}
                  {['Ganzen Tag', 'Vormittag', 'Nachmittag'].map((x, i) => <td key={x} data-tag={t.nr} data-spalte={d.stunden.length + i} className={`zw-ganzzelle${i === 0 ? ' zw-grenze-ganz' : ''}`} title={`${x} auf den gewählten Wert setzen`} />)}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="zw-hilfe">Wert wählen und die Stunden mit gedrückter Maustaste überstreichen. „Ganzer Tag“, „Vormittag“ und „Nachmittag“ setzen den ganzen Bereich. Tasten 3, 2, 1, 0 und Umschalt+1, 2, 3 (für −1, −2, −3) wählen den Wert.</p>
          {d.unbestimmte ? (
            <div className={s.unbestimmt}>
              <div className={s.kopf}>
                <h3 className={s.h3}>Zeitwünsche ohne feste Lage</h3>
                {schreiben ? <Button size="small" onClick={() => void unbestimmteSpeichern([...d.unbestimmte!, { bereich: 'Tage', anzahl: 1, wunsch: -3 }])}>Hinzufügen</Button> : null}
              </div>
              <p className="zw-hilfe">Freie Tage oder Halbtage, deren Lage die Planung bestimmt – z. B. „1 ganzer Tag unbedingt frei“.</p>
              {d.unbestimmte.length ? (
                <table className={s.tab}>
                  <thead><tr><th className={s.th}>Anzahl</th><th className={s.th}>Bereich</th><th className={s.th}>Zeitwunsch</th><th /></tr></thead>
                  <tbody>
                    {d.unbestimmte.map((u, i) => {
                      const aendern = (teil: Partial<typeof u>) => void unbestimmteSpeichern(d.unbestimmte!.map((x, j) => (j === i ? { ...x, ...teil } : x)));
                      return (
                        <tr key={i}>
                          <td className={s.td}><Input size="small" type="number" min={1} max={7} style={{ width: 72 }} disabled={!schreiben} defaultValue={String(u.anzahl)} onBlur={(e) => aendern({ anzahl: Math.max(1, Math.min(7, Number(e.target.value) || 1)) })} /></td>
                          <td className={s.td}><Select size="small" disabled={!schreiben} value={u.bereich} onChange={(_, x) => aendern({ bereich: x.value })}>{BEREICHE.map(([b, t]) => <option key={b} value={b}>{t}</option>)}</Select></td>
                          <td className={s.td}><Select size="small" disabled={!schreiben} value={String(u.wunsch)} onChange={(_, x) => aendern({ wunsch: Number(x.value) })}>{UNBESTIMMT.map(([w, t]) => <option key={w} value={w}>{t}</option>)}</Select></td>
                          <td className={s.td}>{schreiben ? <Button size="small" appearance="subtle" icon={<Dismiss16Regular />} aria-label="Zeile entfernen" title="Zeile entfernen" onClick={() => void unbestimmteSpeichern(d.unbestimmte!.filter((_, j) => j !== i))} /> : null}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : <p className={s.leer}>Keine Zeitwünsche ohne feste Lage erfasst.</p>}
            </div>
          ) : null}
        </>}
      </div>
    </AnsichtRahmen>
  );
}
