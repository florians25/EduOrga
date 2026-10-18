// Modul „Unterricht“: Unterrichtsansicht je Klasse, Lehrkraft, Fach oder alle Unterrichte – Tabelle mit Nummer, Kopplung,
// Wochenstunden, Fach, Lehrkraft, Klassen, Räumen, Doppelstunden, Block, Text … und Inline-Eingabe.
// Kopplungszeilen erscheinen als eigene Zeilen unter dem Unterricht.
// Außerdem die gemeinsamen Bausteine der Werkzeugleisten der Planungsansichten (Elementwahl, Feld, Schalter, Weitere Aktionen).
import { h, leeren, textbreite } from '../kern/dom.js';
import { symbol } from '../kern/symbole.js';
import { api } from '../kern/api.js';
import { zustand, elemente, darfSchreiben } from '../kern/zustand.js';
import { betrifft, melden } from '../kern/ereignisse.js';
import { Tabelle } from '../kern/tabelle.js';
import { frage, hinweis, laden, menue } from '../kern/dialog.js';
import { fensterverwaltung } from '../kern/fenster.js';

const SICHTEN = { klasse: 'Klasse', lehrer: 'Lehrkraft', fach: 'Fach', alle: 'Alle Unterrichte' };
const ELEMENTNAME = { klasse: 'Klasse', lehrer: 'Lehrkraft', raum: 'Raum', fach: 'Fach' };

/** Anzeigenamen der Unterrichtsspalten (der Server liefert Kurzbezeichnungen). */
const SPALTENTITEL = {
  UNr: 'Nr.', KlLe: 'Kopplung', Nvpl: 'Nicht verplant', Wst: 'Wochenstd.', Jst: 'Jahresstd.', Lehrer: 'Lehrkraft', Klassen: 'Klassen',
  Dopp: 'Doppelstunden', Fix: 'Fixiert', Ignore: 'Ignorieren', Mehrmals: 'Mehrmals am Tag', KeineVtr: 'Keine Vertretung', Kurs: 'Kursname',
  Faktor: 'Wertfaktor', Periode: 'Woche', UGruppe: 'Unterrichtsgruppe', ZUGruppe: 'Gruppe der Zeile', Von: 'Von', Bis: 'Bis',
};

/** Spaltenbreite so, dass der Titel lesbar bleibt. */
export const titelBreite = (titel, breite) => Math.max(breite || 60, Math.ceil(textbreite(titel, '500 12px "IBM Plex Sans", sans-serif')) + 22);

/** Beschriftetes Feld in der Werkzeugleiste (Filterleiste): „Klasse [Auswahl]“. */
export function werkzeugFeld(titel, ...felder) {
  return h('span', { class: 'pl-feld' }, titel ? h('span', { class: 'pl-feld-titel' }, titel) : null, ...felder);
}

/** Schalter mit Text (Kontrollkästchen als Schalter). beiAenderung(an). Das Eingabefeld ist unter .input erreichbar. */
export function schalter(text, an, beiAenderung, titel) {
  const input = h('input', { type: 'checkbox', role: 'switch', checked: !!an });
  input.addEventListener('change', () => beiAenderung(input.checked));
  const el = h('label', { class: 'pl-schalter', title: titel || null }, input, h('span', null, text));
  el.input = input;
  return el;
}

/** Knopf „Weitere Aktionen“ mit Menü (Einträge ohne Symbole); eintraege() wird beim Öffnen ausgewertet. */
export function weitereAktionen(f, eintraege, text = 'Weitere Aktionen') {
  const k = h('button', { class: 'wz-knopf pl-mehr', type: 'button', title: text, 'aria-haspopup': 'menu' },
    h('span', null, text), h('span', { class: 'pl-mehr-pfeil' }, symbol('pfeil_runter')));
  k.addEventListener('click', () => {
    const r = k.getBoundingClientRect();
    menue(r.left, r.bottom + 4, eintraege().filter((e, i, l) => e !== undefined && !(e === null && (i === 0 || l[i - 1] === null))).map((e) => (e && e.symbol ? { ...e, symbol: undefined } : e)));
  });
  f.werkzeuge.append(k);
  return k;
}

/** Elementwahl mit Blättern für Ansichten, die zu einem Element gehören (Unterricht, Stundenplan …): „Klasse [‹][5a][›]“. */
export async function elementAuswahl(f, typ, gewaehlt, beiWahl) {
  const liste = await elemente(typ);
  const sel = h('select', { class: 'eingabe', title: `${ELEMENTNAME[typ] || 'Element'} wählen` },
    liste.map((e) => h('option', { value: e.id, selected: e.id === gewaehlt }, e.l ? `${e.k} – ${e.l}` : e.k)));
  const wahl = (id) => { sel.value = String(id); beiWahl(Number(id)); };
  sel.addEventListener('change', () => wahl(sel.value));
  const blaettern = (d) => {
    const i = liste.findIndex((e) => String(e.id) === sel.value);
    const n = liste[Math.max(0, Math.min(liste.length - 1, i + d))];
    if (n && String(n.id) !== sel.value) wahl(n.id);
  };
  // Bild auf/ab blättert auch in der Auswahl selbst
  sel.addEventListener('keydown', (e) => {
    if (e.key === 'PageUp' || e.key === 'PageDown') { e.preventDefault(); blaettern(e.key === 'PageUp' ? -1 : 1); }
  });
  const zurueck = h('button', { class: 'wz-knopf nur-symbol', type: 'button', title: 'Vorheriges Element (Bild auf)', 'aria-label': 'Vorheriges Element', onclick: () => blaettern(-1) }, symbol('pfeil_links'));
  const vor = h('button', { class: 'wz-knopf nur-symbol', type: 'button', title: 'Nächstes Element (Bild ab)', 'aria-label': 'Nächstes Element', onclick: () => blaettern(1) }, symbol('pfeil_rechts'));
  f.werkzeuge.prepend(werkzeugFeld(ELEMENTNAME[typ] || 'Element', h('span', { class: 'pl-elementwahl' }, zurueck, sel, vor)), h('span', { class: 'trenner' }));
  return {
    liste,
    setzen: (id) => { sel.value = String(id); },
    async neuLaden() {
      const neu = await elemente(typ);
      const wert = sel.value;
      liste.splice(0, liste.length, ...neu);
      leeren(sel).append(...neu.map((e) => h('option', { value: e.id }, e.l ? `${e.k} – ${e.l}` : e.k)));
      sel.value = wert;
    },
  };
}

function unterrichtFenster(f, p) {
  const sicht = SICHTEN[p.sicht] ? p.sicht : 'alle';
  let element = p.element ?? null;
  let alle = [];          // Unterrichte (vom Server)
  let verknuepft = true;
  const schreiben = darfSchreiben();

  const flach = () => alle.flatMap((u) => u.zeilen.map((werte, i) => ({ id: `${u.id}:${i}`, uid: u.id, zeile: i, erste: i === 0, anzahl: u.zeilen.length, werte, nvpl: u.nvpl, wst: u.wst })));

  const tabelle = new Tabelle(f.inhalt, {
    spalten: [],
    zustandSchluessel: 'tabelle.unterricht',
    gruppiert: (z) => z.uid,
    zeilenKlasse: (z) => (z.erste ? 'gruppe-anfang' : 'gruppe-folge'),
    leerText: sicht === 'alle' ? 'Es ist noch kein Unterricht erfasst.' : 'Für dieses Element ist noch kein Unterricht erfasst.',
    neuText: schreiben ? 'Neuer Unterricht …' : undefined,
    neu: schreiben ? async (s, wert) => {
      const u = await api.post(api.dok('/unterricht'), { sicht, element, werte: { [s.schluessel]: wert } }, { quelle: f.id });
      alle.push(u);
      anzeigen();
      tabelle.waehle(`${u.id}:0`, s.schluessel);
      hinweis(`Unterricht Nr. ${u.id} angelegt – Strg+Z macht die Anlage rückgängig.`, 'ok');
      return null;
    } : undefined,
    aendern: schreiben ? async (z, s, wert) => {
      ersetzen(await api.patch(api.dok(`/unterricht/${z.uid}`), { feld: s.schluessel, wert, zeile: z.zeile }, { quelle: f.id }));
    } : undefined,
    optionen: async (s) => (s.refTyp === 'raum' ? [...await elemente('raum'), ...await elemente('raumgruppe')] : elemente(s.refTyp)),
    beiAuswahl: (zeilen, aktiv) => { fussZeigen(); if (aktiv) melden('unterricht', { id: aktiv.uid, quelle: f.id }); },
    beiEntf: () => loeschen(),
    kontextmenue: () => [
      { text: 'Kopplungszeile hinzufügen', aktion: zeileNeu, deaktiviert: !schreiben },
      { text: 'Kopplungszeile löschen', aktion: zeileLoeschen, deaktiviert: !schreiben },
      { text: 'Unterricht kopieren', aktion: kopieren, deaktiviert: !schreiben },
      { text: 'Unterricht löschen', taste: 'Entf', aktion: loeschen, deaktiviert: !schreiben },
    ],
  });

  function ersetzen(u) {
    const i = alle.findIndex((x) => x.id === u.id);
    if (i >= 0) alle[i] = u; else alle.push(u);
    anzeigen();
  }

  function anzeigen() {
    tabelle.daten(flach());
    fussZeigen();
  }

  function fussZeigen() {
    const wst = alle.reduce((a, u) => a + u.wst, 0), nv = alle.reduce((a, u) => a + u.nvpl, 0);
    f.fuss.replaceChildren(h('span', null, `${alle.length} ${alle.length === 1 ? 'Unterricht' : 'Unterrichte'}`), h('span', null, `${wst} Wochenstunden`), h('span', null, `${nv} nicht verplant`),
      h('span', { class: 'rechts' }, schreiben ? 'Mehrere Klassen durch Komma trennen · weitere Lehrkraft als Kopplungszeile' : 'Nur lesen'));
  }

  async function laden_() {
    if (sicht !== 'alle' && !element) { alle = []; anzeigen(); return; }
    const weg = laden(f.inhalt);
    try {
      const q = sicht === 'alle' ? '' : `?sicht=${sicht}&element=${element}`;
      const d = await api.get(api.dok(`/unterricht${q}`));
      f.titel(`${d.titel} / Unterricht`);
      if (!tabelle.spalten.length) {
        tabelle.spaltenSetzen(d.spalten.map((s, i) => ({
          schluessel: s.schluessel, titel: SPALTENTITEL[s.schluessel] || s.titel, hinweis: s.titel, breite: titelBreite(SPALTENTITEL[s.schluessel] || s.titel, s.breite), standard: s.standard, karteikarte: s.karte,
          art: s.bool ? 'Bool' : s.refTyp ? (s.liste ? 'ElementListe' : 'Element') : s.editierbar ? (s.schluessel === 'Wst' ? 'Ganzzahl' : 'Text') : 'NurLesen',
          ausrichtung: ['UNr', 'Nvpl', 'Wst', 'Jst', 'Wert'].includes(s.schluessel) ? 'rechts' : undefined,
          refTyp: s.refTyp, editierbar: s.editierbar && schreiben,
          editierbarFuer: (z) => s.editierbar && schreiben && (s.zeile || z.erste),
          wert: s.schluessel === 'KlLe' ? (z) => (z.erste ? String(z.werte[i] ?? '').replace(/^\u229e\s*/, '') : '') : (z) => (s.zeile || z.erste ? z.werte[i] : ''),
          farbe: s.schluessel === 'Nvpl' ? (z) => (z.erste && z.nvpl > 0 ? 'var(--up-warnung-flaeche)' : null) : undefined,
        })));
      }
      alle = d.unterrichte;
      anzeigen();
    } finally { weg(); }
  }

  const aktuell = () => tabelle.aktiveZeile();

  async function zeileNeu() {
    const z = aktuell();
    if (!z) return hinweis('Bitte zuerst den Unterricht wählen.', 'warnung');
    const u = await api.post(api.dok(`/unterricht/${z.uid}/zeilen`), {}, { quelle: f.id });
    ersetzen(u);
    tabelle.waehle(`${u.id}:${u.zeilen.length - 1}`, 'Lehrer');
    hinweis(`Kopplungszeile zu Unterricht Nr. ${u.id} angelegt – jetzt die Lehrkraft eintragen.`, 'ok');
  }

  async function zeileLoeschen() {
    const z = aktuell();
    if (!z || z.anzahl <= 1) return hinweis('Bitte eine Kopplungszeile eines gekoppelten Unterrichts wählen.', 'warnung');
    ersetzen(await api.loeschen(api.dok(`/unterricht/${z.uid}/zeilen/${z.zeile}`), { quelle: f.id }));
  }

  async function kopieren() {
    const z = aktuell();
    if (!z) return;
    const u = await api.post(api.dok(`/unterricht/${z.uid}/kopieren`), {}, { quelle: f.id });
    alle.push(u);
    anzeigen();
    tabelle.waehle(`${u.id}:0`);
  }

  async function loeschen() {
    const ids = [...new Set(tabelle.ausgewaehlte().map((z) => z.uid))];
    if (!ids.length) return;
    if (!(await frage(ids.length === 1 ? 'Unterricht samt verplanter Stunden löschen?' : `${ids.length} Unterrichte samt verplanter Stunden löschen?`, { ja: 'Löschen', gefahr: true }))) return;
    await api.post(api.dok('/unterricht/loeschen'), { ids }, { quelle: f.id });
    alle = alle.filter((u) => !ids.includes(u.id));
    anzeigen();
    hinweis(`${ids.length === 1 ? 'Unterricht' : `${ids.length} Unterrichte`} gelöscht – Strg+Z macht das Löschen rückgängig.`, 'ok');
  }

  // ---- Werkzeugleiste: [Element ‹ › ] | Neu · Kopplungszeile · Löschen | Stundenplan · Weitere Aktionen | Auswahl folgen ----
  if (schreiben) {
    f.werkzeug({ text: 'Neu', titel: 'Neuer Unterricht', aktion: () => { tabelle.waehle('__neu', 'Fach'); tabelle.fokus(); tabelle.bearbeiten(); } });
    f.werkzeug({ text: 'Kopplungszeile', titel: 'Kopplungszeile hinzufügen (weitere Lehrkraft bzw. Gruppe)', aktion: zeileNeu });
    f.werkzeug({ text: 'Löschen', titel: 'Markierten Unterricht löschen (Entf)', aktion: loeschen });
    f.trenner();
  }
  if (sicht !== 'alle') f.werkzeug({ text: 'Stundenplan', titel: 'Stundenplan des Elements öffnen', aktion: () => fensterverwaltung.oeffnen('stundenplan', { typ: sicht, element }) });
  weitereAktionen(f, () => [
    schreiben ? { text: 'Kopplungszeile löschen', aktion: zeileLoeschen } : undefined,
    schreiben ? { text: 'Unterricht kopieren', aktion: kopieren } : undefined,
    schreiben ? null : undefined,
    { text: 'Spalten ein- und ausblenden …', aktion: () => { const r = f.werkzeuge.getBoundingClientRect(); tabelle.spaltenMenue(r.left + 260, r.bottom); } },
    { text: 'Spaltenbreiten anpassen', aktion: () => tabelle.spaltenAnpassen() },
  ]);
  if (sicht !== 'alle') {
    const sw = schalter('Auswahl folgen', verknuepft, (an) => { verknuepft = an; }, 'Zeigt das Element, das in einer anderen Ansicht gewählt wird');
    sw.classList.add('rechts');
    f.werkzeuge.append(sw);
  }

  let auswahl = null;
  const elementSetzen = (id) => { element = id; f.parameterSetzen({ element }); auswahl?.setzen(id); laden_(); };
  (async () => {
    if (sicht !== 'alle') {
      auswahl = await elementAuswahl(f, sicht, element, elementSetzen);
      if (!element && auswahl.liste.length) { element = auswahl.liste[0].id; auswahl.setzen(element); }
    }
    await laden_();
  })().catch((e) => hinweis(e.message, 'fehler'));

  f.an('daten', (e) => {
    if (e.quelle === f.id) return;
    if (betrifft(e, 'Stammdaten')) auswahl?.neuLaden();
    if (betrifft(e, 'Unterricht', 'Stundenplan', 'Stammdaten')) laden_();
  });
  f.an('element', (e) => { if (verknuepft && e.quelle !== f.id && e.typ === sicht && e.id !== element) elementSetzen(e.id); });
}

const oeffnen = ({ sicht = 'klasse', element } = {}) => (zustand.dokument ? fensterverwaltung.oeffnen('unterricht', { sicht, element }) : null);

const e = (id, text, sicht, gross = true) => ({ id, reiter: 'Dateneingabe', gruppe: 'Unterricht', text, symbol: 'unterricht', gross, befehl: 'unterricht.oeffnen', args: { sicht }, braucht: 'dokument' });

export default {
  id: 'unterricht',
  css: ['css/module/planung.css'],
  fenster: {
    unterricht: {
      titel: 'Unterricht', symbol: 'unterricht', breite: 980, hoehe: 480,
      einzig: (p) => p.sicht || 'alle',
      erneutGeoeffnet: () => {},
      erstellen: unterrichtFenster,
    },
  },
  befehle: { 'unterricht.oeffnen': oeffnen },
  ribbon: [
    e('eingabe.unterricht.klassen', 'Klassen', 'klasse'),
    e('eingabe.unterricht.lehrer', 'Lehrkräfte', 'lehrer'),
    e('eingabe.unterricht.faecher', 'Fächer', 'fach', false),
    e('eingabe.unterricht.alle', 'Alle Unterrichte', 'alle', false),
  ],
};
