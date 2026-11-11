#!/usr/bin/env node
/**
 * test-manual-links.mjs — P17: every calculator input group links to its manual, and the manual links back.
 *  M1 registry: each of the 11 calculators has a `manual` entry; the manual file exists and loads rz-manual-links.js
 *  M2 per calculator (browser): >= 1 link and exactly one per matched group; every link's group id exists on the page; its manual anchor exists once the
 *     manual has run; the manual shows "Back to <calculator title> · <group>" and the back link returns to an id that
 *     exists on the calculator
 *  M3 real clicks on capex: the link opens the manual at the section, the section is marked, Back returns to the group
 *  M4 a hostile or malformed `from` (absolute URL, ../, javascript:, a path with a slash) shows no banner
 *  M5 reduced motion: no highlight; ?embed= copy: no links
 *  M6 390 px: no page-level horizontal scroll on a calculator with links or on a manual with the banner; no page errors
 * Run: node tools/test-manual-links.mjs
 */
import { join, dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fails = []; let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const reg = JSON.parse(readFileSync(join(ROOT, 'data/calculators.json'), 'utf8')).calculators;
/* M1 */
ok(reg.length === 11, 'M1 expected 11 calculators, got ' + reg.length);
for (const e of reg) {
  ok(e.manual && e.manual.page && e.manual.anchor && e.manual.groups, `M1 ${e.calc} has no complete manual entry`);
  if (!e.manual) continue;
  const f = join(ROOT, e.manual.page);
  ok(existsSync(f), `M1 ${e.calc}: ${e.manual.page} missing`);
  if (existsSync(f)) ok(/rz-manual-links\.js/.test(readFileSync(f, 'utf8')), `M1 ${e.manual.page} does not load rz-manual-links.js`);
  ok(/rz-manual-links\.js/.test(readFileSync(join(ROOT, e.page), 'utf8')), `M1 ${e.page} does not load rz-manual-links.js`);
}

const { default: puppeteer } = await import('puppeteer');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = join(ROOT, path === '/' ? 'index.html' : path);
    if (path.endsWith('/')) file = join(file, 'index.html');
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }).end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const errs = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function open(url, opts = {}) {
  const tab = await browser.newPage();
  await tab.setViewport({ width: opts.width || 1280, height: 900 });
  if (opts.reduce) await tab.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await tab.setRequestInterception(true);
  tab.on('request', (r) => (r.url().startsWith(base) ? r.continue() : r.abort()));
  tab.on('pageerror', (e) => errs.push(url + ': ' + String(e.message || e)));
  await tab.evaluateOnNewDocument(() => { try { localStorage.setItem('rz_cookie_consent', 'declined'); } catch (e) {} });
  await tab.goto(base + url, { waitUntil: 'load', timeout: 60000 });
  return tab;
}
const links = (tab) => tab.waitForSelector('.rz-manual-link', { timeout: 8000 }).then(() => tab.$$eval('.rz-manual-link', (a) => a.map((x) => ({ href: x.getAttribute('href'), label: x.getAttribute('aria-label') })))).catch(() => []);

try {
  /* M2 */
  let total = 0; const per = [];
  for (const e of reg) {
    const tab = await open(e.page);
    const ls = await links(tab);
    ok(ls.length >= 1, `M2 ${e.calc}: no manual links`);
    total += ls.length; per.push(e.calc + ' ' + ls.length);
    const groups = await tab.$$eval(e.manual.groups, (g) => g.length);
    ok(ls.length === groups, `M2 ${e.calc}: ${ls.length} links for ${groups} matched groups (every group gets its own)`);
    for (const l of ls) {
      const u = new URL(l.href, base + e.page), from = u.searchParams.get('from') || '', gid = from.split('#')[1];
      ok(gid && (await tab.$('#' + gid)) !== null, `M2 ${e.calc}: group id #${gid} is not on the page (${l.label})`);
    }
    await tab.close();
    if (!ls.length) continue;
    const mt = await open(e.manual.page + ls[0].href.slice(ls[0].href.indexOf('?')));
    await sleep(300);
    ok((await mt.$('#' + e.manual.anchor)) !== null, `M2 ${e.calc}: manual anchor #${e.manual.anchor} missing in ${e.manual.page}`);
    const bar = await mt.$eval('.rz-manual-back', (b) => ({ t: b.textContent, h: b.querySelector('a').getAttribute('href') })).catch(() => null);
    ok(bar && bar.t.includes('Back to ' + e.title), `M2 ${e.calc}: banner should name "${e.title}": ${bar && bar.t}`);
    ok(bar && bar.t.includes(ls[0].label.replace(/^Manual: /, '').slice(0, 60)), `M2 ${e.calc}: banner should name the group: ${bar && bar.t}`);
    ok(bar && bar.h === '../' + e.page + '#' + new URL(ls[0].href, base + e.page).searchParams.get('from').split('#')[1], `M2 ${e.calc}: back link ${bar && bar.h}`);
    await mt.close();
  }

  console.log(`  ${total} links: ${per.join(', ')}`);

  /* M3 */
  let tab = await open('capex-calculator.html');
  await links(tab);
  const gid = await tab.$eval('.rz-manual-link', (a) => new URL(a.href).searchParams.get('from').split('#')[1]);
  await Promise.all([tab.waitForNavigation({ waitUntil: 'load' }), tab.click('.rz-manual-link')]);
  await sleep(250);
  ok(/manual\/capex\.html/.test(tab.url()) && /#inputs$/.test(tab.url()), 'M3 link should open the capex manual at #inputs: ' + tab.url());
  ok(await tab.$eval('#inputs', (s) => s.classList.contains('rz-manual-hit')), 'M3 the target section should be marked');
  const top = await tab.$eval('#inputs', (s) => s.getBoundingClientRect().top);
  ok(top >= -2 && top < 700, 'M3 the section should be in view, top=' + top);
  await sleep(2700);
  ok(!(await tab.$eval('#inputs', (s) => s.classList.contains('rz-manual-hit'))), 'M3 the mark should clear after ~2 s');
  await Promise.all([tab.waitForNavigation({ waitUntil: 'load' }), tab.click('.rz-manual-back a')]);
  await sleep(600);
  ok(tab.url().endsWith('capex-calculator.html#' + gid), 'M3 Back should return to the group: ' + tab.url());
  const gtop = await tab.$eval('#' + gid, (g) => g.getBoundingClientRect().top);
  ok(gtop > -50 && gtop < 900, 'M3 the group should be in view after Back, top=' + gtop);
  await tab.close();

  /* M4 */
  for (const bad of ['https://evil.example/x.html', '../index.html', 'javascript:alert(1)', 'a/b.html', 'capex-calculator.html#x"><b>', '']) {
    tab = await open('manual/capex.html?from=' + encodeURIComponent(bad) + '&g=' + encodeURIComponent('<img src=x>') + '#inputs');
    await sleep(200);
    ok(!(await tab.$('.rz-manual-back')), 'M4 a banner appeared for from=' + JSON.stringify(bad));
    await tab.close();
  }
  tab = await open('manual/capex.html?from=capex-calculator.html%23grp-x&g=' + encodeURIComponent('<img src=x onerror=alert(1)>') + '#inputs');
  await sleep(200);
  ok((await tab.$$eval('.rz-manual-back img', (i) => i.length)) === 0, 'M4 the group label must be text, never markup');
  await tab.close();

  /* M5 */
  tab = await open('manual/capex.html?from=capex-calculator.html%23grp-x&g=Load#inputs', { reduce: true });
  await sleep(250);
  ok(!(await tab.$eval('#inputs', (s) => s.classList.contains('rz-manual-hit'))), 'M5 reduced motion should not mark the section');
  await tab.close();
  tab = await open('capex-calculator.html?embed=compare');
  await sleep(1500);
  ok(!(await tab.$('.rz-manual-link')), 'M5 an ?embed= copy should get no manual links');
  await tab.close();

  /* M6 */
  for (const u of ['capex-calculator.html', 'spares-readiness-calculator.html', 'manual/capex.html?from=capex-calculator.html%23grp-load-and-building&g=Load%20and%20building#inputs']) {
    tab = await open(u, { width: 390 });
    await sleep(700);
    const sx = await tab.evaluate(() => { window.scrollTo(500, window.scrollY); return window.scrollX; });
    ok(sx === 0, `M6 ${u}: page scrolls sideways ${sx}px at 390`);
    await tab.close();
  }
} finally {
  await browser.close();
  server.close();
}
ok(errs.length === 0, 'M6 page errors: ' + errs.slice(0, 4).join(' | '));
if (fails.length) { console.log(`FAIL test-manual-links — ${fails.length} of ${checks}`); fails.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
console.log(`PASS test-manual-links — ${checks} checks: 11 calculators link every input group to a manual anchor that exists, banners name calculator + group, Back returns to the group, hostile from= ignored, reduced motion, embed, 390 px`);
