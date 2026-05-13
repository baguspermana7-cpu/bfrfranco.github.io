// probe-calc-cx.mjs — v1.17.2 runtime audit for cx-calculator.html
import puppeteer from 'puppeteer';

const PAGE_URL = `http://localhost:8081/cx-calculator.html?nc=${Date.now()}`;

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (!t.includes('cdn.jsdelivr') && !t.includes('Failed to load resource')) consoleErrors.push(t);
    }
  });
  page.on('pageerror', err => {
    if (!err.message.includes('Chart is not defined') && !err.message.includes('cdn.jsdelivr')) {
      pageErrors.push(err.message);
    }
  });

  await page.goto('http://localhost:8081/cx-calculator.html', { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    localStorage.setItem('rz_premium_session', JSON.stringify({
      email: 'bagus@resistancezero.com',
      expires: '2099-12-31T00:00:00Z',
      tier: 'pro',
      role: 'root'
    }));
  });
  await page.goto(PAGE_URL, { waitUntil: 'networkidle2' });

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

  const fnNames = new Set();
  handlers.forEach(h => {
    const match = h.value.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/);
    if (match) fnNames.add(match[1]);
  });

  const missingFns = await page.evaluate((names) => {
    return names.filter(name => typeof window[name] !== 'function');
  }, [...fnNames]);

  const buttonsBroken = [];
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const prevErrors = pageErrors.length;
    try {
      await btn.click();
      await page.waitForTimeout(100);
    } catch (e) {}
    if (pageErrors.length > prevErrors) {
      const label = await btn.evaluate(el => el.textContent.trim().slice(0, 60));
      buttonsBroken.push(label);
    }
  }

  const proUnlockOk = await page.evaluate(() => {
    const session = localStorage.getItem('rz_premium_session');
    if (!session) return false;
    return typeof cxIsPremium !== 'undefined' && cxIsPremium === true;
  });

  await page.setViewport({ width: 375, height: 667 });
  await page.reload({ waitUntil: 'networkidle2' });
  const mobileBurgerVisible = await page.evaluate(() => {
    const burger = document.querySelector('.rz-nav-burger, .hamburger, .mobile-menu-btn, .nav-burger');
    if (!burger) return false;
    const style = window.getComputedStyle(burger);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
  const mobileBackLinkPresent = await page.evaluate(() => {
    return !!document.querySelector('.nav-back, a[href="index.html"], a[href="/"]');
  });

  const issues = [];
  if (missingFns.length > 0) issues.push(`Missing window exports: ${missingFns.join(', ')}`);
  if (buttonsBroken.length > 0) issues.push(`Buttons throwing errors: ${buttonsBroken.join('; ')}`);
  if (!proUnlockOk) issues.push('cxIsPremium not set to true after premium session');
  if (!mobileBurgerVisible) issues.push('Mobile burger button not visible');
  if (!mobileBackLinkPresent) issues.push('Mobile back-link not present');

  const summary = {
    page: 'cx-calculator.html',
    consoleErrors: consoleErrors.length,
    consoleErrorSamples: consoleErrors.slice(0, 5),
    pageErrors: pageErrors.length,
    pageErrorSamples: pageErrors.slice(0, 5),
    handlersTotal: handlers.length,
    handlersMissing: missingFns,
    buttonsBroken,
    proUnlockOk,
    mobileBurgerVisible,
    mobileBackLinkPresent,
    issues
  };

  console.log(JSON.stringify(summary, null, 2));
  await browser.close();
  process.exit(issues.length === 0 ? 0 : 1);
})();
