// Durchsuchbare Auswahl (Fluent Combobox): Tippen filtert die Liste (Kurzname beginnt mit …, dann Text enthält …), übernommen
// werden nur Einträge der Liste – freie Eingaben sind nicht möglich. Einzeln oder mehrfach (Werte durch Komma getrennt).
import { Combobox, Option, type ComboboxProps } from '@fluentui/react-components';
import { useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react';

export interface SuchOption { wert: string; text: string; /** Kurzform für die Suche (z. B. Kurzname) */ kurz?: string }

interface Props {
  optionen: SuchOption[];
  /** gewählter Wert (mehrfach: durch Komma getrennt) */
  wert: string;
  beiWahl: (wert: string) => void;
  mehrfach?: boolean;
  id?: string;
  name?: string;
  size?: ComboboxProps['size'];
  className?: string;
  autoFocus?: boolean;
  platzhalter?: string;
  ariaLabel?: string;
  beiTaste?: (e: KeyboardEvent<HTMLInputElement>) => void;
  /** höchstens so viele Treffer zeigen */
  max?: number;
  disabled?: boolean;
  title?: string;
  /** feste Breite in px (Standard: Breite der Fluent-Combobox bzw. über className/style) */
  breite?: number;
  style?: CSSProperties;
}

const teile = (w: string) => w.split(/[,;]/).map((x) => x.trim()).filter(Boolean);

export function suchTreffer(optionen: SuchOption[], suche: string, max = 300): SuchOption[] {
  const t = suche.trim().toLowerCase();
  if (!t) return optionen.slice(0, max);
  const a: SuchOption[] = [], b: SuchOption[] = [], c: SuchOption[] = [];
  for (const o of optionen) {
    const k = (o.kurz ?? o.wert).toLowerCase(), x = o.text.toLowerCase();
    if (k === t) a.unshift(o);
    else if (k.startsWith(t)) a.push(o);
    else if (x.startsWith(t) || x.split(/[\s,–-]+/).some((w) => w.startsWith(t))) b.push(o);
    else if (x.includes(t) || k.includes(t)) c.push(o);
  }
  return [...a, ...b, ...c].slice(0, max);
}

export function SuchAuswahl({ optionen, wert, beiWahl, mehrfach = false, id, name, size, className, autoFocus, platzhalter, ariaLabel, beiTaste, max = 300, disabled, title, breite, style }: Props) {
  const [suche, setSuche] = useState<string | null>(null);
  const gewaehlt = useMemo(() => (mehrfach ? teile(wert) : wert ? [wert] : []), [wert, mehrfach]);
  const anzeige = mehrfach
    ? gewaehlt.join(', ')
    : optionen.find((o) => o.wert === wert)?.text ?? wert;
  const treffer = suchTreffer(optionen, suche ?? '', max);
  return (
    <Combobox id={id} name={name} size={size} className={className} autoFocus={autoFocus} placeholder={platzhalter} aria-label={ariaLabel}
      disabled={disabled} title={title} style={breite ? { minWidth: breite, width: breite, ...style } : style}
      multiselect={mehrfach} freeform={false} clearable={false}
      value={suche ?? anzeige} selectedOptions={gewaehlt}
      onInput={(e) => setSuche((e.target as HTMLInputElement).value)}
      onOpenChange={(_, d) => { if (!d.open) setSuche(null); }}
      onBlur={() => setSuche(null)}
      onKeyDown={beiTaste}
      onOptionSelect={(_, d) => {
        if (mehrfach) beiWahl(d.selectedOptions.filter((x) => x !== '__leer').join(','));
        else if (d.optionValue !== undefined && d.optionValue !== '__leer') beiWahl(d.optionValue);
        if (!mehrfach) setSuche(null);
      }}>
      {treffer.map((o) => <Option key={o.wert || '__leerwert'} value={o.wert} text={o.text || ' '}>{o.text || '–'}</Option>)}
      {!treffer.length ? <Option key="__leer" value="__leer" text="" disabled>Kein passender Eintrag</Option> : null}
    </Combobox>
  );
}
