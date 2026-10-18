// Modul „Kursplanung“: Kurse einer Klasse bzw. eines Jahrgangs (Kursname und Band änderbar), Kurswahlen der Schüler,
// Kollisionsmatrix, automatische Bandbildung mit Vorschlag und Übernahme der Bänder. Innere Reiter als Textreiter.
import { h } from '../kern/dom.js';
import { api } from '../kern/api.js';
import { zustand, darfSchreiben } from '../kern/zustand.js';
import { betrifft } from '../kern/ereignisse.js';
import { Tabelle } from '../kern/tabelle.js';
import { formular, frage, hinweis, laden, fehlerMelden } from '../kern/dialog.js';
import { fensterverwaltung } from '../kern/fenster.js';
import { werkzeugFeld, weitereAktionen } from './unterricht.js';

const REITER = [['kurse', 'Kurse'], ['wahlen', 'Kurswahlen'], ['matrix', 'Kollisionsmatrix'], ['baender', 'Bandbildung']];

function kursFenster(f, p) {
  f.titel('Kursplanung');
  const schreiben = darfSchreiben();
  let reiter = p.tab || 'kurse';
  let d = null;
  let vorschlag = null;
  const klasse = h('select', { class: 'eingabe', style: { width: '120px' }, 'aria-label': 'Klasse oder Jahrgang' });
  f.werkzeuge.append(werkzeugFeld('Klasse oder Jahrgang', klasse));
  f.trenner();
  f.werkzeug({ text: 'Schülerinnen und Schüler', titel: 'Stammdaten der Schülerinnen und Schüler', aktion: () => fensterverwaltung.oeffnen('stammdaten', { typ: 'schueler' }) });
  if (schreiben) weitereAktionen(f, () => [{ text: 'Fehlende Kurswahlen zufällig füllen (Testdaten) …', aktion: zufall }]);
  const leiste = h('div', { class: 'kp-reiterleiste', role: 'tablist' });
  const flaeche = h('div', { class: 'kp-flaeche' });
  const status = h('div', { class: 'kp-status' });
  f.inhalt.append(leiste, flaeche, status);
  let tabelle = null;

  function leisteZeichnen() {
    leiste.replaceChildren(...REITER.map(([id, t], i) => h('button', {
      type: 'button', role: 'tab', class: id === reiter ? 'aktiv' : '', 'aria-selected': String(id === reiter), tabindex: id === reiter ? '0' : '-1',
      onclick: () => { reiter = id; f.parameterSetzen({ tab: id }); zeichnen(); },
      onkeydown: (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        reiter = REITER[(i + (e.key === 'ArrowRight' ? 1 : -1) + REITER.length) % REITER.length][0];
        f.parameterSetzen({ tab: reiter });
        zeichnen();
        leiste.querySelector('.aktiv')?.focus();
      },
    }, t)));
  }

  function zeichnen() {
    leisteZeichnen();
    tabelle?.entfernen?.();
    tabelle = null;
    flaeche.replaceChildren();
    if (!d) return;
    status.textContent = d.status;
    status.classList.toggle('kp-kollision', d.kollisionen > 0);
    if (reiter === 'kurse') {
      tabelle = new Tabelle(flaeche, {
        zustandSchluessel: 'tabelle.kursplanung.kurse',
        aendern: schreiben ? async (z, s, wert) => { d = await api.patch(api.dok(`/kursplanung/${d.klasse.id}/kurs/${z.id}`), { feld: s.schluessel, wert }, { quelle: f.id }); setTimeout(zeichnen); return null; } : undefined,
        spalten: [['id', 'Unterricht', 80, false, 'rechts'], ['kursname', 'Kursname', 110, true], ['fach', 'Fach', 60], ['lehrer', 'Lehrkraft', 80], ['klassen', 'Klassen', 90], ['wst', 'Wochenstd.', 90, false, 'rechts'], ['band', 'Band', 90, true], ['teilnehmer', 'Teilnehmer', 90, false, 'rechts'], ['mw', 'm/w', 70, false, 'rechts']]
          .map(([schluessel, titel, breite, edit, ausrichtung]) => ({ schluessel, titel, breite, ausrichtung, art: edit && schreiben ? 'Text' : 'NurLesen', editierbar: !!edit && schreiben })),
        leerText: 'Diese Klasse hat keine Kurse.',
      });
      tabelle.daten(d.kurse);
    } else if (reiter === 'wahlen') {
      tabelle = new Tabelle(flaeche, {
        aendern: schreiben ? async (z, s, wert) => {
          d = await api.put(api.dok(`/kursplanung/${d.klasse.id}/wahl`), { schueler: z.id, kurs: s.kurs, gewaehlt: wert === 'X' || wert === 'true' || wert === 'x' }, { quelle: f.id });
          tabelle.daten(wahlZeilen());
          status.textContent = d.status;
          return null;
        } : undefined,
        spalten: [{ schluessel: 'name', titel: 'Schülerin bzw. Schüler', breite: 190, art: 'NurLesen', editierbar: false }, { schluessel: 'anzahl', titel: 'Kurse', breite: 60, art: 'NurLesen', editierbar: false, ausrichtung: 'rechts' },
          ...d.kurse.map((k) => ({ schluessel: `k${k.id}`, kurs: k.id, titel: k.kursname, breite: 76, art: schreiben ? 'Bool' : 'NurLesen', editierbar: schreiben, ausrichtung: 'mitte' }))],
        leerText: 'Diese Klasse hat keine Schülerinnen und Schüler.',
      });
      tabelle.daten(wahlZeilen());
    } else if (reiter === 'matrix') {
      tabelle = new Tabelle(flaeche, {
        spalten: [{ schluessel: 'kurs', titel: 'Kurs', breite: 120, art: 'NurLesen', editierbar: false },
          ...d.kurse.map((k, j) => ({ schluessel: `m${j}`, titel: k.kursname, hinweis: `${k.kursname} – Band ${k.band || 'ohne'}`, breite: 76, art: 'NurLesen', editierbar: false, ausrichtung: 'rechts', wert: (z) => (z.werte[j] > 0 ? z.werte[j] : ''),
            farbe: (z) => { if (z.werte[j] < 0) return 'var(--up-schiefer-100)'; const a = d.kurse[z.i]; return a.band && a.band === k.band ? (z.werte[j] > 0 ? 'var(--up-entfall-flaeche)' : 'var(--up-ok-flaeche)') : null; } }))],
      });
      tabelle.daten(d.kurse.map((k, i) => ({ id: k.id, i, kurs: `${k.kursname} (${k.band})`, werte: d.matrix[i] })));
    } else {
      const max = h('input', { class: 'eingabe', type: 'number', min: 1, max: 30, value: 10, id: 'kp-max', style: { width: '72px' } });
      flaeche.append(h('div', { class: 'kp-werkzeug' }, h('label', { class: 'pl-feld-titel', for: 'kp-max' }, 'Höchstens'), max, h('span', { class: 'pl-feld-titel' }, 'Bänder'),
        h('button', { class: 'knopf klein', type: 'button', onclick: async () => {
          const weg = laden(f.inhalt);
          try { vorschlag = await api.post(api.dok(`/kursplanung/${d.klasse.id}/bandbildung`), { maxBaender: Number(max.value) || 10 }); status.textContent = vorschlag.text; baender(); } catch (e) { fehlerMelden(e); } finally { weg(); }
        } }, 'Bandbildung starten'),
        h('button', { class: 'knopf klein', type: 'button', disabled: !schreiben, onclick: uebernehmen }, 'Bänder übernehmen'),
        h('span', { class: 'pl-hinweis-leiste' }, 'Zuerst einen Vorschlag berechnen, dann in den Unterricht übernehmen.')));
      baender();
    }
  }

  function wahlZeilen() {
    return d.schueler.map((s) => {
      const z = { id: s.id, name: s.name, anzahl: s.wahlen.length };
      for (const k of d.kurse) z[`k${k.id}`] = s.wahlen.includes(k.id) ? 'X' : '';
      return z;
    });
  }

  function baender() {
    tabelle?.entfernen?.();
    const quelle = vorschlag ? vorschlag.baender : d.baender;
    const max = Math.max(0, ...quelle.map((b) => b.kurse.length));
    const huelle = h('div', { class: 'kp-baender' });
    flaeche.querySelector('.kp-baender')?.remove();
    flaeche.append(huelle);
    tabelle = new Tabelle(huelle, {
      id: (z) => z.band,
      spalten: [{ schluessel: 'band', titel: vorschlag ? 'Band (Vorschlag)' : 'Band (aktuell)', breite: 130, art: 'NurLesen', editierbar: false },
        ...Array.from({ length: max }, (_, i) => ({ schluessel: `k${i}`, titel: `Kurs ${i + 1}`, breite: 100, art: 'NurLesen', editierbar: false, wert: (z) => z.kurse[i] || '' })),
        { schluessel: 'schueler', titel: 'Schüler', breite: 80, art: 'NurLesen', editierbar: false, ausrichtung: 'rechts' }],
      leerText: 'Noch keine Bänder – zuerst die Bandbildung starten.',
    });
    tabelle.daten(quelle);
  }

  async function uebernehmen() {
    if (!vorschlag) { hinweis('Bitte zuerst die Bandbildung starten.', 'warnung'); return; }
    const w = await formular('Bänder übernehmen', [{ name: 'praefix', titel: 'Präfix für die Bandbezeichnung', wert: d.klasse.kurz, pflicht: true }]);
    if (!w) return;
    d = await api.post(api.dok(`/kursplanung/${d.klasse.id}/baender`), { praefix: w.praefix, zuordnung: vorschlag.zuordnung }, { quelle: f.id });
    vorschlag = null;
    hinweis('Bänder in den Unterricht übernommen.', 'ok');
    zeichnen();
  }

  async function zufall() {
    if (!d || !(await frage('Für alle Schülerinnen und Schüler der Klasse ohne Kurswahl zufällig Kurse wählen (je Fach höchstens ein Kurs)? Gedacht für Testdaten.', { ja: 'Füllen', nein: 'Abbrechen' }))) return;
    d = await api.post(api.dok(`/kursplanung/${d.klasse.id}/zufall`), {}, { quelle: f.id });
    zeichnen();
  }

  async function laden_() {
    if (!klasse.value) { d = null; zeichnen(); flaeche.replaceChildren(h('div', { class: 'pl-leer' }, 'Es sind keine Klassen mit Kursen vorhanden.')); status.textContent = ''; return; }
    const weg = laden(f.inhalt);
    try { d = await api.get(api.dok(`/kursplanung/${klasse.value}`)); vorschlag = null; zeichnen(); } catch (e) { fehlerMelden(e); } finally { weg(); }
  }
  klasse.addEventListener('change', () => { f.parameterSetzen({ klasse: Number(klasse.value) }); laden_(); });

  async function start() {
    try {
      const liste = await api.get(api.dok('/kursplanung'));
      const alt = Number(klasse.value) || p.klasse;
      klasse.replaceChildren(...liste.map((k) => h('option', { value: k.id, selected: k.id === alt }, k.kurz)));
    } catch (e) { fehlerMelden(e); }
    await laden_();
  }
  f.an('daten', (e) => { if (e.quelle !== f.id && betrifft(e, 'Stammdaten', 'Unterricht')) start(); });
  start();
}

const oeffnen = () => { if (zustand.dokument) fensterverwaltung.oeffnen('kursplanung', {}); };

export default {
  id: 'kursplanung',
  css: ['css/module/kursplanung.css'],
  fenster: { kursplanung: { titel: 'Kursplanung', symbol: 'schueler', breite: 1080, hoehe: 580, einzig: () => 'kurs', erstellen: kursFenster } },
  befehle: { 'kursplanung.oeffnen': oeffnen },
  ribbon: [
    { id: 'start.kursplanung', reiter: 'Start', gruppe: 'Module', text: 'Kursplanung', symbol: 'schueler', befehl: 'kursplanung.oeffnen', braucht: 'dokument' },
    { id: 'kurs.kurse', reiter: 'Kursplanung', gruppe: 'Kursplanung', text: 'Kurse und Bänder', symbol: 'schueler', gross: true, befehl: 'kursplanung.oeffnen', braucht: 'dokument' },
  ],
};
