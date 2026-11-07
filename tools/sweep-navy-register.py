#!/usr/bin/env python3
"""sweep-navy-register.py — WI-WEB-ALLPAGES-001 AC3: the navy cast off every in-scope page.

The owner withdrew the navy surface (2026-10-15: "warna backgroundnya masih ai design slop").
tools/audit-render-register.mjs counts it in the render; this rewrites its source.

Rule: a colour literal in the navy band — hue 205–240°, saturation ≥ .25, lightness ≤ .30, the
same band the render gate matches — becomes the graphite of the SAME lightness (hue 225°,
saturation capped at .12, alpha kept). Keeping lightness keeps every contrast relationship the
page already has; only the blue cast goes. Hue-band, never a hex list (memory: a string ban left
1,238 same-hue literals live).

Scope: <style> blocks and style="" attributes of the sitemap pages in scope, plus styles.css.
JS is touched only where named (JS_FILES, INLINE_SCRIPT_PAGES) after reading each hit: a chart
series may live in JS, so it is never swept by default. Out of scope as in the render gate:
index.html, changelog.html, the paper, design artefacts, LTC-owned pages.

  python3 tools/sweep-navy-register.py            dry run, counts per file
  python3 tools/sweep-navy-register.py --apply    rewrite
  python3 tools/sweep-navy-register.py --check    exit 1 if anything would change
"""
import colorsys
import re
import sys
from pathlib import Path

ROOT = Path.cwd()
OUT_OF_SCOPE = re.compile(
    r"^index\.html$|^changelog\.html$|^article-9-paper\.html$|(^|/)(rz-|plan-|planb)"
    r"|(^|/)ltc-|^(capex|opex|tco|roi|pue)-calculator\.html$"
    r"|^(carbon-footprint|cx-calculator|spares-readiness-calculator|tier-advisor|tia-942-checklist"
    r"|fire-calculator|fire-checklist|rfs-readiness-workbench|pillar-fire-safety|standards-ltc-lab)\.html$"
    r"|^manual/(pillar-fire-safety|standards-ltc-lab|ltc-system-modelling-lab)\.html$")
EXTRA = ["styles.css", "css/rz-cockpit-instrument.css"]
# Chrome drawn from JS (tooltip / legend / chart-tooltip surfaces, the neutral "spare slot" fill).
# Named one by one after reading each hit; a JS series colour is never swept by default.
JS_FILES = ["js/pln-energy-dashboard.js", "js/pln-tooltip.js"]
INLINE_SCRIPT_PAGES = re.compile(r"^(datahall|dc-market-tracker|pln-java-grid(-[a-z-]+)?)\.html$")

TOKEN = re.compile(r"#(?P<h6>[0-9a-fA-F]{6})\b|#(?P<h3>[0-9a-fA-F]{3})\b"
                   r"|rgba?\(\s*(?P<r>\d+)\s*,\s*(?P<g>\d+)\s*,\s*(?P<b>\d+)\s*(?P<a>,\s*[\d.]+\s*)?\)")


def is_navy(rgb):
    h, l, s = colorsys.rgb_to_hls(*(c / 255 for c in rgb))
    return 205 <= h * 360 <= 240 and s >= 0.25 and l <= 0.30


def graphite(rgb):
    _, l, s = colorsys.rgb_to_hls(*(c / 255 for c in rgb))
    r, g, b = colorsys.hls_to_rgb(225 / 360, l, min(s, 0.12))
    return tuple(round(c * 255) for c in (r, g, b))


def recolour(m):
    if m.group("h6") or m.group("h3"):
        h = m.group("h6") or "".join(c * 2 for c in m.group("h3"))
        rgb = tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
        if not is_navy(rgb):
            return m.group(0), 0
        return "#%02X%02X%02X" % graphite(rgb), 1
    rgb = tuple(int(m.group(k)) for k in "rgb")
    if not is_navy(rgb):
        return m.group(0), 0
    r, g, b = graphite(rgb)
    a = m.group("a")
    return (f"rgba({r},{g},{b}{a.replace(' ', '')})" if a else f"rgb({r},{g},{b})"), 1


def sweep_css(text):
    n = 0
    def sub(m):
        nonlocal n
        out, k = recolour(m)
        n += k
        return out
    return TOKEN.sub(sub, text), n


def sweep_html(text, scripts=False):
    total = 0
    def block(m):
        nonlocal total
        body, n = sweep_css(m.group(2))
        total += n
        return m.group(1) + body + m.group(3)
    text = re.sub(r"(<style[^>]*>)(.*?)(</style>)", block, text, flags=re.S | re.I)
    text = re.sub(r'(\sstyle=")([^"]*)(")', block, text)
    if scripts:
        text = re.sub(r"(<script(?![^>]*(?:src=|ld\+json))[^>]*>)(.*?)(</script>)", block, text, flags=re.S | re.I)
    return text, total


def population():
    raw = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    pages = set()
    for loc in re.findall(r"<loc>([^<]+)</loc>", raw):
        p = re.sub(r"^https?://[^/]+/?", "", loc.strip())
        p = "index.html" if p == "" else (p + "index.html" if p.endswith("/") else p)
        if p.endswith(".html") and (ROOT / p).exists() and not OUT_OF_SCOPE.search(p):
            pages.add(p)
    return sorted(pages) + EXTRA + JS_FILES


def main():
    apply, check = "--apply" in sys.argv, "--check" in sys.argv
    total = 0
    for rel in population():
        path = ROOT / rel
        text = path.read_text(encoding="utf-8")
        if rel.endswith((".css", ".js")):
            new, n = sweep_css(text)
        else:
            new, n = sweep_html(text, scripts=bool(INLINE_SCRIPT_PAGES.match(rel)))
        if n:
            total += n
            print(f"  {n:4d}  {rel}")
            if apply:
                path.write_text(new, encoding="utf-8")
    verdict = "applied" if apply else ("FAIL" if total else "PASS")
    print(f"NAVY REGISTER — {verdict}: {total} navy literal(s) {'rewritten' if apply else 'in scope'}")
    if check and total:
        sys.exit(1)


if __name__ == "__main__":
    main()
