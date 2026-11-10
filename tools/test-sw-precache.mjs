#!/usr/bin/env node
/**
 * test-sw-precache.mjs — P25 ship gate: the service worker can actually keep the calculators.
 *
 *  W1  every PRE_CACHE_URLS path exists on disk (a missing one used to empty the whole precache:
 *      cache.addAll is atomic)
 *  W2  sw.js precaches per URL under allSettled (no addAll), posts {type:'rz-sw-precache', failed}
 *  W3  unit, in a vm with fake caches: one bad URL -> the others are cached and the bad one reported
 *  W4  unit: /sw-kill.json {kill:true} -> every cache deleted + unregister; {kill:false} / fetch error -> nothing
 *  W5  unit: the offline page lists saved pages with escaped titles, and the empty state says so
 *  W6  sw-kill.json is committed as {kill:false}
 *  W7  the 11 calculators load js/rz-sw-register.js; none of the 9 chart pages loads Chart.js from a CDN
 *  W8  vendored files match the sha256 recorded in js/vendor/README.md
 *
 * Run: node tools/test-sw-precache.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SW = readFileSync(join(ROOT, 'sw.js'), 'utf8');
const fails = [];
let checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) fails.push(msg); };

/* W1 */
const list = SW.match(/const PRE_CACHE_URLS = \[([\s\S]*?)\];/);
ok(list, 'W1 sw.js: PRE_CACHE_URLS not found');
const urls = list ? [...list[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];
ok(urls.length >= 10, `W1 PRE_CACHE_URLS has only ${urls.length} entries`);
for (const u of urls) ok(existsSync(join(ROOT, u.replace(/^\//, '').split('?')[0])), `W1 precache path missing on disk: ${u}`);

/* W2 */
ok(!/\.addAll\(/.test(SW), 'W2 sw.js still calls cache.addAll — atomic: one missing file precaches nothing');
ok(/Promise\.allSettled\(/.test(SW) && /rz-sw-precache/.test(SW), 'W2 sw.js: no allSettled precache / rz-sw-precache message');

/* fake worker environment */
function makeEnv({ killBody = { kill: false }, killThrows = false, badUrls = [] } = {}) {
  const stores = new Map();
  const listeners = {};
  const posted = [];
  let unregistered = false;
  const mkCache = () => {
    const m = new Map();
    return {
      add: async (u) => { if (badUrls.includes(u)) throw new Error('404 ' + u); m.set('https://x.test' + u, new Res('<title>T ' + u + '</title>')); },
      put: async (k, v) => { m.set(typeof k === 'string' ? k : k.url, v); },
      match: async (k) => m.get(typeof k === 'string' ? k : k.url),
      keys: async () => [...m.keys()].map((url) => ({ url })),
      _m: m,
    };
  };
  class Res { constructor(body) { this.body = body; this.ok = true; } async text() { return this.body; } async json() { return JSON.parse(this.body); } clone() { return this; } }
  const caches = {
    open: async (n) => { if (!stores.has(n)) stores.set(n, mkCache()); return stores.get(n); },
    keys: async () => [...stores.keys()],
    delete: async (n) => stores.delete(n),
    match: async () => undefined,
  };
  const self = {
    location: { origin: 'https://x.test' },
    addEventListener: (t, fn) => { listeners[t] = fn; },
    skipWaiting: async () => {},
    clients: { claim: async () => {}, matchAll: async () => [{ postMessage: (m) => posted.push(m) }] },
    registration: { unregister: async () => { unregistered = true; return true; } },
  };
  const fetch = async (u) => {
    if (String(u).endsWith('/sw-kill.json')) { if (killThrows) throw new Error('offline'); return new Res(JSON.stringify(killBody)); }
    throw new Error('no network in test');
  };
  const ctx = vm.createContext({ self, caches, fetch, Response: class { constructor(b, o) { this.body = b; this.status = o && o.status; } }, URL, Promise, console, setTimeout, Date });
  vm.runInContext(SW, ctx);
  const run = (type) => new Promise((done, fail) => {
    listeners[type]({ waitUntil: (p) => p.then(done, fail) });
  });
  return { run, stores, posted, ctx, get unregistered() { return unregistered; } };
}

/* W3 */
{
  const bad = urls[3];
  const env = makeEnv({ badUrls: [bad] });
  await env.run('install');
  await new Promise((r) => setTimeout(r, 5));
  const cache = [...env.stores.values()][0];
  ok(cache && cache._m.size === urls.length - 1, `W3 one bad URL: expected ${urls.length - 1} cached, got ${cache && cache._m.size}`);
  const msg = env.posted.find((m) => m.type === 'rz-sw-precache');
  ok(msg && msg.failed.length === 1 && msg.failed[0] === bad, `W3 failure not reported as {type:'rz-sw-precache', failed:['${bad}']}: ${JSON.stringify(env.posted)}`);
  const clean = makeEnv();
  await clean.run('install');
  await new Promise((r) => setTimeout(r, 5));
  ok(clean.posted.length === 0, 'W3 a clean install must post no failure message');
}

/* W4 */
{
  const killed = makeEnv({ killBody: { kill: true } });
  await killed.run('install');
  await killed.run('activate');
  ok(killed.unregistered && killed.stores.size === 0, `W4 {kill:true}: unregister=${killed.unregistered}, caches left=${killed.stores.size}`);
  const kept = makeEnv({ killBody: { kill: false } });
  await kept.run('install');
  await kept.run('activate');
  ok(!kept.unregistered && kept.stores.size === 1, 'W4 {kill:false} must leave the worker and its cache alone');
  const offline = makeEnv({ killThrows: true });
  await offline.run('install');
  await offline.run('activate');
  ok(!offline.unregistered && offline.stores.size === 1, 'W4 a failed kill-file fetch (offline) must not kill the worker');
}

/* W5 */
{
  const env = makeEnv();
  await env.run('install');
  const cache = [...env.stores.values()][0];
  await cache.put('https://x.test/tco-calculator.html', { text: async () => '<title>TCO <img src=x onerror=alert(1)></title>' });
  const saved = await vm.runInContext('savedPages()', env.ctx);
  const html = vm.runInContext('offlineHTML', env.ctx)(saved);
  ok(/href="\/tco-calculator\.html"/.test(html), 'W5 offline page does not link the saved calculator');
  ok(!/<img/.test(html), 'W5 a cached <title> reached the offline page unescaped');
  ok(/lang="en"/.test(html) && /<main>/.test(html) && /<h1>/.test(html), 'W5 offline page lacks lang / main landmark / heading');
  const empty = vm.runInContext('offlineHTML', env.ctx)([]);
  ok(/No pages saved yet\. Open a calculator online once\./.test(empty), 'W5 empty state text missing');
}

/* W6 */
{
  let kill = null;
  try { kill = JSON.parse(readFileSync(join(ROOT, 'sw-kill.json'), 'utf8')); } catch (e) { /* reported below */ }
  ok(kill && kill.kill === false, 'W6 sw-kill.json must exist and be committed as {"kill": false}');
}

/* W7 */
const CALCS = ['capex-calculator.html', 'opex-calculator.html', 'tco-calculator.html', 'roi-calculator.html', 'pue-calculator.html',
  'carbon-footprint.html', 'cx-calculator.html', 'spares-readiness-calculator.html', 'tier-advisor.html', 'tia-942-checklist.html',
  'rfs-readiness-workbench.html'];
for (const p of CALCS) {
  const html = readFileSync(join(ROOT, p), 'utf8');
  ok(/<script[^>]+src="js\/rz-sw-register\.js\?v=[^"]+"/.test(html), `W7 ${p} does not load js/rz-sw-register.js`);
  ok(!/<script[^>]+src="https?:\/\/[^"]*\/(?:chart\.js|chartjs-plugin)/.test(html), `W7 ${p} still loads Chart.js from a CDN — offline it draws no chart`);
}

/* W8 */
const readme = readFileSync(join(ROOT, 'js', 'vendor', 'README.md'), 'utf8');
for (const [, file, sha] of readme.matchAll(/^\| ([\w.-]+\.js) \| [^|]+\| ([0-9a-f]{64}) \|/gm)) {
  const got = createHash('sha256').update(readFileSync(join(ROOT, 'js', 'vendor', file))).digest('hex');
  ok(got === sha, `W8 js/vendor/${file} sha256 ${got.slice(0, 12)}… differs from README ${sha.slice(0, 12)}…`);
}

if (fails.length) {
  console.log(`FAIL test-sw-precache — ${fails.length} of ${checks} checks\n  ` + fails.join('\n  '));
  process.exit(1);
}
console.log(`PASS test-sw-precache — ${checks} checks: ${urls.length} precache paths on disk, per-URL precache reports failures, kill switch, offline page, 11 calculators registered, vendored bytes match`);
