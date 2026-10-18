// Stundenpläne (Klasse, Lehrkraft, Raum): Werkzeugleiste über dem Raster mit Elementwahl (blättern mit Alt+←/→), Datumsnavigation
// (Woche bzw. Tag, eigener Kalender), Segmentschalter Woche/Tag, Hervorhebung von Entfall, Prüfung und Änderung sowie dem Menü
// „Ansicht“ (Symbole, Uhrzeiten, Abwesenheiten, Pausenaufsichten, Drucken, Link kopieren). Darunter das Raster mit Zeitspalte und Jetzt-Linie.
import { e, icon, holen, heuteIso, plusTage, montag, lade, dialog, toast, druckenMitAusrichtung } from '../ui.js';
import { wochenGitter, tagAuswahl, kartenBinden, karteDialog } from '../plangitter.js';
import { elementWahl } from '../elementwahl.js';

const TYPEN = { klasse: 'Klasse', lehrer: 'Lehrkraft', raum: 'Raum' };
const LISTE = { klasse: 'klassen', lehrer: 'lehrer', raum: 'raeume' };

/** Langname ohne vorangestelltes Kürzel („7a – Klasse 7a“ → „Klasse 7a“). */
function langname(plan) {
  let n = (plan.name || '').trim();
  if (n.toLowerCase().startsWith(plan.element.toLowerCase())) n = n.slice(plan.element.length).replace(/^\s*[–-]\s*/, '');
  return n && n !== plan.element ? n : '';
}

/** Woche „12.10.–18.10.2026“ (Montag bis Sonntag). */
export function wochenText(mo) {
  const so = plusTage(mo, 6);
  const t = iso => { const [, m, d] = iso.split('-'); return `${d}.${m}.`; };
  return `${t(mo)}–${t(so)}${so.slice(0, 4)}`;
}

// Kalender (Wochenauswahl in der Werkzeugleiste, Tageswahl in den Tagesansichten): eigene Komponente in kalender.js
export { kalenderwoche, kalenderBinden } from '../kalender.js';
import { kalenderBinden, kalenderwoche } from '../kalender.js';

/** Einstellungen der Ansicht (je Gerät). */
export function planEinstellungen(zeitenVorgabe = false) {
  const w = { symbole: true, abwesenheiten: true, zeiten: zeitenVorgabe, aufsichten: 'normal', ansicht: 'woche' };
  try { Object.assign(w, JSON.parse(localStorage.getItem('untplan:planeinstellungen') ?? '{}')); } catch { /* privat */ }
  try { const z = localStorage.getItem('untplan:kartenzeiten'); if (z !== null && !localStorage.getItem('untplan:planeinstellungen')) w.zeiten = z === '1'; } catch { /* privat */ }
  return w;
}
function einstellungenSpeichern(w) { try { localStorage.setItem('untplan:planeinstellungen', JSON.stringify(w)); } catch { /* privat */ } }

/** Muster der Statusarten (Legende und Hilfe) – gleiche Darstellung wie auf den Kacheln. */
const MUSTER = { entfall: '<i class="lg-muster entfall" aria-hidden="true"></i>', pruefung: '<i class="lg-muster pruefung" aria-hidden="true"></i>',
  aenderung: '<i class="lg-muster aenderung" aria-hidden="true"></i>', termin: '<i class="lg-muster termin" aria-hidden="true"></i>', abwesend: '<i class="lg-muster abwesend" aria-hidden="true"></i>' };

/**
 * Legende und Ansichtsoptionen als Teil der Werkzeugleiste: Schalter blenden die Hervorhebung von Entfall, Prüfung und Änderung
 * aus und ein, „Ansicht“ öffnet die weiteren Einstellungen, „?“ die Hilfe.
 */
export function legendeHtml(aus, einst, mitDruck = true) {
  const schalter = (id, text) => `<button type="button" class="u-legende-pille ${aus.has(id) ? 'aus' : ''}" data-legende="${id}" aria-pressed="${!aus.has(id)}" title="${text} hervorheben ein/aus">${MUSTER[id]}${text}</button>`;
  const haken = an => an ? '<i class="bi bi-check haken"></i>' : '<i class="haken leer"></i>';
  return `<div class="u-legende-leiste nicht-drucken" data-legendenleiste role="group" aria-label="Hervorhebung">
    ${schalter('entfall', 'Entfall')}${schalter('pruefung', 'Prüfung')}${schalter('aenderung', 'Änderung')}</div>
    <div class="position-relative nicht-drucken"><button type="button" class="btn btn-outline-secondary btn-sm u-legende-mehr" data-legende-mehr aria-haspopup="menu" aria-expanded="false">${icon('ansicht')}<span>Ansicht</span>${icon('unten')}</button>
      <div class="u-legende-menue u-menue u-menue-rechts d-none" data-legende-menue role="menu">
        <div class="kopf">Kacheln</div>
        <button type="button" class="eintrag" data-einst="symbole" role="menuitemcheckbox" aria-checked="${einst.symbole}">${haken(einst.symbole)}Symbole anzeigen</button>
        <button type="button" class="eintrag" data-einst="zeiten" role="menuitemcheckbox" aria-checked="${einst.zeiten}">${haken(einst.zeiten)}Uhrzeiten in den Kacheln</button>
        <button type="button" class="eintrag" data-einst="abwesenheiten" role="menuitemcheckbox" aria-checked="${einst.abwesenheiten}">${haken(einst.abwesenheiten)}Abwesenheiten anzeigen</button>
        <div class="kopf">Pausenaufsichten</div>
        ${[['normal', 'In der Pause'], ['halbiert', 'Schmal neben den Stunden'], ['aus', 'Ausblenden']].map(([w, t]) => `<button type="button" class="eintrag" data-aufsichten="${w}" role="menuitemradio" aria-checked="${(einst.aufsichten ?? 'normal') === w}">${haken((einst.aufsichten ?? 'normal') === w)}${t}</button>`).join('')}
        <div class="trenner"></div>
        ${mitDruck ? `<button type="button" class="eintrag" data-drucken role="menuitem">${icon('drucken')}Drucken</button>` : ''}
        <button type="button" class="eintrag" data-link role="menuitem">${icon('link')}Link kopieren</button>
      </div></div>
    <button type="button" class="btn btn-outline-secondary btn-sm u-hilfe-knopf nicht-drucken" data-hilfe title="Hilfe zum Stundenplan" aria-label="Hilfe zum Stundenplan">${icon('hilfe')}</button>`;
}

/** Hilfe zum Stundenplan (Darstellung und Bedienung). */
export function planHilfe() {
  dialog({
    titel: 'Hilfe zum Stundenplan', breit: true,
    inhalt: `<div class="row g-4 plan-hilfe">
      <div class="col-md-6"><h3>Darstellung</h3>
        <div class="ph-zeile">${MUSTER.entfall}<span><b>Entfall</b> – die Stunde fällt aus, die Angaben sind durchgestrichen.</span></div>
        <div class="ph-zeile">${MUSTER.aenderung}<span><b>Änderung</b> – Vertretung, Raum- oder Fachwechsel; der neue Wert ist unterstrichen.</span></div>
        <div class="ph-zeile">${MUSTER.pruefung}<span><b>Prüfung</b> – Klausur oder Klassenarbeit.</span></div>
        <div class="ph-zeile">${MUSTER.termin}<span><b>Termin</b> – Veranstaltung oder zusätzliche Stunde.</span></div>
        <div class="ph-zeile">${MUSTER.abwesend}<span><b>Lehrkraft abwesend</b> – die Stunde halten andere (eigenes Kürzel durchgestrichen).</span></div>
        <div class="ph-zeile"><i class="sym sym-info ph-sym"></i><span>Notizen oder Vertretungstext zur Stunde.</span></div>
        <div class="ph-zeile"><i class="sym sym-square-pen ph-sym"></i><span>Hausaufgabe fällig.</span></div>
        <div class="ph-zeile"><span class="std-lbl weg">AB</span><span>Vertretung ohne Lehrkraft – die bisherige Lehrkraft ist durchgestrichen.</span></div></div>
      <div class="col-md-6"><h3>Bedienung</h3>
        <ul class="ps-3 mb-0"><li>Der Datumsbereich öffnet den Kalender, „Heute“ springt zur aktuellen Woche.</li>
          <li>Klasse, Lehrkraft oder Raum wählen Sie links in der Werkzeugleiste (Alt+← / Alt+→ blättert).</li>
          <li>„Woche“ und „Tag“ schalten zwischen der Wochen- und der Tagesansicht.</li>
          <li>Ein Klick auf eine Stunde öffnet die Stundendetails mit dem Klassenbuch.</li>
          <li>Die Schalter Entfall, Prüfung und Änderung blenden die Hervorhebung aus und ein; „Ansicht“ enthält weitere Einstellungen.</li></ul></div></div>`,
    knoepfe: [{ text: 'Schließen', art: 'haupt' }],
  });
}

/** Legende und Ansichtsmenü binden. neuZeichnen() wird nach dem Umschalten einer Einstellung aufgerufen. */
export function legendeBinden(wurzel, aus, einst, neuZeichnen, raster = wurzel) {
  const tt = () => raster.querySelector('.tt');
  const anwenden = () => {
    const t = tt(); if (!t) return;
    ['entfall', 'pruefung', 'aenderung'].forEach(x => t.classList.toggle('ohne-' + x, aus.has(x)));
    t.classList.toggle('ohne-symbole', !einst.symbole);
    t.classList.toggle('ohne-abwesenheiten', !einst.abwesenheiten);
  };
  anwenden();
  wurzel.querySelectorAll('[data-legende]').forEach(b => b.onclick = () => {
    const id = b.dataset.legende;
    if (aus.has(id)) aus.delete(id); else aus.add(id);
    try { localStorage.setItem('untplan:legende', JSON.stringify([...aus])); } catch { /* privat */ }
    b.classList.toggle('aus', aus.has(id));
    b.setAttribute('aria-pressed', !aus.has(id));
    anwenden();
  });
  const menue = wurzel.querySelector('[data-legende-menue]');
  const mehr = wurzel.querySelector('[data-legende-mehr]');
  mehr.onclick = ev => { ev.stopPropagation(); menue.classList.toggle('d-none'); mehr.setAttribute('aria-expanded', !menue.classList.contains('d-none')); };
  if (!window.untplanLegendeKlick) {
    window.untplanLegendeKlick = true;
    document.addEventListener('click', ev => {
      if (ev.target.closest('[data-legende-menue]')) return;
      document.querySelectorAll('[data-legende-menue]').forEach(m => m.classList.add('d-none'));
      document.querySelectorAll('[data-legende-mehr]').forEach(m => m.setAttribute('aria-expanded', 'false'));
    });
  }
  wurzel.querySelectorAll('[data-einst]').forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    einst[b.dataset.einst] = !einst[b.dataset.einst];
    einstellungenSpeichern(einst);
    neuZeichnen(true);
  });
  wurzel.querySelectorAll('[data-aufsichten]').forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    einst.aufsichten = b.dataset.aufsichten;
    einstellungenSpeichern(einst);
    neuZeichnen(true);
  });
  wurzel.querySelector('[data-drucken]')?.addEventListener('click', () => { menue.classList.add('d-none'); druckenMitAusrichtung('quer', 'stundenplan'); });
  wurzel.querySelector('[data-link]').onclick = async () => {
    menue.classList.add('d-none');
    try { await navigator.clipboard.writeText(location.href); toast('Link in die Zwischenablage kopiert.'); }
    catch { prompt('Link zum Stundenplan:', location.href); }
  };
  wurzel.querySelector('[data-hilfe]').onclick = planHilfe;
}

export function legendeAus() {
  try { return new Set(JSON.parse(localStorage.getItem('untplan:legende') ?? '[]')); } catch { return new Set(); }
}

/** Zusatz zur Elementwahl („Klassenlehrkraft: KM“, Name der Lehrkraft, Raumname). */
function elementInfo(typ, x) {
  if (!x) return '';
  if (typ === 'klasse') return x.leitung?.length ? `Klassenlehrkraft: ${x.leitung.join(', ')}` : (x.name && x.name !== x.kurz ? x.name : '');
  return x.name && x.name !== x.kurz ? x.name : '';
}

export async function zeigen(seite, kontext, [typParam, elementParam, datumParam, stundeParam]) {
  const ich = kontext.ich;
  const el = await kontext.elemente();
  const erlaubt = ich.kollegium ? ['klasse', 'lehrer', 'raum'] : ['klasse', 'raum'];
  const mein = !typParam || typParam === 'mein';
  // Erziehungsberechtigte mit mehreren Kindern: „Mein Plan“ zeigt die Klasse des gewählten Kindes
  let meinElement = ich.element, meinKind = 0;
  if (kontext.familie && (ich.klassen ?? []).length > 1) {
    try {
      const kind = Number(sessionStorage.getItem('untplan:kind'));
      const k = kind ? (await holen('/api/app/familie/kinder').catch(() => [])).find(x => x.id === kind) : null;
      if (k) { meinElement = k.klasse; meinKind = k.id; }
    } catch { /* privat */ }
  }
  if (mein && meinElement) { datumParam = /^\d{4}-/.test(elementParam ?? '') ? elementParam : datumParam; typParam = ich.typ; elementParam = meinElement; }
  const typ = erlaubt.includes(typParam) ? typParam : (ich.typ && erlaubt.includes(ich.typ) ? ich.typ : 'klasse');
  const datum = /^\d{4}-\d{2}-\d{2}$/.test(datumParam ?? '') ? datumParam : heuteIso();
  let element = elementParam;
  if (!element) element = typ === ich.typ && ich.element ? ich.element : el[LISTE[typ]][0]?.kurz;
  const ziel = (t, x, d) => `#/plan/${t}/${encodeURIComponent(x ?? '')}/${d}`;
  if (!element) {
    kontext.titel('Stundenplan');
    seite.innerHTML = '<div class="alert alert-secondary">Noch keine Stammdaten vorhanden.</div>';
    return;
  }

  // eigener Plan ohne Elementauswahl nur unter „Mein Plan“; unter „Lehrkräfte“ immer mit Auswahl (auch eigene Lehrkraft)
  const istMein = mein && typ === ich.typ && !!meinElement && element.toLowerCase() === meinElement.toLowerCase();
  kontext.titel('');
  document.title = `${istMein ? 'Mein Plan' : `${TYPEN[typ]} ${element}`} – UntPlan`;

  const einst = planEinstellungen(!!kontext.ansicht.kartenZeiten);
  const aus = legendeAus();
  const mo = montag(datum);
  const liste = el[LISTE[typ]];
  const pos = liste.findIndex(x => x.kurz.toLowerCase() === String(element).toLowerCase());
  const aktuell = liste[pos];
  const zuDatum = d => kontext.navigieren(istMein ? `#/plan/mein/${d}` : ziel(typ, element, d));
  seite.innerHTML = `
    <div class="planleiste nicht-drucken ${istMein ? 'mein' : ''}">
      <div class="links">${istMein ? `<div class="pl-mein"><b>${e(TYPEN[typ])} ${e(element)}</b>${aktuell && elementInfo(typ, aktuell) ? `<small>${e(elementInfo(typ, aktuell))}</small>` : ''}</div>` : `
        <div class="pl-gruppe"><button type="button" class="rundknopf" data-element="-1" title="Vorheriges Element (Alt+←)" aria-label="Vorheriges Element" ${pos <= 0 ? 'disabled' : ''}>${icon('links')}</button>
        <span class="element-pill"><span data-wahl></span></span>
        <button type="button" class="rundknopf" data-element="1" title="Nächstes Element (Alt+→)" aria-label="Nächstes Element" ${pos < 0 || pos >= liste.length - 1 ? 'disabled' : ''}>${icon('rechts')}</button></div>`}
      </div>
      <div class="mitte">
        <div class="pl-gruppe"><button type="button" class="rundknopf" data-woche="-7" title="Vorherige Woche" aria-label="Vorherige Woche">${icon('links')}</button>
        <span class="position-relative"><button type="button" class="zeitraum" data-kalender title="Datum wählen" aria-haspopup="dialog"><span class="pl-kw">KW ${kalenderwoche(mo)}</span>${wochenText(mo)}</button></span>
        <button type="button" class="rundknopf" data-woche="7" title="Nächste Woche" aria-label="Nächste Woche">${icon('rechts')}</button></div>
        <button type="button" class="btn btn-outline-secondary btn-sm heute-pill" data-woche="0">Heute</button>
        <div class="u-segment klein pl-ansicht" role="group" aria-label="Ansicht">${[['woche', 'Woche'], ['tag', 'Tag']].map(([w, t]) =>
          `<button type="button" data-plan-ansicht="${w}" class="${einst.ansicht === w ? 'an' : ''}" aria-pressed="${einst.ansicht === w}">${t}</button>`).join('')}</div>
      </div>
      <div class="rechts" data-legende-platz></div>
    </div>
    <div class="plan-flaeche" data-inhalt>${lade()}</div>`;

  seite.querySelector('[data-wahl]')?.replaceWith(elementWahl({
    eintraege: liste, wert: element, platzhalter: `${TYPEN[typ]} wählen`, info: x => elementInfo(typ, x),
    beiWahl: x => kontext.navigieren(ziel(typ, x, datum)),
  }));
  const blaettern = n => { const x = liste[pos + n]; if (x) kontext.navigieren(ziel(typ, x.kurz, datum)); };
  seite.querySelectorAll('[data-element]').forEach(b => b.onclick = () => blaettern(Number(b.dataset.element)));
  seite.querySelectorAll('[data-woche]').forEach(b => b.onclick = () => {
    const n = Number(b.dataset.woche);
    zuDatum(n === 0 ? heuteIso() : plusTage(mo, n));
  });
  kalenderBinden(seite.querySelector('[data-kalender]'), mo, zuDatum);
  // Werkzeugleiste und Tageskopf bleiben beim Scrollen oben stehen: Höhe der Leiste für den Tageskopf
  const leiste = seite.querySelector('.planleiste');
  const kopfHoehe = () => seite.style.setProperty('--plankopf', `${leiste.offsetHeight}px`);
  kopfHoehe();
  if (window.ResizeObserver) new ResizeObserver(kopfHoehe).observe(leiste);
  const tasten = ev => {
    if (!document.body.contains(seite) || !location.hash.startsWith('#/plan')) { document.removeEventListener('keydown', tasten); return; }
    if (!ev.altKey || ev.target.closest('input, textarea, select') || istMein) return;
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') { ev.preventDefault(); document.removeEventListener('keydown', tasten); blaettern(ev.key === 'ArrowLeft' ? -1 : 1); }
  };
  document.addEventListener('keydown', tasten);

  const istAktuell = kontext.aktuell();
  // eigene Abwesenheiten (graue Fläche hinter den Stunden) liefert der Server nur im eigenen Plan; bei mehreren Kindern das gewählte
  const plan = await holen(`/api/app/plan?typ=${typ}&element=${encodeURIComponent(element)}&datum=${datum}${istMein && meinKind ? `&schueler=${meinKind}` : ''}`);
  if (!istAktuell()) return;
  const inhalt = seite.querySelector('[data-inhalt]');
  const legende = seite.querySelector('[data-legende-platz]');
  let gewaehlt = Math.max(0, plan.tage.findIndex(t => t.datum === datum));

  const zeichnen = (menueOffen = false) => {
    inhalt.innerHTML = `
      <div class="u-plantitel"><h2>${e(TYPEN[typ])} ${e(plan.element)}${langname(plan) ? ` – ${e(langname(plan))}` : ''}</h2>
        <span class="text-body-secondary small ms-2">KW ${kalenderwoche(mo)} · ${wochenText(mo)}</span></div>
      ${tagAuswahl(plan, gewaehlt)}
      ${wochenGitter(plan, { gewaehlterTag: gewaehlt, kartenZeiten: einst.zeiten, aufsichten: einst.aufsichten })}`;
    inhalt.querySelector('.tt')?.classList.toggle('nur-tag', einst.ansicht === 'tag');
    inhalt.classList.toggle('nur-tag', einst.ansicht === 'tag');
    legende.innerHTML = legendeHtml(aus, einst);
    inhalt.querySelectorAll('[data-tagwahl]').forEach(b => b.onclick = () => { gewaehlt = Number(b.dataset.tagwahl); zeichnen(); });
    kartenBinden(inhalt, plan.karten, kontext, typ);
    legendeBinden(legende, aus, einst, () => zeichnen(true), inhalt);
    if (menueOffen) { legende.querySelector('[data-legende-menue]')?.classList.remove('d-none'); legende.querySelector('[data-legende-mehr]')?.setAttribute('aria-expanded', 'true'); }
  };
  seite.querySelectorAll('[data-plan-ansicht]').forEach(b => b.onclick = () => {
    einst.ansicht = b.dataset.planAnsicht;
    einstellungenSpeichern(einst);
    seite.querySelectorAll('[data-plan-ansicht]').forEach(x => { x.classList.toggle('an', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    zeichnen();
  });
  zeichnen();
  // Link direkt zur Stunde (#/plan/<typ>/<element>/<datum>/<stunde>, z. B. aus der Erinnerung an offene Stunden): Stundendetails öffnen
  const nr = Number(stundeParam);
  const stundeKarte = nr > 0 ? plan.karten.find(x => x.datum === datum && x.von <= nr && x.bis >= nr && x.unterricht && !x.ereignis) : null;
  if (stundeKarte) karteDialog(stundeKarte, { ...kontext, liste: plan.karten, typ });
  // Jetzt-Linie minütlich nachführen
  const takt = setInterval(() => { if (!document.body.contains(inhalt)) { clearInterval(takt); return; } if (!document.querySelector('.modal.show') && legende.querySelector('[data-legende-menue].d-none')) zeichnen(); }, 60000);
}
