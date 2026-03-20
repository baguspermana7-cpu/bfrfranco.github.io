"""Quora adapter — Selenium Firefox with CAPTCHA/Cloudflare checkpoint."""
from __future__ import annotations

import json
import re
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
    try_solve_cloudflare,
    type_rich_text,
    wait_for_human,
    wait_no_cloudflare,
    wait_until,
)

QUORA_VERIFY_URL = "https://www.quora.com/profile/Bagus-Dwi-Permana-1/posts"


def _check_cloudflare(driver) -> bool:
    """Return True if Cloudflare challenge is detected."""
    src = driver.page_source[:6000]
    return (
        "Cloudflare" in src
        or "challenge" in src.lower()[:2000]
        or "captcha" in src.lower()[:2000]
    )


def _quora_home(driver, snapshot: list[dict], out_dir: Path) -> None:
    """Navigate to Quora home with cookies and handle Cloudflare."""
    add_cookies(driver, snapshot, "quora.com", "https://www.quora.com/")
    driver.get("https://id.quora.com/")
    time.sleep(7)

    if _check_cloudflare(driver):
        capture(driver, "quora_cloudflare", out_dir)
        # Try auto-solve first
        if not try_solve_cloudflare(driver, out_dir):
            # Fall back to human checkpoint
            wait_for_human(
                driver,
                "Cloudflare detected on Quora. Auto-solve failed. Please solve manually.",
                timeout=300,
            )

    try:
        wait_no_cloudflare(driver, timeout=15)
    except Exception:
        pass

    capture(driver, "quora_home", out_dir)


def _upload_image(driver, image_path: str | Path, out_dir: Path) -> bool:
    """Upload an image to the Quora composer.

    The Quora post composer has an image icon button at the bottom-left
    of the modal. Clicking it creates a hidden <input type="file">.

    Strategies (in order):
    1. Click the bottom-left image button in the composer, then send file to input
    2. Find any existing <input type="file"> and send the file path directly
    3. Scan all buttons/icons for image-related elements

    Returns True if upload appears successful.
    """
    abs_path = str(Path(image_path).resolve())
    print(f"    Uploading image: {Path(abs_path).name}")

    def _try_send_file() -> bool:
        """Find a file input and send the image path to it."""
        time.sleep(1)
        file_inputs = driver.find_elements(By.CSS_SELECTOR, "input[type='file']")
        for fi in file_inputs:
            try:
                driver.execute_script(
                    "arguments[0].style.display='block';"
                    "arguments[0].style.opacity='1';"
                    "arguments[0].style.height='1px';"
                    "arguments[0].style.width='1px';",
                    fi,
                )
                fi.send_keys(abs_path)
                time.sleep(5)
                return True
            except Exception:
                continue
        return False

    # Strategy 1: Click the bottom-left image icon in the composer modal.
    # Quora renders these as SVG icons or small icon buttons at the bottom
    # of the composer. Look for clickable elements near the bottom of the
    # modal that contain image/photo SVG paths or aria labels.
    try:
        # Common selectors for Quora's composer bottom toolbar
        icon_selectors = [
            # Quora icon action bar (bottom-left of modal)
            "[class*='icon_action_bar'] [class*='icon']",
            "[class*='icon_action_bar'] button",
            "[class*='icon_action_bar'] svg",
            # Generic toolbar with image icon
            "[class*='toolbar'] [class*='image']",
            "[class*='ToolbarButton']",
            # Aria labels
            "button[aria-label*='image' i]",
            "button[aria-label*='Gambar' i]",
            "button[aria-label*='photo' i]",
            "button[aria-label*='Foto' i]",
            # SVG icons inside buttons at bottom of modal
            ".modal_content button svg",
            ".modal_content [role='button'] svg",
        ]
        for selector in icon_selectors:
            elements = driver.find_elements(By.CSS_SELECTOR, selector)
            for el in elements:
                if not el.is_displayed():
                    continue
                # Check if this looks like an image icon (SVG path, aria, class)
                outer = el.get_attribute("outerHTML") or ""
                aria = el.get_attribute("aria-label") or ""
                # Image icons typically have path data for a mountain/photo icon
                # or contain keywords
                is_image_icon = any(kw in (outer + aria).lower() for kw in [
                    "image", "photo", "picture", "gambar", "foto",
                    "m 4 4", "m4 4",  # common SVG photo icon path prefix
                    "landscape", "insert_photo",
                ])
                if not is_image_icon:
                    continue
                print(f"    Found image icon button, clicking...")
                try:
                    safe_click(driver, el)
                except Exception:
                    # If SVG, click parent button
                    parent = driver.execute_script("return arguments[0].closest('button') || arguments[0].parentElement;", el)
                    if parent:
                        safe_click(driver, parent)
                time.sleep(2)
                capture(driver, "quora_img_btn_clicked", out_dir)
                if _try_send_file():
                    capture(driver, "quora_img_uploaded", out_dir)
                    print("    Image upload successful (icon button)")
                    return True
        # If no icon found yet, also try: any small button/div in the bottom
        # area of the visible modal
        modal = None
        for sel in [".modal_content", "[class*='Modal']", "[role='dialog']"]:
            modals = driver.find_elements(By.CSS_SELECTOR, sel)
            for m in modals:
                if m.is_displayed():
                    modal = m
                    break
            if modal:
                break
        if modal:
            # Get all small clickable things at the bottom
            children = modal.find_elements(By.CSS_SELECTOR, "button, [role='button'], svg")
            modal_rect = modal.rect
            bottom_zone_y = modal_rect["y"] + modal_rect["height"] * 0.7
            for child in children:
                if not child.is_displayed():
                    continue
                child_rect = child.rect
                # Bottom-left quadrant: x < 50% of modal width, y > 70% of modal height
                if child_rect["y"] >= bottom_zone_y and child_rect["x"] < modal_rect["x"] + modal_rect["width"] * 0.5:
                    print(f"    Clicking bottom-left element at ({child_rect['x']}, {child_rect['y']})...")
                    safe_click(driver, child)
                    time.sleep(2)
                    if _try_send_file():
                        capture(driver, "quora_img_uploaded", out_dir)
                        print("    Image upload successful (bottom-left click)")
                        return True
    except Exception as exc:
        print(f"    Strategy 1 failed: {exc}")

    # Strategy 2: File input already exists (some Quora versions have it pre-rendered)
    if _try_send_file():
        capture(driver, "quora_img_uploaded_direct", out_dir)
        print("    Image upload successful (direct file input)")
        return True

    print("    Image upload: could not find upload mechanism")
    capture(driver, "quora_img_upload_fail", out_dir)
    return False


def _post_quora_post(driver, text: str, out_dir: Path, image_path: str | Path | None = None) -> dict:
    """Post a Quora 'informational post', optionally with an image."""
    wait = WebDriverWait(driver, 40)

    # Click "Ask question" prompt
    try:
        prompt = wait.until(
            lambda d: d.find_element(
                By.CSS_SELECTOR, ".puppeteer_test_ask_question_prompt"
            )
        )
        prompt.click()
        time.sleep(2)
    except Exception:
        capture(driver, "quora_prompt_fail", out_dir)
        return {"ok": False, "error": "Could not find ask-question prompt"}

    # Click "Buat Kiriman Informasi" / "Create Post" tab
    try:
        post_tab = wait_until(
            lambda: next(
                (
                    el
                    for el in driver.find_elements(By.XPATH, "//*[@role='tab']")
                    if el.is_displayed()
                    and re.search(
                        r"(Buat Kiriman|Create Post|Informasi)",
                        el.text or "",
                        re.I,
                    )
                ),
                None,
            ),
            timeout=20,
        )
        safe_click(driver, post_tab)
        time.sleep(2)
    except Exception:
        capture(driver, "quora_tab_fail", out_dir)
        return {"ok": False, "error": "Could not find Post tab"}

    # Find editor
    try:
        editor = wait_until(
            lambda: next(
                (
                    el
                    for el in driver.find_elements(
                        By.CSS_SELECTOR, "[contenteditable='true']"
                    )
                    if el.is_displayed()
                ),
                None,
            ),
            timeout=30,
        )
    except Exception:
        capture(driver, "quora_editor_fail", out_dir)
        return {"ok": False, "error": "Could not find editor"}

    type_rich_text(driver, editor, text)
    time.sleep(1)

    try:
        wait_until(
            lambda: text[:24] in (editor.get_attribute("textContent") or ""),
            timeout=20,
        )
    except Exception:
        capture(driver, "quora_text_fail", out_dir)
        return {"ok": False, "error": "Text not inserted"}

    # Upload image if provided
    if image_path and Path(image_path).exists():
        img_ok = _upload_image(driver, image_path, out_dir)
        if not img_ok:
            print("    Warning: image upload failed, posting text-only")
        time.sleep(2)

    # Find and click Post button
    try:
        post_button = wait_until(
            lambda: next(
                (
                    el
                    for el in driver.find_elements(
                        By.CSS_SELECTOR,
                        "button.puppeteer_test_modal_submit, "
                        "[role='button'].puppeteer_test_modal_submit",
                    )
                    if el.is_displayed()
                    and re.search(
                        r"^(Kiriman|Post|Posting)$",
                        (el.text or "").strip(),
                        re.I,
                    )
                ),
                None,
            ),
            timeout=20,
        )
    except Exception:
        capture(driver, "quora_postbtn_fail", out_dir)
        return {"ok": False, "error": "Could not find Post button"}

    # Wait for button to be enabled
    try:
        wait_until(
            lambda: post_button.get_attribute("aria-disabled") != "true"
            and post_button.get_attribute("disabled") is None,
            timeout=20,
        )
    except Exception:
        pass

    safe_click(driver, post_button)
    time.sleep(8)
    capture(driver, "quora_posted", out_dir)

    # Check success indicators
    page_source = driver.page_source
    submit_ok = (
        "Berhasil dikirimkan" in page_source
        or "Successfully posted" in page_source
        or text.splitlines()[0] in page_source
    )

    return {"ok": submit_ok, "url": driver.current_url}


def _verify_quora(driver, text: str, out_dir: Path) -> dict:
    """Verify a post exists on the Quora profile."""
    first_line = text.splitlines()[0][:80]
    driver.get(QUORA_VERIFY_URL)
    time.sleep(8)

    if _check_cloudflare(driver):
        capture(driver, "quora_verify_cf", out_dir)
        if not try_solve_cloudflare(driver, out_dir):
            wait_for_human(
                driver,
                "Cloudflare on Quora verification page. Auto-solve failed.",
                timeout=180,
            )
        time.sleep(3)

    capture(driver, "quora_verify", out_dir)
    found = first_line in driver.page_source
    return {"ok": found, "url": driver.current_url, "snippet": first_line}


def post_from_drafts(
    cookie_file: str | Path,
    draft_dir: str | Path,
    out_dir: str | Path,
    image_path: str | Path | None = None,
) -> dict:
    """Post Quora drafts from *draft_dir*.

    Looks for: quora-post.txt or quora-post-1.txt, etc.
    If *image_path* is provided, attaches the hero image to each post.
    Semi-automatic: pauses for human CAPTCHA resolution when needed.
    """
    drafts = find_drafts(draft_dir, "quora-post")
    if not drafts:
        return {"ok": False, "error": "No Quora draft files found", "posts": []}

    texts = [read_draft(p) for p in drafts]
    texts = [t for t in texts if t]

    if not texts:
        return {"ok": False, "error": "All Quora drafts were empty", "posts": []}

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    print(f"  Found {len(texts)} Quora post(s)")

    snapshot = load_cookie_snapshot(cookie_file)
    driver = build_driver()
    results = []

    try:
        _quora_home(driver, snapshot, out)

        for i, text in enumerate(texts, 1):
            print(f"  Posting Quora #{i}/{len(texts)}...")
            if i > 1:
                # Re-navigate home for next post
                driver.get("https://id.quora.com/")
                time.sleep(5)
                if _check_cloudflare(driver):
                    if not try_solve_cloudflare(driver, out):
                        wait_for_human(driver, "Cloudflare again. Auto-solve failed.", timeout=180)

            result = _post_quora_post(driver, text, out, image_path=image_path)
            results.append(result)

            if result["ok"]:
                # Verify
                verification = _verify_quora(driver, text, out)
                result["verification"] = verification

        overall = {
            "ok": all(r["ok"] for r in results),
            "posts": results,
            "count": len(results),
        }
        (out / "result.json").write_text(json.dumps(overall, indent=2), encoding="utf-8")
        return overall

    except Exception as exc:
        capture(driver, "quora_error", out)
        return {"ok": False, "error": str(exc), "posts": results}
    finally:
        driver.quit()


def verify_from_drafts(
    cookie_file: str | Path,
    draft_dir: str | Path,
    out_dir: str | Path,
) -> dict:
    """Verify Quora posts exist without posting."""
    drafts = find_drafts(draft_dir, "quora-post")
    if not drafts:
        return {"ok": False, "error": "No Quora draft files found"}

    texts = [read_draft(p) for p in drafts]
    texts = [t for t in texts if t]

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    snapshot = load_cookie_snapshot(cookie_file)
    driver = build_driver()

    try:
        add_cookies(driver, snapshot, "quora.com", "https://www.quora.com/")
        results = []
        for text in texts:
            results.append(_verify_quora(driver, text, out))
        return {"ok": all(r["ok"] for r in results), "verified": results}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    finally:
        driver.quit()
