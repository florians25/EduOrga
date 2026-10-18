// Stammdaten-Ansicht: Tabelle mit allen Feldern, Inline-Bearbeitung, Neuanlage-Zeile, Löschen, Suchen.
import { SearchBox } from '@fluentui/react-components';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/api/client';
import { useAnsicht, type AnsichtProps } from '@/kern/ansichten';
import { melden, useEreignis } from '@/kern/ereignisse';
import { useDaten } from '@/kern/laden';
import { elemente, useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, FussText, Rechts, Trenner, Werkzeug } from '@/komponenten/ansicht';
import { formular, frage } from '@/komponenten/dialoge';
import { hinweis } from '@/komponenten/hinweise';
import { MenueKnopf } from '@/komponenten/menue';
import { Tabelle, type Spalte, type Spaltenart, type TabelleApi } from '@/komponenten/tabelle/Tabelle';
import { titelBreite } from '../gemeinsam';
import { TYPEN } from './elementtypen';

/** Anzeigenamen der Felder, deren Server-Titel abgekürzt sind (Schlüssel: Titel vom Server). */
const FELDTITEL: Record<string, string> = {
  'Fix (X)': 'Fixiert', 'Ignore (i)': 'Ignorieren', 'Statistik-Kennz.': 'Statistikkennzeichen', 'HohlStd. soll': 'Hohlstunden (Soll)',
  'Std./Tag': 'Stunden je Tag', 'Mitt-pause': 'Mittagspause', 'max. Nachm.': 'Nachmittage (max.)', 'Soll (abzgl. Erm.)': 'Soll nach Ermäßigung',
  'Ist (Wert)': 'Ist', 'Pers.-Nr.': 'Personalnummer', 'Vtr. max/Woche': 'Vertretungen je Woche (max.)', 'Vtr. max/Monat': 'Vertretungen je Monat (max.)',
  'Aufs. max. Minuten': 'Aufsicht (max. Minuten)', 'Sperrvermerk (0-9)': 'Sperrvermerk', 'Hauptf./Tag': 'Hauptfächer je Tag',
  'Hauptf.Folge': 'Hauptfächer in Folge', Klassenlehrer: 'Klassenleitung', 'Raumgew.': 'Raumgewicht', 'Kapaz.': 'Plätze', 'buchbar (Web)': 'Buchbar',
  'Dopp.Std.': 'Doppelstunden', '(M) mehrmals/Tag': 'Mehrmals am Tag', '(R) Randstunde': 'Randstunde', '(N) kein Nachm.': 'Kein Nachmittag',
  '(B) Bereitschaft': 'Bereitschaft', 'Bereitsch. im Deputat': 'Bereitschaft im Deputat', von: 'Von', bis: 'Bis',
};

interface Feld { schluessel: string; titel: string; karteikarte: string; art: Spaltenart; refTyp: string | null; auswahl: string[]; standard: boolean; breite: number; editierbar: boolean; hinweis: string }
export interface StammZeile { id: number; werte: string[]; hintergrund?: string | null }
interface Antwort { felder: Feld[]; zeilen: StammZeile[] }

export default function Stammdaten({ p }: AnsichtProps) {
  const a = useAnsicht();
  const typ = String(p.typ || 'lehrer');
  const info = TYPEN[typ] || TYPEN.lehrer!;
  const schreiben = useDarfSchreiben();
  const pfad = (x = '') => api.dok(`/stammdaten/${typ}${x}`);
  const tabelle = useRef<TabelleApi<StammZeile>>(null);
  const [filter, setFilter] = useState('');
  const [markiert, setMarkiert] = useState(0);
  const { daten, setDaten, laedt } = useDaten(() => api.get<Antwort>(pfad()), [typ], { bereiche: ['Stammdaten', 'Unterricht'], quelle: a.id });
  const alle = daten?.zeilen || [];

  const spalten = useMemo<Spalte<StammZeile>[]>(() => (daten?.felder || []).map((x, i) => {
    const titel = FELDTITEL[x.titel] || x.titel;
    return {
      schluessel: x.schluessel, titel, breite: FELDTITEL[x.titel] ? titelBreite(titel, x.breite) : x.breite,
      art: x.editierbar ? x.art : 'NurLesen', editierbar: x.editierbar && schreiben, auswahl: x.auswahl, refTyp: x.refTyp || undefined,
      standard: x.standard, karteikarte: x.karteikarte, hinweis: x.hinweis || (FELDTITEL[x.titel] ? x.titel : undefined),
      wert: (z) => z.werte[i],
      farbe: x.schluessel === 'Kurzname' ? (z) => (z.hintergrund ? `color-mix(in srgb, ${z.hintergrund} 40%, var(--colorNeutralBackground1))` : null) : undefined,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [daten?.felder, schreiben]);

  const gefiltert = useMemo(() => (filter ? alle.filter((z) => z.werte.some((w) => w.toLowerCase().includes(filter))) : alle), [alle, filter]);

  const ersetzen = (z: StammZeile) => setDaten((d) => (d ? { ...d, zeilen: d.zeilen.some((x) => x.id === z.id) ? d.zeilen.map((x) => (x.id === z.id ? z : x)) : [...d.zeilen, z] } : d));

  // gewähltes Element aus der Adresse
  const gewaehltGesetzt = useRef(false);
  useEffect(() => {
    if (gewaehltGesetzt.current || !daten || p.element == null) return;
    gewaehltGesetzt.current = true;
    setTimeout(() => tabelle.current?.waehle(Number(p.element)));
  }, [daten, p.element]);
  useEffect(() => { setTimeout(() => tabelle.current?.fokus(), 80); }, []);

  useEreignis('element', (e) => { if (e.quelle !== a.id && e.typ === typ) tabelle.current?.waehle(e.id); });

  async function neuAnlegen(spalte: Spalte<StammZeile> | null, wert: string) {
    let kurzname = wert;
    let werte: Record<string, string> | undefined;
    if (!spalte || spalte.schluessel !== 'Kurzname') {
      const w = await formular(`${info.einzahl} anlegen`, [{ name: 'kurzname', titel: 'Kurzname', pflicht: true }], { okText: 'Anlegen' });
      if (!w) return;
      kurzname = w.kurzname;
      if (spalte && wert) werte = { [spalte.schluessel]: wert };
    }
    const z = await api.post<StammZeile>(pfad(), { kurzname, werte }, { quelle: a.id });
    ersetzen(z);
    setTimeout(() => tabelle.current?.waehle(z.id, spalte?.schluessel));
    hinweis(`${info.einzahl} „${kurzname}“ angelegt.`, 'ok', 2000);
  }

  async function loeschen() {
    const zeilen = tabelle.current?.ausgewaehlte() || [];
    if (!zeilen.length) return;
    const ids = zeilen.map((z) => z.id);
    let text = zeilen.length === 1 ? `${info.einzahl} „${zeilen[0]!.werte[0]}“ löschen?` : `${zeilen.length} ${info.titel} löschen?`;
    if (['klasse', 'lehrer', 'raum', 'fach'].includes(typ)) {
      const v = await api.get<{ unterrichte: number }>(pfad(`/verwendung?ids=${ids.join(',')}`));
      if (v.unterrichte) text += `\nAchtung: ${v.unterrichte} ${v.unterrichte === 1 ? 'Unterricht verwendet' : 'Unterrichte verwenden'} ${zeilen.length === 1 ? 'dieses Element' : 'diese Elemente'}; die Verweise werden entfernt.`;
    }
    if (!(await frage(text, { ja: 'Löschen', gefahr: true }))) return;
    await api.post(pfad('/loeschen'), { ids }, { quelle: a.id });
    setDaten((d) => (d ? { ...d, zeilen: d.zeilen.filter((z) => !ids.includes(z.id)) } : d));
    hinweis(`${ids.length} gelöscht – Strg+Z macht das Löschen rückgängig.`, 'ok');
  }

  const aktivId = () => tabelle.current?.aktiveZeile()?.id;
  const spaltenMenueOeffnen = () => tabelle.current?.spaltenMenue(window.innerWidth / 2 - 100, 180);

  return (
    <AnsichtRahmen titel={info.titel} laden={laedt && !daten}
      werkzeuge={<>
        {schreiben ? <>
          <Werkzeug text="Neu" titel={`${info.einzahl} anlegen`} aktion={() => neuAnlegen(null, '')} />
          <Werkzeug text="Löschen" titel="Markierte Einträge löschen (Entf)" aktion={loeschen} />
          <Trenner />
        </> : null}
        {['klasse', 'lehrer', 'fach'].includes(typ) ? <Werkzeug text="Unterricht" titel="Unterricht des markierten Elements" aktion={() => a.oeffnen('unterricht', { sicht: typ, element: aktivId() })} /> : null}
        {['klasse', 'lehrer', 'raum', 'fach'].includes(typ) ? <Werkzeug text="Stundenplan" titel="Stundenplan des markierten Elements" aktion={() => a.oeffnen('stundenplan', { typ, element: aktivId() })} /> : null}
        <MenueKnopf text="Weitere Aktionen" eintraege={() => [
          { text: 'Spalten ein- und ausblenden …', aktion: spaltenMenueOeffnen },
          { text: 'Spaltenbreiten an den Inhalt anpassen', aktion: () => tabelle.current?.spaltenAnpassen() },
        ]} />
        <Rechts><SearchBox size="small" placeholder={`${info.titel} durchsuchen`} value={filter} onChange={(_, d) => setFilter(d.value.trim().toLowerCase())} style={{ width: 240 }} aria-label="Suchen" /></Rechts>
      </>}
      fuss={<>
        <span>{alle.length} {info.titel}</span>
        {markiert > 1 ? <span>{markiert} markiert</span> : null}
        <FussText rechts>{schreiben ? 'Enter oder F2 bearbeiten · Strg+C/Strg+V kopieren und einfügen · Entf leert die Zelle' : 'Nur lesen'}</FussText>
      </>}>
      <Tabelle<StammZeile> ref={tabelle} name={`stammdaten-${typ}`} spalten={spalten} zeilen={gefiltert} zustandSchluessel={`tabelle.stammdaten.${typ}`}
        leerText={`Es sind noch keine ${info.titel} erfasst.`}
        neuText={schreiben ? 'Neu: Kurzname eingeben …' : undefined}
        neu={schreiben ? (s, w) => neuAnlegen(s, w) : undefined}
        aendern={schreiben ? async (z, s, wert) => ersetzen(await api.patch<StammZeile>(pfad(`/${z.id}`), { feld: s.schluessel, wert }, { quelle: a.id })) : undefined}
        aendernMehrere={schreiben ? async (liste) => {
          const zeilen = await api.post<StammZeile[]>(pfad('/aendern'), { aenderungen: liste.map((x) => ({ id: x.zeile.id, feld: x.spalte.schluessel, wert: x.wert })) }, { quelle: a.id });
          for (const z of zeilen) ersetzen(z);
        } : undefined}
        optionen={(s) => elemente(s.refTyp || '')}
        beiAuswahl={(zeilen, aktiv) => {
          setMarkiert(zeilen.length);
          if (aktiv) melden('element', { typ, id: aktiv.id, quelle: a.id });
        }}
        beiEntf={() => void loeschen()}
        kontextmenue={(zeilen) => [
          { text: `${info.einzahl} anlegen …`, aktion: () => neuAnlegen(null, ''), deaktiviert: !schreiben },
          { text: `${zeilen.length > 1 ? `${zeilen.length} Einträge` : 'Eintrag'} löschen`, taste: 'Entf', aktion: loeschen, deaktiviert: !zeilen.length || !schreiben },
          null,
          ['klasse', 'lehrer', 'fach'].includes(typ) ? { text: 'Unterricht', aktion: () => a.oeffnen('unterricht', { sicht: typ, element: zeilen[0]?.id }) } : undefined,
          ['klasse', 'lehrer', 'raum', 'fach'].includes(typ) ? { text: 'Stundenplan', aktion: () => a.oeffnen('stundenplan', { typ, element: zeilen[0]?.id }) } : undefined,
          { text: 'Kommentare', aktion: () => a.oeffnen('kommentare', { typ, element: zeilen[0]?.id }) },
          { text: 'Spalten ein- und ausblenden …', aktion: spaltenMenueOeffnen },
        ]} />
    </AnsichtRahmen>
  );
}
