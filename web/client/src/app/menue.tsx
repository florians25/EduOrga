// Navigation je Rolle (Kollegium, Schüler*innen und Eltern, Klassenkonten, Administration) – Bereiche mit Symbol, Seiten als Text.
import type { ReactNode } from 'react';
import TodayOutlined from '@mui/icons-material/TodayOutlined';
import SpaceDashboardOutlined from '@mui/icons-material/SpaceDashboardOutlined';
import MailOutline from '@mui/icons-material/MailOutline';
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import EventNoteOutlined from '@mui/icons-material/EventNoteOutlined';
import CastForEducationOutlined from '@mui/icons-material/CastForEducationOutlined';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import AssignmentLateOutlined from '@mui/icons-material/AssignmentLateOutlined';
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
  const m: Bereich[] = [
    { id: 'heute', nav: 'heute', href: '#/heute', text: 'Heute', icon: <TodayOutlined /> },
    { id: 'uebersicht', nav: 'uebersicht', href: '#/uebersicht', text: 'Übersicht', icon: <SpaceDashboardOutlined /> },
    { id: 'mitteilungen', text: 'Mitteilungen', icon: <MailOutline />, zaehler: true, unter: [
      { nav: 'mitteilungen', href: '#/mitteilungen', text: 'Posteingang', zaehler: true },
      { nav: 'mitteilungen-gesendet', href: '#/mitteilungen/gesendet', text: 'Gesendet' },
      { nav: 'mitteilungen-entwuerfe', href: '#/mitteilungen/entwuerfe', text: 'Entwürfe' },
      ...(k ? [{ nav: 'mitteilungen-listen', href: '#/mitteilungen/listen', text: 'Listen' }] : []),
      ...(b.rolle === 'admin' ? [{ nav: 'mitteilungen-einstellungen', href: '#/mitteilungen/einstellungen', text: 'Einstellungen' }] : []),
    ] },
  ];
  const plaene: Punkt[] = [];
  if (b.element) plaene.push({ nav: 'plan-mein', href: '#/plan/mein', text: 'Mein Stundenplan' });
  plaene.push({ nav: 'plan-klasse', href: '#/plan/klasse', text: 'Klasse' });
  if (k) plaene.push({ nav: 'plan-lehrer', href: '#/plan/lehrer', text: 'Lehrkraft' });
  plaene.push({ nav: 'plan-raum', href: '#/plan/raum', text: 'Raum' });
  if (k) {
    plaene.push({ nav: 'tag-klasse', href: '#/tag/klasse', text: 'Tag – Klassen' });
    plaene.push({ nav: 'tag-lehrer', href: '#/tag/lehrer', text: 'Tag – Lehrkräfte' });
    plaene.push({ nav: 'tag-raum', href: '#/tag/raum', text: 'Tag – Räume' });
    plaene.push({ nav: 'vertretungen', href: '#/vertretungen', text: 'Vertretungsplan' });
    m.push({ id: 'stundenplan', text: 'Stundenplan', icon: <CalendarMonthOutlined />, unter: plaene });
    m.push({ id: 'unterricht', text: 'Unterricht', icon: <CastForEducationOutlined />, unter: [
      { nav: 'unterricht', href: '#/unterricht', text: b.element ? 'Mein Unterricht' : 'Unterricht' },
      { nav: 'buchen-unterricht', href: '#/buchen/unterricht', text: 'Neuer Unterricht' },
      { nav: 'unterricht-klasse', href: '#/unterricht/klasse', text: 'Klasse' },
      ...(r['unterricht.klassen'] ? [{ nav: 'unterrichtklassen', href: '#/unterrichtklassen', text: 'Unterricht Klassen' }] : []),
      { nav: 'schueler', href: '#/schueler', text: 'Schüler*in' },
      { nav: 'pruefungen', href: '#/pruefungen', text: 'Prüfungen' },
      { nav: 'pruefungskalender', href: '#/pruefungskalender', text: 'Prüfungskalender' },
      { nav: 'aufgaben', href: '#/aufgaben', text: 'Aufgaben' },
      { nav: 'u-tag-lehrer', href: '#/tag/lehrer/-/u', text: 'Lehrkraft – Tag' },
      { nav: 'u-tag-klasse', href: '#/tag/klasse/-/u', text: 'Klasse – Tag' },
      ...(b.admin || r['klassenbuch.einstellungen'] ? [{ nav: 'kbeinstellungen-unterricht', href: '#/kbeinstellungen/unterricht', text: 'Einstellungen' }] : []),
    ] });
    m.push({ id: 'klassenbuch', text: 'Klassenbuch', icon: <MenuBookOutlined />, unter: [
      { nav: 'klassenbuch', href: '#/klassenbuch', text: 'Übersicht' },
      { nav: 'offen', href: '#/offen', text: 'Offene Stunden' },
      { nav: 'eintraege', href: '#/eintraege', text: 'Klassenbucheinträge' },
      { nav: 'hausaufgaben', href: '#/hausaufgaben', text: 'Hausaufgaben' },
      { nav: 'dienste', href: '#/dienste', text: 'Klassendienste' },
      { nav: 'berichte', href: '#/berichte', text: 'Berichte' },
      { nav: 'klassenbuch-woche', href: '#/klassenbuch/-/woche', text: 'Wochenübersicht' },
      ...(b.fehlzeiten ? [{ nav: 'abwesenheiten', href: '#/abwesenheiten', text: 'Abwesenheiten' },
        { nav: 'fehlzeiten', href: '#/klassenbuch/-/fehlzeiten', text: 'Fehlzeiten' }] : []),
      ...(b.fachlehrerEntschuldigungen ? [{ nav: 'entschuldigen', href: '#/entschuldigen', text: b.fehlzeiten ? 'Fehlzeiten eigener Unterricht' : 'Fehlzeiten' }] : []),
      { nav: 'befreiungen', href: '#/befreiungen', text: 'Befreiungen' },
      { nav: 'sitzplan', href: '#/sitzplan', text: 'Sitzplan', verborgen: true },
      ...(b.admin || r['klassenbuch.einstellungen'] ? [{ nav: 'kbeinstellungen', href: '#/kbeinstellungen', text: 'Einstellungen' }] : []),
    ] });
    m.push({ id: 'melden', text: 'Melden', icon: <AssignmentLateOutlined />, unter: [
      { nav: 'melden-uebersicht', href: '#/melden', text: 'Übersicht' },
      { nav: 'melden-abwesenheit', href: '#/melden/abwesenheit', text: 'Abwesenheit melden' },
      { nav: 'melden-klausur', href: '#/melden/klausur', text: 'Prüfung eintragen' },
      { nav: 'melden-meine', href: '#/melden/meine', text: 'Meine Meldungen' },
    ] });
    m.push({ id: 'buchen', text: 'Buchen', icon: <EventAvailableOutlined />, unter: [
      { nav: 'buchen-raum', href: '#/buchen/raum', text: 'Raum buchen' },
      { nav: 'buchen-ressource', href: '#/buchen/ressource', text: 'Ressource buchen' },
      { nav: 'buchen-aktivitaet', href: '#/buchen/aktivitaet', text: 'Neue Aktivität' },
      { nav: 'buchen-meine', href: '#/buchen/meine', text: 'Meine Buchungen' },
      { nav: 'buchen-raeume', href: '#/buchen/raeume', text: 'Raumübersicht' },
      { nav: 'buchen-ressourcen', href: '#/buchen/ressourcen', text: 'Ressourcenübersicht' },
      ...(b.admin ? [{ nav: 'buchen-verwaltung', href: '#/buchen/verwaltung', text: 'Ressourcen verwalten' },
        { nav: 'buchen-raumdaten', href: '#/buchen/raumdaten', text: 'Raumdaten' }] : []),
    ] });
  } else if (istFamilie(b)) {
    m[1] = { id: 'uebersicht', nav: 'uebersicht', href: '#/uebersicht', text: 'Übersicht', icon: <BadgeOutlined /> };
    const mt = b.mitteilungen ?? { senden: false, antworten: false };
    m[2] = { id: 'mitteilungen', text: 'Mitteilungen', icon: <MailOutline />, zaehler: true, unter: [
      { nav: 'mitteilungen', href: '#/mitteilungen', text: 'Posteingang', zaehler: true },
      ...(mt.senden || mt.antworten ? [{ nav: 'mitteilungen-gesendet', href: '#/mitteilungen/gesendet', text: 'Gesendet' },
        { nav: 'mitteilungen-entwuerfe', href: '#/mitteilungen/entwuerfe', text: 'Entwürfe' }] : []),
      ...(mt.senden ? [{ nav: 'mitteilungen-verfassen', href: '#/mitteilungen/verfassen', text: 'Verfassen' }] : []),
    ] };
    if (b.element) m.push({ id: 'plan-mein', nav: 'plan-mein', href: '#/plan/mein', text: 'Mein Stundenplan', icon: <EventNoteOutlined /> });
    m.push({ id: 'weitere', text: 'Weitere Stundenpläne', icon: <CalendarMonthOutlined />, unter: plaene.filter(p => p.nav !== 'plan-mein') });
    m.push({ id: 'abwesenheiten', nav: 'abwesenheiten', href: '#/abwesenheiten', text: 'Abwesenheiten', icon: <PersonOffOutlined /> });
    m.push({ id: 'hausaufgaben', nav: 'hausaufgaben', href: '#/hausaufgaben', text: 'Hausaufgaben', icon: <EditNoteOutlined /> });
  } else {
    if (b.element) m.push({ id: 'plan-mein', nav: 'plan-mein', href: '#/plan/mein', text: 'Mein Stundenplan', icon: <EventNoteOutlined /> });
    m.push({ id: 'weitere', text: 'Weitere Stundenpläne', icon: <CalendarMonthOutlined />, unter: plaene.filter(p => p.nav !== 'plan-mein') });
    m.push({ id: 'vertretungen', nav: 'vertretungen', href: '#/vertretungen', text: 'Vertretungsplan', icon: <SwapHorizOutlined /> });
    m.push({ id: 'hausaufgaben', nav: 'hausaufgaben', href: '#/hausaufgaben', text: 'Hausaufgaben', icon: <EditNoteOutlined /> });
    m.push({ id: 'pruefungen', nav: 'pruefungen', href: '#/pruefungen', text: 'Prüfungen', icon: <AssignmentOutlined /> });
  }
  if (k || b.rolle === 'eltern' || b.rolle === 'schueler') m.push({ id: 'sprechtag', nav: 'sprechtag', href: '#/sprechtag', text: 'Sprechtag', icon: <ForumOutlined /> });
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
    m.push({ id: 'admin', text: 'Administration', icon: <SettingsOutlined />, unter: [
      { nav: 'admin-sync', href: '#/admin/sync', text: 'Übersicht & Synchronisation' },
      { nav: 'admin-nachrichten', href: '#/admin/nachrichten', text: 'Nachrichten zum Tag' },
      { nav: 'hinweise', href: '#/hinweise', text: 'Hinweise Anmeldeseite' },
      { nav: 'admin-freietage', href: '#/admin/freietage', text: 'Freie Tage & Ferien' },
      { nav: 'admin-import', href: '#/admin/import', text: 'Import' },
      { nav: 'admin-export', href: '#/admin/export', text: 'Export' },
      { nav: 'admin-aktive', href: '#/admin/aktive', text: 'Aktive Benutzer' },
      { nav: 'admin-zugriff', href: '#/admin/zugriff', text: 'Zugriff ent-/sperren' },
      { nav: 'admin-ueber', href: '#/admin/ueber', text: 'Über UntPlan' },
      { nav: 'admin-rechte', href: '#/admin/rechte', text: 'Rechte und Rollen' },
      { nav: 'admin-benutzer', href: '#/admin/benutzer', text: 'Benutzer' },
      { nav: 'admin-personen', href: '#/admin/personen', text: 'Personen & Konten' },
      { nav: 'admin-zuordnung', href: '#/admin/zuordnung', text: 'Zuordnungsgruppen' },
      { nav: 'admin-rueckmeldungen', href: '#/admin/rueckmeldungen', text: 'Rückmeldungen' },
      { nav: 'admin-sperren', href: '#/admin/sperren', text: 'Prüfungssperren' },
      { nav: 'admin-verspaetung', href: '#/admin/verspaetung', text: 'Verspätungen & Fehlzeiten' },
      { nav: 'admin-ansicht', href: '#/admin/ansicht', text: 'Ansichtseinstellungen' },
      { nav: 'admin-stundenkarten', href: '#/admin/stundenkarten', text: 'Darstellung der Stundenkarten' },
      { nav: 'admin-monitore', href: '#/admin/monitore', text: 'Monitoransichten' },
      { nav: 'admin-protokoll', href: '#/admin/protokoll', text: 'Protokoll' },
    ] });
  } else {
    const unter: Punkt[] = [];
    if (b.nachrichten) unter.push({ nav: 'admin-nachrichten', href: '#/admin/nachrichten', text: 'Nachrichten zum Tag' });
    if (r['infocenter.verwalten']) unter.push({ nav: 'hinweise', href: '#/hinweise', text: 'Hinweise Anmeldeseite' });
    if (r['admin.import']) unter.push({ nav: 'admin-import', href: '#/admin/import', text: 'Import' });
    if (r['admin.wartung']) unter.push({ nav: 'admin-aktive', href: '#/admin/aktive', text: 'Aktive Benutzer' },
      { nav: 'admin-zugriff', href: '#/admin/zugriff', text: 'Zugriff ent-/sperren' }, { nav: 'admin-ueber', href: '#/admin/ueber', text: 'Über UntPlan' });
    if (r['admin.benutzer']) unter.push({ nav: 'admin-benutzer', href: '#/admin/benutzer', text: 'Benutzer' }, { nav: 'admin-personen', href: '#/admin/personen', text: 'Personen & Konten' });
    if (unter.length === 1) m.push({ id: 'admin', icon: <SettingsOutlined />, ...unter[0] });
    else if (unter.length) m.push({ id: 'admin', text: 'Administration', icon: <SettingsOutlined />, unter });
  }
  return m;
}

export const allePunkte = (m: Bereich[]): Punkt[] => m.flatMap(g => g.unter ? g.unter : [{ nav: g.nav!, href: g.href!, text: g.text }]);

/** Schlüssel des aktiven Menüpunkts aus der Adresse. */
export function navAus(teile: string[], b: Benutzer): string {
  const [name, a, c] = teile;
  switch (name) {
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
