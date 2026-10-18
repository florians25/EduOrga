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
  // Platzhalter bis zur Portierung (siehe PORTIERUNG.md)
  uebersicht: p(() => import('./Platzhalter')),
  tag: p(() => import('./Platzhalter')),
  vertretungen: p(() => import('./Platzhalter')),
  mitteilungen: p(() => import('./Platzhalter')),
  unterricht: p(() => import('./Platzhalter')),
  unterrichtklassen: p(() => import('./Platzhalter')),
  offen: p(() => import('./Platzhalter')),
  pruefungen: p(() => import('./Platzhalter')),
  pruefungskalender: p(() => import('./Platzhalter')),
  schueler: p(() => import('./Platzhalter')),
  aufgaben: p(() => import('./Platzhalter')),
  klassenbuch: p(() => import('./Platzhalter')),
  eintraege: p(() => import('./Platzhalter')),
  hausaufgaben: p(() => import('./Platzhalter')),
  dienste: p(() => import('./Platzhalter')),
  abwesenheiten: p(() => import('./Platzhalter')),
  entschuldigen: p(() => import('./Platzhalter')),
  befreiungen: p(() => import('./Platzhalter')),
  berichte: p(() => import('./Platzhalter')),
  sitzplan: p(() => import('./Platzhalter')),
  melden: p(() => import('./Platzhalter')),
  buchen: p(() => import('./Platzhalter')),
  stammdaten: p(() => import('./Platzhalter')),
  admin: p(() => import('./Platzhalter')),
  profil: p(() => import('./Platzhalter')),
  neuigkeiten: p(() => import('./Platzhalter')),
  sprechtag: p(() => import('./Platzhalter')),
  hinweise: p(() => import('./Platzhalter')),
  kbeinstellungen: p(() => import('./Platzhalter')),
};

/** Darf die Seite aufgerufen werden? (wie die Navigation; Profil und Neuigkeiten immer, Sprechtag auch für Schüler*innen) */
export function darfSeite(name: string, nav: string, ich: Benutzer, punkte: Punkt[]) {
  return name === 'profil' || name === 'neuigkeiten' || (name === 'sprechtag' && ich.rolle === 'schueler') || punkte.some(x => x.nav === nav);
}
