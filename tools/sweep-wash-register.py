#!/usr/bin/env python3
"""sweep-wash-register.py — coloured gradient washes off heroes, calculator panels and CTAs.

The contact sheet of wave 3.24.43 (2026-11-04) and the `wash` detector of
tools/audit-render-register.mjs (RED: 161 on 27 pages) found bands painted by a gradient with a
dark chromatic stop — green calculator panels (#022c22→#064e3b), teal/green/red/blue PLN and
infographic heroes, a blue category header, amber→cyan CTA buttons. They are dark in BOTH themes
and carry white text, so the fix keeps them dark and drops the hue: graphite is the register.

Rule, inside <style> blocks and style="" attributes of the listed pages: a linear-/radial-gradient
whose colour stops include a wash colour (alpha ≥ .3, s ≥ .35, L .08–.45, hue outside the amber
accent 20–55°) is replaced by
  * a CTA/button selector (btn|cta|button)  → flat accent #92400e (white text reads 7:1 on it);
  * a radial glow layer                     → linear-gradient(transparent,transparent);
  * anything else                           → flat graphite rgba(22,24,29,A), A = the strongest
                                              stop alpha, so an image under it stays covered.
A selector matching DATA (bars, gauges, fills, legends, scales) is a data encoding and is left alone;
only selectors in SCOPE are touched (inline style="" only on a/button/CTA/strategy cards), so a
categorical bar or legend swatch drawn inline is never recoloured.

  python3 tools/sweep-wash-register.py [--list | --apply | --check]
"""
import colorsys
import re
import sys
from pathlib import Path

ROOT = Path.cwd()
PAGES = [
    "article-15.html", "article-12.html", "asean-dc-report-2026.html", "article-17.html",
    "geopolitics-1.html", "pln-java-grid-jatim.html", "article-24.html", "infographic-pue-global.html",
    "pln-java-grid-jabar.html", "pln-java-grid-jakarta-banten.html", "pln-java-grid.html", "FF-3.html",
    "article-6.html", "dc-market-tracker.html", "infographic-dc-sustainability.html", "FF-2.html",
    "achievements.html", "article-10.html", "article-2.html", "article-20.html", "article-21.html",
    "article-22.html", "article-5.html", "article-7.html", "geopolitics-3.html",
    "pln-java-grid-jateng.html", "pln-java-grid-historical.html",
]
DATA = re.compile(r"bar|gauge|fill|legend|scale|meter|track|progress|heat|spark|chart|slider", re.I)
CTA = re.compile(r"btn|cta|button", re.I)
# only bands and actions: heroes, calculator panels, CTA/buttons, category header bands, strategy cards
SCOPE = re.compile(r"hero|calculator|btn|cta|button|category-header|ds-strat|operator-story|:root", re.I)
GRAD = re.compile(r"(?:repeating-)?(linear|radial)-gradient\(")
COLOUR = re.compile(r"#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b|rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)")


def gradients(text: str):
    """Yield (start, end, kind) of each gradient function, parentheses balanced."""
    for m in GRAD.finditer(text):
        depth, i = 1, m.end()
        while i < len(text) and depth:
            depth += {"(": 1, ")": -1}.get(text[i], 0)
            i += 1
        yield m.start(), i, m.group(1)


def stops(g: str):
    for m in COLOUR.finditer(g):
        if m.group(1):
            h = m.group(1) if len(m.group(1)) == 6 else "".join(c * 2 for c in m.group(1))
            yield tuple(int(h[k:k + 2], 16) for k in (0, 2, 4)), 1.0
        else:
            yield (int(m.group(2)), int(m.group(3)), int(m.group(4))), float(m.group(5)) if m.group(5) else 1.0


def is_wash(rgb, a) -> bool:
    h, l, s = colorsys.rgb_to_hls(*(c / 255 for c in rgb))
    return a >= 0.3 and s >= 0.35 and 0.08 <= l <= 0.45 and not (20 <= h * 360 <= 55)


def fix_value(sel: str, value: str) -> tuple[str, int]:
    out, last, n = [], 0, 0
    for s, e, kind in list(gradients(value)):
        g = value[s:e]
        st = list(stops(g))
        if not any(is_wash(c, a) for c, a in st):
            continue
        if CTA.search(sel):
            rep = "linear-gradient(#92400e,#92400e)"
        elif kind == "radial":
            rep = "linear-gradient(transparent,transparent)"
        else:
            a = max(a for _, a in st)
            rep = f"linear-gradient(rgba(22,24,29,{a:g}),rgba(22,24,29,{a:g}))"
        out.append(value[last:s] + rep)
        last, n = e, n + 1
    return ("".join(out) + value[last:], n) if n else (value, 0)


def sweep(text: str, listing: list[str]) -> tuple[str, int]:
    total = 0

    def rule(r: re.Match) -> str:
        nonlocal total
        sel, body = r.group(1), r.group(2)
        head = sel.strip().split("\n")[-1]
        if DATA.search(head) or not SCOPE.search(head):
            return r.group(0)

        def decl(d: re.Match) -> str:
            nonlocal total
            v, k = fix_value(sel, d.group(2))
            if k:
                total += k
                listing.append(sel.strip().split("\n")[-1][-60:])
            return d.group(1) + v
        return sel + "{" + re.sub(r"(background(?:-image)?\s*:|--[\w-]*gradient\s*:)([^;}]*)", decl, body) + "}"

    def block(b: re.Match) -> str:
        return b.group(1) + re.sub(r"([^{}]+)\{([^{}]*)\}", rule, b.group(2)) + b.group(3)

    text = re.sub(r"(<style[^>]*>)(.*?)(</style>)", block, text, flags=re.S | re.I)

    def attr(m: re.Match) -> str:  # style="" on an element: the class names stand in for the selector
        nonlocal total
        cls = re.search(r'class="([^"]*)"', m.group(0))
        sel = "." + cls.group(1).replace(" ", ".") if cls else m.group(1)
        if DATA.search(sel) or not (m.group(1) in ("a", "button") or SCOPE.search(sel)):
            return m.group(0)
        v, k = fix_value(sel, m.group(3))
        if k:
            total += k
            listing.append(f"<{m.group(1)} style> {sel[:50]}")
            return m.group(0).replace(m.group(3), v, 1)
        return m.group(0)
    text = re.sub(r'<(\w+)\b[^>]*?\bstyle="([^"]*?)?([^"]*gradient[^"]*)"[^>]*>', attr, text)
    return text, total


def main() -> None:
    apply, check, show = "--apply" in sys.argv, "--check" in sys.argv, "--list" in sys.argv
    total = 0
    for name in PAGES:
        path = ROOT / name
        if not path.exists():
            continue
        listing: list[str] = []
        new, n = sweep(path.read_text(encoding="utf-8"), listing)
        if n:
            total += n
            print(f"  {n:4d}  {name}")
            if show:
                for s in listing:
                    print(f"          {s}")
            if apply:
                path.write_text(new, encoding="utf-8")
    print(f"WASH REGISTER — {'applied' if apply else ('FAIL' if total else 'PASS')}: {total} gradient wash(es)")
    if check and total:
        sys.exit(1)


if __name__ == "__main__":
    main()
