#!/usr/bin/env node
/**
 * test-article-diagrams-engine — every block diagram in every article is drawn by the RZ diagram engine.
 *
 * WHY THIS EXISTS
 *
 * Owner, 2026-10-12: "block diagram2 di semua article literally semua article itu pastikan sudah diganti
 * dengan block diagram as per standardnya". tools/build-article-diagrams.mjs --check proves the figures it
 * OWNS are current; it cannot see a diagram it does not own. Before v3.20.0 seven articles still drew
 * theirs by hand — rows of <span class="flow-box"> joined by "→", fixed-coordinate SVG, hand-drawn living
 * diagrams — and every gate was green. This gate enumerates the articles from the filesystem and looks
 * for the diagram, not for the figure.
 *
 *   R1 no flow-box / architecture-diagram / flow-diagram markup (the hand-built row of boxes)
 *   R2 every static <svg> with 4+ text labels sits inside an engine figure (<figure data-rz-figure>),
 *      unless it is EXEMPT below with the reason written down
 *   R3 every living diagram ([data-rz-diagram]) is an engine figure
 *   R4 every engine figure placeholder is filled (an empty <figure data-rz-figure> means the build was
 *      never run, or its definition was deleted)
 *   R5 every living diagram's config names its source and basisTag. ARTICLE_DATAVIZ_STANDARD.md said
 *      tools/audit-article-charts.mjs checked this; it reads [data-rz-chart] only and never did.
 *
 * Scripts are blanked first: an <svg> string inside JS is a chart a calculator draws at runtime (a
 * tornado, a histogram), not a block diagram.
 *
 * Proven RED on v3.19.0 (1fb07bca): R1 x2 (article-6, -13), R2 x5 (article-9, -13, -23, -25, -28),
 * R3 x3 (article-9, -13, -25).
 *
 * Run: node tools/test-article-diagrams-engine.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';

/* An SVG that is a chart, not a block diagram. Each entry names WHAT it is; "it is hard to convert" is
   not a reason. */
const EXEMPT = {
  'article-16.html': 'scrollytelling BAR CHART of the Johor pipeline by stage (bar length is MW); a chart has no blocks or connectors',
};

const PAGES = readdirSync('.').filter((f) => /^(article-\d+(-paper)?|geopolitics-\d+|FF-\d+)\.html$/.test(f)).sort();
const fails = [];
let figures = 0;

for (const page of PAGES) {
  const raw = readFileSync(page, 'utf8');
  const s = raw.replace(/<script\b(?![^>]*application\/json)[^>]*>[\s\S]*?<\/script>/gi, '');

  for (const m of s.matchAll(/class="[^"]*\b(flow-box|architecture-diagram|flow-diagram)\b[^"]*"/g)) {
    fails.push(`R1 ${page}: hand-built diagram markup .${m[1]}`);
    break;
  }

  /* engine figures and their spans */
  const spans = [];
  for (const m of s.matchAll(/<figure\b[^>]*data-rz-figure="([^"]+)"[^>]*>([\s\S]*?)<\/figure>/g)) {
    spans.push([m.index, m.index + m[0].length]);
    figures++;
    if (!/<svg\b/.test(m[2])) fails.push(`R4 ${page}: figure "${m[1]}" is an empty placeholder — run tools/build-article-diagrams.mjs`);
    const cfg = /<script type="application\/json" class="rz-diagram-cfg">([\s\S]*?)<\/script>/.exec(m[2]);
    if (/data-rz-diagram/.test(m[0].slice(0, m[0].indexOf('>')))) {
      let c = null;
      try { c = cfg && JSON.parse(cfg[1]); } catch (e) { /* reported below */ }
      if (!c) fails.push(`R5 ${page}: living figure "${m[1]}" has no parseable config`);
      else if (!c.source || !c.basisTag) fails.push(`R5 ${page}: living figure "${m[1]}" config lacks source or basisTag`);
    }
  }
  const inFigure = (i) => spans.some(([a, b]) => i >= a && i < b);

  for (const m of s.matchAll(/<svg\b[\s\S]*?<\/svg>/g)) {
    const texts = (m[0].match(/<text\b/g) || []).length;
    if (texts < 4 || inFigure(m.index)) continue;
    if (EXEMPT[page]) continue;
    const label = (m[0].match(/aria-label="([^"]{0,60})/) || [, ''])[1];
    fails.push(`R2 ${page}: hand-drawn SVG with ${texts} labels${label ? ` ("${label}…")` : ''} outside an engine figure`);
  }

  for (const m of s.matchAll(/<(\w+)\b[^>]*\bdata-rz-diagram\b[^>]*>/g)) {
    if (!/data-rz-figure=/.test(m[0])) fails.push(`R3 ${page}: living diagram not drawn by the engine`);
  }
}

if (fails.length) {
  for (const f of fails) console.log('  FAIL  ' + f);
  console.log(`[article-diagrams-engine] ${fails.length} finding(s) across ${PAGES.length} article pages`);
  process.exit(1);
}
console.log(`[article-diagrams-engine] PASS — ${PAGES.length} article pages, ${figures} engine figures, ` +
  `no hand-drawn block diagram (${Object.keys(EXEMPT).length} chart exempt by name)`);
