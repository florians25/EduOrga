// Arbeitsplätze der Vertretungsplanung.
import { Button, Input, Link, Tooltip, makeStyles, tokens } from '@fluentui/react-components';
import { ChevronLeft20Regular, ChevronRight20Regular } from '@fluentui/react-icons';
import { useState } from 'react';
import { api } from '@/api/client';
import { seiteOeffnen } from '@/kern/befehle';
import { useEreignis } from '@/kern/ereignisse';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben, useStudio } from '@/kern/zustand';
import { fehlerMelden } from '@/komponenten/hinweise';
import { MenueKnopf } from '@/komponenten/menue';
import { Bereich, Teilung } from '@/shell/arbeitsplatz';
import { aktuelleAuswahl, blaettern, datumSetzen, isoAus, tagKurz, usePlanungsdatum, vpfad } from './kern';

const useStile = makeStyles({
  seite: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0, gap: '8px' },
  kopf: {
    display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px 16px', padding: '6px 12px', minHeight: '44px', flexShrink: 0,
    border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusLarge, backgroundColor: tokens.colorNeutralBackground1,
  },
  datum: { display: 'inline-flex', alignItems: 'center', gap: '2px' },
  datumFeld: { width: '150px', fontVariantNumeric: 'tabular-nums' },
  tag: { fontSize: tokens.fontSizeBase400, fontWeight: tokens.fontWeightSemibold, whiteSpace: 'nowrap', marginLeft: '6px', '@media (max-width: 1500px)': { display: 'none' } },
  woche: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase300, whiteSpace: 'nowrap' },
  frei: { color: 'var(--up-frei)', fontSize: tokens.fontSizeBase300, whiteSpace: 'nowrap' },
  summe: { display: 'inline-flex', alignItems: 'center', gap: '6px', color: tokens.colorNeutralForeground2, fontSize: tokens.fontSizeBase300, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' },
  punkt: { color: tokens.colorNeutralForeground4 },
  offen: { color: 'var(--up-entfall)', fontWeight: tokens.fontWeightSemibold },
  rechts: { marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
});

const TAGE_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
/** „Montag, 2.11.2026“ */
function tagLang(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return `${TAGE_LANG[d.getDay()]}, ${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

interface Wochentag { datum: string; offen: number; abwKl: number; freis: number; blRaeume: number; tagestexte: number; kollL: number; kollR: number; frei: string; unterrichtstag: boolean }
interface TagesStand { wochentyp: string; unterrichtstag: boolean; tag?: Wochentag; abwesend: Record<string, number> }
const mehrzahl = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;

/** Kopf der Tagesplanung: Datum blättern, A/B-Woche, Kennzahlen des Tages, Verweise auf Abwesenheiten und Kalender. */
function Tageskopf() {
  const s = useStile();
  const datum = usePlanungsdatum();
  const schreiben = useDarfSchreiben();
  const letzte = useStudio((x) => x.grunddaten?.zeitraster?.stunden?.length || 8);
  const [liste, setListe] = useState<{ entfall: number } | null>(null);
  const { daten } = useDaten(async (): Promise<TagesStand> => {
    const [k, abw] = await Promise.all([
      api.get<{ wochentyp: string; unterrichtstag: boolean; woche: Wochentag[] }>(vpfad(`/kalender?datum=${datum}`)),
      api.get<{ anzahl: Record<string, number> }>(vpfad(`/absenzen?art=lehrer&von=${datum}&bis=${datum}&veranstaltungen=false`)),
    ]);
    return { wochentyp: k.wochentyp, unterrichtstag: k.unterrichtstag, tag: k.woche.find((w) => w.datum === datum), abwesend: abw.anzahl || {} };
  }, [datum], { bereiche: ['Vertretung', 'Stammdaten', 'Einstellungen'], aktiv: !!datum });
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
    if (liste) teile.push({ text: mehrzahl(liste.entfall, 'Entfall', 'Entfälle') });
    if (t && t.kollL + t.kollR > 0) teile.push({ text: mehrzahl(t.kollL + t.kollR, 'Kollision', 'Kollisionen'), klasse: s.offen, titel: `Lehrkräfte ${t.kollL} · Räume ${t.kollR}` });
    if (t?.tagestexte) teile.push({ text: mehrzahl(t.tagestexte, 'Tagestext', 'Tagestexte') });
  }
  const erfassen = (art: 'lehrer' | 'klasse' | 'raum') => async () => {
    if (!datum) return;
    const { abwesenheitErfassen } = await import('./Absenzen');
    await abwesenheitErfassen(art, datum, letzte);
  };
  return (
    <div className={s.kopf} data-testid="tageskopf">
      <span className={s.datum}>
        <Tooltip content="Vorheriger Unterrichtstag (Strg+Bild↑)" relationship="label"><Button size="small" appearance="subtle" icon={<ChevronLeft20Regular />} onClick={los(() => blaettern(-1))} /></Tooltip>
        <Button size="small" appearance="subtle" onClick={los(() => datumSetzen(isoAus(new Date())))}>Heute</Button>
        <Tooltip content="Nächster Unterrichtstag (Strg+Bild↓)" relationship="label"><Button size="small" appearance="subtle" icon={<ChevronRight20Regular />} onClick={los(() => blaettern(1))} /></Tooltip>
        <Input size="small" type="date" className={s.datumFeld} value={datum || ''} aria-label="Datum der Tagesplanung" contentBefore={datum ? <span style={{ fontSize: 12 }}>{tagKurz(datum)}</span> : undefined} onChange={(_, x) => { if (x.value) void datumSetzen(x.value); }} />
        {datum ? <span className={s.tag}>{tagLang(datum)}</span> : null}
      </span>
      {daten?.wochentyp ? <span className={s.woche}>{`${daten.wochentyp}-Woche`}</span> : null}
      {daten && !daten.unterrichtstag ? <span className={s.frei}>{t?.frei || 'kein Unterrichtstag'}</span> : null}
      <span className={s.summe} data-testid="tagessumme">
        {teile.map((x, i) => (
          <span key={x.text} style={{ display: 'inline-flex', gap: 6 }}>
            {i ? <span className={s.punkt}>·</span> : null}<span className={x.klasse} title={x.titel}>{x.text}</span>
          </span>
        ))}
      </span>
      <span className={s.rechts}>
        <Link onClick={() => seiteOeffnen('vertretung.absenzen')} title="Abwesenheiten von Lehrkräften, Klassen und Räumen bearbeiten (Strg+M)">Abwesenheiten</Link>
        <Link onClick={() => seiteOeffnen('vertretung.kalender')} title="Woche mit offenen Vertretungen, Tagestexte und Kalendertag">Kalender</Link>
        {schreiben ? (
          <MenueKnopf art="knopf" appearance="secondary" text="Abwesenheit erfassen" titel="Neue Abwesenheit für diesen Tag erfassen" eintraege={[
            { text: 'Lehrkraft …', aktion: erfassen('lehrer') },
            { text: 'Klasse …', aktion: erfassen('klasse') },
            { text: 'Raum …', aktion: erfassen('raum') },
          ]} />
        ) : null}
      </span>
    </div>
  );
}

/**
 * Tagesplanung: oben der Tageskopf; links die Vertretungen des Tages (schlanke Liste) und darunter der Vorschlag zur gewählten
 * Vertretung; rechts die Tagespläne von Klasse und Lehrkraft (folgen der Auswahl). Kalender und Abwesenheiten haben eigene Seiten.
 */
export function Tagesplanung() {
  const s = useStile();
  return (
    <div className={s.seite}>
      <Tageskopf />
      <Teilung schluessel="tagesplanung.v2" anteile={[58, 42]}>
        <Teilung richtung="zeilen" schluessel="tagesplanung.v2.links" anteile={[56, 44]}>
          <Bereich id="liste" typ="vertretung.liste" p={{ schlank: true }} />
          <Bereich id="vorschlag" typ="vertretung.vorschlag" />
        </Teilung>
        <Teilung schluessel="tagesplanung.v2.plaene" anteile={[50, 50]}>
          <Bereich id="plan-klasse" typ="vertretung.plan" p={{ typ: 'klasse', tag: true }} />
          <Bereich id="plan-lehrer" typ="vertretung.plan" p={{ typ: 'lehrer', tag: true }} />
        </Teilung>
      </Teilung>
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
