// Übernimmt Schrift, Logo und Bildschirmfotos aus dem Repository nach public/ (Build-Ausgabe, nicht eingecheckt).
// So zeigt die Website immer die aktuellen Bilder aus studio/docs/bilder, web/docs/bilder und mobile/docs/bilder.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const hier = dirname(fileURLToPath(import.meta.url));
const wurzel = resolve(hier, "../../..");
const ziel = resolve(hier, "../public");

// Schriften: design/tokens.css verweist auf ../fonts/ – zur Laufzeit also /fonts/ neben /assets/
const dateien = [
  ["design/fonts/plex-sans-400.woff2", "fonts/plex-sans-400.woff2"],
  ["design/fonts/plex-sans-500.woff2", "fonts/plex-sans-500.woff2"],
  ["design/fonts/plex-sans-600.woff2", "fonts/plex-sans-600.woff2"],
  ["design/fonts/OFL.txt", "fonts/OFL.txt"],
  ["design/logo/edo-monogramm.svg", "logo/edo-monogramm.svg"],
  ["design/logo/edo-monogramm-eckig.svg", "logo/edo-monogramm-eckig.svg"],
  ["design/logo/edo-zeichen.svg", "logo/edo-zeichen.svg"],
  ["design/logo/edo-wortmarke.svg", "logo/edo-wortmarke.svg"],
  ["design/logo/edo-monogramm.svg", "favicon.svg"],
];
const bilder = {
  studio: ["uebersicht", "planen", "vertretung", "suche"],
  web: ["stundenplan", "heute", "vertretungsplan", "klassenbuch", "stundendetails", "monitor", "stundenplan-telefon", "heute-telefon"],
  mobile: ["heute", "plan-woche", "stundendetails", "postfach"],
};
for (const [modul, namen] of Object.entries(bilder))
  for (const n of namen) dateien.push([`${modul}/docs/bilder/${n}.png`, `bilder/${modul}/${n}.png`]);

let fehlend = 0;
for (const [von, nach] of dateien) {
  const quelle = join(wurzel, von);
  if (!existsSync(quelle)) { console.warn(`Hinweis: ${von} fehlt – wird übersprungen.`); fehlend++; continue; }
  mkdirSync(dirname(join(ziel, nach)), { recursive: true });
  copyFileSync(quelle, join(ziel, nach));
}
console.log(`Website: ${dateien.length - fehlend} Dateien nach public/ übernommen.`);
