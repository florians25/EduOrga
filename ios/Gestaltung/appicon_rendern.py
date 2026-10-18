"""App-Symbol von UntPlan für iOS aus dem Monogramm rendern (hell, dunkel, getönt; je 1024 px, Xcode erzeugt die übrigen
Größen).

Aufruf (im Ordner ios/):
    python3 Gestaltung/appicon_rendern.py UntPlanMobile/Assets.xcassets/AppIcon.appiconset [/pfad/vorschau.png]
Benötigt nur Pillow.

Geometrie wie design/logo/monogramm.svg (64er-Raster): weißes „U“ mit 6er-Strich auf Marine-900 (#11264a) – zwei
senkrechte Schenkel bei x = 18 und x = 46 von y = 14 bis y = 36, unten ein Halbkreis mit Radius 14 um (32, 36). Flächig,
ohne eigene Eckrundung (iOS legt die Maske selbst darüber), ohne Verläufe und Schatten.
"""
import os
import sys

from PIL import Image, ImageDraw

AUSGABE = sys.argv[1] if len(sys.argv) > 1 else "UntPlanMobile/Assets.xcassets/AppIcon.appiconset"
VORSCHAU = sys.argv[2] if len(sys.argv) > 2 else None

GROESSE = 1024
UEBERABTASTUNG = 4          # glatte Kanten: groß zeichnen, dann verkleinern
RASTER = 64                 # Zeichenfläche von monogramm.svg
STRICH = 6

VARIANTEN = {
    # hell: Marine-900 mit weißem U
    "AppIcon.png": {"grund": (0x11, 0x26, 0x4A, 255), "zeichen": (255, 255, 255, 255), "modus": "RGB"},
    # dunkel (ab iOS 18): durchsichtiger Grund, U in hellem Marine
    "AppIcon-Dark.png": {"grund": None, "zeichen": (0xDC, 0xE6, 0xF6, 255), "modus": "RGBA"},
    # getönt (ab iOS 18): weißes U auf durchsichtigem Grund, das System färbt ein
    "AppIcon-Tinted.png": {"grund": None, "zeichen": (255, 255, 255, 255), "modus": "LA"},
}


def maske_u():
    """Das U als Graustufenmaske in Überabtastung."""
    n = GROESSE * UEBERABTASTUNG
    s = n / RASTER
    m = Image.new("L", (n, n), 0)
    d = ImageDraw.Draw(m)
    h = STRICH / 2
    # Schenkel (flache Enden oben wie im SVG)
    for x in (18, 46):
        d.rectangle([(x - h) * s, 14 * s, (x + h) * s, 36 * s], fill=255)
    # Bogen unten: Kreisring um (32, 36), Radius 14 ± 3, untere Hälfte
    aussen, innen = (14 + h) * s, (14 - h) * s
    cx, cy = 32 * s, 36 * s
    d.pieslice([cx - aussen, cy - aussen, cx + aussen, cy + aussen], 0, 180, fill=255)
    d.pieslice([cx - innen, cy - innen, cx + innen, cy + innen], 0, 180, fill=0)
    return m


def zeichnen(farben, maske):
    n = GROESSE * UEBERABTASTUNG
    bild = Image.new("RGBA", (n, n), farben["grund"] or (0, 0, 0, 0))
    ebene = Image.new("RGBA", (n, n), farben["zeichen"])
    bild.paste(ebene, (0, 0), maske)
    return bild.resize((GROESSE, GROESSE), Image.LANCZOS)


def ecken(n):
    """iOS-ähnliche Eckmaske nur für die Vorschau."""
    m = Image.new("L", (n * 4, n * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, n * 4 - 1, n * 4 - 1], radius=int(n * 4 * 0.2237), fill=255)
    return m.resize((n, n), Image.LANCZOS)


def main():
    os.makedirs(AUSGABE, exist_ok=True)
    maske = maske_u()
    fertig = {}
    for name, farben in VARIANTEN.items():
        bild = zeichnen(farben, maske)
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
            v.paste(b.convert("RGB"), (rand + i * (n + rand), rand), ecken(n))
        v.save(VORSCHAU)
        print("Vorschau:", VORSCHAU)


if __name__ == "__main__":
    main()
