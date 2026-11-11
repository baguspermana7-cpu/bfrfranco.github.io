#!/usr/bin/env python3
"""build-search-index.py — P14: search-index.json covers every public root page.

The palette (js/rz-command-palette.js) searches search-index.json. Until v3.38.0 only
tools/assemble-article.py wrote to it, so 97 public root pages (43 incident dossiers, the
cockpits, the grid monitors, the labs, tools.html ...) could not be found.

Rules:
  * Existing entries are CURATED (assemble-article.py writes keywords, reading time, image)
    and are kept as they are, in their order.
  * Every public root page without an entry gets one, derived from the page itself: <title>
    (site suffix removed), meta description, meta keywords, og:image, JSON-LD datePublished,
    category from the filename family. New entries are appended sorted by url, ids continue
    from the current maximum.
  * Entries whose file no longer exists are dropped.
  * Not public: <meta name="robots" content="noindex">, the EXCLUDE list, robots.txt Disallow.
    The 43 incident dossiers, dc-incidents and the LTC labs are noindex BY DESIGN: they sit behind
    the tier gate (enforceTierFeatureAccess), so the palette does not offer them to every visitor.

  python3 tools/build-search-index.py --apply   write search-index.json
  python3 tools/build-search-index.py --check   exit 1 when the file is not what --apply would write
"""
import html
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "search-index.json"
EXCLUDE = {"404.html", "account.html", "index1.html", "offline.html"}
SUFFIX = re.compile(r"\s*[|·–—-]\s*(ResistanceZero|Resistance Zero|RZ)\b.*$", re.I)

CALCS = {"capex-calculator.html", "opex-calculator.html", "tco-calculator.html", "roi-calculator.html",
         "pue-calculator.html", "carbon-footprint.html", "cx-calculator.html", "spares-readiness-calculator.html",
         "tier-advisor.html", "tia-942-checklist.html", "rfs-readiness-workbench.html", "cdu-calculator.html",
         "fire-calculator.html"}
COCKPITS = {"chiller-plant.html", "datahall.html", "datahallAI.html", "dc-conventional.html", "fire-system.html",
            "fuel-system.html", "water-system.html", "ict.html", "EPMS_Telemetry.html", "cdu-mini-bms.html"}


def category(name: str) -> str:
    if name in CALCS:
        return "Calculator"
    if name in COCKPITS:
        return "Tool"
    for prefix, cat in (("incident-", "Incident"), ("pln-", "Grid monitor"), ("ltc-", "Lab"),
                        ("standards-ltc", "Lab"), ("compare-", "Comparison"), ("pillar-", "Pillar"),
                        ("geopolitics", "Geopolitics"), ("future-forward", "Future Forward"), ("FF-", "Future Forward"),
                        ("article-", "Article"), ("infographic-", "Infographic"), ("plan-", "Plan"),
                        ("network-", "Tool"), ("cdu-", "Tool"), ("fire-", "Tool")):
        if name.startswith(prefix):
            return cat
    return "Hub"


def robots_disallow() -> list:
    try:
        lines = (ROOT / "robots.txt").read_text(encoding="utf-8").splitlines()
    except OSError:
        return []
    return [l.split(":", 1)[1].strip().lstrip("/") for l in lines if l.lower().startswith("disallow:") and l.split(":", 1)[1].strip()]


def meta(src: str, attr: str, key: str) -> str:
    for m in re.finditer(r"<meta\b[^>]*>", src, re.I):
        tag = m.group(0)
        if re.search(rf'{attr}\s*=\s*["\']{re.escape(key)}["\']', tag, re.I):
            c = re.search(r'content\s*=\s*"([^"]*)"', tag, re.I) or re.search(r"content\s*=\s*'([^']*)'", tag, re.I)
            if c:
                return html.unescape(c.group(1)).strip()
    return ""


def public(name: str, src: str, disallow: list) -> bool:
    if name in EXCLUDE or name.startswith("google"):
        return False
    if any(d and name.startswith(d) for d in disallow):
        return False
    return "noindex" not in meta(src, "name", "robots").lower()


def entry(name: str, src: str, ident: int) -> dict:
    t = re.search(r"<title[^>]*>(.*?)</title>", src, re.I | re.S)
    title = SUFFIX.sub("", html.unescape(re.sub(r"\s+", " ", t.group(1))).strip()) if t else name
    e = {"id": ident, "title": title, "url": name, "description": meta(src, "name", "description"),
         "category": category(name)}
    kw = meta(src, "name", "keywords")
    e["keywords"] = [k.strip() for k in kw.split(",") if k.strip()][:16] if kw else []
    img = meta(src, "property", "og:image")
    if img:
        e["image"] = re.sub(r"^https?://(www\.)?resistancezero\.com/", "", img)
    d = re.search(r'"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})', src)
    if d:
        e["date"] = d.group(1)
    return e


def build() -> list:
    current = json.loads(OUT.read_text(encoding="utf-8"))
    disallow = robots_disallow()
    kept = [e for e in current if (ROOT / e["url"].rstrip("/")).exists() or (ROOT / e["url"]).is_dir()]
    have = {e["url"] for e in kept}
    nxt = max([e["id"] for e in current if isinstance(e.get("id"), int)] + [0]) + 1
    added = []
    for p in sorted(ROOT.glob("*.html"), key=lambda x: x.name):
        if p.name in have:
            continue
        src = p.read_text(encoding="utf-8", errors="replace")
        if not public(p.name, src, disallow):
            continue
        added.append(entry(p.name, src, nxt))
        nxt += 1
    return kept + added


def main() -> int:
    mode = "apply" if "--apply" in sys.argv else "check"
    rows = build()
    text = json.dumps(rows, indent=2, ensure_ascii=False) + "\n"
    cur = OUT.read_text(encoding="utf-8")
    if mode == "apply":
        if text != cur:
            OUT.write_text(text, encoding="utf-8")
        print(f"search-index.json: {len(rows)} entries ({len(rows) - len(json.loads(cur))} change in count)")
        return 0
    if text != cur:
        print(f"STALE search-index.json — a fresh build has {len(rows)} entries, the file {len(json.loads(cur))}; run --apply")
        return 1
    print(f"OK — search-index.json is current: {len(rows)} entries")
    return 0


if __name__ == "__main__":
    sys.exit(main())
