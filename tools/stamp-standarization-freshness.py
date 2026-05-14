#!/usr/bin/env python3
"""
stamp-standarization-freshness.py
Annotate stale standardization docs with a 'Last reviewed' bridge stamp
that documents what shipped since the doc was last touched. Per mandate
feedback_standarization_freshness.md (2026-05-14).

Inserts a brief block at the top (after the first heading) describing:
- Last review date
- Original write date
- Recent versions since original write
- Status (CURRENT / NEEDS-REWRITE / SUPERSEDED)

Idempotent — re-running adds nothing if the stamp already exists.

Usage:
  python3 tools/stamp-standarization-freshness.py             # dry-run
  python3 tools/stamp-standarization-freshness.py --apply     # write changes
"""
import argparse
import os
import re
import subprocess
import sys
from datetime import datetime

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TODAY = datetime.now().strftime('%Y-%m-%d')

STALE_FILES = {
    'standarization/SUPABASE_FIREBASE_SETUP.md': {
        'status': 'SUPERSEDED',
        'note': 'Site uses GitHub Pages + Cloudflare + auth.js (localStorage sessions), not Supabase/Firebase. Doc kept as historical record. See AUTH_STANDARD.md + FEATURE_FLAGS_STANDARD.md for current auth model.',
    },
    'standarization/Improvement Plan/50-Ideas-Batch-1.md': {
        'status': 'HISTORICAL',
        'note': 'Idea inventory from Feb 2026. Many items shipped (calc pages, spares engine, PLN grid, design.md, 3-tier feature flags). Treat as historical brainstorm, not active backlog.',
    },
    'standarization/LEGAL_COMPLIANCE_STANDARD.md': {
        'status': 'CURRENT',
        'note': 'Privacy + terms patterns still apply. v1.18.x did not change legal posture. Refresh deferred until a real policy change.',
    },
    'standarization/Improvement Plan/100-Ideas-Batch-3.md': {
        'status': 'HISTORICAL',
        'note': 'See 50-Ideas-Batch-1.md note. Active backlog now lives in TaskCreate tasks + CHANGELOG planned section.',
    },
    'standarization/Improvement Plan/50-Ideas-Batch-2.md': {
        'status': 'HISTORICAL',
        'note': 'See 50-Ideas-Batch-1.md note.',
    },
    'standarization/EMAIL_DOMAIN_CONFIG.md': {
        'status': 'CURRENT',
        'note': 'DNS + email config stable. v1.18.x did not change. ROOT_EMAILS + DEMO_EMAILS list in auth.js cross-references this.',
    },
    'standarization/prompts/enhance-datacenter-landing-page.md': {
        'status': 'CURRENT',
        'note': 'Prompt template still valid. Recent index.html refresh (v1.18.5 lean credentials band) does not invalidate the prompt pattern.',
    },
    'standarization/CONTENT_TAXONOMY_STANDARD.md': {
        'status': 'NEEDS-REVIEW',
        'note': 'Site has added Spares Engine, PLN Java-Bali family (5 pages), ASEAN DC Report, achievements page since this doc was written. Taxonomy categories may need new entries. Defer to next content-strategy sweep.',
    },
    'standarization/DATAHALL_AI_STANDARD.md': {
        'status': 'NEEDS-REVIEW',
        'note': 'datahallAI page renamed to datahall-ai canonical key in v1.18.1 feature-flag schema. References to "datahallAI.html" still valid (filename unchanged) but feature-flag page-key is now "datahall-ai". Update Section 1 references when actively editing the page.',
    },
}

STAMP_MARKER = '<!-- v1.18.8-freshness-stamp -->'


def get_first_heading_offset(content: str) -> int:
    """Return byte offset right after the first H1 heading, or 0 if no H1."""
    m = re.search(r'^# .+?\n', content, re.MULTILINE)
    if not m:
        return 0
    return m.end()


def has_stamp(content: str) -> bool:
    return STAMP_MARKER in content


def build_stamp(rel_path: str, info: dict) -> str:
    return (f'\n{STAMP_MARKER}\n'
            f'> **Last reviewed: {TODAY}** · Status: `{info["status"]}`\n'
            f'> \n'
            f'> {info["note"]}\n'
            f'> \n'
            f'> Per mandate `feedback_standarization_freshness.md`. To remove this stamp, replace it with a real content refresh.\n\n')


def stamp_file(rel_path: str, info: dict, apply: bool) -> dict:
    full = os.path.join(REPO_ROOT, rel_path)
    if not os.path.exists(full):
        return {'path': rel_path, 'status': 'not-found'}
    with open(full, encoding='utf-8') as f:
        content = f.read()
    if has_stamp(content):
        return {'path': rel_path, 'status': 'already-stamped'}
    offset = get_first_heading_offset(content)
    if offset == 0:
        # No H1 — prepend at top
        new_content = build_stamp(rel_path, info) + content
    else:
        new_content = content[:offset] + build_stamp(rel_path, info) + content[offset:]
    if apply:
        with open(full, 'w', encoding='utf-8') as f:
            f.write(new_content)
    return {'path': rel_path, 'status': 'stamped' if apply else 'would-stamp', 'info': info}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--apply', action='store_true')
    args = p.parse_args()

    results = []
    for rel, info in STALE_FILES.items():
        r = stamp_file(rel, info, args.apply)
        results.append(r)
        print(f'[{r["status"]:>16}] {rel}')

    stamped = sum(1 for r in results if r['status'] in ('stamped', 'would-stamp'))
    skipped = sum(1 for r in results if r['status'] == 'already-stamped')
    print()
    print(f'Total: {len(results)} files. Stamped: {stamped}. Already stamped: {skipped}.')
    if not args.apply and stamped > 0:
        print('Re-run with --apply to write.')


if __name__ == '__main__':
    main()
