#!/usr/bin/env python3
"""Export cookies from Firefox's cookies.sqlite to JSON.

Usage:
    python scripts/export_cookies.py                    # Export all cookies
    python scripts/export_cookies.py facebook.com       # Export only facebook.com
    python scripts/export_cookies.py -o cookies.json    # Specify output file

Reads from the default Firefox snap profile. Works without any browser extension.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sqlite3
import sys
import tempfile
from pathlib import Path

# Firefox snap profile path
FIREFOX_PROFILE_DIR = Path("/home/baguspermana7/snap/firefox/common/.mozilla/firefox")
DEFAULT_OUTPUT = Path("/home/baguspermana7/session_cookies_article17.json")


def find_profile_dir() -> Path:
    """Find the default Firefox profile directory."""
    # Look for *.default* directories
    candidates = sorted(FIREFOX_PROFILE_DIR.glob("*.default*"))
    if not candidates:
        # Try profiles.ini
        candidates = sorted(FIREFOX_PROFILE_DIR.glob("*"))
        candidates = [c for c in candidates if c.is_dir() and not c.name.startswith(".")]
    if not candidates:
        raise FileNotFoundError(f"No Firefox profile found in {FIREFOX_PROFILE_DIR}")
    return candidates[0]


def export_cookies(
    domain_filter: str | None = None,
    output_path: Path = DEFAULT_OUTPUT,
) -> list[dict]:
    """Export cookies from Firefox's cookies.sqlite.

    Firefox locks cookies.sqlite while running, so we copy it to a temp file first.
    """
    profile = find_profile_dir()
    cookies_db = profile / "cookies.sqlite"
    if not cookies_db.exists():
        raise FileNotFoundError(f"cookies.sqlite not found at {cookies_db}")

    # Copy to temp to avoid lock issues
    with tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    shutil.copy2(cookies_db, tmp_path)

    try:
        conn = sqlite3.connect(f"file:{tmp_path}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row

        if domain_filter:
            # Match domain and subdomains
            query = """
                SELECT * FROM moz_cookies
                WHERE host LIKE ? OR host LIKE ?
                ORDER BY host, name
            """
            rows = conn.execute(query, (f"%{domain_filter}", f"%.{domain_filter}")).fetchall()
        else:
            rows = conn.execute("SELECT * FROM moz_cookies ORDER BY host, name").fetchall()

        conn.close()
    finally:
        tmp_path.unlink(missing_ok=True)

    cookies = []
    for row in rows:
        cookie = {
            "host": row["host"],
            "name": row["name"],
            "value": row["value"],
            "path": row["path"],
            "expiry": row["expiry"],
            "isSecure": bool(row["isSecure"]),
            "isHttpOnly": bool(row["isHttpOnly"]),
            "sameSite": {0: "None", 1: "Lax", 2: "Strict"}.get(row["sameSite"], "None"),
        }
        cookies.append(cookie)

    # Write output
    output_path.write_text(json.dumps(cookies, indent=2, ensure_ascii=False), encoding="utf-8")
    return cookies


def main():
    parser = argparse.ArgumentParser(description="Export Firefox cookies to JSON")
    parser.add_argument("domain", nargs="?", default=None, help="Filter by domain (e.g. facebook.com)")
    parser.add_argument("-o", "--output", type=Path, default=DEFAULT_OUTPUT, help="Output file path")
    parser.add_argument("--append", action="store_true", help="Append to existing cookie file instead of overwriting")
    args = parser.parse_args()

    if args.append and args.output.exists():
        # Load existing cookies
        existing = json.loads(args.output.read_text(encoding="utf-8"))
        new_cookies = export_cookies(args.domain, args.output)
        # Merge: new cookies override existing ones with same host+name
        merged = {(c["host"], c["name"]): c for c in existing}
        for c in new_cookies:
            merged[(c["host"], c["name"])] = c
        all_cookies = list(merged.values())
        args.output.write_text(json.dumps(all_cookies, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Appended {len(new_cookies)} cookies (total: {len(all_cookies)}) → {args.output}")
    else:
        cookies = export_cookies(args.domain, args.output)
        print(f"Exported {len(cookies)} cookies → {args.output}")

    # Summary by domain
    domains = {}
    all_cookies = json.loads(args.output.read_text(encoding="utf-8"))
    for c in all_cookies:
        d = c["host"].lstrip(".")
        domains[d] = domains.get(d, 0) + 1
    top = sorted(domains.items(), key=lambda x: -x[1])[:15]
    print("\nTop domains:")
    for d, count in top:
        print(f"  {d:40s} {count:4d} cookies")


if __name__ == "__main__":
    main()
