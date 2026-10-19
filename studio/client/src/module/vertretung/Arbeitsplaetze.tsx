// Arbeitsplätze der Vertretungsplanung: Tagesplanung (Tagesablauf bzw. Expertenansicht), Verlegen und Tauschen, Kompaktpläne.
import { Button, Link, Tooltip, makeStyles, tokens } from '@fluentui/react-components';
import { ChevronLeft20Regular, ChevronRight20Regular } from '@fluentui/react-icons';
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '@/api/client';
import { seiteOeffnen } from '@/kern/befehle';
import { useEreignis } from '@/kern/ereignisse';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben, useStudio } from '@/kern/zustand';
import { fehlerMelden } from '@/komponenten/hinweise';
import { MenueKnopf } from '@/komponenten/menue';
import { Bereich, Teilung } from '@/shell/arbeitsplatz';
import { DatumFeld } from '@/komponenten/eingaben';
import {
  aktuelleAuswahl, blaettern, datumSetzen, isoAus, planVergroessern, seitenansichtSetzen, tagKurz, tpAnsichtSetzen, tpKontextSetzen, tpSchrittSetzen, useTagesplanung,
  usePlanungsdatum, vpfad, type TpAnsicht, type TpKontext, type TpSchritt, type Zeitansicht,
} from './kern';
import { Umschalter } from './steuer';
import './ablauf/ablauf.css';

const useStile = makeStyles({
  seite: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0, gap: '8px' },
  kopf: {
    display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px 16px', padding: '6px 12px', minHeight: '44px', flexShrink: 0,
    border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusLarge, backgroundColor: tokens.colorNeutralBackground1,
  },
  datum: { display: 'inline-flex', alignItems: 'center', gap: '2px' },
  datumFeld: { width: '150px', fontVariantNumeric: 'tabular-nums' },
  tag: { fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold, whiteSpace: 'nowrap', marginLeft: '6px', '@media (max-width: 1799px)': { display: 'none' } },
  breit: { display: 'inline-flex', gap: '12px', '@media (max-width: 1699px)': { display: 'none' } },
  woche: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase300, whiteSpace: 'nowrap' },
  frei: { color: 'var(--up-frei)', fontSize: tokens.fontSizeBase300, whiteSpace: 'nowrap' },
  summe: { display: 'inline-flex', alignItems: 'center', gap: '6px', color: tokens.colorNeutralForeground2, fontSize: tokens.fontSizeBase300, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' },
  punkt: { color: tokens.colorNeutralForeground4 },
  offen: { color: 'var(--up-entfall)', fontWeight: tokens.fontWeightSemibold },
  rechts: { marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  ansicht: { display: 'inline-flex', alignItems: 'center', gap: '8px' },
  streifen: { display: 'inline-flex', alignItems: 'stretch', gap: '2px' },
});

/** Wochenstreifen im Tageskopf: Tage der Woche mit der Zahl offener Vertretungen; Klick wechselt den Planungstag. */
function Wochenstreifen({ woche, datum }: { woche: Wochentag[]; datum: string }) {
  const s = useStile();
  return (
    <span className={s.streifen} role="group" aria-label="Woche – offene Vertretungen je Tag" data-testid="wochenstreifen">
      {woche.map((w) => {
        const aktiv = w.datum === datum;
        const titel = `${tagLang(w.datum)}${w.unterrichtstag ? `: ${w.offen ? mehrzahl(w.offen, 'offene Vertretung', 'offene Vertretungen') : 'keine offenen Vertretungen'}` : ` – ${w.frei || 'kein Unterrichtstag'}`}`;
        return (
          <button key={w.datum} type="button" title={titel} aria-pressed={aktiv} data-datum={w.datum}
            className={`vt-wtag${aktiv ? ' aktiv' : ''}${w.unterrichtstag ? '' : ' frei'}${w.offen ? ' offen' : ''}`}
            onClick={() => { if (!aktiv) datumSetzen(w.datum).catch(fehlerMelden); }}>
            <span className="vt-wtag-name">{tagKurz(w.datum)}</span>
            <span className="vt-wtag-zahl">{w.unterrichtstag ? (w.offen || '–') : 'frei'}</span>
          </button>
        );
      })}
    </span>
  );
}

const TAGE_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
/** „Montag, 2.11.2026“ */
function tagLang(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return `${TAGE_LANG[d.getDay()]}, ${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

interface Wochentag { datum: string; offen: number; abwKl: number; freis: number; blRaeume: number; tagestexte: number; kollL: number; kollR: number; frei: string; unterrichtstag: boolean }
interface TagesStand { wochentyp: string; unterrichtstag: boolean; tag?: Wochentag; woche: Wochentag[]; abwesend: Record<string, number> }
const mehrzahl = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;

/** Kopf der Tagesplanung: Datum blättern, A/B-Woche, Umschalter Tag | Woche, Wochenstreifen, Kennzahlen des Tages, Verweise. */
function Tageskopf() {
  const s = useStile();
  const datum = usePlanungsdatum();
  const schreiben = useDarfSchreiben();
  const letzte = useStudio((x) => x.grunddaten?.zeitraster?.stunden?.length || 8);
  const tageProWoche = useStudio((x) => x.grunddaten?.zeitraster?.tage?.length || 5);
  const seite = useTagesplanung((x) => x.seite);
  const tpAnsicht = useTagesplanung((x) => x.ansicht);
  const schritt = useTagesplanung((x) => x.schritt);
  const ablauf = tpAnsicht === 'ablauf';
  const [liste, setListe] = useState<{ entfall: number } | null>(null);
  const { daten } = useDaten(async (): Promise<TagesStand> => {
    const [k, abw] = await Promise.all([
      api.get<{ wochentyp: string; unterrichtstag: boolean; woche: Wochentag[] }>(vpfad(`/kalender?datum=${datum}`)),
      api.get<{ anzahl: Record<string, number> }>(vpfad(`/absenzen?art=lehrer&von=${datum}&bis=${datum}&veranstaltungen=false`)),
    ]);
    // Wochenstreifen: die Tage des Zeitrasters und weitere Unterrichtstage (z. B. ein Samstag)
    const woche = k.woche.filter((w, i) => i < tageProWoche || w.unterrichtstag);
    return { wochentyp: k.wochentyp, unterrichtstag: k.unterrichtstag, tag: k.woche.find((w) => w.datum === datum), woche, abwesend: abw.anzahl || {} };
  }, [datum, tageProWoche], { bereiche: ['Vertretung', 'Stammdaten', 'Einstellungen'], aktiv: !!datum });
  useEreignis('vertretung.liste', (x) => { if (x.von === datum && x.bis === datum) setListe({ entfall: x.entfall }); else setListe(null); });
  useEreignis('vertretung.datum', () => setListe(null));

  const los = (f: () => Promise<unknown>) => () => { f().catch(fehlerMelden); };
  const t = daten?.tag;
  const abw = daten ? (daten.abwesend.lehrer || 0) + (daten.abwesend.klasse || 0) + (daten.abwesend.raum || 0) : 0;
  const abwTitel = daten ? `Lehrkräfte ${daten.abwesend.lehrer || 0} · Klassen ${daten.abwesend.klasse || 0} · Räume ${daten.abwesend.raum || 0}` : '';
  const teile: { text: string; klasse?: string; titel?: string }[] = [];
  if (daten) {
    teile.push({ text: `${t?.offen ?? 0} offen`, klasse: t?.offen ? s.offen : undefined, titel: 'Offene Vertretungen des Tages' });
    teile.push({ text: mehrzahl(abw, 'Abwesenheit', 'Abwesenheiten'), titel: abwTitel });
    if (liste?.entfall) teile.push({ text: mehrzahl(liste.entfall, 'Entfall', 'Entfälle') });
    if (t && t.kollL + t.kollR > 0) teile.push({ text: mehrzahl(t.kollL + t.kollR, 'Kollision', 'Kollisionen'), klasse: s.offen, titel: `Lehrkräfte ${t.kollL} · Räume ${t.kollR}` });
    if (t?.tagestexte) teile.push({ text: mehrzahl(t.tagestexte, 'Tagestext', 'Tagestexte') });
  }
  const modusWahl = (
    <Umschalter<TpAnsicht> wert={tpAnsicht} titel="Geführter Tagesablauf oder Expertenansicht (Liste, Vorschlag und Pläne nebeneinander)" testid="tp-modus" beiWahl={tpAnsichtSetzen}
      optionen={[{ wert: 'ablauf', text: 'Tagesablauf', titel: 'Abwesenheiten erfassen, offene Stunden lösen, prüfen und veröffentlichen' }, { wert: 'experte', text: 'Expertenansicht', titel: 'Vertretungsliste, Vorschlag und Pläne nebeneinander' }]} />
  );
  const erfassen = (art: 'lehrer' | 'klasse' | 'raum') => async () => {
    if (!datum) return;
    const { abwesenheitErfassen } = await import('./Absenzen');
    await abwesenheitErfassen(art, datum, letzte);
  };
  return (
    <div className={s.kopf} data-testid="tageskopf">
      <span className={s.datum}>
        <Tooltip content="Vorheriger Unterrichtstag (Strg+Bild↑, Woche: Strg+Umschalt+Bild↑)" relationship="label"><Button size="small" appearance="subtle" icon={<ChevronLeft20Regular />} onClick={los(() => blaettern(-1))} /></Tooltip>
        <Button size="small" appearance="subtle" onClick={los(() => datumSetzen(isoAus(new Date())))}>Heute</Button>
        <Tooltip content="Nächster Unterrichtstag (Strg+Bild↓, Woche: Strg+Umschalt+Bild↓)" relationship="label"><Button size="small" appearance="subtle" icon={<ChevronRight20Regular />} onClick={los(() => blaettern(1))} /></Tooltip>
        <DatumFeld size="small" className={s.datumFeld} wert={datum || ''} aria-label="Datum der Tagesplanung" beiAenderung={(datum) => { if (datum) void datumSetzen(datum); }} />
        {datum ? <span className={s.tag}>{tagLang(datum)}</span> : null}
      </span>
      {daten?.wochentyp ? <span className={s.woche}>{`${daten.wochentyp}-Woche`}</span> : null}
      <span className={s.ansicht}>
        <Umschalter<Zeitansicht> wert={seite} titel="Tagesplanung für den Planungstag oder die ganze Woche (Liste und Pläne)" testid="seiten-ansicht" beiWahl={seitenansichtSetzen}
          optionen={[{ wert: 'tag', text: 'Tag', titel: 'Vertretungen und Pläne des Planungstags' }, { wert: 'woche', text: 'Woche', titel: 'Vertretungen der ganzen Woche nach Tagen, Pläne als Wochenpläne' }]} />
        {daten && datum ? <Wochenstreifen woche={daten.woche} datum={datum} /> : null}
      </span>
      {daten && !daten.unterrichtstag ? <span className={s.frei}>{t?.frei || 'kein Unterrichtstag'}</span> : null}
      <span className={s.summe} data-testid="tagessumme">
        {teile.map((x, i) => (
          <span key={x.text} style={{ display: 'inline-flex', gap: 6 }}>
            {i ? <span className={s.punkt}>·</span> : null}<span className={x.klasse} title={x.titel}>{x.text}</span>
          </span>
        ))}
      </span>
      <span className={s.rechts}>
        {ablauf ? null : <>
        {modusWahl}
        <span className={schreiben ? s.breit : undefined} style={schreiben ? undefined : { display: 'inline-flex', gap: 12 }}>
          <Link onClick={() => seiteOeffnen('vertretung.absenzen')} title="Abwesenheiten von Lehrkräften, Klassen und Räumen bearbeiten (Strg+M)">Abwesenheiten</Link>
          <Link onClick={() => seiteOeffnen('vertretung.kalender')} title="Wochenübersicht mit Kennzahlen, Tagestexte und Kalendertag">Kalender</Link>
        </span>
        {schreiben ? (
          <MenueKnopf art="knopf" appearance="secondary" text="Abwesenheit" titel="Neue Abwesenheit für diesen Tag erfassen, alle Abwesenheiten, Kalender" eintraege={[
            { titel: 'Abwesenheit erfassen' },
            { text: 'Lehrkraft …', aktion: erfassen('lehrer') },
            { text: 'Klasse …', aktion: erfassen('klasse') },
            { text: 'Raum …', aktion: erfassen('raum') },
            null,
            { text: 'Alle Abwesenheiten', taste: 'Strg+M', aktion: () => seiteOeffnen('vertretung.absenzen') },
            { text: 'Kalender', aktion: () => seiteOeffnen('vertretung.kalender') },
          ]} />
        ) : null}
        </>}
      </span>
      {ablauf ? <Schritte schritt={schritt} abwesend={abw} offen={t?.offen ?? 0} kollisionen={t ? t.kollL + t.kollR : 0} unterrichtstag={!!daten?.unterrichtstag}>{modusWahl}</Schritte> : null}
    </div>
  );
}

/** Schritte des Tagesablaufs als flache Reiter mit Stand (Abwesenheiten, offene Stunden, Kollisionen). */
function Schritte({ schritt, abwesend, offen, kollisionen, unterrichtstag, children }: { schritt: TpSchritt; abwesend: number; offen: number; kollisionen: number; unterrichtstag: boolean; children?: ReactNode }) {
  const liste: { wert: TpSchritt; nr: number; text: string; stand: string; achtung?: boolean; titel: string }[] = [
    { wert: 'erfassen', nr: 1, text: 'Abwesenheiten erfassen', stand: abwesend ? String(abwesend) : '–', titel: 'Wer fehlt heute? Lehrkräfte, Klassen und Räume schnell erfassen' },
    { wert: 'loesen', nr: 2, text: 'Offene Stunden lösen', stand: unterrichtstag ? (offen ? `${offen} offen` : 'erledigt') : '–', achtung: offen > 0, titel: 'Arbeitsliste der offenen Stunden mit den besten Kandidaten' },
    { wert: 'pruefen', nr: 3, text: 'Prüfen und veröffentlichen', stand: kollisionen ? mehrzahl(kollisionen, 'Kollision', 'Kollisionen') : offen ? '' : 'bereit', achtung: kollisionen > 0, titel: 'Tagesbilanz, Belastung, Nachrichten zum Tag, an EduOrga Web senden und drucken' },
  ];
  return (
    <nav className="ta-schritte" aria-label="Tagesablauf" data-testid="tp-schritte">
      {liste.map((x) => (
        <button key={x.wert} type="button" className={`ta-schritt${x.wert === schritt ? ' aktiv' : ''}`} aria-current={x.wert === schritt ? 'step' : undefined} data-schritt={x.wert} title={x.titel}
          onClick={() => tpSchrittSetzen(x.wert)}>
          <span className="ta-schritt-nr">{x.nr}</span>
          <span className="ta-schritt-text">{x.text}</span>
          {x.stand ? <span className={`ta-schritt-stand${x.achtung ? ' achtung' : ''}`}>{x.stand}</span> : null}
        </button>
      ))}
      <span className="ta-schritte-rechts">{children}</span>
    </nav>
  );
}

const KONTEXTE: { wert: TpKontext; text: string; taste: string; titel: string }[] = [
  { wert: 'plaene', text: 'Pläne', taste: 'P', titel: 'Tagespläne von Klasse und Lehrkraft der gewählten Stunde (Verlegen und Tauschen per Drag & Drop)' },
  { wert: 'frei', text: 'Wer ist frei?', taste: 'F', titel: 'Alle Lehrkräfte × Stunden des Tages mit Belastung' },
  { wert: 'vorschlag', text: 'Alle Kandidaten', taste: 'V', titel: 'Vollständiger Vertretungsvorschlag: Lehrkräfte, Betreuungen, Räume, Vorziehungen' },
];

/** Kontextbereich neben der Arbeitsliste: folgt der gewählten Stunde. Bereiche bleiben nach dem ersten Zeigen eingehängt. */
function Kontext({ woche, gross }: { woche: boolean; gross: string | null }) {
  const kontext = useTagesplanung((x) => x.kontext);
  const [gezeigt, setGezeigt] = useState<Set<TpKontext>>(() => new Set([kontext]));
  useEffect(() => { setGezeigt((g) => (g.has(kontext) ? g : new Set([...g, kontext]))); }, [kontext]);
  const sichtbar = (k: TpKontext) => ({ display: kontext === k ? 'flex' : 'none', flex: 1, minHeight: 0, minWidth: 0, flexDirection: 'column' as const });
  return (
    <div className="ta-kontext" data-testid="tp-kontext" data-kontext={kontext}>
      <div className="ta-kontext-reiter" role="tablist" aria-label="Kontext der gewählten Stunde" style={gross ? { display: 'none' } : undefined}>
        {KONTEXTE.map((k) => (
          <button key={k.wert} type="button" role="tab" aria-selected={k.wert === kontext} className={`ta-reiter${k.wert === kontext ? ' aktiv' : ''}`} title={`${k.titel} (Taste ${k.taste})`}
            data-kontext={k.wert} onClick={() => tpKontextSetzen(k.wert)}>{k.text}</button>
        ))}
      </div>
      <div style={sichtbar('plaene')}>
        <Teilung richtung={woche ? 'zeilen' : 'spalten'} schluessel={woche ? 'tagesablauf.plaene.woche' : 'tagesablauf.plaene'} anteile={[50, 50]} nur={gross === 'klasse' ? 0 : gross === 'lehrer' ? 1 : null}>
          <Bereich id="plan-klasse" typ="vertretung.plan" p={{ typ: 'klasse', tagesplanung: true }} />
          <Bereich id="plan-lehrer" typ="vertretung.plan" p={{ typ: 'lehrer', tagesplanung: true }} />
        </Teilung>
      </div>
      {gezeigt.has('frei') ? <div style={sichtbar('frei')}><Bereich id="wer-ist-frei" typ="vertretung.frei" /></div> : null}
      {gezeigt.has('vorschlag') ? <div style={sichtbar('vorschlag')}><Bereich id="vorschlag" typ="vertretung.vorschlag" /></div> : null}
    </div>
  );
}

/** Geführter Tagesablauf: 1 Abwesenheiten erfassen · 2 offene Stunden lösen · 3 prüfen und veröffentlichen. */
function Ablauf() {
  const schritt = useTagesplanung((x) => x.schritt);
  const woche = useTagesplanung((x) => Object.values(x.plaene).some((v) => v === 'woche'));
  const gross = useTagesplanung((x) => x.gross);
  if (schritt === 'erfassen') {
    return (
      <Teilung schluessel="tagesablauf.erfassen" anteile={[42, 58]}>
        <Bereich id="erfassen" typ="vertretung.erfassen" />
        <Bereich id="abwesenheiten" typ="vertretung.absenzen" p={{ zeitraum: 'tag' }} />
      </Teilung>
    );
  }
  if (schritt === 'pruefen') {
    return (
      <Teilung schluessel="tagesablauf.pruefen" anteile={[46, 54]}>
        <Bereich id="pruefen" typ="vertretung.tagesbilanz" />
        <Teilung richtung="zeilen" schluessel="tagesablauf.pruefen.rechts" anteile={[42, 58]}>
          <Bereich id="belastung" typ="vertretung.belastung" />
          <Bereich id="pruef-liste" typ="vertretung.liste" p={{ schlank: true }} />
        </Teilung>
      </Teilung>
    );
  }
  return (
    <Teilung schluessel={woche ? 'tagesablauf.loesen.woche' : 'tagesablauf.loesen'} anteile={woche ? [42, 58] : [48, 52]} nur={gross ? 1 : null}>
      <Bereich id="arbeitsliste" typ="vertretung.arbeitsliste" />
      <Kontext woche={woche} gross={gross} />
    </Teilung>
  );
}

/**
 * Tagesplanung: oben der Tageskopf (mit Umschalter Tag | Woche, Wochenstreifen und dem Umschalter Tagesablauf | Expertenansicht).
 * Tagesablauf (Standard): Schritte „Abwesenheiten erfassen“, „Offene Stunden lösen“ (Arbeitsliste mit Kandidaten, daneben Pläne,
 * „Wer ist frei?“ oder alle Kandidaten der gewählten Stunde) und „Prüfen und veröffentlichen“ (Tagesbilanz, Belastung, Liste).
 * Expertenansicht: links die Vertretungen (schlanke Liste,
 * im Wochenmodus nach Tagen gegliedert) und darunter der Vorschlag zur gewählten Vertretung; rechts die Pläne von Klasse und
 * Lehrkraft (folgen der Auswahl). Zeigt ein Plan die Woche, stehen die Pläne untereinander in einer breiteren rechten Spalte;
 * ein Plan lässt sich vergrößern (Esc stellt die Aufteilung wieder her). Alle Bereiche bleiben dabei eingehängt.
 */
export function Tagesplanung() {
  const s = useStile();
  const ansicht = useTagesplanung((x) => x.ansicht);
  const woche = useTagesplanung((x) => Object.values(x.plaene).some((v) => v === 'woche'));
  const gross = useTagesplanung((x) => x.gross);
  useEffect(() => {
    if (!gross) return undefined;
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('[role=dialog], [role=menu], [role=listbox]')) planVergroessern(null); };
    document.addEventListener('keydown', taste);
    return () => document.removeEventListener('keydown', taste);
  }, [gross]);
  useEffect(() => () => planVergroessern(null), []);
  const k = woche ? 'tagesplanung.woche' : 'tagesplanung.v2';
  return (
    <div className={s.seite} data-ansicht-art={woche ? 'woche' : 'tag'} data-tp-ansicht={ansicht}>
      <Tageskopf />
      {ansicht === 'ablauf' ? <Ablauf /> : <Teilung schluessel={k} anteile={woche ? [45, 55] : [58, 42]} nur={gross ? 1 : null}>
        <Teilung richtung="zeilen" schluessel={`${k}.links`} anteile={[56, 44]}>
          <Bereich id="liste" typ="vertretung.liste" p={{ schlank: true, tagesplanung: true }} />
          <Bereich id="vorschlag" typ="vertretung.vorschlag" />
        </Teilung>
        <Teilung richtung={woche ? 'zeilen' : 'spalten'} schluessel={`${k}.plaene`} anteile={[50, 50]} nur={gross === 'klasse' ? 0 : gross === 'lehrer' ? 1 : null}>
          <Bereich id="plan-klasse" typ="vertretung.plan" p={{ typ: 'klasse', tagesplanung: true }} />
          <Bereich id="plan-lehrer" typ="vertretung.plan" p={{ typ: 'lehrer', tagesplanung: true }} />
        </Teilung>
      </Teilung>}
    </div>
  );
}

/** Verlegen und Tauschen: Klassen- und Lehrkräfteplan tagesaktuell nebeneinander (Drag & Drop zwischen beiden). */
export function Verlegen() {
  const a = aktuelleAuswahl()?.zeile;
  return (
    <Teilung schluessel="verlegen" anteile={[50, 50]}>
      <Bereich id="klasse" typ="vertretung.plan" p={{ typ: 'klasse', element: a?.klasse ?? undefined }} />
      <Bereich id="lehrer" typ="vertretung.plan" p={{ typ: 'lehrer', element: a?.lehrer ?? undefined }} />
    </Teilung>
  );
}

/** Kompaktpläne: Vertretungen links, kleine Pläne von Klasse, Lehrkraft, Vertretung und Raum der gewählten Vertretung. */
export function Kompakt() {
  return (
    <Teilung schluessel="kompakt" anteile={[40, 15, 15, 15, 15]}>
      <Bereich id="liste" typ="vertretung.liste" />
      <Bereich id="klasse" typ="vertretung.plan" p={{ typ: 'klasse', kompakt: true }} />
      <Bereich id="lehrer" typ="vertretung.plan" p={{ typ: 'lehrer', kompakt: true }} />
      <Bereich id="vertreter" typ="vertretung.plan" p={{ typ: 'lehrer', rolle: 'vertreter', kompakt: true }} />
      <Bereich id="raum" typ="vertretung.plan" p={{ typ: 'raum', kompakt: true }} />
    </Teilung>
  );
}
