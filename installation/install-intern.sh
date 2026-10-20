#!/bin/sh
# EduOrga Website einrichten – NUR für den Betreiber des Projekts. Die Website ist nicht Teil der Installation an Schulen
# (dafür: install.sh). Eigenes Compose-Projekt „untplannext-website“ mit installation/intern/docker-compose.website.yml.
#
#   ./install-intern.sh            Fragen beantworten (Eingabetaste übernimmt den Vorschlag in [Klammern]) und starten
#   ./install-intern.sh --update   neue Fassung von docker-compose.website.yml und neues Image laden, neu starten
#   ./install-intern.sh --neu      vorhandene .env ignorieren und neu fragen
#
# Auf einem Server ohne Repository:
#   mkdir -p /opt/eduorga-website && cd /opt/eduorga-website
#   curl -fsSL -H "Accept: application/vnd.github.raw" -o install-intern.sh "https://api.github.com/repos/florians25/EduOrga/contents/installation/install-intern.sh?ref=master"
#   sh install-intern.sh
set -eu

QUELLE=${UNTPLAN_QUELLE:-https://raw.githubusercontent.com/florians25/EduOrga/master/installation}
API=${UNTPLAN_API:-https://api.github.com/repos/florians25/EduOrga/contents/installation}
COMPOSE_DATEI=docker-compose.website.yml
DIENST=untplannext-website
NEU=0; UPDATE=0
for a in "$@"; do
  case "$a" in
    --neu) NEU=1 ;;
    --update) UPDATE=1 ;;
    -h|--hilfe) sed -n '2,13p' "$0"; exit 0 ;;
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
dc() { docker compose -f "$COMPOSE_DATEI" "$@"; }

# --- Voraussetzungen ---------------------------------------------------------------------------------------------
command -v docker >/dev/null 2>&1 || fehler "Docker ist nicht installiert. Anleitung: https://docs.docker.com/engine/install/"
docker compose version >/dev/null 2>&1 || fehler "Docker Compose (Plugin „docker compose“) fehlt."
docker info >/dev/null 2>&1 || fehler "Kein Zugriff auf Docker. Als root oder Mitglied der Gruppe „docker“ ausführen."

# Datei aus dem Repository laden – über die GitHub-API (nicht zwischengespeichert), sonst über raw.githubusercontent.com
laden() { # laden <Pfad unter installation/> <Ziel>
  curl -fsSL -H "Accept: application/vnd.github.raw" "$API/$1?ref=master" -o "$2" 2>/dev/null \
    || curl -fsSL "$QUELLE/$1" -o "$2" 2>/dev/null
}

# docker-compose.website.yml immer in der aktuellen Fassung verwenden (eine abweichende wird beiseitegelegt)
if command -v curl >/dev/null 2>&1 && laden "intern/$COMPOSE_DATEI" "$COMPOSE_DATEI.neu" \
   && grep -q "ghcr.io/florians25/untplannext-website" "$COMPOSE_DATEI.neu"; then
  if [ -f "$COMPOSE_DATEI" ] && ! cmp -s "$COMPOSE_DATEI" "$COMPOSE_DATEI.neu"; then
    mv "$COMPOSE_DATEI" "$COMPOSE_DATEI.alt-$(date +%Y%m%d-%H%M%S)"
    echo "Ältere $COMPOSE_DATEI beiseitegelegt, aktuelle Fassung geladen."
  fi
  mv "$COMPOSE_DATEI.neu" "$COMPOSE_DATEI"
else
  rm -f "$COMPOSE_DATEI.neu"
  [ -f "$COMPOSE_DATEI" ] || fehler "$COMPOSE_DATEI fehlt und konnte nicht geladen werden ($QUELLE/intern)."
  echo "Hinweis: $COMPOSE_DATEI konnte nicht neu geladen werden – die vorhandene Fassung wird verwendet." >&2
fi

starten() {
  echo "Lade das Image und starte die Website …"
  if ! dc pull; then
    echo >&2
    echo "Das Image konnte nicht geladen werden. Häufigste Ursache: das Paket auf ghcr.io ist nicht öffentlich." >&2
    echo "  • GitHub → Profil → Packages → untplannext-website → Package settings → Change visibility → Public, oder" >&2
    echo "  • docker login ghcr.io -u <GitHub-Benutzer>  (Token mit Recht read:packages)" >&2
    exit 1
  fi
  dc up -d --remove-orphans
  docker image prune -f >/dev/null 2>&1 || true
  # auf den Healthcheck des Images warten (höchstens etwa 60 Sekunden)
  i=0
  while [ "$i" -lt 30 ]; do
    zustand=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$DIENST" 2>/dev/null || echo "")
    case "$zustand" in healthy|running) break ;; esac
    sleep 2; i=$((i + 1))
  done
  [ "${zustand:-}" = healthy ] || [ "${zustand:-}" = running ] \
    || echo "WARNUNG: Die Website meldet sich nicht als bereit (Zustand: ${zustand:-unbekannt}). Protokoll: docker compose -f $COMPOSE_DATEI logs $DIENST" >&2
  dc ps
}

if [ "$UPDATE" = 1 ]; then
  [ -f .env ] || fehler "Keine .env in $(pwd) – zuerst ./install-intern.sh ohne --update aufrufen."
  starten
  echo "Update fertig."
  exit 0
fi

if [ -f .env ] && [ "$NEU" = 0 ]; then
  echo "Vorhandene Einstellungen (.env) gefunden – die Website wird mit diesen Einstellungen gestartet."
  echo "Neu einrichten: ./install-intern.sh --neu · Update: ./install-intern.sh --update"
  starten
  exit 0
fi

# Container „untplannext-website“ aus einer früheren Gesamtinstallation (Profil „website“) blockiert den Namen
alt_projekt=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$DIENST" 2>/dev/null || true)
if [ -n "$alt_projekt" ] && [ "$alt_projekt" != untplannext-website ]; then
  echo "Es gibt bereits einen Container „$DIENST“ aus dem Compose-Projekt „$alt_projekt“ (frühere Website mit Ideenportal)."
  if ja "Diesen Container entfernen (das Volume untplannext-website-daten bleibt erhalten)? j/n" j; then
    docker rm -f "$DIENST" >/dev/null
  else
    fehler "Abgebrochen – der Containername „$DIENST“ ist belegt."
  fi
fi

echo
echo "EduOrga Website einrichten (nur für den Betreiber des Projekts)"
echo "----------------------------------------------------------------"
echo

port() { # port <Text> <Vorschlag> → geprüfte Portnummer
  while :; do
    p=$(frage "$1" "$2")
    case "$p" in ''|*[!0-9]*) ;; *) if [ "$p" -ge 1 ] && [ "$p" -le 65535 ]; then echo "$p"; return; fi ;; esac
    echo "Bitte eine Zahl zwischen 1 und 65535 eingeben." >&2
  done
}
besetzt() { # besetzt <Port> → 0, wenn auf dem Server schon etwas lauscht (nicht die eigene Website)
  docker ps --filter "name=^${DIENST}\$" --format '{{.Ports}}' 2>/dev/null | grep -q ":$1->" && return 1
  if command -v ss >/dev/null 2>&1; then ss -ltnH 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$1\$"
  elif command -v netstat >/dev/null 2>&1; then netstat -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$1\$"
  else return 1; fi
}
freier_port() { # freier_port <Text> <Vorschlag> → abgefragter Port, der noch nicht belegt ist
  wert=$(port "$1" "$2")
  while besetzt "$wert"; do
    echo "Port $wert ist auf diesem Server bereits belegt." >&2
    vorschlag=$((wert + 1))
    while besetzt "$vorschlag" && [ "$vorschlag" -lt 65535 ]; do vorschlag=$((vorschlag + 1)); done
    wert=$(port "$1" "$vorschlag")
  done
  echo "$wert"
}
ohne_anfuehrung() { printf '%s' "$1" | tr -d "'\"\\\\\`\$"; }

vorschlag=8290
while besetzt "$vorschlag" && [ "$vorschlag" -lt 65535 ]; do vorschlag=$((vorschlag + 1)); done
WEBSITE_PORT=$(freier_port "Port für die Website" "$vorschlag")

DOMAIN=$(frage "Domain der Website (leer = ohne Domain, nur über die IP-Adresse)" "")
DOMAIN=$(ohne_anfuehrung "$DOMAIN")
CADDY=0; WEBSITE_BIND=0.0.0.0; HTTP_PORT=80; HTTPS_PORT=443; ACME_MAIL=""
if [ -n "$DOMAIN" ]; then
  echo
  echo "HTTPS: Entweder ein eigener Caddy-Container nur für die Website (braucht die Ports 80 und 443),"
  echo "oder ein vorhandener Reverse-Proxy leitet die Domain an Port $WEBSITE_PORT weiter."
  standard=j
  if besetzt 80 || besetzt 443; then
    standard=n
    echo "Hinweis: Port 80 oder 443 ist bereits belegt (z. B. durch einen vorhandenen Reverse-Proxy)."
  fi
  if ja "Eigenen Caddy-Container für HTTPS einrichten? j/n" "$standard"; then
    CADDY=1
    HTTP_PORT=$(freier_port "HTTP-Port (Caddy)" 80)
    HTTPS_PORT=$(freier_port "HTTPS-Port (Caddy)" 443)
    ACME_MAIL=$(ohne_anfuehrung "$(frage "E-Mail für Hinweise zum Zertifikat (leer lassen möglich)" "")")
    WEBSITE_BIND=127.0.0.1
  elif ja "Website nur lokal anbieten (127.0.0.1, Reverse-Proxy auf demselben Server)? j/n" j; then
    WEBSITE_BIND=127.0.0.1
  fi
fi

echo
echo "Angaben für Impressum und Datenschutz (leer = Platzhalter, später in .env ergänzen):"
B_NAME=$(ohne_anfuehrung "$(frage "Name" "")")
B_ANSCHRIFT=$(ohne_anfuehrung "$(frage "Anschrift (z. B. Musterweg 1, 12345 Musterstadt)" "")")
B_EMAIL=$(ohne_anfuehrung "$(frage "E-Mail-Adresse" "")")
ZEITZONE=$(ohne_anfuehrung "$(frage "Zeitzone" "Europe/Berlin")")

# --- .env und Caddyfile ------------------------------------------------------------------------------------------
umask 077
{
  echo "# EduOrga Website – Einstellungen (von install-intern.sh erzeugt am $(date '+%F %T'))."
  echo "# Nach Änderungen: docker compose -f $COMPOSE_DATEI up -d"
  [ "$CADDY" = 1 ] && echo "COMPOSE_PROFILES=https"
  echo "WEBSITE_VERSION=latest"
  echo "ZEITZONE=$ZEITZONE"
  echo "WEBSITE_BIND=$WEBSITE_BIND"
  echo "WEBSITE_PORT=$WEBSITE_PORT"
  echo "WEBSITE_DOMAIN=$DOMAIN"
  if [ "$CADDY" = 1 ]; then
    echo "HTTP_PORT=$HTTP_PORT"
    echo "HTTPS_PORT=$HTTPS_PORT"
  fi
  echo
  echo "# Angaben für Impressum und Datenschutz (leer = Platzhalter auf der Website)"
  echo "WEBSITE_BETREIBER_NAME='$B_NAME'"
  echo "WEBSITE_BETREIBER_ANSCHRIFT='$B_ANSCHRIFT'"
  echo "WEBSITE_BETREIBER_EMAIL='$B_EMAIL'"
} > .env
umask 022

if [ "$CADDY" = 1 ]; then
  {
    echo "# EduOrga Website – HTTPS über Caddy (von install-intern.sh erzeugt). Nach Änderungen:"
    echo "#   docker compose -f $COMPOSE_DATEI restart untplannext-website-caddy"
    if [ -n "$ACME_MAIL" ]; then printf '{\n\temail %s\n}\n' "$ACME_MAIL"; fi
    printf '\n%s {\n\tencode zstd gzip\n\treverse_proxy untplannext-website:8080\n\theader Strict-Transport-Security "max-age=31536000"\n}\n' "$DOMAIN"
  } > Caddyfile
fi

# --- starten -----------------------------------------------------------------------------------------------------
echo
starten

echo
echo "Fertig. Einstellungen: $(pwd)/.env"
if [ "$CADDY" = 1 ]; then
  if [ "$HTTPS_PORT" = 443 ]; then echo "  Website  https://$DOMAIN"; else echo "  Website  https://$DOMAIN:$HTTPS_PORT"; fi
  echo "           (das Zertifikat wird beim ersten Aufruf geholt; die Domain muss auf diesen Server zeigen)"
elif [ -n "$DOMAIN" ]; then
  echo "  Website  http://$WEBSITE_BIND:$WEBSITE_PORT – im vorhandenen Reverse-Proxy für $DOMAIN eintragen, z. B.:"
  echo
  echo "  Caddy:"
  printf '    %s {\n      encode zstd gzip\n      reverse_proxy 127.0.0.1:%s\n    }\n' "$DOMAIN" "$WEBSITE_PORT"
  echo
  echo "  nginx (innerhalb des server-Blocks für $DOMAIN):"
  printf '    location / {\n      proxy_pass http://127.0.0.1:%s;\n      proxy_set_header Host $host;\n      proxy_set_header X-Forwarded-Proto $scheme;\n    }\n' "$WEBSITE_PORT"
else
  echo "  Website  http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo localhost):$WEBSITE_PORT"
fi
[ -n "$B_NAME" ] && [ -n "$B_ANSCHRIFT" ] && [ -n "$B_EMAIL" ] \
  || echo "  Impressum/Datenschutz: WEBSITE_BETREIBER_NAME, _ANSCHRIFT, _EMAIL in .env ergänzen, dann docker compose -f $COMPOSE_DATEI up -d"
echo
echo "Update: ./install-intern.sh --update"
