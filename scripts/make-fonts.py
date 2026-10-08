#!/usr/bin/env python3
"""Subset the system fonts used by Loopwise into small self-hosted .woff files.

Fonts (all open licences, safe to self-host):
  Inter / Inter Display  - SIL OFL 1.1
  Caladea                - Apache 2.0
  DejaVu Sans Mono       - Bitstream Vera / DejaVu licence

Run once: python3 scripts/make-fonts.py
The generated files are committed to static/fonts so deploys don't need this.
"""
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

OUT = Path(__file__).resolve().parent.parent / "static" / "fonts"
OUT.mkdir(parents=True, exist_ok=True)

SOURCES = {
    "display-800": "/usr/share/fonts/opentype/inter/InterDisplay-ExtraBold.otf",
    "display-600": "/usr/share/fonts/opentype/inter/InterDisplay-SemiBold.otf",
    "ui-400": "/usr/share/fonts/opentype/inter/Inter-Regular.otf",
    "ui-600": "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf",
    "serif-400": "/usr/share/fonts/truetype/crosextra/Caladea-Regular.ttf",
    "serif-400i": "/usr/share/fonts/truetype/crosextra/Caladea-Italic.ttf",
    "serif-700": "/usr/share/fonts/truetype/crosextra/Caladea-Bold.ttf",
    "mono-400": "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
}

UNICODES = (
    list(range(0x20, 0x7F))
    + list(range(0xA0, 0x100))
    + list(range(0x2010, 0x2028))
    + [0x2030, 0x2039, 0x203A, 0x20AC, 0x2122, 0x2190, 0x2191, 0x2192, 0x2193, 0x2212, 0x2260, 0x2264, 0x2265, 0x2713, 0x2715]
)

for name, src in SOURCES.items():
    opts = subset.Options()
    opts.flavor = "woff"
    opts.layout_features = ["kern", "liga", "calt", "tnum", "case", "ccmp", "locl", "mark", "mkmk"]
    opts.name_IDs = [1, 2, 4, 6]
    opts.notdef_outline = True
    opts.hinting = False
    opts.desubroutinize = True
    font = TTFont(src)
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=UNICODES)
    sub.subset(font)
    dest = OUT / f"{name}.woff"
    font.flavor = "woff"
    font.save(dest)
    print(f"{dest.name:18} {dest.stat().st_size/1024:6.1f} KB")
