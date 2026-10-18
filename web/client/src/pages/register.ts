// Seiten der App (je Adresse „#/<name>/…“), nachgeladen beim ersten Aufruf.
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { Benutzer } from '../api/types';
import type { Punkt } from '../app/menue';

export interface SeitenProps { teile: string[]; nav: string }
type Seite = LazyExoticComponent<ComponentType<SeitenProps>>;

const p = (f: () => Promise<{ default: ComponentType<SeitenProps> }>) => lazy(f);

export const SEITEN: Record<string, Seite> = {
  heute: p(() => import('./Heute')),
  plan: p(() => import('./plan/PlanSeite')),
  uebersicht: p(() => import('./Uebersicht')),
  tag: p(() => import('./TagSeite')),
  vertretungen: p(() => import('./Vertretungen')),
  mitteilungen: p(() => import('./mitteilungen/Mitteilungen')),
  unterricht: p(() => import('./unterricht/Unterricht')),
  unterrichtklassen: p(() => import('./unterricht/UnterrichtKlassen')),
  offen: p(() => import('./klassenbuch/Offen')),
  pruefungen: p(() => import('./unterricht/Pruefungen')),
  pruefungskalender: p(() => import('./unterricht/Pruefungskalender')),
  schueler: p(() => import('./unterricht/Schueler')),
  aufgaben: p(() => import('./klassenbuch/Hausaufgaben')),
  klassenbuch: p(() => import('./klassenbuch/Klassenbuch')),
  eintraege: p(() => import('./klassenbuch/Eintraege')),
  hausaufgaben: p(() => import('./klassenbuch/Hausaufgaben')),
  dienste: p(() => import('./klassenbuch/Dienste')),
  abwesenheiten: p(() => import('./klassenbuch/Abwesenheiten')),
  entschuldigen: p(() => import('./klassenbuch/Entschuldigen')),
  befreiungen: p(() => import('./klassenbuch/Befreiungen')),
  berichte: p(() => import('./klassenbuch/Berichte')),
  sitzplan: p(() => import('./klassenbuch/Sitzplan')),
  melden: p(() => import('./melden/Melden')),
  buchen: p(() => import('./buchen/Buchen')),
  stammdaten: p(() => import('./admin/Stammdaten')),
  admin: p(() => import('./admin/Admin')),
  profil: p(() => import('./konto/Profil')),
  neuigkeiten: p(() => import('./konto/Neuigkeiten')),
  sprechtag: p(() => import('./sprechtag/Sprechtag')),
  hinweise: p(() => import('./konto/Hinweise')),
  kbeinstellungen: p(() => import('./klassenbuch/KbEinstellungen')),
};

/** Darf die Seite aufgerufen werden? (wie die Navigation; Profil und Neuigkeiten immer, Sprechtag auch für Schüler*innen) */
export function darfSeite(name: string, nav: string, ich: Benutzer, punkte: Punkt[]) {
  return name === 'profil' || name === 'neuigkeiten' || (name === 'sprechtag' && ich.rolle === 'schueler') || punkte.some(x => x.nav === nav);
}
