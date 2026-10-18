"""App-Symbol von UntPlan für iOS aus dem Signet rendern (hell, dunkel, getönt; je 1024 px, Xcode erzeugt die übrigen Größen).

Aufruf (im Ordner ios/):
    python3 Gestaltung/appicon_rendern.py UntPlanMobile/Assets.xcassets/AppIcon.appiconset [/pfad/vorschau.png]
Benötigt nur Pillow.

Geometrie und Farben wie das Signet in design/logo/mark.svg (64er-Raster): Marine-Fläche mit 3×3-Raster aus
Stundenfeldern; ein durchgehender Doppelblock in der Mitte, ein hervorgehobenes Feld unten rechts. Für das App-Symbol
ohne eigene Eckrundung – iOS legt die Maske selbst darüber. Flach, ohne Verläufe und ohne Schatten.
"""
import os
import sys

from PIL import Image, ImageDraw

AUSGABE = sys.argv[1] if len(sys.argv) > 1 else "UntPlanMobile/Assets.xcassets/AppIcon.appiconset"
VORSCHAU = sys.argv[2] if len(sys.argv) > 2 else None

GROESSE = 1024
UEBERABTASTUNG = 4          # glatte Kanten: groß zeichnen, dann verkleinern
RASTER = 64                 # Zeichenfläche von mark.svg

# Felder aus mark.svg: (x, y, Breite, Höhe, Rolle)
FELDER = [
    (14, 14, 10, 10, "voll"),
    (27, 14, 10, 10, "matt"),
    (40, 14, 10, 10, "matt"),
    (14, 27, 10, 10, "matt"),
    (27, 27, 23, 10, "voll"),
    (14, 40, 10, 10, "matt"),
    (27, 40, 10, 10, "matt"),
    (40, 40, 10, 10, "akzent"),
]
FELD_RADIUS = 2

# Farben je Variante: Hintergrund (None = durchsichtig) und Feldfarben als (R, G, B, A)
VARIANTEN = {
    # hell: Marine-Fläche wie das Signet, Felder weiß bzw. 32 % weiß, Akzentfeld Marine-hell
    "AppIcon.png": {
        "grund": (0x1C, 0x3F, 0x7A, 255),
        "voll": (255, 255, 255, 255),
        "matt": (255, 255, 255, round(255 * 0.32)),
        "akzent": (0x8F, 0xB4, 0xEA, 255),
        "modus": "RGB",
    },
    # dunkel (ab iOS 18): durchsichtiger Grund, Felder in hellen Marinetönen
    "AppIcon-Dark.png": {
        "grund": None,
        "voll": (0xDC, 0xE6, 0xF6, 255),
        "matt": (0x86, 0xA7, 0xDC, round(255 * 0.45)),
        "akzent": (0x6F, 0x9B, 0xE0, 255),
        "modus": "RGBA",
    },
    # getönt (ab iOS 18): Graustufen auf durchsichtigem Grund, das System färbt ein
    "AppIcon-Tinted.png": {
        "grund": None,
        "voll": (255, 255, 255, 255),
        "matt": (255, 255, 255, round(255 * 0.35)),
        "akzent": (0xBD, 0xBD, 0xBD, 255),
        "modus": "LA",
    },
}


def zeichnen(farben):
    n = GROESSE * UEBERABTASTUNG
    s = n / RASTER
    bild = Image.new("RGBA", (n, n), farben["grund"] or (0, 0, 0, 0))
    for x, y, b, h, rolle in FELDER:
        ebene = Image.new("RGBA", (n, n), (0, 0, 0, 0))
        ImageDraw.Draw(ebene).rounded_rectangle(
            [x * s, y * s, (x + b) * s - 1, (y + h) * s - 1], radius=FELD_RADIUS * s, fill=farben[rolle])
        bild = Image.alpha_composite(bild, ebene)
    return bild.resize((GROESSE, GROESSE), Image.LANCZOS)


def maske(n):
    """iOS-ähnliche Eckmaske nur für die Vorschau."""
    m = Image.new("L", (n * 4, n * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, n * 4 - 1, n * 4 - 1], radius=int(n * 4 * 0.2237), fill=255)
    return m.resize((n, n), Image.LANCZOS)


def main():
    os.makedirs(AUSGABE, exist_ok=True)
    fertig = {}
    for name, farben in VARIANTEN.items():
        bild = zeichnen(farben)
        fertig[name] = bild
        bild.convert(farben["modus"]).save(os.path.join(AUSGABE, name), optimize=True)
        print("geschrieben:", os.path.join(AUSGABE, name))

    if VORSCHAU:
        n, rand = 300, 40
        v = Image.new("RGB", (rand + 3 * (n + rand), n + 2 * rand), (0xF4, 0xF6, 0xF8))
        hell = fertig["AppIcon.png"].resize((n, n), Image.LANCZOS)
        dunkel = Image.new("RGBA", (n, n), (0x1C, 0x1C, 0x1E, 255))
        dunkel.alpha_composite(fertig["AppIcon-Dark.png"].resize((n, n), Image.LANCZOS))
        getoent = Image.new("RGBA", (n, n), (0x14, 0x14, 0x16, 255))
        getoent.alpha_composite(fertig["AppIcon-Tinted.png"].resize((n, n), Image.LANCZOS))
        for i, b in enumerate([hell, dunkel, getoent]):
            v.paste(b.convert("RGB"), (rand + i * (n + rand), rand), maske(n))
        v.save(VORSCHAU)
        print("Vorschau:", VORSCHAU)


if __name__ == "__main__":
    main()
