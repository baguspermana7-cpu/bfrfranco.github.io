"""Shared utilities for social media automation adapters."""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

from selenium import webdriver
from selenium.common.exceptions import ElementClickInterceptedException
from selenium.webdriver import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------

def build_driver(headless: bool = False) -> webdriver.Firefox:
    """Create a Firefox WebDriver with anti-detection tweaks."""
    options = Options()
    options.binary_location = "/snap/firefox/current/usr/lib/firefox/firefox"
    if headless:
        options.add_argument("--headless")
    options.set_preference("dom.webdriver.enabled", False)
    options.set_preference(
        "general.useragent.override",
        "Mozilla/5.0 (X11; Linux x86_64; rv:136.0) Gecko/20100101 Firefox/136.0",
    )
    log_dir = Path("/tmp/socialbot")
    log_dir.mkdir(parents=True, exist_ok=True)
    service = Service(
        "/snap/bin/geckodriver",
        log_output=str(log_dir / "geckodriver.log"),
    )
    driver = webdriver.Firefox(service=service, options=options)
    driver.set_window_size(1440, 980)
    return driver


# ---------------------------------------------------------------------------
# Cookies
# ---------------------------------------------------------------------------

def load_cookie_snapshot(path: str | Path) -> list[dict]:
    """Load a Firefox cookie JSON snapshot."""
    return json.loads(Path(path).read_text(encoding="utf-8"))


def host_matches(host: str, suffix: str) -> bool:
    host = host.lstrip(".")
    return host == suffix or host.endswith("." + suffix)


def normalize_expiry(value) -> int | None:
    if not value:
        return None
    n = int(value)
    if n <= 0:
        return None
    if n > 9999999999:
        n //= 1000
    return n


def add_cookies(
    driver: webdriver.Firefox,
    cookie_snapshot: list[dict],
    domain_suffix: str,
    landing_url: str,
) -> None:
    """Inject cookies for a domain from a snapshot into the driver."""
    driver.get(landing_url)
    time.sleep(5)
    for row in cookie_snapshot:
        if not host_matches(row["host"], domain_suffix):
            continue
        cookie = {
            "name": row["name"],
            "value": row["value"],
            "path": row.get("path") or "/",
            "secure": bool(row.get("isSecure")),
            "httpOnly": bool(row.get("isHttpOnly")),
        }
        expiry = normalize_expiry(row.get("expiry"))
        if expiry:
            cookie["expiry"] = expiry
        host = row["host"].lstrip(".")
        if host != domain_suffix:
            cookie["domain"] = host
        same_site = row.get("sameSite")
        if same_site in ("Lax", "Strict", "None"):
            cookie["sameSite"] = same_site
        try:
            driver.add_cookie(cookie)
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Waiting helpers
# ---------------------------------------------------------------------------

def wait_until(predicate, timeout: int = 30, interval: float = 0.5):
    """Poll *predicate* until truthy or *timeout* seconds elapse."""
    end = time.time() + timeout
    last_error = None
    while time.time() < end:
        try:
            value = predicate()
            if value:
                return value
        except Exception as exc:
            last_error = exc
        time.sleep(interval)
    if last_error:
        raise last_error
    raise TimeoutError("Timed out waiting for condition")


def wait_no_cloudflare(driver: webdriver.Firefox, timeout: int = 45) -> None:
    """Wait until Cloudflare challenge is gone."""
    wait_until(
        lambda: "Performing security verification" not in driver.page_source
        and "Cloudflare" not in driver.page_source[:5000],
        timeout=timeout,
    )


def try_solve_cloudflare(driver: webdriver.Firefox, out_dir: str | Path | None = None, max_attempts: int = 3) -> bool:
    """Attempt to auto-solve a Cloudflare Turnstile checkbox challenge.

    Strategy:
    1. Find the Turnstile iframe (by src or id pattern)
    2. Switch into the iframe
    3. Find the checkbox and click it
    4. Switch back and verify challenge cleared

    Returns True if the challenge was cleared, False otherwise.
    """
    for attempt in range(1, max_attempts + 1):
        print(f"  Cloudflare auto-solve attempt {attempt}/{max_attempts}...")
        if out_dir:
            capture(driver, f"cf_attempt_{attempt}", out_dir)

        # Strategy 1: Find Turnstile iframe and click checkbox inside
        solved = False
        try:
            iframes = driver.find_elements(By.CSS_SELECTOR, "iframe")
            cf_iframe = None
            for iframe in iframes:
                src = iframe.get_attribute("src") or ""
                iframe_id = iframe.get_attribute("id") or ""
                title = iframe.get_attribute("title") or ""
                if any(kw in src.lower() for kw in ["challenges.cloudflare", "turnstile", "cf-chl"]):
                    cf_iframe = iframe
                    break
                if any(kw in iframe_id.lower() for kw in ["cf-", "turnstile", "challenge"]):
                    cf_iframe = iframe
                    break
                if "cloudflare" in title.lower() or "verify" in title.lower():
                    cf_iframe = iframe
                    break

            if cf_iframe:
                print(f"    Found Cloudflare iframe, switching...")
                driver.switch_to.frame(cf_iframe)
                time.sleep(1.5)

                # Look for checkbox or clickable element inside iframe
                clickables = driver.find_elements(By.CSS_SELECTOR,
                    "input[type='checkbox'], "
                    ".ctp-checkbox-label, "
                    "#challenge-stage input, "
                    "[role='checkbox'], "
                    "label, "
                    "div[class*='check']"
                )
                for el in clickables:
                    if el.is_displayed():
                        print(f"    Clicking checkbox element...")
                        try:
                            el.click()
                        except Exception:
                            ActionChains(driver).move_to_element(el).click().perform()
                        solved = True
                        break

                driver.switch_to.default_content()
                time.sleep(4)

            if not solved:
                # Strategy 2: Click by coordinate — find iframe position and click center
                if cf_iframe and cf_iframe.is_displayed():
                    loc = cf_iframe.location
                    size = cf_iframe.size
                    # Click near the left side where the checkbox typically is
                    click_x = loc["x"] + min(30, size["width"] // 4)
                    click_y = loc["y"] + size["height"] // 2
                    print(f"    Clicking by coordinate ({click_x}, {click_y})...")
                    ActionChains(driver).move_by_offset(click_x, click_y).click().perform()
                    ActionChains(driver).move_by_offset(-click_x, -click_y).perform()
                    solved = True
                    time.sleep(4)

        except Exception as exc:
            print(f"    Auto-solve attempt failed: {exc}")
            try:
                driver.switch_to.default_content()
            except Exception:
                pass

        # Check if challenge is gone
        time.sleep(2)
        src = driver.page_source[:6000]
        if "Cloudflare" not in src and "challenge" not in src.lower()[:3000]:
            print("    Cloudflare challenge cleared!")
            if out_dir:
                capture(driver, "cf_solved", out_dir)
            return True

        time.sleep(3)

    return False


def wait_for_human(driver: webdriver.Firefox, prompt_msg: str, timeout: int = 300) -> None:
    """Pause automation and wait for human to clear a challenge.

    Prints *prompt_msg* to stdout and polls the driver every 3 seconds
    for up to *timeout* seconds, waiting for the Cloudflare / CAPTCHA
    screen to disappear.  If it does not clear in time, raises TimeoutError.
    """
    print(f"\n{'='*60}")
    print(f"HUMAN CHECKPOINT: {prompt_msg}")
    print(f"Waiting up to {timeout}s for you to clear the challenge...")
    print(f"{'='*60}\n")

    end = time.time() + timeout
    while time.time() < end:
        src = driver.page_source[:6000]
        if (
            "Cloudflare" not in src
            and "challenge" not in src.lower()
            and "captcha" not in src.lower()
        ):
            print("Challenge cleared. Resuming automation.\n")
            return
        time.sleep(3)
    raise TimeoutError("Human checkpoint timed out — challenge was not cleared.")


# ---------------------------------------------------------------------------
# Rich-text typing
# ---------------------------------------------------------------------------

def type_rich_text(driver: webdriver.Firefox, element, text: str) -> None:
    """Type *text* into a contentEditable element with multi-strategy fallback."""
    driver.execute_script("arguments[0].focus();", element)
    element.click()
    time.sleep(0.5)
    try:
        element.send_keys(Keys.CONTROL, "a")
        element.send_keys(Keys.BACKSPACE)
    except Exception:
        pass

    # Strategy 1: send_keys directly
    try:
        element.send_keys(text)
    except Exception:
        ActionChains(driver).move_to_element(element).click().send_keys(text).perform()

    time.sleep(1.5)
    if text[:24] not in (element.get_attribute("textContent") or ""):
        # Strategy 2: execCommand insertText
        driver.execute_script(
            """
            const el = arguments[0], value = arguments[1];
            el.focus();
            document.execCommand('selectAll', false, null);
            document.execCommand('insertText', false, value);
            el.dispatchEvent(new InputEvent('input', {bubbles: true, data: value, inputType: 'insertText'}));
            """,
            element,
            text,
        )
        time.sleep(1.5)


# ---------------------------------------------------------------------------
# Artifact capture
# ---------------------------------------------------------------------------

def capture(driver: webdriver.Firefox, name: str, out_dir: str | Path) -> None:
    """Save screenshot + HTML snapshot."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    driver.save_screenshot(str(out / f"{name}.png"))
    (out / f"{name}.html").write_text(
        driver.page_source, encoding="utf-8", errors="ignore"
    )
    print(f"  [{name}] URL: {driver.current_url}")


def safe_click(driver: webdriver.Firefox, element) -> None:
    """Click with JS fallback for intercepted clicks."""
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
    time.sleep(0.5)
    try:
        element.click()
    except ElementClickInterceptedException:
        driver.execute_script("arguments[0].click();", element)


# ---------------------------------------------------------------------------
# Draft reading
# ---------------------------------------------------------------------------

def read_draft(path: str | Path) -> str:
    """Read a draft file, stripping metadata headers."""
    text = Path(path).read_text(encoding="utf-8").strip()
    # Strip front-matter (--- delimited)
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) >= 3:
            text = parts[2].strip()
    elif "---" in text:
        text = text.split("---", 1)[1].strip()
    if text.startswith("ANSWER:"):
        text = text.split("ANSWER:", 1)[1].strip()
    return text


def find_drafts(draft_dir: str | Path, prefix: str, extensions: tuple = (".txt", ".md")) -> list[Path]:
    """Find draft files matching a prefix pattern, sorted by name.

    Matches patterns like: x-post.txt, x-post-1.txt, x-post-2.md
    """
    d = Path(draft_dir)
    results = []
    for ext in extensions:
        # Single file: prefix.ext
        single = d / f"{prefix}{ext}"
        if single.exists():
            results.append(single)
        # Numbered files: prefix-1.ext, prefix-2.ext, ...
        results.extend(sorted(d.glob(f"{prefix}-[0-9]*{ext}")))
    # Deduplicate while preserving order
    seen = set()
    unique = []
    for p in results:
        if p not in seen:
            seen.add(p)
            unique.append(p)
    return unique
