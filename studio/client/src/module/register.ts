// Zentrale Liste aller Oberflächen-Module – die EINZIGE Stelle, an der ein neues Modul eingetragen wird.
// Reihenfolge = Ladereihenfolge. Die Einordnung in die Seitenleiste steht in src/shell/navigation.ts. Siehe ARCHITEKTUR.md.
import type { StudioModul } from './typen';
import datei from './datei';
import start from './start';
import stammdaten from './stammdaten';
import unterricht from './unterricht';
import stundenplan from './stundenplan';
import planung from './planung';
import vertretung from './vertretung';
import optimierung from './optimierung';
import zeitwuensche from './zeitwuensche';
import abrechnung from './abrechnung';
import austausch from './austausch';
import kommentare from './kommentare';
import kursplanung from './kursplanung';
import multiuser from './multiuser';
import pausenaufsicht from './pausenaufsicht';
import untplanweb from './untplanweb';
import druck from './druck';
import einstellungen from './einstellungen';
import formate from './formate';
import uebersicht from './uebersicht';
import veranstaltungen from './veranstaltungen';

export const module: StudioModul[] = [
  datei,
  start,
  stammdaten,
  unterricht,
  stundenplan,
  planung,
  vertretung,
  optimierung,
  zeitwuensche,
  abrechnung,
  austausch,
  kommentare,
  kursplanung,
  multiuser,
  pausenaufsicht,
  untplanweb,
  druck,
  einstellungen,
  formate,
  uebersicht,
  veranstaltungen,
];
