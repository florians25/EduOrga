// Modul „Vertretungsplanung“ (Vertretungsmodus): Planungsdatum in der Kopfleiste (Strg+Bild↑/↓, Woche mit Umschalt), Arbeitsplätze
// „Tagesplanung“ (geführter Tagesablauf mit Arbeitsliste der offenen Stunden bzw. Expertenansicht), „Verlegen und Tauschen“ und „Kompaktpläne“,
// „Wer ist frei?“, Belastung der Lehrkräfte, Abwesenheiten, Vertretungen, Vorschlag, automatische
// Vertretung, Sondereinsätze, Bereitschaften, Vormerkungen, Tagespläne, Online-Stunden, Listenansichten und Einstellungen.
import { lazy } from 'react';
import { seiteOeffnen, tasteRegistrieren, type Befehlseintrag } from '@/kern/befehle';
import { melden } from '@/kern/ereignisse';
import { useStudio, zustand } from '@/kern/zustand';
import { kopfleistenElement } from '@/shell/kopfleiste-elemente';
import type { StudioModul } from '../typen';
import { ANSICHTEN, ansichtText } from './dialoge';
import { blaettern, datumSetzen, isoAus, planungsdatum, tageswechsel } from './kern';
import { DatumsAuswahl } from './steuer';
import { automatikDialog, einstellungenDialog, sondereinsatzDialog } from './weitere';

const D = 'dokument' as const;
const V = 'vertretung' as const;
const ansicht = (typ: string, p?: Record<string, unknown>) => ({ typ, p: p as never });

const plan = (id: string, text: string, typ: string, extra: Record<string, unknown> = {}): Befehlseintrag =>
  ({ id, text, ansicht: ansicht('vertretung.plan', { typ, ...extra }), braucht: D, gruppe: 'Tagespläne', modus: V });

const modul: StudioModul = {
  id: 'vertretung',
  ansichten: {
    'vertretung.kalender': { titel: 'Kalender', pfad: 'vertretung/kalender', modus: V, komponente: lazy(() => import('./Kalender')) },
    'vertretung.absenzen': { titel: 'Abwesenheiten', pfad: 'vertretung/abwesenheiten', modus: V, komponente: lazy(() => import('./Absenzen')) },
    'vertretung.liste': { titel: 'Vertretungen', pfad: 'vertretung/vertretungen', modus: V, komponente: lazy(() => import('./Liste')) },
    'vertretung.vorschlag': { titel: 'Vertretungsvorschlag', pfad: 'vertretung/vorschlag', modus: V, komponente: lazy(() => import('./Vorschlag')) },
    'vertretung.plan': { titel: 'Tagesplan', pfad: 'vertretung/tagesplan', modus: V, schluessel: (p) => `${p.typ || 'klasse'}${p.rolle ? `:${p.rolle}` : ''}`, komponente: lazy(() => import('./Tagesplan')) },
    'vertretung.bereitschaften': { titel: 'Bereitschaften', pfad: 'vertretung/bereitschaften', modus: V, komponente: lazy(() => import('./Bereitschaft').then((m) => ({ default: m.Bereitschaften }))) },
    'vertretung.bereitschaftsplanung': { titel: 'Bereitschaftsplanung', pfad: 'bereitschaftsplanung', komponente: lazy(() => import('./Bereitschaft').then((m) => ({ default: m.Bereitschaftsplanung }))) },
    'vertretung.vormerkungen': { titel: 'Vormerkungen', pfad: 'vertretung/vormerkungen', modus: V, komponente: lazy(() => import('./Vormerkungen')) },
    'vertretung.online': { titel: 'Online-Stunden', pfad: 'vertretung/online', modus: V, komponente: lazy(() => import('./online')) },
    // Tagesablauf der Tagesplanung (auch als eigene Seiten)
    'vertretung.erfassen': { titel: 'Abwesenheiten erfassen', pfad: 'vertretung/abwesenheiten-erfassen', modus: V, komponente: lazy(() => import('./ablauf/Erfassen')) },
    'vertretung.arbeitsliste': { titel: 'Offene Stunden', pfad: 'vertretung/offene-stunden', modus: V, komponente: lazy(() => import('./ablauf/Arbeitsliste')) },
    'vertretung.frei': { titel: 'Wer ist frei?', pfad: 'vertretung/wer-ist-frei', modus: V, komponente: lazy(() => import('./ablauf/WerIstFrei')) },
    'vertretung.tagesbilanz': { titel: 'Prüfen und veröffentlichen', pfad: 'vertretung/tagesbilanz', modus: V, komponente: lazy(() => import('./ablauf/Pruefen')) },
    'vertretung.belastung': { titel: 'Belastung der Lehrkräfte', pfad: 'vertretung/belastung', modus: V, komponente: lazy(() => import('./ablauf/Pruefen').then((m) => ({ default: m.Belastung }))) },
  },
  arbeitsplaetze: {
    tagesplanung: { titel: 'Tagesplanung', modus: V, komponente: lazy(() => import('./Arbeitsplaetze').then((m) => ({ default: m.Tagesplanung }))) },
    verlegen: { titel: 'Verlegen und Tauschen', modus: V, komponente: lazy(() => import('./Arbeitsplaetze').then((m) => ({ default: m.Verlegen }))) },
    kompakt: { titel: 'Kompaktpläne', modus: V, komponente: lazy(() => import('./Arbeitsplaetze').then((m) => ({ default: m.Kompakt }))) },
  },
  befehle: {
    'vertretung.oeffnen': ({ fenster = 'vertretung.liste', ...p }: { fenster?: string } & Record<string, unknown>) => seiteOeffnen(fenster, p as never),
    'vertretung.kalender': () => seiteOeffnen('vertretung.kalender'),
    'vertretung.absenzen': (p: Record<string, unknown>) => seiteOeffnen('vertretung.absenzen', p as never),
    'vertretung.liste': (p: Record<string, unknown>) => seiteOeffnen('vertretung.liste', p as never),
    'vertretung.vorschlag': () => seiteOeffnen('vertretung.vorschlag'),
    'vertretung.automatik': () => automatikDialog(planungsdatum(), planungsdatum()),
    'vertretung.sondereinsatz': () => sondereinsatzDialog({}),
    'vertretung.bereitschaften': () => seiteOeffnen('vertretung.bereitschaften'),
    'vertretung.bereitschaftsplanung': () => seiteOeffnen('vertretung.bereitschaftsplanung'),
    'vertretung.vormerkungen': () => seiteOeffnen('vertretung.vormerkungen'),
    'vertretung.plan': ({ typ = 'klasse', kompakt }: { typ?: string; kompakt?: boolean } = {}) => seiteOeffnen('vertretung.plan', { typ, kompakt }),
    'vertretung.format': ({ ansicht: a }: { ansicht: string }) => { seiteOeffnen('vertretung.liste', { ansicht: a }); melden('vertretung.ansicht', a); },
    'vertretung.einstellungen': ({ seite = 0 }: { seite?: number } = {}) => einstellungenDialog(seite),
    'vertretung.heute': () => datumSetzen(isoAus(new Date())),
    'vertretung.naechster': () => blaettern(1),
    'vertretung.vorheriger': () => blaettern(-1),
    'vertretung.naechsteWoche': () => blaettern(1, true),
    'vertretung.vorherigeWoche': () => blaettern(-1, true),
  },
  eintraege: [
    { id: 'vertretung.tagesplanung', text: 'Tagesplanung', arbeitsplatz: 'tagesplanung', braucht: D, gruppe: 'Vertretungsplanung', hinweis: 'Tagesablauf: Abwesenheiten erfassen, offene Stunden lösen, prüfen und veröffentlichen (oder Expertenansicht)' },
    { id: 'vertretung.werIstFrei', text: 'Wer ist frei?', ansicht: ansicht('vertretung.frei'), braucht: D, gruppe: 'Vertretungsplanung', hinweis: 'Lehrkräfte × Stunden des Planungstags mit Belastung' },
    { id: 'vertretung.belastung', text: 'Belastung der Lehrkräfte', ansicht: ansicht('vertretung.belastung'), braucht: D, gruppe: 'Vertretungsplanung', hinweis: 'Vertretungen je Lehrkraft heute, in der Woche und im Monat, Mehrarbeit (NRW)' },
    { id: 'vertretung.kalender', text: 'Kalender', ansicht: ansicht('vertretung.kalender'), braucht: D, gruppe: 'Vertretungsplanung', menue: [
      { text: 'Kalender', ansicht: ansicht('vertretung.kalender') },
      { text: 'Heute', befehl: 'vertretung.heute' },
      { text: 'Nächster Unterrichtstag', befehl: 'vertretung.naechster', taste: 'Strg+Bild↓' },
      { text: 'Vorheriger Unterrichtstag', befehl: 'vertretung.vorheriger', taste: 'Strg+Bild↑' },
      { text: 'Eine Woche weiter', befehl: 'vertretung.naechsteWoche', taste: 'Strg+Umschalt+Bild↓' },
      { text: 'Eine Woche zurück', befehl: 'vertretung.vorherigeWoche', taste: 'Strg+Umschalt+Bild↑' },
    ] },
    { id: 'vertretung.absenzen', text: 'Abwesenheiten', ansicht: ansicht('vertretung.absenzen'), braucht: D, taste: 'Strg+M', gruppe: 'Vertretungsplanung', menue: [
      { text: 'Abwesenheiten', ansicht: ansicht('vertretung.absenzen') },
      { text: 'Abwesenheitsgründe', ansicht: ansicht('stammdaten', { typ: 'abwesenheitsgrund' }) },
    ] },
    { id: 'vertretung.vertretungen', text: 'Vertretungen', ansicht: ansicht('vertretung.liste'), braucht: D, taste: 'Strg+T', gruppe: 'Vertretungsplanung', menue: [
      { text: 'Vertretungen', ansicht: ansicht('vertretung.liste') },
      { text: 'Vertretungsvorschlag', ansicht: ansicht('vertretung.vorschlag') },
      null,
      { text: 'Automatische Vertretung …', befehl: 'vertretung.automatik', braucht: 'schreiben' },
    ] },
    { id: 'vertretung.vorschlag', text: 'Vertretungsvorschlag', ansicht: ansicht('vertretung.vorschlag'), braucht: D, taste: 'Strg+G', gruppe: 'Vertretungsplanung' },
    { id: 'vertretung.automatik', text: 'Automatische Vertretung', befehl: 'vertretung.automatik', braucht: 'schreiben', gruppe: 'Vertretungsplanung' },
    { id: 'vertretung.sondereinsaetze', text: 'Sondereinsätze', befehl: 'vertretung.sondereinsatz', braucht: 'schreiben', gruppe: 'Ereignisse' },
    { id: 'vertretung.bereitschaften', text: 'Bereitschaften', ansicht: ansicht('vertretung.bereitschaften'), braucht: D, gruppe: 'Ereignisse' },
    { id: 'vertretung.planungsdialog', text: 'Verlegen und Tauschen', arbeitsplatz: 'verlegen', braucht: D, gruppe: 'Vertretungsplanung', hinweis: 'Tagespläne von Klasse und Lehrkraft nebeneinander (Drag & Drop: Verlegen, Tauschen)' },
    { id: 'vertretung.vormerkungen', text: 'Vormerkungen', ansicht: ansicht('vertretung.vormerkungen'), braucht: D, gruppe: 'Vertretungsplanung' },
    { id: 'vertretung.online', text: 'Online-Stunden', ansicht: ansicht('vertretung.online'), braucht: D, gruppe: 'Vertretungsplanung', hinweis: 'Stunden, die an einzelnen Tagen abweichend online oder in Präsenz stattfinden' },
    plan('vertretung.plan.klasse', 'Tagesplan Klasse', 'klasse'),
    plan('vertretung.plan.lehrer', 'Tagesplan Lehrkraft', 'lehrer'),
    plan('vertretung.plan.raum', 'Tagesplan Raum', 'raum'),
    { id: 'vertretung.plan.klein', text: 'Kompaktpläne', arbeitsplatz: 'kompakt', braucht: D, gruppe: 'Tagespläne', hinweis: 'Kompakte Tagespläne nebeneinander – folgen der gewählten Vertretung', menue: [
      { text: 'Kompaktpläne nebeneinander', arbeitsplatz: 'kompakt' },
      null,
      { text: 'Kompaktplan Klasse', ansicht: ansicht('vertretung.plan', { typ: 'klasse', kompakt: true }) },
      { text: 'Kompaktplan Lehrkraft', ansicht: ansicht('vertretung.plan', { typ: 'lehrer', kompakt: true }) },
      { text: 'Kompaktplan Raum', ansicht: ansicht('vertretung.plan', { typ: 'raum', kompakt: true }) },
    ] },
    { id: 'vertretung.formate', text: 'Listenansichten', braucht: D, gruppe: 'Vertretungsplanung', menue: [
      ...ANSICHTEN.map((x) => ({ text: ansichtText(x), befehl: 'vertretung.format', args: { ansicht: x } })),
      null,
      { text: 'Arbeitsplatz Tagesplanung', arbeitsplatz: 'tagesplanung' },
      { text: 'Gespeicherte Arbeitsplätze …', befehl: 'fenster.anordnungen' },
    ] },
    { id: 'vertretung.einstellungen', text: 'Einstellungen der Vertretungsplanung', befehl: 'vertretung.einstellungen', braucht: D, gruppe: 'Vertretungsplanung', menue: [
      { text: 'Regeln je Stunde …', befehl: 'vertretung.einstellungen', args: { seite: 0 } },
      { text: 'Vertretungszähler …', befehl: 'vertretung.einstellungen', args: { seite: 1 } },
      { text: 'Vertretungsvorschlag …', befehl: 'vertretung.einstellungen', args: { seite: 2 } },
      { text: 'Allgemein …', befehl: 'vertretung.einstellungen', args: { seite: 3 } },
      { text: 'Arten und Farben …', befehl: 'vertretung.einstellungen', args: { seite: 4 } },
    ] },
    { id: 'eingabe.bereitschaft', text: 'Bereitschaftsplanung', ansicht: ansicht('vertretung.bereitschaftsplanung'), braucht: D, gruppe: 'Ereignisse' },
  ],
  start() {
    kopfleistenElement({ id: 'vertretung.datum', komponente: DatumsAuswahl, modus: V, ort: 'mitte' });
    const imModus = (f: () => unknown) => () => { const z = zustand(); if (z.dokument && z.modus === 'vertretung') return f(); return undefined; };
    tasteRegistrieren('Strg+PageUp', imModus(() => blaettern(-1)));
    tasteRegistrieren('Strg+PageDown', imModus(() => blaettern(1)));
    tasteRegistrieren('Strg+Umschalt+PageUp', imModus(() => blaettern(-1, true)));
    tasteRegistrieren('Strg+Umschalt+PageDown', imModus(() => blaettern(1, true)));
    // Wechsel in den Vertretungsmodus: Vertretungen des Planungsdatums abgleichen (wie beim Tageswechsel)
    useStudio.subscribe((s, alt) => {
      const d = planungsdatum();
      if (s.modus === 'vertretung' && alt.modus !== 'vertretung' && s.dokument && d && s.benutzer?.darfSchreiben) void tageswechsel(d, d);
    });
  },
};

export default modul;
