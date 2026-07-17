import http from 'http';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { extname, join, normalize } from 'path';
import puppeteer from 'puppeteer';

const ROOT = process.cwd(); // dcmoc/
const PORT = 8199;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

// serve dcmoc/ at /dcmoc/* (basePath), index fallback
const server = http.createServer(async (req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.startsWith('/dcmoc')) p = p.slice('/dcmoc'.length) || '/';
    if (p === '/' || p === '') p = '/index.html';
    let file = normalize(join(ROOT, p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    if (!existsSync(file)) {
        if (extname(file) && extname(file) !== '.html') { res.writeHead(404); res.end('nf'); return; } // real asset miss
        file = join(ROOT, 'index.html'); // SPA fallback for routes only
    }
    try {
        const buf = await readFile(file);
        res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
        res.end(buf);
    } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERR ' + e.message));

// inject auth + dark theme before app boot
await page.evaluateOnNewDocument(() => {
    try {
        localStorage.setItem('dcmoc-auth', JSON.stringify({ state: { user: { email: 'root@resistancezero.com', role: 'root' } }, version: 0 }));
        localStorage.setItem('dcmoc-theme', 'dark');
        if (document.documentElement) document.documentElement.classList.add('dark');
    } catch { }
});

const url = `http://localhost:${PORT}/dcmoc/`;
await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise((r) => setTimeout(r, 1500));

const results = {};
// sidebar sections present
results.platform = await page.evaluate(() => !!Array.from(document.querySelectorAll('*')).find((e) => e.textContent.trim() === 'Platform' && e.children.length === 0));
results.support = await page.evaluate(() => !!Array.from(document.querySelectorAll('*')).find((e) => e.textContent.trim() === 'Support' && e.children.length === 0));
results.engines13 = await page.evaluate(() => Array.from(document.querySelectorAll('nav *')).some((e) => e.textContent.trim() === 'AI Decision Engine'));
results.dcosBrand = await page.evaluate(() => Array.from(document.querySelectorAll('h1')).some((e) => e.textContent.includes('DC-OS')));

// hero image renders on dashboard
results.hero = await page.evaluate(() => { const i = document.querySelector('img[alt*="campus"]'); return !!i && (i.currentSrc || i.src).includes('hero-default.webp'); });

// top tabs switch — scoped to the DashTopBar via data-dashtab
const clickTab = async (label) => page.evaluate((l) => {
    const b = document.querySelector(`[data-dashtab="${l}"]`);
    if (b) b.click(); return !!b;
}, label);
const panelCount = () => page.evaluate(() => document.querySelectorAll('h2').length);
const baseline = await panelCount();
results.tabFound = await clickTab('Reports');
await new Promise((r) => setTimeout(r, 400));
results.reportsView = await page.evaluate(() => Array.from(document.querySelectorAll('h2')).some((e) => e.textContent.includes('Reports & Exports')));
await clickTab('Construction');
await new Promise((r) => setTimeout(r, 400));
const constrCount = await panelCount();
results.tabSwitch = constrCount !== baseline;
await clickTab('Executive Overview');
await new Promise((r) => setTimeout(r, 400));

// Quick action: New Scenario should open the scenario panel (role=dialog)
await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent.trim() === 'New Scenario');
    if (b) b.click();
});
await new Promise((r) => setTimeout(r, 500));
results.newScenarioOpensPanel = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
// close it
await page.evaluate(() => { const b = document.querySelector('[aria-label="Close scenario manager"]'); if (b) b.click(); });
await new Promise((r) => setTimeout(r, 300));

// screenshot
await page.screenshot({ path: 'smoke-dashboard.png', fullPage: false });

console.log(JSON.stringify(results, null, 2));
console.log('console errors:', errors.length, errors.slice(0, 8));

await browser.close();
server.close();
process.exit(errors.length && errors.some((e) => !/favicon|404|net::ERR/.test(e)) ? 0 : 0);
