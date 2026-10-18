#!/bin/sh
# Passwort eines Benutzers von UntPlan Studio oder UntPlan Web neu setzen – z. B. wenn das Admin-Passwort vergessen wurde.
# (Die Passwörter in .env gelten nur beim allerersten Start, solange es noch keine Benutzer gibt.)
#
#   ./passwort.sh studio [benutzer]   Standard: STUDIO_ADMIN_BENUTZER aus .env, sonst admin
#   ./passwort.sh web [login]         Standard: admin
#
# Weitere Optionen:
#   --anlegen              fehlenden Benutzer als Administrator anlegen
#   --aenderungspflicht    nur Web: bei der nächsten Anmeldung muss ein neues Passwort gewählt werden
#
# Das Passwort wird verdeckt zweimal abgefragt (ohne Terminal: eine Zeile über die Standardeingabe).
# Die Container müssen laufen; die Änderung gilt sofort, ein Neustart ist nicht nötig.
set -eu
cd "$(dirname "$0")"

fehler() { echo "Fehler: $*" >&2; exit 1; }
wert() { [ -f .env ] && sed -n "s/^$1=//p" .env | tail -n 1 | tr -d '"' || true; }

PROGRAMM=""; BENUTZER=""; OPTIONEN=""
for a in "$@"; do
  case "$a" in
    -h|--hilfe) sed -n '2,13p' "$0"; exit 0 ;;
    --anlegen|--aenderungspflicht) OPTIONEN="$OPTIONEN $a" ;;
    -*) echo "Unbekannte Option: $a" >&2; exit 2 ;;
    *)
      if [ -z "$PROGRAMM" ]; then PROGRAMM=$a
      elif [ -z "$BENUTZER" ]; then BENUTZER=$a
      else echo "Zu viele Angaben: $a" >&2; exit 2; fi ;;
  esac
done

case "$PROGRAMM" in
  studio)
    DIENST=untplannext-studio; DLL=UntPlanStudio.dll; NAME="UntPlan Studio"
    [ -n "$BENUTZER" ] || BENUTZER=$(wert STUDIO_ADMIN_BENUTZER)
    case "$OPTIONEN" in *--aenderungspflicht*) fehler "--aenderungspflicht gibt es nur für UntPlan Web." ;; esac ;;
  web)
    DIENST=untplannext-web; DLL=UntPlanWeb.dll; NAME="UntPlan Web" ;;
  *) echo "Aufruf: ./passwort.sh studio|web [benutzer] [--anlegen] [--aenderungspflicht]" >&2; exit 2 ;;
esac
BENUTZER=${BENUTZER:-admin}

command -v docker >/dev/null 2>&1 || fehler "Docker ist nicht installiert."
docker compose ps --services --status running 2>/dev/null | grep -qx "$DIENST" \
  || fehler "$NAME ($DIENST) läuft nicht – bitte zuerst „docker compose up -d“."

geheim() { # geheim <Text> → Eingabe ohne Anzeige
  printf '%s: ' "$1" >&2
  stty -echo 2>/dev/null || true
  read -r g || g=""
  stty echo 2>/dev/null || true
  printf '\n' >&2
  echo "$g"
}

if [ -t 0 ]; then
  trap 'stty echo 2>/dev/null || true' EXIT INT TERM
  echo "Neues Passwort für „$BENUTZER“ in $NAME"
  PW=$(geheim "Neues Passwort")
  [ -n "$PW" ] || fehler "Kein Passwort eingegeben."
  PW2=$(geheim "Passwort wiederholen")
  [ "$PW" = "$PW2" ] || fehler "Die Eingaben stimmen nicht überein."
else
  read -r PW || PW=""
  [ -n "$PW" ] || fehler "Kein Passwort erhalten (erwartet: eine Zeile über die Standardeingabe)."
fi

# Passwort über die Standardeingabe weitergeben (erscheint so weder in der Prozessliste noch im Verlauf)
# shellcheck disable=SC2086
printf '%s\n' "$PW" | docker compose exec -T "$DIENST" dotnet "$DLL" --passwort-setzen "$BENUTZER" $OPTIONEN
