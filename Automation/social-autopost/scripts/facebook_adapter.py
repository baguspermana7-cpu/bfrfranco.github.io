"""Facebook adapter — Semi-auto Selenium Firefox with cookie injection.

Uses the LinkedIn post draft as content source (same professional tone).
Posts to the user's Facebook profile/page feed.

Facebook uses a Lexical rich-text editor that rejects ALL synthetic keyboard
events from Selenium WebDriver (send_keys, ActionChains, synthetic ClipboardEvent,
execCommand). The ONLY reliable way to insert text is a real user Ctrl+V paste.

Workflow (semi-auto):
  1. Script opens composer and uploads hero image (automatic)
  2. Script copies text to system clipboard via GTK (automatic)
  3. Script PAUSES — user clicks the editor and presses Ctrl+V (manual)
  4. Script clicks Post button (automatic after user confirms)
"""
from __future__ import annotations

import json
import time
from pathlib import Path

from selenium.webdriver.common.by import By

from .common import (
    add_cookies,
    build_driver,
    capture,
    find_drafts,
    load_cookie_snapshot,
    read_draft,
    safe_click,
    wait_until,
)

FB_PROFILE_URL = "https://www.facebook.com/me"


def _set_system_clipboard(text: str) -> bool:
    """Set the system clipboard using GTK via system Python.

    The venv Python doesn't have PyGObject, but the system Python does.
    We spawn a subprocess using /usr/bin/python3 to set the clipboard.
    """
    import subprocess
    import tempfile

    # Write text to temp file to avoid shell escaping issues
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8") as f:
        f.write(text)
        tmp_path = f.name

    try:
        result = subprocess.run(
            ["/usr/bin/python3", "-c", f"""
import gi, sys
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gdk
text = open('{tmp_path}', encoding='utf-8').read()
cb = Gtk.Clipboard.get(Gdk.SELECTION_CLIPBOARD)
cb.set_text(text, -1)
cb.store()
print('OK', len(text))
"""],
            capture_output=True, text=True, timeout=10,
        )
        Path(tmp_path).unlink(missing_ok=True)
        if "OK" in result.stdout:
            print(f"    System clipboard set ({len(text)} chars)")
            return True
        print(f"    GTK clipboard stderr: {result.stderr[:200]}")
        return False
    except Exception as exc:
        Path(tmp_path).unlink(missing_ok=True)
        print(f"    GTK clipboard failed: {exc}")
        return False


def _wait_for_user_paste(driver, editor, text: str, timeout: int = 180) -> bool:
    """Wait for the user to manually Ctrl+V paste text into the editor.

    Polls the editor's textContent every 2 seconds to detect when
    the user has pasted. Returns True when text is detected.
    """
    print(f"\n{'='*60}")
    print("  HUMAN ACTION REQUIRED")
    print(f"{'='*60}")
    print("  Text has been copied to your clipboard.")
    print("  Please do the following in the Firefox browser window:")
    print("    1. Click inside the 'What's on your mind?' editor")
    print("    2. Press Ctrl+V to paste the text")
    print(f"  Waiting up to {timeout}s for paste...")
    print(f"{'='*60}\n")

    end = time.time() + timeout
    check_text = text[:40]
    while time.time() < end:
        try:
            content = editor.get_attribute("textContent") or ""
            if check_text in content:
                print("    Text paste detected! Continuing automation.\n")
                return True
        except Exception:
            pass
        time.sleep(2)

    print("    Timeout: text paste not detected.")
    return False


def _upload_image(driver, image_path: str | Path, out_dir: Path) -> bool:
    """Upload an image in the Facebook composer.

    The "Add to your post" bar has a green Photo/Video icon.
    Clicking it reveals a file input or opens the photo upload area.
    """
    abs_path = str(Path(image_path).resolve())
    print(f"    Uploading image to Facebook: {Path(abs_path).name}")

    # Strategy 1: Find and send to existing file inputs first (some are pre-rendered hidden)
    file_inputs = driver.find_elements(By.CSS_SELECTOR, "input[type='file']")
    for fi in file_inputs:
        accept = (fi.get_attribute("accept") or "").lower()
        if "image" in accept or "video" in accept or not accept:
            try:
                fi.send_keys(abs_path)
                time.sleep(6)
                capture(driver, "fb_img_uploaded", out_dir)
                print("    Facebook image upload successful (direct file input)")
                return True
            except Exception:
                continue

    # Strategy 2: Click the Photo/Video icon in "Add to your post" bar
    try:
        photo_btns = driver.find_elements(By.CSS_SELECTOR,
            "[aria-label*='Photo/video'], "
            "[aria-label*='photo/video'], "
            "[aria-label*='Photo'], "
            "[aria-label*='Foto'], "
            "[aria-label*='foto']"
        )
        clicked = False
        for btn in photo_btns:
            if btn.is_displayed():
                print(f"    Clicking Photo/Video button: {btn.get_attribute('aria-label')}")
                safe_click(driver, btn)
                clicked = True
                time.sleep(3)
                break

        if not clicked:
            icons = driver.find_elements(By.CSS_SELECTOR,
                "[class*='photo'] , [class*='Photo'], "
                "div[style*='background'] i, "
                "[data-testid*='photo'], [data-testid*='Photo']"
            )
            for icon in icons:
                if icon.is_displayed():
                    safe_click(driver, icon)
                    time.sleep(3)
                    break
    except Exception:
        pass

    # Now try file inputs again (clicking Photo may have created new ones)
    time.sleep(1)
    file_inputs = driver.find_elements(By.CSS_SELECTOR, "input[type='file']")
    for fi in file_inputs:
        try:
            fi.send_keys(abs_path)
            time.sleep(6)
            capture(driver, "fb_img_uploaded", out_dir)
            print("    Facebook image upload successful (after Photo click)")
            return True
        except Exception:
            continue

    print("    Facebook image upload: could not find upload mechanism")
    capture(driver, "fb_img_upload_fail", out_dir)
    return False


def _post_single(
    driver,
    text: str,
    out_dir: Path,
    image_path: str | Path | None = None,
) -> dict:
    """Create a Facebook post (semi-auto: user pastes text manually)."""

    # Navigate to Facebook home
    driver.get("https://www.facebook.com/")
    time.sleep(5)
    capture(driver, "fb_home", out_dir)

    # Click the "What's on your mind?" composer prompt to open the post dialog
    try:
        composer_trigger = wait_until(
            lambda: next(
                (
                    el
                    for el in driver.find_elements(
                        By.CSS_SELECTOR,
                        "[aria-label*='on your mind'], "
                        "[aria-label*='Apa yang'], "
                        "[aria-label*='mind'], "
                        "[role='button'][tabindex='0']"
                    )
                    if el.is_displayed()
                    and any(kw in (el.text or "").lower() + (el.get_attribute("aria-label") or "").lower()
                            for kw in ["mind", "apa yang", "pikirkan", "on your mind"])
                ),
                None,
            ),
            timeout=30,
        )
        safe_click(driver, composer_trigger)
        time.sleep(3)
    except Exception:
        # Fallback: try clicking any prominent create-post area
        try:
            spans = driver.find_elements(By.XPATH,
                "//span[contains(text(),'on your mind')] | "
                "//span[contains(text(),'Apa yang')] | "
                "//span[contains(text(),'pikirkan')]"
            )
            for span in spans:
                if span.is_displayed():
                    safe_click(driver, span)
                    time.sleep(3)
                    break
        except Exception:
            capture(driver, "fb_composer_fail", out_dir)
            return {"ok": False, "error": "Could not open Facebook composer"}

    capture(driver, "fb_composer_open", out_dir)

    # Find the contentEditable area in the post dialog
    try:
        editor = wait_until(
            lambda: next(
                (
                    el
                    for el in driver.find_elements(
                        By.CSS_SELECTOR,
                        "[contenteditable='true'][role='textbox'], "
                        "[contenteditable='true'][aria-label*='on your mind'], "
                        "[contenteditable='true'][aria-label*='Apa yang'], "
                        "[contenteditable='true'][data-lexical-editor]"
                    )
                    if el.is_displayed()
                ),
                None,
            ),
            timeout=20,
        )
    except Exception:
        capture(driver, "fb_editor_fail", out_dir)
        return {"ok": False, "error": "Could not find Facebook editor"}

    # Upload image FIRST (before text, so user can see image while pasting)
    if image_path and Path(image_path).exists():
        img_ok = _upload_image(driver, image_path, out_dir)
        if img_ok:
            time.sleep(5)
        else:
            print("    Warning: image upload failed, posting text-only")
        time.sleep(2)

    # Copy text to system clipboard via GTK
    print("    Copying post text to system clipboard...")
    clipboard_ok = _set_system_clipboard(text)
    if not clipboard_ok:
        capture(driver, "fb_clipboard_fail", out_dir)
        return {"ok": False, "error": "Could not set system clipboard for paste"}

    # Focus editor
    try:
        driver.execute_script("arguments[0].focus();", editor)
        editor.click()
    except Exception:
        pass
    time.sleep(0.5)

    capture(driver, "fb_waiting_paste", out_dir)

    # SEMI-AUTO: Wait for user to manually paste
    text_ok = _wait_for_user_paste(driver, editor, text, timeout=180)

    if not text_ok:
        capture(driver, "fb_text_fail", out_dir)
        return {"ok": False, "error": "Text not pasted (timeout). Please paste faster next time."}

    capture(driver, "fb_text_done", out_dir)
    print("    Text confirmed in editor")

    # Wait a moment for Facebook to process
    time.sleep(2)
    capture(driver, "fb_before_post", out_dir)

    # Find and click the Post button
    try:
        post_button = wait_until(
            lambda: next(
                (
                    el
                    for el in driver.find_elements(
                        By.CSS_SELECTOR,
                        "[aria-label='Post'], "
                        "[aria-label='Posting'], "
                        "[aria-label='Kirim'], "
                        "div[role='button']"
                    )
                    if el.is_displayed()
                    and any(kw == (el.text or "").strip().lower()
                            for kw in ["post", "posting", "kirim", "publikasikan"])
                    and el.get_attribute("aria-disabled") != "true"
                ),
                None,
            ),
            timeout=20,
        )
    except Exception:
        capture(driver, "fb_postbtn_fail", out_dir)
        return {"ok": False, "error": "Could not find Facebook Post button"}

    safe_click(driver, post_button)
    time.sleep(10)
    capture(driver, "fb_posted", out_dir)

    return {"ok": True, "url": driver.current_url}


def post_from_drafts(
    cookie_file: str | Path,
    draft_dir: str | Path,
    out_dir: str | Path,
    image_path: str | Path | None = None,
) -> dict:
    """Post to Facebook using the LinkedIn draft as content.

    Semi-auto: opens composer, uploads image, copies text to clipboard,
    then waits for user to Ctrl+V paste manually.

    Looks for: linkedin-post.txt or linkedin-post.md
    Falls back to: facebook-post.txt or facebook-post.md
    If *image_path* provided, attaches the hero image.
    """
    # Prefer linkedin draft for Facebook (same professional tone)
    drafts = find_drafts(draft_dir, "linkedin-post")
    if not drafts:
        drafts = find_drafts(draft_dir, "facebook-post")
    if not drafts:
        drafts = find_drafts(draft_dir, "linkedin")
    if not drafts:
        return {"ok": False, "error": "No LinkedIn/Facebook draft found for Facebook posting"}

    text = read_draft(drafts[0])
    if not text:
        return {"ok": False, "error": "Draft file was empty"}

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    print(f"  Using draft: {drafts[0].name} ({len(text)} chars)")
    if image_path:
        print(f"  Hero image: {Path(image_path).name}")

    snapshot = load_cookie_snapshot(cookie_file)
    driver = build_driver()

    try:
        # Inject Facebook cookies
        add_cookies(driver, snapshot, "facebook.com", "https://www.facebook.com/")
        time.sleep(2)

        result = _post_single(driver, text, out, image_path=image_path)

        (out / "result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
        return result

    except Exception as exc:
        capture(driver, "fb_error", out)
        return {"ok": False, "error": str(exc)}
    finally:
        driver.quit()


def verify_from_drafts(
    cookie_file: str | Path,
    draft_dir: str | Path,
    out_dir: str | Path,
) -> dict:
    """Verify Facebook post exists on profile."""
    drafts = find_drafts(draft_dir, "linkedin-post")
    if not drafts:
        drafts = find_drafts(draft_dir, "facebook-post")
    if not drafts:
        return {"ok": False, "error": "No draft found"}

    text = read_draft(drafts[0])
    first_line = text.splitlines()[0][:60] if text else ""

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    snapshot = load_cookie_snapshot(cookie_file)
    driver = build_driver()

    try:
        add_cookies(driver, snapshot, "facebook.com", "https://www.facebook.com/")
        driver.get(FB_PROFILE_URL)
        time.sleep(8)
        capture(driver, "fb_verify", out)
        found = first_line in driver.page_source
        return {"ok": found, "url": driver.current_url, "snippet": first_line}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    finally:
        driver.quit()
