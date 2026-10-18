#!/bin/sh
# UntPlan einrichten: fragt die gewünschten Programme ab, schreibt .env und Caddyfile und startet die Container.
#
#   ./install.sh                 Fragen beantworten (Eingabetaste übernimmt den Vorschlag in [Klammern])
#   ./install.sh --neu           vorhandene .env ignorieren und neu fragen
#
# Ohne Repository auf einem frischen Server:
#   mkdir -p /opt/untplan && cd /opt/untplan
#   curl -fsSLO https://raw.githubusercontent.com/florians25/UntPlanNext/master/installation/install.sh
#   sh install.sh
set -eu

QUELLE=${UNTPLAN_QUELLE:-https://raw.githubusercontent.com/florians25/UntPlanNext/master/installation}
NEU=0
for a in "$@"; do
  case "$a" in
    --neu) NEU=1 ;;
    -h|--hilfe) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "Unbekannte Option: $a" >&2; exit 2 ;;
  esac
done

fehler() { echo "Fehler: $*" >&2; exit 1; }
frage() { # frage <Text> <Vorschlag> → Antwort auf stdout
  printf '%s [%s]: ' "$1" "$2" >&2
  read -r antwort || antwort=""
  echo "${antwort:-$2}"
}
ja() { case "$(frage "$1" "$2")" in [jJyY]*) return 0 ;; *) return 1 ;; esac; }
passwort() { # zufälliges Passwort ohne Sonderzeichen (sicher in .env und Verbindungszeichenfolgen)
  if command -v openssl >/dev/null 2>&1; then openssl rand -base64 30 | tr -dc 'A-Za-z0-9' | cut -c1-24
  else tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24; fi
}

# --- Voraussetzungen ---------------------------------------------------------------------------------------------
command -v docker >/dev/null 2>&1 || fehler "Docker ist nicht installiert. Anleitung: https://docs.docker.com/engine/install/"
docker compose version >/dev/null 2>&1 || fehler "Docker Compose (Plugin „docker compose“) fehlt."
docker info >/dev/null 2>&1 || fehler "Kein Zugriff auf Docker. Als root oder Mitglied der Gruppe „docker“ ausführen."

for datei in docker-compose.yml update.sh; do
  if [ ! -f "$datei" ]; then
    echo "Lade $datei …"
    command -v curl >/dev/null 2>&1 || fehler "$datei fehlt und curl ist nicht installiert."
    curl -fsSL "$QUELLE/$datei" -o "$datei" || fehler "$datei konnte nicht geladen werden."
  fi
done
chmod +x update.sh

if [ -f .env ] && [ "$NEU" = 0 ]; then
  echo "Vorhandene Einstellungen (.env) gefunden – Container werden mit diesen Einstellungen gestartet."
  echo "Neu einrichten: ./install.sh --neu (Daten bleiben erhalten)."
  docker compose pull
  docker compose up -d --remove-orphans
  docker compose ps
  exit 0
fi

echo
echo "UntPlan einrichten"
echo "------------------"
echo "Jedes Programm läuft in einem eigenen Container mit eigener Datenbank."
echo

profile=""
STUDIO=0; WEB=0; MOBILE=0
ja "UntPlan Studio installieren (Stundenplanung im Browser)? j/n" j && { STUDIO=1; profile="studio"; }
ja "UntPlan Web installieren (Portal für Lehrkräfte, Schüler und Eltern)? j/n" j && { WEB=1; profile="${profile:+$profile,}web"; }
if [ "$WEB" = 1 ]; then
  ja "UntPlan Mobile installieren (App fürs Telefon, nutzt UntPlan Web)? j/n" j && { MOBILE=1; profile="$profile,mobile"; }
fi
[ -n "$profile" ] || fehler "Kein Programm ausgewählt."

DB=sqlite
if [ "$WEB" = 1 ]; then
  echo
  echo "Datenbank für UntPlan Web: SQLite reicht für die meisten Schulen; MariaDB für große Schulen oder vorhandene Sicherungskonzepte."
  case "$(frage "Datenbank (sqlite/mariadb)" sqlite)" in m*|M*) DB=mysql; profile="$profile,mariadb" ;; esac
fi

echo
HTTPS=0
if ja "HTTPS mit automatischem Zertifikat einrichten (Server ist aus dem Internet unter eigenen Domains erreichbar)? j/n" j; then
  HTTPS=1; profile="$profile,https"
  [ "$STUDIO" = 1 ] && STUDIO_DOMAIN=$(frage "Domain für UntPlan Studio" "studio.meine-schule.de")
  [ "$WEB" = 1 ] && WEB_DOMAIN=$(frage "Domain für UntPlan Web" "plan.meine-schule.de")
  [ "$MOBILE" = 1 ] && MOBILE_DOMAIN=$(frage "Domain für UntPlan Mobile" "app.meine-schule.de")
  ACME_MAIL=$(frage "E-Mail für Hinweise zum Zertifikat (leer lassen möglich)" "")
fi

UPDATER=0
if [ "$WEB" = 1 ] && ja "Updates aus der Administration von UntPlan Web erlauben (Watchtower)? j/n" n; then
  UPDATER=1; profile="$profile,updater"
fi

ZEITZONE=$(frage "Zeitzone" "Europe/Berlin")

STUDIO_PW=""; WEB_PW=""
[ "$STUDIO" = 1 ] && STUDIO_PW=$(passwort)
[ "$WEB" = 1 ] && WEB_PW=$(passwort)

# --- .env schreiben ----------------------------------------------------------------------------------------------
umask 077
{
  echo "# UntPlan – Einstellungen (von install.sh erzeugt am $(date '+%F %T')). Nach Änderungen: docker compose up -d"
  echo "COMPOSE_PROFILES=$profile"
  echo "UNTPLAN_VERSION=latest"
  echo "ZEITZONE=$ZEITZONE"
  echo "SICHERUNGEN_BEHALTEN=14"
  if [ "$HTTPS" = 1 ]; then
    echo "# Programme nur lokal erreichbar, nach außen über Caddy (HTTPS)"
    echo "BIND_ADRESSE=127.0.0.1"
  else
    echo "BIND_ADRESSE=0.0.0.0"
  fi
  echo "STUDIO_PORT=8090"
  echo "WEB_PORT=8080"
  echo "MOBILE_PORT=8081"
  if [ "$STUDIO" = 1 ]; then
    echo
    echo "# UntPlan Studio (eigene Datenbank im Volume untplanstudio-daten)"
    echo "STUDIO_ADMIN_BENUTZER=admin"
    echo "STUDIO_ADMIN_PASSWORT=$STUDIO_PW"
    echo "STUDIO_SICHERE_COOKIES=$HTTPS"
  fi
  if [ "$WEB" = 1 ]; then
    echo
    echo "# UntPlan Web (eigene Datenbank: $DB)"
    echo "UNTPLANWEB_ADMIN_PASSWORT=$WEB_PW"
    echo "UNTPLANWEB_DB=$DB"
    if [ "$DB" = mysql ]; then
      MARIADB_PW=$(passwort)
      echo "MARIADB_PASSWORT=$MARIADB_PW"
      echo "MARIADB_ROOT_PASSWORT=$(passwort)"
      echo "UNTPLANWEB_DB_CONNECTION=\"Server=mariadb;Port=3306;Database=untplanweb;User ID=untplanweb;Password=$MARIADB_PW\""
    fi
    [ "$MOBILE" = 1 ] && echo "UNTPLANWEB_MOBILE_INTERN_URL=http://untplanmobile:8081"
    if [ "$UPDATER" = 1 ]; then
      echo "UNTPLANWEB_UPDATE_WATCHTOWER_URL=http://watchtower:8080/v1/update"
      echo "WATCHTOWER_TOKEN=$(passwort)"
    fi
  fi
  if [ "$MOBILE" = 1 ] && [ -n "${ACME_MAIL:-}" ]; then
    echo "UNTPLANMOBILE_VAPID_KONTAKT=mailto:$ACME_MAIL"
  fi
} > .env
umask 022

# --- Caddyfile schreiben -----------------------------------------------------------------------------------------
{
  echo "# UntPlan – HTTPS über Caddy (von install.sh erzeugt). Nach Änderungen: docker compose restart caddy"
  if [ -n "${ACME_MAIL:-}" ]; then printf '{\n\temail %s\n}\n' "$ACME_MAIL"; fi
  if [ "$HTTPS" = 1 ] && [ "$STUDIO" = 1 ]; then
    printf '\n%s {\n\tencode zstd gzip\n\treverse_proxy untplanstudio:8080 {\n\t\tflush_interval -1\n\t}\n\trequest_body {\n\t\tmax_size 64MB\n\t}\n\theader Strict-Transport-Security "max-age=31536000"\n}\n' "$STUDIO_DOMAIN"
  fi
  if [ "$HTTPS" = 1 ] && [ "$WEB" = 1 ]; then
    printf '\n%s {\n\tencode zstd gzip\n\treverse_proxy untplanweb:8080\n\theader Strict-Transport-Security "max-age=31536000"\n}\n' "$WEB_DOMAIN"
  fi
  if [ "$HTTPS" = 1 ] && [ "$MOBILE" = 1 ]; then
    printf '\n%s {\n\tencode zstd gzip\n\treverse_proxy untplanmobile:8081\n\theader Strict-Transport-Security "max-age=31536000"\n}\n' "$MOBILE_DOMAIN"
  fi
} > Caddyfile

# --- starten -----------------------------------------------------------------------------------------------------
echo
echo "Lade Images und starte Container …"
docker compose pull
docker compose up -d --remove-orphans

adresse() { # adresse <Domain> <Port>
  if [ "$HTTPS" = 1 ]; then echo "https://$1"; else echo "http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo localhost):$2"; fi
}
echo
echo "Fertig. Zugangsdaten stehen in $(pwd)/.env – bitte sicher aufbewahren und nach der ersten Anmeldung ändern."
[ "$STUDIO" = 1 ] && echo "  UntPlan Studio  $(adresse "${STUDIO_DOMAIN:-}" 8090)   Benutzer admin, Passwort $STUDIO_PW"
[ "$WEB" = 1 ]    && echo "  UntPlan Web     $(adresse "${WEB_DOMAIN:-}" 8080)   Benutzer admin, Passwort $WEB_PW"
[ "$MOBILE" = 1 ] && echo "  UntPlan Mobile  $(adresse "${MOBILE_DOMAIN:-}" 8081)   Anmeldung mit dem Konto von UntPlan Web"
if [ "$STUDIO" = 1 ] && [ "$WEB" = 1 ]; then
  echo
  echo "Pläne von Studio nach Web übertragen: in Studio „UntPlan Web“ → „Einstellungen“ öffnen und eintragen:"
  echo "  Server untplanweb, Port 8080, ohne HTTPS (internes Netz der Container),"
  echo "  Schul-ID und API-Schlüssel aus UntPlan Web (Administration → Verbindung mit UntPlan)."
fi
echo
echo "Update: ./update.sh   (sichert vorher die Datenbanken von Studio und Web)"
