// Ansicht „Vertretungsvorschlag“: folgt der markierten Vertretung. Kopf „30.8. Mo-1 Se/Mu/05D“ (aufklappbar),
// Optionen (Stundenblock, Wegzeiten ignorieren, Dauervertretung …), Reiter Lehrkräfte / Betreuungen / Räume mit Anzahlen,
// unten aufklappbar die Vorziehungen. Übernehmen per Doppelklick, Enter oder Knopf; danach wahlweise zur nächsten offenen.
import { h, leeren } from '../../kern/dom.js';
import { symbol } from '../../kern/symbole.js';
import { api } from '../../kern/api.js';
import { darfSchreiben } from '../../kern/zustand.js';
import { betrifft, melden } from '../../kern/ereignisse.js';
import { hinweis, fehlerMelden } from '../../kern/dialog.js';
import { vpfad, mitRueckfragen, aktuelleAuswahl } from './kern.js';
import { reiter, listenTabelle, schalter, werkzeugSchalter } from './steuer.js';

/** Belastung zur Stunde: 0–3 unauffällig, 4–6 leicht, 7–8 deutlich, ab 9 hoch; Bereitschaft (Fachkürzel) als verfügbar. */
function belastungKlasse(m) {
  if (!m || m === 'x') return null;
  const n = Number(m);
  if (Number.isNaN(n)) return 'vt-m-bereit';
  if (n >= 9) return 'vt-m-hoch';
  if (n >= 7) return 'vt-m-mittel';
  if (n >= 4) return 'vt-m-leicht';
  return null;
}

/** Spalte „Stundenplan“: Stunde davor, Vertretungsstunde (umrandet), Stunde danach; Entfall durchgestrichen. */
function stundenplanSpalten() {
  return [0, 1, 2].map((i) => ({
    titel: i === 0 ? 'Stundenplan' : '', breite: 50, klasse: 'vt-mini',
    wert: (k) => k.s?.[i]?.text ?? '',
    zelle: (k, td) => {
      const z = k.s?.[i];
      if (!z) return;
      if (z.farbe && !z.entfallen) td.style.background = `color-mix(in srgb, ${z.farbe} 20%, var(--flaeche))`;
      td.classList.toggle('entfallen', z.entfallen);
      td.classList.toggle('ziel', z.ziel);
    },
  }));
}

const zaehlerZelle = (k, td) => { td.classList.toggle('vt-warn', Number(k.zaehlerWert) > 0); };
const haken = (ja) => (ja ? symbol('haken') : '');

function vorschlagFenster(f) {
  const schreiben = darfSchreiben();
  let auswahl = aktuelleAuswahl();
  let daten = null;
  let weiter = true;
  let alle = false;
  const klapp = (text, klasse = '') => h('button', { type: 'button', class: `vt-klapp${klasse}`, 'aria-expanded': 'false' }, h('span', { class: 'pfeil' }, symbol('pfeil_rechts')), h('span', { class: 'text' }, text));
  const kopf = klapp('Keine Vertretung markiert');
  const details = h('div', { class: 'vt-details', hidden: true });
  const S = {
    block: schalter('Stundenblock', { titel: 'Vorschlag für alle Stunden des Blocks (Doppelstunde)' }),
    disloz: schalter('Wegzeiten ignorieren', { titel: 'Auch Lehrkräfte vorschlagen, deren angrenzender Unterricht in einem anderen Gebäude liegt' }),
    dauer: schalter('Dauervertretung', { titel: 'Vertretung für alle Stunden dieses Unterrichts während der Abwesenheit übernehmen' }),
    nahe: schalter('Nur in der Nähe', { titel: 'Nur gekoppelte Lehrkräfte, gleicher Gang oder gleiches Stockwerk', klasse: 'nur-1' }),
    besetzt: schalter('Auch belegte Räume', { klasse: 'nur-2' }),
    zusatz: schalter('Zusätzlich zum bisherigen Raum', { titel: 'Den gewählten Raum zusätzlich zum bestehenden Raum zuordnen', klasse: 'nur-2' }),
  };
  const opt = Object.fromEntries(Object.entries(S).map(([k, l]) => [k, l.eingabe]));
  const optionen = h('div', { class: 'vt-optionen' }, ...Object.values(S));
  const tabs = reiter(['Lehrkräfte (0)', 'Betreuungen (0)', 'Räume (0)'], (i) => zeigen(i));
  const flaeche = h('div', { class: 'vt-vorschlag-flaeche' });
  const vorzKopf = klapp('Vorziehungen (0)', ' unten');
  const vorzFlaeche = h('div', { class: 'vt-vorz', hidden: true });
  f.inhalt.append(h('div', { class: 'vt-vorschlag' }, h('div', { class: 'vt-vs-kopf' }, kopf, details, optionen), tabs.el, flaeche, h('div', { class: 'vt-vs-fuss' }, vorzKopf, vorzFlaeche)));
  const umschalten = (knopf, bereich) => { bereich.hidden = !bereich.hidden; knopf.setAttribute('aria-expanded', String(!bereich.hidden)); knopf.classList.toggle('offen', !bereich.hidden); };
  kopf.addEventListener('click', () => umschalten(kopf, details));
  vorzKopf.addEventListener('click', () => umschalten(vorzKopf, vorzFlaeche));
  for (const k of ['block', 'disloz', 'nahe', 'besetzt']) opt[k].addEventListener('change', () => laden());

  const kandidaten = listenTabelle(flaeche, {
    leerText: 'Für diese Stunde gibt es keinen Vorschlag.',
    spalten: [
      { titel: 'Name', breite: 76, wert: (k) => k.name, zelle: (k, td) => { td.title = k.lang + (k.lage ? ` – ${k.lage}` : ''); td.classList.toggle('vt-rot', k.rot); td.classList.toggle('fett', k.benachrichtigen); } },
      ...stundenplanSpalten(),
      { titel: 'Belastung', breite: 72, hinweis: 'Belastung zur Stunde (0 günstig bis 9 ungünstig) bzw. Bereitschaft', wert: (k) => k.merker, zelle: (k, td) => { const c = belastungKlasse(k.merker); if (c) td.classList.add(c); } },
      { titel: 'Vertr.', breite: 56, klasse: 'rechts', hinweis: 'Vertretungen im Durchrechnungszeitraum', wert: (k) => k.vertr }, { titel: 'Entfall', breite: 56, klasse: 'rechts', wert: (k) => k.entf },
      { titel: 'Zähler', breite: 56, klasse: 'rechts', hinweis: 'Vertretungszähler', wert: (k) => k.zaehler, zelle: zaehlerZelle },
      { titel: 'Zeitwunsch', breite: 76, klasse: 'mitte', wert: (k) => k.zw }, { titel: 'Jahressaldo', breite: 80, klasse: 'rechts', wert: (k) => k.jahr },
      { titel: 'Kennz.', breite: 52, klasse: 'mitte', hinweis: 'Kennzeichen der Lehrkraft', wert: (k) => (k.kennz ? 'K' : ''), zelle: (k, td) => { if (k.kennz) { td.title = k.kennzText; td.classList.add('vt-kennz'); } } },
      { titel: 'Bereitschaft', breite: 82, klasse: 'mitte', hinweis: 'Regelmäßige Bereitschaft', wert: (k) => k.regB }, { titel: 'Konto', breite: 60, klasse: 'rechts', hinweis: 'Stundenkonto', wert: (k) => k.dep },
      { titel: 'Fach', breite: 44, klasse: 'mitte vt-haken', hinweis: 'Lehrkraft unterrichtet das Fach', wert: (k) => haken(k.fach) }, { titel: 'Klasse', breite: 52, klasse: 'mitte vt-haken', hinweis: 'Lehrkraft unterrichtet die Klasse', wert: (k) => k.klasse },
      { titel: 'Std./Tag', breite: 60, klasse: 'rechts', wert: (k) => k.stdTag }, { titel: 'Woche', breite: 52, klasse: 'rechts', wert: (k) => k.woche },
      { titel: 'Monat', breite: 52, klasse: 'rechts', wert: (k) => k.monat }, { titel: 'Punkte', breite: 56, klasse: 'rechts', wert: (k) => k.punkte },
      { titel: 'Kriterien', wert: (k) => k.kriterien },
    ],
    beiDoppelklick: () => uebernehmen(),
  });
  const betreuungen = listenTabelle(flaeche, {
    leerText: 'Für diese Stunde ist keine Betreuung möglich.',
    spalten: [
      { titel: 'Name', breite: 76, wert: (k) => k.name, zelle: (k, td) => { td.title = k.lang; } }, ...stundenplanSpalten(),
      { titel: 'Raum', breite: 60, wert: (k) => k.raum }, { titel: 'Klasse', breite: 60, wert: (k) => k.klasse }, { titel: 'Fach', breite: 52, wert: (k) => k.fach },
      { titel: 'Zähler', breite: 56, klasse: 'rechts', wert: (k) => k.zaehler, zelle: zaehlerZelle }, { titel: 'Zeitwunsch', breite: 76, klasse: 'mitte', wert: (k) => k.zw },
      { titel: 'Jahressaldo', breite: 80, klasse: 'rechts', wert: (k) => k.jahr }, { titel: 'Kennz.', breite: 52, klasse: 'mitte', wert: (k) => (k.kennz ? 'K' : '') },
      { titel: 'Gekoppelt', breite: 70, klasse: 'mitte vt-haken', wert: (k) => haken(k.kopplung) }, { titel: 'Nähe', breite: 110, wert: (k) => k.naehe },
      { titel: 'Heute', breite: 52, klasse: 'rechts', hinweis: 'Betreuungen heute', wert: (k) => k.heute },
    ],
    beiDoppelklick: () => betreuung(),
  });
  const raeume = listenTabelle(flaeche, {
    leerText: 'Kein passender Raum frei.',
    zeilenKlasse: (r) => (r.besetzt ? 'vt-besetzt' : r.ar || r.sr ? 'vt-ausweich' : ''),
    spalten: [
      { titel: 'Raum', breite: 70, wert: (r) => r.name, zelle: (r, td) => { td.title = r.lang; } }, { titel: 'Plätze', breite: 56, klasse: 'rechts', wert: (r) => r.kap },
      { titel: 'Ausweichraum', breite: 96, klasse: 'mitte vt-haken', wert: (r) => haken(r.ar) }, { titel: 'Ausweich-Fachraum', breite: 120, klasse: 'mitte vt-haken', wert: (r) => haken(r.sr) },
      { titel: 'Belegt', breite: 64, klasse: 'mitte', wert: (r) => (r.gesperrt ? 'gesperrt' : r.besetzt ? 'belegt' : '') }, { titel: 'Raumgruppen', breite: 96, wert: (r) => r.rg },
      { titel: 'Bereich', breite: 70, wert: (r) => r.gang }, { titel: 'Belegung', wert: (r) => r.belegung },
    ],
    beiDoppelklick: () => raum(),
  });
  const vorziehungen = listenTabelle(vorzFlaeche, {
    leerText: 'Keine Vorziehung möglich.',
    spalten: [
      { titel: 'Lehrkraft', breite: 76, wert: (v) => v.lehrer }, { titel: 'Tag', breite: 80, wert: (v) => v.tag }, { titel: 'Std.', breite: 44, klasse: 'rechts', wert: (v) => String(v.stunde) },
      { titel: 'Klasse', breite: 60, wert: (v) => v.klassen }, { titel: 'Fach', breite: 56, wert: (v) => v.fach }, { titel: 'Raum', breite: 50, wert: (v) => v.raum },
      { titel: 'Art', wert: (v) => v.art, zelle: (v, td) => { td.title = v.beschreibung; } },
    ],
    beiDoppelklick: () => vorziehen(),
  });
  const tabellen = [kandidaten, betreuungen, raeume];
  function zeigen(i) {
    tabellen.forEach((t, j) => { t.el.hidden = j !== i; });
    optionen.classList.toggle('reiter-1', i === 1);
    optionen.classList.toggle('reiter-2', i === 2);
    tabellen[i].el.focus();
  }
  zeigen(0);

  // ---- Aktionen ----
  const ids = () => (auswahl?.ids?.includes(auswahl.id) ? auswahl.ids : auswahl ? [auswahl.id] : []);
  async function nachAktion(warOffen) {
    await laden();
    if (warOffen && weiter && daten && !daten.offen && !daten.raumOffen) melden('vertretung.naechsteOffene');
  }
  async function uebernehmen() {
    const k = kandidaten.aktiv;
    if (!k || !auswahl || !schreiben) return;
    const warOffen = !!daten?.offen;
    const r = await mitRueckfragen(vpfad(`/vorschlag/${auswahl.id}/uebernehmen`), { lehrer: k.lehrer, ids: ids(), block: opt.block.checked && !opt.block.disabled, dauer: opt.dauer.checked && !opt.dauer.disabled }, { quelle: f.id });
    if (r) await nachAktion(warOffen);
  }
  async function betreuung() {
    const k = betreuungen.aktiv;
    if (!k || !auswahl || !schreiben) return;
    const warOffen = !!daten?.offen;
    await mitRueckfragen(vpfad(`/vorschlag/${auswahl.id}/betreuung`), { lehrer: k.lehrer, ids: ids(), block: opt.block.checked }, { quelle: f.id });
    await nachAktion(warOffen);
  }
  async function raum() {
    const r = raeume.aktiv;
    if (!r || !auswahl || !schreiben) return;
    const warOffen = !!daten?.raumOffen;
    const erg = await mitRueckfragen(vpfad(`/vorschlag/${auswahl.id}/raum`), { raum: r.raum, zusatz: opt.zusatz.checked, ids: ids(), block: opt.block.checked }, { quelle: f.id });
    if (erg) await nachAktion(warOffen);
  }
  async function vorziehen() {
    const v = vorziehungen.aktiv;
    if (!v || !auswahl || !schreiben) return;
    await api.post(vpfad(`/vorschlag/${auswahl.id}/vorziehen`), { datum: v.datum, stunde: v.stunde, unterricht: v.u }, { quelle: f.id });
    hinweis('Vorziehung: Unterricht in die offene Stunde verlegt.', 'ok', 2500);
    await nachAktion(true);
  }

  if (schreiben) {
    f.werkzeug({ text: 'Übernehmen', titel: 'Gewählte Lehrkraft bzw. gewählten Raum übernehmen (Doppelklick, Enter)', aktion: () => [uebernehmen, betreuung, raum][tabs.index]() });
    f.werkzeug({ text: 'Entfall', titel: 'Unterricht entfällt', aktion: async () => { if (!auswahl) return; await mitRueckfragen(vpfad('/entfall'), { ids: ids() }, { quelle: f.id }); await nachAktion(true); } });
    f.werkzeug({ text: 'Ohne Lehrkraft', titel: 'Stunde findet ohne Lehrkraft statt', aktion: async () => { if (!auswahl) return; await api.post(vpfad('/ohnelehrer'), { ids: ids() }, { quelle: f.id }); await nachAktion(true); } });
    f.trenner();
  }
  werkzeugSchalter(f, 'Danach nächste offene', { checked: true, titel: 'Nach dem Zuweisen automatisch die nächste offene Vertretung wählen', beiAenderung: (w) => { weiter = w; } });
  werkzeugSchalter(f, 'Alle Lehrkräfte', { titel: 'Auch gesperrte und weit entfernte Lehrkräfte anzeigen', beiAenderung: (w) => { alle = w; laden(); } });
  f.werkzeug({ text: 'Einstellungen', titel: 'Einstellungen des Vertretungsvorschlags', aktion: () => import('./weitere.js').then((w) => w.einstellungenDialog(2)).then(() => laden()) }).classList.add('rechts');

  let ladeNr = 0;
  async function laden() {
    const n = ++ladeNr;
    if (!auswahl?.id) {
      daten = null;
      kopf.lastChild.textContent = 'Keine Vertretung markiert';
      details.textContent = 'In der Vertretungsliste oder in einem Tagesplan eine Vertretung markieren.';
      tabellen.forEach((t) => t.setzen([]));
      vorziehungen.setzen([]);
      zaehlen();
      return;
    }
    const q = new URLSearchParams({ block: opt.block.checked, alle, disloz: opt.disloz.checked, nahe: opt.nahe.checked, besetzt: opt.besetzt.checked });
    let d;
    try { d = await api.get(vpfad(`/vorschlag/${auswahl.id}?${q}`)); } catch (e) { if (e.status === 404) { auswahl = null; return laden(); } throw e; }
    if (n !== ladeNr) return undefined;
    daten = d;
    const mehr = auswahl.ids?.length > 1 ? ` · ${auswahl.ids.length - 1} weitere markiert` : '';
    kopf.lastChild.textContent = d.kopf + mehr;
    leeren(details).append(...d.details.split('\n').map((z) => h('div', null, z)));
    opt.block.disabled = !d.optionen.block;
    opt.disloz.disabled = !d.optionen.disloz;
    opt.dauer.disabled = !d.optionen.dauer;
    kandidaten.setzen(d.kandidaten);
    betreuungen.setzen(d.betreuungen);
    raeume.setzen(d.raeume);
    vorziehungen.setzen(d.vorziehungen);
    zaehlen();
    return undefined;
  }
  function zaehlen() {
    tabs.texte([`Lehrkräfte (${kandidaten.zeilen.length})`, `Betreuungen (${betreuungen.zeilen.length})`, `Räume (${raeume.zeilen.length})`]);
    vorzKopf.lastChild.textContent = `Vorziehungen (${vorziehungen.zeilen.length})`;
  }
  f.an('vertretung.auswahl', (a) => { auswahl = a; laden().catch(fehlerMelden); });
  f.an('daten', (e) => { if (betrifft(e, 'Vertretung', 'Stundenplan', 'Stammdaten', 'Einstellungen')) laden().catch(() => {}); });
  laden().catch(fehlerMelden);
}

export const fenster = {
  'vertretung.vorschlag': { titel: 'Vertretungsvorschlag', symbol: 'vertretung', breite: 760, hoehe: 560, einzig: () => 'vorschlag', erstellen: vorschlagFenster },
};
