#!/bin/sh
# Nach dem Umbenennen des GitHub-Repositorys florians25/UntPlanNext → florians25/EduOrga ausführen:
#   sh tools/repo-umbenennen.sh            ändert alle Verweise im Repository (Links, Installationsbefehle, Update-Quellen)
#   sh tools/repo-umbenennen.sh --pruefen  zeigt nur, was geändert würde
# Technische Kennungen (Docker-Images ghcr.io/florians25/untplannext-*, Container, Volumes, Umgebungsvariablen,
# Bundle-ID, Ordner ios/UntPlanNext) bleiben bewusst unverändert, damit laufende Installationen weiterarbeiten.
set -eu
cd "$(dirname "$0")/.."
ALT=${ALT:-florians25/UntPlanNext}
NEU=${NEU:-florians25/EduOrga}
dateien=$(git grep -lI "$ALT" -- . ':!archiv' ':!**/node_modules/**' ':!tools/repo-umbenennen.sh' ':!docs/REPO-UMBENENNUNG.md' || true)
[ -n "$dateien" ] || { echo "Keine Verweise auf $ALT gefunden."; exit 0; }
if [ "${1:-}" = --pruefen ]; then
  git grep -nI "$ALT" -- $dateien
  exit 0
fi
for d in $dateien; do
  sed -i "s#$ALT#$NEU#g" "$d"
  echo "geändert: $d"
done
# Groß-/Kleinschreibung in Raw-/API-URLs (z. B. …/repos/florians25/UntPlanNext/…) ist mit abgedeckt.
git remote get-url origin 2>/dev/null | grep -q "UntPlanNext" && git remote set-url origin "$(git remote get-url origin | sed "s#UntPlanNext#EduOrga#")" && echo "git remote origin umgestellt"
echo "Fertig. Bitte Tests laufen lassen, committen und pushen."
