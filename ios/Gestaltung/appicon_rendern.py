"""App-Symbol von EduOrga für iOS rendern (hell, dunkel, getönt; je 1024 px, Xcode erzeugt die übrigen Größen).

Aufruf (im Ordner ios/):
    python3 Gestaltung/appicon_rendern.py UntPlanNext/Assets.xcassets/AppIcon.appiconset [/pfad/vorschau.png]
Benötigt nur Pillow.

Vorlage ist das Monogramm für App-Symbole design/logo/edo-monogramm-eckig.svg (64er-Raster): vollflächige Kachel in der
Primärfarbe #164C55, darauf das weiße „E“ (Pfad M18 14h28v6H24v9h14v6H24v9h22v6H18z) und das kleine helle
Petrol-Quadrat (#7FC9C9, x 41, y 29, 6 × 6) am mittleren Balken. Flächig, ohne eigene Eckrundung (iOS legt die Maske
selbst darüber), ohne Verläufe und Schatten.

Varianten (ab iOS 18):
- hell:   Petrol-Kachel, weißes E, helles Petrol-Quadrat (wie die SVG-Vorlage)
- dunkel: durchsichtiger Grund (das System legt seinen dunklen Grund darunter), E in sehr hellem Petrol, Quadrat #5FB0B5
- getönt: Graustufen auf durchsichtigem Grund, das System färbt ein (E weiß, Quadrat etwas schwächer)
"""
import os
import sys

from PIL import Image, ImageDraw

AUSGABE = sys.argv[1] if len(sys.argv) > 1 else "UntPlanNext/Assets.xcassets/AppIcon.appiconset"
VORSCHAU = sys.argv[2] if len(sys.argv) > 2 else None

GROESSE = 1024
UEBERABTASTUNG = 4          # glatte Kanten: groß zeichnen, dann verkleinern
RASTER = 64                 # Zeichenfläche von edo-monogramm-eckig.svg

# „E“ als geschlossener Linienzug (aus dem SVG-Pfad M18 14h28v6H24v9h14v6H24v9h22v6H18z)
E_PUNKTE = [(18, 14), (46, 14), (46, 20), (24, 20), (24, 29), (38, 29), (38, 35), (24, 35), (24, 44), (46, 44),
            (46, 50), (18, 50)]
# Helles Quadrat am mittleren Balken
QUADRAT = (41, 29, 47, 35)

VARIANTEN = {
    "AppIcon.png": {"grund": (0x16, 0x4C, 0x55, 255), "zeichen": (255, 255, 255, 255), "quadrat": (0x7F, 0xC9, 0xC9, 255), "modus": "RGB"},
    "AppIcon-Dark.png": {"grund": None, "zeichen": (0xEE, 0xF5, 0xF6, 255), "quadrat": (0x5F, 0xB0, 0xB5, 255), "modus": "RGBA"},
    "AppIcon-Tinted.png": {"grund": None, "zeichen": (255, 255, 255, 255), "quadrat": (255, 255, 255, 150), "modus": "LA"},
}


def maske(form):
    """Graustufenmaske einer Form (Linienzug bzw. Rechteck im 64er-Raster) in Überabtastung."""
    n = GROESSE * UEBERABTASTUNG
    s = n / RASTER
    m = Image.new("L", (n, n), 0)
    d = ImageDraw.Draw(m)
    if isinstance(form, list):
        d.polygon([(x * s, y * s) for x, y in form], fill=255)
    else:
        x1, y1, x2, y2 = form
        d.rectangle([x1 * s, y1 * s, x2 * s - 1, y2 * s - 1], fill=255)
    return m


def zeichnen(farben, e, q):
    n = GROESSE * UEBERABTASTUNG
    bild = Image.new("RGBA", (n, n), farben["grund"] or (0, 0, 0, 0))
    bild.paste(Image.new("RGBA", (n, n), farben["zeichen"]), (0, 0), e)
    quadrat = Image.new("RGBA", (n, n), farben["quadrat"])
    bild.alpha_composite(Image.composite(quadrat, Image.new("RGBA", (n, n), (0, 0, 0, 0)), q))
    return bild.resize((GROESSE, GROESSE), Image.LANCZOS)


def ecken(n):
    """iOS-ähnliche Eckmaske nur für die Vorschau."""
    m = Image.new("L", (n * 4, n * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, n * 4 - 1, n * 4 - 1], radius=int(n * 4 * 0.2237), fill=255)
    return m.resize((n, n), Image.LANCZOS)


def main():
    os.makedirs(AUSGABE, exist_ok=True)
    e = maske(E_PUNKTE)
    q = maske(QUADRAT)
    fertig = {}
    for name, farben in VARIANTEN.items():
        bild = zeichnen(farben, e, q)
        fertig[name] = bild
        bild.convert(farben["modus"]).save(os.path.join(AUSGABE, name), optimize=True)
        print("geschrieben:", os.path.join(AUSGABE, name))

    if VORSCHAU:
        n, rand = 300, 40
        v = Image.new("RGB", (rand + 3 * (n + rand), n + 2 * rand), (0xF5, 0xF7, 0xF8))
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
