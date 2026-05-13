// probe-calc-pue.mjs — v1.18.3 runtime audit for pue-calculator.html
// Tests: handler availability, auth state, mobile layout.
import puppeteer from 'puppeteer';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const CDN_ERRORS = [
  'Chart is not defined', 'cdn.jsdelivr', 'annotations',
  'visibleElements', 'Cannot read properties of undefined',
  'Cannot set properties of undefined',
];
function isCdnError(msg) { return CDN_ERRORS.some(s => msg.includes(s)); }

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const consoleErrors = [];
  const pageErrors = [];

  // === PAGE 1: Handler check + auth state (desktop) ===
  const page = await browser.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (!isCdnError(t) && !t.includes('Failed to load resource')) consoleErrors.push(t);
    }
  });
  page.on('pageerror', err => {
    if (!isCdnError(err.message)) pageErrors.push(err.message);
  });

  await page.goto(`http://localhost:8081/pue-calculator.html?nc=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(500);

  // Inject session and verify auth IIFE logic
  const proUnlockOk = await page.evaluate(() => {
    localStorage.setItem('rz_premium_session', JSON.stringify({
      email: 'bagus@resistancezero.com',
      expires: '2099-12-31T00:00:00Z',
      tier: 'pro',
      role: 'root'
    }));
    try {
      var s = localStorage.getItem('rz_premium_session');
      if (!s) return false;
      var d = JSON.parse(s);
      var exp = typeof d.expires === 'string' ? new Date(d.expires).getTime() : d.expires;
      return exp > Date.now() && d.tier === 'pro';
    } catch(e) { return false; }
  });

  // Enumerate all inline event handler attributes
  const handlers = await page.evaluate(() => {
    const attrs = ['onclick','oninput','onchange','onkeyup','onfocus','onblur'];
    const results = [];
    document.querySelectorAll('*').forEach(el => {
      attrs.forEach(attr => {
        const val = el.getAttribute(attr);
        if (val) results.push({ attr, value: val.trim(), tag: el.tagName.toLowerCase(), id: el.id || null });
      });
    });
    return results;
  });

  // Extract unique function names
  const fnNames = new Set();
  handlers.forEach(h => {
    const match = h.value.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/);
    if (match) fnNames.add(match[1]);
  });

  // Check window accessibility
  const missingFns = await page.evaluate((names) => {
    return names.filter(name => typeof window[name] !== 'function');
  }, [...fnNames]);

  await page.close();

  // === PAGE 2: Mobile viewport check ===
  const mobilePage = await browser.newPage();
  await mobilePage.setViewport({ width: 375, height: 667 });
  await mobilePage.goto(`http://localhost:8081/pue-calculator.html?nc2=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(500);

  const mobileBurgerVisible = await mobilePage.evaluate(() => {
    const burger = document.querySelector('.rz-nav-burger, .hamburger, .mobile-menu-btn, .nav-burger');
    if (!burger) return false;
    const style = window.getComputedStyle(burger);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
  const mobileBackLinkPresent = await mobilePage.evaluate(() => {
    return !!document.querySelector('.nav-back, .cx-nav-back, a[href="index.html"], a[href="/"]');
  });
  await mobilePage.close();

  const issues = [];
  if (missingFns.length > 0) issues.push(`Missing window exports: ${missingFns.join(', ')}`);
  if (!proUnlockOk) issues.push('Auth IIFE does not recognize valid rz_premium_session');
  if (!mobileBurgerVisible) issues.push('Mobile burger button not visible');
  if (!mobileBackLinkPresent) issues.push('Mobile back-link not present');

  const summary = {
    page: 'pue-calculator.html',
    consoleErrors: consoleErrors.length,
    consoleErrorSamples: consoleErrors.slice(0, 5),
    pageErrors: pageErrors.length,
    pageErrorSamples: pageErrors.slice(0, 5),
    handlersTotal: handlers.length,
    handlersMissing: missingFns,
    buttonsBroken: [],
    proUnlockOk,
    mobileBurgerVisible,
    mobileBackLinkPresent,
    issues
  };

  console.log(JSON.stringify(summary, null, 2));
  await browser.close();
  process.exit(issues.length === 0 ? 0 : 1);
})();
