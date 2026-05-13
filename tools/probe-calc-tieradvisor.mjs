// probe-calc-tieradvisor.mjs — v1.17.2 runtime audit for tier-advisor.html
import puppeteer from 'puppeteer';

const PAGE_URL = `http://localhost:8081/tier-advisor.html?nc=${Date.now()}`;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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

  // Set premium session on first load
  await page.goto('http://localhost:8081/tier-advisor.html', { waitUntil: 'networkidle2', timeout: 30000 });
  await page.evaluate(() => {
    localStorage.setItem('rz_premium_session', JSON.stringify({
      email: 'bagus@resistancezero.com',
      expires: '2099-12-31T00:00:00Z',
      tier: 'pro',
      role: 'root'
    }));
  });

  // Reload with premium session active
  await page.goto(PAGE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(500);

  // 1. Enumerate all inline event handler attributes
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

  // 2. Extract unique function names from handler values
  const fnNames = new Set();
  handlers.forEach(h => {
    const match = h.value.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/);
    if (match) fnNames.add(match[1]);
  });

  // 3. Check window accessibility for each function
  const missingFns = await page.evaluate((names) => {
    return names.filter(name => typeof window[name] !== 'function');
  }, [...fnNames]);

  // 4. Test button clicks for ReferenceError (careful - no waitForTimeout which is deprecated)
  const buttonsBroken = [];
  const buttonHandles = await page.$$('button');
  for (const btn of buttonHandles) {
    const prevErrors = pageErrors.length;
    try {
      await btn.click();
      await sleep(150);
    } catch (e) {}
    if (pageErrors.length > prevErrors) {
      try {
        const label = await btn.evaluate(el => el.textContent.trim().slice(0, 60));
        buttonsBroken.push(label);
      } catch(e) {}
    }
  }

  // 5. Check Pro session is present
  const proUnlockOk = await page.evaluate(() => {
    return !!localStorage.getItem('rz_premium_session');
  });

  // 6. Mobile viewport check (fresh page to avoid frame detachment)
  const mobilePage = await browser.newPage();
  await mobilePage.setViewport({ width: 375, height: 667 });
  await mobilePage.evaluate(() => {
    localStorage.setItem('rz_premium_session', JSON.stringify({
      email: 'bagus@resistancezero.com', expires: '2099-12-31T00:00:00Z', tier: 'pro', role: 'root'
    }));
  });
  await mobilePage.goto(`http://localhost:8081/tier-advisor.html?nc2=${Date.now()}`, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(500);

  const mobileBurgerVisible = await mobilePage.evaluate(() => {
    const burger = document.querySelector('.rz-nav-burger, .hamburger, .mobile-menu-btn, .nav-burger');
    if (!burger) return false;
    const style = window.getComputedStyle(burger);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
  const mobileBackLinkPresent = await mobilePage.evaluate(() => {
    return !!document.querySelector('.nav-back, a[href="index.html"], a[href="/"]');
  });
  await mobilePage.close();

  const issues = [];
  if (missingFns.length > 0) issues.push(`Missing window exports: ${missingFns.join(', ')}`);
  if (buttonsBroken.length > 0) issues.push(`Buttons throwing errors: ${buttonsBroken.join('; ')}`);
  if (!proUnlockOk) issues.push('Pro/premium unlock not confirmed');
  if (!mobileBurgerVisible) issues.push('Mobile burger button not visible');
  if (!mobileBackLinkPresent) issues.push('Mobile back-link not present');

  const summary = {
    page: 'tier-advisor.html',
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
