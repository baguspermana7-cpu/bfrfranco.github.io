#!/usr/bin/env python3
"""Build the footer wordmark "ResistanceZero" as outlined glyph paths (R079, owner 2026-11-07).

IBM Plex Sans (OFL) variable font instanced at wght 700 / wdth 75 (= Plex Sans Condensed Bold), each glyph drawn
to an SVG path, advance widths and kerning-free spacing from the font. The result needs no font at runtime: it
scales to any width with no layout shift. Writes assets/logos/rz-wordmark.svg (fill #ece8e1: the footer is dark in both themes).

  ~/.venvs/pdfkit/bin/python tools/build-wordmark.py [--font PATH] [--check]
--check exits 1 when the committed file differs from a fresh build (freshness gate).
"""
import argparse
import sys
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets/logos/rz-wordmark.svg'
TEXT = 'ResistanceZero'


def build(font_path: str) -> str:
    font = instantiateVariableFont(TTFont(font_path), {'wght': 700, 'wdth': 75})
    cmap, glyphs, hmtx = font.getBestCmap(), font.getGlyphSet(), font['hmtx']
    asc = font['hhea'].ascent
    x, parts = 0, []
    for ch in TEXT:
        name = cmap[ord(ch)]
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(TransformPen(pen, (1, 0, 0, -1, x, asc)))  # font y-up to svg y-down
        parts.append(pen.getCommands())
        x += hmtx[name][0]
    cap = font['OS/2'].sCapHeight
    top = asc - cap - 8  # crop to the cap line: no empty band above the letters
    height = cap + 8  # baseline at the bottom edge; the footer crops a sliver below it
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 %d %d %d" fill="#ece8e1" role="img" '
            'aria-label="ResistanceZero"><path d="%s"/></svg>\n') % (top, x, height, ' '.join(parts))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--font', default=str(Path.home() / '.local/share/fonts/rz/IBMPlexSans.ttf'))
    ap.add_argument('--check', action='store_true')
    a = ap.parse_args()
    svg = build(a.font)
    if a.check:
        ok = OUT.exists() and OUT.read_text() == svg
        print('PASS — wordmark matches a fresh build' if ok else 'FAIL — assets/logos/rz-wordmark.svg is stale')
        return 0 if ok else 1
    OUT.write_text(svg)
    print(f'wrote {OUT.relative_to(ROOT)} ({len(svg)} bytes)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
