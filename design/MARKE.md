# EduOrga – Marke

**Produktname:** EduOrga (Kürzel **EDO**) · **Slogan:** *Einfach mehr Schulalltag.*

| Produkt | Name in der Oberfläche |
|---|---|
| Planung im Browser (bisher UntPlan Studio) | **EduOrga Studio** |
| Portal für Lehrkräfte, Schüler, Eltern (bisher UntPlan Web) | **EduOrga Web** |
| App fürs Telefon (PWA) | **EduOrga Mobile** |
| iPhone/iPad-App | **EduOrga** |

Technische Kennungen (Docker-Images `untplannext-*`, Container, Volumes, Umgebungsvariablen `UNTPLANWEB_*`/`STUDIO_*`,
Programmdateien, Bundle-ID, Dateiendung `.up`) bleiben vorerst unverändert, damit laufende Installationen ohne Umzug
weiterarbeiten. In Oberfläche, Texten, Dokumentation, Titeln, Manifesten und E-Mails heißt das Produkt EduOrga.

## Farben (Corporate Design)

| Rolle | Wert | Verwendung |
|---|---|---|
| Primärfarbe | `#164C55` | Logo, Navigation, Knöpfe |
| Akzentfarbe | `#28747A` | aktive Bereiche, Links, Fokus |
| Hintergrund | `#F5F7F8` | Dashboard-Flächen, Seitenhintergrund |
| Textfarbe | `#24363B` | Überschriften und Inhalte |

Abgeleitete Reihe in `design/tokens.css` (`--up-marine-50 … 900`, 700 = Primär, 500 = Akzent). Statusfarben:
Entfall `#b42318`, Änderung/Vertretung **Violett `#6d4fc2`** (bewusst weit weg vom Marken-Petrol), Prüfung `#a15c07`,
Termin `#a3347c`, Frei `#2f6f9f`.

## Logo

`design/logo/edo-monogramm.svg` (Kachel #164C55, weißes „E“, kleines helles Petrol-Quadrat am mittleren Balken),
`edo-monogramm-eckig.svg` (App-Symbole), `edo-zeichen.svg` (nur das E, `currentColor`), `edo-wortmarke.svg`
(„**Edu**Orga“ – Edu 600, Orga 400, IBM Plex Sans).

## Haltung

Hochprofessionell, sachlich, eher „steril“ wie etablierte Schulplattformen – ein Schulsystem, keine Spiellandschaft.
Das klassische Grunddesign bekannter Stundenplan- und Schulportale (klare Raster, dichte Tabellen, gut lesbare
Stundenkarten, linke Navigation) ist ausdrücklich Vorbild – **aber nicht 1:1**: keine fremden Namen, Logos, Symbole,
Bezeichnungen oder Menüstrukturen übernehmen. Ausreichend Kontrast (keine „alles weiß“-Flächen), klare Linien,
dezente Symbole dort, wo sie die Orientierung erleichtern.

## Rechtlicher Hinweis (Website, Über-Dialoge, README)

> EduOrga ist ein privates Hobbyprojekt eines Auszubildenden zum Fachinformatiker für Systemintegration, entwickelt mit
> Unterstützung von Claude (Anthropic). Jede Schule bzw. jeder Betreiber ist für Einsatz, Betrieb und Datenschutz
> selbst verantwortlich.
