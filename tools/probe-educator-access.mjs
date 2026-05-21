#!/usr/bin/env node
/**
 * probe-educator-access.mjs
 *
 * End-to-end Puppeteer probe verifying the 4-tier × 5-role auth matrix
 * across the gated module pages + the rz-ops admin panel (root-only) +
 * the free-tier hub (index.html).
 *
 * Test sessions: educator, demo, pro, root, anonymous = 5
 * Test pages   : 10 gated modules + rz-ops admin + index hub = 12
 *                + 1 explicit re-probe of standards-ltc-lab with cache-bust =
 *                = 13 pages total
 * Total        : 5 × 13 = 65 assertions
 *
 * Usage:
 *   node tools/probe-educator-access.mjs                       # default BASE
 *   node tools/probe-educator-access.mjs http://127.0.0.1:8090 # explicit
 *   BASE=http://127.0.0.1:8090 node tools/probe-educator-access.mjs
 *
 * Exit code 0 iff every (session, page) actual matches expected AND zero
 * pageerrors across all combinations.
 */

import puppeteer from 'puppeteer';

const BASE = (process.argv[2] || process.env.BASE || 'http://127.0.0.1:8090').replace(/\/+$/, '');

/* ── 11 gated modules (10 unique + 1 cache-bust re-probe of the hub) ───── */
const GATED_PAGES = [
    '/datahallAI.html',
    '/dc-conventional.html',
    '/dcmoc/index.html',
    '/ltc-system-modelling-lab.html',
    '/ltc-ashrae-thermal-control.html',
    '/ltc-uptime-tier-alignment.html',
    '/ltc-ansi-tia-topology-readiness.html',
    '/ltc-iso-energy-governance.html',
    '/ltc-nfpa-fire-risk.html',
    '/standards-ltc-lab.html',
    '/standards-ltc-lab.html?nc=probe'  /* idempotence re-probe with cache-bust */
];
const ADMIN_PAGE = '/rz-ops-p7x3k9m.html';   /* root-only across all sessions */
const FREE_HUB   = '/index.html';            /* universally allowed */

const TEST_PAGES = [...GATED_PAGES, ADMIN_PAGE, FREE_HUB]; /* 13 */

/* ── 5 sessions ─────────────────────────────────────────────────────────── */
const ONE_DAY_MS = 86400000;

const SESSIONS = [
    {
        name: 'educator',
        session: { email: 'educator@resistancezero.com', tier: 'pro', role: 'educator' },
        gatedExpect: 'allow',
        adminExpect: 'block',
        hubExpect: 'allow'
    },
    {
        name: 'demo',
        session: { email: 'demo@resistancezero.com', tier: 'demo', role: 'demo' },
        gatedExpect: 'block',
        adminExpect: 'block',
        hubExpect: 'allow'
    },
    {
        name: 'pro',
        session: { email: 'pro@test.local', tier: 'pro', role: 'pro' },
        gatedExpect: 'allow',
        adminExpect: 'block',
        hubExpect: 'allow'
    },
    {
        name: 'root',
        session: { email: 'bagus@resistancezero.com', tier: 'pro', role: 'root' },
        gatedExpect: 'allow',
        adminExpect: 'allow',
        hubExpect: 'allow'
    },
    {
        name: 'anonymous',
        session: null,
        gatedExpect: 'block',
        adminExpect: 'block',
        hubExpect: 'allow'
    }
];

function expectedFor(sess, path) {
    if (path === ADMIN_PAGE) return sess.adminExpect;
    if (path === FREE_HUB)   return sess.hubExpect;
    return sess.gatedExpect;
}

/* ── Probe ──────────────────────────────────────────────────────────────── */
async function probe() {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    let totalAssertions = 0;
    let pass = 0;
    let fail = 0;
    let totalPageErrors = 0;
    const failures = [];

    for (const sess of SESSIONS) {
        const page = await browser.newPage();
        const errBucket = { current: [] };
        page.on('pageerror', e => errBucket.current.push('pageerror:' + e.message));
        page.on('console', m => {
            if (m.type() === 'error') {
                const t = m.text();
                /* Filter benign network errors (404 for assets) — only true JS errors count */
                if (!/Failed to load resource|404|net::ERR/.test(t)) {
                    errBucket.current.push('console.error:' + t);
                }
            }
        });

        /* Seed session by visiting root first, then writing localStorage */
        try {
            await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 12000 });
        } catch (e) {
            console.error(`[setup] ${sess.name} failed to reach ${BASE}/: ${e.message}`);
            await page.close();
            continue;
        }
        if (sess.session) {
            const payload = { ...sess.session, expires: new Date(Date.now() + ONE_DAY_MS).toISOString() };
            await page.evaluate((p) => {
                localStorage.setItem('rz_premium_session', JSON.stringify(p));
            }, payload);
        } else {
            await page.evaluate(() => {
                try { localStorage.removeItem('rz_premium_session'); } catch (e) {}
            });
        }

        for (const path of TEST_PAGES) {
            totalAssertions++;
            errBucket.current = [];
            const expected = expectedFor(sess, path);
            let actual = 'allow';
            let pageerrors = 0;
            let note = '';

            try {
                const targetUrl = BASE + path;
                await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 15000 });
                /* Wait briefly for in-page gate JS to run */
                await new Promise(r => setTimeout(r, 700));

                const probeResult = await page.evaluate(() => {
                    const out = {};
                    out.bodyLocked = !!(document.body && document.body.classList.contains('locked'));
                    /* rz-ops uses its own login overlay: #loginPage shown when blocked */
                    const loginPage = document.getElementById('loginPage');
                    out.rzOpsLoginShown = !!(loginPage && loginPage.style.display === 'flex');
                    /* rz-modal-overlay shown directly */
                    const modal = document.getElementById('rzModalOverlay');
                    out.rzModalShown = !!(modal && (modal.classList.contains('show') ||
                        /display:\s*flex/i.test(modal.getAttribute('style') || '')));
                    /* rz-ops main-content hidden = blocked */
                    const mainContent = document.getElementById('main-content');
                    out.rzOpsMainHidden = !!(mainContent && mainContent.style.display === 'none');
                    out.location = String(window.location.href || '');
                    return out;
                });

                const finalUrl = page.url();
                /* Determine if blocked:
                 *   - rz-ops admin: loginPage visible OR main-content hidden = blocked
                 *   - DCMOC: redirected away from /dcmoc/ = blocked
                 *   - module pages: body.locked = blocked
                 *   - rz-modal-overlay shown = blocked
                 */
                let blocked = false;
                if (path === ADMIN_PAGE) {
                    blocked = probeResult.rzOpsLoginShown || probeResult.rzOpsMainHidden;
                } else if (path === '/dcmoc/index.html') {
                    /* DCMOC redirects to /datacenter-solutions.html when blocked */
                    const onDcmoc = /\/dcmoc\//.test(finalUrl);
                    blocked = !onDcmoc;
                    if (blocked) note = ` (redirected→${finalUrl.replace(BASE, '')})`;
                } else {
                    blocked = probeResult.bodyLocked || probeResult.rzModalShown;
                }

                actual = blocked ? 'block' : 'allow';
                pageerrors = errBucket.current.length;
                totalPageErrors += pageerrors;
            } catch (e) {
                actual = 'ERROR';
                note = ` err=${e.message.slice(0, 80)}`;
            }

            const status = (actual === expected && pageerrors === 0) ? 'PASS' : 'FAIL';
            if (status === 'PASS') pass++;
            else { fail++; failures.push({ sess: sess.name, path, expected, actual, pageerrors, note }); }

            console.log(`${status} ${sess.name.padEnd(10)} ${path.padEnd(45)} expected=${expected.padEnd(5)} actual=${actual.padEnd(5)} pageerrors=${pageerrors}${note}`);
        }

        await page.close();
    }

    await browser.close();

    console.log('');
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`TOTAL: ${totalAssertions} assertions, ${pass} PASS, ${fail} FAIL, ${totalPageErrors} total pageerrors`);
    console.log('───────────────────────────────────────────────────────────────');

    if (fail > 0) {
        console.log('FAILURES:');
        for (const f of failures) {
            console.log(`  - ${f.sess} ${f.path}: expected=${f.expected} actual=${f.actual} pageerrors=${f.pageerrors}${f.note || ''}`);
        }
    }

    process.exit(fail === 0 && totalPageErrors === 0 ? 0 : 1);
}

probe().catch(e => {
    console.error('FATAL:', e);
    process.exit(2);
});
