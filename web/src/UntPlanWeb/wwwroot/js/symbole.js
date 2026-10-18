// Symbole der Oberfläche: Linien-Symbole aus Lucide (ISC-Lizenz, lib/lucide/LICENSE), gezeichnet als Maske in currentColor
// (css/symbole.css). Diese Datei ordnet den fachlichen Namen der Oberfläche (Navigation, Seiten, Bedienelemente) ein Symbol zu;
// Bezeichnungen wie „bi-search“ in den Ansichten sind die allgemeinen Symbolnamen und werden in symbole.css ebenfalls abgebildet.

/** Fachlicher Name → Lucide-Symbol. */
const S = {
  // Hauptbereiche
  heute: 'house', dashboard: 'house', uebersicht: 'layout-dashboard', stundenplan: 'calendar-days', meinplan: 'calendar-check',
  plan: 'calendar-days', plaene: 'calendar-range', vertretungen: 'arrow-left-right', vertretung: 'arrow-left-right',
  unterricht: 'presentation', klassenbuchnav: 'notebook-text', klassenbuch: 'notebook-text', kommunikation: 'mail', mitteilungen: 'mail',
  mitteilung: 'mail', meldenbuchen: 'clipboard-list', melden: 'clipboard-list', verwaltung: 'settings', admin: 'settings',
  stammdaten: 'database', meinedaten: 'circle-user', pruefungen: 'file-check', sprechtag: 'users',

  // Stundenplan
  klasse: 'users', lehrkraft: 'square-user', raumplan: 'door-closed', raum: 'door-open', tag: 'grid-3x3',
  tagklassen: 'rows-3', taglehrer: 'contact', tagraeume: 'building-2', woche: 'calendar-range', ressource: 'package',

  // Klassenbuch
  offen: 'hourglass', eintraege: 'notebook-pen', klassendienste: 'list-checks', fehlzeiten: 'history', abwesenheiten: 'user-x',
  befreiungen: 'shield-check', berichte: 'file-chart-column', sitzplan: 'armchair', hausaufgaben: 'square-pen', hausaufgabe: 'square-pen',

  // Kommunikation
  posteingang: 'inbox', gesendet: 'send', entwuerfe: 'file-pen', verfassen: 'square-pen', listen: 'list',

  // Melden & Buchen, Unterricht
  abwesend: 'user-x', klausur: 'file-check', pruefung: 'file-text', protokoll: 'list', meineunterrichte: 'presentation',

  // Verwaltung
  synchron: 'refresh-cw', benutzer: 'users', ruckmeldung: 'inbox', nachrichten: 'megaphone', monitor: 'monitor',
  freietage: 'calendar-x', import: 'upload', export: 'download', aktive: 'users', rechte: 'shield-check', zuordnung: 'network',
  sperre: 'lock', ansicht: 'sliders-horizontal', versionen: 'history', sitzplanRaum: 'armchair',

  // Allgemein
  zurueck: 'arrow-left', abmelden: 'log-out', profil: 'circle-user', wechseln: 'user-plus', menue: 'menu', mehr: 'ellipsis',
  links: 'chevron-left', rechts: 'chevron-right', unten: 'chevron-down', oben: 'chevron-up', drucken: 'printer', plus: 'plus',
  loeschen: 'trash-2', haken: 'check', x: 'x', schluessel: 'key-round', hochladen: 'upload', herunterladen: 'download',
  info: 'info', warnung: 'triangle-alert', uhr: 'clock', senden: 'send', suchen: 'search', aktualisieren: 'refresh-cw',
  kopieren: 'copy', kalender: 'calendar', stift: 'pencil', augen: 'eye', aufsicht: 'eye', schloss: 'lock', csv: 'file-spreadsheet',
  filter: 'filter', einklappen: 'chevrons-left', glocke: 'bell', online: 'video', neuigkeiten: 'megaphone', hilfe: 'circle-help',
  einstellungen: 'settings-2', speichern: 'save', link: 'link',
};

/** Symbol als HTML (Maske in currentColor, Größe 1em bzw. über CSS); unbekannte Namen liefern null. */
export function symbol(name, klasse = '') {
  const s = S[name];
  return s ? `<i class="sym sym-${s} ${klasse}" aria-hidden="true"></i>` : null;
}

/** Alle verwendeten Lucide-Namen (für das Erzeugen von css/symbole.css). */
export const symbolNamen = [...new Set(Object.values(S))];

/** Wortmarke „UntPlan“ (Text in IBM Plex Sans 600) für Kopfleiste, Anmeldung und Monitor – kein Bildzeichen. */
export const WORTMARKE = '<span class="wortmarke">UntPlan</span>';

/** Marke in der Oberfläche (Wortmarke). Das Monogramm (img/logo.svg) dient nur als Favicon und App-Symbol. */
export const LOGO = WORTMARKE;
