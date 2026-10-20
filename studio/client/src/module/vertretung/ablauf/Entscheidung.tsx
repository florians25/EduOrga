// Entscheidung zur gewählten Stunde (Tagesplanung): oben, was fehlt („2. Stunde · 7a M · fehlt KOC“), darunter die
// Empfehlung als ein großer Knopf („SRO übernehmen“, Enter) mit Begründung, zwei Alternativen als schlichte Zeilen (2, 3),
// dann die anderen Lösungen: Entfall (E), Zusammenlegen (B) und „Weitere …“ (Ohne Lehrkraft, Raum, Vorziehen, Verlegen,
// Vormerken, alle Kandidaten, Wer ist frei?). Belastung (Woche, Monat, Mehrarbeit) steht nur in der Kurzinfo bzw. beim
// Überfahren. Für bearbeitete Stunden: Ergebnis, Zurücksetzen (Entf), andere Lehrkraft. Die Ansicht „vertretung.entscheidung“
// folgt der gewählten Vertretung (Tabelle der Tagesplanung) und lädt die Stunde aus der Arbeitsliste des Planungstags.
import { Button, Spinner, mergeClasses } from '@fluentui/react-components';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/api/client';
import { melden, useEreignis } from '@/kern/ereignisse';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben } from '@/kern/zustand';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { MenueKnopf, menue, type MenueListe } from '@/komponenten/menue';
import { raumDialog } from '../dialoge';
import { aktuelleAuswahl, tpAnsichtSetzen, tpKontextSetzen, tpKontextUmschalten, usePlanungsdatum, vpfad } from '../kern';
import {
  QUELLE, arbeitslisteLaden, betreuen, entfallen, gruendeText, kandidatenAnfordern, lastTitel, ohneLehrkraft, raumZuweisen, stundenText,
  useKandidaten, vormerken, zuruecksetzen, zuweisen, type BearbeiteteStunde, type Kandidat, type KandidatenInfo, type OffeneStunde,
} from './daten';
import { Sammelleiste } from './Sammelleiste';
import './ablauf.css';

/** Lösung, die die Taste Enter (bzw. 1) ausführt. */
interface Loesung { text: string; erledigt: string; beschreibung: string; titel: string; ausfuehren: () => Promise<unknown>; art: 'lehrer' | 'raum' | 'entfall' | 'betreuung' }

/** Empfehlung und Alternativen einer offenen Stunde. */
export function loesungen(o: OffeneStunde, info: KandidatenInfo | null | undefined, block: boolean): { primaer: Loesung | null; alternativen: { k: Kandidat | null; kurz: string; name: string; grund: string; titel: string; ausfuehren: () => Promise<unknown> }[] } {
  if (!info) return { primaer: null, alternativen: [] };
  if (info.art === 'raum') {
    const r = info.raeume || [];
    const zeile = (x: (typeof r)[number]) => ({ k: null, kurz: x.k, name: x.name, grund: ['frei', ...x.gruende].join(' · '), titel: `Raum ${x.k} zuordnen`, ausfuehren: () => raumZuweisen(o, x.raum) });
    return {
      primaer: r[0] ? { text: `Raum ${r[0].k} zuordnen`, erledigt: `Raum ${r[0].k} zugeordnet`, beschreibung: [r[0].name, 'frei', ...r[0].gruende].filter(Boolean).join(' · '), titel: `Raum ${r[0].k} zuordnen (Enter)`, ausfuehren: () => raumZuweisen(o, r[0]!.raum), art: 'raum' } : null,
      alternativen: r.slice(1, 3).map(zeile),
    };
  }
  const k = info.kandidaten;
  const alternativen = k.slice(1, 3).map((x) => ({ k: x, kurz: x.k, name: x.name, grund: gruendeText(x), titel: `${x.name} zuweisen\n${lastTitel(x)}`, ausfuehren: () => zuweisen(o, x.lehrer, block) }));
  if (k[0]) {
    const x = k[0];
    return { primaer: { text: `${x.k} übernehmen`, erledigt: `${x.k} eingetragen`, beschreibung: [x.name, gruendeText(x)].filter(Boolean).join(' – '), titel: `${x.name} zuweisen (Enter)\n${lastTitel(x)}`, ausfuehren: () => zuweisen(o, x.lehrer, block), art: 'lehrer' }, alternativen };
  }
  if (info.entfallSinnvoll) return { primaer: { text: 'Entfall', erledigt: 'Entfall', beschreibung: 'Keine Lehrkraft frei – Randstunde, der Unterricht kann entfallen.', titel: 'Unterricht entfällt (Enter)', ausfuehren: () => entfallen([o.id]), art: 'entfall' }, alternativen };
  if (info.betreuung) {
    const bt = info.betreuung;
    return { primaer: { text: `Zusammenlegen mit ${bt.k}`, erledigt: `zusammengelegt mit ${bt.k}`, beschreibung: `Keine Lehrkraft frei – ${bt.k} betreut nebenher (${bt.klassen}${bt.naehe ? `, ${bt.naehe}` : ''}).`, titel: 'Zusammenlegen (Enter)', ausfuehren: () => betreuen(o, bt.lehrer, block), art: 'betreuung' }, alternativen };
  }
  return { primaer: null, alternativen };
}

/** Menü „Weitere Möglichkeiten“ einer offenen bzw. bearbeiteten Stunde. */
export function weitereMoeglichkeiten(o: { id: number; offen?: boolean }, schreiben: boolean, aktion: (f: () => Promise<unknown>) => void, info?: KandidatenInfo | null, block = false, offene?: OffeneStunde): MenueListe {
  const offen = !!o.offen;
  return [
    ...(offen ? [
      { text: 'Ohne Lehrkraft', taste: 'O', deaktiviert: !schreiben, hinweis: 'Stunde findet ohne Lehrkraft statt (z. B. Aufgaben, EVA)', aktion: () => aktion(() => ohneLehrkraft([o.id])) },
      info?.betreuung && offene ? { text: `Zusammenlegen mit ${info.betreuung.k}`, taste: 'B', deaktiviert: !schreiben, aktion: () => aktion(() => betreuen(offene, info.betreuung!.lehrer, block)) } : null,
    ] : []),
    { text: 'Raum zuordnen …', taste: 'R', deaktiviert: !schreiben, aktion: () => aktion(() => raumDialog(o.id, [o.id], QUELLE)) },
    {
      text: 'Vorziehen', deaktiviert: !schreiben || !offen, menue: async () => {
        const v = await api.get<{ vorziehungen: { lehrer: string; tag: string; datum: string; stunde: number; klassen: string; fach: string; art: string; u: number | null }[] }>(vpfad(`/vorschlag/${o.id}`));
        const l: MenueListe = v.vorziehungen.slice(0, 10).map((z) => ({
          text: `${z.tag} ${z.stunde}. Std. · ${z.klassen} ${z.fach} ${z.lehrer} · ${z.art}`,
          aktion: () => aktion(() => api.post(vpfad(`/vorschlag/${o.id}/vorziehen`), { datum: z.datum, stunde: z.stunde, unterricht: z.u }, { quelle: QUELLE })),
        }));
        return l.length ? l : [{ text: 'Keine Vorziehung möglich', deaktiviert: true }];
      },
    },
    { text: 'Verlegen oder tauschen …', hinweis: 'Pläne einblenden und die Stunde auf eine andere ziehen', aktion: () => { tpKontextSetzen('plaene'); hinweis('Stunde im Klassen- oder Lehrkräfteplan auf eine andere Stunde ziehen: Verlegen bzw. Tauschen.', 'info', 5000); } },
    { text: 'Als Vormerkung beiseitelegen', deaktiviert: !schreiben, aktion: () => aktion(() => vormerken([o.id])) },
    null,
    { text: 'Alle Kandidaten', taste: 'V', aktion: () => tpKontextSetzen('vorschlag') },
    { text: 'Wer ist frei?', taste: 'F', aktion: () => tpKontextSetzen('frei') },
    { text: 'Pläne von Klasse und Lehrkraft', taste: 'P', aktion: () => tpKontextSetzen('plaene') },
    null,
    { text: 'In der Tabelle bearbeiten', aktion: () => tpAnsichtSetzen('tabelle') },
  ];
}

export interface EntscheidungProps {
  o: OffeneStunde | null; b: BearbeiteteStunde | null; info: KandidatenInfo | null | undefined; block: boolean; schreiben: boolean;
  /** Aktion ausführen (danach folgt die nächste offene Stunde); text beschreibt sie für „Zuletzt …“ */
  aktion: (id: number, f: () => Promise<unknown>, text?: string) => void;
  /** „3 von 16“ */
  stand?: string;
}

/** „2. Std. 5b M“ für „Zuletzt …“ */
const beschreibung = (o: OffeneStunde) => `${o.stundeText}. Std. ${o.klassen} ${o.pause ? 'Aufsicht' : o.fach}`.trim();

/** Tastenkürzel der Entscheidung; true = verbraucht. */
export function entscheidungsTaste(e: KeyboardEvent, { o, b, info, block, schreiben, aktion }: EntscheidungProps, mehrKnopf?: HTMLElement | null): boolean {
  const k = e.key.toLowerCase();
  if (k === 'v') { tpKontextSetzen('vorschlag'); return true; }
  if (k === 'f') { tpKontextSetzen('frei'); return true; }
  if (k === 'p') { tpKontextUmschalten(); return true; }
  if (!schreiben) return false;
  if (b && !o) {
    if ((e.key === 'Delete' || e.key === 'Backspace') && !b.fix) { aktion(b.id, () => zuruecksetzen([b.id])); return true; }
    return false;
  }
  if (!o) return false;
  const l = loesungen(o, info, block);
  const was = beschreibung(o);
  if (e.key === 'Enter' || e.key === '1') { if (l.primaer) aktion(o.id, l.primaer.ausfuehren, `${was}: ${l.primaer.erledigt}`); return true; }
  if (e.key === '2' || e.key === '3') { const x = l.alternativen[Number(e.key) - 2]; if (x) aktion(o.id, x.ausfuehren, `${was}: ${x.kurz} eingetragen`); return true; }
  if (k === 'e' && o.offen) { aktion(o.id, () => entfallen([o.id]), `${was}: Entfall`); return true; }
  if (k === 'b' && o.offen && info?.betreuung) { aktion(o.id, () => betreuen(o, info.betreuung!.lehrer, block), `${was}: zusammengelegt mit ${info.betreuung.k}`); return true; }
  if (k === 'o' && o.offen) { aktion(o.id, () => ohneLehrkraft([o.id]), `${was}: ohne Lehrkraft`); return true; }
  if (k === 'r') { aktion(o.id, () => raumDialog(o.id, [o.id], QUELLE)); return true; }
  if (k === 'm' && mehrKnopf) {
    const r = mehrKnopf.getBoundingClientRect();
    menue(r.left, r.bottom + 2, weitereMoeglichkeiten(o, schreiben, (f) => aktion(o.id, f), info, block, o));
    return true;
  }
  return false;
}

/** Entscheidungsfläche der gewählten Stunde. */
export function Entscheidung(props: EntscheidungProps & { mehrRef?: React.Ref<HTMLSpanElement> }) {
  const { o, b, info, block, schreiben, aktion, stand, mehrRef } = props;
  if (b && !o) {
    return (
      <div className="tp-entscheidung" data-testid="entscheidung" data-id={b.id}>
        <Kopf std={`${b.stundeText}. Stunde`} zeit={b.zeit} nr={b.id} stand={stand} klassen={b.klassen} fach={b.fach} fehlt={b.lehrer} raum={b.raum} />
        <div className="tp-abschnitt">
          <div className="tp-label">Ergebnis</div>
          <div className="tp-ergebnis" data-entfall={b.entfall || undefined}>{b.ergebnis}{b.fix ? <span className="tp-leise"> · fixiert</span> : null}</div>
        </div>
        {schreiben && !b.fix ? (
          <div className="tp-abschnitt tp-andere">
            <Button size="small" onClick={() => aktion(b.id, () => zuruecksetzen([b.id]))} title="Wieder zur offenen Stunde machen (Entf)" data-testid="entscheidung-zuruecksetzen">Zurücksetzen</Button>
            <Button size="small" appearance="subtle" onClick={() => tpKontextSetzen('vorschlag')} title="Alle Kandidaten (V)">Andere Lehrkraft …</Button>
          </div>
        ) : null}
      </div>
    );
  }
  if (!o) return null;
  const geladen = info !== undefined;
  const l = loesungen(o, info, block);
  const offen = o.offen;
  const zusatz = [o.grund, o.text].filter(Boolean).join(' – ');
  const weitere = info && info.art === 'lehrer' ? info.weitere + Math.max(0, info.kandidaten.length - 3) : 0;
  return (
    <div className="tp-entscheidung" data-testid="entscheidung" data-id={o.id}>
      <Kopf std={o.pause ? `Aufsicht nach der ${o.stunde}. Stunde` : `${stundenText(o, block)} Stunde`} zeit={o.zeit} nr={o.id} stand={stand}
        klassen={o.klassen} fach={o.pause ? `Aufsicht ${o.raum}` : o.fach} fehlt={offen ? o.lehrer : ''} raum={o.pause ? '' : o.raum}
        hinweise={[o.klausur ? 'Klausuraufsicht' : '', o.raumOffen && !offen ? 'Raum fehlt' : '', o.veranstaltung ? 'Veranstaltung' : '', block && o.block ? `Block ${o.block[0]}.–${o.block[o.block.length - 1]}.` : '', zusatz].filter(Boolean)} />

      <div className="tp-abschnitt" data-testid="empfehlung">
        <div className="tp-label">Empfehlung</div>
        {!geladen ? <div className="tp-leise tp-laedt"><Spinner size="extra-tiny" /> Kandidaten werden gesucht …</div>
          : l.primaer ? (
            <div className="tp-empfehlung">
              <Button appearance="primary" className="tp-empfehlung-knopf" disabled={!schreiben} title={l.primaer.titel} data-testid="empfehlung-uebernehmen" data-art={l.primaer.art}
                data-lehrer={l.primaer.art === 'lehrer' ? info?.kandidaten[0]?.k : undefined} onClick={() => aktion(o.id, l.primaer!.ausfuehren, `${beschreibung(o)}: ${l.primaer!.erledigt}`)}>
                {l.primaer.text}<kbd className="tp-taste-hell">Enter</kbd>
              </Button>
              <span className="tp-begruendung">{l.primaer.beschreibung}</span>
            </div>
          ) : <div className="tp-leise">{info === null ? 'Kein Vorschlag verfügbar.' : info?.art === 'raum' ? 'Kein freier Raum – „Raum zuordnen …“ zeigt auch belegte Räume.' : 'Keine Lehrkraft frei.'}</div>}
      </div>

      {geladen && (l.alternativen.length || weitere > 0) ? (
        <div className="tp-abschnitt" data-testid="alternativen">
          <div className="tp-label">Alternativen</div>
          <div className="tp-alternativen" role="list">
            {l.alternativen.map((x, i) => (
              <button key={x.kurz} type="button" role="listitem" className={mergeClasses('tp-alt', x.k?.rot && 'rot')} disabled={!schreiben} title={`${x.titel}\n(Taste ${i + 2})`} data-lehrer={x.kurz}
                onClick={() => aktion(o.id, x.ausfuehren, `${beschreibung(o)}: ${x.kurz} eingetragen`)}>
                <kbd>{i + 2}</kbd><span className="tp-alt-kurz">{x.kurz}</span><span className="tp-alt-name">{x.name}</span><span className="tp-alt-grund">{x.grund}</span>
                {x.k ? <span className="tp-alt-last">{`Woche ${x.k.woche} · Monat ${x.k.monat}`}</span> : null}
              </button>
            ))}
            {weitere > 0 ? <button type="button" className="tp-link" onClick={() => tpKontextSetzen('vorschlag')} title="Vollständiger Vertretungsvorschlag mit Betreuungen, Räumen und Vorziehungen (V)">{`Alle Kandidaten (${weitere} weitere)`}</button> : null}
          </div>
        </div>
      ) : null}

      {schreiben ? (
        <div className="tp-abschnitt">
          <div className="tp-label">Andere Lösung</div>
          <div className="tp-andere">
            {offen && l.primaer?.art !== 'entfall' ? (
              <Button size="small" onClick={() => aktion(o.id, () => entfallen([o.id]), `${beschreibung(o)}: Entfall`)} title={info?.entfallSinnvoll ? 'Entfall ist hier sinnvoll (Randstunde bzw. Regel der Stunde) – Taste E' : 'Unterricht entfällt (E)'} data-testid="entscheidung-entfall">
                Entfall<kbd>E</kbd>
              </Button>
            ) : null}
            {offen && info?.betreuung && l.primaer?.art !== 'betreuung' ? (
              <Button size="small" onClick={() => aktion(o.id, () => betreuen(o, info.betreuung!.lehrer, block), `${beschreibung(o)}: zusammengelegt mit ${info.betreuung!.k}`)}
                title={`${info.betreuung.k} betreut die Klasse neben dem eigenen Unterricht (${info.betreuung.klassen}, ${info.betreuung.naehe || 'Nähe unbekannt'}) – Taste B`}>
                {`Zusammenlegen mit ${info.betreuung.k}`}<kbd>B</kbd>
              </Button>
            ) : null}
            <span ref={mehrRef} data-testid="entscheidung-mehr">
              <MenueKnopf art="knopf" size="small" appearance="subtle" text="Weitere Möglichkeiten" titel="Ohne Lehrkraft, Raum, Vorziehen, Verlegen, Vormerken, alle Kandidaten, Wer ist frei? (M)"
                eintraege={() => weitereMoeglichkeiten(o, schreiben, (f) => aktion(o.id, f), info, block, o)} />
            </span>
            {info?.entfallSinnvoll && l.primaer?.art === 'lehrer' ? <span className="tp-leise">Entfall wäre möglich (Randstunde).</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Kopf({ std, zeit, nr, stand, klassen, fach, fehlt, raum, hinweise = [] }: { std: string; zeit: string; nr: number; stand?: string; klassen: string; fach: string; fehlt: string; raum: string; hinweise?: string[] }) {
  return (
    <div className="tp-ekopf">
      <div className="tp-ekopf-zeile">
        <span className="tp-estd">{std}</span><span className="tp-leise">{zeit}</span>
        <span className="tp-enr">{stand ? `${stand} · ` : ''}{`Nr. ${nr}`}</span>
      </div>
      <div className="tp-etitel"><b>{klassen || '–'}</b><span>{fach}</span></div>
      <div className="tp-emeta">
        {fehlt ? <span>{'fehlt: '}<span className="tp-statt">{fehlt}</span></span> : null}
        {raum ? <span>{`Raum ${raum}`}</span> : null}
        {hinweise.map((h) => <span key={h} className={h === 'Klausuraufsicht' ? 'tp-pruefung' : h === 'Raum fehlt' ? 'tp-offen' : undefined}>{h}</span>)}
      </div>
    </div>
  );
}

/**
 * Ansicht „Entscheidung“ (Tabelle der Tagesplanung): folgt der gewählten Vertretung, zeigt Empfehlung und Alternativen,
 * Tasten wie in der Liste (Enter, 1–3, E, B, O, R, M, V, F, P), solange der Fokus nicht in der Tabelle liegt.
 */
export default function EntscheidungAnsicht() {
  const datum = usePlanungsdatum();
  const schreiben = useDarfSchreiben();
  const block = useKandidaten((x) => x.block);
  const werte = useKandidaten((x) => x.werte);
  const [id, setId] = useState<number | null>(() => aktuelleAuswahl()?.id ?? null);
  // mehrere Zeilen markiert (Tabelle): gemeinsame Kandidaten für alle
  const [mehrere, setMehrere] = useState<number[]>(() => { const x = aktuelleAuswahl(); return x?.ids && x.ids.length > 1 ? x.ids : []; });
  const mehrRef = useRef<HTMLSpanElement>(null);
  useEreignis('vertretung.auswahl', (x) => { setId(x?.id ?? null); setMehrere(x?.ids && x.ids.length > 1 ? x.ids : []); });
  const { daten } = useDaten(() => arbeitslisteLaden(datum!), [datum], { bereiche: ['Vertretung', 'Stundenplan', 'Unterricht', 'Stammdaten', 'Einstellungen'], aktiv: !!datum });
  const o = useMemo(() => daten?.offen.find((x) => x.id === id) ?? null, [daten, id]);
  const b = useMemo(() => (o ? null : daten?.bearbeitet.find((x) => x.id === id) ?? null), [daten, id, o]);
  useEffect(() => { if (o) kandidatenAnfordern([o.id]); }, [o, werte]);
  const aktion = (_: number, f: () => Promise<unknown>) => {
    if (!schreiben) return;
    f().then((r) => { if (r !== null) melden('vertretung.naechsteOffene', undefined); }).catch(fehlerMelden);
  };
  const props: EntscheidungProps = { o, b, info: o ? werte[o.id] : undefined, block, schreiben, aktion };
  const propsRef = useRef(props); propsRef.current = props;
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (!t?.closest('[data-testid=entscheidung-flaeche]')) return;
      if (t.closest('input, textarea, select, button, [role=menu], [role=listbox]') && (e.key === 'Enter' || e.key === ' ')) return;
      if (document.querySelector('[role=dialog]')) return;
      if (entscheidungsTaste(e, propsRef.current, mehrRef.current)) e.preventDefault();
    };
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  }, []);
  return (
    <section className="tp-entscheidung-flaeche" data-ansicht="vertretung.entscheidung" aria-label="Entscheidung" data-testid="entscheidung-flaeche" tabIndex={-1}>
      {mehrere.length > 1 ? <Sammelleiste ids={mehrere} schreiben={schreiben} />
        : o || b ? <Entscheidung {...props} mehrRef={mehrRef} />
        : <div className="tp-leer">{id ? 'Diese Zeile braucht keine Entscheidung. Alle Kandidaten zeigt „V“.' : 'Eine Vertretung in der Tabelle wählen – hier erscheinen Empfehlung und Alternativen.'}</div>}
    </section>
  );
}
