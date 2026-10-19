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
#   UntPlan Studio   SQLite → Volume untplannext-studio-daten, Ordner /data/sicherungen
#                    MariaDB (STUDIO_DB=mysql) → komprimierter SQL-Abzug der Datenbank eduorga_studio in ./sicherungen
#   UntPlan Web      SQLite → Volume untplannext-web-daten, Ordner /data/sicherungen
#                    MariaDB → komprimierter SQL-Abzug in ./sicherungen
#   Es bleiben jeweils die neuesten SICHERUNGEN_BEHALTEN (Standard 14).
#
# Verschlüsselte Sicherungen (empfohlen, sobald ./sicherungen den Server verlässt, z. B. auf ein NAS oder Band):
#   SICHERUNG_AGE_EMPFAENGER=age1…   (öffentlicher Schlüssel bzw. Datei mit Empfängern; mehrere durch Komma getrennt; Programm „age“)
#   SICHERUNG_GPG_EMPFAENGER=…       (Schlüssel-ID bzw. E-Mail eines öffentlichen GPG-Schlüssels; Programm „gpg“)
#   Dann werden die MariaDB-Abzüge verschlüsselt geschrieben (…sql.gz.age bzw. .gpg) und die SQLite-Sicherungen zusätzlich
#   verschlüsselt nach ./sicherungen kopiert (…db.gz.age bzw. .gpg). Der private Schlüssel gehört NICHT auf den Server.
#   Wiederherstellen: age -d -i schluessel.txt datei.sql.gz.age | gunzip …  bzw.  gpg -d datei.sql.gz.gpg | gunzip …
set -eu
cd "$(dirname "$0")"

wert() { [ -f .env ] && sed -n "s/^$1=//p" .env | tail -n 1 | tr -d '"' || true; }
UNTPLANWEB_DB=${UNTPLANWEB_DB:-$(wert UNTPLANWEB_DB)}
STUDIO_DB=${STUDIO_DB:-$(wert STUDIO_DB)}
# Name der Studio-Datenbank aus STUDIO_DB_CONNECTION (Database=…), Standard eduorga_studio
STUDIO_DATENBANK=$(wert STUDIO_DB_CONNECTION | tr ';' '\n' | sed -n 's/^[[:space:]]*[Dd]atabase=//p' | head -n 1)
STUDIO_DATENBANK=${STUDIO_DATENBANK:-eduorga_studio}
SICHERUNGEN_BEHALTEN=${SICHERUNGEN_BEHALTEN:-$(wert SICHERUNGEN_BEHALTEN)}
SICHERUNGEN=${SICHERUNGEN:-./sicherungen}
BEHALTEN=${SICHERUNGEN_BEHALTEN:-14}
SICHERUNG_AGE_EMPFAENGER=${SICHERUNG_AGE_EMPFAENGER:-$(wert SICHERUNG_AGE_EMPFAENGER)}
SICHERUNG_GPG_EMPFAENGER=${SICHERUNG_GPG_EMPFAENGER:-$(wert SICHERUNG_GPG_EMPFAENGER)}
SICHERN=1; AKTUALISIEREN=1; ANGEFORDERT=0; NUR=""
for a in "$@"; do
  case "$a" in
    --nur-sichern) AKTUALISIEREN=0 ;;
    --ohne-sicherung) SICHERN=0 ;;
    --wenn-angefordert) ANGEFORDERT=1 ;;
    studio|web|mobile) NUR="$NUR untplannext-$a" ;;
    untplannext-studio|untplannext-web|untplannext-mobile) NUR="$NUR $a" ;;
    -h|--hilfe) sed -n '2,18p' "$0"; exit 0 ;;
    *) echo "Unbekannte Option: $a" >&2; exit 2 ;;
  esac
done

verschluesselt() { [ -n "$SICHERUNG_AGE_EMPFAENGER$SICHERUNG_GPG_EMPFAENGER" ]; }
endung() { if [ -n "$SICHERUNG_AGE_EMPFAENGER" ]; then echo .age; elif [ -n "$SICHERUNG_GPG_EMPFAENGER" ]; then echo .gpg; fi; }
chiffre() { # Standardeingabe → (verschlüsselt) Standardausgabe
  if [ -n "$SICHERUNG_AGE_EMPFAENGER" ]; then
    set --
    for r in $(echo "$SICHERUNG_AGE_EMPFAENGER" | tr ',' ' '); do if [ -f "$r" ]; then set -- "$@" -R "$r"; else set -- "$@" -r "$r"; fi; done
    age "$@"
  elif [ -n "$SICHERUNG_GPG_EMPFAENGER" ]; then
    set --
    for r in $(echo "$SICHERUNG_GPG_EMPFAENGER" | tr ',' ' '); do set -- "$@" -r "$r"; done
    gpg --batch --yes --trust-model always --encrypt "$@"
  else
    cat
  fi
}
if [ -n "$SICHERUNG_AGE_EMPFAENGER" ] && ! command -v age >/dev/null 2>&1; then
  echo "SICHERUNG_AGE_EMPFAENGER ist gesetzt, aber „age“ ist nicht installiert (z. B. apt install age) – abgebrochen." >&2; exit 1
fi
if [ -z "$SICHERUNG_AGE_EMPFAENGER" ] && [ -n "$SICHERUNG_GPG_EMPFAENGER" ] && ! command -v gpg >/dev/null 2>&1; then
  echo "SICHERUNG_GPG_EMPFAENGER ist gesetzt, aber „gpg“ ist nicht installiert – abgebrochen." >&2; exit 1
fi
aufraeumen() { # aufraeumen <Präfix> <Muster> → nur die neuesten $BEHALTEN behalten
  # shellcheck disable=SC2086
  ls -1t "$SICHERUNGEN"/$1-*$2 2>/dev/null | tail -n +"$((BEHALTEN + 1))" | while read -r alt; do rm -f "$alt"; done
}
sqlite_export() { # sqlite_export <Dienst> <Muster im Container> <Präfix>: neueste SQLite-Sicherung verschlüsselt nach $SICHERUNGEN
  verschluesselt || return 0
  mkdir -p "$SICHERUNGEN"
  neueste=$(docker compose exec -T "$1" sh -c "ls -1t $2 2>/dev/null | head -n 1" | tr -d '\r')
  [ -n "$neueste" ] || return 1
  datei="$SICHERUNGEN/$3-$stempel.db.gz$(endung)"
  docker compose exec -T "$1" cat "$neueste" | gzip | chiffre > "$datei"
  [ -s "$datei" ] || { rm -f "$datei"; return 1; }
  echo "  $datei (verschlüsselt)"
  aufraeumen "$3" ".db.gz*"
}

laeuft() { docker compose ps --services --status running 2>/dev/null | grep -qx "$1"; }
mariadb_abzug() { # mariadb_abzug <Datenbank> <Dateipräfix> → komprimierter SQL-Abzug in $SICHERUNGEN, alte aufräumen
  mkdir -p "$SICHERUNGEN"
  datei="$SICHERUNGEN/$2-$stempel.sql.gz$(endung)"
  docker compose exec -T -e DB="$1" untplannext-mariadb sh -c 'exec mariadb-dump -uroot -p"$MARIADB_ROOT_PASSWORD" --single-transaction --quick \
    --routines --default-character-set=utf8mb4 --max-allowed-packet=256M "$DB"' | gzip | chiffre > "$datei"
  if verschluesselt; then [ "$(wc -c < "$datei")" -gt 256 ] || { rm -f "$datei"; return 1; }
  else [ "$(gzip -dc "$datei" 2>/dev/null | head -c 64 | wc -c)" -gt 0 ] || { rm -f "$datei"; return 1; }; fi
  echo "  $datei"
  aufraeumen "$2" ".sql.gz*"
}
gewaehlt() { [ -z "$NUR" ] || echo "$NUR" | grep -qw "$1"; }

if [ "$ANGEFORDERT" = 1 ]; then
  laeuft untplannext-web && docker compose exec -T untplannext-web test -f /data/update/angefordert.json 2>/dev/null || exit 0
  echo "$(date '+%F %T') Update angefordert"
fi

if [ "$SICHERN" = 1 ]; then
  stempel=$(date +%Y%m%d-%H%M%S)
  if gewaehlt untplannext-studio && laeuft untplannext-studio; then
    echo "Sichere EduOrga Studio …"
    if [ "${STUDIO_DB:-sqlite}" = mysql ]; then
      # MariaDB: das Studio sichert sich nicht selbst (kein mysqldump im Container) – Abzug aus dem MariaDB-Container
      { laeuft untplannext-mariadb && mariadb_abzug "$STUDIO_DATENBANK" untplannext-studio; } \
        || { echo "Sicherung der Studio-Datenbank ($STUDIO_DATENBANK) fehlgeschlagen – Update abgebrochen." >&2; exit 1; }
    else
      docker compose exec -T untplannext-studio dotnet UntPlanStudio.dll --sichern \
        || { echo "Sicherung von EduOrga Studio fehlgeschlagen – Update abgebrochen." >&2; exit 1; }
      sqlite_export untplannext-studio "/data/sicherungen/studio-*.db" untplannext-studio \
        || { echo "Verschlüsselte Kopie der Studio-Sicherung fehlgeschlagen – Update abgebrochen." >&2; exit 1; }
    fi
  fi
  if gewaehlt untplannext-web && laeuft untplannext-web; then
    echo "Sichere UntPlan Web …"
    if [ "${UNTPLANWEB_DB:-sqlite}" = mysql ] && laeuft untplannext-mariadb; then
      mkdir -p "$SICHERUNGEN"
      datei="$SICHERUNGEN/untplannext-web-$stempel.sql.gz$(endung)"
      docker compose exec -T untplannext-mariadb sh -c 'exec mariadb-dump -uroot -p"$MARIADB_ROOT_PASSWORD" --single-transaction --quick \
        --routines --default-character-set=utf8mb4 "$MARIADB_DATABASE"' | gzip | chiffre > "$datei"
      [ -s "$datei" ] || { rm -f "$datei"; echo "Sicherung der MariaDB fehlgeschlagen – Update abgebrochen." >&2; exit 1; }
      echo "  $datei"
      aufraeumen untplannext-web ".sql.gz*"
    else
      docker compose exec -T untplannext-web dotnet UntPlanWeb.dll --sichern \
        || { echo "Sicherung von UntPlan Web fehlgeschlagen – Update abgebrochen." >&2; exit 1; }
      sqlite_export untplannext-web "/data/sicherungen/untplanweb-*.db" untplannext-web \
        || { echo "Verschlüsselte Kopie der Web-Sicherung fehlgeschlagen – Update abgebrochen." >&2; exit 1; }
    fi
  fi
fi

[ "$AKTUALISIEREN" = 1 ] || { echo "Sicherung fertig."; exit 0; }

# aktuelle docker-compose.yml laden (die eigene .env bleibt unverändert; die bisherige Datei wird beiseitegelegt)
QUELLE=${UNTPLAN_QUELLE:-https://raw.githubusercontent.com/florians25/UntPlanNext/master/installation}
# Datei aus dem Repository laden – über die GitHub-API (nicht zwischengespeichert), sonst über raw.githubusercontent.com
API=${UNTPLAN_API:-https://api.github.com/repos/florians25/UntPlanNext/contents/installation}
laden() { # laden <Datei> <Ziel>
  curl -fsSL -H "Accept: application/vnd.github.raw" "$API/$1?ref=master" -o "$2" 2>/dev/null \
    || curl -fsSL "$QUELLE/$1" -o "$2" 2>/dev/null
}
if command -v curl >/dev/null 2>&1 && laden docker-compose.yml docker-compose.yml.neu \
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
