import http from 'http';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { extname, join, normalize } from 'path';
import puppeteer from 'puppeteer';

const ROOT = process.cwd();
const PORT = 8198;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.startsWith('/dcmoc')) p = p.slice(6) || '/';
    if (p === '/' || p === '') p = '/index.html';
    let file = normalize(join(ROOT, p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    if (!existsSync(file)) { if (extname(file) && extname(file) !== '.html') { res.writeHead(404); res.end(); return; } file = join(ROOT, 'index.html'); }
    try { res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' }); res.end(await readFile(file)); }
    catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const VPS = [{ n: 'mobile', w: 390, h: 844 }, { n: 'tablet', w: 768, h: 1024 }];
const out = {};

const measure = () => ({});
for (const vp of VPS) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.w, height: vp.h });
    await page.evaluateOnNewDocument(() => {
        try {
            localStorage.setItem('dcmoc-auth', JSON.stringify({ state: { user: { email: 'root@resistancezero.com', role: 'root' } }, version: 0 }));
            localStorage.setItem('dcmoc-theme', 'dark');
        } catch { }
    });
    await page.goto(`http://localhost:${PORT}/dcmoc/`, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1200));
    const m = await page.evaluate(() => {
        const de = document.documentElement;
        const overflow = de.scrollWidth - de.clientWidth;
        const cw = de.clientWidth;
        const offenders = [];
        document.querySelectorAll('*').forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.right > cw + 2 && r.width > 40) offenders.push({ t: (el.tagName + '.' + (el.className?.toString ? el.className.toString() : '')).slice(0, 70), w: Math.round(r.width), right: Math.round(r.right) });
        });
        offenders.sort((a, b) => b.right - a.right);
        return { overflow, clientWidth: cw, offenders: offenders.slice(0, 6) };
    });
    out[`${vp.n}:dashboard`] = m;
    await page.screenshot({ path: `resp-${vp.n}.png` });
    await page.close();
}

console.log(JSON.stringify(out, null, 2));
await browser.close();
server.close();
