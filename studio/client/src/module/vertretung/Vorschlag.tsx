// Vertretungsvorschlag: folgt der markierten Vertretung. Kopf „30.8. Mo-1 Se/Mu/05D“ (aufklappbar), Optionen (Stundenblock,
// Wegzeiten ignorieren, Dauervertretung …), Reiter Lehrkräfte / Betreuungen / Räume mit Anzahlen, unten aufklappbar die
// Vorziehungen. Übernehmen per Doppelklick, Enter oder Knopf; danach wahlweise zur nächsten offenen.
import { Button, Switch, Tab, TabList, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { ChevronDown16Regular, ChevronRight16Regular } from '@fluentui/react-icons';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { api } from '@/api/client';
import { useAnsicht } from '@/kern/ansichten';
import { betrifft, melden, useEreignis, type VertretungsAuswahl } from '@/kern/ereignisse';
import { useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, Rechts, Schalter, Trenner, Werkzeug } from '@/komponenten/ansicht';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { Tabelle, type Spalte, type TabelleApi } from '@/komponenten/tabelle/Tabelle';
import { aktuelleAuswahl, mitRueckfragen, vpfad } from './kern';
import { einstellungenDialog } from './weitere';

const useStile = makeStyles({
  kopf: { padding: '8px 12px 4px 12px', borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, display: 'flex', flexDirection: 'column', gap: '6px' },
  klapp: { justifyContent: 'flex-start', fontWeight: tokens.fontWeightSemibold, padding: '2px 4px', minWidth: 0 },
  details: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2, padding: '0 8px 4px 24px' },
  optionen: { display: 'flex', flexWrap: 'wrap', gap: '0 12px' },
  reiter: { padding: '0 8px' },
  flaeche: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
  fuss: { borderTop: `1px solid ${tokens.colorNeutralStroke2}`, display: 'flex', flexDirection: 'column' },
  vorz: { height: '180px', display: 'flex', flexDirection: 'column' },
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

const mini = (i: number): Spalte<K> => ({
  schluessel: `s${i}`, titel: i === 0 ? 'Stundenplan' : '', breite: 54, art: 'NurLesen',
  wert: (k) => k.s?.[i]?.text ?? '',
  farbe: (k) => { const z = k.s?.[i]; return z?.farbe && !z.entfallen ? `color-mix(in srgb, ${z.farbe} 20%, var(--colorNeutralBackground1))` : null; },
  klasse: (k) => { const z = k.s?.[i]; return z ? `vt-mini${z.entfallen ? ' entfallen' : ''}${z.ziel ? ' ziel' : ''}` : null; },
});
const sp = (schluessel: string, titel: string, breite: number, extra: Partial<Spalte<K>> = {}): Spalte<K> => ({ schluessel, titel, breite, art: 'NurLesen', ...extra });

const KANDIDATEN: Spalte<K>[] = [
  sp('name', 'Name', 80, { klasse: (k) => `${k.rot ? 'vt-rot' : ''}${k.benachrichtigen ? ' fett' : ''}`.trim() || null }), mini(0), mini(1), mini(2),
  sp('merker', 'Belastung', 76, { hinweis: 'Belastung zur Stunde (0 günstig bis 9 ungünstig) bzw. Bereitschaft', klasse: (k) => belastung(k.merker) }),
  sp('vertr', 'Vertr.', 56, { ausrichtung: 'rechts', hinweis: 'Vertretungen im Durchrechnungszeitraum' }), sp('entf', 'Entfall', 56, { ausrichtung: 'rechts' }),
  sp('zaehler', 'Zähler', 60, { ausrichtung: 'rechts', hinweis: 'Vertretungszähler', klasse: (k) => (Number(k.zaehlerWert) > 0 ? 'vt-warn' : null) }),
  sp('zw', 'Zeitwunsch', 80, { ausrichtung: 'mitte' }), sp('jahr', 'Jahressaldo', 84, { ausrichtung: 'rechts' }),
  sp('kennz', 'Kennz.', 56, { ausrichtung: 'mitte', hinweis: 'Kennzeichen der Lehrkraft', wert: (k) => (k.kennz ? 'K' : '') }),
  sp('regB', 'Bereitschaft', 86, { ausrichtung: 'mitte', hinweis: 'Regelmäßige Bereitschaft' }), sp('dep', 'Konto', 60, { ausrichtung: 'rechts', hinweis: 'Stundenkonto' }),
  sp('fach', 'Fach', 48, { art: 'Haken', hinweis: 'Lehrkraft unterrichtet das Fach' }), sp('klasse', 'Klasse', 56, { ausrichtung: 'mitte', hinweis: 'Lehrkraft unterrichtet die Klasse' }),
  sp('stdTag', 'Std./Tag', 64, { ausrichtung: 'rechts' }), sp('woche', 'Woche', 56, { ausrichtung: 'rechts' }), sp('monat', 'Monat', 56, { ausrichtung: 'rechts' }),
  sp('punkte', 'Punkte', 60, { ausrichtung: 'rechts' }), sp('kriterien', 'Kriterien', 260),
];
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
  const [vorzOffen, setVorzOffen] = useState(false);
  const [weiter, setWeiter] = useState(true);
  const [alle, setAlle] = useState(false);
  const [opt, setOpt] = useState({ block: false, disloz: false, dauer: false, nahe: false, besetzt: false, zusatz: false });
  const tabellen = [useRef<TabelleApi<K>>(null), useRef<TabelleApi<K>>(null), useRef<TabelleApi<K>>(null)];
  const vorzTabelle = useRef<TabelleApi<K>>(null);

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
    const v = vorzTabelle.current?.aktiveZeile();
    if (!v || !auswahl || !schreiben) return;
    await api.post(vpfad(`/vorschlag/${auswahl.id}/vorziehen`), { datum: v.datum, stunde: v.stunde, unterricht: v.u }, { quelle: a.id });
    hinweis('Vorziehung: Unterricht in die offene Stunde verlegt.', 'ok', 2500);
    await nachAktion(true);
  }
  const aktionen = [uebernehmen, betreuung, raum];
  const enter = (i: number) => (e: KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Enter') { void aktionen[i]!().catch(fehlerMelden); return true; } return false; };
  const listen: [string, K[], Spalte<K>[], string][] = [
    ['Lehrkräfte', daten?.kandidaten || [], KANDIDATEN, 'Für diese Stunde gibt es keinen Vorschlag.'],
    ['Betreuungen', daten?.betreuungen || [], BETREUUNGEN, 'Für diese Stunde ist keine Betreuung möglich.'],
    ['Räume', daten?.raeume || [], RAEUME, 'Kein passender Raum frei.'],
  ];
  const mehr = auswahl?.ids && auswahl.ids.length > 1 ? ` · ${auswahl.ids.length - 1} weitere markiert` : '';
  const optSchalter = (k: keyof typeof opt, text: string, titel?: string, deaktiviert = false) => (
    <Switch key={k} label={text} title={titel} checked={opt[k]} disabled={deaktiviert} onChange={(_, d) => setOpt((o) => ({ ...o, [k]: d.checked }))} />
  );

  return (
    <AnsichtRahmen titel="Vertretungsvorschlag"
      werkzeuge={<>
        {schreiben ? <>
          <Werkzeug text="Übernehmen" titel="Gewählte Lehrkraft bzw. gewählten Raum übernehmen (Doppelklick, Enter)" aktion={() => aktionen[reiter]!()} />
          <Werkzeug text="Entfall" titel="Unterricht entfällt" aktion={async () => { if (!auswahl) return; await mitRueckfragen(vpfad('/entfall'), { ids: ids() }, { quelle: a.id }); await nachAktion(true); }} />
          <Werkzeug text="Ohne Lehrkraft" titel="Stunde findet ohne Lehrkraft statt" aktion={async () => { if (!auswahl) return; await api.post(vpfad('/ohnelehrer'), { ids: ids() }, { quelle: a.id }); await nachAktion(true); }} />
          <Trenner />
        </> : null}
        <Schalter text="Danach nächste offene" an={weiter} beiAenderung={setWeiter} titel="Nach dem Zuweisen automatisch die nächste offene Vertretung wählen" />
        <Schalter text="Alle Lehrkräfte" an={alle} beiAenderung={setAlle} titel="Auch gesperrte und weit entfernte Lehrkräfte anzeigen" />
        <Rechts><Werkzeug text="Einstellungen" titel="Einstellungen des Vertretungsvorschlags" aktion={async () => { if (await einstellungenDialog(2)) await laden(); }} /></Rechts>
      </>}>
      <div className={s.kopf}>
        <Button appearance="subtle" className={s.klapp} icon={kopfOffen ? <ChevronDown16Regular /> : <ChevronRight16Regular />} aria-expanded={kopfOffen} onClick={() => setKopfOffen(!kopfOffen)}>
          {daten ? daten.kopf + mehr : 'Keine Vertretung markiert'}
        </Button>
        {kopfOffen ? <div className={s.details}>{daten ? daten.details.split('\n').map((z, i) => <div key={i}>{z}</div>) : 'In der Vertretungsliste oder in einem Tagesplan eine Vertretung markieren.'}</div> : null}
        <div className={s.optionen}>
          {optSchalter('block', 'Stundenblock', 'Vorschlag für alle Stunden des Blocks (Doppelstunde)', !daten?.optionen.block)}
          {optSchalter('disloz', 'Wegzeiten ignorieren', 'Auch Lehrkräfte vorschlagen, deren angrenzender Unterricht in einem anderen Gebäude liegt', !daten?.optionen.disloz)}
          {optSchalter('dauer', 'Dauervertretung', 'Vertretung für alle Stunden dieses Unterrichts während der Abwesenheit übernehmen', !daten?.optionen.dauer)}
          {reiter === 1 ? optSchalter('nahe', 'Nur in der Nähe', 'Nur gekoppelte Lehrkräfte, gleicher Gang oder gleiches Stockwerk') : null}
          {reiter === 2 ? optSchalter('besetzt', 'Auch belegte Räume') : null}
          {reiter === 2 ? optSchalter('zusatz', 'Zusätzlich zum bisherigen Raum', 'Den gewählten Raum zusätzlich zum bestehenden Raum zuordnen') : null}
        </div>
      </div>
      <TabList className={s.reiter} size="small" selectedValue={String(reiter)} onTabSelect={(_, d) => setReiter(Number(d.value))}>
        {listen.map(([t, l], i) => <Tab key={t} value={String(i)}>{`${t} (${l.length})`}</Tab>)}
      </TabList>
      <div className={s.flaeche}>
        {listen.map(([t, l, spalten, leer], i) => (i === reiter ? (
          <Tabelle<K> key={t} ref={tabellen[i]} name={`vorschlag-${i}`} spalten={spalten} zeilen={l} id={(k) => String(k.lehrer ?? k.raum ?? k.name)} sortierbar={false} leerText={daten ? leer : 'Keine Vertretung markiert.'}
            zeilenKlasse={i === 2 ? (r) => (r.besetzt ? 'vt-besetzt' : r.ar || r.sr ? 'vt-ausweich' : null) : undefined}
            beiDoppelklick={() => void aktionen[i]!().catch(fehlerMelden)} tasten={enter(i)} />
        ) : null))}
      </div>
      <div className={s.fuss}>
        <Button appearance="subtle" className={s.klapp} icon={vorzOffen ? <ChevronDown16Regular /> : <ChevronRight16Regular />} aria-expanded={vorzOffen} onClick={() => setVorzOffen(!vorzOffen)}>
          {`Vorziehungen (${daten?.vorziehungen.length ?? 0})`}
        </Button>
        {vorzOffen ? (
          <div className={mergeClasses(s.vorz)}>
            <Tabelle<K> ref={vorzTabelle} name="vorziehungen" spalten={VORZIEHUNGEN} zeilen={daten?.vorziehungen || []} id={(v) => `${v.datum}|${v.stunde}|${v.u}`} sortierbar={false}
              leerText="Keine Vorziehung möglich." beiDoppelklick={() => void vorziehen().catch(fehlerMelden)} />
          </div>
        ) : null}
      </div>
    </AnsichtRahmen>
  );
}
