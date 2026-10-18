// Zentrale Liste aller Oberflächen-Module – die EINZIGE Stelle, an der ein neues Modul eingetragen wird.
// Reihenfolge = Ladereihenfolge. Die Einordnung in die Seitenleiste steht in src/shell/navigation.ts. Siehe ARCHITEKTUR.md.
import type { StudioModul } from './typen';
import datei from './datei';
import start from './start';
import stammdaten from './stammdaten';
import unterricht from './unterricht';
import stundenplan from './stundenplan';
import planung from './planung';

export const module: StudioModul[] = [
  datei,
  start,
  stammdaten,
  unterricht,
  stundenplan,
  planung,
];
