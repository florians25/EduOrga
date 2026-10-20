// Dialog „Neuer Unterricht“ (Unterricht, Plantafel): Fach, Klasse(n), Lehrkraft, Stunden je Woche, Doppelstunden bzw. Block,
// Raum oder Raumgruppe, Kopplung (je weitere Lehrkraft eine Kopplungszeile), Woche (jede, A, B), Band und Bemerkung.
// Vorschau „Im Vorrat“ zeigt, als welche Blöcke der Unterricht in der Plantafel erscheint. Server: POST /planung/neuer-unterricht.
import {
  Button, Dropdown, Field, Input, Option, Radio, RadioGroup, makeStyles, mergeClasses, tokens,
} from '@fluentui/react-components';
import { Dismiss16Regular } from '@fluentui/react-icons';
import { useMemo, useState } from 'react';
import { api } from '@/api/client';
import type { ElementOption } from '@/api/typen';
import { elemente } from '@/kern/zustand';
import { StandardDialog, dialogZeigen } from '@/komponenten/dialoge';
import { hinweis } from '@/komponenten/hinweise';
import { SuchAuswahl, type SuchOption } from '@/komponenten/suchauswahl';

const useStile = makeStyles({
  raster: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px 16px', alignItems: 'start' },
  drei: { gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr) minmax(0, 1fr)', gap: '12px 16px', alignItems: 'start' },
  kFuss: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  ganz: { gridColumn: '1 / -1' },
  abschnitt: {
    gridColumn: '1 / -1', margin: '4px 0 0 0', paddingBottom: '4px', fontSize: tokens.fontSizeBase300, fontWeight: tokens.fontWeightSemibold,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, color: tokens.colorNeutralForeground1,
  },
  kopplung: { gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '8px' },
  kZeile: { display: 'grid', gridTemplateColumns: '24px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.4fr) 32px', gap: '8px', alignItems: 'center' },
  kNr: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, fontVariantNumeric: 'tabular-nums', textAlign: 'right' },
  kKopf: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  leise: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  vorschau: {
    gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: '4px 16px', alignItems: 'baseline', padding: '8px 12px',
    backgroundColor: tokens.colorNeutralBackground2, border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusMedium,
    fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2,
  },
  vorschauWert: { color: tokens.colorNeutralForeground1, fontWeight: tokens.fontWeightSemibold },
  fehler: {
    gridColumn: '1 / -1', padding: '8px 12px', border: `1px solid ${tokens.colorNeutralStroke2}`, borderLeft: '3px solid var(--up-entfall)',
    borderRadius: tokens.borderRadiusMedium, backgroundColor: tokens.colorNeutralBackground1, color: tokens.colorNeutralForeground1,
  },
});

/** Vorbelegung: Elemente (Ids) aus der aufrufenden Ansicht. */
export interface NeuerUnterrichtVorgabe { klasse?: number | null; lehrer?: number | null; fach?: number | null }
export interface NeuerUnterrichtErgebnis { id: number; text: string; offen: number[] }

interface Kopplung { lehrer: string; fach: string; klassen: string }

const DOPPEL: { wert: string; text: string }[] = [
  { wert: 'fach', text: 'Wie beim Fach' },
  { wert: '', text: 'Keine Vorgabe' },
  { wert: '1-1', text: 'Genau eine' },
  { wert: '0-1', text: 'Höchstens eine' },
  { wert: '1-2', text: 'Eine oder zwei' },
  { wert: '2-2', text: 'Genau zwei' },
  { wert: 'alle', text: 'Nur Doppelstunden' },
];

const optionen = (l: ElementOption[]): SuchOption[] => l.map((e) => ({ wert: String(e.id), kurz: e.k, text: e.l && e.l !== e.k ? `${e.k} – ${e.l}` : e.k }));
/** Mehrfachauswahl zeigt die Werte selbst: Klassen daher als Kurznamen (Wert = Kurzname). */
const kurzOptionen = (l: ElementOption[]): SuchOption[] => l.map((e) => ({ wert: e.k, kurz: e.k, text: e.l && e.l !== e.k ? `${e.k} – ${e.l}` : e.k }));

/** Blöcke im Vorrat wie Unterricht.Bloecke(): Blöcke laut Eingabe, dann Doppelstunden (Minimum), Rest Einzelstunden. */
export function vorratBloecke(wst: number, doppelMin: number, block: string): number[] {
  const erg: number[] = [];
  let rest = wst;
  for (const t of block.split(/[,; ]+/).filter(Boolean)) {
    const b = Number(t);
    if (Number.isInteger(b) && b >= 2 && b <= rest) { erg.push(b); rest -= b; }
  }
  const d = Math.min(doppelMin, Math.floor(rest / 2));
  for (let i = 0; i < d; i++) { erg.push(2); rest -= 2; }
  for (let i = 0; i < rest; i++) erg.push(1);
  return erg;
}

export function bloeckeText(b: number[]): string {
  const n = (l: number) => b.filter((x) => x === l).length;
  const teile: string[] = [];
  for (const l of [...new Set(b)].sort((x, y) => y - x)) {
    const k = n(l);
    teile.push(l === 1 ? `${k} ${k === 1 ? 'Einzelstunde' : 'Einzelstunden'}` : l === 2 ? `${k} ${k === 1 ? 'Doppelstunde' : 'Doppelstunden'}` : `${k} × ${l}er-Block`);
  }
  return teile.join(', ') || 'keine Stunden';
}

function Inhalt({ vorgabe, listen, schliessen }: {
  vorgabe: NeuerUnterrichtVorgabe;
  listen: { fach: ElementOption[]; klasse: ElementOption[]; lehrer: ElementOption[]; raum: ElementOption[]; raumgruppe: ElementOption[] };
  schliessen: (w: NeuerUnterrichtErgebnis & { weiter?: boolean } | null) => void;
}) {
  const s = useStile();
  const [fach, setFach] = useState(vorgabe.fach ? String(vorgabe.fach) : '');
  const [klassen, setKlassen] = useState(vorgabe.klasse ? listen.klasse.find((k) => k.id === vorgabe.klasse)?.k ?? '' : '');
  const [lehrer, setLehrer] = useState(vorgabe.lehrer ? String(vorgabe.lehrer) : '');
  const [raum, setRaum] = useState('');
  const [wst, setWst] = useState('2');
  const [doppel, setDoppel] = useState('fach');
  const [block, setBlock] = useState('');
  const [woche, setWoche] = useState('');
  const [band, setBand] = useState('');
  const [text, setText] = useState('');
  const [kopplung, setKopplung] = useState<Kopplung[]>([]);
  const [geprueft, setGeprueft] = useState(false);
  const [serverFehler, setServerFehler] = useState<string | null>(null);
  const [sendet, setSendet] = useState(false);

  const fachO = useMemo(() => optionen(listen.fach), [listen.fach]);
  const klasseO = useMemo(() => kurzOptionen(listen.klasse), [listen.klasse]);
  const kIds = (w: string) => w.split(',').map((x) => x.trim()).filter(Boolean).map((k) => listen.klasse.find((e) => e.k === k)?.id).filter((x): x is number => x != null);
  const lehrerO = useMemo(() => optionen(listen.lehrer), [listen.lehrer]);
  const raumO = useMemo<SuchOption[]>(() => [
    ...optionen(listen.raum).map((o) => ({ ...o, wert: `r${o.wert}` })),
    ...listen.raumgruppe.map((g) => ({ wert: `g${g.id}`, kurz: g.k, text: `${g.k} – Raumgruppe${g.l && g.l !== g.k ? ` ${g.l}` : ''}` })),
  ], [listen.raum, listen.raumgruppe]);

  const stunden = Number(wst);
  const stundenOk = Number.isInteger(stunden) && stunden >= 1 && stunden <= 60;
  const blockOk = !block.trim() || block.split(/[,; ]+/).filter(Boolean).every((t) => /^\d+$/.test(t) && Number(t) >= 2 && Number(t) <= 10);
  const blockSumme = block.split(/[,; ]+/).filter(Boolean).reduce((x, t) => x + (Number(t) || 0), 0);
  const doppelBereich = doppel === 'alle' ? `${Math.floor((stundenOk ? stunden : 0) / 2)}-${Math.floor((stundenOk ? stunden : 0) / 2)}` : doppel;
  const doppelMin = doppel === 'fach' || doppel === '' ? 0 : Number(doppelBereich.split('-')[0]) || 0;
  const fehler = {
    fach: !fach && !kopplung.some((k) => k.fach) ? 'Bitte ein Fach wählen.' : undefined,
    klassen: !kIds(klassen).length && !kopplung.some((k) => kIds(k.klassen).length) ? 'Bitte mindestens eine Klasse wählen.' : undefined,
    wst: !stundenOk ? 'Bitte 1 bis 60 Stunden.' : undefined,
    block: !blockOk ? 'Blockgrößen 2 bis 10, mehrere durch Komma (z. B. 3 oder 3,3).' : stundenOk && blockSumme > stunden ? `Blöcke (${blockSumme}) länger als ${stunden} Stunden.` : undefined,
    doppel: stundenOk && blockSumme + 2 * doppelMin > stunden ? `${doppelMin} Doppelstunden passen nicht in ${stunden} Stunden.` : undefined,
  };
  const ungueltig = Object.values(fehler).some(Boolean);
  const zeige = (f?: string) => (geprueft ? f : undefined);
  const bloecke = stundenOk && !fehler.block && !fehler.doppel ? vorratBloecke(stunden, doppelMin, block) : [];
  const lehrkraefte = [lehrer, ...kopplung.map((k) => k.lehrer)].filter(Boolean);

  const anlegen = async (weiter: boolean) => {
    setGeprueft(true);
    if (ungueltig || sendet) return;
    setSendet(true);
    setServerFehler(null);
    const r = raum.startsWith('r') ? { raum: Number(raum.slice(1)) } : raum.startsWith('g') ? { raumgruppe: Number(raum.slice(1)) } : {};
    const zeilen = [
      { fach: fach ? Number(fach) : null, lehrer: lehrer ? Number(lehrer) : null, klassen: kIds(klassen), ...r },
      ...kopplung.map((k) => ({ fach: k.fach ? Number(k.fach) : fach ? Number(fach) : null, lehrer: k.lehrer ? Number(k.lehrer) : null, klassen: k.klassen ? kIds(k.klassen) : kIds(klassen), ...r })),
    ];
    try {
      const erg = await api.post<NeuerUnterrichtErgebnis>(api.dok('/planung/neuer-unterricht'), {
        wochenstunden: stunden, zeilen, doppelstunden: doppel === 'fach' ? null : doppelBereich, block: block.trim(), woche, band: band.trim(), text: text.trim(),
      });
      schliessen({ ...erg, weiter });
    } catch (e) {
      setServerFehler((e as Error).message || String(e));
    } finally {
      setSendet(false);
    }
  };

  const kSetzen = (i: number, teil: Partial<Kopplung>) => setKopplung((l) => l.map((k, j) => (j === i ? { ...k, ...teil } : k)));

  return (
    <StandardDialog<string> titel="Neuer Unterricht" breite="min(760px, 96vw)"
      knoepfe={[{ text: 'Anlegen', wert: 'anlegen', primaer: true, deaktiviert: sendet }, { text: 'Anlegen und neu', wert: 'weiter', deaktiviert: sendet }, { text: 'Abbrechen', wert: null }]}
      beiKnopf={(w) => { if (!w) schliessen(null); else void anlegen(w === 'weiter'); }}>
      <div className={s.raster} data-testid="neuer-unterricht">
        {serverFehler ? <div className={s.fehler} role="alert">{serverFehler}</div> : null}
        <Field label="Fach" required validationMessage={zeige(fehler.fach)}>
          <SuchAuswahl ariaLabel="Fach" name="fach" autoFocus wert={fach} beiWahl={setFach} optionen={fachO} platzhalter="Fach suchen" />
        </Field>
        <Field label="Klasse(n)" required validationMessage={zeige(fehler.klassen)}>
          <SuchAuswahl ariaLabel="Klassen" name="klassen" mehrfach wert={klassen} beiWahl={setKlassen} optionen={klasseO} platzhalter="Klassen suchen" />
        </Field>
        <Field label="Lehrkraft">
          <SuchAuswahl ariaLabel="Lehrkraft" name="lehrer" wert={lehrer} beiWahl={setLehrer} optionen={lehrerO} platzhalter="Lehrkraft suchen" />
        </Field>
        <Field label="Raum oder Raumgruppe" hint="Leer: Fachraum laut Fach, sonst Stammraum der Klasse">
          <SuchAuswahl ariaLabel="Raum" name="raum" wert={raum} beiWahl={setRaum} optionen={raumO} platzhalter="Raum suchen" />
        </Field>

        <div className={s.kopplung}>
          {kopplung.length ? (
            <div className={s.kZeile} aria-hidden>
              <span /><span className={s.kKopf}>Gekoppelte Lehrkraft</span><span className={s.kKopf}>Fach (leer: wie oben)</span><span className={s.kKopf}>Klassen (leer: wie oben)</span><span />
            </div>
          ) : null}
          {kopplung.map((k, i) => (
            <div key={i} className={s.kZeile} data-kopplung={i}>
              <span className={s.kNr}>{i + 2}</span>
              <SuchAuswahl ariaLabel={`Lehrkraft der Kopplungszeile ${i + 2}`} wert={k.lehrer} beiWahl={(w) => kSetzen(i, { lehrer: w })} optionen={lehrerO} platzhalter="Lehrkraft" />
              <SuchAuswahl ariaLabel={`Fach der Kopplungszeile ${i + 2}`} wert={k.fach} beiWahl={(w) => kSetzen(i, { fach: w })} optionen={fachO} platzhalter="wie oben" />
              <SuchAuswahl ariaLabel={`Klassen der Kopplungszeile ${i + 2}`} mehrfach wert={k.klassen} beiWahl={(w) => kSetzen(i, { klassen: w })} optionen={klasseO} platzhalter="wie oben" />
              <Button appearance="subtle" icon={<Dismiss16Regular />} aria-label={`Kopplungszeile ${i + 2} entfernen`} onClick={() => setKopplung((l) => l.filter((_, j) => j !== i))} />
            </div>
          ))}
          <div className={s.kFuss}>
            <Button size="small" onClick={() => setKopplung((l) => [...l, { lehrer: '', fach: '', klassen: '' }])}>Lehrkraft koppeln</Button>
            <span className={s.leise}>Gekoppelte Lehrkräfte unterrichten gleichzeitig (Teilung, Religion/Ethik); verplant wird ein gemeinsamer Block.</span>
          </div>
        </div>

        <h3 className={s.abschnitt}>Verteilung</h3>
        <div className={s.drei}>
          <Field label="Stunden je Woche" required validationMessage={zeige(fehler.wst)}>
            <Input name="wochenstunden" type="number" min={1} max={60} value={wst} onChange={(_, d) => setWst(d.value)} />
          </Field>
          <Field label="Doppelstunden" validationMessage={zeige(fehler.doppel)}>
            <Dropdown aria-label="Doppelstunden" value={DOPPEL.find((d) => d.wert === doppel)?.text} selectedOptions={[doppel]} onOptionSelect={(_, d) => setDoppel(d.optionValue ?? 'fach')}>
              {DOPPEL.map((d) => <Option key={d.wert || 'leer'} value={d.wert}>{d.text}</Option>)}
            </Dropdown>
          </Field>
          <Field label="Block" validationMessage={zeige(fehler.block)}>
            <Input name="block" value={block} onChange={(_, d) => setBlock(d.value)} placeholder="z. B. 3 oder 3,3" />
          </Field>
        </div>
        <Field label="Woche">
          <RadioGroup layout="horizontal" value={woche} onChange={(_, d) => setWoche(d.value)} aria-label="Woche">
            <Radio value="" label="Jede Woche" />
            <Radio value="A" label="A-Woche" />
            <Radio value="B" label="B-Woche" />
          </RadioGroup>
        </Field>
        <Field label="Band" hint="Gleiches Band: liegen gleichzeitig">
          <Input name="band" value={band} onChange={(_, d) => setBand(d.value)} />
        </Field>
        <Field className={s.ganz} label="Bemerkung">
          <Input name="text" value={text} onChange={(_, d) => setText(d.value)} />
        </Field>

        <div className={mergeClasses(s.vorschau)} data-testid="vorschau">
          <span>Im Vorrat der Plantafel: <span className={s.vorschauWert}>{doppel === 'fach' && !block.trim() ? `${stundenOk ? stunden : 0} Stunden, Doppelstunden laut Fach` : bloeckeText(bloecke)}</span></span>
          {kIds(klassen).length ? <span>Klassen <span className={s.vorschauWert}>{klassen.split(',').map((x) => x.trim()).filter(Boolean).join(', ')}</span></span> : null}
          {lehrkraefte.length > 1 ? <span>gekoppelt: <span className={s.vorschauWert}>{lehrkraefte.map((l) => listen.lehrer.find((e) => e.id === Number(l))?.k).join(', ')}</span></span> : null}
          {woche ? <span>nur in der <span className={s.vorschauWert}>{woche}-Woche</span></span> : null}
        </div>
      </div>
    </StandardDialog>
  );
}

/**
 * Dialog „Neuer Unterricht“; legt den Unterricht an und liefert ihn (Nummer, Text, offene Blöcke) bzw. null.
 * „Anlegen und neu“ öffnet den Dialog erneut mit derselben Vorbelegung.
 */
export async function neuerUnterrichtDialog(vorgabe: NeuerUnterrichtVorgabe = {}): Promise<NeuerUnterrichtErgebnis | null> {
  const [fach, klasse, lehrer, raum, raumgruppe] = await Promise.all(['fach', 'klasse', 'lehrer', 'raum', 'raumgruppe'].map((t) => elemente(t).catch(() => [] as ElementOption[])));
  const listen = { fach: fach!, klasse: klasse!, lehrer: lehrer!, raum: raum!, raumgruppe: raumgruppe! };
  let letztes: NeuerUnterrichtErgebnis | null = null;
  for (;;) {
    const erg = await dialogZeigen<NeuerUnterrichtErgebnis & { weiter?: boolean }>((schliessen) => <Inhalt vorgabe={vorgabe} listen={listen} schliessen={schliessen} />);
    if (!erg) return letztes;
    letztes = { id: erg.id, text: erg.text, offen: erg.offen };
    hinweis(`Unterricht Nr. ${erg.id} angelegt (${erg.text}) – ${bloeckeText(erg.offen)} im Vorrat der Plantafel. Strg+Z macht es rückgängig.`, 'ok', 4000);
    if (!erg.weiter) return letztes;
  }
}

/** Befehl „planung.neuerUnterricht“ (Befehlssuche, Tests). */
export const befehlNeuerUnterricht = (args: NeuerUnterrichtVorgabe = {}) => neuerUnterrichtDialog(args);
