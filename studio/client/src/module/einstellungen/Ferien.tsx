// Kalender und Ferien: Jahreskalender (12 Monate des Schuljahres) – Tage mit der Maus aufziehen (oder Klick, Umschalt+Klick) und
// als frei markieren (Ferien, Feiertag, beweglicher Ferientag, unterrichtsfreier Tag) bzw. wieder zu Schultagen machen; daneben
// die Liste der Einträge (direkt bearbeitbar, Datumsfelder mit Kalender), Jahresdaten und „Ferien und Feiertage NRW“.
import { Button, Checkbox, Input, Radio, RadioGroup, Field, Tooltip } from '@fluentui/react-components';
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { api } from '@/api/client';
import { useAnsicht } from '@/kern/ansichten';
import { rueckgaengig } from '@/kern/dokument';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, FussText, Trenner, Werkzeug } from '@/komponenten/ansicht';
import { StandardDialog, dialogZeigen, frage } from '@/komponenten/dialoge';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { DatumFeld } from '@/komponenten/eingaben';
import { datum, de, iso, kw, MONATE, pfad, TAGE_KURZ } from './kern';
import './einstellungen.css';

interface Ferien { id: number; kurzname: string; langname: string; von: string; bis: string; tage: number; wocheDanach: string; wochennummerierung: boolean; feiertag: boolean }
interface FerienDaten {
  ferien: Ferien[]; schuljahrVon: string; schuljahrBis: string; ersterSchultag: number; tageProWoche: number;
  jahresdaten: { schuljahrTage: number; schuljahrWochen: number; anzahlFerien: number; anzahlFeiertage: number; unterrichtTage: number; unterrichtWochen: number; ferientage: number };
}

/** Arten freier Tage (alle als Ferieneintrag gespeichert; Feiertag mit Kennzeichen). */
const ARTEN = [
  { wert: 'ferien', text: 'Ferien', name: 'Ferien' },
  { wert: 'feiertag', text: 'Feiertag', name: 'Feiertag' },
  { wert: 'beweglich', text: 'Beweglicher Ferientag', name: 'Beweglicher Ferientag' },
  { wert: 'frei', text: 'Unterrichtsfreier Tag', name: 'Unterrichtsfrei' },
] as const;
type Art = (typeof ARTEN)[number]['wert'];

const plus = (s: string, n: number) => { const d = datum(s); d.setDate(d.getDate() + n); return iso(d); };
const tageZwischen = (v: string, b: string) => Math.round((datum(b).getTime() - datum(v).getTime()) / 864e5) + 1;
const kurzDe = (s: string) => `${Number(s.slice(8))}.${Number(s.slice(5, 7))}.`;

function TextZelle({ wert, breite, gesperrt, setzen, label }: { wert: string; breite?: number; gesperrt: boolean; setzen: (v: string) => void; label: string }) {
  const [t, setT] = useState(wert ?? '');
  useEffect(() => setT(wert ?? ''), [wert]);
  return <Input size="small" aria-label={label} style={breite ? { width: breite, minWidth: 0 } : { width: '100%', minWidth: 0 }} disabled={gesperrt} value={t} onChange={(_, d) => setT(d.value)} onBlur={() => { if (t !== (wert ?? '')) setzen(t); }} />;
}

// ---- Dialog „Als frei markieren“ ----
interface FreiWerte { art: Art; kurzname: string; langname: string; von: string; bis: string }

function FreiDialog({ vorgabe, schliessen }: { vorgabe: FreiWerte; schliessen: (w: FreiWerte | null) => void }) {
  const [w, setW] = useState(vorgabe);
  const [namenGeaendert, setNamenGeaendert] = useState(false);
  const fehler = !w.kurzname.trim() ? 'Bitte einen Namen angeben.' : w.bis < w.von ? 'Das Ende liegt vor dem Beginn.' : '';
  const artWaehlen = (art: Art) => {
    const n = ARTEN.find((x) => x.wert === art)!;
    setW((x) => (namenGeaendert ? { ...x, art } : { ...x, art, kurzname: art === 'ferien' && x.von !== x.bis ? 'Ferien' : n.name, langname: art === 'ferien' && x.von !== x.bis ? x.langname : `${n.name} ${de(x.von)}` }));
  };
  return (
    <StandardDialog<boolean> titel="Als frei markieren" breite="440px"
      knoepfe={[{ text: 'Übernehmen', wert: true, primaer: true, deaktiviert: !!fehler }, { text: 'Abbrechen', wert: null }]}
      beiKnopf={(x) => schliessen(x && !fehler ? w : null)}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-testid="frei-dialog">
        <div style={{ display: 'flex', gap: 12 }}>
          <Field label="Von"><DatumFeld size="medium" aria-label="Von" wert={w.von} beiAenderung={(von) => setW({ ...w, von, bis: w.bis < von ? von : w.bis })} /></Field>
          <Field label="Bis"><DatumFeld size="medium" aria-label="Bis" wert={w.bis} min={w.von} beiAenderung={(bis) => setW({ ...w, bis })} /></Field>
        </div>
        <Field label="Art">
          <RadioGroup value={w.art} onChange={(_, d) => artWaehlen(d.value as Art)} aria-label="Art">
            {ARTEN.map((a) => <Radio key={a.wert} value={a.wert} label={a.text} />)}
          </RadioGroup>
        </Field>
        <Field label="Name" required validationMessage={fehler && !w.kurzname.trim() ? fehler : undefined} hint="Kurzer Name, z. B. „Herbst“, „Tag der Einheit“, „Pädagogischer Tag“.">
          <Input value={w.kurzname} autoFocus aria-label="Name" onChange={(_, d) => { setNamenGeaendert(true); setW({ ...w, kurzname: d.value }); }} />
        </Field>
        <Field label="Bezeichnung (optional)">
          <Input value={w.langname} aria-label="Bezeichnung" onChange={(_, d) => { setNamenGeaendert(true); setW({ ...w, langname: d.value }); }} />
        </Field>
      </div>
    </StandardDialog>
  );
}

export default function FerienAnsicht() {
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const lesen = !schreiben;
  // Auswahl im Kalender: anker (Beginn des Aufziehens) und ende; Liste: markierte Einträge
  const [anker, setAnker] = useState<string | null>(null);
  const [ende, setEnde] = useState<string | null>(null);
  const zieht = useRef(false);
  const [markiert, setMarkiert] = useState<Set<number>>(new Set());
  const { daten: d, setDaten, laedt } = useDaten(() => api.get<FerienDaten>(pfad('/ferien')), [], { bereiche: ['Einstellungen'], quelle: a.id });

  useEffect(() => {
    const los = () => { zieht.current = false; };
    window.addEventListener('mouseup', los);
    return () => window.removeEventListener('mouseup', los);
  }, []);

  const senden = async (p: Promise<FerienDaten>, text?: string) => {
    try { setDaten(await p); if (text) hinweis(text, 'ok', 6000, { text: 'Rückgängig', aktion: rueckgaengig }); return true; } catch (e) { fehlerMelden(e); return false; }
  };
  const feldAendern = (fe: Ferien, feld: string, wert: string) => senden(api.patch<FerienDaten>(pfad(`/ferien/${fe.id}`), { feld, wert }, { quelle: a.id }));

  // je Tag der kürzeste Eintrag (Feiertag in den Ferien schlägt die Ferien)
  const proTag = useMemo(() => {
    const m = new Map<string, Ferien>();
    for (const f of [...(d?.ferien || [])].sort((x, y) => y.tage - x.tage)) for (let t = f.von; t <= f.bis; t = plus(t, 1)) m.set(t, f);
    return m;
  }, [d]);
  const bereich: [string, string] | null = anker && ende ? (anker <= ende ? [anker, ende] : [ende, anker]) : null;

  const freiMarkieren = async () => {
    if (!d) return;
    const [v, b] = bereich || [d.schuljahrVon, d.schuljahrVon];
    const einTag = v === b;
    const vorgabe: FreiWerte = einTag
      ? { art: 'frei', kurzname: 'Unterrichtsfrei', langname: `Unterrichtsfrei ${de(v)}`, von: v, bis: b }
      : { art: 'ferien', kurzname: 'Ferien', langname: `Ferien ${de(v)} – ${de(b)}`, von: v, bis: b };
    const w = await dialogZeigen<FreiWerte>((zu) => <FreiDialog vorgabe={vorgabe} schliessen={zu} />);
    if (!w) return;
    const ok = await senden(api.post<FerienDaten>(pfad('/ferien'), { kurzname: w.kurzname.trim(), langname: w.langname.trim(), von: w.von, bis: w.bis, feiertag: w.art === 'feiertag' }, { quelle: a.id }),
      `${w.kurzname.trim()} (${w.von === w.bis ? de(w.von) : `${de(w.von)} – ${de(w.bis)}`}) eingetragen.`);
    if (ok) { setAnker(null); setEnde(null); }
  };
  const freigeben = async () => {
    if (!bereich) return;
    const [v, b] = bereich;
    const ok = await senden(api.post<FerienDaten>(pfad('/ferien/freigeben'), { von: v, bis: b }, { quelle: a.id }),
      v === b ? `${de(v)} ist wieder ein Schultag.` : `${de(v)} – ${de(b)} sind wieder Schultage.`);
    if (ok) { setAnker(null); setEnde(null); }
  };
  const loeschen = async () => {
    const ids = [...markiert];
    if (!ids.length) { hinweis('Bitte zuerst Einträge in der Liste wählen (Strg+Klick für mehrere).', 'warnung'); return; }
    if (!(await frage(ids.length === 1 ? 'Den gewählten Eintrag löschen?' : `${ids.length} Einträge löschen?`, { ja: 'Löschen', gefahr: true }))) return;
    setMarkiert(new Set());
    await senden(api.post<FerienDaten>(pfad('/ferien/loeschen'), { ids }, { quelle: a.id }), ids.length === 1 ? 'Eintrag gelöscht.' : `${ids.length} Einträge gelöscht.`);
  };
  const nrw = async () => {
    if (!(await frage('Ferien und gesetzliche Feiertage NRW für das Schuljahr eintragen? Vorhandene Einträge bleiben erhalten.'))) return;
    await senden(api.post<FerienDaten>(pfad('/ferien/nrw'), {}, { quelle: a.id }), 'Ferien und Feiertage NRW eingetragen.');
  };

  const zeileKlick = (e: MouseEvent, fe: Ferien) => {
    if ((e.target as HTMLElement).closest('input,button,[role=combobox]')) return;
    setMarkiert((m) => { const n = e.ctrlKey || e.metaKey ? new Set(m) : new Set<number>(); if (n.has(fe.id) && (e.ctrlKey || e.metaKey)) n.delete(fe.id); else n.add(fe.id); return n; });
    setAnker(fe.von); setEnde(fe.bis);
    document.querySelector(`.es-monat td[data-d="${fe.von}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  const tagRunter = (e: MouseEvent, s: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    if (e.shiftKey && anker) { setEnde(s); return; }
    zieht.current = true;
    setAnker(s); setEnde(s);
    const fe = proTag.get(s);
    setMarkiert(new Set(fe ? [fe.id] : []));
  };
  const tagUeber = (s: string) => { if (zieht.current) setEnde(s); };

  const kalender = (d: FerienDaten) => {
    // 12 Monate ab dem Monat des Schuljahresbeginns (bei längeren Schuljahren bis zum Monat des Endes)
    const von = datum(d.schuljahrVon), bisD = datum(d.schuljahrBis);
    const anzahl = Math.max(12, (bisD.getFullYear() - von.getFullYear()) * 12 + bisD.getMonth() - von.getMonth() + 1);
    const [bv, bb] = bereich || [null, null];
    const schultag = (t: string, wd: number) => t >= d.schuljahrVon && t <= d.schuljahrBis && ((wd - d.ersterSchultag + 7) % 7) < d.tageProWoche;
    const heute = iso(new Date());
    const monate: JSX.Element[] = [];
    for (let k = 0; k < anzahl; k++) {
      const m = new Date(von.getFullYear(), von.getMonth() + k, 1);
      const wochen: JSX.Element[][] = [];
      const erster = (m.getDay() + 6) % 7;
      let woche: JSX.Element[] = [<td key="kw" className="kw">{kw(m)}</td>];
      for (let i = 0; i < erster; i++) woche.push(<td key={`l${i}`} className="leer" />);
      const tage = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      for (let t = 1; t <= tage; t++) {
        const dt = new Date(m.getFullYear(), m.getMonth(), t);
        const wd = (dt.getDay() + 6) % 7;
        if (wd === 0 && t > 1) { wochen.push(woche); woche = [<td key="kw" className="kw">{kw(dt)}</td>]; }
        const s = iso(dt);
        const fe = proTag.get(s);
        const imJahr = s >= d.schuljahrVon && s <= d.schuljahrBis;
        const kl = ['tag', wd >= 5 ? 'we' : '', !imJahr ? 'ausserhalb' : '', fe ? (fe.feiertag ? 'feiertag' : 'ferien') : schultag(s, wd) ? 'schultag' : '',
          fe && fe.von === s ? 'beginn' : '', fe && fe.bis === s ? 'ende' : '', bv && bb && s >= bv && s <= bb ? 'auswahl' : '', s === heute ? 'heute' : ''].filter(Boolean).join(' ');
        woche.push(<td key={s} className={kl} data-d={s} title={fe ? `${de(s)}: ${fe.langname || fe.kurzname}${fe.feiertag ? ' (Feiertag)' : ''}` : `${TAGE_KURZ[wd]} ${de(s)}`}
          onMouseDown={(e) => tagRunter(e, s)} onMouseEnter={() => tagUeber(s)} onDoubleClick={() => { if (!lesen) void freiMarkieren(); }}>{t}</td>);
      }
      wochen.push(woche);
      // Namen der freien Abschnitte, die in diesem Monat beginnen
      const namen = (d.ferien || []).filter((f) => f.von.slice(0, 7) === s7(m)).map((f) => f.kurzname);
      monate.push(
        <div key={`${m.getFullYear()}-${m.getMonth()}`} className="es-monat-rahmen">
          <div className="es-monat-kopf"><span>{`${MONATE[m.getMonth()]} ${m.getFullYear()}`}</span>{namen.length ? <span className="namen" title={namen.join(', ')}>{namen.join(', ')}</span> : null}</div>
          <table className="es-monat" aria-label={`${MONATE[m.getMonth()]} ${m.getFullYear()}`}>
            <thead><tr><th className="kw">KW</th>{TAGE_KURZ.map((t) => <th key={t}>{t}</th>)}</tr></thead>
            <tbody>{wochen.map((w, i) => <tr key={i}>{w}</tr>)}</tbody>
          </table>
        </div>,
      );
    }
    return monate;
  };

  const auswahlLeiste = () => {
    if (!bereich) return <span className="es-leise">Tage im Kalender mit der Maus aufziehen (oder Klick und Umschalt+Klick), dann als frei markieren.</span>;
    const [v, b] = bereich;
    const n = tageZwischen(v, b);
    let frei = 0;
    for (let t = v; t <= b; t = plus(t, 1)) if (proTag.has(t)) frei++;
    const eintraege = [...new Set([...Array(n).keys()].map((i) => proTag.get(plus(v, i))).filter((x): x is Ferien => !!x))];
    return <>
      <b data-testid="kalender-auswahl">{v === b ? `${TAGE_KURZ[(datum(v).getDay() + 6) % 7]} ${de(v)}` : `${kurzDe(v)} – ${de(b)}`}</b>
      <span className="es-leise">{`${n} ${n === 1 ? 'Tag' : 'Tage'}${frei ? `, davon ${frei} frei` : ''}${eintraege.length ? ` · ${eintraege.map((x) => x.kurzname).join(', ')}` : ''}`}</span>
      <span style={{ flex: 1 }} />
      <Button size="small" appearance="primary" disabled={lesen} onClick={() => void freiMarkieren()} data-testid="frei-markieren">Als frei markieren …</Button>
      <Button size="small" disabled={lesen || !frei} onClick={() => void freigeben()} data-testid="frei-aufheben">{frei === n && n > 1 ? 'Wieder Schultage' : 'Wieder Schultag'}</Button>
      <Button size="small" appearance="subtle" onClick={() => { setAnker(null); setEnde(null); }}>Auswahl aufheben</Button>
    </>;
  };

  return (
    <AnsichtRahmen titel="Kalender und Ferien" laden={laedt && !d}
      werkzeuge={<>
        <Werkzeug text="Als frei markieren …" titel="Gewählte Tage als Ferien, Feiertag oder unterrichtsfrei eintragen" deaktiviert={lesen} aktion={freiMarkieren} />
        <Werkzeug text="Löschen" titel="Markierte Einträge der Liste löschen" deaktiviert={lesen || !markiert.size} aktion={loeschen} />
        <Trenner />
        <Werkzeug text="Ferien und Feiertage NRW eintragen …" deaktiviert={lesen} aktion={nrw} />
      </>}
      fuss={<>
        <span className="es-legende"><i className="schultag" />Schultag<i className="ferien" />Ferien, frei<i className="feiertag" />Feiertag<i className="we" />Wochenende<i className="auswahl" />Auswahl</span>
        <FussText rechts>Ziehen markiert Tage · Umschalt+Klick erweitert · Doppelklick: als frei markieren</FussText>
      </>}>
      {d ? (
        <div className="es-ferien">
          <div className="es-ferien-kalender">
            <div className="es-tag">{auswahlLeiste()}</div>
            <div className="es-kalender" data-testid="jahreskalender">{kalender(d)}</div>
          </div>
          <div className="es-ferien-liste">
            <div className="es-ferienliste">
              <table className="es-liste">
                <thead><tr>
                  <th>Name</th><th>Von</th><th>Bis</th><th className="zahl">Tage</th>
                  <th className="mitte">Feiertag</th>
                  <th className="umbruch" title="Wochenbuchstabe der ersten Woche nach den Ferien">Woche danach</th><th className="mitte umbruch" title="Wochen während der Ferien mitzählen">Wochen zählen</th>
                </tr></thead>
                <tbody>
                  {d.ferien.map((fe) => (
                    <tr key={fe.id} className={`klickbar${markiert.has(fe.id) ? ' gewaehlt' : ''}`} onClick={(e) => zeileKlick(e, fe)} data-ferien={fe.id}>
                      <td style={{ minWidth: 110 }}>
                        <TextZelle label="Name" wert={fe.kurzname} gesperrt={lesen} setzen={(v) => void feldAendern(fe, 'kurzname', v)} />
                        {fe.langname && fe.langname !== fe.kurzname ? <Tooltip content="Bezeichnung (Doppelklick zum Ändern)" relationship="description"><div className="es-leise es-bez" onDoubleClick={async () => {
                          const w = await dialogZeigen<string>((zu) => <BezeichnungDialog wert={fe.langname} schliessen={zu} />);
                          if (w !== null) void feldAendern(fe, 'langname', w);
                        }}>{fe.langname}</div></Tooltip> : null}
                      </td>
                      <td><DatumFeld size="small" wochentag={false} className="es-datum" disabled={lesen} wert={fe.von} aria-label="Von" beiAenderung={(dt) => { if (dt) void feldAendern(fe, 'von', dt); }} /></td>
                      <td><DatumFeld size="small" wochentag={false} className="es-datum" disabled={lesen} wert={fe.bis} aria-label="Bis" beiAenderung={(dt) => { if (dt) void feldAendern(fe, 'bis', dt); }} /></td>
                      <td className="zahl">{fe.tage}</td>
                      <td className="mitte"><Checkbox aria-label="Feiertag" disabled={lesen} checked={fe.feiertag} onChange={(_, x) => void feldAendern(fe, 'feiertag', x.checked ? 'X' : '')} /></td>
                      <td><TextZelle label="Woche danach" wert={fe.wocheDanach} breite={44} gesperrt={lesen} setzen={(v) => void feldAendern(fe, 'wocheDanach', v)} /></td>
                      <td className="mitte"><Checkbox aria-label="Wochen zählen" disabled={lesen} checked={fe.wochennummerierung} onChange={(_, x) => void feldAendern(fe, 'wochennummerierung', x.checked ? 'X' : '')} /></td>
                    </tr>
                  ))}
                  {!d.ferien.length ? <tr><td colSpan={7} className="es-leer">Noch keine freien Tage eingetragen – Tage im Kalender aufziehen oder „Ferien und Feiertage NRW eintragen“.</td></tr> : null}
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
        </div>
      ) : null}
    </AnsichtRahmen>
  );
}

const s7 = (m: Date) => `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;

function BezeichnungDialog({ wert, schliessen }: { wert: string; schliessen: (w: string | null) => void }) {
  const [t, setT] = useState(wert);
  return (
    <StandardDialog<boolean> titel="Bezeichnung" knoepfe={[{ text: 'Übernehmen', wert: true, primaer: true }, { text: 'Abbrechen', wert: null }]} beiKnopf={(x) => schliessen(x ? t : null)}>
      <Input value={t} autoFocus aria-label="Bezeichnung" onChange={(_, d) => setT(d.value)} />
    </StandardDialog>
  );
}
