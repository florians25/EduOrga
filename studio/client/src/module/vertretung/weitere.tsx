// Dialoge der Vertretungsplanung: Sondereinsätze (mehrere Zeilen, Klassenkonferenz), automatische Vertretung und Einstellungen
// (Regeln je Stunde, Vertretungszähler, Vertretungsvorschlag, Allgemein, Arten und Farben).
import {
  Button, Field, Input, Select, Switch, Tab, TabList, Text, makeStyles, mergeClasses, tokens,
} from '@fluentui/react-components';
import { Delete20Regular } from '@fluentui/react-icons';
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { darfSchreiben } from '@/kern/zustand';
import { StandardDialog, dialogZeigen, formular, meldung } from '@/komponenten/dialoge';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { datumLesen, datumText, planungsdatum, vpfad } from './kern';

const useStile = makeStyles({
  leise: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200, margin: '0 0 8px 0' },
  tab: { width: '100%', borderCollapse: 'collapse', fontSize: tokens.fontSizeBase300 },
  th: { textAlign: 'left', fontWeight: tokens.fontWeightMedium, fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground2, padding: '2px 3px' },
  td: { padding: '2px 3px' },
  rollen: { maxHeight: '50vh', overflow: 'auto' },
  zeile: { display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' },
  formular: { display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr)', gap: '10px 16px', alignItems: 'center' },
  voll: { gridColumn: '1 / -1' },
  abschnitt: { gridColumn: '1 / -1', margin: '8px 0 0 0', fontSize: tokens.fontSizeBase300, fontWeight: tokens.fontWeightSemibold },
  offen: { display: 'flex', gap: '24px' },
  offenZahl: { fontSize: '20px', fontWeight: tokens.fontWeightSemibold, marginRight: '6px', fontVariantNumeric: 'tabular-nums' },
  seite: { minHeight: '380px', paddingTop: '12px' },
  raster: { borderCollapse: 'collapse', fontSize: tokens.fontSizeBase200, marginTop: '8px' },
  rz: { width: '64px', height: '26px', border: `1px solid ${tokens.colorNeutralStroke2}`, textAlign: 'center', cursor: 'pointer', userSelect: 'none' },
  rk: { padding: '2px 8px', fontWeight: tokens.fontWeightMedium, color: tokens.colorNeutralForeground2 },
  Vertreten: { backgroundColor: tokens.colorNeutralBackground1 },
  Entfall: { backgroundColor: 'var(--up-entfall-flaeche)', color: 'var(--up-entfall)' },
  Eigenverantwortlich: { backgroundColor: 'var(--up-frei-flaeche)', color: 'var(--up-frei)' },
  legende: { display: 'flex', gap: '16px', marginTop: '10px', fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, alignItems: 'center' },
  punkt: { display: 'inline-block', width: '14px', height: '12px', border: `1px solid ${tokens.colorNeutralStroke1}`, marginRight: '6px', verticalAlign: 'middle' },
  zahl: { width: '90px' },
});

// ---------------------------------------------------------------------------------------------
// Sondereinsätze

interface SeZeile { k: number; datum: string; sv: string; sb: string; lehrer: string; klassen: string; fach: string; raum: string; gruppe: string; text: string }
let sz = 0;

function Sondereinsatz({ d0, st, klassen, lehrer, schliessen }: { d0: string; st: number; klassen: string; lehrer: string; schliessen: (z: SeZeile[] | null) => void }) {
  const s = useStile();
  const leer = (w: Partial<SeZeile> = {}): SeZeile => ({ k: ++sz, datum: datumText(w.datum || d0), sv: String(w.sv ?? st), sb: String(w.sb ?? st), lehrer: w.lehrer ?? '', klassen: w.klassen ?? '', fach: '', raum: '', gruppe: '', text: '' });
  const [zeilen, setZeilen] = useState<SeZeile[]>(() => [leer({ lehrer, klassen })]);
  const [fokus, setFokus] = useState(0);
  const setzen = (i: number, teil: Partial<SeZeile>) => setZeilen((l) => {
    const n = l.map((z, j) => (j === i ? { ...z, ...teil } : z));
    if (i === n.length - 1) n.push({ ...leer(), datum: n[i]!.datum, sv: n[i]!.sv, sb: n[i]!.sb });
    return n;
  });
  const konferenz = async () => {
    const i = Math.min(fokus, zeilen.length - 1);
    let kl = zeilen[i]!.klassen.trim();
    if (!kl) { const w = await formular('Klassenkonferenz', [{ name: 'k', titel: 'Klassen', pflicht: true, hinweis: 'Kurznamen, mehrere mit Komma.' }]); if (!w) return; kl = w.k; }
    const r = await api.get<{ lehrer: string }>(vpfad(`/klassenkonferenz?klassen=${encodeURIComponent(kl)}`));
    setzen(i, { klassen: kl, lehrer: r.lehrer, text: zeilen[i]!.text || 'Klassenkonferenz' });
  };
  const feld = (i: number, k: keyof SeZeile, breite: number) => (
    <Input size="small" style={{ width: breite }} value={String(zeilen[i]![k])} onFocus={() => setFokus(i)} onChange={(_, x) => setzen(i, { [k]: x.value } as Partial<SeZeile>)} />
  );
  return (
    <StandardDialog<boolean> titel="Sondereinsätze" breite="1000px" knoepfe={[{ text: 'Anlegen', wert: true, primaer: true }, { text: 'Abbrechen', wert: null }]}
      beiKnopf={(w) => schliessen(w ? zeilen : null)} links={<Button size="small" onClick={() => konferenz().catch(fehlerMelden)} title="Alle Lehrkräfte eintragen, die die Klassen der aktuellen Zeile unterrichten">Klassenkonferenz</Button>}>
      <p className={s.leise}>Je Zeile ein Sondereinsatz für den Stundenbereich. Unterricht der beteiligten Lehrkräfte wird zur offenen Vertretung oder entfällt nach den Regeln je Stunde; Unterricht der beteiligten Klassen entfällt. Eine neue Zeile entsteht automatisch, sobald die letzte ausgefüllt wird.</p>
      <div className={s.rollen}>
        <table className={s.tab}>
          <thead><tr>{['Datum', 'Von Std.', 'Bis Std.', 'Lehrkräfte', 'Klassen', 'Fach', 'Raum', 'Schülergruppe', 'Text', ''].map((t) => <th key={t} className={s.th}>{t}</th>)}</tr></thead>
          <tbody>
            {zeilen.map((z, i) => (
              <tr key={z.k}>
                <td className={s.td}>{feld(i, 'datum', 100)}</td><td className={s.td}>{feld(i, 'sv', 52)}</td><td className={s.td}>{feld(i, 'sb', 52)}</td>
                <td className={s.td}>{feld(i, 'lehrer', 120)}</td><td className={s.td}>{feld(i, 'klassen', 110)}</td><td className={s.td}>{feld(i, 'fach', 70)}</td>
                <td className={s.td}>{feld(i, 'raum', 70)}</td><td className={s.td}>{feld(i, 'gruppe', 100)}</td><td className={s.td}>{feld(i, 'text', 180)}</td>
                <td className={s.td}><Button size="small" appearance="subtle" icon={<Delete20Regular />} aria-label="Zeile entfernen" title="Zeile entfernen"
                  onClick={() => setZeilen((l) => (l.length > 1 ? l.filter((x) => x.k !== z.k) : [leer()]))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </StandardDialog>
  );
}

export async function sondereinsatzDialog({ datum, stunde, klassen = '', lehrer = '' }: { datum?: string; stunde?: number; klassen?: string; lehrer?: string } = {}) {
  const d0 = datum || planungsdatum() || '';
  const z = await dialogZeigen<SeZeile[]>((zu) => <Sondereinsatz d0={d0} st={stunde || 1} klassen={klassen} lehrer={lehrer} schliessen={zu} />);
  if (!z) return null;
  const zeilen = z.filter((x) => x.lehrer.trim() || x.klassen.trim()).map((x) => ({
    datum: datumLesen(x.datum, d0), sv: Number(x.sv) || 1, sb: Number(x.sb) || Number(x.sv) || 1, lehrer: x.lehrer.trim(), klassen: x.klassen.trim(),
    fach: x.fach.trim(), raum: x.raum.trim(), gruppe: x.gruppe.trim(), text: x.text.trim(),
  }));
  if (!zeilen.length) return null;
  const r = await api.post<{ anzahl: number }>(vpfad('/sondereinsaetze'), { zeilen });
  hinweis(`${r.anzahl} Sondereinsatz-Stunde(n) angelegt – Strg+Z macht es rückgängig.`, 'ok');
  return r;
}

// ---------------------------------------------------------------------------------------------
// Vertretungsautomatik

interface AutomatikInfo { methoden: { wert: string; text: string }[]; offen: { vertretungen: number; raumvertretungen: number; pausenaufsichten: number } }

function Automatik({ von0, bis0, info, schliessen }: { von0: string; bis0: string; info: AutomatikInfo; schliessen: (w: { von: string; bis: string; methode: string } | null) => void }) {
  const s = useStile();
  const [von, setVon] = useState(von0);
  const [bis, setBis] = useState(bis0);
  const [methode, setMethode] = useState(info.methoden[0]?.wert || '');
  const [offen, setOffen] = useState(info.offen);
  useEffect(() => { if (von) api.get<AutomatikInfo>(vpfad(`/automatik?von=${von}&bis=${bis || von}`)).then((x) => setOffen(x.offen)).catch(() => {}); }, [von, bis]);
  return (
    <StandardDialog<boolean> titel="Automatische Vertretung" breite="540px" knoepfe={[{ text: 'Starten', wert: true, primaer: true }, { text: 'Abbrechen', wert: null }]}
      beiKnopf={(w) => schliessen(w ? { von, bis: bis || von, methode } : null)}>
      <div className={s.formular}>
        <span>Von</span><Input type="date" value={von} onChange={(_, x) => setVon(x.value)} />
        <span>Bis</span><Input type="date" value={bis} onChange={(_, x) => setBis(x.value)} />
        <span>Verfahren</span><Select value={methode} onChange={(_, x) => setMethode(x.value)}>{info.methoden.map((m) => <option key={m.wert} value={m.wert}>{m.text}</option>)}</Select>
        <span>Offen im Zeitraum</span>
        <div className={s.offen}>
          <span><span className={s.offenZahl}>{offen.vertretungen}</span><Text size={200}>Vertretungen</Text></span>
          <span><span className={s.offenZahl}>{offen.raumvertretungen}</span><Text size={200}>Raumvertretungen</Text></span>
          <span><span className={s.offenZahl}>{offen.pausenaufsichten}</span><Text size={200}>Pausenaufsichten</Text></span>
        </div>
        <p className={mergeClasses(s.leise, s.voll)}>Die offenen Vertretungen des Zeitraums werden nacheinander besetzt: mit der am besten geeigneten Lehrkraft laut Vorschlag, sonst – wenn sinnvoll – als Entfall. Strg+Z nimmt alles zurück.</p>
      </div>
    </StandardDialog>
  );
}

export async function automatikDialog(von?: string | null, bis?: string | null) {
  const v = von || planungsdatum() || '';
  const b = bis || v;
  const info = await api.get<AutomatikInfo>(vpfad(`/automatik?von=${v}&bis=${b}`));
  const w = await dialogZeigen<{ von: string; bis: string; methode: string }>((zu) => <Automatik von0={v} bis0={b} info={info} schliessen={zu} />);
  if (!w) return;
  const r = await api.post<{ bearbeitet: number; offen: number }>(vpfad('/automatik'), w);
  await meldung(`${r.bearbeitet} Vertretung(en) bearbeitet, ${r.offen} noch offen.`, 'Automatische Vertretung');
}

// ---------------------------------------------------------------------------------------------
// Einstellungen der Vertretungsplanung

const REGEL = ['Vertreten', 'Entfall', 'Eigenverantwortlich'] as const;
const REGEL_TEXT: Record<string, string> = { Vertreten: '', Entfall: 'Entfall', Eigenverantwortlich: 'EVA' };
type Obj = Record<string, any>;
interface EinstellungenDaten { einstellungen: Obj; klassen: { id: number; kurz: string; zeitraster: Record<string, string> }[]; tage: string[]; stunden: number; evaRaum: string; arten: { art: string; text: string; standard: string; farbe: string | null }[] }

function Einstellungen({ ein, seite, schliessen }: { ein: EinstellungenDaten; seite: number; schliessen: (w: { e: Obj; klassen: EinstellungenDaten['klassen']; eva: string; arten: { art: string; text: string; farbe: string; ohne: boolean }[] } | null) => void }) {
  const s = useStile();
  const schreiben = darfSchreiben();
  const [reiter, setReiter] = useState(seite);
  const [e, setE] = useState<Obj>(() => structuredClone(ein.einstellungen));
  const [klassen, setKlassen] = useState(() => structuredClone(ein.klassen));
  const [klasse, setKlasse] = useState('');
  const [eva, setEva] = useState(ein.evaRaum || '');
  const [arten, setArten] = useState(() => ein.arten.map((a) => ({ art: a.art, text: a.text, standard: a.standard, farbe: a.farbe || '#ffffff', ohne: !a.farbe })));
  const setzen = (pfad: string[], wert: unknown) => setE((x) => { const n = structuredClone(x); let o = n; for (const k of pfad.slice(0, -1)) o = o[k]; o[pfad[pfad.length - 1]!] = wert; return n; });
  const raster: Record<string, string> = klasse ? (klassen.find((k) => String(k.id) === klasse)?.zeitraster || {}) : (e.zeitraster || {});
  const regelSetzen = (key: string) => {
    if (!schreiben) return;
    const neu = REGEL[(REGEL.indexOf((raster[key] || 'Vertreten') as typeof REGEL[number]) + 1) % 3]!;
    const n = { ...raster };
    if (neu === 'Vertreten') delete n[key]; else n[key] = neu;
    if (klasse) setKlassen((l) => l.map((k) => (String(k.id) === klasse ? { ...k, zeitraster: n } : k)));
    else setE((x) => ({ ...x, zeitraster: n }));
  };
  const cb = (obj: string, k: string, text: string) => <Switch className={s.voll} label={text} disabled={!schreiben} checked={!!e[obj]?.[k]} onChange={(_, d) => setzen([obj, k], d.checked)} />;
  const cbE = (k: string, text: string) => <Switch className={s.voll} label={text} disabled={!schreiben} checked={!!e[k]} onChange={(_, d) => setzen([k], d.checked)} />;
  const sel = (obj: string, k: string, opt: [string, string][]) => <Select disabled={!schreiben} value={String(e[obj]?.[k] ?? '')} onChange={(_, d) => setzen([obj, k], d.value)}>{opt.map(([w, t]) => <option key={w} value={w}>{t}</option>)}</Select>;
  const txt = (obj: string, k: string) => <Input disabled={!schreiben} value={String(e[obj]?.[k] ?? '')} onChange={(_, d) => setzen([obj, k], d.value)} />;
  const zahl = (obj: string, k: string, max = 99) => <Input className={s.zahl} type="number" min={0} max={max} disabled={!schreiben} value={String(e[obj]?.[k] ?? 0)} onChange={(_, d) => setzen([obj, k], Math.max(0, Math.min(max, Number(d.value) || 0)))} />;
  const ab = (t: string) => <h3 className={s.abschnitt}>{t}</h3>;
  const titel = ['Regeln je Stunde', 'Vertretungszähler', 'Vertretungsvorschlag', 'Allgemein', 'Arten und Farben'];
  return (
    <StandardDialog<boolean> titel="Einstellungen der Vertretungsplanung" breite="800px"
      knoepfe={schreiben ? [{ text: 'Speichern', wert: true, primaer: true }, { text: 'Abbrechen', wert: null }] : [{ text: 'Schließen', wert: null }]}
      beiKnopf={(w) => schliessen(w ? { e, klassen, eva, arten } : null)}>
      <TabList size="small" selectedValue={String(reiter)} onTabSelect={(_, d) => setReiter(Number(d.value))}>{titel.map((t, i) => <Tab key={t} value={String(i)}>{t}</Tab>)}</TabList>
      <div className={s.seite}>
        {reiter === 0 ? <>
          <p className={s.leise}>Was geschieht, wenn die Lehrkraft einer Stunde abwesend ist. Ein Klick auf ein Feld wechselt die Regel. Regeln einer Klasse haben Vorrang vor denen der ganzen Schule.</p>
          <Field label="Gilt für" orientation="horizontal">
            <Select value={klasse} onChange={(_, d) => setKlasse(d.value)}><option value="">Ganze Schule</option>{klassen.map((k) => <option key={k.id} value={k.id}>{`Klasse ${k.kurz}`}</option>)}</Select>
          </Field>
          <table className={s.raster}>
            <thead><tr><th className={s.rk}>Std.</th>{ein.tage.map((t) => <th key={t} className={s.rk}>{t}</th>)}</tr></thead>
            <tbody>
              {Array.from({ length: ein.stunden }, (_, i) => i + 1).map((st) => (
                <tr key={st}><th className={s.rk}>{st}</th>{ein.tage.map((_, t) => {
                  const key = String(t * 100 + st);
                  const r = raster[key] || 'Vertreten';
                  return <td key={t} className={mergeClasses(s.rz, s[r as 'Vertreten'])} onClick={() => regelSetzen(key)}>{REGEL_TEXT[r]}</td>;
                })}</tr>
              ))}
            </tbody>
          </table>
          <div className={s.legende}>
            <span><i className={mergeClasses(s.punkt, s.Vertreten)} />Vertreten</span><span><i className={mergeClasses(s.punkt, s.Entfall)} />Unterricht entfällt</span>
            <span><i className={mergeClasses(s.punkt, s.Eigenverantwortlich)} />Eigenverantwortliches Arbeiten (EVA)</span>
          </div>
        </> : null}
        {reiter === 1 ? (
          <div className={s.formular}>
            {ab('Was zählt')}
            {cb('zaehler', 'vertretungenZaehlen', 'Vertretungen zählen als Plusstunde')}{cb('zaehler', 'sondereinsaetzeZaehlen', 'Sondereinsätze zählen als Plusstunde')}
            {cb('zaehler', 'entfaelleZaehlen', 'Entfälle zählen als Minusstunde')}{cb('zaehler', 'freisetzungenZaehlen', 'Freistellungen zählen als Minusstunde')}
            {cb('zaehler', 'pausenaufsichtenZaehlen', 'Vertretene Pausenaufsichten zählen')}{cb('zaehler', 'betreuungenHalb', 'Betreuungen zählen halb')}
            {cb('zaehler', 'entfallNurMitGrund', 'Entfälle nur zählen, wenn beim Abwesenheitsgrund „Entfall zählen“ gesetzt ist')}
            {cb('zaehler', 'stattVertretungNeutral', 'Vertretungen statt eigenem Unterricht zählen nicht')}{cb('zaehler', 'klausurenNeutral', 'Klausuraufsichten zählen nicht')}
            {ab('Berechnung')}
            <span>Durchrechnungszeitraum</span>{sel('zaehler', 'zeitraum', [['Woche', 'Woche'], ['Monat', 'Monat'], ['Halbjahr', 'Halbjahr'], ['Schuljahr', 'Schuljahr'], ['Benutzerdefiniert', 'Benutzerdefiniert']])}
            <span>Gezählt wird</span>{sel('zaehler', 'wieZaehlen', [['Anzahl', 'Anzahl der Stunden'], ['Werte', 'Wert (Faktor des Unterrichts)']])}
            <span>Kennzeichen „nicht zählen“</span>{txt('zaehler', 'nichtZaehlenKennzeichen')}
            <span>Kennzeichen „bezahlt“</span>{txt('zaehler', 'bezahltKennzeichen')}
          </div>
        ) : null}
        {reiter === 2 ? (
          <div className={s.formular}>
            {ab('Pluspunkte')}<p className={mergeClasses(s.leise, s.voll)}>Je höher der Wert, desto eher wird die Lehrkraft vorgeschlagen.</p>
            <span>Freigestellt (eigene Klasse abwesend)</span>{zahl('vorschlag', 'freisetzung')}<span>Bereitschaft</span>{zahl('vorschlag', 'bereitschaft')}
            <span>Unterrichtet die Klasse</span>{zahl('vorschlag', 'hatKlasse')}<span>Unterrichtet das Fach</span>{zahl('vorschlag', 'hatFach')}
            {ab('Abzüge (Faktoren)')}
            <span>Je Unterrichtsstunde am Tag</span>{zahl('vorschlag', 'unterrichtsstundenAmTag')}<span>Je Belastungsstufe</span>{zahl('vorschlag', 'merkerFaktor')}
            <span>Je Stufe Zeitwunsch-Sperre</span>{zahl('vorschlag', 'sperreFaktor')}<span>Je Punkt im Vertretungszähler</span>{zahl('vorschlag', 'zaehlerFaktor')}
            {ab('Anzeige')}
            <span>Hervorheben ab Belastung über</span>{zahl('vorschlag', 'rotWennMerkerGroesser', 9)}<span>Ausblenden ab Belastung über</span>{zahl('vorschlag', 'nichtAnzeigenWennMerkerGroesser', 9)}
            <span>Hervorheben ab Zähler über</span>{zahl('vorschlag', 'rotWennZaehlerGroesser')}
            {cb('vorschlag', 'gesperrteNichtAnzeigen', 'Gesperrte Lehrkräfte (Zeitwunsch −3) ausblenden')}{cb('vorschlag', 'klasseAuchFuerKlassenteil', 'Klasse auch bei Klassenteilen berücksichtigen')}{cb('vorschlag', 'langname', 'Langnamen anzeigen')}
            {ab('Vorziehungen')}
            <span>Vorziehen</span>{sel('vorschlag', 'vorziehungen', [['GemaessVertretungszeitraster', 'Nach den Regeln je Stunde'], ['AusRandstunden', 'Nur aus Randstunden'], ['AlleVerlegungen', 'Alle Verlegungen']])}
            {cb('vorschlag', 'raumgewicht4Beachten', 'Höchstes Raumgewicht beachten')}{cb('vorschlag', 'nurSpaeterenUnterricht', 'Nur aus späterem Unterricht')}{cb('vorschlag', 'nurDieselbeWoche', 'Nur aus derselben Woche')}
          </div>
        ) : null}
        {reiter === 3 ? (
          <div className={s.formular}>
            {ab('Räume')}
            <span>Raum für EVA</span><Input disabled={!schreiben} value={eva} placeholder="Raum (Kurzname)" onChange={(_, d) => setEva(d.value)} />
            {cbE('lehrerRaumPrinzip', 'Raum der vertretenden Lehrkraft verwenden (Lehrkraft-Raum-Prinzip)')}
            {ab('Abläufe')}
            {cbE('freisetzungPausenaufsicht', 'Freistellungen erzeugen Vertretungen der Pausenaufsicht')}
            {cbE('mitAktuellemDatumStarten', 'Vertretungsplanung mit dem heutigen Datum beginnen')}
          </div>
        ) : null}
        {reiter === 4 ? <>
          <p className={s.leise}>Eigene Bezeichnung und Farbe je Vertretungsart. Ohne Bezeichnung gilt der Standardname.</p>
          <div className={s.rollen}>
            <table className={s.tab}>
              <thead><tr><th className={s.th}>Vertretungsart</th><th className={s.th}>Bezeichnung</th><th className={s.th}>Farbe</th></tr></thead>
              <tbody>
                {arten.map((x, i) => (
                  <tr key={x.art}>
                    <td className={s.td}>{x.standard}</td>
                    <td className={s.td}><Input size="small" disabled={!schreiben} value={x.text} placeholder={x.standard} onChange={(_, d) => setArten((l) => l.map((y, j) => (j === i ? { ...y, text: d.value } : y)))} /></td>
                    <td className={s.td}>
                      <span style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
                        <input type="color" value={x.farbe} disabled={x.ohne || !schreiben} onChange={(ev) => { const v = ev.target.value; setArten((l) => l.map((y, j) => (j === i ? { ...y, farbe: v } : y))); }} />
                        <Switch label="Ohne" checked={x.ohne} disabled={!schreiben} onChange={(_, d) => setArten((l) => l.map((y, j) => (j === i ? { ...y, ohne: d.checked } : y)))} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </> : null}
      </div>
    </StandardDialog>
  );
}

export async function einstellungenDialog(seite = 0): Promise<boolean> {
  const ein = await api.get<EinstellungenDaten>(vpfad('/einstellungen'));
  const w = await dialogZeigen<{ e: Obj; klassen: EinstellungenDaten['klassen']; eva: string; arten: { art: string; text: string; farbe: string; ohne: boolean }[] }>((zu) => <Einstellungen ein={ein} seite={seite} schliessen={zu} />);
  if (!w) return false;
  const e = { ...w.e };
  e.bezeichnungen = Object.fromEntries(w.arten.filter((x) => x.text.trim()).map((x) => [x.art, x.text.trim()]));
  e.farben = Object.fromEntries(w.arten.filter((x) => !x.ohne).map((x) => [x.art, (0xff000000 | parseInt(x.farbe.slice(1), 16)) >> 0]));
  await api.put(vpfad('/einstellungen'), { einstellungen: e, evaRaum: w.eva.trim(), klassen: w.klassen.map((k) => ({ id: k.id, zeitraster: k.zeitraster })) });
  hinweis('Einstellungen der Vertretungsplanung gespeichert.', 'ok');
  return true;
}
