import puppeteer from 'puppeteer';
import http from 'http';
import { createReadStream, statSync } from 'fs';
import { join, extname } from 'path';
const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 8101;
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
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  ✔', n); } else { fail++; console.log('  ✘', n); } };
const go = async (label) => {
    await page.evaluate((l) => { const b = [...document.querySelectorAll('aside button')].find((x) => x.textContent.trim() === l); b?.click(); }, label);
    await new Promise((r) => setTimeout(r, 1200));
    return page.evaluate(() => document.body.innerText);
};
let t = await go('Scenarios');
ok('Scenarios page mounts', /Total Scenarios/i.test(t));
t = await go('Scenario Comparison');
ok('Comparison page mounts', /Scenario Comparison/i.test(t));
t = await go('Templates');
ok('Templates reference layout', /Template Library/i.test(t) && /Use This Template/i.test(t));
t = await go('Data Library');
ok('Data Library KPI chips', /Provenance Entries/i.test(t));
t = await go('Projects');
ok('Projects KPI chips', /Engines Ready/i.test(t));
t = await go('Settings');
ok('Settings overview', /Quick Settings/i.test(t) && /Platform Information/i.test(t));
t = await go('Integrations');
console.log('  [dbg]', t.slice(0, 200).replace(/\n/g, ' | '));
ok('Integrations table layout', /Add Custom Integration/i.test(t));
ok('0 page errors', errors.length === 0);
await page.screenshot({ path: '/tmp/platform-ae.png' });
await browser.close(); server.close();
console.log(`RESULT: ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
