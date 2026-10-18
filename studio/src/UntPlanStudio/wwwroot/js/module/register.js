// Zentrale Liste aller Oberflächen-Module – die EINZIGE Stelle, an der ein neues Modul eingetragen wird.
// Reihenfolge = Ladereihenfolge. Die Einordnung der Befehle in die Navigation steht in kern/navigation.js. Siehe ARCHITEKTUR.md.

import datei from './datei.js';
import start from './start.js';
import stammdaten from './stammdaten.js';
import unterricht from './unterricht.js';
import stundenplan from './stundenplan.js';
import optimierung from './optimierung.js';
import planung from './planung.js';
import zeitwuensche from './zeitwuensche.js';
import abrechnung from './abrechnung.js';
import austausch from './austausch.js';
import kommentare from './kommentare.js';
import kursplanung from './kursplanung.js';
import multiuser from './multiuser.js';
import pausenaufsicht from './pausenaufsicht.js';
import untplanweb from './untplanweb.js';
import druck from './druck.js';
import einstellungen from './einstellungen.js';
import formate from './formate.js';
import uebersicht from './uebersicht.js';
import veranstaltungen from './veranstaltungen.js';
import vertretung from './vertretung.js';
// ── ERWEITERUNGSSTELLE: weitere Module hier importieren (je Modul eine Zeile, alphabetisch), z. B.
// import abrechnung from './abrechnung.js';
// import druck from './druck.js';
// import vertretung from './vertretung.js';

export const module = [
  datei,
  start,
  stammdaten,
  unterricht,
  stundenplan,
  optimierung,
  planung,
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
  vertretung,
  veranstaltungen,
  // ── ERWEITERUNGSSTELLE: und hier anfügen
];
