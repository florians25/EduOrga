// Navigation je Rolle (Kollegium, Schüler*innen und Eltern, Klassenkonten, Administration) – Bereiche mit Symbol, Seiten als Text.
// Eigene Gliederung von EduOrga: Start · Mein Tag · Stundenpläne · Vertretungen · Unterricht & Prüfungen · Klassenbuch · Kommunikation ·
// Termine & Buchungen · Stammdaten · Verwaltung. Die Adressen (#/…) bleiben unverändert; ALIASE ergänzt sprechende Adressen.
import type { ReactNode } from 'react';
import TodayOutlined from '@mui/icons-material/TodayOutlined';
import SpaceDashboardOutlined from '@mui/icons-material/SpaceDashboardOutlined';
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined';
import CastForEducationOutlined from '@mui/icons-material/CastForEducationOutlined';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import EventAvailableOutlined from '@mui/icons-material/EventAvailableOutlined';
import ForumOutlined from '@mui/icons-material/ForumOutlined';
import StorageOutlined from '@mui/icons-material/StorageOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import SwapHorizOutlined from '@mui/icons-material/SwapHorizOutlined';
import EditNoteOutlined from '@mui/icons-material/EditNoteOutlined';
import AssignmentOutlined from '@mui/icons-material/AssignmentOutlined';
import PersonOffOutlined from '@mui/icons-material/PersonOffOutlined';
import BadgeOutlined from '@mui/icons-material/BadgeOutlined';
import type { Benutzer } from '../api/types';
import { istFamilie } from './sitzung';

export interface Punkt { nav: string; href: string; text: string; zaehler?: boolean; verborgen?: boolean }
export interface Bereich { id: string; text: string; icon: ReactNode; nav?: string; href?: string; zaehler?: boolean; unter?: Punkt[] }

export function menue(b: Benutzer): Bereich[] {
  const k = b.kollegium;
  const r = b.rechte ?? {};
  const fam = istFamilie(b);
  const m: Bereich[] = [
    { id: 'uebersicht', nav: 'uebersicht', href: '#/uebersicht', text: 'Start', icon: fam ? <BadgeOutlined /> : <SpaceDashboardOutlined /> },
    { id: 'heute', nav: 'heute', href: '#/heute', text: 'Mein Tag', icon: <TodayOutlined /> },
  ];
  // Stundenpläne: eigener Plan, Wochenpläne je Klasse/Lehrkraft/Raum, Tagesansichten (nur Kollegium)
  const plaene: Punkt[] = [];
  if (b.element) plaene.push({ nav: 'plan-mein', href: '#/plan/mein', text: 'Mein Stundenplan' });
  plaene.push({ nav: 'plan-klasse', href: '#/plan/klasse', text: 'Klassen' });
  if (k) plaene.push({ nav: 'plan-lehrer', href: '#/plan/lehrer', text: 'Lehrkräfte' });
  plaene.push({ nav: 'plan-raum', href: '#/plan/raum', text: 'Räume' });
  if (k) {
    plaene.push({ nav: 'tag-klasse', href: '#/tag/klasse', text: 'Tagesansicht Klassen' });
    plaene.push({ nav: 'tag-lehrer', href: '#/tag/lehrer', text: 'Tagesansicht Lehrkräfte' });
    plaene.push({ nav: 'tag-raum', href: '#/tag/raum', text: 'Tagesansicht Räume' });
  }
  const mitteilungen = (unter: Punkt[]): Bereich => ({ id: 'kommunikation', text: 'Kommunikation', icon: <ForumOutlined />, zaehler: true, unter });
  const sprechtag: Punkt | null = k || b.rolle === 'eltern' || b.rolle === 'schueler' ? { nav: 'sprechtag', href: '#/sprechtag', text: 'Elternsprechtag' } : null;
  if (k) {
    m.push({ id: 'stundenplan', text: 'Stundenpläne', icon: <CalendarMonthOutlined />, unter: plaene });
    m.push({ id: 'vertretungen', text: 'Vertretungen', icon: <SwapHorizOutlined />, unter: [
      { nav: 'vertretungen', href: '#/vertretungen', text: 'Vertretungsplan' },
      { nav: 'melden-abwesenheit', href: '#/melden/abwesenheit', text: 'Abwesenheit melden' },
      { nav: 'melden-meine', href: '#/melden/meine', text: 'Meine Meldungen' },
      { nav: 'melden-uebersicht', href: '#/melden', text: 'Alle Meldungen' },
    ] });
    m.push({ id: 'unterricht', text: 'Unterricht & Prüfungen', icon: <CastForEducationOutlined />, unter: [
      { nav: 'unterricht', href: '#/unterricht', text: b.element ? 'Mein Unterricht' : 'Unterricht' },
      { nav: 'unterricht-klasse', href: '#/unterricht/klasse', text: 'Unterricht einer Klasse' },
      ...(r['unterricht.klassen'] ? [{ nav: 'unterrichtklassen', href: '#/unterrichtklassen', text: 'Unterricht aller Klassen' }] : []),
      { nav: 'buchen-unterricht', href: '#/buchen/unterricht', text: 'Unterricht anlegen' },
      { nav: 'schueler', href: '#/schueler', text: 'Schüler*innen' },
      { nav: 'pruefungen', href: '#/pruefungen', text: 'Prüfungen' },
      { nav: 'melden-klausur', href: '#/melden/klausur', text: 'Prüfung eintragen' },
      { nav: 'pruefungskalender', href: '#/pruefungskalender', text: 'Prüfungskalender' },
      { nav: 'aufgaben', href: '#/aufgaben', text: 'Aufgaben' },
      { nav: 'u-tag-lehrer', href: '#/tag/lehrer/-/u', text: 'Tagesablauf Lehrkraft' },
      { nav: 'u-tag-klasse', href: '#/tag/klasse/-/u', text: 'Tagesablauf Klasse' },
      ...(b.admin || r['klassenbuch.einstellungen'] ? [{ nav: 'kbeinstellungen-unterricht', href: '#/kbeinstellungen/unterricht', text: 'Einstellungen' }] : []),
    ] });
    // Klassenbuch: im Menü nur die Einstiege; alle weiteren Seiten über die Unternavigation im Klassenbuch-Bereich (components/klassenbuch/Bereich.tsx).
    // Verborgene Punkte bleiben aufrufbar (Rechteprüfung wie bisher, alte Adressen und Lesezeichen gelten weiter).
    m.push({ id: 'klassenbuch', text: 'Klassenbuch', icon: <MenuBookOutlined />, unter: [
      { nav: 'klassenbuch-woche', href: '#/klassenbuch/-/woche', text: 'Wochenübersicht' },
      { nav: 'klassenbuch', href: '#/klassenbuch', text: b.element ? 'Meine Stunden' : 'Stunden suchen' },
      { nav: 'offen', href: '#/offen', text: 'Offene Stunden' },
      ...(b.fehlzeiten ? [{ nav: 'abwesenheiten', href: '#/abwesenheiten', text: 'Abwesenheiten' },
        { nav: 'fehlzeiten', href: '#/klassenbuch/-/fehlzeiten', text: 'Fehlzeiten', verborgen: true }] : []),
      { nav: 'klassenbuch-verlauf', href: '#/klassenbuch/-/verlauf', text: 'Inhalte & Hausaufgaben', verborgen: true },
      { nav: 'klassenbuch-vermerke', href: '#/klassenbuch/-/vermerke', text: 'Vermerke', verborgen: true },
      { nav: 'eintraege', href: '#/eintraege', text: 'Einträge', verborgen: true },
      { nav: 'hausaufgaben', href: '#/hausaufgaben', text: 'Hausaufgaben', verborgen: true },
      ...(b.fachlehrerEntschuldigungen ? [{ nav: 'entschuldigen', href: '#/entschuldigen', text: b.fehlzeiten ? 'Fehlzeiten eigener Unterricht' : 'Fehlzeiten', verborgen: !!b.fehlzeiten }] : []),
      { nav: 'befreiungen', href: '#/befreiungen', text: 'Befreiungen', verborgen: true },
      { nav: 'dienste', href: '#/dienste', text: 'Klassendienste', verborgen: true },
      { nav: 'berichte', href: '#/berichte', text: 'Auswertungen', verborgen: true },
      { nav: 'sitzplan', href: '#/sitzplan', text: 'Sitzplan', verborgen: true },
      ...(b.admin || r['klassenbuch.einstellungen'] ? [{ nav: 'kbeinstellungen', href: '#/kbeinstellungen', text: 'Einstellungen', verborgen: true }] : []),
    ] });
    m.push(mitteilungen([
      { nav: 'mitteilungen', href: '#/mitteilungen', text: 'Posteingang', zaehler: true },
      { nav: 'mitteilungen-gesendet', href: '#/mitteilungen/gesendet', text: 'Gesendet' },
      { nav: 'mitteilungen-entwuerfe', href: '#/mitteilungen/entwuerfe', text: 'Entwürfe' },
      { nav: 'mitteilungen-listen', href: '#/mitteilungen/listen', text: 'Verteilerlisten' },
      ...(sprechtag ? [sprechtag] : []),
      ...(b.rolle === 'admin' ? [{ nav: 'mitteilungen-einstellungen', href: '#/mitteilungen/einstellungen', text: 'Einstellungen' }] : []),
    ]));
    m.push({ id: 'buchen', text: 'Termine & Buchungen', icon: <EventAvailableOutlined />, unter: [
      { nav: 'buchen-raum', href: '#/buchen/raum', text: 'Raum buchen' },
      { nav: 'buchen-ressource', href: '#/buchen/ressource', text: 'Geräte & Medien buchen' },
      { nav: 'buchen-aktivitaet', href: '#/buchen/aktivitaet', text: 'Termin eintragen' },
      { nav: 'buchen-meine', href: '#/buchen/meine', text: 'Meine Buchungen' },
      { nav: 'buchen-raeume', href: '#/buchen/raeume', text: 'Raumbelegung' },
      { nav: 'buchen-ressourcen', href: '#/buchen/ressourcen', text: 'Gerätebelegung' },
      ...(b.admin ? [{ nav: 'buchen-verwaltung', href: '#/buchen/verwaltung', text: 'Geräte & Medien verwalten' },
        { nav: 'buchen-raumdaten', href: '#/buchen/raumdaten', text: 'Raumdaten' }] : []),
    ] });
  } else if (fam) {
    const mt = b.mitteilungen ?? { senden: false, antworten: false };
    if (b.element) m.push({ id: 'plan-mein', nav: 'plan-mein', href: '#/plan/mein', text: 'Mein Stundenplan', icon: <EventNoteOutlined /> });
    m.push({ id: 'weitere', text: 'Stundenpläne', icon: <CalendarMonthOutlined />, unter: plaene.filter(p => p.nav !== 'plan-mein') });
    m.push({ id: 'abwesenheiten', nav: 'abwesenheiten', href: '#/abwesenheiten', text: 'Abwesenheit melden', icon: <PersonOffOutlined /> });
    m.push({ id: 'hausaufgaben', nav: 'hausaufgaben', href: '#/hausaufgaben', text: 'Hausaufgaben', icon: <EditNoteOutlined /> });
    m.push(mitteilungen([
      { nav: 'mitteilungen', href: '#/mitteilungen', text: 'Posteingang', zaehler: true },
      ...(mt.senden || mt.antworten ? [{ nav: 'mitteilungen-gesendet', href: '#/mitteilungen/gesendet', text: 'Gesendet' },
        { nav: 'mitteilungen-entwuerfe', href: '#/mitteilungen/entwuerfe', text: 'Entwürfe' }] : []),
      ...(mt.senden ? [{ nav: 'mitteilungen-verfassen', href: '#/mitteilungen/verfassen', text: 'Neue Mitteilung' }] : []),
      ...(sprechtag ? [sprechtag] : []),
    ]));
  } else {
    if (b.element) m.push({ id: 'plan-mein', nav: 'plan-mein', href: '#/plan/mein', text: 'Mein Stundenplan', icon: <EventNoteOutlined /> });
    m.push({ id: 'weitere', text: 'Stundenpläne', icon: <CalendarMonthOutlined />, unter: plaene.filter(p => p.nav !== 'plan-mein') });
    m.push({ id: 'vertretungen', nav: 'vertretungen', href: '#/vertretungen', text: 'Vertretungen', icon: <SwapHorizOutlined /> });
    m.push({ id: 'hausaufgaben', nav: 'hausaufgaben', href: '#/hausaufgaben', text: 'Hausaufgaben', icon: <EditNoteOutlined /> });
    m.push({ id: 'pruefungen', nav: 'pruefungen', href: '#/pruefungen', text: 'Prüfungen', icon: <AssignmentOutlined /> });
    m.push(mitteilungen([
      { nav: 'mitteilungen', href: '#/mitteilungen', text: 'Posteingang', zaehler: true },
      { nav: 'mitteilungen-gesendet', href: '#/mitteilungen/gesendet', text: 'Gesendet' },
      { nav: 'mitteilungen-entwuerfe', href: '#/mitteilungen/entwuerfe', text: 'Entwürfe' },
      ...(sprechtag ? [sprechtag] : []),
    ]));
  }
  if (b.admin) {
    m.push({ id: 'stammdaten', text: 'Stammdaten', icon: <StorageOutlined />, unter: [
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
    ] });
    m.push({ id: 'admin', text: 'Verwaltung', icon: <SettingsOutlined />, unter: [
      { nav: 'admin-sync', href: '#/admin/sync', text: 'System & Datenabgleich' },
      { nav: 'admin-nachrichten', href: '#/admin/nachrichten', text: 'Nachrichten zum Tag' },
      { nav: 'hinweise', href: '#/hinweise', text: 'Hinweise Anmeldeseite' },
      { nav: 'admin-freietage', href: '#/admin/freietage', text: 'Freie Tage & Ferien' },
      { nav: 'admin-benutzer', href: '#/admin/benutzer', text: 'Benutzer' },
      { nav: 'admin-personen', href: '#/admin/personen', text: 'Personen & Konten' },
      { nav: 'admin-rechte', href: '#/admin/rechte', text: 'Rechte und Rollen' },
      { nav: 'admin-zuordnung', href: '#/admin/zuordnung', text: 'Zuordnungsgruppen' },
      { nav: 'admin-import', href: '#/admin/import', text: 'Import' },
      { nav: 'admin-export', href: '#/admin/export', text: 'Export' },
      { nav: 'admin-rueckmeldungen', href: '#/admin/rueckmeldungen', text: 'Rückmeldungen an Studio' },
      { nav: 'admin-sperren', href: '#/admin/sperren', text: 'Prüfungssperren' },
      { nav: 'admin-verspaetung', href: '#/admin/verspaetung', text: 'Verspätungen & Fehlzeiten' },
      { nav: 'admin-ansicht', href: '#/admin/ansicht', text: 'Ansichtseinstellungen' },
      { nav: 'admin-stundenkarten', href: '#/admin/stundenkarten', text: 'Darstellung der Stundenkarten' },
      { nav: 'admin-monitore', href: '#/admin/monitore', text: 'Monitoransichten' },
      { nav: 'admin-aktive', href: '#/admin/aktive', text: 'Aktive Benutzer' },
      { nav: 'admin-zugriff', href: '#/admin/zugriff', text: 'Wartungsmodus' },
      { nav: 'admin-protokoll', href: '#/admin/protokoll', text: 'Protokoll' },
      { nav: 'admin-ueber', href: '#/admin/ueber', text: 'Über EduOrga' },
    ] });
  } else {
    const unter: Punkt[] = [];
    if (b.nachrichten) unter.push({ nav: 'admin-nachrichten', href: '#/admin/nachrichten', text: 'Nachrichten zum Tag' });
    if (r['infocenter.verwalten']) unter.push({ nav: 'hinweise', href: '#/hinweise', text: 'Hinweise Anmeldeseite' });
    if (r['admin.import']) unter.push({ nav: 'admin-import', href: '#/admin/import', text: 'Import' });
    if (r['admin.wartung']) unter.push({ nav: 'admin-aktive', href: '#/admin/aktive', text: 'Aktive Benutzer' },
      { nav: 'admin-zugriff', href: '#/admin/zugriff', text: 'Wartungsmodus' }, { nav: 'admin-ueber', href: '#/admin/ueber', text: 'Über EduOrga' });
    if (r['admin.benutzer']) unter.push({ nav: 'admin-benutzer', href: '#/admin/benutzer', text: 'Benutzer' }, { nav: 'admin-personen', href: '#/admin/personen', text: 'Personen & Konten' });
    if (unter.length === 1) m.push({ id: 'admin', icon: <SettingsOutlined />, ...unter[0] });
    else if (unter.length) m.push({ id: 'admin', text: 'Verwaltung', icon: <SettingsOutlined />, unter });
  }
  return m;
}

/** Neue, sprechende Adressen als Alias der bisherigen (die bisherigen Adressen bleiben gültig, z. B. aus Lesezeichen und E-Mails). */
export const ALIASE: Record<string, string[]> = {
  start: ['uebersicht'], 'mein-tag': ['heute'], elternsprechtag: ['sprechtag'], stundenplaene: ['plan'],
  'abwesenheit-melden': ['melden', 'abwesenheit'], kommunikation: ['mitteilungen'], verwaltung: ['admin'],
  'raum-buchen': ['buchen', 'raum'], 'geraete-buchen': ['buchen', 'ressource'],
  // Klassenbuch-Bereich: sprechende Adressen der Unterseiten
  'offene-stunden': ['offen'], klassenbucheintraege: ['eintraege'], klassendienste: ['dienste'], auswertungen: ['berichte'],
  'meine-stunden': ['klassenbuch'], wochenuebersicht: ['klassenbuch', '-', 'woche'],
};

/** Adresse mit aufgelöstem Alias. */
export const ohneAlias = (teile: string[]): string[] => (teile[0] && ALIASE[teile[0]] ? [...ALIASE[teile[0]], ...teile.slice(1)] : teile);

export const allePunkte = (m: Bereich[]): Punkt[] => m.flatMap(g => g.unter ? g.unter : [{ nav: g.nav!, href: g.href!, text: g.text }]);

/** Schlüssel des aktiven Menüpunkts aus der Adresse. */
export function navAus(teile: string[], b: Benutzer): string {
  const [name, a, c] = teile;
  switch (name) {
    case 'plan': return !a || a === 'mein' ? 'plan-mein' : 'plan-' + a;
    case 'tag': return (teile[3] === 'u' ? 'u-tag-' : 'tag-') + (a || 'klasse');
    case 'unterricht': return a === 'klasse' ? 'unterricht-klasse' : 'unterricht';
    case 'mitteilungen': return ['gesendet', 'entwuerfe', 'listen', 'einstellungen', 'verfassen'].includes(a) ? 'mitteilungen-' + a : 'mitteilungen';
    case 'klassenbuch': return c === 'fehlzeiten' ? 'fehlzeiten' : c === 'verlauf' ? 'klassenbuch-verlauf' : c === 'vermerke' ? 'klassenbuch-vermerke' : c && c !== 'uebersicht' ? 'klassenbuch-woche' : 'klassenbuch';
    case 'melden': return 'melden-' + (a || 'uebersicht');
    case 'buchen': return a === 'stunden' ? 'buchen-unterricht' : 'buchen-' + (a || 'raum');
    case 'stammdaten': return 'stammdaten-' + (a || 'klassen');
    case 'kbeinstellungen': return a === 'unterricht' ? 'kbeinstellungen-unterricht' : 'kbeinstellungen';
    case 'admin': return 'admin-' + (a || (b.admin ? 'sync' : 'nachrichten'));
    default: return name || 'heute';
  }
}
