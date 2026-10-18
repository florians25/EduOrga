// App-Shell: Seitenleiste (Navigation), Kopfleiste (Schuldatei, Befehlssuche, Modus, Rückgängig/Wiederholen, Konto),
// Arbeitsbereich mit Reitern und geteilten Bereichen, Anmeldung.
import { h, leeren, datumDe } from './dom.js';
import { symbol } from './symbole.js';
import { an, melden } from './ereignisse.js';
import { zustand, modusSetzen } from './zustand.js';
import { api, einstellungLesen, einstellungSchreiben } from './api.js';
import { Navigation, befehlssuche } from './navigation.js';
import { fensterverwaltung, ansichtAusAdresse } from './fenster.js';
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
      h('div', { class: 'anm-marke' }, h('b', null, 'UntPlan'), ' Studio'),
      h('h1', null, 'Anmelden'),
      h('label', null, h('span', null, 'Benutzername'), name), h('label', null, h('span', null, 'Passwort'), pw), fehler, knopf);
    const ueberlagerung = h('div', { class: 'anmeldung' },
      h('div', { class: 'anm-flaeche' }, form),
      h('div', { class: 'anm-fuss' }, `${(zustand.system?.anwendung || 'UntPlan Studio').replace(' (Beta)', '')} ${zustand.system?.version || ''}`));
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
  const qaSpeichern = h('button', { type: 'button', class: 'kl-text', dataset: { qa: 'speichern' }, title: 'Speichern (Strg+S)', onclick: () => speichern().catch(fehlerMelden) }, 'Speichern');
  const navKnopf = knopf('seitenleiste', 'Navigation ein-/ausblenden (Strg+B)', () => shell.navigation.einklappen(!shell.navigation.eingeklappt), 'navigation');

  const dokName = h('span', { class: 'dok-name' });
  const dokInfo = h('span', { class: 'dok-info' });
  const dokKnopf = h('button', { type: 'button', class: 'dok-wahl', title: 'Schuldatei wechseln', onclick: (e) => dokumentMenue(e.currentTarget) },
    h('span', { class: 'dok-texte' }, dokName, dokInfo), symbol('pfeil_runter'));

  const suche = h('button', { type: 'button', class: 'kl-suche', onclick: () => befehlssuche() },
    symbol('suchen'), h('span', null, 'Suchen'), h('kbd', null, navigator.platform?.startsWith('Mac') ? '⌘K' : 'Strg+K'));

  const modusKnoepfe = ['stundenplan', 'vertretung'].map((m) => h('button', {
    type: 'button', role: 'radio', dataset: { modus: m },
    onclick: () => { if (zustand.modus !== m) befehl('modus.umschalten'); },
  }, m === 'stundenplan' ? 'Stundenplanung' : 'Vertretungsplanung'));
  const modus = h('div', { class: 'kl-modus', role: 'radiogroup', 'aria-label': 'Arbeitsmodus' }, modusKnoepfe);

  const praesenz = h('div', { class: 'kl-praesenz' }); // Mehrbenutzerbetrieb: wer arbeitet gerade an der Datei
  const kontext = h('div', { class: 'kl-kontext' }); // eigene Steuerelemente der Module (z. B. Datum der Vertretungsplanung)
  const status = h('div', { class: 'kl-status', title: '' }, h('span', { class: 'text' }));
  const konto = h('button', { type: 'button', class: 'kl-konto', title: 'Konto', onclick: (e) => kontoMenue(e.currentTarget) });

  wurzel.append(h('header', { class: 'kopfleiste' },
    navKnopf, dokKnopf, h('span', { class: 'kl-trenner' }), modus,
    h('div', { class: 'kl-mitte' }), kontext,
    h('div', { class: 'kl-gruppe' }, qaZurueck, qaVor, qaSpeichern), status, praesenz, suche, konto));

  // ---- Seite ----
  const flaeche = h('div', { class: 'flaeche' });
  const willkommen = h('div', { class: 'willkommen' });
  flaeche.append(willkommen);
  const pfad = h('div', { class: 'sk-pfad' });
  const seitenkopf = h('div', { class: 'seitenkopf', hidden: true }, pfad, h('h1', { class: 'sk-titel' }));
  wurzel.append(h('main', { class: 'arbeitsbereich' }, seitenkopf, flaeche));
  let wiederherstellen = false; // während des Wiederherstellens keine Anordnung speichern
  fensterverwaltung.einrichten(flaeche, seitenkopf, () => {
    willkommenZeigen();
    if (zustand.dokument && !wiederherstellen) einstellungSchreiben(`fenster.dok.${zustand.dokument.id}`, fensterverwaltung.anordnung());
  });
  an('seite', ({ haupt }) => {
    // Pfad: Bereich der Navigation, zu dem die Seite gehört
    setTimeout(() => {
      const bereich = document.querySelector('.nav-punkt.aktiv')?.closest('.nav-abschnitt')?.querySelector('.nav-gruppe span')?.textContent;
      pfad.textContent = haupt ? (bereich || (zustand.modus === 'vertretung' ? 'Vertretungsplanung' : 'Stundenplanung')) : '';
    });
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
  let verbunden = true;
  an('verbindung', (ok) => { verbunden = ok; standZeigen(); });

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
      statusText.textContent = !d ? '' : !verbunden ? 'Verbindung unterbrochen' : d.geaendert ? 'Nicht gespeichert' : d.gespeichert ? `Gespeichert ${datumDe(d.gespeichert).split(', ')[1] || ''}` : 'Gespeichert';
      status.classList.toggle('getrennt', !verbunden && !!d);
      status.title = d?.geaendert ? 'Änderungen werden automatisch gespeichert (Strg+S speichert sofort)' : d?.gespeichert ? `Gespeichert am ${datumDe(d.gespeichert)}` : '';
    }
    status.hidden = !d;
  };
  an('stand', standZeigen);
  an('modus', () => { standZeigen(); kontextZeigen(); });

  const kontoZeigen = () => {
    const b = zustand.benutzer;
    leeren(konto);
    if (b) konto.append(h('span', { class: 'avatar' }, initialen(b.anzeigename || b.name)), h('span', { class: 'kl-name' }, b.anzeigename || b.name));
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
    const aktion = (titel, text, f) => h('button', { class: 'wk-aktion', type: 'button', onclick: () => { fensterverwaltung.naechsterAufrufNeueSeite(); return Promise.resolve().then(f).catch(fehlerMelden); } },
      h('b', null, titel), h('span', null, text));
    willkommen.append(h('div', { class: 'wk-inhalt' },
      h('h1', null, d ? d.name : 'Keine Schuldatei geöffnet'),
      h('p', { class: 'leise' }, d ? [d.schulname, d.schuljahr && `Schuljahr ${d.schuljahr}`, d.periode].filter(Boolean).join(' · ') : 'Öffnen Sie eine Schuldatei oder legen Sie eine neue an.'),
      h('div', { class: 'wk-aktionen' }, d
        ? (zustand.modus === 'vertretung'
          ? [aktion('Tagesplanung', 'Kalender, Abwesenheiten, Vertretungen und Tagespläne', () => befehl('vertretung.standard')),
            aktion('Abwesenheiten', 'Lehrkräfte, Klassen und Räume', () => befehl('vertretung.absenzen')),
            aktion('Vertretungen', 'Offene Vertretungen bearbeiten', () => befehl('vertretung.liste')),
            aktion('Vertretungsplan ausgeben', 'Druck, Aushang und Monitor', () => befehl('druck.vertretung'))]
          : [aktion('Übersicht', 'Kennzahlen und Planqualität', () => befehl('start.uebersicht')),
            aktion('Lehrkräfte', 'Stammdaten bearbeiten', () => befehl('stammdaten.oeffnen', { typ: 'lehrer' })),
            aktion('Unterricht', 'Unterrichtsverteilung nach Klassen', () => befehl('unterricht.oeffnen', { sicht: 'klasse' })),
            aktion('Manuell planen', 'Unterricht und Klassenplan', () => befehl('fenster.standard'))])
        : [aktion('Schuldatei öffnen', 'Dateien auf dem Server', () => befehl('datei.backstage', { seite: 'oeffnen' })),
          aktion('Neue Schuldatei', 'Leere Datei oder Beispielschule', () => befehl('datei.backstage', { seite: 'neu' })),
          aktion('Datei hochladen', 'Schuldatei (.up) oder BAL-Datei', () => befehl('datei.hochladen'))])));
  }
  willkommenZeigen();

  // ---- Dokumentwechsel: Seite aus der Adresse bzw. zuletzt gezeigte Seite des Dokuments wiederherstellen ----
  let ersteAnsicht = true;
  an('dokument', async (stand) => {
    wiederherstellen = true;
    try {
      fensterverwaltung.alleSchliessen();
      if (stand) {
        const ziel = ersteAnsicht ? ansichtAusAdresse() : null; // Adresse beim Start (Lesezeichen, Neuladen)
        ersteAnsicht = false;
        if (ziel) fensterverwaltung.seiteOeffnen(ziel.typ, ziel.parameter);
        else {
          const liste = await einstellungLesen(`fenster.dok.${stand.id}`);
          if (zustand.dokument?.id === stand.id && Array.isArray(liste) && liste.length) fensterverwaltung.anordnungLaden(liste);
        }
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
      { text: 'Informationen', aktion: () => befehl('datei.backstage', { seite: 'info' }) },
      { text: 'Speichern', taste: 'Strg+S', aktion: () => speichern(), deaktiviert: !schreiben },
      { text: 'Herunterladen (.up)', aktion: () => herunterladen() },
      { text: 'Schließen', aktion: () => befehl('datei.schliessen') }, null);
  }
  if (zuletzt.length) eintraege.push({ titel: 'Zuletzt verwendet' }, ...zuletzt.map((x) => ({ text: x.name, aktion: () => dokumentOeffnen(x.id) })), null);
  eintraege.push(
    { text: 'Alle Schuldateien …', aktion: () => befehl('datei.backstage', { seite: 'oeffnen' }) },
    { text: 'Neue Schuldatei …', aktion: () => befehl('datei.backstage', { seite: 'neu' }), deaktiviert: !schreiben },
    { text: 'Datei hochladen …', aktion: () => befehl('datei.hochladen'), deaktiviert: !schreiben });
  menue(r.left, r.bottom + 6, eintraege);
}

function kontoMenue(knopf) {
  const r = knopf.getBoundingClientRect();
  const b = zustand.benutzer || {};
  menue(r.right - 240, r.bottom + 6, [
    { titel: `${b.anzeigename || b.name} · ${b.rolle === 'Admin' ? 'Administration' : b.rolle === 'Leser' ? 'Nur lesen' : 'Planung'}` },
    { text: 'Konto und Passwort', aktion: () => befehl('datei.backstage', { seite: 'konto' }) },
    b.rolle === 'Admin' && { text: 'Benutzerverwaltung', aktion: () => befehl('datei.backstage', { seite: 'benutzer' }) },
    { text: 'Navigation ein-/ausblenden', taste: 'Strg+B', aktion: () => shell.navigation.einklappen(!shell.navigation.eingeklappt) },
    { text: 'Gespeicherte Arbeitsplätze …', aktion: () => befehl('fenster.anordnungen') },
    { text: 'Über UntPlan Studio', aktion: () => befehl('datei.backstage', { seite: 'ueber' }) },
    null,
    { text: 'Abmelden', aktion: async () => { await api.post('/api/abmeldung'); location.reload(); } },
  ].filter((x) => x !== false));
}

export { modusSetzen };
