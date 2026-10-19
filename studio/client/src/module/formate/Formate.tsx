// Planformate: eigene Formate für Stundenpläne (Allgemein, Zeitbereich, Linien und Flächen, Darstellung, HTML, Stundenfeld mit
// grafischem Feld-Editor). Die Formate liegen in der Schuldatei und werden in der Druckauswahl gewählt. Server: Api/FormateApi.cs.
import { Button, Checkbox, Input, Tab, TabList } from '@fluentui/react-components';
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { api } from '@/api/client';
import { useAnsicht } from '@/kern/ansichten';
import { betrifft, useEreignis } from '@/kern/ereignisse';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, FussText, Rechts, Trenner, Werkzeug } from '@/komponenten/ansicht';
import { formular, frage } from '@/komponenten/dialoge';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import './formate.css';
import { SuchAuswahl } from '@/komponenten/suchauswahl';

const TAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const TYPEN: [string, string][] = [['Klasse', 'Klassen'], ['Lehrer', 'Lehrkräfte'], ['Raum', 'Räume'], ['Fach', 'Fächer']];
type Opt = { wert: string | number; text: string };
const opt = (liste: ([string | number, string] | string)[]): Opt[] => liste.map((x) => (Array.isArray(x) ? { wert: x[0], text: x[1] } : { wert: x, text: String(x) }));
type Art = 'text' | 'zahl' | 'bool' | 'auswahl' | 'grundform' | 'gestaltung';
type Feld = [string, string, Art, Opt[]?, string?];

const REITER: Record<string, Feld[]> = {
  Allgemein: [
    ['name', 'Name', 'text'], ['typ', 'Planart', 'auswahl', opt(TYPEN)], ['gross', 'Großes Format (eine Seite je Plan)', 'bool'],
    ['grundform', 'Grundform', 'grundform'], ['schriftgroesse', 'Schriftgröße', 'zahl'],
    ['farbe', 'Farbe nach', 'auswahl', opt([['Fach', 'Fach'], ['Lehrer', 'Lehrkraft'], ['Klasse', 'Klasse'], ['Raum', 'Raum'], ['Keine', 'Keine Farbe']])],
    ['langname', 'Langnamen anzeigen', 'bool'], ['zeitenAnzeigen', 'Uhrzeiten anzeigen', 'bool'], ['einzelstunden', 'Einzelstunden (nicht zusammenfassen)', 'bool'],
    ['pausenAnzeigen', 'Pausen am Bildschirm anzeigen', 'bool'], ['pausenbezeichnung', 'Pausenzeilen im Druck', 'bool'], ['klein', 'Kleiner Plan (nur Fachkürzel)', 'bool'],
    ['zellenBreite', 'Zellenbreite', 'zahl', undefined, '0 = automatisch'], ['zellenHoehe', 'Zellenhöhe', 'zahl', undefined, '0 = automatisch'],
    ['stundenplanlupeAnzeigen', 'Detailanzeige beim Zeigen auf eine Stunde', 'bool'], ['standardformat', 'Stundenfeld im Standardaufbau', 'bool'],
  ],
  Zeitbereich: [
    ['vonStunde', 'Von Stunde', 'zahl'], ['bisStunde', 'Bis Stunde', 'zahl', undefined, '0 = letzte Stunde'],
    ['vonTag', 'Von Tag', 'auswahl', opt(TAGE.map((t, i) => [i, t] as [number, string]))], ['bisTag', 'Bis Tag', 'auswahl', opt([[-1, 'Letzter Schultag'], ...TAGE.map((t, i) => [i, t] as [number, string])])],
    ['zeitraum', 'Zeitraum', 'auswahl', opt([['Kalenderwoche', 'Kalenderwoche'], ['GanzesSchuljahr', 'Ganzes Schuljahr'], ['EinTag', 'Ein Tag']])],
    ['minutModus', 'Minutengenaue Darstellung', 'bool'], ['ganzenTagZeigen', 'Ganzen Tag zeigen', 'bool'],
  ],
  'Linien und Flächen': [
    ['ueberschrift', 'Überschrift', 'gestaltung'], ['besetzteStunden', 'Belegte Stunden', 'gestaltung'], ['freieStunden', 'Freie Stunden', 'gestaltung'],
    ['linieVor', 'Linie vor den Stunden', 'text', undefined, 'Stundennummern, z. B. 3,5'], ['doppelstrichVor', 'Doppellinie vor den Stunden', 'text'], ['dickerStrichVor', 'Dicke Linie vor den Stunden', 'text'],
    ['trennstrichVormNachm', 'Trennlinie zwischen Vormittag und Nachmittag', 'bool'], ['trennstrichTage', 'Trennlinie zwischen den Tagen', 'bool'],
  ],
  Darstellung: [
    ['kombinierteKlassen', 'Klassen zusammenfassen (2a, 2b → 2ab)', 'bool'], ['alleKlassenEinFeld', 'Alle Klassen in einem Feld', 'bool'],
    ['kopplungenMitPunkt', 'Kopplungen mit Punkt kennzeichnen', 'bool'], ['fixierungMitStern', 'Fixierte Stunden mit Stern', 'bool'], ['kollisionTrennen', 'Kollisionen getrennt zeigen', 'bool'],
    ['stundenfelderSortieren', 'Stundenfelder sortieren', 'bool'], ['elementeVerbinden', 'Elemente verbinden', 'bool'],
    ['absenzenAnzeigen', 'Abwesenheiten anzeigen', 'bool'], ['keinAbsenzgrund', 'Ohne Abwesenheitsgrund', 'bool'], ['nurTagesabsenzen', 'Nur ganztägige Abwesenheiten', 'bool'],
    ['nurVertretungsstunden', 'Nur Vertretungsstunden', 'bool'], ['entfaelleDurchstreichen', 'Entfall durchstreichen', 'bool'], ['mitVertretungen', 'Mit Vertretungen', 'bool'],
    ['dragDropZeitwunschFarben', 'Beim Ziehen: Farben nach Zeitwünschen', 'bool'], ['dragDropMehrereUnterrichte', 'Beim Ziehen: mehrere Unterrichte', 'bool'], ['dragDropTauschketten', 'Beim Ziehen: Tauschketten', 'bool'],
    ['leereZeilenNichtDrucken', 'Leere Zeilen nicht drucken', 'bool'], ['leereSpalteNichtDrucken', 'Leere Spalten nicht drucken', 'bool'],
    ['schwarzWeissDruck', 'Schwarz-Weiß-Druck', 'bool'], ['eineUeberschriftJeBlatt', 'Eine Überschrift je Blatt', 'bool'], ['autosizeLupe', 'Detailanzeige an Inhalt anpassen', 'bool'],
    ['hauptklassenGetrennt', 'Stammklassen getrennt', 'bool'],
  ],
  HTML: [
    ['htmlTitel', 'Überschrift der HTML-Seiten', 'text'], ['htmlIndexseite', 'Übersichtsseite erzeugen', 'bool'], ['htmlMitFarben', 'Mit Fachfarben', 'bool'],
    ['htmlIndexLangnamen', 'Übersicht mit Langnamen', 'bool'],
  ],
  Stundenfeld: [
    ['namensArt', 'Namen', 'auswahl', opt([['Kurzname', 'Kurzname'], ['Langname', 'Langname'], ['Druckname', 'Druckname']])],
    ['felderHorizontalZentrieren', 'Felder waagerecht zentrieren', 'bool'], ['felderVertikalZentrieren', 'Felder senkrecht zentrieren', 'bool'],
    ['beginnEndzeit', 'Beginn und Ende anzeigen', 'bool'], ['aliasVerwenden', 'Alternative Namen verwenden', 'bool'], ['lehrerUndVertreter', 'Lehrkraft und Vertretung', 'bool'],
  ],
};
/** Ältere Reiternamen (Adresse/Parameter) auf die heutigen abbilden. */
const REITER_ALT: Record<string, string> = { 'Auswahl (Bereich)': 'Zeitbereich', 'Layout 1': 'Linien und Flächen', 'Layout 2': 'Darstellung', 'Stundenplan-Stunde': 'Stundenfeld' };

interface StundenFeld { art: string; zeile: number; x: number; y: number; b: number; h: number; schriftProzent: number; fett: boolean; kursiv: boolean; unterstrichen: boolean; ausrichtung: number }
type Format = Record<string, any> & { name: string; typ: string; gross?: boolean; felder: StundenFeld[] };
interface FormateDaten { formate: Format[]; vorlagen: Format[]; grundformen: { wert: string; text: string }[]; feldarten: string[] }

const feldStil = (fe: StundenFeld) => ({
  left: `${fe.x * 100}%`, top: `${fe.y * 100}%`, width: `${fe.b * 100}%`, height: `${fe.h * 100}%`,
  fontSize: `${Math.round(12 * fe.schriftProzent / 100)}px`, fontWeight: fe.fett ? 500 : 400, fontStyle: fe.kursiv ? 'italic' : 'normal',
  textDecoration: fe.unterstrichen ? 'underline' : 'none', justifyContent: ['flex-start', 'center', 'flex-end'][fe.ausrichtung ?? 1],
});

function Eingabe({ wert, zahl, gesperrt, setzen, titel }: { wert: unknown; zahl?: boolean; gesperrt: boolean; setzen: (v: string | number) => void; titel: string }) {
  const [t, setT] = useState(String(wert ?? ''));
  useEffect(() => setT(String(wert ?? '')), [wert]);
  return <Input size="small" type={zahl ? 'number' : 'text'} aria-label={titel} style={zahl ? { width: 100 } : undefined} disabled={gesperrt} value={t}
    onChange={(_, d) => setT(d.value)} onBlur={() => { if (t !== String(wert ?? '')) setzen(zahl ? Number(t) : t); }} />;
}

export default function Formate() {
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const reiter = REITER_ALT[String(a.p.reiter)] || (REITER[String(a.p.reiter)] ? String(a.p.reiter) : 'Allgemein');
  const [aktuell, setAktuell] = useState<Format | null>(null);
  const [alterName, setAlterName] = useState<string | null>(null);
  const [geaendert, setGeaendert] = useState(false);
  const [status, setStatus] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const { daten, setDaten, neuLaden, laedt } = useDaten(() => api.get<FormateDaten>(api.dok('/formate')), []);
  useEreignis('daten', (e) => { if (e.quelle !== a.id && !geaendert && betrifft(e, 'Einstellungen')) void neuLaden(true); });

  const waehlen = (fmt: Format, alt: string | null) => {
    setAktuell(structuredClone(fmt));
    setAlterName(alt);
    setGeaendert(false);
    setStatus(alt ? '' : 'Vorlage – „Speichern“ legt sie als eigenes Format an.');
  };
  // nach dem Laden: bisheriges, passendes oder erstes Format wählen
  useEffect(() => {
    if (!daten || geaendert) return;
    const bisher = alterName ? daten.formate.find((x) => x.name === alterName) : null;
    if (bisher) { setAktuell(structuredClone(bisher)); return; } // still auffrischen (z. B. nach Änderungen anderer)
    if (aktuell && !alterName) return; // Vorlage gewählt
    const typ = a.p.typ ? String(a.p.typ).toLowerCase() : null;
    const gew = (typ && daten.formate.find((x) => x.typ.toLowerCase() === typ)) || daten.formate[0];
    if (gew) waehlen(gew, gew.name);
  }, [daten]); // eslint-disable-line react-hooks/exhaustive-deps

  const merken = () => { setGeaendert(true); setStatus('Geändert – „Speichern“ übernimmt das Format in die Schuldatei.'); };
  const setze = (k: string, w: unknown) => { setAktuell((x) => (x ? { ...x, [k]: w } : x)); merken(); };
  const feldSetzen = (i: number, teil: Partial<StundenFeld>) => { setAktuell((x) => (x ? { ...x, felder: x.felder.map((f, j) => (j === i ? { ...f, ...teil } : f)) } : x)); merken(); };

  const speichern = async () => {
    if (!aktuell) return;
    try {
      const d = await api.put<FormateDaten>(api.dok(`/formate/${encodeURIComponent(alterName || aktuell.name)}`), aktuell, { quelle: a.id });
      setDaten(d);
      const neu = d.formate.find((x) => x.name === aktuell.name);
      if (neu) setAktuell(structuredClone(neu));
      setAlterName(aktuell.name);
      setGeaendert(false);
      setStatus('Gespeichert.');
      hinweis(`Format „${aktuell.name}“ gespeichert.`, 'ok', 1500);
    } catch (e) { fehlerMelden(e); }
  };
  const kopieren = async (name: string | null) => {
    if (!daten) return;
    const quellen = [...daten.formate.map((x) => x.name), ...daten.vorlagen.map((x) => x.name)];
    const w = await formular(name ? 'Format kopieren' : 'Neues Planformat', [
      { name: 'quelle', titel: 'Vorlage', art: 'auswahl', wert: name || quellen[0], optionen: quellen.map((q) => ({ wert: q, text: q })) },
      { name: 'neu', titel: 'Name des neuen Formats', wert: name ? `${name} (Kopie)` : '', pflicht: true },
    ], { okText: 'Anlegen' });
    if (!w) return;
    const d = await api.post<FormateDaten>(api.dok('/formate/kopieren'), { name: w.quelle, neu: w.neu }, { quelle: a.id });
    setDaten(d);
    const x = d.formate.find((fo) => fo.name === String(w.neu).trim());
    if (x) waehlen(x, x.name);
  };
  const loeschen = async () => {
    if (!alterName || !(await frage(`Format „${alterName}“ löschen?`, { ja: 'Löschen', gefahr: true }))) return;
    setDaten(await api.loeschen<FormateDaten>(api.dok(`/formate/${encodeURIComponent(alterName)}`), { quelle: a.id }));
    setAktuell(null);
    setAlterName(null);
    setGeaendert(false);
  };
  const probedruck = () => {
    if (!aktuell) return;
    if (geaendert || !alterName) { hinweis('Bitte das Format zuerst speichern.', 'warnung'); return; }
    a.oeffnen('druck.vorschau', { url: api.dok(`/druck/stundenplaene?typ=${aktuell.typ.toLowerCase()}&format=${encodeURIComponent(alterName)}`), titel: `Probedruck ${alterName}` });
  };

  const ziehen = (ev: RPointerEvent, i: number, groesse: boolean) => {
    if (!schreiben || !aktuell || !box.current) return;
    ev.preventDefault();
    const r = box.current.getBoundingClientRect();
    const fe = aktuell.felder[i]!;
    const start = { x: ev.clientX, y: ev.clientY, fx: fe.x, fy: fe.y, fb: fe.b, fh: fe.h };
    const runden = (v: number) => Math.round(v * 40) / 40; // Raster 2,5 %
    const bewegen = (e: PointerEvent) => {
      const dx = (e.clientX - start.x) / r.width;
      const dy = (e.clientY - start.y) / r.height;
      feldSetzen(i, groesse
        ? { b: Math.max(0.05, Math.min(1 - start.fx, runden(start.fb + dx))), h: Math.max(0.05, Math.min(1 - start.fy, runden(start.fh + dy))) }
        : { x: Math.max(0, Math.min(1 - start.fb, runden(start.fx + dx))), y: Math.max(0, Math.min(1 - start.fh, runden(start.fy + dy))) });
    };
    const ende = () => { document.removeEventListener('pointermove', bewegen); document.removeEventListener('pointerup', ende); };
    document.addEventListener('pointermove', bewegen);
    document.addEventListener('pointerup', ende);
  };

  const eingabe = ([k, titel, art, optionen, hinweisText]: Feld) => {
    const f = aktuell!;
    if (art === 'bool') return <Checkbox key={k} label={titel} disabled={!schreiben} checked={!!f[k]} onChange={(_, d) => setze(k, !!d.checked)} />;
    let el: JSX.Element;
    if (art === 'auswahl' || art === 'grundform') {
      const o: Opt[] = art === 'grundform' ? daten!.grundformen : optionen || [];
      el = (
        <SuchAuswahl size="small" ariaLabel={titel} disabled={!schreiben} wert={String(f[k] ?? '')} beiWahl={(w) => setze(k, typeof f[k] === 'number' ? Number(w) : w)}
          optionen={o.map((x) => ({ wert: String(x.wert), text: x.text }))} />
      );
    } else if (art === 'gestaltung') {
      const g = f[k] || { raeumlich: 'Flach', grau: false };
      el = (
        <div className="fm-paar">
          <SuchAuswahl size="small" breite={120} ariaLabel={`${titel}: Rand`} disabled={!schreiben} wert={g.raeumlich} beiWahl={(w) => setze(k, { ...g, raeumlich: w })}
            optionen={[{ wert: 'Erhaben', text: 'Erhaben' }, { wert: 'Versenkt', text: 'Vertieft' }, { wert: 'Flach', text: 'Eben' }]} />
          <SuchAuswahl size="small" breite={100} ariaLabel={`${titel}: Fläche`} disabled={!schreiben} wert={g.grau ? '1' : '0'} beiWahl={(w) => setze(k, { ...g, grau: w === '1' })}
            optionen={[{ wert: '1', text: 'Grau' }, { wert: '0', text: 'Weiß' }]} />
        </div>
      );
    } else {
      el = <Eingabe titel={titel} wert={f[k]} zahl={art === 'zahl'} gesperrt={!schreiben} setzen={(v) => setze(k, v)} />;
    }
    return [<label key={`l${k}`}>{titel}</label>, <span key={`e${k}`}>{el}</span>, hinweisText ? <p key={`h${k}`} className="fm-hinweis">{hinweisText}</p> : null];
  };

  const feldEditor = (f: Format) => {
    const neu = () => {
      const belegt = f.felder.map((x) => x.art);
      const art = ['Fach', 'Lehrer', 'Klasse', 'Raum', 'UNr', 'Text'].find((x) => !belegt.includes(x)) || 'Text';
      const n = f.felder.length;
      setAktuell({ ...f, felder: [...f.felder, { art, zeile: 1, x: (n % 2) * 0.5, y: Math.min(0.75, Math.floor(n / 2) * 0.25), b: 0.5, h: 0.25, schriftProzent: 100, fett: false, kursiv: false, unterstrichen: false, ausrichtung: 1 }] });
      merken();
    };
    return <>
      <h3>Felder einer Unterrichtsstunde</h3>
      <p className="fm-hinweis">{f.standardformat ? '„Stundenfeld im Standardaufbau“ (Reiter Allgemein) ist eingeschaltet: Dann erscheinen alle beteiligten Elemente automatisch, die Felder werden nicht verwendet.' : 'Die Felder bestimmen Lage und Schrift der Angaben in einer Stunde. Ziehen verschiebt ein Feld, die Ecke unten rechts ändert die Größe.'}</p>
      <div ref={box} className="fm-zelle" title="Felder verschieben (ziehen) und in der Größe ändern (Ecke unten rechts)">
        {f.felder.map((fe, i) => (
          <div key={i} className="fm-feld" style={feldStil(fe)} onPointerDown={(e) => ziehen(e, i, (e.target as HTMLElement).classList.contains('fm-griff'))}>
            {`${fe.zeile}${fe.art}`}<span className="fm-griff" />
          </div>
        ))}
      </div>
      <table className="fm-felder">
        <thead><tr><th>Feld</th><th>Zeile</th><th>Schrift (%)</th><th className="mitte">Fett</th><th className="mitte">Kursiv</th><th className="mitte">Unterstrichen</th><th>Ausrichtung</th><th /></tr></thead>
        <tbody>
          {f.felder.map((fe, i) => (
            <tr key={i}>
              <td><SuchAuswahl size="small" breite={170} ariaLabel="Feld" disabled={!schreiben} wert={fe.art} beiWahl={(w) => feldSetzen(i, { art: w })} optionen={daten!.feldarten.map((x) => ({ wert: x, text: x }))} /></td>
              <td><Eingabe titel="Zeile" zahl wert={fe.zeile} gesperrt={!schreiben} setzen={(v) => feldSetzen(i, { zeile: Number(v) })} /></td>
              <td><Eingabe titel="Schrift (%)" zahl wert={fe.schriftProzent} gesperrt={!schreiben} setzen={(v) => feldSetzen(i, { schriftProzent: Number(v) })} /></td>
              <td className="mitte"><Checkbox aria-label="Fett" disabled={!schreiben} checked={fe.fett} onChange={(_, d) => feldSetzen(i, { fett: !!d.checked })} /></td>
              <td className="mitte"><Checkbox aria-label="Kursiv" disabled={!schreiben} checked={fe.kursiv} onChange={(_, d) => feldSetzen(i, { kursiv: !!d.checked })} /></td>
              <td className="mitte"><Checkbox aria-label="Unterstrichen" disabled={!schreiben} checked={fe.unterstrichen} onChange={(_, d) => feldSetzen(i, { unterstrichen: !!d.checked })} /></td>
              <td><SuchAuswahl size="small" breite={100} ariaLabel="Ausrichtung" disabled={!schreiben} wert={String(fe.ausrichtung)} beiWahl={(w) => feldSetzen(i, { ausrichtung: Number(w) })}
                optionen={[{ wert: '0', text: 'links' }, { wert: '1', text: 'mittig' }, { wert: '2', text: 'rechts' }]} /></td>
              <td><Button size="small" appearance="subtle" disabled={!schreiben} onClick={() => { setAktuell({ ...f, felder: f.felder.filter((_, j) => j !== i) }); merken(); }}>Entfernen</Button></td>
            </tr>
          ))}
          {!f.felder.length ? <tr><td colSpan={8} className="fm-leer">Noch keine Felder angelegt.</td></tr> : null}
        </tbody>
      </table>
      <div><Button size="small" disabled={!schreiben} onClick={neu}>Feld hinzufügen</Button></div>
    </>;
  };

  const seitenInhalt = (f: Format) => {
    const felder = REITER[reiter] || REITER.Allgemein!;
    const angaben = felder.filter((x) => x[2] !== 'bool');
    const schalter = felder.filter((x) => x[2] === 'bool');
    return <>
      {angaben.length ? <><h3>Angaben</h3><div className="fm-formular">{angaben.map(eingabe)}</div></> : null}
      {schalter.length ? <><h3>Optionen</h3><div className="fm-schalter">{schalter.map(eingabe)}</div></> : null}
      {reiter === 'Stundenfeld' ? feldEditor(f) : null}
      {reiter === 'Allgemein' ? <p className="fm-hinweis">Im Druck wirken: großes Format bzw. kompakt, Langnamen, Uhrzeiten, Einzelstunden, Pausenzeilen, der Zeitbereich und der Schwarz-Weiß-Druck (Reiter Darstellung). Die übrigen Angaben bleiben in der Schuldatei erhalten.</p> : null}
    </>;
  };

  return (
    <AnsichtRahmen titel={aktuell ? `Planformat ${aktuell.name}` : 'Planformate'} laden={laedt && !daten}
      werkzeuge={<>
        <Werkzeug text="Neues Format …" deaktiviert={!schreiben} aktion={() => kopieren(null)} />
        <Werkzeug text="Kopieren …" deaktiviert={!schreiben || !aktuell} aktion={() => aktuell && kopieren(alterName || aktuell.name)} />
        <Werkzeug text="Löschen" deaktiviert={!schreiben || !alterName} aktion={loeschen} />
        <Trenner />
        <Werkzeug text="Probedruck" titel="Gespeichertes Format in der Druckvorschau anzeigen" aktion={probedruck} />
        <Rechts><Werkzeug text="Speichern" deaktiviert={!schreiben || !aktuell} aktion={speichern} /></Rechts>
      </>}
      fuss={<FussText>{status}</FussText>}>
      {daten ? (
        <div className="fm-rahmen">
          <nav className="fm-liste" aria-label="Formate">
            <div className="fm-gruppentitel">Eigene Formate</div>
            {daten.formate.length ? daten.formate.map((x) => (
              <button key={x.name} type="button" className={`fm-eintrag${alterName === x.name ? ' aktiv' : ''}`} onClick={() => waehlen(x, x.name)}>
                <span>{x.name}</span><span>{`${TYPEN.find((t) => t[0] === x.typ)?.[1] || x.typ}${x.gross ? ', groß' : ''}`}</span>
              </button>
            )) : <p className="fm-leer">Noch keine eigenen Formate.</p>}
            <div className="fm-gruppentitel">Vorlagen</div>
            {daten.vorlagen.map((x) => (
              <button key={x.name} type="button" className={`fm-eintrag${!alterName && aktuell?.name === x.name ? ' aktiv' : ''}`} onClick={() => waehlen(x, null)}>
                <span>{x.name}</span><span>Vorlage</span>
              </button>
            ))}
          </nav>
          <div className="fm-rechts">
            {aktuell ? <>
              <TabList size="small" selectedValue={reiter} onTabSelect={(_, d) => a.parameterSetzen({ reiter: d.value as string })} style={{ padding: '4px 16px', borderBottom: '1px solid var(--colorNeutralStroke2)' }}>
                {Object.keys(REITER).map((k) => <Tab key={k} value={k}>{k}</Tab>)}
              </TabList>
              <div className="fm-seite">{seitenInhalt(aktuell)}</div>
            </> : <div className="fm-leerzustand">Wählen Sie links ein Format oder legen Sie mit „Neues Format“ eines aus einer Vorlage an.</div>}
          </div>
        </div>
      ) : null}
    </AnsichtRahmen>
  );
}
