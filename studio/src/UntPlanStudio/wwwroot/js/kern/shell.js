// App-Shell: Seitenleiste (Navigation), Kopfleiste (Schuldatei, Befehlssuche, Modus, Rückgängig/Wiederholen, Konto),
// Arbeitsbereich mit Reitern und geteilten Bereichen, Anmeldung.
import { h, leeren, datumDe } from './dom.js';
import { symbol } from './symbole.js';
import { an, melden } from './ereignisse.js';
import { zustand, modusSetzen } from './zustand.js';
import { api, einstellungLesen, einstellungSchreiben } from './api.js';
import { Navigation, befehlssuche } from './navigation.js';
import { fensterverwaltung } from './fenster.js';
import { speichern, rueckgaengig, wiederholen, herunterladen } from './dokument.js';
import { fehlerMelden, menue } from './dialog.js';
import { tasteBehandeln, befehl, alleRibbonEintraege, tasteRegistrieren } from './modulsystem.js';

export const shell = { navigation: null, ribbon: null };

/** Anmeldeseite; liefert den Benutzer nach erfolgreicher Anmeldung. */
export function anmelden() {
  return new Promise((fertig) => {
    const fehler = h('div', { class: 'fehlertext', role: 'alert' });
    const name = h('input', { class: 'eingabe', name: 'benutzer', autocomplete: 'username', required: true });
    const pw = h('input', { class: 'eingabe', name: 'passwort', type: 'password', autocomplete: 'current-password', required: true });
    const knopf = h('button', { class: 'knopf primaer gross', type: 'submit' }, 'Anmelden');
    const form = h('form', { class: 'anm-formular' },
      h('div', { class: 'anm-marke' }, symbol('logo'), h('span', null, h('b', null, 'UntPlan'), ' Studio')),
      h('h1', null, 'Anmelden'),
      h('p', { class: 'leise' }, 'Melden Sie sich mit Ihrem Studio-Konto an.'),
      h('label', null, h('span', null, 'Benutzername'), name), h('label', null, h('span', null, 'Passwort'), pw), fehler, knopf);
    const ueberlagerung = h('div', { class: 'anmeldung' },
      h('div', { class: 'anm-flaeche' }, form,
        h('div', { class: 'anm-fuss leise' }, `${(zustand.system?.anwendung || 'UntPlan Studio').replace(' (Beta)', '')} ${zustand.system?.version || ''}`)),
      h('div', { class: 'anm-seite', 'aria-hidden': 'true' },
        h('div', { class: 'anm-seite-inhalt' },
          h('div', { class: 'anm-zitat' }, 'Stundenplan, Vertretungen und Auswertungen in einer Anwendung – für die ganze Schulleitung, im Browser.'),
          h('ul', { class: 'anm-liste' },
            h('li', null, symbol('stundenplan'), 'Stunden- und Kursplanung mit automatischer Optimierung'),
            h('li', null, symbol('vertretung'), 'Tagesaktuelle Vertretungsplanung mit Vorschlägen'),
            h('li', null, symbol('klassen'), 'Mehrbenutzerbetrieb mit Rechten und Sperren'),
            h('li', null, symbol('web'), 'Veröffentlichung in UntPlan Web und UntPlan Mobile')))));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      knopf.disabled = true;
      fehler.textContent = '';
      try {
        const b = await api.post('/api/anmeldung', { benutzer: name.value, passwort: pw.value });
        ueberlagerung.remove();
        fertig(b);
      } catch (f) {
        fehler.textContent = f.message;
        pw.select();
      } finally { knopf.disabled = false; }
    });
    document.body.append(ueberlagerung);
    name.focus();
  });
}

function initialen(name = '') {
  const t = name.trim().split(/\s+/).filter(Boolean);
  return ((t[0]?.[0] || '') + (t.length > 1 ? t[t.length - 1][0] : t[0]?.[1] || '')).toUpperCase();
}

/** Baut die Oberfläche auf. */
export function shellAufbauen(wurzel) {
  leeren(wurzel);
  wurzel.classList.add('app');

  // ---- Seitenleiste ----
  shell.navigation = new Navigation(wurzel);
  shell.ribbon = shell.navigation; // ältere Aufrufe (zeichnen/aktualisieren)

  // ---- Kopfleiste ----
  const knopf = (sym, titel, f, id) => h('button', { type: 'button', class: 'kl-knopf', title: titel, 'aria-label': titel, dataset: { qa: id }, onclick: () => Promise.resolve().then(f).catch(fehlerMelden) }, symbol(sym));
  const qaZurueck = knopf('rueckgaengig', 'Rückgängig (Strg+Z)', rueckgaengig, 'rueckgaengig');
  const qaVor = knopf('wiederholen', 'Wiederholen (Strg+Y)', wiederholen, 'wiederholen');
  const qaSpeichern = knopf('speichern', 'Speichern (Strg+S)', speichern, 'speichern');

  const dokName = h('span', { class: 'dok-name' });
  const dokInfo = h('span', { class: 'dok-info' });
  const dokKnopf = h('button', { type: 'button', class: 'dok-wahl', title: 'Schuldatei', onclick: (e) => dokumentMenue(e.currentTarget) },
    h('span', { class: 'dok-symbol' }, symbol('dokument')), h('span', { class: 'dok-texte' }, dokName, dokInfo), symbol('pfeil_runter'));

  const suche = h('button', { type: 'button', class: 'kl-suche', onclick: () => befehlssuche() },
    symbol('suchen'), h('span', null, 'Suchen und ausführen …'), h('kbd', null, navigator.platform?.startsWith('Mac') ? '⌘ K' : 'Strg K'));

  const modusKnoepfe = ['stundenplan', 'vertretung'].map((m) => h('button', {
    type: 'button', role: 'radio', dataset: { modus: m },
    onclick: () => { if (zustand.modus !== m) befehl('modus.umschalten'); },
  }, m === 'stundenplan' ? 'Stundenplanung' : 'Vertretungsplanung'));
  const modus = h('div', { class: 'segment kl-modus', role: 'radiogroup', 'aria-label': 'Arbeitsmodus' }, modusKnoepfe);

  const praesenz = h('div', { class: 'kl-praesenz' }); // Mehrbenutzerbetrieb: wer arbeitet gerade an der Datei
  const kontext = h('div', { class: 'kl-kontext' }); // eigene Steuerelemente der Module (z. B. Datum der Vertretungsplanung)
  const status = h('div', { class: 'kl-status', title: '' }, h('span', { class: 'punkt' }), h('span', { class: 'text' }));
  const konto = h('button', { type: 'button', class: 'kl-konto', title: 'Konto', onclick: (e) => kontoMenue(e.currentTarget) });
  const ansicht = knopf('anordnung', 'Arbeitsbereich anordnen', () => anordnungMenue(ansicht), 'anordnung');

  wurzel.append(h('header', { class: 'kopfleiste' },
    dokKnopf, h('span', { class: 'kl-trenner' }), qaZurueck, qaVor, qaSpeichern, status, praesenz,
    h('div', { class: 'kl-mitte' }, suche),
    kontext, modus, ansicht, konto));

  // ---- Arbeitsbereich ----
  const flaeche = h('div', { class: 'flaeche' });
  const willkommen = h('div', { class: 'willkommen' });
  flaeche.append(willkommen);
  wurzel.append(h('main', { class: 'arbeitsbereich' }, flaeche));
  let wiederherstellen = false; // während des Wiederherstellens keine Anordnung speichern
  fensterverwaltung.einrichten(flaeche, null, () => {
    willkommenZeigen();
    if (zustand.dokument && !wiederherstellen) einstellungSchreiben(`fenster.dok.${zustand.dokument.id}`, fensterverwaltung.anordnung());
  });
  an('fenster-geschlossen', () => willkommenZeigen());

  // ---- Status (Speicherstand, Verbindung, Meldungen anderer Benutzer) ----
  let meldungZeit = 0, meldungAktiv = false;
  const statusText = status.querySelector('.text');
  an('meldung', ({ text, art, angezeigt }) => {
    if (angezeigt) return; // bereits als Hinweis sichtbar
    meldungAktiv = true;
    statusText.textContent = text;
    status.className = `kl-status meldung ${art || ''}`;
    clearTimeout(meldungZeit);
    meldungZeit = setTimeout(() => { meldungAktiv = false; standZeigen(); }, art === 'fehler' ? 10000 : 6000);
  });
  an('verbindung', (ok) => { status.querySelector('.punkt').className = `punkt ${ok ? 'verbunden' : zustand.dokument ? 'getrennt' : ''}`; status.title = ok ? 'Live verbunden – Änderungen anderer erscheinen sofort' : 'Verbindung unterbrochen'; });

  const standZeigen = () => {
    const d = zustand.dokument;
    dokName.textContent = d ? d.name : 'Keine Schuldatei';
    dokInfo.textContent = d ? [d.schulname, d.periode ? `${d.periode}${d.periodeFixiert ? ' (fixiert)' : ''}` : ''].filter(Boolean).join(' · ') : 'Öffnen oder neu anlegen';
    document.title = `${d ? `${d.name} – ` : ''}UntPlan Studio`;
    const schreiben = !!zustand.benutzer?.darfSchreiben;
    qaSpeichern.disabled = !d || !schreiben;
    qaZurueck.disabled = !d?.kannRueckgaengig || !schreiben;
    qaZurueck.title = d?.rueckgaengigText ? `Rückgängig: ${d.rueckgaengigText} (Strg+Z)` : 'Rückgängig (Strg+Z)';
    qaVor.disabled = !d?.kannWiederholen || !schreiben;
    qaVor.title = d?.wiederholenText ? `Wiederholen: ${d.wiederholenText} (Strg+Y)` : 'Wiederholen (Strg+Y)';
    for (const k of modusKnoepfe) { const an_ = k.dataset.modus === zustand.modus; k.classList.toggle('aktiv', an_); k.setAttribute('aria-checked', an_ ? 'true' : 'false'); k.disabled = !d; }
    if (!meldungAktiv) {
      status.className = `kl-status${d?.geaendert ? ' ungespeichert' : ''}`;
      statusText.textContent = !d ? '' : d.geaendert ? 'Nicht gespeicherte Änderungen' : d.gespeichert ? `Gespeichert ${datumDe(d.gespeichert).split(', ')[1] || ''}` : 'Gespeichert';
      status.title = d?.geaendert ? 'Änderungen werden automatisch gespeichert (Strg+S speichert sofort)' : d?.gespeichert ? `Gespeichert am ${datumDe(d.gespeichert)}` : '';
    }
    status.hidden = !d;
  };
  an('stand', standZeigen);
  an('modus', () => { standZeigen(); kontextZeigen(); });

  const kontoZeigen = () => {
    const b = zustand.benutzer;
    leeren(konto);
    if (b) konto.append(h('span', { class: 'avatar' }, initialen(b.anzeigename || b.name)));
  };

  // eigene Steuerelemente der Module (früher im Menüband), je Modus
  const kontextZeigen = () => {
    leeren(kontext);
    for (const e of alleRibbonEintraege()) {
      if (!e.element) continue;
      const nurVertretung = e.reiter === 'Vertretungsplanung';
      if (nurVertretung && zustand.modus !== 'vertretung') continue;
      try { kontext.append(e.element()); } catch (f) { console.error(f); }
    }
    kontext.hidden = !kontext.childElementCount || !zustand.dokument;
  };
  an('dokument', () => kontextZeigen());

  // ---- Willkommen (leerer Arbeitsbereich) ----
  function willkommenZeigen() {
    const leer = fensterverwaltung.alle().length === 0;
    willkommen.hidden = !leer;
    if (!leer) return;
    leeren(willkommen);
    const d = zustand.dokument;
    const aktion = (sym, titel, text, f) => h('button', { class: 'wk-aktion', type: 'button', onclick: () => Promise.resolve().then(f).catch(fehlerMelden) },
      h('span', { class: 'wk-symbol' }, symbol(sym)), h('span', { class: 'wk-texte' }, h('b', null, titel), h('span', null, text)));
    willkommen.append(h('div', { class: 'wk-inhalt' },
      h('div', { class: 'wk-kopf' },
        h('h1', null, d ? d.name : 'Willkommen in UntPlan Studio'),
        h('p', { class: 'leise' }, d
          ? 'Wählen Sie links einen Bereich oder suchen Sie einen Befehl mit Strg+K.'
          : 'Öffnen Sie eine Schuldatei, legen Sie eine neue an oder übernehmen Sie eine vorhandene Datei.')),
      h('div', { class: 'wk-aktionen' }, d
        ? (zustand.modus === 'vertretung'
          ? [aktion('anordnung', 'Tagesplanung', 'Kalender, Abwesenheiten, Vertretungen und Tagespläne', () => befehl('vertretung.standard')),
            aktion('abwesenheit', 'Abwesenheiten', 'Lehrkräfte, Klassen und Räume abwesend melden', () => befehl('vertretung.absenzen')),
            aktion('vertretung', 'Vertretungen', 'Offene Vertretungen bearbeiten', () => befehl('vertretung.liste')),
            aktion('drucken', 'Vertretungsplan ausgeben', 'Druck, Aushang und Monitor', () => befehl('druck.vertretung'))]
          : [aktion('start', 'Übersicht', 'Kennzahlen und Zustand der Schuldatei', () => befehl('start.uebersicht')),
            aktion('lehrer', 'Lehrkräfte', 'Stammdaten der Lehrkräfte bearbeiten', () => befehl('stammdaten.oeffnen', { typ: 'lehrer' })),
            aktion('unterricht', 'Unterricht', 'Unterrichtsverteilung je Klasse', () => befehl('unterricht.oeffnen', { sicht: 'klasse' })),
            aktion('stundenplan', 'Klassenplan', 'Stundenplan ansehen und manuell planen', () => befehl('stundenplan.oeffnen', { typ: 'klasse' }))])
        : [aktion('oeffnen', 'Schuldatei öffnen', 'Aus den Dateien auf dem Server wählen', () => befehl('datei.backstage', { seite: 'oeffnen' })),
          aktion('neu', 'Neue Schuldatei', 'Leere Datei oder Beispielschule anlegen', () => befehl('datei.backstage', { seite: 'neu' })),
          aktion('hochladen', 'Datei hochladen', 'Schuldatei (.up) oder BAL-Datei übernehmen', () => befehl('datei.hochladen'))]),
      h('div', { class: 'wk-tasten leise' },
        h('span', null, h('kbd', null, 'Strg K'), ' Befehl suchen'), h('span', null, h('kbd', null, 'Strg S'), ' Speichern'),
        h('span', null, h('kbd', null, 'Strg Z'), ' Rückgängig'), h('span', null, h('kbd', null, 'Strg ⇧ V'), ' Modus wechseln'))));
  }
  willkommenZeigen();

  // ---- Dokumentwechsel: Anordnung des Dokuments wiederherstellen ----
  an('dokument', async (stand) => {
    wiederherstellen = true;
    try {
      fensterverwaltung.alleSchliessen();
      if (stand) {
        const liste = await einstellungLesen(`fenster.dok.${stand.id}`);
        if (zustand.dokument?.id === stand.id && Array.isArray(liste) && liste.length) fensterverwaltung.anordnungLaden(liste);
      }
    } finally {
      setTimeout(() => { wiederherstellen = false; }, 700);
    }
    willkommenZeigen();
    shell.navigation.aktualisieren();
  });

  // ---- Tastatur ----
  document.addEventListener('keydown', (e) => {
    if (document.querySelector('.dialog-hintergrund, .anmeldung, .bs-hintergrund')) return;
    const imFeld = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
    const strg = e.ctrlKey || e.metaKey;
    if (strg && !e.shiftKey && e.key.toLowerCase() === 'k') { e.preventDefault(); befehlssuche(); return; }
    if (strg && !e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); if (zustand.dokument) speichern().catch(fehlerMelden); return; }
    if (!imFeld && strg && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); rueckgaengig().catch(fehlerMelden); return; }
    if (!imFeld && strg && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); wiederholen().catch(fehlerMelden); return; }
    if (!imFeld) tasteBehandeln(e);
  });
  tasteRegistrieren('Strg+B', () => shell.navigation.einklappen(!shell.navigation.eingeklappt));

  an('benutzer', kontoZeigen);
  kontoZeigen();
  standZeigen();
  kontextZeigen();
  shell.navigation.zeichnen();
  melden('stand', zustand.dokument);
}

// ---------------------------------------------------------------------------------------------
// Menüs der Kopfleiste

async function dokumentMenue(knopf) {
  const r = knopf.getBoundingClientRect();
  const d = zustand.dokument, schreiben = !!zustand.benutzer?.darfSchreiben;
  let zuletzt = [];
  try {
    const liste = await api.get('/api/dokumente');
    zuletzt = liste.zuletzt.map((id) => liste.dokumente.find((x) => x.id === id)).filter((x) => x && x.id !== d?.id).slice(0, 5);
  } catch { /* ohne Liste */ }
  const { dokumentOeffnen } = await import('./dokument.js');
  const eintraege = [];
  if (d) {
    eintraege.push({ titel: d.name },
      { text: 'Informationen', symbol: 'info', aktion: () => befehl('datei.backstage', { seite: 'info' }) },
      { text: 'Speichern', symbol: 'speichern', taste: 'Strg+S', aktion: () => speichern(), deaktiviert: !schreiben },
      { text: 'Herunterladen (.up)', symbol: 'herunterladen', aktion: () => herunterladen() },
      { text: 'Schließen', symbol: 'schliessen', aktion: () => befehl('datei.schliessen') }, null);
  }
  if (zuletzt.length) eintraege.push({ titel: 'Zuletzt verwendet' }, ...zuletzt.map((x) => ({ text: x.name, symbol: 'dokument', aktion: () => dokumentOeffnen(x.id) })), null);
  eintraege.push(
    { text: 'Alle Schuldateien …', symbol: 'oeffnen', aktion: () => befehl('datei.backstage', { seite: 'oeffnen' }) },
    { text: 'Neue Schuldatei …', symbol: 'neu', aktion: () => befehl('datei.backstage', { seite: 'neu' }), deaktiviert: !schreiben },
    { text: 'Datei hochladen …', symbol: 'hochladen', aktion: () => befehl('datei.hochladen'), deaktiviert: !schreiben });
  menue(r.left, r.bottom + 6, eintraege);
}

function kontoMenue(knopf) {
  const r = knopf.getBoundingClientRect();
  const b = zustand.benutzer || {};
  menue(r.right - 240, r.bottom + 6, [
    { titel: `${b.anzeigename || b.name} · ${b.rolle === 'Admin' ? 'Administration' : b.rolle === 'Leser' ? 'Nur lesen' : 'Planung'}` },
    { text: 'Konto und Passwort', symbol: 'benutzer', aktion: () => befehl('datei.backstage', { seite: 'konto' }) },
    b.rolle === 'Admin' && { text: 'Benutzerverwaltung', symbol: 'klassen', aktion: () => befehl('datei.backstage', { seite: 'benutzer' }) },
    { text: 'Seitenleiste ein-/ausklappen', symbol: 'seitenleiste', taste: 'Strg+B', aktion: () => shell.navigation.einklappen(!shell.navigation.eingeklappt) },
    { text: 'Über UntPlan Studio', symbol: 'hilfe', aktion: () => befehl('datei.backstage', { seite: 'ueber' }) },
    null,
    { text: 'Abmelden', symbol: 'abmelden', aktion: async () => { await api.post('/api/abmeldung'); location.reload(); } },
  ].filter((x) => x !== false));
}

function anordnungMenue(knopf) {
  const r = knopf.getBoundingClientRect();
  const d = !!zustand.dokument;
  menue(r.right - 260, r.bottom + 6, [
    { titel: 'Arbeitsbereich' },
    { text: zustand.modus === 'vertretung' ? 'Standardanordnung Vertretung' : 'Standardanordnung', symbol: 'anordnung', aktion: () => befehl(zustand.modus === 'vertretung' ? 'vertretung.standard' : 'fenster.standard'), deaktiviert: !d },
    { text: 'Gespeicherte Anordnungen …', symbol: 'speichern', aktion: () => befehl('fenster.anordnungen') },
    null,
    { text: 'Alle nebeneinander', symbol: 'nebeneinander', aktion: () => fensterverwaltung.anordnen('nebeneinander') },
    { text: 'Alle untereinander', symbol: 'untereinander', aktion: () => fensterverwaltung.anordnen('untereinander') },
    { text: 'Alle als Reiter', symbol: 'ueberlappend', aktion: () => fensterverwaltung.anordnen('ueberlappend') },
    null,
    { text: 'Alle schließen', symbol: 'schliessen', aktion: () => fensterverwaltung.alleSchliessen() },
  ]);
}

export { modusSetzen };
