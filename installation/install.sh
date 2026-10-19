#!/bin/sh
# UntPlan einrichten: fragt die gewünschten Programme ab, schreibt .env und Caddyfile und startet die Container.
#
#   ./install.sh                 Fragen beantworten (Eingabetaste übernimmt den Vorschlag in [Klammern])
#   ./install.sh --neu           vorhandene .env ignorieren und neu fragen
#
# Ohne Repository auf einem frischen Server:
#   mkdir -p /opt/untplannext && cd /opt/untplannext
#   curl -fsSL -H "Accept: application/vnd.github.raw" -o install.sh "https://api.github.com/repos/florians25/UntPlanNext/contents/installation/install.sh?ref=master"
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

# Datei aus dem Repository laden – über die GitHub-API (nicht zwischengespeichert), sonst über raw.githubusercontent.com
API=${UNTPLAN_API:-https://api.github.com/repos/florians25/UntPlanNext/contents/installation}
laden() { # laden <Datei> <Ziel>
  curl -fsSL -H "Accept: application/vnd.github.raw" "$API/$1?ref=master" -o "$2" 2>/dev/null \
    || curl -fsSL "$QUELLE/$1" -o "$2" 2>/dev/null
}

# docker-compose.yml, update.sh und passwort.sh immer in der aktuellen Fassung verwenden (ältere oder fremde Dateien, z. B. aus
# früheren UntPlan-Installationen, werden als *.alt-<Datum> beiseitegelegt)
for datei in docker-compose.yml update.sh passwort.sh; do
  if command -v curl >/dev/null 2>&1 && laden "$datei" "$datei.neu"; then
    if [ -f "$datei" ] && ! cmp -s "$datei" "$datei.neu"; then
      mv "$datei" "$datei.alt-$(date +%Y%m%d-%H%M%S)"
      echo "Ältere $datei beiseitegelegt, aktuelle Fassung geladen."
    fi
    mv "$datei.neu" "$datei"
  else
    rm -f "$datei.neu"
    [ -f "$datei" ] || [ "$datei" = passwort.sh ] || fehler "$datei fehlt und konnte nicht geladen werden ($QUELLE)."
  fi
done
grep -q "ghcr.io/florians25/untplannext-studio" docker-compose.yml \
  || fehler "docker-compose.yml ist nicht die aktuelle Fassung von UntPlan Next (GitHub lieferte evtl. noch eine zwischengespeicherte Datei).
Bitte „rm docker-compose.yml“ und install.sh in ein paar Minuten erneut aufrufen."
chmod +x update.sh
[ ! -f passwort.sh ] || chmod +x passwort.sh

# MariaDB für EduOrga Studio: zweite Datenbank eduorga_studio im selben Container (untplannext-mariadb), Benutzer wie Web.
# Neues MariaDB-Volume: das Init-Skript in ./mariadb-init legt sie beim ersten Start an. Vorhandenes Volume (Init-Skripte laufen
# dann nicht mehr): studio_mariadb legt Datenbank und Rechte als root an, bevor Studio startet.
mkdir -p mariadb-init
cat > mariadb-init/01-eduorga-studio.sh <<'SKRIPT'
#!/bin/sh
# Von install.sh erzeugt: Datenbank für EduOrga Studio (läuft nur beim allerersten Start eines leeren MariaDB-Volumes).
mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" <<SQL
CREATE DATABASE IF NOT EXISTS \`${STUDIO_DATENBANK:-eduorga_studio}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
GRANT ALL PRIVILEGES ON \`${STUDIO_DATENBANK:-eduorga_studio}\`.* TO '${MARIADB_USER:-untplanweb}'@'%';
FLUSH PRIVILEGES;
SQL
SKRIPT
env_wert() { [ -f .env ] && sed -n "s/^$1=//p" .env | tail -n 1 | tr -d '"' || true; }
studio_mariadb() { # Datenbank eduorga_studio anlegen und dem MariaDB-Benutzer erlauben (nur bei STUDIO_DB=mysql)
  [ "$(env_wert STUDIO_DB)" = mysql ] || return 0
  echo "Richte die MariaDB-Datenbank für EduOrga Studio ein …"
  docker compose up -d untplannext-mariadb >/dev/null
  i=0
  until docker compose exec -T untplannext-mariadb sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" -e "SELECT 1"' >/dev/null 2>&1; do
    i=$((i + 1)); [ "$i" -lt 60 ] || { echo "WARNUNG: MariaDB antwortet nicht – Datenbank für Studio später mit ./install.sh anlegen." >&2; return 0; }
    sleep 2
  done
  docker compose exec -T untplannext-mariadb sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS \`eduorga_studio\` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin; GRANT ALL PRIVILEGES ON \`eduorga_studio\`.* TO \"$MARIADB_USER\"@\"%\"; FLUSH PRIVILEGES;"' \
    || echo "WARNUNG: Datenbank eduorga_studio konnte nicht angelegt werden (siehe installation/README.md)." >&2
}

if [ -f .env ] && [ "$NEU" = 0 ]; then
  echo "Vorhandene Einstellungen (.env) gefunden – Container werden mit diesen Einstellungen gestartet."
  echo "Neu einrichten: ./install.sh --neu (Daten bleiben erhalten)."
  docker compose pull || fehler "Images konnten nicht geladen werden – Pakete auf ghcr.io öffentlich stellen oder „docker login ghcr.io“ (siehe README)."
  studio_mariadb
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
STUDIO=0; WEB=0; MOBILE=0; WEBSITE=0
ja "UntPlan Studio installieren (Stundenplanung im Browser)? j/n" j && { STUDIO=1; profile="studio"; }
ja "UntPlan Web installieren (Portal für Lehrkräfte, Schüler und Eltern)? j/n" j && { WEB=1; profile="${profile:+$profile,}web"; }
if [ "$WEB" = 1 ]; then
  ja "UntPlan Mobile installieren (App fürs Telefon, nutzt UntPlan Web)? j/n" j && { MOBILE=1; profile="$profile,mobile"; }
fi
ja "Produkt-Website mit Ideenportal installieren? j/n" n && { WEBSITE=1; profile="${profile:+$profile,}website"; }
[ -n "$profile" ] || fehler "Kein Programm ausgewählt."

DB=sqlite; STUDIO_DB=sqlite
if [ "$WEB" = 1 ]; then
  echo
  echo "Datenbank für UntPlan Web: SQLite reicht für die meisten Schulen; MariaDB für große Schulen oder vorhandene Sicherungskonzepte."
  case "$(frage "Datenbank (sqlite/mariadb)" sqlite)" in m*|M*) DB=mysql ;; esac
fi
if [ "$STUDIO" = 1 ]; then
  echo
  echo "Datenbank für EduOrga Studio: SQLite (Datei im Volume) reicht; MariaDB nutzt denselben Container wie Web (zweite Datenbank eduorga_studio)."
  echo "Eine vorhandene SQLite-Datenbank des Studios wird beim ersten Start mit MariaDB automatisch übernommen."
  case "$(frage "Datenbank für EduOrga Studio (sqlite/mariadb)" sqlite)" in m*|M*) STUDIO_DB=mysql ;; esac
fi
if [ "$DB" = mysql ] || [ "$STUDIO_DB" = mysql ]; then profile="$profile,mariadb"; MARIADB_PW=$(passwort); MARIADB_ROOT_PW=$(passwort); fi

echo
HTTPS=0
if ja "HTTPS mit automatischem Zertifikat einrichten (Server ist aus dem Internet unter eigenen Domains erreichbar)? j/n" j; then
  HTTPS=1; profile="$profile,https"
  [ "$STUDIO" = 1 ] && STUDIO_DOMAIN=$(frage "Domain für UntPlan Studio" "studio.meine-schule.de")
  [ "$WEB" = 1 ] && WEB_DOMAIN=$(frage "Domain für UntPlan Web" "plan.meine-schule.de")
  [ "$MOBILE" = 1 ] && MOBILE_DOMAIN=$(frage "Domain für UntPlan Mobile" "app.meine-schule.de")
  [ "$WEBSITE" = 1 ] && WEBSITE_DOMAIN=$(frage "Domain für die Produkt-Website" "eduorga.meine-schule.de")
  ACME_MAIL=$(frage "E-Mail für Hinweise zum Zertifikat (leer lassen möglich)" "")
fi

UPDATER=0
if [ "$WEB" = 1 ] && ja "Updates aus der Administration von UntPlan Web erlauben (Watchtower)? j/n" n; then
  UPDATER=1; profile="$profile,updater"
fi

ZEITZONE=$(frage "Zeitzone" "Europe/Berlin")

port() { # port <Text> <Vorschlag> → geprüfte Portnummer
  while :; do
    p=$(frage "$1" "$2")
    case "$p" in ''|*[!0-9]*) ;; *) if [ "$p" -ge 1 ] && [ "$p" -le 65535 ]; then echo "$p"; return; fi ;; esac
    echo "Bitte eine Zahl zwischen 1 und 65535 eingeben." >&2
  done
}
STUDIO_PORT=8190; WEB_PORT=8180; MOBILE_PORT=8181; WEBSITE_PORT=8200; HTTP_PORT=80; HTTPS_PORT=443
if ja "Ports selbst festlegen (sonst Studio 8190, Web 8180, Mobile 8181$( [ "$WEBSITE" = 1 ] && echo ", Website 8200")$( [ "$HTTPS" = 1 ] && echo ", HTTP 80, HTTPS 443"))? j/n" n; then
  [ "$STUDIO" = 1 ] && STUDIO_PORT=$(port "Port für UntPlan Studio" 8190)
  [ "$WEB" = 1 ] && WEB_PORT=$(port "Port für UntPlan Web" 8180)
  [ "$MOBILE" = 1 ] && MOBILE_PORT=$(port "Port für UntPlan Mobile" 8181)
  [ "$WEBSITE" = 1 ] && WEBSITE_PORT=$(port "Port für die Produkt-Website" 8200)
  if [ "$HTTPS" = 1 ]; then
    echo "Hinweis: Für das automatische Zertifikat müssen die Ports 80 und 443 aus dem Internet erreichbar sein –"
    echo "andere Ports nur, wenn der Router 80/443 auf diese Ports weiterleitet."
    HTTP_PORT=$(port "HTTP-Port (Caddy)" 80)
    HTTPS_PORT=$(port "HTTPS-Port (Caddy)" 443)
  fi
  belegt=$(printf '%s\n' $( [ "$STUDIO" = 1 ] && echo "$STUDIO_PORT") $( [ "$WEB" = 1 ] && echo "$WEB_PORT") \
    $( [ "$MOBILE" = 1 ] && echo "$MOBILE_PORT") $( [ "$WEBSITE" = 1 ] && echo "$WEBSITE_PORT") $( [ "$HTTPS" = 1 ] && echo "$HTTP_PORT $HTTPS_PORT") | sort | uniq -d)
  [ -z "$belegt" ] || fehler "Port $belegt ist mehrfach vergeben."
fi

# Ports, die schon belegt sind (z. B. vom bisherigen UntPlan), neu abfragen
besetzt() { # besetzt <Port> → 0, wenn auf dem Server schon etwas lauscht
  if command -v ss >/dev/null 2>&1; then ss -ltnH 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$1\$"
  elif command -v netstat >/dev/null 2>&1; then netstat -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$1\$"
  else return 1; fi
}
pruefen() { # pruefen <Variable> <Text>
  eval "wert=\$$1"
  while besetzt "$wert"; do
    echo "Port $wert ist auf diesem Server bereits belegt (z. B. durch die bisherige UntPlan-Installation)." >&2
    wert=$(port "$2" "$((wert + 1000))")
  done
  eval "$1=\$wert"
}
[ "$STUDIO" = 1 ] && pruefen STUDIO_PORT "Port für UntPlan Studio"
[ "$WEB" = 1 ] && pruefen WEB_PORT "Port für UntPlan Web"
[ "$MOBILE" = 1 ] && pruefen MOBILE_PORT "Port für UntPlan Mobile"
[ "$WEBSITE" = 1 ] && pruefen WEBSITE_PORT "Port für die Produkt-Website"
if [ "$HTTPS" = 1 ]; then
  pruefen HTTP_PORT "HTTP-Port (Caddy)"
  pruefen HTTPS_PORT "HTTPS-Port (Caddy)"
fi

# Zugangsdaten: eigenes Passwort eingeben (verdeckt, zweimal) oder leer lassen → zufälliges Passwort
geheim() { # geheim <Text> → Eingabe ohne Anzeige
  printf '%s: ' "$1" >&2
  stty -echo 2>/dev/null || true
  read -r g || g=""
  stty echo 2>/dev/null || true
  printf '\n' >&2
  echo "$g"
}
passwort_festlegen() { # passwort_festlegen <Programm> → Passwort auf stdout
  while :; do
    p1=$(geheim "Passwort für den Administrator von $1 (mind. 8 Zeichen, leer = zufällig)")
    if [ -z "$p1" ]; then passwort; return; fi
    case "$p1" in
      *[[:space:]]*|*\"*|*\'*|*\$*|*\\*|*\`*) echo "Bitte ohne Leerzeichen und ohne die Zeichen \" ' \$ \\ \`." >&2; continue ;;
    esac
    if [ "${#p1}" -lt 8 ]; then echo "Das Passwort muss mindestens 8 Zeichen lang sein." >&2; continue; fi
    p2=$(geheim "Passwort wiederholen")
    [ "$p1" = "$p2" ] && { echo "$p1"; return; }
    echo "Die Eingaben stimmen nicht überein." >&2
  done
}
STUDIO_PW=""; WEB_PW=""; WEBSITE_PW=""; STUDIO_BENUTZER=admin
if [ "$STUDIO" = 1 ]; then
  STUDIO_BENUTZER=$(frage "Benutzername des Administrators von UntPlan Studio" admin)
  case "$STUDIO_BENUTZER" in ''|*[!A-Za-z0-9._-]*) fehler "Benutzername bitte nur aus Buchstaben, Ziffern, Punkt, Binde- und Unterstrich." ;; esac
  STUDIO_PW=$(passwort_festlegen "UntPlan Studio")
fi
[ "$WEB" = 1 ] && WEB_PW=$(passwort_festlegen "UntPlan Web (Benutzer admin)")
[ "$WEBSITE" = 1 ] && WEBSITE_PW=$(passwort_festlegen "der Produkt-Website (Benutzer admin)")

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
  echo "STUDIO_PORT=$STUDIO_PORT"
  echo "WEB_PORT=$WEB_PORT"
  echo "MOBILE_PORT=$MOBILE_PORT"
  echo "WEBSITE_PORT=$WEBSITE_PORT"
  echo "HTTP_PORT=$HTTP_PORT"
  echo "HTTPS_PORT=$HTTPS_PORT"
  if [ "$STUDIO" = 1 ]; then
    echo
    echo "# UntPlan Studio (eigene Datenbank im Volume untplannext-studio-daten)"
    echo "STUDIO_ADMIN_BENUTZER=$STUDIO_BENUTZER"
    echo "STUDIO_ADMIN_PASSWORT=$STUDIO_PW"
    echo "STUDIO_SICHERE_COOKIES=$HTTPS"
    echo "STUDIO_DB=$STUDIO_DB"
    if [ "$STUDIO_DB" = mysql ]; then
      echo "STUDIO_DB_CONNECTION=\"Server=untplannext-mariadb;Port=3306;Database=eduorga_studio;User ID=untplanweb;Password=$MARIADB_PW\""
    fi
  fi
  if [ "$DB" = mysql ] || [ "$STUDIO_DB" = mysql ]; then
    echo
    echo "# MariaDB (Container untplannext-mariadb): Datenbanken untplanweb und eduorga_studio, Benutzer untplanweb"
    echo "MARIADB_PASSWORT=$MARIADB_PW"
    echo "MARIADB_ROOT_PASSWORT=$MARIADB_ROOT_PW"
  fi
  if [ "$WEB" = 1 ]; then
    echo
    echo "# UntPlan Web (eigene Datenbank: $DB)"
    echo "UNTPLANWEB_ADMIN_PASSWORT=$WEB_PW"
    echo "UNTPLANWEB_DB=$DB"
    if [ "$DB" = mysql ]; then
      echo "UNTPLANWEB_DB_CONNECTION=\"Server=untplannext-mariadb;Port=3306;Database=untplanweb;User ID=untplanweb;Password=$MARIADB_PW\""
    fi
    [ "$MOBILE" = 1 ] && echo "UNTPLANWEB_MOBILE_INTERN_URL=http://untplannext-mobile:8081"
    if [ "$UPDATER" = 1 ]; then
      echo "UNTPLANWEB_UPDATE_WATCHTOWER_URL=http://untplannext-watchtower:8080/v1/update"
      echo "WATCHTOWER_TOKEN=$(passwort)"
    fi
  fi
  if [ "$WEBSITE" = 1 ]; then
    echo
    echo "# EduOrga Website mit Ideenportal (eigene Datenbank im Volume untplannext-website-daten)"
    echo "WEBSITE_ADMIN_BENUTZER=admin"
    echo "WEBSITE_ADMIN_PASSWORT=$WEBSITE_PW"
    echo "WEBSITE_SICHERE_COOKIES=$HTTPS"
    echo "WEBSITE_HINTER_PROXY=$HTTPS"
    echo "# Angaben für Impressum und Datenschutz (leer = Platzhalter auf der Website)"
    echo "WEBSITE_BETREIBER_NAME="
    echo "WEBSITE_BETREIBER_ANSCHRIFT="
    echo "WEBSITE_BETREIBER_EMAIL="
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
    printf '\n%s {\n\tencode zstd gzip\n\treverse_proxy untplannext-studio:8080 {\n\t\tflush_interval -1\n\t}\n\trequest_body {\n\t\tmax_size 64MB\n\t}\n\theader Strict-Transport-Security "max-age=31536000"\n}\n' "$STUDIO_DOMAIN"
  fi
  if [ "$HTTPS" = 1 ] && [ "$WEB" = 1 ]; then
    printf '\n%s {\n\tencode zstd gzip\n\treverse_proxy untplannext-web:8080\n\theader Strict-Transport-Security "max-age=31536000"\n}\n' "$WEB_DOMAIN"
  fi
  if [ "$HTTPS" = 1 ] && [ "$MOBILE" = 1 ]; then
    printf '\n%s {\n\tencode zstd gzip\n\treverse_proxy untplannext-mobile:8081\n\theader Strict-Transport-Security "max-age=31536000"\n}\n' "$MOBILE_DOMAIN"
  fi
  if [ "$HTTPS" = 1 ] && [ "$WEBSITE" = 1 ]; then
    printf '\n%s {\n\tencode zstd gzip\n\treverse_proxy untplannext-website:8080\n\trequest_body {\n\t\tmax_size 1MB\n\t}\n\theader Strict-Transport-Security "max-age=31536000"\n}\n' "$WEBSITE_DOMAIN"
  fi
} > Caddyfile

# --- starten -----------------------------------------------------------------------------------------------------
echo
echo "Lade Images und starte Container …"
if ! docker compose pull; then
  echo >&2
  echo "Die Images konnten nicht geladen werden. Häufigste Ursache: die Pakete auf ghcr.io sind nicht öffentlich." >&2
  echo "  • Auf GitHub unter Profil → Packages → untplannext-studio / untplannext-web / untplannext-mobile / untplannext-website" >&2
  echo "    → Package settings → Change visibility → Public stellen, oder" >&2
  echo "  • auf dem Server anmelden: docker login ghcr.io -u <GitHub-Benutzer>  (Token mit Recht read:packages)" >&2
  echo "Danach ./install.sh erneut aufrufen (die Einstellungen bleiben erhalten)." >&2
  exit 1
fi
studio_mariadb
docker compose up -d --remove-orphans

# Die Passwörter aus .env gelten nur beim allerersten Start (solange es keine Benutzer gibt). Enthalten die Volumes schon
# Daten (erneute Einrichtung mit --neu, frühere Installation), werden die gewählten Passwörter hier ausdrücklich gesetzt.
bereit() { # bereit <Dienst> <dll> → 0, sobald das Programm antwortet (höchstens etwa 90 Sekunden)
  i=0
  while [ "$i" -lt 45 ]; do
    docker compose exec -T "$1" dotnet "$2" --gesundheitspruefung >/dev/null 2>&1 && return 0
    sleep 2; i=$((i + 1))
  done
  return 1
}
admin_passwort() { # admin_passwort <Dienst> <dll> <Benutzer> <Passwort> <Programm> <Kürzel für passwort.sh>
  echo "Setze das Administrator-Passwort von $5 …"
  if bereit "$1" "$2" \
    && printf '%s\n' "$4" | docker compose exec -T "$1" dotnet "$2" --passwort-setzen "$3" --anlegen >/dev/null; then
    return 0
  fi
  echo >&2
  echo "WARNUNG: Das Passwort für „$3“ in $5 konnte nicht gesetzt werden – die unten angezeigten Zugangsdaten gelten" >&2
  echo "         womöglich nicht (z. B. wenn schon Daten einer früheren Einrichtung vorhanden sind)." >&2
  echo "         Später nachholen mit: ./passwort.sh $6 $3   (Protokoll: docker compose logs $1)" >&2
  echo >&2
}
[ "$STUDIO" = 1 ] && admin_passwort untplannext-studio UntPlanStudio.dll "$STUDIO_BENUTZER" "$STUDIO_PW" "UntPlan Studio" studio
[ "$WEB" = 1 ] && admin_passwort untplannext-web UntPlanWeb.dll admin "$WEB_PW" "UntPlan Web" web
[ "$WEBSITE" = 1 ] && admin_passwort untplannext-website EduOrgaWebsite.dll admin "$WEBSITE_PW" "der Produkt-Website" website

adresse() { # adresse <Domain> <Port>
  if [ "$HTTPS" = 1 ]; then
    if [ "$HTTPS_PORT" = 443 ]; then echo "https://$1"; else echo "https://$1:$HTTPS_PORT"; fi
  else echo "http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo localhost):$2"; fi
}
echo
echo "Fertig. Zugangsdaten stehen in $(pwd)/.env – bitte sicher aufbewahren und nach der ersten Anmeldung ändern."
[ "$STUDIO" = 1 ] && echo "  UntPlan Studio  $(adresse "${STUDIO_DOMAIN:-}" "$STUDIO_PORT")   Benutzer $STUDIO_BENUTZER, Passwort $STUDIO_PW"
[ "$WEB" = 1 ]    && echo "  UntPlan Web     $(adresse "${WEB_DOMAIN:-}" "$WEB_PORT")   Benutzer admin, Passwort $WEB_PW"
[ "$MOBILE" = 1 ] && echo "  UntPlan Mobile  $(adresse "${MOBILE_DOMAIN:-}" "$MOBILE_PORT")   Anmeldung mit dem Konto von UntPlan Web"
[ "$WEBSITE" = 1 ] && echo "  Website         $(adresse "${WEBSITE_DOMAIN:-}" "$WEBSITE_PORT")   Verwaltung unter /verwaltung: Benutzer admin, Passwort $WEBSITE_PW"
[ "$WEBSITE" = 1 ] && echo "                  Impressum/Datenschutz: WEBSITE_BETREIBER_NAME, _ANSCHRIFT, _EMAIL in .env eintragen, dann docker compose up -d"
if [ "$STUDIO" = 1 ] && [ "$WEB" = 1 ]; then
  echo
  echo "Pläne von Studio nach Web übertragen: in Studio „UntPlan Web“ → „Einstellungen“ öffnen und eintragen:"
  echo "  Server untplannext-web, Port 8080, ohne HTTPS (internes Netz der Container),"
  echo "  Schul-ID und API-Schlüssel aus UntPlan Web (Administration → Verbindung mit UntPlan)."
fi
echo
echo "Update: ./update.sh   (sichert vorher die Datenbanken von Studio und Web)"
echo "Passwort vergessen: ./passwort.sh studio|web|website [benutzer]"
