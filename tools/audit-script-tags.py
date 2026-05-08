#!/usr/bin/env python3
r"""
audit-script-tags.py — fail-fast scanner for the
"unescaped </script> inside a JS string literal" bug.

Background
----------
This bug killed all interactive features on calc + standards pages
(commits a9a2c4b, a93d7d0).  When a JS template literal or string
concatenation embeds raw `<script src="..."></script>` tokens, the
browser HTML parser is NOT JS-aware: it scans the entire <script>
element body for the literal `</script>` token and terminates the
script element early.  Every function declaration after that line
is then parsed as HTML, never registered as JS, and inline onclick
handlers fail silently.

The fix in code is `<\/script>` (escape the slash).  This auditor
prevents the regression by failing CI / pre-push when the pattern
re-appears.

Usage
-----
    python3 tools/audit-script-tags.py            # human report
    python3 tools/audit-script-tags.py --strict   # exits 1 on issue
    python3 tools/audit-script-tags.py --json     # machine-readable

Run before any push that touches HTML files containing inline
<script> blocks (especially calc pages and PDF/print-window code).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parent.parent

# Folders we DON'T audit (third-party / archive / private)
EXCLUDE_DIRS = {
    'node_modules', '.git', '.cache', 'archive', '.qa-screens',
    'dcmoc', 'Dunia-Emosi', 'Apps/second brain', 'embed',
    'Automation',  # private engineering audits, gitignored
}


def in_excluded(path: Path) -> bool:
    s = str(path)
    return any(f'/{d}/' in s or s.endswith(f'/{d}') for d in EXCLUDE_DIRS)


def scan(path: Path) -> List[Dict[str, Any]]:
    """Look for the specific bug signature: a `<script src="..."></script>`
    or `</script>` embedded inside a JS string literal / template literal /
    string concatenation. The signature is unambiguous — a quote/tick
    character followed by `<script` (or a `</script>` token preceded on a
    nearby line by an open string concatenation) means the tag is INSIDE
    a JS string.
    """
    try:
        text = path.read_text(encoding='utf-8', errors='replace')
        lines = text.splitlines()
    except Exception as e:
        return [{'severity': 'WARN', 'issue': 'unreadable', 'detail': str(e)}]

    issues: List[Dict[str, Any]] = []
    # Track a multi-line string-concat / template-literal context.
    # When a line opens a string with `<script` and doesn't close on the
    # same line, the next physical line(s) are also inside that string
    # until the closing quote/tick is reached.
    open_string_kind = None   # one of None, "'", '"', '`'

    for i, line in enumerate(lines, 1):
        # If we're already inside a multi-line string-context that started
        # with a `<script` token, every line until the close is suspicious.
        if open_string_kind is not None:
            if r'<\/script>' not in line and ('</script>' in line or '<script src=' in line):
                issues.append({
                    'severity': 'CRITICAL',
                    'issue': 'unescaped-script-tag-in-js-multiline-string',
                    'line': i,
                    'snippet': line.rstrip()[:160],
                    'fix': r'change </script> -> <\/script> (escape the slash)',
                })
            # Did the string close on this line?
            if open_string_kind in line:
                open_string_kind = None
            continue

        # Look for the signature: a quote/tick immediately followed by `<script`
        for q in ("'<script", '"<script', '`<script'):
            idx = line.find(q)
            if idx < 0:
                continue
            # Found an embedded script tag in a string. Is the string closed
            # on this same line (correctly escaped) or open across lines?
            if r'<\/script>' in line:
                # already escaped — caller used the correct form
                continue
            # The bug is real on this line OR the string continues to next
            # line(s). Either way, flag it.
            issues.append({
                'severity': 'CRITICAL',
                'issue': 'unescaped-script-tag-in-js-string',
                'line': i,
                'snippet': line.rstrip()[:160],
                'fix': r'change </script> -> <\/script> (escape the slash)',
            })
            # Track string-continuation if the line doesn't close the string
            qchar = q[0]
            # Naive: count quote characters of this kind on the line; if odd
            # number after the open, the string continues.
            after_open = line[idx + 1:]
            if after_open.count(qchar) == 0:
                open_string_kind = qchar
            break    # one finding per line is enough
    return issues


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--strict', action='store_true',
                    help='exit 1 if any CRITICAL findings')
    ap.add_argument('--json', action='store_true',
                    help='emit JSON instead of human report')
    args = ap.parse_args()

    files = []
    for path in ROOT.rglob('*.html'):
        if in_excluded(path):
            continue
        files.append(path)

    findings: Dict[str, List[Dict[str, Any]]] = {}
    for f in files:
        result = scan(f)
        if result:
            findings[str(f.relative_to(ROOT))] = result

    if args.json:
        print(json.dumps({'audited': len(files), 'findings': findings}, indent=2))
    else:
        print('=' * 64)
        print('Script-tag-in-JS-string audit')
        print('=' * 64)
        print(f'Audited: {len(files)} HTML files')
        if not findings:
            print('CLEAN — no unescaped </script> inside JS strings detected')
        else:
            print(f'FAIL — {len(findings)} file(s) have issues:')
            for f, items in findings.items():
                print(f'\n  {f}:')
                for it in items[:5]:
                    print(f"    line {it.get('line', '?')}  [{it['severity']}]  {it.get('snippet', '')[:100]}")
                if len(items) > 5:
                    print(f'    ... +{len(items)-5} more')
            print(f'\nFix: change </script> -> <\\/script> at each flagged line.')
            print('See standarization/PDF_EXPORT_STANDARD.md "Lesson learnt: 2026-05-09" for context.')

    if args.strict and findings:
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
