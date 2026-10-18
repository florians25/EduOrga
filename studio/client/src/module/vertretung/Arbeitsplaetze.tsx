// Arbeitsplätze der Vertretungsplanung.
import { Bereich, Teilung } from '@/shell/arbeitsplatz';
import { aktuelleAuswahl } from './kern';

/** Tagesplanung: Kalender und Abwesenheiten links, Vertretungen und Vorschlag in der Mitte, Tagespläne rechts. */
export function Tagesplanung() {
  return (
    <Teilung schluessel="tagesplanung" anteile={[27, 45, 28]}>
      <Teilung richtung="zeilen" schluessel="tagesplanung.links" anteile={[38, 62]}>
        <Bereich id="kalender" typ="vertretung.kalender" />
        <Bereich id="absenzen" typ="vertretung.absenzen" />
      </Teilung>
      <Teilung richtung="zeilen" schluessel="tagesplanung.mitte" anteile={[55, 45]}>
        <Bereich id="liste" typ="vertretung.liste" />
        <Bereich id="vorschlag" typ="vertretung.vorschlag" />
      </Teilung>
      <Teilung richtung="zeilen" schluessel="tagesplanung.rechts" anteile={[50, 50]}>
        <Bereich id="plan-klasse" typ="vertretung.plan" p={{ typ: 'klasse' }} />
        <Bereich id="plan-lehrer" typ="vertretung.plan" p={{ typ: 'lehrer' }} />
      </Teilung>
    </Teilung>
  );
}

/** Verlegen und Tauschen: Klassen- und Lehrkräfteplan tagesaktuell nebeneinander (Drag & Drop zwischen beiden). */
export function Verlegen() {
  const a = aktuelleAuswahl()?.zeile;
  return (
    <Teilung schluessel="verlegen" anteile={[50, 50]}>
      <Bereich id="klasse" typ="vertretung.plan" p={{ typ: 'klasse', element: a?.klasse ?? undefined }} />
      <Bereich id="lehrer" typ="vertretung.plan" p={{ typ: 'lehrer', element: a?.lehrer ?? undefined }} />
    </Teilung>
  );
}

/** Kompaktpläne: Vertretungen links, kleine Pläne von Klasse, Lehrkraft, Vertretung und Raum der gewählten Vertretung. */
export function Kompakt() {
  return (
    <Teilung schluessel="kompakt" anteile={[40, 15, 15, 15, 15]}>
      <Bereich id="liste" typ="vertretung.liste" />
      <Bereich id="klasse" typ="vertretung.plan" p={{ typ: 'klasse', kompakt: true }} />
      <Bereich id="lehrer" typ="vertretung.plan" p={{ typ: 'lehrer', kompakt: true }} />
      <Bereich id="vertreter" typ="vertretung.plan" p={{ typ: 'lehrer', rolle: 'vertreter', kompakt: true }} />
      <Bereich id="raum" typ="vertretung.plan" p={{ typ: 'raum', kompakt: true }} />
    </Teilung>
  );
}
