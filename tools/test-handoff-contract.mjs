// P13 Part A — the spares hand-off contract: one parameter table, validated by the receiver, used by the senders.
// C1 data/calculators.json spares.handoff equals RZHandoff.CONTRACTS.spares (the module the pages load).
// C2 every target id exists on the spares page; the enums equal the page's own option lists and country table;
//    every Tier Advisor cooling-redundancy option maps to a value the receiver accepts.
// C3 core: valid values apply, out-of-range / malformed values are listed with a reason, unknown params are skipped,
//    url() refuses a value the receiver would ignore.
// H1 spares ?tier=7 changes no field; the line shows "1 ignored" whose tooltip reads "tier=7: out of range 1–4".
// H2 spares ?mttr=99999 is ignored (above 8760 h); mc_mttr keeps its default.
// H3 spares ?from=tier&tier=3&redundancy=n1&country=ID: fields set, short line "From Tier Advisor · Tier 3 · N+1 · ID",
//    fields tagged, "Clear" removes the tags and keeps the values.
// H4 tier-advisor "Size spares for this design" href = RZHandoff.url(tier, redundancy); follows the inputs;
//    clicking it opens spares with that redundancy.
// H5 both themes, 390 px: no horizontal overflow, the line and button fit; no page errors.
// Run: node tools/test-handoff-contract.mjs [--base=http://127.0.0.1:PORT]
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import net from 'node:net';
const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) pass++; else { fail++; console.error('  ✗ ' + n + (d !== undefined ? ' ' + JSON.stringify(d) : '')); } };

// ---- static + core ----
const modPath = join(ROOT, 'js/rz-handoff.js');
if (!existsSync(modPath)) { console.error('FAIL test-handoff-contract — js/rz-handoff.js missing'); process.exit(1); }
const H = require(modPath);
const C = H.CONTRACTS.spares;
const reg = JSON.parse(readFileSync(join(ROOT, 'data/calculators.json'), 'utf8')).calculators.find((x) => x.calc === 'spares');
ok('C1 registry spares.handoff = RZHandoff.CONTRACTS.spares', JSON.stringify(reg && reg.handoff) === JSON.stringify(C));
const spares = readFileSync(join(ROOT, C.page), 'utf8');
const tierSrc = readFileSync(join(ROOT, 'tier-advisor.html'), 'utf8');
const spec = (p) => C.params.find((x) => x.param === p);
for (const p of C.params) for (const id of p.targets) ok(`C2 ${p.param} target #${id} exists`, new RegExp(`id="${id}"`).test(spares));
const options = (src, id) => { const i = src.indexOf(`id="${id}"`); return i < 0 ? [] : [...src.slice(i, src.indexOf('</select>', i)).matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]); };
ok('C2 commodity enum = #c1_commodity options', JSON.stringify(spec('commodity').values) === JSON.stringify(options(spares, 'c1_commodity')), options(spares, 'c1_commodity'));
ok('C2 redundancy enum = #c1_redundancy options', JSON.stringify(spec('redundancy').values) === JSON.stringify(options(spares, 'c1_redundancy')));
const lt = (spares.match(/var countryLT = \{([^}]*)\}/) || [])[1] || '';
ok('C2 country enum = countryLT keys', JSON.stringify(spec('country').values) === JSON.stringify([...lt.matchAll(/([A-Z]{2}):/g)].map((m) => m[1])));
const TIER_MAP = { n: 'n', n1: 'n1', n2: 'n1', '2n': '2n', '2n1': '2n' };
for (const o of options(tierSrc, 'coolRedundancy')) ok(`C2 tier-advisor coolRedundancy ${o} maps to an accepted value`, spec('redundancy').values.includes(TIER_MAP[o]), o);
const P = (q) => H.parse(C, q);
let r = P('?tier=7&redundancy=N1&foo=1');
ok('C3 tier=7 ignored with range reason', r.ignored.length === 1 && r.ignored[0].param === 'tier' && /out of range 1–4/.test(r.ignored[0].reason), r);
ok('C3 redundancy=N1 applied as n1, unknown param skipped', r.applied.length === 1 && r.applied[0].value === 'n1', r.applied);
r = P('mtbf=-1&mttr=99999&country=zz&installedBase=2.5&leadTime=abc');
ok('C3 five invalid values ignored, none applied', r.applied.length === 0 && r.ignored.length === 5, r);
r = P('mtbf=10&mttr=24&country=id&commodity=UPS&installedBase=4&leadTime=16&unitCost=1e4&downtimeCostPerHr=5000&itLoad=1200&from=tier');
ok('C3 ten valid values applied', r.applied.length === 10 && r.ignored.length === 0, r);
ok('C3 repeated param: first wins, second listed', (() => { const x = P('tier=3&tier=4'); return x.applied[0].value === 3 && x.ignored[0].reason.startsWith('repeated'); })());
ok('C3 url() builds the contract URL', H.url(C, { from: 'tier', tier: 3, redundancy: 'n1' }) === 'spares-readiness-calculator.html?from=tier&tier=3&redundancy=n1');
ok('C3 url() refuses tier=7', (() => { try { H.url(C, { tier: 7 }); return false; } catch (e) { return /tier=7/.test(e.message); } })());

// ---- headless ----
const puppeteer = require('puppeteer');
let base = (process.argv.find((a) => a.startsWith('--base=')) || '').slice(7), server = null;
if (!base) {
  const port = await new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
  server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  base = 'http://127.0.0.1:' + port; await new Promise((res) => setTimeout(res, 900));
}
{ const served = await fetch(base + '/js/rz-version.js').then((x) => x.text()).catch(() => '');
  if (served !== readFileSync(join(ROOT, 'js/rz-version.js'), 'utf8')) { console.error('FAIL — ' + base + ' does not serve this tree'); if (server) server.kill(); process.exit(1); } }
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-audio-output'], protocolTimeout: 90000 });
const errors = [];
async function open(path, theme = 'dark', width = 1440) {
  const p = await browser.newPage();
  await p.setViewport({ width, height: 900 });
  p.on('pageerror', (e) => errors.push(path + ': ' + e.message));
  await p.evaluateOnNewDocument((t) => { try { localStorage.setItem('theme', t); } catch (e) {} }, theme);
  await p.goto(base + '/' + path, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((res) => setTimeout(res, 300));
  return p;
}
const val = (p, id) => p.$eval('#' + id, (e) => e.value).catch(() => null);
const line = (p) => p.evaluate(() => { const b = document.getElementById('carrierBanner'); return b && getComputedStyle(b).display !== 'none' ? b.textContent.replace(/\s+/g, ' ').trim() : ''; });
try {
  let p = await open(C.page + '?tier=7');
  ok('H1 tier=7 leaves redundancy at its default n1', (await val(p, 'c1_redundancy')) === 'n1');
  const ig = await p.$eval('#carrierIgnored', (e) => ({ t: e.textContent, title: e.title, hidden: e.hidden })).catch(() => null);
  ok('H1 line shows "1 ignored" with the reason in its tooltip', !!ig && !ig.hidden && ig.t === '1 ignored' && ig.title === 'tier=7: out of range 1–4', ig);
  await p.close();
  p = await open(C.page + '?mttr=99999');
  ok('H2 mttr=99999 ignored, mc_mttr stays 168', (await val(p, 'mc_mttr')) === '168', await val(p, 'mc_mttr'));
  await p.close();
  p = await open(C.page + '?from=tier&tier=3&redundancy=n1&country=ID');
  const l = await line(p);
  ok('H3 short line names Tier Advisor and the values', l === 'From Tier Advisor · Tier 3 · N+1 · ID Clear', l);
  ok('H3 redundancy n1', (await val(p, 'c1_redundancy')) === 'n1');
  const tagged = await p.$$eval('[data-rz-handoff]', (els) => els.map((e) => e.id));
  ok('H3 targets tagged', tagged.includes('c1_redundancy') && tagged.includes('s_carry_rate'), tagged);
  const carry = await val(p, 's_carry_rate');
  const btn = await p.$('#carrierClear');
  ok('H3 Clear hand-off button present', !!btn);
  if (btn) { await btn.click(); await new Promise((res) => setTimeout(res, 100)); }
  ok('H3 Clear removes tags', (await p.$$('[data-rz-handoff]')).length === 0);
  ok('H3 Clear keeps values', (await val(p, 's_carry_rate')) === carry && (await val(p, 'c1_redundancy')) === 'n1');
  ok('H3 line hidden after Clear', (await line(p)) === '');
  await p.close();

  p = await open('tier-advisor.html');
  const href = () => p.$eval('#tierSparesLink', (a) => a.getAttribute('href')).catch(() => null);
  const tierNum = () => p.evaluate(() => { const m = (document.getElementById('uptimeTier').textContent || '').match(/Tier (IV|III|II|I)\b/); return m ? { I: 1, II: 2, III: 3, IV: 4 }[m[1]] : null; });
  let want = H.url(C, { from: 'tier', tier: await tierNum(), redundancy: TIER_MAP[await val(p, 'coolRedundancy')] });
  ok('H4 link href = contract URL for the current result', (await href()) === want, [await href(), want]);
  await p.select('#coolRedundancy', '2n1'); await new Promise((res) => setTimeout(res, 700));
  want = H.url(C, { from: 'tier', tier: await tierNum(), redundancy: '2n' });
  ok('H4 link follows the inputs (2(N+1) → 2n)', (await href()) === want, [await href(), want]);
  if (await p.$('#tierSparesLink')) {
    await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }), p.click('#tierSparesLink')]);
    await new Promise((res) => setTimeout(res, 300));
    ok('H4 click opens spares with redundancy 2n', p.url().includes(C.page) && (await val(p, 'c1_redundancy')) === '2n', p.url());
  } else ok('H4 link present', false);
  await p.close();

  for (const theme of ['dark', 'light']) {
    for (const [path, sel] of [[C.page + '?from=tier&tier=4&redundancy=2n&country=SG&mttr=48', '#carrierBanner'], ['tier-advisor.html', '#tierSparesLink']]) {
      p = await open(path, theme, 390);
      const m = await p.evaluate((s) => { const e = document.querySelector(s); const r = e ? e.getBoundingClientRect() : null;
        return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, r: r && { l: r.left, ri: r.right, h: r.height } }; }, sel);
      ok(`H5 ${theme} 390 ${path.split('?')[0]} no horizontal overflow`, m.sw <= m.cw, m);
      ok(`H5 ${theme} 390 ${sel} inside viewport`, !!m.r && m.r.l >= 0 && m.r.ri <= 390 && m.r.h > 0, m.r);
      if (sel === '#tierSparesLink') ok(`H5 ${theme} link touch target ≥ 44 px`, !!m.r && m.r.h >= 44, m.r);
      await p.close();
    }
  }
  ok('H5 no page errors', errors.length === 0, errors.slice(0, 5));
} finally {
  await browser.close();
  if (server) server.kill();
}
if (fail) { console.error(`FAIL test-handoff-contract — ${pass} passed, ${fail} failed`); process.exit(1); }
console.log(`PASS test-handoff-contract — ${pass} checks: one contract in the registry and the module, receiver validates ranges and lists what it ignored, Tier Advisor sends the contract URL, 390 px both themes`);
