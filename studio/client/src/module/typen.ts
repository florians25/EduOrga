// Aufbau eines Oberflächen-Moduls (src/module/<modul>/index.ts), eingetragen in src/module/register.ts.
import type { ComponentType, LazyExoticComponent } from 'react';
import type { AnsichtDef } from '@/kern/ansichten';
import type { Befehlseintrag } from '@/kern/befehle';
import type { Modus } from '@/kern/zustand';

export interface ArbeitsplatzDef {
  titel: string;
  modus?: Modus;
  komponente: LazyExoticComponent<ComponentType> | ComponentType;
}

export interface StudioModul {
  id: string;
  /** Ansichten (Seiten): Schlüssel = Typ, z. B. 'stammdaten' oder 'vertretung.liste'. */
  ansichten?: Record<string, AnsichtDef>;
  /** Arbeitsplätze: feste Seiten mit mehreren Bereichen (Adresse /arbeitsplatz/<name>). */
  arbeitsplaetze?: Record<string, ArbeitsplatzDef>;
  befehle?: Record<string, (args: any) => unknown>;
  eintraege?: Befehlseintrag[];
  /** nach dem Laden aller Module */
  start?: () => void;
}
