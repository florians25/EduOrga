// UntPlan Web – Einstieg: Sitzung laden, Anmeldung/Einrichtung, Hülle und Hash-Router.
// Hülle: helle Kopfleiste (Wortmarke, Schule, Hauptbereiche als Text, Suche, Infos, Konto), darunter je Bereich eine Reiterleiste;
// auf dem Telefon eine untere Leiste mit vier Hauptbereichen und „Mehr“ (Blatt mit allen übrigen Bereichen). Keine Symbole in der Navigation.
import { LOGO, icon, e, holen, senden, api, fehler, alarm, lade, toast } from './ui.js';
import { beobachten as auswahlBeobachten } from './auswahl.js';
import { beobachten as kalenderBeobachten } from './kalender.js';

const ANSICHTEN = {
  heute: () => import('./ansichten/heute.js'),
  uebersicht: () => import('./ansichten/uebersicht.js'),
  plan: () => import('./ansichten/plan.js'),
  tag: () => import('./ansichten/tag.js'),
  vertretungen: () => import('./ansichten/vertretungen.js'),
  mitteilungen: () => import('./ansichten/mitteilungen.js'),
  unterricht: () => import('./ansichten/unterricht.js'),
  unterrichtklassen: () => import('./ansichten/unterrichtklassen.js'),
  offen: () => import('./ansichten/offen.js'),
  pruefungen: () => import('./ansichten/pruefungen.js'),
  pruefungskalender: () => import('./ansichten/pruefungskalender.js'),
  schueler: () => import('./ansichten/schueler.js'),
  aufgaben: () => import('./ansichten/hausaufgaben.js'),
  klassenbuch: () => import('./ansichten/klassenbuch.js'),
  eintraege: () => import('./ansichten/eintraege.js'),
  hausaufgaben: () => import('./ansichten/hausaufgaben.js'),
  dienste: () => import('./ansichten/dienste.js'),
  abwesenheiten: () => import('./ansichten/abwesenheiten.js'),
  entschuldigen: () => import('./ansichten/entschuldigungen.js'),
  befreiungen: () => import('./ansichten/befreiungen.js'),
  berichte: () => import('./ansichten/berichte.js'),
  sitzplan: () => import('./ansichten/sitzplan.js'),
  melden: () => import('./ansichten/melden.js'),
  buchen: () => import('./ansichten/buchen.js'),
  stammdaten: () => import('./ansichten/stammdaten.js'),
  admin: () => import('./ansichten/admin.js'),
  profil: () => import('./ansichten/profil.js'),
  neuigkeiten: () => import('./ansichten/neuigkeiten.js'),
  sprechtag: () => import('./ansichten/sprechtag.js'),
  hinweise: () => import('./ansichten/hinweise.js'),
  kbeinstellungen: () => import('./ansichten/kbeinstellungen.js'),
};

const app = document.getElementById('app');
let sitzung = null;
let elementeCache = null;
let laufendeAnsicht = null;
let aktiverPunkt = null;

/** Gemeinsamer Kontext für alle Ansichten. */
const kontext = {
  get sitzung() { return sitzung; },
  get ich() { return sitzung?.benutzer; },
  /** Schüler- bzw. Elternkonto mit eigenen Seiten (Abwesenheiten, Fehlzeiten, Hausaufgaben des Kindes). */
  get familie() { return familie(sitzung?.benutzer); },
  /**
   * Gewähltes Schuljahr (Auswahl in der Kopfleiste): { von, bis, text, aktuell }. Listen und Berichte nehmen es als Zeitraum;
   * ohne Auswahl gilt das aktuelle Schuljahr aus UntPlan.
   */
  get schuljahr() { return gewaehltesSchuljahr(); },
  /** Ansichtseinstellungen der Administration (Wochenende, Uhrzeiten auf Karten …). */
  get ansicht() { return sitzung?.ansicht ?? {}; },
  /** Stammdaten (Klassen, Lehrkräfte, Räume, Fächer, Zeitraster) – einmal je Sitzung geladen. */
  async elemente(neu = false) {
    if (!elementeCache || neu) elementeCache = await holen('/api/app/elemente');
    return elementeCache;
  },
  /** Seitentitel (mit Zusatz wie „6 / 14“) und Aktionen rechts im Seitenkopf. Ohne Titel und Aktionen entfällt der Kopf. */
  titel(text, rechts = '', zusatz = '') {
    const kopf = document.getElementById('seitenkopf');
    const h = document.getElementById('titel');
    if (h) h.innerHTML = text ? `${e(text)}${zusatz ? ` <small>${e(zusatz)}</small>` : ''}` : '';
    const k = document.getElementById('kopftitel');
    if (k) k.textContent = text || bereichVon(aktiverPunkt)?.text || 'UntPlan';
    const r = document.getElementById('aktionen');
    if (r) r.innerHTML = rechts;
    kopf?.classList.toggle('d-none', !text && !rechts);
    document.title = text ? `${text} – UntPlan` : 'UntPlan';
  },
  /** Werkzeugleiste über dem Inhalt (z. B. Suche und Zeitraum im Klassenbuch); leer = keine Leiste. */
  werkzeug(html = '') {
    const w = document.getElementById('werkzeug');
    if (!w) return null;
    w.innerHTML = html;
    w.classList.toggle('d-none', !html);
    document.querySelector('.u-app')?.classList.toggle('u-mit-werkzeug', !!html);
    return w;
  },
  navigieren(hash, ersetzen = false) {
    if (ersetzen) { history.replaceState(null, '', hash); route(); }
    else if (location.hash === hash) route();
    else location.hash = hash;
  },
  async sitzungNeu() {
    sitzung = await holen('/api/app/sitzung');
    zaehlerAktualisieren();
    return sitzung;
  },
  fehler,
};

window.addEventListener('untplan:abgemeldet', () => { if (sitzung?.benutzer) { dialogeSchliessen(); sitzung.benutzer = null; start(); } });

/**
 * Beim Abmelden offene Dialoge (z. B. Stundendetails) schließen: die Dialoge brechen ihre Anfragen und Folgeaktionen ab
 * (Ereignis „untplan:abmeldung“), übrig gebliebene Modals und Hintergründe werden entfernt – die Anmeldeseite bleibt bedienbar.
 */
function dialogeSchliessen() {
  window.dispatchEvent(new CustomEvent('untplan:abmeldung'));
  document.querySelectorAll('.modal').forEach(m => { try { bootstrap.Modal.getInstance(m)?.dispose(); } catch { /* schon weg */ } m.remove(); });
  document.querySelectorAll('.modal-backdrop, .u-hover-label').forEach(x => x.remove());
  document.body.classList.remove('modal-open');
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('padding-right');
}
window.addEventListener('hashchange', () => route());

// Einmalanmeldung für UntPlan Mobile: nach der Anmeldung zurück zu /sso/… (nur relative Pfade, kein offener Weiterleiter)
const weiterNachAnmeldung = (() => {
  const w = new URLSearchParams(location.search).get('weiter');
  if (w && w.startsWith('/sso/') && !w.startsWith('//')) {
    try { sessionStorage.setItem('untplan:weiter', w); } catch { /* privat */ }
    history.replaceState(null, '', location.pathname + location.hash);
  }
  try { return sessionStorage.getItem('untplan:weiter'); } catch { return w; }
})();

async function start() {
  try { sitzung = await holen('/api/app/sitzung'); }
  catch (err) {
    app.innerHTML = `<main class="anmeldung"><div class="an-karte">${alarm('danger', err.message)}<button class="btn btn-primary w-100" data-neu>Erneut versuchen</button></div></main>`;
    app.querySelector('[data-neu]').onclick = () => location.reload();
    return;
  }
  elementeCache = null;
  if (!sitzung.eingerichtet) return einrichtung();
  if (!sitzung.benutzer) return anmeldung();
  if (sitzung.benutzer.passwortAendern) return passwortPflicht();
  if (weiterNachAnmeldung) {
    try { sessionStorage.removeItem('untplan:weiter'); } catch { /* privat */ }
    location.href = weiterNachAnmeldung;
    return;
  }
  huelle();
  route();
}

// ------------------------------------------------------------------ Anmeldung und Einrichtung

/**
 * Anmeldeseite: schlicht und zentriert. Oben Wortmarke und Schulname, darunter das Formular, darunter die öffentlichen Hinweise der Schule.
 */
function anmeldeRahmen(titel, inhalt, untertitel = '') {
  const schule = sitzung?.schule?.name || '';
  app.innerHTML = `<main class="anmeldung an-seite">
    <header class="an-kopfzeile">${LOGO}${schule ? `<span class="an-schule">${e(schule)}</span>` : ''}</header>
    <section class="an-bereich">
      <div class="an-karte">
        <div class="an-kopf"><h1 class="an-titel">${e(titel)}</h1>${untertitel ? `<p class="an-unter">${e(untertitel)}</p>` : ''}</div>
        <div class="lg-form">${inhalt}</div>
      </div>
      <div class="an-hinweise" data-hinweise hidden></div>
      <footer class="an-fuss"><button type="button" class="btn btn-outline-secondary btn-sm lg-app d-none" data-pwa>Als App installieren</button>
        <span class="lg-app-text" data-pwa-text>Auf dem Smartphone lässt sich UntPlan über „Zum Startbildschirm hinzufügen“ wie eine App nutzen.</span></footer>
    </section></main>`;
  // App installieren (PWA), sobald der Browser es anbietet
  const pwa = app.querySelector('[data-pwa]');
  const anbieten = () => { if (!window.__pwaAngebot) return; pwa.classList.remove('d-none'); app.querySelector('[data-pwa-text]')?.classList.add('d-none'); };
  pwa.onclick = async () => { const p = window.__pwaAngebot; if (!p) return; window.__pwaAngebot = null; p.prompt(); try { await p.userChoice; } catch { /* egal */ } pwa.classList.add('d-none'); };
  anbieten();
  window.addEventListener('untplan:pwa', anbieten, { once: true });
  oeffentlicheHinweise(app.querySelector('[data-hinweise]'));
  // Passwortfelder: Auge zum Anzeigen
  app.querySelectorAll('.lg-feld input[type=password]').forEach(i => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'lg-auge'; b.setAttribute('aria-label', 'Passwort anzeigen'); b.innerHTML = '<i class="bi bi-eye" aria-hidden="true"></i>';
    b.onclick = () => { const zeigen = i.type === 'password'; i.type = zeigen ? 'text' : 'password'; b.innerHTML = `<i class="bi bi-eye${zeigen ? '-slash' : ''}" aria-hidden="true"></i>`; b.setAttribute('aria-label', zeigen ? 'Passwort verbergen' : 'Passwort anzeigen'); i.focus(); };
    i.after(b);
  });
  return app.querySelector('form');
}
/**
 * Öffentliche Hinweise der Schule (z. B. „Elternsprechtag am …“) auf der Anmeldeseite – ohne Anmeldung, ohne Cookies und ohne Tracking;
 * der Server liefert nur freigegebene, allgemeine Hinweise im Anzeigezeitraum (reiner Text).
 */
async function oeffentlicheHinweise(box) {
  if (!box) return;
  let liste = [];
  try {
    const r = await fetch('/api/app/hinweise/oeffentlich', { credentials: 'omit', cache: 'no-store' });
    if (r.ok) liste = await r.json();
  } catch { return; }
  if (!Array.isArray(liste) || !liste.length || !box.isConnected) return;
  box.innerHTML = `<h2 class="an-hinweise-titel">Hinweise der Schule</h2>${liste.map(h => `<article class="an-hinweis">
      <div><h3>${e(h.titel)}</h3>${h.text ? `<p>${e(h.text).replace(/\n/g, '<br>')}</p>` : ''}</div></article>`).join('')}`;
  box.hidden = false;
}
window.addEventListener('beforeinstallprompt', ev => { ev.preventDefault(); window.__pwaAngebot = ev; window.dispatchEvent(new Event('untplan:pwa')); });

const meldung = (form, text) => { form.querySelector('[data-meldung]').innerHTML = alarm('danger', text); };

function anmeldung() {
  document.title = 'Anmelden – UntPlan';
  const form = anmeldeRahmen('Anmelden', `<form autocomplete="on">
      <label class="lg-feld"><span>Benutzername</span><input id="login" name="login" autocomplete="username" required autofocus></label>
      <label class="lg-feld"><span>Passwort</span><input id="passwort" name="passwort" type="password" autocomplete="current-password" required></label>
      <div data-meldung></div>
      <button class="btn btn-primary lg-login" type="submit">Anmelden</button>
      <button type="button" class="lg-vergessen" data-vergessen aria-expanded="false">Passwort vergessen?</button>
      <p class="lg-hinweis d-none" data-vergessen-text>Ein neues Passwort vergibt die Administration Ihrer Schule. Bitte wenden Sie sich dorthin.</p>
    </form>`, 'Mit dem Konto Ihrer Schule.');
  // Zugriff gesperrt (Wartungsmodus): Hinweis der Administration über dem Formular
  holen('/api/app/zugriff').then(z => {
    if (z.gesperrt) form.querySelector('[data-meldung]').insertAdjacentHTML('beforebegin', `<div class="lg-wartung" role="status"><span>${e(z.hinweis)}</span></div>`);
  }).catch(() => { /* ohne Hinweis */ });
  form.querySelector('[data-vergessen]').onclick = ev => {
    const t = form.querySelector('[data-vergessen-text]');
    t.classList.toggle('d-none');
    ev.currentTarget.setAttribute('aria-expanded', String(!t.classList.contains('d-none')));
  };
  form.onsubmit = async ev => {
    ev.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await senden('/api/app/anmelden', { login: form.login.value.trim(), passwort: form.passwort.value });
      await start();
    } catch (err) { meldung(form, err.message); form.passwort.select(); }
    finally { btn.disabled = false; }
  };
}

function einrichtung() {
  document.title = 'Einrichtung – UntPlan';
  const form = anmeldeRahmen('Ersteinrichtung', `<form>
      <div class="mb-3"><label class="form-label">Name der Schule</label><input class="form-control" name="schulname" required autofocus></div>
      <div class="mb-3"><label class="form-label">Benutzername</label><input class="form-control" name="login" value="admin" required autocomplete="username"></div>
      <div class="mb-3"><label class="form-label">Passwort</label><input class="form-control" name="passwort" type="password" minlength="8" required autocomplete="new-password"><div class="form-text">Mindestens 8 Zeichen.</div></div>
      <div class="mb-3"><label class="form-label">Passwort wiederholen</label><input class="form-control" name="passwort2" type="password" minlength="8" required autocomplete="new-password"></div>
      <div data-meldung></div>
      <button class="btn btn-primary w-100" type="submit">Einrichten</button>
    </form>`, 'Legen Sie die Schule und das Administrationskonto an.');
  form.onsubmit = async ev => {
    ev.preventDefault();
    if (form.passwort.value !== form.passwort2.value) return meldung(form, 'Die Passwörter stimmen nicht überein.');
    try {
      const r = await senden('/api/app/einrichten', { schulname: form.schulname.value.trim(), login: form.login.value.trim(), passwort: form.passwort.value });
      try { sessionStorage.setItem('untplan:neuerSchluessel', JSON.stringify({ schulId: r.schulId, apiSchluessel: r.apiSchluessel })); } catch { /* privat */ }
      location.hash = '#/admin/sync';
      await start();
    } catch (err) { meldung(form, err.message); }
  };
}

function passwortPflicht() {
  document.title = 'Passwort ändern – UntPlan';
  const form = anmeldeRahmen('Neues Passwort festlegen', `<form>
      <div class="mb-3"><label class="form-label">Bisheriges Passwort</label><input class="form-control" name="alt" type="password" required autocomplete="current-password" autofocus></div>
      <div class="mb-3"><label class="form-label">Neues Passwort</label><input class="form-control" name="neu" type="password" minlength="8" required autocomplete="new-password"><div class="form-text">Mindestens 8 Zeichen.</div></div>
      <div class="mb-3"><label class="form-label">Neues Passwort wiederholen</label><input class="form-control" name="neu2" type="password" minlength="8" required autocomplete="new-password"></div>
      <div data-meldung></div>
      <button class="btn btn-primary w-100 mb-2" type="submit">Speichern</button>
      <button class="btn btn-link w-100 btn-sm" type="button" data-abmelden>Abmelden</button>
    </form>`, 'Bitte vergeben Sie vor der ersten Nutzung ein eigenes Passwort.');
  form.querySelector('[data-abmelden]').onclick = abmelden;
  form.onsubmit = async ev => {
    ev.preventDefault();
    if (form.neu.value !== form.neu2.value) return meldung(form, 'Die Passwörter stimmen nicht überein.');
    try { await senden('/api/app/passwort', { alt: form.alt.value, neu: form.neu.value }); await start(); }
    catch (err) { meldung(form, err.message); }
  };
}

async function abmelden() {
  dialogeSchliessen();
  try { await senden('/api/app/abmelden', {}); } catch { /* egal */ }
  sitzung = null;
  history.replaceState(null, '', '#/heute');
  start();
}

// ------------------------------------------------------------------ Bereiche und Reiter

/**
 * Hauptbereiche je Rolle. Ein Bereich hat id, text, icon und unter (Reiter); ein Reiter hat nav (Schlüssel für „aktiv“ und die Rechte-
 * prüfung im Router), href und text; abschnitt trennt Reitergruppen durch einen Strich; gruppe (mit unter) bildet einen Reiter mit
 * Auswahlliste (Verwaltung). prio: Reihenfolge in der unteren Leiste auf dem Telefon (die vier kleinsten Werte).
 */
function menue() {
  const b = sitzung.benutzer;
  const k = b.kollegium;
  const m = [
    { id: 'heute', text: 'Heute', icon: 'heute', prio: 1, unter: [
      { nav: 'heute', href: '#/heute', text: 'Mein Tag' },
      { nav: 'uebersicht', href: '#/uebersicht', text: 'Überblick' },
    ] },
    { id: 'mitteilungen', text: 'Kommunikation', icon: 'kommunikation', prio: 5, zaehler: true, unter: [
      { nav: 'mitteilungen', href: '#/mitteilungen', text: 'Posteingang', zaehler: true },
      { nav: 'mitteilungen-gesendet', href: '#/mitteilungen/gesendet', text: 'Gesendet' },
      { nav: 'mitteilungen-entwuerfe', href: '#/mitteilungen/entwuerfe', text: 'Entwürfe' },
      ...(k ? [{ nav: 'mitteilungen-listen', href: '#/mitteilungen/listen', text: 'Verteilerlisten' }] : []),
      ...(b.rolle === 'admin' ? [{ nav: 'mitteilungen-einstellungen', href: '#/mitteilungen/einstellungen', text: 'Einstellungen' }] : []),
    ] },
  ];
  const plaene = [];
  if (b.element) plaene.push({ nav: 'plan-mein', href: '#/plan/mein', text: 'Mein Plan' });
  plaene.push({ nav: 'plan-klasse', href: '#/plan/klasse', text: 'Klassen' });
  if (k) plaene.push({ nav: 'plan-lehrer', href: '#/plan/lehrer', text: 'Lehrkräfte' });
  plaene.push({ nav: 'plan-raum', href: '#/plan/raum', text: 'Räume' });
  if (k) {
    plaene.push({ nav: 'tag-klasse', href: '#/tag/klasse', text: 'Klassen am Tag', abschnitt: 'tag' });
    plaene.push({ nav: 'tag-lehrer', href: '#/tag/lehrer', text: 'Lehrkräfte am Tag', abschnitt: 'tag' });
    plaene.push({ nav: 'tag-raum', href: '#/tag/raum', text: 'Räume am Tag', abschnitt: 'tag' });
    m.push({ id: 'stundenplan', text: 'Stundenplan', icon: 'stundenplan', prio: 2, unter: plaene });
    m.push({ id: 'vertretungen', text: 'Vertretungen', icon: 'vertretungen', prio: 3, unter: [
      { nav: 'vertretungen', href: '#/vertretungen', text: 'Vertretungsplan' },
    ] });
    // Unterricht: eigener Unterricht, Lerngruppen, Schüler*innen, Prüfungen, Aufgaben, Tageslisten
    m.push({ id: 'unterricht', text: 'Unterricht', icon: 'unterricht', prio: 6, unter: [
      { nav: 'unterricht', href: '#/unterricht', text: b.element ? 'Mein Unterricht' : 'Unterricht' },
      { nav: 'unterricht-klasse', href: '#/unterricht/klasse', text: 'Klassen' },
      // Lerngruppen (unterrichtklassen.js): Schülergruppen, Abmeldungen, befristeter Unterrichtswechsel
      ...(b.rechte?.['unterricht.klassen'] ? [{ nav: 'unterrichtklassen', href: '#/unterrichtklassen', text: 'Lerngruppen' }] : []),
      { nav: 'schueler', href: '#/schueler', text: 'Schüler*innen' },
      { nav: 'buchen-unterricht', href: '#/buchen/unterricht', text: 'Unterricht anlegen' },
      { nav: 'pruefungen', href: '#/pruefungen', text: 'Prüfungen', abschnitt: 'pruefung' },
      { nav: 'pruefungskalender', href: '#/pruefungskalender', text: 'Prüfungskalender', abschnitt: 'pruefung' },
      { nav: 'aufgaben', href: '#/aufgaben', text: 'Aufgaben', abschnitt: 'pruefung' },
      { nav: 'u-tag-lehrer', href: '#/tag/lehrer/-/u', text: 'Tagesliste Lehrkraft', abschnitt: 'tag' },
      { nav: 'u-tag-klasse', href: '#/tag/klasse/-/u', text: 'Tagesliste Klasse', abschnitt: 'tag' },
      ...(b.admin || b.rechte?.['klassenbuch.einstellungen'] ? [{ nav: 'kbeinstellungen-unterricht', href: '#/kbeinstellungen/unterricht', text: 'Einstellungen', abschnitt: 'einst' }] : []),
    ] });
    m.push({ id: 'klassenbuch', text: 'Klassenbuch', icon: 'klassenbuchnav', prio: 4, unter: [
      { nav: 'klassenbuch', href: '#/klassenbuch', text: 'Übersicht' },
      { nav: 'klassenbuch-woche', href: '#/klassenbuch/-/woche', text: 'Woche' },
      { nav: 'offen', href: '#/offen', text: 'Unbearbeitete Stunden' },
      { nav: 'eintraege', href: '#/eintraege', text: 'Einträge' },
      { nav: 'hausaufgaben', href: '#/hausaufgaben', text: 'Hausaufgaben' },
      { nav: 'dienste', href: '#/dienste', text: 'Dienste' },
      ...(b.fehlzeiten ? [{ nav: 'abwesenheiten', href: '#/abwesenheiten', text: 'Abwesenheiten', abschnitt: 'fehl' },
        { nav: 'fehlzeiten', href: '#/klassenbuch/-/fehlzeiten', text: 'Fehlzeiten', abschnitt: 'fehl' }] : []),
      // Fachlehrer-Entschuldigungen: Fehlstunden des eigenen Unterrichts entschuldigen
      ...(b.fachlehrerEntschuldigungen ? [{ nav: 'entschuldigen', href: '#/entschuldigen', text: b.fehlzeiten ? 'Fehlzeiten eigener Unterricht' : 'Fehlzeiten', abschnitt: 'fehl' }] : []),
      { nav: 'befreiungen', href: '#/befreiungen', text: 'Befreiungen', abschnitt: 'fehl' },
      { nav: 'sitzplan', href: '#/sitzplan', text: 'Sitzplan', verborgen: true },
      { nav: 'berichte', href: '#/berichte', text: 'Berichte', abschnitt: 'bericht' },
      ...(b.admin || b.rechte?.['klassenbuch.einstellungen'] ? [{ nav: 'kbeinstellungen', href: '#/kbeinstellungen', text: 'Einstellungen', abschnitt: 'bericht' }] : []),
    ] });
    // Melden (Rückmeldungen an die Planung) und Buchen (buchen.js: Räume, Ressourcen, Aktivitäten; Verwaltung nur für die Administration)
    m.push({ id: 'melden', text: 'Melden & Buchen', icon: 'meldenbuchen', prio: 7, unter: [
      { nav: 'melden-uebersicht', href: '#/melden', text: 'Übersicht', icon: 'ruckmeldung' },
      { nav: 'melden-abwesenheit', href: '#/melden/abwesenheit', text: 'Abwesenheit melden' },
      { nav: 'melden-klausur', href: '#/melden/klausur', text: 'Prüfung eintragen' },
      { nav: 'melden-meine', href: '#/melden/meine', text: 'Meine Meldungen' },
      { nav: 'buchen-raum', href: '#/buchen/raum', text: 'Raum buchen', abschnitt: 'buchen' },
      { nav: 'buchen-ressource', href: '#/buchen/ressource', text: 'Ressource buchen', abschnitt: 'buchen' },
      { nav: 'buchen-aktivitaet', href: '#/buchen/aktivitaet', text: 'Aktivität anlegen', abschnitt: 'buchen' },
      { nav: 'buchen-meine', href: '#/buchen/meine', text: 'Meine Buchungen', abschnitt: 'buchen' },
      { nav: 'buchen-raeume', href: '#/buchen/raeume', text: 'Raumbelegung', abschnitt: 'belegung' },
      { nav: 'buchen-ressourcen', href: '#/buchen/ressourcen', text: 'Ressourcenbelegung', abschnitt: 'belegung' },
      ...(b.admin ? [{ nav: 'buchen-verwaltung', href: '#/buchen/verwaltung', text: 'Ressourcen verwalten', abschnitt: 'belegung' },
        { nav: 'buchen-raumdaten', href: '#/buchen/raumdaten', text: 'Raumdaten', abschnitt: 'belegung' }] : []),
    ] });
  } else if (familie(b)) {
    // Schüler*innen und Erziehungsberechtigte: Heute, Überblick, Stundenpläne (eigener Plan, Klassen, Räume), Abwesenheiten,
    // Hausaufgaben, Kommunikation (Lehrerpläne gibt es nicht)
    // Kommunikation nach den Rechten (Mitteilungs-Einstellungen und Rechte-Modell): Posteingang immer; Gesendet und Entwürfe,
    // wenn das Konto schreiben oder antworten darf; Verfassen nur mit Senderecht (an die erlaubten Lehrkräfte/Klassenleitung)
    const mt = b.mitteilungen ?? { senden: false, antworten: false };
    m[1] = { id: 'mitteilungen', text: 'Kommunikation', icon: 'kommunikation', prio: 4, zaehler: true, unter: [
      { nav: 'mitteilungen', href: '#/mitteilungen', text: 'Posteingang', zaehler: true },
      ...(mt.senden || mt.antworten ? [{ nav: 'mitteilungen-gesendet', href: '#/mitteilungen/gesendet', text: 'Gesendet' },
        { nav: 'mitteilungen-entwuerfe', href: '#/mitteilungen/entwuerfe', text: 'Entwürfe' }] : []),
      ...(mt.senden ? [{ nav: 'mitteilungen-verfassen', href: '#/mitteilungen/verfassen', text: 'Verfassen' }] : []),
    ] };
    m.push({ id: 'stundenplan', text: 'Stundenplan', icon: 'stundenplan', prio: 2, unter: plaene });
    m.push({ id: 'abwesenheiten', text: 'Abwesenheiten', icon: 'abwesenheiten', prio: 5, unter: [{ nav: 'abwesenheiten', href: '#/abwesenheiten', text: 'Abwesenheiten' }] });
    m.push({ id: 'hausaufgaben', text: 'Hausaufgaben', icon: 'hausaufgaben', prio: 3, unter: [{ nav: 'hausaufgaben', href: '#/hausaufgaben', text: 'Hausaufgaben' }] });
  } else {
    m.push({ id: 'stundenplan', text: 'Stundenplan', icon: 'stundenplan', prio: 2, unter: plaene });
    m.push({ id: 'vertretungen', text: 'Vertretungen', icon: 'vertretungen', prio: 3, unter: [{ nav: 'vertretungen', href: '#/vertretungen', text: 'Vertretungsplan' }] });
    m.push({ id: 'hausaufgaben', text: 'Hausaufgaben', icon: 'hausaufgaben', prio: 4, unter: [{ nav: 'hausaufgaben', href: '#/hausaufgaben', text: 'Hausaufgaben' }] });
    m.push({ id: 'pruefungen', text: 'Prüfungen', icon: 'pruefungen', prio: 6, unter: [{ nav: 'pruefungen', href: '#/pruefungen', text: 'Prüfungen' }] });
  }
  // Sprechtag (sprechtag.js): Lehrkräfte, Schulleitung, Administration, Erziehungsberechtigte und Schüler*innen (nur lesen – Ankündigung, eigene Termine)
  if (k || b.rolle === 'eltern' || b.rolle === 'schueler') m.find(x => x.id === 'mitteilungen').unter.push({ id: 'sprechtag', nav: 'sprechtag', href: '#/sprechtag', text: 'Sprechtag', abschnitt: 'sprechtag' });
  if (b.admin) {
    m.push({ id: 'admin', text: 'Verwaltung', icon: 'verwaltung', prio: 9, unter: [
      { nav: 'admin-sync', href: '#/admin/sync', text: 'Übersicht' },
      { gruppe: 'stammdaten', text: 'Stammdaten', unter: [
        { nav: 'stammdaten-klassen', href: '#/stammdaten/klassen', text: 'Klassen' },
        { nav: 'stammdaten-schueler', href: '#/stammdaten/schueler', text: 'Schüler*innen' },
        { nav: 'stammdaten-lehrer', href: '#/stammdaten/lehrer', text: 'Lehrkräfte' },
        { nav: 'stammdaten-faecher', href: '#/stammdaten/faecher', text: 'Fächer' },
        { nav: 'stammdaten-raeume', href: '#/stammdaten/raeume', text: 'Räume' },
        { nav: 'stammdaten-versionen', href: '#/stammdaten/versionen', text: 'Stundenplan-Versionen' },
        { nav: 'stammdaten-gruende', href: '#/stammdaten/gruende', text: 'Abwesenheitsgründe' },
        { nav: 'stammdaten-dienste', href: '#/stammdaten/dienste', text: 'Dienste' },
        { nav: 'stammdaten-notenschemen', href: '#/stammdaten/notenschemen', text: 'Notenschemen' },
        { nav: 'stammdaten-pruefungsarten', href: '#/stammdaten/pruefungsarten', text: 'Prüfungsarten' },
      ] },
      { gruppe: 'benutzer', text: 'Benutzer & Rechte', unter: [
        { nav: 'admin-benutzer', href: '#/admin/benutzer', text: 'Benutzer' },
        { nav: 'admin-personen', href: '#/admin/personen', text: 'Personen & Konten' },
        { nav: 'admin-rechte', href: '#/admin/rechte', text: 'Rechte und Rollen' },
        { nav: 'admin-zuordnung', href: '#/admin/zuordnung', text: 'Zuordnungsgruppen' },
        { nav: 'admin-aktive', href: '#/admin/aktive', text: 'Aktive Benutzer' },
      ] },
      { gruppe: 'inhalte', text: 'Inhalte', unter: [
        { nav: 'admin-nachrichten', href: '#/admin/nachrichten', text: 'Nachrichten zum Tag' },
        { nav: 'hinweise', href: '#/hinweise', text: 'Hinweise auf der Anmeldeseite' },
        { nav: 'admin-freietage', href: '#/admin/freietage', text: 'Freie Tage & Ferien' },
        { nav: 'admin-monitore', href: '#/admin/monitore', text: 'Monitore' },
      ] },
      { gruppe: 'daten', text: 'Daten', unter: [
        { nav: 'admin-import', href: '#/admin/import', text: 'Import' },
        { nav: 'admin-export', href: '#/admin/export', text: 'Export' },
        { nav: 'admin-rueckmeldungen', href: '#/admin/rueckmeldungen', text: 'Rückmeldungen' },
        { nav: 'admin-protokoll', href: '#/admin/protokoll', text: 'Protokoll' },
      ] },
      { gruppe: 'einstellungen', text: 'Einstellungen', unter: [
        { nav: 'admin-ansicht', href: '#/admin/ansicht', text: 'Darstellung' },
        { nav: 'admin-sperren', href: '#/admin/sperren', text: 'Prüfungssperren' },
        { nav: 'admin-verspaetung', href: '#/admin/verspaetung', text: 'Verspätungen & Fehlzeiten' },
        { nav: 'admin-zugriff', href: '#/admin/zugriff', text: 'Zugriff sperren' },
        { nav: 'admin-ueber', href: '#/admin/ueber', text: 'Version & Updates' },
      ] },
    ] });
  } else {
    // Rechte-Modell: einzelne Verwaltungsbereiche auch ohne Administration (Nachrichten zum Tag, Import, Benutzerverwaltung)
    const r = b.rechte ?? {};
    const unter = [];
    if (b.nachrichten) unter.push({ nav: 'admin-nachrichten', href: '#/admin/nachrichten', text: 'Nachrichten zum Tag' });
    if (r['infocenter.verwalten']) unter.push({ nav: 'hinweise', href: '#/hinweise', text: 'Hinweise auf der Anmeldeseite' });
    if (r['admin.import']) unter.push({ nav: 'admin-import', href: '#/admin/import', text: 'Import' });
    if (r['admin.wartung']) unter.push({ nav: 'admin-aktive', href: '#/admin/aktive', text: 'Aktive Benutzer' },
      { nav: 'admin-zugriff', href: '#/admin/zugriff', text: 'Zugriff sperren' }, { nav: 'admin-ueber', href: '#/admin/ueber', text: 'Version & Updates' });
    if (r['admin.benutzer']) unter.push({ nav: 'admin-benutzer', href: '#/admin/benutzer', text: 'Benutzer' }, { nav: 'admin-personen', href: '#/admin/personen', text: 'Personen & Konten' });
    if (unter.length) m.push({ id: 'admin', text: 'Verwaltung', icon: 'verwaltung', prio: 9, unter });
  }
  return m;
}

/** Schüler- bzw. Elternkonto mit zugeordneter Person (eigene Seiten „Meine Daten“); Klassenkonten ohne Zuordnung behalten die Klassenansicht. */
function familie(b) { return !!b?.familie && (b.rolle === 'eltern' || (b.schuelerIds ?? []).length > 0); }

/** Reiter eines Bereichs, Auswahllisten (gruppe) aufgelöst. */
const reiterVon = bereich => (bereich?.unter ?? []).flatMap(p => p.gruppe ? p.unter : [p]);
const allePunkte = () => menue().flatMap(reiterVon);
/** Bereich, zu dem ein Navigationsschlüssel gehört. */
function bereichVon(nav) { return sitzung?.benutzer && nav ? menue().find(g => reiterVon(g).some(p => p.nav === nav)) : null; }
/** Ziel eines Bereichs: der erste sichtbare Reiter. */
const bereichZiel = g => reiterVon(g).find(p => !p.verborgen)?.href ?? '#/heute';

/** Schlüssel des aktiven Reiters aus der Adresse. */
function navAus(teile) {
  const b = sitzung.benutzer;
  const [name, a, c] = teile;
  switch (name) {
    // „Mein Plan“ nur über #/plan/mein; unter „Lehrkräfte“/„Klassen“ bleibt der Reiter aktiv, auch beim eigenen Element
    case 'plan': return !a || a === 'mein' ? 'plan-mein' : 'plan-' + a;
    case 'tag': return (teile[3] === 'u' ? 'u-tag-' : 'tag-') + (a || 'klasse');
    case 'unterricht': return a === 'klasse' ? 'unterricht-klasse' : 'unterricht';
    case 'mitteilungen': return ['gesendet', 'entwuerfe', 'listen', 'einstellungen', 'verfassen'].includes(a) ? 'mitteilungen-' + a : 'mitteilungen';
    case 'klassenbuch': return c === 'fehlzeiten' ? 'fehlzeiten' : c && c !== 'uebersicht' ? 'klassenbuch-woche' : 'klassenbuch';
    case 'melden': return 'melden-' + (a || 'uebersicht');
    case 'buchen': return a === 'stunden' ? 'buchen-unterricht' : 'buchen-' + (a || 'raum');
    case 'stammdaten': return 'stammdaten-' + (a || 'klassen');
    case 'kbeinstellungen': return a === 'unterricht' ? 'kbeinstellungen-unterricht' : 'kbeinstellungen';
    case 'admin': return 'admin-' + (a || (b.admin ? 'sync' : 'nachrichten'));
    default: return name || 'heute';
  }
}

/** Schuljahre zur Auswahl: das aktuelle aus UntPlan und die sieben vorherigen (1.8. – 31.7.). */
function schuljahre() {
  const sj = sitzung?.schuljahr;
  if (!sj) return [];
  const start = Number(sj.von.slice(0, 4));
  return Array.from({ length: 8 }, (_, i) => {
    const j = start - i;
    return i === 0 ? { von: sj.von, bis: sj.bis, text: schuljahrText(), aktuell: true } : { von: `${j}-08-01`, bis: `${j + 1}-07-31`, text: `${j}/${j + 1}`, aktuell: false };
  });
}

function gewaehltesSchuljahr() {
  const liste = schuljahre();
  let von = null;
  try { von = sessionStorage.getItem('untplan:schuljahr'); } catch { /* privat */ }
  return liste.find(x => x.von === von) ?? liste[0] ?? { von: '', bis: '', text: '', aktuell: true };
}

function schuljahrText() {
  const sj = sitzung.schuljahr;
  if (!sj) return '';
  const v = sj.von.slice(0, 4), b = sj.bis.slice(0, 4);
  return v === b ? v : `${v}/${b}`;
}

// ------------------------------------------------------------------ Hülle

function huelle() {
  const b = sitzung.benutzer;
  app.innerHTML = `
    <div class="u-app">
      <header class="u-kopf nicht-drucken">
        <div class="u-marke">
          <a class="u-marke-wort" href="#/heute" title="Startseite">${LOGO}</a>
          <div class="u-marke-text"><span class="u-schule" title="${e(sitzung.schule.name || '')}">${e(sitzung.schule.name || '')}</span><span data-jahr></span></div>
          <b class="u-kopftitel" id="kopftitel">UntPlan</b>
        </div>
        <nav class="u-bereiche" aria-label="Hauptbereiche" data-bereiche></nav>
        <div class="u-kopf-rechts">
          <button type="button" class="u-suchknopf" data-suche-oeffnen title="Suchen (Strg+K)" aria-label="Suchen">${icon('suchen')}<span>Suchen</span><kbd>Strg K</kbd></button>
          <span class="u-ic-platz" data-ic-platz></span>
          <div class="u-konto-platz">
            <button type="button" class="u-konto" data-kontomenue title="Konto" aria-haspopup="menu" aria-expanded="false"><span class="u-konto-name">${e(b.anzeigename || b.login)}</span>${icon('unten', 'u-konto-pfeil')}</button>
            <div class="u-kontomenue d-none" role="menu" data-konten></div>
          </div>
        </div>
      </header>
      <nav class="u-reiterleiste nicht-drucken" aria-label="Seiten des Bereichs" data-reiter></nav>
      <main class="u-haupt">
        <div class="u-werkzeug d-none nicht-drucken" id="werkzeug"></div>
        <div class="u-inhalt">
          <div class="u-seitenkopf nicht-drucken-titel d-none" id="seitenkopf"><h1 id="titel"></h1><div class="u-aktionen" id="aktionen"></div></div>
          <div class="u-kopfplatz nicht-drucken" id="kopfplatz" aria-hidden="true"></div>
          <div id="seite"></div>
        </div>
      </main>
      <nav class="u-unten nicht-drucken" aria-label="Hauptbereiche" data-unten></nav>
      <div class="u-blatt-schleier" data-blatt-schleier hidden></div>
      <section class="u-blatt nicht-drucken" data-blatt role="dialog" aria-label="Alle Bereiche" hidden></section>
    </div>`;
  app.querySelector('[data-kontomenue]').onclick = ev => { ev.stopPropagation(); kontomenue(); };
  app.querySelector('[data-suche-oeffnen]').onclick = () => sucheOeffnen();
  app.querySelector('[data-blatt-schleier]').onclick = () => blattZu();
  // Infocenter (Glocke in der Kopfleiste): Infos der Schule und Neuigkeiten, Zahl ungelesener Einträge
  import('./infocenter.js').then(m => m.starten(kontext, app.querySelector('[data-ic-platz]'))).catch(() => { /* ohne Infocenter */ });
  if (!window.__huelleTasten) {
    window.__huelleTasten = true;
    document.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') { kontomenueZu(); blattZu(); bereichMenueZu(); }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k' && document.querySelector('.u-app')) { ev.preventDefault(); sucheOeffnen(); }
    });
    document.addEventListener('click', ev => {
      if (!ev.target.closest('[data-konten]')) kontomenueZu();
      if (!ev.target.closest('[data-bereich-menue], [data-bereich-auf]')) bereichMenueZu();
      if (!ev.target.closest('[data-jahrwahl], [data-jahrliste]')) document.querySelector('[data-jahrliste]')?.classList.add('d-none');
    });
    let warte = 0;
    window.addEventListener('resize', () => { cancelAnimationFrame(warte); warte = requestAnimationFrame(() => { bereicheEinpassen(); reiterEinpassen(); }); });
  }
  kopfZeichnen();
}

/** Kopfleiste (Bereiche, Schuljahr), Reiterleiste und untere Leiste nach dem aktiven Reiter zeichnen. */
function kopfZeichnen() {
  const gruppen = menue();
  const aktiv = bereichVon(aktiverPunkt);
  const nav = document.querySelector('[data-bereiche]');
  if (!nav) return;
  nav.innerHTML = gruppen.map(g => `<a class="u-bereich ${g === aktiv || g.id === aktiv?.id ? 'aktiv' : ''}" href="${bereichZiel(g)}" data-bereich="${g.id}" ${g.id === aktiv?.id ? 'aria-current="page"' : ''}>${e(g.text)}${g.zaehler ? '<span class="u-zahl d-none" data-zaehler></span>' : ''}</a>`).join('')
    + `<div class="u-bereich-mehr" hidden><button type="button" class="u-bereich" data-bereich-auf aria-haspopup="menu" aria-expanded="false">Mehr${icon('unten')}</button>
        <div class="u-menue d-none" role="menu" data-bereich-menue></div></div>`;
  nav.querySelector('[data-bereich-auf]').onclick = ev => {
    ev.stopPropagation();
    const m = nav.querySelector('[data-bereich-menue]');
    const auf = m.classList.toggle('d-none');
    ev.currentTarget.setAttribute('aria-expanded', String(!auf));
  };
  jahrZeichnen();
  reiterZeichnen(aktiv);
  untenZeichnen(gruppen, aktiv);
  bereicheEinpassen();
  zaehlerAktualisieren();
}

/** Schuljahr-Auswahl unter dem Schulnamen. */
function jahrZeichnen() {
  const platz = document.querySelector('[data-jahr]');
  if (!platz) return;
  const jahr = schuljahrText();
  const gw = gewaehltesSchuljahr();
  platz.innerHTML = jahr ? `<span class="u-jahrwahl">
      <button type="button" class="u-jahr ${gw.aktuell ? '' : 'anders'}" data-jahrwahl aria-haspopup="listbox" aria-expanded="false" title="Schuljahr wählen (aktuell: ${e(jahr)})">Schuljahr ${e(gw.text)}${icon('unten')}</button>
      <span class="u-jahrliste u-menue d-none" role="listbox" data-jahrliste>${schuljahre().map(x => `<button type="button" role="option" data-jahr-von="${x.von}" aria-selected="${x.text === gw.text}" class="${x.text === gw.text ? 'an' : ''}">${e(x.text)}${x.aktuell ? '<small>aktuell</small>' : ''}</button>`).join('')}</span></span>` : '';
  const jw = platz.querySelector('[data-jahrwahl]');
  if (!jw) return;
  const liste = platz.querySelector('[data-jahrliste]');
  jw.onclick = ev => { ev.stopPropagation(); liste.classList.toggle('d-none'); jw.setAttribute('aria-expanded', String(!liste.classList.contains('d-none'))); };
  liste.querySelectorAll('[data-jahr-von]').forEach(b => b.onclick = () => {
    try { sessionStorage.setItem('untplan:schuljahr', b.dataset.jahrVon); } catch { /* privat */ }
    liste.classList.add('d-none');
    jahrZeichnen();
    toast(`Schuljahr ${b.firstChild.textContent} gewählt.`);
    route();
  });
}

/**
 * Hauptbereiche, die nicht in die Kopfleiste passen, wandern in „Mehr“ (von hinten nach vorn; der aktive Bereich bleibt sichtbar).
 * Auf dem Telefon ist die Leiste ausgeblendet (untere Leiste).
 */
function bereicheEinpassen() {
  const nav = document.querySelector('[data-bereiche]');
  if (!nav || !nav.offsetParent) return;
  const punkte = [...nav.querySelectorAll(':scope > a.u-bereich')];
  const mehr = nav.querySelector('.u-bereich-mehr');
  const menue = nav.querySelector('[data-bereich-menue]');
  punkte.forEach(p => { p.hidden = false; });
  mehr.hidden = true;
  if (nav.scrollWidth <= nav.clientWidth + 1) return;
  mehr.hidden = false;
  const weg = [];
  for (const p of [...punkte].reverse()) {
    if (nav.scrollWidth <= nav.clientWidth + 1) break;
    if (p.classList.contains('aktiv')) continue;
    p.hidden = true;
    weg.unshift(p);
  }
  menue.innerHTML = weg.map(p => `<a href="${p.getAttribute('href')}" role="menuitem">${e(p.firstChild.textContent)}</a>`).join('');
}

/** Reiterleiste des aktiven Bereichs (ohne Leiste bei nur einem Reiter). Gruppen (Verwaltung) als Reiter mit Auswahlliste. */
function reiterZeichnen(bereich) {
  const leiste = document.querySelector('[data-reiter]');
  if (!leiste) return;
  const sichtbar = (bereich?.unter ?? []).filter(p => !p.verborgen);
  const einzeln = sichtbar.length <= 1 && !sichtbar[0]?.gruppe;
  document.querySelector('.u-app')?.classList.toggle('ohne-reiter', !bereich || einzeln);
  if (!bereich || einzeln) { leiste.innerHTML = ''; return; }
  let abschnitt = sichtbar[0]?.abschnitt ?? '';
  leiste.innerHTML = `<div class="u-reiter-innen" data-reiter-innen>${sichtbar.map(p => {
    const trenner = (p.abschnitt ?? '') !== abschnitt ? '<span class="u-reiter-trenner" aria-hidden="true"></span>' : '';
    abschnitt = p.abschnitt ?? '';
    if (p.gruppe) {
      const an = p.unter.find(x => x.nav === aktiverPunkt);
      return `${trenner}<div class="u-reiter-gruppe"><button type="button" class="u-reiter ${an ? 'aktiv' : ''}" data-reiter-gruppe="${p.gruppe}" aria-haspopup="menu" aria-expanded="false">${e(p.text)}${an ? `<span class="u-reiter-wahl">${e(an.text)}</span>` : ''}${icon('unten')}</button>
        <div class="u-menue d-none" role="menu" data-reiter-menue="${p.gruppe}">${p.unter.map(x => `<a href="${x.href}" role="menuitem" class="${x.nav === aktiverPunkt ? 'an' : ''}" data-nav="${x.nav}">${e(x.text)}</a>`).join('')}</div></div>`;
    }
    return `${trenner}<a class="u-reiter ${p.nav === aktiverPunkt ? 'aktiv' : ''}" href="${p.href}" data-nav="${p.nav}" ${p.nav === aktiverPunkt ? 'aria-current="page"' : ''}>${e(p.text)}${p.zaehler ? '<span class="u-zahl d-none" data-zaehler></span>' : ''}</a>`;
  }).join('')}</div><div class="u-reiter-mehr" hidden><button type="button" class="u-reiter" data-reiter-mehr aria-haspopup="menu" aria-expanded="false">Weitere${icon('unten')}</button><div class="u-menue u-menue-rechts d-none" role="menu" data-reiter-mehr-menue></div></div>`;
  leiste.querySelectorAll('[data-reiter-gruppe]').forEach(k => k.onclick = ev => {
    ev.stopPropagation();
    const m = leiste.querySelector(`[data-reiter-menue="${k.dataset.reiterGruppe}"]`);
    const zu = m.classList.contains('d-none');
    reiterMenueZu();
    if (zu) { m.classList.remove('d-none'); k.setAttribute('aria-expanded', 'true'); menueLage(m, k); }
  });
  leiste.querySelector('[data-reiter-mehr]').onclick = ev => {
    ev.stopPropagation();
    const m = leiste.querySelector('[data-reiter-mehr-menue]');
    const zu = m.classList.contains('d-none');
    reiterMenueZu();
    if (zu) { m.classList.remove('d-none'); ev.currentTarget.setAttribute('aria-expanded', 'true'); }
  };
  if (!window.__reiterKlick) { window.__reiterKlick = true; document.addEventListener('click', reiterMenueZu); }
  reiterEinpassen();
  // aktiven Reiter auf schmalen Bildschirmen in den sichtbaren Bereich holen
  requestAnimationFrame(() => leiste.querySelector('.u-reiter.aktiv')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
}
function reiterMenueZu() {
  document.querySelectorAll('[data-reiter-menue], [data-reiter-mehr-menue]').forEach(m => m.classList.add('d-none'));
  document.querySelectorAll('[data-reiter-gruppe], [data-reiter-mehr]').forEach(k => k.setAttribute('aria-expanded', 'false'));
}
/** Auswahlliste eines Reiters innerhalb des Fensters halten. */
function menueLage(m, k) {
  m.style.left = '';
  const r = k.getBoundingClientRect();
  const ueber = r.left + m.offsetWidth - (window.innerWidth - 8);
  if (ueber > 0) m.style.left = `${-ueber}px`;
}

/** Desktop: Reiter, die nicht in die Leiste passen, unter „Weitere“. Telefon: die Leiste scrollt waagrecht. */
function reiterEinpassen() {
  const leiste = document.querySelector('[data-reiter]');
  const innen = leiste?.querySelector('[data-reiter-innen]');
  if (!innen) return;
  const mehr = leiste.querySelector('.u-reiter-mehr');
  const menue = leiste.querySelector('[data-reiter-mehr-menue]');
  const reiter = [...innen.querySelectorAll(':scope > a.u-reiter, :scope > .u-reiter-gruppe, :scope > .u-reiter-trenner')];
  reiter.forEach(r => { r.hidden = false; });
  mehr.hidden = true;
  if (window.innerWidth < 768 || innen.scrollWidth <= innen.clientWidth + 1) return;
  mehr.hidden = false;
  const weg = [];
  for (const r of [...reiter].reverse()) {
    if (innen.scrollWidth <= innen.clientWidth + 1) break;
    if (r.classList.contains('aktiv') || r.querySelector?.('.aktiv')) continue;
    r.hidden = true;
    if (!r.classList.contains('u-reiter-trenner')) weg.unshift(r);
  }
  menue.innerHTML = weg.map(r => r.matches('a') ? `<a href="${r.getAttribute('href')}" role="menuitem">${e(r.firstChild.textContent)}</a>`
    : [...r.querySelectorAll('[data-nav]')].map(a => `<a href="${a.getAttribute('href')}" role="menuitem">${e(a.textContent)}</a>`).join('')).join('');
}

/** Untere Leiste (Telefon): die vier Bereiche mit der höchsten Priorität und „Mehr“. */
function untenZeichnen(gruppen, aktiv) {
  const leiste = document.querySelector('[data-unten]');
  if (!leiste) return;
  const vier = [...gruppen].sort((a, b) => (a.prio ?? 9) - (b.prio ?? 9)).slice(0, 4).sort((a, b) => gruppen.indexOf(a) - gruppen.indexOf(b));
  const mehrAktiv = aktiv && !vier.includes(vier.find(g => g.id === aktiv.id));
  const kurz = { 'Melden & Buchen': 'Melden', Kommunikation: 'Post', Stundenplan: 'Plan', Vertretungen: 'Vertretung' };
  leiste.innerHTML = vier.map(g => `<a class="u-unten-punkt ${g.id === aktiv?.id ? 'aktiv' : ''}" href="${bereichZiel(g)}" ${g.id === aktiv?.id ? 'aria-current="page"' : ''}>
      <span>${e(kurz[g.text] ?? g.text)}</span>${g.zaehler ? '<span class="u-zahl d-none" data-zaehler></span>' : ''}</a>`).join('')
    + `<button type="button" class="u-unten-punkt ${mehrAktiv ? 'aktiv' : ''}" data-blatt-auf aria-haspopup="dialog"><span>Mehr</span></button>`;
  leiste.querySelector('[data-blatt-auf]').onclick = () => blattAuf();
}

/** Blatt „Mehr“ (Telefon): alle Bereiche mit ihren Seiten, Schuljahr, Profil und Abmelden. */
function blattAuf() {
  const blatt = document.querySelector('[data-blatt]');
  if (!blatt) return;
  const b = sitzung.benutzer;
  const gw = gewaehltesSchuljahr();
  blatt.innerHTML = `<div class="u-blatt-griff" aria-hidden="true"></div>
    <header class="u-blatt-kopf"><div><b>${e(b.anzeigename || b.login)}</b><small>${e(b.rollenname)}${gw.text ? ` · Schuljahr ${e(gw.text)}` : ''}</small></div>
      <button type="button" class="u-kopfknopf" data-blatt-zu aria-label="Schließen">${icon('x')}</button></header>
    <div class="u-blatt-inhalt">${menue().map(g => `<section class="u-blatt-gruppe"><h2>${e(g.text)}</h2>
      <div class="u-blatt-liste">${reiterVon(g).filter(p => !p.verborgen).map(p => `<a href="${p.href}" class="${p.nav === aktiverPunkt ? 'aktiv' : ''}">${e(p.text)}</a>`).join('')}</div></section>`).join('')}
      <section class="u-blatt-gruppe"><h2>Konto</h2><div class="u-blatt-liste"><a href="#/profil">Mein Profil</a><a href="#/neuigkeiten">Neuigkeiten</a>
        <button type="button" data-blatt-abmelden>Abmelden</button></div></section></div>`;
  blatt.hidden = false;
  document.querySelector('[data-blatt-schleier]').hidden = false;
  document.body.classList.add('blatt-offen');
  blatt.querySelector('[data-blatt-zu]').onclick = blattZu;
  blatt.querySelector('[data-blatt-abmelden]').onclick = abmelden;
  blatt.querySelectorAll('a').forEach(a => a.addEventListener('click', blattZu));
  blatt.querySelector('[data-blatt-zu]').focus();
}
function blattZu() {
  const blatt = document.querySelector('[data-blatt]');
  if (!blatt || blatt.hidden) return;
  blatt.hidden = true;
  document.querySelector('[data-blatt-schleier]').hidden = true;
  document.body.classList.remove('blatt-offen');
}
function bereichMenueZu() {
  const m = document.querySelector('[data-bereich-menue]');
  if (!m || m.classList.contains('d-none')) return;
  m.classList.add('d-none');
  document.querySelector('[data-bereich-auf]')?.setAttribute('aria-expanded', 'false');
}

// ------------------------------------------------------------------ Suche (Klassen, Lehrkräfte, Räume und Seiten)

/**
 * Schnellsuche über der Seite (Strg+K bzw. Lupe in der Kopfleiste): Treffer unter den Seiten des Kontos und den Stundenplänen der
 * Klassen, Lehrkräfte (nur Kollegium) und Räume. Pfeiltasten wählen, Enter öffnet, Esc schließt.
 */
async function sucheOeffnen() {
  if (document.querySelector('.u-suche-ebene')) return;
  const el = document.createElement('div');
  el.className = 'u-suche-ebene';
  el.innerHTML = `<div class="u-suche-box" role="dialog" aria-label="Suchen">
      <label class="u-suche-feld">${icon('suchen')}<input type="search" placeholder="Klasse, Lehrkraft, Raum oder Seite" aria-label="Suchen" autocomplete="off" data-suche-eingabe><kbd>Esc</kbd></label>
      <div class="u-suche-liste" role="listbox" data-suche-liste></div></div>`;
  document.body.append(el);
  const eingabe = el.querySelector('input');
  const liste = el.querySelector('[data-suche-liste]');
  const zu = () => { el.remove(); document.removeEventListener('keydown', taste, true); };
  el.addEventListener('mousedown', ev => { if (ev.target === el) zu(); });
  let treffer = [], wahl = 0;
  let elemente = null;
  try { elemente = await kontext.elemente(); } catch { /* nur Seiten */ }
  const ich = sitzung.benutzer;
  const seiten = allePunkte().filter(p => !p.verborgen).map(p => ({ art: 'Seite', text: p.text, zusatz: bereichVon(p.nav)?.text ?? '', href: p.href }));
  const plaene = elemente ? [
    ...(elemente.klassen ?? []).map(x => ({ art: 'Klasse', text: x.kurz, zusatz: x.name !== x.kurz ? x.name : '', href: `#/plan/klasse/${encodeURIComponent(x.kurz)}` })),
    ...(ich.kollegium ? (elemente.lehrer ?? []).map(x => ({ art: 'Lehrkraft', text: x.kurz, zusatz: x.name !== x.kurz ? x.name : '', href: `#/plan/lehrer/${encodeURIComponent(x.kurz)}` })) : []),
    ...(elemente.raeume ?? []).map(x => ({ art: 'Raum', text: x.kurz, zusatz: x.name !== x.kurz ? x.name : '', href: `#/plan/raum/${encodeURIComponent(x.kurz)}` })),
  ] : [];
  const zeichnen = () => {
    const f = eingabe.value.trim().toLowerCase();
    const passt = x => !f || `${x.text} ${x.zusatz}`.toLowerCase().includes(f);
    // genaue Kürzel zuerst, dann Anfang, dann enthalten
    const rang = x => !f ? 0 : x.text.toLowerCase() === f ? 0 : x.text.toLowerCase().startsWith(f) ? 1 : 2;
    treffer = [...plaene.filter(passt).sort((a, b) => rang(a) - rang(b)).slice(0, f ? 30 : 0), ...seiten.filter(passt).slice(0, f ? 12 : 10)];
    wahl = Math.min(wahl, Math.max(0, treffer.length - 1));
    liste.innerHTML = treffer.length ? treffer.map((x, i) => `<a href="${x.href}" role="option" class="u-suche-treffer ${i === wahl ? 'an' : ''}" aria-selected="${i === wahl}" data-i="${i}">
        <span class="u-suche-art">${e(x.art)}</span><b>${e(x.text)}</b><span class="u-suche-zusatz">${e(x.zusatz)}</span></a>`).join('')
      : `<div class="u-suche-leer">Keine Treffer für „${e(eingabe.value)}“.</div>`;
    if (!f) liste.insertAdjacentHTML('afterbegin', '<div class="u-suche-kopf">Seiten</div>');
  };
  const taste = ev => {
    if (ev.key === 'Escape') { ev.stopPropagation(); zu(); }
    else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      wahl = Math.max(0, Math.min(treffer.length - 1, wahl + (ev.key === 'ArrowDown' ? 1 : -1)));
      zeichnen();
      liste.querySelector('.an')?.scrollIntoView({ block: 'nearest' });
    } else if (ev.key === 'Enter' && treffer[wahl]) { ev.preventDefault(); zu(); location.hash = treffer[wahl].href; }
  };
  document.addEventListener('keydown', taste, true);
  eingabe.addEventListener('input', () => { wahl = 0; zeichnen(); });
  liste.addEventListener('click', ev => { if (ev.target.closest('a')) zu(); });
  zeichnen();
  eingabe.focus();
}

// ------------------------------------------------------------------ Konto: Profil, Konto wechseln, weiteres Konto

function kontomenueZu() {
  const m = document.querySelector('[data-konten]');
  if (!m || m.classList.contains('d-none')) return;
  m.classList.add('d-none');
  document.querySelector('[data-kontomenue]')?.setAttribute('aria-expanded', 'false');
}

async function kontomenue() {
  const m = document.querySelector('[data-konten]');
  if (!m.classList.contains('d-none')) return kontomenueZu();
  m.classList.remove('d-none');
  document.querySelector('[data-kontomenue]').setAttribute('aria-expanded', 'true');
  const b = sitzung.benutzer;
  m.innerHTML = `<div class="u-konto-kopf"><b>${e(b.anzeigename || b.login)}</b><small>${e(b.login)} · ${e(b.rollenname)}</small></div>
    <a href="#/profil" role="menuitem" data-profil><span>Mein Profil</span></a>
    <a href="#/neuigkeiten" role="menuitem" data-neuigkeiten><span>Neuigkeiten</span></a>
    <div class="u-kontoliste">${lade()}</div>
    <button type="button" role="menuitem" class="u-konto-ab" data-abmelden><span>Abmelden</span></button>`;
  m.querySelectorAll('[data-profil], [data-neuigkeiten]').forEach(a => a.onclick = () => kontomenueZu());
  m.querySelector('[data-abmelden]').onclick = abmelden;
  import('./infocenter.js').then(x => x.zahlSetzen?.()).catch(() => { /* ohne Zahl */ });
  let konten = [];
  try { konten = await holen('/api/app/konten'); } catch { /* still */ }
  const andere = konten.filter(k => !k.aktuell);
  m.querySelector('.u-kontoliste').innerHTML = `${andere.length ? '<div class="u-kontokopf">Konto wechseln</div>' : ''}
    ${andere.map(k => `<div class="u-konto-zeile"><button type="button" role="menuitem" data-wechseln="${k.id}">
      <span><b>${e(k.login)}</b><small>${e(k.rolle)}</small></span></button><button type="button" class="u-konto-weg" data-vergessen="${k.id}" title="Vom Gerät entfernen" aria-label="Konto vom Gerät entfernen">${icon('x')}</button></div>`).join('')}
    <button type="button" role="menuitem" class="u-konto-neu" data-weiteres><span>Weiteres Konto anmelden</span></button>`;
  m.querySelectorAll('[data-wechseln]').forEach(x => x.onclick = async () => {
    try { await senden(`/api/app/konten/${x.dataset.wechseln}/wechseln`, {}); history.replaceState(null, '', '#/heute'); await start(); toast('Konto gewechselt.'); }
    catch (err) { fehler(err); }
  });
  m.querySelectorAll('[data-vergessen]').forEach(x => x.onclick = async ev => {
    ev.stopPropagation();
    try { await api(`/api/app/konten/${x.dataset.vergessen}`, { methode: 'DELETE' }); x.closest('.u-konto-zeile').remove(); } catch (err) { fehler(err); }
  });
  m.querySelector('[data-weiteres]').onclick = abmelden;
}

function zaehlerAktualisieren() {
  if (!sitzung) return;
  document.querySelectorAll('[data-zaehler]').forEach(z => {
    z.textContent = sitzung.ungelesen > 99 ? '99+' : sitzung.ungelesen;
    z.classList.toggle('d-none', !sitzung.ungelesen);
  });
}

// Ungelesene Mitteilungen regelmäßig nachladen
setInterval(async () => {
  if (!sitzung?.benutzer || (document.hidden && !sitzung.benutzer.benachrichtigung)) return;
  try {
    const s = await holen('/api/app/sitzung');
    const neu = (s.ungelesen ?? 0) - (sitzung.ungelesen ?? 0);
    sitzung.ungelesen = s.ungelesen;
    zaehlerAktualisieren();
    if (neu > 0) neueMitteilungMelden(neu);
  } catch { /* still */ }
}, 120000);

/** Benachrichtigung über neue Mitteilungen: Hinweis in der App, mit Einwilligung (Profil „Benachrichtigung“) auch als Systemmeldung des Browsers. */
function neueMitteilungMelden(anzahl) {
  const text = anzahl === 1 ? 'Sie haben eine neue Mitteilung empfangen.' : `Sie haben ${anzahl} neue Mitteilungen empfangen.`;
  if (!location.hash.startsWith('#/mitteilungen')) toast(text);
  try {
    if (sitzung.benutzer?.benachrichtigung && 'Notification' in window && Notification.permission === 'granted') {
      const n = new Notification('Neue Mitteilung', { body: text, tag: 'untplan-mitteilung' });
      n.onclick = () => { window.focus(); location.hash = '#/mitteilungen'; n.close(); };
    }
  } catch { /* nicht unterstützt */ }
}

// ------------------------------------------------------------------ Router

async function route() {
  if (!sitzung?.benutzer || sitzung.benutzer.passwortAendern) return;
  // offene Dialoge schließen (z. B. Zurück-Taste im Browser)
  document.querySelectorAll('.modal.show').forEach(m => bootstrap.Modal.getInstance(m)?.hide());
  kontomenueZu();
  blattZu();
  document.querySelector('.u-suche-ebene')?.remove();
  const teile = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  let name = teile[0] || (kontext.ansicht.startseite === 'stundenplan' && sitzung.benutzer.element ? 'plan' : 'heute');
  let nav = navAus([name, ...teile.slice(1)]);
  // Klassenkonten: frühere Adresse #/klassenbuch zeigt die Hausaufgaben
  if (name === 'klassenbuch' && !sitzung.benutzer.kollegium) { name = 'hausaufgaben'; nav = 'hausaufgaben'; }
  // Sprechtag für Schüler*innen ohne Menüpunkt (Option „sichtbar für Schüler*innen“; Zugang über die Karten auf Heute/Übersicht, der Server prüft)
  const erlaubt = name === 'profil' || name === 'neuigkeiten' || (name === 'sprechtag' && sitzung.benutzer.rolle === 'schueler') || allePunkte().some(p => p.nav === nav);
  if (!ANSICHTEN[name] || !erlaubt) { name = 'heute'; nav = 'heute'; }
  aktiverPunkt = nav;
  kopfZeichnen();
  const seite = document.getElementById('seite');
  if (!seite) return;
  const nummer = laufendeAnsicht = Symbol(name);
  seite.innerHTML = lade();
  kontext.titel('');
  kontext.werkzeug('');
  document.querySelector('.u-app')?.setAttribute('data-ansicht', name);
  const kopf = weisserKopf(nav);
  planScrollBeobachten();
  window.scrollTo(0, 0);
  try {
    const modul = await ANSICHTEN[name]();
    if (laufendeAnsicht !== nummer) return;
    seite.innerHTML = '';
    seite.dataset.ansicht = name;
    await modul.zeigen(seite, kontext, teile.slice(1));
    if (laufendeAnsicht === nummer) kopfMerken(kopf);
  } catch (err) {
    if (laufendeAnsicht !== nummer || err.status === 401) return;
    seite.innerHTML = alarm('danger', err.message);
    if (err.status === undefined) console.error(err);
  }
}

/**
 * Klassenbuch-Verwaltungsseiten (Kollegium): Kopfbereich über die volle Breite (weiße Fläche unter der Reiterleiste) mit Titel,
 * Aktionen und der Suchleiste (Element mit Klasse u-kopfteil, meist .u-sf-leiste mit suchfeldMitFilter), der Inhalt darunter auf dem
 * Seitengrund. Damit nichts springt, steht der Kopf sofort beim Seitenwechsel: Titel aus dem Menü, die Zeile der Suchleiste als
 * gleich hoher Platzhalter (#kopfplatz, per CSS sichtbar, solange die Seite noch keinen u-kopfteil gezeichnet hat).
 * Die Höhe der Suchleiste je Seite wird gemerkt (schmale Bildschirme: umbrechende Leisten).
 * suche: Seite mit Suchleiste im Kopf; titel: Titel bis die Seite ihn setzt (sonst der Menütext).
 */
// h: übliche Höhe der Suchleiste (breit ≥ 1300px, mittel, schmal < 768px) für den ersten Aufruf; danach gilt die gemessene Höhe
const WEISSER_KOPF = {
  offen: { suche: true, h: [52, 52, 96] }, hausaufgaben: { suche: true, h: [52, 52, 128] }, pruefungen: { suche: true, h: [52, 52, 96] },
  abwesenheiten: { suche: true, h: [52, 100, 160] }, fehlzeiten: { suche: true, h: [100, 100, 290] }, eintraege: { suche: true, h: [52, 52, 130] },
  dienste: { suche: true, h: [52, 52, 176] }, befreiungen: { suche: true, titel: 'Befreiungen vom Unterricht', h: [52, 52, 130] },
  berichte: { suche: true, h: [72, 124, 186] }, entschuldigen: { suche: true, titel: 'Fehlzeiten', h: [52, 100, 160] },
  kbeinstellungen: { suche: false, titel: 'Klassenbuch-Einstellungen' }, 'kbeinstellungen-unterricht': { suche: false, titel: 'Unterricht-Einstellungen' },
};
const kopfStufe = () => innerWidth >= 1300 ? 0 : innerWidth >= 768 ? 1 : 2;
const kopfSchluessel = nav => `untplan:kopfhoehe:${nav}:${kopfStufe()}`;

function weisserKopf(nav) {
  const u = document.querySelector('.u-app');
  const art = sitzung.benutzer.kollegium ? WEISSER_KOPF[nav] : null;
  u?.classList.toggle('u-kopf-weiss', !!art);
  u?.classList.toggle('u-kopf-suche', !!art?.suche);
  if (!art) return null;
  kontext.titel(art.titel ?? allePunkte().find(p => p.nav === nav)?.text ?? '');
  let h = art.h?.[kopfStufe()];
  try { h = Number(sessionStorage.getItem(kopfSchluessel(nav))) || h; } catch { /* privat */ }
  if (h) u?.style.setProperty('--kopfplatz-h', `${h}px`); else u?.style.removeProperty('--kopfplatz-h');
  return nav;
}

/** Höhe der gezeichneten Suchleiste merken (Platzhalter beim nächsten Aufruf der Seite gleich hoch). */
function kopfMerken(nav) {
  const teil = nav && document.querySelector('#seite .u-kopfteil:not(.u-kopfreiter):not(.u-kopfskelett)');
  if (!teil || teil.offsetHeight <= 0) return;
  try { sessionStorage.setItem(kopfSchluessel(nav), String(Math.round(teil.getBoundingClientRect().height))); } catch { /* privat */ }
}

/** Ist diese Ansicht noch die aktuelle? (gegen verspätete Antworten) */
kontext.aktuell = () => { const s = laufendeAnsicht; return () => s === laufendeAnsicht; };

// Einheitliche Auswahl: alle nativen Selects und Suchfelder werden automatisch ersetzt bzw. vereinheitlicht
auswahlBeobachten(document.body);
// Einheitlicher Kalender: alle Datumsfelder (<input type="date">, "datetime-local") erhalten den eigenen Datumswähler
kalenderBeobachten(document.body);
start();


/**
 * Linie unter festen Leisten (Werkzeugleiste, Plankopf) nur, wenn nach unten gescrollt ist – bei Scroll-Position 0 keine.
 * Seiten-Scroll (Fenster) setzt body.gescrollt (bzw. plan-gescrollt); eigene Scroll-Container (Dialoge, [data-kopf-schatten])
 * erhalten selbst die Klasse „gescrollt“. Andere innere Scrollbereiche (Tabellen) ändern nichts am Seitenschatten.
 */
function planScrollBeobachten() {
  if (window.__planScroll) return;
  window.__planScroll = true;
  const seite = () => {
    const unten = (window.scrollY || document.documentElement.scrollTop || 0) > 2;
    document.body.classList.toggle('gescrollt', unten);
    document.body.classList.toggle('plan-gescrollt', unten);
  };
  window.addEventListener('scroll', seite, { passive: true });
  document.addEventListener('scroll', ev => {
    const t = ev.target;
    if (t instanceof Element && t.matches('.modal, [data-kopf-schatten]')) t.classList.toggle('gescrollt', t.scrollTop > 2);
  }, { capture: true, passive: true });
  // Seitenwechsel: scrollTo(0, 0) löst nicht immer ein scroll-Ereignis aus
  window.addEventListener('hashchange', () => requestAnimationFrame(seite));
  seite();
}
