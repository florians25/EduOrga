// Deputat und Unterrichtsverteilung. Drei Reiter:
//  Lehrkräfte  – Deputatsrechnung je Lehrkraft (Pflichtstunden × Umfang − Ermäßigungen − Anrechnungen + Mehrarbeit = Soll; Ist
//                aus der Wertrechnung), rechts Hinweise (über/unter Soll, fehlende Lehrbefähigung, Topf überzogen).
//  Verteilung  – Matrix Lehrkräfte × Klassen bzw. Fächer; rechts offene Unterrichte mit Vorschlägen, Zuweisen per Klick.
//  Stundentafel – Abweichungen Stundentafel/Unterricht je Klasse und Kontingentprüfung (Gymnasium G9).
// Kennzahlen stehen als eine Textzeile über dem Inhalt (DESIGN.md §9: keine Kacheln, Statusfarben nur als Text).
import { Button, Input, Select, Tab, TabList, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { useEffect, useMemo, useState } from 'react';
import { api, dateiHerunterladen } from '@/api/client';
import { useAnsicht, type AnsichtProps } from '@/kern/ansichten';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, Feld, Segmente } from '@/komponenten/ansicht';
import { dialogZeigen, formular, StandardDialog } from '@/komponenten/dialoge';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { MenueKnopf } from '@/komponenten/menue';
import { SuchAuswahl } from '@/komponenten/suchauswahl';
import { Tabelle, type Spalte } from '@/komponenten/tabelle/Tabelle';
import './deputat.css';

// ------------------------------------------------------------------------------------------ Typen

interface Posten { art: string; grund: string; stunden: number; automatisch: boolean }
interface Eintrag { art: string; grund: string; wert: number; text: string }
interface DLehrer {
  id: number; kurz: string; name: string; pflichtstunden: number; abweichend: number | null; umfang: number; anteil: number; umfangText: string;
  alter: number | null; geburtsdatum: string | null; geburtsjahr: number | null; gdb: number; ohneAlter: boolean;
  altersermaessigung: number; schwerbehinderung: number; sonstige: number; anrechnung: number; leitung: number; mehrarbeit: number;
  soll: number; ist: number; differenz: number; status: '' | 'ueber' | 'unter'; posten: Posten[]; eintraege: Eintrag[]; hinweise: string[]; faecher: string;
}
interface Summen {
  pflichtstunden: number; stellen: number; grundstellen: number; grundstellenGeschaetzt: boolean; umfang: number; soll: number; ist: number;
  unterrichtsbedarf: number; offen: number; ermaessigungen: number; mehrarbeit: number; stellenbedarf: number;
  anrechnungVerfuegbar: number; anrechnungVerwendet: number; leitungVerfuegbar: number; leitungVerwendet: number; ueber: number; unter: number;
}
interface Uebersicht {
  profil: { kuerzel: string; name: string; rechtsgrundlage: string; landesregeln: boolean };
  profile: { wert: string; text: string }[];
  einstellungen: { bundesland: string; grundstellen: number; grundstellenSekII: number; offenerGanztag: boolean; anrechnungstopf: string; leitungszeit: string; automatischeErmaessigungen: boolean; toleranz: number };
  schulform: string; schulformName: string; pflichtstunden: number; schuljahresbeginn: string;
  lehrer: DLehrer[]; summen: Summen; warnungen: { art: string; lehrer: number | null; text: string }[];
}
interface Verteilung {
  nach: 'klasse' | 'fach';
  spalten: { id: number; kurz: string }[];
  zeilen: { id: number; kurz: string; name: string; soll: number; ist: number; differenz: number; status: string; faecherIds: number[]; werte: number[]; ohneFakultas: boolean[] }[];
  summen: number[];
  offen: { unterricht: number; zeile: number; fachId: number; fach: string; klassen: string; klassenIds: number[]; wst: number; wert: number; kurs: string; gekoppelt: string }[];
  faecher: { id: number; kurz: string; name: string }[];
}
interface Kandidat { id: number; kurz: string; name: string; frei: number; fakultas: boolean; klassenlehrer: boolean; kenntKlasse: boolean; reicht: boolean }
interface Zellzeile { unterricht: number; zeile: number; fach: string; klassen: string; wst: number; wert: number; kurs: string }
interface Tafel {
  jahrgaenge: string[];
  abgleich: { klasse: string; jahrgang: string; fach: string; soll: number; ist: number; differenz: number }[];
  kontingentpruefung: boolean; kontingentGrundlage: string;
  kontingente: { lernbereich: string; stufe: string; soll: number; ist: number; differenz: number }[];
  summe: number; summeOk: boolean;
}

// ------------------------------------------------------------------------------------------ Hilfen

const zahl = (x: number | null | undefined, stellen = 2) => (x == null || Number.isNaN(x) ? '' : x.toLocaleString('de-DE', { maximumFractionDigits: stellen }));
const leer0 = (x: number) => (x ? zahl(x) : '');
const vz = (x: number) => (x > 0 ? `+${zahl(x)}` : zahl(x));
const statusKlasse = (s: string) => (s === 'ueber' ? 'dep-ueber' : s === 'unter' ? 'dep-unter' : undefined);
const datumText = (iso: string | null) => (iso ? iso.split('-').reverse().join('.') : '');

const useStile = makeStyles({
  flaeche: { display: 'flex', flex: 1, minHeight: 0 },
  links: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  rechts: { width: '360px', flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0, borderLeft: `1px solid ${tokens.colorNeutralStroke2}` },
  titel: { padding: '8px 12px', fontWeight: tokens.fontWeightSemibold, borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, display: 'flex', gap: '8px', alignItems: 'baseline' },
  zweit: { color: tokens.colorNeutralForeground3, fontWeight: tokens.fontWeightRegular, fontSize: tokens.fontSizeBase200 },
  rollen: { overflowY: 'auto', flex: 1, minHeight: 0 },
  tipp: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 },
});

// ------------------------------------------------------------------------------------------ Kennzahlen

function Kennzahlen({ u }: { u?: Uebersicht }) {
  if (!u) return null;
  const s = u.summen;
  const topf = s.anrechnungVerwendet > s.anrechnungVerfuegbar && s.anrechnungVerfuegbar > 0;
  const leit = s.leitungVerwendet > s.leitungVerfuegbar && s.leitungVerfuegbar > 0;
  const bilanz = s.stellen - s.stellenbedarf;
  return (
    <div className="dep-kennzahlen" data-testid="deputat-kennzahlen">
      <span><b>{u.profil.name}</b> · {u.schulformName} · {zahl(u.pflichtstunden)} Pflichtstunden</span>
      <span title="Stellen = Summe der Beschäftigungsumfänge / Pflichtstunden; Bedarf = (Unterricht + Ermäßigungen + Anrechnungen + Leitungszeit − Mehrarbeit) / Pflichtstunden">Stellen <b>{zahl(s.stellen)}</b> · Bedarf <b>{zahl(s.stellenbedarf)}</b> · Bilanz <b className={bilanz < -0.05 ? 'dep-ueber' : undefined}>{vz(Math.round(bilanz * 100) / 100)}</b></span>
      <span>Soll <b>{zahl(s.soll)}</b> · Ist <b>{zahl(s.ist)}</b> · offen <b className={s.offen > 0 ? 'dep-unter' : undefined}>{zahl(s.offen)}</b></span>
      <span>Anrechnungstopf <b className={topf ? 'dep-ueber' : undefined}>{zahl(s.anrechnungVerwendet)}</b> von {zahl(s.anrechnungVerfuegbar)}</span>
      <span>Leitungszeit <b className={leit ? 'dep-ueber' : undefined}>{zahl(s.leitungVerwendet)}</b> von {zahl(s.leitungVerfuegbar)}</span>
      <span>{s.ueber ? <span className="dep-ueber">{s.ueber} über Soll</span> : '0 über Soll'} · {s.unter ? <span className="dep-unter">{s.unter} unter Soll</span> : '0 unter Soll'}</span>
      {s.grundstellenGeschaetzt ? <span className="dep-zweit">Grundstellen geschätzt ({zahl(s.grundstellen)}) – in den Einstellungen eintragen</span> : null}
    </div>
  );
}

// ------------------------------------------------------------------------------------------ Lehrkräfte

function postenDialog(l: DLehrer, quelle: string): Promise<unknown> {
  return dialogZeigen<boolean>((schliessen) => <PostenDialog l={l} quelle={quelle} schliessen={schliessen} />);
}

function PostenDialog({ l, quelle, schliessen }: { l: DLehrer; quelle: string; schliessen: (w: boolean | null) => void }) {
  const [liste, setListe] = useState<Eintrag[]>(() => l.eintraege.map((e) => ({ ...e })));
  const auto = l.posten.filter((p) => p.automatisch);
  const setzen = (i: number, t: Partial<Eintrag>) => setListe((x) => x.map((e, j) => (j === i ? { ...e, ...t } : e)));
  return (
    <StandardDialog<boolean> titel={`Ermäßigungen und Anrechnungen – ${l.kurz}`} breite="640px"
      knoepfe={[{ text: 'Übernehmen', wert: true, primaer: true }, { text: 'Abbrechen', wert: null }]}
      links={<Button onClick={() => setListe((x) => [...x, { art: 'Anrechnung', grund: '', wert: 1, text: '' }])}>Eintrag hinzufügen</Button>}
      beiKnopf={async (w) => {
        if (!w) { schliessen(null); return; }
        try {
          await api.put(api.dok(`/deputat/lehrer/${l.id}/posten`), liste.map((e) => ({ art: e.art, grund: e.grund, wert: Number(String(e.wert).replace(',', '.')) || 0, text: e.text })), { quelle });
          schliessen(true);
        } catch (e) { fehlerMelden(e); }
      }}>
      <div className="dep-posten">
        {auto.length ? <div className="dep-posten-auto">
          <div className="dep-zweit">Berechnet (Landesprofil)</div>
          {auto.map((p) => <div key={p.grund}>{p.grund}: {zahl(p.stunden)} Std.</div>)}
        </div> : null}
        <div className="dep-posten-kopf"><span>Art</span><span>Grund</span><span>Stunden</span><span /></div>
        {liste.map((e, i) => (
          <div className="dep-posten-zeile" key={i}>
            <Select aria-label="Art" value={e.art === 'Ermaessigung' ? 'Ermaessigung' : e.art} onChange={(_, d) => setzen(i, { art: d.value })}>
              <option value="Ermaessigung">Ermäßigung</option>
              <option value="Anrechnung">Anrechnung (Topf)</option>
              <option value="Leitung">Leitungszeit</option>
            </Select>
            <Input aria-label="Grund" value={e.grund} placeholder="z. B. Oberstufenkoordination" onChange={(_, d) => setzen(i, { grund: d.value })} />
            <Input aria-label="Stunden" value={String(e.wert).replace('.', ',')} onChange={(_, d) => setzen(i, { wert: d.value as unknown as number })} />
            <Button appearance="subtle" onClick={() => setListe((x) => x.filter((_, j) => j !== i))}>Entfernen</Button>
          </div>
        ))}
        {liste.length === 0 ? <div className="dep-zweit">Keine Einträge.</div> : null}
        <div className="dep-zweit">Anrechnungen zählen gegen den Anrechnungstopf, Leitungszeit gegen die Leitungszeit der Schule.
          Ein Eintrag mit „Alter“ bzw. „Schwerbehinderung“ im Grund ersetzt die Berechnung.</div>
      </div>
    </StandardDialog>
  );
}

function Lehrkraefte({ u, quelle, neuLaden }: { u?: Uebersicht; quelle: string; neuLaden: () => void }) {
  const s = useStile();
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const [aktiv, setAktiv] = useState<number | null>(null);
  const spalten = useMemo<Spalte<DLehrer>[]>(() => {
    const ed = (schluessel: string, titel: string, breite: number, wert: (z: DLehrer) => unknown, art: Spalte<DLehrer>['art'] = 'Text', hinweisText?: string): Spalte<DLehrer> =>
      ({ schluessel, titel, breite, art: schreiben ? art : 'NurLesen', editierbar: schreiben, wert, ausrichtung: art === 'Datum' ? undefined : 'rechts', hinweis: hinweisText });
    const nl = (schluessel: string, titel: string, breite: number, wert: (z: DLehrer) => unknown, klasse?: (z: DLehrer) => string | undefined): Spalte<DLehrer> =>
      ({ schluessel, titel, breite, art: 'NurLesen', wert, ausrichtung: 'rechts', klasse });
    return [
      { schluessel: 'kurz', titel: 'Kürzel', breite: 64, art: 'NurLesen', wert: (z) => z.kurz },
      { schluessel: 'name', titel: 'Name', breite: 150, art: 'NurLesen', wert: (z) => z.name },
      ed('pflichtstunden', 'Pflichtstd.', 76, (z) => zahl(z.pflichtstunden), 'Text', 'Vollzeit-Pflichtstunden; Eingabe überschreibt die Schulform (leer = Schulform)'),
      ed('umfang', 'Umfang', 70, (z) => zahl(z.umfang), 'Text', 'Unterrichtsverpflichtung je Woche: Stunden, „Vollzeit“ oder Prozent (z. B. 75 %)'),
      nl('anteil', 'Anteil', 76, (z) => z.umfangText),
      ed('geburtsdatum', 'Geburtsdatum', 108, (z) => datumText(z.geburtsdatum) || (z.geburtsjahr ? `(${z.geburtsjahr})` : ''), 'Datum'),
      ed('alter', 'Alter', 50, (z) => z.alter ?? '', 'Text', 'Alter am Schuljahresbeginn; ohne Geburtsdatum wird daraus das Geburtsjahr'),
      ed('gdb', 'GdB', 46, (z) => (z.gdb ? z.gdb : ''), 'Text', 'Grad der Behinderung (ab 50 Ermäßigung)'),
      nl('altersermaessigung', 'Alter-Erm.', 70, (z) => leer0(z.altersermaessigung)),
      nl('schwerbehinderung', 'SB-Erm.', 62, (z) => leer0(z.schwerbehinderung)),
      nl('sonstige', 'sonst. Erm.', 72, (z) => leer0(z.sonstige)),
      nl('anrechnung', 'Anrechnung', 76, (z) => leer0(z.anrechnung)),
      nl('leitung', 'Leitung', 58, (z) => leer0(z.leitung)),
      ed('mehrarbeit', 'Mehrarbeit', 74, (z) => leer0(z.mehrarbeit), 'Text', 'Regelmäßige Mehrarbeit/Vorgriffsstunden je Woche (+), Ausgleich (−)'),
      nl('soll', 'Soll', 56, (z) => zahl(z.soll)),
      nl('ist', 'Ist', 56, (z) => zahl(z.ist)),
      nl('differenz', 'Differenz', 70, (z) => vz(z.differenz), (z) => statusKlasse(z.status)),
      { schluessel: 'faecher', titel: 'Lehrbefähigung', breite: 130, art: 'NurLesen', wert: (z) => z.faecher },
    ];
  }, [schreiben]);
  const lehrer = u?.lehrer || [];
  const gewaehlt = lehrer.find((l) => l.id === aktiv) || null;
  const warnungen = (u?.warnungen || []).filter((w) => !gewaehlt || w.lehrer === gewaehlt.id || w.lehrer == null);
  return (
    <div className={s.flaeche}>
      <div className={s.links}>
        <Tabelle<DLehrer> name="deputat" spalten={spalten} zeilen={lehrer} zustandSchluessel="tabelle.deputat.lehrer"
          leerText="Keine Lehrkräfte."
          beiAuswahl={(_, z) => setAktiv(z?.id ?? null)}
          beiDoppelklick={(z) => { if (schreiben) void postenDialog(z, quelle).then((w) => { if (w) neuLaden(); }); else a.oeffnen('stundenplan', { typ: 'lehrer', element: z.id }); }}
          kontextmenue={(z) => [
            schreiben && z[0] ? { text: 'Ermäßigungen und Anrechnungen …', aktion: () => postenDialog(z[0], quelle).then((w) => { if (w) neuLaden(); }) } : null,
            schreiben && z[0] ? { text: z[0].ohneAlter ? 'Altersermäßigung wieder berechnen' : 'Ohne Altersermäßigung (Verzicht, Altersteilzeit)', aktion: () => api.patch(api.dok(`/deputat/lehrer/${z[0].id}`), { feld: 'ohnealter', wert: String(!z[0].ohneAlter) }).then(neuLaden) } : null,
            z[0] ? { text: 'Stundenplan der Lehrkraft', aktion: () => a.oeffnen('stundenplan', { typ: 'lehrer', element: z[0].id }) } : null,
          ]}
          aendern={schreiben ? async (z, sp, wert) => { await api.patch(api.dok(`/deputat/lehrer/${z.id}`), { feld: sp.schluessel, wert }, { quelle }); neuLaden(); } : undefined} />
      </div>
      <div className={s.rechts}>
        <div className={s.titel}>{gewaehlt ? `Rechnung ${gewaehlt.kurz}` : 'Hinweise'}<span className={s.zweit}>{gewaehlt ? gewaehlt.name : `${warnungen.length}`}</span></div>
        <div className={s.rollen}>
          {gewaehlt ? <Rechnung l={gewaehlt} schreiben={schreiben} bearbeiten={() => postenDialog(gewaehlt, quelle).then((w) => { if (w) neuLaden(); })} /> : null}
          {gewaehlt && warnungen.length ? <div className="dep-abschnitt">Hinweise</div> : null}
          <ul className="dep-hinweise" data-testid="deputat-hinweise">
            {warnungen.map((w, i) => <li key={i} className={w.art === 'ueber' || w.art === 'fakultas' || w.art === 'topf' ? 'dep-ueber' : w.art === 'unter' ? 'dep-unter' : undefined}>{w.text}</li>)}
            {warnungen.length === 0 ? <li className="dep-zweit">Keine Hinweise.</li> : null}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Rechnung({ l, schreiben, bearbeiten }: { l: DLehrer; schreiben: boolean; bearbeiten: () => unknown }) {
  const zeile = (text: string, wert: string, klasse?: string) => <div className={mergeClasses('dep-rechnung-zeile', klasse)}><span>{text}</span><span>{wert}</span></div>;
  return (
    <div className="dep-rechnung" data-testid="deputat-rechnung">
      {zeile(`Pflichtstunden${l.abweichend ? ' (abweichend)' : ''}`, zahl(l.pflichtstunden))}
      {zeile(`Umfang (${l.umfangText})`, zahl(l.umfang))}
      {l.posten.map((p, i) => (
        <div key={i} className="dep-rechnung-zeile">
          <span>− {p.grund || (p.art === 'Anrechnung' ? 'Anrechnung' : p.art === 'Leitung' ? 'Leitungszeit' : 'Ermäßigung')}{p.automatisch ? <span className="dep-zweit"> berechnet</span> : null}</span>
          <span>{zahl(p.stunden)}</span>
        </div>
      ))}
      {l.mehrarbeit ? zeile(l.mehrarbeit > 0 ? '+ Mehrarbeit/Vorgriff' : '− Ausgleich', zahl(Math.abs(l.mehrarbeit))) : null}
      {zeile('= Soll', zahl(l.soll), 'dep-rechnung-summe')}
      {zeile('Ist (Wertrechnung)', zahl(l.ist))}
      {zeile('Differenz', vz(l.differenz), statusKlasse(l.status))}
      {schreiben ? <Button size="small" onClick={() => void bearbeiten()} style={{ marginTop: 8 }}>Ermäßigungen und Anrechnungen …</Button> : null}
    </div>
  );
}

// ------------------------------------------------------------------------------------------ Verteilung

function VerteilungAnsicht({ nach, fach, quelle, beiAenderung }: { nach: 'klasse' | 'fach'; fach: number | null; quelle: string; beiAenderung: () => void }) {
  const s = useStile();
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const { daten, neuLaden } = useDaten(() => api.get<Verteilung>(api.dok(`/deputat/verteilung?nach=${nach}${fach ? `&fach=${fach}` : ''}`)), [nach, fach],
    { bereiche: ['Stammdaten', 'Unterricht', 'Einstellungen'], quelle });
  const [offen, setOffen] = useState<{ unterricht: number; zeile: number } | null>(null);
  const [zelle, setZelle] = useState<{ lehrer: number; spalte: number } | null>(null);
  const [kandidaten, setKandidaten] = useState<Kandidat[] | null>(null);
  const [zellzeilen, setZellzeilen] = useState<Zellzeile[] | null>(null);
  const gewaehlt = daten?.offen.find((o) => o.unterricht === offen?.unterricht && o.zeile === offen?.zeile) || null;

  useEffect(() => {
    if (!offen) { setKandidaten(null); return; }
    let ab = false;
    api.get<Kandidat[]>(api.dok(`/deputat/vorschlag?unterricht=${offen.unterricht}&zeile=${offen.zeile}`)).then((k) => { if (!ab) setKandidaten(k); }).catch(fehlerMelden);
    return () => { ab = true; };
  }, [offen, daten]);
  useEffect(() => {
    if (!zelle) { setZellzeilen(null); return; }
    let ab = false;
    api.get<Zellzeile[]>(api.dok(`/deputat/zelle?lehrer=${zelle.lehrer}&spalte=${zelle.spalte}&nach=${nach}`)).then((k) => { if (!ab) setZellzeilen(k); }).catch(fehlerMelden);
    return () => { ab = true; };
  }, [zelle, daten, nach]);

  const zuweisen = async (unterricht: number, zeile: number, lehrer: number | null) => {
    try {
      await api.post(api.dok('/deputat/zuweisen'), { unterricht, zeile, lehrer }, { quelle });
      hinweis(lehrer == null ? 'Lehrkraft entfernt.' : 'Lehrkraft zugewiesen.', 'ok', 2000);
      await neuLaden(true);
      beiAenderung();
    } catch (e) { fehlerMelden(e); }
  };
  const kand = new Map((kandidaten || []).map((k) => [k.id, k]));
  if (!daten) return null;
  return (
    <div className={s.flaeche}>
      <div className={mergeClasses(s.links, 'dep-matrix-rahmen')}>
        <table className="dep-matrix" data-testid="deputat-matrix">
          <thead>
            <tr>
              <th className="dep-fest dep-f1">Lehrkraft</th><th className="dep-fest dep-f2">Soll</th><th className="dep-fest dep-f3">Ist</th><th className="dep-fest dep-f4">Diff.</th>
              {daten.spalten.map((sp) => <th key={sp.id}>{sp.kurz}</th>)}
            </tr>
          </thead>
          <tbody>
            {daten.zeilen.map((z) => {
              const k = kand.get(z.id);
              const ziel = !!gewaehlt && schreiben;
              return (
                <tr key={z.id} className={mergeClasses(ziel && k?.fakultas ? 'dep-kandidat' : undefined, ziel && !k ? 'dep-gesperrt' : undefined)}
                  title={ziel ? (k ? `${z.kurz} zuweisen: frei ${zahl(k.frei)} Std.${k.fakultas ? '' : ' – ohne Lehrbefähigung'}` : `${z.kurz} unterrichtet bereits in diesem Unterricht`) : z.name}>
                  <th className="dep-fest dep-f1" scope="row">
                    {ziel && k ? <button type="button" className="dep-zuweisen" onClick={() => void zuweisen(gewaehlt!.unterricht, gewaehlt!.zeile, z.id)}>{z.kurz}</button> : z.kurz}
                  </th>
                  <td className="dep-fest dep-f2">{zahl(z.soll)}</td>
                  <td className="dep-fest dep-f3">{zahl(z.ist)}</td>
                  <td className={mergeClasses('dep-fest dep-f4', statusKlasse(z.status))}>{vz(z.differenz)}</td>
                  {z.werte.map((w, i) => (
                    <td key={i} className={mergeClasses(z.ohneFakultas[i] ? 'dep-ohne' : undefined, zelle?.lehrer === z.id && zelle.spalte === daten.spalten[i].id ? 'dep-zelle-an' : undefined)}
                      title={z.ohneFakultas[i] ? 'Unterricht ohne eingetragene Lehrbefähigung' : undefined}
                      onClick={w ? () => { setOffen(null); setZelle({ lehrer: z.id, spalte: daten.spalten[i].id }); } : undefined}>
                      {w ? zahl(w, 1) : ''}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr><th className="dep-fest dep-f1">Summe</th><td className="dep-fest dep-f2" /><td className="dep-fest dep-f3" /><td className="dep-fest dep-f4" />{daten.summen.map((x, i) => <td key={i}>{x ? zahl(x, 1) : ''}</td>)}</tr>
          </tfoot>
        </table>
        {daten.zeilen.length === 0 ? <div className="dep-zweit" style={{ padding: 12 }}>Keine Lehrkräfte mit diesem Fach.</div> : null}
      </div>
      <div className={s.rechts}>
        {zelle && zellzeilen ? <>
          <div className={s.titel}>Unterricht {daten.zeilen.find((z) => z.id === zelle.lehrer)?.kurz} · {daten.spalten.find((x) => x.id === zelle.spalte)?.kurz}
            <Button size="small" appearance="subtle" style={{ marginLeft: 'auto' }} onClick={() => setZelle(null)}>Schließen</Button></div>
          <ul className="dep-liste">
            {zellzeilen.map((x) => (
              <li key={`${x.unterricht}-${x.zeile}`}>
                <span>{x.fach} {x.klassen} {x.kurs ? <span className="dep-zweit">{x.kurs}</span> : null}<span className="dep-zweit"> · {x.wst} Wst. · Wert {zahl(x.wert)}</span></span>
                {schreiben ? <Button size="small" appearance="subtle" onClick={() => void zuweisen(x.unterricht, x.zeile, null)}>Entfernen</Button> : null}
              </li>
            ))}
          </ul>
        </> : null}
        <div className={s.titel}>Offene Unterrichte<span className={s.zweit}>{daten.offen.length} · {zahl(daten.offen.reduce((x, o) => x + o.wert, 0))} Std.</span></div>
        <ul className={mergeClasses('dep-liste', s.rollen)} data-testid="deputat-offen">
          {daten.offen.map((o) => {
            const an = gewaehlt === o;
            return (
              <li key={`${o.unterricht}-${o.zeile}`} className={an ? 'dep-an' : undefined}>
                <button type="button" className="dep-offen" aria-pressed={an} onClick={() => { setZelle(null); setOffen(an ? null : { unterricht: o.unterricht, zeile: o.zeile }); }}>
                  <span>{o.klassen || 'ohne Klasse'} · {o.fach}{o.kurs ? ` · ${o.kurs}` : ''}</span>
                  <span className="dep-zweit">{o.wst} Wst.{o.wert !== o.wst ? ` · Wert ${zahl(o.wert)}` : ''}{o.gekoppelt ? ` · gekoppelt mit ${o.gekoppelt}` : ''}</span>
                </button>
                {an && kandidaten ? (
                  <div className="dep-kandidaten">
                    <div className="dep-zweit">Vorschläge (Lehrbefähigung, freies Deputat, Klassenleitung). Klick auf ein Kürzel in der Matrix weist ebenfalls zu.</div>
                    {kandidaten.slice(0, 8).map((k) => (
                      <div key={k.id} className="dep-kandidat-zeile">
                        <span>{k.kurz} <span className="dep-zweit">{k.name}</span></span>
                        <span className={k.frei < o.wert ? 'dep-ueber' : undefined}>frei {zahl(k.frei)}</span>
                        <span className="dep-zweit">{[k.fakultas ? 'Fakultas' : 'ohne Fakultas', k.klassenlehrer ? 'Klassenleitung' : k.kenntKlasse ? 'kennt Klasse' : ''].filter(Boolean).join(' · ')}</span>
                        {schreiben ? <Button size="small" onClick={() => void zuweisen(o.unterricht, o.zeile, k.id)}>Zuweisen</Button> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
          {daten.offen.length === 0 ? <li className="dep-zweit" style={{ padding: '8px 12px' }}>Keine offenen Unterrichte.</li> : null}
        </ul>
        <div className="dep-fusszeile"><Button size="small" appearance="subtle" onClick={() => a.oeffnen('unterricht', { sicht: 'alle' })}>Unterricht bearbeiten</Button></div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------ Stundentafel

function TafelAnsicht() {
  const s = useStile();
  const a = useAnsicht();
  const { daten } = useDaten(() => api.get<Tafel>(api.dok('/deputat/tafel')), [], { bereiche: ['Stammdaten', 'Unterricht', 'Einstellungen'] });
  type A = Tafel['abgleich'][number];
  type K = Tafel['kontingente'][number];
  const sp = (x: [string, string, number, ((z: any) => unknown)?][]) => x.map(([schluessel, titel, breite, wert]) => ({
    schluessel, titel, breite, art: 'NurLesen' as const, wert,
    klasse: schluessel === 'differenz' ? (z: { differenz: number }) => (z.differenz < 0 ? 'dep-ueber' : z.differenz > 0 ? 'dep-unter' : undefined) : undefined,
  }));
  return (
    <div className={s.flaeche}>
      <div className={s.links}>
        <div className={s.titel}>Stundentafel und Unterricht je Klasse<span className={s.zweit}>{daten ? `${daten.abgleich.length} Abweichungen` : ''}</span>
          <Button size="small" appearance="subtle" style={{ marginLeft: 'auto' }} onClick={() => a.oeffnen('abrechnung.wertrechnung', { tab: 'tafel' })}>Stundentafel bearbeiten</Button></div>
        <Tabelle<A> name="deputat-tafel" zeilen={daten?.abgleich || []} id={(z) => `${z.klasse}|${z.fach}`}
          leerText={daten && daten.jahrgaenge.length === 0 ? 'Noch keine Stundentafel eingetragen.' : 'Keine Abweichungen.'}
          spalten={sp([['klasse', 'Klasse', 70], ['jahrgang', 'Jahrgang', 70], ['fach', 'Fach', 70], ['soll', 'Soll', 60, (z: A) => zahl(z.soll)], ['ist', 'Ist', 60, (z: A) => zahl(z.ist)], ['differenz', 'Differenz', 80, (z: A) => vz(z.differenz)]])} />
      </div>
      <div className={s.rechts} style={{ width: 420 }}>
        <div className={s.titel}>Kontingente Sek I</div>
        {daten && !daten.kontingentGrundlage ? <div className="dep-text">Die Kontingentprüfung ist für das Gymnasium (G9) hinterlegt. Für andere Schulformen wird nur die schulinterne Stundentafel mit dem Unterricht verglichen.</div> : null}
        {daten?.kontingentGrundlage ? <div className="dep-text">{daten.kontingentGrundlage}.</div> : null}
        {daten?.kontingentGrundlage && !daten.kontingentpruefung ? <div className="dep-text">Für die Prüfung müssen die Jahrgänge 5 bis 10 in der Stundentafel stehen.</div> : null}
        {daten?.kontingentpruefung ? <>
          <div className="dep-text">Summe 5–10: <b className={daten.summeOk ? undefined : 'dep-ueber'}>{zahl(daten.summe)}</b> Wochenstunden (182–188). Soll = Kontingent, Ist = schulinterne Stundentafel.</div>
          <Tabelle<K> name="deputat-kontingente" zeilen={daten.kontingente} id={(z) => `${z.lernbereich}|${z.stufe}`} leerText="Alle Kontingente eingehalten."
            spalten={sp([['lernbereich', 'Lernbereich', 160], ['stufe', 'Jg.', 56], ['soll', 'Soll', 56, (z: K) => zahl(z.soll)], ['ist', 'Ist', 56, (z: K) => zahl(z.ist)], ['differenz', 'Differenz', 76, (z: K) => vz(z.differenz)]])} />
        </> : null}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------ Seite

async function einstellungen(u: Uebersicht, quelle: string, fertig: () => void) {
  const e = u.einstellungen;
  const w = await formular('Deputat – Landesprofil und Schule', [
    { name: 'bundesland', titel: 'Landesprofil', art: 'auswahl', wert: e.bundesland, optionen: u.profile, hinweis: u.profil.rechtsgrundlage },
    { name: 'grundstellen', titel: 'Grundstellen (Sek I bzw. gesamt)', wert: e.grundstellen ? String(e.grundstellen).replace('.', ',') : '', hinweis: 'Aus der Stellenberechnung; leer = aus den Beschäftigungsumfängen geschätzt' },
    { name: 'grundstellenSekII', titel: 'Grundstellen Sek II', wert: e.grundstellenSekII ? String(e.grundstellenSekII).replace('.', ',') : '', hinweis: 'Gymnasium, Gesamtschule: Anrechnung 1,2 je Stelle' },
    { name: 'offenerGanztag', titel: 'Offene Ganztagsschule (Primarbereich, +1 Std. Leitungszeit)', art: 'bool', wert: e.offenerGanztag },
    { name: 'anrechnungstopf', titel: 'Anrechnungstopf von Hand (Stunden)', wert: e.anrechnungstopf, hinweis: 'Leer = berechnet' },
    { name: 'leitungszeit', titel: 'Leitungszeit von Hand (Stunden)', wert: e.leitungszeit, hinweis: 'Leer = berechnet' },
    { name: 'automatischeErmaessigungen', titel: 'Alters- und Schwerbehindertenermäßigung berechnen', art: 'bool', wert: e.automatischeErmaessigungen },
    { name: 'toleranz', titel: 'Toleranz Soll/Ist (Stunden)', wert: String(e.toleranz).replace('.', ',') },
  ], { okText: 'Übernehmen', breite: '520px' });
  if (!w) return;
  const n = (x: string) => (String(x ?? '').trim() ? Number(String(x).replace(',', '.')) : 0);
  await api.put(api.dok('/deputat/einstellungen'), {
    bundesland: w.bundesland || e.bundesland, grundstellen: n(w.grundstellen), grundstellenSekII: n(w.grundstellenSekII), offenerGanztag: !!w.offenerGanztag,
    anrechnungstopf: String(w.anrechnungstopf ?? ''), leitungszeit: String(w.leitungszeit ?? ''), automatischeErmaessigungen: !!w.automatischeErmaessigungen, toleranz: n(w.toleranz),
  }, { quelle });
  fertig();
}

export default function Deputat({ p }: AnsichtProps) {
  const s = useStile();
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const tab = ['lehrkraefte', 'verteilung', 'tafel'].includes(String(p.tab)) ? String(p.tab) : 'lehrkraefte';
  const nach = p.nach === 'fach' ? 'fach' : 'klasse';
  const fach = typeof p.fach === 'number' ? p.fach : null;
  const { daten, neuLaden } = useDaten(() => api.get<Uebersicht>(api.dok('/deputat')), [], { bereiche: ['Stammdaten', 'Unterricht', 'Einstellungen', 'Stundenplan'], quelle: a.id });
  const { daten: faecher } = useDaten(() => api.get<Verteilung>(api.dok('/deputat/verteilung?nach=fach')).then((v) => v.faecher), [], { aktiv: tab === 'verteilung' });
  const still = () => void neuLaden(true);
  return (
    <AnsichtRahmen titel="Deputat und Unterrichtsverteilung"
      aktionen={<div style={{ display: 'flex', gap: 8 }}>
        {schreiben && daten ? <Button size="small" onClick={() => void einstellungen(daten, a.id, still).catch(fehlerMelden)}>Einstellungen …</Button> : null}
        <MenueKnopf art="knopf" size="small" text="Ausgabe" testid="deputat-ausgabe" eintraege={[
          { text: 'Deputat als PDF', aktion: () => dateiHerunterladen(api.dok('/deputat/bericht.pdf'), 'Deputat.pdf') },
          { text: 'Deputat als CSV', aktion: () => dateiHerunterladen(api.dok('/deputat/export.csv'), 'Deputat.csv') },
          { text: 'Unterrichtsverteilung als UVD.TXT (SchILD-NRW)', hinweis: 'Spaltenfolge nach Angaben aus dem SchILD-Umfeld; vor dem Import prüfen', aktion: () => dateiHerunterladen(api.dok('/deputat/export.csv?art=uvd'), 'UVD.TXT') },
        ]} />
      </div>}
      filter={<>
        <TabList size="small" selectedValue={tab} onTabSelect={(_, d) => a.parameterSetzen({ tab: String(d.value) })}>
          <Tab value="lehrkraefte">Lehrkräfte</Tab><Tab value="verteilung">Verteilung</Tab><Tab value="tafel">Stundentafel</Tab>
        </TabList>
        {tab === 'verteilung' ? <>
          <Segmente titel="Spalten" testid="deputat-nach" wert={nach} beiWahl={(w) => a.parameterSetzen({ nach: w })}
            optionen={[{ wert: 'klasse', text: 'Klassen' }, { wert: 'fach', text: 'Fächer' }]} />
          <Feld titel="Fach"><SuchAuswahl size="small" breite={170} ariaLabel="Fach" platzhalter="alle Fächer" wert={fach ? String(fach) : ''}
            beiWahl={(w) => a.parameterSetzen({ fach: w ? Number(w) : undefined })}
            optionen={[{ wert: '', text: 'alle Fächer' }, ...(faecher || []).map((f) => ({ wert: String(f.id), kurz: f.kurz, text: f.name ? `${f.kurz} – ${f.name}` : f.kurz }))]} /></Feld>
          <span className={s.tipp}>Offenen Unterricht rechts wählen, dann Kürzel in der Matrix oder „Zuweisen“.</span>
        </> : null}
        {tab === 'lehrkraefte' ? <span className={s.tipp}>Doppelklick: Ermäßigungen und Anrechnungen. Umfang als Stunden, „Vollzeit“ oder Prozent.</span> : null}
      </>}>
      <Kennzahlen u={daten} />
      {tab === 'lehrkraefte' ? <Lehrkraefte u={daten} quelle={a.id} neuLaden={still} />
        : tab === 'verteilung' ? <VerteilungAnsicht nach={nach} fach={fach} quelle={a.id} beiAenderung={still} />
          : <TafelAnsicht />}
    </AnsichtRahmen>
  );
}
