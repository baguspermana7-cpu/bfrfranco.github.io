#!/usr/bin/env node
/**
 * The gated cockpit must still say something true to a reader who cannot enter it.
 *
 * WHY THIS GATE EXISTS
 *
 * `datahallAI.html` is in `sitemap.xml` and declares `robots: index, follow`, and it ships
 * `<body class="locked">` in its static HTML. Until v3.11.9 `body.locked` applied
 * `filter:blur(4px); pointer-events:none` to `.wrap`/`.mn` behind a fixed scrim holding a 430px card
 * that said "access required" and offered nothing else. So search traffic — and any rendering
 * crawler — met a blurred wall, while the indexed text described a cockpit no visitor could read.
 * Of the five root-gated pages on this site the other four are `noindex, nofollow` and
 * sitemap-absent; this one is the exception, deliberately, because the engineering is worth finding.
 *
 * v3.11.9 makes the indexed page and the visible page the same thing: the gate became an in-flow
 * public brief with real prose and the facility's headline figures, rendered from the parameter
 * registry under the same basis ids the dashboard cells carry, and the cockpit is HIDDEN rather
 * than teased. This gate holds that arrangement, because every part of it is easy to undo by
 * accident — a stray `display:flex`, a typed number, a wall that creeps back.
 *
 * WHAT IT ASSERTS
 *
 *   P1  locked: the brief is visible, the cockpit is display:none, and NOTHING is blurred
 *   P2  the brief is substantive — at least 150 words, not a placeholder
 *   P3  every figure equals its registry value for the id on the cell (no typed numbers)
 *   P4  no figure is an em dash while the registry is loaded
 *   P5  a figure click opens the basis record — public readers get the traceability too
 *   P6  at 390px: no horizontal overflow, figures >= 44px, links >= 24px (WCAG 2.5.8)
 *   P7  unlocked: the brief is gone and the cockpit has a real box
 *   P8  fail-closed: with the registry removed, every figure renders an em dash, never a guess
 *   P9  the AUTHORITY contract: the brief reads the registry twin rather than the engine, so it
 *       could paint while the cockpit itself is showing em dashes. With the authority attribute
 *       set to anything but `current` every figure must be a dash — a public reader is never shown
 *       a number the page itself refuses to stand behind
 *
 * Usage: node tools/test-dcai-public-brief.mjs [--json]
 */
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import puppeteer from 'puppeteer';

const ROOT = process.cwd();
const PAGE = 'datahallAI.html';
const JSON_OUT = process.argv.includes('--json');
const DASH = String.fromCharCode(0x2014);   /* the em dash the page prints when a value cannot resolve */
const REGISTRY = JSON.parse(readFileSync(resolve(ROOT, 'data/dcai-parameters.json'), 'utf8'));
const BY_ID = new Map((REGISTRY.parameters || []).map((p) => [p.id, p]));

const MIME = Object.freeze({ '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' });
const server = createServer(async (req, res) => {
    const full = resolve(ROOT, decodeURIComponent(new URL(req.url, 'http://localhost').pathname.slice(1)));
    if (full !== ROOT && !full.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
    try { res.writeHead(200, { 'content-type': MIME[extname(full)] || 'application/octet-stream' }).end(await readFile(full)); }
    catch { res.writeHead(404).end(); }
});
await new Promise((a) => server.listen(0, '127.0.0.1', a));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const failures = [];
const note = (ok, msg) => { if (!ok) failures.push(msg); };
const sleep = (ms) => new Promise((a) => setTimeout(a, ms));

async function open(width = 1440) {
    const tab = await browser.newPage();
    const errors = [];
    tab.on('pageerror', (e) => errors.push(String(e && e.message ? e.message : e)));
    await tab.setViewport({ width, height: 900 });
    await tab.goto(`${base}/${PAGE}`, { waitUntil: 'load', timeout: 120000 });
    await sleep(2500);
    return { tab, errors };
}

/* ---- P1..P5 on a desktop width ------------------------------------------------------------- */
{
    const { tab, errors } = await open(1440);
    const state = await tab.evaluate(() => {
        const gate = document.getElementById('rootGate');
        const wrap = document.querySelector('.wrap');
        const tabs = document.getElementById('tabs');
        const grid = document.getElementById('rzBriefGrid');
        /* the wall checks must not depend on the brief existing: on a tree that has no brief we
           still want the report to name the blur, which is the defect this release removes */
        if (!gate) return { missing: 'rootGate' };
        const gs = getComputedStyle(gate);
        return {
            locked: document.body.classList.contains('locked'),
            gateDisplay: gs.display,
            gateFilter: gs.filter,
            wrapDisplay: wrap ? getComputedStyle(wrap).display : 'missing',
            wrapFilter: wrap ? getComputedStyle(wrap).filter : 'missing',
            tabsDisplay: tabs ? getComputedStyle(tabs).display : 'missing',
            words: (gate.innerText || '').trim().split(/\s+/).filter(Boolean).length,
            gridMissing: !grid,
            figs: [...(grid ? grid.querySelectorAll('.rz-brief-fig') : [])].map((f) => ({
                id: f.getAttribute('data-basis-param'),
                raw: f.querySelector('.rz-brief-v') ? f.querySelector('.rz-brief-v').textContent.trim() : '',
            })),
        };
    });
    if (state.missing) {
        note(false, `P1 #${state.missing} is not on the page`);
    } else {
        note(!state.gridMissing, 'P3 #rzBriefGrid is not on the page - there is no public brief, only a gate');
        note(state.locked, 'P1 the page did not start in its locked state, so this measures the wrong thing');
        note(state.gateDisplay !== 'none', `P1 the public brief is display:${state.gateDisplay} while locked`);
        note(state.wrapDisplay === 'none', `P1 the cockpit is display:${state.wrapDisplay} while locked — it must be hidden, not shown`);
        note(state.tabsDisplay === 'none', `P1 the tab strip is display:${state.tabsDisplay} while locked — dead controls`);
        note(!/blur/.test(state.wrapFilter), `P1 the cockpit is blurred (${state.wrapFilter}) — a blurred wall is what this release removed`);
        note(!/blur/.test(state.gateFilter), `P1 the brief itself is blurred (${state.gateFilter})`);
        note(state.words >= 150, `P2 the brief carries only ${state.words} words — a placeholder, not a brief`);
        note(state.figs.length >= 6, `P3 only ${state.figs.length} figures rendered`);

        for (const fig of state.figs) {
            const rec = BY_ID.get(fig.id);
            if (!rec) { note(false, `P3 ${fig.id} is not a registry id`); continue; }
            note(!/—/.test(fig.raw), `P4 ${fig.id} rendered an em dash while the registry is loaded`);
            /* strip the unit span text and thousands separators, then compare numerically at the
               precision the cell prints — a typed number will not survive this */
            const shown = Number(String(fig.raw).replace(/[^0-9.\-]/g, ''));
            const expectRaw = fig.id === 'heat.liquid_capture_ratio' ? rec.value * 100 : rec.value;
            const dp = (String(fig.raw).split('.')[1] || '').replace(/[^0-9]/g, '').length;
            const expect = Number(expectRaw.toFixed(dp));
            note(Number.isFinite(shown) && Math.abs(shown - expect) < Math.pow(10, -dp) / 2 + 1e-9,
                `P3 ${fig.id} prints ${fig.raw} but the registry says ${expect} — the brief has drifted from the engine`);
        }

        /* P5 — a public reader clicking a figure gets the basis record */
        await tab.evaluate(() => {
            const f = document.querySelector('#rzBriefGrid .rz-brief-fig[data-basis-param]');
            if (f) f.click();
        });
        await sleep(900);
        const drawer = await tab.evaluate(() => {
            const d = document.getElementById('rz-basis-drawer');
            return { found: !!d, shown: !!(d && getComputedStyle(d).display !== 'none'), text: d ? (d.textContent || '').length : 0 };
        });
        note(drawer.found && drawer.shown && drawer.text > 80,
            `P5 clicking a figure did not open a populated basis record: ${JSON.stringify(drawer)}`);
    }
    note(errors.length === 0, `P1 page errors on the public path: ${errors.slice(0, 2).join(' | ')}`);
    await tab.close();
}

/* ---- P6 at a phone width ------------------------------------------------------------------- */
{
    const { tab } = await open(390);
    const m = await tab.evaluate(() => {
        const grid = document.getElementById('rzBriefGrid');
        const small = [...(grid ? grid.querySelectorAll('.rz-brief-fig') : [])]
            .map((f) => Math.round(f.getBoundingClientRect().height)).filter((h) => h < 44);
        const links = [...document.querySelectorAll('#rootGate a, #rootGate button')]
            .map((a) => ({ t: (a.textContent || '').trim().slice(0, 24), h: Math.round(a.getBoundingClientRect().height) }))
            .filter((a) => a.h > 0 && a.h < 24);
        return { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, small, links };
    });
    note(m.overflow <= 0, `P6 the brief overflows horizontally by ${m.overflow}px at 390px`);
    note(m.small.length === 0, `P6 ${m.small.length} figure cell(s) under 44px at 390px: ${m.small.join(', ')}`);
    note(m.links.length === 0, `P6 control(s) under 24px at 390px (WCAG 2.5.8): ${JSON.stringify(m.links)}`);
    await tab.close();
}

/* ---- P7 unlocked, and P8 fail-closed ------------------------------------------------------- */
{
    const { tab } = await open(1440);
    const un = await tab.evaluate(() => {
        document.body.classList.remove('locked');           /* what auth.js does on a valid session */
        const gate = document.getElementById('rootGate');
        const wrap = document.querySelector('.wrap');
        const box = wrap ? wrap.getBoundingClientRect() : null;
        return {
            gate: gate ? getComputedStyle(gate).display : 'missing',
            wrap: wrap ? getComputedStyle(wrap).display : 'missing',
            w: box ? Math.round(box.width) : 0, h: box ? Math.round(box.height) : 0,
        };
    });
    note(un.gate === 'none', `P7 the public brief is still display:${un.gate} after unlocking`);
    note(un.wrap !== 'none' && un.w > 100 && un.h > 100,
        `P7 the cockpit did not come back after unlocking: ${JSON.stringify(un)}`);

    /* P8 must REPORT on a tree that has no painter, not throw: a gate that crashes proves less
       than one that names what is missing (the same lesson as D4 in test-dcai-deferred-panels). */
    const closed = await tab.evaluate(() => {
        if (typeof window.rzPaintPublicBrief !== 'function') return { missing: true };
        delete window.RZ_DCAI_PARAMETERS;                   /* the registry fails to load */
        window.rzPaintPublicBrief();
        return { values: [...document.querySelectorAll('#rzBriefGrid .rz-brief-v')].map((v) => v.textContent.trim()) };
    });
    note(!closed.missing, 'P8 window.rzPaintPublicBrief is not defined - the brief has no painter to fail closed');
    if (!closed.missing) {
        note(closed.values.length > 0 && closed.values.every((t) => t === DASH),
            `P8 with no registry the brief printed ${JSON.stringify(closed.values.slice(0, 4))} instead of a dash for every figure - it must fail closed, never guess`);
    }
    await tab.close();
}

/* ---- P9: the brief obeys the page's fail-closed authority contract ------------------------- */
{
    const { tab } = await open(1440);
    const res = await tab.evaluate(() => {
        if (typeof window.rzPaintPublicBrief !== 'function') return { missing: true };
        const before = [...document.querySelectorAll('#rzBriefGrid .rz-brief-v')].map((v) => v.textContent.trim());
        document.body.setAttribute('data-datahall-authority', 'unavailable');
        window.rzPaintPublicBrief();
        const during = [...document.querySelectorAll('#rzBriefGrid .rz-brief-v')].map((v) => v.textContent.trim());
        document.body.setAttribute('data-datahall-authority', 'current');
        window.rzPaintPublicBrief();
        const after = [...document.querySelectorAll('#rzBriefGrid .rz-brief-v')].map((v) => v.textContent.trim());
        return { before, during, after };
    });
    note(!res.missing, 'P9 no painter to test the authority contract against');
    if (!res.missing) {
        note(res.before.some((t) => t !== DASH), 'P9 the brief was already all dashes before the test — it never paints');
        note(res.during.length > 0 && res.during.every((t) => t === DASH),
            `P9 with authority NOT current the brief still printed ${JSON.stringify(res.during.slice(0, 4))} — it must fail closed like the cockpit`);
        note(res.after.some((t) => t !== DASH), 'P9 the brief did not recover when authority returned to current');
    }
    await tab.close();
}

await browser.close();
server.close();

if (JSON_OUT) console.log(JSON.stringify({ gate: 'dcai-public-brief', failures }, null, 2));
else if (failures.length === 0) console.log('DCAI PUBLIC BRIEF — CLEAN (locked: brief visible and cockpit hidden, figures equal the registry, basis record opens, 390px clean, unlocks, fails closed)');
else { console.log(`DCAI PUBLIC BRIEF — ${failures.length} FAILURE(S)`); for (const f of failures) console.log('  ' + f); }
process.exit(failures.length ? 1 : 0);
