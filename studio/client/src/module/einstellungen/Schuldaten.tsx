// Schuldaten: Allgemein, Soll und Ist, Vertretungsplanung (mit Gewichtung des Vorschlags), Weiteres.
import { Checkbox, Input, Select, Slider } from '@fluentui/react-components';
import { useState } from 'react';
import { api } from '@/api/client';
import { useAnsicht } from '@/kern/ansichten';
import { befehl, seiteOeffnen } from '@/kern/befehle';
import { useEreignis, betrifft } from '@/kern/ereignisse';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben, useStudio } from '@/kern/zustand';
import { AnsichtRahmen, FussText, Werkzeug } from '@/komponenten/ansicht';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { DatumFeld } from '@/komponenten/eingaben';
import { pfad } from './kern';
import './einstellungen.css';

type Werte = Record<string, any>;
interface Daten extends Werte {
  schulformen: { wert: string; text: string }[];
  jahrgaenge: string[];
  kriterien: { schluessel: string; text: string; standard: number }[];
  vertretungsgewichtung: Record<string, number>;
  pflichtstunden: number;
}

const SEITEN: [string, string][] = [['Allgemein', 'Allgemein'], ['Werte', 'Soll und Ist'], ['Vertretungsplanung', 'Vertretungsplanung'], ['Weiteres', 'Weiteres']];

export default function Schuldaten() {
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const admin = useStudio((x) => x.benutzer?.rolle === 'Admin');
  const seite = SEITEN.some(([k]) => k === a.p.seite) ? String(a.p.seite) : a.p.seite === 'Diverses' ? 'Weiteres' : 'Allgemein';
  const [werte, setWerte] = useState<Werte>({});
  const [status, setStatus] = useState('');
  const geaendert = Object.keys(werte).length > 0;
  const { daten, setDaten, neuLaden, laedt } = useDaten(() => api.get<Daten>(pfad('/schuldaten')), []);
  useEreignis('daten', (e) => { if (e.quelle !== a.id && !geaendert && betrifft(e, 'Einstellungen')) void neuLaden(true); });

  const wert = (n: string) => (n in werte ? werte[n] : daten?.[n]);
  const setze = (n: string, w: unknown) => { setWerte((x) => ({ ...x, [n]: w })); setStatus('Geändert – mit „Übernehmen“ speichern.'); };
  const text = (n: string, breite?: number) => <Input size="small" style={breite ? { width: breite } : undefined} disabled={!schreiben} value={String(wert(n) ?? '')} onChange={(_, d) => setze(n, d.value)} />;
  const zahl = (n: string, min: number, max: number) => <Input size="small" type="number" min={min} max={max} style={{ width: 90 }} disabled={!schreiben} value={String(wert(n) ?? 0)} onChange={(_, d) => setze(n, Number(d.value))} />;
  const datumFeld = (n: string) => <DatumFeld size="small" disabled={!schreiben} wert={String(wert(n) ?? '')} beiAenderung={(datum) => setze(n, datum)} />;
  const haken = (n: string, t: string) => <Checkbox label={t} disabled={!schreiben} checked={!!wert(n)} onChange={(_, d) => setze(n, !!d.checked)} />;
  const auswahl = (n: string, optionen: { wert: string; text: string }[]) => (
    <Select size="small" disabled={!schreiben} value={String(wert(n) ?? '')} onChange={(_, d) => setze(n, d.value)}>
      {optionen.map((o) => <option key={o.wert} value={o.wert}>{o.text}</option>)}
    </Select>
  );
  const zeile = (titel: string, el: JSX.Element, hinweisText?: string) => <>
    <label>{titel}</label>{el}{hinweisText ? <p className="es-hinweis">{hinweisText}</p> : null}
  </>;
  const schalterZeile = (el: JSX.Element, hinweisText?: string) => <><span />{el}{hinweisText ? <p className="es-hinweis">{hinweisText}</p> : null}</>;

  const speichern = async () => {
    if (!geaendert) { hinweis('Keine Änderungen.', 'info', 1500); return; }
    try {
      setDaten(await api.put<Daten>(pfad('/schuldaten'), werte, { quelle: a.id }));
      setWerte({});
      setStatus('Übernommen.');
      hinweis('Einstellungen übernommen – Strg+Z macht es rückgängig.', 'ok', 2000);
    } catch (e) { fehlerMelden(e); }
  };

  const inhalt = () => {
    const d = daten!;
    if (seite === 'Werte') return <>
      <h3>Soll und Ist</h3>
      <div className="es-formular">
        {schalterZeile(haken('tagesgenaueWertrechnung', 'Soll und Ist tagesgenau rechnen'))}
        {zeile('Mehrarbeit vergütet ab', <span className="es-einheit">{zahl('mehrarbeitsgrenze', 0, 40)}<span>Std. je Monat</span></span>, 'Vergütet wird Mehrarbeit oberhalb dieses Werts (Regelung NRW).')}
        {zeile('Pflichtstunden', <span>{`${d.pflichtstunden} Std.`}</span>, 'Vorgabe der Schulform für neue Lehrkräfte')}
      </div>
    </>;
    if (seite === 'Vertretungsplanung') {
      const jg = [...d.jahrgaenge.map((j) => ({ wert: j, text: j })), { wert: '99', text: 'nie' }];
      if (!jg.some((j) => j.wert === d.entfallAbJahrgang)) jg.unshift({ wert: d.entfallAbJahrgang, text: d.entfallAbJahrgang });
      const gew: Record<string, number> = { ...d.vertretungsgewichtung, ...(werte.vertretungsgewichtung || {}) };
      return <>
        <h3>Vertretungsplanung</h3>
        <div className="es-formular">
          {zeile('Titel des Vertretungsplans', text('vertretungsplantitel'))}
          {zeile('Entfall in Randstunden ab Jahrgang', auswahl('entfallAbJahrgang', jg))}
          {schalterZeile(haken('bereitschaftNurDoppelstunden', 'Bereitschaften nur als Doppelstunden'))}
        </div>
        <h3>Gewichtung für den Vertretungsvorschlag</h3>
        <p className="es-leise">0 = ohne Bedeutung, 5 = sehr wichtig.</p>
        <div className="es-gewichtung">
          {d.kriterien.map((k) => {
            const w = gew[k.schluessel] ?? k.standard;
            return [
              <label key={`t${k.schluessel}`}>{k.text}</label>,
              <Slider key={`s${k.schluessel}`} min={0} max={5} step={1} value={w} disabled={!schreiben} aria-label={k.text}
                onChange={(_, x) => setze('vertretungsgewichtung', { ...(werte.vertretungsgewichtung || {}), [k.schluessel]: x.value })} />,
              <span key={`w${k.schluessel}`} className="es-wert">{w}</span>,
            ];
          })}
        </div>
      </>;
    }
    if (seite === 'Weiteres') {
      const verweise: [string, string, () => unknown][] = [
        ['Zeitraster', 'Stundenzeiten, Vormittag und Nachmittag, Pausen', () => seiteOeffnen('einstellungen.zeitraster')],
        ['Kalender und Ferien', 'Ferien, Feiertage und unterrichtsfreie Tage', () => seiteOeffnen('einstellungen.ferien')],
        ['Perioden', 'Zeitabschnitte mit eigenem Unterricht und Stundenplan', () => seiteOeffnen('einstellungen.perioden')],
        ['Unterrichtsgruppen', 'Unterricht in einzelnen Wochen oder Zeiträumen', () => seiteOeffnen('einstellungen.ugruppen')],
      ];
      if (admin) verweise.push(['Benutzerverwaltung', 'Benutzer, Rollen und Passwörter', () => befehl('datei.backstage', { seite: 'benutzer' })]);
      return <>
        <h3>Weitere Angaben</h3>
        <div className="es-formular">
          {schalterZeile(haken('unterrichtInFolgeperioden', 'Unterrichtsänderungen in Folgeperioden übernehmen'))}
          {zeile('Farbschema im Druck', auswahl('farbschema', ['Blau', 'Grün', 'Grau', 'Dunkel'].map((x) => ({ wert: x, text: x }))))}
        </div>
        <h3>Verwandte Einstellungen</h3>
        <div className="es-verweise">
          {verweise.map(([titel, t, aktion]) => (
            <button key={titel} type="button" className="es-verweis" onClick={() => { Promise.resolve().then(aktion).catch(fehlerMelden); }}><span>{titel}</span><span>{t}</span></button>
          ))}
        </div>
        <p className="es-leise">Persönliche Einstellungen wie Seitenaufteilung und Spaltenbreiten speichert das Studio je Benutzer automatisch.</p>
      </>;
    }
    const formen = d.schulformen.map((s) => ({ wert: s.wert, text: `${s.text} (${s.wert})` }));
    return <>
      <h3>Schule</h3>
      <div className="es-formular">
        {zeile('Schulbezeichnung', text('schulname'))}
        {zeile('Zusatz / Ort', text('schulname2'))}
        {zeile('Adresse', text('adresse'))}
        {zeile('Schulnummer', text('schulnummer', 140), 'In NRW sechsstellig')}
        {zeile('Land', text('land'))}
        {zeile('Bundesland', text('region'))}
        {zeile('Schulform', auswahl('schulform', formen))}
      </div>
      <h3>Schuljahr</h3>
      <div className="es-formular">
        {zeile('Beginn', datumFeld('schuljahrVon'))}
        {zeile('Ende', datumFeld('schuljahrBis'), 'Die Sommerferien gehören nicht zum Schuljahr.')}
        {zeile('Wochenperiodizität', zahl('wochenperiodizitaet', 1, 16), '1 = jede Woche gleich, 2 = A/B-Wochen usw.')}
        {zeile('Erste Schulwoche', text('ersteSchulwoche', 70), 'Wochenbuchstabe der ersten Schulwoche (A, B …)')}
      </div>
    </>;
  };

  return (
    <AnsichtRahmen titel="Einstellungen" laden={laedt && !daten}
      werkzeuge={<>
        <Werkzeug text="Übernehmen" deaktiviert={!schreiben || !geaendert} aktion={speichern} />
        <Werkzeug text="Verwerfen" deaktiviert={!schreiben || !geaendert} aktion={() => { setWerte({}); setStatus(''); }} />
      </>}
      fuss={<FussText>{status}</FussText>}>
      {daten ? (
        <div className="es-zweispaltig">
          <nav className="es-abschnitte" aria-label="Abschnitte">
            {SEITEN.map(([k, t]) => (
              <button key={k} type="button" className={`es-knoten${seite === k ? ' aktiv' : ''}`} aria-current={seite === k ? 'true' : undefined} data-seite={k}
                onClick={() => a.parameterSetzen({ seite: k })}>{t}</button>
            ))}
          </nav>
          <div className="es-seite">{inhalt()}</div>
        </div>
      ) : null}
    </AnsichtRahmen>
  );
}
