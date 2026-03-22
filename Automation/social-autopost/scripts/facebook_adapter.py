"""Facebook adapter — Full-auto Selenium Firefox with cookie injection.

Uses the LinkedIn post draft as content source (same professional tone).
Posts to the user's Facebook profile/page feed.

Facebook uses a Lexical rich-text editor that rejects standard Selenium
send_keys(). We use multiple JavaScript strategies to insert text:
  1. Direct Lexical editor API manipulation via __lexicalEditor
  2. Synthetic InputEvent with insertText
  3. Synthetic ClipboardEvent with DataTransfer
  4. execCommand insertText fallback
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

# JavaScript to insert text into Facebook's Lexical editor
# Tries multiple strategies in order of reliability
JS_PASTE_TEXT = """
(function(editor, text) {
    'use strict';

    // Helper: check if text was inserted
    function verify() {
        var content = editor.textContent || '';
        return content.indexOf(text.substring(0, 30)) !== -1;
    }

    // Ensure focus
    editor.focus();

    // Strategy 1: Lexical internal API
    // Lexical stores its editor instance on the DOM element
    try {
        var lexEditor = editor.__lexicalEditor;
        if (!lexEditor) {
            // Try looking through all properties
            var keys = Object.keys(editor);
            for (var i = 0; i < keys.length; i++) {
                var val = editor[keys[i]];
                if (val && typeof val === 'object' && typeof val.update === 'function'
                    && typeof val.getEditorState === 'function') {
                    lexEditor = val;
                    break;
                }
            }
        }
        if (lexEditor && typeof lexEditor.update === 'function') {
            lexEditor.update(function() {
                // Inside update(), Lexical's $ functions are available
                // We need to access them through the module scope
                // Try to find $getRoot and other functions
                try {
                    var root = window.$getRoot ? window.$getRoot() : null;
                    if (!root) {
                        // Access through editor internals
                        var state = lexEditor.getEditorState();
                        if (state && state._nodeMap) {
                            var rootNode = state._nodeMap.get('root');
                            if (rootNode) {
                                // Clear existing content and add new text
                                // This approach modifies state directly
                            }
                        }
                    }
                } catch(e) {}
            });
        }
    } catch(e) {}

    // Strategy 2: Synthetic ClipboardEvent (paste)
    // Create a DataTransfer with the text and dispatch paste event
    try {
        editor.focus();
        // Select all existing content first
        var sel = window.getSelection();
        var range = document.createRange();
        range.selectNodeContents(editor);
        sel.removeAllRanges();
        sel.addRange(range);
        // Create DataTransfer
        var dt = new DataTransfer();
        dt.setData('text/plain', text);
        // Dispatch paste event
        var pasteEvent = new ClipboardEvent('paste', {
            clipboardData: dt,
            bubbles: true,
            cancelable: true,
            composed: true
        });
        editor.dispatchEvent(pasteEvent);
        if (verify()) return 'paste_event';
    } catch(e) {}

    // Strategy 3: InputEvent with insertFromPaste
    try {
        editor.focus();
        var sel2 = window.getSelection();
        var range2 = document.createRange();
        range2.selectNodeContents(editor);
        sel2.removeAllRanges();
        sel2.addRange(range2);

        var dt2 = new DataTransfer();
        dt2.setData('text/plain', text);
        var inputEvent = new InputEvent('beforeinput', {
            inputType: 'insertFromPaste',
            data: null,
            dataTransfer: dt2,
            bubbles: true,
            cancelable: true,
            composed: true,
            targetRanges: []
        });
        editor.dispatchEvent(inputEvent);
        if (verify()) return 'input_paste';
    } catch(e) {}

    // Strategy 4: InputEvent with insertText
    try {
        editor.focus();
        var sel3 = window.getSelection();
        var range3 = document.createRange();
        range3.selectNodeContents(editor);
        sel3.removeAllRanges();
        sel3.addRange(range3);

        var textEvent = new InputEvent('beforeinput', {
            inputType: 'insertText',
            data: text,
            bubbles: true,
            cancelable: true,
            composed: true
        });
        editor.dispatchEvent(textEvent);
        if (verify()) return 'input_text';
    } catch(e) {}

    // Strategy 5: execCommand insertText
    try {
        editor.focus();
        var sel4 = window.getSelection();
        var range4 = document.createRange();
        range4.selectNodeContents(editor);
        sel4.removeAllRanges();
        sel4.addRange(range4);

        document.execCommand('insertText', false, text);
        if (verify()) return 'exec_command';
    } catch(e) {}

    // Strategy 6: Direct innerHTML manipulation + dispatch input event
    // This is a last resort — modifies DOM directly
    try {
        // Build paragraph elements from text lines
        var lines = text.split('\\n');
        var html = '';
        for (var j = 0; j < lines.length; j++) {
            var line = lines[j].trim();
            if (line) {
                html += '<p dir="ltr"><span data-lexical-text="true">' +
                    line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') +
                    '</span></p>';
            } else {
                html += '<p><br></p>';
            }
        }
        editor.innerHTML = html;
        // Dispatch input event to notify Lexical of the change
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        if (verify()) return 'inner_html';
    } catch(e) {}

    return 'failed';
})(arguments[0], arguments[1]);
"""


def _fb_paste_text(driver, editor, text: str) -> bool:
    """Insert text into Facebook's Lexical editor using JS strategies."""
    # Focus editor
    driver.execute_script("arguments[0].focus();", editor)
    editor.click()
    time.sleep(0.5)

    print("    Trying JavaScript text insertion strategies...")
    result = driver.execute_script(JS_PASTE_TEXT, editor, text)
    print(f"    JS insertion result: {result}")

    if result and result != "failed":
        return True

    # If all JS strategies failed, try a character-level approach with InputEvent
    # This types text character by character using 'insertText' InputEvent
    print("    Trying character-by-character InputEvent approach...")
    driver.execute_script("""
        var el = arguments[0];
        var text = arguments[1];
        el.focus();
        // Clear first
        var sel = window.getSelection();
        var range = document.createRange();
        range.selectNodeContents(el);
        sel.removeAllRanges();
        sel.addRange(range);
        document.execCommand('selectAll');
        document.execCommand('delete');
    """, editor, text)
    time.sleep(0.3)

    # Type paragraph by paragraph
    paragraphs = text.split("\n")
    for i, para in enumerate(paragraphs):
        if para.strip():
            driver.execute_script("""
                var el = arguments[0];
                var text = arguments[1];
                el.focus();
                // Move cursor to end
                var sel = window.getSelection();
                sel.modify('move', 'forward', 'documentboundary');
                // Insert text via InputEvent
                var evt = new InputEvent('beforeinput', {
                    inputType: 'insertText',
                    data: text,
                    bubbles: true,
                    cancelable: true,
                    composed: true
                });
                el.dispatchEvent(evt);
            """, editor, para)
        if i < len(paragraphs) - 1:
            # Insert line break
            driver.execute_script("""
                var el = arguments[0];
                el.focus();
                var sel = window.getSelection();
                sel.modify('move', 'forward', 'documentboundary');
                var evt = new InputEvent('beforeinput', {
                    inputType: 'insertParagraph',
                    bubbles: true,
                    cancelable: true,
                    composed: true
                });
                el.dispatchEvent(evt);
            """, editor)
        time.sleep(0.05)

    time.sleep(1)
    content = editor.get_attribute("textContent") or ""
    if text[:30] in content:
        print(f"    Character approach succeeded ({len(content)} chars)")
        return True

    print(f"    All insertion methods failed. Content: {content[:100]!r}")
    return False


def _upload_image(driver, image_path: str | Path, out_dir: Path) -> bool:
    """Upload an image in the Facebook composer."""
    abs_path = str(Path(image_path).resolve())
    print(f"    Uploading image to Facebook: {Path(abs_path).name}")

    # Strategy 1: Find and send to existing file inputs first
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

    # Strategy 2: Click the Photo/Video icon
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

    # Now try file inputs again
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
    """Create a Facebook post from the home feed composer (full-auto)."""

    # Navigate to Facebook home
    driver.get("https://www.facebook.com/")
    time.sleep(5)
    capture(driver, "fb_home", out_dir)

    # Click "What's on your mind?" composer prompt
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

    # Find the contentEditable area
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

    # Insert text
    print("    Inserting text into Facebook editor...")
    text_ok = _fb_paste_text(driver, editor, text)
    time.sleep(1)

    if not text_ok:
        capture(driver, "fb_text_fail", out_dir)
        return {"ok": False, "error": "Text not inserted into Facebook editor"}

    capture(driver, "fb_text_done", out_dir)
    print("    Text inserted successfully")

    # Upload image if provided
    if image_path and Path(image_path).exists():
        img_ok = _upload_image(driver, image_path, out_dir)
        if img_ok:
            time.sleep(5)
        else:
            print("    Warning: image upload failed, posting text-only")
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
    """Post to Facebook using the LinkedIn draft as content (full-auto).

    Looks for: linkedin-post.txt or linkedin-post.md
    Falls back to: facebook-post.txt or facebook-post.md
    If *image_path* provided, attaches the hero image.
    """
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
