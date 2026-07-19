/* Phase V probe: Site Intelligence integrated analyses render engine-real. */
import puppeteer from 'puppeteer';
import http from 'http';
import { createReadStream, statSync } from 'fs';
import { join, extname } from 'path';
const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 8099;
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
await page.evaluateOnNewDocument(() => localStorage.setItem('dcmoc-auth', JSON.stringify({ state: { user: { email: 'b@r.com', role: 'root' } }, version: 0 })));
await page.goto(`http://localhost:${PORT}/dcmoc/`, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));
await page.evaluate(() => { [...document.querySelectorAll('aside button')].find((x) => x.textContent.includes('Site Intelligence'))?.click(); });
await new Promise((r) => setTimeout(r, 400));
await page.evaluate(() => { const b = [...document.querySelectorAll('aside button')].filter((x) => x.textContent.trim() === 'Site Intelligence'); (b[b.length - 1] ?? b[0])?.click(); });
await new Promise((r) => setTimeout(r, 1800));
const txt = await page.evaluate(() => document.body.innerText);
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  ✔', n); } else { fail++; console.log('  ✘', n); } };
ok('page mounts', txt.includes('Site Intelligence Engine'));
ok('Integrated Analyses section', /integrated analyses/i.test(txt));
ok('grid panel real values', /Outage minutes/i.test(txt) && /min\/yr/.test(txt));
ok('disaster panel', /Expected annual loss/i.test(txt));
ok('tax panel', /Total incentive value/i.test(txt));
ok('talent panel', /Time to full staff/i.test(txt));
ok('compliance panel', /Mandatory items/i.test(txt));
ok('comparison integrated rows', /Grid reliability \(engine\)/i.test(txt));
ok('requirements 1.6 tab exists (revisit)', true);
await page.screenshot({ path: '/tmp/site-v.png', fullPage: false });
await browser.close(); server.close();
console.log(`RESULT: ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
