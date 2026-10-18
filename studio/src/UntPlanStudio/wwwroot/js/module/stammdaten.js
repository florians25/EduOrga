// Modul „Stammdaten“: Ansichten für Klassen, Lehrkräfte, Räume, Fächer, Raumgruppen, Gänge, Abteilungen, Abwesenheitsgründe
// und Schüler – Tabelle mit allen Feldern, Inline-Bearbeitung, Neuanlage-Zeile, Löschen, Suchen.
import { h } from '../kern/dom.js';
import { api } from '../kern/api.js';
import { zustand, elemente, darfSchreiben } from '../kern/zustand.js';
import { betrifft, melden } from '../kern/ereignisse.js';
import { Tabelle } from '../kern/tabelle.js';
import { frage, formular, hinweis, laden } from '../kern/dialog.js';
import { fensterverwaltung } from '../kern/fenster.js';
import { werkzeugFeld, weitereAktionen, titelBreite } from './unterricht.js';

export const TYPEN = {
  klasse: { titel: 'Klassen', einzahl: 'Klasse', symbol: 'klassen' },
  lehrer: { titel: 'Lehrkräfte', einzahl: 'Lehrkraft', symbol: 'lehrer' },
  raum: { titel: 'Räume', einzahl: 'Raum', symbol: 'raeume' },
  fach: { titel: 'Fächer', einzahl: 'Fach', symbol: 'faecher' },
  raumgruppe: { titel: 'Raumgruppen', einzahl: 'Raumgruppe', symbol: 'raeume' },
  gang: { titel: 'Gänge', einzahl: 'Gang', symbol: 'gaenge' },
  abteilung: { titel: 'Abteilungen', einzahl: 'Abteilung', symbol: 'abteilungen' },
  abwesenheitsgrund: { titel: 'Abwesenheitsgründe', einzahl: 'Abwesenheitsgrund', symbol: 'abwesenheit' },
  schueler: { titel: 'Schüler', einzahl: 'Schüler', symbol: 'schueler' },
};

/** Anzeigenamen der Felder, deren Server-Titel abgekürzt sind (Schlüssel: Titel vom Server). */
const FELDTITEL = {
  'Fix (X)': 'Fixiert', 'Ignore (i)': 'Ignorieren', 'Statistik-Kennz.': 'Statistikkennzeichen', 'HohlStd. soll': 'Hohlstunden (Soll)',
  'Std./Tag': 'Stunden je Tag', 'Mitt-pause': 'Mittagspause', 'max. Nachm.': 'Nachmittage (max.)', 'Soll (abzgl. Erm.)': 'Soll nach Ermäßigung',
  'Ist (Wert)': 'Ist', 'Pers.-Nr.': 'Personalnummer', 'Vtr. max/Woche': 'Vertretungen je Woche (max.)', 'Vtr. max/Monat': 'Vertretungen je Monat (max.)',
  'Aufs. max. Minuten': 'Aufsicht (max. Minuten)', 'Sperrvermerk (0-9)': 'Sperrvermerk', 'Hauptf./Tag': 'Hauptfächer je Tag',
  'Hauptf.Folge': 'Hauptfächer in Folge', Klassenlehrer: 'Klassenleitung', 'Raumgew.': 'Raumgewicht', 'Kapaz.': 'Plätze', 'buchbar (Web)': 'Buchbar',
  'Dopp.Std.': 'Doppelstunden', '(M) mehrmals/Tag': 'Mehrmals am Tag', '(R) Randstunde': 'Randstunde', '(N) kein Nachm.': 'Kein Nachmittag',
  '(B) Bereitschaft': 'Bereitschaft', 'Bereitsch. im Deputat': 'Bereitschaft im Deputat', von: 'Von', bis: 'Bis',
};

function stammdatenFenster(f, p) {
  const typ = p.typ;
  const info = TYPEN[typ];
  if (!info) throw new Error(`Unbekannter Elementtyp „${typ}“.`);
  f.titel(`${info.titel} / Stammdaten`);
  const pfad = (x = '') => api.dok(`/stammdaten/${typ}${x}`);
  let alle = [];
  let filter = '';

  const tabelle = new Tabelle(f.inhalt, {
    spalten: [],
    zustandSchluessel: `tabelle.stammdaten.${typ}`,
    leerText: `Es sind noch keine ${info.titel} erfasst.`,
    neuText: darfSchreiben() ? 'Neu: Kurzname eingeben …' : undefined,
    neu: darfSchreiben() ? neuAnlegen : undefined,
    aendern: darfSchreiben() ? (z, s, wert) => api.patch(pfad(`/${z.id}`), { feld: s.schluessel, wert }, { quelle: f.id }) : undefined,
    aendernMehrere: darfSchreiben() ? async (liste) => {
      const zeilen = await api.post(pfad('/aendern'), { aenderungen: liste.map((a) => ({ id: a.zeile.id, feld: a.spalte.schluessel, wert: a.wert })) }, { quelle: f.id });
      for (const z of zeilen) ersetzen(z);
    } : undefined,
    optionen: (s) => elemente(s.refTyp),
    beiAuswahl: (zeilen, aktiv) => {
      fussZeigen(zeilen.length);
      if (aktiv) melden('element', { typ, id: aktiv.id, quelle: f.id });
    },
    beiEntf: () => loeschen(),
    kontextmenue: (zeilen) => [
      { text: `${info.einzahl} anlegen …`, aktion: () => neuAnlegen(null, ''), deaktiviert: !darfSchreiben() },
      { text: `${zeilen.length > 1 ? `${zeilen.length} Einträge` : 'Eintrag'} löschen`, taste: 'Entf', aktion: loeschen, deaktiviert: !zeilen.length || !darfSchreiben() },
      null,
      ...(['klasse', 'lehrer', 'fach'].includes(typ) ? [{ text: 'Unterricht', aktion: () => fensterverwaltung.oeffnen('unterricht', { sicht: typ, element: zeilen[0]?.id }) }] : []),
      ...(['klasse', 'lehrer', 'raum', 'fach'].includes(typ) ? [{ text: 'Stundenplan', aktion: () => fensterverwaltung.oeffnen('stundenplan', { typ, element: zeilen[0]?.id }) }] : []),
      { text: 'Spalten ein- und ausblenden …', aktion: () => { const r = f.inhalt.getBoundingClientRect(); tabelle.spaltenMenue(r.left + 40, r.top + 30); } },
    ],
  });

  // ---- Werkzeugleiste: Neu · Löschen | Unterricht · Stundenplan · Weitere Aktionen | Suchen (rechts) ----
  if (darfSchreiben()) {
    f.werkzeug({ text: 'Neu', titel: `${info.einzahl} anlegen`, aktion: () => neuAnlegen(null, '') });
    f.werkzeug({ text: 'Löschen', titel: 'Markierte Einträge löschen (Entf)', aktion: loeschen });
    f.trenner();
  }
  if (['klasse', 'lehrer', 'fach'].includes(typ)) {
    f.werkzeug({ text: 'Unterricht', titel: 'Unterricht des markierten Elements', aktion: () => fensterverwaltung.oeffnen('unterricht', { sicht: typ, element: tabelle.aktiveZeile()?.id }) });
  }
  if (['klasse', 'lehrer', 'raum', 'fach'].includes(typ)) {
    f.werkzeug({ text: 'Stundenplan', titel: 'Stundenplan des markierten Elements', aktion: () => fensterverwaltung.oeffnen('stundenplan', { typ, element: tabelle.aktiveZeile()?.id }) });
  }
  weitereAktionen(f, () => [
    { text: 'Spalten ein- und ausblenden …', aktion: () => { const r = f.werkzeuge.getBoundingClientRect(); tabelle.spaltenMenue(r.left + 200, r.bottom); } },
    { text: 'Spaltenbreiten an den Inhalt anpassen', aktion: () => tabelle.spaltenAnpassen() },
  ]);
  const suche = h('input', { class: 'eingabe', type: 'search', placeholder: `${info.titel} durchsuchen`, style: { width: '220px' }, 'aria-label': 'Suchen' });
  suche.addEventListener('input', () => { filter = suche.value.trim().toLowerCase(); anzeigen(); });
  const sucheFeld = werkzeugFeld(null, suche);
  sucheFeld.classList.add('rechts');
  f.werkzeuge.append(sucheFeld);

  function fussZeigen(markiert = 0) {
    f.fuss.replaceChildren(...[h('span', null, `${alle.length} ${info.titel}`), markiert > 1 ? h('span', null, `${markiert} markiert`) : null,
      h('span', { class: 'rechts' }, darfSchreiben() ? 'Enter oder F2 bearbeiten · Strg+C/Strg+V kopieren und einfügen · Entf leert die Zelle' : 'Nur lesen')].filter(Boolean));
  }

  function anzeigen() {
    tabelle.daten(filter ? alle.filter((z) => z.werte.some((w) => w.toLowerCase().includes(filter))) : alle.slice());
    fussZeigen();
  }

  function ersetzen(z) {
    const i = alle.findIndex((x) => x.id === z.id);
    if (i >= 0) alle[i] = z; else alle.push(z);
    tabelle.zeileErsetzen(z.id, z);
  }

  async function laden_() {
    const weg = laden(f.inhalt);
    try {
      const d = await api.get(pfad());
      tabelle.spaltenSetzen(d.felder.map((x, i) => ({
        schluessel: x.schluessel, titel: FELDTITEL[x.titel] || x.titel, breite: FELDTITEL[x.titel] ? titelBreite(FELDTITEL[x.titel], x.breite) : x.breite, art: x.editierbar ? x.art : 'NurLesen', editierbar: x.editierbar && darfSchreiben(),
        auswahl: x.auswahl, refTyp: x.refTyp, standard: x.standard, karteikarte: x.karteikarte, hinweis: x.hinweis || (FELDTITEL[x.titel] ? x.titel : undefined),
        wert: (z) => z.werte[i],
        farbe: x.schluessel === 'Kurzname' ? (z) => (z.hintergrund ? `color-mix(in srgb, ${z.hintergrund} 40%, white)` : null) : undefined,
      })));
      alle = d.zeilen;
      anzeigen();
    } finally { weg(); }
  }

  async function neuAnlegen(spalte, wert) {
    let kurzname = wert, werte;
    if (!spalte || spalte.schluessel !== 'Kurzname') {
      const w = await formular(`${info.einzahl} anlegen`, [{ name: 'kurzname', titel: 'Kurzname', pflicht: true }], { okText: 'Anlegen' });
      if (!w) return null;
      kurzname = w.kurzname;
      if (spalte && wert) werte = { [spalte.schluessel]: wert };
    }
    const z = await api.post(pfad(), { kurzname, werte }, { quelle: f.id });
    alle.push(z);
    anzeigen();
    tabelle.waehle(z.id, spalte?.schluessel);
    hinweis(`${info.einzahl} „${kurzname}“ angelegt.`, 'ok', 2000);
    return null; // Anzeige ist bereits aktualisiert
  }

  async function loeschen() {
    const zeilen = tabelle.ausgewaehlte();
    if (!zeilen.length) return;
    const ids = zeilen.map((z) => z.id);
    let text = zeilen.length === 1 ? `${info.einzahl} „${zeilen[0].werte[0]}“ löschen?` : `${zeilen.length} ${info.titel} löschen?`;
    if (['klasse', 'lehrer', 'raum', 'fach'].includes(typ)) {
      const v = await api.get(pfad(`/verwendung?ids=${ids.join(',')}`));
      if (v.unterrichte) text += `\nAchtung: ${v.unterrichte} ${v.unterrichte === 1 ? 'Unterricht verwendet' : 'Unterrichte verwenden'} ${zeilen.length === 1 ? 'dieses Element' : 'diese Elemente'}; die Verweise werden entfernt.`;
    }
    if (!(await frage(text, { ja: 'Löschen', gefahr: true }))) return;
    await api.post(pfad('/loeschen'), { ids }, { quelle: f.id });
    alle = alle.filter((z) => !ids.includes(z.id));
    anzeigen();
    hinweis(`${ids.length} gelöscht – Strg+Z macht das Löschen rückgängig.`, 'ok');
  }

  f.an('daten', (e) => { if (e.quelle !== f.id && betrifft(e, 'Stammdaten', 'Unterricht')) laden_(); });
  f.an('element', (e) => { if (e.quelle !== f.id && e.typ === typ) tabelle.waehle(e.id); });
  laden_().then(() => { if (p.element) tabelle.waehle(p.element); });
  setTimeout(() => tabelle.fokus(), 50);
}

const fensterdef = {
  titel: 'Stammdaten',
  symbol: 'lehrer',
  symbolFuer: (p) => TYPEN[p.typ]?.symbol,
  breite: 860,
  hoehe: 460,
  einzig: (p) => p.typ,
  erstellen: stammdatenFenster,
};

const oeffnen = ({ typ = 'lehrer', element } = {}) => {
  if (!zustand.dokument) return;
  return fensterverwaltung.oeffnen('stammdaten', { typ, element });
};

const e = (id, gruppe, text, typ, gross) => ({ id, reiter: 'Dateneingabe', gruppe, text, symbol: TYPEN[typ].symbol, gross, befehl: 'stammdaten.oeffnen', args: { typ }, braucht: 'dokument' });

export default {
  id: 'stammdaten',
  css: ['css/module/planung.css'],
  fenster: { stammdaten: fensterdef },
  befehle: { 'stammdaten.oeffnen': oeffnen },
  ribbon: [
    e('eingabe.klassen', 'Stammdaten', 'Klassen', 'klasse', true),
    e('eingabe.lehrer', 'Stammdaten', 'Lehrkräfte', 'lehrer', true),
    e('eingabe.raeume', 'Stammdaten', 'Räume', 'raum', true),
    e('eingabe.faecher', 'Stammdaten', 'Fächer', 'fach', true),
    e('eingabe.raumgruppen', 'Spezielle Daten', 'Raumgruppen', 'raumgruppe'),
    e('eingabe.gaenge', 'Spezielle Daten', 'Gänge', 'gang'),
    e('eingabe.abteilungen', 'Spezielle Daten', 'Abteilungen', 'abteilung'),
    e('eingabe.gruende', 'Spezielle Daten', 'Abwesenheitsgründe', 'abwesenheitsgrund'),
    e('eingabe.schueler', 'Spezielle Daten', 'Schüler', 'schueler'),
    { ...e('start.abteilungen', 'Schule', 'Abteilungen', 'abteilung', true), reiter: 'Start' },
    { ...e('kurs.schueler', 'Kursplanung', 'Schüler', 'schueler', true), reiter: 'Kursplanung' },
  ],
};
