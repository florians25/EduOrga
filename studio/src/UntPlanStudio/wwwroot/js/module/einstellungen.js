// Modul „Einstellungen“: Einstellungen der Schuldatei – Schuldaten (Allgemein, Werte, Vertretungsplanung, Weiteres),
// Zeitraster (Zeiten, Vormittag/Nachmittag/leer, Pausen, Mittagspause), Kalender/Ferien (Jahreskalender, NRW-Vorschlag,
// Unterrichtsfrei/Feiertag je Tag), Perioden (Tochterperioden, aktive Periode, Fixierung) und Unterrichtsgruppen (Mehrwochen).
// Server: Api/EinstellungenSchuleApi.cs (/api/dokumente/{dok}/schule/…).
import { h, leeren } from '../kern/dom.js';
import { api } from '../kern/api.js';
import { zustand, darfSchreiben } from '../kern/zustand.js';
import { betrifft } from '../kern/ereignisse.js';
import { fensterverwaltung } from '../kern/fenster.js';
import { formular, frage, hinweis, fehlerMelden, laden } from '../kern/dialog.js';
import { befehl, befehlVorhanden } from '../kern/modulsystem.js';

const pfad = (p) => api.dok(`/schule${p}`);
const TAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const TAGE_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const datum = (s) => { const [y, m, t] = s.split('-').map(Number); return new Date(y, m - 1, t); };
const de = (s) => (s ? s.split('-').reverse().join('.') : '');
const kw = (d) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const n = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - n);
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
};

/** Eingabefeld mit Beschriftung in einer Formularzeile. */
function zeile(titel, el, hinweisText) {
  return [h('label', null, titel), el, hinweisText ? h('div', { class: 'hinweis' }, hinweisText) : null];
}
const textfeld = (wert, breite) => h('input', { class: 'eingabe', type: 'text', value: wert ?? '', style: breite ? { width: breite } : null });
const zahlfeld = (wert, min, max) => h('input', { class: 'eingabe', type: 'number', value: wert ?? 0, min, max, style: { width: '80px' } });
const datumfeld = (wert) => h('input', { class: 'eingabe', type: 'date', value: wert ?? '' });
const haken = (wert) => h('input', { type: 'checkbox', checked: !!wert });
/** Kontrollkästchen mit Text in der rechten Spalte einer Formularzeile. */
const schalterZeile = (text, el, hinweisText) => [h('span'), h('label', { class: 'kontrolle' }, el, text), hinweisText ? h('div', { class: 'hinweis' }, hinweisText) : null];
const auswahl = (wert, optionen) => h('select', { class: 'eingabe' }, optionen.map((o) => h('option', { value: o.wert, selected: String(o.wert) === String(wert) }, o.text)));

function nurLesen(f) {
  if (darfSchreiben()) return false;
  f.inhalt.classList.add('es-nurlesen');
  return true;
}

// ================================================================================================ Schuldaten

function schuldatenFenster(f, p) {
  let daten = null;
  let seite = p.seite || 'Allgemein';
  const lesen = nurLesen(f);
  if (seite === 'Diverses') seite = 'Weiteres';
  const baum = h('nav', { class: 'es-abschnitte', 'aria-label': 'Abschnitte' });
  const rechts = h('div', { class: 'es-seite' });
  f.inhalt.append(h('div', { class: 'es-zweispaltig' }, baum, rechts));
  const status = h('span', { class: 'leise' });
  const ueb = f.werkzeug({ text: 'Übernehmen', aktion: () => speichern() });
  ueb.disabled = lesen;
  const verw = f.werkzeug({ text: 'Verwerfen', aktion: () => { for (const k of Object.keys(werte)) delete werte[k]; geaendert = false; status.textContent = ''; zeichnen(); } });
  verw.disabled = lesen;
  f.fuss.replaceChildren(status);
  const werte = {};
  let geaendert = false;
  const merken = () => { geaendert = true; status.textContent = 'Geändert – mit „Übernehmen“ speichern.'; };

  const SEITEN = {
    Allgemein() {
      const formen = daten.schulformen.map((s) => ({ wert: s.wert, text: `${s.text} (${s.wert})` }));
      return [
        h('h3', null, 'Schule'),
        h('div', { class: 'formular' },
          zeile('Schulbezeichnung', feld('schulname', textfeld(daten.schulname))),
          zeile('Zusatz / Ort', feld('schulname2', textfeld(daten.schulname2))),
          zeile('Adresse', feld('adresse', textfeld(daten.adresse))),
          zeile('Schulnummer', feld('schulnummer', textfeld(daten.schulnummer, '120px')), 'In NRW sechsstellig'),
          zeile('Land', feld('land', textfeld(daten.land))),
          zeile('Bundesland', feld('region', textfeld(daten.region))),
          zeile('Schulform', feld('schulform', auswahl(daten.schulform, formen)))),
        h('h3', null, 'Schuljahr'),
        h('div', { class: 'formular' },
          zeile('Beginn', feld('schuljahrVon', datumfeld(daten.schuljahrVon))),
          zeile('Ende', feld('schuljahrBis', datumfeld(daten.schuljahrBis)), 'Die Sommerferien gehören nicht zum Schuljahr.'),
          zeile('Wochenperiodizität', feld('wochenperiodizitaet', zahlfeld(daten.wochenperiodizitaet, 1, 16), 'zahl'), '1 = jede Woche gleich, 2 = A/B-Wochen usw.'),
          zeile('Erste Schulwoche', feld('ersteSchulwoche', textfeld(daten.ersteSchulwoche, '60px')), 'Wochenbuchstabe der ersten Schulwoche (A, B …)')),
      ];
    },
    Werte() {
      return [
        h('h3', null, 'Soll und Ist'),
        h('div', { class: 'formular' },
          schalterZeile('Soll und Ist tagesgenau rechnen', feld('tagesgenaueWertrechnung', haken(daten.tagesgenaueWertrechnung), 'bool')),
          zeile('Mehrarbeit vergütet ab', h('span', { class: 'es-einheit' }, feld('mehrarbeitsgrenze', zahlfeld(daten.mehrarbeitsgrenze, 0, 40), 'zahl'), 'Std. je Monat'), 'Vergütet wird Mehrarbeit oberhalb dieses Werts (Regelung NRW).'),
          zeile('Pflichtstunden', h('span', { class: 'es-wertanzeige' }, `${daten.pflichtstunden} Std.`), 'Vorgabe der Schulform für neue Lehrkräfte')),
      ];
    },
    Vertretungsplanung() {
      const jg = [...daten.jahrgaenge.map((j) => ({ wert: j, text: j })), { wert: '99', text: 'nie' }];
      if (!jg.some((j) => j.wert === daten.entfallAbJahrgang)) jg.unshift({ wert: daten.entfallAbJahrgang, text: daten.entfallAbJahrgang });
      return [
        h('h3', null, 'Vertretungsplanung'),
        h('div', { class: 'formular' },
          zeile('Titel des Vertretungsplans', feld('vertretungsplantitel', textfeld(daten.vertretungsplantitel))),
          zeile('Entfall in Randstunden ab Jahrgang', feld('entfallAbJahrgang', auswahl(daten.entfallAbJahrgang, jg))),
          schalterZeile('Bereitschaften nur als Doppelstunden', feld('bereitschaftNurDoppelstunden', haken(daten.bereitschaftNurDoppelstunden), 'bool'))),
        h('h3', null, 'Gewichtung für den Vertretungsvorschlag'),
        h('p', { class: 'leise' }, '0 = ohne Bedeutung, 5 = sehr wichtig.'),
        h('div', { class: 'es-gewichtung' }, daten.kriterien.map((k) => {
          const w = h('span', { class: 'es-wert' }, String(daten.vertretungsgewichtung[k.schluessel] ?? k.standard));
          const r = h('input', { type: 'range', min: 0, max: 5, step: 1, value: daten.vertretungsgewichtung[k.schluessel] ?? k.standard, disabled: lesen });
          r.addEventListener('input', () => {
            w.textContent = r.value;
            werte.vertretungsgewichtung = { ...(werte.vertretungsgewichtung || {}), [k.schluessel]: Number(r.value) };
            merken();
          });
          return [h('label', null, k.text), r, w];
        })),
      ];
    },
    Weiteres() {
      const verweise = [
        ['Zeitraster', 'Stundenzeiten, Vormittag und Nachmittag, Pausen', () => fensterverwaltung.oeffnen('einstellungen.zeitraster')],
        ['Kalender und Ferien', 'Ferien, Feiertage und unterrichtsfreie Tage', () => fensterverwaltung.oeffnen('einstellungen.ferien')],
        ['Perioden', 'Zeitabschnitte mit eigenem Unterricht und Stundenplan', () => fensterverwaltung.oeffnen('einstellungen.perioden')],
        ['Unterrichtsgruppen', 'Unterricht in einzelnen Wochen oder Zeiträumen', () => fensterverwaltung.oeffnen('einstellungen.ugruppen')],
        zustand.benutzer?.rolle === 'Admin' && befehlVorhanden('datei.backstage')
          ? ['Benutzerverwaltung', 'Benutzer, Rollen und Passwörter', () => befehl('datei.backstage', { seite: 'benutzer' })] : null,
      ].filter(Boolean);
      return [
        h('h3', null, 'Weitere Angaben'),
        h('div', { class: 'formular' },
          schalterZeile('Unterrichtsänderungen in Folgeperioden übernehmen', feld('unterrichtInFolgeperioden', haken(daten.unterrichtInFolgeperioden), 'bool')),
          zeile('Farbschema im Druck', feld('farbschema', auswahl(daten.farbschema, ['Blau', 'Grün', 'Grau', 'Dunkel'].map((x) => ({ wert: x, text: x })))))),
        h('h3', null, 'Verwandte Einstellungen'),
        h('div', { class: 'es-verweise' }, verweise.map(([titel, text, aktion]) =>
          h('button', { type: 'button', class: 'es-verweis', onclick: () => Promise.resolve().then(aktion).catch(fehlerMelden) }, h('span', null, titel), h('span', { class: 'leise' }, text)))),
        h('p', { class: 'leise' }, 'Persönliche Einstellungen wie Seitenaufteilung und Spaltenbreiten speichert das Studio je Benutzer automatisch.'),
      ];
    },
  };

  function feld(name, el, art) {
    el.disabled = lesen;
    el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => {
      werte[name] = art === 'bool' ? el.checked : art === 'zahl' ? Number(el.value) : el.value;
      merken();
    });
    if (werte[name] !== undefined) { if (art === 'bool') el.checked = werte[name]; else el.value = werte[name]; }
    return el;
  }

  function zeichnen() {
    leeren(baum);
    for (const [k, titel] of [['Allgemein', 'Allgemein'], ['Werte', 'Soll und Ist'], ['Vertretungsplanung', 'Vertretungsplanung'], ['Weiteres', 'Weiteres']]) {
      baum.append(h('button', { type: 'button', class: `es-knoten${seite === k ? ' aktiv' : ''}`, 'aria-current': seite === k ? 'true' : null, dataset: { seite: k },
        onclick: () => { seite = k; f.parameterSetzen({ seite }); zeichnen(); } }, titel));
    }
    rechts.replaceChildren(...(SEITEN[seite] || SEITEN.Allgemein)().flat(3).filter(Boolean));
  }

  async function laden_() {
    const weg = laden(f.inhalt);
    try { daten = await api.get(pfad('/schuldaten')); zeichnen(); } finally { weg(); }
  }

  async function speichern() {
    if (!Object.keys(werte).length) { hinweis('Keine Änderungen.', 'info', 1500); return; }
    daten = await api.put(pfad('/schuldaten'), werte, { quelle: f.id });
    for (const k of Object.keys(werte)) delete werte[k];
    geaendert = false;
    status.textContent = 'Übernommen.';
    hinweis('Einstellungen übernommen – Strg+Z macht es rückgängig.', 'ok', 2000);
    zeichnen();
  }

  f.an('daten', (e) => { if (e.quelle !== f.id && !geaendert && betrifft(e, 'Einstellungen')) laden_().catch(() => {}); });
  laden_().catch(fehlerMelden);
}

// ================================================================================================ Zeitraster

function zeitrasterFenster(f) {
  let z = null;
  let reiter = 'allgemein';
  const lesen = nurLesen(f);
  const auswahlZellen = new Set();
  let ziehen = null;
  const loslassen = () => { ziehen = null; };
  document.addEventListener('pointerup', loslassen);
  f.beimSchliessen(() => document.removeEventListener('pointerup', loslassen));
  const status = h('span', { class: 'leise' });
  f.fuss.replaceChildren(status);
  const ueb = f.werkzeug({ text: 'Übernehmen', aktion: () => speichern() });
  ueb.disabled = lesen;
  f.werkzeug({ text: 'Verwerfen', aktion: () => laden_() });
  const reiterleiste = h('div', { class: 'es-reiter' });
  const koerper = h('div', { class: 'es-seite' });
  f.inhalt.append(reiterleiste, koerper);
  const merken = () => { status.textContent = 'Geändert – mit „Übernehmen“ speichern.'; };
  const standard = (st) => (st <= z.letzteVormittagsstunde ? 'V' : 'N');

  function anpassen() {
    // Zeiten und Belegung an Tage/Stunden anpassen (neue Stunden: 55 Minuten Abstand)
    while (z.zeiten.length < z.stundenProTag) {
      const l = z.zeiten[z.zeiten.length - 1];
      const [hh, mm] = (l?.beginn || '07:05').split(':').map(Number);
      const b = hh * 60 + mm + 55;
      const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      z.zeiten.push({ nr: z.zeiten.length + 1, beginn: fmt(b), ende: fmt(b + (z.normalstundeMinuten || 45)) });
    }
    z.zeiten.length = z.stundenProTag;
    while (z.belegung.length < z.tageProWoche) z.belegung.push([]);
    z.belegung.length = z.tageProWoche;
    for (const t of z.belegung) {
      while (t.length < z.stundenProTag) t.push(standard(t.length + 1));
      t.length = z.stundenProTag;
    }
  }

  function zahl(titel, schluessel, min, max, nachher) {
    const el = zahlfeld(z[schluessel], min, max);
    el.disabled = lesen;
    el.addEventListener('change', () => {
      const v = Math.max(min, Math.min(max, Number(el.value) || min));
      const alt = z[schluessel];
      z[schluessel] = v;
      nachher?.(alt, v);
      merken();
      zeichnen();
    });
    return zeile(titel, el);
  }

  function allgemein() {
    const erster = auswahl(z.ersterSchultag, TAGE.map((t, i) => ({ wert: i, text: t })));
    erster.disabled = lesen;
    erster.addEventListener('change', () => { z.ersterSchultag = Number(erster.value); merken(); zeichnen(); });
    const nummer = auswahl(z.ersteStundennummer, [{ wert: 0, text: '0' }, { wert: 1, text: '1' }]);
    nummer.disabled = lesen;
    nummer.addEventListener('change', () => { z.ersteStundennummer = Number(nummer.value); merken(); zeichnen(); });
    const kopf = h('div', { class: 'es-zr-kopf' },
      h('div', { class: 'formular' },
        zahl('Schultage je Woche', 'tageProWoche', 1, 7, () => anpassen()),
        zahl('Stunden je Tag (höchstens)', 'stundenProTag', 1, 16, () => anpassen()),
        zahl('Letzte Vormittagsstunde', 'letzteVormittagsstunde', 1, 16, (alt) => {
          for (const t of z.belegung) t.forEach((w, i) => { const st = i + 1; const vorher = st <= alt ? 'V' : 'N'; if (w === vorher) t[i] = standard(st); });
        }),
        zahl('Nachmittagsstunden (höchstens)', 'maxNachmittagsstunden', 0, 16)),
      h('div', { class: 'formular' },
        zeile('Erster Schultag der Woche', erster),
        zeile('Nummer der ersten Stunde', nummer),
        zahl('Dauer einer Stunde (Minuten)', 'normalstundeMinuten', 10, 120)));
    const eintragung = h('div', { class: 'es-eintragung' },
      h('span', { class: 'leise' }, 'Markierte Zellen:'),
      h('div', { class: 'segment' }, ['V', 'N', ''].map((w) => h('button', { type: 'button', disabled: lesen, onclick: () => markieren(w) }, w === 'V' ? 'Vormittag' : w === 'N' ? 'Nachmittag' : 'Leer'))),
      h('span', { class: 'leise es-zr-tipp' }, 'Zellen durch Ziehen oder mit Strg+Klick markieren.'));

    const tab = h('table', { class: 'es-zr' });
    const label = (s) => String(s - 1 + z.ersteStundennummer);
    tab.append(h('tr', null, h('th'), Array.from({ length: z.stundenProTag }, (_, i) => h('th', null, label(i + 1)))));
    for (const [art, titel] of [['beginn', 'Beginn'], ['ende', 'Ende']]) {
      tab.append(h('tr', null, h('th', { class: 'links' }, titel), z.zeiten.map((t) => {
        const el = h('input', { class: 'es-zeit', value: t[art], disabled: lesen, title: `Stunde ${label(t.nr)}: ${titel}` });
        el.addEventListener('change', () => {
          if (art === 'beginn' && t.beginn && t.ende) {
            // Beginn verschiebt das Ende um die bisherige Dauer
            const m = (s) => { const [a, b] = s.split(':').map(Number); return a * 60 + b; };
            const neu = /^\d{1,2}[:.]\d{2}$/.test(el.value.trim()) ? m(el.value.trim().replace('.', ':')) : null;
            if (neu !== null) {
              const dauer = m(t.ende) - m(t.beginn);
              const e = neu + (dauer > 0 ? dauer : z.normalstundeMinuten);
              t.ende = `${String(Math.floor(e / 60)).padStart(2, '0')}:${String(e % 60).padStart(2, '0')}`;
            }
          }
          t[art] = el.value.trim();
          merken();
          zeichnen();
        });
        return h('td', null, el);
      })));
    }
    for (let t = 0; t < z.tageProWoche; t++) {
      tab.append(h('tr', null, h('th', { class: 'links' }, TAGE[(z.ersterSchultag + t) % 7]), z.belegung[t].map((w, i) => {
        const key = `${t}:${i}`;
        const td = h('td', { class: `es-zr-zelle es-zr-${w || 'L'}${auswahlZellen.has(key) ? ' gewaehlt' : ''}`, dataset: { key } }, w === 'V' ? 'Vorm.' : w === 'N' ? 'Nachm.' : '');
        td.addEventListener('pointerdown', (ev) => {
          if (!ev.ctrlKey && !ev.shiftKey) auswahlZellen.clear();
          ziehen = { t, i };
          auswahlZellen.add(key);
          markierungZeigen();
        });
        td.addEventListener('pointerenter', () => {
          if (!ziehen) return;
          for (let a = Math.min(ziehen.t, t); a <= Math.max(ziehen.t, t); a++)
            for (let b = Math.min(ziehen.i, i); b <= Math.max(ziehen.i, i); b++) auswahlZellen.add(`${a}:${b}`);
          markierungZeigen();
        });
        return td;
      })));
    }
    return [h('h3', null, 'Woche und Stunden'), kopf, h('h3', null, 'Stundenzeiten und Belegung'), eintragung, h('div', { class: 'es-zr-rahmen' }, tab),
      h('p', { class: 'leise' }, 'Die ersten beiden Zeilen enthalten Beginn und Ende der Stunden; eine geänderte Beginnzeit verschiebt das Ende um die bisherige Dauer.')];
  }

  function markierungZeigen() {
    for (const td of koerper.querySelectorAll('.es-zr-zelle')) td.classList.toggle('gewaehlt', auswahlZellen.has(td.dataset.key));
  }

  function markieren(w) {
    for (const k of auswahlZellen) { const [t, i] = k.split(':').map(Number); if (z.belegung[t]) z.belegung[t][i] = w; }
    merken();
    zeichnen();
  }

  function pausen() {
    const tab = h('table', { class: 'es-liste' });
    tab.append(h('tr', null, [['Nach Stunde', 'zahl'], ['Bezeichnung'], ['Dauer (Min.)', 'zahl'], ['Aufsicht', 'mitte'], ['']].map(([t, k]) => h('th', { class: k }, t))));
    z.pausen.sort((a, b) => a.nachStunde - b.nachStunde).forEach((pa, i) => {
      const nach = zahlfeld(pa.nachStunde, 0, z.stundenProTag);
      const bez = textfeld(pa.bezeichnung);
      const dauer = zahlfeld(pa.dauerMinuten, 0, 240);
      const auf = haken(pa.aufsicht);
      for (const el of [nach, bez, dauer, auf]) {
        el.disabled = lesen;
        el.addEventListener('change', () => {
          Object.assign(pa, { nachStunde: Number(nach.value), bezeichnung: bez.value, dauerMinuten: Number(dauer.value), aufsicht: auf.checked });
          merken();
        });
      }
      tab.append(h('tr', null, h('td', { class: 'zahl' }, nach), h('td', null, bez), h('td', { class: 'zahl' }, dauer), h('td', { class: 'mitte' }, auf),
        h('td', { class: 'aktion' }, h('button', { class: 'knopf klein still', type: 'button', disabled: lesen, onclick: () => { z.pausen.splice(i, 1); merken(); zeichnen(); } }, 'Entfernen'))));
    });
    if (!z.pausen.length) tab.append(h('tr', null, h('td', { colspan: 5, class: 'es-leer' }, 'Keine Pausen eingetragen.')));
    const neu = h('button', { class: 'knopf klein', type: 'button', disabled: lesen, onclick: () => {
      const frei = Array.from({ length: z.stundenProTag }, (_, i) => i + 1).find((s) => !z.pausen.some((x) => x.nachStunde === s)) ?? 0;
      z.pausen.push({ nachStunde: frei, bezeichnung: '', dauerMinuten: 15, aufsicht: true });
      merken();
      zeichnen();
    } }, 'Pause hinzufügen');
    return [
      h('h3', null, 'Pausen'), tab, h('div', { class: 'es-knoepfe' }, neu),
      h('p', { class: 'leise' }, '„Nach Stunde 0“ steht für die Frühaufsicht.'),
      h('h3', null, 'Mittagspause'),
      h('div', { class: 'formular' },
        zahl('Frühestens ab Stunde', 'mittagspauseVon', 0, 16),
        zahl('Spätestens bis Stunde', 'mittagspauseBis', 0, 16),
        zahl('Klassen mit gleichzeitiger Mittagspause (höchstens)', 'maxKlassenGleicheMittagspause', 0, 500)),
      h('p', { class: 'leise' }, '0 bei „Frühestens ab Stunde“ bedeutet keine Mittagspause. Die Planung legt sie in die letzten Vormittags- bzw. ersten Nachmittagsstunden; die Länge legen Sie bei den Klassen fest.'),
    ];
  }

  function zeichnen() {
    reiterleiste.replaceChildren(...[['allgemein', 'Allgemein'], ['pausen', 'Pausen']].map(([k, t]) =>
      h('button', { type: 'button', class: `es-reiterknopf${reiter === k ? ' aktiv' : ''}`, onclick: () => { reiter = k; zeichnen(); } }, t)));
    koerper.replaceChildren(...(reiter === 'pausen' ? pausen() : allgemein()).flat(2).filter(Boolean));
  }

  async function laden_() {
    const weg = laden(f.inhalt);
    try {
      const d = await api.get(pfad('/zeitraster'));
      z = { ...d, zeiten: d.zeiten.map((t) => ({ nr: t.nr, beginn: t.beginn, ende: t.ende })), belegung: d.belegung.map((t) => [...t]), pausen: d.pausen.map((x) => ({ ...x })) };
      status.textContent = '';
      auswahlZellen.clear();
      zeichnen();
    } finally { weg(); }
  }

  async function speichern() {
    const d = await api.put(pfad('/zeitraster'), {
      tageProWoche: z.tageProWoche, stundenProTag: z.stundenProTag, ersterSchultag: z.ersterSchultag, ersteStundennummer: z.ersteStundennummer,
      letzteVormittagsstunde: z.letzteVormittagsstunde, maxNachmittagsstunden: z.maxNachmittagsstunden, normalstundeMinuten: z.normalstundeMinuten,
      zeiten: z.zeiten, belegung: z.belegung, pausen: z.pausen.map(({ nachStunde, bezeichnung, dauerMinuten, aufsicht }) => ({ nachStunde, bezeichnung, dauerMinuten, aufsicht })),
      mittagspauseVon: z.mittagspauseVon, mittagspauseBis: z.mittagspauseBis, maxKlassenGleicheMittagspause: z.maxKlassenGleicheMittagspause,
    }, { quelle: f.id });
    z = { ...d, zeiten: d.zeiten.map((t) => ({ nr: t.nr, beginn: t.beginn, ende: t.ende })), belegung: d.belegung.map((t) => [...t]), pausen: d.pausen.map((x) => ({ ...x })) };
    status.textContent = 'Übernommen.';
    hinweis('Zeitraster übernommen – Strg+Z macht es rückgängig.', 'ok', 2000);
    zeichnen();
  }

  laden_().catch(fehlerMelden);
}

// ================================================================================================ Kalender / Ferien

function ferienFenster(f) {
  let d = null;
  let gewaehlt = null;      // ISO-Datum im Kalender
  let anker = null;          // Beginn einer Bereichsauswahl (Umschalt+Klick)
  let markiert = new Set();  // Ferien-Ids in der Liste
  const lesen = nurLesen(f);
  const liste = h('div', { class: 'es-ferienliste' });
  const kalender = h('div', { class: 'es-kalender' });
  const info = h('div', { class: 'es-tag' });
  const jahr = h('div', { class: 'es-jahresdaten' });
  f.inhalt.append(h('div', { class: 'es-ferien' }, h('div', { class: 'es-ferien-links' }, liste, jahr), h('div', { class: 'es-ferien-rechts' }, info, kalender)));
  const k1 = f.werkzeug({ text: 'Neue Ferien …', aktion: () => neu() });
  const k2 = f.werkzeug({ text: 'Löschen', aktion: () => loeschen() });
  f.trenner();
  const k3 = f.werkzeug({ text: 'Ferien und Feiertage NRW eintragen …', aktion: () => nrw() });
  for (const k of [k1, k2, k3]) k.disabled = lesen;
  f.fuss.replaceChildren(h('span', { class: 'es-legende' },
    h('i', { class: 'schultag' }), 'Schultag', h('i', { class: 'ferien' }), 'Ferien', h('i', { class: 'feiertag' }), 'Feiertag', h('i', { class: 'auswahl' }), 'Auswahl'),
    h('span', { class: 'rechts leise' }, 'Umschalt+Klick wählt einen Zeitraum, Doppelklick legt Ferien an.'));

  const ferienAm = (t) => d.ferien.filter((x) => t >= x.von && t <= x.bis).sort((a, b) => a.tage - b.tage)[0];

  async function senden(promise) { d = await promise; zeichnen(); }

  function feldAendern(fe, feld, wert) {
    return senden(api.patch(pfad(`/ferien/${fe.id}`), { feld, wert: String(wert) }, { quelle: f.id })).catch((e) => { fehlerMelden(e); zeichnen(); });
  }

  function zeichneListe() {
    const tab = h('table', { class: 'es-liste' });
    tab.append(h('tr', null, [['Kurzname'], ['Bezeichnung'], ['Von'], ['Bis'], ['Tage', 'zahl'], ['Woche danach', '', 'Wochenbuchstabe der ersten Woche nach den Ferien'], ['Wochen zählen', 'mitte', 'Wochen während der Ferien mitzählen'], ['Feiertag', 'mitte']]
      .map(([t, k, titel]) => h('th', { class: k, title: titel }, t))));
    for (const fe of d.ferien) {
      const tr = h('tr', { class: markiert.has(fe.id) ? 'gewaehlt' : '' });
      tr.addEventListener('click', (ev) => {
        if (ev.target.tagName === 'INPUT') return;
        if (!ev.ctrlKey) markiert = new Set();
        markiert.has(fe.id) && ev.ctrlKey ? markiert.delete(fe.id) : markiert.add(fe.id);
        gewaehlt = fe.von;
        zeichnen();
      });
      const txt = (feld, w, breite) => { const el = textfeld(w, breite); el.disabled = lesen; el.addEventListener('change', () => feldAendern(fe, feld, el.value)); return h('td', null, el); };
      const dat = (feld, w) => { const el = datumfeld(w); el.disabled = lesen; el.addEventListener('change', () => el.value && feldAendern(fe, feld, el.value)); return h('td', null, el); };
      const bool = (feld, w) => { const el = haken(w); el.disabled = lesen; el.addEventListener('change', () => feldAendern(fe, feld, el.checked ? 'X' : '')); return h('td', { class: 'mitte' }, el); };
      tr.append(txt('kurzname', fe.kurzname, '70px'), txt('langname', fe.langname), dat('von', fe.von), dat('bis', fe.bis), h('td', { class: 'zahl' }, fe.tage),
        txt('wocheDanach', fe.wocheDanach, '40px'), bool('wochennummerierung', fe.wochennummerierung), bool('feiertag', fe.feiertag));
      tab.append(tr);
    }
    if (!d.ferien.length) tab.append(h('tr', null, h('td', { colspan: 8, class: 'es-leer' }, 'Noch keine Ferien eingetragen.')));
    liste.replaceChildren(tab);
    const j = d.jahresdaten;
    const paar = (k, v) => [h('dt', null, k), h('dd', null, v)];
    jahr.replaceChildren(h('dl', null,
      paar('Schuljahr', `${de(d.schuljahrVon)} – ${de(d.schuljahrBis)}`), paar('Kalendertage', j.schuljahrTage), paar('Wochen', j.schuljahrWochen),
      paar('Ferienabschnitte', j.anzahlFerien), paar('Feiertage', j.anzahlFeiertage),
      paar('Unterrichtstage', j.unterrichtTage), paar('Unterrichtswochen', j.unterrichtWochen), paar('Ferientage', j.ferientage)));
  }

  function bereich() {
    if (!gewaehlt) return null;
    const a = anker || gewaehlt;
    return a <= gewaehlt ? [a, gewaehlt] : [gewaehlt, a];
  }

  function zeichneKalender() {
    const von = datum(d.schuljahrVon);
    const start = new Date(von.getFullYear(), von.getMonth() - 1, 1);
    const ende = datum(d.schuljahrBis);
    const [bv, bb] = bereich() || [null, null];
    const schultag = (t, wd) => t >= d.schuljahrVon && t <= d.schuljahrBis && ((wd - d.ersterSchultag + 7) % 7) < d.tageProWoche;
    const monate = [];
    for (let m = new Date(start); m <= new Date(ende.getFullYear(), ende.getMonth() + 1, 1); m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      const tab = h('table', { class: 'es-monat' });
      tab.append(h('caption', null, `${MONATE[m.getMonth()]} ${m.getFullYear()}`), h('tr', null, h('th', { class: 'kw' }, 'KW'), TAGE_KURZ.map((t) => h('th', null, t))));
      const erster = (m.getDay() + 6) % 7;
      let tr = h('tr', null, h('td', { class: 'kw' }, kw(m)));
      for (let i = 0; i < erster; i++) tr.append(h('td'));
      const tage = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      for (let t = 1; t <= tage; t++) {
        const dt = new Date(m.getFullYear(), m.getMonth(), t);
        const wd = (dt.getDay() + 6) % 7;
        if (wd === 0 && t > 1) { tab.append(tr); tr = h('tr', null, h('td', { class: 'kw' }, kw(dt))); }
        const s = iso(dt);
        const fe = ferienAm(s);
        const kl = ['tag', wd >= 5 ? 'we' : '', fe ? (fe.feiertag ? 'feiertag' : 'ferien') : schultag(s, wd) ? 'schultag' : '', bv && s >= bv && s <= bb ? 'auswahl' : '', s === gewaehlt ? 'aktiv' : ''];
        const td = h('td', { class: kl.filter(Boolean).join(' '), title: fe ? `${fe.langname || fe.kurzname} (${de(fe.von)} – ${de(fe.bis)})` : de(s), dataset: { d: s } }, t);
        td.addEventListener('click', (ev) => {
          if (ev.shiftKey && gewaehlt) { anker = anker || gewaehlt; gewaehlt = s; }
          else { anker = null; gewaehlt = s; }
          markiert = new Set(fe ? [fe.id] : []);
          zeichnen();
        });
        td.addEventListener('dblclick', () => { if (!lesen) neu(); });
        tr.append(td);
      }
      tab.append(tr);
      monate.push(tab);
    }
    kalender.replaceChildren(...monate);
    // Tagesinfo
    if (!gewaehlt) { info.replaceChildren(h('span', { class: 'leise' }, 'Tag im Kalender wählen.')); return; }
    const dt = datum(gewaehlt);
    const fe = ferienAm(gewaehlt);
    const frei = haken(!!fe);
    const feier = haken(fe?.feiertag);
    frei.disabled = feier.disabled = lesen || (bv !== bb);
    const umschalten = () => senden(api.post(pfad('/ferien/tag'), { datum: gewaehlt, unterrichtsfrei: frei.checked, feiertag: feier.checked }, { quelle: f.id })).catch(fehlerMelden);
    frei.addEventListener('change', () => { if (!frei.checked) feier.checked = false; umschalten(); });
    feier.addEventListener('change', umschalten);
    info.replaceChildren(...[
      h('b', null, bv !== bb ? `Zeitraum ${de(bv)} – ${de(bb)}` : `${TAGE_KURZ[(dt.getDay() + 6) % 7]} ${dt.getDate()}.${dt.getMonth() + 1}.${dt.getFullYear()}`),
      h('span', { class: 'leise' }, `Kalenderwoche ${kw(dt)}`),
      h('label', { class: 'kontrolle' }, frei, 'Unterrichtsfrei'), h('label', { class: 'kontrolle' }, feier, 'Feiertag'),
      fe ? h('span', { class: 'es-tag-name' }, fe.langname || fe.kurzname) : null,
      bv !== bb && !lesen ? h('button', { class: 'knopf klein', type: 'button', onclick: () => neu() }, 'Ferien für den Zeitraum anlegen …') : null].filter(Boolean));
  }

  function zeichnen() { zeichneListe(); zeichneKalender(); }

  async function neu() {
    const [v, b] = bereich() || [d.schuljahrVon, d.schuljahrVon];
    const w = await formular('Neue Ferien', [
      { name: 'kurzname', titel: 'Kurzname', wert: v === b ? `${Number(v.slice(8))}.${Number(v.slice(5, 7))}` : 'Ferien', pflicht: true },
      { name: 'langname', titel: 'Bezeichnung', wert: v === b ? de(v) : `Ferien ${de(v)} – ${de(b)}` },
      { name: 'von', titel: 'Von (TT.MM.JJJJ)', wert: de(v), pflicht: true },
      { name: 'bis', titel: 'Bis (TT.MM.JJJJ)', wert: de(b), pflicht: true },
      { name: 'feiertag', titel: 'Feiertag', art: 'bool', wert: false },
    ], { okText: 'Anlegen' });
    if (!w) return;
    const isoAus = (s) => { const m = s.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); if (!m) throw new Error(`Ungültiges Datum „${s}“ (TT.MM.JJJJ).`); return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; };
    await senden(api.post(pfad('/ferien'), { kurzname: w.kurzname, langname: w.langname, von: isoAus(w.von), bis: isoAus(w.bis), feiertag: w.feiertag }, { quelle: f.id }));
    anker = null;
    hinweis('Ferien angelegt.', 'ok', 1500);
  }

  async function loeschen() {
    const ids = [...markiert];
    if (!ids.length) { hinweis('Bitte zuerst Ferien in der Liste oder im Kalender wählen.', 'warnung'); return; }
    if (!(await frage(ids.length === 1 ? 'Den gewählten Ferieneintrag löschen?' : `${ids.length} Ferieneinträge löschen?`, { ja: 'Löschen', gefahr: true }))) return;
    markiert = new Set();
    await senden(api.post(pfad('/ferien/loeschen'), { ids }, { quelle: f.id }));
  }

  async function nrw() {
    if (!(await frage('Ferien und gesetzliche Feiertage NRW für das Schuljahr eintragen? Vorhandene Einträge bleiben erhalten.'))) return;
    await senden(api.post(pfad('/ferien/nrw'), {}, { quelle: f.id }));
    hinweis('Ferien und Feiertage NRW eingetragen – Strg+Z macht es rückgängig.', 'ok');
  }

  async function laden_() {
    const weg = laden(f.inhalt);
    try { d = await api.get(pfad('/ferien')); zeichnen(); } finally { weg(); }
  }
  f.an('daten', (e) => { if (e.quelle !== f.id && betrifft(e, 'Einstellungen')) laden_().catch(() => {}); });
  laden_().catch(fehlerMelden);
}

// ================================================================================================ Perioden

function periodenFenster(f) {
  let d = null;
  let gewaehlt = null;
  const lesen = nurLesen(f);
  const links = h('div', { class: 'es-perioden-liste' });
  const rechts = h('div', { class: 'es-seite' });
  f.inhalt.append(h('div', { class: 'es-zweispaltig breit' }, links, rechts));

  async function senden(pr, text) { d = await pr; if (text) hinweis(text, 'ok', 2000); zeichnen(); }

  function zeichnen() {
    if (!d.perioden.some((p) => p.id === gewaehlt)) gewaehlt = d.aktiv;
    const tab = h('table', { class: 'es-liste' });
    tab.append(h('tr', null, [['Name'], ['Bezeichnung'], ['Von'], ['Bis'], ['Schultage', 'zahl'], ['Übergeordnet'], ['Status']].map(([t, k]) => h('th', { class: k }, t))));
    for (const p of d.perioden) {
      tab.append(h('tr', { class: `${p.id === gewaehlt ? 'gewaehlt' : ''}${p.aktiv ? ' aktiv' : ''}`, tabindex: 0, onclick: () => { gewaehlt = p.id; zeichnen(); },
        onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); gewaehlt = p.id; zeichnen(); } } },
        h('td', { style: { paddingLeft: `${8 + p.ebene * 16}px` } }, p.aktiv ? h('b', null, p.name) : p.name), h('td', null, p.langname),
        h('td', { class: 'datum' }, de(p.von)), h('td', { class: 'datum' }, p.bis ? de(p.bis) : h('span', { class: 'leise' }, de(p.ende))), h('td', { class: 'zahl' }, p.schultage),
        h('td', null, p.mutter || ''),
        h('td', null, p.aktiv ? h('span', { class: 'plakette es-aktiv' }, 'Aktiv') : null, p.fixiert ? h('span', { class: 'plakette' }, 'Fixiert') : null)));
    }
    const folge = haken(d.unterrichtInFolgeperioden);
    folge.disabled = lesen;
    folge.addEventListener('change', () => senden(api.put(pfad('/perioden/folgeperioden'), { wert: folge.checked }, { quelle: f.id })).catch(fehlerMelden));
    links.replaceChildren(tab, h('div', { class: 'es-unter' },
      h('label', { class: 'kontrolle' }, folge, 'Unterrichtsänderungen in Folgeperioden übernehmen'),
      h('p', { class: 'leise' }, 'Eine untergeordnete Periode übernimmt Unterricht, Stundenplan und Pausenaufsichten der übergeordneten. An jedem Tag gilt die zuletzt beginnende Periode. Die aktive Periode wird in allen Ansichten bearbeitet.')));

    const p = d.perioden.find((x) => x.id === gewaehlt);
    if (!p) { rechts.replaceChildren(); return; }
    const name = textfeld(p.name);
    const lang = textfeld(p.langname);
    const von = datumfeld(p.von);
    const bis = datumfeld(p.bis || '');
    const fix = haken(p.fixiert);
    for (const el of [name, lang, von, bis, fix]) el.disabled = lesen;
    rechts.replaceChildren(
      h('h3', null, /^periode/i.test(p.name) ? p.name : `Periode ${p.name}`),
      h('p', { class: 'leise' }, `${p.unterrichte} Unterrichte, ${p.planstunden} verplante Stunden, ${p.schultage} Schultage`),
      h('div', { class: 'formular' }, zeile('Name', name), zeile('Bezeichnung', lang), zeile('Von', von), zeile('Bis', bis, `Leer bedeutet bis ${de(p.ende)}.`),
        schalterZeile('Fixiert', fix, 'Unterricht und Stundenplan sind dann gegen Änderungen gesperrt.')),
      h('div', { class: 'es-knoepfe' },
        h('button', { class: 'knopf primaer', type: 'button', disabled: lesen, onclick: () => senden(api.put(pfad(`/perioden/${p.id}`), { name: name.value, langname: lang.value, von: von.value, bis: bis.value || null, fixiert: fix.checked }, { quelle: f.id }), 'Periode geändert.').catch(fehlerMelden) }, 'Übernehmen'),
        h('button', { class: 'knopf', type: 'button', disabled: lesen || p.aktiv, onclick: () => senden(api.post(pfad(`/perioden/${p.id}/aktiv`), {}, { quelle: f.id }), `${p.name} ist jetzt die aktive Periode.`).catch(fehlerMelden) }, 'Als aktive Periode setzen'),
        h('button', { class: 'knopf', type: 'button', disabled: lesen, onclick: () => neu(p).catch(fehlerMelden) }, 'Untergeordnete Periode …'),
        h('button', { class: 'knopf gefahr', type: 'button', disabled: lesen || d.perioden.length <= 1, onclick: () => loeschen(p).catch(fehlerMelden) }, 'Löschen')));
  }

  async function neu(mutter) {
    const w = await formular(`Neue Periode unter ${mutter.name}`, [
      { name: 'name', titel: 'Name', wert: `Periode${d.perioden.length + 1}`, pflicht: true },
      { name: 'von', titel: 'Von (TT.MM.JJJJ)', wert: de(mutter.von), pflicht: true },
      { name: 'bis', titel: 'Bis (leer = offen)', wert: '' },
    ], { okText: 'Anlegen' });
    if (!w) return;
    const isoAus = (s) => { if (!s.trim()) return null; const m = s.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); if (!m) throw new Error(`Ungültiges Datum „${s}“ (TT.MM.JJJJ).`); return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; };
    await senden(api.post(pfad('/perioden'), { mutterId: mutter.id, name: w.name, von: isoAus(w.von), bis: isoAus(w.bis) }, { quelle: f.id }), 'Periode angelegt.');
    gewaehlt = d.perioden.find((x) => x.name === w.name.trim())?.id ?? gewaehlt;
    zeichnen();
  }

  async function loeschen(p) {
    if (!(await frage(`Periode ${p.name} mit Unterricht und Stundenplan löschen? Untergeordnete Perioden gehören danach zur nächsthöheren Periode.`, { gefahr: true, ja: 'Löschen' }))) return;
    await senden(api.loeschen(pfad(`/perioden/${p.id}`), { quelle: f.id }), 'Periode gelöscht.');
  }

  async function laden_() {
    const weg = laden(f.inhalt);
    try { d = await api.get(pfad('/perioden')); zeichnen(); } finally { weg(); }
  }
  f.an('daten', (e) => { if (e.quelle !== f.id && betrifft(e, 'Einstellungen')) laden_().catch(() => {}); });
  laden_().catch(fehlerMelden);
}

// ================================================================================================ Unterrichtsgruppen

function ugruppenFenster(f) {
  let d = null;
  const lesen = nurLesen(f);
  const k = f.werkzeug({ text: 'Wochenperiodizität …', aktion: () => periodizitaet() });
  k.disabled = lesen;

  async function senden(pr) { d = await pr; zeichnen(); }

  function zeile_(g) {
    const name = textfeld(g?.kurzname, '80px');
    const lang = textfeld(g?.langname);
    const von = datumfeld(g?.von);
    const bis = datumfeld(g?.bis);
    const wochen = d.wochen.map((w) => haken(!g || !g.wochen || g.wochen.includes(w)));
    const fix = haken(g?.fix);
    const ign = haken(g?.ignorieren);
    const unt = textfeld(g?.unterbrechungen);
    const alle = [name, lang, von, bis, ...wochen, fix, ign, unt];
    const werte = () => ({ kurzname: name.value, langname: lang.value, von: von.value || null, bis: bis.value || null,
      wochen: d.wochen.filter((_, i) => wochen[i].checked).join(''), fix: fix.checked, ignorieren: ign.checked, unterbrechungen: unt.value });
    for (const el of alle) {
      el.disabled = lesen;
      el.addEventListener('change', () => {
        if (!g && !name.value.trim()) return;
        senden(g ? api.put(pfad(`/ugruppen/${g.id}`), werte(), { quelle: f.id }) : api.post(pfad('/ugruppen'), werte(), { quelle: f.id })).catch((e) => { fehlerMelden(e); zeichnen(); });
      });
    }
    if (!g) name.placeholder = 'Neue Gruppe';
    unt.placeholder = 'z. B. 01.12.-15.12.; 10.03.-20.03.';
    return h('tr', { class: g ? '' : 'neu' }, h('td', null, name), h('td', null, lang), h('td', null, von), h('td', null, bis), wochen.map((w) => h('td', { class: 'mitte' }, w)),
      h('td', { class: 'zahl' }, g?.faktor ?? ''), h('td', { class: 'mitte' }, fix), h('td', { class: 'mitte' }, ign), h('td', null, unt), h('td', { class: 'zahl' }, g?.unterrichte ?? ''),
      h('td', { class: 'aktion' }, g ? h('button', { class: 'knopf klein still', type: 'button', disabled: lesen, onclick: () => loeschen(g).catch(fehlerMelden) }, 'Löschen') : null));
  }

  function zeichnen() {
    const tab = h('table', { class: 'es-liste' });
    tab.append(h('tr', null, [['Kurzname'], ['Bezeichnung'], ['Von'], ['Bis'], ...d.wochen.map((w) => [`Woche ${w}`, 'mitte']), ['Faktor', 'zahl', 'Anteil der Schultage, an denen die Gruppe gilt'],
      ['Fixiert', 'mitte'], ['Ignorieren', 'mitte', 'Gruppe bei der Planung nicht berücksichtigen'], ['Unterbrechungen'], ['Unterrichte', 'zahl'], ['']].map(([t, k, titel]) => h('th', { class: k, title: titel }, t))));
    for (const g of d.gruppen) tab.append(zeile_(g));
    if (!lesen) tab.append(zeile_(null));
    else if (!d.gruppen.length) tab.append(h('tr', null, h('td', { colspan: 10 + d.wochen.length, class: 'es-leer' }, 'Keine Unterrichtsgruppen angelegt.')));
    f.inhalt.replaceChildren(h('div', { class: 'es-seite' }, tab,
      h('p', { class: 'leise' }, `Wochenperiodizität ${d.wochenperiodizitaet} (${d.wochen.join(', ')}). Eine neue Gruppe tragen Sie in der letzten Zeile ein; Unterricht ordnen Sie in der Unterrichtsansicht einer Gruppe zu.`)));
  }

  async function loeschen(g) {
    if (!(await frage(`Unterrichtsgruppe ${g.kurzname} löschen? Zugeordneter Unterricht findet danach jede Woche statt.`, { ja: 'Löschen', gefahr: true }))) return;
    await senden(api.post(pfad('/ugruppen/loeschen'), { ids: [g.id] }, { quelle: f.id }));
  }

  async function periodizitaet() {
    const w = await formular('Wochenperiodizität', [{ name: 'wert', titel: 'Anzahl Wochen', art: 'zahl', wert: d.wochenperiodizitaet, pflicht: true, hinweis: '1 = jede Woche gleich, 2 = A/B-Wochen, höchstens 16' }]);
    if (!w) return;
    await senden(api.put(pfad('/wochenperiodizitaet'), { wert: Number(w.wert) }, { quelle: f.id }));
  }

  async function laden_() {
    const weg = laden(f.inhalt);
    try { d = await api.get(pfad('/ugruppen')); zeichnen(); } finally { weg(); }
  }
  f.an('daten', (e) => { if (e.quelle !== f.id && betrifft(e, 'Unterricht', 'Einstellungen')) laden_().catch(() => {}); });
  laden_().catch(fehlerMelden);
}

// ================================================================================================ Modul

const oeffnen = (typ, p) => () => (zustand.dokument ? fensterverwaltung.oeffnen(typ, p) : null);
const eintrag = (id, reiter, gruppe, text, symbol, befehlName, gross = false, args) => ({ id, reiter, gruppe, text, symbol, gross, befehl: befehlName, args, braucht: 'dokument' });

export default {
  id: 'einstellungen',
  css: ['css/module/einstellungen.css'],
  fenster: {
    'einstellungen.schule': { titel: 'Einstellungen', symbol: 'einstellungen', breite: 820, hoehe: 560, einzig: () => true, erstellen: schuldatenFenster },
    'einstellungen.zeitraster': { titel: 'Zeitraster', symbol: 'stundenplan', breite: 900, hoehe: 600, einzig: () => true, erstellen: zeitrasterFenster },
    'einstellungen.ferien': { titel: 'Kalender und Ferien', symbol: 'kalender', breite: 1180, hoehe: 640, einzig: () => true, erstellen: ferienFenster },
    'einstellungen.perioden': { titel: 'Perioden', symbol: 'perioden', breite: 1000, hoehe: 480, einzig: () => true, erstellen: periodenFenster },
    'einstellungen.ugruppen': { titel: 'Unterrichtsgruppen', symbol: 'perioden', breite: 1000, hoehe: 380, einzig: () => true, erstellen: ugruppenFenster },
  },
  befehle: {
    'einstellungen.schule': (a) => oeffnen('einstellungen.schule', a)(),
    'einstellungen.zeitraster': oeffnen('einstellungen.zeitraster'),
    'einstellungen.ferien': oeffnen('einstellungen.ferien'),
    'einstellungen.perioden': oeffnen('einstellungen.perioden'),
    'einstellungen.ugruppen': oeffnen('einstellungen.ugruppen'),
  },
  ribbon: [
    eintrag('start.perioden', 'Start', 'Planungswerkzeuge', 'Perioden', 'perioden', 'einstellungen.perioden', true),
    eintrag('start.einstellungen', 'Start', 'Schule', 'Einstellungen', 'einstellungen', 'einstellungen.schule', true),
    eintrag('start.ferien', 'Start', 'Module', 'Kalender und Ferien', 'kalender', 'einstellungen.ferien'),
    eintrag('eingabe.ugruppen', 'Dateneingabe', 'Spezielle Daten', 'Unterrichtsgruppen', 'perioden', 'einstellungen.ugruppen'),
    eintrag('eingabe.zeitraster', 'Dateneingabe', 'Zeit', 'Zeitraster', 'stundenplan', 'einstellungen.zeitraster'),
    eintrag('eingabe.ferien', 'Dateneingabe', 'Zeit', 'Ferien', 'kalender', 'einstellungen.ferien'),
    eintrag('eingabe.schuljahr', 'Dateneingabe', 'Zeit', 'Schuljahr', 'kalender', 'einstellungen.schule', false, { seite: 'Allgemein' }),
    eintrag('module.perioden', 'Module', 'Weitere Module', 'Perioden', 'perioden', 'einstellungen.perioden', true),
    eintrag('module.ugruppen', 'Module', 'Weitere Module', 'Unterrichtsgruppen', 'perioden', 'einstellungen.ugruppen', true),
  ],
};

