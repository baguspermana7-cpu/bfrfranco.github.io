/**
 * Site-wide LEGIBILITY + TRUNCATION audit.
 *
 * Two defect classes, both found on the Conventional cockpits and both invisible to every
 * other gate this site runs:
 *
 *   L1 ILLEGIBLE   a rendered label below MIN_PX high. That is not small text — it is texture
 *                  that looks like information. The chiller P&ID drew equipment labels at
 *                  5-6px and passed collision, clipping, contrast and responsive checks,
 *                  because none of them ask whether a human can READ the thing.
 *   L2 TRUNCATED   an element whose text is clipped by its own box. "Row A · CA-A01" became
 *                  "Row ..." on 25 columns — the same non-label 25 times — and a CRAH reading
 *                  was cut to "25.", which is not a smaller number, it is a DIFFERENT one.
 *                  Numeric truncation is reported separately because it is the dangerous kind.
 *
 * A page may declare `data-rz-pannable` on an SVG it pans and zooms; that exempts nothing
 * here — a label you cannot read is unreadable whether or not the canvas scrolls.
 *
 * Run: node tools/audit-legibility.mjs [--strict] [--page=x.html] [--limit=N]
 */
import { readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep, join } from 'node:path';
import puppeteer from 'puppeteer';

const ROOT = process.cwd();
const ARGS = process.argv.slice(2);
const STRICT = ARGS.includes('--strict');
const ONLY = (ARGS.find((a) => a.startsWith('--page=')) || '').split('=')[1] || null;
const LIMIT = Number((ARGS.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 0);

const MIN_PX = 8.5;
/* Truncation of one or two characters is the browser's normal sub-pixel rounding, not a
   clipped label. Anything past that is losing content. */
const TRUNC_SLACK_PX = 6;

const MIME = Object.freeze({
    '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript',
    '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
    '.webp': 'image/webp', '.woff2': 'font/woff2', '.jsonl': 'application/json',
    '.npz': 'application/octet-stream', '.txt': 'text/plain', '.xml': 'application/xml',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp4': 'video/mp4', '.ico': 'image/x-icon',
});
const server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const relative = pathname.endsWith('/') ? `${pathname.slice(1)}index.html` : pathname.slice(1);
    const full = resolve(ROOT, decodeURIComponent(relative));
    if (full !== ROOT && !full.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
    /* Read BEFORE writing the header: a read that throws after writeHead leaves the response
       half-sent and the next write raises ERR_HTTP_HEADERS_SENT, killing the whole run. */
    let body;
    try { body = await readFile(full); } catch { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': MIME[extname(full)] || 'application/octet-stream' }).end(body);
});
await new Promise((accept) => server.listen(0, '127.0.0.1', accept));
const base = `http://127.0.0.1:${server.address().port}`;

let pages = (await readdir(ROOT)).filter((f) => f.endsWith('.html'));
if (ONLY) pages = pages.filter((p) => p === ONLY);
if (LIMIT) pages = pages.slice(0, LIMIT);
pages.sort();

const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const findings = [];
let scanned = 0;

try {
    for (const page of pages) {
        const tab = await browser.newPage();
        tab.on('pageerror', () => {});
        try {
            await tab.setViewport({ width: 1680, height: 1050 });
            await tab.goto(`${base}/${page}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await new Promise((accept) => setTimeout(accept, 1800));
            const result = await tab.evaluate(({ minPx, slack }) => {
                const out = { illegible: [], truncated: [], truncatedNumeric: [] };
                const seen = new Set();
                const visible = (el) => {
                    const cs = getComputedStyle(el);
                    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
                    return Number(cs.opacity) > 0.05;
                };
                /* L1 — SVG labels only. HTML text inherits a document font scale and is
                   governed by the responsive audits; SVG text is scaled by its viewBox and is
                   where this defect actually lives. */
                for (const el of document.querySelectorAll('svg text')) {
                    if (!visible(el)) continue;
                    const text = (el.textContent || '').trim();
                    if (!text) continue;
                    const box = el.getBoundingClientRect();
                    if (box.height <= 0) continue;
                    if (box.height < minPx) {
                        const key = `i:${text.slice(0, 24)}`;
                        if (seen.has(key)) continue;
                        seen.add(key);
                        out.illegible.push({ text: text.slice(0, 34), px: Math.round(box.height * 10) / 10 });
                    }
                }
                /* L2 — anything whose own box clips its text. */
                for (const el of document.querySelectorAll('*')) {
                    if (el.children.length) continue;
                    if (!visible(el)) continue;
                    const text = (el.textContent || '').trim();
                    if (!text || text.length < 3) continue;
                    const over = el.scrollWidth - el.clientWidth;
                    if (el.clientWidth <= 0 || over <= slack) continue;
                    const cs = getComputedStyle(el);
                    if (cs.overflow === 'visible' && cs.textOverflow !== 'ellipsis') continue;
                    /* Screen-reader-only labels are CLIPPED ON PURPOSE — a 1px box with hidden
                       overflow is how you give an input an accessible name without showing it.
                       Reading that as truncation flagged index.html's contact form for doing
                       accessibility correctly. Verify the instrument before trusting its count. */
                    const box = el.getBoundingClientRect();
                    if (box.width <= 2 || box.height <= 2) continue;
                    if (/inset\(\s*50%/.test(cs.clipPath || '') || (cs.clip || '').startsWith('rect(0')) continue;
                    /* A DELIBERATE, non-lossy truncation: a dense index table may ellipsise a
                       title so the columns line up, PROVIDED the full text stays reachable. The
                       page declares that by carrying it in a title attribute, and the check is
                       that the attribute actually CONTAINS the text — not merely that one
                       exists. An ellipsis with no way back to the words is still lost content. */
                    const declared = el.getAttribute('title') || el.closest('[title]')?.getAttribute('title') || '';
                    if (declared && declared.replace(/\s+/g, ' ').includes(text.replace(/\s+/g, ' '))) continue;
                    const key = `t:${text.slice(0, 24)}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    const row = { text: text.slice(0, 40), overflowPx: Math.round(over) };
                    /* A clipped NUMBER is the dangerous kind: "25." is not a shortened 25.4, it
                       reads as a different value. */
                    if (/\d/.test(text)) out.truncatedNumeric.push(row); else out.truncated.push(row);
                }
                return out;
            }, { minPx: MIN_PX, slack: TRUNC_SLACK_PX });

            scanned += 1;
            for (const f of result.illegible) findings.push({ page, kind: 'L1-illegible', detail: `"${f.text}" renders ${f.px}px` });
            for (const f of result.truncatedNumeric) findings.push({ page, kind: 'L2-truncated-number', detail: `"${f.text}" clipped by ${f.overflowPx}px` });
            for (const f of result.truncated) findings.push({ page, kind: 'L2-truncated', detail: `"${f.text}" clipped by ${f.overflowPx}px` });
        } catch (err) {
            findings.push({ page, kind: 'L0-load', detail: String(err).slice(0, 90) });
        }
        await tab.close();
    }

    const byKind = findings.reduce((acc, f) => { acc[f.kind] = (acc[f.kind] || 0) + 1; return acc; }, {});
    const byPage = findings.reduce((acc, f) => { (acc[f.page] = acc[f.page] || []).push(f); return acc; }, {});
    console.log(`\nLEGIBILITY AUDIT — ${scanned} pages scanned, floor ${MIN_PX}px\n`);
    if (!findings.length) {
        console.log('PASS — no illegible SVG labels, no clipped text.');
    } else {
        console.log(`${STRICT ? 'FAIL' : 'MEASURED'} — ${findings.length} findings: ${JSON.stringify(byKind)}\n`);
        for (const [page, list] of Object.entries(byPage).sort((a, b) => b[1].length - a[1].length)) {
            console.log(`  ${page} — ${list.length}`);
            for (const f of list.slice(0, 6)) console.log(`      [${f.kind}] ${f.detail}`);
            if (list.length > 6) console.log(`      ... and ${list.length - 6} more`);
        }
    }
    if (STRICT && findings.length) process.exitCode = 1;
} finally {
    await browser.close();
    await new Promise((accept) => server.close(accept));
}
