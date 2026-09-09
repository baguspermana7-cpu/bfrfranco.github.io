import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import puppeteer from 'puppeteer';

const stylesheet = readFileSync(new URL('../css/rz-article-dark.css', import.meta.url), 'utf8');
const runtime = readFileSync(new URL('../js/rz-article-editorial.js', import.meta.url), 'utf8');
const scrollyRuntime = readFileSync(new URL('../js/rz-scrolly.js', import.meta.url), 'utf8');
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  await page.setContent(`<html data-rz-register="editorial" data-theme="light"><head>
    <style>.article-hero{padding:2.5rem 1rem !important}.article-body>p{font-size:14px}.sample-card{background:color(srgb .8 .2 .1 / .12)}
    .instrument-panel{background:rgb(15,23,42)}.instrument-panel .sample-card{color:white}
    .theme-card{background:transparent}[data-theme="dark"] .theme-card{background:rgba(200,100,50,.12)}</style>
    <style>${stylesheet}</style></head><body>
    <header class="article-hero rz-has-rail"><div class="hero-container"><h1>Reading layout</h1></div></header>
    <section class="toc-section"><div class="toc-container"><h2 class="toc-title">Contents</h2>
    <div class="toc-grid"><a href="#cooling">Cooling evidence</a></div></div></section>
    <article class="article-body">
    <h2 id="cooling">Cooling evidence</h2><p>${'Measured cooling performance requires synchronized evidence. '.repeat(90)}</p>
    <div class="sample-card" id="wash"><p>Plain editorial note.</p></div>
    <div class="theme-card" id="theme"><p>Theme-dependent note.</p></div>
    <div class="operator-story"><p id="nested-prose" style="font-size:14px;line-height:1.3">A nested operational case study remains part of the article's reading text.</p></div>
    <div class="chart-wrap"><p id="chart-caption" style="font-size:12px">Chart annotation retains its separate presentation.</p></div>
    <div class="sample-card" id="transitioning" style="transition:background-color .2s">Transitioning note.</div>
    <div class="instrument-panel" id="instrument"><div class="sample-card" id="instrument-child">Live diagram</div></div>
    <div style="background:linear-gradient(135deg,#0f172a,#1e293b)"><div class="sample-card" id="gradient-child">Instrument control</div></div>
    </article>
    <div class="article-content"><div class="container"></div></div>
    <section class="related-articles"><a class="related-card" href="article-9.html"><h4>Article nine</h4></a>
    <a class="related-card" href="article-20.html"><h4>Article twenty</h4></a>
    <a class="related-card" href="article-15.html"><h4>Service catalog</h4></a></section>
    <div class="rz-scrolly" data-rz-scrolly><div class="rz-scrolly-canvas"><span data-cv="mw">0</span></div>
    <div class="rz-scrolly-steps"><div class="rz-scrolly-step">Operational capacity</div><div class="rz-scrolly-step">Committed capacity</div></div>
    <script type="application/json" class="rz-scrolly-cfg">{"counters":[{"mw":10},{"mw":20}]}</script></div>
    </body></html>`);
  await page.addScriptTag({ content: runtime });
  await page.addScriptTag({ content: scrollyRuntime });
  await new Promise(resolve => setTimeout(resolve, 200));
  const initial = await page.evaluate(() => {
    const paragraph = document.querySelector('.article-body > p');
    const style = getComputedStyle(paragraph);
    return {
      size: parseFloat(style.fontSize),
      lineHeight: parseFloat(style.lineHeight) / parseFloat(style.fontSize),
      opacity: style.opacity,
      taggedForEntrance: paragraph.hasAttribute('data-rz-enter'),
      wash: document.getElementById('wash').hasAttribute('data-rz-flat'),
      radius: getComputedStyle(document.getElementById('wash')).borderRadius,
      instrument: document.getElementById('instrument').hasAttribute('data-rz-flat'),
      child: document.getElementById('instrument-child').hasAttribute('data-rz-flat'),
      gradientChild: document.getElementById('gradient-child').hasAttribute('data-rz-flat'),
      headingDecoration: getComputedStyle(document.querySelector('.article-body > h2'), '::before').content,
    };
  });
  assert.ok(initial.size >= 16, 'body prose must not shrink below 16px');
  assert.ok(initial.lineHeight >= 1.5, 'body prose needs readable leading');
  assert.equal(await page.$eval('#nested-prose', element => getComputedStyle(element).fontSize), '16px',
    'nested narrative prose needs the same reading floor as direct body paragraphs');
  assert.equal(await page.$eval('#chart-caption', element => getComputedStyle(element).fontSize), '12px',
    'reading normalization must not resize chart annotations');
  assert.equal(await page.$eval('[data-rz-scrolly]', element => element.getAttribute('data-step')), '1',
    'compact mobile narrative must show the complete diagram, not an offscreen partial state');
  assert.equal(await page.$eval('.rz-scrolly-step', element => getComputedStyle(element).minHeight), '0px',
    'mobile notes must not reserve empty viewport-height scroll scenes');
  assert.equal(initial.opacity, '1', 'long paragraphs must be immediately readable');
  assert.equal(initial.taggedForEntrance, false, 'reading must not depend on entrance observers');
  assert.equal(initial.wash, true, 'modern CSS color spaces must not evade wash detection');
  assert.equal(initial.radius, '4px', 'flattened panels follow the instrument radius');
  assert.equal(initial.instrument, false, 'opaque instrument surfaces stay intact');
  assert.equal(initial.child, false, 'nested instrument washes retain local compositing');
  assert.equal(initial.gradientChild, false, 'opaque gradient instrument surfaces retain local compositing');
  assert.equal(await page.$eval('.rz-rail-card img', element => element.getAttribute('src')), 'assets/article-9-cover_.webp',
    'related rail must use article nine’s existing asset instead of two missing fallback URLs');
  assert.equal(await page.$eval('.rz-rail-card[href="article-15.html"] img', element => element.getAttribute('src')), 'assets/og/index.webp',
    'catalog rail must not resurrect an archived image with obsolete counts');
  assert.ok(['none', 'normal'].includes(initial.headingDecoration), 'no repeated decorative section numbers');
  assert.equal(await page.$eval('.article-hero', element => getComputedStyle(element).paddingLeft), '0px',
    'page-local important padding must not create double hero gutters');
  assert.ok(await page.$eval('.article-hero', element => parseFloat(getComputedStyle(element).paddingTop) >= 96),
    'mobile hero must clear the fixed navigation despite legacy important shorthands');
  assert.equal(await page.$eval('.hero-container', element => getComputedStyle(element).maxWidth), '820px',
    'mobile hero container must reset the rail measure');
  assert.equal(await page.$eval('[data-rz-toc]', element => element.open), false,
    'mobile contents must not consume several screens before the article');
  await page.focus('[data-rz-toc] summary');
  await page.keyboard.press('Enter');
  assert.equal(await page.$eval('[data-rz-toc]', element => element.open), true,
    'contents remain keyboard accessible');
  await page.focus('[data-rz-toc] a');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => location.hash), '#cooling', 'contents must reach a real section anchor');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal(await page.$eval('#theme', element => element.hasAttribute('data-rz-flat')), true,
    'theme changes must reevaluate newly visible washes');
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(await page.$eval('#transitioning', element => element.hasAttribute('data-rz-flat')), true,
    'transitioning backgrounds must remain flattened after a theme change');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal(await page.$eval('#theme', element => element.hasAttribute('data-rz-flat')), false,
    'theme changes must clear stale flattening');
  await page.setViewport({ width: 1440, height: 900 });
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.equal(await page.$eval('[data-rz-scrolly]', element => element.hasAttribute('data-rz-scrolly-static')), false,
    'resizing back to desktop restores the scroll-driven narrative');
  assert.equal(await page.$eval('.hero-container', element => getComputedStyle(element).maxWidth), '1160px',
    'both hero container variants must align with the desktop reading rail');
  process.stdout.write('PASS editorial reading, modern colors, theme changes and instrument preservation\n');
} finally {
  await browser.close();
}
