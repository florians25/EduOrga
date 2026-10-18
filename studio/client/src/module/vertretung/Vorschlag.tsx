// Vertretungsvorschlag: folgt der markierten Vertretung. Kopf „30.8. Mo-1 Se/Mu/05D“ mit Status (Details aufklappbar),
// Optionen in einer aufklappbaren Fläche (Stundenblock, Wegzeiten ignorieren, Dauervertretung, danach nächste offene …),
// Reiter Lehrkräfte / Betreuungen / Räume / Vorziehungen mit Anzahlen – zuerst die besten Vorschläge, der Rest aufklappbar.
// Übernehmen (bzw. Vorziehen) per Doppelklick, Enter oder Knopf; danach wahlweise zur nächsten offenen.
import { Button, Switch, Tab, TabList, makeStyles, tokens } from '@fluentui/react-components';
import { ChevronDown16Regular, ChevronRight16Regular } from '@fluentui/react-icons';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { api } from '@/api/client';
import { useAnsicht } from '@/kern/ansichten';
import { betrifft, melden, useEreignis, type VertretungsAuswahl } from '@/kern/ereignisse';
import { useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, Leer, Trenner, Werkzeug } from '@/komponenten/ansicht';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { Tabelle, type Spalte, type TabelleApi } from '@/komponenten/tabelle/Tabelle';
import { aktuelleAuswahl, mitRueckfragen, vpfad } from './kern';
import { OptionenKnopf, OptionenTitel } from './steuer';
import { einstellungenDialog } from './weitere';
import './vertretung.css';

const useStile = makeStyles({
  kopf: { padding: '8px 12px 6px 12px', borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, display: 'flex', flexDirection: 'column', gap: '2px' },
  kopfZeile: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 },
  kopfText: { fontWeight: tokens.fontWeightSemibold, fontSize: tokens.fontSizeBase400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  mehr: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, whiteSpace: 'nowrap' },
  klapp: { justifyContent: 'flex-start', fontWeight: tokens.fontWeightSemibold, padding: '2px 4px', minWidth: 0 },
  detailKnopf: { marginLeft: 'auto', minWidth: 0, flexShrink: 0 },
  details: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2, padding: '2px 0 2px 0' },
  reiterZeile: { display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px', borderBottom: `1px solid ${tokens.colorNeutralStroke3}` },
  reiter: { flex: 1, minWidth: 0, overflowX: 'auto' },
  alle: { flexShrink: 0, minWidth: 0 },
  flaeche: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
});

interface Mini { text: string; farbe?: string | null; entfallen?: boolean; ziel?: boolean }
type K = Record<string, any> & { s?: Mini[] };
interface VorschlagDaten { kopf: string; details: string; offen: boolean; raumOffen: boolean; optionen: { block: boolean; disloz: boolean; dauer: boolean }; kandidaten: K[]; betreuungen: K[]; raeume: K[]; vorziehungen: K[] }

/** Belastung zur Stunde: 0–3 unauffällig, 4–6 leicht, 7–8 deutlich, ab 9 hoch; Bereitschaft (Fachkürzel) als verfügbar. */
function belastung(m: string) {
  if (!m || m === 'x') return null;
  const n = Number(m);
  if (Number.isNaN(n)) return 'vt-m-bereit';
  if (n >= 9) return 'vt-m-hoch';
  if (n >= 7) return 'vt-m-mittel';
  if (n >= 4) return 'vt-m-leicht';
  return null;
}

const MINI: [string, string][] = [['davor', 'Unterricht der Lehrkraft in der Stunde davor'], ['Std.', 'Unterricht der Lehrkraft in dieser Stunde'], ['danach', 'Unterricht der Lehrkraft in der Stunde danach']];
const mini = (i: number): Spalte<K> => ({
  schluessel: `s${i}`, titel: MINI[i]![0], hinweis: MINI[i]![1], breite: 58, art: 'NurLesen', ausrichtung: 'mitte',
  wert: (k) => k.s?.[i]?.text ?? '',
  farbe: (k) => { const z = k.s?.[i]; return z?.farbe && !z.entfallen ? `color-mix(in srgb, ${z.farbe} 20%, var(--colorNeutralBackground1))` : null; },
  klasse: (k) => { const z = k.s?.[i]; return z ? `vt-mini${z.entfallen ? ' entfallen' : ''}${z.ziel ? ' ziel' : ''}` : null; },
});
const sp = (schluessel: string, titel: string, breite: number, extra: Partial<Spalte<K>> = {}): Spalte<K> => ({ schluessel, titel, breite, art: 'NurLesen', ...extra });

const KANDIDATEN: Spalte<K>[] = [
  sp('name', 'Name', 80, { klasse: (k) => `${k.rot ? 'vt-rot' : ''}${k.benachrichtigen ? ' fett' : ''}`.trim() || null }), mini(0), mini(1), mini(2),
  sp('merker', 'Belastung', 76, { hinweis: 'Belastung zur Stunde (0 günstig bis 9 ungünstig) bzw. Bereitschaft', klasse: (k) => belastung(k.merker) }),
  sp('vertr', 'Vertr.', 56, { ausrichtung: 'rechts', hinweis: 'Vertretungen im Durchrechnungszeitraum' }), sp('entf', 'Entfall', 56, { ausrichtung: 'rechts', standard: false }),
  sp('zaehler', 'Zähler', 60, { ausrichtung: 'rechts', hinweis: 'Vertretungszähler', klasse: (k) => (Number(k.zaehlerWert) > 0 ? 'vt-warn' : null) }),
  sp('zw', 'Zeitwunsch', 80, { ausrichtung: 'mitte', standard: false }), sp('jahr', 'Jahressaldo', 84, { ausrichtung: 'rechts', standard: false }),
  sp('kennz', 'Kennz.', 56, { ausrichtung: 'mitte', hinweis: 'Kennzeichen der Lehrkraft', wert: (k) => (k.kennz ? 'K' : ''), standard: false }),
  sp('regB', 'Bereitschaft', 86, { ausrichtung: 'mitte', hinweis: 'Regelmäßige Bereitschaft', standard: false }), sp('dep', 'Konto', 60, { ausrichtung: 'rechts', hinweis: 'Stundenkonto', standard: false }),
  sp('fach', 'Fach', 48, { art: 'Haken', hinweis: 'Lehrkraft unterrichtet das Fach' }), sp('klasse', 'Klasse', 56, { ausrichtung: 'mitte', hinweis: 'Lehrkraft unterrichtet die Klasse', standard: false }),
  sp('stdTag', 'Std./Tag', 64, { ausrichtung: 'rechts', standard: false }), sp('woche', 'Woche', 56, { ausrichtung: 'rechts', standard: false }), sp('monat', 'Monat', 56, { ausrichtung: 'rechts', standard: false }),
  sp('punkte', 'Punkte', 60, { ausrichtung: 'rechts', standard: false }), sp('kriterien', 'Kriterien', 260),
];
/** So viele Vorschläge je Reiter zuerst (die besten); der Rest lässt sich aufklappen. */
const BESTE = 5;
const BETREUUNGEN: Spalte<K>[] = [
  sp('name', 'Name', 80), mini(0), mini(1), mini(2), sp('raum', 'Raum', 60), sp('klasse', 'Klasse', 60), sp('fach', 'Fach', 56),
  sp('zaehler', 'Zähler', 60, { ausrichtung: 'rechts', klasse: (k) => (Number(k.zaehlerWert) > 0 ? 'vt-warn' : null) }), sp('zw', 'Zeitwunsch', 80, { ausrichtung: 'mitte' }),
  sp('jahr', 'Jahressaldo', 84, { ausrichtung: 'rechts' }), sp('kennz', 'Kennz.', 56, { ausrichtung: 'mitte', wert: (k) => (k.kennz ? 'K' : '') }),
  sp('kopplung', 'Gekoppelt', 76, { art: 'Haken' }), sp('naehe', 'Nähe', 110), sp('heute', 'Heute', 56, { ausrichtung: 'rechts', hinweis: 'Betreuungen heute' }),
];
const RAEUME: Spalte<K>[] = [
  sp('name', 'Raum', 76), sp('kap', 'Plätze', 60, { ausrichtung: 'rechts' }), sp('ar', 'Ausweichraum', 100, { art: 'Haken' }), sp('sr', 'Ausweich-Fachraum', 124, { art: 'Haken' }),
  sp('belegt', 'Belegt', 70, { wert: (r) => (r.gesperrt ? 'gesperrt' : r.besetzt ? 'belegt' : '') }), sp('rg', 'Raumgruppen', 100), sp('gang', 'Bereich', 76), sp('belegung', 'Belegung', 240),
];
const VORZIEHUNGEN: Spalte<K>[] = [
  sp('lehrer', 'Lehrkraft', 80), sp('tag', 'Tag', 84), sp('stunde', 'Std.', 48, { ausrichtung: 'rechts' }), sp('klassen', 'Klasse', 64), sp('fach', 'Fach', 60), sp('raum', 'Raum', 56),
  sp('art', 'Art', 200),
];

export default function Vorschlag() {
  const s = useStile();
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const [auswahl, setAuswahl] = useState<VertretungsAuswahl | null>(aktuelleAuswahl());
  const [daten, setDaten] = useState<VorschlagDaten | null>(null);
  const [reiter, setReiter] = useState(0);
  const [kopfOffen, setKopfOffen] = useState(false);
  const [alleZeigen, setAlleZeigen] = useState(false);
  const [weiter, setWeiter] = useState(true);
  const [alle, setAlle] = useState(false);
  const [opt, setOpt] = useState({ block: false, disloz: false, dauer: false, nahe: false, besetzt: false, zusatz: false });
  const tabellen = [useRef<TabelleApi<K>>(null), useRef<TabelleApi<K>>(null), useRef<TabelleApi<K>>(null), useRef<TabelleApi<K>>(null)];

  const ladeNr = useRef(0);
  async function laden(aw = auswahl): Promise<VorschlagDaten | null> {
    const n = ++ladeNr.current;
    if (!aw?.id) { setDaten(null); return null; }
    const q = new URLSearchParams({ block: String(opt.block), alle: String(alle), disloz: String(opt.disloz), nahe: String(opt.nahe), besetzt: String(opt.besetzt) });
    try {
      const d = await api.get<VorschlagDaten>(vpfad(`/vorschlag/${aw.id}?${q}`));
      if (n === ladeNr.current) setDaten(d);
      return d;
    } catch (e) {
      if ((e as { status?: number }).status === 404) { setAuswahl(null); setDaten(null); return null; }
      fehlerMelden(e);
      return null;
    }
  }
  useEffect(() => { void laden(); }, [auswahl, opt.block, opt.disloz, opt.nahe, opt.besetzt, alle]); // eslint-disable-line react-hooks/exhaustive-deps
  useEreignis('vertretung.auswahl', (x) => setAuswahl(x));
  useEreignis('daten', (e) => { if (betrifft(e, 'Vertretung', 'Stundenplan', 'Stammdaten', 'Einstellungen')) void laden(); });

  const ids = () => (auswahl?.ids?.includes(auswahl.id) ? auswahl.ids : auswahl ? [auswahl.id] : []);
  const nachAktion = async (warOffen: boolean) => {
    const d = await laden();
    if (warOffen && weiter && d && !d.offen && !d.raumOffen) melden('vertretung.naechsteOffene', undefined);
  };
  async function uebernehmen() {
    const k = tabellen[0]!.current?.aktiveZeile();
    if (!k || !auswahl || !schreiben) return;
    const warOffen = !!daten?.offen;
    const r = await mitRueckfragen(vpfad(`/vorschlag/${auswahl.id}/uebernehmen`), { lehrer: k.lehrer, ids: ids(), block: opt.block && !!daten?.optionen.block, dauer: opt.dauer && !!daten?.optionen.dauer }, { quelle: a.id });
    if (r) await nachAktion(warOffen);
  }
  async function betreuung() {
    const k = tabellen[1]!.current?.aktiveZeile();
    if (!k || !auswahl || !schreiben) return;
    const warOffen = !!daten?.offen;
    await mitRueckfragen(vpfad(`/vorschlag/${auswahl.id}/betreuung`), { lehrer: k.lehrer, ids: ids(), block: opt.block }, { quelle: a.id });
    await nachAktion(warOffen);
  }
  async function raum() {
    const r = tabellen[2]!.current?.aktiveZeile();
    if (!r || !auswahl || !schreiben) return;
    const warOffen = !!daten?.raumOffen;
    const erg = await mitRueckfragen(vpfad(`/vorschlag/${auswahl.id}/raum`), { raum: r.raum, zusatz: opt.zusatz, ids: ids(), block: opt.block }, { quelle: a.id });
    if (erg) await nachAktion(warOffen);
  }
  async function vorziehen() {
    const v = tabellen[3]!.current?.aktiveZeile();
    if (!v || !auswahl || !schreiben) return;
    await api.post(vpfad(`/vorschlag/${auswahl.id}/vorziehen`), { datum: v.datum, stunde: v.stunde, unterricht: v.u }, { quelle: a.id });
    hinweis('Vorziehung: Unterricht in die offene Stunde verlegt.', 'ok', 2500);
    await nachAktion(true);
  }
  const aktionen = [uebernehmen, betreuung, raum, vorziehen];
  const enter = (i: number) => (e: KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Enter') { void aktionen[i]!().catch(fehlerMelden); return true; } return false; };
  const listen: [string, K[], Spalte<K>[], string][] = [
    ['Lehrkräfte', daten?.kandidaten || [], KANDIDATEN, 'Für diese Stunde gibt es keinen Vorschlag.'],
    ['Betreuungen', daten?.betreuungen || [], BETREUUNGEN, 'Für diese Stunde ist keine Betreuung möglich.'],
    ['Räume', daten?.raeume || [], RAEUME, 'Kein passender Raum frei.'],
    ['Vorziehungen', daten?.vorziehungen || [], VORZIEHUNGEN, 'Keine Vorziehung möglich.'],
  ];
  const mehr = auswahl?.ids && auswahl.ids.length > 1 ? `${auswahl.ids.length - 1} weitere markiert` : '';
  const optSchalter = (k: keyof typeof opt, text: string, titel?: string, deaktiviert = false) => (
    <Switch key={k} label={text} title={titel} checked={opt[k]} disabled={deaktiviert} onChange={(_, d) => setOpt((o) => ({ ...o, [k]: d.checked }))} />
  );
  const aktiveOptionen = [opt.block, opt.disloz, opt.dauer, opt.nahe, opt.besetzt, opt.zusatz, alle, !weiter].filter(Boolean).length;
  const status = !daten ? null : daten.offen ? ['Offen', 'offen'] : daten.raumOffen ? ['Raum offen', 'offen'] : ['Besetzt', 'ok'];
  const entfall = async () => { if (!auswahl) return; await mitRueckfragen(vpfad('/entfall'), { ids: ids() }, { quelle: a.id }); await nachAktion(true); };
  const ohneLehrkraft = async () => { if (!auswahl) return; await api.post(vpfad('/ohnelehrer'), { ids: ids() }, { quelle: a.id }); await nachAktion(true); };

  const [titelListe, l, spaltenAktiv, leer] = listen[reiter]!;
  const gekuerzt = !alleZeigen && l.length > BESTE + 2;
  return (
    <AnsichtRahmen titel="Vertretungsvorschlag"
      werkzeuge={<>
        {schreiben ? <>
          <Werkzeug text="Übernehmen" titel="Gewählte Lehrkraft, Betreuung, Raum bzw. Vorziehung übernehmen (Doppelklick, Enter)" aktion={() => aktionen[reiter]!()} deaktiviert={!daten} />
          <Werkzeug text="Entfall" titel="Unterricht entfällt" aktion={entfall} deaktiviert={!daten} />
          <Werkzeug text="Ohne Lehrkraft" titel="Stunde findet ohne Lehrkraft statt" aktion={ohneLehrkraft} deaktiviert={!daten} />
          <Trenner />
        </> : null}
        <OptionenKnopf text="Optionen" aktiv={aktiveOptionen} titel="Optionen des Vertretungsvorschlags" testid="vorschlag-optionen">
          <Switch label="Danach nächste offene" title="Nach dem Zuweisen automatisch die nächste offene Vertretung wählen" checked={weiter} onChange={(_, d) => setWeiter(d.checked)} />
          <Switch label="Alle Lehrkräfte" title="Auch gesperrte und weit entfernte Lehrkräfte anzeigen" checked={alle} onChange={(_, d) => setAlle(d.checked)} />
          <OptionenTitel>Für diese Stunde</OptionenTitel>
          {optSchalter('block', 'Stundenblock', 'Vorschlag für alle Stunden des Blocks (Doppelstunde)', !daten?.optionen.block)}
          {optSchalter('disloz', 'Wegzeiten ignorieren', 'Auch Lehrkräfte vorschlagen, deren angrenzender Unterricht in einem anderen Gebäude liegt', !daten?.optionen.disloz)}
          {optSchalter('dauer', 'Dauervertretung', 'Vertretung für alle Stunden dieses Unterrichts während der Abwesenheit übernehmen', !daten?.optionen.dauer)}
          <OptionenTitel>Betreuungen und Räume</OptionenTitel>
          {optSchalter('nahe', 'Betreuung nur in der Nähe', 'Nur gekoppelte Lehrkräfte, gleicher Gang oder gleiches Stockwerk')}
          {optSchalter('besetzt', 'Auch belegte Räume')}
          {optSchalter('zusatz', 'Raum zusätzlich zum bisherigen', 'Den gewählten Raum zusätzlich zum bestehenden Raum zuordnen')}
          <Button size="small" appearance="subtle" style={{ alignSelf: 'flex-start', marginTop: 4 }} onClick={async () => { if (await einstellungenDialog(2)) await laden(); }}>Einstellungen des Vorschlags …</Button>
        </OptionenKnopf>
      </>}>
      {!auswahl ? <Leer text="Eine Vertretung in der Liste oder im Tagesplan wählen – hier erscheinen die passenden Lehrkräfte." /> : <>
        <div className={s.kopf} data-testid="vorschlag-kopf">
          <div className={s.kopfZeile}>
            <span className={s.kopfText} title={daten?.kopf}>{daten ? daten.kopf : 'Vorschlag wird berechnet …'}</span>
            {status ? <span className={`vt-chip vt-chip-${status[1]}`}>{status[0]}</span> : null}
            {mehr ? <span className={s.mehr}>{mehr}</span> : null}
            <Button size="small" appearance="subtle" className={s.detailKnopf} icon={kopfOffen ? <ChevronDown16Regular /> : <ChevronRight16Regular />} iconPosition="after" aria-expanded={kopfOffen} onClick={() => setKopfOffen(!kopfOffen)}>Details</Button>
          </div>
          {kopfOffen && daten ? <div className={s.details}>{daten.details.split('\n').map((z, i) => <div key={i}>{z}</div>)}</div> : null}
        </div>
        <div className={s.reiterZeile}>
          <TabList className={s.reiter} size="small" selectedValue={String(reiter)} onTabSelect={(_, d) => { setReiter(Number(d.value)); setAlleZeigen(false); }}>
            {listen.map(([t, x], i) => <Tab key={t} value={String(i)}>{`${t} (${x.length})`}</Tab>)}
          </TabList>
          {l.length > BESTE + 2 ? (
            <Button size="small" appearance="transparent" className={s.alle} onClick={() => setAlleZeigen(!alleZeigen)} data-testid="vorschlag-alle"
              title={gekuerzt ? `Die ${BESTE} besten von ${l.length} werden gezeigt` : undefined}>
              {gekuerzt ? `Alle ${l.length} anzeigen` : `Nur die ${BESTE} besten`}
            </Button>
          ) : null}
        </div>
        <div className={s.flaeche}>
          <Tabelle<K> key={titelListe} ref={tabellen[reiter]} name={`vorschlag-${reiter}`} spalten={spaltenAktiv} zeilen={gekuerzt ? l.slice(0, BESTE) : l}
            zustandSchluessel={`vertretung.vorschlag.spalten.${reiter}`}
            id={reiter === 3 ? (v) => `${v.datum}|${v.stunde}|${v.u}` : (k) => String(k.lehrer ?? k.raum ?? k.name)} sortierbar={false} leerText={daten ? leer : ''}
            zeilenKlasse={(r, i) => [i < 3 && reiter < 2 ? 'vt-top' : '', reiter === 2 ? (r.besetzt ? 'vt-besetzt' : r.ar || r.sr ? 'vt-ausweich' : '') : ''].filter(Boolean).join(' ') || null}
            beiDoppelklick={() => void aktionen[reiter]!().catch(fehlerMelden)} tasten={enter(reiter)} />
        </div>
      </>}
    </AnsichtRahmen>
  );
}
