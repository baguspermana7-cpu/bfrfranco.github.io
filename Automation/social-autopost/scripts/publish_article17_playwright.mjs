import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = '/home/baguspermana7/rz-work/Article/Post Draft/Article 17 - SEA DC Opportunity';
const COOKIE_SNAPSHOT = '/home/baguspermana7/session_cookies_article17.json';

function readText(file) {
  return fs.readFile(file, 'utf8').then((s) => s.trim());
}

async function loadCookieSnapshot() {
  const raw = await fs.readFile(COOKIE_SNAPSHOT, 'utf8');
  return JSON.parse(raw);
}

function hostEndsWith(host, suffix) {
  const normalized = host.replace(/^\./, '');
  return normalized === suffix || normalized.endsWith(`.${suffix}`);
}

function normalizeExpiry(value) {
  if (!value || value <= 0) return -1;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return -1;
  return n > 9999999999 ? Math.floor(n / 1000) : Math.floor(n);
}

async function firefoxCookies(predicate) {
  const rows = await loadCookieSnapshot();
  return rows
    .filter(predicate)
    .map((row) => ({
      name: row.name,
      value: row.value,
      domain: row.host,
      path: row.path || '/',
      expires: normalizeExpiry(row.expiry),
      secure: !!row.isSecure,
      httpOnly: !!row.isHttpOnly,
      sameSite: 'Lax',
    }));
}

async function buildContext() {
  const browser = await chromium.launch({
    headless: false,
    executablePath: '/snap/bin/chromium',
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 980 },
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'Asia/Jakarta',
  });

  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {} };
  });

  return { browser, context };
}

async function fillRichEditor(page, editor, text) {
  await editor.click();
  await page.waitForTimeout(300);

  const tryRead = async () => {
    return editor.evaluate((node) => {
      const value = (node.innerText || node.textContent || '').trim();
      return value;
    }).catch(() => '');
  };

  const tryStrategies = [
    async () => {
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => {});
      await page.keyboard.press('Backspace').catch(() => {});
      await page.keyboard.insertText(text);
    },
    async () => {
      await editor.evaluate((node, value) => {
        node.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(node);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand('insertText', false, value);
        node.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: value,
        }));
      }, text);
    },
    async () => {
      await editor.pressSequentially(text, { delay: 18 });
    },
  ];

  for (const strategy of tryStrategies) {
    await editor.click().catch(() => {});
    await strategy().catch(() => {});
    await page.waitForTimeout(1200);
    const current = await tryRead();
    if (current.includes(text.slice(0, 32))) return current;
  }

  return tryRead();
}

async function postToX(context, text) {
  console.log('X: preparing cookies');
  const cookies = (await firefoxCookies(
    (row) => hostEndsWith(row.host, 'x.com') || hostEndsWith(row.host, 'twitter.com')
  )).filter((c) => c.value);
  await context.addCookies(cookies);

  const page = await context.newPage();
  try {
    console.log('X: goto compose');
    await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});

    const editor = page.locator(
      '[data-testid="tweetTextarea_0"], div[role="textbox"][contenteditable="true"]'
    ).first();
    console.log('X: waiting for editor');
    await editor.waitFor({ state: 'visible', timeout: 60000 });
    const editorText = await fillRichEditor(page, editor, text);
    if (!editorText.includes('Last week I published')) {
      throw new Error(`X composer text did not stick. Current editor text: ${editorText.slice(0, 200)}`);
    }

    const button = page.locator(
      '[data-testid="tweetButtonInline"], [data-testid="tweetButton"]'
    ).last();
    console.log('X: waiting for button');
    await button.waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForFunction(() => {
      const btn = document.querySelector('[data-testid="tweetButtonInline"], [data-testid="tweetButton"]');
      return !!btn && !btn.hasAttribute('disabled') && btn.getAttribute('aria-disabled') !== 'true';
    }, { timeout: 30000 });
    await button.click();
    console.log('X: clicked post');

    await page.waitForTimeout(6000);

    const bodyText = await page.locator('body').innerText().catch(() => '');
    const blocked = /automated|try again later|cannot complete this action/i.test(bodyText);
    if (blocked) {
      throw new Error(`X UI reported automation block: ${bodyText.slice(0, 400)}`);
    }

    await page.screenshot({ path: '/tmp/socialbot/x-post-result.png', fullPage: true });
    return { ok: true, url: page.url() };
  } catch (error) {
    await page.screenshot({ path: '/tmp/socialbot/x-post-error.png', fullPage: true }).catch(() => {});
    await fs.writeFile('/tmp/socialbot/x-post-error.html', await page.content().catch(() => '')).catch(() => {});
    return { ok: false, error: String(error) };
  } finally {
    await page.close().catch(() => {});
  }
}

async function postToMastodonWithBrowser(context, posts) {
  const cookies = (await firefoxCookies(
    (row) => hostEndsWith(row.host, 'mastodon.social')
  )).filter((c) => c.value);
  await context.addCookies(cookies);
  const page = await context.newPage();
  const urls = [];
  try {
    await page.goto('https://mastodon.social/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
    for (let i = 0; i < posts.length; i += 1) {
      const editor = page.locator('div[role="textbox"][contenteditable="true"]').first();
      await editor.waitFor({ state: 'visible', timeout: 60000 });
      await editor.click();
      await editor.fill('');
      await page.keyboard.insertText(posts[i]);
      const publish = page.getByRole('button', { name: /Post|Publish|Toot/i }).last();
      await publish.click();
      await page.waitForTimeout(4000);
      urls.push(page.url());
    }
    return { ok: true, urls };
  } catch (error) {
    await page.screenshot({ path: '/tmp/socialbot/mastodon-ui-error.png', fullPage: true }).catch(() => {});
    return { ok: false, error: String(error) };
  } finally {
    await page.close().catch(() => {});
  }
}

async function createQuoraPost(context, text) {
  console.log('Quora post: preparing cookies');
  const cookies = (await firefoxCookies(
    (row) => hostEndsWith(row.host, 'quora.com')
  )).filter((c) => c.value);
  await context.addCookies(cookies);
  const page = await context.newPage();
  try {
    console.log('Quora post: goto home');
    await page.goto('https://www.quora.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});

    const openComposer = page.getByText(/What do you want to ask or share|Create Post|Share/i).first();
    console.log('Quora post: waiting for composer trigger');
    await openComposer.waitFor({ state: 'visible', timeout: 60000 });
    await openComposer.click();
    await page.waitForTimeout(2000);

    const maybePostTab = page.getByText(/^Post$/).first();
    if (await maybePostTab.isVisible().catch(() => false)) {
      await maybePostTab.click().catch(() => {});
    }

    const editor = page.locator('div[contenteditable="true"]').nth(0);
    console.log('Quora post: waiting for editor');
    await editor.waitFor({ state: 'visible', timeout: 60000 });
    await editor.click();
    await page.keyboard.insertText(text);
    await page.waitForTimeout(1500);

    const postButton = page.getByRole('button', { name: /^Post$/ }).last();
    console.log('Quora post: waiting for post button');
    await postButton.waitFor({ state: 'visible', timeout: 30000 });
    await postButton.click();
    console.log('Quora post: clicked post');
    await page.waitForTimeout(6000);

    const body = await page.locator('body').innerText().catch(() => '');
    if (/Something went wrong|Try again|error/i.test(body)) {
      throw new Error(`Quora post UI reported failure: ${body.slice(0, 400)}`);
    }

    await page.screenshot({ path: '/tmp/socialbot/quora-post-result.png', fullPage: true });
    return { ok: true, url: page.url() };
  } catch (error) {
    await page.screenshot({ path: '/tmp/socialbot/quora-post-error.png', fullPage: true }).catch(() => {});
    await fs.writeFile('/tmp/socialbot/quora-post-error.html', await page.content().catch(() => '')).catch(() => {});
    return { ok: false, error: String(error), url: page.url() };
  } finally {
    await page.close().catch(() => {});
  }
}

async function createQuoraAnswer(context, text) {
  console.log('Quora answer: preparing cookies');
  const cookies = (await firefoxCookies(
    (row) => hostEndsWith(row.host, 'quora.com')
  )).filter((c) => c.value);
  await context.addCookies(cookies);
  const page = await context.newPage();
  const candidates = [
    'Where should data centers be built in Southeast Asia?',
    'Why is Southeast Asia attractive for data centers?',
    'What is the data center market opportunity in SEA?',
    'Which SEA countries are best for data center investment?',
  ];

  try {
    let openedQuestion = false;
    for (const candidate of candidates) {
      console.log('Quora answer: searching', candidate);
      await page.goto(`https://www.quora.com/search?q=${encodeURIComponent(candidate)}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
      const links = page.locator('a[href*="/"]');
      const count = await links.count();
      for (let i = 0; i < Math.min(count, 20); i += 1) {
        const link = links.nth(i);
        const href = await link.getAttribute('href').catch(() => null);
        const label = (await link.innerText().catch(() => '')).trim();
        if (href && /\?/.test(label) && /data center|Southeast Asia|SEA/i.test(label)) {
          await link.click();
          openedQuestion = true;
          break;
        }
      }
      if (openedQuestion) break;
    }

    if (!openedQuestion) throw new Error('Could not find a suitable Quora question to answer.');

    await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
    const answerButton = page.getByRole('button', { name: /Answer/i }).first();
    console.log('Quora answer: waiting for answer button');
    await answerButton.waitFor({ state: 'visible', timeout: 60000 });
    await answerButton.click();
    await page.waitForTimeout(2500);

    const editor = page.locator('div[contenteditable="true"]').last();
    console.log('Quora answer: waiting for editor');
    await editor.waitFor({ state: 'visible', timeout: 60000 });
    await editor.click();
    await page.keyboard.insertText(text);
    await page.waitForTimeout(1500);

    const submit = page.getByRole('button', { name: /Post|Submit|Add Answer/i }).last();
    console.log('Quora answer: waiting for submit button');
    await submit.waitFor({ state: 'visible', timeout: 30000 });
    await submit.click();
    console.log('Quora answer: clicked submit');
    await page.waitForTimeout(7000);

    const body = await page.locator('body').innerText().catch(() => '');
    if (/Something went wrong|Try again|error/i.test(body)) {
      throw new Error(`Quora answer UI reported failure: ${body.slice(0, 400)}`);
    }

    await page.screenshot({ path: '/tmp/socialbot/quora-answer-result.png', fullPage: true });
    return { ok: true, url: page.url() };
  } catch (error) {
    await page.screenshot({ path: '/tmp/socialbot/quora-answer-error.png', fullPage: true }).catch(() => {});
    await fs.writeFile('/tmp/socialbot/quora-answer-error.html', await page.content().catch(() => '')).catch(() => {});
    return { ok: false, error: String(error), url: page.url() };
  } finally {
    await page.close().catch(() => {});
  }
}

async function main() {
  const mode = process.argv[2] || 'all';
  const xText = await readText(path.join(BASE, 'x-post.txt'));
  const mastodonPosts = await Promise.all([
    readText(path.join(BASE, 'mastodon-post-1.txt')),
    readText(path.join(BASE, 'mastodon-post-2.txt')),
    readText(path.join(BASE, 'mastodon-post-3.txt')),
  ]);
  const quoraPost = await readText(path.join(BASE, 'quora-post.txt'));
  const quoraAnswer = await readText(path.join(BASE, 'quora-answer.txt'));

  const { browser, context } = await buildContext();
  const results = {};
  try {
    if (mode === 'all' || mode === 'x') results.x = await postToX(context, xText);
    if (mode === 'all' || mode === 'quoraPost') results.quoraPost = await createQuoraPost(context, quoraPost);
    if (mode === 'all' || mode === 'quoraAnswer') results.quoraAnswer = await createQuoraAnswer(context, quoraAnswer);
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
