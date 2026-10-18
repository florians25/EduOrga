// Darstellung der Stundenpläne: Raster nach Unterrichtsstunden, Stundenkacheln (Fachfarbe als Tönung, Status als Schraffur, Rahmen
// und Plaketten), Zeitspalte mit Stundennummer und Zeiten, Jetzt-Linie, Veranstaltungsleiste, Stundendetails mit Klassenbuch.
import { e, minuten, jetztMinuten, heuteIso, datumKurz, WOCHENTAGE_KURZ } from './ui.js';

/** Höhe einer Unterrichtsstunde im Raster (Pausen werden nicht maßstäblich dargestellt). */
const ZEILE = 68;

export const STATUSTEXT = {
  geaendert: 'Änderung', offen: 'Vertretung offen', entfall: 'Entfall', abwesend: 'vertreten', klausur: 'Prüfung',
  bereitschaft: 'Bereitschaft', buchung: 'Raumbuchung', vorgemerkt: 'vorgemerkt', veranstaltung: 'Veranstaltung',
};

/** Allgemeiner Status (die interne Vertretungsart wird im Web bewusst nicht angezeigt). */
export function statusText(k) {
  if (k.zusaetzlich && k.status === 'geaendert') return ZUSATZ_TEXT;
  return STATUSTEXT[k.status] ?? '';
}

/** Zusätzliche Stunde (zusätzlicher Unterricht, Sondereinsatz, Verlegung hierher …) – Marker „+“ statt Änderungsquadrat. */
const istZusatz = k => k.status === 'veranstaltung' || (k.status === 'geaendert' && !istVerlegung(k) && (k.zusaetzlich || /sondereinsatz|zusatz|mitbetreuung/i.test(k.art || '')));
/** Verlegte Stunde (hierher verlegt bzw. von hier weg verlegt): eigenes Verlegungssymbol statt „+“ bzw. Entfall-Dreieck. */
const istVerlegung = k => !!k.verlegung || /verleg|statt/i.test(k.art || '') || !!k.nach;
/**
 * Richtung der Verlegung (Server-Feld verlegung): "von" = ursprüngliche Stunde (von hier weg verlegt, Pfeil nach rechts),
 * "nach" = Zielstunde (hierher verlegt, Pfeil nach links). Ältere Server ohne das Feld: Entfall = ursprüngliche Stunde.
 */
const verlegungsRichtung = (k, typ) => k.verlegung === 'von' || k.verlegung === 'nach' ? k.verlegung : istEntfall(k, typ) ? 'von' : 'nach';
/** Online-Unterricht: kein Raumlabel auf der Karte, nur das Symbol unten (nicht bei Entfall bzw. abwesend). */
const istOnline = (k, typ) => !!k.online && !istEntfall(k, typ) && k.status !== 'abwesend';
/** Badge bzw. Hinweis einer zusätzlichen Unterrichtsstunde (kein Vertretungstext). */
export const ZUSATZ_TEXT = 'Zusätzl. Unterrichtsstunde';

/** Hover-Text eines geänderten Werts: „B070 → C197“, auch bei Lehrkräften „LAN → ILK“ (erscheint nur beim Überfahren des Werts). */
const wechsel = (alt, neu) => `${alt} → ${neu}`;
/** Hover-Attribute eines geänderten Werts: „alt → neu“ (ohne Durchstreichung). */
const wechselHover = (alt, neu, lehrkraft = false) => `data-hover="${e(wechsel(alt, neu))}" data-hover-alt="${e(alt)}"`;

/**
 * Werte (Klassen, Lehrkräfte, Räume): geänderter Wert petrolfarben unterstrichen, bei offener Vertretung der bisherige Wert
 * durchgestrichen in der Plakette. Der ersetzte alte Wert steht im Hover und in den Stundendetails; bei Entfall erscheinen die
 * ursprünglichen Werte durchgestrichen.
 */
/** Lange Listen kürzen: „BEC, BRA, FIS +12“ (vollständig in den Stundendetails). */
export function gekuerzt(liste, max = 3, entfall = false, lehrkraft = false) {
  const l = liste || [];
  // gekürzt: „+12“ zeigt beim Überfahren die vollständige Liste (grauer Hover)
  return l.length <= max + 1 ? werte(l, entfall, lehrkraft)
    : `${werte(l.slice(0, max), entfall, lehrkraft)} <span class="mehr" data-hover="${e(kuerzelListe(l).join(', '))}" data-hover-art="grau">+${l.length - max}</span>`;
}

const kuerzelListe = l => (l || []).map(w => w.k || w.alt).filter(Boolean);

export function werte(liste, entfall = false, lehrkraft = false) {
  return (liste || []).map(w => wertHtml(w, entfall, lehrkraft)).join(', ');
}

/** Ein Wert: hervorgehoben bei Änderung („alt → neu“ im Hover), „+B070“ bei hinzugefügtem Wert, entfernter Wert durchgestrichen. */
function wertHtml(w, entfall = false, lehrkraft = false) {
  if (entfall) return e(w.alt || w.k);
  if (w.alt && !w.k) return `<span class="lbl weg">${e(w.alt)}</span>`;
  if (!w.k && w.neu) return '<span class="lbl">???</span>';
  if (w.alt) return `<span class="lbl" ${wechselHover(w.alt, w.k, lehrkraft)}>${e(w.k)}</span>`;
  // hinzugefügt (z. B. zusätzlicher Raum): „+“ im Label
  if (w.neu) return `<span class="lbl lbl-plus">+${e(w.k)}</span>`;
  return e(w.k);
}

/** Pille eines Werts im Hover einer gekürzten Liste: neutral, geändert hervorgehoben, abwesend/entfernt durchgestrichen. */
function wertPille(w, entfall = false) {
  if (entfall) return { t: w.alt || w.k };
  if (w.alt && !w.k) return { t: w.alt, a: 'weg' };
  if (!w.k && w.neu) return { t: '???', a: 'neu' };
  if (w.alt) return { t: w.k, a: 'neu' };
  if (w.neu) return { t: `+${w.k}`, a: 'neu' };
  return { t: w.k };
}

/**
 * Liste von Werten in einer Kartenzeile (mehrere Lehrkräfte bzw. Klassen): alle Werte in einer Zeile, was nicht passt, endet mit „…“
 * und „+5“ (Anzahl der ganz verdeckten Werte, nach dem Zeichnen gemessen – listenKuerzen). Hover über die gekürzte Zeile: alle Werte
 * als Pillen. html = Inhalt je Wert, pillen = { t, a } je Wert.
 */
function liste(html, pillen) {
  if (html.length < 2) return html.join('');
  return { liste: true, html: `<span class="z-namen">${html.map((h, i) => `<span class="z-w">${h}${i < html.length - 1 ? ', ' : ''}</span>`).join('')}</span><span class="mehr" hidden></span>`,
    inline: html.join(', '), pillen };
}
const werteListe = (l, entfall = false, lehrkraft = false) => liste((l || []).map(w => wertHtml(w, entfall, lehrkraft)), (l || []).map(w => wertPille(w, entfall)));

function titelText(k) {
  const w = l => (l || []).map(x => x.alt && x.k ? `${x.k} (statt ${x.alt})` : x.k || (x.alt ? `${x.alt} fehlt` : '???')).join(', ');
  return [k.fachName || k.fach || k.text, w([...(k.klassen || []), ...(k.mitklassen || [])]), w(k.lehrer), k.online ? 'findet online statt' : w(k.raeume),
    k.status !== 'regulaer' ? statusText(k) : '', k.fach && k.text].filter(Boolean).join(' · ');
}

/**
 * Lehrkraft abwesend: eigene Stunde der angezeigten Lehrkraft wird von anderen gehalten, bzw. die Bereitschaft einer abwesenden
 * Lehrkraft fällt weg (Lehrer- und Tagesansichten) – gestrichelte Kachel statt Entfall. Der Server liefert dafür lehrerAbwesend.
 * Im Raumplan nie: dort erscheint eine Stunde mit abwesender Lehrkraft wie im Klassenplan als geänderte Kachel.
 */
export const lehrerAbwesend = (k, typ) => k.status === 'abwesend' && (typ === 'lehrer' || (typ !== 'raum' && !!k.lehrerAbwesend));
/** Echter Entfall (schraffiert, durchgestrichen); im Raumplan gilt eine verlegte Stunde weiter als Entfall. */
const istEntfall = (k, typ) => k.status === 'entfall' || (k.status === 'abwesend' && !lehrerAbwesend(k, typ));

/** Ein Wert der Stunde hat sich geändert (Fach, ersetzter, hinzugefügter bzw. entfernter Wert) – wie Karte.WertGeaendert im Server. */
const wertGeaendert = k => !!k.fachAlt || [...(k.klassen || []), ...(k.lehrer || []), ...(k.raeume || []), ...(k.mitklassen || [])].some(w => w.alt || w.neu);
/** Zusätzliche Unterrichtsstunde: alle Lehrkräfte stehen als „+“-Label (hinzugekommen) – das allein ist keine Änderung (Karte.ZusatzWertGeaendert). */
const zusatzWertGeaendert = k => !!k.fachAlt || [...(k.klassen || []), ...(k.zusaetzlich ? [] : k.lehrer || []), ...(k.raeume || []), ...(k.mitklassen || [])].some(w => w.alt || w.neu);

/** „09.10.2026 | 11:30 - 13:00“ – eine Seite einer Verlegung. */
const verlegungsZeit = z => `${datumDe(z.datum)}${z.beginn ? ` | ${z.beginn}${z.ende ? ` - ${z.ende}` : ''}` : ''}`;
/** Hover einer Verlegung: Ursprung → Ziel (ohne Angaben des Servers ein allgemeiner Hinweis). */
const verlegungsText = (k, richtung) => k.verlegungVon && k.verlegungNach ? `${verlegungsZeit(k.verlegungVon)} → ${verlegungsZeit(k.verlegungNach)}`
  : richtung === 'von' ? 'Verlegt (ursprüngliche Stunde)' : 'Verlegung (hierher verlegt)';

/**
 * Plaketten der Kachel (css/karten.css): Verlegung (Ursprung bzw. Ziel, Hover „Ursprung → Ziel“ nur auf der Plakette), Entfall,
 * Prüfung, „+“ bzw. „Termin“ (zusätzliche Stunde, Veranstaltung), Änderung (als Rahmen der Kachel). Prüfung, Zusatzstunde und
 * Zielstunde einer Verlegung zeigen zusätzlich die Änderung, wenn sich ein Wert geändert hat (wie Karte.Marker im Server).
 */
function marker(k, typ) {
  const m = [];
  const verlegt = istVerlegung(k) && k.status !== 'klausur';
  const richtung = verlegt ? verlegungsRichtung(k, typ) : '';
  if (verlegt) m.push(`<i class="mk-verlegung ${richtung} ${richtung === 'von' ? 'weg' : ''}" data-hover="${e(verlegungsText(k, richtung))}"${richtung === 'von' ? ' data-hover-art="rot"' : ''} data-hover-mitte data-hover-klein></i>`);
  else if (istEntfall(k, typ)) m.push('<i class="mk-dreieck"></i>');
  if (k.status === 'klausur') { m.push('<i class="mk-kreis"></i>'); if (wertGeaendert(k)) m.push('<i class="mk-quadrat"></i>'); }
  else if (verlegt) { if (richtung === 'nach' && (k.status === 'geaendert' || k.status === 'offen') && wertGeaendert(k)) m.push('<i class="mk-quadrat"></i>'); }
  else if (istZusatz(k)) {
    m.push(`<i class="mk-plus"${k.zusaetzlich ? ` data-hover="${ZUSATZ_TEXT}" data-hover-art="dunkel"` : ''}></i>`);
    if (k.status !== 'veranstaltung' && zusatzWertGeaendert(k)) m.push('<i class="mk-quadrat"></i>');
  }
  else if (k.status === 'geaendert' || k.status === 'offen' || k.status === 'buchung') m.push('<i class="mk-quadrat"></i>');
  return m.length ? `<span class="mks" aria-hidden="true">${m.join('')}</span>` : '';
}

/** Text für das Info-Symbol: Vertretungstext und Notizen (Symbol unten auf der Kachel). */
export function infoText(k) {
  const z = [];
  // Zusatzstunden: der Server liefert nur von Hand eingegebene Texte (Standardtexte entfallen) – diese erscheinen wie sonst auch
  if (k.text && k.fach && !/^entf(ä|ae|a)llt\.?$/i.test(k.text.trim())) z.push(`Vertretungstext: ${k.text}`);
  if (k.notizLehrer) z.push(`Notizen für Lehrkräfte: ${k.notizLehrer}`);
  if (k.notizSchueler) z.push(`Notizen für Schüler*innen: ${k.notizSchueler}`);
  return z.join('\n');
}

/** Symbole unten auf der Kachel: online, fällige Hausaufgabe und Info. */
function eckSymbole(k, typ) {
  const info = infoText(k);
  const hw = k.hausaufgabeFaellig ? '<i class="sym sym-square-pen ecke-hw" data-hover="Hausaufgabe fällig" data-hover-art="dunkel" aria-label="Hausaufgabe fällig"></i>' : '';
  const i = info ? `<i class="sym sym-info ecke-info" data-hover="${e(info)}" data-hover-art="dunkel" aria-label="Hinweis"></i>` : '';
  // „Findet online statt“: Symbol unten auf der Kachel (statt eines Raums)
  const online = istOnline(k, typ)
    ? '<i class="sym sym-video ecke-online" data-hover="Findet online statt" data-hover-art="dunkel" aria-label="Findet online statt"></i>' : '';
  return hw || i || online ? `<span class="ecke">${online}${hw}${i}</span>` : '';
}

/** Abwesende Klassen einer Karte (Absenz aus UntPlan). */
const abwesend = k => new Set((k.abwesendeKlassen || []).map(x => x.toLowerCase()));
/** Klassen mit durchgestrichenen abwesenden Klassen. */
function klassenWerte(k, entfall) {
  const weg = abwesend(k);
  if (!weg.size || entfall) return werteListe(k.klassen, entfall);
  const l = k.klassen || [];
  return liste(l.map(w => weg.has((w.k || '').toLowerCase()) ? `<span class="kl-weg">${e(w.k)}</span>` : werte([w])),
    l.map(w => weg.has((w.k || '').toLowerCase()) ? { t: w.k, a: 'aus' } : wertPille(w)));
}

/** Kartenzeile: Text bzw. Werteliste ({ liste, html, inline, pillen }); voll = vollständiger Text für den Hover einer gekürzten Zeile. */
function zeileHtml(klasse, x, kompakt = false, voll = '') {
  if (x && typeof x === 'object') {
    if (kompakt) return `<div class="${klasse}">${x.inline}</div>`;
    return `<div class="${klasse} z-liste" data-pillen="${e(JSON.stringify(x.pillen))}">${x.html}</div>`;
  }
  return `<div class="${klasse}"${voll ? ` data-voll="${e(voll)}"` : ''}>${x}</div>`;
}
const zeilenText = x => x && typeof x === 'object' ? x.inline : x;

/**
 * Inhalt einer Kachel. Kopfzeile: Fach (ohne Fach die Bezeichnung, z. B. Veranstaltung, Klausur, Buchung) links, Raum rechts – im
 * Raumplan nur ein geänderter Raum. Darunter im Klassenplan die Lehrkraft (bei Kopplung alle, dazu die Klassen), im Lehrerplan die
 * Klasse(n) und ggf. die vertretende Lehrkraft, im Raumplan Klasse(n) und Lehrkraft. Bei zusammengefassten Kopplungen (gleiches Fach
 * und gleicher Raum) stehen alle Lehrkräfte und Klassen auf der Kachel.
 */
export function karteInhalt(k, typ, kompakt = false) {
  const entfall = istEntfall(k, typ);
  // online: kein Raum (auch kein künstlicher) – nur das Symbol unten auf der Kachel
  const raum = istOnline(k, typ) ? '' : werte(k.raeume, entfall);
  const fach = k.fachAlt && !entfall ? `<span class="lbl" ${wechselHover(k.fachAlt, k.fach)}>${e(k.fach)}</span>` : e(k.fach || '');
  // gekürzte Fachzeile: Hover mit dem vollständigen Fachnamen
  const fachVoll = k.fachName && k.fachName !== k.fach ? k.fachName : '';
  const ohneFach = !k.fach;
  // Raumänderung (neuer, hinzugefügter, entfernter bzw. offener Raum): auch im Raumplan steht der Raum hervorgehoben
  // („R105 → R109“ im Hover, „+R109“, durchgestrichen) – sonst wäre die Änderung dort nicht zu sehen
  const raumGeaendert = !entfall && raum && (k.raeume || []).some(w => w.alt || w.neu);
  const kopfRaum = typ === 'raum' && !raumGeaendert ? '' : raum;
  let titel, rest;
  if (ohneFach) {
    // Veranstaltung, Klausur, Buchung: Bezeichnung, dann Klassen und Lehrkräfte (gekürzt)
    titel = e(k.text || k.art || '—');
    rest = [werteListe(k.klassen, entfall), typ !== 'lehrer' || k.lehrer.length > 1 ? werteListe(k.lehrer, entfall, true) : ''];
  } else if (typ === 'klasse') {
    titel = fach;
    // Mitklassen (gekoppelt bzw. parallel identisch, z. B. INF13 auf der Kachel von INF12) ganz unten; eine fehlende Mitklasse
    // steht wie eine abwesende Lehrkraft durchgestrichen in der Plakette
    const mit = !entfall && (k.mitklassen || []).length ? `<span class="mitklassen">${werte(k.mitklassen)}</span>` : '';
    rest = [werteListe(k.lehrer, entfall, true), k.klassen.length > 1 || abwesend(k).size ? klassenWerte(k, entfall) : '', mit];
  } else if (typ === 'raum') {
    titel = fach;
    rest = [klassenWerte(k, entfall), werteListe(k.lehrer, entfall, true)];
  } else {
    titel = fach;
    // Eigene Abwesenheit: die vertretende Lehrkraft hervorgehoben (Hover „HOF → BEC“); ohne Vertretung (Vertretung ohne
    // Lehrkraft, weggefallene Bereitschaft) das eigene Kürzel durchgestrichen. Kopplung: alle Lehrkräfte.
    const abw = k.lehrer.filter(w => w.alt || w.k);
    const lehrerZeile = lehrerAbwesend(k, typ) ? (abw.length ? liste(abw.map(w => w.k && w.alt
        ? `<span class="lbl" ${wechselHover(w.alt, w.k, true)}>${e(w.k)}</span>`
        : `<span class="lbl weg">${e(w.alt || w.k)}</span>`), abw.map(w => w.k && w.alt ? { t: w.k, a: 'neu' } : { t: w.alt || w.k, a: 'weg' })) : '')
      // Vertretung: die vertretende Lehrkraft hervorgehoben – auch im eigenen Plan der vertretenden Lehrkraft (bei reiner
      // Raumänderung liefert der Server die Lehrkraft ohne Änderung, dann ohne Hervorhebung)
      : k.lehrer.length > 1 || k.lehrer.some(w => w.alt || w.neu) ? werteListe(k.lehrer, entfall, true) : '';
    rest = [klassenWerte(k, entfall), lehrerZeile];
  }
  const zeilen = rest.filter(x => x);
  // abwesende Klasse: Plakette „abwesend …“ (Hover mit den Klassen)
  if (abwesend(k).size && !entfall) zeilen.push(`<span class="abw-label" data-hover="${e([...abwesend(k)].join(', ') + ' ' + (k.abwesendText || 'abwesend'))}" data-hover-art="dunkel">${e(k.abwesendText || 'abwesend')}</span>`);
  const kopf = `<div class="z1"${fachVoll && titel === fach ? ` data-voll="${e(fachVoll)}"` : ''}><span class="z-fach">${titel}</span>${kopfRaum ? `<span class="z-raum">${kopfRaum}</span>` : ''}</div>`;
  const rumpf = kompakt ? (zeilen.length ? `<div class="z2">${zeilen.map(zeilenText).join(' · ')}</div>` : '') : zeilen.map(x => zeileHtml('z2', x)).join('');
  return `${kopf}${rumpf}${marker(k, typ)}${eckSymbole(k, typ)}`;
}

/** CSS-Klassen einer Karte (Status, Lehrkraft abwesend, vergangen). */
export function kartenKlasse(k, typ, jetztIso, jetzt) {
  const klasseWeg = (k.abwesendeKlassen || []).length && !istEntfall(k, typ);
  // im eigenen (Lehrer-)Plan: alle Klassen abwesend → gestrichelt wie bei abwesender Lehrkraft
  const alleWeg = klasseWeg && typ === 'lehrer' && k.klassen.every(w => k.abwesendeKlassen.some(x => x.toLowerCase() === (w.k || '').toLowerCase()));
  return [k.status, lehrerAbwesend(k, typ) || alleWeg ? 'lehrer-abwesend' : '', klasseWeg ? 'klasse-abwesend' : '', istEntfall(k, typ) && k.status === 'abwesend' ? 'entfall' : '',
    vergangen(k, jetztIso, jetzt) && k.status === 'regulaer' ? 'vergangen' : ''].filter(Boolean).join(' ');
}

function vergangen(k, jetztIso, jetzt) {
  return k.datum < jetztIso || (k.datum === jetztIso && k.ende && minuten(k.ende) <= jetzt);
}

/** Grüne Karte (Änderung, Vertretung, Raumänderung, Zusatzstunde, offene Vertretung) – hat bei parallelen Blöcken Vorrang. */
export const istGrueneKarte = k => k.status === 'geaendert' || k.status === 'offen';

/**
 * Spuren für gleichzeitige Karten: immer nebeneinander. Gruppen zusammenhängender Karten nach Beginn (längere zuerst);
 * innerhalb einer Gruppe kommen grüne Karten zuerst an die Reihe und stehen damit immer ganz links, danach die übrigen
 * in der bisherigen Reihenfolge. Jede Karte kommt in die erste Spur, in der sie keine andere Karte überlappt (übrige Karten
 * erst rechts neben gleichzeitigen grünen Karten). Ohne grüne Karten ist das genau die bisherige Verteilung.
 */
export function spuren(karten) {
  const sortiert = [...karten].sort((a, b) => a.von - b.von || b.bis - a.bis);
  const gruppen = [];
  let gruppe = null, ende = -1;
  for (const k of sortiert) {
    if (!gruppe || k.von > ende) { gruppe = []; gruppen.push(gruppe); ende = k.bis; }
    gruppe.push(k);
    ende = Math.max(ende, k.bis);
  }
  const res = new Map();
  for (const g of gruppen) {
    const belegt = [];
    const ueber = (a, b) => a.von <= b.bis && b.von <= a.bis;
    for (const k of [...g.filter(istGrueneKarte), ...g.filter(x => !istGrueneKarte(x))]) {
      // übrige Karten erst rechts neben jeder gleichzeitigen grünen Karte
      let ab = 0;
      if (!istGrueneKarte(k)) belegt.forEach((liste, i) => { if (liste.some(o => istGrueneKarte(o) && ueber(o, k))) ab = i + 1; });
      let spur = belegt.findIndex((liste, i) => i >= ab && liste.every(o => !ueber(o, k)));
      if (spur < 0) { spur = belegt.length; belegt.push([]); }
      belegt[spur].push(k);
      res.set(k, { spur, anzahl: 0 });
    }
    for (const k of g) res.get(k).anzahl = belegt.length;
  }
  return res;
}

/** Fachfarbe als CSS-Variable für die Tönung der Kachel (nur gültige #RRGGBB-Werte). */
export const fachStil = k => /^#[0-9a-f]{6}$/i.test(k.farbe || '') ? `--fach:${k.farbe};` : '';

const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Höhe einer Pausenzeile mit Aufsichten bzw. eines schmalen Pausenbands (Pause ohne Aufsicht). */
const PAUSE = 28;
const BAND = 6;

/**
 * Zeilenaufbau: je Stunde eine Zeile; wo im Zeitraster wirklich eine Pause liegt (Ende ≠ nächster Beginn), eine Pausenzeile, wenn in
 * dieser Woche eine Pausenaufsicht stattfindet, sonst ein schmales Band ohne Text. Liefert die Oberkante jeder Stunde, jeder
 * Pausenzeile (pause) und jedes Bands (band, jeweils nach der Stundennummer davor).
 */
function zeilenAufbau(zeiten, aufsichten) {
  const pausenNach = new Set(aufsichten.map(a => a.nachStunde));
  const oben = [], pause = new Map(), band = new Map();
  let y = 0;
  zeiten.forEach((z, i) => {
    const vorher = i === 0 ? z.nr - 1 : zeiten[i - 1].nr;
    const luecke = i === 0 || zeiten[i - 1].ende !== z.beginn;
    if (luecke && pausenNach.has(vorher)) { pause.set(vorher, y); y += PAUSE; }
    else if (luecke && i > 0) { band.set(vorher, y); y += BAND; }
    oben.push(y);
    y += ZEILE;
  });
  const letzte = zeiten[zeiten.length - 1].nr;
  if (pausenNach.has(letzte)) { pause.set(letzte, y); y += PAUSE; }
  return { oben, pause, band, hoehe: y };
}

/** Position der Jetzt-Linie (null außerhalb des Unterrichts). */
function jetztPosition(zeiten, aufbau, jetzt) {
  for (let i = 0; i < zeiten.length; i++) {
    const b = minuten(zeiten[i].beginn), en = minuten(zeiten[i].ende);
    if (jetzt >= b && jetzt < en) return Math.round(aufbau.oben[i] + (jetzt - b) / Math.max(1, en - b) * ZEILE);
    if (i + 1 < zeiten.length && jetzt >= en && jetzt < minuten(zeiten[i + 1].beginn)) {
      const p = aufbau.pause.get(zeiten[i].nr), bd = aufbau.band.get(zeiten[i].nr);
      const anteil = (jetzt - en) / Math.max(1, minuten(zeiten[i + 1].beginn) - en);
      return p !== undefined ? Math.round(p + anteil * PAUSE) : bd !== undefined ? Math.round(bd + anteil * BAND) : aufbau.oben[i + 1];
    }
  }
  return null;
}

/** Senkrechte Lage einer Uhrzeit (Minuten) im Raster; vor der ersten bzw. nach der letzten Stunde an deren Rand. */
function zeitY(zeiten, aufbau, m) {
  const n = zeiten.length - 1;
  if (m <= minuten(zeiten[0].beginn)) return aufbau.oben[0];
  if (m >= minuten(zeiten[n].ende)) return aufbau.oben[n] + ZEILE;
  return jetztPosition(zeiten, aufbau, m) ?? aufbau.oben[0];
}

const ABW_ART = { verspaetet: 'Verspätet', vorzeitig: 'Vorzeitig gegangen' };

/**
 * Eigene Abwesenheit (Lehrkraft bzw. Schüler*in) als graue Fläche hinter den Stunden: die Karten bleiben voll sichtbar darüber,
 * „Abwesend“ bzw. der Grund steht dezent im größten freien Bereich der Fläche (ohne freien Bereich nur als Tooltip).
 * Ein- und ausblendbar über „⋮“ → „Abwesenheiten anzeigen“ (Klasse ohne-abwesenheiten am Raster).
 */
function abwesenheitFlaechen(liste, zeiten, aufbau, belegt) {
  return liste.map(a => {
    const y0 = zeitY(zeiten, aufbau, minuten(a.von)), y1 = zeitY(zeiten, aufbau, minuten(a.bis));
    if (y1 - y0 < 4) return '';
    const text = [ABW_ART[a.art] || 'Abwesend', a.grund].filter(Boolean).join(' · ');
    const titel = `${text} (${a.von}–${a.bis})`;
    // größter freier Abschnitt der Fläche (nicht von Karten bzw. Aufsichten belegt): zuerst über die ganze Breite, sonst in einem
    // senkrechten Streifen neben parallelen Karten (mindestens ein Viertel der Breite)
    const freiIn = (l, r) => {
      const teile = belegt.filter(b => b[2] < r && b[2] + b[3] > l).map(([o, u]) => [Math.max(o, y0), Math.min(u, y1)]).filter(([o, u]) => u > o).sort((x, y) => x[0] - y[0]);
      let frei = null, pos = y0;
      for (const [o, u] of [...teile, [y1, y1]]) {
        if (o - pos > (frei ? frei[1] - frei[0] : 0)) frei = [pos, o];
        pos = Math.max(pos, u);
      }
      return frei;
    };
    const hoehe = f => f ? f[1] - f[0] : 0;
    let frei = freiIn(0, 100), streifen = [0, 100];
    if (hoehe(frei) < 22) {
      // breitester Streifen mit genug Platz (mindestens 40px hoch), sonst der höchste
      const kanten = [...new Set([0, 100, ...belegt.flatMap(b => [b[2], b[2] + b[3]])])].filter(x => x >= 0 && x <= 100).sort((x, y) => x - y);
      let best = null;
      for (let i = 0; i < kanten.length; i++) for (let j = i + 1; j < kanten.length; j++) {
        if (kanten[j] - kanten[i] < 25) continue;
        const f = freiIn(kanten[i] + 0.01, kanten[j] - 0.01), w = kanten[j] - kanten[i];
        const wert = hoehe(f) >= 40 ? 1000 + w : hoehe(f);
        if (hoehe(f) >= 22 && (!best || wert > best.wert)) best = { wert, f, s: [kanten[i], kanten[j]] };
      }
      if (best) { frei = best.f; streifen = best.s; }
    }
    const lage = streifen[0] > 0 || streifen[1] < 100 ? `left:${streifen[0]}%;right:auto;width:${streifen[1] - streifen[0]}%;` : '';
    // Text oben im freien Bereich (bei großen Bereichen nicht in der Mitte, damit er im sichtbaren Teil steht)
    const label = hoehe(frei) >= 22
      ? `<span class="tt-abw-text" style="${lage}top:${Math.round(frei[0] + Math.min(hoehe(frei) / 2, 40) - y0)}px">${e(text)}</span>` : '';
    return `<div class="tt-abw" style="top:${y0}px;height:${y1 - y0}px" title="${e(titel)}" aria-label="${e(titel)}" role="note">${label}</div>`;
  }).join('');
}

/** Block an Pausenzeilen teilen: Aufsichten trennen Doppelstunden. */
function abschnitte(k, aufbau, index, durchgaengig = false) {
  if (durchgaengig) return [[k.von, k.bis]];
  const res = [];
  let start = k.von;
  for (let n = k.von; n < k.bis; n++) if (aufbau.pause.has(n) && index.has(n + 1)) { res.push([start, n]); start = n + 1; }
  res.push([start, k.bis]);
  return res;
}

const FREI = { ferien: 'Ferien', feiertag: 'Feiertag', frei: 'Unterrichtsfrei' };
const datumDe = iso => iso ? iso.split('-').reverse().join('.') : '';

/** automatisch benannter einzelner freier Tag aus UntPlan („19.10.2026“) – kein eigener Name */
const nurDatum = n => /^\d{1,2}\.\d{1,2}\.(\d{2,4})?$/.test((n || '').trim());

/** Ferien, Feiertage und freie Tage: hellblaue Fläche je Tag, mittig Art, Name und Zeitraum. */
function freiUeberlagerung(t) {
  const titel = FREI[t.freiArt];
  if (!titel) return t.freiGrund ? `<div class="tt-frei">${e(t.freiGrund)}</div>` : '';
  // je Tag eine eigene Fläche mit eigenem Text (Art, Name, Zeitraum) – aufeinanderfolgende freie Tage werden nicht zusammengefasst
  return `<div class="tt-ferien tag">${freiInhalt([t])}</div>`;
}

/** Inhalt einer freien Fläche über einen oder mehrere Tage: Art (Ferien vor Feiertag vor unterrichtsfrei), Namen, Zeitraum. */
function freiInhalt(liste) {
  const art = ['ferien', 'feiertag', 'frei'].find(a => liste.some(x => x.freiArt === a)) ?? liste[0].freiArt;
  const titel = FREI[art];
  const namen = [...new Set(liste.map(x => (x.freiGrund || '').trim()).filter(x => x && !nurDatum(x) && x.toLowerCase() !== titel.toLowerCase()))];
  // Zeitraum: bei einem Eintrag dessen Zeitraum, sonst vom ersten bis zum letzten freien Tag (bzw. Eintrag)
  const vons = liste.map(x => x.freiVon || x.datum).filter(Boolean).sort(), bise = liste.map(x => x.freiBis || x.freiVon || x.datum).filter(Boolean).sort();
  const von = vons[0], bis = bise[bise.length - 1];
  const zeitraum = von ? (bis && bis !== von ? `${datumDe(von)} - ${datumDe(bis)}` : datumDe(von)) : '';
  return `<div class="inhalt"><div class="art"><i class="bi bi-calendar-x" aria-hidden="true"></i> ${titel}</div>${namen.length ? `<div>${e(namen.join(', '))}</div>` : ''}${zeitraum ? `<div>${zeitraum}</div>` : ''}</div>`;
}

const leisteEintrag = (text, art) => `<div class="tt-ereignis ${art}" title="${e(text)}">${e(text)}</div>`;

/** Wochentag und Datum: „Mo 12.10.“ */
export const tagKopf = (i, iso) => { const [, m, t] = iso.split('-'); return `${WOCHENTAGE_KURZ[i] ?? ''} ${t}.${m}.`; };
/** Spaltenkopf: Wochentag (Medium) und Datum (Regular). */
const tagKopfHtml = (i, iso) => { const [w, d] = tagKopf(i, iso).split(' '); return `<span class="tt-wt">${e(w)}</span> <span class="tt-dat">${e(d)}</span>`; };

/** Wochenraster als HTML. plan: Antwort von /api/app/plan; gewaehlterTag: Index für die Mobilansicht. */
export function wochenGitter(plan, { gewaehlterTag = null, kartenZeiten = false, aufsichten: aufsichtModus = 'normal' } = {}) {
  const alle = plan.zeitraster.filter(z => z.beginn && z.ende);
  if (!alle.length) return '<div class="alert alert-secondary">Kein Zeitraster übertragen.</div>';
  // Raster immer vollständig (alle Stunden des Zeitrasters)
  const zeiten = alle;
  const index = new Map(zeiten.map((z, i) => [z.nr, i]));
  const letzte = zeiten[zeiten.length - 1].nr;
  const aufbau = zeilenAufbau(zeiten, plan.aufsichten);
  const heute = heuteIso();
  const jetzt = jetztMinuten();
  const tage = plan.tage;
  const ausgewaehlt = gewaehlterTag ?? Math.max(0, tage.findIndex(t => t.datum === heute));
  const jetztY = tage.some(t => t.datum === heute) ? jetztPosition(zeiten, aufbau, jetzt) : null;
  // „abwesend …“ steht nicht zusätzlich über dem Tag – die Karten zeigen die Abwesenheit bereits
  // ebenso keine „Raum gesperrt …“ bzw. „Klasse abwesend …“ über dem Tag (die Karten zeigen das)
  const hinweise = t => t.hinweise.filter(h => !/^(abwesend|raum gesperrt|klasse abwesend)\b/i.test(h));
  const mitLeiste = tage.some(t => hinweise(t).length);

  let html = `<div class="tt" style="--tage:${tage.length}"><div class="tt-ecke"></div>`;
  tage.forEach((t, i) => {
    html += `<div class="tt-tag ${t.datum === heute ? 'heute' : ''} ${i === ausgewaehlt ? 'gewaehlt' : ''} ${i === plan.tage.length - 1 ? 'letzter' : ''}">${tagKopfHtml(i, t.datum)}</div>`;
  });
  if (mitLeiste) {
    html += '<div class="tt-ecke"></div>';
    tage.forEach((t, i) => { html += `<div class="tt-leiste ${i === ausgewaehlt ? 'gewaehlt' : ''}">${hinweise(t).map(h => leisteEintrag(h, 'hinweis')).join('')}</div>`; });
  }

  // Zeitspalte: je Stunde die Nummer, darunter Beginn und Ende
  html += `<div class="tt-achse" style="height:${aufbau.hoehe}px">`;
  // Uhrzeiten auf den Kacheln eingeblendet: links nur die Stundennummern (keine Uhrzeiten doppelt)
  zeiten.forEach((z, i) => {
    html += `<div class="tt-stunde" style="top:${aufbau.oben[i]}px;height:${ZEILE}px"><div class="tt-nr${kartenZeiten ? ' allein' : ''}">${e(z.bezeichnung || z.nr)}</div>`;
    if (!kartenZeiten) html += `<div class="tt-zeit beginn">${e(z.beginn)}</div>`;
    if (!kartenZeiten) html += `<div class="tt-zeit ende">${e(z.ende)}</div>`;
    html += '</div>';
  });
  if (jetztY !== null) html += `<div class="tt-jetzt-zeit" style="top:${jetztY}px">${hhmm(jetzt)}</div>`;
  html += '</div>';

  const linien = new Set();
  zeiten.forEach((z, j) => { linien.add(aufbau.oben[j]); linien.add(aufbau.oben[j] + ZEILE); });
  tage.forEach((t, i) => {
    html += `<div class="tt-spalte ${t.frei ? 'frei ' + e(t.freiArt || '') : ''} ${t.datum === heute ? 'heute' : ''} ${i === ausgewaehlt ? 'gewaehlt' : ''}" style="height:${aufbau.hoehe}px">`;
    html += [...linien].map(y => `<div class="tt-linie" style="top:${y}px"></div>`).join('');
    html += [...aufbau.pause.values()].map(y => `<div class="tt-pause" style="top:${y}px;height:${PAUSE}px"></div>`).join('');
    html += [...aufbau.band.values()].map(y => `<div class="tt-band" style="top:${y}px;height:${BAND}px"></div>`).join('');
    if (t.frei) html += freiUeberlagerung(t);
    // eigene Abwesenheit: graue Fläche hinter den Stunden (wird nach den Karten berechnet und hier eingefügt)
    const vorKarten = html.length, belegt = [];
    const karten = plan.karten.filter(k => k.datum === t.datum && index.has(k.von));
    // Veranstaltungen, die nicht schon als Kachel (Teilnahme) im Plan stehen – als zusätzliche Kachel
    const ereignisKarten = t.ereignisse.filter(x => index.has(Math.max(x.von, zeiten[0].nr)) && !karten.some(k => k.text === x.titel && k.von <= x.bis && k.bis >= x.von))
      .map(x => ({ ereignis: true, datum: t.datum, von: Math.max(x.von, zeiten[0].nr), bis: Math.min(x.bis, letzte), status: 'veranstaltung', fach: '', text: x.titel, art: 'Veranstaltung',
        klassen: x.klassen.map(k => ({ k })), lehrer: x.lehrer.map(k => ({ k })), raeume: x.raeume.map(k => ({ k })) }));
    const alleKarten = [...karten, ...ereignisKarten];
    const lage = spuren(alleKarten);
    for (const k of alleKarten) {
      const { spur, anzahl } = lage.get(k);
      const breite = 100 / anzahl;
      const nr = k.ereignis ? '' : `data-karte="${plan.karten.indexOf(k)}"`;
      // Veranstaltungen (und bei halbierten/ausgeblendeten Aufsichten alle Karten) laufen über die Pause hinweg durch
      for (const [von, bis] of abschnitte(k, aufbau, index, k.status === 'veranstaltung' || aufsichtModus !== 'normal')) {
        const iv = index.get(von), ib = index.get(Math.min(bis, letzte)) ?? iv;
        const oben = aufbau.oben[iv] + 2, h = aufbau.oben[ib] + ZEILE - aufbau.oben[iv] - 4;
        // Beginn und Ende in der Kachel (Einstellung „Uhrzeiten auf den Kacheln“); bei zwei parallelen Stunden nur in der linken
        const mitZeit = kartenZeiten && h >= 60 && (anzahl === 1 || (anzahl === 2 && spur === 0));
        const zeit = mitZeit ? `<span class="zt">${e(zeiten[iv].beginn)}–${e(zeiten[ib].ende)}</span>` : '';
        belegt.push([oben, oben + h, spur * breite, breite]);
        html += `<div class="std ${e(kartenKlasse(k, plan.typ, heute, jetzt))} ${mitZeit ? 'mit-zeit' : ''}" ${nr} tabindex="0" role="button"
          aria-label="${e(titelText(k))}" style="${fachStil(k)}top:${oben}px;height:${h}px;left:calc(${spur * breite}% + 2px);width:calc(${breite}% - 4px)">${karteInhalt(k, plan.typ, h < 56)}${zeit}</div>`;
      }
    }
    // Pausenaufsichten in der Pausenzeile
    const aufsichten = aufsichtModus === 'aus' ? [] : plan.aufsichten.filter(a => a.datum === t.datum && aufbau.pause.has(a.nachStunde));
    // durchgängige Veranstaltung über diese Pause: Aufsicht schmal daneben
    const ueberPause = nach => aufsichtModus === 'halbiert' || alleKarten.some(k => k.status === 'veranstaltung' && k.von <= nach && k.bis > nach);
    const proPause = new Map();
    for (const a of aufsichten) proPause.set(a.nachStunde, [...(proPause.get(a.nachStunde) ?? []), a]);
    for (const [nach, liste] of proPause) {
      const breite = 100 / liste.length;
      liste.forEach((a, j) => {
        // auf der Kachel nur der Aufsichtsbereich (z. B. „Hof“) – nicht „Früh …“ bzw. der lange Name; Details im Tooltip
        const ort = aufsichtOrt(a);
        const titel = aufsichtTitel(a);
        // Vertretung wie bei den Stundenkacheln: die Vertretung hervorgehoben hinter dem Ort; im Plan der abwesenden Lehrkraft gestrichelt
        const label = aufsichtLabel(a);
        const vorbei = a.datum < heute || (a.datum === heute && a.ende && minuten(a.ende) <= jetzt);
        belegt.push([aufbau.pause.get(nach), aufbau.pause.get(nach) + PAUSE, j * breite, breite]);
        // Vertretung direkt hinter dem Ort (ein Leerzeichen), Hover „ALT → NEU“ wie auf den Stundenkacheln – dann ohne Browser-Tooltip.
        // Lage wie die Stundenkacheln: 2px innerhalb der Pausenzeile, gleiche Breite und Einrückung
        html += `<div class="aufsicht u-hover-bereich ${e(a.status)} ${ueberPause(nach) ? 'schmal' : ''} ${vorbei ? 'vergangen' : ''}" style="top:${aufbau.pause.get(nach) + 2}px;height:${PAUSE - 4}px;left:calc(${j * breite}% + 2px);width:calc(${breite}% - 4px)"
          ${label ? '' : `title="${e(titel)}"`} aria-label="${e(titel)}"><span class="auf-text">${e(ort)}${label ? ' ' + label : ''}</span></div>`;
      });
    }
    const abw = abwesenheitFlaechen((plan.abwesenheiten || []).filter(a => a.datum === t.datum), zeiten, aufbau, belegt);
    if (abw) html = html.slice(0, vorKarten) + abw + html.slice(vorKarten);
    if (jetztY !== null) html += `<div class="tt-jetzt" style="top:${jetztY}px"></div>${t.datum === heute ? `<div class="tt-jetzt heute" style="top:${jetztY}px"></div>` : ''}`;
    html += '</div>';
  });
  html += '</div>';
  // Woche außerhalb des Planfensters der Rolle: leeres Raster mit zentrierter Meldung (Wochennavigation bleibt bedienbar)
  return plan.gesperrt ? `<div class="tt-gesperrt">${html}${sperreHtml(plan.sperrhinweis)}</div>` : html;
}

/** Meldung „keine Termine“ bei beschränkter Anzeige: Schloss, Titel, Hinweis der Administration. */
export function sperreHtml(hinweis) {
  return `<div class="tt-sperre" role="status"><span class="tt-sperre-symbol" aria-hidden="true"><i class="bi bi-lock"></i></span>
    <p class="tt-sperre-titel">Es werden hier keine Termine angezeigt.</p>
    <p class="tt-sperre-text">${e(hinweis || 'Die Anzeige des Stundenplans ist durch die Administration beschränkt.')}</p></div>`;
}

export function tagAuswahl(plan, gewaehlt) {
  return `<div class="tt-tagwahl nicht-drucken" role="group" aria-label="Tag wählen">${plan.tage.map((t, i) =>
    `<button type="button" data-tagwahl="${i}" class="${i === gewaehlt ? 'aktiv' : ''}" aria-pressed="${i === gewaehlt}">${WOCHENTAGE_KURZ[i]}<small>${tagKopf(i, t.datum).split(' ')[1]}</small></button>`).join('')}</div>`;
}

/**
 * Hover (nur auf Labels und Symbolen unten rechts, nicht auf der ganzen Karte): grünes Label
 * „B070 → C197“ über dem geänderten Wert bzw. dunkler Hinweis über dem Info-Symbol. Ein schwebendes Element, damit es
 * nicht von der Karte abgeschnitten wird.
 */
let hoverEl = null, hoverZiel = null, hoverTimer = 0;
/**
 * Hover zeigen. ziel = Element mit data-hover (Label, Symbol) oder eine gekürzte Kartenzeile (Pillen bzw. vollständiger Text);
 * anker = Element, über dem der Hover steht (Verlegung beim Zeigen auf die Karte: das Symbol oben rechts).
 */
function hoverZeigen(ziel, anker = ziel) {
  clearTimeout(hoverTimer);
  if (!hoverEl) { hoverEl = document.createElement('div'); hoverEl.className = 'u-hover-label'; hoverEl.setAttribute('role', 'tooltip'); document.body.append(hoverEl); }
  if (hoverZiel === ziel && hoverEl.style.display && hoverEl.style.display !== 'none') return;   // ruhig stehen lassen, kein Flackern beim Bewegen
  hoverZiel = ziel;
  const zeile = ziel.classList.contains('z1') || ziel.classList.contains('z2');
  let pillen = null;
  if (zeile && ziel.dataset.pillen) try { pillen = JSON.parse(ziel.dataset.pillen); } catch { pillen = null; }
  if (!pillen && ziel.dataset.hoverPillen) pillen = ziel.dataset.hoverPillen.split(',').map(t => ({ t }));
  const art = zeile ? 'zeile' : ziel.dataset.hoverArt || '';
  if (pillen) hoverEl.innerHTML = pillen.map(p => `<span class="${p.a ? 'p-' + e(p.a) : ''}">${e(p.t)}</span>`).join('');
  else hoverEl.textContent = zeile ? (ziel.dataset.voll || ziel.textContent.trim()) : ziel.dataset.hover || '';   // „alt → neu“ ohne Durchstreichung
  hoverEl.classList.toggle('dunkel', art === 'dunkel');
  hoverEl.classList.toggle('grau', art === 'grau' && !pillen);
  hoverEl.classList.toggle('zeile', art === 'zeile' && !pillen);
  hoverEl.classList.toggle('rot', art === 'rot');
  hoverEl.classList.toggle('pillen', !!pillen);
  hoverEl.classList.toggle('klein', 'hoverKlein' in ziel.dataset);   // Verlegung: etwas kleiner
  hoverEl.style.display = pillen ? 'flex' : 'block';   // Pillen in Reihen (umbrechend)
  const r = anker.getBoundingClientRect();
  const b = hoverEl.offsetWidth, h = hoverEl.offsetHeight;
  const unten = ziel.dataset.hoverPos === 'unten';
  // grüne bzw. rote Labels und Symbole: genau mittig über dem Element; Info (dunkel): rechtsbündig; Zeilen und Pillen: linksbündig
  const mitte = !zeile && !pillen && !unten && (art === '' || art === 'rot' || 'hoverMitte' in ziel.dataset);
  const x = unten || pillen || zeile ? r.left : mitte ? r.left + r.width / 2 - b / 2 : art === 'dunkel' ? r.right - b : r.left - 4;
  const links = Math.max(6, Math.min(window.innerWidth - b - 6, x));
  hoverEl.style.left = `${Math.round(links)}px`;
  hoverEl.style.top = `${Math.round(unten ? r.bottom + 6 : Math.max(6, r.top - h - 6))}px`;
}
function hoverVerbergen(sofort = false) {
  clearTimeout(hoverTimer);
  const weg = () => { if (hoverEl) hoverEl.style.display = 'none'; hoverZiel = null; };
  if (sofort) weg(); else hoverTimer = setTimeout(weg, 80);
}
/** Kartenzeile gekürzt (Text endet mit „…“ bzw. Werteliste mit „+5“)? */
function zeileGekuerzt(z) {
  const t = z.querySelector(':scope > .z-namen, :scope > .z-fach') ?? z;
  return t.scrollWidth > t.clientWidth + 1;
}
document.addEventListener('mouseover', ev => {
  const t = ev.target;
  const z = t.closest?.('[data-hover], [data-hover-pillen]');
  if (z && z.closest('.std, .tt-liste, .tagplan, .sd-kopf, .u-hover-bereich')) { hoverZeigen(z); return; }
  const karte = t.closest?.('.std');
  if (karte) {
    // jede gekürzte Zeile hat ihren eigenen Hover (über der Zeile)
    const zeile = t.closest('.z1, .z2');
    if (zeile && karte.contains(zeile) && zeileGekuerzt(zeile)) { hoverZeigen(zeile); return; }
  }
  if (hoverZiel) hoverVerbergen();
});
document.addEventListener('scroll', () => hoverVerbergen(true), true);
document.addEventListener('click', () => hoverVerbergen(true), true);

/**
 * Wertelisten auf den Karten kürzen: alle Werte stehen in einer Zeile; passt die Liste nicht, endet sie mit „…“ und „+5“ –
 * Anzahl der Werte, die ganz verdeckt sind. Nach jedem Zeichnen und bei Größenänderung neu gemessen.
 */
export function listenKuerzen(wurzel) {
  for (const z of wurzel.querySelectorAll('.std .z-liste')) {
    const namen = z.querySelector(':scope > .z-namen'), mehr = z.querySelector(':scope > .mehr');
    if (!namen || !mehr) continue;
    mehr.hidden = true;
    if (namen.scrollWidth <= namen.clientWidth + 1) continue;
    // Platz für „+N“ freihalten, dann zählen, welche Werte ganz hinter dem Rand liegen
    mehr.textContent = '+0'; mehr.hidden = false;
    const rechts = namen.getBoundingClientRect().right;
    const verdeckt = [...namen.querySelectorAll(':scope > .z-w')].filter(w => w.getBoundingClientRect().left >= rechts - 8).length;
    if (verdeckt > 0) mehr.textContent = `+${verdeckt}`; else mehr.hidden = true;
  }
}

/** Klick auf eine Karte öffnet den Detaildialog. */
export function kartenBinden(wurzel, karten, kontext, typ = null) {
  const oeffnen = el => { const k = karten[Number(el.dataset.karte)]; if (k) karteDialog(k, { ...kontext, liste: karten, typ }); };
  listenKuerzen(wurzel);
  if (!wurzel.__kuerzen && typeof ResizeObserver === 'function') {
    let warte = 0;
    wurzel.__kuerzen = new ResizeObserver(() => { cancelAnimationFrame(warte); warte = requestAnimationFrame(() => listenKuerzen(wurzel)); });
    wurzel.__kuerzen.observe(wurzel);
  }
  wurzel.querySelectorAll('[data-karte]').forEach(el => {
    el.addEventListener('click', () => oeffnen(el));
    el.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); oeffnen(el); } });
  });
}

/** Detailansicht einer Stunde (Aufbau) – siehe stundendetails.js. */
export { karteDialog } from './stundendetails.js';
import { karteDialog } from './stundendetails.js';

/** Tagesübersicht (Elemente × Stunden). */
export function tagesGitter(tag) {
  const zeiten = tag.zeitraster;
  const max = Math.max(6, ...tag.zeilen.flatMap(z => z.karten.map(k => k.bis)));
  const spalten = zeiten.filter(z => z.nr <= max);
  let html = `<div class="tagplan"><div class="tagplan-gitter" style="grid-template-columns:130px repeat(${spalten.length}, minmax(104px, 1fr))">`;
  html += '<div class="tagplan-kopf" style="border-left:0"></div>' + spalten.map(z => `<div class="tagplan-kopf"><b>${e(z.bezeichnung)}.</b>${e(z.beginn)}–${e(z.ende)}</div>`).join('');
  const alle = [];
  const jetztIso = heuteIso(), jetzt = jetztMinuten();
  for (const zeile of tag.zeilen) {
    html += `<div class="tagplan-element">${e(zeile.kurz)}<small>${e(zeile.name !== zeile.kurz ? zeile.name : '')}</small></div>`;
    const belegt = new Set();
    const sortiert = [...zeile.karten].sort((a, b) => a.von - b.von);
    for (const z of spalten) {
      if (belegt.has(z.nr)) continue;
      const hier = sortiert.filter(k => k.von === z.nr);
      if (!hier.length) { html += '<div class="tagplan-zelle"></div>'; continue; }
      const bis = Math.min(max, Math.max(...hier.map(k => k.bis)));
      for (let n = z.nr + 1; n <= bis; n++) belegt.add(n);
      html += `<div class="tagplan-zelle" style="grid-column:span ${bis - z.nr + 1}">` + hier.map(k => {
        alle.push(k);
        return `<div class="std ${e(kartenKlasse(k, tag.typ, jetztIso, jetzt))}" data-karte="${alle.length - 1}" tabindex="0" role="button" aria-label="${e(titelText(k))}" style="${fachStil(k)}">${karteInhalt(k, tag.typ)}</div>`;
      }).join('') + '</div>';
    }
  }
  html += '</div></div>';
  return { html, karten: alle };
}

/** Aufsichtsbereich einer Pausenaufsicht für die Karte: Kurzname („Hof“), ohne „Früh“/„Frühaufsicht“ davor. */
function aufsichtOrt(a) {
  const roh = String(a.gang || a.gangName || '').trim();
  const ohne = roh.replace(/^(früh(aufsicht)?|fa)[\s:\-–]*/i, '').trim();
  return ohne || roh || 'Aufsicht';
}

/**
 * Tooltip bzw. Bezeichnung einer Pausenaufsicht: Ort, Zeit und Zustand – Vertretung, vertreten durch …, Vertretung offen bzw. entfällt
 * (mit Anlass, z. B. „Abwesenheit“ oder der Titel der Veranstaltung).
 */
export function aufsichtTitel(a) {
  const ersatz = a.lehrer && !/^[?+-]+$/.test(a.lehrer) ? a.lehrer : '';
  const zustand = a.status === 'vertretung' ? ` (Vertretung für ${a.alt})`
    : a.status === 'vertreten' ? (ersatz ? ` (vertreten durch ${ersatz})` : ' (Vertretung offen)')
    : a.status === 'entfall' ? ` (entfällt${a.grund ? ' – ' + a.grund : ''})` : '';
  return `Pausenaufsicht ${a.gangName || a.gang} ${a.beginn}–${a.ende}${zustand}`;
}

/**
 * Vertretene Pausenaufsicht: die Vertretung als grünes Label wie auf den Stundenkarten (Hover „ALT → NEU“). Die abwesende Lehrkraft
 * steht nicht auf der Karte (nur im Hover); ohne Vertretung kein Label (gestrichelte Karte, Hinweis im Tooltip).
 */
function aufsichtLabel(a) {
  if (a.status !== 'vertretung' && a.status !== 'vertreten') return '';
  const ersatz = a.lehrer && !/^[?+-]+$/.test(a.lehrer) ? a.lehrer : '';
  const alt = a.alt && !/^[?+-]+$/.test(a.alt) ? a.alt : '';
  if (!ersatz) return '';
  return `<span class="lbl lbl-auf" data-hover="${e(alt ? wechsel(alt, ersatz) : '+ ' + ersatz)}"${alt ? ` data-hover-alt="${e(alt)}"` : ''}>${e(ersatz)}</span>`;
}

/** Liste eines Tages (Übersicht) mit denselben Karten, Veranstaltungen und Pausenaufsichten. */
export function tagesListe(karten, aufsichten, typ, ereignisse = []) {
  const jetztIso = heuteIso(), jetzt = jetztMinuten();
  const eintraege = [
    ...ereignisse.filter(x => x.ganztaegig && !karten.some(k => k.text === x.titel)).map(x => ({ zeit: -1, html: `<div class="eintrag"><div class="zeit">ganztägig</div>
        <div class="std veranstaltung"><span class="mks"><i class="mk-plus"></i></span><div class="z1">${e(x.titel)}</div>
        ${[gekuerzt(x.klassen.map(k => ({ k })), 4), gekuerzt(x.lehrer.map(k => ({ k })), 3), werte(x.raeume.map(k => ({ k })))].filter(Boolean).map(z => `<div class="z2">${z}</div>`).join('')}
        <div class="z3">Veranstaltung</div></div></div>` })),
    ...karten.map((k, i) => ({ zeit: minuten(k.beginn), html: `<div class="eintrag ${k.datum === jetztIso && minuten(k.beginn) <= jetzt && jetzt < minuten(k.ende) ? 'jetzt' : ''}">
        <div class="zeit"><b>${k.von === k.bis ? k.von + '.' : k.von + '.–' + k.bis + '.'}</b>${e(k.beginn)}–${e(k.ende)}</div>
        <div class="std ${e(kartenKlasse(k, typ, jetztIso, jetzt))}" data-karte="${i}" tabindex="0" role="button" aria-label="${e(titelText(k))}" style="${fachStil(k)}">${karteInhalt(k, typ, true)}${k.status !== 'regulaer' && k.status !== 'abwesend' && statusText(k) ? `<div class="z3">${e(statusText(k))}</div>` : ''}</div></div>` })),
    ...aufsichten.map(a => ({ zeit: minuten(a.beginn), html: `<div class="eintrag"><div class="zeit">${e(a.beginn)}–${e(a.ende)}</div>
        <div class="aufsicht ${e(a.status)}" ${aufsichtLabel(a) ? '' : `title="${e(aufsichtTitel(a))}"`}><span class="auf-text">${e(a.gangName)}${aufsichtLabel(a) ? ' ' + aufsichtLabel(a) : ''}</span></div></div>` })),
  ].sort((a, b) => a.zeit - b.zeit);
  return `<div class="tt-liste">${eintraege.map(x => x.html).join('')}</div>`;
}
