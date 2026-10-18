// Modul „Import/Export“ (Desktop: Datei → Import/Export, Module → Abteilungsplanung): Schild-NRW-CSV (Lehrer, Klassen),
// Schüler mit Kurswahlen, GPU-Dateien (Import/Export), Unterrichtsverteilung, Info-Stundenplan, Lehrer-Kalender (iCal),
// UntPlanWeb-Paket, Abteilungsdatei exportieren/zusammenführen sowie Schuldatei (.up) und BAL – alles in einem Fenster.
import { h } from '../kern/dom.js';
import { symbol } from '../kern/symbole.js';
import { api } from '../kern/api.js';
import { zustand, darfSchreiben } from '../kern/zustand.js';
import { betrifft } from '../kern/ereignisse.js';
import { meldung, hinweis, laden, fehlerMelden, menue } from '../kern/dialog.js';
import { fensterverwaltung } from '../kern/fenster.js';
import { befehl } from '../kern/modulsystem.js';

// ---------------------------------------------------------------------------------------------- gemeinsame Bausteine
// (auch für Druck, Formate, Soll und Ist, UntPlan Web, Mehrbenutzerbetrieb; Stile in css/module/austausch.css)

/** Knopf „Weitere Aktionen“ in der Werkzeugleiste: Menü mit seltenen Aktionen (Einträge ohne Symbol). */
export function weitereAktionen(f, eintraege, text = 'Weitere Aktionen') {
  const k = h('button', { class: 'wz-knopf ax-mehr', type: 'button', title: text, 'aria-haspopup': 'menu' }, h('span', null, text), h('span', { class: 'ax-mehr-pfeil' }, symbol('pfeil_runter')));
  k.addEventListener('click', () => {
    const r = k.getBoundingClientRect();
    const liste = (typeof eintraege === 'function' ? eintraege() : eintraege).filter((e) => e !== undefined).map((e) => (e && e.symbol ? { ...e, symbol: undefined } : e));
    menue(r.left, r.bottom + 4, liste);
  });
  f.werkzeuge.append(k);
  return k;
}

/** Feld der Filterleiste: Beschriftung und Feld(er) nebeneinander. */
export function filterFeld(titel, ...felder) {
  return h('span', { class: 'ax-feld' }, titel ? h('span', { class: 'ax-feld-titel' }, titel) : null, ...felder);
}

/** Schalter mit Text; input ist ein vorhandenes Kontrollkästchen. */
export function schalter(text, input, titel) {
  input.setAttribute('role', 'switch');
  return h('label', { class: 'ax-schalter', title: titel || null }, input, h('span', null, text));
}

/** Dateiname aus Content-Disposition (filename* bevorzugt). */
function dateiname(cd, standard) {
  const stern = /filename\*=UTF-8''([^;]+)/i.exec(cd || '');
  if (stern) { try { return decodeURIComponent(stern[1]); } catch { /* weiter */ } }
  const einfach = /filename="?([^";]+)"?/i.exec(cd || '');
  return einfach ? einfach[1] : standard;
}

/** Datei von der API laden und im Browser speichern (Fehler des Servers kommen als Meldung statt als Seite). */
export async function dateiHerunterladen(pfad, standard = 'Datei') {
  const r = await api.roh(pfad);
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: dateiname(r.headers.get('Content-Disposition'), standard), style: { display: 'none' } });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Eine oder mehrere Dateien wählen (Promise mit File[]; leer = abgebrochen). */
export function dateienWaehlen(accept = '', mehrere = false) {
  return new Promise((fertig) => {
    const input = h('input', { type: 'file', accept, multiple: mehrere, style: { display: 'none' } });
    input.addEventListener('change', () => { fertig([...(input.files || [])]); input.remove(); });
    input.addEventListener('cancel', () => { fertig([]); input.remove(); });
    document.body.append(input);
    input.click();
  });
}

/** Mehrere Dateien im Feld „datei“ hochladen. */
export function dateienHochladen(pfad, dateien, felder = {}) {
  const fd = new FormData();
  for (const d of dateien) fd.append('datei', d, d.name);
  for (const [k, v] of Object.entries(felder)) fd.append(k, String(v));
  return api.post(pfad, fd);
}

function berichtText(b) {
  return [b.text || `${b.art}: ${b.neu} neu, ${b.aktualisiert} aktualisiert`, ...(b.hinweise || []).slice(0, 40)].join('\n');
}

async function csvImport(art, titel) {
  const [datei] = await dateienWaehlen('.csv,.txt,text/csv,text/plain');
  if (!datei) return null;
  const b = await dateienHochladen(api.dok(`/austausch/csv/${art}`), [datei]);
  meldung(berichtText(b), titel);
  return b;
}

async function gpuImport() {
  const dateien = await dateienWaehlen('.txt,.TXT,.zip', true);
  if (!dateien.length) return null;
  const b = await dateienHochladen(api.dok('/austausch/gpu'), dateien);
  meldung(berichtText(b), 'GPU-Import');
  return b;
}

function austauschFenster(f) {
  f.titel('Import und Export');
  const inhalt = h('div', { class: 'ax-inhalt' });
  const protokoll = h('div', { class: 'ax-protokoll' }, h('span', { class: 'leise' }, 'Noch kein Import in dieser Sitzung.'));
  f.inhalt.append(inhalt);
  const schreiben = darfSchreiben();
  let info = { abteilungen: [], lehrer: [], zaehler: {} };

  // Knopf, der eine Aktion mit Ladeanzeige ausführt und einen Importbericht ins Protokoll schreibt
  const aktion = (text, f2, { nurSchreiben = false, titel } = {}) =>
    h('button', { class: 'knopf klein', type: 'button', title: titel || null, disabled: nurSchreiben && !schreiben, onclick: async () => {
      const weg = laden(inhalt);
      try {
        const b = await f2();
        if (b && typeof b === 'object' && 'neu' in b) protokoll.replaceChildren(...berichtText(b).split('\n').map((z) => h('div', null, z)));
      } catch (e) { fehlerMelden(e); } finally { weg(); }
    } }, text);

  const zeile = (titel, beschreibung, ...rechts) => h('div', { class: 'ax-zeile' },
    h('div', { class: 'ax-text' }, h('div', { class: 'ax-titel' }, titel), beschreibung ? h('div', { class: 'ax-beschreibung' }, beschreibung) : null),
    h('div', { class: 'ax-aktion' }, ...rechts));
  const karte = (titel, ...kinder) => h('section', { class: 'ax-karte' }, h('h3', null, titel), ...kinder);

  function zeichnen() {
    const lehrerWahl = h('select', { class: 'eingabe', title: 'Lehrkraft für den Kalenderexport' }, info.lehrer.map((l) => h('option', { value: l.id }, `${l.kurz} – ${l.lang}`)));
    const heute = new Date().toISOString().slice(0, 10);
    const plus = new Date(Date.now() + 27 * 86400000).toISOString().slice(0, 10);
    const von = h('input', { class: 'eingabe', type: 'date', value: heute });
    const bis = h('input', { class: 'eingabe', type: 'date', value: plus });
    const abteilung = h('select', { class: 'eingabe' }, info.abteilungen.length
      ? info.abteilungen.map((a) => h('option', { value: a.id }, `${a.kurz}${a.lang ? ` – ${a.lang}` : ''} (${a.unterrichte} Unterrichte)`))
      : h('option', { value: '' }, 'Keine Abteilungen angelegt'));
    const z = info.zaehler || {};
    const kennzahl = (wert, text) => h('div', { class: 'ax-kennzahl' }, h('span', { class: 'ax-zahl' }, wert ?? 0), h('span', null, text));
    inhalt.replaceChildren(
      karte('Schuldatei',
        h('div', { class: 'ax-kennzahlen' }, kennzahl(z.lehrer, 'Lehrkräfte'), kennzahl(z.klassen, 'Klassen'), kennzahl(z.schueler, 'Schülerinnen und Schüler'), kennzahl(z.unterrichte, 'Unterrichte'), kennzahl(z.stunden, 'verplante Stunden')),
        zeile('Schuldatei herunterladen', `Aktueller Stand von „${info.schulname || 'Schuldatei'}“ als UntPlan-Datei (.up)`, aktion('Herunterladen', () => befehl('datei.herunterladen'))),
        zeile('Schuldatei hochladen', 'Eine .up- oder BAL-Datei als neue Schuldatei auf den Server laden', aktion('Hochladen …', () => befehl('datei.hochladen'), { nurSchreiben: true })),
        zeile('BAL-Datei übernehmen', 'Stundenplan aus einer BAL-Datei (WILLI2) in diese Schuldatei übernehmen', aktion('Importieren …', () => befehl('datei.balImport'), { nurSchreiben: true }))),
      karte('Import',
        zeile('Lehrkräfte (Schild-NRW, CSV)', 'Lehrkräfte aus einer Schild-NRW-Exportdatei anlegen bzw. aktualisieren', aktion('Importieren …', () => csvImport('lehrer', 'Import Lehrkräfte'), { nurSchreiben: true })),
        zeile('Klassen (Schild-NRW, CSV)', 'Klassen aus einer Schild-NRW-Exportdatei anlegen bzw. aktualisieren', aktion('Importieren …', () => csvImport('klassen', 'Import Klassen'), { nurSchreiben: true })),
        zeile('Schülerinnen und Schüler mit Kurswahlen (CSV)', 'Liste mit Name, Vorname, Klasse und Kursen übernehmen', aktion('Importieren …', () => csvImport('schueler', 'Import Schüler'), { nurSchreiben: true })),
        zeile('GPU-Dateien', 'GPU001 bis GPU006 (mehrere Dateien oder ein ZIP) beim Umstieg übernehmen', aktion('Importieren …', gpuImport, { nurSchreiben: true }))),
      karte('Export',
        zeile('GPU-Dateien (ZIP)', 'GPU001 bis GPU006 im Latin-1-Format', aktion('Herunterladen', () => dateiHerunterladen(api.dok('/austausch/gpu'), 'GPU.zip'))),
        zeile('Unterrichtsverteilung (CSV)', 'Alle Unterrichte mit Kopplungszeilen', aktion('Herunterladen', () => dateiHerunterladen(api.dok('/austausch/unterricht.csv'), 'Unterrichtsverteilung.csv'))),
        zeile('Aushang (HTML, ZIP)', 'Statische HTML-Seiten aller Pläne zum Veröffentlichen', aktion('Herunterladen', () => dateiHerunterladen(api.dok('/austausch/infostundenplan.zip'), 'Aushang.zip'))),
        zeile('Paket für UntPlan Web (JSON)', 'Paket im Schema untplanweb/1, z. B. für ein manuelles Hochladen', aktion('Herunterladen', () => dateiHerunterladen(api.dok('/austausch/untplanweb.json'), 'untplanweb.json'))),
        h('div', { class: 'ax-zeile ax-ical' },
          h('div', { class: 'ax-text' }, h('div', { class: 'ax-titel' }, 'Kalender einer Lehrkraft (iCalendar)'), h('div', { class: 'ax-beschreibung' }, 'Stundenplan mit Vertretungen als .ics-Datei')),
          h('div', { class: 'ax-aktion ax-felder' }, filterFeld(null, lehrerWahl), filterFeld('Von', von), filterFeld('Bis', bis),
            aktion('Herunterladen', () => {
              if (!lehrerWahl.value) throw new Error('Bitte eine Lehrkraft wählen.');
              return dateiHerunterladen(api.dok(`/austausch/ical/${lehrerWahl.value}?von=${von.value}&bis=${bis.value}`), 'Stundenplan.ics');
            })))),
      karte('Abteilungsplanung',
        h('p', { class: 'ax-erklaerung' }, 'Eine Abteilungsdatei enthält alle Stammdaten; beweglich sind nur die Unterrichte der Abteilung. Nach der Bearbeitung wird sie wieder zusammengeführt.'),
        h('div', { class: 'ax-zeile' },
          h('div', { class: 'ax-text' }, filterFeld('Abteilung', abteilung)),
          h('div', { class: 'ax-aktion' },
            aktion('Exportieren', () => {
              if (!abteilung.value) throw new Error('Bitte zuerst unter Stammdaten → Abteilungen eine Abteilung anlegen.');
              return dateiHerunterladen(api.dok(`/austausch/abteilung/${abteilung.value}`), 'Abteilung.up');
            }),
            aktion('Zusammenführen …', async () => {
              if (!abteilung.value) throw new Error('Bitte eine Abteilung wählen.');
              const [datei] = await dateienWaehlen('.up,.untplan,application/json');
              if (!datei) return null;
              const b = await dateienHochladen(api.dok(`/austausch/abteilung/${abteilung.value}`), [datei]);
              hinweis(b.text, 'ok');
              return b;
            }, { nurSchreiben: true, titel: 'Unterrichte und Stunden der Abteilung aus einer Abteilungsdatei übernehmen' })))),
      karte('Protokoll des letzten Imports', protokoll));
  }

  async function laden_() {
    try { info = await api.get(api.dok('/austausch')); } catch (e) { fehlerMelden(e); }
    zeichnen();
  }
  f.an('daten', (e) => { if (betrifft(e, 'Stammdaten')) laden_(); });
  laden_();
}

const oeffnen = () => { if (zustand.dokument) fensterverwaltung.oeffnen('austausch', {}); };

export default {
  id: 'austausch',
  css: ['css/module/austausch.css'],
  fenster: {
    austausch: { titel: 'Import und Export', symbol: 'import', breite: 820, hoehe: 600, einzig: () => 'austausch', erstellen: austauschFenster },
  },
  befehle: {
    'austausch.oeffnen': oeffnen,
    'austausch.schueler': () => csvImport('schueler', 'Import Schüler'),
    'austausch.lehrer': () => csvImport('lehrer', 'Import Lehrkräfte'),
    'austausch.klassen': () => csvImport('klassen', 'Import Klassen'),
    'austausch.gpu': gpuImport,
  },
  ribbon: [
    {
      id: 'eingabe.importexport', reiter: 'Dateneingabe', gruppe: 'Hilfsmittel', text: 'Import und Export', symbol: 'import', braucht: 'dokument', hinweis: 'Import und Export (CSV, GPU, iCalendar, Aushang, Abteilungsdatei)',
      menue: [
        { text: 'Import und Export …', symbol: 'import', befehl: 'austausch.oeffnen' },
        null,
        { text: 'Lehrkräfte aus Schild-NRW importieren (CSV) …', symbol: 'import', befehl: 'austausch.lehrer', braucht: 'schreiben' },
        { text: 'Klassen aus Schild-NRW importieren (CSV) …', symbol: 'import', befehl: 'austausch.klassen', braucht: 'schreiben' },
        { text: 'Schülerinnen und Schüler importieren (CSV) …', symbol: 'import', befehl: 'austausch.schueler', braucht: 'schreiben' },
        { text: 'GPU-Dateien importieren …', symbol: 'import', befehl: 'austausch.gpu', braucht: 'schreiben' },
        { text: 'BAL-Datei importieren …', symbol: 'bal', befehl: 'datei.balImport', braucht: 'schreiben' },
        null,
        { text: 'GPU-Dateien exportieren', symbol: 'export', aktion: () => dateiHerunterladen(api.dok('/austausch/gpu'), 'GPU.zip') },
        { text: 'Unterrichtsverteilung exportieren (CSV)', symbol: 'export', aktion: () => dateiHerunterladen(api.dok('/austausch/unterricht.csv'), 'Unterrichtsverteilung.csv') },
      ],
    },
    { id: 'kurs.import', reiter: 'Kursplanung', gruppe: 'Kursplanung', text: 'Schüler importieren', symbol: 'import', gross: true, befehl: 'austausch.schueler', braucht: 'schreiben', hinweis: 'Schüler mit Kurswahlen aus einer CSV-Datei übernehmen' },
  ],
};
