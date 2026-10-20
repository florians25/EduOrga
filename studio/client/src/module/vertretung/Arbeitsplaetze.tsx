// Arbeitsplätze der Vertretungsplanung: Tagesplanung (Tagesübersicht nach Klassen bzw. Lehrkräften, offene Stunden mit Entscheidung bzw. Tabelle), Verlegen und Tauschen, Kompaktpläne.
import { Button, Tooltip, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { Dismiss20Regular, MoreHorizontal20Regular } from '@fluentui/react-icons';
import { OverlayDrawer, DrawerBody } from '@fluentui/react-components';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/api/client';
import { seiteOeffnen } from '@/kern/befehle';
import { useEreignis } from '@/kern/ereignisse';
import { useDaten } from '@/kern/laden';
import { setzen, useDarfSchreiben, useStudio, zustand } from '@/kern/zustand';
import { fehlerMelden } from '@/komponenten/hinweise';
import { MenueKnopf, type MenueListe } from '@/komponenten/menue';
import { Bereich, Teilung } from '@/shell/arbeitsplatz';
import {
  aktuelleAuswahl, datumSetzen, datumText, planVergroessern, seitenansichtSetzen, tagKurz, tpAnsichtSetzen, tpBlattSetzen, tpKontextSetzen,
  tpKontextUmschalten, useTagesplanung, usePlanungsdatum, vpfad, type TpAnsicht, type TpKontext,
} from './kern';

/** Ansichten der Tagesplanung (Menü „Ansicht“). */
const ANSICHTEN_TP: { wert: TpAnsicht; text: string; titel: string }[] = [
  { wert: 'faelle', text: 'Fall für Fall', titel: 'Klasse für Klasse: der Tag der Klasse, ihre Fälle (Doppelstunden als ein Block) und die Entscheidung' },
  { wert: 'klassen', text: 'Übersicht nach Klassen', titel: 'Tagesübersicht: alle Klassen × Stunden' },
  { wert: 'lehrer', text: 'Übersicht nach Lehrkräften', titel: 'Tagesübersicht: alle Lehrkräfte × Stunden – Abwesende zuerst' },
  { wert: 'liste', text: 'Offene Stunden als Liste', titel: 'Eine offene Stunde nach der anderen: Empfehlung, Alternativen, Entfall' },
  { wert: 'tabelle', text: 'Tabelle', titel: 'Alle Vertretungen als Tabelle mit direkter Eingabe und Mehrfachauswahl' },
];
import { sendeStatus, useDirekt, direktBeobachten } from '../untplanweb/Senden';
import { blockSetzen, useFallKopf, useKandidaten, vorschlaegeAnfordern } from './ablauf/daten';
import { Miniplaene, miniplaeneUmschalten, useMiniplaene } from './ablauf/Miniplan';
import './ablauf/ablauf.css';

const useStile = makeStyles({
  seite: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0 },
  blatt: { maxWidth: '100vw' },
  blattKoerper: { padding: 0, display: 'flex', flexDirection: 'column', minHeight: 0 },
  blattKopf: {
    display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 12px 12px 16px', flexShrink: 0,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  blattTitel: { margin: 0, fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold, flex: 1, minWidth: 0 },
  blattInhalt: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' },
  blattTeil: { display: 'flex', flexDirection: 'column', minHeight: '320px', flexShrink: 0, borderTop: `1px solid ${tokens.colorNeutralStroke2}` },
});

const TAGE_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
/** „Montag, 2. November“ */
function tagLang(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return `${TAGE_LANG[d.getDay()]}, ${d.getDate()}. ${MONATE[d.getMonth()]}`;
}
const mehrzahl = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;

interface Wochentag { datum: string; offen: number; abwKl: number; freis: number; blRaeume: number; tagestexte: number; kollL: number; kollR: number; frei: string; unterrichtstag: boolean }
interface TagesStand { wochentyp: string; unterrichtstag: boolean; tag?: Wochentag; woche: Wochentag[]; abwesend: Record<string, number> }

/** Stand des Planungstags (Kalender und Abwesenheiten) – für Kopf und Blätter. */
function useTagesStand() {
  const datum = usePlanungsdatum();
  const tageProWoche = useStudio((x) => x.grunddaten?.zeitraster?.tage?.length || 5);
  return useDaten(async (): Promise<TagesStand> => {
    const [k, abw] = await Promise.all([
      api.get<{ wochentyp: string; unterrichtstag: boolean; woche: Wochentag[] }>(vpfad(`/kalender?datum=${datum}`)),
      api.get<{ anzahl: Record<string, number> }>(vpfad(`/absenzen?art=lehrer&von=${datum}&bis=${datum}&veranstaltungen=false`)),
    ]);
    const woche = k.woche.filter((w, i) => i < tageProWoche || w.unterrichtstag);
    return { wochentyp: k.wochentyp, unterrichtstag: k.unterrichtstag, tag: k.woche.find((w) => w.datum === datum), woche, abwesend: abw.anzahl || {} };
  }, [datum, tageProWoche], { bereiche: ['Vertretung', 'Stammdaten', 'Einstellungen'], aktiv: !!datum });
}

/** Wochenstreifen (nur in der Wochenansicht): Tage der Woche mit der Zahl offener Vertretungen; Klick wechselt den Planungstag. */
function Wochenstreifen({ woche, datum }: { woche: Wochentag[]; datum: string }) {
  return (
    <span className="tp-woche" role="group" aria-label="Woche – offene Vertretungen je Tag" data-testid="wochenstreifen">
      {woche.map((w) => {
        const aktiv = w.datum === datum;
        return (
          <button key={w.datum} type="button" aria-pressed={aktiv} data-datum={w.datum} className={mergeClasses('vt-wtag', aktiv && 'aktiv', !w.unterrichtstag && 'frei', w.offen > 0 && 'offen')}
            title={`${tagLang(w.datum)}: ${w.unterrichtstag ? (w.offen ? mehrzahl(w.offen, 'offene Vertretung', 'offene Vertretungen') : 'keine offenen Vertretungen') : w.frei || 'kein Unterrichtstag'}`}
            onClick={() => { if (!aktiv) datumSetzen(w.datum).catch(fehlerMelden); }}>
            <span className="vt-wtag-name">{tagKurz(w.datum)}</span>
            <span className="vt-wtag-zahl">{w.unterrichtstag ? (w.offen || '–') : 'frei'}</span>
          </button>
        );
      })}
    </span>
  );
}

/**
 * Kopf der Tagesplanung (eine Zeile im Seitenkopf): Tag, Wochentyp, offene Stunden und Kollisionen; rechts Liste | Tabelle,
 * Pläne (ein-/ausblenden), Abwesenheiten (Blatt), Veröffentlichen (Blatt mit Stand der letzten Übertragung) und „…“.
 * Das Datum selbst blättert man in der Kopfleiste (Strg+Bild↑/↓).
 */
export function TagesplanungKopf() {
  const datum = usePlanungsdatum();
  const schreiben = useDarfSchreiben();
  const ansicht = useTagesplanung((x) => x.ansicht);
  const kontextOffen = useTagesplanung((x) => x.kontextOffen);
  const seite = useTagesplanung((x) => x.seite);
  const block = useKandidaten((x) => x.block);
  const matrix = ansicht === 'klassen' || ansicht === 'lehrer';
  const faelle = ansicht === 'faelle';
  const fk = useFallKopf();
  const miniFolgt = useMiniplaene((x) => x.fenster.some((f) => f.folgt));
  const direkt = useDirekt((x) => x.stand);
  const sendet = useDirekt((x) => x.sendet);
  useEffect(() => { direktBeobachten(); }, []);
  const [liste, setListe] = useState<{ entfall: number } | null>(null);
  const { daten } = useTagesStand();
  useEreignis('vertretung.liste', (x) => { if (x.von === datum && x.bis === datum) setListe({ entfall: x.entfall }); else setListe(null); });
  useEreignis('vertretung.datum', () => setListe(null));
  const t = daten?.tag;
  const abw = daten ? (daten.abwesend.lehrer || 0) + (daten.abwesend.klasse || 0) + (daten.abwesend.raum || 0) : 0;
  const koll = t ? t.kollL + t.kollR : 0;
  const st = sendeStatus(direkt, sendet);
  const mehr = (): MenueListe => [
    { text: 'Wer ist frei?', taste: 'F', aktion: () => tpKontextSetzen('frei') },
    { text: 'Alle Kandidaten der Stunde', taste: 'V', aktion: () => tpKontextSetzen('vorschlag') },
    faelle ? null : { text: 'Pläne von Klasse und Lehrkraft', taste: matrix ? undefined : 'P', haken: kontextOffen, aktion: () => tpKontextUmschalten() },
    matrix ? { text: 'Miniplan (folgt der Auswahl)', taste: 'P', haken: miniFolgt, aktion: () => miniplaeneUmschalten(ansicht === 'lehrer' ? 'klasse' : 'lehrer') } : null,
    null,
    faelle ? null : { text: 'Ganze Woche', haken: seite === 'woche', hinweis: 'Tabelle und Pläne zeigen die ganze Woche, dazu der Wochenstreifen', aktion: () => seitenansichtSetzen(seite === 'woche' ? 'tag' : 'woche') },
    faelle ? null : { text: 'Blöcke gemeinsam besetzen', haken: block, hinweis: 'Doppel- und Blockstunden gemeinsam besetzen (Kandidaten müssen in allen Stunden frei sein)', aktion: () => blockSetzen(!block) },
    null,
    { text: 'Alle Abwesenheiten', taste: 'Strg+M', aktion: () => seiteOeffnen('vertretung.absenzen') },
    { text: 'Kalender und Tagestexte', aktion: () => seiteOeffnen('vertretung.kalender') },
    { text: 'Belastung der Lehrkräfte', aktion: () => tpBlattSetzen('veroeffentlichen') },
    { text: 'Automatische Vertretung …', deaktiviert: !schreiben, aktion: () => import('./weitere').then((w) => w.automatikDialog(datum, datum)) },
    { text: 'Einstellungen der Vertretungsplanung …', aktion: () => import('./weitere').then((w) => w.einstellungenDialog(0)) },
  ];
  return (
    <div className="tp-kopf" data-testid="tageskopf">
      <span className="tp-kopf-tag">
        {datum ? <span className="tp-kopf-datum" title={datumText(datum)}><span className="tp-lang">{tagLang(datum)}</span><span className="tp-kurz">{`${tagKurz(datum)} ${Number(datum.slice(8, 10))}.${Number(datum.slice(5, 7))}.`}</span></span> : null}
        {daten?.wochentyp ? <span className="tp-leise">{`${daten.wochentyp}-Woche`}</span> : null}
      </span>
      <span className="tp-kopf-summe" data-testid="tagessumme">
        {daten && !daten.unterrichtstag ? <span className="tp-frei">{t?.frei || 'kein Unterrichtstag'}</span>
          : daten && faelle ? <>
            <span className={fk.offen ? 'tp-offen-fall' : undefined} title="Offene Fälle (Stunde bzw. Block)" data-testid="fa-zahl-offen">{`${fk.offen} offen`}</span>
            <span title="Gelöste Fälle des Tages" data-testid="fa-zahl-erledigt">{`${fk.erledigt} erledigt`}</span>
            {daten.abwesend.lehrer ? <span className="tp-breit">{`${daten.abwesend.lehrer} abwesend`}</span> : null}
            {koll ? <span className="tp-offen" title={`Lehrkräfte ${t!.kollL} · Räume ${t!.kollR}`}>{mehrzahl(koll, 'Kollision', 'Kollisionen')}</span> : null}
          </>
          : daten ? <>
            <span className={t?.offen ? 'tp-offen' : undefined} title="Offene Vertretungen des Tages">{`${t?.offen ?? 0} offen`}</span>
            {liste?.entfall ? <span>{mehrzahl(liste.entfall, 'Entfall', 'Entfälle')}</span> : null}
            {koll ? <span className="tp-offen" title={`Lehrkräfte ${t!.kollL} · Räume ${t!.kollR}`}>{mehrzahl(koll, 'Kollision', 'Kollisionen')}</span> : null}
            {t?.tagestexte ? <span className="tp-breit">{mehrzahl(t.tagestexte, 'Tagestext', 'Tagestexte')}</span> : null}
          </> : null}
      </span>
      {seite === 'woche' && daten && datum ? <Wochenstreifen woche={daten.woche} datum={datum} /> : null}
      <span className="tp-kopf-rechts">
        {faelle ? null : matrix ? (
          <Button size="small" appearance={miniFolgt ? 'secondary' : 'subtle'} aria-pressed={miniFolgt} className={mergeClasses('tp-schalter', miniFolgt && 'an')} onClick={() => miniplaeneUmschalten(ansicht === 'lehrer' ? 'klasse' : 'lehrer')}
            title="Kleiner verschiebbarer Plan der Lehrkraft (bzw. Klasse) der gewählten Stunde, folgt der Auswahl (P) – weitere über das Kontextmenü einer Zelle oder eines Kandidaten" data-testid="tp-miniplan">Miniplan</Button>
        ) : (
          <Button size="small" appearance={kontextOffen ? 'secondary' : 'subtle'} aria-pressed={kontextOffen} className={mergeClasses('tp-schalter', kontextOffen && 'an')} onClick={() => tpKontextUmschalten()}
            title="Pläne von Klasse und Lehrkraft, Wer ist frei? und alle Kandidaten neben der Entscheidung (P)" data-testid="tp-plaene">Pläne</Button>
        )}
        <Button size="small" appearance="subtle" onClick={() => tpBlattSetzen('abwesenheiten')} title="Abwesenheiten des Tages ansehen und erfassen – mehrere Lehrkräfte auf einmal (N)" data-testid="tp-abwesenheiten">
          {faelle ? 'Abwesenheiten erfassen' : <>Abwesenheiten<span className="tp-zahl">{abw}</span></>}
        </Button>
        {faelle && schreiben ? (
          <Button size="small" appearance="subtle" disabled={fk.laeuft || !fk.offen} onClick={vorschlaegeAnfordern} data-testid="fa-alle-vorschlaege"
            title="Für alle offenen Fälle die beste Lösung vorschlagen (ganze Blöcke, wie die automatische Vertretung) – zur Prüfung, noch ohne Änderung">
            {fk.laeuft ? 'Wird berechnet …' : 'Vorschläge für alle'}
          </Button>
        ) : null}
        <span className="tp-veroeffentlichen" data-testid="tageskopf-senden">
          <Tooltip relationship="description" content={st.titel || st.text || 'Prüfen, an EduOrga Web senden und drucken'}>
            <Button size="small" onClick={() => tpBlattSetzen('veroeffentlichen')} data-testid="tp-veroeffentlichen" data-stand={st.art || ''}>Veröffentlichen</Button>
          </Tooltip>
          {st.text && direkt?.eingerichtet ? <span className={mergeClasses('tp-sendestand', st.fehler && 'tp-offen')} data-testid="untplanweb-senden">{st.text}</span> : null}
        </span>
        <MenueKnopf art="knopf" size="small" appearance="subtle" text="Ansicht" titel="Fall für Fall, Übersichten, Liste oder Tabelle" testid="tp-modus"
          eintraege={() => ANSICHTEN_TP.map((a) => ({ text: a.text, hinweis: a.titel, haken: a.wert === ansicht, aktion: () => tpAnsichtSetzen(a.wert) }))} />
        <MenueKnopf art="knopf" size="small" appearance="subtle" text="" titel="Weitere Ansichten und Einstellungen" icon={<MoreHorizontal20Regular />} eintraege={mehr} testid="tp-mehr" />
      </span>
    </div>
  );
}

const KONTEXTE: { wert: TpKontext; text: string; taste: string; titel: string }[] = [
  { wert: 'plaene', text: 'Pläne', taste: 'P', titel: 'Tagespläne von Klasse und Lehrkraft der gewählten Stunde (Verlegen und Tauschen per Drag & Drop)' },
  { wert: 'frei', text: 'Wer ist frei?', taste: 'F', titel: 'Alle Lehrkräfte × Stunden des Tages mit Belastung' },
  { wert: 'vorschlag', text: 'Alle Kandidaten', taste: 'V', titel: 'Vollständiger Vertretungsvorschlag: Lehrkräfte, Betreuungen, Räume, Vorziehungen' },
];

/** Seitenbereich neben der Entscheidung: folgt der gewählten Stunde. Bereiche bleiben nach dem ersten Zeigen eingehängt. */
function Kontext({ woche, gross }: { woche: boolean; gross: string | null }) {
  const kontext = useTagesplanung((x) => x.kontext);
  const [gezeigt, setGezeigt] = useState<Set<TpKontext>>(() => new Set([kontext]));
  useEffect(() => { setGezeigt((g) => (g.has(kontext) ? g : new Set([...g, kontext]))); }, [kontext]);
  const sichtbar = (k: TpKontext) => ({ display: kontext === k ? 'flex' : 'none', flex: 1, minHeight: 0, minWidth: 0, flexDirection: 'column' as const });
  return (
    <div className="ta-kontext" data-testid="tp-kontext" data-kontext={kontext}>
      <div className="ta-kontext-reiter" role="tablist" aria-label="Zur gewählten Stunde" style={gross ? { display: 'none' } : undefined}>
        {KONTEXTE.map((k) => (
          <button key={k.wert} type="button" role="tab" aria-selected={k.wert === kontext} className={`ta-reiter${k.wert === kontext ? ' aktiv' : ''}`} title={`${k.titel} (Taste ${k.taste})`}
            data-kontext={k.wert} onClick={() => tpKontextSetzen(k.wert)}>{k.text}</button>
        ))}
        <Tooltip content="Ausblenden (P)" relationship="label">
          <Button size="small" appearance="subtle" className="ta-kontext-zu" icon={<Dismiss20Regular />} onClick={() => tpKontextUmschalten(false)} data-testid="tp-kontext-zu" />
        </Tooltip>
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

/** Blätter der Tagesplanung: Abwesenheiten (erfassen und Liste des Tages) und Veröffentlichen (Prüfen, Senden, Drucken, Belastung). */
function Blaetter() {
  const s = useStile();
  const blatt = useTagesplanung((x) => x.blatt);
  const datum = usePlanungsdatum();
  const [breit, setBreit] = useState(() => window.innerWidth);
  useEffect(() => { const f = () => setBreit(window.innerWidth); addEventListener('resize', f); return () => removeEventListener('resize', f); }, []);
  const breite = `${Math.min(blatt === 'abwesenheiten' ? 760 : 720, breit - 48)}px`;
  const kopf = (titel: string) => (
    <div className={s.blattKopf}>
      <h2 className={s.blattTitel}>{titel}</h2>
      <Tooltip content="Schließen (Esc)" relationship="label"><Button appearance="subtle" icon={<Dismiss20Regular />} onClick={() => tpBlattSetzen(null)} data-testid="blatt-zu" /></Tooltip>
    </div>
  );
  const tag = datum ? `${tagKurz(datum)} ${datumText(datum)}` : '';
  return (
    <>
      <OverlayDrawer open={blatt === 'abwesenheiten'} position="end" modalType="non-modal" className={s.blatt} style={{ width: breite }}
        onOpenChange={(_, d) => { if (!d.open) tpBlattSetzen(null); }} data-testid="blatt-abwesenheiten">
        <DrawerBody className={s.blattKoerper}>
          {kopf(`Abwesenheiten · ${tag}`)}
          {blatt === 'abwesenheiten' ? (
            <div className={s.blattInhalt}>
              <div className="tp-blatt-oben"><Bereich id="erfassen" typ="vertretung.erfassen" p={{ eingebettet: true }} flach /></div>
              <div className={s.blattTeil} style={{ flex: 1 }}><Bereich id="abwesenheiten" typ="vertretung.absenzen" p={{ zeitraum: 'tag' }} flach /></div>
            </div>
          ) : null}
        </DrawerBody>
      </OverlayDrawer>
      <OverlayDrawer open={blatt === 'veroeffentlichen'} position="end" modalType="non-modal" className={s.blatt} style={{ width: breite }}
        onOpenChange={(_, d) => { if (!d.open) tpBlattSetzen(null); }} data-testid="blatt-veroeffentlichen">
        <DrawerBody className={s.blattKoerper}>
          {kopf(`Prüfen und veröffentlichen · ${tag}`)}
          {blatt === 'veroeffentlichen' ? (
            <div className={s.blattInhalt}>
              <div className="tp-blatt-oben"><Bereich id="pruefen" typ="vertretung.tagesbilanz" p={{ eingebettet: true }} flach /></div>
              <div className={s.blattTeil} style={{ minHeight: 240 }}><Bereich id="belastung" typ="vertretung.belastung" flach /></div>
            </div>
          ) : null}
        </DrawerBody>
      </OverlayDrawer>
    </>
  );
}

/** Unter 1440 px Breite die Seitenleiste auf dieser Seite einklappen (und beim Verlassen wieder zeigen, wenn sie offen war). */
function useNavEinklappen(grenze = 1440) {
  useEffect(() => {
    let eingeklappt = false;
    const pruefen = () => {
      const schmal = window.innerWidth < grenze;
      if (schmal && !zustand().navEingeklappt) { setzen({ navEingeklappt: true }); eingeklappt = true; }
    };
    pruefen();
    const m = window.matchMedia(`(max-width: ${grenze - 1}px)`);
    m.addEventListener('change', pruefen);
    return () => {
      m.removeEventListener('change', pruefen);
      if (eingeklappt && zustand().navEingeklappt && window.innerWidth > 900) setzen({ navEingeklappt: false });
    };
  }, [grenze]);
}

/**
 * Tagesplanung: Klassen (Standard) bzw. Lehrkräfte – die Tagesübersicht als Matrix × Stunden mit der Entscheidung rechts und
 * frei verschiebbaren Miniplänen; Offene Stunden: links die offenen Stunden des Tages, rechts
 * die Entscheidung zur gewählten Stunde (Empfehlung, Alternativen, Entfall, weitere Möglichkeiten). Tabelle: alle Vertretungen
 * als dichte Tabelle (direkte Eingabe, Mehrfachauswahl, Kandidaten in der Auswahlliste) mit derselben Entscheidung daneben.
 * „Pläne“ blendet rechts die Tagespläne von Klasse und Lehrkraft, „Wer ist frei?“ und alle Kandidaten ein; Abwesenheiten und
 * Veröffentlichen öffnen jeweils ein Blatt. Esc stellt einen vergrößerten Plan wieder zurück bzw. schließt ein Blatt.
 */
export function Tagesplanung() {
  const s = useStile();
  const ansicht = useTagesplanung((x) => x.ansicht);
  const kontextOffen = useTagesplanung((x) => x.kontextOffen);
  const woche = useTagesplanung((x) => Object.values(x.plaene).some((v) => v === 'woche'));
  const gross = useTagesplanung((x) => x.gross);
  const blatt = useTagesplanung((x) => x.blatt);
  useNavEinklappen();
  const blattRef = useRef(blatt); blattRef.current = blatt;
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('[role=dialog]:not(.fui-OverlayDrawer), [role=menu], [role=listbox]:not([data-testid=arbeitsliste])')) return;
      if (blattRef.current) { tpBlattSetzen(null); return; }
      if (useTagesplanung.getState().gross) planVergroessern(null);
    };
    document.addEventListener('keydown', taste);
    return () => document.removeEventListener('keydown', taste);
  }, []);
  // Taste N: Abwesenheit erfassen
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || e.defaultPrevented || e.key.toLowerCase() !== 'n') return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, select, [contenteditable=true], [data-tabelle], [role=dialog], [role=menu]')) return;
      e.preventDefault(); tpBlattSetzen('abwesenheiten');
    };
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  }, []);
  useEffect(() => () => { planVergroessern(null); tpBlattSetzen(null); }, []);
  // offene Änderungen aus EduOrga Web beim Öffnen anbieten (Rückmeldungen, Stundenplanänderungen)
  useEffect(() => { void import('./ablauf/WebImport').then((m) => m.webAenderungenAnbieten()); }, []);
  const nurKontext = gross ? 1 : null;
  const kontext = <Kontext woche={woche} gross={gross} />;
  let inhalt;
  if (ansicht === 'faelle') {
    const fl = <Bereich id="faelle" typ="vertretung.faelle" flach />;
    inhalt = kontextOffen ? <Teilung schluessel="tagesplanung.faelle.kontext" anteile={[66, 34]} nur={nurKontext}>{fl}{kontext}</Teilung> : fl;
  } else if (ansicht === 'klassen' || ansicht === 'lehrer') {
    const art = ansicht === 'lehrer' ? 'lehrer' : 'klasse';
    const m = <Bereich key={art} id={`matrix-${art}`} typ="vertretung.matrix" p={{ art }} />;
    inhalt = kontextOffen ? (
      <Teilung schluessel="tagesplanung.matrix.kontext" anteile={[66, 34]} nur={nurKontext}>
        {m}
        {kontext}
      </Teilung>
    ) : m;
  } else if (ansicht === 'liste') {
    inhalt = kontextOffen ? (
      <Teilung schluessel={woche ? 'tagesplanung.liste.kontext.woche' : 'tagesplanung.liste.kontext'} anteile={woche ? [44, 56] : [56, 44]} nur={nurKontext}>
        <Bereich id="arbeitsliste" typ="vertretung.arbeitsliste" />
        {kontext}
      </Teilung>
    ) : <Bereich id="arbeitsliste" typ="vertretung.arbeitsliste" />;
  } else {
    const links = (
      <Teilung schluessel="tagesplanung.tabelle" anteile={[64, 36]}>
        <Bereich id="liste" typ="vertretung.liste" p={{ schlank: true, tagesplanung: true }} />
        <Bereich id="entscheidung" typ="vertretung.entscheidung" />
      </Teilung>
    );
    inhalt = kontextOffen ? (
      <Teilung schluessel={woche ? 'tagesplanung.tabelle.kontext.woche' : 'tagesplanung.tabelle.kontext'} anteile={woche ? [45, 55] : [58, 42]} nur={nurKontext}>
        <Teilung richtung="zeilen" schluessel="tagesplanung.tabelle.links" anteile={[60, 40]}>
          <Bereich id="liste" typ="vertretung.liste" p={{ schlank: true, tagesplanung: true }} />
          <Bereich id="entscheidung" typ="vertretung.entscheidung" />
        </Teilung>
        {kontext}
      </Teilung>
    ) : links;
  }
  return (
    <div className={s.seite} data-ansicht-art={woche ? 'woche' : 'tag'} data-tp-ansicht={ansicht} data-kontext-offen={kontextOffen || undefined}>
      {inhalt}
      <Blaetter />
      <Miniplaene />
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
