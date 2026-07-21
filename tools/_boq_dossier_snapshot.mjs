/* One-shot: drive DCMOC headless, click the BOQ button, capture the dossier
 * print-window HTML, then screenshot it + save a PDF. Output to /tmp.
 * Run: node tools/_boq_dossier_snapshot.mjs */
import puppeteer from 'puppeteer';
import http from 'http';
import { createReadStream, statSync, writeFileSync } from 'fs';
import { join, extname } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 8099;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const file = join(ROOT, p);
    try { statSync(file); res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream'); createReadStream(file).pipe(res); }
    catch { res.statusCode = 404; res.end('nf'); }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000 });
page.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 160)));

await page.evaluateOnNewDocument(() => {
    localStorage.setItem('dcmoc.tour.v1', 'seen');
    localStorage.setItem('dcmoc-auth', JSON.stringify({ state: { user: { email: 'b@r.com', role: 'root' } }, version: 0 }));
    window.__boq = '';
    window.open = () => ({ document: { write: (h) => { window.__boq += h; }, close() {} }, print() {}, close() {}, focus() {} });
});
await page.goto(`http://localhost:${PORT}/dcmoc/`, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));

/* click an aside/nav item whose text matches, best-effort */
async function navClick(text) {
    return page.evaluate((t) => {
        const b = [...document.querySelectorAll('aside button, nav button, button')].find((x) => x.textContent.trim().toLowerCase().includes(t.toLowerCase()));
        if (b) { b.click(); return b.textContent.trim(); } return null;
    }, text);
}

/* ensure CAPEX computed then land on Construction Engine (has the BOQ button) */
async function clickTab(re) {
    return page.evaluate((rs) => {
        const rx = new RegExp(rs, 'i');
        const b = [...document.querySelectorAll('button')].find((x) => rx.test(x.textContent.trim()));
        if (b) { b.click(); return b.textContent.trim(); } return null;
    }, re);
}
console.log('tab CAPEX:', await clickTab('^5\\.|5\\.CAPEX|\\bCAPEX\\b'));
await new Promise((r) => setTimeout(r, 2000));
console.log('tab Construction:', await clickTab('^6\\.|6\\.Construction|\\bConstruction\\b'));
await new Promise((r) => setTimeout(r, 2500));

async function clickBoq() {
    return page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => /bill of quantities|\bboq\b/i.test(x.textContent));
        if (b) { b.click(); return b.textContent.trim(); } return null;
    });
}
let clicked = await clickBoq();
console.log('boq button:', clicked);
if (!clicked) { console.log('buttons here:', await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).filter(Boolean).slice(0, 50))); }
await new Promise((r) => setTimeout(r, 1500));
let html = await page.evaluate(() => window.__boq);

if (!html || html.length < 500) {
    console.log('FAILED to capture dossier html. Dumping button texts:');
    console.log(await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).filter(Boolean).slice(0, 60)));
    await browser.close(); server.close(); process.exit(1);
}

const htmlPath = '/tmp/boq-dossier.html';
writeFileSync(htmlPath, html);
console.log('dossier html bytes:', html.length, '→', htmlPath);

/* render the captured dossier + screenshot full page + PDF */
const p2 = await browser.newPage();
await p2.setViewport({ width: 1240, height: 1600 });
await p2.goto('file://' + htmlPath, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 800));
await p2.screenshot({ path: '/tmp/boq-dossier-full.png', fullPage: true });
await p2.pdf({ path: '/tmp/boq-dossier.pdf', format: 'A4', printBackground: true });
console.log('screenshot → /tmp/boq-dossier-full.png');
console.log('pdf → /tmp/boq-dossier.pdf');

await browser.close(); server.close();
