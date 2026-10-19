// Tagespläne im Vertretungsmodus: Woche des Planungsdatums für Klasse, Lehrkraft, Raum oder Fach mit allen Vertretungen –
// Änderungen hervorgehoben, Entfälle durchgestrichen, offene Stunden mit Plakette „Offen“, Online-Stunden gekennzeichnet.
// Umschalter Tag | Woche im Kopf: nur der Planungstag oder die ganze Woche (Planungstag mit Linie in der Markenfarbe und heller Fläche
// hervorgehoben; Klick auf eine Stunde bzw. den Kopf eines anderen Tages macht ihn zum Planungstag). In der Tagesplanung
// (Parameter tagesplanung) gilt die je Benutzer gemerkte Ansicht, sonst der Parameter tag. Drag & Drop
// (dnd-kit): Verlegen, Tauschen (mit Rückfrage), Verdrängen; Vormerkungen in den Plan ziehen. Kontextmenü: Stunde entfallen
// lassen, Entfall aufheben (auch Block), findet online statt, als Vormerkung beiseitelegen, Text, Änderungen zurücknehmen,
// Vertretungsvorschlag, Sondereinsatz, Lehrkraft abwesend melden. Klick auf eine Stunde: der verknüpfte Plan des anderen Typs
// folgt (Klassenplan → Lehrkraft der Stunde, Lehrkräfteplan → Klasse).
import { useDndMonitor, useDraggable } from '@dnd-kit/core';
import { Button, Tooltip, makeStyles, tokens } from '@fluentui/react-components';
import { ArrowMaximize16Regular, ArrowMinimize16Regular } from '@fluentui/react-icons';
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { api } from '@/api/client';
import type { Stunde } from '@/api/typen';
import { useAnsicht, type AnsichtProps } from '@/kern/ansichten';
import { melden, useEreignis } from '@/kern/ereignisse';
import { useDaten } from '@/kern/laden';
import { elemente, useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, ElementAuswahl, Trenner } from '@/komponenten/ansicht';
import { formular } from '@/komponenten/dialoge';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { MenueKnopf, menue, type MenueListe } from '@/komponenten/menue';
import { Raster, type RasterBlock } from '@/komponenten/raster/Raster';
import type { AblageDaten, ZiehDaten } from '@/komponenten/ziehen';
import { ersterOder, useElemente } from '../gemeinsam';
import { auswahlMelden, datumSetzen, mitRueckfragen, planansichtSetzen, planVergroessern, useTagesplanung, usePlanungsdatum, vpfad, type Zeitansicht } from './kern';
import { onlineStundeDialog } from './online';
import { Umschalter } from './steuer';
import './vertretung.css';

const TYPEN: Record<string, string> = { klasse: 'Klasse', lehrer: 'Lehrkraft', raum: 'Raum', fach: 'Fach' };
const STATUSTEXT: Record<string, string> = { Entfall: 'Entfall', Offen: 'Offen', Zusaetzlich: 'Zusatz', Vertreten: 'Vertretung', Frei: 'Frei' };

interface TEintrag {
  u: number; zeile: number; vtr?: number; fach: string; fachAlt?: string; klassen: string; lehrer: string; lehrerAlt?: string; raum: string; raumAlt?: string;
  status: string; art?: string; text?: string; durch?: boolean; gekoppelt?: boolean; fix?: boolean; farbe?: string | null; offen?: boolean;
  aufhebbar?: { u: number; zeile: number; block: number[] }[]; online?: boolean; onlineLink?: string | null; onlineAbweichend?: boolean;
}
interface TTag { kurz: string; text: string; datum: string; heute: boolean; unterrichtstag: boolean; frei?: string }
interface TPlan { element: { kurz: string; lang: string }; zeitraster: { stunden: Stunde[] }; tage: TTag[]; zellen: { tag: number; stunde: number; eintraege: TEintrag[] }[]; woche: string; datum: string; vormerkungen: number }

const useStile = makeStyles({
  info: { display: 'flex', alignItems: 'center', gap: '16px', padding: '4px 12px', fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, flexWrap: 'wrap', borderBottom: `1px solid ${tokens.colorNeutralStroke3}` },
  lg: { display: 'inline-flex', alignItems: 'center', gap: '6px' },
  lgPunkt: { width: '12px', height: '10px', borderRadius: '2px', display: 'inline-block' },
  vm: { color: 'var(--up-pruefung)' },
});

function Eintrag({ e, t, stunde, typ, kompakt, ziehbar, planId, gewaehlt, waehlen, kontext, doppel }: {
  e: TEintrag; t: TTag; stunde: number; typ: string; kompakt: boolean; ziehbar: boolean; planId: string; gewaehlt: boolean;
  waehlen: () => void; kontext: (ev: MouseEvent) => void; doppel: () => void;
}) {
  const zeilen = typ === 'lehrer' ? [e.klassen, e.raum] : typ === 'raum' ? [e.klassen, e.lehrer] : [e.lehrer, e.raum];
  const alt = typ === 'lehrer' ? [null, e.raumAlt] : typ === 'raum' ? [null, e.lehrerAlt] : [e.lehrerAlt, e.raumAlt];
  const geaendert = e.status !== 'Regulaer';
  const daten: ZiehDaten = {
    art: 'tagesstunde', plan: planId, von: t.datum, stunde, u: e.u, zeile: typ === 'lehrer' ? e.zeile : null, laenge: 1,
    vorschau: () => <div className="ra-vorschau"><b>{e.fach}</b> {e.klassen} · {e.lehrer}</div>,
  };
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: `${planId}|${t.datum}|${stunde}|${e.u}|${e.zeile}`, data: daten, disabled: !ziehbar });
  const wert = (neu: string, a: string | null | undefined) => {
    if (e.status === 'Offen' && !neu && typ !== 'lehrer') return a ? <span className="vt-alt">{a}</span> : <span className="vt-leer">–</span>;
    if (!a) return <>{neu || ''}</>;
    return <><span className="vt-neutext">{neu || '–'}</span><span className="vt-alt"> {a}</span></>;
  };
  const titel = [`${e.u ? `U-Nr. ${e.u}` : ''}${e.vtr ? ` · Vtr-Nr. ${e.vtr}` : ''}`, `${e.fach} – ${e.klassen} – ${e.lehrer || '???'}${e.raum ? ` – ${e.raum}` : ''}`,
    e.art ? `${e.art}${e.text ? `: ${e.text}` : ''}` : e.text, e.lehrerAlt ? `statt ${e.lehrerAlt}` : '', e.fix ? 'fixiert' : '',
    e.online ? `findet online statt${e.onlineLink ? `: ${e.onlineLink}` : ''}${e.onlineAbweichend ? ' (nur an diesem Tag)' : ''}` : e.onlineAbweichend ? 'findet an diesem Tag in Präsenz statt' : ''].filter(Boolean).join('\n');
  return (
    <div ref={setNodeRef} {...(ziehbar ? listeners : {})} {...(ziehbar ? attributes : {})} role="button" tabIndex={-1}
      className={`ra-eintrag vt-st-${e.status}${e.durch ? ' vt-durch' : ''}${geaendert ? ' vt-geaendert' : ''}${e.gekoppelt ? ' gekoppelt' : ''}${e.online ? ' vt-online' : ''}${ziehbar ? ' ziehbar' : ''}${gewaehlt ? ' gewaehlt' : ''}${isDragging ? ' zieht' : ''}`}
      style={e.farbe && !geaendert ? { ['--fachfarbe' as string]: e.farbe } : undefined} title={titel} data-vtr={e.vtr} data-u={e.u}
      onClick={waehlen} onDoubleClick={doppel} onContextMenu={(ev) => { ev.preventDefault(); ev.stopPropagation(); kontext(ev); }}>
      <span className="kopfzeile">
        <span className={`fach${e.fachAlt ? ' vt-rottext' : ''}`} title={e.fach || e.art || ''}>{e.fach || e.art || '—'}</span>
        {kompakt ? null : <span className="zeile3">{wert(zeilen[1] || '', alt[1])}</span>}
      </span>
      <span className="fusszeile">
        <span className="zeile2">{wert(zeilen[0] || '', alt[0])}</span>
        {e.online ? <span className="online">Online</span> : null}
        {geaendert && e.status ? <span className={`plakette vt-pl-${e.status}`}>{STATUSTEXT[e.status] || e.art || e.status}</span> : null}
      </span>
      {e.fix ? <span className="fix" title="fixiert" /> : null}
    </div>
  );
}

/** ISO-Kalenderwoche eines Datums (ISO). */
function kalenderwoche(iso: string): number {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return 0;
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const j = new Date(d.getFullYear(), 0, 4, 12);
  return 1 + Math.round(((d.getTime() - j.getTime()) / 864e5 - 3 + ((j.getDay() + 6) % 7)) / 7);
}

export default function Tagesplan({ p }: AnsichtProps) {
  const s = useStile();
  const a = useAnsicht();
  const typ = TYPEN[String(p.typ)] ? String(p.typ) : 'klasse';
  const schreiben = useDarfSchreiben();
  const datum = usePlanungsdatum();
  const liste = useElemente(typ);
  const element = ersterOder(liste, p.element);
  const verknuepft = p.verknuepft !== false;
  const kompakt = !!p.kompakt;
  const tagesplanung = !!p.tagesplanung;
  const gemerkt = useTagesplanung((x) => x.plaene[typ]);
  const gross = useTagesplanung((x) => x.gross === typ);
  const nurTag = tagesplanung ? gemerkt !== 'woche' : !!p.tag;
  const ansichtSetzen = (w: Zeitansicht) => { if (tagesplanung) planansichtSetzen(typ, w); else a.parameterSetzen({ tag: w === 'tag' }); };
  /**
   * Stunde gewählt: der verknüpfte Plan des anderen Typs folgt – im Klassenplan die Lehrkraft der Stunde (bei Vertretungen
   * die ursprüngliche wie in der Liste), im Lehrkräfte- bzw. Raumplan die (erste) Klasse.
   */
  const gegenstueckMelden = (e: TEintrag) => {
    if (!verknuepft) return;
    const ziel = typ === 'klasse' ? 'lehrer' : typ === 'lehrer' || typ === 'raum' ? 'klasse' : null;
    const kurz = (ziel === 'lehrer' ? e.lehrerAlt || e.lehrer : e.klassen)?.split(/[,\s]+/).map((x) => x.replace(/[()*?]/g, '')).find(Boolean);
    if (!ziel || !kurz) return;
    void elemente(ziel).then((l) => {
      const x = l.find((y) => y.k === kurz);
      if (x) melden('element', { typ: ziel, id: x.id, quelle: a.id });
    }).catch(() => {});
  };
  /** Tag eines anderen Datums gewählt: wird zum Planungstag (Tageskopf, Liste und Vorschlag folgen). */
  const zumTag = (d: string) => { if (d !== datum) datumSetzen(d).catch(fehlerMelden); };
  const planId = `tp-${a.id}`;
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [ziele, setZiele] = useState<(string | null)[][] | null>(null);

  const { daten: plan, laedt, neuLaden } = useDaten(() => api.get<TPlan>(vpfad(`/plan/${typ}/${element}?datum=${datum}`)), [typ, element, datum],
    { bereiche: ['Vertretung', 'Stundenplan', 'Unterricht', 'Stammdaten'], aktiv: element != null && !!datum });
  const planRef = useRef(plan); planRef.current = plan;

  useEffect(() => { if (element != null && p.element !== element) a.parameterSetzen({ element }); }, [element]); // eslint-disable-line react-hooks/exhaustive-deps
  useEreignis('element', (e) => { if (verknuepft && e.quelle !== a.id && e.typ === typ && e.id !== element) a.parameterSetzen({ element: e.id }); });
  useEreignis('vertretung.auswahl', (x) => {
    if (!verknuepft || x?.quelle === a.id || !x?.zeile) return;
    const z = x.zeile;
    const ziel = typ === 'klasse' ? z.klasse : typ === 'lehrer' ? (p.rolle === 'vertreter' ? z.vertreter : z.lehrer) : typ === 'raum' ? z.raum : null;
    if (ziel && ziel !== element) a.parameterSetzen({ element: ziel });
  });

  // ---- Ziehen: Zielstatus für Stunden aus diesem Plan ----
  const ladeNr = useRef(0);
  useDndMonitor({
    onDragStart: (ev) => {
      const d = ev.active.data.current as ZiehDaten | undefined;
      const pl = planRef.current;
      if (!d || d.art !== 'tagesstunde' || d.plan !== planId || !pl) return;
      const n = ++ladeNr.current;
      const z = d.zeile !== null && d.zeile !== undefined ? `&zeile=${d.zeile}` : '';
      api.get<(string | null)[][]>(vpfad(`/plan/zielstatus?von=${d.von}&stunde=${d.stunde}&unterricht=${d.u}${z}&laenge=${d.laenge}&woche=${pl.datum}`))
        .then((m) => { if (n === ladeNr.current) setZiele(m.map((r) => r.map((x) => (x === 'Kollision' ? null : x)))); }).catch(() => {});
    },
    onDragEnd: () => { ladeNr.current++; setZiele(null); },
    onDragCancel: () => { ladeNr.current++; setZiele(null); },
  });

  // Sichtbare Tage: ganze Woche oder nur der Planungstag (Index in plan.tage)
  const sichtbar = useMemo(() => {
    const alle = (plan?.tage || []).map((_, i) => i);
    if (!nurTag || !plan) return alle;
    const i = plan.tage.findIndex((t) => t.datum === datum);
    return i >= 0 ? [i] : alle;
  }, [plan, nurTag, datum]);

  const ablage = (tagIndex: number, stunde: number): AblageDaten | null => {
    const t = plan?.tage[tagIndex];
    if (!schreiben || !t?.unterrichtstag) return null;
    return {
      annehmen: (d) => d.art === 'tagesstunde' || d.art === 'vormerkung',
      ablegen: (d) => {
        if (d.art === 'vormerkung') {
          api.post(vpfad(`/vormerkungen/${d.id}/verplanen`), { datum: t.datum, stunde }, { quelle: a.id })
            .then(() => { hinweis('Vormerkung verplant.', 'ok', 2000); return neuLaden(true); }).catch(fehlerMelden);
          return;
        }
        mitRueckfragen<{ ok?: boolean; text?: string }>(vpfad('/plan/verlegen'), { von: d.von, vonStunde: d.stunde, unterricht: d.u, zeile: d.zeile, laenge: d.laenge, ziel: t.datum, zielStunde: stunde }, { quelle: a.id })
          .then((r) => { if (r?.ok && r.text) hinweis(`${r.text} – Strg+Z macht es rückgängig.`, 'ok', 2500); return neuLaden(true); }).catch(fehlerMelden);
      },
    };
  };

  async function aendern(pfad: string, d: Record<string, unknown>, rueckfragen = false) {
    if (rueckfragen) await mitRueckfragen(vpfad(pfad), d, { quelle: a.id });
    else await api.post(vpfad(pfad), d, { quelle: a.id });
    await neuLaden(true);
  }

  function kontext(e: TEintrag | null, tagIndex: number, stunde: number, ev: MouseEvent) {
    const pl = plan;
    if (!pl) return;
    const t = pl.tage[tagIndex]!;
    const pos = e ? { datum: t.datum, stunde, unterricht: e.u, zeile: typ === 'lehrer' ? e.zeile : null } : null;
    const findet = !!e && !e.durch && ['Regulaer', 'Vertreten', 'Offen', 'Zusaetzlich'].includes(e.status);
    const l: MenueListe = [{ titel: e ? `${t.kurz} ${t.text} ${stunde}. Std. · ${e.fach} ${e.klassen}` : `${t.kurz} ${t.text} ${stunde}. Std.` }];
    l.push({ text: 'Stunde entfallen lassen', deaktiviert: !schreiben || !findet || !e?.u, aktion: () => aendern('/plan/entfall', pos!, true) });
    const zelle = pl.zellen.find((z) => z.tag === tagIndex && z.stunde === stunde);
    const kandidaten: { x: TEintrag; a: { u: number; zeile: number; block: number[] } }[] = [];
    for (const x of [e, ...(zelle?.eintraege || [])]) for (const k of x?.aufhebbar || []) if (!kandidaten.some((y) => y.a.u === k.u && y.a.zeile === k.zeile)) kandidaten.push({ x: x!, a: k });
    for (const { x, a: k } of kandidaten) {
      const name = kandidaten.length > 1 ? `Entfall aufheben: ${x.fach} ${x.lehrerAlt || x.lehrer} ${x.klassen}` : 'Entfall aufheben';
      const p2 = { datum: t.datum, stunde, unterricht: k.u, zeile: k.zeile };
      if (k.block.length > 1) {
        l.push({ text: `${name} (Block ${k.block[0]}.–${k.block[k.block.length - 1]}. Stunde)`, deaktiviert: !schreiben, aktion: () => aendern('/plan/entfallrueckgaengig', { ...p2, block: true }) });
        l.push({ text: `${name} (nur ${stunde}. Stunde)`, deaktiviert: !schreiben, aktion: () => aendern('/plan/entfallrueckgaengig', p2) });
      } else l.push({ text: name, deaktiviert: !schreiben, aktion: () => aendern('/plan/entfallrueckgaengig', p2) });
    }
    if (e?.u && findet) l.push({ text: 'Findet online statt …', deaktiviert: !schreiben, aktion: async () => { if (await onlineStundeDialog({ datum: t.datum, stunde, unterricht: e.u }, a.id)) await neuLaden(true); } });
    l.push({ text: 'Sondereinsatz …', deaktiviert: !schreiben, aktion: () => import('./weitere').then((w) => w.sondereinsatzDialog({ datum: t.datum, stunde, klassen: typ === 'klasse' ? pl.element.kurz : '', lehrer: typ === 'lehrer' ? pl.element.kurz : '' })) });
    l.push({ text: 'Text …', deaktiviert: !schreiben || !findet || !e?.u, aktion: async () => {
      const w = await formular('Text zur Stunde', [{ name: 'text', titel: 'Text', wert: e!.text || '', hinweis: 'Wird im Stundenplan und im Vertretungsplan ausgegeben.' }], { okText: 'Speichern' });
      if (w) await aendern('/plan/text', { ...pos!, text: w.text });
    } });
    l.push(null);
    if (findet && e?.u) l.push({ text: 'Als Vormerkung beiseitelegen', deaktiviert: !schreiben, aktion: () => aendern('/plan/vormerken', pos!) });
    if (e?.vtr) {
      const vtr = e.vtr;
      l.push({ text: 'Vertretungsvorschlag', aktion: () => { auswahlMelden({ id: vtr, ids: [vtr], zeile: { v: vtr }, quelle: a.id }); a.oeffnen('vertretung.vorschlag', {}); } });
      l.push({ text: 'Änderungen zurücknehmen', deaktiviert: !schreiben, aktion: () => aendern('/plan/aenderungenrueckgaengig', { ids: [vtr] }) });
    }
    if (typ === 'lehrer' && element) l.push({ text: `${pl.element.kurz} am ${t.text} abwesend melden`, deaktiviert: !schreiben, aktion: async () => {
      const { absenzenSpeichern } = await import('./Absenzen');
      await absenzenSpeichern('lehrer', [{ id: 0, element: pl.element.kurz, von: t.datum, bis: t.datum, sv: 1, sb: 99 }], [], a.id, 'Abwesenheit eingeben');
      await neuLaden(true);
    } });
    menue(ev.clientX, ev.clientY, l);
  }

  const bloecke = useMemo<RasterBlock[]>(() => {
    if (!plan) return [];
    const st = plan.zeitraster.stunden;
    return plan.zellen.map((z): RasterBlock | null => {
      const j = st.findIndex((x) => x.nr === z.stunde);
      const spalte = sichtbar.indexOf(z.tag);
      if (j < 0 || spalte < 0) return null;
      const t = plan.tage[z.tag]!;
      return {
        key: `${z.tag}:${z.stunde}`, tag: spalte, von: j, laenge: 1,
        inhalt: z.eintraege.map((e) => {
          const k = `${z.tag}:${z.stunde}:${e.u}:${e.zeile}:${e.vtr ?? ''}`;
          return (
            <Eintrag key={k} e={e} t={t} stunde={z.stunde} typ={typ} kompakt={kompakt} planId={planId} gewaehlt={gewaehlt === k}
              ziehbar={schreiben && !e.durch && !!e.u && e.status !== 'Entfall'}
              waehlen={() => { setGewaehlt(k); zumTag(t.datum); gegenstueckMelden(e); if (e.vtr) auswahlMelden({ id: e.vtr, ids: [e.vtr], zeile: { v: e.vtr, datum: t.datum, stunde: z.stunde, u: e.u }, quelle: a.id }); }}
              doppel={() => { if (e.vtr) a.oeffnen('vertretung.vorschlag', {}); }}
              kontext={(ev) => kontext(e, z.tag, z.stunde, ev)} />
          );
        }),
      };
    }).filter((b): b is RasterBlock => !!b);
  }, [plan, typ, kompakt, gewaehlt, schreiben, sichtbar, datum]); // eslint-disable-line react-hooks/exhaustive-deps

  const zellenSichtbar = plan ? plan.zellen.filter((z) => sichtbar.includes(z.tag)) : [];
  const zaehlen = (zellen: TPlan['zellen']) => ({
    offen: zellen.reduce((x, z) => x + z.eintraege.filter((e) => e.offen && !e.durch).length, 0),
    entfall: zellen.reduce((x, z) => x + z.eintraege.filter((e) => e.status === 'Entfall').length, 0),
  });
  const { offen, entfall } = zaehlen(zellenSichtbar);
  const planTag = plan ? plan.tage.findIndex((t) => t.datum === datum) : -1;
  const amTag = !nurTag && plan && planTag >= 0 ? zaehlen(plan.zellen.filter((z) => z.tag === planTag)) : null;
  const lang = plan?.element.lang && !plan.element.lang.includes(plan.element.kurz) ? ` – ${plan.element.lang}` : '';
  // Wochenplan in der Tagesplanung: Auswahl und Optionen im Kopf, flachere Stunden, offene Stunden je Tag im Spaltenkopf
  const flach = tagesplanung && !nurTag;
  const offenJeTag = useMemo(() => {
    const n = new Map<number, number>();
    for (const z of plan?.zellen || []) n.set(z.tag, (n.get(z.tag) || 0) + z.eintraege.filter((e) => e.offen && !e.durch).length);
    return n;
  }, [plan]);
  const elementWahl = <ElementAuswahl typ={typ} liste={liste} wert={element} beiWahl={(id) => { a.parameterSetzen({ element: id }); melden('element', { typ, id, quelle: a.id }); }} />;
  const optionen = <MenueKnopf text="Optionen" art={flach ? 'knopf' : 'toolbar'} appearance={flach ? 'subtle' : undefined} titel="Verknüpfung mit der Auswahl, kompakte Darstellung, Vormerkungen" eintraege={() => [
    { text: 'Folgt der gewählten Vertretung', haken: verknuepft, aktion: () => a.parameterSetzen({ verknuepft: !verknuepft }) },
    ...(kompakt ? [{ text: 'Nur Planungstag', haken: nurTag, aktion: () => ansichtSetzen(nurTag ? 'woche' : 'tag') }] : []),
    { text: 'Kompakt', haken: kompakt, aktion: () => a.parameterSetzen({ kompakt: !kompakt }) },
    null,
    { text: 'Vormerkungen …', aktion: () => a.oeffnen('vertretung.vormerkungen', {}) },
    { text: 'Online-Stunden …', aktion: () => a.oeffnen('vertretung.online', {}) },
  ]} />;
  const titel = !plan ? 'Tagesplan' : flach ? `KW ${kalenderwoche(plan.tage[0]?.datum || datum || '')}`
    : tagesplanung ? `${TYPEN[typ]} ${plan.element.kurz}` : `${nurTag ? 'Tagesplan' : 'Wochenplan'} ${TYPEN[typ]} ${plan.element.kurz}${lang}`;

  return (
    <AnsichtRahmen titel={titel} laden={laedt && !plan}
      className={`${nurTag ? '' : 'vt-plan-woche'}${tagesplanung ? ' vt-plan-tp' : ''}`}
      aktionen={kompakt ? undefined : <>
        {flach ? <>{elementWahl}{optionen}</> : null}
        <Umschalter<Zeitansicht> wert={nurTag ? 'tag' : 'woche'} titel="Nur den Planungstag oder die ganze Woche zeigen" testid={`plan-ansicht-${typ}`} beiWahl={ansichtSetzen}
          optionen={[{ wert: 'tag', text: 'Tag', titel: 'Nur der Planungstag' }, { wert: 'woche', text: 'Woche', titel: 'Woche des Planungstags – Klick auf einen anderen Tag wechselt dorthin' }]} />
        {tagesplanung ? (
          <Tooltip content={gross ? 'Wieder neben Liste und Vorschlag zeigen (Esc)' : 'Plan vergrößern'} relationship="label">
            <Button size="small" appearance="subtle" data-testid={`plan-gross-${typ}`} icon={gross ? <ArrowMinimize16Regular /> : <ArrowMaximize16Regular />} onClick={() => planVergroessern(gross ? null : typ)} />
          </Tooltip>
        ) : null}
      </>}
      werkzeuge={flach ? undefined : <>{elementWahl}<Trenner />{optionen}</>}
      fuss={flach ? undefined : amTag ? <>
        <span title="Offene Stunden und Entfälle am Planungstag">{`${plan!.tage[planTag]!.kurz}: ${amTag.offen} offen · ${amTag.entfall} ${amTag.entfall === 1 ? 'Entfall' : 'Entfälle'}`}</span>
        <span title="in der ganzen Woche">{`Woche: ${offen} offen · ${entfall} ${entfall === 1 ? 'Entfall' : 'Entfälle'}`}</span>
      </> : <><span>{offen} offen</span><span>{entfall} {entfall === 1 ? 'Entfall' : 'Entfälle'}</span></>}>
      {plan && (nurTag || tagesplanung) && (plan.vormerkungen || !verknuepft) ? (
        <div className={s.info}>
          {plan.vormerkungen ? <span className={s.vm}>{`${plan.vormerkungen} offene Vormerkung${plan.vormerkungen === 1 ? '' : 'en'}`}</span> : null}
          {verknuepft ? null : <span className={s.vm} title="Der Plan folgt nicht der gewählten Vertretung">nicht verknüpft</span>}
        </div>
      ) : null}
      {plan && !nurTag && !tagesplanung ? (
        <div className={s.info}>
          <span>Woche {plan.woche}</span>
          <span className={s.lg}><i className={s.lgPunkt} style={{ border: '1.5px solid var(--up-aenderung)', background: 'var(--up-aenderung-flaeche)' }} />Vertretung</span>
          <span className={s.lg}><i className={s.lgPunkt} style={{ background: 'var(--up-entfall-flaeche)', border: '1px solid var(--up-entfall)' }} />Entfall</span>
          <span className={s.lg}><i className={s.lgPunkt} style={{ border: '1.5px dashed var(--up-entfall)' }} />Offen</span>
          <span className={s.lg}><i className={s.lgPunkt} style={{ background: 'var(--up-frei-flaeche)', border: '1px solid var(--up-frei)' }} />Online</span>
          {plan.vormerkungen ? <span className={s.vm}>{`${plan.vormerkungen} offene Vormerkung${plan.vormerkungen === 1 ? '' : 'en'}`}</span> : null}
          {verknuepft ? null : <span className={s.vm} title="Der Plan folgt nicht der gewählten Vertretung">nicht verknüpft</span>}
        </div>
      ) : null}
      {plan ? (
        <Raster id={planId} kompakt={kompakt || flach} stunden={plan.zeitraster.stunden} bloecke={bloecke} zeitAnzeigen={!kompakt} className={nurTag ? 'ra-tag' : flach ? 'vt-flach' : undefined}
          ziele={ziele ? sichtbar.map((i) => ziele[i] || []) : null} ablage={(i, st) => ablage(sichtbar[i]!, st)}
          tage={sichtbar.map((i) => {
            const t = plan.tage[i]!;
            const planungstag = !nurTag && t.datum === datum;
            const kopf = `${t.kurz} ${t.text}${nurTag && t.frei ? ` · ${t.frei}` : ''}`;
            const n = nurTag ? 0 : offenJeTag.get(i) || 0;
            const zahl = n ? <span className="vt-tag-offen" title={`${n} offen`}>{n}</span> : null;
            return {
              kopf: nurTag || planungstag ? <span>{kopf}{zahl}</span>
                : <button type="button" className="vt-tagwahl" title={`${t.frei ? `${t.frei} – ` : ''}Zum ${t.kurz} ${t.text} wechseln${n ? ` (${n} offen)` : ''}`} onClick={() => zumTag(t.datum)}>{kopf}{zahl}</button>,
              titel: t.frei || (planungstag ? `Planungstag${n ? ` – ${n} offen` : ''}` : ''),
              klasse: `${t.heute ? 'heute' : ''}${t.unterrichtstag ? '' : ' frei'}${planungstag ? ' vt-planungstag' : ''}`, gesperrt: !t.unterrichtstag,
            };
          })}
          feldKlasse={nurTag || planTag < 0 ? undefined : (i) => (sichtbar[i] === planTag ? 'vt-planungstag' : null)}
          feldKontextmenue={(i, st, ev) => kontext(null, sichtbar[i]!, st, ev)} />
      ) : null}
    </AnsichtRahmen>
  );
}
