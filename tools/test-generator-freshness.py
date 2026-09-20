#!/usr/bin/env python3
"""
Every generated artefact is a current rendering of its source — or the build says so.

WHY THIS GATE EXISTS

standarization/ANTI_VIBECODE_STANDARD.md, clause 4, states the rule this gate applies site-wide:
*when a generated artefact cannot be inspected for the property you care about, assert that it is
a current rendering of the thing you CAN inspect.* v3.10.12 applied it to the OG social cards
(`tools/test-og-card-freshness.py`) after a violet accent survived a generator fix.

This gate applies it to the TEXT artefacts, and it was written because one of them had drifted for
four months in plain sight:

    standarization/Indexing gconsole/top-urls-request-indexing.txt
      generated 2026-05-14 · 102 URLs · the sitemap publishes 180
      and it still named "GB200 NVL72 Live Operations", a title retired in v2.0.0

78 public pages had never been on the list a person works down when requesting indexing. Nothing
reported it, because `--check` existed on three of these builders and was wired into no gate at
all, and two more builders had no check mode to wire.

WHAT IT CHECKS

Each builder is run in its own check mode, which rebuilds the artefact from its sources and
compares. A builder appears here or its output can rot unobserved:

    sitemap.xml · llms.txt · llms-full.txt · search-sections.json ·
    rz-explain-db.js + search-terms.json · the Search Console indexing list

WHAT IS DELIBERATELY NOT A BYTE COMPARE

The indexing list carries a generation date in its header, so a byte compare would report drift
every day and be turned off within a week. Its check compares the URL rows and their titles —
the thing that must not drift — and ignores the header. A check that cries wolf is a check that
gets disabled; that is the failure mode this note exists to prevent.

NOT COVERED, AND WHY

`tools/build-profile-photos.py` produces the portrait ladder and needs OpenCV for face-centred
cropping; `cv2` is not installed here, so the builder cannot run and a freshness check for it
would fail on a missing dependency rather than on staleness. Named here rather than silently
skipped. The parameter registries carry their own staleness gates already.

Usage: python3 tools/test-generator-freshness.py [--json]
"""
import argparse
import json
import subprocess
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

BUILDERS = [
    ("sitemap.xml", ["python3", "tools/build-sitemap.py", "--check"]),
    ("llms.txt", ["python3", "tools/build-llms-txt.py", "--check"]),
    ("llms-full.txt", ["python3", "tools/build-llms-full.py", "--check"]),
    ("search-sections.json", ["python3", "tools/build-search-sections.py", "--check"]),
    ("rz-explain-db.js + search-terms.json", ["python3", "tools/build-explain-db.py", "--check"]),
    ("Search Console indexing list", ["python3", "tools/build-indexing-list.py", "--check"]),
]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    results = []
    for label, cmd in BUILDERS:
        proc = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
        tail = [l for l in (proc.stdout + proc.stderr).strip().split("\n") if l.strip()]
        results.append({"artefact": label, "ok": proc.returncode == 0,
                        "detail": tail[-1] if tail else ""})

    stale = [r for r in results if not r["ok"]]

    if args.json:
        print(json.dumps({"checked": len(results), "stale": stale}, indent=2))
        return 1 if stale else 0

    print("── GENERATOR FRESHNESS ──")
    for r in results:
        mark = "✓" if r["ok"] else "✗"
        print(f"  {mark} {r['artefact']:38s} {r['detail'][:90]}")
    if stale:
        print(f"\nFAIL — {len(stale)} generated artefact(s) no longer match their sources.")
        print("Regenerate the named builder with --apply and commit the output with the change "
              "that moved it.")
        return 1
    print(f"\nPASS — {len(results)} generated artefact(s) match a fresh build of their sources.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
