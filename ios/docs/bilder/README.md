# Bildschirmfotos der App für iPhone und iPad

Die Website (`website/client/scripts/vorbereiten.mjs`) übernimmt beim Bauen diese Dateien nach
`website/client/public/bilder/ios/` und zeigt sie im iPhone-Rahmen auf der Startseite und der Seite „Mobile und iOS“.

| Datei | Inhalt |
|---|---|
| `plan-woche-hell.png` | Plan, Woche als Raster – helles Erscheinungsbild |
| `plan-woche-dunkel.png` | Plan, Woche als Raster – dunkles Erscheinungsbild |
| `stunde-details.png` | Stundendetails, Reiter „Details“ |
| `stunde-klassenbuch.png` | Stundendetails, Reiter „Klassenbuch“ |

Format: PNG, **920 × 2000 Pixel** (iPhone-Bildschirmfoto im Hochformat), nur Beispieldaten.

Fehlt eine Datei, verwendet die Website stattdessen das entsprechende Bildschirmfoto von EduOrga Mobile aus
`mobile/docs/bilder/` (gleiche Gestaltung): `plan-woche.png`, `dunkel-plan-woche.png`, `stundendetails.png`,
`stundendetails-klassenbuch.png`. Der Build schlägt dadurch nicht fehl.
