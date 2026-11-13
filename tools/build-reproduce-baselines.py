#!/usr/bin/env python3
"""Generate data/reproduce-baselines.json (PRD-Q03 FR-2): the named starting states an incident reproduction builds on.

    python3 tools/build-reproduce-baselines.py --apply   # write
    python3 tools/build-reproduce-baselines.py --check   # exit 1 if the file differs from a fresh build

Baselines are read from the calculators' own markup, never typed:
- tia-t3-ent-all: every ITEMS entry of tia-942-checklist.html whose tiers include 3 and dcTypes include 'ent' (the
  page defaults currentTier = 3, currentDcType = 'ent'), each ticked, plus the P2 mirror inputs #tiaTier / #tiaDcType
  with the type rzScenario.capture() records for them.
- tier-defaults: every capturable control of tier-advisor.html (rzScenario.isCapturable) at its default: the
  selected option (else the first) or the value attribute.
"""
import argparse
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "reproduce-baselines.json")
EXCLUDE_TYPES = {"password", "email", "hidden", "file", "submit", "button", "image"}   # js/rz-scenario.js EXCLUDE_TYPES


def _read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as fh:
        return fh.read()


def _js_str(s):
    """Decode a single-quoted JS string body (only the escapes the page uses)."""
    return re.sub(r"\\(.)", lambda m: m.group(1), s)


def tia_baseline():
    src = _read("tia-942-checklist.html")
    m = re.search(r"const DC_ALL = \[([^\]]*)\];", src)
    if not m:
        sys.exit("tia-942-checklist.html: DC_ALL not found")
    dc_all = re.findall(r"'([a-z]+)'", m.group(1))
    tier = int(re.search(r"var currentTier = (\d+);", src).group(1))
    dctype = re.search(r"var currentDcType = '([a-z]+)';", src).group(1)
    a = src.index("const ITEMS = [")
    b = src.index("\n    ];", a)
    items = re.findall(r"\{id:'([a-z0-9_]+)',cat:'[a-z_]+',label:'((?:[^'\\]|\\.)*)',tiers:\[([0-9,\s]*)\],w:[0-9.]+,"
                       r"ref:'(?:[^'\\]|\\.)*',dcTypes:(DC_ALL|\[[^\]]*\])", src[a:b])
    if not items:
        sys.exit("tia-942-checklist.html: ITEMS not parsed")
    inputs, labels = {}, {}
    for iid, label, tiers, dct in items:
        types = dc_all if dct == "DC_ALL" else re.findall(r"'([a-z]+)'", dct)
        if tier in [int(t) for t in tiers.split(",") if t.strip()] and dctype in types:
            inputs["chk-" + iid] = {"t": "checkbox", "v": True}
            labels["chk-" + iid] = html.unescape(_js_str(label))
    n_items = len(inputs)
    # P2 mirrors: their element and type as committed on the page
    for mid, val, lab in (("tiaTier", str(tier), "Tier"), ("tiaDcType", dctype, "Facility type")):
        el = re.search(r'<input\b[^>]*\bid="%s"[^>]*>' % mid, src)
        if not el:
            sys.exit(f"tia-942-checklist.html: mirror #{mid} missing (P2)")
        t = (re.search(r'\btype="([^"]+)"', el.group(0)) or [None, "text"])[1].lower()
        v = (re.search(r'\bvalue="([^"]*)"', el.group(0)) or [None, ""])[1]
        if v != val:
            sys.exit(f"tia-942-checklist.html: #{mid} value {v!r} != page default {val!r}")
        inputs[mid] = {"t": t, "v": v}
        labels[mid] = lab
    return {
        "calc": "tia", "page": "tia-942-checklist.html",
        "describe": "Every item on the Tier 3, Enterprise list ticked",
        "context": {"tier": tier, "dcType": dctype, "basis": "page defaults currentTier / currentDcType"},
        "derivedFrom": f"ITEMS where tiers include {tier} and dcTypes include '{dctype}' ({n_items} items) + the P2 mirrors",
        "count": len(inputs), "inputs": inputs, "labels": labels,
    }


def tier_baseline():
    src = _read("tier-advisor.html")
    body = re.sub(r"<script\b.*?</script>", "", src, flags=re.S)
    inputs, labels, options = {}, {}, {}
    ctrls = [(m.start(), "input", m.group(1), "") for m in re.finditer(r"<input\b([^>]*)>", body)]
    ctrls += [(m.start(), "select", m.group(1), m.group(2)) for m in re.finditer(r"<select\b([^>]*)>(.*?)</select>", body, flags=re.S)]
    ctrls += [(m.start(), "textarea", m.group(1), "") for m in re.finditer(r"<textarea\b([^>]*)>", body)]
    for _, tag, attrs, inner in sorted(ctrls):
        idm = re.search(r'\bid="([^"]+)"', attrs)
        if not idm:
            continue
        cid = idm.group(1)
        if re.search(r'(ogin|odal)', cid):
            continue
        if tag == "input":
            t = (re.search(r'\btype="([^"]+)"', attrs) or [None, "text"])[1].lower()
            if t in EXCLUDE_TYPES or t == "radio":
                continue
            v = bool(re.search(r"\bchecked\b", attrs)) if t == "checkbox" else (re.search(r'\bvalue="([^"]*)"', attrs) or [None, ""])[1]
        elif tag == "select":
            t = "select"
            opts = re.findall(r'<option\b([^>]*)>(.*?)</option>', inner, flags=re.S)
            if not opts:
                continue
            omap, v = {}, None
            for oa, otext in opts:
                txt = html.unescape(re.sub(r"<[^>]+>", "", otext)).strip()
                ov = (re.search(r'\bvalue="([^"]*)"', oa) or [None, txt])[1]
                omap[ov] = txt
                if v is None and re.search(r"\bselected\b", oa):
                    v = ov
            if v is None:
                v = next(iter(omap))
            options[cid] = omap
        else:
            t, v = "textarea", ""
        aria = re.search(r'\baria-label="([^"]*)"', attrs)
        lab = re.search(r'<label\b[^>]*for="%s"[^>]*>(.*?)</label>' % re.escape(cid), body, flags=re.S)
        inputs[cid] = {"t": t, "v": v}
        labels[cid] = (html.unescape(aria.group(1)) if aria else
                       html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", lab.group(1)))).strip() if lab else cid)
    return {
        "calc": "tier", "page": "tier-advisor.html",
        "describe": "The tier advisor's own defaults",
        "derivedFrom": "selected option or value attribute of each capturable control (tier-advisor.html)",
        "count": len(inputs), "inputs": inputs, "labels": labels, "options": options,
    }


def build():
    return {
        "schema": "rz-reproduce-baselines/1",
        "generatedBy": "tools/build-reproduce-baselines.py",
        "baselines": {"tia-t3-ent-all": tia_baseline(), "tier-defaults": tier_baseline()},
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    text = json.dumps(build(), indent=1, ensure_ascii=False) + "\n"
    cur = open(OUT, encoding="utf-8").read() if os.path.exists(OUT) else None
    b = json.loads(text)["baselines"]
    summary = ", ".join(f"{k} {v['count']}" for k, v in b.items())
    if args.check:
        if cur != text:
            print(f"STALE — data/reproduce-baselines.json differs from a fresh build ({summary}); run --apply")
            sys.exit(1)
        print(f"PASS — reproduce baselines current ({summary})")
        return
    if args.apply:
        with open(OUT, "w", encoding="utf-8") as fh:
            fh.write(text)
        print(f"wrote data/reproduce-baselines.json ({summary})")
    else:
        print(f"dry run ({summary}); --apply writes")


if __name__ == "__main__":
    main()
