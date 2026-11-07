#!/usr/bin/env python3
"""sweep-cta-accent.py — call-to-action and button chrome onto the one accent.

A static census (2026-11-05) of <style> rules whose selector names a button, btn or cta found a
second hue on chrome on 14 pages: a pink CTA block and button (article-15), red mode/primary/PDF
buttons (article-2/6/7), green calculator and CTA buttons (article-3/12/17), blue mode buttons and
CTA cards (article-4, pln-java-grid), a mint return button (404), and tinted CTA blocks (FF-2,
article-8, geopolitics-3, dc-market-tracker). ANTI_VIBECODE §A: one accent.

Rule, inside <style> blocks of the listed pages, on rules whose last selector names btn|button|cta
and does NOT name a state or category (bar, legend, scale, chip, tag, level, grade, rating, risk,
severity, status, side, option, danger, share, li-btn, fb-btn, x-btn, scenario — a named
scenario button carries its scenario colour):
  a colour literal with s >= .5, L .28–.68 and hue outside the amber band (18–55°) becomes
    * an opaque fill/colour            -> var(--rz-accent-ui)
    * a tint (alpha < .6)              -> rgba(232,181,99,<alpha>)
  and white text on a rule that now fills with the accent becomes var(--rz-on-accent-ui).
The per-theme tokens (#92400e day / #E8B563 night) are injected once per page unless the cyan
sweep already put them there. Kept on purpose: cockpit state buttons (instrument register),
brand share buttons, destructive-action red.

  python3 tools/sweep-cta-accent.py [--list | --apply | --check]
"""
import colorsys
import re
import sys
from pathlib import Path

ROOT = Path.cwd()
PAGES = ["article-15.html", "article-2.html", "article-3.html", "article-17.html", "article-12.html",
         "article-4.html", "pln-java-grid.html", "article-6.html", "article-7.html", "404.html",
         "FF-2.html", "article-8.html", "geopolitics-3.html", "dc-market-tracker.html"]
CHROME = re.compile(r"(btn|button|cta)\b", re.I)
KEEP = re.compile(r"bar|legend|scale|chip|tag|level|grade|rating|risk|severity|status|side|option|"
                  r"danger|share|li-btn|fb-btn|x-btn|scenario", re.I)
CYAN_MARK = "/* sweep-cyan-register: the page accent, per theme */"
MARK = "/* sweep-cta-accent: the page accent, per theme */"
TOKENS = (f"\n{MARK}\n:root:not([data-theme=\"dark\"]){{--rz-accent-ui:#92400e;--rz-on-accent-ui:#ffffff}}\n"
          "[data-theme=\"dark\"]{--rz-accent-ui:#E8B563;--rz-on-accent-ui:#121316}\n"
          ":root:not([data-theme=\"dark\"]) [data-rz-dark-panel]{--rz-accent-ui:#E8B563;--rz-on-accent-ui:#121316}\n")
TOKEN = re.compile(r"#(?P<h6>[0-9a-fA-F]{6})\b|#(?P<h3>[0-9a-fA-F]{3})\b"
                   r"|rgba?\(\s*(?P<r>\d+)\s*,\s*(?P<g>\d+)\s*,\s*(?P<b>\d+)\s*(?:,\s*(?P<a>[\d.]+)\s*)?\)")


def off_hue(rgb) -> bool:
    h, l, s = colorsys.rgb_to_hls(*(c / 255 for c in rgb))
    return s >= 0.5 and 0.28 <= l <= 0.68 and not (18 <= h * 360 <= 55)


def recolour(m: re.Match) -> tuple[str, int]:
    if m.group("h6") or m.group("h3"):
        h = m.group("h6") or "".join(c * 2 for c in m.group("h3"))
        return ("var(--rz-accent-ui)", 1) if off_hue(tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))) else (m.group(0), 0)
    if not off_hue(tuple(int(m.group(k)) for k in "rgb")):
        return m.group(0), 0
    a = m.group("a")
    if a is not None and float(a) < 0.6:
        return f"rgba(232,181,99,{a})", 1
    return "var(--rz-accent-ui)", 1


def sweep(text: str, listing: list[str]) -> tuple[str, int]:
    total = 0

    def rule(r: re.Match) -> str:
        nonlocal total
        sel, body = r.group(1), r.group(2)
        head = sel.strip().split("\n")[-1].strip()
        if not CHROME.search(head) or KEEP.search(head):
            return r.group(0)
        n = 0

        def sub(m: re.Match) -> str:
            nonlocal n
            out, k = recolour(m)
            n += k
            return out
        body2 = TOKEN.sub(sub, body)
        if n and re.search(r"background(?:-color|-image)?\s*:[^;]*var\(--rz-accent-ui\)", body2):
            body2 = re.sub(r"(?<![-\w])color:\s*(#fff\b|#ffffff\b|white\b|var\(--white\))", "color: var(--rz-on-accent-ui)", body2, flags=re.I)
        if n:
            total += n
            listing.append(head[-60:])
        return sel + "{" + body2 + "}"

    text = re.sub(r"(<style[^>]*>)(.*?)(</style>)",
                  lambda b: b.group(1) + re.sub(r"([^{}]+)\{([^{}]*)\}", rule, b.group(2)) + b.group(3),
                  text, flags=re.S | re.I)
    if total and MARK not in text and CYAN_MARK not in text:
        i = text.lower().find("</style>")
        text = text[:i] + TOKENS + text[i:]
    return text, total


def main() -> None:
    apply, check, show = "--apply" in sys.argv, "--check" in sys.argv, "--list" in sys.argv
    total = 0
    for name in PAGES:
        path = ROOT / name
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
    print(f"CTA ACCENT — {'applied' if apply else ('FAIL' if total else 'PASS')}: {total} off-accent literal(s)")
    if check and total:
        sys.exit(1)


if __name__ == "__main__":
    main()
