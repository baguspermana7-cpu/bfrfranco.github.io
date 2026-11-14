#!/usr/bin/env node
/* rz-tracker.js must not call ipapi.co (sends the visitor IP to a third party) before cookie consent (audit S8).
 *   T1 no consent stored   -> 0 requests to ipapi.co
 *   T2 consent = declined  -> 0 requests
 *   T3 consent = accepted  -> 1 request
 *   T4 no consent, then the `rz-cookie-consent` event with detail "accepted" -> 1 request
 *   node tools/test-tracker-consent.mjs [--tracker <file>]   (--tracker swaps the script under test, for red runs)
 * Served from a fake host (rz.test) because the tracker skips geo on localhost. ipapi.co is intercepted, never reached. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(import.meta.url);
let puppeteer;
for (const base of [ROOT, path.join(process.env.HOME || '', 'rz-work')]) {
  try { puppeteer = createRequire(path.join(base, 'x.js'))('puppeteer'); break; } catch (e) {}
}
if (!puppeteer) { console.error('puppeteer not found'); process.exit(2); }
const ti = process.argv.indexOf('--tracker');
const trackerSrc = fs.readFileSync(ti > 0 ? process.argv[ti + 1] : path.join(ROOT, 'rz-tracker.js'));

const server = http.createServer((q, s) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/rz-tracker.js') { s.setHeader('content-type', 'text/javascript'); return s.end(trackerSrc); }
  if (u === '/page') { s.setHeader('content-type', 'text/html'); return s.end('<!doctype html><title>t</title><script src="/rz-tracker.js"></script>'); }
  s.statusCode = 404; s.end();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--host-resolver-rules=MAP rz.test 127.0.0.1'] });
let fail = 0;

async function run(name, consent, lateAccept, want) {
  const page = await browser.newPage();
  let n = 0;
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    if (r.url().startsWith('https://ipapi.co/')) {
      n++;
      return r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"ip":"0.0.0.0","country_code":"ID"}' });
    }
    r.continue();
  });
  if (consent) await page.evaluateOnNewDocument((c) => { try { localStorage.setItem('rz_cookie_consent', c); } catch (e) {} }, consent);
  await page.goto(`http://rz.test:${port}/page`, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 600));
  if (lateAccept) {
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('rz-cookie-consent', { detail: 'accepted' })));
    await new Promise((r) => setTimeout(r, 600));
  }
  await page.close();
  const ok = n === want;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${n} ipapi.co request(s), want ${want}`);
}

await run('T1 no consent', null, false, 0);
await run('T2 declined', 'declined', false, 0);
await run('T3 accepted', 'accepted', false, 1);
await run('T4 accept event after load', null, true, 1);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
