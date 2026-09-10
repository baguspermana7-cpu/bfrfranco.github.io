import test from 'node:test';
import assert from 'node:assert/strict';
import { collectMeasurements, verifyScrollingGaps } from './site-render-audit-probe.mjs';
import { evaluateMeasurements } from './site-render-audit-core.mjs';
import { auditRow } from './site-render-audit-runner.mjs';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runPool } from './site-render-audit-pool.mjs';

test('real DOM fixture: clipped text, prose, gap, missing image and protected colors', { skip: !process.env.RZ_RENDER_BROWSER_TEST }, async () => {
  const { default: puppeteer } = await import('puppeteer');
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 900 });
    await page.setContent(`<html data-theme="light"><style>
      body { margin: 16px; overflow-x: hidden; } article p { font-size:15px; line-height:1.4; }
      h1 { width: 80px; white-space:nowrap; overflow:hidden; } .gap { height:800px; }
      .scrollable { width:100px; overflow-x:auto; } .wide { width:600px; }
      .skip-link { position:absolute; top:-100px; } #below { margin-top:1400px; }
      .nav-menu { position:fixed; left:-100%; width:100%; box-sizing:border-box; margin:0; padding:0; } .calculator-section p,.author-bio p {font-size:10px;line-height:1}
      .dark-gradient { background:linear-gradient(120deg,rgb(15,23,42),rgb(30,41,59)); }
      .light-gradient { background:linear-gradient(120deg,rgb(240,245,255),rgb(250,250,250)); }
      .nested-card { background:rgba(255,255,255,.1); }
      nav.navbar { position:fixed; top:0; left:0; width:100%; height:80px; z-index:20; }
      .hero-category { position:absolute; top:40px; left:20px; }
      .aurora-mesh .pill { background:rgb(139,92,246); } .pill { background:rgb(139,92,246); }
      details { overflow: hidden; } #expanded { height: 20px; }
      @keyframes tick { from { transform: translateX(0); } to { transform: translateX(-100%); } }
      .ticker-wrapper { width: 200px; overflow: hidden; }
      #ticker-track { display: inline-block; white-space: nowrap; animation: tick 20s linear infinite; }
      #ellipsised { width: 80px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      #clamped { width: 120px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      #lazy-below { display: block; width: 100px; height: 100px; margin-top: 1600px; }
      .offcanvas-drawer { position: fixed; top: 0; left: 100%; width: 260px; }
      #stranded { display: inline-block; margin-left: 600px; white-space: nowrap; }
      #srlive { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; }
      #prewrap { width: 200px; overflow-x: auto; white-space: pre-wrap; font-family: monospace; }
      #naked-wash { background: rgba(232,181,99,0.15); }
      #editorial-wash { background: rgba(232,181,99,0.08); border: 1px solid rgba(180,83,9,0.26); }
      #tinted-chip { background: rgba(16,185,129,0.125); }
      #status-chip { display: inline-block; padding: 2px 8px; border-radius: 4px; background: rgba(8,145,178,0.1); }
      #highlight-wash { background: rgba(253,224,71,0.45); }
      </style><body><div class="evidence-block dark-gradient" id="statistics-band">Decorative statistics</div><nav class="navbar"><div role="toolbar"><h1 id="toolbar-title">Toolbar</h1></div></nav><main><section class="hero"><span class="hero-category" id="overlapped-category">Obscured category</span><p id="hero">This hero lead must not be counted as article body prose.</p></section></main><nav><ul class="nav-menu"><li id="closed">Intentionally closed off canvas navigation</li></ul></nav><a class="skip-link" href="#prose">Skip to content</a>
      <h1 id="clipped">Long heading is clipped</h1><div class="scrollable"><div class="wide" id="scroll-text">Accessible horizontally scrollable text must not be reported as clipped</div></div><div class="gap"></div><article>
      <p id="prose">This is actual body prose with enough words to exercise the editorial checks.</p>
      <p id="chip-host">Readiness for this milestone is <span id="status-chip">In preparation</span> as of the last review.</p>
      <p id="wash-host">The operator then noticed <span id="highlight-wash">the tinted highlighter run</span> across the sentence.</p>
      <div class="calculator-section"><p id="instrument">This instrument help text has enough words but is not editorial body prose.</p></div>
      <div class="author-bio"><p id="author">This author biography has enough words but is not editorial body prose.</p></div>
      <div class="rz-cookie-banner"><p id="cookie-line">We use cookies for analytics to improve your experience and to remember your choices.</p></div>
      <div class="footer-brand"><p class="footer-copyright" id="copyright-line">Copyright 2026 the site owner. All rights reserved, and every trademark stays with its holder.</p></div>
      <div class="legal-disclaimer"><p id="legal-line">Outputs are for educational and planning use only and are not professional engineering advice.</p></div>
      <div class="newsletter-box"><p class="newsletter-desc" id="newsletter-line">Get the next analysis in your inbox, roughly once a month, and nothing else at all.</p></div>
      <div class="water-calculator"><p id="water">This calculator contains a long instrument description and must not be classified as body prose.</p></div>
      <div class="verdict-container"><div class="verdict-box"><p id="computed-verdict">This calculated result describes the selected engineering scenario rather than the article narrative.</p></div></div>
      <div class="reading-note"><p id="editorial-verdict">This editorial verdict remains normal reading prose rather than a calculated instrument result.</p></div>
      <div class="sa-diagram"><p class="sa-caption" id="diagram-caption">This diagram caption explains the plotted instrument without becoming main reading prose.</p></div>
      <div class="chart-wrap"><p id="chart-footnote">This chart footnote explains the plotted series and its underlying measurement basis.</p></div>
      <p class="figure-caption" id="standalone-caption">This standalone figure caption describes the illustration rather than the article narrative.</p>
      <div class="reading-note"><blockquote id="reading-quote">This quoted reading note remains editorial prose and must meet the minimum font size.</blockquote></div>
      <div class="flowchart-discussion"><p id="chart-discussion">This narrative discussion of flowcharts is not itself a chart or diagram instrument.</p></div>
      <div class="fact-card" id="naked-wash">A translucent card wash with no hairline sitting in reading prose</div>
      <div class="fact-card" id="editorial-wash">The sanctioned editorial treatment: the same tint plus a 1px hairline</div>
      <span class="tier-pill" id="tinted-chip">MAJOR</span>
      <div class="dark-gradient"><div class="nested-card" id="dark-instrument">Composited instrument wash</div></div>
      <div class="light-gradient"><div class="nested-card" id="light-wash">Naked decorative wash</div></div>
      <div class="service-row"><span class="revenue-badge rev-high nested-card" id="revenue-status">HIGH</span></div>
      <span class="revenue-badge rev-high nested-card" id="unscoped-badge">Decorative revenue badge</span>
      <img id="broken" src="data:image/png;base64,invalid" width="100" height="100">
      <img id="lazy-below" loading="lazy" src="https://example.invalid/not-fetched-yet.png" width="100" height="100" alt="a lazy image far below the fold">
      <div class="pill" id="banned">Banned pill</div><div class="aurora-mesh"><div class="pill">Protected aurora</div></div>
      <div class="ticker-wrapper"><div id="ticker-track"><span id="ticker-item">Queued marquee headline waiting off screen to scroll in</span></div></div>
      <div id="ellipsised">A long single line truncated by an authored ellipsis affordance</div>
      <div class="offcanvas-drawer"><h2 id="drawer-title">Closed off canvas drawer title</h2></div>
      <div id="stranded">Stranded in flow past the clipped viewport edge</div>
      <p id="srlive" aria-live="polite">Map contains 744 markers announced only to a screen reader</p>
      <div id="prewrap">HFO-1336mzz-Z decomposition
                                                                         (Trifluoroacetic Acid / TFA)</div>
      <div id="clamped">A card excerpt clamped to two lines by webkit line clamp which draws its own ellipsis at the cut.</div>
      <details id="collapsed"><summary>Collapsed summary</summary><p id="collapsed-body">Hidden checklist body inside a closed details element.</p></details>
      <details open id="expanded"><summary>Expanded summary</summary><p id="expanded-body">Visible body inside an open details that really is clipped.</p></details>
      <svg><text fill="#8b5cf6">Semantic color</text></svg><p id="below">This paragraph is below the viewport but it is not vertically clipped by overflow x hidden.</p></article></body></html>`);
    const measurements = await page.evaluate(collectMeasurements);
    const findings = evaluateMeasurements(measurements);
    assert.ok(findings.some(finding => finding.rule === 'text-overflow' && finding.target === '#clipped'));
    assert.ok(findings.some(finding => finding.rule === 'prose-font-size' && finding.target === '#prose'));
    assert.ok(findings.some(finding => finding.rule === 'large-blank-gap'));
    assert.ok(findings.some(finding => finding.rule === 'missing-image' && finding.target === '#broken'),
      'an image the browser finished with and got nothing from is missing');
    /* A `loading="lazy"` image below the fold is not loaded BECAUSE IT IS NOT NEEDED YET. Reporting
       it says the page is broken when the browser is doing exactly what the page asked. All 20
       findings on articles.html were this, and every one resolved after a scroll. */
    assert.ok(!findings.some(finding => finding.rule === 'missing-image' && finding.target === '#lazy-below'),
      'a lazy image below the fold must not be reported as missing');
    assert.equal(findings.filter(finding => finding.rule === 'purple-pill').length, 1);
    assert.ok(measurements.layout.articleStartY > 800);
    assert.equal(measurements.layout.proseBoxes[0].width, 358);
    assert.ok(!findings.some(finding => finding.rule === 'text-overflow' && ['#below', '#scroll-text'].includes(finding.target)));
    /* A CLOSED <details> hides its own body by design — the checklist pages carry five of
       them and every span inside was reported as clipped text. Only an OPEN one that really
       cuts its content is a defect. */
    assert.ok(!findings.some(finding => finding.rule === 'text-overflow' && finding.target === '#collapsed-body'),
      'closed <details> body must not be reported as clipped text');
    assert.ok(findings.some(finding => finding.rule === 'text-overflow' && finding.target === '#expanded-body'),
      'open <details> that clips its body must still be reported');
    /* A marquee queues its next items OUTSIDE the window it scrolls through — that is the
       mechanism, not a defect. The homepage ticker and the site marquee accounted for every
       text-overflow finding on index.html, articles.html and datacenter-solutions.html. */
    assert.ok(!findings.some(finding => finding.rule === 'text-overflow' && finding.target === '#ticker-item'),
      'text queued outside a marquee window must not be reported as clipped');
    /* `text-overflow: ellipsis` IS the authored truncation affordance: the cut is declared and
       the reader can see it happened. A box that clips with no ellipsis (#clipped) still is. */
    assert.ok(!findings.some(finding => finding.rule === 'text-overflow' && finding.target === '#ellipsised'),
      'an ellipsised single line must not be reported as clipped');
    /* `-webkit-line-clamp` is the multi-line form of the same affordance and draws its own
       ellipsis at the cut — the articles-grid card excerpts are clamped to three lines. */
    assert.ok(!findings.some(finding => finding.rule === 'text-overflow' && finding.target === '#clamped'),
      'a line-clamped excerpt must not be reported as clipped');
    /* An OFF-CANVAS panel is parked outside the viewport on purpose and paints nothing until it
       opens (cx-calculator's .cx-drawer sits at translateX(377px) on a 390px screen). Content
       stranded outside the viewport by ordinary FLOW is a different thing and stays a finding. */
    assert.ok(!findings.some(finding => finding.rule === 'text-overflow' && finding.target === '#drawer-title'),
      'a parked off-canvas panel must not be reported as clipped');
    assert.ok(findings.some(finding => finding.rule === 'text-overflow' && finding.target === '#stranded'),
      'in-flow content pushed past the clipped viewport edge must still be reported');
    /* The visually-hidden live-region idiom (1x1 box, clip rect(0,0,0,0)) paints no ink at all —
       pln-java-grid's "Map contains N markers" announcement uses it via inline styles, so a
       class-name exemption could never have caught it. */
    assert.ok(!findings.some(finding => finding.rule === 'text-overflow' && finding.target === '#srlive'),
      'a 1x1 visually-hidden live region must not be reported as clipped');
    /* A box with `overflow-x: auto` either scrolls (the ink is reachable) or its content fits.
       Preserved trailing spaces in a `pre-wrap` block widen the measured RANGE without widening
       scrollWidth, and article-26's chemistry blocks were blamed on <body> because of it. */
    assert.ok(!findings.some(finding => finding.rule === 'text-overflow' && finding.target === '#prewrap'),
      'a fitting overflow-x:auto block must not be reported as clipped');
    /* §A bans TRANSLUCENT CARD WASHES in article bodies. The site's own replacement — a flat tint
       plus a 1px hairline (css/rz-article-dark.css `.quote-callout`) — is the APPROVED pattern,
       and a tinted instrument chip is a different idiom entirely. Only the naked wash is slop. */
    assert.ok(findings.some(finding => finding.rule === 'editorial-translucent-wash' && finding.target === '#naked-wash'),
      'a naked translucent card wash in prose must be reported');
    assert.ok(!findings.some(finding => finding.rule === 'editorial-translucent-wash' && finding.target === '#editorial-wash'),
      'the tint-plus-hairline editorial treatment must not be reported as a wash');
    assert.ok(!findings.some(finding => finding.rule === 'editorial-translucent-wash' && finding.target === '#tinted-chip'),
      'a tinted instrument chip must not be reported as a card wash');
    /* Same distinction one level down: §A bans TINTED HIGHLIGHT SPANS over running prose. A status
       chip is `display: inline-block` with its own padding and radius; a highlighter is plain
       `inline` text with neither, and only the highlighter is the banned tell. */
    assert.ok(!findings.some(finding => finding.rule === 'prose-highlight-wash' && finding.target === '#status-chip'),
      'an inline-block status chip must not be reported as a prose highlight');
    assert.ok(findings.some(finding => finding.rule === 'prose-highlight-wash' && finding.target === '#highlight-wash'),
      'a tinted highlighter run over prose must be reported');
    assert.ok(!measurements.elements.some(element => element.target.includes('skip-link')));
    assert.ok(!measurements.elements.some(element => element.prose && ['#hero', '#instrument', '#author'].includes(element.target)));
    assert.ok(!measurements.elements.some(element => element.target === '#closed'));
    assert.ok(!findings.some(finding => finding.target === '#dark-instrument'));
    assert.ok(findings.some(finding => finding.target === '#light-wash' && finding.rule === 'editorial-translucent-wash'));
    assert.ok(!measurements.elements.some(element => element.target === '#water' && element.prose));
    assert.ok(findings.some(finding => finding.rule === 'fixed-header-hero-overlap' && finding.target === '#overlapped-category'));
    assert.ok(!findings.some(finding => finding.rule === 'fixed-header-hero-overlap' && finding.target === '#toolbar-title'));
    assert.ok(findings.some(finding => finding.rule === 'top-level-statistics-gradient' && finding.target === '#statistics-band'));
    assert.equal(measurements.elements.find(element => element.target === '#statistics-band').context.role, 'statistics');
    for (const selector of ['#diagram-caption', '#chart-footnote', '#standalone-caption']) {
      assert.ok(!findings.some(finding => finding.rule.startsWith('prose-') && finding.target === selector));
      assert.ok(measurements.roleExclusions.some(element => element.target === selector));
    }
    assert.equal(measurements.roleExclusions.find(element => element.target === '#diagram-caption').context.role, 'caption');
    assert.equal(measurements.roleExclusions.find(element => element.target === '#chart-footnote').context.role, 'instrument');
    assert.ok(findings.some(finding => finding.rule === 'prose-font-size' && finding.target === '#chart-discussion'));
    /* Site chrome is not reading prose. A cookie-consent sentence and a copyright line appear on
       EVERY page at their own size on purpose; counting them made every page in the site report a
       prose-font-size finding it could never legitimately fix. */
    for (const selector of ['#cookie-line', '#copyright-line', '#legal-line', '#newsletter-line']) {
      assert.ok(!findings.some(finding => finding.rule.startsWith('prose-') && finding.target === selector),
        `${selector} is site chrome, not body prose`);
    }
    assert.ok(measurements.elements.some(element => element.target === '#reading-quote' && element.prose));
    assert.ok(!findings.some(finding => finding.rule === 'editorial-translucent-wash' && finding.target === '#revenue-status'));
    assert.ok(findings.some(finding => finding.rule === 'editorial-translucent-wash' && finding.target === '#unscoped-badge'));
    assert.ok(!findings.some(finding => finding.rule.startsWith('prose-') && finding.target === '#computed-verdict'));
    assert.ok(findings.some(finding => finding.rule === 'prose-font-size' && finding.target === '#editorial-verdict'));
  } finally { await browser.close(); }
});

test('scrolly gap requires visible ink and the correct activated step, not only a sticky container', { skip: !process.env.RZ_RENDER_BROWSER_TEST }, async () => {
  const { default: puppeteer } = await import('puppeteer');
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 900 });
    await page.setContent('<style>body{margin:0}.rz-scrolly{display:flex;height:3000px}.rz-scrolly-canvas{position:sticky;top:100px;height:120px;width:150px}.rz-scrolly-step{height:900px}</style><div class="rz-scrolly" data-rz-scrolly data-step="0"><div class="rz-scrolly-canvas"><svg width="140" height="100"><text y="30">Visible diagram</text></svg></div><div><div class="rz-scrolly-step active">First step</div><div class="rz-scrolly-step">Second step</div><div class="rz-scrolly-step">Third step</div></div></div>');
    const gaps = [{ top: 1900, bottom: 2400, height: 500 }];
    assert.equal((await page.evaluate(verifyScrollingGaps, gaps))[0].verified, false);
    await page.evaluate(() => addEventListener('scroll', () => {
      const steps = [...document.querySelectorAll('.rz-scrolly-step')];
      const active = steps.findIndex(step => { const box = step.getBoundingClientRect(); return box.top <= innerHeight / 2 && box.bottom > innerHeight / 2; });
      document.querySelector('[data-rz-scrolly]').dataset.step = String(active);
      steps.forEach((step, index) => step.classList.toggle('active', index === active));
    }));
    assert.equal((await page.evaluate(verifyScrollingGaps, gaps))[0].verified, true);
    await page.addStyleTag({ content: '.rz-scrolly-canvas svg{visibility:hidden}' });
    assert.equal((await page.evaluate(verifyScrollingGaps, gaps))[0].verified, false);
    assert.equal(await page.evaluate(() => scrollY), 0);
  } finally { await browser.close(); }
});

test('real runner fixture refuses POST and starts with declined consent, without auth spoofing', { skip: !process.env.RZ_RENDER_BROWSER_TEST }, async () => {
  let writes = 0;
  const server = http.createServer((request, response) => {
    if (request.method === 'POST') writes += 1;
    response.setHeader('Content-Type', 'text/html');
    response.end('<html data-theme="light"><body><p>Read only fixture.</p><script>document.documentElement.dataset.theme=localStorage.getItem("theme");document.title=localStorage.getItem("rz_cookie_consent");fetch("/write",{method:"POST"}).catch(()=>{});</script></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'rz-render-fixture-'));
  const { default: puppeteer } = await import('puppeteer');
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const results = [];
    await runPool(['light', 'dark'], 2, async theme => {
      const result = await auditRow(browser, { path: 'index.html', theme, width: 390, labels: ['public'] },
        { base: `http://127.0.0.1:${server.address().port}/`, timeout: 5000, out, id: `safety-${theme}` });
      results.push(result);
    });
    assert.equal(writes, 0);
    for (const result of results) {
      assert.equal(result.measurements.title, 'declined');
      assert.equal(result.measurements.actualTheme, result.theme);
      assert.equal(result.status, 'UNVERIFIED');
      assert.ok(result.network.some(entry => entry.policy === 'blocked-write'));
    }
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
    await fs.rm(out, { recursive: true, force: true });
  }
});
