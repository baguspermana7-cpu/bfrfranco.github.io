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
    id: 'three-levers',
    page: 'article-27.html',
    caption:
      'Three levers, one pool. Substitute lowers how many people the work needs; Extend raises ' +
      'what the people already there can do. Neither adds a qualified person. Only Create feeds ' +
      'the pool \u2014 and it is the slowest of the three, which is the whole difficulty of ' +
      'building a plan rather than a collection of initiatives.',
    because:
      'the table gives each lever a definition, a strategy list and a time horizon, and the ' +
      'prose then states the finding: Create is the only lever that permanently increases ' +
      'supply. In a table that sentence is a fourth column nobody reads against the others. ' +
      'Drawn, it is the shape of the thing \u2014 two of the three arrows never reach the pool.',
    build() {
      const ctx = D.create({
        slug: 'levers',
        title: 'Three workforce levers, and which one actually adds people',
        desc: 'The shortage of qualified data centre staff can be attacked three ways. Create ' +
              'builds new qualified supply through apprenticeships, community college and ' +
              'university pipelines, taking weeks through unions to six years or more through a ' +
              'degree, and it is the only lever that adds to the pool. Substitute replaces human ' +
              'labour with technology or outsourced services, lowering the number of people ' +
              'needed. Extend raises the output of the people already present through tooling ' +
              'and training. Neither Substitute nor Extend adds a qualified person.'
      });

      const LX = 40, W = 340, RX = 520;

      /* The pool is drawn tall enough to span all three levers, so each one
       * gets its own port opposite itself and every run is level. The first cut
       * gave it a normal-height box and aimed three connectors at points 12 to
       * 18 units apart; the router doglegged all three through one corridor and
       * they wove into a rectangle nobody had declared. */
      const POOL_TOP = 48, POOL_H = 400;
      const pool = ctx.node(RX, POOL_TOP, {
        id: 'pool', tag: 'the constraint', name: 'Qualified people available',
        sublabel: 'the pool the 2026 cliff drains', w: W, h: POOL_H, vAlign: 'middle',
        stroke: 'accent', fill: 'paper-2', tier: 1, legend: 'What the shortage is'
      });
      const ports = ctx.ports(pool, 3, 'left', { id: 'pool' });

      const create = ctx.node(LX, ports[0].y - 36, {
        id: 'create', tag: 'weeks to 6+ yrs', name: 'CREATE',
        sublabel: 'apprenticeship \u00B7 college \u00B7 degree', w: W,
        stroke: 'accent', fill: 'paper', tier: 2, legend: 'Adds to the pool \u2014 and only this one'
      });
      const subst = ctx.node(LX, ports[1].y - 36, {
        id: 'subst', tag: 'immediate to 7 yrs', name: 'SUBSTITUTE',
        sublabel: 'NOCaaS \u00B7 automation \u00B7 outsourcing', w: W,
        stroke: 'rule-solid', fill: 'paper', tier: 2, dashed: true,
        legend: 'Changes the demand, not the supply'
      });
      const extend = ctx.node(LX, ports[2].y - 36, {
        id: 'extend', tag: 'weeks to 18 mo', name: 'EXTEND',
        sublabel: 'tooling \u00B7 training \u00B7 adjacent trades', w: W,
        stroke: 'rule-solid', fill: 'paper', tier: 2, dashed: true
      });

      /* Only one arrow reaches the pool as a supply. The other two are drawn
       * dotted to the same edge because they DO act on the shortage — they just
       * act on the demand side of it, which the container spells out. */
      ctx.edge({ x: create.x + create.w, y: ports[0].y }, { x: ports[0].x, y: ports[0].y }, {
        fromId: 'create', toId: 'pool', stroke: 'accent', tier: 1, pattern: 'solid',
        label: 'adds people', legend: 'Feeds the pool'
      });
      [subst, extend].forEach(function (n, i) {
        ctx.edge({ x: n.x + n.w, y: ports[i + 1].y }, { x: ports[i + 1].x, y: ports[i + 1].y }, {
          fromId: n.id, toId: 'pool', stroke: 'soft', tier: 2, pattern: 'dotted',
          legend: i === 0 ? 'Eases the draw on it' : undefined
        });
      });

      /* 24 units of headroom, not 34: at 34 the container's own eyebrow sat
         across the CREATE box above it, which the geometry audit caught. */
      ctx.zone(LX - 20, subst.y - 24, W + 40, (extend.y + extend.h + 18) - (subst.y - 24), {
        label: 'neither adds a qualified person', tier: 3, dashed: true
      });

      ctx.legend();
      return ctx.fit(28);
    }
  },
  {
    id: 'smr-cost-chain',
    page: 'article-21.html',
    caption:
      'What actually cancelled the flagship SMR project, and the one link hyperscalers replace. ' +
      'NuScale\'s costs did not kill it directly \u2014 they killed the subscription, because ' +
      'utilities buying year to year will not underwrite a 158 % overrun. A twenty-year power ' +
      'purchase agreement removes that link, which is why the buyer changing matters more than ' +
      'the technology changing.',
    because:
      'the section gives the overrun as a table and the hyperscaler difference as a list of ' +
      'contract terms. Between them sits a causal chain the article never draws: cost to LCOE to ' +
      'subscription to cancellation. Seeing it as a chain is what makes the PPA legible as a ' +
      'REPLACEMENT for one link rather than a nice contractual detail.',
    build() {
      const ctx = D.create({
        slug: 'smr',
        title: 'Why the Carbon Free Power Project was cancelled, and what changes with a hyperscaler buyer',
        desc: 'NuScale\'s Carbon Free Power Project escalated from 3.6 to 9.3 billion dollars, a ' +
              '158 per cent overrun, which pushed its levelised cost from 55 dollars per ' +
              'megawatt-hour to between 89 and 102. Member utilities then declined to take up the ' +
              'required 80 per cent subscription and the project was cancelled in November 2023. ' +
              'A hyperscaler signing a twenty-year power purchase agreement replaces the ' +
              'subscription link in that chain with contracted revenue certainty.'
      });

      const X = 40, W = 380, PITCH = 92;
      const chain = [
        { id: 'cost', tag: 'overrun', name: 'Cost: $3.6 B \u2192 $9.3 B', sub: '+158 %' },
        { id: 'lcoe', tag: 'consequence', name: 'LCOE: $55 \u2192 $89\u2013102 / MWh', sub: '+62\u201385 %' },
        { id: 'sub', tag: 'the link that broke', name: 'Utilities decline to subscribe',
          sub: '80 % take-up never reached', focal: true },
        { id: 'dead', tag: 'outcome', name: 'Cancelled, November 2023', sub: 'DOE had committed $232 M' }
      ];
      let y = 48;
      const nodes = chain.map(function (c) {
        const n = ctx.node(X, y, {
          id: c.id, tag: c.tag, name: c.name, sublabel: c.sub, w: W,
          stroke: c.focal ? 'accent' : 'rule-solid',
          fill: c.focal ? 'paper-2' : 'paper', tier: c.focal ? 1 : 2,
          legend: c.focal ? 'The pivot \u2014 the link that broke, and what replaces it'
                          : (c.id === 'cost' ? 'The chain as it ran' : undefined)
        });
        y = n.y + PITCH;
        return n;
      });
      for (let i = 0; i < nodes.length - 1; i++) {
        ctx.edge({ x: nodes[i].x + nodes[i].w / 2, y: nodes[i].y + nodes[i].h },
                 { x: nodes[i + 1].x + nodes[i + 1].w / 2, y: nodes[i + 1].y }, {
          fromId: nodes[i].id, toId: nodes[i + 1].id, stroke: 'ink', tier: 2, pattern: 'solid'
        });
      }

      const ppa = ctx.node(X + W + 190, nodes[2].y - 12, {
        id: 'ppa', tag: 'what changes', name: '20-year PPA',
        sublabel: 'Microsoft, and Amazon through 2042', w: 300,
        stroke: 'accent', fill: 'paper-2', tier: 1
        /* no legend entry: it shares the accent with the link it replaces, which is
           the point, and two names for one swatch is a legend a reader cannot use */
      });
      ctx.edge({ x: ppa.x, y: ppa.y + ppa.h / 2 },
               { x: nodes[2].x + nodes[2].w, y: nodes[2].y + nodes[2].h / 2 }, {
        fromId: 'ppa', toId: 'sub', stroke: 'accent', tier: 1, pattern: 'dashed',
        label: 'revenue certainty', legend: 'Removes the subscription risk'
      });

      ctx.legend();
      return ctx.fit(28);
    }
  },
  {
    id: 'method-montecarlo',
    page: 'article-4.html',
    caption:
      'What the calculator on this page actually does. The five phases are decomposed ' +
      'deterministically from your inputs, then resampled 5,000 times against their uncertainty. ' +
      'The result is a distribution, so the honest answer is a range \u2014 p10, p50, p90 \u2014 ' +
      'and the recommendations are thresholds read off that range, not advice written in advance.',
    because:
      'the page hands the reader a Monte Carlo result and a ranked list of actions without ever ' +
      'showing the path between them. Two things get lost: that the output is a DISTRIBUTION ' +
      'rather than a number, and that the recommendations are DERIVED from it rather than ' +
      'authored. Both are properties of the pipeline, which is a shape, and neither survives as a ' +
      'sentence next to a table of results.',
    build() {
      const ctx = D.create({
        slug: 'method',
        title: 'How this page turns inputs into a ranked set of actions',
        desc: 'Inputs describing the site are decomposed into the five MTTR phases — detection, ' +
              'diagnosis, mobilisation, repair and verification — each scaled by skill level, ' +
              'spares readiness and coverage. That deterministic model is then resampled five ' +
              'thousand times to produce a distribution, reported at the tenth, fiftieth and ' +
              'ninetieth percentiles. Recommendations are thresholds read off those results, ' +
              'not text written in advance.'
      });

      /* Stacked, not strung out: five boxes in a row is 1,670 units and unreadable
         once scaled to a reading column. A pipeline reads top-down just as well. */
      const X = 40, W = 380, PITCH = 96;
      const steps = [
        { id: 'in', tag: 'you set', name: 'Inputs',
          sub: 'skill \u00B7 spares \u00B7 coverage \u00B7 SLA', focal: false },
        { id: 'model', tag: 'deterministic', name: 'Five-phase decomposition',
          sub: 'detect \u00B7 diagnose \u00B7 mobilise \u00B7 repair \u00B7 verify' },
        { id: 'mc', tag: '5,000 runs', name: 'Monte Carlo resample',
          sub: 'each phase against its uncertainty', focal: true },
        { id: 'dist', tag: 'the answer', name: 'A distribution',
          sub: 'p10 \u00B7 p50 \u00B7 p90 \u2014 not one number' },
        { id: 'rec', tag: 'derived', name: 'Ranked actions',
          sub: 'thresholds read off the result' }
      ];

      let y = 48;
      const nodes = steps.map(function (s) {
        const n = ctx.node(X, y, {
          id: s.id, tag: s.tag, name: s.name, sublabel: s.sub, w: W,
          stroke: s.focal ? 'accent' : 'rule-solid',
          fill: s.focal ? 'paper-2' : 'paper',
          tier: s.focal ? 1 : 2,
          legend: s.focal ? 'Where the uncertainty enters' : (s.id === 'in' ? 'Pipeline stage' : undefined)
        });
        y = n.y + PITCH;
        return n;
      });

      for (let i = 0; i < nodes.length - 1; i++) {
        ctx.edge({ x: nodes[i].x + nodes[i].w / 2, y: nodes[i].y + nodes[i].h },
                 { x: nodes[i + 1].x + nodes[i + 1].w / 2, y: nodes[i + 1].y }, {
          fromId: nodes[i].id, toId: nodes[i + 1].id,
          stroke: 'ink', tier: 2, pattern: 'solid'
        });
      }

      ctx.legend();
      return ctx.fit(28);
    }
  },
  {
    id: 'tariff-gap',
    page: 'article-12.html',
    caption:
      'A residential kilowatt-hour in Indonesia sells for less than it costs to generate. The ' +
      'shortfall of IDR 579 does not vanish \u2014 it is carried, by the state budget and by ' +
      'industrial users paying unsubsidised rates. Data centres sit on the industrial side of ' +
      'this ledger, which is the section\'s point: the subsidy runs the other way from the ' +
      'popular telling.',
    because:
      'the article gives the two prices and then lists the two things that cover the difference. ' +
      'Prose puts the numbers in separate sentences and the list in a third place, so the reader ' +
      'has to hold three facts and subtract. The gap is the whole argument, and a gap is a ' +
      'quantity between two levels \u2014 something to be SHOWN, not recited.',
    build() {
      const ctx = D.create({
        slug: 'tariff',
        title: 'The Indonesian residential tariff gap, and who carries it',
        desc: 'Electricity costs about 1,732 rupiah per kilowatt-hour to generate in Indonesia, ' +
              'while residential tariffs average about 1,153 rupiah. The difference of 579 rupiah ' +
              'per kilowatt-hour is covered by a government subsidy budgeted at 83 trillion ' +
              'rupiah and by cross-subsidy from industrial users, who pay full rates without ' +
              'subsidy. Data centres are industrial users.'
      });

      const LX = 48, W = 330, RX = 560;

      const cost = ctx.node(LX, 56, {
        id: 'cost', tag: 'what it costs', name: 'IDR 1,732 per kWh',
        sublabel: 'cost to generate', w: W,
        stroke: 'rule-solid', fill: 'paper', tier: 2, legend: 'The two prices'
      });
      const tariff = ctx.node(LX, 268, {
        id: 'tariff', tag: 'what it sells for', name: 'IDR 1,153 per kWh',
        sublabel: 'average residential tariff', w: W,
        stroke: 'rule-solid', fill: 'paper', tier: 2
      });

      /* The gap is drawn as the space BETWEEN the two prices, because that is
       * what it is. Labelling it in a box beside them would make it a third
       * number to be read rather than a distance to be seen. */
      ctx.zone(LX - 20, cost.y + cost.h + 16, W + 40,
               tariff.y - (cost.y + cost.h) - 32, {
        label: 'the gap \u2014 IDR 579 per kWh, and it does not vanish',
        tier: 3, dashed: true, stroke: 'accent'
      });

      const subsidy = ctx.node(RX, 114, {
        id: 'subsidy', tag: 'carried by', name: 'Government subsidy',
        sublabel: 'IDR 83 trillion budget', w: W,
        stroke: 'accent', fill: 'paper-2', tier: 2, legend: 'Who carries the gap'
      });
      const cross = ctx.node(RX, 190, {
        id: 'cross', tag: 'carried by', name: 'Industrial cross-subsidy',
        sublabel: 'full rates, no subsidy \u2014 data centres are here', w: W,
        stroke: 'accent', fill: 'paper-2', tier: 2
      });

      /* Each carrier gets its OWN point on the gap's edge, and the nodes are
       * placed so both runs are level. Aiming both at one point made the router
       * dogleg around each other, and the two detours drew a rectangle that
       * read as a box nobody had declared — rule 4 exists for this. */
      [subsidy, cross].forEach(function (n) {
        const y = n.y + n.h / 2;
        ctx.edge({ x: n.x, y: y }, { x: LX + W + 20, y: y }, {
          fromId: n.id, toId: 'gap', stroke: 'accent', tier: 2, pattern: 'solid',
          legend: 'Flows into the gap'
        });
      });

      ctx.legend();
      return ctx.fit(28);
    }
  },
  {
    id: 'corridor-model',
    page: 'article-19.html',
    caption:
      'Not a choice between two sites \u2014 one system across both, split by what each side is ' +
      'good at. Singapore keeps the front door because that is where the peering is; Batam takes ' +
      'the engine room because that is where the power and land are. The dedicated interconnect ' +
      'is what makes the split workable rather than a compromise.',
    because:
      'the section argues that the informed answer is neither site but a corridor spanning both. ' +
      'That is a TOPOLOGY, and the article states it only in prose: which workloads stay, which ' +
      'move, and the link that joins them. A reader who has been comparing two columns of costs ' +
      'has to be shown that the comparison was the wrong frame.',
    build() {
      const ctx = D.create({
        slug: 'corridor',
        title: 'The Singapore-Batam corridor: one system, split by function',
        desc: 'Front-end workloads \u2014 peering, low-latency applications and cloud ' +
              'interconnect \u2014 stay in Singapore, whose growth is capped by land, power and ' +
              'a 1.25 PUE sustainability framework. Back-end capacity \u2014 AI training, storage ' +
              'and disaster recovery \u2014 moves to Batam, which absorbs the overflow. A ' +
              'dedicated submarine interconnect of 24 fibre pairs at 20 Tbps each, targeted for ' +
              'the fourth quarter of 2026, joins the two.'
      });

      const W = 360, LX = 56, RX = 620, NY = 96;

      const front = ctx.node(LX, NY, {
        id: 'front', tag: 'front door', name: 'Peering \u00B7 low latency \u00B7 interconnect',
        sublabel: 'stays where the ecosystem is', w: W,
        stroke: 'accent', fill: 'paper-2', tier: 1, legend: 'Workload that cannot move'
      });
      const back = ctx.node(RX, NY, {
        id: 'back', tag: 'engine room', name: 'AI training \u00B7 storage \u00B7 DR',
        sublabel: 'moves to where power and land are', w: W,
        stroke: 'rule-solid', fill: 'paper', tier: 2, legend: 'Workload that can'
      });

      /* The link is the point: without it this is two sites, not a corridor. */
      ctx.edge({ x: front.x + front.w, y: front.y + front.h / 2 },
               { x: back.x, y: back.y + back.h / 2 }, {
        fromId: 'front', toId: 'back', stroke: 'ink', tier: 1, pattern: 'solid',
        label: '24 pairs \u00B7 20 Tbps each', legend: 'Dedicated interconnect, Q4 2026'
      });

      ctx.zone(LX - 24, NY - 52, W + 48, 160, {
        label: 'singapore \u2014 capped by land, power, PUE 1.25 and 50 % green',
        tier: 3, dashed: true, stroke: 'accent'
      });
      ctx.zone(RX - 24, NY - 52, W + 48, 160, {
        label: 'batam \u2014 absorbs what Singapore structurally cannot',
        tier: 3, dashed: true
      });

      ctx.legend();
      return ctx.fit(28);
    }
  },
  {
    id: 'jevons-loop',
    page: 'article-17.html',
    caption:
      'The bear case reads the first arrow and stops. Efficiency does cut the cost of a query, ' +
      'by about 90 % once model, hardware and quantisation gains compound \u2014 and that is ' +
      'exactly what raises total volume by roughly a thousand per cent. The last step funds the ' +
      'first, which is what makes it a loop rather than a saving.',
    because:
      'the article tabulates three efficiency factors against their effect on per-query cost and ' +
      'on total demand. A table lists them as three independent rows; it cannot show that the ' +
      'output returns to the input. Jevons is a REINFORCING CYCLE, and a cycle drawn as a list ' +
      'reads as a set of unrelated savings \u2014 which is precisely the misreading the section ' +
      'was written to correct.',
    build() {
      const ctx = D.create({
        slug: 'jevons',
        title: 'Why cheaper inference raises total demand',
        desc: 'A reinforcing cycle in four steps. Efficiency gains in models, hardware and ' +
              'quantisation cut the cost of a query. A cheaper query brings more users and more ' +
              'use cases. More queries raise total compute demand. Rising demand funds the next ' +
              'round of efficiency work, which returns to the first step. The per-unit cost falls ' +
              'about 90 per cent while total volume rises about a thousand per cent.'
      });

      const L = 40, R = 560, TOP = 50, BOT = 236, W = 330;

      const eff = ctx.node(L, TOP, {
        id: 'eff', tag: 'step 1', name: 'Efficiency improves',
        sublabel: 'model \u00B7 hardware \u00B7 quantisation', w: W,
        stroke: 'accent', fill: 'paper-2', tier: 1,
        legend: 'Where the bear case stops reading'
      });
      const cost = ctx.node(R, TOP, {
        id: 'cost', tag: 'step 2', name: 'Cost per query falls',
        sublabel: 'about \u221290 % per unit combined', w: W,
        stroke: 'rule-solid', fill: 'paper', tier: 2, legend: 'Steps in the cycle'
      });
      const use = ctx.node(R, BOT, {
        id: 'use', tag: 'step 3', name: 'More users, more use cases',
        sublabel: 'about +1,000 % total volume', w: W,
        stroke: 'rule-solid', fill: 'paper', tier: 2
      });
      const demand = ctx.node(L, BOT, {
        id: 'demand', tag: 'step 4', name: 'Total compute demand rises',
        sublabel: 'inference to 90 GW by 2030', w: W,
        stroke: 'rule-solid', fill: 'paper', tier: 2
      });

      const midY = (n) => n.y + n.h / 2;
      const midX = (n) => n.x + n.w / 2;

      /* Clockwise, every leg axis-aligned: the cycle needs no elbow, so it gets
       * none. The closing leg is the one the argument turns on, so it is the
       * one that carries an accent and a label. */
      ctx.edge({ x: eff.x + eff.w, y: midY(eff) }, { x: cost.x, y: midY(cost) }, {
        fromId: 'eff', toId: 'cost', stroke: 'ink', tier: 2, pattern: 'solid'
      });
      ctx.edge({ x: midX(cost), y: cost.y + cost.h }, { x: midX(use), y: use.y }, {
        fromId: 'cost', toId: 'use', stroke: 'ink', tier: 2, pattern: 'solid'
      });
      ctx.edge({ x: use.x, y: midY(use) }, { x: demand.x + demand.w, y: midY(demand) }, {
        fromId: 'use', toId: 'demand', stroke: 'ink', tier: 2, pattern: 'solid'
      });
      ctx.edge({ x: midX(demand), y: demand.y }, { x: midX(eff), y: eff.y + eff.h }, {
        fromId: 'demand', toId: 'eff', stroke: 'accent', tier: 1, pattern: 'solid',
        label: 'funds the next round', legend: 'The leg that closes the loop'
      });

      ctx.legend();
      return ctx.fit(28);
    }
  },
  {
    id: 'cooling-water-loop',
    page: 'article-10.html',
    caption:
      'The loop the mitigation list acts on. Evaporation is the loss that does the work \u2014 it ' +
      'is how the heat leaves \u2014 so it cannot be engineered away, only reduced by rejecting ' +
      'less heat. Blowdown is a deliberate discharge that keeps dissolved solids in check, which ' +
      'is what raising the cycles of concentration reduces. Leaks return nothing at all.',
    because:
      'section 8.1 tells the reader to raise the cycles of concentration to cut blowdown, and to ' +
      'raise supply setpoints. Both instructions assume a loop the article never draws, and ' +
      '"blowdown" is meaningless to a reader who does not already know it is deliberate. The ' +
      'figure makes the list legible; it adds no number the article does not carry.',
    build() {
      const ctx = D.create({
        slug: 'cw-loop',
        title: 'Where cooling water leaves the loop, and which lever acts on each path',
        desc: 'Make-up water enters a cooling tower basin. It leaves by three paths. Evaporation ' +
              'carries the heat away and is the reason the tower works, so it is reduced only by ' +
              'rejecting less heat, which is what raising supply setpoints does. Blowdown is a ' +
              'deliberate discharge controlled by the cycles of concentration. Leaks are pure ' +
              'loss and are addressed by detection. Water use effectiveness measures the whole.'
      });

      const X_IN = 40, X_MID = 300, X_OUT = 700;
      const W_IN = 200, W_MID = 250, W_OUT = 290;
      /* The basin is drawn tall enough that its three ports are spaced for the
       * nodes they feed, not merely for the 12-unit rule-4 minimum. Ports sit
       * at L*k/(N+1), so three outputs on a 384-unit edge land 96 apart, which
       * clears a 72-unit node with 24 to spare. The first cut used a 128-unit
       * basin: the ports passed rule 4 at 32 apart and the nodes still
       * overlapped by 40. Spacing that satisfies the connector rule is not the
       * same as spacing that fits the content. */
      const BASIN_TOP = 40, BASIN_H = 384;

      const makeup = ctx.node(X_IN, BASIN_TOP + BASIN_H / 2 - 36, {
        id: 'makeup', tag: 'in', name: 'Make-up water', sublabel: 'drawn from the local supply',
        /* no legend entry: drawn the same as the loss paths, and its own IN tag
           already says what it is */
        w: W_IN, stroke: 'rule-solid', fill: 'paper', tier: 2
      });

      const basin = ctx.node(X_MID, BASIN_TOP, {
        id: 'basin', tag: 'tower', name: 'Cooling tower basin', sublabel: 'circulating loop',
        w: W_MID, h: BASIN_H, vAlign: 'middle',
        stroke: 'accent', fill: 'paper-2', tier: 1, legend: 'The loop itself'
      });

      const outs = [
        { id: 'evap', tag: 'does the work', name: 'Evaporation',
          sub: 'this is how the heat leaves', lever: 'raise setpoints',
          stroke: 'rule-solid', dashed: false, legend: 'Loss that carries the heat' },
        { id: 'blow', tag: 'deliberate', name: 'Blowdown',
          sub: 'discharged to control dissolved solids', lever: 'raise cycles',
          stroke: 'rule-solid', dashed: false },
        { id: 'leak', tag: 'pure loss', name: 'Leaks',
          sub: 'returns nothing, compounds annually', lever: 'leak detection',
          stroke: 'soft', dashed: true, legend: 'Loss that does no work' }
      ];

      const ports = ctx.ports(basin, 3, 'right', { id: 'basin' });
      outs.forEach(function (o, i) {
        const n = ctx.node(X_OUT, ports[i].y - 36, {
          id: o.id, tag: o.tag, name: o.name, sublabel: o.sub, w: W_OUT,
          stroke: o.stroke, fill: 'paper', tier: 2, dashed: o.dashed, legend: o.legend
        });
        ctx.edge({ x: ports[i].x, y: ports[i].y }, { x: n.x, y: ports[i].y }, {
          fromId: 'basin', toId: o.id,
          stroke: o.dashed ? 'soft' : 'ink', tier: 2,
          pattern: o.dashed ? 'dotted' : 'solid',
          label: o.lever, legend: o.dashed ? undefined : 'The lever that acts on it'
        });
      });

      ctx.edge({ x: makeup.x + makeup.w, y: makeup.y + makeup.h / 2 },
               { x: basin.x, y: basin.y + basin.h / 2 }, {
        fromId: 'makeup', toId: 'basin', stroke: 'ink', tier: 2, pattern: 'solid'
      });

      ctx.legend();
      return ctx.fit(28);
    }
  },
  {
    id: 'cpo-trace-collapse',
    page: 'article-22.html',
    caption:
      'Drawn to the trace lengths the article quotes: the electrical run is 24 times shorter in ' +
      'the lower arrangement. Moving the conversion from the front panel to the package is not a ' +
      'packaging preference \u2014 it is what removes the retimers, because at half an inch there ' +
      'is no longer a signal to recover.',
    because:
      'the article already tabulates pluggable against co-packaged across seven characteristics, ' +
      'including the two trace lengths as numbers. What the table cannot show is that this is a ' +
      'question of GEOMETRY: the argument is about distance on a board, and the retimers exist ' +
      'only to pay for that distance. Draw the distance and their removal explains itself.',
    build() {
      const ctx = D.create({
        slug: 'cpo',
        title: 'Where the electrical-to-optical conversion happens, and how far the signal travels to reach it',
        desc: 'In the pluggable arrangement the switch ASIC drives 12 to 18 inches of printed ' +
              'circuit board trace to a front-panel cage, and retimers, clock-and-data recovery ' +
              'and DSP sit in that path to recover the signal. In co-packaged optics the optical ' +
              'engine sits on the same package substrate as the ASIC, the electrical run falls ' +
              'below half an inch, and the recovery circuits are no longer needed. The two rows ' +
              'are drawn to the same scale.'
      });

      /* The drawing is to scale on the one axis that carries the argument.
       * 12 inches against 0.5 is 24:1, so at 16 units for the short run the
       * long one is 384. An illustrative ratio would have been easier to lay
       * out and would have quietly overstated or understated the point; the
       * whole claim IS the ratio, so the ratio is drawn. */
      const SHORT = 16, LONG = 384;
      const X0 = 40, ASIC_W = 170, CONV_W = 210;
      const ROW_A = 66, ROW_B = 250;

      const asicA = ctx.node(X0, ROW_A, {
        id: 'asic-a', tag: 'asic', name: 'Switch ASIC', sublabel: '224G PAM4 SerDes',
        w: ASIC_W, stroke: 'rule-solid', fill: 'paper', tier: 2
      });
      const retimer = ctx.node(X0 + ASIC_W + LONG / 2 - 92, ROW_A, {
        id: 'retimer', tag: 'in path', name: 'Retimers · CDR · DSP',
        sublabel: 'several W per lane, 64 lanes',
        w: 184, stroke: 'accent', fill: 'paper-2', tier: 2,
        legend: 'Exists only to pay for the distance'
      });
      const plug = ctx.node(X0 + ASIC_W + LONG, ROW_A, {
        id: 'plug', tag: 'front panel', name: 'Pluggable optic', sublabel: 'QSFP-DD / OSFP',
        w: CONV_W, stroke: 'rule-solid', fill: 'paper', tier: 2,
        legend: 'Electrical \u2192 optical conversion'
      });

      const asicB = ctx.node(X0, ROW_B, {
        id: 'asic-b', tag: 'asic', name: 'Switch ASIC', sublabel: 'same silicon',
        w: ASIC_W, stroke: 'rule-solid', fill: 'paper', tier: 2
      });
      const engine = ctx.node(X0 + ASIC_W + SHORT, ROW_B, {
        id: 'engine', tag: 'on package', name: 'Optical engine', sublabel: 'silicon photonics',
        w: CONV_W, stroke: 'rule-solid', fill: 'paper', tier: 2
      });

      const mid = (n) => n.y + n.h / 2;
      ctx.edge({ x: asicA.x + asicA.w, y: mid(asicA) }, { x: retimer.x, y: mid(retimer) }, {
        fromId: 'asic-a', toId: 'retimer', stroke: 'ink', tier: 1, pattern: 'solid',
        /* the segment is 100 units and the full phrase needs 117, so the
           description lives in the caption and the number on the line */
        label: '12\u201318 in', legend: 'Electrical, lossy at 224G'
      });
      ctx.edge({ x: retimer.x + retimer.w, y: mid(retimer) }, { x: plug.x, y: mid(plug) }, {
        fromId: 'retimer', toId: 'plug', stroke: 'ink', tier: 1, pattern: 'solid'
      });
      ctx.edge({ x: asicB.x + asicB.w, y: mid(asicB) }, { x: engine.x, y: mid(engine) }, {
        /* No label on this one: the run is 16 units and the shortest honest
           label is 37, so it cannot sit beside the line without covering it.
           The zone below carries the number instead. The engine refused to
           place it rather than drawing it over the stroke. */
        fromId: 'asic-b', toId: 'engine', stroke: 'ink', tier: 1, pattern: 'solid'
      });

      /* The fibre is the same on both rows: what changes is everything before
       * it. Drawn short and identical so the eye compares the copper, not this. */
      [[plug, 'fibre-a'], [engine, 'fibre-b']].forEach(function (pair) {
        const n = pair[0];
        ctx.edge({ x: n.x + n.w, y: mid(n) }, { x: n.x + n.w + 64, y: mid(n) }, {
          fromId: n.id, toId: pair[1], stroke: 'muted', tier: 2, pattern: 'dashed',
          label: 'fibre', legend: 'Optical, out of the switch'
        });
      });

      ctx.zone(X0 - 18, ROW_B - 40, ASIC_W + SHORT + CONV_W + 36,
               (engine.y + engine.h + 20) - (ROW_B - 40), {
        label: 'one package substrate \u2014 under 0.5 in of electrical run, and no retimers', tier: 3, dashed: true,
        stroke: 'accent'
      });

      ctx.legend();
      return ctx.fit(28);
    }
  },
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
  /* Size bounds travel WITH the figure, because they depend on its own viewBox.
   *
   * `width:100%` alone fails in both directions. A 1,672-unit figure shrinks
   * until its 8-unit type renders under 6 px; a 460-unit one is stretched until
   * a 12-unit name renders at 18 and the figure shouts. A drawing should render
   * at its own scale and shrink only when it must.
   *
   * max-width is the viewBox, so it never upscales. min-width is the smaller of
   * the viewBox and 640, so a wide figure scrolls in its own track instead of
   * shrinking into illegibility, and a narrow one never forces a scrollbar it
   * does not need. */
  const bounds = 'max-width:' + ctx.width + 'px;min-width:' +
    Math.min(ctx.width, 640) + 'px;';
  const svg = ctx.render().replace(
    '<svg ', '<svg style="' + bounds + TOKEN_BRIDGE + '" ');
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
    /* A figure wider than the column it lands in is scaled down, and its
     * smallest type goes with it. The article track is about 1,100 px at a
     * desktop reading width, so a 1,672-unit viewBox renders 8 px eyebrows at
     * under 6 px — below the 8.5 px floor this site enforces everywhere else.
     * Wide is not a style choice here; it is a legibility failure with a
     * different name. Wrap the composition or stack it vertically. */
    const ARTICLE_TRACK_PX = 1100;
    const SMALLEST_TYPE = 8;
    const scaled = SMALLEST_TYPE * (ARTICLE_TRACK_PX / ctx.width);
    if (ctx.width > ARTICLE_TRACK_PX && scaled < 8.5) {
      findings.push(
        `${page} · ${fig.id}: ${ctx.width} units wide renders its 8-unit type at ` +
        `${scaled.toFixed(1)} px in a ${ARTICLE_TRACK_PX} px column, under the 8.5 px floor. ` +
        `Stack or wrap the composition rather than letting it shrink.`);
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
