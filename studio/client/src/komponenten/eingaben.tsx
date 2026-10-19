// Eingabebausteine: Datumsfeld (Fluent DatePicker, deutsch, Woche ab Montag, Eingabe „19.10.2026“, „19.10.“, „191026“
// oder per Kalender) und durchsuchbare Auswahl (Fluent Combobox mit Filter – auch in Dialogen, für lange Listen wie
// Lehrkräfte, Klassen oder Gruppen).
import { Combobox, Option, makeStyles, mergeClasses, tokens, type ComboboxProps } from '@fluentui/react-components';
import { DatePicker, type CalendarStrings } from '@fluentui/react-datepicker-compat';
import { useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react';

// ---------------------------------------------------------------------------------------------
// Datum

const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONATE_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const TAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const TAGE_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export const KALENDER_DE: CalendarStrings = {
  months: MONATE,
  shortMonths: MONATE_KURZ,
  days: TAGE,
  shortDays: TAGE_KURZ,
  goToToday: 'Heute',
  prevMonthAriaLabel: 'Vorheriger Monat',
  nextMonthAriaLabel: 'Nächster Monat',
  prevYearAriaLabel: 'Vorheriges Jahr',
  nextYearAriaLabel: 'Nächstes Jahr',
  prevYearRangeAriaLabel: 'Vorherige Jahre',
  nextYearRangeAriaLabel: 'Nächste Jahre',
  monthPickerHeaderAriaLabel: '{0}, Jahr wählen',
  yearPickerHeaderAriaLabel: '{0}, Monat wählen',
  closeButtonAriaLabel: 'Schließen',
  weekNumberFormatString: 'Kalenderwoche {0}',
  selectedDateFormatString: 'Gewählt: {0}',
  todayDateFormatString: 'Heute: {0}',
  dayMarkedAriaLabel: 'markiert',
  isRequiredErrorMessage: 'Bitte ein Datum eingeben.',
  invalidInputErrorMessage: 'Ungültiges Datum (z. B. 19.10.2026).',
  isOutOfBoundsErrorMessage: 'Datum außerhalb des erlaubten Bereichs.',
} as CalendarStrings;

const zwei = (n: number) => String(n).padStart(2, '0');
/** ISO-Datum (yyyy-mm-dd) → lokales Datum. */
export function ausIso(iso: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}
/** Lokales Datum → ISO (yyyy-mm-dd). */
export const alsIso = (d: Date) => `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;

/** „19.10.2026“, „19.10.26“, „19.10.“ (laufendes Jahr), „191026“, „19102026“ oder ISO. */
export function datumLesen(text: string): Date | null {
  const t = text.trim().replace(/^(mo|di|mi|do|fr|sa|so)[a-z]*[,.]?\s*/i, '');
  if (!t) return null;
  const iso = ausIso(t);
  if (iso) return iso;
  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})?$/.exec(t);
  if (!m) {
    const z = /^(\d{2})(\d{2})(\d{2}|\d{4})$/.exec(t);
    if (z) m = z;
  }
  if (!m) return null;
  const tag = Number(m[1]), monat = Number(m[2]);
  let jahr = m[3] ? Number(m[3]) : new Date().getFullYear();
  if (jahr < 100) jahr += 2000;
  const d = new Date(jahr, monat - 1, tag);
  return d.getDate() === tag && d.getMonth() === monat - 1 ? d : null;
}

const formatDatum = (wochentag: boolean) => (d?: Date) => (d ? `${wochentag ? `${TAGE_KURZ[d.getDay()]} ` : ''}${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}.${d.getFullYear()}` : '');

const DATUMSFORMAT = {
  formatDay: (d: Date) => String(d.getDate()),
  formatYear: (d: Date) => String(d.getFullYear()),
  formatMonth: (d: Date) => MONATE[d.getMonth()],
  formatMonthDayYear: (d: Date) => `${d.getDate()}. ${MONATE[d.getMonth()]} ${d.getFullYear()}`,
  formatMonthYear: (d: Date) => `${MONATE[d.getMonth()]} ${d.getFullYear()}`,
};

const useDatumStile = makeStyles({
  klein: { width: '150px' },
  normal: { width: '170px' },
  ohneTag: { width: '130px' },
});

export interface DatumFeldProps {
  /** ISO-Datum (yyyy-mm-dd) oder leer */
  wert: string | null | undefined;
  /** neues ISO-Datum; leer nur, wenn leerErlaubt */
  beiAenderung: (iso: string) => void;
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  /** Wochentag vor dem Datum zeigen (Standard: ja) */
  wochentag?: boolean;
  leerErlaubt?: boolean;
  min?: string;
  max?: string;
  placeholder?: string;
  id?: string;
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
  'data-testid'?: string;
  autoFocus?: boolean;
}

/** Datumsfeld mit Kalender (Fluent DatePicker), deutsches Format, Woche ab Montag mit Kalenderwochen. */
export function DatumFeld({ wert, beiAenderung, size = 'small', disabled, wochentag = true, leerErlaubt, min, max, placeholder, id, className, style, autoFocus, ...rest }: DatumFeldProps) {
  const s = useDatumStile();
  const datum = useMemo(() => ausIso(wert), [wert]);
  const format = useMemo(() => formatDatum(wochentag), [wochentag]);
  return (
    <DatePicker
      id={id}
      size={size}
      value={datum}
      disabled={disabled}
      allowTextInput
      firstDayOfWeek={1}
      firstWeekOfYear={2}
      showWeekNumbers
      showGoToToday
      highlightCurrentMonth
      highlightSelectedMonth
      strings={KALENDER_DE}
      dateTimeFormatter={DATUMSFORMAT}
      formatDate={format}
      parseDateFromString={datumLesen}
      minDate={ausIso(min) ?? undefined}
      maxDate={ausIso(max) ?? undefined}
      placeholder={placeholder ?? 'TT.MM.JJJJ'}
      autoFocus={autoFocus}
      className={mergeClasses(wochentag ? (size === 'small' ? s.klein : s.normal) : s.ohneTag, className)}
      style={style}
      aria-label={rest['aria-label']}
      data-testid={rest['data-testid']}
      data-datum={wert || ''}
      onSelectDate={(d) => {
        if (d) { const iso = alsIso(d); if (iso !== wert) beiAenderung(iso); } else if (leerErlaubt && wert) beiAenderung('');
      }}
    />
  );
}

// ---------------------------------------------------------------------------------------------
// Durchsuchbare Auswahl

export interface AuswahlOption { wert: string; text: string; nebentext?: string; deaktiviert?: boolean }

const useAuswahlStile = makeStyles({
  wurzel: { minWidth: '160px' },
  neben: { color: tokens.colorNeutralForeground3, marginLeft: '8px', fontSize: tokens.fontSizeBase200 },
  liste: { maxHeight: '360px' },
});

const norm = (t: string) => t.toLocaleLowerCase('de').normalize('NFD').replace(/[̀-ͯ]/g, '');

export interface SuchauswahlProps {
  optionen: AuswahlOption[];
  wert: string | null | undefined;
  beiWahl: (wert: string) => void;
  size?: ComboboxProps['size'];
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
  'data-testid'?: string;
  autoFocus?: boolean;
  /** höchstens so viele Treffer zeigen (große Schulen) */
  grenze?: number;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}

/** Auswahlliste mit Suche: Tippen filtert (Kürzel, Name, Nebentext; ohne Groß-/Kleinschreibung und Akzente). */
export function Suchauswahl({ optionen, wert, beiWahl, size = 'small', disabled, placeholder, id, className, style, autoFocus, grenze = 400, onKeyDown, ...rest }: SuchauswahlProps) {
  const s = useAuswahlStile();
  const [suche, setSuche] = useState<string | null>(null);
  const gewaehlt = optionen.find((o) => o.wert === (wert ?? ''));
  const treffer = useMemo(() => {
    if (!suche) return optionen;
    const q = norm(suche.trim());
    const anfang: AuswahlOption[] = [], sonst: AuswahlOption[] = [];
    for (const o of optionen) {
      const t = norm(o.text), n = norm(o.nebentext || '');
      if (t.startsWith(q)) anfang.push(o); else if (t.includes(q) || n.includes(q)) sonst.push(o);
    }
    return [...anfang, ...sonst];
  }, [optionen, suche]);
  return (
    <Combobox
      id={id}
      size={size}
      disabled={disabled}
      autoFocus={autoFocus}
      placeholder={placeholder ?? 'Suchen …'}
      className={mergeClasses(s.wurzel, className)}
      style={style}
      listbox={{ className: s.liste }}
      aria-label={rest['aria-label']}
      data-testid={rest['data-testid']}
      value={suche ?? gewaehlt?.text ?? ''}
      selectedOptions={wert != null && wert !== '' ? [wert] : gewaehlt ? [gewaehlt.wert] : []}
      onChange={(e) => setSuche(e.target.value)}
      onOptionSelect={(_, d) => {
        setSuche(null);
        if (d.optionValue !== undefined && d.optionValue !== '__leer' && d.optionValue !== '__mehr' && d.optionValue !== wert) beiWahl(d.optionValue);
      }}
      onOpenChange={(_, d) => { if (!d.open) setSuche(null); }}
      onKeyDown={onKeyDown}
      onFocus={(e) => (e.target as HTMLInputElement).select?.()}
    >
      {treffer.slice(0, grenze).map((o) => (
        <Option key={o.wert} value={o.wert} text={o.text} disabled={o.deaktiviert}>
          {o.text}{o.nebentext ? <span className={s.neben}>{o.nebentext}</span> : null}
        </Option>
      ))}
      {!treffer.length ? <Option value="__leer" text="" disabled>Keine Treffer</Option> : null}
      {treffer.length > grenze ? <Option value="__mehr" text="" disabled>{`… ${treffer.length - grenze} weitere – bitte genauer suchen`}</Option> : null}
    </Combobox>
  );
}
