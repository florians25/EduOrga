// Fachliche Gliederung der Seitenleiste. Einträge verweisen per ref auf die id eines Befehlseintrags der Module
// (Ziel, Untermenü und Rechte werden von dort übernommen) oder nennen ihr Ziel selbst. Die Befehlssuche (Strg+K) findet
// zusätzlich jeden weiteren Eintrag und Untermenüpunkt aller Module – keine Funktion geht verloren.
import { alleEintraege, eintrag, type Befehlseintrag, type Params } from '@/kern/befehle';
import type { Modus } from '@/kern/zustand';

export interface NavEintrag {
  ref?: string;
  text: string;
  hinweis?: string;
  ansicht?: Befehlseintrag['ansicht'];
  arbeitsplatz?: string;
  befehl?: string;
  args?: unknown;
  braucht?: Befehlseintrag['braucht'];
  menue?: Befehlseintrag['menue'];
}

export interface NavGruppe { id: string; titel: string; modus?: Modus; symbol: string; eintraege: NavEintrag[] }

export const NAVIGATION: NavGruppe[] = [
  {
    id: 'vertretung', titel: 'Vertretungsplanung', modus: 'vertretung', symbol: 'vertretung', eintraege: [
      { text: 'Tagesplanung', arbeitsplatz: 'tagesplanung', braucht: 'dokument', hinweis: 'Kalender, Abwesenheiten, Vertretungen, Vorschlag und Tagespläne zusammen' },
      { ref: 'vertretung.kalender', text: 'Kalender' },
      { ref: 'vertretung.absenzen', text: 'Abwesenheiten' },
      { ref: 'vertretung.vertretungen', text: 'Vertretungen' },
      { ref: 'vertretung.vorschlag', text: 'Vertretungsvorschlag' },
      { ref: 'vertretung.automatik', text: 'Automatische Vertretung' },
      { ref: 'vertretung.planungsdialog', text: 'Verlegen und Tauschen' },
      { ref: 'vertretung.vormerkungen', text: 'Vormerkungen' },
    ],
  },
  {
    id: 'ereignisse', titel: 'Ereignisse', modus: 'vertretung', symbol: 'ereignisse', eintraege: [
      { ref: 'vertretung.veranstaltungen', text: 'Veranstaltungen' },
      { ref: 'vertretung.sondereinsaetze', text: 'Sondereinsätze' },
      { ref: 'vertretung.bereitschaften', text: 'Bereitschaften' },
      { ref: 'eingabe.bereitschaft', text: 'Bereitschaftsplanung' },
      { ref: 'vertretung.pausenaufsichten', text: 'Pausenaufsichten' },
    ],
  },
  {
    id: 'tagesplaene', titel: 'Tagespläne', modus: 'vertretung', symbol: 'stundenplan', eintraege: [
      { ref: 'vertretung.plan.klasse', text: 'Klassen' },
      { ref: 'vertretung.plan.lehrer', text: 'Lehrkräfte' },
      { ref: 'vertretung.plan.raum', text: 'Räume' },
      { ref: 'vertretung.plan.klein', text: 'Kompaktpläne' },
    ],
  },
  {
    id: 'vertretung-ausgabe', titel: 'Auswertung und Ausgabe', modus: 'vertretung', symbol: 'ausgabe', eintraege: [
      { ref: 'vertretung.ausgabe', text: 'Vertretungsplan ausgeben' },
      { ref: 'vertretung.statistik', text: 'Statistik und Abrechnung' },
      { ref: 'vertretung.untplanweb', text: 'EduOrga Web' },
      { ref: 'vertretung.formate', text: 'Listenansichten' },
      { ref: 'vertretung.einstellungen', text: 'Einstellungen' },
    ],
  },
  {
    id: 'stammdaten', titel: 'Stammdaten', symbol: 'stammdaten', eintraege: [
      { ref: 'eingabe.klassen', text: 'Klassen' },
      { ref: 'eingabe.lehrer', text: 'Lehrkräfte' },
      { ref: 'eingabe.raeume', text: 'Räume' },
      { ref: 'eingabe.faecher', text: 'Fächer' },
      { ref: 'eingabe.schueler', text: 'Schülerinnen und Schüler' },
      { ref: 'eingabe.raumgruppen', text: 'Raumgruppen' },
      { ref: 'eingabe.gaenge', text: 'Gänge (Aufsichtsbereiche)' },
      { ref: 'eingabe.abteilungen', text: 'Abteilungen' },
      { ref: 'eingabe.gruende', text: 'Abwesenheitsgründe' },
      { ref: 'eingabe.kommentare', text: 'Kommentare' },
    ],
  },
  {
    id: 'unterricht', titel: 'Unterricht', modus: 'stundenplan', symbol: 'unterricht', eintraege: [
      { ref: 'eingabe.unterricht.klassen', text: 'Nach Klassen' },
      { ref: 'eingabe.unterricht.lehrer', text: 'Nach Lehrkräften' },
      { ref: 'eingabe.unterricht.faecher', text: 'Nach Fächern' },
      { ref: 'eingabe.unterricht.alle', text: 'Alle Unterrichte' },
      { ref: 'eingabe.zeitwuensche', text: 'Zeitwünsche' },
      { ref: 'planung.uzeitwuensche', text: 'Zeitwünsche je Unterricht' },
      { ref: 'eingabe.ugruppen', text: 'Unterrichtsgruppen' },
      { ref: 'eingabe.stundentafel', text: 'Stundentafel' },
      { ref: 'deputat.uebersicht', text: 'Deputat und Verteilung' },
    ],
  },
  {
    id: 'planung', titel: 'Planung', modus: 'stundenplan', symbol: 'planung', eintraege: [
      { text: 'Manuell planen', arbeitsplatz: 'manuell', braucht: 'dokument', hinweis: 'Unterricht und Klassenplan nebeneinander' },
      { ref: 'planung.optimierung', text: 'Automatische Planung' },
      { ref: 'planung.diagnose', text: 'Diagnose' },
      { ref: 'planung.gewichtung', text: 'Gewichtung' },
      { ref: 'planung.tausch', text: 'Tauschvorschläge' },
      { ref: 'planung.raum', text: 'Räume zuordnen' },
      { ref: 'planung.fixieren', text: 'Fixierungen' },
      { ref: 'planung.entplanen', text: 'Alle Stunden entplanen' },
    ],
  },
  {
    id: 'stundenplaene', titel: 'Stundenpläne', symbol: 'stundenplan', eintraege: [
      { ref: 'stundenplaene.klasse', text: 'Klassen' },
      { ref: 'stundenplaene.lehrer', text: 'Lehrkräfte' },
      { ref: 'stundenplaene.raum', text: 'Räume' },
      { ref: 'stundenplaene.fach', text: 'Fächer' },
      { ref: 'stundenplaene.block', text: 'Blockansicht' },
      { ref: 'stundenplaene.uebersicht.klasse', text: 'Gesamtübersicht Klassen' },
      { ref: 'stundenplaene.uebersicht.lehrer', text: 'Gesamtübersicht Lehrkräfte' },
      { ref: 'stundenplaene.uebersicht.raum', text: 'Gesamtübersicht Räume' },
      { text: 'Kompaktpläne', braucht: 'dokument', menue: [
        { text: 'Klassen kompakt', ansicht: { typ: 'stundenplan', p: { typ: 'klasse', kompakt: true } } },
        { text: 'Lehrkräfte kompakt', ansicht: { typ: 'stundenplan', p: { typ: 'lehrer', kompakt: true } } },
        { text: 'Räume kompakt', ansicht: { typ: 'stundenplan', p: { typ: 'raum', kompakt: true } } },
      ] },
      { ref: 'stundenplaene.formate', text: 'Planformate' },
    ],
  },
  {
    id: 'kursplanung', titel: 'Oberstufe', modus: 'stundenplan', symbol: 'oberstufe', eintraege: [
      { ref: 'kurs.kurse', text: 'Kurse und Bänder' },
      { ref: 'kurs.schueler', text: 'Schülerinnen und Schüler' },
      { ref: 'kurs.import', text: 'Kurswahlen importieren' },
    ],
  },
  {
    id: 'auswertung', titel: 'Auswertung', modus: 'stundenplan', symbol: 'auswertung', eintraege: [
      { ref: 'module.sollist', text: 'Soll und Ist' },
      { ref: 'module.matrix', text: 'Unterrichtsmatrix' },
      { ref: 'module.statistik', text: 'Vertretungsstatistik' },
      { ref: 'start.pausenaufsichten', text: 'Pausenaufsichten' },
    ],
  },
  {
    id: 'ausgabe', titel: 'Ausgabe', symbol: 'ausgabe', eintraege: [
      { ref: 'start.berichte', text: 'Drucken' },
      { ref: 'stundenplaene.berichte', text: 'Berichte und Listen' },
      { ref: 'stundenplaene.html', text: 'Aushang (HTML)' },
      { ref: 'stundenplaene.ical', text: 'Kalenderdateien (iCal)' },
    ],
  },
  {
    id: 'austausch', titel: 'Datenaustausch', symbol: 'austausch', eintraege: [
      { ref: 'eingabe.importexport', text: 'Import und Export' },
      { ref: 'start.untplanweb', text: 'EduOrga Web' },
      { ref: 'eingabe.bal', text: 'BAL-Import' },
    ],
  },
  {
    id: 'schule', titel: 'Schule', symbol: 'schule', eintraege: [
      { ref: 'start.einstellungen', text: 'Schuldaten' },
      { ref: 'eingabe.zeitraster', text: 'Zeitraster' },
      { ref: 'eingabe.ferien', text: 'Ferien und Kalender' },
      { ref: 'start.perioden', text: 'Perioden' },
      { ref: 'start.multiuser', text: 'Mehrbenutzerbetrieb' },
    ],
  },
];

/** Aufgelöster Navigationseintrag (mit den Angaben des Modul-Eintrags). */
export interface NavPunkt extends Befehlseintrag { gruppe: string }

/** Navigationseintrag mit den Angaben des Modul-Eintrags zusammenführen. */
export function aufloesen(n: NavEintrag, gruppe: string): NavPunkt | null {
  const r = n.ref ? eintrag(n.ref) : undefined;
  if (n.ref && !r) return null;
  const e: NavPunkt = { ...(r || {}), ...n, id: n.ref || `nav:${n.text}`, text: n.text, gruppe } as NavPunkt;
  const eigenesZiel = n.ansicht || n.arbeitsplatz || n.befehl;
  if (r && !eigenesZiel) { e.ansicht = r.ansicht; e.arbeitsplatz = r.arbeitsplatz; e.befehl = r.befehl; e.args = r.args; e.aktion = r.aktion; }
  if (r && !n.menue) e.menue = r.menue;
  if (r && !n.braucht) e.braucht = r.braucht;
  // Hauptziel direkt, Untermenü nur in der Suche
  if ((e.ansicht || e.arbeitsplatz || e.befehl || e.aktion) && !n.menue) e.menue = undefined;
  return e;
}

export const sichtbar = (g: NavGruppe, modus: Modus) => !g.modus || g.modus === modus;

/** Gehört der Eintrag zur gezeigten Seite? (gleiche Ansicht und gleiche Parameter) */
export function passt(e: Befehlseintrag, ort: { typ?: string; p: Params; arbeitsplatz?: string }): boolean {
  if (e.arbeitsplatz) return ort.arbeitsplatz === e.arbeitsplatz;
  if (!e.ansicht || !ort.typ || e.ansicht.typ !== ort.typ) return false;
  return Object.entries(e.ansicht.p || {}).every(([k, v]) => (v === undefined ? true : ort.p[k] === v || (v === false && !ort.p[k])))
    && (!!ort.p.kompakt === !!e.ansicht.p?.kompakt);
}

/** Bereich der Navigation zur gezeigten Seite (für den Seitenkopf). */
export function bereichVon(ort: { typ?: string; p: Params; arbeitsplatz?: string }, modus: Modus): string | null {
  for (const g of NAVIGATION.filter((x) => sichtbar(x, modus))) {
    for (const n of g.eintraege) {
      const e = aufloesen(n, g.titel);
      if (e && passt(e, ort)) return g.titel;
    }
  }
  return null;
}

/** Alle ausführbaren Befehle (Navigation, Moduleinträge, Untermenüpunkte) für die Befehlssuche. */
export function befehlsliste(modus: Modus): { text: string; ort: string; e: Befehlseintrag }[] {
  const liste: { text: string; ort: string; e: Befehlseintrag }[] = [];
  const gesehen = new Set<string>();
  const dazu = (text: string, ort: string, e: Befehlseintrag | undefined) => {
    if (!e || (!e.befehl && !e.aktion && !e.ansicht && !e.arbeitsplatz)) return;
    if (e.modus && e.modus !== modus) return;
    const schluessel = `${e.befehl || e.arbeitsplatz || e.ansicht?.typ || text}|${JSON.stringify(e.args || e.ansicht?.p || {})}`;
    if (gesehen.has(schluessel)) return;
    gesehen.add(schluessel);
    liste.push({ text, ort, e });
  };
  for (const g of NAVIGATION.filter((x) => sichtbar(x, modus))) {
    for (const n of g.eintraege) {
      const e = aufloesen(n, g.titel);
      if (!e) continue;
      dazu(e.text, g.titel, e);
      const quelle = n.ref ? eintrag(n.ref) : undefined;
      for (const m of n.menue || quelle?.menue || []) if (m) dazu(m.text.replace(/\s*…$/, ''), `${g.titel} › ${e.text}`, { braucht: e.braucht, ...m, id: m.id || m.text });
    }
  }
  for (const e of alleEintraege()) {
    const t = e.text.replace(/-/g, '');
    dazu(t, e.gruppe || 'Weitere Befehle', e);
    for (const m of e.menue || []) if (m) dazu(m.text.replace(/\s*…$/, ''), t, { braucht: e.braucht, ...m, id: m.id || m.text });
  }
  return liste;
}
