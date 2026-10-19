// Abwesenheiten: Reiter Lehrkräfte / Klassen / Räume mit Anzahl, Zeitraum, direkte Eingabe in der Liste (Nr., Element, Von,
// ab Std., Bis, bis Std., Grund, Text, Begleitung, offen). Änderungen einer Zeile werden erst beim Verlassen der Zeile
// übernommen (Strg+Enter sofort, Esc verwirft); neue Abwesenheiten: Planungsdatum, 1. bis letzte Stunde.
import { Tab, TabList } from '@fluentui/react-components';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { api, einstellungLesen, einstellungSchreiben } from '@/api/client';
import { useAnsicht, type AnsichtProps } from '@/kern/ansichten';
import { arbeitsplatzOeffnen } from '@/kern/befehle';
import { betrifft, useEreignis } from '@/kern/ereignisse';
import { entprellen } from '@/kern/hilfen';
import { elemente, useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, Feld, FussText, Rechts, Schalter, Werkzeug } from '@/komponenten/ansicht';
import { formular, frage, meldung } from '@/komponenten/dialoge';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { MenueKnopf, type MenueListe } from '@/komponenten/menue';
import { Tabelle, type Spalte, type TabelleApi } from '@/komponenten/tabelle/Tabelle';
import { datumLesen, plusTage, tagText, vpfad } from './kern';
import { useZeitraum, ZeitraumAuswahl } from './steuer';

const ARTEN = [{ art: 'lehrer', titel: 'Lehrkräfte', einzel: 'Lehrkraft', typ: 'lehrer' }, { art: 'klasse', titel: 'Klassen', einzel: 'Klasse', typ: 'klasse' }, { art: 'raum', titel: 'Räume', einzel: 'Raum', typ: 'raum' }];

export interface NeueAbsenz { id: number; element: string; von: string; bis: string; sv: number; sb: number; grund?: string; text?: string; begleit?: string }

/** Abwesenheiten speichern und die Rückfragen stellen (Vertretung abwesend, Veranstaltung, Verlegungen, Sondereinsätze). */
export async function absenzenSpeichern(art: string, neu: NeueAbsenz[], alt: number[], quelle?: string, text?: string) {
  const r = await api.post<{ doppelt?: boolean; betroffen?: string[]; nachfragen?: { text: string; art?: string; hinweis?: string }[] }>(vpfad('/absenzen/speichern'), { art, neu, alt, text }, { quelle });
  if (r.doppelt) hinweis('Diese Abwesenheit ist bereits vorhanden.', 'warnung');
  if (r.betroffen?.length) await meldung(`Folgende Vertretungen waren mit einer Lehrkraft geplant, die nun abwesend ist. Sie sind wieder offen und müssen neu besetzt werden:\n\n${r.betroffen.join('\n')}`, 'Vertretende Lehrkraft abwesend');
  for (const n of r.nachfragen || []) {
    if (!(await frage(n.text, { titel: 'Rückfrage' }))) continue;
    await api.post(vpfad('/absenzen/nachfrage'), n, { quelle });
    if (n.art === 'veranstaltung' && n.hinweis) await meldung(n.hinweis, 'Hinweis');
  }
  return r;
}

/** Formular einer Abwesenheit (Element, Von/ab Std., Bis/bis Std., Grund, Text, bei Klassen Begleitung). */
async function absenzFormular(artName: string, titel: string, von0: string, letzte: number, z?: Partial<AZeile>) {
  const art = ARTEN.find((x) => x.art === artName) || ARTEN[0]!;
  const gruende = await elemente('abwesenheitsgrund');
  const auswahl = await elemente(art.typ);
  const lehrkraefte = art.art === 'klasse' ? await elemente('lehrer') : [];
  const w = await formular(titel, [
    { name: 'element', titel: art.einzel, art: 'element', elemente: auswahl, wert: z?.element || '', pflicht: true },
    { name: 'von', titel: 'Von', art: 'datum', wert: z?.vonIso || von0 },
    { name: 'sv', titel: 'Ab Stunde', art: 'zahl', wert: z?.sv || 1 },
    { name: 'bis', titel: 'Bis', art: 'datum', wert: z?.bisIso || von0 },
    { name: 'sb', titel: 'Bis Stunde', art: 'zahl', wert: z?.sb || letzte },
    { name: 'grund', titel: 'Grund', art: 'auswahl', wert: z?.grund || '', optionen: [{ wert: '', text: '' }, ...gruende.map((g) => ({ wert: g.k, text: g.l ? `${g.k} – ${g.l}` : g.k }))] },
    { name: 'text', titel: 'Text', wert: z?.text || '' },
    ...(art.art === 'klasse' ? [{ name: 'begleit', titel: 'Begleitung', art: 'elemente' as const, elemente: lehrkraefte, wert: z?.begleit || '', hinweis: 'Begleitende Lehrkräfte gelten ebenfalls als abwesend (z. B. Klassenfahrt).' }] : []),
  ], { okText: 'Speichern', breite: '480px' });
  if (!w) return null;
  const von = datumLesen(w.von, von0);
  return { element: String(w.element).trim(), von, bis: datumLesen(w.bis, von), sv: Number(w.sv) || 1, sb: Number(w.sb) || letzte, grund: w.grund, text: w.text, begleit: w.begleit || '' };
}

/** Neue Abwesenheit (Lehrkraft, Klasse oder Raum) über ein Formular erfassen – z. B. aus der Tagesplanung. true = gespeichert. */
export async function abwesenheitErfassen(art: 'lehrer' | 'klasse' | 'raum', datum: string, letzte: number, quelle?: string): Promise<boolean> {
  const einzel = ARTEN.find((x) => x.art === art)!.einzel;
  const x = await absenzFormular(art, `Abwesenheit erfassen – ${einzel}`, datum, letzte);
  if (!x) return false;
  await absenzenSpeichern(art, [{ id: 0, ...x }], [], quelle, 'Abwesenheit eingeben');
  return true;
}

interface AZeile { id: string; nr: string; element: string; elementId?: number; vonIso: string; bisIso: string; sv: string; sb: string; grund: string; text: string; begleit: string; offen: string; va?: number; entwurf?: boolean }
interface AbsenzDaten {
  zeilen: { id: string | number; nr: number; element: string; elementId: number; von: string; bis: string; sv: number; sb: number; grund: string; text: string; begleit: string; offen: number }[];
  veranstaltungen: { id: string; nr: number; von: string; bis: string; sv: number; sb: number; grund: string; elemente: string; text: string }[];
  anzahl: Record<string, number>;
  letzteStunde: number;
}
interface Entwurf { id: string; neu: boolean; bisGesetzt: boolean; zeile: AZeile }

export default function Absenzen({ p }: AnsichtProps) {
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const [artIndex, setArtIndex] = useState(Math.max(0, ARTEN.findIndex((x) => x.art === p.art)));
  const art = ARTEN[artIndex]!;
  const [daten, setDaten] = useState<AbsenzDaten | null>(null);
  const [entwurf, setEntwurfState] = useState<Entwurf | null>(null);
  const entwurfRef = useRef<Entwurf | null>(null);
  const setEntwurf = (e: Entwurf | null) => { entwurfRef.current = e; setEntwurfState(e); };
  const [markiert, setMarkiert] = useState<{ typ: string; id: number } | null>(null);
  const [vaZeigen, setVaZeigen] = useState<boolean | null>(null);
  const tabelle = useRef<TabelleApi<AZeile>>(null);
  const element = useRef<HTMLDivElement>(null);
  const zr = useZeitraum((p.zeitraum as 'tag') || 'tag', 5, async (z) => { await entwurfUebernehmen(); a.parameterSetzen({ zeitraum: z.art }); void laden(z.von, z.bis); });
  const zrRef = useRef(zr); zrRef.current = zr;
  const letzte = () => daten?.letzteStunde || 8;

  useEffect(() => { void einstellungLesen<boolean>('vertretung.absenzen.va').then((w) => setVaZeigen(!!w)); }, []);

  const ladeNr = useRef(0);
  async function laden(von = zrRef.current.von, bis = zrRef.current.bis) {
    if (entwurfRef.current || !von || vaZeigenRef.current === null) return;
    const n = ++ladeNr.current;
    try {
      const d = await api.get<AbsenzDaten>(vpfad(`/absenzen?art=${ARTEN[artIndexRef.current]!.art}&von=${von}&bis=${bis}&veranstaltungen=${vaZeigenRef.current}`));
      if (n !== ladeNr.current || entwurfRef.current) return;
      setDaten(d);
    } catch (e) { fehlerMelden(e); }
  }
  const artIndexRef = useRef(artIndex); artIndexRef.current = artIndex;
  const vaZeigenRef = useRef(vaZeigen); vaZeigenRef.current = vaZeigen;
  useEffect(() => { void laden(); }, [artIndex, vaZeigen]); // eslint-disable-line react-hooks/exhaustive-deps
  const entprelltLaden = useMemo(() => entprellen(() => { void laden(); }, 150), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEreignis('daten', (e) => { if (betrifft(e, 'Vertretung', 'Stammdaten', 'Stundenplan')) entprelltLaden(); });
  useEreignis('vertretung.datum', () => { if (entwurfRef.current) void entwurfUebernehmen(); });

  const zeilenServer = useMemo<AZeile[]>(() => {
    if (!daten) return [];
    const z: AZeile[] = daten.zeilen.map((x) => ({ id: String(x.id), nr: String(x.nr), element: x.element, elementId: x.elementId, vonIso: x.von, bisIso: x.bis, sv: String(x.sv), sb: String(x.sb), grund: x.grund, text: x.text, begleit: x.begleit, offen: x.offen ? String(x.offen) : '' }));
    for (const v of daten.veranstaltungen) z.push({ id: v.id, va: v.nr, nr: `VA ${v.nr}`, element: '', vonIso: v.von, bisIso: v.bis, sv: String(v.sv), sb: String(v.sb), grund: v.grund, text: `Veranstaltung: ${v.elemente} ${v.text}`.trim(), begleit: '', offen: '' });
    return z;
  }, [daten]);
  const zeilen = useMemo(() => {
    if (!entwurf) return zeilenServer;
    const l = zeilenServer.map((z) => (z.id === entwurf.id ? entwurf.zeile : z));
    if (entwurf.neu) l.push(entwurf.zeile);
    return l;
  }, [zeilenServer, entwurf]);

  /** Eingabe in den Entwurf der Zeile übernehmen (gespeichert wird beim Zeilenwechsel). */
  function anwenden(e: Entwurf, feld: string, wert: string): Entwurf {
    const w = String(wert ?? '').trim();
    const L = letzte();
    const z = { ...e.zeile };
    let bisGesetzt = e.bisGesetzt;
    switch (feld) {
      case 'element': z.element = w; break;
      case 'von': z.vonIso = datumLesen(w, z.vonIso); if (!bisGesetzt || z.bisIso < z.vonIso) z.bisIso = z.vonIso; break;
      case 'bis': z.bisIso = datumLesen(w, z.bisIso); bisGesetzt = true; if (z.bisIso < z.vonIso) z.vonIso = z.bisIso; break;
      case 'sv': z.sv = String(w ? Math.min(Math.max(1, Number(w) || 1), L) : 1); break;
      case 'sb': z.sb = String(w ? Math.min(Math.max(1, Number(w) || L), L) : L); break;
      case 'grund': z.grund = w; break;
      case 'text': z.text = w; break;
      case 'begleit': z.begleit = w; break;
      default: return e;
    }
    z.entwurf = true;
    z.nr = e.neu ? 'neu *' : `${String(z.nr).replace(' *', '')} *`;
    return { ...e, bisGesetzt, zeile: z };
  }

  async function entwurfUebernehmen() {
    const e = entwurfRef.current;
    if (!e) return;
    setEntwurf(null);
    const z = e.zeile;
    if (!z.element) {
      if (!e.neu) hinweis('Ohne Element kann die Abwesenheit nicht gespeichert werden – die Änderung wurde verworfen.', 'warnung');
      await laden();
      return;
    }
    const nr = Number(String(z.nr).replace(' *', ''));
    try {
      await absenzenSpeichern(ARTEN[artIndexRef.current]!.art, [{ id: e.neu ? 0 : nr, element: z.element, von: z.vonIso, bis: z.bisIso, sv: Number(z.sv), sb: Number(z.sb), grund: z.grund, text: z.text, begleit: z.begleit }],
        e.neu ? [] : [nr], a.id, e.neu ? 'Abwesenheit eingeben' : 'Abwesenheit geändert');
    } catch (x) { fehlerMelden(x); }
    await laden();
  }

  const markierte = () => (tabelle.current?.ausgewaehlte() || []).filter((z) => !z.va && !z.id.startsWith('neu')).map((z) => Number(String(z.nr).replace(' *', '')));

  const formularAbsenz = (titel: string, z?: AZeile) => absenzFormular(art.art, titel, zrRef.current.von || '', letzte(), z);
  async function neuDialog() {
    await entwurfUebernehmen();
    const x = await formularAbsenz('Neue Abwesenheit');
    if (x) { await absenzenSpeichern(art.art, [{ id: 0, ...x }], [], a.id, 'Abwesenheit eingeben'); await laden(); }
  }
  async function bearbeiten() {
    await entwurfUebernehmen();
    const z = tabelle.current?.aktiveZeile();
    if (!z || z.va) return;
    const x = await formularAbsenz(`Abwesenheit ${z.nr} bearbeiten`, z);
    if (x) { await absenzenSpeichern(art.art, [{ id: Number(z.nr), ...x }], [Number(z.nr)], a.id, 'Abwesenheit geändert'); await laden(); }
  }
  async function teilen() {
    await entwurfUebernehmen();
    const z = tabelle.current?.aktiveZeile();
    if (!z || z.va) return;
    if (z.vonIso === z.bisIso) { hinweis('Eine eintägige Abwesenheit kann nicht geteilt werden.', 'warnung'); return; }
    const w = await formular('Abwesenheit teilen', [{ name: 'ab', titel: 'Zweiter Teil beginnt am', art: 'datum', wert: plusTage(z.vonIso, 1), pflicht: true }], { okText: 'Teilen' });
    if (!w) return;
    await api.post(vpfad('/absenzen/teilen'), { id: Number(z.nr), ab: datumLesen(w.ab, z.vonIso) }, { quelle: a.id });
    await laden();
  }
  async function kopieren() {
    await entwurfUebernehmen();
    const z = tabelle.current?.aktiveZeile();
    if (!z || z.va) return;
    const w = await formular('Abwesenheit übertragen', [{ name: 'elemente', titel: art.titel, pflicht: true, hinweis: 'Kurznamen, mehrere mit Komma. Zeitraum und Grund werden übernommen.' }], { okText: 'Übertragen' });
    if (!w) return;
    await api.post(vpfad('/absenzen/kopieren'), { id: Number(z.nr), elemente: w.elemente }, { quelle: a.id });
    await laden();
  }
  async function zusammenfassen() {
    await entwurfUebernehmen();
    await api.post(vpfad('/absenzen/zusammenfassen'), { ids: markierte() }, { quelle: a.id });
    await laden();
  }
  async function loeschen() {
    await entwurfUebernehmen();
    const ids = markierte();
    if (!ids.length || !(await frage(`${ids.length} Abwesenheit(en) löschen? Daraus entstandene Vertretungen werden entfernt.`, { gefahr: true, ja: 'Löschen', nein: 'Abbrechen' }))) return;
    await api.post(vpfad('/absenzen/loeschen'), { ids }, { quelle: a.id });
    await laden();
  }
  const weitere = (): MenueListe => [
    { text: 'Abwesenheit teilen …', deaktiviert: !schreiben, aktion: teilen },
    { text: 'Auf weitere übertragen …', deaktiviert: !schreiben, aktion: kopieren },
    { text: 'Abwesenheiten zusammenfassen', deaktiviert: !schreiben, aktion: zusammenfassen },
  ];

  // Verknüpfung: Abwesenheiten der gewählten Lehrkraft (Klasse, Raum) hervorheben
  function markieren(typ: string, id: number) {
    if (entwurfRef.current || tabelle.current?.editorOffen()) return;
    setMarkiert({ typ, id });
    const i = ARTEN.findIndex((x) => x.typ === typ);
    if (i >= 0 && i !== artIndex) { setArtIndex(i); return; }
    const z = zeilen.find((x) => x.elementId === id);
    if (z && !element.current?.contains(document.activeElement)) tabelle.current?.waehle(z.id);
  }
  useEreignis('vertretung.auswahl', (x) => {
    if (!x?.zeile || element.current?.contains(document.activeElement)) return;
    if (art.art === 'klasse' && x.zeile.klasse) markieren('klasse', x.zeile.klasse);
    else if (x.zeile.lehrer) markieren('lehrer', x.zeile.lehrer);
  });
  useEreignis('element', (e) => { if (e.quelle !== a.id && ['lehrer', 'klasse', 'raum'].includes(e.typ)) markieren(e.typ, e.id); });
  useEffect(() => () => { void entwurfUebernehmen(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const nichtVa = (z: AZeile) => !z.va;
  const spalten = useMemo<Spalte<AZeile>[]>(() => [
    { schluessel: 'nr', titel: 'Nr.', breite: 64, art: 'NurLesen', ausrichtung: 'rechts' },
    { schluessel: 'element', titel: art.einzel, breite: 90, art: 'Element', refTyp: art.typ, editierbarFuer: nichtVa },
    { schluessel: 'von', titel: 'Von', breite: 110, art: 'Datum', editierbarFuer: nichtVa, wert: (z) => tagText(z.vonIso) },
    { schluessel: 'sv', titel: 'ab Std.', breite: 64, art: 'Ganzzahl', editierbarFuer: nichtVa },
    { schluessel: 'bis', titel: 'Bis', breite: 110, art: 'Datum', editierbarFuer: nichtVa, wert: (z) => tagText(z.bisIso) },
    { schluessel: 'sb', titel: 'bis Std.', breite: 68, art: 'Ganzzahl', editierbarFuer: nichtVa },
    { schluessel: 'grund', titel: 'Grund', breite: 80, art: 'Element', refTyp: 'abwesenheitsgrund', editierbarFuer: nichtVa },
    { schluessel: 'text', titel: 'Text', breite: 260, editierbarFuer: nichtVa },
    ...(art.art === 'klasse' ? [{ schluessel: 'begleit', titel: 'Begleitung', breite: 120, hinweis: 'Begleitende Lehrkräfte (gelten ebenfalls als abwesend)', art: 'ElementListe' as const, refTyp: 'lehrer', editierbarFuer: nichtVa }] : []),
    { schluessel: 'offen', titel: 'Offen', breite: 60, hinweis: 'Offene Vertretungen', art: 'NurLesen', ausrichtung: 'rechts', klasse: (z) => (Number(z.offen) > 0 ? 'vt-rot' : null) },
  ], [art]); // eslint-disable-line react-hooks/exhaustive-deps

  const tasten = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && entwurfRef.current) { setEntwurf(null); void laden(); return true; }
    if (e.key === 'Enter' && e.ctrlKey && entwurfRef.current) { void entwurfUebernehmen(); return true; }
    if (e.key === 'Delete' && e.ctrlKey) { void loeschen(); return true; }
    if (e.key === 'Insert' && schreiben) { void neuDialog(); return true; }
    return false;
  };

  const anzahl = daten?.anzahl || {};
  return (
    <AnsichtRahmen titel={`Abwesenheiten – ${art.titel}`}
      werkzeuge={<>
        {schreiben ? <>
          <Werkzeug text="Neu" titel="Neue Abwesenheit (Einfg)" aktion={neuDialog} />
          <Werkzeug text="Bearbeiten" titel="Markierte Abwesenheit bearbeiten" aktion={bearbeiten} />
          <Werkzeug text="Löschen" titel="Markierte Abwesenheiten löschen (Strg+Entf)" aktion={loeschen} />
        </> : null}
        <MenueKnopf text="Weitere Aktionen" eintraege={() => [...weitere(), null, { text: 'Veranstaltungen …', aktion: () => a.oeffnen('veranstaltungen.liste', {}) }]} />
        <Rechts><Schalter text="Veranstaltungen zeigen" an={!!vaZeigen} titel="Veranstaltungen des Zeitraums in der Liste mit anzeigen"
          beiAenderung={(w) => { setVaZeigen(w); void einstellungSchreiben('vertretung.absenzen.va', w); }} />
          {a.lage === 'seite' ? <Werkzeug text="Zur Tagesplanung" titel="Vertretungen des Planungsdatums bearbeiten" aktion={() => arbeitsplatzOeffnen('tagesplanung')} /> : null}</Rechts>
      </>}
      filter={<>
        <TabList size="small" selectedValue={String(artIndex)} onTabSelect={async (_, d) => { await entwurfUebernehmen(); const i = Number(d.value); setArtIndex(i); a.parameterSetzen({ art: ARTEN[i]!.art }); }}>
          {ARTEN.map((x, i) => <Tab key={x.art} value={String(i)}>{`${x.titel} (${anzahl[x.art] ?? 0})`}</Tab>)}
        </TabList>
        <Feld titel="Zeitraum"><ZeitraumAuswahl z={zr} /></Feld>
      </>}
      fuss={<>
        <span>{daten?.zeilen.length ?? 0} {daten?.zeilen.length === 1 ? 'Abwesenheit' : 'Abwesenheiten'}</span>
        <span>{(daten?.zeilen || []).reduce((x, z) => x + z.offen, 0)} offene Vertretungen</span>
        <FussText rechts>Zeile verlassen speichert · Strg+Enter sofort · Esc verwirft</FussText>
      </>}>
      <div ref={element} style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Tabelle<AZeile> ref={tabelle} name="abwesenheiten" spalten={spalten} zeilen={zeilen} sortierbar={false}
          leerText="Im gewählten Zeitraum ist niemand abwesend."
          neuText={schreiben ? 'Neue Abwesenheit …' : undefined}
          neu={schreiben ? async (s, wert) => {
            await entwurfUebernehmen();
            const von = zrRef.current.von || '';
            const z: AZeile = { id: `neu${Date.now()}`, nr: 'neu *', element: '', vonIso: von, bisIso: von, sv: '1', sb: String(letzte()), grund: '', text: '', begleit: '', offen: '', entwurf: true };
            const e = anwenden({ id: z.id, neu: true, bisGesetzt: false, zeile: z }, s.schluessel, wert);
            setEntwurf(e);
            setTimeout(() => tabelle.current?.waehle(e.id, s.schluessel));
          } : undefined}
          aendern={schreiben ? async (z, s, wert) => {
            if (z.va) return;
            if (entwurfRef.current && entwurfRef.current.id !== z.id) await entwurfUebernehmen();
            const basis = entwurfRef.current ?? { id: z.id, neu: false, bisGesetzt: true, zeile: z };
            try { setEntwurf(anwenden(basis, s.schluessel, wert)); } catch (f) { fehlerMelden(f); }
          } : undefined}
          optionen={(s) => elemente(s.refTyp || '')}
          zeilenKlasse={(z) => [z.va ? 'vt-va' : '', z.entwurf ? 'vt-entwurf' : '', markiert && !z.va && z.elementId === markiert.id && markiert.typ === art.typ ? 'gewaehlt' : ''].filter(Boolean).join(' ')}
          beiAuswahl={(_, aktiv) => { if (entwurfRef.current && aktiv?.id !== entwurfRef.current.id) void entwurfUebernehmen(); }}
          beiDoppelklick={(z) => (z.va ? a.oeffnen('veranstaltungen.liste', {}) : void bearbeiten())}
          kontextmenue={() => [
            { text: 'Neue Abwesenheit …', taste: 'Einfg', deaktiviert: !schreiben, aktion: neuDialog },
            { text: 'Bearbeiten …', deaktiviert: !schreiben, aktion: bearbeiten },
            ...weitere(),
            null,
            { text: 'Löschen', taste: 'Strg+Entf', deaktiviert: !schreiben, aktion: loeschen },
          ]}
          beiEntf={() => void loeschen()}
          tasten={tasten} />
      </div>
    </AnsichtRahmen>
  );
}
