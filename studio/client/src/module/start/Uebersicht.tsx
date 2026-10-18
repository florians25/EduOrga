// Übersicht der Schuldatei: Kennzahlen, Planqualität (Kennzahlen der Optimierung) und häufige Aufgaben.
import { Badge, Button, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { ArrowClockwise20Regular, ChevronRight20Regular } from '@fluentui/react-icons';
import { api } from '@/api/client';
import { arbeitsplatzOeffnen, befehl, seiteOeffnen, type Params } from '@/kern/befehle';
import { datumDe } from '@/kern/hilfen';
import { useDaten } from '@/kern/laden';
import { modusSetzen, useStudio } from '@/kern/zustand';
import { AnsichtRahmen, Werkzeug } from '@/komponenten/ansicht';

const KENNZAHLEN: [string, string][] = [
  ['kollisionen', 'Kollisionen'], ['nichtVerplant', 'Nicht verplante Stunden'], ['ohneRaum', 'Stunden ohne Raum'],
  ['hohlstundenKlassen', 'Hohlstunden Klassen'], ['hohlstundenLehrer', 'Hohlstunden Lehrkräfte'], ['kernzeitverletzungen', 'Kernzeitverletzungen'],
  ['zeitwunschverletzungen', 'Zeitwunschverletzungen'], ['doppelstundenfehler', 'Doppelstundenfehler'], ['fachZweimalTag', 'Fach zweimal am Tag'],
];

const useStile = makeStyles({
  seite: { padding: '8px 20px 32px 20px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1180px' },
  meta: { display: 'flex', gap: '16px', flexWrap: 'wrap', color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  zahlen: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge, overflow: 'hidden', backgroundColor: tokens.colorNeutralBackground1,
  },
  zahl: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', padding: '14px 16px', border: 'none', textAlign: 'left',
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`, background: 'none', cursor: 'pointer', fontFamily: 'inherit', color: tokens.colorNeutralForeground1,
    ':hover': { backgroundColor: tokens.colorNeutralBackground1Hover },
    ':last-child': { borderRight: 'none' },
  },
  wert: { fontSize: '24px', lineHeight: '32px', fontWeight: tokens.fontWeightSemibold, fontVariantNumeric: 'tabular-nums' },
  zahlText: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  spalten: { display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: '20px', '@media (max-width: 1000px)': { gridTemplateColumns: '1fr' } },
  karte: { border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusLarge, backgroundColor: tokens.colorNeutralBackground1, display: 'flex', flexDirection: 'column' },
  karteKopf: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` },
  h2: { margin: 0, fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold, flex: 1 },
  bewertung: { display: 'flex', alignItems: 'baseline', gap: '10px', padding: '12px 16px 4px 16px', color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  bewertungZahl: { fontSize: '20px', fontWeight: tokens.fontWeightSemibold, color: tokens.colorNeutralForeground1, fontVariantNumeric: 'tabular-nums' },
  kz: { display: 'flex', justifyContent: 'space-between', padding: '7px 16px', borderBottom: `1px solid ${tokens.colorNeutralStroke3}`, ':last-child': { borderBottom: 'none' } },
  kzWert: { fontVariantNumeric: 'tabular-nums', fontWeight: tokens.fontWeightSemibold },
  achtung: { color: tokens.colorPaletteMarigoldForeground2 },
  karteFuss: { display: 'flex', gap: '8px', padding: '12px 16px', borderTop: `1px solid ${tokens.colorNeutralStroke2}`, marginTop: 'auto' },
  aktion: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', border: 'none', background: 'none',
    borderBottom: `1px solid ${tokens.colorNeutralStroke3}`, cursor: 'pointer', fontFamily: 'inherit', fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1, textAlign: 'left', ':hover': { backgroundColor: tokens.colorNeutralBackground1Hover }, ':last-child': { borderBottom: 'none' },
  },
});

export default function Uebersicht() {
  const s = useStile();
  const d = useStudio((x) => x.dokument);
  const { daten: k, neuLaden } = useDaten(() => api.get<Record<string, number>>(api.dok('/optimierung/kennzahlen')).catch(() => ({} as Record<string, number>)), [],
    { bereiche: ['Stammdaten', 'Unterricht', 'Stundenplan', 'Einstellungen'] });
  if (!d) return null;
  const z = d.zaehler || {};
  const kz = k || {};
  const offen = KENNZAHLEN.filter(([x]) => (kz[x] ?? 0) > 0).length;
  const seite = (typ: string, p?: Params) => () => seiteOeffnen(typ, p);
  const zahl = (wert: number | undefined, text: string, f: () => void) => (
    <button type="button" className={s.zahl} onClick={f}><span className={s.wert}>{String(wert ?? '–')}</span><span className={s.zahlText}>{text}</span></button>
  );
  const aktion = (text: string, f: () => unknown) => <button type="button" className={s.aktion} onClick={() => void f()}><span>{text}</span><ChevronRight20Regular /></button>;
  return (
    <AnsichtRahmen titel={d.schulname || d.name} rollen werkzeuge={<Werkzeug text="Aktualisieren" icon={<ArrowClockwise20Regular />} aktion={() => neuLaden()} />}>
      <div className={s.seite}>
        <div className={s.meta}>
          {[d.schuljahr && `Schuljahr ${d.schuljahr}`, d.periode && `${d.periode}${d.periodeFixiert ? ' (fixiert)' : ''}`,
            d.geaendert ? 'Nicht gespeicherte Änderungen' : d.gespeichert ? `Gespeichert ${datumDe(d.gespeichert)}` : null].filter(Boolean).map((t) => <span key={String(t)}>{t}</span>)}
        </div>
        <div className={s.zahlen}>
          {zahl(z.klassen, 'Klassen', seite('stammdaten', { typ: 'klasse' }))}
          {zahl(z.lehrer, 'Lehrkräfte', seite('stammdaten', { typ: 'lehrer' }))}
          {zahl(z.raeume, 'Räume', seite('stammdaten', { typ: 'raum' }))}
          {zahl(z.faecher, 'Fächer', seite('stammdaten', { typ: 'fach' }))}
          {zahl(z.unterrichte, 'Unterrichte', seite('unterricht', { sicht: 'alle' }))}
          {zahl(z.planstunden, 'Planstunden', seite('stundenplan', { typ: 'klasse' }))}
        </div>
        <div className={s.spalten}>
          <section className={s.karte}>
            <div className={s.karteKopf}>
              <h2 className={s.h2}>Planqualität</h2>
              <Badge appearance="tint" color={offen ? 'warning' : 'success'}>{offen ? `${offen} Hinweise` : 'Ohne Befund'}</Badge>
            </div>
            {kz.bewertung !== undefined ? <div className={s.bewertung}><span>Bewertungszahl</span><span className={s.bewertungZahl}>{kz.bewertung}</span><span>kleiner ist besser</span></div> : null}
            <div>
              {KENNZAHLEN.map(([x, t]) => (
                <div key={x} className={mergeClasses(s.kz, (kz[x] ?? 0) > 0 && s.achtung)}><span>{t}</span><span className={s.kzWert}>{kz[x] ?? 0}</span></div>
              ))}
            </div>
            <div className={s.karteFuss}>
              <Button size="small" onClick={() => void befehl('optimierung.diagnose')}>Diagnose öffnen</Button>
              <Button size="small" onClick={() => void befehl('optimierung.starten')}>Automatische Planung …</Button>
            </div>
          </section>
          <section className={s.karte}>
            <div className={s.karteKopf}><h2 className={s.h2}>Häufige Aufgaben</h2></div>
            {aktion('Unterricht nach Klassen', seite('unterricht', { sicht: 'klasse' }))}
            {aktion('Manuell planen', () => arbeitsplatzOeffnen('manuell'))}
            {aktion('Zeitwünsche der Lehrkräfte', seite('zeitwuensche', { typ: 'lehrer' }))}
            {aktion('Gesamtübersicht Klassen', seite('uebersicht', { typ: 'klasse' }))}
            {aktion('Vertretungsplanung', () => { modusSetzen('vertretung'); arbeitsplatzOeffnen('tagesplanung'); })}
            {aktion('Stundenpläne drucken', () => befehl('druck.stundenplaene', { typ: 'klasse' }))}
            {aktion('An UntPlan Web übertragen', () => befehl('untplanweb.oeffnen'))}
          </section>
        </div>
      </div>
    </AnsichtRahmen>
  );
}
