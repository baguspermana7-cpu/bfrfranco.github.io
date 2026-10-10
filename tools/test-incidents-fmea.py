#!/usr/bin/env python3
"""test-incidents-fmea — every incident FMEA is grounded, scored and rendered.

Checks, for every dossier in data/incidents/*.json that carries an `fmea` block
(the same rules tools/incidents_fmea.validate_fmea applies at build time):

  * >= 4 failure modes, a scope statement, unique ids;
  * S, O, D are integers 1-10, each with a written rationale;
  * >= 2 evidence pointers per mode, and every pointer RESOLVES: an index that
    exists, and a quote found verbatim in the field or reference it names —
    the check that stops an FMEA from citing something the dossier never said;
  * a revised score only against an action that points at a published COE or
    improvement, and never a revised RPN above the original;
  * the rendered page incident-<slug>.html actually contains the section with
    one row per mode — the builder omits an invalid block, and an omission must
    be a failure here, not a quiet gap on the page.

Coverage is reported. With --require-all, any dossier without an FMEA fails.

Run:  python3 tools/test-incidents-fmea.py [--strict] [--require-all]
"""
import argparse
import glob
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import incidents_fmea as F  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true")
    ap.add_argument("--require-all", action="store_true")
    a = ap.parse_args()

    files = sorted(f for f in glob.glob(os.path.join(ROOT, "data", "incidents", "*.json"))
                   if not os.path.basename(f).startswith("_"))
    problems, covered, missing = [], [], []
    modes_total = 0
    for path in files:
        inc = json.load(open(path, encoding="utf-8"))
        slug = inc.get("slug") or os.path.basename(path)[:-5]
        if "fmea" not in inc:
            missing.append(slug)
            continue
        covered.append(slug)
        for e in F.validate_fmea(inc):
            problems.append(f"{slug}: {e}")
        modes = (inc.get("fmea") or {}).get("modes") or []
        modes_total += len(modes)
        page = os.path.join(ROOT, f"incident-{slug}.html")
        if not os.path.exists(page):
            problems.append(f"{slug}: rendered page incident-{slug}.html does not exist")
            continue
        html = open(page, encoding="utf-8").read()
        if 'id="fmea"' not in html:
            problems.append(f"{slug}: page has no FMEA section — rebuild with tools/build-incidents.py --apply, "
                            f"or the block was omitted as invalid (see the errors above)")
        elif len(re.findall(r'<details class="fm-row">', html)) != len(modes):
            problems.append(f"{slug}: page shows {len(re.findall(r'<details class=\"fm-row\">', html))} "
                            f"rows for {len(modes)} modes — page is stale; rebuild")

    print("── INCIDENT FMEA ──")
    print(f"  {len(covered)} of {len(files)} dossier(s) carry an FMEA · {modes_total} failure modes")
    if missing:
        print(f"  without one: {len(missing)}" + (f" — {', '.join(missing[:6])}{' …' if len(missing) > 6 else ''}"))
    if a.require_all and missing:
        problems.append(f"{len(missing)} dossier(s) have no FMEA and --require-all was given")
    if not problems:
        print("\nPASS — every FMEA is grounded in its dossier, scored with reasons, and rendered.")
        return 0
    print(f"\nFAIL — {len(problems)} problem(s):")
    for p in problems:
        print(f"  {p}")
    return 1 if a.strict else 0


if __name__ == "__main__":
    sys.exit(main())
