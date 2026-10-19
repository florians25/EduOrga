// Zeitraster: Woche und Stunden, Stundenzeiten, Belegung Vormittag/Nachmittag/leer (Zellen ziehen oder Strg+Klick), Pausen
// und Mittagspause.
import { Button, Checkbox, Input, Tab, TabList } from '@fluentui/react-components';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/api/client';
import { useAnsicht } from '@/kern/ansichten';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, FussText, Werkzeug } from '@/komponenten/ansicht';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { pfad, TAGE } from './kern';
import './einstellungen.css';
import { SuchAuswahl } from '@/komponenten/suchauswahl';

interface Pause { nachStunde: number; bezeichnung: string; dauerMinuten: number; aufsicht: boolean }
interface Z {
  tageProWoche: number; stundenProTag: number; ersterSchultag: number; ersteStundennummer: number; letzteVormittagsstunde: number; maxNachmittagsstunden: number;
  normalstundeMinuten: number; zeiten: { nr: number; beginn: string; ende: string }[]; belegung: string[][]; pausen: Pause[];
  mittagspauseVon: number; mittagspauseBis: number; maxKlassenGleicheMittagspause: number;
}
type ZahlFeld = 'tageProWoche' | 'stundenProTag' | 'letzteVormittagsstunde' | 'maxNachmittagsstunden' | 'normalstundeMinuten' | 'mittagspauseVon' | 'mittagspauseBis' | 'maxKlassenGleicheMittagspause';

const kopie = (d: Z): Z => ({ ...d, zeiten: d.zeiten.map((t) => ({ nr: t.nr, beginn: t.beginn, ende: t.ende })), belegung: d.belegung.map((t) => [...t]), pausen: d.pausen.map((x) => ({ ...x })) });
const minuten = (s: string) => { const [a, b] = s.split(':').map(Number); return a! * 60 + b!; };
const uhr = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Zeiten und Belegung an Tage/Stunden anpassen (neue Stunden: 55 Minuten Abstand). */
function anpassen(z: Z): Z {
  const standard = (st: number) => (st <= z.letzteVormittagsstunde ? 'V' : 'N');
  const zeiten = [...z.zeiten];
  while (zeiten.length < z.stundenProTag) {
    const b = minuten(zeiten[zeiten.length - 1]?.beginn || '07:05') + 55;
    zeiten.push({ nr: zeiten.length + 1, beginn: uhr(b), ende: uhr(b + (z.normalstundeMinuten || 45)) });
  }
  zeiten.length = z.stundenProTag;
  const belegung = z.belegung.map((t) => [...t]);
  while (belegung.length < z.tageProWoche) belegung.push([]);
  belegung.length = z.tageProWoche;
  for (const t of belegung) { while (t.length < z.stundenProTag) t.push(standard(t.length + 1)); t.length = z.stundenProTag; }
  return { ...z, zeiten, belegung };
}

function ZahlEingabe({ wert, min, max, gesperrt, setzen, titel }: { wert: number; min: number; max: number; gesperrt: boolean; setzen: (v: number) => void; titel: string }) {
  const [t, setT] = useState(String(wert));
  useEffect(() => setT(String(wert)), [wert]);
  const los = () => { const v = Math.max(min, Math.min(max, Number(t) || min)); setT(String(v)); if (v !== wert) setzen(v); };
  return <Input size="small" type="number" min={min} max={max} style={{ width: 90 }} aria-label={titel} disabled={gesperrt} value={t} onChange={(_, d) => setT(d.value)} onBlur={los} onKeyDown={(e) => { if (e.key === 'Enter') los(); }} />;
}

function ZeitEingabe({ wert, gesperrt, titel, setzen }: { wert: string; gesperrt: boolean; titel: string; setzen: (v: string) => void }) {
  const [t, setT] = useState(wert);
  useEffect(() => setT(wert), [wert]);
  return <input className="es-zeit" value={t} disabled={gesperrt} title={titel} aria-label={titel} onChange={(e) => setT(e.target.value)} onBlur={() => { if (t.trim() !== wert) setzen(t.trim()); }} />;
}

export default function Zeitraster() {
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const lesen = !schreiben;
  const [reiter, setReiter] = useState<'allgemein' | 'pausen'>('allgemein');
  const [z, setZ] = useState<Z | null>(null);
  const [status, setStatus] = useState('');
  const [auswahl, setAuswahl] = useState<Set<string>>(new Set());
  const ziehen = useRef<{ t: number; i: number } | null>(null);
  const { daten, laedt, neuLaden } = useDaten(() => api.get<Z>(pfad('/zeitraster')), []);
  useEffect(() => { if (daten) { setZ(kopie(daten)); setStatus(''); setAuswahl(new Set()); } }, [daten]);
  useEffect(() => {
    const los = () => { ziehen.current = null; };
    document.addEventListener('pointerup', los);
    return () => document.removeEventListener('pointerup', los);
  }, []);

  const aendern = (f: (z: Z) => Z) => { setZ((x) => (x ? f(x) : x)); setStatus('Geändert – mit „Übernehmen“ speichern.'); };
  const zahlSetzen = (k: ZahlFeld, v: number) => aendern((x) => {
    let n: Z = { ...x, [k]: v };
    if (k === 'letzteVormittagsstunde') {
      const alt = x.letzteVormittagsstunde;
      n = { ...n, belegung: x.belegung.map((t) => t.map((w, i) => { const st = i + 1; return w === (st <= alt ? 'V' : 'N') ? (st <= v ? 'V' : 'N') : w; })) };
    }
    return k === 'tageProWoche' || k === 'stundenProTag' ? anpassen(n) : n;
  });
  const zeitSetzen = (nr: number, art: 'beginn' | 'ende', wert: string) => aendern((x) => ({
    ...x, zeiten: x.zeiten.map((t) => {
      if (t.nr !== nr) return t;
      const n = { ...t, [art]: wert };
      if (art === 'beginn' && t.beginn && t.ende && /^\d{1,2}[:.]\d{2}$/.test(wert)) {
        // Beginn verschiebt das Ende um die bisherige Dauer
        const neu = minuten(wert.replace('.', ':'));
        const dauer = minuten(t.ende) - minuten(t.beginn);
        n.ende = uhr(neu + (dauer > 0 ? dauer : x.normalstundeMinuten));
      }
      return n;
    }),
  }));
  const markieren = (w: string) => aendern((x) => ({ ...x, belegung: x.belegung.map((t, ti) => t.map((v, i) => (auswahl.has(`${ti}:${i}`) ? w : v))) }));
  const pauseSetzen = (i: number, teil: Partial<Pause>) => aendern((x) => ({ ...x, pausen: x.pausen.map((p, j) => (j === i ? { ...p, ...teil } : p)) }));

  const speichern = async () => {
    if (!z) return;
    try {
      const d = await api.put<Z>(pfad('/zeitraster'), {
        tageProWoche: z.tageProWoche, stundenProTag: z.stundenProTag, ersterSchultag: z.ersterSchultag, ersteStundennummer: z.ersteStundennummer,
        letzteVormittagsstunde: z.letzteVormittagsstunde, maxNachmittagsstunden: z.maxNachmittagsstunden, normalstundeMinuten: z.normalstundeMinuten,
        zeiten: z.zeiten, belegung: z.belegung, pausen: z.pausen.map(({ nachStunde, bezeichnung, dauerMinuten, aufsicht }) => ({ nachStunde, bezeichnung, dauerMinuten, aufsicht })),
        mittagspauseVon: z.mittagspauseVon, mittagspauseBis: z.mittagspauseBis, maxKlassenGleicheMittagspause: z.maxKlassenGleicheMittagspause,
      }, { quelle: a.id });
      setZ(kopie(d));
      setStatus('Übernommen.');
      hinweis('Zeitraster übernommen – Strg+Z macht es rückgängig.', 'ok', 2000);
    } catch (e) { fehlerMelden(e); }
  };

  const zahl = (titel: string, k: ZahlFeld, min: number, max: number) => <>
    <label>{titel}</label><ZahlEingabe titel={titel} wert={z![k]} min={min} max={max} gesperrt={lesen} setzen={(v) => zahlSetzen(k, v)} />
  </>;

  const allgemein = (z: Z) => {
    const label = (s: number) => String(s - 1 + z.ersteStundennummer);
    const zelleDruck = (t: number, i: number, strg: boolean) => {
      ziehen.current = { t, i };
      setAuswahl((g) => { const n = strg ? new Set(g) : new Set<string>(); n.add(`${t}:${i}`); return n; });
    };
    const zelleUeber = (t: number, i: number) => {
      const s = ziehen.current;
      if (!s) return;
      setAuswahl((g) => {
        const n = new Set(g);
        for (let x = Math.min(s.t, t); x <= Math.max(s.t, t); x++) for (let y = Math.min(s.i, i); y <= Math.max(s.i, i); y++) n.add(`${x}:${y}`);
        return n;
      });
    };
    return <>
      <h3>Woche und Stunden</h3>
      <div className="es-zr-kopf">
        <div className="es-formular">
          {zahl('Schultage je Woche', 'tageProWoche', 1, 7)}
          {zahl('Stunden je Tag (höchstens)', 'stundenProTag', 1, 16)}
          {zahl('Letzte Vormittagsstunde', 'letzteVormittagsstunde', 1, 16)}
          {zahl('Nachmittagsstunden (höchstens)', 'maxNachmittagsstunden', 0, 16)}
        </div>
        <div className="es-formular">
          <label>Erster Schultag der Woche</label>
          <SuchAuswahl size="small" breite={160} disabled={lesen} ariaLabel="Erster Schultag" wert={String(z.ersterSchultag)} beiWahl={(w) => aendern((x) => ({ ...x, ersterSchultag: Number(w) }))}
            optionen={TAGE.map((t, i) => ({ wert: String(i), text: t }))} />
          <label>Nummer der ersten Stunde</label>
          <SuchAuswahl size="small" breite={90} disabled={lesen} ariaLabel="Nummer der ersten Stunde" wert={String(z.ersteStundennummer)} beiWahl={(w) => aendern((x) => ({ ...x, ersteStundennummer: Number(w) }))}
            optionen={[{ wert: '0', text: '0' }, { wert: '1', text: '1' }]} />
          {zahl('Dauer einer Stunde (Minuten)', 'normalstundeMinuten', 10, 120)}
        </div>
      </div>
      <h3>Stundenzeiten und Belegung</h3>
      <div className="es-eintragung">
        <span className="es-leise">Markierte Zellen:</span>
        {(['V', 'N', ''] as const).map((w) => <Button key={w || 'L'} size="small" disabled={lesen || !auswahl.size} onClick={() => markieren(w)}>{w === 'V' ? 'Vormittag' : w === 'N' ? 'Nachmittag' : 'Leer'}</Button>)}
        <span className="es-leise">Zellen durch Ziehen oder mit Strg+Klick markieren.</span>
      </div>
      <div className="es-zr-rahmen">
        <table className="es-zr" data-testid="zeitraster">
          <thead><tr><th />{z.zeiten.map((t) => <th key={t.nr}>{label(t.nr)}</th>)}</tr></thead>
          <tbody>
            {(['beginn', 'ende'] as const).map((art) => (
              <tr key={art}><th className="links">{art === 'beginn' ? 'Beginn' : 'Ende'}</th>
                {z.zeiten.map((t) => <td key={t.nr}><ZeitEingabe wert={t[art]} gesperrt={lesen} titel={`Stunde ${label(t.nr)}: ${art === 'beginn' ? 'Beginn' : 'Ende'}`} setzen={(v) => zeitSetzen(t.nr, art, v)} /></td>)}
              </tr>
            ))}
            {z.belegung.map((tag, t) => (
              <tr key={t}><th className="links">{TAGE[(z.ersterSchultag + t) % 7]}</th>
                {tag.map((w, i) => (
                  <td key={i} className={`es-zr-zelle es-zr-${w || 'L'}${auswahl.has(`${t}:${i}`) ? ' gewaehlt' : ''}`}
                    onPointerDown={(e) => zelleDruck(t, i, e.ctrlKey || e.shiftKey || e.metaKey)} onPointerEnter={() => zelleUeber(t, i)}>
                    {w === 'V' ? 'Vorm.' : w === 'N' ? 'Nachm.' : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="es-leise">Die ersten beiden Zeilen enthalten Beginn und Ende der Stunden; eine geänderte Beginnzeit verschiebt das Ende um die bisherige Dauer.</p>
    </>;
  };

  const pausen = (z: Z) => {
    const liste = z.pausen.map((p, i) => ({ p, i })).sort((x, y) => x.p.nachStunde - y.p.nachStunde);
    const neu = () => aendern((x) => {
      const frei = Array.from({ length: x.stundenProTag }, (_, i) => i + 1).find((s) => !x.pausen.some((p) => p.nachStunde === s)) ?? 0;
      return { ...x, pausen: [...x.pausen, { nachStunde: frei, bezeichnung: '', dauerMinuten: 15, aufsicht: true }] };
    });
    return <>
      <h3>Pausen</h3>
      <table className="es-liste" style={{ maxWidth: 720 }}>
        <thead><tr><th className="zahl">Nach Stunde</th><th>Bezeichnung</th><th className="zahl">Dauer (Min.)</th><th className="mitte">Aufsicht</th><th /></tr></thead>
        <tbody>
          {liste.map(({ p, i }) => (
            <tr key={i}>
              <td className="zahl"><ZahlEingabe titel="Nach Stunde" wert={p.nachStunde} min={0} max={z.stundenProTag} gesperrt={lesen} setzen={(v) => pauseSetzen(i, { nachStunde: v })} /></td>
              <td><Input size="small" disabled={lesen} value={p.bezeichnung} aria-label="Bezeichnung" onChange={(_, d) => pauseSetzen(i, { bezeichnung: d.value })} /></td>
              <td className="zahl"><ZahlEingabe titel="Dauer" wert={p.dauerMinuten} min={0} max={240} gesperrt={lesen} setzen={(v) => pauseSetzen(i, { dauerMinuten: v })} /></td>
              <td className="mitte"><Checkbox aria-label="Aufsicht" disabled={lesen} checked={p.aufsicht} onChange={(_, d) => pauseSetzen(i, { aufsicht: !!d.checked })} /></td>
              <td className="aktion"><Button size="small" appearance="subtle" disabled={lesen} onClick={() => aendern((x) => ({ ...x, pausen: x.pausen.filter((_, j) => j !== i) }))}>Entfernen</Button></td>
            </tr>
          ))}
          {!z.pausen.length ? <tr><td colSpan={5} className="es-leer">Keine Pausen eingetragen.</td></tr> : null}
        </tbody>
      </table>
      <div className="es-knoepfe"><Button size="small" disabled={lesen} onClick={neu}>Pause hinzufügen</Button></div>
      <p className="es-leise">„Nach Stunde 0“ steht für die Frühaufsicht.</p>
      <h3>Mittagspause</h3>
      <div className="es-formular">
        {zahl('Frühestens ab Stunde', 'mittagspauseVon', 0, 16)}
        {zahl('Spätestens bis Stunde', 'mittagspauseBis', 0, 16)}
        {zahl('Klassen mit gleichzeitiger Mittagspause (höchstens)', 'maxKlassenGleicheMittagspause', 0, 500)}
      </div>
      <p className="es-leise">0 bei „Frühestens ab Stunde“ bedeutet keine Mittagspause. Die Planung legt sie in die letzten Vormittags- bzw. ersten Nachmittagsstunden; die Länge legen Sie bei den Klassen fest.</p>
    </>;
  };

  return (
    <AnsichtRahmen titel="Zeitraster" laden={laedt && !z}
      aktionen={<TabList size="small" selectedValue={reiter} onTabSelect={(_, d) => setReiter(d.value as typeof reiter)}><Tab value="allgemein">Allgemein</Tab><Tab value="pausen">Pausen</Tab></TabList>}
      werkzeuge={<>
        <Werkzeug text="Übernehmen" deaktiviert={lesen} aktion={speichern} />
        <Werkzeug text="Verwerfen" aktion={() => neuLaden()} />
      </>}
      fuss={<FussText>{status}</FussText>}>
      {z ? <div className="es-seite">{reiter === 'pausen' ? pausen(z) : allgemein(z)}</div> : null}
    </AnsichtRahmen>
  );
}
