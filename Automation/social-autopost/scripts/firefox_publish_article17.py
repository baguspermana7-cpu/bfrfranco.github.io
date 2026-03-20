from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path

from selenium import webdriver
from selenium.common.exceptions import ElementClickInterceptedException
from selenium.webdriver import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.support.ui import WebDriverWait

DEFAULT_BASE = Path("/home/baguspermana7/rz-work/Article/Post Draft/Article 17 - SEA DC Opportunity")
DEFAULT_COOKIE_SNAPSHOT = Path("/home/baguspermana7/session_cookies_article17.json")
DEFAULT_OUT = Path("/tmp/socialbot/firefox-publish")
BASE = Path(os.environ.get("SOCIAL_DRAFT_BASE", str(DEFAULT_BASE)))
COOKIE_SNAPSHOT = Path(os.environ.get("SOCIAL_COOKIE_SNAPSHOT", str(DEFAULT_COOKIE_SNAPSHOT)))
OUT = Path(os.environ.get("SOCIAL_ARTIFACT_DIR", str(DEFAULT_OUT)))
X_VERIFY_URL = os.environ.get("SOCIAL_X_VERIFY_URL", "https://x.com/bagusdwiperman9")
QUORA_VERIFY_URLS = [
    url.strip()
    for url in os.environ.get(
        "SOCIAL_QUORA_VERIFY_URLS",
        "https://www.quora.com/profile/Bagus-Dwi-Permana-1/posts",
    ).split("||")
    if url.strip()
]
OUT.mkdir(parents=True, exist_ok=True)


def read_text(name: str) -> str:
    text = (BASE / name).read_text().strip()
    if name == "x-post.txt":
        return text
    if "---" in text:
        text = text.split("---", 1)[1].strip()
    if text.startswith("ANSWER:"):
        text = text.split("ANSWER:", 1)[1].strip()
    return text


def load_snapshot():
    return json.loads(COOKIE_SNAPSHOT.read_text())


def host_matches(host: str, suffix: str) -> bool:
    host = host.lstrip(".")
    return host == suffix or host.endswith("." + suffix)


def normalize_expiry(value):
    if not value:
        return None
    n = int(value)
    if n <= 0:
        return None
    if n > 9999999999:
        n //= 1000
    return n


def build_driver():
    options = Options()
    options.binary_location = "/snap/firefox/current/usr/lib/firefox/firefox"
    options.set_preference("dom.webdriver.enabled", False)
    options.set_preference(
        "general.useragent.override",
        "Mozilla/5.0 (X11; Linux x86_64; rv:136.0) Gecko/20100101 Firefox/136.0",
    )
    service = Service("/snap/bin/geckodriver", log_output=str(OUT / "geckodriver.log"))
    driver = webdriver.Firefox(service=service, options=options)
    driver.set_window_size(1440, 980)
    return driver


def add_cookies(driver, domain_suffix: str, landing_url: str):
    driver.get(landing_url)
    time.sleep(5)
    for row in load_snapshot():
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


def wait_until(predicate, timeout=30, interval=0.5):
    end = time.time() + timeout
    last_error = None
    while time.time() < end:
        try:
            value = predicate()
            if value:
                return value
        except Exception as exc:  # noqa: BLE001
            last_error = exc
        time.sleep(interval)
    if last_error:
        raise last_error
    raise TimeoutError("Timed out waiting for condition")


def capture(driver, name: str):
    driver.save_screenshot(str(OUT / f"{name}.png"))
    (OUT / f"{name}.html").write_text(driver.page_source, encoding="utf-8", errors="ignore")
    print(name, "URL:", driver.current_url)
    print(name, "TITLE:", driver.title)


def wait_no_cloudflare(driver, timeout=45):
    wait_until(
        lambda: "Performing security verification" not in driver.page_source
        and "Cloudflare" not in driver.page_source[:5000],
        timeout=timeout,
    )


def type_rich_text(driver, element, text: str):
    driver.execute_script("arguments[0].focus();", element)
    element.click()
    time.sleep(0.5)
    try:
        element.send_keys(Keys.CONTROL, "a")
        element.send_keys(Keys.BACKSPACE)
    except Exception:
        pass
    try:
        element.send_keys(text)
    except Exception:
        ActionChains(driver).move_to_element(element).click().send_keys(text).perform()
    time.sleep(1.5)
    if text[:24] not in element.get_attribute("textContent"):
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


def post_x(driver) -> dict:
    text = read_text("x-post.txt")
    add_cookies(driver, "x.com", "https://x.com/")
    add_cookies(driver, "twitter.com", "https://twitter.com/")
    driver.get("https://x.com/compose/post")
    wait = WebDriverWait(driver, 60)
    editor = wait.until(
        lambda d: d.find_element(By.CSS_SELECTOR, "[data-testid='tweetTextarea_0'][contenteditable='true']")
    )
    type_rich_text(driver, editor, text)
    wait_until(lambda: text[:24] in editor.get_attribute("textContent"), timeout=20)

    button = wait_until(
        lambda: next(
            (
                el
                for el in driver.find_elements(By.CSS_SELECTOR, "[data-testid='tweetButtonInline'], [data-testid='tweetButton']")
                if el.is_displayed() and el.get_attribute("aria-disabled") != "true" and el.get_attribute("disabled") is None
            ),
            None,
        ),
        timeout=30,
    )
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", button)
    time.sleep(1)
    try:
        button.click()
    except ElementClickInterceptedException:
        driver.execute_script("arguments[0].click();", button)
    time.sleep(8)
    capture(driver, "x_posted")

    driver.get(X_VERIFY_URL)
    time.sleep(8)
    capture(driver, "x_profile")
    ok = text.splitlines()[0] in driver.page_source
    return {"ok": ok, "url": driver.current_url}


def verify_x_post(driver) -> dict:
    text = read_text("x-post.txt")
    add_cookies(driver, "x.com", "https://x.com/")
    add_cookies(driver, "twitter.com", "https://twitter.com/")
    driver.get(X_VERIFY_URL)
    time.sleep(8)
    capture(driver, "x_verify")
    ok = text.splitlines()[0] in driver.page_source
    return {"ok": ok, "url": driver.current_url}


def quora_home(driver):
    add_cookies(driver, "quora.com", "https://www.quora.com/")
    driver.get("https://id.quora.com/")
    time.sleep(7)
    wait_no_cloudflare(driver, timeout=45)
    capture(driver, "quora_home_live")


def verify_quora_post(driver, text: str) -> dict:
    first_line = text.splitlines()[0]
    last_url = driver.current_url
    for idx, url in enumerate(QUORA_VERIFY_URLS, 1):
        try:
            driver.get(url)
            time.sleep(8)
            capture(driver, f"quora_verify_{idx}")
            page_source = driver.page_source
            last_url = driver.current_url
            if first_line in page_source:
                return {
                    "ok": True,
                    "url": driver.current_url,
                    "verified_url": url,
                }
        except Exception as exc:  # noqa: BLE001
            (OUT / f"quora_verify_{idx}.error.txt").write_text(str(exc), encoding="utf-8")
    return {"ok": False, "url": last_url}


def post_quora_post(driver) -> dict:
    text = read_text("quora-post.txt")
    quora_home(driver)
    wait = WebDriverWait(driver, 40)
    prompt = wait.until(
        lambda d: d.find_element(By.CSS_SELECTOR, ".puppeteer_test_ask_question_prompt")
    )
    prompt.click()
    time.sleep(2)
    post_tab = wait_until(
        lambda: next(
            (
                el
                for el in driver.find_elements(By.XPATH, "//*[@role='tab']")
                if el.is_displayed() and "Buat Kiriman Informasi" in (el.text or "")
            ),
            None,
        ),
        timeout=20,
    )
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", post_tab)
    time.sleep(0.5)
    try:
        post_tab.click()
    except ElementClickInterceptedException:
        driver.execute_script("arguments[0].click();", post_tab)
    time.sleep(2)

    editor = wait_until(
        lambda: next(
            (
                el
                for el in driver.find_elements(By.CSS_SELECTOR, "[contenteditable='true']")
                if el.is_displayed()
            ),
            None,
        ),
        timeout=30,
    )
    type_rich_text(driver, editor, text)
    wait_until(lambda: text[:24] in editor.get_attribute("textContent"), timeout=20)

    post_button = wait_until(
        lambda: next(
            (
                el
                for el in driver.find_elements(
                    By.CSS_SELECTOR,
                    "button.puppeteer_test_modal_submit, [role='button'].puppeteer_test_modal_submit",
                )
                if el.is_displayed()
                and re.search(r'^(Kiriman|Post|Posting)$', (el.text or '').strip(), re.I)
            ),
            None,
        ),
        timeout=20,
    )
    wait_until(
        lambda: post_button.get_attribute("aria-disabled") != "true"
        and post_button.get_attribute("disabled") is None,
        timeout=20,
    )
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", post_button)
    time.sleep(0.5)
    try:
        post_button.click()
    except ElementClickInterceptedException:
        driver.execute_script("arguments[0].click();", post_button)
    time.sleep(8)
    capture(driver, "quora_posted")
    page_source = driver.page_source
    submit_ok = (
        "Berhasil dikirimkan" in page_source
        or "Successfully posted" in page_source
        or text.splitlines()[0] in page_source
    )
    verification = verify_quora_post(driver, text)
    return {
        "ok": submit_ok and verification["ok"],
        "url": verification.get("url", driver.current_url),
        "submit_ok": submit_ok,
        "verify_ok": verification["ok"],
        "verify_url": verification.get("verified_url"),
    }


def verify_quora_post_only(driver) -> dict:
    text = read_text("quora-post.txt")
    add_cookies(driver, "quora.com", "https://www.quora.com/")
    return verify_quora_post(driver, text)


def open_quora_target_question(driver):
    candidates = [
        "Where should data centers be built in Southeast Asia?",
        "Why is Southeast Asia attractive for data centers?",
        "What is the data center market opportunity in SEA?",
        "Which SEA countries are best for data center investment?",
    ]
    for query in candidates:
        driver.get(f"https://www.quora.com/search?q={query.replace(' ', '%20')}")
        time.sleep(6)
        if "Cloudflare" in driver.page_source[:5000]:
            continue
        links = driver.find_elements(By.CSS_SELECTOR, "a[href]")
        for link in links:
            text = (link.text or "").strip()
            href = link.get_attribute("href") or ""
            if "quora.com" in href and "search?" not in href and "?" in text and re.search(r"data center|southeast asia|SEA", text, re.I):
                driver.get(href)
                time.sleep(6)
                return href
    return None


def create_quora_question(driver, question: str):
    quora_home(driver)
    button = WebDriverWait(driver, 40).until(
        lambda d: d.find_element(By.CSS_SELECTOR, ".puppeteer_test_add_question_button")
    )
    button.click()
    time.sleep(3)
    input_box = wait_until(
        lambda: next(
            (
                el
                for el in driver.find_elements(By.CSS_SELECTOR, "input, textarea, [contenteditable='true']")
                if el.is_displayed()
            ),
            None,
        ),
        timeout=25,
    )
    type_rich_text(driver, input_box, question)
    time.sleep(2)
    submit = wait_until(
        lambda: next(
            (
                el
                for el in driver.find_elements(By.XPATH, "//button")
                if el.is_displayed()
                and re.search(r'(Tambah pertanyaan|Add question|Continue|Lanjut)', (el.text or '').strip(), re.I)
            ),
            None,
        ),
        timeout=25,
    )
    submit.click()
    time.sleep(8)
    return driver.current_url


def post_quora_answer(driver) -> dict:
    text = read_text("quora-answer.txt")
    question = "Where should data centers be built in Southeast Asia?"
    quora_home(driver)
    url = open_quora_target_question(driver) or create_quora_question(driver, question)
    time.sleep(3)

    answer_button = wait_until(
        lambda: next(
            (
                el
                for el in driver.find_elements(By.XPATH, "//button | //div[@role='button']")
                if el.is_displayed()
                and re.search(r'^(Jawab|Answer)$', (el.text or '').strip(), re.I)
            ),
            None,
        ),
        timeout=30,
    )
    answer_button.click()
    time.sleep(3)

    editor = wait_until(
        lambda: next(
            (
                el
                for el in driver.find_elements(By.CSS_SELECTOR, "[contenteditable='true']")
                if el.is_displayed()
            ),
            None,
        ),
        timeout=30,
    )
    type_rich_text(driver, editor, text)
    wait_until(lambda: text[:24] in editor.get_attribute("textContent"), timeout=20)

    submit = wait_until(
        lambda: next(
            (
                el
                for el in driver.find_elements(By.XPATH, "//button")
                if el.is_displayed()
                and re.search(r'(Post|Submit|Kirim|Tambahkan jawaban|Add Answer)', (el.text or '').strip(), re.I)
            ),
            None,
        ),
        timeout=25,
    )
    submit.click()
    time.sleep(10)
    capture(driver, "quora_answered")
    ok = text.splitlines()[0] in driver.page_source
    return {"ok": ok, "url": url or driver.current_url}


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    driver = build_driver()
    results = {}
    try:
        if mode in ("all", "x"):
            print("Running X post...")
            results["x"] = post_x(driver)
        if mode == "xVerify":
            print("Running X verification...")
            results["xVerify"] = verify_x_post(driver)
        if mode in ("all", "quoraPost"):
            print("Running Quora post...")
            results["quoraPost"] = post_quora_post(driver)
        if mode == "quoraVerify":
            print("Running Quora verification...")
            results["quoraVerify"] = verify_quora_post_only(driver)
        if mode in ("all", "quoraAnswer"):
            print("Running Quora answer...")
            results["quoraAnswer"] = post_quora_answer(driver)
        print(json.dumps(results, indent=2))
    finally:
        driver.quit()


if __name__ == "__main__":
    main()
