// Vertretungen: Listenansichten (Klassen, Lehrkräfte, Druckansichten, Pausenaufsichten), Filter (Ansicht, Klasse bzw.
// Lehrkraft, Zeitraum, „Nur offene“, „Nur Kollisionen“, „Veranstaltungen zusammenfassen“), wählbare Spalten, Sprung zur Nummer,
// direkte Eingabe (Vertretung, Fach, Raum, Text …) für die bearbeitete bzw. alle markierten Zeilen. Tasten: + ohne Lehrkraft,
// - Entfall, Entf zurücksetzen, Enter Vorschlag, F3 nächste offene. Offene Vertretungen und Räume tragen die Plakette „Offen“.
// Schlanke Form (Parameter schlank, Tagesplanung): nur die wichtigsten Spalten (Std., Klasse, Fach, Lehrkraft, Vertretung, Raum,
// Art als Plakette), Filter in einer aufklappbaren Fläche, seltene Aktionen im Menü „…“.
import { Input, Select, Switch } from '@fluentui/react-components';
import { MoreHorizontal20Regular } from '@fluentui/react-icons';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { api, einstellungLesen } from '@/api/client';
import type { ElementOption } from '@/api/typen';
import { useAnsicht, type AnsichtProps } from '@/kern/ansichten';
import { betrifft, melden, useEreignis } from '@/kern/ereignisse';
import { entprellen } from '@/kern/hilfen';
import { elemente, useDarfSchreiben, useStudio } from '@/kern/zustand';
import { AnsichtRahmen, Feld, FussText, Rechts, Schalter, Trenner, Werkzeug } from '@/komponenten/ansicht';
import { formular, frage, meldung } from '@/komponenten/dialoge';
import { fehlerMelden, hinweis } from '@/komponenten/hinweise';
import { MenueKnopf, type MenueListe } from '@/komponenten/menue';
import { Tabelle, type Spalte, type TabelleApi } from '@/komponenten/tabelle/Tabelle';
import { useElemente } from '../gemeinsam';
import { ANSICHTEN, ARTEN_AUS, ansichtText, artenDialog, feldEinstellungen, felderDialog, raumDialog, spaltenFeld, spaltenTitel, type ListenSpalte } from './dialoge';
import { auswahlMelden, mitRueckfragen, tageswechsel, vpfad } from './kern';
import { OptionenKnopf, OptionenTitel, useZeitraum, ZeitraumAuswahl } from './steuer';
import { automatikDialog, einstellungenDialog, sondereinsatzDialog } from './weitere';
import './vertretung.css';

const BREITE: Record<string, number> = { Nr: 56, Art: 100, Datum: 62, Std: 46, Fach: 84, NFach: 60, Lehrer: 76, Vertreter: 86, AKlassen: 100, Klassen: 76, Raum: 86, NRaum: 64, Von: 92, Nach: 92, Fix: 60, ND: 96 };
const EDITIERBAR = new Set(['NFach', 'Vertreter', 'NRaum', 'Text', 'Kz', 'SG', 'Beschr', 'Kopp', 'Text2', 'Wert']);
const ELEMENT: Record<string, string> = { NFach: 'fach', Vertreter: 'lehrer', NRaum: 'raum' };

export interface VZeile { id: string; m: Record<string, any>; [k: string]: any }
interface ListeDaten { spalten: ListenSpalte[]; zeilen: VZeile[]; offen: number }

const istVerlegungsArt = (a: string) => a === 'Tausch' || a === 'Verlegung' || a === 'Verlegt';

/** Spalten der schlanken Liste (Reihenfolge, Titel, Breite). */
const SCHLANK: [string, string, number][] = [['Datum', 'Datum', 64], ['Std', 'Std.', 52], ['Klassen', 'Klasse', 92], ['Fach', 'Fach', 72], ['Lehrer', 'Lehrkraft', 92], ['Vertreter', 'Vertretung', 112], ['NRaum', 'Raum', 84], ['Art', 'Art', 150]];
const SCHLANK_SPALTEN = new Set(SCHLANK.map((x) => x[0]));

/** Farbe der Plakette in der Spalte „Art“ (Statusfarben aus design/DESIGN.md). */
function artPlakette(m: Record<string, any>): string {
  const a = String(m.art || '');
  if (m.entfall || a === 'Entfall' || a === 'BereitschaftEntfaellt') return 'vt-chip-entfall';
  if (['Veranstaltung', 'Sondereinsatz', 'SondereinsatzVormerkung', 'Raumbuchung'].includes(a)) return 'vt-chip-termin';
  if (a === 'Klausur') return 'vt-chip-pruefung';
  if (['Freisetzung', 'VertretungOhneLehrer', 'EigenverantwortlichesArbeiten', 'Vormerkung'].includes(a)) return 'vt-chip-frei';
  if (a === 'Unterricht' || m.unterricht) return '';
  return 'vt-chip-vertretung';
}

export default function Liste({ p }: AnsichtProps) {
  const a = useAnsicht();
  const schlank = !!p.schlank;
  const alleSpalten = !!p.alleSpalten;
  const schreiben = useDarfSchreiben();
  const tageProWoche = useStudio((x) => x.grunddaten?.zeitraster?.tage?.length || 5);
  const [ansicht, setAnsicht] = useState(ANSICHTEN.includes(String(p.ansicht)) ? String(p.ansicht) : ANSICHTEN[0]!);
  const lehrerSicht = ansicht.startsWith('Lehrer') || ansicht === 'Druck - Lehrer';
  const elListe = useElemente(lehrerSicht ? 'lehrer' : 'klasse');
  const [element, setElement] = useState<number | null>(null);
  const [filter, setFilter] = useState({ offen: !!p.offen, kollisionen: false, sammeln: p.sammeln !== false });
  const [daten, setDaten] = useState<ListeDaten | null>(null);
  const [felder, setFelder] = useState<Record<string, string>>({});
  const felderRef = useRef(felder); felderRef.current = felder;
  const [vorInhalt, setVorInhalt] = useState<Record<string, boolean> | null>(null);
  const [status, setStatus] = useState<{ text: string; art?: string }>({ text: '' });
  const [nr, setNr] = useState('');
  const behalten = useRef(new Set<number>());
  const vorschlagCache = useRef(new Map<number, Promise<any>>());
  const optionenCache = useRef(new Map<string, Promise<ElementOption[]>>());
  const tabelle = useRef<TabelleApi<VZeile>>(null);
  const letzteAktiv = useRef<string | null>(null);
  const zustandRef = useRef({ ansicht, element, filter }); zustandRef.current = { ansicht, element, filter };

  const zr = useZeitraum((p.zeitraum as 'tag') || 'tag', tageProWoche, (z) => {
    a.parameterSetzen({ zeitraum: z.art });
    if (z.bis !== z.von && schreiben && z.von && z.bis) void tageswechsel(z.von, z.bis).then(() => laden());
    else void laden(z);
  });
  const zrRef = useRef(zr); zrRef.current = zr;
  const FA = () => behalten.current.size > 0 || filter.offen || filter.kollisionen || element != null || ansicht.startsWith('Druck');

  // ---- Laden ----
  const ladeNr = useRef(0);
  async function laden(z: { von: string | null; bis: string | null } = zrRef.current) {
    if (!z.von || !z.bis) return;
    const n = ++ladeNr.current;
    const { ansicht: an, element: el, filter: fi } = zustandRef.current;
    const artenAus = ((await einstellungLesen<Record<string, unknown>>(ARTEN_AUS)) || {}) as Record<string, unknown>;
    const lang = Object.entries(felderRef.current).filter(([, v]) => v.includes('L')).map(([k]) => k).join(',');
    const q = new URLSearchParams({
      von: z.von, bis: z.bis, ansicht: String(ANSICHTEN.indexOf(an)), offen: String(fi.offen), kollisionen: String(fi.kollisionen),
      sammeln: String(fi.sammeln), behalten: [...behalten.current].join(','), lang, artenAus: ((artenAus[an] as string[]) || []).join(','), unterricht: String(!!artenAus.__unterricht),
    });
    if (el) q.set('element', String(el));
    try {
      const d = await api.get<ListeDaten>(vpfad(`/liste?${q}`));
      if (n !== ladeNr.current) return;
      vorschlagCache.current = new Map();
      optionenCache.current = new Map();
      setDaten((alt) => {
        if (!alt) void feldEinstellungen(an, d.spalten).then(setFelder);
        return d;
      });
      if (schlank) melden('vertretung.liste', { von: z.von, bis: z.bis, offen: d.offen, entfall: d.zeilen.filter((x) => x.m.entfall && !x.m.unterricht).length, zeilen: d.zeilen.length });
    } catch (e) { fehlerMelden(e); }
  }
  const entprelltLaden = useMemo(() => entprellen(() => { void laden(); }, 150), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void laden(); }, [ansicht, element, filter, felder]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (daten) void feldEinstellungen(ansicht, daten.spalten).then(setFelder); }, [ansicht]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (element != null && !elListe.some((e) => e.id === element)) setElement(null); }, [elListe]); // eslint-disable-line react-hooks/exhaustive-deps
  useEreignis('daten', (e) => { if (betrifft(e, 'Vertretung', 'Stundenplan', 'Unterricht', 'Stammdaten', 'Einstellungen')) entprelltLaden(); });
  useEreignis('vertretung.ansicht', (x) => { if (ANSICHTEN.includes(x)) ansichtSetzen(x); });
  useEreignis('vertretung.auswahl', (x) => { if (x?.quelle !== a.id && x?.id && daten?.zeilen.some((z) => z.m.v === x.id)) tabelle.current?.waehle(`V${x.id}`); });
  useEreignis('vertretung.naechsteOffene', () => { if (!naechsteOffene()) hinweis('Keine weitere offene Vertretung.', 'info', 2000); });
  useEffect(() => { if (p.ansicht && ANSICHTEN.includes(String(p.ansicht)) && p.ansicht !== ansicht) ansichtSetzen(String(p.ansicht)); }, [p.ansicht]); // eslint-disable-line react-hooks/exhaustive-deps

  function ansichtSetzen(x: string) {
    setAnsicht(x);
    a.parameterSetzen({ ansicht: x });
    setVorInhalt(null);
    behalten.current.clear();
  }

  // ---- Spalten ----
  const editierbar = (z: VZeile, s: string) => {
    const m = z.m;
    if (!schreiben || !m.v || m.unterricht || !EDITIERBAR.has(s)) return false;
    if (m.fix) { setStatus({ text: `Vertretung ${m.v} ist fixiert – zum Ändern zuerst die Fixierung lösen.`, art: 'warnung' }); return false; }
    if (m.veranstaltung && s !== 'Vertreter' && s !== 'Text') return false;
    if (m.sammel && !['Text', 'Text2', 'Kz'].includes(s)) return false;
    if (m.freisetzung && ['Vertreter', 'NFach', 'NRaum'].includes(s)) return false;
    return true;
  };
  const farbe = (z: VZeile, s: string): string | null => {
    const m = z.m;
    if (s === 'Art' && m.farbe) return `color-mix(in srgb, ${m.farbe} 24%, var(--colorNeutralBackground1))`;
    if (m.koll && ((s === 'Vertreter' && m.kollL) || (s === 'NRaum' && m.kollR))) return 'var(--up-entfall-flaeche)';
    if (s === 'Vertreter' && m.pause) return 'var(--up-frei-flaeche)';
    if (istVerlegungsArt(m.art) && ['Klassen', 'Vertreter', 'NRaum', 'NFach', 'Text'].includes(s)) return 'var(--up-aenderung-flaeche)';
    if (s === 'UText' || s === 'UZText') return 'var(--colorNeutralBackground2)';
    if (m.unterricht && s !== 'Art') return 'var(--colorNeutralBackground2)';
    return null;
  };
  const zellKlasse = (z: VZeile, s: string) => {
    const m = z.m;
    if ((s === 'Vertreter' || s === 'NRaum') && z[s] === '???') return 'vt-z-offen';
    if (schlank && ['Vertreter', 'NRaum', 'NFach'].includes(s) && (z[s] === '---' || z[s] === '+++')) return 'vt-z-strich';
    if (schlank && s === 'Art' && z.Art) return `vt-chipzelle ${artPlakette(m)}`;
    if ((s === 'Vertreter' && m.offen) || (s === 'NRaum' && m.raumOffen)) return 'vt-rot';
    if (s === 'Nr' && m.koll) return 'vt-rot';
    if (m.koll && ((s === 'Vertreter' && m.kollL) || (s === 'NRaum' && m.kollR))) return 'vt-kollrand';
    return null;
  };
  const schlankeForm = schlank && !alleSpalten;
  const spalten = useMemo<Spalte<VZeile>[]>(() => {
    const liste = (daten?.spalten || []).map((s): Spalte<VZeile> => {
      const sl = schlankeForm ? SCHLANK.find((x) => x[0] === s.schluessel) : undefined;
      const leerBei = s.schluessel === 'Vertreter' || s.schluessel === 'NRaum' ? ['???', ...(schlank ? ['---', '+++'] : [])] : schlank && s.schluessel === 'NFach' ? ['---'] : null;
      return {
        schluessel: s.schluessel, titel: sl ? sl[1] : spaltenTitel(s), hinweis: spaltenFeld(s), breite: sl ? sl[2] : Math.max(s.breite, BREITE[s.schluessel] || 0),
        art: s.schluessel in ELEMENT ? 'Element' : s.nurLesen ? 'NurLesen' : 'Text', refTyp: ELEMENT[s.schluessel],
        editierbar: EDITIERBAR.has(s.schluessel) && schreiben, editierbarFuer: (z) => editierbar(z, s.schluessel),
        ausrichtung: ['Nr', 'Std', 'Entf', 'Fix', 'ND', 'Mitb', 'Neu', 'Ben', 'Zaehler'].includes(s.schluessel) ? 'rechts' : undefined,
        standard: s.standard, farbe: schlank && s.schluessel === 'Art' ? undefined : (z) => farbe(z, s.schluessel), klasse: (z) => zellKlasse(z, s.schluessel),
        wert: leerBei ? (z) => (leerBei.includes(String(z[s.schluessel] ?? '')) ? '' : z[s.schluessel]) : undefined,
      };
    });
    if (!schlankeForm) return liste;
    const rang = (k: string) => { const i = SCHLANK.findIndex((x) => x[0] === k); return i < 0 ? 999 : i; };
    return liste.sort((x, y) => rang(x.schluessel) - rang(y.schluessel));
  }, [daten?.spalten, schreiben, schlankeForm]); // eslint-disable-line react-hooks/exhaustive-deps

  // Spaltenauswahl anwenden (Einstellung bzw. „nur Spalten mit Inhalt“)
  useEffect(() => {
    if (!daten) return;
    const v: Record<string, boolean> = {};
    for (const s of daten.spalten) {
      v[s.schluessel] = schlankeForm ? SCHLANK_SPALTEN.has(s.schluessel) && (s.schluessel !== 'Datum' || zr.art !== 'tag')
        : vorInhalt ? (s.schluessel === 'Nr' || daten.zeilen.some((z) => String(z[s.schluessel] ?? '') !== '')) : (felder[s.schluessel]?.includes('a') ?? s.standard);
    }
    setTimeout(() => tabelle.current?.sichtbarSetzen(v));
  }, [felder, daten?.spalten, vorInhalt, schlankeForm, zr.art]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Aktionen ----
  const markierteIds = () => [...new Set((tabelle.current?.ausgewaehlte() || []).flatMap((x) => (x.m.gruppe?.length ? x.m.gruppe : [x.m.v])).filter((x: number) => x > 0))] as number[];
  const zielIds = (z: VZeile) => {
    const markiert = tabelle.current?.ausgewaehlte() || [];
    const liste = markiert.some((x) => x.id === z.id) ? markiert : [z];
    return [...new Set(liste.flatMap((x) => (x.m.gruppe?.length ? x.m.gruppe : [x.m.v])).filter((x: number) => x > 0))] as number[];
  };
  async function aktion(pfad: string, d: Record<string, unknown>, ids: number[]) {
    if (!ids.length) return null;
    if (FA()) ids.forEach((i) => behalten.current.add(i));
    const r = await mitRueckfragen(vpfad(pfad), { ...d, ids }, { quelle: a.id });
    await laden();
    return r;
  }
  const entfall = () => aktion('/entfall', {}, markierteIds());
  const ohneLehrer = () => aktion('/ohnelehrer', {}, markierteIds());
  const zuruecksetzen = () => aktion('/zuruecksetzen', {}, markierteIds());
  const vormerken = () => aktion('/vormerken', {}, markierteIds());
  async function kennzeichen(art: 'fix' | 'nd') {
    const liste = (tabelle.current?.ausgewaehlte() || []).filter((z) => z.m.v);
    if (!liste.length) return;
    const ziel = !liste.every((z) => (art === 'fix' ? z.m.fix : z.m.nd));
    await api.post(vpfad('/kennzeichen'), { ids: markierteIds(), art, wert: ziel }, { quelle: a.id });
    await laden();
  }
  async function loeschen() {
    const ids = markierteIds();
    const ausgew = tabelle.current?.ausgewaehlte() || [];
    if (!ids.length) return;
    const abgeleitet = ausgew.filter((z) => z.m.abgeleitet).length;
    if (abgeleitet === ausgew.length) {
      await meldung('Vertretungen, die aus einer Abwesenheit oder Veranstaltung entstehen, können nicht gelöscht werden.\n\nMit „Entfall“ entfällt die Stunde, mit „Zurücksetzen“ wird sie wieder offen. Soll sie ganz verschwinden, die Abwesenheit ändern.', 'Vertretung löschen');
      return;
    }
    if (!(await frage(`${ausgew.length - abgeleitet} Vertretung(en) löschen?${abgeleitet ? `\n\n${abgeleitet} Zeile(n) aus Abwesenheiten oder Veranstaltungen bleiben erhalten.` : ''}`, { gefahr: true, ja: 'Löschen', nein: 'Abbrechen' }))) return;
    await api.post(vpfad('/loeschen'), { ids }, { quelle: a.id });
    await laden();
  }
  async function teilen() {
    const z = tabelle.current?.aktiveZeile();
    if (!z?.m.v) return;
    const w = await formular('Vertretung teilen', [{ name: 'klassen', titel: 'Klassen der neuen Zeile', hinweis: 'Kurznamen; die übrigen bleiben in der bisherigen Zeile (leer = gleiche Klassen).' }], { okText: 'Teilen' });
    if (!w) return;
    await api.post(vpfad('/teilen'), { id: z.m.v, klassen: w.klassen }, { quelle: a.id });
    await laden();
  }
  async function lehrkraftHinzufuegen() {
    const z = (tabelle.current?.ausgewaehlte() || []).find((x) => x.m.veranstaltung);
    if (!z) { hinweis('Bitte die Zeile einer Veranstaltung markieren.', 'warnung'); return; }
    const w = await formular(`Lehrkraft zur Veranstaltung hinzufügen (${z.Datum})`, [{ name: 'lehrer', titel: 'Zusätzliche Lehrkraft', pflicht: true, hinweis: 'Kurzname, mehrere mit Komma.' }], { okText: 'Hinzufügen' });
    if (!w) return;
    const bisher = String(z.Vertreter || '').split(',').filter((x) => x && x !== '?');
    await aktion('/veranstaltungslehrer', { id: z.m.v, wert: [...bisher, w.lehrer].join(',') }, [z.m.v]).catch(fehlerMelden);
  }
  async function raumZuordnen() {
    const z = tabelle.current?.aktiveZeile();
    if (!z?.m.v || z.m.pause) return;
    if (FA()) behalten.current.add(z.m.v);
    await raumDialog(z.m.v, markierteIds(), a.id);
    await laden();
  }
  async function neuBerechnen() {
    const r = await api.post<{ uebertragen: number; hinweise?: string[] }>(vpfad('/neuberechnen'), { von: zr.von, bis: zr.bis }, { quelle: a.id });
    await laden();
    if (r.uebertragen || r.hinweise?.length) await meldung(`${r.uebertragen} Vertretung(en) umgeplanter Stunden übertragen.${r.hinweise?.length ? `\n\n${r.hinweise.join('\n')}` : ''}`, 'Änderungen des Stundenplans übernommen');
    else hinweis('Vertretungen neu berechnet.', 'ok', 2000);
  }
  function naechsteOffene(richtung = 1): boolean {
    const z = tabelle.current?.ansicht() || [];
    if (!z.length) return false;
    const start = tabelle.current?.aktIndex() ?? 0;
    for (let i = 1; i <= z.length; i++) {
      const x = z[(((start + richtung * i) % z.length) + z.length) % z.length]!;
      if (x.m.offen || x.m.raumOffen) { tabelle.current?.waehle(x.id); return true; }
    }
    return false;
  }
  function vorschlagOeffnen() {
    const t = tabelle.current;
    if (t) gewaehlt(t.ausgewaehlte(), t.aktiveZeile());
    a.oeffnen('vertretung.vorschlag', {});
  }

  // ---- Auswahl und Verknüpfung ----
  const vorschlagVorladen = useMemo(() => entprellen((z: VZeile | null) => {
    if (!z?.m.v || z.m.pause || vorschlagCache.current.has(z.m.v)) return;
    vorschlagCache.current.set(z.m.v, api.get(vpfad(`/vorschlag/${z.m.v}`)).catch(() => null));
  }, 300), []);
  function gewaehlt(zeilen: VZeile[], aktiv: VZeile | null) {
    const z = aktiv || zeilen[0] || null;
    setNr(z?.m.v ? String(z.m.v) : '');
    setStatus(z?.m.koll ? { text: `Kollision: ${z.m.koll}`, art: 'fehler' } : { text: '' });
    // bearbeitete Zeilen verschwinden erst beim Wechsel in eine andere Zeile, wenn sie nicht mehr zum Filter passen
    if (z && letzteAktiv.current && z.id !== letzteAktiv.current && behalten.current.size && !behalten.current.has(z.m.v)) { behalten.current.clear(); entprelltLaden(); }
    letzteAktiv.current = z?.id ?? null;
    if (z?.m.v) auswahlMelden({ id: z.m.v, ids: markierteIds(), zeile: z.m, quelle: a.id, text: `${z.Datum} ${z.Std}. Std. ${z.Klassen || ''}` });
    vorschlagVorladen(z);
  }

  function kontextmenue(zeilen: VZeile[]): MenueListe {
    const liste = zeilen.filter((z) => z.m.v);
    const e: MenueListe = [];
    const anzahl = markierteIds().length;
    if (liste.length) {
      const z = liste[0]!;
      e.push({ text: 'Vertretungsvorschlag', aktion: vorschlagOeffnen, taste: 'Enter' });
      if (!z.m.pause) {
        const ids = markierteIds();
        e.push({
          text: 'Vertretung zuweisen', menue: async () => {
            if (!vorschlagCache.current.has(z.m.v)) vorschlagCache.current.set(z.m.v, api.get(vpfad(`/vorschlag/${z.m.v}`)).catch(() => null));
            const v = await vorschlagCache.current.get(z.m.v);
            const k8: MenueListe = ((v?.kandidaten || []) as any[]).slice(0, 8).map((k) => ({
              text: `${k.name} · ${k.lage || k.kriterien || '–'} · Zähler ${k.zaehler || '0'}`, deaktiviert: !schreiben,
              aktion: async () => { if (FA()) ids.forEach((i) => behalten.current.add(i)); await mitRueckfragen(vpfad(`/vorschlag/${z.m.v}/uebernehmen`), { lehrer: k.lehrer, ids }, { quelle: a.id }); await laden(); },
            }));
            return k8.length ? k8 : [{ text: 'Kein Vorschlag', deaktiviert: true }];
          },
        });
      }
      e.push(null);
      const alleEntfall = liste.every((x) => x.m.entfall && !x.m.freisetzung);
      e.push(alleEntfall ? { text: 'Entfall aufheben', deaktiviert: !schreiben, aktion: entfall } : { text: `Entfall${anzahl > 1 ? ` (${anzahl} Stunden)` : ''}`, taste: '-', deaktiviert: !schreiben, aktion: entfall });
      e.push({ text: `Ohne Lehrkraft${anzahl > 1 ? ` (${anzahl} Stunden)` : ''}`, taste: '+', deaktiviert: !schreiben, aktion: ohneLehrer });
      if (liste.some((x) => x.m.veranstaltung)) e.push({ text: 'Lehrkraft zur Veranstaltung hinzufügen …', deaktiviert: !schreiben, aktion: lehrkraftHinzufuegen });
      e.push({ text: 'Vertretung teilen …', deaktiviert: !schreiben, aktion: teilen });
      e.push({ text: 'Raum zuordnen …', deaktiviert: !schreiben || z.m.pause, aktion: raumZuordnen });
      if (z.m.u && z.m.datum && z.m.stunde) e.push({ text: 'Findet online statt …', deaktiviert: !schreiben, aktion: () => import('./online').then((o) => o.onlineStundeDialog({ datum: z.m.datum, stunde: z.m.stunde, unterricht: z.m.u }, a.id)) });
      e.push({ text: 'Als Vormerkung beiseitelegen', deaktiviert: !schreiben, aktion: vormerken });
      e.push({ text: 'Nicht drucken', haken: liste.every((x) => x.m.nd), deaktiviert: !schreiben, aktion: () => kennzeichen('nd') });
      e.push({ text: 'Fixiert', haken: liste.every((x) => x.m.fix), deaktiviert: !schreiben, aktion: () => kennzeichen('fix') });
      e.push(null);
      if (z.m.vertreter) e.push({ text: `Tagesplan Lehrkraft ${z.Vertreter}`, aktion: () => a.oeffnen('vertretung.plan', { typ: 'lehrer', element: z.m.vertreter }) });
      if (z.m.lehrer && z.m.lehrer !== z.m.vertreter) e.push({ text: `Tagesplan Lehrkraft ${String(z.Lehrer).replace('*', '')}`, aktion: () => a.oeffnen('vertretung.plan', { typ: 'lehrer', element: z.m.lehrer }) });
      if (z.m.klasse) e.push({ text: `Tagesplan Klasse ${String(z.Klassen).replace(/[()]/g, '').split(',')[0]}`, aktion: () => a.oeffnen('vertretung.plan', { typ: 'klasse', element: z.m.klasse }) });
      e.push(null);
      e.push({ text: 'Zurücksetzen (wieder offen)', taste: 'Entf', deaktiviert: !schreiben, aktion: zuruecksetzen });
      e.push({ text: 'Löschen', deaktiviert: !schreiben, aktion: loeschen });
      e.push(null);
    }
    e.push({ text: 'Sondereinsatz …', deaktiviert: !schreiben, aktion: () => sondereinsatzDialog({ stunde: liste[0]?.m.stunde, klassen: liste[0]?.Klassen?.replace(/[()]/g, '') }) });
    e.push({ text: 'Tagestexte …', aktion: () => a.oeffnen('vertretung.kalender', { reiter: 0 }) });
    return e;
  }

  const tasten = (e: KeyboardEvent<HTMLDivElement>) => {
    const t = tabelle.current;
    if (!t) return false;
    const s = t.aktiveSpalte()?.schluessel || '';
    const z = t.aktiveZeile();
    const nichtEditierbar = !z || !editierbar(z, s);
    if ((e.key === '+' || e.key === '-') && !e.ctrlKey && schreiben && (s === 'Vertreter' || nichtEditierbar)) { (e.key === '+' ? ohneLehrer : entfall)().catch(fehlerMelden); return true; }
    if (e.key === 'F3') { naechsteOffene(e.shiftKey ? -1 : 1); return true; }
    if (e.key === 'Enter' && z && nichtEditierbar) { vorschlagOeffnen(); return true; }
    if (e.key === 'Delete' && z && (s === 'Vertreter' || nichtEditierbar) && schreiben) { zuruecksetzen().catch(fehlerMelden); return true; }
    return false;
  };

  const spaltenWaehlen = async () => { if (daten && (await felderDialog(ansicht, daten.spalten))) setFelder(await feldEinstellungen(ansicht, daten.spalten)); };
  const zur = async (n: number) => {
    if (!n) return;
    if (tabelle.current?.waehle(`V${n}`)) return;
    setFilter((f) => ({ ...f, offen: false, kollisionen: false }));
    setElement(null);
    await laden();
    setTimeout(() => { if (!tabelle.current?.waehle(`V${n}`)) hinweis(`Die Vertretung Nr. ${n} ist im gewählten Zeitraum nicht vorhanden.`, 'warnung'); }, 300);
  };

  const weitereAktionen = (): MenueListe => {
    const liste = (tabelle.current?.ausgewaehlte() || []).filter((z) => z.m.v);
    const keine = !liste.length;
    return [
      ...(schlank ? [{ text: 'Zurücksetzen (wieder offen)', taste: 'Entf', deaktiviert: !schreiben || keine, aktion: zuruecksetzen }, null] : []),
      { text: 'Raum zuordnen …', deaktiviert: !schreiben || keine, aktion: raumZuordnen },
      { text: 'Vertretung teilen …', deaktiviert: !schreiben || keine, aktion: teilen },
      { text: 'Lehrkraft zur Veranstaltung hinzufügen …', deaktiviert: !schreiben || !liste.some((x) => x.m.veranstaltung), aktion: lehrkraftHinzufuegen },
      { text: 'Als Vormerkung beiseitelegen', deaktiviert: !schreiben || keine, aktion: vormerken },
      { text: 'Sondereinsatz …', deaktiviert: !schreiben, aktion: () => sondereinsatzDialog({ stunde: tabelle.current?.aktiveZeile()?.m.stunde }) },
      null,
      { text: 'Fixiert', haken: !keine && liste.every((x) => x.m.fix), deaktiviert: !schreiben || keine, aktion: () => kennzeichen('fix') },
      { text: 'Nicht drucken', haken: !keine && liste.every((x) => x.m.nd), deaktiviert: !schreiben || keine, aktion: () => kennzeichen('nd') },
      null,
      { text: 'Automatische Vertretung …', deaktiviert: !schreiben, aktion: () => automatikDialog(zr.von, zr.bis) },
      { text: 'Neu berechnen', deaktiviert: !schreiben, aktion: neuBerechnen },
      { text: 'Online-Stunden im Zeitraum …', aktion: () => a.oeffnen('vertretung.online', {}) },
      { text: 'Tagestexte …', aktion: () => a.oeffnen('vertretung.kalender', { reiter: 0 }) },
      null,
      { text: 'Löschen …', deaktiviert: !schreiben || keine, aktion: loeschen },
    ];
  };
  const darstellung = (): MenueListe => [
    ...(schlank ? [{ text: 'Alle Spalten der Listenansicht', haken: alleSpalten, aktion: () => a.parameterSetzen({ alleSpalten: !alleSpalten }) }, null] : []),
    { text: 'Spalten …', deaktiviert: schlankeForm, aktion: spaltenWaehlen },
    { text: 'Nur Spalten mit Inhalt', haken: !!vorInhalt, deaktiviert: schlankeForm, aktion: () => setVorInhalt(vorInhalt ? null : {}) },
    { text: 'Angezeigte Vertretungsarten …', aktion: async () => { if (await artenDialog(ansicht)) await laden(); } },
    null,
    { text: 'Einstellungen der Vertretungsplanung …', aktion: () => einstellungenDialog(0) },
  ];
  const offenSetzen = (x: boolean) => { behalten.current.clear(); setFilter((f) => ({ ...f, offen: x })); };
  const kollSetzen = (x: boolean) => { behalten.current.clear(); setFilter((f) => ({ ...f, kollisionen: x })); };
  const sammelnSetzen = (x: boolean) => { a.parameterSetzen({ sammeln: x }); setFilter((f) => ({ ...f, sammeln: x })); };
  const ansichtFeld = <Select size="small" value={ansicht} onChange={(_, d) => ansichtSetzen(d.value)} aria-label="Ansicht">{ANSICHTEN.map((x) => <option key={x} value={x}>{ansichtText(x)}</option>)}</Select>;
  const elementFeld = (
    <Select size="small" value={element != null ? String(element) : ''} aria-label={lehrerSicht ? 'Lehrkraft' : 'Klasse'} onChange={(_, d) => { behalten.current.clear(); setElement(d.value ? Number(d.value) : null); }}>
      <option value="">(alle)</option>{elListe.map((x) => <option key={x.id} value={x.id}>{x.k}</option>)}
    </Select>
  );
  const filterAktiv = [filter.offen, filter.kollisionen, element != null, zr.art !== 'tag', ansicht !== ANSICHTEN[0], !filter.sammeln].filter(Boolean).length;
  const filterFlaeche = (
    <OptionenKnopf text="Filter" aktiv={filterAktiv} titel="Ansicht, Klasse bzw. Lehrkraft, Zeitraum und Filter der Liste" testid="liste-filter">
      <Switch label="Nur offene" title="Nur Vertretungen ohne Lehrkraft oder ohne Raum zeigen" checked={filter.offen} onChange={(_, d) => offenSetzen(d.checked)} />
      <Switch label="Nur Kollisionen" title="Nur Vertretungen mit Doppelbelegung von Lehrkraft oder Raum zeigen" checked={filter.kollisionen} onChange={(_, d) => kollSetzen(d.checked)} />
      <Switch label="Veranstaltungen zusammenfassen" title="Entfälle und Freistellungen einer Veranstaltung je Tag in einer Zeile zeigen" checked={filter.sammeln} onChange={(_, d) => sammelnSetzen(d.checked)} />
      <OptionenTitel>Ansicht</OptionenTitel>{ansichtFeld}
      <OptionenTitel>{lehrerSicht ? 'Lehrkraft' : 'Klasse'}</OptionenTitel>{elementFeld}
      <OptionenTitel>Zeitraum</OptionenTitel><ZeitraumAuswahl z={zr} />
    </OptionenKnopf>
  );
  const titel = schlank ? `Vertretungen${ansicht !== ANSICHTEN[0] ? ` – ${ansichtText(ansicht)}` : ''}` : `Vertretungen – ${ansichtText(ansicht)}`;

  return (
    <AnsichtRahmen titel={titel}
      werkzeuge={<>
        <Werkzeug text="Vorschlag" titel="Vertretungsvorschlag für die markierte Stunde (Enter, Doppelklick)" aktion={vorschlagOeffnen} />
        <Werkzeug text="Nächste offene" titel="Zur nächsten offenen Vertretung springen (F3, Umschalt+F3 rückwärts)" aktion={() => { if (!naechsteOffene()) hinweis('Keine offene Vertretung.', 'info', 2000); }} />
        {schreiben ? <>
          <Trenner />
          <Werkzeug text="Entfall" titel="Unterricht entfällt (Taste -); erneut ausgeführt wird daraus wieder eine offene Vertretung" aktion={entfall} />
          <Werkzeug text="Ohne Lehrkraft" titel="Stunde findet ohne Lehrkraft statt (Taste +)" aktion={ohneLehrer} />
          {schlank ? null : <Werkzeug text="Zurücksetzen" titel="Wieder zur offenen Vertretung machen (Entf)" aktion={zuruecksetzen} />}
        </> : null}
        {schlank ? <>
          <Trenner />
          {filterFlaeche}
          <Rechts>
            <MenueKnopf text="" icon={<MoreHorizontal20Regular />} titel="Weitere Aktionen und Darstellung" eintraege={() => [...weitereAktionen(), null, { text: 'Darstellung', menue: darstellung }]} />
          </Rechts>
        </> : <>
          <MenueKnopf text="Weitere Aktionen" titel="Weitere Aktionen für die markierten Vertretungen" eintraege={weitereAktionen} />
          <Rechts>
            <MenueKnopf text="Darstellung" titel="Spalten, angezeigte Vertretungsarten und Einstellungen" eintraege={darstellung} />
          </Rechts>
        </>}
      </>}
      filter={schlank ? undefined : <>
        <Feld titel="Ansicht">{ansichtFeld}</Feld>
        <Feld titel={lehrerSicht ? 'Lehrkraft' : 'Klasse'}>{elementFeld}</Feld>
        <Feld titel="Zeitraum"><ZeitraumAuswahl z={zr} /></Feld>
        <Schalter text="Nur offene" an={filter.offen} titel="Nur Vertretungen ohne Lehrkraft oder ohne Raum zeigen" beiAenderung={offenSetzen} />
        <Schalter text="Nur Kollisionen" an={filter.kollisionen} titel="Nur Vertretungen mit Doppelbelegung von Lehrkraft oder Raum zeigen" beiAenderung={kollSetzen} />
        <Schalter text="Veranstaltungen zusammenfassen" an={filter.sammeln} titel="Entfälle und Freistellungen einer Veranstaltung je Tag in einer Zeile zeigen" beiAenderung={sammelnSetzen} />
      </>}
      fuss={<>
        <Feld titel="Nr."><Input size="small" style={{ width: 80 }} inputMode="numeric" value={nr} title="Nummer eingeben und Enter: zur Vertretung springen" onChange={(_, d) => setNr(d.value)} onKeyDown={(e) => { if (e.key === 'Enter') void zur(Number(nr)); }} /></Feld>
        <span style={status.art === 'fehler' ? { color: 'var(--up-entfall)' } : status.art === 'warnung' ? { color: 'var(--up-warnung)' } : undefined}>{status.text}</span>
        <FussText rechts>{daten ? `${daten.zeilen.length} ${daten.zeilen.length === 1 ? 'Zeile' : 'Zeilen'} · ${daten.offen} offen` : ''}</FussText>
      </>}>
      <Tabelle<VZeile> ref={tabelle} name="vertretungen" spalten={spalten} zeilen={daten?.zeilen || []} zeilenHoehe={schlank ? 34 : 30}
        leerText="Im gewählten Zeitraum gibt es keine Vertretungen."
        zeilenKlasse={(z) => [z.m.unterricht ? 'vt-unterricht' : '', z.m.koll ? 'vt-kollision' : '', z.m.sammel ? 'vt-sammel' : '', behalten.current.has(z.m.v) ? 'vt-behalten' : ''].filter(Boolean).join(' ')}
        aendern={schreiben ? async (z, s, wert) => { await aktion('/aendern', { spalte: s.schluessel, wert }, zielIds(z)); } : undefined}
        optionen={(s) => {
          const z = tabelle.current?.aktiveZeile();
          if (!z?.m.v) return elemente(ELEMENT[s.schluessel] || 'lehrer');
          const k = `${z.m.v}/${s.schluessel}`;
          if (!optionenCache.current.has(k)) optionenCache.current.set(k, api.get<ElementOption[]>(vpfad(`/optionen?id=${z.m.v}&spalte=${s.schluessel}`)));
          return optionenCache.current.get(k)!;
        }}
        beiAuswahl={gewaehlt}
        beiDoppelklick={(z) => { if (z.m.sammel) { a.parameterSetzen({ sammeln: false }); setFilter((f) => ({ ...f, sammeln: false })); return; } vorschlagOeffnen(); }}
        kontextmenue={kontextmenue}
        tasten={tasten} />
    </AnsichtRahmen>
  );
}
