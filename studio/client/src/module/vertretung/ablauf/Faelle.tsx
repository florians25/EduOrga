// „Fall für Fall“ – Standardansicht der Tagesplanung. Ein Fall ist eine Stunde bzw. ein Block (Doppelstunde) einer fehlenden
// Lehrkraft. Links die Klassen mit Fällen in fester Reihenfolge (wahlweise die abwesenden Lehrkräfte), in der Mitte der ganze Tag der
// gewählten Klasse als eine Leiste (feste Spalten je Stunde) und darunter ihre Fälle, rechts die Entscheidung für den gewählten
// Fall: die besten Lehrkräfte für den ganzen Block mit Begründung in Worten, „Übernehmen“ mit einem Klick, daneben Entfall,
// Verlegen (eine andere Stunde in die Lücke vorziehen), Zusammenlegen, ohne Lehrkraft und weitere Lösungen. Nach jeder
// Entscheidung ist der nächste offene Fall gewählt – nichts ordnet sich um, Zellen ändern nur ihren Inhalt.
// Tasten: ↑/↓ Fall, Bild↑/↓ Klasse, 1–5 Lehrkraft wählen, Enter übernehmen, E Entfall, V verlegen, B zusammenlegen,
// O ohne Lehrkraft, Z rückgängig, Esc zurück.
import { Button, Input, Spinner, mergeClasses } from '@fluentui/react-components';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/api/client';
import { rueckgaengig } from '@/kern/dokument';
import { useDaten } from '@/kern/laden';
import { elemente, useDarfSchreiben, useStudio } from '@/kern/zustand';
import { formular } from '@/komponenten/dialoge';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { MenueKnopf, type MenueListe } from '@/komponenten/menue';
import { raumDialog } from '../dialoge';
import { seiteOeffnen } from '@/kern/befehle';
import { tpAnsichtSetzen, tpBlattSetzen, usePlanungsdatum, vpfad } from '../kern';
import {
  QUELLE, alleBetreuen, alleZuweisen, auswahlSetzen, entfallen, fallKandidaten, fallVorschlaegeLaden, faelleLaden, hinweisSetzen, mehrzahl,
  ohneLehrkraft, useFallKopf, useFallStand, vorschlaegeAnwenden, vormerken, vorziehen, vorziehungenLaden, zuruecksetzen,
  type Fall, type FallKandidaten, type FallKlasse, type FallVorschlag, type FaelleDaten, type Vorziehung,
} from './daten';
import { miniplanOeffnen } from './Miniplan';
import './faelle.css';

/** Stunde in der Leiste (Kurzform der Tagesübersicht, siehe VertretungApi.Matrix). */
interface ME {
  v: number | null; u: number | null; s: string; f: string; fa: string; l: string; la: string; r: string; ra: string; k: string;
  li: number | null; lo: number | null; ri: number | null; ki: number | null; art: string; t: string; kl: boolean; w?: boolean; vn?: string; vv?: string;
}
interface MZeile { id: number; k: string; name: string; abw: { s: number; a: 'absenz' | 'termin'; id: number; t: string }[]; zellen: { s: number; e: ME[] }[] }
interface MDaten { stunden: { nr: number; zeit: string }[]; zeilen: MZeile[] }

type Modus = 'klasse' | 'lehrer';
interface Gruppe { id: string; k: string; titel: string; zusatz: string; elementId: number | null; faelle: Fall[]; jahrgang?: string }
interface Wahl { gruppe: string; fall: string | null }


const PRIO: Record<string, number> = { o: 0, ro: 1, v: 2, r: 2, x: 2, z: 2, k: 2, t: 2, e: 3, n: 4, b: 5 };
const jahrgangRang = (j: string) => (/^\d+$/.test(j) ? Number(j) : j === 'EF' ? 11 : j === 'Q1' ? 12 : j === 'Q2' ? 13 : 99);
const klassenFolge = (a: FallKlasse, b: FallKlasse) => jahrgangRang(a.jahrgang) - jahrgangRang(b.jahrgang) || a.k.localeCompare(b.k, 'de', { numeric: true });
const stdText = (s: number[]) => (s.length > 1 ? `${s[0]}.–${s[s.length - 1]}.` : `${s[0]}.`);
const offen = (f: Fall) => f.zustand !== 'erledigt';
const merkSchluessel = () => `vertretung.faelle.${useStudio.getState().benutzer?.name || ''}`;

/** Ergebnis eines Falls kurz für Listen: „offen“, „MOR“, „Entfall“, „1. MOR · 2. offen“. */
function ergebnisText(f: Fall) {
  if (f.zustand === 'offen') return 'offen';
  return f.ergebnis || 'gelöst';
}
const ergebnisArt = (f: Fall) => (f.zustand !== 'erledigt' ? 'offen' : f.teile.every((t) => t.entfall) ? 'entfall' : 'geaendert');

// ---------------------------------------------------------------------------------------------
// Leiste: der Tag der Klasse (bzw. Lehrkraft) – je Stunde eine feste Spalte

function Karte({ e, mehr, lehrer }: { e: ME; mehr: number; lehrer: boolean }) {
  const zweit = lehrer ? e.k : e.l;
  const statt = lehrer ? '' : e.la;
  let tag: { text: string; alt?: string; art: 'offen' | 'neu' | 'entfall' } | null = null;
  if (e.s === 'o') tag = { text: lehrer ? 'offen' : 'fehlt', art: 'offen' };
  else if (e.s === 'ro') tag = { text: 'Raum fehlt', art: 'offen' };
  else if (e.s === 'e' && e.vn) tag = { text: `verlegt auf ${e.vn}`, art: 'entfall' };
  else if (e.s === 'e') tag = { text: 'entfällt', art: 'entfall' };
  else if (e.vv) tag = { text: `von ${e.vv}`, art: 'neu' };
  else if (e.s === 'x') tag = { text: 'ohne Lehrkraft', art: 'neu' };
  else if ((e.s === 'v' || e.s === 'r') && lehrer && e.w) tag = { text: `vertreten: ${e.l || '?'}`, art: 'neu' };
  return (
    <>
      <span className="fa-k-fach">{e.f || e.art || '—'}{e.fa ? <s className="fa-k-alt">{e.fa}</s> : null}{mehr > 0 ? <span className="fa-k-mehr">{`+${mehr}`}</span> : null}</span>
      {e.s === 'o' && !lehrer ? <span className="fa-k-zeile">{e.la || e.l}</span> : null}
      {e.s === 'o' || e.s === 'e' || e.s === 'x' ? null : (
        <span className="fa-k-zeile">
          {statt && (e.s === 'v' || e.s === 'r') ? <><b className="fa-k-neu">{zweit || '?'}</b><s className="fa-k-alt">{`(${statt})`}</s></> : <span>{zweit}</span>}
        </span>
      )}
      {e.s === 'e' && !e.vn ? <span className="fa-k-zeile"><s>{zweit || statt}</s></span> : null}
      <span className="fa-k-zeile fa-k-raum">{e.ra ? <><b className="fa-k-neu">{e.r}</b><s className="fa-k-alt">{`(${e.ra})`}</s></> : e.s === 'e' ? <s>{e.r}</s> : e.r}</span>
      {tag ? <span className={`fa-tag fa-tag-${tag.art}`}>{tag.text}</span> : null}
    </>
  );
}

function Leiste({ zeile, stunden, lehrer, gewaehlt, faelle, beiWahl, ziele }: {
  zeile: MZeile | undefined; stunden: { nr: number; zeit: string }[]; lehrer: boolean; gewaehlt: Fall | null; faelle: Fall[];
  beiWahl: (f: Fall) => void; ziele: Set<number>;
}) {
  const zellen = new Map((zeile?.zellen || []).map((c) => [c.s, [...c.e].sort((a, b) => (PRIO[a.s] ?? 9) - (PRIO[b.s] ?? 9))]));
  const abw = new Map((zeile?.abw || []).map((a) => [a.s, a]));
  const fallVon = (v: number | null) => (v ? faelle.find((f) => f.ids.includes(v)) ?? null : null);
  return (
    <div className="fa-leiste" role="grid" aria-label="Der Tag in Stunden" style={{ gridTemplateColumns: `repeat(${stunden.length}, minmax(0, 1fr))` }} data-testid="fa-leiste">
      {stunden.map((s) => (
        <div key={`k${s.nr}`} className="fa-l-kopf" role="columnheader"><b>{`${s.nr}.`}</b><span>{s.zeit.split('–')[0]}</span></div>
      ))}
      {stunden.map((s) => {
        const es = zellen.get(s.nr) || [];
        const e = es[0];
        const a = abw.get(s.nr);
        const fall = e ? fallVon(e.v) : null;
        const sel = !!gewaehlt && !!e && gewaehlt.ids.includes(e.v ?? -1);
        const ziel = ziele.has(s.nr);
        const titel = e ? es.map((x) => `${x.f} ${lehrer ? x.k : x.l || x.la} ${x.r}${x.t ? ` – ${x.t}` : ''}`.trim()).join('\n') : a ? a.t || 'abwesend' : '';
        return (
          <div key={s.nr} role="gridcell" data-stunde={s.nr} data-status={e ? e.s : a ? 'abw' : 'leer'} data-v={e?.v ?? undefined} title={titel || undefined}
            className={mergeClasses('fa-karte', e ? `fa-st-${e.s}` : a ? 'fa-st-abw' : 'fa-st-leer', sel && 'gewaehlt', !!fall && 'fall', ziel && 'ziel')}
            onClick={() => { if (fall) beiWahl(fall); }}
            onDoubleClick={() => { if (e) miniplanOeffnen(lehrer ? 'klasse' : 'lehrer', lehrer ? e.ki : e.li ?? e.lo, lehrer ? e.k.split(',')[0]! : (e.l || e.la).split(',')[0]!); }}>
            {e ? <Karte e={e} mehr={new Set(es.map((x) => `${x.f}|${x.l}|${x.s}`)).size - 1} lehrer={lehrer} /> : a ? <span className="fa-k-zeile">{a.t || (a.a === 'termin' ? 'Termin' : 'abwesend')}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Entscheidung zum gewählten Fall

interface EntscheidungProps {
  fall: Fall; info: FallKandidaten | null | undefined; gewaehlt: number; setGewaehlt: (i: number) => void; schreiben: boolean;
  vorschlag: FallVorschlag | null; verlegen: boolean; setVerlegen: (v: boolean) => void; mehr: () => void; laedtMehr: boolean;
  aktion: (f: () => Promise<unknown>, text: string) => void; arbeitet: boolean; datum: string; ziele: (s: Set<number>) => void;
}

function Entscheidung(p: EntscheidungProps) {
  const { fall, info, gewaehlt, setGewaehlt, schreiben, vorschlag, verlegen, aktion, arbeitet } = p;
  const ids = fall.offeneIds;
  const was = `${fall.klassen || fall.lehrer} ${stdText(fall.stunden)} ${fall.fach}`.trim();
  const fuer = fall.pause ? 'die Aufsicht' : fall.stunden.length > 1 && ids.length > 1 ? (ids.length === 2 ? 'beide Stunden' : `alle ${ids.length} Stunden`) : `die ${stdText(fall.teile.filter((t) => t.offen).map((t) => t.stunde))} Stunde`;
  const [hinweisOffen, setHinweisOffen] = useState(false);
  const [hinweisText, setHinweisText] = useState(fall.text);
  useEffect(() => { setHinweisOffen(false); setHinweisText(fall.text); }, [fall.schluessel, fall.text]);
  const k = info?.kandidaten || [];
  const raumFall = fall.zustand !== 'erledigt' && fall.teile.every((t) => !t.offen);

  const kopf = (
    <div className="fa-e-kopf">
      <div className="fa-e-zeit">{`${fall.pause ? `Aufsicht nach der ${fall.stunden[0]}.` : `${stdText(fall.stunden)} Stunde`} · ${fall.zeit}`}</div>
      <h3 className="fa-e-titel">{fall.klassen || fall.raum}<span>{fall.fachLang || fall.fach}</span></h3>
      <div className="fa-e-meta">
        {fall.lehrer ? (
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

  if (fall.zustand === 'erledigt') {
    return (
      <div className="fa-entscheidung" data-testid="fa-entscheidung" data-zustand="erledigt">
        {kopf}
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
    <div className="fa-entscheidung" data-testid="fa-entscheidung" data-zustand={fall.zustand}>
      {kopf}
      {vorschlag ? (
        <section className="fa-e-vorschlag" data-testid="fa-vorschlag">
          <div className="fa-e-label">Vorschlag</div>
          <div className="fa-vorschlag-zeile">
            <span><b>{vorschlag.text}</b>{vorschlag.grund ? <span className="fa-leise">{` – ${vorschlag.grund}`}</span> : null}</span>
            <Button size="small" appearance="primary" disabled={!schreiben || arbeitet} data-testid="fa-vorschlag-uebernehmen"
              onClick={() => aktion(() => (vorschlag.art === 'entfall' ? entfallen(vorschlag.ids) : alleZuweisen(vorschlag.ids, vorschlag.lehrerId!)), `${was}: ${vorschlag.text}`)}>
              Übernehmen
            </Button>
          </div>
        </section>
      ) : null}

      {verlegen ? <Verlegen {...p} /> : raumFall ? <RaumWahl fall={fall} schreiben={schreiben} aktion={aktion} /> : (
        <section className="fa-e-abschnitt" data-testid="fa-kandidaten">
          <div className="fa-e-label">{`Vertretung für ${fuer}`}</div>
          {info === undefined ? <div className="fa-leise fa-laedt"><Spinner size="extra-tiny" /> Lehrkräfte werden gesucht …</div>
            : !k.length ? (
              <div className="fa-leise" data-testid="fa-keine">
                {info?.gleicheZeit ? 'Mehrere Stunden zur selben Zeit – bitte einzeln lösen (Tabelle).'
                  : ids.length > 1 ? `Niemand ist in allen ${ids.length} Stunden frei. Entfall, Zusammenlegen oder eine Lehrkraft frei wählen.` : 'Keine Lehrkraft frei.'}
              </div>
            ) : (
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
            )}
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
            ) : null}
            {!fall.pause ? <button type="button" className="fa-loesung" onClick={() => aktion(() => ohneLehrkraft(ids), `${was}: ohne Lehrkraft`)} disabled={arbeitet} title="Die Klasse arbeitet ohne Lehrkraft (Aufgaben), Aufsicht über die Nachbarklasse">Ohne Lehrkraft<kbd>O</kbd></button> : null}
            <MenueKnopf art="knopf" size="small" appearance="subtle" text="Eigene Lösung" titel="Lehrkraft frei wählen, Raum, Vormerkung, alle Kandidaten" testid="fa-eigene"
              eintraege={() => eigeneLoesung(fall, aktion)} />
          </div>
        </section>
      ) : null}

      {schreiben && !verlegen ? (
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
      ) : null}
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

/** Verlegen: eine andere Stunde der Klasse in die Lücke vorziehen (bzw. im Plan der Klasse verschieben). */
function Verlegen({ fall, schreiben, aktion, setVerlegen, datum, ziele, arbeitet }: EntscheidungProps) {
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
  const luecke = fall.teile.find((t) => t.offen)?.stunde;
  return (
    <section className="fa-e-abschnitt" data-testid="fa-verlegen-liste">
      <div className="fa-e-label">{`Andere Stunde in die ${luecke}. Stunde vorziehen`}</div>
      {liste === null ? <div className="fa-leise fa-laedt"><Spinner size="extra-tiny" /> Wird gesucht …</div>
        : !liste.length ? <div className="fa-leise">Keine Stunde lässt sich vorziehen.</div> : (
          <ul className="fa-vorziehen">
            {liste.slice(0, 8).map((v) => (
              <li key={`${v.datum}-${v.stunde}-${v.u}`} className="fa-vz">
                <span className="fa-vz-text">
                  <b>{`${v.datum === datum ? '' : `${v.tag} `}${v.stunde}. Std. ${v.fach}`}</b><span>{` ${v.lehrer}`}</span>
                  <span className="fa-leise">{v.art === 'Randstunde' ? `– danach entfällt die ${v.stunde}. Stunde` : '– es entsteht eine neue Lücke'}</span>
                </span>
                <Button size="small" disabled={!schreiben || arbeitet} data-testid="fa-vorziehen"
                  onClick={() => aktion(() => vorziehen(id!, v), `${fall.klassen}: ${v.stunde}. Std. ${v.fach} in die ${luecke}. vorgezogen`)}>Vorziehen</Button>
              </li>
            ))}
          </ul>
        )}
      <div className="fa-e-knoepfe">
        <button type="button" className="fa-link" onClick={() => miniplanOeffnen('klasse', fall.klassenIds[0], fall.klassen.split(',')[0] || '')}>Plan der Klasse öffnen (Stunden ziehen)</button>
        <button type="button" className="fa-link" onClick={() => setVerlegen(false)}>Zurück zu den Lehrkräften</button>
      </div>
    </section>
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
        res.push({ id: `l:${l.id}`, k: l.k, titel: `${l.k} – ${l.name}`, zusatz: [l.zeit, l.grund, l.text].filter(Boolean).join(' · '), elementId: l.id, faelle: f.faelle.filter((x) => x.lehrerId === l.id) });
      }
      const ohne = f.faelle.filter((x) => !x.lehrerId || !g.lehrer.has(x.lehrerId));
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
  const [zuletzt, setZuletzt] = useState<string | null>(null);
  const [arbeitet, setArbeitet] = useState(false);
  const [verlegen, setVerlegen] = useState(false);
  const [ziele, setZiele] = useState<Set<number>>(new Set());
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
  useEffect(() => { setVerlegen(false); setGewaehlt(0); setAnzahl(5); }, [fall?.schluessel]);
  // Pläne und andere Ansichten folgen der Auswahl
  useEffect(() => {
    if (fall?.ids[0]) auswahlSetzen({ id: fall.offeneIds[0] ?? fall.ids[0], klasse: fall.klassenIds[0] ?? null, lehrerId: fall.lehrerId, stunde: fall.stunden[0]!, klassen: fall.klassen }, datum);
  }, [fall?.schluessel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Kandidaten des gewählten Falls (für den ganzen Block), die nächsten beiden offenen vorab
  const [info, setInfo] = useState<FallKandidaten | null | undefined>(undefined);
  const [anzahl, setAnzahl] = useState(5);
  const [laedtMehr, setLaedtMehr] = useState(false);
  const [gewaehlt, setGewaehlt] = useState(0);
  const infoFuer = useRef<string>('');
  useEffect(() => {
    if (!fall || !offen(fall) || !fall.teile.some((t) => t.offen)) { setInfo(null); infoFuer.current = ''; return; }
    let aktiv = true;
    const key = fall.schluessel;
    if (infoFuer.current !== key) setInfo(undefined);
    fallKandidaten(fall.offeneIds, anzahl).then((r) => {
      if (!aktiv) return;
      infoFuer.current = key; setInfo(r); setLaedtMehr(false);
      const i = reihe.findIndex((x) => x.fall.schluessel === key);
      for (const n of reihe.slice(i + 1).filter((x) => offen(x.fall) && x.fall.teile.some((t) => t.offen)).slice(0, 2)) void fallKandidaten(n.fall.offeneIds).catch(() => {});
    }).catch((e) => { if (aktiv) { setInfo(null); setLaedtMehr(false); fehlerMelden(e); } });
    return () => { aktiv = false; };
  }, [fall?.schluessel, fall?.offeneIds.join(','), anzahl, stand]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setArbeitet(true);
    fn().then((r) => {
      if (r === null || (r as { abgebrochen?: boolean } | undefined)?.abgebrochen) return;
      setZuletzt(text);
      weiter.current = key;
    }).catch(fehlerMelden).finally(() => setArbeitet(false));
  };
  async function alleUebernehmen() {
    if (!gueltig?.size) return;
    const l = [...gueltig.values()];
    setArbeitet(true);
    try {
      await vorschlaegeAnwenden(l.flatMap((v) => v.ids.map((id) => ({ id, lehrer: v.art === 'lehrer' ? v.lehrerId : null, entfall: v.art === 'entfall' }))));
      setZuletzt(`${mehrzahl(l.length, 'Vorschlag', 'Vorschläge')} übernommen`);
      weiter.current = fall?.schluessel ?? null;
      setVorschlaege(null);
    } catch (e) { fehlerMelden(e); } finally { setArbeitet(false); }
  }
  const mehr = () => { setLaedtMehr(true); setAnzahl((a) => a + 10); };

  // Tasten
  const tasten = useRef<(e: KeyboardEvent) => boolean>(() => false);
  tasten.current = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    const i = fall ? reihe.findIndex((x) => x.fall.schluessel === fall.schluessel) : -1;
    const gehe = (n: { gruppe: string; fall: Fall } | undefined) => { if (n) setWahl({ gruppe: n.gruppe, fall: n.fall.schluessel }); };
    if (e.key === 'ArrowDown') { gehe(reihe[Math.min(reihe.length - 1, i + 1)]); return true; }
    if (e.key === 'ArrowUp') { gehe(reihe[Math.max(0, i - 1)]); return true; }
    if (e.key === 'PageDown' || e.key === 'PageUp') {
      const gi = gruppen.findIndex((g) => g.id === wahl?.gruppe);
      const g = gruppen[Math.max(0, Math.min(gruppen.length - 1, gi + (e.key === 'PageDown' ? 1 : -1)))];
      if (g) setWahl({ gruppe: g.id, fall: (g.faelle.find(offen) ?? g.faelle[0])?.schluessel ?? null });
      return true;
    }
    if (k === 'z' && schreiben) { rueckgaengig().then(() => setZuletzt(null)).catch(fehlerMelden); return true; }
    if (e.key === 'Escape' && verlegen) { setVerlegen(false); return true; }
    if (!fall || !schreiben || arbeitet) return false;
    const ids = fall.offeneIds;
    const was = `${fall.klassen} ${stdText(fall.stunden)} ${fall.fach}`.trim();
    if (!offen(fall)) return false;
    if (/^[1-9]$/.test(e.key) && info?.kandidaten[Number(e.key) - 1]) { setGewaehlt(Number(e.key) - 1); return true; }
    if (e.key === 'Enter') {
      const v = gueltig?.get(fall.schluessel);
      if (v) { aktion(() => (v.art === 'entfall' ? entfallen(v.ids) : alleZuweisen(v.ids, v.lehrerId!)), `${was}: ${v.text}`); return true; }
      const x = info?.kandidaten[gewaehlt];
      if (x) aktion(() => alleZuweisen(ids, x.lehrer), `${was}: ${x.k} eingetragen`);
      return true;
    }
    if (k === 'e') { aktion(() => entfallen(ids), `${was}: Entfall`); return true; }
    if (k === 'v' && !fall.pause) { setVerlegen(!verlegen); return true; }
    if (k === 'b' && info?.betreuung) { const bt = info.betreuung; aktion(() => alleBetreuen(ids, bt.lehrer), `${was}: zusammengelegt mit ${bt.klassen}`); return true; }
    if (k === 'o' && !fall.pause) { aktion(() => ohneLehrkraft(ids), `${was}: ohne Lehrkraft`); return true; }
    return false;
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || e.defaultPrevented) return;
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
                  title={g.zusatz || g.titel} onClick={() => setWahl({ gruppe: g.id, fall: (g.faelle.find(offen) ?? g.faelle[0])?.schluessel ?? null })}>
                  <span className="fa-gruppe-k">{g.k}</span>
                  {modus === 'lehrer' ? <span className="fa-gruppe-zusatz">{g.zusatz}</span> : null}
                  <span className={mergeClasses('fa-gruppe-stand', n > 0 && 'offen')}>{n > 0 ? `${n} offen` : 'erledigt'}</span>
                </button>
              </div>
            );
          })}
        </div>
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
                <button type="button" className="fa-link fa-mitte-plan" onClick={() => miniplanOeffnen(modus === 'lehrer' ? 'lehrer' : 'klasse', gruppe.elementId, gruppe.k)}
                  title="Wochenplan als Miniplan – verschiebbar, auch zum Verlegen per Ziehen">Wochenplan</button>
              ) : null}
            </header>
            {gruppe.elementId ? <Leiste zeile={zeile} stunden={stunden} lehrer={modus === 'lehrer'} gewaehlt={fall} faelle={gruppe.faelle} beiWahl={(x) => setWahl({ gruppe: gruppe.id, fall: x.schluessel })} ziele={ziele} /> : null}
            <div className="fa-abschnitt-titel">{modus === 'lehrer' ? 'Stunden der Lehrkraft' : 'Zu vertreten'}</div>
            <div className="fa-faelle" role="listbox" aria-label="Fälle" data-testid="fa-faelle">
              {gruppe.faelle.map((x) => {
                const v = gueltig?.get(x.schluessel);
                const art = ergebnisArt(x);
                return (
                  <div key={x.schluessel} role="option" aria-selected={x.schluessel === fall?.schluessel} className={mergeClasses('fa-fall', x.schluessel === fall?.schluessel && 'gewaehlt')}
                    data-schluessel={x.schluessel} data-zustand={x.zustand} onClick={() => setWahl({ gruppe: gruppe.id, fall: x.schluessel })}>
                    <span className="fa-fall-std">{x.pause ? `nach ${x.stunden[0]}.` : stdText(x.stunden)}</span>
                    <span className="fa-fall-was"><b>{modus === 'lehrer' || !x.klassenIds.length ? `${x.klassen} ${x.fachLang || x.fach}`.trim() : x.fachLang || x.fach}</b>
                      <span className="fa-leise">{modus === 'lehrer' ? (x.raum ? `Raum ${x.raum}` : '') : `${x.lehrer} fehlt${x.grund ? ` (${x.grund})` : ''}`}</span>
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
        {fall ? (
          <Entscheidung fall={fall} info={info} gewaehlt={gewaehlt} setGewaehlt={setGewaehlt} schreiben={schreiben} vorschlag={gueltig?.get(fall.schluessel) ?? null}
            verlegen={verlegen} setVerlegen={setVerlegen} mehr={mehr} laedtMehr={laedtMehr} aktion={aktion} arbeitet={arbeitet} datum={datum} ziele={setZiele} />
        ) : <div className="fa-leise fa-e-leer">Einen Fall wählen.</div>}
        <div className="fa-tasten" aria-hidden>
          <span><kbd>↑</kbd><kbd>↓</kbd> Fall</span><span><kbd>1</kbd>–<kbd>5</kbd> wählen</span><span><kbd>Enter</kbd> übernehmen</span>
          <span><kbd>E</kbd> Entfall</span><span><kbd>V</kbd> verlegen</span><span><kbd>Z</kbd> rückgängig</span>
        </div>
      </aside>
    </div>
  );
}
