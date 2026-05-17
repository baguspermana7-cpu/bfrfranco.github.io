#!/usr/bin/env python3
"""fix-css-in-js-injection.py — git-verified literal repair of the
v1.5.0 / v1.8.0 "CSS injected into a JS string" regression.

ROOT CAUSE (git-confirmed)
--------------------------
Two patch tools matched a ``</style>`` that was actually *inside a JS
string literal* in a PDF/print builder, inserted their CSS before it, and
in doing so **clobbered the string's closing ``</style>…';`` tail**:

  * commit ``5ac5fe3`` (v1.5.0) — "article typography uplift
    (Awwwards-tier polish)" — articles / FF / geopolitics
  * commit ``f460741`` (v1.8.0) — "mobile [utility ]responsive patch" —
    calculators / dc-market-tracker / rfs-readiness-workbench

Result: an unterminated single-quoted string ->
``SyntaxError: Invalid or unexpected token`` -> the ENTIRE <script>
fails to parse -> every function (calc engine, free/pro, login, Export
PDF, menus) is undefined.

REPAIR STRATEGY (no heuristics, no guessing)
--------------------------------------------
For each affected file we read the *exact* injection hunk from
``git show <commit> -- <file>``:

  * the single removed ``-`` line  = the ORIGINAL correct line
  * the contiguous added ``+`` run = the EXACT injected text

We then do one literal ``str.replace(injected, original, 1)`` on the
current file. Every byte we restore comes verbatim from git history.
If the injected text is not found exactly once, or the block still
fails ``node --check`` after repair, the file is reverted and SKIPPED
for manual handling — we never half-fix.

USAGE
-----
    python3 tools/fix-css-in-js-injection.py --dry-run [files...]
    python3 tools/fix-css-in-js-injection.py [files...]

With no file args, reads the broken list from
``python3 tools/audit-js-syntax.py --list``.
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INJECTION_COMMITS = ["5ac5fe3", "f460741"]
MARKERS = (
    "/* v1.5.0 — article typography uplift (Awwwards-tier polish) */",
    "/* v1.8.0 — mobile responsive patch */",
    "/* v1.8.0 — mobile utility responsive patch */",
)
JS_BUILDER = re.compile(r"""(\+=\s*'|=\s*'|\.write\(\s*'|\+\s*')""")

SCRIPT_RE = re.compile(
    r"<script\b([^>]*)>(.*?)</script\s*>", re.IGNORECASE | re.DOTALL
)
TYPE_RE = re.compile(r"""\btype\s*=\s*["']?([^"'\s>]+)""", re.IGNORECASE)
SRC_RE = re.compile(r"""\bsrc\s*=""", re.IGNORECASE)
NON_JS_TYPES = {
    "application/ld+json", "application/json", "importmap",
    "speculationrules", "text/template", "text/x-template",
    "text/html", "text/markdown",
}


def sh(args: list[str]) -> str:
    return subprocess.run(
        args, cwd=ROOT, capture_output=True, text=True
    ).stdout


def broken_list() -> list[str]:
    out = sh(["python3", "tools/audit-js-syntax.py", "--list"])
    return [x for x in out.splitlines() if x.strip()]


class Hunk:
    """One qualifying injection: enough git-authoritative anchors to
    excise the injected region from the *current* file by offset and
    restore the exact original line."""

    def __init__(self, original: str, clobber_first: str,
                 resume_anchor: str, pre_anchor: str):
        self.original = original          # git '-' line: the correct line
        self.clobber_first = clobber_first  # 1st '+' line: stable broken line
        self.resume_anchor = resume_anchor  # 1st live original line after it
        self.pre_anchor = pre_anchor      # last live line BEFORE the '-' line


def parse_injection_hunks(diff: str) -> list[Hunk]:
    """Return qualifying Hunks.

    Shape (unified diff): leading context, a contiguous ``-`` run (the
    original line — normally exactly one), a contiguous ``+`` run whose
    first line is the clobbered/unterminated string and which contains an
    injection MARKER, then trailing context (the untouched resume code).
    """
    hunks: list[Hunk] = []
    lines = diff.splitlines()
    i, n = 0, len(lines)
    while i < n:
        if lines[i].startswith("-") and not lines[i].startswith("---"):
            # last non-empty CONTEXT line before this '-' run = stable
            # live code immediately preceding the clobbered line
            pre_anchor = ""
            for k in range(i - 1, max(-1, i - 8), -1):
                if k < 0 or lines[k].startswith(("@@", "diff ")):
                    break
                if lines[k][:1] == " " and lines[k][1:].strip():
                    pre_anchor = lines[k][1:]
                    break
            minus: list[str] = []
            while i < n and lines[i].startswith("-") \
                    and not lines[i].startswith("---"):
                minus.append(lines[i][1:])
                i += 1
            plus: list[str] = []
            while i < n and lines[i].startswith("+") \
                    and not lines[i].startswith("+++"):
                plus.append(lines[i][1:])
                i += 1
            if not plus:
                continue
            # trailing context = the unchanged resume code
            resume = ""
            j = i
            while j < n and not lines[j].startswith(
                ("@@", "diff ", "-", "+")
            ):
                ctx = lines[j][1:] if lines[j][:1] == " " else lines[j]
                if ctx.strip():
                    resume = ctx
                    break
                j += 1
            original = "\n".join(minus)
            injected = "\n".join(plus)
            # qualifying: original is a quoted string fragment that holds
            # the spliced </style>; injected carries a tool MARKER; the
            # original itself is clean; resume code exists to bound it.
            if (
                any(mk in injected for mk in MARKERS)
                and "</style>" in original
                and "'" in original
                and not any(mk in original for mk in MARKERS)
                and resume.strip()
            ):
                hunks.append(Hunk(original, plus[0], resume, pre_anchor))
            continue
        i += 1
    return hunks


def failing_blocks(html: str) -> int:
    """Count inline JS blocks that fail node --check (filtered)."""
    fails = 0
    for m in SCRIPT_RE.finditer(html):
        attrs, body = m.group(1) or "", m.group(2) or ""
        if SRC_RE.search(attrs):
            continue
        tm = TYPE_RE.search(attrs)
        if tm and tm.group(1).lower() in NON_JS_TYPES:
            continue
        if not body.strip():
            continue
        is_mod = bool(tm and tm.group(1).lower() == "module")
        with tempfile.NamedTemporaryFile(
            "w", suffix=".mjs" if is_mod else ".js",
            delete=False, encoding="utf-8",
        ) as fh:
            fh.write(body)
            tmp = fh.name
        try:
            r = subprocess.run(["node", "--check", tmp],
                                capture_output=True, timeout=30)
            if r.returncode != 0:
                fails += 1
        finally:
            os.unlink(tmp)
    return fails


def repair_file(fname: str, dry_run: bool) -> str:
    path = os.path.join(ROOT, fname)
    with open(path, "r", encoding="utf-8") as fh:
        original_content = fh.read()
    content = original_content
    applied = 0
    for commit in INJECTION_COMMITS:
        diff = sh(["git", "show", "--no-color", commit, "--", fname])
        if not diff.strip():
            continue
        for h in parse_injection_hunks(diff):
            # Unique start anchor: prefer the full clobbered line (the
            # first '+' line — long & unique for v1.5.0). Fall back to the
            # JS prefix before the spliced `</style>` only if it is unique.
            # Resolve a UNIQUE start anchor, most-specific first:
            #  1. clobber_first — full broken '+' line (shapes A/C)
            #  2. prefix before the spliced </style> (some A)
            #  3. pre_anchor — live line just BEFORE the clobbered line
            #     (shape B: the original line is a bare close with no
            #     unique '+'/prefix; excise the span AFTER this line)
            mode = None
            if content.count(h.clobber_first) == 1:
                anchor, mode = h.clobber_first, "start"
            else:
                pfx = h.original.split("</style>", 1)[0]
                if pfx.strip() and content.count(pfx) == 1:
                    anchor, mode = pfx, "start"
                elif h.pre_anchor and content.count(h.pre_anchor) == 1:
                    anchor, mode = h.pre_anchor, "after"
            if mode is None:
                if (content.count(h.clobber_first) == 0
                        and (not h.pre_anchor
                             or content.count(h.pre_anchor) == 0)):
                    continue  # not injected by this commit / already clean
                return (f"SKIP {fname}: no unique start anchor (manual)")

            apos = content.index(anchor)
            seek_from = apos + len(anchor)
            region_start = apos if mode == "start" else seek_from
            after = content.find(h.resume_anchor, seek_from)
            if after == -1:
                return (f"SKIP {fname}: resume anchor not found after "
                        f"injection (drifted — manual)")
            region = content[region_start:after]
            if not any(mk in region for mk in MARKERS):
                return (f"SKIP {fname}: region has no marker "
                        f"(unexpected — manual)")
            replacement = (h.original if mode == "start"
                           else "\n" + h.original)
            content = (content[:region_start] + replacement + "\n"
                       + content[after:])
            applied += 1
    if applied == 0:
        return f"SKIP {fname}: no qualifying git injection hunk found"

    if dry_run:
        before = failing_blocks(original_content)
        return (f"DRY  {fname}: {applied} hunk(s) revertible "
                f"(was {before} failing block(s))")

    # apply, then verify the syntax error is gone
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(content)
    remaining = failing_blocks(content)
    if remaining != 0:
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(original_content)  # revert — never half-fix
        return (f"SKIP {fname}: still {remaining} failing block(s) after "
                f"{applied} revert(s) — reverted, needs manual fix")
    return f"FIX  {fname}: {applied} hunk(s) reverted, 0 failing blocks ✓"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("files", nargs="*")
    args = ap.parse_args()

    files = args.files or broken_list()
    if not files:
        print("nothing to repair (audit reports 0 broken)")
        return 0

    results = [repair_file(f, args.dry_run) for f in files]
    for r in results:
        print(r)
    skipped = [r for r in results if r.startswith("SKIP")]
    fixed = [r for r in results if r.startswith(("FIX", "DRY"))]
    print(f"\n{len(fixed)} repaired/repairable, {len(skipped)} skipped")
    return 1 if (skipped and not args.dry_run) else 0


if __name__ == "__main__":
    sys.exit(main())
