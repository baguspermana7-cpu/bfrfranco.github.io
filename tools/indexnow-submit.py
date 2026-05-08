#!/usr/bin/env python3
"""
indexnow-submit.py — push changed URLs to Bing IndexNow API.
Reads changed HTML files from git diff, filters to public pages,
POSTs to https://api.indexnow.org/indexnow.

Usage:
  python3 tools/indexnow-submit.py                     # diff since HEAD~1
  python3 tools/indexnow-submit.py --since HEAD~3      # diff since 3 commits ago
  python3 tools/indexnow-submit.py --since abc1234     # diff since specific commit
  python3 tools/indexnow-submit.py --dry-run           # show URLs without submitting
  python3 tools/indexnow-submit.py --generate-key      # generate new IndexNow key

Run after each git push touching *.html files.
The IndexNow key lives at /<keyhex>.txt at site root. Bing reads this URL to verify
ownership. The key only authorises submissions for this domain, so leakage is low-impact.
"""

import os
import re
import sys
import json
import secrets
import argparse
import subprocess
import urllib.request
import urllib.error

SITE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE_URL = "https://resistancezero.com"
INDEXNOW_API = "https://api.indexnow.org/indexnow"
KEY_STORE = os.path.join(SITE_ROOT, ".indexnow-key")  # stores the key value

EXCLUDE_FILES = {
    "article-9-paper.html", "rz-ops-p7x3k9m.html",
    "google1b98e0817bd5aa88.html", "404.html",
}


def load_or_create_key():
    """Load existing IndexNow key, or generate a new one."""
    if os.path.exists(KEY_STORE):
        with open(KEY_STORE) as fh:
            key = fh.read().strip()
        if key:
            return key

    # Generate new 32-char hex key
    key = secrets.token_hex(16)  # 32 hex chars
    with open(KEY_STORE, "w") as fh:
        fh.write(key)

    # Write the key verification file at site root
    key_file = os.path.join(SITE_ROOT, f"{key}.txt")
    with open(key_file, "w") as fh:
        fh.write(key)

    print(f"Generated new IndexNow key: {key}")
    print(f"Key verification file: {key_file}")
    print(f"Bing will verify ownership at: {SITE_URL}/{key}.txt")
    print(f"Register your site at: https://www.bing.com/indexnow")
    return key


def get_key_file_path(key):
    """Return the path to the key verification .txt file."""
    return os.path.join(SITE_ROOT, f"{key}.txt")


def ensure_key_file(key):
    """Ensure the key .txt file exists at site root."""
    key_file = get_key_file_path(key)
    if not os.path.exists(key_file):
        with open(key_file, "w") as fh:
            fh.write(key)
        print(f"Created key file: {key_file}")
    return key_file


def get_changed_html_files(since_ref):
    """Get list of changed HTML files since git ref."""
    try:
        result = subprocess.run(
            ["git", "-C", SITE_ROOT, "diff", "--name-only", since_ref, "HEAD", "--", "*.html"],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode != 0:
            print(f"Warning: git diff failed: {result.stderr.strip()}")
            return []
        return [f.strip() for f in result.stdout.strip().splitlines() if f.strip()]
    except Exception as e:
        print(f"Error running git diff: {e}")
        return []


def is_public_page(filepath):
    """Check if a page should be submitted (not noindex, not excluded)."""
    fname = os.path.basename(filepath)
    if fname in EXCLUDE_FILES:
        return False
    # Check noindex meta
    try:
        with open(filepath, encoding="utf-8", errors="ignore") as fh:
            head = fh.read(3000)
        m = re.search(r'<meta[^>]+name=["\']robots["\'][^>]+content=["\']([^"\']+)["\']', head, re.IGNORECASE)
        if not m:
            m = re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']robots["\']', head, re.IGNORECASE)
        if m and "noindex" in m.group(1).lower():
            return False
    except Exception:
        pass
    return True


def submit_urls(urls, key, host):
    """POST URL list to IndexNow API."""
    payload = {
        "host": host,
        "key": key,
        "keyLocation": f"https://{host}/{key}.txt",
        "urlList": urls,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        INDEXNOW_API,
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "User-Agent": "resistancezero-indexnow-tool/1.0",
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, resp.read().decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="ignore")
    except Exception as e:
        return 0, str(e)


def main():
    parser = argparse.ArgumentParser(description="Push changed URLs to Bing IndexNow")
    parser.add_argument("--since", default="HEAD~1", help="Git ref to diff from (default: HEAD~1)")
    parser.add_argument("--dry-run", action="store_true", help="Show URLs without submitting")
    parser.add_argument("--generate-key", action="store_true", help="Generate a new IndexNow key")
    args = parser.parse_args()

    key = load_or_create_key()
    key_file = ensure_key_file(key)

    if args.generate_key:
        print(f"Current IndexNow key: {key}")
        print(f"Key file: {key_file}")
        print(f"Verification URL: {SITE_URL}/{key}.txt")
        return

    print(f"IndexNow key: {key}")
    print(f"Key verification: {SITE_URL}/{key}.txt")
    print(f"Checking changed files since: {args.since}")

    changed_files = get_changed_html_files(args.since)
    if not changed_files:
        print("No changed HTML files found.")
        return

    print(f"Changed HTML files: {len(changed_files)}")

    # Build public URLs
    public_urls = []
    for fpath in changed_files:
        # fpath may be relative like "article-1.html" or "subdir/file.html"
        fname = os.path.basename(fpath)
        full_path = os.path.join(SITE_ROOT, fpath)

        if not os.path.exists(full_path):
            print(f"  [skip] {fname} (not found — likely deleted)")
            continue

        if not is_public_page(full_path):
            print(f"  [skip] {fname} (excluded or noindex)")
            continue

        url = f"{SITE_URL}/{fname}"
        public_urls.append(url)
        print(f"  [queue] {url}")

    if not public_urls:
        print("No public pages to submit.")
        return

    print(f"\nURLs to submit: {len(public_urls)}")

    if args.dry_run:
        print("\n[DRY RUN] Would submit:")
        for url in public_urls:
            print(f"  {url}")
        return

    # Submit in batches of 10,000 (IndexNow limit)
    host = SITE_URL.replace("https://", "").replace("http://", "")
    batch_size = 10000
    for i in range(0, len(public_urls), batch_size):
        batch = public_urls[i:i + batch_size]
        status, body = submit_urls(batch, key, host)
        if status == 200:
            print(f"Success: {len(batch)} URLs submitted (HTTP {status})")
        elif status == 202:
            print(f"Accepted: {len(batch)} URLs queued (HTTP {status})")
        else:
            print(f"Error: HTTP {status} — {body[:200]}")
            sys.exit(1)

    print("\nDone. Bing (and Yandex/Seznam) will re-crawl submitted URLs within minutes to hours.")
    print("Monitor indexing at: https://www.bing.com/webmasters/")


if __name__ == "__main__":
    main()
