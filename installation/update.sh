#!/bin/sh
# UntPlan aktualisieren: Datenbanken sichern → neue Images laden → Container neu starten.
# Datenbank-Migrationen laufen beim Start der Programme automatisch.
#
#   ./update.sh                     alle installierten Programme aktualisieren
#   ./update.sh studio              nur UntPlan Studio (ebenso: web, mobile – auch mehrere)
#   ./update.sh --nur-sichern       nur sichern, nichts aktualisieren
#   ./update.sh --ohne-sicherung    ohne vorherige Sicherung (nicht empfohlen)
#   ./update.sh --wenn-angefordert  nur, wenn in der Administration von UntPlan Web „Update installieren“ geklickt wurde,
#                                   z. B. per cron:  * * * * * cd /opt/untplannext && ./update.sh --wenn-angefordert >> update.log 2>&1
#
# Sicherungen:
#   UntPlan Studio   eigene SQLite-Datenbank → Volume untplannext-studio-daten, Ordner /data/sicherungen
#   UntPlan Web      SQLite → Volume untplannext-web-daten, Ordner /data/sicherungen
#                    MariaDB → komprimierter SQL-Abzug in ./sicherungen
#   Es bleiben jeweils die neuesten SICHERUNGEN_BEHALTEN (Standard 14).
set -eu
cd "$(dirname "$0")"

wert() { [ -f .env ] && sed -n "s/^$1=//p" .env | tail -n 1 | tr -d '"' || true; }
UNTPLANWEB_DB=${UNTPLANWEB_DB:-$(wert UNTPLANWEB_DB)}
SICHERUNGEN_BEHALTEN=${SICHERUNGEN_BEHALTEN:-$(wert SICHERUNGEN_BEHALTEN)}
SICHERUNGEN=${SICHERUNGEN:-./sicherungen}
BEHALTEN=${SICHERUNGEN_BEHALTEN:-14}
SICHERN=1; AKTUALISIEREN=1; ANGEFORDERT=0; NUR=""
for a in "$@"; do
  case "$a" in
    --nur-sichern) AKTUALISIEREN=0 ;;
    --ohne-sicherung) SICHERN=0 ;;
    --wenn-angefordert) ANGEFORDERT=1 ;;
    studio|web|mobile) NUR="$NUR untplannext-$a" ;;
    untplannext-studio|untplannext-web|untplannext-mobile) NUR="$NUR $a" ;;
    -h|--hilfe) sed -n '2,17p' "$0"; exit 0 ;;
    *) echo "Unbekannte Option: $a" >&2; exit 2 ;;
  esac
done

laeuft() { docker compose ps --services --status running 2>/dev/null | grep -qx "$1"; }
gewaehlt() { [ -z "$NUR" ] || echo "$NUR" | grep -qw "$1"; }

if [ "$ANGEFORDERT" = 1 ]; then
  laeuft untplannext-web && docker compose exec -T untplannext-web test -f /data/update/angefordert.json 2>/dev/null || exit 0
  echo "$(date '+%F %T') Update angefordert"
fi

if [ "$SICHERN" = 1 ]; then
  stempel=$(date +%Y%m%d-%H%M%S)
  if gewaehlt untplannext-studio && laeuft untplannext-studio; then
    echo "Sichere UntPlan Studio …"
    docker compose exec -T untplannext-studio dotnet UntPlanStudio.dll --sichern \
      || { echo "Sicherung von UntPlan Studio fehlgeschlagen – Update abgebrochen." >&2; exit 1; }
  fi
  if gewaehlt untplannext-web && laeuft untplannext-web; then
    echo "Sichere UntPlan Web …"
    if [ "${UNTPLANWEB_DB:-sqlite}" = mysql ] && laeuft untplannext-mariadb; then
      mkdir -p "$SICHERUNGEN"
      datei="$SICHERUNGEN/untplannext-web-$stempel.sql.gz"
      docker compose exec -T untplannext-mariadb sh -c 'exec mariadb-dump -uroot -p"$MARIADB_ROOT_PASSWORD" --single-transaction --quick \
        --routines --default-character-set=utf8mb4 "$MARIADB_DATABASE"' | gzip > "$datei"
      [ -s "$datei" ] || { rm -f "$datei"; echo "Sicherung der MariaDB fehlgeschlagen – Update abgebrochen." >&2; exit 1; }
      echo "  $datei"
      ls -1t "$SICHERUNGEN"/untplannext-web-*.sql.gz 2>/dev/null | tail -n +"$((BEHALTEN + 1))" | while read -r alt; do rm -f "$alt"; done
    else
      docker compose exec -T untplannext-web dotnet UntPlanWeb.dll --sichern \
        || { echo "Sicherung von UntPlan Web fehlgeschlagen – Update abgebrochen." >&2; exit 1; }
    fi
  fi
fi

[ "$AKTUALISIEREN" = 1 ] || { echo "Sicherung fertig."; exit 0; }

# aktuelle docker-compose.yml laden (die eigene .env bleibt unverändert; die bisherige Datei wird beiseitegelegt)
QUELLE=${UNTPLAN_QUELLE:-https://raw.githubusercontent.com/florians25/UntPlanNext/master/installation}
if command -v curl >/dev/null 2>&1 && curl -fsSL "$QUELLE/docker-compose.yml" -o docker-compose.yml.neu 2>/dev/null \
   && grep -q "ghcr.io/florians25/untplannext-studio" docker-compose.yml.neu; then
  if ! cmp -s docker-compose.yml docker-compose.yml.neu; then
    mv docker-compose.yml "docker-compose.yml.alt-$(date +%Y%m%d-%H%M%S)"; mv docker-compose.yml.neu docker-compose.yml
    echo "docker-compose.yml aktualisiert."
  fi
fi
rm -f docker-compose.yml.neu

laeuft untplannext-web && docker compose exec -T untplannext-web rm -f /data/update/angefordert.json 2>/dev/null || true
echo "Lade neue Images …"
# shellcheck disable=SC2086
docker compose pull $NUR || { echo "Images konnten nicht geladen werden – Pakete auf ghcr.io öffentlich stellen oder „docker login ghcr.io“ (siehe README)." >&2; exit 1; }
# shellcheck disable=SC2086
docker compose up -d --remove-orphans $NUR
docker image prune -f >/dev/null 2>&1 || true
docker compose ps
echo "Fertig."
