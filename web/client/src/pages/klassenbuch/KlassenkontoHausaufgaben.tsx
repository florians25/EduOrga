// Klassenkonten ohne zugeordnete Person: offene Hausaufgaben und Unterrichtsinhalte der eigenen Klasse.
import { Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { holen } from '../../api/client';
import { useSitzung } from '../../app/sitzung';
import { Abschnitt, Geladen, Leer, Seite } from '../../components/Seite';
import { datumKurz, datumLang } from '../../lib/datum';
import { useLaden } from '../../lib/useLaden';
import { VerlaufTabelle, type VerlaufZeile } from './Klassenbuch';

interface Offen { faellig?: string; fach: string; hausaufgabe: string; datum: string; lehrer: string }

export default function KlassenkontoHausaufgaben() {
  const { ich } = useSitzung();
  const klasse = ich.element;
  const g = useLaden(() => Promise.all([holen<Offen[]>(`/api/app/klassenbuch/hausaufgaben?klasse=${encodeURIComponent(klasse)}`), holen<VerlaufZeile[]>(`/api/app/klassenbuch/klasse?klasse=${encodeURIComponent(klasse)}`)]), [klasse]);
  if (!klasse) return <Seite titel="Hausaufgaben"><Leer text="Ihrem Konto ist keine Klasse zugeordnet." /></Seite>;
  return (
    <Seite titel="Hausaufgaben" untertitel={`Klasse ${klasse}`}>
      <Geladen g={g}>{([ha, verlauf]) => (
        <Stack gap={2.5}>
          <Abschnitt titel="Offene Hausaufgaben">
            {ha.length ? <Table size="small"><TableHead><TableRow><TableCell>Fällig</TableCell><TableCell>Fach</TableCell><TableCell>Aufgabe</TableCell><TableCell>Gestellt</TableCell></TableRow></TableHead>
              <TableBody>{ha.map((x, i) => <TableRow key={i}><TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{x.faellig ? datumLang(x.faellig) : '–'}</TableCell><TableCell>{x.fach}</TableCell><TableCell>{x.hausaufgabe}</TableCell>
                <TableCell><Typography variant="body2" color="text.secondary">{datumKurz(x.datum)} · {x.lehrer}</Typography></TableCell></TableRow>)}</TableBody></Table> : <Leer text="Keine offenen Hausaufgaben." />}
          </Abschnitt>
          <Abschnitt titel="Unterrichtsinhalte"><VerlaufTabelle liste={verlauf} kollegium={false} /></Abschnitt>
        </Stack>
      )}</Geladen>
    </Seite>
  );
}
