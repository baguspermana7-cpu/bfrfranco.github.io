import puppeteer from 'puppeteer';
import http from 'http';
import { createReadStream, statSync } from 'fs';
import { join, extname } from 'path';
const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 8107;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    try { statSync(join(ROOT, p)); res.setHeader('Content-Type', MIME[extname(p)] ?? 'application/octet-stream'); createReadStream(join(ROOT, p)).pipe(res); }
    catch { res.statusCode = 404; res.end(); }
});
await new Promise((r) => server.listen(PORT, r));
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
await page.evaluateOnNewDocument(() => localStorage.setItem('rz_premium_session', JSON.stringify({ email: 'baguspermana7@gmail.com', tier: 'root', role: 'root', expires: Date.now() + 864e5 })));
await page.goto(`http://localhost:${PORT}/rz-ops-p7x3k9m.html`, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));
const r1 = await page.evaluate(() => {
    const nav = [...document.querySelectorAll('.nav-item')].find((n) => n.textContent.includes('Owner Actions'));
    if (nav) nav.click();
    return { nav: !!nav, badge: document.getElementById('oaBadge')?.textContent };
});
await new Promise((r) => setTimeout(r, 600));
const r2 = await page.evaluate(() => {
    const cards = document.querySelectorAll('#oaList .fs-card').length;
    const cb = document.querySelector('#oaList input[data-oa]');
    if (cb) cb.click();
    return { cards };
});
await new Promise((r) => setTimeout(r, 400));
const r3 = await page.evaluate(() => ({
    badge: document.getElementById('oaBadge')?.textContent,
    persisted: JSON.parse(localStorage.getItem('rz_owner_actions_v1') || '{}'),
}));
console.log(JSON.stringify({ ...r1, ...r2, after: r3, errs }, null, 1));
await browser.close(); server.close();
