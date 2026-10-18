// Dialog „Mehrfach ändern“: einen Wert in einer Spalte für alle markierten Zeilen setzen (Serienänderung wie in der
// Desktop-Anwendung). Bei Listen (Klassen, Lehrkräfte …) wahlweise ersetzen, hinzufügen oder entfernen.
import { Checkbox, Field, Input, Radio, RadioGroup, Select, Text } from '@fluentui/react-components';
import { useEffect, useRef, useState } from 'react';
import type { ElementOption } from '@/api/typen';
import { dialogZeigen, StandardDialog } from '../dialoge';
import { auswahlOptionen, istListenart, pruefeWert, type PruefSpalte } from './pruefung';
import { Vorschlagsliste, type VorschlagslisteApi } from './vorschlagsliste';

export interface MehrfachSpalte extends PruefSpalte { schluessel: string }
export type MehrfachModus = 'ersetzen' | 'hinzufuegen' | 'entfernen';
export interface MehrfachErgebnis { schluessel: string; wert: string; modus: MehrfachModus }

interface Props {
  spalten: MehrfachSpalte[];
  vorgabe?: string;
  anzahl: number;
  optionen: (s: MehrfachSpalte) => Promise<ElementOption[]>;
  /** Vorschläge für Freitext (vorhandene Werte der Spalte) */
  werte: (s: MehrfachSpalte) => ElementOption[];
  schliessen: (e: MehrfachErgebnis | null) => void;
}

function MehrfachDialog({ spalten, vorgabe, anzahl, optionen, werte, schliessen }: Props) {
  const [schluessel, setSchluessel] = useState(vorgabe && spalten.some((s) => s.schluessel === vorgabe) ? vorgabe : spalten[0]!.schluessel);
  const s = spalten.find((x) => x.schluessel === schluessel)!;
  const [wert, setWert] = useState('');
  const [modus, setModus] = useState<MehrfachModus>('ersetzen');
  const [fehler, setFehler] = useState<string | null>(null);
  const [opts, setOpts] = useState<ElementOption[] | null>(null);
  const eingabe = useRef<HTMLInputElement>(null);
  const vorschlag = useRef<VorschlagslisteApi>(null);

  useEffect(() => {
    let aktiv = true;
    setWert(''); setFehler(null); setModus('ersetzen'); setOpts(null);
    if (s.art === 'Element' || s.art === 'ElementListe') void optionen(s).then((o) => { if (aktiv) setOpts(o); }).catch(() => { if (aktiv) setOpts([]); });
    return () => { aktiv = false; };
  }, [schluessel]); // eslint-disable-line react-hooks/exhaustive-deps

  const anwenden = (w: boolean | null) => {
    if (!w) { schliessen(null); return; }
    const roh = eingabe.current && s.art !== 'Bool' && s.art !== 'Auswahl' ? eingabe.current.value : wert;
    const p = pruefeWert(s, roh, opts);
    if (!p.ok) { setFehler(p.fehler); return; }
    if (modus !== 'ersetzen' && !p.wert) { setFehler('Bitte mindestens einen Wert angeben.'); return; }
    schliessen({ schluessel, wert: p.wert, modus });
  };

  const liste = s.art === 'ElementListe';
  return (
    <StandardDialog<boolean> titel="Mehrfach ändern" breite="460px" beiKnopf={anwenden}
      knoepfe={[{ text: `${anzahl} ${anzahl === 1 ? 'Zeile' : 'Zeilen'} ändern`, wert: true, primaer: true }, { text: 'Abbrechen', wert: null }]}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-testid="mehrfach-aendern">
        <Text>Setzt den Wert in allen {anzahl} markierten Zeilen. Zeilen, in denen die Spalte nicht änderbar ist, bleiben unverändert.</Text>
        <Field label="Spalte">
          <Select value={schluessel} onChange={(_, d) => setSchluessel(d.value)} aria-label="Spalte">
            {spalten.map((x) => <option key={x.schluessel} value={x.schluessel}>{x.titel}</option>)}
          </Select>
        </Field>
        {liste ? (
          <RadioGroup layout="horizontal" value={modus} onChange={(_, d) => setModus(d.value as MehrfachModus)}>
            <Radio value="ersetzen" label="Ersetzen" />
            <Radio value="hinzufuegen" label="Hinzufügen" />
            <Radio value="entfernen" label="Entfernen" />
          </RadioGroup>
        ) : null}
        <Field label="Neuer Wert" validationMessage={fehler || undefined} validationState={fehler ? 'error' : 'none'}
          hint={s.art === 'Bool' ? undefined : istListenart(s.art) ? 'Liste mit Alt+↓ oder F4 · leer lässt die Spalte leer' : 'leer lässt die Spalte leer'}>
          {s.art === 'Bool' ? (
            <Checkbox label="gesetzt (X)" checked={wert === 'X'} onChange={(_, d) => setWert(d.checked ? 'X' : '')} />
          ) : s.art === 'Auswahl' ? (
            <Select value={wert} onChange={(_, d) => { setWert(d.value); setFehler(null); }} aria-label="Neuer Wert">
              <option value="" />
              {(s.auswahl || []).filter(Boolean).map((a) => <option key={a} value={a}>{a}</option>)}
            </Select>
          ) : (
            <>
              <Input ref={eingabe} key={schluessel} autoFocus autoComplete="off" spellCheck={false} role="combobox" aria-label="Neuer Wert"
                onChange={() => setFehler(null)}
                onKeyDown={(e) => { if (vorschlag.current?.taste(e)) { e.preventDefault(); e.stopPropagation(); } }} />
              <Vorschlagsliste key={`v${schluessel}`} ref={vorschlag} input={eingabe} liste={liste} frei={!istListenart(s.art)}
                optionen={() => (s.art === 'Element' || s.art === 'ElementListe' ? optionen(s) : s.art === 'Auswahl' ? auswahlOptionen(s.auswahl) : werte(s))} />
            </>
          )}
        </Field>
      </div>
    </StandardDialog>
  );
}

export function mehrfachDialog(p: Omit<Props, 'schliessen'>): Promise<MehrfachErgebnis | null> {
  return dialogZeigen<MehrfachErgebnis>((schliessen) => <MehrfachDialog {...p} schliessen={schliessen} />);
}

/** Neuer Wert einer Zeile je Modus (Listen: hinzufügen/entfernen). */
export function mehrfachWert(alt: string, e: MehrfachErgebnis): string {
  if (e.modus === 'ersetzen') return e.wert;
  const teile = alt.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
  const neu = e.wert.split(',').filter(Boolean);
  if (e.modus === 'hinzufuegen') {
    for (const n of neu) if (!teile.some((t) => t.toLowerCase() === n.toLowerCase())) teile.push(n);
    return teile.join(',');
  }
  return teile.filter((t) => !neu.some((n) => n.toLowerCase() === t.toLowerCase())).join(',');
}
