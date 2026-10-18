// Manuelles Planen im Stundenplan: Blöcke/Doppelstunden verschieben und setzen (mit Rückfrage, ob behindernder Unterricht
// entplant werden soll), Mehrfachauswahl (entplanen, fixieren), Kontextmenüs, Raum zuordnen bzw. entfernen (Raumliste),
// Tauschvorschläge, alle Stunden entplanen bzw. fixieren. Die Stundenplanansicht nutzt die Funktionen hier.
import {
  Button, Input, Radio, RadioGroup, Switch, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Tab, TabList,
  makeStyles, mergeClasses, tokens,
} from '@fluentui/react-components';
import { Checkmark16Regular } from '@fluentui/react-icons';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { api } from '@/api/client';
import { befehl } from '@/kern/befehle';
import { darfSchreiben, zustand } from '@/kern/zustand';
import { Ladeanzeige } from '@/komponenten/ansicht';
import { StandardDialog, dialogZeigen, frage, meldung } from '@/komponenten/dialoge';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import type { MenueListe } from '@/komponenten/menue';
import type { Auswahl, Markierung, PlanEintrag, StundeZiehen, StundenplanrasterApi, Zielantwort } from '@/komponenten/raster/Stundenplanraster';

const useStile = makeStyles({
  frage: { whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: '0 0 12px 0', padding: '10px 12px', backgroundColor: tokens.colorNeutralBackground2, borderRadius: tokens.borderRadiusMedium },
  leise: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
  info: { display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '12px' },
  infoT: { display: 'block', fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 },
  filter: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 16px', marginBottom: '12px' },
  mitte: { display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 3fr)', gap: '16px', minHeight: '340px' },
  abschnitt: { display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 },
  abschnittKopf: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' },
  h3: { margin: 0, fontSize: tokens.fontSizeBase300, fontWeight: tokens.fontWeightSemibold },
  rollen: { overflow: 'auto', maxHeight: '48vh', border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusMedium, position: 'relative' },
  zeile: { cursor: 'pointer' },
  gewaehlt: { backgroundColor: tokens.colorBrandBackground2, ':hover': { backgroundColor: tokens.colorBrandBackground2Hover } },
  wunsch: { backgroundColor: tokens.colorPaletteGreenBackground1 },
  besetzt: { color: tokens.colorNeutralForeground3 },
  gesperrt: { color: tokens.colorNeutralForegroundDisabled, textDecoration: 'line-through' },
  z: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  m: { textAlign: 'center' },
  rot: { color: tokens.colorPaletteRedForeground1, fontWeight: tokens.fontWeightSemibold },
  gruen: { color: tokens.colorPaletteGreenForeground1, fontWeight: tokens.fontWeightSemibold },
  legende: { display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '10px', color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, alignItems: 'center' },
  punkt: { display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', marginRight: '6px', verticalAlign: 'middle', border: `1px solid ${tokens.colorNeutralStroke1}` },
});

/**
 * Ändernde Anfrage mit Rückfrage: Antwortet der Server mit { ok:false, frage }, wird gefragt, ob behindernder Unterricht
 * entplant werden soll – Entplanen, Trotzdem (Kollision), Abbrechen.
 */
export async function mitRueckfrage<T extends { ok?: boolean; frage?: string }>(pfad: string, daten: object, quelle?: string): Promise<T | null> {
  let antwort = await api.post<T>(api.dok(pfad), daten, { quelle });
  if (antwort?.ok === false && antwort.frage) {
    const text = antwort.frage;
    const wahl = await dialogZeigen<string>((schliessen) => <BelegtDialog text={text} schliessen={schliessen} />);
    if (!wahl) return null;
    antwort = await api.post<T>(api.dok(pfad), { ...daten, aktion: wahl }, { quelle });
  }
  return antwort;
}

function BelegtDialog({ text, schliessen }: { text: string; schliessen: (w: string | null) => void }) {
  const s = useStile();
  return (
    <StandardDialog<string> titel="Stunde ist belegt" breite="600px" beiKnopf={schliessen}
      knoepfe={[{ text: 'Behindernden Unterricht entplanen', wert: 'entplanen', primaer: true }, { text: 'Trotzdem ausführen', wert: 'kollision' }, { text: 'Abbrechen', wert: null }]}>
      <pre className={s.frage}>{text}</pre>
      <p className={s.leise}>Entplanen: Der behindernde Unterricht wird entfernt und erscheint unter „Nicht verplant“. Trotzdem ausführen: Die Kollision bleibt bestehen.</p>
    </StandardDialog>
  );
}

/** Stunde bzw. Block (Drag & Drop im Raster) verschieben oder nicht verplante Stunden setzen. */
export async function ablegen(d: StundeZiehen & { zielTag: number; zielStunde: number }, quelle?: string): Promise<boolean> {
  if (d.tag !== undefined) {
    const erg = await mitRueckfrage<{ ok?: boolean; frage?: string; unveraendert?: boolean; art?: string }>('/planung/verschieben',
      { unterricht: d.u, tag: d.tag, stunde: d.stunde, zielTag: d.zielTag, zielStunde: d.zielStunde, einzeln: !!d.einzeln }, quelle);
    if (!erg || erg.unveraendert) return false;
    hinweis(erg.art === 'tausch' ? 'Stunden getauscht – Strg+Z macht es rückgängig.' : 'Stunde verschoben – Strg+Z macht es rückgängig.', 'ok', 2000);
    return true;
  }
  const erg = await mitRueckfrage('/planung/verplanen', { unterricht: d.u, tag: d.zielTag, stunde: d.zielStunde, laenge: d.laenge || 1 }, quelle);
  if (!erg) return false;
  hinweis((d.laenge || 1) > 1 ? 'Block verplant – Strg+Z macht es rückgängig.' : 'Stunde verplant – Strg+Z macht es rückgängig.', 'ok', 2000);
  return true;
}

/** Zielstatus mit Gründen für das Ziehen (verplante Stunde bzw. nicht verplanter Block). */
export function zielstatus(d: StundeZiehen): Promise<Zielantwort> {
  const q = new URLSearchParams({ unterricht: String(d.u) });
  if (d.tag !== undefined) { q.set('tag', String(d.tag)); q.set('stunde', String(d.stunde)); if (d.einzeln) q.set('einzeln', 'true'); } else q.set('laenge', String(d.laenge || 1));
  return api.get<Zielantwort>(api.dok(`/planung/zielstatus?${q}`));
}

const ref = (s: { u: number; tag: number; stunde: number }) => ({ unterricht: s.u, tag: s.tag, stunde: s.stunde });

/** Markierte Stunden entplanen (Mehrfachauswahl, eine Rückgängig-Stufe). */
export async function entplanen(stunden: { u: number; tag: number; stunde: number; e?: PlanEintrag }[], quelle?: string): Promise<boolean> {
  if (!stunden.length) { hinweis('Bitte zuerst eine Stunde im Stundenplan anklicken.', 'warnung'); return false; }
  const fixiert = stunden.some((s) => s.e?.fix);
  if (fixiert && !(await frage('Unter den gewählten Stunden sind fixierte Stunden. Fixierte Stunden entplanen?'))) return false;
  await api.post(api.dok('/planung/entplanen'), { stunden: stunden.map(ref), auchFixierte: fixiert }, { quelle });
  hinweis(stunden.length > 1 ? `${stunden.length} Stunden entplant.` : 'Stunde entplant.', 'ok', 2000);
  return true;
}

/** Markierte Stunden fixieren bzw. lösen (Ziel nach der ersten Stunde). */
export async function fixieren(stunden: { u: number; tag: number; stunde: number; e?: PlanEintrag }[], quelle?: string): Promise<boolean> {
  if (!stunden.length) { hinweis('Bitte zuerst eine Stunde im Stundenplan anklicken.', 'warnung'); return false; }
  const ziel = !stunden[0]!.e?.fix;
  await api.post(api.dok('/planung/fixieren'), { stunden: stunden.map(ref), fixieren: ziel }, { quelle });
  hinweis(ziel ? 'Fixiert.' : 'Fixierung gelöst.', 'ok', 1500);
  return true;
}

// ---------------------------------------------------------------------------------------------
// Raum zuordnen / entfernen

const UMFANG = ['Diese Stunde', 'Ganzer Block', 'Alle Stunden des Unterrichts'];
let umfangMerken = 1;
let nurFreiMerken = false;

interface RaumDaten {
  unterricht: { id: number; text: string };
  stunden: { text: string; raum: string }[];
  zeile: number;
  zeilen: { nr: number; lehrer: string; fach: string; raum: string; klassen: string; wunschraum: string; ugruppe: string }[];
  raeume: { id: number; kurz: string; lang: string; kap: number; ausweich: boolean; stamm: boolean; besetzt: boolean; besetztDurch: string; raumgruppen: string; gang: string; wochenbelegung: number; frei: number; gesamt: number; kapDiff: number | null; wunsch: boolean; gesperrt: number }[];
}
interface RaumAntwort extends Partial<RaumDaten> { ok?: boolean; art?: string; frage?: string; optionen?: { wert: string; text: string }[] }

function RaumDialog({ stunde, quelle, schliessen }: { stunde: { u: number; tag: number; stunde: number }; quelle?: string; schliessen: (geaendert: boolean | null) => void }) {
  const s = useStile();
  const schreiben = darfSchreiben();
  const [daten, setDaten] = useState<RaumDaten | null>(null);
  const [zeile, setZeile] = useState(0);
  const [umfang, setUmfang] = useState(umfangMerken);
  const [laedt, setLaedt] = useState(false);
  const [lang, setLang] = useState(false);
  const [nurFrei, setNurFrei] = useState(nurFreiMerken);
  const [nurWunsch, setNurWunsch] = useState(false);
  const [nurKap, setNurKap] = useState(false);
  const [suche, setSuche] = useState('');
  const [raum, setRaum] = useState<number | null>(null);
  const geaendert = useRef(false);
  const rechtsRef = useRef<HTMLDivElement>(null);

  const laden = async (z = zeile, u = umfang) => {
    setLaedt(true);
    try {
      const q = new URLSearchParams({ unterricht: String(stunde.u), tag: String(stunde.tag), stunde: String(stunde.stunde), zeile: String(z), umfang: String(u) });
      const d = await api.get<RaumDaten>(api.dok(`/planung/raum?${q}`));
      setDaten(d);
      setZeile(d.zeile);
    } catch (e) { fehlerMelden(e); } finally { setLaedt(false); }
  };
  useEffect(() => { void laden(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const raeume = useMemo(() => {
    const f = suche.trim().toLowerCase();
    return (daten?.raeume || []).filter((r) => !(nurFrei && r.frei < r.gesamt) && !(nurWunsch && !r.wunsch) && !(nurKap && r.kapDiff !== null && r.kapDiff < 0)
      && !(f && !`${r.kurz} ${r.lang} ${r.raumgruppen}`.toLowerCase().includes(f)));
  }, [daten, nurFrei, nurWunsch, nurKap, suche]);

  const senden = async (r: number | null, extra: Record<string, unknown> = {}): Promise<void> => {
    const basis = { unterricht: stunde.u, tag: stunde.tag, stunde: stunde.stunde, zeile, umfang, raum: r, ...extra };
    let antwort = await api.post<RaumAntwort>(api.dok('/planung/raum'), basis, { quelle });
    if (antwort?.ok === false) {
      if (antwort.art === 'gesperrt') {
        if (!(await frage(antwort.frage || 'Der Raum ist gesperrt. Trotzdem zuordnen?'))) return;
        antwort = await api.post<RaumAntwort>(api.dok('/planung/raum'), { ...basis, trotzGesperrt: true }, { quelle });
        if (antwort?.ok === false && antwort.art === 'belegt') return senden(r, { ...extra, trotzGesperrt: true });
      } else {
        const opt = antwort.optionen || [];
        const loesung = await dialogZeigen<string>((zu) => <LoesungDialog text={antwort.frage || ''} optionen={opt} schliessen={zu} />);
        if (!loesung) return;
        return senden(r, { ...extra, loesung });
      }
    }
    if (antwort?.raeume) { setDaten(antwort as RaumDaten); geaendert.current = true; }
  };
  const zuordnen = async () => {
    if (!schreiben) return;
    if (!raum) { hinweis('Bitte rechts einen Raum markieren.', 'warnung'); return; }
    await senden(raum).catch(fehlerMelden);
  };
  const tasteRechts = (e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); void zuordnen(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const i = raeume.findIndex((r) => r.id === raum);
      const n = raeume[Math.max(0, Math.min(raeume.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
      if (n) { setRaum(n.id); setTimeout(() => rechtsRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })); }
    }
  };
  const haken = (b: boolean) => (b ? <Checkmark16Regular /> : null);
  const name = (r: RaumDaten['raeume'][number]) => (lang && r.lang ? r.lang : r.kurz);

  return (
    <StandardDialog<boolean> titel="Raum zuordnen" breite="min(1180px, 96vw)" knoepfe={[{ text: 'Schließen', wert: true, primaer: true }]} beiKnopf={() => schliessen(geaendert.current)}>
      <div onKeyDown={(e) => { if (e.key === 'Delete' && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); void senden(null).catch(fehlerMelden); } }} style={{ position: 'relative' }}>
        {daten ? (
          <div className={s.info}>
            <div><span className={s.infoT}>Unterricht</span>Nr. {daten.unterricht.id} · {daten.unterricht.text}</div>
            <div><span className={s.infoT}>{daten.stunden.length === 1 ? 'Stunde' : `${daten.stunden.length} Stunden`}</span>{daten.stunden.map((x) => x.text).join(', ')}</div>
            <div><span className={s.infoT}>Raum</span>{[...new Set(daten.stunden.map((x) => x.raum).filter(Boolean))].join(', ') || 'Kein Raum'}</div>
          </div>
        ) : null}
        <div className={s.filter}>
          <span className={s.leise}>Anwenden auf</span>
          <TabList size="small" selectedValue={String(umfang)} onTabSelect={(_, d) => { const u = Number(d.value); setUmfang(u); umfangMerken = u; void laden(zeile, u); }}>
            {UMFANG.map((t, i) => <Tab key={i} value={String(i)}>{t}</Tab>)}
          </TabList>
          <Input size="small" type="search" placeholder="Raum suchen" value={suche} onChange={(_, d) => setSuche(d.value)} aria-label="Raum suchen" />
          <Switch label="Nur freie Räume" checked={nurFrei} onChange={(_, d) => { setNurFrei(d.checked); nurFreiMerken = d.checked; }} />
          <Switch label="Nur Wunschräume" checked={nurWunsch} onChange={(_, d) => setNurWunsch(d.checked)} />
          <Switch label="Nur mit genug Plätzen" checked={nurKap} onChange={(_, d) => setNurKap(d.checked)} />
          <Switch label="Langnamen" checked={lang} onChange={(_, d) => setLang(d.checked)} />
        </div>
        <div className={s.mitte}>
          <div className={s.abschnitt}>
            <div className={s.abschnittKopf}><h3 className={s.h3}>Kopplungszeilen</h3><Button size="small" disabled={!schreiben} onClick={() => senden(null).catch(fehlerMelden)} title="Raum der markierten Kopplungszeile entfernen (Entf)">Raum entfernen</Button></div>
            <div className={s.rollen}>
              <Table size="extra-small">
                <TableHeader><TableRow>{['Nr.', 'Lehrkraft', 'Fach', 'Raum', 'Klassen', 'Wunschraum', 'Unterrichtsgruppe'].map((t) => <TableHeaderCell key={t}>{t}</TableHeaderCell>)}</TableRow></TableHeader>
                <TableBody>
                  {(daten?.zeilen || []).map((z) => (
                    <TableRow key={z.nr} className={mergeClasses(s.zeile, z.nr === zeile && s.gewaehlt)} onClick={() => { setZeile(z.nr); void laden(z.nr); }}>
                      <TableCell>{z.nr === 0 ? String(daten!.unterricht.id) : ''}</TableCell><TableCell>{z.lehrer}</TableCell><TableCell>{z.fach}</TableCell>
                      <TableCell>{z.raum}</TableCell><TableCell>{z.klassen}</TableCell><TableCell>{z.wunschraum}</TableCell><TableCell>{z.ugruppe}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className={s.abschnitt}>
            <div className={s.abschnittKopf}><h3 className={s.h3}>Räume</h3><Button size="small" appearance="primary" disabled={!schreiben} onClick={() => void zuordnen()} title="Markierten Raum zuordnen (Doppelklick, Enter)">Zuordnen</Button></div>
            <div className={s.rollen} ref={rechtsRef} tabIndex={0} onKeyDown={tasteRechts}>
              <Table size="extra-small">
                <TableHeader><TableRow>
                  {[['Raum'], ['Plätze', 'z'], ['Ausweichraum', 'm'], ['Stammraum', 'm'], ['Belegt', 'm'], ['Belegt durch'], ['Raumgruppe'], ['Gang'], ['Wochenbelegung', 'z', 'Verplante Stunden des Raums in der Woche'], ['Frei', 'z', 'Freie Stunden von den betroffenen Stunden'], ['Plätze ±', 'z', 'Plätze minus Schülerzahl']]
                    .map(([t, k, titel]) => <TableHeaderCell key={t} className={k === 'z' ? s.z : k === 'm' ? s.m : undefined} title={titel}>{t}</TableHeaderCell>)}
                </TableRow></TableHeader>
                <TableBody>
                  {raeume.map((r) => {
                    const kl = r.gesperrt > 0 && r.frei === 0 ? s.gesperrt : r.besetzt ? s.besetzt : r.wunsch ? s.wunsch : undefined;
                    return (
                      <TableRow key={r.id} aria-selected={raum === r.id} className={mergeClasses(s.zeile, kl, raum === r.id && s.gewaehlt)} onClick={() => setRaum(r.id)} onDoubleClick={() => { setRaum(r.id); void senden(r.id).catch(fehlerMelden); }}>
                        <TableCell>{name(r)}</TableCell><TableCell className={s.z}>{r.kap > 0 ? String(r.kap) : ''}</TableCell>
                        <TableCell className={s.m}>{haken(r.ausweich)}</TableCell><TableCell className={s.m}>{haken(r.stamm)}</TableCell><TableCell className={s.m}>{haken(r.besetzt)}</TableCell>
                        <TableCell>{r.besetztDurch}</TableCell><TableCell>{r.raumgruppen}</TableCell><TableCell>{r.gang}</TableCell>
                        <TableCell className={s.z}>{r.wochenbelegung}</TableCell><TableCell className={mergeClasses(s.z, r.frei < r.gesamt && s.rot)}>{r.frei}</TableCell>
                        <TableCell className={mergeClasses(s.z, r.kapDiff !== null && r.kapDiff < 0 && s.rot)}>{r.kapDiff === null ? '' : r.kapDiff > 0 ? `+${r.kapDiff}` : String(r.kapDiff)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
        <div className={s.legende}>
          <span><i className={s.punkt} style={{ background: 'var(--colorPaletteGreenBackground1)' }} />Wunschraum bzw. Raumgruppe</span>
          <span><i className={s.punkt} />In mindestens einer Stunde belegt</span>
          <span><i className={s.punkt} style={{ background: 'var(--colorNeutralBackground3)' }} />Gesperrt</span>
          <span>Doppelklick oder Enter ordnet zu, Entf entfernt den Raum</span>
        </div>
        {laedt ? <Ladeanzeige /> : null}
      </div>
    </StandardDialog>
  );
}

function LoesungDialog({ text, optionen, schliessen }: { text: string; optionen: { wert: string; text: string }[]; schliessen: (w: string | null) => void }) {
  const s = useStile();
  const [wert, setWert] = useState(optionen[0]?.wert || 'kollision');
  return (
    <StandardDialog<boolean> titel="Raum ist belegt" knoepfe={[{ text: 'OK', wert: true, primaer: true }, { text: 'Abbrechen', wert: null }]} beiKnopf={(w) => schliessen(w ? wert : null)}>
      <pre className={s.frage}>{text}</pre>
      <RadioGroup value={wert} onChange={(_, d) => setWert(d.value)} aria-label="Vorgehen">
        {optionen.map((o) => <Radio key={o.wert} value={o.wert} label={o.text} />)}
      </RadioGroup>
    </StandardDialog>
  );
}

/** Dialog „Raum zuordnen“ für eine verplante Stunde; true, wenn etwas geändert wurde. */
export async function raumDialog(stunde: { u: number; tag: number; stunde: number }, quelle?: string): Promise<boolean> {
  return !!(await dialogZeigen<boolean>((schliessen) => <RaumDialog stunde={stunde} quelle={quelle} schliessen={schliessen} />));
}

// ---------------------------------------------------------------------------------------------
// Tauschvorschläge

interface Tauschvorschlag { gewinn: number; beschreibung: string; a: unknown; b: unknown }

function TauschDialog({ stunde, schliessen }: { stunde: { u: number; tag: number; stunde: number }; schliessen: (v: Tauschvorschlag | null) => void }) {
  const s = useStile();
  const [liste, setListe] = useState<Tauschvorschlag[] | null>(null);
  const [gewaehlt, setGewaehlt] = useState<Tauschvorschlag | null>(null);
  useEffect(() => {
    api.get<Tauschvorschlag[]>(api.dok(`/planung/tausch?unterricht=${stunde.u}&tag=${stunde.tag}&stunde=${stunde.stunde}`))
      .then((l) => { setListe(l); setGewaehlt(l[0] ?? null); }).catch((e) => { fehlerMelden(e); setListe([]); });
  }, [stunde]);
  return (
    <StandardDialog<boolean> titel="Tauschvorschläge" breite="min(820px, 96vw)"
      knoepfe={[{ text: 'Tauschen', wert: true, primaer: true, deaktiviert: !gewaehlt }, { text: 'Abbrechen', wert: null }]}
      beiKnopf={(w) => { if (w && !gewaehlt) { hinweis('Bitte einen Tausch auswählen.', 'warnung'); return; } schliessen(w ? gewaehlt : null); }}>
      <div className={s.rollen} style={{ minHeight: 160 }}>
        <Table size="small">
          <TableHeader><TableRow><TableHeaderCell className={s.z} style={{ width: 120 }}>Verbesserung</TableHeaderCell><TableHeaderCell>Tausch</TableHeaderCell></TableRow></TableHeader>
          <TableBody>
            {liste && !liste.length ? <TableRow><TableCell colSpan={2} className={s.leise}>Für diese Stunde gibt es keine Tauschmöglichkeit.</TableCell></TableRow> : null}
            {(liste || []).map((v, i) => (
              <TableRow key={i} className={mergeClasses(s.zeile, v === gewaehlt && s.gewaehlt)} onClick={() => setGewaehlt(v)} onDoubleClick={() => schliessen(v)}>
                <TableCell className={mergeClasses(s.z, v.gewinn > 0 ? s.gruen : v.gewinn < 0 ? s.rot : undefined)}>{v.gewinn > 0 ? `+${v.gewinn}` : String(v.gewinn)}</TableCell>
                <TableCell>{String(v.beschreibung ?? '').replace(/\s*⇄\s*/g, ' und ')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!liste ? <Ladeanzeige /> : null}
      </div>
      <p className={s.leise}>Verbesserung der Bewertungszahl des Plans (positiv ist besser). Angeboten werden nur Tauschmöglichkeiten ohne neue Kollisionen. Doppelklick tauscht sofort.</p>
    </StandardDialog>
  );
}

/** Tauschvorschläge mit Gewinn für eine Stunde; „Tauschen“ führt den gewählten Tausch aus. */
export async function tauschDialog(stunde: { u: number; tag: number; stunde: number }, quelle?: string): Promise<boolean> {
  const v = await dialogZeigen<Tauschvorschlag>((schliessen) => <TauschDialog stunde={stunde} schliessen={schliessen} />);
  if (!v || !darfSchreiben()) return false;
  await api.post(api.dok('/planung/tauschen'), { a: v.a, b: v.b }, { quelle });
  hinweis('Stunden getauscht – Strg+Z macht es rückgängig.', 'ok', 2500);
  return true;
}

// ---------------------------------------------------------------------------------------------
// Kontextmenü und Tastatur im Stundenplan

export interface PlanKontext {
  id: string;
  raster: () => StundenplanrasterApi | null;
  plan: () => { zellen: { tag: number; stunde: number; eintraege: PlanEintrag[] }[] } | null;
  typ: string;
  schreiben: boolean;
  element: () => number | null;
  planen: () => boolean;
  neuLaden: () => Promise<void>;
  oeffnen: (typ: string, p?: Record<string, unknown>) => void;
}

async function aktion(ctx: PlanKontext, f: () => Promise<boolean>) {
  if (await f()) await ctx.neuLaden();
}

const unterrichtParameter = (ctx: PlanKontext) => ({ sicht: ctx.typ === 'raum' || ctx.typ === 'fach' ? 'alle' : ctx.typ, element: ctx.typ === 'raum' || ctx.typ === 'fach' ? undefined : ctx.element() ?? undefined });

function blockMarkieren(ctx: PlanKontext, a: Auswahl) {
  const stunden = new Set(a.stunden || [a.stunde]);
  const plan = ctx.plan();
  if (!plan) return;
  const belegt = new Set(plan.zellen.filter((z) => z.tag === a.tag && z.eintraege.some((x) => x.u === a.u)).map((z) => z.stunde));
  for (let st = Math.min(...stunden) - 1; belegt.has(st); st--) stunden.add(st);
  for (let st = Math.max(...stunden) + 1; belegt.has(st); st++) stunden.add(st);
  ctx.raster()?.stundenMarkieren([...stunden].map((st) => ({ u: a.u, tag: a.tag, stunde: st })));
}

/** Einträge des Kontextmenüs einer Stunde. */
export function kontextEintraege(ctx: PlanKontext, e: PlanEintrag, tag: number, stunde: number): MenueListe {
  const r = ctx.raster();
  if (!r) return [];
  const markiert: Markierung[] = r.markierte();
  const mehrere = r.anzahlMarkiert() > 1;
  const { schreiben } = ctx;
  const liste: MenueListe = [{ titel: `Unterricht Nr. ${e.u} · ${e.fach} ${e.klassen}` }];
  if (mehrere) {
    liste.push(
      { text: `${markiert.length} markierte Stunden entplanen`, taste: 'Entf', deaktiviert: !schreiben, aktion: () => aktion(ctx, () => entplanen(markiert, ctx.id)) },
      { text: 'Markierte Stunden fixieren / lösen', taste: 'F', deaktiviert: !schreiben, aktion: () => aktion(ctx, () => fixieren(markiert, ctx.id)) },
      { text: 'Markierung aufheben', taste: 'Esc', aktion: () => r.markierungAufheben() },
      null);
  }
  const a: Auswahl = r.auswahl() || { u: e.u, tag, stunde, laenge: 1, stunden: [stunde], e };
  liste.push(
    { text: 'Unterricht bearbeiten …', aktion: () => ctx.oeffnen('unterricht', unterrichtParameter(ctx)) },
    { text: 'Ganzen Block markieren', aktion: () => blockMarkieren(ctx, a) },
    { text: 'Alle Stunden des Unterrichts markieren', aktion: () => r.alleMarkieren((x) => x.u === e.u) },
    { text: e.fix ? 'Fixierung lösen' : 'Stunde fixieren', taste: 'F', deaktiviert: !schreiben, aktion: () => aktion(ctx, () => fixieren(mehrere ? markiert : [{ ...a, e }], ctx.id)) },
    { text: 'Raum zuordnen …', aktion: () => aktion(ctx, () => raumDialog(a, ctx.id)) },
    { text: 'Tauschvorschläge …', deaktiviert: !schreiben, aktion: () => aktion(ctx, () => tauschDialog(a, ctx.id)) },
    { text: 'Stunde entplanen', taste: mehrere ? undefined : 'Entf', deaktiviert: !schreiben, aktion: () => aktion(ctx, () => entplanen([{ u: a.u, tag: a.tag, stunde: a.stunde, e }], ctx.id)) },
    { text: 'Zeitwünsche des Unterrichts', aktion: () => ctx.oeffnen('zeitwuensche', { typ: 'unterricht', element: e.u }) },
    null,
    { text: 'Alle Stunden markieren', taste: 'Strg+A', aktion: () => r.alleMarkieren() },
  );
  return liste;
}

/** Kontextmenü auf einem leeren Feld. */
export function feldEintraege(ctx: PlanKontext): MenueListe {
  const r = ctx.raster();
  if (!r) return [];
  const markiert = r.markierte();
  const n = r.anzahlMarkiert();
  return [
    n ? { text: `${markiert.length} markierte Stunden entplanen`, deaktiviert: !ctx.schreiben, aktion: () => aktion(ctx, () => entplanen(markiert, ctx.id)) } : undefined,
    n ? { text: 'Markierung aufheben', aktion: () => r.markierungAufheben() } : undefined,
    { text: 'Alle Stunden markieren', taste: 'Strg+A', aktion: () => r.alleMarkieren() },
    null,
    { text: 'Diagnose', aktion: () => befehl('optimierung.diagnose') },
    { text: 'Zeitwünsche', aktion: () => ctx.oeffnen('zeitwuensche', { typ: ctx.typ, element: ctx.element() ?? undefined }) },
  ];
}

/** Tastatur im Raster: Entf entplanen, F fixieren, Strg+A alle markieren, Esc Markierung aufheben. true = behandelt. */
export function taste(ctx: PlanKontext, ev: KeyboardEvent): boolean {
  const r = ctx.raster();
  if (!r) return false;
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'a') { r.alleMarkieren(); return true; }
  if (ev.key === 'Escape' && r.anzahlMarkiert()) { r.markierungAufheben(); return true; }
  if (ev.ctrlKey || ev.metaKey || ev.altKey || !ctx.schreiben || !ctx.planen()) return false;
  if (ev.key === 'Delete') { aktion(ctx, () => entplanen(r.markierte(), ctx.id)).catch(fehlerMelden); return true; }
  if (ev.key === 'f' || ev.key === 'F') { aktion(ctx, () => fixieren(r.markierte(), ctx.id)).catch(fehlerMelden); return true; }
  return false;
}

// ---------------------------------------------------------------------------------------------
// Befehle (beziehen sich auf die zuletzt benutzte Stundenplanansicht)

let aktiverPlan: PlanKontext | null = null;
export function planAnmelden(ctx: PlanKontext) { aktiverPlan = ctx; return () => { if (aktiverPlan === ctx) aktiverPlan = null; }; }
export function planAktivieren(ctx: PlanKontext) { aktiverPlan = ctx; }

async function gewaehlteStunde(text = 'Bitte zuerst eine Stunde im Stundenplan anklicken.') {
  const a = aktiverPlan?.raster()?.auswahl();
  if (!aktiverPlan || !a) {
    if (!aktiverPlan) void befehl('stundenplan.oeffnen', { typ: 'klasse' });
    await meldung(text);
    return null;
  }
  return { ctx: aktiverPlan, a };
}

export async function befehlTausch() {
  const g = await gewaehlteStunde('Tauschvorschläge gibt es für eine Stunde im Stundenplan: bitte zuerst eine Stunde anklicken.');
  if (g && (await tauschDialog(g.a, g.ctx.id))) await g.ctx.neuLaden();
}

export async function befehlRaum() {
  const g = await gewaehlteStunde();
  if (g && (await raumDialog(g.a, g.ctx.id))) await g.ctx.neuLaden();
}

export async function befehlAlleEntplanen() {
  const n = zustand().dokument?.zaehler?.planstunden;
  if (!(await frage(`Alle nicht fixierten Stunden entplanen?${n ? `\n(${n} Stunden im Plan)` : ''}`, { gefahr: true, ja: 'Entplanen', nein: 'Abbrechen' }))) return;
  const erg = await api.post<{ entplant: number; verbleibend: number }>(api.dok('/planung/alle-entplanen'), { fixierteBehalten: true });
  hinweis(`${erg.entplant} Stunden entplant${erg.verbleibend ? `, ${erg.verbleibend} fixierte bleiben` : ''} – Strg+Z macht es rückgängig.`, 'ok', 4000);
}

export async function befehlAlleFixieren({ fixieren: fix = true }: { fixieren?: boolean } = {}) {
  await api.post(api.dok('/planung/alle-fixieren'), { fixieren: fix });
  hinweis(fix ? 'Alle Stunden fixiert.' : 'Alle Fixierungen aufgehoben.', 'ok', 2500);
}

