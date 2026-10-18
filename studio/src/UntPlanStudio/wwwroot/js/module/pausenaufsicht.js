// Modul „Pausenaufsichten“: Wochenplan nach Aufsichtsbereich bzw. Lehrkraft mit der Matrix Tage × Aufsichtspausen,
// Liste der Lehrkräfte (Soll/Ist in Minuten, Anzahl), Vorschlag mit Bewertung, Aufsicht eintragen/entfernen/teilen,
// „keine Aufsicht“, automatische Einteilung und Gewichtung; dazu die Vertretung der Aufsichten eines Tages (Vertretungsmodus).
import { h } from '../kern/dom.js';
import { symbol } from '../kern/symbole.js';
import { planungsdatum } from './vertretung/kern.js';
import { menueKnopf, schalter } from './vertretung/steuer.js';
import { api } from '../kern/api.js';
import { zustand, darfSchreiben } from '../kern/zustand.js';
import { betrifft } from '../kern/ereignisse.js';
import { Tabelle } from '../kern/tabelle.js';
import { dialog, frage, hinweis, laden, fehlerMelden, menue } from '../kern/dialog.js';
import { fensterverwaltung } from '../kern/fenster.js';

function planFenster(f, p) {
  f.titel('Pausenaufsichten');
  const schreiben = darfSchreiben();
  let sicht = p.sicht || 'gang';
  let liste = { gaenge: [], lehrer: [] };
  let daten = null;
  let akt = null; // { tag, nach }
  const reiter = h('div', { class: 'pa-sicht vt-reiter', role: 'tablist' });
  const element = h('select', { class: 'eingabe pa-element' });
  const elementTitel = h('span', { class: 'pa-wz-titel' });
  const minuten = h('span');
  const raster = h('div', { class: 'pa-raster', tabindex: '0' });
  const seite = h('div', { class: 'pa-lehrerliste' });
  f.inhalt.append(reiter, h('div', { class: 'pa-teilung' }, raster, seite));
  f.fuss.append(minuten);

  const pfeil = (sym, titel, d) => h('button', { type: 'button', class: 'wz-knopf nur-symbol', title: titel, 'aria-label': titel, onclick: () => blaettern(d) }, symbol(sym));
  f.werkzeuge.append(h('span', { class: 'pa-elementwahl' }, elementTitel, pfeil('pfeil_links', 'Vorheriger Eintrag', -1), element, pfeil('pfeil_rechts', 'Nächster Eintrag', 1)));
  f.trenner();
  const nurBereich = () => { if (sicht !== 'gang') { hinweis('Aufsichten lassen sich nur in der Ansicht „Nach Aufsichtsbereich“ bearbeiten.', 'warnung'); return false; } return true; };
  if (schreiben) {
    f.werkzeug({ text: 'Vorschlag …', titel: 'Lehrkräfte für die gewählte Aufsicht mit Bewertung vorschlagen', aktion: () => vorschlag() });
    f.werkzeug({ text: 'Entfernen', titel: 'Gewählte Aufsicht entfernen', aktion: () => zelleLoeschen() });
    menueKnopf(f, 'Weitere Aktionen', () => {
      const z = aktZelle();
      return [
        { text: 'Eingeben …', deaktiviert: sicht !== 'gang' || !akt, aktion: () => nurBereich() && eingeben(null, z?.text || '') },
        { text: z?.keine ? 'Aufsicht wieder einplanen' : 'Keine Aufsicht', deaktiviert: sicht !== 'gang' || !akt, aktion: () => teile(0) },
        { text: 'Aufsicht teilen', deaktiviert: sicht !== 'gang' || !akt, aktion: () => teile(1) },
        { text: 'Teilung entfernen', deaktiviert: sicht !== 'gang' || !akt || (z?.teile ?? 0) < 2, aktion: () => teile(-1) },
        null,
        { text: sicht === 'gang' ? 'Aufsichten dieses Bereichs löschen …' : 'Aufsichten dieser Lehrkraft löschen …', aktion: async () => { if (await frage('Alle Aufsichten dieses Eintrags löschen?', { gefahr: true, ja: 'Löschen', nein: 'Abbrechen' })) { await api.post(api.dok('/pausenaufsicht/loeschen'), { sicht, id: Number(element.value) }); neu(); } } },
        { text: 'Alle Aufsichten löschen …', aktion: async () => { if (await frage('Alle Pausenaufsichten löschen?', { gefahr: true, ja: 'Löschen', nein: 'Abbrechen' })) { await api.post(api.dok('/pausenaufsicht/loeschen'), { sicht: 'alle', id: 0 }); neu(); } } },
      ];
    });
    f.werkzeug({ text: 'Automatisch einteilen …', titel: 'Offene Aufsichten automatisch besetzen', aktion: optimieren }).classList.add('rechts');
  }
  const einst = menueKnopf(f, 'Einstellungen', () => [
    { text: 'Gewichtung …', deaktiviert: !schreiben, aktion: gewichtung },
    { text: 'Aufsichtsbereiche …', aktion: bereicheOeffnen },
  ]);
  if (!schreiben) einst.classList.add('rechts');
  const aktZelle = () => (daten && akt ? daten.tage.find((t) => t.tag === akt.tag)?.zellen.find((z) => z.nach === akt.nach) : null);
  function bereicheOeffnen() { fensterverwaltung.oeffnen('stammdaten', { typ: 'gang' }); }

  function reiterZeichnen() {
    reiter.replaceChildren(...[['gang', 'Nach Aufsichtsbereich'], ['lehrer', 'Nach Lehrkraft']].map(([id, t]) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(id === sicht), class: id === sicht ? 'aktiv' : '', onclick: () => { sicht = id; f.parameterSetzen({ sicht }); elementeFuellen(); neu(); } }, t)));
    elementTitel.textContent = sicht === 'gang' ? 'Bereich' : 'Lehrkraft';
  }
  function elementeFuellen() {
    const alt = Number(element.value);
    const l = sicht === 'gang' ? liste.gaenge : liste.lehrer;
    element.replaceChildren(...l.map((x) => h('option', { value: x.id, selected: x.id === alt || x.id === p.element }, x.kurz)));
    reiterZeichnen();
  }
  function blaettern(d) {
    const n = element.options.length;
    if (!n) return;
    element.selectedIndex = (element.selectedIndex + d + n) % n;
    neu();
  }
  element.addEventListener('change', () => { f.parameterSetzen({ element: Number(element.value) }); neu(); });

  function zeichnen() {
    if (!daten) {
      minuten.textContent = '';
      seite.replaceChildren();
      raster.replaceChildren(h('div', { class: 'pa-leer' }, sicht === 'gang'
        ? [h('p', null, 'Es sind noch keine Aufsichtsbereiche angelegt.'), h('button', { type: 'button', class: 'knopf klein', onclick: bereicheOeffnen }, 'Aufsichtsbereiche anlegen')]
        : h('p', null, 'Es sind keine Lehrkräfte vorhanden.')));
      return;
    }
    minuten.textContent = daten.minuten;
    const kopf = h('tr', null, h('th', { class: 'pa-ecke' }), ...daten.spalten.map((s) => h('th', { title: `${s.minuten} Minuten` }, h('div', null, s.name), h('div', { class: 'pa-zeit' }, s.zeit))));
    const zeilen = daten.tage.map((t) => h('tr', null, h('th', { class: 'pa-tag' }, t.name), ...t.zellen.map((z) => {
      const kl = ['pa-zelle'];
      if (sicht === 'gang') { if (z.keine) kl.push('keine'); if (z.offen && !z.keine) kl.push('offen'); if (z.schlecht?.length) kl.push('schlecht'); }
      else kl.push(z.moeglich ? 'moeglich' : 'gesperrt');
      if (akt && akt.tag === t.tag && akt.nach === z.nach) kl.push('aktiv');
      const td = h('td', { class: kl.join(' '), title: z.schlecht?.length ? `Ungünstig: ${z.schlecht.join(', ')}` : '' }, z.keine ? 'keine Aufsicht' : z.text);
      td.addEventListener('click', () => { akt = { tag: t.tag, nach: z.nach }; zeichnen(); });
      td.addEventListener('dblclick', () => { akt = { tag: t.tag, nach: z.nach }; if (sicht === 'gang' && schreiben) eingeben(td, z.text); });
      td.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        akt = { tag: t.tag, nach: z.nach };
        zeichnen();
        if (sicht !== 'gang' || !schreiben) return;
        menue(e.clientX, e.clientY, [
          { text: 'Vorschlag …', aktion: vorschlag },
          { text: 'Eingeben …', aktion: () => eingeben(null, z.text) },
          { text: 'Aufsicht entfernen', aktion: zelleLoeschen },
          null,
          { text: z.keine ? 'Aufsicht wieder einplanen' : 'Keine Aufsicht', aktion: () => teile(0) },
          { text: 'Aufsicht teilen', aktion: () => teile(1) },
          { text: 'Teilung entfernen', aktion: () => teile(-1), deaktiviert: z.teile < 2 },
        ]);
      });
      return td;
    })));
    raster.replaceChildren(h('table', { class: 'pa-tabelle' }, h('thead', null, kopf), h('tbody', null, zeilen)));
    const spalte = (t, titel) => h('th', { class: 'zahl', title: titel }, t);
    seite.replaceChildren(h('div', { class: 'pa-seitenkopf' }, h('span', { class: 'fett' }, 'Lehrkräfte'), h('span', { class: 'leise' }, 'Doppelklick zeigt den Plan der Lehrkraft')),
      h('table', { class: 'pa-tabelle klein' },
        h('thead', null, h('tr', null, h('th', null, 'Lehrkraft'), spalte('Soll', 'Höchstens Minuten Aufsicht pro Woche'), spalte('Ist', 'Eingeteilte Minuten pro Woche'), spalte('Anzahl', 'Anzahl der Aufsichten'),
          spalte('Vertr.', 'Vertretene Aufsichten'), spalte('Differenz', 'Ist minus Soll in Minuten'), h('th', { title: 'Geschlecht' }, 'G.'))),
        h('tbody', null, daten.lehrer.map((l) => h('tr', { class: 'pa-lehrerzeile', ondblclick: () => { sicht = 'lehrer'; elementeFuellen(); element.value = l.id; neu(); } },
          h('td', null, l.kurz), h('td', { class: 'zahl' }, l.max), h('td', { class: 'zahl' }, l.ist), h('td', { class: 'zahl' }, l.anzahl), h('td', { class: 'zahl' }, l.vertretungen),
          h('td', { class: `zahl${l.ueber ? ' pa-ueber' : ''}` }, l.differenz), h('td', null, l.geschlecht))))));
  }

  async function eingeben(td, alt) {
    const t = await (async () => {
      const ein = h('input', { class: 'eingabe', id: `pa-ein-${f.id}`, value: alt === '???' ? '' : alt.replace(/\?\?\?/g, '').replace(/,\s*,/g, ',').replace(/^,|,$/g, ''), placeholder: 'z. B. MÜL, SCH' });
      const ok = await dialog({ titel: 'Pausenaufsicht eingeben', inhalt: h('div', { class: 'formular' }, h('label', { for: ein.id }, 'Lehrkräfte'), ein, h('div', { class: 'hinweis' }, 'Kurznamen; mehrere teilen sich die Aufsicht.')), knoepfe: [{ text: 'Übernehmen', wert: true, primaer: true }, { text: 'Abbrechen', wert: null }] });
      return ok ? ein.value : null;
    })();
    if (t === null) return;
    daten = await api.put(api.dok('/pausenaufsicht/zelle'), { gang: Number(element.value), tag: akt.tag, nach: akt.nach, lehrer: t }, { quelle: f.id });
    zeichnen();
  }

  async function zelleLoeschen() {
    if (!akt) return;
    await api.post(api.dok('/pausenaufsicht/loeschen'), { sicht, id: Number(element.value), tag: akt.tag, nach: akt.nach }, { quelle: f.id });
    neu();
  }
  async function teile(delta) {
    if (!nurBereich()) return;
    if (!akt) { hinweis('Bitte zuerst eine Aufsicht wählen.', 'warnung'); return; }
    daten = await api.post(api.dok('/pausenaufsicht/teile'), { gang: Number(element.value), tag: akt.tag, nach: akt.nach, delta }, { quelle: f.id });
    zeichnen();
  }

  async function vorschlag() {
    if (!nurBereich()) return;
    if (!akt) { hinweis('Bitte zuerst eine Aufsicht wählen.', 'warnung'); return; }
    const gang = Number(element.value);
    const v = await api.get(api.dok(`/pausenaufsicht/vorschlag?gang=${gang}&tag=${akt.tag}&nach=${akt.nach}`));
    let gewaehlt = null;
    const huelle = h('div', { class: 'pa-vorschlag' });
    const ok = dialog({ titel: String(v.titel || '').replace(/^Lehrervorschlag/, 'Vorschlag'), breite: '960px', inhalt: h('div', null, v.ersetzt ? h('p', { class: 'leise' }, `Alle Teile sind belegt – ersetzt wird ${v.ersetzt}.`) : null, huelle),
      knoepfe: [{ text: 'Einteilen', wert: true, primaer: true }, { text: 'Abbrechen', wert: null }] });
    const t = new Tabelle(huelle, {
      zeilenHoehe: 30,
      leerText: 'Keine Lehrkraft verfügbar.',
      zeilenKlasse: (z) => (z.schlecht ? 'pa-schlecht' : ''),
      beiAuswahl: (_, aktiv) => { gewaehlt = aktiv; },
      beiDoppelklick: (z) => { gewaehlt = z; huelle.closest('.dialog')?.querySelector('.knopf.primaer')?.click(); },
      spalten: v.spalten.map((titel, i) => ({ schluessel: `v${i}`, titel, hinweis: titel, breite: Math.max(i === 0 ? 64 : 56, Math.round(titel.length * 6.6) + 22), art: 'NurLesen', editierbar: false, wert: (z) => z.werte[i] })),
    });
    t.daten(v.zeilen.map((z) => ({ ...z, title: z.verletzt.join('\n') })));
    gewaehlt = v.zeilen[0] || null;
    if (!(await ok) || !gewaehlt) return;
    daten = await api.post(api.dok('/pausenaufsicht/zuordnen'), { gang, tag: akt.tag, nach: akt.nach, lehrer: gewaehlt.id }, { quelle: f.id });
    zeichnen();
  }

  async function optimieren() {
    const nurGangS = schalter('Nur der aktuelle Aufsichtsbereich', { disabled: sicht !== 'gang' });
    const schlechtS = schalter('Ungünstige Einteilungen vorher entfernen');
    const nurGang = nurGangS.eingabe;
    const schlecht = schlechtS.eingabe;
    const kurz = h('input', { class: 'eingabe pa-zahl', type: 'number', min: 0, max: 60, value: 0, id: `pa-kurz-${f.id}` });
    const ok = await dialog({ titel: 'Pausenaufsichten automatisch einteilen', breite: '480px', inhalt: h('div', { class: 'formular pa-dialog' },
      h('div', { class: 'voll' }, nurGangS), h('div', { class: 'voll' }, schlechtS),
      h('label', { for: kurz.id }, 'Nur Pausen ab'), h('span', { class: 'pa-einheit' }, kurz, h('span', { class: 'leise' }, 'Minuten')),
      h('p', { class: 'leise voll' }, 'Besetzt werden nur offene Aufsichten. Lehrkräfte ohne Aufsichtsminuten, gesperrte Lehrkräfte und unpassende Zuordnungen nach Geschlecht bleiben außen vor.')),
    knoepfe: [{ text: 'Einteilen', wert: true, primaer: true }, { text: 'Abbrechen', wert: null }] });
    if (!ok) return;
    const weg = laden(f.inhalt);
    try {
      const r = await api.post(api.dok('/pausenaufsicht/optimieren'), { schlechteLoeschen: schlecht.checked, gang: nurGang.checked ? Number(element.value) : null, kuerzestePause: Number(kurz.value) || 0 });
      hinweis(r.text, 'ok');
    } finally { weg(); }
    neu();
  }

  async function gewichtung() {
    const g = await api.get(api.dok('/pausenaufsicht/gewichtung'));
    const max = h('input', { class: 'eingabe pa-zahl', type: 'number', min: 1, max: 5, value: g.maxProTag, id: `pa-max-${f.id}` });
    const regler = g.kriterien.map((k) => {
      const el = h('input', { type: 'range', min: 0, max: 5, value: k.wert, 'aria-label': k.text });
      const wert = h('span', { class: 'pa-wert' }, String(k.wert));
      el.addEventListener('input', () => { wert.textContent = el.value; });
      return { k, el, wert };
    });
    const ok = await dialog({ titel: 'Gewichtung der Pausenaufsichten', breite: '620px', inhalt: h('div', { class: 'pa-gewichtung' },
      h('label', { for: max.id }, 'Höchstens Aufsichten pro Tag'), h('span', null, max),
      h('h3', { class: 'pa-abschnitt' }, 'Gewichtung der Kriterien'),
      h('p', { class: 'leise pa-skala' }, '0 = unwichtig, 5 = darf nie verletzt werden.'),
      ...regler.flatMap(({ k, el, wert }) => [h('label', null, k.text), h('span', { class: 'pa-regler' }, el, wert)])),
    knoepfe: [{ text: 'Speichern', wert: true, primaer: true }, { text: 'Abbrechen', wert: null }] });
    if (!ok) return;
    await api.put(api.dok('/pausenaufsicht/gewichtung'), { maxProTag: Number(max.value) || 1, werte: Object.fromEntries(regler.map(({ k, el }) => [k.schluessel, Number(el.value)])) });
    hinweis('Gewichtung gespeichert.', 'ok');
    neu();
  }

  async function neu() {
    const id = Number(element.value);
    if (!id) { daten = null; zeichnen(); return; }
    try { daten = await api.get(api.dok(`/pausenaufsicht/${sicht}/${id}`)); } catch (e) { daten = null; fehlerMelden(e); }
    zeichnen();
  }

  f.an('daten', (e) => { if (e.quelle !== f.id && betrifft(e, 'Stammdaten', 'Stundenplan', 'Einstellungen', 'Vertretung')) start(); });
  async function start() {
    try { liste = await api.get(api.dok('/pausenaufsicht')); } catch (e) { fehlerMelden(e); }
    elementeFuellen();
    await neu();
  }
  start();
}

// ---------------------------------------------------------------------------------------------- Vertretung der Aufsichten

function vertretungFenster(f) {
  f.titel('Vertretung der Pausenaufsichten');
  const schreiben = darfSchreiben();
  const start = planungsdatum() || zustand.vertretungsdatum || zustand.datum || new Date().toISOString().slice(0, 10);
  const datum = h('input', { class: 'eingabe', type: 'date', value: typeof start === 'string' ? start.slice(0, 10) : start, id: `pav-datum-${f.id}` });
  f.werkzeuge.append(h('label', { class: 'pa-elementwahl', for: datum.id }, h('span', { class: 'pa-wz-titel' }, 'Datum'), datum));
  f.werkzeug({ text: 'Wochenplan', titel: 'Wöchentliche Pausenaufsichten', aktion: () => fensterverwaltung.oeffnen('pausenaufsicht', {}) }).classList.add('rechts');
  const flaeche = h('div', { class: 'pa-vertretung' });
  f.inhalt.append(flaeche);

  async function neu() {
    const weg = laden(f.inhalt);
    try { zeichnen(await api.get(api.dok(`/pausenaufsicht/vertretung/${datum.value}`))); } catch (e) { fehlerMelden(e); } finally { weg(); }
  }
  function zeichnen(d) {
    f.fuss.replaceChildren(h('span', null, d.datumText), h('span', null, `${d.zeilen.length} zu vertreten`), h('span', null, `${d.zeilen.filter((z) => z.offen).length} offen`), ...(d.unterrichtstag ? [] : [h('span', null, 'kein Unterrichtstag')]));
    if (!d.zeilen.length) { flaeche.replaceChildren(h('div', { class: 'pa-leer' }, h('p', null, 'An diesem Tag ist keine Pausenaufsicht zu vertreten.'))); return; }
    flaeche.replaceChildren(h('table', { class: 'pa-tabelle pa-voll' },
      h('thead', null, h('tr', null, ['Pause', 'Aufsichtsbereich', 'Abwesend', 'Vertretung', 'Text', 'Weitere Lehrkräfte (Zähler, Aufsichten)'].map((x) => h('th', null, x)))),
      h('tbody', null, d.zeilen.map((z) => {
        const wahl = h('select', { class: 'eingabe', disabled: !schreiben },
          h('option', { value: '' }, z.offen ? 'Offen' : 'Vertretung aufheben'),
          z.vertreterId && !z.kandidaten.some((k) => k.id === z.vertreterId) ? h('option', { value: z.vertreterId, selected: true }, z.vertreter) : null,
          ...z.kandidaten.map((k) => h('option', { value: k.id, selected: k.id === z.vertreterId }, `${k.kurz} (${k.zaehler}, ${k.aufsichten})`)));
        wahl.addEventListener('change', async () => {
          try { zeichnen(await api.post(api.dok(`/pausenaufsicht/vertretung/${datum.value}`), { vertretung: z.id, lehrer: wahl.value ? Number(wahl.value) : null }, { quelle: f.id })); } catch (e) { fehlerMelden(e); neu(); }
        });
        return h('tr', { class: z.offen ? 'pa-offen' : '' }, h('td', null, z.pause), h('td', null, z.gang), h('td', null, z.lehrer), h('td', null, wahl), h('td', null, z.text), h('td', { class: 'leise' }, z.kandidaten.slice(0, 6).map((k) => k.kurz).join(', ')));
      }))));
  }
  datum.addEventListener('change', neu);
  f.an('datum', (dt) => { if (dt) { datum.value = String(dt).slice(0, 10); neu(); } });
  f.an('vertretung.datum', (dt) => { if (dt) { datum.value = dt; neu(); } });
  f.an('daten', (e) => { if (e.quelle !== f.id && betrifft(e, 'Vertretung', 'Stundenplan')) neu(); });
  neu();
}

const oeffnen = () => { if (zustand.dokument) fensterverwaltung.oeffnen('pausenaufsicht', {}); };

export default {
  id: 'pausenaufsicht',
  css: ['css/module/pausenaufsicht.css'],
  fenster: {
    pausenaufsicht: { titel: 'Pausenaufsichten', symbol: 'pausenaufsicht', breite: 1060, hoehe: 520, einzig: () => 'pause', erstellen: planFenster },
    'pausenaufsicht.vertretung': { titel: 'Vertretung der Pausenaufsichten', symbol: 'pausenaufsicht', breite: 900, hoehe: 420, einzig: () => 'pavertretung', erstellen: vertretungFenster },
  },
  befehle: {
    'pausenaufsicht.oeffnen': oeffnen,
    'pausenaufsicht.vertretung': () => { if (zustand.dokument) fensterverwaltung.oeffnen('pausenaufsicht.vertretung', {}); },
  },
  ribbon: [
    { id: 'start.pausenaufsichten', reiter: 'Start', gruppe: 'Module', text: 'Pausenaufsichten', symbol: 'pausenaufsicht', befehl: 'pausenaufsicht.oeffnen', braucht: 'dokument' },
    {
      id: 'vertretung.pausenaufsichten', reiter: 'Vertretungsplanung', gruppe: 'Planung', text: 'Pausenaufsichten', symbol: 'pausenaufsicht', gross: true, braucht: 'dokument',
      menue: [
        { text: 'Vertretung der Pausenaufsichten', befehl: 'pausenaufsicht.vertretung' },
        { text: 'Wochenplan', befehl: 'pausenaufsicht.oeffnen' },
      ],
    },
  ],
};
