/* AF probe: architecture diagram param-reactivity + symbols/groups/buses. */
import puppeteer from 'puppeteer';
import http from 'http';
import { createReadStream, statSync } from 'fs';
import { join, extname } from 'path';
const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 8100;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    try { statSync(join(ROOT, p)); res.setHeader('Content-Type', MIME[extname(p)] ?? 'application/octet-stream'); createReadStream(join(ROOT, p)).pipe(res); }
    catch { res.statusCode = 404; res.end(); }
});
await new Promise((r) => server.listen(PORT, r));
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 950 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 150)));
await page.evaluateOnNewDocument(() => localStorage.setItem('dcmoc-auth', JSON.stringify({ state: { user: { email: 'b@r.com', role: 'root' } }, version: 0 })));
await page.goto(`http://localhost:${PORT}/dcmoc/`, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));
await page.evaluate(() => { [...document.querySelectorAll('aside button')].find((x) => x.textContent.includes('Architecture'))?.click(); });
await new Promise((r) => setTimeout(r, 400));
await page.evaluate(() => { const b = [...document.querySelectorAll('aside button')].find((x) => x.textContent.trim() === 'Architecture Engine'); b?.click(); });
await new Promise((r) => setTimeout(r, 1800));
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  ✔', n); } else { fail++; console.log('  ✘', n); } };
const svgInfo = await page.evaluate(() => {
    const svgs = [...document.querySelectorAll('svg')];
    const d = svgs.map((s) => ({ titles: s.querySelectorAll('title').length, texts: [...s.querySelectorAll('text')].map((t) => t.textContent) }))
        .sort((a, b) => b.titles - a.titles)[0];
    return d ?? { titles: 0, texts: [] };
});
ok('diagram has hover titles (>=15)', svgInfo.titles >= 15);
const allText = svgInfo.texts.join('|');
ok('group boxes (POWER TRAIN / IT HALL / COOLING)', /POWER TRAIN/.test(allText) && /IT HALL/.test(allText) && /COOLING PLANT/.test(allText));
ok('transformers stage', /Transformer/i.test(allText));
ok('IT cells from mix', /AI \/ GPU Cell/.test(allText));
ok('utility label present', /Utility|Feed/i.test(allText));
// param reactivity: change grid voltage in requirements → diagram label changes
await page.evaluate(() => { const b = [...document.querySelectorAll('aside button')].find((x) => x.textContent.includes('Requirements')); b?.click(); });
await new Promise((r) => setTimeout(r, 400));
await page.evaluate(() => { const b = [...document.querySelectorAll('aside button')].find((x) => x.textContent.trim() === 'Requirements & Workload'); b?.click(); });
await new Promise((r) => setTimeout(r, 1200));
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '20kV'); b?.click(); });
await new Promise((r) => setTimeout(r, 500));
await page.evaluate(() => { const b = [...document.querySelectorAll('aside button')].find((x) => x.textContent.trim() === 'Architecture Engine'); b?.click(); });
await new Promise((r) => setTimeout(r, 1500));
const v2 = await page.evaluate(() => [...document.querySelectorAll('svg text')].map((t) => t.textContent).join('|'));
ok('REACTIVITY: 20kV propagates to diagram', /20kV/.test(v2));
await page.screenshot({ path: '/tmp/arch-af.png' });
ok('0 page errors', errors.length === 0);
await browser.close(); server.close();
console.log(`RESULT: ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
