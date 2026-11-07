#!/usr/bin/env python3
"""sweep-pln-register.py — the PLN grid pages and the market tracker onto one accent.

Each PLN page carried its own identity hue for chrome (Java-Bali blue, Jabar green, Jatim red,
Sumatra cyan, ...) as a token family `--<prefix>-primary/-accent/-gradient`, plus a gradient logo
tile with a glow, gradient text in the hero title, a tinted Back pill and nav links each painted a
different colour inline. One accent is the register (journal R7, hub): amber, #92400e in day and
#E8B563 at night. Voltage classes (--pjg-v500 ...), map layers and data series use their own
tokens and are NOT touched.

What it does, per page (idempotent; a page already carrying the marker is not re-injected):
  1. appends, to the style block that defines --<p>-primary, a per-theme override of
     primary/accent/primary-rgb/gradient and a new --<p>-on-primary (text on the accent), plus a
     flat hairline logo and Back link;
  2. on rules that paint the accent as a background, white text becomes var(--<p>-on-primary)
     (white on #E8B563 fails contrast at night);
  3. hero gradient text becomes plain accent text;
  4. nav links lose their inline colour (they take the nav's own text colour and accent hover);
  5. the hero (dark in both themes) goes flat graphite, its glows go, and the accent inside it keeps
     its night value in day mode.
Sumatra already splits its tokens per theme; only their values change.

  python3 tools/sweep-pln-register.py [--apply | --check]
"""
import re
import sys
from pathlib import Path

ROOT = Path.cwd()
MARK = "/* sweep-pln-register: one accent, per theme */"
PAGES = sorted(p.name for p in ROOT.glob("pln-java-grid*.html")) + ["pln-sumatra-grid.html", "dc-market-tracker.html"]
NAV_INLINE = re.compile(r'(<a href="[^"]*" class="nav-link") style="color:#[0-9a-fA-F]{6};?"')


def override(p):
    return (f"\n        {MARK}\n"
            f"        :root:not([data-theme=\"dark\"]){{--{p}-primary:#92400e;--{p}-accent:#92400e;--{p}-primary-rgb:146,64,14;"
            f"--{p}-gradient:linear-gradient(#92400e,#92400e);--{p}-on-primary:#ffffff}}\n"
            f"        [data-theme=\"dark\"]{{--{p}-primary:#E8B563;--{p}-accent:#E8B563;--{p}-primary-rgb:232,181,99;"
            f"--{p}-gradient:linear-gradient(#E8B563,#E8B563);--{p}-on-primary:#121316}}\n"
            f"        .nav-logo{{background:transparent!important;border:1px solid var(--{p}-primary);color:var(--{p}-primary)!important;box-shadow:none!important;border-radius:4px!important}}\n"
            f"        .nav-back{{background:transparent!important;border:1px solid rgba(128,128,128,.3);border-radius:4px!important}}\n"
            f"        .nav-back:hover{{background:rgba(var(--{p}-primary-rgb),.1)!important}}\n    ")


def sweep(text):
    n = 0
    m = re.search(r"--([a-z]+)-primary:\s*#", text)
    prefix = m.group(1) if m else None
    if prefix == "sg":
        def themed(r):
            nonlocal n
            line = r.group(0)
            acc = "#E8B563" if r.group(1).startswith("[data-theme") else "#92400e"
            line2 = re.sub(r"--sg-(primary|accent):#[0-9a-fA-F]{6}", lambda t: f"--sg-{t.group(1)}:{acc}", line)
            n += line2 != line  # idempotent: a line already on its accent is unchanged
            return line2
        text = re.sub(r'^\s*(:root:not\(\[data-theme="dark"\]\)|\[data-theme="dark"\]) \{[^\n]*--sg-primary:[^\n]*$', themed, text, flags=re.M)
    elif prefix and prefix.startswith("pjg") and MARK not in text:
        start = m.start()
        end = text.find("</style>", start)
        text = text[:end] + override(prefix) + text[end:]
        n += 1
    if prefix and prefix.startswith("pjg"):
        def rule(r):
            nonlocal n
            body = r.group(2)
            if re.search(rf"background:\s*var\(--{prefix}-(gradient|primary)\)", body):
                body2, k = re.subn(r"(?<![-\w])color:\s*(white|#fff\b|#ffffff)", f"color: var(--{prefix}-on-primary)", body)
                n += k
                body = body2
            return r.group(1) + "{" + body + "}"
        text = re.sub(r"(<style[^>]*>)(.*?)(</style>)",
                      lambda b: b.group(1) + re.sub(r"([^{}]+)\{([^{}]*)\}", rule, b.group(2)) + b.group(3),
                      text, flags=re.S | re.I)
        # 5. the hero is a dark band in BOTH themes: its regional wash (blue/green/teal/brown/red linear
        #    stop + two radial glows, alpha .1–.55 — under the render gate's wash floor) goes graphite,
        #    and inside it the accent keeps its night value in day mode (#92400e on graphite ~2.6:1)
        def hero(r):
            nonlocal n
            sel, body = r.group(1), r.group(2)
            head = sel.strip().split("\n")[-1].strip()
            if head == f".{prefix}-hero" and re.search(r"background:\s*linear-gradient\(135deg", body):
                n += 1
                return sel + "{" + re.sub(r"background:\s*linear-gradient\(135deg[^;]*;", "background: #16181D;", body, count=1) + "}"
            if head == f".{prefix}-hero::before" and "radial-gradient" in body:
                n += 1
                return sel + "{" + re.sub(r"background:[^;]*;", "background: none;", body, count=1) + "}"
            return r.group(0)
        text = re.sub(r"(<style[^>]*>)(.*?)(</style>)",
                      lambda b: b.group(1) + re.sub(r"([^{}]+)\{([^{}]*)\}", hero, b.group(2)) + b.group(3),
                      text, flags=re.S | re.I)
        lock = f":root:not([data-theme=\"dark\"]) .{prefix}-hero{{--{prefix}-primary:#E8B563;--{prefix}-accent:#E8B563}}"
        if MARK in text and lock not in text:
            text = text.replace(f"        {MARK}\n", f"        {MARK}\n        {lock}\n", 1)
            n += 1
        text, k = re.subn(rf"background:\s*var\(--{prefix}-gradient\);\s*-webkit-background-clip:\s*text;\s*background-clip:\s*text;\s*-webkit-text-fill-color:\s*transparent;",
                          f"color: var(--{prefix}-primary);", text)
        n += k
    text, k = NAV_INLINE.subn(r"\1", text); n += k
    return text, n


def main():
    apply, check = "--apply" in sys.argv, "--check" in sys.argv
    total = 0
    for name in PAGES:
        path = ROOT / name
        if not path.exists():
            continue
        new, n = sweep(path.read_text(encoding="utf-8"))
        if n:
            total += n
            print(f"  {n:3d}  {name}")
            if apply:
                path.write_text(new, encoding="utf-8")
    print(f"PLN REGISTER — {'applied' if apply else ('FAIL' if total else 'PASS')}: {total} change(s)")
    if check and total:
        sys.exit(1)


if __name__ == "__main__":
    main()
