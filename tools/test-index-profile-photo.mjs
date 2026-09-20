#!/usr/bin/env node
/**
 * test-index-profile-photo.mjs — the owner's portrait, on his own terms.
 *
 * The brief was three sentences long and every one of them is a testable property:
 *   "pakai ini saat dark mode/rainbow, dan pakai ini saat day mode"  -> the right face per theme
 *   "jangan sampai terpotong atau tidak proportional"                -> never cropped, never stretched
 *   "jangan sampai pecah utk display laptop atau mobile"             -> a real pixel budget per device
 *
 * WHY A GATE. The frames the photo sits in do not agree on a shape, and the CSS that decides
 * whether that crops is three declarations away from the markup that sets it. `object-fit: cover`
 * is the default instinct of every future edit to this card; on a phone it cut 31% of the height
 * and on a tablet 46% of the width, and nothing on the page said so. This gate is the sentence
 * "don't crop my face" written where a regression has to walk past it.
 *
 * WHAT IT ASSERTS, at 4 viewports x {light, dark, rainbow}
 *   P1 theme: light shows the day portrait, dark AND rainbow show the studio portrait — hero and
 *      About alike (html.rz-rainbow always carries data-theme="dark", so one rule serves both)
 *   P2 never cropped: the sharp layer computes object-fit:contain and its frame carries a blurred
 *      fill sibling, so the whole photo is visible and the box is filled without a stretch
 *   P3 never stretched: the rendered aspect of the picked file equals the master's within 1%
 *   P4 never soft: the file the browser actually picked is at least as wide as the CSS box times
 *      the device pixel ratio (or is the widest rung there is)
 *   P5 a real ladder: AVIF + WebP + JPEG, every rung on disk, `sizes` on every source, no rung
 *      wider than its master (upscaling is bytes for nothing), and a byte budget per rung
 *   P6 no layout shift: width/height on every <img> matches the aspect of what it loads
 *
 * Usage: node tools/test-index-profile-photo.mjs
 */
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep, join } from 'node:path';
import puppeteer from 'puppeteer';

const ROOT = process.cwd();
const PAGE = 'index.html';
/* masters, for the no-upscale rule */
const MASTER = { 'profile-light': 1222, 'profile-dark': 1010 };
/* a rung may not cost more than this — the phone rung is the one that decides a 3G first paint */
const BUDGET_KB = { avif: 40, webp: 70, jpg: 150 };
const ASPECT = 1010 / 1064;          /* both masters, to 4 decimals */

const MIME = Object.freeze({ '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.avif': 'image/avif', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.mp4': 'video/mp4' });
const server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const full = resolve(ROOT, decodeURIComponent(pathname.slice(1) || 'index.html'));
    if (full !== ROOT && !full.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
    try { res.writeHead(200, { 'content-type': MIME[extname(full)] || 'application/octet-stream' }).end(await readFile(full)); } catch { res.writeHead(404).end(); }
});
await new Promise((accept) => server.listen(0, '127.0.0.1', accept));

const failures = [];
const rows = [];
const fail = (m) => failures.push(m);

/* ---- P5, statically: the ladder the markup promises must exist on disk ---- */
const html = await readFile(join(ROOT, PAGE), 'utf8');
const rungs = [...new Set([...html.matchAll(/assets\/(profile-(?:light|dark))-(\d+)\.(avif|webp|jpg)/g)]
    .map((m) => ({ file: m[0], stem: m[1], width: Number(m[2]), ext: m[3] })).map((r) => JSON.stringify(r)))].map((s) => JSON.parse(s));
assert.ok(rungs.length >= 24, `expected a real responsive ladder in ${PAGE}, found ${rungs.length} rungs`);
for (const rung of rungs) {
    let info;
    try { info = await stat(join(ROOT, rung.file)); } catch { fail(`P5 ${rung.file} is referenced but not on disk`); continue; }
    const kb = info.size / 1024;
    if (kb > BUDGET_KB[rung.ext]) fail(`P5 ${rung.file} is ${kb.toFixed(1)} KB, over the ${BUDGET_KB[rung.ext]} KB budget for .${rung.ext}`);
    if (rung.width > MASTER[rung.stem]) fail(`P5 ${rung.file} is wider than its master (${MASTER[rung.stem]} px) — upscaling is bytes for nothing`);
}
for (const ext of ['avif', 'webp', 'jpg']) {
    if (!rungs.some((r) => r.ext === ext)) fail(`P5 the ladder carries no .${ext} rung`);
}
const sourceTags = [...html.matchAll(/<source[^>]*srcset="assets\/profile-[^"]+"[^>]*>/g)].map((m) => m[0]);
for (const tag of sourceTags) {
    if (!/\bsizes="/.test(tag)) fail(`P5 a <source> carries srcset without sizes: ${tag.slice(0, 90)}`);
}

const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
try {
    for (const [width, height, vp, dpr] of [[1680, 1000, 'desktop', 2], [1280, 860, 'laptop', 2], [900, 800, 'tablet', 2], [390, 780, 'phone', 3]]) {
        for (const theme of ['light', 'dark', 'rainbow']) {
            const tab = await browser.newPage();
            await tab.setViewport({ width, height, deviceScaleFactor: dpr });
            await tab.evaluateOnNewDocument((t) => {
                try {
                    localStorage.setItem('theme', t === 'rainbow' ? 'dark' : t);
                    if (t === 'rainbow') { localStorage.setItem('rzRainbow', '1'); } else { localStorage.removeItem('rzRainbow'); }
                } catch (e) { /* storage disabled */ }
            }, theme);
            await tab.goto(`http://127.0.0.1:${server.address().port}/${PAGE}`, { waitUntil: 'networkidle0', timeout: 45000 });
            await new Promise((accept) => setTimeout(accept, 500));
            const seen = await tab.evaluate(() => {
                const visible = (el) => el && el.getClientRects().length > 0;
                const read = (el) => {
                    if (!el) { return null; }
                    const rect = el.getBoundingClientRect();
                    const cs = getComputedStyle(el);
                    const frame = el.closest('.rz-photo-frame');
                    return {
                        file: (el.currentSrc || '').split('/').pop().split('?')[0],
                        box: { w: +rect.width.toFixed(1), h: +rect.height.toFixed(1) },
                        nat: { w: el.naturalWidth, h: el.naturalHeight },
                        fit: cs.objectFit,
                        attrs: { w: Number(el.getAttribute('width')), h: Number(el.getAttribute('height')) },
                        blurFill: !!(frame && frame.querySelector('.rz-photo-fill')),
                    };
                };
                return {
                    theme: document.documentElement.getAttribute('data-theme'),
                    rainbow: document.documentElement.classList.contains('rz-rainbow'),
                    hero: read([...document.querySelectorAll('.bento-photo-img')].find(visible)),
                    about: read([...document.querySelectorAll('.about-image')].find(visible)),
                    dpr: window.devicePixelRatio,
                };
            });
            await tab.close();

            const wantStem = theme === 'light' ? 'profile-light' : 'profile-dark';
            for (const [slot, shot] of [['hero', seen.hero], ['about', seen.about]]) {
                if (!shot) { fail(`${vp}/${theme} ${slot}: no visible portrait`); continue; }
                if (!shot.nat.w) { continue; }   /* below the fold and not yet lazy-loaded */
                rows.push({ vp, theme, slot, file: shot.file, box: `${shot.box.w}x${shot.box.h}`, fit: shot.fit });

                /* P1 */
                if (!shot.file.startsWith(wantStem)) fail(`P1 ${vp}/${theme} ${slot} shows ${shot.file}, expected a ${wantStem} rung`);
                /* P2 */
                if (shot.fit !== 'contain') fail(`P2 ${vp}/${theme} ${slot} computes object-fit:${shot.fit} — the photo is being cropped or stretched`);
                if (!shot.blurFill) fail(`P2 ${vp}/${theme} ${slot} has no blurred fill behind it, so contain leaves an empty band`);
                /* P3 */
                const natAspect = shot.nat.w / shot.nat.h;
                if (Math.abs(natAspect - ASPECT) / ASPECT > 0.01) fail(`P3 ${vp}/${theme} ${slot} loaded ${shot.file} at aspect ${natAspect.toFixed(4)}, master is ${ASPECT.toFixed(4)}`);
                /* P4 — read the rung from the FILE, never from naturalWidth. With w-descriptors
                   the UA reports a density-corrected intrinsic size (a 640 px file picked at 2.08x
                   reports 307), so naturalWidth measures the layout, not the pixels delivered. */
                const rung = Number((shot.file.match(/-(\d+)\.(?:avif|webp|jpg)$/) || [])[1] || 0);
                const needed = shot.box.w * seen.dpr;
                const widest = MASTER[wantStem];
                if (!rung) {
                    fail(`P4 ${vp}/${theme} ${slot} loaded ${shot.file}, which is not a ladder rung`);
                } else if (rung + 1 < Math.min(needed, widest)) {
                    fail(`P4 ${vp}/${theme} ${slot} picked the ${rung}px rung for a ${shot.box.w}px box at dpr ${seen.dpr} — needs ${Math.ceil(Math.min(needed, widest))}px`);
                }
                /* P6 */
                const attrAspect = shot.attrs.w / shot.attrs.h;
                if (!shot.attrs.w || Math.abs(attrAspect - natAspect) / natAspect > 0.01) {
                    fail(`P6 ${vp}/${theme} ${slot} declares ${shot.attrs.w}x${shot.attrs.h} (aspect ${attrAspect.toFixed(3)}) but loads ${natAspect.toFixed(3)} — that is layout shift`);
                }
            }
            /* rainbow must land on the dark portrait via data-theme, not a rule of its own */
            if (theme === 'rainbow' && !(seen.rainbow && seen.theme === 'dark')) {
                fail(`P1 ${vp}/rainbow did not reach rainbow state (theme=${seen.theme}, rz-rainbow=${seen.rainbow})`);
            }
        }
    }
} finally { await browser.close(); server.close(); }

console.log(`INDEX PROFILE PHOTO — ${rungs.length} ladder rungs, ${rows.length} rendered checks`);
for (const r of rows.filter((x) => x.vp === 'phone' || x.slot === 'hero')) {
    console.log(`  ${r.vp.padEnd(8)} ${r.theme.padEnd(8)} ${r.slot.padEnd(6)} ${r.file.padEnd(26)} box ${r.box.padEnd(12)} ${r.fit}`);
}
if (failures.length) { console.error(`\nFAIL\n  ${failures.join('\n  ')}`); process.exit(1); }
console.log('\nPASS — right face per theme, whole photo at every width, sharp at every dpr');
