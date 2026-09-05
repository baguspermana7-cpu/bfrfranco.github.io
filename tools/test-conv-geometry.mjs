/**
 * Conventional cockpit GEOMETRY gate — coordinates, positions, arrangement.
 *
 * Owner requirement: "coordinate, position, arrangement dll semuanya harus sangat super accurate, no mistake."
 * Eyeballing a 2300 x 1400 P&ID does not scale, and the Task-1 ledger already recorded exactly these defects
 * ("pump labels/lines collide and right-side zone valves clip in the supplied render"). This gate measures the
 * REAL render instead — puppeteer, live layout boxes, both themes, several viewports.
 *
 * Checks per diagram:
 *   G1 LABEL COLLISION  — no two rendered <text> nodes in the same diagram may overlap. Diagram text is
 *                         positioned by hand; an intersection is a positioning mistake, not a style choice.
 *   G2 CLIPPING         — every rendered element must sit inside its own SVG viewport box. An element outside
 *                         it is drawn but invisible (the "zone valves clip" defect).
 *   G3 PAGE OVERFLOW    — no horizontal document overflow at 360 px.
 *   G4 DEGENERATE NODES — no rendered text with a zero-area box (a label that exists in the DOM but paints
 *                         nothing reads as "missing information" to an operator).
 *
 * Modes:
 *   default        — strict: any violation exits 1.
 *   --measure      — report only, always exit 0. Use to survey the current state before tightening.
 *   --page=<file>  — restrict to one page.
 *
 * Run: node tools/test-conv-geometry.mjs [--measure] [--page=fire-system.html]
 */
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import puppeteer from 'puppeteer';
import { TAB_SETS, NO_TAB_SET, activateTab } from './lib/cockpit-tabs.mjs';
import { primeCockpitAuditDocument, enterAuthorizedAuditState, assertAuthorizedAuditState }
    from './lib/cockpit-audit-state.mjs';

const ROOT = process.cwd();
const ARGS = process.argv.slice(2);
const MEASURE_ONLY = ARGS.includes('--measure');
const ONLY_PAGE = (ARGS.find((a) => a.startsWith('--page=')) || '').split('=')[1] || null;

/* Overlap tolerance in CSS px. Anti-aliasing and font metrics make hairline touching normal; a real
   collision is materially larger. Kept small so genuine overlaps cannot hide behind it. */
const OVERLAP_TOLERANCE_PX = 1.5;
/* Clipping tolerance — an element may sit exactly on the viewport edge. */
const CLIP_TOLERANCE_PX = 1.0;

const MIME = Object.freeze({
  '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.npz': 'application/octet-stream',
  '.jsonl': 'application/json',
});

/* Diagrams under geometry control. Selector = the SVG whose interior coordinates are hand-authored. */
const DIAGRAMS = Object.freeze([
  { page: 'chiller-plant.html', selector: '#pidSvg', label: 'chiller P&ID' },
  { page: 'fire-system.html', selector: '#fire-svg', label: 'fire mimic' },
  { page: 'water-system.html', selector: '#water-svg', label: 'water process' },
  /* EPMS: the root SVG (viewBox 0 0 3600 2600) holds every layer — wires, flow, devices, breakers and
     the telemetry text. Targeting a single layer (e.g. #l-wires) reports texts=0 and measures nothing. */
  { page: 'EPMS_Telemetry.html', selector: 'svg#viewport', label: 'EPMS single-line' },
  /* v1.135.0 — the tabbed cockpit. Its thirteen diagrams live on eight different tabs and five
     electrical sub-panels, none of which any gate had ever opened: the default tab holds no SVG
     at all, so every render gate measured an empty set and reported the page clean while it
     carried ~2,050 sub-floor labels and ~200 overlapping pairs. Expanded from the declared tab
     set rather than re-typed, so the two lists cannot drift. */
  ...TAB_SETS['datahallAI.html'].diagrams.map((entry) => ({
    page: 'datahallAI.html',
    selector: entry.selector,
    label: `DC AI ${entry.label}`,
    tabEntry: entry,
  })),
]);

/* Pages declared as having nothing to activate — recorded so an absence is a decision. */
void NO_TAB_SET;

const VIEWPORTS = Object.freeze([
  { name: 'desktop', width: 1680, height: 1000 },
  { name: 'laptop', width: 1280, height: 860 },
  { name: 'tablet', width: 900, height: 800 },
  { name: 'phone', width: 360, height: 780 },
]);

function safeFilePath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = decoded.endsWith('/') ? `${decoded.slice(1)}index.html` : decoded.slice(1);
  const full = resolve(ROOT, relative);
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null;
  return full;
}

const server = createServer(async (req, res) => {
  const full = safeFilePath(new URL(req.url, 'http://localhost').pathname);
  if (!full) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(full);
    res.writeHead(200, { 'content-type': MIME[extname(full)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((accept) => server.listen(0, '127.0.0.1', accept));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });

const findings = [];
const stats = [];

function record(page, viewport, theme, check, detail) {
  findings.push({ page, viewport, theme, check, detail });
}

try {
  const targets = DIAGRAMS.filter((d) => !ONLY_PAGE || d.page === ONLY_PAGE);

  for (const diagram of targets) {
    for (const theme of ['dark', 'light']) {
      for (const viewport of VIEWPORTS) {
        const tab = await browser.newPage();
        await tab.setViewport({ width: viewport.width, height: viewport.height });
        await tab.evaluateOnNewDocument((t) => {
          try { localStorage.setItem('theme', t); } catch (e) { /* private mode */ }
        }, theme);
        /* Cockpits run continuous animation timers, so `networkidle2` can never settle on some of them.
           Wait for the document, then for the diagram element itself, then a short paint settle. */
        const tabSet = TAB_SETS[diagram.page] || null;
        if (tabSet) await primeCockpitAuditDocument(tab, theme);
        await tab.goto(`${base}/${diagram.page}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await tab.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        if (tabSet) {
          /* A root-gated cockpit renders behind a full-viewport gate and an `inert` wrapper, and
             hides its own tab bar until the engine authority resolves. Measuring it without this
             step measures a hidden page — assertAuthorizedAuditState now refuses that outright. */
          await new Promise((accept) => setTimeout(accept, 1400));
          await enterAuthorizedAuditState(tab, tabSet.cockpit);
          await assertAuthorizedAuditState(tab, tabSet.cockpit);
        }
        await tab.waitForSelector(diagram.selector, { timeout: 20000 }).catch(() => {});
        if (diagram.tabEntry) {
          await activateTab(tab, tabSet, diagram.tabEntry);
        } else {
          await new Promise((accept) => setTimeout(accept, 1200));
        }

        const result = await tab.evaluate(
          ({ selector, overlapTolerance, clipTolerance }) => {
            const svg = document.querySelector(selector);
            if (!svg) return { missing: true };

            const host = svg.closest('svg') || svg;
            const hostBox = host.getBoundingClientRect();
            const visible = (el) => {
              const cs = getComputedStyle(el);
              if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
              let parent = el.parentElement;
              while (parent && parent !== document.body) {
                const pcs = getComputedStyle(parent);
                if (pcs.display === 'none' || pcs.visibility === 'hidden') return false;
                parent = parent.parentElement;
              }
              return true;
            };

            /* A DECLARED TEXT GROUP is one label drawn on several lines — an ISA instrument
               balloon is function letters over loop number, and their boxes touch by design.
               The page declares those with data-rz-text-group; texts inside the SAME group do
               not collide with each other, and everything else still does. This is deliberately
               a declaration and not a wider tolerance: raising the tolerance to swallow a 2 px
               stacked pair would also have swallowed the 30 px overlap this page really had. */
            const groupOf = (el) => {
              const host = el.closest('[data-rz-text-group]');
              return host ? host : null;
            };
            const texts = [...svg.querySelectorAll('text')].filter(visible).map((el, index) => ({
              index,
              text: (el.textContent || '').trim().slice(0, 40),
              group: groupOf(el),
              box: el.getBoundingClientRect(),
            })).filter((t) => t.text.length > 0);

            /* G5 — LEGIBILITY. A label smaller than this on screen is not small text; it is
               texture that looks like data. The chiller P&ID rendered at 0.55 scale with 5-6 px
               equipment labels and passed every collision and clipping check, because none of
               them ask whether a human can READ the thing. Measured on the rendered box, so
               every ancestor transform counts — EPMS pans and zooms a <g>, and a viewBox-only
               calculation understated it by more than 2x. */
            const MIN_LEGIBLE_PX = 8.5;
            const illegible = texts
              .filter((t) => t.box.height > 0 && t.box.height < MIN_LEGIBLE_PX)
              .map((t) => `${t.text} (${Math.round(t.box.height * 10) / 10}px)`);

            /* G4 — a label that paints nothing */
            const degenerate = texts
              .filter((t) => t.box.width < 0.5 || t.box.height < 0.5)
              .map((t) => t.text);

            /* G1 — pairwise overlap between rendered labels */
            const collisions = [];
            for (let i = 0; i < texts.length; i += 1) {
              for (let j = i + 1; j < texts.length; j += 1) {
                if (texts[i].group && texts[i].group === texts[j].group) continue;
                const a = texts[i].box;
                const b = texts[j].box;
                const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
                const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
                if (overlapX > overlapTolerance && overlapY > overlapTolerance) {
                  collisions.push({
                    a: texts[i].text, b: texts[j].text,
                    overlapX: Math.round(overlapX * 10) / 10,
                    overlapY: Math.round(overlapY * 10) / 10,
                  });
                }
              }
            }

            /* G2 — element painted outside its own SVG viewport box.
               SKIPPED on a PAN/ZOOM canvas, which the page declares with data-rz-pannable:
               there, content beyond the frame is not clipped, it is off-screen and reachable
               by panning — that is the whole interaction. The declaration is not a blanket
               exemption: collisions, degenerate labels and LEGIBILITY are still enforced, and
               it is refused unless the page actually ships a zoom control to pan with. */
            const pannable = svg.hasAttribute('data-rz-pannable')
                && !!document.querySelector('[onclick*="setZoom"], [onclick*="fitScreen"]');
            const clipped = [];
            for (const el of (pannable ? [] : svg.querySelectorAll('text, rect, circle, path, line, polygon, image, use'))) {
              if (!visible(el)) continue;
              const box = el.getBoundingClientRect();
              if (box.width === 0 && box.height === 0) continue;
              const outLeft = hostBox.left - box.left;
              const outTop = hostBox.top - box.top;
              const outRight = box.right - hostBox.right;
              const outBottom = box.bottom - hostBox.bottom;
              const worst = Math.max(outLeft, outTop, outRight, outBottom);
              if (worst > clipTolerance) {
                clipped.push({
                  tag: el.tagName,
                  label: (el.textContent || el.getAttribute('id') || '').trim().slice(0, 40),
                  overflowPx: Math.round(worst * 10) / 10,
                });
              }
            }

            return {
              missing: false,
              textCount: texts.length,
              collisions: collisions.slice(0, 40),
              collisionCount: collisions.length,
              clipped: clipped.slice(0, 40),
              clippedCount: clipped.length,
              degenerate,
              pannable,
              illegible: illegible.slice(0, 20),
              illegibleCount: illegible.length,
              docOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
            };
          },
          { selector: diagram.selector, overlapTolerance: OVERLAP_TOLERANCE_PX, clipTolerance: CLIP_TOLERANCE_PX },
        );

        await tab.close();

        if (result.missing) {
          record(diagram.page, viewport.name, theme, 'G0-selector', `no element matches ${diagram.selector}`);
          continue;
        }

        stats.push({
          page: diagram.page, viewport: viewport.name, theme,
          texts: result.textCount, collisions: result.collisionCount,
          clipped: result.clippedCount, overflow: result.docOverflowPx,
        });

        for (const c of result.collisions) {
          record(diagram.page, viewport.name, theme, 'G1-collision',
            `"${c.a}" x "${c.b}" overlap ${c.overlapX}x${c.overlapY}px`);
        }
        for (const c of result.clipped) {
          record(diagram.page, viewport.name, theme, 'G2-clipped',
            `<${c.tag}> ${c.label ? `"${c.label}" ` : ''}outside the SVG box by ${c.overflowPx}px`);
        }
        for (const d of (result.illegible || [])) {
          record(diagram.page, viewport.name, theme, 'G5-illegible',
            `label renders below ${8.5}px: ${d}`);
        }
        for (const d of result.degenerate) {
          record(diagram.page, viewport.name, theme, 'G4-degenerate', `label paints nothing: "${d}"`);
        }
        if (viewport.name === 'phone' && result.docOverflowPx > 2) {
          record(diagram.page, viewport.name, theme, 'G3-overflow',
            `document scrolls horizontally by ${result.docOverflowPx}px at 360px`);
        }
      }
    }
  }

  console.log('\nGEOMETRY SURVEY — diagram / viewport / theme : texts, collisions, clipped, page-overflow');
  for (const s of stats) {
    console.log(`  ${s.page.padEnd(22)} ${s.viewport.padEnd(8)} ${s.theme.padEnd(6)} ` +
      `texts=${String(s.texts).padStart(4)} collisions=${String(s.collisions).padStart(4)} ` +
      `clipped=${String(s.clipped).padStart(4)} overflow=${s.overflow}px`);
  }

  if (findings.length === 0) {
    console.log('\nPASS Conventional geometry: no label collisions, no clipped elements, no degenerate labels, no phone overflow');
  } else {
    const grouped = findings.reduce((acc, f) => {
      acc[f.check] = (acc[f.check] || 0) + 1;
      return acc;
    }, {});
    console.log(`\n${MEASURE_ONLY ? 'MEASURED' : 'FAIL'} — ${findings.length} geometry findings: ${JSON.stringify(grouped)}`);
    for (const f of findings.slice(0, 60)) {
      console.log(`  [${f.check}] ${f.page} ${f.viewport}/${f.theme}: ${f.detail}`);
    }
    if (findings.length > 60) console.log(`  ... and ${findings.length - 60} more`);
  }
} finally {
  await browser.close();
  await new Promise((accept) => server.close(accept));
}

/* v1.135.0 — MONITOR SCOPE. datahallAI.html's thirteen diagrams entered this gate for the first
   time in this release; before it, no render gate had ever opened eight of its ten tabs, so it
   arrives with a real backlog (2,678 findings at entry: 812 collisions, 1,780 sub-floor labels,
   86 clipped). Failing the build on day one would get the whole gate muted, which is how the
   page went unmeasured this long in the first place. Its findings are REPORTED every run and the
   rest of the suite stays strict.
   FLIP TO STRICT: delete this page from MONITOR_PAGES once its rows read zero. Do not widen the
   tolerance to get there — pay the sweep. Everything else in DIAGRAMS gates today. */
const MONITOR_PAGES = new Set(['datahallAI.html']);
const blocking = findings.filter((f) => !MONITOR_PAGES.has(f.page));
const monitored = findings.length - blocking.length;
if (monitored) {
  console.log(`\n  NOTE — ${monitored} finding(s) on ${[...MONITOR_PAGES].join(', ')} are REPORTED, not gating.`);
  console.log('         They entered measurement in v1.135.0; flip to strict when they reach zero.');
}
process.exit(MEASURE_ONLY || blocking.length === 0 ? 0 : 1);
