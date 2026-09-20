#!/usr/bin/env python3
"""
sweep-framework-swatches.py — retire the default framework tints that the v3.6.0 sweep could not reach.

WHY. §A15 bans the default framework palette and §A10 bans the filled tint pill; v3.6.0 cleared 50
files of `#dcfce7 #dbeafe #f0fdf4 #ecfdf5 #fff7ed #fef3c7 #86efac #6ee7b7 #fdba74 #fcd34d` — but only
where they lived in a stylesheet rule the sweep looked at. 210 of them survived inside page-level
<style> blocks and inline attributes across 45 pages, including article-27, the page the owner was
looking at when he said "masih banyak ai design slop lihat itu kotak highlight biru, orange dll".

WHAT IT DOES. Each banned swatch becomes a low-alpha tint of the SAME semantic in the site's own
token — green stays green, amber stays amber — so a severity ramp keeps its meaning and only the
framework default disappears. An alpha tint also fixes the pill in DARK mode, where a fixed light
hex was a bright box on a dark ground.

Usage: python3 tools/sweep-framework-swatches.py [--apply] [--only FILE]
"""
import argparse
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# banned swatch -> (background tint, border tint) in the site's own semantic token
GREEN, AMBER, ORANGE, RED, CYAN, SLATE = (
    "16, 185, 129", "245, 158, 11", "249, 115, 22", "220, 38, 38", "6, 182, 212", "100, 116, 139",
)
MAP = {
    "dcfce7": (GREEN, 0.10), "ecfdf5": (GREEN, 0.10), "f0fdf4": (GREEN, 0.08),
    "86efac": (GREEN, 0.28), "6ee7b7": (GREEN, 0.28),
    "fef3c7": (AMBER, 0.12), "fcd34d": (AMBER, 0.30),
    "fff7ed": (ORANGE, 0.08), "fdba74": (ORANGE, 0.26),
    "fee2e2": (RED, 0.10),
    "dbeafe": (CYAN, 0.10), "e0e7ff": (CYAN, 0.10),
    "fce7f3": (SLATE, 0.12), "ede9fe": (SLATE, 0.12),
}
# v3.9.9 — the first pass only matched a hex that sat immediately after the property, so every
# swatch inside a gradient stop survived it ("background: linear-gradient(135deg, #fffbeb 0%,
# #fef3c7 100%)"). Match the whole declaration and rewrite EVERY banned stop inside it.
DECL = re.compile(
    r"(background(?:-color|-image)?|border(?:-color|-top|-bottom|-left|-right)?)\s*:\s*([^;\"'}]*)",
    re.I,
)
HEX = re.compile(r"#([0-9a-fA-F]{6})\b")


def sweep(text: str) -> tuple[str, Counter]:
    hits = Counter()

    def repl(match):
        prop, value = match.group(1), match.group(2)
        border = prop.lower().startswith("border")

        def swap(hex_match):
            hexv = hex_match.group(1).lower()
            if hexv not in MAP:
                return hex_match.group(0)
            rgb, alpha = MAP[hexv]
            # a border carries the same hue a shade stronger, the way the editorial hairline does
            a = alpha + 0.18 if border else alpha
            hits[hexv] += 1
            return f"rgba({rgb}, {a:.2f})"

        swapped = HEX.sub(swap, value)
        if swapped == value:
            # v3.9.9 — leave a declaration that carries no banned swatch EXACTLY as it was. The
            # first cut rebuilt every background/border it matched, which rewrote whitespace in
            # 52 lines of js/rz-inspector.js to change one colour: churn that hides the real edit.
            return match.group(0)
        return f"{prop}:{'' if value.startswith(' ') else ' '}{swapped}"

    return DECL.sub(repl, text), hits


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--only")
    args = ap.parse_args()

    if args.only:
        files = [ROOT / args.only]
    else:
        # v3.9.9 — not only root HTML: the last three offenders were a stylesheet and two modules
        # that author CSS as a JS string, which is exactly where a sweep scoped to .html files
        # cannot look.
        files = sorted(ROOT.glob("*.html")) + sorted(ROOT.glob("*.css")) + sorted(ROOT.glob("js/*.js")) + sorted(ROOT.glob("css/*.css"))
    total = Counter()
    touched = 0
    for path in files:
        text = path.read_text(encoding="utf-8", errors="ignore")
        swept, hits = sweep(text)
        if not hits:
            continue
        touched += 1
        total.update(hits)
        print(f"  {sum(hits.values()):4}  {path.name}")
        if args.apply:
            path.write_text(swept, encoding="utf-8")
    print(f"\n{sum(total.values())} swatch(es) on {touched} page(s){'' if args.apply else '  (dry run — pass --apply)'}")
    for hexv, n in total.most_common():
        print(f"  {n:4}  #{hexv}")


if __name__ == "__main__":
    main()
