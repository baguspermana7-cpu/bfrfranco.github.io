#!/usr/bin/env python3
"""Audit Pro/Free mode-bar indicator on every calc page.

Rule (per PRO_MODE_STANDARDIZATION.md §3 + dark-mode coverage rule in CLAUDE.md):
A page that contains a `.mode-bar` AND defines a dark-mode override for the
`.mode-btn` base class MUST also define a dark-mode override for
`.mode-btn.active` — otherwise the dark base override beats the active
gradient (same specificity, later in cascade) and the user can't see which
mode is active.

This audit was authored after a v1.41.0 user report:
> "haduh, ini lagi indicator pro klw aktif atau yang free nggak keluar."
The cause was that FF-2.html had `[data-theme="dark"] .tgs-mode-btn { ... }`
but no `[data-theme="dark"] .tgs-mode-btn.active { ... }`.

Usage:
    python3 tools/audit-pro-mode-indicator.py           # report only
    python3 tools/audit-pro-mode-indicator.py --strict  # exit non-zero on findings
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent

# Match any prefixed mode-btn class: .tgs-mode-btn, .hfx-mode-btn, .pue-btn-free, etc.
MODE_BTN_RE = re.compile(r"\.([a-z][a-z0-9-]*)-mode-btn")
DARK_MODE_BTN_RE = re.compile(
    r'\[data-theme="dark"\][^{]*\.([a-z][a-z0-9-]*)-mode-btn(?:\.active)?',
    re.IGNORECASE,
)


def find_html_files() -> list[Path]:
    return [
        p for p in REPO_ROOT.glob("*.html")
        if not p.name.startswith(".") and p.is_file()
    ]


def audit_page(path: Path) -> list[str]:
    """Return a list of findings (strings) for this page. Empty = clean."""
    text = path.read_text(encoding="utf-8", errors="replace")
    findings: list[str] = []

    # Skip pages that don't have a mode-bar pattern at all
    if "mode-btn" not in text:
        return []

    # Find every prefix used on this page (typically 1 prefix per page)
    prefixes = sorted(set(MODE_BTN_RE.findall(text)))
    if not prefixes:
        return []

    for prefix in prefixes:
        base_class = f"{prefix}-mode-btn"

        # CSS guards
        has_base_rule = bool(re.search(rf"\.{re.escape(base_class)}\s*\{{", text))
        has_active_rule = bool(re.search(rf"\.{re.escape(base_class)}\.active\s*\{{", text))

        # Check for INLINE-style toggle pattern (acceptable alternative)
        # The JS may do `btn.style.background = isActive ? '...' : '...'`
        # which makes the active state visible regardless of CSS classes.
        # Pattern: prefix-mode-btn class is referenced, then within 500 chars
        # a `.style.<prop> = ` assignment appears.
        inline_toggle_pattern = re.compile(
            rf'\.{re.escape(base_class)}\b.{{0,500}}?\.style\.[a-zA-Z]+\s*=',
            re.DOTALL,
        )
        has_inline_toggle = bool(inline_toggle_pattern.search(text))

        # Dark-mode coverage: must check ONLY [data-theme="dark"] selectors,
        # NOT html:not([data-theme="dark"]) which is the inverse (light mode).
        # Scan rule-by-rule so we can prune :not(...) negations.
        has_dark_base = False
        has_dark_active = False
        for m in re.finditer(r'([^{}]*?)\{', text):
            selector = m.group(1)
            # Strip :not(...) groups so we don't match the negation.
            stripped = re.sub(r":not\([^)]*\)", "", selector)
            if '[data-theme="dark"]' not in stripped:
                continue
            if re.search(rf'\.{re.escape(base_class)}\.active\b', stripped):
                has_dark_active = True
            elif re.search(rf'\.{re.escape(base_class)}\b(?!\.active)', stripped):
                has_dark_base = True

        # HTML guard: at least 2 buttons of this class, exactly 1 with `active`
        btns = re.findall(
            rf'<button[^>]*class="[^"]*\b{re.escape(base_class)}\b[^"]*"[^>]*>',
            text,
            re.IGNORECASE,
        )
        active_btns = [b for b in btns if re.search(r'\bactive\b', b)]

        # 1) Base CSS rule must exist (unless inline-style toggle is used)
        if not has_base_rule and not has_inline_toggle:
            findings.append(
                f"  ERROR  {prefix}: .{base_class} HTML buttons exist but no base CSS rule defined."
            )

        # 2) Active CSS rule must exist (unless inline-style toggle is used)
        if not has_active_rule and btns and not has_inline_toggle:
            findings.append(
                f"  ERROR  {prefix}: no .{base_class}.active CSS rule (active state invisible)."
            )

        # 3) Dark-mode coverage: if dark base override exists, dark .active MUST also exist
        # (skip if inline-style toggle handles theming)
        if has_dark_base and not has_dark_active and not has_inline_toggle:
            findings.append(
                f"  ERROR  {prefix}: [data-theme=\"dark\"] .{base_class} overrides base background "
                f"but [data-theme=\"dark\"] .{base_class}.active is MISSING. "
                "Active gradient will be invisible in dark mode (specificity tie, later wins)."
            )

        # 4) HTML: at least 2 buttons
        if len(btns) >= 1 and len(btns) < 2:
            findings.append(
                f"  WARN   {prefix}: only {len(btns)} .{base_class} button(s) found; "
                "mode-bar pattern expects ≥2 (Free + Pro)."
            )

        # 5) HTML: exactly 1 active button at page load
        if len(btns) >= 2 and len(active_btns) != 1:
            findings.append(
                f"  ERROR  {prefix}: expected exactly 1 .{base_class} with `active` class at "
                f"page load, found {len(active_btns)}."
            )

    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strict", action="store_true",
                        help="Exit non-zero if any ERROR is found.")
    args = parser.parse_args()

    files = find_html_files()
    total_pages = 0
    errored_pages: list[Path] = []
    warned_pages: list[Path] = []
    total_errors = 0

    print("=" * 64)
    print("Pro/Free mode-bar indicator audit")
    print("=" * 64)

    for path in sorted(files):
        findings = audit_page(path)
        if findings:
            total_pages += 1
            has_error = any("ERROR" in f for f in findings)
            has_warn = any("WARN " in f for f in findings)
            if has_error:
                errored_pages.append(path)
                total_errors += sum(1 for f in findings if "ERROR" in f)
            if has_warn:
                warned_pages.append(path)
            tag = "[ERROR]" if has_error else "[WARN] "
            print(f"{tag} {path.name}")
            for finding in findings:
                print(finding)
        else:
            total_pages += 1

    print()
    print(f"Audited:           {len(files)} HTML pages")
    print(f"Pages with mode-bar pattern flagged: {len(errored_pages) + len(warned_pages)}")
    print(f"Pages with ERRORS: {len(errored_pages)}")
    print(f"Total ERRORS:      {total_errors}")
    if not errored_pages and not warned_pages:
        print("CLEAN — every mode-bar passes Pro-mode indicator discipline")

    if args.strict and total_errors:
        print()
        print(f"STRICT FAIL: {total_errors} error(s) on {len(errored_pages)} page(s)")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
