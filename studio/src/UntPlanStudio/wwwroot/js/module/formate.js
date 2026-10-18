// Modul „Planformate“: eigene Formate für Stundenpläne (Allgemein, Zeitbereich, Linien und Flächen, Darstellung, HTML,
// Stundenfeld mit grafischem Feld-Editor). Die Formate liegen in der Schuldatei und werden in der Druckauswahl gewählt.
// Server: Api/FormateApi.cs (/formate).
import { h } from '../kern/dom.js';
import { api } from '../kern/api.js';
import { zustand, darfSchreiben } from '../kern/zustand.js';
import { betrifft } from '../kern/ereignisse.js';
import { fensterverwaltung } from '../kern/fenster.js';
import { formular, frage, hinweis, fehlerMelden, laden } from '../kern/dialog.js';

const TAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const TYPEN = [['Klasse', 'Klassen'], ['Lehrer', 'Lehrkräfte'], ['Raum', 'Räume'], ['Fach', 'Fächer']];
const opt = (liste) => liste.map((x) => (Array.isArray(x) ? { wert: x[0], text: x[1] } : { wert: x, text: String(x) }));

// Felder je Reiter: [schluessel, titel, art, optionen]
const REITER = {
  Allgemein: [
    ['name', 'Name', 'text'], ['typ', 'Planart', 'auswahl', opt(TYPEN)], ['gross', 'Großes Format (eine Seite je Plan)', 'bool'],
    ['grundform', 'Grundform', 'grundform'], ['schriftgroesse', 'Schriftgröße', 'zahl'],
    ['farbe', 'Farbe nach', 'auswahl', opt([['Fach', 'Fach'], ['Lehrer', 'Lehrkraft'], ['Klasse', 'Klasse'], ['Raum', 'Raum'], ['Keine', 'Keine Farbe']])],
    ['langname', 'Langnamen anzeigen', 'bool'], ['zeitenAnzeigen', 'Uhrzeiten anzeigen', 'bool'], ['einzelstunden', 'Einzelstunden (nicht zusammenfassen)', 'bool'],
    ['pausenAnzeigen', 'Pausen am Bildschirm anzeigen', 'bool'], ['pausenbezeichnung', 'Pausenzeilen im Druck', 'bool'], ['klein', 'Kleiner Plan (nur Fachkürzel)', 'bool'],
    ['zellenBreite', 'Zellenbreite', 'zahl', null, '0 = automatisch'], ['zellenHoehe', 'Zellenhöhe', 'zahl', null, '0 = automatisch'],
    ['stundenplanlupeAnzeigen', 'Detailanzeige beim Zeigen auf eine Stunde', 'bool'], ['standardformat', 'Stundenfeld im Standardaufbau', 'bool'],
  ],
  Zeitbereich: [
    ['vonStunde', 'Von Stunde', 'zahl'], ['bisStunde', 'Bis Stunde', 'zahl', null, '0 = letzte Stunde'],
    ['vonTag', 'Von Tag', 'auswahl', opt(TAGE.map((t, i) => [i, t]))], ['bisTag', 'Bis Tag', 'auswahl', opt([[-1, 'Letzter Schultag'], ...TAGE.map((t, i) => [i, t])])],
    ['zeitraum', 'Zeitraum', 'auswahl', opt([['Kalenderwoche', 'Kalenderwoche'], ['GanzesSchuljahr', 'Ganzes Schuljahr'], ['EinTag', 'Ein Tag']])],
    ['minutModus', 'Minutengenaue Darstellung', 'bool'], ['ganzenTagZeigen', 'Ganzen Tag zeigen', 'bool'],
  ],
  'Linien und Flächen': [
    ['ueberschrift', 'Überschrift', 'gestaltung'], ['besetzteStunden', 'Belegte Stunden', 'gestaltung'], ['freieStunden', 'Freie Stunden', 'gestaltung'],
    ['linieVor', 'Linie vor den Stunden', 'text', null, 'Stundennummern, z. B. 3,5'], ['doppelstrichVor', 'Doppellinie vor den Stunden', 'text'], ['dickerStrichVor', 'Dicke Linie vor den Stunden', 'text'],
    ['trennstrichVormNachm', 'Trennlinie zwischen Vormittag und Nachmittag', 'bool'], ['trennstrichTage', 'Trennlinie zwischen den Tagen', 'bool'],
  ],
  Darstellung: [
    ['kombinierteKlassen', 'Klassen zusammenfassen (2a, 2b → 2ab)', 'bool'], ['alleKlassenEinFeld', 'Alle Klassen in einem Feld', 'bool'],
    ['kopplungenMitPunkt', 'Kopplungen mit Punkt kennzeichnen', 'bool'], ['fixierungMitStern', 'Fixierte Stunden mit Stern', 'bool'], ['kollisionTrennen', 'Kollisionen getrennt zeigen', 'bool'],
    ['stundenfelderSortieren', 'Stundenfelder sortieren', 'bool'], ['elementeVerbinden', 'Elemente verbinden', 'bool'],
    ['absenzenAnzeigen', 'Abwesenheiten anzeigen', 'bool'], ['keinAbsenzgrund', 'Ohne Abwesenheitsgrund', 'bool'], ['nurTagesabsenzen', 'Nur ganztägige Abwesenheiten', 'bool'],
    ['nurVertretungsstunden', 'Nur Vertretungsstunden', 'bool'], ['entfaelleDurchstreichen', 'Entfall durchstreichen', 'bool'], ['mitVertretungen', 'Mit Vertretungen', 'bool'],
    ['dragDropZeitwunschFarben', 'Beim Ziehen: Farben nach Zeitwünschen', 'bool'], ['dragDropMehrereUnterrichte', 'Beim Ziehen: mehrere Unterrichte', 'bool'], ['dragDropTauschketten', 'Beim Ziehen: Tauschketten', 'bool'],
    ['leereZeilenNichtDrucken', 'Leere Zeilen nicht drucken', 'bool'], ['leereSpalteNichtDrucken', 'Leere Spalten nicht drucken', 'bool'],
    ['schwarzWeissDruck', 'Schwarz-Weiß-Druck', 'bool'], ['eineUeberschriftJeBlatt', 'Eine Überschrift je Blatt', 'bool'], ['autosizeLupe', 'Detailanzeige an Inhalt anpassen', 'bool'],
    ['hauptklassenGetrennt', 'Stammklassen getrennt', 'bool'],
  ],
  HTML: [
    ['htmlTitel', 'Überschrift der HTML-Seiten', 'text'], ['htmlIndexseite', 'Übersichtsseite erzeugen', 'bool'], ['htmlMitFarben', 'Mit Fachfarben', 'bool'],
    ['htmlIndexLangnamen', 'Übersicht mit Langnamen', 'bool'],
  ],
  Stundenfeld: [
    ['namensArt', 'Namen', 'auswahl', opt([['Kurzname', 'Kurzname'], ['Langname', 'Langname'], ['Druckname', 'Druckname']])],
    ['felderHorizontalZentrieren', 'Felder waagerecht zentrieren', 'bool'], ['felderVertikalZentrieren', 'Felder senkrecht zentrieren', 'bool'],
    ['beginnEndzeit', 'Beginn und Ende anzeigen', 'bool'],
    ['aliasVerwenden', 'Alternative Namen verwenden', 'bool'], ['lehrerUndVertreter', 'Lehrkraft und Vertretung', 'bool'],
  ],
};
/** Ältere Reiternamen (Adresse/Parameter) auf die heutigen abbilden. */
const REITER_ALT = { 'Auswahl (Bereich)': 'Zeitbereich', 'Layout 1': 'Linien und Flächen', 'Layout 2': 'Darstellung', 'Stundenplan-Stunde': 'Stundenfeld' };

function editorFenster(f, p) {
  let daten = null;
  let aktuell = null;     // bearbeitete Kopie
  let alterName = null;
  let reiter = REITER_ALT[p.reiter] || (REITER[p.reiter] ? p.reiter : 'Allgemein');
  let geaendert = false;
  const schreiben = darfSchreiben();
  const liste = h('div', { class: 'fm-liste' });
  const reiterleiste = h('div', { class: 'es-reiter', role: 'tablist' });
  const seite = h('div', { class: 'fm-seite' });
  f.inhalt.append(h('div', { class: 'fm-rahmen' }, liste, h('div', { class: 'fm-rechts' }, reiterleiste, seite)));
  const status = h('span', { class: 'leise' });
  f.fuss.replaceChildren(status);
  const kNeu = f.werkzeug({ text: 'Neues Format …', aktion: () => kopieren(null) });
  const kKopie = f.werkzeug({ text: 'Kopieren …', aktion: () => aktuell && kopieren(alterName || aktuell.name) });
  const kWeg = f.werkzeug({ text: 'Löschen', aktion: () => loeschen() });
  f.trenner();
  f.werkzeug({ text: 'Probedruck', titel: 'Gespeichertes Format in der Druckvorschau anzeigen', aktion: () => probedruck() });
  const kSpeichern = f.werkzeug({ text: 'Speichern', aktion: () => speichern() });
  kSpeichern.classList.add('rechts');
  for (const k of [kSpeichern, kNeu, kKopie, kWeg]) k.disabled = !schreiben;

  const merken = () => { geaendert = true; status.textContent = 'Geändert – „Speichern“ übernimmt das Format in die Schuldatei.'; };

  function waehlen(fmt, alt) {
    aktuell = structuredClone(fmt);
    alterName = alt;
    geaendert = false;
    status.textContent = alt ? '' : 'Vorlage – „Speichern“ legt sie als eigenes Format an.';
    zeichnen();
  }

  function zeichneListe() {
    const eigene = daten.formate.map((x) => h('button', { type: 'button', class: `fm-eintrag${alterName === x.name ? ' aktiv' : ''}`, onclick: () => waehlen(x, x.name) },
      h('span', null, x.name), h('span', { class: 'leise' }, `${TYPEN.find((t) => t[0] === x.typ)?.[1] || x.typ}${x.gross ? ', groß' : ''}`)));
    const vorlagen = daten.vorlagen.map((x) => h('button', { type: 'button', class: `fm-eintrag vorlage${!alterName && aktuell?.name === x.name ? ' aktiv' : ''}`, onclick: () => waehlen(x, null) },
      h('span', null, x.name), h('span', { class: 'leise' }, 'Vorlage')));
    liste.replaceChildren(h('div', { class: 'fm-gruppentitel' }, 'Eigene Formate'), ...(eigene.length ? eigene : [h('p', { class: 'fm-leer' }, 'Noch keine eigenen Formate.')]), h('div', { class: 'fm-gruppentitel' }, 'Vorlagen'), ...vorlagen);
  }

  function eingabe([k, titel, art, optionen, hinweisText]) {
    let el;
    if (art === 'bool') {
      el = h('input', { type: 'checkbox', checked: !!aktuell[k] });
      el.addEventListener('change', () => { aktuell[k] = el.checked; merken(); });
      el.disabled = !schreiben;
      return h('label', { class: 'kontrolle' }, el, titel);
    } else if (art === 'auswahl' || art === 'grundform') {
      const o = art === 'grundform' ? daten.grundformen.map((g) => ({ wert: g.wert, text: g.text })) : optionen;
      el = h('select', { class: 'eingabe' }, o.map((x) => h('option', { value: x.wert, selected: String(x.wert) === String(aktuell[k]) }, x.text)));
      el.addEventListener('change', () => { aktuell[k] = typeof aktuell[k] === 'number' ? Number(el.value) : el.value; merken(); });
    } else if (art === 'gestaltung') {
      const g = aktuell[k] || (aktuell[k] = { raeumlich: 'Flach', grau: false });
      const r = h('select', { class: 'eingabe', 'aria-label': `${titel}: Rand` }, ['Erhaben', 'Versenkt', 'Flach'].map((x) => h('option', { value: x, selected: g.raeumlich === x }, { Erhaben: 'Erhaben', Versenkt: 'Vertieft', Flach: 'Eben' }[x])));
      const grau = h('select', { class: 'eingabe', 'aria-label': `${titel}: Fläche` }, h('option', { value: '1', selected: g.grau }, 'Grau'), h('option', { value: '0', selected: !g.grau }, 'Weiß'));
      r.addEventListener('change', () => { g.raeumlich = r.value; merken(); });
      grau.addEventListener('change', () => { g.grau = grau.value === '1'; merken(); });
      for (const x of [r, grau]) x.disabled = !schreiben;
      return [h('label', null, titel), h('div', { class: 'fm-paar' }, r, grau)];
    } else {
      el = h('input', { class: 'eingabe', type: art === 'zahl' ? 'number' : 'text', value: aktuell[k] ?? '' });
      el.addEventListener('change', () => { aktuell[k] = art === 'zahl' ? Number(el.value) : el.value; merken(); });
    }
    el.disabled = !schreiben;
    return [h('label', null, titel), el, hinweisText ? h('div', { class: 'hinweis' }, hinweisText) : null];
  }

  function feldEditor() {
    const box = h('div', { class: 'fm-zelle', title: 'Felder verschieben (ziehen) und in der Größe ändern (Ecke unten rechts)' });
    const tab = h('table', { class: 'es-liste fm-felder' });
    tab.append(h('tr', null, [['Feld'], ['Zeile', 'zahl'], ['Schrift (%)', 'zahl'], ['Fett', 'mitte'], ['Kursiv', 'mitte'], ['Unterstrichen', 'mitte'], ['Ausrichtung'], ['']].map(([t, k]) => h('th', { class: k }, t))));
    const neuZeichnen = () => { seite.replaceChildren(...seitenInhalt()); };
    aktuell.felder.forEach((fe, i) => {
      const el = h('div', { class: 'fm-feld', style: feldStil(fe) }, `${fe.zeile}${fe.art}`, h('span', { class: 'fm-griff' }));
      if (schreiben) el.addEventListener('pointerdown', (ev) => ziehen(ev, fe, el, box, ev.target.classList.contains('fm-griff')));
      box.append(el);
      const art = h('select', { class: 'eingabe' }, daten.feldarten.map((a) => h('option', { value: a, selected: a === fe.art }, a)));
      art.addEventListener('change', () => { fe.art = art.value; merken(); neuZeichnen(); });
      const zahl = (k, min, max) => { const x = h('input', { class: 'eingabe', type: 'number', min, max, value: fe[k], style: { width: '64px' } }); x.addEventListener('change', () => { fe[k] = Number(x.value); merken(); neuZeichnen(); }); return x; };
      const bool = (k) => { const x = h('input', { type: 'checkbox', checked: !!fe[k] }); x.addEventListener('change', () => { fe[k] = x.checked; merken(); neuZeichnen(); }); return x; };
      const aus = h('select', { class: 'eingabe' }, ['links', 'mittig', 'rechts'].map((t, n) => h('option', { value: n, selected: fe.ausrichtung === n }, t)));
      aus.addEventListener('change', () => { fe.ausrichtung = Number(aus.value); merken(); neuZeichnen(); });
      const weg = h('button', { class: 'knopf klein still', type: 'button', onclick: () => { aktuell.felder.splice(i, 1); merken(); neuZeichnen(); } }, 'Entfernen');
      const zeileEl = h('tr', null, h('td', null, art), h('td', { class: 'zahl' }, zahl('zeile', 1, 20)), h('td', { class: 'zahl' }, zahl('schriftProzent', 30, 300)),
        h('td', { class: 'mitte' }, bool('fett')), h('td', { class: 'mitte' }, bool('kursiv')), h('td', { class: 'mitte' }, bool('unterstrichen')), h('td', null, aus), h('td', { class: 'aktion' }, weg));
      for (const x of zeileEl.querySelectorAll('input, select, button')) x.disabled = !schreiben;
      tab.append(zeileEl);
    });
    const neu = h('button', { class: 'knopf klein', type: 'button', disabled: !schreiben, onclick: () => {
      const belegt = aktuell.felder.map((x) => x.art);
      const art = ['Fach', 'Lehrer', 'Klasse', 'Raum', 'UNr', 'Text'].find((a) => !belegt.includes(a)) || 'Text';
      const n = aktuell.felder.length;
      aktuell.felder.push({ art, zeile: 1, x: (n % 2) * 0.5, y: Math.min(0.75, Math.floor(n / 2) * 0.25), b: 0.5, h: 0.25, schriftProzent: 100, fett: false, kursiv: false, unterstrichen: false, ausrichtung: 1 });
      merken();
      neuZeichnen();
    } }, 'Feld hinzufügen');
    if (!aktuell.felder.length) tab.append(h('tr', null, h('td', { colspan: 8, class: 'fm-leer' }, 'Noch keine Felder angelegt.')));
    return [h('h3', null, 'Felder einer Unterrichtsstunde'),
      h('p', { class: 'leise' }, aktuell.standardformat ? '„Stundenfeld im Standardaufbau“ (Reiter Allgemein) ist eingeschaltet: Dann erscheinen alle beteiligten Elemente automatisch, die Felder werden nicht verwendet.' : 'Die Felder bestimmen Lage und Schrift der Angaben in einer Stunde. Ziehen verschiebt ein Feld, die Ecke unten rechts ändert die Größe.'),
      box, tab, h('div', { class: 'fm-knoepfe' }, neu)];
  }

  function feldStil(fe) {
    return {
      left: `${fe.x * 100}%`, top: `${fe.y * 100}%`, width: `${fe.b * 100}%`, height: `${fe.h * 100}%`,
      fontSize: `${Math.round(12 * fe.schriftProzent / 100)}px`, fontWeight: fe.fett ? '500' : '400', fontStyle: fe.kursiv ? 'italic' : 'normal',
      textDecoration: fe.unterstrichen ? 'underline' : 'none', justifyContent: ['flex-start', 'center', 'flex-end'][fe.ausrichtung ?? 1],
    };
  }

  function ziehen(ev, fe, el, box, groesse) {
    ev.preventDefault();
    const r = box.getBoundingClientRect();
    const start = { x: ev.clientX, y: ev.clientY, fx: fe.x, fy: fe.y, fb: fe.b, fh: fe.h };
    const runden = (v) => Math.round(v * 40) / 40;  // Raster 2,5 %
    const bewegen = (e) => {
      const dx = (e.clientX - start.x) / r.width;
      const dy = (e.clientY - start.y) / r.height;
      if (groesse) {
        fe.b = Math.max(0.05, Math.min(1 - fe.x, runden(start.fb + dx)));
        fe.h = Math.max(0.05, Math.min(1 - fe.y, runden(start.fh + dy)));
      } else {
        fe.x = Math.max(0, Math.min(1 - fe.b, runden(start.fx + dx)));
        fe.y = Math.max(0, Math.min(1 - fe.h, runden(start.fy + dy)));
      }
      Object.assign(el.style, feldStil(fe));
    };
    const ende = () => { document.removeEventListener('pointermove', bewegen); document.removeEventListener('pointerup', ende); merken(); };
    document.addEventListener('pointermove', bewegen);
    document.addEventListener('pointerup', ende);
  }

  function seitenInhalt() {
    const felder = REITER[reiter] || REITER.Allgemein;
    const angaben = felder.filter((x) => x[2] !== 'bool');
    const schalter = felder.filter((x) => x[2] === 'bool');
    const teile = [];
    if (angaben.length) teile.push(h('h3', null, 'Angaben'), h('div', { class: 'formular fm-formular' }, angaben.map(eingabe)));
    if (schalter.length) teile.push(h('h3', null, 'Optionen'), h('div', { class: 'fm-schalter' }, schalter.map(eingabe)));
    if (reiter === 'Stundenfeld') teile.push(...feldEditor());
    if (reiter === 'Allgemein') teile.push(h('p', { class: 'leise fm-hinweis' }, 'Im Druck wirken: großes Format bzw. kompakt, Langnamen, Uhrzeiten, Einzelstunden, Pausenzeilen, der Zeitbereich und der Schwarz-Weiß-Druck (Reiter Darstellung). Die übrigen Angaben bleiben in der Schuldatei erhalten.'));
    return teile;
  }

  function zeichnen() {
    zeichneListe();
    reiterleiste.replaceChildren(...Object.keys(REITER).map((k) => h('button', { type: 'button', role: 'tab', 'aria-selected': reiter === k ? 'true' : 'false', class: `es-reiterknopf${reiter === k ? ' aktiv' : ''}`, onclick: () => { reiter = k; f.parameterSetzen({ reiter }); zeichnen(); } }, k)));
    if (!aktuell) { reiterleiste.hidden = true; seite.replaceChildren(h('div', { class: 'fm-leerzustand' }, 'Wählen Sie links ein Format oder legen Sie mit „Neues Format“ eines aus einer Vorlage an.')); return; }
    reiterleiste.hidden = false;
    f.titel(`Planformat ${aktuell.name}`);
    seite.replaceChildren(...seitenInhalt());
  }

  async function speichern() {
    if (!aktuell) return;
    daten = await api.put(api.dok(`/formate/${encodeURIComponent(alterName || aktuell.name)}`), aktuell, { quelle: f.id });
    alterName = aktuell.name;
    const neu = daten.formate.find((x) => x.name === alterName);
    if (neu) aktuell = structuredClone(neu);
    geaendert = false;
    status.textContent = 'Gespeichert.';
    hinweis(`Format „${alterName}“ gespeichert.`, 'ok', 1500);
    zeichnen();
  }

  async function kopieren(name) {
    const quellen = [...daten.formate.map((x) => x.name), ...daten.vorlagen.map((x) => x.name)];
    const w = await formular(name ? 'Format kopieren' : 'Neues Planformat', [
      { name: 'quelle', titel: 'Vorlage', art: 'auswahl', wert: name || quellen[0], optionen: quellen.map((q) => ({ wert: q, text: q })) },
      { name: 'neu', titel: 'Name des neuen Formats', wert: name ? `${name} (Kopie)` : '', pflicht: true },
    ], { okText: 'Anlegen' });
    if (!w) return;
    daten = await api.post(api.dok('/formate/kopieren'), { name: w.quelle, neu: w.neu }, { quelle: f.id });
    const x = daten.formate.find((fo) => fo.name === w.neu.trim());
    if (x) waehlen(x, x.name); else zeichnen();
  }

  async function loeschen() {
    if (!alterName) return;
    if (!(await frage(`Format „${alterName}“ löschen?`, { ja: 'Löschen', gefahr: true }))) return;
    daten = await api.loeschen(api.dok(`/formate/${encodeURIComponent(alterName)}`), { quelle: f.id });
    aktuell = null;
    alterName = null;
    zeichnen();
  }

  function probedruck() {
    if (!aktuell) return;
    if (geaendert || !alterName) { hinweis('Bitte das Format zuerst speichern.', 'warnung'); return; }
    const typ = aktuell.typ.toLowerCase();
    fensterverwaltung.oeffnen('druck.vorschau', { url: api.dok(`/druck/stundenplaene?typ=${typ}&format=${encodeURIComponent(alterName)}`), titel: `Probedruck ${alterName}` });
  }

  async function laden_() {
    const weg = laden(f.inhalt);
    try {
      daten = await api.get(api.dok('/formate'));
      const gew = (alterName && daten.formate.find((x) => x.name === alterName)) || (p.typ && daten.formate.find((x) => x.typ.toLowerCase() === p.typ)) || daten.formate[0];
      if (gew && !geaendert) waehlen(gew, gew.name); else zeichnen();
    } finally { weg(); }
  }
  f.an('daten', (e) => { if (e.quelle !== f.id && !geaendert && betrifft(e, 'Einstellungen')) laden_().catch(() => {}); });
  laden_().catch(fehlerMelden);
}

export default {
  id: 'formate',
  css: ['css/module/formate.css'],
  fenster: {
    'formate.editor': { titel: 'Planformate', symbol: 'einstellungen', breite: 1000, hoehe: 640, einzig: () => 'formate', erstellen: editorFenster },
  },
  befehle: { 'formate.oeffnen': (a) => (zustand.dokument ? fensterverwaltung.oeffnen('formate.editor', a) : null) },
  ribbon: [
    { id: 'stundenplaene.formate', reiter: 'Stundenpläne', gruppe: 'Formate', text: 'Planformate', symbol: 'einstellungen', gross: true, befehl: 'formate.oeffnen', braucht: 'dokument', hinweis: 'Eigene Formate für Stundenpläne' },
  ],
};
