// Unterrichtsansicht je Klasse, Lehrkraft, Fach oder alle Unterrichte: Tabelle mit Nummer, Kopplung, Wochenstunden, Fach,
// Lehrkraft, Klassen, Räumen, Doppelstunden, Block, Text … und Inline-Eingabe. Kopplungszeilen erscheinen als eigene Zeilen
// unter dem Unterricht. „Findet online statt“ über den Dialog Online (bzw. die Spalten der Karte „Online“).
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/api/client';
import { useAnsicht, type AnsichtProps } from '@/kern/ansichten';
import { melden, useEreignis } from '@/kern/ereignisse';
import { useDaten } from '@/kern/laden';
import { elemente, useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, ElementAuswahl, FussText, Rechts, Schalter, Trenner, Werkzeug } from '@/komponenten/ansicht';
import { frage } from '@/komponenten/dialoge';
import { hinweis } from '@/komponenten/hinweise';
import { MenueKnopf } from '@/komponenten/menue';
import { Tabelle, type Spalte, type TabelleApi } from '@/komponenten/tabelle/Tabelle';
import { ersterOder, titelBreite, useElemente } from '../gemeinsam';
import { onlineDialog } from './online';

const SICHTEN: Record<string, string> = { klasse: 'Klasse', lehrer: 'Lehrkraft', fach: 'Fach', alle: 'Alle Unterrichte' };

/** Anzeigenamen der Unterrichtsspalten (der Server liefert Kurzbezeichnungen). */
const SPALTENTITEL: Record<string, string> = {
  UNr: 'Nr.', KlLe: 'Kopplung', Nvpl: 'Nicht verplant', Wst: 'Wochenstd.', Jst: 'Jahresstd.', Lehrer: 'Lehrkraft', Klassen: 'Klassen',
  Dopp: 'Doppelstunden', Fix: 'Fixiert', Ignore: 'Ignorieren', Mehrmals: 'Mehrmals am Tag', KeineVtr: 'Keine Vertretung', Kurs: 'Kursname',
  Faktor: 'Wertfaktor', Periode: 'Woche', UGruppe: 'Unterrichtsgruppe', ZUGruppe: 'Gruppe der Zeile', Von: 'Von', Bis: 'Bis',
  Online: 'Online', OnlineLink: 'Online-Link',
};

interface SpaltenInfo { schluessel: string; titel: string; breite: number; zeile: boolean; standard: boolean; bool: boolean; editierbar: boolean; karte: string; refTyp: string | null; liste: boolean }
interface UnterrichtDto { id: number; nvpl: number; wst: number; zeilen: string[][] }
interface Antwort { titel: string; spalten: SpaltenInfo[]; unterrichte: UnterrichtDto[] }
export interface UZeile { id: string; uid: number; zeile: number; erste: boolean; anzahl: number; werte: string[]; nvpl: number; wst: number }

export default function Unterricht({ p }: AnsichtProps) {
  const a = useAnsicht();
  const sicht = SICHTEN[String(p.sicht)] ? String(p.sicht) : 'alle';
  const schreiben = useDarfSchreiben();
  const liste = useElemente(sicht === 'alle' ? null : sicht);
  const element = sicht === 'alle' ? null : ersterOder(liste, p.element);
  const [verknuepft, setVerknuepft] = useState(true);
  const tabelle = useRef<TabelleApi<UZeile>>(null);

  const bereit = sicht === 'alle' || element != null;
  const { daten, setDaten, laedt } = useDaten(async () => {
    const q = sicht === 'alle' ? '' : `?sicht=${sicht}&element=${element}`;
    return api.get<Antwort>(api.dok(`/unterricht${q}`));
  }, [sicht, element], { bereiche: ['Unterricht', 'Stundenplan', 'Stammdaten'], quelle: a.id, aktiv: bereit });

  const unterrichte = daten?.unterrichte || [];
  const zeilen = useMemo<UZeile[]>(() => unterrichte.flatMap((u) => u.zeilen.map((werte, i) => ({
    id: `${u.id}:${i}`, uid: u.id, zeile: i, erste: i === 0, anzahl: u.zeilen.length, werte, nvpl: u.nvpl, wst: u.wst,
  }))), [unterrichte]);

  const spaltenDef = daten?.spalten;
  const spalten = useMemo<Spalte<UZeile>[]>(() => (spaltenDef || []).map((s, i) => {
    const titel = SPALTENTITEL[s.schluessel] || s.titel;
    return {
      schluessel: s.schluessel, titel, hinweis: s.titel, breite: titelBreite(titel, s.breite), standard: s.standard, karteikarte: s.karte,
      art: s.bool ? 'Bool' : s.refTyp ? (s.liste ? 'ElementListe' : 'Element') : s.editierbar ? (s.schluessel === 'Wst' ? 'Ganzzahl' : 'Text') : 'NurLesen',
      ausrichtung: ['UNr', 'Nvpl', 'Wst', 'Jst', 'Wert'].includes(s.schluessel) ? 'rechts' : undefined,
      refTyp: s.refTyp || undefined, editierbar: s.editierbar && schreiben,
      editierbarFuer: (z) => s.editierbar && schreiben && (s.zeile || z.erste),
      wert: s.schluessel === 'KlLe' ? (z) => (z.erste ? String(z.werte[i] ?? '').replace(/^⊞\s*/, '') : '') : (z) => (s.zeile || z.erste ? z.werte[i] : ''),
      farbe: s.schluessel === 'Nvpl' ? (z) => (z.erste && z.nvpl > 0 ? 'var(--up-warnung-flaeche)' : null) : undefined,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [spaltenDef, schreiben]);

  const ersetzen = (u: UnterrichtDto) => setDaten((d) => (d ? { ...d, unterrichte: d.unterrichte.some((x) => x.id === u.id) ? d.unterrichte.map((x) => (x.id === u.id ? u : x)) : [...d.unterrichte, u] } : d));
  const entfernen = (ids: number[]) => setDaten((d) => (d ? { ...d, unterrichte: d.unterrichte.filter((u) => !ids.includes(u.id)) } : d));

  useEffect(() => { if (element != null && p.element !== element) a.parameterSetzen({ element }); }, [element]); // eslint-disable-line react-hooks/exhaustive-deps
  useEreignis('element', (e) => { if (verknuepft && e.quelle !== a.id && e.typ === sicht && e.id !== element) a.parameterSetzen({ element: e.id }); });

  const aktuell = () => tabelle.current?.aktiveZeile() ?? null;

  async function zeileNeu() {
    const z = aktuell();
    if (!z) { hinweis('Bitte zuerst den Unterricht wählen.', 'warnung'); return; }
    const u = await api.post<UnterrichtDto>(api.dok(`/unterricht/${z.uid}/zeilen`), {}, { quelle: a.id });
    ersetzen(u);
    setTimeout(() => tabelle.current?.waehle(`${u.id}:${u.zeilen.length - 1}`, 'Lehrer'));
    hinweis(`Kopplungszeile zu Unterricht Nr. ${u.id} angelegt – jetzt die Lehrkraft eintragen.`, 'ok');
  }
  async function zeileLoeschen() {
    const z = aktuell();
    if (!z || z.anzahl <= 1) { hinweis('Bitte eine Kopplungszeile eines gekoppelten Unterrichts wählen.', 'warnung'); return; }
    ersetzen(await api.loeschen<UnterrichtDto>(api.dok(`/unterricht/${z.uid}/zeilen/${z.zeile}`), { quelle: a.id }));
  }
  async function kopieren() {
    const z = aktuell();
    if (!z) return;
    const u = await api.post<UnterrichtDto>(api.dok(`/unterricht/${z.uid}/kopieren`), {}, { quelle: a.id });
    ersetzen(u);
    setTimeout(() => tabelle.current?.waehle(`${u.id}:0`));
  }
  async function loeschen() {
    const ids = [...new Set((tabelle.current?.ausgewaehlte() || []).map((z) => z.uid))];
    if (!ids.length) return;
    if (!(await frage(ids.length === 1 ? 'Unterricht samt verplanter Stunden löschen?' : `${ids.length} Unterrichte samt verplanter Stunden löschen?`, { ja: 'Löschen', gefahr: true }))) return;
    await api.post(api.dok('/unterricht/loeschen'), { ids }, { quelle: a.id });
    entfernen(ids);
    hinweis(`${ids.length === 1 ? 'Unterricht' : `${ids.length} Unterrichte`} gelöscht – Strg+Z macht das Löschen rückgängig.`, 'ok');
  }
  async function online() {
    const z = aktuell();
    if (!z) { hinweis('Bitte zuerst den Unterricht wählen.', 'warnung'); return; }
    if (await onlineDialog(z.uid, a.id)) {
      const q = sicht === 'alle' ? '' : `?sicht=${sicht}&element=${element}`;
      setDaten(await api.get<Antwort>(api.dok(`/unterricht${q}`)));
    }
  }

  const wst = unterrichte.reduce((x, u) => x + u.wst, 0), nv = unterrichte.reduce((x, u) => x + u.nvpl, 0);
  const spaltenMenue = () => tabelle.current?.spaltenMenue(window.innerWidth / 2 - 100, 180);
  const titel = daten?.titel ? (sicht === 'alle' ? 'Alle Unterrichte' : `${daten.titel.replace(/^(\S+) (\S+) \(\1 \2\)/, '$1 $2')} – Unterricht`) : 'Unterricht';

  return (
    <AnsichtRahmen titel={titel} laden={laedt && !daten}
      werkzeuge={<>
        {sicht !== 'alle' ? <><ElementAuswahl typ={sicht} liste={liste} wert={element} beiWahl={(id) => { a.parameterSetzen({ element: id }); melden('element', { typ: sicht, id, quelle: a.id }); }} /><Trenner /></> : null}
        {schreiben ? <>
          <Werkzeug text="Neu" titel="Neuer Unterricht" aktion={() => { tabelle.current?.waehle('__neu', 'Fach'); tabelle.current?.fokus(); tabelle.current?.bearbeiten(); }} />
          <Werkzeug text="Kopplungszeile" titel="Kopplungszeile hinzufügen (weitere Lehrkraft bzw. Gruppe)" aktion={zeileNeu} />
          <Werkzeug text="Löschen" titel="Markierten Unterricht löschen (Entf)" aktion={loeschen} />
          <Trenner />
        </> : null}
        {sicht !== 'alle' ? <Werkzeug text="Stundenplan" titel="Stundenplan des Elements öffnen" aktion={() => a.oeffnen('stundenplan', { typ: sicht, element })} /> : null}
        <Werkzeug text="Online" titel="Findet online statt: Unterricht regelmäßig online, Link" aktion={online} />
        <MenueKnopf text="Weitere Aktionen" eintraege={() => [
          schreiben ? { text: 'Kopplungszeile löschen', aktion: zeileLoeschen } : undefined,
          schreiben ? { text: 'Unterricht kopieren', aktion: kopieren } : undefined,
          { text: 'Findet online statt …', aktion: online },
          { text: 'Zeitwünsche des Unterrichts', aktion: () => { const z = aktuell(); if (z) a.oeffnen('zeitwuensche', { typ: 'unterricht', element: z.uid }); } },
          null,
          { text: 'Spalten ein- und ausblenden …', aktion: spaltenMenue },
          { text: 'Spaltenbreiten anpassen', aktion: () => tabelle.current?.spaltenAnpassen() },
        ]} />
        {sicht !== 'alle' ? <Rechts><Schalter text="Auswahl folgen" an={verknuepft} beiAenderung={setVerknuepft} titel="Zeigt das Element, das in einer anderen Ansicht gewählt wird" /></Rechts> : null}
      </>}
      fuss={<>
        <span>{unterrichte.length} {unterrichte.length === 1 ? 'Unterricht' : 'Unterrichte'}</span>
        <span>{wst} Wochenstunden</span>
        <span>{nv} nicht verplant</span>
        <FussText rechts>{schreiben ? 'Mehrere Klassen durch Komma trennen · weitere Lehrkraft als Kopplungszeile' : 'Nur lesen'}</FussText>
      </>}>
      <Tabelle<UZeile> ref={tabelle} name="unterricht" spalten={spalten} zeilen={zeilen} zustandSchluessel="tabelle.unterricht"
        gruppiert={(z) => z.uid} zeilenKlasse={(z) => (z.erste ? 'gruppe-anfang' : 'gruppe-folge')}
        leerText={sicht === 'alle' ? 'Es ist noch kein Unterricht erfasst.' : 'Für dieses Element ist noch kein Unterricht erfasst.'}
        neuText={schreiben ? 'Neuer Unterricht …' : undefined}
        neu={schreiben ? async (s, wert) => {
          const u = await api.post<UnterrichtDto>(api.dok('/unterricht'), { sicht, element, werte: { [s.schluessel]: wert } }, { quelle: a.id });
          ersetzen(u);
          setTimeout(() => tabelle.current?.waehle(`${u.id}:0`, s.schluessel));
          hinweis(`Unterricht Nr. ${u.id} angelegt – Strg+Z macht die Anlage rückgängig.`, 'ok');
        } : undefined}
        aendern={schreiben ? async (z, s, wert) => ersetzen(await api.patch<UnterrichtDto>(api.dok(`/unterricht/${z.uid}`), { feld: s.schluessel, wert, zeile: z.zeile }, { quelle: a.id })) : undefined}
        optionen={async (s) => (s.refTyp === 'raum' ? [...await elemente('raum'), ...await elemente('raumgruppe')] : elemente(s.refTyp || ''))}
        beiAuswahl={(_, aktiv) => { if (aktiv) melden('unterricht', { id: aktiv.uid, quelle: a.id }); }}
        beiEntf={() => void loeschen()}
        kontextmenue={() => [
          { text: 'Kopplungszeile hinzufügen', aktion: zeileNeu, deaktiviert: !schreiben },
          { text: 'Kopplungszeile löschen', aktion: zeileLoeschen, deaktiviert: !schreiben },
          { text: 'Unterricht kopieren', aktion: kopieren, deaktiviert: !schreiben },
          { text: 'Findet online statt …', aktion: online },
          { text: 'Unterricht löschen', taste: 'Entf', aktion: loeschen, deaktiviert: !schreiben },
        ]} />
    </AnsichtRahmen>
  );
}
