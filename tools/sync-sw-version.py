#!/usr/bin/env python3
"""sync-sw-version — keep sw.js CACHE_NAME in lockstep with js/rz-version.js.

Run after every version bump. Idempotent.

Usage:
    python3 tools/sync-sw-version.py            # writes new CACHE_NAME
    python3 tools/sync-sw-version.py --dry-run  # preview only
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VERSION_FILE = ROOT / "js" / "rz-version.js"
SW_FILE = ROOT / "sw.js"


def read_version() -> str:
    content = VERSION_FILE.read_text(encoding="utf-8")
    m = re.search(r"window\.RZ_VERSION\s*=\s*['\"]([\w.\-]+)['\"]", content)
    if not m:
        sys.exit(f"[error] could not parse RZ_VERSION from {VERSION_FILE}")
    return m.group(1)


def sync_sw(version: str, dry_run: bool = False) -> bool:
    content = SW_FILE.read_text(encoding="utf-8")
    new_cache_name = f"rz-cache-v{version}"
    pattern = re.compile(r"const\s+CACHE_NAME\s*=\s*['\"]([^'\"]+)['\"]")
    m = pattern.search(content)
    if not m:
        sys.exit(f"[error] could not find CACHE_NAME in {SW_FILE}")
    old = m.group(1)
    if old == new_cache_name:
        print(f"[skip] CACHE_NAME already at '{new_cache_name}'")
        return False
    new_content = pattern.sub(f"const CACHE_NAME = '{new_cache_name}'", content, count=1)
    if dry_run:
        print(f"[dry-run] would update '{old}' -> '{new_cache_name}'")
        return False
    SW_FILE.write_text(new_content, encoding="utf-8")
    print(f"[sync] CACHE_NAME: '{old}' -> '{new_cache_name}'")
    return True


def main():
    dry = "--dry-run" in sys.argv
    version = read_version()
    print(f"Site version: {version}")
    sync_sw(version, dry_run=dry)


if __name__ == "__main__":
    main()
