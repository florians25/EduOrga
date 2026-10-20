/* =====================================================================
   ansichten.js — EduOrga Mobile: „Heute“ und „Agenda“ wie die iOS-App
   ---------------------------------------------------------------------
   Vorbild sind die SwiftUI-Quellen ios/UntPlanNext/Neu/Heute/* und
   Neu/Plan/Agenda.swift (design/DESIGN.md, Abschnitt 10.1 „Heute“):
   ruhiges Tagesbriefing – Kopf (Wochentag und Datum, darunter Woche und
   KW, keine Begrüßung), Tagesband, Fokuskarte „Jetzt“/„Als Nächstes“,
   Tageszahlen (nur Werte über null), Notizen der Schule, Stunden als
   Stundenkarten v7, Kalender (nächste Ferien, Feiertage) bzw. in den
   Ferien die Ferienfläche mit dem nächsten Schultag, unten „Stand EduOrga
   Studio“. Daten: eigener Wochenplan (app.js) und GET api/web/heute
   (EduOrga Web /api/app/heute, Feld kalender). Agenda: die Woche als
   Liste, je Tag links Datum und Wochentag, rechts je Stunde eine Zeile.
   Barrierefreiheit: jede Zeile ein Knopf mit ganzem Satz (aria-label),
   Grafiken als ein Element mit Satz, Farben nur über Thema-Variablen.
   ===================================================================== */
(() => {
'use strict';
const E = window.EDO;
if (!E) return;
const { state, esc } = E;
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const API = new URL('api/web/', location.href).href;

/* ---------------------------------------------------------------------
   Datum und Zeit
   --------------------------------------------------------------------- */
const WT_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const plus = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const tageZwischen = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const lang = s => { const d = parse(s); return `${WT_LANG[d.getDay()]}, ${d.getDate()}. ${MONATE[d.getMonth()]}`; };
const tagMonat = s => { const d = parse(s); return `${d.getDate()}.${d.getMonth() + 1}.`; };
const kurz = s => { const d = parse(s); return `${WT[d.getDay()]} ${tagMonat(s)}`; };
const minuten = t => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? +m[1] * 60 + +m[2] : null; };
const uhr = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
const jetztMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; };
const dauer = m => m < 60 ? `${m} Min.` : `${Math.floor(m / 60)} Std. ${m % 60 ? (m % 60) + ' Min.' : ''}`.trim();

function familie(){
  const r = (state.user && state.user.rolle) || '';
  return !!state.isStudent || r === 'schueler' || r === 'eltern' || !!(state.user && state.user.familie);
}
const kollegium = () => !familie();

/* Beginn und Ende einer Karte in Minuten (Aufsichten mit eigener Uhrzeit). */
function zeiten(c){
  const t = state.times || {};
  const a = minuten(c.from) ?? minuten((t[c.lesson] || {}).start);
  const b = minuten(c.to) ?? minuten((t[c.lesson + Math.max(1, c.span || 1) - 1] || {}).end);
  return { von: a ?? 0, bis: b ?? (a ?? 0) + 45 };
}

/* ---------------------------------------------------------------------
   Stundenkarte v7 im Kleinen (Heute, Agenda)
   --------------------------------------------------------------------- */
const istAufsicht = c => !!(c._supervision || c._pause || c.blockType === 'supervision');
const istFeld = c => !!(c.overlay || c.holiday || c.blockType === 'holiday');
const istEntfall = c => c.blockType === 'cancelled' || c.blockType === 'class-absent';
const istOffen = c => !istEntfall(c) && !!(c.openSub || c.teacherOpen)
  && (c.changed || []).every(k => k === 'teacher' || (k === 'room' && c.openRoom));
function art(c){
  if (istEntfall(c)) return 'ent';
  if (c.blockType === 'klausur') return 'pr';
  if (['event', 'gs', 'absence'].includes(c.blockType)) return 'ev';
  if (c.blockType === 'standby') return 'still';
  if (istOffen(c)) return 'offen';
  if (c.blockType === 'change' || (c.changed || []).length) return 'aend';
  return 'normal';
}
/* Ganztägiger Termin (Elternsprechtag, Projekttag): ohne Stunde, über den ganzen Tag */
const ganztaegig = c => !!c.fullday || (['event', 'gs', 'absence'].includes(c.blockType) && (c.span || 1) >= 6);
const findetStatt = c => !istEntfall(c) && !istFeld(c) && !istAufsicht(c) && c.blockType !== 'standby' && !ganztaegig(c);
const fachfarbe = c => (c.color && /^#?[0-9a-f]{6}$/i.test(c.color)) ? (c.color[0] === '#' ? c.color : '#' + c.color) : '';
/* Farbe des Streifens oben: Status vor Fachfarbe; regulär ohne Fachfarbe und offen ohne Streifen. */
function streifen(c){
  const a = art(c);
  if (a === 'aend') return 'var(--st-aenderung)';
  if (a === 'ent') return 'var(--st-entfall)';
  if (a === 'pr') return 'var(--up-pruefung-streifen, #b7791f)';
  if (a === 'normal') return fachfarbe(c);
  return '';
}

/* Ein geänderter Wert: „neu (b̶i̶s̶h̶e̶r̶)“ grün 600, neu hinzugekommen „neu B070“. */
function wert(neu, alt, geaendert){
  const n = String(neu || '').trim(), a = String(alt || '').trim();
  if (!geaendert) return n ? `<span>${esc(n)}</span>` : '';
  if (n && a && n.toUpperCase() !== a.toUpperCase()) return `<span class="h-gr">${esc(n)} (<s>${esc(a)}</s>)</span>`;
  if (n) return `<span class="h-gr">${esc(n)}</span>`;
  return a ? `<span class="h-offen">${esc(a)} fehlt</span>` : '';
}
/* Zweite Zeile: Klasse bzw. Lehrkraft (nach Planart) und Raum. */
function nebenzeile(c, kind){
  const ch = c.changed || [];
  const teile = [];
  const lehrerplan = kind === 'teacher';
  if (lehrerplan || kind === 'room') teile.push(wert(c.class, c.classOrig, ch.includes('class')));
  if (!lehrerplan){
    if ((c.openSub || c.teacherOpen) && !istEntfall(c)) teile.push(familie() ? '<span class="h-offen">Vertretung folgt</span>'
      : `<span class="h-offen">${esc(c.teacherOrig || c.teacher || '?')} fehlt</span>`);
    else teile.push(wert(c.teacher, c.teacherOrig, ch.includes('teacher')));
  } else if ((c.openSub || c.teacherOpen) && !istEntfall(c) && c.teacherOrig) {
    teile.push(`<span class="h-offen">${esc(c.teacherOrig)} fehlt</span>`);
  } else if (ch.includes('teacher') && c.teacherOrig) {
    teile.push(wert(c.teacher, c.teacherOrig, true));
  }
  if (kind !== 'room') teile.push(wert(c.room, c.roomOrig, ch.includes('room') && !c.openRoom));
  return teile.filter(Boolean).join('');
}
function fachHtml(c){
  const f = c.subject || c.subjectOrig || c.class || '·';
  if ((c.changed || []).includes('subject') && c.subjectOrig && c.subjectOrig !== c.subject)
    return `<span class="h-gr">${esc(f)} (<s>${esc(c.subjectOrig)}</s>)</span>`;
  return esc(f);
}
/* Rechts in der Zeile: „entfällt“ bzw. „verlegt …“, „PRÜFUNG“, „jetzt“. */
function rechts(c, laeuft){
  const sf = window.UntPlanAenderung && window.UntPlanAenderung.statusFeld ? window.UntPlanAenderung.statusFeld(c) : null;
  if (sf) return `<span class="h-status h-status--${sf.ton}">${esc(sf.text)}</span>`;
  if (istEntfall(c)) return '<span class="h-status h-status--entfall">entfällt</span>';
  if (laeuft) return '<span class="h-status h-status--jetzt">jetzt</span>';
  if (c.blockType === 'klausur') return '<span class="h-wort">Prüfung</span>';
  return '';
}
/* Satz für Bildschirmleser: „3. Stunde, 9:50 bis 10:35, Französisch, 7b, Lehrkraft SNE statt WAG, Raum R112, geändert.“ */
function satz(c, z){
  const teile = [];
  if (c.lesson && !istAufsicht(c)) teile.push(`${c.lesson}. Stunde`);
  teile.push(`${uhr(z.von)} bis ${uhr(z.bis)} Uhr`);
  teile.push(c.subjectLong || c.subject || c.type || '');
  if (c.class) teile.push(c.classOrig && c.classOrig !== c.class ? `Klasse ${c.class} statt ${c.classOrig}` : `Klasse ${c.class}`);
  if (c.openSub || c.teacherOpen) teile.push(familie() ? 'Vertretung folgt' : `Lehrkraft ${c.teacherOrig || ''} fehlt, Vertretung folgt`);
  else if (c.teacher) teile.push(c.teacherOrig && c.teacherOrig !== c.teacher ? `Lehrkraft ${c.teacher} statt ${c.teacherOrig}` : `Lehrkraft ${c.teacher}`);
  if (c.room) teile.push(c.roomOrig && c.roomOrig !== c.room ? `Raum ${c.room} statt ${c.roomOrig}` : `Raum ${c.room}`);
  const a = art(c);
  if (a === 'ent') teile.push((window.UntPlanAenderung?.statusFeld?.(c) || {}).text || 'entfällt');
  if (a === 'aend') teile.push('geändert');
  if (a === 'pr') teile.push('Prüfung');
  return teile.filter(Boolean).join(', ') + '.';
}

/* ---------------------------------------------------------------------
   Daten von „Heute“ (api/web/heute) – höchstens alle 60 Sekunden
   --------------------------------------------------------------------- */
let heuteDaten = null, heuteZeit = 0, heuteLauf = null;
async function heuteHolen(frisch){
  if (!frisch && heuteDaten && Date.now() - heuteZeit < 60000) return heuteDaten;
  if (heuteLauf) return heuteLauf;
  heuteLauf = (async () => {
    try {
      const r = await fetch(API + 'heute', { credentials: 'same-origin', cache: 'no-store' });
      const d = r.ok ? await r.json() : null;
      if (d && d.ok !== false){ heuteDaten = d; heuteZeit = Date.now(); try { localStorage.setItem('tt.heute', JSON.stringify(d)); } catch (e) { /* privat */ } }
    } catch (e){
      /* ohne Netz: der zuletzt gesehene Stand */
      if (!heuteDaten) try { heuteDaten = JSON.parse(localStorage.getItem('tt.heute') || 'null'); } catch (x) { heuteDaten = null; }
    } finally { heuteLauf = null; }
    return heuteDaten;
  })();
  return heuteLauf;
}
/* Woche des nächsten Schultags nachladen, wenn er außerhalb der geladenen zwei Wochen liegt (lange Ferien). */
const extraWochen = {};
async function wocheFuer(tag){
  const mo = iso(plus(parse(tag), -((parse(tag).getDay() + 6) % 7)));
  if (extraWochen[mo]) return extraWochen[mo];
  try { const w = await E.eigeneWoche(mo); extraWochen[mo] = (w && w.byDate) || {}; } catch (e){ extraWochen[mo] = {}; }
  return extraWochen[mo];
}

/* ---------------------------------------------------------------------
   Bausteine von „Heute“
   --------------------------------------------------------------------- */
function kopfHtml(heuteIso, h, frei){
  const zusatz = [];
  if (!frei && h && String(h.datum || '').slice(0, 10) === heuteIso && h.woche) zusatz.push(h.woche.length === 1 ? h.woche + '-Woche' : h.woche);
  zusatz.push('KW ' + E.isoWeek(parse(heuteIso)));
  if (frei) zusatz.push(frei.name || 'Ferien');
  return `<header class="h-kopf" role="heading" aria-level="2"><b>${esc(lang(heuteIso))}</b><span>${esc(zusatz.join(' · '))}</span></header>`;
}

/* Tagesband: der Schultag als Leiste, je Stunde ein Abschnitt nach seiner Dauer, Jetzt-Linie, Aufsichten als Marke. */
function bandHtml(karten, istHeute){
  /* ohne ganztägige Termine (wie iOS) – sie stehen als Zeile in den Stunden */
  const stunden = karten.filter(c => !istAufsicht(c) && !istFeld(c) && !ganztaegig(c)).map(c => ({ c, z: zeiten(c) }))
    .filter(x => x.z.bis > x.z.von).sort((a, b) => a.z.von - b.z.von);
  if (!stunden.length) return '';
  /* gleichzeitige Stunden zusammenfassen: Änderung vor regulär */
  const rang = c => ({ aend: 6, offen: 5, pr: 4, normal: 3, ev: 2, still: 1, ent: 0 })[art(c)] ?? 3;
  const gruppen = [];
  for (const x of stunden){
    const g = gruppen[gruppen.length - 1];
    if (g && x.z.von < g.bis){ g.liste.push(x); g.bis = Math.max(g.bis, x.z.bis); }
    else gruppen.push({ von: x.z.von, bis: x.z.bis, liste: [x] });
  }
  const start = gruppen[0].von, ende = Math.max(...gruppen.map(g => g.bis));
  const pos = m => ((m - start) / Math.max(1, ende - start) * 100).toFixed(2) + '%';
  const breite = (a, b) => ((b - a) / Math.max(1, ende - start) * 100).toFixed(2) + '%';
  const jetzt = istHeute ? jetztMin() : null;
  let html = '', zaehl = { aend: 0, ent: 0, offen: 0, pr: 0 }, laufendNr = '';
  for (const g of gruppen){
    const vorn = g.liste.map(x => x.c).sort((a, b) => rang(b) - rang(a))[0];
    const a = art(vorn);
    if (zaehl[a] !== undefined) zaehl[a]++;
    const nrs = g.liste.map(x => x.c.lesson).filter(Boolean);
    const nr = nrs.length ? (Math.max(...g.liste.map(x => x.c.lesson + Math.max(1, x.c.span || 1) - 1)) > Math.min(...nrs)
      ? `${Math.min(...nrs)}–${Math.max(...g.liste.map(x => x.c.lesson + Math.max(1, x.c.span || 1) - 1))}` : `${Math.min(...nrs)}`) : '';
    const vorbei = jetzt !== null && g.bis <= jetzt;
    const laeuft = jetzt !== null && g.von <= jetzt && jetzt < g.bis;
    if (laeuft) laufendNr = nr;
    html += `<i class="h-seg h-seg--${a}${vorbei ? ' is-vorbei' : ''}${laeuft ? ' is-jetzt' : ''}" style="left:calc(${pos(g.von)} + 1px);width:calc(${breite(g.von, g.bis)} - 2px)"></i>`
         + (nr ? `<span class="h-nr${laeuft ? ' is-jetzt' : ''}" style="left:${pos(g.von)};width:${breite(g.von, g.bis)}">${nr}</span>` : '');
  }
  for (const c of karten.filter(istAufsicht)){
    const z = zeiten(c);
    if (z.bis <= start || z.von >= ende) continue;
    html += `<i class="h-aufsicht${(c._supSub) ? ' is-aend' : ''}" style="left:${pos(Math.max(start, z.von))};width:${breite(Math.max(start, z.von), Math.min(ende, z.bis))}"></i>`;
  }
  let randLinks = `<span class="h-bandzeit" style="left:0">${uhr(start)}</span>`, randRechts = `<span class="h-bandzeit h-bandzeit--rechts">${uhr(ende)}</span>`;
  if (jetzt !== null && jetzt >= start && jetzt <= ende){
    const anteil = (jetzt - start) / (ende - start);
    html += `<i class="h-jetzt" style="left:${pos(jetzt)}"></i><span class="h-jetztzeit" style="left:clamp(18px, ${pos(jetzt)}, calc(100% - 18px))">${uhr(Math.floor(jetzt))}</span>`;
    if (anteil < 0.16) randLinks = '';
    if (anteil > 0.84) randRechts = '';
  }
  let text = `Schultag ${uhr(start)} bis ${uhr(ende)} Uhr, ${gruppen.length === 1 ? '1 Abschnitt' : gruppen.length + ' Abschnitte'}`;
  if (zaehl.aend) text += `, ${zaehl.aend} geändert`;
  if (zaehl.ent) text += zaehl.ent === 1 ? ', 1 entfällt' : `, ${zaehl.ent} entfallen`;
  if (zaehl.offen) text += familie() ? `, ${zaehl.offen} Vertretung folgt` : `, ${zaehl.offen} Vertretung offen`;
  if (zaehl.pr) text += zaehl.pr === 1 ? ', 1 Prüfung' : `, ${zaehl.pr} Prüfungen`;
  text += '.' + (laufendNr ? ` Jetzt ${laufendNr}. Stunde.` : '');
  return `<button type="button" class="h-band" data-tag-plan aria-label="${esc(text)}" title="Den Tag im Plan öffnen">${randLinks}${randRechts}<span class="h-bandflaeche">${html}</span></button>`;
}

/* Fokuskarte: laufende bzw. nächste Stunde (heute) oder die erste des nächsten Schultags. */
function fokusLage(karten, istHeute, naechster){
  const stunden = karten.filter(findetStatt).map(c => ({ c, z: zeiten(c) })).sort((a, b) => a.z.von - b.z.von);
  if (istHeute){
    const m = jetztMin();
    const lauf = stunden.find(x => x.z.von <= m && m < x.z.bis);
    if (lauf) return { ...lauf, laeuft: true };
    const next = stunden.find(x => x.z.von > m);
    if (next) return { ...next, laeuft: false };
  } else if (stunden.length) return { ...stunden[0], laeuft: false, datum: stunden[0].c.date };
  if (naechster && naechster.karten){
    const n = naechster.karten.filter(findetStatt).map(c => ({ c, z: zeiten(c) })).sort((a, b) => a.z.von - b.z.von)[0];
    if (n) return { ...n, laeuft: false, datum: naechster.datum };
  }
  return null;
}
function fokusHtml(f, kind){
  if (!f) return '';
  const c = f.c, m = jetztMin();
  const wort = f.laeuft ? 'Jetzt' : 'Als Nächstes';
  let rest;
  if (f.datum) rest = [WT_LANG[parse(f.datum).getDay()], uhr(f.z.von)];
  else if (f.laeuft) rest = ['noch', dauer(Math.ceil(f.z.bis - m))];
  else { const bis = Math.ceil(f.z.von - m); rest = bis <= 90 ? ['in', dauer(bis)] : ['ab', uhr(f.z.von)]; }
  const farbe = f.laeuft && art(c) === 'normal' ? 'var(--up-akzent)' : streifen(c);
  const fach = c.subjectLong || c.subject || c.type || '';
  const anteil = f.laeuft ? Math.min(1, Math.max(0, (m - f.z.von) / Math.max(1, f.z.bis - f.z.von))) : 0;
  const ziel = kollegium() && f.c.entryId && !f.datum;
  const gesprochen = `${wort}, ${f.datum ? lang(f.datum) + ', ' + uhr(f.z.von) + ' Uhr' : rest.join(' ')}. ${satz(c, f.z)}`;
  return `<section class="h-flaeche h-fokus">
    ${farbe ? `<i class="h-streifen" style="background:${farbe}"></i>` : ''}
    <button type="button" class="h-fokus__haupt" data-oeffnen="${esc(c.date)}|${c.lesson}|${c._uid ?? ''}" aria-label="${esc(gesprochen)}">
      <span class="h-fokus__kopf"><b class="${f.laeuft ? 'is-jetzt' : ''}">${wort}</b>${c.lesson ? `<span> · ${c.lesson}. Std.</span>` : ''}</span>
      <span class="h-fokus__fach">${esc(fach)}</span>
      <span class="h-fokus__ang">${nebenzeile(c, kind)}</span>
      <span class="h-fokus__rest"><small>${esc(rest[0])}</small><b class="${f.laeuft ? 'is-jetzt' : ''}">${esc(rest[1])}</b></span>
      ${f.laeuft ? `<span class="h-fort" aria-hidden="true"><i style="width:${(anteil * 100).toFixed(1)}%"></i></span><span class="h-fortzeit" aria-hidden="true"><span>${uhr(f.z.von)}</span><span>${uhr(f.z.bis)}</span></span>`
        : `<span class="h-fokus__zeit">${uhr(f.z.von)}–${uhr(f.z.bis)}${rechts(c, false) ? ' ' + rechts(c, false) : ''}</span>`}
    </button>
    ${ziel ? `<button type="button" class="h-aktion" data-klassenbuch="${esc(c.date)}|${c.lesson}|${c._uid ?? ''}"><b>Klassenbuch erfassen</b>${E.sym('chevron-right', 'ico--chev2')}</button>` : ''}
  </section>`;
}

/* Tageszahlen: höchstens vier Werte über null, getrennt durch feine Linien. */
function zahlenHtml(h, heuteKarten){
  const z = [];
  const geaendert = heuteKarten.filter(c => !istAufsicht(c) && !istFeld(c) && ['aend', 'ent', 'offen'].includes(art(c))).length;
  z.push({ id: 'aenderungen', n: geaendert, t: geaendert === 1 ? 'Änderung' : 'Änderungen', ton: 'aend', s: geaendert === 1 ? '1 geänderte Stunde' : `${geaendert} geänderte Stunden` });
  if (kollegium()){
    const offen = (h && h.offeneStunden) || 0;
    z.push({ id: 'klassenbuch', n: offen, t: 'Klassenbuch offen', ton: 'warn', s: offen === 1 ? '1 Klassenbuch-Eintrag offen' : `${offen} Klassenbuch-Einträge offen` });
    const auf = heuteKarten.filter(istAufsicht).length || ((h && h.aufsichten) || []).length;
    z.push({ id: 'aufsichten', n: auf, t: auf === 1 ? 'Aufsicht' : 'Aufsichten', s: auf === 1 ? '1 Pausenaufsicht heute' : `${auf} Pausenaufsichten heute` });
  } else {
    const morgen = iso(plus(new Date(), 1));
    const ha = ((h && h.hausaufgaben) || []).filter(x => String(x.faellig || '').slice(0, 10) === morgen).length;
    z.push({ id: 'hausaufgaben', n: ha, t: 'Hausaufgaben morgen', s: ha === 1 ? '1 Hausaufgabe für morgen' : `${ha} Hausaufgaben für morgen` });
  }
  const neu = (h && h.ungelesen) ?? state.ungelesen ?? 0;
  z.push({ id: 'postfach', n: neu, t: neu === 1 ? 'Neue Nachricht' : 'Neue Nachrichten', ton: 'akzent', s: neu === 1 ? '1 neue Nachricht' : `${neu} neue Nachrichten` });
  const ter = ((h && h.termine) || []).length;
  z.push({ id: 'termine', n: ter, t: ter === 1 ? 'Termin' : 'Termine', s: ter === 1 ? '1 Termin' : `${ter} Termine` });
  const liste = z.filter(x => x.n > 0).slice(0, 4);
  if (!liste.length) return '';
  return `<div class="h-flaeche h-zahlen" role="group" aria-label="Tageszahlen">${liste.map(x =>
    `<button type="button" class="h-zahl" data-zahl="${x.id}" aria-label="${esc(x.s)}"><b class="${x.ton ? 'is-' + x.ton : ''}">${x.n}</b><span>${esc(x.t)}</span></button>`).join('')}</div>`;
}

/* Notizen der Schule: höchstens zwei stille gelbe Notizen, darunter „Alle n Hinweise der Schule“. */
function infos(h, notizen){
  const liste = [];
  for (const n of (h && h.nachrichten) || []){
    const i = n.indexOf(': ');
    liste.push(i > 0 && i <= 60 ? { titel: n.slice(0, i), text: n.slice(i + 2) } : { titel: 'Mitteilung', text: n });
  }
  for (const e of (h && h.ereignisse) || []){
    let t = e.ganztaegig ? 'Ganztägig' : (e.von === e.bis ? `${e.von}. Stunde` : `${e.von}.–${e.bis}. Stunde`);
    if ((e.klassen || []).length) t += ' · ' + e.klassen.join(', ');
    liste.push({ titel: e.titel || e.art || 'Veranstaltung', text: t });
  }
  for (const x of (h && h.hinweise) || []) liste.push({ titel: 'Hinweis', text: x });
  if (!h) for (const x of notizen || []) liste.push({ titel: 'Mitteilung', text: x });
  return liste;
}
let alleNotizen = false;
function notizenHtml(liste){
  if (!liste.length) return '';
  const zeigen = alleNotizen ? liste : liste.slice(0, 2);
  return `<div class="h-notizen">${zeigen.map(i => `<div class="h-notiz" role="note"><b>${esc(i.titel)}</b><span>${esc(i.text)}</span></div>`).join('')}
    ${liste.length > 2 ? `<button type="button" class="h-link" data-alle-notizen>${alleNotizen ? 'Weniger anzeigen' : `Alle ${liste.length} Hinweise der Schule`}</button>` : ''}</div>`;
}

/* Stunden des Tages als Karten v7 mit Beginn und Ende links. */
function stundenHtml(karten, titel, istHeute, kind, tagIso){
  const liste = karten.filter(c => !istAufsicht(c) && !istFeld(c)).map(c => ({ c, z: zeiten(c) })).sort((a, b) => a.z.von - b.z.von || (a.c.lesson - b.c.lesson));
  if (!liste.length) return '';
  const m = jetztMin();
  return `<section class="h-abschnitt-block"><h2 class="h-abschnitt">${esc(titel)}<button type="button" class="h-link" data-tag-plan="${esc(tagIso)}">Im Plan</button></h2>
    <div class="h-stunden">${liste.map(({ c, z }) => {
      const vorbei = istHeute && z.bis <= m, laeuft = istHeute && findetStatt(c) && z.von <= m && m < z.bis;
      const a = art(c), s = streifen(c);
      return `<button type="button" class="h-zeile${vorbei ? ' is-vorbei' : ''}" data-oeffnen="${esc(c.date)}|${c.lesson}|${c._uid ?? ''}"
          aria-label="${esc((laeuft ? 'Läuft gerade. ' : vorbei ? 'Vorbei. ' : '') + satz(c, z))}">
        <span class="h-zeit">${ganztaegig(c) ? '<small>ganztägig</small>' : `<b class="${laeuft ? 'is-jetzt' : ''}">${uhr(z.von)}</b><small>${uhr(z.bis)}</small>`}</span>
        <span class="h-karte h-karte--${a}${laeuft ? ' is-jetzt' : ''}">${s ? `<i class="h-streifen" style="background:${s}"></i>` : ''}
          <span class="h-karte__haupt"><b class="h-fach">${a === 'ev' ? esc(c.subject || c.type || 'Termin') : fachHtml(c)}</b>
            ${a === 'ev' ? '' : `<span class="h-neben">${nebenzeile(c, kind)}</span>`}</span>
          <span class="h-karte__rechts">${rechts(c, laeuft)}</span>
        </span>
      </button>`;
    }).join('')}</div></section>`;
}

/* Ferienfläche (heute frei): Name groß, Zeitraum und Resttage, Verlauf, darunter der nächste Schultag. */
function ferienHtml(frei, heuteIso, schultag, erste){
  const artWort = frei.art === 'feiertag' ? 'Feiertag' : frei.art === 'ferien' ? 'Ferien' : 'Unterrichtsfrei';
  const rest = schultag ? tageZwischen(heuteIso, schultag) : (frei.bis ? tageZwischen(heuteIso, frei.bis) + 1 : null);
  const zeile = [];
  if (frei.bis && frei.bis !== frei.von) { const d = parse(frei.bis); zeile.push(`bis ${WT_LANG[d.getDay()]}, ${tagMonat(frei.bis)}`); }
  if (rest > 1) zeile.push(`noch ${rest} Tage`); else if (rest === 1) zeile.push('morgen wieder Unterricht');
  let verlauf = '';
  if (frei.bis && frei.bis !== frei.von){
    const gesamt = tageZwischen(frei.von, frei.bis) + 1, vorbei = tageZwischen(frei.von, heuteIso);
    verlauf = `<span class="h-fort h-fort--frei" aria-hidden="true"><i style="width:${Math.min(100, Math.max(0, vorbei / gesamt * 100)).toFixed(1)}%"></i></span>`;
  }
  let erstText = '';
  if (erste){ const z = zeiten(erste); erstText = `ab ${uhr(z.von)} · ${[erste.subject, erste.room].filter(Boolean).join(', ')}`; }
  return `<section class="h-flaeche h-ferien"><i class="h-streifen" style="background:var(--st-frei)"></i>
    <div class="h-ferien__kopf"><small>${artWort}</small><b>${esc(frei.name || artWort)}</b>${zeile.length ? `<span>${esc(zeile.join(' · '))}</span>` : ''}${verlauf}</div>
    ${schultag ? `<button type="button" class="h-schultag" data-tag-plan="${esc(schultag)}" aria-label="${esc('Nächster Schultag: ' + lang(schultag) + (erstText ? ', ' + erstText : ''))}">
      <span><small>Nächster Schultag</small><b>${esc(lang(schultag))}</b>${erstText ? `<span>${esc(erstText)}</span>` : ''}</span>${E.sym('chevron-right', 'ico--chev2')}</button>` : ''}
  </section>`;
}

/* Kalender: nächste Ferien und die nächsten Feiertage bzw. freien Tage. */
function kalenderHtml(k){
  if (!k) return '';
  const abstand = t => t < 1 ? 'heute' : t === 1 ? 'morgen' : `in ${t} Tagen`;
  const zr = f => !f.bis || f.bis === f.von ? kurz(f.von) : `${tagMonat(f.von)}–${tagMonat(f.bis)}`;
  const e = [];
  if (k.naechsteFerien) e.push({ t: k.naechsteFerien.name || 'Ferien', z: zr(k.naechsteFerien), a: abstand(tageZwischen(k.heute, k.naechsteFerien.von)), s: 'Nächste Ferien' });
  for (const f of k.freieTage || []) e.push({ t: f.name || 'Unterrichtsfrei', z: zr(f), a: abstand(tageZwischen(k.heute, f.von)), s: f.art === 'feiertag' ? 'Feiertag' : 'Unterrichtsfrei' });
  if (!e.length) return '';
  return `<section class="h-abschnitt-block"><h2 class="h-abschnitt">Kalender</h2><div class="h-flaeche h-liste">${e.map(x =>
    `<div class="h-eintrag" role="text" aria-label="${esc(`${x.s}: ${x.t}, ${x.z}, ${x.a}`)}"><span class="h-eintrag__titel">${esc(x.t)}</span><span class="h-eintrag__zr">${esc(x.z)}</span><b>${esc(x.a)}</b></div>`).join('')}</div></section>`;
}

/* ---------------------------------------------------------------------
   Heute zeichnen
   --------------------------------------------------------------------- */
let letzterKontext = null, uhrTakt = null;
function heute(ctx){
  letzterKontext = ctx || letzterKontext || { byDate: {} };
  zeichnen();
  heuteHolen().then(() => { if (state.screen === 'start') zeichnen(); });
  if (!uhrTakt) uhrTakt = setInterval(() => { if (state.screen === 'start' && !document.hidden) zeichnen(); }, 30000);
}

async function zeichnen(){
  const ziel = $('#heuteInhalt');
  if (!ziel || !letzterKontext) return;
  const ctx = letzterKontext, h = heuteDaten;
  const byDate = ctx.byDate || {};
  Object.entries(byDate).forEach(([, l]) => (l || []).forEach((c, i) => { if (c._uid === undefined) c._uid = i; }));
  const k = h && h.kalender ? h.kalender : null;
  const heuteIso = (k && k.heute) || iso(new Date());
  const kind = E.viewKind(state.entities.find(e => e.type === 'mine') || state.entities[0] || { type: 'mine' });
  const heuteKarten = byDate[heuteIso] || [];
  /* frei: aus kalender bzw. (ältere Server) aus dem Ferienfeld des Plans */
  let frei = k ? k.frei : null;
  if (!k){
    const f = heuteKarten.find(c => c.holiday || c.blockType === 'holiday');
    if (f && ![0, 6].includes(new Date().getDay())) frei = { name: String(f.holidayName || f.subject || 'Ferien').replace(/­/g, ''), von: heuteIso, bis: '', art: 'ferien' };
  }
  const html = [kopfHtml(heuteIso, h, frei)];
  if (ctx.gesperrt && !heuteKarten.length){
    html.push(`<section class="h-flaeche h-hinweis"><b>Nicht freigegeben</b><span>Für diesen Zeitraum ist kein Plan freigegeben.</span></section>`);
  } else if (frei){
    const schultag = (k && k.naechsterSchultag && k.naechsterSchultag !== heuteIso) ? k.naechsterSchultag : '';
    let karten = schultag ? (byDate[schultag] || null) : null;
    if (schultag && !karten) karten = (await wocheFuer(schultag))[schultag] || [];
    (karten || []).forEach((c, i) => { if (c._uid === undefined) c._uid = i; });
    const erste = (karten || []).filter(findetStatt).sort((a, b) => zeiten(a).von - zeiten(b).von)[0];
    html.push(ferienHtml(frei, heuteIso, schultag, erste));
    html.push(zahlenHtml(h, []));
    html.push(notizenHtml(infos(h, (ctx.notes || {})[heuteIso])));
    html.push(kalenderHtml(k));
    if (schultag && karten && karten.length) html.push(stundenHtml(karten, `${WT_LANG[parse(schultag).getDay()]}, ${tagMonat(schultag)}`, false, kind, schultag));
    letzterKontext.quelle = Object.assign({}, byDate, schultag && karten ? { [schultag]: karten } : {});
  } else {
    /* Schultag bzw. Wochenende: gezeigt wird der Tag mit Stunden (heute, sonst der nächste Schultag) */
    let tag = heuteIso;
    if (!heuteKarten.some(c => !istFeld(c))){
      const naechster = (k && k.naechsterSchultag) || Object.keys(byDate).sort().find(d => d > heuteIso && (byDate[d] || []).some(c => !istFeld(c)));
      if (naechster) tag = naechster;
    }
    let karten = byDate[tag];
    if (!karten && tag !== heuteIso) karten = (await wocheFuer(tag))[tag] || [];
    karten = karten || [];
    karten.forEach((c, i) => { if (c._uid === undefined) c._uid = i; });
    const istHeute = tag === heuteIso;
    if (!istHeute && karten.length) html.push(`<p class="h-zusatz">Nächster Schultag: ${esc(lang(tag))}</p>`);
    if (!karten.some(c => !istFeld(c) && !istAufsicht(c))) html.push(`<section class="h-flaeche h-hinweis"><b>Kein Unterricht</b><span>${istHeute ? 'Heute ist kein Unterricht geplant.' : 'An diesem Tag ist kein Unterricht geplant.'}</span></section>`);
    html.push(bandHtml(karten, istHeute));
    /* nach Schulschluss: erste Stunde des nächsten Schultags */
    let naechster = null;
    if (istHeute){
      const d2 = (k && k.naechsterSchultag && k.naechsterSchultag !== heuteIso) ? k.naechsterSchultag
        : Object.keys(byDate).sort().find(d => d > heuteIso && (byDate[d] || []).some(findetStatt));
      if (d2 && byDate[d2]) naechster = { datum: d2, karten: byDate[d2] };
    }
    html.push(fokusHtml(fokusLage(karten, istHeute, naechster), kind));
    html.push(zahlenHtml(h, istHeute ? karten : []));
    html.push(notizenHtml(infos(h, (ctx.notes || {})[tag])));
    html.push(stundenHtml(karten, istHeute ? 'Stunden' : `${WT_LANG[parse(tag).getDay()]}, ${tagMonat(tag)}`, istHeute, kind, tag));
    html.push(kalenderHtml(k));
    letzterKontext.quelle = Object.assign({}, byDate, { [tag]: karten });
  }
  ziel.innerHTML = html.filter(Boolean).join('');
  binden(ziel);
  /* Fuß: Stand EduOrga Studio und Schule */
  const fuss = $('#heuteFuss');
  if (fuss){
    const st = E.studioStandText(ctx.studioStand || (state.week && state.week.studioStand));
    fuss.innerHTML = [st ? `<span class="${st.alt ? 'is-alt' : ''}" title="${esc(st.voll)}">${esc(st.text)}${st.alt ? ' · Daten evtl. nicht aktuell' : ''}</span>` : '',
      esc((window.TT_BOOT && window.TT_BOOT.school) || '')].filter(Boolean).join('<br>');
  }
}

function binden(ziel){
  const quelle = () => (letzterKontext && letzterKontext.quelle) || (letzterKontext && letzterKontext.byDate) || {};
  const teile = s => { const [d, l, u] = String(s).split('|'); return [d, +l, u === '' ? undefined : +u]; };
  $$('[data-oeffnen]', ziel).forEach(b => b.addEventListener('click', () => {
    const [d, l, u] = teile(b.dataset.oeffnen);
    E.showScreen('plan');
    E.openDetail(d, l, u, quelle());
  }));
  $$('[data-klassenbuch]', ziel).forEach(b => b.addEventListener('click', () => {
    const [d, l, u] = teile(b.dataset.klassenbuch);
    E.showScreen('plan');
    E.klassenbuchOeffnen(d, l, u, quelle());
  }));
  $$('[data-tag-plan]', ziel).forEach(b => b.addEventListener('click', () => planTag(b.dataset.tagPlan || (letzterKontext.tag) || iso(new Date()))));
  $$('[data-alle-notizen]', ziel).forEach(b => b.addEventListener('click', () => { alleNotizen = !alleNotizen; zeichnen(); }));
  $$('[data-zahl]', ziel).forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.zahl;
    if (id === 'postfach') { E.showScreen('msg'); return; }
    if (id === 'klassenbuch' && window.EDOSchule) { window.EDOSchule.oeffnen('offen'); return; }
    if (id === 'hausaufgaben' && window.EDOSchule) { window.EDOSchule.oeffnen('hausaufgaben'); return; }
    if (id === 'termine') { const t = $('#btnAppointments'); if (t) t.click(); return; }
    planTag(iso(new Date()));
  }));
}

/* Tag im Plan öffnen (Tagesansicht). */
function planTag(tag){
  const t = String(tag || '').slice(0, 10) || iso(new Date());
  const mo = iso(plus(parse(t), -((parse(t).getDay() + 6) % 7)));
  E.showScreen('plan');
  if (mo !== state.weekStart){ state.weekStart = mo; state.around = {}; }
  E.setView('day', t);
}

/* „Mehr anzeigen“ (Übersicht) – auf dem Gerät gemerkt */
{
  const k = $('#heuteMehrKnopf'), box = $('#heuteMehr');
  let offen = false;
  try { offen = localStorage.getItem('tt.heuteMehr') === '1'; } catch (e) { /* privat */ }
  const setzen = () => {
    if (!k || !box) return;
    box.hidden = !offen;
    k.setAttribute('aria-expanded', offen ? 'true' : 'false');
    k.querySelector('span').textContent = offen ? 'Weniger anzeigen' : 'Mehr anzeigen';
    k.classList.toggle('is-offen', offen);
  };
  if (k) k.addEventListener('click', () => { offen = !offen; try { localStorage.setItem('tt.heuteMehr', offen ? '1' : '0'); } catch (e) { /* privat */ } setzen(); });
  setzen();
}

/* ---------------------------------------------------------------------
   Agenda: die Woche als Liste (Agenda.swift)
   --------------------------------------------------------------------- */
function agenda(byDate){
  const box = $('#agenda');
  if (!box) return;
  const mo = parse(state.weekStart);
  const tage = [0, 1, 2, 3, 4].map(i => iso(plus(mo, i)));
  const kind = E.viewKind(state.entity || { type: 'mine' });
  const heuteIso = iso(new Date());
  const notizen = (state.week && state.week.notes) || {};
  const m = jetztMin();
  if (state.week && state.week.gesperrt){
    box.innerHTML = `<div class="ag-leer"><b>Für diesen Zeitraum ist kein Plan freigegeben.</b></div>`;
    return;
  }
  box.innerHTML = tage.map(d => {
    const liste = (byDate[d] || []).map((c, i) => { if (c._uid === undefined) c._uid = i; return c; });
    const ferien = liste.find(c => c.holiday || c.blockType === 'holiday');
    const zeilen = liste.filter(c => !istFeld(c)).map(c => ({ c, z: zeiten(c) })).sort((a, b) => (a.c.fullday ? -1 : 0) - (b.c.fullday ? -1 : 0) || a.z.von - b.z.von);
    const dd = parse(d);
    const istHeute = d === heuteIso;
    const inhalt = [];
    if (ferien) inhalt.push(`<div class="ag-ferien"><b>${esc(String(ferien.holidayName || ferien.subject || 'Ferien').replace(/­/g, ''))}</b>${ferien.holidayRange ? `<span>${esc(ferien.holidayRange)}</span>` : ''}</div>`);
    for (const { c, z } of zeilen){
      const a = istAufsicht(c) ? 'auf' : art(c);
      const vorbei = istHeute && z.bis <= m, laeuft = istHeute && findetStatt(c) && z.von <= m && m < z.bis;
      const nr = istAufsicht(c) || !c.lesson || ganztaegig(c) ? '' : ((c.span || 1) > 1 ? `${c.lesson}–${c.lesson + c.span - 1}` : `${c.lesson}`);
      const s = a === 'auf' ? '' : streifen(c);
      inhalt.push(`<button type="button" class="ag-zeile ag-zeile--${a}${vorbei ? ' is-vorbei' : ''}${laeuft ? ' is-jetzt' : ''}" data-ag="${d}|${c.lesson}|${c._uid}"
          aria-label="${esc((laeuft ? 'Läuft gerade. ' : '') + (a === 'auf' ? `Pausenaufsicht ${c.subject || ''}, ${uhr(z.von)} bis ${uhr(z.bis)} Uhr.` : satz(c, z)))}">
        ${s ? `<i class="h-streifen" style="background:${s}"></i>` : ''}
        <span class="ag-nr">${nr}</span>
        <span class="ag-zeit"><span>${ganztaegig(c) ? 'ganz-' : uhr(z.von)}</span><span>${ganztaegig(c) ? 'tägig' : uhr(z.bis)}</span></span>
        <span class="ag-haupt"><b>${a === 'auf' ? 'Aufsicht' : a === 'ev' ? esc(c.subject || c.type || 'Termin') : fachHtml(c)}</b>
          <span class="h-neben">${a === 'auf' ? `<span>${esc(c.subject || '')}</span>` : a === 'ev' ? `<span>${esc([c.class, c.room].filter(Boolean).join(' · '))}</span>` : nebenzeile(c, kind)}</span></span>
        <span class="ag-rechts">${a === 'auf' ? '' : rechts(c, laeuft)}</span>
      </button>`);
    }
    for (const n of notizen[d] || []) inhalt.push(`<div class="ag-notiz" role="note">${esc(n)}</div>`);
    if (!zeilen.length && !ferien) inhalt.push('<div class="ag-keine">Kein Unterricht</div>');
    return `<section class="ag-tag${istHeute ? ' is-heute' : ''}" aria-label="${esc(lang(d))}">
      <button type="button" class="ag-datum" data-ag-tag="${d}" aria-label="${esc(lang(d))} – als Tag öffnen"><b>${dd.getDate()}</b><span>${WT[dd.getDay()]}</span></button>
      <div class="ag-liste">${inhalt.join('')}</div></section>`;
  }).join('');
  $$('[data-ag]', box).forEach(b => b.addEventListener('click', () => {
    const [d, l, u] = b.dataset.ag.split('|');
    E.openDetail(d, +l, +u, state.allByDate || state.week.byDate);
  }));
  $$('[data-ag-tag]', box).forEach(b => b.addEventListener('click', () => E.setView('day', b.dataset.agTag)));
}
/* Waagrecht wischen = andere Woche (wie iOS) */
{
  const box = $('#agenda');
  let x0 = null, y0 = null;
  if (box){
    box.addEventListener('touchstart', e => { if (e.touches.length === 1){ x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; } }, { passive: true });
    box.addEventListener('touchend', e => {
      if (x0 === null) return;
      const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) E.gotoWeek(dx < 0 ? 1 : -1);
    }, { passive: true });
  }
}

window.EDOAnsichten = { heute, agenda, heuteHolen,
  /* für Tests */ _art: art, _nebenzeile: nebenzeile, _zeiten: zeiten };
})();
