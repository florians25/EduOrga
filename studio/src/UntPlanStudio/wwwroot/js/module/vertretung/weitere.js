// Weitere Ansichten und Dialoge der Vertretungsplanung: Sondereinsätze (mehrere Zeilen, Klassenkonferenz), automatische Vertretung,
// Einstellungen der Vertretungsplanung (Regeln je Stunde, Zähler, Vorschlag, Allgemein, Arten und Farben),
// Bereitschaften des Tages, Bereitschaftsplanung (Raster mit Bedarf, Vorschlag, Automatik) und Vormerkungen.
import { h, leeren } from '../../kern/dom.js';
import { api } from '../../kern/api.js';
import { darfSchreiben } from '../../kern/zustand.js';
import { betrifft } from '../../kern/ereignisse.js';
import { dialog, hinweis, fehlerMelden, frage, formular, meldung } from '../../kern/dialog.js';
import { symbol } from '../../kern/symbole.js';
import { vpfad, planungsdatum, datumText, datumLesen, auswahlMelden } from './kern.js';
import { reiter, listenTabelle, schalter, werkzeugSchalter } from './steuer.js';
import { TYP_VORMERKUNG } from './plan.js';

// ---------------------------------------------------------------------------------------------
// Sondereinsätze

/** Dialog „Sondereinsätze“: Datum, Stunde von/bis, Klassen, Lehrer, Klassenkonferenz; darunter mehrere Zeilen direkt eingeben. */
export async function sondereinsatzDialog({ datum, stunde, klassen = '', lehrer = '' } = {}) {
  const d0 = datum || planungsdatum();
  const st = stunde || 1;
  const koerper = h('tbody');
  const zeile = (w = {}) => {
    const feld = (name, wert, breite) => h('input', { class: 'eingabe', name, value: wert ?? '', style: breite ? { width: breite } : null });
    const tr = h('tr', null,
      h('td', null, feld('datum', datumText(w.datum || d0), '96px')), h('td', null, feld('sv', w.sv ?? st, '46px')), h('td', null, feld('sb', w.sb ?? st, '46px')),
      h('td', null, feld('lehrer', w.lehrer ?? lehrer, '110px')), h('td', null, feld('klassen', w.klassen ?? klassen, '110px')), h('td', null, feld('fach', w.fach, '70px')),
      h('td', null, feld('raum', w.raum, '70px')), h('td', null, feld('gruppe', w.gruppe, '90px')), h('td', null, feld('text', w.text, '180px')),
      h('td', null, h('button', { type: 'button', class: 'vt-symbolknopf', title: 'Zeile entfernen', 'aria-label': 'Zeile entfernen', onclick: () => { tr.remove(); if (!koerper.children.length) koerper.append(zeile()); } }, symbol('loeschen'))));
    tr.addEventListener('input', () => { if (tr === koerper.lastElementChild) koerper.append(zeile({ datum: tr.querySelector('[name=datum]').value ? datumLesen(tr.querySelector('[name=datum]').value, d0) : d0, sv: tr.querySelector('[name=sv]').value, sb: tr.querySelector('[name=sb]').value, lehrer: '', klassen: '' })); });
    return tr;
  };
  koerper.append(zeile());
  const kk = h('button', { type: 'button', class: 'knopf klein', title: 'Alle Lehrkräfte eintragen, die die Klassen der aktuellen Zeile unterrichten' }, 'Klassenkonferenz');
  kk.addEventListener('click', async () => {
    const tr = koerper.querySelector('tr:focus-within') || koerper.firstElementChild;
    let kl = tr.querySelector('[name=klassen]').value.trim();
    if (!kl) { const w = await formular('Klassenkonferenz', [{ name: 'k', titel: 'Klassen', pflicht: true, hinweis: 'Kurznamen, mehrere mit Komma.' }]); if (!w) return; kl = w.k; tr.querySelector('[name=klassen]').value = kl; }
    const r = await api.get(vpfad(`/klassenkonferenz?klassen=${encodeURIComponent(kl)}`));
    tr.querySelector('[name=lehrer]').value = r.lehrer;
    if (!tr.querySelector('[name=text]').value) tr.querySelector('[name=text]').value = 'Klassenkonferenz';
  });
  const inhalt = h('div', { class: 'vt-sondereinsatz' },
    h('p', { class: 'leise' }, 'Je Zeile ein Sondereinsatz für den Stundenbereich. Unterricht der beteiligten Lehrkräfte wird zur offenen Vertretung oder entfällt nach den Regeln je Stunde; Unterricht der beteiligten Klassen entfällt.'),
    h('div', { class: 'vt-tabwrap' }, h('table', { class: 'vt-eingabetabelle' }, h('thead', null, h('tr', null, ['Datum', 'Von Std.', 'Bis Std.', 'Lehrkräfte', 'Klassen', 'Fach', 'Raum', 'Schülergruppe', 'Text', ''].map((t) => h('th', null, t)))), koerper)),
    h('div', { class: 'vt-zeile' }, kk, h('span', { class: 'leise' }, 'Eine neue Zeile entsteht automatisch, sobald die letzte ausgefüllt wird.')));
  const ok = await dialog({ titel: 'Sondereinsätze', inhalt, breite: '960px', knoepfe: [{ text: 'Anlegen', wert: true, primaer: true }, { text: 'Abbrechen', wert: null }] });
  if (!ok) return null;
  const zeilen = [...koerper.children].map((tr) => Object.fromEntries([...tr.querySelectorAll('input')].map((i) => [i.name, i.value.trim()])))
    .filter((z) => z.lehrer || z.klassen)
    .map((z) => ({ datum: datumLesen(z.datum, d0), sv: Number(z.sv) || 1, sb: Number(z.sb) || Number(z.sv) || 1, lehrer: z.lehrer, klassen: z.klassen, fach: z.fach, raum: z.raum, gruppe: z.gruppe, text: z.text }));
  if (!zeilen.length) return null;
  const r = await api.post(vpfad('/sondereinsaetze'), { zeilen });
  hinweis(`${r.anzahl} Sondereinsatz-Stunde(n) angelegt – Strg+Z macht es rückgängig.`, 'ok');
  return r;
}

// ---------------------------------------------------------------------------------------------
// Vertretungsautomatik

export async function automatikDialog(von, bis) {
  von = von || planungsdatum();
  bis = bis || von;
  const info = await api.get(vpfad(`/automatik?von=${von}&bis=${bis}`));
  const vonEl = h('input', { class: 'eingabe', type: 'date', value: von });
  const bisEl = h('input', { class: 'eingabe', type: 'date', value: bis });
  const methode = h('select', { class: 'eingabe' }, info.methoden.map((m) => h('option', { value: m.wert }, m.text)));
  const offen = h('div', { class: 'vt-offen' });
  const zahl = (n, t) => h('div', null, h('span', { class: 'vt-offen-zahl' }, String(n)), h('span', { class: 'leise' }, t));
  const zeigen = (o) => { leeren(offen).append(zahl(o.vertretungen, 'Vertretungen'), zahl(o.raumvertretungen, 'Raumvertretungen'), zahl(o.pausenaufsichten, 'Pausenaufsichten')); };
  zeigen(info.offen);
  const neu = async () => zeigen((await api.get(vpfad(`/automatik?von=${vonEl.value}&bis=${bisEl.value || vonEl.value}`))).offen);
  vonEl.addEventListener('change', neu);
  bisEl.addEventListener('change', neu);
  const inhalt = h('div', { class: 'formular vt-dformular' }, h('label', null, 'Von'), vonEl, h('label', null, 'Bis'), bisEl, h('label', null, 'Verfahren'), methode,
    h('span', { class: 'vt-flabel' }, 'Offen im Zeitraum'), offen,
    h('p', { class: 'leise voll' }, 'Die offenen Vertretungen des Zeitraums werden nacheinander besetzt: mit der am besten geeigneten Lehrkraft laut Vorschlag, sonst – wenn sinnvoll – als Entfall. Strg+Z nimmt alles zurück.'));
  const ok = await dialog({ titel: 'Automatische Vertretung', inhalt, breite: '520px', knoepfe: [{ text: 'Starten', wert: true, primaer: true }, { text: 'Abbrechen', wert: null }] });
  if (!ok) return;
  const r = await api.post(vpfad('/automatik'), { von: vonEl.value, bis: bisEl.value || vonEl.value, methode: methode.value });
  meldung(`${r.bearbeitet} Vertretung(en) bearbeitet, ${r.offen} noch offen.`, 'Automatische Vertretung');
}

// ---------------------------------------------------------------------------------------------
// Einstellungen Vertretungsplanung

const REGEL = ['Vertreten', 'Entfall', 'Eigenverantwortlich'];
const REGEL_TEXT = { Vertreten: '', Entfall: 'Entfall', Eigenverantwortlich: 'EVA' };

export async function einstellungenDialog(seite = 0) {
  const ein = await api.get(vpfad('/einstellungen'));
  const e = structuredClone(ein.einstellungen);
  const klassen = structuredClone(ein.klassen);
  const schreiben = darfSchreiben();
  const seiten = [];
  // --- Vertretungszeitraster ---
  const klasseSel = h('select', { class: 'eingabe' }, h('option', { value: '' }, 'Ganze Schule'), klassen.map((k) => h('option', { value: k.id }, `Klasse ${k.kurz}`)));
  const raster = h('table', { class: 'vt-zeitraster' });
  const aktuell = () => (klasseSel.value ? klassen.find((k) => String(k.id) === klasseSel.value).zeitraster : e.zeitraster);
  const rasterZeichnen = () => {
    const r = aktuell();
    leeren(raster).append(h('tr', null, h('th', null, 'Std.'), ein.tage.map((t) => h('th', null, t))));
    raster.classList.toggle('aus', !schreiben);
    for (let s = 1; s <= ein.stunden; s++) {
      raster.append(h('tr', null, h('th', null, String(s)), ein.tage.map((_, t) => {
        const key = String(t * 100 + s);
        const td = h('td', { class: `vt-regel-${r[key] || 'Vertreten'}` }, REGEL_TEXT[r[key] || 'Vertreten']);
        td.addEventListener('click', () => {
          if (!schreiben) return;
          const neu = REGEL[(REGEL.indexOf(r[key] || 'Vertreten') + 1) % 3];
          if (neu === 'Vertreten') delete r[key]; else r[key] = neu;
          td.className = `vt-regel-${neu}`;
          td.textContent = REGEL_TEXT[neu];
        });
        return td;
      })));
    }
  };
  klasseSel.addEventListener('change', rasterZeichnen);
  rasterZeichnen();
  const legende = h('div', { class: 'vt-regel-legende' },
    h('span', null, h('i', { class: 'vt-regel-Vertreten' }), 'Vertreten'), h('span', null, h('i', { class: 'vt-regel-Entfall' }), 'Unterricht entfällt'),
    h('span', null, h('i', { class: 'vt-regel-Eigenverantwortlich' }), 'Eigenverantwortliches Arbeiten (EVA)'));
  seiten.push(h('div', null, h('p', { class: 'leise' }, 'Was geschieht, wenn die Lehrkraft einer Stunde abwesend ist. Ein Klick auf ein Feld wechselt die Regel. Regeln einer Klasse haben Vorrang vor denen der ganzen Schule.'),
    h('div', { class: 'vt-zeile' }, h('label', { class: 'vt-flabel' }, 'Gilt für'), klasseSel), raster, legende));
  // --- Vertretungszähler ---
  const z = e.zaehler;
  const cb = (obj, k, text) => { const l = schalter(text, { checked: !!obj[k], disabled: !schreiben, klasse: 'voll' }); l.eingabe.addEventListener('change', () => { obj[k] = l.eingabe.checked; }); return l; };
  const abschnitt = (t) => h('h3', { class: 'voll vt-abschnitt' }, t);
  const sel = (obj, k, optionen) => { const s = h('select', { class: 'eingabe' }, optionen.map(([w, t]) => h('option', { value: w, selected: obj[k] === w }, t))); s.addEventListener('change', () => { obj[k] = s.value; }); return s; };
  const txt = (obj, k) => { const i = h('input', { class: 'eingabe', value: obj[k] ?? '' }); i.addEventListener('change', () => { obj[k] = i.value; }); return i; };
  const zahl = (obj, k, max = 99) => { const i = h('input', { class: 'eingabe vt-zahl', type: 'number', min: 0, max, value: obj[k] ?? 0 }); i.addEventListener('change', () => { obj[k] = Math.max(0, Math.min(max, Number(i.value) || 0)); }); return i; };
  seiten.push(h('div', { class: 'formular' },
    abschnitt('Was zählt'),
    cb(z, 'vertretungenZaehlen', 'Vertretungen zählen als Plusstunde'), cb(z, 'sondereinsaetzeZaehlen', 'Sondereinsätze zählen als Plusstunde'), cb(z, 'entfaelleZaehlen', 'Entfälle zählen als Minusstunde'),
    cb(z, 'freisetzungenZaehlen', 'Freistellungen zählen als Minusstunde'), cb(z, 'pausenaufsichtenZaehlen', 'Vertretene Pausenaufsichten zählen'), cb(z, 'betreuungenHalb', 'Betreuungen zählen halb'),
    cb(z, 'entfallNurMitGrund', 'Entfälle nur zählen, wenn beim Abwesenheitsgrund „Entfall zählen“ gesetzt ist'), cb(z, 'stattVertretungNeutral', 'Vertretungen statt eigenem Unterricht zählen nicht'),
    cb(z, 'klausurenNeutral', 'Klausuraufsichten zählen nicht'),
    abschnitt('Berechnung'),
    h('label', null, 'Durchrechnungszeitraum'), sel(z, 'zeitraum', [['Woche', 'Woche'], ['Monat', 'Monat'], ['Halbjahr', 'Halbjahr'], ['Schuljahr', 'Schuljahr'], ['Benutzerdefiniert', 'Benutzerdefiniert']]),
    h('label', null, 'Gezählt wird'), sel(z, 'wieZaehlen', [['Anzahl', 'Anzahl der Stunden'], ['Werte', 'Wert (Faktor des Unterrichts)']]),
    h('label', null, 'Kennzeichen „nicht zählen“'), txt(z, 'nichtZaehlenKennzeichen'), h('label', null, 'Kennzeichen „bezahlt“'), txt(z, 'bezahltKennzeichen')));
  // --- Vertretungsvorschlag ---
  const v = e.vorschlag;
  seiten.push(h('div', { class: 'formular' },
    abschnitt('Pluspunkte'), h('p', { class: 'leise voll' }, 'Je höher der Wert, desto eher wird die Lehrkraft vorgeschlagen.'),
    h('label', null, 'Freigestellt (eigene Klasse abwesend)'), zahl(v, 'freisetzung'), h('label', null, 'Bereitschaft'), zahl(v, 'bereitschaft'),
    h('label', null, 'Unterrichtet die Klasse'), zahl(v, 'hatKlasse'), h('label', null, 'Unterrichtet das Fach'), zahl(v, 'hatFach'),
    abschnitt('Abzüge (Faktoren)'),
    h('label', null, 'Je Unterrichtsstunde am Tag'), zahl(v, 'unterrichtsstundenAmTag'), h('label', null, 'Je Belastungsstufe'), zahl(v, 'merkerFaktor'),
    h('label', null, 'Je Stufe Zeitwunsch-Sperre'), zahl(v, 'sperreFaktor'), h('label', null, 'Je Punkt im Vertretungszähler'), zahl(v, 'zaehlerFaktor'),
    abschnitt('Anzeige'),
    h('label', null, 'Hervorheben ab Belastung über'), zahl(v, 'rotWennMerkerGroesser', 9), h('label', null, 'Ausblenden ab Belastung über'), zahl(v, 'nichtAnzeigenWennMerkerGroesser', 9),
    h('label', null, 'Hervorheben ab Zähler über'), zahl(v, 'rotWennZaehlerGroesser'),
    cb(v, 'gesperrteNichtAnzeigen', 'Gesperrte Lehrkräfte (Zeitwunsch −3) ausblenden'), cb(v, 'klasseAuchFuerKlassenteil', 'Klasse auch bei Klassenteilen berücksichtigen'), cb(v, 'langname', 'Langnamen anzeigen'),
    abschnitt('Vorziehungen'),
    h('label', null, 'Vorziehen'), sel(v, 'vorziehungen', [['GemaessVertretungszeitraster', 'Nach den Regeln je Stunde'], ['AusRandstunden', 'Nur aus Randstunden'], ['AlleVerlegungen', 'Alle Verlegungen']]),
    cb(v, 'raumgewicht4Beachten', 'Höchstes Raumgewicht beachten'), cb(v, 'nurSpaeterenUnterricht', 'Nur aus späterem Unterricht'), cb(v, 'nurDieselbeWoche', 'Nur aus derselben Woche')));
  // --- Allgemein ---
  const eva = h('input', { class: 'eingabe', value: ein.evaRaum || '', placeholder: 'Raum (Kurzname)' });
  seiten.push(h('div', { class: 'formular' }, abschnitt('Räume'), h('label', null, 'Raum für EVA'), eva,
    cb(e, 'lehrerRaumPrinzip', 'Raum der vertretenden Lehrkraft verwenden (Lehrkraft-Raum-Prinzip)'),
    abschnitt('Abläufe'),
    cb(e, 'freisetzungPausenaufsicht', 'Freistellungen erzeugen Vertretungen der Pausenaufsicht'),
    cb(e, 'mitAktuellemDatumStarten', 'Vertretungsplanung mit dem heutigen Datum beginnen')));
  // --- Farben und Bezeichnungen ---
  const farbZeilen = ein.arten.map((a) => {
    const t = h('input', { class: 'eingabe', value: a.text, placeholder: a.standard });
    const fa = h('input', { type: 'color', value: a.farbe || '#ffffff' });
    const ohneS = schalter('Ohne', { checked: !a.farbe, titel: 'Keine Farbe' });
    const ohne = ohneS.eingabe;
    const farbeZeigen = () => { fa.disabled = ohne.checked; };
    ohne.addEventListener('change', farbeZeigen);
    farbeZeigen();
    return { a, t, fa, ohne, tr: h('tr', null, h('td', null, a.standard), h('td', null, t), h('td', null, h('span', { class: 'vt-farbwahl' }, fa, ohneS))) };
  });
  seiten.push(h('div', null, h('p', { class: 'leise' }, 'Eigene Bezeichnung und Farbe je Vertretungsart. Ohne Bezeichnung gilt der Standardname.'),
    h('div', { class: 'vt-tabwrap' }, h('table', { class: 'vt-eingabetabelle vt-arttabelle' }, h('thead', null, h('tr', null, ['Vertretungsart', 'Bezeichnung', 'Farbe'].map((x) => h('th', null, x)))), h('tbody', null, farbZeilen.map((x) => x.tr))))));
  const titel = ['Regeln je Stunde', 'Vertretungszähler', 'Vertretungsvorschlag', 'Allgemein', 'Arten und Farben'];
  const r = reiter(titel, (i) => seiten.forEach((s, j) => { s.hidden = i !== j; }), seite);
  seiten.forEach((s, j) => { s.hidden = j !== seite; s.classList.add('vt-seite'); });
  const inhalt = h('div', { class: 'vt-einstellungen' }, r.el, ...seiten);
  const ok = await dialog({ titel: 'Einstellungen der Vertretungsplanung', inhalt, breite: '760px', knoepfe: schreiben ? [{ text: 'Speichern', wert: true, primaer: true }, { text: 'Abbrechen', wert: null }] : [{ text: 'Schließen', wert: null }] });
  if (!ok) return false;
  e.bezeichnungen = Object.fromEntries(farbZeilen.filter((x) => x.t.value.trim()).map((x) => [x.a.art, x.t.value.trim()]));
  e.farben = Object.fromEntries(farbZeilen.filter((x) => !x.ohne.checked).map((x) => [x.a.art, (0xff000000 | parseInt(x.fa.value.slice(1), 16)) >> 0]));
  await api.put(vpfad('/einstellungen'), { einstellungen: e, evaRaum: eva.value.trim(), klassen: klassen.map((k) => ({ id: k.id, zeitraster: k.zeitraster })) });
  hinweis('Einstellungen der Vertretungsplanung gespeichert.', 'ok');
  return true;
}

// ---------------------------------------------------------------------------------------------
// Bereitschaften des Tages

function bereitschaftenFenster(f) {
  const t = listenTabelle(f.inhalt, {
    leerText: 'An diesem Tag sind keine Bereitschaften eingeplant.',
    zeilenKlasse: (z) => `vt-b-${z.status}`,
    spalten: [
      { titel: 'Std.', breite: 48, klasse: 'rechts', wert: (z) => String(z.stunde) }, { titel: 'Lehrkraft', breite: 90, wert: (z) => z.lehrer },
      { titel: 'Bereitschaft', breite: 100, wert: (z) => z.fach }, { titel: 'Eingesetzt für', wert: (z) => z.eingesetzt }, { titel: 'Zähler', breite: 64, klasse: 'rechts', wert: (z) => z.zaehler },
    ],
    beiWahl: (z) => { if (z.vertretungen?.length) auswahlMelden({ id: z.vertretungen[0], ids: z.vertretungen, zeile: { v: z.vertretungen[0], vertreter: z.lehrerId }, quelle: f.id }); },
  });
  const fuss = h('span', { class: 'leise' });
  f.fuss.append(h('span', { class: 'vt-lg vt-lg-frei' }, h('i'), 'frei'), h('span', { class: 'vt-lg vt-lg-eingesetzt' }, h('i'), 'eingesetzt'), h('span', { class: 'vt-lg vt-lg-abwesend' }, h('i'), 'abwesend'), fuss);
  async function laden() {
    if (!planungsdatum()) return;
    const d = await api.get(vpfad(`/bereitschaften?datum=${planungsdatum()}`));
    f.titel(d.titel);
    t.setzen(d.zeilen);
    fuss.textContent = `${d.zeilen.length} ${d.zeilen.length === 1 ? 'Bereitschaft' : 'Bereitschaften'}`;
    fuss.className = 'rechts leise';
  }
  f.an('vertretung.datum', () => laden().catch(fehlerMelden));
  f.an('daten', (e) => { if (betrifft(e, 'Vertretung', 'Stundenplan', 'Stammdaten')) laden().catch(() => {}); });
  laden().catch(fehlerMelden);
}

// ---------------------------------------------------------------------------------------------
// Bereitschaftsplanung (Modul)

function bereitschaftsplanungFenster(f) {
  const schreiben = darfSchreiben();
  let daten = null;
  let gewaehlt = null;
  const raster = h('table', { class: 'vt-bpraster' });
  const zelleTitel = h('h3', { class: 'vt-bp-titel' }, 'Keine Stunde gewählt');
  const bedarf = h('input', { class: 'eingabe vt-zahl', type: 'number', min: 0, max: 20, disabled: !schreiben, id: `bp-bedarf-${f.id}` });
  const eingeteilt = h('select', { class: 'eingabe vt-bp-liste', size: 5, id: `bp-eingeteilt-${f.id}` });
  const rechts = h('div', { class: 'vt-bp-rechts' });
  f.inhalt.append(h('div', { class: 'vt-bp' }, h('div', { class: 'vt-bp-links' }, raster), rechts));
  const entfernen = h('button', { type: 'button', class: 'knopf klein', disabled: !schreiben }, 'Entfernen');
  const eintragen = h('button', { type: 'button', class: 'knopf klein primaer', disabled: !schreiben }, 'Eintragen');
  rechts.append(zelleTitel,
    h('div', { class: 'vt-bp-zeile' }, h('label', { for: bedarf.id }, 'Bedarf'), bedarf, h('span', { class: 'leise' }, 'Lehrkräfte')),
    h('div', { class: 'vt-bp-zeile oben' }, h('label', { for: eingeteilt.id }, 'Eingeteilt'), eingeteilt, entfernen),
    h('div', { class: 'vt-bp-kopf' }, h('span', { class: 'vt-flabel' }, 'Vorschlag'), h('span', { class: 'leise' }, 'Doppelklick trägt ein'), eintragen));
  const vorschlag = listenTabelle(rechts, {
    leerText: 'Links eine Stunde wählen.',
    spalten: [{ titel: 'Lehrkraft', breite: 76, wert: (k) => k.kurz }, { titel: 'Punkte', breite: 60, klasse: 'rechts', wert: (k) => String(k.punkte) }, { titel: 'Pro Woche', breite: 76, klasse: 'rechts', hinweis: 'Bereitschaften pro Woche', wert: (k) => String(k.woche) },
      { titel: 'Konto', breite: 64, klasse: 'rechts', hinweis: 'Freies Stundenkonto', wert: (k) => k.dep }, { titel: 'Lage', wert: (k) => k.hinweis }],
    beiDoppelklick: (k) => aktion('setzen', { lehrer: k.lehrer }),
  });
  eintragen.addEventListener('click', () => vorschlag.aktiv && aktion('setzen', { lehrer: vorschlag.aktiv.lehrer }));
  entfernen.addEventListener('click', () => eingeteilt.value && aktion('entfernen', { lehrer: Number(eingeteilt.value) }));
  bedarf.addEventListener('change', () => gewaehlt && aktion('bedarf', { anzahl: Number(bedarf.value) || 0 }));

  async function aktion(a, x = {}) {
    const r = await api.post(vpfad(`/bereitschaftsplanung/${a}`), { tag: gewaehlt?.tag ?? 0, stunde: gewaehlt?.stunde ?? 1, ...x }, { quelle: f.id });
    if (a === 'automatisch') hinweis(`${r.anzahl} Bereitschaft(en) eingetragen${r.fehlt ? `, ${r.fehlt} fehlen noch` : ''}.`, 'ok');
    await laden();
  }
  function zeichnen() {
    leeren(raster).append(h('tr', null, h('th', null, 'Std.'), daten.tage.map((t) => h('th', null, t))));
    daten.stunden.forEach((s, j) => raster.append(h('tr', null, h('th', null, s), daten.tage.map((_, t) => {
      const z = daten.zellen[t][j];
      const td = h('td', { class: `${z.verfuegbar ? '' : 'gesperrt'} ${z.bedarf > z.lehrer.length ? 'fehlt' : z.bedarf && z.bedarf <= z.lehrer.length ? 'voll' : ''} ${gewaehlt?.tag === t && gewaehlt?.stunde === j + 1 ? 'aktiv' : ''}` },
        z.bedarf || z.lehrer.length ? [h('span', { class: 'vt-bp-anz' }, `${z.lehrer.length}/${z.bedarf}`), h('span', { class: 'vt-bp-namen' }, z.lehrer.map((l) => l.kurz).join(', '))] : '');
      td.addEventListener('click', () => waehlen(t, j + 1));
      return td;
    }))));
    f.titel('Bereitschaftsplanung');
    f.fuss.replaceChildren(h('span', null, `${daten.anzahl} Bereitschaften eingeteilt`), h('span', null, `Bedarf ${daten.bedarf}`),
      h('span', { class: 'vt-lg vt-lg-voll' }, h('i'), 'Bedarf gedeckt'), h('span', { class: 'vt-lg vt-lg-fehlt' }, h('i'), 'Bedarf offen'), h('span', { class: 'vt-lg vt-lg-gesperrt' }, h('i'), 'nicht verfügbar'));
  }
  async function waehlen(tag, stunde) {
    gewaehlt = { tag, stunde };
    zeichnen();
    const z = daten.zellen[tag][stunde - 1];
    zelleTitel.textContent = `${daten.tage[tag]}, ${daten.stunden[stunde - 1]}. Stunde`;
    bedarf.value = z.bedarf;
    leeren(eingeteilt).append(...z.lehrer.map((l) => h('option', { value: l.id }, l.kurz)));
    vorschlag.setzen(await api.get(vpfad(`/bereitschaftsplanung/vorschlag?tag=${tag}&stunde=${stunde}`)));
  }
  async function laden() {
    daten = await api.get(vpfad('/bereitschaftsplanung'));
    zeichnen();
    if (gewaehlt) await waehlen(gewaehlt.tag, gewaehlt.stunde);
    doppelt.eingabe.checked = !!daten.nurDoppelstunden;
  }
  if (schreiben) {
    f.werkzeug({ text: 'Automatisch besetzen', titel: 'Fehlende Bereitschaften automatisch besetzen', aktion: () => aktion('automatisch') });
    f.werkzeug({ text: 'Bedarf vormittags …', titel: 'Bedarf für alle Vormittagsstunden setzen', aktion: async () => { const w = await formular('Bedarf für alle Vormittagsstunden', [{ name: 'n', titel: 'Lehrkräfte je Stunde', art: 'zahl', wert: 1 }], { okText: 'Setzen' }); if (w) await aktion('vormittag', { anzahl: Number(w.n) || 0 }); } });
    f.werkzeug({ text: 'Alle entfernen …', titel: 'Alle Bereitschaften entfernen', aktion: async () => { if (await frage('Alle Bereitschaften aus dem Stundenplan entfernen?', { gefahr: true, ja: 'Entfernen', nein: 'Abbrechen' })) await aktion('alleentfernen'); } });
  }
  const doppelt = werkzeugSchalter(f, 'Nur Doppelstunden', { titel: 'Bereitschaften nur als Doppelstunden verplanen', beiAenderung: (w) => { if (schreiben) aktion('doppelstunden', { anzahl: w ? 1 : 0 }); } });
  doppelt.eingabe.disabled = !schreiben;
  doppelt.classList.add('rechts');
  f.an('daten', (e) => { if (betrifft(e, 'Stundenplan', 'Einstellungen', 'Stammdaten', 'Unterricht')) laden().catch(() => {}); });
  laden().catch(fehlerMelden);
}

// ---------------------------------------------------------------------------------------------
// Vormerkungen

function vormerkungenFenster(f) {
  const schreiben = darfSchreiben();
  let alle = false;
  const t = listenTabelle(f.inhalt, {
    leerText: 'Es gibt keine offenen Vormerkungen.',
    zeilenKlasse: (v) => (v.offen ? '' : 'leise'),
    spalten: [
      { titel: 'Nr.', breite: 52, klasse: 'rechts', wert: (v) => String(v.id), zelle: (v, td) => {
        setTimeout(() => {
          const zeile = td.parentElement;
          if (!zeile || !schreiben || !v.offen) return;
          zeile.draggable = true;
          zeile.title = 'In einen tagesaktuellen Stundenplan ziehen, um die Vormerkung zu verplanen';
          zeile.addEventListener('dragstart', (e) => { e.dataTransfer.setData(TYP_VORMERKUNG, JSON.stringify({ id: v.id })); e.dataTransfer.effectAllowed = 'move'; });
        });
      } },
      { titel: 'Herkunft', breite: 90, wert: (v) => v.herkunft }, { titel: 'Std.', breite: 48, klasse: 'rechts', wert: (v) => String(v.stunden) },
      { titel: 'Offen', breite: 52, klasse: 'rechts', wert: (v) => String(v.offen) }, { titel: 'Fach', breite: 60, wert: (v) => v.fach }, { titel: 'Lehrkraft', breite: 80, wert: (v) => v.lehrer },
      { titel: 'Klassen', breite: 86, wert: (v) => v.klassen }, { titel: 'Raum', breite: 60, wert: (v) => v.raum }, { titel: 'Ursprünglich', breite: 120, wert: (v) => v.urspruenglich },
      { titel: 'Gültig', breite: 140, wert: (v) => v.gueltig }, { titel: 'Text', wert: (v) => v.text }, { titel: 'Verplant am', breite: 120, wert: (v) => v.verplant },
    ],
  });
  async function laden() { t.setzen(await api.get(vpfad(`/vormerkungen?alle=${alle}`)), true); }
  if (schreiben) {
    f.werkzeug({ text: 'Neu', titel: 'Neue Vormerkung', aktion: async () => {
      const w = await formular('Neue Vormerkung', [{ name: 'fach', titel: 'Fach' }, { name: 'lehrer', titel: 'Lehrkraft' }, { name: 'klassen', titel: 'Klassen' }, { name: 'raum', titel: 'Raum' }, { name: 'stunden', titel: 'Stunden', art: 'zahl', wert: 1 }, { name: 'text', titel: 'Text' }], { okText: 'Anlegen' });
      if (!w) return;
      await api.post(vpfad('/vormerkungen'), { ...w, stunden: Number(w.stunden) || 1 }, { quelle: f.id });
      await laden();
    } });
    f.werkzeug({ text: 'Verplanen …', titel: 'Markierte Vormerkung am Planungsdatum verplanen', aktion: async () => {
      const v = t.aktiv;
      if (!v) return;
      const w = await formular(`Vormerkung am ${datumText(planungsdatum())} verplanen`, [{ name: 'stunde', titel: 'Stunde', art: 'zahl', wert: 1, pflicht: true }], { okText: 'Verplanen' });
      if (!w) return;
      await api.post(vpfad(`/vormerkungen/${v.id}/verplanen`), { datum: planungsdatum(), stunde: Number(w.stunde) }, { quelle: f.id });
      await laden();
    } });
    f.werkzeug({ text: 'Löschen', titel: 'Markierte Vormerkung löschen', aktion: async () => {
      const v = t.aktiv;
      if (!v || !(await frage(`Vormerkung ${v.id} löschen?`, { gefahr: true, ja: 'Löschen', nein: 'Abbrechen' }))) return;
      await api.post(vpfad('/vormerkungen/loeschen'), { ids: [v.id] }, { quelle: f.id });
      await laden();
    } });
  }
  werkzeugSchalter(f, 'Auch verplante', { titel: 'Auch vollständig verplante Vormerkungen zeigen', beiAenderung: (w) => { alle = w; laden(); } }).classList.add('rechts');
  f.fuss.append(h('span', null, 'Zum Verplanen eine Vormerkung in einen Tagesplan ziehen.'));
  f.an('daten', (e) => { if (betrifft(e, 'Vertretung', 'Stundenplan')) laden().catch(() => {}); });
  laden().catch(fehlerMelden);
}

export const fenster = {
  'vertretung.bereitschaften': { titel: 'Bereitschaften', symbol: 'lehrer', breite: 560, hoehe: 320, einzig: () => 'bereitschaften', erstellen: bereitschaftenFenster },
  'vertretung.bereitschaftsplanung': { titel: 'Bereitschaftsplanung', symbol: 'vertretung', breite: 1000, hoehe: 520, einzig: () => 'bereitschaftsplanung', erstellen: bereitschaftsplanungFenster },
  'vertretung.vormerkungen': { titel: 'Vormerkungen', symbol: 'gekennzeichnet', breite: 920, hoehe: 300, einzig: () => 'vormerkungen', erstellen: vormerkungenFenster },
};
