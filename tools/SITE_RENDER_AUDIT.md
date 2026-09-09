# Comprehensive tracked-HTML render audit

Owner scope: these tools only. Request: literally all pages; inspect container width,
padding/alignment, white space and article start Y, not just document scroll width.
Shared CSS, source article prose, static SEO, release/version/tracker integration and
protected datahallAI/network files remain parent/other-agent owned. No commits.

## Commands

Use `/home/baguspermana7/.nvm/versions/node/v24.13.1/bin/node` for `node` below.
An existing HTTP static server must serve the repository root. Current run uses
`http://127.0.0.1:8093/`. Browser concurrency is always one; coordinate with parent.

```sh
node --test tools/test-site-render-audit.mjs
RZ_RENDER_BROWSER_TEST=1 node --test tools/test-site-render-browser.mjs
node tools/audit-site-render.mjs --inventory
node tools/audit-site-render.mjs --baseline --base http://127.0.0.1:8093/ --concurrency=1
node tools/audit-site-render.mjs --include '^(article-(1|26)|FF-1)\.html$' --widths 390 --themes light --base http://127.0.0.1:8093/
node tools/audit-site-render.mjs --public-only --widths 390,1440 --themes light,dark --concurrency=1 --timeout 15000 --base http://127.0.0.1:8093/ --out /tmp/rz-site-audit/current
node tools/report-site-render.mjs /tmp/rz-site-audit/current
node tools/report-site-render.mjs /tmp/rz-site-audit/current --watch
node tools/audit-site-render.mjs --resume --public-only --widths 390,1440 --themes light,dark --concurrency=1 --base http://127.0.0.1:8093/ --out /tmp/rz-site-audit/current
node tools/audit-site-render.mjs --functional-noindex --widths 390,1440 --themes light,dark --concurrency=1 --base http://127.0.0.1:8093/ --out /tmp/rz-site-audit/functional-noindex
node tools/report-site-render.mjs /tmp/rz-site-audit/combined --merge /tmp/rz-site-audit/current /tmp/rz-site-audit/functional-noindex
```

Remove `--public-only` to attempt every deployable tracked HTML, including internal
and noindex files. Source build entries remain explicitly unreviewed because a static
server cannot render their JSX/TSX source; deployed dist entries are independent rows.
Default matrix is 390/768/1440 × light/dark. `--axe` opts into
vendored axe contrast checks; otherwise contrast is explicitly NOT_REQUESTED.
Use a fresh output directory for reruns; existing artifacts are never overwritten.

## Evidence and semantics

- `git ls-files -z` is the inventory authority, including root article-N, FF-N,
  geopolitics, `/id`, `/manual`, `/prd`, arbitrary nested paths and subapps. Source
  read errors stay in inventory. Classification is heuristic, not robots authority.
- `coverage.json` is atomically updated after every combination. All tracked HTML
  have a row for every requested dimension. Filters/noindex/internal exclusions are
  FILTERED with an explicit reason, never PASS. Abrupt termination leaves PENDING.
  `--resume` requires the same matrix, preserves numbered evidence and per-row history,
  and rechecks environment failures or rows measured by a superseded probe revision.
  Combine it with `--inventory` to prepare/reclassify a resumed manifest without a browser.
  Server HEAD preflight runs before launch and each state. Server loss stops with
  untouched remaining PENDING rows; connection failures are environment UNVERIFIED.
  A disconnected browser gets at most one controlled fresh-browser retry, then stops.
- `NNNNN.json` stores runtime errors, navigation results, complete findings,
  measured prose/container geometry, blank vertical bands, article start Y, contrast
  coverage, and screenshot paths. Defective/unverified combinations receive full-page
  viewport screenshots plus a first-defect viewport when possible; capture failures fail closed.
  Layout includes actual scrollX and the five furthest overflowing element boxes with
  ancestor overflow axes. Card metadata is measured but not treated as the body reading
  column. Role context records ancestor class/ID/backgrounds and instrument exclusions;
  opaque dark gradient ancestors protect composited instrument washes, not light gradients.
  Numeric thresholds use epsilon 1e-6 for computed-style division roundoff.
- `report-site-render.mjs` can run during the sweep without a browser. It writes
  `failures.json`, a complete `report.html` with artifact links, and `junit.xml`.
  `--watch` refreshes every 30 seconds until the sweep finishes; use one reporter per directory.
  `--merge` combines matrix keys without dropping inventory; selected later focused
  states supersede earlier ones, while FILTERED follow-up rows never erase measured
  primary states. Artifact links point back to preserved source directories.
  In JUnit, UNVERIFIED/PENDING/FILTERED are skipped, not passed; check coverage as
  well as the XML. CI should retain the complete directory regardless of exit code.
- Navigation failures, local HTTP errors, product script/console errors and timeouts
  are defects. External network failures are separately UNVERIFIED, not product
  runtime regressions. Visible auth/restriction/modal gates are UNVERIFIED, with defects retained.
  No authentication injection, gate hiding or healthy fallback is used.
- Prose needs a recognized editorial container and actual paragraph/list prose;
  font ≥16px and computed lineheight/font-size ≥1.5. `normal` is unmeasured and
  UNVERIFIED. Instrument/table labels are not body prose. Missing expected editorial
  prose, unconfirmed theme, empty bodies and visible iframe content are UNVERIFIED.
- Text Range geometry catches clipped headings/text even with `overflow:hidden`.
  Axes are independent: horizontal body clipping never flags text merely below the
  viewport. Reachable scroll-container content and unfocused accessibility skip links
  are not clipping defects. These cases have real-browser regression fixtures.
  Container metrics include width, left edge, padding, margins and text alignment.
  Blank-gap/narrow-column findings require visual review: purposeful diagrams or
  canvas whitespace can be legitimate. Findings are not automatic CSS prescriptions.
- No colors/styles/content are modified. SVG, canvas, code, named aurora and semantic
  instrument surfaces are exempt from decorative/prose rules; geometry stays separate.
  Decorative detection covers purple pills, dot grids, gradient callouts, glass and
  editorial translucent/highlight washes. Existing static anti-vibecode audit owns
  the broader stylesheet rule set; this tool does not claim to detect every aesthetic.
- One browser, isolated context per combination, declined cookie consent set before
  page scripts, service-worker bypass, analytics blocking and interception that refuses
  all non-GET/HEAD/OPTIONS requests. No forms, login, billing or order actions are used.
  Operation timeout defaults to 15s; inspection deadline is at most 20s, with bounded
  5s screenshot attempts afterward. Articles run before public roots, nested docs and
  slower subapps. Bounded scroll triggers lazy images and waits for font readiness.
  This initial render sweep does not exercise all tabs, modals,
  authenticated routes or hover states. Live edits during a long sweep mean different
  pages can reflect different source revisions: rerun affected pages after edits.

## Validation and handoff

TDD first failed on the missing core module. The corrected implementation passes 19
unit/contract fixtures and two real Puppeteer fixtures. Browser tests are opt-in to avoid contention.
No retries/quarantine conceal failures. Full-site findings are separate from tool-test
results. Parent owns any shared-standard, changelog, tracker or release integration.

Noindex is not a visual exemption. A public-only run MUST be followed by the functional
noindex run for comprehensive functional-site coverage. Admin/setup noindex pages are
included read-only; source build entries and archival mockups remain explicitly unreviewed.

The first sweep at `/tmp/rz-site-audit/` was intentionally stopped; `SUPERSEDED.md`
records its clipping/build-entry false positives. Preserve it, but use only corrected
results under `/tmp/rz-site-audit/current/` for current triage.
