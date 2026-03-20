"""X (Twitter) adapter — Selenium Firefox with cookie injection."""
from __future__ import annotations

import json
import time
from pathlib import Path

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

from .common import (
    add_cookies,
    build_driver,
    capture,
    find_drafts,
    load_cookie_snapshot,
    read_draft,
    safe_click,
    type_rich_text,
    wait_until,
)

X_PROFILE_URL = "https://x.com/bagusdwiperman9"


def _post_single(
    driver,
    text: str,
    out_dir: Path,
    post_index: int = 1,
) -> dict:
    """Compose and post a single tweet. Returns result dict."""
    tag = f"x_post_{post_index}"
    driver.get("https://x.com/compose/post")
    time.sleep(4)

    # Wait for composer
    wait = WebDriverWait(driver, 60)
    try:
        editor = wait.until(
            lambda d: d.find_element(
                By.CSS_SELECTOR,
                "[data-testid='tweetTextarea_0'][contenteditable='true']",
            )
        )
    except Exception:
        capture(driver, f"{tag}_compose_fail", out_dir)
        return {"ok": False, "error": "Composer did not load", "index": post_index}

    type_rich_text(driver, editor, text)
    time.sleep(1)

    # Verify text was inserted
    try:
        wait_until(
            lambda: text[:24] in (editor.get_attribute("textContent") or ""),
            timeout=20,
        )
    except Exception:
        capture(driver, f"{tag}_text_fail", out_dir)
        return {"ok": False, "error": "Text not inserted into editor", "index": post_index}

    # Find enabled Post button
    try:
        button = wait_until(
            lambda: next(
                (
                    el
                    for el in driver.find_elements(
                        By.CSS_SELECTOR,
                        "[data-testid='tweetButtonInline'], [data-testid='tweetButton']",
                    )
                    if el.is_displayed()
                    and el.get_attribute("aria-disabled") != "true"
                    and el.get_attribute("disabled") is None
                ),
                None,
            ),
            timeout=30,
        )
    except Exception:
        capture(driver, f"{tag}_btn_fail", out_dir)
        return {"ok": False, "error": "Post button not found or disabled", "index": post_index}

    safe_click(driver, button)
    time.sleep(8)
    capture(driver, f"{tag}_posted", out_dir)

    return {"ok": True, "index": post_index}


def _verify_posts(driver, texts: list[str], out_dir: Path) -> dict:
    """Go to profile and check if posts appear."""
    driver.get(X_PROFILE_URL)
    time.sleep(8)
    capture(driver, "x_verify", out_dir)
    source = driver.page_source
    verified = []
    for i, text in enumerate(texts, 1):
        first_line = text.splitlines()[0][:60]
        verified.append({
            "index": i,
            "found": first_line in source,
            "snippet": first_line,
        })
    all_ok = all(v["found"] for v in verified)
    return {"ok": all_ok, "verified": verified, "url": driver.current_url}


def post_from_drafts(
    cookie_file: str | Path,
    draft_dir: str | Path,
    out_dir: str | Path,
) -> dict:
    """Post all X drafts found in *draft_dir*.

    Looks for:
      - x-post.txt (single post)
      - x-post-1.txt, x-post-2.txt, ... (multiple posts)
    """
    drafts = find_drafts(draft_dir, "x-post")
    if not drafts:
        return {"ok": False, "error": "No X draft files found", "posts": []}

    texts = [read_draft(p) for p in drafts]
    texts = [t for t in texts if t]

    if not texts:
        return {"ok": False, "error": "All X drafts were empty", "posts": []}

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    print(f"  Found {len(texts)} X post(s) to publish")

    snapshot = load_cookie_snapshot(cookie_file)
    driver = build_driver()
    results = []

    try:
        # Inject cookies
        add_cookies(driver, snapshot, "x.com", "https://x.com/")
        add_cookies(driver, snapshot, "twitter.com", "https://twitter.com/")
        time.sleep(2)

        for i, text in enumerate(texts, 1):
            print(f"  Posting X #{i}/{len(texts)}...")
            result = _post_single(driver, text, out, post_index=i)
            results.append(result)
            if not result["ok"]:
                print(f"  X post #{i} failed: {result.get('error')}")
            if i < len(texts):
                time.sleep(3)  # gap between posts

        # Verify
        print("  Verifying X posts on profile...")
        verification = _verify_posts(driver, texts, out)

        overall = {
            "ok": all(r["ok"] for r in results) and verification["ok"],
            "posts": results,
            "verification": verification,
            "count": len(results),
        }
        (out / "result.json").write_text(json.dumps(overall, indent=2), encoding="utf-8")
        return overall

    except Exception as exc:
        capture(driver, "x_error", out)
        return {"ok": False, "error": str(exc), "posts": results}
    finally:
        driver.quit()


def verify_from_drafts(
    cookie_file: str | Path,
    draft_dir: str | Path,
    out_dir: str | Path,
) -> dict:
    """Verify X posts exist on profile without posting."""
    drafts = find_drafts(draft_dir, "x-post")
    if not drafts:
        return {"ok": False, "error": "No X draft files found"}

    texts = [read_draft(p) for p in drafts]
    texts = [t for t in texts if t]

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    snapshot = load_cookie_snapshot(cookie_file)
    driver = build_driver()

    try:
        add_cookies(driver, snapshot, "x.com", "https://x.com/")
        add_cookies(driver, snapshot, "twitter.com", "https://twitter.com/")
        result = _verify_posts(driver, texts, out)
        (out / "verify_result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
        return result
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    finally:
        driver.quit()
