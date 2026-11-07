#!/usr/bin/env python3
"""sweep-cyan-register.py — instrument cyan off the chrome of reading and tool pages.

Cyan is the instrument colour of the cockpits (register "instrument": a live process value). On
reading pages and tool pages it was used as a second accent for chrome — tooltips, chips, result
values, card borders, links, table heads — next to the amber the register allows. The owner
withdrew the second hue (2026-10-15/16: "masih ada hijau neon ... slop juga"; "no second hue").

Rule: a colour literal in the cyan band (hue 180–194°, s ≥ .5, L .25–.75) inside a <style> block of
a listed page becomes the page's accent token `var(--rz-accent-ui)`; an rgba() tint keeps its alpha
on amber. The token is injected once per page, per theme (#92400e day, #E8B563 night). A rule whose
selector matches the page's KEEP regex is categorical (a scale level, an evidence class, a side of a
comparison) and is left alone — each KEEP was read off the page before it was written here.

GREEN_PAGES run the same rule on the green band (140–180°).

Out of scope: the instrument cockpits (cyan is their process colour), compare pages (cyan is a side),
LTC files, design artefacts, JS (chart series).

  python3 tools/sweep-cyan-register.py [--list | --apply | --check]
"""
import colorsys
import re
import sys
from pathlib import Path

ROOT = Path.cwd()
MARK = "/* sweep-cyan-register: the page accent, per theme */"
# a panel painted dark in both themes keeps the night accent in day mode (#92400e reads ~2.6:1 on it)
PANEL = ":root:not([data-theme=\"dark\"]) [data-rz-dark-panel]{--rz-accent-ui:#E8B563;--rz-on-accent-ui:#121316}"
TOKENS = (f"\n{MARK}\n:root:not([data-theme=\"dark\"]){{--rz-accent-ui:#92400e;--rz-on-accent-ui:#ffffff}}\n"
          "[data-theme=\"dark\"]{--rz-accent-ui:#E8B563;--rz-on-accent-ui:#121316}\n"
          + PANEL + "\n")
OLD_TOKENS_DARK = "[data-theme=\"dark\"]{--rz-accent-ui:#E8B563}"
HERO = re.compile(r"-hero\s*$")
HERO_LAYER = re.compile(r"-hero::(before|after)\s*$")
PAGES: dict[str, str] = {
    "article-15.html": r"\.(scale|rank|rev)-medium",
    "cdu-selection-guide.html": r"lstag",
    "cdu-checklist.html": r"\.src\b|\.cad\.",
    "cdu-calculator.html": r"\.kpi\.ok|\.chip\.derived",
    "cdu-hub.html": r"hub-card\[style",
    "FF-3.html": r"risk-chip\.med|iec-benchmark-tag",
    "all-in-one-dashboard.html": r"",
    "article-6.html": r"\.grade-",
    "article-10.html": r"control-icon\.",
    "article-22.html": r"\.a22-tech-card\.(pluggable|cpo)|a22-bar-fill\.cpo|a22-tornado-bar|\[style\*",
    "infographic-dc-sustainability.html": r"\.best\b|\.excellent\b|\[style\*|#scoreNum",
    "privacy.html": r"",
    "article-13.html": r"company-badge|\[style\*",
    "article-2.html": r"\.grade-|mc-stat-p50|\[style\*",
    "article-1.html": r"",
    "article-19.html": r"",
    "FF-1.html": r"",
    "article-18.html": r"",
    "article-3.html": r"\.level-\d",
    "network-visualization-hub.html": r"",
    "pln-sumatra-grid.html": r"",
    "tools.html": r"",
}
# Pages whose second accent is GREEN (hue 140–180°), same rule and tokens (contact sheet 2026-11-04:
# green title span, stat numerals, badge and TOC chips on graphite heroes). KEEP: rating classes and
# bar fills (a PUE level is categorical), the slider scale, the evidence-class reference chips.
GREEN_PAGES: dict[str, str] = {
    "asean-dc-report-2026.html": r"reference-item",
    "infographic-pue-global.html": r"\.good\b|ig-bar-fill|slider",
}
# Heroes painted graphite in BOTH themes: they are dark panels, so the night accent must hold on them
# in day mode (#92400e on #16181D reads ~2.6:1 — the numerals and title spans went brown-on-black).
DARK_HEROES: dict[str, str] = {
    "infographic-dc-sustainability.html": "ig-hero",
    "infographic-pue-global.html": "ig-hero",
    "asean-dc-report-2026.html": "rpt-hero",
}
RELOCK = "/* sweep-cyan-register: page tokens re-resolve inside dark panels */"
BAND = {"lo": 180, "hi": 195, "llo": 0.25}
TOKEN = re.compile(r"#(?P<h6>[0-9a-fA-F]{6})\b|#(?P<h3>[0-9a-fA-F]{3})\b"
                   r"|rgba?\(\s*(?P<r>\d+)\s*,\s*(?P<g>\d+)\s*,\s*(?P<b>\d+)\s*(?P<a>,\s*[\d.]+\s*)?\)")


def is_cyan(rgb: tuple[int, int, int]) -> bool:
    h, l, s = colorsys.rgb_to_hls(*(c / 255 for c in rgb))
    return BAND["lo"] <= h * 360 < BAND["hi"] and s >= 0.5 and BAND["llo"] <= l <= 0.75


def recolour(m: re.Match) -> tuple[str, int]:
    if m.group("h6") or m.group("h3"):
        h = m.group("h6") or "".join(c * 2 for c in m.group("h3"))
        if not is_cyan(tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))):
            return m.group(0), 0
        return "var(--rz-accent-ui)", 1
    if not is_cyan(tuple(int(m.group(k)) for k in "rgb")):
        return m.group(0), 0
    a = m.group("a")
    return (f"rgba(232,181,99{a.replace(' ', '')})" if a else "var(--rz-accent-ui)"), 1


def finish(sel: str, body: str) -> tuple[str, int]:
    """Second pass on rules that now carry the accent: a hero band goes flat graphite (it was a dark
    band in both themes, white text), its wash layer goes, and light text on an accent fill reads
    the on-accent token."""
    s = sel.strip()
    flat = "background: transparent; border-bottom: 1px solid rgba(128,128,128,0.18);"
    if HERO.search(s) and re.search(r"background:\s*linear-gradient\([^;]*var\(--rz-accent-ui\)", body):
        body = re.sub(r"background:\s*linear-gradient\([^;]*;", flat, body, count=1)
        return re.sub(r"(?<![-\w])color:\s*#fff\b", "color: inherit", body, count=1), 1
    # the first cut left the band dark in BOTH themes: in day mode the title took the page's dark
    # heading colour and the nav its dark links, on #16181D (cdu-selection-guide, screenshot)
    if HERO.search(s) and "background: #16181D; border-bottom: 1px solid rgba(255,255,255,0.08);" in body:
        body = body.replace("background: #16181D; border-bottom: 1px solid rgba(255,255,255,0.08);", flat)
        return re.sub(r"(?<![-\w])color:\s*#fff\b", "color: inherit", body, count=1), 1
    if HERO_LAYER.search(s) and re.search(r"background:[^;]*(rgba\(232,181,99|var\(--rz-accent-ui\))", body):
        return re.sub(r"background:[^;]*;", "background: none;", body, count=1), 1
    if (not HERO.search(s) and re.search(r"background(-color)?:[^;]*var\(--rz-accent-ui\)", body)
            and re.search(r"(?<![-\w])color:\s*(#fff\b|#ffffff|white)\s*(!important)?\s*(;|$)", body, re.I)):
        return re.sub(r"(?<![-\w])color:\s*(#fff\b|#ffffff|white)\s*(!important)?", "color: var(--rz-on-accent-ui) !important", body, count=1, flags=re.I), 1
    return body, 0


def sweep(text: str, keep: re.Pattern | None, listing: list[str]) -> tuple[str, int]:
    total = 0

    def rule(r: re.Match) -> str:
        nonlocal total
        sel, body = r.group(1), r.group(2)
        if keep and keep.search(sel):
            return r.group(0)
        n = 0

        def sub(m: re.Match) -> str:
            nonlocal n
            out, k = recolour(m)
            n += k
            return out
        body2 = TOKEN.sub(sub, body)
        body2, k = finish(sel, body2)
        n += k
        if n:
            total += n
            listing.append(sel.strip().split("\n")[-1][-70:])
        return sel + "{" + body2 + "}"

    def block(b: re.Match) -> str:
        return b.group(1) + re.sub(r"([^{}]+)\{([^{}]*)\}", rule, b.group(2)) + b.group(3)

    text = re.sub(r"(<style[^>]*>)(.*?)(</style>)", block, text, flags=re.S | re.I)
    # inside a hero that now follows the theme, white-on-band text and hairlines become neutral
    for hero in set(re.findall(r"(\.[\w-]+-hero)\s*\{[^}]*background: transparent; border-bottom: 1px solid rgba\(128,128,128,0\.18\);", text)):
        # classes used by elements inside the hero's markup (badges, chips) live on the same band
        m_el = re.search(r'<(\w+)[^>]*class="[^"]*' + re.escape(hero[1:]) + r'\b[^"]*"[^>]*>(.*?)</\1>', text, re.S)
        inner = {"." + c for c in re.findall(r'class="([\w-]+)', m_el.group(2))} if m_el else set()

        def desc(r: re.Match) -> str:
            nonlocal total
            sel, body = r.group(1), r.group(2)
            head = sel.strip().split("\n")[-1].strip()
            if not (head.startswith(hero + " ") or head.split(" ")[0].split(":")[0] in inner):
                return r.group(0)
            body2 = re.sub(r"(?<![-\w])color:\s*(rgba\(255,\s*255,\s*255,\s*[\d.]+\)|#fff\b)", "color: inherit", body)
            body2 = re.sub(r"rgba\(255,\s*255,\s*255,(\s*[\d.]+)\)", r"rgba(128,128,128,\1)", body2)
            if body2 != body:
                total += 1
                listing.append(sel.strip()[-70:])
            return sel + "{" + body2 + "}"
        text = re.sub(r"(<style[^>]*>)(.*?)(</style>)",
                      lambda b: b.group(1) + re.sub(r"([^{}]+)\{([^{}]*)\}", desc, b.group(2)) + b.group(3),
                      text, flags=re.S | re.I)
    if OLD_TOKENS_DARK in text:  # first cut had no on-accent token
        text = text.replace(":root:not([data-theme=\"dark\"]){--rz-accent-ui:#92400e}\n" + OLD_TOKENS_DARK,
                            TOKENS.split(MARK + "\n", 1)[1].rstrip("\n"))
        total += 1
    if MARK in text and PANEL not in text:
        text = text.replace("[data-theme=\"dark\"]{--rz-accent-ui:#E8B563;--rz-on-accent-ui:#121316}\n",
                            "[data-theme=\"dark\"]{--rz-accent-ui:#E8B563;--rz-on-accent-ui:#121316}\n" + PANEL + "\n", 1)
        total += 1
    if MARK in text and RELOCK not in text:
        # a page token set on :root to var(--rz-accent-ui) is resolved AT :root and inherited as a
        # value, so the panel's own --rz-accent-ui never reaches it; re-declare it on the panel
        names = sorted(set(re.findall(r"(--[\w-]+)\s*:\s*var\(--rz-accent-ui\)", text)) - {"--rz-accent-ui"})
        if names:
            rule = (RELOCK + "\n:root:not([data-theme=\"dark\"]) [data-rz-dark-panel]{"
                    + ";".join(f"{n}:var(--rz-accent-ui)" for n in names) + "}\n")
            text = text.replace(PANEL + "\n", PANEL + "\n" + rule, 1)
            total += 1
    if total and MARK not in text:
        i = text.lower().find("</style>")
        text = text[:i] + TOKENS + text[i:]
    return text, total


def mark_hero(text: str, cls: str) -> tuple[str, int]:
    m = re.search(r'<(section|div|header)\b([^>]*class="(?:[^"]*\s)?' + re.escape(cls) + r'(?=[\s"])[^"]*")', text)
    if not m or "data-rz-dark-panel" in m.group(0):
        return text, 0
    return text[:m.start()] + f"<{m.group(1)} data-rz-dark-panel" + text[m.start() + 1 + len(m.group(1)):], 1


def main() -> None:
    apply, check, show = "--apply" in sys.argv, "--check" in sys.argv, "--list" in sys.argv
    total = 0
    jobs = [(n, k, (180, 195, 0.25)) for n, k in PAGES.items()] + [(n, k, (140, 180, 0.2)) for n, k in GREEN_PAGES.items()]
    for name, keep, band in jobs:
        BAND["lo"], BAND["hi"], BAND["llo"] = band
        path = ROOT / name
        listing: list[str] = []
        new, n = sweep(path.read_text(encoding="utf-8"), re.compile(keep) if keep else None, listing)
        if name in DARK_HEROES:
            new, k = mark_hero(new, DARK_HEROES[name])
            n += k
            if k:
                listing.append(f"<{DARK_HEROES[name]}> data-rz-dark-panel")
        if n:
            total += n
            print(f"  {n:4d}  {name}")
            if show:
                for sel in listing:
                    print(f"          {sel}")
            if apply:
                path.write_text(new, encoding="utf-8")
    print(f"CYAN REGISTER — {'applied' if apply else ('FAIL' if total else 'PASS')}: {total} cyan literal(s)")
    if check and total:
        sys.exit(1)


if __name__ == "__main__":
    main()
