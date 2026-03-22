#!/usr/bin/env python3
"""Unified social media autopost CLI.

Usage:
    python post_social.py plan   --draft-dir <path> [--platforms x,mastodon,quora,facebook]
    python post_social.py post   --draft-dir <path> [--platforms x,mastodon,quora,facebook]
    python post_social.py verify --draft-dir <path> [--platforms x,mastodon,quora,facebook]
    python post_social.py report --run-dir <path>

Platforms:
    mastodon  — API-first (requires MASTODON_ACCESS_TOKEN in .env)
    x         — Selenium Firefox + cookie injection
    quora     — Selenium Firefox, semi-auto with CAPTCHA checkpoint
    facebook  — Selenium Firefox + cookie injection (uses LinkedIn draft text)

Environment:
    Reads .env from the script directory for MASTODON_ACCESS_TOKEN, etc.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ENV_FILE = ROOT / ".env"

# Defaults
DEFAULT_COOKIE_FILE = Path("/home/baguspermana7/session_cookies_article17.json")
DEFAULT_ARTIFACT_ROOT = ROOT / "artifacts"
MASTODON_INSTANCE = "https://mastodon.social"
ALL_PLATFORMS = ["mastodon", "x", "quora", "facebook"]


# ---------------------------------------------------------------------------
# .env loader
# ---------------------------------------------------------------------------

def load_dotenv(path: Path = ENV_FILE) -> None:
    """Load KEY=VALUE pairs from .env into os.environ (no overwrite)."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip("'\"")
        if key and key not in os.environ:
            os.environ[key] = value


# ---------------------------------------------------------------------------
# Draft detection
# ---------------------------------------------------------------------------

def detect_drafts(draft_dir: Path) -> dict:
    """Scan *draft_dir* and return a summary of available drafts per platform."""
    # Import here to avoid import errors when just running --help
    sys.path.insert(0, str(ROOT))
    from scripts.common import find_drafts

    summary = {}
    for platform, prefixes in [
        ("mastodon", ["mastodon-post", "mastodon"]),
        ("x", ["x-post"]),
        ("quora", ["quora-post", "quora-draft", "quora"]),
        ("facebook", ["linkedin-post", "facebook-post", "linkedin"]),
    ]:
        files = []
        for prefix in prefixes:
            files = find_drafts(draft_dir, prefix)
            if files:
                break
        summary[platform] = {
            "exists": bool(files),
            "count": len(files),
            "files": [str(f.name) for f in files],
        }
    return summary


# ---------------------------------------------------------------------------
# CLI argument parsing
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Unified social media autopost CLI.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    sub = parser.add_subparsers(dest="command", required=True)

    def add_common(cmd: argparse.ArgumentParser) -> None:
        cmd.add_argument(
            "--draft-dir", type=Path, required=True,
            help="Directory containing platform draft files",
        )
        cmd.add_argument(
            "--platforms", default="all",
            help="Comma-separated: mastodon,x,quora or 'all' (default: all)",
        )
        cmd.add_argument(
            "--cookie-file", type=Path, default=DEFAULT_COOKIE_FILE,
            help="Firefox cookie JSON snapshot for Selenium platforms",
        )
        cmd.add_argument(
            "--artifact-root", type=Path, default=DEFAULT_ARTIFACT_ROOT,
            help="Root directory for run artifacts",
        )
        cmd.add_argument(
            "--image", type=Path, default=None,
            help="Hero image to attach (used for Quora and Mastodon media posts)",
        )
        cmd.add_argument("--json", action="store_true", help="Output JSON")

    add_common(sub.add_parser("plan", help="Show execution plan without posting"))
    add_common(sub.add_parser("post", help="Post to selected platforms"))
    add_common(sub.add_parser("verify", help="Verify posts exist without posting"))

    report = sub.add_parser("report", help="Show results from a previous run")
    report.add_argument("--run-dir", type=Path, required=True)
    report.add_argument("--json", action="store_true")

    return parser.parse_args()


def selected_platforms(value: str) -> list[str]:
    raw = [p.strip().lower() for p in value.split(",") if p.strip()]
    if "all" in raw:
        return ALL_PLATFORMS
    return [p for p in raw if p in ALL_PLATFORMS]


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def command_plan(args: argparse.Namespace) -> int:
    platforms = selected_platforms(args.platforms)
    summary = detect_drafts(args.draft_dir)

    mastodon_token = os.environ.get("MASTODON_ACCESS_TOKEN", "")
    payload = {
        "draft_dir": str(args.draft_dir),
        "platforms": platforms,
        "drafts": {p: summary[p] for p in platforms if p in summary},
        "readiness": {
            "mastodon": {
                "method": "API",
                "token_set": bool(mastodon_token),
                "instance": MASTODON_INSTANCE,
            },
            "x": {
                "method": "Selenium Firefox + cookies",
                "cookie_file": str(args.cookie_file),
                "cookie_exists": args.cookie_file.exists(),
            },
            "quora": {
                "method": "Selenium Firefox + cookies (semi-auto)",
                "cookie_file": str(args.cookie_file),
                "cookie_exists": args.cookie_file.exists(),
                "note": "Requires human for CAPTCHA/Cloudflare",
            },
            "facebook": {
                "method": "Selenium Firefox + cookies",
                "cookie_file": str(args.cookie_file),
                "cookie_exists": args.cookie_file.exists(),
                "note": "Uses LinkedIn draft text",
            },
        },
    }

    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        print(f"Draft dir : {args.draft_dir}")
        print(f"Platforms : {', '.join(platforms)}")
        print()
        for p in platforms:
            d = summary.get(p, {})
            r = payload["readiness"].get(p, {})
            status = "READY" if d.get("exists") else "NO DRAFTS"
            if p == "mastodon" and not mastodon_token:
                status = "NO TOKEN"
            elif p in ("x", "quora") and not args.cookie_file.exists():
                status = "NO COOKIES"
            print(f"  {p:10s} [{status:10s}] {d.get('count', 0)} file(s)  via {r.get('method', '?')}")
            for f in d.get("files", []):
                print(f"             - {f}")
        print()
    return 0


def command_post(args: argparse.Namespace) -> int:
    platforms = selected_platforms(args.platforms)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    run_dir = args.artifact_root / f"post-{stamp}"
    run_dir.mkdir(parents=True, exist_ok=True)

    manifest = {
        "command": "post",
        "timestamp": stamp,
        "draft_dir": str(args.draft_dir),
        "run_dir": str(run_dir),
        "platforms": platforms,
        "results": {},
    }

    for platform in platforms:
        out_dir = run_dir / platform
        out_dir.mkdir(parents=True, exist_ok=True)
        print(f"\n{'='*50}")
        print(f"  POSTING: {platform.upper()}")
        print(f"{'='*50}")

        if platform == "mastodon":
            token = os.environ.get("MASTODON_ACCESS_TOKEN", "")
            if not token:
                manifest["results"][platform] = {
                    "ok": False,
                    "error": "MASTODON_ACCESS_TOKEN not set in .env",
                }
                continue
            from scripts.mastodon_adapter import post_from_drafts as mastodon_post
            manifest["results"][platform] = mastodon_post(
                MASTODON_INSTANCE, token, args.draft_dir, out_dir,
            )

        elif platform == "x":
            if not args.cookie_file.exists():
                manifest["results"][platform] = {
                    "ok": False,
                    "error": f"Cookie file not found: {args.cookie_file}",
                }
                continue
            from scripts.x_adapter import post_from_drafts as x_post
            manifest["results"][platform] = x_post(
                args.cookie_file, args.draft_dir, out_dir,
            )

        elif platform == "quora":
            if not args.cookie_file.exists():
                manifest["results"][platform] = {
                    "ok": False,
                    "error": f"Cookie file not found: {args.cookie_file}",
                }
                continue
            from scripts.quora_adapter import post_from_drafts as quora_post
            manifest["results"][platform] = quora_post(
                args.cookie_file, args.draft_dir, out_dir,
                image_path=getattr(args, "image", None),
            )

        elif platform == "facebook":
            if not args.cookie_file.exists():
                manifest["results"][platform] = {
                    "ok": False,
                    "error": f"Cookie file not found: {args.cookie_file}",
                }
                continue
            from scripts.facebook_adapter import post_from_drafts as fb_post
            manifest["results"][platform] = fb_post(
                args.cookie_file, args.draft_dir, out_dir,
                image_path=getattr(args, "image", None),
            )

    # Save manifest
    (run_dir / "run.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    # Print summary
    print(f"\n{'='*50}")
    print("  RESULTS")
    print(f"{'='*50}")
    print(f"Run dir: {run_dir}")
    for platform, result in manifest["results"].items():
        ok = result.get("ok", False)
        icon = "OK" if ok else "FAIL"
        urls = result.get("urls", [])
        error = result.get("error", "")
        print(f"  {platform:10s} [{icon:4s}]  {error}")
        for url in urls:
            print(f"             -> {url}")
    print()

    if args.json:
        print(json.dumps(manifest, indent=2))

    return 0 if all(r.get("ok") for r in manifest["results"].values()) else 1


def command_verify(args: argparse.Namespace) -> int:
    platforms = selected_platforms(args.platforms)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    run_dir = args.artifact_root / f"verify-{stamp}"
    run_dir.mkdir(parents=True, exist_ok=True)

    manifest = {
        "command": "verify",
        "timestamp": stamp,
        "draft_dir": str(args.draft_dir),
        "run_dir": str(run_dir),
        "platforms": platforms,
        "results": {},
    }

    for platform in platforms:
        out_dir = run_dir / platform
        out_dir.mkdir(parents=True, exist_ok=True)
        print(f"  Verifying {platform}...")

        if platform == "mastodon":
            # Mastodon verification: check API for recent posts
            token = os.environ.get("MASTODON_ACCESS_TOKEN", "")
            if not token:
                manifest["results"][platform] = {"ok": False, "error": "No token"}
                continue
            try:
                from scripts.mastodon_adapter import verify_credentials
                account = verify_credentials(MASTODON_INSTANCE, token)
                manifest["results"][platform] = {
                    "ok": True,
                    "account": account.get("username"),
                    "note": "Token valid. Check profile manually for post content.",
                }
            except Exception as exc:
                manifest["results"][platform] = {"ok": False, "error": str(exc)}

        elif platform == "x":
            from scripts.x_adapter import verify_from_drafts as x_verify
            manifest["results"][platform] = x_verify(
                args.cookie_file, args.draft_dir, out_dir,
            )

        elif platform == "quora":
            from scripts.quora_adapter import verify_from_drafts as quora_verify
            manifest["results"][platform] = quora_verify(
                args.cookie_file, args.draft_dir, out_dir,
            )

        elif platform == "facebook":
            from scripts.facebook_adapter import verify_from_drafts as fb_verify
            manifest["results"][platform] = fb_verify(
                args.cookie_file, args.draft_dir, out_dir,
            )

    (run_dir / "run.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    if args.json:
        print(json.dumps(manifest, indent=2))
    else:
        print(f"\nRun dir: {run_dir}")
        for platform, result in manifest["results"].items():
            ok = result.get("ok", False)
            print(f"  {platform:10s} [{'OK' if ok else 'FAIL':4s}]  {result.get('error', '')}")
    return 0


def command_report(args: argparse.Namespace) -> int:
    run_json = args.run_dir / "run.json"
    if not run_json.exists():
        print(f"No run.json found in {args.run_dir}")
        return 1
    manifest = json.loads(run_json.read_text(encoding="utf-8"))

    if args.json:
        print(json.dumps(manifest, indent=2))
        return 0

    print(f"Command  : {manifest.get('command')}")
    print(f"Timestamp: {manifest.get('timestamp')}")
    print(f"Draft dir: {manifest.get('draft_dir')}")
    print(f"Run dir  : {manifest.get('run_dir')}")
    print()
    for platform, result in manifest.get("results", {}).items():
        ok = result.get("ok", False)
        print(f"  {platform:10s} [{'OK' if ok else 'FAIL':4s}]")
        if result.get("urls"):
            for url in result["urls"]:
                print(f"             -> {url}")
        if result.get("error"):
            print(f"             Error: {result['error']}")
        if result.get("verification"):
            v = result["verification"]
            print(f"             Verified: {v.get('ok')}")
    return 0


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    load_dotenv()
    args = parse_args()
    commands = {
        "plan": command_plan,
        "post": command_post,
        "verify": command_verify,
        "report": command_report,
    }
    handler = commands.get(args.command)
    if not handler:
        print(f"Unknown command: {args.command}")
        return 1
    return handler(args)


if __name__ == "__main__":
    raise SystemExit(main())
