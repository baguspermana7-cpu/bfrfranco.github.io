#!/usr/bin/env node
/**
 * test-index-r079.mjs — the laws of the R079 homepage refit (owner 2026-11-07), run on the rendered page.
 *  L1 every id of the pre-refit homepage (BASE commit) still exists, and every href="#x" resolves to an id.
 *  L2 employer cards: 5 cards, exactly 1 .is-current. R102 (owner 2026-11-09 "klik cards lgsung flip … gak usah kasih
 *     tombol tulisan detail … flipnya kaku"): a click on the card body flips it (aria-expanded, back live, back square to
 *     the reader, front turned away); 150 ms in, the front is mid-turn (20°–170°, a real 3D turn, not a swap); the turn
 *     button shows no text and is ≤ 40 px; keyboard Enter on it flips and moves focus to Back, Esc flips home and returns
 *     focus; opening card B closes card A; the shown face sets the height; reduced motion fades, no rotation.
 *  L3 every card keeps its width and height when it turns (R126, replaces "as tall as its shown face"); phone 390: no
 *     horizontal scroll, cards one column; every logo 28 px tall and a vector.
 *  L4 nav: no backdrop-filter, no box-shadow, 64 +/- 2 px at 1440; the Contact pill once in the nav, the
 *     pill CTA once in the hero and once in the contact section, each reaching #contact or mailto.
 *     No clock row (owner 2026-11-08).
 *  L2v2 (owner 2026-11-08) calm cards: one card background (current = 3 px amber top rule), square skill marker, sentence-case names.
 *  L5 footer: the wordmark spans the footer content box +/- 2 px at 390/1024/1440; every footer link resolves;
 *     no phone number, no street address, no availability/hire copy; the old mono slogan is gone.
 * Env RZ_BASE (default http://127.0.0.1:8177).   node tools/test-index-r079.mjs
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_COMMIT = 'a7c34f420';
const URL = (process.env.RZ_BASE || 'http://127.0.0.1:8177') + '/index.html';
let puppeteer;
try { puppeteer = createRequire(resolve(ROOT, 'package.json'))('puppeteer'); }
catch { puppeteer = createRequire('/home/baguspermana7/wt-journal/package.json')('puppeteer'); }

let fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fail++; };
const oldHtml = execFileSync('git', ['show', `${BASE_COMMIT}:index.html`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
const oldIds = [...oldHtml.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);

const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-audio-output'] });
const open = async (w, theme = 'light', reduced = false) => {
  const p = await browser.newPage();
  p.errors = []; p.on('pageerror', (e) => p.errors.push(String(e).slice(0, 120)));
  await p.setViewport({ width: w, height: w < 500 ? 844 : 900 });
  if (reduced) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.goto(URL.replace('/index.html', '/robots.txt'));
  await p.evaluate((t) => { localStorage.clear(); localStorage.setItem('rz_cookie_consent', 'declined'); localStorage.setItem('theme', t); }, theme);
  await p.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1200));
  return p;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  // L1
  let p = await open(1440);
  const ids = await p.evaluate(() => [...document.querySelectorAll('[id]')].map((e) => e.id));
  const missing = oldIds.filter((i) => !ids.includes(i));
  check(missing.length === 0, `L1 all ${oldIds.length} pre-refit ids present${missing.length ? ' — missing ' + missing.slice(0, 6).join(',') : ''}`);
  const dead = await p.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href')).filter((h) => h.length > 1 && !document.getElementById(h.slice(1))));
  check(dead.length === 0, `L1 every in-page anchor resolves${dead.length ? ' — dead ' + [...new Set(dead)].join(',') : ''}`);

  // L2
  const cards = await p.evaluate(() => ({ n: document.querySelectorAll('.emp-card').length, cur: document.querySelectorAll('.emp-card.is-current').length }));
  check(cards.n === 5 && cards.cur === 1, `L2 5 employer cards, 1 current — read ${cards.n}/${cards.cur}`);
  const st = (i) => p.evaluate((i) => { const c = document.querySelectorAll('.emp-card')[i], b = c.querySelector('.emp-back');
    return { exp: c.querySelector('.emp-open').getAttribute('aria-expanded'), inert: b.hasAttribute('inert'), tf: getComputedStyle(b).transform, h: Math.round(c.getBoundingClientRect().height),
      focus: document.activeElement && document.activeElement.className }; }, i);
  const ang = (tf) => { if (!/matrix3d/.test(tf)) return 0; const m = tf.slice(tf.indexOf('(') + 1).split(',').map(Number); return Math.round(Math.acos(Math.max(-1, Math.min(1, m[0]))) * 180 / Math.PI); };
  const body = async (n) => { const el = await p.$(`.emp-card:nth-child(${n}) .emp-name`); await el.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' })); await sleep(300); const bb = await el.boundingBox(); return { x: bb.x + 10, y: bb.y + bb.height / 2 }; };
  let pt = await body(2);
  await p.mouse.click(pt.x, pt.y);
  // Sample on the transition's own clock, not the wall clock: under load the first frame lands late and a 150 ms
  // wall-clock read gave 19° (and an unfinished 176° at 1 s) on a correct page. A swap has no transition -> 0°.
  const mid = await p.evaluate(async () => {
    const f = document.querySelectorAll('.emp-card')[1].querySelector('.emp-front');
    let a = null;
    for (let i = 0; i < 20 && !a; i++) { a = f.getAnimations().find((x) => x.transitionProperty === 'transform') || null; if (!a) await new Promise((r) => requestAnimationFrame(r)); }
    if (!a) return getComputedStyle(f).transform;
    a.pause(); a.currentTime = 150;
    const tf = getComputedStyle(f).transform;
    a.play();
    return tf;
  });
  await p.evaluate(() => Promise.all(document.querySelectorAll('.emp-card')[1].getAnimations({ subtree: true }).map((x) => x.finished.catch(() => null))));
  await sleep(100);
  let s = await st(1);
  const front = await p.evaluate(() => getComputedStyle(document.querySelectorAll('.emp-card')[1].querySelector('.emp-front')).transform);
  check(s.exp === 'true' && !s.inert && ang(s.tf) <= 2 && ang(front) >= 178, `L2 a click on the card body flips card 2 (expanded, back live and square ${ang(s.tf)}°, front turned away ${ang(front)}°)`);
  check(ang(mid) >= 20 && ang(mid) <= 170, `L2 150 ms after the click the front is mid-turn (${ang(mid)}°, 20–170) — a 3D turn, not a swap`);
  const btn = await p.evaluate(() => { const b = document.querySelector('.emp-card .emp-open'), r = b.getBoundingClientRect();
    const shown = [...b.querySelectorAll('*')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && e.getBoundingClientRect().width > 1).map((e) => e.textContent.trim());
    const own = [...b.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim());
    return { txt: shown.concat(own).join(' '), w: Math.round(r.width), h: Math.round(r.height), label: b.textContent.trim() }; });
  check(btn.txt === '' && btn.w <= 40 && btn.h <= 40 && /Details/.test(btn.label), `L2 the turn button is a small icon (no shown text "${btn.txt}", ${btn.w}×${btn.h} px), named "${btn.label}" for screen readers`);
  pt = await body(4);
  await p.mouse.click(pt.x, pt.y); await sleep(1000);
  const a = await st(1), b = await st(3);
  check(a.exp === 'false' && a.inert && b.exp === 'true', `L2 opening card 4 flips card 2 home (one open at a time)`);
  await p.keyboard.press('Escape'); await sleep(900);
  await p.focus('.emp-card:nth-child(3) .emp-open'); await p.keyboard.press('Enter'); await sleep(900);
  const k = await st(2);
  check(k.exp === 'true' && /emp-close/.test(k.focus), `L2 keyboard: Enter on the turn button flips card 3 and focus moves to Back (${k.focus})`);
  await p.keyboard.press('Escape'); await sleep(900);
  const c = await st(2);
  check(c.exp === 'false' && c.inert && /emp-open/.test(c.focus), `L2 Esc flips card 3 home and returns focus to the turn button`);
  check(p.errors.length === 0, `L2 no page errors — ${p.errors.join(' | ')}`);

  // L4 (1440)
  const nav = await p.evaluate(() => { const n = document.querySelector('.navbar'), cs = getComputedStyle(n);
    const href = (sel) => [...document.querySelectorAll(sel)].map((a) => a.getAttribute('href'));
    return { h: Math.round(n.getBoundingClientRect().height), blur: cs.backdropFilter, sh: cs.boxShadow,
      navPill: href('.navbar .rz-pill-cta'), navPillShown: [...document.querySelectorAll('.navbar .rz-pill-cta')].filter((e) => e.offsetParent).length,
      hero: href('#home .rz-pill-cta'), contact: href('#contact .rz-pill-cta') }; });
  check(nav.blur === 'none' && nav.sh === 'none' && Math.abs(nav.h - 64) <= 2, `L4 nav flat, ${nav.h}px (blur ${nav.blur}, shadow ${nav.sh})`);
  const okHref = (l) => l.length === 1 && /^(#contact|mailto:)/.test(l[0]);
  check(okHref(nav.navPill) && nav.navPillShown === 1 && okHref(nav.hero) && okHref(nav.contact), `L4 pill CTA: nav ${nav.navPill}, hero ${nav.hero}, contact ${nav.contact}`);
  const look = await p.evaluate(() => { const cs = (e) => getComputedStyle(e);
    const fronts = [...document.querySelectorAll('.emp-front')], cur = document.querySelector('.emp-card.is-current .emp-front');
    const li = document.querySelector('.emp-skills li'), marker = getComputedStyle(li, '::before').content;
    return { bgs: new Set(fronts.map((f) => cs(f).backgroundColor)).size, curTop: cs(cur).borderTopWidth, marker, clock: !!document.querySelector('.rz-meta-row, .rz-meta-clock'),
      names: [...document.querySelectorAll('.emp-name')].map((n) => cs(n).textTransform + '/' + cs(n).fontFamily.split(',')[0]) }; });
  check(look.bgs === 1 && look.curTop === '3px', `L2v2 the current employer is a rule, not an inverted card (card backgrounds ${look.bgs}, top rule ${look.curTop})`);
  check(look.marker !== '"–"' && look.marker !== '"-"', `L2v2 skills carry a square marker, not a dash (::before content ${look.marker})`);
  check(look.names.every((n) => n.startsWith('none/') && !/Condensed/.test(n)), `L2v2 names in sentence case, Plex Sans (${look.names[0]})`);
  check(!look.clock, 'L4 no clock row (owner 2026-11-08: "tulisan jam bekasi nggak usah")');
  await p.close();

  // L2 reduced motion: no rotation
  p = await open(1440, 'light', true);
  await p.click('.emp-card:nth-child(2) .emp-open'); await sleep(60);
  const rm = await p.evaluate(() => { const c = document.querySelectorAll('.emp-card')[1], b = c.querySelector('.emp-back'), f = c.querySelector('.emp-front');
    return getComputedStyle(f).transform + '|' + getComputedStyle(b).transform + '|' + getComputedStyle(b).transitionProperty; });
  check(/^none\|none\|.*opacity/.test(rm), `L2 reduced motion: the back fades in, no rotation — ${rm}`);
  await p.close();

  // L3 + L5 at three widths, both themes for 390
  for (const [w, theme] of [[390, 'light'], [390, 'dark'], [1024, 'light'], [1440, 'dark']]) {
    p = await open(w, theme);
    const r = await p.evaluate(() => {
      const f = document.querySelector('.rz-foot-in'), fs = getComputedStyle(f), m = document.querySelector('.rz-foot-mark img');
      const cols = new Set([...document.querySelectorAll('.emp-card')].map((c) => Math.round(c.getBoundingClientRect().left))).size;
      const logos = [...document.querySelectorAll('.emp-logo')].filter((i) => i.offsetParent).map((i) => ({ h: Math.round(i.getBoundingClientRect().height), src: i.getAttribute('src') }));
      const text = document.querySelector('.rz-foot').innerText;
      const gap = Math.max(...[...document.querySelectorAll('.emp-card')].map((c) => { const b = c.querySelector('.emp-front .emp-btn').getBoundingClientRect(), l = c.querySelector('.emp-front .emp-skills').getBoundingClientRect(); return Math.round(b.top - l.bottom); }));
      return { sw: document.documentElement.scrollWidth, cols, gap, logos, mark: m.getBoundingClientRect().width, box: f.clientWidth - parseFloat(fs.paddingLeft) - parseFloat(fs.paddingRight),
        links: [...document.querySelectorAll('.rz-foot a')].map((a) => a.getAttribute('href')), text, html: document.documentElement.outerHTML.includes('ALL OPERATIONAL DATASETS') || document.documentElement.outerHTML.includes('BUILT FOR MISSION CRITICAL') };
    }, w);
    // R126 (owner 2026-11-14: "kok size card saat flip jadi berubah … dimensinya harus tetap"): a card keeps its
    // width and height when it turns. This replaces R079's "a card is as tall as the face it shows".
    const turn = await p.evaluate(async () => {
      const out = [], backs = [];
      const done = (c) => Promise.all(c.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => null)));
      for (const c of document.querySelectorAll('.emp-card')) {
        c.scrollIntoView({ block: 'center', behavior: 'instant' });
        const r0 = c.getBoundingClientRect();
        c.querySelector('.emp-open').click(); await new Promise((r) => requestAnimationFrame(r)); await done(c);
        const r1 = c.getBoundingClientRect();
        // the back fills the card's box; a long back scrolls inside it to its last fact; Back stays inside the box
        // the back fills the card's box; its fact list scrolls inside it to the last fact; Back never covers a fact
        const bk = c.querySelector('.emp-back'), fl = bk.querySelector('.emp-facts'), btn = bk.querySelector('.emp-close'), last = fl.querySelector(':scope > div:last-child');
        const within = (e, box) => { const a = e.getBoundingClientRect(), b = box.getBoundingClientRect(); return a.top >= b.top - 1 && a.bottom <= b.bottom + 1; }; // scrollTop is whole pixels
        const clear = () => { const a = btn.getBoundingClientRect(), f = fl.getBoundingClientRect(); return a.top >= f.bottom - 0.5; };
        const bb = bk.getBoundingClientRect(), btnTop = within(btn, bk) && clear();
        fl.scrollTop = fl.scrollHeight; await new Promise((r) => requestAnimationFrame(r));
        const fit = Math.abs(bb.height - r1.height) <= 0.5 && Math.abs(bb.width - r1.width) <= 0.5;
        backs.push({ fit, btnTop, btnEnd: within(btn, bk) && clear(), lastSeen: within(last, fl), scrolls: fl.scrollHeight > fl.clientHeight + 1, ov: getComputedStyle(fl).overflowY });
        c.querySelector('.emp-close').click(); await new Promise((r) => requestAnimationFrame(r)); await done(c);
        const r2 = c.getBoundingClientRect();
        out.push({ dw: Math.max(Math.abs(r1.width - r0.width), Math.abs(r2.width - r0.width)), dh: Math.max(Math.abs(r1.height - r0.height), Math.abs(r2.height - r0.height)), h0: Math.round(r0.height), h1: Math.round(r1.height) });
      }
      return { out, backs };
    });
    const sizes = turn.out, backs = turn.backs;
    const worst = sizes.reduce((m, x) => Math.max(m, x.dw, x.dh), 0);
    check(sizes.length === 5 && worst <= 0.5, `L3 ${theme} ${w}: every card keeps its size when it turns (largest change ${worst.toFixed(1)} px; heights front/back ${sizes.map((x) => x.h0 + '/' + x.h1).join(' ')})`);
    const badBack = backs.map((b, i) => (b.fit && b.btnTop && b.btnEnd && b.lastSeen && (!b.scrolls || b.ov === 'auto') ? null : `card ${i + 1} ${JSON.stringify(b)}`)).filter(Boolean);
    check(backs.length === 5 && !badBack.length, `L3 ${theme} ${w}: each back fills the card's box, fact list scrolls inside it to the last fact (${backs.filter((b) => b.scrolls).length} of 5 scroll), Back never covers a fact${badBack.length ? ' — ' + badBack[0] : ''}`);
    if (w === 390) {
      check(r.sw <= 390, `L3 ${theme} 390: no horizontal scroll (scrollWidth ${r.sw})`);
      check(r.cols === 1, `L3 ${theme} 390: cards in one column (${r.cols} column x-positions)`);
    }
    check(r.logos.length === 5 && r.logos.every((l) => l.h === 28 && /\.svg(\?|$)/.test(l.src)), `L3 ${theme} ${w}: 5 logos shown, one height (28 px), each a vector — ${r.logos.map((l) => l.h).join(',')}`);
    check(Math.abs(r.mark - r.box) <= 2, `L5 ${w}: wordmark ${r.mark.toFixed(0)} px = footer box ${r.box.toFixed(0)} px`);
    if (w === 1440) {
      const bad = r.links.filter((h) => !(/^(mailto:|https:\/\/|#)/.test(h) || existsSync(resolve(ROOT, decodeURI(h.split('#')[0])))));
      check(bad.length === 0, `L5 all ${r.links.length} footer links resolve${bad.length ? ' — ' + bad.join(',') : ''}`);
      const banned = /\+?\d[\d\s-]{8,}\d|Jl\.|Jalan|street|open to|available for|hire|let's talk|contact us/i;
      check(!banned.test(r.text), `L5 footer carries no phone, address or availability copy`);
      check(!r.html, 'L5 the old mono slogan is gone');
    }
    await p.close();
  }
} finally { await browser.close(); }
console.log(fail ? `FAIL — ${fail} R079 law(s) broken` : 'PASS — the R079 homepage laws hold on the rendered page');
process.exit(fail ? 1 : 0);
