import puppeteer from 'puppeteer';
const URL = `https://resistancezero.com/spares-readiness-calculator.html?nc=${Date.now()}`;
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'] });
const page = await browser.newPage();
const errors=[], pageErrors=[];
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => pageErrors.push(`${e.name}: ${e.message}`));
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
const exposure = await page.evaluate(() => ({
  switchTab: typeof window.switchTab, tourNext: typeof window.tourNext, tourEnd: typeof window.tourEnd,
  calcCriticality: typeof window.calcCriticality, toggleTheme: typeof window.toggleTheme,
}));
const cards = await page.evaluate(() => ({
  rpn: document.getElementById('c1_rpn')?.textContent,
  eff_sev: document.getElementById('c1_eff_sev')?.textContent,
}));
const version = await page.evaluate(() => window.RZ_VERSION || 'unknown');
console.log('LIVE version:', version);
console.log('LIVE exposure:', JSON.stringify(exposure));
console.log('LIVE cards:', JSON.stringify(cards));
console.log('LIVE console errors:', errors.length); errors.slice(0,10).forEach(e=>console.log('  ',e.slice(0,200)));
console.log('LIVE page errors:', pageErrors.length); pageErrors.slice(0,10).forEach(e=>console.log('  ',e));
await browser.close();
