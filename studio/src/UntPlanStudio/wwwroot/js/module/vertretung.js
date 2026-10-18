// Modul „Vertretungsplanung“ (Vertretungsmodus): Planungsdatum in der Kopfleiste (Strg+Bild↑/↓), Arbeitsplatz „Tagesplanung“,
// Abwesenheiten, Vertretungen, Vorschlag, automatische Vertretung, Sondereinsätze, Bereitschaften, Verlegen und Tauschen,
// Vormerkungen, Tagespläne, Listenansichten und Einstellungen; Bereitschaftsplanung.
// Die Ansichten liegen in js/module/vertretung/*.js, die Veranstaltungen im eigenen Modul veranstaltungen.js.
import { zustand } from '../kern/zustand.js';
import { an, melden } from '../kern/ereignisse.js';
import { fensterverwaltung } from '../kern/fenster.js';
import { tasteRegistrieren } from '../kern/modulsystem.js';
import { modusSetzen } from '../kern/zustand.js';
import { blaettern, datumSetzen, isoAus, planungsdatum, aktuelleAuswahl, tageswechsel } from './vertretung/kern.js';
import { datumsElement, fenster as kalenderFenster } from './vertretung/kalender.js';
import { fenster as listeFenster, ANSICHTEN, ansichtText } from './vertretung/liste.js';
import { fenster as absenzFenster } from './vertretung/absenzen.js';
import { fenster as vorschlagFenster } from './vertretung/vorschlag.js';
import { fenster as planFenster } from './vertretung/plan.js';
import { fenster as weitereFenster, sondereinsatzDialog, automatikDialog, einstellungenDialog } from './vertretung/weitere.js';

/** Ansicht der Vertretungsplanung öffnen (schaltet bei Bedarf in den Vertretungsmodus). */
function oeffnen(typ, p = {}, lage = {}) {
  if (!zustand.dokument) return null;
  if (zustand.modus !== 'vertretung') {
    modusSetzen('vertretung');
    try { localStorage.setItem('studio.modus', 'vertretung'); } catch { /* privat */ }
  }
  return fensterverwaltung.oeffnen(typ, p, lage);
}

function flaeche() {
  const el = document.querySelector('.flaeche');
  return { b: el?.clientWidth || 1400, h: el?.clientHeight || 800 };
}

/** Verlegen und Tauschen: Klassen- und Lehrkräfteplan tagesaktuell nebeneinander (Drag & Drop). */
function planungsdialog() {
  const a = aktuelleAuswahl()?.zeile;
  return fensterverwaltung.arbeitsplatz('Verlegen und Tauschen', () => {
    oeffnen('vertretung.plan', { typ: 'klasse', element: a?.klasse ?? undefined }, { andock: 'links' });
    fensterverwaltung.oeffnen('vertretung.plan', { typ: 'lehrer', element: a?.lehrer ?? undefined }, { andock: 'rechts' });
  });
}

/** Kleine Pläne nebeneinander am rechten Rand: Klasse, Lehrkraft, Vertreter und Raum der gewählten Vertretung. */
function kleinePlaene() {
  const a = aktuelleAuswahl()?.zeile || {};
  const { b, h } = flaeche();
  const plaene = [{ typ: 'klasse', element: a.klasse }, { typ: 'lehrer', element: a.lehrer }, { typ: 'lehrer', element: a.vertreter, rolle: 'vertreter' }, { typ: 'raum', element: a.raum }];
  plaene.forEach((p, i) => oeffnen('vertretung.plan', { ...p, element: p.element ?? undefined, kompakt: true }, { x: Math.max(0, b - (plaene.length - i) * 230), y: 0, b: 230, h: Math.min(h, 520) }));
}

/** Arbeitsplatz „Tagesplanung“: Kalender, Abwesenheiten, Vertretungen, Vertretungsvorschlag und Tagespläne. */
function standardanordnung() {
  if (!zustand.dokument) return undefined;
  return fensterverwaltung.arbeitsplatz('Tagesplanung', () => aufbauen());
}

function aufbauen() {
  const { b, h } = flaeche();
  const links = Math.max(380, Math.round(b * 0.27));
  const mitte = Math.round(b * 0.45);
  const oben = Math.round(h * 0.36);
  oeffnen('vertretung.kalender', {}, { x: 0, y: 0, b: links, h: oben });
  oeffnen('vertretung.absenzen', {}, { x: 0, y: oben, b: links, h: h - oben });
  oeffnen('vertretung.vorschlag', {}, { x: links, y: Math.round(h * 0.55), b: mitte, h: h - Math.round(h * 0.55) });
  oeffnen('vertretung.plan', { typ: 'klasse' }, { x: links + mitte, y: 0, b: b - links - mitte, h: Math.round(h / 2) });
  oeffnen('vertretung.plan', { typ: 'lehrer' }, { x: links + mitte, y: Math.round(h / 2), b: b - links - mitte, h: h - Math.round(h / 2) });
  oeffnen('vertretung.liste', {}, { x: links, y: 0, b: mitte, h: Math.round(h * 0.55) });
}

function formatOeffnen(ansicht) {
  oeffnen('vertretung.liste', { ansicht });
  melden('vertretung.ansicht', ansicht);
}

const R = 'Vertretungsplanung';
const D = 'dokument';

export default {
  id: 'vertretung',
  css: ['css/module/vertretung.css'],
  fenster: { ...kalenderFenster, ...listeFenster, ...absenzFenster, ...vorschlagFenster, ...planFenster, ...weitereFenster },
  befehle: {
    'vertretung.oeffnen': ({ fenster: f = 'vertretung.liste', ...p }) => oeffnen(f, p),
    'vertretung.kalender': () => oeffnen('vertretung.kalender'),
    'vertretung.absenzen': (p) => oeffnen('vertretung.absenzen', p),
    'vertretung.liste': (p) => oeffnen('vertretung.liste', p),
    'vertretung.vorschlag': () => oeffnen('vertretung.vorschlag'),
    'vertretung.automatik': () => automatikDialog(planungsdatum(), planungsdatum()),
    'vertretung.sondereinsatz': () => sondereinsatzDialog({}),
    'vertretung.bereitschaften': () => oeffnen('vertretung.bereitschaften'),
    'vertretung.bereitschaftsplanung': () => (zustand.dokument ? fensterverwaltung.oeffnen('vertretung.bereitschaftsplanung', {}) : null),
    'vertretung.vormerkungen': () => oeffnen('vertretung.vormerkungen'),
    'vertretung.planungsdialog': planungsdialog,
    'vertretung.kleinePlaene': kleinePlaene,
    'vertretung.plan': ({ typ = 'klasse', kompakt } = {}) => oeffnen('vertretung.plan', { typ, kompakt }),
    'vertretung.format': ({ ansicht }) => formatOeffnen(ansicht),
    'vertretung.standard': standardanordnung,
    'vertretung.einstellungen': ({ seite = 0 } = {}) => einstellungenDialog(seite),
    'vertretung.heute': () => datumSetzen(isoAus(new Date())),
    'vertretung.naechster': () => blaettern(1),
    'vertretung.vorheriger': () => blaettern(-1),
  },
  ribbon: [
    { id: 'vertretung.kalender', reiter: R, gruppe: 'Kalender', text: 'Kalender', symbol: 'kalender', gross: true, braucht: D, befehl: 'vertretung.kalender', menue: [
      { text: 'Kalender', befehl: 'vertretung.kalender' },
      { text: 'Heute', befehl: 'vertretung.heute' },
      { text: 'Nächster Unterrichtstag', befehl: 'vertretung.naechster', taste: 'Strg+Bild↓' },
      { text: 'Vorheriger Unterrichtstag', befehl: 'vertretung.vorheriger', taste: 'Strg+Bild↑' },
    ] },
    { id: 'vertretung.datum', reiter: R, gruppe: 'Kalender', text: 'Datum', gross: true, element: datumsElement },
    { id: 'vertretung.absenzen', reiter: R, gruppe: 'Vertretungsplanung', text: 'Abwesenheiten', symbol: 'abwesenheit', gross: true, braucht: D, befehl: 'vertretung.absenzen', taste: 'Strg+M', menue: [
      { text: 'Abwesenheiten', befehl: 'vertretung.absenzen', taste: 'Strg+M' },
      { text: 'Abwesenheitsgründe', befehl: 'stammdaten.oeffnen', args: { typ: 'abwesenheitsgrund' } },
    ] },
    { id: 'vertretung.vertretungen', reiter: R, gruppe: 'Vertretungsplanung', text: 'Vertretungen', symbol: 'vertretung', gross: true, braucht: D, befehl: 'vertretung.liste', taste: 'Strg+T', menue: [
      { text: 'Vertretungen', befehl: 'vertretung.liste', taste: 'Strg+T' },
      { text: 'Vertretungsvorschlag', befehl: 'vertretung.vorschlag', taste: 'Strg+G' },
      null,
      { text: 'Automatische Vertretung …', befehl: 'vertretung.automatik', braucht: 'schreiben' },
    ] },
    { id: 'vertretung.vorschlag', reiter: R, gruppe: 'Vertretungsplanung', text: 'Vorschlag', symbol: 'lehrer', braucht: D, befehl: 'vertretung.vorschlag', taste: 'Strg+G', hinweis: 'Vertretungsvorschlag' },
    { id: 'vertretung.automatik', reiter: R, gruppe: 'Vertretungsplanung', text: 'Automatik', symbol: 'optimierung', braucht: 'schreiben', befehl: 'vertretung.automatik', hinweis: 'Automatische Vertretung' },
    { id: 'vertretung.sondereinsaetze', reiter: R, gruppe: 'Ereignisse', text: 'Sondereinsätze', symbol: 'lehrer', braucht: 'schreiben', befehl: 'vertretung.sondereinsatz' },
    { id: 'vertretung.bereitschaften', reiter: R, gruppe: 'Ereignisse', text: 'Bereitschaften', symbol: 'vertretung', braucht: D, befehl: 'vertretung.bereitschaften' },
    { id: 'vertretung.planungsdialog', reiter: R, gruppe: 'Planung', text: 'Verlegen und Tauschen', symbol: 'stundenplan', gross: true, braucht: D, befehl: 'vertretung.planungsdialog', hinweis: 'Tagespläne von Klasse und Lehrkraft nebeneinander (Drag & Drop: Verlegen, Tauschen)' },
    { id: 'vertretung.vormerkungen', reiter: R, gruppe: 'Planung', text: 'Vormerkungen', symbol: 'info', gross: true, braucht: D, befehl: 'vertretung.vormerkungen' },
    { id: 'vertretung.plan.klasse', reiter: R, gruppe: 'Stundenpläne', text: 'Tagesplan Klasse', symbol: 'klassen', braucht: D, befehl: 'vertretung.plan', args: { typ: 'klasse' }, hinweis: 'Tagesaktueller Stundenplan einer Klasse' },
    { id: 'vertretung.plan.lehrer', reiter: R, gruppe: 'Stundenpläne', text: 'Tagesplan Lehrkraft', symbol: 'lehrer', braucht: D, befehl: 'vertretung.plan', args: { typ: 'lehrer' }, hinweis: 'Tagesaktueller Stundenplan einer Lehrkraft' },
    { id: 'vertretung.plan.raum', reiter: R, gruppe: 'Stundenpläne', text: 'Tagesplan Raum', symbol: 'raeume', braucht: D, befehl: 'vertretung.plan', args: { typ: 'raum' }, hinweis: 'Tagesaktueller Stundenplan eines Raums' },
    { id: 'vertretung.plan.klein', reiter: R, gruppe: 'Stundenpläne', text: 'Kleine Pläne', symbol: 'uebersicht', braucht: D, befehl: 'vertretung.kleinePlaene', menue: [
      { text: 'Kompaktpläne nebeneinander', befehl: 'vertretung.kleinePlaene' },
      null,
      { text: 'Kompaktplan Klasse', befehl: 'vertretung.plan', args: { typ: 'klasse', kompakt: true } },
      { text: 'Kompaktplan Lehrkraft', befehl: 'vertretung.plan', args: { typ: 'lehrer', kompakt: true } },
      { text: 'Kompaktplan Raum', befehl: 'vertretung.plan', args: { typ: 'raum', kompakt: true } },
    ], hinweis: 'Kompakte Tagespläne nebeneinander – folgen der gewählten Vertretung' },
    { id: 'vertretung.formate', reiter: R, gruppe: 'Einstellungen', text: 'Listenansichten', symbol: 'uebersicht', braucht: D, menue: [
      ...ANSICHTEN.map((a) => ({ text: ansichtText(a), befehl: 'vertretung.format', args: { ansicht: a } })),
      null,
      { text: 'Arbeitsplatz Tagesplanung', befehl: 'vertretung.standard' },
      { text: 'Eigene Anordnungen …', befehl: 'fenster.anordnungen' },
    ] },
    { id: 'vertretung.einstellungen', reiter: R, gruppe: 'Einstellungen', text: 'Einstellungen', symbol: 'einstellungen', braucht: D, befehl: 'vertretung.einstellungen', menue: [
      { text: 'Regeln je Stunde …', befehl: 'vertretung.einstellungen', args: { seite: 0 } },
      { text: 'Vertretungszähler …', befehl: 'vertretung.einstellungen', args: { seite: 1 } },
      { text: 'Vertretungsvorschlag …', befehl: 'vertretung.einstellungen', args: { seite: 2 } },
      { text: 'Allgemein …', befehl: 'vertretung.einstellungen', args: { seite: 3 } },
      { text: 'Arten und Farben …', befehl: 'vertretung.einstellungen', args: { seite: 4 } },
    ] },
    // Bereitschaftsplanung (Modul) in Dateneingabe und Module
    { id: 'eingabe.bereitschaft', reiter: 'Dateneingabe', gruppe: 'Spezielle Daten', text: 'Bereitschaftsplanung', symbol: 'vertretung', braucht: D, befehl: 'vertretung.bereitschaftsplanung' },
    { id: 'module.bereitschaft', reiter: 'Module', gruppe: 'Weitere Module', text: 'Bereitschaftsplanung', symbol: 'vertretung', gross: true, braucht: D, befehl: 'vertretung.bereitschaftsplanung' },
  ],
  start() {
    const imModus = (f) => () => { if (zustand.dokument && zustand.modus === 'vertretung') f(); };
    tasteRegistrieren('Strg+PageUp', imModus(() => blaettern(-1)));
    tasteRegistrieren('Strg+PageDown', imModus(() => blaettern(1)));
    // Wechsel in den Vertretungsmodus: Vertretungen des Planungsdatums abgleichen (wie beim Tageswechsel)
    an('modus', (m) => { if (m === 'vertretung' && zustand.dokument && planungsdatum() && zustand.benutzer?.darfSchreiben) tageswechsel(planungsdatum(), planungsdatum()); });
  },
};
