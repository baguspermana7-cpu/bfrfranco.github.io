#!/usr/bin/env node
/* ============================================================================
 * build-article-diagrams.mjs — explanatory figures for the article corpus
 * ----------------------------------------------------------------------------
 * WHY A BUILD STEP AND NOT A RUNTIME
 *
 * These figures are article content, not interface. Rendering them at build
 * time means they survive everything the site does to an article: the PDF
 * export, the Markdown extraction into llms-full.txt, a reader with JavaScript
 * off, and the first paint. A runtime renderer would lose all four and buy
 * nothing, because the content does not change after publication.
 *
 * HOW A FIGURE GETS INTO AN ARTICLE
 *
 * The author places an empty placeholder where the figure belongs:
 *
 *     <figure class="rz-figure" data-rz-figure="pfas-loss-zones"></figure>
 *
 * and this tool fills it. It never inserts a placeholder itself — where a
 * figure belongs in an argument is an editorial decision, and a tool that
 * guesses would put diagrams where the prose did not ask for one.
 *
 * Re-running replaces the contents of every placeholder it owns, so the figure
 * is regenerated from its definition rather than hand-maintained in markup.
 *
 * WHAT MAKES A FIGURE WORTH BUILDING
 *
 * The rule from the diagram-design skill, which decides every entry below:
 * *would the reader learn more from this than from a well-written paragraph?*
 * If the article already answers the question in a table or a sentence, a
 * diagram that restates it is noise. Each definition here carries a `because`
 * naming what the figure adds that the prose does not.
 *
 *   node tools/build-article-diagrams.mjs            # write
 *   node tools/build-article-diagrams.mjs --check    # verify, exit 1 on drift
 * ==========================================================================*/
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const CHECK = process.argv.includes('--check');

/* ---- engine, in a sandbox with no DOM ----------------------------------- */
const sandbox = { module: { exports: {} }, console };
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const rel of ['js/rz-diagram-metrics.js', 'js/rz-diagram-layout.js', 'js/rz-diagram.js']) {
  vm.runInContext(readFileSync(join(root, rel), 'utf8'), sandbox, { filename: rel });
}
const { RZDiagram: D, RZDiagramMetrics: M, RZDiagramLayout: L } = sandbox;

/* ==========================================================================
 * FIGURES
 * ======================================================================== */
const FIGURES = [
  {
    id: 'heat-path-ceilings',
    page: 'article-18.html',
    caption:
      'The same heat, two paths. Air carries it through the room, so the room becomes the ' +
      'bottleneck and the path tops out near 30 kW per rack. A cold plate carries it in liquid ' +
      'from the die, and the room stops being in the way. GB300 NVL72 at 132-140 kW per rack sits ' +
      'above the air ceiling by a factor of four — which is why the transition is not a preference.',
    because:
      'the article tabulates rack density by platform, and separately tabulates cooling technology ' +
      'by ceiling. Neither table connects them, and the connection is the section\'s argument: the ' +
      'density trajectory crossed the air ceiling, so the heat path had to change SHAPE. A table ' +
      'cannot show a change of shape.',
    build() {
      const ctx = D.create({
        slug: 'heat-path',
        title: 'Two heat paths, and where each one runs out',
        desc: 'In an air-cooled rack, heat leaves the die through a heatsink into room air, is ' +
              'collected by a CRAH and passed to chilled water. That path is limited by what room ' +
              'air can carry, roughly 30 kW per rack. In a liquid-cooled rack, heat leaves the die ' +
              'into a cold plate and passes through a CDU directly to facility water; the room is ' +
              'no longer in the path, and direct-to-chip reaches roughly 200 kW per rack. Both ' +
              'paths end at the same heat rejection plant.'
      });

      const COL_A = 40, COL_B = 470, W = 330;
      const Y0 = 78, PITCH = 104;

      function chain(x, rows, strokeFor) {
        const out = [];
        rows.forEach((r, i) => {
          out.push(ctx.node(x, Y0 + i * PITCH, {
            id: r.id, tag: r.tag, name: r.name, sublabel: r.sub, w: W,
            stroke: strokeFor(i), fill: 'paper', tier: 2,
            legend: r.legend
          }));
        });
        return out;
      }

      const air = chain(COL_A, [
        { id: 'a-die', tag: 'source', name: 'GPU die', sub: 'heat flux to 1,000 W/cm\u00B2' },
        { id: 'a-room', tag: 'air', name: 'Heatsink \u2192 room air', sub: 'the room is in the path' },
        { id: 'a-crah', tag: 'crah', name: 'CRAH \u2192 chilled water', sub: 'PUE 1.4\u20131.8' }
      ], () => 'rule-solid');

      const liq = chain(COL_B, [
        { id: 'l-die', tag: 'source', name: 'GPU die', sub: 'same heat, same flux' },
        { id: 'l-plate', tag: 'liquid', name: 'Cold plate', sub: 'liquid at the die' },
        { id: 'l-cdu', tag: 'cdu', name: 'CDU \u2192 facility water', sub: 'PUE 1.10\u20131.35' }
      ], (i) => (i === 1 ? 'accent' : 'rule-solid'));

      [[air, 'Air path'], [liq, 'Liquid path']].forEach(function (pair) {
        const col = pair[0];
        for (let i = 0; i < col.length - 1; i++) {
          ctx.edge({ x: col[i].x + col[i].w / 2, y: col[i].y + col[i].h },
                   { x: col[i + 1].x + col[i + 1].w / 2, y: col[i + 1].y }, {
            fromId: col[i].id, toId: col[i + 1].id, stroke: 'muted', tier: 2, pattern: 'solid'
          });
        }
      });

      /* Both paths end in the same plant. Drawing it once, below and between,
       * is what makes them two routes to one place rather than two systems. */
      const last = air[air.length - 1];
      const reject = ctx.node(COL_A + (COL_B + W - COL_A) / 2 - W / 2,
                              last.y + last.h + 96, {
        id: 'reject', tag: 'shared', name: 'Heat rejection', sublabel: 'the same plant, either way',
        w: W, stroke: 'rule-solid', fill: 'paper-2', tier: 2
      });
      [air[2], liq[2]].forEach(function (n, i) {
        ctx.edge({ x: n.x + n.w / 2, y: n.y + n.h },
                 { x: reject.x + reject.w * (i ? 0.72 : 0.28), y: reject.y }, {
          fromId: n.id, toId: 'reject', stroke: 'muted', tier: 2, pattern: 'solid'
        });
      });

      /* The ceilings. These are the point, so they are containers rather than
       * captions: Common Region ties the number to the whole path it limits. */
      ctx.zone(COL_A - 18, Y0 - 44, W + 36, (air[2].y + air[2].h + 20) - (Y0 - 44), {
        label: 'air path \u2014 ceiling about 30 kW per rack', tier: 3, dashed: true
      });
      ctx.zone(COL_B - 18, Y0 - 44, W + 36, (liq[2].y + liq[2].h + 20) - (Y0 - 44), {
        label: 'direct-to-chip \u2014 about 200 kW per rack', tier: 3, dashed: true,
        stroke: 'accent'
      });

      ctx.legend();
      return ctx.fit(28);
    }
  },
  {
    id: 'pfas-loss-zones',
    page: 'article-26.html',
    caption:
      'Where the charge actually goes. Only the drain path crosses a meter, and even there only ' +
      'the recovery percentage is logged; every other route leaves the system unmeasured. The one ' +
      'field measurement that exists, 17.1 %/yr, is an order of magnitude above the sealed-system ' +
      'vendor figure.',
    because:
      'the article already tabulates the seven loss zones with magnitudes and sources. What the ' +
      'table cannot show is that the escape routes BYPASS the meter — that is a spatial fact, and ' +
      'it is the point of the section.',
    build() {
      const ctx = D.create({
        slug: 'pfas-loss',
        title: 'Immersion fluid loss zones, and which ones cross a meter',
        desc: 'A tank charge of two-phase immersion fluid leaves the system by five routes. Only ' +
              'the drain and transfer path is partially metered, through its recovery percentage. ' +
              'Maintenance vapour, quick-disconnect spillage, operating evaporative loss and three ' +
              'further zones carrying no published number at all are unmetered, and none of the ' +
              'five is reportable as an emission.'
      });

      /* Layout: the charge is a TALL node on the left, sized so its five ports
       * land opposite the five destinations. Every run is then a straight
       * horizontal line — no elbows, no detours, no crossings. The first cut
       * used a short node and let the router find its way, which produced five
       * doglegs bunched 9 units apart. Rule 4's spacing is not a detail; it is
       * what decides whether the drawing has a shape. */
      const ROWS = [
        { id: 'drain',  tag: 'partial',  name: 'Drain / transfer residual',
          sub: '4-6 % retained · recovery logged', metered: true },
        { id: 'vapour', tag: 'no meter', name: 'Maintenance vapour',
          sub: '3-12 L per service' },
        { id: 'qd',     tag: 'no meter', name: 'Quick-disconnect spillage',
          sub: '2-3 mL per connect' },
        { id: 'evap',   tag: 'no meter', name: 'Operating evaporative loss',
          sub: '17.1 %/yr measured · 1-2 %/yr claimed' },
        { id: 'none',   tag: 'no number', name: 'Three further zones',
          sub: 'seal permeation · fill/flush · end-of-life' }
      ];

      const TOP = 56;
      const PITCH = 92;   /* a 72-unit node plus breathing room */
      const COL_R = 380;
      const chargeH = M.grid4(PITCH * ROWS.length);

      const charge = ctx.node(40, TOP, {
        id: 'charge', tag: 'charge', tier: 1, h: chargeH, w: 232,
        name: 'TANK CHARGE',
        sublabel: 'two-phase / immersion fluid',
        stroke: 'accent', fill: 'paper-2', legend: 'The fluid being tracked'
      });

      const ports = ctx.ports(charge, ROWS.length, 'right', { id: 'charge' });
      /* Extra air between the one metered route and the four that are not, so
       * the container below it reads as a separate region rather than as a box
       * that happens to start where the row above ended. */
      const SPLIT = 26;
      const portY = (i) => ports[i].y + (i === 0 ? 0 : SPLIT);

      const boxes = [];
      ROWS.forEach((row, i) => {
        const y = portY(i);
        const node = ctx.node(COL_R, y - 36, {
          id: row.id, tag: row.tag, w: 394,
          name: row.name, sublabel: row.sub,
          stroke: row.metered ? 'rule-solid' : 'soft',
          fill: 'paper', tier: row.metered ? 2 : 3, dashed: !row.metered,
          legend: row.metered ? 'Partially metered' : (i === 1 ? 'Unmetered' : undefined)
        });
        ctx.edge({ x: ports[i].x, y: ports[i].y }, { x: node.x, y: y }, {
          fromId: 'charge', toId: row.id,
          stroke: row.metered ? 'ink' : 'muted',
          /* tier 2 even for the unmetered routes: at tier 3 a dotted soft line
             is legible on a cockpit sheet but disappears in an article, where
             the figure is scaled to a reading column rather than a console. */
          tier: 2,
          pattern: row.metered ? 'solid' : 'dotted',
          label: row.metered ? 'metered' : undefined,
          legend: row.metered ? 'Crosses a meter' : (i === 1 ? 'No meter, no reporting line' : undefined)
        });
        boxes.push({ box: node, metered: !!row.metered });
      });

      /* The unmetered routes share a container. Common Region is what makes
       * "outside any meter" one fact rather than four repeated labels, and four
       * of the five routes sitting inside it IS the finding.
       *
       * Its bounds come from the nodes it contains, not from the port spacing:
       * computing it from ports put its top border and its own eyebrow through
       * the metered node above. Paint order does not follow call order — zones
       * are emitted first whenever they are declared — so it can be measured
       * from the drawing it encloses. */
      const inside = boxes.filter(b => !b.metered).map(b => b.box);
      const zx = Math.min(...inside.map(b => b.x)) - 18;
      const zy = Math.min(...inside.map(b => b.y)) - 34;
      const zr = Math.max(...inside.map(b => b.x + b.w)) + 18;
      const zb = Math.max(...inside.map(b => b.y + b.h)) + 18;
      ctx.zone(zx, zy, zr - zx, zb - zy, {
        label: 'outside any meter \u2014 and none of it reportable',
        tier: 3, dashed: true
      });

      ctx.legend();
      return ctx.fit(28);
    }
  }
];

/* ==========================================================================
 * build
 * ======================================================================== */
/* ---- the token contract, bridged to the article palette ------------------
 * The engine emits no literal hex: every colour resolves to a custom property.
 * An article does not define those properties — it has its own --rz-art-* set —
 * so a figure dropped into one renders as a black rectangle. That is exactly
 * the failure the engine's own T1-T3 gate was written for, and the gate missed
 * it: T3 only inspects pages that load js/rz-diagram.js with a <script>, and a
 * build-time figure loads nothing.
 *
 * The bridge is emitted WITH the figure and scoped to it, so it satisfies the
 * contract without leaking engine names into the article's own palette, and the
 * figure follows the article's theme rather than carrying a second one. Every
 * value is a var() onto the article set — still no hex.
 */
const TOKEN_BRIDGE = [
  '--bg1:var(--rz-art-bg)',
  '--bg3:var(--rz-art-panel)',
  '--t1:var(--rz-art-strong)',
  '--t2:var(--rz-art-text)',
  '--t3:var(--rz-art-muted)',
  '--bd:var(--rz-art-line)',
  '--bd2:var(--rz-art-muted)',
  '--o:var(--rz-art-accent)',
  '--c:var(--rz-art-accent2)',
  '--g:var(--rz-art-accent2)',
  '--r:var(--rz-art-accent)'
].join(';');

function figureMarkup(fig, ctx) {
  const svg = ctx.render().replace(
    '<svg ', '<svg style="' + TOKEN_BRIDGE + '" ');
  return '\n' + svg +
    '\n<figcaption class="rz-figcaption">' + fig.caption + '</figcaption>\n';
}

const findings = [];
const written = [];
const byPage = new Map();
for (const fig of FIGURES) {
  if (!byPage.has(fig.page)) byPage.set(fig.page, []);
  byPage.get(fig.page).push(fig);
}

for (const [page, figs] of byPage) {
  const path = join(root, page);
  let html = readFileSync(path, 'utf8');
  const before = html;

  for (const fig of figs) {
    const ctx = fig.build();
    if (ctx.warnings.length) {
      for (const w of ctx.warnings) {
        findings.push(`${page} · ${fig.id}: ${w.kind} — ${w.message}`);
      }
    }
    /* Audit the figure's own geometry before writing it. The engine warns about
     * what it was ASKED to do wrong; this catches what the composition did
     * wrong — two boxes the author placed on top of each other. Without it this
     * tool would happily write a figure whose zone eyebrow sits across the node
     * above it, which is precisely what the first draft did. */
    const geom = ctx.occupancy.items.filter(
      (i) => i.meta.kind === 'text' || i.meta.kind === 'node');
    for (let a = 0; a < geom.length; a++) {
      for (let b = a + 1; b < geom.length; b++) {
        const A = geom[a], B = geom[b];
        if (M.contains(A.box, B.box) || M.contains(B.box, A.box)) continue;
        const ov = M.overlap(A.box, B.box);
        if (ov && ov.ox > 0.5 && ov.oy > 0.5) {
          findings.push(
            `${page} · ${fig.id}: ${A.meta.kind}:${A.meta.id} overlaps ` +
            `${B.meta.kind}:${B.meta.id} by ${ov.ox.toFixed(1)}x${ov.oy.toFixed(1)} ` +
            `(shorter axis: ${ov.axis})`);
        }
      }
    }
    const open = new RegExp(
      '<figure\\b[^>]*data-rz-figure="' + fig.id + '"[^>]*>', 'i');
    const m = open.exec(html);
    if (!m) {
      findings.push(
        `${page} has no placeholder for "${fig.id}". Add ` +
        `<figure class="rz-figure" data-rz-figure="${fig.id}"></figure> where the figure belongs — ` +
        `this tool never decides that for you.`);
      continue;
    }
    const start = m.index + m[0].length;
    const end = html.indexOf('</figure>', start);
    if (end < 0) { findings.push(`${page} · ${fig.id}: placeholder is not closed`); continue; }
    html = html.slice(0, start) + figureMarkup(fig, ctx) + html.slice(end);
  }

  if (html !== before) {
    if (CHECK) findings.push(`${page} is out of date — run without --check to rebuild`);
    else { writeFileSync(path, html); written.push(page); }
  }
}

console.log(`ARTICLE DIAGRAMS — ${FIGURES.length} figure(s) across ${byPage.size} page(s)`);
for (const fig of FIGURES) console.log(`  ${fig.page.padEnd(18)} ${fig.id}`);
if (written.length) console.log(`  rebuilt: ${written.join(', ')}`);

if (findings.length) {
  console.log(`\nFAIL — ${findings.length} finding(s):`);
  for (const f of findings) console.log('  ' + f);
  process.exit(1);
}
console.log(CHECK ? '\nPASS — every figure is current' : '\nPASS — figures written');
