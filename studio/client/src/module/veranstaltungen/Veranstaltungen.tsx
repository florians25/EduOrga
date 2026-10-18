// Veranstaltungen (Vertretungsmodus): Nr., Klassen, Klassenteil, Lehrkräfte, Räume, Von, ab Std., Bis, bis Std., Grund, Text,
// zählt, Schülergruppe. Eingabe direkt in der Tabelle („Alle Lehrkräfte“, „Alle Klassen außer 5a“), Ersatzlehrkräfte statt
// „???“, Schnellauswahl (alle, nach Abteilung, Jahrgang, Gruppe …), alle aus den Stunden bzw. aus der gewählten Stunde
// übernehmen, Kopieren auf das eingestellte Datum.
import { Input } from '@fluentui/react-components';
import { useRef, useState } from 'react';
import { api } from '@/api/client';
import type { ElementOption } from '@/api/typen';
import { useAnsicht } from '@/kern/ansichten';
import { useEreignis } from '@/kern/ereignisse';
import { useDaten } from '@/kern/laden';
import { elemente, useDarfSchreiben, useStudio, zustand } from '@/kern/zustand';
import { AnsichtRahmen, Feld, Rechts, Werkzeug } from '@/komponenten/ansicht';
import { formular, frage } from '@/komponenten/dialoge';
import { hinweis } from '@/komponenten/hinweise';
import { MenueKnopf, type MenueListe } from '@/komponenten/menue';
import { Tabelle, type Spalte, type TabelleApi } from '@/komponenten/tabelle/Tabelle';
import { datumLesen, datumText } from '../vertretung/kern';
import { useZeitraum, ZeitraumAuswahl } from '../vertretung/steuer';

const FELDER: [string, string][] = [['K', 'Klassen (Unterricht entfällt)'], ['KT', 'Klassenteil (Unterricht parallel)'], ['L', 'Lehrkräfte'], ['R', 'Räume']];
const vapfad = (p = '') => api.dok(`/veranstaltungen${p}`);

interface VZeile { id: number; nr: number; k: string; kt: string; l: string; r: string; v: string; sv: number; b: string; sb: number; g: string; t: string; z: boolean; sg: string; offen?: string; vergangen?: boolean }
interface Gruppe { name: string; anzahl: number; ids: number[]; bereich?: string }
interface Antwort { id?: number; hinweis?: string }

export default function Veranstaltungen() {
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const tageProWoche = useStudio((x) => x.grunddaten?.zeitraster.tage.length || 5);
  const t = useRef<TabelleApi<VZeile>>(null);
  const [kopie, setKopie] = useState<number | null>(null);
  const [nr, setNr] = useState('');
  const letzteStunde = useRef<{ u: number; datum: string; stunde: number } | null>(null);
  const zr = useZeitraum((a.p.zeitraum as 'tag') || 'tag', tageProWoche, (z) => a.parameterSetzen({ zeitraum: z.art }));
  const { daten, neuLaden } = useDaten(async () => {
    const d = await api.get<{ zeilen: VZeile[] }>(vapfad(`?von=${zr.von}&bis=${zr.bis}`));
    return d.zeilen.map((z) => ({ ...z, k: z.k.replace(/\n/g, ' '), kt: z.kt.replace(/\n/g, ' '), l: z.l.replace(/\n/g, ' '), r: z.r.replace(/\n/g, ' ') }));
  }, [zr.von, zr.bis], { bereiche: ['Vertretung', 'Stammdaten'], aktiv: !!zr.von });
  useEreignis('vertretung.auswahl', (x) => {
    const z = x?.zeile;
    if (z?.u && z.datum) letzteStunde.current = { u: Number(z.u), datum: String(z.datum), stunde: Number(z.stunde) };
  });

  const waehleSpaeter = (id?: number) => { if (id) setTimeout(() => t.current?.waehle(id), 200); };
  const aktuell = () => t.current?.aktiveZeile() || null;
  const feld = async (id: number | null, schluessel: string, wert: string) => {
    const F = schluessel.toUpperCase();
    const w = F === 'V' || F === 'B' ? datumText(datumLesen(wert, zr.von!)) : wert;
    const r = await api.post<Antwort>(vapfad(id ? `/${id}` : ''), { feld: F, wert: w, datum: zr.von }, { quelle: a.id });
    await neuLaden(true);
    return r;
  };
  const schnell = async (feldname: string, ids: number[], ersetzen = false) => {
    const z = aktuell();
    const r = await api.post<Antwort>(vapfad(`/schnell${z ? `/${z.id}` : ''}`), { feld: feldname, ids, ersetzen, datum: zr.von }, { quelle: a.id });
    if (r.hinweis) hinweis(r.hinweis, 'info');
    await neuLaden(true);
    waehleSpaeter(r.id);
  };
  const gruppenEintraege = async (feldname: string): Promise<MenueListe> => {
    const z = aktuell();
    const gruppen = await api.get<Gruppe[]>(vapfad(`/gruppen?feld=${feldname}${z ? `&va=${z.id}` : ''}`));
    const e: MenueListe = gruppen.filter((g) => !g.bereich).map((g) => ({ text: `${g.name}  (${g.anzahl})`, aktion: () => schnell(feldname, g.ids) }));
    for (const b of [...new Set(gruppen.filter((g) => g.bereich).map((g) => g.bereich!))]) {
      e.push({ text: `Nach ${b}`, menue: gruppen.filter((g) => g.bereich === b).map((g) => ({ text: `${g.name}  (${g.anzahl})`, aktion: () => schnell(feldname, g.ids) })) });
    }
    return e.length ? e : [{ text: 'Keine Elemente', deaktiviert: true }];
  };
  const ausStunden = async () => {
    const z = aktuell();
    if (!z) { hinweis('Bitte zuerst eine Veranstaltung wählen.', 'warnung'); return; }
    const r = await api.post<Antwort>(vapfad(`/${z.id}/ausstunden`), {}, { quelle: a.id });
    if (r.hinweis) hinweis(r.hinweis, 'info');
    await neuLaden(true);
  };
  const ausStunde = async () => {
    const s = letzteStunde.current;
    if (!s) return;
    const r = await api.post<Antwort>(vapfad('/ausstunde'), { unterricht: s.u, datum: s.datum, stunde: s.stunde, va: aktuell()?.id }, { quelle: a.id });
    if (r.hinweis) hinweis(r.hinweis, 'info');
    await neuLaden(true);
    waehleSpaeter(r.id);
  };
  const schnellListe = (feldname: string | null): MenueListe => {
    const z = aktuell();
    const s = letzteStunde.current;
    const liste: MenueListe = feldname
      ? [{ text: 'Gruppen', menue: () => gruppenEintraege(feldname) }, null, { text: `${FELDER.find((q) => q[0] === feldname)![1]} leeren`, deaktiviert: !z, aktion: () => schnell(feldname, [], true) }]
      : FELDER.map(([k, text]) => ({ text, menue: () => gruppenEintraege(k) }));
    return [...liste, null,
      { text: 'Alle aus den Stunden der Veranstaltung übernehmen', deaktiviert: !z, aktion: ausStunden },
      { text: s ? `Alle aus der gewählten Stunde übernehmen (Unterricht ${s.u})` : 'Alle aus der gewählten Stunde übernehmen (zuerst eine Stunde wählen)', deaktiviert: !s, aktion: ausStunde },
    ];
  };
  const loeschen = async () => {
    const ids = (t.current?.ausgewaehlte() || []).map((z) => z.id);
    if (!ids.length || !(await frage(`${ids.length} Veranstaltung(en) löschen?`, { gefahr: true, ja: 'Löschen', nein: 'Abbrechen' }))) return;
    await api.post(vapfad('/loeschen'), { ids }, { quelle: a.id });
    await neuLaden(true);
  };
  const neu = async () => {
    const w = await formular('Neue Veranstaltung', [
      { name: 'T', titel: 'Text', wert: 'Exkursion' }, { name: 'K', titel: 'Klassen', hinweis: 'Kurznamen, „Alle Klassen“ oder „Alle Klassen außer 5a“' },
      { name: 'L', titel: 'Lehrkräfte', hinweis: 'Kurznamen oder „Alle Lehrkräfte“' }, { name: 'R', titel: 'Räume' },
      { name: 'V', titel: 'Von', wert: datumText(zr.von) }, { name: 'SV', titel: 'Ab Stunde', art: 'zahl', wert: 1 },
      { name: 'B', titel: 'Bis', wert: datumText(zr.von) }, { name: 'SB', titel: 'Bis Stunde', art: 'zahl', wert: zustand().grunddaten?.zeitraster.stunden.length || 8 },
    ], { okText: 'Anlegen', breite: '500px' });
    if (!w) return;
    const r = await api.post<Antwort>(vapfad(''), { feld: 'T', wert: w.T || 'Veranstaltung', datum: datumLesen(w.V, zr.von!) }, { quelle: a.id });
    for (const k of ['B', 'SV', 'SB', 'K', 'L', 'R']) if (w[k]) await api.post(vapfad(`/${r.id}`), { feld: k, wert: k === 'B' ? datumText(datumLesen(w[k], zr.von!)) : w[k] }, { quelle: a.id });
    await neuLaden(true);
    waehleSpaeter(r.id);
  };

  const ed = (z: VZeile) => schreiben && !!z;
  const rot = (z: VZeile) => (z.offen ? 'vt-rot' : null);
  const spalten: Spalte<VZeile>[] = [
    { schluessel: 'nr', titel: 'Nr.', breite: 56, art: 'NurLesen', ausrichtung: 'rechts', klasse: rot },
    { schluessel: 'k', titel: 'Klassen', breite: 110, hinweis: 'Klassen – ihr Unterricht entfällt', art: 'ElementListe', refTyp: 'klasse', editierbarFuer: ed },
    { schluessel: 'kt', titel: 'Klassenteil', breite: 90, hinweis: 'Klassenteil – der übrige Unterricht findet parallel statt', art: 'ElementListe', refTyp: 'klasse', editierbarFuer: ed },
    { schluessel: 'l', titel: 'Lehrkräfte', breite: 130, art: 'ElementListe', refTyp: 'lehrer', editierbarFuer: ed, farbe: (z) => (z.offen ? 'var(--up-entfall-flaeche)' : null), klasse: rot },
    { schluessel: 'r', titel: 'Räume', breite: 80, art: 'ElementListe', refTyp: 'raum', editierbarFuer: ed },
    { schluessel: 'v', titel: 'Von', breite: 96, editierbarFuer: ed },
    { schluessel: 'sv', titel: 'ab Std.', breite: 60, art: 'Ganzzahl', ausrichtung: 'rechts', editierbarFuer: ed },
    { schluessel: 'b', titel: 'Bis', breite: 96, editierbarFuer: ed },
    { schluessel: 'sb', titel: 'bis Std.', breite: 64, art: 'Ganzzahl', ausrichtung: 'rechts', editierbarFuer: ed },
    { schluessel: 'g', titel: 'Grund', breite: 72, art: 'Element', refTyp: 'abwesenheitsgrund', editierbarFuer: ed },
    { schluessel: 't', titel: 'Text', breite: 180, editierbarFuer: ed },
    { schluessel: 'z', titel: 'Zählt', breite: 56, hinweis: 'Wird im Vertretungszähler gezählt', art: 'Bool', editierbarFuer: ed },
    { schluessel: 'sg', titel: 'Schülergruppe', breite: 120, art: 'Element', refTyp: 'schuelergruppe', editierbarFuer: ed },
  ];
  const optionen = async (s: Spalte<VZeile>): Promise<ElementOption[]> => {
    if (s.refTyp === 'schuelergruppe') return (await api.get<string[]>(vapfad('/schuelergruppen'))).map((x, i) => ({ id: i, k: x, l: '' }));
    const liste = await elemente(s.refTyp!);
    return s.art === 'ElementListe'
      ? [{ id: -1, k: s.refTyp === 'lehrer' ? 'Alle Lehrkräfte' : s.refTyp === 'raum' ? 'Alle Räume' : 'Alle Klassen', l: 'alle (wählbaren) Elemente' }, ...liste]
      : liste;
  };
  const zur = (n: number) => { if (n && !t.current?.waehle(n)) hinweis(`Die Veranstaltung Nr. ${n} liegt nicht im gewählten Zeitraum.`, 'warnung'); };

  return (
    <AnsichtRahmen titel="Veranstaltungen"
      werkzeuge={<>
        {schreiben ? <>
          <Werkzeug text="Neu" titel="Neue Veranstaltung" aktion={neu} />
          <Werkzeug text="Löschen" titel="Markierte Veranstaltungen löschen (Entf)" aktion={loeschen} />
          <MenueKnopf text="Hinzufügen" titel="Schnell hinzufügen: alle Lehrkräfte, Klassen, Räume, nach Abteilung, Jahrgang oder Gruppe, alle aus den Stunden" eintraege={() => schnellListe(null)} />
        </> : null}
        <MenueKnopf text="Weitere Aktionen" eintraege={() => [
          { text: 'Kopieren', deaktiviert: !schreiben, aktion: () => { const id = aktuell()?.id ?? null; setKopie(id); if (id) hinweis(`Veranstaltung ${id} kopiert – „Einfügen“ legt sie am eingestellten Datum an.`, 'info'); } },
          { text: 'Einfügen am eingestellten Datum', deaktiviert: !schreiben || !kopie, aktion: async () => {
            const r = await api.post<Antwort>(vapfad(`/${kopie}/kopieren`), { datum: zr.von }, { quelle: a.id });
            await neuLaden(true);
            waehleSpaeter(r.id);
          } },
          null,
          { text: 'Alle aus den Stunden übernehmen', deaktiviert: !schreiben, aktion: ausStunden },
          null,
          { text: 'Vertretungen', aktion: () => a.oeffnen('vertretung.liste') },
        ]} />
        <Rechts><Feld titel="Nr."><Input size="small" style={{ width: 80 }} inputMode="numeric" value={nr} title="Nummer eingeben und Enter: zur Veranstaltung springen" onChange={(_, d) => setNr(d.value)} onKeyDown={(e) => { if (e.key === 'Enter') zur(Number(nr)); }} /></Feld></Rechts>
      </>}
      filter={<Feld titel="Zeitraum"><ZeitraumAuswahl z={zr} /></Feld>}>
      <Tabelle<VZeile> ref={t} name="veranstaltungen" zeilen={daten || []} spalten={spalten} id={(z) => z.id} sortierbar={false} zeilenHoehe={30} zustandSchluessel="tabelle.veranstaltungen"
        leerText="Im gewählten Zeitraum gibt es keine Veranstaltungen." neuText={schreiben ? 'Neue Veranstaltung …' : undefined}
        zeilenKlasse={(z) => (z.vergangen ? 'leise' : '')}
        neu={schreiben ? async (s, wert) => { const r = await feld(null, s.schluessel, wert); waehleSpaeter(r.id); return null; } : undefined}
        aendern={schreiben ? async (z, s, wert) => { await feld(z.id, s.schluessel, wert); return null; } : undefined}
        optionen={optionen}
        beiAuswahl={(_, z) => { setNr(z ? String(z.id) : ''); if (z?.offen) hinweis(z.offen, 'warnung', 4000); }}
        kontextmenue={(_, s) => {
          if (!schreiben) return [];
          const fe = FELDER.find((x) => x[0].toLowerCase() === s?.schluessel)?.[0] || null;
          return schnellListe(fe);
        }}
        beiEntf={() => void loeschen()} />
    </AnsichtRahmen>
  );
}

