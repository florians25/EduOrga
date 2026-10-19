/* =====================================================================
   schule.js — EduOrga Mobile: Schulfunktionen unter „Schule“ (Lehrkräfte)
   bzw. „Mehr“ (Schüler*innen, Eltern)
   ---------------------------------------------------------------------
   Dieselben Funktionen wie die iOS-App, je nach Rolle und Rechten:
   Klassenbuch (offene Stunden, Einträge, Hausaufgaben, Befreiungen),
   Prüfungen, Vertretungsplan, Hausaufgaben, Abwesenheit melden und Meine
   Meldungen, Raum oder Gerät buchen und Meine Buchungen, Elternsprechtag,
   Entschuldigungen, Neuigkeiten, Profil und Benachrichtigungen, Über.
   Die Daten kommen über api/web/… (UntPlan Mobile reicht an EduOrga Web
   /api/app/… weiter); Rechte prüft EduOrga Web. Unterseiten liegen als
   Stapel in #screenSchule: Zurück führt eine Ebene hoch, zuletzt zu
   „Mehr“ bzw. „Schule“.
   ===================================================================== */
(() => {
'use strict';
const E = window.EDO;
if (!E) return;
const { state, esc, sym, toast, buzz } = E;
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/* ---------------------------------------------------------------------
   Grundlagen: Aufrufe, Datum, Rolle
   --------------------------------------------------------------------- */
const API = new URL('api/web/', location.href).href;

async function web(pfad, methode = 'GET', body){
  const r = await fetch(API + pfad, {
    method: methode, credentials:'same-origin', cache:'no-store',
    headers: body !== undefined ? { 'Content-Type':'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (r.status === 401){ location.reload(); throw new Error('Bitte erneut anmelden.'); }
  const d = await r.json().catch(() => null);
  if (!r.ok || (d && d.ok === false)) throw new Error((d && (d.error || d.fehler)) || ('HTTP ' + r.status));
  return d;
}
const pdfLink = pfad => API + pfad;

const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const parse = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const plus = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const heute = () => iso(new Date());
const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MON = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];
const datumKurz = s => { if (!s) return ''; const d = parse(s); return `${WT[d.getDay()]}, ${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.`; };
const datumLang = s => { if (!s) return ''; const d = parse(s); return `${WT[d.getDay()]}, ${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`; };
const zeitraum = (v, b) => v === b || !b ? datumLang(v) : `${datumLang(v)} – ${datumLang(b)}`;
const stunden = (v, b) => !v ? '' : (!b || b === v ? `${v}. Std.` : `${v}.–${b}. Std.`);
const kw = s => {
  const d = parse(s); const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const t = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - t + 3);
  const f = new Date(Date.UTC(x.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((x - f) / 864e5 - 3 + ((f.getUTCDay() + 6) % 7)) / 7);
};
const montag = s => { const d = parse(s); return iso(plus(d, -((d.getDay() + 6) % 7))); };
/* Schuljahr: ab 1. August */
const schuljahrBeginn = () => { const d = new Date(); return `${d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1}-08-01`; };
const schuljahrEnde = () => { const d = new Date(); return `${d.getMonth() >= 7 ? d.getFullYear() + 1 : d.getFullYear()}-07-31`; };

function rolle(){
  const u = state.user || {};
  const r = u.rolle || '';
  const eltern = r === 'eltern';
  const schueler = r === 'schueler' || (!r && state.isStudent);
  const kollegium = u.kollegium !== undefined ? !!u.kollegium : !schueler && !eltern;
  const rechte = u.rechte || null;
  /* Ohne Rechteliste (ältere Server) gilt die Rolle. */
  const darf = (recht, stufe = 1) => rechte ? (rechte[recht] || 0) >= stufe : kollegium;
  return { r, eltern, schueler, familie: eltern || schueler || !!u.familie, kollegium, darf,
           admin: !!u.admin, fehlzeiten: !!u.fehlzeiten, fachlehrer: !!u.fachlehrerEntschuldigungen,
           kinder: u.schuelerIds || [] };
}

/* Stundenzeiten aus dem Plan: { 1:{start,end}, … } */
const stundenNummern = () => Object.keys(state.times || {}).map(Number).sort((a, b) => a - b);
const stundenOptionen = (wert, leer) => (leer ? `<option value="">${esc(leer)}</option>` : '')
  + stundenNummern().map(n => `<option value="${n}"${+wert === n ? ' selected' : ''}>${n}. Stunde (${esc((state.times[n] || {}).start || '')})</option>`).join('');

/* Eigene Klassen der Lehrkraft (aus dem Unterricht), einmal geladen */
let eigeneKlassenCache = null;
async function eigeneKlassen(){
  if (eigeneKlassenCache) return eigeneKlassenCache;
  const code = state.ownCode || '';
  let liste = [];
  try {
    const u = await web('unterricht' + (code ? '?lehrer=' + encodeURIComponent(code) : ''));
    liste = [...new Set((u || []).flatMap(x => x.klassen || []))];
  } catch (e){ /* ohne Unterricht: alle Klassen */ }
  if (!liste.length) liste = (state.entities || []).filter(e => e.type === 'class').map(e => e.label || e.id);
  eigeneKlassenCache = liste.sort((a, b) => String(a).localeCompare(String(b), 'de', { numeric:true }));
  return eigeneKlassenCache;
}
const alleKlassen = () => (state.entities || []).filter(e => e.type === 'class').map(e => String(e.label || e.id));

/* ---------------------------------------------------------------------
   Bausteine
   --------------------------------------------------------------------- */
const gruppe = (titel, inhalt, zusatz = '') => inhalt
  ? `${titel ? `<h2 class="gruppe__titel">${esc(titel)}${zusatz}</h2>` : ''}<div class="rows">${inhalt}</div>` : '';
const navZeile = (id, titel, unter = '', hinweis = '') => `
  <button class="row row--nav" type="button" data-seite="${esc(id)}">
    <span class="row__main"><b>${esc(titel)}</b>${unter ? `<i>${esc(unter)}</i>` : ''}</span>
    ${hinweis ? `<span class="row__hint">${hinweis}</span>` : '<span></span>'}
    ${sym('chevron-right', 'ico--chev2')}
  </button>`;
const leer = (titel, text) => `<div class="lst__empty sf-leer"><span class="lst__emptyIco">${sym('inbox')}</span><b>${esc(titel)}</b><span>${esc(text)}</span></div>`;
const laden = () => '<div class="sf-laden" aria-label="Wird geladen"><span></span></div>';
const fehlerBox = e => `<div class="lst__empty sf-leer"><b>Nicht verfügbar</b><span>${esc(e && e.message || e)}</span></div>`;
const datumBlock = s => { const d = parse(s); return `<span class="sf-datum"><b>${d.getDate()}</b><i>${MON[d.getMonth()]}</i></span>`; };
const plakette = (text, art = '') => `<span class="plakette${art ? ' plakette--' + art : ''}">${esc(text)}</span>`;
const feld = (label, html, hinweis = '') => `<label class="sf-feld"><span>${esc(label)}</span>${html}${hinweis ? `<small>${esc(hinweis)}</small>` : ''}</label>`;
const auswahl = (name, optionen, wert) => `<select name="${name}">${optionen.map(o => {
  const [v, t] = Array.isArray(o) ? o : [o, o];
  return `<option value="${esc(v)}"${String(v) === String(wert ?? '') ? ' selected' : ''}>${esc(t)}</option>`;
}).join('')}</select>`;
const formWerte = f => Object.fromEntries(new FormData(f).entries());

async function bestaetigen(titel, text, knopf, rot = false, eingabe = null){
  const a = await E.sptBlatt({ titel, text, eingabe, knoepfe:[{ label:knopf, wert:1, rot, fett:!rot }] });
  return a;
}

/* ---------------------------------------------------------------------
   Seitenstapel
   --------------------------------------------------------------------- */
const stapel = [];
function oeffnen(seite, daten){
  if (!SEITEN[seite]) return;
  if (SEITEN[seite].direkt){ SEITEN[seite].direkt(daten || {}); return; }
  if (state.screen !== 'schule') stapel.length = 0;
  stapel.push({ seite, daten: daten || {} });
  zeigen();
}
function zurueck(){
  stapel.pop();
  if (!stapel.length){ E.showScreen('profile'); return; }
  zeigen();
}
function neuZeichnen(){ if (stapel.length) zeigen(true); }
async function zeigen(still){
  const top = stapel[stapel.length - 1];
  const def = SEITEN[top.seite];
  const vorher = stapel[stapel.length - 2];
  const titel = typeof def.titel === 'function' ? def.titel(top.daten) : def.titel;
  $('#schuleTitel').textContent = titel;
  $('#schuleUntertitel').textContent = '';
  $('#schuleAktionen').innerHTML = '';
  $('#schuleZurueckText').textContent = vorher ? kurzTitel(vorher) : (rolle().kollegium ? 'Schule' : 'Mehr');
  const seite = $('#screenSchule');
  if (state.screen !== 'schule') E.showScreen('schule');
  if (!still) seite.scrollTop = 0;
  const inhalt = $('#schuleInhalt');
  if (!still) inhalt.innerHTML = laden();
  E.kopfAbgleichen(seite);
  try { await def.zeichnen(inhalt, top.daten, top); }
  catch (e){ inhalt.innerHTML = fehlerBox(e); }
  E.kopfAbgleichen(seite);
  $$('[data-seite]', inhalt).forEach(b => b.addEventListener('click', () => oeffnen(b.dataset.seite, b.dataset.daten ? JSON.parse(b.dataset.daten) : {})));
}
const kurzTitel = e => { const d = SEITEN[e.seite]; const t = typeof d.titel === 'function' ? d.titel(e.daten) : d.titel; return d.kurz || t; };
$('#schuleZurueck').addEventListener('click', zurueck);
/* Ein Tipp auf einen Reiter der unteren Leiste beginnt dort von vorn. */
$$('.tab').forEach(t => t.addEventListener('click', () => { stapel.length = 0; }));
const untertitel = t => { $('#schuleUntertitel').textContent = t || ''; };
const aktion = (label, beimTippen, symbol = 'plus') => {
  const b = document.createElement('button');
  b.className = 'icon-btn'; b.type = 'button'; b.setAttribute('aria-label', label);
  b.innerHTML = sym(symbol);
  b.addEventListener('click', beimTippen);
  $('#schuleAktionen').appendChild(b);
};

/* ---------------------------------------------------------------------
   Menü auf „Mehr“ bzw. „Schule“
   --------------------------------------------------------------------- */
function menueZeichnen(){
  const ziel = $('#schulMenue');
  if (!ziel) return;
  const R = rolle();
  const tabText = R.kollegium ? 'Schule' : 'Mehr';
  const tabEl = $('#tabMehrText'); if (tabEl) tabEl.textContent = tabText;
  const tabSym = $('#tabMehrSymbol use'); if (tabSym) tabSym.setAttribute('href', R.kollegium ? '#i-school' : '#i-ellipsis');
  const t1 = $('#mehrTitel'); if (t1) t1.textContent = tabText;
  const kt = $('#screenProfile .kopf__titel'); if (kt) kt.textContent = tabText;
  const sch = $('#mehrSchule'); if (sch) sch.textContent = (window.TT_BOOT && window.TT_BOOT.school) || '';
  if (state.source !== 'db'){ ziel.innerHTML = ''; return; }
  const html = [];
  if (R.kollegium){
    html.push(gruppe('Unterricht', [
      R.darf('klassenbuch.eigene') ? navZeile('klassenbuch', 'Klassenbuch', 'Offene Stunden, Einträge, Hausaufgaben, Befreiungen') : '',
      R.darf('pruefung.sehen') ? navZeile('pruefungen', 'Prüfungen') : '',
      (R.darf('vertretung.lehrer') || R.darf('vertretung.schueler')) ? navZeile('vertretungen', 'Vertretungsplan') : '',
      R.darf('hausaufgaben.sehen') ? navZeile('hausaufgaben', 'Hausaufgaben') : '',
    ].join('')));
    html.push(gruppe('Organisation', [
      navZeile('melden', 'Abwesenheit melden', 'Meine Meldungen'),
      (R.darf('buchung.raum', 2) || R.darf('buchung.ressourcen', 2)) ? navZeile('buchen', 'Raum oder Gerät buchen', 'Meine Buchungen') : '',
      navZeile('sprechtag', 'Elternsprechtag', 'Zeiten, Einladungen, Termine, Terminplan als PDF'),
    ].join('')));
    if (R.fehlzeiten || R.fachlehrer)
      html.push(gruppe('Klassenleitung', [
        navZeile('entschuldigungen', 'Entschuldigungen', 'Fehlzeiten der Klasse entschuldigen'),
        navZeile('befreiungen', 'Befreiungen'),
      ].join('')));
  } else {
    html.push(gruppe('Schule', [
      R.darf('hausaufgaben.sehen', 1) || R.familie ? navZeile('hausaufgaben', 'Hausaufgaben') : '',
      navZeile('abwesenheiten', R.eltern ? 'Abwesenheiten und Entschuldigungen' : 'Meine Abwesenheiten', R.eltern ? 'Entschuldigungsschreiben als PDF' : ''),
      R.darf('pruefung.sehen', 1) || R.familie ? navZeile('pruefungen', 'Prüfungen') : '',
      R.darf('vertretung.schueler', 1) || R.familie ? navZeile('vertretungen', 'Vertretungsplan') : '',
      navZeile('sprechtag', 'Elternsprechtag', R.eltern ? 'Termine buchen, Warteliste, Termine als PDF' : ''),
    ].join('')));
  }
  html.push(gruppe('Information', [
    navZeile('neuigkeiten', 'Neuigkeiten', 'Infos der Schule und Neues in EduOrga', '<span id="sfUngelesen"></span>'),
    navZeile('profil', 'Profil und Benachrichtigungen'),
  ].join('')));
  ziel.innerHTML = html.join('');
  $$('[data-seite]', ziel).forEach(b => b.addEventListener('click', () => oeffnen(b.dataset.seite)));
  web('infocenter').then(d => {
    const n = d && d.ungelesen || 0;
    const el = $('#sfUngelesen');
    if (el) el.innerHTML = n ? `<span class="sf-zahl">${n}</span>` : '';
  }).catch(() => {});
}

/* =====================================================================
   Seiten
   ===================================================================== */
const SEITEN = {};

/* ---------- Klassenbuch (Lehrkräfte) ---------- */
SEITEN.klassenbuch = {
  titel:'Klassenbuch',
  async zeichnen(el){
    let offen = null;
    try { offen = await web('klassenbuch/offene-stunden'); } catch (e){ /* ohne Zahl */ }
    const zahl = offen ? `<span class="sf-zahl${offen.offen ? ' sf-zahl--warn' : ''}">${offen.offen}</span>` : '';
    el.innerHTML = gruppe('', [
      navZeile('offen', 'Offene Stunden', offen ? `${offen.ohneLehrstoff} ohne Thema · ${offen.ohneKontrolle} ohne Anwesenheit` : 'Thema und Anwesenheit nachtragen', zahl),
      navZeile('eintraege', 'Klassenbucheinträge', 'Vermerke, Lob, Ordnungsmaßnahmen'),
      navZeile('hausaufgaben', 'Hausaufgaben', 'Eingetragene Hausaufgaben'),
      navZeile('befreiungen', 'Befreiungen'),
    ].join('')) + `<p class="sf-fuss">Thema, Hausaufgaben, Anwesenheit und Einträge einer Stunde trägt man in den Stundendetails ein: im Plan die Stunde antippen.</p>`;
  }
};

/* Offene Stunden: Thema bzw. Anwesenheitskontrolle fehlt */
SEITEN.offen = {
  titel:'Offene Stunden', kurz:'Offen',
  async zeichnen(el, daten, eintrag){
    const bereich = daten.bereich || '';
    const d = await web('klassenbuch/offene-stunden' + (bereich ? '?bereich=' + encodeURIComponent(bereich) : ''));
    daten.bereich = d.bereich;
    untertitel(zeitraum(d.von, d.bis));
    const bereiche = (d.bereiche || []).filter(b => b.id !== 'individuell');
    const zeilen = (d.zeilen || []).filter(z => !z.geprueft || !z.lehrstoff);
    const tage = [...new Set(zeilen.map(z => z.datum))].sort().reverse();
    el.innerHTML = `
      <div class="sf-chips" role="tablist">${bereiche.map(b => `<button type="button" class="sf-chip${b.id === d.bereich ? ' is-on' : ''}" data-bereich="${esc(b.id)}">${esc(b.text)}</button>`).join('')}</div>
      <div class="sf-kennzahlen">
        <span><b>${d.offen}</b> offen</span><span><b>${d.ohneLehrstoff}</b> ohne Thema</span>
        ${d.abwesenheitskontrolle ? `<span><b>${d.ohneKontrolle}</b> ohne Anwesenheit</span>` : ''}<span><b>${d.vollstaendig}</b> vollständig</span>
      </div>
      ${tage.length ? tage.map(t => gruppe(datumLang(t), zeilen.filter(z => z.datum === t).sort((a, b) => a.von - b.von).map(z => `
        <button class="row row--nav sf-stunde" type="button" data-datum="${esc(z.datum)}" data-stunde="${z.von}" data-unterricht="${z.unterricht}">
          <span class="sf-fachmarke" style="--fach:${/^#[0-9a-f]{3,8}$/i.test(z.farbe || '') ? z.farbe : 'var(--balken-grau)'}"></span>
          <span class="row__main"><b>${esc(stunden(z.von, z.bis))} · ${esc((z.klassen || []).join(', '))} · ${esc(z.fachName || z.fach)}</b>
            <i>${esc(z.beginn)}–${esc(z.ende)}${(z.raeume || []).length ? ' · ' + esc(z.raeume.join(', ')) : ''}</i>
            <i class="sf-fehlt">Fehlt: ${esc([!z.lehrstoff ? 'Thema' : '', d.abwesenheitskontrolle && !z.geprueft ? 'Anwesenheit' : ''].filter(Boolean).join(', '))}</i></span>
          <span></span>
          ${sym('chevron-right', 'ico--chev2')}
        </button>`).join(''))).join('')
      : leer('Alles nachgetragen', 'Im gewählten Zeitraum sind alle Stunden vollständig.')}`;
    $$('[data-bereich]', el).forEach(b => b.addEventListener('click', () => { buzz(); daten.bereich = b.dataset.bereich; zeigen(true); }));
    $$('.sf-stunde', el).forEach(b => b.addEventListener('click', () => E.stundeOeffnen(b.dataset.datum, +b.dataset.stunde, +b.dataset.unterricht)));
  }
};

/* Klassenbucheinträge (Vermerke) der eigenen Klassen */
SEITEN.eintraege = {
  titel:'Klassenbucheinträge', kurz:'Einträge',
  async zeichnen(el, daten){
    const klassen = await eigeneKlassen();
    const von = daten.von || iso(plus(new Date(), -30)), bis = daten.bis || heute();
    const klasse = daten.klasse || '';
    const q = new URLSearchParams({ von, bis }); if (klasse) q.set('klasse', klasse);
    const d = await web('klassenbucheintraege?' + q);
    untertitel(zeitraum(von, bis));
    aktion('Neuer Eintrag', () => oeffnen('eintragNeu', { arten: d.arten || [], klasse }));
    const liste = (d.eintraege || []).slice().sort((a, b) => String(b.datum).localeCompare(String(a.datum)));
    el.innerHTML = `
      <div class="sf-chips">${['', ...klassen].map(k => `<button type="button" class="sf-chip${k === klasse ? ' is-on' : ''}" data-klasse="${esc(k)}">${k ? esc(k) : 'Alle Klassen'}</button>`).join('')}</div>
      ${liste.length ? gruppe(`${liste.length} ${liste.length === 1 ? 'Eintrag' : 'Einträge'}`, liste.map(v => `
        <div class="row sf-eintrag">
          ${datumBlock(v.datum)}
          <span class="row__main"><b>${esc(v.schueler || 'Ganze Klasse')} · ${esc(v.klasse)}</b>
            <span class="sf-text">${esc(v.text)}</span>
            <i>${esc(v.art)}${v.lehrer ? ' · ' + esc(v.lehrer) : ''}${v.stunde ? ' · ' + esc(v.stunde) + '. Std.' : ''}</i></span>
          ${v.loeschen ? `<button class="icon-btn sf-loeschen" type="button" data-id="${v.id}" aria-label="Eintrag löschen">${sym('trash-2')}</button>` : '<span></span>'}
        </div>`).join(''))
      : leer('Keine Einträge', 'Im Zeitraum gibt es keine Klassenbucheinträge.')}`;
    $$('[data-klasse]', el).forEach(b => b.addEventListener('click', () => { daten.klasse = b.dataset.klasse; zeigen(true); }));
    $$('.sf-loeschen', el).forEach(b => b.addEventListener('click', async () => {
      if (!await bestaetigen('Eintrag löschen?', 'Der Klassenbucheintrag wird entfernt.', 'Löschen', true)) return;
      try { await web('klassenbuch/vermerke/' + b.dataset.id, 'DELETE'); buzz(); toast('Eintrag gelöscht'); zeigen(true); }
      catch (e){ toast('Nicht gelöscht: ' + e.message); }
    }));
  }
};

SEITEN.eintragNeu = {
  titel:'Neuer Eintrag', kurz:'Eintrag',
  async zeichnen(el, daten){
    const klassen = await eigeneKlassen();
    const klasse = daten.klasse || klassen[0] || '';
    let schueler = [];
    try { schueler = klasse ? await web('klassenbuch/schueler?klasse=' + encodeURIComponent(klasse)) : []; } catch (e){ /* ganze Klasse */ }
    el.innerHTML = `<form class="sf-form">
      ${feld('Klasse', auswahl('klasse', klassen, klasse))}
      ${feld('Schüler*in', auswahl('schuelerId', [['', 'Ganze Klasse'], ...schueler.map(s => [s.id, `${s.name}, ${s.vorname}`])], ''))}
      ${feld('Datum', `<input type="date" name="datum" value="${heute()}" required>`)}
      ${feld('Art', auswahl('art', daten.arten && daten.arten.length ? daten.arten : ['Vermerk'], (daten.arten || [])[0]))}
      ${feld('Text', '<textarea name="text" rows="4" required maxlength="2000" placeholder="Was ist vorgefallen?"></textarea>')}
      <button class="knopf knopf--primaer knopf--gross" type="submit">Eintragen</button>
    </form>`;
    const f = $('form', el);
    f.klasse.addEventListener('change', () => { daten.klasse = f.klasse.value; zeigen(true); });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const w = formWerte(f);
      try {
        await web('klassenbuch/vermerke', 'POST', { datum:w.datum, klasse:w.klasse, schuelerId: w.schuelerId ? +w.schuelerId : null, art:w.art, text:w.text.trim() });
        buzz(); toast('Eintrag gespeichert'); zurueck();
      } catch (x){ toast('Nicht gespeichert: ' + x.message); }
    });
  }
};

/* ---------- Hausaufgaben ---------- */
SEITEN.hausaufgaben = {
  titel:'Hausaufgaben',
  async zeichnen(el, daten){
    const R = rolle();
    const von = iso(plus(new Date(), -14)), bis = iso(plus(new Date(), 28));
    let zeilen = [], kopf = '';
    if (R.kollegium){
      zeilen = await web(`hausaufgaben/eintraege?von=${von}&bis=${bis}`);
    } else {
      const kinder = R.eltern ? await kinderAuswahl(daten) : null;
      const q = new URLSearchParams({ von, bis }); if (daten.schueler) q.set('schueler', daten.schueler);
      const d = await web('familie/hausaufgaben?' + q);
      zeilen = d.zeilen || [];
      kopf = kinder || '';
    }
    const offen = zeilen.filter(z => (z.faellig || z.datum) >= heute()).sort((a, b) => String(a.faellig || a.datum).localeCompare(String(b.faellig || b.datum)));
    const frueher = zeilen.filter(z => (z.faellig || z.datum) < heute()).sort((a, b) => String(b.faellig || b.datum).localeCompare(String(a.faellig || a.datum)));
    const zeile = h => `
      <div class="row sf-ha${h.erledigt ? ' is-erledigt' : ''}">
        ${datumBlock(h.faellig || h.datum)}
        <span class="row__main"><b>${esc(h.fach)} · ${esc((h.klassen || []).join(', '))}${h.lehrer ? ' · ' + esc(h.lehrer) : ''}</b>
          <span class="sf-text">${esc(h.text)}</span>
          <i>${h.faellig ? 'fällig ' + esc(datumKurz(h.faellig)) + ' · ' : ''}aufgegeben ${esc(datumKurz(h.datum))}${h.stunde ? ', ' + h.stunde + '. Std.' : ''}${h.bemerkung ? ' · ' + esc(h.bemerkung) : ''}</i></span>
        <span></span>
      </div>`;
    untertitel(zeitraum(von, bis));
    el.innerHTML = kopf + (zeilen.length
      ? gruppe('Anstehend', offen.map(zeile).join('')) + gruppe('Zurückliegend', frueher.map(zeile).join(''))
      : leer('Keine Hausaufgaben', 'Im Zeitraum sind keine Hausaufgaben eingetragen.'))
      + (R.kollegium ? '<p class="sf-fuss">Neue Hausaufgaben trägt man in den Stundendetails der Stunde ein.</p>' : '');
    kinderBinden(el, daten);
  }
};

/* Kinder der Eltern (mehrere: Auswahl oben) */
async function kinderAuswahl(daten){
  let kinder = [];
  try { kinder = await web('familie/kinder'); } catch (e){ return ''; }
  if (!daten.schueler && kinder[0]) daten.schueler = kinder[0].id;
  if (kinder.length < 2) return '';
  return `<div class="sf-chips">${kinder.map(k => `<button type="button" class="sf-chip${+daten.schueler === k.id ? ' is-on' : ''}" data-kind="${k.id}">${esc(k.vorname)} (${esc(k.klasse)})</button>`).join('')}</div>`;
}
function kinderBinden(el, daten){
  $$('[data-kind]', el).forEach(b => b.addEventListener('click', () => { daten.schueler = +b.dataset.kind; zeigen(true); }));
}

/* ---------- Prüfungen ---------- */
SEITEN.pruefungen = {
  titel:'Prüfungen',
  async zeichnen(el){
    const R = rolle();
    const von = montag(heute()), bis = iso(plus(parse(von), 7 * 8 - 1));
    const liste = (await web(`pruefungen?von=${von}&bis=${bis}`)) || [];
    untertitel(zeitraum(von, bis));
    if (R.kollegium && R.darf('pruefung.anlegen', 2)) aktion('Prüfung eintragen', () => oeffnen('pruefungNeu'));
    const wochen = [...new Set(liste.map(p => montag(p.datum)))].sort();
    el.innerHTML = liste.length ? wochen.map(w => gruppe(`KW ${kw(w)} · ab ${datumKurz(w)}`, liste.filter(p => montag(p.datum) === w)
      .sort((a, b) => String(a.datum).localeCompare(String(b.datum)) || a.stundeVon - b.stundeVon).map(p => `
        <div class="row sf-pruefung">
          ${datumBlock(p.datum)}
          <span class="row__main"><b>${esc(p.titel || p.art || 'Prüfung')}${p.fach ? ' · ' + esc(p.fach) : ''}</b>
            <i>${esc(datumKurz(p.datum))} · ${esc(stunden(p.stundeVon, p.stundeBis))}${p.beginn ? ` (${esc(p.beginn)}–${esc(p.ende)})` : ''}</i>
            <i>${esc((p.klassen || []).join(', '))}${(p.raeume || []).length ? ' · Raum ' + esc(p.raeume.join(', ')) : ''}${(p.lehrer || []).length ? ' · ' + esc(p.lehrer.join(', ')) : ''}</i>
            ${p.text ? `<span class="sf-text">${esc(p.text)}</span>` : ''}</span>
          <span class="sf-marken">${p.status === 'vorgemerkt' || p.status === 'offen' ? plakette('Vorgemerkt') : plakette(p.art || 'Prüfung', 'pruefung')}
            ${p.darfLoeschen ? `<button class="icon-btn sf-loeschen" type="button" data-p='${esc(JSON.stringify({ datum:p.datum, stundeVon:p.stundeVon, stundeBis:p.stundeBis, klassen:p.klassen, titel:p.titel }))}' aria-label="Prüfung löschen">${sym('trash-2')}</button>` : ''}</span>
        </div>`).join(''))).join('')
      : leer('Keine Prüfungen', 'In den nächsten acht Wochen sind keine Prüfungen eingetragen.');
    $$('.sf-loeschen', el).forEach(b => b.addEventListener('click', async () => {
      const p = JSON.parse(b.dataset.p);
      if (!await bestaetigen('Prüfung löschen?', `${p.titel || 'Prüfung'} am ${datumKurz(p.datum)}`, 'Löschen', true)) return;
      try { await web('meldungen/klausur/loeschen', 'POST', p); buzz(); toast('Prüfung gelöscht'); zeigen(true); }
      catch (e){ toast('Nicht gelöscht: ' + e.message); }
    }));
  }
};

SEITEN.pruefungNeu = {
  titel:'Prüfung eintragen', kurz:'Prüfung',
  async zeichnen(el){
    const klassen = await eigeneKlassen();
    const morgen = iso(plus(new Date(), 1));
    el.innerHTML = `<form class="sf-form">
      ${feld('Titel', '<input type="text" name="titel" value="Klassenarbeit" maxlength="120" required>')}
      ${feld('Datum', `<input type="date" name="datum" value="${morgen}" required>`)}
      <div class="sf-zwei">${feld('Von', `<select name="stundeVon">${stundenOptionen(1)}</select>`)}${feld('Bis', `<select name="stundeBis">${stundenOptionen(1)}</select>`)}</div>
      <div class="sf-feld"><span>Klassen</span><div class="sf-chips sf-chips--wahl">${klassen.map((k, i) => `<label class="sf-chip"><input type="checkbox" name="klasse" value="${esc(k)}"${i === 0 ? ' checked' : ''}><span>${esc(k)}</span></label>`).join('')}</div></div>
      ${feld('Hinweis', '<textarea name="text" rows="3" maxlength="1000" placeholder="Stoff, Hilfsmittel …"></textarea>')}
      <button class="knopf knopf--primaer knopf--gross" type="submit">Eintragen</button>
      <p class="sf-fuss">Die Prüfung erscheint sofort im Plan und wird an die Stundenplanung gemeldet.</p>
    </form>`;
    const f = $('form', el);
    f.stundeVon.addEventListener('change', () => { if (+f.stundeBis.value < +f.stundeVon.value) f.stundeBis.value = f.stundeVon.value; });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const ks = $$('input[name=klasse]:checked', f).map(x => x.value);
      if (!ks.length){ toast('Bitte mindestens eine Klasse wählen.'); return; }
      try {
        await web('meldungen/klausur', 'POST', { datum:f.datum.value, stundeVon:+f.stundeVon.value, stundeBis:Math.max(+f.stundeVon.value, +f.stundeBis.value),
          klassen:ks, raeume:[], aufsicht:[], titel:f.titel.value.trim(), text:f.text.value.trim() });
        buzz(); toast('Prüfung eingetragen'); zurueck();
      } catch (x){ toast('Nicht eingetragen: ' + x.message); }
    });
  }
};

/* ---------- Vertretungsplan ---------- */
SEITEN.vertretungen = {
  titel:'Vertretungsplan',
  async zeichnen(el, daten){
    const d = await web(`vertretungen?datum=${heute()}&tage=5`);
    const tage = d.tage || [];
    if (!daten.tag || !tage.some(t => t.datum === daten.tag)) daten.tag = (tage[0] || {}).datum;
    const t = tage.find(x => x.datum === daten.tag) || {};
    untertitel(t.datum ? `${t.wochentag || ''}, ${datumLang(t.datum).slice(4)}${t.woche ? ' · Woche ' + t.woche : ''}` : '');
    const kopf = `<div class="sf-chips">${tage.map(x => `<button type="button" class="sf-chip${x.datum === daten.tag ? ' is-on' : ''}" data-tag="${esc(x.datum)}">${esc(datumKurz(x.datum))}</button>`).join('')}</div>`;
    if (!t.datum){ el.innerHTML = kopf + leer('Kein Vertretungsplan', 'Für die nächsten Tage liegen keine Daten vor.'); return; }
    const info = [
      ...(t.nachrichten || []).map(n => `<div class="row sf-info"><span class="row__main"><span class="sf-text">${esc(n)}</span></span></div>`),
      (t.abwesendeLehrer || []).length ? `<div class="row sf-info"><span class="row__main"><b>Abwesende Lehrkräfte</b><span class="sf-text">${esc(t.abwesendeLehrer.join(', '))}</span></span></div>` : '',
      (t.abwesendeKlassen || []).length ? `<div class="row sf-info"><span class="row__main"><b>Abwesende Klassen</b><span class="sf-text">${esc(t.abwesendeKlassen.join(', '))}</span></span></div>` : '',
      (t.blockierteRaeume || []).length ? `<div class="row sf-info"><span class="row__main"><b>Nicht verfügbare Räume</b><span class="sf-text">${esc(t.blockierteRaeume.join(', '))}</span></span></div>` : '',
      (t.veranstaltungen || []).length ? `<div class="row sf-info"><span class="row__main"><b>Veranstaltungen</b><span class="sf-text">${esc(t.veranstaltungen.join(', '))}</span></span></div>` : '',
    ].join('');
    const zeilen = (t.zeilen || []).slice().sort((a, b) => (a.stundeVon || 0) - (b.stundeVon || 0) || String(a.klassen).localeCompare(String(b.klassen), 'de', { numeric:true }));
    const alt = (neu, a) => a && a !== neu ? `<s>${esc(a)}</s> ${esc(neu || '—')}` : esc(neu || '');
    el.innerHTML = kopf + (t.frei ? leer(t.freiGrund || 'Unterrichtsfrei', 'An diesem Tag findet kein Unterricht statt.')
      : gruppe('Hinweise', info) + (zeilen.length ? gruppe(`${zeilen.length} ${zeilen.length === 1 ? 'Änderung' : 'Änderungen'}`, zeilen.map(z => {
          const entfall = z.status === 'entfall' || /entf/i.test(z.art || '');
          return `<div class="row sf-vp${entfall ? ' is-entfall' : ''}">
            <span class="sf-vp__std">${esc(z.stunde)}</span>
            <span class="row__main"><b>${esc(z.klassen || '—')}${z.fach || z.fachAlt ? ' · ' : ''}${alt(z.fach, z.fachAlt)}</b>
              <i>${z.lehrer || z.lehrerAlt ? 'Lehrkraft ' + alt(z.lehrer, z.lehrerAlt) : ''}${z.raum || z.raumAlt ? ' · Raum ' + alt(z.raum, z.raumAlt) : ''}</i>
              ${z.text || z.vertrVon || z.nach ? `<span class="sf-text">${esc([z.text, z.vertrVon ? 'statt ' + z.vertrVon : '', z.nach ? 'verlegt nach ' + z.nach : ''].filter(Boolean).join(' · '))}</span>` : ''}</span>
            <span class="sf-marken">${plakette(z.art || (entfall ? 'Entfall' : 'Vertretung'), entfall ? 'entfall' : 'aenderung')}</span>
          </div>`; }).join(''))
        : leer('Keine Änderungen', 'Für diesen Tag sind keine Vertretungen eingetragen.')));
    $$('[data-tag]', el).forEach(b => b.addEventListener('click', () => { buzz(); daten.tag = b.dataset.tag; zeigen(true); }));
  }
};

/* ---------- Abwesenheit melden (Lehrkräfte) und Meine Meldungen ---------- */
const MELDUNG_STATUS = { offen:['Gemeldet', ''], uebernommen:['Übernommen', 'frei'], quittiert:['Übernommen', 'frei'], abgelehnt:['Abgelehnt', 'entfall'], zurueckgezogen:['Zurückgezogen', ''] };
SEITEN.melden = {
  titel:'Abwesenheit melden', kurz:'Melden',
  async zeichnen(el){
    let gruende = [];
    try { gruende = (await web('abwesenheitsgruende?art=abwesenheit')).filter(g => g.aktiv !== false).map(g => g.name); } catch (e){ /* frei */ }
    if (!gruende.length) gruende = ['Krankheit', 'Fortbildung', 'Dienstlich', 'Sonstiges'];
    const meldungen = (await web('meldungen').catch(() => [])) || [];
    const eigene = meldungen.filter(m => m.typ === 'absenz' || m.typ === 'abwesenheit' || m.typ === 'klausur' || m.typ === 'raumbuchung')
      .sort((a, b) => String(b.erstellt).localeCompare(String(a.erstellt)));
    const morgen = heute();
    el.innerHTML = `<form class="sf-form">
      <div class="sf-zwei">${feld('Von', `<input type="date" name="von" value="${morgen}" required>`)}${feld('Bis', `<input type="date" name="bis" value="${morgen}" required>`)}</div>
      <label class="row row--switch sf-schalter"><span class="row__main"><b>Ganztägig</b></span><input type="checkbox" name="ganz" checked><span class="switch" aria-hidden="true"></span></label>
      <div class="sf-zwei sf-stunden" hidden>${feld('Ab Stunde', `<select name="stundeVon">${stundenOptionen(1)}</select>`)}${feld('Bis Stunde', `<select name="stundeBis">${stundenOptionen(stundenNummern().slice(-1)[0])}</select>`)}</div>
      ${feld('Grund', auswahl('grund', gruende, gruende[0]))}
      ${feld('Hinweis', '<textarea name="text" rows="3" maxlength="1000" placeholder="z. B. Aufgaben für die Vertretung"></textarea>')}
      <button class="knopf knopf--primaer knopf--gross" type="submit">Abwesenheit melden</button>
      <p class="sf-fuss">Die Meldung geht an die Vertretungsplanung. Übernommene Abwesenheiten stehen anschließend in Ihrem Plan.</p>
    </form>
    ${gruppe('Meine Meldungen', eigene.map(m => {
      const st = MELDUNG_STATUS[m.status] || [m.status || 'Gemeldet', ''];
      const was = m.typ === 'klausur' ? 'Prüfung' : m.typ === 'raumbuchung' ? 'Raumbuchung' : 'Abwesenheit';
      return `<div class="row sf-meldung">
        ${datumBlock(m.von)}
        <span class="row__main"><b>${esc(was)}${m.grund ? ' · ' + esc(m.grund) : m.titel ? ' · ' + esc(m.titel) : ''}</b>
          <i>${esc(datumKurz(m.von))}${m.bis && m.bis !== m.von ? ' – ' + esc(datumKurz(m.bis)) : ''}${m.stundeVon ? ' · ' + esc(stunden(m.stundeVon, m.stundeBis)) : ' · ganztägig'}</i>
          ${m.text ? `<span class="sf-text">${esc(m.text)}</span>` : ''}</span>
        <span class="sf-marken">${plakette(st[0], st[1])}${m.status === 'offen' ? `<button class="knopf knopf--still sf-klein" type="button" data-zurueck="${esc(m.id)}">Zurückziehen</button>` : ''}</span>
      </div>`; }).join('')) || ''}
    ${eigene.length ? '' : '<p class="sf-fuss">Noch keine Meldungen.</p>'}
    <div class="rows sf-mehr">${navZeile('absences', 'Meine Abwesenheiten', 'Von der Planung eingetragen')}</div>`;
    const f = $('form', el);
    f.ganz.addEventListener('change', () => { $('.sf-stunden', f).hidden = f.ganz.checked; });
    f.von.addEventListener('change', () => { if (f.bis.value < f.von.value) f.bis.value = f.von.value; });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      try {
        await web('meldungen/abwesenheit', 'POST', { von:f.von.value, bis:f.bis.value,
          stundeVon: f.ganz.checked ? null : +f.stundeVon.value, stundeBis: f.ganz.checked ? null : Math.max(+f.stundeVon.value, +f.stundeBis.value),
          grund:f.grund.value, text:f.text.value.trim() });
        buzz(); toast('Abwesenheit gemeldet'); zeigen(true);
      } catch (x){ toast('Nicht gemeldet: ' + x.message); }
    });
    $$('[data-zurueck]', el).forEach(b => b.addEventListener('click', async () => {
      if (!await bestaetigen('Meldung zurückziehen?', 'Die Meldung wird gelöscht, solange sie noch nicht übernommen ist.', 'Zurückziehen', true)) return;
      try { await web('meldungen/' + encodeURIComponent(b.dataset.zurueck), 'DELETE'); buzz(); toast('Meldung zurückgezogen'); zeigen(true); }
      catch (x){ toast('Nicht möglich: ' + x.message); }
    }));
  }
};
/* Bestehende Listen aus app.js */
SEITEN.absences = { titel:'Meine Abwesenheiten', direkt(){ E.listeOeffnen('absences'); } };
SEITEN.entschuldigungen = { titel:'Entschuldigungen', direkt(){ E.listeOeffnen('leadabsent'); } };
SEITEN.sprechtag = { titel:'Elternsprechtag', direkt(){ E.sprechtagOeffnen(); } };

/* ---------- Abwesenheiten (Schüler*innen, Eltern) ---------- */
const ABW_STATUS = { entschuldigt:['Entschuldigt', 'frei'], unentschuldigt:['Unentschuldigt', 'entfall'], offen:['Offen', 'pruefung'], abgelehnt:['Abgelehnt', 'entfall'] };
SEITEN.abwesenheiten = {
  titel: () => rolle().eltern ? 'Abwesenheiten' : 'Meine Abwesenheiten', kurz:'Abwesenheiten',
  async zeichnen(el, daten){
    const R = rolle();
    const kinder = R.eltern ? await kinderAuswahl(daten) : '';
    const q = new URLSearchParams(); if (daten.schueler) q.set('schueler', daten.schueler);
    const d = await web('familie/abwesenheiten' + (q.toString() ? '?' + q : ''));
    untertitel(zeitraum(d.von, d.bis));
    const s = d.summen || {};
    let gruende = {};
    try { gruende = await web('familie/gruende'); } catch (e){ /* Kürzel */ }
    const zeilen = (d.zeilen || []).slice().sort((a, b) => String(b.vonDatum).localeCompare(String(a.vonDatum)));
    const pdf = new URLSearchParams({ ausrichtung:'hoch' }); if (daten.schueler) pdf.set('schueler', daten.schueler);
    el.innerHTML = kinders(kinder) + `
      <div class="sf-kennzahlen">
        <span><b>${s.fehltage ?? 0}</b> Fehltage</span><span><b>${s.fehlstunden ?? 0}</b> Fehlstunden</span>
        <span><b>${s.unentschuldigt ?? 0}</b> unentschuldigt</span><span><b>${s.verspaetet ?? 0}</b> verspätet</span>
      </div>
      ${zeilen.length ? gruppe('Abwesenheiten', zeilen.map(a => {
        const st = ABW_STATUS[a.status] || [a.status || '', ''];
        const zeit = a.bisDatum && a.bisDatum !== a.vonDatum
          ? `${datumKurz(a.vonDatum)} ${a.vonZeit || ''} – ${datumKurz(a.bisDatum)} ${a.bisZeit || ''}`
          : `${datumKurz(a.vonDatum)} · ${a.vonZeit || ''}–${a.bisZeit || ''}`;
        return `<div class="row sf-abw">
          ${datumBlock(a.vonDatum)}
          <span class="row__main"><b>${esc(gruende[a.grund] || a.grund || (a.art === 'verspaetung' ? 'Verspätung' : 'Abwesend'))}</b>
            <i>${esc(zeit)}${a.fehlstunden ? ' · ' + a.fehlstunden + ' Std.' : ''}</i>
            ${a.text ? `<span class="sf-text">${esc(a.text)}</span>` : ''}</span>
          <span class="sf-marken">${st[0] ? plakette(st[0], st[1]) : ''}</span>
        </div>`; }).join(''))
      : leer('Keine Abwesenheiten', 'Im laufenden Schuljahr ist keine Abwesenheit eingetragen.')}
      ${R.eltern ? `<a class="knopf knopf--sekundaer knopf--gross sf-pdf" href="${esc(pdfLink('familie/entschuldigung?' + pdf))}" target="_blank" rel="noopener">${sym('download')}<span>Entschuldigungsschreiben (PDF)</span></a>
        <p class="sf-fuss">Das Schreiben enthält die offenen Abwesenheiten; ausdrucken, unterschreiben und der Klassenleitung geben.</p>` : ''}`;
    kinderBinden(el, daten);
  }
};
const kinders = k => k || '';

/* ---------- Befreiungen ---------- */
SEITEN.befreiungen = {
  titel:'Befreiungen',
  async zeichnen(el, daten){
    const d = await web(`befreiungen?von=${schuljahrBeginn()}&bis=${schuljahrEnde()}`);
    if (d.verwalten) aktion('Neue Befreiung', () => oeffnen('befreiungNeu', { gruende: d.gruende || [] }));
    const liste = (d.befreiungen || []).slice().sort((a, b) => String(a.klasse).localeCompare(String(b.klasse), 'de', { numeric:true }) || String(a.schueler).localeCompare(String(b.schueler)));
    const WTL = ['', 'montags', 'dienstags', 'mittwochs', 'donnerstags', 'freitags', 'samstags'];
    el.innerHTML = liste.length ? gruppe(`${liste.length} ${liste.length === 1 ? 'Befreiung' : 'Befreiungen'}`, liste.map(b => `
      <div class="row sf-befreiung">
        <span class="row__main"><b>${esc(b.schueler)} · ${esc(b.klasse)}</b>
          <i>${esc((d.gruende || []).find(g => g.kurz === b.grund)?.name || b.grund || 'Befreiung')}${b.fach ? ' · ' + esc(b.fach) : ''}${b.wochentag ? ' · ' + WTL[b.wochentag] : ''}${b.beginn ? ` ${esc(b.beginn)}–${esc(b.ende)}` : ''}</i>
          <i>${esc(datumKurz(b.von))} – ${esc(datumLang(b.bis))}</i>
          ${b.text ? `<span class="sf-text">${esc(b.text)}</span>` : ''}</span>
        ${d.verwalten ? `<button class="icon-btn sf-loeschen" type="button" data-id="${b.id}" aria-label="Befreiung löschen">${sym('trash-2')}</button>` : '<span></span>'}
      </div>`).join(''))
      : leer('Keine Befreiungen', 'Im laufenden Schuljahr ist niemand befreit.');
    $$('.sf-loeschen', el).forEach(b => b.addEventListener('click', async () => {
      if (!await bestaetigen('Befreiung löschen?', '', 'Löschen', true)) return;
      try { await web('befreiungen/' + b.dataset.id, 'DELETE'); buzz(); toast('Befreiung gelöscht'); zeigen(true); }
      catch (e){ toast('Nicht gelöscht: ' + e.message); }
    }));
  }
};
SEITEN.befreiungNeu = {
  titel:'Neue Befreiung', kurz:'Befreiung',
  async zeichnen(el, daten){
    const klassen = await eigeneKlassen();
    const klasse = daten.klasse || klassen[0] || '';
    const schueler = klasse ? await web('klassenbuch/schueler?klasse=' + encodeURIComponent(klasse)).catch(() => []) : [];
    el.innerHTML = `<form class="sf-form">
      ${feld('Klasse', auswahl('klasse', klassen, klasse))}
      ${feld('Schüler*in', auswahl('schuelerId', schueler.map(s => [s.id, `${s.name}, ${s.vorname}`]), ''))}
      ${feld('Grund', auswahl('grund', (daten.gruende || []).map(g => [g.kurz, g.name]), ((daten.gruende || [])[0] || {}).kurz))}
      <div class="sf-zwei">${feld('Von', `<input type="date" name="von" value="${heute()}" required>`)}${feld('Bis', `<input type="date" name="bis" value="${schuljahrEnde()}" required>`)}</div>
      ${feld('Fach (optional)', '<input type="text" name="fach" maxlength="20" placeholder="z. B. SP">')}
      ${feld('Bemerkung', '<textarea name="text" rows="2" maxlength="500"></textarea>')}
      <button class="knopf knopf--primaer knopf--gross" type="submit">Speichern</button>
    </form>`;
    const f = $('form', el);
    f.klasse.addEventListener('change', () => { daten.klasse = f.klasse.value; zeigen(true); });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      try {
        await web('befreiungen', 'POST', { schuelerId:+f.schuelerId.value, von:f.von.value, bis:f.bis.value, wochentag:null,
          fach:f.fach.value.trim() || null, beginn:null, ende:null, grund:f.grund.value, text:f.text.value.trim() });
        buzz(); toast('Befreiung gespeichert'); zurueck();
      } catch (x){ toast('Nicht gespeichert: ' + x.message); }
    });
  }
};

/* ---------- Raum oder Gerät buchen ---------- */
SEITEN.buchen = {
  titel:'Buchen',
  async zeichnen(el, daten){
    const o = await web('buchen/optionen');
    daten.art = daten.art || (o.raumBuchen ? 'raum' : 'ressource');
    daten.datum = daten.datum || (o.naechsterTag && o.naechsterTag >= heute() ? o.naechsterTag : heute());
    daten.von = daten.von || 1; daten.bis = daten.bis || daten.von;
    daten.serie = !!daten.serie;
    const arten = [o.raumBuchen ? ['raum', 'Raum'] : null, o.ressourcenBuchen ? ['ressource', 'Gerät'] : null].filter(Boolean);
    el.innerHTML = `
      ${arten.length > 1 ? `<nav class="segment sf-seg">${arten.map(([k, t]) => `<button type="button" data-art="${k}" class="${daten.art === k ? 'is-on' : ''}">${t}</button>`).join('')}</nav>` : ''}
      <form class="sf-form">
        ${feld('Datum', `<input type="date" name="datum" value="${esc(daten.datum)}" required>`)}
        <div class="sf-zwei">${feld('Von', `<select name="von">${stundenOptionen(daten.von)}</select>`)}${feld('Bis', `<select name="bis">${stundenOptionen(daten.bis)}</select>`)}</div>
        <label class="row row--switch sf-schalter"><span class="row__main"><b>Wöchentlich wiederholen</b></span><input type="checkbox" name="serie"${daten.serie ? ' checked' : ''}><span class="switch" aria-hidden="true"></span></label>
        <div class="sf-serie"${daten.serie ? '' : ' hidden'}>${feld('Bis einschließlich', `<input type="date" name="serieBis" value="${esc(daten.serieBis || iso(plus(parse(daten.datum), 28)))}">`)}</div>
        ${daten.art === 'ressource' && (o.ressourcenarten || []).length ? feld('Art', auswahl('ressourcenart', [['', 'Alle Geräte'], ...o.ressourcenarten.map(a => [a.id, a.name])], daten.ressourcenart || '')) : ''}
        <button class="knopf knopf--primaer knopf--gross" type="submit">${daten.art === 'raum' ? 'Freie Räume suchen' : 'Freie Geräte suchen'}</button>
      </form>
      <div id="sfTreffer"></div>
      <div class="rows sf-mehr">${navZeile('buchungen', 'Meine Buchungen')}</div>`;
    const f = $('form', el);
    $$('[data-art]', el).forEach(b => b.addEventListener('click', () => { daten.art = b.dataset.art; daten.treffer = null; zeigen(true); }));
    f.serie.addEventListener('change', () => { $('.sf-serie', f).hidden = !f.serie.checked; });
    f.von.addEventListener('change', () => { if (+f.bis.value < +f.von.value) f.bis.value = f.von.value; });
    const zeit = () => {
      const von = +f.von.value, bis = Math.max(von, +f.bis.value);
      Object.assign(daten, { datum:f.datum.value, von, bis, serie:f.serie.checked, serieBis:f.serieBis.value, ressourcenart:f.ressourcenart ? f.ressourcenart.value : '' });
      const wt = ((parse(f.datum.value).getDay() + 6) % 7) + 1;
      return f.serie.checked
        ? { wiederholung:'woechentlich', von:f.datum.value, bis:f.serieBis.value, wochentage:[wt], stundeVon:von, stundeBis:bis }
        : { wiederholung:'einmalig', datum:f.datum.value, stundeVon:von, stundeBis:bis };
    };
    const suchen = async () => {
      const ziel = $('#sfTreffer'); ziel.innerHTML = laden();
      try {
        const z = zeit();
        if (daten.art === 'raum'){
          const r = await web('buchen/suche/raeume', 'POST', { zeit:z, kriterien:{} });
          const termine = r.termine || [];
          const frei = termine.length ? termine.map(t => new Set(t.freieRaeume || [])).reduce((a, b) => new Set([...a].filter(x => b.has(x)))) : new Set();
          const raeume = (r.raeume || []).filter(x => frei.has(x.kurz));
          ziel.innerHTML = raeume.length ? gruppe(`${raeume.length} freie Räume · ${termine.length} ${termine.length === 1 ? 'Termin' : 'Termine'}`, raeume.map(x => `
            <button class="row row--nav sf-treffer" type="button" data-raum="${esc(x.kurz)}">
              <span class="row__main"><b>${esc(x.kurz)}${x.name && x.name !== x.kurz ? ' · ' + esc(x.name) : ''}</b>
                <i>${esc([x.raumart, x.kapazitaet ? x.kapazitaet + ' Plätze' : '', x.gebaeude].filter(Boolean).join(' · '))}</i>
                ${(x.ressourcen || []).length ? `<i>${esc(x.ressourcen.join(', '))}</i>` : ''}</span>
              <span class="row__hint">Buchen</span>${sym('chevron-right', 'ico--chev2')}
            </button>`).join('')) : leer('Kein Raum frei', 'Zu dieser Zeit ist kein buchbarer Raum frei.');
          $$('[data-raum]', ziel).forEach(b => b.addEventListener('click', () => buchenFuer({ art:'raum', raum:b.dataset.raum, termine, z })));
        } else {
          const kr = daten.ressourcenart ? { ressourcenarten:[+daten.ressourcenart] } : {};
          const r = await web('buchen/suche/ressourcen', 'POST', { zeit:z, kriterien:kr });
          const termine = r.termine || [];
          const liste = (r.ressourcen || []).filter(x => (x.frei || 0) > 0);
          ziel.innerHTML = liste.length ? gruppe(`${liste.length} verfügbare Geräte`, liste.map(x => `
            <button class="row row--nav sf-treffer" type="button" data-res="${x.id}" data-frei="${x.frei}" data-name="${esc(x.name)}">
              <span class="row__main"><b>${esc(x.name)}</b><i>${esc([x.art, x.standort, x.bemerkung].filter(Boolean).join(' · '))}</i></span>
              <span class="row__hint">${x.frei} frei</span>${sym('chevron-right', 'ico--chev2')}
            </button>`).join('')) : leer('Nichts verfügbar', 'Zu dieser Zeit ist kein Gerät frei.');
          $$('[data-res]', ziel).forEach(b => b.addEventListener('click', () => buchenFuer({ art:'ressource', id:+b.dataset.res, frei:+b.dataset.frei, name:b.dataset.name, termine, z })));
        }
      } catch (e){ ziel.innerHTML = fehlerBox(e); }
    };
    const buchenFuer = async w => {
      const termine = (w.termine || []).map(t => t.termin || t);
      const wann = termine.length === 1 ? `${datumKurz(termine[0].datum)}, ${stunden(termine[0].stundeVon, termine[0].stundeBis)}` : `${termine.length} Termine ab ${datumKurz((termine[0] || {}).datum)}`;
      const a = await E.sptBlatt({ titel: w.art === 'raum' ? `Raum ${w.raum} buchen` : `${w.name} buchen`, text: wann, eingabe:'Anlass (optional)',
        knoepfe:[{ label:'Buchen', wert:1, fett:true }] });
      if (!a) return;
      try {
        const res = await web('buchen', 'POST', {
          art: w.art, termine: termine.map(t => ({ datum:t.datum, stundeVon:t.stundeVon, stundeBis:t.stundeBis, raum: w.art === 'raum' ? w.raum : null })),
          ressourcen: w.art === 'ressource' ? [{ id:w.id, menge:1 }] : [], klassen:[], titel:a.text || '', text:'' });
        buzz();
        const n = (res.buchungen || []).length;
        toast(n > 1 ? `${n} Termine gebucht` : 'Gebucht');
        (res.hinweise || []).forEach(h => setTimeout(() => toast(h), 1600));
        suchen();
      } catch (x){ toast('Nicht gebucht: ' + x.message); }
    };
    f.addEventListener('submit', e => { e.preventDefault(); suchen(); });
  }
};
SEITEN.buchungen = {
  titel:'Meine Buchungen', kurz:'Buchungen',
  async zeichnen(el){
    const von = heute(), bis = iso(plus(new Date(), 180));
    const liste = ((await web(`buchen/liste?von=${von}&bis=${bis}`)) || []).filter(b => !b.storniert)
      .sort((a, b) => String(a.datum).localeCompare(String(b.datum)) || a.stundeVon - b.stundeVon);
    untertitel(`ab ${datumLang(von)}`);
    el.innerHTML = liste.length ? gruppe(`${liste.length} ${liste.length === 1 ? 'Buchung' : 'Buchungen'}`, liste.map(b => `
      <div class="row sf-buchung">
        ${datumBlock(b.datum)}
        <span class="row__main"><b>${esc(b.raum ? 'Raum ' + b.raum : (b.ressourcen || []).map(r => r.name + (r.menge > 1 ? ' ×' + r.menge : '')).join(', ') || b.artName || 'Buchung')}</b>
          <i>${esc(datumKurz(b.datum))} · ${esc(stunden(b.stundeVon, b.stundeBis))}${b.beginn ? ` (${esc(b.beginn)}–${esc(b.ende)})` : ''}${b.serie ? ' · Serie' : ''}</i>
          ${b.titel ? `<span class="sf-text">${esc(b.titel)}</span>` : ''}</span>
        <button class="knopf knopf--still sf-klein" type="button" data-id="${b.id}" data-serie="${b.serie ? 1 : 0}">Stornieren</button>
      </div>`).join('')) : leer('Keine Buchungen', 'Sie haben keine anstehenden Buchungen.');
    $$('[data-id]', el).forEach(b => b.addEventListener('click', async () => {
      const knoepfe = [{ label:'Diesen Termin stornieren', wert:'eins', rot:true }];
      if (b.dataset.serie === '1') knoepfe.push({ label:'Ganze Serie stornieren', wert:'serie', rot:true });
      const a = await E.sptBlatt({ titel:'Buchung stornieren?', text:'Der Raum bzw. das Gerät wird wieder frei.', knoepfe });
      if (!a) return;
      try {
        const r = await web('buchen/' + b.dataset.id + (a.wert === 'serie' ? '?serie=true' : ''), 'DELETE');
        buzz(); toast((r && r.storniert > 1) ? `${r.storniert} Termine storniert` : 'Storniert'); zeigen(true);
      } catch (x){ toast('Nicht storniert: ' + x.message); }
    }));
  }
};

/* ---------- Neuigkeiten ---------- */
SEITEN.neuigkeiten = {
  titel:'Neuigkeiten',
  async zeichnen(el, daten){
    const d = await web('infocenter');
    const liste = d.eintraege || [];
    if (d.ungelesen) aktion('Alle als gelesen markieren', async () => {
      try { await web('infocenter/gelesen', 'POST', { schluessel:[], alle:true }); buzz(); zeigen(true); menueZeichnen(); }
      catch (e){ toast(e.message); }
    }, 'check-check');
    untertitel(d.ungelesen ? `${d.ungelesen} ungelesen` : 'Alles gelesen');
    const offen = daten.offen || '';
    el.innerHTML = liste.length ? gruppe('', liste.map(n => `
      <button class="row sf-news${n.gelesen ? '' : ' is-neu'}${n.schluessel === offen ? ' is-offen' : ''}" type="button" data-k="${esc(n.schluessel)}">
        <span class="row__main">
          <span class="sf-news__kopf">${n.gelesen ? '' : '<i class="sf-punkt" aria-label="ungelesen"></i>'}<b>${esc(n.titel)}</b></span>
          <i>${esc([n.kategorie || (n.art === 'neuigkeit' ? 'Neu in EduOrga' : 'Schule'), n.datum ? datumLang(n.datum) : ''].filter(Boolean).join(' · '))}${n.wichtig ? ' · wichtig' : ''}</i>
          <span class="sf-news__text">${n.text ? `<span class="sf-text">${esc(n.text)}</span>` : ''}${(n.punkte || []).length ? `<ul>${n.punkte.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}</span>
        </span>
      </button>`).join('')) : leer('Keine Neuigkeiten', 'Es gibt derzeit keine Informationen.');
    $$('[data-k]', el).forEach(b => b.addEventListener('click', async () => {
      const k = b.dataset.k;
      daten.offen = daten.offen === k ? '' : k;
      b.classList.toggle('is-offen', daten.offen === k);
      $$('.sf-news.is-offen', el).forEach(x => { if (x !== b) x.classList.remove('is-offen'); });
      if (b.classList.contains('is-neu')){
        b.classList.remove('is-neu');
        const p = b.querySelector('.sf-punkt'); if (p) p.remove();
        web('infocenter/gelesen', 'POST', { schluessel:[k], alle:false }).then(menueZeichnen).catch(() => {});
      }
    }));
  }
};

/* ---------- Profil und Benachrichtigungen ---------- */
SEITEN.profil = {
  titel:'Profil', kurz:'Profil',
  async zeichnen(el){
    const p = await web('profil');
    el.innerHTML = gruppe('Konto', `
        <div class="row"><span class="row__main"><b>${esc(p.anzeigename || p.login)}</b><i>${esc(p.login)} · ${esc(p.rolle || '')}${p.element ? ' · ' + esc(p.element) : ''}</i></span><span></span><span></span></div>
        ${p.letzteAnmeldung ? `<div class="row"><span class="row__main"><b>Letzte Anmeldung</b><i>${esc(String(p.vorherigeAnmeldung || p.letzteAnmeldung).replace('T', ' '))}</i></span><span></span><span></span></div>` : ''}`)
      + `<h2 class="gruppe__titel">Benachrichtigungen</h2>
      <form class="sf-form sf-form--karte">
        ${feld('E-Mail-Adresse', `<input type="email" name="email" value="${esc(p.email || '')}" autocomplete="email" placeholder="name@schule.de">`, 'An diese Adresse gehen Benachrichtigungen.')}
        <label class="row row--switch sf-schalter"><span class="row__main"><b>Bei neuen Mitteilungen per E-Mail benachrichtigen</b></span><input type="checkbox" name="benachrichtigung"${p.benachrichtigung ? ' checked' : ''}><span class="switch" aria-hidden="true"></span></label>
        <button class="knopf knopf--primaer knopf--gross" type="submit">Speichern</button>
      </form>
      ${p.ical ? gruppe('Kalender', `<button class="row row--nav" type="button" id="sfIcal"><span class="row__main"><b>Stundenplan als Kalender (iCal)</b><i>Adresse kopieren und im Kalender abonnieren</i></span><span></span>${sym('chevron-right', 'ico--chev2')}</button>`) : ''}
      <p class="sf-fuss">Benachrichtigungen zu Änderungen im eigenen Plan schalten Sie unter „${rolle().kollegium ? 'Schule' : 'Mehr'}“ → App ein.</p>`;
    const f = $('form', el);
    f.addEventListener('submit', async e => {
      e.preventDefault();
      try { await web('profil', 'PUT', { email:f.email.value.trim(), sprache:p.sprache || 'Deutsch', benachrichtigung:f.benachrichtigung.checked }); buzz(); toast('Gespeichert'); }
      catch (x){ toast('Nicht gespeichert: ' + x.message); }
    });
    const ical = $('#sfIcal');
    if (ical) ical.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(p.ical); toast('Kalenderadresse kopiert'); }
      catch (e){ toast(p.ical); }
    });
  }
};

/* ---------- Über EduOrga Mobile ---------- */
SEITEN.about = {
  titel:'Über EduOrga Mobile', kurz:'Über',
  zeichnen(el){
    const B = window.TT_BOOT || {};
    el.innerHTML = `
      <div class="sf-about">
        <svg class="sf-about__logo" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="12" fill="#164c55"/><path d="M18 14h28v6H24v9h14v6H24v9h22v6H18z" fill="#ffffff"/><rect x="41" y="29" width="6" height="6" fill="#7fc9c9"/></svg>
        <p class="sf-about__wort"><b>Edu</b>Orga <span>Mobile</span></p>
        <p class="sf-about__slogan">Einfach mehr Schulalltag.</p>
      </div>
      ${gruppe('', `
        <div class="row"><span class="row__main"><b>Fassung</b></span><span class="row__hint">${esc(E.build())}</span><span></span></div>
        ${B.school ? `<div class="row"><span class="row__main"><b>Schule</b></span><span class="row__hint">${esc(B.school)}</span><span></span></div>` : ''}
        <div class="row"><span class="row__main"><b>Daten</b><i>aus EduOrga Web der Schule</i></span><span></span><span></span></div>`)}
      <h2 class="gruppe__titel">Rechtlicher Hinweis</h2>
      <p class="sf-recht">EduOrga ist ein privates Hobbyprojekt eines Auszubildenden zum Fachinformatiker für Systemintegration, entwickelt mit
        Unterstützung von Claude (Anthropic). Jede Schule bzw. jeder Betreiber ist für Einsatz, Betrieb und Datenschutz selbst verantwortlich.</p>
      <h2 class="gruppe__titel">Lizenzen</h2>
      <p class="sf-recht">Schrift IBM Plex Sans (SIL Open Font License 1.1), Symbole Lucide (ISC-Lizenz).</p>`;
  }
};

/* ---------------------------------------------------------------------
   Start
   --------------------------------------------------------------------- */
window.EDOSchule = { oeffnen, neuZeichnen, menueZeichnen, seiten: SEITEN };
menueZeichnen();
})();
