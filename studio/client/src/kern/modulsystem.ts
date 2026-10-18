// Modulsystem: registriert Ansichten, Arbeitsplätze, Befehle und Befehlseinträge aller Module (src/module/register.ts).
import type { ArbeitsplatzDef, StudioModul } from '@/module/typen';
import { ansichtRegistrieren } from './ansichten';
import { befehlRegistrieren, eintragRegistrieren } from './befehle';

const arbeitsplaetze = new Map<string, ArbeitsplatzDef>();
export const arbeitsplatzDef = (name: string) => arbeitsplaetze.get(name);
export const geladeneModule: string[] = [];

export function moduleLaden(module: StudioModul[]) {
  for (const m of module) {
    try {
      for (const [typ, def] of Object.entries(m.ansichten || {})) ansichtRegistrieren(typ, def);
      for (const [name, def] of Object.entries(m.arbeitsplaetze || {})) arbeitsplaetze.set(name, def);
      for (const [name, f] of Object.entries(m.befehle || {})) befehlRegistrieren(name, f);
      for (const e of m.eintraege || []) eintragRegistrieren(e);
      geladeneModule.push(m.id);
    } catch (e) {
      console.error(`Modul ${m?.id} konnte nicht geladen werden`, e);
    }
  }
  for (const m of module) {
    try { m.start?.(); } catch (e) { console.error(`Start von Modul ${m?.id} fehlgeschlagen`, e); }
  }
}
