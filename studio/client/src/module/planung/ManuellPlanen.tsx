// Arbeitsplatz „Manuell planen“: Unterricht links, Klassenplan rechts (Stunden aus „Nicht verplant“ in den Plan ziehen).
import { Bereich, Teilung } from '@/shell/arbeitsplatz';

export default function ManuellPlanen() {
  return (
    <Teilung schluessel="manuell" anteile={[45, 55]}>
      <Bereich id="unterricht" typ="unterricht" p={{ sicht: 'klasse' }} />
      <Bereich id="plan" typ="stundenplan" p={{ typ: 'klasse' }} />
    </Teilung>
  );
}
