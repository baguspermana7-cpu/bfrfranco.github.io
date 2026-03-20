"""Mastodon adapter — API-first posting via access token."""
from __future__ import annotations

import json
import mimetypes
import time
import uuid
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from .common import find_drafts, read_draft


def _api_request(
    instance_url: str,
    endpoint: str,
    token: str,
    data: dict | None = None,
    method: str = "POST",
) -> dict:
    """Make an authenticated Mastodon API request."""
    url = f"{instance_url.rstrip('/')}{endpoint}"
    body = json.dumps(data).encode("utf-8") if data else None
    req = Request(url, data=body, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    if data:
        req.add_header("Content-Type", "application/json")
    with urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def upload_media(
    instance_url: str,
    token: str,
    file_path: str | Path,
    description: str = "",
) -> dict:
    """Upload a media file to Mastodon. Returns media attachment object with 'id'."""
    path = Path(file_path)
    mime_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    boundary = uuid.uuid4().hex

    # Build multipart/form-data body
    parts = []
    # File part
    parts.append(f"--{boundary}\r\n".encode())
    parts.append(f'Content-Disposition: form-data; name="file"; filename="{path.name}"\r\n'.encode())
    parts.append(f"Content-Type: {mime_type}\r\n\r\n".encode())
    parts.append(path.read_bytes())
    parts.append(b"\r\n")
    # Description part
    if description:
        parts.append(f"--{boundary}\r\n".encode())
        parts.append(b'Content-Disposition: form-data; name="description"\r\n\r\n')
        parts.append(description.encode("utf-8"))
        parts.append(b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())

    body = b"".join(parts)
    url = f"{instance_url.rstrip('/')}/api/v2/media"
    req = Request(url, data=body, method="POST")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")

    with urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def verify_credentials(instance_url: str, token: str) -> dict:
    """Verify that the access token is valid. Returns account info."""
    return _api_request(instance_url, "/api/v1/accounts/verify_credentials", token, method="GET")


def post_status(
    instance_url: str,
    token: str,
    text: str,
    in_reply_to_id: str | None = None,
    media_ids: list[str] | None = None,
    visibility: str = "public",
) -> dict:
    """Post a single status. Returns the status object."""
    payload = {
        "status": text,
        "visibility": visibility,
    }
    if in_reply_to_id:
        payload["in_reply_to_id"] = in_reply_to_id
    if media_ids:
        payload["media_ids"] = media_ids
    return _api_request(instance_url, "/api/v1/statuses", token, data=payload)


def post_thread(
    instance_url: str,
    token: str,
    texts: list[str],
    visibility: str = "public",
    delay: float = 2.0,
) -> list[dict]:
    """Post a thread (multiple statuses chained via in_reply_to_id)."""
    results = []
    reply_to = None
    for i, text in enumerate(texts):
        print(f"  Posting mastodon status {i+1}/{len(texts)}...")
        status = post_status(instance_url, token, text, in_reply_to_id=reply_to, visibility=visibility)
        results.append(status)
        reply_to = status["id"]
        if i < len(texts) - 1:
            time.sleep(delay)
    return results


def post_from_drafts(
    instance_url: str,
    token: str,
    draft_dir: str | Path,
    out_dir: str | Path | None = None,
) -> dict:
    """Post all mastodon drafts found in *draft_dir*.

    Looks for:
      - mastodon-post.txt / mastodon-post.md (single post)
      - mastodon-post-1.txt, mastodon-post-2.txt, ... (thread)
      - mastodon-1.txt, mastodon-2.txt, ... (alternative naming)

    Note: Mastodon auto-generates Open Graph link preview cards from URLs
    in the post text, so no image upload is needed.

    Returns a result dict with status and URLs.
    """
    # Find draft files
    drafts = find_drafts(draft_dir, "mastodon-post")
    if not drafts:
        drafts = find_drafts(draft_dir, "mastodon")
    if not drafts:
        return {"ok": False, "error": "No mastodon draft files found", "urls": []}

    texts = [read_draft(p) for p in drafts]
    texts = [t for t in texts if t]  # filter empties

    if not texts:
        return {"ok": False, "error": "All mastodon drafts were empty", "urls": []}

    print(f"  Found {len(texts)} mastodon post(s) to publish")

    try:
        # Verify token first
        account = verify_credentials(instance_url, token)
        print(f"  Authenticated as @{account.get('username', '?')}@{instance_url.split('//')[1]}")

        if len(texts) == 1:
            status = post_status(instance_url, token, texts[0])
            urls = [status["url"]]
        else:
            statuses = post_thread(instance_url, token, texts)
            urls = [s["url"] for s in statuses]

        result = {"ok": True, "urls": urls, "count": len(urls)}

        # Save artifact
        if out_dir:
            out = Path(out_dir)
            out.mkdir(parents=True, exist_ok=True)
            (out / "result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")

        return result

    except HTTPError as exc:
        error_body = ""
        try:
            error_body = exc.read().decode("utf-8")
        except Exception:
            pass
        return {"ok": False, "error": f"HTTP {exc.code}: {error_body}", "urls": []}
    except Exception as exc:
        return {"ok": False, "error": str(exc), "urls": []}
