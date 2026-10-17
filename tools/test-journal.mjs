#!/usr/bin/env node
/* test-journal.mjs — the journal family gate (v3.23.0, owner 2026-10-16: "abis scroll kadang blank",
 * "masih ada AI design slop … audit total", "filter by tag … jauh lebih bagus dan intuitive").
 *
 * Static (always):
 *   J1  data/journal.json equals what tools/build-journal.py derives from every page's <meta>; every
 *       page has a topic; the grids on the hub and the landings are the builder's (--check).
 *   J2  tools/sweep-journal-register.py --check is a no-op (the per-page CSS is on the register).
 *   J3  structure, per family page: no fixed <canvas>, no ticker/marquee, no `transition: all`,
 *       no `:hover { transform }`, no `filter: blur(≥20px)`, no backdrop-filter, no serif display
 *       face, no navy-hue background literal (hue 200–250°, s ≥ .25, l ≤ .20), no per-page accent.
 *       These are the elements that made the hub blank on a phone (48 composited layers) and the
 *       §A27–34 tells; a seeded navy literal or a re-added ticker turns this red.
 * Browser (unless --static), under the kereta-browser lock:
 *   J4  the filter on articles.html at 390 and 1440: a topic chip leaves exactly the JSON's count of
 *       cards, writes ?topic=, reloading that URL restores it, a search narrows, Clear restores all,
 *       a nonsense query shows the empty state, chips are <button aria-pressed>.
 *   J5  rendering: no computed font-family with a serif display face, no computed background in the
 *       navy band, composited layers ≤ 20 at 390 (CDP LayerTree), a data-rz-fact-list parent renders
 *       its tiles as full-width rows.
 * Run:  node tools/test-journal.mjs [--static]
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const STATIC = process.argv.includes('--static');
let pass = 0; const fails = [];
function ok(id, cond, detail) { if (cond) pass++; else fails.push(`${id} — ${detail}`); }
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

const HUB = ['articles.html', 'insights.html', 'geopolitics.html', 'future-forward.html'];
const FAMILY = readdirSync(ROOT).filter((f) => /^(articles|insights|geopolitics|future-forward|article-\d+|FF-\d+|geopolitics-\d+)\.html$/.test(f))
  .filter((f) => read(f).includes('css/rz-article-dark.css'));

/* J1 + J2: generators are fresh */
for (const [id, tool] of [['J1', 'build-journal.py'], ['J2', 'sweep-journal-register.py']]) {
  try { execFileSync('python3', [join(ROOT, 'tools', tool), '--check'], { stdio: 'pipe' }); ok(id, true); }
  catch (e) { ok(id, false, `${tool} --check: ${String(e.stdout || e.message).trim().slice(0, 200)}`); }
}
const J = JSON.parse(read('data/journal.json'));
ok('J1b', J.articles.length >= 34 && J.articles.every((a) => a.topic && a.title && a.date && a.readMin > 0) && J.topics.length === 8,
  `journal.json: ${J.articles.length} pages, ${J.topics.length} topics`);
const hubCards = (read('articles.html').match(/class="jcard"/g) || []).length;
ok('J1c', hubCards === J.articles.length, `hub grid has ${hubCards} cards, json ${J.articles.length}`);

/* J3: structure */
function hsl(hex) {
  let h = hex.slice(1); if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2; let s = 0, hue = 0;
  if (max !== min) { const d = max - min; s = l > .5 ? d / (2 - max - min) : d / (max + min);
    hue = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; hue *= 60; }
  return [hue, s, l];
}
const navy = (hex) => { const [h, s, l] = hsl(hex); return h >= 200 && h <= 250 && s >= .25 && l <= .20; };
const cssOf = (t) => (t.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n') + ' ' + (t.match(/\sstyle="[^"]*"/g) || []).join('\n');
for (const f of FAMILY) {
  const t = read(f), css = cssOf(t), body = t.replace(/<script[\s\S]*?<\/script>/gi, '');
  const bad = [];
  if (/<canvas[^>]*(?:class|id)="[^"]*(?:particle|aurora|orb|-bg\b|background)[^"]*"/i.test(body) || /canvas[^{]*\{[^}]*position:\s*fixed/i.test(css)) bad.push('fixed decorative canvas');
  if (/class="[^"]*\b(?:ticker|marquee)[^"]*"/i.test(body)) bad.push('ticker/marquee');
  if (/transition:\s*all\b/i.test(css)) bad.push('transition: all');
  if (/:hover[^{]*\{[^}]*transform:\s*translate(?:Y|3d)?\(\s*-\d/i.test(css)) bad.push('hover lift');
  const blur = css.match(/filter:\s*blur\(\s*(\d+)px/gi) || [];
  if (blur.some((m) => parseInt(m.match(/(\d+)px/)[1], 10) >= 20)) bad.push('blur ≥ 20px');
  if (/backdrop-filter/i.test(css)) bad.push('backdrop-filter');
  if (/font-family:[^;}]*\b(?:Fraunces|Playfair|Newsreader|Instrument Serif|Cormorant|Lora|Merriweather|DM Serif)\b/i.test(css) || /family=(?:Fraunces|Playfair)/i.test(t)) bad.push('serif display face');
  const navyHits = [...css.matchAll(/(?:background(?:-color)?|--[a-z0-9-]*bg[a-z0-9-]*)\s*:\s*(#[0-9a-f]{3,8})\b/gi)].map((m) => m[1]).filter(navy);
  if (navyHits.length) bad.push(`navy background ${[...new Set(navyHits)].slice(0, 3).join(',')}`);
  if (/<html[^>]*style="[^"]*--rz-art-accent/i.test(t)) bad.push('per-page accent');
  ok('J3:' + f, bad.length === 0, bad.join('; '));
}

/* browser */
if (!STATIC) {
  const puppeteer = (await import('puppeteer')).default;
  const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  const server = http.createServer((req, res) => {
    const p = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
    const file = join(ROOT, p === '/' ? 'index.html' : p);
    if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  try {
    for (const vw of [390, 1440]) {
      const page = await browser.newPage();
      await page.setViewport({ width: vw, height: vw === 390 ? 844 : 1000, deviceScaleFactor: vw === 390 ? 2 : 1, isMobile: vw === 390, hasTouch: vw === 390 });
      const errs = []; page.on('pageerror', (e) => errs.push(e.message));
      // the cookie banner is fixed at the bottom and would sit over the toolbar's status line at 1440×1000
      await page.evaluateOnNewDocument(() => { try { localStorage.setItem('rz_cookie_consent', 'declined'); } catch (e) { /* mobile emulation */ } });
      await page.goto(base + 'articles.html', { waitUntil: 'networkidle2' });
      // mobile emulation cannot seed localStorage (SecurityError), so the consent banner is removed from the DOM;
      // it is fixed to the bottom and would take the click meant for the status line
      const noBanner = () => page.evaluate(() => { const b = document.querySelector('.rz-cookie-banner'); if (b) b.remove(); });
      await noBanner();
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      const api = () => page.evaluate(() => ({ ready: !!window.RZJournalFilter, visible: window.RZJournalFilter && window.RZJournalFilter.visible(), total: window.RZJournalFilter && window.RZJournalFilter.total, q: location.search }));
      let s = await api();
      ok(`J4a@${vw}`, s.ready && s.visible === J.articles.length, `filter ready ${s.ready}, visible ${s.visible} of ${J.articles.length}; errors ${errs.join('|').slice(0, 120)}`);
      const topic = J.topics.find((t) => t.id === 'power');
      await page.click(`.jchip[data-topic="${topic.id}"]`);
      s = await api();
      const pressed = await page.$eval(`.jchip[data-topic="${topic.id}"]`, (b) => b.tagName + ':' + b.getAttribute('aria-pressed'));
      ok(`J4b@${vw}`, s.visible === topic.count && s.q.includes('topic=' + topic.id) && pressed === 'BUTTON:true', `topic chip: visible ${s.visible} vs ${topic.count}, url ${s.q}, ${pressed}`);
      await page.goto(base + 'articles.html?topic=' + topic.id + '&series=global', { waitUntil: 'networkidle2' });
      await noBanner();
      s = await api();
      const expect = J.articles.filter((a) => a.topic === topic.id && a.series === 'global').length;
      ok(`J4c@${vw}`, s.visible === expect, `url state restored: visible ${s.visible} vs ${expect}`);
      // the Clear control: first prove nothing covers it (a mouse click at a moving target once landed on the
      // card below and navigated away), then fire its handler
      await page.$eval('.jtool-clear', (b) => b.scrollIntoView({ block: 'center' }));
      await new Promise((r) => setTimeout(r, 400));
      const hit = await page.$eval('.jtool-clear', (b) => { const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return e === b || b.contains(e) ? 'self' : (e ? (e.className || e.tagName) : 'none'); });
      ok(`J4d-hit@${vw}`, hit === 'self', `the Clear control is covered by ${hit}`);
      await page.$eval('.jtool-clear', (b) => b.click());
      await page.waitForSelector('input[name="q"]', { timeout: 5000 });
      s = await api();
      ok(`J4d@${vw}`, s.visible === J.articles.length && s.q === '', `clear: visible ${s.visible}, url "${s.q}"`);
      // a pushState from the Clear click is a same-document navigation to puppeteer: let the frame settle
      await page.waitForSelector('input[name="q"]', { timeout: 5000 });
      await page.type('input[name="q"]', 'pfas');
      await new Promise((r) => setTimeout(r, 400));
      s = await api();
      const expectQ = J.articles.filter((a) => (a.title + ' ' + a.excerpt + ' ' + a.tags.join(' ')).toLowerCase().includes('pfas')).length;
      ok(`J4e@${vw}`, s.visible === expectQ && expectQ > 0, `search: visible ${s.visible} vs ${expectQ}`);
      await page.$eval('input[name="q"]', (i) => { i.value = ''; });
      await page.type('input[name="q"]', 'zzqxv-nothing');
      await new Promise((r) => setTimeout(r, 400));
      const emptyShown = await page.$eval('[data-journal-empty]', (e) => !e.hidden && getComputedStyle(e).display !== 'none');
      ok(`J4f@${vw}`, emptyShown, 'empty state shown for a nonsense query');
      /* J5 rendering */
      const fonts = await page.evaluate(() => [...document.querySelectorAll('h1,h2,h3,.jcard-title,.jchip')].map((e) => getComputedStyle(e).fontFamily).filter((f) => /Fraunces|Playfair|serif/i.test(f) && !/sans-serif/i.test(f)));
      ok(`J5a@${vw}`, fonts.length === 0, `serif computed on ${fonts.length} heading(s): ${fonts[0] || ''}`);
      const navyBg = await page.evaluate(() => {
        const out = []; for (const e of document.querySelectorAll('body, main, section, .jcard, .jnotice, .jtool, .navbar')) {
          const m = getComputedStyle(e).backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); if (!m) continue;
          const r = +m[1] / 255, g = +m[2] / 255, b = +m[3] / 255, max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
          if (max === min) continue; const d = max - min, s = l > .5 ? d / (2 - max - min) : d / (max + min);
          let h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
          if (h >= 200 && h <= 250 && s >= .25 && l <= .20) out.push(e.className || e.tagName); }
        return out; });
      ok(`J5b@${vw}`, navyBg.length === 0, `navy computed background on ${navyBg.slice(0, 3).join(', ')}`);
      if (vw === 390) {
        const cdp = await page.target().createCDPSession();
        let layers = 0;
        cdp.on('LayerTree.layerTreeDidChange', (e) => { layers = (e.layers || []).length; });
        await cdp.send('LayerTree.enable'); await new Promise((r) => setTimeout(r, 1200));
        ok('J5c@390', layers > 0 && layers <= 20, `composited layers ${layers} (the blank-on-scroll hub had 48)`);
      }
      await page.close();
    }
    /* J5e: article calculators are styled by the register on a phone (v3.24.2: they rendered as raw
       inline labels and bare inputs, because calc-* was only styled inside article-13's own <style>) */
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await page.goto(base + 'article-29.html', { waitUntil: 'networkidle2' });
      const calc = await page.evaluate(() => {
        const blocks = [...document.querySelectorAll('.llm-calc-block')];
        const bad = [];
        for (const b of blocks) {
          const inp = b.querySelector('.calc-input'), lab = b.querySelector('.calc-label');
          if (!inp || !lab) { bad.push('not mounted'); continue; }
          const ri = inp.getBoundingClientRect(), rl = lab.getBoundingClientRect();
          if (ri.height < 40) bad.push('input ' + Math.round(ri.height) + 'px');
          if (rl.bottom > ri.top + 1) bad.push('label beside input');
          if (b.scrollWidth > b.clientWidth + 1) bad.push('overflows');
        }
        const justified = [...document.querySelectorAll('.article-body p, .article-body li')].filter((e) => getComputedStyle(e).textAlign === 'justify').length;
        if (justified) bad.push(justified + ' justified paragraph(s)/item(s) on a phone');
        const title = document.querySelector('.article-title .highlight');
        return { n: blocks.length, bad, italic: title ? getComputedStyle(title).fontStyle : 'none' };
      });
      ok('J5e', calc.n === 5 && calc.bad.length === 0 && calc.italic === 'normal', `article-29 calculators at 390: ${JSON.stringify(calc)}`);
      await page.close();
    }
    /* J5f (v3.24.6): every rendered element of an article, in both themes — not a chosen selector list.
       The first J5b scanned a handful of selectors on the hub and passed while article 29 sat on a navy
       .article-content from styles.css, with navy tables and related cards, a cyan TOC button and 2px
       amber rails on its callouts. */
    for (const art of FAMILY.filter((f) => /^(article-\d+|FF-\d+|geopolitics-\d+)\.html$/.test(f))) for (const theme of ['dark', 'light']) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 1000 });
      /* J4 declines cookies, and localStorage is shared across pages of one browser: without this the banner
         never renders here and its navy/blur/blue passed unseen (v3.24.10) */
      await page.evaluateOnNewDocument(() => { try { localStorage.removeItem('rz_cookie_consent'); localStorage.removeItem('cookieConsent'); } catch (e) { /* ignore */ } });
      await page.goto(base + art, { waitUntil: 'networkidle2' });
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      await new Promise((r) => setTimeout(r, 600));
      const found = await page.evaluate(() => {
        const hsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; if (mx === mn) return [0, 0, l]; const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); let h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h * 60, s, l]; };
        const out = { navy: [], rails: [], fixed: [] };
        /* + the shared chrome a reader sees on every article: cookie banner, login button, user pill (v3.24.9) */
        const scope = document.querySelectorAll('body, main, .article-content, .article-content *, .toc-mobile-toggle, .rz-cookie-banner, .rz-cookie-banner *, .rz-login-btn, .rz-user-btn, .rz-user-avatar');
        for (const e of scope) {
          if (e.closest('svg, canvas, img')) continue;
          const cs = getComputedStyle(e), r = e.getBoundingClientRect();
          /* text flush against its own visible border: the -note callout rule boxed .rz-figcaption-note while another
             rule zeroed its padding, so captions read as text glued to a frame (v3.24.13) */
          if (r.width && r.height && parseFloat(cs.borderLeftWidth) >= 1 && parseFloat(cs.borderTopWidth) >= 1 && !/rgba\([^)]*, 0\)/.test(cs.borderLeftColor) && cs.borderLeftStyle !== 'none'
              && parseFloat(cs.paddingLeft) < 4 && !e.matches('input, select, textarea, button, table, tr, th, td, hr, pre, code')
              && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 20)) out.rails.push('flush:' + (e.className || e.tagName).toString().slice(0, 26));
          if (e.closest('figure.rz-figure, figure.rz-chart')) continue;
          if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none') continue;
          /* data colour (legend dots, bar fills, swatches) is content, not a surface — same rule as the runtime */
          if (r.width <= 24 || r.height <= 12 || /(^|[\s_-])(dot|bar|fill|swatch|legend|marker)([\s_-]|$)/i.test(String(e.className))) continue;
          const m = cs.backgroundColor.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?/);
          if (m && (m[4] === undefined || +m[4] > 0.3)) { const [h, s, l] = hsl(+m[1], +m[2], +m[3]); if (h >= 200 && h <= 250 && s >= .25 && l <= .22) out.navy.push((e.className || e.tagName).toString().slice(0, 30)); }
          if (cs.boxShadow !== 'none') { const g = cs.boxShadow.match(/rgba?\((\d+), (\d+), (\d+)/); if (g && Math.max(+g[1], +g[2], +g[3]) - Math.min(+g[1], +g[2], +g[3]) > 40) out.rails.push('glow:' + (e.className || e.tagName).toString().slice(0, 26)); }
          const bl = parseFloat(cs.borderLeftWidth), bt = parseFloat(cs.borderTopWidth);
          if (bl >= 2 && bl > bt && !e.matches('blockquote, th, td')) out.rails.push((e.className || e.tagName).toString().slice(0, 30));
          if (m && (cs.position === 'fixed' || e.closest('.rz-cookie-banner, .rz-login-btn, .rz-user-btn'))) { const [h, s, l] = hsl(+m[1], +m[2], +m[3]); if ((m[4] === undefined || +m[4] > 0.3) && s > .5 && l > .12 && l < .9 && !(h >= 20 && h <= 45)) out.fixed.push((e.className || e.id).toString().slice(0, 30) + ' ' + cs.backgroundColor); }
          if (cs.backdropFilter && cs.backdropFilter !== 'none' && e.closest('.rz-cookie-banner')) out.fixed.push('blur:' + (e.className || e.tagName).toString().slice(0, 24));
          if (e.closest('.rz-cookie-banner, .rz-login-btn, .rz-user-btn, .rz-user-avatar')) {
            for (const prop of ['color', 'borderTopColor']) {
              const c = cs[prop].match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?/);
              if (!c || (c[4] !== undefined && +c[4] < 0.2)) continue;
              const [h, s, l] = hsl(+c[1], +c[2], +c[3]);
              if (s > .45 && l > .2 && l < .85 && !(h >= 20 && h <= 45)) out.fixed.push(prop + ':' + (e.className || e.tagName).toString().slice(0, 22) + ' ' + cs[prop]);
            }
          }
        }
        for (const k of Object.keys(out)) out[k] = [...new Set(out[k])].slice(0, 5);
        return out;
      });
      ok(`J5f:${art}:${theme}`, !found.navy.length && !found.rails.length && !found.fixed.length, JSON.stringify(found));
      await page.close();
    }
    /* J5d: a fact list renders as rows */
    const fl = FAMILY.find((f) => /data-rz-fact-list/.test(read(f)));
    if (fl) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 900 });
      await page.goto(base + fl, { waitUntil: 'networkidle2' });
      const rows = await page.evaluate(() => {
        const p = document.querySelector('[data-rz-fact-list]'); if (!p) return null;
        const kids = [...p.children].filter((k) => k.offsetParent !== null); const pw = p.getBoundingClientRect().width;
        return { n: kids.length, full: kids.filter((k) => k.getBoundingClientRect().width > pw * .9).length, cols: getComputedStyle(p).gridTemplateColumns.split(' ').length };
      });
      ok('J5d', rows && rows.n >= 3 && rows.full === rows.n && rows.cols === 1, `${fl}: ${JSON.stringify(rows)}`);
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
}

if (fails.length) { console.log(`FAIL journal gate — ${fails.length} of ${pass + fails.length} assertions failed`); for (const f of fails) console.log('  ' + f); process.exit(1); }
console.log(`PASS journal gate — ${pass} assertions (${FAMILY.length} family pages${STATIC ? ', static only' : ''})`);
