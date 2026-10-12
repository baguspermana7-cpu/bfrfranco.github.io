/* ============================================================================
 * article-diagrams-converted.mjs — the article block diagrams that were drawn by hand
 * ----------------------------------------------------------------------------
 * Imported by tools/build-article-diagrams.mjs. Every figure here REPLACES a
 * diagram an article already carried: a row of <span class="flow-box"> with "→"
 * between them, a hand-typed SVG with fixed coordinates, or a hand-drawn living
 * diagram. The content is the original's — the same boxes, the same words, the
 * same numbers, the same connections — redrawn through the RZ diagram engine so
 * every label is measured, every connector routed, and equipment carries its
 * IEC 60617 / ISA-5.1 glyph from js/rz-eng-symbols.js.
 *
 * Two rules decided every change from the original:
 *   1. Nothing is added that the article does not say. A glyph goes on a node
 *      only when the node IS that equipment (a UPS, a transformer, a rack); a
 *      concept (a subsidy, a control plane, a pipeline stage) gets none.
 *   2. Where the original drew a physical arrangement wrongly, the redraw follows
 *      the physics and says so: AWS's in-rack battery hangs on the 48 V busbar
 *      beside the load, not in series between busbar and load.
 *
 * A `live` block carries the living-diagram configuration verbatim from the page
 * it came from; js/rz-article-diagram.js animates engine figures through the
 * engine's own hooks (data-rzd-edge, data-rzd-node, text[data-pv]).
 * ==========================================================================*/

/* A vertical chain: each node under the last, one solid connector between each
 * pair. Returns the boxes so a figure can hang branches or zones off them. */
function chain(ctx, x, y0, w, items, gap, edgeOpts) {
  let y = y0;
  const boxes = items.map(function (it) {
    const o = Object.assign({ w: w }, it);
    const b = ctx.node(x, y, o);
    b.id = it.id;
    y = b.y + b.h + gap;
    return b;
  });
  for (let i = 0; i < boxes.length - 1; i++) {
    const a = boxes[i], b = boxes[i + 1];
    ctx.edge({ x: a.x + a.w / 2, y: a.y + a.h }, { x: b.x + b.w / 2, y: b.y },
      Object.assign({ fromId: a.id, toId: b.id, stroke: 'ink', tier: 2, pattern: 'solid' },
        typeof edgeOpts === 'function' ? edgeOpts(i, a, b) : edgeOpts));
  }
  return boxes;
}

export function convertedFigures(D) {
  return [
    /* ---- article-6 · 6.2 ------------------------------------------------- */
    {
      id: 'rca-contributing-factors',
      page: 'article-6.html',
      caption:
        'The four contributing factors the team’s fishbone identified, and the event they ' +
        'added up to. CRAH-3 was down for routine maintenance, the BMS did not redistribute its ' +
        'load across the remaining three units, and inlet temperatures in two cabinet rows stayed ' +
        'above 35 °C for 18 minutes before the operator intervened by hand.',
      because:
        'replaces a hand-built row of boxes joined by "+" and "=". The factors are the article’s; ' +
        'the outcome’s numbers are the ones its own incident paragraph gives.',
      build() {
        const ctx = D.create({
          slug: 'rcaf',
          title: 'Fishbone analysis: data hall thermal excursion',
          desc: 'Four contributing factors identified by the root cause analysis: a BMS ' +
                'configuration error, no load redistribution test, a single operator on shift, and ' +
                'no pre-maintenance verification. Together they produced a thermal excursion in ' +
                'which inlet temperatures in two cabinet rows exceeded 35 degrees Celsius for 18 minutes.'
        });
        const LX = 40, W = 300, H = 40, GAP = 18, RX = 420;
        const factors = ['BMS config error', 'No load redistribution test',
                         'Single operator shift', 'No pre-maintenance verification'];
        const TOP = 48, SPAN = factors.length * H + (factors.length - 1) * GAP;
        const out = ctx.node(RX, TOP, {
          id: 'excursion', tag: 'effect', name: 'Thermal excursion',
          sublabel: 'inlet > 35 °C · 18 min', w: 240, h: SPAN, vAlign: 'middle',
          stroke: 'accent', fill: 'paper-2', tier: 1, legend: 'The event'
        });
        const ports = ctx.ports(out, factors.length, 'left', { id: 'excursion' });
        factors.forEach(function (name, i) {
          const n = ctx.node(LX, ports[i].y - H / 2, {
            id: 'f' + i, name: name, w: W, h: H, stroke: 'rule-solid', fill: 'paper', tier: 2,
            legend: i === 0 ? 'Contributing factor (from the RCA)' : undefined
          });
          ctx.edge({ x: n.x + n.w, y: ports[i].y }, { x: ports[i].x, y: ports[i].y }, {
            fromId: 'f' + i, toId: 'excursion', stroke: 'ink', tier: 2, pattern: 'solid'
          });
        });
        ctx.legend();
        return ctx.fit(28);
      }
    },

    /* ---- article-6 · 7.4 ------------------------------------------------- */
    {
      id: 'rca-design-pipeline',
      page: 'article-6.html',
      caption:
        'The RCA-to-design pipeline. The investigation does not end at a recommendation: it ' +
        'runs through design review and change control, and the pipeline closes only when the ' +
        'change has been verified effective.',
      because:
        'replaces a hand-built row of seven boxes joined by arrows; the last two were tinted ' +
        'green, which is now a container that names what the tint meant.',
      build() {
        const ctx = D.create({
          slug: 'rcap',
          title: 'RCA-to-design pipeline',
          desc: 'Seven stages in order: incident, RCA investigation, finding classification, ' +
                'design review, management-of-change integration, system change, and verification. ' +
                'The pipeline closes at verification, when the change is confirmed effective.'
        });
        const steps = ['Incident', 'RCA investigation', 'Finding classification', 'Design review',
                       'MoC integration', 'System change', 'Verification'];
        const boxes = chain(ctx, 60, 48, 280, steps.map(function (s, i) {
          return {
            id: 's' + i, name: s, h: 40,
            stroke: i >= 5 ? 'accent' : 'rule-solid', fill: i >= 5 ? 'paper-2' : 'paper',
            tier: i >= 5 ? 1 : 2,
            legend: i === 0 ? 'Investigation and design stage' : (i === 5 ? 'Where the pipeline closes' : undefined)
          };
        }), 34);
        const a = boxes[5], b = boxes[6];
        ctx.zone(a.x - 18, a.y - 28, a.w + 36, (b.y + b.h + 16) - (a.y - 28), {
          label: 'closes when the change is verified', tier: 3, dashed: true
        });
        ctx.legend();
        return ctx.fit(28);
      }
    },

    /* ---- article-13 · 2.1 · live ----------------------------------------- */
    {
      id: 'live-2n-ups',
      page: 'article-13.html',
      caption:
        '2N architecture: each UPS can carry the full rack load alone. This is the conventional ' +
        'centralised baseline: inject the UPS-A failure and UPS-B takes 100 % with no interruption ' +
        'at the rack. The AWS architecture below replaces the central pair with a battery in every rack.',
      because:
        'the hand-drawn living diagram, redrawn by the engine with IEC glyphs and the same live ' +
        'configuration. The caption now says the 2N pair is the centralised baseline, because the ' +
        'section it sits in describes AWS moving AWAY from centralised UPS.',
      live: {
        title: 'Live: why hyperscalers pay for 2N — kill UPS-A and the rack never notices',
        interval: 1000,
        baselines: {
          loadA: { v: 50, unit: '%', dp: 0, noise: 1.5, min: 0, max: 100 },
          loadB: { v: 50, unit: '%', dp: 0, noise: 1.5, min: 0, max: 100 },
          rackLoad: { v: 120, unit: 'kW', dp: 0, noise: 2 }
        },
        flows: { utiltx: 'flow', txA: 'flow', txB: 'flow', aPdu: 'flow', bPdu: 'flow', pduRack: 'flow' },
        scenarios: [{
          id: 'upsafail', label: 'Inject: UPS-A failure',
          deltas: { loadB: 50 }, exact: { loadA: 0 },
          flows: { txA: 'off', aPdu: 'off' }, alarms: { upsA: 'alarm' },
          msg: 'UPS-A offline. 2N redundancy: UPS-B instantly carries 100% of the load — the rack ' +
               'sees zero interruption. This is the failure scenario the article’s arc-flash and ' +
               'protection analysis is built around.'
        }],
        source: 'Illustrative 2N single-line schematic. 480 V AC distribution and NVL72 = 72 GPUs ' +
                '≈ 120 kW per rack as stated in the article body; load-share values illustrative.',
        basisTag: 'illustrative'
      },
      build() {
        const ctx = D.create({
          slug: 'l2n',
          title: '2N UPS single line: utility to GPU rack',
          desc: 'Utility medium-voltage feed to a transformer stepping down to 480 volts AC, which ' +
                'feeds two UPS units in parallel, A and B, each carrying 50 per cent. Both feed one ' +
                'PDU at 480 volts AC, which feeds an NVL72 GPU rack of 72 GPUs drawing 120 kilowatts. ' +
                'Either UPS can carry the full rack load alone.'
        });
        const Y = 120, NODE = { stroke: 'rule-solid', fill: 'paper', tier: 2 };
        const util = ctx.node(24, Y, Object.assign({ id: 'util', tag: 'MV feed', name: 'Utility',
          symbol: 'utility', w: 104 }, NODE));
        const tx = ctx.node(152, Y, Object.assign({ id: 'tx', tag: '→ 480 V AC', name: 'TX',
          symbol: 'transformer', w: 112 }, NODE));
        const upsA = ctx.node(296, 24, Object.assign({ id: 'upsA', state: 'ok', name: 'UPS A',
          symbol: 'ups', sublabel: '50 %', valueKey: 'loadA', w: 110 }, NODE));
        const upsB = ctx.node(296, 216, Object.assign({ id: 'upsB', state: 'ok', name: 'UPS B',
          symbol: 'ups', sublabel: '50 %', valueKey: 'loadB', w: 110 }, NODE));
        const pdu = ctx.node(440, Y, Object.assign({ id: 'pdu', tag: '480 V AC', name: 'PDU',
          symbol: 'pdu', w: 100 }, NODE));
        const rack = ctx.node(572, Y - 8, {
          id: 'rack', state: 'ok', tag: 'NVL72 · 72 GPUs', name: 'GPU rack', symbol: 'rack',
          sublabel: '120 kW', valueKey: 'rackLoad', w: 140,
          stroke: 'accent', fill: 'paper-2', tier: 1, legend: 'The load both paths protect'
        });
        const mid = function (b) { return b.y + b.h / 2; };
        const E = { stroke: 'accent', tier: 2, pattern: 'solid', state: 'flow' };
        ctx.edge({ x: util.x + util.w, y: mid(util) }, { x: tx.x, y: mid(tx) },
          Object.assign({ id: 'utiltx', fromId: 'util', toId: 'tx', legend: 'Power path (animated while live)' }, E));
        const txOut = ctx.ports(tx, 2, 'right', { id: 'tx' });
        ctx.edge(txOut[0], { x: upsA.x, y: mid(upsA) }, Object.assign({ id: 'txA', fromId: 'tx', toId: 'upsA' }, E));
        ctx.edge(txOut[1], { x: upsB.x, y: mid(upsB) }, Object.assign({ id: 'txB', fromId: 'tx', toId: 'upsB' }, E));
        const pduIn = ctx.ports(pdu, 2, 'left', { id: 'pdu' });
        ctx.edge({ x: upsA.x + upsA.w, y: mid(upsA) }, pduIn[0], Object.assign({ id: 'aPdu', fromId: 'upsA', toId: 'pdu' }, E));
        ctx.edge({ x: upsB.x + upsB.w, y: mid(upsB) }, pduIn[1], Object.assign({ id: 'bPdu', fromId: 'upsB', toId: 'pdu' }, E));
        ctx.edge({ x: pdu.x + pdu.w, y: mid(pdu) }, { x: rack.x, y: mid(pdu) },
          Object.assign({ id: 'pduRack', fromId: 'pdu', toId: 'rack' }, E));
        ctx.legend();
        return ctx.fit(24);
      }
    },

    /* ---- article-13 · 2.1 ------------------------------------------------ */
    {
      id: 'aws-distributed-power',
      page: 'article-13.html',
      caption:
        'AWS distributed power architecture. Conversion to DC happens in the rack’s power ' +
        'shelf, and the backup battery sits in the rack on the 48 V busbar rather than in a ' +
        'central UPS room, so one failure reaches one rack, not a hall.',
      because:
        'replaces a hand-built row of seven boxes. The original put the in-rack BBU in series ' +
        'between the busbar and the load; a battery backup unit sits on the busbar in parallel with ' +
        'the load, which is drawn here.',
      build() {
        const ctx = D.create({
          slug: 'awsp',
          title: 'AWS distributed power architecture',
          desc: 'Utility high-voltage grid to medium-voltage switchgear, to an MV/LV transformer, to an ' +
                'in-rack power shelf converting AC to DC, onto a 48 volt busbar that feeds the IT load. ' +
                'The in-rack battery backup unit is connected to the 48 volt busbar.'
        });
        const NODE = { stroke: 'rule-solid', fill: 'paper', tier: 2 };
        const boxes = chain(ctx, 60, 40, 240, [
          Object.assign({ id: 'grid', name: 'Utility grid (HV)', symbol: 'utility' }, NODE),
          Object.assign({ id: 'mvsg', name: 'MV switchgear', symbol: 'switchgear' }, NODE),
          Object.assign({ id: 'tx', name: 'MV/LV transformer', symbol: 'transformer' }, NODE),
          Object.assign({ id: 'shelf', tag: 'in rack', name: 'Power shelf (AC→DC)' }, NODE),
          Object.assign({ id: 'bus', tag: 'in rack', name: '48 V busbar', legend: 'Grid-to-load path' }, NODE),
          { id: 'load', name: 'IT load', symbol: 'rack', stroke: 'accent', fill: 'paper-2', tier: 1 }
        ], 26);
        const bus = boxes[4];
        const bbu = ctx.node(bus.x + bus.w + 70, bus.y - 14, {
          id: 'bbu', tag: 'in rack', name: 'In-rack BBU', symbol: 'battery', w: 170,
          stroke: 'accent', fill: 'paper-2', tier: 1, legend: 'Backup, per rack'
        });
        ctx.edge({ x: bbu.x, y: bus.y + bus.h / 2 }, { x: bus.x + bus.w, y: bus.y + bus.h / 2 }, {
          fromId: 'bbu', toId: 'bus', stroke: 'accent', tier: 2, pattern: 'dashed',
          label: 'on the bus', legend: 'Discharges onto the busbar on loss of supply'
        });
        ctx.legend();
        return ctx.fit(28);
      }
    },

    /* ---- article-13 · 2.3 ------------------------------------------------ */
    {
      id: 'mt-diablo-power',
      page: 'article-13.html',
      caption:
        'Microsoft Mt Diablo architecture. Conversion moves out of the compute rack into a ' +
        'sidecar power rack and the compute rack receives ±400 V DC, which the article ' +
        'credits with 15–35 % more accelerators per rack.',
      because:
        'replaces a hand-built row of five boxes; same stages, same order.',
      build() {
        const ctx = D.create({
          slug: 'mtd',
          title: 'Microsoft Mt Diablo disaggregated power',
          desc: 'A 480 volt AC backbone feeds a sidecar power rack, which supplies a plus-or-minus ' +
                '400 volt DC bus to the compute rack and its GPU and CPU load.'
        });
        const NODE = { stroke: 'rule-solid', fill: 'paper', tier: 2 };
        chain(ctx, 60, 40, 240, [
          Object.assign({ id: 'ac', name: '480 V AC backbone' }, NODE),
          { id: 'side', tag: 'disaggregated', name: 'Sidecar power rack', stroke: 'accent',
            fill: 'paper-2', tier: 1, legend: 'Conversion, moved out of the compute rack' },
          Object.assign({ id: 'dc', name: '±400 V DC bus', legend: 'Power path' }, NODE),
          Object.assign({ id: 'rack', name: 'Compute rack', symbol: 'rack' }, NODE),
          Object.assign({ id: 'load', name: 'GPU/CPU load' }, NODE)
        ], 26);
        ctx.legend();
        return ctx.fit(28);
      }
    },

    /* ---- article-13 · 2.5.7 ---------------------------------------------- */
    {
      id: 'anthropic-multicloud',
      page: 'article-13.html',
      caption:
        'Anthropic multi-cloud power and data flow, as the article lays it out. Four providers on ' +
        'four grids and three distribution standards, joined by two orchestration layers: a ' +
        'control plane for workloads and a global load balancer that routes by latency.',
      because:
        'replaces two hand-built rows of gradient-filled boxes in provider brand colours. The ' +
        'brand colours carried no meaning the labels do not; the grid and DC standard each ' +
        'provider sits on now live on the node, where they were a caption under it.',
      build() {
        const ctx = D.create({
          slug: 'amc',
          title: 'Anthropic multi-cloud power and data flow',
          desc: 'Top row: AWS Trainium2, 600 megawatts in Indiana on the MISO grid at 48 volt DC, ' +
                'linked both ways to the Anthropic control plane and workload orchestrator, linked ' +
                'both ways to Google TPU, 1.1 gigawatts in Oklahoma on the SPP grid at 48 volt DC. ' +
                'Bottom row: Azure GB200, 300 megawatts in Virginia on the PJM grid at plus-or-minus ' +
                '400 volt DC, linked both ways to a latency-aware global load balancer, linked both ' +
                'ways to Fluidstack, 300 megawatts in Texas on the ERCOT grid at 480 volt AC.'
        });
        const W = 192, GAP = 52, X0 = 24;
        const PROV = { stroke: 'rule-solid', fill: 'paper', tier: 2 };
        const ORCH = { stroke: 'accent', fill: 'paper-2', tier: 1 };
        const rows = [
          [ Object.assign({ id: 'aws', tag: 'MISO grid · 48 V DC', name: 'AWS Trainium2', sublabel: '600 MW · Indiana',
              legend: 'Compute provider — grid · distribution' }, PROV),
            Object.assign({ id: 'cp', tag: 'Anthropic', name: 'Control plane', sublabel: 'workload orchestrator',
              legend: 'Orchestration' }, ORCH),
            Object.assign({ id: 'gcp', tag: 'SPP grid · 48 V DC', name: 'Google TPU', sublabel: '1.1 GW · Oklahoma' }, PROV) ],
          [ Object.assign({ id: 'az', tag: 'PJM grid · ±400 V DC', name: 'Azure GB200', sublabel: '300 MW · Virginia' }, PROV),
            Object.assign({ id: 'glb', tag: 'Anthropic', name: 'Global load balancer', sublabel: 'latency-aware routing' }, ORCH),
            Object.assign({ id: 'fs', tag: 'ERCOT grid · 480 V AC', name: 'Fluidstack', sublabel: '300 MW · Texas' }, PROV) ]
        ];
        let y = 40;
        rows.forEach(function (row, r) {
          const boxes = row.map(function (n, i) {
            const b = ctx.node(X0 + i * (W + GAP), y, Object.assign({ w: W, h: 76 }, n));
            b.id = n.id; return b;
          });
          for (let i = 0; i < 2; i++) {
            const a = boxes[i], b = boxes[i + 1];
            ctx.edge({ x: a.x + a.w, y: a.y + a.h / 2 }, { x: b.x, y: b.y + b.h / 2 }, {
              fromId: a.id, toId: b.id, stroke: 'ink', tier: 2, pattern: 'solid', marker: false,
              legend: r === 0 && i === 0 ? 'Two-way link' : undefined
            });
          }
          y += 76 + 40;
        });
        ctx.legend();
        return ctx.fit(24);
      }
    },

    /* ---- article-13 · 2.5.11 --------------------------------------------- */
    {
      id: 'migration-sequence',
      page: 'article-13.html',
      caption:
        'Cross-cloud training migration sequence. Six steps from a failed health check to ' +
        'training resuming from the last checkpoint; the time budget below prices each one.',
      because:
        'replaces a hand-built row of six boxes painted red through cyan. The rainbow encoded ' +
        'nothing but order, which the step numbers already carry.',
      build() {
        const ctx = D.create({
          slug: 'migr',
          title: 'Cross-cloud training migration sequence',
          desc: 'Step 1, failure detected when a health check fails. Step 2, checkpoint sync, 15 to ' +
                '60 seconds to save state. Step 3, target selection by capacity and cost. Step 4, ' +
                'resource allocation, spinning up instances. Step 5, state restore, loading the ' +
                'checkpoint. Step 6, training resumes from step N.'
        });
        const steps = [
          ['Failure detected', 'health check fails'], ['Checkpoint sync', '15–60 s to save state'],
          ['Target selection', 'capacity + cost eval'], ['Resource alloc', 'spin up instances'],
          ['State restore', 'load checkpoint'], ['Resume training', 'continue from step N']
        ];
        chain(ctx, 60, 40, 260, steps.map(function (s, i) {
          return {
            id: 'm' + i, tag: 'step ' + (i + 1), name: s[0], sublabel: s[1],
            stroke: i === 0 ? 'accent' : (i === 5 ? 'accent' : 'rule-solid'),
            fill: i === 0 || i === 5 ? 'paper-2' : 'paper', tier: i === 0 || i === 5 ? 1 : 2,
            legend: i === 0 ? 'Trigger and outcome' : (i === 1 ? 'Migration step' : undefined)
          };
        }), 22);
        ctx.legend();
        return ctx.fit(28);
      }
    },

    /* ---- article-9 · live ------------------------------------------------ */
    {
      id: 'live-warm-water-loop',
      page: 'article-9.html',
      caption:
        'Warm-water loop: the dry cooler only works while ambient stays far enough below the ' +
        'return temperature. Switch to the Jakarta afternoon and the approach collapses; inject ' +
        'the CDU pump failover and flow drops to the backup path.',
      because:
        'the hand-drawn living diagram, redrawn by the engine with IEC glyphs (dry cooler, CDU, ' +
        'rack) and the same live configuration. The supply-temperature warning now colours the ' +
        'reading itself, since the engine draws no separate instrument ring.',
      live: {
        title: 'Live: NVIDIA’s 45°C chiller-less claim vs a Jakarta afternoon',
        interval: 1000,
        baselines: {
          supply: { v: 45.0, unit: '°C', dp: 1, noise: 0.2 },
          ret: { v: 55.0, unit: '°C', dp: 1, noise: 0.3 },
          amb: { v: 22.0, unit: '°C', dp: 0, noise: 0.4 }
        },
        flows: { supply: 'flow', return: 'flow', priOut: 'flow', priIn: 'flow' },
        scenarios: [
          { id: 'tropic', label: 'Tropical: Jakarta 35°C', deltas: { amb: 13, supply: 2.5, ret: 2.5 },
            alarms: { drycooler: 'warn', supply: 'warn' },
            msg: 'At 35°C ambient (and 75–90% RH) the dry-cooler approach collapses — supply ' +
                 'creeps past the 45°C design point. The article’s tropical thesis: ‘no ' +
                 'chillers necessary’ is a temperate-climate claim.' },
          { id: 'cdufail', label: 'Inject: CDU pump failover', flows: { supply: 'slow', return: 'slow' },
            alarms: { cdu: 'warn' },
            msg: 'Primary pump trips; the redundant pump ramps and valves reposition — full flow ' +
                 'restored on the backup path (the N+1 failover sequence the article walks through).' }
        ],
        source: 'Illustrative warm-water DLC loop. Supply ≈45°C per NVIDIA (article body); ' +
                'tropical ambient 35°C per the article’s thesis; return/ambient-normal values illustrative.',
        basisTag: 'illustrative'
      },
      build() {
        const ctx = D.create({
          slug: 'lww',
          title: 'Warm-water direct liquid cooling loop',
          desc: 'A dry cooler rejects heat to ambient air at 22 degrees Celsius through a primary loop ' +
                'to a CDU running warm-water direct liquid cooling with no chiller. The CDU supplies ' +
                'the GPU rack cold plates at 45.0 degrees and receives return water at 55.0 degrees.'
        });
        const Y = 40, H = 120, W = 150;
        const dc = ctx.node(24, Y, { id: 'drycooler', state: 'ok', tag: 'heat → ambient', name: 'Dry cooler',
          symbol: 'dryCooler', sublabel: 'ambient 22 °C', valueKey: 'amb', valuePrefix: 'ambient ',
          w: W, h: H, stroke: 'rule-solid', fill: 'paper', tier: 2 });
        const cdu = ctx.node(250, Y, { id: 'cdu', state: 'ok', tag: 'warm-water DLC', name: 'CDU',
          symbol: 'cdu', sublabel: 'no chiller', w: W, h: H, stroke: 'accent', fill: 'paper-2', tier: 1,
          legend: 'No chiller anywhere in the loop' });
        const rk = ctx.node(556, Y, { id: 'rack', state: 'ok', tag: 'cold plates', name: 'GPU rack',
          symbol: 'rack', w: W, h: H, stroke: 'rule-solid', fill: 'paper', tier: 2 });
        const top = Y + 34, bot = Y + H - 34;
        const SUP = { stroke: 'link', tier: 2, pattern: 'solid', state: 'flow' };
        const RET = { stroke: 'accent', tier: 2, pattern: 'dashed' };
        ctx.edge({ x: dc.x + W, y: top }, { x: cdu.x, y: top },
          Object.assign({ id: 'priIn', fromId: 'drycooler', toId: 'cdu', legend: 'Cooled water (supply side)' }, SUP));
        ctx.edge({ x: cdu.x, y: bot }, { x: dc.x + W, y: bot },
          Object.assign({ id: 'priOut', fromId: 'cdu', toId: 'drycooler', legend: 'Warmed water (return side)' }, RET));
        ctx.edge({ x: cdu.x + W, y: top }, { x: rk.x, y: top },
          Object.assign({ id: 'supply', fromId: 'cdu', toId: 'rack', label: 'supply 45.0 °C',
            valueKey: 'supply', valuePrefix: 'SUPPLY ' }, SUP));
        ctx.edge({ x: rk.x, y: bot }, { x: cdu.x + W, y: bot },
          Object.assign({ id: 'return', fromId: 'rack', toId: 'cdu', label: 'return 55.0 °C',
            valueKey: 'ret', valuePrefix: 'RETURN ' }, RET));
        ctx.legend();
        return ctx.fit(24);
      }
    },

    /* ---- article-25 · live ----------------------------------------------- */
    {
      id: 'live-pjm-gap',
      page: 'article-25.html',
      caption:
        'Retirements against the interconnection queue — the race the article quantifies. ' +
        'Fast-forward to 2027–28 and the generation retiring by 2030 opens the capacity gap ' +
        'PJM projects, with 65 million people downstream.',
      because:
        'the hand-drawn living diagram, redrawn by the engine with the same live configuration. ' +
        'No equipment glyph: a generation fleet, a grid operator and an aggregate load are not ' +
        'single pieces of equipment, and a generator symbol on a fleet of coal, gas and nuclear ' +
        'plant would say something false.',
      live: {
        title: 'Live: fast-forward PJM to 2027–28 and watch the 6 GW gap open',
        interval: 1000,
        baselines: { retired: { v: 0, unit: 'GW', dp: 0 }, shortfall: { v: 0, unit: 'GW', dp: 0 } },
        flows: { genGrid: 'flow', gridLoad: 'flow' },
        scenarios: [{
          id: 'ff2027', label: 'Fast-forward: 2027–28', exact: { retired: 40, shortfall: 6 },
          flows: { genGrid: 'slow' }, alarms: { gen: 'warn', grid: 'alarm' },
          msg: '~40 GW of thermal generation retires faster than replacements clear the interconnection ' +
               'queue — PJM’s projected capacity gap reaches 6 GW, with 65 million people downstream ' +
               'and data centers driving 40% of load growth.'
        }],
        source: 'Illustrative PJM schematic. 6 GW shortfall by 2027–28, ~40 GW thermal retirements by ' +
                '2030, data centers = 40% of load growth, 65M customers — as stated in the article body.',
        basisTag: 'illustrative'
      },
      build() {
        const ctx = D.create({
          slug: 'lpjm',
          title: 'PJM: generation fleet, grid and load',
          desc: 'A coal, gas and nuclear generation fleet feeds the PJM grid serving 65 million people, ' +
                'which feeds its load, where data centers drive 40 per cent of load growth. Live values ' +
                'show generation retired by 2030 and the capacity gap.'
        });
        const Y = 40, H = 92, NODE = { stroke: 'rule-solid', fill: 'paper', tier: 2, h: H };
        const gen = ctx.node(24, Y, Object.assign({ id: 'gen', state: 'ok', tag: 'coal · gas · nuclear',
          name: 'Generation fleet', sublabel: 'retired by 2030: 0 GW', valueKey: 'retired',
          valuePrefix: 'retired by 2030: ', w: 196 }, NODE));
        const grid = ctx.node(276, Y, Object.assign({ id: 'grid', state: 'ok', tag: '65M people', name: 'PJM grid',
          sublabel: 'capacity gap: 0 GW', valueKey: 'shortfall', valuePrefix: 'capacity gap: ', w: 180,
          stroke: 'accent', fill: 'paper-2', tier: 1, legend: 'Where the gap opens' }, { h: H }));
        const load = ctx.node(512, Y, Object.assign({ id: 'load', tag: 'data centers drive', name: 'Load',
          sublabel: '40% of load growth', w: 180 }, NODE));
        const E = { stroke: 'accent', tier: 2, pattern: 'solid', state: 'flow' };
        ctx.edge({ x: gen.x + gen.w, y: Y + H / 2 }, { x: grid.x, y: Y + H / 2 },
          Object.assign({ id: 'genGrid', fromId: 'gen', toId: 'grid', legend: 'Energy flow (animated while live)' }, E));
        ctx.edge({ x: grid.x + grid.w, y: Y + H / 2 }, { x: load.x, y: Y + H / 2 },
          Object.assign({ id: 'gridLoad', fromId: 'grid', toId: 'load' }, E));
        ctx.legend();
        return ctx.fit(24);
      }
    },

    /* ---- article-23 · scrollytelling canvas ------------------------------ */
    {
      id: 'colossus-build',
      page: 'article-23.html',
      caption: null,   // the scrolly canvas carries its own title
      because:
        'the hand-drawn scrollytelling canvas, redrawn by the engine. Each stage the reader ' +
        'scrolls to is a reveal layer (ctx.layer), the DAY / MW / GPUS counters are live node ' +
        'values that js/rz-scrolly.js animates, and the turbines, battery and racks carry their ' +
        'IEC glyphs. The battery now has its own feed into the plant: the step it appears in ' +
        'calls turbines and Megapacks together "self-supplied power".',
      build() {
        const ctx = D.create({
          slug: 'clss',
          title: 'The Colossus build, step by step',
          desc: 'A former Electrolux plant in Memphis. Stage one: unpermitted on-site gas turbines ' +
                'and a Tesla Megapack battery system supply the plant. Stage two: GPU rack rows A, B ' +
                'and C fill the floor. Stage three: training goes live on day 122. Counters show the ' +
                'day, megawatts and GPU count for each stage.'
        });
        const CW = 84, CG = 14;
        ['day', 'mw', 'gpus'].forEach(function (k, i) {
          ctx.node(420 + i * (CW + CG), 24, {
            id: 'c-' + k, name: ['Day', 'MW', 'GPUs'][i], sublabel: '0', valueKey: k, w: CW,
            stroke: 'rule-solid', fill: 'paper', tier: 2
          });
        });
        const ZX = 240, ZY = 112, RW = 404, RX = ZX + 22;

        ctx.layer(1);
        const gen = ctx.node(24, 150, { id: 'gen', tag: 'unpermitted · on-site', name: 'Gas turbines',
          symbol: 'genset', w: 184, stroke: 'accent', fill: 'paper-2', tier: 1,
          legend: 'Power that did not wait for the grid' });
        const bess = ctx.node(24, gen.y + gen.h + 22, { id: 'bess', tag: 'Tesla Megapack', name: 'BESS',
          symbol: 'battery', w: 184, stroke: 'accent', fill: 'paper-2', tier: 1 });
        [gen, bess].forEach(function (n, i) {
          ctx.edge({ x: n.x + n.w, y: n.y + n.h / 2 }, { x: ZX, y: n.y + n.h / 2 }, {
            id: i ? 'bess' : 'gen', fromId: i ? 'bess' : 'gen', stroke: 'accent', tier: 2,
            pattern: 'solid', state: 'flow', legend: i ? undefined : 'Self-supplied power, ~150 MW'
          });
        });

        ctx.layer(2);
        let y = ZY + 34;
        ['A', 'B', 'C'].forEach(function (r, i) {
          const n = ctx.node(RX, y, { id: 'row' + r, name: 'GPU rack row ' + r, w: RW, h: 40,
            stroke: 'rule-solid', fill: 'paper', tier: 2, legend: i === 0 ? 'Rack rows' : undefined });
          y = n.y + n.h + 12;
        });

        ctx.layer(3);
        const live = ctx.node(RX, y + 6, { id: 'live', tag: 'day 122', name: 'Training — live',
          sublabel: '“the fastest anyone has ever stood up 100,000 GPUs”', w: RW,
          stroke: 'accent', fill: 'paper-2', tier: 1 });
        ctx.layer(null);

        ctx.zone(ZX, ZY, RW + 44, (live.y + live.h + 18) - ZY, {
          label: 'former Electrolux plant — Memphis', tier: 3
        });
        ctx.legend();
        return ctx.fit(24);
      }
    },

    /* ---- article-28 ------------------------------------------------------ */
    {
      id: 'local-ai-pipeline',
      page: 'article-28.html',
      caption:
        'The default→genius pipeline. Retrieval (4) and tools (5) deliver most of the felt ' +
        'intelligence on a CPU-only machine for a fraction of the effort; stages 6–9 add ' +
        'domain-baking, memory, and reliability. Evaluation feeds back to the prompt and to ' +
        'fine-tuning, and new data goes to RAG. ' +
        'Source: synthesis of distillation, RAG, agentic-tooling, and LoRA literature.',
      because:
        'replaces a hand-typed SVG with fixed coordinates; same nine stages, same two highlights, ' +
        'same feedback line, now routed into its target instead of a curve that stopped short of it.',
      build() {
        const ctx = D.create({
          slug: 'llmp',
          title: 'Default local model → smart domain AI',
          desc: 'Nine stages: base model, quantize, prompt and system, RAG memory, tools and agent, ' +
                'fine-tune, memory and continual learning, orchestrate, and an evaluation loop. RAG ' +
                'memory and tools are the highest return and need no training. Evaluation feeds back ' +
                'to the prompt and to fine-tuning.'
        });
        const W = 200, GX = 40, X0 = 24, H = 72, GY = 40;
        const st = [
          ['Base model', 'qwen2.5 / -coder'], ['Quantize', 'GGUF Q4 · 1.58-bit'], ['Prompt / system', 'steer, structure'],
          ['RAG memory', 'embeddings + store'], ['Tools + agent', 'call, run, iterate'], ['Fine-tune', 'LoRA + distill'],
          ['Memory', 'continual learn'], ['Orchestrate', 'critic · ensemble'], ['Eval loop', 'measure → improve']
        ];
        /* boustrophedon: row 1 left to right, row 2 right to left, row 3 left to right,
           as the original ran its second row */
        const boxes = st.map(function (s, i) {
          const row = Math.floor(i / 3), col = row === 1 ? 2 - (i % 3) : i % 3;
          const hi = i === 3 || i === 4;
          const b = ctx.node(X0 + col * (W + GX), 40 + row * (H + GY), {
            id: 'p' + i, tag: String(i + 1), name: s[0], sublabel: s[1], w: W, h: H,
            stroke: hi ? 'accent' : 'rule-solid', fill: hi ? 'paper-2' : 'paper', tier: hi ? 1 : 2,
            legend: i === 0 ? 'Stage' : (i === 3 ? 'Highest ROI, no training required' : undefined)
          });
          b.id = 'p' + i; b.row = row; return b;
        });
        for (let i = 0; i < boxes.length - 1; i++) {
          const a = boxes[i], b = boxes[i + 1];
          let from, to;
          if (a.row !== b.row) {
            from = { x: a.x + a.w / 2, y: a.y + a.h }; to = { x: b.x + b.w / 2, y: b.y };
          } else if (b.x > a.x) {
            from = { x: a.x + a.w, y: a.y + a.h / 2 }; to = { x: b.x, y: b.y + b.h / 2 };
          } else {
            from = { x: a.x, y: a.y + a.h / 2 }; to = { x: b.x + b.w, y: b.y + b.h / 2 };
          }
          ctx.edge(from, to, { fromId: a.id, toId: b.id, stroke: 'ink', tier: 2, pattern: 'solid' });
        }
        /* The original drew one feedback line, evaluation back to the prompt, and named the
         * fine-tune and RAG returns in text. Drawn, the fine-tune return has to cross the
         * 7 -> 8 connector, so it stays in the caption as the original kept it. */
        const ev = boxes[8], tgt = boxes[2];
        ctx.edge({ x: ev.x + ev.w, y: ev.y + ev.h / 2 }, { x: tgt.x + tgt.w, y: tgt.y + tgt.h / 2 }, {
          fromId: 'p8', toId: tgt.id, stroke: 'accent', tier: 2, pattern: 'dashed',
          legend: 'Feedback: evaluation to prompt'
        });
        ctx.legend();
        return ctx.fit(24);
      }
    }
  ];
}
