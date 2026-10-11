#!/usr/bin/env python3
"""test-incidents-response — the role layer of every incident dossier is grounded and rendered.

Checks, for every dossier in data/incidents/*.json (rules: tools/incidents_response.py):

  * response.roles: >= 3 roles from the fixed vocabulary, each with who-it-was;
  * response.recorded: >= 3 actions, each pointing at a sequence-of-events entry with a
    quote that is a VERBATIM substring of that entry — a role is only ever credited with
    an action the record shows. This is the anti-fabrication check, machine-run;
  * every FMEA mode carries a playbook of >= 4 actions from >= 3 roles covering detect,
    contain and recover, each citing a named practice from BASIS or a dossier COE /
    improvement / lesson / factor that resolves;
  * every declared role is used;
  * the rendered page carries the Response section with one tab per role, one matrix row
    per role seen acting, a "Who acts" block in every FMEA row, and both engine figures
    (failure chain + fishbone) from data/incidents/_diagrams.json.

The figures themselves are gated by `node tools/build-incident-diagrams.mjs --check`
(zero engine warnings, file current).

Run:  python3 tools/test-incidents-response.py [--strict] [--require-all]
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
import incidents_response as R  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true")
    ap.add_argument("--require-all", action="store_true")
    a = ap.parse_args()

    files = sorted(f for f in glob.glob(os.path.join(ROOT, "data", "incidents", "*.json"))
                   if not os.path.basename(f).startswith("_"))
    try:
        diagrams = json.load(open(os.path.join(ROOT, "data", "incidents", "_diagrams.json"), encoding="utf-8"))
    except FileNotFoundError:
        diagrams = {}
    problems, covered, missing = [], [], []
    n_rec = n_pb = 0
    for path in files:
        inc = json.load(open(path, encoding="utf-8"))
        slug = inc.get("slug") or os.path.basename(path)[:-5]
        if "response" not in inc:
            missing.append(slug)
            continue
        covered.append(slug)
        errs = R.validate_response(inc)
        problems += [f"{slug}: {e}" for e in errs]
        r = inc["response"]
        n_rec += len(r.get("recorded") or [])
        modes = (inc.get("fmea") or {}).get("modes") or []
        n_pb += sum(len(m.get("playbook") or []) for m in modes)
        if slug not in diagrams:
            problems.append(f"{slug}: no engine figures in _diagrams.json — run node tools/build-incident-diagrams.mjs")
        page = os.path.join(ROOT, f"incident-{slug}.html")
        if errs or not os.path.exists(page):
            if not os.path.exists(page):
                problems.append(f"{slug}: page incident-{slug}.html does not exist")
            continue
        html = open(page, encoding="utf-8").read()
        if 'id="response"' not in html:
            problems.append(f"{slug}: page has no Response section — stale page; rebuild")
            continue
        tabs = len(re.findall(r'role="tab" id="rs-tab-', html))
        if tabs != len(r["roles"]):
            problems.append(f"{slug}: {tabs} role tabs for {len(r['roles'])} roles — stale page")
        acting = len({x["role"] for x in r["recorded"]})
        rows = len(re.findall(r'<div class="rs-mr"><div class="rs-role">', html))
        if rows != acting:
            problems.append(f"{slug}: matrix shows {rows} roles, {acting} are seen acting — stale page")
        who = html.count('<p class="fm-sub">Who acts')
        if who != len(modes):
            problems.append(f"{slug}: {who} FMEA rows carry a 'Who acts' block, {len(modes)} modes exist")
        if slug in diagrams:
            for key, tag in (("chain", 'id="fc-'), ("fishbone", 'id="fb-')):
                if tag not in html:
                    problems.append(f"{slug}: {key} figure is not on the page")

    print("── INCIDENT RESPONSE BY ROLE ──")
    print(f"  {len(covered)} of {len(files)} dossier(s) · {n_rec} recorded actions · {n_pb} playbook actions")
    if missing:
        print(f"  without one: {len(missing)}" + f" — {', '.join(missing[:6])}{' …' if len(missing) > 6 else ''}")
    if a.require_all and missing:
        problems.append(f"{len(missing)} dossier(s) have no response block and --require-all was given")
    if not problems:
        print("\nPASS — every role action is quoted from the record, every playbook action cites its basis, all rendered.")
        return 0
    print(f"\nFAIL — {len(problems)} problem(s):")
    for p in problems:
        print(f"  {p}")
    return 1 if a.strict else 0


if __name__ == "__main__":
    sys.exit(main())
