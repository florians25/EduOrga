// Übernimmt Schrift, Logo und Bildschirmfotos aus dem Repository nach public/ (Build-Ausgabe, nicht eingecheckt).
// So zeigt die Website immer die aktuellen Bilder aus studio/docs/bilder, web/docs/bilder und mobile/docs/bilder.
// Außerdem schreibt es src/stand.json (ebenfalls Build-Ausgabe): Version aus VERSION, neueste GitHub-Veröffentlichung,
// Datum der letzten Änderung und die Kapitel des Handbuchs (docs/HANDBUCH.md).
//
// Umgebungsvariablen (alle optional, z. B. im Docker-Build ohne .git):
//   WEBSITE_COMMIT_DATUM   Datum der letzten Änderung (ISO 8601), sonst git log, sonst Zeitpunkt des Builds
//   WEBSITE_COMMIT         Commit-Kennung (kurz oder lang), sonst git rev-parse
//   WEBSITE_RELEASE        Tag der neuesten Veröffentlichung ("-" = keine); sonst Abfrage der GitHub-API
//   WEBSITE_RELEASE_DATUM  Datum dieser Veröffentlichung (ISO 8601)
//   WEBSITE_OFFLINE=1      GitHub-API nicht abfragen
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

// --- Stand des Projekts ---------------------------------------------------------------------------------------------
const REPO_API = "https://api.github.com/repos/florians25/UntPlanNext";
const lesen = (datei) => (existsSync(join(wurzel, datei)) ? readFileSync(join(wurzel, datei), "utf8") : "");
const git = (...args) => {
  try {
    return execFileSync("git", args, { cwd: wurzel, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
};

async function neuesteVeroeffentlichung() {
  const env = process.env.WEBSITE_RELEASE?.trim();
  if (env) return env === "-" ? null : { tag: env, datum: process.env.WEBSITE_RELEASE_DATUM?.trim() || null, adresse: null };
  if (process.env.WEBSITE_OFFLINE === "1") return null;
  try {
    const kopf = { Accept: "application/vnd.github+json", "User-Agent": "eduorga-website-build" };
    if (process.env.GITHUB_TOKEN) kopf.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const r = await fetch(`${REPO_API}/releases/latest`, { headers: kopf, signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null; // 404 = noch keine Veröffentlichung
    const j = await r.json();
    return j.tag_name ? { tag: j.tag_name, datum: j.published_at ?? null, adresse: j.html_url ?? null } : null;
  } catch {
    console.warn("Hinweis: GitHub-Veröffentlichungen nicht erreichbar – Stand ohne Veröffentlichung.");
    return null;
  }
}

// Kapitel „## 1. Erste Schritte“ aus dem Handbuch mit dem Anker, den GitHub für die Überschrift erzeugt
function kapitel(text) {
  return text
    .split("\n")
    .map((z) => /^## (\d+)\. (.+?)\s*$/.exec(z))
    .filter(Boolean)
    .map((m) => ({
      nummer: Number(m[1]),
      titel: m[2].replace(/UntPlan/g, "EduOrga"),
      anker: `${m[1]}-${m[2]}`.toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, "").replace(/ /g, "-"),
    }));
}

const datum = process.env.WEBSITE_COMMIT_DATUM?.trim() || git("log", "-1", "--format=%cI") || new Date().toISOString();
const stand = {
  version: lesen("VERSION").trim() || "0.0.0",
  commit: (process.env.WEBSITE_COMMIT?.trim() || git("rev-parse", "HEAD")).slice(0, 7) || null,
  letzteAenderung: datum,
  gebaut: new Date().toISOString(),
  veroeffentlichung: await neuesteVeroeffentlichung(),
  handbuch: kapitel(lesen("docs/HANDBUCH.md")),
};
writeFileSync(resolve(hier, "../src/stand.json"), JSON.stringify(stand, null, 2) + "\n");
console.log(`Website: Stand ${stand.version}, ${stand.veroeffentlichung ? `Veröffentlichung ${stand.veroeffentlichung.tag}` : "noch keine Veröffentlichung"}, letzte Änderung ${stand.letzteAenderung}.`);
