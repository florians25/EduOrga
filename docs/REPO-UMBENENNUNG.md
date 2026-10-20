# Repository in „EduOrga“ umbenennen – Checkliste

Ziel: `github.com/florians25/UntPlanNext` → `github.com/florians25/EduOrga`.

## Was beim Umbenennen automatisch weiterläuft
GitHub leitet nach dem Umbenennen alte Adressen weiter (Web, `git clone/pull/push`, `api.github.com/repos/…`,
`raw.githubusercontent.com/…`). Laufende Installationen, die noch die alte Adresse in `install.sh`/`update.sh`
nutzen, funktionieren daher weiter. Die Weiterleitung entfällt, wenn später ein **neues** Repository mit dem alten
Namen angelegt wird – das nicht tun.

**Unverändert bleiben bewusst** (sonst müssten alle Schulen umziehen):
Docker-Images `ghcr.io/florians25/untplannext-studio|-web|-mobile|-website`, Container-, Dienst- und Volume-Namen
`untplannext-*`, Installationsordner `/opt/untplannext`, Umgebungsvariablen `UNTPLANWEB_*`/`STUDIO_*`, Programmdateien,
iOS-Bundle-ID `de.untplan.next` und der Ordner `ios/UntPlanNext`. Die GitHub-Pakete (ghcr) bleiben beim Umbenennen
des Repositorys erhalten; die Workflows veröffentlichen weiter unter denselben Image-Namen.

## Schritte
1. Laufende Arbeiten committen und pushen.
2. Auf GitHub: *Settings → General → Repository name* → `EduOrga` → *Rename*.
3. Lokal bzw. hier im Arbeitsbereich: `sh tools/repo-umbenennen.sh --pruefen` (zeigt die Stellen), dann
   `sh tools/repo-umbenennen.sh` (ersetzt `florians25/UntPlanNext` → `florians25/EduOrga` in Links, Installations-
   befehlen, Update-Quellen, Website-Texten, Dockerfile-Labels und stellt `git remote origin` um).
4. Tests laufen lassen, committen, pushen – die Workflows bauen die Images neu.
5. Prüfen: Update-Hinweis in Studio/Web (`/api/version`), `install.sh`-Download-Befehl aus der README, Website-Links.
6. Optional: GitHub-Pakete in den Paket-Einstellungen mit dem umbenannten Repository verknüpft lassen (Standard)
   und die Paketbeschreibung anpassen.

## Später (eigene Entscheidung, nicht nötig)
Image-, Container- und Volume-Namen auf `eduorga-*` umstellen – erfordert eine Umzugsanleitung für bestehende
Installationen (Volumes umkopieren oder `name:`-Angaben beibehalten).
