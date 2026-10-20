// „Fall für Fall“ – Standardansicht der Tagesplanung. Ein Fall ist eine Stunde bzw. ein Block (Doppelstunde) einer fehlenden
// Lehrkraft; laufen in der Klasse mehrere Stunden gleichzeitig (Teilungsgruppen, Kurse, Kopplungen, zwei fehlende Lehrkräfte), sind sie
// ein Fall mit parallelen Gruppen („E (Gr. 1) + F (Gr. 2)“). Links die Klassen mit Fällen in fester Reihenfolge (wahlweise die
// abwesenden Lehrkräfte), in der Mitte der ganze Tag der gewählten Klasse als eine Leiste (feste Spalten je Stunde, gleichzeitige
// Gruppen übereinander) und darunter ihre Fälle, rechts die Entscheidung für den gewählten Fall: die besten Lehrkräfte für den ganzen
// Block bzw. für alle Gruppen mit Begründung in Worten, „Übernehmen“ mit einem Klick, daneben Entfall, Verlegen (eine andere Stunde
// in die Lücke vorziehen), Zusammenlegen, ohne Lehrkraft und weitere Lösungen; bei Gruppen auch je Gruppe einzeln. Stunden der Leiste
// lassen sich auf eine andere Stunde ziehen: dann zeigt die Leiste je Stunde, ob es geht (mit Grund), und darunter der Tag der
// beteiligten Lehrkräfte und des Raums. Nach jeder Entscheidung ist der nächste offene Fall gewählt – nichts ordnet sich um, Zellen
// ändern nur ihren Inhalt.
// Tasten: ↑/↓ Fall, Bild↑/↓ Klasse, G Gruppe, 1–5 Lehrkraft wählen, Enter übernehmen, E Entfall, V verlegen, B zusammenlegen,
// O ohne Lehrkraft, Z rückgängig, Esc zurück.
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Button, Input, Spinner, mergeClasses } from '@fluentui/react-components';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '@/api/client';
import { rueckgaengig } from '@/kern/dokument';
import { useDaten } from '@/kern/laden';
import { elemente, useDarfSchreiben, useStudio } from '@/kern/zustand';
import { formular } from '@/komponenten/dialoge';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { MenueKnopf, type MenueListe } from '@/komponenten/menue';
import { useZiehen, type AblageDaten, type ZiehDaten } from '@/komponenten/ziehen';
import { raumDialog } from '../dialoge';
import { seiteOeffnen } from '@/kern/befehle';
import { tpAnsichtSetzen, tpBlattSetzen, usePlanungsdatum, vpfad } from '../kern';
import {
  QUELLE, alleBetreuen, alleZuweisen, auswahlSetzen, entfallen, fallKandidaten, fallLoesen, fallVorschlaegeLaden, fallZieleLaden, faelleLaden,
  hinweisSetzen, mehrzahl, ohneLehrkraft, stundeVerlegen, useFallKopf, useFallStand, vorschlaegeAnwenden, vorschlagEintraege, vorschlagUebernehmen,
  vormerken, vorziehen, vorziehungenLaden, zuruecksetzen,
  type Fall, type FallKandidat, type FallKandidaten, type FallKlasse, type FallStatistik, type FallVorschlag, type FallZiele, type FaelleDaten, type Vorziehung, type ZielStatus,
} from './daten';
import { Tagesreihe, miniplanOeffnen } from './Miniplan';
import './faelle.css';

/** Stunde in der Leiste (Kurzform der Tagesübersicht, siehe VertretungApi.Matrix). */
interface ME {
  v: number | null; u: number | null; s: string; f: string; fa: string; l: string; la: string; r: string; ra: string; k: string; g?: string;
  li: number | null; lo: number | null; ri: number | null; ki: number | null; art: string; t: string; kl: boolean; w?: boolean; vn?: string; vv?: string;
}
interface MZeile { id: number; k: string; name: string; abw: { s: number; a: 'absenz' | 'termin'; id: number; t: string }[]; zellen: { s: number; e: ME[] }[] }
interface MDaten { stunden: { nr: number; zeit: string }[]; zeilen: MZeile[] }

type Modus = 'klasse' | 'lehrer';
interface Gruppe { id: string; k: string; titel: string; zusatz: string; elementId: number | null; faelle: Fall[]; jahrgang?: string }
interface Wahl { gruppe: string; fall: string | null }
/** Laufender Zug in der Leiste: gezogene Stunde bzw. Block (oder eine vorziehbare Stunde aus der Liste „Verlegen“). */
interface Zug { von: string; stunde: number; laenge: number; u: number; fach: string; vorziehung?: { gap: number; luecke: number; vz: Vorziehung } }

const PRIO: Record<string, number> = { o: 0, ro: 1, v: 2, r: 2, x: 2, z: 2, k: 2, t: 2, e: 3, n: 4, b: 5 };
const jahrgangRang = (j: string) => (/^\d+$/.test(j) ? Number(j) : j === 'EF' ? 11 : j === 'Q1' ? 12 : j === 'Q2' ? 13 : 99);
const klassenFolge = (a: FallKlasse, b: FallKlasse) => jahrgangRang(a.jahrgang) - jahrgangRang(b.jahrgang) || a.k.localeCompare(b.k, 'de', { numeric: true });
const stdText = (s: number[]) => (s.length > 1 ? `${s[0]}.–${s[s.length - 1]}.` : `${s[0]}.`);
const offen = (f: Fall) => f.zustand !== 'erledigt';
const merkSchluessel = () => `vertretung.faelle.${useStudio.getState().benutzer?.name || ''}`;
const gruppenName = (f: Fall) => (f.gruppe ? `${f.fach} (${f.gruppe})` : f.fach);
/** „Latein (Gr. 2)“ – Langname mit Gruppe; bei parallelen Gruppen „F (Gr. 1) + L (Gr. 2)“ */
const langName = (f: Fall) => (f.parallel ? f.fach : `${f.fachLang || f.fach}${f.gruppe ? ` (${f.gruppe})` : ''}`);
const fehlenText = (f: Fall) => (f.lehrer ? `${f.lehrer} ${f.lehrerIds.length > 1 ? 'fehlen' : 'fehlt'}` : '');
const ZIELTEXT: Record<ZielStatus, string> = { quelle: 'gezogen', frei: 'frei', luecke: 'in die Lücke', tausch: 'Tausch', abwesend: 'Lehrkraft fehlt', kollision: 'belegt' };

/** Ergebnis eines Falls kurz für Listen: „offen“, „MOR“, „Entfall“, „1. MOR · 2. offen“. */
function ergebnisText(f: Fall) {
  if (f.zustand === 'offen') return 'offen';
  return f.ergebnis || 'gelöst';
}
const ergebnisArt = (f: Fall) => (f.zustand !== 'erledigt' ? 'offen' : f.teile.every((t) => t.entfall && !t.verlegt) ? 'entfall' : 'geaendert');

// ---------------------------------------------------------------------------------------------
// Leiste: der Tag der Klasse (bzw. Lehrkraft) – je Stunde eine feste Spalte, gleichzeitige Gruppen übereinander

function kartenTag(e: ME, lehrer: boolean): { text: string; art: 'offen' | 'neu' | 'entfall' } | null {
  if (e.s === 'o') return { text: lehrer ? 'offen' : 'fehlt', art: 'offen' };
  if (e.s === 'ro') return { text: 'Raum fehlt', art: 'offen' };
  if (e.s === 'e' && e.vn) return { text: `verlegt auf ${e.vn}`, art: 'entfall' };
  if (e.s === 'e') return { text: 'entfällt', art: 'entfall' };
  if (e.vv) return { text: `von ${e.vv}`, art: 'neu' };
  if (e.s === 'x') return { text: 'ohne Lehrkraft', art: 'neu' };
  if ((e.s === 'v' || e.s === 'r') && lehrer && e.w) return { text: `vertreten: ${e.l || '?'}`, art: 'neu' };
  return null;
}

function Person({ e, lehrer }: { e: ME; lehrer: boolean }) {
  const zweit = lehrer ? e.k : e.l;
  const statt = lehrer ? '' : e.la;
  if (e.s === 'o') return <span>{lehrer ? e.k : e.la || e.l}</span>;
  if (statt && (e.s === 'v' || e.s === 'r')) return <><b className="fa-k-neu">{zweit || '?'}</b><s className="fa-k-alt">{`(${statt})`}</s></>;
  if (e.s === 'e') return <s>{zweit || statt}</s>;
  return <span>{zweit}</span>;
}

function Karte({ e, mehr, lehrer, halb }: { e: ME; mehr: number; lehrer: boolean; halb: boolean }) {
  const tag = kartenTag(e, lehrer);
  const fach = (
    <span className="fa-k-fach">
      {e.f || e.art || '—'}{e.fa ? <s className="fa-k-alt">{e.fa}</s> : null}{e.g ? <span className="fa-k-gruppe">{e.g}</span> : null}
      {mehr > 0 ? <span className="fa-k-mehr">{`+${mehr}`}</span> : null}
    </span>
  );
  if (halb) {
    // halbe Höhe (zwei Gruppen gleichzeitig): Fach mit Gruppe, darunter Lehrkraft bzw. der Stand
    return (
      <>
        {fach}
        <span className="fa-k-zeile">
          {/* offen: zuerst die fehlende Lehrkraft (schmale Spalten kürzen dann den Tag, nicht den Namen) */}
          {e.s === 'o' ? <span className="fa-k-name">{lehrer ? e.k : e.la || e.l}</span> : null}
          {tag ? <span className={`fa-tag fa-tag-${tag.art} fa-tag-zeile`}>{tag.text}</span> : null}
          {e.s === 'o' ? null : e.s === 'e' && e.vn ? <span className="fa-k-leise">{lehrer ? e.k : e.la || e.l}</span> : <Person e={e} lehrer={lehrer} />}
        </span>
      </>
    );
  }
  return (
    <>
      {fach}
      {e.s === 'o' ? <span className="fa-k-zeile"><Person e={e} lehrer={lehrer} /></span> : null}
      {e.s === 'o' || e.s === 'x' || (e.s === 'e' && e.vn) ? null : <span className="fa-k-zeile"><Person e={e} lehrer={lehrer} /></span>}
      <span className="fa-k-zeile fa-k-raum">{e.ra ? <><b className="fa-k-neu">{e.r}</b><s className="fa-k-alt">{`(${e.ra})`}</s></> : e.s === 'e' ? <s>{e.r}</s> : e.r}</span>
      {tag ? <span className={`fa-tag fa-tag-${tag.art}`}>{tag.text}</span> : null}
    </>
  );
}

interface LeisteProps {
  zeile: MZeile | undefined; stunden: { nr: number; zeit: string }[]; lehrer: boolean; gewaehlt: Fall | null; faelle: Fall[];
  beiWahl: (f: Fall, v: number | null) => void; ziele: Set<number>; ziehbar: boolean; datum: string;
  zug: Zug | null; zugZiele: FallZiele | null; zugBeginnen: (z: Zug) => void; zugEnde: () => void; ablegen: (s: number) => void;
}

/** Zusammenhängende Stunden desselben Unterrichts um die Stunde (Doppelstunde = ein Block beim Ziehen). */
function blockUm(zellen: Map<number, ME[]>, s: number, u: number) {
  const hat = (h: number) => (zellen.get(h) || []).some((x) => x.u === u && x.s !== 'e');
  let a = s, b = s;
  while (a - 1 >= 1 && hat(a - 1) && s - a < 5) a--;
  while (hat(b + 1) && b - a < 5) b++;
  return { start: a, laenge: b - a + 1 };
}

function ZiehKarte({ e, s, zellen, p, className, sel, children }: { e: ME; s: number; zellen: Map<number, ME[]>; p: LeisteProps; className: string; sel: boolean; children: ReactNode }) {
  const fall = e.v ? p.faelle.find((f) => f.ids.includes(e.v!)) ?? null : null;
  const kann = p.ziehbar && !!e.u && e.s !== 'e';
  const block = e.u ? blockUm(zellen, s, e.u) : { start: s, laenge: 1 };
  const daten: ZiehDaten = {
    art: 'tagesstunde', plan: 'faelle', von: p.datum, stunde: block.start, u: e.u, zeile: null, laenge: block.laenge,
    vorschau: () => <div className="fa-zieh-vorschau"><b>{e.f}</b>{e.g ? <span>{e.g}</span> : null}<span>{block.laenge > 1 ? `${stdText([block.start, block.start + block.laenge - 1])} Std.` : `${s}. Std.`}</span></div>,
    beimStart: (ev) => {
      // Umschalt: nur diese Stunde (sonst die ganze Doppelstunde)
      const nur = (ev.activatorEvent as PointerEvent | undefined)?.shiftKey && block.laenge > 1;
      p.zugBeginnen({ von: p.datum, stunde: nur ? s : block.start, laenge: nur ? 1 : block.laenge, u: e.u!, fach: e.f });
    },
    beimEnde: () => p.zugEnde(),
  };
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: `fa-k-${s}-${e.u}-${e.v ?? 0}-${e.l}`, data: daten, disabled: !kann });
  const titel = `${e.f}${e.g ? ` ${e.g}` : ''} ${p.lehrer ? e.k : e.l || e.la} ${e.r}${e.t ? ` – ${e.t}` : ''}`.trim() + (kann ? `\nZiehen: ${block.laenge > 1 ? 'Block' : 'Stunde'} verlegen${block.laenge > 1 ? ' (Umschalt: nur diese Stunde)' : ''}` : '');
  return (
    <div ref={setNodeRef} {...(kann ? listeners : {})} {...(kann ? attributes : {})} role={undefined} tabIndex={undefined}
      className={mergeClasses('fa-karte', `fa-st-${e.s}`, className, sel && 'gewaehlt', !!fall && 'fall', kann && 'ziehbar', isDragging && 'zieht')}
      data-v={e.v ?? undefined} data-u={e.u ?? undefined} title={titel}
      onClick={(ev) => { if (fall) { ev.stopPropagation(); p.beiWahl(fall, e.v); } }}
      onDoubleClick={() => miniplanOeffnen(p.lehrer ? 'klasse' : 'lehrer', p.lehrer ? e.ki : e.li ?? e.lo, p.lehrer ? e.k.split(',')[0]! : (e.l || e.la).split(',')[0]!)}>
      {children}
    </div>
  );
}

function Zelle({ s, es, p, zellen, ueber }: { s: { nr: number }; es: ME[]; p: LeisteProps; zellen: Map<number, ME[]>; ueber: number | null }) {
  const a = (p.zeile?.abw || []).find((x) => x.s === s.nr);
  const ablegenRef = useRef(p.ablegen);
  ablegenRef.current = p.ablegen;
  const ablage = useMemo<AblageDaten>(() => ({ annehmen: (d) => d.art === 'tagesstunde' && d.plan === 'faelle', ablegen: () => ablegenRef.current(s.nr) }), [s.nr]);
  const { setNodeRef } = useDroppable({ id: `fa-ziel-${s.nr}`, data: ablage, disabled: !p.ziehbar });
  const ziel = p.zug ? p.zugZiele?.ziele.find((x) => x.s === s.nr) : undefined;
  const laenge = p.zug?.laenge ?? 1;
  const mit = ueber !== null && s.nr > ueber && s.nr < ueber + laenge;
  // gleichzeitige Gruppen: höchstens zwei Karten übereinander, die gewählte bzw. offene zuerst
  const verschieden = [...new Map(es.map((x) => [`${x.u}|${x.f}|${x.l}|${x.s}|${x.g}`, x])).values()];
  const halb = verschieden.length > 1;
  const zeigen = halb ? verschieden.slice(0, 2) : es.slice(0, 1);
  const mehr = halb ? verschieden.length - 2 : new Set(es.map((x) => `${x.f}|${x.l}|${x.s}`)).size - 1;
  const e = es[0];
  return (
    <div ref={setNodeRef} role="gridcell" data-stunde={s.nr} data-status={e ? e.s : a ? 'abw' : 'leer'} data-v={e?.v ?? undefined} data-gruppen={halb ? verschieden.length : undefined}
      data-ziel={ziel?.status} title={ziel ? [ZIELTEXT[ziel.status], ziel.grund].filter(Boolean).join(' – ') : undefined}
      className={mergeClasses('fa-zelle', p.ziele.has(s.nr) && 'ziel', ziel && `dz-${ziel.status}`, ueber === s.nr && 'dz-ueber', mit && 'dz-mit')}>
      {zeigen.length ? zeigen.map((x, i) => (
        <ZiehKarte key={i} e={x} s={s.nr} zellen={zellen} p={p} className={halb ? 'halb' : ''} sel={!!p.gewaehlt && !!x.v && p.gewaehlt.ids.includes(x.v)}>
          <Karte e={x} mehr={i === zeigen.length - 1 ? mehr : 0} lehrer={p.lehrer} halb={halb} />
        </ZiehKarte>
      )) : (
        <div className={mergeClasses('fa-karte', a && !p.lehrer ? 'fa-st-abw' : 'fa-st-leer')} title={a ? a.t || 'abwesend' : undefined}>
          {a && !p.lehrer ? <span className="fa-k-zeile">{a.t || (a.a === 'termin' ? 'Termin' : 'Klasse abwesend')}</span> : null}
        </div>
      )}
      {ziel ? (
        <span className="fa-ziel-grund" data-testid="fa-ziel-grund">
          <b>{ziel.status === 'quelle' && laenge > 1 ? `${laenge} Stunden` : ZIELTEXT[ziel.status]}</b>
          {ziel.grund && ziel.status !== 'quelle' ? <span>{ziel.grund}</span> : null}
        </span>
      ) : null}
    </div>
  );
}

function Leiste(p: LeisteProps) {
  const zellen = useMemo(() => new Map((p.zeile?.zellen || []).map((c) => [c.s, [...c.e].sort((a, b) => (PRIO[a.s] ?? 9) - (PRIO[b.s] ?? 9))])), [p.zeile]);
  const ueberId = useZiehen((x) => x.ueber);
  const ueber = p.zug && ueberId?.startsWith('fa-ziel-') ? Number(ueberId.slice(8)) : null;
  return (
    <div className="fa-leiste" role="grid" aria-label="Der Tag in Stunden" style={{ gridTemplateColumns: `repeat(${p.stunden.length}, minmax(0, 1fr))` }} data-testid="fa-leiste"
      data-zieht={p.zug ? (p.zugZiele ? 'bereit' : 'laedt') : undefined}>
      {p.stunden.map((s) => (
        <div key={`k${s.nr}`} className="fa-l-kopf" role="columnheader"><b>{`${s.nr}.`}</b><span>{s.zeit.split('–')[0]}</span></div>
      ))}
      {p.stunden.map((s) => <Zelle key={s.nr} s={s} es={zellen.get(s.nr) || []} p={p} zellen={zellen} ueber={ueber} />)}
    </div>
  );
}

/** Beim Ziehen unter der Leiste: der Tag der beteiligten Lehrkräfte und des Raums in denselben Spalten (überdeckt die Liste, nichts verschiebt sich). */
function Ziehplan({ zug, ziele, stunden }: { zug: Zug; ziele: FallZiele | null; stunden: { nr: number }[] }) {
  const ueberId = useZiehen((x) => x.ueber);
  const ueber = ueberId?.startsWith('fa-ziel-') ? Number(ueberId.slice(8)) : null;
  const markiert = new Map<number, string>();
  for (let i = 0; i < zug.laenge; i++) markiert.set(zug.stunde + i, 'quelle');
  if (ueber !== null) for (let i = 0; i < zug.laenge; i++) markiert.set(ueber + i, 'ueber');
  const ziel = ueber !== null ? ziele?.ziele.find((x) => x.s === ueber) : undefined;
  const lehrer = (ziele?.lehrer || []).slice(0, 3);
  return (
    <div className="fa-ziehplan" data-testid="fa-ziehplan" aria-live="polite">
      <div className="fa-zp-kopf">
        <b>{`${zug.fach} ${stdText(zug.laenge > 1 ? [zug.stunde, zug.stunde + zug.laenge - 1] : [zug.stunde])} Std.${zug.von !== ziele?.datum && zug.vorziehung ? ` (${zug.vorziehung.vz.tag})` : ''} verlegen`}</b>
        <span className="fa-leise">
          {ziel ? `${ueber}. Stunde: ${[ZIELTEXT[ziel.status], ziel.grund].filter(Boolean).join(' – ')}` : 'Auf einer Stunde der Leiste ablegen · Esc bricht ab'}
        </span>
      </div>
      {!ziele ? <div className="fa-leise fa-laedt fa-zp-laedt"><Spinner size="extra-tiny" /> Pläne werden geladen …</div> : (
        <>
          {lehrer.map((l) => <Tagesreihe key={`l${l.id}`} typ="lehrer" element={l.id} kurz={l.k} zusatz={l.fehlt ? `${l.name} – fehlt` : l.name} stunden={stunden} markiert={markiert} />)}
          {ziele.raeume.slice(0, 1).map((r) => <Tagesreihe key={`r${r.id}`} typ="raum" element={r.id} kurz={r.k} zusatz="Raum" stunden={stunden} markiert={markiert} />)}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Entscheidung zum gewählten Fall

interface EntscheidungProps {
  fall: Fall; info: FallKandidaten | null | undefined; gewaehlt: number; setGewaehlt: (i: number) => void; schreiben: boolean;
  vorschlag: FallVorschlag | null; verlegen: boolean; setVerlegen: (v: boolean) => void; mehr: () => void; laedtMehr: boolean;
  aktion: (f: () => Promise<unknown>, text: string) => void; arbeitet: boolean; datum: string; ziele: (s: Set<number>) => void;
  /** Teil einer Gruppe: zurück zu allen Gruppen */
  satz?: Fall | null; setTeil: (i: number | null) => void; zugBeginnen: (z: Zug) => void; zugEnde: () => void;
}

function Kopf({ fall, satz }: { fall: Fall; satz?: Fall | null }) {
  return (
    <div className="fa-e-kopf">
      <div className="fa-e-zeit">{`${fall.pause ? `Aufsicht nach der ${fall.stunden[0]}.` : `${stdText(fall.stunden)} Stunde`} · ${fall.zeit}`}</div>
      <h3 className="fa-e-titel">{fall.klassen || fall.raum}<span>{satz ? gruppenName(fall) : fall.parallel ? fall.fach : langName(fall)}</span></h3>
      <div className="fa-e-meta">
        {fall.parallel ? <span>{fehlenText(fall)}</span> : fall.lehrer ? (
          <button type="button" className="fa-link" onClick={() => miniplanOeffnen('lehrer', fall.lehrerId, fall.lehrer)} title={`Tag von ${fall.lehrerName || fall.lehrer} als Miniplan`}>
            {`${fall.lehrer} fehlt`}
          </button>
        ) : null}
        {fall.grundLang || fall.grund ? <span>{fall.grundLang || fall.grund}</span> : null}
        {fall.raum && !fall.pause ? <span>{`Raum ${fall.raum}`}</span> : null}
        {fall.klausur ? <span className="fa-warn">Klausuraufsicht</span> : null}
      </div>
    </div>
  );
}

function Kandidatenliste({ k, gewaehlt, setGewaehlt, schreiben, arbeitet, vorschlag, uebernehmen }: {
  k: FallKandidat[]; gewaehlt: number; setGewaehlt: (i: number) => void; schreiben: boolean; arbeitet: boolean; vorschlag: boolean; uebernehmen: (x: FallKandidat) => void;
}) {
  return (
    <ol className="fa-kandidaten" role="listbox" aria-label="Lehrkräfte">
      {k.map((x, i) => (
        <li key={x.lehrer} role="option" aria-selected={i === gewaehlt} className={mergeClasses('fa-kandidat', i === gewaehlt && 'gewaehlt', x.rot && 'rot')}
          onClick={() => setGewaehlt(i)} onDoubleClick={() => { if (schreiben) uebernehmen(x); }} data-lehrer={x.k} data-testid="fa-kandidat">
          <span className="fa-kand-nr">{i < 9 ? i + 1 : ''}</span>
          <span className="fa-kand-text">
            <span className="fa-kand-name">
              <b>{x.k}</b>
              <button type="button" className="fa-link fa-leise" title={`Tag von ${x.name} als Miniplan`} onClick={(ev) => { ev.stopPropagation(); miniplanOeffnen('lehrer', x.lehrer, x.k); }}>{x.name}</button>
            </span>
            <span className="fa-kand-gruende">{x.gruende.join(' · ')}</span>
          </span>
          <Button size="small" appearance={i === gewaehlt && !vorschlag ? 'primary' : 'secondary'} disabled={!schreiben || arbeitet} className="fa-kand-knopf"
            onClick={(ev) => { ev.stopPropagation(); uebernehmen(x); }} data-testid={i === 0 ? 'fa-uebernehmen' : undefined}>
            Übernehmen
          </Button>
        </li>
      ))}
    </ol>
  );
}

function Vorschlag({ vorschlag, schreiben, arbeitet, aktion, was }: { vorschlag: FallVorschlag; schreiben: boolean; arbeitet: boolean; aktion: EntscheidungProps['aktion']; was: string }) {
  return (
    <section className="fa-e-vorschlag" data-testid="fa-vorschlag">
      <div className="fa-e-label">Vorschlag</div>
      <div className="fa-vorschlag-zeile">
        <span><b>{vorschlag.text}</b>{vorschlag.grund ? <span className="fa-leise">{` – ${vorschlag.grund}`}</span> : null}</span>
        <Button size="small" appearance="primary" disabled={!schreiben || arbeitet} data-testid="fa-vorschlag-uebernehmen"
          onClick={() => aktion(() => vorschlagUebernehmen(vorschlag), `${was}: ${vorschlag.text}`)}>
          Übernehmen
        </Button>
      </div>
    </section>
  );
}

function HinweisFeld({ fall, aktion, was }: { fall: Fall; aktion: EntscheidungProps['aktion']; was: string }) {
  const [hinweisOffen, setHinweisOffen] = useState(false);
  const [hinweisText, setHinweisText] = useState(fall.text);
  useEffect(() => { setHinweisOffen(false); setHinweisText(fall.text); }, [fall.schluessel, fall.text]);
  return (
    <section className="fa-e-abschnitt fa-hinweis">
      {hinweisOffen || fall.text ? (
        <>
          <label className="fa-e-label" htmlFor="fa-hinweis">Hinweis im Vertretungsplan (optional)</label>
          <Input id="fa-hinweis" size="small" value={hinweisText} placeholder="z. B. Aufgaben im Lernraum" onChange={(_, d) => setHinweisText(d.value)}
            onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); (ev.target as HTMLInputElement).blur(); } }}
            onBlur={() => { if (hinweisText.trim() !== fall.text) aktion(() => hinweisSetzen(fall.ids, hinweisText.trim()), `${was}: Hinweis gespeichert`); }} />
        </>
      ) : <button type="button" className="fa-link" onClick={() => setHinweisOffen(true)}>Hinweis für den Vertretungsplan hinzufügen</button>}
    </section>
  );
}

/** Zusammenlegen im Block, Stunde für Stunde mit verschiedenen Klassen („1. mit 7h (KAI), 2. mit 7c (MUE)“). */
function jeStundeText(b: NonNullable<FallKandidaten['betreuungJeStunde']>) {
  return b.map((x) => `${x.stunde}. mit ${x.klassen} (${x.k})`).join(', ');
}

function Entscheidung(p: EntscheidungProps) {
  const { fall, info, gewaehlt, setGewaehlt, schreiben, vorschlag, verlegen, aktion, arbeitet, satz } = p;
  const ids = fall.offeneIds;
  const was = `${fall.klassen || fall.lehrer} ${stdText(fall.stunden)} ${satz ? gruppenName(fall) : fall.fach}`.trim();
  const fuer = fall.pause ? 'die Aufsicht' : fall.stunden.length > 1 && ids.length > 1 ? (ids.length === 2 ? 'beide Stunden' : `alle ${ids.length} Stunden`) : `die ${stdText(fall.teile.filter((t) => t.offen).map((t) => t.stunde))} Stunde`;
  const k = info?.kandidaten || [];
  const raumFall = fall.zustand !== 'erledigt' && fall.teile.every((t) => !t.offen);
  const zurueck = satz ? (
    <button type="button" className="fa-link fa-zurueck" onClick={() => p.setTeil(null)} data-testid="fa-teil-zurueck" title="Alle Gruppen zusammen lösen (G)">
      {`← Alle Gruppen: ${satz.fach}`}
    </button>
  ) : null;

  if (fall.zustand === 'erledigt') {
    return (
      <div className="fa-entscheidung" data-testid="fa-entscheidung" data-zustand="erledigt" data-teil={satz ? fall.schluessel : undefined}>
        {zurueck}
        <Kopf fall={fall} satz={satz} />
        <section className="fa-e-abschnitt">
          <div className="fa-e-label">Ergebnis</div>
          <div className={mergeClasses('fa-ergebnis', ergebnisArt(fall) === 'entfall' && 'entfall')} data-testid="fa-ergebnis">{fall.ergebnis}</div>
          {fall.text ? <div className="fa-leise">{`Hinweis: ${fall.text}`}</div> : null}
        </section>
        {schreiben && !fall.teile.some((t) => t.fix) ? (
          <div className="fa-e-knoepfe">
            <Button size="small" onClick={() => aktion(() => zuruecksetzen(fall.ids), `${was}: zurückgesetzt`)} data-testid="fa-zuruecksetzen">Zurücksetzen</Button>
            <span className="fa-leise">Macht den Fall wieder offen – dann lässt sich anders entscheiden.</span>
          </div>
        ) : null}
      </div>
    );
  }

  const uebernehmen = (x: { lehrer: number; k: string }) => aktion(() => alleZuweisen(ids, x.lehrer), `${was}: ${x.k} eingetragen`);
  return (
    <div className="fa-entscheidung" data-testid="fa-entscheidung" data-zustand={fall.zustand} data-teil={satz ? fall.schluessel : undefined}>
      {zurueck}
      <Kopf fall={fall} satz={satz} />
      {vorschlag ? <Vorschlag vorschlag={vorschlag} schreiben={schreiben} arbeitet={arbeitet} aktion={aktion} was={was} /> : null}

      {verlegen ? <Verlegen {...p} /> : raumFall ? <RaumWahl fall={fall} schreiben={schreiben} aktion={aktion} /> : (
        <section className="fa-e-abschnitt" data-testid="fa-kandidaten">
          <div className="fa-e-label">{`Vertretung für ${fuer}`}</div>
          {info === undefined ? <div className="fa-leise fa-laedt"><Spinner size="extra-tiny" /> Lehrkräfte werden gesucht …</div>
            : !k.length ? (
              <div className="fa-leise" data-testid="fa-keine">
                {ids.length > 1 ? `Niemand ist in allen ${ids.length} Stunden frei. Entfall, Zusammenlegen oder eine Lehrkraft frei wählen.` : 'Keine Lehrkraft frei.'}
              </div>
            ) : <Kandidatenliste k={k} gewaehlt={gewaehlt} setGewaehlt={setGewaehlt} schreiben={schreiben} arbeitet={arbeitet} vorschlag={!!vorschlag} uebernehmen={uebernehmen} />}
          {info && info.weitere > 0 ? (
            <button type="button" className="fa-link fa-weitere" onClick={p.mehr} disabled={p.laedtMehr} data-testid="fa-weitere">
              {p.laedtMehr ? 'Wird geladen …' : `Weitere anzeigen (${info.weitere})`}
            </button>
          ) : null}
        </section>
      )}

      {schreiben && !verlegen && !raumFall ? (
        <section className="fa-e-abschnitt">
          <div className="fa-e-label">Andere Lösung</div>
          <div className="fa-andere">
            <button type="button" className="fa-loesung" onClick={() => aktion(() => entfallen(ids), `${was}: Entfall`)} data-testid="fa-entfall" disabled={arbeitet}
              title={info?.entfallSinnvoll ? 'Randstunde – Entfall ist hier üblich' : 'Unterricht entfällt'}>
              Entfall<kbd>E</kbd>{info?.entfallSinnvoll ? <span className="fa-leise">Randstunde</span> : null}
            </button>
            {!fall.pause ? <button type="button" className="fa-loesung" onClick={() => p.setVerlegen(true)} data-testid="fa-verlegen" disabled={arbeitet}>Verlegen<kbd>V</kbd></button> : null}
            {info?.betreuung ? (
              <button type="button" className="fa-loesung" disabled={arbeitet} data-testid="fa-zusammenlegen"
                onClick={() => aktion(() => alleBetreuen(ids, info.betreuung!.lehrer), `${was}: zusammengelegt mit ${info.betreuung!.klassen}`)}
                title={`${info.betreuung.name} betreut die Klasse neben dem eigenen Unterricht (${info.betreuung.klassen} ${info.betreuung.fach}${info.betreuung.naehe ? `, ${info.betreuung.naehe}` : ''})`}>
                {`Zusammenlegen mit ${info.betreuung.klassen} (${info.betreuung.k})`}<kbd>B</kbd>
              </button>
            ) : info?.betreuungJeStunde ? (
              <button type="button" className="fa-loesung" disabled={arbeitet} data-testid="fa-zusammenlegen"
                onClick={() => aktion(() => fallLoesen(info.betreuungJeStunde!.map((x) => ({ ids: x.ids, art: 'mit', lehrer: x.lehrer })), `Zusammenlegen (${jeStundeText(info.betreuungJeStunde!)})`), `${was}: zusammengelegt (${jeStundeText(info.betreuungJeStunde!)})`)}
                title="Niemand betreut alle Stunden – Stunde für Stunde mit der nächstgelegenen Klasse zusammenlegen">
                {`Zusammenlegen: ${jeStundeText(info.betreuungJeStunde)}`}<kbd>B</kbd>
              </button>
            ) : null}
            {!fall.pause ? <button type="button" className="fa-loesung" onClick={() => aktion(() => ohneLehrkraft(ids), `${was}: ohne Lehrkraft`)} disabled={arbeitet} title="Die Klasse arbeitet ohne Lehrkraft (Aufgaben), Aufsicht über die Nachbarklasse">Ohne Lehrkraft<kbd>O</kbd></button> : null}
            <MenueKnopf art="knopf" size="small" appearance="subtle" text="Eigene Lösung" titel="Lehrkraft frei wählen, Raum, Vormerkung, alle Kandidaten" testid="fa-eigene"
              eintraege={() => eigeneLoesung(fall, aktion)} />
          </div>
        </section>
      ) : null}

      {schreiben && !verlegen ? <HinweisFeld fall={fall} aktion={aktion} was={was} /> : null}
    </div>
  );
}

/** Parallele Gruppen (Teilungsgruppen, Kurse, Kopplungen): eine Lehrkraft für alle Gruppen (zusammengelegt) oder je Gruppe einzeln. */
function Gemeinsam(p: EntscheidungProps) {
  const { fall, info, gewaehlt, setGewaehlt, schreiben, vorschlag, aktion, arbeitet } = p;
  const teile = fall.parallel || [];
  const offeneTeile = teile.filter((t) => t.offeneIds.length && t.teile.some((x) => x.offen));
  const was = `${fall.klassen} ${stdText(fall.stunden)} ${fall.fach}`.trim();
  const k = info?.kandidaten || [];
  const alle = offeneTeile.length === 2 ? 'beide Gruppen' : `alle ${offeneTeile.length} Gruppen`;
  const uebernehmen = (x: { lehrer: number; k: string }) => aktion(
    () => (offeneTeile.length === 1 ? alleZuweisen(offeneTeile[0]!.offeneIds, x.lehrer)
      : fallLoesen(offeneTeile.map((t, i) => ({ ids: t.offeneIds, art: i === 0 ? 'lehrer' : 'mit', lehrer: x.lehrer })), `Gruppen zusammengelegt, ${x.k}`)),
    offeneTeile.length === 1 ? `${was}: ${x.k} für ${gruppenName(offeneTeile[0]!)}` : `${was}: ${x.k} für ${alle}`);
  const ids = fall.offeneIds;
  return (
    <div className="fa-entscheidung" data-testid="fa-entscheidung" data-zustand={fall.zustand} data-parallel={teile.length}>
      <Kopf fall={fall} />
      {vorschlag && offen(fall) ? <Vorschlag vorschlag={vorschlag} schreiben={schreiben} arbeitet={arbeitet} aktion={aktion} was={was} /> : null}
      <section className="fa-e-abschnitt" data-testid="fa-gruppen-teile">
        <div className="fa-e-label">{`${teile.length} Gruppen zur selben Zeit`}</div>
        <ul className="fa-teile">
          {teile.map((t, i) => (
            <li key={t.schluessel} className="fa-teil" data-testid="fa-teil" data-zustand={t.zustand} onClick={() => p.setTeil(i)}>
              <span className="fa-teil-was"><b>{gruppenName(t)}</b><span className="fa-leise">{`${stdText(t.stunden)} · ${fehlenText(t)}${t.raum ? ` · ${t.raum}` : ''}`}</span></span>
              <span className={mergeClasses('fa-fall-ergebnis', ergebnisArt(t))}>{ergebnisText(t)}</span>
              <button type="button" className="fa-link" onClick={(ev) => { ev.stopPropagation(); p.setTeil(i); }} data-testid="fa-teil-einzeln">{t.zustand === 'erledigt' ? 'Ändern' : 'Einzeln lösen'}</button>
            </li>
          ))}
        </ul>
      </section>
      {offen(fall) ? (
        <section className="fa-e-abschnitt" data-testid="fa-kandidaten">
          <div className="fa-e-label">{offeneTeile.length > 1 ? `Eine Lehrkraft für ${alle} (zusammengelegt)` : `Vertretung für ${offeneTeile[0] ? gruppenName(offeneTeile[0]) : 'die Gruppe'}`}</div>
          {info === undefined ? <div className="fa-leise fa-laedt"><Spinner size="extra-tiny" /> Lehrkräfte werden gesucht …</div>
            : !k.length ? <div className="fa-leise" data-testid="fa-keine">{`Niemand ist für ${alle} frei – je Gruppe einzeln lösen, Entfall oder Zusammenlegen.`}</div>
              : <Kandidatenliste k={k} gewaehlt={gewaehlt} setGewaehlt={setGewaehlt} schreiben={schreiben} arbeitet={arbeitet} vorschlag={!!vorschlag} uebernehmen={uebernehmen} />}
          {info && info.weitere > 0 ? (
            <button type="button" className="fa-link fa-weitere" onClick={p.mehr} disabled={p.laedtMehr} data-testid="fa-weitere">
              {p.laedtMehr ? 'Wird geladen …' : `Weitere anzeigen (${info.weitere})`}
            </button>
          ) : null}
        </section>
      ) : null}
      {schreiben && offen(fall) ? (
        <section className="fa-e-abschnitt">
          <div className="fa-e-label">Andere Lösung für alle Gruppen</div>
          <div className="fa-andere">
            <button type="button" className="fa-loesung" onClick={() => aktion(() => entfallen(ids), `${was}: Entfall`)} data-testid="fa-entfall" disabled={arbeitet}>
              Entfall<kbd>E</kbd>{info?.entfallSinnvoll ? <span className="fa-leise">Randstunde</span> : null}
            </button>
            {info?.betreuung ? (
              <button type="button" className="fa-loesung" disabled={arbeitet} data-testid="fa-zusammenlegen"
                onClick={() => aktion(() => alleBetreuen(ids, info.betreuung!.lehrer), `${was}: zusammengelegt mit ${info.betreuung!.klassen}`)}
                title={`${info.betreuung.name} betreut die Gruppen neben dem eigenen Unterricht (${info.betreuung.klassen} ${info.betreuung.fach})`}>
                {`Zusammenlegen mit ${info.betreuung.klassen} (${info.betreuung.k})`}<kbd>B</kbd>
              </button>
            ) : null}
            <button type="button" className="fa-loesung" onClick={() => aktion(() => ohneLehrkraft(ids), `${was}: ohne Lehrkraft`)} disabled={arbeitet}>Ohne Lehrkraft<kbd>O</kbd></button>
            <MenueKnopf art="knopf" size="small" appearance="subtle" text="Eigene Lösung" titel="Lehrkraft frei wählen, je Gruppe, Tabelle" testid="fa-eigene"
              eintraege={() => [
                {
                  text: 'Lehrkraft für alle Gruppen frei wählen …', aktion: async () => {
                    const w = await formular(`Vertretung für ${was}`, [{ name: 'l', titel: 'Lehrkraft', art: 'element', elemente: await elemente('lehrer'), wert: '', pflicht: true }], { okText: 'Übernehmen' });
                    const l = w?.l ? (await elemente('lehrer')).find((x) => x.k === w.l) : null;
                    if (l) uebernehmen({ lehrer: l.id, k: l.k });
                  },
                },
                null,
                ...teile.map((t, i) => ({ text: `${gruppenName(t)} einzeln lösen`, aktion: () => p.setTeil(i) })),
                null,
                { text: 'In der Tabelle bearbeiten', aktion: () => tpAnsichtSetzen('tabelle') },
              ]} />
          </div>
          <span className="fa-leise">Verlegen: eine Stunde der Leiste in die Lücke ziehen.</span>
        </section>
      ) : null}
      {schreiben && fall.zustand !== 'offen' && !fall.teile.some((t) => t.fix) ? (
        <div className="fa-e-knoepfe">
          <Button size="small" onClick={() => aktion(() => zuruecksetzen(fall.ids), `${was}: zurückgesetzt`)} data-testid="fa-zuruecksetzen">Alle Gruppen zurücksetzen</Button>
        </div>
      ) : null}
      {schreiben ? <HinweisFeld fall={fall} aktion={aktion} was={was} /> : null}
    </div>
  );
}

function eigeneLoesung(fall: Fall, aktion: EntscheidungProps['aktion']): MenueListe {
  const ids = fall.offeneIds;
  const was = `${fall.klassen} ${stdText(fall.stunden)} ${fall.fach}`.trim();
  return [
    {
      text: 'Lehrkraft frei wählen …', hinweis: 'Auch Lehrkräfte, die nicht vorgeschlagen werden (Rückfrage bei Überschneidung)', aktion: async () => {
        const w = await formular(`Vertretung für ${was}`, [{ name: 'l', titel: 'Lehrkraft', art: 'element', elemente: await elemente('lehrer'), wert: '', pflicht: true }], { okText: 'Übernehmen' });
        const l = w?.l ? (await elemente('lehrer')).find((x) => x.k === w.l) : null;
        if (l) aktion(() => alleZuweisen(ids, l.id), `${was}: ${l.k} eingetragen`);
      },
    },
    { text: 'Raum zuordnen …', aktion: () => aktion(() => raumDialog(ids[0]!, ids, QUELLE), `${was}: Raum`) },
    { text: 'Als Vormerkung beiseitelegen', hinweis: 'Die Stunde später verplanen (Vormerkungen)', aktion: () => aktion(() => vormerken(ids), `${was}: vorgemerkt`) },
    null,
    { text: 'Alle Kandidaten (Vertretungsvorschlag)', aktion: () => { auswahlSetzen({ id: ids[0]!, klasse: fall.klassenIds[0] ?? null, lehrerId: fall.lehrerId, stunde: fall.stunden[0]!, klassen: fall.klassen }, null); seiteOeffnen('vertretung.vorschlag'); } },
    { text: 'In der Tabelle bearbeiten', aktion: () => tpAnsichtSetzen('tabelle') },
  ];
}

/** Raum fehlt (Raum gesperrt): freie Räume. */
function RaumWahl({ fall, schreiben, aktion }: { fall: Fall; schreiben: boolean; aktion: EntscheidungProps['aktion'] }) {
  const id = fall.teile.find((t) => t.raumOffen)?.id ?? fall.ids[0]!;
  return (
    <section className="fa-e-abschnitt">
      <div className="fa-e-label">Raum fehlt</div>
      <div className="fa-e-knoepfe">
        <Button size="small" appearance="primary" disabled={!schreiben} onClick={() => aktion(() => raumDialog(id, fall.ids, QUELLE), `${fall.klassen} ${fall.fach}: Raum`)}>Raum zuordnen …</Button>
      </div>
    </section>
  );
}

/** Eine vorziehbare Stunde: mit „Vorziehen“ oder per Ziehen in die Lücke der Leiste. */
function VorziehZeile({ v, p, id, luecke }: { v: Vorziehung; p: EntscheidungProps; id: number; luecke: number }) {
  const { fall, schreiben, aktion, datum, arbeitet } = p;
  const kann = schreiben && !!v.u;
  const daten: ZiehDaten = {
    art: 'tagesstunde', plan: 'faelle', von: v.datum, stunde: v.stunde, u: v.u, zeile: null, laenge: 1,
    vorschau: () => <div className="fa-zieh-vorschau"><b>{v.fach}</b><span>{`${v.stunde}. Std. ${v.lehrer}`}</span></div>,
    beimStart: () => p.zugBeginnen({ von: v.datum, stunde: v.stunde, laenge: 1, u: v.u!, fach: v.fach, vorziehung: { gap: id, luecke, vz: v } }),
    beimEnde: () => p.zugEnde(),
  };
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: `fa-vz-${v.datum}-${v.stunde}-${v.u}`, data: daten, disabled: !kann });
  return (
    <li className={mergeClasses('fa-vz', kann && 'ziehbar', isDragging && 'zieht')} ref={setNodeRef} {...(kann ? listeners : {})} {...(kann ? attributes : {})} role={undefined} tabIndex={undefined}
      title={kann ? `In die ${luecke}. Stunde der Leiste ziehen oder „Vorziehen“` : undefined} data-testid="fa-vz">
      <span className="fa-vz-text">
        <b>{`${v.datum === datum ? '' : `${v.tag} `}${v.stunde}. Std. ${v.fach}`}</b><span>{` ${v.lehrer}`}</span>
        <span className="fa-leise">{v.art === 'Randstunde' ? '– Randstunde, keine neue Lücke' : `– neue Lücke in der ${v.stunde}.`}</span>
      </span>
      <Button size="small" disabled={!schreiben || arbeitet} data-testid="fa-vorziehen" onPointerDown={(ev) => ev.stopPropagation()}
        onClick={() => aktion(() => vorziehen(id, v), `${fall.klassen}: ${v.stunde}. Std. ${v.fach} in die ${luecke}. vorgezogen`)}>Vorziehen</Button>
    </li>
  );
}

/** Verlegen: eine andere Stunde der Klasse in die Lücke vorziehen (bzw. im Plan der Klasse verschieben). */
function Verlegen(p: EntscheidungProps) {
  const { fall, setVerlegen, datum, ziele } = p;
  const id = fall.teile.find((t) => t.offen)?.id;
  const [liste, setListe] = useState<Vorziehung[] | null>(null);
  useEffect(() => {
    let aktiv = true;
    setListe(null);
    if (id) vorziehungenLaden(id).then((l) => { if (aktiv) setListe(l); }).catch((e) => { if (aktiv) setListe([]); fehlerMelden(e); });
    return () => { aktiv = false; };
  }, [id]);
  const heute = (liste || []).filter((v) => v.datum === datum);
  useEffect(() => { ziele(new Set(heute.map((v) => v.stunde))); return () => ziele(new Set()); }, [liste]); // eslint-disable-line react-hooks/exhaustive-deps
  const luecke = fall.teile.find((t) => t.offen)?.stunde ?? fall.stunden[0]!;
  return (
    <section className="fa-e-abschnitt" data-testid="fa-verlegen-liste">
      <div className="fa-e-label">{`Andere Stunde in die ${luecke}. Stunde vorziehen`}</div>
      {liste === null ? <div className="fa-leise fa-laedt"><Spinner size="extra-tiny" /> Wird gesucht …</div>
        : !liste.length ? <div className="fa-leise" data-testid="fa-vz-leer">Keine Stunde lässt sich vorziehen.</div> : (
          <ul className="fa-vorziehen">
            {liste.slice(0, 8).map((v) => <VorziehZeile key={`${v.datum}-${v.stunde}-${v.u}`} v={v} p={p} id={id!} luecke={luecke} />)}
          </ul>
        )}
      <div className="fa-e-knoepfe">
        <span className="fa-leise">Auch per Ziehen: eine Stunde der Leiste auf die Lücke ziehen.</span>
        <button type="button" className="fa-link" onClick={() => miniplanOeffnen('klasse', fall.klassenIds[0], fall.klassen.split(',')[0] || '', { woche: true })}>Wochenplan der Klasse</button>
        <button type="button" className="fa-link" onClick={() => setVerlegen(false)}>Zurück zu den Lehrkräften</button>
      </div>
    </section>
  );
}

/** Stand des Tages als Textzeile (Kategorien der NRW-Unterrichtsstatistik). */
function Tagesstand({ s }: { s: FallStatistik }) {
  const teile: [number, string][] = [[s.imFach, 'im Fach'], [s.fachfremd, 'fachfremd'], [s.zusammen, 'zusammengelegt'], [s.eva, 'ohne Lehrkraft/EVA'], [s.verlegt, 'verlegt'], [s.ausfall, 'Ausfall']];
  return (
    <div className="fa-tagesstand" data-testid="fa-tagesstand"
      title={'Stunden des Tages in den Kategorien der NRW-Unterrichtsstatistik:\nVertretung im vorgesehenen Fach, fachfremde Vertretung, Zusammenlegung (Betreuung),\neigenverantwortliches Arbeiten bzw. ohne Lehrkraft, verlegt/vorgezogen, ersatzloser Ausfall.'}>
      <div className="fa-e-label">Stand des Tages (Stunden)</div>
      <div>{teile.filter(([n]) => n > 0).map(([n, t], i) => <span key={t}>{i ? ' · ' : ''}<b>{n}</b>{` ${t}`}</span>)}{s.offen ? <span>{teile.some(([n]) => n > 0) ? ' · ' : ''}<b className="fa-warn">{s.offen}</b> offen</span> : null}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Ansicht

export default function Faelle() {
  const datum = usePlanungsdatum();
  const schreiben = useDarfSchreiben();
  const stand = useFallStand((x) => x.stand);
  const [modus, setModusRoh] = useState<Modus>(() => { try { return localStorage.getItem(merkSchluessel()) === 'lehrer' ? 'lehrer' : 'klasse'; } catch { return 'klasse'; } });
  const setModus = (m: Modus) => { setModusRoh(m); try { localStorage.setItem(merkSchluessel(), m); } catch { /* privat */ } };
  const bereiche = ['Vertretung', 'Stundenplan', 'Unterricht', 'Stammdaten', 'Einstellungen'] as const;
  const { daten, laedt } = useDaten(async () => {
    const [f, m, ml] = await Promise.all([
      faelleLaden(datum!),
      api.get<MDaten>(vpfad(`/tagesablauf/matrix?datum=${datum}&art=klasse`)),
      modus === 'lehrer' ? api.get<MDaten>(vpfad(`/tagesablauf/matrix?datum=${datum}&art=lehrer`)) : Promise.resolve(null),
    ]);
    return { f, m, ml };
  }, [datum, modus], { bereiche: [...bereiche], aktiv: !!datum });
  const f: FaelleDaten | undefined = daten?.f.datum === datum ? daten?.f : undefined;

  // Klassen bleiben stehen, auch wenn ihre Fälle verschwinden (feste Reihenfolge während der Arbeit)
  const gesehen = useRef<{ datum: string | null; klassen: Map<number, FallKlasse>; lehrer: Map<number, FaelleDaten['abwesend'][number]> }>({ datum: null, klassen: new Map(), lehrer: new Map() });
  const gruppen = useMemo<Gruppe[]>(() => {
    if (!f) return [];
    const g = gesehen.current;
    if (g.datum !== f.datum) { g.datum = f.datum; g.klassen = new Map(); g.lehrer = new Map(); }
    for (const k of f.klassen) g.klassen.set(k.id, k);
    for (const l of f.abwesend) g.lehrer.set(l.id, l);
    const res: Gruppe[] = [];
    if (modus === 'klasse') {
      for (const k of [...g.klassen.values()].sort(klassenFolge)) {
        res.push({ id: `k:${k.id}`, k: k.k, titel: `Klasse ${k.k}`, zusatz: k.leitung ? `Klassenleitung ${k.leitung}` : '', elementId: k.id, jahrgang: k.jahrgang, faelle: f.faelle.filter((x) => x.klassenIds.includes(k.id)) });
      }
      const ohne = f.faelle.filter((x) => !x.klassenIds.length);
      if (ohne.length) res.push({ id: 'ohne', k: 'Aufsichten', titel: 'Ohne Klasse', zusatz: 'Pausenaufsichten und Termine', elementId: null, faelle: ohne });
    } else {
      for (const l of [...g.lehrer.values()].sort((a, b) => a.k.localeCompare(b.k, 'de'))) {
        res.push({ id: `l:${l.id}`, k: l.k, titel: `${l.k} – ${l.name}`, zusatz: [l.zeit, l.grund, l.text].filter(Boolean).join(' · '), elementId: l.id, faelle: f.faelle.filter((x) => x.lehrerIds.includes(l.id)) });
      }
      const ohne = f.faelle.filter((x) => !x.lehrerIds.some((id) => g.lehrer.has(id)));
      if (ohne.length) res.push({ id: 'ohne', k: 'Sonstige', titel: 'Weitere offene Stunden', zusatz: 'Raum fehlt, Verlegungen, Termine', elementId: null, faelle: ohne });
    }
    for (const x of res) x.faelle.sort((a, b) => a.stunden[0]! - b.stunden[0]! || a.klassen.localeCompare(b.klassen, 'de', { numeric: true }));
    return res;
  }, [f, modus]);
  // Reihenfolge aller Fälle (für ↑/↓ und „nächster offener Fall“): Gruppe für Gruppe, darin nach Stunde
  const reihe = useMemo(() => {
    const l: { gruppe: string; fall: Fall }[] = [];
    const da = new Set<string>();
    for (const g of gruppen) for (const x of g.faelle) if (!da.has(x.schluessel)) { da.add(x.schluessel); l.push({ gruppe: g.id, fall: x }); }
    return l;
  }, [gruppen]);
  const fallNach = useMemo(() => new Map((f?.faelle || []).map((x) => [x.schluessel, x])), [f]);

  const [wahl, setWahl] = useState<Wahl | null>(null);
  const weiter = useRef<string | null>(null);
  // Wahl durch die Benutzerin: ein noch ausstehendes „weiter zum nächsten Fall“ entfällt (es käme sonst nach dem Neuladen dazwischen)
  const waehlen = (w: Wahl) => { weiter.current = null; setWahl(w); };
  const [zuletzt, setZuletzt] = useState<string | null>(null);
  const [arbeitet, setArbeitet] = useState(false);
  const [verlegen, setVerlegen] = useState(false);
  const [ziele, setZiele] = useState<Set<number>>(new Set());
  // gewählte Gruppe eines parallelen Falls (null = alle Gruppen zusammen)
  const [teil, setTeilRoh] = useState<number | null>(null);
  const nachTeil = useRef(false);
  const teilWunsch = useRef<number | null>(null);
  useEffect(() => { setWahl(null); setZuletzt(null); setVorschlaege(null); }, [datum]);
  useEffect(() => { setWahl((w) => (w && gruppen.some((g) => g.id === w.gruppe) ? w : null)); }, [modus]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auswahl gültig halten; nach einer Entscheidung den nächsten offenen Fall wählen (dieselbe Klasse zuerst, dann die nächste)
  useEffect(() => {
    if (!f) return;
    const nach = weiter.current;
    if (nach) {
      weiter.current = null;
      const jetzt = fallNach.get(nach);
      if (jetzt && offen(jetzt)) return;
      const i = reihe.findIndex((x) => x.fall.schluessel === nach);
      const g = wahl?.gruppe;
      const inGruppe = reihe.find((x, j) => j > i && x.gruppe === g && offen(x.fall)) ?? reihe.find((x) => x.gruppe === g && offen(x.fall));
      const n = inGruppe ?? reihe.slice(i + 1).find((x) => offen(x.fall)) ?? reihe.find((x) => offen(x.fall));
      if (n) { setWahl({ gruppe: n.gruppe, fall: n.fall.schluessel }); return; }
    }
    if (wahl && gruppen.some((g) => g.id === wahl.gruppe) && (!wahl.fall || fallNach.has(wahl.fall))) return;
    const erste = reihe.find((x) => offen(x.fall)) ?? reihe[0];
    if (erste) setWahl({ gruppe: erste.gruppe, fall: erste.fall.schluessel });
    else if (gruppen[0]) setWahl({ gruppe: gruppen[0].id, fall: null });
  }, [f, reihe]); // eslint-disable-line react-hooks/exhaustive-deps

  const gruppe = gruppen.find((g) => g.id === wahl?.gruppe) ?? null;
  const fall = wahl?.fall ? fallNach.get(wahl.fall) ?? null : null;
  const satz = fall?.parallel ? fall : null;
  const aktiv = satz && teil !== null ? satz.parallel![teil] ?? satz : fall;
  const setTeil = (i: number | null) => { setTeilRoh(i); setVerlegen(false); setGewaehlt(0); setAnzahl(5); };
  useEffect(() => { setTeilRoh(teilWunsch.current); teilWunsch.current = null; }, [fall?.schluessel]);
  // nach einer Entscheidung in einer Gruppe: die nächste offene Gruppe, sonst alle Gruppen
  useEffect(() => {
    if (!nachTeil.current || !satz || teil === null) return;
    nachTeil.current = false;
    if (satz.parallel![teil] && offen(satz.parallel![teil]!)) return;
    const n = satz.parallel!.findIndex((t) => offen(t));
    setTeil(n >= 0 && satz.parallel!.filter(offen).length === 1 ? null : n >= 0 ? n : null);
  }, [f]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setVerlegen(false); setGewaehlt(0); setAnzahl(5); }, [aktiv?.schluessel]);
  // Pläne und andere Ansichten folgen der Auswahl
  useEffect(() => {
    if (aktiv?.ids[0]) auswahlSetzen({ id: aktiv.offeneIds[0] ?? aktiv.ids[0], klasse: aktiv.klassenIds[0] ?? null, lehrerId: aktiv.lehrerId, stunde: aktiv.stunden[0]!, klassen: aktiv.klassen }, datum);
  }, [aktiv?.schluessel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Kandidaten des gewählten Falls (für den ganzen Block bzw. alle Gruppen), die nächsten beiden offenen vorab
  const [info, setInfo] = useState<FallKandidaten | null | undefined>(undefined);
  const [anzahl, setAnzahl] = useState(5);
  const [laedtMehr, setLaedtMehr] = useState(false);
  const [gewaehlt, setGewaehlt] = useState(0);
  const infoFuer = useRef<string>('');
  useEffect(() => {
    if (!aktiv || !offen(aktiv) || !aktiv.teile.some((t) => t.offen)) { setInfo(null); infoFuer.current = ''; return; }
    let gilt = true;
    const key = aktiv.schluessel;
    if (infoFuer.current !== key) setInfo(undefined);
    fallKandidaten(aktiv.offeneIds, anzahl).then((r) => {
      if (!gilt) return;
      infoFuer.current = key; setInfo(r); setLaedtMehr(false);
      const i = reihe.findIndex((x) => x.fall.schluessel === fall?.schluessel);
      for (const n of reihe.slice(i + 1).filter((x) => offen(x.fall) && x.fall.teile.some((t) => t.offen)).slice(0, 2)) void fallKandidaten(n.fall.offeneIds).catch(() => {});
    }).catch((e) => { if (gilt) { setInfo(null); setLaedtMehr(false); fehlerMelden(e); } });
    return () => { gilt = false; };
  }, [aktiv?.schluessel, aktiv?.offeneIds.join(','), anzahl, stand]); // eslint-disable-line react-hooks/exhaustive-deps

  // Vorschläge für alle offenen Fälle (Probe auf dem Server, nichts geändert)
  const [vorschlaege, setVorschlaege] = useState<Map<string, FallVorschlag> | null>(null);
  const anfrage = useFallKopf((x) => x.anfrage);
  const ersteAnfrage = useRef(anfrage);
  useEffect(() => {
    if (anfrage === ersteAnfrage.current || !datum) return;
    useFallKopf.setState({ laeuft: true });
    fallVorschlaegeLaden(datum).then((r) => {
      setVorschlaege(new Map(r.vorschlaege.map((v) => [v.schluessel, v])));
      if (!r.vorschlaege.length) hinweis('Für die offenen Fälle gibt es keine Vorschläge.', 'info', 3000);
    }).catch(fehlerMelden).finally(() => useFallKopf.setState({ laeuft: false }));
  }, [anfrage]); // eslint-disable-line react-hooks/exhaustive-deps
  const gueltig = useMemo(() => {
    if (!vorschlaege || !f) return null;
    const m = new Map<string, FallVorschlag>();
    for (const [k, v] of vorschlaege) { const x = fallNach.get(k); if (x && offen(x) && v.ids.every((id) => x.offeneIds.includes(id))) m.set(k, v); }
    return m;
  }, [vorschlaege, fallNach, f]);
  useEffect(() => { if (gueltig && !gueltig.size && vorschlaege?.size) setVorschlaege(null); }, [gueltig]); // eslint-disable-line react-hooks/exhaustive-deps

  // Zahlen für den Kopf
  const nOffen = (f?.faelle || []).filter(offen).length;
  const nErledigt = (f?.faelle.length || 0) - nOffen;
  useEffect(() => { useFallKopf.setState({ offen: nOffen, erledigt: nErledigt, vorschlaege: gueltig?.size || 0 }); }, [nOffen, nErledigt, gueltig?.size]);
  useEffect(() => () => useFallKopf.setState({ offen: 0, erledigt: 0, vorschlaege: 0 }), []);

  const aktion = (fn: () => Promise<unknown>, text: string) => {
    if (!schreiben || arbeitet) return;
    const key = fall?.schluessel ?? null;
    const imTeil = teil !== null;
    setArbeitet(true);
    fn().then((r) => {
      if (r === null || (r as { abgebrochen?: boolean } | undefined)?.abgebrochen) return;
      setZuletzt(text);
      weiter.current = key;
      nachTeil.current = imTeil;
    }).catch(fehlerMelden).finally(() => setArbeitet(false));
  };
  async function alleUebernehmen() {
    if (!gueltig?.size) return;
    const l = [...gueltig.values()];
    setArbeitet(true);
    try {
      await vorschlaegeAnwenden(l.flatMap(vorschlagEintraege));
      setZuletzt(`${mehrzahl(l.length, 'Vorschlag', 'Vorschläge')} übernommen`);
      weiter.current = fall?.schluessel ?? null;
      setVorschlaege(null);
    } catch (e) { fehlerMelden(e); } finally { setArbeitet(false); }
  }
  const mehr = () => { setLaedtMehr(true); setAnzahl((a) => a + 10); };

  // Ziehen in der Leiste: Ziele mit Grund laden, beteiligte Pläne einblenden, beim Ablegen verlegen bzw. vorziehen
  const [zug, setZug] = useState<Zug | null>(null);
  const [zugZiele, setZugZiele] = useState<FallZiele | null>(null);
  const zugRef = useRef<{ zug: Zug; ziele: FallZiele | null } | null>(null);
  const zugBeginnen = (z: Zug) => {
    zugRef.current = { zug: z, ziele: null };
    setZug(z); setZugZiele(null);
    fallZieleLaden(datum!, z.von, z.stunde, z.u, z.laenge).then((r) => {
      if (zugRef.current?.zug !== z) return;
      zugRef.current.ziele = r;
      setZugZiele(r);
    }).catch(() => {});
  };
  const zugEnde = () => { setZug(null); setZugZiele(null); };
  const ablegen = (s: number) => {
    const x = zugRef.current;
    if (!x || !datum || !schreiben) return;
    const { zug: z, ziele: zl } = x;
    const ziel = zl?.ziele.find((y) => y.s === s);
    if (ziel?.status === 'quelle' || (z.von === datum && z.stunde === s)) return;
    const k = gruppe?.k ?? '';
    const von = `${z.von !== datum && z.vorziehung ? `${z.vorziehung.vz.tag} ` : ''}${stdText(z.laenge > 1 ? [z.stunde, z.stunde + z.laenge - 1] : [z.stunde])}`;
    if (z.vorziehung && z.vorziehung.luecke === s) {
      const vz = z.vorziehung;
      aktion(() => vorziehen(vz.gap, vz.vz), `${k}: ${z.fach} aus der ${von} in die ${s}. vorgezogen`);
    } else if (ziel?.luecke) {
      const gap = ziel.luecke;
      aktion(() => vorziehen(gap, { datum: z.von, stunde: z.stunde, u: z.u }), `${k}: ${z.fach} aus der ${von} in die ${s}. vorgezogen`);
    } else {
      aktion(() => stundeVerlegen({ von: z.von, stunde: z.stunde, u: z.u, laenge: z.laenge, ziel: datum, zielStunde: s }), `${k}: ${z.fach} ${von} auf die ${s}. verlegt`);
    }
  };

  // Tasten
  const tasten = useRef<(e: KeyboardEvent) => boolean>(() => false);
  tasten.current = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    const i = fall ? reihe.findIndex((x) => x.fall.schluessel === fall.schluessel) : -1;
    const gehe = (n: { gruppe: string; fall: Fall } | undefined) => { if (n) waehlen({ gruppe: n.gruppe, fall: n.fall.schluessel }); };
    if (e.key === 'ArrowDown') { gehe(reihe[Math.min(reihe.length - 1, i + 1)]); return true; }
    if (e.key === 'ArrowUp') { gehe(reihe[Math.max(0, i - 1)]); return true; }
    if (e.key === 'PageDown' || e.key === 'PageUp') {
      const gi = gruppen.findIndex((g) => g.id === wahl?.gruppe);
      const g = gruppen[Math.max(0, Math.min(gruppen.length - 1, gi + (e.key === 'PageDown' ? 1 : -1)))];
      if (g) waehlen({ gruppe: g.id, fall: (g.faelle.find(offen) ?? g.faelle[0])?.schluessel ?? null });
      return true;
    }
    if (k === 'z' && schreiben) { rueckgaengig().then(() => setZuletzt(null)).catch(fehlerMelden); return true; }
    if (e.key === 'Escape' && verlegen) { setVerlegen(false); return true; }
    if (e.key === 'Escape' && teil !== null) { setTeil(null); return true; }
    // G: Gruppen eines parallelen Falls durchgehen (alle → Gr. 1 → Gr. 2 → alle)
    if (k === 'g' && satz) { const n = satz.parallel!.length; setTeil(teil === null ? 0 : teil + 1 < n ? teil + 1 : null); return true; }
    if (!aktiv || !schreiben || arbeitet) return false;
    const ids = aktiv.offeneIds;
    const was = `${aktiv.klassen} ${stdText(aktiv.stunden)} ${aktiv.fach}`.trim();
    if (!offen(aktiv)) return false;
    const gemeinsam = satz && teil === null;
    if (/^[1-9]$/.test(e.key) && info?.kandidaten[Number(e.key) - 1]) { setGewaehlt(Number(e.key) - 1); return true; }
    if (e.key === 'Enter') {
      const v = gemeinsam || !satz ? gueltig?.get(fall!.schluessel) : undefined;
      if (v) { aktion(() => vorschlagUebernehmen(v), `${was}: ${v.text}`); return true; }
      const x = info?.kandidaten[gewaehlt];
      if (x && gemeinsam) {
        const ot = satz.parallel!.filter((t) => t.offeneIds.length && t.teile.some((y) => y.offen));
        aktion(() => (ot.length === 1 ? alleZuweisen(ot[0]!.offeneIds, x.lehrer) : fallLoesen(ot.map((t, j) => ({ ids: t.offeneIds, art: j === 0 ? 'lehrer' : 'mit', lehrer: x.lehrer })), `Gruppen zusammengelegt, ${x.k}`)),
          `${was}: ${x.k} für ${ot.length === 1 ? gruppenName(ot[0]!) : ot.length === 2 ? 'beide Gruppen' : `alle ${ot.length} Gruppen`}`);
      } else if (x) aktion(() => alleZuweisen(ids, x.lehrer), `${was}: ${x.k} eingetragen`);
      return true;
    }
    if (k === 'e') { aktion(() => entfallen(ids), `${was}: Entfall`); return true; }
    if (k === 'v' && !aktiv.pause) {
      if (gemeinsam) { hinweis('Verlegen bei Gruppen: eine Stunde der Leiste in die Lücke ziehen – oder mit G eine Gruppe wählen.', 'info', 3500); return true; }
      setVerlegen(!verlegen); return true;
    }
    if (k === 'b' && info?.betreuung) { const bt = info.betreuung; aktion(() => alleBetreuen(ids, bt.lehrer), `${was}: zusammengelegt mit ${bt.klassen}`); return true; }
    if (k === 'b' && info?.betreuungJeStunde) { const bj = info.betreuungJeStunde; aktion(() => fallLoesen(bj.map((x) => ({ ids: x.ids, art: 'mit', lehrer: x.lehrer }))), `${was}: zusammengelegt (${jeStundeText(bj)})`); return true; }
    if (k === 'o' && !aktiv.pause) { aktion(() => ohneLehrkraft(ids), `${was}: ohne Lehrkraft`); return true; }
    return false;
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || e.defaultPrevented) return;
      if (useZiehen.getState().aktiv) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, select, [contenteditable=true], [role=dialog], [role=menu], [data-testid=miniplan]')) return;
      if ((e.key === 'Enter' || e.key === ' ') && t?.closest('button, a, [role=option]') && !t.closest('[role=listbox]')) return;
      if (document.querySelector('[role=dialog], .fui-OverlayDrawer, [role=menu]')) return;
      if (tasten.current(e)) e.preventDefault();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  // ausgewählte Zeile links sichtbar halten (nur blättern, wenn sie außerhalb liegt)
  const listeRef = useRef<HTMLDivElement>(null);
  useEffect(() => { listeRef.current?.querySelector(`[data-gruppe="${wahl?.gruppe}"]`)?.scrollIntoView({ block: 'nearest' }); }, [wahl?.gruppe]);

  const stunden = useMemo(() => {
    if (!daten?.m) return f?.stunden || [];
    let letzte = 6;
    for (const z of daten.m.zeilen) for (const c of z.zellen) letzte = Math.max(letzte, c.s);
    return daten.m.stunden.filter((s) => s.nr <= letzte);
  }, [daten?.m, f]);
  const zeile = gruppe?.elementId != null ? (gruppe.id.startsWith('l:') ? daten?.ml : daten?.m)?.zeilen.find((z) => z.id === gruppe.elementId) : undefined;

  if (!datum || (!f && laedt)) return <div className="fa-flaeche fa-leer"><Spinner size="tiny" /></div>;
  if (!f) return <div className="fa-flaeche fa-leer" />;
  if (!f.faelle.length) {
    return (
      <div className="fa-flaeche fa-leer" data-testid="fa-leer">
        <p>{f.unterrichtstag ? 'Keine offenen Stunden an diesem Tag.' : `Kein Unterrichtstag${f.frei ? ` (${f.frei})` : ''}.`}</p>
        {schreiben && f.unterrichtstag ? <Button size="small" appearance="primary" onClick={() => tpBlattSetzen('abwesenheiten')}>Abwesenheiten erfassen</Button> : null}
      </div>
    );
  }

  const eProps: EntscheidungProps | null = aktiv ? {
    fall: aktiv, info, gewaehlt, setGewaehlt, schreiben, vorschlag: aktiv === fall ? gueltig?.get(aktiv.schluessel) ?? null : null,
    verlegen, setVerlegen, mehr, laedtMehr, aktion, arbeitet, datum, ziele: setZiele, satz: aktiv !== fall ? satz : null, setTeil, zugBeginnen, zugEnde,
  } : null;
  const beiWahl = (x: Fall, v: number | null) => {
    // Klick auf die Karte einer Gruppe wählt diese Gruppe des Falls
    const i = x.parallel && v ? x.parallel.findIndex((t) => t.ids.includes(v)) : -1;
    if (x.schluessel !== fall?.schluessel) teilWunsch.current = i >= 0 ? i : null;
    else if (x.parallel) setTeil(i >= 0 ? i : null);
    if (gruppe) waehlen({ gruppe: gruppe.id, fall: x.schluessel });
  };

  return (
    <div className="fa-flaeche" data-ansicht="vertretung.faelle" data-testid="faelle" data-modus={modus}>
      <nav className="fa-links" aria-label={modus === 'klasse' ? 'Klassen mit Fällen' : 'Abwesende Lehrkräfte'}>
        <div className="fa-links-kopf" role="tablist" aria-label="Liste nach">
          <button type="button" role="tab" aria-selected={modus === 'klasse'} className={mergeClasses('fa-reiter', modus === 'klasse' && 'aktiv')} onClick={() => setModus('klasse')} data-testid="fa-nach-klasse">Klassen</button>
          <button type="button" role="tab" aria-selected={modus === 'lehrer'} className={mergeClasses('fa-reiter', modus === 'lehrer' && 'aktiv')} onClick={() => setModus('lehrer')} data-testid="fa-nach-lehrer">Abwesende</button>
        </div>
        <div className="fa-gruppen" ref={listeRef} data-testid="fa-gruppen">
          {gruppen.map((g, i) => {
            const n = g.faelle.filter(offen).length;
            const jg = modus === 'klasse' && g.jahrgang !== undefined && g.jahrgang !== gruppen[i - 1]?.jahrgang;
            return (
              <div key={g.id}>
                {jg ? <div className="fa-jahrgang">{/^\d/.test(g.jahrgang || '') ? `Jahrgang ${g.jahrgang}` : g.jahrgang || 'Ohne Jahrgang'}</div> : null}
                <button type="button" className={mergeClasses('fa-gruppe', g.id === wahl?.gruppe && 'gewaehlt')} data-gruppe={g.id} data-k={g.k} data-offen={n}
                  title={g.zusatz || g.titel} onClick={() => waehlen({ gruppe: g.id, fall: (g.faelle.find(offen) ?? g.faelle[0])?.schluessel ?? null })}>
                  <span className="fa-gruppe-k">{g.k}</span>
                  {modus === 'lehrer' ? <span className="fa-gruppe-zusatz">{g.zusatz}</span> : null}
                  <span className={mergeClasses('fa-gruppe-stand', n > 0 && 'offen')}>{n > 0 ? `${n} offen` : 'erledigt'}</span>
                </button>
              </div>
            );
          })}
        </div>
        {f.statistik ? <Tagesstand s={f.statistik} /> : null}
      </nav>

      <main className="fa-mitte" aria-label={gruppe?.titel || 'Fälle'}>
        {gueltig?.size ? (
          <div className="fa-vorschlagsleiste" data-testid="fa-vorschlagsleiste">
            <span>{`${mehrzahl(gueltig.size, 'Vorschlag', 'Vorschläge')} zur Prüfung – noch nichts geändert.`}</span>
            <Button size="small" appearance="primary" disabled={!schreiben || arbeitet} onClick={() => void alleUebernehmen()} data-testid="fa-alle-uebernehmen">{`Alle übernehmen (${gueltig.size})`}</Button>
            <Button size="small" onClick={() => setVorschlaege(null)}>Verwerfen</Button>
          </div>
        ) : null}
        {gruppe ? (
          <>
            <header className="fa-mitte-kopf">
              <h2>{gruppe.titel}</h2>
              {gruppe.zusatz ? <span className="fa-leise">{gruppe.zusatz}</span> : null}
              {gruppe.elementId ? (
                <button type="button" className="fa-link fa-mitte-plan" onClick={() => miniplanOeffnen(modus === 'lehrer' ? 'lehrer' : 'klasse', gruppe.elementId, gruppe.k, { woche: true })}
                  title="Wochenplan als Miniplan – verschiebbar, auch zum Verlegen per Ziehen">Wochenplan</button>
              ) : null}
            </header>
            {gruppe.elementId ? (
              <div className="fa-leiste-rahmen">
                <Leiste zeile={zeile} stunden={stunden} lehrer={modus === 'lehrer'} gewaehlt={aktiv} faelle={gruppe.faelle} beiWahl={beiWahl} ziele={ziele}
                  ziehbar={schreiben && modus === 'klasse'} datum={datum} zug={zug} zugZiele={zugZiele} zugBeginnen={zugBeginnen} zugEnde={zugEnde} ablegen={ablegen} />
                {zug ? <Ziehplan zug={zug} ziele={zugZiele} stunden={stunden} /> : null}
              </div>
            ) : null}
            <div className="fa-abschnitt-titel">{modus === 'lehrer' ? 'Stunden der Lehrkraft' : 'Zu vertreten'}</div>
            <div className="fa-faelle" role="listbox" aria-label="Fälle" data-testid="fa-faelle">
              {gruppe.faelle.map((x) => {
                const v = gueltig?.get(x.schluessel);
                const art = ergebnisArt(x);
                return (
                  <div key={x.schluessel} role="option" aria-selected={x.schluessel === fall?.schluessel} className={mergeClasses('fa-fall', x.schluessel === fall?.schluessel && 'gewaehlt')}
                    data-schluessel={x.schluessel} data-zustand={x.zustand} data-parallel={x.parallel?.length} onClick={() => waehlen({ gruppe: gruppe.id, fall: x.schluessel })}>
                    <span className="fa-fall-std">{x.pause ? `nach ${x.stunden[0]}.` : stdText(x.stunden)}</span>
                    <span className="fa-fall-was"><b>{modus === 'lehrer' || !x.klassenIds.length ? `${x.klassen} ${langName(x)}`.trim() : langName(x)}</b>
                      <span className="fa-leise">{modus === 'lehrer' ? (x.raum ? `Raum ${x.raum}` : '') : `${fehlenText(x)}${x.grund ? ` (${x.grund})` : ''}${x.klassenIds.length > 1 && gruppe.elementId ? ` · mit ${x.klassen.split(',').filter((kk) => kk !== gruppe.k).join(',')}` : ''}`}</span>
                    </span>
                    <span className={mergeClasses('fa-fall-ergebnis', art)} data-testid="fa-fall-ergebnis">
                      {v && x.zustand !== 'erledigt' ? <span className="fa-fall-vorschlag">{`Vorschlag ${v.text}`}</span> : ergebnisText(x)}
                    </span>
                  </div>
                );
              })}
              {!gruppe.faelle.length ? <div className="fa-leise fa-fall-leer">Keine Fälle mehr in dieser Klasse.</div> : null}
            </div>
          </>
        ) : null}
      </main>

      <aside className="fa-rechts" aria-label="Entscheidung">
        {zuletzt ? (
          <div className="fa-zuletzt" data-testid="fa-zuletzt">
            <span>{zuletzt}</span>
            {schreiben ? <button type="button" className="fa-link" onClick={() => { setZuletzt(null); rueckgaengig().catch(fehlerMelden); }} title="Letzte Änderung zurücknehmen (Z)">Rückgängig</button> : null}
          </div>
        ) : null}
        {eProps ? (satz && teil === null ? <Gemeinsam {...eProps} /> : <Entscheidung {...eProps} />) : <div className="fa-leise fa-e-leer">Einen Fall wählen.</div>}
        <div className="fa-tasten" aria-hidden>
          <span><kbd>↑</kbd><kbd>↓</kbd> Fall</span><span><kbd>1</kbd>–<kbd>5</kbd> wählen</span><span><kbd>Enter</kbd> übernehmen</span>
          <span><kbd>E</kbd> Entfall</span><span><kbd>V</kbd> verlegen</span>{satz ? <span><kbd>G</kbd> Gruppe</span> : null}<span><kbd>Z</kbd> rückgängig</span>
        </div>
      </aside>
    </div>
  );
}
