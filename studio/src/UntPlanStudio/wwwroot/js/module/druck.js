// Modul „Druck“: Druckauswahl für Stundenpläne (PDF im Schwarz-Weiß-Layout, groß/kompakt, eigenes Format,
// HTML), Druckvorschau, Aushang (HTML-Seiten bzw. ZIP), iCalendar je Lehrkraft, Vertretungsplan-Ausgabe mit Seitenlayout
// (Felder, Gruppierung, Raster …, gespeichert in der Schuldatei) und Berichte (PDF/HTML/CSV).
// Alle Dateien erzeugt der Server (Api/DruckApi.cs, /api/dokumente/{dok}/druck/…).
import { h, vergleich } from '../kern/dom.js';
import { symbol } from '../kern/symbole.js';
import { api } from '../kern/api.js';
import { zustand, darfSchreiben } from '../kern/zustand.js';
import { betrifft } from '../kern/ereignisse.js';
import { fensterverwaltung } from '../kern/fenster.js';
import { dialog, hinweis, fehlerMelden, laden } from '../kern/dialog.js';
import { weitereAktionen, filterFeld, schalter as schalterMitText } from './austausch.js';

const TYPEN = [['klasse', 'Klassen'], ['lehrer', 'Lehrkräfte'], ['raum', 'Räume'], ['fach', 'Fächer']];
const heute = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const plusTage = (iso, n) => { const [y, m, t] = iso.split('-').map(Number); const d = new Date(y, m - 1, t + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** URL einer Druckausgabe des geöffneten Dokuments. */
export function druckUrl(pfad, parameter = {}) {
  const q = new URLSearchParams(Object.entries(parameter).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false).map(([k, v]) => [k, String(v)]));
  const s = q.toString();
  return api.dok(`/druck${pfad}${s ? `?${s}` : ''}`);
}

/** Datei herunterladen (Server liefert sie als Anhang). */
export function herunterladen(url) {
  const a = h('a', { href: url + (url.includes('?') ? '&' : '?') + 'herunterladen=true', download: '', style: { display: 'none' } });
  document.body.append(a);
  a.click();
  a.remove();
}

/** In neuem Browser-Tab öffnen (PDF-Anzeige bzw. Druck des Browsers). */
export function imTab(url) {
  window.open(url, '_blank', 'noopener');
}

/** Druckvorschau im Studio (Fenster mit eingebetteter PDF- bzw. HTML-Ansicht). */
export function vorschau(url, titel) {
  return fensterverwaltung.oeffnen('druck.vorschau', { url, titel });
}

/** Ausgabe-Knöpfe in der Werkzeugleiste: Seitenansicht, PDF öffnen (dort drucken), Herunterladen. */
function ausgabeWerkzeuge(f, url) {
  f.werkzeug({ text: 'Seitenansicht', aktion: () => vorschau(url(), 'Druckvorschau') });
  f.werkzeug({ text: 'PDF öffnen', titel: 'PDF in neuem Browser-Tab öffnen und dort drucken', aktion: () => imTab(url()) });
  f.werkzeug({ text: 'Herunterladen', aktion: () => herunterladen(url()) });
}

// ================================================================================================ Druckvorschau

function vorschauFenster(f, p) {
  f.titel(p.titel || 'Druckvorschau');
  const rahmen = h('iframe', { class: 'dr-vorschau', src: p.url, title: p.titel || 'Druckvorschau' });
  f.inhalt.append(rahmen);
  f.werkzeug({ text: 'Im Browser öffnen', titel: 'In neuem Browser-Tab öffnen und dort drucken', aktion: () => imTab(p.url) });
  f.werkzeug({ text: 'Herunterladen', aktion: () => herunterladen(p.url) });
  f.werkzeug({ text: 'Neu laden', aktion: () => { rahmen.src = p.url; } });
  f.fuss.replaceChildren(h('span', { class: 'leise' }, 'Zum Drucken die Ausgabe im Browser öffnen und den Druck des Browsers verwenden; das Querformat ist im PDF bereits eingestellt.'));
}

// ================================================================================================ Druckauswahl Stundenpläne

function auswahlFenster(f, p) {
  let daten = null;
  let typ = p.typ || 'klasse';
  let gewaehlt = new Set();
  const optionen = { format: '', kompakt: false, farbig: false };
  const links = h('div', { class: 'dr-optionen' });
  const liste = h('div', { class: 'dr-elemente' });
  f.inhalt.append(h('div', { class: 'dr-auswahl' }, links, liste));
  const zaehler = h('span', null);
  f.fuss.replaceChildren(zaehler);
  ausgabeWerkzeuge(f, () => url());
  f.trenner();
  f.werkzeug({ text: 'HTML-Ausgabe', titel: 'Stundenpläne als HTML-Seite anzeigen', aktion: () => vorschau(url('html'), 'Stundenpläne (HTML)') });

  const url = (ausgabe) => druckUrl('/stundenplaene', {
    typ, ids: gewaehlt.size === daten[typ].length ? 'alle' : [...gewaehlt].join(','), format: optionen.format,
    kompakt: optionen.kompakt, farbig: optionen.farbig, ausgabe,
  });

  function zeichnen() {
    const formate = daten.formate.filter((x) => x.typ === typ);
    if (optionen.format && !formate.some((x) => x.name === optionen.format)) optionen.format = '';
    const typWahl = h('div', { class: 'segment dr-typen', role: 'group', 'aria-label': 'Planart' }, TYPEN.map(([k, t]) => h('button', { type: 'button', class: k === typ ? 'aktiv' : '', 'aria-pressed': k === typ ? 'true' : 'false', onclick: () => {
      typ = k; gewaehlt = new Set(daten[typ].map((e) => e.id)); f.parameterSetzen({ typ }); zeichnen();
    } }, t)));
    const fmt = h('select', { class: 'eingabe' }, h('option', { value: '' }, 'Standard'), formate.map((x) => h('option', { value: x.name, selected: x.name === optionen.format }, x.name)));
    fmt.addEventListener('change', () => {
      optionen.format = fmt.value;
      const fo = formate.find((x) => x.name === fmt.value);
      if (fo) { optionen.kompakt = !fo.gross; zeichnen(); }
    });
    const kompakt = h('input', { type: 'checkbox', checked: optionen.kompakt });
    kompakt.addEventListener('change', () => { optionen.kompakt = kompakt.checked; });
    const farbig = h('input', { type: 'checkbox', checked: optionen.farbig });
    farbig.addEventListener('change', () => { optionen.farbig = farbig.checked; });
    links.replaceChildren(
      h('h3', null, 'Pläne'), typWahl,
      h('h3', null, 'Format'),
      h('div', { class: 'formular' },
        h('label', null, 'Planformat'), fmt,
        h('span'), schalterMitText('Kompakt (zwei Pläne je Seite)', kompakt),
        h('span'), schalterMitText('Fachfarben statt Graustufen', farbig)),
      h('button', { class: 'knopf klein still dr-link', type: 'button', onclick: () => fensterverwaltung.oeffnen('formate.editor', { typ }) }, 'Planformate bearbeiten'),
      h('p', { class: 'leise' }, 'Ausgabe als Formular in A4 quer: Raster mit Pausen, Unterrichtsliste, Fußnoten zu Kopplungen und Fächerlegende.'));
    zeichneListe();
  }

  function zeichneListe() {
    const filter = h('input', { class: 'eingabe', type: 'search', placeholder: 'Suchen', 'aria-label': 'Liste filtern' });
    const el = h('div', { class: 'dr-liste' });
    const fuellen = () => {
      const t = filter.value.trim().toLowerCase();
      const treffer = daten[typ].filter((e) => !t || e.k.toLowerCase().includes(t) || (e.l || '').toLowerCase().includes(t));
      if (!treffer.length) { el.replaceChildren(h('div', { class: 'dr-leer' }, t ? 'Keine Einträge zur Suche gefunden.' : 'Keine Einträge vorhanden.')); return; }
      el.replaceChildren(...treffer.map((e) => {
        const cb = h('input', { type: 'checkbox', checked: gewaehlt.has(e.id) });
        cb.addEventListener('change', () => { cb.checked ? gewaehlt.add(e.id) : gewaehlt.delete(e.id); zaehlen(); });
        return h('label', { class: 'dr-element' }, cb, h('b', null, e.k), h('span', { class: 'leise' }, e.l || ''));
      }));
    };
    filter.addEventListener('input', fuellen);
    liste.replaceChildren(h('div', { class: 'dr-listenkopf' }, filterFeld('Auswahl', filter),
      h('button', { class: 'knopf klein', type: 'button', onclick: () => { gewaehlt = new Set(daten[typ].map((e) => e.id)); fuellen(); zaehlen(); } }, 'Alle wählen'),
      h('button', { class: 'knopf klein', type: 'button', onclick: () => { gewaehlt = new Set(); fuellen(); zaehlen(); } }, 'Keine')), el);
    fuellen();
    zaehlen();
  }

  function zaehlen() { zaehler.textContent = `${TYPEN.find((x) => x[0] === typ)[1]}: ${gewaehlt.size} von ${daten[typ].length} gewählt`; }

  async function laden_() {
    const weg = laden(f.inhalt);
    try {
      daten = await api.get(druckUrl('/auswahl'));
      gewaehlt = new Set(p.ids?.length ? p.ids : daten[typ].map((e) => e.id));
      zeichnen();
    } finally { weg(); }
  }
  f.an('daten', (e) => { if (betrifft(e, 'Stammdaten', 'Einstellungen')) laden_().catch(() => {}); });
  laden_().catch(fehlerMelden);
}

// ================================================================================================ Berichte

function berichteFenster(f, p) {
  let daten = null;
  let bericht = p.bericht || 'lehrer-sollist';
  const links = h('div', { class: 'dr-berichtliste' });
  const rechts = h('div', { class: 'dr-berichtvorschau' });
  f.inhalt.append(h('div', { class: 'dr-berichte' }, links, rechts));
  const von = h('input', { class: 'eingabe', type: 'date' });
  const bis = h('input', { class: 'eingabe', type: 'date' });
  for (const el of [von, bis]) el.addEventListener('change', () => anzeigen());
  f.werkzeug({ text: 'PDF öffnen', titel: 'Bericht als PDF in neuem Browser-Tab öffnen', aktion: () => imTab(url('pdf')) });
  f.werkzeug({ text: 'HTML', titel: 'Bericht als HTML-Seite öffnen', aktion: () => imTab(url('html')) });
  f.werkzeug({ text: 'CSV', titel: 'Bericht als CSV-Datei herunterladen', aktion: () => herunterladen(url('csv')) });

  const url = (ausgabe) => {
    const b = daten.berichte.find((x) => x.id === bericht);
    return druckUrl(`/bericht/${bericht}`, { von: b?.zeitraum ? von.value : undefined, bis: b?.zeitraum ? bis.value : undefined, ausgabe });
  };

  function zeichnen() {
    const gruppen = [...new Set(daten.berichte.map((b) => b.gruppe))];
    const b = daten.berichte.find((x) => x.id === bericht) || daten.berichte[0];
    bericht = b.id;
    links.replaceChildren(...gruppen.map((g) => h('div', { class: 'dr-gruppe' }, h('div', { class: 'dr-gruppentitel' }, g), daten.berichte.filter((x) => x.gruppe === g).map((x) =>
      h('button', { type: 'button', class: `dr-bericht${x.id === bericht ? ' aktiv' : ''}`, title: x.hinweis, 'aria-current': x.id === bericht ? 'true' : null, onclick: () => { bericht = x.id; f.parameterSetzen({ bericht }); zeichnen(); } }, x.titel)))));
    rechts.replaceChildren(
      h('div', { class: 'dr-berichtkopf' },
        h('div', { class: 'dr-berichttitel' }, h('b', null, b.titel), h('div', { class: 'leise' }, b.hinweis)),
        b.zeitraum ? h('div', { class: 'dr-zeitraum' }, filterFeld('Von', von), filterFeld('Bis', bis), h('button', { class: 'knopf klein', type: 'button', onclick: () => anzeigen() }, 'Anzeigen')) : null),
      h('iframe', { class: 'dr-vorschau', title: b.titel, src: url('pdf') }));
  }

  function anzeigen() { const r = rechts.querySelector('iframe'); if (r) r.src = url('pdf'); }

  async function laden_() {
    daten = await api.get(druckUrl('/auswahl'));
    const h0 = heute();
    von.value = daten.schuljahrVon;
    bis.value = h0 < daten.schuljahrVon ? daten.schuljahrVon : h0 > daten.schuljahrBis ? daten.schuljahrBis : h0;
    zeichnen();
  }
  laden_().catch(fehlerMelden);
}

// ================================================================================================ Vertretungsplan-Ausgabe

/** Heute bzw. der nächste Wochentag (Mo–Fr). */
function naechsterWochentag() {
  let t = heute();
  for (let i = 0; i < 3; i++) { const [y, m, d] = t.split('-').map(Number); const wd = new Date(y, m - 1, d).getDay(); if (wd !== 0 && wd !== 6) break; t = plusTage(t, 1); }
  return t;
}

function vertretungsausgabeFenster(f, p) {
  let d = null;
  let layout = null;
  let geaendert = false;
  const schreiben = darfSchreiben();
  const start = p.von || naechsterWochentag();
  const von = h('input', { class: 'eingabe', type: 'date', value: start });
  const bis = h('input', { class: 'eingabe', type: 'date', value: p.bis || start });
  const version = h('select', { class: 'eingabe' }, h('option', { value: 'klassen' }, 'Für Schülerinnen und Schüler'), h('option', { value: 'lehrer', selected: p.version === 'lehrer' }, 'Für Lehrkräfte'));
  const links = h('div', { class: 'dr-layout' });
  const vorschauRahmen = h('iframe', { class: 'dr-vorschau', title: 'Vertretungsplan' });
  const filter = h('div', { class: 'dr-filter' }, filterFeld('Von', von), filterFeld('Bis', bis), filterFeld('Fassung', version));
  f.inhalt.append(filter, h('div', { class: 'dr-aushang' }, links, vorschauRahmen));
  const status = h('span', { class: 'leise' });
  f.fuss.replaceChildren(status);
  ausgabeWerkzeuge(f, () => url('pdf'));
  weitereAktionen(f, () => [
    { text: 'Als HTML öffnen', aktion: () => imTab(url('html')) },
    { text: 'Monitoransicht öffnen (HTML)', aktion: () => imTab(url('monitor')) },
  ]);
  const kSpeichern = f.werkzeug({ text: 'Layout speichern', aktion: () => speichern() });
  kSpeichern.classList.add('rechts');
  kSpeichern.disabled = !schreiben;
  f.werkzeug({ text: 'Verwerfen', titel: 'Änderungen am Seitenlayout verwerfen', aktion: () => laden_() });

  const url = (ausgabe) => druckUrl('/vertretungsplan', { von: von.value, bis: bis.value || von.value, version: version.value, ausgabe });
  const aktualisieren = () => { vorschauRahmen.src = url('pdf'); };
  for (const el of [von, bis, version]) el.addEventListener('change', () => { if (bis.value < von.value) bis.value = von.value; f.parameterSetzen({ von: von.value, bis: bis.value, version: version.value }); aktualisieren(); });

  const merken = () => { geaendert = true; status.textContent = 'Seitenlayout geändert – „Layout speichern“ übernimmt es in die Schuldatei.'; };

  function schalter(name, text, titel) {
    const cb = h('input', { type: 'checkbox', checked: !!layout[name], disabled: !schreiben });
    cb.addEventListener('change', () => { layout[name] = cb.checked; merken(); });
    const el = schalterMitText(text, cb, titel);
    el.classList.add('dr-schalter');
    return el;
  }

  function zeichnen() {
    const lehrer = version.value === 'lehrer';
    const felder = h('table', { class: 'es-liste dr-felder' });
    felder.append(h('tr', null, [['Drucken', 'mitte'], ['Spalte'], ['Überschrift'], ['Breite', 'zahl'], ['']].map(([t, k]) => h('th', { class: k }, t))));
    layout.felder.forEach((fe, i) => {
      const std = d.felder.find((x) => x.schluessel === fe.schluessel);
      const dr = h('input', { type: 'checkbox', checked: fe.drucken, disabled: !schreiben });
      dr.addEventListener('change', () => { fe.drucken = dr.checked; merken(); });
      const ue = h('input', { class: 'eingabe', value: fe.ueberschrift, placeholder: lehrer ? std?.lehrer : std?.klassen, disabled: !schreiben });
      ue.addEventListener('change', () => { fe.ueberschrift = ue.value; merken(); });
      const an = h('input', { class: 'eingabe', type: 'number', min: 2, max: 60, value: Math.round(fe.anteil * 100), style: { width: '60px' }, disabled: !schreiben });
      an.addEventListener('change', () => { fe.anteil = Math.max(2, Number(an.value) || 10) / 100; merken(); });
      const hoch = h('button', { class: 'knopf klein still dr-hoch', type: 'button', disabled: !schreiben || i === 0, title: 'Nach oben', 'aria-label': 'Nach oben', onclick: () => { layout.felder.splice(i - 1, 0, layout.felder.splice(i, 1)[0]); merken(); zeichnen(); } }, symbol('pfeil_runter'));
      felder.append(h('tr', null, h('td', { class: 'mitte' }, dr), h('td', null, lehrer ? std?.lehrer : std?.klassen), h('td', null, ue), h('td', { class: 'zahl dr-breite' }, an, h('span', { class: 'leise' }, '%')), h('td', { class: 'aktion' }, hoch)));
    });
    const gruppe = h('select', { class: 'eingabe', disabled: !schreiben }, d.gruppierungen.map((g) => h('option', { value: g, selected: layout.gruppierung === g }, g)));
    gruppe.addEventListener('change', () => { layout.gruppierung = gruppe.value; merken(); });
    const groesse = h('input', { class: 'eingabe', type: 'number', min: 6, max: 20, step: 0.5, value: layout.schriftgroesse, style: { width: '70px' }, disabled: !schreiben });
    groesse.addEventListener('change', () => { layout.schriftgroesse = Number(groesse.value); merken(); });
    const titel = h('input', { class: 'eingabe', value: layout.ueberschrift, placeholder: d.titel, disabled: !schreiben });
    titel.addEventListener('change', () => { layout.ueberschrift = titel.value; merken(); });
    const auswahlFeld = (name, text) => {
      const el = h('input', { class: 'eingabe', value: (layout[name] || []).join(','), placeholder: 'alle', disabled: !schreiben });
      el.addEventListener('change', () => { layout[name] = el.value.split(',').map((x) => x.trim()).filter(Boolean); merken(); });
      return [h('label', null, text), el];
    };
    links.replaceChildren(
      h('h3', null, 'Seitenlayout'),
      h('div', { class: 'formular' }, h('label', null, 'Überschrift'), titel, h('label', null, 'Schriftgröße (pt)'), groesse, h('label', null, 'Gruppierung'), gruppe,
        ...auswahlFeld('klassenAuswahl', 'Nur Klassen'), ...auswahlFeld('lehrerAuswahl', 'Nur Lehrkräfte')),
      h('h3', null, 'Seite'),
      h('div', { class: 'dr-schalterliste' },
        schalter('querformat', 'Querformat'), schalter('raster', 'Tabellenraster'),
        schalter('ueberschriftJeElement', 'Überschrift je Element'), schalter('eineSeiteJeElement', 'Eine Seite je Element'),
        schalter('elementueberschriftKomprimiert', 'Überschrift je Element kompakt'), schalter('ersteBeschriftungJedeSeite', 'Element oben auf jeder Seite'),
        schalter('stundenbezeichnung', 'Stundenbezeichnung')),
      h('h3', null, 'Inhalt'),
      h('div', { class: 'dr-schalterliste' },
        schalter('nachrichten', 'Nachrichten zum Tag'), schalter('blockierteRaeume', 'Blockierte Räume'),
        schalter('abwesendeKlassen', 'Abwesende Klassen'), schalter('abwesendeLehrer', 'Abwesende Lehrkräfte', 'Nur in der Fassung für Lehrkräfte'),
        schalter('lehrerMitAbsenzgrund', 'Abwesende Lehrkräfte mit Grund'), schalter('abwesendeNichtDrucken', 'Abwesende nicht drucken'),
        schalter('entfallslehrerDurchstreichen', 'Lehrkraft bei Entfall durchstreichen'), schalter('kombinierteKlassen', 'Klassen zusammenfassen (2a, 2b → 2ab)'),
        schalter('blockvertretungenZusammenfassen', 'Mehrstündige Vertretungen zusammenfassen'), schalter('keinEntfallBeiErsatz', 'Kein Entfall bei Ersatz in derselben Stunde'),
        schalter('auchElementeOhneVertretung', 'Auch Elemente ohne Vertretung'), schalter('nurNeue', 'Nur neue Vertretungen')),
      h('h3', null, 'Spalten'), felder,
      h('p', { class: 'leise' }, 'Das Seitenlayout wird mit „Layout speichern“ in der Schuldatei gespeichert.'));
  }
  version.addEventListener('change', () => zeichnen());

  async function speichern() {
    d = await api.put(druckUrl('/aushang'), layout, { quelle: f.id });
    layout = structuredClone(d.layout);
    geaendert = false;
    status.textContent = 'Seitenlayout gespeichert.';
    hinweis('Seitenlayout gespeichert.', 'ok', 1500);
    zeichnen();
    aktualisieren();
  }

  async function laden_() {
    const weg = laden(f.inhalt);
    try {
      d = await api.get(druckUrl('/aushang'));
      layout = structuredClone(d.layout);
      geaendert = false;
      status.textContent = '';
      zeichnen();
      aktualisieren();
    } finally { weg(); }
  }
  f.an('daten', (e) => { if (e.quelle !== f.id && betrifft(e, 'Vertretung')) aktualisieren(); if (e.quelle !== f.id && !geaendert && betrifft(e, 'Einstellungen')) laden_().catch(() => {}); });
  laden_().catch(fehlerMelden);
}

// ================================================================================================ Aushang und iCalendar (Dialoge)

async function infoStundenplan() {
  const ok = await dialog({
    titel: 'Aushang (HTML)',
    inhalt: h('div', null,
      h('p', null, 'Stundenpläne aller Klassen, Lehrkräfte und Räume als HTML-Seiten mit Übersichtsseite.'),
      h('p', { class: 'leise' }, 'Im Browser ansehen oder als ZIP-Datei herunterladen, um sie auf einem Webserver zu veröffentlichen.')),
    knoepfe: [{ text: 'Im Browser ansehen', wert: 'ansehen', primaer: true }, { text: 'ZIP herunterladen', wert: 'zip' }, { text: 'Abbrechen', wert: null }],
  });
  if (ok === 'ansehen') imTab(druckUrl('/info/index.html'));
  if (ok === 'zip') {
    const a = h('a', { href: druckUrl('/infostundenplan.zip'), download: '', style: { display: 'none' } });
    document.body.append(a); a.click(); a.remove();
  }
}

async function iCalendar() {
  const daten = await api.get(druckUrl('/auswahl'));
  const lehrer = h('select', { class: 'eingabe' }, h('option', { value: '' }, 'Alle Lehrkräfte (ZIP-Datei)'),
    [...daten.lehrer].sort((a, b) => vergleich(a.k, b.k)).map((l) => h('option', { value: l.id }, l.l ? `${l.k} – ${l.l}` : l.k)));
  const v = h('input', { class: 'eingabe', type: 'date', value: heute() });
  const b = h('input', { class: 'eingabe', type: 'date', value: plusTage(heute(), 27) });
  const ok = await dialog({
    titel: 'Kalender für Lehrkräfte (iCalendar)',
    breite: '480px',
    inhalt: h('div', null, h('div', { class: 'formular' }, h('label', null, 'Lehrkraft'), lehrer, h('label', null, 'Von'), v, h('label', null, 'Bis'), b),
      h('p', { class: 'leise dr-dialoghinweis' }, 'Stundenplan der Lehrkraft mit Vertretungen als .ics-Datei zum Import in Kalenderprogramme.')),
    knoepfe: [{ text: 'Herunterladen', wert: true, primaer: true }, { text: 'Abbrechen', wert: null }],
  });
  if (!ok) return;
  const a = h('a', { href: druckUrl('/ical', { lehrer: lehrer.value || undefined, von: v.value, bis: b.value }), download: '', style: { display: 'none' } });
  document.body.append(a); a.click(); a.remove();
}

// ================================================================================================ Modul

const mitDok = (f) => (a) => (zustand.dokument ? f(a) : null);
const e = (id, reiter, gruppe, text, symbol, befehl, gross = false, args, extra = {}) => ({ id, reiter, gruppe, text, symbol, gross, befehl, args, braucht: 'dokument', ...extra });

export default {
  id: 'druck',
  css: ['css/module/druck.css'],
  fenster: {
    'druck.vorschau': { titel: 'Druckvorschau', symbol: 'drucken', breite: 980, hoehe: 680, erstellen: vorschauFenster },
    'druck.auswahl': { titel: 'Druckauswahl', symbol: 'drucken', breite: 900, hoehe: 560, einzig: () => 'auswahl', erstellen: auswahlFenster },
    'druck.berichte': { titel: 'Berichte', symbol: 'drucken', breite: 1180, hoehe: 680, einzig: () => 'berichte', erstellen: berichteFenster },
    'druck.vertretung': { titel: 'Vertretungsplan ausgeben', symbol: 'vertretung', breite: 1260, hoehe: 720, einzig: () => 'vertretung', erstellen: vertretungsausgabeFenster },
  },
  befehle: {
    'druck.stundenplaene': mitDok((a) => fensterverwaltung.oeffnen('druck.auswahl', a)),
    'druck.berichte': mitDok((a) => fensterverwaltung.oeffnen('druck.berichte', a)),
    'druck.vertretung': mitDok((a) => fensterverwaltung.oeffnen('druck.vertretung', a)),
    'druck.info': mitDok(infoStundenplan),
    'druck.ical': mitDok(iCalendar),
    'druck.vorschau': mitDok(({ url, titel }) => vorschau(url, titel)),
  },
  ribbon: [
    e('start.infostundenplan', 'Start', 'Module', 'Aushang (HTML)', 'web', 'druck.info'),
    e('start.berichte', 'Start', 'Werkzeuge', 'Berichte', 'drucken', null, false, undefined, { menue: [
      { text: 'Klassenpläne drucken …', symbol: 'drucken', befehl: 'druck.stundenplaene', args: { typ: 'klasse' } },
      { text: 'Pläne der Lehrkräfte drucken …', symbol: 'drucken', befehl: 'druck.stundenplaene', args: { typ: 'lehrer' } },
      { text: 'Raumpläne drucken …', symbol: 'drucken', befehl: 'druck.stundenplaene', args: { typ: 'raum' } },
      null,
      { text: 'Vertretungsplan …', symbol: 'vertretung', befehl: 'druck.vertretung' },
      { text: 'Berichte (Listen, Auswertungen) …', symbol: 'statistik', befehl: 'druck.berichte' },
    ] }),
    e('stundenplaene.drucken', 'Stundenpläne', 'Ausgabe', 'Drucken', 'drucken', 'druck.stundenplaene', true, { typ: 'klasse' }, { taste: 'Strg+P' }),
    e('stundenplaene.html', 'Stundenpläne', 'Ausgabe', 'Aushang (HTML)', 'web', 'druck.info', true),
    e('stundenplaene.ical', 'Stundenpläne', 'Ausgabe', 'iCalendar', 'kalender', 'druck.ical', true),
    e('stundenplaene.berichte', 'Stundenpläne', 'Ausgabe', 'Berichte', 'statistik', 'druck.berichte', true),
    e('vertretung.ausgabe', 'Vertretungsplanung', 'Vertretungsplanung', 'Ausgabe', 'drucken', 'druck.vertretung', true, undefined, { hinweis: 'Vertretungsplan drucken (PDF), HTML und Monitor; Seitenlayout' }),
  ],
};
