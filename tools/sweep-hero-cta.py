#!/usr/bin/env python3
"""sweep-hero-cta.py — the article hero call-to-action and category badge onto the one accent.

The contact sheet of wave 3.24.43 (2026-11-04) showed the "Try the … Calculator" button on the
journal hero as a 30px-radius pill with a two-stop gradient (orange, or green/teal on article-17)
and an infinite `pulse-glow` box-shadow animation, and the category badge above the title in a
second hue (green on article-17). ANTI_VIBECODE_STANDARD §A: gradient button, glow, animated CTA,
one accent. Rule: per page, one marked override block at the end of the page's first <style>:
flat amber per theme (#92400e day / #E8B563 night, on-accent text), 4px radius, no shadow, no
animation (stripped from the source rule, keyframes removed); the listed badge becomes amber text
on a hairline. Idempotent (the marker).

  python3 tools/sweep-hero-cta.py [--apply | --check]
"""
import re
import sys
from pathlib import Path

ROOT = Path.cwd()
MARK = "/* sweep-hero-cta: one accent, flat, no glow */"
PAGES = {  # page -> hero badge class to neutralise ("" = none)
    "article-14.html": "rebellion-badge",
    "article-16.html": "bubble-badge",
    "article-17.html": "opp-badge",
    "article-18.html": "",
}


def block(badge: str) -> str:
    b = ""
    if badge:
        b = (f"        :root:not([data-theme=\"dark\"]) .{badge}{{background:transparent!important;border:1px solid rgba(146,64,14,.35)!important;color:#92400e!important}}\n"
             f"        [data-theme=\"dark\"] .{badge}{{background:transparent!important;border:1px solid rgba(232,181,99,.35)!important;color:#E8B563!important}}\n")
    return (f"\n        {MARK}\n"
            "        .jump-to-calc,.jump-to-calc:hover{animation:none!important;box-shadow:none!important;border-radius:4px!important}\n"
            "        :root:not([data-theme=\"dark\"]) .jump-to-calc{background:#92400e!important;color:#fff!important}\n"
            "        [data-theme=\"dark\"] .jump-to-calc{background:#E8B563!important;color:#121316!important}\n"
            "        .jump-to-calc:hover{filter:brightness(1.06)}\n" + b + "    ")


GLOW = re.compile(r"\n\s*animation:\s*pulse-glow[^;]*infinite;")
GLOW_KF = re.compile(r"\n\s*@keyframes pulse-glow\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}")


def main() -> None:
    apply, check = "--apply" in sys.argv, "--check" in sys.argv
    todo = []
    for name, badge in PAGES.items():
        path = ROOT / name
        text = path.read_text(encoding="utf-8")
        # the source rule itself loses the infinite glow (an override alone left the tell in the
        # source, which audit-vibecode animated-cta reads) and its now-unused keyframes go
        new = GLOW_KF.sub("", GLOW.sub("", text))
        if MARK not in new:
            i = new.lower().find("</style>")
            new = new[:i] + block(badge) + new[i:]
        if new == text:
            continue
        todo.append(name)
        if apply:
            path.write_text(new, encoding="utf-8")
    for n in todo:
        print(f"  {n}")
    print(f"HERO CTA — {'applied' if apply else ('FAIL' if todo else 'PASS')}: {len(todo)} page(s)")
    if check and todo:
        sys.exit(1)


if __name__ == "__main__":
    main()
