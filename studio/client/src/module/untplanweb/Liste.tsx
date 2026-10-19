// Aus EduOrga Web übernommene Listen: Fehlzeiten der Schüler bzw. Klassenbuch (nur lesen), mit Klassenfilter und Suche.
import { Input } from '@fluentui/react-components';
import { useMemo, useState } from 'react';
import { api } from '@/api/client';
import { useAnsicht } from '@/kern/ansichten';
import { useDaten } from '@/kern/laden';
import { AnsichtRahmen, Feld, FussText } from '@/komponenten/ansicht';
import { Tabelle } from '@/komponenten/tabelle/Tabelle';
import { SuchAuswahl } from '@/komponenten/suchauswahl';

type Z = Record<string, string | number> & { id: number };

const LISTEN: Record<string, { titel: string; spalten: [string, string, number][] }> = {
  schuelerabwesenheiten: {
    titel: 'Fehlzeiten der Schüler aus EduOrga Web',
    spalten: [['datum', 'Datum', 85], ['stunde', 'Std.', 45], ['klasse', 'Klasse', 60], ['name', 'Name', 170], ['art', 'Art', 110], ['status', 'Status', 100], ['fach', 'Fach', 60], ['lehrer', 'Lehrkraft', 70], ['bemerkung', 'Bemerkung', 200]],
  },
  klassenbuch: {
    titel: 'Klassenbuch aus EduOrga Web',
    spalten: [['datum', 'Datum', 85], ['stunde', 'Std.', 45], ['klassen', 'Klasse(n)', 80], ['fach', 'Fach', 60], ['lehrer', 'Lehrkraft', 70], ['lehrstoff', 'Lehrstoff', 220], ['hausaufgabe', 'Hausaufgabe', 200], ['faellig', 'Fällig', 85], ['anwesenheit', 'Anwesenheit', 90]],
  },
};

const klassenVon = (z: Z) => String(z.klasse ?? z.klassen ?? '').split(',').filter(Boolean);

export default function UpwListe() {
  const a = useAnsicht();
  const art = a.p.art === 'klassenbuch' ? 'klassenbuch' : 'schuelerabwesenheiten';
  const def = LISTEN[art]!;
  const [suche, setSuche] = useState('');
  const [klasse, setKlasse] = useState('');
  const { daten, laedt } = useDaten(async () => (await api.get<Record<string, string | number>[]>(api.dok(`/untplanweb/${art}`))).map((z, i) => ({ ...z, id: i }) as Z), [art], { bereiche: ['Vertretung'] });
  const alle = daten || [];
  const klassen = useMemo(() => [...new Set(alle.flatMap(klassenVon))].sort((x, y) => x.localeCompare(y, 'de', { numeric: true })), [alle]);
  const liste = useMemo(() => {
    const s = suche.trim().toLowerCase();
    return alle.filter((z) => (!klasse || klassenVon(z).includes(klasse)) && (!s || Object.values(z).some((v) => String(v).toLowerCase().includes(s))));
  }, [alle, suche, klasse]);
  return (
    <AnsichtRahmen titel={def.titel} laden={laedt && !daten}
      filter={<>
        <Feld titel="Klasse">
          <SuchAuswahl size="small" breite={150} wert={klasse} title="Nur Einträge dieser Klasse anzeigen" ariaLabel="Klasse" beiWahl={(w) => setKlasse(w)}
            optionen={[{ wert: '', text: 'Alle Klassen' }, ...klassen.map((k) => ({ wert: k, text: k }))]} />
        </Feld>
        <Input type="search" size="small" placeholder="Suchen" aria-label="Suchen" style={{ width: 200 }} value={suche} onChange={(_, d) => setSuche(d.value)} />
        <FussText rechts>Übernommen aus EduOrga Web; Änderungen bitte dort vornehmen.</FussText>
      </>}
      fuss={<span>{`${liste.length} von ${alle.length} Einträgen`}</span>}>
      <Tabelle<Z> name={`upw-${art}`} zeilen={liste} id={(z) => z.id} zustandSchluessel={`tabelle.untplanweb.${art}`} leerText="Keine übernommenen Einträge."
        spalten={def.spalten.map(([schluessel, titel, breite]) => ({ schluessel, titel, breite, art: 'NurLesen' as const }))} />
    </AnsichtRahmen>
  );
}
