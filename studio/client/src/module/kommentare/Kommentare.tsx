// Kommentare: Liste aller Kommentare (bzw. die eines Elements), Anlegen, Bearbeiten, Löschen, Element zeigen.
import { SearchBox } from '@fluentui/react-components';
import { useMemo, useRef, useState } from 'react';
import { api } from '@/api/client';
import { useAnsicht, type AnsichtProps } from '@/kern/ansichten';
import { useDaten } from '@/kern/laden';
import { useDarfSchreiben } from '@/kern/zustand';
import { AnsichtRahmen, Rechts, Trenner, Werkzeug } from '@/komponenten/ansicht';
import { frage } from '@/komponenten/dialoge';
import { hinweis } from '@/komponenten/hinweise';
import { Tabelle, type Spalte, type TabelleApi } from '@/komponenten/tabelle/Tabelle';
import { kommentarDialog, kommentarNeu, type Kommentar } from './dialog';

export default function Kommentare({ p }: AnsichtProps) {
  const a = useAnsicht();
  const schreiben = useDarfSchreiben();
  const tabelle = useRef<TabelleApi<Kommentar>>(null);
  const [filter, setFilter] = useState('');
  const nurElement = p.typ && p.element ? { typ: String(p.typ), element: Number(p.element) } : null;
  const { daten, setDaten } = useDaten(() => api.get<Kommentar[]>(api.dok('/kommentare')), [], { bereiche: ['Stammdaten', 'Einstellungen'], quelle: a.id });
  const alle = daten || [];
  const liste = useMemo(() => alle.filter((z) => (!nurElement || (z.typ === nurElement.typ && z.element === nurElement.element))
    && (!filter || [z.kategorieName, z.typName, z.elementName, z.feld, z.text].some((w) => String(w ?? '').toLowerCase().includes(filter)))), [alle, filter, nurElement?.typ, nurElement?.element]); // eslint-disable-line react-hooks/exhaustive-deps
  const spalten: Spalte<Kommentar>[] = [
    { schluessel: 'kategorieName', titel: 'Kategorie', breite: 120, art: 'NurLesen', farbe: (z) => (z.farbe ? `color-mix(in srgb, ${z.farbe} 35%, var(--colorNeutralBackground1))` : null) },
    { schluessel: 'typName', titel: 'Art', breite: 90, art: 'NurLesen' }, { schluessel: 'elementName', titel: 'Element', breite: 100, art: 'NurLesen' },
    { schluessel: 'feld', titel: 'Feld', breite: 110, art: 'NurLesen' }, { schluessel: 'text', titel: 'Kommentar', breite: 420, art: 'NurLesen' },
    { schluessel: 'erstellt', titel: 'Erstellt', breite: 130, art: 'NurLesen' },
  ];
  const neu = async () => { const l = await kommentarNeu(nurElement || {}); if (l) setDaten(l); };
  const bearbeiten = async (z = tabelle.current?.aktiveZeile()) => {
    if (!z || !schreiben) return;
    const e = await kommentarDialog(z, 'Kommentar bearbeiten');
    if (e) setDaten(await api.put<Kommentar[]>(api.dok(`/kommentare/${z.id}`), e, { quelle: a.id }));
  };
  const loeschen = async () => {
    const z = tabelle.current?.ausgewaehlte() || [];
    if (!z.length || !(await frage(z.length === 1 ? 'Kommentar löschen?' : `${z.length} Kommentare löschen?`, { ja: 'Löschen', gefahr: true }))) return;
    setDaten(await api.post<Kommentar[]>(api.dok('/kommentare/loeschen'), { ids: z.map((x) => x.id) }, { quelle: a.id }));
    hinweis('Gelöscht – Strg+Z macht das Löschen rückgängig.', 'ok');
  };
  const zeigen = (z = tabelle.current?.aktiveZeile()) => { if (z) a.oeffnen('stammdaten', { typ: z.typ, element: z.element }); };
  return (
    <AnsichtRahmen titel={nurElement && liste[0] ? `Kommentare – ${liste[0].elementName}` : 'Kommentare'}
      werkzeuge={<>
        {schreiben ? <>
          <Werkzeug text="Neu" titel="Kommentar anlegen" aktion={neu} />
          <Werkzeug text="Bearbeiten" titel="Markierten Kommentar bearbeiten (Doppelklick)" aktion={() => bearbeiten()} />
          <Werkzeug text="Löschen" titel="Markierte Kommentare löschen (Entf)" aktion={loeschen} />
          <Trenner />
        </> : null}
        <Werkzeug text="Element zeigen" titel="Element des Kommentars in den Stammdaten zeigen" aktion={() => zeigen()} />
        {nurElement ? <Werkzeug text="Alle Kommentare" titel="Kommentare aller Elemente zeigen" aktion={() => a.parameterSetzen({ typ: undefined, element: undefined })} /> : null}
        <Rechts><SearchBox size="small" placeholder="Kommentare durchsuchen" value={filter} onChange={(_, d) => setFilter(d.value.trim().toLowerCase())} style={{ width: 240 }} aria-label="Suchen" /></Rechts>
      </>}
      fuss={<><span>{alle.length} {alle.length === 1 ? 'Kommentar' : 'Kommentare'}</span>{liste.length !== alle.length ? <span>{liste.length} angezeigt</span> : null}</>}>
      <Tabelle<Kommentar> ref={tabelle} name="kommentare" spalten={spalten} zeilen={liste} zustandSchluessel="tabelle.kommentare" leerText="Es sind noch keine Kommentare erfasst."
        beiDoppelklick={(z) => void bearbeiten(z)} beiEntf={() => void loeschen()}
        kontextmenue={(zeilen) => [
          { text: 'Kommentar anlegen …', aktion: neu, deaktiviert: !schreiben },
          { text: 'Bearbeiten …', aktion: () => bearbeiten(zeilen[0]), deaktiviert: !zeilen.length || !schreiben },
          { text: 'Löschen', taste: 'Entf', aktion: loeschen, deaktiviert: !zeilen.length || !schreiben },
          null,
          { text: 'Element in den Stammdaten zeigen', aktion: () => zeigen(zeilen[0]), deaktiviert: !zeilen.length },
        ]} />
    </AnsichtRahmen>
  );
}
