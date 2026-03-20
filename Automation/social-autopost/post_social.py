#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path


ROOT = Path("/home/baguspermana7/rz-work/Automation/social-autopost")
BACKEND = ROOT / "scripts" / "firefox_publish_article17.py"
DEFAULT_DRAFT_DIR = Path("/home/baguspermana7/rz-work/Article/Post Draft/Article 17 - SEA DC Opportunity")
DEFAULT_COOKIE_SNAPSHOT = Path("/home/baguspermana7/session_cookies_article17.json")
DEFAULT_ARTIFACT_ROOT = ROOT / "artifacts"
SUPPORTED_POST = {"x", "quora"}
PLANNED_ONLY = {"mastodon"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Reusable AI social autopost CLI.")
    sub = parser.add_subparsers(dest="command", required=True)

    def add_common(cmd: argparse.ArgumentParser) -> None:
        cmd.add_argument("--draft-dir", type=Path, default=DEFAULT_DRAFT_DIR)
        cmd.add_argument("--cookie-snapshot", type=Path, default=DEFAULT_COOKIE_SNAPSHOT)
        cmd.add_argument("--artifact-root", type=Path, default=DEFAULT_ARTIFACT_ROOT)
        cmd.add_argument("--platforms", default="x,quora,mastodon")
        cmd.add_argument(
            "--quora-verify-urls",
            default="https://www.quora.com/profile/Bagus-Dwi-Permana-1/posts",
        )
        cmd.add_argument("--json", action="store_true")

    add_common(sub.add_parser("plan", help="Inspect drafts and print the execution plan."))
    add_common(sub.add_parser("post", help="Post supported platforms using the configured backend."))
    add_common(sub.add_parser("verify", help="Verify supported platforms without posting."))
    report = sub.add_parser("report", help="Read a prior run manifest and print a summary.")
    report.add_argument("--run-dir", type=Path, required=True)
    report.add_argument("--json", action="store_true")

    return parser.parse_args()


def selected_platforms(value: str) -> list[str]:
    raw = [item.strip().lower() for item in value.split(",") if item.strip()]
    if "all" in raw:
        return ["mastodon", "x", "quora"]
    return raw


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8").strip()


def draft_summary(draft_dir: Path) -> dict:
    mastodon_parts = sorted(draft_dir.glob("mastodon-post-*.txt"))
    data = {
        "x": {
            "exists": (draft_dir / "x-post.txt").exists(),
            "path": str(draft_dir / "x-post.txt"),
            "length": len(read_text(draft_dir / "x-post.txt")) if (draft_dir / "x-post.txt").exists() else None,
            "recommended_method": "firefox_selenium",
        },
        "mastodon": {
            "exists": bool(mastodon_parts),
            "paths": [str(p) for p in mastodon_parts],
            "lengths": [len(read_text(p)) for p in mastodon_parts],
            "recommended_method": "api_first_browser_fallback",
        },
        "quora": {
            "exists": (draft_dir / "quora-post.txt").exists(),
            "path": str(draft_dir / "quora-post.txt"),
            "length": len(read_text(draft_dir / "quora-post.txt")) if (draft_dir / "quora-post.txt").exists() else None,
            "recommended_method": "firefox_selenium_strict_verify",
        },
    }
    return data


def build_env(args: argparse.Namespace, artifact_dir: Path) -> dict[str, str]:
    env = os.environ.copy()
    env["SOCIAL_DRAFT_BASE"] = str(args.draft_dir)
    env["SOCIAL_COOKIE_SNAPSHOT"] = str(args.cookie_snapshot)
    env["SOCIAL_ARTIFACT_DIR"] = str(artifact_dir)
    env["SOCIAL_QUORA_VERIFY_URLS"] = args.quora_verify_urls
    return env


def parse_last_json(stdout: str) -> dict:
    start = stdout.rfind("\n{")
    if start == -1:
        start = stdout.find("{")
    else:
        start += 1
    if start == -1:
        raise ValueError("No JSON block found in command output.")
    return json.loads(stdout[start:])


def run_backend(mode: str, args: argparse.Namespace, artifact_dir: Path) -> dict:
    cmd = [sys.executable, str(BACKEND), mode]
    completed = subprocess.run(
        cmd,
        text=True,
        capture_output=True,
        env=build_env(args, artifact_dir),
        check=False,
    )
    output = (completed.stdout or "") + (completed.stderr or "")
    (artifact_dir / f"{mode}.log").write_text(output, encoding="utf-8")
    result = {
        "mode": mode,
        "exit_code": completed.returncode,
        "ok": False,
    }
    try:
        parsed = parse_last_json(completed.stdout or "")
        result["result"] = parsed
        result["ok"] = completed.returncode == 0 and any(v.get("ok") for v in parsed.values())
    except Exception as exc:  # noqa: BLE001
        result["parse_error"] = str(exc)
    return result


def ensure_run_dir(artifact_root: Path, prefix: str) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    run_dir = artifact_root / f"{prefix}-{stamp}"
    run_dir.mkdir(parents=True, exist_ok=True)
    return run_dir


def command_plan(args: argparse.Namespace) -> int:
    platforms = selected_platforms(args.platforms)
    summary = draft_summary(args.draft_dir)
    payload = {
        "draft_dir": str(args.draft_dir),
        "platforms": platforms,
        "support_matrix": {
            "post_supported": sorted(SUPPORTED_POST),
            "planned_only": sorted(PLANNED_ONLY),
        },
        "drafts": {platform: summary[platform] for platform in platforms if platform in summary},
        "notes": [
            "Quora must be treated as complete only if the post appears in the canonical profile/posts verification URL.",
            "Mastodon remains API-first in the playbook, but the reusable CLI does not yet ship the API adapter.",
        ],
    }
    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        print(f"Draft dir: {payload['draft_dir']}")
        print(f"Platforms: {', '.join(platforms)}")
        for platform in platforms:
            item = payload["drafts"].get(platform)
            if not item:
                continue
            print(f"- {platform}: exists={item['exists']} method={item['recommended_method']}")
        print("Post-supported:", ", ".join(payload["support_matrix"]["post_supported"]))
        print("Planned-only:", ", ".join(payload["support_matrix"]["planned_only"]))
    return 0


def command_post(args: argparse.Namespace) -> int:
    platforms = selected_platforms(args.platforms)
    run_dir = ensure_run_dir(args.artifact_root, "post")
    manifest = {
        "command": "post",
        "draft_dir": str(args.draft_dir),
        "run_dir": str(run_dir),
        "platforms": platforms,
        "results": {},
    }
    for platform in platforms:
        artifact_dir = run_dir / platform
        artifact_dir.mkdir(parents=True, exist_ok=True)
        if platform == "x":
            manifest["results"][platform] = run_backend("x", args, artifact_dir)
        elif platform == "quora":
            manifest["results"][platform] = run_backend("quoraPost", args, artifact_dir)
        elif platform == "mastodon":
            manifest["results"][platform] = {
                "ok": False,
                "status": "not_implemented",
                "reason": "Mastodon adapter is documented but not yet extracted into this reusable CLI.",
            }
        else:
            manifest["results"][platform] = {"ok": False, "status": "unknown_platform"}
    (run_dir / "run.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    if args.json:
        print(json.dumps(manifest, indent=2))
    else:
        print(f"Run dir: {run_dir}")
        for platform, result in manifest["results"].items():
            print(f"- {platform}: ok={result.get('ok')} status={result.get('status', 'executed')}")
    return 0


def command_verify(args: argparse.Namespace) -> int:
    platforms = selected_platforms(args.platforms)
    run_dir = ensure_run_dir(args.artifact_root, "verify")
    manifest = {
        "command": "verify",
        "draft_dir": str(args.draft_dir),
        "run_dir": str(run_dir),
        "platforms": platforms,
        "results": {},
    }
    for platform in platforms:
        artifact_dir = run_dir / platform
        artifact_dir.mkdir(parents=True, exist_ok=True)
        if platform == "x":
            manifest["results"][platform] = run_backend("xVerify", args, artifact_dir)
        elif platform == "quora":
            manifest["results"][platform] = run_backend("quoraVerify", args, artifact_dir)
        elif platform == "mastodon":
            manifest["results"][platform] = {
                "ok": False,
                "status": "not_implemented",
                "reason": "Verification is not yet implemented for Mastodon in this reusable CLI.",
            }
        else:
            manifest["results"][platform] = {"ok": False, "status": "unknown_platform"}
    (run_dir / "run.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    if args.json:
        print(json.dumps(manifest, indent=2))
    else:
        print(f"Run dir: {run_dir}")
        for platform, result in manifest["results"].items():
            print(f"- {platform}: ok={result.get('ok')} status={result.get('status', 'executed')}")
    return 0


def command_report(args: argparse.Namespace) -> int:
    run_json = args.run_dir / "run.json"
    manifest = json.loads(run_json.read_text(encoding="utf-8"))
    if args.json:
        print(json.dumps(manifest, indent=2))
        return 0

    print(f"Command: {manifest['command']}")
    print(f"Draft dir: {manifest['draft_dir']}")
    print(f"Run dir: {manifest['run_dir']}")
    for platform, result in manifest["results"].items():
        status = "ok" if result.get("ok") else "failed"
        reason = result.get("reason") or result.get("status") or ""
        print(f"- {platform}: {status} {reason}".rstrip())
    return 0


def main() -> int:
    args = parse_args()
    if args.command == "plan":
        return command_plan(args)
    if args.command == "post":
        return command_post(args)
    if args.command == "verify":
        return command_verify(args)
    if args.command == "report":
        return command_report(args)
    raise ValueError(f"Unsupported command: {args.command}")


if __name__ == "__main__":
    raise SystemExit(main())
